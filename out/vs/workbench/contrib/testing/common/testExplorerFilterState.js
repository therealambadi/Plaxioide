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
import { Emitter } from "../../../../base/common/event.js";
import { splitGlobAware } from "../../../../base/common/glob.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../base/common/observable.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { MutableObservableValue } from "./observableValue.js";
import { StoredValue } from "./storedValue.js";
import { namespaceTestTag } from "./testTypes.js";
const ITestExplorerFilterState = createDecorator("testingFilterState");
const tagRe = /!?@([^ ,:]+)/g;
const trimExtraWhitespace = (str) => str.replace(/\s\s+/g, " ").trim();
let TestExplorerFilterState = class extends Disposable {
  constructor(storageService) {
    super();
    this.storageService = storageService;
    this.focusEmitter = new Emitter();
    /**
     * Mapping of terms to whether they're included in the text.
     */
    this.termFilterState = {};
    /** @inheritdoc */
    this.globList = [];
    /** @inheritdoc */
    this.includeTags = /* @__PURE__ */ new Set();
    /** @inheritdoc */
    this.excludeTags = /* @__PURE__ */ new Set();
    /** @inheritdoc */
    this.text = this._register(new MutableObservableValue(""));
    /** @inheritdoc */
    this.fuzzy = this._register(MutableObservableValue.stored(new StoredValue({
      key: "testHistoryFuzzy",
      scope: StorageScope.PROFILE,
      target: StorageTarget.USER
    }, this.storageService), false));
    this.reveal = observableValue("TestExplorerFilterState.reveal", void 0);
    this.onDidRequestInputFocus = this.focusEmitter.event;
    this.selectTestInExplorerEmitter = this._register(new Emitter());
    this.onDidSelectTestInExplorer = this.selectTestInExplorerEmitter.event;
  }
  /** @inheritdoc */
  didSelectTestInExplorer(testId) {
    this.selectTestInExplorerEmitter.fire(testId);
  }
  /** @inheritdoc */
  focusInput() {
    this.focusEmitter.fire();
  }
  /** @inheritdoc */
  setText(text) {
    if (text === this.text.value) {
      return;
    }
    this.termFilterState = {};
    this.globList = [];
    this.includeTags.clear();
    this.excludeTags.clear();
    let globText = "";
    let lastIndex = 0;
    for (const match of text.matchAll(tagRe)) {
      let nextIndex = match.index + match[0].length;
      const tag = match[0];
      if (allTestFilterTerms.includes(tag)) {
        this.termFilterState[tag] = true;
      }
      if (text[nextIndex] === ":") {
        nextIndex++;
        let delimiter = text[nextIndex];
        if (delimiter !== `"` && delimiter !== `'`) {
          delimiter = " ";
        } else {
          nextIndex++;
        }
        let tagId = "";
        while (nextIndex < text.length && text[nextIndex] !== delimiter) {
          if (text[nextIndex] === "\\") {
            tagId += text[nextIndex + 1];
            nextIndex += 2;
          } else {
            tagId += text[nextIndex];
            nextIndex++;
          }
        }
        if (match[0].startsWith("!")) {
          this.excludeTags.add(namespaceTestTag(match[1], tagId));
        } else {
          this.includeTags.add(namespaceTestTag(match[1], tagId));
        }
        nextIndex++;
      }
      globText += text.slice(lastIndex, match.index);
      lastIndex = nextIndex;
    }
    globText += text.slice(lastIndex).trim();
    if (globText.length) {
      for (const filter of splitGlobAware(globText, ",").map((s) => s.trim()).filter((s) => !!s.length)) {
        if (filter.startsWith("!")) {
          this.globList.push({ include: false, text: filter.slice(1).toLowerCase() });
        } else {
          this.globList.push({ include: true, text: filter.toLowerCase() });
        }
      }
    }
    this.text.value = text;
  }
  /** @inheritdoc */
  isFilteringFor(term) {
    return !!this.termFilterState[term];
  }
  /** @inheritdoc */
  toggleFilteringFor(term, shouldFilter) {
    const text = this.text.value.trim();
    if (shouldFilter !== false && !this.termFilterState[term]) {
      this.setText(text ? `${text} ${term}` : term);
    } else if (shouldFilter !== true && this.termFilterState[term]) {
      this.setText(trimExtraWhitespace(text.replace(term, "")));
    }
  }
};
TestExplorerFilterState = __decorateClass([
  __decorateParam(0, IStorageService)
], TestExplorerFilterState);
var TestFilterTerm = /* @__PURE__ */ ((TestFilterTerm2) => {
  TestFilterTerm2["Failed"] = "@failed";
  TestFilterTerm2["Executed"] = "@executed";
  TestFilterTerm2["CurrentDoc"] = "@doc";
  TestFilterTerm2["OpenedFiles"] = "@openedFiles";
  TestFilterTerm2["Hidden"] = "@hidden";
  return TestFilterTerm2;
})(TestFilterTerm || {});
const allTestFilterTerms = [
  "@failed" /* Failed */,
  "@executed" /* Executed */,
  "@doc" /* CurrentDoc */,
  "@openedFiles" /* OpenedFiles */,
  "@hidden" /* Hidden */
];
export {
  ITestExplorerFilterState,
  TestExplorerFilterState,
  TestFilterTerm
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL2NvbW1vbi90ZXN0RXhwbG9yZXJGaWx0ZXJTdGF0ZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IHNwbGl0R2xvYkF3YXJlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZ2xvYi5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElTZXR0YWJsZU9ic2VydmFibGUsIG9ic2VydmFibGVWYWx1ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgY3JlYXRlRGVjb3JhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSU9ic2VydmFibGVWYWx1ZSwgTXV0YWJsZU9ic2VydmFibGVWYWx1ZSB9IGZyb20gJy4vb2JzZXJ2YWJsZVZhbHVlLmpzJztcbmltcG9ydCB7IFN0b3JlZFZhbHVlIH0gZnJvbSAnLi9zdG9yZWRWYWx1ZS5qcyc7XG5pbXBvcnQgeyBuYW1lc3BhY2VUZXN0VGFnIH0gZnJvbSAnLi90ZXN0VHlwZXMuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElUZXN0RXhwbG9yZXJGaWx0ZXJTdGF0ZSB7XG5cdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHQvKiogQ3VycmVudCBmaWx0ZXIgdGV4dCAqL1xuXHRyZWFkb25seSB0ZXh0OiBJT2JzZXJ2YWJsZVZhbHVlPHN0cmluZz47XG5cblx0LyoqIFRlc3QgSUQgdGhlIHVzZXIgd2FudHMgdG8gcmV2ZWFsIGluIHRoZSBleHBsb3JlciAqL1xuXHRyZWFkb25seSByZXZlYWw6IElTZXR0YWJsZU9ic2VydmFibGU8c3RyaW5nIHwgdW5kZWZpbmVkPjtcblxuXHQvKiogQSB0ZXN0IHdhcyBzZWxlY3RlZCBpbiB0aGUgZXhwbG9yZXIuICovXG5cdHJlYWRvbmx5IG9uRGlkU2VsZWN0VGVzdEluRXhwbG9yZXI6IEV2ZW50PHN0cmluZyB8IHVuZGVmaW5lZD47XG5cblx0LyoqIEV2ZW50IHRoYXQgZmlyZXMgd2hlbiB7QGxpbmsgZm9jdXNJbnB1dH0gaXMgaW52b2tlZC4gKi9cblx0cmVhZG9ubHkgb25EaWRSZXF1ZXN0SW5wdXRGb2N1czogRXZlbnQ8dm9pZD47XG5cblx0LyoqXG5cdCAqIEdsb2IgbGlzdCB0byBmaWx0ZXIgZm9yIGJhc2VkIG9uIHRoZSB7QGxpbmsgdGV4dH1cblx0ICovXG5cdHJlYWRvbmx5IGdsb2JMaXN0OiByZWFkb25seSB7IGluY2x1ZGU6IGJvb2xlYW47IHRleHQ6IHN0cmluZyB9W107XG5cblx0LyoqXG5cdCAqIFRoZSB1c2VyIHJlcXVlc3RlZCB0byBmaWx0ZXIgaW5jbHVkaW5nIHRhZ3MuXG5cdCAqL1xuXHRyZWFkb25seSBpbmNsdWRlVGFnczogUmVhZG9ubHlTZXQ8c3RyaW5nPjtcblxuXHQvKipcblx0ICogVGhlIHVzZXIgcmVxdWVzdGVkIHRvIGZpbHRlciBleGNsdWRpbmcgdGFncy5cblx0ICovXG5cdHJlYWRvbmx5IGV4Y2x1ZGVUYWdzOiBSZWFkb25seVNldDxzdHJpbmc+O1xuXG5cdC8qKlxuXHQgKiBXaGV0aGVyIGZ1enp5IHNlYXJjaGluZyBpcyBlbmFibGVkLlxuXHQgKi9cblx0cmVhZG9ubHkgZnV6enk6IE11dGFibGVPYnNlcnZhYmxlVmFsdWU8Ym9vbGVhbj47XG5cblx0LyoqXG5cdCAqIEZvY3VzZXMgdGhlIGZpbHRlciBpbnB1dCBpbiB0aGUgdGVzdCBleHBsb3JlciB2aWV3LlxuXHQgKi9cblx0Zm9jdXNJbnB1dCgpOiB2b2lkO1xuXG5cdC8qKlxuXHQgKiBSZXBsYWNlcyB0aGUgZmlsdGVyIHtAbGluayB0ZXh0fS5cblx0ICovXG5cdHNldFRleHQodGV4dDogc3RyaW5nKTogdm9pZDtcblxuXHQvKipcblx0ICogU2V0cyB3aGV0aGVyIHRoZSB7QGxpbmsgdGV4dH0gaXMgZmlsdGVyaW5nIGZvciBhIHNwZWNpYWwgdGVybS5cblx0ICovXG5cdGlzRmlsdGVyaW5nRm9yKHRlcm06IFRlc3RGaWx0ZXJUZXJtKTogYm9vbGVhbjtcblxuXHQvKipcblx0ICogU2V0cyB3aGV0aGVyIHRoZSB7QGxpbmsgdGV4dH0gaW5jbHVkZXMgYSBzcGVjaWFsIGZpbHRlciB0ZXJtLlxuXHQgKi9cblx0dG9nZ2xlRmlsdGVyaW5nRm9yKHRlcm06IFRlc3RGaWx0ZXJUZXJtLCBzaG91bGRGaWx0ZXI/OiBib29sZWFuKTogdm9pZDtcblxuXHQvKipcblx0ICogQ2FsbGVkIHdoZW4gYSB0ZXN0IGluIHRoZSB0ZXN0IGV4cGxvcmVyIGlzIHNlbGVjdGVkLlxuXHQgKi9cblx0ZGlkU2VsZWN0VGVzdEluRXhwbG9yZXIodGVzdElkOiBzdHJpbmcpOiB2b2lkO1xufVxuXG5leHBvcnQgY29uc3QgSVRlc3RFeHBsb3JlckZpbHRlclN0YXRlID0gY3JlYXRlRGVjb3JhdG9yPElUZXN0RXhwbG9yZXJGaWx0ZXJTdGF0ZT4oJ3Rlc3RpbmdGaWx0ZXJTdGF0ZScpO1xuXG5jb25zdCB0YWdSZSA9IC8hP0AoW14gLDpdKykvZztcbmNvbnN0IHRyaW1FeHRyYVdoaXRlc3BhY2UgPSAoc3RyOiBzdHJpbmcpID0+IHN0ci5yZXBsYWNlKC9cXHNcXHMrL2csICcgJykudHJpbSgpO1xuXG5leHBvcnQgY2xhc3MgVGVzdEV4cGxvcmVyRmlsdGVyU3RhdGUgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVRlc3RFeHBsb3JlckZpbHRlclN0YXRlIHtcblx0ZGVjbGFyZSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgZm9jdXNFbWl0dGVyID0gbmV3IEVtaXR0ZXI8dm9pZD4oKTtcblx0LyoqXG5cdCAqIE1hcHBpbmcgb2YgdGVybXMgdG8gd2hldGhlciB0aGV5J3JlIGluY2x1ZGVkIGluIHRoZSB0ZXh0LlxuXHQgKi9cblx0cHJpdmF0ZSB0ZXJtRmlsdGVyU3RhdGU6IHsgW0sgaW4gVGVzdEZpbHRlclRlcm1dPzogdHJ1ZSB9ID0ge307XG5cblx0LyoqIEBpbmhlcml0ZG9jICovXG5cdHB1YmxpYyBnbG9iTGlzdDogeyBpbmNsdWRlOiBib29sZWFuOyB0ZXh0OiBzdHJpbmcgfVtdID0gW107XG5cblx0LyoqIEBpbmhlcml0ZG9jICovXG5cdHB1YmxpYyBpbmNsdWRlVGFncyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG5cdC8qKiBAaW5oZXJpdGRvYyAqL1xuXHRwdWJsaWMgZXhjbHVkZVRhZ3MgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuXHQvKiogQGluaGVyaXRkb2MgKi9cblx0cHVibGljIHJlYWRvbmx5IHRleHQgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZU9ic2VydmFibGVWYWx1ZSgnJykpO1xuXG5cdC8qKiBAaW5oZXJpdGRvYyAqL1xuXHRwdWJsaWMgcmVhZG9ubHkgZnV6enkgPSB0aGlzLl9yZWdpc3RlcihNdXRhYmxlT2JzZXJ2YWJsZVZhbHVlLnN0b3JlZChuZXcgU3RvcmVkVmFsdWU8Ym9vbGVhbj4oe1xuXHRcdGtleTogJ3Rlc3RIaXN0b3J5RnV6enknLFxuXHRcdHNjb3BlOiBTdG9yYWdlU2NvcGUuUFJPRklMRSxcblx0XHR0YXJnZXQ6IFN0b3JhZ2VUYXJnZXQuVVNFUixcblx0fSwgdGhpcy5zdG9yYWdlU2VydmljZSksIGZhbHNlKSk7XG5cblx0cHVibGljIHJlYWRvbmx5IHJldmVhbDogSVNldHRhYmxlT2JzZXJ2YWJsZTxzdHJpbmcgfCB1bmRlZmluZWQ+ID0gb2JzZXJ2YWJsZVZhbHVlKCdUZXN0RXhwbG9yZXJGaWx0ZXJTdGF0ZS5yZXZlYWwnLCB1bmRlZmluZWQpO1xuXG5cdHB1YmxpYyByZWFkb25seSBvbkRpZFJlcXVlc3RJbnB1dEZvY3VzID0gdGhpcy5mb2N1c0VtaXR0ZXIuZXZlbnQ7XG5cblx0cHJpdmF0ZSBzZWxlY3RUZXN0SW5FeHBsb3JlckVtaXR0ZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxzdHJpbmcgfCB1bmRlZmluZWQ+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRTZWxlY3RUZXN0SW5FeHBsb3JlciA9IHRoaXMuc2VsZWN0VGVzdEluRXhwbG9yZXJFbWl0dGVyLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0LyoqIEBpbmhlcml0ZG9jICovXG5cdHB1YmxpYyBkaWRTZWxlY3RUZXN0SW5FeHBsb3Jlcih0ZXN0SWQ6IHN0cmluZykge1xuXHRcdHRoaXMuc2VsZWN0VGVzdEluRXhwbG9yZXJFbWl0dGVyLmZpcmUodGVzdElkKTtcblx0fVxuXG5cdC8qKiBAaW5oZXJpdGRvYyAqL1xuXHRwdWJsaWMgZm9jdXNJbnB1dCgpIHtcblx0XHR0aGlzLmZvY3VzRW1pdHRlci5maXJlKCk7XG5cdH1cblxuXHQvKiogQGluaGVyaXRkb2MgKi9cblx0cHVibGljIHNldFRleHQodGV4dDogc3RyaW5nKSB7XG5cdFx0aWYgKHRleHQgPT09IHRoaXMudGV4dC52YWx1ZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMudGVybUZpbHRlclN0YXRlID0ge307XG5cdFx0dGhpcy5nbG9iTGlzdCA9IFtdO1xuXHRcdHRoaXMuaW5jbHVkZVRhZ3MuY2xlYXIoKTtcblx0XHR0aGlzLmV4Y2x1ZGVUYWdzLmNsZWFyKCk7XG5cblx0XHRsZXQgZ2xvYlRleHQgPSAnJztcblx0XHRsZXQgbGFzdEluZGV4ID0gMDtcblx0XHRmb3IgKGNvbnN0IG1hdGNoIG9mIHRleHQubWF0Y2hBbGwodGFnUmUpKSB7XG5cdFx0XHRsZXQgbmV4dEluZGV4ID0gbWF0Y2guaW5kZXggKyBtYXRjaFswXS5sZW5ndGg7XG5cblx0XHRcdGNvbnN0IHRhZyA9IG1hdGNoWzBdO1xuXHRcdFx0aWYgKGFsbFRlc3RGaWx0ZXJUZXJtcy5pbmNsdWRlcyh0YWcgYXMgVGVzdEZpbHRlclRlcm0pKSB7XG5cdFx0XHRcdHRoaXMudGVybUZpbHRlclN0YXRlW3RhZyBhcyBUZXN0RmlsdGVyVGVybV0gPSB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyByZWNvZ25pemUgYW5kIHBhcnNlIEBjdHJsSWQ6dGFnSWQgb3IgcXVvdGVkIGxpa2UgQGN0cmxJZDpcInRhZyBcXFxcXCJpZFwiXG5cdFx0XHRpZiAodGV4dFtuZXh0SW5kZXhdID09PSAnOicpIHtcblx0XHRcdFx0bmV4dEluZGV4Kys7XG5cblx0XHRcdFx0bGV0IGRlbGltaXRlciA9IHRleHRbbmV4dEluZGV4XTtcblx0XHRcdFx0aWYgKGRlbGltaXRlciAhPT0gYFwiYCAmJiBkZWxpbWl0ZXIgIT09IGAnYCkge1xuXHRcdFx0XHRcdGRlbGltaXRlciA9ICcgJztcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRuZXh0SW5kZXgrKztcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGxldCB0YWdJZCA9ICcnO1xuXHRcdFx0XHR3aGlsZSAobmV4dEluZGV4IDwgdGV4dC5sZW5ndGggJiYgdGV4dFtuZXh0SW5kZXhdICE9PSBkZWxpbWl0ZXIpIHtcblx0XHRcdFx0XHRpZiAodGV4dFtuZXh0SW5kZXhdID09PSAnXFxcXCcpIHtcblx0XHRcdFx0XHRcdHRhZ0lkICs9IHRleHRbbmV4dEluZGV4ICsgMV07XG5cdFx0XHRcdFx0XHRuZXh0SW5kZXggKz0gMjtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dGFnSWQgKz0gdGV4dFtuZXh0SW5kZXhdO1xuXHRcdFx0XHRcdFx0bmV4dEluZGV4Kys7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKG1hdGNoWzBdLnN0YXJ0c1dpdGgoJyEnKSkge1xuXHRcdFx0XHRcdHRoaXMuZXhjbHVkZVRhZ3MuYWRkKG5hbWVzcGFjZVRlc3RUYWcobWF0Y2hbMV0sIHRhZ0lkKSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5pbmNsdWRlVGFncy5hZGQobmFtZXNwYWNlVGVzdFRhZyhtYXRjaFsxXSwgdGFnSWQpKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRuZXh0SW5kZXgrKztcblx0XHRcdH1cblxuXHRcdFx0Z2xvYlRleHQgKz0gdGV4dC5zbGljZShsYXN0SW5kZXgsIG1hdGNoLmluZGV4KTtcblx0XHRcdGxhc3RJbmRleCA9IG5leHRJbmRleDtcblx0XHR9XG5cblx0XHRnbG9iVGV4dCArPSB0ZXh0LnNsaWNlKGxhc3RJbmRleCkudHJpbSgpO1xuXG5cdFx0aWYgKGdsb2JUZXh0Lmxlbmd0aCkge1xuXHRcdFx0Zm9yIChjb25zdCBmaWx0ZXIgb2Ygc3BsaXRHbG9iQXdhcmUoZ2xvYlRleHQsICcsJykubWFwKHMgPT4gcy50cmltKCkpLmZpbHRlcihzID0+ICEhcy5sZW5ndGgpKSB7XG5cdFx0XHRcdGlmIChmaWx0ZXIuc3RhcnRzV2l0aCgnIScpKSB7XG5cdFx0XHRcdFx0dGhpcy5nbG9iTGlzdC5wdXNoKHsgaW5jbHVkZTogZmFsc2UsIHRleHQ6IGZpbHRlci5zbGljZSgxKS50b0xvd2VyQ2FzZSgpIH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuZ2xvYkxpc3QucHVzaCh7IGluY2x1ZGU6IHRydWUsIHRleHQ6IGZpbHRlci50b0xvd2VyQ2FzZSgpIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy50ZXh0LnZhbHVlID0gdGV4dDsgLy8gcHVycG9zZWx5IGFmdGVyd2FyZHMgc28gZXZlcnl0aGluZyBpcyB1cGRhdGVkIHdoZW4gdGhlIGNoYW5nZSBldmVudCBoYXBwZW5cblx0fVxuXG5cdC8qKiBAaW5oZXJpdGRvYyAqL1xuXHRwdWJsaWMgaXNGaWx0ZXJpbmdGb3IodGVybTogVGVzdEZpbHRlclRlcm0pIHtcblx0XHRyZXR1cm4gISF0aGlzLnRlcm1GaWx0ZXJTdGF0ZVt0ZXJtXTtcblx0fVxuXG5cdC8qKiBAaW5oZXJpdGRvYyAqL1xuXHRwdWJsaWMgdG9nZ2xlRmlsdGVyaW5nRm9yKHRlcm06IFRlc3RGaWx0ZXJUZXJtLCBzaG91bGRGaWx0ZXI/OiBib29sZWFuKSB7XG5cdFx0Y29uc3QgdGV4dCA9IHRoaXMudGV4dC52YWx1ZS50cmltKCk7XG5cdFx0aWYgKHNob3VsZEZpbHRlciAhPT0gZmFsc2UgJiYgIXRoaXMudGVybUZpbHRlclN0YXRlW3Rlcm1dKSB7XG5cdFx0XHR0aGlzLnNldFRleHQodGV4dCA/IGAke3RleHR9ICR7dGVybX1gIDogdGVybSk7XG5cdFx0fSBlbHNlIGlmIChzaG91bGRGaWx0ZXIgIT09IHRydWUgJiYgdGhpcy50ZXJtRmlsdGVyU3RhdGVbdGVybV0pIHtcblx0XHRcdHRoaXMuc2V0VGV4dCh0cmltRXh0cmFXaGl0ZXNwYWNlKHRleHQucmVwbGFjZSh0ZXJtLCAnJykpKTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gVGVzdEZpbHRlclRlcm0ge1xuXHRGYWlsZWQgPSAnQGZhaWxlZCcsXG5cdEV4ZWN1dGVkID0gJ0BleGVjdXRlZCcsXG5cdEN1cnJlbnREb2MgPSAnQGRvYycsXG5cdE9wZW5lZEZpbGVzID0gJ0BvcGVuZWRGaWxlcycsXG5cdEhpZGRlbiA9ICdAaGlkZGVuJyxcbn1cblxuY29uc3QgYWxsVGVzdEZpbHRlclRlcm1zOiByZWFkb25seSBUZXN0RmlsdGVyVGVybVtdID0gW1xuXHRUZXN0RmlsdGVyVGVybS5GYWlsZWQsXG5cdFRlc3RGaWx0ZXJUZXJtLkV4ZWN1dGVkLFxuXHRUZXN0RmlsdGVyVGVybS5DdXJyZW50RG9jLFxuXHRUZXN0RmlsdGVyVGVybS5PcGVuZWRGaWxlcyxcblx0VGVzdEZpbHRlclRlcm0uSGlkZGVuLFxuXTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBSUEsU0FBUyxlQUFzQjtBQUMvQixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGtCQUFrQjtBQUMzQixTQUE4Qix1QkFBdUI7QUFDckQsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxpQkFBaUIsY0FBYyxxQkFBcUI7QUFDN0QsU0FBMkIsOEJBQThCO0FBQ3pELFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsd0JBQXdCO0FBK0QxQixNQUFNLDJCQUEyQixnQkFBMEMsb0JBQW9CO0FBRXRHLE1BQU0sUUFBUTtBQUNkLE1BQU0sc0JBQXNCLENBQUMsUUFBZ0IsSUFBSSxRQUFRLFVBQVUsR0FBRyxFQUFFLEtBQUs7QUFFdEUsSUFBTSwwQkFBTixjQUFzQyxXQUErQztBQUFBLEVBa0MzRixZQUNtQyxnQkFDakM7QUFDRCxVQUFNO0FBRjRCO0FBakNuQyxTQUFpQixlQUFlLElBQUksUUFBYztBQUlsRDtBQUFBO0FBQUE7QUFBQSxTQUFRLGtCQUFvRCxDQUFDO0FBRzdEO0FB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
