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
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { escapeRegExpCharacters } from "../../../../../base/common/strings.js";
import { URI } from "../../../../../base/common/uri.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { matchesScheme } from "../../../../../base/common/network.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { TerminalSettingId } from "../../../../../platform/terminal/common/terminal.js";
import { TerminalBuiltinLinkType } from "./links.js";
import { convertLinkRangeToBuffer, getXtermLineContent } from "./terminalLinkHelpers.js";
import { TERMINAL_CONFIG_SECTION } from "../../../terminal/common/terminal.js";
var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2[Constants2["MaxLineLength"] = 2e3] = "MaxLineLength";
  return Constants2;
})(Constants || {});
let TerminalWordLinkDetector = class extends Disposable {
  constructor(xterm, _configurationService, _productService) {
    super();
    this.xterm = xterm;
    this._configurationService = _configurationService;
    this._productService = _productService;
    // Word links typically search the workspace so it makes sense that their maximum link length is
    // quite small.
    this.maxLinkLength = 100;
    this._refreshSeparatorCodes();
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(TerminalSettingId.WordSeparators)) {
        this._refreshSeparatorCodes();
      }
    }));
  }
  detect(lines, startLine, endLine) {
    const links = [];
    const text = getXtermLineContent(this.xterm.buffer.active, startLine, endLine, this.xterm.cols);
    if (text === "" || text.length > 2e3 /* MaxLineLength */) {
      return [];
    }
    const words = this._parseWords(text);
    for (const word of words) {
      if (word.text === "") {
        continue;
      }
      if (word.text.length > 0 && word.text.charAt(word.text.length - 1) === ":") {
        word.text = word.text.slice(0, -1);
        word.endIndex--;
      }
      const bufferRange = convertLinkRangeToBuffer(
        lines,
        this.xterm.cols,
        {
          startColumn: word.startIndex + 1,
          startLineNumber: 1,
          endColumn: word.endIndex + 1,
          endLineNumber: 1
        },
        startLine
      );
      if (matchesScheme(word.text, this._productService.urlProtocol)) {
        const uri = URI.parse(word.text);
        if (uri) {
          links.push({
            text: word.text,
            uri,
            bufferRange,
            type: TerminalBuiltinLinkType.Url
          });
        }
        continue;
      }
      links.push({
        text: word.text,
        bufferRange,
        type: TerminalBuiltinLinkType.Search,
        contextLine: text
      });
    }
    return links;
  }
  _parseWords(text) {
    const words = [];
    const splitWords = text.split(this._separatorRegex);
    let runningIndex = 0;
    for (let i = 0; i < splitWords.length; i++) {
      words.push({
        text: splitWords[i],
        startIndex: runningIndex,
        endIndex: runningIndex + splitWords[i].length
      });
      runningIndex += splitWords[i].length + 1;
    }
    return words;
  }
  _refreshSeparatorCodes() {
    const separators = this._configurationService.getValue(TERMINAL_CONFIG_SECTION).wordSeparators;
    let powerlineSymbols = "";
    for (let i = 57520; i <= 57535; i++) {
      powerlineSymbols += String.fromCharCode(i);
    }
    this._separatorRegex = new RegExp(`[${escapeRegExpCharacters(separators)}${powerlineSymbols}]`, "g");
  }
};
TerminalWordLinkDetector.id = "word";
TerminalWordLinkDetector = __decorateClass([
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IProductService)
], TerminalWordLinkDetector);
export {
  TerminalWordLinkDetector
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvbGlua3MvYnJvd3Nlci90ZXJtaW5hbFdvcmRMaW5rRGV0ZWN0b3IudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGVzY2FwZVJlZ0V4cENoYXJhY3RlcnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IG1hdGNoZXNTY2hlbWUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFRlcm1pbmFsU2V0dGluZ0lkIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IElUZXJtaW5hbFNpbXBsZUxpbmssIElUZXJtaW5hbExpbmtEZXRlY3RvciwgVGVybWluYWxCdWlsdGluTGlua1R5cGUgfSBmcm9tICcuL2xpbmtzLmpzJztcbmltcG9ydCB7IGNvbnZlcnRMaW5rUmFuZ2VUb0J1ZmZlciwgZ2V0WHRlcm1MaW5lQ29udGVudCB9IGZyb20gJy4vdGVybWluYWxMaW5rSGVscGVycy5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxDb25maWd1cmF0aW9uLCBURVJNSU5BTF9DT05GSUdfU0VDVElPTiB9IGZyb20gJy4uLy4uLy4uL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgdHlwZSB7IElCdWZmZXJMaW5lLCBUZXJtaW5hbCB9IGZyb20gJ0B4dGVybS94dGVybSc7XG5cbmNvbnN0IGVudW0gQ29uc3RhbnRzIHtcblx0LyoqXG5cdCAqIFRoZSBtYXggbGluZSBsZW5ndGggdG8gdHJ5IGV4dHJhY3Qgd29yZCBsaW5rcyBmcm9tLlxuXHQgKi9cblx0TWF4TGluZUxlbmd0aCA9IDIwMDBcbn1cblxuaW50ZXJmYWNlIFdvcmQge1xuXHRzdGFydEluZGV4OiBudW1iZXI7XG5cdGVuZEluZGV4OiBudW1iZXI7XG5cdHRleHQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFRlcm1pbmFsV29yZExpbmtEZXRlY3RvciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJVGVybWluYWxMaW5rRGV0ZWN0b3Ige1xuXHRzdGF0aWMgaWQgPSAnd29yZCc7XG5cblx0Ly8gV29yZCBsaW5rcyB0eXBpY2FsbHkgc2VhcmNoIHRoZSB3b3Jrc3BhY2Ugc28gaXQgbWFrZXMgc2Vuc2UgdGhhdCB0aGVpciBtYXhpbXVtIGxpbmsgbGVuZ3RoIGlzXG5cdC8vIHF1aXRlIHNtYWxsLlxuXHRyZWFkb25seSBtYXhMaW5rTGVuZ3RoID0gMTAwO1xuXG5cdHByaXZhdGUgX3NlcGFyYXRvclJlZ2V4ITogUmVnRXhwO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IHh0ZXJtOiBUZXJtaW5hbCxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9wcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fcmVmcmVzaFNlcGFyYXRvckNvZGVzKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oVGVybWluYWxTZXR0aW5nSWQuV29yZFNlcGFyYXRvcnMpKSB7XG5cdFx0XHRcdHRoaXMuX3JlZnJlc2hTZXBhcmF0b3JDb2RlcygpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdGRldGVjdChsaW5lczogSUJ1ZmZlckxpbmVbXSwgc3RhcnRMaW5lOiBudW1iZXIsIGVuZExpbmU6IG51bWJlcik6IElUZXJtaW5hbFNpbXBsZUxpbmtbXSB7XG5cdFx0Y29uc3QgbGlua3M6IElUZXJtaW5hbFNpbXBsZUxpbmtbXSA9IFtdO1xuXG5cdFx0Ly8gR2V0IHRoZSB0ZXh0IHJlcHJlc2VudGF0aW9uIG9mIHRoZSB3cmFwcGVkIGxpbmVcblx0XHRjb25zdCB0ZXh0ID0gZ2V0WHRlcm1MaW5lQ29udGVudCh0aGlzLnh0ZXJtLmJ1ZmZlci5hY3RpdmUsIHN0YXJ0TGluZSwgZW5kTGluZSwgdGhpcy54dGVybS5jb2xzKTtcblx0XHRpZiAodGV4dCA9PT0gJycgfHwgdGV4dC5sZW5ndGggPiBDb25zdGFudHMuTWF4TGluZUxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdC8vIFBhcnNlIG91dCBhbGwgd29yZHMgZnJvbSB0aGUgd3JhcHBlZCBsaW5lXG5cdFx0Y29uc3Qgd29yZHM6IFdvcmRbXSA9IHRoaXMuX3BhcnNlV29yZHModGV4dCk7XG5cblx0XHQvLyBNYXAgdGhlIHdvcmRzIHRvIElUZXJtaW5hbExpbmsgb2JqZWN0c1xuXHRcdGZvciAoY29uc3Qgd29yZCBvZiB3b3Jkcykge1xuXHRcdFx0aWYgKHdvcmQudGV4dCA9PT0gJycpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAod29yZC50ZXh0Lmxlbmd0aCA+IDAgJiYgd29yZC50ZXh0LmNoYXJBdCh3b3JkLnRleHQubGVuZ3RoIC0gMSkgPT09ICc6Jykge1xuXHRcdFx0XHR3b3JkLnRleHQgPSB3b3JkLnRleHQuc2xpY2UoMCwgLTEpO1xuXHRcdFx0XHR3b3JkLmVuZEluZGV4LS07XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBidWZmZXJSYW5nZSA9IGNvbnZlcnRMaW5rUmFuZ2VUb0J1ZmZlcihcblx0XHRcdFx0bGluZXMsXG5cdFx0XHRcdHRoaXMueHRlcm0uY29scyxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHN0YXJ0Q29sdW1uOiB3b3JkLnN0YXJ0SW5kZXggKyAxLFxuXHRcdFx0XHRcdHN0YXJ0TGluZU51bWJlcjogMSxcblx0XHRcdFx0XHRlbmRDb2x1bW46IHdvcmQuZW5kSW5kZXggKyAxLFxuXHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IDFcblx0XHRcdFx0fSxcblx0XHRcdFx0c3RhcnRMaW5lXG5cdFx0XHQpO1xuXG5cdFx0XHQvLyBTdXBwb3J0IHRoaXMgcHJvZHVjdCdzIFVSTCBwcm90b2NvbFxuXHRcdFx0aWYgKG1hdGNoZXNTY2hlbWUod29yZC50ZXh0LCB0aGlzLl9wcm9kdWN0U2VydmljZS51cmxQcm90b2NvbCkpIHtcblx0XHRcdFx0Y29uc3QgdXJpID0gVVJJLnBhcnNlKHdvcmQudGV4dCk7XG5cdFx0XHRcdGlmICh1cmkpIHtcblx0XHRcdFx0XHRsaW5rcy5wdXNoKHtcblx0XHRcdFx0XHRcdHRleHQ6IHdvcmQudGV4dCxcblx0XHRcdFx0XHRcdHVyaSxcblx0XHRcdFx0XHRcdGJ1ZmZlclJhbmdlLFxuXHRcdFx0XHRcdFx0dHlwZTogVGVybWluYWxCdWlsdGluTGlua1R5cGUuVXJsXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFNlYXJjaCBsaW5rc1xuXHRcdFx0bGlua3MucHVzaCh7XG5cdFx0XHRcdHRleHQ6IHdvcmQudGV4dCxcblx0XHRcdFx0YnVmZmVyUmFuZ2UsXG5cdFx0XHRcdHR5cGU6IFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlLlNlYXJjaCxcblx0XHRcdFx0Y29udGV4dExpbmU6IHRleHRcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiBsaW5rcztcblx0fVxuXG5cdHByaXZhdGUgX3BhcnNlV29yZHModGV4dDogc3RyaW5nKTogV29yZFtdIHtcblx0XHRjb25zdCB3b3JkczogV29yZFtdID0gW107XG5cdFx0Y29uc3Qgc3BsaXRXb3JkcyA9IHRleHQuc3BsaXQodGhpcy5fc2VwYXJhdG9yUmVnZXgpO1xuXHRcdGxldCBydW5uaW5nSW5kZXggPSAwO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgc3BsaXRXb3Jkcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0d29yZHMucHVzaCh7XG5cdFx0XHRcdHRleHQ6IHNwbGl0V29yZHNbaV0sXG5cdFx0XHRcdHN0YXJ0SW5kZXg6IHJ1bm5pbmdJbmRleCxcblx0XHRcdFx0ZW5kSW5kZXg6IHJ1bm5pbmdJbmRleCArIHNwbGl0V29yZHNbaV0ubGVuZ3RoXG5cdFx0XHR9KTtcblx0XHRcdHJ1bm5pbmdJbmRleCArPSBzcGxpdFdvcmRzW2ldLmxlbmd0aCArIDE7XG5cdFx0fVxuXHRcdHJldHVybiB3b3Jkcztcblx0fVxuXG5cdHByaXZhdGUgX3JlZnJlc2hTZXBhcmF0b3JDb2RlcygpOiB2b2lkIHtcblx0XHRjb25zdCBzZXBhcmF0b3JzID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SVRlcm1pbmFsQ29uZmlndXJhdGlvbj4oVEVSTUlOQUxfQ09ORklHX1NFQ1RJT04pLndvcmRTZXBhcmF0b3JzO1xuXHRcdGxldCBwb3dlcmxpbmVTeW1ib2xzID0gJyc7XG5cdFx0Zm9yIChsZXQgaSA9IDB4ZTBiMDsgaSA8PSAweGUwYmY7IGkrKykge1xuXHRcdFx0cG93ZXJsaW5lU3ltYm9scyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGkpO1xuXHRcdH1cblx0XHR0aGlzLl9zZXBhcmF0b3JSZWdleCA9IG5ldyBSZWdFeHAoYFske2VzY2FwZVJlZ0V4cENoYXJhY3RlcnMoc2VwYXJhdG9ycyl9JHtwb3dlcmxpbmVTeW1ib2xzfV1gLCAnZycpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsV0FBVztBQUNwQixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFxRCwrQkFBK0I7QUFDcEYsU0FBUywwQkFBMEIsMkJBQTJCO0FBQzlELFNBQWlDLCtCQUErQjtBQUdoRSxJQUFXLFlBQVgsa0JBQVdBLGVBQVg7QUFJQyxFQUFBQSxzQkFBQSxtQkFBZ0IsT0FBaEI7QUFKVSxTQUFBQTtBQUFBLEdBQUE7QUFhSixJQUFNLDJCQUFOLGNBQXVDLFdBQTRDO0FBQUEsRUFTekYsWUFDVSxPQUMrQix1QkFDTixpQkFDakM7QUFDRCxVQUFNO0FBSkc7QUFDK0I7QUFDTjtB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
