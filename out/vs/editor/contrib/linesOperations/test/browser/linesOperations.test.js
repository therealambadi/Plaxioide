import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { CoreEditingCommands } from "../../../../browser/coreCommands.js";
import { Position } from "../../../../common/core/position.js";
import { Selection } from "../../../../common/core/selection.js";
import { Handler } from "../../../../common/editorCommon.js";
import { CamelCaseAction, PascalCaseAction, DeleteAllLeftAction, DeleteAllRightAction, DeleteDuplicateLinesAction, DeleteLinesAction, IndentLinesAction, InsertLineAfterAction, InsertLineBeforeAction, JoinLinesAction, KebabCaseAction, LowerCaseAction, SnakeCaseAction, SortLinesAscendingAction, SortLinesDescendingAction, TitleCaseAction, TransposeAction, UpperCaseAction } from "../../browser/linesOperations.js";
import { withTestCodeEditor } from "../../../../test/browser/testCodeEditor.js";
import { createTextModel } from "../../../../test/common/testTextModel.js";
function assertSelection(editor, expected) {
  if (!Array.isArray(expected)) {
    expected = [expected];
  }
  assert.deepStrictEqual(editor.getSelections(), expected);
}
function executeAction(action, editor) {
  action.run(null, editor, void 0);
}
suite("Editor Contrib - Line Operations", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  suite("SortLinesAscendingAction", () => {
    test("should sort selected lines in ascending order", function() {
      withTestCodeEditor(
        [
          "omicron",
          "beta",
          "alpha"
        ],
        {},
        (editor) => {
          const model = editor.getModel();
          const sortLinesAscendingAction = new SortLinesAscendingAction();
          editor.setSelection(new Selection(1, 1, 3, 5));
          executeAction(sortLinesAscendingAction, editor);
          assert.deepStrictEqual(model.getLinesContent(), [
            "alpha",
            "beta",
            "omicron"
          ]);
          assertSelection(editor, new Selection(1, 1, 3, 7));
        }
      );
    });
    test("should sort lines in ascending order", function() {
      withTestCodeEditor(
        [
          "omicron",
          "beta",
          "alpha"
        ],
        {},
        (editor) => {
          const model = editor.getModel();
          const sortLinesAscendingAction = new SortLinesAscendingAction();
          executeAction(sortLinesAscendingAction, editor);
          assert.deepStrictEqual(model.getLinesContent(), [
            "alpha",
            "beta",
            "omicron"
          ]);
        }
      );
    });
    test("should sort multiple selections in ascending order", function() {
      withTestCodeEditor(
        [
          "omicron",
          "beta",
          "alpha",
          "",
          "omicron",
          "beta",
          "alpha"
        ],
        {},
        (editor) => {
          const model = editor.getModel();
          const sortLinesAscendingAction = new SortLinesAscendingAction();
          editor.setSelections([new Selection(1, 1, 3, 5), new Selection(5, 1, 7, 5)]);
          executeAction(sortLinesAscendingAction, editor);
          assert.deepStrictEqual(model.getLinesContent(), [
            "alpha",
            "beta",
            "omicron",
            "",
            "alpha",
            "beta",
            "omicron"
          ]);
          const expectedSelections = [
            new Selection(1, 1, 3, 7),
            new Selection(5, 1, 7, 7)
          ];
          editor.getSelections().forEach((actualSelection, index) => {
            assert.deepStrictEqual(actualSelection.toString(), expectedSelections[index].toString());
          });
        }
      );
    });
  });
  suite("SortLinesDescendingAction", () => {
    test("should sort selected lines in descending order", function() {
      withTestCodeEditor(
        [
          "alpha",
          "beta",
          "omicron"
        ],
        {},
        (editor) => {
          const model = editor.getModel();
          const sortLinesDescendingAction = new SortLinesDescendingAction();
          editor.setSelection(new Selection(1, 1, 3, 7));
          executeAction(sortLinesDescendingAction, editor);
          assert.deepStrictEqual(model.getLinesContent(), [
            "omicron",
            "beta",
            "alpha"
          ]);
          assertSelection(editor, new Selection(1, 1, 3, 5));
        }
      );
    });
    test("should sort multiple selections in descending order", function() {
      withTestCodeEditor(
        [
          "alpha",
          "beta",
          "omicron",
          "",
          "alpha",
          "beta",
          "omicron"
        ],
        {},
        (editor) => {
          const model = editor.getModel();
          const sortLinesDescendingAction = new SortLinesDescendingAction();
          editor.setSelections([new Selection(1, 1, 3, 7), new Selection(5, 1, 7, 7)]);
          executeAction(sortLinesDescendingAction, editor);
          assert.deepStrictEqual(model.getLinesContent(), [
            "omicron",
            "beta",
            "alpha",
            "",
            "omicron",
            "beta",
            "alpha"
          ]);
          const expectedSelections = [
            new Selection(1, 1, 3, 5),
            new Selection(5, 1, 7, 5)
          ];
          editor.getSelections().forEach((actualSelection, index) => {
            assert.deepStrictEqual(actualSelection.toString(), expectedSelections[index].toString());
          });
        }
      );
    });
  });
  suite("DeleteDuplicateLinesAction", () => {
    test("should remove duplicate lines within selection", function() {
      withTestCodeEditor(
        [
          "alpha",
          "beta",
          "beta",
          "beta",
          "alpha",
          "omicron"
        ],
        {},
        (editor) => {
          const model = editor.getModel();
          const deleteDuplicateLinesAction = new DeleteDuplicateLinesAction();
          editor.setSelection(new Selection(1, 3, 6, 4));
          executeAction(deleteDuplicateLinesAction, editor);
          assert.deepStrictEqual(model.getLinesContent(), [
            "alpha",
            "beta",
            "omicron"
          ]);
          assertSelection(editor, new Selection(1, 1, 3, 7));
        }
      );
    });
    test("should remove duplicate lines", function() {
      withTestCodeEditor(
        [
          "alpha",
          "beta",
          "beta",
          "beta",
          "alpha",
          "omicron"
        ],
        {},
        (editor) => {
          const model = editor.getModel();
          const deleteDuplicateLinesAction = new DeleteDuplicateLinesAction();
          executeAction(deleteDuplicateLinesAction, editor);
          assert.deepStrictEqual(model.getLinesContent(), [
            "alpha",
            "beta",
            "omicron"
          ]);
          assert.ok(editor.getSelection().isEmpty());
        }
      );
    });
    test("should remove duplicate lines in multiple selections", function() {
      withTestCodeEditor(
        [
          "alpha",
          "beta",
          "beta",
          "omicron",
          "",
          "alpha",
          "alpha",
          "beta"
        ],
        {},
        (editor) => {
          const model = editor.getModel();
          const deleteDuplicateLinesAction = new DeleteDuplicateLinesAction();
          editor.setSelections([new Selection(1, 2, 4, 3), new Selection(6, 2, 8, 3)]);
          executeAction(deleteDuplicateLinesAction, editor);
          assert.deepStrictEqual(model.getLinesContent(), [
            "alpha",
            "beta",
            "omicron",
            "",
            "alpha",
            "beta"
          ]);
          const expectedSelections = [
            new Selection(1, 1, 3, 7),
            new Selection(5, 1, 6, 4)
          ];
          editor.getSelections().forEach((actualSelection, index) => {
            assert.deepStrictEqual(actualSelection.toString(), expectedSelections[index].toString());
          });
        }
      );
    });
  });
  suite("DeleteAllLeftAction", () => {
    test("should delete to the left of the cursor", function() {
      withTestCodeEditor(
        [
          "one",
          "two",
          "three"
        ],
        {},
        (editor) => {
          const model = editor.getModel();
          const deleteAllLeftAction = new DeleteAllLeftAction();
          editor.setSelection(new Selection(1, 2, 1, 2));
          executeAction(deleteAllLeftAction, editor);
          assert.strictEqual(model.getLineContent(1), "ne");
          editor.setSelections([new Selection(2, 2, 2, 2), new Selection(3, 2, 3, 2)]);
          executeAction(deleteAllLeftAction, editor);
          assert.strictEqual(model.getLineContent(2), "wo");
          assert.strictEqual(model.getLineContent(3), "hree");
        }
      );
    });
    test("should jump to the previous line when on first column", function() {
      withTestCodeEditor(
        [
          "one",
          "two",
          "three"
        ],
        {},
        (editor) => {
          const model = editor.getModel();
          const deleteAllLeftAction = new DeleteAllLeftAction();
          editor.setSelection(new Selection(2, 1, 2, 1));
          executeAction(deleteAllLeftAction, editor);
          assert.strictEqual(model.getLineContent(1), "onetwo");
          editor.setSelections([new Selection(1, 1, 1, 1), new Selection(2, 1, 2, 1)]);
          executeAction(deleteAllLeftAction, editor);
          assert.strictEqual(model.getLinesContent()[0], "onetwothree");
          assert.strictEqual(model.getLinesContent().length, 1);
          editor.setSelection(new Selection(1, 1, 1, 1));
          executeAction(deleteAllLeftAction, editor);
          assert.strictEqual(model.getLinesContent()[0], "onetwothree");
        }
      );
    });
    test("should keep deleting lines in multi cursor mode", function() {
      withTestCodeEditor(
        [
          "hi my name is Carlos Matos",
          "BCC",
          "waso waso waso",
          "my wife doesnt believe in me",
          "nonononono",
          "bitconneeeect"
        ],
        {},
        (editor) => {
          const model = editor.getModel();
          const deleteAllLeftAction = new DeleteAllLeftAction();
          const beforeSecondWasoSelection = new Selection(3, 5, 3, 5);
          const endOfBCCSelection = new Selection(2, 4, 2, 4);
          const endOfNonono = new Selection(5, 11, 5, 11);
          editor.setSelections([beforeSecondWasoSelection, endOfBCCSelection, endOfNonono]);
          executeAction(deleteAllLeftAction, editor);
          let selections = editor.getSelections();
          assert.strictEqual(model.getLineContent(2), "");
          assert.strictEqual(model.getLineContent(3), " waso waso");
          assert.strictEqual(model.getLineContent(5), "");
          assert.deepStrictEqual([
            selections[0].startLineNumber,
            selections[0].startColumn,
            selections[0].endLineNumber,
            selections[0].endColumn
          ], [3, 1, 3, 1]);
          assert.deepStrictEqual([
            selections[1].startLineNumber,
            selections[1].startColumn,
            selections[1].endLineNumber,
            selections[1].endColumn
          ], [2, 1, 2, 1]);
          assert.deepStrictEqual([
            selections[2].startLineNumber,
            selections[2].startColumn,
            selections[2].endLineNumber,
            selections[2].endColumn
          ], [5, 1, 5, 1]);
          executeAction(deleteAllLeftAction, editor);
          selections = editor.getSelections();
          assert.strictEqual(model.getLineContent(1), "hi my name is Carlos Matos waso waso");
          assert.strictEqual(selections.length, 2);
          assert.deepStrictEqual([
            selections[0].startLineNumber,
            selections[0].startColumn,
            selections[0].endLineNumber,
            selections[0].endColumn
          ], [1, 27, 1, 27]);
          assert.deepStrictEqual([
            selections[1].startLineNumber,
            selections[1].startColumn,
            selections[1].endLineNumber,
            selections[1].endColumn
          ], [2, 29, 2, 29]);
        }
      );
    });
    test("should work in multi cursor mode", function() {
      withTestCodeEditor(
        [
          "hello",
          "world",
          "hello world",
          "hello",
          "bonjour",
          "hola",
          "world",
          "hello world"
        ],
        {},
        (editor) => {
          const model = editor.getModel();
          const deleteAllLeftAction = new DeleteAllLeftAction();
          editor.setSelections([new Selection(1, 2, 1, 2), new Selection(1, 4, 1, 4)]);
          executeAction(deleteAllLeftAction, editor);
          assert.strictEqual(model.getLineContent(1), "lo");
          editor.setSelections([new Selection(2, 2, 2, 2), new Selection(2, 4, 2, 5)]);
          executeAction(deleteAllLeftAction, editor);
          assert.strictEqual(model.getLineContent(2), "d");
          editor.setSelections([new Selection(3, 2, 3, 5), new Selection(3, 7, 3, 7)]);
          executeAction(deleteAllLeftAction, editor);
          assert.strictEqual(model.getLineContent(3), "world");
          editor.setSelections([new Selection(4, 3, 4, 3), new Selection(4, 5, 5, 4)]);
          executeAction(deleteAllLeftAction, editor);
          assert.strictEqual(model.getLineContent(4), "jour");
          editor.setSelections([new Selection(5, 3, 6, 3), new Selection(6, 5, 7, 5), new Selection(7, 7, 7, 7)]);
          executeAction(deleteAllLeftAction, editor);
          assert.strictEqual(model.getLineContent(5), "world");
        }
      );
    });
    test("issue #36234: should push undo stop", () => {
      withTestCodeEditor(
        [
          "one",
          "two",
          "three"
        ],
        {},
        (editor) => {
          const model = editor.getModel();
          const deleteAllLeftAction = new DeleteAllLeftAction();
          editor.setSelection(new Selection(1, 1, 1, 1));
          editor.trigger("keyboard", Handler.Type, { text: "Typing some text here on line " });
          assert.strictEqual(model.getLineContent(1), "Typing some text here on line one");
          assert.deepStrictEqual(editor.getSelection(), new Selection(1, 31, 1, 31));
          executeAction(deleteAllLeftAction, editor);
          assert.strictEqual(model.getLineContent(1), "one");
          assert.deepStrictEqual(editor.getSelection(), new Selection(1, 1, 1, 1));
          CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
          assert.strictEqual(model.getLineContent(1), "Typing some text here on line one");
          assert.deepStrictEqual(editor.getSelection(), new Selection(1, 31, 1, 31));
        }
      );
    });
  });
  suite("JoinLinesAction", () => {
    test("should join lines and insert space if necessary", function() {
      withTestCodeEditor(
        [
          "hello",
          "world",
          "hello ",
          "world",
          "hello		",
          "	world",
          "hello   ",
          "	world",
          "",
          "",
          "hello world"
        ],
        {},
        (editor) => {
          const model = editor.getModel();
          const joinLinesAction = new JoinLinesAction();
          editor.setSelection(new Selection(1, 2, 1, 2));
          executeAction(joinLinesAction, editor);
          assert.strictEqual(model.getLineContent(1), "hello world");
          assertSelection(editor, new Selection(1, 6, 1, 6));
          editor.setSelection(new Selection(2, 2, 2, 2));
          executeAction(joinLinesAction, editor);
          assert.strictEqual(model.getLineContent(2), "hello world");
          assertSelection(editor, new Selection(2, 7, 2, 7));
          editor.setSelection(new Selection(3, 2, 3, 2));
          executeAction(joinLinesAction, editor);
          assert.strictEqual(model.getLineContent(3), "hello world");
          assertSelection(editor, new Selection(3, 7, 3, 7));
          editor.setSelection(new Selection(4, 2, 5, 3));
          executeAction(joinLinesAction, editor);
          assert.strictEqual(model.getLineContent(4), "hello world");
          assertSelection(editor, new Selection(4, 2, 4, 8));
          editor.setSelection(new Selection(5, 1, 7, 3));
          executeAction(joinLinesAction, editor);
          assert.strictEqual(model.getLineContent(5), "hello world");
          assertSelection(editor, new Selection(5, 1, 5, 3));
        }
      );
    });
    test("#50471 Join lines at the end of document", function() {
      withTestCodeEditor(
        [
          "hello",
          "world"
        ],
        {},
        (editor) => {
          const model = editor.getModel();
          const joinLinesAction = new JoinLinesAction();
          editor.setSelection(new Selection(2, 1, 2, 1));
          executeAction(joinLinesAction, editor);
          assert.strictEqual(model.getLineContent(1), "hello");
          assert.strictEqual(model.getLineContent(2), "world");
          assertSelection(editor, new Selection(2, 6, 2, 6));
        }
      );
    });
    test("should work in multi cursor mode", function() {
      withTestCodeEditor(
        [
          "hello",
          "world",
          "hello ",
          "world",
          "hello		",
          "	world",
          "hello   ",
          "	world",
          "",
          "",
          "hello world"
        ],
        {},
        (editor) => {
          const model = editor.getModel();
          const joinLinesAction = new JoinLinesAction();
          editor.setSelections([
            /** primary cursor */
            new Selection(5, 2, 5, 2),
            new Selection(1, 2, 1, 2),
            new Selection(3, 2, 4, 2),
            new Selection(5, 4, 6, 3),
            new Selection(7, 5, 8, 4),
            new Selection(10, 1, 10, 1)
          ]);
          executeAction(joinLinesAction, editor);
          assert.strictEqual(model.getLinesContent().join("\n"), "hello world\nhello world\nhello world\nhello world\n\nhello world");
          assertSelection(editor, [
            /** primary cursor */
            new Selection(3, 4, 3, 8),
            new Selection(1, 6, 1, 6),
            new Selection(2, 2, 2, 8),
            new Selection(4, 5, 4, 9),
            new Selection(6, 1, 6, 1)
          ]);
        }
      );
    });
    test("should push undo stop", function() {
      withTestCodeEditor(
        [
          "hello",
          "world"
        ],
        {},
        (editor) => {
          const model = editor.getModel();
          const joinLinesAction = new JoinLinesAction();
          editor.setSelection(new Selection(1, 6, 1, 6));
          editor.trigger("keyboard", Handler.Type, { text: " my dear" });
          assert.strictEqual(model.getLineContent(1), "hello my dear");
          assert.deepStrictEqual(editor.getSelection(), new Selection(1, 14, 1, 14));
          executeAction(joinLinesAction, editor);
          assert.strictEqual(model.getLineContent(1), "hello my dear world");
          assert.deepStrictEqual(editor.getSelection(), new Selection(1, 14, 1, 14));
          CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
          assert.strictEqual(model.getLineContent(1), "hello my dear");
          assert.deepStrictEqual(editor.getSelection(), new Selection(1, 14, 1, 14));
        }
      );
    });
  });
  test("transpose", () => {
    withTestCodeEditor(
      [
        "hello world",
        "",
        "",
        "   "
      ],
      {},
      (editor) => {
        const model = editor.getModel();
        const transposeAction = new TransposeAction();
        editor.setSelection(new Selection(1, 1, 1, 1));
        executeAction(transposeAction, editor);
        assert.strictEqual(model.getLineContent(1), "hello world");
        assertSelection(editor, new Selection(1, 2, 1, 2));
        editor.setSelection(new Selection(1, 6, 1, 6));
        executeAction(transposeAction, editor);
        assert.strictEqual(model.getLineContent(1), "hell oworld");
        assertSelection(editor, new Selection(1, 7, 1, 7));
        editor.setSelection(new Selection(1, 12, 1, 12));
        executeAction(transposeAction, editor);
        assert.strictEqual(model.getLineContent(1), "hell oworl");
        assertSelection(editor, new Selection(2, 2, 2, 2));
        editor.setSelection(new Selection(3, 1, 3, 1));
        executeAction(transposeAction, editor);
        assert.strictEqual(model.getLineContent(3), "");
        assertSelection(editor, new Selection(4, 1, 4, 1));
        editor.setSelection(new Selection(4, 2, 4, 2));
        executeAction(transposeAction, editor);
        assert.strictEqual(model.getLineContent(4), "   ");
        assertSelection(editor, new Selection(4, 3, 4, 3));
      }
    );
    withTestCodeEditor(
      [
        "",
        "",
        "hello",
        "world",
        "",
        "hello world",
        "",
        "hello world"
      ],
      {},
      (editor) => {
        const model = editor.getModel();
        const transposeAction = new TransposeAction();
        editor.setSelection(new Selection(1, 1, 1, 1));
        executeAction(transposeAction, editor);
        assert.strictEqual(model.getLineContent(2), "");
        assertSelection(editor, new Selection(2, 1, 2, 1));
        editor.setSelection(new Selection(3, 6, 3, 6));
        executeAction(transposeAction, editor);
        assert.strictEqual(model.getLineContent(4), "oworld");
        assertSelection(editor, new Selection(4, 2, 4, 2));
        editor.setSelection(new Selection(6, 12, 6, 12));
        executeAction(transposeAction, editor);
        assert.strictEqual(model.getLineContent(7), "d");
        assertSelection(editor, new Selection(7, 2, 7, 2));
        editor.setSelection(new Selection(8, 12, 8, 12));
        executeAction(transposeAction, editor);
        assert.strictEqual(model.getLineContent(8), "hello world");
        assertSelection(editor, new Selection(8, 12, 8, 12));
      }
    );
  });
  test("toggle case", function() {
    withTestCodeEditor(
      [
        "hello world",
        "\xF6\xE7\u015F\u011F\xFC",
        "parseHTMLString",
        "getElementById",
        "insertHTML",
        "PascalCase",
        "CSSSelectorsList",
        "iD",
        "tEST",
        "\xF6\xE7\u015F\xD6\xC7\u015E\u011F\xFC\u011E\xDC",
        "audioConverter.convertM4AToMP3();",
        "snake_case",
        "Capital_Snake_Case",
        `function helloWorld() {
				return someGlobalObject.printHelloWorld("en", "utf-8");
				}
				helloWorld();`.replace(/^\s+/gm, ""),
        `'JavaScript'`,
        "parseHTML4String",
        "_accessor: ServicesAccessor"
      ],
      {},
      (editor) => {
        const model = editor.getModel();
        const uppercaseAction = new UpperCaseAction();
        const lowercaseAction = new LowerCaseAction();
        const titlecaseAction = new TitleCaseAction();
        const snakecaseAction = new SnakeCaseAction();
        editor.setSelection(new Selection(1, 1, 1, 12));
        executeAction(uppercaseAction, editor);
        assert.strictEqual(model.getLineContent(1), "HELLO WORLD");
        assertSelection(editor, new Selection(1, 1, 1, 12));
        editor.setSelection(new Selection(1, 1, 1, 12));
        executeAction(lowercaseAction, editor);
        assert.strictEqual(model.getLineContent(1), "hello world");
        assertSelection(editor, new Selection(1, 1, 1, 12));
        editor.setSelection(new Selection(1, 3, 1, 3));
        executeAction(uppercaseAction, editor);
        assert.strictEqual(model.getLineContent(1), "HELLO world");
        assertSelection(editor, new Selection(1, 3, 1, 3));
        editor.setSelection(new Selection(1, 4, 1, 4));
        executeAction(lowercaseAction, editor);
        assert.strictEqual(model.getLineContent(1), "hello world");
        assertSelection(editor, new Selection(1, 4, 1, 4));
        editor.setSelection(new Selection(1, 1, 1, 12));
        executeAction(titlecaseAction, editor);
        assert.strictEqual(model.getLineContent(1), "Hello World");
        assertSelection(editor, new Selection(1, 1, 1, 12));
        editor.setSelection(new Selection(2, 1, 2, 6));
        executeAction(uppercaseAction, editor);
        assert.strictEqual(model.getLineContent(2), "\xD6\xC7\u015E\u011E\xDC");
        assertSelection(editor, new Selection(2, 1, 2, 6));
        editor.setSelection(new Selection(2, 1, 2, 6));
        executeAction(lowercaseAction, editor);
        assert.strictEqual(model.getLineContent(2), "\xF6\xE7\u015F\u011F\xFC");
        assertSelection(editor, new Selection(2, 1, 2, 6));
        editor.setSelection(new Selection(2, 1, 2, 6));
        executeAction(titlecaseAction, editor);
        assert.strictEqual(model.getLineContent(2), "\xD6\xE7\u015F\u011F\xFC");
        assertSelection(editor, new Selection(2, 1, 2, 6));
        editor.setSelection(new Selection(3, 1, 3, 16));
        executeAction(snakecaseAction, editor);
        assert.strictEqual(model.getLineContent(3), "parse_html_string");
        assertSelection(editor, new Selection(3, 1, 3, 18));
        editor.setSelection(new Selection(4, 1, 4, 15));
        executeAction(snakecaseAction, editor);
        assert.strictEqual(model.getLineContent(4), "get_element_by_id");
        assertSelection(editor, new Selection(4, 1, 4, 18));
        editor.setSelection(new Selection(5, 1, 5, 11));
        executeAction(snakecaseAction, editor);
        assert.strictEqual(model.getLineContent(5), "insert_html");
        assertSelection(editor, new Selection(5, 1, 5, 12));
        editor.setSelection(new Selection(6, 1, 6, 11));
        executeAction(snakecaseAction, editor);
        assert.strictEqual(model.getLineContent(6), "pascal_case");
        assertSelection(editor, new Selection(6, 1, 6, 12));
        editor.setSelection(new Selection(7, 1, 7, 17));
        executeAction(snakecaseAction, editor);
        assert.strictEqual(model.getLineContent(7), "css_selectors_list");
        assertSelection(editor, new Selection(7, 1, 7, 19));
        editor.setSelection(new Selection(8, 1, 8, 3));
        executeAction(snakecaseAction, editor);
        assert.strictEqual(model.getLineContent(8), "i_d");
        assertSelection(editor, new Selection(8, 1, 8, 4));
        editor.setSelection(new Selection(9, 1, 9, 5));
        executeAction(snakecaseAction, editor);
        assert.strictEqual(model.getLineContent(9), "t_est");
        assertSelection(editor, new Selection(9, 1, 9, 6));
        editor.setSelection(new Selection(10, 1, 10, 11));
        executeAction(snakecaseAction, editor);
        assert.strictEqual(model.getLineContent(10), "\xF6\xE7\u015F_\xF6\xE7_\u015F\u011F\xFC_\u011F\xFC");
        assertSelection(editor, new Selection(10, 1, 10, 14));
        editor.setSelection(new Selection(11, 1, 11, 34));
        executeAction(snakecaseAction, editor);
        assert.strictEqual(model.getLineContent(11), "audio_converter.convert_m4a_to_mp3();");
        assertSelection(editor, new Selection(11, 1, 11, 38));
        editor.setSelection(new Selection(12, 1, 12, 11));
        executeAction(snakecaseAction, editor);
        assert.strictEqual(model.getLineContent(12), "snake_case");
        assertSelection(editor, new Selection(12, 1, 12, 11));
        editor.setSelection(new Selection(13, 1, 13, 19));
        executeAction(snakecaseAction, editor);
        assert.strictEqual(model.getLineContent(13), "capital_snake_case");
        assertSelection(editor, new Selection(13, 1, 13, 19));
        editor.setSelection(new Selection(14, 1, 17, 14));
        executeAction(snakecaseAction, editor);
        assert.strictEqual(model.getValueInRange(new Selection(14, 1, 17, 15)), `function hello_world() {
					return some_global_object.print_hello_world("en", "utf-8");
				}
				hello_world();`.replace(/^\s+/gm, ""));
        assertSelection(editor, new Selection(14, 1, 17, 15));
        editor.setSelection(new Selection(18, 1, 18, 13));
        executeAction(snakecaseAction, editor);
        assert.strictEqual(model.getLineContent(18), `'java_script'`);
        assertSelection(editor, new Selection(18, 1, 18, 14));
        editor.setSelection(new Selection(19, 1, 19, 17));
        executeAction(snakecaseAction, editor);
        assert.strictEqual(model.getLineContent(19), "parse_html4_string");
        assertSelection(editor, new Selection(19, 1, 19, 19));
        editor.setSelection(new Selection(20, 1, 20, 28));
        executeAction(snakecaseAction, editor);
        assert.strictEqual(model.getLineContent(20), "_accessor: services_accessor");
        assertSelection(editor, new Selection(20, 1, 20, 29));
      }
    );
    withTestCodeEditor(
      [
        "foO baR BaZ",
        "foO'baR'BaZ",
        "foO[baR]BaZ",
        "foO`baR~BaZ",
        "foO^baR%BaZ",
        "foO$baR!BaZ",
        "'physician's assistant'"
      ],
      {},
      (editor) => {
        const model = editor.getModel();
        const titlecaseAction = new TitleCaseAction();
        editor.setSelection(new Selection(1, 1, 1, 12));
        executeAction(titlecaseAction, editor);
        assert.strictEqual(model.getLineContent(1), "Foo Bar Baz");
        editor.setSelection(new Selection(2, 1, 2, 12));
        executeAction(titlecaseAction, editor);
        assert.strictEqual(model.getLineContent(2), "Foo'bar'baz");
        editor.setSelection(new Selection(3, 1, 3, 12));
        executeAction(titlecaseAction, editor);
        assert.strictEqual(model.getLineContent(3), "Foo[Bar]Baz");
        editor.setSelection(new Selection(4, 1, 4, 12));
        executeAction(titlecaseAction, editor);
        assert.strictEqual(model.getLineContent(4), "Foo`Bar~Baz");
        editor.setSelection(new Selection(5, 1, 5, 12));
        executeAction(titlecaseAction, editor);
        assert.strictEqual(model.getLineContent(5), "Foo^Bar%Baz");
        editor.setSelection(new Selection(6, 1, 6, 12));
        executeAction(titlecaseAction, editor);
        assert.strictEqual(model.getLineContent(6), "Foo$Bar!Baz");
        editor.setSelection(new Selection(7, 1, 7, 23));
        executeAction(titlecaseAction, editor);
        assert.strictEqual(model.getLineContent(7), "'Physician's Assistant'");
      }
    );
    withTestCodeEditor(
      [
        "camel from words",
        "from_snake_case",
        "from-kebab-case",
        "alreadyCamel",
        "ReTain_any_CAPitalization",
        "my_var.test_function()",
        "\xF6\xE7\u015F_\xF6\xE7_\u015F\u011F\xFC_\u011F\xFC"
      ],
      {},
      (editor) => {
        const model = editor.getModel();
        const camelcaseAction = new CamelCaseAction();
        editor.setSelection(new Selection(1, 1, 1, 18));
        executeAction(camelcaseAction, editor);
        assert.strictEqual(model.getLineContent(1), "camelFromWords");
        editor.setSelection(new Selection(2, 1, 2, 15));
        executeAction(camelcaseAction, editor);
        assert.strictEqual(model.getLineContent(2), "fromSnakeCase");
        editor.setSelection(new Selection(3, 1, 3, 15));
        executeAction(camelcaseAction, editor);
        assert.strictEqual(model.getLineContent(3), "fromKebabCase");
        editor.setSelection(new Selection(4, 1, 4, 12));
        executeAction(camelcaseAction, editor);
        assert.strictEqual(model.getLineContent(4), "alreadyCamel");
        editor.setSelection(new Selection(5, 1, 5, 26));
        executeAction(camelcaseAction, editor);
        assert.strictEqual(model.getLineContent(5), "ReTainAnyCAPitalization");
        editor.setSelection(new Selection(6, 1, 6, 23));
        executeAction(camelcaseAction, editor);
        assert.strictEqual(model.getLineContent(6), "myVar.testFunction()");
        editor.setSelection(new Selection(7, 1, 7, 14));
        executeAction(camelcaseAction, editor);
        assert.strictEqual(model.getLineContent(7), "\xF6\xE7\u015F\xD6\xE7\u015E\u011F\xFC\u011E\xFC");
      }
    );
    withTestCodeEditor(
      [
        "",
        "   "
      ],
      {},
      (editor) => {
        const model = editor.getModel();
        const uppercaseAction = new UpperCaseAction();
        const lowercaseAction = new LowerCaseAction();
        editor.setSelection(new Selection(1, 1, 1, 1));
        executeAction(uppercaseAction, editor);
        assert.strictEqual(model.getLineContent(1), "");
        assertSelection(editor, new Selection(1, 1, 1, 1));
        editor.setSelection(new Selection(1, 1, 1, 1));
        executeAction(lowercaseAction, editor);
        assert.strictEqual(model.getLineContent(1), "");
        assertSelection(editor, new Selection(1, 1, 1, 1));
        editor.setSelection(new Selection(2, 2, 2, 2));
        executeAction(uppercaseAction, editor);
        assert.strictEqual(model.getLineContent(2), "   ");
        assertSelection(editor, new Selection(2, 2, 2, 2));
        editor.setSelection(new Selection(2, 2, 2, 2));
        executeAction(lowercaseAction, editor);
        assert.strictEqual(model.getLineContent(2), "   ");
        assertSelection(editor, new Selection(2, 2, 2, 2));
      }
    );
    withTestCodeEditor(
      [
        "hello world",
        "\xF6\xE7\u015F\u011F\xFC",
        "parseHTMLString",
        "getElementById",
        "PascalCase",
        "\xF6\xE7\u015F\xD6\xC7\u015E\u011F\xFC\u011E\xDC",
        "audioConverter.convertM4AToMP3();",
        "Capital_Snake_Case",
        "parseHTML4String",
        "_accessor: ServicesAccessor",
        "Kebab-Case"
      ],
      {},
      (editor) => {
        const model = editor.getModel();
        const kebabCaseAction = new KebabCaseAction();
        editor.setSelection(new Selection(1, 1, 1, 12));
        executeAction(kebabCaseAction, editor);
        assert.strictEqual(model.getLineContent(1), "hello world");
        assertSelection(editor, new Selection(1, 1, 1, 12));
        editor.setSelection(new Selection(2, 1, 2, 6));
        executeAction(kebabCaseAction, editor);
        assert.strictEqual(model.getLineContent(2), "\xF6\xE7\u015F\u011F\xFC");
        assertSelection(editor, new Selection(2, 1, 2, 6));
        editor.setSelection(new Selection(3, 1, 3, 16));
        executeAction(kebabCaseAction, editor);
        assert.strictEqual(model.getLineContent(3), "parse-html-string");
        assertSelection(editor, new Selection(3, 1, 3, 18));
        editor.setSelection(new Selection(4, 1, 4, 15));
        executeAction(kebabCaseAction, editor);
        assert.strictEqual(model.getLineContent(4), "get-element-by-id");
        assertSelection(editor, new Selection(4, 1, 4, 18));
        editor.setSelection(new Selection(5, 1, 5, 11));
        executeAction(kebabCaseAction, editor);
        assert.strictEqual(model.getLineContent(5), "pascal-case");
        assertSelection(editor, new Selection(5, 1, 5, 12));
        editor.setSelection(new Selection(6, 1, 6, 11));
        executeAction(kebabCaseAction, editor);
        assert.strictEqual(model.getLineContent(6), "\xF6\xE7\u015F-\xF6\xE7-\u015F\u011F\xFC-\u011F\xFC");
        assertSelection(editor, new Selection(6, 1, 6, 14));
        editor.setSelection(new Selection(7, 1, 7, 34));
        executeAction(kebabCaseAction, editor);
        assert.strictEqual(model.getLineContent(7), "audio-converter.convert-m4a-to-mp3();");
        assertSelection(editor, new Selection(7, 1, 7, 38));
        editor.setSelection(new Selection(8, 1, 8, 19));
        executeAction(kebabCaseAction, editor);
        assert.strictEqual(model.getLineContent(8), "capital-snake-case");
        assertSelection(editor, new Selection(8, 1, 8, 19));
        editor.setSelection(new Selection(9, 1, 9, 17));
        executeAction(kebabCaseAction, editor);
        assert.strictEqual(model.getLineContent(9), "parse-html4-string");
        assertSelection(editor, new Selection(9, 1, 9, 19));
        editor.setSelection(new Selection(10, 1, 10, 28));
        executeAction(kebabCaseAction, editor);
        assert.strictEqual(model.getLineContent(10), "_accessor: services-accessor");
        assertSelection(editor, new Selection(10, 1, 10, 29));
        editor.setSelection(new Selection(11, 1, 11, 11));
        executeAction(kebabCaseAction, editor);
        assert.strictEqual(model.getLineContent(11), "kebab-case");
        assertSelection(editor, new Selection(11, 1, 11, 11));
      }
    );
    withTestCodeEditor(
      [
        "hello world",
        "\xF6\xE7\u015F\u011F\xFC",
        "parseHTMLString",
        "getElementById",
        "PascalCase",
        "\xF6\xE7\u015F\xD6\xC7\u015E\u011F\xFC\u011E\xDC",
        "audioConverter.convertM4AToMP3();",
        "Capital_Snake_Case",
        "parseHTML4String",
        "Kebab-Case"
      ],
      {},
      (editor) => {
        const model = editor.getModel();
        const pascalCaseAction = new PascalCaseAction();
        editor.setSelection(new Selection(1, 1, 1, 12));
        executeAction(pascalCaseAction, editor);
        assert.strictEqual(model.getLineContent(1), "HelloWorld");
        assertSelection(editor, new Selection(1, 1, 1, 11));
        editor.setSelection(new Selection(2, 1, 2, 6));
        executeAction(pascalCaseAction, editor);
        assert.strictEqual(model.getLineContent(2), "\xD6\xE7\u015F\u011F\xFC");
        assertSelection(editor, new Selection(2, 1, 2, 6));
        editor.setSelection(new Selection(3, 1, 3, 16));
        executeAction(pascalCaseAction, editor);
        assert.strictEqual(model.getLineContent(3), "ParseHTMLString");
        assertSelection(editor, new Selection(3, 1, 3, 16));
        editor.setSelection(new Selection(4, 1, 4, 15));
        executeAction(pascalCaseAction, editor);
        assert.strictEqual(model.getLineContent(4), "GetElementById");
        assertSelection(editor, new Selection(4, 1, 4, 15));
        editor.setSelection(new Selection(5, 1, 5, 11));
        executeAction(pascalCaseAction, editor);
        assert.strictEqual(model.getLineContent(5), "PascalCase");
        assertSelection(editor, new Selection(5, 1, 5, 11));
        editor.setSelection(new Selection(6, 1, 6, 11));
        executeAction(pascalCaseAction, editor);
        assert.strictEqual(model.getLineContent(6), "\xD6\xE7\u015F\xD6\xC7\u015E\u011F\xFC\u011E\xDC");
        assertSelection(editor, new Selection(6, 1, 6, 11));
        editor.setSelection(new Selection(7, 1, 7, 34));
        executeAction(pascalCaseAction, editor);
        assert.strictEqual(model.getLineContent(7), "AudioConverter.ConvertM4AToMP3();");
        assertSelection(editor, new Selection(7, 1, 7, 34));
        editor.setSelection(new Selection(8, 1, 8, 19));
        executeAction(pascalCaseAction, editor);
        assert.strictEqual(model.getLineContent(8), "CapitalSnakeCase");
        assertSelection(editor, new Selection(8, 1, 8, 17));
        editor.setSelection(new Selection(9, 1, 9, 17));
        executeAction(pascalCaseAction, editor);
        assert.strictEqual(model.getLineContent(9), "ParseHTML4String");
        assertSelection(editor, new Selection(9, 1, 9, 17));
        editor.setSelection(new Selection(10, 1, 10, 11));
        executeAction(pascalCaseAction, editor);
        assert.strictEqual(model.getLineContent(10), "KebabCase");
        assertSelection(editor, new Selection(10, 1, 10, 10));
      }
    );
  });
  suite("DeleteAllRightAction", () => {
    test("should be noop on empty", () => {
      withTestCodeEditor([""], {}, (editor) => {
        const model = editor.getModel();
        const action = new DeleteAllRightAction();
        executeAction(action, editor);
        assert.deepStrictEqual(model.getLinesContent(), [""]);
        assert.deepStrictEqual(editor.getSelections(), [new Selection(1, 1, 1, 1)]);
        editor.setSelection(new Selection(1, 1, 1, 1));
        executeAction(action, editor);
        assert.deepStrictEqual(model.getLinesContent(), [""]);
        assert.deepStrictEqual(editor.getSelections(), [new Selection(1, 1, 1, 1)]);
        editor.setSelections([new Selection(1, 1, 1, 1), new Selection(1, 1, 1, 1), new Selection(1, 1, 1, 1)]);
        executeAction(action, editor);
        assert.deepStrictEqual(model.getLinesContent(), [""]);
        assert.deepStrictEqual(editor.getSelections(), [new Selection(1, 1, 1, 1)]);
      });
    });
    test("should delete selected range", () => {
      withTestCodeEditor([
        "hello",
        "world"
      ], {}, (editor) => {
        const model = editor.getModel();
        const action = new DeleteAllRightAction();
        editor.setSelection(new Selection(1, 2, 1, 5));
        executeAction(action, editor);
        assert.deepStrictEqual(model.getLinesContent(), ["ho", "world"]);
        assert.deepStrictEqual(editor.getSelections(), [new Selection(1, 2, 1, 2)]);
        editor.setSelection(new Selection(1, 1, 2, 4));
        executeAction(action, editor);
        assert.deepStrictEqual(model.getLinesContent(), ["ld"]);
        assert.deepStrictEqual(editor.getSelections(), [new Selection(1, 1, 1, 1)]);
        editor.setSelection(new Selection(1, 1, 1, 3));
        executeAction(action, editor);
        assert.deepStrictEqual(model.getLinesContent(), [""]);
        assert.deepStrictEqual(editor.getSelections(), [new Selection(1, 1, 1, 1)]);
      });
    });
    test("should delete to the right of the cursor", () => {
      withTestCodeEditor([
        "hello",
        "world"
      ], {}, (editor) => {
        const model = editor.getModel();
        const action = new DeleteAllRightAction();
        editor.setSelection(new Selection(1, 3, 1, 3));
        executeAction(action, editor);
        assert.deepStrictEqual(model.getLinesContent(), ["he", "world"]);
        assert.deepStrictEqual(editor.getSelections(), [new Selection(1, 3, 1, 3)]);
        editor.setSelection(new Selection(2, 1, 2, 1));
        executeAction(action, editor);
        assert.deepStrictEqual(model.getLinesContent(), ["he", ""]);
        assert.deepStrictEqual(editor.getSelections(), [new Selection(2, 1, 2, 1)]);
      });
    });
    test("should join two lines, if at the end of the line", () => {
      withTestCodeEditor([
        "hello",
        "world"
      ], {}, (editor) => {
        const model = editor.getModel();
        const action = new DeleteAllRightAction();
        editor.setSelection(new Selection(1, 6, 1, 6));
        executeAction(action, editor);
        assert.deepStrictEqual(model.getLinesContent(), ["helloworld"]);
        assert.deepStrictEqual(editor.getSelections(), [new Selection(1, 6, 1, 6)]);
        editor.setSelection(new Selection(1, 6, 1, 6));
        executeAction(action, editor);
        assert.deepStrictEqual(model.getLinesContent(), ["hello"]);
        assert.deepStrictEqual(editor.getSelections(), [new Selection(1, 6, 1, 6)]);
        editor.setSelection(new Selection(1, 6, 1, 6));
        executeAction(action, editor);
        assert.deepStrictEqual(model.getLinesContent(), ["hello"]);
        assert.deepStrictEqual(editor.getSelections(), [new Selection(1, 6, 1, 6)]);
      });
    });
    test("should work with multiple cursors", () => {
      withTestCodeEditor([
        "hello",
        "there",
        "world"
      ], {}, (editor) => {
        const model = editor.getModel();
        const action = new DeleteAllRightAction();
        editor.setSelections([
          new Selection(1, 3, 1, 3),
          new Selection(1, 6, 1, 6),
          new Selection(3, 4, 3, 4)
        ]);
        executeAction(action, editor);
        assert.deepStrictEqual(model.getLinesContent(), ["hethere", "wor"]);
        assert.deepStrictEqual(editor.getSelections(), [
          new Selection(1, 3, 1, 3),
          new Selection(2, 4, 2, 4)
        ]);
        executeAction(action, editor);
        assert.deepStrictEqual(model.getLinesContent(), ["he", "wor"]);
        assert.deepStrictEqual(editor.getSelections(), [
          new Selection(1, 3, 1, 3),
          new Selection(2, 4, 2, 4)
        ]);
        executeAction(action, editor);
        assert.deepStrictEqual(model.getLinesContent(), ["hewor"]);
        assert.deepStrictEqual(editor.getSelections(), [
          new Selection(1, 3, 1, 3),
          new Selection(1, 6, 1, 6)
        ]);
        executeAction(action, editor);
        assert.deepStrictEqual(model.getLinesContent(), ["he"]);
        assert.deepStrictEqual(editor.getSelections(), [
          new Selection(1, 3, 1, 3)
        ]);
        executeAction(action, editor);
        assert.deepStrictEqual(model.getLinesContent(), ["he"]);
        assert.deepStrictEqual(editor.getSelections(), [
          new Selection(1, 3, 1, 3)
        ]);
      });
    });
    test("should work with undo/redo", () => {
      withTestCodeEditor([
        "hello",
        "there",
        "world"
      ], {}, (editor) => {
        const model = editor.getModel();
        const action = new DeleteAllRightAction();
        editor.setSelections([
          new Selection(1, 3, 1, 3),
          new Selection(1, 6, 1, 6),
          new Selection(3, 4, 3, 4)
        ]);
        executeAction(action, editor);
        assert.deepStrictEqual(model.getLinesContent(), ["hethere", "wor"]);
        assert.deepStrictEqual(editor.getSelections(), [
          new Selection(1, 3, 1, 3),
          new Selection(2, 4, 2, 4)
        ]);
        CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
        assert.deepStrictEqual(editor.getSelections(), [
          new Selection(1, 3, 1, 3),
          new Selection(1, 6, 1, 6),
          new Selection(3, 4, 3, 4)
        ]);
        CoreEditingCommands.Redo.runEditorCommand(null, editor, null);
        assert.deepStrictEqual(editor.getSelections(), [
          new Selection(1, 3, 1, 3),
          new Selection(2, 4, 2, 4)
        ]);
      });
    });
  });
  test("InsertLineBeforeAction", () => {
    function testInsertLineBefore(lineNumber, column, callback) {
      const TEXT = [
        "First line",
        "Second line",
        "Third line"
      ];
      withTestCodeEditor(TEXT, {}, (editor, viewModel) => {
        editor.setPosition(new Position(lineNumber, column));
        const insertLineBeforeAction = new InsertLineBeforeAction();
        executeAction(insertLineBeforeAction, editor);
        callback(editor.getModel(), viewModel);
      });
    }
    testInsertLineBefore(1, 3, (model, viewModel) => {
      assert.deepStrictEqual(viewModel.getSelection(), new Selection(1, 1, 1, 1));
      assert.strictEqual(model.getLineContent(1), "");
      assert.strictEqual(model.getLineContent(2), "First line");
      assert.strictEqual(model.getLineContent(3), "Second line");
      assert.strictEqual(model.getLineContent(4), "Third line");
    });
    testInsertLineBefore(2, 3, (model, viewModel) => {
      assert.deepStrictEqual(viewModel.getSelection(), new Selection(2, 1, 2, 1));
      assert.strictEqual(model.getLineContent(1), "First line");
      assert.strictEqual(model.getLineContent(2), "");
      assert.strictEqual(model.getLineContent(3), "Second line");
      assert.strictEqual(model.getLineContent(4), "Third line");
    });
    testInsertLineBefore(3, 3, (model, viewModel) => {
      assert.deepStrictEqual(viewModel.getSelection(), new Selection(3, 1, 3, 1));
      assert.strictEqual(model.getLineContent(1), "First line");
      assert.strictEqual(model.getLineContent(2), "Second line");
      assert.strictEqual(model.getLineContent(3), "");
      assert.strictEqual(model.getLineContent(4), "Third line");
    });
  });
  test("InsertLineAfterAction", () => {
    function testInsertLineAfter(lineNumber, column, callback) {
      const TEXT = [
        "First line",
        "Second line",
        "Third line"
      ];
      withTestCodeEditor(TEXT, {}, (editor, viewModel) => {
        editor.setPosition(new Position(lineNumber, column));
        const insertLineAfterAction = new InsertLineAfterAction();
        executeAction(insertLineAfterAction, editor);
        callback(editor.getModel(), viewModel);
      });
    }
    testInsertLineAfter(1, 3, (model, viewModel) => {
      assert.deepStrictEqual(viewModel.getSelection(), new Selection(2, 1, 2, 1));
      assert.strictEqual(model.getLineContent(1), "First line");
      assert.strictEqual(model.getLineContent(2), "");
      assert.strictEqual(model.getLineContent(3), "Second line");
      assert.strictEqual(model.getLineContent(4), "Third line");
    });
    testInsertLineAfter(2, 3, (model, viewModel) => {
      assert.deepStrictEqual(viewModel.getSelection(), new Selection(3, 1, 3, 1));
      assert.strictEqual(model.getLineContent(1), "First line");
      assert.strictEqual(model.getLineContent(2), "Second line");
      assert.strictEqual(model.getLineContent(3), "");
      assert.strictEqual(model.getLineContent(4), "Third line");
    });
    testInsertLineAfter(3, 3, (model, viewModel) => {
      assert.deepStrictEqual(viewModel.getSelection(), new Selection(4, 1, 4, 1));
      assert.strictEqual(model.getLineContent(1), "First line");
      assert.strictEqual(model.getLineContent(2), "Second line");
      assert.strictEqual(model.getLineContent(3), "Third line");
      assert.strictEqual(model.getLineContent(4), "");
    });
  });
  test("Bug 18276:[editor] Indentation broken when selection is empty", () => {
    const model = createTextModel(
      [
        "function baz() {"
      ].join("\n"),
      void 0,
      {
        insertSpaces: false
      }
    );
    withTestCodeEditor(model, {}, (editor) => {
      const indentLinesAction = new IndentLinesAction();
      editor.setPosition(new Position(1, 2));
      executeAction(indentLinesAction, editor);
      assert.strictEqual(model.getLineContent(1), "	function baz() {");
      assert.deepStrictEqual(editor.getSelection(), new Selection(1, 3, 1, 3));
      CoreEditingCommands.Tab.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), "	f	unction baz() {");
    });
    model.dispose();
  });
  test("issue #80736: Indenting while the cursor is at the start of a line of text causes the added spaces or tab to be selected", () => {
    const model = createTextModel(
      [
        "Some text"
      ].join("\n"),
      void 0,
      {
        insertSpaces: false
      }
    );
    withTestCodeEditor(model, {}, (editor) => {
      const indentLinesAction = new IndentLinesAction();
      editor.setPosition(new Position(1, 1));
      executeAction(indentLinesAction, editor);
      assert.strictEqual(model.getLineContent(1), "	Some text");
      assert.deepStrictEqual(editor.getSelection(), new Selection(1, 2, 1, 2));
    });
    model.dispose();
  });
  test("Indenting on empty line should move cursor", () => {
    const model = createTextModel(
      [
        ""
      ].join("\n")
    );
    withTestCodeEditor(model, { useTabStops: false }, (editor) => {
      const indentLinesAction = new IndentLinesAction();
      editor.setPosition(new Position(1, 1));
      executeAction(indentLinesAction, editor);
      assert.strictEqual(model.getLineContent(1), "    ");
      assert.deepStrictEqual(editor.getSelection(), new Selection(1, 5, 1, 5));
    });
    model.dispose();
  });
  test("issue #62112: Delete line does not work properly when multiple cursors are on line", () => {
    const TEXT = [
      "a",
      "foo boo",
      "too",
      "c"
    ];
    withTestCodeEditor(TEXT, {}, (editor) => {
      editor.setSelections([
        new Selection(2, 4, 2, 4),
        new Selection(2, 8, 2, 8),
        new Selection(3, 4, 3, 4)
      ]);
      const deleteLinesAction = new DeleteLinesAction();
      executeAction(deleteLinesAction, editor);
      assert.strictEqual(editor.getValue(), "a\nc");
    });
  });
  function testDeleteLinesCommand(initialText, _initialSelections, resultingText, _resultingSelections) {
    const initialSelections = Array.isArray(_initialSelections) ? _initialSelections : [_initialSelections];
    const resultingSelections = Array.isArray(_resultingSelections) ? _resultingSelections : [_resultingSelections];
    withTestCodeEditor(initialText, {}, (editor) => {
      editor.setSelections(initialSelections);
      const deleteLinesAction = new DeleteLinesAction();
      executeAction(deleteLinesAction, editor);
      assert.strictEqual(editor.getValue(), resultingText.join("\n"));
      assert.deepStrictEqual(editor.getSelections(), resultingSelections);
    });
  }
  test("empty selection in middle of lines", function() {
    testDeleteLinesCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 3, 2, 3),
      [
        "first",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 3, 2, 3)
    );
  });
  test("empty selection at top of lines", function() {
    testDeleteLinesCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 5, 1, 5),
      [
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 5, 1, 5)
    );
  });
  test("empty selection at end of lines", function() {
    testDeleteLinesCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(5, 2, 5, 2),
      [
        "first",
        "second line",
        "third line",
        "fourth line"
      ],
      new Selection(4, 2, 4, 2)
    );
  });
  test("with selection in middle of lines", function() {
    testDeleteLinesCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(3, 3, 2, 2),
      [
        "first",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 2, 2, 2)
    );
  });
  test("with selection at top of lines", function() {
    testDeleteLinesCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 4, 1, 5),
      [
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 5, 1, 5)
    );
  });
  test("with selection at end of lines", function() {
    testDeleteLinesCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(5, 1, 5, 2),
      [
        "first",
        "second line",
        "third line",
        "fourth line"
      ],
      new Selection(4, 2, 4, 2)
    );
  });
  test("with full line selection in middle of lines", function() {
    testDeleteLinesCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(4, 1, 2, 1),
      [
        "first",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 1, 2, 1)
    );
  });
  test("with full line selection at top of lines", function() {
    testDeleteLinesCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 1, 1, 5),
      [
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 5, 1, 5)
    );
  });
  test("with full line selection at end of lines", function() {
    testDeleteLinesCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(4, 1, 5, 2),
      [
        "first",
        "second line",
        "third line"
      ],
      new Selection(3, 2, 3, 2)
    );
  });
  test("multicursor 1", function() {
    testDeleteLinesCommand(
      [
        "class P {",
        "",
        "    getA() {",
        "        if (true) {",
        '            return "a";',
        "        }",
        "    }",
        "",
        "    getB() {",
        "        if (true) {",
        '            return "b";',
        "        }",
        "    }",
        "",
        "    getC() {",
        "        if (true) {",
        '            return "c";',
        "        }",
        "    }",
        "}"
      ],
      [
        new Selection(4, 1, 5, 1),
        new Selection(10, 1, 11, 1),
        new Selection(16, 1, 17, 1)
      ],
      [
        "class P {",
        "",
        "    getA() {",
        '            return "a";',
        "        }",
        "    }",
        "",
        "    getB() {",
        '            return "b";',
        "        }",
        "    }",
        "",
        "    getC() {",
        '            return "c";',
        "        }",
        "    }",
        "}"
      ],
      [
        new Selection(4, 1, 4, 1),
        new Selection(9, 1, 9, 1),
        new Selection(14, 1, 14, 1)
      ]
    );
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9saW5lc09wZXJhdGlvbnMvdGVzdC9icm93c2VyL2xpbmVzT3BlcmF0aW9ucy50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgQ29yZUVkaXRpbmdDb21tYW5kcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvY29yZUNvbW1hbmRzLmpzJztcbmltcG9ydCB0eXBlIHsgSUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgRWRpdG9yQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IEhhbmRsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgVmlld01vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3ZpZXdNb2RlbC92aWV3TW9kZWxJbXBsLmpzJztcbmltcG9ydCB7IENhbWVsQ2FzZUFjdGlvbiwgUGFzY2FsQ2FzZUFjdGlvbiwgRGVsZXRlQWxsTGVmdEFjdGlvbiwgRGVsZXRlQWxsUmlnaHRBY3Rpb24sIERlbGV0ZUR1cGxpY2F0ZUxpbmVzQWN0aW9uLCBEZWxldGVMaW5lc0FjdGlvbiwgSW5kZW50TGluZXNBY3Rpb24sIEluc2VydExpbmVBZnRlckFjdGlvbiwgSW5zZXJ0TGluZUJlZm9yZUFjdGlvbiwgSm9pbkxpbmVzQWN0aW9uLCBLZWJhYkNhc2VBY3Rpb24sIExvd2VyQ2FzZUFjdGlvbiwgU25ha2VDYXNlQWN0aW9uLCBTb3J0TGluZXNBc2NlbmRpbmdBY3Rpb24sIFNvcnRMaW5lc0Rlc2NlbmRpbmdBY3Rpb24sIFRpdGxlQ2FzZUFjdGlvbiwgVHJhbnNwb3NlQWN0aW9uLCBVcHBlckNhc2VBY3Rpb24gfSBmcm9tICcuLi8uLi9icm93c2VyL2xpbmVzT3BlcmF0aW9ucy5qcyc7XG5pbXBvcnQgeyB3aXRoVGVzdENvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2Jyb3dzZXIvdGVzdENvZGVFZGl0b3IuanMnO1xuaW1wb3J0IHsgY3JlYXRlVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9jb21tb24vdGVzdFRleHRNb2RlbC5qcyc7XG5cbmZ1bmN0aW9uIGFzc2VydFNlbGVjdGlvbihlZGl0b3I6IElDb2RlRWRpdG9yLCBleHBlY3RlZDogU2VsZWN0aW9uIHwgU2VsZWN0aW9uW10pOiB2b2lkIHtcblx0aWYgKCFBcnJheS5pc0FycmF5KGV4cGVjdGVkKSkge1xuXHRcdGV4cGVjdGVkID0gW2V4cGVjdGVkXTtcblx0fVxuXHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCksIGV4cGVjdGVkKTtcbn1cblxuZnVuY3Rpb24gZXhlY3V0ZUFjdGlvbihhY3Rpb246IEVkaXRvckFjdGlvbiwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRhY3Rpb24ucnVuKG51bGwhLCBlZGl0b3IsIHVuZGVmaW5lZCk7XG59XG5cbnN1aXRlKCdFZGl0b3IgQ29udHJpYiAtIExpbmUgT3BlcmF0aW9ucycsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRzdWl0ZSgnU29ydExpbmVzQXNjZW5kaW5nQWN0aW9uJywgKCkgPT4ge1xuXHRcdHRlc3QoJ3Nob3VsZCBzb3J0IHNlbGVjdGVkIGxpbmVzIGluIGFzY2VuZGluZyBvcmRlcicsIGZ1bmN0aW9uICgpIHtcblx0XHRcdHdpdGhUZXN0Q29kZUVkaXRvcihcblx0XHRcdFx0W1xuXHRcdFx0XHRcdCdvbWljcm9uJyxcblx0XHRcdFx0XHQnYmV0YScsXG5cdFx0XHRcdFx0J2FscGhhJ1xuXHRcdFx0XHRdLCB7fSwgKGVkaXRvcikgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCkhO1xuXHRcdFx0XHRcdGNvbnN0IHNvcnRMaW5lc0FzY2VuZGluZ0FjdGlvbiA9IG5ldyBTb3J0TGluZXNBc2NlbmRpbmdBY3Rpb24oKTtcblxuXHRcdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCAxLCAzLCA1KSk7XG5cdFx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihzb3J0TGluZXNBc2NlbmRpbmdBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lc0NvbnRlbnQoKSwgW1xuXHRcdFx0XHRcdFx0J2FscGhhJyxcblx0XHRcdFx0XHRcdCdiZXRhJyxcblx0XHRcdFx0XHRcdCdvbWljcm9uJ1xuXHRcdFx0XHRcdF0pO1xuXHRcdFx0XHRcdGFzc2VydFNlbGVjdGlvbihlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMSwgMywgNykpO1xuXHRcdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCBzb3J0IGxpbmVzIGluIGFzY2VuZGluZyBvcmRlcicsIGZ1bmN0aW9uICgpIHtcblx0XHRcdHdpdGhUZXN0Q29kZUVkaXRvcihcblx0XHRcdFx0W1xuXHRcdFx0XHRcdCdvbWljcm9uJyxcblx0XHRcdFx0XHQnYmV0YScsXG5cdFx0XHRcdFx0J2FscGhhJ1xuXHRcdFx0XHRdLCB7fSwgKGVkaXRvcikgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCkhO1xuXHRcdFx0XHRcdGNvbnN0IHNvcnRMaW5lc0FzY2VuZGluZ0FjdGlvbiA9IG5ldyBTb3J0TGluZXNBc2NlbmRpbmdBY3Rpb24oKTtcblxuXHRcdFx0XHRcdGV4ZWN1dGVBY3Rpb24oc29ydExpbmVzQXNjZW5kaW5nQWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZXNDb250ZW50KCksIFtcblx0XHRcdFx0XHRcdCdhbHBoYScsXG5cdFx0XHRcdFx0XHQnYmV0YScsXG5cdFx0XHRcdFx0XHQnb21pY3Jvbidcblx0XHRcdFx0XHRdKTtcblx0XHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgc29ydCBtdWx0aXBsZSBzZWxlY3Rpb25zIGluIGFzY2VuZGluZyBvcmRlcicsIGZ1bmN0aW9uICgpIHtcblx0XHRcdHdpdGhUZXN0Q29kZUVkaXRvcihcblx0XHRcdFx0W1xuXHRcdFx0XHRcdCdvbWljcm9uJyxcblx0XHRcdFx0XHQnYmV0YScsXG5cdFx0XHRcdFx0J2FscGhhJyxcblx0XHRcdFx0XHQnJyxcblx0XHRcdFx0XHQnb21pY3JvbicsXG5cdFx0XHRcdFx0J2JldGEnLFxuXHRcdFx0XHRcdCdhbHBoYSdcblx0XHRcdFx0XSwge30sIChlZGl0b3IpID0+IHtcblx0XHRcdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpITtcblx0XHRcdFx0XHRjb25zdCBzb3J0TGluZXNBc2NlbmRpbmdBY3Rpb24gPSBuZXcgU29ydExpbmVzQXNjZW5kaW5nQWN0aW9uKCk7XG5cblx0XHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9ucyhbbmV3IFNlbGVjdGlvbigxLCAxLCAzLCA1KSwgbmV3IFNlbGVjdGlvbig1LCAxLCA3LCA1KV0pO1xuXHRcdFx0XHRcdGV4ZWN1dGVBY3Rpb24oc29ydExpbmVzQXNjZW5kaW5nQWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZXNDb250ZW50KCksIFtcblx0XHRcdFx0XHRcdCdhbHBoYScsXG5cdFx0XHRcdFx0XHQnYmV0YScsXG5cdFx0XHRcdFx0XHQnb21pY3JvbicsXG5cdFx0XHRcdFx0XHQnJyxcblx0XHRcdFx0XHRcdCdhbHBoYScsXG5cdFx0XHRcdFx0XHQnYmV0YScsXG5cdFx0XHRcdFx0XHQnb21pY3Jvbidcblx0XHRcdFx0XHRdKTtcblx0XHRcdFx0XHRjb25zdCBleHBlY3RlZFNlbGVjdGlvbnMgPSBbXG5cdFx0XHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDMsIDcpLFxuXHRcdFx0XHRcdFx0bmV3IFNlbGVjdGlvbig1LCAxLCA3LCA3KVxuXHRcdFx0XHRcdF07XG5cdFx0XHRcdFx0ZWRpdG9yLmdldFNlbGVjdGlvbnMoKSEuZm9yRWFjaCgoYWN0dWFsU2VsZWN0aW9uLCBpbmRleCkgPT4ge1xuXHRcdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWxTZWxlY3Rpb24udG9TdHJpbmcoKSwgZXhwZWN0ZWRTZWxlY3Rpb25zW2luZGV4XS50b1N0cmluZygpKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdTb3J0TGluZXNEZXNjZW5kaW5nQWN0aW9uJywgKCkgPT4ge1xuXHRcdHRlc3QoJ3Nob3VsZCBzb3J0IHNlbGVjdGVkIGxpbmVzIGluIGRlc2NlbmRpbmcgb3JkZXInLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHR3aXRoVGVzdENvZGVFZGl0b3IoXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQnYWxwaGEnLFxuXHRcdFx0XHRcdCdiZXRhJyxcblx0XHRcdFx0XHQnb21pY3Jvbidcblx0XHRcdFx0XSwge30sIChlZGl0b3IpID0+IHtcblx0XHRcdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpITtcblx0XHRcdFx0XHRjb25zdCBzb3J0TGluZXNEZXNjZW5kaW5nQWN0aW9uID0gbmV3IFNvcnRMaW5lc0Rlc2NlbmRpbmdBY3Rpb24oKTtcblxuXHRcdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCAxLCAzLCA3KSk7XG5cdFx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihzb3J0TGluZXNEZXNjZW5kaW5nQWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZXNDb250ZW50KCksIFtcblx0XHRcdFx0XHRcdCdvbWljcm9uJyxcblx0XHRcdFx0XHRcdCdiZXRhJyxcblx0XHRcdFx0XHRcdCdhbHBoYSdcblx0XHRcdFx0XHRdKTtcblx0XHRcdFx0XHRhc3NlcnRTZWxlY3Rpb24oZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDEsIDMsIDUpKTtcblx0XHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgc29ydCBtdWx0aXBsZSBzZWxlY3Rpb25zIGluIGRlc2NlbmRpbmcgb3JkZXInLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHR3aXRoVGVzdENvZGVFZGl0b3IoXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQnYWxwaGEnLFxuXHRcdFx0XHRcdCdiZXRhJyxcblx0XHRcdFx0XHQnb21pY3JvbicsXG5cdFx0XHRcdFx0JycsXG5cdFx0XHRcdFx0J2FscGhhJyxcblx0XHRcdFx0XHQnYmV0YScsXG5cdFx0XHRcdFx0J29taWNyb24nXG5cdFx0XHRcdF0sIHt9LCAoZWRpdG9yKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKSE7XG5cdFx0XHRcdFx0Y29uc3Qgc29ydExpbmVzRGVzY2VuZGluZ0FjdGlvbiA9IG5ldyBTb3J0TGluZXNEZXNjZW5kaW5nQWN0aW9uKCk7XG5cblx0XHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9ucyhbbmV3IFNlbGVjdGlvbigxLCAxLCAzLCA3KSwgbmV3IFNlbGVjdGlvbig1LCAxLCA3LCA3KV0pO1xuXHRcdFx0XHRcdGV4ZWN1dGVBY3Rpb24oc29ydExpbmVzRGVzY2VuZGluZ0FjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVzQ29udGVudCgpLCBbXG5cdFx0XHRcdFx0XHQnb21pY3JvbicsXG5cdFx0XHRcdFx0XHQnYmV0YScsXG5cdFx0XHRcdFx0XHQnYWxwaGEnLFxuXHRcdFx0XHRcdFx0JycsXG5cdFx0XHRcdFx0XHQnb21pY3JvbicsXG5cdFx0XHRcdFx0XHQnYmV0YScsXG5cdFx0XHRcdFx0XHQnYWxwaGEnXG5cdFx0XHRcdFx0XSk7XG5cdFx0XHRcdFx0Y29uc3QgZXhwZWN0ZWRTZWxlY3Rpb25zID0gW1xuXHRcdFx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAzLCA1KSxcblx0XHRcdFx0XHRcdG5ldyBTZWxlY3Rpb24oNSwgMSwgNywgNSlcblx0XHRcdFx0XHRdO1xuXHRcdFx0XHRcdGVkaXRvci5nZXRTZWxlY3Rpb25zKCkhLmZvckVhY2goKGFjdHVhbFNlbGVjdGlvbiwgaW5kZXgpID0+IHtcblx0XHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsU2VsZWN0aW9uLnRvU3RyaW5nKCksIGV4cGVjdGVkU2VsZWN0aW9uc1tpbmRleF0udG9TdHJpbmcoKSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgnRGVsZXRlRHVwbGljYXRlTGluZXNBY3Rpb24nLCAoKSA9PiB7XG5cdFx0dGVzdCgnc2hvdWxkIHJlbW92ZSBkdXBsaWNhdGUgbGluZXMgd2l0aGluIHNlbGVjdGlvbicsIGZ1bmN0aW9uICgpIHtcblx0XHRcdHdpdGhUZXN0Q29kZUVkaXRvcihcblx0XHRcdFx0W1xuXHRcdFx0XHRcdCdhbHBoYScsXG5cdFx0XHRcdFx0J2JldGEnLFxuXHRcdFx0XHRcdCdiZXRhJyxcblx0XHRcdFx0XHQnYmV0YScsXG5cdFx0XHRcdFx0J2FscGhhJyxcblx0XHRcdFx0XHQnb21pY3JvbicsXG5cdFx0XHRcdF0sIHt9LCAoZWRpdG9yKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKSE7XG5cdFx0XHRcdFx0Y29uc3QgZGVsZXRlRHVwbGljYXRlTGluZXNBY3Rpb24gPSBuZXcgRGVsZXRlRHVwbGljYXRlTGluZXNBY3Rpb24oKTtcblxuXHRcdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCAzLCA2LCA0KSk7XG5cdFx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihkZWxldGVEdXBsaWNhdGVMaW5lc0FjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVzQ29udGVudCgpLCBbXG5cdFx0XHRcdFx0XHQnYWxwaGEnLFxuXHRcdFx0XHRcdFx0J2JldGEnLFxuXHRcdFx0XHRcdFx0J29taWNyb24nLFxuXHRcdFx0XHRcdF0pO1xuXHRcdFx0XHRcdGFzc2VydFNlbGVjdGlvbihlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMSwgMywgNykpO1xuXHRcdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCByZW1vdmUgZHVwbGljYXRlIGxpbmVzJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0d2l0aFRlc3RDb2RlRWRpdG9yKFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0J2FscGhhJyxcblx0XHRcdFx0XHQnYmV0YScsXG5cdFx0XHRcdFx0J2JldGEnLFxuXHRcdFx0XHRcdCdiZXRhJyxcblx0XHRcdFx0XHQnYWxwaGEnLFxuXHRcdFx0XHRcdCdvbWljcm9uJyxcblx0XHRcdFx0XSwge30sIChlZGl0b3IpID0+IHtcblx0XHRcdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpITtcblx0XHRcdFx0XHRjb25zdCBkZWxldGVEdXBsaWNhdGVMaW5lc0FjdGlvbiA9IG5ldyBEZWxldGVEdXBsaWNhdGVMaW5lc0FjdGlvbigpO1xuXG5cdFx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihkZWxldGVEdXBsaWNhdGVMaW5lc0FjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVzQ29udGVudCgpLCBbXG5cdFx0XHRcdFx0XHQnYWxwaGEnLFxuXHRcdFx0XHRcdFx0J2JldGEnLFxuXHRcdFx0XHRcdFx0J29taWNyb24nLFxuXHRcdFx0XHRcdF0pO1xuXHRcdFx0XHRcdGFzc2VydC5vayhlZGl0b3IuZ2V0U2VsZWN0aW9uKCkuaXNFbXB0eSgpKTtcblx0XHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgcmVtb3ZlIGR1cGxpY2F0ZSBsaW5lcyBpbiBtdWx0aXBsZSBzZWxlY3Rpb25zJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0d2l0aFRlc3RDb2RlRWRpdG9yKFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0J2FscGhhJyxcblx0XHRcdFx0XHQnYmV0YScsXG5cdFx0XHRcdFx0J2JldGEnLFxuXHRcdFx0XHRcdCdvbWljcm9uJyxcblx0XHRcdFx0XHQnJyxcblx0XHRcdFx0XHQnYWxwaGEnLFxuXHRcdFx0XHRcdCdhbHBoYScsXG5cdFx0XHRcdFx0J2JldGEnXG5cdFx0XHRcdF0sIHt9LCAoZWRpdG9yKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKSE7XG5cdFx0XHRcdFx0Y29uc3QgZGVsZXRlRHVwbGljYXRlTGluZXNBY3Rpb24gPSBuZXcgRGVsZXRlRHVwbGljYXRlTGluZXNBY3Rpb24oKTtcblxuXHRcdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtuZXcgU2VsZWN0aW9uKDEsIDIsIDQsIDMpLCBuZXcgU2VsZWN0aW9uKDYsIDIsIDgsIDMpXSk7XG5cdFx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihkZWxldGVEdXBsaWNhdGVMaW5lc0FjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVzQ29udGVudCgpLCBbXG5cdFx0XHRcdFx0XHQnYWxwaGEnLFxuXHRcdFx0XHRcdFx0J2JldGEnLFxuXHRcdFx0XHRcdFx0J29taWNyb24nLFxuXHRcdFx0XHRcdFx0JycsXG5cdFx0XHRcdFx0XHQnYWxwaGEnLFxuXHRcdFx0XHRcdFx0J2JldGEnXG5cdFx0XHRcdFx0XSk7XG5cdFx0XHRcdFx0Y29uc3QgZXhwZWN0ZWRTZWxlY3Rpb25zID0gW1xuXHRcdFx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAzLCA3KSxcblx0XHRcdFx0XHRcdG5ldyBTZWxlY3Rpb24oNSwgMSwgNiwgNClcblx0XHRcdFx0XHRdO1xuXHRcdFx0XHRcdGVkaXRvci5nZXRTZWxlY3Rpb25zKCkhLmZvckVhY2goKGFjdHVhbFNlbGVjdGlvbiwgaW5kZXgpID0+IHtcblx0XHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsU2VsZWN0aW9uLnRvU3RyaW5nKCksIGV4cGVjdGVkU2VsZWN0aW9uc1tpbmRleF0udG9TdHJpbmcoKSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXG5cdHN1aXRlKCdEZWxldGVBbGxMZWZ0QWN0aW9uJywgKCkgPT4ge1xuXHRcdHRlc3QoJ3Nob3VsZCBkZWxldGUgdG8gdGhlIGxlZnQgb2YgdGhlIGN1cnNvcicsIGZ1bmN0aW9uICgpIHtcblx0XHRcdHdpdGhUZXN0Q29kZUVkaXRvcihcblx0XHRcdFx0W1xuXHRcdFx0XHRcdCdvbmUnLFxuXHRcdFx0XHRcdCd0d28nLFxuXHRcdFx0XHRcdCd0aHJlZSdcblx0XHRcdFx0XSwge30sIChlZGl0b3IpID0+IHtcblx0XHRcdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpITtcblx0XHRcdFx0XHRjb25zdCBkZWxldGVBbGxMZWZ0QWN0aW9uID0gbmV3IERlbGV0ZUFsbExlZnRBY3Rpb24oKTtcblxuXHRcdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCAyLCAxLCAyKSk7XG5cdFx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihkZWxldGVBbGxMZWZ0QWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ25lJyk7XG5cblx0XHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9ucyhbbmV3IFNlbGVjdGlvbigyLCAyLCAyLCAyKSwgbmV3IFNlbGVjdGlvbigzLCAyLCAzLCAyKV0pO1xuXHRcdFx0XHRcdGV4ZWN1dGVBY3Rpb24oZGVsZXRlQWxsTGVmdEFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICd3bycpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgzKSwgJ2hyZWUnKTtcblx0XHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQganVtcCB0byB0aGUgcHJldmlvdXMgbGluZSB3aGVuIG9uIGZpcnN0IGNvbHVtbicsIGZ1bmN0aW9uICgpIHtcblx0XHRcdHdpdGhUZXN0Q29kZUVkaXRvcihcblx0XHRcdFx0W1xuXHRcdFx0XHRcdCdvbmUnLFxuXHRcdFx0XHRcdCd0d28nLFxuXHRcdFx0XHRcdCd0aHJlZSdcblx0XHRcdFx0XSwge30sIChlZGl0b3IpID0+IHtcblx0XHRcdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpITtcblx0XHRcdFx0XHRjb25zdCBkZWxldGVBbGxMZWZ0QWN0aW9uID0gbmV3IERlbGV0ZUFsbExlZnRBY3Rpb24oKTtcblxuXHRcdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigyLCAxLCAyLCAxKSk7XG5cdFx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihkZWxldGVBbGxMZWZ0QWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ29uZXR3bycpO1xuXG5cdFx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoW25ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSksIG5ldyBTZWxlY3Rpb24oMiwgMSwgMiwgMSldKTtcblx0XHRcdFx0XHRleGVjdXRlQWN0aW9uKGRlbGV0ZUFsbExlZnRBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVzQ29udGVudCgpWzBdLCAnb25ldHdvdGhyZWUnKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZXNDb250ZW50KCkubGVuZ3RoLCAxKTtcblxuXHRcdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSk7XG5cdFx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihkZWxldGVBbGxMZWZ0QWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lc0NvbnRlbnQoKVswXSwgJ29uZXR3b3RocmVlJyk7XG5cdFx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIGtlZXAgZGVsZXRpbmcgbGluZXMgaW4gbXVsdGkgY3Vyc29yIG1vZGUnLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHR3aXRoVGVzdENvZGVFZGl0b3IoXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQnaGkgbXkgbmFtZSBpcyBDYXJsb3MgTWF0b3MnLFxuXHRcdFx0XHRcdCdCQ0MnLFxuXHRcdFx0XHRcdCd3YXNvIHdhc28gd2FzbycsXG5cdFx0XHRcdFx0J215IHdpZmUgZG9lc250IGJlbGlldmUgaW4gbWUnLFxuXHRcdFx0XHRcdCdub25vbm9ub25vJyxcblx0XHRcdFx0XHQnYml0Y29ubmVlZWVjdCdcblx0XHRcdFx0XSwge30sIChlZGl0b3IpID0+IHtcblx0XHRcdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpITtcblx0XHRcdFx0XHRjb25zdCBkZWxldGVBbGxMZWZ0QWN0aW9uID0gbmV3IERlbGV0ZUFsbExlZnRBY3Rpb24oKTtcblxuXHRcdFx0XHRcdGNvbnN0IGJlZm9yZVNlY29uZFdhc29TZWxlY3Rpb24gPSBuZXcgU2VsZWN0aW9uKDMsIDUsIDMsIDUpO1xuXHRcdFx0XHRcdGNvbnN0IGVuZE9mQkNDU2VsZWN0aW9uID0gbmV3IFNlbGVjdGlvbigyLCA0LCAyLCA0KTtcblx0XHRcdFx0XHRjb25zdCBlbmRPZk5vbm9ubyA9IG5ldyBTZWxlY3Rpb24oNSwgMTEsIDUsIDExKTtcblxuXHRcdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtiZWZvcmVTZWNvbmRXYXNvU2VsZWN0aW9uLCBlbmRPZkJDQ1NlbGVjdGlvbiwgZW5kT2ZOb25vbm9dKTtcblxuXHRcdFx0XHRcdGV4ZWN1dGVBY3Rpb24oZGVsZXRlQWxsTGVmdEFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0XHRsZXQgc2VsZWN0aW9ucyA9IGVkaXRvci5nZXRTZWxlY3Rpb25zKCkhO1xuXG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnJyk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDMpLCAnIHdhc28gd2FzbycpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg1KSwgJycpO1xuXG5cdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChbXG5cdFx0XHRcdFx0XHRzZWxlY3Rpb25zWzBdLnN0YXJ0TGluZU51bWJlcixcblx0XHRcdFx0XHRcdHNlbGVjdGlvbnNbMF0uc3RhcnRDb2x1bW4sXG5cdFx0XHRcdFx0XHRzZWxlY3Rpb25zWzBdLmVuZExpbmVOdW1iZXIsXG5cdFx0XHRcdFx0XHRzZWxlY3Rpb25zWzBdLmVuZENvbHVtblxuXHRcdFx0XHRcdF0sIFszLCAxLCAzLCAxXSk7XG5cblx0XHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFtcblx0XHRcdFx0XHRcdHNlbGVjdGlvbnNbMV0uc3RhcnRMaW5lTnVtYmVyLFxuXHRcdFx0XHRcdFx0c2VsZWN0aW9uc1sxXS5zdGFydENvbHVtbixcblx0XHRcdFx0XHRcdHNlbGVjdGlvbnNbMV0uZW5kTGluZU51bWJlcixcblx0XHRcdFx0XHRcdHNlbGVjdGlvbnNbMV0uZW5kQ29sdW1uXG5cdFx0XHRcdFx0XSwgWzIsIDEsIDIsIDFdKTtcblxuXHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoW1xuXHRcdFx0XHRcdFx0c2VsZWN0aW9uc1syXS5zdGFydExpbmVOdW1iZXIsXG5cdFx0XHRcdFx0XHRzZWxlY3Rpb25zWzJdLnN0YXJ0Q29sdW1uLFxuXHRcdFx0XHRcdFx0c2VsZWN0aW9uc1syXS5lbmRMaW5lTnVtYmVyLFxuXHRcdFx0XHRcdFx0c2VsZWN0aW9uc1syXS5lbmRDb2x1bW5cblx0XHRcdFx0XHRdLCBbNSwgMSwgNSwgMV0pO1xuXG5cdFx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihkZWxldGVBbGxMZWZ0QWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRcdHNlbGVjdGlvbnMgPSBlZGl0b3IuZ2V0U2VsZWN0aW9ucygpITtcblxuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ2hpIG15IG5hbWUgaXMgQ2FybG9zIE1hdG9zIHdhc28gd2FzbycpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZWxlY3Rpb25zLmxlbmd0aCwgMik7XG5cblx0XHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFtcblx0XHRcdFx0XHRcdHNlbGVjdGlvbnNbMF0uc3RhcnRMaW5lTnVtYmVyLFxuXHRcdFx0XHRcdFx0c2VsZWN0aW9uc1swXS5zdGFydENvbHVtbixcblx0XHRcdFx0XHRcdHNlbGVjdGlvbnNbMF0uZW5kTGluZU51bWJlcixcblx0XHRcdFx0XHRcdHNlbGVjdGlvbnNbMF0uZW5kQ29sdW1uXG5cdFx0XHRcdFx0XSwgWzEsIDI3LCAxLCAyN10pO1xuXG5cdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChbXG5cdFx0XHRcdFx0XHRzZWxlY3Rpb25zWzFdLnN0YXJ0TGluZU51bWJlcixcblx0XHRcdFx0XHRcdHNlbGVjdGlvbnNbMV0uc3RhcnRDb2x1bW4sXG5cdFx0XHRcdFx0XHRzZWxlY3Rpb25zWzFdLmVuZExpbmVOdW1iZXIsXG5cdFx0XHRcdFx0XHRzZWxlY3Rpb25zWzFdLmVuZENvbHVtblxuXHRcdFx0XHRcdF0sIFsyLCAyOSwgMiwgMjldKTtcblx0XHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgd29yayBpbiBtdWx0aSBjdXJzb3IgbW9kZScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdHdpdGhUZXN0Q29kZUVkaXRvcihcblx0XHRcdFx0W1xuXHRcdFx0XHRcdCdoZWxsbycsXG5cdFx0XHRcdFx0J3dvcmxkJyxcblx0XHRcdFx0XHQnaGVsbG8gd29ybGQnLFxuXHRcdFx0XHRcdCdoZWxsbycsXG5cdFx0XHRcdFx0J2JvbmpvdXInLFxuXHRcdFx0XHRcdCdob2xhJyxcblx0XHRcdFx0XHQnd29ybGQnLFxuXHRcdFx0XHRcdCdoZWxsbyB3b3JsZCcsXG5cdFx0XHRcdF0sIHt9LCAoZWRpdG9yKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKSE7XG5cdFx0XHRcdFx0Y29uc3QgZGVsZXRlQWxsTGVmdEFjdGlvbiA9IG5ldyBEZWxldGVBbGxMZWZ0QWN0aW9uKCk7XG5cblx0XHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9ucyhbbmV3IFNlbGVjdGlvbigxLCAyLCAxLCAyKSwgbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA0KV0pO1xuXHRcdFx0XHRcdGV4ZWN1dGVBY3Rpb24oZGVsZXRlQWxsTGVmdEFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICdsbycpO1xuXG5cdFx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoW25ldyBTZWxlY3Rpb24oMiwgMiwgMiwgMiksIG5ldyBTZWxlY3Rpb24oMiwgNCwgMiwgNSldKTtcblx0XHRcdFx0XHRleGVjdXRlQWN0aW9uKGRlbGV0ZUFsbExlZnRBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnZCcpO1xuXG5cdFx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoW25ldyBTZWxlY3Rpb24oMywgMiwgMywgNSksIG5ldyBTZWxlY3Rpb24oMywgNywgMywgNyldKTtcblx0XHRcdFx0XHRleGVjdXRlQWN0aW9uKGRlbGV0ZUFsbExlZnRBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDMpLCAnd29ybGQnKTtcblxuXHRcdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtuZXcgU2VsZWN0aW9uKDQsIDMsIDQsIDMpLCBuZXcgU2VsZWN0aW9uKDQsIDUsIDUsIDQpXSk7XG5cdFx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihkZWxldGVBbGxMZWZ0QWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg0KSwgJ2pvdXInKTtcblxuXHRcdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtuZXcgU2VsZWN0aW9uKDUsIDMsIDYsIDMpLCBuZXcgU2VsZWN0aW9uKDYsIDUsIDcsIDUpLCBuZXcgU2VsZWN0aW9uKDcsIDcsIDcsIDcpXSk7XG5cdFx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihkZWxldGVBbGxMZWZ0QWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg1KSwgJ3dvcmxkJyk7XG5cdFx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnaXNzdWUgIzM2MjM0OiBzaG91bGQgcHVzaCB1bmRvIHN0b3AnLCAoKSA9PiB7XG5cdFx0XHR3aXRoVGVzdENvZGVFZGl0b3IoXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQnb25lJyxcblx0XHRcdFx0XHQndHdvJyxcblx0XHRcdFx0XHQndGhyZWUnXG5cdFx0XHRcdF0sIHt9LCAoZWRpdG9yKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKSE7XG5cdFx0XHRcdFx0Y29uc3QgZGVsZXRlQWxsTGVmdEFjdGlvbiA9IG5ldyBEZWxldGVBbGxMZWZ0QWN0aW9uKCk7XG5cblx0XHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSkpO1xuXG5cdFx0XHRcdFx0ZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgSGFuZGxlci5UeXBlLCB7IHRleHQ6ICdUeXBpbmcgc29tZSB0ZXh0IGhlcmUgb24gbGluZSAnIH0pO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ1R5cGluZyBzb21lIHRleHQgaGVyZSBvbiBsaW5lIG9uZScpO1xuXHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbigpLCBuZXcgU2VsZWN0aW9uKDEsIDMxLCAxLCAzMSkpO1xuXG5cdFx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihkZWxldGVBbGxMZWZ0QWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ29uZScpO1xuXHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbigpLCBuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpKTtcblxuXHRcdFx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuVW5kby5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnVHlwaW5nIHNvbWUgdGV4dCBoZXJlIG9uIGxpbmUgb25lJyk7XG5cdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9uKCksIG5ldyBTZWxlY3Rpb24oMSwgMzEsIDEsIDMxKSk7XG5cdFx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgnSm9pbkxpbmVzQWN0aW9uJywgKCkgPT4ge1xuXHRcdHRlc3QoJ3Nob3VsZCBqb2luIGxpbmVzIGFuZCBpbnNlcnQgc3BhY2UgaWYgbmVjZXNzYXJ5JywgZnVuY3Rpb24gKCkge1xuXHRcdFx0d2l0aFRlc3RDb2RlRWRpdG9yKFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0J2hlbGxvJyxcblx0XHRcdFx0XHQnd29ybGQnLFxuXHRcdFx0XHRcdCdoZWxsbyAnLFxuXHRcdFx0XHRcdCd3b3JsZCcsXG5cdFx0XHRcdFx0J2hlbGxvXHRcdCcsXG5cdFx0XHRcdFx0J1x0d29ybGQnLFxuXHRcdFx0XHRcdCdoZWxsbyAgICcsXG5cdFx0XHRcdFx0J1x0d29ybGQnLFxuXHRcdFx0XHRcdCcnLFxuXHRcdFx0XHRcdCcnLFxuXHRcdFx0XHRcdCdoZWxsbyB3b3JsZCdcblx0XHRcdFx0XSwge30sIChlZGl0b3IpID0+IHtcblx0XHRcdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpITtcblx0XHRcdFx0XHRjb25zdCBqb2luTGluZXNBY3Rpb24gPSBuZXcgSm9pbkxpbmVzQWN0aW9uKCk7XG5cblx0XHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgMiwgMSwgMikpO1xuXHRcdFx0XHRcdGV4ZWN1dGVBY3Rpb24oam9pbkxpbmVzQWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ2hlbGxvIHdvcmxkJyk7XG5cdFx0XHRcdFx0YXNzZXJ0U2VsZWN0aW9uKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCA2LCAxLCA2KSk7XG5cblx0XHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMiwgMiwgMiwgMikpO1xuXHRcdFx0XHRcdGV4ZWN1dGVBY3Rpb24oam9pbkxpbmVzQWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgyKSwgJ2hlbGxvIHdvcmxkJyk7XG5cdFx0XHRcdFx0YXNzZXJ0U2VsZWN0aW9uKGVkaXRvciwgbmV3IFNlbGVjdGlvbigyLCA3LCAyLCA3KSk7XG5cblx0XHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMywgMiwgMywgMikpO1xuXHRcdFx0XHRcdGV4ZWN1dGVBY3Rpb24oam9pbkxpbmVzQWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgzKSwgJ2hlbGxvIHdvcmxkJyk7XG5cdFx0XHRcdFx0YXNzZXJ0U2VsZWN0aW9uKGVkaXRvciwgbmV3IFNlbGVjdGlvbigzLCA3LCAzLCA3KSk7XG5cblx0XHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oNCwgMiwgNSwgMykpO1xuXHRcdFx0XHRcdGV4ZWN1dGVBY3Rpb24oam9pbkxpbmVzQWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg0KSwgJ2hlbGxvIHdvcmxkJyk7XG5cdFx0XHRcdFx0YXNzZXJ0U2VsZWN0aW9uKGVkaXRvciwgbmV3IFNlbGVjdGlvbig0LCAyLCA0LCA4KSk7XG5cblx0XHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oNSwgMSwgNywgMykpO1xuXHRcdFx0XHRcdGV4ZWN1dGVBY3Rpb24oam9pbkxpbmVzQWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg1KSwgJ2hlbGxvIHdvcmxkJyk7XG5cdFx0XHRcdFx0YXNzZXJ0U2VsZWN0aW9uKGVkaXRvciwgbmV3IFNlbGVjdGlvbig1LCAxLCA1LCAzKSk7XG5cdFx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnIzUwNDcxIEpvaW4gbGluZXMgYXQgdGhlIGVuZCBvZiBkb2N1bWVudCcsIGZ1bmN0aW9uICgpIHtcblx0XHRcdHdpdGhUZXN0Q29kZUVkaXRvcihcblx0XHRcdFx0W1xuXHRcdFx0XHRcdCdoZWxsbycsXG5cdFx0XHRcdFx0J3dvcmxkJ1xuXHRcdFx0XHRdLCB7fSwgKGVkaXRvcikgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCkhO1xuXHRcdFx0XHRcdGNvbnN0IGpvaW5MaW5lc0FjdGlvbiA9IG5ldyBKb2luTGluZXNBY3Rpb24oKTtcblxuXHRcdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigyLCAxLCAyLCAxKSk7XG5cdFx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihqb2luTGluZXNBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnaGVsbG8nKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICd3b3JsZCcpO1xuXHRcdFx0XHRcdGFzc2VydFNlbGVjdGlvbihlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMiwgNiwgMiwgNikpO1xuXHRcdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCB3b3JrIGluIG11bHRpIGN1cnNvciBtb2RlJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0d2l0aFRlc3RDb2RlRWRpdG9yKFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0J2hlbGxvJyxcblx0XHRcdFx0XHQnd29ybGQnLFxuXHRcdFx0XHRcdCdoZWxsbyAnLFxuXHRcdFx0XHRcdCd3b3JsZCcsXG5cdFx0XHRcdFx0J2hlbGxvXHRcdCcsXG5cdFx0XHRcdFx0J1x0d29ybGQnLFxuXHRcdFx0XHRcdCdoZWxsbyAgICcsXG5cdFx0XHRcdFx0J1x0d29ybGQnLFxuXHRcdFx0XHRcdCcnLFxuXHRcdFx0XHRcdCcnLFxuXHRcdFx0XHRcdCdoZWxsbyB3b3JsZCdcblx0XHRcdFx0XSwge30sIChlZGl0b3IpID0+IHtcblx0XHRcdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpITtcblx0XHRcdFx0XHRjb25zdCBqb2luTGluZXNBY3Rpb24gPSBuZXcgSm9pbkxpbmVzQWN0aW9uKCk7XG5cblx0XHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9ucyhbXG5cdFx0XHRcdFx0XHQvKiogcHJpbWFyeSBjdXJzb3IgKi9cblx0XHRcdFx0XHRcdG5ldyBTZWxlY3Rpb24oNSwgMiwgNSwgMiksXG5cdFx0XHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDIsIDEsIDIpLFxuXHRcdFx0XHRcdFx0bmV3IFNlbGVjdGlvbigzLCAyLCA0LCAyKSxcblx0XHRcdFx0XHRcdG5ldyBTZWxlY3Rpb24oNSwgNCwgNiwgMyksXG5cdFx0XHRcdFx0XHRuZXcgU2VsZWN0aW9uKDcsIDUsIDgsIDQpLFxuXHRcdFx0XHRcdFx0bmV3IFNlbGVjdGlvbigxMCwgMSwgMTAsIDEpXG5cdFx0XHRcdFx0XSk7XG5cblx0XHRcdFx0XHRleGVjdXRlQWN0aW9uKGpvaW5MaW5lc0FjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZXNDb250ZW50KCkuam9pbignXFxuJyksICdoZWxsbyB3b3JsZFxcbmhlbGxvIHdvcmxkXFxuaGVsbG8gd29ybGRcXG5oZWxsbyB3b3JsZFxcblxcbmhlbGxvIHdvcmxkJyk7XG5cdFx0XHRcdFx0YXNzZXJ0U2VsZWN0aW9uKGVkaXRvciwgW1xuXHRcdFx0XHRcdFx0LyoqIHByaW1hcnkgY3Vyc29yICovXG5cdFx0XHRcdFx0XHRuZXcgU2VsZWN0aW9uKDMsIDQsIDMsIDgpLFxuXHRcdFx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCA2LCAxLCA2KSxcblx0XHRcdFx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgMiwgMiwgOCksXG5cdFx0XHRcdFx0XHRuZXcgU2VsZWN0aW9uKDQsIDUsIDQsIDkpLFxuXHRcdFx0XHRcdFx0bmV3IFNlbGVjdGlvbig2LCAxLCA2LCAxKVxuXHRcdFx0XHRcdF0pO1xuXHRcdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCBwdXNoIHVuZG8gc3RvcCcsIGZ1bmN0aW9uICgpIHtcblx0XHRcdHdpdGhUZXN0Q29kZUVkaXRvcihcblx0XHRcdFx0W1xuXHRcdFx0XHRcdCdoZWxsbycsXG5cdFx0XHRcdFx0J3dvcmxkJ1xuXHRcdFx0XHRdLCB7fSwgKGVkaXRvcikgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCkhO1xuXHRcdFx0XHRcdGNvbnN0IGpvaW5MaW5lc0FjdGlvbiA9IG5ldyBKb2luTGluZXNBY3Rpb24oKTtcblxuXHRcdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCA2LCAxLCA2KSk7XG5cblx0XHRcdFx0XHRlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCBIYW5kbGVyLlR5cGUsIHsgdGV4dDogJyBteSBkZWFyJyB9KTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICdoZWxsbyBteSBkZWFyJyk7XG5cdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9uKCksIG5ldyBTZWxlY3Rpb24oMSwgMTQsIDEsIDE0KSk7XG5cblx0XHRcdFx0XHRleGVjdXRlQWN0aW9uKGpvaW5MaW5lc0FjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICdoZWxsbyBteSBkZWFyIHdvcmxkJyk7XG5cdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9uKCksIG5ldyBTZWxlY3Rpb24oMSwgMTQsIDEsIDE0KSk7XG5cblx0XHRcdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlVuZG8ucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ2hlbGxvIG15IGRlYXInKTtcblx0XHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb24oKSwgbmV3IFNlbGVjdGlvbigxLCAxNCwgMSwgMTQpKTtcblx0XHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3RyYW5zcG9zZScsICgpID0+IHtcblx0XHR3aXRoVGVzdENvZGVFZGl0b3IoXG5cdFx0XHRbXG5cdFx0XHRcdCdoZWxsbyB3b3JsZCcsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JyAgICcsXG5cdFx0XHRdLCB7fSwgKGVkaXRvcikgPT4ge1xuXHRcdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpITtcblx0XHRcdFx0Y29uc3QgdHJhbnNwb3NlQWN0aW9uID0gbmV3IFRyYW5zcG9zZUFjdGlvbigpO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSk7XG5cdFx0XHRcdGV4ZWN1dGVBY3Rpb24odHJhbnNwb3NlQWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICdoZWxsbyB3b3JsZCcpO1xuXHRcdFx0XHRhc3NlcnRTZWxlY3Rpb24oZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDIsIDEsIDIpKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgNiwgMSwgNikpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKHRyYW5zcG9zZUFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnaGVsbCBvd29ybGQnKTtcblx0XHRcdFx0YXNzZXJ0U2VsZWN0aW9uKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCA3LCAxLCA3KSk7XG5cblx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDEsIDEyLCAxLCAxMikpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKHRyYW5zcG9zZUFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnaGVsbCBvd29ybCcpO1xuXHRcdFx0XHRhc3NlcnRTZWxlY3Rpb24oZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDIsIDIsIDIsIDIpKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMywgMSwgMywgMSkpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKHRyYW5zcG9zZUFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDMpLCAnJyk7XG5cdFx0XHRcdGFzc2VydFNlbGVjdGlvbihlZGl0b3IsIG5ldyBTZWxlY3Rpb24oNCwgMSwgNCwgMSkpO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbig0LCAyLCA0LCAyKSk7XG5cdFx0XHRcdGV4ZWN1dGVBY3Rpb24odHJhbnNwb3NlQWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoNCksICcgICAnKTtcblx0XHRcdFx0YXNzZXJ0U2VsZWN0aW9uKGVkaXRvciwgbmV3IFNlbGVjdGlvbig0LCAzLCA0LCAzKSk7XG5cdFx0XHR9XG5cdFx0KTtcblxuXHRcdC8vIGZpeCAjMTY2MzNcblx0XHR3aXRoVGVzdENvZGVFZGl0b3IoXG5cdFx0XHRbXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0J2hlbGxvJyxcblx0XHRcdFx0J3dvcmxkJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCdoZWxsbyB3b3JsZCcsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnaGVsbG8gd29ybGQnXG5cdFx0XHRdLCB7fSwgKGVkaXRvcikgPT4ge1xuXHRcdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpITtcblx0XHRcdFx0Y29uc3QgdHJhbnNwb3NlQWN0aW9uID0gbmV3IFRyYW5zcG9zZUFjdGlvbigpO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSk7XG5cdFx0XHRcdGV4ZWN1dGVBY3Rpb24odHJhbnNwb3NlQWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICcnKTtcblx0XHRcdFx0YXNzZXJ0U2VsZWN0aW9uKGVkaXRvciwgbmV3IFNlbGVjdGlvbigyLCAxLCAyLCAxKSk7XG5cblx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDMsIDYsIDMsIDYpKTtcblx0XHRcdFx0ZXhlY3V0ZUFjdGlvbih0cmFuc3Bvc2VBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg0KSwgJ293b3JsZCcpO1xuXHRcdFx0XHRhc3NlcnRTZWxlY3Rpb24oZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDQsIDIsIDQsIDIpKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oNiwgMTIsIDYsIDEyKSk7XG5cdFx0XHRcdGV4ZWN1dGVBY3Rpb24odHJhbnNwb3NlQWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoNyksICdkJyk7XG5cdFx0XHRcdGFzc2VydFNlbGVjdGlvbihlZGl0b3IsIG5ldyBTZWxlY3Rpb24oNywgMiwgNywgMikpO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbig4LCAxMiwgOCwgMTIpKTtcblx0XHRcdFx0ZXhlY3V0ZUFjdGlvbih0cmFuc3Bvc2VBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg4KSwgJ2hlbGxvIHdvcmxkJyk7XG5cdFx0XHRcdGFzc2VydFNlbGVjdGlvbihlZGl0b3IsIG5ldyBTZWxlY3Rpb24oOCwgMTIsIDgsIDEyKSk7XG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgndG9nZ2xlIGNhc2UnLCBmdW5jdGlvbiAoKSB7XG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKFxuXHRcdFx0W1xuXHRcdFx0XHQnaGVsbG8gd29ybGQnLFxuXHRcdFx0XHQnXHUwMEY2XHUwMEU3XHUwMTVGXHUwMTFGXHUwMEZDJyxcblx0XHRcdFx0J3BhcnNlSFRNTFN0cmluZycsXG5cdFx0XHRcdCdnZXRFbGVtZW50QnlJZCcsXG5cdFx0XHRcdCdpbnNlcnRIVE1MJyxcblx0XHRcdFx0J1Bhc2NhbENhc2UnLFxuXHRcdFx0XHQnQ1NTU2VsZWN0b3JzTGlzdCcsXG5cdFx0XHRcdCdpRCcsXG5cdFx0XHRcdCd0RVNUJyxcblx0XHRcdFx0J1x1MDBGNlx1MDBFN1x1MDE1Rlx1MDBENlx1MDBDN1x1MDE1RVx1MDExRlx1MDBGQ1x1MDExRVx1MDBEQycsXG5cdFx0XHRcdCdhdWRpb0NvbnZlcnRlci5jb252ZXJ0TTRBVG9NUDMoKTsnLFxuXHRcdFx0XHQnc25ha2VfY2FzZScsXG5cdFx0XHRcdCdDYXBpdGFsX1NuYWtlX0Nhc2UnLFxuXHRcdFx0XHRgZnVuY3Rpb24gaGVsbG9Xb3JsZCgpIHtcblx0XHRcdFx0cmV0dXJuIHNvbWVHbG9iYWxPYmplY3QucHJpbnRIZWxsb1dvcmxkKFwiZW5cIiwgXCJ1dGYtOFwiKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRoZWxsb1dvcmxkKCk7YC5yZXBsYWNlKC9eXFxzKy9nbSwgJycpLFxuXHRcdFx0XHRgJ0phdmFTY3JpcHQnYCxcblx0XHRcdFx0J3BhcnNlSFRNTDRTdHJpbmcnLFxuXHRcdFx0XHQnX2FjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yJ1xuXHRcdFx0XSwge30sIChlZGl0b3IpID0+IHtcblx0XHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKSE7XG5cdFx0XHRcdGNvbnN0IHVwcGVyY2FzZUFjdGlvbiA9IG5ldyBVcHBlckNhc2VBY3Rpb24oKTtcblx0XHRcdFx0Y29uc3QgbG93ZXJjYXNlQWN0aW9uID0gbmV3IExvd2VyQ2FzZUFjdGlvbigpO1xuXHRcdFx0XHRjb25zdCB0aXRsZWNhc2VBY3Rpb24gPSBuZXcgVGl0bGVDYXNlQWN0aW9uKCk7XG5cdFx0XHRcdGNvbnN0IHNuYWtlY2FzZUFjdGlvbiA9IG5ldyBTbmFrZUNhc2VBY3Rpb24oKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMTIpKTtcblx0XHRcdFx0ZXhlY3V0ZUFjdGlvbih1cHBlcmNhc2VBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ0hFTExPIFdPUkxEJyk7XG5cdFx0XHRcdGFzc2VydFNlbGVjdGlvbihlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMTIpKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMTIpKTtcblx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihsb3dlcmNhc2VBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ2hlbGxvIHdvcmxkJyk7XG5cdFx0XHRcdGFzc2VydFNlbGVjdGlvbihlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMTIpKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgMywgMSwgMykpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKHVwcGVyY2FzZUFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnSEVMTE8gd29ybGQnKTtcblx0XHRcdFx0YXNzZXJ0U2VsZWN0aW9uKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCAzLCAxLCAzKSk7XG5cblx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDQpKTtcblx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihsb3dlcmNhc2VBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ2hlbGxvIHdvcmxkJyk7XG5cdFx0XHRcdGFzc2VydFNlbGVjdGlvbihlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNCkpO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxMikpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKHRpdGxlY2FzZUFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnSGVsbG8gV29ybGQnKTtcblx0XHRcdFx0YXNzZXJ0U2VsZWN0aW9uKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxMikpO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigyLCAxLCAyLCA2KSk7XG5cdFx0XHRcdGV4ZWN1dGVBY3Rpb24odXBwZXJjYXNlQWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICdcdTAwRDZcdTAwQzdcdTAxNUVcdTAxMUVcdTAwREMnKTtcblx0XHRcdFx0YXNzZXJ0U2VsZWN0aW9uKGVkaXRvciwgbmV3IFNlbGVjdGlvbigyLCAxLCAyLCA2KSk7XG5cblx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDIsIDEsIDIsIDYpKTtcblx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihsb3dlcmNhc2VBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgyKSwgJ1x1MDBGNlx1MDBFN1x1MDE1Rlx1MDExRlx1MDBGQycpO1xuXHRcdFx0XHRhc3NlcnRTZWxlY3Rpb24oZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDIsIDEsIDIsIDYpKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMiwgMSwgMiwgNikpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKHRpdGxlY2FzZUFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnXHUwMEQ2XHUwMEU3XHUwMTVGXHUwMTFGXHUwMEZDJyk7XG5cdFx0XHRcdGFzc2VydFNlbGVjdGlvbihlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMiwgMSwgMiwgNikpO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigzLCAxLCAzLCAxNikpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKHNuYWtlY2FzZUFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDMpLCAncGFyc2VfaHRtbF9zdHJpbmcnKTtcblx0XHRcdFx0YXNzZXJ0U2VsZWN0aW9uKGVkaXRvciwgbmV3IFNlbGVjdGlvbigzLCAxLCAzLCAxOCkpO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbig0LCAxLCA0LCAxNSkpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKHNuYWtlY2FzZUFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDQpLCAnZ2V0X2VsZW1lbnRfYnlfaWQnKTtcblx0XHRcdFx0YXNzZXJ0U2VsZWN0aW9uKGVkaXRvciwgbmV3IFNlbGVjdGlvbig0LCAxLCA0LCAxOCkpO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbig1LCAxLCA1LCAxMSkpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKHNuYWtlY2FzZUFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDUpLCAnaW5zZXJ0X2h0bWwnKTtcblx0XHRcdFx0YXNzZXJ0U2VsZWN0aW9uKGVkaXRvciwgbmV3IFNlbGVjdGlvbig1LCAxLCA1LCAxMikpO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbig2LCAxLCA2LCAxMSkpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKHNuYWtlY2FzZUFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDYpLCAncGFzY2FsX2Nhc2UnKTtcblx0XHRcdFx0YXNzZXJ0U2VsZWN0aW9uKGVkaXRvciwgbmV3IFNlbGVjdGlvbig2LCAxLCA2LCAxMikpO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbig3LCAxLCA3LCAxNykpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKHNuYWtlY2FzZUFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDcpLCAnY3NzX3NlbGVjdG9yc19saXN0Jyk7XG5cdFx0XHRcdGFzc2VydFNlbGVjdGlvbihlZGl0b3IsIG5ldyBTZWxlY3Rpb24oNywgMSwgNywgMTkpKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oOCwgMSwgOCwgMykpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKHNuYWtlY2FzZUFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDgpLCAnaV9kJyk7XG5cdFx0XHRcdGFzc2VydFNlbGVjdGlvbihlZGl0b3IsIG5ldyBTZWxlY3Rpb24oOCwgMSwgOCwgNCkpO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbig5LCAxLCA5LCA1KSk7XG5cdFx0XHRcdGV4ZWN1dGVBY3Rpb24oc25ha2VjYXNlQWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoOSksICd0X2VzdCcpO1xuXHRcdFx0XHRhc3NlcnRTZWxlY3Rpb24oZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDksIDEsIDksIDYpKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMTAsIDEsIDEwLCAxMSkpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKHNuYWtlY2FzZUFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEwKSwgJ1x1MDBGNlx1MDBFN1x1MDE1Rl9cdTAwRjZcdTAwRTdfXHUwMTVGXHUwMTFGXHUwMEZDX1x1MDExRlx1MDBGQycpO1xuXHRcdFx0XHRhc3NlcnRTZWxlY3Rpb24oZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEwLCAxLCAxMCwgMTQpKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMTEsIDEsIDExLCAzNCkpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKHNuYWtlY2FzZUFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDExKSwgJ2F1ZGlvX2NvbnZlcnRlci5jb252ZXJ0X200YV90b19tcDMoKTsnKTtcblx0XHRcdFx0YXNzZXJ0U2VsZWN0aW9uKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxMSwgMSwgMTEsIDM4KSk7XG5cblx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDEyLCAxLCAxMiwgMTEpKTtcblx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihzbmFrZWNhc2VBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxMiksICdzbmFrZV9jYXNlJyk7XG5cdFx0XHRcdGFzc2VydFNlbGVjdGlvbihlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMTIsIDEsIDEyLCAxMSkpO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxMywgMSwgMTMsIDE5KSk7XG5cdFx0XHRcdGV4ZWN1dGVBY3Rpb24oc25ha2VjYXNlQWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMTMpLCAnY2FwaXRhbF9zbmFrZV9jYXNlJyk7XG5cdFx0XHRcdGFzc2VydFNlbGVjdGlvbihlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMTMsIDEsIDEzLCAxOSkpO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxNCwgMSwgMTcsIDE0KSk7XG5cdFx0XHRcdGV4ZWN1dGVBY3Rpb24oc25ha2VjYXNlQWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWVJblJhbmdlKG5ldyBTZWxlY3Rpb24oMTQsIDEsIDE3LCAxNSkpLCBgZnVuY3Rpb24gaGVsbG9fd29ybGQoKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHNvbWVfZ2xvYmFsX29iamVjdC5wcmludF9oZWxsb193b3JsZChcImVuXCIsIFwidXRmLThcIik7XG5cdFx0XHRcdH1cblx0XHRcdFx0aGVsbG9fd29ybGQoKTtgLnJlcGxhY2UoL15cXHMrL2dtLCAnJykpO1xuXHRcdFx0XHRhc3NlcnRTZWxlY3Rpb24oZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDE0LCAxLCAxNywgMTUpKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMTgsIDEsIDE4LCAxMykpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKHNuYWtlY2FzZUFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDE4KSwgYCdqYXZhX3NjcmlwdCdgKTtcblx0XHRcdFx0YXNzZXJ0U2VsZWN0aW9uKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxOCwgMSwgMTgsIDE0KSk7XG5cblx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDE5LCAxLCAxOSwgMTcpKTtcblx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihzbmFrZWNhc2VBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxOSksICdwYXJzZV9odG1sNF9zdHJpbmcnKTtcblx0XHRcdFx0YXNzZXJ0U2VsZWN0aW9uKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxOSwgMSwgMTksIDE5KSk7XG5cblx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDIwLCAxLCAyMCwgMjgpKTtcblx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihzbmFrZWNhc2VBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgyMCksICdfYWNjZXNzb3I6IHNlcnZpY2VzX2FjY2Vzc29yJyk7XG5cdFx0XHRcdGFzc2VydFNlbGVjdGlvbihlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMjAsIDEsIDIwLCAyOSkpO1xuXHRcdFx0fVxuXHRcdCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IoXG5cdFx0XHRbXG5cdFx0XHRcdCdmb08gYmFSIEJhWicsXG5cdFx0XHRcdCdmb09cXCdiYVJcXCdCYVonLFxuXHRcdFx0XHQnZm9PW2JhUl1CYVonLFxuXHRcdFx0XHQnZm9PYGJhUn5CYVonLFxuXHRcdFx0XHQnZm9PXmJhUiVCYVonLFxuXHRcdFx0XHQnZm9PJGJhUiFCYVonLFxuXHRcdFx0XHQnXFwncGh5c2ljaWFuXFwncyBhc3Npc3RhbnRcXCcnXG5cdFx0XHRdLCB7fSwgKGVkaXRvcikgPT4ge1xuXHRcdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpITtcblx0XHRcdFx0Y29uc3QgdGl0bGVjYXNlQWN0aW9uID0gbmV3IFRpdGxlQ2FzZUFjdGlvbigpO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxMikpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKHRpdGxlY2FzZUFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnRm9vIEJhciBCYXonKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMiwgMSwgMiwgMTIpKTtcblx0XHRcdFx0ZXhlY3V0ZUFjdGlvbih0aXRsZWNhc2VBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgyKSwgJ0Zvb1xcJ2JhclxcJ2JheicpO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigzLCAxLCAzLCAxMikpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKHRpdGxlY2FzZUFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDMpLCAnRm9vW0Jhcl1CYXonKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oNCwgMSwgNCwgMTIpKTtcblx0XHRcdFx0ZXhlY3V0ZUFjdGlvbih0aXRsZWNhc2VBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg0KSwgJ0Zvb2BCYXJ+QmF6Jyk7XG5cblx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDUsIDEsIDUsIDEyKSk7XG5cdFx0XHRcdGV4ZWN1dGVBY3Rpb24odGl0bGVjYXNlQWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoNSksICdGb29eQmFyJUJheicpO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbig2LCAxLCA2LCAxMikpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKHRpdGxlY2FzZUFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDYpLCAnRm9vJEJhciFCYXonKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oNywgMSwgNywgMjMpKTtcblx0XHRcdFx0ZXhlY3V0ZUFjdGlvbih0aXRsZWNhc2VBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg3KSwgJ1xcJ1BoeXNpY2lhblxcJ3MgQXNzaXN0YW50XFwnJyk7XG5cdFx0XHR9XG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihcblx0XHRcdFtcblx0XHRcdFx0J2NhbWVsIGZyb20gd29yZHMnLFxuXHRcdFx0XHQnZnJvbV9zbmFrZV9jYXNlJyxcblx0XHRcdFx0J2Zyb20ta2ViYWItY2FzZScsXG5cdFx0XHRcdCdhbHJlYWR5Q2FtZWwnLFxuXHRcdFx0XHQnUmVUYWluX2FueV9DQVBpdGFsaXphdGlvbicsXG5cdFx0XHRcdCdteV92YXIudGVzdF9mdW5jdGlvbigpJyxcblx0XHRcdFx0J1x1MDBGNlx1MDBFN1x1MDE1Rl9cdTAwRjZcdTAwRTdfXHUwMTVGXHUwMTFGXHUwMEZDX1x1MDExRlx1MDBGQydcblx0XHRcdF0sIHt9LCAoZWRpdG9yKSA9PiB7XG5cdFx0XHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCkhO1xuXHRcdFx0XHRjb25zdCBjYW1lbGNhc2VBY3Rpb24gPSBuZXcgQ2FtZWxDYXNlQWN0aW9uKCk7XG5cblx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDE4KSk7XG5cdFx0XHRcdGV4ZWN1dGVBY3Rpb24oY2FtZWxjYXNlQWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICdjYW1lbEZyb21Xb3JkcycpO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigyLCAxLCAyLCAxNSkpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKGNhbWVsY2FzZUFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnZnJvbVNuYWtlQ2FzZScpO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigzLCAxLCAzLCAxNSkpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKGNhbWVsY2FzZUFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDMpLCAnZnJvbUtlYmFiQ2FzZScpO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbig0LCAxLCA0LCAxMikpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKGNhbWVsY2FzZUFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDQpLCAnYWxyZWFkeUNhbWVsJyk7XG5cblx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDUsIDEsIDUsIDI2KSk7XG5cdFx0XHRcdGV4ZWN1dGVBY3Rpb24oY2FtZWxjYXNlQWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoNSksICdSZVRhaW5BbnlDQVBpdGFsaXphdGlvbicpO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbig2LCAxLCA2LCAyMykpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKGNhbWVsY2FzZUFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDYpLCAnbXlWYXIudGVzdEZ1bmN0aW9uKCknKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oNywgMSwgNywgMTQpKTtcblx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihjYW1lbGNhc2VBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg3KSwgJ1x1MDBGNlx1MDBFN1x1MDE1Rlx1MDBENlx1MDBFN1x1MDE1RVx1MDExRlx1MDBGQ1x1MDExRVx1MDBGQycpO1xuXHRcdFx0fVxuXHRcdCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IoXG5cdFx0XHRbXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnICAgJ1xuXHRcdFx0XSwge30sIChlZGl0b3IpID0+IHtcblx0XHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKSE7XG5cdFx0XHRcdGNvbnN0IHVwcGVyY2FzZUFjdGlvbiA9IG5ldyBVcHBlckNhc2VBY3Rpb24oKTtcblx0XHRcdFx0Y29uc3QgbG93ZXJjYXNlQWN0aW9uID0gbmV3IExvd2VyQ2FzZUFjdGlvbigpO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSk7XG5cdFx0XHRcdGV4ZWN1dGVBY3Rpb24odXBwZXJjYXNlQWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICcnKTtcblx0XHRcdFx0YXNzZXJ0U2VsZWN0aW9uKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSk7XG5cblx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpKTtcblx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihsb3dlcmNhc2VBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJycpO1xuXHRcdFx0XHRhc3NlcnRTZWxlY3Rpb24oZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMiwgMiwgMiwgMikpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKHVwcGVyY2FzZUFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnICAgJyk7XG5cdFx0XHRcdGFzc2VydFNlbGVjdGlvbihlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMiwgMiwgMiwgMikpO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigyLCAyLCAyLCAyKSk7XG5cdFx0XHRcdGV4ZWN1dGVBY3Rpb24obG93ZXJjYXNlQWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICcgICAnKTtcblx0XHRcdFx0YXNzZXJ0U2VsZWN0aW9uKGVkaXRvciwgbmV3IFNlbGVjdGlvbigyLCAyLCAyLCAyKSk7XG5cdFx0XHR9XG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihcblx0XHRcdFtcblx0XHRcdFx0J2hlbGxvIHdvcmxkJyxcblx0XHRcdFx0J1x1MDBGNlx1MDBFN1x1MDE1Rlx1MDExRlx1MDBGQycsXG5cdFx0XHRcdCdwYXJzZUhUTUxTdHJpbmcnLFxuXHRcdFx0XHQnZ2V0RWxlbWVudEJ5SWQnLFxuXHRcdFx0XHQnUGFzY2FsQ2FzZScsXG5cdFx0XHRcdCdcdTAwRjZcdTAwRTdcdTAxNUZcdTAwRDZcdTAwQzdcdTAxNUVcdTAxMUZcdTAwRkNcdTAxMUVcdTAwREMnLFxuXHRcdFx0XHQnYXVkaW9Db252ZXJ0ZXIuY29udmVydE00QVRvTVAzKCk7Jyxcblx0XHRcdFx0J0NhcGl0YWxfU25ha2VfQ2FzZScsXG5cdFx0XHRcdCdwYXJzZUhUTUw0U3RyaW5nJyxcblx0XHRcdFx0J19hY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvcicsXG5cdFx0XHRcdCdLZWJhYi1DYXNlJyxcblx0XHRcdF0sIHt9LCAoZWRpdG9yKSA9PiB7XG5cdFx0XHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCkhO1xuXHRcdFx0XHRjb25zdCBrZWJhYkNhc2VBY3Rpb24gPSBuZXcgS2ViYWJDYXNlQWN0aW9uKCk7XG5cblx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEyKSk7XG5cdFx0XHRcdGV4ZWN1dGVBY3Rpb24oa2ViYWJDYXNlQWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICdoZWxsbyB3b3JsZCcpO1xuXHRcdFx0XHRhc3NlcnRTZWxlY3Rpb24oZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEyKSk7XG5cblx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDIsIDEsIDIsIDYpKTtcblx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihrZWJhYkNhc2VBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgyKSwgJ1x1MDBGNlx1MDBFN1x1MDE1Rlx1MDExRlx1MDBGQycpO1xuXHRcdFx0XHRhc3NlcnRTZWxlY3Rpb24oZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDIsIDEsIDIsIDYpKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMywgMSwgMywgMTYpKTtcblx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihrZWJhYkNhc2VBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgzKSwgJ3BhcnNlLWh0bWwtc3RyaW5nJyk7XG5cdFx0XHRcdGFzc2VydFNlbGVjdGlvbihlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMywgMSwgMywgMTgpKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oNCwgMSwgNCwgMTUpKTtcblx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihrZWJhYkNhc2VBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg0KSwgJ2dldC1lbGVtZW50LWJ5LWlkJyk7XG5cdFx0XHRcdGFzc2VydFNlbGVjdGlvbihlZGl0b3IsIG5ldyBTZWxlY3Rpb24oNCwgMSwgNCwgMTgpKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oNSwgMSwgNSwgMTEpKTtcblx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihrZWJhYkNhc2VBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg1KSwgJ3Bhc2NhbC1jYXNlJyk7XG5cdFx0XHRcdGFzc2VydFNlbGVjdGlvbihlZGl0b3IsIG5ldyBTZWxlY3Rpb24oNSwgMSwgNSwgMTIpKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oNiwgMSwgNiwgMTEpKTtcblx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihrZWJhYkNhc2VBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg2KSwgJ1x1MDBGNlx1MDBFN1x1MDE1Ri1cdTAwRjZcdTAwRTctXHUwMTVGXHUwMTFGXHUwMEZDLVx1MDExRlx1MDBGQycpO1xuXHRcdFx0XHRhc3NlcnRTZWxlY3Rpb24oZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDYsIDEsIDYsIDE0KSk7XG5cblx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDcsIDEsIDcsIDM0KSk7XG5cdFx0XHRcdGV4ZWN1dGVBY3Rpb24oa2ViYWJDYXNlQWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoNyksICdhdWRpby1jb252ZXJ0ZXIuY29udmVydC1tNGEtdG8tbXAzKCk7Jyk7XG5cdFx0XHRcdGFzc2VydFNlbGVjdGlvbihlZGl0b3IsIG5ldyBTZWxlY3Rpb24oNywgMSwgNywgMzgpKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oOCwgMSwgOCwgMTkpKTtcblx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihrZWJhYkNhc2VBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg4KSwgJ2NhcGl0YWwtc25ha2UtY2FzZScpO1xuXHRcdFx0XHRhc3NlcnRTZWxlY3Rpb24oZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDgsIDEsIDgsIDE5KSk7XG5cblx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDksIDEsIDksIDE3KSk7XG5cdFx0XHRcdGV4ZWN1dGVBY3Rpb24oa2ViYWJDYXNlQWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoOSksICdwYXJzZS1odG1sNC1zdHJpbmcnKTtcblx0XHRcdFx0YXNzZXJ0U2VsZWN0aW9uKGVkaXRvciwgbmV3IFNlbGVjdGlvbig5LCAxLCA5LCAxOSkpO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxMCwgMSwgMTAsIDI4KSk7XG5cdFx0XHRcdGV4ZWN1dGVBY3Rpb24oa2ViYWJDYXNlQWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMTApLCAnX2FjY2Vzc29yOiBzZXJ2aWNlcy1hY2Nlc3NvcicpO1xuXHRcdFx0XHRhc3NlcnRTZWxlY3Rpb24oZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEwLCAxLCAxMCwgMjkpKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMTEsIDEsIDExLCAxMSkpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKGtlYmFiQ2FzZUFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDExKSwgJ2tlYmFiLWNhc2UnKTtcblx0XHRcdFx0YXNzZXJ0U2VsZWN0aW9uKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxMSwgMSwgMTEsIDExKSk7XG5cdFx0XHR9XG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihcblx0XHRcdFtcblx0XHRcdFx0J2hlbGxvIHdvcmxkJyxcblx0XHRcdFx0J1x1MDBGNlx1MDBFN1x1MDE1Rlx1MDExRlx1MDBGQycsXG5cdFx0XHRcdCdwYXJzZUhUTUxTdHJpbmcnLFxuXHRcdFx0XHQnZ2V0RWxlbWVudEJ5SWQnLFxuXHRcdFx0XHQnUGFzY2FsQ2FzZScsXG5cdFx0XHRcdCdcdTAwRjZcdTAwRTdcdTAxNUZcdTAwRDZcdTAwQzdcdTAxNUVcdTAxMUZcdTAwRkNcdTAxMUVcdTAwREMnLFxuXHRcdFx0XHQnYXVkaW9Db252ZXJ0ZXIuY29udmVydE00QVRvTVAzKCk7Jyxcblx0XHRcdFx0J0NhcGl0YWxfU25ha2VfQ2FzZScsXG5cdFx0XHRcdCdwYXJzZUhUTUw0U3RyaW5nJyxcblx0XHRcdFx0J0tlYmFiLUNhc2UnLFxuXHRcdFx0XSwge30sIChlZGl0b3IpID0+IHtcblx0XHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKSE7XG5cdFx0XHRcdGNvbnN0IHBhc2NhbENhc2VBY3Rpb24gPSBuZXcgUGFzY2FsQ2FzZUFjdGlvbigpO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxMikpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKHBhc2NhbENhc2VBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ0hlbGxvV29ybGQnKTtcblx0XHRcdFx0YXNzZXJ0U2VsZWN0aW9uKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxMSkpO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigyLCAxLCAyLCA2KSk7XG5cdFx0XHRcdGV4ZWN1dGVBY3Rpb24ocGFzY2FsQ2FzZUFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnXHUwMEQ2XHUwMEU3XHUwMTVGXHUwMTFGXHUwMEZDJyk7XG5cdFx0XHRcdGFzc2VydFNlbGVjdGlvbihlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMiwgMSwgMiwgNikpO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigzLCAxLCAzLCAxNikpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKHBhc2NhbENhc2VBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgzKSwgJ1BhcnNlSFRNTFN0cmluZycpO1xuXHRcdFx0XHRhc3NlcnRTZWxlY3Rpb24oZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDMsIDEsIDMsIDE2KSk7XG5cblx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDQsIDEsIDQsIDE1KSk7XG5cdFx0XHRcdGV4ZWN1dGVBY3Rpb24ocGFzY2FsQ2FzZUFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDQpLCAnR2V0RWxlbWVudEJ5SWQnKTtcblx0XHRcdFx0YXNzZXJ0U2VsZWN0aW9uKGVkaXRvciwgbmV3IFNlbGVjdGlvbig0LCAxLCA0LCAxNSkpO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbig1LCAxLCA1LCAxMSkpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKHBhc2NhbENhc2VBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg1KSwgJ1Bhc2NhbENhc2UnKTtcblx0XHRcdFx0YXNzZXJ0U2VsZWN0aW9uKGVkaXRvciwgbmV3IFNlbGVjdGlvbig1LCAxLCA1LCAxMSkpO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbig2LCAxLCA2LCAxMSkpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKHBhc2NhbENhc2VBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg2KSwgJ1x1MDBENlx1MDBFN1x1MDE1Rlx1MDBENlx1MDBDN1x1MDE1RVx1MDExRlx1MDBGQ1x1MDExRVx1MDBEQycpO1xuXHRcdFx0XHRhc3NlcnRTZWxlY3Rpb24oZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDYsIDEsIDYsIDExKSk7XG5cblx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDcsIDEsIDcsIDM0KSk7XG5cdFx0XHRcdGV4ZWN1dGVBY3Rpb24ocGFzY2FsQ2FzZUFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDcpLCAnQXVkaW9Db252ZXJ0ZXIuQ29udmVydE00QVRvTVAzKCk7Jyk7XG5cdFx0XHRcdGFzc2VydFNlbGVjdGlvbihlZGl0b3IsIG5ldyBTZWxlY3Rpb24oNywgMSwgNywgMzQpKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oOCwgMSwgOCwgMTkpKTtcblx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihwYXNjYWxDYXNlQWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoOCksICdDYXBpdGFsU25ha2VDYXNlJyk7XG5cdFx0XHRcdGFzc2VydFNlbGVjdGlvbihlZGl0b3IsIG5ldyBTZWxlY3Rpb24oOCwgMSwgOCwgMTcpKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oOSwgMSwgOSwgMTcpKTtcblx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihwYXNjYWxDYXNlQWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoOSksICdQYXJzZUhUTUw0U3RyaW5nJyk7XG5cdFx0XHRcdGFzc2VydFNlbGVjdGlvbihlZGl0b3IsIG5ldyBTZWxlY3Rpb24oOSwgMSwgOSwgMTcpKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMTAsIDEsIDEwLCAxMSkpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKHBhc2NhbENhc2VBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxMCksICdLZWJhYkNhc2UnKTtcblx0XHRcdFx0YXNzZXJ0U2VsZWN0aW9uKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxMCwgMSwgMTAsIDEwKSk7XG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0c3VpdGUoJ0RlbGV0ZUFsbFJpZ2h0QWN0aW9uJywgKCkgPT4ge1xuXHRcdHRlc3QoJ3Nob3VsZCBiZSBub29wIG9uIGVtcHR5JywgKCkgPT4ge1xuXHRcdFx0d2l0aFRlc3RDb2RlRWRpdG9yKFsnJ10sIHt9LCAoZWRpdG9yKSA9PiB7XG5cdFx0XHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCkhO1xuXHRcdFx0XHRjb25zdCBhY3Rpb24gPSBuZXcgRGVsZXRlQWxsUmlnaHRBY3Rpb24oKTtcblxuXHRcdFx0XHRleGVjdXRlQWN0aW9uKGFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lc0NvbnRlbnQoKSwgWycnXSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSwgW25ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSldKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSkpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKGFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lc0NvbnRlbnQoKSwgWycnXSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSwgW25ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSldKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9ucyhbbmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSwgbmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSwgbmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKV0pO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKGFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lc0NvbnRlbnQoKSwgWycnXSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSwgW25ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSldKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIGRlbGV0ZSBzZWxlY3RlZCByYW5nZScsICgpID0+IHtcblx0XHRcdHdpdGhUZXN0Q29kZUVkaXRvcihbXG5cdFx0XHRcdCdoZWxsbycsXG5cdFx0XHRcdCd3b3JsZCdcblx0XHRcdF0sIHt9LCAoZWRpdG9yKSA9PiB7XG5cdFx0XHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCkhO1xuXHRcdFx0XHRjb25zdCBhY3Rpb24gPSBuZXcgRGVsZXRlQWxsUmlnaHRBY3Rpb24oKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgMiwgMSwgNSkpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKGFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lc0NvbnRlbnQoKSwgWydobycsICd3b3JsZCddKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9ucygpLCBbbmV3IFNlbGVjdGlvbigxLCAyLCAxLCAyKV0pO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCAxLCAyLCA0KSk7XG5cdFx0XHRcdGV4ZWN1dGVBY3Rpb24oYWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVzQ29udGVudCgpLCBbJ2xkJ10pO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCksIFtuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpXSk7XG5cblx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDMpKTtcblx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihhY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZXNDb250ZW50KCksIFsnJ10pO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCksIFtuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpXSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCBkZWxldGUgdG8gdGhlIHJpZ2h0IG9mIHRoZSBjdXJzb3InLCAoKSA9PiB7XG5cdFx0XHR3aXRoVGVzdENvZGVFZGl0b3IoW1xuXHRcdFx0XHQnaGVsbG8nLFxuXHRcdFx0XHQnd29ybGQnXG5cdFx0XHRdLCB7fSwgKGVkaXRvcikgPT4ge1xuXHRcdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpITtcblx0XHRcdFx0Y29uc3QgYWN0aW9uID0gbmV3IERlbGV0ZUFsbFJpZ2h0QWN0aW9uKCk7XG5cblx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDEsIDMsIDEsIDMpKTtcblx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihhY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZXNDb250ZW50KCksIFsnaGUnLCAnd29ybGQnXSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSwgW25ldyBTZWxlY3Rpb24oMSwgMywgMSwgMyldKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMiwgMSwgMiwgMSkpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKGFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lc0NvbnRlbnQoKSwgWydoZScsICcnXSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSwgW25ldyBTZWxlY3Rpb24oMiwgMSwgMiwgMSldKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIGpvaW4gdHdvIGxpbmVzLCBpZiBhdCB0aGUgZW5kIG9mIHRoZSBsaW5lJywgKCkgPT4ge1xuXHRcdFx0d2l0aFRlc3RDb2RlRWRpdG9yKFtcblx0XHRcdFx0J2hlbGxvJyxcblx0XHRcdFx0J3dvcmxkJ1xuXHRcdFx0XSwge30sIChlZGl0b3IpID0+IHtcblx0XHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKSE7XG5cdFx0XHRcdGNvbnN0IGFjdGlvbiA9IG5ldyBEZWxldGVBbGxSaWdodEFjdGlvbigpO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCA2LCAxLCA2KSk7XG5cdFx0XHRcdGV4ZWN1dGVBY3Rpb24oYWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVzQ29udGVudCgpLCBbJ2hlbGxvd29ybGQnXSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSwgW25ldyBTZWxlY3Rpb24oMSwgNiwgMSwgNildKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgNiwgMSwgNikpO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKGFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lc0NvbnRlbnQoKSwgWydoZWxsbyddKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9ucygpLCBbbmV3IFNlbGVjdGlvbigxLCA2LCAxLCA2KV0pO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCA2LCAxLCA2KSk7XG5cdFx0XHRcdGV4ZWN1dGVBY3Rpb24oYWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVzQ29udGVudCgpLCBbJ2hlbGxvJ10pO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCksIFtuZXcgU2VsZWN0aW9uKDEsIDYsIDEsIDYpXSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCB3b3JrIHdpdGggbXVsdGlwbGUgY3Vyc29ycycsICgpID0+IHtcblx0XHRcdHdpdGhUZXN0Q29kZUVkaXRvcihbXG5cdFx0XHRcdCdoZWxsbycsXG5cdFx0XHRcdCd0aGVyZScsXG5cdFx0XHRcdCd3b3JsZCdcblx0XHRcdF0sIHt9LCAoZWRpdG9yKSA9PiB7XG5cdFx0XHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCkhO1xuXHRcdFx0XHRjb25zdCBhY3Rpb24gPSBuZXcgRGVsZXRlQWxsUmlnaHRBY3Rpb24oKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9ucyhbXG5cdFx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAzLCAxLCAzKSxcblx0XHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDYsIDEsIDYpLFxuXHRcdFx0XHRcdG5ldyBTZWxlY3Rpb24oMywgNCwgMywgNCksXG5cdFx0XHRcdF0pO1xuXHRcdFx0XHRleGVjdXRlQWN0aW9uKGFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lc0NvbnRlbnQoKSwgWydoZXRoZXJlJywgJ3dvciddKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9ucygpLCBbXG5cdFx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAzLCAxLCAzKSxcblx0XHRcdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDQsIDIsIDQpXG5cdFx0XHRcdF0pO1xuXG5cdFx0XHRcdGV4ZWN1dGVBY3Rpb24oYWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVzQ29udGVudCgpLCBbJ2hlJywgJ3dvciddKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9ucygpLCBbXG5cdFx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAzLCAxLCAzKSxcblx0XHRcdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDQsIDIsIDQpXG5cdFx0XHRcdF0pO1xuXG5cdFx0XHRcdGV4ZWN1dGVBY3Rpb24oYWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVzQ29udGVudCgpLCBbJ2hld29yJ10pO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCksIFtcblx0XHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDMsIDEsIDMpLFxuXHRcdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNiwgMSwgNilcblx0XHRcdFx0XSk7XG5cblx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihhY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZXNDb250ZW50KCksIFsnaGUnXSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSwgW1xuXHRcdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMywgMSwgMylcblx0XHRcdFx0XSk7XG5cblx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihhY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZXNDb250ZW50KCksIFsnaGUnXSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSwgW1xuXHRcdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMywgMSwgMylcblx0XHRcdFx0XSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCB3b3JrIHdpdGggdW5kby9yZWRvJywgKCkgPT4ge1xuXHRcdFx0d2l0aFRlc3RDb2RlRWRpdG9yKFtcblx0XHRcdFx0J2hlbGxvJyxcblx0XHRcdFx0J3RoZXJlJyxcblx0XHRcdFx0J3dvcmxkJ1xuXHRcdFx0XSwge30sIChlZGl0b3IpID0+IHtcblx0XHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKSE7XG5cdFx0XHRcdGNvbnN0IGFjdGlvbiA9IG5ldyBEZWxldGVBbGxSaWdodEFjdGlvbigpO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtcblx0XHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDMsIDEsIDMpLFxuXHRcdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNiwgMSwgNiksXG5cdFx0XHRcdFx0bmV3IFNlbGVjdGlvbigzLCA0LCAzLCA0KSxcblx0XHRcdFx0XSk7XG5cdFx0XHRcdGV4ZWN1dGVBY3Rpb24oYWN0aW9uLCBlZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVzQ29udGVudCgpLCBbJ2hldGhlcmUnLCAnd29yJ10pO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCksIFtcblx0XHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDMsIDEsIDMpLFxuXHRcdFx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgNCwgMiwgNClcblx0XHRcdFx0XSk7XG5cblx0XHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5VbmRvLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9ucygpLCBbXG5cdFx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAzLCAxLCAzKSxcblx0XHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDYsIDEsIDYpLFxuXHRcdFx0XHRcdG5ldyBTZWxlY3Rpb24oMywgNCwgMywgNClcblx0XHRcdFx0XSk7XG5cdFx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuUmVkby5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSwgW1xuXHRcdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMywgMSwgMyksXG5cdFx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCA0LCAyLCA0KVxuXHRcdFx0XHRdKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdJbnNlcnRMaW5lQmVmb3JlQWN0aW9uJywgKCkgPT4ge1xuXHRcdGZ1bmN0aW9uIHRlc3RJbnNlcnRMaW5lQmVmb3JlKGxpbmVOdW1iZXI6IG51bWJlciwgY29sdW1uOiBudW1iZXIsIGNhbGxiYWNrOiAobW9kZWw6IElUZXh0TW9kZWwsIHZpZXdNb2RlbDogVmlld01vZGVsKSA9PiB2b2lkKTogdm9pZCB7XG5cdFx0XHRjb25zdCBURVhUID0gW1xuXHRcdFx0XHQnRmlyc3QgbGluZScsXG5cdFx0XHRcdCdTZWNvbmQgbGluZScsXG5cdFx0XHRcdCdUaGlyZCBsaW5lJ1xuXHRcdFx0XTtcblx0XHRcdHdpdGhUZXN0Q29kZUVkaXRvcihURVhULCB7fSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRcdGVkaXRvci5zZXRQb3NpdGlvbihuZXcgUG9zaXRpb24obGluZU51bWJlciwgY29sdW1uKSk7XG5cdFx0XHRcdGNvbnN0IGluc2VydExpbmVCZWZvcmVBY3Rpb24gPSBuZXcgSW5zZXJ0TGluZUJlZm9yZUFjdGlvbigpO1xuXG5cdFx0XHRcdGV4ZWN1dGVBY3Rpb24oaW5zZXJ0TGluZUJlZm9yZUFjdGlvbiwgZWRpdG9yKTtcblx0XHRcdFx0Y2FsbGJhY2soZWRpdG9yLmdldE1vZGVsKCkhLCB2aWV3TW9kZWwpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0dGVzdEluc2VydExpbmVCZWZvcmUoMSwgMywgKG1vZGVsLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlld01vZGVsLmdldFNlbGVjdGlvbigpLCBuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJycpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnRmlyc3QgbGluZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDMpLCAnU2Vjb25kIGxpbmUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg0KSwgJ1RoaXJkIGxpbmUnKTtcblx0XHR9KTtcblxuXHRcdHRlc3RJbnNlcnRMaW5lQmVmb3JlKDIsIDMsIChtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXdNb2RlbC5nZXRTZWxlY3Rpb24oKSwgbmV3IFNlbGVjdGlvbigyLCAxLCAyLCAxKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICdGaXJzdCBsaW5lJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICcnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgzKSwgJ1NlY29uZCBsaW5lJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoNCksICdUaGlyZCBsaW5lJyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0SW5zZXJ0TGluZUJlZm9yZSgzLCAzLCAobW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0U2VsZWN0aW9uKCksIG5ldyBTZWxlY3Rpb24oMywgMSwgMywgMSkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnRmlyc3QgbGluZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnU2Vjb25kIGxpbmUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgzKSwgJycpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDQpLCAnVGhpcmQgbGluZScpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdJbnNlcnRMaW5lQWZ0ZXJBY3Rpb24nLCAoKSA9PiB7XG5cdFx0ZnVuY3Rpb24gdGVzdEluc2VydExpbmVBZnRlcihsaW5lTnVtYmVyOiBudW1iZXIsIGNvbHVtbjogbnVtYmVyLCBjYWxsYmFjazogKG1vZGVsOiBJVGV4dE1vZGVsLCB2aWV3TW9kZWw6IFZpZXdNb2RlbCkgPT4gdm9pZCk6IHZvaWQge1xuXHRcdFx0Y29uc3QgVEVYVCA9IFtcblx0XHRcdFx0J0ZpcnN0IGxpbmUnLFxuXHRcdFx0XHQnU2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQnVGhpcmQgbGluZSdcblx0XHRcdF07XG5cdFx0XHR3aXRoVGVzdENvZGVFZGl0b3IoVEVYVCwge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24obmV3IFBvc2l0aW9uKGxpbmVOdW1iZXIsIGNvbHVtbikpO1xuXHRcdFx0XHRjb25zdCBpbnNlcnRMaW5lQWZ0ZXJBY3Rpb24gPSBuZXcgSW5zZXJ0TGluZUFmdGVyQWN0aW9uKCk7XG5cblx0XHRcdFx0ZXhlY3V0ZUFjdGlvbihpbnNlcnRMaW5lQWZ0ZXJBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRcdGNhbGxiYWNrKGVkaXRvci5nZXRNb2RlbCgpISwgdmlld01vZGVsKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHRlc3RJbnNlcnRMaW5lQWZ0ZXIoMSwgMywgKG1vZGVsLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlld01vZGVsLmdldFNlbGVjdGlvbigpLCBuZXcgU2VsZWN0aW9uKDIsIDEsIDIsIDEpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ0ZpcnN0IGxpbmUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgyKSwgJycpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDMpLCAnU2Vjb25kIGxpbmUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg0KSwgJ1RoaXJkIGxpbmUnKTtcblx0XHR9KTtcblxuXHRcdHRlc3RJbnNlcnRMaW5lQWZ0ZXIoMiwgMywgKG1vZGVsLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlld01vZGVsLmdldFNlbGVjdGlvbigpLCBuZXcgU2VsZWN0aW9uKDMsIDEsIDMsIDEpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ0ZpcnN0IGxpbmUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgyKSwgJ1NlY29uZCBsaW5lJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMyksICcnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg0KSwgJ1RoaXJkIGxpbmUnKTtcblx0XHR9KTtcblxuXHRcdHRlc3RJbnNlcnRMaW5lQWZ0ZXIoMywgMywgKG1vZGVsLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlld01vZGVsLmdldFNlbGVjdGlvbigpLCBuZXcgU2VsZWN0aW9uKDQsIDEsIDQsIDEpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ0ZpcnN0IGxpbmUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgyKSwgJ1NlY29uZCBsaW5lJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMyksICdUaGlyZCBsaW5lJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoNCksICcnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnQnVnIDE4Mjc2OltlZGl0b3JdIEluZGVudGF0aW9uIGJyb2tlbiB3aGVuIHNlbGVjdGlvbiBpcyBlbXB0eScsICgpID0+IHtcblxuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFxuXHRcdFx0W1xuXHRcdFx0XHQnZnVuY3Rpb24gYmF6KCkgeydcblx0XHRcdF0uam9pbignXFxuJyksXG5cdFx0XHR1bmRlZmluZWQsXG5cdFx0XHR7XG5cdFx0XHRcdGluc2VydFNwYWNlczogZmFsc2UsXG5cdFx0XHR9XG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwge30sIChlZGl0b3IpID0+IHtcblx0XHRcdGNvbnN0IGluZGVudExpbmVzQWN0aW9uID0gbmV3IEluZGVudExpbmVzQWN0aW9uKCk7XG5cdFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDIpKTtcblxuXHRcdFx0ZXhlY3V0ZUFjdGlvbihpbmRlbnRMaW5lc0FjdGlvbiwgZWRpdG9yKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ1xcdGZ1bmN0aW9uIGJheigpIHsnKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbigpLCBuZXcgU2VsZWN0aW9uKDEsIDMsIDEsIDMpKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5UYWIucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnXFx0ZlxcdHVuY3Rpb24gYmF6KCkgeycpO1xuXHRcdH0pO1xuXG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjODA3MzY6IEluZGVudGluZyB3aGlsZSB0aGUgY3Vyc29yIGlzIGF0IHRoZSBzdGFydCBvZiBhIGxpbmUgb2YgdGV4dCBjYXVzZXMgdGhlIGFkZGVkIHNwYWNlcyBvciB0YWIgdG8gYmUgc2VsZWN0ZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRbXG5cdFx0XHRcdCdTb21lIHRleHQnXG5cdFx0XHRdLmpvaW4oJ1xcbicpLFxuXHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0e1xuXHRcdFx0XHRpbnNlcnRTcGFjZXM6IGZhbHNlLFxuXHRcdFx0fVxuXHRcdCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHt9LCAoZWRpdG9yKSA9PiB7XG5cdFx0XHRjb25zdCBpbmRlbnRMaW5lc0FjdGlvbiA9IG5ldyBJbmRlbnRMaW5lc0FjdGlvbigpO1xuXHRcdFx0ZWRpdG9yLnNldFBvc2l0aW9uKG5ldyBQb3NpdGlvbigxLCAxKSk7XG5cblx0XHRcdGV4ZWN1dGVBY3Rpb24oaW5kZW50TGluZXNBY3Rpb24sIGVkaXRvcik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICdcXHRTb21lIHRleHQnKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbigpLCBuZXcgU2VsZWN0aW9uKDEsIDIsIDEsIDIpKTtcblx0XHR9KTtcblxuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnSW5kZW50aW5nIG9uIGVtcHR5IGxpbmUgc2hvdWxkIG1vdmUgY3Vyc29yJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFxuXHRcdFx0W1xuXHRcdFx0XHQnJ1xuXHRcdFx0XS5qb2luKCdcXG4nKVxuXHRcdCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHsgdXNlVGFiU3RvcHM6IGZhbHNlIH0sIChlZGl0b3IpID0+IHtcblx0XHRcdGNvbnN0IGluZGVudExpbmVzQWN0aW9uID0gbmV3IEluZGVudExpbmVzQWN0aW9uKCk7XG5cdFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDEpKTtcblxuXHRcdFx0ZXhlY3V0ZUFjdGlvbihpbmRlbnRMaW5lc0FjdGlvbiwgZWRpdG9yKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJyAgICAnKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbigpLCBuZXcgU2VsZWN0aW9uKDEsIDUsIDEsIDUpKTtcblx0XHR9KTtcblxuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzYyMTEyOiBEZWxldGUgbGluZSBkb2VzIG5vdCB3b3JrIHByb3Blcmx5IHdoZW4gbXVsdGlwbGUgY3Vyc29ycyBhcmUgb24gbGluZScsICgpID0+IHtcblx0XHRjb25zdCBURVhUID0gW1xuXHRcdFx0J2EnLFxuXHRcdFx0J2ZvbyBib28nLFxuXHRcdFx0J3RvbycsXG5cdFx0XHQnYycsXG5cdFx0XTtcblx0XHR3aXRoVGVzdENvZGVFZGl0b3IoVEVYVCwge30sIChlZGl0b3IpID0+IHtcblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCA0LCAyLCA0KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCA4LCAyLCA4KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigzLCA0LCAzLCA0KSxcblx0XHRcdF0pO1xuXHRcdFx0Y29uc3QgZGVsZXRlTGluZXNBY3Rpb24gPSBuZXcgRGVsZXRlTGluZXNBY3Rpb24oKTtcblx0XHRcdGV4ZWN1dGVBY3Rpb24oZGVsZXRlTGluZXNBY3Rpb24sIGVkaXRvcik7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0VmFsdWUoKSwgJ2FcXG5jJyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIHRlc3REZWxldGVMaW5lc0NvbW1hbmQoaW5pdGlhbFRleHQ6IHN0cmluZ1tdLCBfaW5pdGlhbFNlbGVjdGlvbnM6IFNlbGVjdGlvbiB8IFNlbGVjdGlvbltdLCByZXN1bHRpbmdUZXh0OiBzdHJpbmdbXSwgX3Jlc3VsdGluZ1NlbGVjdGlvbnM6IFNlbGVjdGlvbiB8IFNlbGVjdGlvbltdKTogdm9pZCB7XG5cdFx0Y29uc3QgaW5pdGlhbFNlbGVjdGlvbnMgPSBBcnJheS5pc0FycmF5KF9pbml0aWFsU2VsZWN0aW9ucykgPyBfaW5pdGlhbFNlbGVjdGlvbnMgOiBbX2luaXRpYWxTZWxlY3Rpb25zXTtcblx0XHRjb25zdCByZXN1bHRpbmdTZWxlY3Rpb25zID0gQXJyYXkuaXNBcnJheShfcmVzdWx0aW5nU2VsZWN0aW9ucykgPyBfcmVzdWx0aW5nU2VsZWN0aW9ucyA6IFtfcmVzdWx0aW5nU2VsZWN0aW9uc107XG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKGluaXRpYWxUZXh0LCB7fSwgKGVkaXRvcikgPT4ge1xuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoaW5pdGlhbFNlbGVjdGlvbnMpO1xuXHRcdFx0Y29uc3QgZGVsZXRlTGluZXNBY3Rpb24gPSBuZXcgRGVsZXRlTGluZXNBY3Rpb24oKTtcblx0XHRcdGV4ZWN1dGVBY3Rpb24oZGVsZXRlTGluZXNBY3Rpb24sIGVkaXRvcik7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0VmFsdWUoKSwgcmVzdWx0aW5nVGV4dC5qb2luKCdcXG4nKSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCksIHJlc3VsdGluZ1NlbGVjdGlvbnMpO1xuXHRcdH0pO1xuXHR9XG5cblx0dGVzdCgnZW1wdHkgc2VsZWN0aW9uIGluIG1pZGRsZSBvZiBsaW5lcycsIGZ1bmN0aW9uICgpIHtcblx0XHR0ZXN0RGVsZXRlTGluZXNDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnc2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDMsIDIsIDMpLFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDMsIDIsIDMpXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnZW1wdHkgc2VsZWN0aW9uIGF0IHRvcCBvZiBsaW5lcycsIGZ1bmN0aW9uICgpIHtcblx0XHR0ZXN0RGVsZXRlTGluZXNDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnc2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDUsIDEsIDUpLFxuXHRcdFx0W1xuXHRcdFx0XHQnc2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDUsIDEsIDUpXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnZW1wdHkgc2VsZWN0aW9uIGF0IGVuZCBvZiBsaW5lcycsIGZ1bmN0aW9uICgpIHtcblx0XHR0ZXN0RGVsZXRlTGluZXNDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnc2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDUsIDIsIDUsIDIpLFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnc2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZSdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDQsIDIsIDQsIDIpXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnd2l0aCBzZWxlY3Rpb24gaW4gbWlkZGxlIG9mIGxpbmVzJywgZnVuY3Rpb24gKCkge1xuXHRcdHRlc3REZWxldGVMaW5lc0NvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMywgMywgMiwgMiksXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDIsIDIsIDIpXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnd2l0aCBzZWxlY3Rpb24gYXQgdG9wIG9mIGxpbmVzJywgZnVuY3Rpb24gKCkge1xuXHRcdHRlc3REZWxldGVMaW5lc0NvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNSksXG5cdFx0XHRbXG5cdFx0XHRcdCdzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNSwgMSwgNSlcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCd3aXRoIHNlbGVjdGlvbiBhdCBlbmQgb2YgbGluZXMnLCBmdW5jdGlvbiAoKSB7XG5cdFx0dGVzdERlbGV0ZUxpbmVzQ29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J3NlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbig1LCAxLCA1LCAyKSxcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J3NlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbig0LCAyLCA0LCAyKVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3dpdGggZnVsbCBsaW5lIHNlbGVjdGlvbiBpbiBtaWRkbGUgb2YgbGluZXMnLCBmdW5jdGlvbiAoKSB7XG5cdFx0dGVzdERlbGV0ZUxpbmVzQ29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J3NlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbig0LCAxLCAyLCAxKSxcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgMSwgMiwgMSlcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCd3aXRoIGZ1bGwgbGluZSBzZWxlY3Rpb24gYXQgdG9wIG9mIGxpbmVzJywgZnVuY3Rpb24gKCkge1xuXHRcdHRlc3REZWxldGVMaW5lc0NvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgMSwgMSwgNSksXG5cdFx0XHRbXG5cdFx0XHRcdCdzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNSwgMSwgNSlcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCd3aXRoIGZ1bGwgbGluZSBzZWxlY3Rpb24gYXQgZW5kIG9mIGxpbmVzJywgZnVuY3Rpb24gKCkge1xuXHRcdHRlc3REZWxldGVMaW5lc0NvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oNCwgMSwgNSwgMiksXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMywgMiwgMywgMilcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdtdWx0aWN1cnNvciAxJywgZnVuY3Rpb24gKCkge1xuXHRcdHRlc3REZWxldGVMaW5lc0NvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdjbGFzcyBQIHsnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JyAgICBnZXRBKCkgeycsXG5cdFx0XHRcdCcgICAgICAgIGlmICh0cnVlKSB7Jyxcblx0XHRcdFx0JyAgICAgICAgICAgIHJldHVybiBcImFcIjsnLFxuXHRcdFx0XHQnICAgICAgICB9Jyxcblx0XHRcdFx0JyAgICB9Jyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcgICAgZ2V0QigpIHsnLFxuXHRcdFx0XHQnICAgICAgICBpZiAodHJ1ZSkgeycsXG5cdFx0XHRcdCcgICAgICAgICAgICByZXR1cm4gXCJiXCI7Jyxcblx0XHRcdFx0JyAgICAgICAgfScsXG5cdFx0XHRcdCcgICAgfScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnICAgIGdldEMoKSB7Jyxcblx0XHRcdFx0JyAgICAgICAgaWYgKHRydWUpIHsnLFxuXHRcdFx0XHQnICAgICAgICAgICAgcmV0dXJuIFwiY1wiOycsXG5cdFx0XHRcdCcgICAgICAgIH0nLFxuXHRcdFx0XHQnICAgIH0nLFxuXHRcdFx0XHQnfScsXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDQsIDEsIDUsIDEpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEwLCAxLCAxMSwgMSksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMTYsIDEsIDE3LCAxKSxcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdCdjbGFzcyBQIHsnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JyAgICBnZXRBKCkgeycsXG5cdFx0XHRcdCcgICAgICAgICAgICByZXR1cm4gXCJhXCI7Jyxcblx0XHRcdFx0JyAgICAgICAgfScsXG5cdFx0XHRcdCcgICAgfScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnICAgIGdldEIoKSB7Jyxcblx0XHRcdFx0JyAgICAgICAgICAgIHJldHVybiBcImJcIjsnLFxuXHRcdFx0XHQnICAgICAgICB9Jyxcblx0XHRcdFx0JyAgICB9Jyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcgICAgZ2V0QygpIHsnLFxuXHRcdFx0XHQnICAgICAgICAgICAgcmV0dXJuIFwiY1wiOycsXG5cdFx0XHRcdCcgICAgICAgIH0nLFxuXHRcdFx0XHQnICAgIH0nLFxuXHRcdFx0XHQnfScsXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDQsIDEsIDQsIDEpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDksIDEsIDksIDEpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDE0LCAxLCAxNCwgMSksXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUlBLE9BQU8sWUFBWTtBQUNuQixTQUFTLCtDQUErQztBQUN4RCxTQUFTLDJCQUEyQjtBQUdwQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGVBQWU7QUFHeEIsU0FBUyxpQkFBaUIsa0JBQWtCLHFCQUFxQixzQkFBc0IsNEJBQTRCLG1CQUFtQixtQkFBbUIsdUJBQXVCLHdCQUF3QixpQkFBaUIsaUJBQWlCLGlCQUFpQixpQkFBaUIsMEJBQTBCLDJCQUEyQixpQkFBaUIsaUJBQWlCLHVCQUF1QjtBQUMxWCxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHVCQUF1QjtBQUVoQyxTQUFTLGdCQUFnQixRQUFxQixVQUF5QztBQUN0RixNQUFJLENBQUMsTUFBTSxRQUFRLFFBQVEsR0FBRztBQUM3QixlQUFXLENBQUMsUUFBUTtBQUFBLEVBQ3JCO0FBQ0EsU0FBTyxnQkFBZ0IsT0FBTyxjQUFjLEdB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
