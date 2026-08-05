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
import "./nativeEditContext.css";
import { isFirefox } from "../../../../../base/browser/browser.js";
import { addDisposableListener, getActiveWindow, getWindow, getWindowId } from "../../../../../base/browser/dom.js";
import { FastDomNode } from "../../../../../base/browser/fastDomNode.js";
import { StandardKeyboardEvent } from "../../../../../base/browser/keyboardEvent.js";
import { KeyCode } from "../../../../../base/common/keyCodes.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { EditorOption } from "../../../../common/config/editorOptions.js";
import { EndOfLinePreference, EndOfLineSequence } from "../../../../common/model.js";
import { ClipboardEventUtils, getDataToCopy, InMemoryClipboardMetadataManager } from "../clipboardUtils.js";
import { AbstractEditContext } from "../editContext.js";
import { editContextAddDisposableListener, FocusTracker } from "./nativeEditContextUtils.js";
import { ScreenReaderSupport } from "./screenReaderSupport.js";
import { Range } from "../../../../common/core/range.js";
import { Selection } from "../../../../common/core/selection.js";
import { Position } from "../../../../common/core/position.js";
import { PositionOffsetTransformer } from "../../../../common/core/positionToOffset.js";
import { MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { EditContext } from "./editContextFactory.js";
import { IAccessibilityService } from "../../../../../platform/accessibility/common/accessibility.js";
import { NativeEditContextRegistry } from "./nativeEditContextRegistry.js";
var CompositionClassName = /* @__PURE__ */ ((CompositionClassName2) => {
  CompositionClassName2["NONE"] = "edit-context-composition-none";
  CompositionClassName2["SECONDARY"] = "edit-context-composition-secondary";
  CompositionClassName2["PRIMARY"] = "edit-context-composition-primary";
  return CompositionClassName2;
})(CompositionClassName || {});
let NativeEditContext = class extends AbstractEditContext {
  constructor(ownerID, context, overflowGuardContainer, viewController, _visibleRangeProvider, instantiationService, _accessibilityService) {
    super(context);
    this._visibleRangeProvider = _visibleRangeProvider;
    this._accessibilityService = _accessibilityService;
    this._editContextPrimarySelection = new Selection(1, 1, 1, 1);
    this._decorations = [];
    this._primarySelection = new Selection(1, 1, 1, 1);
    this._targetWindowId = -1;
    this._scrollTop = 0;
    this._scrollLeft = 0;
    this.domNode = new FastDomNode(document.createElement("div"));
    this.domNode.setClassName(`native-edit-context`);
    this._textArea = new FastDomNode(document.createElement("textarea"));
    this._textArea.setClassName("native-edit-context-textarea");
    this._textArea.setAttribute("tabindex", "-1");
    this.domNode.setAttribute("autocorrect", "off");
    this.domNode.setAttribute("autocapitalize", "off");
    this.domNode.setAttribute("autocomplete", "off");
    this.domNode.setAttribute("spellcheck", "false");
    this._updateDomAttributes();
    overflowGuardContainer.appendChild(this.domNode);
    overflowGuardContainer.appendChild(this._textArea);
    this._parent = overflowGuardContainer.domNode;
    this._selectionChangeListener = this._register(new MutableDisposable());
    this._focusTracker = this._register(new FocusTracker(this.domNode.domNode, (newFocusValue) => {
      if (newFocusValue) {
        this._selectionChangeListener.value = this._setSelectionChangeListener(viewController);
        this._screenReaderSupport.setIgnoreSelectionChangeTime("onFocus");
      } else {
        this._selectionChangeListener.value = void 0;
      }
      this._context.viewModel.setHasFocus(newFocusValue);
    }));
    const window = getWindow(this.domNode.domNode);
    this._editContext = EditContext.create(window);
    this.setEditContextOnDomNode();
    this._screenReaderSupport = instantiationService.createInstance(ScreenReaderSupport, this.domNode, context);
    this._register(addDisposableListener(this.domNode.domNode, "copy", (e) => this._ensureClipboardGetsEditorSelection(e)));
    this._register(addDisposableListener(this.domNode.domNode, "cut", (e) => {
      this._screenReaderSupport.setIgnoreSelectionChangeTime("onCut");
      this._ensureClipboardGetsEditorSelection(e);
      viewController.cut();
    }));
    this._register(addDisposableListener(this.domNode.domNode, "keyup", (e) => viewController.emitKeyUp(new StandardKeyboardEvent(e))));
    this._register(addDisposableListener(this.domNode.domNode, "keydown", async (e) => {
      const standardKeyboardEvent = new StandardKeyboardEvent(e);
      if (standardKeyboardEvent.keyCode === KeyCode.KEY_IN_COMPOSITION) {
        standardKeyboardEvent.stopPropagation();
      }
      viewController.emitKeyDown(standardKeyboardEvent);
    }));
    this._register(addDisposableListener(this.domNode.domNode, "beforeinput", async (e) => {
      if (e.inputType === "insertParagraph" || e.inputType === "insertLineBreak") {
        this._onType(viewController, { text: "\n", replacePrevCharCnt: 0, replaceNextCharCnt: 0, positionDelta: 0 });
      }
    }));
    this._register(editContextAddDisposableListener(this._editContext, "textformatupdate", (e) => this._handleTextFormatUpdate(e)));
    this._register(editContextAddDisposableListener(this._editContext, "characterboundsupdate", (e) => this._updateCharacterBounds(e)));
    this._register(editContextAddDisposableListener(this._editContext, "textupdate", (e) => {
      this._emitTypeEvent(viewController, e);
    }));
    this._register(editContextAddDisposableListener(this._editContext, "compositionstart", (e) => {
      viewController.compositionStart();
      this._context.viewModel.onCompositionStart();
    }));
    this._register(editContextAddDisposableListener(this._editContext, "compositionend", (e) => {
      viewController.compositionEnd();
      this._context.viewModel.onCompositionEnd();
    }));
    this._register(addDisposableListener(this._textArea.domNode, "paste", (e) => {
      this._screenReaderSupport.setIgnoreSelectionChangeTime("onPaste");
      e.preventDefault();
      if (!e.clipboardData) {
        return;
      }
      let [text, metadata] = ClipboardEventUtils.getTextData(e.clipboardData);
      if (!text) {
        return;
      }
      metadata = metadata || InMemoryClipboardMetadataManager.INSTANCE.get(text);
      let pasteOnNewLine = false;
      let multicursorText = null;
      let mode = null;
      if (metadata) {
        const options = this._context.configuration.options;
        const emptySelectionClipboard = options.get(EditorOption.emptySelectionClipboard);
        pasteOnNewLine = emptySelectionClipboard && !!metadata.isFromEmptySelection;
        multicursorText = typeof metadata.multicursorText !== "undefined" ? metadata.multicursorText : null;
        mode = metadata.mode;
      }
      viewController.paste(text, pasteOnNewLine, multicursorText, mode);
    }));
    this._register(NativeEditContextRegistry.register(ownerID, this));
  }
  // --- Public methods ---
  dispose() {
    this.domNode.domNode.blur();
    this.domNode.domNode.remove();
    this._textArea.domNode.remove();
    super.dispose();
  }
  setAriaOptions(options) {
    this._screenReaderSupport.setAriaOptions(options);
  }
  /* Last rendered data needed for correct hit-testing and determining the mouse position.
   * Without this, the selection will blink as incorrect mouse position is calculated */
  getLastRenderData() {
    return this._primarySelection.getPosition();
  }
  prepareRender(ctx) {
    this._screenReaderSupport.prepareRender(ctx);
    this._updateEditContext();
    this._updateSelectionAndControlBounds(ctx);
  }
  render(ctx) {
    this._screenReaderSupport.render(ctx);
  }
  onCursorStateChanged(e) {
    this._primarySelection = e.modelSelections[0] ?? new Selection(1, 1, 1, 1);
    this._screenReaderSupport.onCursorStateChanged(e);
    this._updateEditContext();
    return true;
  }
  onConfigurationChanged(e) {
    this._screenReaderSupport.onConfigurationChanged(e);
    this._updateDomAttributes();
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
    this._scrollLeft = e.scrollLeft;
    this._scrollTop = e.scrollTop;
    return true;
  }
  onZonesChanged(e) {
    return true;
  }
  executePaste() {
    this._onWillPaste();
    try {
      this._focusTracker.pause();
      this._textArea.focus();
      const result = this._textArea.domNode.ownerDocument.execCommand("paste");
      this._textArea.domNode.textContent = "";
      this.domNode.focus();
      return result;
    } finally {
      this._focusTracker.resume();
    }
  }
  _onWillPaste() {
    this._screenReaderSupport.setIgnoreSelectionChangeTime("onWillPaste");
  }
  writeScreenReaderContent() {
    this._screenReaderSupport.writeScreenReaderContent();
  }
  isFocused() {
    return this._focusTracker.isFocused;
  }
  focus() {
    this._focusTracker.focus();
    this.refreshFocusState();
  }
  refreshFocusState() {
    this._focusTracker.refreshFocusState();
  }
  // TODO: added as a workaround fix for https://github.com/microsoft/vscode/issues/229825
  // When this issue will be fixed the following should be removed.
  setEditContextOnDomNode() {
    const targetWindow = getWindow(this.domNode.domNode);
    const targetWindowId = getWindowId(targetWindow);
    if (this._targetWindowId !== targetWindowId) {
      this.domNode.domNode.editContext = this._editContext;
      this._targetWindowId = targetWindowId;
    }
  }
  // --- Private methods ---
  _updateDomAttributes() {
    const options = this._context.configuration.options;
    this.domNode.domNode.setAttribute("tabindex", String(options.get(EditorOption.tabIndex)));
  }
  _updateEditContext() {
    const editContextState = this._getNewEditContextState();
    if (!editContextState) {
      return;
    }
    this._editContext.updateText(0, Number.MAX_SAFE_INTEGER, editContextState.text ?? " ");
    this._editContext.updateSelection(editContextState.selectionStartOffset, editContextState.selectionEndOffset);
    this._editContextPrimarySelection = editContextState.editContextPrimarySelection;
  }
  _emitTypeEvent(viewController, e) {
    if (!this._editContext) {
      return;
    }
    if (!this._editContextPrimarySelection.equalsSelection(this._primarySelection)) {
      return;
    }
    const model = this._context.viewModel.model;
    const startPositionOfEditContext = this._editContextStartPosition();
    const offsetOfStartOfText = model.getOffsetAt(startPositionOfEditContext);
    const offsetOfSelectionEnd = model.getOffsetAt(this._primarySelection.getEndPosition());
    const offsetOfSelectionStart = model.getOffsetAt(this._primarySelection.getStartPosition());
    const selectionEndOffset = offsetOfSelectionEnd - offsetOfStartOfText;
    const selectionStartOffset = offsetOfSelectionStart - offsetOfStartOfText;
    let replaceNextCharCnt = 0;
    let replacePrevCharCnt = 0;
    if (e.updateRangeEnd > selectionEndOffset) {
      replaceNextCharCnt = e.updateRangeEnd - selectionEndOffset;
    }
    if (e.updateRangeStart < selectionStartOffset) {
      replacePrevCharCnt = selectionStartOffset - e.updateRangeStart;
    }
    let text = "";
    if (selectionStartOffset < e.updateRangeStart) {
      text += this._editContext.text.substring(selectionStartOffset, e.updateRangeStart);
    }
    text += e.text;
    if (selectionEndOffset > e.updateRangeEnd) {
      text += this._editContext.text.substring(e.updateRangeEnd, selectionEndOffset);
    }
    let positionDelta = 0;
    if (e.selectionStart === e.selectionEnd && selectionStartOffset === selectionEndOffset) {
      positionDelta = e.selectionStart - (e.updateRangeStart + e.text.length);
    }
    const typeInput = {
      text,
      replacePrevCharCnt,
      replaceNextCharCnt,
      positionDelta
    };
    this._onType(viewController, typeInput);
    this._updateEditContext();
  }
  _onType(viewController, typeInput) {
    if (typeInput.replacePrevCharCnt || typeInput.replaceNextCharCnt || typeInput.positionDelta) {
      viewController.compositionType(typeInput.text, typeInput.replacePrevCharCnt, typeInput.replaceNextCharCnt, typeInput.positionDelta);
    } else {
      viewController.type(typeInput.text);
    }
  }
  _getNewEditContextState() {
    const editContextPrimarySelection = this._primarySelection;
    const model = this._context.viewModel.model;
    if (!model.isValidRange(editContextPrimarySelection)) {
      return;
    }
    const primarySelectionStartLine = editContextPrimarySelection.startLineNumber;
    const primarySelectionEndLine = editContextPrimarySelection.endLineNumber;
    const endColumnOfEndLineNumber = model.getLineMaxColumn(primarySelectionEndLine);
    const rangeOfText = new Range(primarySelectionStartLine, 1, primarySelectionEndLine, endColumnOfEndLineNumber);
    const text = model.getValueInRange(rangeOfText, EndOfLinePreference.TextDefined);
    const selectionStartOffset = editContextPrimarySelection.startColumn - 1;
    const selectionEndOffset = text.length + editContextPrimarySelection.endColumn - endColumnOfEndLineNumber;
    return {
      text,
      selectionStartOffset,
      selectionEndOffset,
      editContextPrimarySelection
    };
  }
  _editContextStartPosition() {
    return new Position(this._editContextPrimarySelection.startLineNumber, 1);
  }
  _handleTextFormatUpdate(e) {
    if (!this._editContext) {
      return;
    }
    const formats = e.getTextFormats();
    const editContextStartPosition = this._editContextStartPosition();
    const decorations = [];
    formats.forEach((f) => {
      const textModel = this._context.viewModel.model;
      const offsetOfEditContextText = textModel.getOffsetAt(editContextStartPosition);
      const startPositionOfDecoration = textModel.getPositionAt(offsetOfEditContextText + f.rangeStart);
      const endPositionOfDecoration = textModel.getPositionAt(offsetOfEditContextText + f.rangeEnd);
      const decorationRange = Range.fromPositions(startPositionOfDecoration, endPositionOfDecoration);
      const thickness = f.underlineThickness.toLowerCase();
      let decorationClassName = "edit-context-composition-none" /* NONE */;
      switch (thickness) {
        case "thin":
          decorationClassName = "edit-context-composition-secondary" /* SECONDARY */;
          break;
        case "thick":
          decorationClassName = "edit-context-composition-primary" /* PRIMARY */;
          break;
      }
      decorations.push({
        range: decorationRange,
        options: {
          description: "textFormatDecoration",
          inlineClassName: decorationClassName
        }
      });
    });
    this._decorations = this._context.viewModel.model.deltaDecorations(this._decorations, decorations);
  }
  _updateSelectionAndControlBounds(ctx) {
    if (!this._parent) {
      return;
    }
    const options = this._context.configuration.options;
    const lineHeight = options.get(EditorOption.lineHeight);
    const contentLeft = options.get(EditorOption.layoutInfo).contentLeft;
    const parentBounds = this._parent.getBoundingClientRect();
    const modelStartPosition = this._primarySelection.getStartPosition();
    const viewStartPosition = this._context.viewModel.coordinatesConverter.convertModelPositionToViewPosition(modelStartPosition);
    const verticalOffsetStart = this._context.viewLayout.getVerticalOffsetForLineNumber(viewStartPosition.lineNumber);
    const top = parentBounds.top + verticalOffsetStart - this._scrollTop;
    const height = (this._primarySelection.endLineNumber - this._primarySelection.startLineNumber + 1) * lineHeight;
    let left = parentBounds.left + contentLeft - this._scrollLeft;
    let width;
    if (this._primarySelection.isEmpty()) {
      const linesVisibleRanges = ctx.visibleRangeForPosition(viewStartPosition);
      if (linesVisibleRanges) {
        left += linesVisibleRanges.left;
      }
      width = 0;
    } else {
      width = parentBounds.width - contentLeft;
    }
    const selectionBounds = new DOMRect(left, top, width, height);
    this._editContext.updateSelectionBounds(selectionBounds);
    this._editContext.updateControlBounds(selectionBounds);
  }
  _updateCharacterBounds(e) {
    if (!this._parent) {
      return;
    }
    const options = this._context.configuration.options;
    const typicalHalfWidthCharacterWidth = options.get(EditorOption.fontInfo).typicalHalfwidthCharacterWidth;
    const lineHeight = options.get(EditorOption.lineHeight);
    const contentLeft = options.get(EditorOption.layoutInfo).contentLeft;
    const parentBounds = this._parent.getBoundingClientRect();
    const characterBounds = [];
    const offsetTransformer = new PositionOffsetTransformer(this._editContext.text);
    for (let offset = e.rangeStart; offset < e.rangeEnd; offset++) {
      const editContextStartPosition = offsetTransformer.getPosition(offset);
      const textStartLineOffsetWithinEditor = this._editContextPrimarySelection.startLineNumber - 1;
      const characterStartPosition = new Position(textStartLineOffsetWithinEditor + editContextStartPosition.lineNumber, editContextStartPosition.column);
      const characterEndPosition = characterStartPosition.delta(0, 1);
      const characterModelRange = Range.fromPositions(characterStartPosition, characterEndPosition);
      const characterViewRange = this._context.viewModel.coordinatesConverter.convertModelRangeToViewRange(characterModelRange);
      const characterLinesVisibleRanges = this._visibleRangeProvider.linesVisibleRangesForRange(characterViewRange, true) ?? [];
      const characterVerticalOffset = this._context.viewLayout.getVerticalOffsetForLineNumber(characterViewRange.startLineNumber);
      const top = parentBounds.top + characterVerticalOffset - this._scrollTop;
      let left = 0;
      let width = typicalHalfWidthCharacterWidth;
      if (characterLinesVisibleRanges.length > 0) {
        for (const visibleRange of characterLinesVisibleRanges[0].ranges) {
          left = visibleRange.left;
          width = visibleRange.width;
          break;
        }
      }
      characterBounds.push(new DOMRect(parentBounds.left + contentLeft + left - this._scrollLeft, top, width, lineHeight));
    }
    this._editContext.updateCharacterBounds(e.rangeStart, characterBounds);
  }
  _ensureClipboardGetsEditorSelection(e) {
    const options = this._context.configuration.options;
    const emptySelectionClipboard = options.get(EditorOption.emptySelectionClipboard);
    const copyWithSyntaxHighlighting = options.get(EditorOption.copyWithSyntaxHighlighting);
    const selections = this._context.viewModel.getCursorStates().map((cursorState) => cursorState.modelState.selection);
    const dataToCopy = getDataToCopy(this._context.viewModel, selections, emptySelectionClipboard, copyWithSyntaxHighlighting);
    const storedMetadata = {
      version: 1,
      isFromEmptySelection: dataToCopy.isFromEmptySelection,
      multicursorText: dataToCopy.multicursorText,
      mode: dataToCopy.mode
    };
    InMemoryClipboardMetadataManager.INSTANCE.set(
      // When writing "LINE\r\n" to the clipboard and then pasting,
      // Firefox pastes "LINE\n", so let's work around this quirk
      isFirefox ? dataToCopy.text.replace(/\r\n/g, "\n") : dataToCopy.text,
      storedMetadata
    );
    e.preventDefault();
    if (e.clipboardData) {
      ClipboardEventUtils.setTextData(e.clipboardData, dataToCopy.text, dataToCopy.html, storedMetadata);
    }
  }
  _setSelectionChangeListener(viewController) {
    let previousSelectionChangeEventTime = 0;
    return addDisposableListener(this.domNode.domNode.ownerDocument, "selectionchange", () => {
      const isScreenReaderOptimized = this._accessibilityService.isScreenReaderOptimized();
      if (!this.isFocused() || !isScreenReaderOptimized) {
        return;
      }
      const screenReaderContentState = this._screenReaderSupport.screenReaderContentState;
      if (!screenReaderContentState) {
        return;
      }
      const now = Date.now();
      const delta1 = now - previousSelectionChangeEventTime;
      previousSelectionChangeEventTime = now;
      if (delta1 < 5) {
        return;
      }
      const delta2 = now - this._screenReaderSupport.getIgnoreSelectionChangeTime();
      this._screenReaderSupport.resetSelectionChangeTime();
      if (delta2 < 100) {
        return;
      }
      const activeDocument = getActiveWindow().document;
      const activeDocumentSelection = activeDocument.getSelection();
      if (!activeDocumentSelection) {
        return;
      }
      const rangeCount = activeDocumentSelection.rangeCount;
      if (rangeCount === 0) {
        return;
      }
      const range = activeDocumentSelection.getRangeAt(0);
      const viewModel = this._context.viewModel;
      const model = viewModel.model;
      const coordinatesConverter = viewModel.coordinatesConverter;
      const modelScreenReaderContentStartPositionWithinEditor = coordinatesConverter.convertViewPositionToModelPosition(screenReaderContentState.startPositionWithinEditor);
      const offsetOfStartOfScreenReaderContent = model.getOffsetAt(modelScreenReaderContentStartPositionWithinEditor);
      let offsetOfSelectionStart = range.startOffset + offsetOfStartOfScreenReaderContent;
      let offsetOfSelectionEnd = range.endOffset + offsetOfStartOfScreenReaderContent;
      const modelUsesCRLF = model.getEndOfLineSequence() === EndOfLineSequence.CRLF;
      if (modelUsesCRLF) {
        const screenReaderContentText = screenReaderContentState.value;
        const offsetTransformer = new PositionOffsetTransformer(screenReaderContentText);
        const positionOfStartWithinText = offsetTransformer.getPosition(range.startOffset);
        const positionOfEndWithinText = offsetTransformer.getPosition(range.endOffset);
        offsetOfSelectionStart += positionOfStartWithinText.lineNumber - 1;
        offsetOfSelectionEnd += positionOfEndWithinText.lineNumber - 1;
      }
      const positionOfSelectionStart = model.getPositionAt(offsetOfSelectionStart);
      const positionOfSelectionEnd = model.getPositionAt(offsetOfSelectionEnd);
      const newSelection = Selection.fromPositions(positionOfSelectionStart, positionOfSelectionEnd);
      viewController.setSelection(newSelection);
    });
  }
};
NativeEditContext = __decorateClass([
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IAccessibilityService)
], NativeEditContext);
export {
  NativeEditContext
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci9jb250cm9sbGVyL2VkaXRDb250ZXh0L25hdGl2ZS9uYXRpdmVFZGl0Q29udGV4dC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAnLi9uYXRpdmVFZGl0Q29udGV4dC5jc3MnO1xuaW1wb3J0IHsgaXNGaXJlZm94IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2Jyb3dzZXIuanMnO1xuaW1wb3J0IHsgYWRkRGlzcG9zYWJsZUxpc3RlbmVyLCBnZXRBY3RpdmVXaW5kb3csIGdldFdpbmRvdywgZ2V0V2luZG93SWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IEZhc3REb21Ob2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2Zhc3REb21Ob2RlLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkS2V5Ym9hcmRFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9rZXlib2FyZEV2ZW50LmpzJztcbmltcG9ydCB7IEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IEVkaXRvck9wdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBFbmRPZkxpbmVQcmVmZXJlbmNlLCBFbmRPZkxpbmVTZXF1ZW5jZSwgSU1vZGVsRGVsdGFEZWNvcmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IFZpZXdDb25maWd1cmF0aW9uQ2hhbmdlZEV2ZW50LCBWaWV3Q3Vyc29yU3RhdGVDaGFuZ2VkRXZlbnQsIFZpZXdEZWNvcmF0aW9uc0NoYW5nZWRFdmVudCwgVmlld0ZsdXNoZWRFdmVudCwgVmlld0xpbmVzQ2hhbmdlZEV2ZW50LCBWaWV3TGluZXNEZWxldGVkRXZlbnQsIFZpZXdMaW5lc0luc2VydGVkRXZlbnQsIFZpZXdTY3JvbGxDaGFuZ2VkRXZlbnQsIFZpZXdab25lc0NoYW5nZWRFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi92aWV3RXZlbnRzLmpzJztcbmltcG9ydCB7IFZpZXdDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3ZpZXdNb2RlbC92aWV3Q29udGV4dC5qcyc7XG5pbXBvcnQgeyBSZXN0cmljdGVkUmVuZGVyaW5nQ29udGV4dCwgUmVuZGVyaW5nQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uL3ZpZXcvcmVuZGVyaW5nQ29udGV4dC5qcyc7XG5pbXBvcnQgeyBWaWV3Q29udHJvbGxlciB9IGZyb20gJy4uLy4uLy4uL3ZpZXcvdmlld0NvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgQ2xpcGJvYXJkRXZlbnRVdGlscywgQ2xpcGJvYXJkU3RvcmVkTWV0YWRhdGEsIGdldERhdGFUb0NvcHksIEluTWVtb3J5Q2xpcGJvYXJkTWV0YWRhdGFNYW5hZ2VyIH0gZnJvbSAnLi4vY2xpcGJvYXJkVXRpbHMuanMnO1xuaW1wb3J0IHsgQWJzdHJhY3RFZGl0Q29udGV4dCB9IGZyb20gJy4uL2VkaXRDb250ZXh0LmpzJztcbmltcG9ydCB7IGVkaXRDb250ZXh0QWRkRGlzcG9zYWJsZUxpc3RlbmVyLCBGb2N1c1RyYWNrZXIsIElUeXBlRGF0YSB9IGZyb20gJy4vbmF0aXZlRWRpdENvbnRleHRVdGlscy5qcyc7XG5pbXBvcnQgeyBTY3JlZW5SZWFkZXJTdXBwb3J0IH0gZnJvbSAnLi9zY3JlZW5SZWFkZXJTdXBwb3J0LmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgSVZpc2libGVSYW5nZVByb3ZpZGVyIH0gZnJvbSAnLi4vdGV4dEFyZWEvdGV4dEFyZWFFZGl0Q29udGV4dC5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbk9mZnNldFRyYW5zZm9ybWVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb25Ub09mZnNldC5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSwgTXV0YWJsZURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgRWRpdENvbnRleHQgfSBmcm9tICcuL2VkaXRDb250ZXh0RmFjdG9yeS5qcyc7XG5pbXBvcnQgeyBJQWNjZXNzaWJpbGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5L2NvbW1vbi9hY2Nlc3NpYmlsaXR5LmpzJztcbmltcG9ydCB7IE5hdGl2ZUVkaXRDb250ZXh0UmVnaXN0cnkgfSBmcm9tICcuL25hdGl2ZUVkaXRDb250ZXh0UmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUVkaXRvckFyaWFPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yQnJvd3Nlci5qcyc7XG5cbi8vIENvcnJlc3BvbmRzIHRvIGNsYXNzZXMgaW4gbmF0aXZlRWRpdENvbnRleHQuY3NzXG5lbnVtIENvbXBvc2l0aW9uQ2xhc3NOYW1lIHtcblx0Tk9ORSA9ICdlZGl0LWNvbnRleHQtY29tcG9zaXRpb24tbm9uZScsXG5cdFNFQ09OREFSWSA9ICdlZGl0LWNvbnRleHQtY29tcG9zaXRpb24tc2Vjb25kYXJ5Jyxcblx0UFJJTUFSWSA9ICdlZGl0LWNvbnRleHQtY29tcG9zaXRpb24tcHJpbWFyeScsXG59XG5cbmV4cG9ydCBjbGFzcyBOYXRpdmVFZGl0Q29udGV4dCBleHRlbmRzIEFic3RyYWN0RWRpdENvbnRleHQge1xuXG5cdC8vIFRleHQgYXJlYSB1c2VkIHRvIGhhbmRsZSBwYXN0ZSBldmVudHNcblx0cHJpdmF0ZSByZWFkb25seSBfdGV4dEFyZWE6IEZhc3REb21Ob2RlPEhUTUxUZXh0QXJlYUVsZW1lbnQ+O1xuXHRwdWJsaWMgcmVhZG9ubHkgZG9tTm9kZTogRmFzdERvbU5vZGU8SFRNTERpdkVsZW1lbnQ+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0Q29udGV4dDogRWRpdENvbnRleHQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3NjcmVlblJlYWRlclN1cHBvcnQ6IFNjcmVlblJlYWRlclN1cHBvcnQ7XG5cdHByaXZhdGUgX2VkaXRDb250ZXh0UHJpbWFyeVNlbGVjdGlvbjogU2VsZWN0aW9uID0gbmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKTtcblxuXHQvLyBPdmVyZmxvdyBndWFyZCBjb250YWluZXJcblx0cHJpdmF0ZSBfcGFyZW50OiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfZGVjb3JhdGlvbnM6IHN0cmluZ1tdID0gW107XG5cdHByaXZhdGUgX3ByaW1hcnlTZWxlY3Rpb246IFNlbGVjdGlvbiA9IG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSk7XG5cblxuXHRwcml2YXRlIF90YXJnZXRXaW5kb3dJZDogbnVtYmVyID0gLTE7XG5cdHByaXZhdGUgX3Njcm9sbFRvcDogbnVtYmVyID0gMDtcblx0cHJpdmF0ZSBfc2Nyb2xsTGVmdDogbnVtYmVyID0gMDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9mb2N1c1RyYWNrZXI6IEZvY3VzVHJhY2tlcjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9zZWxlY3Rpb25DaGFuZ2VMaXN0ZW5lcjogTXV0YWJsZURpc3Bvc2FibGU8SURpc3Bvc2FibGU+O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdG93bmVySUQ6IHN0cmluZyxcblx0XHRjb250ZXh0OiBWaWV3Q29udGV4dCxcblx0XHRvdmVyZmxvd0d1YXJkQ29udGFpbmVyOiBGYXN0RG9tTm9kZTxIVE1MRWxlbWVudD4sXG5cdFx0dmlld0NvbnRyb2xsZXI6IFZpZXdDb250cm9sbGVyLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Zpc2libGVSYW5nZVByb3ZpZGVyOiBJVmlzaWJsZVJhbmdlUHJvdmlkZXIsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQWNjZXNzaWJpbGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfYWNjZXNzaWJpbGl0eVNlcnZpY2U6IElBY2Nlc3NpYmlsaXR5U2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihjb250ZXh0KTtcblxuXHRcdHRoaXMuZG9tTm9kZSA9IG5ldyBGYXN0RG9tTm9kZShkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSk7XG5cdFx0dGhpcy5kb21Ob2RlLnNldENsYXNzTmFtZShgbmF0aXZlLWVkaXQtY29udGV4dGApO1xuXHRcdHRoaXMuX3RleHRBcmVhID0gbmV3IEZhc3REb21Ob2RlKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RleHRhcmVhJykpO1xuXHRcdHRoaXMuX3RleHRBcmVhLnNldENsYXNzTmFtZSgnbmF0aXZlLWVkaXQtY29udGV4dC10ZXh0YXJlYScpO1xuXHRcdHRoaXMuX3RleHRBcmVhLnNldEF0dHJpYnV0ZSgndGFiaW5kZXgnLCAnLTEnKTtcblx0XHR0aGlzLmRvbU5vZGUuc2V0QXR0cmlidXRlKCdhdXRvY29ycmVjdCcsICdvZmYnKTtcblx0XHR0aGlzLmRvbU5vZGUuc2V0QXR0cmlidXRlKCdhdXRvY2FwaXRhbGl6ZScsICdvZmYnKTtcblx0XHR0aGlzLmRvbU5vZGUuc2V0QXR0cmlidXRlKCdhdXRvY29tcGxldGUnLCAnb2ZmJyk7XG5cdFx0dGhpcy5kb21Ob2RlLnNldEF0dHJpYnV0ZSgnc3BlbGxjaGVjaycsICdmYWxzZScpO1xuXG5cdFx0dGhpcy5fdXBkYXRlRG9tQXR0cmlidXRlcygpO1xuXG5cdFx0b3ZlcmZsb3dHdWFyZENvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLmRvbU5vZGUpO1xuXHRcdG92ZXJmbG93R3VhcmRDb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy5fdGV4dEFyZWEpO1xuXHRcdHRoaXMuX3BhcmVudCA9IG92ZXJmbG93R3VhcmRDb250YWluZXIuZG9tTm9kZTtcblxuXHRcdHRoaXMuX3NlbGVjdGlvbkNoYW5nZUxpc3RlbmVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXHRcdHRoaXMuX2ZvY3VzVHJhY2tlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBGb2N1c1RyYWNrZXIodGhpcy5kb21Ob2RlLmRvbU5vZGUsIChuZXdGb2N1c1ZhbHVlOiBib29sZWFuKSA9PiB7XG5cdFx0XHRpZiAobmV3Rm9jdXNWYWx1ZSkge1xuXHRcdFx0XHR0aGlzLl9zZWxlY3Rpb25DaGFuZ2VMaXN0ZW5lci52YWx1ZSA9IHRoaXMuX3NldFNlbGVjdGlvbkNoYW5nZUxpc3RlbmVyKHZpZXdDb250cm9sbGVyKTtcblx0XHRcdFx0dGhpcy5fc2NyZWVuUmVhZGVyU3VwcG9ydC5zZXRJZ25vcmVTZWxlY3Rpb25DaGFuZ2VUaW1lKCdvbkZvY3VzJyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl9zZWxlY3Rpb25DaGFuZ2VMaXN0ZW5lci52YWx1ZSA9IHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHRcdHRoaXMuX2NvbnRleHQudmlld01vZGVsLnNldEhhc0ZvY3VzKG5ld0ZvY3VzVmFsdWUpO1xuXHRcdH0pKTtcblxuXHRcdGNvbnN0IHdpbmRvdyA9IGdldFdpbmRvdyh0aGlzLmRvbU5vZGUuZG9tTm9kZSk7XG5cdFx0dGhpcy5fZWRpdENvbnRleHQgPSBFZGl0Q29udGV4dC5jcmVhdGUod2luZG93KTtcblx0XHR0aGlzLnNldEVkaXRDb250ZXh0T25Eb21Ob2RlKCk7XG5cblx0XHR0aGlzLl9zY3JlZW5SZWFkZXJTdXBwb3J0ID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2NyZWVuUmVhZGVyU3VwcG9ydCwgdGhpcy5kb21Ob2RlLCBjb250ZXh0KTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmRvbU5vZGUuZG9tTm9kZSwgJ2NvcHknLCAoZSkgPT4gdGhpcy5fZW5zdXJlQ2xpcGJvYXJkR2V0c0VkaXRvclNlbGVjdGlvbihlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmRvbU5vZGUuZG9tTm9kZSwgJ2N1dCcsIChlKSA9PiB7XG5cdFx0XHQvLyBQcmV0ZW5kIGhlcmUgd2UgdG91Y2hlZCB0aGUgdGV4dCBhcmVhLCBhcyB0aGUgYGN1dGAgZXZlbnQgd2lsbCBtb3N0IGxpa2VseVxuXHRcdFx0Ly8gcmVzdWx0IGluIGEgYHNlbGVjdGlvbmNoYW5nZWAgZXZlbnQgd2hpY2ggd2Ugd2FudCB0byBpZ25vcmVcblx0XHRcdHRoaXMuX3NjcmVlblJlYWRlclN1cHBvcnQuc2V0SWdub3JlU2VsZWN0aW9uQ2hhbmdlVGltZSgnb25DdXQnKTtcblx0XHRcdHRoaXMuX2Vuc3VyZUNsaXBib2FyZEdldHNFZGl0b3JTZWxlY3Rpb24oZSk7XG5cdFx0XHR2aWV3Q29udHJvbGxlci5jdXQoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5kb21Ob2RlLmRvbU5vZGUsICdrZXl1cCcsIChlKSA9PiB2aWV3Q29udHJvbGxlci5lbWl0S2V5VXAobmV3IFN0YW5kYXJkS2V5Ym9hcmRFdmVudChlKSkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5kb21Ob2RlLmRvbU5vZGUsICdrZXlkb3duJywgYXN5bmMgKGUpID0+IHtcblxuXHRcdFx0Y29uc3Qgc3RhbmRhcmRLZXlib2FyZEV2ZW50ID0gbmV3IFN0YW5kYXJkS2V5Ym9hcmRFdmVudChlKTtcblxuXHRcdFx0Ly8gV2hlbiB0aGUgSU1FIGlzIHZpc2libGUsIHRoZSBrZXlzLCBsaWtlIGFycm93LWxlZnQgYW5kIGFycm93LXJpZ2h0LCBzaG91bGQgYmUgdXNlZCB0byBuYXZpZ2F0ZSBpbiB0aGUgSU1FLCBhbmQgc2hvdWxkIG5vdCBiZSBwcm9wYWdhdGVkIGZ1cnRoZXJcblx0XHRcdGlmIChzdGFuZGFyZEtleWJvYXJkRXZlbnQua2V5Q29kZSA9PT0gS2V5Q29kZS5LRVlfSU5fQ09NUE9TSVRJT04pIHtcblx0XHRcdFx0c3RhbmRhcmRLZXlib2FyZEV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0fVxuXHRcdFx0dmlld0NvbnRyb2xsZXIuZW1pdEtleURvd24oc3RhbmRhcmRLZXlib2FyZEV2ZW50KTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuZG9tTm9kZS5kb21Ob2RlLCAnYmVmb3JlaW5wdXQnLCBhc3luYyAoZSkgPT4ge1xuXHRcdFx0aWYgKGUuaW5wdXRUeXBlID09PSAnaW5zZXJ0UGFyYWdyYXBoJyB8fCBlLmlucHV0VHlwZSA9PT0gJ2luc2VydExpbmVCcmVhaycpIHtcblx0XHRcdFx0dGhpcy5fb25UeXBlKHZpZXdDb250cm9sbGVyLCB7IHRleHQ6ICdcXG4nLCByZXBsYWNlUHJldkNoYXJDbnQ6IDAsIHJlcGxhY2VOZXh0Q2hhckNudDogMCwgcG9zaXRpb25EZWx0YTogMCB9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyBFZGl0IGNvbnRleHQgZXZlbnRzXG5cdFx0dGhpcy5fcmVnaXN0ZXIoZWRpdENvbnRleHRBZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5fZWRpdENvbnRleHQsICd0ZXh0Zm9ybWF0dXBkYXRlJywgKGUpID0+IHRoaXMuX2hhbmRsZVRleHRGb3JtYXRVcGRhdGUoZSkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihlZGl0Q29udGV4dEFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLl9lZGl0Q29udGV4dCwgJ2NoYXJhY3RlcmJvdW5kc3VwZGF0ZScsIChlKSA9PiB0aGlzLl91cGRhdGVDaGFyYWN0ZXJCb3VuZHMoZSkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihlZGl0Q29udGV4dEFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLl9lZGl0Q29udGV4dCwgJ3RleHR1cGRhdGUnLCAoZSkgPT4ge1xuXHRcdFx0dGhpcy5fZW1pdFR5cGVFdmVudCh2aWV3Q29udHJvbGxlciwgZSk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGVkaXRDb250ZXh0QWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuX2VkaXRDb250ZXh0LCAnY29tcG9zaXRpb25zdGFydCcsIChlKSA9PiB7XG5cdFx0XHQvLyBVdGxpbWF0ZWx5IGZpcmVzIG9uRGlkQ29tcG9zaXRpb25TdGFydCgpIG9uIHRoZSBlZGl0b3IgdG8gbm90aWZ5IGZvciBleGFtcGxlIHN1Z2dlc3QgbW9kZWwgb2YgY29tcG9zaXRpb24gc3RhdGVcblx0XHRcdC8vIFVwZGF0ZXMgdGhlIGNvbXBvc2l0aW9uIHN0YXRlIG9mIHRoZSBjdXJzb3IgY29udHJvbGxlciB3aGljaCBkZXRlcm1pbmVzIGJlaGF2aW9yIG9mIHR5cGluZyB3aXRoIGludGVyY2VwdG9yc1xuXHRcdFx0dmlld0NvbnRyb2xsZXIuY29tcG9zaXRpb25TdGFydCgpO1xuXHRcdFx0Ly8gRW1pdHMgVmlld0NvbXBvc2l0aW9uU3RhcnRFdmVudCB3aGljaCBjYW4gYmUgZGVwZW5kZWQgb24gYnkgVmlld0V2ZW50SGFuZGxlcnNcblx0XHRcdHRoaXMuX2NvbnRleHQudmlld01vZGVsLm9uQ29tcG9zaXRpb25TdGFydCgpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3RlcihlZGl0Q29udGV4dEFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLl9lZGl0Q29udGV4dCwgJ2NvbXBvc2l0aW9uZW5kJywgKGUpID0+IHtcblx0XHRcdC8vIFV0bGltYXRlbHkgZmlyZXMgY29tcG9zaXRpb25FbmQoKSBvbiB0aGUgZWRpdG9yIHRvIG5vdGlmeSBmb3IgZXhhbXBsZSBzdWdnZXN0IG1vZGVsIG9mIGNvbXBvc2l0aW9uIHN0YXRlXG5cdFx0XHQvLyBVcGRhdGVzIHRoZSBjb21wb3NpdGlvbiBzdGF0ZSBvZiB0aGUgY3Vyc29yIGNvbnRyb2xsZXIgd2hpY2ggZGV0ZXJtaW5lcyBiZWhhdmlvciBvZiB0eXBpbmcgd2l0aCBpbnRlcmNlcHRvcnNcblx0XHRcdHZpZXdDb250cm9sbGVyLmNvbXBvc2l0aW9uRW5kKCk7XG5cdFx0XHQvLyBFbWl0cyBWaWV3Q29tcG9zaXRpb25FbmRFdmVudCB3aGljaCBjYW4gYmUgZGVwZW5kZWQgb24gYnkgVmlld0V2ZW50SGFuZGxlcnNcblx0XHRcdHRoaXMuX2NvbnRleHQudmlld01vZGVsLm9uQ29tcG9zaXRpb25FbmQoKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuX3RleHRBcmVhLmRvbU5vZGUsICdwYXN0ZScsIChlKSA9PiB7XG5cdFx0XHQvLyBQcmV0ZW5kIGhlcmUgd2UgdG91Y2hlZCB0aGUgdGV4dCBhcmVhLCBhcyB0aGUgYHBhc3RlYCBldmVudCB3aWxsIG1vc3QgbGlrZWx5XG5cdFx0XHQvLyByZXN1bHQgaW4gYSBgc2VsZWN0aW9uY2hhbmdlYCBldmVudCB3aGljaCB3ZSB3YW50IHRvIGlnbm9yZVxuXHRcdFx0dGhpcy5fc2NyZWVuUmVhZGVyU3VwcG9ydC5zZXRJZ25vcmVTZWxlY3Rpb25DaGFuZ2VUaW1lKCdvblBhc3RlJyk7XG5cdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRpZiAoIWUuY2xpcGJvYXJkRGF0YSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRsZXQgW3RleHQsIG1ldGFkYXRhXSA9IENsaXBib2FyZEV2ZW50VXRpbHMuZ2V0VGV4dERhdGEoZS5jbGlwYm9hcmREYXRhKTtcblx0XHRcdGlmICghdGV4dCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRtZXRhZGF0YSA9IG1ldGFkYXRhIHx8IEluTWVtb3J5Q2xpcGJvYXJkTWV0YWRhdGFNYW5hZ2VyLklOU1RBTkNFLmdldCh0ZXh0KTtcblx0XHRcdGxldCBwYXN0ZU9uTmV3TGluZSA9IGZhbHNlO1xuXHRcdFx0bGV0IG11bHRpY3Vyc29yVGV4dDogc3RyaW5nW10gfCBudWxsID0gbnVsbDtcblx0XHRcdGxldCBtb2RlOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblx0XHRcdGlmIChtZXRhZGF0YSkge1xuXHRcdFx0XHRjb25zdCBvcHRpb25zID0gdGhpcy5fY29udGV4dC5jb25maWd1cmF0aW9uLm9wdGlvbnM7XG5cdFx0XHRcdGNvbnN0IGVtcHR5U2VsZWN0aW9uQ2xpcGJvYXJkID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmVtcHR5U2VsZWN0aW9uQ2xpcGJvYXJkKTtcblx0XHRcdFx0cGFzdGVPbk5ld0xpbmUgPSBlbXB0eVNlbGVjdGlvbkNsaXBib2FyZCAmJiAhIW1ldGFkYXRhLmlzRnJvbUVtcHR5U2VsZWN0aW9uO1xuXHRcdFx0XHRtdWx0aWN1cnNvclRleHQgPSB0eXBlb2YgbWV0YWRhdGEubXVsdGljdXJzb3JUZXh0ICE9PSAndW5kZWZpbmVkJyA/IG1ldGFkYXRhLm11bHRpY3Vyc29yVGV4dCA6IG51bGw7XG5cdFx0XHRcdG1vZGUgPSBtZXRhZGF0YS5tb2RlO1xuXHRcdFx0fVxuXHRcdFx0dmlld0NvbnRyb2xsZXIucGFzdGUodGV4dCwgcGFzdGVPbk5ld0xpbmUsIG11bHRpY3Vyc29yVGV4dCwgbW9kZSk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKE5hdGl2ZUVkaXRDb250ZXh0UmVnaXN0cnkucmVnaXN0ZXIob3duZXJJRCwgdGhpcykpO1xuXHR9XG5cblx0Ly8gLS0tIFB1YmxpYyBtZXRob2RzIC0tLVxuXG5cdHB1YmxpYyBvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdC8vIEZvcmNlIGJsdWUgdGhlIGRvbSBub2RlIHNvIGNhbiB3cml0ZSBpbiBwYW5lIHdpdGggbm8gbmF0aXZlIGVkaXQgY29udGV4dCBhZnRlciBkaXNwb3NhbFxuXHRcdHRoaXMuZG9tTm9kZS5kb21Ob2RlLmJsdXIoKTtcblx0XHR0aGlzLmRvbU5vZGUuZG9tTm9kZS5yZW1vdmUoKTtcblx0XHR0aGlzLl90ZXh0QXJlYS5kb21Ob2RlLnJlbW92ZSgpO1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHB1YmxpYyBzZXRBcmlhT3B0aW9ucyhvcHRpb25zOiBJRWRpdG9yQXJpYU9wdGlvbnMpOiB2b2lkIHtcblx0XHR0aGlzLl9zY3JlZW5SZWFkZXJTdXBwb3J0LnNldEFyaWFPcHRpb25zKG9wdGlvbnMpO1xuXHR9XG5cblx0LyogTGFzdCByZW5kZXJlZCBkYXRhIG5lZWRlZCBmb3IgY29ycmVjdCBoaXQtdGVzdGluZyBhbmQgZGV0ZXJtaW5pbmcgdGhlIG1vdXNlIHBvc2l0aW9uLlxuXHQgKiBXaXRob3V0IHRoaXMsIHRoZSBzZWxlY3Rpb24gd2lsbCBibGluayBhcyBpbmNvcnJlY3QgbW91c2UgcG9zaXRpb24gaXMgY2FsY3VsYXRlZCAqL1xuXHRwdWJsaWMgZ2V0TGFzdFJlbmRlckRhdGEoKTogUG9zaXRpb24gfCBudWxsIHtcblx0XHRyZXR1cm4gdGhpcy5fcHJpbWFyeVNlbGVjdGlvbi5nZXRQb3NpdGlvbigpO1xuXHR9XG5cblx0cHVibGljIHByZXBhcmVSZW5kZXIoY3R4OiBSZW5kZXJpbmdDb250ZXh0KTogdm9pZCB7XG5cdFx0dGhpcy5fc2NyZWVuUmVhZGVyU3VwcG9ydC5wcmVwYXJlUmVuZGVyKGN0eCk7XG5cdFx0dGhpcy5fdXBkYXRlRWRpdENvbnRleHQoKTtcblx0XHR0aGlzLl91cGRhdGVTZWxlY3Rpb25BbmRDb250cm9sQm91bmRzKGN0eCk7XG5cdH1cblxuXHRwdWJsaWMgcmVuZGVyKGN0eDogUmVzdHJpY3RlZFJlbmRlcmluZ0NvbnRleHQpOiB2b2lkIHtcblx0XHR0aGlzLl9zY3JlZW5SZWFkZXJTdXBwb3J0LnJlbmRlcihjdHgpO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIG9uQ3Vyc29yU3RhdGVDaGFuZ2VkKGU6IFZpZXdDdXJzb3JTdGF0ZUNoYW5nZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHRoaXMuX3ByaW1hcnlTZWxlY3Rpb24gPSBlLm1vZGVsU2VsZWN0aW9uc1swXSA/PyBuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpO1xuXHRcdHRoaXMuX3NjcmVlblJlYWRlclN1cHBvcnQub25DdXJzb3JTdGF0ZUNoYW5nZWQoZSk7XG5cdFx0dGhpcy5fdXBkYXRlRWRpdENvbnRleHQoKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBvbkNvbmZpZ3VyYXRpb25DaGFuZ2VkKGU6IFZpZXdDb25maWd1cmF0aW9uQ2hhbmdlZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0dGhpcy5fc2NyZWVuUmVhZGVyU3VwcG9ydC5vbkNvbmZpZ3VyYXRpb25DaGFuZ2VkKGUpO1xuXHRcdHRoaXMuX3VwZGF0ZURvbUF0dHJpYnV0ZXMoKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBvbkRlY29yYXRpb25zQ2hhbmdlZChlOiBWaWV3RGVjb3JhdGlvbnNDaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHQvLyB0cnVlIGZvciBpbmxpbmUgZGVjb3JhdGlvbnMgdGhhdCBjYW4gZW5kIHVwIHJlbGF5b3V0aW5nIHRleHRcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBvbkZsdXNoZWQoZTogVmlld0ZsdXNoZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIG9uTGluZXNDaGFuZ2VkKGU6IFZpZXdMaW5lc0NoYW5nZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIG9uTGluZXNEZWxldGVkKGU6IFZpZXdMaW5lc0RlbGV0ZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIG9uTGluZXNJbnNlcnRlZChlOiBWaWV3TGluZXNJbnNlcnRlZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgb25TY3JvbGxDaGFuZ2VkKGU6IFZpZXdTY3JvbGxDaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHR0aGlzLl9zY3JvbGxMZWZ0ID0gZS5zY3JvbGxMZWZ0O1xuXHRcdHRoaXMuX3Njcm9sbFRvcCA9IGUuc2Nyb2xsVG9wO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIG9uWm9uZXNDaGFuZ2VkKGU6IFZpZXdab25lc0NoYW5nZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHVibGljIGV4ZWN1dGVQYXN0ZSgpOiBib29sZWFuIHtcblx0XHR0aGlzLl9vbldpbGxQYXN0ZSgpO1xuXHRcdHRyeSB7XG5cdFx0XHQvLyBwYXVzZSBmb2N1cyB0cmFja2luZyBiZWNhdXNlIHdlIGRvbid0IHdhbnQgdG8gcmVhY3QgdG8gZm9jdXMvYmx1clxuXHRcdFx0Ly8gZXZlbnRzIHdoaWxlIHBhc3Rpbmcgc2luY2Ugd2UgbW92ZSB0aGUgZm9jdXMgdG8gdGhlIHRleHRhcmVhXG5cdFx0XHR0aGlzLl9mb2N1c1RyYWNrZXIucGF1c2UoKTtcblxuXHRcdFx0Ly8gU2luY2Ugd2UgY2FuIG5vdCBjYWxsIGV4ZWNDb21tYW5kKCdwYXN0ZScpIG9uIGEgZG9tIG5vZGUgd2l0aCBlZGl0IGNvbnRleHQgc2V0XG5cdFx0XHQvLyB3ZSBhZGRlZCBhIGhpZGRlbiB0ZXh0IGFyZWEgdGhhdCByZWNlaXZlcyB0aGUgcGFzdGUgZXhlY3V0aW9uXG5cdFx0XHR0aGlzLl90ZXh0QXJlYS5mb2N1cygpO1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5fdGV4dEFyZWEuZG9tTm9kZS5vd25lckRvY3VtZW50LmV4ZWNDb21tYW5kKCdwYXN0ZScpO1xuXHRcdFx0dGhpcy5fdGV4dEFyZWEuZG9tTm9kZS50ZXh0Q29udGVudCA9ICcnO1xuXHRcdFx0dGhpcy5kb21Ob2RlLmZvY3VzKCk7XG5cblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMuX2ZvY3VzVHJhY2tlci5yZXN1bWUoKTsgLy8gcmVzdW1lIGZvY3VzIHRyYWNraW5nXG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfb25XaWxsUGFzdGUoKTogdm9pZCB7XG5cdFx0dGhpcy5fc2NyZWVuUmVhZGVyU3VwcG9ydC5zZXRJZ25vcmVTZWxlY3Rpb25DaGFuZ2VUaW1lKCdvbldpbGxQYXN0ZScpO1xuXHR9XG5cblx0cHVibGljIHdyaXRlU2NyZWVuUmVhZGVyQ29udGVudCgpOiB2b2lkIHtcblx0XHR0aGlzLl9zY3JlZW5SZWFkZXJTdXBwb3J0LndyaXRlU2NyZWVuUmVhZGVyQ29udGVudCgpO1xuXHR9XG5cblx0cHVibGljIGlzRm9jdXNlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fZm9jdXNUcmFja2VyLmlzRm9jdXNlZDtcblx0fVxuXG5cdHB1YmxpYyBmb2N1cygpOiB2b2lkIHtcblx0XHR0aGlzLl9mb2N1c1RyYWNrZXIuZm9jdXMoKTtcblxuXHRcdC8vIElmIHRoZSBlZGl0b3IgaXMgb2ZmIERPTSwgZm9jdXMgY2Fubm90IGJlIHJlYWxseSBzZXQsIHNvIGxldCdzIGRvdWJsZSBjaGVjayB0aGF0IHdlIGhhdmUgbWFuYWdlZCB0byBzZXQgdGhlIGZvY3VzXG5cdFx0dGhpcy5yZWZyZXNoRm9jdXNTdGF0ZSgpO1xuXHR9XG5cblx0cHVibGljIHJlZnJlc2hGb2N1c1N0YXRlKCk6IHZvaWQge1xuXHRcdHRoaXMuX2ZvY3VzVHJhY2tlci5yZWZyZXNoRm9jdXNTdGF0ZSgpO1xuXHR9XG5cblx0Ly8gVE9ETzogYWRkZWQgYXMgYSB3b3JrYXJvdW5kIGZpeCBmb3IgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzIyOTgyNVxuXHQvLyBXaGVuIHRoaXMgaXNzdWUgd2lsbCBiZSBmaXhlZCB0aGUgZm9sbG93aW5nIHNob3VsZCBiZSByZW1vdmVkLlxuXHRwdWJsaWMgc2V0RWRpdENvbnRleHRPbkRvbU5vZGUoKTogdm9pZCB7XG5cdFx0Y29uc3QgdGFyZ2V0V2luZG93ID0gZ2V0V2luZG93KHRoaXMuZG9tTm9kZS5kb21Ob2RlKTtcblx0XHRjb25zdCB0YXJnZXRXaW5kb3dJZCA9IGdldFdpbmRvd0lkKHRhcmdldFdpbmRvdyk7XG5cdFx0aWYgKHRoaXMuX3RhcmdldFdpbmRvd0lkICE9PSB0YXJnZXRXaW5kb3dJZCkge1xuXHRcdFx0dGhpcy5kb21Ob2RlLmRvbU5vZGUuZWRpdENvbnRleHQgPSB0aGlzLl9lZGl0Q29udGV4dDtcblx0XHRcdHRoaXMuX3RhcmdldFdpbmRvd0lkID0gdGFyZ2V0V2luZG93SWQ7XG5cdFx0fVxuXHR9XG5cblx0Ly8gLS0tIFByaXZhdGUgbWV0aG9kcyAtLS1cblxuXHRwcml2YXRlIF91cGRhdGVEb21BdHRyaWJ1dGVzKCk6IHZvaWQge1xuXHRcdGNvbnN0IG9wdGlvbnMgPSB0aGlzLl9jb250ZXh0LmNvbmZpZ3VyYXRpb24ub3B0aW9ucztcblx0XHR0aGlzLmRvbU5vZGUuZG9tTm9kZS5zZXRBdHRyaWJ1dGUoJ3RhYmluZGV4JywgU3RyaW5nKG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi50YWJJbmRleCkpKTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZUVkaXRDb250ZXh0KCk6IHZvaWQge1xuXHRcdGNvbnN0IGVkaXRDb250ZXh0U3RhdGUgPSB0aGlzLl9nZXROZXdFZGl0Q29udGV4dFN0YXRlKCk7XG5cdFx0aWYgKCFlZGl0Q29udGV4dFN0YXRlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX2VkaXRDb250ZXh0LnVwZGF0ZVRleHQoMCwgTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIsIGVkaXRDb250ZXh0U3RhdGUudGV4dCA/PyAnICcpO1xuXHRcdHRoaXMuX2VkaXRDb250ZXh0LnVwZGF0ZVNlbGVjdGlvbihlZGl0Q29udGV4dFN0YXRlLnNlbGVjdGlvblN0YXJ0T2Zmc2V0LCBlZGl0Q29udGV4dFN0YXRlLnNlbGVjdGlvbkVuZE9mZnNldCk7XG5cdFx0dGhpcy5fZWRpdENvbnRleHRQcmltYXJ5U2VsZWN0aW9uID0gZWRpdENvbnRleHRTdGF0ZS5lZGl0Q29udGV4dFByaW1hcnlTZWxlY3Rpb247XG5cdH1cblxuXHRwcml2YXRlIF9lbWl0VHlwZUV2ZW50KHZpZXdDb250cm9sbGVyOiBWaWV3Q29udHJvbGxlciwgZTogVGV4dFVwZGF0ZUV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9lZGl0Q29udGV4dCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoIXRoaXMuX2VkaXRDb250ZXh0UHJpbWFyeVNlbGVjdGlvbi5lcXVhbHNTZWxlY3Rpb24odGhpcy5fcHJpbWFyeVNlbGVjdGlvbikpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9jb250ZXh0LnZpZXdNb2RlbC5tb2RlbDtcblx0XHRjb25zdCBzdGFydFBvc2l0aW9uT2ZFZGl0Q29udGV4dCA9IHRoaXMuX2VkaXRDb250ZXh0U3RhcnRQb3NpdGlvbigpO1xuXHRcdGNvbnN0IG9mZnNldE9mU3RhcnRPZlRleHQgPSBtb2RlbC5nZXRPZmZzZXRBdChzdGFydFBvc2l0aW9uT2ZFZGl0Q29udGV4dCk7XG5cdFx0Y29uc3Qgb2Zmc2V0T2ZTZWxlY3Rpb25FbmQgPSBtb2RlbC5nZXRPZmZzZXRBdCh0aGlzLl9wcmltYXJ5U2VsZWN0aW9uLmdldEVuZFBvc2l0aW9uKCkpO1xuXHRcdGNvbnN0IG9mZnNldE9mU2VsZWN0aW9uU3RhcnQgPSBtb2RlbC5nZXRPZmZzZXRBdCh0aGlzLl9wcmltYXJ5U2VsZWN0aW9uLmdldFN0YXJ0UG9zaXRpb24oKSk7XG5cdFx0Y29uc3Qgc2VsZWN0aW9uRW5kT2Zmc2V0ID0gb2Zmc2V0T2ZTZWxlY3Rpb25FbmQgLSBvZmZzZXRPZlN0YXJ0T2ZUZXh0O1xuXHRcdGNvbnN0IHNlbGVjdGlvblN0YXJ0T2Zmc2V0ID0gb2Zmc2V0T2ZTZWxlY3Rpb25TdGFydCAtIG9mZnNldE9mU3RhcnRPZlRleHQ7XG5cblx0XHRsZXQgcmVwbGFjZU5leHRDaGFyQ250ID0gMDtcblx0XHRsZXQgcmVwbGFjZVByZXZDaGFyQ250ID0gMDtcblx0XHRpZiAoZS51cGRhdGVSYW5nZUVuZCA+IHNlbGVjdGlvbkVuZE9mZnNldCkge1xuXHRcdFx0cmVwbGFjZU5leHRDaGFyQ250ID0gZS51cGRhdGVSYW5nZUVuZCAtIHNlbGVjdGlvbkVuZE9mZnNldDtcblx0XHR9XG5cdFx0aWYgKGUudXBkYXRlUmFuZ2VTdGFydCA8IHNlbGVjdGlvblN0YXJ0T2Zmc2V0KSB7XG5cdFx0XHRyZXBsYWNlUHJldkNoYXJDbnQgPSBzZWxlY3Rpb25TdGFydE9mZnNldCAtIGUudXBkYXRlUmFuZ2VTdGFydDtcblx0XHR9XG5cdFx0bGV0IHRleHQgPSAnJztcblx0XHRpZiAoc2VsZWN0aW9uU3RhcnRPZmZzZXQgPCBlLnVwZGF0ZVJhbmdlU3RhcnQpIHtcblx0XHRcdHRleHQgKz0gdGhpcy5fZWRpdENvbnRleHQudGV4dC5zdWJzdHJpbmcoc2VsZWN0aW9uU3RhcnRPZmZzZXQsIGUudXBkYXRlUmFuZ2VTdGFydCk7XG5cdFx0fVxuXHRcdHRleHQgKz0gZS50ZXh0O1xuXHRcdGlmIChzZWxlY3Rpb25FbmRPZmZzZXQgPiBlLnVwZGF0ZVJhbmdlRW5kKSB7XG5cdFx0XHR0ZXh0ICs9IHRoaXMuX2VkaXRDb250ZXh0LnRleHQuc3Vic3RyaW5nKGUudXBkYXRlUmFuZ2VFbmQsIHNlbGVjdGlvbkVuZE9mZnNldCk7XG5cdFx0fVxuXHRcdGxldCBwb3NpdGlvbkRlbHRhID0gMDtcblx0XHRpZiAoZS5zZWxlY3Rpb25TdGFydCA9PT0gZS5zZWxlY3Rpb25FbmQgJiYgc2VsZWN0aW9uU3RhcnRPZmZzZXQgPT09IHNlbGVjdGlvbkVuZE9mZnNldCkge1xuXHRcdFx0cG9zaXRpb25EZWx0YSA9IGUuc2VsZWN0aW9uU3RhcnQgLSAoZS51cGRhdGVSYW5nZVN0YXJ0ICsgZS50ZXh0Lmxlbmd0aCk7XG5cdFx0fVxuXHRcdGNvbnN0IHR5cGVJbnB1dDogSVR5cGVEYXRhID0ge1xuXHRcdFx0dGV4dCxcblx0XHRcdHJlcGxhY2VQcmV2Q2hhckNudCxcblx0XHRcdHJlcGxhY2VOZXh0Q2hhckNudCxcblx0XHRcdHBvc2l0aW9uRGVsdGFcblx0XHR9O1xuXHRcdHRoaXMuX29uVHlwZSh2aWV3Q29udHJvbGxlciwgdHlwZUlucHV0KTtcblxuXHRcdC8vIEl0IGNvdWxkIGJlIHRoYXQgdGhlIHR5cGVkIGxldHRlciBkb2VzIG5vdCBwcm9kdWNlIGEgY2hhbmdlIGluIHRoZSBlZGl0b3IgdGV4dCxcblx0XHQvLyBmb3IgZXhhbXBsZSBpZiBhbiBleHRlbnNpb24gcmVnaXN0ZXJzIGEgY3VzdG9tIHR5cGluZyBjb21tYW5kLCBhbmQgdGhlIHR5cGluZyBvcGVyYXRpb24gZG9lcyBzb21ldGhpbmcgZWxzZSBsaWtlIHNjcm9sbGluZ1xuXHRcdC8vIE5lZWQgdG8gdXBkYXRlIHRoZSBlZGl0IGNvbnRleHQgdG8gcmVmbGVjdCB0aGlzXG5cdFx0dGhpcy5fdXBkYXRlRWRpdENvbnRleHQoKTtcblx0fVxuXG5cdHByaXZhdGUgX29uVHlwZSh2aWV3Q29udHJvbGxlcjogVmlld0NvbnRyb2xsZXIsIHR5cGVJbnB1dDogSVR5cGVEYXRhKTogdm9pZCB7XG5cdFx0aWYgKHR5cGVJbnB1dC5yZXBsYWNlUHJldkNoYXJDbnQgfHwgdHlwZUlucHV0LnJlcGxhY2VOZXh0Q2hhckNudCB8fCB0eXBlSW5wdXQucG9zaXRpb25EZWx0YSkge1xuXHRcdFx0dmlld0NvbnRyb2xsZXIuY29tcG9zaXRpb25UeXBlKHR5cGVJbnB1dC50ZXh0LCB0eXBlSW5wdXQucmVwbGFjZVByZXZDaGFyQ250LCB0eXBlSW5wdXQucmVwbGFjZU5leHRDaGFyQ250LCB0eXBlSW5wdXQucG9zaXRpb25EZWx0YSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHZpZXdDb250cm9sbGVyLnR5cGUodHlwZUlucHV0LnRleHQpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2dldE5ld0VkaXRDb250ZXh0U3RhdGUoKTogeyB0ZXh0OiBzdHJpbmc7IHNlbGVjdGlvblN0YXJ0T2Zmc2V0OiBudW1iZXI7IHNlbGVjdGlvbkVuZE9mZnNldDogbnVtYmVyOyBlZGl0Q29udGV4dFByaW1hcnlTZWxlY3Rpb246IFNlbGVjdGlvbiB9IHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBlZGl0Q29udGV4dFByaW1hcnlTZWxlY3Rpb24gPSB0aGlzLl9wcmltYXJ5U2VsZWN0aW9uO1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fY29udGV4dC52aWV3TW9kZWwubW9kZWw7XG5cdFx0aWYgKCFtb2RlbC5pc1ZhbGlkUmFuZ2UoZWRpdENvbnRleHRQcmltYXJ5U2VsZWN0aW9uKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBwcmltYXJ5U2VsZWN0aW9uU3RhcnRMaW5lID0gZWRpdENvbnRleHRQcmltYXJ5U2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlcjtcblx0XHRjb25zdCBwcmltYXJ5U2VsZWN0aW9uRW5kTGluZSA9IGVkaXRDb250ZXh0UHJpbWFyeVNlbGVjdGlvbi5lbmRMaW5lTnVtYmVyO1xuXHRcdGNvbnN0IGVuZENvbHVtbk9mRW5kTGluZU51bWJlciA9IG1vZGVsLmdldExpbmVNYXhDb2x1bW4ocHJpbWFyeVNlbGVjdGlvbkVuZExpbmUpO1xuXHRcdGNvbnN0IHJhbmdlT2ZUZXh0ID0gbmV3IFJhbmdlKHByaW1hcnlTZWxlY3Rpb25TdGFydExpbmUsIDEsIHByaW1hcnlTZWxlY3Rpb25FbmRMaW5lLCBlbmRDb2x1bW5PZkVuZExpbmVOdW1iZXIpO1xuXHRcdGNvbnN0IHRleHQgPSBtb2RlbC5nZXRWYWx1ZUluUmFuZ2UocmFuZ2VPZlRleHQsIEVuZE9mTGluZVByZWZlcmVuY2UuVGV4dERlZmluZWQpO1xuXHRcdGNvbnN0IHNlbGVjdGlvblN0YXJ0T2Zmc2V0ID0gZWRpdENvbnRleHRQcmltYXJ5U2VsZWN0aW9uLnN0YXJ0Q29sdW1uIC0gMTtcblx0XHRjb25zdCBzZWxlY3Rpb25FbmRPZmZzZXQgPSB0ZXh0Lmxlbmd0aCArIGVkaXRDb250ZXh0UHJpbWFyeVNlbGVjdGlvbi5lbmRDb2x1bW4gLSBlbmRDb2x1bW5PZkVuZExpbmVOdW1iZXI7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHRleHQsXG5cdFx0XHRzZWxlY3Rpb25TdGFydE9mZnNldCxcblx0XHRcdHNlbGVjdGlvbkVuZE9mZnNldCxcblx0XHRcdGVkaXRDb250ZXh0UHJpbWFyeVNlbGVjdGlvblxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIF9lZGl0Q29udGV4dFN0YXJ0UG9zaXRpb24oKTogUG9zaXRpb24ge1xuXHRcdHJldHVybiBuZXcgUG9zaXRpb24odGhpcy5fZWRpdENvbnRleHRQcmltYXJ5U2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlciwgMSk7XG5cdH1cblxuXHRwcml2YXRlIF9oYW5kbGVUZXh0Rm9ybWF0VXBkYXRlKGU6IFRleHRGb3JtYXRVcGRhdGVFdmVudCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fZWRpdENvbnRleHQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgZm9ybWF0cyA9IGUuZ2V0VGV4dEZvcm1hdHMoKTtcblx0XHRjb25zdCBlZGl0Q29udGV4dFN0YXJ0UG9zaXRpb24gPSB0aGlzLl9lZGl0Q29udGV4dFN0YXJ0UG9zaXRpb24oKTtcblx0XHRjb25zdCBkZWNvcmF0aW9uczogSU1vZGVsRGVsdGFEZWNvcmF0aW9uW10gPSBbXTtcblx0XHRmb3JtYXRzLmZvckVhY2goZiA9PiB7XG5cdFx0XHRjb25zdCB0ZXh0TW9kZWwgPSB0aGlzLl9jb250ZXh0LnZpZXdNb2RlbC5tb2RlbDtcblx0XHRcdGNvbnN0IG9mZnNldE9mRWRpdENvbnRleHRUZXh0ID0gdGV4dE1vZGVsLmdldE9mZnNldEF0KGVkaXRDb250ZXh0U3RhcnRQb3NpdGlvbik7XG5cdFx0XHRjb25zdCBzdGFydFBvc2l0aW9uT2ZEZWNvcmF0aW9uID0gdGV4dE1vZGVsLmdldFBvc2l0aW9uQXQob2Zmc2V0T2ZFZGl0Q29udGV4dFRleHQgKyBmLnJhbmdlU3RhcnQpO1xuXHRcdFx0Y29uc3QgZW5kUG9zaXRpb25PZkRlY29yYXRpb24gPSB0ZXh0TW9kZWwuZ2V0UG9zaXRpb25BdChvZmZzZXRPZkVkaXRDb250ZXh0VGV4dCArIGYucmFuZ2VFbmQpO1xuXHRcdFx0Y29uc3QgZGVjb3JhdGlvblJhbmdlID0gUmFuZ2UuZnJvbVBvc2l0aW9ucyhzdGFydFBvc2l0aW9uT2ZEZWNvcmF0aW9uLCBlbmRQb3NpdGlvbk9mRGVjb3JhdGlvbik7XG5cdFx0XHRjb25zdCB0aGlja25lc3MgPSBmLnVuZGVybGluZVRoaWNrbmVzcy50b0xvd2VyQ2FzZSgpO1xuXHRcdFx0bGV0IGRlY29yYXRpb25DbGFzc05hbWU6IHN0cmluZyA9IENvbXBvc2l0aW9uQ2xhc3NOYW1lLk5PTkU7XG5cdFx0XHRzd2l0Y2ggKHRoaWNrbmVzcykge1xuXHRcdFx0XHRjYXNlICd0aGluJzpcblx0XHRcdFx0XHRkZWNvcmF0aW9uQ2xhc3NOYW1lID0gQ29tcG9zaXRpb25DbGFzc05hbWUuU0VDT05EQVJZO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlICd0aGljayc6XG5cdFx0XHRcdFx0ZGVjb3JhdGlvbkNsYXNzTmFtZSA9IENvbXBvc2l0aW9uQ2xhc3NOYW1lLlBSSU1BUlk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRkZWNvcmF0aW9ucy5wdXNoKHtcblx0XHRcdFx0cmFuZ2U6IGRlY29yYXRpb25SYW5nZSxcblx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiAndGV4dEZvcm1hdERlY29yYXRpb24nLFxuXHRcdFx0XHRcdGlubGluZUNsYXNzTmFtZTogZGVjb3JhdGlvbkNsYXNzTmFtZSxcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0dGhpcy5fZGVjb3JhdGlvbnMgPSB0aGlzLl9jb250ZXh0LnZpZXdNb2RlbC5tb2RlbC5kZWx0YURlY29yYXRpb25zKHRoaXMuX2RlY29yYXRpb25zLCBkZWNvcmF0aW9ucyk7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVTZWxlY3Rpb25BbmRDb250cm9sQm91bmRzKGN0eDogUmVuZGVyaW5nQ29udGV4dCkge1xuXHRcdGlmICghdGhpcy5fcGFyZW50KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IG9wdGlvbnMgPSB0aGlzLl9jb250ZXh0LmNvbmZpZ3VyYXRpb24ub3B0aW9ucztcblx0XHRjb25zdCBsaW5lSGVpZ2h0ID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmxpbmVIZWlnaHQpO1xuXHRcdGNvbnN0IGNvbnRlbnRMZWZ0ID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmxheW91dEluZm8pLmNvbnRlbnRMZWZ0O1xuXHRcdGNvbnN0IHBhcmVudEJvdW5kcyA9IHRoaXMuX3BhcmVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRjb25zdCBtb2RlbFN0YXJ0UG9zaXRpb24gPSB0aGlzLl9wcmltYXJ5U2VsZWN0aW9uLmdldFN0YXJ0UG9zaXRpb24oKTtcblx0XHRjb25zdCB2aWV3U3RhcnRQb3NpdGlvbiA9IHRoaXMuX2NvbnRleHQudmlld01vZGVsLmNvb3JkaW5hdGVzQ29udmVydGVyLmNvbnZlcnRNb2RlbFBvc2l0aW9uVG9WaWV3UG9zaXRpb24obW9kZWxTdGFydFBvc2l0aW9uKTtcblx0XHRjb25zdCB2ZXJ0aWNhbE9mZnNldFN0YXJ0ID0gdGhpcy5fY29udGV4dC52aWV3TGF5b3V0LmdldFZlcnRpY2FsT2Zmc2V0Rm9yTGluZU51bWJlcih2aWV3U3RhcnRQb3NpdGlvbi5saW5lTnVtYmVyKTtcblxuXHRcdGNvbnN0IHRvcCA9IHBhcmVudEJvdW5kcy50b3AgKyB2ZXJ0aWNhbE9mZnNldFN0YXJ0IC0gdGhpcy5fc2Nyb2xsVG9wO1xuXHRcdGNvbnN0IGhlaWdodCA9ICh0aGlzLl9wcmltYXJ5U2VsZWN0aW9uLmVuZExpbmVOdW1iZXIgLSB0aGlzLl9wcmltYXJ5U2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlciArIDEpICogbGluZUhlaWdodDtcblx0XHRsZXQgbGVmdCA9IHBhcmVudEJvdW5kcy5sZWZ0ICsgY29udGVudExlZnQgLSB0aGlzLl9zY3JvbGxMZWZ0O1xuXHRcdGxldCB3aWR0aDogbnVtYmVyO1xuXG5cdFx0aWYgKHRoaXMuX3ByaW1hcnlTZWxlY3Rpb24uaXNFbXB0eSgpKSB7XG5cdFx0XHRjb25zdCBsaW5lc1Zpc2libGVSYW5nZXMgPSBjdHgudmlzaWJsZVJhbmdlRm9yUG9zaXRpb24odmlld1N0YXJ0UG9zaXRpb24pO1xuXHRcdFx0aWYgKGxpbmVzVmlzaWJsZVJhbmdlcykge1xuXHRcdFx0XHRsZWZ0ICs9IGxpbmVzVmlzaWJsZVJhbmdlcy5sZWZ0O1xuXHRcdFx0fVxuXHRcdFx0d2lkdGggPSAwO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR3aWR0aCA9IHBhcmVudEJvdW5kcy53aWR0aCAtIGNvbnRlbnRMZWZ0O1xuXHRcdH1cblxuXHRcdGNvbnN0IHNlbGVjdGlvbkJvdW5kcyA9IG5ldyBET01SZWN0KGxlZnQsIHRvcCwgd2lkdGgsIGhlaWdodCk7XG5cdFx0dGhpcy5fZWRpdENvbnRleHQudXBkYXRlU2VsZWN0aW9uQm91bmRzKHNlbGVjdGlvbkJvdW5kcyk7XG5cdFx0dGhpcy5fZWRpdENvbnRleHQudXBkYXRlQ29udHJvbEJvdW5kcyhzZWxlY3Rpb25Cb3VuZHMpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlQ2hhcmFjdGVyQm91bmRzKGU6IENoYXJhY3RlckJvdW5kc1VwZGF0ZUV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9wYXJlbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3Qgb3B0aW9ucyA9IHRoaXMuX2NvbnRleHQuY29uZmlndXJhdGlvbi5vcHRpb25zO1xuXHRcdGNvbnN0IHR5cGljYWxIYWxmV2lkdGhDaGFyYWN0ZXJXaWR0aCA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5mb250SW5mbykudHlwaWNhbEhhbGZ3aWR0aENoYXJhY3RlcldpZHRoO1xuXHRcdGNvbnN0IGxpbmVIZWlnaHQgPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24ubGluZUhlaWdodCk7XG5cdFx0Y29uc3QgY29udGVudExlZnQgPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24ubGF5b3V0SW5mbykuY29udGVudExlZnQ7XG5cdFx0Y29uc3QgcGFyZW50Qm91bmRzID0gdGhpcy5fcGFyZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXG5cdFx0Y29uc3QgY2hhcmFjdGVyQm91bmRzOiBET01SZWN0W10gPSBbXTtcblx0XHRjb25zdCBvZmZzZXRUcmFuc2Zvcm1lciA9IG5ldyBQb3NpdGlvbk9mZnNldFRyYW5zZm9ybWVyKHRoaXMuX2VkaXRDb250ZXh0LnRleHQpO1xuXHRcdGZvciAobGV0IG9mZnNldCA9IGUucmFuZ2VTdGFydDsgb2Zmc2V0IDwgZS5yYW5nZUVuZDsgb2Zmc2V0KyspIHtcblx0XHRcdGNvbnN0IGVkaXRDb250ZXh0U3RhcnRQb3NpdGlvbiA9IG9mZnNldFRyYW5zZm9ybWVyLmdldFBvc2l0aW9uKG9mZnNldCk7XG5cdFx0XHRjb25zdCB0ZXh0U3RhcnRMaW5lT2Zmc2V0V2l0aGluRWRpdG9yID0gdGhpcy5fZWRpdENvbnRleHRQcmltYXJ5U2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlciAtIDE7XG5cdFx0XHRjb25zdCBjaGFyYWN0ZXJTdGFydFBvc2l0aW9uID0gbmV3IFBvc2l0aW9uKHRleHRTdGFydExpbmVPZmZzZXRXaXRoaW5FZGl0b3IgKyBlZGl0Q29udGV4dFN0YXJ0UG9zaXRpb24ubGluZU51bWJlciwgZWRpdENvbnRleHRTdGFydFBvc2l0aW9uLmNvbHVtbik7XG5cdFx0XHRjb25zdCBjaGFyYWN0ZXJFbmRQb3NpdGlvbiA9IGNoYXJhY3RlclN0YXJ0UG9zaXRpb24uZGVsdGEoMCwgMSk7XG5cdFx0XHRjb25zdCBjaGFyYWN0ZXJNb2RlbFJhbmdlID0gUmFuZ2UuZnJvbVBvc2l0aW9ucyhjaGFyYWN0ZXJTdGFydFBvc2l0aW9uLCBjaGFyYWN0ZXJFbmRQb3NpdGlvbik7XG5cdFx0XHRjb25zdCBjaGFyYWN0ZXJWaWV3UmFuZ2UgPSB0aGlzLl9jb250ZXh0LnZpZXdNb2RlbC5jb29yZGluYXRlc0NvbnZlcnRlci5jb252ZXJ0TW9kZWxSYW5nZVRvVmlld1JhbmdlKGNoYXJhY3Rlck1vZGVsUmFuZ2UpO1xuXHRcdFx0Y29uc3QgY2hhcmFjdGVyTGluZXNWaXNpYmxlUmFuZ2VzID0gdGhpcy5fdmlzaWJsZVJhbmdlUHJvdmlkZXIubGluZXNWaXNpYmxlUmFuZ2VzRm9yUmFuZ2UoY2hhcmFjdGVyVmlld1JhbmdlLCB0cnVlKSA/PyBbXTtcblx0XHRcdGNvbnN0IGNoYXJhY3RlclZlcnRpY2FsT2Zmc2V0ID0gdGhpcy5fY29udGV4dC52aWV3TGF5b3V0LmdldFZlcnRpY2FsT2Zmc2V0Rm9yTGluZU51bWJlcihjaGFyYWN0ZXJWaWV3UmFuZ2Uuc3RhcnRMaW5lTnVtYmVyKTtcblx0XHRcdGNvbnN0IHRvcCA9IHBhcmVudEJvdW5kcy50b3AgKyBjaGFyYWN0ZXJWZXJ0aWNhbE9mZnNldCAtIHRoaXMuX3Njcm9sbFRvcDtcblxuXHRcdFx0bGV0IGxlZnQgPSAwO1xuXHRcdFx0bGV0IHdpZHRoID0gdHlwaWNhbEhhbGZXaWR0aENoYXJhY3RlcldpZHRoO1xuXHRcdFx0aWYgKGNoYXJhY3RlckxpbmVzVmlzaWJsZVJhbmdlcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgdmlzaWJsZVJhbmdlIG9mIGNoYXJhY3RlckxpbmVzVmlzaWJsZVJhbmdlc1swXS5yYW5nZXMpIHtcblx0XHRcdFx0XHRsZWZ0ID0gdmlzaWJsZVJhbmdlLmxlZnQ7XG5cdFx0XHRcdFx0d2lkdGggPSB2aXNpYmxlUmFuZ2Uud2lkdGg7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGNoYXJhY3RlckJvdW5kcy5wdXNoKG5ldyBET01SZWN0KHBhcmVudEJvdW5kcy5sZWZ0ICsgY29udGVudExlZnQgKyBsZWZ0IC0gdGhpcy5fc2Nyb2xsTGVmdCwgdG9wLCB3aWR0aCwgbGluZUhlaWdodCkpO1xuXHRcdH1cblx0XHR0aGlzLl9lZGl0Q29udGV4dC51cGRhdGVDaGFyYWN0ZXJCb3VuZHMoZS5yYW5nZVN0YXJ0LCBjaGFyYWN0ZXJCb3VuZHMpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZW5zdXJlQ2xpcGJvYXJkR2V0c0VkaXRvclNlbGVjdGlvbihlOiBDbGlwYm9hcmRFdmVudCk6IHZvaWQge1xuXHRcdGNvbnN0IG9wdGlvbnMgPSB0aGlzLl9jb250ZXh0LmNvbmZpZ3VyYXRpb24ub3B0aW9ucztcblx0XHRjb25zdCBlbXB0eVNlbGVjdGlvbkNsaXBib2FyZCA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5lbXB0eVNlbGVjdGlvbkNsaXBib2FyZCk7XG5cdFx0Y29uc3QgY29weVdpdGhTeW50YXhIaWdobGlnaHRpbmcgPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24uY29weVdpdGhTeW50YXhIaWdobGlnaHRpbmcpO1xuXHRcdGNvbnN0IHNlbGVjdGlvbnMgPSB0aGlzLl9jb250ZXh0LnZpZXdNb2RlbC5nZXRDdXJzb3JTdGF0ZXMoKS5tYXAoY3Vyc29yU3RhdGUgPT4gY3Vyc29yU3RhdGUubW9kZWxTdGF0ZS5zZWxlY3Rpb24pO1xuXHRcdGNvbnN0IGRhdGFUb0NvcHkgPSBnZXREYXRhVG9Db3B5KHRoaXMuX2NvbnRleHQudmlld01vZGVsLCBzZWxlY3Rpb25zLCBlbXB0eVNlbGVjdGlvbkNsaXBib2FyZCwgY29weVdpdGhTeW50YXhIaWdobGlnaHRpbmcpO1xuXHRcdGNvbnN0IHN0b3JlZE1ldGFkYXRhOiBDbGlwYm9hcmRTdG9yZWRNZXRhZGF0YSA9IHtcblx0XHRcdHZlcnNpb246IDEsXG5cdFx0XHRpc0Zyb21FbXB0eVNlbGVjdGlvbjogZGF0YVRvQ29weS5pc0Zyb21FbXB0eVNlbGVjdGlvbixcblx0XHRcdG11bHRpY3Vyc29yVGV4dDogZGF0YVRvQ29weS5tdWx0aWN1cnNvclRleHQsXG5cdFx0XHRtb2RlOiBkYXRhVG9Db3B5Lm1vZGVcblx0XHR9O1xuXHRcdEluTWVtb3J5Q2xpcGJvYXJkTWV0YWRhdGFNYW5hZ2VyLklOU1RBTkNFLnNldChcblx0XHRcdC8vIFdoZW4gd3JpdGluZyBcIkxJTkVcXHJcXG5cIiB0byB0aGUgY2xpcGJvYXJkIGFuZCB0aGVuIHBhc3RpbmcsXG5cdFx0XHQvLyBGaXJlZm94IHBhc3RlcyBcIkxJTkVcXG5cIiwgc28gbGV0J3Mgd29yayBhcm91bmQgdGhpcyBxdWlya1xuXHRcdFx0KGlzRmlyZWZveCA/IGRhdGFUb0NvcHkudGV4dC5yZXBsYWNlKC9cXHJcXG4vZywgJ1xcbicpIDogZGF0YVRvQ29weS50ZXh0KSxcblx0XHRcdHN0b3JlZE1ldGFkYXRhXG5cdFx0KTtcblx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0aWYgKGUuY2xpcGJvYXJkRGF0YSkge1xuXHRcdFx0Q2xpcGJvYXJkRXZlbnRVdGlscy5zZXRUZXh0RGF0YShlLmNsaXBib2FyZERhdGEsIGRhdGFUb0NvcHkudGV4dCwgZGF0YVRvQ29weS5odG1sLCBzdG9yZWRNZXRhZGF0YSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfc2V0U2VsZWN0aW9uQ2hhbmdlTGlzdGVuZXIodmlld0NvbnRyb2xsZXI6IFZpZXdDb250cm9sbGVyKTogSURpc3Bvc2FibGUge1xuXHRcdC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMjcyMTYgYW5kIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy85ODI1NlxuXHRcdC8vIFdoZW4gdXNpbmcgYSBCcmFpbGxlIGRpc3BsYXkgb3IgTlZEQSBmb3IgZXhhbXBsZSwgaXQgaXMgcG9zc2libGUgZm9yIHVzZXJzIHRvIHJlcG9zaXRpb24gdGhlXG5cdFx0Ly8gc3lzdGVtIGNhcmV0LiBUaGlzIGlzIHJlZmxlY3RlZCBpbiBDaHJvbWUgYXMgYSBgc2VsZWN0aW9uY2hhbmdlYCBldmVudCBhbmQgbmVlZHMgdG8gYmUgcmVmbGVjdGVkIHdpdGhpbiB0aGUgZWRpdG9yLlxuXG5cdFx0Ly8gYHNlbGVjdGlvbmNoYW5nZWAgZXZlbnRzIG9mdGVuIGNvbWUgbXVsdGlwbGUgdGltZXMgZm9yIGEgc2luZ2xlIGxvZ2ljYWwgY2hhbmdlXG5cdFx0Ly8gc28gdGhyb3R0bGUgbXVsdGlwbGUgYHNlbGVjdGlvbmNoYW5nZWAgZXZlbnRzIHRoYXQgYnVyc3QgaW4gYSBzaG9ydCBwZXJpb2Qgb2YgdGltZS5cblx0XHRsZXQgcHJldmlvdXNTZWxlY3Rpb25DaGFuZ2VFdmVudFRpbWUgPSAwO1xuXHRcdHJldHVybiBhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5kb21Ob2RlLmRvbU5vZGUub3duZXJEb2N1bWVudCwgJ3NlbGVjdGlvbmNoYW5nZScsICgpID0+IHtcblx0XHRcdGNvbnN0IGlzU2NyZWVuUmVhZGVyT3B0aW1pemVkID0gdGhpcy5fYWNjZXNzaWJpbGl0eVNlcnZpY2UuaXNTY3JlZW5SZWFkZXJPcHRpbWl6ZWQoKTtcblx0XHRcdGlmICghdGhpcy5pc0ZvY3VzZWQoKSB8fCAhaXNTY3JlZW5SZWFkZXJPcHRpbWl6ZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3Qgc2NyZWVuUmVhZGVyQ29udGVudFN0YXRlID0gdGhpcy5fc2NyZWVuUmVhZGVyU3VwcG9ydC5zY3JlZW5SZWFkZXJDb250ZW50U3RhdGU7XG5cdFx0XHRpZiAoIXNjcmVlblJlYWRlckNvbnRlbnRTdGF0ZSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuXHRcdFx0Y29uc3QgZGVsdGExID0gbm93IC0gcHJldmlvdXNTZWxlY3Rpb25DaGFuZ2VFdmVudFRpbWU7XG5cdFx0XHRwcmV2aW91c1NlbGVjdGlvbkNoYW5nZUV2ZW50VGltZSA9IG5vdztcblx0XHRcdGlmIChkZWx0YTEgPCA1KSB7XG5cdFx0XHRcdC8vIHJlY2VpdmVkIGFub3RoZXIgYHNlbGVjdGlvbmNoYW5nZWAgZXZlbnQgd2l0aGluIDVtcyBvZiB0aGUgcHJldmlvdXMgYHNlbGVjdGlvbmNoYW5nZWAgZXZlbnRcblx0XHRcdFx0Ly8gPT4gaWdub3JlIGl0XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGRlbHRhMiA9IG5vdyAtIHRoaXMuX3NjcmVlblJlYWRlclN1cHBvcnQuZ2V0SWdub3JlU2VsZWN0aW9uQ2hhbmdlVGltZSgpO1xuXHRcdFx0dGhpcy5fc2NyZWVuUmVhZGVyU3VwcG9ydC5yZXNldFNlbGVjdGlvbkNoYW5nZVRpbWUoKTtcblx0XHRcdGlmIChkZWx0YTIgPCAxMDApIHtcblx0XHRcdFx0Ly8gcmVjZWl2ZWQgYSBgc2VsZWN0aW9uY2hhbmdlYCBldmVudCB3aXRoaW4gMTAwbXMgc2luY2Ugd2UgdG91Y2hlZCB0aGUgdGV4dGFyZWFcblx0XHRcdFx0Ly8gPT4gaWdub3JlIGl0LCBzaW5jZSB3ZSBjYXVzZWQgaXRcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgYWN0aXZlRG9jdW1lbnQgPSBnZXRBY3RpdmVXaW5kb3coKS5kb2N1bWVudDtcblx0XHRcdGNvbnN0IGFjdGl2ZURvY3VtZW50U2VsZWN0aW9uID0gYWN0aXZlRG9jdW1lbnQuZ2V0U2VsZWN0aW9uKCk7XG5cdFx0XHRpZiAoIWFjdGl2ZURvY3VtZW50U2VsZWN0aW9uKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHJhbmdlQ291bnQgPSBhY3RpdmVEb2N1bWVudFNlbGVjdGlvbi5yYW5nZUNvdW50O1xuXHRcdFx0aWYgKHJhbmdlQ291bnQgPT09IDApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgcmFuZ2UgPSBhY3RpdmVEb2N1bWVudFNlbGVjdGlvbi5nZXRSYW5nZUF0KDApO1xuXHRcdFx0Y29uc3Qgdmlld01vZGVsID0gdGhpcy5fY29udGV4dC52aWV3TW9kZWw7XG5cdFx0XHRjb25zdCBtb2RlbCA9IHZpZXdNb2RlbC5tb2RlbDtcblx0XHRcdGNvbnN0IGNvb3JkaW5hdGVzQ29udmVydGVyID0gdmlld01vZGVsLmNvb3JkaW5hdGVzQ29udmVydGVyO1xuXHRcdFx0Y29uc3QgbW9kZWxTY3JlZW5SZWFkZXJDb250ZW50U3RhcnRQb3NpdGlvbldpdGhpbkVkaXRvciA9IGNvb3JkaW5hdGVzQ29udmVydGVyLmNvbnZlcnRWaWV3UG9zaXRpb25Ub01vZGVsUG9zaXRpb24oc2NyZWVuUmVhZGVyQ29udGVudFN0YXRlLnN0YXJ0UG9zaXRpb25XaXRoaW5FZGl0b3IpO1xuXHRcdFx0Y29uc3Qgb2Zmc2V0T2ZTdGFydE9mU2NyZWVuUmVhZGVyQ29udGVudCA9IG1vZGVsLmdldE9mZnNldEF0KG1vZGVsU2NyZWVuUmVhZGVyQ29udGVudFN0YXJ0UG9zaXRpb25XaXRoaW5FZGl0b3IpO1xuXHRcdFx0bGV0IG9mZnNldE9mU2VsZWN0aW9uU3RhcnQgPSByYW5nZS5zdGFydE9mZnNldCArIG9mZnNldE9mU3RhcnRPZlNjcmVlblJlYWRlckNvbnRlbnQ7XG5cdFx0XHRsZXQgb2Zmc2V0T2ZTZWxlY3Rpb25FbmQgPSByYW5nZS5lbmRPZmZzZXQgKyBvZmZzZXRPZlN0YXJ0T2ZTY3JlZW5SZWFkZXJDb250ZW50O1xuXHRcdFx0Y29uc3QgbW9kZWxVc2VzQ1JMRiA9IG1vZGVsLmdldEVuZE9mTGluZVNlcXVlbmNlKCkgPT09IEVuZE9mTGluZVNlcXVlbmNlLkNSTEY7XG5cdFx0XHRpZiAobW9kZWxVc2VzQ1JMRikge1xuXHRcdFx0XHRjb25zdCBzY3JlZW5SZWFkZXJDb250ZW50VGV4dCA9IHNjcmVlblJlYWRlckNvbnRlbnRTdGF0ZS52YWx1ZTtcblx0XHRcdFx0Y29uc3Qgb2Zmc2V0VHJhbnNmb3JtZXIgPSBuZXcgUG9zaXRpb25PZmZzZXRUcmFuc2Zvcm1lcihzY3JlZW5SZWFkZXJDb250ZW50VGV4dCk7XG5cdFx0XHRcdGNvbnN0IHBvc2l0aW9uT2ZTdGFydFdpdGhpblRleHQgPSBvZmZzZXRUcmFuc2Zvcm1lci5nZXRQb3NpdGlvbihyYW5nZS5zdGFydE9mZnNldCk7XG5cdFx0XHRcdGNvbnN0IHBvc2l0aW9uT2ZFbmRXaXRoaW5UZXh0ID0gb2Zmc2V0VHJhbnNmb3JtZXIuZ2V0UG9zaXRpb24ocmFuZ2UuZW5kT2Zmc2V0KTtcblx0XHRcdFx0b2Zmc2V0T2ZTZWxlY3Rpb25TdGFydCArPSBwb3NpdGlvbk9mU3RhcnRXaXRoaW5UZXh0LmxpbmVOdW1iZXIgLSAxO1xuXHRcdFx0XHRvZmZzZXRPZlNlbGVjdGlvbkVuZCArPSBwb3NpdGlvbk9mRW5kV2l0aGluVGV4dC5saW5lTnVtYmVyIC0gMTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHBvc2l0aW9uT2ZTZWxlY3Rpb25TdGFydCA9IG1vZGVsLmdldFBvc2l0aW9uQXQob2Zmc2V0T2ZTZWxlY3Rpb25TdGFydCk7XG5cdFx0XHRjb25zdCBwb3NpdGlvbk9mU2VsZWN0aW9uRW5kID0gbW9kZWwuZ2V0UG9zaXRpb25BdChvZmZzZXRPZlNlbGVjdGlvbkVuZCk7XG5cdFx0XHRjb25zdCBuZXdTZWxlY3Rpb24gPSBTZWxlY3Rpb24uZnJvbVBvc2l0aW9ucyhwb3NpdGlvbk9mU2VsZWN0aW9uU3RhcnQsIHBvc2l0aW9uT2ZTZWxlY3Rpb25FbmQpO1xuXHRcdFx0dmlld0NvbnRyb2xsZXIuc2V0U2VsZWN0aW9uKG5ld1NlbGVjdGlvbik7XG5cdFx0fSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsT0FBTztBQUNQLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsdUJBQXVCLGlCQUFpQixXQUFXLG1CQUFtQjtBQUMvRSxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGVBQWU7QUFDeEIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxxQkFBcUIseUJBQWdEO0FBSzlFLFNBQVMscUJBQThDLGVBQWUsd0NBQXdDO0FBQzlHLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsa0NBQWtDLG9CQUErQjtBQUMxRSxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLGFBQWE7QUFDdEIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxnQkFBZ0I7QUFFekIsU0FBUyxpQ0FBaUM7QUFDMUMsU0FBc0IseUJBQXlCO0FBQy9DLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsaUNBQWlDO0FBSTFDLElBQUssdUJBQUwsa0JBQUtBLDBCQUFMO0FBQ0MsRUFBQUEsc0JBQUEsVUFBTztBQUNQLEVBQUFBLHNCQUFBLGVBQVk7QUFDWixFQUFBQSxzQkFBQSxhQUFVO0FBSE4sU0FBQUE7QUFBQSxHQUFBO0FBTUUsSUFBTSxvQkFBTixjQUFnQyxvQkFBb0I7QUFBQSxFQXVCMUQsWUFDQyxTQUNBLFNB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SyxRQUFRLFFBQVEsZUFBZSxtQkFBbUIsTUFBTTtBQUN6RixZQUFNLDBCQUEwQixLQUFLLHNCQUFzQix3QkFBd0I7QUFDbkYsVUFBSSxDQUFDLEtBQUssVUFBVSxLQUFLLENBQUMseUJBQXlCO0FBQ2xEO0FBQUEsTUFDRDtBQUNBLFlBQU0sMkJBQTJCLEtBQUsscUJBQXFCO0FBQzNELFVBQUksQ0FBQywwQkFBMEI7QUFDOUI7QUFBQSxNQUNEO0FBQ0EsWUFBTSxNQUFNLEtBQUssSUFBSTtBQUNyQixZQUFNLFNBQVMsTUFBTTtBQUNyQix5Q0FBbUM7QUFDbkMsVUFBSSxTQUFTLEdBQUc7QUFHZjtBQUFBLE1BQ0Q7QUFDQSxZQUFNLFNBQVMsTUFBTSxLQUFLLHFCQUFxQiw2QkFBNkI7QUFDNUUsV0FBSyxxQkFBcUIseUJBQXlCO0FBQ25ELFVBQUksU0FBUyxLQUFLO0FBR2pCO0FBQUEsTUFDRDtBQUNBLFlBQU0saUJBQWlCLGdCQUFnQixFQUFFO0FBQ3pDLFlBQU0sMEJBQTBCLGVBQWUsYUFBYTtBQUM1RCxVQUFJLENBQUMseUJBQXlCO0FBQzdCO0FBQUEsTUFDRDtBQUNBLFlBQU0sYUFBYSx3QkFBd0I7QUFDM0MsVUFBSSxlQUFlLEdBQUc7QUFDckI7QUFBQSxNQUNEO0FBQ0EsWUFBTSxRQUFRLHdCQUF3QixXQUFXLENBQUM7QUFDbEQsWUFBTSxZQUFZLEtBQUssU0FBUztBQUNoQyxZQUFNLFFBQVEsVUFBVTtBQUN4QixZQUFNLHVCQUF1QixVQUFVO0FBQ3ZDLFlBQU0sb0RBQW9ELHFCQUFxQixtQ0FBbUMseUJBQXlCLHlCQUF5QjtBQUNwSyxZQUFNLHFDQUFxQyxNQUFNLFlBQVksaURBQWlEO0FBQzlHLFVBQUkseUJBQXlCLE1BQU0sY0FBYztBQUNqRCxVQUFJLHVCQUF1QixNQUFNLFlBQVk7QUFDN0MsWUFBTSxnQkFBZ0IsTUFBTSxxQkFBcUIsTUFBTSxrQkFBa0I7QUFDekUsVUFBSSxlQUFlO0FBQ2xCLGNBQU0sMEJBQTBCLHlCQUF5QjtBQUN6RCxjQUFNLG9CQUFvQixJQUFJLDBCQUEwQix1QkFBdUI7QUFDL0UsY0FBTSw0QkFBNEIsa0JBQWtCLFlBQVksTUFBTSxXQUFXO0FBQ2pGLGNBQU0sMEJBQTBCLGtCQUFrQixZQUFZLE1BQU0sU0FBUztBQUM3RSxrQ0FBMEIsMEJBQTBCLGFBQWE7QUFDakUsZ0NBQXdCLHdCQUF3QixhQUFhO0FBQUEsTUFDOUQ7QUFDQSxZQUFNLDJCQUEyQixNQUFNLGNBQWMsc0JBQXNCO0FBQzNFLFlBQU0seUJBQXlCLE1BQU0sY0FBYyxvQkFBb0I7QUFDdkUsWUFBTSxlQUFlLFVBQVUsY0FBYywwQkFBMEIsc0JBQXNCO0FBQzdGLHFCQUFlLGFBQWEsWUFBWTtBQUFBLElBQ3pDLENBQUM7QUFBQSxFQUNGO0FBQ0Q7QUEvaUJhLG9CQUFOO0FBQUEsRUE2Qko7QUFBQSxFQUNBO0FBQUEsR0E5QlU7IiwKICAibmFtZXMiOiBbIkNvbXBvc2l0aW9uQ2xhc3NOYW1lIl0KfQo=
