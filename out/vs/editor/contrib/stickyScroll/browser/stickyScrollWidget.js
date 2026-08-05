import * as dom from "../../../../base/browser/dom.js";
import { createTrustedTypesPolicy } from "../../../../base/browser/trustedTypes.js";
import { equals } from "../../../../base/common/arrays.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import "./stickyScroll.css";
import { OverlayWidgetPositionPreference } from "../../../browser/editorBrowser.js";
import { getColumnOfNodeOffset } from "../../../browser/viewParts/viewLines/viewLine.js";
import { EmbeddedCodeEditorWidget } from "../../../browser/widget/codeEditor/embeddedCodeEditorWidget.js";
import { EditorOption, RenderLineNumbersType } from "../../../common/config/editorOptions.js";
import { Position } from "../../../common/core/position.js";
import { StringBuilder } from "../../../common/core/stringBuilder.js";
import { LineDecoration } from "../../../common/viewLayout/lineDecorations.js";
import { RenderLineInput, renderViewLine } from "../../../common/viewLayout/viewLineRenderer.js";
import { foldingCollapsedIcon, foldingExpandedIcon } from "../../folding/browser/foldingDecorations.js";
import { Emitter } from "../../../../base/common/event.js";
class StickyScrollWidgetState {
  constructor(startLineNumbers, endLineNumbers, lastLineRelativePosition, showEndForLine = null) {
    this.startLineNumbers = startLineNumbers;
    this.endLineNumbers = endLineNumbers;
    this.lastLineRelativePosition = lastLineRelativePosition;
    this.showEndForLine = showEndForLine;
  }
  equals(other) {
    return !!other && this.lastLineRelativePosition === other.lastLineRelativePosition && this.showEndForLine === other.showEndForLine && equals(this.startLineNumbers, other.startLineNumbers) && equals(this.endLineNumbers, other.endLineNumbers);
  }
  static get Empty() {
    return new StickyScrollWidgetState([], [], 0);
  }
}
const _ttPolicy = createTrustedTypesPolicy("stickyScrollViewLayer", { createHTML: (value) => value });
const STICKY_INDEX_ATTR = "data-sticky-line-index";
const STICKY_IS_LINE_ATTR = "data-sticky-is-line";
const STICKY_IS_LINE_NUMBER_ATTR = "data-sticky-is-line-number";
const STICKY_IS_FOLDING_ICON_ATTR = "data-sticky-is-folding-icon";
class StickyScrollWidget extends Disposable {
  constructor(editor) {
    super();
    this._foldingIconStore = new DisposableStore();
    this._rootDomNode = document.createElement("div");
    this._lineNumbersDomNode = document.createElement("div");
    this._linesDomNodeScrollable = document.createElement("div");
    this._linesDomNode = document.createElement("div");
    this._renderedStickyLines = [];
    this._lineNumbers = [];
    this._lastLineRelativePosition = 0;
    this._minContentWidthInPx = 0;
    this._isOnGlyphMargin = false;
    this._height = -1;
    this._onDidChangeStickyScrollHeight = this._register(new Emitter());
    this.onDidChangeStickyScrollHeight = this._onDidChangeStickyScrollHeight.event;
    this._editor = editor;
    this._lineHeight = editor.getOption(EditorOption.lineHeight);
    this._lineNumbersDomNode.className = "sticky-widget-line-numbers";
    this._lineNumbersDomNode.setAttribute("role", "none");
    this._linesDomNode.className = "sticky-widget-lines";
    this._linesDomNode.setAttribute("role", "list");
    this._linesDomNodeScrollable.className = "sticky-widget-lines-scrollable";
    this._linesDomNodeScrollable.appendChild(this._linesDomNode);
    this._rootDomNode.className = "sticky-widget";
    this._rootDomNode.classList.toggle("peek", editor instanceof EmbeddedCodeEditorWidget);
    this._rootDomNode.appendChild(this._lineNumbersDomNode);
    this._rootDomNode.appendChild(this._linesDomNodeScrollable);
    this._setHeight(0);
    const updateScrollLeftPosition = () => {
      this._linesDomNode.style.left = this._editor.getOption(EditorOption.stickyScroll).scrollWithEditor ? `-${this._editor.getScrollLeft()}px` : "0px";
    };
    this._register(this._editor.onDidChangeConfiguration((e) => {
      if (e.hasChanged(EditorOption.stickyScroll)) {
        updateScrollLeftPosition();
      }
      if (e.hasChanged(EditorOption.lineHeight)) {
        this._lineHeight = this._editor.getOption(EditorOption.lineHeight);
      }
    }));
    this._register(this._editor.onDidScrollChange((e) => {
      if (e.scrollLeftChanged) {
        updateScrollLeftPosition();
      }
      if (e.scrollWidthChanged) {
        this._updateWidgetWidth();
      }
    }));
    this._register(this._editor.onDidChangeModel(() => {
      updateScrollLeftPosition();
      this._updateWidgetWidth();
    }));
    this._register(this._foldingIconStore);
    updateScrollLeftPosition();
    this._register(this._editor.onDidLayoutChange((e) => {
      this._updateWidgetWidth();
    }));
    this._updateWidgetWidth();
  }
  get height() {
    return this._height;
  }
  get lineNumbers() {
    return this._lineNumbers;
  }
  get lineNumberCount() {
    return this._lineNumbers.length;
  }
  getRenderedStickyLine(lineNumber) {
    return this._renderedStickyLines.find((stickyLine) => stickyLine.lineNumber === lineNumber);
  }
  getCurrentLines() {
    return this._lineNumbers;
  }
  setState(_state, foldingModel, _rebuildFromLine) {
    if (_rebuildFromLine === void 0 && (!this._previousState && !_state || this._previousState && this._previousState.equals(_state))) {
      return;
    }
    const isWidgetHeightZero = this._isWidgetHeightZero(_state);
    const state = isWidgetHeightZero ? void 0 : _state;
    const rebuildFromLine = isWidgetHeightZero ? 0 : this._findLineToRebuildWidgetFrom(_state, _rebuildFromLine);
    this._renderRootNode(state, foldingModel, rebuildFromLine);
    this._previousState = _state;
  }
  _isWidgetHeightZero(state) {
    if (!state) {
      return true;
    }
    const futureWidgetHeight = state.startLineNumbers.length * this._lineHeight + state.lastLineRelativePosition;
    if (futureWidgetHeight > 0) {
      this._lastLineRelativePosition = state.lastLineRelativePosition;
      const lineNumbers = [...state.startLineNumbers];
      if (state.showEndForLine !== null) {
        lineNumbers[state.showEndForLine] = state.endLineNumbers[state.showEndForLine];
      }
      this._lineNumbers = lineNumbers;
    } else {
      this._lastLineRelativePosition = 0;
      this._lineNumbers = [];
    }
    return futureWidgetHeight === 0;
  }
  _findLineToRebuildWidgetFrom(state, _rebuildFromLine) {
    if (!state || !this._previousState) {
      return 0;
    }
    if (_rebuildFromLine !== void 0) {
      return _rebuildFromLine;
    }
    const previousState = this._previousState;
    const indexOfLinesAlreadyRendered = state.startLineNumbers.findIndex((startLineNumber) => !previousState.startLineNumbers.includes(startLineNumber));
    return indexOfLinesAlreadyRendered === -1 ? 0 : indexOfLinesAlreadyRendered;
  }
  _updateWidgetWidth() {
    const layoutInfo = this._editor.getLayoutInfo();
    const lineNumbersWidth = layoutInfo.contentLeft;
    this._lineNumbersDomNode.style.width = `${lineNumbersWidth}px`;
    this._linesDomNodeScrollable.style.setProperty("--vscode-editorStickyScroll-scrollableWidth", `${this._editor.getScrollWidth() - layoutInfo.verticalScrollbarWidth}px`);
    this._rootDomNode.style.width = `${layoutInfo.width - layoutInfo.verticalScrollbarWidth}px`;
  }
  _clearStickyLinesFromLine(clearFromLine) {
    this._foldingIconStore.clear();
    for (let i = clearFromLine; i < this._renderedStickyLines.length; i++) {
      const stickyLine = this._renderedStickyLines[i];
      stickyLine.lineNumberDomNode.remove();
      stickyLine.lineDomNode.remove();
    }
    this._renderedStickyLines = this._renderedStickyLines.slice(0, clearFromLine);
  }
  _useFoldingOpacityTransition(requireTransitions) {
    this._lineNumbersDomNode.style.setProperty("--vscode-editorStickyScroll-foldingOpacityTransition", `opacity ${requireTransitions ? 0.5 : 0}s`);
  }
  _setFoldingIconsVisibility(allVisible) {
    for (const line of this._renderedStickyLines) {
      const foldingIcon = line.foldingIcon;
      if (!foldingIcon) {
        continue;
      }
      foldingIcon.setVisible(allVisible ? true : foldingIcon.isCollapsed);
    }
  }
  async _renderRootNode(state, foldingModel, rebuildFromLine) {
    this._clearStickyLinesFromLine(rebuildFromLine);
    if (!state) {
      this._setHeight(0);
      return;
    }
    for (const stickyLine of this._renderedStickyLines) {
      this._updatePosition(stickyLine);
    }
    const layoutInfo = this._editor.getLayoutInfo();
    const linesToRender = this._lineNumbers.slice(rebuildFromLine);
    for (const [index, line] of linesToRender.entries()) {
      const stickyLine = this._renderChildNode(index + rebuildFromLine, line, foldingModel, layoutInfo);
      if (!stickyLine) {
        continue;
      }
      this._linesDomNode.appendChild(stickyLine.lineDomNode);
      this._lineNumbersDomNode.appendChild(stickyLine.lineNumberDomNode);
      this._renderedStickyLines.push(stickyLine);
    }
    if (foldingModel) {
      this._setFoldingHoverListeners();
      this._useFoldingOpacityTransition(!this._isOnGlyphMargin);
    }
    const widgetHeight = this._lineNumbers.length * this._lineHeight + this._lastLineRelativePosition;
    this._setHeight(widgetHeight);
    this._rootDomNode.style.marginLeft = "0px";
    this._minContentWidthInPx = Math.max(...this._renderedStickyLines.map((l) => l.scrollWidth)) + layoutInfo.verticalScrollbarWidth;
    this._editor.layoutOverlayWidget(this);
  }
  _setHeight(height) {
    if (this._height === height) {
      return;
    }
    this._height = height;
    if (this._height === 0) {
      this._rootDomNode.style.display = "none";
    } else {
      this._rootDomNode.style.display = "block";
      this._lineNumbersDomNode.style.height = `${this._height}px`;
      this._linesDomNodeScrollable.style.height = `${this._height}px`;
      this._rootDomNode.style.height = `${this._height}px`;
    }
    this._onDidChangeStickyScrollHeight.fire({ height: this._height });
  }
  _setFoldingHoverListeners() {
    const showFoldingControls = this._editor.getOption(EditorOption.showFoldingControls);
    if (showFoldingControls !== "mouseover") {
      return;
    }
    this._foldingIconStore.add(dom.addDisposableListener(this._lineNumbersDomNode, dom.EventType.MOUSE_ENTER, () => {
      this._isOnGlyphMargin = true;
      this._setFoldingIconsVisibility(true);
    }));
    this._foldingIconStore.add(dom.addDisposableListener(this._lineNumbersDomNode, dom.EventType.MOUSE_LEAVE, () => {
      this._isOnGlyphMargin = false;
      this._useFoldingOpacityTransition(true);
      this._setFoldingIconsVisibility(false);
    }));
  }
  _renderChildNode(index, line, foldingModel, layoutInfo) {
    const viewModel = this._editor._getViewModel();
    if (!viewModel) {
      return;
    }
    const viewLineNumber = viewModel.coordinatesConverter.convertModelPositionToViewPosition(new Position(line, 1)).lineNumber;
    const lineRenderingData = viewModel.getViewLineRenderingData(viewLineNumber);
    const lineNumberOption = this._editor.getOption(EditorOption.lineNumbers);
    let actualInlineDecorations;
    try {
      actualInlineDecorations = LineDecoration.filter(lineRenderingData.inlineDecorations, viewLineNumber, lineRenderingData.minColumn, lineRenderingData.maxColumn);
    } catch (err) {
      actualInlineDecorations = [];
    }
    const lineHeight = this._lineHeight;
    const renderLineInput = new RenderLineInput(
      true,
      true,
      lineRenderingData.content,
      lineRenderingData.continuesWithWrappedLine,
      lineRenderingData.isBasicASCII,
      lineRenderingData.containsRTL,
      0,
      lineRenderingData.tokens,
      actualInlineDecorations,
      lineRenderingData.tabSize,
      lineRenderingData.startVisibleColumn,
      1,
      1,
      1,
      500,
      "none",
      true,
      true,
      null
    );
    const sb = new StringBuilder(2e3);
    const renderOutput = renderViewLine(renderLineInput, sb);
    let newLine;
    if (_ttPolicy) {
      newLine = _ttPolicy.createHTML(sb.build());
    } else {
      newLine = sb.build();
    }
    const lineHTMLNode = document.createElement("span");
    lineHTMLNode.setAttribute(STICKY_INDEX_ATTR, String(index));
    lineHTMLNode.setAttribute(STICKY_IS_LINE_ATTR, "");
    lineHTMLNode.setAttribute("role", "listitem");
    lineHTMLNode.tabIndex = 0;
    lineHTMLNode.className = "sticky-line-content";
    lineHTMLNode.classList.add(`stickyLine${line}`);
    lineHTMLNode.style.lineHeight = `${lineHeight}px`;
    lineHTMLNode.innerHTML = newLine;
    const lineNumberHTMLNode = document.createElement("span");
    lineNumberHTMLNode.setAttribute(STICKY_INDEX_ATTR, String(index));
    lineNumberHTMLNode.setAttribute(STICKY_IS_LINE_NUMBER_ATTR, "");
    lineNumberHTMLNode.className = "sticky-line-number";
    lineNumberHTMLNode.style.lineHeight = `${lineHeight}px`;
    const lineNumbersWidth = layoutInfo.contentLeft;
    lineNumberHTMLNode.style.width = `${lineNumbersWidth}px`;
    const innerLineNumberHTML = document.createElement("span");
    if (lineNumberOption.renderType === RenderLineNumbersType.On || lineNumberOption.renderType === RenderLineNumbersType.Interval && line % 10 === 0) {
      innerLineNumberHTML.innerText = line.toString();
    } else if (lineNumberOption.renderType === RenderLineNumbersType.Relative) {
      innerLineNumberHTML.innerText = Math.abs(line - this._editor.getPosition().lineNumber).toString();
    }
    innerLineNumberHTML.className = "sticky-line-number-inner";
    innerLineNumberHTML.style.width = `${layoutInfo.lineNumbersWidth}px`;
    innerLineNumberHTML.style.paddingLeft = `${layoutInfo.lineNumbersLeft}px`;
    lineNumberHTMLNode.appendChild(innerLineNumberHTML);
    const foldingIcon = this._renderFoldingIconForLine(foldingModel, line);
    if (foldingIcon) {
      lineNumberHTMLNode.appendChild(foldingIcon.domNode);
      foldingIcon.domNode.style.left = `${layoutInfo.lineNumbersWidth + layoutInfo.lineNumbersLeft}px`;
    }
    this._editor.applyFontInfo(lineHTMLNode);
    this._editor.applyFontInfo(lineNumberHTMLNode);
    lineNumberHTMLNode.style.lineHeight = `${lineHeight}px`;
    lineHTMLNode.style.lineHeight = `${lineHeight}px`;
    lineNumberHTMLNode.style.height = `${lineHeight}px`;
    lineHTMLNode.style.height = `${lineHeight}px`;
    const renderedLine = new RenderedStickyLine(index, line, lineHTMLNode, lineNumberHTMLNode, foldingIcon, renderOutput.characterMapping, lineHTMLNode.scrollWidth, lineHeight);
    return this._updatePosition(renderedLine);
  }
  _updatePosition(stickyLine) {
    const index = stickyLine.index;
    const lineHTMLNode = stickyLine.lineDomNode;
    const lineNumberHTMLNode = stickyLine.lineNumberDomNode;
    const isLastLine = index === this._lineNumbers.length - 1;
    if (isLastLine) {
      const zIndex = "0";
      lineHTMLNode.style.zIndex = zIndex;
      lineNumberHTMLNode.style.zIndex = zIndex;
      const top = `${index * this._lineHeight + this._lastLineRelativePosition + (stickyLine.foldingIcon?.isCollapsed ? 1 : 0)}px`;
      lineHTMLNode.style.top = top;
      lineNumberHTMLNode.style.top = top;
    } else {
      const zIndex = "1";
      lineHTMLNode.style.zIndex = zIndex;
      lineNumberHTMLNode.style.zIndex = zIndex;
      const top = `${index * this._lineHeight}px`;
      lineHTMLNode.style.top = top;
      lineNumberHTMLNode.style.top = top;
    }
    return stickyLine;
  }
  _renderFoldingIconForLine(foldingModel, line) {
    const showFoldingControls = this._editor.getOption(EditorOption.showFoldingControls);
    if (!foldingModel || showFoldingControls === "never") {
      return;
    }
    const foldingRegions = foldingModel.regions;
    const indexOfFoldingRegion = foldingRegions.findRange(line);
    const startLineNumber = foldingRegions.getStartLineNumber(indexOfFoldingRegion);
    const isFoldingScope = line === startLineNumber;
    if (!isFoldingScope) {
      return;
    }
    const isCollapsed = foldingRegions.isCollapsed(indexOfFoldingRegion);
    const foldingIcon = new StickyFoldingIcon(isCollapsed, startLineNumber, foldingRegions.getEndLineNumber(indexOfFoldingRegion), this._lineHeight);
    foldingIcon.setVisible(this._isOnGlyphMargin ? true : isCollapsed || showFoldingControls === "always");
    foldingIcon.domNode.setAttribute(STICKY_IS_FOLDING_ICON_ATTR, "");
    return foldingIcon;
  }
  getId() {
    return "editor.contrib.stickyScrollWidget";
  }
  getDomNode() {
    return this._rootDomNode;
  }
  getPosition() {
    return {
      preference: OverlayWidgetPositionPreference.TOP_CENTER,
      stackOridinal: 10
    };
  }
  getMinContentWidthInPx() {
    return this._minContentWidthInPx;
  }
  focusLineWithIndex(index) {
    if (0 <= index && index < this._renderedStickyLines.length) {
      this._renderedStickyLines[index].lineDomNode.focus();
    }
  }
  /**
   * Given a leaf dom node, tries to find the editor position.
   */
  getEditorPositionFromNode(spanDomNode) {
    if (!spanDomNode || spanDomNode.children.length > 0) {
      return null;
    }
    const renderedStickyLine = this._getRenderedStickyLineFromChildDomNode(spanDomNode);
    if (!renderedStickyLine) {
      return null;
    }
    const column = getColumnOfNodeOffset(renderedStickyLine.characterMapping, spanDomNode, 0);
    return new Position(renderedStickyLine.lineNumber, column);
  }
  getLineNumberFromChildDomNode(domNode) {
    return this._getRenderedStickyLineFromChildDomNode(domNode)?.lineNumber ?? null;
  }
  _getRenderedStickyLineFromChildDomNode(domNode) {
    const index = this.getLineIndexFromChildDomNode(domNode);
    if (index === null || index < 0 || index >= this._renderedStickyLines.length) {
      return null;
    }
    return this._renderedStickyLines[index];
  }
  /**
   * Given a child dom node, tries to find the line number attribute that was stored in the node.
   * @returns the attribute value or null if none is found.
   */
  getLineIndexFromChildDomNode(domNode) {
    const lineIndex = this._getAttributeValue(domNode, STICKY_INDEX_ATTR);
    return lineIndex ? parseInt(lineIndex, 10) : null;
  }
  /**
   * Given a child dom node, tries to find if it is (contained in) a sticky line.
   * @returns a boolean.
   */
  isInStickyLine(domNode) {
    const isInLine = this._getAttributeValue(domNode, STICKY_IS_LINE_ATTR);
    return isInLine !== void 0;
  }
  /**
   * Given a child dom node, tries to find if this dom node is (contained in) a sticky folding icon.
   * @returns a boolean.
   */
  isInFoldingIconDomNode(domNode) {
    const isInFoldingIcon = this._getAttributeValue(domNode, STICKY_IS_FOLDING_ICON_ATTR);
    return isInFoldingIcon !== void 0;
  }
  /**
   * Given the dom node, finds if it or its parent sequence contains the given attribute.
   * @returns the attribute value or undefined.
   */
  _getAttributeValue(domNode, attribute) {
    while (domNode && domNode !== this._rootDomNode) {
      const line = domNode.getAttribute(attribute);
      if (line !== null) {
        return line;
      }
      domNode = domNode.parentElement;
    }
    return;
  }
}
class RenderedStickyLine {
  constructor(index, lineNumber, lineDomNode, lineNumberDomNode, foldingIcon, characterMapping, scrollWidth, height) {
    this.index = index;
    this.lineNumber = lineNumber;
    this.lineDomNode = lineDomNode;
    this.lineNumberDomNode = lineNumberDomNode;
    this.foldingIcon = foldingIcon;
    this.characterMapping = characterMapping;
    this.scrollWidth = scrollWidth;
    this.height = height;
  }
}
class StickyFoldingIcon {
  constructor(isCollapsed, foldingStartLine, foldingEndLine, dimension) {
    this.isCollapsed = isCollapsed;
    this.foldingStartLine = foldingStartLine;
    this.foldingEndLine = foldingEndLine;
    this.dimension = dimension;
    this.domNode = document.createElement("div");
    this.domNode.style.width = `26px`;
    this.domNode.style.height = `${dimension}px`;
    this.domNode.style.lineHeight = `${dimension}px`;
    this.domNode.className = ThemeIcon.asClassName(isCollapsed ? foldingCollapsedIcon : foldingExpandedIcon);
  }
  setVisible(visible) {
    this.domNode.style.cursor = visible ? "pointer" : "default";
    this.domNode.style.opacity = visible ? "1" : "0";
  }
}
export {
  StickyScrollWidget,
  StickyScrollWidgetState
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9zdGlja3lTY3JvbGwvYnJvd3Nlci9zdGlja3lTY3JvbGxXaWRnZXQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVUcnVzdGVkVHlwZXNQb2xpY3kgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdHJ1c3RlZFR5cGVzLmpzJztcbmltcG9ydCB7IGVxdWFscyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCAnLi9zdGlja3lTY3JvbGwuY3NzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yLCBJT3ZlcmxheVdpZGdldCwgSU92ZXJsYXlXaWRnZXRQb3NpdGlvbiwgT3ZlcmxheVdpZGdldFBvc2l0aW9uUHJlZmVyZW5jZSB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBnZXRDb2x1bW5PZk5vZGVPZmZzZXQgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3ZpZXdQYXJ0cy92aWV3TGluZXMvdmlld0xpbmUuanMnO1xuaW1wb3J0IHsgRW1iZWRkZWRDb2RlRWRpdG9yV2lkZ2V0IH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci93aWRnZXQvY29kZUVkaXRvci9lbWJlZGRlZENvZGVFZGl0b3JXaWRnZXQuanMnO1xuaW1wb3J0IHsgRWRpdG9yTGF5b3V0SW5mbywgRWRpdG9yT3B0aW9uLCBSZW5kZXJMaW5lTnVtYmVyc1R5cGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBTdHJpbmdCdWlsZGVyIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvc3RyaW5nQnVpbGRlci5qcyc7XG5pbXBvcnQgeyBMaW5lRGVjb3JhdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3TGF5b3V0L2xpbmVEZWNvcmF0aW9ucy5qcyc7XG5pbXBvcnQgeyBDaGFyYWN0ZXJNYXBwaW5nLCBSZW5kZXJMaW5lSW5wdXQsIHJlbmRlclZpZXdMaW5lIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdMYXlvdXQvdmlld0xpbmVSZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBmb2xkaW5nQ29sbGFwc2VkSWNvbiwgZm9sZGluZ0V4cGFuZGVkSWNvbiB9IGZyb20gJy4uLy4uL2ZvbGRpbmcvYnJvd3Nlci9mb2xkaW5nRGVjb3JhdGlvbnMuanMnO1xuaW1wb3J0IHsgRm9sZGluZ01vZGVsIH0gZnJvbSAnLi4vLi4vZm9sZGluZy9icm93c2VyL2ZvbGRpbmdNb2RlbC5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuXG5leHBvcnQgY2xhc3MgU3RpY2t5U2Nyb2xsV2lkZ2V0U3RhdGUge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBzdGFydExpbmVOdW1iZXJzOiBudW1iZXJbXSxcblx0XHRyZWFkb25seSBlbmRMaW5lTnVtYmVyczogbnVtYmVyW10sXG5cdFx0cmVhZG9ubHkgbGFzdExpbmVSZWxhdGl2ZVBvc2l0aW9uOiBudW1iZXIsXG5cdFx0cmVhZG9ubHkgc2hvd0VuZEZvckxpbmU6IG51bWJlciB8IG51bGwgPSBudWxsXG5cdCkgeyB9XG5cblx0ZXF1YWxzKG90aGVyOiBTdGlja3lTY3JvbGxXaWRnZXRTdGF0ZSB8IHVuZGVmaW5lZCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIW90aGVyXG5cdFx0XHQmJiB0aGlzLmxhc3RMaW5lUmVsYXRpdmVQb3NpdGlvbiA9PT0gb3RoZXIubGFzdExpbmVSZWxhdGl2ZVBvc2l0aW9uXG5cdFx0XHQmJiB0aGlzLnNob3dFbmRGb3JMaW5lID09PSBvdGhlci5zaG93RW5kRm9yTGluZVxuXHRcdFx0JiYgZXF1YWxzKHRoaXMuc3RhcnRMaW5lTnVtYmVycywgb3RoZXIuc3RhcnRMaW5lTnVtYmVycylcblx0XHRcdCYmIGVxdWFscyh0aGlzLmVuZExpbmVOdW1iZXJzLCBvdGhlci5lbmRMaW5lTnVtYmVycyk7XG5cdH1cblxuXHRzdGF0aWMgZ2V0IEVtcHR5KCkge1xuXHRcdHJldHVybiBuZXcgU3RpY2t5U2Nyb2xsV2lkZ2V0U3RhdGUoW10sIFtdLCAwKTtcblx0fVxufVxuXG5jb25zdCBfdHRQb2xpY3kgPSBjcmVhdGVUcnVzdGVkVHlwZXNQb2xpY3koJ3N0aWNreVNjcm9sbFZpZXdMYXllcicsIHsgY3JlYXRlSFRNTDogdmFsdWUgPT4gdmFsdWUgfSk7XG5jb25zdCBTVElDS1lfSU5ERVhfQVRUUiA9ICdkYXRhLXN0aWNreS1saW5lLWluZGV4JztcbmNvbnN0IFNUSUNLWV9JU19MSU5FX0FUVFIgPSAnZGF0YS1zdGlja3ktaXMtbGluZSc7XG5jb25zdCBTVElDS1lfSVNfTElORV9OVU1CRVJfQVRUUiA9ICdkYXRhLXN0aWNreS1pcy1saW5lLW51bWJlcic7XG5jb25zdCBTVElDS1lfSVNfRk9MRElOR19JQ09OX0FUVFIgPSAnZGF0YS1zdGlja3ktaXMtZm9sZGluZy1pY29uJztcblxuZXhwb3J0IGNsYXNzIFN0aWNreVNjcm9sbFdpZGdldCBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJT3ZlcmxheVdpZGdldCB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZm9sZGluZ0ljb25TdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0cHJpdmF0ZSByZWFkb25seSBfcm9vdERvbU5vZGU6IEhUTUxFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2xpbmVOdW1iZXJzRG9tTm9kZTogSFRNTEVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0cHJpdmF0ZSByZWFkb25seSBfbGluZXNEb21Ob2RlU2Nyb2xsYWJsZTogSFRNTEVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0cHJpdmF0ZSByZWFkb25seSBfbGluZXNEb21Ob2RlOiBIVE1MRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcjogSUNvZGVFZGl0b3I7XG5cblx0cHJpdmF0ZSBfcHJldmlvdXNTdGF0ZTogU3RpY2t5U2Nyb2xsV2lkZ2V0U3RhdGUgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2xpbmVIZWlnaHQ6IG51bWJlcjtcblx0cHJpdmF0ZSBfcmVuZGVyZWRTdGlja3lMaW5lczogUmVuZGVyZWRTdGlja3lMaW5lW10gPSBbXTtcblx0cHJpdmF0ZSBfbGluZU51bWJlcnM6IG51bWJlcltdID0gW107XG5cdHByaXZhdGUgX2xhc3RMaW5lUmVsYXRpdmVQb3NpdGlvbjogbnVtYmVyID0gMDtcblx0cHJpdmF0ZSBfbWluQ29udGVudFdpZHRoSW5QeDogbnVtYmVyID0gMDtcblx0cHJpdmF0ZSBfaXNPbkdseXBoTWFyZ2luOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgX2hlaWdodDogbnVtYmVyID0gLTE7XG5cblx0cHVibGljIGdldCBoZWlnaHQoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuX2hlaWdodDsgfVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlU3RpY2t5U2Nyb2xsSGVpZ2h0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyBoZWlnaHQ6IG51bWJlciB9PigpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkQ2hhbmdlU3RpY2t5U2Nyb2xsSGVpZ2h0ID0gdGhpcy5fb25EaWRDaGFuZ2VTdGlja3lTY3JvbGxIZWlnaHQuZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0ZWRpdG9yOiBJQ29kZUVkaXRvclxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fZWRpdG9yID0gZWRpdG9yO1xuXHRcdHRoaXMuX2xpbmVIZWlnaHQgPSBlZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5saW5lSGVpZ2h0KTtcblx0XHR0aGlzLl9saW5lTnVtYmVyc0RvbU5vZGUuY2xhc3NOYW1lID0gJ3N0aWNreS13aWRnZXQtbGluZS1udW1iZXJzJztcblx0XHR0aGlzLl9saW5lTnVtYmVyc0RvbU5vZGUuc2V0QXR0cmlidXRlKCdyb2xlJywgJ25vbmUnKTtcblxuXHRcdHRoaXMuX2xpbmVzRG9tTm9kZS5jbGFzc05hbWUgPSAnc3RpY2t5LXdpZGdldC1saW5lcyc7XG5cdFx0dGhpcy5fbGluZXNEb21Ob2RlLnNldEF0dHJpYnV0ZSgncm9sZScsICdsaXN0Jyk7XG5cblx0XHR0aGlzLl9saW5lc0RvbU5vZGVTY3JvbGxhYmxlLmNsYXNzTmFtZSA9ICdzdGlja3ktd2lkZ2V0LWxpbmVzLXNjcm9sbGFibGUnO1xuXHRcdHRoaXMuX2xpbmVzRG9tTm9kZVNjcm9sbGFibGUuYXBwZW5kQ2hpbGQodGhpcy5fbGluZXNEb21Ob2RlKTtcblxuXHRcdHRoaXMuX3Jvb3REb21Ob2RlLmNsYXNzTmFtZSA9ICdzdGlja3ktd2lkZ2V0Jztcblx0XHR0aGlzLl9yb290RG9tTm9kZS5jbGFzc0xpc3QudG9nZ2xlKCdwZWVrJywgZWRpdG9yIGluc3RhbmNlb2YgRW1iZWRkZWRDb2RlRWRpdG9yV2lkZ2V0KTtcblx0XHR0aGlzLl9yb290RG9tTm9kZS5hcHBlbmRDaGlsZCh0aGlzLl9saW5lTnVtYmVyc0RvbU5vZGUpO1xuXHRcdHRoaXMuX3Jvb3REb21Ob2RlLmFwcGVuZENoaWxkKHRoaXMuX2xpbmVzRG9tTm9kZVNjcm9sbGFibGUpO1xuXHRcdHRoaXMuX3NldEhlaWdodCgwKTtcblxuXHRcdGNvbnN0IHVwZGF0ZVNjcm9sbExlZnRQb3NpdGlvbiA9ICgpID0+IHtcblx0XHRcdHRoaXMuX2xpbmVzRG9tTm9kZS5zdHlsZS5sZWZ0ID0gdGhpcy5fZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uc3RpY2t5U2Nyb2xsKS5zY3JvbGxXaXRoRWRpdG9yID8gYC0ke3RoaXMuX2VkaXRvci5nZXRTY3JvbGxMZWZ0KCl9cHhgIDogJzBweCc7XG5cdFx0fTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9lZGl0b3Iub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKChlKSA9PiB7XG5cdFx0XHRpZiAoZS5oYXNDaGFuZ2VkKEVkaXRvck9wdGlvbi5zdGlja3lTY3JvbGwpKSB7XG5cdFx0XHRcdHVwZGF0ZVNjcm9sbExlZnRQb3NpdGlvbigpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGUuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24ubGluZUhlaWdodCkpIHtcblx0XHRcdFx0dGhpcy5fbGluZUhlaWdodCA9IHRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmxpbmVIZWlnaHQpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9lZGl0b3Iub25EaWRTY3JvbGxDaGFuZ2UoKGUpID0+IHtcblx0XHRcdGlmIChlLnNjcm9sbExlZnRDaGFuZ2VkKSB7XG5cdFx0XHRcdHVwZGF0ZVNjcm9sbExlZnRQb3NpdGlvbigpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGUuc2Nyb2xsV2lkdGhDaGFuZ2VkKSB7XG5cdFx0XHRcdHRoaXMuX3VwZGF0ZVdpZGdldFdpZHRoKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2VkaXRvci5vbkRpZENoYW5nZU1vZGVsKCgpID0+IHtcblx0XHRcdHVwZGF0ZVNjcm9sbExlZnRQb3NpdGlvbigpO1xuXHRcdFx0dGhpcy5fdXBkYXRlV2lkZ2V0V2lkdGgoKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZm9sZGluZ0ljb25TdG9yZSk7XG5cdFx0dXBkYXRlU2Nyb2xsTGVmdFBvc2l0aW9uKCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9lZGl0b3Iub25EaWRMYXlvdXRDaGFuZ2UoKGUpID0+IHtcblx0XHRcdHRoaXMuX3VwZGF0ZVdpZGdldFdpZHRoKCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3VwZGF0ZVdpZGdldFdpZHRoKCk7XG5cdH1cblxuXHRnZXQgbGluZU51bWJlcnMoKTogbnVtYmVyW10ge1xuXHRcdHJldHVybiB0aGlzLl9saW5lTnVtYmVycztcblx0fVxuXG5cdGdldCBsaW5lTnVtYmVyQ291bnQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fbGluZU51bWJlcnMubGVuZ3RoO1xuXHR9XG5cblx0Z2V0UmVuZGVyZWRTdGlja3lMaW5lKGxpbmVOdW1iZXI6IG51bWJlcik6IFJlbmRlcmVkU3RpY2t5TGluZSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX3JlbmRlcmVkU3RpY2t5TGluZXMuZmluZChzdGlja3lMaW5lID0+IHN0aWNreUxpbmUubGluZU51bWJlciA9PT0gbGluZU51bWJlcik7XG5cdH1cblxuXHRnZXRDdXJyZW50TGluZXMoKTogcmVhZG9ubHkgbnVtYmVyW10ge1xuXHRcdHJldHVybiB0aGlzLl9saW5lTnVtYmVycztcblx0fVxuXG5cdHNldFN0YXRlKF9zdGF0ZTogU3RpY2t5U2Nyb2xsV2lkZ2V0U3RhdGUgfCB1bmRlZmluZWQsIGZvbGRpbmdNb2RlbDogRm9sZGluZ01vZGVsIHwgdW5kZWZpbmVkLCBfcmVidWlsZEZyb21MaW5lPzogbnVtYmVyKTogdm9pZCB7XG5cdFx0aWYgKF9yZWJ1aWxkRnJvbUxpbmUgPT09IHVuZGVmaW5lZCAmJlxuXHRcdFx0KCghdGhpcy5fcHJldmlvdXNTdGF0ZSAmJiAhX3N0YXRlKSB8fCAodGhpcy5fcHJldmlvdXNTdGF0ZSAmJiB0aGlzLl9wcmV2aW91c1N0YXRlLmVxdWFscyhfc3RhdGUpKSlcblx0XHQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgaXNXaWRnZXRIZWlnaHRaZXJvID0gdGhpcy5faXNXaWRnZXRIZWlnaHRaZXJvKF9zdGF0ZSk7XG5cdFx0Y29uc3Qgc3RhdGUgPSBpc1dpZGdldEhlaWdodFplcm8gPyB1bmRlZmluZWQgOiBfc3RhdGU7XG5cdFx0Y29uc3QgcmVidWlsZEZyb21MaW5lID0gaXNXaWRnZXRIZWlnaHRaZXJvID8gMCA6IHRoaXMuX2ZpbmRMaW5lVG9SZWJ1aWxkV2lkZ2V0RnJvbShfc3RhdGUsIF9yZWJ1aWxkRnJvbUxpbmUpO1xuXG5cdFx0dGhpcy5fcmVuZGVyUm9vdE5vZGUoc3RhdGUsIGZvbGRpbmdNb2RlbCwgcmVidWlsZEZyb21MaW5lKTtcblx0XHR0aGlzLl9wcmV2aW91c1N0YXRlID0gX3N0YXRlO1xuXHR9XG5cblx0cHJpdmF0ZSBfaXNXaWRnZXRIZWlnaHRaZXJvKHN0YXRlOiBTdGlja3lTY3JvbGxXaWRnZXRTdGF0ZSB8IHVuZGVmaW5lZCk6IGJvb2xlYW4ge1xuXHRcdGlmICghc3RhdGUpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRjb25zdCBmdXR1cmVXaWRnZXRIZWlnaHQgPSBzdGF0ZS5zdGFydExpbmVOdW1iZXJzLmxlbmd0aCAqIHRoaXMuX2xpbmVIZWlnaHQgKyBzdGF0ZS5sYXN0TGluZVJlbGF0aXZlUG9zaXRpb247XG5cdFx0aWYgKGZ1dHVyZVdpZGdldEhlaWdodCA+IDApIHtcblx0XHRcdHRoaXMuX2xhc3RMaW5lUmVsYXRpdmVQb3NpdGlvbiA9IHN0YXRlLmxhc3RMaW5lUmVsYXRpdmVQb3NpdGlvbjtcblx0XHRcdGNvbnN0IGxpbmVOdW1iZXJzID0gWy4uLnN0YXRlLnN0YXJ0TGluZU51bWJlcnNdO1xuXHRcdFx0aWYgKHN0YXRlLnNob3dFbmRGb3JMaW5lICE9PSBudWxsKSB7XG5cdFx0XHRcdGxpbmVOdW1iZXJzW3N0YXRlLnNob3dFbmRGb3JMaW5lXSA9IHN0YXRlLmVuZExpbmVOdW1iZXJzW3N0YXRlLnNob3dFbmRGb3JMaW5lXTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX2xpbmVOdW1iZXJzID0gbGluZU51bWJlcnM7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2xhc3RMaW5lUmVsYXRpdmVQb3NpdGlvbiA9IDA7XG5cdFx0XHR0aGlzLl9saW5lTnVtYmVycyA9IFtdO1xuXHRcdH1cblx0XHRyZXR1cm4gZnV0dXJlV2lkZ2V0SGVpZ2h0ID09PSAwO1xuXHR9XG5cblx0cHJpdmF0ZSBfZmluZExpbmVUb1JlYnVpbGRXaWRnZXRGcm9tKHN0YXRlOiBTdGlja3lTY3JvbGxXaWRnZXRTdGF0ZSB8IHVuZGVmaW5lZCwgX3JlYnVpbGRGcm9tTGluZT86IG51bWJlcik6IG51bWJlciB7XG5cdFx0aWYgKCFzdGF0ZSB8fCAhdGhpcy5fcHJldmlvdXNTdGF0ZSkge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXHRcdGlmIChfcmVidWlsZEZyb21MaW5lICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybiBfcmVidWlsZEZyb21MaW5lO1xuXHRcdH1cblx0XHRjb25zdCBwcmV2aW91c1N0YXRlID0gdGhpcy5fcHJldmlvdXNTdGF0ZTtcblx0XHRjb25zdCBpbmRleE9mTGluZXNBbHJlYWR5UmVuZGVyZWQgPSBzdGF0ZS5zdGFydExpbmVOdW1iZXJzLmZpbmRJbmRleChzdGFydExpbmVOdW1iZXIgPT4gIXByZXZpb3VzU3RhdGUuc3RhcnRMaW5lTnVtYmVycy5pbmNsdWRlcyhzdGFydExpbmVOdW1iZXIpKTtcblx0XHRyZXR1cm4gKGluZGV4T2ZMaW5lc0FscmVhZHlSZW5kZXJlZCA9PT0gLTEpID8gMCA6IGluZGV4T2ZMaW5lc0FscmVhZHlSZW5kZXJlZDtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZVdpZGdldFdpZHRoKCk6IHZvaWQge1xuXHRcdGNvbnN0IGxheW91dEluZm8gPSB0aGlzLl9lZGl0b3IuZ2V0TGF5b3V0SW5mbygpO1xuXHRcdGNvbnN0IGxpbmVOdW1iZXJzV2lkdGggPSBsYXlvdXRJbmZvLmNvbnRlbnRMZWZ0O1xuXHRcdHRoaXMuX2xpbmVOdW1iZXJzRG9tTm9kZS5zdHlsZS53aWR0aCA9IGAke2xpbmVOdW1iZXJzV2lkdGh9cHhgO1xuXHRcdHRoaXMuX2xpbmVzRG9tTm9kZVNjcm9sbGFibGUuc3R5bGUuc2V0UHJvcGVydHkoJy0tdnNjb2RlLWVkaXRvclN0aWNreVNjcm9sbC1zY3JvbGxhYmxlV2lkdGgnLCBgJHt0aGlzLl9lZGl0b3IuZ2V0U2Nyb2xsV2lkdGgoKSAtIGxheW91dEluZm8udmVydGljYWxTY3JvbGxiYXJXaWR0aH1weGApO1xuXHRcdHRoaXMuX3Jvb3REb21Ob2RlLnN0eWxlLndpZHRoID0gYCR7bGF5b3V0SW5mby53aWR0aCAtIGxheW91dEluZm8udmVydGljYWxTY3JvbGxiYXJXaWR0aH1weGA7XG5cdH1cblxuXHRwcml2YXRlIF9jbGVhclN0aWNreUxpbmVzRnJvbUxpbmUoY2xlYXJGcm9tTGluZTogbnVtYmVyKSB7XG5cdFx0dGhpcy5fZm9sZGluZ0ljb25TdG9yZS5jbGVhcigpO1xuXHRcdC8vIFJlbW92aW5nIG9ubHkgdGhlIGxpbmVzIHRoYXQgbmVlZCB0byBiZSByZXJlbmRlcmVkXG5cdFx0Zm9yIChsZXQgaSA9IGNsZWFyRnJvbUxpbmU7IGkgPCB0aGlzLl9yZW5kZXJlZFN0aWNreUxpbmVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCBzdGlja3lMaW5lID0gdGhpcy5fcmVuZGVyZWRTdGlja3lMaW5lc1tpXTtcblx0XHRcdHN0aWNreUxpbmUubGluZU51bWJlckRvbU5vZGUucmVtb3ZlKCk7XG5cdFx0XHRzdGlja3lMaW5lLmxpbmVEb21Ob2RlLnJlbW92ZSgpO1xuXHRcdH1cblx0XHQvLyBLZWVwIHRoZSBsaW5lcyB0aGF0IG5lZWQgdG8gYmUgdXBkYXRlZFxuXHRcdHRoaXMuX3JlbmRlcmVkU3RpY2t5TGluZXMgPSB0aGlzLl9yZW5kZXJlZFN0aWNreUxpbmVzLnNsaWNlKDAsIGNsZWFyRnJvbUxpbmUpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXNlRm9sZGluZ09wYWNpdHlUcmFuc2l0aW9uKHJlcXVpcmVUcmFuc2l0aW9uczogYm9vbGVhbikge1xuXHRcdHRoaXMuX2xpbmVOdW1iZXJzRG9tTm9kZS5zdHlsZS5zZXRQcm9wZXJ0eSgnLS12c2NvZGUtZWRpdG9yU3RpY2t5U2Nyb2xsLWZvbGRpbmdPcGFjaXR5VHJhbnNpdGlvbicsIGBvcGFjaXR5ICR7cmVxdWlyZVRyYW5zaXRpb25zID8gMC41IDogMH1zYCk7XG5cdH1cblxuXHRwcml2YXRlIF9zZXRGb2xkaW5nSWNvbnNWaXNpYmlsaXR5KGFsbFZpc2libGU6IGJvb2xlYW4pIHtcblx0XHRmb3IgKGNvbnN0IGxpbmUgb2YgdGhpcy5fcmVuZGVyZWRTdGlja3lMaW5lcykge1xuXHRcdFx0Y29uc3QgZm9sZGluZ0ljb24gPSBsaW5lLmZvbGRpbmdJY29uO1xuXHRcdFx0aWYgKCFmb2xkaW5nSWNvbikge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGZvbGRpbmdJY29uLnNldFZpc2libGUoYWxsVmlzaWJsZSA/IHRydWUgOiBmb2xkaW5nSWNvbi5pc0NvbGxhcHNlZCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfcmVuZGVyUm9vdE5vZGUoc3RhdGU6IFN0aWNreVNjcm9sbFdpZGdldFN0YXRlIHwgdW5kZWZpbmVkLCBmb2xkaW5nTW9kZWw6IEZvbGRpbmdNb2RlbCB8IHVuZGVmaW5lZCwgcmVidWlsZEZyb21MaW5lOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLl9jbGVhclN0aWNreUxpbmVzRnJvbUxpbmUocmVidWlsZEZyb21MaW5lKTtcblx0XHRpZiAoIXN0YXRlKSB7XG5cdFx0XHQvLyBtYWtlIHN1cmUgdGhlIGRvbSBpcyAwIGhlaWdodCBhbmQgZGlzcGxheTpub25lXG5cdFx0XHR0aGlzLl9zZXRIZWlnaHQoMCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdC8vIEZvciBleGlzdGluZyBzdGlja3kgbGluZXMgdXBkYXRlIHRoZSB0b3AgYW5kIHotaW5kZXhcblx0XHRmb3IgKGNvbnN0IHN0aWNreUxpbmUgb2YgdGhpcy5fcmVuZGVyZWRTdGlja3lMaW5lcykge1xuXHRcdFx0dGhpcy5fdXBkYXRlUG9zaXRpb24oc3RpY2t5TGluZSk7XG5cdFx0fVxuXHRcdC8vIEZvciBuZXcgc3RpY2t5IGxpbmVzXG5cdFx0Y29uc3QgbGF5b3V0SW5mbyA9IHRoaXMuX2VkaXRvci5nZXRMYXlvdXRJbmZvKCk7XG5cdFx0Y29uc3QgbGluZXNUb1JlbmRlciA9IHRoaXMuX2xpbmVOdW1iZXJzLnNsaWNlKHJlYnVpbGRGcm9tTGluZSk7XG5cdFx0Zm9yIChjb25zdCBbaW5kZXgsIGxpbmVdIG9mIGxpbmVzVG9SZW5kZXIuZW50cmllcygpKSB7XG5cdFx0XHRjb25zdCBzdGlja3lMaW5lID0gdGhpcy5fcmVuZGVyQ2hpbGROb2RlKGluZGV4ICsgcmVidWlsZEZyb21MaW5lLCBsaW5lLCBmb2xkaW5nTW9kZWwsIGxheW91dEluZm8pO1xuXHRcdFx0aWYgKCFzdGlja3lMaW5lKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fbGluZXNEb21Ob2RlLmFwcGVuZENoaWxkKHN0aWNreUxpbmUubGluZURvbU5vZGUpO1xuXHRcdFx0dGhpcy5fbGluZU51bWJlcnNEb21Ob2RlLmFwcGVuZENoaWxkKHN0aWNreUxpbmUubGluZU51bWJlckRvbU5vZGUpO1xuXHRcdFx0dGhpcy5fcmVuZGVyZWRTdGlja3lMaW5lcy5wdXNoKHN0aWNreUxpbmUpO1xuXHRcdH1cblx0XHRpZiAoZm9sZGluZ01vZGVsKSB7XG5cdFx0XHR0aGlzLl9zZXRGb2xkaW5nSG92ZXJMaXN0ZW5lcnMoKTtcblx0XHRcdHRoaXMuX3VzZUZvbGRpbmdPcGFjaXR5VHJhbnNpdGlvbighdGhpcy5faXNPbkdseXBoTWFyZ2luKTtcblx0XHR9XG5cblx0XHRjb25zdCB3aWRnZXRIZWlnaHQgPSB0aGlzLl9saW5lTnVtYmVycy5sZW5ndGggKiB0aGlzLl9saW5lSGVpZ2h0ICsgdGhpcy5fbGFzdExpbmVSZWxhdGl2ZVBvc2l0aW9uO1xuXHRcdHRoaXMuX3NldEhlaWdodCh3aWRnZXRIZWlnaHQpO1xuXG5cdFx0dGhpcy5fcm9vdERvbU5vZGUuc3R5bGUubWFyZ2luTGVmdCA9ICcwcHgnO1xuXHRcdHRoaXMuX21pbkNvbnRlbnRXaWR0aEluUHggPSBNYXRoLm1heCguLi50aGlzLl9yZW5kZXJlZFN0aWNreUxpbmVzLm1hcChsID0+IGwuc2Nyb2xsV2lkdGgpKSArIGxheW91dEluZm8udmVydGljYWxTY3JvbGxiYXJXaWR0aDtcblx0XHR0aGlzLl9lZGl0b3IubGF5b3V0T3ZlcmxheVdpZGdldCh0aGlzKTtcblx0fVxuXG5cdHByaXZhdGUgX3NldEhlaWdodChoZWlnaHQ6IG51bWJlcik6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9oZWlnaHQgPT09IGhlaWdodCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9oZWlnaHQgPSBoZWlnaHQ7XG5cblx0XHRpZiAodGhpcy5faGVpZ2h0ID09PSAwKSB7XG5cdFx0XHR0aGlzLl9yb290RG9tTm9kZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9yb290RG9tTm9kZS5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcblx0XHRcdHRoaXMuX2xpbmVOdW1iZXJzRG9tTm9kZS5zdHlsZS5oZWlnaHQgPSBgJHt0aGlzLl9oZWlnaHR9cHhgO1xuXHRcdFx0dGhpcy5fbGluZXNEb21Ob2RlU2Nyb2xsYWJsZS5zdHlsZS5oZWlnaHQgPSBgJHt0aGlzLl9oZWlnaHR9cHhgO1xuXHRcdFx0dGhpcy5fcm9vdERvbU5vZGUuc3R5bGUuaGVpZ2h0ID0gYCR7dGhpcy5faGVpZ2h0fXB4YDtcblx0XHR9XG5cblx0XHR0aGlzLl9vbkRpZENoYW5nZVN0aWNreVNjcm9sbEhlaWdodC5maXJlKHsgaGVpZ2h0OiB0aGlzLl9oZWlnaHQgfSk7XG5cdH1cblxuXHRwcml2YXRlIF9zZXRGb2xkaW5nSG92ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cdFx0Y29uc3Qgc2hvd0ZvbGRpbmdDb250cm9sczogJ21vdXNlb3ZlcicgfCAnYWx3YXlzJyB8ICduZXZlcicgPSB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5zaG93Rm9sZGluZ0NvbnRyb2xzKTtcblx0XHRpZiAoc2hvd0ZvbGRpbmdDb250cm9scyAhPT0gJ21vdXNlb3ZlcicpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fZm9sZGluZ0ljb25TdG9yZS5hZGQoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLl9saW5lTnVtYmVyc0RvbU5vZGUsIGRvbS5FdmVudFR5cGUuTU9VU0VfRU5URVIsICgpID0+IHtcblx0XHRcdHRoaXMuX2lzT25HbHlwaE1hcmdpbiA9IHRydWU7XG5cdFx0XHR0aGlzLl9zZXRGb2xkaW5nSWNvbnNWaXNpYmlsaXR5KHRydWUpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9mb2xkaW5nSWNvblN0b3JlLmFkZChkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuX2xpbmVOdW1iZXJzRG9tTm9kZSwgZG9tLkV2ZW50VHlwZS5NT1VTRV9MRUFWRSwgKCkgPT4ge1xuXHRcdFx0dGhpcy5faXNPbkdseXBoTWFyZ2luID0gZmFsc2U7XG5cdFx0XHR0aGlzLl91c2VGb2xkaW5nT3BhY2l0eVRyYW5zaXRpb24odHJ1ZSk7XG5cdFx0XHR0aGlzLl9zZXRGb2xkaW5nSWNvbnNWaXNpYmlsaXR5KGZhbHNlKTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIF9yZW5kZXJDaGlsZE5vZGUoaW5kZXg6IG51bWJlciwgbGluZTogbnVtYmVyLCBmb2xkaW5nTW9kZWw6IEZvbGRpbmdNb2RlbCB8IHVuZGVmaW5lZCwgbGF5b3V0SW5mbzogRWRpdG9yTGF5b3V0SW5mbyk6IFJlbmRlcmVkU3RpY2t5TGluZSB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3Qgdmlld01vZGVsID0gdGhpcy5fZWRpdG9yLl9nZXRWaWV3TW9kZWwoKTtcblx0XHRpZiAoIXZpZXdNb2RlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCB2aWV3TGluZU51bWJlciA9IHZpZXdNb2RlbC5jb29yZGluYXRlc0NvbnZlcnRlci5jb252ZXJ0TW9kZWxQb3NpdGlvblRvVmlld1Bvc2l0aW9uKG5ldyBQb3NpdGlvbihsaW5lLCAxKSkubGluZU51bWJlcjtcblx0XHRjb25zdCBsaW5lUmVuZGVyaW5nRGF0YSA9IHZpZXdNb2RlbC5nZXRWaWV3TGluZVJlbmRlcmluZ0RhdGEodmlld0xpbmVOdW1iZXIpO1xuXHRcdGNvbnN0IGxpbmVOdW1iZXJPcHRpb24gPSB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5saW5lTnVtYmVycyk7XG5cblx0XHRsZXQgYWN0dWFsSW5saW5lRGVjb3JhdGlvbnM6IExpbmVEZWNvcmF0aW9uW107XG5cdFx0dHJ5IHtcblx0XHRcdGFjdHVhbElubGluZURlY29yYXRpb25zID0gTGluZURlY29yYXRpb24uZmlsdGVyKGxpbmVSZW5kZXJpbmdEYXRhLmlubGluZURlY29yYXRpb25zLCB2aWV3TGluZU51bWJlciwgbGluZVJlbmRlcmluZ0RhdGEubWluQ29sdW1uLCBsaW5lUmVuZGVyaW5nRGF0YS5tYXhDb2x1bW4pO1xuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0YWN0dWFsSW5saW5lRGVjb3JhdGlvbnMgPSBbXTtcblx0XHR9XG5cblx0XHRjb25zdCBsaW5lSGVpZ2h0ID0gdGhpcy5fbGluZUhlaWdodDtcblx0XHRjb25zdCByZW5kZXJMaW5lSW5wdXQ6IFJlbmRlckxpbmVJbnB1dCA9IG5ldyBSZW5kZXJMaW5lSW5wdXQodHJ1ZSwgdHJ1ZSwgbGluZVJlbmRlcmluZ0RhdGEuY29udGVudCxcblx0XHRcdGxpbmVSZW5kZXJpbmdEYXRhLmNvbnRpbnVlc1dpdGhXcmFwcGVkTGluZSxcblx0XHRcdGxpbmVSZW5kZXJpbmdEYXRhLmlzQmFzaWNBU0NJSSwgbGluZVJlbmRlcmluZ0RhdGEuY29udGFpbnNSVEwsIDAsXG5cdFx0XHRsaW5lUmVuZGVyaW5nRGF0YS50b2tlbnMsIGFjdHVhbElubGluZURlY29yYXRpb25zLFxuXHRcdFx0bGluZVJlbmRlcmluZ0RhdGEudGFiU2l6ZSwgbGluZVJlbmRlcmluZ0RhdGEuc3RhcnRWaXNpYmxlQ29sdW1uLFxuXHRcdFx0MSwgMSwgMSwgNTAwLCAnbm9uZScsIHRydWUsIHRydWUsIG51bGxcblx0XHQpO1xuXG5cdFx0Y29uc3Qgc2IgPSBuZXcgU3RyaW5nQnVpbGRlcigyMDAwKTtcblx0XHRjb25zdCByZW5kZXJPdXRwdXQgPSByZW5kZXJWaWV3TGluZShyZW5kZXJMaW5lSW5wdXQsIHNiKTtcblxuXHRcdGxldCBuZXdMaW5lO1xuXHRcdGlmIChfdHRQb2xpY3kpIHtcblx0XHRcdG5ld0xpbmUgPSBfdHRQb2xpY3kuY3JlYXRlSFRNTChzYi5idWlsZCgpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bmV3TGluZSA9IHNiLmJ1aWxkKCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGluZUhUTUxOb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuXHRcdGxpbmVIVE1MTm9kZS5zZXRBdHRyaWJ1dGUoU1RJQ0tZX0lOREVYX0FUVFIsIFN0cmluZyhpbmRleCkpO1xuXHRcdGxpbmVIVE1MTm9kZS5zZXRBdHRyaWJ1dGUoU1RJQ0tZX0lTX0xJTkVfQVRUUiwgJycpO1xuXHRcdGxpbmVIVE1MTm9kZS5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnbGlzdGl0ZW0nKTtcblx0XHRsaW5lSFRNTE5vZGUudGFiSW5kZXggPSAwO1xuXHRcdGxpbmVIVE1MTm9kZS5jbGFzc05hbWUgPSAnc3RpY2t5LWxpbmUtY29udGVudCc7XG5cdFx0bGluZUhUTUxOb2RlLmNsYXNzTGlzdC5hZGQoYHN0aWNreUxpbmUke2xpbmV9YCk7XG5cdFx0bGluZUhUTUxOb2RlLnN0eWxlLmxpbmVIZWlnaHQgPSBgJHtsaW5lSGVpZ2h0fXB4YDtcblx0XHRsaW5lSFRNTE5vZGUuaW5uZXJIVE1MID0gbmV3TGluZSBhcyBzdHJpbmc7XG5cblx0XHRjb25zdCBsaW5lTnVtYmVySFRNTE5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG5cdFx0bGluZU51bWJlckhUTUxOb2RlLnNldEF0dHJpYnV0ZShTVElDS1lfSU5ERVhfQVRUUiwgU3RyaW5nKGluZGV4KSk7XG5cdFx0bGluZU51bWJlckhUTUxOb2RlLnNldEF0dHJpYnV0ZShTVElDS1lfSVNfTElORV9OVU1CRVJfQVRUUiwgJycpO1xuXHRcdGxpbmVOdW1iZXJIVE1MTm9kZS5jbGFzc05hbWUgPSAnc3RpY2t5LWxpbmUtbnVtYmVyJztcblx0XHRsaW5lTnVtYmVySFRNTE5vZGUuc3R5bGUubGluZUhlaWdodCA9IGAke2xpbmVIZWlnaHR9cHhgO1xuXHRcdGNvbnN0IGxpbmVOdW1iZXJzV2lkdGggPSBsYXlvdXRJbmZvLmNvbnRlbnRMZWZ0O1xuXHRcdGxpbmVOdW1iZXJIVE1MTm9kZS5zdHlsZS53aWR0aCA9IGAke2xpbmVOdW1iZXJzV2lkdGh9cHhgO1xuXG5cdFx0Y29uc3QgaW5uZXJMaW5lTnVtYmVySFRNTCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcblx0XHRpZiAobGluZU51bWJlck9wdGlvbi5yZW5kZXJUeXBlID09PSBSZW5kZXJMaW5lTnVtYmVyc1R5cGUuT24gfHwgbGluZU51bWJlck9wdGlvbi5yZW5kZXJUeXBlID09PSBSZW5kZXJMaW5lTnVtYmVyc1R5cGUuSW50ZXJ2YWwgJiYgbGluZSAlIDEwID09PSAwKSB7XG5cdFx0XHRpbm5lckxpbmVOdW1iZXJIVE1MLmlubmVyVGV4dCA9IGxpbmUudG9TdHJpbmcoKTtcblx0XHR9IGVsc2UgaWYgKGxpbmVOdW1iZXJPcHRpb24ucmVuZGVyVHlwZSA9PT0gUmVuZGVyTGluZU51bWJlcnNUeXBlLlJlbGF0aXZlKSB7XG5cdFx0XHRpbm5lckxpbmVOdW1iZXJIVE1MLmlubmVyVGV4dCA9IE1hdGguYWJzKGxpbmUgLSB0aGlzLl9lZGl0b3IuZ2V0UG9zaXRpb24oKSEubGluZU51bWJlcikudG9TdHJpbmcoKTtcblx0XHR9XG5cdFx0aW5uZXJMaW5lTnVtYmVySFRNTC5jbGFzc05hbWUgPSAnc3RpY2t5LWxpbmUtbnVtYmVyLWlubmVyJztcblx0XHRpbm5lckxpbmVOdW1iZXJIVE1MLnN0eWxlLndpZHRoID0gYCR7bGF5b3V0SW5mby5saW5lTnVtYmVyc1dpZHRofXB4YDtcblx0XHRpbm5lckxpbmVOdW1iZXJIVE1MLnN0eWxlLnBhZGRpbmdMZWZ0ID0gYCR7bGF5b3V0SW5mby5saW5lTnVtYmVyc0xlZnR9cHhgO1xuXG5cdFx0bGluZU51bWJlckhUTUxOb2RlLmFwcGVuZENoaWxkKGlubmVyTGluZU51bWJlckhUTUwpO1xuXHRcdGNvbnN0IGZvbGRpbmdJY29uID0gdGhpcy5fcmVuZGVyRm9sZGluZ0ljb25Gb3JMaW5lKGZvbGRpbmdNb2RlbCwgbGluZSk7XG5cdFx0aWYgKGZvbGRpbmdJY29uKSB7XG5cdFx0XHRsaW5lTnVtYmVySFRNTE5vZGUuYXBwZW5kQ2hpbGQoZm9sZGluZ0ljb24uZG9tTm9kZSk7XG5cdFx0XHRmb2xkaW5nSWNvbi5kb21Ob2RlLnN0eWxlLmxlZnQgPSBgJHtsYXlvdXRJbmZvLmxpbmVOdW1iZXJzV2lkdGggKyBsYXlvdXRJbmZvLmxpbmVOdW1iZXJzTGVmdH1weGA7XG5cdFx0fVxuXG5cdFx0dGhpcy5fZWRpdG9yLmFwcGx5Rm9udEluZm8obGluZUhUTUxOb2RlKTtcblx0XHR0aGlzLl9lZGl0b3IuYXBwbHlGb250SW5mbyhsaW5lTnVtYmVySFRNTE5vZGUpO1xuXG5cblx0XHRsaW5lTnVtYmVySFRNTE5vZGUuc3R5bGUubGluZUhlaWdodCA9IGAke2xpbmVIZWlnaHR9cHhgO1xuXHRcdGxpbmVIVE1MTm9kZS5zdHlsZS5saW5lSGVpZ2h0ID0gYCR7bGluZUhlaWdodH1weGA7XG5cdFx0bGluZU51bWJlckhUTUxOb2RlLnN0eWxlLmhlaWdodCA9IGAke2xpbmVIZWlnaHR9cHhgO1xuXHRcdGxpbmVIVE1MTm9kZS5zdHlsZS5oZWlnaHQgPSBgJHtsaW5lSGVpZ2h0fXB4YDtcblxuXHRcdGNvbnN0IHJlbmRlcmVkTGluZSA9IG5ldyBSZW5kZXJlZFN0aWNreUxpbmUoaW5kZXgsIGxpbmUsIGxpbmVIVE1MTm9kZSwgbGluZU51bWJlckhUTUxOb2RlLCBmb2xkaW5nSWNvbiwgcmVuZGVyT3V0cHV0LmNoYXJhY3Rlck1hcHBpbmcsIGxpbmVIVE1MTm9kZS5zY3JvbGxXaWR0aCwgbGluZUhlaWdodCk7XG5cdFx0cmV0dXJuIHRoaXMuX3VwZGF0ZVBvc2l0aW9uKHJlbmRlcmVkTGluZSk7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVQb3NpdGlvbihzdGlja3lMaW5lOiBSZW5kZXJlZFN0aWNreUxpbmUpOiBSZW5kZXJlZFN0aWNreUxpbmUge1xuXHRcdGNvbnN0IGluZGV4ID0gc3RpY2t5TGluZS5pbmRleDtcblx0XHRjb25zdCBsaW5lSFRNTE5vZGUgPSBzdGlja3lMaW5lLmxpbmVEb21Ob2RlO1xuXHRcdGNvbnN0IGxpbmVOdW1iZXJIVE1MTm9kZSA9IHN0aWNreUxpbmUubGluZU51bWJlckRvbU5vZGU7XG5cdFx0Y29uc3QgaXNMYXN0TGluZSA9IGluZGV4ID09PSB0aGlzLl9saW5lTnVtYmVycy5sZW5ndGggLSAxO1xuXHRcdGlmIChpc0xhc3RMaW5lKSB7XG5cdFx0XHRjb25zdCB6SW5kZXggPSAnMCc7XG5cdFx0XHRsaW5lSFRNTE5vZGUuc3R5bGUuekluZGV4ID0gekluZGV4O1xuXHRcdFx0bGluZU51bWJlckhUTUxOb2RlLnN0eWxlLnpJbmRleCA9IHpJbmRleDtcblx0XHRcdGNvbnN0IHRvcCA9IGAke2luZGV4ICogdGhpcy5fbGluZUhlaWdodCArIHRoaXMuX2xhc3RMaW5lUmVsYXRpdmVQb3NpdGlvbiArIChzdGlja3lMaW5lLmZvbGRpbmdJY29uPy5pc0NvbGxhcHNlZCA/IDEgOiAwKX1weGA7XG5cdFx0XHRsaW5lSFRNTE5vZGUuc3R5bGUudG9wID0gdG9wO1xuXHRcdFx0bGluZU51bWJlckhUTUxOb2RlLnN0eWxlLnRvcCA9IHRvcDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgekluZGV4ID0gJzEnO1xuXHRcdFx0bGluZUhUTUxOb2RlLnN0eWxlLnpJbmRleCA9IHpJbmRleDtcblx0XHRcdGxpbmVOdW1iZXJIVE1MTm9kZS5zdHlsZS56SW5kZXggPSB6SW5kZXg7XG5cdFx0XHRjb25zdCB0b3AgPSBgJHtpbmRleCAqIHRoaXMuX2xpbmVIZWlnaHR9cHhgO1xuXHRcdFx0bGluZUhUTUxOb2RlLnN0eWxlLnRvcCA9IHRvcDtcblx0XHRcdGxpbmVOdW1iZXJIVE1MTm9kZS5zdHlsZS50b3AgPSB0b3A7XG5cdFx0fVxuXHRcdHJldHVybiBzdGlja3lMaW5lO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVuZGVyRm9sZGluZ0ljb25Gb3JMaW5lKGZvbGRpbmdNb2RlbDogRm9sZGluZ01vZGVsIHwgdW5kZWZpbmVkLCBsaW5lOiBudW1iZXIpOiBTdGlja3lGb2xkaW5nSWNvbiB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3Qgc2hvd0ZvbGRpbmdDb250cm9sczogJ21vdXNlb3ZlcicgfCAnYWx3YXlzJyB8ICduZXZlcicgPSB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5zaG93Rm9sZGluZ0NvbnRyb2xzKTtcblx0XHRpZiAoIWZvbGRpbmdNb2RlbCB8fCBzaG93Rm9sZGluZ0NvbnRyb2xzID09PSAnbmV2ZXInKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGZvbGRpbmdSZWdpb25zID0gZm9sZGluZ01vZGVsLnJlZ2lvbnM7XG5cdFx0Y29uc3QgaW5kZXhPZkZvbGRpbmdSZWdpb24gPSBmb2xkaW5nUmVnaW9ucy5maW5kUmFuZ2UobGluZSk7XG5cdFx0Y29uc3Qgc3RhcnRMaW5lTnVtYmVyID0gZm9sZGluZ1JlZ2lvbnMuZ2V0U3RhcnRMaW5lTnVtYmVyKGluZGV4T2ZGb2xkaW5nUmVnaW9uKTtcblx0XHRjb25zdCBpc0ZvbGRpbmdTY29wZSA9IGxpbmUgPT09IHN0YXJ0TGluZU51bWJlcjtcblx0XHRpZiAoIWlzRm9sZGluZ1Njb3BlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGlzQ29sbGFwc2VkID0gZm9sZGluZ1JlZ2lvbnMuaXNDb2xsYXBzZWQoaW5kZXhPZkZvbGRpbmdSZWdpb24pO1xuXHRcdGNvbnN0IGZvbGRpbmdJY29uID0gbmV3IFN0aWNreUZvbGRpbmdJY29uKGlzQ29sbGFwc2VkLCBzdGFydExpbmVOdW1iZXIsIGZvbGRpbmdSZWdpb25zLmdldEVuZExpbmVOdW1iZXIoaW5kZXhPZkZvbGRpbmdSZWdpb24pLCB0aGlzLl9saW5lSGVpZ2h0KTtcblx0XHRmb2xkaW5nSWNvbi5zZXRWaXNpYmxlKHRoaXMuX2lzT25HbHlwaE1hcmdpbiA/IHRydWUgOiAoaXNDb2xsYXBzZWQgfHwgc2hvd0ZvbGRpbmdDb250cm9scyA9PT0gJ2Fsd2F5cycpKTtcblx0XHRmb2xkaW5nSWNvbi5kb21Ob2RlLnNldEF0dHJpYnV0ZShTVElDS1lfSVNfRk9MRElOR19JQ09OX0FUVFIsICcnKTtcblx0XHRyZXR1cm4gZm9sZGluZ0ljb247XG5cdH1cblxuXHRnZXRJZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiAnZWRpdG9yLmNvbnRyaWIuc3RpY2t5U2Nyb2xsV2lkZ2V0Jztcblx0fVxuXG5cdGdldERvbU5vZGUoKTogSFRNTEVsZW1lbnQge1xuXHRcdHJldHVybiB0aGlzLl9yb290RG9tTm9kZTtcblx0fVxuXG5cdGdldFBvc2l0aW9uKCk6IElPdmVybGF5V2lkZ2V0UG9zaXRpb24gfCBudWxsIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cHJlZmVyZW5jZTogT3ZlcmxheVdpZGdldFBvc2l0aW9uUHJlZmVyZW5jZS5UT1BfQ0VOVEVSLFxuXHRcdFx0c3RhY2tPcmlkaW5hbDogMTAsXG5cdFx0fTtcblx0fVxuXG5cdGdldE1pbkNvbnRlbnRXaWR0aEluUHgoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fbWluQ29udGVudFdpZHRoSW5QeDtcblx0fVxuXG5cdGZvY3VzTGluZVdpdGhJbmRleChpbmRleDogbnVtYmVyKSB7XG5cdFx0aWYgKDAgPD0gaW5kZXggJiYgaW5kZXggPCB0aGlzLl9yZW5kZXJlZFN0aWNreUxpbmVzLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5fcmVuZGVyZWRTdGlja3lMaW5lc1tpbmRleF0ubGluZURvbU5vZGUuZm9jdXMoKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogR2l2ZW4gYSBsZWFmIGRvbSBub2RlLCB0cmllcyB0byBmaW5kIHRoZSBlZGl0b3IgcG9zaXRpb24uXG5cdCAqL1xuXHRnZXRFZGl0b3JQb3NpdGlvbkZyb21Ob2RlKHNwYW5Eb21Ob2RlOiBIVE1MRWxlbWVudCB8IG51bGwpOiBQb3NpdGlvbiB8IG51bGwge1xuXHRcdGlmICghc3BhbkRvbU5vZGUgfHwgc3BhbkRvbU5vZGUuY2hpbGRyZW4ubGVuZ3RoID4gMCkge1xuXHRcdFx0Ly8gVGhpcyBpcyBub3QgYSBsZWFmIG5vZGVcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRjb25zdCByZW5kZXJlZFN0aWNreUxpbmUgPSB0aGlzLl9nZXRSZW5kZXJlZFN0aWNreUxpbmVGcm9tQ2hpbGREb21Ob2RlKHNwYW5Eb21Ob2RlKTtcblx0XHRpZiAoIXJlbmRlcmVkU3RpY2t5TGluZSkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGNvbnN0IGNvbHVtbiA9IGdldENvbHVtbk9mTm9kZU9mZnNldChyZW5kZXJlZFN0aWNreUxpbmUuY2hhcmFjdGVyTWFwcGluZywgc3BhbkRvbU5vZGUsIDApO1xuXHRcdHJldHVybiBuZXcgUG9zaXRpb24ocmVuZGVyZWRTdGlja3lMaW5lLmxpbmVOdW1iZXIsIGNvbHVtbik7XG5cdH1cblxuXHRnZXRMaW5lTnVtYmVyRnJvbUNoaWxkRG9tTm9kZShkb21Ob2RlOiBIVE1MRWxlbWVudCB8IG51bGwpOiBudW1iZXIgfCBudWxsIHtcblx0XHRyZXR1cm4gdGhpcy5fZ2V0UmVuZGVyZWRTdGlja3lMaW5lRnJvbUNoaWxkRG9tTm9kZShkb21Ob2RlKT8ubGluZU51bWJlciA/PyBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0UmVuZGVyZWRTdGlja3lMaW5lRnJvbUNoaWxkRG9tTm9kZShkb21Ob2RlOiBIVE1MRWxlbWVudCB8IG51bGwpOiBSZW5kZXJlZFN0aWNreUxpbmUgfCBudWxsIHtcblx0XHRjb25zdCBpbmRleCA9IHRoaXMuZ2V0TGluZUluZGV4RnJvbUNoaWxkRG9tTm9kZShkb21Ob2RlKTtcblx0XHRpZiAoaW5kZXggPT09IG51bGwgfHwgaW5kZXggPCAwIHx8IGluZGV4ID49IHRoaXMuX3JlbmRlcmVkU3RpY2t5TGluZXMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3JlbmRlcmVkU3RpY2t5TGluZXNbaW5kZXhdO1xuXHR9XG5cblx0LyoqXG5cdCAqIEdpdmVuIGEgY2hpbGQgZG9tIG5vZGUsIHRyaWVzIHRvIGZpbmQgdGhlIGxpbmUgbnVtYmVyIGF0dHJpYnV0ZSB0aGF0IHdhcyBzdG9yZWQgaW4gdGhlIG5vZGUuXG5cdCAqIEByZXR1cm5zIHRoZSBhdHRyaWJ1dGUgdmFsdWUgb3IgbnVsbCBpZiBub25lIGlzIGZvdW5kLlxuXHQgKi9cblx0Z2V0TGluZUluZGV4RnJvbUNoaWxkRG9tTm9kZShkb21Ob2RlOiBIVE1MRWxlbWVudCB8IG51bGwpOiBudW1iZXIgfCBudWxsIHtcblx0XHRjb25zdCBsaW5lSW5kZXggPSB0aGlzLl9nZXRBdHRyaWJ1dGVWYWx1ZShkb21Ob2RlLCBTVElDS1lfSU5ERVhfQVRUUik7XG5cdFx0cmV0dXJuIGxpbmVJbmRleCA/IHBhcnNlSW50KGxpbmVJbmRleCwgMTApIDogbnVsbDtcblx0fVxuXG5cdC8qKlxuXHQgKiBHaXZlbiBhIGNoaWxkIGRvbSBub2RlLCB0cmllcyB0byBmaW5kIGlmIGl0IGlzIChjb250YWluZWQgaW4pIGEgc3RpY2t5IGxpbmUuXG5cdCAqIEByZXR1cm5zIGEgYm9vbGVhbi5cblx0ICovXG5cdGlzSW5TdGlja3lMaW5lKGRvbU5vZGU6IEhUTUxFbGVtZW50IHwgbnVsbCk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGlzSW5MaW5lID0gdGhpcy5fZ2V0QXR0cmlidXRlVmFsdWUoZG9tTm9kZSwgU1RJQ0tZX0lTX0xJTkVfQVRUUik7XG5cdFx0cmV0dXJuIGlzSW5MaW5lICE9PSB1bmRlZmluZWQ7XG5cdH1cblxuXHQvKipcblx0ICogR2l2ZW4gYSBjaGlsZCBkb20gbm9kZSwgdHJpZXMgdG8gZmluZCBpZiB0aGlzIGRvbSBub2RlIGlzIChjb250YWluZWQgaW4pIGEgc3RpY2t5IGZvbGRpbmcgaWNvbi5cblx0ICogQHJldHVybnMgYSBib29sZWFuLlxuXHQgKi9cblx0aXNJbkZvbGRpbmdJY29uRG9tTm9kZShkb21Ob2RlOiBIVE1MRWxlbWVudCB8IG51bGwpOiBib29sZWFuIHtcblx0XHRjb25zdCBpc0luRm9sZGluZ0ljb24gPSB0aGlzLl9nZXRBdHRyaWJ1dGVWYWx1ZShkb21Ob2RlLCBTVElDS1lfSVNfRk9MRElOR19JQ09OX0FUVFIpO1xuXHRcdHJldHVybiBpc0luRm9sZGluZ0ljb24gIT09IHVuZGVmaW5lZDtcblx0fVxuXG5cdC8qKlxuXHQgKiBHaXZlbiB0aGUgZG9tIG5vZGUsIGZpbmRzIGlmIGl0IG9yIGl0cyBwYXJlbnQgc2VxdWVuY2UgY29udGFpbnMgdGhlIGdpdmVuIGF0dHJpYnV0ZS5cblx0ICogQHJldHVybnMgdGhlIGF0dHJpYnV0ZSB2YWx1ZSBvciB1bmRlZmluZWQuXG5cdCAqL1xuXHRwcml2YXRlIF9nZXRBdHRyaWJ1dGVWYWx1ZShkb21Ob2RlOiBIVE1MRWxlbWVudCB8IG51bGwsIGF0dHJpYnV0ZTogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHR3aGlsZSAoZG9tTm9kZSAmJiBkb21Ob2RlICE9PSB0aGlzLl9yb290RG9tTm9kZSkge1xuXHRcdFx0Y29uc3QgbGluZSA9IGRvbU5vZGUuZ2V0QXR0cmlidXRlKGF0dHJpYnV0ZSk7XG5cdFx0XHRpZiAobGluZSAhPT0gbnVsbCkge1xuXHRcdFx0XHRyZXR1cm4gbGluZTtcblx0XHRcdH1cblx0XHRcdGRvbU5vZGUgPSBkb21Ob2RlLnBhcmVudEVsZW1lbnQ7XG5cdFx0fVxuXHRcdHJldHVybjtcblx0fVxufVxuXG5jbGFzcyBSZW5kZXJlZFN0aWNreUxpbmUge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgaW5kZXg6IG51bWJlcixcblx0XHRwdWJsaWMgcmVhZG9ubHkgbGluZU51bWJlcjogbnVtYmVyLFxuXHRcdHB1YmxpYyByZWFkb25seSBsaW5lRG9tTm9kZTogSFRNTEVsZW1lbnQsXG5cdFx0cHVibGljIHJlYWRvbmx5IGxpbmVOdW1iZXJEb21Ob2RlOiBIVE1MRWxlbWVudCxcblx0XHRwdWJsaWMgcmVhZG9ubHkgZm9sZGluZ0ljb246IFN0aWNreUZvbGRpbmdJY29uIHwgdW5kZWZpbmVkLFxuXHRcdHB1YmxpYyByZWFkb25seSBjaGFyYWN0ZXJNYXBwaW5nOiBDaGFyYWN0ZXJNYXBwaW5nLFxuXHRcdHB1YmxpYyByZWFkb25seSBzY3JvbGxXaWR0aDogbnVtYmVyLFxuXHRcdHB1YmxpYyByZWFkb25seSBoZWlnaHQ6IG51bWJlclxuXHQpIHsgfVxufVxuXG5jbGFzcyBTdGlja3lGb2xkaW5nSWNvbiB7XG5cblx0cHVibGljIGRvbU5vZGU6IEhUTUxFbGVtZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyBpc0NvbGxhcHNlZDogYm9vbGVhbixcblx0XHRwdWJsaWMgZm9sZGluZ1N0YXJ0TGluZTogbnVtYmVyLFxuXHRcdHB1YmxpYyBmb2xkaW5nRW5kTGluZTogbnVtYmVyLFxuXHRcdHB1YmxpYyBkaW1lbnNpb246IG51bWJlclxuXHQpIHtcblx0XHR0aGlzLmRvbU5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHR0aGlzLmRvbU5vZGUuc3R5bGUud2lkdGggPSBgMjZweGA7XG5cdFx0dGhpcy5kb21Ob2RlLnN0eWxlLmhlaWdodCA9IGAke2RpbWVuc2lvbn1weGA7XG5cdFx0dGhpcy5kb21Ob2RlLnN0eWxlLmxpbmVIZWlnaHQgPSBgJHtkaW1lbnNpb259cHhgO1xuXHRcdHRoaXMuZG9tTm9kZS5jbGFzc05hbWUgPSBUaGVtZUljb24uYXNDbGFzc05hbWUoaXNDb2xsYXBzZWQgPyBmb2xkaW5nQ29sbGFwc2VkSWNvbiA6IGZvbGRpbmdFeHBhbmRlZEljb24pO1xuXHR9XG5cblx0cHVibGljIHNldFZpc2libGUodmlzaWJsZTogYm9vbGVhbikge1xuXHRcdHRoaXMuZG9tTm9kZS5zdHlsZS5jdXJzb3IgPSB2aXNpYmxlID8gJ3BvaW50ZXInIDogJ2RlZmF1bHQnO1xuXHRcdHRoaXMuZG9tTm9kZS5zdHlsZS5vcGFjaXR5ID0gdmlzaWJsZSA/ICcxJyA6ICcwJztcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsZ0NBQWdDO0FBQ3pDLFNB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
