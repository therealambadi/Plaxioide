import assert from "assert";
import { anyScore, createMatches, fuzzyScore, fuzzyScoreGraceful, fuzzyScoreGracefulAggressive, matchesCamelCase, matchesContiguousSubString, matchesPrefix, matchesStrictPrefix, matchesSubString, matchesWords, or } from "../../common/filters.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "./utils.js";
function filterOk(filter, word, wordToMatchAgainst, highlights) {
  const r = filter(word, wordToMatchAgainst);
  assert(r, `${word} didn't match ${wordToMatchAgainst}`);
  if (highlights) {
    assert.deepStrictEqual(r, highlights);
  }
}
function filterNotOk(filter, word, wordToMatchAgainst) {
  assert(!filter(word, wordToMatchAgainst), `${word} matched ${wordToMatchAgainst}`);
}
suite("Filters", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("or", () => {
    let filter;
    let counters;
    const newFilter = function(i, r) {
      return function() {
        counters[i]++;
        return r;
      };
    };
    counters = [0, 0];
    filter = or(newFilter(0, false), newFilter(1, false));
    filterNotOk(filter, "anything", "anything");
    assert.deepStrictEqual(counters, [1, 1]);
    counters = [0, 0];
    filter = or(newFilter(0, true), newFilter(1, false));
    filterOk(filter, "anything", "anything");
    assert.deepStrictEqual(counters, [1, 0]);
    counters = [0, 0];
    filter = or(newFilter(0, true), newFilter(1, true));
    filterOk(filter, "anything", "anything");
    assert.deepStrictEqual(counters, [1, 0]);
    counters = [0, 0];
    filter = or(newFilter(0, false), newFilter(1, true));
    filterOk(filter, "anything", "anything");
    assert.deepStrictEqual(counters, [1, 1]);
  });
  test("PrefixFilter - case sensitive", function() {
    filterNotOk(matchesStrictPrefix, "", "");
    filterOk(matchesStrictPrefix, "", "anything", []);
    filterOk(matchesStrictPrefix, "alpha", "alpha", [{ start: 0, end: 5 }]);
    filterOk(matchesStrictPrefix, "alpha", "alphasomething", [{ start: 0, end: 5 }]);
    filterNotOk(matchesStrictPrefix, "alpha", "alp");
    filterOk(matchesStrictPrefix, "a", "alpha", [{ start: 0, end: 1 }]);
    filterNotOk(matchesStrictPrefix, "x", "alpha");
    filterNotOk(matchesStrictPrefix, "A", "alpha");
    filterNotOk(matchesStrictPrefix, "AlPh", "alPHA");
  });
  test("PrefixFilter - ignore case", function() {
    filterOk(matchesPrefix, "alpha", "alpha", [{ start: 0, end: 5 }]);
    filterOk(matchesPrefix, "alpha", "alphasomething", [{ start: 0, end: 5 }]);
    filterNotOk(matchesPrefix, "alpha", "alp");
    filterOk(matchesPrefix, "a", "alpha", [{ start: 0, end: 1 }]);
    filterOk(matchesPrefix, "\xE4", "\xC4lpha", [{ start: 0, end: 1 }]);
    filterNotOk(matchesPrefix, "x", "alpha");
    filterOk(matchesPrefix, "A", "alpha", [{ start: 0, end: 1 }]);
    filterOk(matchesPrefix, "AlPh", "alPHA", [{ start: 0, end: 4 }]);
    filterNotOk(matchesPrefix, "T", "4");
  });
  test("CamelCaseFilter", () => {
    filterNotOk(matchesCamelCase, "", "");
    filterOk(matchesCamelCase, "", "anything", []);
    filterOk(matchesCamelCase, "alpha", "alpha", [{ start: 0, end: 5 }]);
    filterOk(matchesCamelCase, "AlPhA", "alpha", [{ start: 0, end: 5 }]);
    filterOk(matchesCamelCase, "alpha", "alphasomething", [{ start: 0, end: 5 }]);
    filterNotOk(matchesCamelCase, "alpha", "alp");
    filterOk(matchesCamelCase, "c", "CamelCaseRocks", [
      { start: 0, end: 1 }
    ]);
    filterOk(matchesCamelCase, "cc", "CamelCaseRocks", [
      { start: 0, end: 1 },
      { start: 5, end: 6 }
    ]);
    filterOk(matchesCamelCase, "ccr", "CamelCaseRocks", [
      { start: 0, end: 1 },
      { start: 5, end: 6 },
      { start: 9, end: 10 }
    ]);
    filterOk(matchesCamelCase, "cacr", "CamelCaseRocks", [
      { start: 0, end: 2 },
      { start: 5, end: 6 },
      { start: 9, end: 10 }
    ]);
    filterOk(matchesCamelCase, "cacar", "CamelCaseRocks", [
      { start: 0, end: 2 },
      { start: 5, end: 7 },
      { start: 9, end: 10 }
    ]);
    filterOk(matchesCamelCase, "ccarocks", "CamelCaseRocks", [
      { start: 0, end: 1 },
      { start: 5, end: 7 },
      { start: 9, end: 14 }
    ]);
    filterOk(matchesCamelCase, "cr", "CamelCaseRocks", [
      { start: 0, end: 1 },
      { start: 9, end: 10 }
    ]);
    filterOk(matchesCamelCase, "fba", "FooBarAbe", [
      { start: 0, end: 1 },
      { start: 3, end: 5 }
    ]);
    filterOk(matchesCamelCase, "fbar", "FooBarAbe", [
      { start: 0, end: 1 },
      { start: 3, end: 6 }
    ]);
    filterOk(matchesCamelCase, "fbara", "FooBarAbe", [
      { start: 0, end: 1 },
      { start: 3, end: 7 }
    ]);
    filterOk(matchesCamelCase, "fbaa", "FooBarAbe", [
      { start: 0, end: 1 },
      { start: 3, end: 5 },
      { start: 6, end: 7 }
    ]);
    filterOk(matchesCamelCase, "fbaab", "FooBarAbe", [
      { start: 0, end: 1 },
      { start: 3, end: 5 },
      { start: 6, end: 8 }
    ]);
    filterOk(matchesCamelCase, "c2d", "canvasCreation2D", [
      { start: 0, end: 1 },
      { start: 14, end: 16 }
    ]);
    filterOk(matchesCamelCase, "cce", "_canvasCreationEvent", [
      { start: 1, end: 2 },
      { start: 7, end: 8 },
      { start: 15, end: 16 }
    ]);
  });
  test("CamelCaseFilter - #19256", function() {
    assert(matchesCamelCase("Debug Console", "Open: Debug Console"));
    assert(matchesCamelCase("Debug console", "Open: Debug Console"));
    assert(matchesCamelCase("debug console", "Open: Debug Console"));
  });
  test("matchesContiguousSubString", () => {
    filterOk(matchesContiguousSubString, "cela", "cancelAnimationFrame()", [
      { start: 3, end: 7 }
    ]);
  });
  test("matchesSubString", () => {
    filterOk(matchesSubString, "cmm", "cancelAnimationFrame()", [
      { start: 0, end: 1 },
      { start: 9, end: 10 },
      { start: 18, end: 19 }
    ]);
    filterOk(matchesSubString, "abc", "abcabc", [
      { start: 0, end: 3 }
    ]);
    filterOk(matchesSubString, "abc", "aaabbbccc", [
      { start: 0, end: 1 },
      { start: 3, end: 4 },
      { start: 6, end: 7 }
    ]);
  });
  test("matchesSubString performance (#35346)", function() {
    filterNotOk(matchesSubString, "aaaaaaaaaaaaaaaaaaaax", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  });
  test("WordFilter", () => {
    filterOk(matchesWords, "alpha", "alpha", [{ start: 0, end: 5 }]);
    filterOk(matchesWords, "alpha", "alphasomething", [{ start: 0, end: 5 }]);
    filterNotOk(matchesWords, "alpha", "alp");
    filterOk(matchesWords, "a", "alpha", [{ start: 0, end: 1 }]);
    filterNotOk(matchesWords, "x", "alpha");
    filterOk(matchesWords, "A", "alpha", [{ start: 0, end: 1 }]);
    filterOk(matchesWords, "AlPh", "alPHA", [{ start: 0, end: 4 }]);
    assert(matchesWords("Debug Console", "Open: Debug Console"));
    filterOk(matchesWords, "gp", "Git: Pull", [{ start: 0, end: 1 }, { start: 5, end: 6 }]);
    filterOk(matchesWords, "g p", "Git: Pull", [{ start: 0, end: 1 }, { start: 5, end: 6 }]);
    filterOk(matchesWords, "gipu", "Git: Pull", [{ start: 0, end: 2 }, { start: 5, end: 7 }]);
    filterOk(matchesWords, "gp", "Category: Git: Pull", [{ start: 10, end: 11 }, { start: 15, end: 16 }]);
    filterOk(matchesWords, "g p", "Category: Git: Pull", [{ start: 10, end: 11 }, { start: 15, end: 16 }]);
    filterOk(matchesWords, "gipu", "Category: Git: Pull", [{ start: 10, end: 12 }, { start: 15, end: 17 }]);
    filterNotOk(matchesWords, "it", "Git: Pull");
    filterNotOk(matchesWords, "ll", "Git: Pull");
    filterOk(matchesWords, "git: \u30D7\u30EB", "git: \u30D7\u30EB", [{ start: 0, end: 7 }]);
    filterOk(matchesWords, "git \u30D7\u30EB", "git: \u30D7\u30EB", [{ start: 0, end: 3 }, { start: 5, end: 7 }]);
    filterOk(matchesWords, "\xF6\xE4k", "\xD6hm: \xC4lles Klar", [{ start: 0, end: 1 }, { start: 5, end: 6 }, { start: 11, end: 12 }]);
    filterOk(matchesWords, "C++", "C/C++: command", [{ start: 2, end: 5 }]);
    filterOk(matchesWords, ".", ":", []);
    filterOk(matchesWords, ".", ".", [{ start: 0, end: 1 }]);
    filterOk(matchesWords, "bar", "foo-bar");
    filterOk(matchesWords, "bar test", "foo-bar test");
    filterOk(matchesWords, "fbt", "foo-bar test");
    filterOk(matchesWords, "bar test", "foo-bar (test)");
    filterOk(matchesWords, "foo bar", "foo (bar)");
    filterNotOk(matchesWords, "bar est", "foo-bar test");
    filterNotOk(matchesWords, "fo ar", "foo-bar test");
    filterNotOk(matchesWords, "for", "foo-bar test");
    filterOk(matchesWords, "foo bar", "foo-bar");
    filterOk(matchesWords, "foo bar", "123 foo-bar 456");
    filterOk(matchesWords, "foo-bar", "foo bar");
    filterOk(matchesWords, "foo:bar", "foo:bar");
  });
  function assertMatches(pattern, word, decoratedWord, filter, opts = {}) {
    const r = filter(pattern, pattern.toLowerCase(), opts.patternPos || 0, word, word.toLowerCase(), opts.wordPos || 0, { firstMatchCanBeWeak: opts.firstMatchCanBeWeak ?? false, boostFullMatch: true });
    assert.ok(!decoratedWord === !r);
    if (r) {
      const matches = createMatches(r);
      let actualWord = "";
      let pos = 0;
      for (const match of matches) {
        actualWord += word.substring(pos, match.start);
        actualWord += "^" + word.substring(match.start, match.end).split("").join("^");
        pos = match.end;
      }
      actualWord += word.substring(pos);
      assert.strictEqual(actualWord, decoratedWord);
    }
  }
  test("fuzzyScore, #23215", function() {
    assertMatches("tit", "win.tit", "win.^t^i^t", fuzzyScore);
    assertMatches("title", "win.title", "win.^t^i^t^l^e", fuzzyScore);
    assertMatches("WordCla", "WordCharacterClassifier", "^W^o^r^dCharacter^C^l^assifier", fuzzyScore);
    assertMatches("WordCCla", "WordCharacterClassifier", "^W^o^r^d^Character^C^l^assifier", fuzzyScore);
  });
  test("fuzzyScore, #23332", function() {
    assertMatches("dete", '"editor.quickSuggestionsDelay"', void 0, fuzzyScore);
  });
  test("fuzzyScore, #23190", function() {
    assertMatches("c:\\do", "& 'C:\\Documents and Settings'", "& '^C^:^\\^D^ocuments and Settings'", fuzzyScore);
    assertMatches("c:\\do", "& 'c:\\Documents and Settings'", "& '^c^:^\\^D^ocuments and Settings'", fuzzyScore);
  });
  test("fuzzyScore, #23581", function() {
    assertMatches("close", "css.lint.importStatement", "^css.^lint.imp^ort^Stat^ement", fuzzyScore);
    assertMatches("close", "css.colorDecorators.enable", "^css.co^l^orDecorator^s.^enable", fuzzyScore);
    assertMatches("close", "workbench.quickOpen.closeOnFocusOut", "workbench.quickOpen.^c^l^o^s^eOnFocusOut", fuzzyScore);
    assertTopScore(fuzzyScore, "close", 2, "css.lint.importStatement", "css.colorDecorators.enable", "workbench.quickOpen.closeOnFocusOut");
  });
  test("fuzzyScore, #23458", function() {
    assertMatches("highlight", "editorHoverHighlight", "editorHover^H^i^g^h^l^i^g^h^t", fuzzyScore);
    assertMatches("hhighlight", "editorHoverHighlight", "editor^Hover^H^i^g^h^l^i^g^h^t", fuzzyScore);
    assertMatches("dhhighlight", "editorHoverHighlight", void 0, fuzzyScore);
  });
  test("fuzzyScore, #23746", function() {
    assertMatches("-moz", "-moz-foo", "^-^m^o^z-foo", fuzzyScore);
    assertMatches("moz", "-moz-foo", "-^m^o^z-foo", fuzzyScore);
    assertMatches("moz", "-moz-animation", "-^m^o^z-animation", fuzzyScore);
    assertMatches("moza", "-moz-animation", "-^m^o^z-^animation", fuzzyScore);
  });
  test("fuzzyScore", () => {
    assertMatches("ab", "abA", "^a^bA", fuzzyScore);
    assertMatches("ccm", "cacmelCase", "^ca^c^melCase", fuzzyScore);
    assertMatches("bti", "the_black_knight", void 0, fuzzyScore);
    assertMatches("ccm", "camelCase", void 0, fuzzyScore);
    assertMatches("cmcm", "camelCase", void 0, fuzzyScore);
    assertMatches("BK", "the_black_knight", "the_^black_^knight", fuzzyScore);
    assertMatches("KeyboardLayout=", "KeyboardLayout", void 0, fuzzyScore);
    assertMatches("LLL", "SVisualLoggerLogsList", "SVisual^Logger^Logs^List", fuzzyScore);
    assertMatches("LLLL", "SVilLoLosLi", void 0, fuzzyScore);
    assertMatches("LLLL", "SVisualLoggerLogsList", void 0, fuzzyScore);
    assertMatches("TEdit", "TextEdit", "^Text^E^d^i^t", fuzzyScore);
    assertMatches("TEdit", "TextEditor", "^Text^E^d^i^tor", fuzzyScore);
    assertMatches("TEdit", "Textedit", "^Text^e^d^i^t", fuzzyScore);
    assertMatches("TEdit", "text_edit", "^text_^e^d^i^t", fuzzyScore);
    assertMatches("TEditDit", "TextEditorDecorationType", "^Text^E^d^i^tor^Decorat^ion^Type", fuzzyScore);
    assertMatches("TEdit", "TextEditorDecorationType", "^Text^E^d^i^torDecorationType", fuzzyScore);
    assertMatches("Tedit", "TextEdit", "^Text^E^d^i^t", fuzzyScore);
    assertMatches("ba", "?AB?", void 0, fuzzyScore);
    assertMatches("bkn", "the_black_knight", "the_^black_^k^night", fuzzyScore);
    assertMatches("bt", "the_black_knight", "the_^black_knigh^t", fuzzyScore);
    assertMatches("ccm", "camelCasecm", "^camel^Casec^m", fuzzyScore);
    assertMatches("fdm", "findModel", "^fin^d^Model", fuzzyScore);
    assertMatches("fob", "foobar", "^f^oo^bar", fuzzyScore);
    assertMatches("fobz", "foobar", void 0, fuzzyScore);
    assertMatches("foobar", "foobar", "^f^o^o^b^a^r", fuzzyScore);
    assertMatches("form", "editor.formatOnSave", "editor.^f^o^r^matOnSave", fuzzyScore);
    assertMatches("g p", "Git: Pull", "^Git:^ ^Pull", fuzzyScore);
    assertMatches("g p", "Git: Pull", "^Git:^ ^Pull", fuzzyScore);
    assertMatches("gip", "Git: Pull", "^G^it: ^Pull", fuzzyScore);
    assertMatches("gip", "Git: Pull", "^G^it: ^Pull", fuzzyScore);
    assertMatches("gp", "Git: Pull", "^Git: ^Pull", fuzzyScore);
    assertMatches("gp", "Git_Git_Pull", "^Git_Git_^Pull", fuzzyScore);
    assertMatches("is", "ImportStatement", "^Import^Statement", fuzzyScore);
    assertMatches("is", "isValid", "^i^sValid", fuzzyScore);
    assertMatches("lowrd", "lowWord", "^l^o^wWo^r^d", fuzzyScore);
    assertMatches("myvable", "myvariable", "^m^y^v^aria^b^l^e", fuzzyScore);
    assertMatches("no", "", void 0, fuzzyScore);
    assertMatches("no", "match", void 0, fuzzyScore);
    assertMatches("ob", "foobar", void 0, fuzzyScore);
    assertMatches("sl", "SVisualLoggerLogsList", "^SVisual^LoggerLogsList", fuzzyScore);
    assertMatches("sllll", "SVisualLoggerLogsList", "^SVisua^l^Logger^Logs^List", fuzzyScore);
    assertMatches("Three", "HTMLHRElement", void 0, fuzzyScore);
    assertMatches("Three", "Three", "^T^h^r^e^e", fuzzyScore);
    assertMatches("fo", "barfoo", void 0, fuzzyScore);
    assertMatches("fo", "bar_foo", "bar_^f^oo", fuzzyScore);
    assertMatches("fo", "bar_Foo", "bar_^F^oo", fuzzyScore);
    assertMatches("fo", "bar foo", "bar ^f^oo", fuzzyScore);
    assertMatches("fo", "bar.foo", "bar.^f^oo", fuzzyScore);
    assertMatches("fo", "bar/foo", "bar/^f^oo", fuzzyScore);
    assertMatches("fo", "bar\\foo", "bar\\^f^oo", fuzzyScore);
  });
  test("fuzzyScore (first match can be weak)", function() {
    assertMatches("Three", "HTMLHRElement", "H^TML^H^R^El^ement", fuzzyScore, { firstMatchCanBeWeak: true });
    assertMatches("tor", "constructor", "construc^t^o^r", fuzzyScore, { firstMatchCanBeWeak: true });
    assertMatches("ur", "constructor", "constr^ucto^r", fuzzyScore, { firstMatchCanBeWeak: true });
    assertTopScore(fuzzyScore, "tor", 2, "constructor", "Thor", "cTor");
  });
  test("fuzzyScore, many matches", function() {
    assertMatches(
      "aaaaaa",
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "^a^a^a^a^a^aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      fuzzyScore
    );
  });
  test("Freeze when fjfj -> jfjf, https://github.com/microsoft/vscode/issues/91807", function() {
    assertMatches(
      "jfjfj",
      "fjfjfjfjfjfjfjfjfjfjfj",
      void 0,
      fuzzyScore
    );
    assertMatches(
      "jfjfjfjfjfjfjfjfjfj",
      "fjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfj",
      void 0,
      fuzzyScore
    );
    assertMatches(
      "jfjfjfjfjfjfjfjfjfjjfjfjfjfjfjfjfjfjfjjfjfjfjfjfjfjfjfjfjjfjfjfjfjfjfjfjfjfjjfjfjfjfjfjfjfjfjfjjfjfjfjfjfjfjfjfjfj",
      "fjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfj",
      void 0,
      fuzzyScore
    );
    assertMatches(
      "jfjfjfjfjfjfjfjfjfj",
      "fJfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfj",
      "f^J^f^j^f^j^f^j^f^j^f^j^f^j^f^j^f^j^f^jfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfj",
      // strong match
      fuzzyScore
    );
    assertMatches(
      "jfjfjfjfjfjfjfjfjfj",
      "fjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfj",
      "f^j^f^j^f^j^f^j^f^j^f^j^f^j^f^j^f^j^f^jfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfj",
      // any match
      fuzzyScore,
      { firstMatchCanBeWeak: true }
    );
  });
  test("fuzzyScore, issue #26423", function() {
    assertMatches("baba", "abababab", void 0, fuzzyScore);
    assertMatches(
      "fsfsfs",
      "dsafdsafdsafdsafdsafdsafdsafasdfdsa",
      void 0,
      fuzzyScore
    );
    assertMatches(
      "fsfsfsfsfsfsfsf",
      "dsafdsafdsafdsafdsafdsafdsafasdfdsafdsafdsafdsafdsfdsafdsfdfdfasdnfdsajfndsjnafjndsajlknfdsa",
      void 0,
      fuzzyScore
    );
  });
  test("Fuzzy IntelliSense matching vs Haxe metadata completion, #26995", function() {
    assertMatches("f", ":Foo", ":^Foo", fuzzyScore);
    assertMatches("f", ":foo", ":^foo", fuzzyScore);
  });
  test("Separator only match should not be weak #79558", function() {
    assertMatches(".", "foo.bar", "foo^.bar", fuzzyScore);
  });
  test("Cannot set property '1' of undefined, #26511", function() {
    const word = new Array(123).join("a");
    const pattern = new Array(120).join("a");
    fuzzyScore(pattern, pattern.toLowerCase(), 0, word, word.toLowerCase(), 0);
    assert.ok(true);
  });
  test("Vscode 1.12 no longer obeys 'sortText' in completion items (from language server), #26096", function() {
    assertMatches("  ", "  group", void 0, fuzzyScore, { patternPos: 2 });
    assertMatches("  g", "  group", "  ^group", fuzzyScore, { patternPos: 2 });
    assertMatches("g", "  group", "  ^group", fuzzyScore);
    assertMatches("g g", "  groupGroup", void 0, fuzzyScore);
    assertMatches("g g", "  group Group", "  ^group^ ^Group", fuzzyScore);
    assertMatches(" g g", "  group Group", "  ^group^ ^Group", fuzzyScore, { patternPos: 1 });
    assertMatches("zz", "zzGroup", "^z^zGroup", fuzzyScore);
    assertMatches("zzg", "zzGroup", "^z^z^Group", fuzzyScore);
    assertMatches("g", "zzGroup", "zz^Group", fuzzyScore);
  });
  test("patternPos isn't working correctly #79815", function() {
    assertMatches(":p".substr(1), "prop", "^prop", fuzzyScore, { patternPos: 0 });
    assertMatches(":p", "prop", "^prop", fuzzyScore, { patternPos: 1 });
    assertMatches(":p", "prop", void 0, fuzzyScore, { patternPos: 2 });
    assertMatches(":p", "proP", "pro^P", fuzzyScore, { patternPos: 1, wordPos: 1 });
    assertMatches(":p", "aprop", "a^prop", fuzzyScore, { patternPos: 1, firstMatchCanBeWeak: true });
    assertMatches(":p", "aprop", void 0, fuzzyScore, { patternPos: 1, firstMatchCanBeWeak: false });
  });
  function assertTopScore(filter, pattern, expected, ...words) {
    let topScore = -(100 * 10);
    let topIdx = 0;
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const m = filter(pattern, pattern.toLowerCase(), 0, word, word.toLowerCase(), 0);
      if (m) {
        const [score] = m;
        if (score > topScore) {
          topScore = score;
          topIdx = i;
        }
      }
    }
    assert.strictEqual(topIdx, expected, `${pattern} -> actual=${words[topIdx]} <> expected=${words[expected]}`);
  }
  test("topScore - fuzzyScore", function() {
    assertTopScore(fuzzyScore, "cons", 2, "ArrayBufferConstructor", "Console", "console");
    assertTopScore(fuzzyScore, "Foo", 1, "foo", "Foo", "foo");
    assertTopScore(fuzzyScore, "onMess", 1, "onmessage", "onMessage", "onThisMegaEscape");
    assertTopScore(fuzzyScore, "CC", 1, "camelCase", "CamelCase");
    assertTopScore(fuzzyScore, "cC", 0, "camelCase", "CamelCase");
    assertTopScore(fuzzyScore, "p", 4, "parse", "posix", "pafdsa", "path", "p");
    assertTopScore(fuzzyScore, "pa", 0, "parse", "pafdsa", "path");
    assertTopScore(fuzzyScore, "log", 3, "HTMLOptGroupElement", "ScrollLogicalPosition", "SVGFEMorphologyElement", "log", "logger");
    assertTopScore(fuzzyScore, "e", 2, "AbstractWorker", "ActiveXObject", "else");
    assertTopScore(fuzzyScore, "workbench.sideb", 1, "workbench.editor.defaultSideBySideLayout", "workbench.sideBar.location");
    assertTopScore(fuzzyScore, "editor.r", 2, "diffEditor.renderSideBySide", "editor.overviewRulerlanes", "editor.renderControlCharacter", "editor.renderWhitespace");
    assertTopScore(fuzzyScore, "-mo", 1, "-ms-ime-mode", "-moz-columns");
    assertTopScore(fuzzyScore, "convertModelPosition", 0, "convertModelPositionToViewPosition", "convertViewToModelPosition");
    assertTopScore(fuzzyScore, "is", 0, "isValidViewletId", "import statement");
    assertTopScore(fuzzyScore, "title", 1, "files.trimTrailingWhitespace", "window.title");
    assertTopScore(fuzzyScore, "const", 1, "constructor", "const", "cuOnstrul");
  });
  test("Unexpected suggestion scoring, #28791", function() {
    assertTopScore(fuzzyScore, "_lines", 1, "_lineStarts", "_lines");
    assertTopScore(fuzzyScore, "_lines", 1, "_lineS", "_lines");
    assertTopScore(fuzzyScore, "_lineS", 0, "_lineS", "_lines");
  });
  test.skip('Bad completion ranking changes valid variable name to class name when pressing "." #187055', function() {
    assertTopScore(fuzzyScore, "a", 1, "A", "a");
    assertTopScore(fuzzyScore, "theme", 1, "Theme", "theme");
  });
  test("HTML closing tag proposal filtered out #38880", function() {
    assertMatches("		<", "		</body>", "^	^	^</body>", fuzzyScore, { patternPos: 0 });
    assertMatches("		<", "		</body>", "		^</body>", fuzzyScore, { patternPos: 2 });
    assertMatches("	<", "	</body>", "	^</body>", fuzzyScore, { patternPos: 1 });
  });
  test("fuzzyScoreGraceful", () => {
    assertMatches("rlut", "result", void 0, fuzzyScore);
    assertMatches("rlut", "result", "^res^u^l^t", fuzzyScoreGraceful);
    assertMatches("cno", "console", "^co^ns^ole", fuzzyScore);
    assertMatches("cno", "console", "^co^ns^ole", fuzzyScoreGraceful);
    assertMatches("cno", "console", "^c^o^nsole", fuzzyScoreGracefulAggressive);
    assertMatches("cno", "co_new", "^c^o_^new", fuzzyScoreGraceful);
    assertMatches("cno", "co_new", "^c^o_^new", fuzzyScoreGracefulAggressive);
  });
  test("List highlight filter: Not all characters from match are highlighterd #66923", () => {
    assertMatches("foo", "barbarbarbarbarbarbarbarbarbarbarbarbarbarbarbar_foo", "barbarbarbarbarbarbarbarbarbarbarbarbarbarbarbar_^f^o^o", fuzzyScore);
  });
  test("Autocompletion is matched against truncated filterText to 54 characters #74133", () => {
    assertMatches(
      "foo",
      "ffffffffffffffffffffffffffffbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbar_foo",
      "ffffffffffffffffffffffffffffbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbar_^f^o^o",
      fuzzyScore
    );
    assertMatches(
      "Aoo",
      "Affffffffffffffffffffffffffffbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbar_foo",
      "^Affffffffffffffffffffffffffffbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbar_f^o^o",
      fuzzyScore
    );
    assertMatches(
      "foo",
      "Gffffffffffffffffffffffffffffbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbarbar_foo",
      void 0,
      fuzzyScore
    );
  });
  test(`"Go to Symbol" with the exact method name doesn't work as expected #84787`, function() {
    const match = fuzzyScore(":get", ":get", 1, "get", "get", 0, { firstMatchCanBeWeak: true, boostFullMatch: true });
    assert.ok(Boolean(match));
  });
  test("Wrong highlight after emoji #113404", function() {
    assertMatches("di", '\u2728div classname=""></div>', '\u2728^d^iv classname=""></div>', fuzzyScore);
    assertMatches("di", 'adiv classname=""></div>', 'adiv classname=""></^d^iv>', fuzzyScore);
  });
  test("Suggestion is not highlighted #85826", function() {
    assertMatches("SemanticTokens", "SemanticTokensEdits", "^S^e^m^a^n^t^i^c^T^o^k^e^n^sEdits", fuzzyScore);
    assertMatches("SemanticTokens", "SemanticTokensEdits", "^S^e^m^a^n^t^i^c^T^o^k^e^n^sEdits", fuzzyScoreGracefulAggressive);
  });
  test("IntelliSense completion not correctly highlighting text in front of cursor #115250", function() {
    assertMatches("lo", "log", "^l^og", fuzzyScore);
    assertMatches(".lo", "log", "^l^og", anyScore);
    assertMatches(".", "log", "log", anyScore);
  });
  test("anyScore should not require a strong first match", function() {
    assertMatches("bar", "foobAr", "foo^b^A^r", anyScore);
    assertMatches("bar", "foobar", "foo^b^a^r", anyScore);
  });
  test("configurable full match boost", function() {
    const prefix = "create";
    const a = "createModelServices";
    const b = "create";
    let aBoost = fuzzyScore(prefix, prefix, 0, a, a.toLowerCase(), 0, { boostFullMatch: true, firstMatchCanBeWeak: true });
    let bBoost = fuzzyScore(prefix, prefix, 0, b, b.toLowerCase(), 0, { boostFullMatch: true, firstMatchCanBeWeak: true });
    assert.ok(aBoost);
    assert.ok(bBoost);
    assert.ok(aBoost[0] < bBoost[0]);
    const wordPrefix = "$(symbol-function) ";
    aBoost = fuzzyScore(prefix, prefix, 0, `${wordPrefix}${a}`, `${wordPrefix}${a}`.toLowerCase(), wordPrefix.length, { boostFullMatch: true, firstMatchCanBeWeak: true });
    bBoost = fuzzyScore(prefix, prefix, 0, `${wordPrefix}${b}`, `${wordPrefix}${b}`.toLowerCase(), wordPrefix.length, { boostFullMatch: true, firstMatchCanBeWeak: true });
    assert.ok(aBoost);
    assert.ok(bBoost);
    assert.ok(aBoost[0] < bBoost[0]);
    const aScore = fuzzyScore(prefix, prefix, 0, a, a.toLowerCase(), 0, { boostFullMatch: false, firstMatchCanBeWeak: true });
    const bScore = fuzzyScore(prefix, prefix, 0, b, b.toLowerCase(), 0, { boostFullMatch: false, firstMatchCanBeWeak: true });
    assert.ok(aScore);
    assert.ok(bScore);
    assert.ok(aScore[0] === bScore[0]);
  });
  test("Unexpected suggest highlighting ignores whole word match in favor of matching first letter#147423", function() {
    assertMatches("i", "machine/{id}", "machine/{^id}", fuzzyScore);
    assertMatches("ok", "obobobf{ok}/user", "^obobobf{o^k}/user", fuzzyScore);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3Rlc3QvY29tbW9uL2ZpbHRlcnMudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBhbnlTY29yZSwgY3JlYXRlTWF0Y2hlcywgZnV6enlTY29yZSwgZnV6enlTY29yZUdyYWNlZnVsLCBmdXp6eVNjb3JlR3JhY2VmdWxBZ2dyZXNzaXZlLCBGdXp6eVNjb3JlciwgSUZpbHRlciwgSU1hdGNoLCBtYXRjaGVzQ2FtZWxDYXNlLCBtYXRjaGVzQ29udGlndW91c1N1YlN0cmluZywgbWF0Y2hlc1ByZWZpeCwgbWF0Y2hlc1N0cmljdFByZWZpeCwgbWF0Y2hlc1N1YlN0cmluZywgbWF0Y2hlc1dvcmRzLCBvciB9IGZyb20gJy4uLy4uL2NvbW1vbi9maWx0ZXJzLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4vdXRpbHMuanMnO1xuXG5mdW5jdGlvbiBmaWx0ZXJPayhmaWx0ZXI6IElGaWx0ZXIsIHdvcmQ6IHN0cmluZywgd29yZFRvTWF0Y2hBZ2FpbnN0OiBzdHJpbmcsIGhpZ2hsaWdodHM/OiB7IHN0YXJ0OiBudW1iZXI7IGVuZDogbnVtYmVyIH1bXSkge1xuXHRjb25zdCByID0gZmlsdGVyKHdvcmQsIHdvcmRUb01hdGNoQWdhaW5zdCk7XG5cdGFzc2VydChyLCBgJHt3b3JkfSBkaWRuJ3QgbWF0Y2ggJHt3b3JkVG9NYXRjaEFnYWluc3R9YCk7XG5cdGlmIChoaWdobGlnaHRzKSB7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyLCBoaWdobGlnaHRzKTtcblx0fVxufVxuXG5mdW5jdGlvbiBmaWx0ZXJOb3RPayhmaWx0ZXI6IElGaWx0ZXIsIHdvcmQ6IHN0cmluZywgd29yZFRvTWF0Y2hBZ2FpbnN0OiBzdHJpbmcpIHtcblx0YXNzZXJ0KCFmaWx0ZXIod29yZCwgd29yZFRvTWF0Y2hBZ2FpbnN0KSwgYCR7d29yZH0gbWF0Y2hlZCAke3dvcmRUb01hdGNoQWdhaW5zdH1gKTtcbn1cblxuc3VpdGUoJ0ZpbHRlcnMnLCAoKSA9PiB7XG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ29yJywgKCkgPT4ge1xuXHRcdGxldCBmaWx0ZXI6IElGaWx0ZXI7XG5cdFx0bGV0IGNvdW50ZXJzOiBudW1iZXJbXTtcblx0XHRjb25zdCBuZXdGaWx0ZXIgPSBmdW5jdGlvbiAoaTogbnVtYmVyLCByOiBib29sZWFuKTogSUZpbHRlciB7XG5cdFx0XHRyZXR1cm4gZnVuY3Rpb24gKCk6IElNYXRjaFtdIHsgY291bnRlcnNbaV0rKzsgcmV0dXJuIHIgYXMgYW55OyB9O1xuXHRcdH07XG5cblx0XHRjb3VudGVycyA9IFswLCAwXTtcblx0XHRmaWx0ZXIgPSBvcihuZXdGaWx0ZXIoMCwgZmFsc2UpLCBuZXdGaWx0ZXIoMSwgZmFsc2UpKTtcblx0XHRmaWx0ZXJOb3RPayhmaWx0ZXIsICdhbnl0aGluZycsICdhbnl0aGluZycpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY291bnRlcnMsIFsxLCAxXSk7XG5cblx0XHRjb3VudGVycyA9IFswLCAwXTtcblx0XHRmaWx0ZXIgPSBvcihuZXdGaWx0ZXIoMCwgdHJ1ZSksIG5ld0ZpbHRlcigxLCBmYWxzZSkpO1xuXHRcdGZpbHRlck9rKGZpbHRlciwgJ2FueXRoaW5nJywgJ2FueXRoaW5nJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjb3VudGVycywgWzEsIDBdKTtcblxuXHRcdGNvdW50ZXJzID0gWzAsIDBdO1xuXHRcdGZpbHRlciA9IG9yKG5ld0ZpbHRlcigwLCB0cnVlKSwgbmV3RmlsdGVyKDEsIHRydWUpKTtcblx0XHRmaWx0ZXJPayhmaWx0ZXIsICdhbnl0aGluZycsICdhbnl0aGluZycpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY291bnRlcnMsIFsxLCAwXSk7XG5cblx0XHRjb3VudGVycyA9IFswLCAwXTtcblx0XHRmaWx0ZXIgPSBvcihuZXdGaWx0ZXIoMCwgZmFsc2UpLCBuZXdGaWx0ZXIoMSwgdHJ1ZSkpO1xuXHRcdGZpbHRlck9rKGZpbHRlciwgJ2FueXRoaW5nJywgJ2FueXRoaW5nJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjb3VudGVycywgWzEsIDFdKTtcblx0fSk7XG5cblx0dGVzdCgnUHJlZml4RmlsdGVyIC0gY2FzZSBzZW5zaXRpdmUnLCBmdW5jdGlvbiAoKSB7XG5cdFx0ZmlsdGVyTm90T2sobWF0Y2hlc1N0cmljdFByZWZpeCwgJycsICcnKTtcblx0XHRmaWx0ZXJPayhtYXRjaGVzU3RyaWN0UHJlZml4LCAnJywgJ2FueXRoaW5nJywgW10pO1xuXHRcdGZpbHRlck9rKG1hdGNoZXNTdHJpY3RQcmVmaXgsICdhbHBoYScsICdhbHBoYScsIFt7IHN0YXJ0OiAwLCBlbmQ6IDUgfV0pO1xuXHRcdGZpbHRlck9rKG1hdGNoZXNTdHJpY3RQcmVmaXgsICdhbHBoYScsICdhbHBoYXNvbWV0aGluZycsIFt7IHN0YXJ0OiAwLCBlbmQ6IDUgfV0pO1xuXHRcdGZpbHRlck5vdE9rKG1hdGNoZXNTdHJpY3RQcmVmaXgsICdhbHBoYScsICdhbHAnKTtcblx0XHRmaWx0ZXJPayhtYXRjaGVzU3RyaWN0UHJlZml4LCAnYScsICdhbHBoYScsIFt7IHN0YXJ0OiAwLCBlbmQ6IDEgfV0pO1xuXHRcdGZpbHRlck5vdE9rKG1hdGNoZXNTdHJpY3RQcmVmaXgsICd4JywgJ2FscGhhJyk7XG5cdFx0ZmlsdGVyTm90T2sobWF0Y2hlc1N0cmljdFByZWZpeCwgJ0EnLCAnYWxwaGEnKTtcblx0XHRmaWx0ZXJOb3RPayhtYXRjaGVzU3RyaWN0UHJlZml4LCAnQWxQaCcsICdhbFBIQScpO1xuXHR9KTtcblxuXHR0ZXN0KCdQcmVmaXhGaWx0ZXIgLSBpZ25vcmUgY2FzZScsIGZ1bmN0aW9uICgpIHtcblx0XHRmaWx0ZXJPayhtYXRjaGVzUHJlZml4LCAnYWxwaGEnLCAnYWxwaGEnLCBbeyBzdGFydDogMCwgZW5kOiA1IH1dKTtcblx0XHRmaWx0ZXJPayhtYXRjaGVzUHJlZml4LCAnYWxwaGEnLCAnYWxwaGFzb21ldGhpbmcnLCBbeyBzdGFydDogMCwgZW5kOiA1IH1dKTtcblx0XHRmaWx0ZXJOb3RPayhtYXRjaGVzUHJlZml4LCAnYWxwaGEnLCAnYWxwJyk7XG5cdFx0ZmlsdGVyT2sobWF0Y2hlc1ByZWZpeCwgJ2EnLCAnYWxwaGEnLCBbeyBzdGFydDogMCwgZW5kOiAxIH1dKTtcblx0XHRmaWx0ZXJPayhtYXRjaGVzUHJlZml4LCAnXHUwMEU0JywgJ1x1MDBDNGxwaGEnLCBbeyBzdGFydDogMCwgZW5kOiAxIH1dKTtcblx0XHRmaWx0ZXJOb3RPayhtYXRjaGVzUHJlZml4LCAneCcsICdhbHBoYScpO1xuXHRcdGZpbHRlck9rKG1hdGNoZXNQcmVmaXgsICdBJywgJ2FscGhhJywgW3sgc3RhcnQ6IDAsIGVuZDogMSB9XSk7XG5cdFx0ZmlsdGVyT2sobWF0Y2hlc1ByZWZpeCwgJ0FsUGgnLCAnYWxQSEEnLCBbeyBzdGFydDogMCwgZW5kOiA0IH1dKTtcblx0XHRmaWx0ZXJOb3RPayhtYXRjaGVzUHJlZml4LCAnVCcsICc0Jyk7IC8vIHNlZSBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMjI0MDFcblx0fSk7XG5cblx0dGVzdCgnQ2FtZWxDYXNlRmlsdGVyJywgKCkgPT4ge1xuXHRcdGZpbHRlck5vdE9rKG1hdGNoZXNDYW1lbENhc2UsICcnLCAnJyk7XG5cdFx0ZmlsdGVyT2sobWF0Y2hlc0NhbWVsQ2FzZSwgJycsICdhbnl0aGluZycsIFtdKTtcblx0XHRmaWx0ZXJPayhtYXRjaGVzQ2FtZWxDYXNlLCAnYWxwaGEnLCAnYWxwaGEnLCBbeyBzdGFydDogMCwgZW5kOiA1IH1dKTtcblx0XHRmaWx0ZXJPayhtYXRjaGVzQ2FtZWxDYXNlLCAnQWxQaEEnLCAnYWxwaGEnLCBbeyBzdGFydDogMCwgZW5kOiA1IH1dKTtcblx0XHRmaWx0ZXJPayhtYXRjaGVzQ2FtZWxDYXNlLCAnYWxwaGEnLCAnYWxwaGFzb21ldGhpbmcnLCBbeyBzdGFydDogMCwgZW5kOiA1IH1dKTtcblx0XHRmaWx0ZXJOb3RPayhtYXRjaGVzQ2FtZWxDYXNlLCAnYWxwaGEnLCAnYWxwJyk7XG5cblx0XHRmaWx0ZXJPayhtYXRjaGVzQ2FtZWxDYXNlLCAnYycsICdDYW1lbENhc2VSb2NrcycsIFtcblx0XHRcdHsgc3RhcnQ6IDAsIGVuZDogMSB9XG5cdFx0XSk7XG5cdFx0ZmlsdGVyT2sobWF0Y2hlc0NhbWVsQ2FzZSwgJ2NjJywgJ0NhbWVsQ2FzZVJvY2tzJywgW1xuXHRcdFx0eyBzdGFydDogMCwgZW5kOiAxIH0sXG5cdFx0XHR7IHN0YXJ0OiA1LCBlbmQ6IDYgfVxuXHRcdF0pO1xuXHRcdGZpbHRlck9rKG1hdGNoZXNDYW1lbENhc2UsICdjY3InLCAnQ2FtZWxDYXNlUm9ja3MnLCBbXG5cdFx0XHR7IHN0YXJ0OiAwLCBlbmQ6IDEgfSxcblx0XHRcdHsgc3RhcnQ6IDUsIGVuZDogNiB9LFxuXHRcdFx0eyBzdGFydDogOSwgZW5kOiAxMCB9XG5cdFx0XSk7XG5cdFx0ZmlsdGVyT2sobWF0Y2hlc0NhbWVsQ2FzZSwgJ2NhY3InLCAnQ2FtZWxDYXNlUm9ja3MnLCBbXG5cdFx0XHR7IHN0YXJ0OiAwLCBlbmQ6IDIgfSxcblx0XHRcdHsgc3RhcnQ6IDUsIGVuZDogNiB9LFxuXHRcdFx0eyBzdGFydDogOSwgZW5kOiAxMCB9XG5cdFx0XSk7XG5cdFx0ZmlsdGVyT2sobWF0Y2hlc0NhbWVsQ2FzZSwgJ2NhY2FyJywgJ0NhbWVsQ2FzZVJvY2tzJywgW1xuXHRcdFx0eyBzdGFydDogMCwgZW5kOiAyIH0sXG5cdFx0XHR7IHN0YXJ0OiA1LCBlbmQ6IDcgfSxcblx0XHRcdHsgc3RhcnQ6IDksIGVuZDogMTAgfVxuXHRcdF0pO1xuXHRcdGZpbHRlck9rKG1hdGNoZXNDYW1lbENhc2UsICdjY2Fyb2NrcycsICdDYW1lbENhc2VSb2NrcycsIFtcblx0XHRcdHsgc3RhcnQ6IDAsIGVuZDogMSB9LFxuXHRcdFx0eyBzdGFydDogNSwgZW5kOiA3IH0sXG5cdFx0XHR7IHN0YXJ0OiA5LCBlbmQ6IDE0IH1cblx0XHRdKTtcblx0XHRmaWx0ZXJPayhtYXRjaGVzQ2FtZWxDYXNlLCAnY3InLCAnQ2FtZWxDYXNlUm9ja3MnLCBbXG5cdFx0XHR7IHN0YXJ0OiAwLCBlbmQ6IDEgfSxcblx0XHRcdHsgc3RhcnQ6IDksIGVuZDogMTAgfVxuXHRcdF0pO1xuXHRcdGZpbHRlck9rKG1hdGNoZXNDYW1lbENhc2UsICdmYmEnLCAnRm9vQmFyQWJlJywgW1xuXHRcdFx0eyBzdGFydDogMCwgZW5kOiAxIH0sXG5cdFx0XHR7IHN0YXJ0OiAzLCBlbmQ6IDUgfVxuXHRcdF0pO1xuXHRcdGZpbHRlck9rKG1hdGNoZXNDYW1lbENhc2UsICdmYmFyJywgJ0Zvb0JhckFiZScsIFtcblx0XHRcdHsgc3RhcnQ6IDAsIGVuZDogMSB9LFxuXHRcdFx0eyBzdGFydDogMywgZW5kOiA2IH1cblx0XHRdKTtcblx0XHRmaWx0ZXJPayhtYXRjaGVzQ2FtZWxDYXNlLCAnZmJhcmEnLCAnRm9vQmFyQWJlJywgW1xuXHRcdFx0eyBzdGFydDogMCwgZW5kOiAxIH0sXG5cdFx0XHR7IHN0YXJ0OiAzLCBlbmQ6IDcgfVxuXHRcdF0pO1xuXHRcdGZpbHRlck9rKG1hdGNoZXNDYW1lbENhc2UsICdmYmFhJywgJ0Zvb0JhckFiZScsIFtcblx0XHRcdHsgc3RhcnQ6IDAsIGVuZDogMSB9LFxuXHRcdFx0eyBzdGFydDogMywgZW5kOiA1IH0sXG5cdFx0XHR7IHN0YXJ0OiA2LCBlbmQ6IDcgfVxuXHRcdF0pO1xuXHRcdGZpbHRlck9rKG1hdGNoZXNDYW1lbENhc2UsICdmYmFhYicsICdGb29CYXJBYmUnLCBbXG5cdFx0XHR7IHN0YXJ0OiAwLCBlbmQ6IDEgfSxcblx0XHRcdHsgc3RhcnQ6IDMsIGVuZDogNSB9LFxuXHRcdFx0eyBzdGFydDogNiwgZW5kOiA4IH1cblx0XHRdKTtcblx0XHRmaWx0ZXJPayhtYXRjaGVzQ2FtZWxDYXNlLCAnYzJkJywgJ2NhbnZhc0NyZWF0aW9uMkQnLCBbXG5cdFx0XHR7IHN0YXJ0OiAwLCBlbmQ6IDEgfSxcblx0XHRcdHsgc3RhcnQ6IDE0LCBlbmQ6IDE2IH1cblx0XHRdKTtcblx0XHRmaWx0ZXJPayhtYXRjaGVzQ2FtZWxDYXNlLCAnY2NlJywgJ19jYW52YXNDcmVhdGlvbkV2ZW50JywgW1xuXHRcdFx0eyBzdGFydDogMSwgZW5kOiAyIH0sXG5cdFx0XHR7IHN0YXJ0OiA3LCBlbmQ6IDggfSxcblx0XHRcdHsgc3RhcnQ6IDE1LCBlbmQ6IDE2IH1cblx0XHRdKTtcblx0fSk7XG5cblx0dGVzdCgnQ2FtZWxDYXNlRmlsdGVyIC0gIzE5MjU2JywgZnVuY3Rpb24gKCkge1xuXHRcdGFzc2VydChtYXRjaGVzQ2FtZWxDYXNlKCdEZWJ1ZyBDb25zb2xlJywgJ09wZW46IERlYnVnIENvbnNvbGUnKSk7XG5cdFx0YXNzZXJ0KG1hdGNoZXNDYW1lbENhc2UoJ0RlYnVnIGNvbnNvbGUnLCAnT3BlbjogRGVidWcgQ29uc29sZScpKTtcblx0XHRhc3NlcnQobWF0Y2hlc0NhbWVsQ2FzZSgnZGVidWcgY29uc29sZScsICdPcGVuOiBEZWJ1ZyBDb25zb2xlJykpO1xuXHR9KTtcblxuXHR0ZXN0KCdtYXRjaGVzQ29udGlndW91c1N1YlN0cmluZycsICgpID0+IHtcblx0XHRmaWx0ZXJPayhtYXRjaGVzQ29udGlndW91c1N1YlN0cmluZywgJ2NlbGEnLCAnY2FuY2VsQW5pbWF0aW9uRnJhbWUoKScsIFtcblx0XHRcdHsgc3RhcnQ6IDMsIGVuZDogNyB9XG5cdFx0XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21hdGNoZXNTdWJTdHJpbmcnLCAoKSA9PiB7XG5cdFx0ZmlsdGVyT2sobWF0Y2hlc1N1YlN0cmluZywgJ2NtbScsICdjYW5jZWxBbmltYXRpb25GcmFtZSgpJywgW1xuXHRcdFx0eyBzdGFydDogMCwgZW5kOiAxIH0sXG5cdFx0XHR7IHN0YXJ0OiA5LCBlbmQ6IDEwIH0sXG5cdFx0XHR7IHN0YXJ0OiAxOCwgZW5kOiAxOSB9XG5cdFx0XSk7XG5cdFx0ZmlsdGVyT2sobWF0Y2hlc1N1YlN0cmluZywgJ2FiYycsICdhYmNhYmMnLCBbXG5cdFx0XHR7IHN0YXJ0OiAwLCBlbmQ6IDMgfSxcblx0XHRdKTtcblx0XHRmaWx0ZXJPayhtYXRjaGVzU3ViU3RyaW5nLCAnYWJjJywgJ2FhYWJiYmNjYycsIFtcblx0XHRcdHsgc3RhcnQ6IDAsIGVuZDogMSB9LFxuXHRcdFx0eyBzdGFydDogMywgZW5kOiA0IH0sXG5cdFx0XHR7IHN0YXJ0OiA2LCBlbmQ6IDcgfSxcblx0XHRdKTtcblx0fSk7XG5cblx0dGVzdCgnbWF0Y2hlc1N1YlN0cmluZyBwZXJmb3JtYW5jZSAoIzM1MzQ2KScsIGZ1bmN0aW9uICgpIHtcblx0XHRmaWx0ZXJOb3RPayhtYXRjaGVzU3ViU3RyaW5nLCAnYWFhYWFhYWFhYWFhYWFhYWFhYWF4JywgJ2FhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWEnKTtcblx0fSk7XG5cblx0dGVzdCgnV29yZEZpbHRlcicsICgpID0+IHtcblx0XHRmaWx0ZXJPayhtYXRjaGVzV29yZHMsICdhbHBoYScsICdhbHBoYScsIFt7IHN0YXJ0OiAwLCBlbmQ6IDUgfV0pO1xuXHRcdGZpbHRlck9rKG1hdGNoZXNXb3JkcywgJ2FscGhhJywgJ2FscGhhc29tZXRoaW5nJywgW3sgc3RhcnQ6IDAsIGVuZDogNSB9XSk7XG5cdFx0ZmlsdGVyTm90T2sobWF0Y2hlc1dvcmRzLCAnYWxwaGEnLCAnYWxwJyk7XG5cdFx0ZmlsdGVyT2sobWF0Y2hlc1dvcmRzLCAnYScsICdhbHBoYScsIFt7IHN0YXJ0OiAwLCBlbmQ6IDEgfV0pO1xuXHRcdGZpbHRlck5vdE9rKG1hdGNoZXNXb3JkcywgJ3gnLCAnYWxwaGEnKTtcblx0XHRmaWx0ZXJPayhtYXRjaGVzV29yZHMsICdBJywgJ2FscGhhJywgW3sgc3RhcnQ6IDAsIGVuZDogMSB9XSk7XG5cdFx0ZmlsdGVyT2sobWF0Y2hlc1dvcmRzLCAnQWxQaCcsICdhbFBIQScsIFt7IHN0YXJ0OiAwLCBlbmQ6IDQgfV0pO1xuXHRcdGFzc2VydChtYXRjaGVzV29yZHMoJ0RlYnVnIENvbnNvbGUnLCAnT3BlbjogRGVidWcgQ29uc29sZScpKTtcblxuXHRcdGZpbHRlck9rKG1hdGNoZXNXb3JkcywgJ2dwJywgJ0dpdDogUHVsbCcsIFt7IHN0YXJ0OiAwLCBlbmQ6IDEgfSwgeyBzdGFydDogNSwgZW5kOiA2IH1dKTtcblx0XHRmaWx0ZXJPayhtYXRjaGVzV29yZHMsICdnIHAnLCAnR2l0OiBQdWxsJywgW3sgc3RhcnQ6IDAsIGVuZDogMSB9LCB7IHN0YXJ0OiA1LCBlbmQ6IDYgfV0pO1xuXHRcdGZpbHRlck9rKG1hdGNoZXNXb3JkcywgJ2dpcHUnLCAnR2l0OiBQdWxsJywgW3sgc3RhcnQ6IDAsIGVuZDogMiB9LCB7IHN0YXJ0OiA1LCBlbmQ6IDcgfV0pO1xuXG5cdFx0ZmlsdGVyT2sobWF0Y2hlc1dvcmRzLCAnZ3AnLCAnQ2F0ZWdvcnk6IEdpdDogUHVsbCcsIFt7IHN0YXJ0OiAxMCwgZW5kOiAxMSB9LCB7IHN0YXJ0OiAxNSwgZW5kOiAxNiB9XSk7XG5cdFx0ZmlsdGVyT2sobWF0Y2hlc1dvcmRzLCAnZyBwJywgJ0NhdGVnb3J5OiBHaXQ6IFB1bGwnLCBbeyBzdGFydDogMTAsIGVuZDogMTEgfSwgeyBzdGFydDogMTUsIGVuZDogMTYgfV0pO1xuXHRcdGZpbHRlck9rKG1hdGNoZXNXb3JkcywgJ2dpcHUnLCAnQ2F0ZWdvcnk6IEdpdDogUHVsbCcsIFt7IHN0YXJ0OiAxMCwgZW5kOiAxMiB9LCB7IHN0YXJ0OiAxNSwgZW5kOiAxNyB9XSk7XG5cblx0XHRmaWx0ZXJOb3RPayhtYXRjaGVzV29yZHMsICdpdCcsICdHaXQ6IFB1bGwnKTtcblx0XHRmaWx0ZXJOb3RPayhtYXRjaGVzV29yZHMsICdsbCcsICdHaXQ6IFB1bGwnKTtcblxuXHRcdGZpbHRlck9rKG1hdGNoZXNXb3JkcywgJ2dpdDogXHUzMEQ3XHUzMEVCJywgJ2dpdDogXHUzMEQ3XHUzMEVCJywgW3sgc3RhcnQ6IDAsIGVuZDogNyB9XSk7XG5cdFx0ZmlsdGVyT2sobWF0Y2hlc1dvcmRzLCAnZ2l0IFx1MzBEN1x1MzBFQicsICdnaXQ6IFx1MzBEN1x1MzBFQicsIFt7IHN0YXJ0OiAwLCBlbmQ6IDMgfSwgeyBzdGFydDogNSwgZW5kOiA3IH1dKTtcblxuXHRcdGZpbHRlck9rKG1hdGNoZXNXb3JkcywgJ1x1MDBGNlx1MDBFNGsnLCAnXHUwMEQ2aG06IFx1MDBDNGxsZXMgS2xhcicsIFt7IHN0YXJ0OiAwLCBlbmQ6IDEgfSwgeyBzdGFydDogNSwgZW5kOiA2IH0sIHsgc3RhcnQ6IDExLCBlbmQ6IDEyIH1dKTtcblxuXHRcdC8vIEhhbmRsZXMgaXNzdWUgIzEyMzkxNVxuXHRcdGZpbHRlck9rKG1hdGNoZXNXb3JkcywgJ0MrKycsICdDL0MrKzogY29tbWFuZCcsIFt7IHN0YXJ0OiAyLCBlbmQ6IDUgfV0pO1xuXG5cdFx0Ly8gSGFuZGxlcyBpc3N1ZSAjMTU0NTMzXG5cdFx0ZmlsdGVyT2sobWF0Y2hlc1dvcmRzLCAnLicsICc6JywgW10pO1xuXHRcdGZpbHRlck9rKG1hdGNoZXNXb3JkcywgJy4nLCAnLicsIFt7IHN0YXJ0OiAwLCBlbmQ6IDEgfV0pO1xuXG5cdFx0Ly8gYXNzZXJ0Lm9rKG1hdGNoZXNXb3JkcygnZ2lwdScsICdDYXRlZ29yeTogR2l0OiBQdWxsJywgdHJ1ZSkgPT09IG51bGwpO1xuXHRcdC8vIGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobWF0Y2hlc1dvcmRzKCdwdScsICdDYXRlZ29yeTogR2l0OiBQdWxsJywgdHJ1ZSksIFt7IHN0YXJ0OiAxNSwgZW5kOiAxNyB9XSk7XG5cblx0XHRmaWx0ZXJPayhtYXRjaGVzV29yZHMsICdiYXInLCAnZm9vLWJhcicpO1xuXHRcdGZpbHRlck9rKG1hdGNoZXNXb3JkcywgJ2JhciB0ZXN0JywgJ2Zvby1iYXIgdGVzdCcpO1xuXHRcdGZpbHRlck9rKG1hdGNoZXNXb3JkcywgJ2ZidCcsICdmb28tYmFyIHRlc3QnKTtcblx0XHRmaWx0ZXJPayhtYXRjaGVzV29yZHMsICdiYXIgdGVzdCcsICdmb28tYmFyICh0ZXN0KScpO1xuXHRcdGZpbHRlck9rKG1hdGNoZXNXb3JkcywgJ2ZvbyBiYXInLCAnZm9vIChiYXIpJyk7XG5cblx0XHRmaWx0ZXJOb3RPayhtYXRjaGVzV29yZHMsICdiYXIgZXN0JywgJ2Zvby1iYXIgdGVzdCcpO1xuXHRcdGZpbHRlck5vdE9rKG1hdGNoZXNXb3JkcywgJ2ZvIGFyJywgJ2Zvby1iYXIgdGVzdCcpO1xuXHRcdGZpbHRlck5vdE9rKG1hdGNoZXNXb3JkcywgJ2ZvcicsICdmb28tYmFyIHRlc3QnKTtcblxuXHRcdGZpbHRlck9rKG1hdGNoZXNXb3JkcywgJ2ZvbyBiYXInLCAnZm9vLWJhcicpO1xuXHRcdGZpbHRlck9rKG1hdGNoZXNXb3JkcywgJ2ZvbyBiYXInLCAnMTIzIGZvby1iYXIgNDU2Jyk7XG5cdFx0ZmlsdGVyT2sobWF0Y2hlc1dvcmRzLCAnZm9vLWJhcicsICdmb28gYmFyJyk7XG5cdFx0ZmlsdGVyT2sobWF0Y2hlc1dvcmRzLCAnZm9vOmJhcicsICdmb286YmFyJyk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIGFzc2VydE1hdGNoZXMocGF0dGVybjogc3RyaW5nLCB3b3JkOiBzdHJpbmcsIGRlY29yYXRlZFdvcmQ6IHN0cmluZyB8IHVuZGVmaW5lZCwgZmlsdGVyOiBGdXp6eVNjb3Jlciwgb3B0czogeyBwYXR0ZXJuUG9zPzogbnVtYmVyOyB3b3JkUG9zPzogbnVtYmVyOyBmaXJzdE1hdGNoQ2FuQmVXZWFrPzogYm9vbGVhbiB9ID0ge30pIHtcblx0XHRjb25zdCByID0gZmlsdGVyKHBhdHRlcm4sIHBhdHRlcm4udG9Mb3dlckNhc2UoKSwgb3B0cy5wYXR0ZXJuUG9zIHx8IDAsIHdvcmQsIHdvcmQudG9Mb3dlckNhc2UoKSwgb3B0cy53b3JkUG9zIHx8IDAsIHsgZmlyc3RNYXRjaENhbkJlV2Vhazogb3B0cy5maXJzdE1hdGNoQ2FuQmVXZWFrID8/IGZhbHNlLCBib29zdEZ1bGxNYXRjaDogdHJ1ZSB9KTtcblx0XHRhc3NlcnQub2soIWRlY29yYXRlZFdvcmQgPT09ICFyKTtcblx0XHRpZiAocikge1xuXHRcdFx0Y29uc3QgbWF0Y2hlcyA9IGNyZWF0ZU1hdGNoZXMocik7XG5cdFx0XHRsZXQgYWN0dWFsV29yZCA9ICcnO1xuXHRcdFx0bGV0IHBvcyA9IDA7XG5cdFx0XHRmb3IgKGNvbnN0IG1hdGNoIG9mIG1hdGNoZXMpIHtcblx0XHRcdFx0YWN0dWFsV29yZCArPSB3b3JkLnN1YnN0cmluZyhwb3MsIG1hdGNoLnN0YXJ0KTtcblx0XHRcdFx0YWN0dWFsV29yZCArPSAnXicgKyB3b3JkLnN1YnN0cmluZyhtYXRjaC5zdGFydCwgbWF0Y2guZW5kKS5zcGxpdCgnJykuam9pbignXicpO1xuXHRcdFx0XHRwb3MgPSBtYXRjaC5lbmQ7XG5cdFx0XHR9XG5cdFx0XHRhY3R1YWxXb3JkICs9IHdvcmQuc3Vic3RyaW5nKHBvcyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsV29yZCwgZGVjb3JhdGVkV29yZCk7XG5cdFx0fVxuXHR9XG5cblx0dGVzdCgnZnV6enlTY29yZSwgIzIzMjE1JywgZnVuY3Rpb24gKCkge1xuXHRcdGFzc2VydE1hdGNoZXMoJ3RpdCcsICd3aW4udGl0JywgJ3dpbi5edF5pXnQnLCBmdXp6eVNjb3JlKTtcblx0XHRhc3NlcnRNYXRjaGVzKCd0aXRsZScsICd3aW4udGl0bGUnLCAnd2luLl50XmledF5sXmUnLCBmdXp6eVNjb3JlKTtcblx0XHRhc3NlcnRNYXRjaGVzKCdXb3JkQ2xhJywgJ1dvcmRDaGFyYWN0ZXJDbGFzc2lmaWVyJywgJ15XXm9ecl5kQ2hhcmFjdGVyXkNebF5hc3NpZmllcicsIGZ1enp5U2NvcmUpO1xuXHRcdGFzc2VydE1hdGNoZXMoJ1dvcmRDQ2xhJywgJ1dvcmRDaGFyYWN0ZXJDbGFzc2lmaWVyJywgJ15XXm9ecl5kXkNoYXJhY3Rlcl5DXmxeYXNzaWZpZXInLCBmdXp6eVNjb3JlKTtcblx0fSk7XG5cblx0dGVzdCgnZnV6enlTY29yZSwgIzIzMzMyJywgZnVuY3Rpb24gKCkge1xuXHRcdGFzc2VydE1hdGNoZXMoJ2RldGUnLCAnXCJlZGl0b3IucXVpY2tTdWdnZXN0aW9uc0RlbGF5XCInLCB1bmRlZmluZWQsIGZ1enp5U2NvcmUpO1xuXHR9KTtcblxuXHR0ZXN0KCdmdXp6eVNjb3JlLCAjMjMxOTAnLCBmdW5jdGlvbiAoKSB7XG5cdFx0YXNzZXJ0TWF0Y2hlcygnYzpcXFxcZG8nLCAnJiBcXCdDOlxcXFxEb2N1bWVudHMgYW5kIFNldHRpbmdzXFwnJywgJyYgXFwnXkNeOl5cXFxcXkReb2N1bWVudHMgYW5kIFNldHRpbmdzXFwnJywgZnV6enlTY29yZSk7XG5cdFx0YXNzZXJ0TWF0Y2hlcygnYzpcXFxcZG8nLCAnJiBcXCdjOlxcXFxEb2N1bWVudHMgYW5kIFNldHRpbmdzXFwnJywgJyYgXFwnXmNeOl5cXFxcXkReb2N1bWVudHMgYW5kIFNldHRpbmdzXFwnJywgZnV6enlTY29yZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2Z1enp5U2NvcmUsICMyMzU4MScsIGZ1bmN0aW9uICgpIHtcblx0XHRhc3NlcnRNYXRjaGVzKCdjbG9zZScsICdjc3MubGludC5pbXBvcnRTdGF0ZW1lbnQnLCAnXmNzcy5ebGludC5pbXBeb3J0XlN0YXReZW1lbnQnLCBmdXp6eVNjb3JlKTtcblx0XHRhc3NlcnRNYXRjaGVzKCdjbG9zZScsICdjc3MuY29sb3JEZWNvcmF0b3JzLmVuYWJsZScsICdeY3NzLmNvXmxeb3JEZWNvcmF0b3Jecy5eZW5hYmxlJywgZnV6enlTY29yZSk7XG5cdFx0YXNzZXJ0TWF0Y2hlcygnY2xvc2UnLCAnd29ya2JlbmNoLnF1aWNrT3Blbi5jbG9zZU9uRm9jdXNPdXQnLCAnd29ya2JlbmNoLnF1aWNrT3Blbi5eY15sXm9ec15lT25Gb2N1c091dCcsIGZ1enp5U2NvcmUpO1xuXHRcdGFzc2VydFRvcFNjb3JlKGZ1enp5U2NvcmUsICdjbG9zZScsIDIsICdjc3MubGludC5pbXBvcnRTdGF0ZW1lbnQnLCAnY3NzLmNvbG9yRGVjb3JhdG9ycy5lbmFibGUnLCAnd29ya2JlbmNoLnF1aWNrT3Blbi5jbG9zZU9uRm9jdXNPdXQnKTtcblx0fSk7XG5cblx0dGVzdCgnZnV6enlTY29yZSwgIzIzNDU4JywgZnVuY3Rpb24gKCkge1xuXHRcdGFzc2VydE1hdGNoZXMoJ2hpZ2hsaWdodCcsICdlZGl0b3JIb3ZlckhpZ2hsaWdodCcsICdlZGl0b3JIb3Zlcl5IXmleZ15oXmxeaV5nXmhedCcsIGZ1enp5U2NvcmUpO1xuXHRcdGFzc2VydE1hdGNoZXMoJ2hoaWdobGlnaHQnLCAnZWRpdG9ySG92ZXJIaWdobGlnaHQnLCAnZWRpdG9yXkhvdmVyXkheaV5nXmhebF5pXmdeaF50JywgZnV6enlTY29yZSk7XG5cdFx0YXNzZXJ0TWF0Y2hlcygnZGhoaWdobGlnaHQnLCAnZWRpdG9ySG92ZXJIaWdobGlnaHQnLCB1bmRlZmluZWQsIGZ1enp5U2NvcmUpO1xuXHR9KTtcblx0dGVzdCgnZnV6enlTY29yZSwgIzIzNzQ2JywgZnVuY3Rpb24gKCkge1xuXHRcdGFzc2VydE1hdGNoZXMoJy1tb3onLCAnLW1vei1mb28nLCAnXi1ebV5vXnotZm9vJywgZnV6enlTY29yZSk7XG5cdFx0YXNzZXJ0TWF0Y2hlcygnbW96JywgJy1tb3otZm9vJywgJy1ebV5vXnotZm9vJywgZnV6enlTY29yZSk7XG5cdFx0YXNzZXJ0TWF0Y2hlcygnbW96JywgJy1tb3otYW5pbWF0aW9uJywgJy1ebV5vXnotYW5pbWF0aW9uJywgZnV6enlTY29yZSk7XG5cdFx0YXNzZXJ0TWF0Y2hlcygnbW96YScsICctbW96LWFuaW1hdGlvbicsICctXm1eb156LV5hbmltYXRpb24nLCBmdXp6eVNjb3JlKTtcblx0fSk7XG5cblx0dGVzdCgnZnV6enlTY29yZScsICgpID0+IHtcblx0XHRhc3NlcnRNYXRjaGVzKCdhYicsICdhYkEnLCAnXmFeYkEnLCBmdXp6eVNjb3JlKTtcblx0XHRhc3NlcnRNYXRjaGVzKCdjY20nLCAnY2FjbWVsQ2FzZScsICdeY2FeY15tZWxDYXNlJywgZnV6enlTY29yZSk7XG5cdFx0YXNzZXJ0TWF0Y2hlcygnYnRpJywgJ3RoZV9ibGFja19rbmlnaHQnLCB1bmRlZmluZWQsIGZ1enp5U2NvcmUpO1xuXHRcdGFzc2VydE1hdGNoZXMoJ2NjbScsICdjYW1lbENhc2UnLCB1bmRlZmluZWQsIGZ1enp5U2NvcmUpO1xuXHRcdGFzc2VydE1hdGNoZXMoJ2NtY20nLCAnY2FtZWxDYXNlJywgdW5kZWZpbmVkLCBmdXp6eVNjb3JlKTtcblx0XHRhc3NlcnRNYXRjaGVzKCdCSycsICd0aGVfYmxhY2tfa25pZ2h0JywgJ3RoZV9eYmxhY2tfXmtuaWdodCcsIGZ1enp5U2NvcmUpO1xuXHRcdGFzc2VydE1hdGNoZXMoJ0tleWJvYXJkTGF5b3V0PScsICdLZXlib2FyZExheW91dCcsIHVuZGVmaW5lZCwgZnV6enlTY29yZSk7XG5cdFx0YXNzZXJ0TWF0Y2hlcygnTExMJywgJ1NWaXN1YWxMb2dnZXJMb2dzTGlzdCcsICdTVmlzdWFsXkxvZ2dlcl5Mb2dzXkxpc3QnLCBmdXp6eVNjb3JlKTtcblx0XHRhc3NlcnRNYXRjaGVzKCdMTExMJywgJ1NWaWxMb0xvc0xpJywgdW5kZWZpbmVkLCBmdXp6eVNjb3JlKTtcblx0XHRhc3NlcnRNYXRjaGVzKCdMTExMJywgJ1NWaXN1YWxMb2dnZXJMb2dzTGlzdCcsIHVuZGVmaW5lZCwgZnV6enlTY29yZSk7XG5cdFx0YXNzZXJ0TWF0Y2hlcygnVEVkaXQnLCAnVGV4dEVkaXQnLCAnXlRleHReRV5kXmledCcsIGZ1enp5U2NvcmUpO1xuXHRcdGFzc2VydE1hdGNoZXMoJ1RFZGl0JywgJ1RleHRFZGl0b3InLCAnXlRleHReRV5kXmledG9yJywgZnV6enlTY29yZSk7XG5cdFx0YXNzZXJ0TWF0Y2hlcygnVEVkaXQnLCAnVGV4dGVkaXQnLCAnXlRleHReZV5kXmledCcsIGZ1enp5U2NvcmUpO1xuXHRcdGFzc2VydE1hdGNoZXMoJ1RFZGl0JywgJ3RleHRfZWRpdCcsICdedGV4dF9eZV5kXmledCcsIGZ1enp5U2NvcmUpO1xuXHRcdGFzc2VydE1hdGNoZXMoJ1RFZGl0RGl0JywgJ1RleHRFZGl0b3JEZWNvcmF0aW9uVHlwZScsICdeVGV4dF5FXmReaV50b3JeRGVjb3JhdF5pb25eVHlwZScsIGZ1enp5U2NvcmUpO1xuXHRcdGFzc2VydE1hdGNoZXMoJ1RFZGl0JywgJ1RleHRFZGl0b3JEZWNvcmF0aW9uVHlwZScsICdeVGV4dF5FXmReaV50b3JEZWNvcmF0aW9uVHlwZScsIGZ1enp5U2NvcmUpO1xuXHRcdGFzc2VydE1hdGNoZXMoJ1RlZGl0JywgJ1RleHRFZGl0JywgJ15UZXh0XkVeZF5pXnQnLCBmdXp6eVNjb3JlKTtcblx0XHRhc3NlcnRNYXRjaGVzKCdiYScsICc/QUI/JywgdW5kZWZpbmVkLCBmdXp6eVNjb3JlKTtcblx0XHRhc3NlcnRNYXRjaGVzKCdia24nLCAndGhlX2JsYWNrX2tuaWdodCcsICd0aGVfXmJsYWNrX15rXm5pZ2h0JywgZnV6enlTY29yZSk7XG5cdFx0YXNzZXJ0TWF0Y2hlcygnYnQnLCAndGhlX2JsYWNrX2tuaWdodCcsICd0aGVfXmJsYWNrX2tuaWdoXnQnLCBmdXp6eVNjb3JlKTtcblx0XHRhc3NlcnRNYXRjaGVzKCdjY20nLCAnY2FtZWxDYXNlY20nLCAnXmNhbWVsXkNhc2VjXm0nLCBmdXp6eVNjb3JlKTtcblx0XHRhc3NlcnRNYXRjaGVzKCdmZG0nLCAnZmluZE1vZGVsJywgJ15maW5eZF5Nb2RlbCcsIGZ1enp5U2NvcmUpO1xuXHRcdGFzc2VydE1hdGNoZXMoJ2ZvYicsICdmb29iYXInLCAnXmZeb29eYmFyJywgZnV6enlTY29yZSk7XG5cdFx0YXNzZXJ0TWF0Y2hlcygnZm9ieicsICdmb29iYXInLCB1bmRlZmluZWQsIGZ1enp5U2NvcmUpO1xuXHRcdGFzc2VydE1hdGNoZXMoJ2Zvb2JhcicsICdmb29iYXInLCAnXmZeb15vXmJeYV5yJywgZnV6enlTY29yZSk7XG5cdFx0YXNzZXJ0TWF0Y2hlcygnZm9ybScsICdlZGl0b3IuZm9ybWF0T25TYXZlJywgJ2VkaXRvci5eZl5vXnJebWF0T25TYXZlJywgZnV6enlTY29yZSk7XG5cdFx0YXNzZXJ0TWF0Y2hlcygnZyBwJywgJ0dpdDogUHVsbCcsICdeR2l0Ol4gXlB1bGwnLCBmdXp6eVNjb3JlKTtcblx0XHRhc3NlcnRNYXRjaGVzKCdnIHAnLCAnR2l0OiBQdWxsJywgJ15HaXQ6XiBeUHVsbCcsIGZ1enp5U2NvcmUpO1xuXHRcdGFzc2VydE1hdGNoZXMoJ2dpcCcsICdHaXQ6IFB1bGwnLCAnXkdeaXQ6IF5QdWxsJywgZnV6enlTY29yZSk7XG5cdFx0YXNzZXJ0TWF0Y2hlcygnZ2lwJywgJ0dpdDogUHVsbCcsICdeR15pdDogXlB1bGwnLCBmdXp6eVNjb3JlKTtcblx0XHRhc3NlcnRNYXRjaGVzKCdncCcsICdHaXQ6IFB1bGwnLCAnXkdpdDogXlB1bGwnLCBmdXp6eVNjb3JlKTtcblx0XHRhc3NlcnRNYXRjaGVzKCdncCcsICdHaXRfR2l0X1B1bGwnLCAnXkdpdF9HaXRfXlB1bGwnLCBmdXp6eVNjb3JlKTtcblx0XHRhc3NlcnRNYXRjaGVzKCdpcycsICdJbXBvcnRTdGF0ZW1lbnQnLCAnXkltcG9ydF5TdGF0ZW1lbnQnLCBmdXp6eVNjb3JlKTtcblx0XHRhc3NlcnRNYXRjaGVzKCdpcycsICdpc1ZhbGlkJywgJ15pXnNWYWxpZCcsIGZ1enp5U2NvcmUpO1xuXHRcdGFzc2VydE1hdGNoZXMoJ2xvd3JkJywgJ2xvd1dvcmQnLCAnXmxeb153V29ecl5kJywgZnV6enlTY29yZSk7XG5cdFx0YXNzZXJ0TWF0Y2hlcygnbXl2YWJsZScsICdteXZhcmlhYmxlJywgJ15tXnledl5hcmlhXmJebF5lJywgZnV6enlTY29yZSk7XG5cdFx0YXNzZXJ0TWF0Y2hlcygnbm8nLCAnJywgdW5kZWZpbmVkLCBmdXp6eVNjb3JlKTtcblx0XHRhc3NlcnRNYXRjaGVzKCdubycsICdtYXRjaCcsIHVuZGVmaW5lZCwgZnV6enlTY29yZSk7XG5cdFx0YXNzZXJ0TWF0Y2hlcygnb2InLCAnZm9vYmFyJywgdW5kZWZpbmVkLCBmdXp6eVNjb3JlKTtcblx0XHRhc3NlcnRNYXRjaGVzKCdzbCcsICdTVmlzdWFsTG9nZ2VyTG9nc0xpc3QnLCAnXlNWaXN1YWxeTG9nZ2VyTG9nc0xpc3QnLCBmdXp6eVNjb3JlKTtcblx0XHRhc3NlcnRNYXRjaGVzKCdzbGxsbCcsICdTVmlzdWFsTG9nZ2VyTG9nc0xpc3QnLCAnXlNWaXN1YV5sXkxvZ2dlcl5Mb2dzXkxpc3QnLCBmdXp6eVNjb3JlKTtcblx0XHRhc3NlcnRNYXRjaGVzKCdUaHJlZScsICdIVE1MSFJFbGVtZW50JywgdW5kZWZpbmVkLCBmdXp6eVNjb3JlKTtcblx0XHRhc3NlcnRNYXRjaGVzKCdUaHJlZScsICdUaHJlZScsICdeVF5oXnJeZV5lJywgZnV6enlTY29yZSk7XG5cdFx0YXNzZXJ0TWF0Y2hlcygnZm8nLCAnYmFyZm9vJywgdW5kZWZpbmVkLCBmdXp6eVNjb3JlKTtcblx0XHRhc3NlcnRNYXRjaGVzKCdmbycsICdiYXJfZm9vJywgJ2Jhcl9eZl5vbycsIGZ1enp5U2NvcmUpO1xuXHRcdGFzc2VydE1hdGNoZXMoJ2ZvJywgJ2Jhcl9Gb28nLCAnYmFyX15GXm9vJywgZnV6enlTY29yZSk7XG5cdFx0YXNzZXJ0TWF0Y2hlcygnZm8nLCAnYmFyIGZvbycsICdiYXIgXmZeb28nLCBmdXp6eVNjb3JlKTtcblx0XHRhc3NlcnRNYXRjaGVzKCdmbycsICdiYXIuZm9vJywgJ2Jhci5eZl5vbycsIGZ1enp5U2NvcmUpO1xuXHRcdGFzc2VydE1hdGNoZXMoJ2ZvJywgJ2Jhci9mb28nLCAnYmFyL15mXm9vJywgZnV6enlTY29yZSk7XG5cdFx0YXNzZXJ0TWF0Y2hlcygnZm8nLCAnYmFyXFxcXGZvbycsICdiYXJcXFxcXmZeb28nLCBmdXp6eVNjb3JlKTtcblx0fSk7XG5cblx0dGVzdCgnZnV6enlTY29yZSAoZmlyc3QgbWF0Y2ggY2FuIGJlIHdlYWspJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0YXNzZXJ0TWF0Y2hlcygnVGhyZWUnLCAnSFRNTEhSRWxlbWVudCcsICdIXlRNTF5IXlJeRWxeZW1lbnQnLCBmdXp6eVNjb3JlLCB7IGZpcnN0TWF0Y2hDYW5CZVdlYWs6IHRydWUgfSk7XG5cdFx0YXNzZXJ0TWF0Y2hlcygndG9yJywgJ2NvbnN0cnVjdG9yJywgJ2NvbnN0cnVjXnReb15yJywgZnV6enlTY29yZSwgeyBmaXJzdE1hdGNoQ2FuQmVXZWFrOiB0cnVlIH0pO1xuXHRcdGFzc2VydE1hdGNoZXMoJ3VyJywgJ2NvbnN0cnVjdG9yJywgJ2NvbnN0cl51Y3RvXnInLCBmdXp6eVNjb3JlLCB7IGZpcnN0TWF0Y2hDYW5CZVdlYWs6IHRydWUgfSk7XG5cdFx0YXNzZXJ0VG9wU2NvcmUoZnV6enlTY29yZSwgJ3RvcicsIDIsICdjb25zdHJ1Y3RvcicsICdUaG9yJywgJ2NUb3InKTtcblx0fSk7XG5cblx0dGVzdCgnZnV6enlTY29yZSwgbWFueSBtYXRjaGVzJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0YXNzZXJ0TWF0Y2hlcyhcblx0XHRcdCdhYWFhYWEnLFxuXHRcdFx0J2FhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYScsXG5cdFx0XHQnXmFeYV5hXmFeYV5hYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhJyxcblx0XHRcdGZ1enp5U2NvcmVcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdGcmVlemUgd2hlbiBmamZqIC0+IGpmamYsIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy85MTgwNycsIGZ1bmN0aW9uICgpIHtcblx0XHRhc3NlcnRNYXRjaGVzKFxuXHRcdFx0J2pmamZqJyxcblx0XHRcdCdmamZqZmpmamZqZmpmamZqZmpmamZqJyxcblx0XHRcdHVuZGVmaW5lZCwgZnV6enlTY29yZVxuXHRcdCk7XG5cdFx0YXNzZXJ0TWF0Y2hlcyhcblx0XHRcdCdqZmpmamZqZmpmamZqZmpmamZqJyxcblx0XHRcdCdmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmonLFxuXHRcdFx0dW5kZWZpbmVkLCBmdXp6eVNjb3JlXG5cdFx0KTtcblx0XHRhc3NlcnRNYXRjaGVzKFxuXHRcdFx0J2pmamZqZmpmamZqZmpmamZqZmpqZmpmamZqZmpmamZqZmpmamZqamZqZmpmamZqZmpmamZqZmpmampmamZqZmpmamZqZmpmamZqZmpqZmpmamZqZmpmamZqZmpmamZqamZqZmpmamZqZmpmamZqZmpmaicsXG5cdFx0XHQnZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqJyxcblx0XHRcdHVuZGVmaW5lZCwgZnV6enlTY29yZVxuXHRcdCk7XG5cdFx0YXNzZXJ0TWF0Y2hlcyhcblx0XHRcdCdqZmpmamZqZmpmamZqZmpmamZqJyxcblx0XHRcdCdmSmZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmonLFxuXHRcdFx0J2ZeSl5mXmpeZl5qXmZeal5mXmpeZl5qXmZeal5mXmpeZl5qXmZeamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmonLCAvLyBzdHJvbmcgbWF0Y2hcblx0XHRcdGZ1enp5U2NvcmVcblx0XHQpO1xuXHRcdGFzc2VydE1hdGNoZXMoXG5cdFx0XHQnamZqZmpmamZqZmpmamZqZmpmaicsXG5cdFx0XHQnZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqJyxcblx0XHRcdCdmXmpeZl5qXmZeal5mXmpeZl5qXmZeal5mXmpeZl5qXmZeal5mXmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqZmpmamZqJywgLy8gYW55IG1hdGNoXG5cdFx0XHRmdXp6eVNjb3JlLCB7IGZpcnN0TWF0Y2hDYW5CZVdlYWs6IHRydWUgfVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2Z1enp5U2NvcmUsIGlzc3VlICMyNjQyMycsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGFzc2VydE1hdGNoZXMoJ2JhYmEnLCAnYWJhYmFiYWInLCB1bmRlZmluZWQsIGZ1enp5U2NvcmUpO1xuXG5cdFx0YXNzZXJ0TWF0Y2hlcyhcblx0XHRcdCdmc2ZzZnMnLFxuXHRcdFx0J2RzYWZkc2FmZHNhZmRzYWZkc2FmZHNhZmRzYWZhc2RmZHNhJyxcblx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdGZ1enp5U2NvcmVcblx0XHQpO1xuXHRcdGFzc2VydE1hdGNoZXMoXG5cdFx0XHQnZnNmc2ZzZnNmc2ZzZnNmJyxcblx0XHRcdCdkc2FmZHNhZmRzYWZkc2FmZHNhZmRzYWZkc2FmYXNkZmRzYWZkc2FmZHNhZmRzYWZkc2Zkc2FmZHNmZGZkZmFzZG5mZHNhamZuZHNqbmFmam5kc2FqbGtuZmRzYScsXG5cdFx0XHR1bmRlZmluZWQsXG5cdFx0XHRmdXp6eVNjb3JlXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnRnV6enkgSW50ZWxsaVNlbnNlIG1hdGNoaW5nIHZzIEhheGUgbWV0YWRhdGEgY29tcGxldGlvbiwgIzI2OTk1JywgZnVuY3Rpb24gKCkge1xuXHRcdGFzc2VydE1hdGNoZXMoJ2YnLCAnOkZvbycsICc6XkZvbycsIGZ1enp5U2NvcmUpO1xuXHRcdGFzc2VydE1hdGNoZXMoJ2YnLCAnOmZvbycsICc6XmZvbycsIGZ1enp5U2NvcmUpO1xuXHR9KTtcblxuXHR0ZXN0KCdTZXBhcmF0b3Igb25seSBtYXRjaCBzaG91bGQgbm90IGJlIHdlYWsgIzc5NTU4JywgZnVuY3Rpb24gKCkge1xuXHRcdGFzc2VydE1hdGNoZXMoJy4nLCAnZm9vLmJhcicsICdmb29eLmJhcicsIGZ1enp5U2NvcmUpO1xuXHR9KTtcblxuXHR0ZXN0KCdDYW5ub3Qgc2V0IHByb3BlcnR5IFxcJzFcXCcgb2YgdW5kZWZpbmVkLCAjMjY1MTEnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3Qgd29yZCA9IG5ldyBBcnJheTx2b2lkPigxMjMpLmpvaW4oJ2EnKTtcblx0XHRjb25zdCBwYXR0ZXJuID0gbmV3IEFycmF5PHZvaWQ+KDEyMCkuam9pbignYScpO1xuXHRcdGZ1enp5U2NvcmUocGF0dGVybiwgcGF0dGVybi50b0xvd2VyQ2FzZSgpLCAwLCB3b3JkLCB3b3JkLnRvTG93ZXJDYXNlKCksIDApO1xuXHRcdGFzc2VydC5vayh0cnVlKTsgLy8gbXVzdCBub3QgZXhwbG9kZVxuXHR9KTtcblxuXHR0ZXN0KCdWc2NvZGUgMS4xMiBubyBsb25nZXIgb2JleXMgXFwnc29ydFRleHRcXCcgaW4gY29tcGxldGlvbiBpdGVtcyAoZnJvbSBsYW5ndWFnZSBzZXJ2ZXIpLCAjMjYwOTYnLCBmdW5jdGlvbiAoKSB7XG5cdFx0YXNzZXJ0TWF0Y2hlcygnICAnLCAnICBncm91cCcsIHVuZGVmaW5lZCwgZnV6enlTY29yZSwgeyBwYXR0ZXJuUG9zOiAyIH0pO1xuXHRcdGFzc2VydE1hdGNoZXMoJyAgZycsICcgIGdyb3VwJywgJyAgXmdyb3VwJywgZnV6enlTY29yZSwgeyBwYXR0ZXJuUG9zOiAyIH0pO1xuXHRcdGFzc2VydE1hdGNoZXMoJ2cnLCAnICBncm91cCcsICcgIF5ncm91cCcsIGZ1enp5U2NvcmUpO1xuXHRcdGFzc2VydE1hdGNoZXMoJ2cgZycsICcgIGdyb3VwR3JvdXAnLCB1bmRlZmluZWQsIGZ1enp5U2NvcmUpO1xuXHRcdGFzc2VydE1hdGNoZXMoJ2cgZycsICcgIGdyb3VwIEdyb3VwJywgJyAgXmdyb3VwXiBeR3JvdXAnLCBmdXp6eVNjb3JlKTtcblx0XHRhc3NlcnRNYXRjaGVzKCcgZyBnJywgJyAgZ3JvdXAgR3JvdXAnLCAnICBeZ3JvdXBeIF5Hcm91cCcsIGZ1enp5U2NvcmUsIHsgcGF0dGVyblBvczogMSB9KTtcblx0XHRhc3NlcnRNYXRjaGVzKCd6eicsICd6ekdyb3VwJywgJ156XnpHcm91cCcsIGZ1enp5U2NvcmUpO1xuXHRcdGFzc2VydE1hdGNoZXMoJ3p6ZycsICd6ekdyb3VwJywgJ156XnpeR3JvdXAnLCBmdXp6eVNjb3JlKTtcblx0XHRhc3NlcnRNYXRjaGVzKCdnJywgJ3p6R3JvdXAnLCAnenpeR3JvdXAnLCBmdXp6eVNjb3JlKTtcblx0fSk7XG5cblx0dGVzdCgncGF0dGVyblBvcyBpc25cXCd0IHdvcmtpbmcgY29ycmVjdGx5ICM3OTgxNScsIGZ1bmN0aW9uICgpIHtcblx0XHRhc3NlcnRNYXRjaGVzKCc6cCcuc3Vic3RyKDEpLCAncHJvcCcsICdecHJvcCcsIGZ1enp5U2NvcmUsIHsgcGF0dGVyblBvczogMCB9KTtcblx0XHRhc3NlcnRNYXRjaGVzKCc6cCcsICdwcm9wJywgJ15wcm9wJywgZnV6enlTY29yZSwgeyBwYXR0ZXJuUG9zOiAxIH0pO1xuXHRcdGFzc2VydE1hdGNoZXMoJzpwJywgJ3Byb3AnLCB1bmRlZmluZWQsIGZ1enp5U2NvcmUsIHsgcGF0dGVyblBvczogMiB9KTtcblx0XHRhc3NlcnRNYXRjaGVzKCc6cCcsICdwcm9QJywgJ3Byb15QJywgZnV6enlTY29yZSwgeyBwYXR0ZXJuUG9zOiAxLCB3b3JkUG9zOiAxIH0pO1xuXHRcdGFzc2VydE1hdGNoZXMoJzpwJywgJ2Fwcm9wJywgJ2FecHJvcCcsIGZ1enp5U2NvcmUsIHsgcGF0dGVyblBvczogMSwgZmlyc3RNYXRjaENhbkJlV2VhazogdHJ1ZSB9KTtcblx0XHRhc3NlcnRNYXRjaGVzKCc6cCcsICdhcHJvcCcsIHVuZGVmaW5lZCwgZnV6enlTY29yZSwgeyBwYXR0ZXJuUG9zOiAxLCBmaXJzdE1hdGNoQ2FuQmVXZWFrOiBmYWxzZSB9KTtcblx0fSk7XG5cblx0ZnVuY3Rpb24gYXNzZXJ0VG9wU2NvcmUoZmlsdGVyOiB0eXBlb2YgZnV6enlTY29yZSwgcGF0dGVybjogc3RyaW5nLCBleHBlY3RlZDogbnVtYmVyLCAuLi53b3Jkczogc3RyaW5nW10pIHtcblx0XHRsZXQgdG9wU2NvcmUgPSAtKDEwMCAqIDEwKTtcblx0XHRsZXQgdG9wSWR4ID0gMDtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHdvcmRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCB3b3JkID0gd29yZHNbaV07XG5cdFx0XHRjb25zdCBtID0gZmlsdGVyKHBhdHRlcm4sIHBhdHRlcm4udG9Mb3dlckNhc2UoKSwgMCwgd29yZCwgd29yZC50b0xvd2VyQ2FzZSgpLCAwKTtcblx0XHRcdGlmIChtKSB7XG5cdFx0XHRcdGNvbnN0IFtzY29yZV0gPSBtO1xuXHRcdFx0XHRpZiAoc2NvcmUgPiB0b3BTY29yZSkge1xuXHRcdFx0XHRcdHRvcFNjb3JlID0gc2NvcmU7XG5cdFx0XHRcdFx0dG9wSWR4ID0gaTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodG9wSWR4LCBleHBlY3RlZCwgYCR7cGF0dGVybn0gLT4gYWN0dWFsPSR7d29yZHNbdG9wSWR4XX0gPD4gZXhwZWN0ZWQ9JHt3b3Jkc1tleHBlY3RlZF19YCk7XG5cdH1cblxuXHR0ZXN0KCd0b3BTY29yZSAtIGZ1enp5U2NvcmUnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRhc3NlcnRUb3BTY29yZShmdXp6eVNjb3JlLCAnY29ucycsIDIsICdBcnJheUJ1ZmZlckNvbnN0cnVjdG9yJywgJ0NvbnNvbGUnLCAnY29uc29sZScpO1xuXHRcdGFzc2VydFRvcFNjb3JlKGZ1enp5U2NvcmUsICdGb28nLCAxLCAnZm9vJywgJ0ZvbycsICdmb28nKTtcblxuXHRcdC8vICMyNDkwNFxuXHRcdGFzc2VydFRvcFNjb3JlKGZ1enp5U2NvcmUsICdvbk1lc3MnLCAxLCAnb25tZXNzYWdlJywgJ29uTWVzc2FnZScsICdvblRoaXNNZWdhRXNjYXBlJyk7XG5cblx0XHRhc3NlcnRUb3BTY29yZShmdXp6eVNjb3JlLCAnQ0MnLCAxLCAnY2FtZWxDYXNlJywgJ0NhbWVsQ2FzZScpO1xuXHRcdGFzc2VydFRvcFNjb3JlKGZ1enp5U2NvcmUsICdjQycsIDAsICdjYW1lbENhc2UnLCAnQ2FtZWxDYXNlJyk7XG5cdFx0Ly8gYXNzZXJ0VG9wU2NvcmUoZnV6enlTY29yZSwgJ2NDJywgMSwgJ2NjZm9vJywgJ2NhbWVsQ2FzZScpO1xuXHRcdC8vIGFzc2VydFRvcFNjb3JlKGZ1enp5U2NvcmUsICdjQycsIDEsICdjY2ZvbycsICdjYW1lbENhc2UnLCAnZm9vLWNDLWJhcicpO1xuXG5cdFx0Ly8gaXNzdWUgIzE3ODM2XG5cdFx0Ly8gYXNzZXJ0VG9wU2NvcmUoZnV6enlTY29yZSwgJ1RFZGl0JywgMSwgJ1RleHRFZGl0b3JEZWNvcmF0aW9uVHlwZScsICdUZXh0RWRpdCcsICdUZXh0RWRpdG9yJyk7XG5cdFx0YXNzZXJ0VG9wU2NvcmUoZnV6enlTY29yZSwgJ3AnLCA0LCAncGFyc2UnLCAncG9zaXgnLCAncGFmZHNhJywgJ3BhdGgnLCAncCcpO1xuXHRcdGFzc2VydFRvcFNjb3JlKGZ1enp5U2NvcmUsICdwYScsIDAsICdwYXJzZScsICdwYWZkc2EnLCAncGF0aCcpO1xuXG5cdFx0Ly8gaXNzdWUgIzE0NTgzXG5cdFx0YXNzZXJ0VG9wU2NvcmUoZnV6enlTY29yZSwgJ2xvZycsIDMsICdIVE1MT3B0R3JvdXBFbGVtZW50JywgJ1Njcm9sbExvZ2ljYWxQb3NpdGlvbicsICdTVkdGRU1vcnBob2xvZ3lFbGVtZW50JywgJ2xvZycsICdsb2dnZXInKTtcblx0XHRhc3NlcnRUb3BTY29yZShmdXp6eVNjb3JlLCAnZScsIDIsICdBYnN0cmFjdFdvcmtlcicsICdBY3RpdmVYT2JqZWN0JywgJ2Vsc2UnKTtcblxuXHRcdC8vIGlzc3VlICMxNDQ0NlxuXHRcdGFzc2VydFRvcFNjb3JlKGZ1enp5U2NvcmUsICd3b3JrYmVuY2guc2lkZWInLCAxLCAnd29ya2JlbmNoLmVkaXRvci5kZWZhdWx0U2lkZUJ5U2lkZUxheW91dCcsICd3b3JrYmVuY2guc2lkZUJhci5sb2NhdGlvbicpO1xuXG5cdFx0Ly8gaXNzdWUgIzExNDIzXG5cdFx0YXNzZXJ0VG9wU2NvcmUoZnV6enlTY29yZSwgJ2VkaXRvci5yJywgMiwgJ2RpZmZFZGl0b3IucmVuZGVyU2lkZUJ5U2lkZScsICdlZGl0b3Iub3ZlcnZpZXdSdWxlcmxhbmVzJywgJ2VkaXRvci5yZW5kZXJDb250cm9sQ2hhcmFjdGVyJywgJ2VkaXRvci5yZW5kZXJXaGl0ZXNwYWNlJyk7XG5cdFx0Ly8gYXNzZXJ0VG9wU2NvcmUoZnV6enlTY29yZSwgJ2VkaXRvci5SJywgMSwgJ2RpZmZFZGl0b3IucmVuZGVyU2lkZUJ5U2lkZScsICdlZGl0b3Iub3ZlcnZpZXdSdWxlcmxhbmVzJywgJ2VkaXRvci5yZW5kZXJDb250cm9sQ2hhcmFjdGVyJywgJ2VkaXRvci5yZW5kZXJXaGl0ZXNwYWNlJyk7XG5cdFx0Ly8gYXNzZXJ0VG9wU2NvcmUoZnV6enlTY29yZSwgJ0VkaXRvci5yJywgMCwgJ2RpZmZFZGl0b3IucmVuZGVyU2lkZUJ5U2lkZScsICdlZGl0b3Iub3ZlcnZpZXdSdWxlcmxhbmVzJywgJ2VkaXRvci5yZW5kZXJDb250cm9sQ2hhcmFjdGVyJywgJ2VkaXRvci5yZW5kZXJXaGl0ZXNwYWNlJyk7XG5cblx0XHRhc3NlcnRUb3BTY29yZShmdXp6eVNjb3JlLCAnLW1vJywgMSwgJy1tcy1pbWUtbW9kZScsICctbW96LWNvbHVtbnMnKTtcblx0XHQvLyBkdXBlLCBpc3N1ZSAjMTQ4NjFcblx0XHRhc3NlcnRUb3BTY29yZShmdXp6eVNjb3JlLCAnY29udmVydE1vZGVsUG9zaXRpb24nLCAwLCAnY29udmVydE1vZGVsUG9zaXRpb25Ub1ZpZXdQb3NpdGlvbicsICdjb252ZXJ0Vmlld1RvTW9kZWxQb3NpdGlvbicpO1xuXHRcdC8vIGR1cGUsIGlzc3VlICMxNDk0MlxuXHRcdGFzc2VydFRvcFNjb3JlKGZ1enp5U2NvcmUsICdpcycsIDAsICdpc1ZhbGlkVmlld2xldElkJywgJ2ltcG9ydCBzdGF0ZW1lbnQnKTtcblxuXHRcdGFzc2VydFRvcFNjb3JlKGZ1enp5U2NvcmUsICd0aXRsZScsIDEsICdmaWxlcy50cmltVHJhaWxpbmdXaGl0ZXNwYWNlJywgJ3dpbmRvdy50aXRsZScpO1xuXG5cdFx0YXNzZXJ0VG9wU2NvcmUoZnV6enlTY29yZSwgJ2NvbnN0JywgMSwgJ2NvbnN0cnVjdG9yJywgJ2NvbnN0JywgJ2N1T25zdHJ1bCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdVbmV4cGVjdGVkIHN1Z2dlc3Rpb24gc2NvcmluZywgIzI4NzkxJywgZnVuY3Rpb24gKCkge1xuXHRcdGFzc2VydFRvcFNjb3JlKGZ1enp5U2NvcmUsICdfbGluZXMnLCAxLCAnX2xpbmVTdGFydHMnLCAnX2xpbmVzJyk7XG5cdFx0YXNzZXJ0VG9wU2NvcmUoZnV6enlTY29yZSwgJ19saW5lcycsIDEsICdfbGluZVMnLCAnX2xpbmVzJyk7XG5cdFx0YXNzZXJ0VG9wU2NvcmUoZnV6enlTY29yZSwgJ19saW5lUycsIDAsICdfbGluZVMnLCAnX2xpbmVzJyk7XG5cdH0pO1xuXG5cdHRlc3Quc2tpcCgnQmFkIGNvbXBsZXRpb24gcmFua2luZyBjaGFuZ2VzIHZhbGlkIHZhcmlhYmxlIG5hbWUgdG8gY2xhc3MgbmFtZSB3aGVuIHByZXNzaW5nIFwiLlwiICMxODcwNTUnLCBmdW5jdGlvbiAoKSB7XG5cdFx0YXNzZXJ0VG9wU2NvcmUoZnV6enlTY29yZSwgJ2EnLCAxLCAnQScsICdhJyk7XG5cdFx0YXNzZXJ0VG9wU2NvcmUoZnV6enlTY29yZSwgJ3RoZW1lJywgMSwgJ1RoZW1lJywgJ3RoZW1lJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0hUTUwgY2xvc2luZyB0YWcgcHJvcG9zYWwgZmlsdGVyZWQgb3V0ICMzODg4MCcsIGZ1bmN0aW9uICgpIHtcblx0XHRhc3NlcnRNYXRjaGVzKCdcXHRcXHQ8JywgJ1xcdFxcdDwvYm9keT4nLCAnXlxcdF5cXHRePC9ib2R5PicsIGZ1enp5U2NvcmUsIHsgcGF0dGVyblBvczogMCB9KTtcblx0XHRhc3NlcnRNYXRjaGVzKCdcXHRcXHQ8JywgJ1xcdFxcdDwvYm9keT4nLCAnXFx0XFx0XjwvYm9keT4nLCBmdXp6eVNjb3JlLCB7IHBhdHRlcm5Qb3M6IDIgfSk7XG5cdFx0YXNzZXJ0TWF0Y2hlcygnXFx0PCcsICdcXHQ8L2JvZHk+JywgJ1xcdF48L2JvZHk+JywgZnV6enlTY29yZSwgeyBwYXR0ZXJuUG9zOiAxIH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdmdXp6eVNjb3JlR3JhY2VmdWwnLCAoKSA9PiB7XG5cblx0XHRhc3NlcnRNYXRjaGVzKCdybHV0JywgJ3Jlc3VsdCcsIHVuZGVmaW5lZCwgZnV6enlTY29yZSk7XG5cdFx0YXNzZXJ0TWF0Y2hlcygncmx1dCcsICdyZXN1bHQnLCAnXnJlc151XmxedCcsIGZ1enp5U2NvcmVHcmFjZWZ1bCk7XG5cblx0XHRhc3NlcnRNYXRjaGVzKCdjbm8nLCAnY29uc29sZScsICdeY29ebnNeb2xlJywgZnV6enlTY29yZSk7XG5cdFx0YXNzZXJ0TWF0Y2hlcygnY25vJywgJ2NvbnNvbGUnLCAnXmNvXm5zXm9sZScsIGZ1enp5U2NvcmVHcmFjZWZ1bCk7XG5cdFx0YXNzZXJ0TWF0Y2hlcygnY25vJywgJ2NvbnNvbGUnLCAnXmNeb15uc29sZScsIGZ1enp5U2NvcmVHcmFjZWZ1bEFnZ3Jlc3NpdmUpO1xuXHRcdGFzc2VydE1hdGNoZXMoJ2NubycsICdjb19uZXcnLCAnXmNeb19ebmV3JywgZnV6enlTY29yZUdyYWNlZnVsKTtcblx0XHRhc3NlcnRNYXRjaGVzKCdjbm8nLCAnY29fbmV3JywgJ15jXm9fXm5ldycsIGZ1enp5U2NvcmVHcmFjZWZ1bEFnZ3Jlc3NpdmUpO1xuXHR9KTtcblxuXHR0ZXN0KCdMaXN0IGhpZ2hsaWdodCBmaWx0ZXI6IE5vdCBhbGwgY2hhcmFjdGVycyBmcm9tIG1hdGNoIGFyZSBoaWdobGlnaHRlcmQgIzY2OTIzJywgKCkgPT4ge1xuXHRcdGFzc2VydE1hdGNoZXMoJ2ZvbycsICdiYXJiYXJiYXJiYXJiYXJiYXJiYXJiYXJiYXJiYXJiYXJiYXJiYXJiYXJiYXJiYXJfZm9vJywgJ2JhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcl9eZl5vXm8nLCBmdXp6eVNjb3JlKTtcblx0fSk7XG5cblx0dGVzdCgnQXV0b2NvbXBsZXRpb24gaXMgbWF0Y2hlZCBhZ2FpbnN0IHRydW5jYXRlZCBmaWx0ZXJUZXh0IHRvIDU0IGNoYXJhY3RlcnMgIzc0MTMzJywgKCkgPT4ge1xuXHRcdGFzc2VydE1hdGNoZXMoXG5cdFx0XHQnZm9vJyxcblx0XHRcdCdmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyX2ZvbycsXG5cdFx0XHQnZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcl9eZl5vXm8nLFxuXHRcdFx0ZnV6enlTY29yZVxuXHRcdCk7XG5cdFx0YXNzZXJ0TWF0Y2hlcyhcblx0XHRcdCdBb28nLFxuXHRcdFx0J0FmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyX2ZvbycsXG5cdFx0XHQnXkFmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyYmFyX2Zeb15vJyxcblx0XHRcdGZ1enp5U2NvcmVcblx0XHQpO1xuXHRcdGFzc2VydE1hdGNoZXMoXG5cdFx0XHQnZm9vJyxcblx0XHRcdCdHZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcmJhcl9mb28nLFxuXHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0ZnV6enlTY29yZVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1wiR28gdG8gU3ltYm9sXCIgd2l0aCB0aGUgZXhhY3QgbWV0aG9kIG5hbWUgZG9lc25cXCd0IHdvcmsgYXMgZXhwZWN0ZWQgIzg0Nzg3JywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG1hdGNoID0gZnV6enlTY29yZSgnOmdldCcsICc6Z2V0JywgMSwgJ2dldCcsICdnZXQnLCAwLCB7IGZpcnN0TWF0Y2hDYW5CZVdlYWs6IHRydWUsIGJvb3N0RnVsbE1hdGNoOiB0cnVlIH0pO1xuXHRcdGFzc2VydC5vayhCb29sZWFuKG1hdGNoKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1dyb25nIGhpZ2hsaWdodCBhZnRlciBlbW9qaSAjMTEzNDA0JywgZnVuY3Rpb24gKCkge1xuXHRcdGFzc2VydE1hdGNoZXMoJ2RpJywgJ1x1MjcyOGRpdiBjbGFzc25hbWU9XCJcIj48L2Rpdj4nLCAnXHUyNzI4XmReaXYgY2xhc3NuYW1lPVwiXCI+PC9kaXY+JywgZnV6enlTY29yZSk7XG5cdFx0YXNzZXJ0TWF0Y2hlcygnZGknLCAnYWRpdiBjbGFzc25hbWU9XCJcIj48L2Rpdj4nLCAnYWRpdiBjbGFzc25hbWU9XCJcIj48L15kXml2PicsIGZ1enp5U2NvcmUpO1xuXHR9KTtcblxuXHR0ZXN0KCdTdWdnZXN0aW9uIGlzIG5vdCBoaWdobGlnaHRlZCAjODU4MjYnLCBmdW5jdGlvbiAoKSB7XG5cdFx0YXNzZXJ0TWF0Y2hlcygnU2VtYW50aWNUb2tlbnMnLCAnU2VtYW50aWNUb2tlbnNFZGl0cycsICdeU15lXm1eYV5uXnReaV5jXlReb15rXmVebl5zRWRpdHMnLCBmdXp6eVNjb3JlKTtcblx0XHRhc3NlcnRNYXRjaGVzKCdTZW1hbnRpY1Rva2VucycsICdTZW1hbnRpY1Rva2Vuc0VkaXRzJywgJ15TXmVebV5hXm5edF5pXmNeVF5vXmteZV5uXnNFZGl0cycsIGZ1enp5U2NvcmVHcmFjZWZ1bEFnZ3Jlc3NpdmUpO1xuXHR9KTtcblxuXHR0ZXN0KCdJbnRlbGxpU2Vuc2UgY29tcGxldGlvbiBub3QgY29ycmVjdGx5IGhpZ2hsaWdodGluZyB0ZXh0IGluIGZyb250IG9mIGN1cnNvciAjMTE1MjUwJywgZnVuY3Rpb24gKCkge1xuXHRcdGFzc2VydE1hdGNoZXMoJ2xvJywgJ2xvZycsICdebF5vZycsIGZ1enp5U2NvcmUpO1xuXHRcdGFzc2VydE1hdGNoZXMoJy5sbycsICdsb2cnLCAnXmxeb2cnLCBhbnlTY29yZSk7XG5cdFx0YXNzZXJ0TWF0Y2hlcygnLicsICdsb2cnLCAnbG9nJywgYW55U2NvcmUpO1xuXHR9KTtcblxuXHR0ZXN0KCdhbnlTY29yZSBzaG91bGQgbm90IHJlcXVpcmUgYSBzdHJvbmcgZmlyc3QgbWF0Y2gnLCBmdW5jdGlvbiAoKSB7XG5cdFx0YXNzZXJ0TWF0Y2hlcygnYmFyJywgJ2Zvb2JBcicsICdmb29eYl5BXnInLCBhbnlTY29yZSk7XG5cdFx0YXNzZXJ0TWF0Y2hlcygnYmFyJywgJ2Zvb2JhcicsICdmb29eYl5hXnInLCBhbnlTY29yZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvbmZpZ3VyYWJsZSBmdWxsIG1hdGNoIGJvb3N0JywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHByZWZpeCA9ICdjcmVhdGUnO1xuXHRcdGNvbnN0IGEgPSAnY3JlYXRlTW9kZWxTZXJ2aWNlcyc7XG5cdFx0Y29uc3QgYiA9ICdjcmVhdGUnO1xuXG5cdFx0bGV0IGFCb29zdCA9IGZ1enp5U2NvcmUocHJlZml4LCBwcmVmaXgsIDAsIGEsIGEudG9Mb3dlckNhc2UoKSwgMCwgeyBib29zdEZ1bGxNYXRjaDogdHJ1ZSwgZmlyc3RNYXRjaENhbkJlV2VhazogdHJ1ZSB9KTtcblx0XHRsZXQgYkJvb3N0ID0gZnV6enlTY29yZShwcmVmaXgsIHByZWZpeCwgMCwgYiwgYi50b0xvd2VyQ2FzZSgpLCAwLCB7IGJvb3N0RnVsbE1hdGNoOiB0cnVlLCBmaXJzdE1hdGNoQ2FuQmVXZWFrOiB0cnVlIH0pO1xuXHRcdGFzc2VydC5vayhhQm9vc3QpO1xuXHRcdGFzc2VydC5vayhiQm9vc3QpO1xuXHRcdGFzc2VydC5vayhhQm9vc3RbMF0gPCBiQm9vc3RbMF0pO1xuXG5cdFx0Ly8gYWxzbyB3b3JrcyB3aXRoIHdvcmRTdGFydCA+IDAgKGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xODc5MjEpXG5cdFx0Y29uc3Qgd29yZFByZWZpeCA9ICckKHN5bWJvbC1mdW5jdGlvbikgJztcblx0XHRhQm9vc3QgPSBmdXp6eVNjb3JlKHByZWZpeCwgcHJlZml4LCAwLCBgJHt3b3JkUHJlZml4fSR7YX1gLCBgJHt3b3JkUHJlZml4fSR7YX1gLnRvTG93ZXJDYXNlKCksIHdvcmRQcmVmaXgubGVuZ3RoLCB7IGJvb3N0RnVsbE1hdGNoOiB0cnVlLCBmaXJzdE1hdGNoQ2FuQmVXZWFrOiB0cnVlIH0pO1xuXHRcdGJCb29zdCA9IGZ1enp5U2NvcmUocHJlZml4LCBwcmVmaXgsIDAsIGAke3dvcmRQcmVmaXh9JHtifWAsIGAke3dvcmRQcmVmaXh9JHtifWAudG9Mb3dlckNhc2UoKSwgd29yZFByZWZpeC5sZW5ndGgsIHsgYm9vc3RGdWxsTWF0Y2g6IHRydWUsIGZpcnN0TWF0Y2hDYW5CZVdlYWs6IHRydWUgfSk7XG5cdFx0YXNzZXJ0Lm9rKGFCb29zdCk7XG5cdFx0YXNzZXJ0Lm9rKGJCb29zdCk7XG5cdFx0YXNzZXJ0Lm9rKGFCb29zdFswXSA8IGJCb29zdFswXSk7XG5cblx0XHRjb25zdCBhU2NvcmUgPSBmdXp6eVNjb3JlKHByZWZpeCwgcHJlZml4LCAwLCBhLCBhLnRvTG93ZXJDYXNlKCksIDAsIHsgYm9vc3RGdWxsTWF0Y2g6IGZhbHNlLCBmaXJzdE1hdGNoQ2FuQmVXZWFrOiB0cnVlIH0pO1xuXHRcdGNvbnN0IGJTY29yZSA9IGZ1enp5U2NvcmUocHJlZml4LCBwcmVmaXgsIDAsIGIsIGIudG9Mb3dlckNhc2UoKSwgMCwgeyBib29zdEZ1bGxNYXRjaDogZmFsc2UsIGZpcnN0TWF0Y2hDYW5CZVdlYWs6IHRydWUgfSk7XG5cdFx0YXNzZXJ0Lm9rKGFTY29yZSk7XG5cdFx0YXNzZXJ0Lm9rKGJTY29yZSk7XG5cdFx0YXNzZXJ0Lm9rKGFTY29yZVswXSA9PT0gYlNjb3JlWzBdKTtcblx0fSk7XG5cblx0dGVzdCgnVW5leHBlY3RlZCBzdWdnZXN0IGhpZ2hsaWdodGluZyBpZ25vcmVzIHdob2xlIHdvcmQgbWF0Y2ggaW4gZmF2b3Igb2YgbWF0Y2hpbmcgZmlyc3QgbGV0dGVyIzE0NzQyMycsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGFzc2VydE1hdGNoZXMoJ2knLCAnbWFjaGluZS97aWR9JywgJ21hY2hpbmUve15pZH0nLCBmdXp6eVNjb3JlKTtcblx0XHRhc3NlcnRNYXRjaGVzKCdvaycsICdvYm9ib2Jme29rfS91c2VyJywgJ15vYm9ib2Jme29ea30vdXNlcicsIGZ1enp5U2NvcmUpO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBSUEsT0FBTyxZQUFZO0FBQ25CLFNBQVMsVUFBVSxlQUFlLFlBQVksb0JBQW9CLDhCQUE0RCxrQkFBa0IsNEJBQTRCLGVBQWUscUJBQXFCLGtCQUFrQixjQUFjLFVBQVU7QUFDMVAsU0FBUywrQ0FBK0M7QUFFeEQsU0FBUyxTQUFTLFFBQWlCLE1BQWMsb0JBQTRCLFlBQStDO0FBQzNILFFBQU0sSUFBSSxPQUFPLE1BQU0sa0JBQWtCO0FBQ3pDLFNBQU8sR0FBRyxHQUFHLElBQUksaUJBQWlCLGtCQUFrQixFQUFFO0FBQ3RELE1BQUksWUFBWTtBQUNmLFdBQU8sZ0JBQWdCLEdBQUcsVUFBVTtBQUFBLEVBQ3JDO0FBQ0Q7QUFFQSxTQUFTLFlBQVksUUFBaUIsTUFBYyxvQkFBNEI7QUFDL0UsU0FBTyxDQUFDLE9BQU8sTUFBTSxrQkFBa0IsR0FBRyxHQUFHLElBQUksWUFBWSxrQkFBa0IsRUFBRTtBQUNsRjtBQUVBLE1BQU0sV0FBVyxNQUFNO0FBQ3RCLDBDQUF3QztBQUV4QyxPQUFLLE1BQU0sTUFBTTtBQUNoQixRQUFJO0FBQ0osUUFBSTtBQUNKLFVBQU0sWUFBWSxTQUFVLEdBQVcsR0FBcUI7QUFDM0QsYUFBTyxXQUFzQjtBQUFFLGlCQUFTLENBQUM7QUFBSyxlQUFPO0FBQUEsTUFBVTtBQUFBLElBQ2hFO0FBRUEsZUFBVyxDQUFDLEdBQUcsQ0FBQztBQUNoQixhQUFTLEdBQUcsVUFBVSxHQUFHLEtBQUssR0FBRyxVQUFVLEdBQUcsS0FBSyxDQUFDO0FBQ3BELGdCQUFZLFFBQVEsWUFBWSxVQUFVO0FBQzFDLFdBQU8sZ0JBQWdCLFVB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LEVBQUUsT0FBTyxHQUFHLEtBQUssRUFBRTtBQUFBLElBQ3BCLENBQUM7QUFDRCxhQUFTLGtCQUFrQixNQUFNLGtCQUFrQjtBQUFBLE1BQ2xELEVBQUUsT0FBTyxHQUFHLEtBQUssRUFBRTtBQUFBLE1BQ25CLEVBQUUsT0FBTyxHQUFHLEtBQUssRUFBRTtBQUFBLElBQ3BCLENBQUM7QUFDRCxhQUFTLGtCQUFrQixPQUFPLGtCQUFrQjtBQUFBLE1BQ25ELEVBQUUsT0FBTyxHQUFHLEtBQUssRUFBRTtBQUFBLE1BQ25CLEVBQUUsT0FBTyxHQUFHLEtBQUssRUFBRTtBQUFBLE1BQ25CLEVBQUUsT0FBTyxHQUFHLEtBQUssR0FBRztBQUFBLElBQ3JCLENBQUM7QUFDRCxhQUFTLGtCQUFrQixRQUFRLGtCQUFrQjtBQUFBLE1BQ3BELEVBQUUsT0FBTyxHQUFHLEtBQUssRUFBRTtBQUFBLE1BQ25CLEVBQUUsT0FBTyxHQUFHLEtBQUssRUFBRTtBQUFBLE1BQ25CLEVBQUUsT0FBTyxHQUFHLEtBQUssR0FBRztBQUFBLElBQ3JCLENBQUM7QUFDRCxhQUFTLGtCQUFrQixTQUFTLGtCQUFrQjtBQUFBLE1BQ3JELEVBQUUsT0FBTyxHQUFHLEtBQUssRUFBRTtBQUFBLE1BQ25CLEVBQUUsT0FBTyxHQUFHLEtBQUssRUFBRTtBQUFBLE1BQ25CLEVBQUUsT0FBTyxHQUFHLEtBQUssR0FBRztBQUFBLElBQ3JCLENBQUM7QUFDRCxhQUFTLGtCQUFrQixZQUFZLGtCQUFrQjtBQUFBLE1BQ3hELEVBQUUsT0FBTyxHQUFHLEtBQUssRUFBRTtBQUFBLE1BQ25CLEVBQUUsT0FBTyxHQUFHLEtBQUssRUFBRTtBQUFBLE1BQ25CLEVBQUUsT0FBTyxHQUFHLEtBQUssR0FBRztBQUFBLElBQ3JCLENBQUM7QUFDRCxhQUFTLGtCQUFrQixNQUFNLGtCQUFrQjtBQUFBLE1BQ2xELEVBQUUsT0FBTyxHQUFHLEtBQUssRUFBRTtBQUFBLE1BQ25CLEVBQUUsT0FBTyxHQUFHLEtBQUssR0FBRztBQUFBLElBQ3JCLENBQUM7QUFDRCxhQUFTLGtC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
