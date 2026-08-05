import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { FontStyle } from "../../../../common/encodedTokenAttributes.js";
import { ColorMap, ExternalThemeTrieElement, ParsedTokenThemeRule, ThemeTrieElementRule, TokenTheme, parseTokenTheme, strcmp } from "../../../../common/languages/supports/tokenization.js";
suite("Token theme matching", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("gives higher priority to deeper matches", () => {
    const theme = TokenTheme.createFromRawTokenTheme([
      { token: "", foreground: "100000", background: "200000" },
      { token: "punctuation.definition.string.begin.html", foreground: "300000" },
      { token: "punctuation.definition.string", foreground: "400000" }
    ], []);
    const colorMap = new ColorMap();
    colorMap.getId("100000");
    const _B = colorMap.getId("200000");
    colorMap.getId("400000");
    const _D = colorMap.getId("300000");
    const actual = theme._match("punctuation.definition.string.begin.html");
    assert.deepStrictEqual(actual, new ThemeTrieElementRule(FontStyle.None, _D, _B));
  });
  test("can match", () => {
    const theme = TokenTheme.createFromRawTokenTheme([
      { token: "", foreground: "F8F8F2", background: "272822" },
      { token: "source", background: "100000" },
      { token: "something", background: "100000" },
      { token: "bar", background: "200000" },
      { token: "baz", background: "200000" },
      { token: "bar", fontStyle: "bold" },
      { token: "constant", fontStyle: "italic", foreground: "300000" },
      { token: "constant.numeric", foreground: "400000" },
      { token: "constant.numeric.hex", fontStyle: "bold" },
      { token: "constant.numeric.oct", fontStyle: "bold italic underline" },
      { token: "constant.numeric.bin", fontStyle: "bold strikethrough" },
      { token: "constant.numeric.dec", fontStyle: "", foreground: "500000" },
      { token: "storage.object.bar", fontStyle: "", foreground: "600000" }
    ], []);
    const colorMap = new ColorMap();
    const _A = colorMap.getId("F8F8F2");
    const _B = colorMap.getId("272822");
    const _C = colorMap.getId("200000");
    const _D = colorMap.getId("300000");
    const _E = colorMap.getId("400000");
    const _F = colorMap.getId("500000");
    const _G = colorMap.getId("100000");
    const _H = colorMap.getId("600000");
    function assertMatch(scopeName, expected) {
      const actual = theme._match(scopeName);
      assert.deepStrictEqual(actual, expected, "when matching <<" + scopeName + ">>");
    }
    function assertSimpleMatch(scopeName, fontStyle, foreground, background) {
      assertMatch(scopeName, new ThemeTrieElementRule(fontStyle, foreground, background));
    }
    function assertNoMatch(scopeName) {
      assertMatch(scopeName, new ThemeTrieElementRule(FontStyle.None, _A, _B));
    }
    assertNoMatch("");
    assertNoMatch("bazz");
    assertNoMatch("asdfg");
    assertSimpleMatch("source", FontStyle.None, _A, _G);
    assertSimpleMatch("source.ts", FontStyle.None, _A, _G);
    assertSimpleMatch("source.tss", FontStyle.None, _A, _G);
    assertSimpleMatch("something", FontStyle.None, _A, _G);
    assertSimpleMatch("something.ts", FontStyle.None, _A, _G);
    assertSimpleMatch("something.tss", FontStyle.None, _A, _G);
    assertSimpleMatch("baz", FontStyle.None, _A, _C);
    assertSimpleMatch("baz.ts", FontStyle.None, _A, _C);
    assertSimpleMatch("baz.tss", FontStyle.None, _A, _C);
    assertSimpleMatch("constant", FontStyle.Italic, _D, _B);
    assertSimpleMatch("constant.string", FontStyle.Italic, _D, _B);
    assertSimpleMatch("constant.hex", FontStyle.Italic, _D, _B);
    assertSimpleMatch("constant.numeric", FontStyle.Italic, _E, _B);
    assertSimpleMatch("constant.numeric.baz", FontStyle.Italic, _E, _B);
    assertSimpleMatch("constant.numeric.hex", FontStyle.Bold, _E, _B);
    assertSimpleMatch("constant.numeric.hex.baz", FontStyle.Bold, _E, _B);
    assertSimpleMatch("constant.numeric.oct", FontStyle.Bold | FontStyle.Italic | FontStyle.Underline, _E, _B);
    assertSimpleMatch("constant.numeric.oct.baz", FontStyle.Bold | FontStyle.Italic | FontStyle.Underline, _E, _B);
    assertSimpleMatch("constant.numeric.bin", FontStyle.Bold | FontStyle.Strikethrough, _E, _B);
    assertSimpleMatch("constant.numeric.bin.baz", FontStyle.Bold | FontStyle.Strikethrough, _E, _B);
    assertSimpleMatch("constant.numeric.dec", FontStyle.None, _F, _B);
    assertSimpleMatch("constant.numeric.dec.baz", FontStyle.None, _F, _B);
    assertSimpleMatch("storage.object.bar", FontStyle.None, _H, _B);
    assertSimpleMatch("storage.object.bar.baz", FontStyle.None, _H, _B);
    assertSimpleMatch("storage.object.bart", FontStyle.None, _A, _B);
    assertSimpleMatch("storage.object", FontStyle.None, _A, _B);
    assertSimpleMatch("storage", FontStyle.None, _A, _B);
    assertSimpleMatch("bar", FontStyle.Bold, _A, _C);
  });
});
suite("Token theme parsing", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("can parse", () => {
    const actual = parseTokenTheme([
      { token: "", foreground: "F8F8F2", background: "272822" },
      { token: "source", background: "100000" },
      { token: "something", background: "100000" },
      { token: "bar", background: "010000" },
      { token: "baz", background: "010000" },
      { token: "bar", fontStyle: "bold" },
      { token: "constant", fontStyle: "italic", foreground: "ff0000" },
      { token: "constant.numeric", foreground: "00ff00" },
      { token: "constant.numeric.hex", fontStyle: "bold" },
      { token: "constant.numeric.oct", fontStyle: "bold italic underline" },
      { token: "constant.numeric.dec", fontStyle: "", foreground: "0000ff" }
    ]);
    const expected = [
      new ParsedTokenThemeRule("", 0, FontStyle.NotSet, "F8F8F2", "272822"),
      new ParsedTokenThemeRule("source", 1, FontStyle.NotSet, null, "100000"),
      new ParsedTokenThemeRule("something", 2, FontStyle.NotSet, null, "100000"),
      new ParsedTokenThemeRule("bar", 3, FontStyle.NotSet, null, "010000"),
      new ParsedTokenThemeRule("baz", 4, FontStyle.NotSet, null, "010000"),
      new ParsedTokenThemeRule("bar", 5, FontStyle.Bold, null, null),
      new ParsedTokenThemeRule("constant", 6, FontStyle.Italic, "ff0000", null),
      new ParsedTokenThemeRule("constant.numeric", 7, FontStyle.NotSet, "00ff00", null),
      new ParsedTokenThemeRule("constant.numeric.hex", 8, FontStyle.Bold, null, null),
      new ParsedTokenThemeRule("constant.numeric.oct", 9, FontStyle.Bold | FontStyle.Italic | FontStyle.Underline, null, null),
      new ParsedTokenThemeRule("constant.numeric.dec", 10, FontStyle.None, "0000ff", null)
    ];
    assert.deepStrictEqual(actual, expected);
  });
});
suite("Token theme resolving", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("strcmp works", () => {
    const actual = ["bar", "z", "zu", "a", "ab", ""].sort(strcmp);
    const expected = ["", "a", "ab", "bar", "z", "zu"];
    assert.deepStrictEqual(actual, expected);
  });
  test("always has defaults", () => {
    const actual = TokenTheme.createFromParsedTokenTheme([], []);
    const colorMap = new ColorMap();
    const _A = colorMap.getId("000000");
    const _B = colorMap.getId("ffffff");
    assert.deepStrictEqual(actual.getColorMap(), colorMap.getColorMap());
    assert.deepStrictEqual(actual.getThemeTrieElement(), new ExternalThemeTrieElement(new ThemeTrieElementRule(FontStyle.None, _A, _B)));
  });
  test("respects incoming defaults 1", () => {
    const actual = TokenTheme.createFromParsedTokenTheme([
      new ParsedTokenThemeRule("", -1, FontStyle.NotSet, null, null)
    ], []);
    const colorMap = new ColorMap();
    const _A = colorMap.getId("000000");
    const _B = colorMap.getId("ffffff");
    assert.deepStrictEqual(actual.getColorMap(), colorMap.getColorMap());
    assert.deepStrictEqual(actual.getThemeTrieElement(), new ExternalThemeTrieElement(new ThemeTrieElementRule(FontStyle.None, _A, _B)));
  });
  test("respects incoming defaults 2", () => {
    const actual = TokenTheme.createFromParsedTokenTheme([
      new ParsedTokenThemeRule("", -1, FontStyle.None, null, null)
    ], []);
    const colorMap = new ColorMap();
    const _A = colorMap.getId("000000");
    const _B = colorMap.getId("ffffff");
    assert.deepStrictEqual(actual.getColorMap(), colorMap.getColorMap());
    assert.deepStrictEqual(actual.getThemeTrieElement(), new ExternalThemeTrieElement(new ThemeTrieElementRule(FontStyle.None, _A, _B)));
  });
  test("respects incoming defaults 3", () => {
    const actual = TokenTheme.createFromParsedTokenTheme([
      new ParsedTokenThemeRule("", -1, FontStyle.Bold, null, null)
    ], []);
    const colorMap = new ColorMap();
    const _A = colorMap.getId("000000");
    const _B = colorMap.getId("ffffff");
    assert.deepStrictEqual(actual.getColorMap(), colorMap.getColorMap());
    assert.deepStrictEqual(actual.getThemeTrieElement(), new ExternalThemeTrieElement(new ThemeTrieElementRule(FontStyle.Bold, _A, _B)));
  });
  test("respects incoming defaults 4", () => {
    const actual = TokenTheme.createFromParsedTokenTheme([
      new ParsedTokenThemeRule("", -1, FontStyle.NotSet, "ff0000", null)
    ], []);
    const colorMap = new ColorMap();
    const _A = colorMap.getId("ff0000");
    const _B = colorMap.getId("ffffff");
    assert.deepStrictEqual(actual.getColorMap(), colorMap.getColorMap());
    assert.deepStrictEqual(actual.getThemeTrieElement(), new ExternalThemeTrieElement(new ThemeTrieElementRule(FontStyle.None, _A, _B)));
  });
  test("respects incoming defaults 5", () => {
    const actual = TokenTheme.createFromParsedTokenTheme([
      new ParsedTokenThemeRule("", -1, FontStyle.NotSet, null, "ff0000")
    ], []);
    const colorMap = new ColorMap();
    const _A = colorMap.getId("000000");
    const _B = colorMap.getId("ff0000");
    assert.deepStrictEqual(actual.getColorMap(), colorMap.getColorMap());
    assert.deepStrictEqual(actual.getThemeTrieElement(), new ExternalThemeTrieElement(new ThemeTrieElementRule(FontStyle.None, _A, _B)));
  });
  test("can merge incoming defaults", () => {
    const actual = TokenTheme.createFromParsedTokenTheme([
      new ParsedTokenThemeRule("", -1, FontStyle.NotSet, null, "ff0000"),
      new ParsedTokenThemeRule("", -1, FontStyle.NotSet, "00ff00", null),
      new ParsedTokenThemeRule("", -1, FontStyle.Bold, null, null)
    ], []);
    const colorMap = new ColorMap();
    const _A = colorMap.getId("00ff00");
    const _B = colorMap.getId("ff0000");
    assert.deepStrictEqual(actual.getColorMap(), colorMap.getColorMap());
    assert.deepStrictEqual(actual.getThemeTrieElement(), new ExternalThemeTrieElement(new ThemeTrieElementRule(FontStyle.Bold, _A, _B)));
  });
  test("defaults are inherited", () => {
    const actual = TokenTheme.createFromParsedTokenTheme([
      new ParsedTokenThemeRule("", -1, FontStyle.NotSet, "F8F8F2", "272822"),
      new ParsedTokenThemeRule("var", -1, FontStyle.NotSet, "ff0000", null)
    ], []);
    const colorMap = new ColorMap();
    const _A = colorMap.getId("F8F8F2");
    const _B = colorMap.getId("272822");
    const _C = colorMap.getId("ff0000");
    assert.deepStrictEqual(actual.getColorMap(), colorMap.getColorMap());
    const root = new ExternalThemeTrieElement(new ThemeTrieElementRule(FontStyle.None, _A, _B), {
      "var": new ExternalThemeTrieElement(new ThemeTrieElementRule(FontStyle.None, _C, _B))
    });
    assert.deepStrictEqual(actual.getThemeTrieElement(), root);
  });
  test("same rules get merged", () => {
    const actual = TokenTheme.createFromParsedTokenTheme([
      new ParsedTokenThemeRule("", -1, FontStyle.NotSet, "F8F8F2", "272822"),
      new ParsedTokenThemeRule("var", 1, FontStyle.Bold, null, null),
      new ParsedTokenThemeRule("var", 0, FontStyle.NotSet, "ff0000", null)
    ], []);
    const colorMap = new ColorMap();
    const _A = colorMap.getId("F8F8F2");
    const _B = colorMap.getId("272822");
    const _C = colorMap.getId("ff0000");
    assert.deepStrictEqual(actual.getColorMap(), colorMap.getColorMap());
    const root = new ExternalThemeTrieElement(new ThemeTrieElementRule(FontStyle.None, _A, _B), {
      "var": new ExternalThemeTrieElement(new ThemeTrieElementRule(FontStyle.Bold, _C, _B))
    });
    assert.deepStrictEqual(actual.getThemeTrieElement(), root);
  });
  test("rules are inherited 1", () => {
    const actual = TokenTheme.createFromParsedTokenTheme([
      new ParsedTokenThemeRule("", -1, FontStyle.NotSet, "F8F8F2", "272822"),
      new ParsedTokenThemeRule("var", -1, FontStyle.Bold, "ff0000", null),
      new ParsedTokenThemeRule("var.identifier", -1, FontStyle.NotSet, "00ff00", null)
    ], []);
    const colorMap = new ColorMap();
    const _A = colorMap.getId("F8F8F2");
    const _B = colorMap.getId("272822");
    const _C = colorMap.getId("ff0000");
    const _D = colorMap.getId("00ff00");
    assert.deepStrictEqual(actual.getColorMap(), colorMap.getColorMap());
    const root = new ExternalThemeTrieElement(new ThemeTrieElementRule(FontStyle.None, _A, _B), {
      "var": new ExternalThemeTrieElement(new ThemeTrieElementRule(FontStyle.Bold, _C, _B), {
        "identifier": new ExternalThemeTrieElement(new ThemeTrieElementRule(FontStyle.Bold, _D, _B))
      })
    });
    assert.deepStrictEqual(actual.getThemeTrieElement(), root);
  });
  test("rules are inherited 2", () => {
    const actual = TokenTheme.createFromParsedTokenTheme([
      new ParsedTokenThemeRule("", -1, FontStyle.NotSet, "F8F8F2", "272822"),
      new ParsedTokenThemeRule("var", -1, FontStyle.Bold, "ff0000", null),
      new ParsedTokenThemeRule("var.identifier", -1, FontStyle.NotSet, "00ff00", null),
      new ParsedTokenThemeRule("constant", 4, FontStyle.Italic, "100000", null),
      new ParsedTokenThemeRule("constant.numeric", 5, FontStyle.NotSet, "200000", null),
      new ParsedTokenThemeRule("constant.numeric.hex", 6, FontStyle.Bold, null, null),
      new ParsedTokenThemeRule("constant.numeric.oct", 7, FontStyle.Bold | FontStyle.Italic | FontStyle.Underline, null, null),
      new ParsedTokenThemeRule("constant.numeric.dec", 8, FontStyle.None, "300000", null)
    ], []);
    const colorMap = new ColorMap();
    const _A = colorMap.getId("F8F8F2");
    const _B = colorMap.getId("272822");
    const _C = colorMap.getId("100000");
    const _D = colorMap.getId("200000");
    const _E = colorMap.getId("300000");
    const _F = colorMap.getId("ff0000");
    const _G = colorMap.getId("00ff00");
    assert.deepStrictEqual(actual.getColorMap(), colorMap.getColorMap());
    const root = new ExternalThemeTrieElement(new ThemeTrieElementRule(FontStyle.None, _A, _B), {
      "var": new ExternalThemeTrieElement(new ThemeTrieElementRule(FontStyle.Bold, _F, _B), {
        "identifier": new ExternalThemeTrieElement(new ThemeTrieElementRule(FontStyle.Bold, _G, _B))
      }),
      "constant": new ExternalThemeTrieElement(new ThemeTrieElementRule(FontStyle.Italic, _C, _B), {
        "numeric": new ExternalThemeTrieElement(new ThemeTrieElementRule(FontStyle.Italic, _D, _B), {
          "hex": new ExternalThemeTrieElement(new ThemeTrieElementRule(FontStyle.Bold, _D, _B)),
          "oct": new ExternalThemeTrieElement(new ThemeTrieElementRule(FontStyle.Bold | FontStyle.Italic | FontStyle.Underline, _D, _B)),
          "dec": new ExternalThemeTrieElement(new ThemeTrieElementRule(FontStyle.None, _E, _B))
        })
      })
    });
    assert.deepStrictEqual(actual.getThemeTrieElement(), root);
  });
  test("custom colors are first in color map", () => {
    const actual = TokenTheme.createFromParsedTokenTheme([
      new ParsedTokenThemeRule("var", -1, FontStyle.NotSet, "F8F8F2", null)
    ], [
      "000000",
      "FFFFFF",
      "0F0F0F"
    ]);
    const colorMap = new ColorMap();
    colorMap.getId("000000");
    colorMap.getId("FFFFFF");
    colorMap.getId("0F0F0F");
    colorMap.getId("F8F8F2");
    assert.deepStrictEqual(actual.getColorMap(), colorMap.getColorMap());
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vbW9kZXMvc3VwcG9ydHMvdG9rZW5pemF0aW9uLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IEZvbnRTdHlsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9lbmNvZGVkVG9rZW5BdHRyaWJ1dGVzLmpzJztcbmltcG9ydCB7IENvbG9yTWFwLCBFeHRlcm5hbFRoZW1lVHJpZUVsZW1lbnQsIFBhcnNlZFRva2VuVGhlbWVSdWxlLCBUaGVtZVRyaWVFbGVtZW50UnVsZSwgVG9rZW5UaGVtZSwgcGFyc2VUb2tlblRoZW1lLCBzdHJjbXAgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL3N1cHBvcnRzL3Rva2VuaXphdGlvbi5qcyc7XG5cbnN1aXRlKCdUb2tlbiB0aGVtZSBtYXRjaGluZycsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdnaXZlcyBoaWdoZXIgcHJpb3JpdHkgdG8gZGVlcGVyIG1hdGNoZXMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgdGhlbWUgPSBUb2tlblRoZW1lLmNyZWF0ZUZyb21SYXdUb2tlblRoZW1lKFtcblx0XHRcdHsgdG9rZW46ICcnLCBmb3JlZ3JvdW5kOiAnMTAwMDAwJywgYmFja2dyb3VuZDogJzIwMDAwMCcgfSxcblx0XHRcdHsgdG9rZW46ICdwdW5jdHVhdGlvbi5kZWZpbml0aW9uLnN0cmluZy5iZWdpbi5odG1sJywgZm9yZWdyb3VuZDogJzMwMDAwMCcgfSxcblx0XHRcdHsgdG9rZW46ICdwdW5jdHVhdGlvbi5kZWZpbml0aW9uLnN0cmluZycsIGZvcmVncm91bmQ6ICc0MDAwMDAnIH0sXG5cdFx0XSwgW10pO1xuXG5cdFx0Y29uc3QgY29sb3JNYXAgPSBuZXcgQ29sb3JNYXAoKTtcblx0XHRjb2xvck1hcC5nZXRJZCgnMTAwMDAwJyk7XG5cdFx0Y29uc3QgX0IgPSBjb2xvck1hcC5nZXRJZCgnMjAwMDAwJyk7XG5cdFx0Y29sb3JNYXAuZ2V0SWQoJzQwMDAwMCcpO1xuXHRcdGNvbnN0IF9EID0gY29sb3JNYXAuZ2V0SWQoJzMwMDAwMCcpO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gdGhlbWUuX21hdGNoKCdwdW5jdHVhdGlvbi5kZWZpbml0aW9uLnN0cmluZy5iZWdpbi5odG1sJyk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgbmV3IFRoZW1lVHJpZUVsZW1lbnRSdWxlKEZvbnRTdHlsZS5Ob25lLCBfRCwgX0IpKTtcblx0fSk7XG5cblx0dGVzdCgnY2FuIG1hdGNoJywgKCkgPT4ge1xuXHRcdGNvbnN0IHRoZW1lID0gVG9rZW5UaGVtZS5jcmVhdGVGcm9tUmF3VG9rZW5UaGVtZShbXG5cdFx0XHR7IHRva2VuOiAnJywgZm9yZWdyb3VuZDogJ0Y4RjhGMicsIGJhY2tncm91bmQ6ICcyNzI4MjInIH0sXG5cdFx0XHR7IHRva2VuOiAnc291cmNlJywgYmFja2dyb3VuZDogJzEwMDAwMCcgfSxcblx0XHRcdHsgdG9rZW46ICdzb21ldGhpbmcnLCBiYWNrZ3JvdW5kOiAnMTAwMDAwJyB9LFxuXHRcdFx0eyB0b2tlbjogJ2JhcicsIGJhY2tncm91bmQ6ICcyMDAwMDAnIH0sXG5cdFx0XHR7IHRva2VuOiAnYmF6JywgYmFja2dyb3VuZDogJzIwMDAwMCcgfSxcblx0XHRcdHsgdG9rZW46ICdiYXInLCBmb250U3R5bGU6ICdib2xkJyB9LFxuXHRcdFx0eyB0b2tlbjogJ2NvbnN0YW50JywgZm9udFN0eWxlOiAnaXRhbGljJywgZm9yZWdyb3VuZDogJzMwMDAwMCcgfSxcblx0XHRcdHsgdG9rZW46ICdjb25zdGFudC5udW1lcmljJywgZm9yZWdyb3VuZDogJzQwMDAwMCcgfSxcblx0XHRcdHsgdG9rZW46ICdjb25zdGFudC5udW1lcmljLmhleCcsIGZvbnRTdHlsZTogJ2JvbGQnIH0sXG5cdFx0XHR7IHRva2VuOiAnY29uc3RhbnQubnVtZXJpYy5vY3QnLCBmb250U3R5bGU6ICdib2xkIGl0YWxpYyB1bmRlcmxpbmUnIH0sXG5cdFx0XHR7IHRva2VuOiAnY29uc3RhbnQubnVtZXJpYy5iaW4nLCBmb250U3R5bGU6ICdib2xkIHN0cmlrZXRocm91Z2gnIH0sXG5cdFx0XHR7IHRva2VuOiAnY29uc3RhbnQubnVtZXJpYy5kZWMnLCBmb250U3R5bGU6ICcnLCBmb3JlZ3JvdW5kOiAnNTAwMDAwJyB9LFxuXHRcdFx0eyB0b2tlbjogJ3N0b3JhZ2Uub2JqZWN0LmJhcicsIGZvbnRTdHlsZTogJycsIGZvcmVncm91bmQ6ICc2MDAwMDAnIH0sXG5cdFx0XSwgW10pO1xuXG5cdFx0Y29uc3QgY29sb3JNYXAgPSBuZXcgQ29sb3JNYXAoKTtcblx0XHRjb25zdCBfQSA9IGNvbG9yTWFwLmdldElkKCdGOEY4RjInKTtcblx0XHRjb25zdCBfQiA9IGNvbG9yTWFwLmdldElkKCcyNzI4MjInKTtcblx0XHRjb25zdCBfQyA9IGNvbG9yTWFwLmdldElkKCcyMDAwMDAnKTtcblx0XHRjb25zdCBfRCA9IGNvbG9yTWFwLmdldElkKCczMDAwMDAnKTtcblx0XHRjb25zdCBfRSA9IGNvbG9yTWFwLmdldElkKCc0MDAwMDAnKTtcblx0XHRjb25zdCBfRiA9IGNvbG9yTWFwLmdldElkKCc1MDAwMDAnKTtcblx0XHRjb25zdCBfRyA9IGNvbG9yTWFwLmdldElkKCcxMDAwMDAnKTtcblx0XHRjb25zdCBfSCA9IGNvbG9yTWFwLmdldElkKCc2MDAwMDAnKTtcblxuXHRcdGZ1bmN0aW9uIGFzc2VydE1hdGNoKHNjb3BlTmFtZTogc3RyaW5nLCBleHBlY3RlZDogVGhlbWVUcmllRWxlbWVudFJ1bGUpOiB2b2lkIHtcblx0XHRcdGNvbnN0IGFjdHVhbCA9IHRoZW1lLl9tYXRjaChzY29wZU5hbWUpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCAnd2hlbiBtYXRjaGluZyA8PCcgKyBzY29wZU5hbWUgKyAnPj4nKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBhc3NlcnRTaW1wbGVNYXRjaChzY29wZU5hbWU6IHN0cmluZywgZm9udFN0eWxlOiBGb250U3R5bGUsIGZvcmVncm91bmQ6IG51bWJlciwgYmFja2dyb3VuZDogbnVtYmVyKTogdm9pZCB7XG5cdFx0XHRhc3NlcnRNYXRjaChzY29wZU5hbWUsIG5ldyBUaGVtZVRyaWVFbGVtZW50UnVsZShmb250U3R5bGUsIGZvcmVncm91bmQsIGJhY2tncm91bmQpKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBhc3NlcnROb01hdGNoKHNjb3BlTmFtZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0XHRhc3NlcnRNYXRjaChzY29wZU5hbWUsIG5ldyBUaGVtZVRyaWVFbGVtZW50UnVsZShGb250U3R5bGUuTm9uZSwgX0EsIF9CKSk7XG5cdFx0fVxuXG5cdFx0Ly8gbWF0Y2hlcyBkZWZhdWx0c1xuXHRcdGFzc2VydE5vTWF0Y2goJycpO1xuXHRcdGFzc2VydE5vTWF0Y2goJ2JhenonKTtcblx0XHRhc3NlcnROb01hdGNoKCdhc2RmZycpO1xuXG5cdFx0Ly8gbWF0Y2hlcyBzb3VyY2Vcblx0XHRhc3NlcnRTaW1wbGVNYXRjaCgnc291cmNlJywgRm9udFN0eWxlLk5vbmUsIF9BLCBfRyk7XG5cdFx0YXNzZXJ0U2ltcGxlTWF0Y2goJ3NvdXJjZS50cycsIEZvbnRTdHlsZS5Ob25lLCBfQSwgX0cpO1xuXHRcdGFzc2VydFNpbXBsZU1hdGNoKCdzb3VyY2UudHNzJywgRm9udFN0eWxlLk5vbmUsIF9BLCBfRyk7XG5cblx0XHQvLyBtYXRjaGVzIHNvbWV0aGluZ1xuXHRcdGFzc2VydFNpbXBsZU1hdGNoKCdzb21ldGhpbmcnLCBGb250U3R5bGUuTm9uZSwgX0EsIF9HKTtcblx0XHRhc3NlcnRTaW1wbGVNYXRjaCgnc29tZXRoaW5nLnRzJywgRm9udFN0eWxlLk5vbmUsIF9BLCBfRyk7XG5cdFx0YXNzZXJ0U2ltcGxlTWF0Y2goJ3NvbWV0aGluZy50c3MnLCBGb250U3R5bGUuTm9uZSwgX0EsIF9HKTtcblxuXHRcdC8vIG1hdGNoZXMgYmF6XG5cdFx0YXNzZXJ0U2ltcGxlTWF0Y2goJ2JheicsIEZvbnRTdHlsZS5Ob25lLCBfQSwgX0MpO1xuXHRcdGFzc2VydFNpbXBsZU1hdGNoKCdiYXoudHMnLCBGb250U3R5bGUuTm9uZSwgX0EsIF9DKTtcblx0XHRhc3NlcnRTaW1wbGVNYXRjaCgnYmF6LnRzcycsIEZvbnRTdHlsZS5Ob25lLCBfQSwgX0MpO1xuXG5cdFx0Ly8gbWF0Y2hlcyBjb25zdGFudFxuXHRcdGFzc2VydFNpbXBsZU1hdGNoKCdjb25zdGFudCcsIEZvbnRTdHlsZS5JdGFsaWMsIF9ELCBfQik7XG5cdFx0YXNzZXJ0U2ltcGxlTWF0Y2goJ2NvbnN0YW50LnN0cmluZycsIEZvbnRTdHlsZS5JdGFsaWMsIF9ELCBfQik7XG5cdFx0YXNzZXJ0U2ltcGxlTWF0Y2goJ2NvbnN0YW50LmhleCcsIEZvbnRTdHlsZS5JdGFsaWMsIF9ELCBfQik7XG5cblx0XHQvLyBtYXRjaGVzIGNvbnN0YW50Lm51bWVyaWNcblx0XHRhc3NlcnRTaW1wbGVNYXRjaCgnY29uc3RhbnQubnVtZXJpYycsIEZvbnRTdHlsZS5JdGFsaWMsIF9FLCBfQik7XG5cdFx0YXNzZXJ0U2ltcGxlTWF0Y2goJ2NvbnN0YW50Lm51bWVyaWMuYmF6JywgRm9udFN0eWxlLkl0YWxpYywgX0UsIF9CKTtcblxuXHRcdC8vIG1hdGNoZXMgY29uc3RhbnQubnVtZXJpYy5oZXhcblx0XHRhc3NlcnRTaW1wbGVNYXRjaCgnY29uc3RhbnQubnVtZXJpYy5oZXgnLCBGb250U3R5bGUuQm9sZCwgX0UsIF9CKTtcblx0XHRhc3NlcnRTaW1wbGVNYXRjaCgnY29uc3RhbnQubnVtZXJpYy5oZXguYmF6JywgRm9udFN0eWxlLkJvbGQsIF9FLCBfQik7XG5cblx0XHQvLyBtYXRjaGVzIGNvbnN0YW50Lm51bWVyaWMub2N0XG5cdFx0YXNzZXJ0U2ltcGxlTWF0Y2goJ2NvbnN0YW50Lm51bWVyaWMub2N0JywgRm9udFN0eWxlLkJvbGQgfCBGb250U3R5bGUuSXRhbGljIHwgRm9udFN0eWxlLlVuZGVybGluZSwgX0UsIF9CKTtcblx0XHRhc3NlcnRTaW1wbGVNYXRjaCgnY29uc3RhbnQubnVtZXJpYy5vY3QuYmF6JywgRm9udFN0eWxlLkJvbGQgfCBGb250U3R5bGUuSXRhbGljIHwgRm9udFN0eWxlLlVuZGVybGluZSwgX0UsIF9CKTtcblxuXHRcdC8vIG1hdGNoZXMgY29uc3RhbnQubnVtZXJpYy5iaW5cblx0XHRhc3NlcnRTaW1wbGVNYXRjaCgnY29uc3RhbnQubnVtZXJpYy5iaW4nLCBGb250U3R5bGUuQm9sZCB8IEZvbnRTdHlsZS5TdHJpa2V0aHJvdWdoLCBfRSwgX0IpO1xuXHRcdGFzc2VydFNpbXBsZU1hdGNoKCdjb25zdGFudC5udW1lcmljLmJpbi5iYXonLCBGb250U3R5bGUuQm9sZCB8IEZvbnRTdHlsZS5TdHJpa2V0aHJvdWdoLCBfRSwgX0IpO1xuXG5cdFx0Ly8gbWF0Y2hlcyBjb25zdGFudC5udW1lcmljLmRlY1xuXHRcdGFzc2VydFNpbXBsZU1hdGNoKCdjb25zdGFudC5udW1lcmljLmRlYycsIEZvbnRTdHlsZS5Ob25lLCBfRiwgX0IpO1xuXHRcdGFzc2VydFNpbXBsZU1hdGNoKCdjb25zdGFudC5udW1lcmljLmRlYy5iYXonLCBGb250U3R5bGUuTm9uZSwgX0YsIF9CKTtcblxuXHRcdC8vIG1hdGNoZXMgc3RvcmFnZS5vYmplY3QuYmFyXG5cdFx0YXNzZXJ0U2ltcGxlTWF0Y2goJ3N0b3JhZ2Uub2JqZWN0LmJhcicsIEZvbnRTdHlsZS5Ob25lLCBfSCwgX0IpO1xuXHRcdGFzc2VydFNpbXBsZU1hdGNoKCdzdG9yYWdlLm9iamVjdC5iYXIuYmF6JywgRm9udFN0eWxlLk5vbmUsIF9ILCBfQik7XG5cblx0XHQvLyBkb2VzIG5vdCBtYXRjaCBzdG9yYWdlLm9iamVjdC5iYXJcblx0XHRhc3NlcnRTaW1wbGVNYXRjaCgnc3RvcmFnZS5vYmplY3QuYmFydCcsIEZvbnRTdHlsZS5Ob25lLCBfQSwgX0IpO1xuXHRcdGFzc2VydFNpbXBsZU1hdGNoKCdzdG9yYWdlLm9iamVjdCcsIEZvbnRTdHlsZS5Ob25lLCBfQSwgX0IpO1xuXHRcdGFzc2VydFNpbXBsZU1hdGNoKCdzdG9yYWdlJywgRm9udFN0eWxlLk5vbmUsIF9BLCBfQik7XG5cblx0XHRhc3NlcnRTaW1wbGVNYXRjaCgnYmFyJywgRm9udFN0eWxlLkJvbGQsIF9BLCBfQyk7XG5cdH0pO1xufSk7XG5cbnN1aXRlKCdUb2tlbiB0aGVtZSBwYXJzaW5nJywgKCkgPT4ge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ2NhbiBwYXJzZScsICgpID0+IHtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IHBhcnNlVG9rZW5UaGVtZShbXG5cdFx0XHR7IHRva2VuOiAnJywgZm9yZWdyb3VuZDogJ0Y4RjhGMicsIGJhY2tncm91bmQ6ICcyNzI4MjInIH0sXG5cdFx0XHR7IHRva2VuOiAnc291cmNlJywgYmFja2dyb3VuZDogJzEwMDAwMCcgfSxcblx0XHRcdHsgdG9rZW46ICdzb21ldGhpbmcnLCBiYWNrZ3JvdW5kOiAnMTAwMDAwJyB9LFxuXHRcdFx0eyB0b2tlbjogJ2JhcicsIGJhY2tncm91bmQ6ICcwMTAwMDAnIH0sXG5cdFx0XHR7IHRva2VuOiAnYmF6JywgYmFja2dyb3VuZDogJzAxMDAwMCcgfSxcblx0XHRcdHsgdG9rZW46ICdiYXInLCBmb250U3R5bGU6ICdib2xkJyB9LFxuXHRcdFx0eyB0b2tlbjogJ2NvbnN0YW50JywgZm9udFN0eWxlOiAnaXRhbGljJywgZm9yZWdyb3VuZDogJ2ZmMDAwMCcgfSxcblx0XHRcdHsgdG9rZW46ICdjb25zdGFudC5udW1lcmljJywgZm9yZWdyb3VuZDogJzAwZmYwMCcgfSxcblx0XHRcdHsgdG9rZW46ICdjb25zdGFudC5udW1lcmljLmhleCcsIGZvbnRTdHlsZTogJ2JvbGQnIH0sXG5cdFx0XHR7IHRva2VuOiAnY29uc3RhbnQubnVtZXJpYy5vY3QnLCBmb250U3R5bGU6ICdib2xkIGl0YWxpYyB1bmRlcmxpbmUnIH0sXG5cdFx0XHR7IHRva2VuOiAnY29uc3RhbnQubnVtZXJpYy5kZWMnLCBmb250U3R5bGU6ICcnLCBmb3JlZ3JvdW5kOiAnMDAwMGZmJyB9LFxuXHRcdF0pO1xuXG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBbXG5cdFx0XHRuZXcgUGFyc2VkVG9rZW5UaGVtZVJ1bGUoJycsIDAsIEZvbnRTdHlsZS5Ob3RTZXQsICdGOEY4RjInLCAnMjcyODIyJyksXG5cdFx0XHRuZXcgUGFyc2VkVG9rZW5UaGVtZVJ1bGUoJ3NvdXJjZScsIDEsIEZvbnRTdHlsZS5Ob3RTZXQsIG51bGwsICcxMDAwMDAnKSxcblx0XHRcdG5ldyBQYXJzZWRUb2tlblRoZW1lUnVsZSgnc29tZXRoaW5nJywgMiwgRm9udFN0eWxlLk5vdFNldCwgbnVsbCwgJzEwMDAwMCcpLFxuXHRcdFx0bmV3IFBhcnNlZFRva2VuVGhlbWVSdWxlKCdiYXInLCAzLCBGb250U3R5bGUuTm90U2V0LCBudWxsLCAnMDEwMDAwJyksXG5cdFx0XHRuZXcgUGFyc2VkVG9rZW5UaGVtZVJ1bGUoJ2JheicsIDQsIEZvbnRTdHlsZS5Ob3RTZXQsIG51bGwsICcwMTAwMDAnKSxcblx0XHRcdG5ldyBQYXJzZWRUb2tlblRoZW1lUnVsZSgnYmFyJywgNSwgRm9udFN0eWxlLkJvbGQsIG51bGwsIG51bGwpLFxuXHRcdFx0bmV3IFBhcnNlZFRva2VuVGhlbWVSdWxlKCdjb25zdGFudCcsIDYsIEZvbnRTdHlsZS5JdGFsaWMsICdmZjAwMDAnLCBudWxsKSxcblx0XHRcdG5ldyBQYXJzZWRUb2tlblRoZW1lUnVsZSgnY29uc3RhbnQubnVtZXJpYycsIDcsIEZvbnRTdHlsZS5Ob3RTZXQsICcwMGZmMDAnLCBudWxsKSxcblx0XHRcdG5ldyBQYXJzZWRUb2tlblRoZW1lUnVsZSgnY29uc3RhbnQubnVtZXJpYy5oZXgnLCA4LCBGb250U3R5bGUuQm9sZCwgbnVsbCwgbnVsbCksXG5cdFx0XHRuZXcgUGFyc2VkVG9rZW5UaGVtZVJ1bGUoJ2NvbnN0YW50Lm51bWVyaWMub2N0JywgOSwgRm9udFN0eWxlLkJvbGQgfCBGb250U3R5bGUuSXRhbGljIHwgRm9udFN0eWxlLlVuZGVybGluZSwgbnVsbCwgbnVsbCksXG5cdFx0XHRuZXcgUGFyc2VkVG9rZW5UaGVtZVJ1bGUoJ2NvbnN0YW50Lm51bWVyaWMuZGVjJywgMTAsIEZvbnRTdHlsZS5Ob25lLCAnMDAwMGZmJywgbnVsbCksXG5cdFx0XTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBleHBlY3RlZCk7XG5cdH0pO1xufSk7XG5cbnN1aXRlKCdUb2tlbiB0aGVtZSByZXNvbHZpbmcnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnc3RyY21wIHdvcmtzJywgKCkgPT4ge1xuXHRcdGNvbnN0IGFjdHVhbCA9IFsnYmFyJywgJ3onLCAnenUnLCAnYScsICdhYicsICcnXS5zb3J0KHN0cmNtcCk7XG5cblx0XHRjb25zdCBleHBlY3RlZCA9IFsnJywgJ2EnLCAnYWInLCAnYmFyJywgJ3onLCAnenUnXTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdhbHdheXMgaGFzIGRlZmF1bHRzJywgKCkgPT4ge1xuXHRcdGNvbnN0IGFjdHVhbCA9IFRva2VuVGhlbWUuY3JlYXRlRnJvbVBhcnNlZFRva2VuVGhlbWUoW10sIFtdKTtcblx0XHRjb25zdCBjb2xvck1hcCA9IG5ldyBDb2xvck1hcCgpO1xuXHRcdGNvbnN0IF9BID0gY29sb3JNYXAuZ2V0SWQoJzAwMDAwMCcpO1xuXHRcdGNvbnN0IF9CID0gY29sb3JNYXAuZ2V0SWQoJ2ZmZmZmZicpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmdldENvbG9yTWFwKCksIGNvbG9yTWFwLmdldENvbG9yTWFwKCkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmdldFRoZW1lVHJpZUVsZW1lbnQoKSwgbmV3IEV4dGVybmFsVGhlbWVUcmllRWxlbWVudChuZXcgVGhlbWVUcmllRWxlbWVudFJ1bGUoRm9udFN0eWxlLk5vbmUsIF9BLCBfQikpKTtcblx0fSk7XG5cblx0dGVzdCgncmVzcGVjdHMgaW5jb21pbmcgZGVmYXVsdHMgMScsICgpID0+IHtcblx0XHRjb25zdCBhY3R1YWwgPSBUb2tlblRoZW1lLmNyZWF0ZUZyb21QYXJzZWRUb2tlblRoZW1lKFtcblx0XHRcdG5ldyBQYXJzZWRUb2tlblRoZW1lUnVsZSgnJywgLTEsIEZvbnRTdHlsZS5Ob3RTZXQsIG51bGwsIG51bGwpXG5cdFx0XSwgW10pO1xuXHRcdGNvbnN0IGNvbG9yTWFwID0gbmV3IENvbG9yTWFwKCk7XG5cdFx0Y29uc3QgX0EgPSBjb2xvck1hcC5nZXRJZCgnMDAwMDAwJyk7XG5cdFx0Y29uc3QgX0IgPSBjb2xvck1hcC5nZXRJZCgnZmZmZmZmJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwuZ2V0Q29sb3JNYXAoKSwgY29sb3JNYXAuZ2V0Q29sb3JNYXAoKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwuZ2V0VGhlbWVUcmllRWxlbWVudCgpLCBuZXcgRXh0ZXJuYWxUaGVtZVRyaWVFbGVtZW50KG5ldyBUaGVtZVRyaWVFbGVtZW50UnVsZShGb250U3R5bGUuTm9uZSwgX0EsIF9CKSkpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNwZWN0cyBpbmNvbWluZyBkZWZhdWx0cyAyJywgKCkgPT4ge1xuXHRcdGNvbnN0IGFjdHVhbCA9IFRva2VuVGhlbWUuY3JlYXRlRnJvbVBhcnNlZFRva2VuVGhlbWUoW1xuXHRcdFx0bmV3IFBhcnNlZFRva2VuVGhlbWVSdWxlKCcnLCAtMSwgRm9udFN0eWxlLk5vbmUsIG51bGwsIG51bGwpXG5cdFx0XSwgW10pO1xuXHRcdGNvbnN0IGNvbG9yTWFwID0gbmV3IENvbG9yTWFwKCk7XG5cdFx0Y29uc3QgX0EgPSBjb2xvck1hcC5nZXRJZCgnMDAwMDAwJyk7XG5cdFx0Y29uc3QgX0IgPSBjb2xvck1hcC5nZXRJZCgnZmZmZmZmJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwuZ2V0Q29sb3JNYXAoKSwgY29sb3JNYXAuZ2V0Q29sb3JNYXAoKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwuZ2V0VGhlbWVUcmllRWxlbWVudCgpLCBuZXcgRXh0ZXJuYWxUaGVtZVRyaWVFbGVtZW50KG5ldyBUaGVtZVRyaWVFbGVtZW50UnVsZShGb250U3R5bGUuTm9uZSwgX0EsIF9CKSkpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNwZWN0cyBpbmNvbWluZyBkZWZhdWx0cyAzJywgKCkgPT4ge1xuXHRcdGNvbnN0IGFjdHVhbCA9IFRva2VuVGhlbWUuY3JlYXRlRnJvbVBhcnNlZFRva2VuVGhlbWUoW1xuXHRcdFx0bmV3IFBhcnNlZFRva2VuVGhlbWVSdWxlKCcnLCAtMSwgRm9udFN0eWxlLkJvbGQsIG51bGwsIG51bGwpXG5cdFx0XSwgW10pO1xuXHRcdGNvbnN0IGNvbG9yTWFwID0gbmV3IENvbG9yTWFwKCk7XG5cdFx0Y29uc3QgX0EgPSBjb2xvck1hcC5nZXRJZCgnMDAwMDAwJyk7XG5cdFx0Y29uc3QgX0IgPSBjb2xvck1hcC5nZXRJZCgnZmZmZmZmJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwuZ2V0Q29sb3JNYXAoKSwgY29sb3JNYXAuZ2V0Q29sb3JNYXAoKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwuZ2V0VGhlbWVUcmllRWxlbWVudCgpLCBuZXcgRXh0ZXJuYWxUaGVtZVRyaWVFbGVtZW50KG5ldyBUaGVtZVRyaWVFbGVtZW50UnVsZShGb250U3R5bGUuQm9sZCwgX0EsIF9CKSkpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNwZWN0cyBpbmNvbWluZyBkZWZhdWx0cyA0JywgKCkgPT4ge1xuXHRcdGNvbnN0IGFjdHVhbCA9IFRva2VuVGhlbWUuY3JlYXRlRnJvbVBhcnNlZFRva2VuVGhlbWUoW1xuXHRcdFx0bmV3IFBhcnNlZFRva2VuVGhlbWVSdWxlKCcnLCAtMSwgRm9udFN0eWxlLk5vdFNldCwgJ2ZmMDAwMCcsIG51bGwpXG5cdFx0XSwgW10pO1xuXHRcdGNvbnN0IGNvbG9yTWFwID0gbmV3IENvbG9yTWFwKCk7XG5cdFx0Y29uc3QgX0EgPSBjb2xvck1hcC5nZXRJZCgnZmYwMDAwJyk7XG5cdFx0Y29uc3QgX0IgPSBjb2xvck1hcC5nZXRJZCgnZmZmZmZmJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwuZ2V0Q29sb3JNYXAoKSwgY29sb3JNYXAuZ2V0Q29sb3JNYXAoKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwuZ2V0VGhlbWVUcmllRWxlbWVudCgpLCBuZXcgRXh0ZXJuYWxUaGVtZVRyaWVFbGVtZW50KG5ldyBUaGVtZVRyaWVFbGVtZW50UnVsZShGb250U3R5bGUuTm9uZSwgX0EsIF9CKSkpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNwZWN0cyBpbmNvbWluZyBkZWZhdWx0cyA1JywgKCkgPT4ge1xuXHRcdGNvbnN0IGFjdHVhbCA9IFRva2VuVGhlbWUuY3JlYXRlRnJvbVBhcnNlZFRva2VuVGhlbWUoW1xuXHRcdFx0bmV3IFBhcnNlZFRva2VuVGhlbWVSdWxlKCcnLCAtMSwgRm9udFN0eWxlLk5vdFNldCwgbnVsbCwgJ2ZmMDAwMCcpXG5cdFx0XSwgW10pO1xuXHRcdGNvbnN0IGNvbG9yTWFwID0gbmV3IENvbG9yTWFwKCk7XG5cdFx0Y29uc3QgX0EgPSBjb2xvck1hcC5nZXRJZCgnMDAwMDAwJyk7XG5cdFx0Y29uc3QgX0IgPSBjb2xvck1hcC5nZXRJZCgnZmYwMDAwJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwuZ2V0Q29sb3JNYXAoKSwgY29sb3JNYXAuZ2V0Q29sb3JNYXAoKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwuZ2V0VGhlbWVUcmllRWxlbWVudCgpLCBuZXcgRXh0ZXJuYWxUaGVtZVRyaWVFbGVtZW50KG5ldyBUaGVtZVRyaWVFbGVtZW50UnVsZShGb250U3R5bGUuTm9uZSwgX0EsIF9CKSkpO1xuXHR9KTtcblxuXHR0ZXN0KCdjYW4gbWVyZ2UgaW5jb21pbmcgZGVmYXVsdHMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgYWN0dWFsID0gVG9rZW5UaGVtZS5jcmVhdGVGcm9tUGFyc2VkVG9rZW5UaGVtZShbXG5cdFx0XHRuZXcgUGFyc2VkVG9rZW5UaGVtZVJ1bGUoJycsIC0xLCBGb250U3R5bGUuTm90U2V0LCBudWxsLCAnZmYwMDAwJyksXG5cdFx0XHRuZXcgUGFyc2VkVG9rZW5UaGVtZVJ1bGUoJycsIC0xLCBGb250U3R5bGUuTm90U2V0LCAnMDBmZjAwJywgbnVsbCksXG5cdFx0XHRuZXcgUGFyc2VkVG9rZW5UaGVtZVJ1bGUoJycsIC0xLCBGb250U3R5bGUuQm9sZCwgbnVsbCwgbnVsbCksXG5cdFx0XSwgW10pO1xuXHRcdGNvbnN0IGNvbG9yTWFwID0gbmV3IENvbG9yTWFwKCk7XG5cdFx0Y29uc3QgX0EgPSBjb2xvck1hcC5nZXRJZCgnMDBmZjAwJyk7XG5cdFx0Y29uc3QgX0IgPSBjb2xvck1hcC5nZXRJZCgnZmYwMDAwJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwuZ2V0Q29sb3JNYXAoKSwgY29sb3JNYXAuZ2V0Q29sb3JNYXAoKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwuZ2V0VGhlbWVUcmllRWxlbWVudCgpLCBuZXcgRXh0ZXJuYWxUaGVtZVRyaWVFbGVtZW50KG5ldyBUaGVtZVRyaWVFbGVtZW50UnVsZShGb250U3R5bGUuQm9sZCwgX0EsIF9CKSkpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWZhdWx0cyBhcmUgaW5oZXJpdGVkJywgKCkgPT4ge1xuXHRcdGNvbnN0IGFjdHVhbCA9IFRva2VuVGhlbWUuY3JlYXRlRnJvbVBhcnNlZFRva2VuVGhlbWUoW1xuXHRcdFx0bmV3IFBhcnNlZFRva2VuVGhlbWVSdWxlKCcnLCAtMSwgRm9udFN0eWxlLk5vdFNldCwgJ0Y4RjhGMicsICcyNzI4MjInKSxcblx0XHRcdG5ldyBQYXJzZWRUb2tlblRoZW1lUnVsZSgndmFyJywgLTEsIEZvbnRTdHlsZS5Ob3RTZXQsICdmZjAwMDAnLCBudWxsKVxuXHRcdF0sIFtdKTtcblx0XHRjb25zdCBjb2xvck1hcCA9IG5ldyBDb2xvck1hcCgpO1xuXHRcdGNvbnN0IF9BID0gY29sb3JNYXAuZ2V0SWQoJ0Y4RjhGMicpO1xuXHRcdGNvbnN0IF9CID0gY29sb3JNYXAuZ2V0SWQoJzI3MjgyMicpO1xuXHRcdGNvbnN0IF9DID0gY29sb3JNYXAuZ2V0SWQoJ2ZmMDAwMCcpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmdldENvbG9yTWFwKCksIGNvbG9yTWFwLmdldENvbG9yTWFwKCkpO1xuXHRcdGNvbnN0IHJvb3QgPSBuZXcgRXh0ZXJuYWxUaGVtZVRyaWVFbGVtZW50KG5ldyBUaGVtZVRyaWVFbGVtZW50UnVsZShGb250U3R5bGUuTm9uZSwgX0EsIF9CKSwge1xuXHRcdFx0J3Zhcic6IG5ldyBFeHRlcm5hbFRoZW1lVHJpZUVsZW1lbnQobmV3IFRoZW1lVHJpZUVsZW1lbnRSdWxlKEZvbnRTdHlsZS5Ob25lLCBfQywgX0IpKVxuXHRcdH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmdldFRoZW1lVHJpZUVsZW1lbnQoKSwgcm9vdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NhbWUgcnVsZXMgZ2V0IG1lcmdlZCcsICgpID0+IHtcblx0XHRjb25zdCBhY3R1YWwgPSBUb2tlblRoZW1lLmNyZWF0ZUZyb21QYXJzZWRUb2tlblRoZW1lKFtcblx0XHRcdG5ldyBQYXJzZWRUb2tlblRoZW1lUnVsZSgnJywgLTEsIEZvbnRTdHlsZS5Ob3RTZXQsICdGOEY4RjInLCAnMjcyODIyJyksXG5cdFx0XHRuZXcgUGFyc2VkVG9rZW5UaGVtZVJ1bGUoJ3ZhcicsIDEsIEZvbnRTdHlsZS5Cb2xkLCBudWxsLCBudWxsKSxcblx0XHRcdG5ldyBQYXJzZWRUb2tlblRoZW1lUnVsZSgndmFyJywgMCwgRm9udFN0eWxlLk5vdFNldCwgJ2ZmMDAwMCcsIG51bGwpLFxuXHRcdF0sIFtdKTtcblx0XHRjb25zdCBjb2xvck1hcCA9IG5ldyBDb2xvck1hcCgpO1xuXHRcdGNvbnN0IF9BID0gY29sb3JNYXAuZ2V0SWQoJ0Y4RjhGMicpO1xuXHRcdGNvbnN0IF9CID0gY29sb3JNYXAuZ2V0SWQoJzI3MjgyMicpO1xuXHRcdGNvbnN0IF9DID0gY29sb3JNYXAuZ2V0SWQoJ2ZmMDAwMCcpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmdldENvbG9yTWFwKCksIGNvbG9yTWFwLmdldENvbG9yTWFwKCkpO1xuXHRcdGNvbnN0IHJvb3QgPSBuZXcgRXh0ZXJuYWxUaGVtZVRyaWVFbGVtZW50KG5ldyBUaGVtZVRyaWVFbGVtZW50UnVsZShGb250U3R5bGUuTm9uZSwgX0EsIF9CKSwge1xuXHRcdFx0J3Zhcic6IG5ldyBFeHRlcm5hbFRoZW1lVHJpZUVsZW1lbnQobmV3IFRoZW1lVHJpZUVsZW1lbnRSdWxlKEZvbnRTdHlsZS5Cb2xkLCBfQywgX0IpKVxuXHRcdH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmdldFRoZW1lVHJpZUVsZW1lbnQoKSwgcm9vdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3J1bGVzIGFyZSBpbmhlcml0ZWQgMScsICgpID0+IHtcblx0XHRjb25zdCBhY3R1YWwgPSBUb2tlblRoZW1lLmNyZWF0ZUZyb21QYXJzZWRUb2tlblRoZW1lKFtcblx0XHRcdG5ldyBQYXJzZWRUb2tlblRoZW1lUnVsZSgnJywgLTEsIEZvbnRTdHlsZS5Ob3RTZXQsICdGOEY4RjInLCAnMjcyODIyJyksXG5cdFx0XHRuZXcgUGFyc2VkVG9rZW5UaGVtZVJ1bGUoJ3ZhcicsIC0xLCBGb250U3R5bGUuQm9sZCwgJ2ZmMDAwMCcsIG51bGwpLFxuXHRcdFx0bmV3IFBhcnNlZFRva2VuVGhlbWVSdWxlKCd2YXIuaWRlbnRpZmllcicsIC0xLCBGb250U3R5bGUuTm90U2V0LCAnMDBmZjAwJywgbnVsbCksXG5cdFx0XSwgW10pO1xuXHRcdGNvbnN0IGNvbG9yTWFwID0gbmV3IENvbG9yTWFwKCk7XG5cdFx0Y29uc3QgX0EgPSBjb2xvck1hcC5nZXRJZCgnRjhGOEYyJyk7XG5cdFx0Y29uc3QgX0IgPSBjb2xvck1hcC5nZXRJZCgnMjcyODIyJyk7XG5cdFx0Y29uc3QgX0MgPSBjb2xvck1hcC5nZXRJZCgnZmYwMDAwJyk7XG5cdFx0Y29uc3QgX0QgPSBjb2xvck1hcC5nZXRJZCgnMDBmZjAwJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwuZ2V0Q29sb3JNYXAoKSwgY29sb3JNYXAuZ2V0Q29sb3JNYXAoKSk7XG5cdFx0Y29uc3Qgcm9vdCA9IG5ldyBFeHRlcm5hbFRoZW1lVHJpZUVsZW1lbnQobmV3IFRoZW1lVHJpZUVsZW1lbnRSdWxlKEZvbnRTdHlsZS5Ob25lLCBfQSwgX0IpLCB7XG5cdFx0XHQndmFyJzogbmV3IEV4dGVybmFsVGhlbWVUcmllRWxlbWVudChuZXcgVGhlbWVUcmllRWxlbWVudFJ1bGUoRm9udFN0eWxlLkJvbGQsIF9DLCBfQiksIHtcblx0XHRcdFx0J2lkZW50aWZpZXInOiBuZXcgRXh0ZXJuYWxUaGVtZVRyaWVFbGVtZW50KG5ldyBUaGVtZVRyaWVFbGVtZW50UnVsZShGb250U3R5bGUuQm9sZCwgX0QsIF9CKSlcblx0XHRcdH0pXG5cdFx0fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwuZ2V0VGhlbWVUcmllRWxlbWVudCgpLCByb290KTtcblx0fSk7XG5cblx0dGVzdCgncnVsZXMgYXJlIGluaGVyaXRlZCAyJywgKCkgPT4ge1xuXHRcdGNvbnN0IGFjdHVhbCA9IFRva2VuVGhlbWUuY3JlYXRlRnJvbVBhcnNlZFRva2VuVGhlbWUoW1xuXHRcdFx0bmV3IFBhcnNlZFRva2VuVGhlbWVSdWxlKCcnLCAtMSwgRm9udFN0eWxlLk5vdFNldCwgJ0Y4RjhGMicsICcyNzI4MjInKSxcblx0XHRcdG5ldyBQYXJzZWRUb2tlblRoZW1lUnVsZSgndmFyJywgLTEsIEZvbnRTdHlsZS5Cb2xkLCAnZmYwMDAwJywgbnVsbCksXG5cdFx0XHRuZXcgUGFyc2VkVG9rZW5UaGVtZVJ1bGUoJ3Zhci5pZGVudGlmaWVyJywgLTEsIEZvbnRTdHlsZS5Ob3RTZXQsICcwMGZmMDAnLCBudWxsKSxcblx0XHRcdG5ldyBQYXJzZWRUb2tlblRoZW1lUnVsZSgnY29uc3RhbnQnLCA0LCBGb250U3R5bGUuSXRhbGljLCAnMTAwMDAwJywgbnVsbCksXG5cdFx0XHRuZXcgUGFyc2VkVG9rZW5UaGVtZVJ1bGUoJ2NvbnN0YW50Lm51bWVyaWMnLCA1LCBGb250U3R5bGUuTm90U2V0LCAnMjAwMDAwJywgbnVsbCksXG5cdFx0XHRuZXcgUGFyc2VkVG9rZW5UaGVtZVJ1bGUoJ2NvbnN0YW50Lm51bWVyaWMuaGV4JywgNiwgRm9udFN0eWxlLkJvbGQsIG51bGwsIG51bGwpLFxuXHRcdFx0bmV3IFBhcnNlZFRva2VuVGhlbWVSdWxlKCdjb25zdGFudC5udW1lcmljLm9jdCcsIDcsIEZvbnRTdHlsZS5Cb2xkIHwgRm9udFN0eWxlLkl0YWxpYyB8IEZvbnRTdHlsZS5VbmRlcmxpbmUsIG51bGwsIG51bGwpLFxuXHRcdFx0bmV3IFBhcnNlZFRva2VuVGhlbWVSdWxlKCdjb25zdGFudC5udW1lcmljLmRlYycsIDgsIEZvbnRTdHlsZS5Ob25lLCAnMzAwMDAwJywgbnVsbCksXG5cdFx0XSwgW10pO1xuXHRcdGNvbnN0IGNvbG9yTWFwID0gbmV3IENvbG9yTWFwKCk7XG5cdFx0Y29uc3QgX0EgPSBjb2xvck1hcC5nZXRJZCgnRjhGOEYyJyk7XG5cdFx0Y29uc3QgX0IgPSBjb2xvck1hcC5nZXRJZCgnMjcyODIyJyk7XG5cdFx0Y29uc3QgX0MgPSBjb2xvck1hcC5nZXRJZCgnMTAwMDAwJyk7XG5cdFx0Y29uc3QgX0QgPSBjb2xvck1hcC5nZXRJZCgnMjAwMDAwJyk7XG5cdFx0Y29uc3QgX0UgPSBjb2xvck1hcC5nZXRJZCgnMzAwMDAwJyk7XG5cdFx0Y29uc3QgX0YgPSBjb2xvck1hcC5nZXRJZCgnZmYwMDAwJyk7XG5cdFx0Y29uc3QgX0cgPSBjb2xvck1hcC5nZXRJZCgnMDBmZjAwJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwuZ2V0Q29sb3JNYXAoKSwgY29sb3JNYXAuZ2V0Q29sb3JNYXAoKSk7XG5cdFx0Y29uc3Qgcm9vdCA9IG5ldyBFeHRlcm5hbFRoZW1lVHJpZUVsZW1lbnQobmV3IFRoZW1lVHJpZUVsZW1lbnRSdWxlKEZvbnRTdHlsZS5Ob25lLCBfQSwgX0IpLCB7XG5cdFx0XHQndmFyJzogbmV3IEV4dGVybmFsVGhlbWVUcmllRWxlbWVudChuZXcgVGhlbWVUcmllRWxlbWVudFJ1bGUoRm9udFN0eWxlLkJvbGQsIF9GLCBfQiksIHtcblx0XHRcdFx0J2lkZW50aWZpZXInOiBuZXcgRXh0ZXJuYWxUaGVtZVRyaWVFbGVtZW50KG5ldyBUaGVtZVRyaWVFbGVtZW50UnVsZShGb250U3R5bGUuQm9sZCwgX0csIF9CKSlcblx0XHRcdH0pLFxuXHRcdFx0J2NvbnN0YW50JzogbmV3IEV4dGVybmFsVGhlbWVUcmllRWxlbWVudChuZXcgVGhlbWVUcmllRWxlbWVudFJ1bGUoRm9udFN0eWxlLkl0YWxpYywgX0MsIF9CKSwge1xuXHRcdFx0XHQnbnVtZXJpYyc6IG5ldyBFeHRlcm5hbFRoZW1lVHJpZUVsZW1lbnQobmV3IFRoZW1lVHJpZUVsZW1lbnRSdWxlKEZvbnRTdHlsZS5JdGFsaWMsIF9ELCBfQiksIHtcblx0XHRcdFx0XHQnaGV4JzogbmV3IEV4dGVybmFsVGhlbWVUcmllRWxlbWVudChuZXcgVGhlbWVUcmllRWxlbWVudFJ1bGUoRm9udFN0eWxlLkJvbGQsIF9ELCBfQikpLFxuXHRcdFx0XHRcdCdvY3QnOiBuZXcgRXh0ZXJuYWxUaGVtZVRyaWVFbGVtZW50KG5ldyBUaGVtZVRyaWVFbGVtZW50UnVsZShGb250U3R5bGUuQm9sZCB8IEZvbnRTdHlsZS5JdGFsaWMgfCBGb250U3R5bGUuVW5kZXJsaW5lLCBfRCwgX0IpKSxcblx0XHRcdFx0XHQnZGVjJzogbmV3IEV4dGVybmFsVGhlbWVUcmllRWxlbWVudChuZXcgVGhlbWVUcmllRWxlbWVudFJ1bGUoRm9udFN0eWxlLk5vbmUsIF9FLCBfQikpLFxuXHRcdFx0XHR9KVxuXHRcdFx0fSlcblx0XHR9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5nZXRUaGVtZVRyaWVFbGVtZW50KCksIHJvb3QpO1xuXHR9KTtcblxuXHR0ZXN0KCdjdXN0b20gY29sb3JzIGFyZSBmaXJzdCBpbiBjb2xvciBtYXAnLCAoKSA9PiB7XG5cdFx0Y29uc3QgYWN0dWFsID0gVG9rZW5UaGVtZS5jcmVhdGVGcm9tUGFyc2VkVG9rZW5UaGVtZShbXG5cdFx0XHRuZXcgUGFyc2VkVG9rZW5UaGVtZVJ1bGUoJ3ZhcicsIC0xLCBGb250U3R5bGUuTm90U2V0LCAnRjhGOEYyJywgbnVsbClcblx0XHRdLCBbXG5cdFx0XHQnMDAwMDAwJywgJ0ZGRkZGRicsICcwRjBGMEYnXG5cdFx0XSk7XG5cdFx0Y29uc3QgY29sb3JNYXAgPSBuZXcgQ29sb3JNYXAoKTtcblx0XHRjb2xvck1hcC5nZXRJZCgnMDAwMDAwJyk7XG5cdFx0Y29sb3JNYXAuZ2V0SWQoJ0ZGRkZGRicpO1xuXHRcdGNvbG9yTWFwLmdldElkKCcwRjBGMEYnKTtcblx0XHRjb2xvck1hcC5nZXRJZCgnRjhGOEYyJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwuZ2V0Q29sb3JNYXAoKSwgY29sb3JNYXAuZ2V0Q29sb3JNYXAoKSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxVQUFVLDBCQUEwQixzQkFBc0Isc0JBQXNCLFlBQVksaUJBQWlCLGNBQWM7QUFFcEksTUFBTSx3QkFBd0IsTUFBTTtBQUVuQywwQ0FBd0M7QUFFeEMsT0FBSywyQ0FBMkMsTUFBTTtBQUNyRCxVQUFNLFFBQVEsV0FBVyx3QkFBd0I7QUFBQSxNQUNoRCxFQUFFLE9BQU8sSUFBSSxZQUFZLFVBQVUsWUFBWSxTQUFTO0FBQUEsTUFDeEQsRUFBRSxPQUFPLDRDQUE0QyxZQUFZLFNBQVM7QUFBQSxNQUMxRSxFQUFFLE9BQU8saUNBQWlDLFlBQVksU0FBUztBQUFBLElBQ2hFLEdBQUcsQ0FBQyxDQUFDO0FBRUwsVUFBTSxXQUFXLElBQUksU0FBUztBQUM5QixhQUFTLE1BQU0sUUFBUTtBQUN2QixVQUFNLEtBQUssU0FBUyxNQUFNLFFBQVE7QUFDbEMsYUFBUyxNQUFNLFFBQVE7QUFDdkIsVUFBTSxLQUFLLFNBQVMsTUFBTSxRQUFRO0FBRWxDLFVBQU0sU0FBUyxNQUFNLE9BQU8sMENBQTBDO0FBRXRFLFdBQU8sZ0JBQWdCLFFBQVEsSUFBSSxx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
