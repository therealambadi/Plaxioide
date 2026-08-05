import * as dom from "../../dom.js";
import * as cssJs from "../../cssValue.js";
import { DomEmitter } from "../../event.js";
import { renderFormattedText, renderText } from "../../formattedTextRenderer.js";
import { ActionBar } from "../actionbar/actionbar.js";
import * as aria from "../aria/aria.js";
import { AnchorAlignment } from "../contextview/contextview.js";
import { getBaseLayerHoverDelegate } from "../hover/hoverDelegate2.js";
import { ScrollableElement } from "../scrollbar/scrollableElement.js";
import { Widget } from "../widget.js";
import { Emitter, Event } from "../../../common/event.js";
import { HistoryNavigator } from "../../../common/history.js";
import { equals } from "../../../common/objects.js";
import { ScrollbarVisibility } from "../../../common/scrollable.js";
import "./inputBox.css";
import * as nls from "../../../../nls.js";
import { MutableDisposable } from "../../../common/lifecycle.js";
const $ = dom.$;
var MessageType = /* @__PURE__ */ ((MessageType2) => {
  MessageType2[MessageType2["INFO"] = 1] = "INFO";
  MessageType2[MessageType2["WARNING"] = 2] = "WARNING";
  MessageType2[MessageType2["ERROR"] = 3] = "ERROR";
  return MessageType2;
})(MessageType || {});
const unthemedInboxStyles = {
  inputBackground: "#3C3C3C",
  inputForeground: "#CCCCCC",
  inputValidationInfoBorder: "#55AAFF",
  inputValidationInfoBackground: "#063B49",
  inputValidationWarningBorder: "#B89500",
  inputValidationWarningBackground: "#352A05",
  inputValidationErrorBorder: "#BE1100",
  inputValidationErrorBackground: "#5A1D1D",
  inputBorder: void 0,
  inputValidationErrorForeground: void 0,
  inputValidationInfoForeground: void 0,
  inputValidationWarningForeground: void 0
};
class InputBox extends Widget {
  constructor(container, contextViewProvider, options) {
    super();
    this.state = "idle";
    this.maxHeight = Number.POSITIVE_INFINITY;
    this.hover = this._register(new MutableDisposable());
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._onDidHeightChange = this._register(new Emitter());
    this.onDidHeightChange = this._onDidHeightChange.event;
    this.contextViewProvider = contextViewProvider;
    this.options = options;
    this.message = null;
    this.placeholder = this.options.placeholder || "";
    this.tooltip = this.options.tooltip ?? (this.placeholder || "");
    this.ariaLabel = this.options.ariaLabel || "";
    if (this.options.validationOptions) {
      this.validation = this.options.validationOptions.validation;
    }
    this.element = dom.append(container, $(".monaco-inputbox.idle"));
    const tagName = this.options.flexibleHeight ? "textarea" : "input";
    const wrapper = dom.append(this.element, $(".ibwrapper"));
    this.input = dom.append(wrapper, $(tagName + ".input.empty"));
    this.input.setAttribute("autocorrect", "off");
    this.input.setAttribute("autocapitalize", "off");
    this.input.setAttribute("spellcheck", "false");
    this.onfocus(this.input, () => this.element.classList.add("synthetic-focus"));
    this.onblur(this.input, () => this.element.classList.remove("synthetic-focus"));
    if (this.options.flexibleHeight) {
      this.maxHeight = typeof this.options.flexibleMaxHeight === "number" ? this.options.flexibleMaxHeight : Number.POSITIVE_INFINITY;
      this.mirror = dom.append(wrapper, $("div.mirror"));
      this.mirror.innerText = "\xA0";
      this.scrollableElement = new ScrollableElement(this.element, { vertical: ScrollbarVisibility.Auto });
      if (this.options.flexibleWidth) {
        this.input.setAttribute("wrap", "off");
        this.mirror.style.whiteSpace = "pre";
        this.mirror.style.wordWrap = "initial";
      }
      dom.append(container, this.scrollableElement.getDomNode());
      this._register(this.scrollableElement);
      this._register(this.scrollableElement.onScroll((e) => this.input.scrollTop = e.scrollTop));
      const onSelectionChange = this._register(new DomEmitter(container.ownerDocument, "selectionchange"));
      const onAnchoredSelectionChange = Event.filter(onSelectionChange.event, () => {
        const selection = container.ownerDocument.getSelection();
        return selection?.anchorNode === wrapper;
      });
      this._register(onAnchoredSelectionChange(this.updateScrollDimensions, this));
      this._register(this.onDidHeightChange(this.updateScrollDimensions, this));
    } else {
      this.input.type = this.options.type || "text";
      this.input.setAttribute("wrap", "off");
    }
    if (this.ariaLabel) {
      this.input.setAttribute("aria-label", this.ariaLabel);
    }
    if (this.placeholder && !this.options.showPlaceholderOnFocus) {
      this.setPlaceHolder(this.placeholder);
    }
    if (this.tooltip) {
      this.setTooltip(this.tooltip);
    }
    this.oninput(this.input, () => this.onValueChange());
    this.onblur(this.input, () => this.onBlur());
    this.onfocus(this.input, () => this.onFocus());
    this._register(this.ignoreGesture(this.input));
    setTimeout(() => this.updateMirror(), 0);
    if (this.options.actions) {
      this.actionbar = this._register(new ActionBar(this.element));
      this.actionbar.push(this.options.actions, { icon: true, label: false });
    }
    this.applyStyles();
  }
  onBlur() {
    this._hideMessage();
    if (this.options.showPlaceholderOnFocus) {
      this.input.setAttribute("placeholder", "");
    }
  }
  onFocus() {
    this._showMessage();
    if (this.options.showPlaceholderOnFocus) {
      this.input.setAttribute("placeholder", this.placeholder || "");
    }
  }
  setPlaceHolder(placeHolder) {
    this.placeholder = placeHolder;
    this.input.setAttribute("placeholder", placeHolder);
  }
  setTooltip(tooltip) {
    this.tooltip = tooltip;
    if (!this.hover.value) {
      this.hover.value = this._register(getBaseLayerHoverDelegate().setupDelayedHoverAtMouse(this.input, () => ({
        content: this.tooltip,
        appearance: {
          compact: true
        }
      })));
    }
  }
  setAriaLabel(label) {
    this.ariaLabel = label;
    if (label) {
      this.input.setAttribute("aria-label", this.ariaLabel);
    } else {
      this.input.removeAttribute("aria-label");
    }
  }
  getAriaLabel() {
    return this.ariaLabel;
  }
  get mirrorElement() {
    return this.mirror;
  }
  get inputElement() {
    return this.input;
  }
  get value() {
    return this.input.value;
  }
  set value(newValue) {
    if (this.input.value !== newValue) {
      this.input.value = newValue;
      this.onValueChange();
    }
  }
  get step() {
    return this.input.step;
  }
  set step(newValue) {
    this.input.step = newValue;
  }
  get height() {
    return typeof this.cachedHeight === "number" ? this.cachedHeight : dom.getTotalHeight(this.element);
  }
  focus() {
    this.input.focus();
  }
  blur() {
    this.input.blur();
  }
  hasFocus() {
    return dom.isActiveElement(this.input);
  }
  select(range = null) {
    this.input.select();
    if (range) {
      this.input.setSelectionRange(range.start, range.end);
      if (range.end === this.input.value.length) {
        this.input.scrollLeft = this.input.scrollWidth;
      }
    }
  }
  isSelectionAtEnd() {
    return this.input.selectionEnd === this.input.value.length && this.input.selectionStart === this.input.selectionEnd;
  }
  getSelection() {
    const selectionStart = this.input.selectionStart;
    if (selectionStart === null) {
      return null;
    }
    const selectionEnd = this.input.selectionEnd ?? selectionStart;
    return {
      start: selectionStart,
      end: selectionEnd
    };
  }
  enable() {
    this.input.removeAttribute("disabled");
  }
  disable() {
    this.blur();
    this.input.disabled = true;
    this._hideMessage();
  }
  setEnabled(enabled) {
    if (enabled) {
      this.enable();
    } else {
      this.disable();
    }
  }
  get width() {
    return dom.getTotalWidth(this.input);
  }
  set width(width) {
    if (this.options.flexibleHeight && this.options.flexibleWidth) {
      let horizontalPadding = 0;
      if (this.mirror) {
        const paddingLeft = parseFloat(this.mirror.style.paddingLeft || "") || 0;
        const paddingRight = parseFloat(this.mirror.style.paddingRight || "") || 0;
        horizontalPadding = paddingLeft + paddingRight;
      }
      this.input.style.width = width - horizontalPadding + "px";
    } else {
      this.input.style.width = width + "px";
    }
    if (this.mirror) {
      this.mirror.style.width = width + "px";
    }
  }
  set paddingRight(paddingRight) {
    this.input.style.width = `calc(100% - ${paddingRight}px)`;
    if (this.mirror) {
      this.mirror.style.paddingRight = paddingRight + "px";
    }
  }
  updateScrollDimensions() {
    if (typeof this.cachedContentHeight !== "number" || typeof this.cachedHeight !== "number" || !this.scrollableElement) {
      return;
    }
    const scrollHeight = this.cachedContentHeight;
    const height = this.cachedHeight;
    const scrollTop = this.input.scrollTop;
    this.scrollableElement.setScrollDimensions({ scrollHeight, height });
    this.scrollableElement.setScrollPosition({ scrollTop });
  }
  showMessage(message, force) {
    if (this.state === "open" && equals(this.message, message)) {
      return;
    }
    this.message = message;
    this.element.classList.remove("idle");
    this.element.classList.remove("info");
    this.element.classList.remove("warning");
    this.element.classList.remove("error");
    this.element.classList.add(this.classForType(message.type));
    const styles = this.stylesForType(this.message.type);
    this.element.style.border = `1px solid ${cssJs.asCssValueWithDefault(styles.border, "transparent")}`;
    if (this.message.content && (this.hasFocus() || force)) {
      this._showMessage();
    }
  }
  hideMessage() {
    this.message = null;
    this.element.classList.remove("info");
    this.element.classList.remove("warning");
    this.element.classList.remove("error");
    this.element.classList.add("idle");
    this._hideMessage();
    this.applyStyles();
  }
  isInputValid() {
    return !!this.validation && !this.validation(this.value);
  }
  validate() {
    let errorMsg = null;
    if (this.validation) {
      errorMsg = this.validation(this.value);
      if (errorMsg) {
        this.inputElement.setAttribute("aria-invalid", "true");
        this.showMessage(errorMsg);
      } else if (this.inputElement.hasAttribute("aria-invalid")) {
        this.inputElement.removeAttribute("aria-invalid");
        this.hideMessage();
      }
    }
    return errorMsg?.type;
  }
  stylesForType(type) {
    const styles = this.options.inputBoxStyles;
    switch (type) {
      case 1 /* INFO */:
        return { border: styles.inputValidationInfoBorder, background: styles.inputValidationInfoBackground, foreground: styles.inputValidationInfoForeground };
      case 2 /* WARNING */:
        return { border: styles.inputValidationWarningBorder, background: styles.inputValidationWarningBackground, foreground: styles.inputValidationWarningForeground };
      default:
        return { border: styles.inputValidationErrorBorder, background: styles.inputValidationErrorBackground, foreground: styles.inputValidationErrorForeground };
    }
  }
  classForType(type) {
    switch (type) {
      case 1 /* INFO */:
        return "info";
      case 2 /* WARNING */:
        return "warning";
      default:
        return "error";
    }
  }
  _showMessage() {
    if (!this.contextViewProvider || !this.message) {
      return;
    }
    let div;
    const layout = () => div.style.width = dom.getTotalWidth(this.element) + "px";
    this.contextViewProvider.showContextView({
      getAnchor: () => this.element,
      anchorAlignment: AnchorAlignment.RIGHT,
      render: (container) => {
        if (!this.message) {
          return null;
        }
        div = dom.append(container, $(".monaco-inputbox-container"));
        layout();
        const renderOptions = {
          inline: true,
          className: "monaco-inputbox-message"
        };
        const spanElement = this.message.formatContent ? renderFormattedText(this.message.content, renderOptions) : renderText(this.message.content, renderOptions);
        spanElement.classList.add(this.classForType(this.message.type));
        const styles = this.stylesForType(this.message.type);
        spanElement.style.backgroundColor = styles.background ?? "";
        spanElement.style.color = styles.foreground ?? "";
        spanElement.style.border = styles.border ? `1px solid ${styles.border}` : "";
        dom.append(div, spanElement);
        return null;
      },
      onHide: () => {
        this.state = "closed";
      },
      layout
    });
    let alertText;
    if (this.message.type === 3 /* ERROR */) {
      alertText = nls.localize("alertErrorMessage", "Error: {0}", this.message.content);
    } else if (this.message.type === 2 /* WARNING */) {
      alertText = nls.localize("alertWarningMessage", "Warning: {0}", this.message.content);
    } else {
      alertText = nls.localize("alertInfoMessage", "Info: {0}", this.message.content);
    }
    aria.alert(alertText);
    this.state = "open";
  }
  _hideMessage() {
    if (!this.contextViewProvider) {
      return;
    }
    if (this.state === "open") {
      this.contextViewProvider.hideContextView();
    }
    this.state = "idle";
  }
  onValueChange() {
    this._onDidChange.fire(this.value);
    this.validate();
    this.updateMirror();
    this.input.classList.toggle("empty", !this.value);
    if (this.state === "open" && this.contextViewProvider) {
      this.contextViewProvider.layout();
    }
  }
  updateMirror() {
    if (!this.mirror) {
      return;
    }
    const value = this.value;
    const lastCharCode = value.charCodeAt(value.length - 1);
    const suffix = lastCharCode === 10 ? " " : "";
    const mirrorTextContent = (value + suffix).replace(/\u000c/g, "");
    if (mirrorTextContent) {
      this.mirror.textContent = value + suffix;
    } else {
      this.mirror.innerText = "\xA0";
    }
    this.layout();
  }
  applyStyles() {
    const styles = this.options.inputBoxStyles;
    const background = styles.inputBackground ?? "";
    const foreground = styles.inputForeground ?? "";
    const border = styles.inputBorder ?? "";
    this.element.style.backgroundColor = background;
    this.element.style.color = foreground;
    this.input.style.backgroundColor = "inherit";
    this.input.style.color = foreground;
    this.element.style.border = `1px solid ${cssJs.asCssValueWithDefault(border, "transparent")}`;
  }
  layout() {
    if (!this.mirror) {
      return;
    }
    const previousHeight = this.cachedContentHeight;
    this.cachedContentHeight = dom.getTotalHeight(this.mirror);
    if (previousHeight !== this.cachedContentHeight) {
      this.cachedHeight = Math.min(this.cachedContentHeight, this.maxHeight);
      this.input.style.height = this.cachedHeight + "px";
      this._onDidHeightChange.fire(this.cachedContentHeight);
    }
  }
  insertAtCursor(text) {
    const inputElement = this.inputElement;
    const start = inputElement.selectionStart;
    const end = inputElement.selectionEnd;
    const content = inputElement.value;
    if (start !== null && end !== null) {
      this.value = content.substr(0, start) + text + content.substr(end);
      inputElement.setSelectionRange(start + 1, start + 1);
      this.layout();
    }
  }
  dispose() {
    this._hideMessage();
    this.message = null;
    this.actionbar?.dispose();
    super.dispose();
  }
}
class HistoryInputBox extends InputBox {
  constructor(container, contextViewProvider, options) {
    const NLS_PLACEHOLDER_HISTORY_HINT_SUFFIX_NO_PARENS = nls.localize({
      key: "history.inputbox.hint.suffix.noparens",
      comment: ['Text is the suffix of an input field placeholder coming after the action the input field performs, this will be used when the input field ends in a closing parenthesis ")", for example "Filter (e.g. text, !exclude)". The character inserted into the final string is \u21C5 to represent the up and down arrow keys.']
    }, " or {0} for history", `\u21C5`);
    const NLS_PLACEHOLDER_HISTORY_HINT_SUFFIX_IN_PARENS = nls.localize({
      key: "history.inputbox.hint.suffix.inparens",
      comment: ['Text is the suffix of an input field placeholder coming after the action the input field performs, this will be used when the input field does NOT end in a closing parenthesis (eg. "Find"). The character inserted into the final string is \u21C5 to represent the up and down arrow keys.']
    }, " ({0} for history)", `\u21C5`);
    super(container, contextViewProvider, options);
    this._onDidFocus = this._register(new Emitter());
    this.onDidFocus = this._onDidFocus.event;
    this._onDidBlur = this._register(new Emitter());
    this.onDidBlur = this._onDidBlur.event;
    this.history = this._register(new HistoryNavigator(options.history, 100));
    const addSuffix = () => {
      if (options.showHistoryHint && options.showHistoryHint() && !this.placeholder.endsWith(NLS_PLACEHOLDER_HISTORY_HINT_SUFFIX_NO_PARENS) && !this.placeholder.endsWith(NLS_PLACEHOLDER_HISTORY_HINT_SUFFIX_IN_PARENS) && this.history.getHistory().length) {
        const suffix = this.placeholder.endsWith(")") ? NLS_PLACEHOLDER_HISTORY_HINT_SUFFIX_NO_PARENS : NLS_PLACEHOLDER_HISTORY_HINT_SUFFIX_IN_PARENS;
        const suffixedPlaceholder = this.placeholder + suffix;
        if (options.showPlaceholderOnFocus && !dom.isActiveElement(this.input)) {
          this.placeholder = suffixedPlaceholder;
        } else {
          this.setPlaceHolder(suffixedPlaceholder);
        }
      }
    };
    this.observer = new MutationObserver((mutationList, observer) => {
      mutationList.forEach((mutation) => {
        if (!mutation.target.textContent) {
          addSuffix();
        }
      });
    });
    this.observer.observe(this.input, { attributeFilter: ["class"] });
    this.onfocus(this.input, () => addSuffix());
    this.onblur(this.input, () => {
      const resetPlaceholder = (historyHint) => {
        if (!this.placeholder.endsWith(historyHint)) {
          return false;
        } else {
          const revertedPlaceholder = this.placeholder.slice(0, this.placeholder.length - historyHint.length);
          if (options.showPlaceholderOnFocus) {
            this.placeholder = revertedPlaceholder;
          } else {
            this.setPlaceHolder(revertedPlaceholder);
          }
          return true;
        }
      };
      if (!resetPlaceholder(NLS_PLACEHOLDER_HISTORY_HINT_SUFFIX_IN_PARENS)) {
        resetPlaceholder(NLS_PLACEHOLDER_HISTORY_HINT_SUFFIX_NO_PARENS);
      }
    });
  }
  dispose() {
    super.dispose();
    if (this.observer) {
      this.observer.disconnect();
      this.observer = void 0;
    }
  }
  addToHistory(always) {
    if (this.value && (always || this.value !== this.getCurrentValue())) {
      this.history.add(this.value);
    }
  }
  prependHistory(restoredHistory) {
    const newHistory = this.getHistory();
    this.clearHistory();
    restoredHistory.forEach((item) => {
      this.history.add(item);
    });
    newHistory.forEach((item) => {
      this.history.add(item);
    });
  }
  getHistory() {
    return this.history.getHistory();
  }
  isAtFirstInHistory() {
    return this.history.isFirst();
  }
  isAtLastInHistory() {
    return this.history.isLast();
  }
  isNowhereInHistory() {
    return this.history.isNowhere();
  }
  showNextValue() {
    if (!this.history.has(this.value)) {
      this.addToHistory();
    }
    let next = this.getNextValue();
    if (next) {
      next = next === this.value ? this.getNextValue() : next;
    }
    this.value = next ?? "";
    aria.status(this.value ? this.value : nls.localize("clearedInput", "Cleared Input"));
  }
  showPreviousValue() {
    if (!this.history.has(this.value)) {
      this.addToHistory();
    }
    let previous = this.getPreviousValue();
    if (previous) {
      previous = previous === this.value ? this.getPreviousValue() : previous;
    }
    if (previous) {
      this.value = previous;
      aria.status(this.value);
    }
  }
  clearHistory() {
    this.history.clear();
  }
  setPlaceHolder(placeHolder) {
    super.setPlaceHolder(placeHolder);
    this.setTooltip(placeHolder);
  }
  onBlur() {
    super.onBlur();
    this._onDidBlur.fire();
  }
  onFocus() {
    super.onFocus();
    this._onDidFocus.fire();
  }
  getCurrentValue() {
    let currentValue = this.history.current();
    if (!currentValue) {
      currentValue = this.history.last();
      this.history.next();
    }
    return currentValue;
  }
  getPreviousValue() {
    return this.history.previous() || this.history.first();
  }
  getNextValue() {
    return this.history.next();
  }
}
export {
  HistoryInputBox,
  InputBox,
  MessageType,
  unthemedInboxStyles
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2Jyb3dzZXIvdWkvaW5wdXRib3gvaW5wdXRCb3gudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vZG9tLmpzJztcbmltcG9ydCAqIGFzIGNzc0pzIGZyb20gJy4uLy4uL2Nzc1ZhbHVlLmpzJztcbmltcG9ydCB7IERvbUVtaXR0ZXIgfSBmcm9tICcuLi8uLi9ldmVudC5qcyc7XG5pbXBvcnQgeyByZW5kZXJGb3JtYXR0ZWRUZXh0LCByZW5kZXJUZXh0IH0gZnJvbSAnLi4vLi4vZm9ybWF0dGVkVGV4dFJlbmRlcmVyLmpzJztcbmltcG9ydCB7IElIaXN0b3J5TmF2aWdhdGlvbldpZGdldCB9IGZyb20gJy4uLy4uL2hpc3RvcnkuanMnO1xuaW1wb3J0IHsgTWFya2Rvd25SZW5kZXJPcHRpb25zIH0gZnJvbSAnLi4vLi4vbWFya2Rvd25SZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBBY3Rpb25CYXIgfSBmcm9tICcuLi9hY3Rpb25iYXIvYWN0aW9uYmFyLmpzJztcbmltcG9ydCAqIGFzIGFyaWEgZnJvbSAnLi4vYXJpYS9hcmlhLmpzJztcbmltcG9ydCB7IEFuY2hvckFsaWdubWVudCwgSUNvbnRleHRWaWV3UHJvdmlkZXIgfSBmcm9tICcuLi9jb250ZXh0dmlldy9jb250ZXh0dmlldy5qcyc7XG5pbXBvcnQgeyBnZXRCYXNlTGF5ZXJIb3ZlckRlbGVnYXRlIH0gZnJvbSAnLi4vaG92ZXIvaG92ZXJEZWxlZ2F0ZTIuanMnO1xuaW1wb3J0IHsgU2Nyb2xsYWJsZUVsZW1lbnQgfSBmcm9tICcuLi9zY3JvbGxiYXIvc2Nyb2xsYWJsZUVsZW1lbnQuanMnO1xuaW1wb3J0IHsgV2lkZ2V0IH0gZnJvbSAnLi4vd2lkZ2V0LmpzJztcbmltcG9ydCB7IElBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBIaXN0b3J5TmF2aWdhdG9yLCBJSGlzdG9yeSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9oaXN0b3J5LmpzJztcbmltcG9ydCB7IGVxdWFscyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9vYmplY3RzLmpzJztcbmltcG9ydCB7IFNjcm9sbGJhclZpc2liaWxpdHkgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vc2Nyb2xsYWJsZS5qcyc7XG5pbXBvcnQgJy4vaW5wdXRCb3guY3NzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgTXV0YWJsZURpc3Bvc2FibGUsIHR5cGUgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGlmZWN5Y2xlLmpzJztcblxuXG5jb25zdCAkID0gZG9tLiQ7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUlucHV0T3B0aW9ucyB7XG5cdHJlYWRvbmx5IHBsYWNlaG9sZGVyPzogc3RyaW5nO1xuXHRyZWFkb25seSBzaG93UGxhY2Vob2xkZXJPbkZvY3VzPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgdG9vbHRpcD86IHN0cmluZztcblx0cmVhZG9ubHkgYXJpYUxhYmVsPzogc3RyaW5nO1xuXHRyZWFkb25seSB0eXBlPzogc3RyaW5nO1xuXHRyZWFkb25seSB2YWxpZGF0aW9uT3B0aW9ucz86IElJbnB1dFZhbGlkYXRpb25PcHRpb25zO1xuXHRyZWFkb25seSBmbGV4aWJsZUhlaWdodD86IGJvb2xlYW47XG5cdHJlYWRvbmx5IGZsZXhpYmxlV2lkdGg/OiBib29sZWFuO1xuXHRyZWFkb25seSBmbGV4aWJsZU1heEhlaWdodD86IG51bWJlcjtcblx0cmVhZG9ubHkgYWN0aW9ucz86IFJlYWRvbmx5QXJyYXk8SUFjdGlvbj47XG5cdHJlYWRvbmx5IGlucHV0Qm94U3R5bGVzOiBJSW5wdXRCb3hTdHlsZXM7XG5cdHJlYWRvbmx5IGhpc3Rvcnk/OiBJSGlzdG9yeTxzdHJpbmc+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElJbnB1dEJveFN0eWxlcyB7XG5cdHJlYWRvbmx5IGlucHV0QmFja2dyb3VuZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBpbnB1dEZvcmVncm91bmQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgaW5wdXRCb3JkZXI6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgaW5wdXRWYWxpZGF0aW9uSW5mb0JvcmRlcjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBpbnB1dFZhbGlkYXRpb25JbmZvQmFja2dyb3VuZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBpbnB1dFZhbGlkYXRpb25JbmZvRm9yZWdyb3VuZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBpbnB1dFZhbGlkYXRpb25XYXJuaW5nQm9yZGVyOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IGlucHV0VmFsaWRhdGlvbldhcm5pbmdCYWNrZ3JvdW5kOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IGlucHV0VmFsaWRhdGlvbldhcm5pbmdGb3JlZ3JvdW5kOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IGlucHV0VmFsaWRhdGlvbkVycm9yQm9yZGVyOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IGlucHV0VmFsaWRhdGlvbkVycm9yQmFja2dyb3VuZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBpbnB1dFZhbGlkYXRpb25FcnJvckZvcmVncm91bmQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJSW5wdXRWYWxpZGF0b3Ige1xuXHQodmFsdWU6IHN0cmluZyk6IElNZXNzYWdlIHwgbnVsbDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJTWVzc2FnZSB7XG5cdHJlYWRvbmx5IGNvbnRlbnQ/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IGZvcm1hdENvbnRlbnQ/OiBib29sZWFuOyAvLyBkZWZhdWx0cyB0byBmYWxzZVxuXHRyZWFkb25seSB0eXBlPzogTWVzc2FnZVR5cGU7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUlucHV0VmFsaWRhdGlvbk9wdGlvbnMge1xuXHR2YWxpZGF0aW9uPzogSUlucHV0VmFsaWRhdG9yO1xufVxuXG5leHBvcnQgY29uc3QgZW51bSBNZXNzYWdlVHlwZSB7XG5cdElORk8gPSAxLFxuXHRXQVJOSU5HID0gMixcblx0RVJST1IgPSAzXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVJhbmdlIHtcblx0c3RhcnQ6IG51bWJlcjtcblx0ZW5kOiBudW1iZXI7XG59XG5cbmV4cG9ydCBjb25zdCB1bnRoZW1lZEluYm94U3R5bGVzOiBJSW5wdXRCb3hTdHlsZXMgPSB7XG5cdGlucHV0QmFja2dyb3VuZDogJyMzQzNDM0MnLFxuXHRpbnB1dEZvcmVncm91bmQ6ICcjQ0NDQ0NDJyxcblx0aW5wdXRWYWxpZGF0aW9uSW5mb0JvcmRlcjogJyM1NUFBRkYnLFxuXHRpbnB1dFZhbGlkYXRpb25JbmZvQmFja2dyb3VuZDogJyMwNjNCNDknLFxuXHRpbnB1dFZhbGlkYXRpb25XYXJuaW5nQm9yZGVyOiAnI0I4OTUwMCcsXG5cdGlucHV0VmFsaWRhdGlvbldhcm5pbmdCYWNrZ3JvdW5kOiAnIzM1MkEwNScsXG5cdGlucHV0VmFsaWRhdGlvbkVycm9yQm9yZGVyOiAnI0JFMTEwMCcsXG5cdGlucHV0VmFsaWRhdGlvbkVycm9yQmFja2dyb3VuZDogJyM1QTFEMUQnLFxuXHRpbnB1dEJvcmRlcjogdW5kZWZpbmVkLFxuXHRpbnB1dFZhbGlkYXRpb25FcnJvckZvcmVncm91bmQ6IHVuZGVmaW5lZCxcblx0aW5wdXRWYWxpZGF0aW9uSW5mb0ZvcmVncm91bmQ6IHVuZGVmaW5lZCxcblx0aW5wdXRWYWxpZGF0aW9uV2FybmluZ0ZvcmVncm91bmQ6IHVuZGVmaW5lZFxufTtcblxuZXhwb3J0IGNsYXNzIElucHV0Qm94IGV4dGVuZHMgV2lkZ2V0IHtcblx0cHJpdmF0ZSBjb250ZXh0Vmlld1Byb3ZpZGVyPzogSUNvbnRleHRWaWV3UHJvdmlkZXI7XG5cdGVsZW1lbnQ6IEhUTUxFbGVtZW50O1xuXHRwcm90ZWN0ZWQgaW5wdXQ6IEhUTUxJbnB1dEVsZW1lbnQ7XG5cdHByaXZhdGUgYWN0aW9uYmFyPzogQWN0aW9uQmFyO1xuXHRwcml2YXRlIHJlYWRvbmx5IG9wdGlvbnM6IElJbnB1dE9wdGlvbnM7XG5cdHByaXZhdGUgbWVzc2FnZTogSU1lc3NhZ2UgfCBudWxsO1xuXHRwcm90ZWN0ZWQgcGxhY2Vob2xkZXI6IHN0cmluZztcblx0cHJpdmF0ZSB0b29sdGlwOiBzdHJpbmc7XG5cdHByaXZhdGUgYXJpYUxhYmVsOiBzdHJpbmc7XG5cdHByaXZhdGUgdmFsaWRhdGlvbj86IElJbnB1dFZhbGlkYXRvcjtcblx0cHJpdmF0ZSBzdGF0ZTogJ2lkbGUnIHwgJ29wZW4nIHwgJ2Nsb3NlZCcgPSAnaWRsZSc7XG5cblx0cHJpdmF0ZSBtaXJyb3I6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGNhY2hlZEhlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGNhY2hlZENvbnRlbnRIZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBtYXhIZWlnaHQ6IG51bWJlciA9IE51bWJlci5QT1NJVElWRV9JTkZJTklUWTtcblx0cHJpdmF0ZSBzY3JvbGxhYmxlRWxlbWVudDogU2Nyb2xsYWJsZUVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgaG92ZXI6IE11dGFibGVEaXNwb3NhYmxlPElEaXNwb3NhYmxlPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblxuXHRwcml2YXRlIF9vbkRpZENoYW5nZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHN0cmluZz4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZTogRXZlbnQ8c3RyaW5nPiA9IHRoaXMuX29uRGlkQ2hhbmdlLmV2ZW50O1xuXG5cdHByaXZhdGUgX29uRGlkSGVpZ2h0Q2hhbmdlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8bnVtYmVyPigpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkSGVpZ2h0Q2hhbmdlOiBFdmVudDxudW1iZXI+ID0gdGhpcy5fb25EaWRIZWlnaHRDaGFuZ2UuZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgY29udGV4dFZpZXdQcm92aWRlcjogSUNvbnRleHRWaWV3UHJvdmlkZXIgfCB1bmRlZmluZWQsIG9wdGlvbnM6IElJbnB1dE9wdGlvbnMpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5jb250ZXh0Vmlld1Byb3ZpZGVyID0gY29udGV4dFZpZXdQcm92aWRlcjtcblx0XHR0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuXG5cdFx0dGhpcy5tZXNzYWdlID0gbnVsbDtcblx0XHR0aGlzLnBsYWNlaG9sZGVyID0gdGhpcy5vcHRpb25zLnBsYWNlaG9sZGVyIHx8ICcnO1xuXHRcdHRoaXMudG9vbHRpcCA9IHRoaXMub3B0aW9ucy50b29sdGlwID8/ICh0aGlzLnBsYWNlaG9sZGVyIHx8ICcnKTtcblx0XHR0aGlzLmFyaWFMYWJlbCA9IHRoaXMub3B0aW9ucy5hcmlhTGFiZWwgfHwgJyc7XG5cblx0XHRpZiAodGhpcy5vcHRpb25zLnZhbGlkYXRpb25PcHRpb25zKSB7XG5cdFx0XHR0aGlzLnZhbGlkYXRpb24gPSB0aGlzLm9wdGlvbnMudmFsaWRhdGlvbk9wdGlvbnMudmFsaWRhdGlvbjtcblx0XHR9XG5cblx0XHR0aGlzLmVsZW1lbnQgPSBkb20uYXBwZW5kKGNvbnRhaW5lciwgJCgnLm1vbmFjby1pbnB1dGJveC5pZGxlJykpO1xuXG5cdFx0Y29uc3QgdGFnTmFtZSA9IHRoaXMub3B0aW9ucy5mbGV4aWJsZUhlaWdodCA/ICd0ZXh0YXJlYScgOiAnaW5wdXQnO1xuXG5cdFx0Y29uc3Qgd3JhcHBlciA9IGRvbS5hcHBlbmQodGhpcy5lbGVtZW50LCAkKCcuaWJ3cmFwcGVyJykpO1xuXHRcdHRoaXMuaW5wdXQgPSBkb20uYXBwZW5kKHdyYXBwZXIsICQodGFnTmFtZSArICcuaW5wdXQuZW1wdHknKSk7XG5cdFx0dGhpcy5pbnB1dC5zZXRBdHRyaWJ1dGUoJ2F1dG9jb3JyZWN0JywgJ29mZicpO1xuXHRcdHRoaXMuaW5wdXQuc2V0QXR0cmlidXRlKCdhdXRvY2FwaXRhbGl6ZScsICdvZmYnKTtcblx0XHR0aGlzLmlucHV0LnNldEF0dHJpYnV0ZSgnc3BlbGxjaGVjaycsICdmYWxzZScpO1xuXG5cdFx0dGhpcy5vbmZvY3VzKHRoaXMuaW5wdXQsICgpID0+IHRoaXMuZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdzeW50aGV0aWMtZm9jdXMnKSk7XG5cdFx0dGhpcy5vbmJsdXIodGhpcy5pbnB1dCwgKCkgPT4gdGhpcy5lbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoJ3N5bnRoZXRpYy1mb2N1cycpKTtcblxuXHRcdGlmICh0aGlzLm9wdGlvbnMuZmxleGlibGVIZWlnaHQpIHtcblx0XHRcdHRoaXMubWF4SGVpZ2h0ID0gdHlwZW9mIHRoaXMub3B0aW9ucy5mbGV4aWJsZU1heEhlaWdodCA9PT0gJ251bWJlcicgPyB0aGlzLm9wdGlvbnMuZmxleGlibGVNYXhIZWlnaHQgOiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG5cblx0XHRcdHRoaXMubWlycm9yID0gZG9tLmFwcGVuZCh3cmFwcGVyLCAkKCdkaXYubWlycm9yJykpO1xuXHRcdFx0dGhpcy5taXJyb3IuaW5uZXJUZXh0ID0gJ1xcdTAwYTAnO1xuXG5cdFx0XHR0aGlzLnNjcm9sbGFibGVFbGVtZW50ID0gbmV3IFNjcm9sbGFibGVFbGVtZW50KHRoaXMuZWxlbWVudCwgeyB2ZXJ0aWNhbDogU2Nyb2xsYmFyVmlzaWJpbGl0eS5BdXRvIH0pO1xuXG5cdFx0XHRpZiAodGhpcy5vcHRpb25zLmZsZXhpYmxlV2lkdGgpIHtcblx0XHRcdFx0dGhpcy5pbnB1dC5zZXRBdHRyaWJ1dGUoJ3dyYXAnLCAnb2ZmJyk7XG5cdFx0XHRcdHRoaXMubWlycm9yLnN0eWxlLndoaXRlU3BhY2UgPSAncHJlJztcblx0XHRcdFx0dGhpcy5taXJyb3Iuc3R5bGUud29yZFdyYXAgPSAnaW5pdGlhbCc7XG5cdFx0XHR9XG5cblx0XHRcdGRvbS5hcHBlbmQoY29udGFpbmVyLCB0aGlzLnNjcm9sbGFibGVFbGVtZW50LmdldERvbU5vZGUoKSk7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnNjcm9sbGFibGVFbGVtZW50KTtcblxuXHRcdFx0Ly8gZnJvbSBTY3JvbGxhYmxlRWxlbWVudCB0byBET01cblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuc2Nyb2xsYWJsZUVsZW1lbnQub25TY3JvbGwoZSA9PiB0aGlzLmlucHV0LnNjcm9sbFRvcCA9IGUuc2Nyb2xsVG9wKSk7XG5cblx0XHRcdGNvbnN0IG9uU2VsZWN0aW9uQ2hhbmdlID0gdGhpcy5fcmVnaXN0ZXIobmV3IERvbUVtaXR0ZXIoY29udGFpbmVyLm93bmVyRG9jdW1lbnQsICdzZWxlY3Rpb25jaGFuZ2UnKSk7XG5cdFx0XHRjb25zdCBvbkFuY2hvcmVkU2VsZWN0aW9uQ2hhbmdlID0gRXZlbnQuZmlsdGVyKG9uU2VsZWN0aW9uQ2hhbmdlLmV2ZW50LCAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHNlbGVjdGlvbiA9IGNvbnRhaW5lci5vd25lckRvY3VtZW50LmdldFNlbGVjdGlvbigpO1xuXHRcdFx0XHRyZXR1cm4gc2VsZWN0aW9uPy5hbmNob3JOb2RlID09PSB3cmFwcGVyO1xuXHRcdFx0fSk7XG5cblx0XHRcdC8vIGZyb20gRE9NIHRvIFNjcm9sbGFibGVFbGVtZW50XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihvbkFuY2hvcmVkU2VsZWN0aW9uQ2hhbmdlKHRoaXMudXBkYXRlU2Nyb2xsRGltZW5zaW9ucywgdGhpcykpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbkRpZEhlaWdodENoYW5nZSh0aGlzLnVwZGF0ZVNjcm9sbERpbWVuc2lvbnMsIHRoaXMpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5pbnB1dC50eXBlID0gdGhpcy5vcHRpb25zLnR5cGUgfHwgJ3RleHQnO1xuXHRcdFx0dGhpcy5pbnB1dC5zZXRBdHRyaWJ1dGUoJ3dyYXAnLCAnb2ZmJyk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuYXJpYUxhYmVsKSB7XG5cdFx0XHR0aGlzLmlucHV0LnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIHRoaXMuYXJpYUxhYmVsKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5wbGFjZWhvbGRlciAmJiAhdGhpcy5vcHRpb25zLnNob3dQbGFjZWhvbGRlck9uRm9jdXMpIHtcblx0XHRcdHRoaXMuc2V0UGxhY2VIb2xkZXIodGhpcy5wbGFjZWhvbGRlcik7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMudG9vbHRpcCkge1xuXHRcdFx0dGhpcy5zZXRUb29sdGlwKHRoaXMudG9vbHRpcCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5vbmlucHV0KHRoaXMuaW5wdXQsICgpID0+IHRoaXMub25WYWx1ZUNoYW5nZSgpKTtcblx0XHR0aGlzLm9uYmx1cih0aGlzLmlucHV0LCAoKSA9PiB0aGlzLm9uQmx1cigpKTtcblx0XHR0aGlzLm9uZm9jdXModGhpcy5pbnB1dCwgKCkgPT4gdGhpcy5vbkZvY3VzKCkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5pZ25vcmVHZXN0dXJlKHRoaXMuaW5wdXQpKTtcblxuXHRcdHNldFRpbWVvdXQoKCkgPT4gdGhpcy51cGRhdGVNaXJyb3IoKSwgMCk7XG5cblx0XHQvLyBTdXBwb3J0IGFjdGlvbnNcblx0XHRpZiAodGhpcy5vcHRpb25zLmFjdGlvbnMpIHtcblx0XHRcdHRoaXMuYWN0aW9uYmFyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEFjdGlvbkJhcih0aGlzLmVsZW1lbnQpKTtcblx0XHRcdHRoaXMuYWN0aW9uYmFyLnB1c2godGhpcy5vcHRpb25zLmFjdGlvbnMsIHsgaWNvbjogdHJ1ZSwgbGFiZWw6IGZhbHNlIH0pO1xuXHRcdH1cblxuXHRcdHRoaXMuYXBwbHlTdHlsZXMoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvbkJsdXIoKTogdm9pZCB7XG5cdFx0dGhpcy5faGlkZU1lc3NhZ2UoKTtcblx0XHRpZiAodGhpcy5vcHRpb25zLnNob3dQbGFjZWhvbGRlck9uRm9jdXMpIHtcblx0XHRcdHRoaXMuaW5wdXQuc2V0QXR0cmlidXRlKCdwbGFjZWhvbGRlcicsICcnKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgb25Gb2N1cygpOiB2b2lkIHtcblx0XHR0aGlzLl9zaG93TWVzc2FnZSgpO1xuXHRcdGlmICh0aGlzLm9wdGlvbnMuc2hvd1BsYWNlaG9sZGVyT25Gb2N1cykge1xuXHRcdFx0dGhpcy5pbnB1dC5zZXRBdHRyaWJ1dGUoJ3BsYWNlaG9sZGVyJywgdGhpcy5wbGFjZWhvbGRlciB8fCAnJyk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHNldFBsYWNlSG9sZGVyKHBsYWNlSG9sZGVyOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLnBsYWNlaG9sZGVyID0gcGxhY2VIb2xkZXI7XG5cdFx0dGhpcy5pbnB1dC5zZXRBdHRyaWJ1dGUoJ3BsYWNlaG9sZGVyJywgcGxhY2VIb2xkZXIpO1xuXHR9XG5cblx0cHVibGljIHNldFRvb2x0aXAodG9vbHRpcDogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy50b29sdGlwID0gdG9vbHRpcDtcblx0XHRpZiAoIXRoaXMuaG92ZXIudmFsdWUpIHtcblx0XHRcdHRoaXMuaG92ZXIudmFsdWUgPSB0aGlzLl9yZWdpc3RlcihnZXRCYXNlTGF5ZXJIb3ZlckRlbGVnYXRlKCkuc2V0dXBEZWxheWVkSG92ZXJBdE1vdXNlKHRoaXMuaW5wdXQsICgpID0+ICh7XG5cdFx0XHRcdGNvbnRlbnQ6IHRoaXMudG9vbHRpcCxcblx0XHRcdFx0YXBwZWFyYW5jZToge1xuXHRcdFx0XHRcdGNvbXBhY3Q6IHRydWUsXG5cdFx0XHRcdH1cblx0XHRcdH0pKSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHNldEFyaWFMYWJlbChsYWJlbDogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5hcmlhTGFiZWwgPSBsYWJlbDtcblxuXHRcdGlmIChsYWJlbCkge1xuXHRcdFx0dGhpcy5pbnB1dC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCB0aGlzLmFyaWFMYWJlbCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuaW5wdXQucmVtb3ZlQXR0cmlidXRlKCdhcmlhLWxhYmVsJyk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGdldEFyaWFMYWJlbCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLmFyaWFMYWJlbDtcblx0fVxuXG5cdHB1YmxpYyBnZXQgbWlycm9yRWxlbWVudCgpOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMubWlycm9yO1xuXHR9XG5cblx0cHVibGljIGdldCBpbnB1dEVsZW1lbnQoKTogSFRNTElucHV0RWxlbWVudCB7XG5cdFx0cmV0dXJuIHRoaXMuaW5wdXQ7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IHZhbHVlKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuaW5wdXQudmFsdWU7XG5cdH1cblxuXHRwdWJsaWMgc2V0IHZhbHVlKG5ld1ZhbHVlOiBzdHJpbmcpIHtcblx0XHRpZiAodGhpcy5pbnB1dC52YWx1ZSAhPT0gbmV3VmFsdWUpIHtcblx0XHRcdHRoaXMuaW5wdXQudmFsdWUgPSBuZXdWYWx1ZTtcblx0XHRcdHRoaXMub25WYWx1ZUNoYW5nZSgpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBnZXQgc3RlcCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLmlucHV0LnN0ZXA7XG5cdH1cblxuXHRwdWJsaWMgc2V0IHN0ZXAobmV3VmFsdWU6IHN0cmluZykge1xuXHRcdHRoaXMuaW5wdXQuc3RlcCA9IG5ld1ZhbHVlO1xuXHR9XG5cblx0cHVibGljIGdldCBoZWlnaHQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdHlwZW9mIHRoaXMuY2FjaGVkSGVpZ2h0ID09PSAnbnVtYmVyJyA/IHRoaXMuY2FjaGVkSGVpZ2h0IDogZG9tLmdldFRvdGFsSGVpZ2h0KHRoaXMuZWxlbWVudCk7XG5cdH1cblxuXHRwdWJsaWMgZm9jdXMoKTogdm9pZCB7XG5cdFx0dGhpcy5pbnB1dC5mb2N1cygpO1xuXHR9XG5cblx0cHVibGljIGJsdXIoKTogdm9pZCB7XG5cdFx0dGhpcy5pbnB1dC5ibHVyKCk7XG5cdH1cblxuXHRwdWJsaWMgaGFzRm9jdXMoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGRvbS5pc0FjdGl2ZUVsZW1lbnQodGhpcy5pbnB1dCk7XG5cdH1cblxuXHRwdWJsaWMgc2VsZWN0KHJhbmdlOiBJUmFuZ2UgfCBudWxsID0gbnVsbCk6IHZvaWQge1xuXHRcdHRoaXMuaW5wdXQuc2VsZWN0KCk7XG5cblx0XHRpZiAocmFuZ2UpIHtcblx0XHRcdHRoaXMuaW5wdXQuc2V0U2VsZWN0aW9uUmFuZ2UocmFuZ2Uuc3RhcnQsIHJhbmdlLmVuZCk7XG5cdFx0XHRpZiAocmFuZ2UuZW5kID09PSB0aGlzLmlucHV0LnZhbHVlLmxlbmd0aCkge1xuXHRcdFx0XHR0aGlzLmlucHV0LnNjcm9sbExlZnQgPSB0aGlzLmlucHV0LnNjcm9sbFdpZHRoO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBpc1NlbGVjdGlvbkF0RW5kKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmlucHV0LnNlbGVjdGlvbkVuZCA9PT0gdGhpcy5pbnB1dC52YWx1ZS5sZW5ndGggJiYgdGhpcy5pbnB1dC5zZWxlY3Rpb25TdGFydCA9PT0gdGhpcy5pbnB1dC5zZWxlY3Rpb25FbmQ7XG5cdH1cblxuXHRwdWJsaWMgZ2V0U2VsZWN0aW9uKCk6IElSYW5nZSB8IG51bGwge1xuXHRcdGNvbnN0IHNlbGVjdGlvblN0YXJ0ID0gdGhpcy5pbnB1dC5zZWxlY3Rpb25TdGFydDtcblx0XHRpZiAoc2VsZWN0aW9uU3RhcnQgPT09IG51bGwpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRjb25zdCBzZWxlY3Rpb25FbmQgPSB0aGlzLmlucHV0LnNlbGVjdGlvbkVuZCA/PyBzZWxlY3Rpb25TdGFydDtcblx0XHRyZXR1cm4ge1xuXHRcdFx0c3RhcnQ6IHNlbGVjdGlvblN0YXJ0LFxuXHRcdFx0ZW5kOiBzZWxlY3Rpb25FbmQsXG5cdFx0fTtcblx0fVxuXG5cdHB1YmxpYyBlbmFibGUoKTogdm9pZCB7XG5cdFx0dGhpcy5pbnB1dC5yZW1vdmVBdHRyaWJ1dGUoJ2Rpc2FibGVkJyk7XG5cdH1cblxuXHRwdWJsaWMgZGlzYWJsZSgpOiB2b2lkIHtcblx0XHR0aGlzLmJsdXIoKTtcblx0XHR0aGlzLmlucHV0LmRpc2FibGVkID0gdHJ1ZTtcblx0XHR0aGlzLl9oaWRlTWVzc2FnZSgpO1xuXHR9XG5cblx0cHVibGljIHNldEVuYWJsZWQoZW5hYmxlZDogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmIChlbmFibGVkKSB7XG5cdFx0XHR0aGlzLmVuYWJsZSgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmRpc2FibGUoKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgZ2V0IHdpZHRoKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIGRvbS5nZXRUb3RhbFdpZHRoKHRoaXMuaW5wdXQpO1xuXHR9XG5cblx0cHVibGljIHNldCB3aWR0aCh3aWR0aDogbnVtYmVyKSB7XG5cdFx0aWYgKHRoaXMub3B0aW9ucy5mbGV4aWJsZUhlaWdodCAmJiB0aGlzLm9wdGlvbnMuZmxleGlibGVXaWR0aCkge1xuXHRcdFx0Ly8gdGV4dGFyZWEgd2l0aCBob3Jpem9udGFsIHNjcm9sbGluZ1xuXHRcdFx0bGV0IGhvcml6b250YWxQYWRkaW5nID0gMDtcblx0XHRcdGlmICh0aGlzLm1pcnJvcikge1xuXHRcdFx0XHRjb25zdCBwYWRkaW5nTGVmdCA9IHBhcnNlRmxvYXQodGhpcy5taXJyb3Iuc3R5bGUucGFkZGluZ0xlZnQgfHwgJycpIHx8IDA7XG5cdFx0XHRcdGNvbnN0IHBhZGRpbmdSaWdodCA9IHBhcnNlRmxvYXQodGhpcy5taXJyb3Iuc3R5bGUucGFkZGluZ1JpZ2h0IHx8ICcnKSB8fCAwO1xuXHRcdFx0XHRob3Jpem9udGFsUGFkZGluZyA9IHBhZGRpbmdMZWZ0ICsgcGFkZGluZ1JpZ2h0O1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5pbnB1dC5zdHlsZS53aWR0aCA9ICh3aWR0aCAtIGhvcml6b250YWxQYWRkaW5nKSArICdweCc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuaW5wdXQuc3R5bGUud2lkdGggPSB3aWR0aCArICdweCc7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMubWlycm9yKSB7XG5cdFx0XHR0aGlzLm1pcnJvci5zdHlsZS53aWR0aCA9IHdpZHRoICsgJ3B4Jztcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgc2V0IHBhZGRpbmdSaWdodChwYWRkaW5nUmlnaHQ6IG51bWJlcikge1xuXHRcdC8vIFNldCB3aWR0aCB0byBhdm9pZCBoaW50IHRleHQgb3ZlcmxhcHBpbmcgYnV0dG9uc1xuXHRcdHRoaXMuaW5wdXQuc3R5bGUud2lkdGggPSBgY2FsYygxMDAlIC0gJHtwYWRkaW5nUmlnaHR9cHgpYDtcblxuXHRcdGlmICh0aGlzLm1pcnJvcikge1xuXHRcdFx0dGhpcy5taXJyb3Iuc3R5bGUucGFkZGluZ1JpZ2h0ID0gcGFkZGluZ1JpZ2h0ICsgJ3B4Jztcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVNjcm9sbERpbWVuc2lvbnMoKTogdm9pZCB7XG5cdFx0aWYgKHR5cGVvZiB0aGlzLmNhY2hlZENvbnRlbnRIZWlnaHQgIT09ICdudW1iZXInIHx8IHR5cGVvZiB0aGlzLmNhY2hlZEhlaWdodCAhPT0gJ251bWJlcicgfHwgIXRoaXMuc2Nyb2xsYWJsZUVsZW1lbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBzY3JvbGxIZWlnaHQgPSB0aGlzLmNhY2hlZENvbnRlbnRIZWlnaHQ7XG5cdFx0Y29uc3QgaGVpZ2h0ID0gdGhpcy5jYWNoZWRIZWlnaHQ7XG5cdFx0Y29uc3Qgc2Nyb2xsVG9wID0gdGhpcy5pbnB1dC5zY3JvbGxUb3A7XG5cblx0XHR0aGlzLnNjcm9sbGFibGVFbGVtZW50LnNldFNjcm9sbERpbWVuc2lvbnMoeyBzY3JvbGxIZWlnaHQsIGhlaWdodCB9KTtcblx0XHR0aGlzLnNjcm9sbGFibGVFbGVtZW50LnNldFNjcm9sbFBvc2l0aW9uKHsgc2Nyb2xsVG9wIH0pO1xuXHR9XG5cblx0cHVibGljIHNob3dNZXNzYWdlKG1lc3NhZ2U6IElNZXNzYWdlLCBmb3JjZT86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAodGhpcy5zdGF0ZSA9PT0gJ29wZW4nICYmIGVxdWFscyh0aGlzLm1lc3NhZ2UsIG1lc3NhZ2UpKSB7XG5cdFx0XHQvLyBBbHJlYWR5IHNob3dpbmdcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xuXG5cdFx0dGhpcy5lbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoJ2lkbGUnKTtcblx0XHR0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnaW5mbycpO1xuXHRcdHRoaXMuZWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCd3YXJuaW5nJyk7XG5cdFx0dGhpcy5lbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoJ2Vycm9yJyk7XG5cdFx0dGhpcy5lbGVtZW50LmNsYXNzTGlzdC5hZGQodGhpcy5jbGFzc0ZvclR5cGUobWVzc2FnZS50eXBlKSk7XG5cblx0XHRjb25zdCBzdHlsZXMgPSB0aGlzLnN0eWxlc0ZvclR5cGUodGhpcy5tZXNzYWdlLnR5cGUpO1xuXHRcdHRoaXMuZWxlbWVudC5zdHlsZS5ib3JkZXIgPSBgMXB4IHNvbGlkICR7Y3NzSnMuYXNDc3NWYWx1ZVdpdGhEZWZhdWx0KHN0eWxlcy5ib3JkZXIsICd0cmFuc3BhcmVudCcpfWA7XG5cblx0XHRpZiAodGhpcy5tZXNzYWdlLmNvbnRlbnQgJiYgKHRoaXMuaGFzRm9jdXMoKSB8fCBmb3JjZSkpIHtcblx0XHRcdHRoaXMuX3Nob3dNZXNzYWdlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGhpZGVNZXNzYWdlKCk6IHZvaWQge1xuXHRcdHRoaXMubWVzc2FnZSA9IG51bGw7XG5cblx0XHR0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnaW5mbycpO1xuXHRcdHRoaXMuZWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCd3YXJuaW5nJyk7XG5cdFx0dGhpcy5lbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoJ2Vycm9yJyk7XG5cdFx0dGhpcy5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2lkbGUnKTtcblxuXHRcdHRoaXMuX2hpZGVNZXNzYWdlKCk7XG5cdFx0dGhpcy5hcHBseVN0eWxlcygpO1xuXHR9XG5cblx0cHVibGljIGlzSW5wdXRWYWxpZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISF0aGlzLnZhbGlkYXRpb24gJiYgIXRoaXMudmFsaWRhdGlvbih0aGlzLnZhbHVlKTtcblx0fVxuXG5cdHB1YmxpYyB2YWxpZGF0ZSgpOiBNZXNzYWdlVHlwZSB8IHVuZGVmaW5lZCB7XG5cdFx0bGV0IGVycm9yTXNnOiBJTWVzc2FnZSB8IG51bGwgPSBudWxsO1xuXG5cdFx0aWYgKHRoaXMudmFsaWRhdGlvbikge1xuXHRcdFx0ZXJyb3JNc2cgPSB0aGlzLnZhbGlkYXRpb24odGhpcy52YWx1ZSk7XG5cblx0XHRcdGlmIChlcnJvck1zZykge1xuXHRcdFx0XHR0aGlzLmlucHV0RWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2FyaWEtaW52YWxpZCcsICd0cnVlJyk7XG5cdFx0XHRcdHRoaXMuc2hvd01lc3NhZ2UoZXJyb3JNc2cpO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSBpZiAodGhpcy5pbnB1dEVsZW1lbnQuaGFzQXR0cmlidXRlKCdhcmlhLWludmFsaWQnKSkge1xuXHRcdFx0XHR0aGlzLmlucHV0RWxlbWVudC5yZW1vdmVBdHRyaWJ1dGUoJ2FyaWEtaW52YWxpZCcpO1xuXHRcdFx0XHR0aGlzLmhpZGVNZXNzYWdlKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGVycm9yTXNnPy50eXBlO1xuXHR9XG5cblx0cHVibGljIHN0eWxlc0ZvclR5cGUodHlwZTogTWVzc2FnZVR5cGUgfCB1bmRlZmluZWQpOiB7IGJvcmRlcjogc3RyaW5nIHwgdW5kZWZpbmVkOyBiYWNrZ3JvdW5kOiBzdHJpbmcgfCB1bmRlZmluZWQ7IGZvcmVncm91bmQ6IHN0cmluZyB8IHVuZGVmaW5lZCB9IHtcblx0XHRjb25zdCBzdHlsZXMgPSB0aGlzLm9wdGlvbnMuaW5wdXRCb3hTdHlsZXM7XG5cdFx0c3dpdGNoICh0eXBlKSB7XG5cdFx0XHRjYXNlIE1lc3NhZ2VUeXBlLklORk86IHJldHVybiB7IGJvcmRlcjogc3R5bGVzLmlucHV0VmFsaWRhdGlvbkluZm9Cb3JkZXIsIGJhY2tncm91bmQ6IHN0eWxlcy5pbnB1dFZhbGlkYXRpb25JbmZvQmFja2dyb3VuZCwgZm9yZWdyb3VuZDogc3R5bGVzLmlucHV0VmFsaWRhdGlvbkluZm9Gb3JlZ3JvdW5kIH07XG5cdFx0XHRjYXNlIE1lc3NhZ2VUeXBlLldBUk5JTkc6IHJldHVybiB7IGJvcmRlcjogc3R5bGVzLmlucHV0VmFsaWRhdGlvbldhcm5pbmdCb3JkZXIsIGJhY2tncm91bmQ6IHN0eWxlcy5pbnB1dFZhbGlkYXRpb25XYXJuaW5nQmFja2dyb3VuZCwgZm9yZWdyb3VuZDogc3R5bGVzLmlucHV0VmFsaWRhdGlvbldhcm5pbmdGb3JlZ3JvdW5kIH07XG5cdFx0XHRkZWZhdWx0OiByZXR1cm4geyBib3JkZXI6IHN0eWxlcy5pbnB1dFZhbGlkYXRpb25FcnJvckJvcmRlciwgYmFja2dyb3VuZDogc3R5bGVzLmlucHV0VmFsaWRhdGlvbkVycm9yQmFja2dyb3VuZCwgZm9yZWdyb3VuZDogc3R5bGVzLmlucHV0VmFsaWRhdGlvbkVycm9yRm9yZWdyb3VuZCB9O1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgY2xhc3NGb3JUeXBlKHR5cGU6IE1lc3NhZ2VUeXBlIHwgdW5kZWZpbmVkKTogc3RyaW5nIHtcblx0XHRzd2l0Y2ggKHR5cGUpIHtcblx0XHRcdGNhc2UgTWVzc2FnZVR5cGUuSU5GTzogcmV0dXJuICdpbmZvJztcblx0XHRcdGNhc2UgTWVzc2FnZVR5cGUuV0FSTklORzogcmV0dXJuICd3YXJuaW5nJztcblx0XHRcdGRlZmF1bHQ6IHJldHVybiAnZXJyb3InO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3Nob3dNZXNzYWdlKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5jb250ZXh0Vmlld1Byb3ZpZGVyIHx8ICF0aGlzLm1lc3NhZ2UpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRsZXQgZGl2OiBIVE1MRWxlbWVudDtcblx0XHRjb25zdCBsYXlvdXQgPSAoKSA9PiBkaXYuc3R5bGUud2lkdGggPSBkb20uZ2V0VG90YWxXaWR0aCh0aGlzLmVsZW1lbnQpICsgJ3B4JztcblxuXHRcdHRoaXMuY29udGV4dFZpZXdQcm92aWRlci5zaG93Q29udGV4dFZpZXcoe1xuXHRcdFx0Z2V0QW5jaG9yOiAoKSA9PiB0aGlzLmVsZW1lbnQsXG5cdFx0XHRhbmNob3JBbGlnbm1lbnQ6IEFuY2hvckFsaWdubWVudC5SSUdIVCxcblx0XHRcdHJlbmRlcjogKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpID0+IHtcblx0XHRcdFx0aWYgKCF0aGlzLm1lc3NhZ2UpIHtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGRpdiA9IGRvbS5hcHBlbmQoY29udGFpbmVyLCAkKCcubW9uYWNvLWlucHV0Ym94LWNvbnRhaW5lcicpKTtcblx0XHRcdFx0bGF5b3V0KCk7XG5cblx0XHRcdFx0Y29uc3QgcmVuZGVyT3B0aW9uczogTWFya2Rvd25SZW5kZXJPcHRpb25zID0ge1xuXHRcdFx0XHRcdGlubGluZTogdHJ1ZSxcblx0XHRcdFx0XHRjbGFzc05hbWU6ICdtb25hY28taW5wdXRib3gtbWVzc2FnZSdcblx0XHRcdFx0fTtcblxuXHRcdFx0XHRjb25zdCBzcGFuRWxlbWVudCA9ICh0aGlzLm1lc3NhZ2UuZm9ybWF0Q29udGVudFxuXHRcdFx0XHRcdD8gcmVuZGVyRm9ybWF0dGVkVGV4dCh0aGlzLm1lc3NhZ2UuY29udGVudCEsIHJlbmRlck9wdGlvbnMpXG5cdFx0XHRcdFx0OiByZW5kZXJUZXh0KHRoaXMubWVzc2FnZS5jb250ZW50ISwgcmVuZGVyT3B0aW9ucykpO1xuXHRcdFx0XHRzcGFuRWxlbWVudC5jbGFzc0xpc3QuYWRkKHRoaXMuY2xhc3NGb3JUeXBlKHRoaXMubWVzc2FnZS50eXBlKSk7XG5cblx0XHRcdFx0Y29uc3Qgc3R5bGVzID0gdGhpcy5zdHlsZXNGb3JUeXBlKHRoaXMubWVzc2FnZS50eXBlKTtcblx0XHRcdFx0c3BhbkVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gc3R5bGVzLmJhY2tncm91bmQgPz8gJyc7XG5cdFx0XHRcdHNwYW5FbGVtZW50LnN0eWxlLmNvbG9yID0gc3R5bGVzLmZvcmVncm91bmQgPz8gJyc7XG5cdFx0XHRcdHNwYW5FbGVtZW50LnN0eWxlLmJvcmRlciA9IHN0eWxlcy5ib3JkZXIgPyBgMXB4IHNvbGlkICR7c3R5bGVzLmJvcmRlcn1gIDogJyc7XG5cblx0XHRcdFx0ZG9tLmFwcGVuZChkaXYsIHNwYW5FbGVtZW50KTtcblxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH0sXG5cdFx0XHRvbkhpZGU6ICgpID0+IHtcblx0XHRcdFx0dGhpcy5zdGF0ZSA9ICdjbG9zZWQnO1xuXHRcdFx0fSxcblx0XHRcdGxheW91dDogbGF5b3V0XG5cdFx0fSk7XG5cblx0XHQvLyBBUklBIFN1cHBvcnRcblx0XHRsZXQgYWxlcnRUZXh0OiBzdHJpbmc7XG5cdFx0aWYgKHRoaXMubWVzc2FnZS50eXBlID09PSBNZXNzYWdlVHlwZS5FUlJPUikge1xuXHRcdFx0YWxlcnRUZXh0ID0gbmxzLmxvY2FsaXplKCdhbGVydEVycm9yTWVzc2FnZScsIFwiRXJyb3I6IHswfVwiLCB0aGlzLm1lc3NhZ2UuY29udGVudCk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLm1lc3NhZ2UudHlwZSA9PT0gTWVzc2FnZVR5cGUuV0FSTklORykge1xuXHRcdFx0YWxlcnRUZXh0ID0gbmxzLmxvY2FsaXplKCdhbGVydFdhcm5pbmdNZXNzYWdlJywgXCJXYXJuaW5nOiB7MH1cIiwgdGhpcy5tZXNzYWdlLmNvbnRlbnQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhbGVydFRleHQgPSBubHMubG9jYWxpemUoJ2FsZXJ0SW5mb01lc3NhZ2UnLCBcIkluZm86IHswfVwiLCB0aGlzLm1lc3NhZ2UuY29udGVudCk7XG5cdFx0fVxuXG5cdFx0YXJpYS5hbGVydChhbGVydFRleHQpO1xuXG5cdFx0dGhpcy5zdGF0ZSA9ICdvcGVuJztcblx0fVxuXG5cdHByaXZhdGUgX2hpZGVNZXNzYWdlKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5jb250ZXh0Vmlld1Byb3ZpZGVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuc3RhdGUgPT09ICdvcGVuJykge1xuXHRcdFx0dGhpcy5jb250ZXh0Vmlld1Byb3ZpZGVyLmhpZGVDb250ZXh0VmlldygpO1xuXHRcdH1cblxuXHRcdHRoaXMuc3RhdGUgPSAnaWRsZSc7XG5cdH1cblxuXHRwcml2YXRlIG9uVmFsdWVDaGFuZ2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSh0aGlzLnZhbHVlKTtcblxuXHRcdHRoaXMudmFsaWRhdGUoKTtcblx0XHR0aGlzLnVwZGF0ZU1pcnJvcigpO1xuXHRcdHRoaXMuaW5wdXQuY2xhc3NMaXN0LnRvZ2dsZSgnZW1wdHknLCAhdGhpcy52YWx1ZSk7XG5cblx0XHRpZiAodGhpcy5zdGF0ZSA9PT0gJ29wZW4nICYmIHRoaXMuY29udGV4dFZpZXdQcm92aWRlcikge1xuXHRcdFx0dGhpcy5jb250ZXh0Vmlld1Byb3ZpZGVyLmxheW91dCgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlTWlycm9yKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5taXJyb3IpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB2YWx1ZSA9IHRoaXMudmFsdWU7XG5cdFx0Y29uc3QgbGFzdENoYXJDb2RlID0gdmFsdWUuY2hhckNvZGVBdCh2YWx1ZS5sZW5ndGggLSAxKTtcblx0XHRjb25zdCBzdWZmaXggPSBsYXN0Q2hhckNvZGUgPT09IDEwID8gJyAnIDogJyc7XG5cdFx0Y29uc3QgbWlycm9yVGV4dENvbnRlbnQgPSAodmFsdWUgKyBzdWZmaXgpXG5cdFx0XHQucmVwbGFjZSgvXFx1MDAwYy9nLCAnJyk7IC8vIERvbid0IG1lYXN1cmUgd2l0aCB0aGUgZm9ybSBmZWVkIGNoYXJhY3Rlciwgd2hpY2ggbWVzc2VzIHVwIHNpemluZ1xuXG5cdFx0aWYgKG1pcnJvclRleHRDb250ZW50KSB7XG5cdFx0XHR0aGlzLm1pcnJvci50ZXh0Q29udGVudCA9IHZhbHVlICsgc3VmZml4O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLm1pcnJvci5pbm5lclRleHQgPSAnXFx1MDBhMCc7XG5cdFx0fVxuXG5cdFx0dGhpcy5sYXlvdXQoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBhcHBseVN0eWxlcygpOiB2b2lkIHtcblx0XHRjb25zdCBzdHlsZXMgPSB0aGlzLm9wdGlvbnMuaW5wdXRCb3hTdHlsZXM7XG5cblx0XHRjb25zdCBiYWNrZ3JvdW5kID0gc3R5bGVzLmlucHV0QmFja2dyb3VuZCA/PyAnJztcblx0XHRjb25zdCBmb3JlZ3JvdW5kID0gc3R5bGVzLmlucHV0Rm9yZWdyb3VuZCA/PyAnJztcblx0XHRjb25zdCBib3JkZXIgPSBzdHlsZXMuaW5wdXRCb3JkZXIgPz8gJyc7XG5cblx0XHR0aGlzLmVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gYmFja2dyb3VuZDtcblx0XHR0aGlzLmVsZW1lbnQuc3R5bGUuY29sb3IgPSBmb3JlZ3JvdW5kO1xuXHRcdHRoaXMuaW5wdXQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJ2luaGVyaXQnO1xuXHRcdHRoaXMuaW5wdXQuc3R5bGUuY29sb3IgPSBmb3JlZ3JvdW5kO1xuXG5cdFx0Ly8gdGhlcmUncyBhbHdheXMgYSBib3JkZXIsIGV2ZW4gaWYgdGhlIGNvbG9yIGlzIG5vdCBzZXQuXG5cdFx0dGhpcy5lbGVtZW50LnN0eWxlLmJvcmRlciA9IGAxcHggc29saWQgJHtjc3NKcy5hc0Nzc1ZhbHVlV2l0aERlZmF1bHQoYm9yZGVyLCAndHJhbnNwYXJlbnQnKX1gO1xuXHR9XG5cblx0cHVibGljIGxheW91dCgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMubWlycm9yKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcHJldmlvdXNIZWlnaHQgPSB0aGlzLmNhY2hlZENvbnRlbnRIZWlnaHQ7XG5cdFx0dGhpcy5jYWNoZWRDb250ZW50SGVpZ2h0ID0gZG9tLmdldFRvdGFsSGVpZ2h0KHRoaXMubWlycm9yKTtcblxuXHRcdGlmIChwcmV2aW91c0hlaWdodCAhPT0gdGhpcy5jYWNoZWRDb250ZW50SGVpZ2h0KSB7XG5cdFx0XHR0aGlzLmNhY2hlZEhlaWdodCA9IE1hdGgubWluKHRoaXMuY2FjaGVkQ29udGVudEhlaWdodCwgdGhpcy5tYXhIZWlnaHQpO1xuXHRcdFx0dGhpcy5pbnB1dC5zdHlsZS5oZWlnaHQgPSB0aGlzLmNhY2hlZEhlaWdodCArICdweCc7XG5cdFx0XHR0aGlzLl9vbkRpZEhlaWdodENoYW5nZS5maXJlKHRoaXMuY2FjaGVkQ29udGVudEhlaWdodCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGluc2VydEF0Q3Vyc29yKHRleHQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IGlucHV0RWxlbWVudCA9IHRoaXMuaW5wdXRFbGVtZW50O1xuXHRcdGNvbnN0IHN0YXJ0ID0gaW5wdXRFbGVtZW50LnNlbGVjdGlvblN0YXJ0O1xuXHRcdGNvbnN0IGVuZCA9IGlucHV0RWxlbWVudC5zZWxlY3Rpb25FbmQ7XG5cdFx0Y29uc3QgY29udGVudCA9IGlucHV0RWxlbWVudC52YWx1ZTtcblxuXHRcdGlmIChzdGFydCAhPT0gbnVsbCAmJiBlbmQgIT09IG51bGwpIHtcblx0XHRcdHRoaXMudmFsdWUgPSBjb250ZW50LnN1YnN0cigwLCBzdGFydCkgKyB0ZXh0ICsgY29udGVudC5zdWJzdHIoZW5kKTtcblx0XHRcdGlucHV0RWxlbWVudC5zZXRTZWxlY3Rpb25SYW5nZShzdGFydCArIDEsIHN0YXJ0ICsgMSk7XG5cdFx0XHR0aGlzLmxheW91dCgpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX2hpZGVNZXNzYWdlKCk7XG5cblx0XHR0aGlzLm1lc3NhZ2UgPSBudWxsO1xuXG5cdFx0dGhpcy5hY3Rpb25iYXI/LmRpc3Bvc2UoKTtcblxuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElIaXN0b3J5SW5wdXRPcHRpb25zIGV4dGVuZHMgSUlucHV0T3B0aW9ucyB7XG5cdHJlYWRvbmx5IHNob3dIaXN0b3J5SGludD86ICgpID0+IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBIaXN0b3J5SW5wdXRCb3ggZXh0ZW5kcyBJbnB1dEJveCBpbXBsZW1lbnRzIElIaXN0b3J5TmF2aWdhdGlvbldpZGdldCB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBoaXN0b3J5OiBIaXN0b3J5TmF2aWdhdG9yPHN0cmluZz47XG5cdHByaXZhdGUgb2JzZXJ2ZXI6IE11dGF0aW9uT2JzZXJ2ZXIgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRGb2N1cyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZEZvY3VzID0gdGhpcy5fb25EaWRGb2N1cy5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEJsdXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRCbHVyID0gdGhpcy5fb25EaWRCbHVyLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIGNvbnRleHRWaWV3UHJvdmlkZXI6IElDb250ZXh0Vmlld1Byb3ZpZGVyIHwgdW5kZWZpbmVkLCBvcHRpb25zOiBJSGlzdG9yeUlucHV0T3B0aW9ucykge1xuXHRcdGNvbnN0IE5MU19QTEFDRUhPTERFUl9ISVNUT1JZX0hJTlRfU1VGRklYX05PX1BBUkVOUyA9IG5scy5sb2NhbGl6ZSh7XG5cdFx0XHRrZXk6ICdoaXN0b3J5LmlucHV0Ym94LmhpbnQuc3VmZml4Lm5vcGFyZW5zJyxcblx0XHRcdGNvbW1lbnQ6IFsnVGV4dCBpcyB0aGUgc3VmZml4IG9mIGFuIGlucHV0IGZpZWxkIHBsYWNlaG9sZGVyIGNvbWluZyBhZnRlciB0aGUgYWN0aW9uIHRoZSBpbnB1dCBmaWVsZCBwZXJmb3JtcywgdGhpcyB3aWxsIGJlIHVzZWQgd2hlbiB0aGUgaW5wdXQgZmllbGQgZW5kcyBpbiBhIGNsb3NpbmcgcGFyZW50aGVzaXMgXCIpXCIsIGZvciBleGFtcGxlIFwiRmlsdGVyIChlLmcuIHRleHQsICFleGNsdWRlKVwiLiBUaGUgY2hhcmFjdGVyIGluc2VydGVkIGludG8gdGhlIGZpbmFsIHN0cmluZyBpcyBcXHUyMUM1IHRvIHJlcHJlc2VudCB0aGUgdXAgYW5kIGRvd24gYXJyb3cga2V5cy4nXVxuXHRcdH0sICcgb3IgezB9IGZvciBoaXN0b3J5JywgYFxcdTIxQzVgKTtcblx0XHRjb25zdCBOTFNfUExBQ0VIT0xERVJfSElTVE9SWV9ISU5UX1NVRkZJWF9JTl9QQVJFTlMgPSBubHMubG9jYWxpemUoe1xuXHRcdFx0a2V5OiAnaGlzdG9yeS5pbnB1dGJveC5oaW50LnN1ZmZpeC5pbnBhcmVucycsXG5cdFx0XHRjb21tZW50OiBbJ1RleHQgaXMgdGhlIHN1ZmZpeCBvZiBhbiBpbnB1dCBmaWVsZCBwbGFjZWhvbGRlciBjb21pbmcgYWZ0ZXIgdGhlIGFjdGlvbiB0aGUgaW5wdXQgZmllbGQgcGVyZm9ybXMsIHRoaXMgd2lsbCBiZSB1c2VkIHdoZW4gdGhlIGlucHV0IGZpZWxkIGRvZXMgTk9UIGVuZCBpbiBhIGNsb3NpbmcgcGFyZW50aGVzaXMgKGVnLiBcIkZpbmRcIikuIFRoZSBjaGFyYWN0ZXIgaW5zZXJ0ZWQgaW50byB0aGUgZmluYWwgc3RyaW5nIGlzIFxcdTIxQzUgdG8gcmVwcmVzZW50IHRoZSB1cCBhbmQgZG93biBhcnJvdyBrZXlzLiddXG5cdFx0fSwgJyAoezB9IGZvciBoaXN0b3J5KScsIGBcXHUyMUM1YCk7XG5cblx0XHRzdXBlcihjb250YWluZXIsIGNvbnRleHRWaWV3UHJvdmlkZXIsIG9wdGlvbnMpO1xuXHRcdHRoaXMuaGlzdG9yeSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBIaXN0b3J5TmF2aWdhdG9yPHN0cmluZz4ob3B0aW9ucy5oaXN0b3J5LCAxMDApKTtcblxuXHRcdC8vIEZ1bmN0aW9uIHRvIGFwcGVuZCB0aGUgaGlzdG9yeSBzdWZmaXggdG8gdGhlIHBsYWNlaG9sZGVyIGlmIG5lY2Vzc2FyeVxuXHRcdGNvbnN0IGFkZFN1ZmZpeCA9ICgpID0+IHtcblx0XHRcdGlmIChvcHRpb25zLnNob3dIaXN0b3J5SGludCAmJiBvcHRpb25zLnNob3dIaXN0b3J5SGludCgpICYmICF0aGlzLnBsYWNlaG9sZGVyLmVuZHNXaXRoKE5MU19QTEFDRUhPTERFUl9ISVNUT1JZX0hJTlRfU1VGRklYX05PX1BBUkVOUykgJiYgIXRoaXMucGxhY2Vob2xkZXIuZW5kc1dpdGgoTkxTX1BMQUNFSE9MREVSX0hJU1RPUllfSElOVF9TVUZGSVhfSU5fUEFSRU5TKSAmJiB0aGlzLmhpc3RvcnkuZ2V0SGlzdG9yeSgpLmxlbmd0aCkge1xuXHRcdFx0XHRjb25zdCBzdWZmaXggPSB0aGlzLnBsYWNlaG9sZGVyLmVuZHNXaXRoKCcpJykgPyBOTFNfUExBQ0VIT0xERVJfSElTVE9SWV9ISU5UX1NVRkZJWF9OT19QQVJFTlMgOiBOTFNfUExBQ0VIT0xERVJfSElTVE9SWV9ISU5UX1NVRkZJWF9JTl9QQVJFTlM7XG5cdFx0XHRcdGNvbnN0IHN1ZmZpeGVkUGxhY2Vob2xkZXIgPSB0aGlzLnBsYWNlaG9sZGVyICsgc3VmZml4O1xuXHRcdFx0XHRpZiAob3B0aW9ucy5zaG93UGxhY2Vob2xkZXJPbkZvY3VzICYmICFkb20uaXNBY3RpdmVFbGVtZW50KHRoaXMuaW5wdXQpKSB7XG5cdFx0XHRcdFx0dGhpcy5wbGFjZWhvbGRlciA9IHN1ZmZpeGVkUGxhY2Vob2xkZXI7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5zZXRQbGFjZUhvbGRlcihzdWZmaXhlZFBsYWNlaG9sZGVyKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHQvLyBTcG90IHRoZSBjaGFuZ2UgdG8gdGhlIHRleHRhcmVhIGNsYXNzIGF0dHJpYnV0ZSB3aGljaCBvY2N1cnMgd2hlbiBpdCBjaGFuZ2VzIGJldHdlZW4gbm9uLWVtcHR5IGFuZCBlbXB0eSxcblx0XHQvLyBhbmQgYWRkIHRoZSBoaXN0b3J5IHN1ZmZpeCB0byB0aGUgcGxhY2Vob2xkZXIgaWYgbm90IHlldCBwcmVzZW50XG5cdFx0dGhpcy5vYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKChtdXRhdGlvbkxpc3Q6IE11dGF0aW9uUmVjb3JkW10sIG9ic2VydmVyOiBNdXRhdGlvbk9ic2VydmVyKSA9PiB7XG5cdFx0XHRtdXRhdGlvbkxpc3QuZm9yRWFjaCgobXV0YXRpb246IE11dGF0aW9uUmVjb3JkKSA9PiB7XG5cdFx0XHRcdGlmICghbXV0YXRpb24udGFyZ2V0LnRleHRDb250ZW50KSB7XG5cdFx0XHRcdFx0YWRkU3VmZml4KCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0pO1xuXHRcdHRoaXMub2JzZXJ2ZXIub2JzZXJ2ZSh0aGlzLmlucHV0LCB7IGF0dHJpYnV0ZUZpbHRlcjogWydjbGFzcyddIH0pO1xuXG5cdFx0dGhpcy5vbmZvY3VzKHRoaXMuaW5wdXQsICgpID0+IGFkZFN1ZmZpeCgpKTtcblx0XHR0aGlzLm9uYmx1cih0aGlzLmlucHV0LCAoKSA9PiB7XG5cdFx0XHRjb25zdCByZXNldFBsYWNlaG9sZGVyID0gKGhpc3RvcnlIaW50OiBzdHJpbmcpID0+IHtcblx0XHRcdFx0aWYgKCF0aGlzLnBsYWNlaG9sZGVyLmVuZHNXaXRoKGhpc3RvcnlIaW50KSkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRjb25zdCByZXZlcnRlZFBsYWNlaG9sZGVyID0gdGhpcy5wbGFjZWhvbGRlci5zbGljZSgwLCB0aGlzLnBsYWNlaG9sZGVyLmxlbmd0aCAtIGhpc3RvcnlIaW50Lmxlbmd0aCk7XG5cdFx0XHRcdFx0aWYgKG9wdGlvbnMuc2hvd1BsYWNlaG9sZGVyT25Gb2N1cykge1xuXHRcdFx0XHRcdFx0dGhpcy5wbGFjZWhvbGRlciA9IHJldmVydGVkUGxhY2Vob2xkZXI7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdFx0dGhpcy5zZXRQbGFjZUhvbGRlcihyZXZlcnRlZFBsYWNlaG9sZGVyKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHRpZiAoIXJlc2V0UGxhY2Vob2xkZXIoTkxTX1BMQUNFSE9MREVSX0hJU1RPUllfSElOVF9TVUZGSVhfSU5fUEFSRU5TKSkge1xuXHRcdFx0XHRyZXNldFBsYWNlaG9sZGVyKE5MU19QTEFDRUhPTERFUl9ISVNUT1JZX0hJTlRfU1VGRklYX05PX1BBUkVOUyk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCkge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0XHRpZiAodGhpcy5vYnNlcnZlcikge1xuXHRcdFx0dGhpcy5vYnNlcnZlci5kaXNjb25uZWN0KCk7XG5cdFx0XHR0aGlzLm9ic2VydmVyID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBhZGRUb0hpc3RvcnkoYWx3YXlzPzogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICh0aGlzLnZhbHVlICYmIChhbHdheXMgfHwgdGhpcy52YWx1ZSAhPT0gdGhpcy5nZXRDdXJyZW50VmFsdWUoKSkpIHtcblx0XHRcdHRoaXMuaGlzdG9yeS5hZGQodGhpcy52YWx1ZSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHByZXBlbmRIaXN0b3J5KHJlc3RvcmVkSGlzdG9yeTogc3RyaW5nW10pOiB2b2lkIHtcblx0XHRjb25zdCBuZXdIaXN0b3J5ID0gdGhpcy5nZXRIaXN0b3J5KCk7XG5cdFx0dGhpcy5jbGVhckhpc3RvcnkoKTtcblxuXHRcdHJlc3RvcmVkSGlzdG9yeS5mb3JFYWNoKChpdGVtKSA9PiB7XG5cdFx0XHR0aGlzLmhpc3RvcnkuYWRkKGl0ZW0pO1xuXHRcdH0pO1xuXG5cdFx0bmV3SGlzdG9yeS5mb3JFYWNoKGl0ZW0gPT4ge1xuXHRcdFx0dGhpcy5oaXN0b3J5LmFkZChpdGVtKTtcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBnZXRIaXN0b3J5KCk6IHN0cmluZ1tdIHtcblx0XHRyZXR1cm4gdGhpcy5oaXN0b3J5LmdldEhpc3RvcnkoKTtcblx0fVxuXG5cdHB1YmxpYyBpc0F0Rmlyc3RJbkhpc3RvcnkoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuaGlzdG9yeS5pc0ZpcnN0KCk7XG5cdH1cblxuXHRwdWJsaWMgaXNBdExhc3RJbkhpc3RvcnkoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuaGlzdG9yeS5pc0xhc3QoKTtcblx0fVxuXG5cdHB1YmxpYyBpc05vd2hlcmVJbkhpc3RvcnkoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuaGlzdG9yeS5pc05vd2hlcmUoKTtcblx0fVxuXG5cdHB1YmxpYyBzaG93TmV4dFZhbHVlKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5oaXN0b3J5Lmhhcyh0aGlzLnZhbHVlKSkge1xuXHRcdFx0dGhpcy5hZGRUb0hpc3RvcnkoKTtcblx0XHR9XG5cblx0XHRsZXQgbmV4dCA9IHRoaXMuZ2V0TmV4dFZhbHVlKCk7XG5cdFx0aWYgKG5leHQpIHtcblx0XHRcdG5leHQgPSBuZXh0ID09PSB0aGlzLnZhbHVlID8gdGhpcy5nZXROZXh0VmFsdWUoKSA6IG5leHQ7XG5cdFx0fVxuXG5cdFx0dGhpcy52YWx1ZSA9IG5leHQgPz8gJyc7XG5cdFx0YXJpYS5zdGF0dXModGhpcy52YWx1ZSA/IHRoaXMudmFsdWUgOiBubHMubG9jYWxpemUoJ2NsZWFyZWRJbnB1dCcsIFwiQ2xlYXJlZCBJbnB1dFwiKSk7XG5cdH1cblxuXHRwdWJsaWMgc2hvd1ByZXZpb3VzVmFsdWUoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmhpc3RvcnkuaGFzKHRoaXMudmFsdWUpKSB7XG5cdFx0XHR0aGlzLmFkZFRvSGlzdG9yeSgpO1xuXHRcdH1cblxuXHRcdGxldCBwcmV2aW91cyA9IHRoaXMuZ2V0UHJldmlvdXNWYWx1ZSgpO1xuXHRcdGlmIChwcmV2aW91cykge1xuXHRcdFx0cHJldmlvdXMgPSBwcmV2aW91cyA9PT0gdGhpcy52YWx1ZSA/IHRoaXMuZ2V0UHJldmlvdXNWYWx1ZSgpIDogcHJldmlvdXM7XG5cdFx0fVxuXG5cdFx0aWYgKHByZXZpb3VzKSB7XG5cdFx0XHR0aGlzLnZhbHVlID0gcHJldmlvdXM7XG5cdFx0XHRhcmlhLnN0YXR1cyh0aGlzLnZhbHVlKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgY2xlYXJIaXN0b3J5KCk6IHZvaWQge1xuXHRcdHRoaXMuaGlzdG9yeS5jbGVhcigpO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIHNldFBsYWNlSG9sZGVyKHBsYWNlSG9sZGVyOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRzdXBlci5zZXRQbGFjZUhvbGRlcihwbGFjZUhvbGRlcik7XG5cdFx0dGhpcy5zZXRUb29sdGlwKHBsYWNlSG9sZGVyKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBvbkJsdXIoKTogdm9pZCB7XG5cdFx0c3VwZXIub25CbHVyKCk7XG5cdFx0dGhpcy5fb25EaWRCbHVyLmZpcmUoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBvbkZvY3VzKCk6IHZvaWQge1xuXHRcdHN1cGVyLm9uRm9jdXMoKTtcblx0XHR0aGlzLl9vbkRpZEZvY3VzLmZpcmUoKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0Q3VycmVudFZhbHVlKCk6IHN0cmluZyB8IG51bGwge1xuXHRcdGxldCBjdXJyZW50VmFsdWUgPSB0aGlzLmhpc3RvcnkuY3VycmVudCgpO1xuXHRcdGlmICghY3VycmVudFZhbHVlKSB7XG5cdFx0XHRjdXJyZW50VmFsdWUgPSB0aGlzLmhpc3RvcnkubGFzdCgpO1xuXHRcdFx0dGhpcy5oaXN0b3J5Lm5leHQoKTtcblx0XHR9XG5cdFx0cmV0dXJuIGN1cnJlbnRWYWx1ZTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0UHJldmlvdXNWYWx1ZSgpOiBzdHJpbmcgfCBudWxsIHtcblx0XHRyZXR1cm4gdGhpcy5oaXN0b3J5LnByZXZpb3VzKCkgfHwgdGhpcy5oaXN0b3J5LmZpcnN0KCk7XG5cdH1cblxuXHRwcml2YXRlIGdldE5leHRWYWx1ZSgpOiBzdHJpbmcgfCBudWxsIHtcblx0XHRyZXR1cm4gdGhpcy5oaXN0b3J5Lm5leHQoKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsWUFBWSxTQUFTO0FBQ3JCLFlBQVksV0FBVztBQUN2QixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLHFCQUFxQixrQkFBa0I7QUFHaEQsU0FBUyxpQkFBaUI7QUFDMUIsWUFBWSxVQUFVO0FBQ3RCLFNBQVMsdUJBQTZDO0FBQ3RELFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsY0FBYztBQUV2QixTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLHdCQUFrQztBQUMzQyxTQUFTLGNBQWM7QUFDdkIsU0FBUywyQkFBMkI7QUFDcEMsT0FBTztBQUNQLFlBQVksU0FBUztBQUNyQixTQUFTLHlCQUEyQztBQUdwRCxNQUFNLElBQUksSUFBSTtBQThDUCxJQUFXLGNBQVgsa0JBQVdBLGlCQUFYO0FBQ04sRUFBQUEsMEJBQUEsVUFBTyxLQUFQO0FBQ0EsRUFBQUEsMEJBQUEsYUFBVSxLQUFWO0FBQ0EsRUFBQUEsMEJBQUEsV0FBUSxLQUFSO0FBSGlCLFNBQUFBO0FBQUEsR0FBQTtBQVdYLE1BQU0sc0JBQXVDO0FBQUEsRUFDbkQsaUJBQWlCO0FBQUEsRUFDakIsaUJBQWlCO0FBQUEsRUFDakIsMkJBQTJCO0FBQUEsRUFDM0IsK0JBQStCO0FBQUEsRUFDL0IsOEJBQThCO0FBQUEsRUFDOUIsa0NBQWtDO0FBQUEsRUFDbEMsNEJBQTRCO0FBQUEsRUFDNUIsZ0NBQWdDO0FBQUEsRUFDaEMsYUFBYTtBQUFBLEVBQ2IsZ0NBQWdDO0FBQUEsRUFDaEMsK0JBQStCO0FBQUEsRUFDL0Isa0NBQWtDO0FBQ25DO0FBRU8sTUFBTSxpQkFBaUIsT0FBTztBQUFBLEVBMEJwQyxZQUFZLFdBQXdCLHFCQUF1RCxTQUF3QjtBQUNsSCxVQUFNO0FBaEJQLFNBQVEsUUFBb0M7QUFLNUMsU0FBUSxZQUFvQixPQUFPO0FBRW5DLFNBQWlC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
