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
import * as browser from "../../../../../base/browser/browser.js";
import * as dom from "../../../../../base/browser/dom.js";
import { DomEmitter } from "../../../../../base/browser/event.js";
import { StandardKeyboardEvent } from "../../../../../base/browser/keyboardEvent.js";
import { inputLatency } from "../../../../../base/browser/performance.js";
import { RunOnceScheduler } from "../../../../../base/common/async.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { KeyCode } from "../../../../../base/common/keyCodes.js";
import { Disposable, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { OperatingSystem } from "../../../../../base/common/platform.js";
import * as strings from "../../../../../base/common/strings.js";
import { Selection } from "../../../../common/core/selection.js";
import { IAccessibilityService } from "../../../../../platform/accessibility/common/accessibility.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { ClipboardEventUtils, InMemoryClipboardMetadataManager } from "../clipboardUtils.js";
import { _debugComposition, TextAreaState } from "./textAreaEditContextState.js";
var TextAreaSyntethicEvents;
((TextAreaSyntethicEvents2) => {
  TextAreaSyntethicEvents2.Tap = "-monaco-textarea-synthetic-tap";
})(TextAreaSyntethicEvents || (TextAreaSyntethicEvents = {}));
class CompositionContext {
  constructor() {
    this._lastTypeTextLength = 0;
  }
  handleCompositionUpdate(text) {
    text = text || "";
    const typeInput = {
      text,
      replacePrevCharCnt: this._lastTypeTextLength,
      replaceNextCharCnt: 0,
      positionDelta: 0
    };
    this._lastTypeTextLength = text.length;
    return typeInput;
  }
}
let TextAreaInput = class extends Disposable {
  constructor(_host, _textArea, _OS, _browser, _accessibilityService, _logService) {
    super();
    this._host = _host;
    this._textArea = _textArea;
    this._OS = _OS;
    this._browser = _browser;
    this._accessibilityService = _accessibilityService;
    this._logService = _logService;
    this._onFocus = this._register(new Emitter());
    this.onFocus = this._onFocus.event;
    this._onBlur = this._register(new Emitter());
    this.onBlur = this._onBlur.event;
    this._onKeyDown = this._register(new Emitter());
    this.onKeyDown = this._onKeyDown.event;
    this._onKeyUp = this._register(new Emitter());
    this.onKeyUp = this._onKeyUp.event;
    this._onCut = this._register(new Emitter());
    this.onCut = this._onCut.event;
    this._onPaste = this._register(new Emitter());
    this.onPaste = this._onPaste.event;
    this._onType = this._register(new Emitter());
    this.onType = this._onType.event;
    this._onCompositionStart = this._register(new Emitter());
    this.onCompositionStart = this._onCompositionStart.event;
    this._onCompositionUpdate = this._register(new Emitter());
    this.onCompositionUpdate = this._onCompositionUpdate.event;
    this._onCompositionEnd = this._register(new Emitter());
    this.onCompositionEnd = this._onCompositionEnd.event;
    this._onSelectionChangeRequest = this._register(new Emitter());
    this.onSelectionChangeRequest = this._onSelectionChangeRequest.event;
    this._asyncFocusGainWriteScreenReaderContent = this._register(new MutableDisposable());
    this._asyncTriggerCut = this._register(new RunOnceScheduler(() => this._onCut.fire(), 0));
    this._textAreaState = TextAreaState.EMPTY;
    this._selectionChangeListener = null;
    if (this._accessibilityService.isScreenReaderOptimized()) {
      this.writeNativeTextAreaContent("ctor");
    }
    this._register(Event.runAndSubscribe(this._accessibilityService.onDidChangeScreenReaderOptimized, () => {
      if (this._accessibilityService.isScreenReaderOptimized() && !this._asyncFocusGainWriteScreenReaderContent.value) {
        this._asyncFocusGainWriteScreenReaderContent.value = this._register(new RunOnceScheduler(() => this.writeNativeTextAreaContent("asyncFocusGain"), 0));
      } else {
        this._asyncFocusGainWriteScreenReaderContent.clear();
      }
    }));
    this._hasFocus = false;
    this._currentComposition = null;
    let lastKeyDown = null;
    this._register(this._textArea.onKeyDown((_e) => {
      const e = new StandardKeyboardEvent(_e);
      if (e.keyCode === KeyCode.KEY_IN_COMPOSITION || this._currentComposition && e.keyCode === KeyCode.Backspace) {
        e.stopPropagation();
      }
      if (e.equals(KeyCode.Escape)) {
        e.preventDefault();
      }
      lastKeyDown = e;
      this._onKeyDown.fire(e);
    }));
    this._register(this._textArea.onKeyUp((_e) => {
      const e = new StandardKeyboardEvent(_e);
      this._onKeyUp.fire(e);
    }));
    this._register(this._textArea.onCompositionStart((e) => {
      if (_debugComposition) {
        console.log(`[compositionstart]`, e);
      }
      const currentComposition = new CompositionContext();
      if (this._currentComposition) {
        this._currentComposition = currentComposition;
        return;
      }
      this._currentComposition = currentComposition;
      if (this._OS === OperatingSystem.Macintosh && lastKeyDown && lastKeyDown.equals(KeyCode.KEY_IN_COMPOSITION) && this._textAreaState.selectionStart === this._textAreaState.selectionEnd && this._textAreaState.selectionStart > 0 && this._textAreaState.value.substr(this._textAreaState.selectionStart - 1, 1) === e.data && (lastKeyDown.code === "ArrowRight" || lastKeyDown.code === "ArrowLeft")) {
        if (_debugComposition) {
          console.log(`[compositionstart] Handling long press case on macOS + arrow key`, e);
        }
        currentComposition.handleCompositionUpdate("x");
        this._onCompositionStart.fire({ data: e.data });
        return;
      }
      if (this._browser.isAndroid) {
        this._onCompositionStart.fire({ data: e.data });
        return;
      }
      this._onCompositionStart.fire({ data: e.data });
    }));
    this._register(this._textArea.onCompositionUpdate((e) => {
      if (_debugComposition) {
        console.log(`[compositionupdate]`, e);
      }
      const currentComposition = this._currentComposition;
      if (!currentComposition) {
        return;
      }
      if (this._browser.isAndroid) {
        const newState = TextAreaState.readFromTextArea(this._textArea, this._textAreaState);
        const typeInput2 = TextAreaState.deduceAndroidCompositionInput(this._textAreaState, newState);
        this._textAreaState = newState;
        this._onType.fire(typeInput2);
        this._onCompositionUpdate.fire(e);
        return;
      }
      const typeInput = currentComposition.handleCompositionUpdate(e.data);
      this._textAreaState = TextAreaState.readFromTextArea(this._textArea, this._textAreaState);
      this._onType.fire(typeInput);
      this._onCompositionUpdate.fire(e);
    }));
    this._register(this._textArea.onCompositionEnd((e) => {
      if (_debugComposition) {
        console.log(`[compositionend]`, e);
      }
      const currentComposition = this._currentComposition;
      if (!currentComposition) {
        return;
      }
      this._currentComposition = null;
      if (this._browser.isAndroid) {
        const newState = TextAreaState.readFromTextArea(this._textArea, this._textAreaState);
        const typeInput2 = TextAreaState.deduceAndroidCompositionInput(this._textAreaState, newState);
        this._textAreaState = newState;
        this._onType.fire(typeInput2);
        this._onCompositionEnd.fire();
        return;
      }
      const typeInput = currentComposition.handleCompositionUpdate(e.data);
      this._textAreaState = TextAreaState.readFromTextArea(this._textArea, this._textAreaState);
      this._onType.fire(typeInput);
      this._onCompositionEnd.fire();
    }));
    this._register(this._textArea.onInput((e) => {
      if (_debugComposition) {
        console.log(`[input]`, e);
      }
      this._textArea.setIgnoreSelectionChangeTime("received input event");
      if (this._currentComposition) {
        return;
      }
      const newState = TextAreaState.readFromTextArea(this._textArea, this._textAreaState);
      const typeInput = TextAreaState.deduceInput(
        this._textAreaState,
        newState,
        /*couldBeEmojiInput*/
        this._OS === OperatingSystem.Macintosh
      );
      if (typeInput.replacePrevCharCnt === 0 && typeInput.text.length === 1) {
        if (strings.isHighSurrogate(typeInput.text.charCodeAt(0)) || typeInput.text.charCodeAt(0) === 127) {
          return;
        }
      }
      this._textAreaState = newState;
      if (typeInput.text !== "" || typeInput.replacePrevCharCnt !== 0 || typeInput.replaceNextCharCnt !== 0 || typeInput.positionDelta !== 0) {
        this._onType.fire(typeInput);
      }
    }));
    this._register(this._textArea.onCut((e) => {
      this._textArea.setIgnoreSelectionChangeTime("received cut event");
      this._ensureClipboardGetsEditorSelection(e);
      this._asyncTriggerCut.schedule();
    }));
    this._register(this._textArea.onCopy((e) => {
      this._ensureClipboardGetsEditorSelection(e);
    }));
    this._register(this._textArea.onPaste((e) => {
      this._textArea.setIgnoreSelectionChangeTime("received paste event");
      e.preventDefault();
      if (!e.clipboardData) {
        return;
      }
      let [text, metadata] = ClipboardEventUtils.getTextData(e.clipboardData);
      if (!text) {
        return;
      }
      metadata = metadata || InMemoryClipboardMetadataManager.INSTANCE.get(text);
      this._onPaste.fire({
        text,
        metadata
      });
    }));
    this._register(this._textArea.onFocus(() => {
      const hadFocus = this._hasFocus;
      this._setHasFocus(true);
      if (this._accessibilityService.isScreenReaderOptimized() && this._browser.isSafari && !hadFocus && this._hasFocus) {
        if (!this._asyncFocusGainWriteScreenReaderContent.value) {
          this._asyncFocusGainWriteScreenReaderContent.value = new RunOnceScheduler(() => this.writeNativeTextAreaContent("asyncFocusGain"), 0);
        }
        this._asyncFocusGainWriteScreenReaderContent.value.schedule();
      }
    }));
    this._register(this._textArea.onBlur(() => {
      if (this._currentComposition) {
        this._currentComposition = null;
        this.writeNativeTextAreaContent("blurWithoutCompositionEnd");
        this._onCompositionEnd.fire();
      }
      this._setHasFocus(false);
    }));
    this._register(this._textArea.onSyntheticTap(() => {
      if (this._browser.isAndroid && this._currentComposition) {
        this._currentComposition = null;
        this.writeNativeTextAreaContent("tapWithoutCompositionEnd");
        this._onCompositionEnd.fire();
      }
    }));
  }
  get textAreaState() {
    return this._textAreaState;
  }
  _initializeFromTest() {
    this._hasFocus = true;
    this._textAreaState = TextAreaState.readFromTextArea(this._textArea, null);
  }
  _installSelectionChangeListener() {
    let previousSelectionChangeEventTime = 0;
    return dom.addDisposableListener(this._textArea.ownerDocument, "selectionchange", (e) => {
      inputLatency.onSelectionChange();
      if (!this._hasFocus) {
        return;
      }
      if (this._currentComposition) {
        return;
      }
      if (!this._browser.isChrome) {
        return;
      }
      const now = Date.now();
      const delta1 = now - previousSelectionChangeEventTime;
      previousSelectionChangeEventTime = now;
      if (delta1 < 5) {
        return;
      }
      const delta2 = now - this._textArea.getIgnoreSelectionChangeTime();
      this._textArea.resetSelectionChangeTime();
      if (delta2 < 100) {
        return;
      }
      if (!this._textAreaState.selection) {
        return;
      }
      const newValue = this._textArea.getValue();
      if (this._textAreaState.value !== newValue) {
        return;
      }
      const newSelectionStart = this._textArea.getSelectionStart();
      const newSelectionEnd = this._textArea.getSelectionEnd();
      if (this._textAreaState.selectionStart === newSelectionStart && this._textAreaState.selectionEnd === newSelectionEnd) {
        return;
      }
      const _newSelectionStartPosition = this._textAreaState.deduceEditorPosition(newSelectionStart);
      const newSelectionStartPosition = this._host.deduceModelPosition(_newSelectionStartPosition[0], _newSelectionStartPosition[1], _newSelectionStartPosition[2]);
      const _newSelectionEndPosition = this._textAreaState.deduceEditorPosition(newSelectionEnd);
      const newSelectionEndPosition = this._host.deduceModelPosition(_newSelectionEndPosition[0], _newSelectionEndPosition[1], _newSelectionEndPosition[2]);
      const newSelection = new Selection(
        newSelectionStartPosition.lineNumber,
        newSelectionStartPosition.column,
        newSelectionEndPosition.lineNumber,
        newSelectionEndPosition.column
      );
      this._onSelectionChangeRequest.fire(newSelection);
    });
  }
  dispose() {
    super.dispose();
    if (this._selectionChangeListener) {
      this._selectionChangeListener.dispose();
      this._selectionChangeListener = null;
    }
  }
  focusTextArea() {
    this._setHasFocus(true);
    this.refreshFocusState();
  }
  isFocused() {
    return this._hasFocus;
  }
  refreshFocusState() {
    this._setHasFocus(this._textArea.hasFocus());
  }
  _setHasFocus(newHasFocus) {
    if (this._hasFocus === newHasFocus) {
      return;
    }
    this._hasFocus = newHasFocus;
    if (this._selectionChangeListener) {
      this._selectionChangeListener.dispose();
      this._selectionChangeListener = null;
    }
    if (this._hasFocus) {
      this._selectionChangeListener = this._installSelectionChangeListener();
    }
    if (this._hasFocus) {
      this.writeNativeTextAreaContent("focusgain");
    }
    if (this._hasFocus) {
      this._onFocus.fire();
    } else {
      this._onBlur.fire();
    }
  }
  _setAndWriteTextAreaState(reason, textAreaState) {
    if (!this._hasFocus) {
      textAreaState = textAreaState.collapseSelection();
    }
    if (!textAreaState.isWrittenToTextArea(this._textArea, this._hasFocus)) {
      this._logService.trace(`writeTextAreaState(reason: ${reason})`);
    }
    textAreaState.writeToTextArea(reason, this._textArea, this._hasFocus);
    this._textAreaState = textAreaState;
  }
  writeNativeTextAreaContent(reason) {
    if (!this._accessibilityService.isScreenReaderOptimized() && reason === "render" || this._currentComposition) {
      return;
    }
    this._setAndWriteTextAreaState(reason, this._host.getScreenReaderContent());
  }
  _ensureClipboardGetsEditorSelection(e) {
    const dataToCopy = this._host.getDataToCopy();
    const storedMetadata = {
      version: 1,
      isFromEmptySelection: dataToCopy.isFromEmptySelection,
      multicursorText: dataToCopy.multicursorText,
      mode: dataToCopy.mode
    };
    InMemoryClipboardMetadataManager.INSTANCE.set(
      // When writing "LINE\r\n" to the clipboard and then pasting,
      // Firefox pastes "LINE\n", so let's work around this quirk
      this._browser.isFirefox ? dataToCopy.text.replace(/\r\n/g, "\n") : dataToCopy.text,
      storedMetadata
    );
    e.preventDefault();
    if (e.clipboardData) {
      ClipboardEventUtils.setTextData(e.clipboardData, dataToCopy.text, dataToCopy.html, storedMetadata);
    }
  }
};
TextAreaInput = __decorateClass([
  __decorateParam(4, IAccessibilityService),
  __decorateParam(5, ILogService)
], TextAreaInput);
class TextAreaWrapper extends Disposable {
  constructor(_actual) {
    super();
    this._actual = _actual;
    this.onKeyDown = this._register(new DomEmitter(this._actual, "keydown")).event;
    this.onKeyPress = this._register(new DomEmitter(this._actual, "keypress")).event;
    this.onKeyUp = this._register(new DomEmitter(this._actual, "keyup")).event;
    this.onCompositionStart = this._register(new DomEmitter(this._actual, "compositionstart")).event;
    this.onCompositionUpdate = this._register(new DomEmitter(this._actual, "compositionupdate")).event;
    this.onCompositionEnd = this._register(new DomEmitter(this._actual, "compositionend")).event;
    this.onBeforeInput = this._register(new DomEmitter(this._actual, "beforeinput")).event;
    this.onInput = this._register(new DomEmitter(this._actual, "input")).event;
    this.onCut = this._register(new DomEmitter(this._actual, "cut")).event;
    this.onCopy = this._register(new DomEmitter(this._actual, "copy")).event;
    this.onPaste = this._register(new DomEmitter(this._actual, "paste")).event;
    this.onFocus = this._register(new DomEmitter(this._actual, "focus")).event;
    this.onBlur = this._register(new DomEmitter(this._actual, "blur")).event;
    this._onSyntheticTap = this._register(new Emitter());
    this.onSyntheticTap = this._onSyntheticTap.event;
    this._ignoreSelectionChangeTime = 0;
    this._register(this.onKeyDown(() => inputLatency.onKeyDown()));
    this._register(this.onBeforeInput(() => inputLatency.onBeforeInput()));
    this._register(this.onInput(() => inputLatency.onInput()));
    this._register(this.onKeyUp(() => inputLatency.onKeyUp()));
    this._register(dom.addDisposableListener(this._actual, TextAreaSyntethicEvents.Tap, () => this._onSyntheticTap.fire()));
  }
  get ownerDocument() {
    return this._actual.ownerDocument;
  }
  hasFocus() {
    const shadowRoot = dom.getShadowRoot(this._actual);
    if (shadowRoot) {
      return shadowRoot.activeElement === this._actual;
    } else if (this._actual.isConnected) {
      return dom.getActiveElement() === this._actual;
    } else {
      return false;
    }
  }
  setIgnoreSelectionChangeTime(reason) {
    this._ignoreSelectionChangeTime = Date.now();
  }
  getIgnoreSelectionChangeTime() {
    return this._ignoreSelectionChangeTime;
  }
  resetSelectionChangeTime() {
    this._ignoreSelectionChangeTime = 0;
  }
  getValue() {
    return this._actual.value;
  }
  setValue(reason, value) {
    const textArea = this._actual;
    if (textArea.value === value) {
      return;
    }
    this.setIgnoreSelectionChangeTime("setValue");
    textArea.value = value;
  }
  getSelectionStart() {
    return this._actual.selectionDirection === "backward" ? this._actual.selectionEnd : this._actual.selectionStart;
  }
  getSelectionEnd() {
    return this._actual.selectionDirection === "backward" ? this._actual.selectionStart : this._actual.selectionEnd;
  }
  setSelectionRange(reason, selectionStart, selectionEnd) {
    const textArea = this._actual;
    let activeElement = null;
    const shadowRoot = dom.getShadowRoot(textArea);
    if (shadowRoot) {
      activeElement = shadowRoot.activeElement;
    } else {
      activeElement = dom.getActiveElement();
    }
    const activeWindow = dom.getWindow(activeElement);
    const currentIsFocused = activeElement === textArea;
    const currentSelectionStart = textArea.selectionStart;
    const currentSelectionEnd = textArea.selectionEnd;
    if (currentIsFocused && currentSelectionStart === selectionStart && currentSelectionEnd === selectionEnd) {
      if (browser.isFirefox && activeWindow.parent !== activeWindow) {
        textArea.focus();
      }
      return;
    }
    if (currentIsFocused) {
      this.setIgnoreSelectionChangeTime("setSelectionRange");
      textArea.setSelectionRange(selectionStart, selectionEnd);
      if (browser.isFirefox && activeWindow.parent !== activeWindow) {
        textArea.focus();
      }
      return;
    }
    try {
      const scrollState = dom.saveParentsScrollTop(textArea);
      this.setIgnoreSelectionChangeTime("setSelectionRange");
      textArea.focus();
      textArea.setSelectionRange(selectionStart, selectionEnd);
      dom.restoreParentsScrollTop(textArea, scrollState);
    } catch (e) {
    }
  }
}
export {
  TextAreaInput,
  TextAreaSyntethicEvents,
  TextAreaWrapper
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci9jb250cm9sbGVyL2VkaXRDb250ZXh0L3RleHRBcmVhL3RleHRBcmVhRWRpdENvbnRleHRJbnB1dC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGJyb3dzZXIgZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2Jyb3dzZXIuanMnO1xuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgRG9tRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9ldmVudC5qcyc7XG5pbXBvcnQgeyBJS2V5Ym9hcmRFdmVudCwgU3RhbmRhcmRLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2tleWJvYXJkRXZlbnQuanMnO1xuaW1wb3J0IHsgaW5wdXRMYXRlbmN5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3BlcmZvcm1hbmNlLmpzJztcbmltcG9ydCB7IFJ1bk9uY2VTY2hlZHVsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBJRGlzcG9zYWJsZSwgTXV0YWJsZURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgT3BlcmF0aW5nU3lzdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0ICogYXMgc3RyaW5ncyBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IElBY2Nlc3NpYmlsaXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvY29tbW9uL2FjY2Vzc2liaWxpdHkuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBDbGlwYm9hcmREYXRhVG9Db3B5LCBDbGlwYm9hcmRFdmVudFV0aWxzLCBDbGlwYm9hcmRTdG9yZWRNZXRhZGF0YSwgSW5NZW1vcnlDbGlwYm9hcmRNZXRhZGF0YU1hbmFnZXIgfSBmcm9tICcuLi9jbGlwYm9hcmRVdGlscy5qcyc7XG5pbXBvcnQgeyBfZGVidWdDb21wb3NpdGlvbiwgSVRleHRBcmVhV3JhcHBlciwgSVR5cGVEYXRhLCBUZXh0QXJlYVN0YXRlIH0gZnJvbSAnLi90ZXh0QXJlYUVkaXRDb250ZXh0U3RhdGUuanMnO1xuXG5leHBvcnQgbmFtZXNwYWNlIFRleHRBcmVhU3ludGV0aGljRXZlbnRzIHtcblx0ZXhwb3J0IGNvbnN0IFRhcCA9ICctbW9uYWNvLXRleHRhcmVhLXN5bnRoZXRpYy10YXAnO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDb21wb3NpdGlvbkRhdGEge1xuXHRkYXRhOiBzdHJpbmc7XG59XG5cblxuZXhwb3J0IGludGVyZmFjZSBJUGFzdGVEYXRhIHtcblx0dGV4dDogc3RyaW5nO1xuXHRtZXRhZGF0YTogQ2xpcGJvYXJkU3RvcmVkTWV0YWRhdGEgfCBudWxsO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElUZXh0QXJlYUlucHV0SG9zdCB7XG5cdGdldERhdGFUb0NvcHkoKTogQ2xpcGJvYXJkRGF0YVRvQ29weTtcblx0Z2V0U2NyZWVuUmVhZGVyQ29udGVudCgpOiBUZXh0QXJlYVN0YXRlO1xuXHRkZWR1Y2VNb2RlbFBvc2l0aW9uKHZpZXdBbmNob3JQb3NpdGlvbjogUG9zaXRpb24sIGRlbHRhT2Zmc2V0OiBudW1iZXIsIGxpbmVGZWVkQ250OiBudW1iZXIpOiBQb3NpdGlvbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ29tcG9zaXRpb25TdGFydEV2ZW50IHtcblx0ZGF0YTogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDb21wbGV0ZVRleHRBcmVhV3JhcHBlciBleHRlbmRzIElUZXh0QXJlYVdyYXBwZXIge1xuXHRyZWFkb25seSBvbktleURvd246IEV2ZW50PEtleWJvYXJkRXZlbnQ+O1xuXHRyZWFkb25seSBvbktleVByZXNzOiBFdmVudDxLZXlib2FyZEV2ZW50Pjtcblx0cmVhZG9ubHkgb25LZXlVcDogRXZlbnQ8S2V5Ym9hcmRFdmVudD47XG5cdHJlYWRvbmx5IG9uQ29tcG9zaXRpb25TdGFydDogRXZlbnQ8Q29tcG9zaXRpb25FdmVudD47XG5cdHJlYWRvbmx5IG9uQ29tcG9zaXRpb25VcGRhdGU6IEV2ZW50PENvbXBvc2l0aW9uRXZlbnQ+O1xuXHRyZWFkb25seSBvbkNvbXBvc2l0aW9uRW5kOiBFdmVudDxDb21wb3NpdGlvbkV2ZW50Pjtcblx0cmVhZG9ubHkgb25CZWZvcmVJbnB1dDogRXZlbnQ8SW5wdXRFdmVudD47XG5cdHJlYWRvbmx5IG9uSW5wdXQ6IEV2ZW50PElucHV0RXZlbnQ+O1xuXHRyZWFkb25seSBvbkN1dDogRXZlbnQ8Q2xpcGJvYXJkRXZlbnQ+O1xuXHRyZWFkb25seSBvbkNvcHk6IEV2ZW50PENsaXBib2FyZEV2ZW50Pjtcblx0cmVhZG9ubHkgb25QYXN0ZTogRXZlbnQ8Q2xpcGJvYXJkRXZlbnQ+O1xuXHRyZWFkb25seSBvbkZvY3VzOiBFdmVudDxGb2N1c0V2ZW50Pjtcblx0cmVhZG9ubHkgb25CbHVyOiBFdmVudDxGb2N1c0V2ZW50Pjtcblx0cmVhZG9ubHkgb25TeW50aGV0aWNUYXA6IEV2ZW50PHZvaWQ+O1xuXG5cdHJlYWRvbmx5IG93bmVyRG9jdW1lbnQ6IERvY3VtZW50O1xuXG5cdHNldElnbm9yZVNlbGVjdGlvbkNoYW5nZVRpbWUocmVhc29uOiBzdHJpbmcpOiB2b2lkO1xuXHRnZXRJZ25vcmVTZWxlY3Rpb25DaGFuZ2VUaW1lKCk6IG51bWJlcjtcblx0cmVzZXRTZWxlY3Rpb25DaGFuZ2VUaW1lKCk6IHZvaWQ7XG5cblx0aGFzRm9jdXMoKTogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQnJvd3NlciB7XG5cdGlzQW5kcm9pZDogYm9vbGVhbjtcblx0aXNGaXJlZm94OiBib29sZWFuO1xuXHRpc0Nocm9tZTogYm9vbGVhbjtcblx0aXNTYWZhcmk6IGJvb2xlYW47XG59XG5cbmNsYXNzIENvbXBvc2l0aW9uQ29udGV4dCB7XG5cblx0cHJpdmF0ZSBfbGFzdFR5cGVUZXh0TGVuZ3RoOiBudW1iZXI7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0dGhpcy5fbGFzdFR5cGVUZXh0TGVuZ3RoID0gMDtcblx0fVxuXG5cdHB1YmxpYyBoYW5kbGVDb21wb3NpdGlvblVwZGF0ZSh0ZXh0OiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkKTogSVR5cGVEYXRhIHtcblx0XHR0ZXh0ID0gdGV4dCB8fCAnJztcblx0XHRjb25zdCB0eXBlSW5wdXQ6IElUeXBlRGF0YSA9IHtcblx0XHRcdHRleHQ6IHRleHQsXG5cdFx0XHRyZXBsYWNlUHJldkNoYXJDbnQ6IHRoaXMuX2xhc3RUeXBlVGV4dExlbmd0aCxcblx0XHRcdHJlcGxhY2VOZXh0Q2hhckNudDogMCxcblx0XHRcdHBvc2l0aW9uRGVsdGE6IDBcblx0XHR9O1xuXHRcdHRoaXMuX2xhc3RUeXBlVGV4dExlbmd0aCA9IHRleHQubGVuZ3RoO1xuXHRcdHJldHVybiB0eXBlSW5wdXQ7XG5cdH1cbn1cblxuLyoqXG4gKiBXcml0ZXMgc2NyZWVuIHJlYWRlciBjb250ZW50IHRvIHRoZSB0ZXh0YXJlYSBhbmQgaXMgYWJsZSB0byBhbmFseXplIGl0cyBpbnB1dCBldmVudHMgdG8gZ2VuZXJhdGU6XG4gKiAgLSBvbkN1dFxuICogIC0gb25QYXN0ZVxuICogIC0gb25UeXBlXG4gKlxuICogQ29tcG9zaXRpb24gZXZlbnRzIGFyZSBnZW5lcmF0ZWQgZm9yIHByZXNlbnRhdGlvbiBwdXJwb3NlcyAoY29tcG9zaXRpb24gaW5wdXQgaXMgcmVmbGVjdGVkIGluIG9uVHlwZSkuXG4gKi9cbmV4cG9ydCBjbGFzcyBUZXh0QXJlYUlucHV0IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSBfb25Gb2N1cyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25Gb2N1czogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkZvY3VzLmV2ZW50O1xuXG5cdHByaXZhdGUgX29uQmx1ciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25CbHVyOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uQmx1ci5ldmVudDtcblxuXHRwcml2YXRlIF9vbktleURvd24gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJS2V5Ym9hcmRFdmVudD4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbktleURvd246IEV2ZW50PElLZXlib2FyZEV2ZW50PiA9IHRoaXMuX29uS2V5RG93bi5ldmVudDtcblxuXHRwcml2YXRlIF9vbktleVVwID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SUtleWJvYXJkRXZlbnQ+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25LZXlVcDogRXZlbnQ8SUtleWJvYXJkRXZlbnQ+ID0gdGhpcy5fb25LZXlVcC5ldmVudDtcblxuXHRwcml2YXRlIF9vbkN1dCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25DdXQ6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25DdXQuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfb25QYXN0ZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElQYXN0ZURhdGE+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25QYXN0ZTogRXZlbnQ8SVBhc3RlRGF0YT4gPSB0aGlzLl9vblBhc3RlLmV2ZW50O1xuXG5cdHByaXZhdGUgX29uVHlwZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElUeXBlRGF0YT4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvblR5cGU6IEV2ZW50PElUeXBlRGF0YT4gPSB0aGlzLl9vblR5cGUuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfb25Db21wb3NpdGlvblN0YXJ0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SUNvbXBvc2l0aW9uU3RhcnRFdmVudD4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkNvbXBvc2l0aW9uU3RhcnQ6IEV2ZW50PElDb21wb3NpdGlvblN0YXJ0RXZlbnQ+ID0gdGhpcy5fb25Db21wb3NpdGlvblN0YXJ0LmV2ZW50O1xuXG5cdHByaXZhdGUgX29uQ29tcG9zaXRpb25VcGRhdGUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJQ29tcG9zaXRpb25EYXRhPigpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uQ29tcG9zaXRpb25VcGRhdGU6IEV2ZW50PElDb21wb3NpdGlvbkRhdGE+ID0gdGhpcy5fb25Db21wb3NpdGlvblVwZGF0ZS5ldmVudDtcblxuXHRwcml2YXRlIF9vbkNvbXBvc2l0aW9uRW5kID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkNvbXBvc2l0aW9uRW5kOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uQ29tcG9zaXRpb25FbmQuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfb25TZWxlY3Rpb25DaGFuZ2VSZXF1ZXN0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8U2VsZWN0aW9uPigpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uU2VsZWN0aW9uQ2hhbmdlUmVxdWVzdDogRXZlbnQ8U2VsZWN0aW9uPiA9IHRoaXMuX29uU2VsZWN0aW9uQ2hhbmdlUmVxdWVzdC5ldmVudDtcblxuXHQvLyAtLS1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9hc3luY1RyaWdnZXJDdXQ6IFJ1bk9uY2VTY2hlZHVsZXI7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfYXN5bmNGb2N1c0dhaW5Xcml0ZVNjcmVlblJlYWRlckNvbnRlbnQ6IE11dGFibGVEaXNwb3NhYmxlPFJ1bk9uY2VTY2hlZHVsZXI+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXG5cdHByaXZhdGUgX3RleHRBcmVhU3RhdGU6IFRleHRBcmVhU3RhdGU7XG5cblx0cHVibGljIGdldCB0ZXh0QXJlYVN0YXRlKCk6IFRleHRBcmVhU3RhdGUge1xuXHRcdHJldHVybiB0aGlzLl90ZXh0QXJlYVN0YXRlO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2VsZWN0aW9uQ2hhbmdlTGlzdGVuZXI6IElEaXNwb3NhYmxlIHwgbnVsbDtcblxuXHRwcml2YXRlIF9oYXNGb2N1czogYm9vbGVhbjtcblx0cHJpdmF0ZSBfY3VycmVudENvbXBvc2l0aW9uOiBDb21wb3NpdGlvbkNvbnRleHQgfCBudWxsO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2hvc3Q6IElUZXh0QXJlYUlucHV0SG9zdCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF90ZXh0QXJlYTogSUNvbXBsZXRlVGV4dEFyZWFXcmFwcGVyLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX09TOiBPcGVyYXRpbmdTeXN0ZW0sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfYnJvd3NlcjogSUJyb3dzZXIsXG5cdFx0QElBY2Nlc3NpYmlsaXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9hY2Nlc3NpYmlsaXR5U2VydmljZTogSUFjY2Vzc2liaWxpdHlTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX2FzeW5jVHJpZ2dlckN1dCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBSdW5PbmNlU2NoZWR1bGVyKCgpID0+IHRoaXMuX29uQ3V0LmZpcmUoKSwgMCkpO1xuXHRcdHRoaXMuX3RleHRBcmVhU3RhdGUgPSBUZXh0QXJlYVN0YXRlLkVNUFRZO1xuXHRcdHRoaXMuX3NlbGVjdGlvbkNoYW5nZUxpc3RlbmVyID0gbnVsbDtcblx0XHRpZiAodGhpcy5fYWNjZXNzaWJpbGl0eVNlcnZpY2UuaXNTY3JlZW5SZWFkZXJPcHRpbWl6ZWQoKSkge1xuXHRcdFx0dGhpcy53cml0ZU5hdGl2ZVRleHRBcmVhQ29udGVudCgnY3RvcicpO1xuXHRcdH1cblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5ydW5BbmRTdWJzY3JpYmUodGhpcy5fYWNjZXNzaWJpbGl0eVNlcnZpY2Uub25EaWRDaGFuZ2VTY3JlZW5SZWFkZXJPcHRpbWl6ZWQsICgpID0+IHtcblx0XHRcdGlmICh0aGlzLl9hY2Nlc3NpYmlsaXR5U2VydmljZS5pc1NjcmVlblJlYWRlck9wdGltaXplZCgpICYmICF0aGlzLl9hc3luY0ZvY3VzR2FpbldyaXRlU2NyZWVuUmVhZGVyQ29udGVudC52YWx1ZSkge1xuXHRcdFx0XHR0aGlzLl9hc3luY0ZvY3VzR2FpbldyaXRlU2NyZWVuUmVhZGVyQ29udGVudC52YWx1ZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBSdW5PbmNlU2NoZWR1bGVyKCgpID0+IHRoaXMud3JpdGVOYXRpdmVUZXh0QXJlYUNvbnRlbnQoJ2FzeW5jRm9jdXNHYWluJyksIDApKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX2FzeW5jRm9jdXNHYWluV3JpdGVTY3JlZW5SZWFkZXJDb250ZW50LmNsZWFyKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX2hhc0ZvY3VzID0gZmFsc2U7XG5cdFx0dGhpcy5fY3VycmVudENvbXBvc2l0aW9uID0gbnVsbDtcblxuXHRcdGxldCBsYXN0S2V5RG93bjogSUtleWJvYXJkRXZlbnQgfCBudWxsID0gbnVsbDtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3RleHRBcmVhLm9uS2V5RG93bigoX2UpID0+IHtcblx0XHRcdGNvbnN0IGUgPSBuZXcgU3RhbmRhcmRLZXlib2FyZEV2ZW50KF9lKTtcblx0XHRcdGlmIChlLmtleUNvZGUgPT09IEtleUNvZGUuS0VZX0lOX0NPTVBPU0lUSU9OXG5cdFx0XHRcdHx8ICh0aGlzLl9jdXJyZW50Q29tcG9zaXRpb24gJiYgZS5rZXlDb2RlID09PSBLZXlDb2RlLkJhY2tzcGFjZSkpIHtcblx0XHRcdFx0Ly8gU3RvcCBwcm9wYWdhdGlvbiBmb3Iga2V5RG93biBldmVudHMgaWYgdGhlIElNRSBpcyBwcm9jZXNzaW5nIGtleSBpbnB1dFxuXHRcdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZS5lcXVhbHMoS2V5Q29kZS5Fc2NhcGUpKSB7XG5cdFx0XHRcdC8vIFByZXZlbnQgZGVmYXVsdCBhbHdheXMgZm9yIGBFc2NgLCBvdGhlcndpc2UgaXQgd2lsbCBnZW5lcmF0ZSBhIGtleXByZXNzXG5cdFx0XHRcdC8vIFNlZSBodHRwczovL21zZG4ubWljcm9zb2Z0LmNvbS9lbi11cy9saWJyYXJ5L2llL21zNTM2OTM5KHY9dnMuODUpLmFzcHhcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0fVxuXG5cdFx0XHRsYXN0S2V5RG93biA9IGU7XG5cdFx0XHR0aGlzLl9vbktleURvd24uZmlyZShlKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl90ZXh0QXJlYS5vbktleVVwKChfZSkgPT4ge1xuXHRcdFx0Y29uc3QgZSA9IG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoX2UpO1xuXHRcdFx0dGhpcy5fb25LZXlVcC5maXJlKGUpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3RleHRBcmVhLm9uQ29tcG9zaXRpb25TdGFydCgoZSkgPT4ge1xuXHRcdFx0aWYgKF9kZWJ1Z0NvbXBvc2l0aW9uKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKGBbY29tcG9zaXRpb25zdGFydF1gLCBlKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgY3VycmVudENvbXBvc2l0aW9uID0gbmV3IENvbXBvc2l0aW9uQ29udGV4dCgpO1xuXHRcdFx0aWYgKHRoaXMuX2N1cnJlbnRDb21wb3NpdGlvbikge1xuXHRcdFx0XHQvLyBzaW1wbHkgcmVzZXQgdGhlIGNvbXBvc2l0aW9uIGNvbnRleHRcblx0XHRcdFx0dGhpcy5fY3VycmVudENvbXBvc2l0aW9uID0gY3VycmVudENvbXBvc2l0aW9uO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9jdXJyZW50Q29tcG9zaXRpb24gPSBjdXJyZW50Q29tcG9zaXRpb247XG5cblx0XHRcdGlmIChcblx0XHRcdFx0dGhpcy5fT1MgPT09IE9wZXJhdGluZ1N5c3RlbS5NYWNpbnRvc2hcblx0XHRcdFx0JiYgbGFzdEtleURvd25cblx0XHRcdFx0JiYgbGFzdEtleURvd24uZXF1YWxzKEtleUNvZGUuS0VZX0lOX0NPTVBPU0lUSU9OKVxuXHRcdFx0XHQmJiB0aGlzLl90ZXh0QXJlYVN0YXRlLnNlbGVjdGlvblN0YXJ0ID09PSB0aGlzLl90ZXh0QXJlYVN0YXRlLnNlbGVjdGlvbkVuZFxuXHRcdFx0XHQmJiB0aGlzLl90ZXh0QXJlYVN0YXRlLnNlbGVjdGlvblN0YXJ0ID4gMFxuXHRcdFx0XHQmJiB0aGlzLl90ZXh0QXJlYVN0YXRlLnZhbHVlLnN1YnN0cih0aGlzLl90ZXh0QXJlYVN0YXRlLnNlbGVjdGlvblN0YXJ0IC0gMSwgMSkgPT09IGUuZGF0YVxuXHRcdFx0XHQmJiAobGFzdEtleURvd24uY29kZSA9PT0gJ0Fycm93UmlnaHQnIHx8IGxhc3RLZXlEb3duLmNvZGUgPT09ICdBcnJvd0xlZnQnKVxuXHRcdFx0KSB7XG5cdFx0XHRcdC8vIEhhbmRsaW5nIGxvbmcgcHJlc3MgY2FzZSBvbiBDaHJvbWl1bS9TYWZhcmkgbWFjT1MgKyBhcnJvdyBrZXkgPT4gcHJldGVuZCB0aGUgY2hhcmFjdGVyIHdhcyBzZWxlY3RlZFxuXHRcdFx0XHRpZiAoX2RlYnVnQ29tcG9zaXRpb24pIHtcblx0XHRcdFx0XHRjb25zb2xlLmxvZyhgW2NvbXBvc2l0aW9uc3RhcnRdIEhhbmRsaW5nIGxvbmcgcHJlc3MgY2FzZSBvbiBtYWNPUyArIGFycm93IGtleWAsIGUpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdC8vIFByZXRlbmQgdGhlIHByZXZpb3VzIGNoYXJhY3RlciB3YXMgY29tcG9zZWQgKGluIG9yZGVyIHRvIGdldCBpdCByZW1vdmVkIGJ5IHN1YnNlcXVlbnQgY29tcG9zaXRpb251cGRhdGUgZXZlbnRzKVxuXHRcdFx0XHRjdXJyZW50Q29tcG9zaXRpb24uaGFuZGxlQ29tcG9zaXRpb25VcGRhdGUoJ3gnKTtcblx0XHRcdFx0dGhpcy5fb25Db21wb3NpdGlvblN0YXJ0LmZpcmUoeyBkYXRhOiBlLmRhdGEgfSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuX2Jyb3dzZXIuaXNBbmRyb2lkKSB7XG5cdFx0XHRcdC8vIHdoZW4gdGFwcGluZyBvbiB0aGUgZWRpdG9yLCBBbmRyb2lkIGVudGVycyBjb21wb3NpdGlvbiBtb2RlIHRvIGVkaXQgdGhlIGN1cnJlbnQgd29yZFxuXHRcdFx0XHQvLyBzbyB3ZSBjYW5ub3QgY2xlYXIgdGhlIHRleHRhcmVhIG9uIEFuZHJvaWQgYW5kIHdlIG11c3QgcHJldGVuZCB0aGUgY3VycmVudCB3b3JkIHdhcyBzZWxlY3RlZFxuXHRcdFx0XHR0aGlzLl9vbkNvbXBvc2l0aW9uU3RhcnQuZmlyZSh7IGRhdGE6IGUuZGF0YSB9KTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9vbkNvbXBvc2l0aW9uU3RhcnQuZmlyZSh7IGRhdGE6IGUuZGF0YSB9KTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl90ZXh0QXJlYS5vbkNvbXBvc2l0aW9uVXBkYXRlKChlKSA9PiB7XG5cdFx0XHRpZiAoX2RlYnVnQ29tcG9zaXRpb24pIHtcblx0XHRcdFx0Y29uc29sZS5sb2coYFtjb21wb3NpdGlvbnVwZGF0ZV1gLCBlKTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGN1cnJlbnRDb21wb3NpdGlvbiA9IHRoaXMuX2N1cnJlbnRDb21wb3NpdGlvbjtcblx0XHRcdGlmICghY3VycmVudENvbXBvc2l0aW9uKSB7XG5cdFx0XHRcdC8vIHNob3VsZCBub3QgYmUgcG9zc2libGUgdG8gcmVjZWl2ZSBhICdjb21wb3NpdGlvbnVwZGF0ZScgd2l0aG91dCBhICdjb21wb3NpdGlvbnN0YXJ0J1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5fYnJvd3Nlci5pc0FuZHJvaWQpIHtcblx0XHRcdFx0Ly8gT24gQW5kcm9pZCwgdGhlIGRhdGEgc2VudCB3aXRoIHRoZSBjb21wb3NpdGlvbiB1cGRhdGUgZXZlbnQgaXMgdW51c2FibGUuXG5cdFx0XHRcdC8vIEZvciBleGFtcGxlLCBpZiB0aGUgY3Vyc29yIGlzIGluIHRoZSBtaWRkbGUgb2YgYSB3b3JkIGxpa2UgTWljfG9zb2Z0XG5cdFx0XHRcdC8vIGFuZCBNaWNyb3NvZnQgaXMgY2hvc2VuIGZyb20gdGhlIGtleWJvYXJkJ3Mgc3VnZ2VzdGlvbnMsIHRoZSBlLmRhdGEgd2lsbCBjb250YWluIFwiTWljcm9zb2Z0XCIuXG5cdFx0XHRcdC8vIFRoaXMgaXMgbm90IHJlYWxseSB1c2FibGUgYmVjYXVzZSBpdCBkb2Vzbid0IHRlbGwgdXMgd2hlcmUgdGhlIGVkaXQgYmVnYW4gYW5kIHdoZXJlIGl0IGVuZGVkLlxuXHRcdFx0XHRjb25zdCBuZXdTdGF0ZSA9IFRleHRBcmVhU3RhdGUucmVhZEZyb21UZXh0QXJlYSh0aGlzLl90ZXh0QXJlYSwgdGhpcy5fdGV4dEFyZWFTdGF0ZSk7XG5cdFx0XHRcdGNvbnN0IHR5cGVJbnB1dCA9IFRleHRBcmVhU3RhdGUuZGVkdWNlQW5kcm9pZENvbXBvc2l0aW9uSW5wdXQodGhpcy5fdGV4dEFyZWFTdGF0ZSwgbmV3U3RhdGUpO1xuXHRcdFx0XHR0aGlzLl90ZXh0QXJlYVN0YXRlID0gbmV3U3RhdGU7XG5cdFx0XHRcdHRoaXMuX29uVHlwZS5maXJlKHR5cGVJbnB1dCk7XG5cdFx0XHRcdHRoaXMuX29uQ29tcG9zaXRpb25VcGRhdGUuZmlyZShlKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgdHlwZUlucHV0ID0gY3VycmVudENvbXBvc2l0aW9uLmhhbmRsZUNvbXBvc2l0aW9uVXBkYXRlKGUuZGF0YSk7XG5cdFx0XHR0aGlzLl90ZXh0QXJlYVN0YXRlID0gVGV4dEFyZWFTdGF0ZS5yZWFkRnJvbVRleHRBcmVhKHRoaXMuX3RleHRBcmVhLCB0aGlzLl90ZXh0QXJlYVN0YXRlKTtcblx0XHRcdHRoaXMuX29uVHlwZS5maXJlKHR5cGVJbnB1dCk7XG5cdFx0XHR0aGlzLl9vbkNvbXBvc2l0aW9uVXBkYXRlLmZpcmUoZSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fdGV4dEFyZWEub25Db21wb3NpdGlvbkVuZCgoZSkgPT4ge1xuXHRcdFx0aWYgKF9kZWJ1Z0NvbXBvc2l0aW9uKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKGBbY29tcG9zaXRpb25lbmRdYCwgZSk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBjdXJyZW50Q29tcG9zaXRpb24gPSB0aGlzLl9jdXJyZW50Q29tcG9zaXRpb247XG5cdFx0XHRpZiAoIWN1cnJlbnRDb21wb3NpdGlvbikge1xuXHRcdFx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L21vbmFjby1lZGl0b3IvaXNzdWVzLzE2NjNcblx0XHRcdFx0Ly8gT24gaU9TIDEzLjIsIENoaW5lc2Ugc3lzdGVtIElNRSByYW5kb21seSB0cmlnZ2VyIGFuIGFkZGl0aW9uYWwgY29tcG9zaXRpb25lbmQgZXZlbnQgd2l0aCBlbXB0eSBkYXRhXG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMuX2N1cnJlbnRDb21wb3NpdGlvbiA9IG51bGw7XG5cblx0XHRcdGlmICh0aGlzLl9icm93c2VyLmlzQW5kcm9pZCkge1xuXHRcdFx0XHQvLyBPbiBBbmRyb2lkLCB0aGUgZGF0YSBzZW50IHdpdGggdGhlIGNvbXBvc2l0aW9uIHVwZGF0ZSBldmVudCBpcyB1bnVzYWJsZS5cblx0XHRcdFx0Ly8gRm9yIGV4YW1wbGUsIGlmIHRoZSBjdXJzb3IgaXMgaW4gdGhlIG1pZGRsZSBvZiBhIHdvcmQgbGlrZSBNaWN8b3NvZnRcblx0XHRcdFx0Ly8gYW5kIE1pY3Jvc29mdCBpcyBjaG9zZW4gZnJvbSB0aGUga2V5Ym9hcmQncyBzdWdnZXN0aW9ucywgdGhlIGUuZGF0YSB3aWxsIGNvbnRhaW4gXCJNaWNyb3NvZnRcIi5cblx0XHRcdFx0Ly8gVGhpcyBpcyBub3QgcmVhbGx5IHVzYWJsZSBiZWNhdXNlIGl0IGRvZXNuJ3QgdGVsbCB1cyB3aGVyZSB0aGUgZWRpdCBiZWdhbiBhbmQgd2hlcmUgaXQgZW5kZWQuXG5cdFx0XHRcdGNvbnN0IG5ld1N0YXRlID0gVGV4dEFyZWFTdGF0ZS5yZWFkRnJvbVRleHRBcmVhKHRoaXMuX3RleHRBcmVhLCB0aGlzLl90ZXh0QXJlYVN0YXRlKTtcblx0XHRcdFx0Y29uc3QgdHlwZUlucHV0ID0gVGV4dEFyZWFTdGF0ZS5kZWR1Y2VBbmRyb2lkQ29tcG9zaXRpb25JbnB1dCh0aGlzLl90ZXh0QXJlYVN0YXRlLCBuZXdTdGF0ZSk7XG5cdFx0XHRcdHRoaXMuX3RleHRBcmVhU3RhdGUgPSBuZXdTdGF0ZTtcblx0XHRcdFx0dGhpcy5fb25UeXBlLmZpcmUodHlwZUlucHV0KTtcblx0XHRcdFx0dGhpcy5fb25Db21wb3NpdGlvbkVuZC5maXJlKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgdHlwZUlucHV0ID0gY3VycmVudENvbXBvc2l0aW9uLmhhbmRsZUNvbXBvc2l0aW9uVXBkYXRlKGUuZGF0YSk7XG5cdFx0XHR0aGlzLl90ZXh0QXJlYVN0YXRlID0gVGV4dEFyZWFTdGF0ZS5yZWFkRnJvbVRleHRBcmVhKHRoaXMuX3RleHRBcmVhLCB0aGlzLl90ZXh0QXJlYVN0YXRlKTtcblx0XHRcdHRoaXMuX29uVHlwZS5maXJlKHR5cGVJbnB1dCk7XG5cdFx0XHR0aGlzLl9vbkNvbXBvc2l0aW9uRW5kLmZpcmUoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl90ZXh0QXJlYS5vbklucHV0KChlKSA9PiB7XG5cdFx0XHRpZiAoX2RlYnVnQ29tcG9zaXRpb24pIHtcblx0XHRcdFx0Y29uc29sZS5sb2coYFtpbnB1dF1gLCBlKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gUHJldGVuZCBoZXJlIHdlIHRvdWNoZWQgdGhlIHRleHQgYXJlYSwgYXMgdGhlIGBpbnB1dGAgZXZlbnQgd2lsbCBtb3N0IGxpa2VseVxuXHRcdFx0Ly8gcmVzdWx0IGluIGEgYHNlbGVjdGlvbmNoYW5nZWAgZXZlbnQgd2hpY2ggd2Ugd2FudCB0byBpZ25vcmVcblx0XHRcdHRoaXMuX3RleHRBcmVhLnNldElnbm9yZVNlbGVjdGlvbkNoYW5nZVRpbWUoJ3JlY2VpdmVkIGlucHV0IGV2ZW50Jyk7XG5cblx0XHRcdGlmICh0aGlzLl9jdXJyZW50Q29tcG9zaXRpb24pIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBuZXdTdGF0ZSA9IFRleHRBcmVhU3RhdGUucmVhZEZyb21UZXh0QXJlYSh0aGlzLl90ZXh0QXJlYSwgdGhpcy5fdGV4dEFyZWFTdGF0ZSk7XG5cdFx0XHRjb25zdCB0eXBlSW5wdXQgPSBUZXh0QXJlYVN0YXRlLmRlZHVjZUlucHV0KHRoaXMuX3RleHRBcmVhU3RhdGUsIG5ld1N0YXRlLCAvKmNvdWxkQmVFbW9qaUlucHV0Ki90aGlzLl9PUyA9PT0gT3BlcmF0aW5nU3lzdGVtLk1hY2ludG9zaCk7XG5cblx0XHRcdGlmICh0eXBlSW5wdXQucmVwbGFjZVByZXZDaGFyQ250ID09PSAwICYmIHR5cGVJbnB1dC50ZXh0Lmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0XHQvLyBvbmUgY2hhcmFjdGVyIHdhcyB0eXBlZFxuXHRcdFx0XHRpZiAoXG5cdFx0XHRcdFx0c3RyaW5ncy5pc0hpZ2hTdXJyb2dhdGUodHlwZUlucHV0LnRleHQuY2hhckNvZGVBdCgwKSlcblx0XHRcdFx0XHR8fCB0eXBlSW5wdXQudGV4dC5jaGFyQ29kZUF0KDApID09PSAweDdmIC8qIERlbGV0ZSAqL1xuXHRcdFx0XHQpIHtcblx0XHRcdFx0XHQvLyBJZ25vcmUgaW52YWxpZCBpbnB1dCBidXQga2VlcCBpdCBhcm91bmQgZm9yIG5leHQgdGltZVxuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl90ZXh0QXJlYVN0YXRlID0gbmV3U3RhdGU7XG5cdFx0XHRpZiAoXG5cdFx0XHRcdHR5cGVJbnB1dC50ZXh0ICE9PSAnJ1xuXHRcdFx0XHR8fCB0eXBlSW5wdXQucmVwbGFjZVByZXZDaGFyQ250ICE9PSAwXG5cdFx0XHRcdHx8IHR5cGVJbnB1dC5yZXBsYWNlTmV4dENoYXJDbnQgIT09IDBcblx0XHRcdFx0fHwgdHlwZUlucHV0LnBvc2l0aW9uRGVsdGEgIT09IDBcblx0XHRcdCkge1xuXHRcdFx0XHR0aGlzLl9vblR5cGUuZmlyZSh0eXBlSW5wdXQpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdC8vIC0tLSBDbGlwYm9hcmQgb3BlcmF0aW9uc1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fdGV4dEFyZWEub25DdXQoKGUpID0+IHtcblx0XHRcdC8vIFByZXRlbmQgaGVyZSB3ZSB0b3VjaGVkIHRoZSB0ZXh0IGFyZWEsIGFzIHRoZSBgY3V0YCBldmVudCB3aWxsIG1vc3QgbGlrZWx5XG5cdFx0XHQvLyByZXN1bHQgaW4gYSBgc2VsZWN0aW9uY2hhbmdlYCBldmVudCB3aGljaCB3ZSB3YW50IHRvIGlnbm9yZVxuXHRcdFx0dGhpcy5fdGV4dEFyZWEuc2V0SWdub3JlU2VsZWN0aW9uQ2hhbmdlVGltZSgncmVjZWl2ZWQgY3V0IGV2ZW50Jyk7XG5cblx0XHRcdHRoaXMuX2Vuc3VyZUNsaXBib2FyZEdldHNFZGl0b3JTZWxlY3Rpb24oZSk7XG5cdFx0XHR0aGlzLl9hc3luY1RyaWdnZXJDdXQuc2NoZWR1bGUoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl90ZXh0QXJlYS5vbkNvcHkoKGUpID0+IHtcblx0XHRcdHRoaXMuX2Vuc3VyZUNsaXBib2FyZEdldHNFZGl0b3JTZWxlY3Rpb24oZSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fdGV4dEFyZWEub25QYXN0ZSgoZSkgPT4ge1xuXHRcdFx0Ly8gUHJldGVuZCBoZXJlIHdlIHRvdWNoZWQgdGhlIHRleHQgYXJlYSwgYXMgdGhlIGBwYXN0ZWAgZXZlbnQgd2lsbCBtb3N0IGxpa2VseVxuXHRcdFx0Ly8gcmVzdWx0IGluIGEgYHNlbGVjdGlvbmNoYW5nZWAgZXZlbnQgd2hpY2ggd2Ugd2FudCB0byBpZ25vcmVcblx0XHRcdHRoaXMuX3RleHRBcmVhLnNldElnbm9yZVNlbGVjdGlvbkNoYW5nZVRpbWUoJ3JlY2VpdmVkIHBhc3RlIGV2ZW50Jyk7XG5cblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblxuXHRcdFx0aWYgKCFlLmNsaXBib2FyZERhdGEpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRsZXQgW3RleHQsIG1ldGFkYXRhXSA9IENsaXBib2FyZEV2ZW50VXRpbHMuZ2V0VGV4dERhdGEoZS5jbGlwYm9hcmREYXRhKTtcblx0XHRcdGlmICghdGV4dCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIHRyeSB0aGUgaW4tbWVtb3J5IHN0b3JlXG5cdFx0XHRtZXRhZGF0YSA9IG1ldGFkYXRhIHx8IEluTWVtb3J5Q2xpcGJvYXJkTWV0YWRhdGFNYW5hZ2VyLklOU1RBTkNFLmdldCh0ZXh0KTtcblxuXHRcdFx0dGhpcy5fb25QYXN0ZS5maXJlKHtcblx0XHRcdFx0dGV4dDogdGV4dCxcblx0XHRcdFx0bWV0YWRhdGE6IG1ldGFkYXRhXG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl90ZXh0QXJlYS5vbkZvY3VzKCgpID0+IHtcblx0XHRcdGNvbnN0IGhhZEZvY3VzID0gdGhpcy5faGFzRm9jdXM7XG5cblx0XHRcdHRoaXMuX3NldEhhc0ZvY3VzKHRydWUpO1xuXG5cdFx0XHRpZiAodGhpcy5fYWNjZXNzaWJpbGl0eVNlcnZpY2UuaXNTY3JlZW5SZWFkZXJPcHRpbWl6ZWQoKSAmJiB0aGlzLl9icm93c2VyLmlzU2FmYXJpICYmICFoYWRGb2N1cyAmJiB0aGlzLl9oYXNGb2N1cykge1xuXHRcdFx0XHQvLyBXaGVuIFwidGFiYmluZyBpbnRvXCIgdGhlIHRleHRhcmVhLCBpbW1lZGlhdGVseSBhZnRlciBkaXNwYXRjaGluZyB0aGUgJ2ZvY3VzJyBldmVudCxcblx0XHRcdFx0Ly8gU2FmYXJpIHdpbGwgYWx3YXlzIG1vdmUgdGhlIHNlbGVjdGlvbiBhdCBvZmZzZXQgMCBpbiB0aGUgdGV4dGFyZWFcblx0XHRcdFx0aWYgKCF0aGlzLl9hc3luY0ZvY3VzR2FpbldyaXRlU2NyZWVuUmVhZGVyQ29udGVudC52YWx1ZSkge1xuXHRcdFx0XHRcdHRoaXMuX2FzeW5jRm9jdXNHYWluV3JpdGVTY3JlZW5SZWFkZXJDb250ZW50LnZhbHVlID0gbmV3IFJ1bk9uY2VTY2hlZHVsZXIoKCkgPT4gdGhpcy53cml0ZU5hdGl2ZVRleHRBcmVhQ29udGVudCgnYXN5bmNGb2N1c0dhaW4nKSwgMCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5fYXN5bmNGb2N1c0dhaW5Xcml0ZVNjcmVlblJlYWRlckNvbnRlbnQudmFsdWUuc2NoZWR1bGUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fdGV4dEFyZWEub25CbHVyKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLl9jdXJyZW50Q29tcG9zaXRpb24pIHtcblx0XHRcdFx0Ly8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMTI2MjFcblx0XHRcdFx0Ly8gd2hlcmUgY29tcG9zaXRpb25lbmQgaXMgbm90IHRyaWdnZXJlZCB3aGVuIHRoZSBlZGl0b3Jcblx0XHRcdFx0Ly8gaXMgdGFrZW4gb2ZmLWRvbSBkdXJpbmcgYSBjb21wb3NpdGlvblxuXG5cdFx0XHRcdC8vIENsZWFyIHRoZSBmbGFnIHRvIGJlIGFibGUgdG8gd3JpdGUgdG8gdGhlIHRleHRhcmVhXG5cdFx0XHRcdHRoaXMuX2N1cnJlbnRDb21wb3NpdGlvbiA9IG51bGw7XG5cblx0XHRcdFx0Ly8gQ2xlYXIgdGhlIHRleHRhcmVhIHRvIGF2b2lkIGFuIHVud2FudGVkIGN1cnNvciB0eXBlXG5cdFx0XHRcdHRoaXMud3JpdGVOYXRpdmVUZXh0QXJlYUNvbnRlbnQoJ2JsdXJXaXRob3V0Q29tcG9zaXRpb25FbmQnKTtcblxuXHRcdFx0XHQvLyBGaXJlIGFydGlmaWNpYWwgY29tcG9zaXRpb24gZW5kXG5cdFx0XHRcdHRoaXMuX29uQ29tcG9zaXRpb25FbmQuZmlyZSgpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fc2V0SGFzRm9jdXMoZmFsc2UpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl90ZXh0QXJlYS5vblN5bnRoZXRpY1RhcCgoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fYnJvd3Nlci5pc0FuZHJvaWQgJiYgdGhpcy5fY3VycmVudENvbXBvc2l0aW9uKSB7XG5cdFx0XHRcdC8vIG9uIEFuZHJvaWQsIHRhcHBpbmcgZG9lcyBub3QgY2FuY2VsIHRoZSBjdXJyZW50IGNvbXBvc2l0aW9uLCBzbyB0aGVcblx0XHRcdFx0Ly8gdGV4dGFyZWEgaXMgc3R1Y2sgc2hvd2luZyB0aGUgb2xkIGNvbXBvc2l0aW9uXG5cblx0XHRcdFx0Ly8gQ2xlYXIgdGhlIGZsYWcgdG8gYmUgYWJsZSB0byB3cml0ZSB0byB0aGUgdGV4dGFyZWFcblx0XHRcdFx0dGhpcy5fY3VycmVudENvbXBvc2l0aW9uID0gbnVsbDtcblxuXHRcdFx0XHQvLyBDbGVhciB0aGUgdGV4dGFyZWEgdG8gYXZvaWQgYW4gdW53YW50ZWQgY3Vyc29yIHR5cGVcblx0XHRcdFx0dGhpcy53cml0ZU5hdGl2ZVRleHRBcmVhQ29udGVudCgndGFwV2l0aG91dENvbXBvc2l0aW9uRW5kJyk7XG5cblx0XHRcdFx0Ly8gRmlyZSBhcnRpZmljaWFsIGNvbXBvc2l0aW9uIGVuZFxuXHRcdFx0XHR0aGlzLl9vbkNvbXBvc2l0aW9uRW5kLmZpcmUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRfaW5pdGlhbGl6ZUZyb21UZXN0KCk6IHZvaWQge1xuXHRcdHRoaXMuX2hhc0ZvY3VzID0gdHJ1ZTtcblx0XHR0aGlzLl90ZXh0QXJlYVN0YXRlID0gVGV4dEFyZWFTdGF0ZS5yZWFkRnJvbVRleHRBcmVhKHRoaXMuX3RleHRBcmVhLCBudWxsKTtcblx0fVxuXG5cdHByaXZhdGUgX2luc3RhbGxTZWxlY3Rpb25DaGFuZ2VMaXN0ZW5lcigpOiBJRGlzcG9zYWJsZSB7XG5cdFx0Ly8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8yNzIxNiBhbmQgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzk4MjU2XG5cdFx0Ly8gV2hlbiB1c2luZyBhIEJyYWlsbGUgZGlzcGxheSwgaXQgaXMgcG9zc2libGUgZm9yIHVzZXJzIHRvIHJlcG9zaXRpb24gdGhlXG5cdFx0Ly8gc3lzdGVtIGNhcmV0LiBUaGlzIGlzIHJlZmxlY3RlZCBpbiBDaHJvbWUgYXMgYSBgc2VsZWN0aW9uY2hhbmdlYCBldmVudC5cblx0XHQvL1xuXHRcdC8vIFRoZSBgc2VsZWN0aW9uY2hhbmdlYCBldmVudCBhcHBlYXJzIHRvIGJlIGVtaXR0ZWQgdW5kZXIgbnVtZXJvdXMgb3RoZXIgY2lyY3Vtc3RhbmNlcyxcblx0XHQvLyBzbyBpdCBpcyBxdWl0ZSBhIGNoYWxsZW5nZSB0byBkaXN0aW5ndWlzaCBhIGBzZWxlY3Rpb25jaGFuZ2VgIGNvbWluZyBpbiBmcm9tIGEgdXNlclxuXHRcdC8vIHVzaW5nIGEgQnJhaWxsZSBkaXNwbGF5IGZyb20gYWxsIHRoZSBvdGhlciBjYXNlcy5cblx0XHQvL1xuXHRcdC8vIFRoZSBwcm9ibGVtcyB3aXRoIHRoZSBgc2VsZWN0aW9uY2hhbmdlYCBldmVudCBhcmU6XG5cdFx0Ly8gICogdGhlIGV2ZW50IGlzIGVtaXR0ZWQgd2hlbiB0aGUgdGV4dGFyZWEgaXMgZm9jdXNlZCBwcm9ncmFtbWF0aWNhbGx5IC0tIHRleHRhcmVhLmZvY3VzKClcblx0XHQvLyAgKiB0aGUgZXZlbnQgaXMgZW1pdHRlZCB3aGVuIHRoZSBzZWxlY3Rpb24gaXMgY2hhbmdlZCBpbiB0aGUgdGV4dGFyZWEgcHJvZ3JhbW1hdGljYWxseSAtLSB0ZXh0YXJlYS5zZXRTZWxlY3Rpb25SYW5nZSguLi4pXG5cdFx0Ly8gICogdGhlIGV2ZW50IGlzIGVtaXR0ZWQgd2hlbiB0aGUgdmFsdWUgb2YgdGhlIHRleHRhcmVhIGlzIGNoYW5nZWQgcHJvZ3JhbW1hdGljYWxseSAtLSB0ZXh0YXJlYS52YWx1ZSA9ICcuLi4nXG5cdFx0Ly8gICogdGhlIGV2ZW50IGlzIGVtaXR0ZWQgd2hlbiB0YWJiaW5nIGludG8gdGhlIHRleHRhcmVhXG5cdFx0Ly8gICogdGhlIGV2ZW50IGlzIGVtaXR0ZWQgYXN5bmNocm9ub3VzbHkgKHNvbWV0aW1lcyB3aXRoIGEgZGVsYXkgYXMgaGlnaCBhcyBhIGZldyB0ZW5zIG9mIG1zKVxuXHRcdC8vICAqIHRoZSBldmVudCBzb21ldGltZXMgY29tZXMgaW4gYnVyc3RzIGZvciBhIHNpbmdsZSBsb2dpY2FsIHRleHRhcmVhIG9wZXJhdGlvblxuXG5cdFx0Ly8gYHNlbGVjdGlvbmNoYW5nZWAgZXZlbnRzIG9mdGVuIGNvbWUgbXVsdGlwbGUgdGltZXMgZm9yIGEgc2luZ2xlIGxvZ2ljYWwgY2hhbmdlXG5cdFx0Ly8gc28gdGhyb3R0bGUgbXVsdGlwbGUgYHNlbGVjdGlvbmNoYW5nZWAgZXZlbnRzIHRoYXQgYnVyc3QgaW4gYSBzaG9ydCBwZXJpb2Qgb2YgdGltZS5cblx0XHRsZXQgcHJldmlvdXNTZWxlY3Rpb25DaGFuZ2VFdmVudFRpbWUgPSAwO1xuXHRcdHJldHVybiBkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuX3RleHRBcmVhLm93bmVyRG9jdW1lbnQsICdzZWxlY3Rpb25jaGFuZ2UnLCAoZSkgPT4gey8vdG9kb1xuXHRcdFx0aW5wdXRMYXRlbmN5Lm9uU2VsZWN0aW9uQ2hhbmdlKCk7XG5cblx0XHRcdGlmICghdGhpcy5faGFzRm9jdXMpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRoaXMuX2N1cnJlbnRDb21wb3NpdGlvbikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIXRoaXMuX2Jyb3dzZXIuaXNDaHJvbWUpIHtcblx0XHRcdFx0Ly8gU3VwcG9ydCBvbmx5IGZvciBDaHJvbWUgdW50aWwgdGVzdGluZyBoYXBwZW5zIG9uIG90aGVyIGJyb3dzZXJzXG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcblxuXHRcdFx0Y29uc3QgZGVsdGExID0gbm93IC0gcHJldmlvdXNTZWxlY3Rpb25DaGFuZ2VFdmVudFRpbWU7XG5cdFx0XHRwcmV2aW91c1NlbGVjdGlvbkNoYW5nZUV2ZW50VGltZSA9IG5vdztcblx0XHRcdGlmIChkZWx0YTEgPCA1KSB7XG5cdFx0XHRcdC8vIHJlY2VpdmVkIGFub3RoZXIgYHNlbGVjdGlvbmNoYW5nZWAgZXZlbnQgd2l0aGluIDVtcyBvZiB0aGUgcHJldmlvdXMgYHNlbGVjdGlvbmNoYW5nZWAgZXZlbnRcblx0XHRcdFx0Ly8gPT4gaWdub3JlIGl0XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZGVsdGEyID0gbm93IC0gdGhpcy5fdGV4dEFyZWEuZ2V0SWdub3JlU2VsZWN0aW9uQ2hhbmdlVGltZSgpO1xuXHRcdFx0dGhpcy5fdGV4dEFyZWEucmVzZXRTZWxlY3Rpb25DaGFuZ2VUaW1lKCk7XG5cdFx0XHRpZiAoZGVsdGEyIDwgMTAwKSB7XG5cdFx0XHRcdC8vIHJlY2VpdmVkIGEgYHNlbGVjdGlvbmNoYW5nZWAgZXZlbnQgd2l0aGluIDEwMG1zIHNpbmNlIHdlIHRvdWNoZWQgdGhlIHRleHRhcmVhXG5cdFx0XHRcdC8vID0+IGlnbm9yZSBpdCwgc2luY2Ugd2UgY2F1c2VkIGl0XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCF0aGlzLl90ZXh0QXJlYVN0YXRlLnNlbGVjdGlvbikge1xuXHRcdFx0XHQvLyBDYW5ub3QgY29ycmVsYXRlIGEgcG9zaXRpb24gaW4gdGhlIHRleHRhcmVhIHdpdGggYSBwb3NpdGlvbiBpbiB0aGUgZWRpdG9yLi4uXG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbmV3VmFsdWUgPSB0aGlzLl90ZXh0QXJlYS5nZXRWYWx1ZSgpO1xuXHRcdFx0aWYgKHRoaXMuX3RleHRBcmVhU3RhdGUudmFsdWUgIT09IG5ld1ZhbHVlKSB7XG5cdFx0XHRcdC8vIENhbm5vdCBjb3JyZWxhdGUgYSBwb3NpdGlvbiBpbiB0aGUgdGV4dGFyZWEgd2l0aCBhIHBvc2l0aW9uIGluIHRoZSBlZGl0b3IuLi5cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBuZXdTZWxlY3Rpb25TdGFydCA9IHRoaXMuX3RleHRBcmVhLmdldFNlbGVjdGlvblN0YXJ0KCk7XG5cdFx0XHRjb25zdCBuZXdTZWxlY3Rpb25FbmQgPSB0aGlzLl90ZXh0QXJlYS5nZXRTZWxlY3Rpb25FbmQoKTtcblx0XHRcdGlmICh0aGlzLl90ZXh0QXJlYVN0YXRlLnNlbGVjdGlvblN0YXJ0ID09PSBuZXdTZWxlY3Rpb25TdGFydCAmJiB0aGlzLl90ZXh0QXJlYVN0YXRlLnNlbGVjdGlvbkVuZCA9PT0gbmV3U2VsZWN0aW9uRW5kKSB7XG5cdFx0XHRcdC8vIE5vdGhpbmcgdG8gZG8uLi5cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBfbmV3U2VsZWN0aW9uU3RhcnRQb3NpdGlvbiA9IHRoaXMuX3RleHRBcmVhU3RhdGUuZGVkdWNlRWRpdG9yUG9zaXRpb24obmV3U2VsZWN0aW9uU3RhcnQpO1xuXHRcdFx0Y29uc3QgbmV3U2VsZWN0aW9uU3RhcnRQb3NpdGlvbiA9IHRoaXMuX2hvc3QuZGVkdWNlTW9kZWxQb3NpdGlvbihfbmV3U2VsZWN0aW9uU3RhcnRQb3NpdGlvblswXSEsIF9uZXdTZWxlY3Rpb25TdGFydFBvc2l0aW9uWzFdLCBfbmV3U2VsZWN0aW9uU3RhcnRQb3NpdGlvblsyXSk7XG5cblx0XHRcdGNvbnN0IF9uZXdTZWxlY3Rpb25FbmRQb3NpdGlvbiA9IHRoaXMuX3RleHRBcmVhU3RhdGUuZGVkdWNlRWRpdG9yUG9zaXRpb24obmV3U2VsZWN0aW9uRW5kKTtcblx0XHRcdGNvbnN0IG5ld1NlbGVjdGlvbkVuZFBvc2l0aW9uID0gdGhpcy5faG9zdC5kZWR1Y2VNb2RlbFBvc2l0aW9uKF9uZXdTZWxlY3Rpb25FbmRQb3NpdGlvblswXSEsIF9uZXdTZWxlY3Rpb25FbmRQb3NpdGlvblsxXSwgX25ld1NlbGVjdGlvbkVuZFBvc2l0aW9uWzJdKTtcblxuXHRcdFx0Y29uc3QgbmV3U2VsZWN0aW9uID0gbmV3IFNlbGVjdGlvbihcblx0XHRcdFx0bmV3U2VsZWN0aW9uU3RhcnRQb3NpdGlvbi5saW5lTnVtYmVyLCBuZXdTZWxlY3Rpb25TdGFydFBvc2l0aW9uLmNvbHVtbixcblx0XHRcdFx0bmV3U2VsZWN0aW9uRW5kUG9zaXRpb24ubGluZU51bWJlciwgbmV3U2VsZWN0aW9uRW5kUG9zaXRpb24uY29sdW1uXG5cdFx0XHQpO1xuXG5cdFx0XHR0aGlzLl9vblNlbGVjdGlvbkNoYW5nZVJlcXVlc3QuZmlyZShuZXdTZWxlY3Rpb24pO1xuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHRcdGlmICh0aGlzLl9zZWxlY3Rpb25DaGFuZ2VMaXN0ZW5lcikge1xuXHRcdFx0dGhpcy5fc2VsZWN0aW9uQ2hhbmdlTGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5fc2VsZWN0aW9uQ2hhbmdlTGlzdGVuZXIgPSBudWxsO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBmb2N1c1RleHRBcmVhKCk6IHZvaWQge1xuXHRcdC8vIFNldHRpbmcgdGhpcy5faGFzRm9jdXMgYW5kIHdyaXRpbmcgdGhlIHNjcmVlbiByZWFkZXIgY29udGVudFxuXHRcdC8vIHdpbGwgcmVzdWx0IGluIGEgZm9jdXMoKSBhbmQgc2V0U2VsZWN0aW9uUmFuZ2UoKSBpbiB0aGUgdGV4dGFyZWFcblx0XHR0aGlzLl9zZXRIYXNGb2N1cyh0cnVlKTtcblxuXHRcdC8vIElmIHRoZSBlZGl0b3IgaXMgb2ZmIERPTSwgZm9jdXMgY2Fubm90IGJlIHJlYWxseSBzZXQsIHNvIGxldCdzIGRvdWJsZSBjaGVjayB0aGF0IHdlIGhhdmUgbWFuYWdlZCB0byBzZXQgdGhlIGZvY3VzXG5cdFx0dGhpcy5yZWZyZXNoRm9jdXNTdGF0ZSgpO1xuXHR9XG5cblx0cHVibGljIGlzRm9jdXNlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5faGFzRm9jdXM7XG5cdH1cblxuXHRwdWJsaWMgcmVmcmVzaEZvY3VzU3RhdGUoKTogdm9pZCB7XG5cdFx0dGhpcy5fc2V0SGFzRm9jdXModGhpcy5fdGV4dEFyZWEuaGFzRm9jdXMoKSk7XG5cdH1cblxuXHRwcml2YXRlIF9zZXRIYXNGb2N1cyhuZXdIYXNGb2N1czogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9oYXNGb2N1cyA9PT0gbmV3SGFzRm9jdXMpIHtcblx0XHRcdC8vIG5vIGNoYW5nZVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9oYXNGb2N1cyA9IG5ld0hhc0ZvY3VzO1xuXG5cdFx0aWYgKHRoaXMuX3NlbGVjdGlvbkNoYW5nZUxpc3RlbmVyKSB7XG5cdFx0XHR0aGlzLl9zZWxlY3Rpb25DaGFuZ2VMaXN0ZW5lci5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLl9zZWxlY3Rpb25DaGFuZ2VMaXN0ZW5lciA9IG51bGw7XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9oYXNGb2N1cykge1xuXHRcdFx0dGhpcy5fc2VsZWN0aW9uQ2hhbmdlTGlzdGVuZXIgPSB0aGlzLl9pbnN0YWxsU2VsZWN0aW9uQ2hhbmdlTGlzdGVuZXIoKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5faGFzRm9jdXMpIHtcblx0XHRcdHRoaXMud3JpdGVOYXRpdmVUZXh0QXJlYUNvbnRlbnQoJ2ZvY3VzZ2FpbicpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9oYXNGb2N1cykge1xuXHRcdFx0dGhpcy5fb25Gb2N1cy5maXJlKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX29uQmx1ci5maXJlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfc2V0QW5kV3JpdGVUZXh0QXJlYVN0YXRlKHJlYXNvbjogc3RyaW5nLCB0ZXh0QXJlYVN0YXRlOiBUZXh0QXJlYVN0YXRlKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9oYXNGb2N1cykge1xuXHRcdFx0dGV4dEFyZWFTdGF0ZSA9IHRleHRBcmVhU3RhdGUuY29sbGFwc2VTZWxlY3Rpb24oKTtcblx0XHR9XG5cdFx0aWYgKCF0ZXh0QXJlYVN0YXRlLmlzV3JpdHRlblRvVGV4dEFyZWEodGhpcy5fdGV4dEFyZWEsIHRoaXMuX2hhc0ZvY3VzKSkge1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZShgd3JpdGVUZXh0QXJlYVN0YXRlKHJlYXNvbjogJHtyZWFzb259KWApO1xuXHRcdH1cblx0XHR0ZXh0QXJlYVN0YXRlLndyaXRlVG9UZXh0QXJlYShyZWFzb24sIHRoaXMuX3RleHRBcmVhLCB0aGlzLl9oYXNGb2N1cyk7XG5cdFx0dGhpcy5fdGV4dEFyZWFTdGF0ZSA9IHRleHRBcmVhU3RhdGU7XG5cdH1cblxuXHRwdWJsaWMgd3JpdGVOYXRpdmVUZXh0QXJlYUNvbnRlbnQocmVhc29uOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAoKCF0aGlzLl9hY2Nlc3NpYmlsaXR5U2VydmljZS5pc1NjcmVlblJlYWRlck9wdGltaXplZCgpICYmIHJlYXNvbiA9PT0gJ3JlbmRlcicpIHx8IHRoaXMuX2N1cnJlbnRDb21wb3NpdGlvbikge1xuXHRcdFx0Ly8gRG8gbm90IHdyaXRlIHRvIHRoZSB0ZXh0IG9uIHJlbmRlciB1bmxlc3MgYSBzY3JlZW4gcmVhZGVyIGlzIGJlaW5nIHVzZWQgIzE5MjI3OFxuXHRcdFx0Ly8gRG8gbm90IHdyaXRlIHRvIHRoZSB0ZXh0IGFyZWEgd2hlbiBkb2luZyBjb21wb3NpdGlvblxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9zZXRBbmRXcml0ZVRleHRBcmVhU3RhdGUocmVhc29uLCB0aGlzLl9ob3N0LmdldFNjcmVlblJlYWRlckNvbnRlbnQoKSk7XG5cdH1cblxuXHRwcml2YXRlIF9lbnN1cmVDbGlwYm9hcmRHZXRzRWRpdG9yU2VsZWN0aW9uKGU6IENsaXBib2FyZEV2ZW50KTogdm9pZCB7XG5cdFx0Y29uc3QgZGF0YVRvQ29weSA9IHRoaXMuX2hvc3QuZ2V0RGF0YVRvQ29weSgpO1xuXHRcdGNvbnN0IHN0b3JlZE1ldGFkYXRhOiBDbGlwYm9hcmRTdG9yZWRNZXRhZGF0YSA9IHtcblx0XHRcdHZlcnNpb246IDEsXG5cdFx0XHRpc0Zyb21FbXB0eVNlbGVjdGlvbjogZGF0YVRvQ29weS5pc0Zyb21FbXB0eVNlbGVjdGlvbixcblx0XHRcdG11bHRpY3Vyc29yVGV4dDogZGF0YVRvQ29weS5tdWx0aWN1cnNvclRleHQsXG5cdFx0XHRtb2RlOiBkYXRhVG9Db3B5Lm1vZGVcblx0XHR9O1xuXHRcdEluTWVtb3J5Q2xpcGJvYXJkTWV0YWRhdGFNYW5hZ2VyLklOU1RBTkNFLnNldChcblx0XHRcdC8vIFdoZW4gd3JpdGluZyBcIkxJTkVcXHJcXG5cIiB0byB0aGUgY2xpcGJvYXJkIGFuZCB0aGVuIHBhc3RpbmcsXG5cdFx0XHQvLyBGaXJlZm94IHBhc3RlcyBcIkxJTkVcXG5cIiwgc28gbGV0J3Mgd29yayBhcm91bmQgdGhpcyBxdWlya1xuXHRcdFx0KHRoaXMuX2Jyb3dzZXIuaXNGaXJlZm94ID8gZGF0YVRvQ29weS50ZXh0LnJlcGxhY2UoL1xcclxcbi9nLCAnXFxuJykgOiBkYXRhVG9Db3B5LnRleHQpLFxuXHRcdFx0c3RvcmVkTWV0YWRhdGFcblx0XHQpO1xuXG5cdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdGlmIChlLmNsaXBib2FyZERhdGEpIHtcblx0XHRcdENsaXBib2FyZEV2ZW50VXRpbHMuc2V0VGV4dERhdGEoZS5jbGlwYm9hcmREYXRhLCBkYXRhVG9Db3B5LnRleHQsIGRhdGFUb0NvcHkuaHRtbCwgc3RvcmVkTWV0YWRhdGEpO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVGV4dEFyZWFXcmFwcGVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElDb21wbGV0ZVRleHRBcmVhV3JhcHBlciB7XG5cblx0cHVibGljIHJlYWRvbmx5IG9uS2V5RG93biA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEb21FbWl0dGVyKHRoaXMuX2FjdHVhbCwgJ2tleWRvd24nKSkuZXZlbnQ7XG5cdHB1YmxpYyByZWFkb25seSBvbktleVByZXNzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERvbUVtaXR0ZXIodGhpcy5fYWN0dWFsLCAna2V5cHJlc3MnKSkuZXZlbnQ7XG5cdHB1YmxpYyByZWFkb25seSBvbktleVVwID0gdGhpcy5fcmVnaXN0ZXIobmV3IERvbUVtaXR0ZXIodGhpcy5fYWN0dWFsLCAna2V5dXAnKSkuZXZlbnQ7XG5cdHB1YmxpYyByZWFkb25seSBvbkNvbXBvc2l0aW9uU3RhcnQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRG9tRW1pdHRlcih0aGlzLl9hY3R1YWwsICdjb21wb3NpdGlvbnN0YXJ0JykpLmV2ZW50O1xuXHRwdWJsaWMgcmVhZG9ubHkgb25Db21wb3NpdGlvblVwZGF0ZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEb21FbWl0dGVyKHRoaXMuX2FjdHVhbCwgJ2NvbXBvc2l0aW9udXBkYXRlJykpLmV2ZW50O1xuXHRwdWJsaWMgcmVhZG9ubHkgb25Db21wb3NpdGlvbkVuZCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEb21FbWl0dGVyKHRoaXMuX2FjdHVhbCwgJ2NvbXBvc2l0aW9uZW5kJykpLmV2ZW50O1xuXHRwdWJsaWMgcmVhZG9ubHkgb25CZWZvcmVJbnB1dCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEb21FbWl0dGVyKHRoaXMuX2FjdHVhbCwgJ2JlZm9yZWlucHV0JykpLmV2ZW50O1xuXHRwdWJsaWMgcmVhZG9ubHkgb25JbnB1dCA9IDxFdmVudDxJbnB1dEV2ZW50Pj50aGlzLl9yZWdpc3RlcihuZXcgRG9tRW1pdHRlcih0aGlzLl9hY3R1YWwsICdpbnB1dCcpKS5ldmVudDtcblx0cHVibGljIHJlYWRvbmx5IG9uQ3V0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IERvbUVtaXR0ZXIodGhpcy5fYWN0dWFsLCAnY3V0JykpLmV2ZW50O1xuXHRwdWJsaWMgcmVhZG9ubHkgb25Db3B5ID0gdGhpcy5fcmVnaXN0ZXIobmV3IERvbUVtaXR0ZXIodGhpcy5fYWN0dWFsLCAnY29weScpKS5ldmVudDtcblx0cHVibGljIHJlYWRvbmx5IG9uUGFzdGUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRG9tRW1pdHRlcih0aGlzLl9hY3R1YWwsICdwYXN0ZScpKS5ldmVudDtcblx0cHVibGljIHJlYWRvbmx5IG9uRm9jdXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRG9tRW1pdHRlcih0aGlzLl9hY3R1YWwsICdmb2N1cycpKS5ldmVudDtcblx0cHVibGljIHJlYWRvbmx5IG9uQmx1ciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEb21FbWl0dGVyKHRoaXMuX2FjdHVhbCwgJ2JsdXInKSkuZXZlbnQ7XG5cblx0cHVibGljIGdldCBvd25lckRvY3VtZW50KCk6IERvY3VtZW50IHtcblx0XHRyZXR1cm4gdGhpcy5fYWN0dWFsLm93bmVyRG9jdW1lbnQ7XG5cdH1cblxuXHRwcml2YXRlIF9vblN5bnRoZXRpY1RhcCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25TeW50aGV0aWNUYXA6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25TeW50aGV0aWNUYXAuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfaWdub3JlU2VsZWN0aW9uQ2hhbmdlVGltZTogbnVtYmVyO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2FjdHVhbDogSFRNTFRleHRBcmVhRWxlbWVudFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX2lnbm9yZVNlbGVjdGlvbkNoYW5nZVRpbWUgPSAwO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbktleURvd24oKCkgPT4gaW5wdXRMYXRlbmN5Lm9uS2V5RG93bigpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbkJlZm9yZUlucHV0KCgpID0+IGlucHV0TGF0ZW5jeS5vbkJlZm9yZUlucHV0KCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uSW5wdXQoKCkgPT4gaW5wdXRMYXRlbmN5Lm9uSW5wdXQoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMub25LZXlVcCgoKSA9PiBpbnB1dExhdGVuY3kub25LZXlVcCgpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuX2FjdHVhbCwgVGV4dEFyZWFTeW50ZXRoaWNFdmVudHMuVGFwLCAoKSA9PiB0aGlzLl9vblN5bnRoZXRpY1RhcC5maXJlKCkpKTtcblx0fVxuXG5cdHB1YmxpYyBoYXNGb2N1cygpOiBib29sZWFuIHtcblx0XHRjb25zdCBzaGFkb3dSb290ID0gZG9tLmdldFNoYWRvd1Jvb3QodGhpcy5fYWN0dWFsKTtcblx0XHRpZiAoc2hhZG93Um9vdCkge1xuXHRcdFx0cmV0dXJuIHNoYWRvd1Jvb3QuYWN0aXZlRWxlbWVudCA9PT0gdGhpcy5fYWN0dWFsO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5fYWN0dWFsLmlzQ29ubmVjdGVkKSB7XG5cdFx0XHRyZXR1cm4gZG9tLmdldEFjdGl2ZUVsZW1lbnQoKSA9PT0gdGhpcy5fYWN0dWFsO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHNldElnbm9yZVNlbGVjdGlvbkNoYW5nZVRpbWUocmVhc29uOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl9pZ25vcmVTZWxlY3Rpb25DaGFuZ2VUaW1lID0gRGF0ZS5ub3coKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRJZ25vcmVTZWxlY3Rpb25DaGFuZ2VUaW1lKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX2lnbm9yZVNlbGVjdGlvbkNoYW5nZVRpbWU7XG5cdH1cblxuXHRwdWJsaWMgcmVzZXRTZWxlY3Rpb25DaGFuZ2VUaW1lKCk6IHZvaWQge1xuXHRcdHRoaXMuX2lnbm9yZVNlbGVjdGlvbkNoYW5nZVRpbWUgPSAwO1xuXHR9XG5cblx0cHVibGljIGdldFZhbHVlKCk6IHN0cmluZyB7XG5cdFx0Ly8gY29uc29sZS5sb2coJ2N1cnJlbnQgdmFsdWU6ICcgKyB0aGlzLl90ZXh0QXJlYS52YWx1ZSk7XG5cdFx0cmV0dXJuIHRoaXMuX2FjdHVhbC52YWx1ZTtcblx0fVxuXG5cdHB1YmxpYyBzZXRWYWx1ZShyZWFzb246IHN0cmluZywgdmFsdWU6IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IHRleHRBcmVhID0gdGhpcy5fYWN0dWFsO1xuXHRcdGlmICh0ZXh0QXJlYS52YWx1ZSA9PT0gdmFsdWUpIHtcblx0XHRcdC8vIE5vIGNoYW5nZVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHQvLyBjb25zb2xlLmxvZygncmVhc29uOiAnICsgcmVhc29uICsgJywgY3VycmVudCB2YWx1ZTogJyArIHRleHRBcmVhLnZhbHVlICsgJyA9PiBuZXcgdmFsdWU6ICcgKyB2YWx1ZSk7XG5cdFx0dGhpcy5zZXRJZ25vcmVTZWxlY3Rpb25DaGFuZ2VUaW1lKCdzZXRWYWx1ZScpO1xuXHRcdHRleHRBcmVhLnZhbHVlID0gdmFsdWU7XG5cdH1cblxuXHRwdWJsaWMgZ2V0U2VsZWN0aW9uU3RhcnQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fYWN0dWFsLnNlbGVjdGlvbkRpcmVjdGlvbiA9PT0gJ2JhY2t3YXJkJyA/IHRoaXMuX2FjdHVhbC5zZWxlY3Rpb25FbmQgOiB0aGlzLl9hY3R1YWwuc2VsZWN0aW9uU3RhcnQ7XG5cdH1cblxuXHRwdWJsaWMgZ2V0U2VsZWN0aW9uRW5kKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX2FjdHVhbC5zZWxlY3Rpb25EaXJlY3Rpb24gPT09ICdiYWNrd2FyZCcgPyB0aGlzLl9hY3R1YWwuc2VsZWN0aW9uU3RhcnQgOiB0aGlzLl9hY3R1YWwuc2VsZWN0aW9uRW5kO1xuXHR9XG5cblx0cHVibGljIHNldFNlbGVjdGlvblJhbmdlKHJlYXNvbjogc3RyaW5nLCBzZWxlY3Rpb25TdGFydDogbnVtYmVyLCBzZWxlY3Rpb25FbmQ6IG51bWJlcik6IHZvaWQge1xuXHRcdGNvbnN0IHRleHRBcmVhID0gdGhpcy5fYWN0dWFsO1xuXG5cdFx0bGV0IGFjdGl2ZUVsZW1lbnQ6IEVsZW1lbnQgfCBudWxsID0gbnVsbDtcblx0XHRjb25zdCBzaGFkb3dSb290ID0gZG9tLmdldFNoYWRvd1Jvb3QodGV4dEFyZWEpO1xuXHRcdGlmIChzaGFkb3dSb290KSB7XG5cdFx0XHRhY3RpdmVFbGVtZW50ID0gc2hhZG93Um9vdC5hY3RpdmVFbGVtZW50O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhY3RpdmVFbGVtZW50ID0gZG9tLmdldEFjdGl2ZUVsZW1lbnQoKTtcblx0XHR9XG5cdFx0Y29uc3QgYWN0aXZlV2luZG93ID0gZG9tLmdldFdpbmRvdyhhY3RpdmVFbGVtZW50KTtcblxuXHRcdGNvbnN0IGN1cnJlbnRJc0ZvY3VzZWQgPSAoYWN0aXZlRWxlbWVudCA9PT0gdGV4dEFyZWEpO1xuXHRcdGNvbnN0IGN1cnJlbnRTZWxlY3Rpb25TdGFydCA9IHRleHRBcmVhLnNlbGVjdGlvblN0YXJ0O1xuXHRcdGNvbnN0IGN1cnJlbnRTZWxlY3Rpb25FbmQgPSB0ZXh0QXJlYS5zZWxlY3Rpb25FbmQ7XG5cblx0XHRpZiAoY3VycmVudElzRm9jdXNlZCAmJiBjdXJyZW50U2VsZWN0aW9uU3RhcnQgPT09IHNlbGVjdGlvblN0YXJ0ICYmIGN1cnJlbnRTZWxlY3Rpb25FbmQgPT09IHNlbGVjdGlvbkVuZCkge1xuXHRcdFx0Ly8gTm8gY2hhbmdlXG5cdFx0XHQvLyBGaXJlZm94IGlmcmFtZSBidWcgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC9tb25hY28tZWRpdG9yL2lzc3Vlcy82NDMjaXNzdWVjb21tZW50LTM2Nzg3MTM3N1xuXHRcdFx0aWYgKGJyb3dzZXIuaXNGaXJlZm94ICYmIGFjdGl2ZVdpbmRvdy5wYXJlbnQgIT09IGFjdGl2ZVdpbmRvdykge1xuXHRcdFx0XHR0ZXh0QXJlYS5mb2N1cygpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIGNvbnNvbGUubG9nKCdyZWFzb246ICcgKyByZWFzb24gKyAnLCBzZXRTZWxlY3Rpb25SYW5nZTogJyArIHNlbGVjdGlvblN0YXJ0ICsgJyAtPiAnICsgc2VsZWN0aW9uRW5kKTtcblxuXHRcdGlmIChjdXJyZW50SXNGb2N1c2VkKSB7XG5cdFx0XHQvLyBObyBuZWVkIHRvIGZvY3VzLCBvbmx5IG5lZWQgdG8gY2hhbmdlIHRoZSBzZWxlY3Rpb24gcmFuZ2Vcblx0XHRcdHRoaXMuc2V0SWdub3JlU2VsZWN0aW9uQ2hhbmdlVGltZSgnc2V0U2VsZWN0aW9uUmFuZ2UnKTtcblx0XHRcdHRleHRBcmVhLnNldFNlbGVjdGlvblJhbmdlKHNlbGVjdGlvblN0YXJ0LCBzZWxlY3Rpb25FbmQpO1xuXHRcdFx0aWYgKGJyb3dzZXIuaXNGaXJlZm94ICYmIGFjdGl2ZVdpbmRvdy5wYXJlbnQgIT09IGFjdGl2ZVdpbmRvdykge1xuXHRcdFx0XHR0ZXh0QXJlYS5mb2N1cygpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIElmIHRoZSBmb2N1cyBpcyBvdXRzaWRlIHRoZSB0ZXh0YXJlYSwgYnJvd3NlcnMgd2lsbCB0cnkgcmVhbGx5IGhhcmQgdG8gcmV2ZWFsIHRoZSB0ZXh0YXJlYS5cblx0XHQvLyBIZXJlLCB3ZSB0cnkgdG8gdW5kbyB0aGUgYnJvd3NlcidzIGRlc3BlcmF0ZSByZXZlYWwuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHNjcm9sbFN0YXRlID0gZG9tLnNhdmVQYXJlbnRzU2Nyb2xsVG9wKHRleHRBcmVhKTtcblx0XHRcdHRoaXMuc2V0SWdub3JlU2VsZWN0aW9uQ2hhbmdlVGltZSgnc2V0U2VsZWN0aW9uUmFuZ2UnKTtcblx0XHRcdHRleHRBcmVhLmZvY3VzKCk7XG5cdFx0XHR0ZXh0QXJlYS5zZXRTZWxlY3Rpb25SYW5nZShzZWxlY3Rpb25TdGFydCwgc2VsZWN0aW9uRW5kKTtcblx0XHRcdGRvbS5yZXN0b3JlUGFyZW50c1Njcm9sbFRvcCh0ZXh0QXJlYSwgc2Nyb2xsU3RhdGUpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdC8vIFNvbWV0aW1lcyBJRSB0aHJvd3Mgd2hlbiBzZXR0aW5nIHNlbGVjdGlvbiAoZS5nLiB0ZXh0YXJlYSBpcyBvZmYtRE9NKVxuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLGFBQWE7QUFDekIsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQXlCLDZCQUE2QjtBQUN0RCxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLGVBQWU7QUFDeEIsU0FBUyxZQUF5Qix5QkFBeUI7QUFDM0QsU0FBUyx1QkFBdUI7QUFDaEMsWUFBWSxhQUFhO0FBRXpCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQThCLHFCQUE4Qyx3Q0FBd0M7QUFDcEgsU0FBUyxtQkFBZ0QscUJBQXFCO0FBRXZFLElBQVU7QUFBQSxDQUFWLENBQVVBLDZCQUFWO0FBQ0MsRUFBTUEseUJBQUEsTUFBTTtBQUFBLEdBREg7QUF3RGpCLE1BQU0sbUJBQW1CO0FBQUEsRUFJeEIsY0FBYztBQUNiLFNBQUssc0JBQXNCO0FBQUEsRUFDNUI7QUFBQSxFQUVPLHdCQUF3QixNQUE0QztBQUMxRSxXQUFPLFFBQVE7QUFDZixVQUFNLFlBQXVCO0FBQUEsTUFDNUI7QUFBQSxNQUNBLG9CQUFvQixLQUFLO0FBQUEsTUFDekIsb0JBQW9CO0FBQUEsTUFDcEIs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RUFDNUM7QUFBQSxFQUVPLCtCQUF1QztBQUM3QyxXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFTywyQkFBaUM7QUFDdkMsU0FBSyw2QkFBNkI7QUFBQSxFQUNuQztBQUFBLEVBRU8sV0FBbUI7QUFFekIsV0FBTyxLQUFLLFFBQVE7QUFBQSxFQUNyQjtBQUFBLEVBRU8sU0FBUyxRQUFnQixPQUFxQjtBQUNwRCxVQUFNLFdBQVcsS0FBSztBQUN0QixRQUFJLFNBQVMsVUFBVSxPQUFPO0FBRTdCO0FBQUEsSUFDRDtBQUVBLFNBQUssNkJBQTZCLFVBQVU7QUFDNUMsYUFBUyxRQUFRO0FBQUEsRUFDbEI7QUFBQSxFQUVPLG9CQUE0QjtBQUNsQyxXQUFPLEtBQUssUUFBUSx1QkFBdUIsYUFBYSxLQUFLLFFBQVEsZUFBZSxLQUFLLFFBQVE7QUFBQSxFQUNsRztBQUFBLEVBRU8sa0JBQTBCO0FBQ2hDLFdBQU8sS0FBSyxRQUFRLHVCQUF1QixhQUFhLEtBQUssUUFBUSxpQkFBaUIsS0FBSyxRQUFRO0FBQUEsRUFDcEc7QUFBQSxFQUVPLGtCQUFrQixRQUFnQixnQkFBd0IsY0FBNEI7QUFDNUYsVUFBTSxXQUFXLEtBQUs7QUFFdEIsUUFBSSxnQkFBZ0M7QUFDcEMsVUFBTSxhQUFhLElBQUksY0FBYyxRQUFRO0FBQzdDLFFBQUksWUFBWTtBQUNmLHNCQUFnQixXQUFXO0FBQUEsSUFDNUIsT0FBTztBQUNOLHNCQUFnQixJQUFJLGlCQUFpQjtBQUFBLElBQ3RDO0FBQ0EsVUFBTSxlQUFlLElBQUksVUFBVSxhQUFhO0FBRWhELFVBQU0sbUJBQW9CLGtCQUFrQjtBQUM1QyxVQUFNLHdCQUF3QixTQUFTO0FBQ3ZDLFVBQU0sc0JBQXNCLFNBQVM7QUFFckMsUUFBSSxvQkFBb0IsMEJBQTBCLGtCQUFrQix3QkFBd0IsY0FBYztBQUd6RyxVQUFJLFFBQVEsYUFBYSxhQUFhLFdBQVcsY0FBYztBQUM5RCxpQkFBUyxNQUFNO0FBQUEsTUFDaEI7QUFDQTtBQUFBLElBQ0Q7QUFJQSxRQUFJLGtCQUFrQjtBQUVyQixXQUFLLDZCQUE2QixtQkFBbUI7QUFDckQsZUFBUyxrQkFBa0IsZ0JBQWdCLFlBQVk7QUFDdkQsVUFBSSxRQUFRLGFBQWEsYUFBYSxXQUFXLGNBQWM7QUFDOUQsaUJBQVMsTUFBTTtBQUFBLE1BQ2hCO0FBQ0E7QUFBQSxJQUNEO0FBSUEsUUFBSTtBQUNILFlBQU0sY0FBYyxJQUFJLHFCQUFxQixRQUFRO0FBQ3JELFdBQUssNkJBQTZCLG1CQUFtQjtBQUNyRCxlQUFTLE1BQU07QUFDZixlQUFTLGtCQUFrQixnQkFBZ0IsWUFBWTtBQUN2RCxVQUFJLHdCQUF3QixVQUFVLFdBQVc7QUFBQSxJQUNsRCxTQUFTLEdBQUc7QUFBQSxJQUVaO0FBQUEsRUFDRDtBQUNEOyIsCiAgIm5hbWVzIjogWyJUZXh0QXJlYVN5bnRldGhpY0V2ZW50cyIsICJ0eXBlSW5wdXQiXQp9Cg==
