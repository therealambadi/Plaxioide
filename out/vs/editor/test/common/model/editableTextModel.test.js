import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { Range } from "../../../common/core/range.js";
import { EndOfLinePreference, EndOfLineSequence } from "../../../common/model.js";
import { MirrorTextModel } from "../../../common/model/mirrorTextModel.js";
import { assertSyncedModels, testApplyEditsWithSyncedModels } from "./editableTextModelTestUtils.js";
import { createTextModel } from "../testTextModel.js";
suite("EditorModel - EditableTextModel.applyEdits updates mightContainRTL", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  function testApplyEdits(original, edits, before, after) {
    const model = createTextModel(original.join("\n"));
    model.setEOL(EndOfLineSequence.LF);
    assert.strictEqual(model.mightContainRTL(), before);
    model.applyEdits(edits);
    assert.strictEqual(model.mightContainRTL(), after);
    model.dispose();
  }
  function editOp(startLineNumber, startColumn, endLineNumber, endColumn, text) {
    return {
      range: new Range(startLineNumber, startColumn, endLineNumber, endColumn),
      text: text.join("\n")
    };
  }
  test("start with RTL, insert LTR", () => {
    testApplyEdits(["Hello,\n\u05D6\u05D5\u05D4\u05D9 \u05E2\u05D5\u05D1\u05D3\u05D4 \u05DE\u05D1\u05D5\u05E1\u05E1\u05EA \u05E9\u05D3\u05E2\u05EA\u05D5"], [editOp(1, 1, 1, 1, ["hello"])], true, true);
  });
  test("start with RTL, delete RTL", () => {
    testApplyEdits(["Hello,\n\u05D6\u05D5\u05D4\u05D9 \u05E2\u05D5\u05D1\u05D3\u05D4 \u05DE\u05D1\u05D5\u05E1\u05E1\u05EA \u05E9\u05D3\u05E2\u05EA\u05D5"], [editOp(1, 1, 10, 10, [""])], true, true);
  });
  test("start with RTL, insert RTL", () => {
    testApplyEdits(["Hello,\n\u05D6\u05D5\u05D4\u05D9 \u05E2\u05D5\u05D1\u05D3\u05D4 \u05DE\u05D1\u05D5\u05E1\u05E1\u05EA \u05E9\u05D3\u05E2\u05EA\u05D5"], [editOp(1, 1, 1, 1, ["\u0647\u0646\u0627\u0643 \u062D\u0642\u064A\u0642\u0629 \u0645\u062B\u0628\u062A\u0629 \u0645\u0646\u0630 \u0632\u0645\u0646 \u0637\u0648\u064A\u0644"])], true, true);
  });
  test("start with LTR, insert LTR", () => {
    testApplyEdits(["Hello,\nworld!"], [editOp(1, 1, 1, 1, ["hello"])], false, false);
  });
  test("start with LTR, insert RTL 1", () => {
    testApplyEdits(["Hello,\nworld!"], [editOp(1, 1, 1, 1, ["\u0647\u0646\u0627\u0643 \u062D\u0642\u064A\u0642\u0629 \u0645\u062B\u0628\u062A\u0629 \u0645\u0646\u0630 \u0632\u0645\u0646 \u0637\u0648\u064A\u0644"])], false, true);
  });
  test("start with LTR, insert RTL 2", () => {
    testApplyEdits(["Hello,\nworld!"], [editOp(1, 1, 1, 1, ["\u05D6\u05D5\u05D4\u05D9 \u05E2\u05D5\u05D1\u05D3\u05D4 \u05DE\u05D1\u05D5\u05E1\u05E1\u05EA \u05E9\u05D3\u05E2\u05EA\u05D5"])], false, true);
  });
});
suite("EditorModel - EditableTextModel.applyEdits updates mightContainNonBasicASCII", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  function testApplyEdits(original, edits, before, after) {
    const model = createTextModel(original.join("\n"));
    model.setEOL(EndOfLineSequence.LF);
    assert.strictEqual(model.mightContainNonBasicASCII(), before);
    model.applyEdits(edits);
    assert.strictEqual(model.mightContainNonBasicASCII(), after);
    model.dispose();
  }
  function editOp(startLineNumber, startColumn, endLineNumber, endColumn, text) {
    return {
      range: new Range(startLineNumber, startColumn, endLineNumber, endColumn),
      text: text.join("\n")
    };
  }
  test("start with NON-ASCII, insert ASCII", () => {
    testApplyEdits(["Hello,\nZ\xFCrich"], [editOp(1, 1, 1, 1, ["hello", "second line"])], true, true);
  });
  test("start with NON-ASCII, delete NON-ASCII", () => {
    testApplyEdits(["Hello,\nZ\xFCrich"], [editOp(1, 1, 10, 10, [""])], true, true);
  });
  test("start with NON-ASCII, insert NON-ASCII", () => {
    testApplyEdits(["Hello,\nZ\xFCrich"], [editOp(1, 1, 1, 1, ["Z\xFCrich"])], true, true);
  });
  test("start with ASCII, insert ASCII", () => {
    testApplyEdits(["Hello,\nworld!"], [editOp(1, 1, 1, 1, ["hello", "second line"])], false, false);
  });
  test("start with ASCII, insert NON-ASCII", () => {
    testApplyEdits(["Hello,\nworld!"], [editOp(1, 1, 1, 1, ["Z\xFCrich", "Z\xFCrich"])], false, true);
  });
});
suite("EditorModel - EditableTextModel.applyEdits", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  function editOp(startLineNumber, startColumn, endLineNumber, endColumn, text) {
    return {
      range: new Range(startLineNumber, startColumn, endLineNumber, endColumn),
      text: text.join("\n"),
      forceMoveMarkers: false
    };
  }
  test("high-low surrogates 1", () => {
    testApplyEditsWithSyncedModels(
      [
        "\u{1F4DA}some",
        "very nice",
        "text"
      ],
      [
        editOp(1, 2, 1, 2, ["a"])
      ],
      [
        "a\u{1F4DA}some",
        "very nice",
        "text"
      ],
      /*inputEditsAreInvalid*/
      true
    );
  });
  test("high-low surrogates 2", () => {
    testApplyEditsWithSyncedModels(
      [
        "\u{1F4DA}some",
        "very nice",
        "text"
      ],
      [
        editOp(1, 2, 1, 3, ["a"])
      ],
      [
        "asome",
        "very nice",
        "text"
      ],
      /*inputEditsAreInvalid*/
      true
    );
  });
  test("high-low surrogates 3", () => {
    testApplyEditsWithSyncedModels(
      [
        "\u{1F4DA}some",
        "very nice",
        "text"
      ],
      [
        editOp(1, 1, 1, 2, ["a"])
      ],
      [
        "asome",
        "very nice",
        "text"
      ],
      /*inputEditsAreInvalid*/
      true
    );
  });
  test("high-low surrogates 4", () => {
    testApplyEditsWithSyncedModels(
      [
        "\u{1F4DA}some",
        "very nice",
        "text"
      ],
      [
        editOp(1, 1, 1, 3, ["a"])
      ],
      [
        "asome",
        "very nice",
        "text"
      ],
      /*inputEditsAreInvalid*/
      true
    );
  });
  test("Bug 19872: Undo is funky", () => {
    testApplyEditsWithSyncedModels(
      [
        "something",
        " A",
        "",
        " B",
        "something else"
      ],
      [
        editOp(2, 1, 2, 2, [""]),
        editOp(3, 1, 4, 2, [""])
      ],
      [
        "something",
        "A",
        "B",
        "something else"
      ]
    );
  });
  test("Bug 19872: Undo is funky (2)", () => {
    testApplyEditsWithSyncedModels(
      [
        "something",
        "A",
        "B",
        "something else"
      ],
      [
        editOp(2, 1, 2, 1, [" "]),
        editOp(3, 1, 3, 1, ["", " "])
      ],
      [
        "something",
        " A",
        "",
        " B",
        "something else"
      ]
    );
  });
  test("insert empty text", () => {
    testApplyEditsWithSyncedModels(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "1"
      ],
      [
        editOp(1, 1, 1, 1, [""])
      ],
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "1"
      ]
    );
  });
  test("last op is no-op", () => {
    testApplyEditsWithSyncedModels(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "1"
      ],
      [
        editOp(1, 1, 1, 2, [""]),
        editOp(4, 1, 4, 1, [""])
      ],
      [
        "y First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "1"
      ]
    );
  });
  test("insert text without newline 1", () => {
    testApplyEditsWithSyncedModels(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "1"
      ],
      [
        editOp(1, 1, 1, 1, ["foo "])
      ],
      [
        "foo My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "1"
      ]
    );
  });
  test("insert text without newline 2", () => {
    testApplyEditsWithSyncedModels(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "1"
      ],
      [
        editOp(1, 3, 1, 3, [" foo"])
      ],
      [
        "My foo First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "1"
      ]
    );
  });
  test("insert one newline", () => {
    testApplyEditsWithSyncedModels(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "1"
      ],
      [
        editOp(1, 4, 1, 4, ["", ""])
      ],
      [
        "My ",
        "First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "1"
      ]
    );
  });
  test("insert text with one newline", () => {
    testApplyEditsWithSyncedModels(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "1"
      ],
      [
        editOp(1, 3, 1, 3, [" new line", "No longer"])
      ],
      [
        "My new line",
        "No longer First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "1"
      ]
    );
  });
  test("insert text with two newlines", () => {
    testApplyEditsWithSyncedModels(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "1"
      ],
      [
        editOp(1, 3, 1, 3, [" new line", "One more line in the middle", "No longer"])
      ],
      [
        "My new line",
        "One more line in the middle",
        "No longer First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "1"
      ]
    );
  });
  test("insert text with many newlines", () => {
    testApplyEditsWithSyncedModels(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "1"
      ],
      [
        editOp(1, 3, 1, 3, ["", "", "", "", ""])
      ],
      [
        "My",
        "",
        "",
        "",
        " First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "1"
      ]
    );
  });
  test("insert multiple newlines", () => {
    testApplyEditsWithSyncedModels(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "1"
      ],
      [
        editOp(1, 3, 1, 3, ["", "", "", "", ""]),
        editOp(3, 15, 3, 15, ["a", "b"])
      ],
      [
        "My",
        "",
        "",
        "",
        " First Line",
        "		My Second Line",
        "    Third Linea",
        "b",
        "",
        "1"
      ]
    );
  });
  test("delete empty text", () => {
    testApplyEditsWithSyncedModels(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "1"
      ],
      [
        editOp(1, 1, 1, 1, [""])
      ],
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "1"
      ]
    );
  });
  test("delete text from one line", () => {
    testApplyEditsWithSyncedModels(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "1"
      ],
      [
        editOp(1, 1, 1, 2, [""])
      ],
      [
        "y First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "1"
      ]
    );
  });
  test("delete text from one line 2", () => {
    testApplyEditsWithSyncedModels(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "1"
      ],
      [
        editOp(1, 1, 1, 3, ["a"])
      ],
      [
        "a First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "1"
      ]
    );
  });
  test("delete all text from a line", () => {
    testApplyEditsWithSyncedModels(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "1"
      ],
      [
        editOp(1, 1, 1, 14, [""])
      ],
      [
        "",
        "		My Second Line",
        "    Third Line",
        "",
        "1"
      ]
    );
  });
  test("delete text from two lines", () => {
    testApplyEditsWithSyncedModels(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "1"
      ],
      [
        editOp(1, 4, 2, 6, [""])
      ],
      [
        "My Second Line",
        "    Third Line",
        "",
        "1"
      ]
    );
  });
  test("delete text from many lines", () => {
    testApplyEditsWithSyncedModels(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "1"
      ],
      [
        editOp(1, 4, 3, 5, [""])
      ],
      [
        "My Third Line",
        "",
        "1"
      ]
    );
  });
  test("delete everything", () => {
    testApplyEditsWithSyncedModels(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "1"
      ],
      [
        editOp(1, 1, 5, 2, [""])
      ],
      [
        ""
      ]
    );
  });
  test("two unrelated edits", () => {
    testApplyEditsWithSyncedModels(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      [
        editOp(2, 1, 2, 3, ["	"]),
        editOp(3, 1, 3, 5, [""])
      ],
      [
        "My First Line",
        "	My Second Line",
        "Third Line",
        "",
        "123"
      ]
    );
  });
  test("two edits on one line", () => {
    testApplyEditsWithSyncedModels(
      [
        "		first	    ",
        "		second line",
        "	third line",
        "fourth line",
        "		<!@#fifth#@!>		"
      ],
      [
        editOp(5, 3, 5, 7, [""]),
        editOp(5, 12, 5, 16, [""])
      ],
      [
        "		first	    ",
        "		second line",
        "	third line",
        "fourth line",
        "		fifth		"
      ]
    );
  });
  test("many edits", () => {
    testApplyEditsWithSyncedModels(
      [
        '{"x" : 1}'
      ],
      [
        editOp(1, 2, 1, 2, ["\n  "]),
        editOp(1, 5, 1, 6, [""]),
        editOp(1, 9, 1, 9, ["\n"])
      ],
      [
        "{",
        '  "x": 1',
        "}"
      ]
    );
  });
  test("many edits reversed", () => {
    testApplyEditsWithSyncedModels(
      [
        "{",
        '  "x": 1',
        "}"
      ],
      [
        editOp(1, 2, 2, 3, [""]),
        editOp(2, 6, 2, 6, [" "]),
        editOp(2, 9, 3, 1, [""])
      ],
      [
        '{"x" : 1}'
      ]
    );
  });
  test("replacing newlines 1", () => {
    testApplyEditsWithSyncedModels(
      [
        "{",
        '"a": true,',
        "",
        '"b": true',
        "}"
      ],
      [
        editOp(1, 2, 2, 1, ["", "	"]),
        editOp(2, 11, 4, 1, ["", "	"])
      ],
      [
        "{",
        '	"a": true,',
        '	"b": true',
        "}"
      ]
    );
  });
  test("replacing newlines 2", () => {
    testApplyEditsWithSyncedModels(
      [
        "some text",
        "some more text",
        "now comes an empty line",
        "",
        "after empty line",
        "and the last line"
      ],
      [
        editOp(1, 5, 3, 1, [" text", "some more text", "some more text"]),
        editOp(3, 2, 4, 1, ["o more lines", "asd", "asd", "asd"]),
        editOp(5, 1, 5, 6, ["zzzzzzzz"]),
        editOp(5, 11, 6, 16, ["1", "2", "3", "4"])
      ],
      [
        "some text",
        "some more text",
        "some more textno more lines",
        "asd",
        "asd",
        "asd",
        "zzzzzzzz empt1",
        "2",
        "3",
        "4ne"
      ]
    );
  });
  test("advanced 1", () => {
    testApplyEditsWithSyncedModels(
      [
        ' {       "d": [',
        "             null",
        "        ] /*comment*/",
        '        ,"e": /*comment*/ [null] }'
      ],
      [
        editOp(1, 1, 1, 2, [""]),
        editOp(1, 3, 1, 10, ["", "  "]),
        editOp(1, 16, 2, 14, ["", "    "]),
        editOp(2, 18, 3, 9, ["", "  "]),
        editOp(3, 22, 4, 9, [""]),
        editOp(4, 10, 4, 10, ["", "  "]),
        editOp(4, 28, 4, 28, ["", "    "]),
        editOp(4, 32, 4, 32, ["", "  "]),
        editOp(4, 33, 4, 34, ["", ""])
      ],
      [
        "{",
        '  "d": [',
        "    null",
        "  ] /*comment*/,",
        '  "e": /*comment*/ [',
        "    null",
        "  ]",
        "}"
      ]
    );
  });
  test("advanced simplified", () => {
    testApplyEditsWithSyncedModels(
      [
        "   abc",
        " ,def"
      ],
      [
        editOp(1, 1, 1, 4, [""]),
        editOp(1, 7, 2, 2, [""]),
        editOp(2, 3, 2, 3, ["", ""])
      ],
      [
        "abc,",
        "def"
      ]
    );
  });
  test("issue #144", () => {
    testApplyEditsWithSyncedModels(
      [
        "package caddy",
        "",
        "func main() {",
        '	fmt.Println("Hello World! :)")',
        "}",
        ""
      ],
      [
        editOp(1, 1, 6, 1, [
          "package caddy",
          "",
          'import "fmt"',
          "",
          "func main() {",
          '	fmt.Println("Hello World! :)")',
          "}",
          ""
        ])
      ],
      [
        "package caddy",
        "",
        'import "fmt"',
        "",
        "func main() {",
        '	fmt.Println("Hello World! :)")',
        "}",
        ""
      ]
    );
  });
  test("issue #2586 Replacing selected end-of-line with newline locks up the document", () => {
    testApplyEditsWithSyncedModels(
      [
        "something",
        "interesting"
      ],
      [
        editOp(1, 10, 2, 1, ["", ""])
      ],
      [
        "something",
        "interesting"
      ]
    );
  });
  test("issue #3980", () => {
    testApplyEditsWithSyncedModels(
      [
        "class A {",
        "    someProperty = false;",
        "    someMethod() {",
        "    this.someMethod();",
        "    }",
        "}"
      ],
      [
        editOp(1, 8, 1, 9, ["", ""]),
        editOp(3, 17, 3, 18, ["", ""]),
        editOp(3, 18, 3, 18, ["    "]),
        editOp(4, 5, 4, 5, ["    "])
      ],
      [
        "class A",
        "{",
        "    someProperty = false;",
        "    someMethod()",
        "    {",
        "        this.someMethod();",
        "    }",
        "}"
      ]
    );
  });
  function testApplyEditsFails(original, edits) {
    const model = createTextModel(original.join("\n"));
    let hasThrown = false;
    try {
      model.applyEdits(edits);
    } catch (err) {
      hasThrown = true;
    }
    assert.ok(hasThrown, "expected model.applyEdits to fail.");
    model.dispose();
  }
  test("touching edits: two inserts at the same position", () => {
    testApplyEditsWithSyncedModels(
      [
        "hello world"
      ],
      [
        editOp(1, 1, 1, 1, ["a"]),
        editOp(1, 1, 1, 1, ["b"])
      ],
      [
        "abhello world"
      ]
    );
  });
  test("touching edits: insert and replace touching", () => {
    testApplyEditsWithSyncedModels(
      [
        "hello world"
      ],
      [
        editOp(1, 1, 1, 1, ["b"]),
        editOp(1, 1, 1, 3, ["ab"])
      ],
      [
        "babllo world"
      ]
    );
  });
  test("overlapping edits: two overlapping replaces", () => {
    testApplyEditsFails(
      [
        "hello world"
      ],
      [
        editOp(1, 1, 1, 2, ["b"]),
        editOp(1, 1, 1, 3, ["ab"])
      ]
    );
  });
  test("overlapping edits: two overlapping deletes", () => {
    testApplyEditsFails(
      [
        "hello world"
      ],
      [
        editOp(1, 1, 1, 2, [""]),
        editOp(1, 1, 1, 3, [""])
      ]
    );
  });
  test("touching edits: two touching replaces", () => {
    testApplyEditsWithSyncedModels(
      [
        "hello world"
      ],
      [
        editOp(1, 1, 1, 2, ["H"]),
        editOp(1, 2, 1, 3, ["E"])
      ],
      [
        "HEllo world"
      ]
    );
  });
  test("touching edits: two touching deletes", () => {
    testApplyEditsWithSyncedModels(
      [
        "hello world"
      ],
      [
        editOp(1, 1, 1, 2, [""]),
        editOp(1, 2, 1, 3, [""])
      ],
      [
        "llo world"
      ]
    );
  });
  test("touching edits: insert and replace", () => {
    testApplyEditsWithSyncedModels(
      [
        "hello world"
      ],
      [
        editOp(1, 1, 1, 1, ["H"]),
        editOp(1, 1, 1, 3, ["e"])
      ],
      [
        "Hello world"
      ]
    );
  });
  test("touching edits: replace and insert", () => {
    testApplyEditsWithSyncedModels(
      [
        "hello world"
      ],
      [
        editOp(1, 1, 1, 3, ["H"]),
        editOp(1, 3, 1, 3, ["e"])
      ],
      [
        "Hello world"
      ]
    );
  });
  test("change while emitting events 1", () => {
    let disposable;
    assertSyncedModels("Hello", (model, assertMirrorModels) => {
      model.applyEdits([{
        range: new Range(1, 6, 1, 6),
        text: " world!"
        // forceMoveMarkers: false
      }]);
      assertMirrorModels();
    }, (model) => {
      let isFirstTime = true;
      disposable = model.onDidChangeContent(() => {
        if (!isFirstTime) {
          return;
        }
        isFirstTime = false;
        model.applyEdits([{
          range: new Range(1, 13, 1, 13),
          text: " How are you?"
          // forceMoveMarkers: false
        }]);
      });
    });
    disposable.dispose();
  });
  test("change while emitting events 2", () => {
    let disposable;
    assertSyncedModels("Hello", (model, assertMirrorModels) => {
      model.applyEdits([{
        range: new Range(1, 6, 1, 6),
        text: " world!"
        // forceMoveMarkers: false
      }]);
      assertMirrorModels();
    }, (model) => {
      let isFirstTime = true;
      disposable = model.onDidChangeContent((e) => {
        if (!isFirstTime) {
          return;
        }
        isFirstTime = false;
        model.applyEdits([{
          range: new Range(1, 13, 1, 13),
          text: " How are you?"
          // forceMoveMarkers: false
        }]);
      });
    });
    disposable.dispose();
  });
  test("issue #1580: Changes in line endings are not correctly reflected in the extension host, leading to invalid offsets sent to external refactoring tools", () => {
    const model = createTextModel("Hello\nWorld!");
    assert.strictEqual(model.getEOL(), "\n");
    const mirrorModel2 = new MirrorTextModel(null, model.getLinesContent(), model.getEOL(), model.getVersionId());
    let mirrorModel2PrevVersionId = model.getVersionId();
    const disposable = model.onDidChangeContent((e) => {
      const versionId = e.versionId;
      if (versionId < mirrorModel2PrevVersionId) {
        console.warn("Model version id did not advance between edits (2)");
      }
      mirrorModel2PrevVersionId = versionId;
      mirrorModel2.onEvents(e);
    });
    const assertMirrorModels = () => {
      assert.strictEqual(mirrorModel2.getText(), model.getValue(), "mirror model 2 text OK");
      assert.strictEqual(mirrorModel2.version, model.getVersionId(), "mirror model 2 version OK");
    };
    model.setEOL(EndOfLineSequence.CRLF);
    assertMirrorModels();
    disposable.dispose();
    model.dispose();
    mirrorModel2.dispose();
  });
  test("issue #47733: Undo mangles unicode characters", () => {
    const model = createTextModel("'\u{1F441}'");
    model.applyEdits([
      { range: new Range(1, 1, 1, 1), text: '"' },
      { range: new Range(1, 2, 1, 2), text: '"' }
    ]);
    assert.strictEqual(model.getValue(EndOfLinePreference.LF), `"'"\u{1F441}'`);
    assert.deepStrictEqual(model.validateRange(new Range(1, 3, 1, 4)), new Range(1, 3, 1, 4));
    model.applyEdits([
      { range: new Range(1, 1, 1, 2), text: null },
      { range: new Range(1, 3, 1, 4), text: null }
    ]);
    assert.strictEqual(model.getValue(EndOfLinePreference.LF), "'\u{1F441}'");
    model.dispose();
  });
  test("issue #48741: Broken undo stack with move lines up with multiple cursors", () => {
    const model = createTextModel([
      "line1",
      "line2",
      "line3",
      ""
    ].join("\n"));
    const undoEdits = model.applyEdits([
      { range: new Range(4, 1, 4, 1), text: "line3" },
      { range: new Range(3, 1, 3, 6), text: null },
      { range: new Range(2, 1, 3, 1), text: null },
      { range: new Range(3, 6, 3, 6), text: "\nline2" }
    ], true);
    model.applyEdits(undoEdits);
    assert.deepStrictEqual(model.getValue(), "line1\nline2\nline3\n");
    model.dispose();
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vbW9kZWwvZWRpdGFibGVUZXh0TW9kZWwudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgSVNpbmdsZUVkaXRPcGVyYXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9lZGl0T3BlcmF0aW9uLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgRW5kT2ZMaW5lUHJlZmVyZW5jZSwgRW5kT2ZMaW5lU2VxdWVuY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgTWlycm9yVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL21vZGVsL21pcnJvclRleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBJTW9kZWxDb250ZW50Q2hhbmdlZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3RleHRNb2RlbEV2ZW50cy5qcyc7XG5pbXBvcnQgeyBhc3NlcnRTeW5jZWRNb2RlbHMsIHRlc3RBcHBseUVkaXRzV2l0aFN5bmNlZE1vZGVscyB9IGZyb20gJy4vZWRpdGFibGVUZXh0TW9kZWxUZXN0VXRpbHMuanMnO1xuaW1wb3J0IHsgY3JlYXRlVGV4dE1vZGVsIH0gZnJvbSAnLi4vdGVzdFRleHRNb2RlbC5qcyc7XG5cbnN1aXRlKCdFZGl0b3JNb2RlbCAtIEVkaXRhYmxlVGV4dE1vZGVsLmFwcGx5RWRpdHMgdXBkYXRlcyBtaWdodENvbnRhaW5SVEwnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0ZnVuY3Rpb24gdGVzdEFwcGx5RWRpdHMob3JpZ2luYWw6IHN0cmluZ1tdLCBlZGl0czogSVNpbmdsZUVkaXRPcGVyYXRpb25bXSwgYmVmb3JlOiBib29sZWFuLCBhZnRlcjogYm9vbGVhbik6IHZvaWQge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKG9yaWdpbmFsLmpvaW4oJ1xcbicpKTtcblx0XHRtb2RlbC5zZXRFT0woRW5kT2ZMaW5lU2VxdWVuY2UuTEYpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLm1pZ2h0Q29udGFpblJUTCgpLCBiZWZvcmUpO1xuXG5cdFx0bW9kZWwuYXBwbHlFZGl0cyhlZGl0cyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLm1pZ2h0Q29udGFpblJUTCgpLCBhZnRlcik7XG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9XG5cblx0ZnVuY3Rpb24gZWRpdE9wKHN0YXJ0TGluZU51bWJlcjogbnVtYmVyLCBzdGFydENvbHVtbjogbnVtYmVyLCBlbmRMaW5lTnVtYmVyOiBudW1iZXIsIGVuZENvbHVtbjogbnVtYmVyLCB0ZXh0OiBzdHJpbmdbXSk6IElTaW5nbGVFZGl0T3BlcmF0aW9uIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cmFuZ2U6IG5ldyBSYW5nZShzdGFydExpbmVOdW1iZXIsIHN0YXJ0Q29sdW1uLCBlbmRMaW5lTnVtYmVyLCBlbmRDb2x1bW4pLFxuXHRcdFx0dGV4dDogdGV4dC5qb2luKCdcXG4nKVxuXHRcdH07XG5cdH1cblxuXHR0ZXN0KCdzdGFydCB3aXRoIFJUTCwgaW5zZXJ0IExUUicsICgpID0+IHtcblx0XHR0ZXN0QXBwbHlFZGl0cyhbJ0hlbGxvLFxcblx1MDVENlx1MDVENVx1MDVENFx1MDVEOSBcdTA1RTJcdTA1RDVcdTA1RDFcdTA1RDNcdTA1RDQgXHUwNURFXHUwNUQxXHUwNUQ1XHUwNUUxXHUwNUUxXHUwNUVBIFx1MDVFOVx1MDVEM1x1MDVFMlx1MDVFQVx1MDVENSddLCBbZWRpdE9wKDEsIDEsIDEsIDEsIFsnaGVsbG8nXSldLCB0cnVlLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnc3RhcnQgd2l0aCBSVEwsIGRlbGV0ZSBSVEwnLCAoKSA9PiB7XG5cdFx0dGVzdEFwcGx5RWRpdHMoWydIZWxsbyxcXG5cdTA1RDZcdTA1RDVcdTA1RDRcdTA1RDkgXHUwNUUyXHUwNUQ1XHUwNUQxXHUwNUQzXHUwNUQ0IFx1MDVERVx1MDVEMVx1MDVENVx1MDVFMVx1MDVFMVx1MDVFQSBcdTA1RTlcdTA1RDNcdTA1RTJcdTA1RUFcdTA1RDUnXSwgW2VkaXRPcCgxLCAxLCAxMCwgMTAsIFsnJ10pXSwgdHJ1ZSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3N0YXJ0IHdpdGggUlRMLCBpbnNlcnQgUlRMJywgKCkgPT4ge1xuXHRcdHRlc3RBcHBseUVkaXRzKFsnSGVsbG8sXFxuXHUwNUQ2XHUwNUQ1XHUwNUQ0XHUwNUQ5IFx1MDVFMlx1MDVENVx1MDVEMVx1MDVEM1x1MDVENCBcdTA1REVcdTA1RDFcdTA1RDVcdTA1RTFcdTA1RTFcdTA1RUEgXHUwNUU5XHUwNUQzXHUwNUUyXHUwNUVBXHUwNUQ1J10sIFtlZGl0T3AoMSwgMSwgMSwgMSwgWydcdTA2NDdcdTA2NDZcdTA2MjdcdTA2NDMgXHUwNjJEXHUwNjQyXHUwNjRBXHUwNjQyXHUwNjI5IFx1MDY0NVx1MDYyQlx1MDYyOFx1MDYyQVx1MDYyOSBcdTA2NDVcdTA2NDZcdTA2MzAgXHUwNjMyXHUwNjQ1XHUwNjQ2IFx1MDYzN1x1MDY0OFx1MDY0QVx1MDY0NCddKV0sIHRydWUsIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdzdGFydCB3aXRoIExUUiwgaW5zZXJ0IExUUicsICgpID0+IHtcblx0XHR0ZXN0QXBwbHlFZGl0cyhbJ0hlbGxvLFxcbndvcmxkISddLCBbZWRpdE9wKDEsIDEsIDEsIDEsIFsnaGVsbG8nXSldLCBmYWxzZSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdzdGFydCB3aXRoIExUUiwgaW5zZXJ0IFJUTCAxJywgKCkgPT4ge1xuXHRcdHRlc3RBcHBseUVkaXRzKFsnSGVsbG8sXFxud29ybGQhJ10sIFtlZGl0T3AoMSwgMSwgMSwgMSwgWydcdTA2NDdcdTA2NDZcdTA2MjdcdTA2NDMgXHUwNjJEXHUwNjQyXHUwNjRBXHUwNjQyXHUwNjI5IFx1MDY0NVx1MDYyQlx1MDYyOFx1MDYyQVx1MDYyOSBcdTA2NDVcdTA2NDZcdTA2MzAgXHUwNjMyXHUwNjQ1XHUwNjQ2IFx1MDYzN1x1MDY0OFx1MDY0QVx1MDY0NCddKV0sIGZhbHNlLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnc3RhcnQgd2l0aCBMVFIsIGluc2VydCBSVEwgMicsICgpID0+IHtcblx0XHR0ZXN0QXBwbHlFZGl0cyhbJ0hlbGxvLFxcbndvcmxkISddLCBbZWRpdE9wKDEsIDEsIDEsIDEsIFsnXHUwNUQ2XHUwNUQ1XHUwNUQ0XHUwNUQ5IFx1MDVFMlx1MDVENVx1MDVEMVx1MDVEM1x1MDVENCBcdTA1REVcdTA1RDFcdTA1RDVcdTA1RTFcdTA1RTFcdTA1RUEgXHUwNUU5XHUwNUQzXHUwNUUyXHUwNUVBXHUwNUQ1J10pXSwgZmFsc2UsIHRydWUpO1xuXHR9KTtcbn0pO1xuXG5cbnN1aXRlKCdFZGl0b3JNb2RlbCAtIEVkaXRhYmxlVGV4dE1vZGVsLmFwcGx5RWRpdHMgdXBkYXRlcyBtaWdodENvbnRhaW5Ob25CYXNpY0FTQ0lJJywgKCkgPT4ge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGZ1bmN0aW9uIHRlc3RBcHBseUVkaXRzKG9yaWdpbmFsOiBzdHJpbmdbXSwgZWRpdHM6IElTaW5nbGVFZGl0T3BlcmF0aW9uW10sIGJlZm9yZTogYm9vbGVhbiwgYWZ0ZXI6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChvcmlnaW5hbC5qb2luKCdcXG4nKSk7XG5cdFx0bW9kZWwuc2V0RU9MKEVuZE9mTGluZVNlcXVlbmNlLkxGKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5taWdodENvbnRhaW5Ob25CYXNpY0FTQ0lJKCksIGJlZm9yZSk7XG5cblx0XHRtb2RlbC5hcHBseUVkaXRzKGVkaXRzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwubWlnaHRDb250YWluTm9uQmFzaWNBU0NJSSgpLCBhZnRlcik7XG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9XG5cblx0ZnVuY3Rpb24gZWRpdE9wKHN0YXJ0TGluZU51bWJlcjogbnVtYmVyLCBzdGFydENvbHVtbjogbnVtYmVyLCBlbmRMaW5lTnVtYmVyOiBudW1iZXIsIGVuZENvbHVtbjogbnVtYmVyLCB0ZXh0OiBzdHJpbmdbXSk6IElTaW5nbGVFZGl0T3BlcmF0aW9uIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cmFuZ2U6IG5ldyBSYW5nZShzdGFydExpbmVOdW1iZXIsIHN0YXJ0Q29sdW1uLCBlbmRMaW5lTnVtYmVyLCBlbmRDb2x1bW4pLFxuXHRcdFx0dGV4dDogdGV4dC5qb2luKCdcXG4nKVxuXHRcdH07XG5cdH1cblxuXHR0ZXN0KCdzdGFydCB3aXRoIE5PTi1BU0NJSSwgaW5zZXJ0IEFTQ0lJJywgKCkgPT4ge1xuXHRcdHRlc3RBcHBseUVkaXRzKFsnSGVsbG8sXFxuWlx1MDBGQ3JpY2gnXSwgW2VkaXRPcCgxLCAxLCAxLCAxLCBbJ2hlbGxvJywgJ3NlY29uZCBsaW5lJ10pXSwgdHJ1ZSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3N0YXJ0IHdpdGggTk9OLUFTQ0lJLCBkZWxldGUgTk9OLUFTQ0lJJywgKCkgPT4ge1xuXHRcdHRlc3RBcHBseUVkaXRzKFsnSGVsbG8sXFxuWlx1MDBGQ3JpY2gnXSwgW2VkaXRPcCgxLCAxLCAxMCwgMTAsIFsnJ10pXSwgdHJ1ZSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3N0YXJ0IHdpdGggTk9OLUFTQ0lJLCBpbnNlcnQgTk9OLUFTQ0lJJywgKCkgPT4ge1xuXHRcdHRlc3RBcHBseUVkaXRzKFsnSGVsbG8sXFxuWlx1MDBGQ3JpY2gnXSwgW2VkaXRPcCgxLCAxLCAxLCAxLCBbJ1pcdTAwRkNyaWNoJ10pXSwgdHJ1ZSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3N0YXJ0IHdpdGggQVNDSUksIGluc2VydCBBU0NJSScsICgpID0+IHtcblx0XHR0ZXN0QXBwbHlFZGl0cyhbJ0hlbGxvLFxcbndvcmxkISddLCBbZWRpdE9wKDEsIDEsIDEsIDEsIFsnaGVsbG8nLCAnc2Vjb25kIGxpbmUnXSldLCBmYWxzZSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdzdGFydCB3aXRoIEFTQ0lJLCBpbnNlcnQgTk9OLUFTQ0lJJywgKCkgPT4ge1xuXHRcdHRlc3RBcHBseUVkaXRzKFsnSGVsbG8sXFxud29ybGQhJ10sIFtlZGl0T3AoMSwgMSwgMSwgMSwgWydaXHUwMEZDcmljaCcsICdaXHUwMEZDcmljaCddKV0sIGZhbHNlLCB0cnVlKTtcblx0fSk7XG5cbn0pO1xuXG5zdWl0ZSgnRWRpdG9yTW9kZWwgLSBFZGl0YWJsZVRleHRNb2RlbC5hcHBseUVkaXRzJywgKCkgPT4ge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGZ1bmN0aW9uIGVkaXRPcChzdGFydExpbmVOdW1iZXI6IG51bWJlciwgc3RhcnRDb2x1bW46IG51bWJlciwgZW5kTGluZU51bWJlcjogbnVtYmVyLCBlbmRDb2x1bW46IG51bWJlciwgdGV4dDogc3RyaW5nW10pOiBJU2luZ2xlRWRpdE9wZXJhdGlvbiB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHJhbmdlOiBuZXcgUmFuZ2Uoc3RhcnRMaW5lTnVtYmVyLCBzdGFydENvbHVtbiwgZW5kTGluZU51bWJlciwgZW5kQ29sdW1uKSxcblx0XHRcdHRleHQ6IHRleHQuam9pbignXFxuJyksXG5cdFx0XHRmb3JjZU1vdmVNYXJrZXJzOiBmYWxzZVxuXHRcdH07XG5cdH1cblxuXHR0ZXN0KCdoaWdoLWxvdyBzdXJyb2dhdGVzIDEnLCAoKSA9PiB7XG5cdFx0dGVzdEFwcGx5RWRpdHNXaXRoU3luY2VkTW9kZWxzKFxuXHRcdFx0W1xuXHRcdFx0XHQnXHVEODNEXHVEQ0RBc29tZScsXG5cdFx0XHRcdCd2ZXJ5IG5pY2UnLFxuXHRcdFx0XHQndGV4dCdcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdGVkaXRPcCgxLCAyLCAxLCAyLCBbJ2EnXSlcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdCdhXHVEODNEXHVEQ0RBc29tZScsXG5cdFx0XHRcdCd2ZXJ5IG5pY2UnLFxuXHRcdFx0XHQndGV4dCdcblx0XHRcdF0sXG4vKmlucHV0RWRpdHNBcmVJbnZhbGlkKi90cnVlXG5cdFx0KTtcblx0fSk7XG5cdHRlc3QoJ2hpZ2gtbG93IHN1cnJvZ2F0ZXMgMicsICgpID0+IHtcblx0XHR0ZXN0QXBwbHlFZGl0c1dpdGhTeW5jZWRNb2RlbHMoXG5cdFx0XHRbXG5cdFx0XHRcdCdcdUQ4M0RcdURDREFzb21lJyxcblx0XHRcdFx0J3ZlcnkgbmljZScsXG5cdFx0XHRcdCd0ZXh0J1xuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0ZWRpdE9wKDEsIDIsIDEsIDMsIFsnYSddKVxuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0J2Fzb21lJyxcblx0XHRcdFx0J3ZlcnkgbmljZScsXG5cdFx0XHRcdCd0ZXh0J1xuXHRcdFx0XSxcbi8qaW5wdXRFZGl0c0FyZUludmFsaWQqL3RydWVcblx0XHQpO1xuXHR9KTtcblx0dGVzdCgnaGlnaC1sb3cgc3Vycm9nYXRlcyAzJywgKCkgPT4ge1xuXHRcdHRlc3RBcHBseUVkaXRzV2l0aFN5bmNlZE1vZGVscyhcblx0XHRcdFtcblx0XHRcdFx0J1x1RDgzRFx1RENEQXNvbWUnLFxuXHRcdFx0XHQndmVyeSBuaWNlJyxcblx0XHRcdFx0J3RleHQnXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHRlZGl0T3AoMSwgMSwgMSwgMiwgWydhJ10pXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHQnYXNvbWUnLFxuXHRcdFx0XHQndmVyeSBuaWNlJyxcblx0XHRcdFx0J3RleHQnXG5cdFx0XHRdLFxuLyppbnB1dEVkaXRzQXJlSW52YWxpZCovdHJ1ZVxuXHRcdCk7XG5cdH0pO1xuXHR0ZXN0KCdoaWdoLWxvdyBzdXJyb2dhdGVzIDQnLCAoKSA9PiB7XG5cdFx0dGVzdEFwcGx5RWRpdHNXaXRoU3luY2VkTW9kZWxzKFxuXHRcdFx0W1xuXHRcdFx0XHQnXHVEODNEXHVEQ0RBc29tZScsXG5cdFx0XHRcdCd2ZXJ5IG5pY2UnLFxuXHRcdFx0XHQndGV4dCdcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdGVkaXRPcCgxLCAxLCAxLCAzLCBbJ2EnXSlcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdCdhc29tZScsXG5cdFx0XHRcdCd2ZXJ5IG5pY2UnLFxuXHRcdFx0XHQndGV4dCdcblx0XHRcdF0sXG4vKmlucHV0RWRpdHNBcmVJbnZhbGlkKi90cnVlXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnQnVnIDE5ODcyOiBVbmRvIGlzIGZ1bmt5JywgKCkgPT4ge1xuXHRcdHRlc3RBcHBseUVkaXRzV2l0aFN5bmNlZE1vZGVscyhcblx0XHRcdFtcblx0XHRcdFx0J3NvbWV0aGluZycsXG5cdFx0XHRcdCcgQScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnIEInLFxuXHRcdFx0XHQnc29tZXRoaW5nIGVsc2UnXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHRlZGl0T3AoMiwgMSwgMiwgMiwgWycnXSksXG5cdFx0XHRcdGVkaXRPcCgzLCAxLCA0LCAyLCBbJyddKVxuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0J3NvbWV0aGluZycsXG5cdFx0XHRcdCdBJyxcblx0XHRcdFx0J0InLFxuXHRcdFx0XHQnc29tZXRoaW5nIGVsc2UnXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnQnVnIDE5ODcyOiBVbmRvIGlzIGZ1bmt5ICgyKScsICgpID0+IHtcblx0XHR0ZXN0QXBwbHlFZGl0c1dpdGhTeW5jZWRNb2RlbHMoXG5cdFx0XHRbXG5cdFx0XHRcdCdzb21ldGhpbmcnLFxuXHRcdFx0XHQnQScsXG5cdFx0XHRcdCdCJyxcblx0XHRcdFx0J3NvbWV0aGluZyBlbHNlJ1xuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0ZWRpdE9wKDIsIDEsIDIsIDEsIFsnICddKSxcblx0XHRcdFx0ZWRpdE9wKDMsIDEsIDMsIDEsIFsnJywgJyAnXSlcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdCdzb21ldGhpbmcnLFxuXHRcdFx0XHQnIEEnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JyBCJyxcblx0XHRcdFx0J3NvbWV0aGluZyBlbHNlJ1xuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2luc2VydCBlbXB0eSB0ZXh0JywgKCkgPT4ge1xuXHRcdHRlc3RBcHBseUVkaXRzV2l0aFN5bmNlZE1vZGVscyhcblx0XHRcdFtcblx0XHRcdFx0J015IEZpcnN0IExpbmUnLFxuXHRcdFx0XHQnXFx0XFx0TXkgU2Vjb25kIExpbmUnLFxuXHRcdFx0XHQnICAgIFRoaXJkIExpbmUnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JzEnXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHRlZGl0T3AoMSwgMSwgMSwgMSwgWycnXSlcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdCdNeSBGaXJzdCBMaW5lJyxcblx0XHRcdFx0J1xcdFxcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdFx0JyAgICBUaGlyZCBMaW5lJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcxJ1xuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2xhc3Qgb3AgaXMgbm8tb3AnLCAoKSA9PiB7XG5cdFx0dGVzdEFwcGx5RWRpdHNXaXRoU3luY2VkTW9kZWxzKFxuXHRcdFx0W1xuXHRcdFx0XHQnTXkgRmlyc3QgTGluZScsXG5cdFx0XHRcdCdcXHRcXHRNeSBTZWNvbmQgTGluZScsXG5cdFx0XHRcdCcgICAgVGhpcmQgTGluZScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnMSdcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdGVkaXRPcCgxLCAxLCAxLCAyLCBbJyddKSxcblx0XHRcdFx0ZWRpdE9wKDQsIDEsIDQsIDEsIFsnJ10pXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHQneSBGaXJzdCBMaW5lJyxcblx0XHRcdFx0J1xcdFxcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdFx0JyAgICBUaGlyZCBMaW5lJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcxJ1xuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2luc2VydCB0ZXh0IHdpdGhvdXQgbmV3bGluZSAxJywgKCkgPT4ge1xuXHRcdHRlc3RBcHBseUVkaXRzV2l0aFN5bmNlZE1vZGVscyhcblx0XHRcdFtcblx0XHRcdFx0J015IEZpcnN0IExpbmUnLFxuXHRcdFx0XHQnXFx0XFx0TXkgU2Vjb25kIExpbmUnLFxuXHRcdFx0XHQnICAgIFRoaXJkIExpbmUnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JzEnXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHRlZGl0T3AoMSwgMSwgMSwgMSwgWydmb28gJ10pXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHQnZm9vIE15IEZpcnN0IExpbmUnLFxuXHRcdFx0XHQnXFx0XFx0TXkgU2Vjb25kIExpbmUnLFxuXHRcdFx0XHQnICAgIFRoaXJkIExpbmUnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JzEnXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnaW5zZXJ0IHRleHQgd2l0aG91dCBuZXdsaW5lIDInLCAoKSA9PiB7XG5cdFx0dGVzdEFwcGx5RWRpdHNXaXRoU3luY2VkTW9kZWxzKFxuXHRcdFx0W1xuXHRcdFx0XHQnTXkgRmlyc3QgTGluZScsXG5cdFx0XHRcdCdcXHRcXHRNeSBTZWNvbmQgTGluZScsXG5cdFx0XHRcdCcgICAgVGhpcmQgTGluZScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnMSdcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdGVkaXRPcCgxLCAzLCAxLCAzLCBbJyBmb28nXSlcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdCdNeSBmb28gRmlyc3QgTGluZScsXG5cdFx0XHRcdCdcXHRcXHRNeSBTZWNvbmQgTGluZScsXG5cdFx0XHRcdCcgICAgVGhpcmQgTGluZScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnMSdcblx0XHRcdF1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpbnNlcnQgb25lIG5ld2xpbmUnLCAoKSA9PiB7XG5cdFx0dGVzdEFwcGx5RWRpdHNXaXRoU3luY2VkTW9kZWxzKFxuXHRcdFx0W1xuXHRcdFx0XHQnTXkgRmlyc3QgTGluZScsXG5cdFx0XHRcdCdcXHRcXHRNeSBTZWNvbmQgTGluZScsXG5cdFx0XHRcdCcgICAgVGhpcmQgTGluZScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnMSdcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdGVkaXRPcCgxLCA0LCAxLCA0LCBbJycsICcnXSlcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdCdNeSAnLFxuXHRcdFx0XHQnRmlyc3QgTGluZScsXG5cdFx0XHRcdCdcXHRcXHRNeSBTZWNvbmQgTGluZScsXG5cdFx0XHRcdCcgICAgVGhpcmQgTGluZScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnMSdcblx0XHRcdF1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpbnNlcnQgdGV4dCB3aXRoIG9uZSBuZXdsaW5lJywgKCkgPT4ge1xuXHRcdHRlc3RBcHBseUVkaXRzV2l0aFN5bmNlZE1vZGVscyhcblx0XHRcdFtcblx0XHRcdFx0J015IEZpcnN0IExpbmUnLFxuXHRcdFx0XHQnXFx0XFx0TXkgU2Vjb25kIExpbmUnLFxuXHRcdFx0XHQnICAgIFRoaXJkIExpbmUnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JzEnXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHRlZGl0T3AoMSwgMywgMSwgMywgWycgbmV3IGxpbmUnLCAnTm8gbG9uZ2VyJ10pXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHQnTXkgbmV3IGxpbmUnLFxuXHRcdFx0XHQnTm8gbG9uZ2VyIEZpcnN0IExpbmUnLFxuXHRcdFx0XHQnXFx0XFx0TXkgU2Vjb25kIExpbmUnLFxuXHRcdFx0XHQnICAgIFRoaXJkIExpbmUnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JzEnXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnaW5zZXJ0IHRleHQgd2l0aCB0d28gbmV3bGluZXMnLCAoKSA9PiB7XG5cdFx0dGVzdEFwcGx5RWRpdHNXaXRoU3luY2VkTW9kZWxzKFxuXHRcdFx0W1xuXHRcdFx0XHQnTXkgRmlyc3QgTGluZScsXG5cdFx0XHRcdCdcXHRcXHRNeSBTZWNvbmQgTGluZScsXG5cdFx0XHRcdCcgICAgVGhpcmQgTGluZScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnMSdcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdGVkaXRPcCgxLCAzLCAxLCAzLCBbJyBuZXcgbGluZScsICdPbmUgbW9yZSBsaW5lIGluIHRoZSBtaWRkbGUnLCAnTm8gbG9uZ2VyJ10pXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHQnTXkgbmV3IGxpbmUnLFxuXHRcdFx0XHQnT25lIG1vcmUgbGluZSBpbiB0aGUgbWlkZGxlJyxcblx0XHRcdFx0J05vIGxvbmdlciBGaXJzdCBMaW5lJyxcblx0XHRcdFx0J1xcdFxcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdFx0JyAgICBUaGlyZCBMaW5lJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcxJ1xuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2luc2VydCB0ZXh0IHdpdGggbWFueSBuZXdsaW5lcycsICgpID0+IHtcblx0XHR0ZXN0QXBwbHlFZGl0c1dpdGhTeW5jZWRNb2RlbHMoXG5cdFx0XHRbXG5cdFx0XHRcdCdNeSBGaXJzdCBMaW5lJyxcblx0XHRcdFx0J1xcdFxcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdFx0JyAgICBUaGlyZCBMaW5lJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcxJ1xuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0ZWRpdE9wKDEsIDMsIDEsIDMsIFsnJywgJycsICcnLCAnJywgJyddKVxuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0J015Jyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JyBGaXJzdCBMaW5lJyxcblx0XHRcdFx0J1xcdFxcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdFx0JyAgICBUaGlyZCBMaW5lJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcxJ1xuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2luc2VydCBtdWx0aXBsZSBuZXdsaW5lcycsICgpID0+IHtcblx0XHR0ZXN0QXBwbHlFZGl0c1dpdGhTeW5jZWRNb2RlbHMoXG5cdFx0XHRbXG5cdFx0XHRcdCdNeSBGaXJzdCBMaW5lJyxcblx0XHRcdFx0J1xcdFxcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdFx0JyAgICBUaGlyZCBMaW5lJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcxJ1xuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0ZWRpdE9wKDEsIDMsIDEsIDMsIFsnJywgJycsICcnLCAnJywgJyddKSxcblx0XHRcdFx0ZWRpdE9wKDMsIDE1LCAzLCAxNSwgWydhJywgJ2InXSlcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdCdNeScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcgRmlyc3QgTGluZScsXG5cdFx0XHRcdCdcXHRcXHRNeSBTZWNvbmQgTGluZScsXG5cdFx0XHRcdCcgICAgVGhpcmQgTGluZWEnLFxuXHRcdFx0XHQnYicsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnMSdcblx0XHRcdF1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWxldGUgZW1wdHkgdGV4dCcsICgpID0+IHtcblx0XHR0ZXN0QXBwbHlFZGl0c1dpdGhTeW5jZWRNb2RlbHMoXG5cdFx0XHRbXG5cdFx0XHRcdCdNeSBGaXJzdCBMaW5lJyxcblx0XHRcdFx0J1xcdFxcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdFx0JyAgICBUaGlyZCBMaW5lJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcxJ1xuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0ZWRpdE9wKDEsIDEsIDEsIDEsIFsnJ10pXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHQnTXkgRmlyc3QgTGluZScsXG5cdFx0XHRcdCdcXHRcXHRNeSBTZWNvbmQgTGluZScsXG5cdFx0XHRcdCcgICAgVGhpcmQgTGluZScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnMSdcblx0XHRcdF1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWxldGUgdGV4dCBmcm9tIG9uZSBsaW5lJywgKCkgPT4ge1xuXHRcdHRlc3RBcHBseUVkaXRzV2l0aFN5bmNlZE1vZGVscyhcblx0XHRcdFtcblx0XHRcdFx0J015IEZpcnN0IExpbmUnLFxuXHRcdFx0XHQnXFx0XFx0TXkgU2Vjb25kIExpbmUnLFxuXHRcdFx0XHQnICAgIFRoaXJkIExpbmUnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JzEnXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHRlZGl0T3AoMSwgMSwgMSwgMiwgWycnXSlcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdCd5IEZpcnN0IExpbmUnLFxuXHRcdFx0XHQnXFx0XFx0TXkgU2Vjb25kIExpbmUnLFxuXHRcdFx0XHQnICAgIFRoaXJkIExpbmUnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JzEnXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnZGVsZXRlIHRleHQgZnJvbSBvbmUgbGluZSAyJywgKCkgPT4ge1xuXHRcdHRlc3RBcHBseUVkaXRzV2l0aFN5bmNlZE1vZGVscyhcblx0XHRcdFtcblx0XHRcdFx0J015IEZpcnN0IExpbmUnLFxuXHRcdFx0XHQnXFx0XFx0TXkgU2Vjb25kIExpbmUnLFxuXHRcdFx0XHQnICAgIFRoaXJkIExpbmUnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JzEnXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHRlZGl0T3AoMSwgMSwgMSwgMywgWydhJ10pXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHQnYSBGaXJzdCBMaW5lJyxcblx0XHRcdFx0J1xcdFxcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdFx0JyAgICBUaGlyZCBMaW5lJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcxJ1xuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0ZSBhbGwgdGV4dCBmcm9tIGEgbGluZScsICgpID0+IHtcblx0XHR0ZXN0QXBwbHlFZGl0c1dpdGhTeW5jZWRNb2RlbHMoXG5cdFx0XHRbXG5cdFx0XHRcdCdNeSBGaXJzdCBMaW5lJyxcblx0XHRcdFx0J1xcdFxcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdFx0JyAgICBUaGlyZCBMaW5lJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcxJ1xuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0ZWRpdE9wKDEsIDEsIDEsIDE0LCBbJyddKVxuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0JycsXG5cdFx0XHRcdCdcXHRcXHRNeSBTZWNvbmQgTGluZScsXG5cdFx0XHRcdCcgICAgVGhpcmQgTGluZScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnMSdcblx0XHRcdF1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWxldGUgdGV4dCBmcm9tIHR3byBsaW5lcycsICgpID0+IHtcblx0XHR0ZXN0QXBwbHlFZGl0c1dpdGhTeW5jZWRNb2RlbHMoXG5cdFx0XHRbXG5cdFx0XHRcdCdNeSBGaXJzdCBMaW5lJyxcblx0XHRcdFx0J1xcdFxcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdFx0JyAgICBUaGlyZCBMaW5lJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcxJ1xuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0ZWRpdE9wKDEsIDQsIDIsIDYsIFsnJ10pXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHQnTXkgU2Vjb25kIExpbmUnLFxuXHRcdFx0XHQnICAgIFRoaXJkIExpbmUnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JzEnXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnZGVsZXRlIHRleHQgZnJvbSBtYW55IGxpbmVzJywgKCkgPT4ge1xuXHRcdHRlc3RBcHBseUVkaXRzV2l0aFN5bmNlZE1vZGVscyhcblx0XHRcdFtcblx0XHRcdFx0J015IEZpcnN0IExpbmUnLFxuXHRcdFx0XHQnXFx0XFx0TXkgU2Vjb25kIExpbmUnLFxuXHRcdFx0XHQnICAgIFRoaXJkIExpbmUnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JzEnXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHRlZGl0T3AoMSwgNCwgMywgNSwgWycnXSlcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdCdNeSBUaGlyZCBMaW5lJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcxJ1xuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0ZSBldmVyeXRoaW5nJywgKCkgPT4ge1xuXHRcdHRlc3RBcHBseUVkaXRzV2l0aFN5bmNlZE1vZGVscyhcblx0XHRcdFtcblx0XHRcdFx0J015IEZpcnN0IExpbmUnLFxuXHRcdFx0XHQnXFx0XFx0TXkgU2Vjb25kIExpbmUnLFxuXHRcdFx0XHQnICAgIFRoaXJkIExpbmUnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JzEnXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHRlZGl0T3AoMSwgMSwgNSwgMiwgWycnXSlcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdCcnXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgndHdvIHVucmVsYXRlZCBlZGl0cycsICgpID0+IHtcblx0XHR0ZXN0QXBwbHlFZGl0c1dpdGhTeW5jZWRNb2RlbHMoXG5cdFx0XHRbXG5cdFx0XHRcdCdNeSBGaXJzdCBMaW5lJyxcblx0XHRcdFx0J1xcdFxcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdFx0JyAgICBUaGlyZCBMaW5lJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcxMjMnXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHRlZGl0T3AoMiwgMSwgMiwgMywgWydcXHQnXSksXG5cdFx0XHRcdGVkaXRPcCgzLCAxLCAzLCA1LCBbJyddKVxuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0J015IEZpcnN0IExpbmUnLFxuXHRcdFx0XHQnXFx0TXkgU2Vjb25kIExpbmUnLFxuXHRcdFx0XHQnVGhpcmQgTGluZScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnMTIzJ1xuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3R3byBlZGl0cyBvbiBvbmUgbGluZScsICgpID0+IHtcblx0XHR0ZXN0QXBwbHlFZGl0c1dpdGhTeW5jZWRNb2RlbHMoXG5cdFx0XHRbXG5cdFx0XHRcdCdcXHRcXHRmaXJzdFxcdCAgICAnLFxuXHRcdFx0XHQnXFx0XFx0c2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQnXFx0dGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdcXHRcXHQ8IUAjZmlmdGgjQCE+XFx0XFx0J1xuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0ZWRpdE9wKDUsIDMsIDUsIDcsIFsnJ10pLFxuXHRcdFx0XHRlZGl0T3AoNSwgMTIsIDUsIDE2LCBbJyddKVxuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0J1xcdFxcdGZpcnN0XFx0ICAgICcsXG5cdFx0XHRcdCdcXHRcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCdcXHR0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J1xcdFxcdGZpZnRoXFx0XFx0J1xuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21hbnkgZWRpdHMnLCAoKSA9PiB7XG5cdFx0dGVzdEFwcGx5RWRpdHNXaXRoU3luY2VkTW9kZWxzKFxuXHRcdFx0W1xuXHRcdFx0XHQne1wieFwiIDogMX0nXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHRlZGl0T3AoMSwgMiwgMSwgMiwgWydcXG4gICddKSxcblx0XHRcdFx0ZWRpdE9wKDEsIDUsIDEsIDYsIFsnJ10pLFxuXHRcdFx0XHRlZGl0T3AoMSwgOSwgMSwgOSwgWydcXG4nXSlcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdCd7Jyxcblx0XHRcdFx0JyAgXCJ4XCI6IDEnLFxuXHRcdFx0XHQnfSdcblx0XHRcdF1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdtYW55IGVkaXRzIHJldmVyc2VkJywgKCkgPT4ge1xuXHRcdHRlc3RBcHBseUVkaXRzV2l0aFN5bmNlZE1vZGVscyhcblx0XHRcdFtcblx0XHRcdFx0J3snLFxuXHRcdFx0XHQnICBcInhcIjogMScsXG5cdFx0XHRcdCd9J1xuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0ZWRpdE9wKDEsIDIsIDIsIDMsIFsnJ10pLFxuXHRcdFx0XHRlZGl0T3AoMiwgNiwgMiwgNiwgWycgJ10pLFxuXHRcdFx0XHRlZGl0T3AoMiwgOSwgMywgMSwgWycnXSlcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdCd7XCJ4XCIgOiAxfSdcblx0XHRcdF1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXBsYWNpbmcgbmV3bGluZXMgMScsICgpID0+IHtcblx0XHR0ZXN0QXBwbHlFZGl0c1dpdGhTeW5jZWRNb2RlbHMoXG5cdFx0XHRbXG5cdFx0XHRcdCd7Jyxcblx0XHRcdFx0J1wiYVwiOiB0cnVlLCcsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnXCJiXCI6IHRydWUnLFxuXHRcdFx0XHQnfSdcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdGVkaXRPcCgxLCAyLCAyLCAxLCBbJycsICdcXHQnXSksXG5cdFx0XHRcdGVkaXRPcCgyLCAxMSwgNCwgMSwgWycnLCAnXFx0J10pXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHQneycsXG5cdFx0XHRcdCdcXHRcImFcIjogdHJ1ZSwnLFxuXHRcdFx0XHQnXFx0XCJiXCI6IHRydWUnLFxuXHRcdFx0XHQnfSdcblx0XHRcdF1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXBsYWNpbmcgbmV3bGluZXMgMicsICgpID0+IHtcblx0XHR0ZXN0QXBwbHlFZGl0c1dpdGhTeW5jZWRNb2RlbHMoXG5cdFx0XHRbXG5cdFx0XHRcdCdzb21lIHRleHQnLFxuXHRcdFx0XHQnc29tZSBtb3JlIHRleHQnLFxuXHRcdFx0XHQnbm93IGNvbWVzIGFuIGVtcHR5IGxpbmUnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0J2FmdGVyIGVtcHR5IGxpbmUnLFxuXHRcdFx0XHQnYW5kIHRoZSBsYXN0IGxpbmUnXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHRlZGl0T3AoMSwgNSwgMywgMSwgWycgdGV4dCcsICdzb21lIG1vcmUgdGV4dCcsICdzb21lIG1vcmUgdGV4dCddKSxcblx0XHRcdFx0ZWRpdE9wKDMsIDIsIDQsIDEsIFsnbyBtb3JlIGxpbmVzJywgJ2FzZCcsICdhc2QnLCAnYXNkJ10pLFxuXHRcdFx0XHRlZGl0T3AoNSwgMSwgNSwgNiwgWyd6enp6enp6eiddKSxcblx0XHRcdFx0ZWRpdE9wKDUsIDExLCA2LCAxNiwgWycxJywgJzInLCAnMycsICc0J10pXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHQnc29tZSB0ZXh0Jyxcblx0XHRcdFx0J3NvbWUgbW9yZSB0ZXh0Jyxcblx0XHRcdFx0J3NvbWUgbW9yZSB0ZXh0bm8gbW9yZSBsaW5lcycsXG5cdFx0XHRcdCdhc2QnLFxuXHRcdFx0XHQnYXNkJyxcblx0XHRcdFx0J2FzZCcsXG5cdFx0XHRcdCd6enp6enp6eiBlbXB0MScsXG5cdFx0XHRcdCcyJyxcblx0XHRcdFx0JzMnLFxuXHRcdFx0XHQnNG5lJ1xuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2FkdmFuY2VkIDEnLCAoKSA9PiB7XG5cdFx0dGVzdEFwcGx5RWRpdHNXaXRoU3luY2VkTW9kZWxzKFxuXHRcdFx0W1xuXHRcdFx0XHQnIHsgICAgICAgXCJkXCI6IFsnLFxuXHRcdFx0XHQnICAgICAgICAgICAgIG51bGwnLFxuXHRcdFx0XHQnICAgICAgICBdIC8qY29tbWVudCovJyxcblx0XHRcdFx0JyAgICAgICAgLFwiZVwiOiAvKmNvbW1lbnQqLyBbbnVsbF0gfScsXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHRlZGl0T3AoMSwgMSwgMSwgMiwgWycnXSksXG5cdFx0XHRcdGVkaXRPcCgxLCAzLCAxLCAxMCwgWycnLCAnICAnXSksXG5cdFx0XHRcdGVkaXRPcCgxLCAxNiwgMiwgMTQsIFsnJywgJyAgICAnXSksXG5cdFx0XHRcdGVkaXRPcCgyLCAxOCwgMywgOSwgWycnLCAnICAnXSksXG5cdFx0XHRcdGVkaXRPcCgzLCAyMiwgNCwgOSwgWycnXSksXG5cdFx0XHRcdGVkaXRPcCg0LCAxMCwgNCwgMTAsIFsnJywgJyAgJ10pLFxuXHRcdFx0XHRlZGl0T3AoNCwgMjgsIDQsIDI4LCBbJycsICcgICAgJ10pLFxuXHRcdFx0XHRlZGl0T3AoNCwgMzIsIDQsIDMyLCBbJycsICcgICddKSxcblx0XHRcdFx0ZWRpdE9wKDQsIDMzLCA0LCAzNCwgWycnLCAnJ10pXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHQneycsXG5cdFx0XHRcdCcgIFwiZFwiOiBbJyxcblx0XHRcdFx0JyAgICBudWxsJyxcblx0XHRcdFx0JyAgXSAvKmNvbW1lbnQqLywnLFxuXHRcdFx0XHQnICBcImVcIjogLypjb21tZW50Ki8gWycsXG5cdFx0XHRcdCcgICAgbnVsbCcsXG5cdFx0XHRcdCcgIF0nLFxuXHRcdFx0XHQnfScsXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnYWR2YW5jZWQgc2ltcGxpZmllZCcsICgpID0+IHtcblx0XHR0ZXN0QXBwbHlFZGl0c1dpdGhTeW5jZWRNb2RlbHMoXG5cdFx0XHRbXG5cdFx0XHRcdCcgICBhYmMnLFxuXHRcdFx0XHQnICxkZWYnXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHRlZGl0T3AoMSwgMSwgMSwgNCwgWycnXSksXG5cdFx0XHRcdGVkaXRPcCgxLCA3LCAyLCAyLCBbJyddKSxcblx0XHRcdFx0ZWRpdE9wKDIsIDMsIDIsIDMsIFsnJywgJyddKVxuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0J2FiYywnLFxuXHRcdFx0XHQnZGVmJ1xuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxNDQnLCAoKSA9PiB7XG5cdFx0dGVzdEFwcGx5RWRpdHNXaXRoU3luY2VkTW9kZWxzKFxuXHRcdFx0W1xuXHRcdFx0XHQncGFja2FnZSBjYWRkeScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnZnVuYyBtYWluKCkgeycsXG5cdFx0XHRcdCdcXHRmbXQuUHJpbnRsbihcIkhlbGxvIFdvcmxkISA6KVwiKScsXG5cdFx0XHRcdCd9Jyxcblx0XHRcdFx0Jydcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdGVkaXRPcCgxLCAxLCA2LCAxLCBbXG5cdFx0XHRcdFx0J3BhY2thZ2UgY2FkZHknLFxuXHRcdFx0XHRcdCcnLFxuXHRcdFx0XHRcdCdpbXBvcnQgXCJmbXRcIicsXG5cdFx0XHRcdFx0JycsXG5cdFx0XHRcdFx0J2Z1bmMgbWFpbigpIHsnLFxuXHRcdFx0XHRcdCdcXHRmbXQuUHJpbnRsbihcIkhlbGxvIFdvcmxkISA6KVwiKScsXG5cdFx0XHRcdFx0J30nLFxuXHRcdFx0XHRcdCcnXG5cdFx0XHRcdF0pXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHQncGFja2FnZSBjYWRkeScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnaW1wb3J0IFwiZm10XCInLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0J2Z1bmMgbWFpbigpIHsnLFxuXHRcdFx0XHQnXFx0Zm10LlByaW50bG4oXCJIZWxsbyBXb3JsZCEgOilcIiknLFxuXHRcdFx0XHQnfScsXG5cdFx0XHRcdCcnXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzI1ODYgUmVwbGFjaW5nIHNlbGVjdGVkIGVuZC1vZi1saW5lIHdpdGggbmV3bGluZSBsb2NrcyB1cCB0aGUgZG9jdW1lbnQnLCAoKSA9PiB7XG5cdFx0dGVzdEFwcGx5RWRpdHNXaXRoU3luY2VkTW9kZWxzKFxuXHRcdFx0W1xuXHRcdFx0XHQnc29tZXRoaW5nJyxcblx0XHRcdFx0J2ludGVyZXN0aW5nJ1xuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0ZWRpdE9wKDEsIDEwLCAyLCAxLCBbJycsICcnXSlcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdCdzb21ldGhpbmcnLFxuXHRcdFx0XHQnaW50ZXJlc3RpbmcnXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzM5ODAnLCAoKSA9PiB7XG5cdFx0dGVzdEFwcGx5RWRpdHNXaXRoU3luY2VkTW9kZWxzKFxuXHRcdFx0W1xuXHRcdFx0XHQnY2xhc3MgQSB7Jyxcblx0XHRcdFx0JyAgICBzb21lUHJvcGVydHkgPSBmYWxzZTsnLFxuXHRcdFx0XHQnICAgIHNvbWVNZXRob2QoKSB7Jyxcblx0XHRcdFx0JyAgICB0aGlzLnNvbWVNZXRob2QoKTsnLFxuXHRcdFx0XHQnICAgIH0nLFxuXHRcdFx0XHQnfScsXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHRlZGl0T3AoMSwgOCwgMSwgOSwgWycnLCAnJ10pLFxuXHRcdFx0XHRlZGl0T3AoMywgMTcsIDMsIDE4LCBbJycsICcnXSksXG5cdFx0XHRcdGVkaXRPcCgzLCAxOCwgMywgMTgsIFsnICAgICddKSxcblx0XHRcdFx0ZWRpdE9wKDQsIDUsIDQsIDUsIFsnICAgICddKSxcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdCdjbGFzcyBBJyxcblx0XHRcdFx0J3snLFxuXHRcdFx0XHQnICAgIHNvbWVQcm9wZXJ0eSA9IGZhbHNlOycsXG5cdFx0XHRcdCcgICAgc29tZU1ldGhvZCgpJyxcblx0XHRcdFx0JyAgICB7Jyxcblx0XHRcdFx0JyAgICAgICAgdGhpcy5zb21lTWV0aG9kKCk7Jyxcblx0XHRcdFx0JyAgICB9Jyxcblx0XHRcdFx0J30nLFxuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIHRlc3RBcHBseUVkaXRzRmFpbHMob3JpZ2luYWw6IHN0cmluZ1tdLCBlZGl0czogSVNpbmdsZUVkaXRPcGVyYXRpb25bXSk6IHZvaWQge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKG9yaWdpbmFsLmpvaW4oJ1xcbicpKTtcblxuXHRcdGxldCBoYXNUaHJvd24gPSBmYWxzZTtcblx0XHR0cnkge1xuXHRcdFx0bW9kZWwuYXBwbHlFZGl0cyhlZGl0cyk7XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRoYXNUaHJvd24gPSB0cnVlO1xuXHRcdH1cblx0XHRhc3NlcnQub2soaGFzVGhyb3duLCAnZXhwZWN0ZWQgbW9kZWwuYXBwbHlFZGl0cyB0byBmYWlsLicpO1xuXG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9XG5cblx0dGVzdCgndG91Y2hpbmcgZWRpdHM6IHR3byBpbnNlcnRzIGF0IHRoZSBzYW1lIHBvc2l0aW9uJywgKCkgPT4ge1xuXHRcdHRlc3RBcHBseUVkaXRzV2l0aFN5bmNlZE1vZGVscyhcblx0XHRcdFtcblx0XHRcdFx0J2hlbGxvIHdvcmxkJ1xuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0ZWRpdE9wKDEsIDEsIDEsIDEsIFsnYSddKSxcblx0XHRcdFx0ZWRpdE9wKDEsIDEsIDEsIDEsIFsnYiddKSxcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdCdhYmhlbGxvIHdvcmxkJ1xuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3RvdWNoaW5nIGVkaXRzOiBpbnNlcnQgYW5kIHJlcGxhY2UgdG91Y2hpbmcnLCAoKSA9PiB7XG5cdFx0dGVzdEFwcGx5RWRpdHNXaXRoU3luY2VkTW9kZWxzKFxuXHRcdFx0W1xuXHRcdFx0XHQnaGVsbG8gd29ybGQnXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHRlZGl0T3AoMSwgMSwgMSwgMSwgWydiJ10pLFxuXHRcdFx0XHRlZGl0T3AoMSwgMSwgMSwgMywgWydhYiddKSxcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdCdiYWJsbG8gd29ybGQnXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnb3ZlcmxhcHBpbmcgZWRpdHM6IHR3byBvdmVybGFwcGluZyByZXBsYWNlcycsICgpID0+IHtcblx0XHR0ZXN0QXBwbHlFZGl0c0ZhaWxzKFxuXHRcdFx0W1xuXHRcdFx0XHQnaGVsbG8gd29ybGQnXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHRlZGl0T3AoMSwgMSwgMSwgMiwgWydiJ10pLFxuXHRcdFx0XHRlZGl0T3AoMSwgMSwgMSwgMywgWydhYiddKSxcblx0XHRcdF1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdvdmVybGFwcGluZyBlZGl0czogdHdvIG92ZXJsYXBwaW5nIGRlbGV0ZXMnLCAoKSA9PiB7XG5cdFx0dGVzdEFwcGx5RWRpdHNGYWlscyhcblx0XHRcdFtcblx0XHRcdFx0J2hlbGxvIHdvcmxkJ1xuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0ZWRpdE9wKDEsIDEsIDEsIDIsIFsnJ10pLFxuXHRcdFx0XHRlZGl0T3AoMSwgMSwgMSwgMywgWycnXSksXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgndG91Y2hpbmcgZWRpdHM6IHR3byB0b3VjaGluZyByZXBsYWNlcycsICgpID0+IHtcblx0XHR0ZXN0QXBwbHlFZGl0c1dpdGhTeW5jZWRNb2RlbHMoXG5cdFx0XHRbXG5cdFx0XHRcdCdoZWxsbyB3b3JsZCdcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdGVkaXRPcCgxLCAxLCAxLCAyLCBbJ0gnXSksXG5cdFx0XHRcdGVkaXRPcCgxLCAyLCAxLCAzLCBbJ0UnXSksXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHQnSEVsbG8gd29ybGQnXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgndG91Y2hpbmcgZWRpdHM6IHR3byB0b3VjaGluZyBkZWxldGVzJywgKCkgPT4ge1xuXHRcdHRlc3RBcHBseUVkaXRzV2l0aFN5bmNlZE1vZGVscyhcblx0XHRcdFtcblx0XHRcdFx0J2hlbGxvIHdvcmxkJ1xuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0ZWRpdE9wKDEsIDEsIDEsIDIsIFsnJ10pLFxuXHRcdFx0XHRlZGl0T3AoMSwgMiwgMSwgMywgWycnXSksXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHQnbGxvIHdvcmxkJ1xuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3RvdWNoaW5nIGVkaXRzOiBpbnNlcnQgYW5kIHJlcGxhY2UnLCAoKSA9PiB7XG5cdFx0dGVzdEFwcGx5RWRpdHNXaXRoU3luY2VkTW9kZWxzKFxuXHRcdFx0W1xuXHRcdFx0XHQnaGVsbG8gd29ybGQnXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHRlZGl0T3AoMSwgMSwgMSwgMSwgWydIJ10pLFxuXHRcdFx0XHRlZGl0T3AoMSwgMSwgMSwgMywgWydlJ10pLFxuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0J0hlbGxvIHdvcmxkJ1xuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3RvdWNoaW5nIGVkaXRzOiByZXBsYWNlIGFuZCBpbnNlcnQnLCAoKSA9PiB7XG5cdFx0dGVzdEFwcGx5RWRpdHNXaXRoU3luY2VkTW9kZWxzKFxuXHRcdFx0W1xuXHRcdFx0XHQnaGVsbG8gd29ybGQnXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHRlZGl0T3AoMSwgMSwgMSwgMywgWydIJ10pLFxuXHRcdFx0XHRlZGl0T3AoMSwgMywgMSwgMywgWydlJ10pLFxuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0J0hlbGxvIHdvcmxkJ1xuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NoYW5nZSB3aGlsZSBlbWl0dGluZyBldmVudHMgMScsICgpID0+IHtcblx0XHRsZXQgZGlzcG9zYWJsZSE6IElEaXNwb3NhYmxlO1xuXHRcdGFzc2VydFN5bmNlZE1vZGVscygnSGVsbG8nLCAobW9kZWwsIGFzc2VydE1pcnJvck1vZGVscykgPT4ge1xuXHRcdFx0bW9kZWwuYXBwbHlFZGl0cyhbe1xuXHRcdFx0XHRyYW5nZTogbmV3IFJhbmdlKDEsIDYsIDEsIDYpLFxuXHRcdFx0XHR0ZXh0OiAnIHdvcmxkIScsXG5cdFx0XHRcdC8vIGZvcmNlTW92ZU1hcmtlcnM6IGZhbHNlXG5cdFx0XHR9XSk7XG5cblx0XHRcdGFzc2VydE1pcnJvck1vZGVscygpO1xuXG5cdFx0fSwgKG1vZGVsKSA9PiB7XG5cdFx0XHRsZXQgaXNGaXJzdFRpbWUgPSB0cnVlO1xuXHRcdFx0ZGlzcG9zYWJsZSA9IG1vZGVsLm9uRGlkQ2hhbmdlQ29udGVudCgoKSA9PiB7XG5cdFx0XHRcdGlmICghaXNGaXJzdFRpbWUpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aXNGaXJzdFRpbWUgPSBmYWxzZTtcblxuXHRcdFx0XHRtb2RlbC5hcHBseUVkaXRzKFt7XG5cdFx0XHRcdFx0cmFuZ2U6IG5ldyBSYW5nZSgxLCAxMywgMSwgMTMpLFxuXHRcdFx0XHRcdHRleHQ6ICcgSG93IGFyZSB5b3U/Jyxcblx0XHRcdFx0XHQvLyBmb3JjZU1vdmVNYXJrZXJzOiBmYWxzZVxuXHRcdFx0XHR9XSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnY2hhbmdlIHdoaWxlIGVtaXR0aW5nIGV2ZW50cyAyJywgKCkgPT4ge1xuXHRcdGxldCBkaXNwb3NhYmxlITogSURpc3Bvc2FibGU7XG5cdFx0YXNzZXJ0U3luY2VkTW9kZWxzKCdIZWxsbycsIChtb2RlbCwgYXNzZXJ0TWlycm9yTW9kZWxzKSA9PiB7XG5cdFx0XHRtb2RlbC5hcHBseUVkaXRzKFt7XG5cdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UoMSwgNiwgMSwgNiksXG5cdFx0XHRcdHRleHQ6ICcgd29ybGQhJyxcblx0XHRcdFx0Ly8gZm9yY2VNb3ZlTWFya2VyczogZmFsc2Vcblx0XHRcdH1dKTtcblxuXHRcdFx0YXNzZXJ0TWlycm9yTW9kZWxzKCk7XG5cblx0XHR9LCAobW9kZWwpID0+IHtcblx0XHRcdGxldCBpc0ZpcnN0VGltZSA9IHRydWU7XG5cdFx0XHRkaXNwb3NhYmxlID0gbW9kZWwub25EaWRDaGFuZ2VDb250ZW50KChlOiBJTW9kZWxDb250ZW50Q2hhbmdlZEV2ZW50KSA9PiB7XG5cdFx0XHRcdGlmICghaXNGaXJzdFRpbWUpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aXNGaXJzdFRpbWUgPSBmYWxzZTtcblxuXHRcdFx0XHRtb2RlbC5hcHBseUVkaXRzKFt7XG5cdFx0XHRcdFx0cmFuZ2U6IG5ldyBSYW5nZSgxLCAxMywgMSwgMTMpLFxuXHRcdFx0XHRcdHRleHQ6ICcgSG93IGFyZSB5b3U/Jyxcblx0XHRcdFx0XHQvLyBmb3JjZU1vdmVNYXJrZXJzOiBmYWxzZVxuXHRcdFx0XHR9XSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzE1ODA6IENoYW5nZXMgaW4gbGluZSBlbmRpbmdzIGFyZSBub3QgY29ycmVjdGx5IHJlZmxlY3RlZCBpbiB0aGUgZXh0ZW5zaW9uIGhvc3QsIGxlYWRpbmcgdG8gaW52YWxpZCBvZmZzZXRzIHNlbnQgdG8gZXh0ZXJuYWwgcmVmYWN0b3JpbmcgdG9vbHMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoJ0hlbGxvXFxuV29ybGQhJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldEVPTCgpLCAnXFxuJyk7XG5cblx0XHRjb25zdCBtaXJyb3JNb2RlbDIgPSBuZXcgTWlycm9yVGV4dE1vZGVsKG51bGwhLCBtb2RlbC5nZXRMaW5lc0NvbnRlbnQoKSwgbW9kZWwuZ2V0RU9MKCksIG1vZGVsLmdldFZlcnNpb25JZCgpKTtcblx0XHRsZXQgbWlycm9yTW9kZWwyUHJldlZlcnNpb25JZCA9IG1vZGVsLmdldFZlcnNpb25JZCgpO1xuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IG1vZGVsLm9uRGlkQ2hhbmdlQ29udGVudCgoZTogSU1vZGVsQ29udGVudENoYW5nZWRFdmVudCkgPT4ge1xuXHRcdFx0Y29uc3QgdmVyc2lvbklkID0gZS52ZXJzaW9uSWQ7XG5cdFx0XHRpZiAodmVyc2lvbklkIDwgbWlycm9yTW9kZWwyUHJldlZlcnNpb25JZCkge1xuXHRcdFx0XHRjb25zb2xlLndhcm4oJ01vZGVsIHZlcnNpb24gaWQgZGlkIG5vdCBhZHZhbmNlIGJldHdlZW4gZWRpdHMgKDIpJyk7XG5cdFx0XHR9XG5cdFx0XHRtaXJyb3JNb2RlbDJQcmV2VmVyc2lvbklkID0gdmVyc2lvbklkO1xuXHRcdFx0bWlycm9yTW9kZWwyLm9uRXZlbnRzKGUpO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgYXNzZXJ0TWlycm9yTW9kZWxzID0gKCkgPT4ge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1pcnJvck1vZGVsMi5nZXRUZXh0KCksIG1vZGVsLmdldFZhbHVlKCksICdtaXJyb3IgbW9kZWwgMiB0ZXh0IE9LJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWlycm9yTW9kZWwyLnZlcnNpb24sIG1vZGVsLmdldFZlcnNpb25JZCgpLCAnbWlycm9yIG1vZGVsIDIgdmVyc2lvbiBPSycpO1xuXHRcdH07XG5cblx0XHRtb2RlbC5zZXRFT0woRW5kT2ZMaW5lU2VxdWVuY2UuQ1JMRik7XG5cdFx0YXNzZXJ0TWlycm9yTW9kZWxzKCk7XG5cblx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdFx0bWlycm9yTW9kZWwyLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzQ3NzMzOiBVbmRvIG1hbmdsZXMgdW5pY29kZSBjaGFyYWN0ZXJzJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKCdcXCdcdUQ4M0RcdURDNDFcXCcnKTtcblxuXHRcdG1vZGVsLmFwcGx5RWRpdHMoW1xuXHRcdFx0eyByYW5nZTogbmV3IFJhbmdlKDEsIDEsIDEsIDEpLCB0ZXh0OiAnXCInIH0sXG5cdFx0XHR7IHJhbmdlOiBuZXcgUmFuZ2UoMSwgMiwgMSwgMiksIHRleHQ6ICdcIicgfSxcblx0XHRdKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKSwgJ1wiXFwnXCJcdUQ4M0RcdURDNDFcXCcnKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwudmFsaWRhdGVSYW5nZShuZXcgUmFuZ2UoMSwgMywgMSwgNCkpLCBuZXcgUmFuZ2UoMSwgMywgMSwgNCkpO1xuXG5cdFx0bW9kZWwuYXBwbHlFZGl0cyhbXG5cdFx0XHR7IHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgMSwgMiksIHRleHQ6IG51bGwgfSxcblx0XHRcdHsgcmFuZ2U6IG5ldyBSYW5nZSgxLCAzLCAxLCA0KSwgdGV4dDogbnVsbCB9LFxuXHRcdF0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuTEYpLCAnXFwnXHVEODNEXHVEQzQxXFwnJyk7XG5cblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICM0ODc0MTogQnJva2VuIHVuZG8gc3RhY2sgd2l0aCBtb3ZlIGxpbmVzIHVwIHdpdGggbXVsdGlwbGUgY3Vyc29ycycsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChbXG5cdFx0XHQnbGluZTEnLFxuXHRcdFx0J2xpbmUyJyxcblx0XHRcdCdsaW5lMycsXG5cdFx0XHQnJyxcblx0XHRdLmpvaW4oJ1xcbicpKTtcblxuXHRcdGNvbnN0IHVuZG9FZGl0cyA9IG1vZGVsLmFwcGx5RWRpdHMoW1xuXHRcdFx0eyByYW5nZTogbmV3IFJhbmdlKDQsIDEsIDQsIDEpLCB0ZXh0OiAnbGluZTMnLCB9LFxuXHRcdFx0eyByYW5nZTogbmV3IFJhbmdlKDMsIDEsIDMsIDYpLCB0ZXh0OiBudWxsLCB9LFxuXHRcdFx0eyByYW5nZTogbmV3IFJhbmdlKDIsIDEsIDMsIDEpLCB0ZXh0OiBudWxsLCB9LFxuXHRcdFx0eyByYW5nZTogbmV3IFJhbmdlKDMsIDYsIDMsIDYpLCB0ZXh0OiAnXFxubGluZTInIH1cblx0XHRdLCB0cnVlKTtcblxuXHRcdG1vZGVsLmFwcGx5RWRpdHModW5kb0VkaXRzKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ2xpbmUxXFxubGluZTJcXG5saW5lM1xcbicpO1xuXG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1h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O0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQTtBQUFBLE1BQ3FCO0FBQUEsSUFDdEI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLDRCQUE0QixNQUFNO0FBQ3RDO0FBQUEsTUFDQztBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxRQUNDLE9BQU8sR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLEVBQUUsQ0FBQztBQUFBLFFBQ3ZCLE9BQU8sR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLEVBQUUsQ0FBQztBQUFBLE1BQ3hCO0FBQUEsTUFDQTtBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssZ0NBQWdDLE1BQU07QUFDMUM7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBO0FBQUEsUUFDQyxPQUFPLEdBQUcsR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUM7QUFBQSxRQUN4QixPQUFPLEdBQUcsR0FBRyxHQUFHLEdBQUcsQ0FBQyxJQUFJLEdBQUcsQ0FBQztBQUFBLE1BQzdCO0FBQUEsTUFDQTtBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLHFCQUFxQixNQUFNO0FBQy9CO0FBQUEsTUFDQztBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxRQUNDLE9BQU8sR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLEVBQUUsQ0FBQztBQUFBLE1BQ3hCO0FBQUEsTUFDQTtBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLG9CQUFvQixNQUFNO0FBQzlCO0FBQUEsTUFDQztBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxRQUNDLE9BQU8sR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLEVBQUUsQ0FBQztBQUFBLFFBQ3ZCLE9BQU8sR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLEVBQUUsQ0FBQztBQUFBLE1BQ3hCO0FBQUEsTUFDQTtBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLGlDQUFpQyxNQUFNO0FBQzNDO0FBQUEsTUFDQztBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxRQUNDLE9BQU8sR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQztBQUFBLE1BQzVCO0FBQUEsTUFDQTtBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLGlDQUFpQyxNQUFNO0FBQzNDO0FBQUEsTUFDQztBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxRQUNDLE9BQU8sR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQztBQUFBLE1BQzVCO0FBQUEsTUFDQTtBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLHNCQUFzQixNQUFNO0FBQ2hDO0FBQUEsTUFDQztBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxRQUNDLE9BQU8sR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDO0FBQUEsTUFDNUI7QUFBQSxNQUNBO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLGdDQUFnQyxNQUFNO0FBQzFDO0FBQUEsTUFDQztBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxRQUNDLE9BQU8sR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLGFBQWEsV0FBVyxDQUFDO0FBQUEsTUFDOUM7QUFBQSxNQUNBO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLGlDQUFpQyxNQUFNO0FBQzNDO0FBQUEsTUFDQztBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxRQUNDLE9BQU8sR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLGFBQWEsK0JBQStCLFdBQVcsQ0FBQztBQUFBLE1BQzdFO0FBQUEsTUFDQTtBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssa0NBQWtDLE1BQU07QUFDNUM7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLFFBQ0MsT0FBTyxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUMsSUFBSSxJQUFJLElBQUksSUFBSSxFQUFFLENBQUM7QUFBQSxNQUN4QztBQUFBLE1BQ0E7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssNEJBQTRCLE1BQU07QUFDdEM7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLFFBQ0MsT0FBTyxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUMsSUFBSSxJQUFJLElBQUksSUFBSSxFQUFFLENBQUM7QUFBQSxRQUN2QyxPQUFPLEdBQUcsSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQztBQUFBLE1BQ2hDO0FBQUEsTUFDQTtBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUsscUJBQXFCLE1BQU07QUFDL0I7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLFFBQ0MsT0FBTyxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUMsRUFBRSxDQUFDO0FBQUEsTUFDeEI7QUFBQSxNQUNBO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssNkJBQTZCLE1BQU07QUFDdkM7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLFFBQ0MsT0FBTyxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUMsRUFBRSxDQUFDO0FBQUEsTUFDeEI7QUFBQSxNQUNBO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssK0JBQStCLE1BQU07QUFDekM7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLFFBQ0MsT0FBTyxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDO0FBQUEsTUFDekI7QUFBQSxNQUNBO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssK0JBQStCLE1BQU07QUFDekM7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLFFBQ0MsT0FBTyxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDO0FBQUEsTUFDekI7QUFBQSxNQUNBO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssOEJBQThCLE1BQU07QUFDeEM7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFB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
