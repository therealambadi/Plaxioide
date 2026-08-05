import assert from "assert";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { UTF8_BOM_CHARACTER } from "../../../../base/common/strings.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { Position } from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
import { PLAINTEXT_LANGUAGE_ID } from "../../../common/languages/modesRegistry.js";
import { EndOfLinePreference } from "../../../common/model.js";
import { TextModel, createTextBuffer } from "../../../common/model/textModel.js";
import { createModelServices, createTextModel } from "../testTextModel.js";
function testGuessIndentation(defaultInsertSpaces, defaultTabSize, expectedInsertSpaces, expectedTabSize, text, msg) {
  const m = createTextModel(
    text.join("\n"),
    void 0,
    {
      tabSize: defaultTabSize,
      insertSpaces: defaultInsertSpaces,
      detectIndentation: true
    }
  );
  const r = m.getOptions();
  m.dispose();
  assert.strictEqual(r.insertSpaces, expectedInsertSpaces, msg);
  assert.strictEqual(r.tabSize, expectedTabSize, msg);
}
function assertGuess(expectedInsertSpaces, expectedTabSize, text, msg) {
  if (typeof expectedInsertSpaces === "undefined") {
    if (typeof expectedTabSize === "undefined") {
      testGuessIndentation(true, 13370, true, 13370, text, msg);
      testGuessIndentation(false, 13371, false, 13371, text, msg);
    } else if (typeof expectedTabSize === "number") {
      testGuessIndentation(true, 13370, true, expectedTabSize, text, msg);
      testGuessIndentation(false, 13371, false, expectedTabSize, text, msg);
    } else {
      testGuessIndentation(true, 13370, true, expectedTabSize[0], text, msg);
      testGuessIndentation(false, 13371, false, 13371, text, msg);
    }
  } else {
    if (typeof expectedTabSize === "undefined") {
      testGuessIndentation(true, 13370, expectedInsertSpaces, 13370, text, msg);
      testGuessIndentation(false, 13371, expectedInsertSpaces, 13371, text, msg);
    } else if (typeof expectedTabSize === "number") {
      testGuessIndentation(true, 13370, expectedInsertSpaces, expectedTabSize, text, msg);
      testGuessIndentation(false, 13371, expectedInsertSpaces, expectedTabSize, text, msg);
    } else {
      if (expectedInsertSpaces === true) {
        testGuessIndentation(true, 13370, expectedInsertSpaces, expectedTabSize[0], text, msg);
        testGuessIndentation(false, 13371, expectedInsertSpaces, expectedTabSize[0], text, msg);
      } else {
        testGuessIndentation(true, 13370, expectedInsertSpaces, 13370, text, msg);
        testGuessIndentation(false, 13371, expectedInsertSpaces, 13371, text, msg);
      }
    }
  }
}
suite("TextModelData.fromString", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  function testTextModelDataFromString(text, expected) {
    const { textBuffer, disposable } = createTextBuffer(text, TextModel.DEFAULT_CREATION_OPTIONS.defaultEOL);
    const actual = {
      EOL: textBuffer.getEOL(),
      lines: textBuffer.getLinesContent(),
      containsRTL: textBuffer.mightContainRTL(),
      isBasicASCII: !textBuffer.mightContainNonBasicASCII()
    };
    assert.deepStrictEqual(actual, expected);
    disposable.dispose();
  }
  test("one line text", () => {
    testTextModelDataFromString(
      "Hello world!",
      {
        EOL: "\n",
        lines: [
          "Hello world!"
        ],
        containsRTL: false,
        isBasicASCII: true
      }
    );
  });
  test("multiline text", () => {
    testTextModelDataFromString(
      "Hello,\r\ndear friend\nHow\rare\r\nyou?",
      {
        EOL: "\r\n",
        lines: [
          "Hello,",
          "dear friend",
          "How",
          "are",
          "you?"
        ],
        containsRTL: false,
        isBasicASCII: true
      }
    );
  });
  test("Non Basic ASCII 1", () => {
    testTextModelDataFromString(
      "Hello,\nZ\xFCrich",
      {
        EOL: "\n",
        lines: [
          "Hello,",
          "Z\xFCrich"
        ],
        containsRTL: false,
        isBasicASCII: false
      }
    );
  });
  test("containsRTL 1", () => {
    testTextModelDataFromString(
      "Hello,\n\u05D6\u05D5\u05D4\u05D9 \u05E2\u05D5\u05D1\u05D3\u05D4 \u05DE\u05D1\u05D5\u05E1\u05E1\u05EA \u05E9\u05D3\u05E2\u05EA\u05D5",
      {
        EOL: "\n",
        lines: [
          "Hello,",
          "\u05D6\u05D5\u05D4\u05D9 \u05E2\u05D5\u05D1\u05D3\u05D4 \u05DE\u05D1\u05D5\u05E1\u05E1\u05EA \u05E9\u05D3\u05E2\u05EA\u05D5"
        ],
        containsRTL: true,
        isBasicASCII: false
      }
    );
  });
  test("containsRTL 2", () => {
    testTextModelDataFromString(
      "Hello,\n\u0647\u0646\u0627\u0643 \u062D\u0642\u064A\u0642\u0629 \u0645\u062B\u0628\u062A\u0629 \u0645\u0646\u0630 \u0632\u0645\u0646 \u0637\u0648\u064A\u0644",
      {
        EOL: "\n",
        lines: [
          "Hello,",
          "\u0647\u0646\u0627\u0643 \u062D\u0642\u064A\u0642\u0629 \u0645\u062B\u0628\u062A\u0629 \u0645\u0646\u0630 \u0632\u0645\u0646 \u0637\u0648\u064A\u0644"
        ],
        containsRTL: true,
        isBasicASCII: false
      }
    );
  });
});
suite("Editor Model - TextModel", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("TextModel does not use events internally", () => {
    const disposables = new DisposableStore();
    const instantiationService = createModelServices(disposables);
    const textModel = disposables.add(instantiationService.createInstance(TextModel, "", PLAINTEXT_LANGUAGE_ID, TextModel.DEFAULT_CREATION_OPTIONS, null));
    assert.strictEqual(textModel._hasListeners(), false);
    disposables.dispose();
  });
  test("getValueLengthInRange", () => {
    let m = createTextModel("My First Line\r\nMy Second Line\r\nMy Third Line");
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 1, 1, 1)), "".length);
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 1, 1, 2)), "M".length);
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 2, 1, 3)), "y".length);
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 1, 1, 14)), "My First Line".length);
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 1, 2, 1)), "My First Line\r\n".length);
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 2, 2, 1)), "y First Line\r\n".length);
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 2, 2, 2)), "y First Line\r\nM".length);
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 2, 2, 1e3)), "y First Line\r\nMy Second Line".length);
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 2, 3, 1)), "y First Line\r\nMy Second Line\r\n".length);
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 2, 3, 1e3)), "y First Line\r\nMy Second Line\r\nMy Third Line".length);
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 1, 1e3, 1e3)), "My First Line\r\nMy Second Line\r\nMy Third Line".length);
    m.dispose();
    m = createTextModel("My First Line\nMy Second Line\nMy Third Line");
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 1, 1, 1)), "".length);
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 1, 1, 2)), "M".length);
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 2, 1, 3)), "y".length);
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 1, 1, 14)), "My First Line".length);
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 1, 2, 1)), "My First Line\n".length);
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 2, 2, 1)), "y First Line\n".length);
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 2, 2, 2)), "y First Line\nM".length);
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 2, 2, 1e3)), "y First Line\nMy Second Line".length);
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 2, 3, 1)), "y First Line\nMy Second Line\n".length);
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 2, 3, 1e3)), "y First Line\nMy Second Line\nMy Third Line".length);
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 1, 1e3, 1e3)), "My First Line\nMy Second Line\nMy Third Line".length);
    m.dispose();
  });
  test("getValueLengthInRange different EOL", () => {
    let m = createTextModel("My First Line\r\nMy Second Line\r\nMy Third Line");
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 1, 2, 1), EndOfLinePreference.TextDefined), "My First Line\r\n".length);
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 1, 2, 1), EndOfLinePreference.CRLF), "My First Line\r\n".length);
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 1, 2, 1), EndOfLinePreference.LF), "My First Line\n".length);
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 1, 1e3, 1e3), EndOfLinePreference.TextDefined), "My First Line\r\nMy Second Line\r\nMy Third Line".length);
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 1, 1e3, 1e3), EndOfLinePreference.CRLF), "My First Line\r\nMy Second Line\r\nMy Third Line".length);
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 1, 1e3, 1e3), EndOfLinePreference.LF), "My First Line\nMy Second Line\nMy Third Line".length);
    m.dispose();
    m = createTextModel("My First Line\nMy Second Line\nMy Third Line");
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 1, 2, 1), EndOfLinePreference.TextDefined), "My First Line\n".length);
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 1, 2, 1), EndOfLinePreference.LF), "My First Line\n".length);
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 1, 2, 1), EndOfLinePreference.CRLF), "My First Line\r\n".length);
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 1, 1e3, 1e3), EndOfLinePreference.TextDefined), "My First Line\nMy Second Line\nMy Third Line".length);
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 1, 1e3, 1e3), EndOfLinePreference.LF), "My First Line\nMy Second Line\nMy Third Line".length);
    assert.strictEqual(m.getValueLengthInRange(new Range(1, 1, 1e3, 1e3), EndOfLinePreference.CRLF), "My First Line\r\nMy Second Line\r\nMy Third Line".length);
    m.dispose();
  });
  test("guess indentation 1", () => {
    assertGuess(void 0, void 0, [
      "x",
      "x",
      "x",
      "x",
      "x",
      "x",
      "x"
    ], "no clues");
    assertGuess(false, void 0, [
      "	x",
      "x",
      "x",
      "x",
      "x",
      "x",
      "x"
    ], "no spaces, 1xTAB");
    assertGuess(true, 2, [
      "  x",
      "x",
      "x",
      "x",
      "x",
      "x",
      "x"
    ], "1x2");
    assertGuess(false, void 0, [
      "	x",
      "	x",
      "	x",
      "	x",
      "	x",
      "	x",
      "	x"
    ], "7xTAB");
    assertGuess(void 0, [2], [
      "	x",
      "  x",
      "	x",
      "  x",
      "	x",
      "  x",
      "	x",
      "  x"
    ], "4x2, 4xTAB");
    assertGuess(false, void 0, [
      "	x",
      " x",
      "	x",
      " x",
      "	x",
      " x",
      "	x",
      " x"
    ], "4x1, 4xTAB");
    assertGuess(false, void 0, [
      "	x",
      "	x",
      "  x",
      "	x",
      "  x",
      "	x",
      "  x",
      "	x",
      "  x"
    ], "4x2, 5xTAB");
    assertGuess(false, void 0, [
      "	x",
      "	x",
      "x",
      "	x",
      "x",
      "	x",
      "x",
      "	x",
      "  x"
    ], "1x2, 5xTAB");
    assertGuess(false, void 0, [
      "	x",
      "	x",
      "x",
      "	x",
      "x",
      "	x",
      "x",
      "	x",
      "    x"
    ], "1x4, 5xTAB");
    assertGuess(false, void 0, [
      "	x",
      "	x",
      "x",
      "	x",
      "x",
      "	x",
      "  x",
      "	x",
      "    x"
    ], "1x2, 1x4, 5xTAB");
    assertGuess(void 0, void 0, [
      "x",
      " x",
      " x",
      " x",
      " x",
      " x",
      " x",
      " x"
    ], "7x1 - 1 space is never guessed as an indentation");
    assertGuess(true, void 0, [
      "x",
      "          x",
      " x",
      " x",
      " x",
      " x",
      " x",
      " x"
    ], "1x10, 6x1");
    assertGuess(void 0, void 0, [
      "",
      "  ",
      "    ",
      "      ",
      "        ",
      "          ",
      "            ",
      "              "
    ], "whitespace lines don't count");
    assertGuess(true, 3, [
      "x",
      "   x",
      "   x",
      "    x",
      "x",
      "   x",
      "   x",
      "    x",
      "x",
      "   x",
      "   x",
      "    x"
    ], "6x3, 3x4");
    assertGuess(true, 5, [
      "x",
      "     x",
      "     x",
      "    x",
      "x",
      "     x",
      "     x",
      "    x",
      "x",
      "     x",
      "     x",
      "    x"
    ], "6x5, 3x4");
    assertGuess(true, 7, [
      "x",
      "       x",
      "       x",
      "     x",
      "x",
      "       x",
      "       x",
      "    x",
      "x",
      "       x",
      "       x",
      "    x"
    ], "6x7, 1x5, 2x4");
    assertGuess(true, 2, [
      "x",
      "  x",
      "  x",
      "  x",
      "  x",
      "x",
      "  x",
      "  x",
      "  x",
      "  x"
    ], "8x2");
    assertGuess(true, 2, [
      "x",
      "  x",
      "  x",
      "x",
      "  x",
      "  x",
      "x",
      "  x",
      "  x",
      "x",
      "  x",
      "  x"
    ], "8x2");
    assertGuess(true, 2, [
      "x",
      "  x",
      "    x",
      "x",
      "  x",
      "    x",
      "x",
      "  x",
      "    x",
      "x",
      "  x",
      "    x"
    ], "4x2, 4x4");
    assertGuess(true, 2, [
      "x",
      "  x",
      "  x",
      "    x",
      "x",
      "  x",
      "  x",
      "    x",
      "x",
      "  x",
      "  x",
      "    x"
    ], "6x2, 3x4");
    assertGuess(true, 2, [
      "x",
      "  x",
      "  x",
      "    x",
      "    x",
      "x",
      "  x",
      "  x",
      "    x",
      "    x"
    ], "4x2, 4x4");
    assertGuess(true, 2, [
      "x",
      "  x",
      "    x",
      "    x",
      "x",
      "  x",
      "    x",
      "    x"
    ], "2x2, 4x4");
    assertGuess(true, 4, [
      "x",
      "    x",
      "    x",
      "x",
      "    x",
      "    x",
      "x",
      "    x",
      "    x",
      "x",
      "    x",
      "    x"
    ], "8x4");
    assertGuess(true, 2, [
      "x",
      "  x",
      "    x",
      "    x",
      "      x",
      "x",
      "  x",
      "    x",
      "    x",
      "      x"
    ], "2x2, 4x4, 2x6");
    assertGuess(true, 2, [
      "x",
      "  x",
      "    x",
      "    x",
      "      x",
      "      x",
      "        x"
    ], "1x2, 2x4, 2x6, 1x8");
    assertGuess(true, 4, [
      "x",
      "    x",
      "    x",
      "    x",
      "     x",
      "        x",
      "x",
      "    x",
      "    x",
      "    x",
      "     x",
      "        x"
    ], "6x4, 2x5, 2x8");
    assertGuess(true, 4, [
      "x",
      "    x",
      "    x",
      "    x",
      "     x",
      "        x",
      "        x"
    ], "3x4, 1x5, 2x8");
    assertGuess(true, 4, [
      "x",
      "x",
      "    x",
      "    x",
      "     x",
      "        x",
      "        x",
      "x",
      "x",
      "    x",
      "    x",
      "     x",
      "        x",
      "        x"
    ], "6x4, 2x5, 4x8");
    assertGuess(true, 3, [
      "x",
      " x",
      " x",
      " x",
      " x",
      " x",
      "x",
      "   x",
      "    x",
      "    x"
    ], "5x1, 2x0, 1x3, 2x4");
    assertGuess(false, void 0, [
      "	 x",
      " 	 x",
      "	x"
    ], "mixed whitespace 1");
    assertGuess(false, void 0, [
      "	x",
      "	    x"
    ], "mixed whitespace 2");
  });
  test("issue #44991: Wrong indentation size auto-detection", () => {
    assertGuess(true, 4, [
      "a = 10             # 0 space indent",
      "b = 5              # 0 space indent",
      "if a > 10:         # 0 space indent",
      "    a += 1         # 4 space indent      delta 4 spaces",
      "    if b > 5:      # 4 space indent",
      "        b += 1     # 8 space indent      delta 4 spaces",
      "        b += 1     # 8 space indent",
      "        b += 1     # 8 space indent",
      "# comment line 1   # 0 space indent      delta 8 spaces",
      "# comment line 2   # 0 space indent",
      "# comment line 3   # 0 space indent",
      "        b += 1     # 8 space indent      delta 8 spaces",
      "        b += 1     # 8 space indent",
      "        b += 1     # 8 space indent"
    ]);
  });
  test("issue #55818: Broken indentation detection", () => {
    assertGuess(true, 2, [
      "",
      "/* REQUIRE */",
      "",
      "const foo = require ( 'foo' ),",
      "      bar = require ( 'bar' );",
      "",
      "/* MY FN */",
      "",
      "function myFn () {",
      "",
      "  const asd = 1,",
      "        dsa = 2;",
      "",
      "  return bar ( foo ( asd ) );",
      "",
      "}",
      "",
      "/* EXPORT */",
      "",
      "module.exports = myFn;",
      ""
    ]);
  });
  test("issue #70832: Broken indentation detection", () => {
    assertGuess(false, void 0, [
      "x",
      "x",
      "x",
      "x",
      "	x",
      "		x",
      "    x",
      "		x",
      "	x",
      "		x",
      "	x",
      "	x",
      "	x",
      "	x",
      "x"
    ]);
  });
  test("issue #62143: Broken indentation detection", () => {
    assertGuess(true, 2, [
      "x",
      "x",
      "  x",
      "  x"
    ]);
    assertGuess(true, 2, [
      "x",
      "  - item2",
      "  - item3"
    ]);
    testGuessIndentation(true, 2, true, 2, [
      "x x",
      "  x",
      "  x"
    ]);
    testGuessIndentation(true, 2, true, 2, [
      "x x",
      "  x",
      "  x",
      "    x"
    ]);
    testGuessIndentation(true, 2, true, 2, [
      "<!--test1.md -->",
      "- item1",
      "  - item2",
      "    - item3"
    ]);
  });
  test("issue #84217: Broken indentation detection", () => {
    assertGuess(true, 4, [
      "def main():",
      "    print('hello')"
    ]);
    assertGuess(true, 4, [
      "def main():",
      "    with open('foo') as fp:",
      "        print(fp.read())"
    ]);
  });
  test("validatePosition", () => {
    const m = createTextModel("line one\nline two");
    assert.deepStrictEqual(m.validatePosition(new Position(0, 0)), new Position(1, 1));
    assert.deepStrictEqual(m.validatePosition(new Position(0, 1)), new Position(1, 1));
    assert.deepStrictEqual(m.validatePosition(new Position(1, 1)), new Position(1, 1));
    assert.deepStrictEqual(m.validatePosition(new Position(1, 2)), new Position(1, 2));
    assert.deepStrictEqual(m.validatePosition(new Position(1, 30)), new Position(1, 9));
    assert.deepStrictEqual(m.validatePosition(new Position(2, 0)), new Position(2, 1));
    assert.deepStrictEqual(m.validatePosition(new Position(2, 1)), new Position(2, 1));
    assert.deepStrictEqual(m.validatePosition(new Position(2, 2)), new Position(2, 2));
    assert.deepStrictEqual(m.validatePosition(new Position(2, 30)), new Position(2, 9));
    assert.deepStrictEqual(m.validatePosition(new Position(3, 0)), new Position(2, 9));
    assert.deepStrictEqual(m.validatePosition(new Position(3, 1)), new Position(2, 9));
    assert.deepStrictEqual(m.validatePosition(new Position(3, 30)), new Position(2, 9));
    assert.deepStrictEqual(m.validatePosition(new Position(30, 30)), new Position(2, 9));
    assert.deepStrictEqual(m.validatePosition(new Position(-123.123, -0.5)), new Position(1, 1));
    assert.deepStrictEqual(m.validatePosition(new Position(Number.MIN_VALUE, Number.MIN_VALUE)), new Position(1, 1));
    assert.deepStrictEqual(m.validatePosition(new Position(Number.MAX_VALUE, Number.MAX_VALUE)), new Position(2, 9));
    assert.deepStrictEqual(m.validatePosition(new Position(123.23, 47.5)), new Position(2, 9));
    m.dispose();
  });
  test("validatePosition around high-low surrogate pairs 1", () => {
    const m = createTextModel("a\u{1F4DA}b");
    assert.deepStrictEqual(m.validatePosition(new Position(0, 0)), new Position(1, 1));
    assert.deepStrictEqual(m.validatePosition(new Position(0, 1)), new Position(1, 1));
    assert.deepStrictEqual(m.validatePosition(new Position(0, 7)), new Position(1, 1));
    assert.deepStrictEqual(m.validatePosition(new Position(1, 1)), new Position(1, 1));
    assert.deepStrictEqual(m.validatePosition(new Position(1, 2)), new Position(1, 2));
    assert.deepStrictEqual(m.validatePosition(new Position(1, 3)), new Position(1, 2));
    assert.deepStrictEqual(m.validatePosition(new Position(1, 4)), new Position(1, 4));
    assert.deepStrictEqual(m.validatePosition(new Position(1, 5)), new Position(1, 5));
    assert.deepStrictEqual(m.validatePosition(new Position(1, 30)), new Position(1, 5));
    assert.deepStrictEqual(m.validatePosition(new Position(2, 0)), new Position(1, 5));
    assert.deepStrictEqual(m.validatePosition(new Position(2, 1)), new Position(1, 5));
    assert.deepStrictEqual(m.validatePosition(new Position(2, 2)), new Position(1, 5));
    assert.deepStrictEqual(m.validatePosition(new Position(2, 30)), new Position(1, 5));
    assert.deepStrictEqual(m.validatePosition(new Position(-123.123, -0.5)), new Position(1, 1));
    assert.deepStrictEqual(m.validatePosition(new Position(Number.MIN_VALUE, Number.MIN_VALUE)), new Position(1, 1));
    assert.deepStrictEqual(m.validatePosition(new Position(Number.MAX_VALUE, Number.MAX_VALUE)), new Position(1, 5));
    assert.deepStrictEqual(m.validatePosition(new Position(123.23, 47.5)), new Position(1, 5));
    m.dispose();
  });
  test("validatePosition around high-low surrogate pairs 2", () => {
    const m = createTextModel("a\u{1F4DA}\u{1F4DA}b");
    assert.deepStrictEqual(m.validatePosition(new Position(1, 1)), new Position(1, 1));
    assert.deepStrictEqual(m.validatePosition(new Position(1, 2)), new Position(1, 2));
    assert.deepStrictEqual(m.validatePosition(new Position(1, 3)), new Position(1, 2));
    assert.deepStrictEqual(m.validatePosition(new Position(1, 4)), new Position(1, 4));
    assert.deepStrictEqual(m.validatePosition(new Position(1, 5)), new Position(1, 4));
    assert.deepStrictEqual(m.validatePosition(new Position(1, 6)), new Position(1, 6));
    assert.deepStrictEqual(m.validatePosition(new Position(1, 7)), new Position(1, 7));
    m.dispose();
  });
  test("validatePosition handle NaN.", () => {
    const m = createTextModel("line one\nline two");
    assert.deepStrictEqual(m.validatePosition(new Position(NaN, 1)), new Position(1, 1));
    assert.deepStrictEqual(m.validatePosition(new Position(1, NaN)), new Position(1, 1));
    assert.deepStrictEqual(m.validatePosition(new Position(NaN, NaN)), new Position(1, 1));
    assert.deepStrictEqual(m.validatePosition(new Position(2, NaN)), new Position(2, 1));
    assert.deepStrictEqual(m.validatePosition(new Position(NaN, 3)), new Position(1, 3));
    m.dispose();
  });
  test("issue #71480: validatePosition handle floats", () => {
    const m = createTextModel("line one\nline two");
    assert.deepStrictEqual(m.validatePosition(new Position(0.2, 1)), new Position(1, 1), "a");
    assert.deepStrictEqual(m.validatePosition(new Position(1.2, 1)), new Position(1, 1), "b");
    assert.deepStrictEqual(m.validatePosition(new Position(1.5, 2)), new Position(1, 2), "c");
    assert.deepStrictEqual(m.validatePosition(new Position(1.8, 3)), new Position(1, 3), "d");
    assert.deepStrictEqual(m.validatePosition(new Position(1, 0.3)), new Position(1, 1), "e");
    assert.deepStrictEqual(m.validatePosition(new Position(2, 0.8)), new Position(2, 1), "f");
    assert.deepStrictEqual(m.validatePosition(new Position(1, 1.2)), new Position(1, 1), "g");
    assert.deepStrictEqual(m.validatePosition(new Position(2, 1.5)), new Position(2, 1), "h");
    m.dispose();
  });
  test("issue #71480: validateRange handle floats", () => {
    const m = createTextModel("line one\nline two");
    assert.deepStrictEqual(m.validateRange(new Range(0.2, 1.5, 0.8, 2.5)), new Range(1, 1, 1, 1));
    assert.deepStrictEqual(m.validateRange(new Range(1.2, 1.7, 1.8, 2.2)), new Range(1, 1, 1, 2));
    m.dispose();
  });
  test("validateRange around high-low surrogate pairs 1", () => {
    const m = createTextModel("a\u{1F4DA}b");
    assert.deepStrictEqual(m.validateRange(new Range(0, 0, 0, 1)), new Range(1, 1, 1, 1));
    assert.deepStrictEqual(m.validateRange(new Range(0, 0, 0, 7)), new Range(1, 1, 1, 1));
    assert.deepStrictEqual(m.validateRange(new Range(1, 1, 1, 1)), new Range(1, 1, 1, 1));
    assert.deepStrictEqual(m.validateRange(new Range(1, 1, 1, 2)), new Range(1, 1, 1, 2));
    assert.deepStrictEqual(m.validateRange(new Range(1, 1, 1, 3)), new Range(1, 1, 1, 4));
    assert.deepStrictEqual(m.validateRange(new Range(1, 1, 1, 4)), new Range(1, 1, 1, 4));
    assert.deepStrictEqual(m.validateRange(new Range(1, 1, 1, 5)), new Range(1, 1, 1, 5));
    assert.deepStrictEqual(m.validateRange(new Range(1, 2, 1, 2)), new Range(1, 2, 1, 2));
    assert.deepStrictEqual(m.validateRange(new Range(1, 2, 1, 3)), new Range(1, 2, 1, 4));
    assert.deepStrictEqual(m.validateRange(new Range(1, 2, 1, 4)), new Range(1, 2, 1, 4));
    assert.deepStrictEqual(m.validateRange(new Range(1, 2, 1, 5)), new Range(1, 2, 1, 5));
    assert.deepStrictEqual(m.validateRange(new Range(1, 3, 1, 3)), new Range(1, 2, 1, 2));
    assert.deepStrictEqual(m.validateRange(new Range(1, 3, 1, 4)), new Range(1, 2, 1, 4));
    assert.deepStrictEqual(m.validateRange(new Range(1, 3, 1, 5)), new Range(1, 2, 1, 5));
    assert.deepStrictEqual(m.validateRange(new Range(1, 4, 1, 4)), new Range(1, 4, 1, 4));
    assert.deepStrictEqual(m.validateRange(new Range(1, 4, 1, 5)), new Range(1, 4, 1, 5));
    assert.deepStrictEqual(m.validateRange(new Range(1, 5, 1, 5)), new Range(1, 5, 1, 5));
    m.dispose();
  });
  test("validateRange around high-low surrogate pairs 2", () => {
    const m = createTextModel("a\u{1F4DA}\u{1F4DA}b");
    assert.deepStrictEqual(m.validateRange(new Range(0, 0, 0, 1)), new Range(1, 1, 1, 1));
    assert.deepStrictEqual(m.validateRange(new Range(0, 0, 0, 7)), new Range(1, 1, 1, 1));
    assert.deepStrictEqual(m.validateRange(new Range(1, 1, 1, 1)), new Range(1, 1, 1, 1));
    assert.deepStrictEqual(m.validateRange(new Range(1, 1, 1, 2)), new Range(1, 1, 1, 2));
    assert.deepStrictEqual(m.validateRange(new Range(1, 1, 1, 3)), new Range(1, 1, 1, 4));
    assert.deepStrictEqual(m.validateRange(new Range(1, 1, 1, 4)), new Range(1, 1, 1, 4));
    assert.deepStrictEqual(m.validateRange(new Range(1, 1, 1, 5)), new Range(1, 1, 1, 6));
    assert.deepStrictEqual(m.validateRange(new Range(1, 1, 1, 6)), new Range(1, 1, 1, 6));
    assert.deepStrictEqual(m.validateRange(new Range(1, 1, 1, 7)), new Range(1, 1, 1, 7));
    assert.deepStrictEqual(m.validateRange(new Range(1, 2, 1, 2)), new Range(1, 2, 1, 2));
    assert.deepStrictEqual(m.validateRange(new Range(1, 2, 1, 3)), new Range(1, 2, 1, 4));
    assert.deepStrictEqual(m.validateRange(new Range(1, 2, 1, 4)), new Range(1, 2, 1, 4));
    assert.deepStrictEqual(m.validateRange(new Range(1, 2, 1, 5)), new Range(1, 2, 1, 6));
    assert.deepStrictEqual(m.validateRange(new Range(1, 2, 1, 6)), new Range(1, 2, 1, 6));
    assert.deepStrictEqual(m.validateRange(new Range(1, 2, 1, 7)), new Range(1, 2, 1, 7));
    assert.deepStrictEqual(m.validateRange(new Range(1, 3, 1, 3)), new Range(1, 2, 1, 2));
    assert.deepStrictEqual(m.validateRange(new Range(1, 3, 1, 4)), new Range(1, 2, 1, 4));
    assert.deepStrictEqual(m.validateRange(new Range(1, 3, 1, 5)), new Range(1, 2, 1, 6));
    assert.deepStrictEqual(m.validateRange(new Range(1, 3, 1, 6)), new Range(1, 2, 1, 6));
    assert.deepStrictEqual(m.validateRange(new Range(1, 3, 1, 7)), new Range(1, 2, 1, 7));
    assert.deepStrictEqual(m.validateRange(new Range(1, 4, 1, 4)), new Range(1, 4, 1, 4));
    assert.deepStrictEqual(m.validateRange(new Range(1, 4, 1, 5)), new Range(1, 4, 1, 6));
    assert.deepStrictEqual(m.validateRange(new Range(1, 4, 1, 6)), new Range(1, 4, 1, 6));
    assert.deepStrictEqual(m.validateRange(new Range(1, 4, 1, 7)), new Range(1, 4, 1, 7));
    assert.deepStrictEqual(m.validateRange(new Range(1, 5, 1, 5)), new Range(1, 4, 1, 4));
    assert.deepStrictEqual(m.validateRange(new Range(1, 5, 1, 6)), new Range(1, 4, 1, 6));
    assert.deepStrictEqual(m.validateRange(new Range(1, 5, 1, 7)), new Range(1, 4, 1, 7));
    assert.deepStrictEqual(m.validateRange(new Range(1, 6, 1, 6)), new Range(1, 6, 1, 6));
    assert.deepStrictEqual(m.validateRange(new Range(1, 6, 1, 7)), new Range(1, 6, 1, 7));
    assert.deepStrictEqual(m.validateRange(new Range(1, 7, 1, 7)), new Range(1, 7, 1, 7));
    m.dispose();
  });
  test("modifyPosition", () => {
    const m = createTextModel("line one\nline two");
    assert.deepStrictEqual(m.modifyPosition(new Position(1, 1), 0), new Position(1, 1));
    assert.deepStrictEqual(m.modifyPosition(new Position(0, 0), 0), new Position(1, 1));
    assert.deepStrictEqual(m.modifyPosition(new Position(30, 1), 0), new Position(2, 9));
    assert.deepStrictEqual(m.modifyPosition(new Position(1, 1), 17), new Position(2, 9));
    assert.deepStrictEqual(m.modifyPosition(new Position(1, 1), 1), new Position(1, 2));
    assert.deepStrictEqual(m.modifyPosition(new Position(1, 1), 3), new Position(1, 4));
    assert.deepStrictEqual(m.modifyPosition(new Position(1, 2), 10), new Position(2, 3));
    assert.deepStrictEqual(m.modifyPosition(new Position(1, 5), 13), new Position(2, 9));
    assert.deepStrictEqual(m.modifyPosition(new Position(1, 2), 16), new Position(2, 9));
    assert.deepStrictEqual(m.modifyPosition(new Position(2, 9), -17), new Position(1, 1));
    assert.deepStrictEqual(m.modifyPosition(new Position(1, 2), -1), new Position(1, 1));
    assert.deepStrictEqual(m.modifyPosition(new Position(1, 4), -3), new Position(1, 1));
    assert.deepStrictEqual(m.modifyPosition(new Position(2, 3), -10), new Position(1, 2));
    assert.deepStrictEqual(m.modifyPosition(new Position(2, 9), -13), new Position(1, 5));
    assert.deepStrictEqual(m.modifyPosition(new Position(2, 9), -16), new Position(1, 2));
    assert.deepStrictEqual(m.modifyPosition(new Position(1, 2), 17), new Position(2, 9));
    assert.deepStrictEqual(m.modifyPosition(new Position(1, 2), 100), new Position(2, 9));
    assert.deepStrictEqual(m.modifyPosition(new Position(1, 2), -2), new Position(1, 1));
    assert.deepStrictEqual(m.modifyPosition(new Position(1, 2), -100), new Position(1, 1));
    assert.deepStrictEqual(m.modifyPosition(new Position(2, 2), -100), new Position(1, 1));
    assert.deepStrictEqual(m.modifyPosition(new Position(2, 9), -18), new Position(1, 1));
    m.dispose();
  });
  test("normalizeIndentation 1", () => {
    const model = createTextModel(
      "",
      void 0,
      {
        insertSpaces: false
      }
    );
    assert.strictEqual(model.normalizeIndentation("	"), "	");
    assert.strictEqual(model.normalizeIndentation("    "), "	");
    assert.strictEqual(model.normalizeIndentation("   "), "   ");
    assert.strictEqual(model.normalizeIndentation("  "), "  ");
    assert.strictEqual(model.normalizeIndentation(" "), " ");
    assert.strictEqual(model.normalizeIndentation(""), "");
    assert.strictEqual(model.normalizeIndentation(" 	    "), "		");
    assert.strictEqual(model.normalizeIndentation(" 	   "), "	   ");
    assert.strictEqual(model.normalizeIndentation(" 	  "), "	  ");
    assert.strictEqual(model.normalizeIndentation(" 	 "), "	 ");
    assert.strictEqual(model.normalizeIndentation(" 	"), "	");
    assert.strictEqual(model.normalizeIndentation("	a"), "	a");
    assert.strictEqual(model.normalizeIndentation("    a"), "	a");
    assert.strictEqual(model.normalizeIndentation("   a"), "   a");
    assert.strictEqual(model.normalizeIndentation("  a"), "  a");
    assert.strictEqual(model.normalizeIndentation(" a"), " a");
    assert.strictEqual(model.normalizeIndentation("a"), "a");
    assert.strictEqual(model.normalizeIndentation(" 	    a"), "		a");
    assert.strictEqual(model.normalizeIndentation(" 	   a"), "	   a");
    assert.strictEqual(model.normalizeIndentation(" 	  a"), "	  a");
    assert.strictEqual(model.normalizeIndentation(" 	 a"), "	 a");
    assert.strictEqual(model.normalizeIndentation(" 	a"), "	a");
    model.dispose();
  });
  test("normalizeIndentation 2", () => {
    const model = createTextModel("");
    assert.strictEqual(model.normalizeIndentation("	a"), "    a");
    assert.strictEqual(model.normalizeIndentation("    a"), "    a");
    assert.strictEqual(model.normalizeIndentation("   a"), "   a");
    assert.strictEqual(model.normalizeIndentation("  a"), "  a");
    assert.strictEqual(model.normalizeIndentation(" a"), " a");
    assert.strictEqual(model.normalizeIndentation("a"), "a");
    assert.strictEqual(model.normalizeIndentation(" 	    a"), "        a");
    assert.strictEqual(model.normalizeIndentation(" 	   a"), "       a");
    assert.strictEqual(model.normalizeIndentation(" 	  a"), "      a");
    assert.strictEqual(model.normalizeIndentation(" 	 a"), "     a");
    assert.strictEqual(model.normalizeIndentation(" 	a"), "    a");
    model.dispose();
  });
  test("getLineFirstNonWhitespaceColumn", () => {
    const model = createTextModel([
      "asd",
      " asd",
      "	asd",
      "  asd",
      "		asd",
      " ",
      "  ",
      "	",
      "		",
      "  	asd",
      "",
      ""
    ].join("\n"));
    assert.strictEqual(model.getLineFirstNonWhitespaceColumn(1), 1, "1");
    assert.strictEqual(model.getLineFirstNonWhitespaceColumn(2), 2, "2");
    assert.strictEqual(model.getLineFirstNonWhitespaceColumn(3), 2, "3");
    assert.strictEqual(model.getLineFirstNonWhitespaceColumn(4), 3, "4");
    assert.strictEqual(model.getLineFirstNonWhitespaceColumn(5), 3, "5");
    assert.strictEqual(model.getLineFirstNonWhitespaceColumn(6), 0, "6");
    assert.strictEqual(model.getLineFirstNonWhitespaceColumn(7), 0, "7");
    assert.strictEqual(model.getLineFirstNonWhitespaceColumn(8), 0, "8");
    assert.strictEqual(model.getLineFirstNonWhitespaceColumn(9), 0, "9");
    assert.strictEqual(model.getLineFirstNonWhitespaceColumn(10), 4, "10");
    assert.strictEqual(model.getLineFirstNonWhitespaceColumn(11), 0, "11");
    assert.strictEqual(model.getLineFirstNonWhitespaceColumn(12), 0, "12");
    model.dispose();
  });
  test("getLineLastNonWhitespaceColumn", () => {
    const model = createTextModel([
      "asd",
      "asd ",
      "asd	",
      "asd  ",
      "asd		",
      " ",
      "  ",
      "	",
      "		",
      "asd  	",
      "",
      ""
    ].join("\n"));
    assert.strictEqual(model.getLineLastNonWhitespaceColumn(1), 4, "1");
    assert.strictEqual(model.getLineLastNonWhitespaceColumn(2), 4, "2");
    assert.strictEqual(model.getLineLastNonWhitespaceColumn(3), 4, "3");
    assert.strictEqual(model.getLineLastNonWhitespaceColumn(4), 4, "4");
    assert.strictEqual(model.getLineLastNonWhitespaceColumn(5), 4, "5");
    assert.strictEqual(model.getLineLastNonWhitespaceColumn(6), 0, "6");
    assert.strictEqual(model.getLineLastNonWhitespaceColumn(7), 0, "7");
    assert.strictEqual(model.getLineLastNonWhitespaceColumn(8), 0, "8");
    assert.strictEqual(model.getLineLastNonWhitespaceColumn(9), 0, "9");
    assert.strictEqual(model.getLineLastNonWhitespaceColumn(10), 4, "10");
    assert.strictEqual(model.getLineLastNonWhitespaceColumn(11), 0, "11");
    assert.strictEqual(model.getLineLastNonWhitespaceColumn(12), 0, "12");
    model.dispose();
  });
  test("#50471. getValueInRange with invalid range", () => {
    const m = createTextModel("My First Line\r\nMy Second Line\r\nMy Third Line");
    assert.strictEqual(m.getValueInRange(new Range(1, NaN, 1, 3)), "My");
    assert.strictEqual(m.getValueInRange(new Range(NaN, NaN, NaN, NaN)), "");
    m.dispose();
  });
  test('issue #168836: updating tabSize should also update indentSize when indentSize is set to "tabSize"', () => {
    const m = createTextModel("some text", null, {
      tabSize: 2,
      indentSize: "tabSize"
    });
    assert.strictEqual(m.getOptions().tabSize, 2);
    assert.strictEqual(m.getOptions().indentSize, 2);
    assert.strictEqual(m.getOptions().originalIndentSize, "tabSize");
    m.updateOptions({
      tabSize: 4
    });
    assert.strictEqual(m.getOptions().tabSize, 4);
    assert.strictEqual(m.getOptions().indentSize, 4);
    assert.strictEqual(m.getOptions().originalIndentSize, "tabSize");
    m.dispose();
  });
});
suite("TextModel.mightContainRTL", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("nope", () => {
    const model = createTextModel("hello world!");
    assert.strictEqual(model.mightContainRTL(), false);
    model.dispose();
  });
  test("yes", () => {
    const model = createTextModel("Hello,\n\u05D6\u05D5\u05D4\u05D9 \u05E2\u05D5\u05D1\u05D3\u05D4 \u05DE\u05D1\u05D5\u05E1\u05E1\u05EA \u05E9\u05D3\u05E2\u05EA\u05D5");
    assert.strictEqual(model.mightContainRTL(), true);
    model.dispose();
  });
  test("setValue resets 1", () => {
    const model = createTextModel("hello world!");
    assert.strictEqual(model.mightContainRTL(), false);
    model.setValue("Hello,\n\u05D6\u05D5\u05D4\u05D9 \u05E2\u05D5\u05D1\u05D3\u05D4 \u05DE\u05D1\u05D5\u05E1\u05E1\u05EA \u05E9\u05D3\u05E2\u05EA\u05D5");
    assert.strictEqual(model.mightContainRTL(), true);
    model.dispose();
  });
  test("setValue resets 2", () => {
    const model = createTextModel("Hello,\n\u0647\u0646\u0627\u0643 \u062D\u0642\u064A\u0642\u0629 \u0645\u062B\u0628\u062A\u0629 \u0645\u0646\u0630 \u0632\u0645\u0646 \u0637\u0648\u064A\u0644");
    assert.strictEqual(model.mightContainRTL(), true);
    model.setValue("hello world!");
    assert.strictEqual(model.mightContainRTL(), false);
    model.dispose();
  });
});
suite("TextModel.createSnapshot", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("empty file", () => {
    const model = createTextModel("");
    const snapshot = model.createSnapshot();
    assert.strictEqual(snapshot.read(), null);
    model.dispose();
  });
  test("file with BOM", () => {
    const model = createTextModel(UTF8_BOM_CHARACTER + "Hello");
    assert.strictEqual(model.getLineContent(1), "Hello");
    const snapshot = model.createSnapshot(true);
    assert.strictEqual(snapshot.read(), UTF8_BOM_CHARACTER + "Hello");
    assert.strictEqual(snapshot.read(), null);
    model.dispose();
  });
  test("regular file", () => {
    const model = createTextModel("My First Line\n		My Second Line\n    Third Line\n\n1");
    const snapshot = model.createSnapshot();
    assert.strictEqual(snapshot.read(), "My First Line\n		My Second Line\n    Third Line\n\n1");
    assert.strictEqual(snapshot.read(), null);
    model.dispose();
  });
  test("large file", () => {
    const lines = [];
    for (let i = 0; i < 1e3; i++) {
      lines[i] = "Just some text that is a bit long such that it can consume some memory";
    }
    const text = lines.join("\n");
    const model = createTextModel(text);
    const snapshot = model.createSnapshot();
    let actual = "";
    const tmp1 = snapshot.read();
    assert.ok(tmp1);
    actual += tmp1;
    const tmp2 = snapshot.read();
    if (tmp2 === null) {
    } else {
      actual += tmp2;
      assert.strictEqual(snapshot.read(), null);
    }
    assert.strictEqual(actual, text);
    model.dispose();
  });
  test("issue #119632: invalid range", () => {
    const model = createTextModel("hello world!");
    const actual = model._validateRangeRelaxedNoAllocations(new Range(void 0, 0, void 0, 1));
    assert.deepStrictEqual(actual, new Range(1, 1, 1, 1));
    model.dispose();
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vbW9kZWwvdGV4dE1vZGVsLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVVRGOF9CT01fQ0hBUkFDVEVSIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBQTEFJTlRFWFRfTEFOR1VBR0VfSUQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL21vZGVzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgRW5kT2ZMaW5lUHJlZmVyZW5jZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBUZXh0TW9kZWwsIGNyZWF0ZVRleHRCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwvdGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IGNyZWF0ZU1vZGVsU2VydmljZXMsIGNyZWF0ZVRleHRNb2RlbCB9IGZyb20gJy4uL3Rlc3RUZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5cbmZ1bmN0aW9uIHRlc3RHdWVzc0luZGVudGF0aW9uKGRlZmF1bHRJbnNlcnRTcGFjZXM6IGJvb2xlYW4sIGRlZmF1bHRUYWJTaXplOiBudW1iZXIsIGV4cGVjdGVkSW5zZXJ0U3BhY2VzOiBib29sZWFuLCBleHBlY3RlZFRhYlNpemU6IG51bWJlciwgdGV4dDogc3RyaW5nW10sIG1zZz86IHN0cmluZyk6IHZvaWQge1xuXHRjb25zdCBtID0gY3JlYXRlVGV4dE1vZGVsKFxuXHRcdHRleHQuam9pbignXFxuJyksXG5cdFx0dW5kZWZpbmVkLFxuXHRcdHtcblx0XHRcdHRhYlNpemU6IGRlZmF1bHRUYWJTaXplLFxuXHRcdFx0aW5zZXJ0U3BhY2VzOiBkZWZhdWx0SW5zZXJ0U3BhY2VzLFxuXHRcdFx0ZGV0ZWN0SW5kZW50YXRpb246IHRydWVcblx0XHR9XG5cdCk7XG5cdGNvbnN0IHIgPSBtLmdldE9wdGlvbnMoKTtcblx0bS5kaXNwb3NlKCk7XG5cblx0YXNzZXJ0LnN0cmljdEVxdWFsKHIuaW5zZXJ0U3BhY2VzLCBleHBlY3RlZEluc2VydFNwYWNlcywgbXNnKTtcblx0YXNzZXJ0LnN0cmljdEVxdWFsKHIudGFiU2l6ZSwgZXhwZWN0ZWRUYWJTaXplLCBtc2cpO1xufVxuXG5mdW5jdGlvbiBhc3NlcnRHdWVzcyhleHBlY3RlZEluc2VydFNwYWNlczogYm9vbGVhbiB8IHVuZGVmaW5lZCwgZXhwZWN0ZWRUYWJTaXplOiBudW1iZXIgfCB1bmRlZmluZWQgfCBbbnVtYmVyXSwgdGV4dDogc3RyaW5nW10sIG1zZz86IHN0cmluZyk6IHZvaWQge1xuXHRpZiAodHlwZW9mIGV4cGVjdGVkSW5zZXJ0U3BhY2VzID09PSAndW5kZWZpbmVkJykge1xuXHRcdC8vIGNhbm5vdCBndWVzcyBpbnNlcnRTcGFjZXNcblx0XHRpZiAodHlwZW9mIGV4cGVjdGVkVGFiU2l6ZSA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdC8vIGNhbm5vdCBndWVzcyB0YWJTaXplXG5cdFx0XHR0ZXN0R3Vlc3NJbmRlbnRhdGlvbih0cnVlLCAxMzM3MCwgdHJ1ZSwgMTMzNzAsIHRleHQsIG1zZyk7XG5cdFx0XHR0ZXN0R3Vlc3NJbmRlbnRhdGlvbihmYWxzZSwgMTMzNzEsIGZhbHNlLCAxMzM3MSwgdGV4dCwgbXNnKTtcblx0XHR9IGVsc2UgaWYgKHR5cGVvZiBleHBlY3RlZFRhYlNpemUgPT09ICdudW1iZXInKSB7XG5cdFx0XHQvLyBjYW4gZ3Vlc3MgdGFiU2l6ZVxuXHRcdFx0dGVzdEd1ZXNzSW5kZW50YXRpb24odHJ1ZSwgMTMzNzAsIHRydWUsIGV4cGVjdGVkVGFiU2l6ZSwgdGV4dCwgbXNnKTtcblx0XHRcdHRlc3RHdWVzc0luZGVudGF0aW9uKGZhbHNlLCAxMzM3MSwgZmFsc2UsIGV4cGVjdGVkVGFiU2l6ZSwgdGV4dCwgbXNnKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gY2FuIG9ubHkgZ3Vlc3MgdGFiU2l6ZSB3aGVuIGluc2VydFNwYWNlcyBpcyB0cnVlXG5cdFx0XHR0ZXN0R3Vlc3NJbmRlbnRhdGlvbih0cnVlLCAxMzM3MCwgdHJ1ZSwgZXhwZWN0ZWRUYWJTaXplWzBdLCB0ZXh0LCBtc2cpO1xuXHRcdFx0dGVzdEd1ZXNzSW5kZW50YXRpb24oZmFsc2UsIDEzMzcxLCBmYWxzZSwgMTMzNzEsIHRleHQsIG1zZyk7XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdC8vIGNhbiBndWVzcyBpbnNlcnRTcGFjZXNcblx0XHRpZiAodHlwZW9mIGV4cGVjdGVkVGFiU2l6ZSA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdC8vIGNhbm5vdCBndWVzcyB0YWJTaXplXG5cdFx0XHR0ZXN0R3Vlc3NJbmRlbnRhdGlvbih0cnVlLCAxMzM3MCwgZXhwZWN0ZWRJbnNlcnRTcGFjZXMsIDEzMzcwLCB0ZXh0LCBtc2cpO1xuXHRcdFx0dGVzdEd1ZXNzSW5kZW50YXRpb24oZmFsc2UsIDEzMzcxLCBleHBlY3RlZEluc2VydFNwYWNlcywgMTMzNzEsIHRleHQsIG1zZyk7XG5cdFx0fSBlbHNlIGlmICh0eXBlb2YgZXhwZWN0ZWRUYWJTaXplID09PSAnbnVtYmVyJykge1xuXHRcdFx0Ly8gY2FuIGd1ZXNzIHRhYlNpemVcblx0XHRcdHRlc3RHdWVzc0luZGVudGF0aW9uKHRydWUsIDEzMzcwLCBleHBlY3RlZEluc2VydFNwYWNlcywgZXhwZWN0ZWRUYWJTaXplLCB0ZXh0LCBtc2cpO1xuXHRcdFx0dGVzdEd1ZXNzSW5kZW50YXRpb24oZmFsc2UsIDEzMzcxLCBleHBlY3RlZEluc2VydFNwYWNlcywgZXhwZWN0ZWRUYWJTaXplLCB0ZXh0LCBtc2cpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBjYW4gb25seSBndWVzcyB0YWJTaXplIHdoZW4gaW5zZXJ0U3BhY2VzIGlzIHRydWVcblx0XHRcdGlmIChleHBlY3RlZEluc2VydFNwYWNlcyA9PT0gdHJ1ZSkge1xuXHRcdFx0XHR0ZXN0R3Vlc3NJbmRlbnRhdGlvbih0cnVlLCAxMzM3MCwgZXhwZWN0ZWRJbnNlcnRTcGFjZXMsIGV4cGVjdGVkVGFiU2l6ZVswXSwgdGV4dCwgbXNnKTtcblx0XHRcdFx0dGVzdEd1ZXNzSW5kZW50YXRpb24oZmFsc2UsIDEzMzcxLCBleHBlY3RlZEluc2VydFNwYWNlcywgZXhwZWN0ZWRUYWJTaXplWzBdLCB0ZXh0LCBtc2cpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGVzdEd1ZXNzSW5kZW50YXRpb24odHJ1ZSwgMTMzNzAsIGV4cGVjdGVkSW5zZXJ0U3BhY2VzLCAxMzM3MCwgdGV4dCwgbXNnKTtcblx0XHRcdFx0dGVzdEd1ZXNzSW5kZW50YXRpb24oZmFsc2UsIDEzMzcxLCBleHBlY3RlZEluc2VydFNwYWNlcywgMTMzNzEsIHRleHQsIG1zZyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbnN1aXRlKCdUZXh0TW9kZWxEYXRhLmZyb21TdHJpbmcnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0aW50ZXJmYWNlIElUZXh0QnVmZmVyRGF0YSB7XG5cdFx0RU9MOiBzdHJpbmc7XG5cdFx0bGluZXM6IHN0cmluZ1tdO1xuXHRcdGNvbnRhaW5zUlRMOiBib29sZWFuO1xuXHRcdGlzQmFzaWNBU0NJSTogYm9vbGVhbjtcblx0fVxuXG5cdGZ1bmN0aW9uIHRlc3RUZXh0TW9kZWxEYXRhRnJvbVN0cmluZyh0ZXh0OiBzdHJpbmcsIGV4cGVjdGVkOiBJVGV4dEJ1ZmZlckRhdGEpOiB2b2lkIHtcblx0XHRjb25zdCB7IHRleHRCdWZmZXIsIGRpc3Bvc2FibGUgfSA9IGNyZWF0ZVRleHRCdWZmZXIodGV4dCwgVGV4dE1vZGVsLkRFRkFVTFRfQ1JFQVRJT05fT1BUSU9OUy5kZWZhdWx0RU9MKTtcblx0XHRjb25zdCBhY3R1YWw6IElUZXh0QnVmZmVyRGF0YSA9IHtcblx0XHRcdEVPTDogdGV4dEJ1ZmZlci5nZXRFT0woKSxcblx0XHRcdGxpbmVzOiB0ZXh0QnVmZmVyLmdldExpbmVzQ29udGVudCgpLFxuXHRcdFx0Y29udGFpbnNSVEw6IHRleHRCdWZmZXIubWlnaHRDb250YWluUlRMKCksXG5cdFx0XHRpc0Jhc2ljQVNDSUk6ICF0ZXh0QnVmZmVyLm1pZ2h0Q29udGFpbk5vbkJhc2ljQVNDSUkoKVxuXHRcdH07XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkKTtcblx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHRlc3QoJ29uZSBsaW5lIHRleHQnLCAoKSA9PiB7XG5cdFx0dGVzdFRleHRNb2RlbERhdGFGcm9tU3RyaW5nKCdIZWxsbyB3b3JsZCEnLFxuXHRcdFx0e1xuXHRcdFx0XHRFT0w6ICdcXG4nLFxuXHRcdFx0XHRsaW5lczogW1xuXHRcdFx0XHRcdCdIZWxsbyB3b3JsZCEnXG5cdFx0XHRcdF0sXG5cdFx0XHRcdGNvbnRhaW5zUlRMOiBmYWxzZSxcblx0XHRcdFx0aXNCYXNpY0FTQ0lJOiB0cnVlXG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnbXVsdGlsaW5lIHRleHQnLCAoKSA9PiB7XG5cdFx0dGVzdFRleHRNb2RlbERhdGFGcm9tU3RyaW5nKCdIZWxsbyxcXHJcXG5kZWFyIGZyaWVuZFxcbkhvd1xccmFyZVxcclxcbnlvdT8nLFxuXHRcdFx0e1xuXHRcdFx0XHRFT0w6ICdcXHJcXG4nLFxuXHRcdFx0XHRsaW5lczogW1xuXHRcdFx0XHRcdCdIZWxsbywnLFxuXHRcdFx0XHRcdCdkZWFyIGZyaWVuZCcsXG5cdFx0XHRcdFx0J0hvdycsXG5cdFx0XHRcdFx0J2FyZScsXG5cdFx0XHRcdFx0J3lvdT8nXG5cdFx0XHRcdF0sXG5cdFx0XHRcdGNvbnRhaW5zUlRMOiBmYWxzZSxcblx0XHRcdFx0aXNCYXNpY0FTQ0lJOiB0cnVlXG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnTm9uIEJhc2ljIEFTQ0lJIDEnLCAoKSA9PiB7XG5cdFx0dGVzdFRleHRNb2RlbERhdGFGcm9tU3RyaW5nKCdIZWxsbyxcXG5aXHUwMEZDcmljaCcsXG5cdFx0XHR7XG5cdFx0XHRcdEVPTDogJ1xcbicsXG5cdFx0XHRcdGxpbmVzOiBbXG5cdFx0XHRcdFx0J0hlbGxvLCcsXG5cdFx0XHRcdFx0J1pcdTAwRkNyaWNoJ1xuXHRcdFx0XHRdLFxuXHRcdFx0XHRjb250YWluc1JUTDogZmFsc2UsXG5cdFx0XHRcdGlzQmFzaWNBU0NJSTogZmFsc2Vcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdjb250YWluc1JUTCAxJywgKCkgPT4ge1xuXHRcdHRlc3RUZXh0TW9kZWxEYXRhRnJvbVN0cmluZygnSGVsbG8sXFxuXHUwNUQ2XHUwNUQ1XHUwNUQ0XHUwNUQ5IFx1MDVFMlx1MDVENVx1MDVEMVx1MDVEM1x1MDVENCBcdTA1REVcdTA1RDFcdTA1RDVcdTA1RTFcdTA1RTFcdTA1RUEgXHUwNUU5XHUwNUQzXHUwNUUyXHUwNUVBXHUwNUQ1Jyxcblx0XHRcdHtcblx0XHRcdFx0RU9MOiAnXFxuJyxcblx0XHRcdFx0bGluZXM6IFtcblx0XHRcdFx0XHQnSGVsbG8sJyxcblx0XHRcdFx0XHQnXHUwNUQ2XHUwNUQ1XHUwNUQ0XHUwNUQ5IFx1MDVFMlx1MDVENVx1MDVEMVx1MDVEM1x1MDVENCBcdTA1REVcdTA1RDFcdTA1RDVcdTA1RTFcdTA1RTFcdTA1RUEgXHUwNUU5XHUwNUQzXHUwNUUyXHUwNUVBXHUwNUQ1J1xuXHRcdFx0XHRdLFxuXHRcdFx0XHRjb250YWluc1JUTDogdHJ1ZSxcblx0XHRcdFx0aXNCYXNpY0FTQ0lJOiBmYWxzZVxuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvbnRhaW5zUlRMIDInLCAoKSA9PiB7XG5cdFx0dGVzdFRleHRNb2RlbERhdGFGcm9tU3RyaW5nKCdIZWxsbyxcXG5cdTA2NDdcdTA2NDZcdTA2MjdcdTA2NDMgXHUwNjJEXHUwNjQyXHUwNjRBXHUwNjQyXHUwNjI5IFx1MDY0NVx1MDYyQlx1MDYyOFx1MDYyQVx1MDYyOSBcdTA2NDVcdTA2NDZcdTA2MzAgXHUwNjMyXHUwNjQ1XHUwNjQ2IFx1MDYzN1x1MDY0OFx1MDY0QVx1MDY0NCcsXG5cdFx0XHR7XG5cdFx0XHRcdEVPTDogJ1xcbicsXG5cdFx0XHRcdGxpbmVzOiBbXG5cdFx0XHRcdFx0J0hlbGxvLCcsXG5cdFx0XHRcdFx0J1x1MDY0N1x1MDY0Nlx1MDYyN1x1MDY0MyBcdTA2MkRcdTA2NDJcdTA2NEFcdTA2NDJcdTA2MjkgXHUwNjQ1XHUwNjJCXHUwNjI4XHUwNjJBXHUwNjI5IFx1MDY0NVx1MDY0Nlx1MDYzMCBcdTA2MzJcdTA2NDVcdTA2NDYgXHUwNjM3XHUwNjQ4XHUwNjRBXHUwNjQ0J1xuXHRcdFx0XHRdLFxuXHRcdFx0XHRjb250YWluc1JUTDogdHJ1ZSxcblx0XHRcdFx0aXNCYXNpY0FTQ0lJOiBmYWxzZVxuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG59KTtcblxuc3VpdGUoJ0VkaXRvciBNb2RlbCAtIFRleHRNb2RlbCcsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdUZXh0TW9kZWwgZG9lcyBub3QgdXNlIGV2ZW50cyBpbnRlcm5hbGx5JywgKCkgPT4ge1xuXHRcdC8vIE1ha2Ugc3VyZSB0aGF0IGFsbCBtb2RlbCBwYXJ0cyByZWNlaXZlIHRleHQgbW9kZWwgZXZlbnRzIGV4cGxpY2l0bHlcblx0XHQvLyB0byBhdm9pZCB0aGF0IGJ5IGFueSBjaGFuY2UgYW4gb3V0c2lkZSBsaXN0ZW5lciByZWNlaXZlcyBldmVudHMgYmVmb3JlXG5cdFx0Ly8gdGhlIHBhcnRzIGFuZCB0aHVzIGFyZSBhYmxlIHRvIGFjY2VzcyB0aGUgdGV4dCBtb2RlbCBpbiBhbiBpbmNvbnNpc3RlbnQgc3RhdGUuXG5cdFx0Ly9cblx0XHQvLyBXZSBzaW1wbHkgY2hlY2sgdGhhdCB0aGVyZSBhcmUgbm8gbGlzdGVuZXJzIGF0dGFjaGVkIHRvIHRleHQgbW9kZWxcblx0XHQvLyBhZnRlciBpbnN0YW50aWF0aW9uXG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSA9IGNyZWF0ZU1vZGVsU2VydmljZXMoZGlzcG9zYWJsZXMpO1xuXHRcdGNvbnN0IHRleHRNb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXh0TW9kZWwsICcnLCBQTEFJTlRFWFRfTEFOR1VBR0VfSUQsIFRleHRNb2RlbC5ERUZBVUxUX0NSRUFUSU9OX09QVElPTlMsIG51bGwpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dE1vZGVsLl9oYXNMaXN0ZW5lcnMoKSwgZmFsc2UpO1xuXHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnZ2V0VmFsdWVMZW5ndGhJblJhbmdlJywgKCkgPT4ge1xuXG5cdFx0bGV0IG0gPSBjcmVhdGVUZXh0TW9kZWwoJ015IEZpcnN0IExpbmVcXHJcXG5NeSBTZWNvbmQgTGluZVxcclxcbk15IFRoaXJkIExpbmUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobS5nZXRWYWx1ZUxlbmd0aEluUmFuZ2UobmV3IFJhbmdlKDEsIDEsIDEsIDEpKSwgJycubGVuZ3RoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobS5nZXRWYWx1ZUxlbmd0aEluUmFuZ2UobmV3IFJhbmdlKDEsIDEsIDEsIDIpKSwgJ00nLmxlbmd0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG0uZ2V0VmFsdWVMZW5ndGhJblJhbmdlKG5ldyBSYW5nZSgxLCAyLCAxLCAzKSksICd5Jy5sZW5ndGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtLmdldFZhbHVlTGVuZ3RoSW5SYW5nZShuZXcgUmFuZ2UoMSwgMSwgMSwgMTQpKSwgJ015IEZpcnN0IExpbmUnLmxlbmd0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG0uZ2V0VmFsdWVMZW5ndGhJblJhbmdlKG5ldyBSYW5nZSgxLCAxLCAyLCAxKSksICdNeSBGaXJzdCBMaW5lXFxyXFxuJy5sZW5ndGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtLmdldFZhbHVlTGVuZ3RoSW5SYW5nZShuZXcgUmFuZ2UoMSwgMiwgMiwgMSkpLCAneSBGaXJzdCBMaW5lXFxyXFxuJy5sZW5ndGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtLmdldFZhbHVlTGVuZ3RoSW5SYW5nZShuZXcgUmFuZ2UoMSwgMiwgMiwgMikpLCAneSBGaXJzdCBMaW5lXFxyXFxuTScubGVuZ3RoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobS5nZXRWYWx1ZUxlbmd0aEluUmFuZ2UobmV3IFJhbmdlKDEsIDIsIDIsIDEwMDApKSwgJ3kgRmlyc3QgTGluZVxcclxcbk15IFNlY29uZCBMaW5lJy5sZW5ndGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtLmdldFZhbHVlTGVuZ3RoSW5SYW5nZShuZXcgUmFuZ2UoMSwgMiwgMywgMSkpLCAneSBGaXJzdCBMaW5lXFxyXFxuTXkgU2Vjb25kIExpbmVcXHJcXG4nLmxlbmd0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG0uZ2V0VmFsdWVMZW5ndGhJblJhbmdlKG5ldyBSYW5nZSgxLCAyLCAzLCAxMDAwKSksICd5IEZpcnN0IExpbmVcXHJcXG5NeSBTZWNvbmQgTGluZVxcclxcbk15IFRoaXJkIExpbmUnLmxlbmd0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG0uZ2V0VmFsdWVMZW5ndGhJblJhbmdlKG5ldyBSYW5nZSgxLCAxLCAxMDAwLCAxMDAwKSksICdNeSBGaXJzdCBMaW5lXFxyXFxuTXkgU2Vjb25kIExpbmVcXHJcXG5NeSBUaGlyZCBMaW5lJy5sZW5ndGgpO1xuXHRcdG0uZGlzcG9zZSgpO1xuXG5cdFx0bSA9IGNyZWF0ZVRleHRNb2RlbCgnTXkgRmlyc3QgTGluZVxcbk15IFNlY29uZCBMaW5lXFxuTXkgVGhpcmQgTGluZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtLmdldFZhbHVlTGVuZ3RoSW5SYW5nZShuZXcgUmFuZ2UoMSwgMSwgMSwgMSkpLCAnJy5sZW5ndGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtLmdldFZhbHVlTGVuZ3RoSW5SYW5nZShuZXcgUmFuZ2UoMSwgMSwgMSwgMikpLCAnTScubGVuZ3RoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobS5nZXRWYWx1ZUxlbmd0aEluUmFuZ2UobmV3IFJhbmdlKDEsIDIsIDEsIDMpKSwgJ3knLmxlbmd0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG0uZ2V0VmFsdWVMZW5ndGhJblJhbmdlKG5ldyBSYW5nZSgxLCAxLCAxLCAxNCkpLCAnTXkgRmlyc3QgTGluZScubGVuZ3RoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobS5nZXRWYWx1ZUxlbmd0aEluUmFuZ2UobmV3IFJhbmdlKDEsIDEsIDIsIDEpKSwgJ015IEZpcnN0IExpbmVcXG4nLmxlbmd0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG0uZ2V0VmFsdWVMZW5ndGhJblJhbmdlKG5ldyBSYW5nZSgxLCAyLCAyLCAxKSksICd5IEZpcnN0IExpbmVcXG4nLmxlbmd0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG0uZ2V0VmFsdWVMZW5ndGhJblJhbmdlKG5ldyBSYW5nZSgxLCAyLCAyLCAyKSksICd5IEZpcnN0IExpbmVcXG5NJy5sZW5ndGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtLmdldFZhbHVlTGVuZ3RoSW5SYW5nZShuZXcgUmFuZ2UoMSwgMiwgMiwgMTAwMCkpLCAneSBGaXJzdCBMaW5lXFxuTXkgU2Vjb25kIExpbmUnLmxlbmd0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG0uZ2V0VmFsdWVMZW5ndGhJblJhbmdlKG5ldyBSYW5nZSgxLCAyLCAzLCAxKSksICd5IEZpcnN0IExpbmVcXG5NeSBTZWNvbmQgTGluZVxcbicubGVuZ3RoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobS5nZXRWYWx1ZUxlbmd0aEluUmFuZ2UobmV3IFJhbmdlKDEsIDIsIDMsIDEwMDApKSwgJ3kgRmlyc3QgTGluZVxcbk15IFNlY29uZCBMaW5lXFxuTXkgVGhpcmQgTGluZScubGVuZ3RoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobS5nZXRWYWx1ZUxlbmd0aEluUmFuZ2UobmV3IFJhbmdlKDEsIDEsIDEwMDAsIDEwMDApKSwgJ015IEZpcnN0IExpbmVcXG5NeSBTZWNvbmQgTGluZVxcbk15IFRoaXJkIExpbmUnLmxlbmd0aCk7XG5cdFx0bS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2dldFZhbHVlTGVuZ3RoSW5SYW5nZSBkaWZmZXJlbnQgRU9MJywgKCkgPT4ge1xuXG5cdFx0bGV0IG0gPSBjcmVhdGVUZXh0TW9kZWwoJ015IEZpcnN0IExpbmVcXHJcXG5NeSBTZWNvbmQgTGluZVxcclxcbk15IFRoaXJkIExpbmUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobS5nZXRWYWx1ZUxlbmd0aEluUmFuZ2UobmV3IFJhbmdlKDEsIDEsIDIsIDEpLCBFbmRPZkxpbmVQcmVmZXJlbmNlLlRleHREZWZpbmVkKSwgJ015IEZpcnN0IExpbmVcXHJcXG4nLmxlbmd0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG0uZ2V0VmFsdWVMZW5ndGhJblJhbmdlKG5ldyBSYW5nZSgxLCAxLCAyLCAxKSwgRW5kT2ZMaW5lUHJlZmVyZW5jZS5DUkxGKSwgJ015IEZpcnN0IExpbmVcXHJcXG4nLmxlbmd0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG0uZ2V0VmFsdWVMZW5ndGhJblJhbmdlKG5ldyBSYW5nZSgxLCAxLCAyLCAxKSwgRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRiksICdNeSBGaXJzdCBMaW5lXFxuJy5sZW5ndGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtLmdldFZhbHVlTGVuZ3RoSW5SYW5nZShuZXcgUmFuZ2UoMSwgMSwgMTAwMCwgMTAwMCksIEVuZE9mTGluZVByZWZlcmVuY2UuVGV4dERlZmluZWQpLCAnTXkgRmlyc3QgTGluZVxcclxcbk15IFNlY29uZCBMaW5lXFxyXFxuTXkgVGhpcmQgTGluZScubGVuZ3RoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobS5nZXRWYWx1ZUxlbmd0aEluUmFuZ2UobmV3IFJhbmdlKDEsIDEsIDEwMDAsIDEwMDApLCBFbmRPZkxpbmVQcmVmZXJlbmNlLkNSTEYpLCAnTXkgRmlyc3QgTGluZVxcclxcbk15IFNlY29uZCBMaW5lXFxyXFxuTXkgVGhpcmQgTGluZScubGVuZ3RoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobS5nZXRWYWx1ZUxlbmd0aEluUmFuZ2UobmV3IFJhbmdlKDEsIDEsIDEwMDAsIDEwMDApLCBFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKSwgJ015IEZpcnN0IExpbmVcXG5NeSBTZWNvbmQgTGluZVxcbk15IFRoaXJkIExpbmUnLmxlbmd0aCk7XG5cdFx0bS5kaXNwb3NlKCk7XG5cblx0XHRtID0gY3JlYXRlVGV4dE1vZGVsKCdNeSBGaXJzdCBMaW5lXFxuTXkgU2Vjb25kIExpbmVcXG5NeSBUaGlyZCBMaW5lJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG0uZ2V0VmFsdWVMZW5ndGhJblJhbmdlKG5ldyBSYW5nZSgxLCAxLCAyLCAxKSwgRW5kT2ZMaW5lUHJlZmVyZW5jZS5UZXh0RGVmaW5lZCksICdNeSBGaXJzdCBMaW5lXFxuJy5sZW5ndGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtLmdldFZhbHVlTGVuZ3RoSW5SYW5nZShuZXcgUmFuZ2UoMSwgMSwgMiwgMSksIEVuZE9mTGluZVByZWZlcmVuY2UuTEYpLCAnTXkgRmlyc3QgTGluZVxcbicubGVuZ3RoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobS5nZXRWYWx1ZUxlbmd0aEluUmFuZ2UobmV3IFJhbmdlKDEsIDEsIDIsIDEpLCBFbmRPZkxpbmVQcmVmZXJlbmNlLkNSTEYpLCAnTXkgRmlyc3QgTGluZVxcclxcbicubGVuZ3RoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobS5nZXRWYWx1ZUxlbmd0aEluUmFuZ2UobmV3IFJhbmdlKDEsIDEsIDEwMDAsIDEwMDApLCBFbmRPZkxpbmVQcmVmZXJlbmNlLlRleHREZWZpbmVkKSwgJ015IEZpcnN0IExpbmVcXG5NeSBTZWNvbmQgTGluZVxcbk15IFRoaXJkIExpbmUnLmxlbmd0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG0uZ2V0VmFsdWVMZW5ndGhJblJhbmdlKG5ldyBSYW5nZSgxLCAxLCAxMDAwLCAxMDAwKSwgRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRiksICdNeSBGaXJzdCBMaW5lXFxuTXkgU2Vjb25kIExpbmVcXG5NeSBUaGlyZCBMaW5lJy5sZW5ndGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtLmdldFZhbHVlTGVuZ3RoSW5SYW5nZShuZXcgUmFuZ2UoMSwgMSwgMTAwMCwgMTAwMCksIEVuZE9mTGluZVByZWZlcmVuY2UuQ1JMRiksICdNeSBGaXJzdCBMaW5lXFxyXFxuTXkgU2Vjb25kIExpbmVcXHJcXG5NeSBUaGlyZCBMaW5lJy5sZW5ndGgpO1xuXHRcdG0uZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdndWVzcyBpbmRlbnRhdGlvbiAxJywgKCkgPT4ge1xuXG5cdFx0YXNzZXJ0R3Vlc3ModW5kZWZpbmVkLCB1bmRlZmluZWQsIFtcblx0XHRcdCd4Jyxcblx0XHRcdCd4Jyxcblx0XHRcdCd4Jyxcblx0XHRcdCd4Jyxcblx0XHRcdCd4Jyxcblx0XHRcdCd4Jyxcblx0XHRcdCd4J1xuXHRcdF0sICdubyBjbHVlcycpO1xuXG5cdFx0YXNzZXJ0R3Vlc3MoZmFsc2UsIHVuZGVmaW5lZCwgW1xuXHRcdFx0J1xcdHgnLFxuXHRcdFx0J3gnLFxuXHRcdFx0J3gnLFxuXHRcdFx0J3gnLFxuXHRcdFx0J3gnLFxuXHRcdFx0J3gnLFxuXHRcdFx0J3gnXG5cdFx0XSwgJ25vIHNwYWNlcywgMXhUQUInKTtcblxuXHRcdGFzc2VydEd1ZXNzKHRydWUsIDIsIFtcblx0XHRcdCcgIHgnLFxuXHRcdFx0J3gnLFxuXHRcdFx0J3gnLFxuXHRcdFx0J3gnLFxuXHRcdFx0J3gnLFxuXHRcdFx0J3gnLFxuXHRcdFx0J3gnXG5cdFx0XSwgJzF4MicpO1xuXG5cdFx0YXNzZXJ0R3Vlc3MoZmFsc2UsIHVuZGVmaW5lZCwgW1xuXHRcdFx0J1xcdHgnLFxuXHRcdFx0J1xcdHgnLFxuXHRcdFx0J1xcdHgnLFxuXHRcdFx0J1xcdHgnLFxuXHRcdFx0J1xcdHgnLFxuXHRcdFx0J1xcdHgnLFxuXHRcdFx0J1xcdHgnXG5cdFx0XSwgJzd4VEFCJyk7XG5cblx0XHRhc3NlcnRHdWVzcyh1bmRlZmluZWQsIFsyXSwgW1xuXHRcdFx0J1xcdHgnLFxuXHRcdFx0JyAgeCcsXG5cdFx0XHQnXFx0eCcsXG5cdFx0XHQnICB4Jyxcblx0XHRcdCdcXHR4Jyxcblx0XHRcdCcgIHgnLFxuXHRcdFx0J1xcdHgnLFxuXHRcdFx0JyAgeCcsXG5cdFx0XSwgJzR4MiwgNHhUQUInKTtcblx0XHRhc3NlcnRHdWVzcyhmYWxzZSwgdW5kZWZpbmVkLCBbXG5cdFx0XHQnXFx0eCcsXG5cdFx0XHQnIHgnLFxuXHRcdFx0J1xcdHgnLFxuXHRcdFx0JyB4Jyxcblx0XHRcdCdcXHR4Jyxcblx0XHRcdCcgeCcsXG5cdFx0XHQnXFx0eCcsXG5cdFx0XHQnIHgnXG5cdFx0XSwgJzR4MSwgNHhUQUInKTtcblx0XHRhc3NlcnRHdWVzcyhmYWxzZSwgdW5kZWZpbmVkLCBbXG5cdFx0XHQnXFx0eCcsXG5cdFx0XHQnXFx0eCcsXG5cdFx0XHQnICB4Jyxcblx0XHRcdCdcXHR4Jyxcblx0XHRcdCcgIHgnLFxuXHRcdFx0J1xcdHgnLFxuXHRcdFx0JyAgeCcsXG5cdFx0XHQnXFx0eCcsXG5cdFx0XHQnICB4Jyxcblx0XHRdLCAnNHgyLCA1eFRBQicpO1xuXHRcdGFzc2VydEd1ZXNzKGZhbHNlLCB1bmRlZmluZWQsIFtcblx0XHRcdCdcXHR4Jyxcblx0XHRcdCdcXHR4Jyxcblx0XHRcdCd4Jyxcblx0XHRcdCdcXHR4Jyxcblx0XHRcdCd4Jyxcblx0XHRcdCdcXHR4Jyxcblx0XHRcdCd4Jyxcblx0XHRcdCdcXHR4Jyxcblx0XHRcdCcgIHgnLFxuXHRcdF0sICcxeDIsIDV4VEFCJyk7XG5cdFx0YXNzZXJ0R3Vlc3MoZmFsc2UsIHVuZGVmaW5lZCwgW1xuXHRcdFx0J1xcdHgnLFxuXHRcdFx0J1xcdHgnLFxuXHRcdFx0J3gnLFxuXHRcdFx0J1xcdHgnLFxuXHRcdFx0J3gnLFxuXHRcdFx0J1xcdHgnLFxuXHRcdFx0J3gnLFxuXHRcdFx0J1xcdHgnLFxuXHRcdFx0JyAgICB4Jyxcblx0XHRdLCAnMXg0LCA1eFRBQicpO1xuXHRcdGFzc2VydEd1ZXNzKGZhbHNlLCB1bmRlZmluZWQsIFtcblx0XHRcdCdcXHR4Jyxcblx0XHRcdCdcXHR4Jyxcblx0XHRcdCd4Jyxcblx0XHRcdCdcXHR4Jyxcblx0XHRcdCd4Jyxcblx0XHRcdCdcXHR4Jyxcblx0XHRcdCcgIHgnLFxuXHRcdFx0J1xcdHgnLFxuXHRcdFx0JyAgICB4Jyxcblx0XHRdLCAnMXgyLCAxeDQsIDV4VEFCJyk7XG5cblx0XHRhc3NlcnRHdWVzcyh1bmRlZmluZWQsIHVuZGVmaW5lZCwgW1xuXHRcdFx0J3gnLFxuXHRcdFx0JyB4Jyxcblx0XHRcdCcgeCcsXG5cdFx0XHQnIHgnLFxuXHRcdFx0JyB4Jyxcblx0XHRcdCcgeCcsXG5cdFx0XHQnIHgnLFxuXHRcdFx0JyB4J1xuXHRcdF0sICc3eDEgLSAxIHNwYWNlIGlzIG5ldmVyIGd1ZXNzZWQgYXMgYW4gaW5kZW50YXRpb24nKTtcblx0XHRhc3NlcnRHdWVzcyh0cnVlLCB1bmRlZmluZWQsIFtcblx0XHRcdCd4Jyxcblx0XHRcdCcgICAgICAgICAgeCcsXG5cdFx0XHQnIHgnLFxuXHRcdFx0JyB4Jyxcblx0XHRcdCcgeCcsXG5cdFx0XHQnIHgnLFxuXHRcdFx0JyB4Jyxcblx0XHRcdCcgeCdcblx0XHRdLCAnMXgxMCwgNngxJyk7XG5cdFx0YXNzZXJ0R3Vlc3ModW5kZWZpbmVkLCB1bmRlZmluZWQsIFtcblx0XHRcdCcnLFxuXHRcdFx0JyAgJyxcblx0XHRcdCcgICAgJyxcblx0XHRcdCcgICAgICAnLFxuXHRcdFx0JyAgICAgICAgJyxcblx0XHRcdCcgICAgICAgICAgJyxcblx0XHRcdCcgICAgICAgICAgICAnLFxuXHRcdFx0JyAgICAgICAgICAgICAgJyxcblx0XHRdLCAnd2hpdGVzcGFjZSBsaW5lcyBkb25cXCd0IGNvdW50Jyk7XG5cdFx0YXNzZXJ0R3Vlc3ModHJ1ZSwgMywgW1xuXHRcdFx0J3gnLFxuXHRcdFx0JyAgIHgnLFxuXHRcdFx0JyAgIHgnLFxuXHRcdFx0JyAgICB4Jyxcblx0XHRcdCd4Jyxcblx0XHRcdCcgICB4Jyxcblx0XHRcdCcgICB4Jyxcblx0XHRcdCcgICAgeCcsXG5cdFx0XHQneCcsXG5cdFx0XHQnICAgeCcsXG5cdFx0XHQnICAgeCcsXG5cdFx0XHQnICAgIHgnLFxuXHRcdF0sICc2eDMsIDN4NCcpO1xuXHRcdGFzc2VydEd1ZXNzKHRydWUsIDUsIFtcblx0XHRcdCd4Jyxcblx0XHRcdCcgICAgIHgnLFxuXHRcdFx0JyAgICAgeCcsXG5cdFx0XHQnICAgIHgnLFxuXHRcdFx0J3gnLFxuXHRcdFx0JyAgICAgeCcsXG5cdFx0XHQnICAgICB4Jyxcblx0XHRcdCcgICAgeCcsXG5cdFx0XHQneCcsXG5cdFx0XHQnICAgICB4Jyxcblx0XHRcdCcgICAgIHgnLFxuXHRcdFx0JyAgICB4Jyxcblx0XHRdLCAnNng1LCAzeDQnKTtcblx0XHRhc3NlcnRHdWVzcyh0cnVlLCA3LCBbXG5cdFx0XHQneCcsXG5cdFx0XHQnICAgICAgIHgnLFxuXHRcdFx0JyAgICAgICB4Jyxcblx0XHRcdCcgICAgIHgnLFxuXHRcdFx0J3gnLFxuXHRcdFx0JyAgICAgICB4Jyxcblx0XHRcdCcgICAgICAgeCcsXG5cdFx0XHQnICAgIHgnLFxuXHRcdFx0J3gnLFxuXHRcdFx0JyAgICAgICB4Jyxcblx0XHRcdCcgICAgICAgeCcsXG5cdFx0XHQnICAgIHgnLFxuXHRcdF0sICc2eDcsIDF4NSwgMng0Jyk7XG5cdFx0YXNzZXJ0R3Vlc3ModHJ1ZSwgMiwgW1xuXHRcdFx0J3gnLFxuXHRcdFx0JyAgeCcsXG5cdFx0XHQnICB4Jyxcblx0XHRcdCcgIHgnLFxuXHRcdFx0JyAgeCcsXG5cdFx0XHQneCcsXG5cdFx0XHQnICB4Jyxcblx0XHRcdCcgIHgnLFxuXHRcdFx0JyAgeCcsXG5cdFx0XHQnICB4Jyxcblx0XHRdLCAnOHgyJyk7XG5cblx0XHRhc3NlcnRHdWVzcyh0cnVlLCAyLCBbXG5cdFx0XHQneCcsXG5cdFx0XHQnICB4Jyxcblx0XHRcdCcgIHgnLFxuXHRcdFx0J3gnLFxuXHRcdFx0JyAgeCcsXG5cdFx0XHQnICB4Jyxcblx0XHRcdCd4Jyxcblx0XHRcdCcgIHgnLFxuXHRcdFx0JyAgeCcsXG5cdFx0XHQneCcsXG5cdFx0XHQnICB4Jyxcblx0XHRcdCcgIHgnLFxuXHRcdF0sICc4eDInKTtcblx0XHRhc3NlcnRHdWVzcyh0cnVlLCAyLCBbXG5cdFx0XHQneCcsXG5cdFx0XHQnICB4Jyxcblx0XHRcdCcgICAgeCcsXG5cdFx0XHQneCcsXG5cdFx0XHQnICB4Jyxcblx0XHRcdCcgICAgeCcsXG5cdFx0XHQneCcsXG5cdFx0XHQnICB4Jyxcblx0XHRcdCcgICAgeCcsXG5cdFx0XHQneCcsXG5cdFx0XHQnICB4Jyxcblx0XHRcdCcgICAgeCcsXG5cdFx0XSwgJzR4MiwgNHg0Jyk7XG5cdFx0YXNzZXJ0R3Vlc3ModHJ1ZSwgMiwgW1xuXHRcdFx0J3gnLFxuXHRcdFx0JyAgeCcsXG5cdFx0XHQnICB4Jyxcblx0XHRcdCcgICAgeCcsXG5cdFx0XHQneCcsXG5cdFx0XHQnICB4Jyxcblx0XHRcdCcgIHgnLFxuXHRcdFx0JyAgICB4Jyxcblx0XHRcdCd4Jyxcblx0XHRcdCcgIHgnLFxuXHRcdFx0JyAgeCcsXG5cdFx0XHQnICAgIHgnLFxuXHRcdF0sICc2eDIsIDN4NCcpO1xuXHRcdGFzc2VydEd1ZXNzKHRydWUsIDIsIFtcblx0XHRcdCd4Jyxcblx0XHRcdCcgIHgnLFxuXHRcdFx0JyAgeCcsXG5cdFx0XHQnICAgIHgnLFxuXHRcdFx0JyAgICB4Jyxcblx0XHRcdCd4Jyxcblx0XHRcdCcgIHgnLFxuXHRcdFx0JyAgeCcsXG5cdFx0XHQnICAgIHgnLFxuXHRcdFx0JyAgICB4Jyxcblx0XHRdLCAnNHgyLCA0eDQnKTtcblx0XHRhc3NlcnRHdWVzcyh0cnVlLCAyLCBbXG5cdFx0XHQneCcsXG5cdFx0XHQnICB4Jyxcblx0XHRcdCcgICAgeCcsXG5cdFx0XHQnICAgIHgnLFxuXHRcdFx0J3gnLFxuXHRcdFx0JyAgeCcsXG5cdFx0XHQnICAgIHgnLFxuXHRcdFx0JyAgICB4Jyxcblx0XHRdLCAnMngyLCA0eDQnKTtcblx0XHRhc3NlcnRHdWVzcyh0cnVlLCA0LCBbXG5cdFx0XHQneCcsXG5cdFx0XHQnICAgIHgnLFxuXHRcdFx0JyAgICB4Jyxcblx0XHRcdCd4Jyxcblx0XHRcdCcgICAgeCcsXG5cdFx0XHQnICAgIHgnLFxuXHRcdFx0J3gnLFxuXHRcdFx0JyAgICB4Jyxcblx0XHRcdCcgICAgeCcsXG5cdFx0XHQneCcsXG5cdFx0XHQnICAgIHgnLFxuXHRcdFx0JyAgICB4Jyxcblx0XHRdLCAnOHg0Jyk7XG5cdFx0YXNzZXJ0R3Vlc3ModHJ1ZSwgMiwgW1xuXHRcdFx0J3gnLFxuXHRcdFx0JyAgeCcsXG5cdFx0XHQnICAgIHgnLFxuXHRcdFx0JyAgICB4Jyxcblx0XHRcdCcgICAgICB4Jyxcblx0XHRcdCd4Jyxcblx0XHRcdCcgIHgnLFxuXHRcdFx0JyAgICB4Jyxcblx0XHRcdCcgICAgeCcsXG5cdFx0XHQnICAgICAgeCcsXG5cdFx0XSwgJzJ4MiwgNHg0LCAyeDYnKTtcblx0XHRhc3NlcnRHdWVzcyh0cnVlLCAyLCBbXG5cdFx0XHQneCcsXG5cdFx0XHQnICB4Jyxcblx0XHRcdCcgICAgeCcsXG5cdFx0XHQnICAgIHgnLFxuXHRcdFx0JyAgICAgIHgnLFxuXHRcdFx0JyAgICAgIHgnLFxuXHRcdFx0JyAgICAgICAgeCcsXG5cdFx0XSwgJzF4MiwgMng0LCAyeDYsIDF4OCcpO1xuXHRcdGFzc2VydEd1ZXNzKHRydWUsIDQsIFtcblx0XHRcdCd4Jyxcblx0XHRcdCcgICAgeCcsXG5cdFx0XHQnICAgIHgnLFxuXHRcdFx0JyAgICB4Jyxcblx0XHRcdCcgICAgIHgnLFxuXHRcdFx0JyAgICAgICAgeCcsXG5cdFx0XHQneCcsXG5cdFx0XHQnICAgIHgnLFxuXHRcdFx0JyAgICB4Jyxcblx0XHRcdCcgICAgeCcsXG5cdFx0XHQnICAgICB4Jyxcblx0XHRcdCcgICAgICAgIHgnLFxuXHRcdF0sICc2eDQsIDJ4NSwgMng4Jyk7XG5cdFx0YXNzZXJ0R3Vlc3ModHJ1ZSwgNCwgW1xuXHRcdFx0J3gnLFxuXHRcdFx0JyAgICB4Jyxcblx0XHRcdCcgICAgeCcsXG5cdFx0XHQnICAgIHgnLFxuXHRcdFx0JyAgICAgeCcsXG5cdFx0XHQnICAgICAgICB4Jyxcblx0XHRcdCcgICAgICAgIHgnLFxuXHRcdF0sICczeDQsIDF4NSwgMng4Jyk7XG5cdFx0YXNzZXJ0R3Vlc3ModHJ1ZSwgNCwgW1xuXHRcdFx0J3gnLFxuXHRcdFx0J3gnLFxuXHRcdFx0JyAgICB4Jyxcblx0XHRcdCcgICAgeCcsXG5cdFx0XHQnICAgICB4Jyxcblx0XHRcdCcgICAgICAgIHgnLFxuXHRcdFx0JyAgICAgICAgeCcsXG5cdFx0XHQneCcsXG5cdFx0XHQneCcsXG5cdFx0XHQnICAgIHgnLFxuXHRcdFx0JyAgICB4Jyxcblx0XHRcdCcgICAgIHgnLFxuXHRcdFx0JyAgICAgICAgeCcsXG5cdFx0XHQnICAgICAgICB4Jyxcblx0XHRdLCAnNng0LCAyeDUsIDR4OCcpO1xuXHRcdGFzc2VydEd1ZXNzKHRydWUsIDMsIFtcblx0XHRcdCd4Jyxcblx0XHRcdCcgeCcsXG5cdFx0XHQnIHgnLFxuXHRcdFx0JyB4Jyxcblx0XHRcdCcgeCcsXG5cdFx0XHQnIHgnLFxuXHRcdFx0J3gnLFxuXHRcdFx0JyAgIHgnLFxuXHRcdFx0JyAgICB4Jyxcblx0XHRcdCcgICAgeCcsXG5cdFx0XSwgJzV4MSwgMngwLCAxeDMsIDJ4NCcpO1xuXHRcdGFzc2VydEd1ZXNzKGZhbHNlLCB1bmRlZmluZWQsIFtcblx0XHRcdCdcXHQgeCcsXG5cdFx0XHQnIFxcdCB4Jyxcblx0XHRcdCdcXHR4J1xuXHRcdF0sICdtaXhlZCB3aGl0ZXNwYWNlIDEnKTtcblx0XHRhc3NlcnRHdWVzcyhmYWxzZSwgdW5kZWZpbmVkLCBbXG5cdFx0XHQnXFx0eCcsXG5cdFx0XHQnXFx0ICAgIHgnXG5cdFx0XSwgJ21peGVkIHdoaXRlc3BhY2UgMicpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjNDQ5OTE6IFdyb25nIGluZGVudGF0aW9uIHNpemUgYXV0by1kZXRlY3Rpb24nLCAoKSA9PiB7XG5cdFx0YXNzZXJ0R3Vlc3ModHJ1ZSwgNCwgW1xuXHRcdFx0J2EgPSAxMCAgICAgICAgICAgICAjIDAgc3BhY2UgaW5kZW50Jyxcblx0XHRcdCdiID0gNSAgICAgICAgICAgICAgIyAwIHNwYWNlIGluZGVudCcsXG5cdFx0XHQnaWYgYSA+IDEwOiAgICAgICAgICMgMCBzcGFjZSBpbmRlbnQnLFxuXHRcdFx0JyAgICBhICs9IDEgICAgICAgICAjIDQgc3BhY2UgaW5kZW50ICAgICAgZGVsdGEgNCBzcGFjZXMnLFxuXHRcdFx0JyAgICBpZiBiID4gNTogICAgICAjIDQgc3BhY2UgaW5kZW50Jyxcblx0XHRcdCcgICAgICAgIGIgKz0gMSAgICAgIyA4IHNwYWNlIGluZGVudCAgICAgIGRlbHRhIDQgc3BhY2VzJyxcblx0XHRcdCcgICAgICAgIGIgKz0gMSAgICAgIyA4IHNwYWNlIGluZGVudCcsXG5cdFx0XHQnICAgICAgICBiICs9IDEgICAgICMgOCBzcGFjZSBpbmRlbnQnLFxuXHRcdFx0JyMgY29tbWVudCBsaW5lIDEgICAjIDAgc3BhY2UgaW5kZW50ICAgICAgZGVsdGEgOCBzcGFjZXMnLFxuXHRcdFx0JyMgY29tbWVudCBsaW5lIDIgICAjIDAgc3BhY2UgaW5kZW50Jyxcblx0XHRcdCcjIGNvbW1lbnQgbGluZSAzICAgIyAwIHNwYWNlIGluZGVudCcsXG5cdFx0XHQnICAgICAgICBiICs9IDEgICAgICMgOCBzcGFjZSBpbmRlbnQgICAgICBkZWx0YSA4IHNwYWNlcycsXG5cdFx0XHQnICAgICAgICBiICs9IDEgICAgICMgOCBzcGFjZSBpbmRlbnQnLFxuXHRcdFx0JyAgICAgICAgYiArPSAxICAgICAjIDggc3BhY2UgaW5kZW50Jyxcblx0XHRdKTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzU1ODE4OiBCcm9rZW4gaW5kZW50YXRpb24gZGV0ZWN0aW9uJywgKCkgPT4ge1xuXHRcdGFzc2VydEd1ZXNzKHRydWUsIDIsIFtcblx0XHRcdCcnLFxuXHRcdFx0Jy8qIFJFUVVJUkUgKi8nLFxuXHRcdFx0JycsXG5cdFx0XHQnY29uc3QgZm9vID0gcmVxdWlyZSAoIFxcJ2Zvb1xcJyApLCcsXG5cdFx0XHQnICAgICAgYmFyID0gcmVxdWlyZSAoIFxcJ2JhclxcJyApOycsXG5cdFx0XHQnJyxcblx0XHRcdCcvKiBNWSBGTiAqLycsXG5cdFx0XHQnJyxcblx0XHRcdCdmdW5jdGlvbiBteUZuICgpIHsnLFxuXHRcdFx0JycsXG5cdFx0XHQnICBjb25zdCBhc2QgPSAxLCcsXG5cdFx0XHQnICAgICAgICBkc2EgPSAyOycsXG5cdFx0XHQnJyxcblx0XHRcdCcgIHJldHVybiBiYXIgKCBmb28gKCBhc2QgKSApOycsXG5cdFx0XHQnJyxcblx0XHRcdCd9Jyxcblx0XHRcdCcnLFxuXHRcdFx0Jy8qIEVYUE9SVCAqLycsXG5cdFx0XHQnJyxcblx0XHRcdCdtb2R1bGUuZXhwb3J0cyA9IG15Rm47Jyxcblx0XHRcdCcnLFxuXHRcdF0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjNzA4MzI6IEJyb2tlbiBpbmRlbnRhdGlvbiBkZXRlY3Rpb24nLCAoKSA9PiB7XG5cdFx0YXNzZXJ0R3Vlc3MoZmFsc2UsIHVuZGVmaW5lZCwgW1xuXHRcdFx0J3gnLFxuXHRcdFx0J3gnLFxuXHRcdFx0J3gnLFxuXHRcdFx0J3gnLFxuXHRcdFx0J1x0eCcsXG5cdFx0XHQnXHRcdHgnLFxuXHRcdFx0JyAgICB4Jyxcblx0XHRcdCdcdFx0eCcsXG5cdFx0XHQnXHR4Jyxcblx0XHRcdCdcdFx0eCcsXG5cdFx0XHQnXHR4Jyxcblx0XHRcdCdcdHgnLFxuXHRcdFx0J1x0eCcsXG5cdFx0XHQnXHR4Jyxcblx0XHRcdCd4Jyxcblx0XHRdKTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzYyMTQzOiBCcm9rZW4gaW5kZW50YXRpb24gZGV0ZWN0aW9uJywgKCkgPT4ge1xuXHRcdC8vIHdvcmtzIGJlZm9yZSB0aGUgZml4XG5cdFx0YXNzZXJ0R3Vlc3ModHJ1ZSwgMiwgW1xuXHRcdFx0J3gnLFxuXHRcdFx0J3gnLFxuXHRcdFx0JyAgeCcsXG5cdFx0XHQnICB4J1xuXHRcdF0pO1xuXG5cdFx0Ly8gd29ya3MgYmVmb3JlIHRoZSBmaXhcblx0XHRhc3NlcnRHdWVzcyh0cnVlLCAyLCBbXG5cdFx0XHQneCcsXG5cdFx0XHQnICAtIGl0ZW0yJyxcblx0XHRcdCcgIC0gaXRlbTMnXG5cdFx0XSk7XG5cblx0XHQvLyB3b3JrcyBiZWZvcmUgdGhlIGZpeFxuXHRcdHRlc3RHdWVzc0luZGVudGF0aW9uKHRydWUsIDIsIHRydWUsIDIsIFtcblx0XHRcdCd4IHgnLFxuXHRcdFx0JyAgeCcsXG5cdFx0XHQnICB4Jyxcblx0XHRdKTtcblxuXHRcdC8vIGZhaWxzIGJlZm9yZSB0aGUgZml4XG5cdFx0Ly8gZW1wdHkgc3BhY2UgaW5saW5lIGJyZWFrcyB0aGUgaW5kZW50YXRpb24gZ3Vlc3Ncblx0XHR0ZXN0R3Vlc3NJbmRlbnRhdGlvbih0cnVlLCAyLCB0cnVlLCAyLCBbXG5cdFx0XHQneCB4Jyxcblx0XHRcdCcgIHgnLFxuXHRcdFx0JyAgeCcsXG5cdFx0XHQnICAgIHgnXG5cdFx0XSk7XG5cblx0XHR0ZXN0R3Vlc3NJbmRlbnRhdGlvbih0cnVlLCAyLCB0cnVlLCAyLCBbXG5cdFx0XHQnPCEtLXRlc3QxLm1kIC0tPicsXG5cdFx0XHQnLSBpdGVtMScsXG5cdFx0XHQnICAtIGl0ZW0yJyxcblx0XHRcdCcgICAgLSBpdGVtMydcblx0XHRdKTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzg0MjE3OiBCcm9rZW4gaW5kZW50YXRpb24gZGV0ZWN0aW9uJywgKCkgPT4ge1xuXHRcdGFzc2VydEd1ZXNzKHRydWUsIDQsIFtcblx0XHRcdCdkZWYgbWFpbigpOicsXG5cdFx0XHQnICAgIHByaW50KFxcJ2hlbGxvXFwnKScsXG5cdFx0XSk7XG5cdFx0YXNzZXJ0R3Vlc3ModHJ1ZSwgNCwgW1xuXHRcdFx0J2RlZiBtYWluKCk6Jyxcblx0XHRcdCcgICAgd2l0aCBvcGVuKFxcJ2Zvb1xcJykgYXMgZnA6Jyxcblx0XHRcdCcgICAgICAgIHByaW50KGZwLnJlYWQoKSknLFxuXHRcdF0pO1xuXHR9KTtcblxuXHR0ZXN0KCd2YWxpZGF0ZVBvc2l0aW9uJywgKCkgPT4ge1xuXG5cdFx0Y29uc3QgbSA9IGNyZWF0ZVRleHRNb2RlbCgnbGluZSBvbmVcXG5saW5lIHR3bycpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLnZhbGlkYXRlUG9zaXRpb24obmV3IFBvc2l0aW9uKDAsIDApKSwgbmV3IFBvc2l0aW9uKDEsIDEpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVQb3NpdGlvbihuZXcgUG9zaXRpb24oMCwgMSkpLCBuZXcgUG9zaXRpb24oMSwgMSkpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLnZhbGlkYXRlUG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDEpKSwgbmV3IFBvc2l0aW9uKDEsIDEpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVQb3NpdGlvbihuZXcgUG9zaXRpb24oMSwgMikpLCBuZXcgUG9zaXRpb24oMSwgMikpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVBvc2l0aW9uKG5ldyBQb3NpdGlvbigxLCAzMCkpLCBuZXcgUG9zaXRpb24oMSwgOSkpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLnZhbGlkYXRlUG9zaXRpb24obmV3IFBvc2l0aW9uKDIsIDApKSwgbmV3IFBvc2l0aW9uKDIsIDEpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVQb3NpdGlvbihuZXcgUG9zaXRpb24oMiwgMSkpLCBuZXcgUG9zaXRpb24oMiwgMSkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVBvc2l0aW9uKG5ldyBQb3NpdGlvbigyLCAyKSksIG5ldyBQb3NpdGlvbigyLCAyKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLnZhbGlkYXRlUG9zaXRpb24obmV3IFBvc2l0aW9uKDIsIDMwKSksIG5ldyBQb3NpdGlvbigyLCA5KSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVQb3NpdGlvbihuZXcgUG9zaXRpb24oMywgMCkpLCBuZXcgUG9zaXRpb24oMiwgOSkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVBvc2l0aW9uKG5ldyBQb3NpdGlvbigzLCAxKSksIG5ldyBQb3NpdGlvbigyLCA5KSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLnZhbGlkYXRlUG9zaXRpb24obmV3IFBvc2l0aW9uKDMsIDMwKSksIG5ldyBQb3NpdGlvbigyLCA5KSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVQb3NpdGlvbihuZXcgUG9zaXRpb24oMzAsIDMwKSksIG5ldyBQb3NpdGlvbigyLCA5KSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVQb3NpdGlvbihuZXcgUG9zaXRpb24oLTEyMy4xMjMsIC0wLjUpKSwgbmV3IFBvc2l0aW9uKDEsIDEpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVQb3NpdGlvbihuZXcgUG9zaXRpb24oTnVtYmVyLk1JTl9WQUxVRSwgTnVtYmVyLk1JTl9WQUxVRSkpLCBuZXcgUG9zaXRpb24oMSwgMSkpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLnZhbGlkYXRlUG9zaXRpb24obmV3IFBvc2l0aW9uKE51bWJlci5NQVhfVkFMVUUsIE51bWJlci5NQVhfVkFMVUUpKSwgbmV3IFBvc2l0aW9uKDIsIDkpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVQb3NpdGlvbihuZXcgUG9zaXRpb24oMTIzLjIzLCA0Ny41KSksIG5ldyBQb3NpdGlvbigyLCA5KSk7XG5cblx0XHRtLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgndmFsaWRhdGVQb3NpdGlvbiBhcm91bmQgaGlnaC1sb3cgc3Vycm9nYXRlIHBhaXJzIDEnLCAoKSA9PiB7XG5cblx0XHRjb25zdCBtID0gY3JlYXRlVGV4dE1vZGVsKCdhXHVEODNEXHVEQ0RBYicpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLnZhbGlkYXRlUG9zaXRpb24obmV3IFBvc2l0aW9uKDAsIDApKSwgbmV3IFBvc2l0aW9uKDEsIDEpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVQb3NpdGlvbihuZXcgUG9zaXRpb24oMCwgMSkpLCBuZXcgUG9zaXRpb24oMSwgMSkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVBvc2l0aW9uKG5ldyBQb3NpdGlvbigwLCA3KSksIG5ldyBQb3NpdGlvbigxLCAxKSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVQb3NpdGlvbihuZXcgUG9zaXRpb24oMSwgMSkpLCBuZXcgUG9zaXRpb24oMSwgMSkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVBvc2l0aW9uKG5ldyBQb3NpdGlvbigxLCAyKSksIG5ldyBQb3NpdGlvbigxLCAyKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLnZhbGlkYXRlUG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDMpKSwgbmV3IFBvc2l0aW9uKDEsIDIpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVQb3NpdGlvbihuZXcgUG9zaXRpb24oMSwgNCkpLCBuZXcgUG9zaXRpb24oMSwgNCkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVBvc2l0aW9uKG5ldyBQb3NpdGlvbigxLCA1KSksIG5ldyBQb3NpdGlvbigxLCA1KSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLnZhbGlkYXRlUG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDMwKSksIG5ldyBQb3NpdGlvbigxLCA1KSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVQb3NpdGlvbihuZXcgUG9zaXRpb24oMiwgMCkpLCBuZXcgUG9zaXRpb24oMSwgNSkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVBvc2l0aW9uKG5ldyBQb3NpdGlvbigyLCAxKSksIG5ldyBQb3NpdGlvbigxLCA1KSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLnZhbGlkYXRlUG9zaXRpb24obmV3IFBvc2l0aW9uKDIsIDIpKSwgbmV3IFBvc2l0aW9uKDEsIDUpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVQb3NpdGlvbihuZXcgUG9zaXRpb24oMiwgMzApKSwgbmV3IFBvc2l0aW9uKDEsIDUpKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVBvc2l0aW9uKG5ldyBQb3NpdGlvbigtMTIzLjEyMywgLTAuNSkpLCBuZXcgUG9zaXRpb24oMSwgMSkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVBvc2l0aW9uKG5ldyBQb3NpdGlvbihOdW1iZXIuTUlOX1ZBTFVFLCBOdW1iZXIuTUlOX1ZBTFVFKSksIG5ldyBQb3NpdGlvbigxLCAxKSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVQb3NpdGlvbihuZXcgUG9zaXRpb24oTnVtYmVyLk1BWF9WQUxVRSwgTnVtYmVyLk1BWF9WQUxVRSkpLCBuZXcgUG9zaXRpb24oMSwgNSkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVBvc2l0aW9uKG5ldyBQb3NpdGlvbigxMjMuMjMsIDQ3LjUpKSwgbmV3IFBvc2l0aW9uKDEsIDUpKTtcblxuXHRcdG0uZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCd2YWxpZGF0ZVBvc2l0aW9uIGFyb3VuZCBoaWdoLWxvdyBzdXJyb2dhdGUgcGFpcnMgMicsICgpID0+IHtcblxuXHRcdGNvbnN0IG0gPSBjcmVhdGVUZXh0TW9kZWwoJ2FcdUQ4M0RcdURDREFcdUQ4M0RcdURDREFiJyk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVQb3NpdGlvbihuZXcgUG9zaXRpb24oMSwgMSkpLCBuZXcgUG9zaXRpb24oMSwgMSkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVBvc2l0aW9uKG5ldyBQb3NpdGlvbigxLCAyKSksIG5ldyBQb3NpdGlvbigxLCAyKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLnZhbGlkYXRlUG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDMpKSwgbmV3IFBvc2l0aW9uKDEsIDIpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVQb3NpdGlvbihuZXcgUG9zaXRpb24oMSwgNCkpLCBuZXcgUG9zaXRpb24oMSwgNCkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVBvc2l0aW9uKG5ldyBQb3NpdGlvbigxLCA1KSksIG5ldyBQb3NpdGlvbigxLCA0KSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLnZhbGlkYXRlUG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDYpKSwgbmV3IFBvc2l0aW9uKDEsIDYpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVQb3NpdGlvbihuZXcgUG9zaXRpb24oMSwgNykpLCBuZXcgUG9zaXRpb24oMSwgNykpO1xuXG5cdFx0bS5kaXNwb3NlKCk7XG5cblx0fSk7XG5cblx0dGVzdCgndmFsaWRhdGVQb3NpdGlvbiBoYW5kbGUgTmFOLicsICgpID0+IHtcblxuXHRcdGNvbnN0IG0gPSBjcmVhdGVUZXh0TW9kZWwoJ2xpbmUgb25lXFxubGluZSB0d28nKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVBvc2l0aW9uKG5ldyBQb3NpdGlvbihOYU4sIDEpKSwgbmV3IFBvc2l0aW9uKDEsIDEpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVQb3NpdGlvbihuZXcgUG9zaXRpb24oMSwgTmFOKSksIG5ldyBQb3NpdGlvbigxLCAxKSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVQb3NpdGlvbihuZXcgUG9zaXRpb24oTmFOLCBOYU4pKSwgbmV3IFBvc2l0aW9uKDEsIDEpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVQb3NpdGlvbihuZXcgUG9zaXRpb24oMiwgTmFOKSksIG5ldyBQb3NpdGlvbigyLCAxKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLnZhbGlkYXRlUG9zaXRpb24obmV3IFBvc2l0aW9uKE5hTiwgMykpLCBuZXcgUG9zaXRpb24oMSwgMykpO1xuXG5cdFx0bS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICM3MTQ4MDogdmFsaWRhdGVQb3NpdGlvbiBoYW5kbGUgZmxvYXRzJywgKCkgPT4ge1xuXHRcdGNvbnN0IG0gPSBjcmVhdGVUZXh0TW9kZWwoJ2xpbmUgb25lXFxubGluZSB0d28nKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVBvc2l0aW9uKG5ldyBQb3NpdGlvbigwLjIsIDEpKSwgbmV3IFBvc2l0aW9uKDEsIDEpLCAnYScpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVBvc2l0aW9uKG5ldyBQb3NpdGlvbigxLjIsIDEpKSwgbmV3IFBvc2l0aW9uKDEsIDEpLCAnYicpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVBvc2l0aW9uKG5ldyBQb3NpdGlvbigxLjUsIDIpKSwgbmV3IFBvc2l0aW9uKDEsIDIpLCAnYycpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVBvc2l0aW9uKG5ldyBQb3NpdGlvbigxLjgsIDMpKSwgbmV3IFBvc2l0aW9uKDEsIDMpLCAnZCcpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVBvc2l0aW9uKG5ldyBQb3NpdGlvbigxLCAwLjMpKSwgbmV3IFBvc2l0aW9uKDEsIDEpLCAnZScpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVBvc2l0aW9uKG5ldyBQb3NpdGlvbigyLCAwLjgpKSwgbmV3IFBvc2l0aW9uKDIsIDEpLCAnZicpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVBvc2l0aW9uKG5ldyBQb3NpdGlvbigxLCAxLjIpKSwgbmV3IFBvc2l0aW9uKDEsIDEpLCAnZycpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVBvc2l0aW9uKG5ldyBQb3NpdGlvbigyLCAxLjUpKSwgbmV3IFBvc2l0aW9uKDIsIDEpLCAnaCcpO1xuXG5cdFx0bS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICM3MTQ4MDogdmFsaWRhdGVSYW5nZSBoYW5kbGUgZmxvYXRzJywgKCkgPT4ge1xuXHRcdGNvbnN0IG0gPSBjcmVhdGVUZXh0TW9kZWwoJ2xpbmUgb25lXFxubGluZSB0d28nKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVJhbmdlKG5ldyBSYW5nZSgwLjIsIDEuNSwgMC44LCAyLjUpKSwgbmV3IFJhbmdlKDEsIDEsIDEsIDEpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVSYW5nZShuZXcgUmFuZ2UoMS4yLCAxLjcsIDEuOCwgMi4yKSksIG5ldyBSYW5nZSgxLCAxLCAxLCAyKSk7XG5cblx0XHRtLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgndmFsaWRhdGVSYW5nZSBhcm91bmQgaGlnaC1sb3cgc3Vycm9nYXRlIHBhaXJzIDEnLCAoKSA9PiB7XG5cblx0XHRjb25zdCBtID0gY3JlYXRlVGV4dE1vZGVsKCdhXHVEODNEXHVEQ0RBYicpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLnZhbGlkYXRlUmFuZ2UobmV3IFJhbmdlKDAsIDAsIDAsIDEpKSwgbmV3IFJhbmdlKDEsIDEsIDEsIDEpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVSYW5nZShuZXcgUmFuZ2UoMCwgMCwgMCwgNykpLCBuZXcgUmFuZ2UoMSwgMSwgMSwgMSkpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLnZhbGlkYXRlUmFuZ2UobmV3IFJhbmdlKDEsIDEsIDEsIDEpKSwgbmV3IFJhbmdlKDEsIDEsIDEsIDEpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVSYW5nZShuZXcgUmFuZ2UoMSwgMSwgMSwgMikpLCBuZXcgUmFuZ2UoMSwgMSwgMSwgMikpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVJhbmdlKG5ldyBSYW5nZSgxLCAxLCAxLCAzKSksIG5ldyBSYW5nZSgxLCAxLCAxLCA0KSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLnZhbGlkYXRlUmFuZ2UobmV3IFJhbmdlKDEsIDEsIDEsIDQpKSwgbmV3IFJhbmdlKDEsIDEsIDEsIDQpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVSYW5nZShuZXcgUmFuZ2UoMSwgMSwgMSwgNSkpLCBuZXcgUmFuZ2UoMSwgMSwgMSwgNSkpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLnZhbGlkYXRlUmFuZ2UobmV3IFJhbmdlKDEsIDIsIDEsIDIpKSwgbmV3IFJhbmdlKDEsIDIsIDEsIDIpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVSYW5nZShuZXcgUmFuZ2UoMSwgMiwgMSwgMykpLCBuZXcgUmFuZ2UoMSwgMiwgMSwgNCkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVJhbmdlKG5ldyBSYW5nZSgxLCAyLCAxLCA0KSksIG5ldyBSYW5nZSgxLCAyLCAxLCA0KSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLnZhbGlkYXRlUmFuZ2UobmV3IFJhbmdlKDEsIDIsIDEsIDUpKSwgbmV3IFJhbmdlKDEsIDIsIDEsIDUpKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVJhbmdlKG5ldyBSYW5nZSgxLCAzLCAxLCAzKSksIG5ldyBSYW5nZSgxLCAyLCAxLCAyKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLnZhbGlkYXRlUmFuZ2UobmV3IFJhbmdlKDEsIDMsIDEsIDQpKSwgbmV3IFJhbmdlKDEsIDIsIDEsIDQpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVSYW5nZShuZXcgUmFuZ2UoMSwgMywgMSwgNSkpLCBuZXcgUmFuZ2UoMSwgMiwgMSwgNSkpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLnZhbGlkYXRlUmFuZ2UobmV3IFJhbmdlKDEsIDQsIDEsIDQpKSwgbmV3IFJhbmdlKDEsIDQsIDEsIDQpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVSYW5nZShuZXcgUmFuZ2UoMSwgNCwgMSwgNSkpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNSkpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLnZhbGlkYXRlUmFuZ2UobmV3IFJhbmdlKDEsIDUsIDEsIDUpKSwgbmV3IFJhbmdlKDEsIDUsIDEsIDUpKTtcblxuXHRcdG0uZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCd2YWxpZGF0ZVJhbmdlIGFyb3VuZCBoaWdoLWxvdyBzdXJyb2dhdGUgcGFpcnMgMicsICgpID0+IHtcblxuXHRcdGNvbnN0IG0gPSBjcmVhdGVUZXh0TW9kZWwoJ2FcdUQ4M0RcdURDREFcdUQ4M0RcdURDREFiJyk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVSYW5nZShuZXcgUmFuZ2UoMCwgMCwgMCwgMSkpLCBuZXcgUmFuZ2UoMSwgMSwgMSwgMSkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVJhbmdlKG5ldyBSYW5nZSgwLCAwLCAwLCA3KSksIG5ldyBSYW5nZSgxLCAxLCAxLCAxKSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVSYW5nZShuZXcgUmFuZ2UoMSwgMSwgMSwgMSkpLCBuZXcgUmFuZ2UoMSwgMSwgMSwgMSkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVJhbmdlKG5ldyBSYW5nZSgxLCAxLCAxLCAyKSksIG5ldyBSYW5nZSgxLCAxLCAxLCAyKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLnZhbGlkYXRlUmFuZ2UobmV3IFJhbmdlKDEsIDEsIDEsIDMpKSwgbmV3IFJhbmdlKDEsIDEsIDEsIDQpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVSYW5nZShuZXcgUmFuZ2UoMSwgMSwgMSwgNCkpLCBuZXcgUmFuZ2UoMSwgMSwgMSwgNCkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVJhbmdlKG5ldyBSYW5nZSgxLCAxLCAxLCA1KSksIG5ldyBSYW5nZSgxLCAxLCAxLCA2KSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLnZhbGlkYXRlUmFuZ2UobmV3IFJhbmdlKDEsIDEsIDEsIDYpKSwgbmV3IFJhbmdlKDEsIDEsIDEsIDYpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVSYW5nZShuZXcgUmFuZ2UoMSwgMSwgMSwgNykpLCBuZXcgUmFuZ2UoMSwgMSwgMSwgNykpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLnZhbGlkYXRlUmFuZ2UobmV3IFJhbmdlKDEsIDIsIDEsIDIpKSwgbmV3IFJhbmdlKDEsIDIsIDEsIDIpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVSYW5nZShuZXcgUmFuZ2UoMSwgMiwgMSwgMykpLCBuZXcgUmFuZ2UoMSwgMiwgMSwgNCkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVJhbmdlKG5ldyBSYW5nZSgxLCAyLCAxLCA0KSksIG5ldyBSYW5nZSgxLCAyLCAxLCA0KSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLnZhbGlkYXRlUmFuZ2UobmV3IFJhbmdlKDEsIDIsIDEsIDUpKSwgbmV3IFJhbmdlKDEsIDIsIDEsIDYpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVSYW5nZShuZXcgUmFuZ2UoMSwgMiwgMSwgNikpLCBuZXcgUmFuZ2UoMSwgMiwgMSwgNikpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVJhbmdlKG5ldyBSYW5nZSgxLCAyLCAxLCA3KSksIG5ldyBSYW5nZSgxLCAyLCAxLCA3KSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVSYW5nZShuZXcgUmFuZ2UoMSwgMywgMSwgMykpLCBuZXcgUmFuZ2UoMSwgMiwgMSwgMikpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVJhbmdlKG5ldyBSYW5nZSgxLCAzLCAxLCA0KSksIG5ldyBSYW5nZSgxLCAyLCAxLCA0KSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLnZhbGlkYXRlUmFuZ2UobmV3IFJhbmdlKDEsIDMsIDEsIDUpKSwgbmV3IFJhbmdlKDEsIDIsIDEsIDYpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVSYW5nZShuZXcgUmFuZ2UoMSwgMywgMSwgNikpLCBuZXcgUmFuZ2UoMSwgMiwgMSwgNikpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVJhbmdlKG5ldyBSYW5nZSgxLCAzLCAxLCA3KSksIG5ldyBSYW5nZSgxLCAyLCAxLCA3KSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVSYW5nZShuZXcgUmFuZ2UoMSwgNCwgMSwgNCkpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNCkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVJhbmdlKG5ldyBSYW5nZSgxLCA0LCAxLCA1KSksIG5ldyBSYW5nZSgxLCA0LCAxLCA2KSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLnZhbGlkYXRlUmFuZ2UobmV3IFJhbmdlKDEsIDQsIDEsIDYpKSwgbmV3IFJhbmdlKDEsIDQsIDEsIDYpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVSYW5nZShuZXcgUmFuZ2UoMSwgNCwgMSwgNykpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNykpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLnZhbGlkYXRlUmFuZ2UobmV3IFJhbmdlKDEsIDUsIDEsIDUpKSwgbmV3IFJhbmdlKDEsIDQsIDEsIDQpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVSYW5nZShuZXcgUmFuZ2UoMSwgNSwgMSwgNikpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNikpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVJhbmdlKG5ldyBSYW5nZSgxLCA1LCAxLCA3KSksIG5ldyBSYW5nZSgxLCA0LCAxLCA3KSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVSYW5nZShuZXcgUmFuZ2UoMSwgNiwgMSwgNikpLCBuZXcgUmFuZ2UoMSwgNiwgMSwgNikpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS52YWxpZGF0ZVJhbmdlKG5ldyBSYW5nZSgxLCA2LCAxLCA3KSksIG5ldyBSYW5nZSgxLCA2LCAxLCA3KSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udmFsaWRhdGVSYW5nZShuZXcgUmFuZ2UoMSwgNywgMSwgNykpLCBuZXcgUmFuZ2UoMSwgNywgMSwgNykpO1xuXG5cdFx0bS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vZGlmeVBvc2l0aW9uJywgKCkgPT4ge1xuXG5cdFx0Y29uc3QgbSA9IGNyZWF0ZVRleHRNb2RlbCgnbGluZSBvbmVcXG5saW5lIHR3bycpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS5tb2RpZnlQb3NpdGlvbihuZXcgUG9zaXRpb24oMSwgMSksIDApLCBuZXcgUG9zaXRpb24oMSwgMSkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS5tb2RpZnlQb3NpdGlvbihuZXcgUG9zaXRpb24oMCwgMCksIDApLCBuZXcgUG9zaXRpb24oMSwgMSkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS5tb2RpZnlQb3NpdGlvbihuZXcgUG9zaXRpb24oMzAsIDEpLCAwKSwgbmV3IFBvc2l0aW9uKDIsIDkpKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS5tb2RpZnlQb3NpdGlvbihuZXcgUG9zaXRpb24oMSwgMSksIDE3KSwgbmV3IFBvc2l0aW9uKDIsIDkpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0ubW9kaWZ5UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDEpLCAxKSwgbmV3IFBvc2l0aW9uKDEsIDIpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0ubW9kaWZ5UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDEpLCAzKSwgbmV3IFBvc2l0aW9uKDEsIDQpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0ubW9kaWZ5UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDIpLCAxMCksIG5ldyBQb3NpdGlvbigyLCAzKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLm1vZGlmeVBvc2l0aW9uKG5ldyBQb3NpdGlvbigxLCA1KSwgMTMpLCBuZXcgUG9zaXRpb24oMiwgOSkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS5tb2RpZnlQb3NpdGlvbihuZXcgUG9zaXRpb24oMSwgMiksIDE2KSwgbmV3IFBvc2l0aW9uKDIsIDkpKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS5tb2RpZnlQb3NpdGlvbihuZXcgUG9zaXRpb24oMiwgOSksIC0xNyksIG5ldyBQb3NpdGlvbigxLCAxKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLm1vZGlmeVBvc2l0aW9uKG5ldyBQb3NpdGlvbigxLCAyKSwgLTEpLCBuZXcgUG9zaXRpb24oMSwgMSkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS5tb2RpZnlQb3NpdGlvbihuZXcgUG9zaXRpb24oMSwgNCksIC0zKSwgbmV3IFBvc2l0aW9uKDEsIDEpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0ubW9kaWZ5UG9zaXRpb24obmV3IFBvc2l0aW9uKDIsIDMpLCAtMTApLCBuZXcgUG9zaXRpb24oMSwgMikpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS5tb2RpZnlQb3NpdGlvbihuZXcgUG9zaXRpb24oMiwgOSksIC0xMyksIG5ldyBQb3NpdGlvbigxLCA1KSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLm1vZGlmeVBvc2l0aW9uKG5ldyBQb3NpdGlvbigyLCA5KSwgLTE2KSwgbmV3IFBvc2l0aW9uKDEsIDIpKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS5tb2RpZnlQb3NpdGlvbihuZXcgUG9zaXRpb24oMSwgMiksIDE3KSwgbmV3IFBvc2l0aW9uKDIsIDkpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0ubW9kaWZ5UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDIpLCAxMDApLCBuZXcgUG9zaXRpb24oMiwgOSkpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLm1vZGlmeVBvc2l0aW9uKG5ldyBQb3NpdGlvbigxLCAyKSwgLTIpLCBuZXcgUG9zaXRpb24oMSwgMSkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS5tb2RpZnlQb3NpdGlvbihuZXcgUG9zaXRpb24oMSwgMiksIC0xMDApLCBuZXcgUG9zaXRpb24oMSwgMSkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS5tb2RpZnlQb3NpdGlvbihuZXcgUG9zaXRpb24oMiwgMiksIC0xMDApLCBuZXcgUG9zaXRpb24oMSwgMSkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS5tb2RpZnlQb3NpdGlvbihuZXcgUG9zaXRpb24oMiwgOSksIC0xOCksIG5ldyBQb3NpdGlvbigxLCAxKSk7XG5cblx0XHRtLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnbm9ybWFsaXplSW5kZW50YXRpb24gMScsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbCgnJyxcblx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdHtcblx0XHRcdFx0aW5zZXJ0U3BhY2VzOiBmYWxzZVxuXHRcdFx0fVxuXHRcdCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwubm9ybWFsaXplSW5kZW50YXRpb24oJ1xcdCcpLCAnXFx0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLm5vcm1hbGl6ZUluZGVudGF0aW9uKCcgICAgJyksICdcXHQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwubm9ybWFsaXplSW5kZW50YXRpb24oJyAgICcpLCAnICAgJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLm5vcm1hbGl6ZUluZGVudGF0aW9uKCcgICcpLCAnICAnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwubm9ybWFsaXplSW5kZW50YXRpb24oJyAnKSwgJyAnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwubm9ybWFsaXplSW5kZW50YXRpb24oJycpLCAnJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLm5vcm1hbGl6ZUluZGVudGF0aW9uKCcgXFx0ICAgICcpLCAnXFx0XFx0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLm5vcm1hbGl6ZUluZGVudGF0aW9uKCcgXFx0ICAgJyksICdcXHQgICAnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwubm9ybWFsaXplSW5kZW50YXRpb24oJyBcXHQgICcpLCAnXFx0ICAnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwubm9ybWFsaXplSW5kZW50YXRpb24oJyBcXHQgJyksICdcXHQgJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLm5vcm1hbGl6ZUluZGVudGF0aW9uKCcgXFx0JyksICdcXHQnKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5ub3JtYWxpemVJbmRlbnRhdGlvbignXFx0YScpLCAnXFx0YScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5ub3JtYWxpemVJbmRlbnRhdGlvbignICAgIGEnKSwgJ1xcdGEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwubm9ybWFsaXplSW5kZW50YXRpb24oJyAgIGEnKSwgJyAgIGEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwubm9ybWFsaXplSW5kZW50YXRpb24oJyAgYScpLCAnICBhJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLm5vcm1hbGl6ZUluZGVudGF0aW9uKCcgYScpLCAnIGEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwubm9ybWFsaXplSW5kZW50YXRpb24oJ2EnKSwgJ2EnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwubm9ybWFsaXplSW5kZW50YXRpb24oJyBcXHQgICAgYScpLCAnXFx0XFx0YScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5ub3JtYWxpemVJbmRlbnRhdGlvbignIFxcdCAgIGEnKSwgJ1xcdCAgIGEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwubm9ybWFsaXplSW5kZW50YXRpb24oJyBcXHQgIGEnKSwgJ1xcdCAgYScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5ub3JtYWxpemVJbmRlbnRhdGlvbignIFxcdCBhJyksICdcXHQgYScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5ub3JtYWxpemVJbmRlbnRhdGlvbignIFxcdGEnKSwgJ1xcdGEnKTtcblxuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnbm9ybWFsaXplSW5kZW50YXRpb24gMicsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbCgnJyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwubm9ybWFsaXplSW5kZW50YXRpb24oJ1xcdGEnKSwgJyAgICBhJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLm5vcm1hbGl6ZUluZGVudGF0aW9uKCcgICAgYScpLCAnICAgIGEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwubm9ybWFsaXplSW5kZW50YXRpb24oJyAgIGEnKSwgJyAgIGEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwubm9ybWFsaXplSW5kZW50YXRpb24oJyAgYScpLCAnICBhJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLm5vcm1hbGl6ZUluZGVudGF0aW9uKCcgYScpLCAnIGEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwubm9ybWFsaXplSW5kZW50YXRpb24oJ2EnKSwgJ2EnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwubm9ybWFsaXplSW5kZW50YXRpb24oJyBcXHQgICAgYScpLCAnICAgICAgICBhJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLm5vcm1hbGl6ZUluZGVudGF0aW9uKCcgXFx0ICAgYScpLCAnICAgICAgIGEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwubm9ybWFsaXplSW5kZW50YXRpb24oJyBcXHQgIGEnKSwgJyAgICAgIGEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwubm9ybWFsaXplSW5kZW50YXRpb24oJyBcXHQgYScpLCAnICAgICBhJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLm5vcm1hbGl6ZUluZGVudGF0aW9uKCcgXFx0YScpLCAnICAgIGEnKTtcblxuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnZ2V0TGluZUZpcnN0Tm9uV2hpdGVzcGFjZUNvbHVtbicsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChbXG5cdFx0XHQnYXNkJyxcblx0XHRcdCcgYXNkJyxcblx0XHRcdCdcXHRhc2QnLFxuXHRcdFx0JyAgYXNkJyxcblx0XHRcdCdcXHRcXHRhc2QnLFxuXHRcdFx0JyAnLFxuXHRcdFx0JyAgJyxcblx0XHRcdCdcXHQnLFxuXHRcdFx0J1xcdFxcdCcsXG5cdFx0XHQnICBcXHRhc2QnLFxuXHRcdFx0JycsXG5cdFx0XHQnJ1xuXHRcdF0uam9pbignXFxuJykpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVGaXJzdE5vbldoaXRlc3BhY2VDb2x1bW4oMSksIDEsICcxJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVGaXJzdE5vbldoaXRlc3BhY2VDb2x1bW4oMiksIDIsICcyJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVGaXJzdE5vbldoaXRlc3BhY2VDb2x1bW4oMyksIDIsICczJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVGaXJzdE5vbldoaXRlc3BhY2VDb2x1bW4oNCksIDMsICc0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVGaXJzdE5vbldoaXRlc3BhY2VDb2x1bW4oNSksIDMsICc1Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVGaXJzdE5vbldoaXRlc3BhY2VDb2x1bW4oNiksIDAsICc2Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVGaXJzdE5vbldoaXRlc3BhY2VDb2x1bW4oNyksIDAsICc3Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVGaXJzdE5vbldoaXRlc3BhY2VDb2x1bW4oOCksIDAsICc4Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVGaXJzdE5vbldoaXRlc3BhY2VDb2x1bW4oOSksIDAsICc5Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVGaXJzdE5vbldoaXRlc3BhY2VDb2x1bW4oMTApLCA0LCAnMTAnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUZpcnN0Tm9uV2hpdGVzcGFjZUNvbHVtbigxMSksIDAsICcxMScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lRmlyc3ROb25XaGl0ZXNwYWNlQ29sdW1uKDEyKSwgMCwgJzEyJyk7XG5cblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2dldExpbmVMYXN0Tm9uV2hpdGVzcGFjZUNvbHVtbicsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChbXG5cdFx0XHQnYXNkJyxcblx0XHRcdCdhc2QgJyxcblx0XHRcdCdhc2RcXHQnLFxuXHRcdFx0J2FzZCAgJyxcblx0XHRcdCdhc2RcXHRcXHQnLFxuXHRcdFx0JyAnLFxuXHRcdFx0JyAgJyxcblx0XHRcdCdcXHQnLFxuXHRcdFx0J1xcdFxcdCcsXG5cdFx0XHQnYXNkICBcXHQnLFxuXHRcdFx0JycsXG5cdFx0XHQnJ1xuXHRcdF0uam9pbignXFxuJykpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVMYXN0Tm9uV2hpdGVzcGFjZUNvbHVtbigxKSwgNCwgJzEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUxhc3ROb25XaGl0ZXNwYWNlQ29sdW1uKDIpLCA0LCAnMicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lTGFzdE5vbldoaXRlc3BhY2VDb2x1bW4oMyksIDQsICczJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVMYXN0Tm9uV2hpdGVzcGFjZUNvbHVtbig0KSwgNCwgJzQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUxhc3ROb25XaGl0ZXNwYWNlQ29sdW1uKDUpLCA0LCAnNScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lTGFzdE5vbldoaXRlc3BhY2VDb2x1bW4oNiksIDAsICc2Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVMYXN0Tm9uV2hpdGVzcGFjZUNvbHVtbig3KSwgMCwgJzcnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUxhc3ROb25XaGl0ZXNwYWNlQ29sdW1uKDgpLCAwLCAnOCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lTGFzdE5vbldoaXRlc3BhY2VDb2x1bW4oOSksIDAsICc5Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVMYXN0Tm9uV2hpdGVzcGFjZUNvbHVtbigxMCksIDQsICcxMCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lTGFzdE5vbldoaXRlc3BhY2VDb2x1bW4oMTEpLCAwLCAnMTEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUxhc3ROb25XaGl0ZXNwYWNlQ29sdW1uKDEyKSwgMCwgJzEyJyk7XG5cblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJyM1MDQ3MS4gZ2V0VmFsdWVJblJhbmdlIHdpdGggaW52YWxpZCByYW5nZScsICgpID0+IHtcblx0XHRjb25zdCBtID0gY3JlYXRlVGV4dE1vZGVsKCdNeSBGaXJzdCBMaW5lXFxyXFxuTXkgU2Vjb25kIExpbmVcXHJcXG5NeSBUaGlyZCBMaW5lJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG0uZ2V0VmFsdWVJblJhbmdlKG5ldyBSYW5nZSgxLCBOYU4sIDEsIDMpKSwgJ015Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG0uZ2V0VmFsdWVJblJhbmdlKG5ldyBSYW5nZShOYU4sIE5hTiwgTmFOLCBOYU4pKSwgJycpO1xuXHRcdG0uZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTY4ODM2OiB1cGRhdGluZyB0YWJTaXplIHNob3VsZCBhbHNvIHVwZGF0ZSBpbmRlbnRTaXplIHdoZW4gaW5kZW50U2l6ZSBpcyBzZXQgdG8gXCJ0YWJTaXplXCInLCAoKSA9PiB7XG5cdFx0Y29uc3QgbSA9IGNyZWF0ZVRleHRNb2RlbCgnc29tZSB0ZXh0JywgbnVsbCwge1xuXHRcdFx0dGFiU2l6ZTogMixcblx0XHRcdGluZGVudFNpemU6ICd0YWJTaXplJ1xuXHRcdH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtLmdldE9wdGlvbnMoKS50YWJTaXplLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobS5nZXRPcHRpb25zKCkuaW5kZW50U2l6ZSwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG0uZ2V0T3B0aW9ucygpLm9yaWdpbmFsSW5kZW50U2l6ZSwgJ3RhYlNpemUnKTtcblx0XHRtLnVwZGF0ZU9wdGlvbnMoe1xuXHRcdFx0dGFiU2l6ZTogNFxuXHRcdH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtLmdldE9wdGlvbnMoKS50YWJTaXplLCA0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobS5nZXRPcHRpb25zKCkuaW5kZW50U2l6ZSwgNCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG0uZ2V0T3B0aW9ucygpLm9yaWdpbmFsSW5kZW50U2l6ZSwgJ3RhYlNpemUnKTtcblx0XHRtLmRpc3Bvc2UoKTtcblx0fSk7XG59KTtcblxuc3VpdGUoJ1RleHRNb2RlbC5taWdodENvbnRhaW5SVEwnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnbm9wZScsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbCgnaGVsbG8gd29ybGQhJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLm1pZ2h0Q29udGFpblJUTCgpLCBmYWxzZSk7XG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCd5ZXMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoJ0hlbGxvLFxcblx1MDVENlx1MDVENVx1MDVENFx1MDVEOSBcdTA1RTJcdTA1RDVcdTA1RDFcdTA1RDNcdTA1RDQgXHUwNURFXHUwNUQxXHUwNUQ1XHUwNUUxXHUwNUUxXHUwNUVBIFx1MDVFOVx1MDVEM1x1MDVFMlx1MDVFQVx1MDVENScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5taWdodENvbnRhaW5SVEwoKSwgdHJ1ZSk7XG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdzZXRWYWx1ZSByZXNldHMgMScsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbCgnaGVsbG8gd29ybGQhJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLm1pZ2h0Q29udGFpblJUTCgpLCBmYWxzZSk7XG5cdFx0bW9kZWwuc2V0VmFsdWUoJ0hlbGxvLFxcblx1MDVENlx1MDVENVx1MDVENFx1MDVEOSBcdTA1RTJcdTA1RDVcdTA1RDFcdTA1RDNcdTA1RDQgXHUwNURFXHUwNUQxXHUwNUQ1XHUwNUUxXHUwNUUxXHUwNUVBIFx1MDVFOVx1MDVEM1x1MDVFMlx1MDVFQVx1MDVENScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5taWdodENvbnRhaW5SVEwoKSwgdHJ1ZSk7XG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdzZXRWYWx1ZSByZXNldHMgMicsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbCgnSGVsbG8sXFxuXHUwNjQ3XHUwNjQ2XHUwNjI3XHUwNjQzIFx1MDYyRFx1MDY0Mlx1MDY0QVx1MDY0Mlx1MDYyOSBcdTA2NDVcdTA2MkJcdTA2MjhcdTA2MkFcdTA2MjkgXHUwNjQ1XHUwNjQ2XHUwNjMwIFx1MDYzMlx1MDY0NVx1MDY0NiBcdTA2MzdcdTA2NDhcdTA2NEFcdTA2NDQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwubWlnaHRDb250YWluUlRMKCksIHRydWUpO1xuXHRcdG1vZGVsLnNldFZhbHVlKCdoZWxsbyB3b3JsZCEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwubWlnaHRDb250YWluUlRMKCksIGZhbHNlKTtcblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdH0pO1xuXG59KTtcblxuc3VpdGUoJ1RleHRNb2RlbC5jcmVhdGVTbmFwc2hvdCcsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdlbXB0eSBmaWxlJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKCcnKTtcblx0XHRjb25zdCBzbmFwc2hvdCA9IG1vZGVsLmNyZWF0ZVNuYXBzaG90KCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNuYXBzaG90LnJlYWQoKSwgbnVsbCk7XG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdmaWxlIHdpdGggQk9NJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFVURjhfQk9NX0NIQVJBQ1RFUiArICdIZWxsbycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ0hlbGxvJyk7XG5cdFx0Y29uc3Qgc25hcHNob3QgPSBtb2RlbC5jcmVhdGVTbmFwc2hvdCh0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc25hcHNob3QucmVhZCgpLCBVVEY4X0JPTV9DSEFSQUNURVIgKyAnSGVsbG8nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc25hcHNob3QucmVhZCgpLCBudWxsKTtcblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlZ3VsYXIgZmlsZScsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbCgnTXkgRmlyc3QgTGluZVxcblxcdFxcdE15IFNlY29uZCBMaW5lXFxuICAgIFRoaXJkIExpbmVcXG5cXG4xJyk7XG5cdFx0Y29uc3Qgc25hcHNob3QgPSBtb2RlbC5jcmVhdGVTbmFwc2hvdCgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzbmFwc2hvdC5yZWFkKCksICdNeSBGaXJzdCBMaW5lXFxuXFx0XFx0TXkgU2Vjb25kIExpbmVcXG4gICAgVGhpcmQgTGluZVxcblxcbjEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc25hcHNob3QucmVhZCgpLCBudWxsKTtcblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2xhcmdlIGZpbGUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbGluZXM6IHN0cmluZ1tdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCAxMDAwOyBpKyspIHtcblx0XHRcdGxpbmVzW2ldID0gJ0p1c3Qgc29tZSB0ZXh0IHRoYXQgaXMgYSBiaXQgbG9uZyBzdWNoIHRoYXQgaXQgY2FuIGNvbnN1bWUgc29tZSBtZW1vcnknO1xuXHRcdH1cblx0XHRjb25zdCB0ZXh0ID0gbGluZXMuam9pbignXFxuJyk7XG5cblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbCh0ZXh0KTtcblx0XHRjb25zdCBzbmFwc2hvdCA9IG1vZGVsLmNyZWF0ZVNuYXBzaG90KCk7XG5cdFx0bGV0IGFjdHVhbCA9ICcnO1xuXG5cdFx0Ly8gNzA5OTkgbGVuZ3RoID0+IGF0IG1vc3QgMiByZWFkIGNhbGxzIGFyZSBuZWNlc3Nhcnlcblx0XHRjb25zdCB0bXAxID0gc25hcHNob3QucmVhZCgpO1xuXHRcdGFzc2VydC5vayh0bXAxKTtcblx0XHRhY3R1YWwgKz0gdG1wMTtcblxuXHRcdGNvbnN0IHRtcDIgPSBzbmFwc2hvdC5yZWFkKCk7XG5cdFx0aWYgKHRtcDIgPT09IG51bGwpIHtcblx0XHRcdC8vIGFsbCBnb29kXG5cdFx0fSBlbHNlIHtcblx0XHRcdGFjdHVhbCArPSB0bXAyO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNuYXBzaG90LnJlYWQoKSwgbnVsbCk7XG5cdFx0fVxuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbCwgdGV4dCk7XG5cblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxMTk2MzI6IGludmFsaWQgcmFuZ2UnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoJ2hlbGxvIHdvcmxkIScpO1xuXHRcdGNvbnN0IGFjdHVhbCA9IG1vZGVsLl92YWxpZGF0ZVJhbmdlUmVsYXhlZE5vQWxsb2NhdGlvbnMobmV3IFJhbmdlKDxhbnk+dW5kZWZpbmVkLCAwLCA8YW55PnVuZGVmaW5lZCwgMSkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBuZXcgUmFuZ2UoMSwgMSwgMSwgMSkpO1xuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0fSk7XG5cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsK0NBQStDO0FB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TUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsR0FBRyxLQUFLO0FBRVIsZ0JBQVksT0FBTyxRQUFXO0FBQUEsTUFDN0I7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNELEdBQUcsT0FBTztBQUVWLGdCQUFZLFFBQVcsQ0FBQyxDQUFDLEdBQUc7QUFBQSxNQUMzQjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNELEdBQUcsWUFBWTtBQUNmLGdCQUFZLE9BQU8sUUFBVztBQUFBLE1BQzdCO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsR0FBRyxZQUFZO0FBQ2YsZ0JBQVksT0FBTyxRQUFXO0FBQUEsTUFDN0I7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsR0FBRyxZQUFZO0FBQ2YsZ0JBQVksT0FBTyxRQUFXO0FBQUEsTUFDN0I7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsR0FBRyxZQUFZO0FBQ2YsZ0JBQVksT0FBTyxRQUFXO0FBQUEsTUFDN0I7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsR0FBRyxZQUFZO0FBQ2YsZ0JBQVksT0FBTyxRQUFXO0FBQUEsTUFDN0I7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsR0FBRyxpQkFBaUI7QUFFcEIsZ0JBQVksUUFBVyxRQUFXO0FBQUEsTUFDakM7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRCxHQUFHLGtEQUFrRDtBQUNyRCxnQkFBWSxNQUFNLFFBQVc7QUFBQSxNQUM1QjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNELEdBQUcsV0FBVztBQUNkLGdCQUFZLFFBQVcsUUFBVztBQUFBLE1BQ2pDO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsR0FBRyw4QkFBK0I7QUFDbEMsZ0JBQVksTUFBTSxHQUFHO0FBQUEsTUFDcEI7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsR0FBRyxVQUFVO0FBQ2IsZ0JBQVksTUFBTSxHQUFHO0FBQUEsTUFDcEI7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsR0FBRyxVQUFVO0FBQ2IsZ0JBQVksTUFBTSxHQUFHO0FBQUEsTUFDcEI7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsR0FBRyxlQUFlO0FBQ2xCLGdCQUFZLE1BQU0sR0FBRztBQUFBLE1BQ3BCO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRCxHQUFHLEtBQUs7QUFFUixnQkFBWSxNQUFNLEdBQUc7QUFBQSxNQUNwQjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRCxHQUFHLEtBQUs7QUFDUixnQkFBWSxNQUFNLEdBQUc7QUFBQSxNQUNwQjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRCxHQUFHLFVBQVU7QUFDYixnQkFBWSxNQUFNLEdBQUc7QUFBQSxNQUNwQjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRCxHQUFHLFVBQVU7QUFDYixnQkFBWSxNQUFNLEdBQUc7QUFBQSxNQUNwQjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsR0FBRyxVQUFVO0FBQ2IsZ0JBQVksTUFBTSxHQUFHO0FBQUEsTUFDcEI7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRCxHQUFHLFVB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LEVBQUUsR0FBRyxHQUFHLElBQUk7QUFDckUsV0FBTyxZQUFZLE1BQU0sZ0NBQWdDLEVBQUUsR0FBRyxHQUFHLElBQUk7QUFDckUsV0FBTyxZQUFZLE1BQU0sZ0NBQWdDLEVBQUUsR0FBRyxHQUFHLElBQUk7QUFFckUsVUFBTSxRQUFRO0FBQUEsRUFDZixDQUFDO0FBRUQsT0FBSyxrQ0FBa0MsTUFBTTtBQUM1QyxVQUFNLFFBQVEsZ0JBQWdCO0FBQUEsTUFDN0I7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsRUFBRSxLQUFLLElBQUksQ0FBQztBQUVaLFdBQU8sWUFBWSxNQUFNLCtCQUErQixDQUFDLEdBQUcsR0FBRyxHQUFHO0FBQ2xFLFdBQU8sWUFBWSxNQUFNLCtCQUErQixDQUFDLEdBQUcsR0FBRyxHQUFHO0FBQ2xFLFdBQU8sWUFBWSxNQUFNLCtCQUErQixDQUFDLEdBQUcsR0FBRyxHQUFHO0FBQ2xFLFdBQU8sWUFBWSxNQUFNLCtCQUErQixDQUFDLEdBQUcsR0FBRyxHQUFHO0FBQ2xFLFdBQU8sWUFBWSxNQUFNLCtCQUErQixDQUFDLEdBQUcsR0FBRyxHQUFHO0FBQ2xFLFdBQU8sWUFBWSxNQUFNLCtCQUErQixDQUFDLEdBQUcsR0FBRyxHQUFHO0FBQ2xFLFdBQU8sWUFBWSxNQUFNLCtCQUErQixDQUFDLEdBQUcsR0FBRyxHQUFHO0FBQ2xFLFdBQU8sWUFBWSxNQUFNLCtCQUErQixDQUFDLEdBQUcsR0FBRyxHQUFHO0FBQ2xFLFdBQU8sWUFBWSxNQUFNLCtCQUErQixDQUFDLEdBQUcsR0FBRyxHQUFHO0FBQ2xFLFdBQU8sWUFBWSxNQUFNLCtCQUErQixFQUFFLEdBQUcsR0FBRyxJQUFJO0FBQ3BFLFdBQU8sWUFBWSxNQUFNLCtCQUErQixFQUFFLEdBQUcsR0FBRyxJQUFJO0FBQ3BFLFdBQU8sWUFBWSxNQUFNLCtCQUErQixF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
