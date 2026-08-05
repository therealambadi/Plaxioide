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
import "./textAreaEditContext.css";
import * as nls from "../../../../../nls.js";
import * as browser from "../../../../../base/browser/browser.js";
import { createFastDomNode } from "../../../../../base/browser/fastDomNode.js";
import * as platform from "../../../../../base/common/platform.js";
import * as strings from "../../../../../base/common/strings.js";
import { applyFontInfo } from "../../../config/domFontInfo.js";
import { PartFingerprint, PartFingerprints } from "../../../view/viewPart.js";
import { LineNumbersOverlay } from "../../../viewParts/lineNumbers/lineNumbers.js";
import { Margin } from "../../../viewParts/margin/margin.js";
import { RenderLineNumbersType, EditorOption, EditorOptions } from "../../../../common/config/editorOptions.js";
import { Position } from "../../../../common/core/position.js";
import { Range } from "../../../../common/core/range.js";
import { Selection } from "../../../../common/core/selection.js";
import { ScrollType } from "../../../../common/editorCommon.js";
import { EndOfLinePreference } from "../../../../common/model.js";
import * as viewEvents from "../../../../common/viewEvents.js";
import { AccessibilitySupport } from "../../../../../platform/accessibility/common/accessibility.js";
import { MOUSE_CURSOR_TEXT_CSS_CLASS_NAME } from "../../../../../base/browser/ui/mouseCursor/mouseCursor.js";
import { TokenizationRegistry } from "../../../../common/languages.js";
import { ColorId } from "../../../../common/encodedTokenAttributes.js";
import { Color } from "../../../../../base/common/color.js";
import { IME } from "../../../../../base/common/ime.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { AbstractEditContext } from "../editContext.js";
import { TextAreaInput, TextAreaWrapper } from "./textAreaEditContextInput.js";
import { ariaLabelForScreenReaderContent, newlinecount, PagedScreenReaderStrategy } from "../screenReaderUtils.js";
import { getDataToCopy } from "../clipboardUtils.js";
import { _debugComposition, TextAreaState } from "./textAreaEditContextState.js";
import { getMapForWordSeparators, WordCharacterClass } from "../../../../common/core/wordCharacterClassifier.js";
class VisibleTextAreaData {
  constructor(_context, modelLineNumber, distanceToModelLineStart, widthOfHiddenLineTextBefore, distanceToModelLineEnd) {
    this._context = _context;
    this.modelLineNumber = modelLineNumber;
    this.distanceToModelLineStart = distanceToModelLineStart;
    this.widthOfHiddenLineTextBefore = widthOfHiddenLineTextBefore;
    this.distanceToModelLineEnd = distanceToModelLineEnd;
    this._visibleTextAreaBrand = void 0;
    this.startPosition = null;
    this.endPosition = null;
    this.visibleTextareaStart = null;
    this.visibleTextareaEnd = null;
    /**
     * When doing composition, the currently composed text might be split up into
     * multiple tokens, then merged again into a single token, etc. Here we attempt
     * to keep the presentation of the <textarea> stable by using the previous used
     * style if multiple tokens come into play. This avoids flickering.
     */
    this._previousPresentation = null;
  }
  prepareRender(visibleRangeProvider) {
    const startModelPosition = new Position(this.modelLineNumber, this.distanceToModelLineStart + 1);
    const endModelPosition = new Position(this.modelLineNumber, this._context.viewModel.model.getLineMaxColumn(this.modelLineNumber) - this.distanceToModelLineEnd);
    this.startPosition = this._context.viewModel.coordinatesConverter.convertModelPositionToViewPosition(startModelPosition);
    this.endPosition = this._context.viewModel.coordinatesConverter.convertModelPositionToViewPosition(endModelPosition);
    if (this.startPosition.lineNumber === this.endPosition.lineNumber) {
      this.visibleTextareaStart = visibleRangeProvider.visibleRangeForPosition(this.startPosition);
      this.visibleTextareaEnd = visibleRangeProvider.visibleRangeForPosition(this.endPosition);
    } else {
      this.visibleTextareaStart = null;
      this.visibleTextareaEnd = null;
    }
  }
  definePresentation(tokenPresentation) {
    if (!this._previousPresentation) {
      if (tokenPresentation) {
        this._previousPresentation = tokenPresentation;
      } else {
        this._previousPresentation = {
          foreground: ColorId.DefaultForeground,
          italic: false,
          bold: false,
          underline: false,
          strikethrough: false
        };
      }
    }
    return this._previousPresentation;
  }
}
const canUseZeroSizeTextarea = browser.isFirefox;
let TextAreaEditContext = class extends AbstractEditContext {
  constructor(context, overflowGuardContainer, viewController, visibleRangeProvider, _keybindingService, _instantiationService) {
    super(context);
    this._keybindingService = _keybindingService;
    this._instantiationService = _instantiationService;
    this._primaryCursorPosition = new Position(1, 1);
    this._primaryCursorVisibleRange = null;
    this._viewController = viewController;
    this._visibleRangeProvider = visibleRangeProvider;
    this._scrollLeft = 0;
    this._scrollTop = 0;
    const options = this._context.configuration.options;
    const layoutInfo = options.get(EditorOption.layoutInfo);
    this._setAccessibilityOptions(options);
    this._contentLeft = layoutInfo.contentLeft;
    this._contentWidth = layoutInfo.contentWidth;
    this._contentHeight = layoutInfo.height;
    this._fontInfo = options.get(EditorOption.fontInfo);
    this._lineHeight = options.get(EditorOption.lineHeight);
    this._emptySelectionClipboard = options.get(EditorOption.emptySelectionClipboard);
    this._copyWithSyntaxHighlighting = options.get(EditorOption.copyWithSyntaxHighlighting);
    this._visibleTextArea = null;
    this._selections = [new Selection(1, 1, 1, 1)];
    this._modelSelections = [new Selection(1, 1, 1, 1)];
    this._lastRenderPosition = null;
    this.textArea = createFastDomNode(document.createElement("textarea"));
    PartFingerprints.write(this.textArea, PartFingerprint.TextArea);
    this.textArea.setClassName(`inputarea ${MOUSE_CURSOR_TEXT_CSS_CLASS_NAME}`);
    this.textArea.setAttribute("wrap", this._textAreaWrapping && !this._visibleTextArea ? "on" : "off");
    const { tabSize } = this._context.viewModel.model.getOptions();
    this.textArea.domNode.style.tabSize = `${tabSize * this._fontInfo.spaceWidth}px`;
    this.textArea.setAttribute("autocorrect", "off");
    this.textArea.setAttribute("autocapitalize", "off");
    this.textArea.setAttribute("autocomplete", "off");
    this.textArea.setAttribute("spellcheck", "false");
    this.textArea.setAttribute("aria-label", ariaLabelForScreenReaderContent(options, this._keybindingService));
    this.textArea.setAttribute("aria-required", options.get(EditorOption.ariaRequired) ? "true" : "false");
    this.textArea.setAttribute("tabindex", String(options.get(EditorOption.tabIndex)));
    this.textArea.setAttribute("role", "textbox");
    this.textArea.setAttribute("aria-roledescription", nls.localize("editor", "editor"));
    this.textArea.setAttribute("aria-multiline", "true");
    this.textArea.setAttribute("aria-autocomplete", options.get(EditorOption.readOnly) ? "none" : "both");
    this._ensureReadOnlyAttribute();
    this.textAreaCover = createFastDomNode(document.createElement("div"));
    this.textAreaCover.setPosition("absolute");
    overflowGuardContainer.appendChild(this.textArea);
    overflowGuardContainer.appendChild(this.textAreaCover);
    const simpleModel = {
      getLineCount: () => {
        return this._context.viewModel.getLineCount();
      },
      getLineMaxColumn: (lineNumber) => {
        return this._context.viewModel.getLineMaxColumn(lineNumber);
      },
      getValueInRange: (range, eol) => {
        return this._context.viewModel.getValueInRange(range, eol);
      },
      getValueLengthInRange: (range, eol) => {
        return this._context.viewModel.getValueLengthInRange(range, eol);
      },
      modifyPosition: (position, offset) => {
        return this._context.viewModel.modifyPosition(position, offset);
      }
    };
    const textAreaInputHost = {
      getDataToCopy: () => {
        return getDataToCopy(this._context.viewModel, this._modelSelections, this._emptySelectionClipboard, this._copyWithSyntaxHighlighting);
      },
      getScreenReaderContent: () => {
        if (this._accessibilitySupport === AccessibilitySupport.Disabled) {
          const selection = this._selections[0];
          if (platform.isMacintosh && selection.isEmpty()) {
            const position = selection.getStartPosition();
            let textBefore = this._getWordBeforePosition(position);
            if (textBefore.length === 0) {
              textBefore = this._getCharacterBeforePosition(position);
            }
            if (textBefore.length > 0) {
              return new TextAreaState(textBefore, textBefore.length, textBefore.length, Range.fromPositions(position), 0);
            }
          }
          const LIMIT_CHARS = 500;
          if (platform.isMacintosh && !selection.isEmpty() && simpleModel.getValueLengthInRange(selection, EndOfLinePreference.TextDefined) < LIMIT_CHARS) {
            const text = simpleModel.getValueInRange(selection, EndOfLinePreference.TextDefined);
            return new TextAreaState(text, 0, text.length, selection, 0);
          }
          if (browser.isSafari && !selection.isEmpty()) {
            const placeholderText = "vscode-placeholder";
            return new TextAreaState(placeholderText, 0, placeholderText.length, null, void 0);
          }
          return TextAreaState.EMPTY;
        }
        if (browser.isAndroid) {
          const selection = this._selections[0];
          if (selection.isEmpty()) {
            const position = selection.getStartPosition();
            const [wordAtPosition, positionOffsetInWord] = this._getAndroidWordAtPosition(position);
            if (wordAtPosition.length > 0) {
              return new TextAreaState(wordAtPosition, positionOffsetInWord, positionOffsetInWord, Range.fromPositions(position), 0);
            }
          }
          return TextAreaState.EMPTY;
        }
        const screenReaderContentState = PagedScreenReaderStrategy.fromEditorSelection(simpleModel, this._selections[0], this._accessibilityPageSize, this._accessibilitySupport === AccessibilitySupport.Unknown);
        return TextAreaState.fromScreenReaderContentState(screenReaderContentState);
      },
      deduceModelPosition: (viewAnchorPosition, deltaOffset, lineFeedCnt) => {
        return this._context.viewModel.deduceModelPositionRelativeToViewPosition(viewAnchorPosition, deltaOffset, lineFeedCnt);
      }
    };
    const textAreaWrapper = this._register(new TextAreaWrapper(this.textArea.domNode));
    this._textAreaInput = this._register(this._instantiationService.createInstance(TextAreaInput, textAreaInputHost, textAreaWrapper, platform.OS, {
      isAndroid: browser.isAndroid,
      isChrome: browser.isChrome,
      isFirefox: browser.isFirefox,
      isSafari: browser.isSafari
    }));
    this._register(this._textAreaInput.onKeyDown((e) => {
      this._viewController.emitKeyDown(e);
    }));
    this._register(this._textAreaInput.onKeyUp((e) => {
      this._viewController.emitKeyUp(e);
    }));
    this._register(this._textAreaInput.onPaste((e) => {
      let pasteOnNewLine = false;
      let multicursorText = null;
      let mode = null;
      if (e.metadata) {
        pasteOnNewLine = this._emptySelectionClipboard && !!e.metadata.isFromEmptySelection;
        multicursorText = typeof e.metadata.multicursorText !== "undefined" ? e.metadata.multicursorText : null;
        mode = e.metadata.mode;
      }
      this._viewController.paste(e.text, pasteOnNewLine, multicursorText, mode);
    }));
    this._register(this._textAreaInput.onCut(() => {
      this._viewController.cut();
    }));
    this._register(this._textAreaInput.onType((e) => {
      if (e.replacePrevCharCnt || e.replaceNextCharCnt || e.positionDelta) {
        if (_debugComposition) {
          console.log(` => compositionType: <<${e.text}>>, ${e.replacePrevCharCnt}, ${e.replaceNextCharCnt}, ${e.positionDelta}`);
        }
        this._viewController.compositionType(e.text, e.replacePrevCharCnt, e.replaceNextCharCnt, e.positionDelta);
      } else {
        if (_debugComposition) {
          console.log(` => type: <<${e.text}>>`);
        }
        this._viewController.type(e.text);
      }
    }));
    this._register(this._textAreaInput.onSelectionChangeRequest((modelSelection) => {
      this._viewController.setSelection(modelSelection);
    }));
    this._register(this._textAreaInput.onCompositionStart((e) => {
      const ta = this.textArea.domNode;
      const modelSelection = this._modelSelections[0];
      const { distanceToModelLineStart, widthOfHiddenTextBefore } = (() => {
        const textBeforeSelection = ta.value.substring(0, Math.min(ta.selectionStart, ta.selectionEnd));
        const lineFeedOffset1 = textBeforeSelection.lastIndexOf("\n");
        const lineTextBeforeSelection = textBeforeSelection.substring(lineFeedOffset1 + 1);
        const tabOffset1 = lineTextBeforeSelection.lastIndexOf("	");
        const desiredVisibleBeforeCharCount = lineTextBeforeSelection.length - tabOffset1 - 1;
        const startModelPosition = modelSelection.getStartPosition();
        const visibleBeforeCharCount = Math.min(startModelPosition.column - 1, desiredVisibleBeforeCharCount);
        const distanceToModelLineStart2 = startModelPosition.column - 1 - visibleBeforeCharCount;
        const hiddenLineTextBefore = lineTextBeforeSelection.substring(0, lineTextBeforeSelection.length - visibleBeforeCharCount);
        const { tabSize: tabSize2 } = this._context.viewModel.model.getOptions();
        const widthOfHiddenTextBefore2 = measureText(this.textArea.domNode.ownerDocument, hiddenLineTextBefore, this._fontInfo, tabSize2);
        return { distanceToModelLineStart: distanceToModelLineStart2, widthOfHiddenTextBefore: widthOfHiddenTextBefore2 };
      })();
      const { distanceToModelLineEnd } = (() => {
        const textAfterSelection = ta.value.substring(Math.max(ta.selectionStart, ta.selectionEnd));
        const lineFeedOffset2 = textAfterSelection.indexOf("\n");
        const lineTextAfterSelection = lineFeedOffset2 === -1 ? textAfterSelection : textAfterSelection.substring(0, lineFeedOffset2);
        const tabOffset2 = lineTextAfterSelection.indexOf("	");
        const desiredVisibleAfterCharCount = tabOffset2 === -1 ? lineTextAfterSelection.length : lineTextAfterSelection.length - tabOffset2 - 1;
        const endModelPosition = modelSelection.getEndPosition();
        const visibleAfterCharCount = Math.min(this._context.viewModel.model.getLineMaxColumn(endModelPosition.lineNumber) - endModelPosition.column, desiredVisibleAfterCharCount);
        const distanceToModelLineEnd2 = this._context.viewModel.model.getLineMaxColumn(endModelPosition.lineNumber) - endModelPosition.column - visibleAfterCharCount;
        return { distanceToModelLineEnd: distanceToModelLineEnd2 };
      })();
      this._context.viewModel.revealRange(
        "keyboard",
        true,
        Range.fromPositions(this._selections[0].getStartPosition()),
        viewEvents.VerticalRevealType.Simple,
        ScrollType.Immediate
      );
      this._visibleTextArea = new VisibleTextAreaData(
        this._context,
        modelSelection.startLineNumber,
        distanceToModelLineStart,
        widthOfHiddenTextBefore,
        distanceToModelLineEnd
      );
      this.textArea.setAttribute("wrap", this._textAreaWrapping && !this._visibleTextArea ? "on" : "off");
      this._visibleTextArea.prepareRender(this._visibleRangeProvider);
      this._render();
      this.textArea.setClassName(`inputarea ${MOUSE_CURSOR_TEXT_CSS_CLASS_NAME} ime-input`);
      this._viewController.compositionStart();
      this._context.viewModel.onCompositionStart();
    }));
    this._register(this._textAreaInput.onCompositionUpdate((e) => {
      if (!this._visibleTextArea) {
        return;
      }
      this._visibleTextArea.prepareRender(this._visibleRangeProvider);
      this._render();
    }));
    this._register(this._textAreaInput.onCompositionEnd(() => {
      this._visibleTextArea = null;
      this.textArea.setAttribute("wrap", this._textAreaWrapping && !this._visibleTextArea ? "on" : "off");
      this._render();
      this.textArea.setClassName(`inputarea ${MOUSE_CURSOR_TEXT_CSS_CLASS_NAME}`);
      this._viewController.compositionEnd();
      this._context.viewModel.onCompositionEnd();
    }));
    this._register(this._textAreaInput.onFocus(() => {
      this._context.viewModel.setHasFocus(true);
    }));
    this._register(this._textAreaInput.onBlur(() => {
      this._context.viewModel.setHasFocus(false);
    }));
    this._register(IME.onDidChange(() => {
      this._ensureReadOnlyAttribute();
    }));
  }
  get domNode() {
    return this.textArea;
  }
  writeScreenReaderContent(reason) {
    this._textAreaInput.writeNativeTextAreaContent(reason);
  }
  getTextAreaDomNode() {
    return this.textArea.domNode;
  }
  dispose() {
    super.dispose();
    this.textArea.domNode.remove();
    this.textAreaCover.domNode.remove();
  }
  _getAndroidWordAtPosition(position) {
    const ANDROID_WORD_SEPARATORS = '`~!@#$%^&*()-=+[{]}\\|;:",.<>/?';
    const lineContent = this._context.viewModel.getLineContent(position.lineNumber);
    const wordSeparators = getMapForWordSeparators(ANDROID_WORD_SEPARATORS, []);
    let goingLeft = true;
    let startColumn = position.column;
    let goingRight = true;
    let endColumn = position.column;
    let distance = 0;
    while (distance < 50 && (goingLeft || goingRight)) {
      if (goingLeft && startColumn <= 1) {
        goingLeft = false;
      }
      if (goingLeft) {
        const charCode = lineContent.charCodeAt(startColumn - 2);
        const charClass = wordSeparators.get(charCode);
        if (charClass !== WordCharacterClass.Regular) {
          goingLeft = false;
        } else {
          startColumn--;
        }
      }
      if (goingRight && endColumn > lineContent.length) {
        goingRight = false;
      }
      if (goingRight) {
        const charCode = lineContent.charCodeAt(endColumn - 1);
        const charClass = wordSeparators.get(charCode);
        if (charClass !== WordCharacterClass.Regular) {
          goingRight = false;
        } else {
          endColumn++;
        }
      }
      distance++;
    }
    return [lineContent.substring(startColumn - 1, endColumn - 1), position.column - startColumn];
  }
  _getWordBeforePosition(position) {
    const lineContent = this._context.viewModel.getLineContent(position.lineNumber);
    const wordSeparators = getMapForWordSeparators(this._context.configuration.options.get(EditorOption.wordSeparators), []);
    let column = position.column;
    let distance = 0;
    while (column > 1) {
      const charCode = lineContent.charCodeAt(column - 2);
      const charClass = wordSeparators.get(charCode);
      if (charClass !== WordCharacterClass.Regular || distance > 50) {
        return lineContent.substring(column - 1, position.column - 1);
      }
      distance++;
      column--;
    }
    return lineContent.substring(0, position.column - 1);
  }
  _getCharacterBeforePosition(position) {
    if (position.column > 1) {
      const lineContent = this._context.viewModel.getLineContent(position.lineNumber);
      const charBefore = lineContent.charAt(position.column - 2);
      if (!strings.isHighSurrogate(charBefore.charCodeAt(0))) {
        return charBefore;
      }
    }
    return "";
  }
  _setAccessibilityOptions(options) {
    this._accessibilitySupport = options.get(EditorOption.accessibilitySupport);
    const accessibilityPageSize = options.get(EditorOption.accessibilityPageSize);
    if (this._accessibilitySupport === AccessibilitySupport.Enabled && accessibilityPageSize === EditorOptions.accessibilityPageSize.defaultValue) {
      this._accessibilityPageSize = 500;
    } else {
      this._accessibilityPageSize = accessibilityPageSize;
    }
    const layoutInfo = options.get(EditorOption.layoutInfo);
    const wrappingColumn = layoutInfo.wrappingColumn;
    if (wrappingColumn !== -1 && this._accessibilitySupport !== AccessibilitySupport.Disabled) {
      const fontInfo = options.get(EditorOption.fontInfo);
      this._textAreaWrapping = true;
      this._textAreaWidth = Math.round(wrappingColumn * fontInfo.typicalHalfwidthCharacterWidth);
    } else {
      this._textAreaWrapping = false;
      this._textAreaWidth = canUseZeroSizeTextarea ? 0 : 1;
    }
  }
  // --- begin event handlers
  onConfigurationChanged(e) {
    const options = this._context.configuration.options;
    const layoutInfo = options.get(EditorOption.layoutInfo);
    this._setAccessibilityOptions(options);
    this._contentLeft = layoutInfo.contentLeft;
    this._contentWidth = layoutInfo.contentWidth;
    this._contentHeight = layoutInfo.height;
    this._fontInfo = options.get(EditorOption.fontInfo);
    this._lineHeight = options.get(EditorOption.lineHeight);
    this._emptySelectionClipboard = options.get(EditorOption.emptySelectionClipboard);
    this._copyWithSyntaxHighlighting = options.get(EditorOption.copyWithSyntaxHighlighting);
    this.textArea.setAttribute("wrap", this._textAreaWrapping && !this._visibleTextArea ? "on" : "off");
    const { tabSize } = this._context.viewModel.model.getOptions();
    this.textArea.domNode.style.tabSize = `${tabSize * this._fontInfo.spaceWidth}px`;
    this.textArea.setAttribute("aria-label", ariaLabelForScreenReaderContent(options, this._keybindingService));
    this.textArea.setAttribute("aria-required", options.get(EditorOption.ariaRequired) ? "true" : "false");
    this.textArea.setAttribute("tabindex", String(options.get(EditorOption.tabIndex)));
    if (e.hasChanged(EditorOption.domReadOnly) || e.hasChanged(EditorOption.readOnly)) {
      this._ensureReadOnlyAttribute();
    }
    if (e.hasChanged(EditorOption.accessibilitySupport)) {
      this._textAreaInput.writeNativeTextAreaContent("strategy changed");
    }
    return true;
  }
  onCursorStateChanged(e) {
    this._selections = e.selections.slice(0);
    this._modelSelections = e.modelSelections.slice(0);
    this._textAreaInput.writeNativeTextAreaContent("selection changed");
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
  // --- end event handlers
  // --- begin view API
  isFocused() {
    return this._textAreaInput.isFocused();
  }
  focus() {
    this._textAreaInput.focusTextArea();
  }
  refreshFocusState() {
    this._textAreaInput.refreshFocusState();
  }
  getLastRenderData() {
    return this._lastRenderPosition;
  }
  setAriaOptions(options) {
    if (options.activeDescendant) {
      this.textArea.setAttribute("aria-haspopup", "true");
      this.textArea.setAttribute("aria-autocomplete", "list");
      this.textArea.setAttribute("aria-activedescendant", options.activeDescendant);
    } else {
      this.textArea.setAttribute("aria-haspopup", "false");
      this.textArea.setAttribute("aria-autocomplete", "both");
      this.textArea.removeAttribute("aria-activedescendant");
    }
    if (options.role) {
      this.textArea.setAttribute("role", options.role);
    }
  }
  // --- end view API
  _ensureReadOnlyAttribute() {
    const options = this._context.configuration.options;
    const useReadOnly = !IME.enabled || options.get(EditorOption.domReadOnly) && options.get(EditorOption.readOnly);
    if (useReadOnly) {
      this.textArea.setAttribute("readonly", "true");
    } else {
      this.textArea.removeAttribute("readonly");
    }
  }
  prepareRender(ctx) {
    this._primaryCursorPosition = new Position(this._selections[0].positionLineNumber, this._selections[0].positionColumn);
    this._primaryCursorVisibleRange = ctx.visibleRangeForPosition(this._primaryCursorPosition);
    this._visibleTextArea?.prepareRender(ctx);
  }
  render(ctx) {
    this._textAreaInput.writeNativeTextAreaContent("render");
    this._render();
  }
  _render() {
    if (this._visibleTextArea) {
      const visibleStart = this._visibleTextArea.visibleTextareaStart;
      const visibleEnd = this._visibleTextArea.visibleTextareaEnd;
      const startPosition = this._visibleTextArea.startPosition;
      const endPosition = this._visibleTextArea.endPosition;
      if (startPosition && endPosition && visibleStart && visibleEnd && visibleEnd.left >= this._scrollLeft && visibleStart.left <= this._scrollLeft + this._contentWidth) {
        const top2 = this._context.viewLayout.getVerticalOffsetForLineNumber(this._primaryCursorPosition.lineNumber) - this._scrollTop;
        const lineCount = newlinecount(this.textArea.domNode.value.substr(0, this.textArea.domNode.selectionStart));
        let scrollLeft = this._visibleTextArea.widthOfHiddenLineTextBefore;
        let left2 = this._contentLeft + visibleStart.left - this._scrollLeft;
        let width = visibleEnd.left - visibleStart.left + 1;
        if (left2 < this._contentLeft) {
          const delta = this._contentLeft - left2;
          left2 += delta;
          scrollLeft += delta;
          width -= delta;
        }
        if (width > this._contentWidth) {
          width = this._contentWidth;
        }
        const viewLineData = this._context.viewModel.getViewLineData(startPosition.lineNumber);
        const startTokenIndex = viewLineData.tokens.findTokenIndexAtOffset(startPosition.column - 1);
        const endTokenIndex = viewLineData.tokens.findTokenIndexAtOffset(endPosition.column - 1);
        const textareaSpansSingleToken = startTokenIndex === endTokenIndex;
        const presentation = this._visibleTextArea.definePresentation(
          textareaSpansSingleToken ? viewLineData.tokens.getPresentation(startTokenIndex) : null
        );
        this.textArea.domNode.scrollTop = lineCount * this._lineHeight;
        this.textArea.domNode.scrollLeft = scrollLeft;
        this._doRender({
          lastRenderPosition: null,
          top: top2,
          left: left2,
          width,
          height: this._lineHeight,
          useCover: false,
          color: (TokenizationRegistry.getColorMap() || [])[presentation.foreground],
          italic: presentation.italic,
          bold: presentation.bold,
          underline: presentation.underline,
          strikethrough: presentation.strikethrough
        });
      }
      return;
    }
    if (!this._primaryCursorVisibleRange) {
      this._renderAtTopLeft();
      return;
    }
    const left = this._contentLeft + this._primaryCursorVisibleRange.left - this._scrollLeft;
    if (left < this._contentLeft || left > this._contentLeft + this._contentWidth) {
      this._renderAtTopLeft();
      return;
    }
    const top = this._context.viewLayout.getVerticalOffsetForLineNumber(this._selections[0].positionLineNumber) - this._scrollTop;
    if (top < 0 || top > this._contentHeight) {
      this._renderAtTopLeft();
      return;
    }
    if (platform.isMacintosh || this._accessibilitySupport === AccessibilitySupport.Enabled) {
      this._doRender({
        lastRenderPosition: this._primaryCursorPosition,
        top,
        left: this._textAreaWrapping ? this._contentLeft : left,
        width: this._textAreaWidth,
        height: this._lineHeight,
        useCover: false
      });
      this.textArea.domNode.scrollLeft = this._primaryCursorVisibleRange.left;
      const lineCount = this._textAreaInput.textAreaState.newlineCountBeforeSelection ?? newlinecount(this.textArea.domNode.value.substring(0, this.textArea.domNode.selectionStart));
      this.textArea.domNode.scrollTop = lineCount * this._lineHeight;
      return;
    }
    this._doRender({
      lastRenderPosition: this._primaryCursorPosition,
      top,
      left: this._textAreaWrapping ? this._contentLeft : left,
      width: this._textAreaWidth,
      height: canUseZeroSizeTextarea ? 0 : 1,
      useCover: false
    });
  }
  _renderAtTopLeft() {
    this._doRender({
      lastRenderPosition: null,
      top: 0,
      left: 0,
      width: this._textAreaWidth,
      height: canUseZeroSizeTextarea ? 0 : 1,
      useCover: true
    });
  }
  _doRender(renderData) {
    this._lastRenderPosition = renderData.lastRenderPosition;
    const ta = this.textArea;
    const tac = this.textAreaCover;
    applyFontInfo(ta, this._fontInfo);
    ta.setTop(renderData.top);
    ta.setLeft(renderData.left);
    ta.setWidth(renderData.width);
    ta.setHeight(renderData.height);
    ta.setColor(renderData.color ? Color.Format.CSS.formatHex(renderData.color) : "");
    ta.setFontStyle(renderData.italic ? "italic" : "");
    if (renderData.bold) {
      ta.setFontWeight("bold");
    }
    ta.setTextDecoration(`${renderData.underline ? " underline" : ""}${renderData.strikethrough ? " line-through" : ""}`);
    tac.setTop(renderData.useCover ? renderData.top : 0);
    tac.setLeft(renderData.useCover ? renderData.left : 0);
    tac.setWidth(renderData.useCover ? renderData.width : 0);
    tac.setHeight(renderData.useCover ? renderData.height : 0);
    const options = this._context.configuration.options;
    if (options.get(EditorOption.glyphMargin)) {
      tac.setClassName("monaco-editor-background textAreaCover " + Margin.OUTER_CLASS_NAME);
    } else {
      if (options.get(EditorOption.lineNumbers).renderType !== RenderLineNumbersType.Off) {
        tac.setClassName("monaco-editor-background textAreaCover " + LineNumbersOverlay.CLASS_NAME);
      } else {
        tac.setClassName("monaco-editor-background textAreaCover");
      }
    }
  }
};
TextAreaEditContext = __decorateClass([
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IInstantiationService)
], TextAreaEditContext);
function measureText(targetDocument, text, fontInfo, tabSize) {
  if (text.length === 0) {
    return 0;
  }
  const container = targetDocument.createElement("div");
  container.style.position = "absolute";
  container.style.top = "-50000px";
  container.style.width = "50000px";
  const regularDomNode = targetDocument.createElement("span");
  applyFontInfo(regularDomNode, fontInfo);
  regularDomNode.style.whiteSpace = "pre";
  regularDomNode.style.tabSize = `${tabSize * fontInfo.spaceWidth}px`;
  regularDomNode.append(text);
  container.appendChild(regularDomNode);
  targetDocument.body.appendChild(container);
  const res = regularDomNode.offsetWidth;
  container.remove();
  return res;
}
export {
  TextAreaEditContext
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci9jb250cm9sbGVyL2VkaXRDb250ZXh0L3RleHRBcmVhL3RleHRBcmVhRWRpdENvbnRleHQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgJy4vdGV4dEFyZWFFZGl0Q29udGV4dC5jc3MnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgKiBhcyBicm93c2VyIGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9icm93c2VyLmpzJztcbmltcG9ydCB7IEZhc3REb21Ob2RlLCBjcmVhdGVGYXN0RG9tTm9kZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9mYXN0RG9tTm9kZS5qcyc7XG5pbXBvcnQgeyBJS2V5Ym9hcmRFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9rZXlib2FyZEV2ZW50LmpzJztcbmltcG9ydCAqIGFzIHBsYXRmb3JtIGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCAqIGFzIHN0cmluZ3MgZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBhcHBseUZvbnRJbmZvIH0gZnJvbSAnLi4vLi4vLi4vY29uZmlnL2RvbUZvbnRJbmZvLmpzJztcbmltcG9ydCB7IFZpZXdDb250cm9sbGVyIH0gZnJvbSAnLi4vLi4vLi4vdmlldy92aWV3Q29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyBQYXJ0RmluZ2VycHJpbnQsIFBhcnRGaW5nZXJwcmludHMgfSBmcm9tICcuLi8uLi8uLi92aWV3L3ZpZXdQYXJ0LmpzJztcbmltcG9ydCB7IExpbmVOdW1iZXJzT3ZlcmxheSB9IGZyb20gJy4uLy4uLy4uL3ZpZXdQYXJ0cy9saW5lTnVtYmVycy9saW5lTnVtYmVycy5qcyc7XG5pbXBvcnQgeyBNYXJnaW4gfSBmcm9tICcuLi8uLi8uLi92aWV3UGFydHMvbWFyZ2luL21hcmdpbi5qcyc7XG5pbXBvcnQgeyBSZW5kZXJMaW5lTnVtYmVyc1R5cGUsIEVkaXRvck9wdGlvbiwgSUNvbXB1dGVkRWRpdG9yT3B0aW9ucywgRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBGb250SW5mbyB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb25maWcvZm9udEluZm8uanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IFNlbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBTY3JvbGxUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBFbmRPZkxpbmVQcmVmZXJlbmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IFJlbmRlcmluZ0NvbnRleHQsIFJlc3RyaWN0ZWRSZW5kZXJpbmdDb250ZXh0LCBIb3Jpem9udGFsUG9zaXRpb24sIExpbmVWaXNpYmxlUmFuZ2VzIH0gZnJvbSAnLi4vLi4vLi4vdmlldy9yZW5kZXJpbmdDb250ZXh0LmpzJztcbmltcG9ydCB7IFZpZXdDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3ZpZXdNb2RlbC92aWV3Q29udGV4dC5qcyc7XG5pbXBvcnQgKiBhcyB2aWV3RXZlbnRzIGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi92aWV3RXZlbnRzLmpzJztcbmltcG9ydCB7IEFjY2Vzc2liaWxpdHlTdXBwb3J0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eS9jb21tb24vYWNjZXNzaWJpbGl0eS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yQXJpYU9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IE1PVVNFX0NVUlNPUl9URVhUX0NTU19DTEFTU19OQU1FIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL21vdXNlQ3Vyc29yL21vdXNlQ3Vyc29yLmpzJztcbmltcG9ydCB7IFRva2VuaXphdGlvblJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBDb2xvcklkLCBJVG9rZW5QcmVzZW50YXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vZW5jb2RlZFRva2VuQXR0cmlidXRlcy5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbG9yLmpzJztcbmltcG9ydCB7IElNRSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2ltZS5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgQWJzdHJhY3RFZGl0Q29udGV4dCB9IGZyb20gJy4uL2VkaXRDb250ZXh0LmpzJztcbmltcG9ydCB7IElDb21wb3NpdGlvbkRhdGEsIElQYXN0ZURhdGEsIElUZXh0QXJlYUlucHV0SG9zdCwgVGV4dEFyZWFJbnB1dCwgVGV4dEFyZWFXcmFwcGVyIH0gZnJvbSAnLi90ZXh0QXJlYUVkaXRDb250ZXh0SW5wdXQuanMnO1xuaW1wb3J0IHsgYXJpYUxhYmVsRm9yU2NyZWVuUmVhZGVyQ29udGVudCwgSVNpbXBsZU1vZGVsLCBuZXdsaW5lY291bnQsIFBhZ2VkU2NyZWVuUmVhZGVyU3RyYXRlZ3kgfSBmcm9tICcuLi9zY3JlZW5SZWFkZXJVdGlscy5qcyc7XG5pbXBvcnQgeyBDbGlwYm9hcmREYXRhVG9Db3B5LCBnZXREYXRhVG9Db3B5IH0gZnJvbSAnLi4vY2xpcGJvYXJkVXRpbHMuanMnO1xuaW1wb3J0IHsgX2RlYnVnQ29tcG9zaXRpb24sIElUeXBlRGF0YSwgVGV4dEFyZWFTdGF0ZSB9IGZyb20gJy4vdGV4dEFyZWFFZGl0Q29udGV4dFN0YXRlLmpzJztcbmltcG9ydCB7IGdldE1hcEZvcldvcmRTZXBhcmF0b3JzLCBXb3JkQ2hhcmFjdGVyQ2xhc3MgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS93b3JkQ2hhcmFjdGVyQ2xhc3NpZmllci5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVZpc2libGVSYW5nZVByb3ZpZGVyIHtcblx0dmlzaWJsZVJhbmdlRm9yUG9zaXRpb24ocG9zaXRpb246IFBvc2l0aW9uKTogSG9yaXpvbnRhbFBvc2l0aW9uIHwgbnVsbDtcblx0bGluZXNWaXNpYmxlUmFuZ2VzRm9yUmFuZ2UocmFuZ2U6IFJhbmdlLCBpbmNsdWRlTmV3TGluZXM6IGJvb2xlYW4pOiBMaW5lVmlzaWJsZVJhbmdlc1tdIHwgbnVsbDtcbn1cblxuY2xhc3MgVmlzaWJsZVRleHRBcmVhRGF0YSB7XG5cdF92aXNpYmxlVGV4dEFyZWFCcmFuZDogdm9pZCA9IHVuZGVmaW5lZDtcblxuXHRwdWJsaWMgc3RhcnRQb3NpdGlvbjogUG9zaXRpb24gfCBudWxsID0gbnVsbDtcblx0cHVibGljIGVuZFBvc2l0aW9uOiBQb3NpdGlvbiB8IG51bGwgPSBudWxsO1xuXG5cdHB1YmxpYyB2aXNpYmxlVGV4dGFyZWFTdGFydDogSG9yaXpvbnRhbFBvc2l0aW9uIHwgbnVsbCA9IG51bGw7XG5cdHB1YmxpYyB2aXNpYmxlVGV4dGFyZWFFbmQ6IEhvcml6b250YWxQb3NpdGlvbiB8IG51bGwgPSBudWxsO1xuXG5cdC8qKlxuXHQgKiBXaGVuIGRvaW5nIGNvbXBvc2l0aW9uLCB0aGUgY3VycmVudGx5IGNvbXBvc2VkIHRleHQgbWlnaHQgYmUgc3BsaXQgdXAgaW50b1xuXHQgKiBtdWx0aXBsZSB0b2tlbnMsIHRoZW4gbWVyZ2VkIGFnYWluIGludG8gYSBzaW5nbGUgdG9rZW4sIGV0Yy4gSGVyZSB3ZSBhdHRlbXB0XG5cdCAqIHRvIGtlZXAgdGhlIHByZXNlbnRhdGlvbiBvZiB0aGUgPHRleHRhcmVhPiBzdGFibGUgYnkgdXNpbmcgdGhlIHByZXZpb3VzIHVzZWRcblx0ICogc3R5bGUgaWYgbXVsdGlwbGUgdG9rZW5zIGNvbWUgaW50byBwbGF5LiBUaGlzIGF2b2lkcyBmbGlja2VyaW5nLlxuXHQgKi9cblx0cHJpdmF0ZSBfcHJldmlvdXNQcmVzZW50YXRpb246IElUb2tlblByZXNlbnRhdGlvbiB8IG51bGwgPSBudWxsO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2NvbnRleHQ6IFZpZXdDb250ZXh0LFxuXHRcdHB1YmxpYyByZWFkb25seSBtb2RlbExpbmVOdW1iZXI6IG51bWJlcixcblx0XHRwdWJsaWMgcmVhZG9ubHkgZGlzdGFuY2VUb01vZGVsTGluZVN0YXJ0OiBudW1iZXIsXG5cdFx0cHVibGljIHJlYWRvbmx5IHdpZHRoT2ZIaWRkZW5MaW5lVGV4dEJlZm9yZTogbnVtYmVyLFxuXHRcdHB1YmxpYyByZWFkb25seSBkaXN0YW5jZVRvTW9kZWxMaW5lRW5kOiBudW1iZXIsXG5cdCkge1xuXHR9XG5cblx0cHJlcGFyZVJlbmRlcih2aXNpYmxlUmFuZ2VQcm92aWRlcjogSVZpc2libGVSYW5nZVByb3ZpZGVyKTogdm9pZCB7XG5cdFx0Y29uc3Qgc3RhcnRNb2RlbFBvc2l0aW9uID0gbmV3IFBvc2l0aW9uKHRoaXMubW9kZWxMaW5lTnVtYmVyLCB0aGlzLmRpc3RhbmNlVG9Nb2RlbExpbmVTdGFydCArIDEpO1xuXHRcdGNvbnN0IGVuZE1vZGVsUG9zaXRpb24gPSBuZXcgUG9zaXRpb24odGhpcy5tb2RlbExpbmVOdW1iZXIsIHRoaXMuX2NvbnRleHQudmlld01vZGVsLm1vZGVsLmdldExpbmVNYXhDb2x1bW4odGhpcy5tb2RlbExpbmVOdW1iZXIpIC0gdGhpcy5kaXN0YW5jZVRvTW9kZWxMaW5lRW5kKTtcblxuXHRcdHRoaXMuc3RhcnRQb3NpdGlvbiA9IHRoaXMuX2NvbnRleHQudmlld01vZGVsLmNvb3JkaW5hdGVzQ29udmVydGVyLmNvbnZlcnRNb2RlbFBvc2l0aW9uVG9WaWV3UG9zaXRpb24oc3RhcnRNb2RlbFBvc2l0aW9uKTtcblx0XHR0aGlzLmVuZFBvc2l0aW9uID0gdGhpcy5fY29udGV4dC52aWV3TW9kZWwuY29vcmRpbmF0ZXNDb252ZXJ0ZXIuY29udmVydE1vZGVsUG9zaXRpb25Ub1ZpZXdQb3NpdGlvbihlbmRNb2RlbFBvc2l0aW9uKTtcblxuXHRcdGlmICh0aGlzLnN0YXJ0UG9zaXRpb24ubGluZU51bWJlciA9PT0gdGhpcy5lbmRQb3NpdGlvbi5saW5lTnVtYmVyKSB7XG5cdFx0XHR0aGlzLnZpc2libGVUZXh0YXJlYVN0YXJ0ID0gdmlzaWJsZVJhbmdlUHJvdmlkZXIudmlzaWJsZVJhbmdlRm9yUG9zaXRpb24odGhpcy5zdGFydFBvc2l0aW9uKTtcblx0XHRcdHRoaXMudmlzaWJsZVRleHRhcmVhRW5kID0gdmlzaWJsZVJhbmdlUHJvdmlkZXIudmlzaWJsZVJhbmdlRm9yUG9zaXRpb24odGhpcy5lbmRQb3NpdGlvbik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIFRPRE86IHdoYXQgaWYgdGhlIHZpZXcgcG9zaXRpb25zIGFyZSBub3Qgb24gdGhlIHNhbWUgbGluZT9cblx0XHRcdHRoaXMudmlzaWJsZVRleHRhcmVhU3RhcnQgPSBudWxsO1xuXHRcdFx0dGhpcy52aXNpYmxlVGV4dGFyZWFFbmQgPSBudWxsO1xuXHRcdH1cblx0fVxuXG5cdGRlZmluZVByZXNlbnRhdGlvbih0b2tlblByZXNlbnRhdGlvbjogSVRva2VuUHJlc2VudGF0aW9uIHwgbnVsbCk6IElUb2tlblByZXNlbnRhdGlvbiB7XG5cdFx0aWYgKCF0aGlzLl9wcmV2aW91c1ByZXNlbnRhdGlvbikge1xuXHRcdFx0Ly8gVG8gYXZvaWQgZmxpY2tlcmluZywgb25jZSBzZXQsIGFsd2F5cyByZXVzZSBhIHByZXNlbnRhdGlvbiB0aHJvdWdob3V0IHRoZSBlbnRpcmUgSU1FIHNlc3Npb25cblx0XHRcdGlmICh0b2tlblByZXNlbnRhdGlvbikge1xuXHRcdFx0XHR0aGlzLl9wcmV2aW91c1ByZXNlbnRhdGlvbiA9IHRva2VuUHJlc2VudGF0aW9uO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fcHJldmlvdXNQcmVzZW50YXRpb24gPSB7XG5cdFx0XHRcdFx0Zm9yZWdyb3VuZDogQ29sb3JJZC5EZWZhdWx0Rm9yZWdyb3VuZCxcblx0XHRcdFx0XHRpdGFsaWM6IGZhbHNlLFxuXHRcdFx0XHRcdGJvbGQ6IGZhbHNlLFxuXHRcdFx0XHRcdHVuZGVybGluZTogZmFsc2UsXG5cdFx0XHRcdFx0c3RyaWtldGhyb3VnaDogZmFsc2UsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9wcmV2aW91c1ByZXNlbnRhdGlvbjtcblx0fVxufVxuXG5jb25zdCBjYW5Vc2VaZXJvU2l6ZVRleHRhcmVhID0gKGJyb3dzZXIuaXNGaXJlZm94KTtcblxuZXhwb3J0IGNsYXNzIFRleHRBcmVhRWRpdENvbnRleHQgZXh0ZW5kcyBBYnN0cmFjdEVkaXRDb250ZXh0IHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF92aWV3Q29udHJvbGxlcjogVmlld0NvbnRyb2xsZXI7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3Zpc2libGVSYW5nZVByb3ZpZGVyOiBJVmlzaWJsZVJhbmdlUHJvdmlkZXI7XG5cdHByaXZhdGUgX3Njcm9sbExlZnQ6IG51bWJlcjtcblx0cHJpdmF0ZSBfc2Nyb2xsVG9wOiBudW1iZXI7XG5cblx0cHJpdmF0ZSBfYWNjZXNzaWJpbGl0eVN1cHBvcnQhOiBBY2Nlc3NpYmlsaXR5U3VwcG9ydDtcblx0cHJpdmF0ZSBfYWNjZXNzaWJpbGl0eVBhZ2VTaXplITogbnVtYmVyO1xuXHRwcml2YXRlIF90ZXh0QXJlYVdyYXBwaW5nITogYm9vbGVhbjtcblx0cHJpdmF0ZSBfdGV4dEFyZWFXaWR0aCE6IG51bWJlcjtcblx0cHJpdmF0ZSBfY29udGVudExlZnQ6IG51bWJlcjtcblx0cHJpdmF0ZSBfY29udGVudFdpZHRoOiBudW1iZXI7XG5cdHByaXZhdGUgX2NvbnRlbnRIZWlnaHQ6IG51bWJlcjtcblx0cHJpdmF0ZSBfZm9udEluZm86IEZvbnRJbmZvO1xuXHRwcml2YXRlIF9saW5lSGVpZ2h0OiBudW1iZXI7XG5cdHByaXZhdGUgX2VtcHR5U2VsZWN0aW9uQ2xpcGJvYXJkOiBib29sZWFuO1xuXHRwcml2YXRlIF9jb3B5V2l0aFN5bnRheEhpZ2hsaWdodGluZzogYm9vbGVhbjtcblxuXHQvKipcblx0ICogRGVmaW5lZCBvbmx5IHdoZW4gdGhlIHRleHQgYXJlYSBpcyB2aXNpYmxlIChjb21wb3NpdGlvbiBjYXNlKS5cblx0ICovXG5cdHByaXZhdGUgX3Zpc2libGVUZXh0QXJlYTogVmlzaWJsZVRleHRBcmVhRGF0YSB8IG51bGw7XG5cdHByaXZhdGUgX3NlbGVjdGlvbnM6IFNlbGVjdGlvbltdO1xuXHRwcml2YXRlIF9tb2RlbFNlbGVjdGlvbnM6IFNlbGVjdGlvbltdO1xuXG5cdC8qKlxuXHQgKiBUaGUgcG9zaXRpb24gYXQgd2hpY2ggdGhlIHRleHRhcmVhIHdhcyByZW5kZXJlZC5cblx0ICogVGhpcyBpcyB1c2VmdWwgZm9yIGhpdC10ZXN0aW5nIGFuZCBkZXRlcm1pbmluZyB0aGUgbW91c2UgcG9zaXRpb24uXG5cdCAqL1xuXHRwcml2YXRlIF9sYXN0UmVuZGVyUG9zaXRpb246IFBvc2l0aW9uIHwgbnVsbDtcblxuXHRwdWJsaWMgcmVhZG9ubHkgdGV4dEFyZWE6IEZhc3REb21Ob2RlPEhUTUxUZXh0QXJlYUVsZW1lbnQ+O1xuXHRwdWJsaWMgcmVhZG9ubHkgdGV4dEFyZWFDb3ZlcjogRmFzdERvbU5vZGU8SFRNTEVsZW1lbnQ+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF90ZXh0QXJlYUlucHV0OiBUZXh0QXJlYUlucHV0O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGNvbnRleHQ6IFZpZXdDb250ZXh0LFxuXHRcdG92ZXJmbG93R3VhcmRDb250YWluZXI6IEZhc3REb21Ob2RlPEhUTUxFbGVtZW50Pixcblx0XHR2aWV3Q29udHJvbGxlcjogVmlld0NvbnRyb2xsZXIsXG5cdFx0dmlzaWJsZVJhbmdlUHJvdmlkZXI6IElWaXNpYmxlUmFuZ2VQcm92aWRlcixcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2tleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKGNvbnRleHQpO1xuXG5cdFx0dGhpcy5fdmlld0NvbnRyb2xsZXIgPSB2aWV3Q29udHJvbGxlcjtcblx0XHR0aGlzLl92aXNpYmxlUmFuZ2VQcm92aWRlciA9IHZpc2libGVSYW5nZVByb3ZpZGVyO1xuXHRcdHRoaXMuX3Njcm9sbExlZnQgPSAwO1xuXHRcdHRoaXMuX3Njcm9sbFRvcCA9IDA7XG5cblx0XHRjb25zdCBvcHRpb25zID0gdGhpcy5fY29udGV4dC5jb25maWd1cmF0aW9uLm9wdGlvbnM7XG5cdFx0Y29uc3QgbGF5b3V0SW5mbyA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5sYXlvdXRJbmZvKTtcblxuXHRcdHRoaXMuX3NldEFjY2Vzc2liaWxpdHlPcHRpb25zKG9wdGlvbnMpO1xuXHRcdHRoaXMuX2NvbnRlbnRMZWZ0ID0gbGF5b3V0SW5mby5jb250ZW50TGVmdDtcblx0XHR0aGlzLl9jb250ZW50V2lkdGggPSBsYXlvdXRJbmZvLmNvbnRlbnRXaWR0aDtcblx0XHR0aGlzLl9jb250ZW50SGVpZ2h0ID0gbGF5b3V0SW5mby5oZWlnaHQ7XG5cdFx0dGhpcy5fZm9udEluZm8gPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24uZm9udEluZm8pO1xuXHRcdHRoaXMuX2xpbmVIZWlnaHQgPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24ubGluZUhlaWdodCk7XG5cdFx0dGhpcy5fZW1wdHlTZWxlY3Rpb25DbGlwYm9hcmQgPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24uZW1wdHlTZWxlY3Rpb25DbGlwYm9hcmQpO1xuXHRcdHRoaXMuX2NvcHlXaXRoU3ludGF4SGlnaGxpZ2h0aW5nID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmNvcHlXaXRoU3ludGF4SGlnaGxpZ2h0aW5nKTtcblxuXHRcdHRoaXMuX3Zpc2libGVUZXh0QXJlYSA9IG51bGw7XG5cdFx0dGhpcy5fc2VsZWN0aW9ucyA9IFtuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpXTtcblx0XHR0aGlzLl9tb2RlbFNlbGVjdGlvbnMgPSBbbmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKV07XG5cdFx0dGhpcy5fbGFzdFJlbmRlclBvc2l0aW9uID0gbnVsbDtcblxuXHRcdC8vIFRleHQgQXJlYSAoVGhlIGZvY3VzIHdpbGwgYWx3YXlzIGJlIGluIHRoZSB0ZXh0YXJlYSB3aGVuIHRoZSBjdXJzb3IgaXMgYmxpbmtpbmcpXG5cdFx0dGhpcy50ZXh0QXJlYSA9IGNyZWF0ZUZhc3REb21Ob2RlKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RleHRhcmVhJykpO1xuXHRcdFBhcnRGaW5nZXJwcmludHMud3JpdGUodGhpcy50ZXh0QXJlYSwgUGFydEZpbmdlcnByaW50LlRleHRBcmVhKTtcblx0XHR0aGlzLnRleHRBcmVhLnNldENsYXNzTmFtZShgaW5wdXRhcmVhICR7TU9VU0VfQ1VSU09SX1RFWFRfQ1NTX0NMQVNTX05BTUV9YCk7XG5cdFx0dGhpcy50ZXh0QXJlYS5zZXRBdHRyaWJ1dGUoJ3dyYXAnLCB0aGlzLl90ZXh0QXJlYVdyYXBwaW5nICYmICF0aGlzLl92aXNpYmxlVGV4dEFyZWEgPyAnb24nIDogJ29mZicpO1xuXHRcdGNvbnN0IHsgdGFiU2l6ZSB9ID0gdGhpcy5fY29udGV4dC52aWV3TW9kZWwubW9kZWwuZ2V0T3B0aW9ucygpO1xuXHRcdHRoaXMudGV4dEFyZWEuZG9tTm9kZS5zdHlsZS50YWJTaXplID0gYCR7dGFiU2l6ZSAqIHRoaXMuX2ZvbnRJbmZvLnNwYWNlV2lkdGh9cHhgO1xuXHRcdHRoaXMudGV4dEFyZWEuc2V0QXR0cmlidXRlKCdhdXRvY29ycmVjdCcsICdvZmYnKTtcblx0XHR0aGlzLnRleHRBcmVhLnNldEF0dHJpYnV0ZSgnYXV0b2NhcGl0YWxpemUnLCAnb2ZmJyk7XG5cdFx0dGhpcy50ZXh0QXJlYS5zZXRBdHRyaWJ1dGUoJ2F1dG9jb21wbGV0ZScsICdvZmYnKTtcblx0XHR0aGlzLnRleHRBcmVhLnNldEF0dHJpYnV0ZSgnc3BlbGxjaGVjaycsICdmYWxzZScpO1xuXHRcdHRoaXMudGV4dEFyZWEuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgYXJpYUxhYmVsRm9yU2NyZWVuUmVhZGVyQ29udGVudChvcHRpb25zLCB0aGlzLl9rZXliaW5kaW5nU2VydmljZSkpO1xuXHRcdHRoaXMudGV4dEFyZWEuc2V0QXR0cmlidXRlKCdhcmlhLXJlcXVpcmVkJywgb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmFyaWFSZXF1aXJlZCkgPyAndHJ1ZScgOiAnZmFsc2UnKTtcblx0XHR0aGlzLnRleHRBcmVhLnNldEF0dHJpYnV0ZSgndGFiaW5kZXgnLCBTdHJpbmcob3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLnRhYkluZGV4KSkpO1xuXHRcdHRoaXMudGV4dEFyZWEuc2V0QXR0cmlidXRlKCdyb2xlJywgJ3RleHRib3gnKTtcblx0XHR0aGlzLnRleHRBcmVhLnNldEF0dHJpYnV0ZSgnYXJpYS1yb2xlZGVzY3JpcHRpb24nLCBubHMubG9jYWxpemUoJ2VkaXRvcicsIFwiZWRpdG9yXCIpKTtcblx0XHR0aGlzLnRleHRBcmVhLnNldEF0dHJpYnV0ZSgnYXJpYS1tdWx0aWxpbmUnLCAndHJ1ZScpO1xuXHRcdHRoaXMudGV4dEFyZWEuc2V0QXR0cmlidXRlKCdhcmlhLWF1dG9jb21wbGV0ZScsIG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5yZWFkT25seSkgPyAnbm9uZScgOiAnYm90aCcpO1xuXG5cdFx0dGhpcy5fZW5zdXJlUmVhZE9ubHlBdHRyaWJ1dGUoKTtcblxuXHRcdHRoaXMudGV4dEFyZWFDb3ZlciA9IGNyZWF0ZUZhc3REb21Ob2RlKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpKTtcblx0XHR0aGlzLnRleHRBcmVhQ292ZXIuc2V0UG9zaXRpb24oJ2Fic29sdXRlJyk7XG5cblx0XHRvdmVyZmxvd0d1YXJkQ29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMudGV4dEFyZWEpO1xuXHRcdG92ZXJmbG93R3VhcmRDb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy50ZXh0QXJlYUNvdmVyKTtcblxuXHRcdGNvbnN0IHNpbXBsZU1vZGVsOiBJU2ltcGxlTW9kZWwgPSB7XG5cdFx0XHRnZXRMaW5lQ291bnQ6ICgpOiBudW1iZXIgPT4ge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fY29udGV4dC52aWV3TW9kZWwuZ2V0TGluZUNvdW50KCk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0TGluZU1heENvbHVtbjogKGxpbmVOdW1iZXI6IG51bWJlcik6IG51bWJlciA9PiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9jb250ZXh0LnZpZXdNb2RlbC5nZXRMaW5lTWF4Q29sdW1uKGxpbmVOdW1iZXIpO1xuXHRcdFx0fSxcblx0XHRcdGdldFZhbHVlSW5SYW5nZTogKHJhbmdlOiBSYW5nZSwgZW9sOiBFbmRPZkxpbmVQcmVmZXJlbmNlKTogc3RyaW5nID0+IHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX2NvbnRleHQudmlld01vZGVsLmdldFZhbHVlSW5SYW5nZShyYW5nZSwgZW9sKTtcblx0XHRcdH0sXG5cdFx0XHRnZXRWYWx1ZUxlbmd0aEluUmFuZ2U6IChyYW5nZTogUmFuZ2UsIGVvbDogRW5kT2ZMaW5lUHJlZmVyZW5jZSk6IG51bWJlciA9PiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9jb250ZXh0LnZpZXdNb2RlbC5nZXRWYWx1ZUxlbmd0aEluUmFuZ2UocmFuZ2UsIGVvbCk7XG5cdFx0XHR9LFxuXHRcdFx0bW9kaWZ5UG9zaXRpb246IChwb3NpdGlvbjogUG9zaXRpb24sIG9mZnNldDogbnVtYmVyKTogUG9zaXRpb24gPT4ge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fY29udGV4dC52aWV3TW9kZWwubW9kaWZ5UG9zaXRpb24ocG9zaXRpb24sIG9mZnNldCk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IHRleHRBcmVhSW5wdXRIb3N0OiBJVGV4dEFyZWFJbnB1dEhvc3QgPSB7XG5cdFx0XHRnZXREYXRhVG9Db3B5OiAoKTogQ2xpcGJvYXJkRGF0YVRvQ29weSA9PiB7XG5cdFx0XHRcdHJldHVybiBnZXREYXRhVG9Db3B5KHRoaXMuX2NvbnRleHQudmlld01vZGVsLCB0aGlzLl9tb2RlbFNlbGVjdGlvbnMsIHRoaXMuX2VtcHR5U2VsZWN0aW9uQ2xpcGJvYXJkLCB0aGlzLl9jb3B5V2l0aFN5bnRheEhpZ2hsaWdodGluZyk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0U2NyZWVuUmVhZGVyQ29udGVudDogKCk6IFRleHRBcmVhU3RhdGUgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5fYWNjZXNzaWJpbGl0eVN1cHBvcnQgPT09IEFjY2Vzc2liaWxpdHlTdXBwb3J0LkRpc2FibGVkKSB7XG5cdFx0XHRcdFx0Ly8gV2Uga25vdyBmb3IgYSBmYWN0IHRoYXQgYSBzY3JlZW4gcmVhZGVyIGlzIG5vdCBhdHRhY2hlZFxuXHRcdFx0XHRcdC8vIE9uIE9TWCwgd2Ugd3JpdGUgdGhlIGNoYXJhY3RlciBiZWZvcmUgdGhlIGN1cnNvciB0byBhbGxvdyBmb3IgXCJsb25nLXByZXNzXCIgY29tcG9zaXRpb25cblx0XHRcdFx0XHQvLyBBbHNvIG9uIE9TWCwgd2Ugd3JpdGUgdGhlIHdvcmQgYmVmb3JlIHRoZSBjdXJzb3IgdG8gYWxsb3cgZm9yIHRoZSBBY2Nlc3NpYmlsaXR5IEtleWJvYXJkIHRvIGdpdmUgZ29vZCBoaW50c1xuXHRcdFx0XHRcdGNvbnN0IHNlbGVjdGlvbiA9IHRoaXMuX3NlbGVjdGlvbnNbMF07XG5cdFx0XHRcdFx0aWYgKHBsYXRmb3JtLmlzTWFjaW50b3NoICYmIHNlbGVjdGlvbi5pc0VtcHR5KCkpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHBvc2l0aW9uID0gc2VsZWN0aW9uLmdldFN0YXJ0UG9zaXRpb24oKTtcblxuXHRcdFx0XHRcdFx0bGV0IHRleHRCZWZvcmUgPSB0aGlzLl9nZXRXb3JkQmVmb3JlUG9zaXRpb24ocG9zaXRpb24pO1xuXHRcdFx0XHRcdFx0aWYgKHRleHRCZWZvcmUubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0XHRcdHRleHRCZWZvcmUgPSB0aGlzLl9nZXRDaGFyYWN0ZXJCZWZvcmVQb3NpdGlvbihwb3NpdGlvbik7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGlmICh0ZXh0QmVmb3JlLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIG5ldyBUZXh0QXJlYVN0YXRlKHRleHRCZWZvcmUsIHRleHRCZWZvcmUubGVuZ3RoLCB0ZXh0QmVmb3JlLmxlbmd0aCwgUmFuZ2UuZnJvbVBvc2l0aW9ucyhwb3NpdGlvbiksIDApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHQvLyBvbiBtYWNPUywgd3JpdGUgY3VycmVudCBzZWxlY3Rpb24gaW50byB0ZXh0YXJlYSB3aWxsIGFsbG93IHN5c3RlbSB0ZXh0IHNlcnZpY2VzIHBpY2sgc2VsZWN0ZWQgdGV4dCxcblx0XHRcdFx0XHQvLyBidXQgd2Ugc3RpbGwgd2FudCB0byBsaW1pdCB0aGUgYW1vdW50IG9mIHRleHQgZ2l2ZW4gQ2hyb21pdW0gaGFuZGxlcyB2ZXJ5IHBvb3JseSB0ZXh0IGV2ZW4gb2YgYSBmZXdcblx0XHRcdFx0XHQvLyB0aG91c2FuZCBjaGFyc1xuXHRcdFx0XHRcdC8vIChodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMjc3OTkpXG5cdFx0XHRcdFx0Y29uc3QgTElNSVRfQ0hBUlMgPSA1MDA7XG5cdFx0XHRcdFx0aWYgKHBsYXRmb3JtLmlzTWFjaW50b3NoICYmICFzZWxlY3Rpb24uaXNFbXB0eSgpICYmIHNpbXBsZU1vZGVsLmdldFZhbHVlTGVuZ3RoSW5SYW5nZShzZWxlY3Rpb24sIEVuZE9mTGluZVByZWZlcmVuY2UuVGV4dERlZmluZWQpIDwgTElNSVRfQ0hBUlMpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHRleHQgPSBzaW1wbGVNb2RlbC5nZXRWYWx1ZUluUmFuZ2Uoc2VsZWN0aW9uLCBFbmRPZkxpbmVQcmVmZXJlbmNlLlRleHREZWZpbmVkKTtcblx0XHRcdFx0XHRcdHJldHVybiBuZXcgVGV4dEFyZWFTdGF0ZSh0ZXh0LCAwLCB0ZXh0Lmxlbmd0aCwgc2VsZWN0aW9uLCAwKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBvbiBTYWZhcmksIGRvY3VtZW50LmV4ZWNDb21tYW5kKCdjdXQnKSBhbmQgZG9jdW1lbnQuZXhlY0NvbW1hbmQoJ2NvcHknKSB3aWxsIGp1c3Qgbm90IHdvcmtcblx0XHRcdFx0XHQvLyBpZiB0aGUgdGV4dGFyZWEgaGFzIG5vIGNvbnRlbnQgc2VsZWN0ZWQuIFNvIGlmIHRoZXJlIGlzIGFuIGVkaXRvciBzZWxlY3Rpb24sIGVuc3VyZSBzb21ldGhpbmdcblx0XHRcdFx0XHQvLyBpcyBzZWxlY3RlZCBpbiB0aGUgdGV4dGFyZWEuXG5cdFx0XHRcdFx0aWYgKGJyb3dzZXIuaXNTYWZhcmkgJiYgIXNlbGVjdGlvbi5pc0VtcHR5KCkpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHBsYWNlaG9sZGVyVGV4dCA9ICd2c2NvZGUtcGxhY2Vob2xkZXInO1xuXHRcdFx0XHRcdFx0cmV0dXJuIG5ldyBUZXh0QXJlYVN0YXRlKHBsYWNlaG9sZGVyVGV4dCwgMCwgcGxhY2Vob2xkZXJUZXh0Lmxlbmd0aCwgbnVsbCwgdW5kZWZpbmVkKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4gVGV4dEFyZWFTdGF0ZS5FTVBUWTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChicm93c2VyLmlzQW5kcm9pZCkge1xuXHRcdFx0XHRcdC8vIHdoZW4gdGFwcGluZyBpbiB0aGUgZWRpdG9yIG9uIGEgd29yZCwgQW5kcm9pZCBlbnRlcnMgY29tcG9zaXRpb24gbW9kZS5cblx0XHRcdFx0XHQvLyBpbiB0aGUgYGNvbXBvc2l0aW9uc3RhcnRgIGV2ZW50IHdlIGNhbm5vdCBjbGVhciB0aGUgdGV4dGFyZWEsIGJlY2F1c2Vcblx0XHRcdFx0XHQvLyBpdCB0aGVuIGZvcmdldHMgdG8gZXZlciBzZW5kIGEgYGNvbXBvc2l0aW9uZW5kYC5cblx0XHRcdFx0XHQvLyB3ZSB0aGVyZWZvcmUgb25seSB3cml0ZSB0aGUgY3VycmVudCB3b3JkIGluIHRoZSB0ZXh0YXJlYVxuXHRcdFx0XHRcdGNvbnN0IHNlbGVjdGlvbiA9IHRoaXMuX3NlbGVjdGlvbnNbMF07XG5cdFx0XHRcdFx0aWYgKHNlbGVjdGlvbi5pc0VtcHR5KCkpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHBvc2l0aW9uID0gc2VsZWN0aW9uLmdldFN0YXJ0UG9zaXRpb24oKTtcblx0XHRcdFx0XHRcdGNvbnN0IFt3b3JkQXRQb3NpdGlvbiwgcG9zaXRpb25PZmZzZXRJbldvcmRdID0gdGhpcy5fZ2V0QW5kcm9pZFdvcmRBdFBvc2l0aW9uKHBvc2l0aW9uKTtcblx0XHRcdFx0XHRcdGlmICh3b3JkQXRQb3NpdGlvbi5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBuZXcgVGV4dEFyZWFTdGF0ZSh3b3JkQXRQb3NpdGlvbiwgcG9zaXRpb25PZmZzZXRJbldvcmQsIHBvc2l0aW9uT2Zmc2V0SW5Xb3JkLCBSYW5nZS5mcm9tUG9zaXRpb25zKHBvc2l0aW9uKSwgMCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBUZXh0QXJlYVN0YXRlLkVNUFRZO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3Qgc2NyZWVuUmVhZGVyQ29udGVudFN0YXRlID0gUGFnZWRTY3JlZW5SZWFkZXJTdHJhdGVneS5mcm9tRWRpdG9yU2VsZWN0aW9uKHNpbXBsZU1vZGVsLCB0aGlzLl9zZWxlY3Rpb25zWzBdLCB0aGlzLl9hY2Nlc3NpYmlsaXR5UGFnZVNpemUsIHRoaXMuX2FjY2Vzc2liaWxpdHlTdXBwb3J0ID09PSBBY2Nlc3NpYmlsaXR5U3VwcG9ydC5Vbmtub3duKTtcblx0XHRcdFx0cmV0dXJuIFRleHRBcmVhU3RhdGUuZnJvbVNjcmVlblJlYWRlckNvbnRlbnRTdGF0ZShzY3JlZW5SZWFkZXJDb250ZW50U3RhdGUpO1xuXHRcdFx0fSxcblxuXHRcdFx0ZGVkdWNlTW9kZWxQb3NpdGlvbjogKHZpZXdBbmNob3JQb3NpdGlvbjogUG9zaXRpb24sIGRlbHRhT2Zmc2V0OiBudW1iZXIsIGxpbmVGZWVkQ250OiBudW1iZXIpOiBQb3NpdGlvbiA9PiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9jb250ZXh0LnZpZXdNb2RlbC5kZWR1Y2VNb2RlbFBvc2l0aW9uUmVsYXRpdmVUb1ZpZXdQb3NpdGlvbih2aWV3QW5jaG9yUG9zaXRpb24sIGRlbHRhT2Zmc2V0LCBsaW5lRmVlZENudCk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IHRleHRBcmVhV3JhcHBlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBUZXh0QXJlYVdyYXBwZXIodGhpcy50ZXh0QXJlYS5kb21Ob2RlKSk7XG5cdFx0dGhpcy5fdGV4dEFyZWFJbnB1dCA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRleHRBcmVhSW5wdXQsIHRleHRBcmVhSW5wdXRIb3N0LCB0ZXh0QXJlYVdyYXBwZXIsIHBsYXRmb3JtLk9TLCB7XG5cdFx0XHRpc0FuZHJvaWQ6IGJyb3dzZXIuaXNBbmRyb2lkLFxuXHRcdFx0aXNDaHJvbWU6IGJyb3dzZXIuaXNDaHJvbWUsXG5cdFx0XHRpc0ZpcmVmb3g6IGJyb3dzZXIuaXNGaXJlZm94LFxuXHRcdFx0aXNTYWZhcmk6IGJyb3dzZXIuaXNTYWZhcmksXG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fdGV4dEFyZWFJbnB1dC5vbktleURvd24oKGU6IElLZXlib2FyZEV2ZW50KSA9PiB7XG5cdFx0XHR0aGlzLl92aWV3Q29udHJvbGxlci5lbWl0S2V5RG93bihlKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl90ZXh0QXJlYUlucHV0Lm9uS2V5VXAoKGU6IElLZXlib2FyZEV2ZW50KSA9PiB7XG5cdFx0XHR0aGlzLl92aWV3Q29udHJvbGxlci5lbWl0S2V5VXAoZSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fdGV4dEFyZWFJbnB1dC5vblBhc3RlKChlOiBJUGFzdGVEYXRhKSA9PiB7XG5cdFx0XHRsZXQgcGFzdGVPbk5ld0xpbmUgPSBmYWxzZTtcblx0XHRcdGxldCBtdWx0aWN1cnNvclRleHQ6IHN0cmluZ1tdIHwgbnVsbCA9IG51bGw7XG5cdFx0XHRsZXQgbW9kZTogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cdFx0XHRpZiAoZS5tZXRhZGF0YSkge1xuXHRcdFx0XHRwYXN0ZU9uTmV3TGluZSA9ICh0aGlzLl9lbXB0eVNlbGVjdGlvbkNsaXBib2FyZCAmJiAhIWUubWV0YWRhdGEuaXNGcm9tRW1wdHlTZWxlY3Rpb24pO1xuXHRcdFx0XHRtdWx0aWN1cnNvclRleHQgPSAodHlwZW9mIGUubWV0YWRhdGEubXVsdGljdXJzb3JUZXh0ICE9PSAndW5kZWZpbmVkJyA/IGUubWV0YWRhdGEubXVsdGljdXJzb3JUZXh0IDogbnVsbCk7XG5cdFx0XHRcdG1vZGUgPSBlLm1ldGFkYXRhLm1vZGU7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl92aWV3Q29udHJvbGxlci5wYXN0ZShlLnRleHQsIHBhc3RlT25OZXdMaW5lLCBtdWx0aWN1cnNvclRleHQsIG1vZGUpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3RleHRBcmVhSW5wdXQub25DdXQoKCkgPT4ge1xuXHRcdFx0dGhpcy5fdmlld0NvbnRyb2xsZXIuY3V0KCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fdGV4dEFyZWFJbnB1dC5vblR5cGUoKGU6IElUeXBlRGF0YSkgPT4ge1xuXHRcdFx0aWYgKGUucmVwbGFjZVByZXZDaGFyQ250IHx8IGUucmVwbGFjZU5leHRDaGFyQ250IHx8IGUucG9zaXRpb25EZWx0YSkge1xuXHRcdFx0XHQvLyBtdXN0IGJlIGhhbmRsZWQgdGhyb3VnaCB0aGUgbmV3IGNvbW1hbmRcblx0XHRcdFx0aWYgKF9kZWJ1Z0NvbXBvc2l0aW9uKSB7XG5cdFx0XHRcdFx0Y29uc29sZS5sb2coYCA9PiBjb21wb3NpdGlvblR5cGU6IDw8JHtlLnRleHR9Pj4sICR7ZS5yZXBsYWNlUHJldkNoYXJDbnR9LCAke2UucmVwbGFjZU5leHRDaGFyQ250fSwgJHtlLnBvc2l0aW9uRGVsdGF9YCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5fdmlld0NvbnRyb2xsZXIuY29tcG9zaXRpb25UeXBlKGUudGV4dCwgZS5yZXBsYWNlUHJldkNoYXJDbnQsIGUucmVwbGFjZU5leHRDaGFyQ250LCBlLnBvc2l0aW9uRGVsdGEpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKF9kZWJ1Z0NvbXBvc2l0aW9uKSB7XG5cdFx0XHRcdFx0Y29uc29sZS5sb2coYCA9PiB0eXBlOiA8PCR7ZS50ZXh0fT4+YCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5fdmlld0NvbnRyb2xsZXIudHlwZShlLnRleHQpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3RleHRBcmVhSW5wdXQub25TZWxlY3Rpb25DaGFuZ2VSZXF1ZXN0KChtb2RlbFNlbGVjdGlvbjogU2VsZWN0aW9uKSA9PiB7XG5cdFx0XHR0aGlzLl92aWV3Q29udHJvbGxlci5zZXRTZWxlY3Rpb24obW9kZWxTZWxlY3Rpb24pO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3RleHRBcmVhSW5wdXQub25Db21wb3NpdGlvblN0YXJ0KChlKSA9PiB7XG5cblx0XHRcdC8vIFRoZSB0ZXh0YXJlYSBtaWdodCBjb250YWluIHNvbWUgY29udGVudCB3aGVuIGNvbXBvc2l0aW9uIHN0YXJ0cy5cblx0XHRcdC8vXG5cdFx0XHQvLyBXaGVuIHdlIG1ha2UgdGhlIHRleHRhcmVhIHZpc2libGUsIGl0IGFsd2F5cyBoYXMgYSBoZWlnaHQgb2YgMSBsaW5lLFxuXHRcdFx0Ly8gc28gd2UgZG9uJ3QgbmVlZCB0byB3b3JyeSB0b28gbXVjaCBhYm91dCBjb250ZW50IG9uIGxpbmVzIGFib3ZlIG9yIGJlbG93XG5cdFx0XHQvLyB0aGUgc2VsZWN0aW9uLlxuXHRcdFx0Ly9cblx0XHRcdC8vIEhvd2V2ZXIsIHRoZSB0ZXh0IG9uIHRoZSBjdXJyZW50IGxpbmUgbmVlZHMgdG8gYmUgbWFkZSB2aXNpYmxlIGJlY2F1c2Vcblx0XHRcdC8vIHNvbWUgSU1FIG1ldGhvZHMgYWxsb3cgdG8gbW92ZSB0byBvdGhlciBnbHlwaHMgb24gdGhlIGN1cnJlbnQgbGluZVxuXHRcdFx0Ly8gKGJ5IHByZXNzaW5nIGFycm93IGtleXMpLlxuXHRcdFx0Ly9cblx0XHRcdC8vICgxKSBUaGUgdGV4dGFyZWEgbWlnaHQgY29udGFpbiBvbmx5IHNvbWUgcGFydHMgb2YgdGhlIGN1cnJlbnQgbGluZSxcblx0XHRcdC8vIGxpa2UgdGhlIHdvcmQgYmVmb3JlIHRoZSBzZWxlY3Rpb24uIEFsc28sIHRoZSBjb250ZW50IGluc2lkZSB0aGUgdGV4dGFyZWFcblx0XHRcdC8vIGNhbiBncm93IG9yIHNocmluayBhcyBjb21wb3NpdGlvbiBvY2N1cnMuIFdlIHRoZXJlZm9yZSBhbmNob3IgdGhlIHRleHRhcmVhXG5cdFx0XHQvLyBpbiB0ZXJtcyBvZiBkaXN0YW5jZSB0byBhIGNlcnRhaW4gbGluZSBzdGFydCBhbmQgbGluZSBlbmQuXG5cdFx0XHQvL1xuXHRcdFx0Ly8gKDIpIEFsc28sIHdlIHNob3VsZCBub3QgbWFrZSBcXHQgY2hhcmFjdGVycyB2aXNpYmxlLCBiZWNhdXNlIHRoZWlyIHJlbmRlcmluZ1xuXHRcdFx0Ly8gaW5zaWRlIHRoZSA8dGV4dGFyZWE+IHdpbGwgbm90IGFsaWduIG5pY2VseSB3aXRoIG91ciByZW5kZXJpbmcuIFdlIHRoZXJlZm9yZVxuXHRcdFx0Ly8gd2lsbCBoaWRlIChpZiBuZWNlc3NhcnkpIHNvbWUgb2YgdGhlIGxlYWRpbmcgdGV4dCBvbiB0aGUgY3VycmVudCBsaW5lLlxuXG5cdFx0XHRjb25zdCB0YSA9IHRoaXMudGV4dEFyZWEuZG9tTm9kZTtcblx0XHRcdGNvbnN0IG1vZGVsU2VsZWN0aW9uID0gdGhpcy5fbW9kZWxTZWxlY3Rpb25zWzBdO1xuXG5cdFx0XHRjb25zdCB7IGRpc3RhbmNlVG9Nb2RlbExpbmVTdGFydCwgd2lkdGhPZkhpZGRlblRleHRCZWZvcmUgfSA9ICgoKSA9PiB7XG5cdFx0XHRcdC8vIEZpbmQgdGhlIHRleHQgdGhhdCBpcyBvbiB0aGUgY3VycmVudCBsaW5lIGJlZm9yZSB0aGUgc2VsZWN0aW9uXG5cdFx0XHRcdGNvbnN0IHRleHRCZWZvcmVTZWxlY3Rpb24gPSB0YS52YWx1ZS5zdWJzdHJpbmcoMCwgTWF0aC5taW4odGEuc2VsZWN0aW9uU3RhcnQsIHRhLnNlbGVjdGlvbkVuZCkpO1xuXHRcdFx0XHRjb25zdCBsaW5lRmVlZE9mZnNldDEgPSB0ZXh0QmVmb3JlU2VsZWN0aW9uLmxhc3RJbmRleE9mKCdcXG4nKTtcblx0XHRcdFx0Y29uc3QgbGluZVRleHRCZWZvcmVTZWxlY3Rpb24gPSB0ZXh0QmVmb3JlU2VsZWN0aW9uLnN1YnN0cmluZyhsaW5lRmVlZE9mZnNldDEgKyAxKTtcblxuXHRcdFx0XHQvLyBXZSBub3cgc2VhcmNoIHRvIHNlZSBpZiB3ZSBzaG91bGQgaGlkZSBzb21lIHBhcnQgb2YgaXQgKGlmIGl0IGNvbnRhaW5zIFxcdClcblx0XHRcdFx0Y29uc3QgdGFiT2Zmc2V0MSA9IGxpbmVUZXh0QmVmb3JlU2VsZWN0aW9uLmxhc3RJbmRleE9mKCdcXHQnKTtcblx0XHRcdFx0Y29uc3QgZGVzaXJlZFZpc2libGVCZWZvcmVDaGFyQ291bnQgPSBsaW5lVGV4dEJlZm9yZVNlbGVjdGlvbi5sZW5ndGggLSB0YWJPZmZzZXQxIC0gMTtcblx0XHRcdFx0Y29uc3Qgc3RhcnRNb2RlbFBvc2l0aW9uID0gbW9kZWxTZWxlY3Rpb24uZ2V0U3RhcnRQb3NpdGlvbigpO1xuXHRcdFx0XHRjb25zdCB2aXNpYmxlQmVmb3JlQ2hhckNvdW50ID0gTWF0aC5taW4oc3RhcnRNb2RlbFBvc2l0aW9uLmNvbHVtbiAtIDEsIGRlc2lyZWRWaXNpYmxlQmVmb3JlQ2hhckNvdW50KTtcblx0XHRcdFx0Y29uc3QgZGlzdGFuY2VUb01vZGVsTGluZVN0YXJ0ID0gc3RhcnRNb2RlbFBvc2l0aW9uLmNvbHVtbiAtIDEgLSB2aXNpYmxlQmVmb3JlQ2hhckNvdW50O1xuXHRcdFx0XHRjb25zdCBoaWRkZW5MaW5lVGV4dEJlZm9yZSA9IGxpbmVUZXh0QmVmb3JlU2VsZWN0aW9uLnN1YnN0cmluZygwLCBsaW5lVGV4dEJlZm9yZVNlbGVjdGlvbi5sZW5ndGggLSB2aXNpYmxlQmVmb3JlQ2hhckNvdW50KTtcblx0XHRcdFx0Y29uc3QgeyB0YWJTaXplIH0gPSB0aGlzLl9jb250ZXh0LnZpZXdNb2RlbC5tb2RlbC5nZXRPcHRpb25zKCk7XG5cdFx0XHRcdGNvbnN0IHdpZHRoT2ZIaWRkZW5UZXh0QmVmb3JlID0gbWVhc3VyZVRleHQodGhpcy50ZXh0QXJlYS5kb21Ob2RlLm93bmVyRG9jdW1lbnQsIGhpZGRlbkxpbmVUZXh0QmVmb3JlLCB0aGlzLl9mb250SW5mbywgdGFiU2l6ZSk7XG5cblx0XHRcdFx0cmV0dXJuIHsgZGlzdGFuY2VUb01vZGVsTGluZVN0YXJ0LCB3aWR0aE9mSGlkZGVuVGV4dEJlZm9yZSB9O1xuXHRcdFx0fSkoKTtcblxuXHRcdFx0Y29uc3QgeyBkaXN0YW5jZVRvTW9kZWxMaW5lRW5kIH0gPSAoKCkgPT4ge1xuXHRcdFx0XHQvLyBGaW5kIHRoZSB0ZXh0IHRoYXQgaXMgb24gdGhlIGN1cnJlbnQgbGluZSBhZnRlciB0aGUgc2VsZWN0aW9uXG5cdFx0XHRcdGNvbnN0IHRleHRBZnRlclNlbGVjdGlvbiA9IHRhLnZhbHVlLnN1YnN0cmluZyhNYXRoLm1heCh0YS5zZWxlY3Rpb25TdGFydCwgdGEuc2VsZWN0aW9uRW5kKSk7XG5cdFx0XHRcdGNvbnN0IGxpbmVGZWVkT2Zmc2V0MiA9IHRleHRBZnRlclNlbGVjdGlvbi5pbmRleE9mKCdcXG4nKTtcblx0XHRcdFx0Y29uc3QgbGluZVRleHRBZnRlclNlbGVjdGlvbiA9IGxpbmVGZWVkT2Zmc2V0MiA9PT0gLTEgPyB0ZXh0QWZ0ZXJTZWxlY3Rpb24gOiB0ZXh0QWZ0ZXJTZWxlY3Rpb24uc3Vic3RyaW5nKDAsIGxpbmVGZWVkT2Zmc2V0Mik7XG5cblx0XHRcdFx0Y29uc3QgdGFiT2Zmc2V0MiA9IGxpbmVUZXh0QWZ0ZXJTZWxlY3Rpb24uaW5kZXhPZignXFx0Jyk7XG5cdFx0XHRcdGNvbnN0IGRlc2lyZWRWaXNpYmxlQWZ0ZXJDaGFyQ291bnQgPSAodGFiT2Zmc2V0MiA9PT0gLTEgPyBsaW5lVGV4dEFmdGVyU2VsZWN0aW9uLmxlbmd0aCA6IGxpbmVUZXh0QWZ0ZXJTZWxlY3Rpb24ubGVuZ3RoIC0gdGFiT2Zmc2V0MiAtIDEpO1xuXHRcdFx0XHRjb25zdCBlbmRNb2RlbFBvc2l0aW9uID0gbW9kZWxTZWxlY3Rpb24uZ2V0RW5kUG9zaXRpb24oKTtcblx0XHRcdFx0Y29uc3QgdmlzaWJsZUFmdGVyQ2hhckNvdW50ID0gTWF0aC5taW4odGhpcy5fY29udGV4dC52aWV3TW9kZWwubW9kZWwuZ2V0TGluZU1heENvbHVtbihlbmRNb2RlbFBvc2l0aW9uLmxpbmVOdW1iZXIpIC0gZW5kTW9kZWxQb3NpdGlvbi5jb2x1bW4sIGRlc2lyZWRWaXNpYmxlQWZ0ZXJDaGFyQ291bnQpO1xuXHRcdFx0XHRjb25zdCBkaXN0YW5jZVRvTW9kZWxMaW5lRW5kID0gdGhpcy5fY29udGV4dC52aWV3TW9kZWwubW9kZWwuZ2V0TGluZU1heENvbHVtbihlbmRNb2RlbFBvc2l0aW9uLmxpbmVOdW1iZXIpIC0gZW5kTW9kZWxQb3NpdGlvbi5jb2x1bW4gLSB2aXNpYmxlQWZ0ZXJDaGFyQ291bnQ7XG5cblx0XHRcdFx0cmV0dXJuIHsgZGlzdGFuY2VUb01vZGVsTGluZUVuZCB9O1xuXHRcdFx0fSkoKTtcblxuXHRcdFx0Ly8gU2Nyb2xsIHRvIHJldmVhbCB0aGUgbG9jYXRpb24gaW4gdGhlIGVkaXRvciB3aGVyZSBjb21wb3NpdGlvbiBvY2N1cnNcblx0XHRcdHRoaXMuX2NvbnRleHQudmlld01vZGVsLnJldmVhbFJhbmdlKFxuXHRcdFx0XHQna2V5Ym9hcmQnLFxuXHRcdFx0XHR0cnVlLFxuXHRcdFx0XHRSYW5nZS5mcm9tUG9zaXRpb25zKHRoaXMuX3NlbGVjdGlvbnNbMF0uZ2V0U3RhcnRQb3NpdGlvbigpKSxcblx0XHRcdFx0dmlld0V2ZW50cy5WZXJ0aWNhbFJldmVhbFR5cGUuU2ltcGxlLFxuXHRcdFx0XHRTY3JvbGxUeXBlLkltbWVkaWF0ZVxuXHRcdFx0KTtcblxuXHRcdFx0dGhpcy5fdmlzaWJsZVRleHRBcmVhID0gbmV3IFZpc2libGVUZXh0QXJlYURhdGEoXG5cdFx0XHRcdHRoaXMuX2NvbnRleHQsXG5cdFx0XHRcdG1vZGVsU2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlcixcblx0XHRcdFx0ZGlzdGFuY2VUb01vZGVsTGluZVN0YXJ0LFxuXHRcdFx0XHR3aWR0aE9mSGlkZGVuVGV4dEJlZm9yZSxcblx0XHRcdFx0ZGlzdGFuY2VUb01vZGVsTGluZUVuZCxcblx0XHRcdCk7XG5cblx0XHRcdC8vIFdlIHR1cm4gb2ZmIHdyYXBwaW5nIGlmIHRoZSA8dGV4dGFyZWE+IGJlY29tZXMgdmlzaWJsZSBmb3IgY29tcG9zaXRpb25cblx0XHRcdHRoaXMudGV4dEFyZWEuc2V0QXR0cmlidXRlKCd3cmFwJywgdGhpcy5fdGV4dEFyZWFXcmFwcGluZyAmJiAhdGhpcy5fdmlzaWJsZVRleHRBcmVhID8gJ29uJyA6ICdvZmYnKTtcblxuXHRcdFx0dGhpcy5fdmlzaWJsZVRleHRBcmVhLnByZXBhcmVSZW5kZXIodGhpcy5fdmlzaWJsZVJhbmdlUHJvdmlkZXIpO1xuXHRcdFx0dGhpcy5fcmVuZGVyKCk7XG5cblx0XHRcdC8vIFNob3cgdGhlIHRleHRhcmVhXG5cdFx0XHR0aGlzLnRleHRBcmVhLnNldENsYXNzTmFtZShgaW5wdXRhcmVhICR7TU9VU0VfQ1VSU09SX1RFWFRfQ1NTX0NMQVNTX05BTUV9IGltZS1pbnB1dGApO1xuXG5cdFx0XHR0aGlzLl92aWV3Q29udHJvbGxlci5jb21wb3NpdGlvblN0YXJ0KCk7XG5cdFx0XHR0aGlzLl9jb250ZXh0LnZpZXdNb2RlbC5vbkNvbXBvc2l0aW9uU3RhcnQoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl90ZXh0QXJlYUlucHV0Lm9uQ29tcG9zaXRpb25VcGRhdGUoKGU6IElDb21wb3NpdGlvbkRhdGEpID0+IHtcblx0XHRcdGlmICghdGhpcy5fdmlzaWJsZVRleHRBcmVhKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fdmlzaWJsZVRleHRBcmVhLnByZXBhcmVSZW5kZXIodGhpcy5fdmlzaWJsZVJhbmdlUHJvdmlkZXIpO1xuXHRcdFx0dGhpcy5fcmVuZGVyKCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fdGV4dEFyZWFJbnB1dC5vbkNvbXBvc2l0aW9uRW5kKCgpID0+IHtcblxuXHRcdFx0dGhpcy5fdmlzaWJsZVRleHRBcmVhID0gbnVsbDtcblxuXHRcdFx0Ly8gV2UgdHVybiBvbiB3cmFwcGluZyBhcyBuZWNlc3NhcnkgaWYgdGhlIDx0ZXh0YXJlYT4gaGlkZXMgYWZ0ZXIgY29tcG9zaXRpb25cblx0XHRcdHRoaXMudGV4dEFyZWEuc2V0QXR0cmlidXRlKCd3cmFwJywgdGhpcy5fdGV4dEFyZWFXcmFwcGluZyAmJiAhdGhpcy5fdmlzaWJsZVRleHRBcmVhID8gJ29uJyA6ICdvZmYnKTtcblxuXHRcdFx0dGhpcy5fcmVuZGVyKCk7XG5cblx0XHRcdHRoaXMudGV4dEFyZWEuc2V0Q2xhc3NOYW1lKGBpbnB1dGFyZWEgJHtNT1VTRV9DVVJTT1JfVEVYVF9DU1NfQ0xBU1NfTkFNRX1gKTtcblx0XHRcdHRoaXMuX3ZpZXdDb250cm9sbGVyLmNvbXBvc2l0aW9uRW5kKCk7XG5cdFx0XHR0aGlzLl9jb250ZXh0LnZpZXdNb2RlbC5vbkNvbXBvc2l0aW9uRW5kKCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fdGV4dEFyZWFJbnB1dC5vbkZvY3VzKCgpID0+IHtcblx0XHRcdHRoaXMuX2NvbnRleHQudmlld01vZGVsLnNldEhhc0ZvY3VzKHRydWUpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3RleHRBcmVhSW5wdXQub25CbHVyKCgpID0+IHtcblx0XHRcdHRoaXMuX2NvbnRleHQudmlld01vZGVsLnNldEhhc0ZvY3VzKGZhbHNlKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihJTUUub25EaWRDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0dGhpcy5fZW5zdXJlUmVhZE9ubHlBdHRyaWJ1dGUoKTtcblx0XHR9KSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGRvbU5vZGUoKSB7XG5cdFx0cmV0dXJuIHRoaXMudGV4dEFyZWE7XG5cdH1cblxuXHRwdWJsaWMgd3JpdGVTY3JlZW5SZWFkZXJDb250ZW50KHJlYXNvbjogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5fdGV4dEFyZWFJbnB1dC53cml0ZU5hdGl2ZVRleHRBcmVhQ29udGVudChyZWFzb24pO1xuXHR9XG5cblx0cHVibGljIGdldFRleHRBcmVhRG9tTm9kZSgpOiBIVE1MVGV4dEFyZWFFbGVtZW50IHtcblx0XHRyZXR1cm4gdGhpcy50ZXh0QXJlYS5kb21Ob2RlO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHRcdHRoaXMudGV4dEFyZWEuZG9tTm9kZS5yZW1vdmUoKTtcblx0XHR0aGlzLnRleHRBcmVhQ292ZXIuZG9tTm9kZS5yZW1vdmUoKTtcblx0fVxuXG5cdHByaXZhdGUgX2dldEFuZHJvaWRXb3JkQXRQb3NpdGlvbihwb3NpdGlvbjogUG9zaXRpb24pOiBbc3RyaW5nLCBudW1iZXJdIHtcblx0XHRjb25zdCBBTkRST0lEX1dPUkRfU0VQQVJBVE9SUyA9ICdgfiFAIyQlXiYqKCktPStbe119XFxcXHw7OlwiLC48Pi8/Jztcblx0XHRjb25zdCBsaW5lQ29udGVudCA9IHRoaXMuX2NvbnRleHQudmlld01vZGVsLmdldExpbmVDb250ZW50KHBvc2l0aW9uLmxpbmVOdW1iZXIpO1xuXHRcdGNvbnN0IHdvcmRTZXBhcmF0b3JzID0gZ2V0TWFwRm9yV29yZFNlcGFyYXRvcnMoQU5EUk9JRF9XT1JEX1NFUEFSQVRPUlMsIFtdKTtcblxuXHRcdGxldCBnb2luZ0xlZnQgPSB0cnVlO1xuXHRcdGxldCBzdGFydENvbHVtbiA9IHBvc2l0aW9uLmNvbHVtbjtcblx0XHRsZXQgZ29pbmdSaWdodCA9IHRydWU7XG5cdFx0bGV0IGVuZENvbHVtbiA9IHBvc2l0aW9uLmNvbHVtbjtcblx0XHRsZXQgZGlzdGFuY2UgPSAwO1xuXHRcdHdoaWxlIChkaXN0YW5jZSA8IDUwICYmIChnb2luZ0xlZnQgfHwgZ29pbmdSaWdodCkpIHtcblx0XHRcdGlmIChnb2luZ0xlZnQgJiYgc3RhcnRDb2x1bW4gPD0gMSkge1xuXHRcdFx0XHRnb2luZ0xlZnQgPSBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmIChnb2luZ0xlZnQpIHtcblx0XHRcdFx0Y29uc3QgY2hhckNvZGUgPSBsaW5lQ29udGVudC5jaGFyQ29kZUF0KHN0YXJ0Q29sdW1uIC0gMik7XG5cdFx0XHRcdGNvbnN0IGNoYXJDbGFzcyA9IHdvcmRTZXBhcmF0b3JzLmdldChjaGFyQ29kZSk7XG5cdFx0XHRcdGlmIChjaGFyQ2xhc3MgIT09IFdvcmRDaGFyYWN0ZXJDbGFzcy5SZWd1bGFyKSB7XG5cdFx0XHRcdFx0Z29pbmdMZWZ0ID0gZmFsc2U7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0c3RhcnRDb2x1bW4tLTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKGdvaW5nUmlnaHQgJiYgZW5kQ29sdW1uID4gbGluZUNvbnRlbnQubGVuZ3RoKSB7XG5cdFx0XHRcdGdvaW5nUmlnaHQgPSBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmIChnb2luZ1JpZ2h0KSB7XG5cdFx0XHRcdGNvbnN0IGNoYXJDb2RlID0gbGluZUNvbnRlbnQuY2hhckNvZGVBdChlbmRDb2x1bW4gLSAxKTtcblx0XHRcdFx0Y29uc3QgY2hhckNsYXNzID0gd29yZFNlcGFyYXRvcnMuZ2V0KGNoYXJDb2RlKTtcblx0XHRcdFx0aWYgKGNoYXJDbGFzcyAhPT0gV29yZENoYXJhY3RlckNsYXNzLlJlZ3VsYXIpIHtcblx0XHRcdFx0XHRnb2luZ1JpZ2h0ID0gZmFsc2U7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZW5kQ29sdW1uKys7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGRpc3RhbmNlKys7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFtsaW5lQ29udGVudC5zdWJzdHJpbmcoc3RhcnRDb2x1bW4gLSAxLCBlbmRDb2x1bW4gLSAxKSwgcG9zaXRpb24uY29sdW1uIC0gc3RhcnRDb2x1bW5dO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0V29yZEJlZm9yZVBvc2l0aW9uKHBvc2l0aW9uOiBQb3NpdGlvbik6IHN0cmluZyB7XG5cdFx0Y29uc3QgbGluZUNvbnRlbnQgPSB0aGlzLl9jb250ZXh0LnZpZXdNb2RlbC5nZXRMaW5lQ29udGVudChwb3NpdGlvbi5saW5lTnVtYmVyKTtcblx0XHRjb25zdCB3b3JkU2VwYXJhdG9ycyA9IGdldE1hcEZvcldvcmRTZXBhcmF0b3JzKHRoaXMuX2NvbnRleHQuY29uZmlndXJhdGlvbi5vcHRpb25zLmdldChFZGl0b3JPcHRpb24ud29yZFNlcGFyYXRvcnMpLCBbXSk7XG5cblx0XHRsZXQgY29sdW1uID0gcG9zaXRpb24uY29sdW1uO1xuXHRcdGxldCBkaXN0YW5jZSA9IDA7XG5cdFx0d2hpbGUgKGNvbHVtbiA+IDEpIHtcblx0XHRcdGNvbnN0IGNoYXJDb2RlID0gbGluZUNvbnRlbnQuY2hhckNvZGVBdChjb2x1bW4gLSAyKTtcblx0XHRcdGNvbnN0IGNoYXJDbGFzcyA9IHdvcmRTZXBhcmF0b3JzLmdldChjaGFyQ29kZSk7XG5cdFx0XHRpZiAoY2hhckNsYXNzICE9PSBXb3JkQ2hhcmFjdGVyQ2xhc3MuUmVndWxhciB8fCBkaXN0YW5jZSA+IDUwKSB7XG5cdFx0XHRcdHJldHVybiBsaW5lQ29udGVudC5zdWJzdHJpbmcoY29sdW1uIC0gMSwgcG9zaXRpb24uY29sdW1uIC0gMSk7XG5cdFx0XHR9XG5cdFx0XHRkaXN0YW5jZSsrO1xuXHRcdFx0Y29sdW1uLS07XG5cdFx0fVxuXHRcdHJldHVybiBsaW5lQ29udGVudC5zdWJzdHJpbmcoMCwgcG9zaXRpb24uY29sdW1uIC0gMSk7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRDaGFyYWN0ZXJCZWZvcmVQb3NpdGlvbihwb3NpdGlvbjogUG9zaXRpb24pOiBzdHJpbmcge1xuXHRcdGlmIChwb3NpdGlvbi5jb2x1bW4gPiAxKSB7XG5cdFx0XHRjb25zdCBsaW5lQ29udGVudCA9IHRoaXMuX2NvbnRleHQudmlld01vZGVsLmdldExpbmVDb250ZW50KHBvc2l0aW9uLmxpbmVOdW1iZXIpO1xuXHRcdFx0Y29uc3QgY2hhckJlZm9yZSA9IGxpbmVDb250ZW50LmNoYXJBdChwb3NpdGlvbi5jb2x1bW4gLSAyKTtcblx0XHRcdGlmICghc3RyaW5ncy5pc0hpZ2hTdXJyb2dhdGUoY2hhckJlZm9yZS5jaGFyQ29kZUF0KDApKSkge1xuXHRcdFx0XHRyZXR1cm4gY2hhckJlZm9yZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuICcnO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2V0QWNjZXNzaWJpbGl0eU9wdGlvbnMob3B0aW9uczogSUNvbXB1dGVkRWRpdG9yT3B0aW9ucyk6IHZvaWQge1xuXHRcdHRoaXMuX2FjY2Vzc2liaWxpdHlTdXBwb3J0ID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmFjY2Vzc2liaWxpdHlTdXBwb3J0KTtcblx0XHRjb25zdCBhY2Nlc3NpYmlsaXR5UGFnZVNpemUgPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24uYWNjZXNzaWJpbGl0eVBhZ2VTaXplKTtcblx0XHRpZiAodGhpcy5fYWNjZXNzaWJpbGl0eVN1cHBvcnQgPT09IEFjY2Vzc2liaWxpdHlTdXBwb3J0LkVuYWJsZWQgJiYgYWNjZXNzaWJpbGl0eVBhZ2VTaXplID09PSBFZGl0b3JPcHRpb25zLmFjY2Vzc2liaWxpdHlQYWdlU2l6ZS5kZWZhdWx0VmFsdWUpIHtcblx0XHRcdC8vIElmIGEgc2NyZWVuIHJlYWRlciBpcyBhdHRhY2hlZCBhbmQgdGhlIGRlZmF1bHQgdmFsdWUgaXMgbm90IHNldCB3ZSBzaG91bGQgYXV0b21hdGljYWxseSBpbmNyZWFzZSB0aGUgcGFnZSBzaXplIHRvIDUwMCBmb3IgYSBiZXR0ZXIgZXhwZXJpZW5jZVxuXHRcdFx0dGhpcy5fYWNjZXNzaWJpbGl0eVBhZ2VTaXplID0gNTAwO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9hY2Nlc3NpYmlsaXR5UGFnZVNpemUgPSBhY2Nlc3NpYmlsaXR5UGFnZVNpemU7XG5cdFx0fVxuXG5cdFx0Ly8gV2hlbiB3cmFwcGluZyBpcyBlbmFibGVkIGFuZCBhIHNjcmVlbiByZWFkZXIgbWlnaHQgYmUgYXR0YWNoZWQsXG5cdFx0Ly8gd2Ugd2lsbCBzaXplIHRoZSB0ZXh0YXJlYSB0byBtYXRjaCB0aGUgd2lkdGggdXNlZCBmb3Igd3JhcHBpbmcgcG9pbnRzIGNvbXB1dGF0aW9uIChzZWUgYGRvbUxpbmVCcmVha3NDb21wdXRlci50c2ApLlxuXHRcdC8vIFRoaXMgaXMgYmVjYXVzZSBzY3JlZW4gcmVhZGVycyB3aWxsIHJlYWQgdGhlIHRleHQgaW4gdGhlIHRleHRhcmVhIGFuZCB3ZSdkIGxpa2UgdGhhdCB0aGVcblx0XHQvLyB3cmFwcGluZyBwb2ludHMgaW4gdGhlIHRleHRhcmVhIG1hdGNoIHRoZSB3cmFwcGluZyBwb2ludHMgaW4gdGhlIGVkaXRvci5cblx0XHRjb25zdCBsYXlvdXRJbmZvID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmxheW91dEluZm8pO1xuXHRcdGNvbnN0IHdyYXBwaW5nQ29sdW1uID0gbGF5b3V0SW5mby53cmFwcGluZ0NvbHVtbjtcblx0XHRpZiAod3JhcHBpbmdDb2x1bW4gIT09IC0xICYmIHRoaXMuX2FjY2Vzc2liaWxpdHlTdXBwb3J0ICE9PSBBY2Nlc3NpYmlsaXR5U3VwcG9ydC5EaXNhYmxlZCkge1xuXHRcdFx0Y29uc3QgZm9udEluZm8gPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24uZm9udEluZm8pO1xuXHRcdFx0dGhpcy5fdGV4dEFyZWFXcmFwcGluZyA9IHRydWU7XG5cdFx0XHR0aGlzLl90ZXh0QXJlYVdpZHRoID0gTWF0aC5yb3VuZCh3cmFwcGluZ0NvbHVtbiAqIGZvbnRJbmZvLnR5cGljYWxIYWxmd2lkdGhDaGFyYWN0ZXJXaWR0aCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX3RleHRBcmVhV3JhcHBpbmcgPSBmYWxzZTtcblx0XHRcdHRoaXMuX3RleHRBcmVhV2lkdGggPSAoY2FuVXNlWmVyb1NpemVUZXh0YXJlYSA/IDAgOiAxKTtcblx0XHR9XG5cdH1cblxuXHQvLyAtLS0gYmVnaW4gZXZlbnQgaGFuZGxlcnNcblxuXHRwdWJsaWMgb3ZlcnJpZGUgb25Db25maWd1cmF0aW9uQ2hhbmdlZChlOiB2aWV3RXZlbnRzLlZpZXdDb25maWd1cmF0aW9uQ2hhbmdlZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0Y29uc3Qgb3B0aW9ucyA9IHRoaXMuX2NvbnRleHQuY29uZmlndXJhdGlvbi5vcHRpb25zO1xuXHRcdGNvbnN0IGxheW91dEluZm8gPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24ubGF5b3V0SW5mbyk7XG5cblx0XHR0aGlzLl9zZXRBY2Nlc3NpYmlsaXR5T3B0aW9ucyhvcHRpb25zKTtcblx0XHR0aGlzLl9jb250ZW50TGVmdCA9IGxheW91dEluZm8uY29udGVudExlZnQ7XG5cdFx0dGhpcy5fY29udGVudFdpZHRoID0gbGF5b3V0SW5mby5jb250ZW50V2lkdGg7XG5cdFx0dGhpcy5fY29udGVudEhlaWdodCA9IGxheW91dEluZm8uaGVpZ2h0O1xuXHRcdHRoaXMuX2ZvbnRJbmZvID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmZvbnRJbmZvKTtcblx0XHR0aGlzLl9saW5lSGVpZ2h0ID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmxpbmVIZWlnaHQpO1xuXHRcdHRoaXMuX2VtcHR5U2VsZWN0aW9uQ2xpcGJvYXJkID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmVtcHR5U2VsZWN0aW9uQ2xpcGJvYXJkKTtcblx0XHR0aGlzLl9jb3B5V2l0aFN5bnRheEhpZ2hsaWdodGluZyA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5jb3B5V2l0aFN5bnRheEhpZ2hsaWdodGluZyk7XG5cdFx0dGhpcy50ZXh0QXJlYS5zZXRBdHRyaWJ1dGUoJ3dyYXAnLCB0aGlzLl90ZXh0QXJlYVdyYXBwaW5nICYmICF0aGlzLl92aXNpYmxlVGV4dEFyZWEgPyAnb24nIDogJ29mZicpO1xuXHRcdGNvbnN0IHsgdGFiU2l6ZSB9ID0gdGhpcy5fY29udGV4dC52aWV3TW9kZWwubW9kZWwuZ2V0T3B0aW9ucygpO1xuXHRcdHRoaXMudGV4dEFyZWEuZG9tTm9kZS5zdHlsZS50YWJTaXplID0gYCR7dGFiU2l6ZSAqIHRoaXMuX2ZvbnRJbmZvLnNwYWNlV2lkdGh9cHhgO1xuXHRcdHRoaXMudGV4dEFyZWEuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgYXJpYUxhYmVsRm9yU2NyZWVuUmVhZGVyQ29udGVudChvcHRpb25zLCB0aGlzLl9rZXliaW5kaW5nU2VydmljZSkpO1xuXHRcdHRoaXMudGV4dEFyZWEuc2V0QXR0cmlidXRlKCdhcmlhLXJlcXVpcmVkJywgb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmFyaWFSZXF1aXJlZCkgPyAndHJ1ZScgOiAnZmFsc2UnKTtcblx0XHR0aGlzLnRleHRBcmVhLnNldEF0dHJpYnV0ZSgndGFiaW5kZXgnLCBTdHJpbmcob3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLnRhYkluZGV4KSkpO1xuXG5cdFx0aWYgKGUuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24uZG9tUmVhZE9ubHkpIHx8IGUuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24ucmVhZE9ubHkpKSB7XG5cdFx0XHR0aGlzLl9lbnN1cmVSZWFkT25seUF0dHJpYnV0ZSgpO1xuXHRcdH1cblxuXHRcdGlmIChlLmhhc0NoYW5nZWQoRWRpdG9yT3B0aW9uLmFjY2Vzc2liaWxpdHlTdXBwb3J0KSkge1xuXHRcdFx0dGhpcy5fdGV4dEFyZWFJbnB1dC53cml0ZU5hdGl2ZVRleHRBcmVhQ29udGVudCgnc3RyYXRlZ3kgY2hhbmdlZCcpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdHB1YmxpYyBvdmVycmlkZSBvbkN1cnNvclN0YXRlQ2hhbmdlZChlOiB2aWV3RXZlbnRzLlZpZXdDdXJzb3JTdGF0ZUNoYW5nZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHRoaXMuX3NlbGVjdGlvbnMgPSBlLnNlbGVjdGlvbnMuc2xpY2UoMCk7XG5cdFx0dGhpcy5fbW9kZWxTZWxlY3Rpb25zID0gZS5tb2RlbFNlbGVjdGlvbnMuc2xpY2UoMCk7XG5cdFx0Ly8gV2UgbXVzdCB1cGRhdGUgdGhlIDx0ZXh0YXJlYT4gc3luY2hyb25vdXNseSwgb3RoZXJ3aXNlIGxvbmcgcHJlc3MgSU1FIG9uIG1hY29zIGJyZWFrcy5cblx0XHQvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzE2NTgyMVxuXHRcdHRoaXMuX3RleHRBcmVhSW5wdXQud3JpdGVOYXRpdmVUZXh0QXJlYUNvbnRlbnQoJ3NlbGVjdGlvbiBjaGFuZ2VkJyk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblx0cHVibGljIG92ZXJyaWRlIG9uRGVjb3JhdGlvbnNDaGFuZ2VkKGU6IHZpZXdFdmVudHMuVmlld0RlY29yYXRpb25zQ2hhbmdlZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0Ly8gdHJ1ZSBmb3IgaW5saW5lIGRlY29yYXRpb25zIHRoYXQgY2FuIGVuZCB1cCByZWxheW91dGluZyB0ZXh0XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblx0cHVibGljIG92ZXJyaWRlIG9uRmx1c2hlZChlOiB2aWV3RXZlbnRzLlZpZXdGbHVzaGVkRXZlbnQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXHRwdWJsaWMgb3ZlcnJpZGUgb25MaW5lc0NoYW5nZWQoZTogdmlld0V2ZW50cy5WaWV3TGluZXNDaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXHRwdWJsaWMgb3ZlcnJpZGUgb25MaW5lc0RlbGV0ZWQoZTogdmlld0V2ZW50cy5WaWV3TGluZXNEZWxldGVkRXZlbnQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXHRwdWJsaWMgb3ZlcnJpZGUgb25MaW5lc0luc2VydGVkKGU6IHZpZXdFdmVudHMuVmlld0xpbmVzSW5zZXJ0ZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdHB1YmxpYyBvdmVycmlkZSBvblNjcm9sbENoYW5nZWQoZTogdmlld0V2ZW50cy5WaWV3U2Nyb2xsQ2hhbmdlZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0dGhpcy5fc2Nyb2xsTGVmdCA9IGUuc2Nyb2xsTGVmdDtcblx0XHR0aGlzLl9zY3JvbGxUb3AgPSBlLnNjcm9sbFRvcDtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXHRwdWJsaWMgb3ZlcnJpZGUgb25ab25lc0NoYW5nZWQoZTogdmlld0V2ZW50cy5WaWV3Wm9uZXNDaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8vIC0tLSBlbmQgZXZlbnQgaGFuZGxlcnNcblxuXHQvLyAtLS0gYmVnaW4gdmlldyBBUElcblxuXHRwdWJsaWMgaXNGb2N1c2VkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl90ZXh0QXJlYUlucHV0LmlzRm9jdXNlZCgpO1xuXHR9XG5cblx0cHVibGljIGZvY3VzKCk6IHZvaWQge1xuXHRcdHRoaXMuX3RleHRBcmVhSW5wdXQuZm9jdXNUZXh0QXJlYSgpO1xuXHR9XG5cblx0cHVibGljIHJlZnJlc2hGb2N1c1N0YXRlKCkge1xuXHRcdHRoaXMuX3RleHRBcmVhSW5wdXQucmVmcmVzaEZvY3VzU3RhdGUoKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRMYXN0UmVuZGVyRGF0YSgpOiBQb3NpdGlvbiB8IG51bGwge1xuXHRcdHJldHVybiB0aGlzLl9sYXN0UmVuZGVyUG9zaXRpb247XG5cdH1cblxuXHRwdWJsaWMgc2V0QXJpYU9wdGlvbnMob3B0aW9uczogSUVkaXRvckFyaWFPcHRpb25zKTogdm9pZCB7XG5cdFx0aWYgKG9wdGlvbnMuYWN0aXZlRGVzY2VuZGFudCkge1xuXHRcdFx0dGhpcy50ZXh0QXJlYS5zZXRBdHRyaWJ1dGUoJ2FyaWEtaGFzcG9wdXAnLCAndHJ1ZScpO1xuXHRcdFx0dGhpcy50ZXh0QXJlYS5zZXRBdHRyaWJ1dGUoJ2FyaWEtYXV0b2NvbXBsZXRlJywgJ2xpc3QnKTtcblx0XHRcdHRoaXMudGV4dEFyZWEuc2V0QXR0cmlidXRlKCdhcmlhLWFjdGl2ZWRlc2NlbmRhbnQnLCBvcHRpb25zLmFjdGl2ZURlc2NlbmRhbnQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnRleHRBcmVhLnNldEF0dHJpYnV0ZSgnYXJpYS1oYXNwb3B1cCcsICdmYWxzZScpO1xuXHRcdFx0dGhpcy50ZXh0QXJlYS5zZXRBdHRyaWJ1dGUoJ2FyaWEtYXV0b2NvbXBsZXRlJywgJ2JvdGgnKTtcblx0XHRcdHRoaXMudGV4dEFyZWEucmVtb3ZlQXR0cmlidXRlKCdhcmlhLWFjdGl2ZWRlc2NlbmRhbnQnKTtcblx0XHR9XG5cdFx0aWYgKG9wdGlvbnMucm9sZSkge1xuXHRcdFx0dGhpcy50ZXh0QXJlYS5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCBvcHRpb25zLnJvbGUpO1xuXHRcdH1cblx0fVxuXG5cdC8vIC0tLSBlbmQgdmlldyBBUElcblxuXHRwcml2YXRlIF9lbnN1cmVSZWFkT25seUF0dHJpYnV0ZSgpOiB2b2lkIHtcblx0XHRjb25zdCBvcHRpb25zID0gdGhpcy5fY29udGV4dC5jb25maWd1cmF0aW9uLm9wdGlvbnM7XG5cdFx0Ly8gV2hlbiBzb21lb25lIHJlcXVlc3RzIHRvIGRpc2FibGUgSU1FLCB3ZSBzZXQgdGhlIFwicmVhZG9ubHlcIiBhdHRyaWJ1dGUgb24gdGhlIDx0ZXh0YXJlYT4uXG5cdFx0Ly8gVGhpcyB3aWxsIHByZXZlbnQgY29tcG9zaXRpb24uXG5cdFx0Y29uc3QgdXNlUmVhZE9ubHkgPSAhSU1FLmVuYWJsZWQgfHwgKG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5kb21SZWFkT25seSkgJiYgb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLnJlYWRPbmx5KSk7XG5cdFx0aWYgKHVzZVJlYWRPbmx5KSB7XG5cdFx0XHR0aGlzLnRleHRBcmVhLnNldEF0dHJpYnV0ZSgncmVhZG9ubHknLCAndHJ1ZScpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnRleHRBcmVhLnJlbW92ZUF0dHJpYnV0ZSgncmVhZG9ubHknKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9wcmltYXJ5Q3Vyc29yUG9zaXRpb246IFBvc2l0aW9uID0gbmV3IFBvc2l0aW9uKDEsIDEpO1xuXHRwcml2YXRlIF9wcmltYXJ5Q3Vyc29yVmlzaWJsZVJhbmdlOiBIb3Jpem9udGFsUG9zaXRpb24gfCBudWxsID0gbnVsbDtcblxuXHRwdWJsaWMgcHJlcGFyZVJlbmRlcihjdHg6IFJlbmRlcmluZ0NvbnRleHQpOiB2b2lkIHtcblx0XHR0aGlzLl9wcmltYXJ5Q3Vyc29yUG9zaXRpb24gPSBuZXcgUG9zaXRpb24odGhpcy5fc2VsZWN0aW9uc1swXS5wb3NpdGlvbkxpbmVOdW1iZXIsIHRoaXMuX3NlbGVjdGlvbnNbMF0ucG9zaXRpb25Db2x1bW4pO1xuXHRcdHRoaXMuX3ByaW1hcnlDdXJzb3JWaXNpYmxlUmFuZ2UgPSBjdHgudmlzaWJsZVJhbmdlRm9yUG9zaXRpb24odGhpcy5fcHJpbWFyeUN1cnNvclBvc2l0aW9uKTtcblx0XHR0aGlzLl92aXNpYmxlVGV4dEFyZWE/LnByZXBhcmVSZW5kZXIoY3R4KTtcblx0fVxuXG5cdHB1YmxpYyByZW5kZXIoY3R4OiBSZXN0cmljdGVkUmVuZGVyaW5nQ29udGV4dCk6IHZvaWQge1xuXHRcdHRoaXMuX3RleHRBcmVhSW5wdXQud3JpdGVOYXRpdmVUZXh0QXJlYUNvbnRlbnQoJ3JlbmRlcicpO1xuXHRcdHRoaXMuX3JlbmRlcigpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVuZGVyKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl92aXNpYmxlVGV4dEFyZWEpIHtcblx0XHRcdC8vIFRoZSB0ZXh0IGFyZWEgaXMgdmlzaWJsZSBmb3IgY29tcG9zaXRpb24gcmVhc29uc1xuXG5cdFx0XHRjb25zdCB2aXNpYmxlU3RhcnQgPSB0aGlzLl92aXNpYmxlVGV4dEFyZWEudmlzaWJsZVRleHRhcmVhU3RhcnQ7XG5cdFx0XHRjb25zdCB2aXNpYmxlRW5kID0gdGhpcy5fdmlzaWJsZVRleHRBcmVhLnZpc2libGVUZXh0YXJlYUVuZDtcblx0XHRcdGNvbnN0IHN0YXJ0UG9zaXRpb24gPSB0aGlzLl92aXNpYmxlVGV4dEFyZWEuc3RhcnRQb3NpdGlvbjtcblx0XHRcdGNvbnN0IGVuZFBvc2l0aW9uID0gdGhpcy5fdmlzaWJsZVRleHRBcmVhLmVuZFBvc2l0aW9uO1xuXHRcdFx0aWYgKHN0YXJ0UG9zaXRpb24gJiYgZW5kUG9zaXRpb24gJiYgdmlzaWJsZVN0YXJ0ICYmIHZpc2libGVFbmQgJiYgdmlzaWJsZUVuZC5sZWZ0ID49IHRoaXMuX3Njcm9sbExlZnQgJiYgdmlzaWJsZVN0YXJ0LmxlZnQgPD0gdGhpcy5fc2Nyb2xsTGVmdCArIHRoaXMuX2NvbnRlbnRXaWR0aCkge1xuXHRcdFx0XHRjb25zdCB0b3AgPSAodGhpcy5fY29udGV4dC52aWV3TGF5b3V0LmdldFZlcnRpY2FsT2Zmc2V0Rm9yTGluZU51bWJlcih0aGlzLl9wcmltYXJ5Q3Vyc29yUG9zaXRpb24ubGluZU51bWJlcikgLSB0aGlzLl9zY3JvbGxUb3ApO1xuXHRcdFx0XHRjb25zdCBsaW5lQ291bnQgPSBuZXdsaW5lY291bnQodGhpcy50ZXh0QXJlYS5kb21Ob2RlLnZhbHVlLnN1YnN0cigwLCB0aGlzLnRleHRBcmVhLmRvbU5vZGUuc2VsZWN0aW9uU3RhcnQpKTtcblxuXHRcdFx0XHRsZXQgc2Nyb2xsTGVmdCA9IHRoaXMuX3Zpc2libGVUZXh0QXJlYS53aWR0aE9mSGlkZGVuTGluZVRleHRCZWZvcmU7XG5cdFx0XHRcdGxldCBsZWZ0ID0gKHRoaXMuX2NvbnRlbnRMZWZ0ICsgdmlzaWJsZVN0YXJ0LmxlZnQgLSB0aGlzLl9zY3JvbGxMZWZ0KTtcblx0XHRcdFx0Ly8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xNDE3MjUjaXNzdWVjb21tZW50LTEwNTA2NzA4NDFcblx0XHRcdFx0Ly8gSGVyZSB3ZSBhcmUgYWRkaW5nICsxIHRvIGF2b2lkIGZsaWNrZXJpbmcgdGhhdCBtaWdodCBiZSBjYXVzZWQgYnkgaGF2aW5nIGEgd2lkdGggdGhhdCBpcyB0b28gc21hbGwuXG5cdFx0XHRcdC8vIFRoaXMgY291bGQgYmUgY2F1c2VkIGJ5IHJvdW5kaW5nIGVycm9ycyB0aGF0IG1pZ2h0IG9ubHkgc2hvdyB1cCB3aXRoIGNlcnRhaW4gZm9udCBmYW1pbGllcy5cblx0XHRcdFx0Ly8gSW4gb3RoZXIgd29yZHMsIGEgcGl4ZWwgbWlnaHQgYmUgbG9zdCB3aGVuIGRvaW5nIHNvbWV0aGluZyBsaWtlXG5cdFx0XHRcdC8vICAgICAgYE1hdGgucm91bmQoZW5kKSAtIE1hdGgucm91bmQoc3RhcnQpYFxuXHRcdFx0XHQvLyB2c1xuXHRcdFx0XHQvLyAgICAgIGBNYXRoLnJvdW5kKGVuZCAtIHN0YXJ0KWBcblx0XHRcdFx0bGV0IHdpZHRoID0gdmlzaWJsZUVuZC5sZWZ0IC0gdmlzaWJsZVN0YXJ0LmxlZnQgKyAxO1xuXHRcdFx0XHRpZiAobGVmdCA8IHRoaXMuX2NvbnRlbnRMZWZ0KSB7XG5cdFx0XHRcdFx0Ly8gdGhlIHRleHRhcmVhIHdvdWxkIGJlIHJlbmRlcmVkIG9uIHRvcCBvZiB0aGUgbWFyZ2luLFxuXHRcdFx0XHRcdC8vIHNvIHJlZHVjZSBpdHMgd2lkdGguIFdlIHVzZSB0aGUgc2FtZSB0ZWNobmlxdWUgYXNcblx0XHRcdFx0XHQvLyBmb3IgaGlkaW5nIHRleHQgYmVmb3JlXG5cdFx0XHRcdFx0Y29uc3QgZGVsdGEgPSAodGhpcy5fY29udGVudExlZnQgLSBsZWZ0KTtcblx0XHRcdFx0XHRsZWZ0ICs9IGRlbHRhO1xuXHRcdFx0XHRcdHNjcm9sbExlZnQgKz0gZGVsdGE7XG5cdFx0XHRcdFx0d2lkdGggLT0gZGVsdGE7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHdpZHRoID4gdGhpcy5fY29udGVudFdpZHRoKSB7XG5cdFx0XHRcdFx0Ly8gdGhlIHRleHRhcmVhIHdvdWxkIGJlIHdpZGVyIHRoYW4gdGhlIGNvbnRlbnQgd2lkdGgsXG5cdFx0XHRcdFx0Ly8gc28gcmVkdWNlIGl0cyB3aWR0aC5cblx0XHRcdFx0XHR3aWR0aCA9IHRoaXMuX2NvbnRlbnRXaWR0aDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFRyeSB0byByZW5kZXIgdGhlIHRleHRhcmVhIHdpdGggdGhlIGNvbG9yL2ZvbnQgc3R5bGUgdG8gbWF0Y2ggdGhlIHRleHQgdW5kZXIgaXRcblx0XHRcdFx0Y29uc3Qgdmlld0xpbmVEYXRhID0gdGhpcy5fY29udGV4dC52aWV3TW9kZWwuZ2V0Vmlld0xpbmVEYXRhKHN0YXJ0UG9zaXRpb24ubGluZU51bWJlcik7XG5cdFx0XHRcdGNvbnN0IHN0YXJ0VG9rZW5JbmRleCA9IHZpZXdMaW5lRGF0YS50b2tlbnMuZmluZFRva2VuSW5kZXhBdE9mZnNldChzdGFydFBvc2l0aW9uLmNvbHVtbiAtIDEpO1xuXHRcdFx0XHRjb25zdCBlbmRUb2tlbkluZGV4ID0gdmlld0xpbmVEYXRhLnRva2Vucy5maW5kVG9rZW5JbmRleEF0T2Zmc2V0KGVuZFBvc2l0aW9uLmNvbHVtbiAtIDEpO1xuXHRcdFx0XHRjb25zdCB0ZXh0YXJlYVNwYW5zU2luZ2xlVG9rZW4gPSAoc3RhcnRUb2tlbkluZGV4ID09PSBlbmRUb2tlbkluZGV4KTtcblx0XHRcdFx0Y29uc3QgcHJlc2VudGF0aW9uID0gdGhpcy5fdmlzaWJsZVRleHRBcmVhLmRlZmluZVByZXNlbnRhdGlvbihcblx0XHRcdFx0XHQodGV4dGFyZWFTcGFuc1NpbmdsZVRva2VuID8gdmlld0xpbmVEYXRhLnRva2Vucy5nZXRQcmVzZW50YXRpb24oc3RhcnRUb2tlbkluZGV4KSA6IG51bGwpXG5cdFx0XHRcdCk7XG5cblx0XHRcdFx0dGhpcy50ZXh0QXJlYS5kb21Ob2RlLnNjcm9sbFRvcCA9IGxpbmVDb3VudCAqIHRoaXMuX2xpbmVIZWlnaHQ7XG5cdFx0XHRcdHRoaXMudGV4dEFyZWEuZG9tTm9kZS5zY3JvbGxMZWZ0ID0gc2Nyb2xsTGVmdDtcblxuXHRcdFx0XHR0aGlzLl9kb1JlbmRlcih7XG5cdFx0XHRcdFx0bGFzdFJlbmRlclBvc2l0aW9uOiBudWxsLFxuXHRcdFx0XHRcdHRvcDogdG9wLFxuXHRcdFx0XHRcdGxlZnQ6IGxlZnQsXG5cdFx0XHRcdFx0d2lkdGg6IHdpZHRoLFxuXHRcdFx0XHRcdGhlaWdodDogdGhpcy5fbGluZUhlaWdodCxcblx0XHRcdFx0XHR1c2VDb3ZlcjogZmFsc2UsXG5cdFx0XHRcdFx0Y29sb3I6IChUb2tlbml6YXRpb25SZWdpc3RyeS5nZXRDb2xvck1hcCgpIHx8IFtdKVtwcmVzZW50YXRpb24uZm9yZWdyb3VuZF0sXG5cdFx0XHRcdFx0aXRhbGljOiBwcmVzZW50YXRpb24uaXRhbGljLFxuXHRcdFx0XHRcdGJvbGQ6IHByZXNlbnRhdGlvbi5ib2xkLFxuXHRcdFx0XHRcdHVuZGVybGluZTogcHJlc2VudGF0aW9uLnVuZGVybGluZSxcblx0XHRcdFx0XHRzdHJpa2V0aHJvdWdoOiBwcmVzZW50YXRpb24uc3RyaWtldGhyb3VnaFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuX3ByaW1hcnlDdXJzb3JWaXNpYmxlUmFuZ2UpIHtcblx0XHRcdC8vIFRoZSBwcmltYXJ5IGN1cnNvciBpcyBvdXRzaWRlIHRoZSB2aWV3cG9ydCA9PiBwbGFjZSB0ZXh0YXJlYSB0byB0aGUgdG9wIGxlZnRcblx0XHRcdHRoaXMuX3JlbmRlckF0VG9wTGVmdCgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGxlZnQgPSB0aGlzLl9jb250ZW50TGVmdCArIHRoaXMuX3ByaW1hcnlDdXJzb3JWaXNpYmxlUmFuZ2UubGVmdCAtIHRoaXMuX3Njcm9sbExlZnQ7XG5cdFx0aWYgKGxlZnQgPCB0aGlzLl9jb250ZW50TGVmdCB8fCBsZWZ0ID4gdGhpcy5fY29udGVudExlZnQgKyB0aGlzLl9jb250ZW50V2lkdGgpIHtcblx0XHRcdC8vIGN1cnNvciBpcyBvdXRzaWRlIHRoZSB2aWV3cG9ydFxuXHRcdFx0dGhpcy5fcmVuZGVyQXRUb3BMZWZ0KCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdG9wID0gdGhpcy5fY29udGV4dC52aWV3TGF5b3V0LmdldFZlcnRpY2FsT2Zmc2V0Rm9yTGluZU51bWJlcih0aGlzLl9zZWxlY3Rpb25zWzBdLnBvc2l0aW9uTGluZU51bWJlcikgLSB0aGlzLl9zY3JvbGxUb3A7XG5cdFx0aWYgKHRvcCA8IDAgfHwgdG9wID4gdGhpcy5fY29udGVudEhlaWdodCkge1xuXHRcdFx0Ly8gY3Vyc29yIGlzIG91dHNpZGUgdGhlIHZpZXdwb3J0XG5cdFx0XHR0aGlzLl9yZW5kZXJBdFRvcExlZnQoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBUaGUgcHJpbWFyeSBjdXJzb3IgaXMgaW4gdGhlIHZpZXdwb3J0IChhdCBsZWFzdCB2ZXJ0aWNhbGx5KSA9PiBwbGFjZSB0ZXh0YXJlYSBvbiB0aGUgY3Vyc29yXG5cblx0XHRpZiAocGxhdGZvcm0uaXNNYWNpbnRvc2ggfHwgdGhpcy5fYWNjZXNzaWJpbGl0eVN1cHBvcnQgPT09IEFjY2Vzc2liaWxpdHlTdXBwb3J0LkVuYWJsZWQpIHtcblx0XHRcdC8vIEZvciB0aGUgcG9wdXAgZW1vamkgaW5wdXQsIHdlIHdpbGwgbWFrZSB0aGUgdGV4dCBhcmVhIGFzIGhpZ2ggYXMgdGhlIGxpbmUgaGVpZ2h0XG5cdFx0XHQvLyBXZSB3aWxsIGFsc28gbWFrZSB0aGUgZm9udFNpemUgYW5kIGxpbmVIZWlnaHQgdGhlIGNvcnJlY3QgZGltZW5zaW9ucyB0byBoZWxwIHdpdGggdGhlIHBsYWNlbWVudCBvZiB0aGVzZSBwaWNrZXJzXG5cdFx0XHR0aGlzLl9kb1JlbmRlcih7XG5cdFx0XHRcdGxhc3RSZW5kZXJQb3NpdGlvbjogdGhpcy5fcHJpbWFyeUN1cnNvclBvc2l0aW9uLFxuXHRcdFx0XHR0b3AsXG5cdFx0XHRcdGxlZnQ6IHRoaXMuX3RleHRBcmVhV3JhcHBpbmcgPyB0aGlzLl9jb250ZW50TGVmdCA6IGxlZnQsXG5cdFx0XHRcdHdpZHRoOiB0aGlzLl90ZXh0QXJlYVdpZHRoLFxuXHRcdFx0XHRoZWlnaHQ6IHRoaXMuX2xpbmVIZWlnaHQsXG5cdFx0XHRcdHVzZUNvdmVyOiBmYWxzZVxuXHRcdFx0fSk7XG5cdFx0XHQvLyBJbiBjYXNlIHRoZSB0ZXh0YXJlYSBjb250YWlucyBhIHdvcmQsIHdlJ3JlIGdvaW5nIHRvIHRyeSB0byBhbGlnbiB0aGUgdGV4dGFyZWEncyBjdXJzb3Jcblx0XHRcdC8vIHdpdGggb3VyIGN1cnNvciBieSBzY3JvbGxpbmcgdGhlIHRleHRhcmVhIGFzIG11Y2ggYXMgcG9zc2libGVcblx0XHRcdHRoaXMudGV4dEFyZWEuZG9tTm9kZS5zY3JvbGxMZWZ0ID0gdGhpcy5fcHJpbWFyeUN1cnNvclZpc2libGVSYW5nZS5sZWZ0O1xuXHRcdFx0Y29uc3QgbGluZUNvdW50ID0gdGhpcy5fdGV4dEFyZWFJbnB1dC50ZXh0QXJlYVN0YXRlLm5ld2xpbmVDb3VudEJlZm9yZVNlbGVjdGlvbiA/PyBuZXdsaW5lY291bnQodGhpcy50ZXh0QXJlYS5kb21Ob2RlLnZhbHVlLnN1YnN0cmluZygwLCB0aGlzLnRleHRBcmVhLmRvbU5vZGUuc2VsZWN0aW9uU3RhcnQpKTtcblx0XHRcdHRoaXMudGV4dEFyZWEuZG9tTm9kZS5zY3JvbGxUb3AgPSBsaW5lQ291bnQgKiB0aGlzLl9saW5lSGVpZ2h0O1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX2RvUmVuZGVyKHtcblx0XHRcdGxhc3RSZW5kZXJQb3NpdGlvbjogdGhpcy5fcHJpbWFyeUN1cnNvclBvc2l0aW9uLFxuXHRcdFx0dG9wOiB0b3AsXG5cdFx0XHRsZWZ0OiB0aGlzLl90ZXh0QXJlYVdyYXBwaW5nID8gdGhpcy5fY29udGVudExlZnQgOiBsZWZ0LFxuXHRcdFx0d2lkdGg6IHRoaXMuX3RleHRBcmVhV2lkdGgsXG5cdFx0XHRoZWlnaHQ6IChjYW5Vc2VaZXJvU2l6ZVRleHRhcmVhID8gMCA6IDEpLFxuXHRcdFx0dXNlQ292ZXI6IGZhbHNlXG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9yZW5kZXJBdFRvcExlZnQoKTogdm9pZCB7XG5cdFx0Ly8gKGluIFdlYktpdCB0aGUgdGV4dGFyZWEgaXMgMXB4IGJ5IDFweCBiZWNhdXNlIGl0IGNhbm5vdCBoYW5kbGUgaW5wdXQgdG8gYSAweDAgdGV4dGFyZWEpXG5cdFx0Ly8gc3BlY2lmaWNhbGx5LCB3aGVuIGRvaW5nIEtvcmVhbiBJTUUsIHNldHRpbmcgdGhlIHRleHRhcmVhIHRvIDB4MCBicmVha3MgSU1FIGJhZGx5LlxuXHRcdHRoaXMuX2RvUmVuZGVyKHtcblx0XHRcdGxhc3RSZW5kZXJQb3NpdGlvbjogbnVsbCxcblx0XHRcdHRvcDogMCxcblx0XHRcdGxlZnQ6IDAsXG5cdFx0XHR3aWR0aDogdGhpcy5fdGV4dEFyZWFXaWR0aCxcblx0XHRcdGhlaWdodDogKGNhblVzZVplcm9TaXplVGV4dGFyZWEgPyAwIDogMSksXG5cdFx0XHR1c2VDb3ZlcjogdHJ1ZVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfZG9SZW5kZXIocmVuZGVyRGF0YTogSVJlbmRlckRhdGEpOiB2b2lkIHtcblx0XHR0aGlzLl9sYXN0UmVuZGVyUG9zaXRpb24gPSByZW5kZXJEYXRhLmxhc3RSZW5kZXJQb3NpdGlvbjtcblxuXHRcdGNvbnN0IHRhID0gdGhpcy50ZXh0QXJlYTtcblx0XHRjb25zdCB0YWMgPSB0aGlzLnRleHRBcmVhQ292ZXI7XG5cblx0XHRhcHBseUZvbnRJbmZvKHRhLCB0aGlzLl9mb250SW5mbyk7XG5cdFx0dGEuc2V0VG9wKHJlbmRlckRhdGEudG9wKTtcblx0XHR0YS5zZXRMZWZ0KHJlbmRlckRhdGEubGVmdCk7XG5cdFx0dGEuc2V0V2lkdGgocmVuZGVyRGF0YS53aWR0aCk7XG5cdFx0dGEuc2V0SGVpZ2h0KHJlbmRlckRhdGEuaGVpZ2h0KTtcblxuXHRcdHRhLnNldENvbG9yKHJlbmRlckRhdGEuY29sb3IgPyBDb2xvci5Gb3JtYXQuQ1NTLmZvcm1hdEhleChyZW5kZXJEYXRhLmNvbG9yKSA6ICcnKTtcblx0XHR0YS5zZXRGb250U3R5bGUocmVuZGVyRGF0YS5pdGFsaWMgPyAnaXRhbGljJyA6ICcnKTtcblx0XHRpZiAocmVuZGVyRGF0YS5ib2xkKSB7XG5cdFx0XHQvLyBmb250V2VpZ2h0IGlzIGFsc28gc2V0IGJ5IGBhcHBseUZvbnRJbmZvYCwgc28gb25seSBvdmVyd3JpdGUgaXQgaWYgbmVjZXNzYXJ5XG5cdFx0XHR0YS5zZXRGb250V2VpZ2h0KCdib2xkJyk7XG5cdFx0fVxuXHRcdHRhLnNldFRleHREZWNvcmF0aW9uKGAke3JlbmRlckRhdGEudW5kZXJsaW5lID8gJyB1bmRlcmxpbmUnIDogJyd9JHtyZW5kZXJEYXRhLnN0cmlrZXRocm91Z2ggPyAnIGxpbmUtdGhyb3VnaCcgOiAnJ31gKTtcblxuXHRcdHRhYy5zZXRUb3AocmVuZGVyRGF0YS51c2VDb3ZlciA/IHJlbmRlckRhdGEudG9wIDogMCk7XG5cdFx0dGFjLnNldExlZnQocmVuZGVyRGF0YS51c2VDb3ZlciA/IHJlbmRlckRhdGEubGVmdCA6IDApO1xuXHRcdHRhYy5zZXRXaWR0aChyZW5kZXJEYXRhLnVzZUNvdmVyID8gcmVuZGVyRGF0YS53aWR0aCA6IDApO1xuXHRcdHRhYy5zZXRIZWlnaHQocmVuZGVyRGF0YS51c2VDb3ZlciA/IHJlbmRlckRhdGEuaGVpZ2h0IDogMCk7XG5cblx0XHRjb25zdCBvcHRpb25zID0gdGhpcy5fY29udGV4dC5jb25maWd1cmF0aW9uLm9wdGlvbnM7XG5cblx0XHRpZiAob3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmdseXBoTWFyZ2luKSkge1xuXHRcdFx0dGFjLnNldENsYXNzTmFtZSgnbW9uYWNvLWVkaXRvci1iYWNrZ3JvdW5kIHRleHRBcmVhQ292ZXIgJyArIE1hcmdpbi5PVVRFUl9DTEFTU19OQU1FKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5saW5lTnVtYmVycykucmVuZGVyVHlwZSAhPT0gUmVuZGVyTGluZU51bWJlcnNUeXBlLk9mZikge1xuXHRcdFx0XHR0YWMuc2V0Q2xhc3NOYW1lKCdtb25hY28tZWRpdG9yLWJhY2tncm91bmQgdGV4dEFyZWFDb3ZlciAnICsgTGluZU51bWJlcnNPdmVybGF5LkNMQVNTX05BTUUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGFjLnNldENsYXNzTmFtZSgnbW9uYWNvLWVkaXRvci1iYWNrZ3JvdW5kIHRleHRBcmVhQ292ZXInKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cblxuaW50ZXJmYWNlIElSZW5kZXJEYXRhIHtcblx0bGFzdFJlbmRlclBvc2l0aW9uOiBQb3NpdGlvbiB8IG51bGw7XG5cdHRvcDogbnVtYmVyO1xuXHRsZWZ0OiBudW1iZXI7XG5cdHdpZHRoOiBudW1iZXI7XG5cdGhlaWdodDogbnVtYmVyO1xuXHR1c2VDb3ZlcjogYm9vbGVhbjtcblxuXHRjb2xvcj86IENvbG9yIHwgbnVsbDtcblx0aXRhbGljPzogYm9vbGVhbjtcblx0Ym9sZD86IGJvb2xlYW47XG5cdHVuZGVybGluZT86IGJvb2xlYW47XG5cdHN0cmlrZXRocm91Z2g/OiBib29sZWFuO1xufVxuXG5mdW5jdGlvbiBtZWFzdXJlVGV4dCh0YXJnZXREb2N1bWVudDogRG9jdW1lbnQsIHRleHQ6IHN0cmluZywgZm9udEluZm86IEZvbnRJbmZvLCB0YWJTaXplOiBudW1iZXIpOiBudW1iZXIge1xuXHRpZiAodGV4dC5sZW5ndGggPT09IDApIHtcblx0XHRyZXR1cm4gMDtcblx0fVxuXG5cdGNvbnN0IGNvbnRhaW5lciA9IHRhcmdldERvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRjb250YWluZXIuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuXHRjb250YWluZXIuc3R5bGUudG9wID0gJy01MDAwMHB4Jztcblx0Y29udGFpbmVyLnN0eWxlLndpZHRoID0gJzUwMDAwcHgnO1xuXG5cdGNvbnN0IHJlZ3VsYXJEb21Ob2RlID0gdGFyZ2V0RG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuXHRhcHBseUZvbnRJbmZvKHJlZ3VsYXJEb21Ob2RlLCBmb250SW5mbyk7XG5cdHJlZ3VsYXJEb21Ob2RlLnN0eWxlLndoaXRlU3BhY2UgPSAncHJlJzsgLy8ganVzdCBsaWtlIHRoZSB0ZXh0YXJlYVxuXHRyZWd1bGFyRG9tTm9kZS5zdHlsZS50YWJTaXplID0gYCR7dGFiU2l6ZSAqIGZvbnRJbmZvLnNwYWNlV2lkdGh9cHhgOyAvLyBqdXN0IGxpa2UgdGhlIHRleHRhcmVhXG5cdHJlZ3VsYXJEb21Ob2RlLmFwcGVuZCh0ZXh0KTtcblx0Y29udGFpbmVyLmFwcGVuZENoaWxkKHJlZ3VsYXJEb21Ob2RlKTtcblxuXHR0YXJnZXREb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGNvbnRhaW5lcik7XG5cblx0Y29uc3QgcmVzID0gcmVndWxhckRvbU5vZGUub2Zmc2V0V2lkdGg7XG5cblx0Y29udGFpbmVyLnJlbW92ZSgpO1xuXG5cdHJldHVybiByZXM7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLE9BQU87QUFDUCxZQUFZLFNBQVM7QUFDckIsWUFBWSxhQUFhO0FBQ3pCLFNBQXNCLHlCQUF5QjtBQUUvQyxZQUFZLGNBQWM7QUFDMUIsWUFBWSxhQUFhO0FBQ3pCLFNBQVMscUJBQXFCO0FBRTlCLFNBQVMsaUJBQWlCLHdCQUF3QjtBQUNsRCxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLGNBQWM7QUFDdkIsU0FBUyx1QkFBdUIsY0FBc0MscUJBQXFCO0FB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QUFJLFFBQVEsSUFBSSxhQUFhLFdBQVcsRUFBRSxlQUFlLHNCQUFzQixLQUFLO0FBQ25GLFlBQUksYUFBYSw0Q0FBNEMsbUJBQW1CLFVBQVU7QUFBQSxNQUMzRixPQUFPO0FBQ04sWUFBSSxhQUFhLHdDQUF3QztBQUFBLE1BQzFEO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFDRDtBQTV2QmEsc0JBQU47QUFBQSxFQXlDSjtBQUFBLEVBQ0E7QUFBQSxHQTFDVTtBQTZ3QmIsU0FBUyxZQUFZLGdCQUEwQixNQUFjLFVBQW9CLFNBQXlCO0FBQ3pHLE1BQUksS0FBSyxXQUFXLEdBQUc7QUFDdEIsV0FBTztBQUFBLEVBQ1I7QUFFQSxRQUFNLFlBQVksZUFBZSxjQUFjLEtBQUs7QUFDcEQsWUFBVSxNQUFNLFdBQVc7QUFDM0IsWUFBVSxNQUFNLE1BQU07QUFDdEIsWUFBVSxNQUFNLFFBQVE7QUFFeEIsUUFBTSxpQkFBaUIsZUFBZSxjQUFjLE1BQU07QUFDMUQsZ0JBQWMsZ0JBQWdCLFFBQVE7QUFDdEMsaUJBQWUsTUFBTSxhQUFhO0FBQ2xDLGlCQUFlLE1BQU0sVUFBVSxHQUFHLFVBQVUsU0FBUyxVQUFVO0FBQy9ELGlCQUFlLE9BQU8sSUFBSTtBQUMxQixZQUFVLFlBQVksY0FBYztBQUVwQyxpQkFBZSxLQUFLLFlBQVksU0FBUztBQUV6QyxRQUFNLE1BQU0sZUFBZTtBQUUzQixZQUFVLE9BQU87QUFFakIsU0FBTztBQUNSOyIsCiAgIm5hbWVzIjogWyJkaXN0YW5jZVRvTW9kZWxMaW5lU3RhcnQiLCAidGFiU2l6ZSIsICJ3aWR0aE9mSGlkZGVuVGV4dEJlZm9yZSIsICJkaXN0YW5jZVRvTW9kZWxMaW5lRW5kIiwgInRvcCIsICJsZWZ0Il0KfQo=
