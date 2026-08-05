import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { Position } from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
import { getMapForWordSeparators } from "../../../common/core/wordCharacterClassifier.js";
import { USUAL_WORD_SEPARATORS } from "../../../common/core/wordHelper.js";
import { EndOfLineSequence, FindMatch, SearchData } from "../../../common/model.js";
import { SearchParams, TextModelSearch, isMultilineRegexSource } from "../../../common/model/textModelSearch.js";
import { createTextModel } from "../testTextModel.js";
suite("TextModelSearch", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  const usualWordSeparators = getMapForWordSeparators(USUAL_WORD_SEPARATORS, []);
  function assertFindMatch(actual, expectedRange, expectedMatches = null) {
    assert.deepStrictEqual(actual, new FindMatch(expectedRange, expectedMatches));
  }
  function _assertFindMatches(model, searchParams, expectedMatches) {
    const actual = TextModelSearch.findMatches(model, searchParams, model.getFullModelRange(), false, 1e3);
    assert.deepStrictEqual(actual, expectedMatches, "findMatches OK");
    let startPos = new Position(1, 1);
    let match = TextModelSearch.findNextMatch(model, searchParams, startPos, false);
    assert.deepStrictEqual(match, expectedMatches[0], `findNextMatch ${startPos}`);
    for (const expectedMatch of expectedMatches) {
      startPos = expectedMatch.range.getStartPosition();
      match = TextModelSearch.findNextMatch(model, searchParams, startPos, false);
      assert.deepStrictEqual(match, expectedMatch, `findNextMatch ${startPos}`);
    }
    startPos = new Position(model.getLineCount(), model.getLineMaxColumn(model.getLineCount()));
    match = TextModelSearch.findPreviousMatch(model, searchParams, startPos, false);
    assert.deepStrictEqual(match, expectedMatches[expectedMatches.length - 1], `findPrevMatch ${startPos}`);
    for (const expectedMatch of expectedMatches) {
      startPos = expectedMatch.range.getEndPosition();
      match = TextModelSearch.findPreviousMatch(model, searchParams, startPos, false);
      assert.deepStrictEqual(match, expectedMatch, `findPrevMatch ${startPos}`);
    }
  }
  function assertFindMatches(text, searchString, isRegex, matchCase, wordSeparators, _expected) {
    const expectedRanges = _expected.map((entry) => new Range(entry[0], entry[1], entry[2], entry[3]));
    const expectedMatches = expectedRanges.map((entry) => new FindMatch(entry, null));
    const searchParams = new SearchParams(searchString, isRegex, matchCase, wordSeparators);
    const model = createTextModel(text);
    _assertFindMatches(model, searchParams, expectedMatches);
    model.dispose();
    const model2 = createTextModel(text);
    model2.setEOL(EndOfLineSequence.CRLF);
    _assertFindMatches(model2, searchParams, expectedMatches);
    model2.dispose();
  }
  const regularText = [
    "This is some foo - bar text which contains foo and bar - as in Barcelona.",
    "Now it begins a word fooBar and now it is caps Foo-isn't this great?",
    "And here's a dull line with nothing interesting in it",
    "It is also interesting if it's part of a word like amazingFooBar",
    "Again nothing interesting here"
  ];
  test("Simple find", () => {
    assertFindMatches(
      regularText.join("\n"),
      "foo",
      false,
      false,
      null,
      [
        [1, 14, 1, 17],
        [1, 44, 1, 47],
        [2, 22, 2, 25],
        [2, 48, 2, 51],
        [4, 59, 4, 62]
      ]
    );
  });
  test("Case sensitive find", () => {
    assertFindMatches(
      regularText.join("\n"),
      "foo",
      false,
      true,
      null,
      [
        [1, 14, 1, 17],
        [1, 44, 1, 47],
        [2, 22, 2, 25]
      ]
    );
  });
  test("Whole words find", () => {
    assertFindMatches(
      regularText.join("\n"),
      "foo",
      false,
      false,
      USUAL_WORD_SEPARATORS,
      [
        [1, 14, 1, 17],
        [1, 44, 1, 47],
        [2, 48, 2, 51]
      ]
    );
  });
  test("/^/ find", () => {
    assertFindMatches(
      regularText.join("\n"),
      "^",
      true,
      false,
      null,
      [
        [1, 1, 1, 1],
        [2, 1, 2, 1],
        [3, 1, 3, 1],
        [4, 1, 4, 1],
        [5, 1, 5, 1]
      ]
    );
  });
  test("/$/ find", () => {
    assertFindMatches(
      regularText.join("\n"),
      "$",
      true,
      false,
      null,
      [
        [1, 74, 1, 74],
        [2, 69, 2, 69],
        [3, 54, 3, 54],
        [4, 65, 4, 65],
        [5, 31, 5, 31]
      ]
    );
  });
  test("/.*/ find", () => {
    assertFindMatches(
      regularText.join("\n"),
      ".*",
      true,
      false,
      null,
      [
        [1, 1, 1, 74],
        [2, 1, 2, 69],
        [3, 1, 3, 54],
        [4, 1, 4, 65],
        [5, 1, 5, 31]
      ]
    );
  });
  test("/^$/ find", () => {
    assertFindMatches(
      [
        "This is some foo - bar text which contains foo and bar - as in Barcelona.",
        "",
        "And here's a dull line with nothing interesting in it",
        "",
        "Again nothing interesting here"
      ].join("\n"),
      "^$",
      true,
      false,
      null,
      [
        [2, 1, 2, 1],
        [4, 1, 4, 1]
      ]
    );
  });
  test("multiline find 1", () => {
    assertFindMatches(
      [
        "Just some text text",
        "Just some text text",
        "some text again",
        "again some text"
      ].join("\n"),
      "text\\n",
      true,
      false,
      null,
      [
        [1, 16, 2, 1],
        [2, 16, 3, 1]
      ]
    );
  });
  test("multiline find 2", () => {
    assertFindMatches(
      [
        "Just some text text",
        "Just some text text",
        "some text again",
        "again some text"
      ].join("\n"),
      "text\\nJust",
      true,
      false,
      null,
      [
        [1, 16, 2, 5]
      ]
    );
  });
  test("multiline find 3", () => {
    assertFindMatches(
      [
        "Just some text text",
        "Just some text text",
        "some text again",
        "again some text"
      ].join("\n"),
      "\\nagain",
      true,
      false,
      null,
      [
        [3, 16, 4, 6]
      ]
    );
  });
  test("multiline find 4", () => {
    assertFindMatches(
      [
        "Just some text text",
        "Just some text text",
        "some text again",
        "again some text"
      ].join("\n"),
      ".*\\nJust.*\\n",
      true,
      false,
      null,
      [
        [1, 1, 3, 1]
      ]
    );
  });
  test("multiline find with line beginning regex", () => {
    assertFindMatches(
      [
        "if",
        "else",
        "",
        "if",
        "else"
      ].join("\n"),
      "^if\\nelse",
      true,
      false,
      null,
      [
        [1, 1, 2, 5],
        [4, 1, 5, 5]
      ]
    );
  });
  test("matching empty lines using boundary expression", () => {
    assertFindMatches(
      [
        "if",
        "",
        "else",
        "  ",
        "if",
        " ",
        "else"
      ].join("\n"),
      "^\\s*$\\n",
      true,
      false,
      null,
      [
        [2, 1, 3, 1],
        [4, 1, 5, 1],
        [6, 1, 7, 1]
      ]
    );
  });
  test("matching lines starting with A and ending with B", () => {
    assertFindMatches(
      [
        "a if b",
        "a",
        "ab",
        "eb"
      ].join("\n"),
      "^a.*b$",
      true,
      false,
      null,
      [
        [1, 1, 1, 7],
        [3, 1, 3, 3]
      ]
    );
  });
  test("multiline find with line ending regex", () => {
    assertFindMatches(
      [
        "if",
        "else",
        "",
        "if",
        "elseif",
        "else"
      ].join("\n"),
      "if\\nelse$",
      true,
      false,
      null,
      [
        [1, 1, 2, 5],
        [5, 5, 6, 5]
      ]
    );
  });
  test("issue #4836 - ^.*$", () => {
    assertFindMatches(
      [
        "Just some text text",
        "",
        "some text again",
        "",
        "again some text"
      ].join("\n"),
      "^.*$",
      true,
      false,
      null,
      [
        [1, 1, 1, 20],
        [2, 1, 2, 1],
        [3, 1, 3, 16],
        [4, 1, 4, 1],
        [5, 1, 5, 16]
      ]
    );
  });
  test("multiline find for non-regex string", () => {
    assertFindMatches(
      [
        "Just some text text",
        "some text text",
        "some text again",
        "again some text",
        "but not some"
      ].join("\n"),
      "text\nsome",
      false,
      false,
      null,
      [
        [1, 16, 2, 5],
        [2, 11, 3, 5]
      ]
    );
  });
  test("issue #3623: Match whole word does not work for not latin characters", () => {
    assertFindMatches(
      [
        "\u044F",
        "\u043A\u043E\u043C\u043F\u0438\u043B\u044F\u0442\u043E\u0440",
        "\u043E\u0431\u0444\u0443\u0441\u043A\u0430\u0446\u0438\u044F",
        ":\u044F-\u044F"
      ].join("\n"),
      "\u044F",
      false,
      false,
      USUAL_WORD_SEPARATORS,
      [
        [1, 1, 1, 2],
        [4, 2, 4, 3],
        [4, 4, 4, 5]
      ]
    );
  });
  test("issue #27459: Match whole words regression", () => {
    assertFindMatches(
      [
        "this._register(this._textAreaInput.onKeyDown((e: IKeyboardEvent) => {",
        "	this._viewController.emitKeyDown(e);",
        "}));"
      ].join("\n"),
      "((e: ",
      false,
      false,
      USUAL_WORD_SEPARATORS,
      [
        [1, 45, 1, 50]
      ]
    );
  });
  test("issue #27594: Search results disappear", () => {
    assertFindMatches(
      [
        "this.server.listen(0);"
      ].join("\n"),
      "listen(",
      false,
      false,
      USUAL_WORD_SEPARATORS,
      [
        [1, 13, 1, 20]
      ]
    );
  });
  test("findNextMatch without regex", () => {
    const model = createTextModel("line line one\nline two\nthree");
    const searchParams = new SearchParams("line", false, false, null);
    let actual = TextModelSearch.findNextMatch(model, searchParams, new Position(1, 1), false);
    assertFindMatch(actual, new Range(1, 1, 1, 5));
    actual = TextModelSearch.findNextMatch(model, searchParams, actual.range.getEndPosition(), false);
    assertFindMatch(actual, new Range(1, 6, 1, 10));
    actual = TextModelSearch.findNextMatch(model, searchParams, new Position(1, 3), false);
    assertFindMatch(actual, new Range(1, 6, 1, 10));
    actual = TextModelSearch.findNextMatch(model, searchParams, actual.range.getEndPosition(), false);
    assertFindMatch(actual, new Range(2, 1, 2, 5));
    actual = TextModelSearch.findNextMatch(model, searchParams, actual.range.getEndPosition(), false);
    assertFindMatch(actual, new Range(1, 1, 1, 5));
    model.dispose();
  });
  test("findNextMatch with beginning boundary regex", () => {
    const model = createTextModel("line one\nline two\nthree");
    const searchParams = new SearchParams("^line", true, false, null);
    let actual = TextModelSearch.findNextMatch(model, searchParams, new Position(1, 1), false);
    assertFindMatch(actual, new Range(1, 1, 1, 5));
    actual = TextModelSearch.findNextMatch(model, searchParams, actual.range.getEndPosition(), false);
    assertFindMatch(actual, new Range(2, 1, 2, 5));
    actual = TextModelSearch.findNextMatch(model, searchParams, new Position(1, 3), false);
    assertFindMatch(actual, new Range(2, 1, 2, 5));
    actual = TextModelSearch.findNextMatch(model, searchParams, actual.range.getEndPosition(), false);
    assertFindMatch(actual, new Range(1, 1, 1, 5));
    model.dispose();
  });
  test("findNextMatch with beginning boundary regex and line has repetitive beginnings", () => {
    const model = createTextModel("line line one\nline two\nthree");
    const searchParams = new SearchParams("^line", true, false, null);
    let actual = TextModelSearch.findNextMatch(model, searchParams, new Position(1, 1), false);
    assertFindMatch(actual, new Range(1, 1, 1, 5));
    actual = TextModelSearch.findNextMatch(model, searchParams, actual.range.getEndPosition(), false);
    assertFindMatch(actual, new Range(2, 1, 2, 5));
    actual = TextModelSearch.findNextMatch(model, searchParams, new Position(1, 3), false);
    assertFindMatch(actual, new Range(2, 1, 2, 5));
    actual = TextModelSearch.findNextMatch(model, searchParams, actual.range.getEndPosition(), false);
    assertFindMatch(actual, new Range(1, 1, 1, 5));
    model.dispose();
  });
  test("findNextMatch with beginning boundary multiline regex and line has repetitive beginnings", () => {
    const model = createTextModel("line line one\nline two\nline three\nline four");
    const searchParams = new SearchParams("^line.*\\nline", true, false, null);
    let actual = TextModelSearch.findNextMatch(model, searchParams, new Position(1, 1), false);
    assertFindMatch(actual, new Range(1, 1, 2, 5));
    actual = TextModelSearch.findNextMatch(model, searchParams, actual.range.getEndPosition(), false);
    assertFindMatch(actual, new Range(3, 1, 4, 5));
    actual = TextModelSearch.findNextMatch(model, searchParams, new Position(2, 1), false);
    assertFindMatch(actual, new Range(2, 1, 3, 5));
    model.dispose();
  });
  test("findNextMatch with ending boundary regex", () => {
    const model = createTextModel("one line line\ntwo line\nthree");
    const searchParams = new SearchParams("line$", true, false, null);
    let actual = TextModelSearch.findNextMatch(model, searchParams, new Position(1, 1), false);
    assertFindMatch(actual, new Range(1, 10, 1, 14));
    actual = TextModelSearch.findNextMatch(model, searchParams, new Position(1, 4), false);
    assertFindMatch(actual, new Range(1, 10, 1, 14));
    actual = TextModelSearch.findNextMatch(model, searchParams, actual.range.getEndPosition(), false);
    assertFindMatch(actual, new Range(2, 5, 2, 9));
    actual = TextModelSearch.findNextMatch(model, searchParams, actual.range.getEndPosition(), false);
    assertFindMatch(actual, new Range(1, 10, 1, 14));
    model.dispose();
  });
  test("findMatches with capturing matches", () => {
    const model = createTextModel("one line line\ntwo line\nthree");
    const searchParams = new SearchParams("(l(in)e)", true, false, null);
    const actual = TextModelSearch.findMatches(model, searchParams, model.getFullModelRange(), true, 100);
    assert.deepStrictEqual(actual, [
      new FindMatch(new Range(1, 5, 1, 9), ["line", "line", "in"]),
      new FindMatch(new Range(1, 10, 1, 14), ["line", "line", "in"]),
      new FindMatch(new Range(2, 5, 2, 9), ["line", "line", "in"])
    ]);
    model.dispose();
  });
  test("findMatches multiline with capturing matches", () => {
    const model = createTextModel("one line line\ntwo line\nthree");
    const searchParams = new SearchParams("(l(in)e)\\n", true, false, null);
    const actual = TextModelSearch.findMatches(model, searchParams, model.getFullModelRange(), true, 100);
    assert.deepStrictEqual(actual, [
      new FindMatch(new Range(1, 10, 2, 1), ["line\n", "line", "in"]),
      new FindMatch(new Range(2, 5, 3, 1), ["line\n", "line", "in"])
    ]);
    model.dispose();
  });
  test("findNextMatch with capturing matches", () => {
    const model = createTextModel("one line line\ntwo line\nthree");
    const searchParams = new SearchParams("(l(in)e)", true, false, null);
    const actual = TextModelSearch.findNextMatch(model, searchParams, new Position(1, 1), true);
    assertFindMatch(actual, new Range(1, 5, 1, 9), ["line", "line", "in"]);
    model.dispose();
  });
  test("findNextMatch multiline with capturing matches", () => {
    const model = createTextModel("one line line\ntwo line\nthree");
    const searchParams = new SearchParams("(l(in)e)\\n", true, false, null);
    const actual = TextModelSearch.findNextMatch(model, searchParams, new Position(1, 1), true);
    assertFindMatch(actual, new Range(1, 10, 2, 1), ["line\n", "line", "in"]);
    model.dispose();
  });
  test("findPreviousMatch with capturing matches", () => {
    const model = createTextModel("one line line\ntwo line\nthree");
    const searchParams = new SearchParams("(l(in)e)", true, false, null);
    const actual = TextModelSearch.findPreviousMatch(model, searchParams, new Position(1, 1), true);
    assertFindMatch(actual, new Range(2, 5, 2, 9), ["line", "line", "in"]);
    model.dispose();
  });
  test("findPreviousMatch multiline with capturing matches", () => {
    const model = createTextModel("one line line\ntwo line\nthree");
    const searchParams = new SearchParams("(l(in)e)\\n", true, false, null);
    const actual = TextModelSearch.findPreviousMatch(model, searchParams, new Position(1, 1), true);
    assertFindMatch(actual, new Range(2, 5, 3, 1), ["line\n", "line", "in"]);
    model.dispose();
  });
  test("\\n matches \\r\\n", () => {
    const model = createTextModel("a\r\nb\r\nc\r\nd\r\ne\r\nf\r\ng\r\nh\r\ni");
    assert.strictEqual(model.getEOL(), "\r\n");
    let searchParams = new SearchParams("h\\n", true, false, null);
    let actual = TextModelSearch.findNextMatch(model, searchParams, new Position(1, 1), true);
    actual = TextModelSearch.findMatches(model, searchParams, model.getFullModelRange(), true, 1e3)[0];
    assertFindMatch(actual, new Range(8, 1, 9, 1), ["h\n"]);
    searchParams = new SearchParams("g\\nh\\n", true, false, null);
    actual = TextModelSearch.findNextMatch(model, searchParams, new Position(1, 1), true);
    actual = TextModelSearch.findMatches(model, searchParams, model.getFullModelRange(), true, 1e3)[0];
    assertFindMatch(actual, new Range(7, 1, 9, 1), ["g\nh\n"]);
    searchParams = new SearchParams("\\ni", true, false, null);
    actual = TextModelSearch.findNextMatch(model, searchParams, new Position(1, 1), true);
    actual = TextModelSearch.findMatches(model, searchParams, model.getFullModelRange(), true, 1e3)[0];
    assertFindMatch(actual, new Range(8, 2, 9, 2), ["\ni"]);
    model.dispose();
  });
  test("\\r can never be found", () => {
    const model = createTextModel("a\r\nb\r\nc\r\nd\r\ne\r\nf\r\ng\r\nh\r\ni");
    assert.strictEqual(model.getEOL(), "\r\n");
    const searchParams = new SearchParams("\\r\\n", true, false, null);
    const actual = TextModelSearch.findNextMatch(model, searchParams, new Position(1, 1), true);
    assert.strictEqual(actual, null);
    assert.deepStrictEqual(TextModelSearch.findMatches(model, searchParams, model.getFullModelRange(), true, 1e3), []);
    model.dispose();
  });
  function assertParseSearchResult(searchString, isRegex, matchCase, wordSeparators, expected) {
    const searchParams = new SearchParams(searchString, isRegex, matchCase, wordSeparators);
    const actual = searchParams.parseSearchRequest();
    if (expected === null) {
      assert.ok(actual === null);
    } else {
      assert.deepStrictEqual(actual.regex, expected.regex);
      assert.deepStrictEqual(actual.simpleSearch, expected.simpleSearch);
      if (wordSeparators) {
        assert.ok(actual.wordSeparators !== null);
      } else {
        assert.ok(actual.wordSeparators === null);
      }
    }
  }
  test("parseSearchRequest invalid", () => {
    assertParseSearchResult("", true, true, USUAL_WORD_SEPARATORS, null);
    assertParseSearchResult("(", true, false, null, null);
  });
  test("parseSearchRequest non regex", () => {
    assertParseSearchResult("foo", false, false, null, new SearchData(/foo/giu, null, null));
    assertParseSearchResult("foo", false, false, USUAL_WORD_SEPARATORS, new SearchData(/foo/giu, usualWordSeparators, null));
    assertParseSearchResult("foo", false, true, null, new SearchData(/foo/gu, null, "foo"));
    assertParseSearchResult("foo", false, true, USUAL_WORD_SEPARATORS, new SearchData(/foo/gu, usualWordSeparators, "foo"));
    assertParseSearchResult("foo\\n", false, false, null, new SearchData(/foo\\n/giu, null, null));
    assertParseSearchResult("foo\\\\n", false, false, null, new SearchData(/foo\\\\n/giu, null, null));
    assertParseSearchResult("foo\\r", false, false, null, new SearchData(/foo\\r/giu, null, null));
    assertParseSearchResult("foo\\\\r", false, false, null, new SearchData(/foo\\\\r/giu, null, null));
  });
  test("parseSearchRequest regex", () => {
    assertParseSearchResult("foo", true, false, null, new SearchData(/foo/giu, null, null));
    assertParseSearchResult("foo", true, false, USUAL_WORD_SEPARATORS, new SearchData(/foo/giu, usualWordSeparators, null));
    assertParseSearchResult("foo", true, true, null, new SearchData(/foo/gu, null, null));
    assertParseSearchResult("foo", true, true, USUAL_WORD_SEPARATORS, new SearchData(/foo/gu, usualWordSeparators, null));
    assertParseSearchResult("foo\\n", true, false, null, new SearchData(/foo\n/gimu, null, null));
    assertParseSearchResult("foo\\\\n", true, false, null, new SearchData(/foo\\n/giu, null, null));
    assertParseSearchResult("foo\\r", true, false, null, new SearchData(/foo\r/gimu, null, null));
    assertParseSearchResult("foo\\\\r", true, false, null, new SearchData(/foo\\r/giu, null, null));
  });
  test("issue #53415. W should match line break.", () => {
    assertFindMatches(
      [
        "text",
        "180702-",
        "180703-180704"
      ].join("\n"),
      "\\d{6}-\\W",
      true,
      false,
      null,
      [
        [2, 1, 3, 1]
      ]
    );
    assertFindMatches(
      [
        "Just some text",
        "",
        "Just"
      ].join("\n"),
      "\\W",
      true,
      false,
      null,
      [
        [1, 5, 1, 6],
        [1, 10, 1, 11],
        [1, 15, 2, 1],
        [2, 1, 3, 1]
      ]
    );
    assertFindMatches(
      [
        "Just some text",
        "",
        "Just"
      ].join("\r\n"),
      "\\W",
      true,
      false,
      null,
      [
        [1, 5, 1, 6],
        [1, 10, 1, 11],
        [1, 15, 2, 1],
        [2, 1, 3, 1]
      ]
    );
    assertFindMatches(
      [
        "Just some text",
        "	Just",
        "Just"
      ].join("\n"),
      "\\W",
      true,
      false,
      null,
      [
        [1, 5, 1, 6],
        [1, 10, 1, 11],
        [1, 15, 2, 1],
        [2, 1, 2, 2],
        [2, 6, 3, 1]
      ]
    );
    assertFindMatches(
      [
        "Just  some text",
        "",
        "Just"
      ].join("\n"),
      "\\W{2}",
      true,
      false,
      null,
      [
        [1, 5, 1, 7],
        [1, 16, 3, 1]
      ]
    );
    assertFindMatches(
      [
        "Just  some text",
        "",
        "Just"
      ].join("\r\n"),
      "\\W{2}",
      true,
      false,
      null,
      [
        [1, 5, 1, 7],
        [1, 16, 3, 1]
      ]
    );
  });
  test("Simple find using unicode escape sequences", () => {
    assertFindMatches(
      regularText.join("\n"),
      "\\u{0066}\\u006f\\u006F",
      true,
      false,
      null,
      [
        [1, 14, 1, 17],
        [1, 44, 1, 47],
        [2, 22, 2, 25],
        [2, 48, 2, 51],
        [4, 59, 4, 62]
      ]
    );
  });
  test("isMultilineRegexSource", () => {
    assert(!isMultilineRegexSource("foo"));
    assert(!isMultilineRegexSource(""));
    assert(!isMultilineRegexSource("foo\\sbar"));
    assert(!isMultilineRegexSource("\\\\notnewline"));
    assert(isMultilineRegexSource("foo\\nbar"));
    assert(isMultilineRegexSource("foo\\nbar\\s"));
    assert(isMultilineRegexSource("foo\\r\\n"));
    assert(isMultilineRegexSource("\\n"));
    assert(isMultilineRegexSource("foo\\W"));
    assert(isMultilineRegexSource("foo\n"));
    assert(isMultilineRegexSource("foo\r\n"));
  });
  test("isMultilineRegexSource correctly identifies multiline patterns", () => {
    const singleLinePatterns = [
      "MARK:\\s*(?<label>.*)$",
      "^// Header$",
      "\\s*[-=]+\\s*"
    ];
    const multiLinePatterns = [
      "^// =+\\n^// (?<label>[^\\n]+?)\\n^// =+$",
      "header\\r\\nfooter",
      "start\\r|\\nend",
      "top\nmiddle\r\nbottom"
    ];
    for (const pattern of singleLinePatterns) {
      assert.strictEqual(isMultilineRegexSource(pattern), false, `Pattern should not be multiline: ${pattern}`);
    }
    for (const pattern of multiLinePatterns) {
      assert.strictEqual(isMultilineRegexSource(pattern), true, `Pattern should be multiline: ${pattern}`);
    }
  });
  test("issue #74715. \\d* finds empty string and stops searching.", () => {
    const model = createTextModel("10.243.30.10");
    const searchParams = new SearchParams("\\d*", true, false, null);
    const actual = TextModelSearch.findMatches(model, searchParams, model.getFullModelRange(), true, 100);
    assert.deepStrictEqual(actual, [
      new FindMatch(new Range(1, 1, 1, 3), ["10"]),
      new FindMatch(new Range(1, 3, 1, 3), [""]),
      new FindMatch(new Range(1, 4, 1, 7), ["243"]),
      new FindMatch(new Range(1, 7, 1, 7), [""]),
      new FindMatch(new Range(1, 8, 1, 10), ["30"]),
      new FindMatch(new Range(1, 10, 1, 10), [""]),
      new FindMatch(new Range(1, 11, 1, 13), ["10"])
    ]);
    model.dispose();
  });
  test("issue #100134. Zero-length matches should properly step over surrogate pairs", () => {
    assertFindMatches(
      "1\u{1F4BB}1",
      "()",
      true,
      false,
      null,
      [
        [1, 1, 1, 1],
        [1, 2, 1, 2],
        [1, 4, 1, 4],
        [1, 5, 1, 5]
      ]
    );
    assertFindMatches(
      "1\u{1F431}\u200D\u{1F4BB}1",
      "()",
      true,
      false,
      null,
      [
        [1, 1, 1, 1],
        [1, 2, 1, 2],
        [1, 4, 1, 4],
        [1, 5, 1, 5],
        [1, 7, 1, 7],
        [1, 8, 1, 8]
      ]
    );
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vbW9kZWwvdGV4dE1vZGVsU2VhcmNoLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBnZXRNYXBGb3JXb3JkU2VwYXJhdG9ycyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3dvcmRDaGFyYWN0ZXJDbGFzc2lmaWVyLmpzJztcbmltcG9ydCB7IFVTVUFMX1dPUkRfU0VQQVJBVE9SUyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3dvcmRIZWxwZXIuanMnO1xuaW1wb3J0IHsgRW5kT2ZMaW5lU2VxdWVuY2UsIEZpbmRNYXRjaCwgU2VhcmNoRGF0YSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwvdGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IFNlYXJjaFBhcmFtcywgVGV4dE1vZGVsU2VhcmNoLCBpc011bHRpbGluZVJlZ2V4U291cmNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL21vZGVsL3RleHRNb2RlbFNlYXJjaC5qcyc7XG5pbXBvcnQgeyBjcmVhdGVUZXh0TW9kZWwgfSBmcm9tICcuLi90ZXN0VGV4dE1vZGVsLmpzJztcblxuLy8gLS0tLS0tLS0tIEZpbmRcbnN1aXRlKCdUZXh0TW9kZWxTZWFyY2gnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0Y29uc3QgdXN1YWxXb3JkU2VwYXJhdG9ycyA9IGdldE1hcEZvcldvcmRTZXBhcmF0b3JzKFVTVUFMX1dPUkRfU0VQQVJBVE9SUywgW10pO1xuXG5cdGZ1bmN0aW9uIGFzc2VydEZpbmRNYXRjaChhY3R1YWw6IEZpbmRNYXRjaCB8IG51bGwsIGV4cGVjdGVkUmFuZ2U6IFJhbmdlLCBleHBlY3RlZE1hdGNoZXM6IHN0cmluZ1tdIHwgbnVsbCA9IG51bGwpOiB2b2lkIHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgbmV3IEZpbmRNYXRjaChleHBlY3RlZFJhbmdlLCBleHBlY3RlZE1hdGNoZXMpKTtcblx0fVxuXG5cdGZ1bmN0aW9uIF9hc3NlcnRGaW5kTWF0Y2hlcyhtb2RlbDogVGV4dE1vZGVsLCBzZWFyY2hQYXJhbXM6IFNlYXJjaFBhcmFtcywgZXhwZWN0ZWRNYXRjaGVzOiBGaW5kTWF0Y2hbXSk6IHZvaWQge1xuXHRcdGNvbnN0IGFjdHVhbCA9IFRleHRNb2RlbFNlYXJjaC5maW5kTWF0Y2hlcyhtb2RlbCwgc2VhcmNoUGFyYW1zLCBtb2RlbC5nZXRGdWxsTW9kZWxSYW5nZSgpLCBmYWxzZSwgMTAwMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkTWF0Y2hlcywgJ2ZpbmRNYXRjaGVzIE9LJyk7XG5cblx0XHQvLyB0ZXN0IGBmaW5kTmV4dE1hdGNoYFxuXHRcdGxldCBzdGFydFBvcyA9IG5ldyBQb3NpdGlvbigxLCAxKTtcblx0XHRsZXQgbWF0Y2ggPSBUZXh0TW9kZWxTZWFyY2guZmluZE5leHRNYXRjaChtb2RlbCwgc2VhcmNoUGFyYW1zLCBzdGFydFBvcywgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobWF0Y2gsIGV4cGVjdGVkTWF0Y2hlc1swXSwgYGZpbmROZXh0TWF0Y2ggJHtzdGFydFBvc31gKTtcblx0XHRmb3IgKGNvbnN0IGV4cGVjdGVkTWF0Y2ggb2YgZXhwZWN0ZWRNYXRjaGVzKSB7XG5cdFx0XHRzdGFydFBvcyA9IGV4cGVjdGVkTWF0Y2gucmFuZ2UuZ2V0U3RhcnRQb3NpdGlvbigpO1xuXHRcdFx0bWF0Y2ggPSBUZXh0TW9kZWxTZWFyY2guZmluZE5leHRNYXRjaChtb2RlbCwgc2VhcmNoUGFyYW1zLCBzdGFydFBvcywgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtYXRjaCwgZXhwZWN0ZWRNYXRjaCwgYGZpbmROZXh0TWF0Y2ggJHtzdGFydFBvc31gKTtcblx0XHR9XG5cblx0XHQvLyB0ZXN0IGBmaW5kUHJldk1hdGNoYFxuXHRcdHN0YXJ0UG9zID0gbmV3IFBvc2l0aW9uKG1vZGVsLmdldExpbmVDb3VudCgpLCBtb2RlbC5nZXRMaW5lTWF4Q29sdW1uKG1vZGVsLmdldExpbmVDb3VudCgpKSk7XG5cdFx0bWF0Y2ggPSBUZXh0TW9kZWxTZWFyY2guZmluZFByZXZpb3VzTWF0Y2gobW9kZWwsIHNlYXJjaFBhcmFtcywgc3RhcnRQb3MsIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1hdGNoLCBleHBlY3RlZE1hdGNoZXNbZXhwZWN0ZWRNYXRjaGVzLmxlbmd0aCAtIDFdLCBgZmluZFByZXZNYXRjaCAke3N0YXJ0UG9zfWApO1xuXHRcdGZvciAoY29uc3QgZXhwZWN0ZWRNYXRjaCBvZiBleHBlY3RlZE1hdGNoZXMpIHtcblx0XHRcdHN0YXJ0UG9zID0gZXhwZWN0ZWRNYXRjaC5yYW5nZS5nZXRFbmRQb3NpdGlvbigpO1xuXHRcdFx0bWF0Y2ggPSBUZXh0TW9kZWxTZWFyY2guZmluZFByZXZpb3VzTWF0Y2gobW9kZWwsIHNlYXJjaFBhcmFtcywgc3RhcnRQb3MsIGZhbHNlKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobWF0Y2gsIGV4cGVjdGVkTWF0Y2gsIGBmaW5kUHJldk1hdGNoICR7c3RhcnRQb3N9YCk7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gYXNzZXJ0RmluZE1hdGNoZXModGV4dDogc3RyaW5nLCBzZWFyY2hTdHJpbmc6IHN0cmluZywgaXNSZWdleDogYm9vbGVhbiwgbWF0Y2hDYXNlOiBib29sZWFuLCB3b3JkU2VwYXJhdG9yczogc3RyaW5nIHwgbnVsbCwgX2V4cGVjdGVkOiBbbnVtYmVyLCBudW1iZXIsIG51bWJlciwgbnVtYmVyXVtdKTogdm9pZCB7XG5cdFx0Y29uc3QgZXhwZWN0ZWRSYW5nZXMgPSBfZXhwZWN0ZWQubWFwKGVudHJ5ID0+IG5ldyBSYW5nZShlbnRyeVswXSwgZW50cnlbMV0sIGVudHJ5WzJdLCBlbnRyeVszXSkpO1xuXHRcdGNvbnN0IGV4cGVjdGVkTWF0Y2hlcyA9IGV4cGVjdGVkUmFuZ2VzLm1hcChlbnRyeSA9PiBuZXcgRmluZE1hdGNoKGVudHJ5LCBudWxsKSk7XG5cdFx0Y29uc3Qgc2VhcmNoUGFyYW1zID0gbmV3IFNlYXJjaFBhcmFtcyhzZWFyY2hTdHJpbmcsIGlzUmVnZXgsIG1hdGNoQ2FzZSwgd29yZFNlcGFyYXRvcnMpO1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwodGV4dCk7XG5cdFx0X2Fzc2VydEZpbmRNYXRjaGVzKG1vZGVsLCBzZWFyY2hQYXJhbXMsIGV4cGVjdGVkTWF0Y2hlcyk7XG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXG5cblx0XHRjb25zdCBtb2RlbDIgPSBjcmVhdGVUZXh0TW9kZWwodGV4dCk7XG5cdFx0bW9kZWwyLnNldEVPTChFbmRPZkxpbmVTZXF1ZW5jZS5DUkxGKTtcblx0XHRfYXNzZXJ0RmluZE1hdGNoZXMobW9kZWwyLCBzZWFyY2hQYXJhbXMsIGV4cGVjdGVkTWF0Y2hlcyk7XG5cdFx0bW9kZWwyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdGNvbnN0IHJlZ3VsYXJUZXh0ID0gW1xuXHRcdCdUaGlzIGlzIHNvbWUgZm9vIC0gYmFyIHRleHQgd2hpY2ggY29udGFpbnMgZm9vIGFuZCBiYXIgLSBhcyBpbiBCYXJjZWxvbmEuJyxcblx0XHQnTm93IGl0IGJlZ2lucyBhIHdvcmQgZm9vQmFyIGFuZCBub3cgaXQgaXMgY2FwcyBGb28taXNuXFwndCB0aGlzIGdyZWF0PycsXG5cdFx0J0FuZCBoZXJlXFwncyBhIGR1bGwgbGluZSB3aXRoIG5vdGhpbmcgaW50ZXJlc3RpbmcgaW4gaXQnLFxuXHRcdCdJdCBpcyBhbHNvIGludGVyZXN0aW5nIGlmIGl0XFwncyBwYXJ0IG9mIGEgd29yZCBsaWtlIGFtYXppbmdGb29CYXInLFxuXHRcdCdBZ2FpbiBub3RoaW5nIGludGVyZXN0aW5nIGhlcmUnXG5cdF07XG5cblx0dGVzdCgnU2ltcGxlIGZpbmQnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0RmluZE1hdGNoZXMoXG5cdFx0XHRyZWd1bGFyVGV4dC5qb2luKCdcXG4nKSxcblx0XHRcdCdmb28nLCBmYWxzZSwgZmFsc2UsIG51bGwsXG5cdFx0XHRbXG5cdFx0XHRcdFsxLCAxNCwgMSwgMTddLFxuXHRcdFx0XHRbMSwgNDQsIDEsIDQ3XSxcblx0XHRcdFx0WzIsIDIyLCAyLCAyNV0sXG5cdFx0XHRcdFsyLCA0OCwgMiwgNTFdLFxuXHRcdFx0XHRbNCwgNTksIDQsIDYyXVxuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ0Nhc2Ugc2Vuc2l0aXZlIGZpbmQnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0RmluZE1hdGNoZXMoXG5cdFx0XHRyZWd1bGFyVGV4dC5qb2luKCdcXG4nKSxcblx0XHRcdCdmb28nLCBmYWxzZSwgdHJ1ZSwgbnVsbCxcblx0XHRcdFtcblx0XHRcdFx0WzEsIDE0LCAxLCAxN10sXG5cdFx0XHRcdFsxLCA0NCwgMSwgNDddLFxuXHRcdFx0XHRbMiwgMjIsIDIsIDI1XVxuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1dob2xlIHdvcmRzIGZpbmQnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0RmluZE1hdGNoZXMoXG5cdFx0XHRyZWd1bGFyVGV4dC5qb2luKCdcXG4nKSxcblx0XHRcdCdmb28nLCBmYWxzZSwgZmFsc2UsIFVTVUFMX1dPUkRfU0VQQVJBVE9SUyxcblx0XHRcdFtcblx0XHRcdFx0WzEsIDE0LCAxLCAxN10sXG5cdFx0XHRcdFsxLCA0NCwgMSwgNDddLFxuXHRcdFx0XHRbMiwgNDgsIDIsIDUxXVxuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJy9eLyBmaW5kJywgKCkgPT4ge1xuXHRcdGFzc2VydEZpbmRNYXRjaGVzKFxuXHRcdFx0cmVndWxhclRleHQuam9pbignXFxuJyksXG5cdFx0XHQnXicsIHRydWUsIGZhbHNlLCBudWxsLFxuXHRcdFx0W1xuXHRcdFx0XHRbMSwgMSwgMSwgMV0sXG5cdFx0XHRcdFsyLCAxLCAyLCAxXSxcblx0XHRcdFx0WzMsIDEsIDMsIDFdLFxuXHRcdFx0XHRbNCwgMSwgNCwgMV0sXG5cdFx0XHRcdFs1LCAxLCA1LCAxXVxuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJy8kLyBmaW5kJywgKCkgPT4ge1xuXHRcdGFzc2VydEZpbmRNYXRjaGVzKFxuXHRcdFx0cmVndWxhclRleHQuam9pbignXFxuJyksXG5cdFx0XHQnJCcsIHRydWUsIGZhbHNlLCBudWxsLFxuXHRcdFx0W1xuXHRcdFx0XHRbMSwgNzQsIDEsIDc0XSxcblx0XHRcdFx0WzIsIDY5LCAyLCA2OV0sXG5cdFx0XHRcdFszLCA1NCwgMywgNTRdLFxuXHRcdFx0XHRbNCwgNjUsIDQsIDY1XSxcblx0XHRcdFx0WzUsIDMxLCA1LCAzMV1cblx0XHRcdF1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCcvLiovIGZpbmQnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0RmluZE1hdGNoZXMoXG5cdFx0XHRyZWd1bGFyVGV4dC5qb2luKCdcXG4nKSxcblx0XHRcdCcuKicsIHRydWUsIGZhbHNlLCBudWxsLFxuXHRcdFx0W1xuXHRcdFx0XHRbMSwgMSwgMSwgNzRdLFxuXHRcdFx0XHRbMiwgMSwgMiwgNjldLFxuXHRcdFx0XHRbMywgMSwgMywgNTRdLFxuXHRcdFx0XHRbNCwgMSwgNCwgNjVdLFxuXHRcdFx0XHRbNSwgMSwgNSwgMzFdXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnL14kLyBmaW5kJywgKCkgPT4ge1xuXHRcdGFzc2VydEZpbmRNYXRjaGVzKFxuXHRcdFx0W1xuXHRcdFx0XHQnVGhpcyBpcyBzb21lIGZvbyAtIGJhciB0ZXh0IHdoaWNoIGNvbnRhaW5zIGZvbyBhbmQgYmFyIC0gYXMgaW4gQmFyY2Vsb25hLicsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnQW5kIGhlcmVcXCdzIGEgZHVsbCBsaW5lIHdpdGggbm90aGluZyBpbnRlcmVzdGluZyBpbiBpdCcsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnQWdhaW4gbm90aGluZyBpbnRlcmVzdGluZyBoZXJlJ1xuXHRcdFx0XS5qb2luKCdcXG4nKSxcblx0XHRcdCdeJCcsIHRydWUsIGZhbHNlLCBudWxsLFxuXHRcdFx0W1xuXHRcdFx0XHRbMiwgMSwgMiwgMV0sXG5cdFx0XHRcdFs0LCAxLCA0LCAxXVxuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ211bHRpbGluZSBmaW5kIDEnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0RmluZE1hdGNoZXMoXG5cdFx0XHRbXG5cdFx0XHRcdCdKdXN0IHNvbWUgdGV4dCB0ZXh0Jyxcblx0XHRcdFx0J0p1c3Qgc29tZSB0ZXh0IHRleHQnLFxuXHRcdFx0XHQnc29tZSB0ZXh0IGFnYWluJyxcblx0XHRcdFx0J2FnYWluIHNvbWUgdGV4dCdcblx0XHRcdF0uam9pbignXFxuJyksXG5cdFx0XHQndGV4dFxcXFxuJywgdHJ1ZSwgZmFsc2UsIG51bGwsXG5cdFx0XHRbXG5cdFx0XHRcdFsxLCAxNiwgMiwgMV0sXG5cdFx0XHRcdFsyLCAxNiwgMywgMV0sXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnbXVsdGlsaW5lIGZpbmQgMicsICgpID0+IHtcblx0XHRhc3NlcnRGaW5kTWF0Y2hlcyhcblx0XHRcdFtcblx0XHRcdFx0J0p1c3Qgc29tZSB0ZXh0IHRleHQnLFxuXHRcdFx0XHQnSnVzdCBzb21lIHRleHQgdGV4dCcsXG5cdFx0XHRcdCdzb21lIHRleHQgYWdhaW4nLFxuXHRcdFx0XHQnYWdhaW4gc29tZSB0ZXh0J1xuXHRcdFx0XS5qb2luKCdcXG4nKSxcblx0XHRcdCd0ZXh0XFxcXG5KdXN0JywgdHJ1ZSwgZmFsc2UsIG51bGwsXG5cdFx0XHRbXG5cdFx0XHRcdFsxLCAxNiwgMiwgNV1cblx0XHRcdF1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdtdWx0aWxpbmUgZmluZCAzJywgKCkgPT4ge1xuXHRcdGFzc2VydEZpbmRNYXRjaGVzKFxuXHRcdFx0W1xuXHRcdFx0XHQnSnVzdCBzb21lIHRleHQgdGV4dCcsXG5cdFx0XHRcdCdKdXN0IHNvbWUgdGV4dCB0ZXh0Jyxcblx0XHRcdFx0J3NvbWUgdGV4dCBhZ2FpbicsXG5cdFx0XHRcdCdhZ2FpbiBzb21lIHRleHQnXG5cdFx0XHRdLmpvaW4oJ1xcbicpLFxuXHRcdFx0J1xcXFxuYWdhaW4nLCB0cnVlLCBmYWxzZSwgbnVsbCxcblx0XHRcdFtcblx0XHRcdFx0WzMsIDE2LCA0LCA2XVxuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ211bHRpbGluZSBmaW5kIDQnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0RmluZE1hdGNoZXMoXG5cdFx0XHRbXG5cdFx0XHRcdCdKdXN0IHNvbWUgdGV4dCB0ZXh0Jyxcblx0XHRcdFx0J0p1c3Qgc29tZSB0ZXh0IHRleHQnLFxuXHRcdFx0XHQnc29tZSB0ZXh0IGFnYWluJyxcblx0XHRcdFx0J2FnYWluIHNvbWUgdGV4dCdcblx0XHRcdF0uam9pbignXFxuJyksXG5cdFx0XHQnLipcXFxcbkp1c3QuKlxcXFxuJywgdHJ1ZSwgZmFsc2UsIG51bGwsXG5cdFx0XHRbXG5cdFx0XHRcdFsxLCAxLCAzLCAxXVxuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ211bHRpbGluZSBmaW5kIHdpdGggbGluZSBiZWdpbm5pbmcgcmVnZXgnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0RmluZE1hdGNoZXMoXG5cdFx0XHRbXG5cdFx0XHRcdCdpZicsXG5cdFx0XHRcdCdlbHNlJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCdpZicsXG5cdFx0XHRcdCdlbHNlJ1xuXHRcdFx0XS5qb2luKCdcXG4nKSxcblx0XHRcdCdeaWZcXFxcbmVsc2UnLCB0cnVlLCBmYWxzZSwgbnVsbCxcblx0XHRcdFtcblx0XHRcdFx0WzEsIDEsIDIsIDVdLFxuXHRcdFx0XHRbNCwgMSwgNSwgNV1cblx0XHRcdF1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdtYXRjaGluZyBlbXB0eSBsaW5lcyB1c2luZyBib3VuZGFyeSBleHByZXNzaW9uJywgKCkgPT4ge1xuXHRcdGFzc2VydEZpbmRNYXRjaGVzKFxuXHRcdFx0W1xuXHRcdFx0XHQnaWYnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0J2Vsc2UnLFxuXHRcdFx0XHQnICAnLFxuXHRcdFx0XHQnaWYnLFxuXHRcdFx0XHQnICcsXG5cdFx0XHRcdCdlbHNlJ1xuXHRcdFx0XS5qb2luKCdcXG4nKSxcblx0XHRcdCdeXFxcXHMqJFxcXFxuJywgdHJ1ZSwgZmFsc2UsIG51bGwsXG5cdFx0XHRbXG5cdFx0XHRcdFsyLCAxLCAzLCAxXSxcblx0XHRcdFx0WzQsIDEsIDUsIDFdLFxuXHRcdFx0XHRbNiwgMSwgNywgMV1cblx0XHRcdF1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdtYXRjaGluZyBsaW5lcyBzdGFydGluZyB3aXRoIEEgYW5kIGVuZGluZyB3aXRoIEInLCAoKSA9PiB7XG5cdFx0YXNzZXJ0RmluZE1hdGNoZXMoXG5cdFx0XHRbXG5cdFx0XHRcdCdhIGlmIGInLFxuXHRcdFx0XHQnYScsXG5cdFx0XHRcdCdhYicsXG5cdFx0XHRcdCdlYidcblx0XHRcdF0uam9pbignXFxuJyksXG5cdFx0XHQnXmEuKmIkJywgdHJ1ZSwgZmFsc2UsIG51bGwsXG5cdFx0XHRbXG5cdFx0XHRcdFsxLCAxLCAxLCA3XSxcblx0XHRcdFx0WzMsIDEsIDMsIDNdXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnbXVsdGlsaW5lIGZpbmQgd2l0aCBsaW5lIGVuZGluZyByZWdleCcsICgpID0+IHtcblx0XHRhc3NlcnRGaW5kTWF0Y2hlcyhcblx0XHRcdFtcblx0XHRcdFx0J2lmJyxcblx0XHRcdFx0J2Vsc2UnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0J2lmJyxcblx0XHRcdFx0J2Vsc2VpZicsXG5cdFx0XHRcdCdlbHNlJ1xuXHRcdFx0XS5qb2luKCdcXG4nKSxcblx0XHRcdCdpZlxcXFxuZWxzZSQnLCB0cnVlLCBmYWxzZSwgbnVsbCxcblx0XHRcdFtcblx0XHRcdFx0WzEsIDEsIDIsIDVdLFxuXHRcdFx0XHRbNSwgNSwgNiwgNV1cblx0XHRcdF1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjNDgzNiAtIF4uKiQnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0RmluZE1hdGNoZXMoXG5cdFx0XHRbXG5cdFx0XHRcdCdKdXN0IHNvbWUgdGV4dCB0ZXh0Jyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCdzb21lIHRleHQgYWdhaW4nLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0J2FnYWluIHNvbWUgdGV4dCdcblx0XHRcdF0uam9pbignXFxuJyksXG5cdFx0XHQnXi4qJCcsIHRydWUsIGZhbHNlLCBudWxsLFxuXHRcdFx0W1xuXHRcdFx0XHRbMSwgMSwgMSwgMjBdLFxuXHRcdFx0XHRbMiwgMSwgMiwgMV0sXG5cdFx0XHRcdFszLCAxLCAzLCAxNl0sXG5cdFx0XHRcdFs0LCAxLCA0LCAxXSxcblx0XHRcdFx0WzUsIDEsIDUsIDE2XSxcblx0XHRcdF1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdtdWx0aWxpbmUgZmluZCBmb3Igbm9uLXJlZ2V4IHN0cmluZycsICgpID0+IHtcblx0XHRhc3NlcnRGaW5kTWF0Y2hlcyhcblx0XHRcdFtcblx0XHRcdFx0J0p1c3Qgc29tZSB0ZXh0IHRleHQnLFxuXHRcdFx0XHQnc29tZSB0ZXh0IHRleHQnLFxuXHRcdFx0XHQnc29tZSB0ZXh0IGFnYWluJyxcblx0XHRcdFx0J2FnYWluIHNvbWUgdGV4dCcsXG5cdFx0XHRcdCdidXQgbm90IHNvbWUnXG5cdFx0XHRdLmpvaW4oJ1xcbicpLFxuXHRcdFx0J3RleHRcXG5zb21lJywgZmFsc2UsIGZhbHNlLCBudWxsLFxuXHRcdFx0W1xuXHRcdFx0XHRbMSwgMTYsIDIsIDVdLFxuXHRcdFx0XHRbMiwgMTEsIDMsIDVdLFxuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMzNjIzOiBNYXRjaCB3aG9sZSB3b3JkIGRvZXMgbm90IHdvcmsgZm9yIG5vdCBsYXRpbiBjaGFyYWN0ZXJzJywgKCkgPT4ge1xuXHRcdGFzc2VydEZpbmRNYXRjaGVzKFxuXHRcdFx0W1xuXHRcdFx0XHQnXHUwNDRGJyxcblx0XHRcdFx0J1x1MDQzQVx1MDQzRVx1MDQzQ1x1MDQzRlx1MDQzOFx1MDQzQlx1MDQ0Rlx1MDQ0Mlx1MDQzRVx1MDQ0MCcsXG5cdFx0XHRcdCdcdTA0M0VcdTA0MzFcdTA0NDRcdTA0NDNcdTA0NDFcdTA0M0FcdTA0MzBcdTA0NDZcdTA0MzhcdTA0NEYnLFxuXHRcdFx0XHQnOlx1MDQ0Ri1cdTA0NEYnXG5cdFx0XHRdLmpvaW4oJ1xcbicpLFxuXHRcdFx0J1x1MDQ0RicsIGZhbHNlLCBmYWxzZSwgVVNVQUxfV09SRF9TRVBBUkFUT1JTLFxuXHRcdFx0W1xuXHRcdFx0XHRbMSwgMSwgMSwgMl0sXG5cdFx0XHRcdFs0LCAyLCA0LCAzXSxcblx0XHRcdFx0WzQsIDQsIDQsIDVdLFxuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMyNzQ1OTogTWF0Y2ggd2hvbGUgd29yZHMgcmVncmVzc2lvbicsICgpID0+IHtcblx0XHRhc3NlcnRGaW5kTWF0Y2hlcyhcblx0XHRcdFtcblx0XHRcdFx0J3RoaXMuX3JlZ2lzdGVyKHRoaXMuX3RleHRBcmVhSW5wdXQub25LZXlEb3duKChlOiBJS2V5Ym9hcmRFdmVudCkgPT4geycsXG5cdFx0XHRcdCdcdHRoaXMuX3ZpZXdDb250cm9sbGVyLmVtaXRLZXlEb3duKGUpOycsXG5cdFx0XHRcdCd9KSk7Jyxcblx0XHRcdF0uam9pbignXFxuJyksXG5cdFx0XHQnKChlOiAnLCBmYWxzZSwgZmFsc2UsIFVTVUFMX1dPUkRfU0VQQVJBVE9SUyxcblx0XHRcdFtcblx0XHRcdFx0WzEsIDQ1LCAxLCA1MF1cblx0XHRcdF1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMjc1OTQ6IFNlYXJjaCByZXN1bHRzIGRpc2FwcGVhcicsICgpID0+IHtcblx0XHRhc3NlcnRGaW5kTWF0Y2hlcyhcblx0XHRcdFtcblx0XHRcdFx0J3RoaXMuc2VydmVyLmxpc3RlbigwKTsnLFxuXHRcdFx0XS5qb2luKCdcXG4nKSxcblx0XHRcdCdsaXN0ZW4oJywgZmFsc2UsIGZhbHNlLCBVU1VBTF9XT1JEX1NFUEFSQVRPUlMsXG5cdFx0XHRbXG5cdFx0XHRcdFsxLCAxMywgMSwgMjBdXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnZmluZE5leHRNYXRjaCB3aXRob3V0IHJlZ2V4JywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKCdsaW5lIGxpbmUgb25lXFxubGluZSB0d29cXG50aHJlZScpO1xuXG5cdFx0Y29uc3Qgc2VhcmNoUGFyYW1zID0gbmV3IFNlYXJjaFBhcmFtcygnbGluZScsIGZhbHNlLCBmYWxzZSwgbnVsbCk7XG5cblx0XHRsZXQgYWN0dWFsID0gVGV4dE1vZGVsU2VhcmNoLmZpbmROZXh0TWF0Y2gobW9kZWwsIHNlYXJjaFBhcmFtcywgbmV3IFBvc2l0aW9uKDEsIDEpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0RmluZE1hdGNoKGFjdHVhbCwgbmV3IFJhbmdlKDEsIDEsIDEsIDUpKTtcblxuXHRcdGFjdHVhbCA9IFRleHRNb2RlbFNlYXJjaC5maW5kTmV4dE1hdGNoKG1vZGVsLCBzZWFyY2hQYXJhbXMsIGFjdHVhbCEucmFuZ2UuZ2V0RW5kUG9zaXRpb24oKSwgZmFsc2UpO1xuXHRcdGFzc2VydEZpbmRNYXRjaChhY3R1YWwsIG5ldyBSYW5nZSgxLCA2LCAxLCAxMCkpO1xuXG5cdFx0YWN0dWFsID0gVGV4dE1vZGVsU2VhcmNoLmZpbmROZXh0TWF0Y2gobW9kZWwsIHNlYXJjaFBhcmFtcywgbmV3IFBvc2l0aW9uKDEsIDMpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0RmluZE1hdGNoKGFjdHVhbCwgbmV3IFJhbmdlKDEsIDYsIDEsIDEwKSk7XG5cblx0XHRhY3R1YWwgPSBUZXh0TW9kZWxTZWFyY2guZmluZE5leHRNYXRjaChtb2RlbCwgc2VhcmNoUGFyYW1zLCBhY3R1YWwhLnJhbmdlLmdldEVuZFBvc2l0aW9uKCksIGZhbHNlKTtcblx0XHRhc3NlcnRGaW5kTWF0Y2goYWN0dWFsLCBuZXcgUmFuZ2UoMiwgMSwgMiwgNSkpO1xuXG5cdFx0YWN0dWFsID0gVGV4dE1vZGVsU2VhcmNoLmZpbmROZXh0TWF0Y2gobW9kZWwsIHNlYXJjaFBhcmFtcywgYWN0dWFsIS5yYW5nZS5nZXRFbmRQb3NpdGlvbigpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0RmluZE1hdGNoKGFjdHVhbCwgbmV3IFJhbmdlKDEsIDEsIDEsIDUpKTtcblxuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnZmluZE5leHRNYXRjaCB3aXRoIGJlZ2lubmluZyBib3VuZGFyeSByZWdleCcsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbCgnbGluZSBvbmVcXG5saW5lIHR3b1xcbnRocmVlJyk7XG5cblx0XHRjb25zdCBzZWFyY2hQYXJhbXMgPSBuZXcgU2VhcmNoUGFyYW1zKCdebGluZScsIHRydWUsIGZhbHNlLCBudWxsKTtcblxuXHRcdGxldCBhY3R1YWwgPSBUZXh0TW9kZWxTZWFyY2guZmluZE5leHRNYXRjaChtb2RlbCwgc2VhcmNoUGFyYW1zLCBuZXcgUG9zaXRpb24oMSwgMSksIGZhbHNlKTtcblx0XHRhc3NlcnRGaW5kTWF0Y2goYWN0dWFsLCBuZXcgUmFuZ2UoMSwgMSwgMSwgNSkpO1xuXG5cdFx0YWN0dWFsID0gVGV4dE1vZGVsU2VhcmNoLmZpbmROZXh0TWF0Y2gobW9kZWwsIHNlYXJjaFBhcmFtcywgYWN0dWFsIS5yYW5nZS5nZXRFbmRQb3NpdGlvbigpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0RmluZE1hdGNoKGFjdHVhbCwgbmV3IFJhbmdlKDIsIDEsIDIsIDUpKTtcblxuXHRcdGFjdHVhbCA9IFRleHRNb2RlbFNlYXJjaC5maW5kTmV4dE1hdGNoKG1vZGVsLCBzZWFyY2hQYXJhbXMsIG5ldyBQb3NpdGlvbigxLCAzKSwgZmFsc2UpO1xuXHRcdGFzc2VydEZpbmRNYXRjaChhY3R1YWwsIG5ldyBSYW5nZSgyLCAxLCAyLCA1KSk7XG5cblx0XHRhY3R1YWwgPSBUZXh0TW9kZWxTZWFyY2guZmluZE5leHRNYXRjaChtb2RlbCwgc2VhcmNoUGFyYW1zLCBhY3R1YWwhLnJhbmdlLmdldEVuZFBvc2l0aW9uKCksIGZhbHNlKTtcblx0XHRhc3NlcnRGaW5kTWF0Y2goYWN0dWFsLCBuZXcgUmFuZ2UoMSwgMSwgMSwgNSkpO1xuXG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdmaW5kTmV4dE1hdGNoIHdpdGggYmVnaW5uaW5nIGJvdW5kYXJ5IHJlZ2V4IGFuZCBsaW5lIGhhcyByZXBldGl0aXZlIGJlZ2lubmluZ3MnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoJ2xpbmUgbGluZSBvbmVcXG5saW5lIHR3b1xcbnRocmVlJyk7XG5cblx0XHRjb25zdCBzZWFyY2hQYXJhbXMgPSBuZXcgU2VhcmNoUGFyYW1zKCdebGluZScsIHRydWUsIGZhbHNlLCBudWxsKTtcblxuXHRcdGxldCBhY3R1YWwgPSBUZXh0TW9kZWxTZWFyY2guZmluZE5leHRNYXRjaChtb2RlbCwgc2VhcmNoUGFyYW1zLCBuZXcgUG9zaXRpb24oMSwgMSksIGZhbHNlKTtcblx0XHRhc3NlcnRGaW5kTWF0Y2goYWN0dWFsLCBuZXcgUmFuZ2UoMSwgMSwgMSwgNSkpO1xuXG5cdFx0YWN0dWFsID0gVGV4dE1vZGVsU2VhcmNoLmZpbmROZXh0TWF0Y2gobW9kZWwsIHNlYXJjaFBhcmFtcywgYWN0dWFsIS5yYW5nZS5nZXRFbmRQb3NpdGlvbigpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0RmluZE1hdGNoKGFjdHVhbCwgbmV3IFJhbmdlKDIsIDEsIDIsIDUpKTtcblxuXHRcdGFjdHVhbCA9IFRleHRNb2RlbFNlYXJjaC5maW5kTmV4dE1hdGNoKG1vZGVsLCBzZWFyY2hQYXJhbXMsIG5ldyBQb3NpdGlvbigxLCAzKSwgZmFsc2UpO1xuXHRcdGFzc2VydEZpbmRNYXRjaChhY3R1YWwsIG5ldyBSYW5nZSgyLCAxLCAyLCA1KSk7XG5cblx0XHRhY3R1YWwgPSBUZXh0TW9kZWxTZWFyY2guZmluZE5leHRNYXRjaChtb2RlbCwgc2VhcmNoUGFyYW1zLCBhY3R1YWwhLnJhbmdlLmdldEVuZFBvc2l0aW9uKCksIGZhbHNlKTtcblx0XHRhc3NlcnRGaW5kTWF0Y2goYWN0dWFsLCBuZXcgUmFuZ2UoMSwgMSwgMSwgNSkpO1xuXG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdmaW5kTmV4dE1hdGNoIHdpdGggYmVnaW5uaW5nIGJvdW5kYXJ5IG11bHRpbGluZSByZWdleCBhbmQgbGluZSBoYXMgcmVwZXRpdGl2ZSBiZWdpbm5pbmdzJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKCdsaW5lIGxpbmUgb25lXFxubGluZSB0d29cXG5saW5lIHRocmVlXFxubGluZSBmb3VyJyk7XG5cblx0XHRjb25zdCBzZWFyY2hQYXJhbXMgPSBuZXcgU2VhcmNoUGFyYW1zKCdebGluZS4qXFxcXG5saW5lJywgdHJ1ZSwgZmFsc2UsIG51bGwpO1xuXG5cdFx0bGV0IGFjdHVhbCA9IFRleHRNb2RlbFNlYXJjaC5maW5kTmV4dE1hdGNoKG1vZGVsLCBzZWFyY2hQYXJhbXMsIG5ldyBQb3NpdGlvbigxLCAxKSwgZmFsc2UpO1xuXHRcdGFzc2VydEZpbmRNYXRjaChhY3R1YWwsIG5ldyBSYW5nZSgxLCAxLCAyLCA1KSk7XG5cblx0XHRhY3R1YWwgPSBUZXh0TW9kZWxTZWFyY2guZmluZE5leHRNYXRjaChtb2RlbCwgc2VhcmNoUGFyYW1zLCBhY3R1YWwhLnJhbmdlLmdldEVuZFBvc2l0aW9uKCksIGZhbHNlKTtcblx0XHRhc3NlcnRGaW5kTWF0Y2goYWN0dWFsLCBuZXcgUmFuZ2UoMywgMSwgNCwgNSkpO1xuXG5cdFx0YWN0dWFsID0gVGV4dE1vZGVsU2VhcmNoLmZpbmROZXh0TWF0Y2gobW9kZWwsIHNlYXJjaFBhcmFtcywgbmV3IFBvc2l0aW9uKDIsIDEpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0RmluZE1hdGNoKGFjdHVhbCwgbmV3IFJhbmdlKDIsIDEsIDMsIDUpKTtcblxuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnZmluZE5leHRNYXRjaCB3aXRoIGVuZGluZyBib3VuZGFyeSByZWdleCcsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbCgnb25lIGxpbmUgbGluZVxcbnR3byBsaW5lXFxudGhyZWUnKTtcblxuXHRcdGNvbnN0IHNlYXJjaFBhcmFtcyA9IG5ldyBTZWFyY2hQYXJhbXMoJ2xpbmUkJywgdHJ1ZSwgZmFsc2UsIG51bGwpO1xuXG5cdFx0bGV0IGFjdHVhbCA9IFRleHRNb2RlbFNlYXJjaC5maW5kTmV4dE1hdGNoKG1vZGVsLCBzZWFyY2hQYXJhbXMsIG5ldyBQb3NpdGlvbigxLCAxKSwgZmFsc2UpO1xuXHRcdGFzc2VydEZpbmRNYXRjaChhY3R1YWwsIG5ldyBSYW5nZSgxLCAxMCwgMSwgMTQpKTtcblxuXHRcdGFjdHVhbCA9IFRleHRNb2RlbFNlYXJjaC5maW5kTmV4dE1hdGNoKG1vZGVsLCBzZWFyY2hQYXJhbXMsIG5ldyBQb3NpdGlvbigxLCA0KSwgZmFsc2UpO1xuXHRcdGFzc2VydEZpbmRNYXRjaChhY3R1YWwsIG5ldyBSYW5nZSgxLCAxMCwgMSwgMTQpKTtcblxuXHRcdGFjdHVhbCA9IFRleHRNb2RlbFNlYXJjaC5maW5kTmV4dE1hdGNoKG1vZGVsLCBzZWFyY2hQYXJhbXMsIGFjdHVhbCEucmFuZ2UuZ2V0RW5kUG9zaXRpb24oKSwgZmFsc2UpO1xuXHRcdGFzc2VydEZpbmRNYXRjaChhY3R1YWwsIG5ldyBSYW5nZSgyLCA1LCAyLCA5KSk7XG5cblx0XHRhY3R1YWwgPSBUZXh0TW9kZWxTZWFyY2guZmluZE5leHRNYXRjaChtb2RlbCwgc2VhcmNoUGFyYW1zLCBhY3R1YWwhLnJhbmdlLmdldEVuZFBvc2l0aW9uKCksIGZhbHNlKTtcblx0XHRhc3NlcnRGaW5kTWF0Y2goYWN0dWFsLCBuZXcgUmFuZ2UoMSwgMTAsIDEsIDE0KSk7XG5cblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ZpbmRNYXRjaGVzIHdpdGggY2FwdHVyaW5nIG1hdGNoZXMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoJ29uZSBsaW5lIGxpbmVcXG50d28gbGluZVxcbnRocmVlJyk7XG5cblx0XHRjb25zdCBzZWFyY2hQYXJhbXMgPSBuZXcgU2VhcmNoUGFyYW1zKCcobChpbillKScsIHRydWUsIGZhbHNlLCBudWxsKTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IFRleHRNb2RlbFNlYXJjaC5maW5kTWF0Y2hlcyhtb2RlbCwgc2VhcmNoUGFyYW1zLCBtb2RlbC5nZXRGdWxsTW9kZWxSYW5nZSgpLCB0cnVlLCAxMDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBbXG5cdFx0XHRuZXcgRmluZE1hdGNoKG5ldyBSYW5nZSgxLCA1LCAxLCA5KSwgWydsaW5lJywgJ2xpbmUnLCAnaW4nXSksXG5cdFx0XHRuZXcgRmluZE1hdGNoKG5ldyBSYW5nZSgxLCAxMCwgMSwgMTQpLCBbJ2xpbmUnLCAnbGluZScsICdpbiddKSxcblx0XHRcdG5ldyBGaW5kTWF0Y2gobmV3IFJhbmdlKDIsIDUsIDIsIDkpLCBbJ2xpbmUnLCAnbGluZScsICdpbiddKSxcblx0XHRdKTtcblxuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnZmluZE1hdGNoZXMgbXVsdGlsaW5lIHdpdGggY2FwdHVyaW5nIG1hdGNoZXMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoJ29uZSBsaW5lIGxpbmVcXG50d28gbGluZVxcbnRocmVlJyk7XG5cblx0XHRjb25zdCBzZWFyY2hQYXJhbXMgPSBuZXcgU2VhcmNoUGFyYW1zKCcobChpbillKVxcXFxuJywgdHJ1ZSwgZmFsc2UsIG51bGwpO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gVGV4dE1vZGVsU2VhcmNoLmZpbmRNYXRjaGVzKG1vZGVsLCBzZWFyY2hQYXJhbXMsIG1vZGVsLmdldEZ1bGxNb2RlbFJhbmdlKCksIHRydWUsIDEwMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIFtcblx0XHRcdG5ldyBGaW5kTWF0Y2gobmV3IFJhbmdlKDEsIDEwLCAyLCAxKSwgWydsaW5lXFxuJywgJ2xpbmUnLCAnaW4nXSksXG5cdFx0XHRuZXcgRmluZE1hdGNoKG5ldyBSYW5nZSgyLCA1LCAzLCAxKSwgWydsaW5lXFxuJywgJ2xpbmUnLCAnaW4nXSksXG5cdFx0XSk7XG5cblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ZpbmROZXh0TWF0Y2ggd2l0aCBjYXB0dXJpbmcgbWF0Y2hlcycsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbCgnb25lIGxpbmUgbGluZVxcbnR3byBsaW5lXFxudGhyZWUnKTtcblxuXHRcdGNvbnN0IHNlYXJjaFBhcmFtcyA9IG5ldyBTZWFyY2hQYXJhbXMoJyhsKGluKWUpJywgdHJ1ZSwgZmFsc2UsIG51bGwpO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gVGV4dE1vZGVsU2VhcmNoLmZpbmROZXh0TWF0Y2gobW9kZWwsIHNlYXJjaFBhcmFtcywgbmV3IFBvc2l0aW9uKDEsIDEpLCB0cnVlKTtcblx0XHRhc3NlcnRGaW5kTWF0Y2goYWN0dWFsLCBuZXcgUmFuZ2UoMSwgNSwgMSwgOSksIFsnbGluZScsICdsaW5lJywgJ2luJ10pO1xuXG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdmaW5kTmV4dE1hdGNoIG11bHRpbGluZSB3aXRoIGNhcHR1cmluZyBtYXRjaGVzJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKCdvbmUgbGluZSBsaW5lXFxudHdvIGxpbmVcXG50aHJlZScpO1xuXG5cdFx0Y29uc3Qgc2VhcmNoUGFyYW1zID0gbmV3IFNlYXJjaFBhcmFtcygnKGwoaW4pZSlcXFxcbicsIHRydWUsIGZhbHNlLCBudWxsKTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IFRleHRNb2RlbFNlYXJjaC5maW5kTmV4dE1hdGNoKG1vZGVsLCBzZWFyY2hQYXJhbXMsIG5ldyBQb3NpdGlvbigxLCAxKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0RmluZE1hdGNoKGFjdHVhbCwgbmV3IFJhbmdlKDEsIDEwLCAyLCAxKSwgWydsaW5lXFxuJywgJ2xpbmUnLCAnaW4nXSk7XG5cblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ZpbmRQcmV2aW91c01hdGNoIHdpdGggY2FwdHVyaW5nIG1hdGNoZXMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoJ29uZSBsaW5lIGxpbmVcXG50d28gbGluZVxcbnRocmVlJyk7XG5cblx0XHRjb25zdCBzZWFyY2hQYXJhbXMgPSBuZXcgU2VhcmNoUGFyYW1zKCcobChpbillKScsIHRydWUsIGZhbHNlLCBudWxsKTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IFRleHRNb2RlbFNlYXJjaC5maW5kUHJldmlvdXNNYXRjaChtb2RlbCwgc2VhcmNoUGFyYW1zLCBuZXcgUG9zaXRpb24oMSwgMSksIHRydWUpO1xuXHRcdGFzc2VydEZpbmRNYXRjaChhY3R1YWwsIG5ldyBSYW5nZSgyLCA1LCAyLCA5KSwgWydsaW5lJywgJ2xpbmUnLCAnaW4nXSk7XG5cblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ZpbmRQcmV2aW91c01hdGNoIG11bHRpbGluZSB3aXRoIGNhcHR1cmluZyBtYXRjaGVzJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKCdvbmUgbGluZSBsaW5lXFxudHdvIGxpbmVcXG50aHJlZScpO1xuXG5cdFx0Y29uc3Qgc2VhcmNoUGFyYW1zID0gbmV3IFNlYXJjaFBhcmFtcygnKGwoaW4pZSlcXFxcbicsIHRydWUsIGZhbHNlLCBudWxsKTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IFRleHRNb2RlbFNlYXJjaC5maW5kUHJldmlvdXNNYXRjaChtb2RlbCwgc2VhcmNoUGFyYW1zLCBuZXcgUG9zaXRpb24oMSwgMSksIHRydWUpO1xuXHRcdGFzc2VydEZpbmRNYXRjaChhY3R1YWwsIG5ldyBSYW5nZSgyLCA1LCAzLCAxKSwgWydsaW5lXFxuJywgJ2xpbmUnLCAnaW4nXSk7XG5cblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1xcXFxuIG1hdGNoZXMgXFxcXHJcXFxcbicsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbCgnYVxcclxcbmJcXHJcXG5jXFxyXFxuZFxcclxcbmVcXHJcXG5mXFxyXFxuZ1xcclxcbmhcXHJcXG5pJyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0RU9MKCksICdcXHJcXG4nKTtcblxuXHRcdGxldCBzZWFyY2hQYXJhbXMgPSBuZXcgU2VhcmNoUGFyYW1zKCdoXFxcXG4nLCB0cnVlLCBmYWxzZSwgbnVsbCk7XG5cdFx0bGV0IGFjdHVhbCA9IFRleHRNb2RlbFNlYXJjaC5maW5kTmV4dE1hdGNoKG1vZGVsLCBzZWFyY2hQYXJhbXMsIG5ldyBQb3NpdGlvbigxLCAxKSwgdHJ1ZSk7XG5cdFx0YWN0dWFsID0gVGV4dE1vZGVsU2VhcmNoLmZpbmRNYXRjaGVzKG1vZGVsLCBzZWFyY2hQYXJhbXMsIG1vZGVsLmdldEZ1bGxNb2RlbFJhbmdlKCksIHRydWUsIDEwMDApWzBdO1xuXHRcdGFzc2VydEZpbmRNYXRjaChhY3R1YWwsIG5ldyBSYW5nZSg4LCAxLCA5LCAxKSwgWydoXFxuJ10pO1xuXG5cdFx0c2VhcmNoUGFyYW1zID0gbmV3IFNlYXJjaFBhcmFtcygnZ1xcXFxuaFxcXFxuJywgdHJ1ZSwgZmFsc2UsIG51bGwpO1xuXHRcdGFjdHVhbCA9IFRleHRNb2RlbFNlYXJjaC5maW5kTmV4dE1hdGNoKG1vZGVsLCBzZWFyY2hQYXJhbXMsIG5ldyBQb3NpdGlvbigxLCAxKSwgdHJ1ZSk7XG5cdFx0YWN0dWFsID0gVGV4dE1vZGVsU2VhcmNoLmZpbmRNYXRjaGVzKG1vZGVsLCBzZWFyY2hQYXJhbXMsIG1vZGVsLmdldEZ1bGxNb2RlbFJhbmdlKCksIHRydWUsIDEwMDApWzBdO1xuXHRcdGFzc2VydEZpbmRNYXRjaChhY3R1YWwsIG5ldyBSYW5nZSg3LCAxLCA5LCAxKSwgWydnXFxuaFxcbiddKTtcblxuXHRcdHNlYXJjaFBhcmFtcyA9IG5ldyBTZWFyY2hQYXJhbXMoJ1xcXFxuaScsIHRydWUsIGZhbHNlLCBudWxsKTtcblx0XHRhY3R1YWwgPSBUZXh0TW9kZWxTZWFyY2guZmluZE5leHRNYXRjaChtb2RlbCwgc2VhcmNoUGFyYW1zLCBuZXcgUG9zaXRpb24oMSwgMSksIHRydWUpO1xuXHRcdGFjdHVhbCA9IFRleHRNb2RlbFNlYXJjaC5maW5kTWF0Y2hlcyhtb2RlbCwgc2VhcmNoUGFyYW1zLCBtb2RlbC5nZXRGdWxsTW9kZWxSYW5nZSgpLCB0cnVlLCAxMDAwKVswXTtcblx0XHRhc3NlcnRGaW5kTWF0Y2goYWN0dWFsLCBuZXcgUmFuZ2UoOCwgMiwgOSwgMiksIFsnXFxuaSddKTtcblxuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnXFxcXHIgY2FuIG5ldmVyIGJlIGZvdW5kJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKCdhXFxyXFxuYlxcclxcbmNcXHJcXG5kXFxyXFxuZVxcclxcbmZcXHJcXG5nXFxyXFxuaFxcclxcbmknKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRFT0woKSwgJ1xcclxcbicpO1xuXG5cdFx0Y29uc3Qgc2VhcmNoUGFyYW1zID0gbmV3IFNlYXJjaFBhcmFtcygnXFxcXHJcXFxcbicsIHRydWUsIGZhbHNlLCBudWxsKTtcblx0XHRjb25zdCBhY3R1YWwgPSBUZXh0TW9kZWxTZWFyY2guZmluZE5leHRNYXRjaChtb2RlbCwgc2VhcmNoUGFyYW1zLCBuZXcgUG9zaXRpb24oMSwgMSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwsIG51bGwpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoVGV4dE1vZGVsU2VhcmNoLmZpbmRNYXRjaGVzKG1vZGVsLCBzZWFyY2hQYXJhbXMsIG1vZGVsLmdldEZ1bGxNb2RlbFJhbmdlKCksIHRydWUsIDEwMDApLCBbXSk7XG5cblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIGFzc2VydFBhcnNlU2VhcmNoUmVzdWx0KHNlYXJjaFN0cmluZzogc3RyaW5nLCBpc1JlZ2V4OiBib29sZWFuLCBtYXRjaENhc2U6IGJvb2xlYW4sIHdvcmRTZXBhcmF0b3JzOiBzdHJpbmcgfCBudWxsLCBleHBlY3RlZDogU2VhcmNoRGF0YSB8IG51bGwpOiB2b2lkIHtcblx0XHRjb25zdCBzZWFyY2hQYXJhbXMgPSBuZXcgU2VhcmNoUGFyYW1zKHNlYXJjaFN0cmluZywgaXNSZWdleCwgbWF0Y2hDYXNlLCB3b3JkU2VwYXJhdG9ycyk7XG5cdFx0Y29uc3QgYWN0dWFsID0gc2VhcmNoUGFyYW1zLnBhcnNlU2VhcmNoUmVxdWVzdCgpO1xuXG5cdFx0aWYgKGV4cGVjdGVkID09PSBudWxsKSB7XG5cdFx0XHRhc3NlcnQub2soYWN0dWFsID09PSBudWxsKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwhLnJlZ2V4LCBleHBlY3RlZC5yZWdleCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCEuc2ltcGxlU2VhcmNoLCBleHBlY3RlZC5zaW1wbGVTZWFyY2gpO1xuXHRcdFx0aWYgKHdvcmRTZXBhcmF0b3JzKSB7XG5cdFx0XHRcdGFzc2VydC5vayhhY3R1YWwhLndvcmRTZXBhcmF0b3JzICE9PSBudWxsKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGFzc2VydC5vayhhY3R1YWwhLndvcmRTZXBhcmF0b3JzID09PSBudWxsKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHR0ZXN0KCdwYXJzZVNlYXJjaFJlcXVlc3QgaW52YWxpZCcsICgpID0+IHtcblx0XHRhc3NlcnRQYXJzZVNlYXJjaFJlc3VsdCgnJywgdHJ1ZSwgdHJ1ZSwgVVNVQUxfV09SRF9TRVBBUkFUT1JTLCBudWxsKTtcblx0XHRhc3NlcnRQYXJzZVNlYXJjaFJlc3VsdCgnKCcsIHRydWUsIGZhbHNlLCBudWxsLCBudWxsKTtcblx0fSk7XG5cblx0dGVzdCgncGFyc2VTZWFyY2hSZXF1ZXN0IG5vbiByZWdleCcsICgpID0+IHtcblx0XHRhc3NlcnRQYXJzZVNlYXJjaFJlc3VsdCgnZm9vJywgZmFsc2UsIGZhbHNlLCBudWxsLCBuZXcgU2VhcmNoRGF0YSgvZm9vL2dpdSwgbnVsbCwgbnVsbCkpO1xuXHRcdGFzc2VydFBhcnNlU2VhcmNoUmVzdWx0KCdmb28nLCBmYWxzZSwgZmFsc2UsIFVTVUFMX1dPUkRfU0VQQVJBVE9SUywgbmV3IFNlYXJjaERhdGEoL2Zvby9naXUsIHVzdWFsV29yZFNlcGFyYXRvcnMsIG51bGwpKTtcblx0XHRhc3NlcnRQYXJzZVNlYXJjaFJlc3VsdCgnZm9vJywgZmFsc2UsIHRydWUsIG51bGwsIG5ldyBTZWFyY2hEYXRhKC9mb28vZ3UsIG51bGwsICdmb28nKSk7XG5cdFx0YXNzZXJ0UGFyc2VTZWFyY2hSZXN1bHQoJ2ZvbycsIGZhbHNlLCB0cnVlLCBVU1VBTF9XT1JEX1NFUEFSQVRPUlMsIG5ldyBTZWFyY2hEYXRhKC9mb28vZ3UsIHVzdWFsV29yZFNlcGFyYXRvcnMsICdmb28nKSk7XG5cdFx0YXNzZXJ0UGFyc2VTZWFyY2hSZXN1bHQoJ2Zvb1xcXFxuJywgZmFsc2UsIGZhbHNlLCBudWxsLCBuZXcgU2VhcmNoRGF0YSgvZm9vXFxcXG4vZ2l1LCBudWxsLCBudWxsKSk7XG5cdFx0YXNzZXJ0UGFyc2VTZWFyY2hSZXN1bHQoJ2Zvb1xcXFxcXFxcbicsIGZhbHNlLCBmYWxzZSwgbnVsbCwgbmV3IFNlYXJjaERhdGEoL2Zvb1xcXFxcXFxcbi9naXUsIG51bGwsIG51bGwpKTtcblx0XHRhc3NlcnRQYXJzZVNlYXJjaFJlc3VsdCgnZm9vXFxcXHInLCBmYWxzZSwgZmFsc2UsIG51bGwsIG5ldyBTZWFyY2hEYXRhKC9mb29cXFxcci9naXUsIG51bGwsIG51bGwpKTtcblx0XHRhc3NlcnRQYXJzZVNlYXJjaFJlc3VsdCgnZm9vXFxcXFxcXFxyJywgZmFsc2UsIGZhbHNlLCBudWxsLCBuZXcgU2VhcmNoRGF0YSgvZm9vXFxcXFxcXFxyL2dpdSwgbnVsbCwgbnVsbCkpO1xuXHR9KTtcblxuXHR0ZXN0KCdwYXJzZVNlYXJjaFJlcXVlc3QgcmVnZXgnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0UGFyc2VTZWFyY2hSZXN1bHQoJ2ZvbycsIHRydWUsIGZhbHNlLCBudWxsLCBuZXcgU2VhcmNoRGF0YSgvZm9vL2dpdSwgbnVsbCwgbnVsbCkpO1xuXHRcdGFzc2VydFBhcnNlU2VhcmNoUmVzdWx0KCdmb28nLCB0cnVlLCBmYWxzZSwgVVNVQUxfV09SRF9TRVBBUkFUT1JTLCBuZXcgU2VhcmNoRGF0YSgvZm9vL2dpdSwgdXN1YWxXb3JkU2VwYXJhdG9ycywgbnVsbCkpO1xuXHRcdGFzc2VydFBhcnNlU2VhcmNoUmVzdWx0KCdmb28nLCB0cnVlLCB0cnVlLCBudWxsLCBuZXcgU2VhcmNoRGF0YSgvZm9vL2d1LCBudWxsLCBudWxsKSk7XG5cdFx0YXNzZXJ0UGFyc2VTZWFyY2hSZXN1bHQoJ2ZvbycsIHRydWUsIHRydWUsIFVTVUFMX1dPUkRfU0VQQVJBVE9SUywgbmV3IFNlYXJjaERhdGEoL2Zvby9ndSwgdXN1YWxXb3JkU2VwYXJhdG9ycywgbnVsbCkpO1xuXHRcdGFzc2VydFBhcnNlU2VhcmNoUmVzdWx0KCdmb29cXFxcbicsIHRydWUsIGZhbHNlLCBudWxsLCBuZXcgU2VhcmNoRGF0YSgvZm9vXFxuL2dpbXUsIG51bGwsIG51bGwpKTtcblx0XHRhc3NlcnRQYXJzZVNlYXJjaFJlc3VsdCgnZm9vXFxcXFxcXFxuJywgdHJ1ZSwgZmFsc2UsIG51bGwsIG5ldyBTZWFyY2hEYXRhKC9mb29cXFxcbi9naXUsIG51bGwsIG51bGwpKTtcblx0XHRhc3NlcnRQYXJzZVNlYXJjaFJlc3VsdCgnZm9vXFxcXHInLCB0cnVlLCBmYWxzZSwgbnVsbCwgbmV3IFNlYXJjaERhdGEoL2Zvb1xcci9naW11LCBudWxsLCBudWxsKSk7XG5cdFx0YXNzZXJ0UGFyc2VTZWFyY2hSZXN1bHQoJ2Zvb1xcXFxcXFxccicsIHRydWUsIGZhbHNlLCBudWxsLCBuZXcgU2VhcmNoRGF0YSgvZm9vXFxcXHIvZ2l1LCBudWxsLCBudWxsKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICM1MzQxNS4gXFxXIHNob3VsZCBtYXRjaCBsaW5lIGJyZWFrLicsICgpID0+IHtcblx0XHRhc3NlcnRGaW5kTWF0Y2hlcyhcblx0XHRcdFtcblx0XHRcdFx0J3RleHQnLFxuXHRcdFx0XHQnMTgwNzAyLScsXG5cdFx0XHRcdCcxODA3MDMtMTgwNzA0J1xuXHRcdFx0XS5qb2luKCdcXG4nKSxcblx0XHRcdCdcXFxcZHs2fS1cXFxcVycsIHRydWUsIGZhbHNlLCBudWxsLFxuXHRcdFx0W1xuXHRcdFx0XHRbMiwgMSwgMywgMV1cblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0YXNzZXJ0RmluZE1hdGNoZXMoXG5cdFx0XHRbXG5cdFx0XHRcdCdKdXN0IHNvbWUgdGV4dCcsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnSnVzdCdcblx0XHRcdF0uam9pbignXFxuJyksXG5cdFx0XHQnXFxcXFcnLCB0cnVlLCBmYWxzZSwgbnVsbCxcblx0XHRcdFtcblx0XHRcdFx0WzEsIDUsIDEsIDZdLFxuXHRcdFx0XHRbMSwgMTAsIDEsIDExXSxcblx0XHRcdFx0WzEsIDE1LCAyLCAxXSxcblx0XHRcdFx0WzIsIDEsIDMsIDFdXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdC8vIExpbmUgYnJlYWsgZG9lc24ndCBhZmZlY3QgdGhlIHJlc3VsdCBhcyB3ZSBhbHdheXMgdXNlIFxcbiBhcyBsaW5lIGJyZWFrIHdoZW4gZG9pbmcgc2VhcmNoXG5cdFx0YXNzZXJ0RmluZE1hdGNoZXMoXG5cdFx0XHRbXG5cdFx0XHRcdCdKdXN0IHNvbWUgdGV4dCcsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnSnVzdCdcblx0XHRcdF0uam9pbignXFxyXFxuJyksXG5cdFx0XHQnXFxcXFcnLCB0cnVlLCBmYWxzZSwgbnVsbCxcblx0XHRcdFtcblx0XHRcdFx0WzEsIDUsIDEsIDZdLFxuXHRcdFx0XHRbMSwgMTAsIDEsIDExXSxcblx0XHRcdFx0WzEsIDE1LCAyLCAxXSxcblx0XHRcdFx0WzIsIDEsIDMsIDFdXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGFzc2VydEZpbmRNYXRjaGVzKFxuXHRcdFx0W1xuXHRcdFx0XHQnSnVzdCBzb21lIHRleHQnLFxuXHRcdFx0XHQnXFx0SnVzdCcsXG5cdFx0XHRcdCdKdXN0J1xuXHRcdFx0XS5qb2luKCdcXG4nKSxcblx0XHRcdCdcXFxcVycsIHRydWUsIGZhbHNlLCBudWxsLFxuXHRcdFx0W1xuXHRcdFx0XHRbMSwgNSwgMSwgNl0sXG5cdFx0XHRcdFsxLCAxMCwgMSwgMTFdLFxuXHRcdFx0XHRbMSwgMTUsIDIsIDFdLFxuXHRcdFx0XHRbMiwgMSwgMiwgMl0sXG5cdFx0XHRcdFsyLCA2LCAzLCAxXSxcblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0Ly8gbGluZSBicmVhayBpcyBzZWVuIGFzIG9uZSBub24td29yZCBjaGFyYWN0ZXJcblx0XHRhc3NlcnRGaW5kTWF0Y2hlcyhcblx0XHRcdFtcblx0XHRcdFx0J0p1c3QgIHNvbWUgdGV4dCcsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnSnVzdCdcblx0XHRcdF0uam9pbignXFxuJyksXG5cdFx0XHQnXFxcXFd7Mn0nLCB0cnVlLCBmYWxzZSwgbnVsbCxcblx0XHRcdFtcblx0XHRcdFx0WzEsIDUsIDEsIDddLFxuXHRcdFx0XHRbMSwgMTYsIDMsIDFdXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdC8vIGV2ZW4gaWYgaXQncyBcXHJcXG5cblx0XHRhc3NlcnRGaW5kTWF0Y2hlcyhcblx0XHRcdFtcblx0XHRcdFx0J0p1c3QgIHNvbWUgdGV4dCcsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnSnVzdCdcblx0XHRcdF0uam9pbignXFxyXFxuJyksXG5cdFx0XHQnXFxcXFd7Mn0nLCB0cnVlLCBmYWxzZSwgbnVsbCxcblx0XHRcdFtcblx0XHRcdFx0WzEsIDUsIDEsIDddLFxuXHRcdFx0XHRbMSwgMTYsIDMsIDFdXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnU2ltcGxlIGZpbmQgdXNpbmcgdW5pY29kZSBlc2NhcGUgc2VxdWVuY2VzJywgKCkgPT4ge1xuXHRcdGFzc2VydEZpbmRNYXRjaGVzKFxuXHRcdFx0cmVndWxhclRleHQuam9pbignXFxuJyksXG5cdFx0XHQnXFxcXHV7MDA2Nn1cXFxcdTAwNmZcXFxcdTAwNkYnLCB0cnVlLCBmYWxzZSwgbnVsbCxcblx0XHRcdFtcblx0XHRcdFx0WzEsIDE0LCAxLCAxN10sXG5cdFx0XHRcdFsxLCA0NCwgMSwgNDddLFxuXHRcdFx0XHRbMiwgMjIsIDIsIDI1XSxcblx0XHRcdFx0WzIsIDQ4LCAyLCA1MV0sXG5cdFx0XHRcdFs0LCA1OSwgNCwgNjJdXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnaXNNdWx0aWxpbmVSZWdleFNvdXJjZScsICgpID0+IHtcblx0XHRhc3NlcnQoIWlzTXVsdGlsaW5lUmVnZXhTb3VyY2UoJ2ZvbycpKTtcblx0XHRhc3NlcnQoIWlzTXVsdGlsaW5lUmVnZXhTb3VyY2UoJycpKTtcblx0XHRhc3NlcnQoIWlzTXVsdGlsaW5lUmVnZXhTb3VyY2UoJ2Zvb1xcXFxzYmFyJykpO1xuXHRcdGFzc2VydCghaXNNdWx0aWxpbmVSZWdleFNvdXJjZSgnXFxcXFxcXFxub3RuZXdsaW5lJykpO1xuXG5cdFx0YXNzZXJ0KGlzTXVsdGlsaW5lUmVnZXhTb3VyY2UoJ2Zvb1xcXFxuYmFyJykpO1xuXHRcdGFzc2VydChpc011bHRpbGluZVJlZ2V4U291cmNlKCdmb29cXFxcbmJhclxcXFxzJykpO1xuXHRcdGFzc2VydChpc011bHRpbGluZVJlZ2V4U291cmNlKCdmb29cXFxcclxcXFxuJykpO1xuXHRcdGFzc2VydChpc011bHRpbGluZVJlZ2V4U291cmNlKCdcXFxcbicpKTtcblx0XHRhc3NlcnQoaXNNdWx0aWxpbmVSZWdleFNvdXJjZSgnZm9vXFxcXFcnKSk7XG5cdFx0YXNzZXJ0KGlzTXVsdGlsaW5lUmVnZXhTb3VyY2UoJ2Zvb1xcbicpKTtcblx0XHRhc3NlcnQoaXNNdWx0aWxpbmVSZWdleFNvdXJjZSgnZm9vXFxyXFxuJykpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc011bHRpbGluZVJlZ2V4U291cmNlIGNvcnJlY3RseSBpZGVudGlmaWVzIG11bHRpbGluZSBwYXR0ZXJucycsICgpID0+IHtcblx0XHRjb25zdCBzaW5nbGVMaW5lUGF0dGVybnMgPSBbXG5cdFx0XHQnTUFSSzpcXFxccyooPzxsYWJlbD4uKikkJyxcblx0XHRcdCdeLy8gSGVhZGVyJCcsXG5cdFx0XHQnXFxcXHMqWy09XStcXFxccyonLFxuXHRcdF07XG5cblx0XHRjb25zdCBtdWx0aUxpbmVQYXR0ZXJucyA9IFtcblx0XHRcdCdeXFwvXFwvID0rXFxcXG5eXFwvXFwvICg/PGxhYmVsPlteXFxcXG5dKz8pXFxcXG5eXFwvXFwvID0rJCcsXG5cdFx0XHQnaGVhZGVyXFxcXHJcXFxcbmZvb3RlcicsXG5cdFx0XHQnc3RhcnRcXFxccnxcXFxcbmVuZCcsXG5cdFx0XHQndG9wXFxubWlkZGxlXFxyXFxuYm90dG9tJ1xuXHRcdF07XG5cblx0XHRmb3IgKGNvbnN0IHBhdHRlcm4gb2Ygc2luZ2xlTGluZVBhdHRlcm5zKSB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNNdWx0aWxpbmVSZWdleFNvdXJjZShwYXR0ZXJuKSwgZmFsc2UsIGBQYXR0ZXJuIHNob3VsZCBub3QgYmUgbXVsdGlsaW5lOiAke3BhdHRlcm59YCk7XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBwYXR0ZXJuIG9mIG11bHRpTGluZVBhdHRlcm5zKSB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNNdWx0aWxpbmVSZWdleFNvdXJjZShwYXR0ZXJuKSwgdHJ1ZSwgYFBhdHRlcm4gc2hvdWxkIGJlIG11bHRpbGluZTogJHtwYXR0ZXJufWApO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzc0NzE1LiBcXFxcZCogZmluZHMgZW1wdHkgc3RyaW5nIGFuZCBzdG9wcyBzZWFyY2hpbmcuJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKCcxMC4yNDMuMzAuMTAnKTtcblxuXHRcdGNvbnN0IHNlYXJjaFBhcmFtcyA9IG5ldyBTZWFyY2hQYXJhbXMoJ1xcXFxkKicsIHRydWUsIGZhbHNlLCBudWxsKTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IFRleHRNb2RlbFNlYXJjaC5maW5kTWF0Y2hlcyhtb2RlbCwgc2VhcmNoUGFyYW1zLCBtb2RlbC5nZXRGdWxsTW9kZWxSYW5nZSgpLCB0cnVlLCAxMDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBbXG5cdFx0XHRuZXcgRmluZE1hdGNoKG5ldyBSYW5nZSgxLCAxLCAxLCAzKSwgWycxMCddKSxcblx0XHRcdG5ldyBGaW5kTWF0Y2gobmV3IFJhbmdlKDEsIDMsIDEsIDMpLCBbJyddKSxcblx0XHRcdG5ldyBGaW5kTWF0Y2gobmV3IFJhbmdlKDEsIDQsIDEsIDcpLCBbJzI0MyddKSxcblx0XHRcdG5ldyBGaW5kTWF0Y2gobmV3IFJhbmdlKDEsIDcsIDEsIDcpLCBbJyddKSxcblx0XHRcdG5ldyBGaW5kTWF0Y2gobmV3IFJhbmdlKDEsIDgsIDEsIDEwKSwgWyczMCddKSxcblx0XHRcdG5ldyBGaW5kTWF0Y2gobmV3IFJhbmdlKDEsIDEwLCAxLCAxMCksIFsnJ10pLFxuXHRcdFx0bmV3IEZpbmRNYXRjaChuZXcgUmFuZ2UoMSwgMTEsIDEsIDEzKSwgWycxMCddKVxuXHRcdF0pO1xuXG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTAwMTM0LiBaZXJvLWxlbmd0aCBtYXRjaGVzIHNob3VsZCBwcm9wZXJseSBzdGVwIG92ZXIgc3Vycm9nYXRlIHBhaXJzJywgKCkgPT4ge1xuXHRcdC8vIDFbTGFwdG9wXTEgLSB0aGVyZSBzaG91ZCBiZSBubyBtYXRjaGVzIGluc2lkZSBvZiBbTGFwdG9wXSBlbW9qaVxuXHRcdGFzc2VydEZpbmRNYXRjaGVzKCcxXFx1RDgzRFxcdURDQkIxJywgJygpJywgdHJ1ZSwgZmFsc2UsIG51bGwsXG5cdFx0XHRbXG5cdFx0XHRcdFsxLCAxLCAxLCAxXSxcblx0XHRcdFx0WzEsIDIsIDEsIDJdLFxuXHRcdFx0XHRbMSwgNCwgMSwgNF0sXG5cdFx0XHRcdFsxLCA1LCAxLCA1XSxcblxuXHRcdFx0XVxuXHRcdCk7XG5cdFx0Ly8gMVtIYWNrZXIgQ2F0XTEgPSAxW0NhdCBGYWNlXVtaV0pdW0xhcHRvcF0xIC0gdGhlcmUgc2hvdWQgYmUgbWF0Y2hlcyBiZXR3ZWVuIGVtb2ppIGFuZCBaV0pcblx0XHQvLyB0aGVyZSBzaG91ZCBiZSBubyBtYXRjaGVzIGluc2lkZSBvZiBbQ2F0IEZhY2VdIGFuZCBbTGFwdG9wXSBlbW9qaVxuXHRcdGFzc2VydEZpbmRNYXRjaGVzKCcxXFx1RDgzRFxcdURDMzFcXHUyMDBEXFx1RDgzRFxcdURDQkIxJywgJygpJywgdHJ1ZSwgZmFsc2UsIG51bGwsXG5cdFx0XHRbXG5cdFx0XHRcdFsxLCAxLCAxLCAxXSxcblx0XHRcdFx0WzEsIDIsIDEsIDJdLFxuXHRcdFx0XHRbMSwgNCwgMSwgNF0sXG5cdFx0XHRcdFsxLCA1LCAxLCA1XSxcblx0XHRcdFx0WzEsIDcsIDEsIDddLFxuXHRcdFx0XHRbMSwgOCwgMSwgOF1cblx0XHRcdF1cblx0XHQpO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsYUFBYTtBQUN0QixTQUFTLCtCQUErQjtBQUN4QyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLG1CQUFtQixXQUFXLGtCQUFrQjtBQUV6RCxTQUFTLGNBQWMsaUJBQWlCLDhCQUE4QjtBQUN0RSxTQUFTLHVCQUF1QjtBQUdoQyxNQUFNLG1CQUFtQixNQUFNO0FBRTlCLDBDQUF3QztBQUV4QyxRQUFNLHNCQUFzQix3QkFBd0IsdUJBQXVCLENBQUMsQ0FBQztBQUU3RSxXQUFTLGdCQUFnQixRQUEwQixlQUFzQixrQkFBbUMsTUFBWTtBQUN2SCxXQUFPLGdCQUFnQixRQUFRLElBQUksVUFB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
