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
import assert from "assert";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { FontStyle, MetadataConsts } from "../../../common/encodedTokenAttributes.js";
import { EncodedTokenizationResult, TokenizationRegistry } from "../../../common/languages.js";
import { ILanguageService } from "../../../common/languages/language.js";
import { _tokenizeToString, tokenizeLineToHTML } from "../../../common/languages/textToHtmlTokenizer.js";
import { LanguageIdCodec } from "../../../common/services/languagesRegistry.js";
import { TestLineToken, TestLineTokens } from "../core/testLineToken.js";
import { createModelServices } from "../testTextModel.js";
suite("Editor Modes - textToHtmlTokenizer", () => {
  let disposables;
  let instantiationService;
  setup(() => {
    disposables = new DisposableStore();
    instantiationService = createModelServices(disposables);
  });
  teardown(() => {
    disposables.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  function toStr(pieces) {
    const resultArr = pieces.map((t) => `<span class="${t.className}">${t.text}</span>`);
    return resultArr.join("");
  }
  test("TextToHtmlTokenizer 1", () => {
    const mode = disposables.add(instantiationService.createInstance(Mode));
    const support = TokenizationRegistry.get(mode.languageId);
    const actual = _tokenizeToString(".abc..def...gh", new LanguageIdCodec(), support);
    const expected = [
      { className: "mtk7", text: "." },
      { className: "mtk9", text: "abc" },
      { className: "mtk7", text: ".." },
      { className: "mtk9", text: "def" },
      { className: "mtk7", text: "..." },
      { className: "mtk9", text: "gh" }
    ];
    const expectedStr = `<div class="monaco-tokenized-source">${toStr(expected)}</div>`;
    assert.strictEqual(actual, expectedStr);
  });
  test("TextToHtmlTokenizer 2", () => {
    const mode = disposables.add(instantiationService.createInstance(Mode));
    const support = TokenizationRegistry.get(mode.languageId);
    const actual = _tokenizeToString(".abc..def...gh\n.abc..def...gh", new LanguageIdCodec(), support);
    const expected1 = [
      { className: "mtk7", text: "." },
      { className: "mtk9", text: "abc" },
      { className: "mtk7", text: ".." },
      { className: "mtk9", text: "def" },
      { className: "mtk7", text: "..." },
      { className: "mtk9", text: "gh" }
    ];
    const expected2 = [
      { className: "mtk7", text: "." },
      { className: "mtk9", text: "abc" },
      { className: "mtk7", text: ".." },
      { className: "mtk9", text: "def" },
      { className: "mtk7", text: "..." },
      { className: "mtk9", text: "gh" }
    ];
    const expectedStr1 = toStr(expected1);
    const expectedStr2 = toStr(expected2);
    const expectedStr = `<div class="monaco-tokenized-source">${expectedStr1}<br/>${expectedStr2}</div>`;
    assert.strictEqual(actual, expectedStr);
  });
  test("tokenizeLineToHTML", () => {
    const text = "Ciao hello world!";
    const lineTokens = new TestLineTokens([
      new TestLineToken(
        4,
        (3 << MetadataConsts.FOREGROUND_OFFSET | (FontStyle.Bold | FontStyle.Italic) << MetadataConsts.FONT_STYLE_OFFSET) >>> 0
      ),
      new TestLineToken(
        5,
        1 << MetadataConsts.FOREGROUND_OFFSET >>> 0
      ),
      new TestLineToken(
        10,
        4 << MetadataConsts.FOREGROUND_OFFSET >>> 0
      ),
      new TestLineToken(
        11,
        1 << MetadataConsts.FOREGROUND_OFFSET >>> 0
      ),
      new TestLineToken(
        17,
        (5 << MetadataConsts.FOREGROUND_OFFSET | FontStyle.Underline << MetadataConsts.FONT_STYLE_OFFSET) >>> 0
      )
    ]);
    const colorMap = [null, "#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff"];
    assert.strictEqual(
      tokenizeLineToHTML(text, lineTokens, colorMap, 0, 17, 4, true),
      [
        "<div>",
        '<span style="color: #ff0000;font-style: italic;font-weight: bold;">Ciao</span>',
        '<span style="color: #000000;"> </span>',
        '<span style="color: #00ff00;">hello</span>',
        '<span style="color: #000000;"> </span>',
        '<span style="color: #0000ff;text-decoration: underline;">world!</span>',
        "</div>"
      ].join("")
    );
    assert.strictEqual(
      tokenizeLineToHTML(text, lineTokens, colorMap, 0, 12, 4, true),
      [
        "<div>",
        '<span style="color: #ff0000;font-style: italic;font-weight: bold;">Ciao</span>',
        '<span style="color: #000000;"> </span>',
        '<span style="color: #00ff00;">hello</span>',
        '<span style="color: #000000;"> </span>',
        '<span style="color: #0000ff;text-decoration: underline;">w</span>',
        "</div>"
      ].join("")
    );
    assert.strictEqual(
      tokenizeLineToHTML(text, lineTokens, colorMap, 0, 11, 4, true),
      [
        "<div>",
        '<span style="color: #ff0000;font-style: italic;font-weight: bold;">Ciao</span>',
        '<span style="color: #000000;"> </span>',
        '<span style="color: #00ff00;">hello</span>',
        '<span style="color: #000000;"> </span>',
        "</div>"
      ].join("")
    );
    assert.strictEqual(
      tokenizeLineToHTML(text, lineTokens, colorMap, 1, 11, 4, true),
      [
        "<div>",
        '<span style="color: #ff0000;font-style: italic;font-weight: bold;">iao</span>',
        '<span style="color: #000000;"> </span>',
        '<span style="color: #00ff00;">hello</span>',
        '<span style="color: #000000;"> </span>',
        "</div>"
      ].join("")
    );
    assert.strictEqual(
      tokenizeLineToHTML(text, lineTokens, colorMap, 4, 11, 4, true),
      [
        "<div>",
        '<span style="color: #000000;">&#160;</span>',
        '<span style="color: #00ff00;">hello</span>',
        '<span style="color: #000000;"> </span>',
        "</div>"
      ].join("")
    );
    assert.strictEqual(
      tokenizeLineToHTML(text, lineTokens, colorMap, 5, 11, 4, true),
      [
        "<div>",
        '<span style="color: #00ff00;">hello</span>',
        '<span style="color: #000000;"> </span>',
        "</div>"
      ].join("")
    );
    assert.strictEqual(
      tokenizeLineToHTML(text, lineTokens, colorMap, 5, 10, 4, true),
      [
        "<div>",
        '<span style="color: #00ff00;">hello</span>',
        "</div>"
      ].join("")
    );
    assert.strictEqual(
      tokenizeLineToHTML(text, lineTokens, colorMap, 6, 9, 4, true),
      [
        "<div>",
        '<span style="color: #00ff00;">ell</span>',
        "</div>"
      ].join("")
    );
  });
  test("tokenizeLineToHTML handle spaces #35954", () => {
    const text = "  Ciao   hello world!";
    const lineTokens = new TestLineTokens([
      new TestLineToken(
        2,
        1 << MetadataConsts.FOREGROUND_OFFSET >>> 0
      ),
      new TestLineToken(
        6,
        (3 << MetadataConsts.FOREGROUND_OFFSET | (FontStyle.Bold | FontStyle.Italic) << MetadataConsts.FONT_STYLE_OFFSET) >>> 0
      ),
      new TestLineToken(
        9,
        1 << MetadataConsts.FOREGROUND_OFFSET >>> 0
      ),
      new TestLineToken(
        14,
        4 << MetadataConsts.FOREGROUND_OFFSET >>> 0
      ),
      new TestLineToken(
        15,
        1 << MetadataConsts.FOREGROUND_OFFSET >>> 0
      ),
      new TestLineToken(
        21,
        (5 << MetadataConsts.FOREGROUND_OFFSET | FontStyle.Underline << MetadataConsts.FONT_STYLE_OFFSET) >>> 0
      )
    ]);
    const colorMap = [null, "#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff"];
    assert.strictEqual(
      tokenizeLineToHTML(text, lineTokens, colorMap, 0, 21, 4, true),
      [
        "<div>",
        '<span style="color: #000000;">&#160; </span>',
        '<span style="color: #ff0000;font-style: italic;font-weight: bold;">Ciao</span>',
        '<span style="color: #000000;"> &#160; </span>',
        '<span style="color: #00ff00;">hello</span>',
        '<span style="color: #000000;"> </span>',
        '<span style="color: #0000ff;text-decoration: underline;">world!</span>',
        "</div>"
      ].join("")
    );
    assert.strictEqual(
      tokenizeLineToHTML(text, lineTokens, colorMap, 0, 17, 4, true),
      [
        "<div>",
        '<span style="color: #000000;">&#160; </span>',
        '<span style="color: #ff0000;font-style: italic;font-weight: bold;">Ciao</span>',
        '<span style="color: #000000;"> &#160; </span>',
        '<span style="color: #00ff00;">hello</span>',
        '<span style="color: #000000;"> </span>',
        '<span style="color: #0000ff;text-decoration: underline;">wo</span>',
        "</div>"
      ].join("")
    );
    assert.strictEqual(
      tokenizeLineToHTML(text, lineTokens, colorMap, 0, 3, 4, true),
      [
        "<div>",
        '<span style="color: #000000;">&#160; </span>',
        '<span style="color: #ff0000;font-style: italic;font-weight: bold;">C</span>',
        "</div>"
      ].join("")
    );
  });
});
let Mode = class extends Disposable {
  constructor(languageService) {
    super();
    this.languageId = "textToHtmlTokenizerMode";
    this._register(languageService.registerLanguage({ id: this.languageId }));
    this._register(TokenizationRegistry.register(this.languageId, {
      getInitialState: () => null,
      tokenize: void 0,
      tokenizeEncoded: (line, hasEOL, state) => {
        const tokensArr = [];
        let prevColor = -1;
        for (let i = 0; i < line.length; i++) {
          const colorId = line.charAt(i) === "." ? 7 : 9;
          if (prevColor !== colorId) {
            tokensArr.push(i);
            tokensArr.push(colorId << MetadataConsts.FOREGROUND_OFFSET >>> 0);
          }
          prevColor = colorId;
        }
        const tokens = new Uint32Array(tokensArr.length);
        for (let i = 0; i < tokens.length; i++) {
          tokens[i] = tokensArr[i];
        }
        return new EncodedTokenizationResult(tokens, null);
      }
    }));
  }
};
Mode = __decorateClass([
  __decorateParam(0, ILanguageService)
], Mode);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vbW9kZXMvdGV4dFRvSHRtbFRva2VuaXplci50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgQ29sb3JJZCwgRm9udFN0eWxlLCBNZXRhZGF0YUNvbnN0cyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lbmNvZGVkVG9rZW5BdHRyaWJ1dGVzLmpzJztcbmltcG9ydCB7IEVuY29kZWRUb2tlbml6YXRpb25SZXN1bHQsIElTdGF0ZSwgVG9rZW5pemF0aW9uUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IF90b2tlbml6ZVRvU3RyaW5nLCB0b2tlbml6ZUxpbmVUb0hUTUwgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL3RleHRUb0h0bWxUb2tlbml6ZXIuanMnO1xuaW1wb3J0IHsgTGFuZ3VhZ2VJZENvZGVjIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFRlc3RMaW5lVG9rZW4sIFRlc3RMaW5lVG9rZW5zIH0gZnJvbSAnLi4vY29yZS90ZXN0TGluZVRva2VuLmpzJztcbmltcG9ydCB7IGNyZWF0ZU1vZGVsU2VydmljZXMgfSBmcm9tICcuLi90ZXN0VGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vdGVzdC9jb21tb24vaW5zdGFudGlhdGlvblNlcnZpY2VNb2NrLmpzJztcblxuc3VpdGUoJ0VkaXRvciBNb2RlcyAtIHRleHRUb0h0bWxUb2tlbml6ZXInLCAoKSA9PiB7XG5cblx0bGV0IGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdGxldCBpbnN0YW50aWF0aW9uU2VydmljZTogVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXG5cdHNldHVwKCgpID0+IHtcblx0XHRkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZSA9IGNyZWF0ZU1vZGVsU2VydmljZXMoZGlzcG9zYWJsZXMpO1xuXHR9KTtcblxuXHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRmdW5jdGlvbiB0b1N0cihwaWVjZXM6IHsgY2xhc3NOYW1lOiBzdHJpbmc7IHRleHQ6IHN0cmluZyB9W10pOiBzdHJpbmcge1xuXHRcdGNvbnN0IHJlc3VsdEFyciA9IHBpZWNlcy5tYXAoKHQpID0+IGA8c3BhbiBjbGFzcz1cIiR7dC5jbGFzc05hbWV9XCI+JHt0LnRleHR9PC9zcGFuPmApO1xuXHRcdHJldHVybiByZXN1bHRBcnIuam9pbignJyk7XG5cdH1cblxuXHR0ZXN0KCdUZXh0VG9IdG1sVG9rZW5pemVyIDEnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZSA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNb2RlKSk7XG5cdFx0Y29uc3Qgc3VwcG9ydCA9IFRva2VuaXphdGlvblJlZ2lzdHJ5LmdldChtb2RlLmxhbmd1YWdlSWQpITtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IF90b2tlbml6ZVRvU3RyaW5nKCcuYWJjLi5kZWYuLi5naCcsIG5ldyBMYW5ndWFnZUlkQ29kZWMoKSwgc3VwcG9ydCk7XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBbXG5cdFx0XHR7IGNsYXNzTmFtZTogJ210azcnLCB0ZXh0OiAnLicgfSxcblx0XHRcdHsgY2xhc3NOYW1lOiAnbXRrOScsIHRleHQ6ICdhYmMnIH0sXG5cdFx0XHR7IGNsYXNzTmFtZTogJ210azcnLCB0ZXh0OiAnLi4nIH0sXG5cdFx0XHR7IGNsYXNzTmFtZTogJ210azknLCB0ZXh0OiAnZGVmJyB9LFxuXHRcdFx0eyBjbGFzc05hbWU6ICdtdGs3JywgdGV4dDogJy4uLicgfSxcblx0XHRcdHsgY2xhc3NOYW1lOiAnbXRrOScsIHRleHQ6ICdnaCcgfSxcblx0XHRdO1xuXHRcdGNvbnN0IGV4cGVjdGVkU3RyID0gYDxkaXYgY2xhc3M9XCJtb25hY28tdG9rZW5pemVkLXNvdXJjZVwiPiR7dG9TdHIoZXhwZWN0ZWQpfTwvZGl2PmA7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLCBleHBlY3RlZFN0cik7XG5cdH0pO1xuXG5cdHRlc3QoJ1RleHRUb0h0bWxUb2tlbml6ZXIgMicsICgpID0+IHtcblx0XHRjb25zdCBtb2RlID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1vZGUpKTtcblx0XHRjb25zdCBzdXBwb3J0ID0gVG9rZW5pemF0aW9uUmVnaXN0cnkuZ2V0KG1vZGUubGFuZ3VhZ2VJZCkhO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gX3Rva2VuaXplVG9TdHJpbmcoJy5hYmMuLmRlZi4uLmdoXFxuLmFiYy4uZGVmLi4uZ2gnLCBuZXcgTGFuZ3VhZ2VJZENvZGVjKCksIHN1cHBvcnQpO1xuXHRcdGNvbnN0IGV4cGVjdGVkMSA9IFtcblx0XHRcdHsgY2xhc3NOYW1lOiAnbXRrNycsIHRleHQ6ICcuJyB9LFxuXHRcdFx0eyBjbGFzc05hbWU6ICdtdGs5JywgdGV4dDogJ2FiYycgfSxcblx0XHRcdHsgY2xhc3NOYW1lOiAnbXRrNycsIHRleHQ6ICcuLicgfSxcblx0XHRcdHsgY2xhc3NOYW1lOiAnbXRrOScsIHRleHQ6ICdkZWYnIH0sXG5cdFx0XHR7IGNsYXNzTmFtZTogJ210azcnLCB0ZXh0OiAnLi4uJyB9LFxuXHRcdFx0eyBjbGFzc05hbWU6ICdtdGs5JywgdGV4dDogJ2doJyB9LFxuXHRcdF07XG5cdFx0Y29uc3QgZXhwZWN0ZWQyID0gW1xuXHRcdFx0eyBjbGFzc05hbWU6ICdtdGs3JywgdGV4dDogJy4nIH0sXG5cdFx0XHR7IGNsYXNzTmFtZTogJ210azknLCB0ZXh0OiAnYWJjJyB9LFxuXHRcdFx0eyBjbGFzc05hbWU6ICdtdGs3JywgdGV4dDogJy4uJyB9LFxuXHRcdFx0eyBjbGFzc05hbWU6ICdtdGs5JywgdGV4dDogJ2RlZicgfSxcblx0XHRcdHsgY2xhc3NOYW1lOiAnbXRrNycsIHRleHQ6ICcuLi4nIH0sXG5cdFx0XHR7IGNsYXNzTmFtZTogJ210azknLCB0ZXh0OiAnZ2gnIH0sXG5cdFx0XTtcblx0XHRjb25zdCBleHBlY3RlZFN0cjEgPSB0b1N0cihleHBlY3RlZDEpO1xuXHRcdGNvbnN0IGV4cGVjdGVkU3RyMiA9IHRvU3RyKGV4cGVjdGVkMik7XG5cdFx0Y29uc3QgZXhwZWN0ZWRTdHIgPSBgPGRpdiBjbGFzcz1cIm1vbmFjby10b2tlbml6ZWQtc291cmNlXCI+JHtleHBlY3RlZFN0cjF9PGJyLz4ke2V4cGVjdGVkU3RyMn08L2Rpdj5gO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWRTdHIpO1xuXHR9KTtcblxuXHR0ZXN0KCd0b2tlbml6ZUxpbmVUb0hUTUwnLCAoKSA9PiB7XG5cdFx0Y29uc3QgdGV4dCA9ICdDaWFvIGhlbGxvIHdvcmxkISc7XG5cdFx0Y29uc3QgbGluZVRva2VucyA9IG5ldyBUZXN0TGluZVRva2VucyhbXG5cdFx0XHRuZXcgVGVzdExpbmVUb2tlbihcblx0XHRcdFx0NCxcblx0XHRcdFx0KFxuXHRcdFx0XHRcdCgzIDw8IE1ldGFkYXRhQ29uc3RzLkZPUkVHUk9VTkRfT0ZGU0VUKVxuXHRcdFx0XHRcdHwgKChGb250U3R5bGUuQm9sZCB8IEZvbnRTdHlsZS5JdGFsaWMpIDw8IE1ldGFkYXRhQ29uc3RzLkZPTlRfU1RZTEVfT0ZGU0VUKVxuXHRcdFx0XHQpID4+PiAwXG5cdFx0XHQpLFxuXHRcdFx0bmV3IFRlc3RMaW5lVG9rZW4oXG5cdFx0XHRcdDUsXG5cdFx0XHRcdChcblx0XHRcdFx0XHQoMSA8PCBNZXRhZGF0YUNvbnN0cy5GT1JFR1JPVU5EX09GRlNFVClcblx0XHRcdFx0KSA+Pj4gMFxuXHRcdFx0KSxcblx0XHRcdG5ldyBUZXN0TGluZVRva2VuKFxuXHRcdFx0XHQxMCxcblx0XHRcdFx0KFxuXHRcdFx0XHRcdCg0IDw8IE1ldGFkYXRhQ29uc3RzLkZPUkVHUk9VTkRfT0ZGU0VUKVxuXHRcdFx0XHQpID4+PiAwXG5cdFx0XHQpLFxuXHRcdFx0bmV3IFRlc3RMaW5lVG9rZW4oXG5cdFx0XHRcdDExLFxuXHRcdFx0XHQoXG5cdFx0XHRcdFx0KDEgPDwgTWV0YWRhdGFDb25zdHMuRk9SRUdST1VORF9PRkZTRVQpXG5cdFx0XHRcdCkgPj4+IDBcblx0XHRcdCksXG5cdFx0XHRuZXcgVGVzdExpbmVUb2tlbihcblx0XHRcdFx0MTcsXG5cdFx0XHRcdChcblx0XHRcdFx0XHQoNSA8PCBNZXRhZGF0YUNvbnN0cy5GT1JFR1JPVU5EX09GRlNFVClcblx0XHRcdFx0XHR8ICgoRm9udFN0eWxlLlVuZGVybGluZSkgPDwgTWV0YWRhdGFDb25zdHMuRk9OVF9TVFlMRV9PRkZTRVQpXG5cdFx0XHRcdCkgPj4+IDBcblx0XHRcdClcblx0XHRdKTtcblx0XHRjb25zdCBjb2xvck1hcCA9IFtudWxsISwgJyMwMDAwMDAnLCAnI2ZmZmZmZicsICcjZmYwMDAwJywgJyMwMGZmMDAnLCAnIzAwMDBmZiddO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0dG9rZW5pemVMaW5lVG9IVE1MKHRleHQsIGxpbmVUb2tlbnMsIGNvbG9yTWFwLCAwLCAxNywgNCwgdHJ1ZSksXG5cdFx0XHRbXG5cdFx0XHRcdCc8ZGl2PicsXG5cdFx0XHRcdCc8c3BhbiBzdHlsZT1cImNvbG9yOiAjZmYwMDAwO2ZvbnQtc3R5bGU6IGl0YWxpYztmb250LXdlaWdodDogYm9sZDtcIj5DaWFvPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBzdHlsZT1cImNvbG9yOiAjMDAwMDAwO1wiPiA8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIHN0eWxlPVwiY29sb3I6ICMwMGZmMDA7XCI+aGVsbG88L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIHN0eWxlPVwiY29sb3I6ICMwMDAwMDA7XCI+IDwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gc3R5bGU9XCJjb2xvcjogIzAwMDBmZjt0ZXh0LWRlY29yYXRpb246IHVuZGVybGluZTtcIj53b3JsZCE8L3NwYW4+Jyxcblx0XHRcdFx0JzwvZGl2Pidcblx0XHRcdF0uam9pbignJylcblx0XHQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0dG9rZW5pemVMaW5lVG9IVE1MKHRleHQsIGxpbmVUb2tlbnMsIGNvbG9yTWFwLCAwLCAxMiwgNCwgdHJ1ZSksXG5cdFx0XHRbXG5cdFx0XHRcdCc8ZGl2PicsXG5cdFx0XHRcdCc8c3BhbiBzdHlsZT1cImNvbG9yOiAjZmYwMDAwO2ZvbnQtc3R5bGU6IGl0YWxpYztmb250LXdlaWdodDogYm9sZDtcIj5DaWFvPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBzdHlsZT1cImNvbG9yOiAjMDAwMDAwO1wiPiA8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIHN0eWxlPVwiY29sb3I6ICMwMGZmMDA7XCI+aGVsbG88L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIHN0eWxlPVwiY29sb3I6ICMwMDAwMDA7XCI+IDwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gc3R5bGU9XCJjb2xvcjogIzAwMDBmZjt0ZXh0LWRlY29yYXRpb246IHVuZGVybGluZTtcIj53PC9zcGFuPicsXG5cdFx0XHRcdCc8L2Rpdj4nXG5cdFx0XHRdLmpvaW4oJycpXG5cdFx0KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdHRva2VuaXplTGluZVRvSFRNTCh0ZXh0LCBsaW5lVG9rZW5zLCBjb2xvck1hcCwgMCwgMTEsIDQsIHRydWUpLFxuXHRcdFx0W1xuXHRcdFx0XHQnPGRpdj4nLFxuXHRcdFx0XHQnPHNwYW4gc3R5bGU9XCJjb2xvcjogI2ZmMDAwMDtmb250LXN0eWxlOiBpdGFsaWM7Zm9udC13ZWlnaHQ6IGJvbGQ7XCI+Q2lhbzwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gc3R5bGU9XCJjb2xvcjogIzAwMDAwMDtcIj4gPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBzdHlsZT1cImNvbG9yOiAjMDBmZjAwO1wiPmhlbGxvPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBzdHlsZT1cImNvbG9yOiAjMDAwMDAwO1wiPiA8L3NwYW4+Jyxcblx0XHRcdFx0JzwvZGl2Pidcblx0XHRcdF0uam9pbignJylcblx0XHQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0dG9rZW5pemVMaW5lVG9IVE1MKHRleHQsIGxpbmVUb2tlbnMsIGNvbG9yTWFwLCAxLCAxMSwgNCwgdHJ1ZSksXG5cdFx0XHRbXG5cdFx0XHRcdCc8ZGl2PicsXG5cdFx0XHRcdCc8c3BhbiBzdHlsZT1cImNvbG9yOiAjZmYwMDAwO2ZvbnQtc3R5bGU6IGl0YWxpYztmb250LXdlaWdodDogYm9sZDtcIj5pYW88L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIHN0eWxlPVwiY29sb3I6ICMwMDAwMDA7XCI+IDwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gc3R5bGU9XCJjb2xvcjogIzAwZmYwMDtcIj5oZWxsbzwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gc3R5bGU9XCJjb2xvcjogIzAwMDAwMDtcIj4gPC9zcGFuPicsXG5cdFx0XHRcdCc8L2Rpdj4nXG5cdFx0XHRdLmpvaW4oJycpXG5cdFx0KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdHRva2VuaXplTGluZVRvSFRNTCh0ZXh0LCBsaW5lVG9rZW5zLCBjb2xvck1hcCwgNCwgMTEsIDQsIHRydWUpLFxuXHRcdFx0W1xuXHRcdFx0XHQnPGRpdj4nLFxuXHRcdFx0XHQnPHNwYW4gc3R5bGU9XCJjb2xvcjogIzAwMDAwMDtcIj4mIzE2MDs8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIHN0eWxlPVwiY29sb3I6ICMwMGZmMDA7XCI+aGVsbG88L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIHN0eWxlPVwiY29sb3I6ICMwMDAwMDA7XCI+IDwvc3Bhbj4nLFxuXHRcdFx0XHQnPC9kaXY+J1xuXHRcdFx0XS5qb2luKCcnKVxuXHRcdCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0XHR0b2tlbml6ZUxpbmVUb0hUTUwodGV4dCwgbGluZVRva2VucywgY29sb3JNYXAsIDUsIDExLCA0LCB0cnVlKSxcblx0XHRcdFtcblx0XHRcdFx0JzxkaXY+Jyxcblx0XHRcdFx0JzxzcGFuIHN0eWxlPVwiY29sb3I6ICMwMGZmMDA7XCI+aGVsbG88L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIHN0eWxlPVwiY29sb3I6ICMwMDAwMDA7XCI+IDwvc3Bhbj4nLFxuXHRcdFx0XHQnPC9kaXY+J1xuXHRcdFx0XS5qb2luKCcnKVxuXHRcdCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0XHR0b2tlbml6ZUxpbmVUb0hUTUwodGV4dCwgbGluZVRva2VucywgY29sb3JNYXAsIDUsIDEwLCA0LCB0cnVlKSxcblx0XHRcdFtcblx0XHRcdFx0JzxkaXY+Jyxcblx0XHRcdFx0JzxzcGFuIHN0eWxlPVwiY29sb3I6ICMwMGZmMDA7XCI+aGVsbG88L3NwYW4+Jyxcblx0XHRcdFx0JzwvZGl2Pidcblx0XHRcdF0uam9pbignJylcblx0XHQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0dG9rZW5pemVMaW5lVG9IVE1MKHRleHQsIGxpbmVUb2tlbnMsIGNvbG9yTWFwLCA2LCA5LCA0LCB0cnVlKSxcblx0XHRcdFtcblx0XHRcdFx0JzxkaXY+Jyxcblx0XHRcdFx0JzxzcGFuIHN0eWxlPVwiY29sb3I6ICMwMGZmMDA7XCI+ZWxsPC9zcGFuPicsXG5cdFx0XHRcdCc8L2Rpdj4nXG5cdFx0XHRdLmpvaW4oJycpXG5cdFx0KTtcblx0fSk7XG5cdHRlc3QoJ3Rva2VuaXplTGluZVRvSFRNTCBoYW5kbGUgc3BhY2VzICMzNTk1NCcsICgpID0+IHtcblx0XHRjb25zdCB0ZXh0ID0gJyAgQ2lhbyAgIGhlbGxvIHdvcmxkISc7XG5cdFx0Y29uc3QgbGluZVRva2VucyA9IG5ldyBUZXN0TGluZVRva2VucyhbXG5cdFx0XHRuZXcgVGVzdExpbmVUb2tlbihcblx0XHRcdFx0Mixcblx0XHRcdFx0KFxuXHRcdFx0XHRcdCgxIDw8IE1ldGFkYXRhQ29uc3RzLkZPUkVHUk9VTkRfT0ZGU0VUKVxuXHRcdFx0XHQpID4+PiAwXG5cdFx0XHQpLFxuXHRcdFx0bmV3IFRlc3RMaW5lVG9rZW4oXG5cdFx0XHRcdDYsXG5cdFx0XHRcdChcblx0XHRcdFx0XHQoMyA8PCBNZXRhZGF0YUNvbnN0cy5GT1JFR1JPVU5EX09GRlNFVClcblx0XHRcdFx0XHR8ICgoRm9udFN0eWxlLkJvbGQgfCBGb250U3R5bGUuSXRhbGljKSA8PCBNZXRhZGF0YUNvbnN0cy5GT05UX1NUWUxFX09GRlNFVClcblx0XHRcdFx0KSA+Pj4gMFxuXHRcdFx0KSxcblx0XHRcdG5ldyBUZXN0TGluZVRva2VuKFxuXHRcdFx0XHQ5LFxuXHRcdFx0XHQoXG5cdFx0XHRcdFx0KDEgPDwgTWV0YWRhdGFDb25zdHMuRk9SRUdST1VORF9PRkZTRVQpXG5cdFx0XHRcdCkgPj4+IDBcblx0XHRcdCksXG5cdFx0XHRuZXcgVGVzdExpbmVUb2tlbihcblx0XHRcdFx0MTQsXG5cdFx0XHRcdChcblx0XHRcdFx0XHQoNCA8PCBNZXRhZGF0YUNvbnN0cy5GT1JFR1JPVU5EX09GRlNFVClcblx0XHRcdFx0KSA+Pj4gMFxuXHRcdFx0KSxcblx0XHRcdG5ldyBUZXN0TGluZVRva2VuKFxuXHRcdFx0XHQxNSxcblx0XHRcdFx0KFxuXHRcdFx0XHRcdCgxIDw8IE1ldGFkYXRhQ29uc3RzLkZPUkVHUk9VTkRfT0ZGU0VUKVxuXHRcdFx0XHQpID4+PiAwXG5cdFx0XHQpLFxuXHRcdFx0bmV3IFRlc3RMaW5lVG9rZW4oXG5cdFx0XHRcdDIxLFxuXHRcdFx0XHQoXG5cdFx0XHRcdFx0KDUgPDwgTWV0YWRhdGFDb25zdHMuRk9SRUdST1VORF9PRkZTRVQpXG5cdFx0XHRcdFx0fCAoKEZvbnRTdHlsZS5VbmRlcmxpbmUpIDw8IE1ldGFkYXRhQ29uc3RzLkZPTlRfU1RZTEVfT0ZGU0VUKVxuXHRcdFx0XHQpID4+PiAwXG5cdFx0XHQpXG5cdFx0XSk7XG5cdFx0Y29uc3QgY29sb3JNYXAgPSBbbnVsbCEsICcjMDAwMDAwJywgJyNmZmZmZmYnLCAnI2ZmMDAwMCcsICcjMDBmZjAwJywgJyMwMDAwZmYnXTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdHRva2VuaXplTGluZVRvSFRNTCh0ZXh0LCBsaW5lVG9rZW5zLCBjb2xvck1hcCwgMCwgMjEsIDQsIHRydWUpLFxuXHRcdFx0W1xuXHRcdFx0XHQnPGRpdj4nLFxuXHRcdFx0XHQnPHNwYW4gc3R5bGU9XCJjb2xvcjogIzAwMDAwMDtcIj4mIzE2MDsgPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBzdHlsZT1cImNvbG9yOiAjZmYwMDAwO2ZvbnQtc3R5bGU6IGl0YWxpYztmb250LXdlaWdodDogYm9sZDtcIj5DaWFvPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBzdHlsZT1cImNvbG9yOiAjMDAwMDAwO1wiPiAmIzE2MDsgPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBzdHlsZT1cImNvbG9yOiAjMDBmZjAwO1wiPmhlbGxvPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBzdHlsZT1cImNvbG9yOiAjMDAwMDAwO1wiPiA8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIHN0eWxlPVwiY29sb3I6ICMwMDAwZmY7dGV4dC1kZWNvcmF0aW9uOiB1bmRlcmxpbmU7XCI+d29ybGQhPC9zcGFuPicsXG5cdFx0XHRcdCc8L2Rpdj4nXG5cdFx0XHRdLmpvaW4oJycpXG5cdFx0KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdHRva2VuaXplTGluZVRvSFRNTCh0ZXh0LCBsaW5lVG9rZW5zLCBjb2xvck1hcCwgMCwgMTcsIDQsIHRydWUpLFxuXHRcdFx0W1xuXHRcdFx0XHQnPGRpdj4nLFxuXHRcdFx0XHQnPHNwYW4gc3R5bGU9XCJjb2xvcjogIzAwMDAwMDtcIj4mIzE2MDsgPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBzdHlsZT1cImNvbG9yOiAjZmYwMDAwO2ZvbnQtc3R5bGU6IGl0YWxpYztmb250LXdlaWdodDogYm9sZDtcIj5DaWFvPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBzdHlsZT1cImNvbG9yOiAjMDAwMDAwO1wiPiAmIzE2MDsgPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBzdHlsZT1cImNvbG9yOiAjMDBmZjAwO1wiPmhlbGxvPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBzdHlsZT1cImNvbG9yOiAjMDAwMDAwO1wiPiA8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIHN0eWxlPVwiY29sb3I6ICMwMDAwZmY7dGV4dC1kZWNvcmF0aW9uOiB1bmRlcmxpbmU7XCI+d288L3NwYW4+Jyxcblx0XHRcdFx0JzwvZGl2Pidcblx0XHRcdF0uam9pbignJylcblx0XHQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0dG9rZW5pemVMaW5lVG9IVE1MKHRleHQsIGxpbmVUb2tlbnMsIGNvbG9yTWFwLCAwLCAzLCA0LCB0cnVlKSxcblx0XHRcdFtcblx0XHRcdFx0JzxkaXY+Jyxcblx0XHRcdFx0JzxzcGFuIHN0eWxlPVwiY29sb3I6ICMwMDAwMDA7XCI+JiMxNjA7IDwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gc3R5bGU9XCJjb2xvcjogI2ZmMDAwMDtmb250LXN0eWxlOiBpdGFsaWM7Zm9udC13ZWlnaHQ6IGJvbGQ7XCI+Qzwvc3Bhbj4nLFxuXHRcdFx0XHQnPC9kaXY+J1xuXHRcdFx0XS5qb2luKCcnKVxuXHRcdCk7XG5cdH0pO1xuXG59KTtcblxuY2xhc3MgTW9kZSBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHB1YmxpYyByZWFkb25seSBsYW5ndWFnZUlkID0gJ3RleHRUb0h0bWxUb2tlbml6ZXJNb2RlJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUxhbmd1YWdlU2VydmljZSBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9yZWdpc3RlcihsYW5ndWFnZVNlcnZpY2UucmVnaXN0ZXJMYW5ndWFnZSh7IGlkOiB0aGlzLmxhbmd1YWdlSWQgfSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKFRva2VuaXphdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyKHRoaXMubGFuZ3VhZ2VJZCwge1xuXHRcdFx0Z2V0SW5pdGlhbFN0YXRlOiAoKTogSVN0YXRlID0+IG51bGwhLFxuXHRcdFx0dG9rZW5pemU6IHVuZGVmaW5lZCEsXG5cdFx0XHR0b2tlbml6ZUVuY29kZWQ6IChsaW5lOiBzdHJpbmcsIGhhc0VPTDogYm9vbGVhbiwgc3RhdGU6IElTdGF0ZSk6IEVuY29kZWRUb2tlbml6YXRpb25SZXN1bHQgPT4ge1xuXHRcdFx0XHRjb25zdCB0b2tlbnNBcnI6IG51bWJlcltdID0gW107XG5cdFx0XHRcdGxldCBwcmV2Q29sb3IgPSAtMSBhcyBDb2xvcklkO1xuXHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGxpbmUubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRjb25zdCBjb2xvcklkID0gKGxpbmUuY2hhckF0KGkpID09PSAnLicgPyA3IDogOSkgYXMgQ29sb3JJZDtcblx0XHRcdFx0XHRpZiAocHJldkNvbG9yICE9PSBjb2xvcklkKSB7XG5cdFx0XHRcdFx0XHR0b2tlbnNBcnIucHVzaChpKTtcblx0XHRcdFx0XHRcdHRva2Vuc0Fyci5wdXNoKChcblx0XHRcdFx0XHRcdFx0Y29sb3JJZCA8PCBNZXRhZGF0YUNvbnN0cy5GT1JFR1JPVU5EX09GRlNFVFxuXHRcdFx0XHRcdFx0KSA+Pj4gMCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHByZXZDb2xvciA9IGNvbG9ySWQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCB0b2tlbnMgPSBuZXcgVWludDMyQXJyYXkodG9rZW5zQXJyLmxlbmd0aCk7XG5cdFx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdG9rZW5zLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0dG9rZW5zW2ldID0gdG9rZW5zQXJyW2ldO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBuZXcgRW5jb2RlZFRva2VuaXphdGlvblJlc3VsdCh0b2tlbnMsIG51bGwhKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FB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QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNELEVBQUUsS0FBSyxFQUFFO0FBQUEsSUFDVjtBQUVBLFdBQU87QUFBQSxNQUNOLG1CQUFtQixNQUFNLFlBQVksVUFBVSxHQUFHLElBQUksR0FBRyxJQUFJO0FBQUEsTUFDN0Q7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNELEVBQUUsS0FBSyxFQUFFO0FBQUEsSUFDVjtBQUVBLFdBQU87QUFBQSxNQUNOLG1CQUFtQixNQUFNLFlBQVksVUFBVSxHQUFHLElBQUksR0FBRyxJQUFJO0FBQUEsTUFDN0Q7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0QsRUFBRSxLQUFLLEVBQUU7QUFBQSxJQUNWO0FBRUEsV0FBTztBQUFBLE1BQ04sbUJBQW1CLE1BQU0sWUFBWSxVQUFVLEdBQUcsSUFBSSxHQUFHLElBQUk7QUFBQSxNQUM3RDtBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNELEVBQUUsS0FBSyxFQUFFO0FBQUEsSUFDVjtBQUVBLFdBQU87QUFBQSxNQUNOLG1CQUFtQixNQUFNLFlBQVksVUFBVSxHQUFHLElBQUksR0FBRyxJQUFJO0FBQUEsTUFDN0Q7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNELEVBQUUsS0FBSyxFQUFFO0FBQUEsSUFDVjtBQUVBLFdBQU87QUFBQSxNQUNOLG1CQUFtQixNQUFNLFlBQVksVUFBVSxHQUFHLEdBQUcsR0FBRyxJQUFJO0FBQUEsTUFDNUQ7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNELEVBQUUsS0FBSyxFQUFFO0FBQUEsSUFDVjtBQUFBLEVBQ0QsQ0FBQztBQUNELE9BQUssMkNBQTJDLE1BQU07QUFDckQsVUFBTSxPQUFPO0FB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
