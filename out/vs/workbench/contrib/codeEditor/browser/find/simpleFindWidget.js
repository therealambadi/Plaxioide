import "./simpleFindWidget.css";
import * as nls from "../../../../../nls.js";
import * as dom from "../../../../../base/browser/dom.js";
import { Widget } from "../../../../../base/browser/ui/widget.js";
import { Delayer } from "../../../../../base/common/async.js";
import { KeyCode } from "../../../../../base/common/keyCodes.js";
import { FindReplaceState } from "../../../../../editor/contrib/find/browser/findState.js";
import { SimpleButton, findPreviousMatchIcon, findNextMatchIcon, NLS_NO_RESULTS, NLS_MATCHES_LOCATION } from "../../../../../editor/contrib/find/browser/findWidget.js";
import { ContextScopedFindInput } from "../../../../../platform/history/browser/contextScopedHistoryWidget.js";
import { widgetClose } from "../../../../../platform/theme/common/iconRegistry.js";
import { registerThemingParticipant } from "../../../../../platform/theme/common/themeService.js";
import * as strings from "../../../../../base/common/strings.js";
import { showHistoryKeybindingHint } from "../../../../../platform/history/browser/historyWidgetKeybindingHint.js";
import { status } from "../../../../../base/browser/ui/aria/aria.js";
import { defaultInputBoxStyles, defaultToggleStyles } from "../../../../../platform/theme/browser/defaultStyles.js";
import { Orientation, Sash } from "../../../../../base/browser/ui/sash/sash.js";
import { registerColor } from "../../../../../platform/theme/common/colorRegistry.js";
const NLS_FIND_INPUT_LABEL = nls.localize("label.find", "Find");
const NLS_FIND_INPUT_PLACEHOLDER = nls.localize("placeholder.find", "Find");
const NLS_PREVIOUS_MATCH_BTN_LABEL = nls.localize("label.previousMatchButton", "Previous Match");
const NLS_NEXT_MATCH_BTN_LABEL = nls.localize("label.nextMatchButton", "Next Match");
const NLS_CLOSE_BTN_LABEL = nls.localize("label.closeButton", "Close");
const SIMPLE_FIND_WIDGET_INITIAL_WIDTH = 310;
const MATCHES_COUNT_WIDTH = 73;
class SimpleFindWidget extends Widget {
  constructor(options, contextViewService, contextKeyService, hoverService, _keybindingService) {
    super();
    this._keybindingService = _keybindingService;
    this._isVisible = false;
    this._foundMatch = false;
    this._width = 0;
    this.state = this._register(new FindReplaceState());
    this._matchesLimit = options.matchesLimit ?? Number.MAX_SAFE_INTEGER;
    this._findInput = this._register(new ContextScopedFindInput(null, contextViewService, {
      label: NLS_FIND_INPUT_LABEL,
      placeholder: NLS_FIND_INPUT_PLACEHOLDER,
      validation: (value) => {
        if (value.length === 0 || !this._findInput.getRegex()) {
          return null;
        }
        try {
          new RegExp(value);
          return null;
        } catch (e) {
          this._foundMatch = false;
          this.updateButtons(this._foundMatch);
          return { content: e.message };
        }
      },
      showCommonFindToggles: options.showCommonFindToggles,
      appendCaseSensitiveLabel: options.appendCaseSensitiveActionId ? this._getKeybinding(options.appendCaseSensitiveActionId) : void 0,
      appendRegexLabel: options.appendRegexActionId ? this._getKeybinding(options.appendRegexActionId) : void 0,
      appendWholeWordsLabel: options.appendWholeWordsActionId ? this._getKeybinding(options.appendWholeWordsActionId) : void 0,
      showHistoryHint: () => showHistoryKeybindingHint(_keybindingService),
      inputBoxStyles: defaultInputBoxStyles,
      toggleStyles: defaultToggleStyles
    }, contextKeyService));
    this._updateHistoryDelayer = this._register(new Delayer(500));
    this._register(this._findInput.onInput(async (e) => {
      if (!options.checkImeCompletionState || !this._findInput.isImeSessionInProgress) {
        this._foundMatch = this._onInputChanged();
        if (options.showResultCount) {
          await this.updateResultCount();
        }
        this.updateButtons(this._foundMatch);
        this.focusFindBox();
        this._delayedUpdateHistory();
      }
    }));
    this._findInput.setRegex(!!this.state.isRegex);
    this._findInput.setCaseSensitive(!!this.state.matchCase);
    this._findInput.setWholeWords(!!this.state.wholeWord);
    this._register(this._findInput.onDidOptionChange(() => {
      this.state.change({
        isRegex: this._findInput.getRegex(),
        wholeWord: this._findInput.getWholeWords(),
        matchCase: this._findInput.getCaseSensitive()
      }, true);
    }));
    this._register(this.state.onFindReplaceStateChange(() => {
      this._findInput.setRegex(this.state.isRegex);
      this._findInput.setWholeWords(this.state.wholeWord);
      this._findInput.setCaseSensitive(this.state.matchCase);
      this.findFirst();
    }));
    this.prevBtn = this._register(new SimpleButton({
      label: NLS_PREVIOUS_MATCH_BTN_LABEL + (options.previousMatchActionId ? this._getKeybinding(options.previousMatchActionId) : ""),
      icon: findPreviousMatchIcon,
      onTrigger: () => {
        this.find(true);
      }
    }, hoverService));
    this.nextBtn = this._register(new SimpleButton({
      label: NLS_NEXT_MATCH_BTN_LABEL + (options.nextMatchActionId ? this._getKeybinding(options.nextMatchActionId) : ""),
      icon: findNextMatchIcon,
      onTrigger: () => {
        this.find(false);
      }
    }, hoverService));
    const closeBtn = this._register(new SimpleButton({
      label: NLS_CLOSE_BTN_LABEL + (options.closeWidgetActionId ? this._getKeybinding(options.closeWidgetActionId) : ""),
      icon: widgetClose,
      onTrigger: () => {
        this.hide();
      }
    }, hoverService));
    this._innerDomNode = document.createElement("div");
    this._innerDomNode.classList.add("simple-find-part");
    this._innerDomNode.appendChild(this._findInput.domNode);
    this._innerDomNode.appendChild(this.prevBtn.domNode);
    this._innerDomNode.appendChild(this.nextBtn.domNode);
    this._innerDomNode.appendChild(closeBtn.domNode);
    this._domNode = document.createElement("div");
    this._domNode.classList.add("simple-find-part-wrapper");
    this._domNode.appendChild(this._innerDomNode);
    this.onkeyup(this._innerDomNode, (e) => {
      if (e.equals(KeyCode.Escape)) {
        this.hide();
        e.preventDefault();
        return;
      }
    });
    this._focusTracker = this._register(dom.trackFocus(this._innerDomNode));
    this._register(this._focusTracker.onDidFocus(this._onFocusTrackerFocus.bind(this)));
    this._register(this._focusTracker.onDidBlur(this._onFocusTrackerBlur.bind(this)));
    this._findInputFocusTracker = this._register(dom.trackFocus(this._findInput.domNode));
    this._register(this._findInputFocusTracker.onDidFocus(this._onFindInputFocusTrackerFocus.bind(this)));
    this._register(this._findInputFocusTracker.onDidBlur(this._onFindInputFocusTrackerBlur.bind(this)));
    this._register(dom.addDisposableListener(this._innerDomNode, "click", (event) => {
      event.stopPropagation();
    }));
    if (options?.showResultCount) {
      this._domNode.classList.add("result-count");
      this._matchesCount = document.createElement("div");
      this._matchesCount.className = "matchesCount";
      this._findInput.domNode.insertAdjacentElement("afterend", this._matchesCount);
      this._register(this._findInput.onDidChange(async () => {
        await this.updateResultCount();
      }));
      this._register(this._findInput.onDidOptionChange(async () => {
        this._foundMatch = this._onInputChanged();
        await this.updateResultCount();
        this.focusFindBox();
        this._delayedUpdateHistory();
      }));
    }
    let initialMinWidth = options?.initialWidth;
    if (initialMinWidth) {
      initialMinWidth = initialMinWidth < SIMPLE_FIND_WIDGET_INITIAL_WIDTH ? SIMPLE_FIND_WIDGET_INITIAL_WIDTH : initialMinWidth;
      this._domNode.style.width = `${initialMinWidth}px`;
    }
    if (options?.enableSash) {
      const _initialMinWidth = initialMinWidth ?? SIMPLE_FIND_WIDGET_INITIAL_WIDTH;
      let originalWidth = _initialMinWidth;
      const resizeSash = this._register(new Sash(this._innerDomNode, this, { orientation: Orientation.VERTICAL, size: 1 }));
      this._register(resizeSash.onDidStart(() => {
        originalWidth = parseFloat(dom.getComputedStyle(this._domNode).width);
      }));
      this._register(resizeSash.onDidChange((e) => {
        const width = originalWidth + e.startX - e.currentX;
        if (width < _initialMinWidth) {
          return;
        }
        this._domNode.style.width = `${width}px`;
      }));
      this._register(resizeSash.onDidReset((e) => {
        const currentWidth = parseFloat(dom.getComputedStyle(this._domNode).width);
        if (currentWidth === _initialMinWidth) {
          this._domNode.style.width = "100%";
        } else {
          this._domNode.style.width = `${_initialMinWidth}px`;
        }
      }));
    }
  }
  getVerticalSashLeft(_sash) {
    return 0;
  }
  get inputValue() {
    return this._findInput.getValue();
  }
  get focusTracker() {
    return this._focusTracker;
  }
  _getKeybinding(actionId) {
    const kb = this._keybindingService?.lookupKeybinding(actionId);
    if (!kb) {
      return "";
    }
    return ` (${kb.getLabel()})`;
  }
  dispose() {
    super.dispose();
    this._domNode?.remove();
  }
  isVisible() {
    return this._isVisible;
  }
  getDomNode() {
    return this._domNode;
  }
  getFindInputDomNode() {
    return this._findInput.domNode;
  }
  reveal(initialInput, animated = true) {
    if (initialInput) {
      this._findInput.setValue(initialInput);
    }
    if (this._isVisible) {
      this._findInput.select();
      return;
    }
    this._isVisible = true;
    this.updateResultCount();
    this.layout();
    setTimeout(() => {
      this._innerDomNode.classList.toggle("suppress-transition", !animated);
      this._innerDomNode.classList.add("visible", "visible-transition");
      this._innerDomNode.setAttribute("aria-hidden", "false");
      this._findInput.select();
      if (!animated) {
        setTimeout(() => {
          this._innerDomNode.classList.remove("suppress-transition");
        }, 0);
      }
    }, 0);
  }
  show(initialInput) {
    if (initialInput && !this._isVisible) {
      this._findInput.setValue(initialInput);
    }
    this._isVisible = true;
    this.layout();
    setTimeout(() => {
      this._innerDomNode.classList.add("visible", "visible-transition");
      this._innerDomNode.setAttribute("aria-hidden", "false");
    }, 0);
  }
  hide(animated = true) {
    if (this._isVisible) {
      this._innerDomNode.classList.toggle("suppress-transition", !animated);
      this._innerDomNode.classList.remove("visible-transition");
      this._innerDomNode.setAttribute("aria-hidden", "true");
      setTimeout(() => {
        this._isVisible = false;
        this.updateButtons(this._foundMatch);
        this._innerDomNode.classList.remove("visible", "suppress-transition");
      }, animated ? 200 : 0);
    }
  }
  layout(width = this._width) {
    this._width = width;
    if (!this._isVisible) {
      return;
    }
    if (this._matchesCount) {
      let reducedFindWidget = false;
      if (SIMPLE_FIND_WIDGET_INITIAL_WIDTH + MATCHES_COUNT_WIDTH + 28 >= width) {
        reducedFindWidget = true;
      }
      this._innerDomNode.classList.toggle("reduced-find-widget", reducedFindWidget);
    }
  }
  _delayedUpdateHistory() {
    this._updateHistoryDelayer.trigger(this._updateHistory.bind(this));
  }
  _updateHistory() {
    this._findInput.inputBox.addToHistory();
  }
  _getRegexValue() {
    return this._findInput.getRegex();
  }
  _getWholeWordValue() {
    return this._findInput.getWholeWords();
  }
  _getCaseSensitiveValue() {
    return this._findInput.getCaseSensitive();
  }
  updateButtons(foundMatch) {
    const hasInput = this.inputValue.length > 0;
    this.prevBtn.setEnabled(this._isVisible && hasInput && foundMatch);
    this.nextBtn.setEnabled(this._isVisible && hasInput && foundMatch);
  }
  focusFindBox() {
    this.nextBtn.focus();
    this._findInput.inputBox.focus();
  }
  async updateResultCount() {
    if (!this._matchesCount) {
      this.updateButtons(this._foundMatch);
      return;
    }
    const count = await this._getResultCount();
    this._matchesCount.innerText = "";
    const showRedOutline = this.inputValue.length > 0 && count?.resultCount === 0;
    this._matchesCount.classList.toggle("no-results", showRedOutline);
    let label = "";
    if (count?.resultCount) {
      let matchesCount = String(count.resultCount);
      if (count.resultCount >= this._matchesLimit) {
        matchesCount += "+";
      }
      let matchesPosition = String(count.resultIndex + 1);
      if (matchesPosition === "0") {
        matchesPosition = "?";
      }
      label = strings.format(NLS_MATCHES_LOCATION, matchesPosition, matchesCount);
    } else {
      label = NLS_NO_RESULTS;
    }
    status(this._announceSearchResults(label, this.inputValue));
    this._matchesCount.appendChild(document.createTextNode(label));
    this._foundMatch = !!count && count.resultCount > 0;
    this.updateButtons(this._foundMatch);
  }
  changeState(state) {
    this.state.change(state, false);
  }
  _announceSearchResults(label, searchString) {
    if (!searchString) {
      return nls.localize("ariaSearchNoInput", "Enter search input");
    }
    if (label === NLS_NO_RESULTS) {
      return searchString === "" ? nls.localize("ariaSearchNoResultEmpty", "{0} found", label) : nls.localize("ariaSearchNoResult", "{0} found for '{1}'", label, searchString);
    }
    return nls.localize("ariaSearchNoResultWithLineNumNoCurrentMatch", "{0} found for '{1}'", label, searchString);
  }
}
const simpleFindWidgetSashBorder = registerColor("simpleFindWidget.sashBorder", { dark: "#454545", light: "#C8C8C8", hcDark: "#6FC3DF", hcLight: "#0F4A85" }, nls.localize("simpleFindWidget.sashBorder", "Border color of the sash border."));
registerThemingParticipant((theme, collector) => {
  const resizeBorderBackground = theme.getColor(simpleFindWidgetSashBorder);
  collector.addRule(`.monaco-workbench .simple-find-part .monaco-sash { background-color: ${resizeBorderBackground}; border-color: ${resizeBorderBackground} }`);
});
export {
  SimpleFindWidget,
  simpleFindWidgetSashBorder
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb2RlRWRpdG9yL2Jyb3dzZXIvZmluZC9zaW1wbGVGaW5kV2lkZ2V0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICcuL3NpbXBsZUZpbmRXaWRnZXQuY3NzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgRmluZElucHV0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2ZpbmRpbnB1dC9maW5kSW5wdXQuanMnO1xuaW1wb3J0IHsgV2lkZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3dpZGdldC5qcyc7XG5pbXBvcnQgeyBEZWxheWVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IEZpbmRSZXBsYWNlU3RhdGUsIElOZXdGaW5kUmVwbGFjZVN0YXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvZmluZC9icm93c2VyL2ZpbmRTdGF0ZS5qcyc7XG5pbXBvcnQgeyBJTWVzc2FnZSBhcyBJbnB1dEJveE1lc3NhZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaW5wdXRib3gvaW5wdXRCb3guanMnO1xuaW1wb3J0IHsgU2ltcGxlQnV0dG9uLCBmaW5kUHJldmlvdXNNYXRjaEljb24sIGZpbmROZXh0TWF0Y2hJY29uLCBOTFNfTk9fUkVTVUxUUywgTkxTX01BVENIRVNfTE9DQVRJT04gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9maW5kL2Jyb3dzZXIvZmluZFdpZGdldC5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElDb250ZXh0Vmlld1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IENvbnRleHRTY29wZWRGaW5kSW5wdXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9oaXN0b3J5L2Jyb3dzZXIvY29udGV4dFNjb3BlZEhpc3RvcnlXaWRnZXQuanMnO1xuaW1wb3J0IHsgd2lkZ2V0Q2xvc2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vaWNvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IHJlZ2lzdGVyVGhlbWluZ1BhcnRpY2lwYW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgKiBhcyBzdHJpbmdzIGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBzaG93SGlzdG9yeUtleWJpbmRpbmdIaW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaGlzdG9yeS9icm93c2VyL2hpc3RvcnlXaWRnZXRLZXliaW5kaW5nSGludC5qcyc7XG5pbXBvcnQgeyBzdGF0dXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYXJpYS9hcmlhLmpzJztcbmltcG9ydCB7IGRlZmF1bHRJbnB1dEJveFN0eWxlcywgZGVmYXVsdFRvZ2dsZVN0eWxlcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2Jyb3dzZXIvZGVmYXVsdFN0eWxlcy5qcyc7XG5pbXBvcnQgeyBJU2FzaEV2ZW50LCBJVmVydGljYWxTYXNoTGF5b3V0UHJvdmlkZXIsIE9yaWVudGF0aW9uLCBTYXNoIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3Nhc2gvc2FzaC5qcyc7XG5pbXBvcnQgeyByZWdpc3RlckNvbG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHR5cGUgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5cbmNvbnN0IE5MU19GSU5EX0lOUFVUX0xBQkVMID0gbmxzLmxvY2FsaXplKCdsYWJlbC5maW5kJywgXCJGaW5kXCIpO1xuY29uc3QgTkxTX0ZJTkRfSU5QVVRfUExBQ0VIT0xERVIgPSBubHMubG9jYWxpemUoJ3BsYWNlaG9sZGVyLmZpbmQnLCBcIkZpbmRcIik7XG5jb25zdCBOTFNfUFJFVklPVVNfTUFUQ0hfQlROX0xBQkVMID0gbmxzLmxvY2FsaXplKCdsYWJlbC5wcmV2aW91c01hdGNoQnV0dG9uJywgXCJQcmV2aW91cyBNYXRjaFwiKTtcbmNvbnN0IE5MU19ORVhUX01BVENIX0JUTl9MQUJFTCA9IG5scy5sb2NhbGl6ZSgnbGFiZWwubmV4dE1hdGNoQnV0dG9uJywgXCJOZXh0IE1hdGNoXCIpO1xuY29uc3QgTkxTX0NMT1NFX0JUTl9MQUJFTCA9IG5scy5sb2NhbGl6ZSgnbGFiZWwuY2xvc2VCdXR0b24nLCBcIkNsb3NlXCIpO1xuXG5pbnRlcmZhY2UgSUZpbmRPcHRpb25zIHtcblx0c2hvd0NvbW1vbkZpbmRUb2dnbGVzPzogYm9vbGVhbjtcblx0Y2hlY2tJbWVDb21wbGV0aW9uU3RhdGU/OiBib29sZWFuO1xuXHRzaG93UmVzdWx0Q291bnQ/OiBib29sZWFuO1xuXHRhcHBlbmRDYXNlU2Vuc2l0aXZlQWN0aW9uSWQ/OiBzdHJpbmc7XG5cdGFwcGVuZFJlZ2V4QWN0aW9uSWQ/OiBzdHJpbmc7XG5cdGFwcGVuZFdob2xlV29yZHNBY3Rpb25JZD86IHN0cmluZztcblx0cHJldmlvdXNNYXRjaEFjdGlvbklkPzogc3RyaW5nO1xuXHRuZXh0TWF0Y2hBY3Rpb25JZD86IHN0cmluZztcblx0Y2xvc2VXaWRnZXRBY3Rpb25JZD86IHN0cmluZztcblx0bWF0Y2hlc0xpbWl0PzogbnVtYmVyO1xuXHR0eXBlPzogJ1Rlcm1pbmFsJyB8ICdXZWJ2aWV3Jztcblx0aW5pdGlhbFdpZHRoPzogbnVtYmVyO1xuXHRlbmFibGVTYXNoPzogYm9vbGVhbjtcbn1cblxuY29uc3QgU0lNUExFX0ZJTkRfV0lER0VUX0lOSVRJQUxfV0lEVEggPSAzMTA7XG5jb25zdCBNQVRDSEVTX0NPVU5UX1dJRFRIID0gNzM7XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBTaW1wbGVGaW5kV2lkZ2V0IGV4dGVuZHMgV2lkZ2V0IGltcGxlbWVudHMgSVZlcnRpY2FsU2FzaExheW91dFByb3ZpZGVyIHtcblx0cHJpdmF0ZSByZWFkb25seSBfZmluZElucHV0OiBGaW5kSW5wdXQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2RvbU5vZGU6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9pbm5lckRvbU5vZGU6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9mb2N1c1RyYWNrZXI6IGRvbS5JRm9jdXNUcmFja2VyO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9maW5kSW5wdXRGb2N1c1RyYWNrZXI6IGRvbS5JRm9jdXNUcmFja2VyO1xuXHRwcml2YXRlIHJlYWRvbmx5IF91cGRhdGVIaXN0b3J5RGVsYXllcjogRGVsYXllcjx2b2lkPjtcblx0cHJpdmF0ZSByZWFkb25seSBwcmV2QnRuOiBTaW1wbGVCdXR0b247XG5cdHByaXZhdGUgcmVhZG9ubHkgbmV4dEJ0bjogU2ltcGxlQnV0dG9uO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9tYXRjaGVzTGltaXQ6IG51bWJlcjtcblx0cHJpdmF0ZSBfbWF0Y2hlc0NvdW50OiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIF9pc1Zpc2libGU6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBfZm91bmRNYXRjaDogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIF93aWR0aDogbnVtYmVyID0gMDtcblxuXHRyZWFkb25seSBzdGF0ZTogRmluZFJlcGxhY2VTdGF0ZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRvcHRpb25zOiBJRmluZE9wdGlvbnMsXG5cdFx0Y29udGV4dFZpZXdTZXJ2aWNlOiBJQ29udGV4dFZpZXdTZXJ2aWNlLFxuXHRcdGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0aG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2tleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLnN0YXRlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEZpbmRSZXBsYWNlU3RhdGUoKSk7XG5cdFx0dGhpcy5fbWF0Y2hlc0xpbWl0ID0gb3B0aW9ucy5tYXRjaGVzTGltaXQgPz8gTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVI7XG5cblx0XHR0aGlzLl9maW5kSW5wdXQgPSB0aGlzLl9yZWdpc3RlcihuZXcgQ29udGV4dFNjb3BlZEZpbmRJbnB1dChudWxsLCBjb250ZXh0Vmlld1NlcnZpY2UsIHtcblx0XHRcdGxhYmVsOiBOTFNfRklORF9JTlBVVF9MQUJFTCxcblx0XHRcdHBsYWNlaG9sZGVyOiBOTFNfRklORF9JTlBVVF9QTEFDRUhPTERFUixcblx0XHRcdHZhbGlkYXRpb246ICh2YWx1ZTogc3RyaW5nKTogSW5wdXRCb3hNZXNzYWdlIHwgbnVsbCA9PiB7XG5cdFx0XHRcdGlmICh2YWx1ZS5sZW5ndGggPT09IDAgfHwgIXRoaXMuX2ZpbmRJbnB1dC5nZXRSZWdleCgpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRuZXcgUmVnRXhwKHZhbHVlKTtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdHRoaXMuX2ZvdW5kTWF0Y2ggPSBmYWxzZTtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZUJ1dHRvbnModGhpcy5fZm91bmRNYXRjaCk7XG5cdFx0XHRcdFx0cmV0dXJuIHsgY29udGVudDogZS5tZXNzYWdlIH07XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRzaG93Q29tbW9uRmluZFRvZ2dsZXM6IG9wdGlvbnMuc2hvd0NvbW1vbkZpbmRUb2dnbGVzLFxuXHRcdFx0YXBwZW5kQ2FzZVNlbnNpdGl2ZUxhYmVsOiBvcHRpb25zLmFwcGVuZENhc2VTZW5zaXRpdmVBY3Rpb25JZCA/IHRoaXMuX2dldEtleWJpbmRpbmcob3B0aW9ucy5hcHBlbmRDYXNlU2Vuc2l0aXZlQWN0aW9uSWQpIDogdW5kZWZpbmVkLFxuXHRcdFx0YXBwZW5kUmVnZXhMYWJlbDogb3B0aW9ucy5hcHBlbmRSZWdleEFjdGlvbklkID8gdGhpcy5fZ2V0S2V5YmluZGluZyhvcHRpb25zLmFwcGVuZFJlZ2V4QWN0aW9uSWQpIDogdW5kZWZpbmVkLFxuXHRcdFx0YXBwZW5kV2hvbGVXb3Jkc0xhYmVsOiBvcHRpb25zLmFwcGVuZFdob2xlV29yZHNBY3Rpb25JZCA/IHRoaXMuX2dldEtleWJpbmRpbmcob3B0aW9ucy5hcHBlbmRXaG9sZVdvcmRzQWN0aW9uSWQpIDogdW5kZWZpbmVkLFxuXHRcdFx0c2hvd0hpc3RvcnlIaW50OiAoKSA9PiBzaG93SGlzdG9yeUtleWJpbmRpbmdIaW50KF9rZXliaW5kaW5nU2VydmljZSksXG5cdFx0XHRpbnB1dEJveFN0eWxlczogZGVmYXVsdElucHV0Qm94U3R5bGVzLFxuXHRcdFx0dG9nZ2xlU3R5bGVzOiBkZWZhdWx0VG9nZ2xlU3R5bGVzXG5cdFx0fSwgY29udGV4dEtleVNlcnZpY2UpKTtcblx0XHQvLyBGaW5kIEhpc3Rvcnkgd2l0aCB1cGRhdGUgZGVsYXllclxuXHRcdHRoaXMuX3VwZGF0ZUhpc3RvcnlEZWxheWVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IERlbGF5ZXI8dm9pZD4oNTAwKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9maW5kSW5wdXQub25JbnB1dChhc3luYyAoZSkgPT4ge1xuXHRcdFx0aWYgKCFvcHRpb25zLmNoZWNrSW1lQ29tcGxldGlvblN0YXRlIHx8ICF0aGlzLl9maW5kSW5wdXQuaXNJbWVTZXNzaW9uSW5Qcm9ncmVzcykge1xuXHRcdFx0XHR0aGlzLl9mb3VuZE1hdGNoID0gdGhpcy5fb25JbnB1dENoYW5nZWQoKTtcblx0XHRcdFx0aWYgKG9wdGlvbnMuc2hvd1Jlc3VsdENvdW50KSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy51cGRhdGVSZXN1bHRDb3VudCgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMudXBkYXRlQnV0dG9ucyh0aGlzLl9mb3VuZE1hdGNoKTtcblx0XHRcdFx0dGhpcy5mb2N1c0ZpbmRCb3goKTtcblx0XHRcdFx0dGhpcy5fZGVsYXllZFVwZGF0ZUhpc3RvcnkoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9maW5kSW5wdXQuc2V0UmVnZXgoISF0aGlzLnN0YXRlLmlzUmVnZXgpO1xuXHRcdHRoaXMuX2ZpbmRJbnB1dC5zZXRDYXNlU2Vuc2l0aXZlKCEhdGhpcy5zdGF0ZS5tYXRjaENhc2UpO1xuXHRcdHRoaXMuX2ZpbmRJbnB1dC5zZXRXaG9sZVdvcmRzKCEhdGhpcy5zdGF0ZS53aG9sZVdvcmQpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZmluZElucHV0Lm9uRGlkT3B0aW9uQ2hhbmdlKCgpID0+IHtcblx0XHRcdHRoaXMuc3RhdGUuY2hhbmdlKHtcblx0XHRcdFx0aXNSZWdleDogdGhpcy5fZmluZElucHV0LmdldFJlZ2V4KCksXG5cdFx0XHRcdHdob2xlV29yZDogdGhpcy5fZmluZElucHV0LmdldFdob2xlV29yZHMoKSxcblx0XHRcdFx0bWF0Y2hDYXNlOiB0aGlzLl9maW5kSW5wdXQuZ2V0Q2FzZVNlbnNpdGl2ZSgpXG5cdFx0XHR9LCB0cnVlKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnN0YXRlLm9uRmluZFJlcGxhY2VTdGF0ZUNoYW5nZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9maW5kSW5wdXQuc2V0UmVnZXgodGhpcy5zdGF0ZS5pc1JlZ2V4KTtcblx0XHRcdHRoaXMuX2ZpbmRJbnB1dC5zZXRXaG9sZVdvcmRzKHRoaXMuc3RhdGUud2hvbGVXb3JkKTtcblx0XHRcdHRoaXMuX2ZpbmRJbnB1dC5zZXRDYXNlU2Vuc2l0aXZlKHRoaXMuc3RhdGUubWF0Y2hDYXNlKTtcblx0XHRcdHRoaXMuZmluZEZpcnN0KCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5wcmV2QnRuID0gdGhpcy5fcmVnaXN0ZXIobmV3IFNpbXBsZUJ1dHRvbih7XG5cdFx0XHRsYWJlbDogTkxTX1BSRVZJT1VTX01BVENIX0JUTl9MQUJFTCArIChvcHRpb25zLnByZXZpb3VzTWF0Y2hBY3Rpb25JZCA/IHRoaXMuX2dldEtleWJpbmRpbmcob3B0aW9ucy5wcmV2aW91c01hdGNoQWN0aW9uSWQpIDogJycpLFxuXHRcdFx0aWNvbjogZmluZFByZXZpb3VzTWF0Y2hJY29uLFxuXHRcdFx0b25UcmlnZ2VyOiAoKSA9PiB7XG5cdFx0XHRcdHRoaXMuZmluZCh0cnVlKTtcblx0XHRcdH1cblx0XHR9LCBob3ZlclNlcnZpY2UpKTtcblxuXHRcdHRoaXMubmV4dEJ0biA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBTaW1wbGVCdXR0b24oe1xuXHRcdFx0bGFiZWw6IE5MU19ORVhUX01BVENIX0JUTl9MQUJFTCArIChvcHRpb25zLm5leHRNYXRjaEFjdGlvbklkID8gdGhpcy5fZ2V0S2V5YmluZGluZyhvcHRpb25zLm5leHRNYXRjaEFjdGlvbklkKSA6ICcnKSxcblx0XHRcdGljb246IGZpbmROZXh0TWF0Y2hJY29uLFxuXHRcdFx0b25UcmlnZ2VyOiAoKSA9PiB7XG5cdFx0XHRcdHRoaXMuZmluZChmYWxzZSk7XG5cdFx0XHR9XG5cdFx0fSwgaG92ZXJTZXJ2aWNlKSk7XG5cblx0XHRjb25zdCBjbG9zZUJ0biA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBTaW1wbGVCdXR0b24oe1xuXHRcdFx0bGFiZWw6IE5MU19DTE9TRV9CVE5fTEFCRUwgKyAob3B0aW9ucy5jbG9zZVdpZGdldEFjdGlvbklkID8gdGhpcy5fZ2V0S2V5YmluZGluZyhvcHRpb25zLmNsb3NlV2lkZ2V0QWN0aW9uSWQpIDogJycpLFxuXHRcdFx0aWNvbjogd2lkZ2V0Q2xvc2UsXG5cdFx0XHRvblRyaWdnZXI6ICgpID0+IHtcblx0XHRcdFx0dGhpcy5oaWRlKCk7XG5cdFx0XHR9XG5cdFx0fSwgaG92ZXJTZXJ2aWNlKSk7XG5cblx0XHR0aGlzLl9pbm5lckRvbU5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHR0aGlzLl9pbm5lckRvbU5vZGUuY2xhc3NMaXN0LmFkZCgnc2ltcGxlLWZpbmQtcGFydCcpO1xuXHRcdHRoaXMuX2lubmVyRG9tTm9kZS5hcHBlbmRDaGlsZCh0aGlzLl9maW5kSW5wdXQuZG9tTm9kZSk7XG5cdFx0dGhpcy5faW5uZXJEb21Ob2RlLmFwcGVuZENoaWxkKHRoaXMucHJldkJ0bi5kb21Ob2RlKTtcblx0XHR0aGlzLl9pbm5lckRvbU5vZGUuYXBwZW5kQ2hpbGQodGhpcy5uZXh0QnRuLmRvbU5vZGUpO1xuXHRcdHRoaXMuX2lubmVyRG9tTm9kZS5hcHBlbmRDaGlsZChjbG9zZUJ0bi5kb21Ob2RlKTtcblxuXHRcdC8vIF9kb21Ob2RlIHdyYXBzIF9pbm5lckRvbU5vZGUsIGVuc3VyaW5nIHRoYXRcblx0XHR0aGlzLl9kb21Ob2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0dGhpcy5fZG9tTm9kZS5jbGFzc0xpc3QuYWRkKCdzaW1wbGUtZmluZC1wYXJ0LXdyYXBwZXInKTtcblx0XHR0aGlzLl9kb21Ob2RlLmFwcGVuZENoaWxkKHRoaXMuX2lubmVyRG9tTm9kZSk7XG5cblx0XHR0aGlzLm9ua2V5dXAodGhpcy5faW5uZXJEb21Ob2RlLCBlID0+IHtcblx0XHRcdGlmIChlLmVxdWFscyhLZXlDb2RlLkVzY2FwZSkpIHtcblx0XHRcdFx0dGhpcy5oaWRlKCk7XG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5fZm9jdXNUcmFja2VyID0gdGhpcy5fcmVnaXN0ZXIoZG9tLnRyYWNrRm9jdXModGhpcy5faW5uZXJEb21Ob2RlKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZm9jdXNUcmFja2VyLm9uRGlkRm9jdXModGhpcy5fb25Gb2N1c1RyYWNrZXJGb2N1cy5iaW5kKHRoaXMpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZm9jdXNUcmFja2VyLm9uRGlkQmx1cih0aGlzLl9vbkZvY3VzVHJhY2tlckJsdXIuYmluZCh0aGlzKSkpO1xuXG5cdFx0dGhpcy5fZmluZElucHV0Rm9jdXNUcmFja2VyID0gdGhpcy5fcmVnaXN0ZXIoZG9tLnRyYWNrRm9jdXModGhpcy5fZmluZElucHV0LmRvbU5vZGUpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9maW5kSW5wdXRGb2N1c1RyYWNrZXIub25EaWRGb2N1cyh0aGlzLl9vbkZpbmRJbnB1dEZvY3VzVHJhY2tlckZvY3VzLmJpbmQodGhpcykpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9maW5kSW5wdXRGb2N1c1RyYWNrZXIub25EaWRCbHVyKHRoaXMuX29uRmluZElucHV0Rm9jdXNUcmFja2VyQmx1ci5iaW5kKHRoaXMpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuX2lubmVyRG9tTm9kZSwgJ2NsaWNrJywgKGV2ZW50KSA9PiB7XG5cdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHR9KSk7XG5cblx0XHRpZiAob3B0aW9ucz8uc2hvd1Jlc3VsdENvdW50KSB7XG5cdFx0XHR0aGlzLl9kb21Ob2RlLmNsYXNzTGlzdC5hZGQoJ3Jlc3VsdC1jb3VudCcpO1xuXHRcdFx0dGhpcy5fbWF0Y2hlc0NvdW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHR0aGlzLl9tYXRjaGVzQ291bnQuY2xhc3NOYW1lID0gJ21hdGNoZXNDb3VudCc7XG5cdFx0XHR0aGlzLl9maW5kSW5wdXQuZG9tTm9kZS5pbnNlcnRBZGphY2VudEVsZW1lbnQoJ2FmdGVyZW5kJywgdGhpcy5fbWF0Y2hlc0NvdW50KTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2ZpbmRJbnB1dC5vbkRpZENoYW5nZShhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGF3YWl0IHRoaXMudXBkYXRlUmVzdWx0Q291bnQoKTtcblx0XHRcdH0pKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2ZpbmRJbnB1dC5vbkRpZE9wdGlvbkNoYW5nZShhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX2ZvdW5kTWF0Y2ggPSB0aGlzLl9vbklucHV0Q2hhbmdlZCgpO1xuXHRcdFx0XHRhd2FpdCB0aGlzLnVwZGF0ZVJlc3VsdENvdW50KCk7XG5cdFx0XHRcdHRoaXMuZm9jdXNGaW5kQm94KCk7XG5cdFx0XHRcdHRoaXMuX2RlbGF5ZWRVcGRhdGVIaXN0b3J5KCk7XG5cdFx0XHR9KSk7XG5cdFx0fVxuXG5cdFx0bGV0IGluaXRpYWxNaW5XaWR0aCA9IG9wdGlvbnM/LmluaXRpYWxXaWR0aDtcblx0XHRpZiAoaW5pdGlhbE1pbldpZHRoKSB7XG5cdFx0XHRpbml0aWFsTWluV2lkdGggPSBpbml0aWFsTWluV2lkdGggPCBTSU1QTEVfRklORF9XSURHRVRfSU5JVElBTF9XSURUSCA/IFNJTVBMRV9GSU5EX1dJREdFVF9JTklUSUFMX1dJRFRIIDogaW5pdGlhbE1pbldpZHRoO1xuXHRcdFx0dGhpcy5fZG9tTm9kZS5zdHlsZS53aWR0aCA9IGAke2luaXRpYWxNaW5XaWR0aH1weGA7XG5cdFx0fVxuXG5cdFx0aWYgKG9wdGlvbnM/LmVuYWJsZVNhc2gpIHtcblx0XHRcdGNvbnN0IF9pbml0aWFsTWluV2lkdGggPSBpbml0aWFsTWluV2lkdGggPz8gU0lNUExFX0ZJTkRfV0lER0VUX0lOSVRJQUxfV0lEVEg7XG5cdFx0XHRsZXQgb3JpZ2luYWxXaWR0aCA9IF9pbml0aWFsTWluV2lkdGg7XG5cblx0XHRcdC8vIHNhc2hcblx0XHRcdGNvbnN0IHJlc2l6ZVNhc2ggPSB0aGlzLl9yZWdpc3RlcihuZXcgU2FzaCh0aGlzLl9pbm5lckRvbU5vZGUsIHRoaXMsIHsgb3JpZW50YXRpb246IE9yaWVudGF0aW9uLlZFUlRJQ0FMLCBzaXplOiAxIH0pKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHJlc2l6ZVNhc2gub25EaWRTdGFydCgoKSA9PiB7XG5cdFx0XHRcdG9yaWdpbmFsV2lkdGggPSBwYXJzZUZsb2F0KGRvbS5nZXRDb21wdXRlZFN0eWxlKHRoaXMuX2RvbU5vZGUpLndpZHRoKTtcblx0XHRcdH0pKTtcblxuXHRcdFx0dGhpcy5fcmVnaXN0ZXIocmVzaXplU2FzaC5vbkRpZENoYW5nZSgoZTogSVNhc2hFdmVudCkgPT4ge1xuXHRcdFx0XHRjb25zdCB3aWR0aCA9IG9yaWdpbmFsV2lkdGggKyBlLnN0YXJ0WCAtIGUuY3VycmVudFg7XG5cdFx0XHRcdGlmICh3aWR0aCA8IF9pbml0aWFsTWluV2lkdGgpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5fZG9tTm9kZS5zdHlsZS53aWR0aCA9IGAke3dpZHRofXB4YDtcblx0XHRcdH0pKTtcblxuXHRcdFx0dGhpcy5fcmVnaXN0ZXIocmVzaXplU2FzaC5vbkRpZFJlc2V0KGUgPT4ge1xuXHRcdFx0XHRjb25zdCBjdXJyZW50V2lkdGggPSBwYXJzZUZsb2F0KGRvbS5nZXRDb21wdXRlZFN0eWxlKHRoaXMuX2RvbU5vZGUpLndpZHRoKTtcblx0XHRcdFx0aWYgKGN1cnJlbnRXaWR0aCA9PT0gX2luaXRpYWxNaW5XaWR0aCkge1xuXHRcdFx0XHRcdHRoaXMuX2RvbU5vZGUuc3R5bGUud2lkdGggPSAnMTAwJSc7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5fZG9tTm9kZS5zdHlsZS53aWR0aCA9IGAke19pbml0aWFsTWluV2lkdGh9cHhgO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGdldFZlcnRpY2FsU2FzaExlZnQoX3Nhc2g6IFNhc2gpOiBudW1iZXIge1xuXHRcdHJldHVybiAwO1xuXHR9XG5cblx0cHVibGljIGFic3RyYWN0IGZpbmQocHJldmlvdXM6IGJvb2xlYW4pOiB2b2lkO1xuXHRwdWJsaWMgYWJzdHJhY3QgZmluZEZpcnN0KCk6IHZvaWQ7XG5cdHByb3RlY3RlZCBhYnN0cmFjdCBfb25JbnB1dENoYW5nZWQoKTogYm9vbGVhbjtcblx0cHJvdGVjdGVkIGFic3RyYWN0IF9vbkZvY3VzVHJhY2tlckZvY3VzKCk6IHZvaWQ7XG5cdHByb3RlY3RlZCBhYnN0cmFjdCBfb25Gb2N1c1RyYWNrZXJCbHVyKCk6IHZvaWQ7XG5cdHByb3RlY3RlZCBhYnN0cmFjdCBfb25GaW5kSW5wdXRGb2N1c1RyYWNrZXJGb2N1cygpOiB2b2lkO1xuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgX29uRmluZElucHV0Rm9jdXNUcmFja2VyQmx1cigpOiB2b2lkO1xuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgX2dldFJlc3VsdENvdW50KCk6IFByb21pc2U8eyByZXN1bHRJbmRleDogbnVtYmVyOyByZXN1bHRDb3VudDogbnVtYmVyIH0gfCB1bmRlZmluZWQ+O1xuXG5cdHByb3RlY3RlZCBnZXQgaW5wdXRWYWx1ZSgpIHtcblx0XHRyZXR1cm4gdGhpcy5fZmluZElucHV0LmdldFZhbHVlKCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGZvY3VzVHJhY2tlcigpOiBkb20uSUZvY3VzVHJhY2tlciB7XG5cdFx0cmV0dXJuIHRoaXMuX2ZvY3VzVHJhY2tlcjtcblx0fVxuXG5cdHByaXZhdGUgX2dldEtleWJpbmRpbmcoYWN0aW9uSWQ6IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0Y29uc3Qga2IgPSB0aGlzLl9rZXliaW5kaW5nU2VydmljZT8ubG9va3VwS2V5YmluZGluZyhhY3Rpb25JZCk7XG5cdFx0aWYgKCFrYikge1xuXHRcdFx0cmV0dXJuICcnO1xuXHRcdH1cblx0XHRyZXR1cm4gYCAoJHtrYi5nZXRMYWJlbCgpfSlgO1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cblx0XHR0aGlzLl9kb21Ob2RlPy5yZW1vdmUoKTtcblx0fVxuXG5cdHB1YmxpYyBpc1Zpc2libGUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2lzVmlzaWJsZTtcblx0fVxuXG5cdHB1YmxpYyBnZXREb21Ob2RlKCkge1xuXHRcdHJldHVybiB0aGlzLl9kb21Ob2RlO1xuXHR9XG5cblx0cHVibGljIGdldEZpbmRJbnB1dERvbU5vZGUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2ZpbmRJbnB1dC5kb21Ob2RlO1xuXHR9XG5cblx0cHVibGljIHJldmVhbChpbml0aWFsSW5wdXQ/OiBzdHJpbmcsIGFuaW1hdGVkID0gdHJ1ZSk6IHZvaWQge1xuXHRcdGlmIChpbml0aWFsSW5wdXQpIHtcblx0XHRcdHRoaXMuX2ZpbmRJbnB1dC5zZXRWYWx1ZShpbml0aWFsSW5wdXQpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9pc1Zpc2libGUpIHtcblx0XHRcdHRoaXMuX2ZpbmRJbnB1dC5zZWxlY3QoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9pc1Zpc2libGUgPSB0cnVlO1xuXHRcdHRoaXMudXBkYXRlUmVzdWx0Q291bnQoKTtcblx0XHR0aGlzLmxheW91dCgpO1xuXG5cdFx0c2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHR0aGlzLl9pbm5lckRvbU5vZGUuY2xhc3NMaXN0LnRvZ2dsZSgnc3VwcHJlc3MtdHJhbnNpdGlvbicsICFhbmltYXRlZCk7XG5cdFx0XHR0aGlzLl9pbm5lckRvbU5vZGUuY2xhc3NMaXN0LmFkZCgndmlzaWJsZScsICd2aXNpYmxlLXRyYW5zaXRpb24nKTtcblx0XHRcdHRoaXMuX2lubmVyRG9tTm9kZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtaGlkZGVuJywgJ2ZhbHNlJyk7XG5cdFx0XHR0aGlzLl9maW5kSW5wdXQuc2VsZWN0KCk7XG5cblx0XHRcdGlmICghYW5pbWF0ZWQpIHtcblx0XHRcdFx0c2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5faW5uZXJEb21Ob2RlLmNsYXNzTGlzdC5yZW1vdmUoJ3N1cHByZXNzLXRyYW5zaXRpb24nKTtcblx0XHRcdFx0fSwgMCk7XG5cdFx0XHR9XG5cdFx0fSwgMCk7XG5cdH1cblxuXHRwdWJsaWMgc2hvdyhpbml0aWFsSW5wdXQ/OiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAoaW5pdGlhbElucHV0ICYmICF0aGlzLl9pc1Zpc2libGUpIHtcblx0XHRcdHRoaXMuX2ZpbmRJbnB1dC5zZXRWYWx1ZShpbml0aWFsSW5wdXQpO1xuXHRcdH1cblxuXHRcdHRoaXMuX2lzVmlzaWJsZSA9IHRydWU7XG5cdFx0dGhpcy5sYXlvdXQoKTtcblxuXHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0dGhpcy5faW5uZXJEb21Ob2RlLmNsYXNzTGlzdC5hZGQoJ3Zpc2libGUnLCAndmlzaWJsZS10cmFuc2l0aW9uJyk7XG5cblx0XHRcdHRoaXMuX2lubmVyRG9tTm9kZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtaGlkZGVuJywgJ2ZhbHNlJyk7XG5cdFx0fSwgMCk7XG5cdH1cblxuXHRwdWJsaWMgaGlkZShhbmltYXRlZCA9IHRydWUpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5faXNWaXNpYmxlKSB7XG5cdFx0XHR0aGlzLl9pbm5lckRvbU5vZGUuY2xhc3NMaXN0LnRvZ2dsZSgnc3VwcHJlc3MtdHJhbnNpdGlvbicsICFhbmltYXRlZCk7XG5cdFx0XHR0aGlzLl9pbm5lckRvbU5vZGUuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZS10cmFuc2l0aW9uJyk7XG5cdFx0XHR0aGlzLl9pbm5lckRvbU5vZGUuc2V0QXR0cmlidXRlKCdhcmlhLWhpZGRlbicsICd0cnVlJyk7XG5cdFx0XHQvLyBOZWVkIHRvIGRlbGF5IHRvZ2dsaW5nIHZpc2liaWxpdHkgdW50aWwgYWZ0ZXIgVHJhbnNpdGlvbiwgdGhlbiB2aXNpYmlsaXR5IGhpZGRlbiAtIHJlbW92ZXMgZnJvbSB0YWJJbmRleCBsaXN0XG5cdFx0XHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0dGhpcy5faXNWaXNpYmxlID0gZmFsc2U7XG5cdFx0XHRcdHRoaXMudXBkYXRlQnV0dG9ucyh0aGlzLl9mb3VuZE1hdGNoKTtcblx0XHRcdFx0dGhpcy5faW5uZXJEb21Ob2RlLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnLCAnc3VwcHJlc3MtdHJhbnNpdGlvbicpO1xuXHRcdFx0fSwgYW5pbWF0ZWQgPyAyMDAgOiAwKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgbGF5b3V0KHdpZHRoOiBudW1iZXIgPSB0aGlzLl93aWR0aCk6IHZvaWQge1xuXHRcdHRoaXMuX3dpZHRoID0gd2lkdGg7XG5cblx0XHRpZiAoIXRoaXMuX2lzVmlzaWJsZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9tYXRjaGVzQ291bnQpIHtcblx0XHRcdGxldCByZWR1Y2VkRmluZFdpZGdldCA9IGZhbHNlO1xuXHRcdFx0aWYgKFNJTVBMRV9GSU5EX1dJREdFVF9JTklUSUFMX1dJRFRIICsgTUFUQ0hFU19DT1VOVF9XSURUSCArIDI4ID49IHdpZHRoKSB7XG5cdFx0XHRcdHJlZHVjZWRGaW5kV2lkZ2V0ID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX2lubmVyRG9tTm9kZS5jbGFzc0xpc3QudG9nZ2xlKCdyZWR1Y2VkLWZpbmQtd2lkZ2V0JywgcmVkdWNlZEZpbmRXaWRnZXQpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBfZGVsYXllZFVwZGF0ZUhpc3RvcnkoKSB7XG5cdFx0dGhpcy5fdXBkYXRlSGlzdG9yeURlbGF5ZXIudHJpZ2dlcih0aGlzLl91cGRhdGVIaXN0b3J5LmJpbmQodGhpcykpO1xuXHR9XG5cblx0cHJvdGVjdGVkIF91cGRhdGVIaXN0b3J5KCkge1xuXHRcdHRoaXMuX2ZpbmRJbnB1dC5pbnB1dEJveC5hZGRUb0hpc3RvcnkoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBfZ2V0UmVnZXhWYWx1ZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fZmluZElucHV0LmdldFJlZ2V4KCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2dldFdob2xlV29yZFZhbHVlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9maW5kSW5wdXQuZ2V0V2hvbGVXb3JkcygpO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9nZXRDYXNlU2Vuc2l0aXZlVmFsdWUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2ZpbmRJbnB1dC5nZXRDYXNlU2Vuc2l0aXZlKCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgdXBkYXRlQnV0dG9ucyhmb3VuZE1hdGNoOiBib29sZWFuKSB7XG5cdFx0Y29uc3QgaGFzSW5wdXQgPSB0aGlzLmlucHV0VmFsdWUubGVuZ3RoID4gMDtcblx0XHR0aGlzLnByZXZCdG4uc2V0RW5hYmxlZCh0aGlzLl9pc1Zpc2libGUgJiYgaGFzSW5wdXQgJiYgZm91bmRNYXRjaCk7XG5cdFx0dGhpcy5uZXh0QnRuLnNldEVuYWJsZWQodGhpcy5faXNWaXNpYmxlICYmIGhhc0lucHV0ICYmIGZvdW5kTWF0Y2gpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGZvY3VzRmluZEJveCgpIHtcblx0XHQvLyBGb2N1cyBiYWNrIG9udG8gdGhlIGZpbmQgYm94LCB3aGljaFxuXHRcdC8vIHJlcXVpcmVzIGZvY3VzaW5nIG9udG8gdGhlIG5leHQgYnV0dG9uIGZpcnN0XG5cdFx0dGhpcy5uZXh0QnRuLmZvY3VzKCk7XG5cdFx0dGhpcy5fZmluZElucHV0LmlucHV0Qm94LmZvY3VzKCk7XG5cdH1cblxuXHRhc3luYyB1cGRhdGVSZXN1bHRDb3VudCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMuX21hdGNoZXNDb3VudCkge1xuXHRcdFx0dGhpcy51cGRhdGVCdXR0b25zKHRoaXMuX2ZvdW5kTWF0Y2gpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvdW50ID0gYXdhaXQgdGhpcy5fZ2V0UmVzdWx0Q291bnQoKTtcblx0XHR0aGlzLl9tYXRjaGVzQ291bnQuaW5uZXJUZXh0ID0gJyc7XG5cdFx0Y29uc3Qgc2hvd1JlZE91dGxpbmUgPSAodGhpcy5pbnB1dFZhbHVlLmxlbmd0aCA+IDAgJiYgY291bnQ/LnJlc3VsdENvdW50ID09PSAwKTtcblx0XHR0aGlzLl9tYXRjaGVzQ291bnQuY2xhc3NMaXN0LnRvZ2dsZSgnbm8tcmVzdWx0cycsIHNob3dSZWRPdXRsaW5lKTtcblx0XHRsZXQgbGFiZWwgPSAnJztcblx0XHRpZiAoY291bnQ/LnJlc3VsdENvdW50KSB7XG5cdFx0XHRsZXQgbWF0Y2hlc0NvdW50OiBzdHJpbmcgPSBTdHJpbmcoY291bnQucmVzdWx0Q291bnQpO1xuXHRcdFx0aWYgKGNvdW50LnJlc3VsdENvdW50ID49IHRoaXMuX21hdGNoZXNMaW1pdCkge1xuXHRcdFx0XHRtYXRjaGVzQ291bnQgKz0gJysnO1xuXHRcdFx0fVxuXHRcdFx0bGV0IG1hdGNoZXNQb3NpdGlvbjogc3RyaW5nID0gU3RyaW5nKGNvdW50LnJlc3VsdEluZGV4ICsgMSk7XG5cdFx0XHRpZiAobWF0Y2hlc1Bvc2l0aW9uID09PSAnMCcpIHtcblx0XHRcdFx0bWF0Y2hlc1Bvc2l0aW9uID0gJz8nO1xuXHRcdFx0fVxuXHRcdFx0bGFiZWwgPSBzdHJpbmdzLmZvcm1hdChOTFNfTUFUQ0hFU19MT0NBVElPTiwgbWF0Y2hlc1Bvc2l0aW9uLCBtYXRjaGVzQ291bnQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRsYWJlbCA9IE5MU19OT19SRVNVTFRTO1xuXHRcdH1cblx0XHRzdGF0dXModGhpcy5fYW5ub3VuY2VTZWFyY2hSZXN1bHRzKGxhYmVsLCB0aGlzLmlucHV0VmFsdWUpKTtcblx0XHR0aGlzLl9tYXRjaGVzQ291bnQuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUobGFiZWwpKTtcblx0XHR0aGlzLl9mb3VuZE1hdGNoID0gISFjb3VudCAmJiBjb3VudC5yZXN1bHRDb3VudCA+IDA7XG5cdFx0dGhpcy51cGRhdGVCdXR0b25zKHRoaXMuX2ZvdW5kTWF0Y2gpO1xuXHR9XG5cblx0Y2hhbmdlU3RhdGUoc3RhdGU6IElOZXdGaW5kUmVwbGFjZVN0YXRlKSB7XG5cdFx0dGhpcy5zdGF0ZS5jaGFuZ2Uoc3RhdGUsIGZhbHNlKTtcblx0fVxuXG5cdHByaXZhdGUgX2Fubm91bmNlU2VhcmNoUmVzdWx0cyhsYWJlbDogc3RyaW5nLCBzZWFyY2hTdHJpbmc/OiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdGlmICghc2VhcmNoU3RyaW5nKSB7XG5cdFx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCdhcmlhU2VhcmNoTm9JbnB1dCcsIFwiRW50ZXIgc2VhcmNoIGlucHV0XCIpO1xuXHRcdH1cblx0XHRpZiAobGFiZWwgPT09IE5MU19OT19SRVNVTFRTKSB7XG5cdFx0XHRyZXR1cm4gc2VhcmNoU3RyaW5nID09PSAnJ1xuXHRcdFx0XHQ/IG5scy5sb2NhbGl6ZSgnYXJpYVNlYXJjaE5vUmVzdWx0RW1wdHknLCBcInswfSBmb3VuZFwiLCBsYWJlbClcblx0XHRcdFx0OiBubHMubG9jYWxpemUoJ2FyaWFTZWFyY2hOb1Jlc3VsdCcsIFwiezB9IGZvdW5kIGZvciAnezF9J1wiLCBsYWJlbCwgc2VhcmNoU3RyaW5nKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCdhcmlhU2VhcmNoTm9SZXN1bHRXaXRoTGluZU51bU5vQ3VycmVudE1hdGNoJywgXCJ7MH0gZm91bmQgZm9yICd7MX0nXCIsIGxhYmVsLCBzZWFyY2hTdHJpbmcpO1xuXHR9XG59XG5cbmV4cG9ydCBjb25zdCBzaW1wbGVGaW5kV2lkZ2V0U2FzaEJvcmRlciA9IHJlZ2lzdGVyQ29sb3IoJ3NpbXBsZUZpbmRXaWRnZXQuc2FzaEJvcmRlcicsIHsgZGFyazogJyM0NTQ1NDUnLCBsaWdodDogJyNDOEM4QzgnLCBoY0Rhcms6ICcjNkZDM0RGJywgaGNMaWdodDogJyMwRjRBODUnIH0sIG5scy5sb2NhbGl6ZSgnc2ltcGxlRmluZFdpZGdldC5zYXNoQm9yZGVyJywgJ0JvcmRlciBjb2xvciBvZiB0aGUgc2FzaCBib3JkZXIuJykpO1xuXG5yZWdpc3RlclRoZW1pbmdQYXJ0aWNpcGFudCgodGhlbWUsIGNvbGxlY3RvcikgPT4ge1xuXHRjb25zdCByZXNpemVCb3JkZXJCYWNrZ3JvdW5kID0gdGhlbWUuZ2V0Q29sb3Ioc2ltcGxlRmluZFdpZGdldFNhc2hCb3JkZXIpO1xuXHRjb2xsZWN0b3IuYWRkUnVsZShgLm1vbmFjby13b3JrYmVuY2ggLnNpbXBsZS1maW5kLXBhcnQgLm1vbmFjby1zYXNoIHsgYmFja2dyb3VuZC1jb2xvcjogJHtyZXNpemVCb3JkZXJCYWNrZ3JvdW5kfTsgYm9yZGVyLWNvbG9yOiAke3Jlc2l6ZUJvcmRlckJhY2tncm91bmR9IH1gKTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTztBQUNQLFlBQVksU0FBUztBQUNyQixZQUFZLFNBQVM7QUFFckIsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsZUFBZTtBQUN4QixTQUFTLGVBQWU7QUFDeEIsU0FBUyx3QkFBOEM7QUFFdkQsU0FBUyxjQUFjLHVCQUF1QixtQkFBbUIsZ0JBQWdCLDRCQUE0QjtBQUc3RyxTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGtDQUFrQztBQUMzQyxZQUFZLGFBQWE7QUFFekIsU0FBUyxpQ0FBaUM7QUFDMUMsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsdUJBQXVCLDJCQUEyQjtBQUMzRCxTQUFrRCxhQUFhLFlBQVk7QUFDM0UsU0FBUyxxQkFBcUI7QUFHOUIsTUFBTSx1QkFBdUIsSUFBSSxTQUFTLGNBQWMsTUFBTTtBQUM5RCxNQUFNLDZCQUE2QixJQUFJLFNBQVMsb0JBQW9CLE1BQU07QUFDMUUsTUFBTSwrQkFBK0IsSUFBSSxTQUFTLDZCQUE2QixnQkFBZ0I7QUFDL0YsTUFBTSwyQkFBMkIsSUFBSSxTQUFTLHlCQUF5QixZQUFZO0FBQ25GLE1BQU0sc0JBQXNCLElBQUksU0FBUyxxQkFBcUIsT0FBTztBQWtCckUsTUFBTSxtQ0FBbUM7QUFDekMsTUFBTSxzQkFBc0I7QUFFckIsTUFBZSx5QkFBeUIsT0FBOEM7QUFBQSxFQWtCNUYsWUFDQyxTQUNBLG9CQUNBLG1CQUNBLGNBQ2lCLG9CQUNoQjtBQUNELFVBQU07QUFGVztBQVhsQixTQUFRLGFBQXNCO0FBQzlCLFNBQVEsY0FBdUI7QUFDL0IsU0FBUSxT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
