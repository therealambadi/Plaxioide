import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { EditOperation } from "../../../common/core/editOperation.js";
import { Position } from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
import { Selection } from "../../../common/core/selection.js";
import { withTestCodeEditor } from "../testCodeEditor.js";
function testCommand(lines, selections, edits, expectedLines, expectedSelections) {
  withTestCodeEditor(lines, {}, (editor, viewModel) => {
    const model = editor.getModel();
    viewModel.setSelections("tests", selections);
    model.applyEdits(edits);
    assert.deepStrictEqual(model.getLinesContent(), expectedLines);
    const actualSelections = viewModel.getSelections();
    assert.deepStrictEqual(actualSelections.map((s) => s.toString()), expectedSelections.map((s) => s.toString()));
  });
}
suite("Editor Side Editing - collapsed selection", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("replace at selection", () => {
    testCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth"
      ],
      [new Selection(1, 1, 1, 1)],
      [
        EditOperation.replace(new Selection(1, 1, 1, 1), "something ")
      ],
      [
        "something first",
        "second line",
        "third line",
        "fourth"
      ],
      [new Selection(1, 11, 1, 11)]
    );
  });
  test("replace at selection 2", () => {
    testCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth"
      ],
      [new Selection(1, 1, 1, 6)],
      [
        EditOperation.replace(new Selection(1, 1, 1, 6), "something")
      ],
      [
        "something",
        "second line",
        "third line",
        "fourth"
      ],
      [new Selection(1, 1, 1, 10)]
    );
  });
  test("insert at selection", () => {
    testCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth"
      ],
      [new Selection(1, 1, 1, 1)],
      [
        EditOperation.insert(new Position(1, 1), "something ")
      ],
      [
        "something first",
        "second line",
        "third line",
        "fourth"
      ],
      [new Selection(1, 11, 1, 11)]
    );
  });
  test("insert at selection sitting on max column", () => {
    testCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth"
      ],
      [new Selection(1, 6, 1, 6)],
      [
        EditOperation.insert(new Position(1, 6), " something\nnew ")
      ],
      [
        "first something",
        "new ",
        "second line",
        "third line",
        "fourth"
      ],
      [new Selection(2, 5, 2, 5)]
    );
  });
  test("issue #3994: replace on top of selection", () => {
    testCommand(
      [
        '$obj = New-Object "system.col"'
      ],
      [new Selection(1, 30, 1, 30)],
      [
        EditOperation.replaceMove(new Range(1, 19, 1, 31), '"System.Collections"')
      ],
      [
        '$obj = New-Object "System.Collections"'
      ],
      [new Selection(1, 39, 1, 39)]
    );
  });
  test("issue #15267: Suggestion that adds a line - cursor goes to the wrong line ", () => {
    testCommand(
      [
        "package main",
        "",
        "import (",
        '	"fmt"',
        ")",
        "",
        "func main(",
        "	fmt.Println(strings.Con)",
        "}"
      ],
      [new Selection(8, 25, 8, 25)],
      [
        EditOperation.replaceMove(new Range(5, 1, 5, 1), '	"strings"\n')
      ],
      [
        "package main",
        "",
        "import (",
        '	"fmt"',
        '	"strings"',
        ")",
        "",
        "func main(",
        "	fmt.Println(strings.Con)",
        "}"
      ],
      [new Selection(9, 25, 9, 25)]
    );
  });
  test("issue #15236: Selections broke after deleting text using vscode.TextEditor.edit ", () => {
    testCommand(
      [
        "foofoofoo, foofoofoo, bar"
      ],
      [new Selection(1, 1, 1, 10), new Selection(1, 12, 1, 21)],
      [
        EditOperation.replace(new Range(1, 1, 1, 10), ""),
        EditOperation.replace(new Range(1, 12, 1, 21), "")
      ],
      [
        ", , bar"
      ],
      [new Selection(1, 1, 1, 1), new Selection(1, 3, 1, 3)]
    );
  });
});
suite("SideEditing", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  const LINES = [
    "My First Line",
    "My Second Line",
    "Third Line"
  ];
  function _runTest(selection, editRange, editText, editForceMoveMarkers, expected, msg) {
    withTestCodeEditor(LINES.join("\n"), {}, (editor, viewModel) => {
      viewModel.setSelections("tests", [selection]);
      editor.getModel().applyEdits([{
        range: editRange,
        text: editText,
        forceMoveMarkers: editForceMoveMarkers
      }]);
      const actual = viewModel.getSelection();
      assert.deepStrictEqual(actual.toString(), expected.toString(), msg);
    });
  }
  function runTest(selection, editRange, editText, expected) {
    const sel1 = new Selection(selection.startLineNumber, selection.startColumn, selection.endLineNumber, selection.endColumn);
    _runTest(sel1, editRange, editText, false, expected[0][0], "0-0-regular-no-force");
    _runTest(sel1, editRange, editText, true, expected[1][0], "1-0-regular-force");
    const sel2 = new Selection(selection.endLineNumber, selection.endColumn, selection.startLineNumber, selection.startColumn);
    _runTest(sel2, editRange, editText, false, expected[0][1], "0-1-inverse-no-force");
    _runTest(sel2, editRange, editText, true, expected[1][1], "1-1-inverse-force");
  }
  suite("insert", () => {
    suite("collapsed sel", () => {
      test("before", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 3, 1, 3),
          "xx",
          [
            [new Selection(1, 6, 1, 6), new Selection(1, 6, 1, 6)],
            [new Selection(1, 6, 1, 6), new Selection(1, 6, 1, 6)]
          ]
        );
      });
      test("equal", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 4, 1, 4),
          "xx",
          [
            [new Selection(1, 6, 1, 6), new Selection(1, 6, 1, 6)],
            [new Selection(1, 6, 1, 6), new Selection(1, 6, 1, 6)]
          ]
        );
      });
      test("after", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 5, 1, 5),
          "xx",
          [
            [new Selection(1, 4, 1, 4), new Selection(1, 4, 1, 4)],
            [new Selection(1, 4, 1, 4), new Selection(1, 4, 1, 4)]
          ]
        );
      });
    });
    suite("non-collapsed dec", () => {
      test("before", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 3, 1, 3),
          "xx",
          [
            [new Selection(1, 6, 1, 11), new Selection(1, 11, 1, 6)],
            [new Selection(1, 6, 1, 11), new Selection(1, 11, 1, 6)]
          ]
        );
      });
      test("start", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 4, 1, 4),
          "xx",
          [
            [new Selection(1, 4, 1, 11), new Selection(1, 11, 1, 4)],
            [new Selection(1, 6, 1, 11), new Selection(1, 11, 1, 6)]
          ]
        );
      });
      test("inside", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 5, 1, 5),
          "xx",
          [
            [new Selection(1, 4, 1, 11), new Selection(1, 11, 1, 4)],
            [new Selection(1, 4, 1, 11), new Selection(1, 11, 1, 4)]
          ]
        );
      });
      test("end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 9, 1, 9),
          "xx",
          [
            [new Selection(1, 4, 1, 11), new Selection(1, 11, 1, 4)],
            [new Selection(1, 4, 1, 11), new Selection(1, 11, 1, 4)]
          ]
        );
      });
      test("after", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 10, 1, 10),
          "xx",
          [
            [new Selection(1, 4, 1, 9), new Selection(1, 9, 1, 4)],
            [new Selection(1, 4, 1, 9), new Selection(1, 9, 1, 4)]
          ]
        );
      });
    });
  });
  suite("delete", () => {
    suite("collapsed dec", () => {
      test("edit.end < range.start", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 1, 1, 3),
          "",
          [
            [new Selection(1, 2, 1, 2), new Selection(1, 2, 1, 2)],
            [new Selection(1, 2, 1, 2), new Selection(1, 2, 1, 2)]
          ]
        );
      });
      test("edit.end <= range.start", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 2, 1, 4),
          "",
          [
            [new Selection(1, 2, 1, 2), new Selection(1, 2, 1, 2)],
            [new Selection(1, 2, 1, 2), new Selection(1, 2, 1, 2)]
          ]
        );
      });
      test("edit.start < range.start && edit.end > range.end", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 3, 1, 5),
          "",
          [
            [new Selection(1, 3, 1, 3), new Selection(1, 3, 1, 3)],
            [new Selection(1, 3, 1, 3), new Selection(1, 3, 1, 3)]
          ]
        );
      });
      test("edit.start >= range.end", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 4, 1, 6),
          "",
          [
            [new Selection(1, 4, 1, 4), new Selection(1, 4, 1, 4)],
            [new Selection(1, 4, 1, 4), new Selection(1, 4, 1, 4)]
          ]
        );
      });
      test("edit.start > range.end", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 5, 1, 7),
          "",
          [
            [new Selection(1, 4, 1, 4), new Selection(1, 4, 1, 4)],
            [new Selection(1, 4, 1, 4), new Selection(1, 4, 1, 4)]
          ]
        );
      });
    });
    suite("non-collapsed dec", () => {
      test("edit.end < range.start", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 1, 1, 3),
          "",
          [
            [new Selection(1, 2, 1, 7), new Selection(1, 7, 1, 2)],
            [new Selection(1, 2, 1, 7), new Selection(1, 7, 1, 2)]
          ]
        );
      });
      test("edit.end <= range.start", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 2, 1, 4),
          "",
          [
            [new Selection(1, 2, 1, 7), new Selection(1, 7, 1, 2)],
            [new Selection(1, 2, 1, 7), new Selection(1, 7, 1, 2)]
          ]
        );
      });
      test("edit.start < range.start && edit.end < range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 3, 1, 5),
          "",
          [
            [new Selection(1, 3, 1, 7), new Selection(1, 7, 1, 3)],
            [new Selection(1, 3, 1, 7), new Selection(1, 7, 1, 3)]
          ]
        );
      });
      test("edit.start < range.start && edit.end == range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 3, 1, 9),
          "",
          [
            [new Selection(1, 3, 1, 3), new Selection(1, 3, 1, 3)],
            [new Selection(1, 3, 1, 3), new Selection(1, 3, 1, 3)]
          ]
        );
      });
      test("edit.start < range.start && edit.end > range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 3, 1, 10),
          "",
          [
            [new Selection(1, 3, 1, 3), new Selection(1, 3, 1, 3)],
            [new Selection(1, 3, 1, 3), new Selection(1, 3, 1, 3)]
          ]
        );
      });
      test("edit.start == range.start && edit.end < range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 4, 1, 6),
          "",
          [
            [new Selection(1, 4, 1, 7), new Selection(1, 7, 1, 4)],
            [new Selection(1, 4, 1, 7), new Selection(1, 7, 1, 4)]
          ]
        );
      });
      test("edit.start == range.start && edit.end == range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 4, 1, 9),
          "",
          [
            [new Selection(1, 4, 1, 4), new Selection(1, 4, 1, 4)],
            [new Selection(1, 4, 1, 4), new Selection(1, 4, 1, 4)]
          ]
        );
      });
      test("edit.start == range.start && edit.end > range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 4, 1, 10),
          "",
          [
            [new Selection(1, 4, 1, 4), new Selection(1, 4, 1, 4)],
            [new Selection(1, 4, 1, 4), new Selection(1, 4, 1, 4)]
          ]
        );
      });
      test("edit.start > range.start && edit.start < range.end && edit.end < range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 5, 1, 7),
          "",
          [
            [new Selection(1, 4, 1, 7), new Selection(1, 7, 1, 4)],
            [new Selection(1, 4, 1, 7), new Selection(1, 7, 1, 4)]
          ]
        );
      });
      test("edit.start > range.start && edit.start < range.end && edit.end == range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 5, 1, 9),
          "",
          [
            [new Selection(1, 4, 1, 5), new Selection(1, 5, 1, 4)],
            [new Selection(1, 4, 1, 5), new Selection(1, 5, 1, 4)]
          ]
        );
      });
      test("edit.start > range.start && edit.start < range.end && edit.end > range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 5, 1, 10),
          "",
          [
            [new Selection(1, 4, 1, 5), new Selection(1, 5, 1, 4)],
            [new Selection(1, 4, 1, 5), new Selection(1, 5, 1, 4)]
          ]
        );
      });
      test("edit.start == range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 9, 1, 11),
          "",
          [
            [new Selection(1, 4, 1, 9), new Selection(1, 9, 1, 4)],
            [new Selection(1, 4, 1, 9), new Selection(1, 9, 1, 4)]
          ]
        );
      });
      test("edit.start > range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 10, 1, 11),
          "",
          [
            [new Selection(1, 4, 1, 9), new Selection(1, 9, 1, 4)],
            [new Selection(1, 4, 1, 9), new Selection(1, 9, 1, 4)]
          ]
        );
      });
    });
  });
  suite("replace short", () => {
    suite("collapsed dec", () => {
      test("edit.end < range.start", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 1, 1, 3),
          "c",
          [
            [new Selection(1, 3, 1, 3), new Selection(1, 3, 1, 3)],
            [new Selection(1, 3, 1, 3), new Selection(1, 3, 1, 3)]
          ]
        );
      });
      test("edit.end <= range.start", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 2, 1, 4),
          "c",
          [
            [new Selection(1, 3, 1, 3), new Selection(1, 3, 1, 3)],
            [new Selection(1, 3, 1, 3), new Selection(1, 3, 1, 3)]
          ]
        );
      });
      test("edit.start < range.start && edit.end > range.end", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 3, 1, 5),
          "c",
          [
            [new Selection(1, 4, 1, 4), new Selection(1, 4, 1, 4)],
            [new Selection(1, 4, 1, 4), new Selection(1, 4, 1, 4)]
          ]
        );
      });
      test("edit.start >= range.end", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 4, 1, 6),
          "c",
          [
            [new Selection(1, 4, 1, 4), new Selection(1, 4, 1, 4)],
            [new Selection(1, 5, 1, 5), new Selection(1, 5, 1, 5)]
          ]
        );
      });
      test("edit.start > range.end", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 5, 1, 7),
          "c",
          [
            [new Selection(1, 4, 1, 4), new Selection(1, 4, 1, 4)],
            [new Selection(1, 4, 1, 4), new Selection(1, 4, 1, 4)]
          ]
        );
      });
    });
    suite("non-collapsed dec", () => {
      test("edit.end < range.start", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 1, 1, 3),
          "c",
          [
            [new Selection(1, 3, 1, 8), new Selection(1, 8, 1, 3)],
            [new Selection(1, 3, 1, 8), new Selection(1, 8, 1, 3)]
          ]
        );
      });
      test("edit.end <= range.start", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 2, 1, 4),
          "c",
          [
            [new Selection(1, 3, 1, 8), new Selection(1, 8, 1, 3)],
            [new Selection(1, 3, 1, 8), new Selection(1, 8, 1, 3)]
          ]
        );
      });
      test("edit.start < range.start && edit.end < range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 3, 1, 5),
          "c",
          [
            [new Selection(1, 4, 1, 8), new Selection(1, 8, 1, 4)],
            [new Selection(1, 4, 1, 8), new Selection(1, 8, 1, 4)]
          ]
        );
      });
      test("edit.start < range.start && edit.end == range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 3, 1, 9),
          "c",
          [
            [new Selection(1, 4, 1, 4), new Selection(1, 4, 1, 4)],
            [new Selection(1, 4, 1, 4), new Selection(1, 4, 1, 4)]
          ]
        );
      });
      test("edit.start < range.start && edit.end > range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 3, 1, 10),
          "c",
          [
            [new Selection(1, 4, 1, 4), new Selection(1, 4, 1, 4)],
            [new Selection(1, 4, 1, 4), new Selection(1, 4, 1, 4)]
          ]
        );
      });
      test("edit.start == range.start && edit.end < range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 4, 1, 6),
          "c",
          [
            [new Selection(1, 4, 1, 8), new Selection(1, 8, 1, 4)],
            [new Selection(1, 5, 1, 8), new Selection(1, 8, 1, 5)]
          ]
        );
      });
      test("edit.start == range.start && edit.end == range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 4, 1, 9),
          "c",
          [
            [new Selection(1, 4, 1, 5), new Selection(1, 5, 1, 4)],
            [new Selection(1, 5, 1, 5), new Selection(1, 5, 1, 5)]
          ]
        );
      });
      test("edit.start == range.start && edit.end > range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 4, 1, 10),
          "c",
          [
            [new Selection(1, 4, 1, 5), new Selection(1, 5, 1, 4)],
            [new Selection(1, 5, 1, 5), new Selection(1, 5, 1, 5)]
          ]
        );
      });
      test("edit.start > range.start && edit.start < range.end && edit.end < range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 5, 1, 7),
          "c",
          [
            [new Selection(1, 4, 1, 8), new Selection(1, 8, 1, 4)],
            [new Selection(1, 4, 1, 8), new Selection(1, 8, 1, 4)]
          ]
        );
      });
      test("edit.start > range.start && edit.start < range.end && edit.end == range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 5, 1, 9),
          "c",
          [
            [new Selection(1, 4, 1, 6), new Selection(1, 6, 1, 4)],
            [new Selection(1, 4, 1, 6), new Selection(1, 6, 1, 4)]
          ]
        );
      });
      test("edit.start > range.start && edit.start < range.end && edit.end > range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 5, 1, 10),
          "c",
          [
            [new Selection(1, 4, 1, 6), new Selection(1, 6, 1, 4)],
            [new Selection(1, 4, 1, 6), new Selection(1, 6, 1, 4)]
          ]
        );
      });
      test("edit.start == range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 9, 1, 11),
          "c",
          [
            [new Selection(1, 4, 1, 9), new Selection(1, 9, 1, 4)],
            [new Selection(1, 4, 1, 10), new Selection(1, 10, 1, 4)]
          ]
        );
      });
      test("edit.start > range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 10, 1, 11),
          "c",
          [
            [new Selection(1, 4, 1, 9), new Selection(1, 9, 1, 4)],
            [new Selection(1, 4, 1, 9), new Selection(1, 9, 1, 4)]
          ]
        );
      });
    });
  });
  suite("replace long", () => {
    suite("collapsed dec", () => {
      test("edit.end < range.start", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 1, 1, 3),
          "cccc",
          [
            [new Selection(1, 6, 1, 6), new Selection(1, 6, 1, 6)],
            [new Selection(1, 6, 1, 6), new Selection(1, 6, 1, 6)]
          ]
        );
      });
      test("edit.end <= range.start", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 2, 1, 4),
          "cccc",
          [
            [new Selection(1, 6, 1, 6), new Selection(1, 6, 1, 6)],
            [new Selection(1, 6, 1, 6), new Selection(1, 6, 1, 6)]
          ]
        );
      });
      test("edit.start < range.start && edit.end > range.end", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 3, 1, 5),
          "cccc",
          [
            [new Selection(1, 4, 1, 4), new Selection(1, 4, 1, 4)],
            [new Selection(1, 7, 1, 7), new Selection(1, 7, 1, 7)]
          ]
        );
      });
      test("edit.start >= range.end", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 4, 1, 6),
          "cccc",
          [
            [new Selection(1, 4, 1, 4), new Selection(1, 4, 1, 4)],
            [new Selection(1, 8, 1, 8), new Selection(1, 8, 1, 8)]
          ]
        );
      });
      test("edit.start > range.end", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 5, 1, 7),
          "cccc",
          [
            [new Selection(1, 4, 1, 4), new Selection(1, 4, 1, 4)],
            [new Selection(1, 4, 1, 4), new Selection(1, 4, 1, 4)]
          ]
        );
      });
    });
    suite("non-collapsed dec", () => {
      test("edit.end < range.start", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 1, 1, 3),
          "cccc",
          [
            [new Selection(1, 6, 1, 11), new Selection(1, 11, 1, 6)],
            [new Selection(1, 6, 1, 11), new Selection(1, 11, 1, 6)]
          ]
        );
      });
      test("edit.end <= range.start", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 2, 1, 4),
          "cccc",
          [
            [new Selection(1, 4, 1, 11), new Selection(1, 11, 1, 4)],
            [new Selection(1, 6, 1, 11), new Selection(1, 11, 1, 6)]
          ]
        );
      });
      test("edit.start < range.start && edit.end < range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 3, 1, 5),
          "cccc",
          [
            [new Selection(1, 4, 1, 11), new Selection(1, 11, 1, 4)],
            [new Selection(1, 7, 1, 11), new Selection(1, 11, 1, 7)]
          ]
        );
      });
      test("edit.start < range.start && edit.end == range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 3, 1, 9),
          "cccc",
          [
            [new Selection(1, 4, 1, 7), new Selection(1, 7, 1, 4)],
            [new Selection(1, 7, 1, 7), new Selection(1, 7, 1, 7)]
          ]
        );
      });
      test("edit.start < range.start && edit.end > range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 3, 1, 10),
          "cccc",
          [
            [new Selection(1, 4, 1, 7), new Selection(1, 7, 1, 4)],
            [new Selection(1, 7, 1, 7), new Selection(1, 7, 1, 7)]
          ]
        );
      });
      test("edit.start == range.start && edit.end < range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 4, 1, 6),
          "cccc",
          [
            [new Selection(1, 4, 1, 11), new Selection(1, 11, 1, 4)],
            [new Selection(1, 8, 1, 11), new Selection(1, 11, 1, 8)]
          ]
        );
      });
      test("edit.start == range.start && edit.end == range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 4, 1, 9),
          "cccc",
          [
            [new Selection(1, 4, 1, 8), new Selection(1, 8, 1, 4)],
            [new Selection(1, 8, 1, 8), new Selection(1, 8, 1, 8)]
          ]
        );
      });
      test("edit.start == range.start && edit.end > range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 4, 1, 10),
          "cccc",
          [
            [new Selection(1, 4, 1, 8), new Selection(1, 8, 1, 4)],
            [new Selection(1, 8, 1, 8), new Selection(1, 8, 1, 8)]
          ]
        );
      });
      test("edit.start > range.start && edit.start < range.end && edit.end < range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 5, 1, 7),
          "cccc",
          [
            [new Selection(1, 4, 1, 11), new Selection(1, 11, 1, 4)],
            [new Selection(1, 4, 1, 11), new Selection(1, 11, 1, 4)]
          ]
        );
      });
      test("edit.start > range.start && edit.start < range.end && edit.end == range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 5, 1, 9),
          "cccc",
          [
            [new Selection(1, 4, 1, 9), new Selection(1, 9, 1, 4)],
            [new Selection(1, 4, 1, 9), new Selection(1, 9, 1, 4)]
          ]
        );
      });
      test("edit.start > range.start && edit.start < range.end && edit.end > range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 5, 1, 10),
          "cccc",
          [
            [new Selection(1, 4, 1, 9), new Selection(1, 9, 1, 4)],
            [new Selection(1, 4, 1, 9), new Selection(1, 9, 1, 4)]
          ]
        );
      });
      test("edit.start == range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 9, 1, 11),
          "cccc",
          [
            [new Selection(1, 4, 1, 9), new Selection(1, 9, 1, 4)],
            [new Selection(1, 4, 1, 13), new Selection(1, 13, 1, 4)]
          ]
        );
      });
      test("edit.start > range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 10, 1, 11),
          "cccc",
          [
            [new Selection(1, 4, 1, 9), new Selection(1, 9, 1, 4)],
            [new Selection(1, 4, 1, 9), new Selection(1, 9, 1, 4)]
          ]
        );
      });
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9icm93c2VyL2NvbW1hbmRzL3NpZGVFZGl0aW5nLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IEVkaXRPcGVyYXRpb24sIElTaW5nbGVFZGl0T3BlcmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvZWRpdE9wZXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IHdpdGhUZXN0Q29kZUVkaXRvciB9IGZyb20gJy4uL3Rlc3RDb2RlRWRpdG9yLmpzJztcblxuZnVuY3Rpb24gdGVzdENvbW1hbmQobGluZXM6IHN0cmluZ1tdLCBzZWxlY3Rpb25zOiBTZWxlY3Rpb25bXSwgZWRpdHM6IElTaW5nbGVFZGl0T3BlcmF0aW9uW10sIGV4cGVjdGVkTGluZXM6IHN0cmluZ1tdLCBleHBlY3RlZFNlbGVjdGlvbnM6IFNlbGVjdGlvbltdKTogdm9pZCB7XG5cdHdpdGhUZXN0Q29kZUVkaXRvcihsaW5lcywge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCkhO1xuXG5cdFx0dmlld01vZGVsLnNldFNlbGVjdGlvbnMoJ3Rlc3RzJywgc2VsZWN0aW9ucyk7XG5cblx0XHRtb2RlbC5hcHBseUVkaXRzKGVkaXRzKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZXNDb250ZW50KCksIGV4cGVjdGVkTGluZXMpO1xuXG5cdFx0Y29uc3QgYWN0dWFsU2VsZWN0aW9ucyA9IHZpZXdNb2RlbC5nZXRTZWxlY3Rpb25zKCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWxTZWxlY3Rpb25zLm1hcChzID0+IHMudG9TdHJpbmcoKSksIGV4cGVjdGVkU2VsZWN0aW9ucy5tYXAocyA9PiBzLnRvU3RyaW5nKCkpKTtcblxuXHR9KTtcbn1cblxuc3VpdGUoJ0VkaXRvciBTaWRlIEVkaXRpbmcgLSBjb2xsYXBzZWQgc2VsZWN0aW9uJywgKCkgPT4ge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ3JlcGxhY2UgYXQgc2VsZWN0aW9uJywgKCkgPT4ge1xuXHRcdHRlc3RDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnc2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGgnXG5cdFx0XHRdLFxuXHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSldLFxuXHRcdFx0W1xuXHRcdFx0XHRFZGl0T3BlcmF0aW9uLnJlcGxhY2UobmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSwgJ3NvbWV0aGluZyAnKVxuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0J3NvbWV0aGluZyBmaXJzdCcsXG5cdFx0XHRcdCdzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCdcblx0XHRcdF0sXG5cdFx0XHRbbmV3IFNlbGVjdGlvbigxLCAxMSwgMSwgMTEpXVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlcGxhY2UgYXQgc2VsZWN0aW9uIDInLCAoKSA9PiB7XG5cdFx0dGVzdENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCdcblx0XHRcdF0sXG5cdFx0XHRbbmV3IFNlbGVjdGlvbigxLCAxLCAxLCA2KV0sXG5cdFx0XHRbXG5cdFx0XHRcdEVkaXRPcGVyYXRpb24ucmVwbGFjZShuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDYpLCAnc29tZXRoaW5nJylcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdCdzb21ldGhpbmcnLFxuXHRcdFx0XHQnc2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGgnXG5cdFx0XHRdLFxuXHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMTApXVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2luc2VydCBhdCBzZWxlY3Rpb24nLCAoKSA9PiB7XG5cdFx0dGVzdENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCdcblx0XHRcdF0sXG5cdFx0XHRbbmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKV0sXG5cdFx0XHRbXG5cdFx0XHRcdEVkaXRPcGVyYXRpb24uaW5zZXJ0KG5ldyBQb3NpdGlvbigxLCAxKSwgJ3NvbWV0aGluZyAnKVxuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0J3NvbWV0aGluZyBmaXJzdCcsXG5cdFx0XHRcdCdzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCdcblx0XHRcdF0sXG5cdFx0XHRbbmV3IFNlbGVjdGlvbigxLCAxMSwgMSwgMTEpXVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2luc2VydCBhdCBzZWxlY3Rpb24gc2l0dGluZyBvbiBtYXggY29sdW1uJywgKCkgPT4ge1xuXHRcdHRlc3RDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnc2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGgnXG5cdFx0XHRdLFxuXHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgNiwgMSwgNildLFxuXHRcdFx0W1xuXHRcdFx0XHRFZGl0T3BlcmF0aW9uLmluc2VydChuZXcgUG9zaXRpb24oMSwgNiksICcgc29tZXRoaW5nXFxubmV3ICcpXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3Qgc29tZXRoaW5nJyxcblx0XHRcdFx0J25ldyAnLFxuXHRcdFx0XHQnc2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGgnXG5cdFx0XHRdLFxuXHRcdFx0W25ldyBTZWxlY3Rpb24oMiwgNSwgMiwgNSldXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzM5OTQ6IHJlcGxhY2Ugb24gdG9wIG9mIHNlbGVjdGlvbicsICgpID0+IHtcblx0XHR0ZXN0Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0JyRvYmogPSBOZXctT2JqZWN0IFwic3lzdGVtLmNvbFwiJ1xuXHRcdFx0XSxcblx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDMwLCAxLCAzMCldLFxuXHRcdFx0W1xuXHRcdFx0XHRFZGl0T3BlcmF0aW9uLnJlcGxhY2VNb3ZlKG5ldyBSYW5nZSgxLCAxOSwgMSwgMzEpLCAnXCJTeXN0ZW0uQ29sbGVjdGlvbnNcIicpXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHQnJG9iaiA9IE5ldy1PYmplY3QgXCJTeXN0ZW0uQ29sbGVjdGlvbnNcIidcblx0XHRcdF0sXG5cdFx0XHRbbmV3IFNlbGVjdGlvbigxLCAzOSwgMSwgMzkpXVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxNTI2NzogU3VnZ2VzdGlvbiB0aGF0IGFkZHMgYSBsaW5lIC0gY3Vyc29yIGdvZXMgdG8gdGhlIHdyb25nIGxpbmUgJywgKCkgPT4ge1xuXHRcdHRlc3RDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQncGFja2FnZSBtYWluJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCdpbXBvcnQgKCcsXG5cdFx0XHRcdCdcdFwiZm10XCInLFxuXHRcdFx0XHQnKScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnZnVuYyBtYWluKCcsXG5cdFx0XHRcdCdcdGZtdC5QcmludGxuKHN0cmluZ3MuQ29uKScsXG5cdFx0XHRcdCd9J1xuXHRcdFx0XSxcblx0XHRcdFtuZXcgU2VsZWN0aW9uKDgsIDI1LCA4LCAyNSldLFxuXHRcdFx0W1xuXHRcdFx0XHRFZGl0T3BlcmF0aW9uLnJlcGxhY2VNb3ZlKG5ldyBSYW5nZSg1LCAxLCA1LCAxKSwgJ1xcdFxcXCJzdHJpbmdzXFxcIlxcbicpXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHQncGFja2FnZSBtYWluJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCdpbXBvcnQgKCcsXG5cdFx0XHRcdCdcdFwiZm10XCInLFxuXHRcdFx0XHQnXHRcInN0cmluZ3NcIicsXG5cdFx0XHRcdCcpJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCdmdW5jIG1haW4oJyxcblx0XHRcdFx0J1x0Zm10LlByaW50bG4oc3RyaW5ncy5Db24pJyxcblx0XHRcdFx0J30nXG5cdFx0XHRdLFxuXHRcdFx0W25ldyBTZWxlY3Rpb24oOSwgMjUsIDksIDI1KV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTUyMzY6IFNlbGVjdGlvbnMgYnJva2UgYWZ0ZXIgZGVsZXRpbmcgdGV4dCB1c2luZyB2c2NvZGUuVGV4dEVkaXRvci5lZGl0ICcsICgpID0+IHtcblx0XHR0ZXN0Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J2Zvb2Zvb2ZvbywgZm9vZm9vZm9vLCBiYXInXG5cdFx0XHRdLFxuXHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMTApLCBuZXcgU2VsZWN0aW9uKDEsIDEyLCAxLCAyMSldLFxuXHRcdFx0W1xuXHRcdFx0XHRFZGl0T3BlcmF0aW9uLnJlcGxhY2UobmV3IFJhbmdlKDEsIDEsIDEsIDEwKSwgJycpLFxuXHRcdFx0XHRFZGl0T3BlcmF0aW9uLnJlcGxhY2UobmV3IFJhbmdlKDEsIDEyLCAxLCAyMSksICcnKSxcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdCcsICwgYmFyJ1xuXHRcdFx0XSxcblx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpLCBuZXcgU2VsZWN0aW9uKDEsIDMsIDEsIDMpXVxuXHRcdCk7XG5cdH0pO1xufSk7XG5cbnN1aXRlKCdTaWRlRWRpdGluZycsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRjb25zdCBMSU5FUyA9IFtcblx0XHQnTXkgRmlyc3QgTGluZScsXG5cdFx0J015IFNlY29uZCBMaW5lJyxcblx0XHQnVGhpcmQgTGluZSdcblx0XTtcblxuXHRmdW5jdGlvbiBfcnVuVGVzdChzZWxlY3Rpb246IFNlbGVjdGlvbiwgZWRpdFJhbmdlOiBSYW5nZSwgZWRpdFRleHQ6IHN0cmluZywgZWRpdEZvcmNlTW92ZU1hcmtlcnM6IGJvb2xlYW4sIGV4cGVjdGVkOiBTZWxlY3Rpb24sIG1zZzogc3RyaW5nKTogdm9pZCB7XG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKExJTkVTLmpvaW4oJ1xcbicpLCB7fSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHR2aWV3TW9kZWwuc2V0U2VsZWN0aW9ucygndGVzdHMnLCBbc2VsZWN0aW9uXSk7XG5cdFx0XHRlZGl0b3IuZ2V0TW9kZWwoKS5hcHBseUVkaXRzKFt7XG5cdFx0XHRcdHJhbmdlOiBlZGl0UmFuZ2UsXG5cdFx0XHRcdHRleHQ6IGVkaXRUZXh0LFxuXHRcdFx0XHRmb3JjZU1vdmVNYXJrZXJzOiBlZGl0Rm9yY2VNb3ZlTWFya2Vyc1xuXHRcdFx0fV0pO1xuXHRcdFx0Y29uc3QgYWN0dWFsID0gdmlld01vZGVsLmdldFNlbGVjdGlvbigpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwudG9TdHJpbmcoKSwgZXhwZWN0ZWQudG9TdHJpbmcoKSwgbXNnKTtcblx0XHR9KTtcblx0fVxuXG5cdGZ1bmN0aW9uIHJ1blRlc3Qoc2VsZWN0aW9uOiBSYW5nZSwgZWRpdFJhbmdlOiBSYW5nZSwgZWRpdFRleHQ6IHN0cmluZywgZXhwZWN0ZWQ6IFNlbGVjdGlvbltdW10pOiB2b2lkIHtcblx0XHRjb25zdCBzZWwxID0gbmV3IFNlbGVjdGlvbihzZWxlY3Rpb24uc3RhcnRMaW5lTnVtYmVyLCBzZWxlY3Rpb24uc3RhcnRDb2x1bW4sIHNlbGVjdGlvbi5lbmRMaW5lTnVtYmVyLCBzZWxlY3Rpb24uZW5kQ29sdW1uKTtcblx0XHRfcnVuVGVzdChzZWwxLCBlZGl0UmFuZ2UsIGVkaXRUZXh0LCBmYWxzZSwgZXhwZWN0ZWRbMF1bMF0sICcwLTAtcmVndWxhci1uby1mb3JjZScpO1xuXHRcdF9ydW5UZXN0KHNlbDEsIGVkaXRSYW5nZSwgZWRpdFRleHQsIHRydWUsIGV4cGVjdGVkWzFdWzBdLCAnMS0wLXJlZ3VsYXItZm9yY2UnKTtcblxuXHRcdC8vIFJUTCBzZWxlY3Rpb25cblx0XHRjb25zdCBzZWwyID0gbmV3IFNlbGVjdGlvbihzZWxlY3Rpb24uZW5kTGluZU51bWJlciwgc2VsZWN0aW9uLmVuZENvbHVtbiwgc2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlciwgc2VsZWN0aW9uLnN0YXJ0Q29sdW1uKTtcblx0XHRfcnVuVGVzdChzZWwyLCBlZGl0UmFuZ2UsIGVkaXRUZXh0LCBmYWxzZSwgZXhwZWN0ZWRbMF1bMV0sICcwLTEtaW52ZXJzZS1uby1mb3JjZScpO1xuXHRcdF9ydW5UZXN0KHNlbDIsIGVkaXRSYW5nZSwgZWRpdFRleHQsIHRydWUsIGV4cGVjdGVkWzFdWzFdLCAnMS0xLWludmVyc2UtZm9yY2UnKTtcblx0fVxuXG5cdHN1aXRlKCdpbnNlcnQnLCAoKSA9PiB7XG5cdFx0c3VpdGUoJ2NvbGxhcHNlZCBzZWwnLCAoKSA9PiB7XG5cdFx0XHR0ZXN0KCdiZWZvcmUnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDQpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCAzLCAxLCAzKSwgJ3h4Jyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA2LCAxLCA2KSwgbmV3IFNlbGVjdGlvbigxLCA2LCAxLCA2KV0sXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA2LCAxLCA2KSwgbmV3IFNlbGVjdGlvbigxLCA2LCAxLCA2KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdlcXVhbCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgNCksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDQpLCAneHgnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDYsIDEsIDYpLCBuZXcgU2VsZWN0aW9uKDEsIDYsIDEsIDYpXSxcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDYsIDEsIDYpLCBuZXcgU2VsZWN0aW9uKDEsIDYsIDEsIDYpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ2FmdGVyJywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA0KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNSwgMSwgNSksICd4eCcsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNCksIG5ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNCldLFxuXHRcdFx0XHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNCksIG5ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNCldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHRcdHN1aXRlKCdub24tY29sbGFwc2VkIGRlYycsICgpID0+IHtcblx0XHRcdHRlc3QoJ2JlZm9yZScsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgOSksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDMsIDEsIDMpLCAneHgnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDYsIDEsIDExKSwgbmV3IFNlbGVjdGlvbigxLCAxMSwgMSwgNildLFxuXHRcdFx0XHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgNiwgMSwgMTEpLCBuZXcgU2VsZWN0aW9uKDEsIDExLCAxLCA2KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdzdGFydCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgOSksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDQpLCAneHgnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDExKSwgbmV3IFNlbGVjdGlvbigxLCAxMSwgMSwgNCldLFxuXHRcdFx0XHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgNiwgMSwgMTEpLCBuZXcgU2VsZWN0aW9uKDEsIDExLCAxLCA2KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdpbnNpZGUnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA1LCAxLCA1KSwgJ3h4Jyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCAxMSksIG5ldyBTZWxlY3Rpb24oMSwgMTEsIDEsIDQpXSxcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDExKSwgbmV3IFNlbGVjdGlvbigxLCAxMSwgMSwgNCldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnZW5kJywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgOSwgMSwgOSksICd4eCcsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgNCwgMSwgMTEpLCBuZXcgU2VsZWN0aW9uKDEsIDExLCAxLCA0KV0sXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCAxMSksIG5ldyBTZWxlY3Rpb24oMSwgMTEsIDEsIDQpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ2FmdGVyJywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgMTAsIDEsIDEwKSwgJ3h4Jyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA5KSwgbmV3IFNlbGVjdGlvbigxLCA5LCAxLCA0KV0sXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA5KSwgbmV3IFNlbGVjdGlvbigxLCA5LCAxLCA0KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdkZWxldGUnLCAoKSA9PiB7XG5cdFx0c3VpdGUoJ2NvbGxhcHNlZCBkZWMnLCAoKSA9PiB7XG5cdFx0XHR0ZXN0KCdlZGl0LmVuZCA8IHJhbmdlLnN0YXJ0JywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA0KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgMSwgMSwgMyksICcnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDIsIDEsIDIpLCBuZXcgU2VsZWN0aW9uKDEsIDIsIDEsIDIpXSxcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDIsIDEsIDIpLCBuZXcgU2VsZWN0aW9uKDEsIDIsIDEsIDIpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ2VkaXQuZW5kIDw9IHJhbmdlLnN0YXJ0JywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA0KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgMiwgMSwgNCksICcnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDIsIDEsIDIpLCBuZXcgU2VsZWN0aW9uKDEsIDIsIDEsIDIpXSxcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDIsIDEsIDIpLCBuZXcgU2VsZWN0aW9uKDEsIDIsIDEsIDIpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ2VkaXQuc3RhcnQgPCByYW5nZS5zdGFydCAmJiBlZGl0LmVuZCA+IHJhbmdlLmVuZCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgNCksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDMsIDEsIDUpLCAnJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCAzLCAxLCAzKSwgbmV3IFNlbGVjdGlvbigxLCAzLCAxLCAzKV0sXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCAzLCAxLCAzKSwgbmV3IFNlbGVjdGlvbigxLCAzLCAxLCAzKV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdlZGl0LnN0YXJ0ID49IHJhbmdlLmVuZCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgNCksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDYpLCAnJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA0KSwgbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA0KV0sXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA0KSwgbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA0KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdlZGl0LnN0YXJ0ID4gcmFuZ2UuZW5kJywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA0KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNSwgMSwgNyksICcnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDQpLCBuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDQpXSxcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDQpLCBuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDQpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHRzdWl0ZSgnbm9uLWNvbGxhcHNlZCBkZWMnLCAoKSA9PiB7XG5cdFx0XHR0ZXN0KCdlZGl0LmVuZCA8IHJhbmdlLnN0YXJ0JywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgMSwgMSwgMyksICcnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDIsIDEsIDcpLCBuZXcgU2VsZWN0aW9uKDEsIDcsIDEsIDIpXSxcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDIsIDEsIDcpLCBuZXcgU2VsZWN0aW9uKDEsIDcsIDEsIDIpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ2VkaXQuZW5kIDw9IHJhbmdlLnN0YXJ0JywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgMiwgMSwgNCksICcnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDIsIDEsIDcpLCBuZXcgU2VsZWN0aW9uKDEsIDcsIDEsIDIpXSxcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDIsIDEsIDcpLCBuZXcgU2VsZWN0aW9uKDEsIDcsIDEsIDIpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ2VkaXQuc3RhcnQgPCByYW5nZS5zdGFydCAmJiBlZGl0LmVuZCA8IHJhbmdlLmVuZCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgOSksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDMsIDEsIDUpLCAnJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCAzLCAxLCA3KSwgbmV3IFNlbGVjdGlvbigxLCA3LCAxLCAzKV0sXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCAzLCAxLCA3KSwgbmV3IFNlbGVjdGlvbigxLCA3LCAxLCAzKV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ2VkaXQuc3RhcnQgPCByYW5nZS5zdGFydCAmJiBlZGl0LmVuZCA9PSByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCAzLCAxLCA5KSwgJycsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgMywgMSwgMyksIG5ldyBTZWxlY3Rpb24oMSwgMywgMSwgMyldLFxuXHRcdFx0XHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgMywgMSwgMyksIG5ldyBTZWxlY3Rpb24oMSwgMywgMSwgMyldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXN0KCdlZGl0LnN0YXJ0IDwgcmFuZ2Uuc3RhcnQgJiYgZWRpdC5lbmQgPiByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCAzLCAxLCAxMCksICcnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDMsIDEsIDMpLCBuZXcgU2VsZWN0aW9uKDEsIDMsIDEsIDMpXSxcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDMsIDEsIDMpLCBuZXcgU2VsZWN0aW9uKDEsIDMsIDEsIDMpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgnZWRpdC5zdGFydCA9PSByYW5nZS5zdGFydCAmJiBlZGl0LmVuZCA8IHJhbmdlLmVuZCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgOSksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDYpLCAnJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA3KSwgbmV3IFNlbGVjdGlvbigxLCA3LCAxLCA0KV0sXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA3KSwgbmV3IFNlbGVjdGlvbigxLCA3LCAxLCA0KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ2VkaXQuc3RhcnQgPT0gcmFuZ2Uuc3RhcnQgJiYgZWRpdC5lbmQgPT0gcmFuZ2UuZW5kJywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgOSksICcnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDQpLCBuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDQpXSxcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDQpLCBuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDQpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgnZWRpdC5zdGFydCA9PSByYW5nZS5zdGFydCAmJiBlZGl0LmVuZCA+IHJhbmdlLmVuZCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgOSksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDEwKSwgJycsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNCksIG5ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNCldLFxuXHRcdFx0XHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNCksIG5ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNCldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXN0KCdlZGl0LnN0YXJ0ID4gcmFuZ2Uuc3RhcnQgJiYgZWRpdC5zdGFydCA8IHJhbmdlLmVuZCAmJiBlZGl0LmVuZCA8IHJhbmdlLmVuZCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgOSksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDUsIDEsIDcpLCAnJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA3KSwgbmV3IFNlbGVjdGlvbigxLCA3LCAxLCA0KV0sXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA3KSwgbmV3IFNlbGVjdGlvbigxLCA3LCAxLCA0KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ2VkaXQuc3RhcnQgPiByYW5nZS5zdGFydCAmJiBlZGl0LnN0YXJ0IDwgcmFuZ2UuZW5kICYmIGVkaXQuZW5kID09IHJhbmdlLmVuZCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgOSksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDUsIDEsIDkpLCAnJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA1KSwgbmV3IFNlbGVjdGlvbigxLCA1LCAxLCA0KV0sXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA1KSwgbmV3IFNlbGVjdGlvbigxLCA1LCAxLCA0KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ2VkaXQuc3RhcnQgPiByYW5nZS5zdGFydCAmJiBlZGl0LnN0YXJ0IDwgcmFuZ2UuZW5kICYmIGVkaXQuZW5kID4gcmFuZ2UuZW5kJywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNSwgMSwgMTApLCAnJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA1KSwgbmV3IFNlbGVjdGlvbigxLCA1LCAxLCA0KV0sXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA1KSwgbmV3IFNlbGVjdGlvbigxLCA1LCAxLCA0KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ2VkaXQuc3RhcnQgPT0gcmFuZ2UuZW5kJywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgOSwgMSwgMTEpLCAnJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA5KSwgbmV3IFNlbGVjdGlvbigxLCA5LCAxLCA0KV0sXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA5KSwgbmV3IFNlbGVjdGlvbigxLCA5LCAxLCA0KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ2VkaXQuc3RhcnQgPiByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCAxMCwgMSwgMTEpLCAnJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA5KSwgbmV3IFNlbGVjdGlvbigxLCA5LCAxLCA0KV0sXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA5KSwgbmV3IFNlbGVjdGlvbigxLCA5LCAxLCA0KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdyZXBsYWNlIHNob3J0JywgKCkgPT4ge1xuXHRcdHN1aXRlKCdjb2xsYXBzZWQgZGVjJywgKCkgPT4ge1xuXHRcdFx0dGVzdCgnZWRpdC5lbmQgPCByYW5nZS5zdGFydCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgNCksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDEsIDEsIDMpLCAnYycsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgMywgMSwgMyksIG5ldyBTZWxlY3Rpb24oMSwgMywgMSwgMyldLFxuXHRcdFx0XHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgMywgMSwgMyksIG5ldyBTZWxlY3Rpb24oMSwgMywgMSwgMyldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnZWRpdC5lbmQgPD0gcmFuZ2Uuc3RhcnQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDQpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCAyLCAxLCA0KSwgJ2MnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDMsIDEsIDMpLCBuZXcgU2VsZWN0aW9uKDEsIDMsIDEsIDMpXSxcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDMsIDEsIDMpLCBuZXcgU2VsZWN0aW9uKDEsIDMsIDEsIDMpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ2VkaXQuc3RhcnQgPCByYW5nZS5zdGFydCAmJiBlZGl0LmVuZCA+IHJhbmdlLmVuZCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgNCksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDMsIDEsIDUpLCAnYycsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNCksIG5ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNCldLFxuXHRcdFx0XHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNCksIG5ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNCldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnZWRpdC5zdGFydCA+PSByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDQpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA2KSwgJ2MnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDQpLCBuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDQpXSxcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDUsIDEsIDUpLCBuZXcgU2VsZWN0aW9uKDEsIDUsIDEsIDUpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ2VkaXQuc3RhcnQgPiByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDQpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA1LCAxLCA3KSwgJ2MnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDQpLCBuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDQpXSxcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDQpLCBuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDQpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHRzdWl0ZSgnbm9uLWNvbGxhcHNlZCBkZWMnLCAoKSA9PiB7XG5cdFx0XHR0ZXN0KCdlZGl0LmVuZCA8IHJhbmdlLnN0YXJ0JywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgMSwgMSwgMyksICdjJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCAzLCAxLCA4KSwgbmV3IFNlbGVjdGlvbigxLCA4LCAxLCAzKV0sXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCAzLCAxLCA4KSwgbmV3IFNlbGVjdGlvbigxLCA4LCAxLCAzKV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdlZGl0LmVuZCA8PSByYW5nZS5zdGFydCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgOSksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDIsIDEsIDQpLCAnYycsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgMywgMSwgOCksIG5ldyBTZWxlY3Rpb24oMSwgOCwgMSwgMyldLFxuXHRcdFx0XHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgMywgMSwgOCksIG5ldyBTZWxlY3Rpb24oMSwgOCwgMSwgMyldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnZWRpdC5zdGFydCA8IHJhbmdlLnN0YXJ0ICYmIGVkaXQuZW5kIDwgcmFuZ2UuZW5kJywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgMywgMSwgNSksICdjJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA4KSwgbmV3IFNlbGVjdGlvbigxLCA4LCAxLCA0KV0sXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA4KSwgbmV3IFNlbGVjdGlvbigxLCA4LCAxLCA0KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdlZGl0LnN0YXJ0IDwgcmFuZ2Uuc3RhcnQgJiYgZWRpdC5lbmQgPT0gcmFuZ2UuZW5kJywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgMywgMSwgOSksICdjJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA0KSwgbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA0KV0sXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA0KSwgbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA0KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdlZGl0LnN0YXJ0IDwgcmFuZ2Uuc3RhcnQgJiYgZWRpdC5lbmQgPiByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCAzLCAxLCAxMCksICdjJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA0KSwgbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA0KV0sXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA0KSwgbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA0KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdlZGl0LnN0YXJ0ID09IHJhbmdlLnN0YXJ0ICYmIGVkaXQuZW5kIDwgcmFuZ2UuZW5kJywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgNiksICdjJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA4KSwgbmV3IFNlbGVjdGlvbigxLCA4LCAxLCA0KV0sXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA1LCAxLCA4KSwgbmV3IFNlbGVjdGlvbigxLCA4LCAxLCA1KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdlZGl0LnN0YXJ0ID09IHJhbmdlLnN0YXJ0ICYmIGVkaXQuZW5kID09IHJhbmdlLmVuZCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgOSksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLCAnYycsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNSksIG5ldyBTZWxlY3Rpb24oMSwgNSwgMSwgNCldLFxuXHRcdFx0XHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgNSwgMSwgNSksIG5ldyBTZWxlY3Rpb24oMSwgNSwgMSwgNSldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnZWRpdC5zdGFydCA9PSByYW5nZS5zdGFydCAmJiBlZGl0LmVuZCA+IHJhbmdlLmVuZCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgOSksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDEwKSwgJ2MnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDUpLCBuZXcgU2VsZWN0aW9uKDEsIDUsIDEsIDQpXSxcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDUsIDEsIDUpLCBuZXcgU2VsZWN0aW9uKDEsIDUsIDEsIDUpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ2VkaXQuc3RhcnQgPiByYW5nZS5zdGFydCAmJiBlZGl0LnN0YXJ0IDwgcmFuZ2UuZW5kICYmIGVkaXQuZW5kIDwgcmFuZ2UuZW5kJywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNSwgMSwgNyksICdjJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA4KSwgbmV3IFNlbGVjdGlvbigxLCA4LCAxLCA0KV0sXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA4KSwgbmV3IFNlbGVjdGlvbigxLCA4LCAxLCA0KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdlZGl0LnN0YXJ0ID4gcmFuZ2Uuc3RhcnQgJiYgZWRpdC5zdGFydCA8IHJhbmdlLmVuZCAmJiBlZGl0LmVuZCA9PSByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA1LCAxLCA5KSwgJ2MnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDYpLCBuZXcgU2VsZWN0aW9uKDEsIDYsIDEsIDQpXSxcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDYpLCBuZXcgU2VsZWN0aW9uKDEsIDYsIDEsIDQpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ2VkaXQuc3RhcnQgPiByYW5nZS5zdGFydCAmJiBlZGl0LnN0YXJ0IDwgcmFuZ2UuZW5kICYmIGVkaXQuZW5kID4gcmFuZ2UuZW5kJywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNSwgMSwgMTApLCAnYycsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNiksIG5ldyBTZWxlY3Rpb24oMSwgNiwgMSwgNCldLFxuXHRcdFx0XHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNiksIG5ldyBTZWxlY3Rpb24oMSwgNiwgMSwgNCldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnZWRpdC5zdGFydCA9PSByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA5LCAxLCAxMSksICdjJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA5KSwgbmV3IFNlbGVjdGlvbigxLCA5LCAxLCA0KV0sXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCAxMCksIG5ldyBTZWxlY3Rpb24oMSwgMTAsIDEsIDQpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ2VkaXQuc3RhcnQgPiByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCAxMCwgMSwgMTEpLCAnYycsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgNCwgMSwgOSksIG5ldyBTZWxlY3Rpb24oMSwgOSwgMSwgNCldLFxuXHRcdFx0XHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgNCwgMSwgOSksIG5ldyBTZWxlY3Rpb24oMSwgOSwgMSwgNCldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgncmVwbGFjZSBsb25nJywgKCkgPT4ge1xuXHRcdHN1aXRlKCdjb2xsYXBzZWQgZGVjJywgKCkgPT4ge1xuXHRcdFx0dGVzdCgnZWRpdC5lbmQgPCByYW5nZS5zdGFydCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgNCksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDEsIDEsIDMpLCAnY2NjYycsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgNiwgMSwgNiksIG5ldyBTZWxlY3Rpb24oMSwgNiwgMSwgNildLFxuXHRcdFx0XHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgNiwgMSwgNiksIG5ldyBTZWxlY3Rpb24oMSwgNiwgMSwgNildLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnZWRpdC5lbmQgPD0gcmFuZ2Uuc3RhcnQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDQpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCAyLCAxLCA0KSwgJ2NjY2MnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDYsIDEsIDYpLCBuZXcgU2VsZWN0aW9uKDEsIDYsIDEsIDYpXSxcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDYsIDEsIDYpLCBuZXcgU2VsZWN0aW9uKDEsIDYsIDEsIDYpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ2VkaXQuc3RhcnQgPCByYW5nZS5zdGFydCAmJiBlZGl0LmVuZCA+IHJhbmdlLmVuZCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgNCksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDMsIDEsIDUpLCAnY2NjYycsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNCksIG5ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNCldLFxuXHRcdFx0XHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgNywgMSwgNyksIG5ldyBTZWxlY3Rpb24oMSwgNywgMSwgNyldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnZWRpdC5zdGFydCA+PSByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDQpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA2KSwgJ2NjY2MnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDQpLCBuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDQpXSxcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDgsIDEsIDgpLCBuZXcgU2VsZWN0aW9uKDEsIDgsIDEsIDgpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ2VkaXQuc3RhcnQgPiByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDQpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA1LCAxLCA3KSwgJ2NjY2MnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDQpLCBuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDQpXSxcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDQpLCBuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDQpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHRzdWl0ZSgnbm9uLWNvbGxhcHNlZCBkZWMnLCAoKSA9PiB7XG5cdFx0XHR0ZXN0KCdlZGl0LmVuZCA8IHJhbmdlLnN0YXJ0JywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgMSwgMSwgMyksICdjY2NjJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA2LCAxLCAxMSksIG5ldyBTZWxlY3Rpb24oMSwgMTEsIDEsIDYpXSxcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDYsIDEsIDExKSwgbmV3IFNlbGVjdGlvbigxLCAxMSwgMSwgNildLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnZWRpdC5lbmQgPD0gcmFuZ2Uuc3RhcnQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCAyLCAxLCA0KSwgJ2NjY2MnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDExKSwgbmV3IFNlbGVjdGlvbigxLCAxMSwgMSwgNCldLFxuXHRcdFx0XHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgNiwgMSwgMTEpLCBuZXcgU2VsZWN0aW9uKDEsIDExLCAxLCA2KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdlZGl0LnN0YXJ0IDwgcmFuZ2Uuc3RhcnQgJiYgZWRpdC5lbmQgPCByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCAzLCAxLCA1KSwgJ2NjY2MnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDExKSwgbmV3IFNlbGVjdGlvbigxLCAxMSwgMSwgNCldLFxuXHRcdFx0XHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgNywgMSwgMTEpLCBuZXcgU2VsZWN0aW9uKDEsIDExLCAxLCA3KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdlZGl0LnN0YXJ0IDwgcmFuZ2Uuc3RhcnQgJiYgZWRpdC5lbmQgPT0gcmFuZ2UuZW5kJywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgMywgMSwgOSksICdjY2NjJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA3KSwgbmV3IFNlbGVjdGlvbigxLCA3LCAxLCA0KV0sXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA3LCAxLCA3KSwgbmV3IFNlbGVjdGlvbigxLCA3LCAxLCA3KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdlZGl0LnN0YXJ0IDwgcmFuZ2Uuc3RhcnQgJiYgZWRpdC5lbmQgPiByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCAzLCAxLCAxMCksICdjY2NjJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA3KSwgbmV3IFNlbGVjdGlvbigxLCA3LCAxLCA0KV0sXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA3LCAxLCA3KSwgbmV3IFNlbGVjdGlvbigxLCA3LCAxLCA3KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdlZGl0LnN0YXJ0ID09IHJhbmdlLnN0YXJ0ICYmIGVkaXQuZW5kIDwgcmFuZ2UuZW5kJywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgNiksICdjY2NjJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCAxMSksIG5ldyBTZWxlY3Rpb24oMSwgMTEsIDEsIDQpXSxcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDgsIDEsIDExKSwgbmV3IFNlbGVjdGlvbigxLCAxMSwgMSwgOCldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnZWRpdC5zdGFydCA9PSByYW5nZS5zdGFydCAmJiBlZGl0LmVuZCA9PSByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSwgJ2NjY2MnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDgpLCBuZXcgU2VsZWN0aW9uKDEsIDgsIDEsIDQpXSxcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDgsIDEsIDgpLCBuZXcgU2VsZWN0aW9uKDEsIDgsIDEsIDgpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ2VkaXQuc3RhcnQgPT0gcmFuZ2Uuc3RhcnQgJiYgZWRpdC5lbmQgPiByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCAxMCksICdjY2NjJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA4KSwgbmV3IFNlbGVjdGlvbigxLCA4LCAxLCA0KV0sXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA4LCAxLCA4KSwgbmV3IFNlbGVjdGlvbigxLCA4LCAxLCA4KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdlZGl0LnN0YXJ0ID4gcmFuZ2Uuc3RhcnQgJiYgZWRpdC5zdGFydCA8IHJhbmdlLmVuZCAmJiBlZGl0LmVuZCA8IHJhbmdlLmVuZCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgOSksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDUsIDEsIDcpLCAnY2NjYycsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgNCwgMSwgMTEpLCBuZXcgU2VsZWN0aW9uKDEsIDExLCAxLCA0KV0sXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCAxMSksIG5ldyBTZWxlY3Rpb24oMSwgMTEsIDEsIDQpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ2VkaXQuc3RhcnQgPiByYW5nZS5zdGFydCAmJiBlZGl0LnN0YXJ0IDwgcmFuZ2UuZW5kICYmIGVkaXQuZW5kID09IHJhbmdlLmVuZCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgOSksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDUsIDEsIDkpLCAnY2NjYycsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgNCwgMSwgOSksIG5ldyBTZWxlY3Rpb24oMSwgOSwgMSwgNCldLFxuXHRcdFx0XHRcdFx0W25ldyBTZWxlY3Rpb24oMSwgNCwgMSwgOSksIG5ldyBTZWxlY3Rpb24oMSwgOSwgMSwgNCldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnZWRpdC5zdGFydCA+IHJhbmdlLnN0YXJ0ICYmIGVkaXQuc3RhcnQgPCByYW5nZS5lbmQgJiYgZWRpdC5lbmQgPiByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA1LCAxLCAxMCksICdjY2NjJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA5KSwgbmV3IFNlbGVjdGlvbigxLCA5LCAxLCA0KV0sXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA5KSwgbmV3IFNlbGVjdGlvbigxLCA5LCAxLCA0KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdlZGl0LnN0YXJ0ID09IHJhbmdlLmVuZCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgOSksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDksIDEsIDExKSwgJ2NjY2MnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDkpLCBuZXcgU2VsZWN0aW9uKDEsIDksIDEsIDQpXSxcblx0XHRcdFx0XHRcdFtuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDEzKSwgbmV3IFNlbGVjdGlvbigxLCAxMywgMSwgNCldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnZWRpdC5zdGFydCA+IHJhbmdlLmVuZCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgOSksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDEwLCAxLCAxMSksICdjY2NjJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA5KSwgbmV3IFNlbGVjdGlvbigxLCA5LCAxLCA0KV0sXG5cdFx0XHRcdFx0XHRbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA5KSwgbmV3IFNlbGVjdGlvbigxLCA5LCAxLCA0KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyxxQkFBMkM7QUFDcEQsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsMEJBQTBCO0FBRW5DLFNBQVMsWUFBWSxPQUFpQixZQUF5QixPQUErQixlQUF5QixvQkFBdUM7QUFDN0oscUJBQW1CLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxjQUFjO0FBQ3BELFVBQU0sUUFBUSxPQUFPLFNBQVM7QUFFOUIsY0FBVSxjQUFjLFNBQVMsVUFBVTtBQUUzQyxVQUFNLFdBQVcsS0FBSztBQUV0QixXQUFPLGdCQUFnQixNQUFNLGdCQUFnQixHQUFHLGFBQWE7QUFFN0QsVUFBTSxtQkFBbUIsVUFBVSxjQUFjO0FBQ2pELFdBQU8sZ0JBQWdCLGlCQUFpQixJQUFJLE9BQUssRUFBRSxTQUFTLENBQUMsR0FBRyxtQkFBbUIsSUFBSSxPQUFLLEVBQUUsU0FBUyxDQUFDLENBQUM7QUFBQSxFQUUxRyxDQUFDO0FBQ0Y7QUFFQSxNQUFNLDZDQUE2QyxNQUFNO0FBRXhELDBDQUF3QztBQUV4QyxPQUFLLHdCQUF3QixNQUFNO0FBQ2xDO0FBQUEsTUFDQztBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxDQUFDLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxNQUMxQjtBQUFBLFFBQ0MsY0FBYyxRQUFRLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsWUFBWTtBQUFBLE1BQzlEO0FBQUEsTUFDQTtBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxDQUFDLElBQUksVUFBVSxHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7QUFBQSxJQUM3QjtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssMEJBQTBCLE1BQU07QUFDcEM7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLENBQUMsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLE1BQzFCO0FBQUEsUUFDQyxjQUFjLFFBQVEsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxXQUFXO0FBQUEsTUFDN0Q7QUFBQSxNQUNBO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLENBQUMsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLEVBQUUsQ0FBQztBQUFBLElBQzVCO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyx1QkFBdUIsTUFBTTtBQUNqQztBQUFBLE1BQ0M7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsQ0FBQyxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFDMUI7QUFBQSxRQUNDLGNBQWMsT0FBTyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsWUFBWTtBQUFBLE1BQ3REO0FBQUEsTUFDQTtBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxDQUFDLElBQUksVUFBVSxHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7QUFBQSxJQUM3QjtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssNkNBQTZDLE1BQU07QUFDdkQ7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLENBQUMsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLE1BQzFCO0FBQUEsUUFDQyxjQUFjLE9BQU8sSUFBSSxTQUFTLEdBQUcsQ0FBQyxHQUFHLGtCQUFrQjtBQUFBLE1BQzVEO0FBQUEsTUFDQTtBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsQ0FBQyxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQUEsSUFDM0I7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLDRDQUE0QyxNQUFNO0FBQ3REO0FBQUEsTUFDQztBQUFBLFFBQ0M7QUFBQSxNQUNEO0FBQUEsTUFDQSxDQUFDLElBQUksVUFBVSxHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7QUFBQSxNQUM1QjtBQUFBLFFBQ0MsY0FBYyxZQUFZLElBQUksTUFBTSxHQUFHLElBQUksR0FBRyxFQUFFLEdBQUcsc0JBQXNCO0FBQUEsTUFDMUU7QUFBQSxNQUNBO0FBQUEsUUFDQztBQUFBLE1BQ0Q7QUFBQSxNQUNBLENBQUMsSUFBSSxVQUFVLEdBQUcsSUFBSSxHQUFHLEVBQUUsQ0FBQztBQUFBLElBQzdCO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyw4RUFBOEUsTUFBTTtBQUN4RjtBQUFBLE1BQ0M7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxDQUFDLElBQUksVUFBVSxHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7QUFBQSxNQUM1QjtBQUFBLFFBQ0MsY0FBYyxZQUFZLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsY0FBaUI7QUFBQSxNQUNuRTtBQUFBLE1BQ0E7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsQ0FBQyxJQUFJLFVBQVUsR0FBRyxJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQUEsSUFDN0I7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLG9GQUFvRixNQUFNO0FBQzlGO0FBQUEsTUFDQztBQUFBLFFBQ0M7QUFBQSxNQUNEO0FBQUEsTUFDQSxDQUFDLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxFQUFFLEdBQUcsSUFBSSxVQUFVLEdBQUcsSUFBSSxHQUFHLEVBQUUsQ0FBQztBQUFBLE1BQ3hEO0FBQUEsUUFDQyxjQUFjLFFBQVEsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxFQUFFO0FBQUEsUUFDaEQsY0FBYyxRQUFRLElBQUksTUFBTSxHQUFHLElBQUksR0FBRyxFQUFFLEdBQUcsRUFBRTtBQUFBLE1BQ2xEO0FBQUEsTUFDQTtBQUFBLFFBQ0M7QUFBQSxNQUNEO0FBQUEsTUFDQSxDQUFDLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLElBQ3REO0FBQUEsRUFDRCxDQUFDO0FBQ0YsQ0FBQztBQUVELE1BQU0sZUFBZSxNQUFNO0FBRTFCLDBDQUF3QztBQUV4QyxRQUFNLFFBQVE7QUFBQSxJQUNiO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxFQUNEO0FBRUEsV0FBUyxTQUFTLFdBQXNCLFdBQWtCLFVBQWtCLHNCQUErQixVQUFxQixLQUFtQjtBQUNsSix1QkFBbUIsTUFBTSxLQUFLLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxRQUFRLGNBQWM7QUFDL0QsZ0JBQVUsY0FBYyxTQUFTLENBQUMsU0FBUyxDQUFDO0FBQzVDLGFBQU8sU0FBUyxFQUFFLFdBQVcsQ0FBQztBQUFBLFFBQzdCLE9BQU87QUFBQSxRQUNQLE1BQU07QUFBQSxRQUNOLGtCQUFrQjtBQUFBLE1BQ25CLENBQUMsQ0FBQztBQUNGLFlBQU0sU0FBUyxVQUFVLGFBQWE7QUFDdEMsYUFBTyxnQkFBZ0IsT0FBTyxTQUFTLEdBQUcsU0FBUyxTQUFTLEdBQUcsR0FBRztBQUFBLElBQ25FLENBQUM7QUFBQSxFQUNGO0FBRUEsV0FBUyxRQUFRLFdBQWtCLFdBQWtCLFVBQWtCLFVBQStCO0FBQ3JHLFVBQU0sT0FBTyxJQUFJLFVBQVUsVUFBVSxpQkFBaUIsVUFBVSxhQUFhLFVBQVUsZUFBZSxVQUFVLFNBQVM7QUFDekgsYUFBUyxNQUFNLFdBQVcsVUFBVSxPQUFPLFNBQVMsQ0FBQyxFQUFFLENBQUMsR0FBRyxzQkFBc0I7QUFDakYsYUFBUyxNQUFNLFdBQVcsVUFBVSxNQUFNLFNBQVMsQ0FBQyxFQUFFLENBQUMsR0FBRyxtQkFBbUI7QUFHN0UsVUFBTSxPQUFPLElBQUksVUFBVSxVQUFVLGVBQWUsVUFBVSxXQUFXLFVBQVUsaUJBQWlCLFVBQVUsV0FBVztBQUN6SCxhQUFTLE1BQU0sV0FBVyxVQUFVLE9BQU8sU0FBUyxDQUFDLEVBQUUsQ0FBQyxHQUFHLHNCQUFzQjtBQUNqRixhQUFTLE1BQU0sV0FBVyxVQUFVLE1BQU0sU0FBUyxDQUFDLEVBQUUsQ0FBQyxHQUFHLG1CQUFtQjtBQUFBLEVBQzlFO0FBRUEsUUFBTSxVQUFVLE1BQU07QUFDckIsVUFBTSxpQkFBaUIsTUFBTTtBQUM1QixXQUFLLFVBQVUsTUFBTTtBQUNwQjtBQUFBLFVBQ0MsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUNwQixJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQUc7QUFBQSxVQUN2QjtBQUFBLFlBQ0MsQ0FBQyxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxZQUNyRCxDQUFDLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQ3REO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUssU0FBUyxNQUFNO0FBQ25CO0FBQUEsVUFDQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQ3BCLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRztBQUFBLFVBQ3ZCO0FBQUEsWUFDQyxDQUFDLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQ3JELENBQUMsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQUEsVUFDdEQ7QUFBQSxRQUNEO0FBQUEsTUFDRCxDQUFDO0FBQ0QsV0FBSyxTQUFTLE1BQU07QUFDbkI7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQUEsWUFDckQsQ0FBQyxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxVQUN0RDtBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUM7QUFBQSxJQUNGLENBQUM7QUFDRCxVQUFNLHFCQUFxQixNQUFNO0FBQ2hDLFdBQUssVUFBVSxNQUFNO0FBQ3BCO0FBQUEsVUFDQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQ3BCLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRztBQUFBLFVBQ3ZCO0FBQUEsWUFDQyxDQUFDLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxFQUFFLEdBQUcsSUFBSSxVQUFVLEdBQUcsSUFBSSxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQ3ZELENBQUMsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxJQUFJLFVBQVUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxDQUFDO0FBQUEsVUFDeEQ7QUFBQSxRQUNEO0FBQUEsTUFDRCxDQUFDO0FBQ0QsV0FBSyxTQUFTLE1BQU07QUFDbkI7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxJQUFJLFVBQVUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxDQUFDO0FBQUEsWUFDdkQsQ0FBQyxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsRUFBRSxHQUFHLElBQUksVUFBVSxHQUFHLElBQUksR0FBRyxDQUFDLENBQUM7QUFBQSxVQUN4RDtBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUM7QUFDRCxXQUFLLFVBQVUsTUFBTTtBQUNwQjtBQUFBLFVBQ0MsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUNwQixJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQUc7QUFBQSxVQUN2QjtBQUFBLFlBQ0MsQ0FBQyxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsRUFBRSxHQUFHLElBQUksVUFBVSxHQUFHLElBQUksR0FBRyxDQUFDLENBQUM7QUFBQSxZQUN2RCxDQUFDLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxFQUFFLEdBQUcsSUFBSSxVQUFVLEdBQUcsSUFBSSxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQ3hEO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUssT0FBTyxNQUFNO0FBQ2pCO0FBQUEsVUFDQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQ3BCLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRztBQUFBLFVBQ3ZCO0FBQUEsWUFDQyxDQUFDLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxFQUFFLEdBQUcsSUFBSSxVQUFVLEdBQUcsSUFBSSxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQ3ZELENBQUMsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxJQUFJLFVBQVUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxDQUFDO0FBQUEsVUFDeEQ7QUFBQSxRQUNEO0FBQUEsTUFDRCxDQUFDO0FBQ0QsV0FBSyxTQUFTLE1BQU07QUFDbkI7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxVQUFHO0FBQUEsVUFDekI7QUFBQSxZQUNDLENBQUMsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQUEsWUFDckQsQ0FBQyxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxVQUN0RDtBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUM7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxRQUFNLFVBQVUsTUFBTTtBQUNyQixVQUFNLGlCQUFpQixNQUFNO0FBQzVCLFdBQUssMEJBQTBCLE1BQU07QUFDcEM7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQUEsWUFDckQsQ0FBQyxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxVQUN0RDtBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUM7QUFDRCxXQUFLLDJCQUEyQixNQUFNO0FBQ3JDO0FBQUEsVUFDQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQ3BCLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRztBQUFBLFVBQ3ZCO0FBQUEsWUFDQyxDQUFDLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQ3JELENBQUMsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQUEsVUFDdEQ7QUFBQSxRQUNEO0FBQUEsTUFDRCxDQUFDO0FBQ0QsV0FBSyxvREFBb0QsTUFBTTtBQUM5RDtBQUFBLFVBQ0MsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUNwQixJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQUc7QUFBQSxVQUN2QjtBQUFBLFlBQ0MsQ0FBQyxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxZQUNyRCxDQUFDLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQ3REO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUssMkJBQTJCLE1BQU07QUFDckM7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQUEsWUFDckQsQ0FBQyxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxVQUN0RDtBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUM7QUFDRCxXQUFLLDBCQUEwQixNQUFNO0FBQ3BDO0FBQUEsVUFDQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQ3BCLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRztBQUFBLFVBQ3ZCO0FBQUEsWUFDQyxDQUFDLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQ3JELENBQUMsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQUEsVUFDdEQ7QUFBQSxRQUNEO0FBQUEsTUFDRCxDQUFDO0FBQUEsSUFDRixDQUFDO0FBQ0QsVUFBTSxxQkFBcUIsTUFBTTtBQUNoQyxXQUFLLDBCQUEwQixNQUFNO0FBQ3BDO0FBQUEsVUFDQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQ3BCLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRztBQUFBLFVBQ3ZCO0FBQUEsWUFDQyxDQUFDLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQ3JELENBQUMsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQUEsVUFDdEQ7QUFBQSxRQUNEO0FBQUEsTUFDRCxDQUFDO0FBQ0QsV0FBSywyQkFBMkIsTUFBTTtBQUNyQztBQUFBLFVBQ0MsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUNwQixJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQUc7QUFBQSxVQUN2QjtBQUFBLFlBQ0MsQ0FBQyxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxZQUNyRCxDQUFDLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQ3REO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUssb0RBQW9ELE1BQU07QUFDOUQ7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQUEsWUFDckQsQ0FBQyxJQUFJLFVBQVUsR0FBRyxHQUFHLEdB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Q0FBQztBQUFBLFVBQ3REO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUssMkJBQTJCLE1BQU07QUFDckM7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQUEsWUFDckQsQ0FBQyxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxVQUN0RDtBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUM7QUFDRCxXQUFLLDBCQUEwQixNQUFNO0FBQ3BDO0FBQUEsVUFDQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQ3BCLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRztBQUFBLFVBQ3ZCO0FBQUEsWUFDQyxDQUFDLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQ3JELENBQUMsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQUEsVUFDdEQ7QUFBQSxRQUNEO0FBQUEsTUFDRCxDQUFDO0FBQUEsSUFDRixDQUFDO0FBQ0QsVUFBTSxxQkFBcUIsTUFBTTtBQUNoQyxXQUFLLDBCQUEwQixNQUFNO0FBQ3BDO0FBQUEsVUFDQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQ3BCLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRztBQUFBLFVBQ3ZCO0FBQUEsWUFDQyxDQUFDLElB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SUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQUEsWUFDckQsQ0FBQyxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxVQUN0RDtBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUM7QUFDRCxXQUFLLDBCQUEwQixNQUFNO0FBQ3BDO0FBQUEsVUFDQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQ3BCLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRztBQUFBLFVBQ3ZCO0FBQUEsWUFDQyxDQUFDLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQ3JELENBQUMsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQUEsVUFDdEQ7QUFBQSxRQUNEO0FBQUEsTUFDRCxDQUFDO0FBQUEsSUFDRixDQUFDO0FBQ0QsVUFBTSxxQkFBcUIsTUFBTTtBQUNoQyxXQUFLLDBCQUEwQixNQUFNO0FBQ3BDO0FBQUEsVUFDQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQ3BCLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRztBQUFBLFVBQ3ZCO0FBQUEsWUFDQyxDQUFDLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxFQUFFLEdBQUcsSUFBSSxVQUFVLEdBQUcsSUFBSSxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQ3ZELENBQUMsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxJ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
