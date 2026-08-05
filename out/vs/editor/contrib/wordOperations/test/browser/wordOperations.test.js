import assert from "assert";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { isFirefox } from "../../../../../base/common/platform.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { CoreEditingCommands } from "../../../../browser/coreCommands.js";
import { Position } from "../../../../common/core/position.js";
import { Selection } from "../../../../common/core/selection.js";
import { ILanguageService } from "../../../../common/languages/language.js";
import { ILanguageConfigurationService } from "../../../../common/languages/languageConfigurationRegistry.js";
import { CursorWordAccessibilityLeft, CursorWordAccessibilityLeftSelect, CursorWordAccessibilityRight, CursorWordAccessibilityRightSelect, CursorWordEndLeft, CursorWordEndLeftSelect, CursorWordEndRight, CursorWordEndRightSelect, CursorWordLeft, CursorWordLeftSelect, CursorWordRight, CursorWordRightSelect, CursorWordStartLeft, CursorWordStartLeftSelect, CursorWordStartRight, CursorWordStartRightSelect, DeleteInsideWord, DeleteWordEndLeft, DeleteWordEndRight, DeleteWordLeft, DeleteWordRight, DeleteWordStartLeft, DeleteWordStartRight } from "../../browser/wordOperations.js";
import { deserializePipePositions, serializePipePositions, testRepeatedActionAndExtractPositions } from "./wordTestUtils.js";
import { createCodeEditorServices, instantiateTestCodeEditor, withTestCodeEditor } from "../../../../test/browser/testCodeEditor.js";
import { instantiateTextModel } from "../../../../test/common/testTextModel.js";
suite("WordOperations", () => {
  const _cursorWordStartLeft = new CursorWordStartLeft();
  const _cursorWordEndLeft = new CursorWordEndLeft();
  const _cursorWordLeft = new CursorWordLeft();
  const _cursorWordStartLeftSelect = new CursorWordStartLeftSelect();
  const _cursorWordEndLeftSelect = new CursorWordEndLeftSelect();
  const _cursorWordLeftSelect = new CursorWordLeftSelect();
  const _cursorWordStartRight = new CursorWordStartRight();
  const _cursorWordEndRight = new CursorWordEndRight();
  const _cursorWordRight = new CursorWordRight();
  const _cursorWordStartRightSelect = new CursorWordStartRightSelect();
  const _cursorWordEndRightSelect = new CursorWordEndRightSelect();
  const _cursorWordRightSelect = new CursorWordRightSelect();
  const _cursorWordAccessibilityLeft = new CursorWordAccessibilityLeft();
  const _cursorWordAccessibilityLeftSelect = new CursorWordAccessibilityLeftSelect();
  const _cursorWordAccessibilityRight = new CursorWordAccessibilityRight();
  const _cursorWordAccessibilityRightSelect = new CursorWordAccessibilityRightSelect();
  const _deleteWordLeft = new DeleteWordLeft();
  const _deleteWordStartLeft = new DeleteWordStartLeft();
  const _deleteWordEndLeft = new DeleteWordEndLeft();
  const _deleteWordRight = new DeleteWordRight();
  const _deleteWordStartRight = new DeleteWordStartRight();
  const _deleteWordEndRight = new DeleteWordEndRight();
  const _deleteInsideWord = new DeleteInsideWord();
  let disposables;
  let instantiationService;
  let languageConfigurationService;
  let languageService;
  setup(() => {
    disposables = new DisposableStore();
    instantiationService = createCodeEditorServices(disposables);
    languageConfigurationService = instantiationService.get(ILanguageConfigurationService);
    languageService = instantiationService.get(ILanguageService);
  });
  teardown(() => {
    disposables.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  function runEditorCommand(editor, command) {
    instantiationService.invokeFunction((accessor) => {
      command.runEditorCommand(accessor, editor, null);
    });
  }
  function cursorWordLeft(editor, inSelectionMode = false) {
    runEditorCommand(editor, inSelectionMode ? _cursorWordLeftSelect : _cursorWordLeft);
  }
  function cursorWordAccessibilityLeft(editor, inSelectionMode = false) {
    runEditorCommand(editor, inSelectionMode ? _cursorWordAccessibilityLeft : _cursorWordAccessibilityLeftSelect);
  }
  function cursorWordAccessibilityRight(editor, inSelectionMode = false) {
    runEditorCommand(editor, inSelectionMode ? _cursorWordAccessibilityRightSelect : _cursorWordAccessibilityRight);
  }
  function cursorWordStartLeft(editor, inSelectionMode = false) {
    runEditorCommand(editor, inSelectionMode ? _cursorWordStartLeftSelect : _cursorWordStartLeft);
  }
  function cursorWordEndLeft(editor, inSelectionMode = false) {
    runEditorCommand(editor, inSelectionMode ? _cursorWordEndLeftSelect : _cursorWordEndLeft);
  }
  function cursorWordRight(editor, inSelectionMode = false) {
    runEditorCommand(editor, inSelectionMode ? _cursorWordRightSelect : _cursorWordRight);
  }
  function moveWordEndRight(editor, inSelectionMode = false) {
    runEditorCommand(editor, inSelectionMode ? _cursorWordEndRightSelect : _cursorWordEndRight);
  }
  function moveWordStartRight(editor, inSelectionMode = false) {
    runEditorCommand(editor, inSelectionMode ? _cursorWordStartRightSelect : _cursorWordStartRight);
  }
  function deleteWordLeft(editor) {
    runEditorCommand(editor, _deleteWordLeft);
  }
  function deleteWordStartLeft(editor) {
    runEditorCommand(editor, _deleteWordStartLeft);
  }
  function deleteWordEndLeft(editor) {
    runEditorCommand(editor, _deleteWordEndLeft);
  }
  function deleteWordRight(editor) {
    runEditorCommand(editor, _deleteWordRight);
  }
  function deleteWordStartRight(editor) {
    runEditorCommand(editor, _deleteWordStartRight);
  }
  function deleteWordEndRight(editor) {
    runEditorCommand(editor, _deleteWordEndRight);
  }
  function deleteInsideWord(editor) {
    _deleteInsideWord.run(null, editor, null);
  }
  test("cursorWordLeft - simple", () => {
    const EXPECTED = [
      "|    	|My |First |Line	 ",
      "|	|My |Second |Line",
      "|    |Third |Line\u{1F436}",
      "|",
      "|1"
    ].join("\n");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1e3, 1e3),
      (ed) => cursorWordLeft(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getPosition().equals(new Position(1, 1))
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("cursorWordLeft - with selection", () => {
    withTestCodeEditor([
      "    	My First Line	 ",
      "	My Second Line",
      "    Third Line\u{1F436}",
      "",
      "1"
    ], {}, (editor) => {
      editor.setPosition(new Position(5, 2));
      cursorWordLeft(editor, true);
      assert.deepStrictEqual(editor.getSelection(), new Selection(5, 2, 5, 1));
    });
  });
  test("cursorWordLeft - issue #832", () => {
    const EXPECTED = ["|   |/* |Just |some   |more   |text |a|+= |3 |+|5-|3 |+ |7 |*/  "].join("\n");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1e3, 1e3),
      (ed) => cursorWordLeft(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getPosition().equals(new Position(1, 1))
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("cursorWordLeft - issue #48046: Word selection doesn't work as usual", () => {
    const EXPECTED = [
      "|deep.|object.|property"
    ].join("\n");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1, 21),
      (ed) => cursorWordLeft(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getPosition().equals(new Position(1, 1))
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("cursorWordLeft - Recognize words", function() {
    if (isFirefox) {
      return this.skip();
    }
    const EXPECTED = [
      "|/* |\u3053\u308C|\u306F|\u30C6\u30B9\u30C8|\u3067\u3059 |/*"
    ].join("\n");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1e3, 1e3),
      (ed) => cursorWordLeft(ed, true),
      (ed) => ed.getPosition(),
      (ed) => ed.getPosition().equals(new Position(1, 1)),
      {
        wordSegmenterLocales: "ja"
      }
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("cursorWordLeft - Does not recognize words", () => {
    const EXPECTED = [
      "|/* |\u3053\u308C\u306F\u30C6\u30B9\u30C8\u3067\u3059 |/*"
    ].join("\n");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1e3, 1e3),
      (ed) => cursorWordLeft(ed, true),
      (ed) => ed.getPosition(),
      (ed) => ed.getPosition().equals(new Position(1, 1)),
      {
        wordSegmenterLocales: ""
      }
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("cursorWordLeft - issue #169904: cursors out of sync", () => {
    const text = [
      ".grid1 {",
      "  display: grid;",
      "  grid-template-columns:",
      "    [full-start] minmax(1em, 1fr)",
      "    [main-start] minmax(0, 40em) [main-end]",
      "    minmax(1em, 1fr) [full-end];",
      "}",
      ".grid2 {",
      "  display: grid;",
      "  grid-template-columns:",
      "    [full-start] minmax(1em, 1fr)",
      "    [main-start] minmax(0, 40em) [main-end] minmax(1em, 1fr) [full-end];",
      "}"
    ];
    withTestCodeEditor(text, {}, (editor) => {
      editor.setSelections([
        new Selection(5, 44, 5, 44),
        new Selection(6, 32, 6, 32),
        new Selection(12, 44, 12, 44),
        new Selection(12, 72, 12, 72)
      ]);
      cursorWordLeft(editor, false);
      assert.deepStrictEqual(editor.getSelections(), [
        new Selection(5, 43, 5, 43),
        new Selection(6, 31, 6, 31),
        new Selection(12, 43, 12, 43),
        new Selection(12, 71, 12, 71)
      ]);
    });
  });
  test("cursorWordLeftSelect - issue #74369: cursorWordLeft and cursorWordLeftSelect do not behave consistently", () => {
    const EXPECTED = [
      "|this.|is.|a.|test"
    ].join("\n");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1, 15),
      (ed) => cursorWordLeft(ed, true),
      (ed) => ed.getPosition(),
      (ed) => ed.getPosition().equals(new Position(1, 1))
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("cursorWordStartLeft", () => {
    const EXPECTED = ["|   |/* |Just |some   |more   |text |a|+= |3 |+|5|-|3 |+ |7 |*/  "].join("\n");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1e3, 1e3),
      (ed) => cursorWordStartLeft(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getPosition().equals(new Position(1, 1))
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("cursorWordStartLeft - issue #51119: regression makes VS compatibility impossible", () => {
    const EXPECTED = ["|this|.|is|.|a|.|test"].join("\n");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1e3, 1e3),
      (ed) => cursorWordStartLeft(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getPosition().equals(new Position(1, 1))
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("issue #51275 - cursorWordStartLeft does not push undo/redo stack element", () => {
    function type(viewModel, text) {
      for (let i = 0; i < text.length; i++) {
        viewModel.type(text.charAt(i), "keyboard");
      }
    }
    withTestCodeEditor("", {}, (editor, viewModel) => {
      type(viewModel, "foo bar baz");
      assert.strictEqual(editor.getValue(), "foo bar baz");
      cursorWordStartLeft(editor);
      cursorWordStartLeft(editor);
      type(viewModel, "q");
      assert.strictEqual(editor.getValue(), "foo qbar baz");
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(editor.getValue(), "foo bar baz");
    });
  });
  test("cursorWordEndLeft", () => {
    const EXPECTED = ["|   /*| Just| some|   more|   text| a|+=| 3| +|5|-|3| +| 7| */|  "].join("\n");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1e3, 1e3),
      (ed) => cursorWordEndLeft(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getPosition().equals(new Position(1, 1))
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("cursorWordRight - simple", () => {
    const EXPECTED = [
      "    	My| First| Line|	 |",
      "	My| Second| Line|",
      "    Third| Line\u{1F436}|",
      "|",
      "1|"
    ].join("\n");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1, 1),
      (ed) => cursorWordRight(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getPosition().equals(new Position(5, 2))
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("cursorWordRight - selection", () => {
    withTestCodeEditor([
      "    	My First Line	 ",
      "	My Second Line",
      "    Third Line\u{1F436}",
      "",
      "1"
    ], {}, (editor, _) => {
      editor.setPosition(new Position(1, 1));
      cursorWordRight(editor, true);
      assert.deepStrictEqual(editor.getSelection(), new Selection(1, 1, 1, 8));
    });
  });
  test("cursorWordRight - issue #832", () => {
    const EXPECTED = [
      "   /*| Just| some|   more|   text| a|+=| 3| +5|-3| +| 7| */|  |"
    ].join("\n");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1, 1),
      (ed) => cursorWordRight(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getPosition().equals(new Position(1, 50))
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("cursorWordRight - issue #41199", () => {
    const EXPECTED = [
      "console|.log|(err|)|"
    ].join("\n");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1, 1),
      (ed) => cursorWordRight(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getPosition().equals(new Position(1, 17))
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("cursorWordRight - Recognize words", function() {
    if (isFirefox) {
      return this.skip();
    }
    const EXPECTED = [
      "/*| \u3053\u308C|\u306F|\u30C6\u30B9\u30C8|\u3067\u3059|/*|"
    ].join("\n");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1, 1),
      (ed) => cursorWordRight(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getPosition().equals(new Position(1, 14)),
      {
        wordSegmenterLocales: "ja"
      }
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("cursorWordRight - Does not recognize words", () => {
    const EXPECTED = [
      "/*| \u3053\u308C\u306F\u30C6\u30B9\u30C8\u3067\u3059|/*|"
    ].join("\n");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1, 1),
      (ed) => cursorWordRight(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getPosition().equals(new Position(1, 14)),
      {
        wordSegmenterLocales: ""
      }
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("moveWordEndRight", () => {
    const EXPECTED = [
      "   /*| Just| some|   more|   text| a|+=| 3| +5|-3| +| 7| */|  |"
    ].join("\n");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1, 1),
      (ed) => moveWordEndRight(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getPosition().equals(new Position(1, 50))
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("moveWordStartRight", () => {
    const EXPECTED = [
      "   |/* |Just |some   |more   |text |a|+= |3 |+|5|-|3 |+ |7 |*/  |"
    ].join("\n");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1, 1),
      (ed) => moveWordStartRight(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getPosition().equals(new Position(1, 50))
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("issue #51119: cursorWordStartRight regression makes VS compatibility impossible", () => {
    const EXPECTED = ["this|.|is|.|a|.|test|"].join("\n");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1, 1),
      (ed) => moveWordStartRight(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getPosition().equals(new Position(1, 15))
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("issue #64810: cursorWordStartRight skips first word after newline", () => {
    const EXPECTED = ["Hello |World|", "|Hei |mailman|"].join("\n");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1, 1),
      (ed) => moveWordStartRight(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getPosition().equals(new Position(2, 12))
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("cursorWordAccessibilityLeft", () => {
    const EXPECTED = ["|   /* |Just |some   |more   |text |a+= |3 +|5-|3 + |7 */  "].join("\n");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1e3, 1e3),
      (ed) => cursorWordAccessibilityLeft(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getPosition().equals(new Position(1, 1))
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("cursorWordAccessibilityRight", () => {
    const EXPECTED = ["   /* |Just |some   |more   |text |a+= |3 +|5-|3 + |7 */  |"].join("\n");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1, 1),
      (ed) => cursorWordAccessibilityRight(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getPosition().equals(new Position(1, 50))
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("deleteWordLeft for non-empty selection", () => {
    withTestCodeEditor([
      "    	My First Line	 ",
      "	My Second Line",
      "    Third Line\u{1F436}",
      "",
      "1"
    ], {}, (editor, _) => {
      const model = editor.getModel();
      editor.setSelection(new Selection(3, 7, 3, 9));
      deleteWordLeft(editor);
      assert.strictEqual(model.getLineContent(3), "    Thd Line\u{1F436}");
      assert.deepStrictEqual(editor.getPosition(), new Position(3, 7));
    });
  });
  test("deleteWordLeft for cursor at beginning of document", () => {
    withTestCodeEditor([
      "    	My First Line	 ",
      "	My Second Line",
      "    Third Line\u{1F436}",
      "",
      "1"
    ], {}, (editor, _) => {
      const model = editor.getModel();
      editor.setPosition(new Position(1, 1));
      deleteWordLeft(editor);
      assert.strictEqual(model.getLineContent(1), "    	My First Line	 ");
      assert.deepStrictEqual(editor.getPosition(), new Position(1, 1));
    });
  });
  test("deleteWordLeft for cursor at end of whitespace", () => {
    withTestCodeEditor([
      "    	My First Line	 ",
      "	My Second Line",
      "    Third Line\u{1F436}",
      "",
      "1"
    ], {}, (editor, _) => {
      const model = editor.getModel();
      editor.setPosition(new Position(3, 11));
      deleteWordLeft(editor);
      assert.strictEqual(model.getLineContent(3), "    Line\u{1F436}");
      assert.deepStrictEqual(editor.getPosition(), new Position(3, 5));
    });
  });
  test("deleteWordLeft for cursor just behind a word", () => {
    withTestCodeEditor([
      "    	My First Line	 ",
      "	My Second Line",
      "    Third Line\u{1F436}",
      "",
      "1"
    ], {}, (editor, _) => {
      const model = editor.getModel();
      editor.setPosition(new Position(2, 11));
      deleteWordLeft(editor);
      assert.strictEqual(model.getLineContent(2), "	My  Line");
      assert.deepStrictEqual(editor.getPosition(), new Position(2, 5));
    });
  });
  test("deleteWordLeft for cursor inside of a word", () => {
    withTestCodeEditor([
      "    	My First Line	 ",
      "	My Second Line",
      "    Third Line\u{1F436}",
      "",
      "1"
    ], {}, (editor, _) => {
      const model = editor.getModel();
      editor.setPosition(new Position(1, 12));
      deleteWordLeft(editor);
      assert.strictEqual(model.getLineContent(1), "    	My st Line	 ");
      assert.deepStrictEqual(editor.getPosition(), new Position(1, 9));
    });
  });
  test("deleteWordRight for non-empty selection", () => {
    withTestCodeEditor([
      "    	My First Line	 ",
      "	My Second Line",
      "    Third Line\u{1F436}",
      "",
      "1"
    ], {}, (editor, _) => {
      const model = editor.getModel();
      editor.setSelection(new Selection(3, 7, 3, 9));
      deleteWordRight(editor);
      assert.strictEqual(model.getLineContent(3), "    Thd Line\u{1F436}");
      assert.deepStrictEqual(editor.getPosition(), new Position(3, 7));
    });
  });
  test("deleteWordRight for cursor at end of document", () => {
    withTestCodeEditor([
      "    	My First Line	 ",
      "	My Second Line",
      "    Third Line\u{1F436}",
      "",
      "1"
    ], {}, (editor, _) => {
      const model = editor.getModel();
      editor.setPosition(new Position(5, 3));
      deleteWordRight(editor);
      assert.strictEqual(model.getLineContent(5), "1");
      assert.deepStrictEqual(editor.getPosition(), new Position(5, 2));
    });
  });
  test("deleteWordRight for cursor at beggining of whitespace", () => {
    withTestCodeEditor([
      "    	My First Line	 ",
      "	My Second Line",
      "    Third Line\u{1F436}",
      "",
      "1"
    ], {}, (editor, _) => {
      const model = editor.getModel();
      editor.setPosition(new Position(3, 1));
      deleteWordRight(editor);
      assert.strictEqual(model.getLineContent(3), "Third Line\u{1F436}");
      assert.deepStrictEqual(editor.getPosition(), new Position(3, 1));
    });
  });
  test("deleteWordRight for cursor just before a word", () => {
    withTestCodeEditor([
      "    	My First Line	 ",
      "	My Second Line",
      "    Third Line\u{1F436}",
      "",
      "1"
    ], {}, (editor, _) => {
      const model = editor.getModel();
      editor.setPosition(new Position(2, 5));
      deleteWordRight(editor);
      assert.strictEqual(model.getLineContent(2), "	My  Line");
      assert.deepStrictEqual(editor.getPosition(), new Position(2, 5));
    });
  });
  test("deleteWordRight for cursor inside of a word", () => {
    withTestCodeEditor([
      "    	My First Line	 ",
      "	My Second Line",
      "    Third Line\u{1F436}",
      "",
      "1"
    ], {}, (editor, _) => {
      const model = editor.getModel();
      editor.setPosition(new Position(1, 11));
      deleteWordRight(editor);
      assert.strictEqual(model.getLineContent(1), "    	My Fi Line	 ");
      assert.deepStrictEqual(editor.getPosition(), new Position(1, 11));
    });
  });
  test("deleteWordLeft - issue #832", () => {
    const EXPECTED = [
      "|   |/* |Just |some |text |a|+= |3 |+|5 |*/|  "
    ].join("\n");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1e3, 1e4),
      (ed) => deleteWordLeft(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getValue().length === 0
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("deleteWordStartLeft", () => {
    const EXPECTED = [
      "|   |/* |Just |some |text |a|+= |3 |+|5 |*/  "
    ].join("\n");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1e3, 1e4),
      (ed) => deleteWordStartLeft(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getValue().length === 0
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("deleteWordEndLeft", () => {
    const EXPECTED = [
      "|   /*| Just| some| text| a|+=| 3| +|5| */|  "
    ].join("\n");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1e3, 1e4),
      (ed) => deleteWordEndLeft(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getValue().length === 0
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("deleteWordLeft - issue #24947", () => {
    withTestCodeEditor([
      "{",
      "}"
    ], {}, (editor, _) => {
      const model = editor.getModel();
      editor.setPosition(new Position(2, 1));
      deleteWordLeft(editor);
      assert.strictEqual(model.getLineContent(1), "{}");
    });
    withTestCodeEditor([
      "{",
      "}"
    ], {}, (editor, _) => {
      const model = editor.getModel();
      editor.setPosition(new Position(2, 1));
      deleteWordStartLeft(editor);
      assert.strictEqual(model.getLineContent(1), "{}");
    });
    withTestCodeEditor([
      "{",
      "}"
    ], {}, (editor, _) => {
      const model = editor.getModel();
      editor.setPosition(new Position(2, 1));
      deleteWordEndLeft(editor);
      assert.strictEqual(model.getLineContent(1), "{}");
    });
  });
  test("deleteWordRight - issue #832", () => {
    const EXPECTED = "   |/*| Just| some| text| a|+=| 3| +|5|-|3| */|  |";
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1, 1),
      (ed) => deleteWordRight(ed),
      (ed) => new Position(1, text.length - ed.getValue().length + 1),
      (ed) => ed.getValue().length === 0
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("deleteWordRight - issue #3882", () => {
    withTestCodeEditor([
      "public void Add( int x,",
      "                 int y )"
    ], {}, (editor, _) => {
      const model = editor.getModel();
      editor.setPosition(new Position(1, 24));
      deleteWordRight(editor);
      assert.strictEqual(model.getLineContent(1), "public void Add( int x,int y )", "001");
    });
  });
  test("deleteWordStartRight - issue #3882", () => {
    withTestCodeEditor([
      "public void Add( int x,",
      "                 int y )"
    ], {}, (editor, _) => {
      const model = editor.getModel();
      editor.setPosition(new Position(1, 24));
      deleteWordStartRight(editor);
      assert.strictEqual(model.getLineContent(1), "public void Add( int x,int y )", "001");
    });
  });
  test("deleteWordEndRight - issue #3882", () => {
    withTestCodeEditor([
      "public void Add( int x,",
      "                 int y )"
    ], {}, (editor, _) => {
      const model = editor.getModel();
      editor.setPosition(new Position(1, 24));
      deleteWordEndRight(editor);
      assert.strictEqual(model.getLineContent(1), "public void Add( int x,int y )", "001");
    });
  });
  test("deleteWordStartRight", () => {
    const EXPECTED = "   |/* |Just |some |text |a|+= |3 |+|5|-|3 |*/  |";
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1, 1),
      (ed) => deleteWordStartRight(ed),
      (ed) => new Position(1, text.length - ed.getValue().length + 1),
      (ed) => ed.getValue().length === 0
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("deleteWordEndRight", () => {
    const EXPECTED = "   /*| Just| some| text| a|+=| 3| +|5|-|3| */|  |";
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1, 1),
      (ed) => deleteWordEndRight(ed),
      (ed) => new Position(1, text.length - ed.getValue().length + 1),
      (ed) => ed.getValue().length === 0
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("deleteWordRight - issue #3882 (1): Ctrl+Delete removing entire line when used at the end of line", () => {
    withTestCodeEditor([
      "A line with text.",
      "   And another one"
    ], {}, (editor, _) => {
      const model = editor.getModel();
      editor.setPosition(new Position(1, 18));
      deleteWordRight(editor);
      assert.strictEqual(model.getLineContent(1), "A line with text.And another one", "001");
    });
  });
  test("deleteWordLeft - issue #3882 (2): Ctrl+Delete removing entire line when used at the end of line", () => {
    withTestCodeEditor([
      "A line with text.",
      "   And another one"
    ], {}, (editor, _) => {
      const model = editor.getModel();
      editor.setPosition(new Position(2, 1));
      deleteWordLeft(editor);
      assert.strictEqual(model.getLineContent(1), "A line with text.   And another one", "001");
    });
  });
  test("deleteWordLeft - issue #91855: Matching (quote, bracket, paren) doesn't get deleted when hitting Ctrl+Backspace", () => {
    const languageId = "myTestMode";
    disposables.add(languageService.registerLanguage({ id: languageId }));
    disposables.add(languageConfigurationService.register(languageId, {
      autoClosingPairs: [
        { open: '"', close: '"' }
      ]
    }));
    const model = disposables.add(instantiateTextModel(instantiationService, 'a ""', languageId));
    const editor = disposables.add(instantiateTestCodeEditor(instantiationService, model, { autoClosingDelete: "always" }));
    editor.setPosition(new Position(1, 4));
    deleteWordLeft(editor);
    assert.strictEqual(model.getLineContent(1), "a ");
  });
  test("deleteInsideWord - empty line", () => {
    withTestCodeEditor([
      "Line1",
      "",
      "Line2"
    ], {}, (editor, _) => {
      const model = editor.getModel();
      editor.setPosition(new Position(2, 1));
      deleteInsideWord(editor);
      assert.strictEqual(model.getValue(), "Line1\nLine2");
    });
  });
  test("deleteInsideWord - in whitespace 1", () => {
    withTestCodeEditor([
      "Just  some text."
    ], {}, (editor, _) => {
      const model = editor.getModel();
      editor.setPosition(new Position(1, 6));
      deleteInsideWord(editor);
      assert.strictEqual(model.getValue(), "Justsome text.");
    });
  });
  test("deleteInsideWord - in whitespace 2", () => {
    withTestCodeEditor([
      "Just     some text."
    ], {}, (editor, _) => {
      const model = editor.getModel();
      editor.setPosition(new Position(1, 6));
      deleteInsideWord(editor);
      assert.strictEqual(model.getValue(), "Justsome text.");
    });
  });
  test("deleteInsideWord - in whitespace 3", () => {
    withTestCodeEditor([
      'Just     "some text.'
    ], {}, (editor, _) => {
      const model = editor.getModel();
      editor.setPosition(new Position(1, 6));
      deleteInsideWord(editor);
      assert.strictEqual(model.getValue(), 'Just"some text.');
      deleteInsideWord(editor);
      assert.strictEqual(model.getValue(), '"some text.');
      deleteInsideWord(editor);
      assert.strictEqual(model.getValue(), "some text.");
      deleteInsideWord(editor);
      assert.strictEqual(model.getValue(), "text.");
      deleteInsideWord(editor);
      assert.strictEqual(model.getValue(), ".");
      deleteInsideWord(editor);
      assert.strictEqual(model.getValue(), "");
      deleteInsideWord(editor);
      assert.strictEqual(model.getValue(), "");
    });
  });
  test("deleteInsideWord - in non-words", () => {
    withTestCodeEditor([
      "x=3+4+5+6"
    ], {}, (editor, _) => {
      const model = editor.getModel();
      editor.setPosition(new Position(1, 7));
      deleteInsideWord(editor);
      assert.strictEqual(model.getValue(), "x=3+45+6");
      deleteInsideWord(editor);
      assert.strictEqual(model.getValue(), "x=3++6");
      deleteInsideWord(editor);
      assert.strictEqual(model.getValue(), "x=36");
      deleteInsideWord(editor);
      assert.strictEqual(model.getValue(), "x=");
      deleteInsideWord(editor);
      assert.strictEqual(model.getValue(), "x");
      deleteInsideWord(editor);
      assert.strictEqual(model.getValue(), "");
      deleteInsideWord(editor);
      assert.strictEqual(model.getValue(), "");
    });
  });
  test("deleteInsideWord - in words 1", () => {
    withTestCodeEditor([
      "This is interesting"
    ], {}, (editor, _) => {
      const model = editor.getModel();
      editor.setPosition(new Position(1, 7));
      deleteInsideWord(editor);
      assert.strictEqual(model.getValue(), "This interesting");
      deleteInsideWord(editor);
      assert.strictEqual(model.getValue(), "This");
      deleteInsideWord(editor);
      assert.strictEqual(model.getValue(), "");
      deleteInsideWord(editor);
      assert.strictEqual(model.getValue(), "");
    });
  });
  test("deleteInsideWord - in words 2", () => {
    withTestCodeEditor([
      "This  is  interesting"
    ], {}, (editor, _) => {
      const model = editor.getModel();
      editor.setPosition(new Position(1, 7));
      deleteInsideWord(editor);
      assert.strictEqual(model.getValue(), "This  interesting");
      deleteInsideWord(editor);
      assert.strictEqual(model.getValue(), "This");
      deleteInsideWord(editor);
      assert.strictEqual(model.getValue(), "");
      deleteInsideWord(editor);
      assert.strictEqual(model.getValue(), "");
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi93b3JkT3BlcmF0aW9ucy90ZXN0L2Jyb3dzZXIvd29yZE9wZXJhdGlvbnMudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBpc0ZpcmVmb3ggfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IENvcmVFZGl0aW5nQ29tbWFuZHMgfSBmcm9tICcuLi8uLi8uLi8uLi9icm93c2VyL2NvcmVDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JDb21tYW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZUNvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBWaWV3TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vdmlld01vZGVsL3ZpZXdNb2RlbEltcGwuanMnO1xuaW1wb3J0IHsgQ3Vyc29yV29yZEFjY2Vzc2liaWxpdHlMZWZ0LCBDdXJzb3JXb3JkQWNjZXNzaWJpbGl0eUxlZnRTZWxlY3QsIEN1cnNvcldvcmRBY2Nlc3NpYmlsaXR5UmlnaHQsIEN1cnNvcldvcmRBY2Nlc3NpYmlsaXR5UmlnaHRTZWxlY3QsIEN1cnNvcldvcmRFbmRMZWZ0LCBDdXJzb3JXb3JkRW5kTGVmdFNlbGVjdCwgQ3Vyc29yV29yZEVuZFJpZ2h0LCBDdXJzb3JXb3JkRW5kUmlnaHRTZWxlY3QsIEN1cnNvcldvcmRMZWZ0LCBDdXJzb3JXb3JkTGVmdFNlbGVjdCwgQ3Vyc29yV29yZFJpZ2h0LCBDdXJzb3JXb3JkUmlnaHRTZWxlY3QsIEN1cnNvcldvcmRTdGFydExlZnQsIEN1cnNvcldvcmRTdGFydExlZnRTZWxlY3QsIEN1cnNvcldvcmRTdGFydFJpZ2h0LCBDdXJzb3JXb3JkU3RhcnRSaWdodFNlbGVjdCwgRGVsZXRlSW5zaWRlV29yZCwgRGVsZXRlV29yZEVuZExlZnQsIERlbGV0ZVdvcmRFbmRSaWdodCwgRGVsZXRlV29yZExlZnQsIERlbGV0ZVdvcmRSaWdodCwgRGVsZXRlV29yZFN0YXJ0TGVmdCwgRGVsZXRlV29yZFN0YXJ0UmlnaHQgfSBmcm9tICcuLi8uLi9icm93c2VyL3dvcmRPcGVyYXRpb25zLmpzJztcbmltcG9ydCB7IGRlc2VyaWFsaXplUGlwZVBvc2l0aW9ucywgc2VyaWFsaXplUGlwZVBvc2l0aW9ucywgdGVzdFJlcGVhdGVkQWN0aW9uQW5kRXh0cmFjdFBvc2l0aW9ucyB9IGZyb20gJy4vd29yZFRlc3RVdGlscy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVDb2RlRWRpdG9yU2VydmljZXMsIGluc3RhbnRpYXRlVGVzdENvZGVFZGl0b3IsIHdpdGhUZXN0Q29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvYnJvd3Nlci90ZXN0Q29kZUVkaXRvci5qcyc7XG5pbXBvcnQgeyBpbnN0YW50aWF0ZVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvY29tbW9uL3Rlc3RUZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi90ZXN0L2NvbW1vbi9pbnN0YW50aWF0aW9uU2VydmljZU1vY2suanMnO1xuXG5zdWl0ZSgnV29yZE9wZXJhdGlvbnMnLCAoKSA9PiB7XG5cblx0Y29uc3QgX2N1cnNvcldvcmRTdGFydExlZnQgPSBuZXcgQ3Vyc29yV29yZFN0YXJ0TGVmdCgpO1xuXHRjb25zdCBfY3Vyc29yV29yZEVuZExlZnQgPSBuZXcgQ3Vyc29yV29yZEVuZExlZnQoKTtcblx0Y29uc3QgX2N1cnNvcldvcmRMZWZ0ID0gbmV3IEN1cnNvcldvcmRMZWZ0KCk7XG5cdGNvbnN0IF9jdXJzb3JXb3JkU3RhcnRMZWZ0U2VsZWN0ID0gbmV3IEN1cnNvcldvcmRTdGFydExlZnRTZWxlY3QoKTtcblx0Y29uc3QgX2N1cnNvcldvcmRFbmRMZWZ0U2VsZWN0ID0gbmV3IEN1cnNvcldvcmRFbmRMZWZ0U2VsZWN0KCk7XG5cdGNvbnN0IF9jdXJzb3JXb3JkTGVmdFNlbGVjdCA9IG5ldyBDdXJzb3JXb3JkTGVmdFNlbGVjdCgpO1xuXHRjb25zdCBfY3Vyc29yV29yZFN0YXJ0UmlnaHQgPSBuZXcgQ3Vyc29yV29yZFN0YXJ0UmlnaHQoKTtcblx0Y29uc3QgX2N1cnNvcldvcmRFbmRSaWdodCA9IG5ldyBDdXJzb3JXb3JkRW5kUmlnaHQoKTtcblx0Y29uc3QgX2N1cnNvcldvcmRSaWdodCA9IG5ldyBDdXJzb3JXb3JkUmlnaHQoKTtcblx0Y29uc3QgX2N1cnNvcldvcmRTdGFydFJpZ2h0U2VsZWN0ID0gbmV3IEN1cnNvcldvcmRTdGFydFJpZ2h0U2VsZWN0KCk7XG5cdGNvbnN0IF9jdXJzb3JXb3JkRW5kUmlnaHRTZWxlY3QgPSBuZXcgQ3Vyc29yV29yZEVuZFJpZ2h0U2VsZWN0KCk7XG5cdGNvbnN0IF9jdXJzb3JXb3JkUmlnaHRTZWxlY3QgPSBuZXcgQ3Vyc29yV29yZFJpZ2h0U2VsZWN0KCk7XG5cdGNvbnN0IF9jdXJzb3JXb3JkQWNjZXNzaWJpbGl0eUxlZnQgPSBuZXcgQ3Vyc29yV29yZEFjY2Vzc2liaWxpdHlMZWZ0KCk7XG5cdGNvbnN0IF9jdXJzb3JXb3JkQWNjZXNzaWJpbGl0eUxlZnRTZWxlY3QgPSBuZXcgQ3Vyc29yV29yZEFjY2Vzc2liaWxpdHlMZWZ0U2VsZWN0KCk7XG5cdGNvbnN0IF9jdXJzb3JXb3JkQWNjZXNzaWJpbGl0eVJpZ2h0ID0gbmV3IEN1cnNvcldvcmRBY2Nlc3NpYmlsaXR5UmlnaHQoKTtcblx0Y29uc3QgX2N1cnNvcldvcmRBY2Nlc3NpYmlsaXR5UmlnaHRTZWxlY3QgPSBuZXcgQ3Vyc29yV29yZEFjY2Vzc2liaWxpdHlSaWdodFNlbGVjdCgpO1xuXHRjb25zdCBfZGVsZXRlV29yZExlZnQgPSBuZXcgRGVsZXRlV29yZExlZnQoKTtcblx0Y29uc3QgX2RlbGV0ZVdvcmRTdGFydExlZnQgPSBuZXcgRGVsZXRlV29yZFN0YXJ0TGVmdCgpO1xuXHRjb25zdCBfZGVsZXRlV29yZEVuZExlZnQgPSBuZXcgRGVsZXRlV29yZEVuZExlZnQoKTtcblx0Y29uc3QgX2RlbGV0ZVdvcmRSaWdodCA9IG5ldyBEZWxldGVXb3JkUmlnaHQoKTtcblx0Y29uc3QgX2RlbGV0ZVdvcmRTdGFydFJpZ2h0ID0gbmV3IERlbGV0ZVdvcmRTdGFydFJpZ2h0KCk7XG5cdGNvbnN0IF9kZWxldGVXb3JkRW5kUmlnaHQgPSBuZXcgRGVsZXRlV29yZEVuZFJpZ2h0KCk7XG5cdGNvbnN0IF9kZWxldGVJbnNpZGVXb3JkID0gbmV3IERlbGV0ZUluc2lkZVdvcmQoKTtcblxuXHRsZXQgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcblx0bGV0IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2U7XG5cdGxldCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZTtcblx0bGV0IGxhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZTtcblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2UgPSBjcmVhdGVDb2RlRWRpdG9yU2VydmljZXMoZGlzcG9zYWJsZXMpO1xuXHRcdGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdGxhbmd1YWdlU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTGFuZ3VhZ2VTZXJ2aWNlKTtcblx0fSk7XG5cblx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0ZnVuY3Rpb24gcnVuRWRpdG9yQ29tbWFuZChlZGl0b3I6IElDb2RlRWRpdG9yLCBjb21tYW5kOiBFZGl0b3JDb21tYW5kKTogdm9pZCB7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oKGFjY2Vzc29yKSA9PiB7XG5cdFx0XHRjb21tYW5kLnJ1bkVkaXRvckNvbW1hbmQoYWNjZXNzb3IsIGVkaXRvciwgbnVsbCk7XG5cdFx0fSk7XG5cdH1cblx0ZnVuY3Rpb24gY3Vyc29yV29yZExlZnQoZWRpdG9yOiBJQ29kZUVkaXRvciwgaW5TZWxlY3Rpb25Nb2RlOiBib29sZWFuID0gZmFsc2UpOiB2b2lkIHtcblx0XHRydW5FZGl0b3JDb21tYW5kKGVkaXRvciwgaW5TZWxlY3Rpb25Nb2RlID8gX2N1cnNvcldvcmRMZWZ0U2VsZWN0IDogX2N1cnNvcldvcmRMZWZ0KTtcblx0fVxuXHRmdW5jdGlvbiBjdXJzb3JXb3JkQWNjZXNzaWJpbGl0eUxlZnQoZWRpdG9yOiBJQ29kZUVkaXRvciwgaW5TZWxlY3Rpb25Nb2RlOiBib29sZWFuID0gZmFsc2UpOiB2b2lkIHtcblx0XHRydW5FZGl0b3JDb21tYW5kKGVkaXRvciwgaW5TZWxlY3Rpb25Nb2RlID8gX2N1cnNvcldvcmRBY2Nlc3NpYmlsaXR5TGVmdCA6IF9jdXJzb3JXb3JkQWNjZXNzaWJpbGl0eUxlZnRTZWxlY3QpO1xuXHR9XG5cdGZ1bmN0aW9uIGN1cnNvcldvcmRBY2Nlc3NpYmlsaXR5UmlnaHQoZWRpdG9yOiBJQ29kZUVkaXRvciwgaW5TZWxlY3Rpb25Nb2RlOiBib29sZWFuID0gZmFsc2UpOiB2b2lkIHtcblx0XHRydW5FZGl0b3JDb21tYW5kKGVkaXRvciwgaW5TZWxlY3Rpb25Nb2RlID8gX2N1cnNvcldvcmRBY2Nlc3NpYmlsaXR5UmlnaHRTZWxlY3QgOiBfY3Vyc29yV29yZEFjY2Vzc2liaWxpdHlSaWdodCk7XG5cdH1cblx0ZnVuY3Rpb24gY3Vyc29yV29yZFN0YXJ0TGVmdChlZGl0b3I6IElDb2RlRWRpdG9yLCBpblNlbGVjdGlvbk1vZGU6IGJvb2xlYW4gPSBmYWxzZSk6IHZvaWQge1xuXHRcdHJ1bkVkaXRvckNvbW1hbmQoZWRpdG9yLCBpblNlbGVjdGlvbk1vZGUgPyBfY3Vyc29yV29yZFN0YXJ0TGVmdFNlbGVjdCA6IF9jdXJzb3JXb3JkU3RhcnRMZWZ0KTtcblx0fVxuXHRmdW5jdGlvbiBjdXJzb3JXb3JkRW5kTGVmdChlZGl0b3I6IElDb2RlRWRpdG9yLCBpblNlbGVjdGlvbk1vZGU6IGJvb2xlYW4gPSBmYWxzZSk6IHZvaWQge1xuXHRcdHJ1bkVkaXRvckNvbW1hbmQoZWRpdG9yLCBpblNlbGVjdGlvbk1vZGUgPyBfY3Vyc29yV29yZEVuZExlZnRTZWxlY3QgOiBfY3Vyc29yV29yZEVuZExlZnQpO1xuXHR9XG5cdGZ1bmN0aW9uIGN1cnNvcldvcmRSaWdodChlZGl0b3I6IElDb2RlRWRpdG9yLCBpblNlbGVjdGlvbk1vZGU6IGJvb2xlYW4gPSBmYWxzZSk6IHZvaWQge1xuXHRcdHJ1bkVkaXRvckNvbW1hbmQoZWRpdG9yLCBpblNlbGVjdGlvbk1vZGUgPyBfY3Vyc29yV29yZFJpZ2h0U2VsZWN0IDogX2N1cnNvcldvcmRSaWdodCk7XG5cdH1cblx0ZnVuY3Rpb24gbW92ZVdvcmRFbmRSaWdodChlZGl0b3I6IElDb2RlRWRpdG9yLCBpblNlbGVjdGlvbk1vZGU6IGJvb2xlYW4gPSBmYWxzZSk6IHZvaWQge1xuXHRcdHJ1bkVkaXRvckNvbW1hbmQoZWRpdG9yLCBpblNlbGVjdGlvbk1vZGUgPyBfY3Vyc29yV29yZEVuZFJpZ2h0U2VsZWN0IDogX2N1cnNvcldvcmRFbmRSaWdodCk7XG5cdH1cblx0ZnVuY3Rpb24gbW92ZVdvcmRTdGFydFJpZ2h0KGVkaXRvcjogSUNvZGVFZGl0b3IsIGluU2VsZWN0aW9uTW9kZTogYm9vbGVhbiA9IGZhbHNlKTogdm9pZCB7XG5cdFx0cnVuRWRpdG9yQ29tbWFuZChlZGl0b3IsIGluU2VsZWN0aW9uTW9kZSA/IF9jdXJzb3JXb3JkU3RhcnRSaWdodFNlbGVjdCA6IF9jdXJzb3JXb3JkU3RhcnRSaWdodCk7XG5cdH1cblx0ZnVuY3Rpb24gZGVsZXRlV29yZExlZnQoZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRcdHJ1bkVkaXRvckNvbW1hbmQoZWRpdG9yLCBfZGVsZXRlV29yZExlZnQpO1xuXHR9XG5cdGZ1bmN0aW9uIGRlbGV0ZVdvcmRTdGFydExlZnQoZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRcdHJ1bkVkaXRvckNvbW1hbmQoZWRpdG9yLCBfZGVsZXRlV29yZFN0YXJ0TGVmdCk7XG5cdH1cblx0ZnVuY3Rpb24gZGVsZXRlV29yZEVuZExlZnQoZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRcdHJ1bkVkaXRvckNvbW1hbmQoZWRpdG9yLCBfZGVsZXRlV29yZEVuZExlZnQpO1xuXHR9XG5cdGZ1bmN0aW9uIGRlbGV0ZVdvcmRSaWdodChlZGl0b3I6IElDb2RlRWRpdG9yKTogdm9pZCB7XG5cdFx0cnVuRWRpdG9yQ29tbWFuZChlZGl0b3IsIF9kZWxldGVXb3JkUmlnaHQpO1xuXHR9XG5cdGZ1bmN0aW9uIGRlbGV0ZVdvcmRTdGFydFJpZ2h0KGVkaXRvcjogSUNvZGVFZGl0b3IpOiB2b2lkIHtcblx0XHRydW5FZGl0b3JDb21tYW5kKGVkaXRvciwgX2RlbGV0ZVdvcmRTdGFydFJpZ2h0KTtcblx0fVxuXHRmdW5jdGlvbiBkZWxldGVXb3JkRW5kUmlnaHQoZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRcdHJ1bkVkaXRvckNvbW1hbmQoZWRpdG9yLCBfZGVsZXRlV29yZEVuZFJpZ2h0KTtcblx0fVxuXHRmdW5jdGlvbiBkZWxldGVJbnNpZGVXb3JkKGVkaXRvcjogSUNvZGVFZGl0b3IpOiB2b2lkIHtcblx0XHRfZGVsZXRlSW5zaWRlV29yZC5ydW4obnVsbCEsIGVkaXRvciwgbnVsbCk7XG5cdH1cblxuXHR0ZXN0KCdjdXJzb3JXb3JkTGVmdCAtIHNpbXBsZScsICgpID0+IHtcblx0XHRjb25zdCBFWFBFQ1RFRCA9IFtcblx0XHRcdCd8ICAgIFxcdHxNeSB8Rmlyc3QgfExpbmVcXHQgJyxcblx0XHRcdCd8XFx0fE15IHxTZWNvbmQgfExpbmUnLFxuXHRcdFx0J3wgICAgfFRoaXJkIHxMaW5lXHVEODNEXHVEQzM2Jyxcblx0XHRcdCd8Jyxcblx0XHRcdCd8MScsXG5cdFx0XS5qb2luKCdcXG4nKTtcblx0XHRjb25zdCBbdGV4dCxdID0gZGVzZXJpYWxpemVQaXBlUG9zaXRpb25zKEVYUEVDVEVEKTtcblx0XHRjb25zdCBhY3R1YWxTdG9wcyA9IHRlc3RSZXBlYXRlZEFjdGlvbkFuZEV4dHJhY3RQb3NpdGlvbnMoXG5cdFx0XHR0ZXh0LFxuXHRcdFx0bmV3IFBvc2l0aW9uKDEwMDAsIDEwMDApLFxuXHRcdFx0ZWQgPT4gY3Vyc29yV29yZExlZnQoZWQpLFxuXHRcdFx0ZWQgPT4gZWQuZ2V0UG9zaXRpb24oKSEsXG5cdFx0XHRlZCA9PiBlZC5nZXRQb3NpdGlvbigpIS5lcXVhbHMobmV3IFBvc2l0aW9uKDEsIDEpKVxuXHRcdCk7XG5cdFx0Y29uc3QgYWN0dWFsID0gc2VyaWFsaXplUGlwZVBvc2l0aW9ucyh0ZXh0LCBhY3R1YWxTdG9wcyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIEVYUEVDVEVEKTtcblx0fSk7XG5cblx0dGVzdCgnY3Vyc29yV29yZExlZnQgLSB3aXRoIHNlbGVjdGlvbicsICgpID0+IHtcblx0XHR3aXRoVGVzdENvZGVFZGl0b3IoW1xuXHRcdFx0JyAgICBcXHRNeSBGaXJzdCBMaW5lXFx0ICcsXG5cdFx0XHQnXFx0TXkgU2Vjb25kIExpbmUnLFxuXHRcdFx0JyAgICBUaGlyZCBMaW5lXHVEODNEXHVEQzM2Jyxcblx0XHRcdCcnLFxuXHRcdFx0JzEnLFxuXHRcdF0sIHt9LCAoZWRpdG9yKSA9PiB7XG5cdFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24obmV3IFBvc2l0aW9uKDUsIDIpKTtcblx0XHRcdGN1cnNvcldvcmRMZWZ0KGVkaXRvciwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb24oKSwgbmV3IFNlbGVjdGlvbig1LCAyLCA1LCAxKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2N1cnNvcldvcmRMZWZ0IC0gaXNzdWUgIzgzMicsICgpID0+IHtcblx0XHRjb25zdCBFWFBFQ1RFRCA9IFsnfCAgIHwvKiB8SnVzdCB8c29tZSAgIHxtb3JlICAgfHRleHQgfGF8Kz0gfDMgfCt8NS18MyB8KyB8NyB8Ki8gICddLmpvaW4oJ1xcbicpO1xuXHRcdGNvbnN0IFt0ZXh0LF0gPSBkZXNlcmlhbGl6ZVBpcGVQb3NpdGlvbnMoRVhQRUNURUQpO1xuXHRcdGNvbnN0IGFjdHVhbFN0b3BzID0gdGVzdFJlcGVhdGVkQWN0aW9uQW5kRXh0cmFjdFBvc2l0aW9ucyhcblx0XHRcdHRleHQsXG5cdFx0XHRuZXcgUG9zaXRpb24oMTAwMCwgMTAwMCksXG5cdFx0XHRlZCA9PiBjdXJzb3JXb3JkTGVmdChlZCksXG5cdFx0XHRlZCA9PiBlZC5nZXRQb3NpdGlvbigpISxcblx0XHRcdGVkID0+IGVkLmdldFBvc2l0aW9uKCkhLmVxdWFscyhuZXcgUG9zaXRpb24oMSwgMSkpXG5cdFx0KTtcblx0XHRjb25zdCBhY3R1YWwgPSBzZXJpYWxpemVQaXBlUG9zaXRpb25zKHRleHQsIGFjdHVhbFN0b3BzKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgRVhQRUNURUQpO1xuXHR9KTtcblxuXHR0ZXN0KCdjdXJzb3JXb3JkTGVmdCAtIGlzc3VlICM0ODA0NjogV29yZCBzZWxlY3Rpb24gZG9lc25cXCd0IHdvcmsgYXMgdXN1YWwnLCAoKSA9PiB7XG5cdFx0Y29uc3QgRVhQRUNURUQgPSBbXG5cdFx0XHQnfGRlZXAufG9iamVjdC58cHJvcGVydHknLFxuXHRcdF0uam9pbignXFxuJyk7XG5cdFx0Y29uc3QgW3RleHQsXSA9IGRlc2VyaWFsaXplUGlwZVBvc2l0aW9ucyhFWFBFQ1RFRCk7XG5cdFx0Y29uc3QgYWN0dWFsU3RvcHMgPSB0ZXN0UmVwZWF0ZWRBY3Rpb25BbmRFeHRyYWN0UG9zaXRpb25zKFxuXHRcdFx0dGV4dCxcblx0XHRcdG5ldyBQb3NpdGlvbigxLCAyMSksXG5cdFx0XHRlZCA9PiBjdXJzb3JXb3JkTGVmdChlZCksXG5cdFx0XHRlZCA9PiBlZC5nZXRQb3NpdGlvbigpISxcblx0XHRcdGVkID0+IGVkLmdldFBvc2l0aW9uKCkhLmVxdWFscyhuZXcgUG9zaXRpb24oMSwgMSkpXG5cdFx0KTtcblx0XHRjb25zdCBhY3R1YWwgPSBzZXJpYWxpemVQaXBlUG9zaXRpb25zKHRleHQsIGFjdHVhbFN0b3BzKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgRVhQRUNURUQpO1xuXHR9KTtcblxuXHR0ZXN0KCdjdXJzb3JXb3JkTGVmdCAtIFJlY29nbml6ZSB3b3JkcycsIGZ1bmN0aW9uICgpIHtcblx0XHRpZiAoaXNGaXJlZm94KSB7XG5cdFx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMjE5ODQzXG5cdFx0XHRyZXR1cm4gdGhpcy5za2lwKCk7XG5cdFx0fVxuXHRcdGNvbnN0IEVYUEVDVEVEID0gW1xuXHRcdFx0J3wvKiB8XHUzMDUzXHUzMDhDfFx1MzA2RnxcdTMwQzZcdTMwQjlcdTMwQzh8XHUzMDY3XHUzMDU5IHwvKicsXG5cdFx0XS5qb2luKCdcXG4nKTtcblx0XHRjb25zdCBbdGV4dCxdID0gZGVzZXJpYWxpemVQaXBlUG9zaXRpb25zKEVYUEVDVEVEKTtcblx0XHRjb25zdCBhY3R1YWxTdG9wcyA9IHRlc3RSZXBlYXRlZEFjdGlvbkFuZEV4dHJhY3RQb3NpdGlvbnMoXG5cdFx0XHR0ZXh0LFxuXHRcdFx0bmV3IFBvc2l0aW9uKDEwMDAsIDEwMDApLFxuXHRcdFx0ZWQgPT4gY3Vyc29yV29yZExlZnQoZWQsIHRydWUpLFxuXHRcdFx0ZWQgPT4gZWQuZ2V0UG9zaXRpb24oKSEsXG5cdFx0XHRlZCA9PiBlZC5nZXRQb3NpdGlvbigpIS5lcXVhbHMobmV3IFBvc2l0aW9uKDEsIDEpKSxcblx0XHRcdHtcblx0XHRcdFx0d29yZFNlZ21lbnRlckxvY2FsZXM6ICdqYSdcblx0XHRcdH1cblx0XHQpO1xuXHRcdGNvbnN0IGFjdHVhbCA9IHNlcmlhbGl6ZVBpcGVQb3NpdGlvbnModGV4dCwgYWN0dWFsU3RvcHMpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBFWFBFQ1RFRCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2N1cnNvcldvcmRMZWZ0IC0gRG9lcyBub3QgcmVjb2duaXplIHdvcmRzJywgKCkgPT4ge1xuXHRcdGNvbnN0IEVYUEVDVEVEID0gW1xuXHRcdFx0J3wvKiB8XHUzMDUzXHUzMDhDXHUzMDZGXHUzMEM2XHUzMEI5XHUzMEM4XHUzMDY3XHUzMDU5IHwvKicsXG5cdFx0XS5qb2luKCdcXG4nKTtcblx0XHRjb25zdCBbdGV4dCxdID0gZGVzZXJpYWxpemVQaXBlUG9zaXRpb25zKEVYUEVDVEVEKTtcblx0XHRjb25zdCBhY3R1YWxTdG9wcyA9IHRlc3RSZXBlYXRlZEFjdGlvbkFuZEV4dHJhY3RQb3NpdGlvbnMoXG5cdFx0XHR0ZXh0LFxuXHRcdFx0bmV3IFBvc2l0aW9uKDEwMDAsIDEwMDApLFxuXHRcdFx0ZWQgPT4gY3Vyc29yV29yZExlZnQoZWQsIHRydWUpLFxuXHRcdFx0ZWQgPT4gZWQuZ2V0UG9zaXRpb24oKSEsXG5cdFx0XHRlZCA9PiBlZC5nZXRQb3NpdGlvbigpIS5lcXVhbHMobmV3IFBvc2l0aW9uKDEsIDEpKSxcblx0XHRcdHtcblx0XHRcdFx0d29yZFNlZ21lbnRlckxvY2FsZXM6ICcnXG5cdFx0XHR9XG5cdFx0KTtcblx0XHRjb25zdCBhY3R1YWwgPSBzZXJpYWxpemVQaXBlUG9zaXRpb25zKHRleHQsIGFjdHVhbFN0b3BzKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgRVhQRUNURUQpO1xuXHR9KTtcblxuXHR0ZXN0KCdjdXJzb3JXb3JkTGVmdCAtIGlzc3VlICMxNjk5MDQ6IGN1cnNvcnMgb3V0IG9mIHN5bmMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgdGV4dCA9IFtcblx0XHRcdCcuZ3JpZDEgeycsXG5cdFx0XHQnICBkaXNwbGF5OiBncmlkOycsXG5cdFx0XHQnICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6Jyxcblx0XHRcdCcgICAgW2Z1bGwtc3RhcnRdIG1pbm1heCgxZW0sIDFmciknLFxuXHRcdFx0JyAgICBbbWFpbi1zdGFydF0gbWlubWF4KDAsIDQwZW0pIFttYWluLWVuZF0nLFxuXHRcdFx0JyAgICBtaW5tYXgoMWVtLCAxZnIpIFtmdWxsLWVuZF07Jyxcblx0XHRcdCd9Jyxcblx0XHRcdCcuZ3JpZDIgeycsXG5cdFx0XHQnICBkaXNwbGF5OiBncmlkOycsXG5cdFx0XHQnICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6Jyxcblx0XHRcdCcgICAgW2Z1bGwtc3RhcnRdIG1pbm1heCgxZW0sIDFmciknLFxuXHRcdFx0JyAgICBbbWFpbi1zdGFydF0gbWlubWF4KDAsIDQwZW0pIFttYWluLWVuZF0gbWlubWF4KDFlbSwgMWZyKSBbZnVsbC1lbmRdOycsXG5cdFx0XHQnfScsXG5cdFx0XTtcblx0XHR3aXRoVGVzdENvZGVFZGl0b3IodGV4dCwge30sIChlZGl0b3IpID0+IHtcblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbig1LCA0NCwgNSwgNDQpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDYsIDMyLCA2LCAzMiksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMTIsIDQ0LCAxMiwgNDQpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEyLCA3MiwgMTIsIDcyKSxcblx0XHRcdF0pO1xuXHRcdFx0Y3Vyc29yV29yZExlZnQoZWRpdG9yLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCksIFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbig1LCA0MywgNSwgNDMpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDYsIDMxLCA2LCAzMSksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMTIsIDQzLCAxMiwgNDMpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEyLCA3MSwgMTIsIDcxKSxcblx0XHRcdF0pO1xuXG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2N1cnNvcldvcmRMZWZ0U2VsZWN0IC0gaXNzdWUgIzc0MzY5OiBjdXJzb3JXb3JkTGVmdCBhbmQgY3Vyc29yV29yZExlZnRTZWxlY3QgZG8gbm90IGJlaGF2ZSBjb25zaXN0ZW50bHknLCAoKSA9PiB7XG5cdFx0Y29uc3QgRVhQRUNURUQgPSBbXG5cdFx0XHQnfHRoaXMufGlzLnxhLnx0ZXN0Jyxcblx0XHRdLmpvaW4oJ1xcbicpO1xuXHRcdGNvbnN0IFt0ZXh0LF0gPSBkZXNlcmlhbGl6ZVBpcGVQb3NpdGlvbnMoRVhQRUNURUQpO1xuXHRcdGNvbnN0IGFjdHVhbFN0b3BzID0gdGVzdFJlcGVhdGVkQWN0aW9uQW5kRXh0cmFjdFBvc2l0aW9ucyhcblx0XHRcdHRleHQsXG5cdFx0XHRuZXcgUG9zaXRpb24oMSwgMTUpLFxuXHRcdFx0ZWQgPT4gY3Vyc29yV29yZExlZnQoZWQsIHRydWUpLFxuXHRcdFx0ZWQgPT4gZWQuZ2V0UG9zaXRpb24oKSEsXG5cdFx0XHRlZCA9PiBlZC5nZXRQb3NpdGlvbigpIS5lcXVhbHMobmV3IFBvc2l0aW9uKDEsIDEpKVxuXHRcdCk7XG5cdFx0Y29uc3QgYWN0dWFsID0gc2VyaWFsaXplUGlwZVBvc2l0aW9ucyh0ZXh0LCBhY3R1YWxTdG9wcyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIEVYUEVDVEVEKTtcblx0fSk7XG5cblx0dGVzdCgnY3Vyc29yV29yZFN0YXJ0TGVmdCcsICgpID0+IHtcblx0XHQvLyBUaGlzIGlzIHRoZSBiZWhhdmlvdXIgb2JzZXJ2ZWQgaW4gVmlzdWFsIFN0dWRpbywgcGxlYXNlIGRvIG5vdCB0b3VjaCB0ZXN0XG5cdFx0Y29uc3QgRVhQRUNURUQgPSBbJ3wgICB8LyogfEp1c3QgfHNvbWUgICB8bW9yZSAgIHx0ZXh0IHxhfCs9IHwzIHwrfDV8LXwzIHwrIHw3IHwqLyAgJ10uam9pbignXFxuJyk7XG5cdFx0Y29uc3QgW3RleHQsXSA9IGRlc2VyaWFsaXplUGlwZVBvc2l0aW9ucyhFWFBFQ1RFRCk7XG5cdFx0Y29uc3QgYWN0dWFsU3RvcHMgPSB0ZXN0UmVwZWF0ZWRBY3Rpb25BbmRFeHRyYWN0UG9zaXRpb25zKFxuXHRcdFx0dGV4dCxcblx0XHRcdG5ldyBQb3NpdGlvbigxMDAwLCAxMDAwKSxcblx0XHRcdGVkID0+IGN1cnNvcldvcmRTdGFydExlZnQoZWQpLFxuXHRcdFx0ZWQgPT4gZWQuZ2V0UG9zaXRpb24oKSEsXG5cdFx0XHRlZCA9PiBlZC5nZXRQb3NpdGlvbigpIS5lcXVhbHMobmV3IFBvc2l0aW9uKDEsIDEpKVxuXHRcdCk7XG5cdFx0Y29uc3QgYWN0dWFsID0gc2VyaWFsaXplUGlwZVBvc2l0aW9ucyh0ZXh0LCBhY3R1YWxTdG9wcyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIEVYUEVDVEVEKTtcblx0fSk7XG5cblx0dGVzdCgnY3Vyc29yV29yZFN0YXJ0TGVmdCAtIGlzc3VlICM1MTExOTogcmVncmVzc2lvbiBtYWtlcyBWUyBjb21wYXRpYmlsaXR5IGltcG9zc2libGUnLCAoKSA9PiB7XG5cdFx0Ly8gVGhpcyBpcyB0aGUgYmVoYXZpb3VyIG9ic2VydmVkIGluIFZpc3VhbCBTdHVkaW8sIHBsZWFzZSBkbyBub3QgdG91Y2ggdGVzdFxuXHRcdGNvbnN0IEVYUEVDVEVEID0gWyd8dGhpc3wufGlzfC58YXwufHRlc3QnXS5qb2luKCdcXG4nKTtcblx0XHRjb25zdCBbdGV4dCxdID0gZGVzZXJpYWxpemVQaXBlUG9zaXRpb25zKEVYUEVDVEVEKTtcblx0XHRjb25zdCBhY3R1YWxTdG9wcyA9IHRlc3RSZXBlYXRlZEFjdGlvbkFuZEV4dHJhY3RQb3NpdGlvbnMoXG5cdFx0XHR0ZXh0LFxuXHRcdFx0bmV3IFBvc2l0aW9uKDEwMDAsIDEwMDApLFxuXHRcdFx0ZWQgPT4gY3Vyc29yV29yZFN0YXJ0TGVmdChlZCksXG5cdFx0XHRlZCA9PiBlZC5nZXRQb3NpdGlvbigpISxcblx0XHRcdGVkID0+IGVkLmdldFBvc2l0aW9uKCkhLmVxdWFscyhuZXcgUG9zaXRpb24oMSwgMSkpXG5cdFx0KTtcblx0XHRjb25zdCBhY3R1YWwgPSBzZXJpYWxpemVQaXBlUG9zaXRpb25zKHRleHQsIGFjdHVhbFN0b3BzKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgRVhQRUNURUQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjNTEyNzUgLSBjdXJzb3JXb3JkU3RhcnRMZWZ0IGRvZXMgbm90IHB1c2ggdW5kby9yZWRvIHN0YWNrIGVsZW1lbnQnLCAoKSA9PiB7XG5cdFx0ZnVuY3Rpb24gdHlwZSh2aWV3TW9kZWw6IFZpZXdNb2RlbCwgdGV4dDogc3RyaW5nKSB7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRleHQubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0dmlld01vZGVsLnR5cGUodGV4dC5jaGFyQXQoaSksICdrZXlib2FyZCcpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcignJywge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0dHlwZSh2aWV3TW9kZWwsICdmb28gYmFyIGJheicpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRWYWx1ZSgpLCAnZm9vIGJhciBiYXonKTtcblxuXHRcdFx0Y3Vyc29yV29yZFN0YXJ0TGVmdChlZGl0b3IpO1xuXHRcdFx0Y3Vyc29yV29yZFN0YXJ0TGVmdChlZGl0b3IpO1xuXHRcdFx0dHlwZSh2aWV3TW9kZWwsICdxJyk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0VmFsdWUoKSwgJ2ZvbyBxYmFyIGJheicpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlVuZG8ucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRWYWx1ZSgpLCAnZm9vIGJhciBiYXonKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnY3Vyc29yV29yZEVuZExlZnQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgRVhQRUNURUQgPSBbJ3wgICAvKnwgSnVzdHwgc29tZXwgICBtb3JlfCAgIHRleHR8IGF8Kz18IDN8ICt8NXwtfDN8ICt8IDd8ICovfCAgJ10uam9pbignXFxuJyk7XG5cdFx0Y29uc3QgW3RleHQsXSA9IGRlc2VyaWFsaXplUGlwZVBvc2l0aW9ucyhFWFBFQ1RFRCk7XG5cdFx0Y29uc3QgYWN0dWFsU3RvcHMgPSB0ZXN0UmVwZWF0ZWRBY3Rpb25BbmRFeHRyYWN0UG9zaXRpb25zKFxuXHRcdFx0dGV4dCxcblx0XHRcdG5ldyBQb3NpdGlvbigxMDAwLCAxMDAwKSxcblx0XHRcdGVkID0+IGN1cnNvcldvcmRFbmRMZWZ0KGVkKSxcblx0XHRcdGVkID0+IGVkLmdldFBvc2l0aW9uKCkhLFxuXHRcdFx0ZWQgPT4gZWQuZ2V0UG9zaXRpb24oKSEuZXF1YWxzKG5ldyBQb3NpdGlvbigxLCAxKSlcblx0XHQpO1xuXHRcdGNvbnN0IGFjdHVhbCA9IHNlcmlhbGl6ZVBpcGVQb3NpdGlvbnModGV4dCwgYWN0dWFsU3RvcHMpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBFWFBFQ1RFRCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2N1cnNvcldvcmRSaWdodCAtIHNpbXBsZScsICgpID0+IHtcblx0XHRjb25zdCBFWFBFQ1RFRCA9IFtcblx0XHRcdCcgICAgXFx0TXl8IEZpcnN0fCBMaW5lfFxcdCB8Jyxcblx0XHRcdCdcXHRNeXwgU2Vjb25kfCBMaW5lfCcsXG5cdFx0XHQnICAgIFRoaXJkfCBMaW5lXHVEODNEXHVEQzM2fCcsXG5cdFx0XHQnfCcsXG5cdFx0XHQnMXwnLFxuXHRcdF0uam9pbignXFxuJyk7XG5cdFx0Y29uc3QgW3RleHQsXSA9IGRlc2VyaWFsaXplUGlwZVBvc2l0aW9ucyhFWFBFQ1RFRCk7XG5cdFx0Y29uc3QgYWN0dWFsU3RvcHMgPSB0ZXN0UmVwZWF0ZWRBY3Rpb25BbmRFeHRyYWN0UG9zaXRpb25zKFxuXHRcdFx0dGV4dCxcblx0XHRcdG5ldyBQb3NpdGlvbigxLCAxKSxcblx0XHRcdGVkID0+IGN1cnNvcldvcmRSaWdodChlZCksXG5cdFx0XHRlZCA9PiBlZC5nZXRQb3NpdGlvbigpISxcblx0XHRcdGVkID0+IGVkLmdldFBvc2l0aW9uKCkhLmVxdWFscyhuZXcgUG9zaXRpb24oNSwgMikpXG5cdFx0KTtcblx0XHRjb25zdCBhY3R1YWwgPSBzZXJpYWxpemVQaXBlUG9zaXRpb25zKHRleHQsIGFjdHVhbFN0b3BzKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgRVhQRUNURUQpO1xuXHR9KTtcblxuXHR0ZXN0KCdjdXJzb3JXb3JkUmlnaHQgLSBzZWxlY3Rpb24nLCAoKSA9PiB7XG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKFtcblx0XHRcdCcgICAgXFx0TXkgRmlyc3QgTGluZVxcdCAnLFxuXHRcdFx0J1xcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdCcgICAgVGhpcmQgTGluZVx1RDgzRFx1REMzNicsXG5cdFx0XHQnJyxcblx0XHRcdCcxJyxcblx0XHRdLCB7fSwgKGVkaXRvciwgXykgPT4ge1xuXHRcdFx0ZWRpdG9yLnNldFBvc2l0aW9uKG5ldyBQb3NpdGlvbigxLCAxKSk7XG5cdFx0XHRjdXJzb3JXb3JkUmlnaHQoZWRpdG9yLCB0cnVlKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbigpLCBuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDgpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnY3Vyc29yV29yZFJpZ2h0IC0gaXNzdWUgIzgzMicsICgpID0+IHtcblx0XHRjb25zdCBFWFBFQ1RFRCA9IFtcblx0XHRcdCcgICAvKnwgSnVzdHwgc29tZXwgICBtb3JlfCAgIHRleHR8IGF8Kz18IDN8ICs1fC0zfCArfCA3fCAqL3wgIHwnLFxuXHRcdF0uam9pbignXFxuJyk7XG5cdFx0Y29uc3QgW3RleHQsXSA9IGRlc2VyaWFsaXplUGlwZVBvc2l0aW9ucyhFWFBFQ1RFRCk7XG5cdFx0Y29uc3QgYWN0dWFsU3RvcHMgPSB0ZXN0UmVwZWF0ZWRBY3Rpb25BbmRFeHRyYWN0UG9zaXRpb25zKFxuXHRcdFx0dGV4dCxcblx0XHRcdG5ldyBQb3NpdGlvbigxLCAxKSxcblx0XHRcdGVkID0+IGN1cnNvcldvcmRSaWdodChlZCksXG5cdFx0XHRlZCA9PiBlZC5nZXRQb3NpdGlvbigpISxcblx0XHRcdGVkID0+IGVkLmdldFBvc2l0aW9uKCkhLmVxdWFscyhuZXcgUG9zaXRpb24oMSwgNTApKVxuXHRcdCk7XG5cdFx0Y29uc3QgYWN0dWFsID0gc2VyaWFsaXplUGlwZVBvc2l0aW9ucyh0ZXh0LCBhY3R1YWxTdG9wcyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIEVYUEVDVEVEKTtcblx0fSk7XG5cblx0dGVzdCgnY3Vyc29yV29yZFJpZ2h0IC0gaXNzdWUgIzQxMTk5JywgKCkgPT4ge1xuXHRcdGNvbnN0IEVYUEVDVEVEID0gW1xuXHRcdFx0J2NvbnNvbGV8LmxvZ3woZXJyfCl8Jyxcblx0XHRdLmpvaW4oJ1xcbicpO1xuXHRcdGNvbnN0IFt0ZXh0LF0gPSBkZXNlcmlhbGl6ZVBpcGVQb3NpdGlvbnMoRVhQRUNURUQpO1xuXHRcdGNvbnN0IGFjdHVhbFN0b3BzID0gdGVzdFJlcGVhdGVkQWN0aW9uQW5kRXh0cmFjdFBvc2l0aW9ucyhcblx0XHRcdHRleHQsXG5cdFx0XHRuZXcgUG9zaXRpb24oMSwgMSksXG5cdFx0XHRlZCA9PiBjdXJzb3JXb3JkUmlnaHQoZWQpLFxuXHRcdFx0ZWQgPT4gZWQuZ2V0UG9zaXRpb24oKSEsXG5cdFx0XHRlZCA9PiBlZC5nZXRQb3NpdGlvbigpIS5lcXVhbHMobmV3IFBvc2l0aW9uKDEsIDE3KSlcblx0XHQpO1xuXHRcdGNvbnN0IGFjdHVhbCA9IHNlcmlhbGl6ZVBpcGVQb3NpdGlvbnModGV4dCwgYWN0dWFsU3RvcHMpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBFWFBFQ1RFRCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2N1cnNvcldvcmRSaWdodCAtIFJlY29nbml6ZSB3b3JkcycsIGZ1bmN0aW9uICgpIHtcblx0XHRpZiAoaXNGaXJlZm94KSB7XG5cdFx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMjE5ODQzXG5cdFx0XHRyZXR1cm4gdGhpcy5za2lwKCk7XG5cdFx0fVxuXHRcdGNvbnN0IEVYUEVDVEVEID0gW1xuXHRcdFx0Jy8qfCBcdTMwNTNcdTMwOEN8XHUzMDZGfFx1MzBDNlx1MzBCOVx1MzBDOHxcdTMwNjdcdTMwNTl8Lyp8Jyxcblx0XHRdLmpvaW4oJ1xcbicpO1xuXHRcdGNvbnN0IFt0ZXh0LF0gPSBkZXNlcmlhbGl6ZVBpcGVQb3NpdGlvbnMoRVhQRUNURUQpO1xuXHRcdGNvbnN0IGFjdHVhbFN0b3BzID0gdGVzdFJlcGVhdGVkQWN0aW9uQW5kRXh0cmFjdFBvc2l0aW9ucyhcblx0XHRcdHRleHQsXG5cdFx0XHRuZXcgUG9zaXRpb24oMSwgMSksXG5cdFx0XHRlZCA9PiBjdXJzb3JXb3JkUmlnaHQoZWQpLFxuXHRcdFx0ZWQgPT4gZWQuZ2V0UG9zaXRpb24oKSEsXG5cdFx0XHRlZCA9PiBlZC5nZXRQb3NpdGlvbigpIS5lcXVhbHMobmV3IFBvc2l0aW9uKDEsIDE0KSksXG5cdFx0XHR7XG5cdFx0XHRcdHdvcmRTZWdtZW50ZXJMb2NhbGVzOiAnamEnXG5cdFx0XHR9XG5cdFx0KTtcblx0XHRjb25zdCBhY3R1YWwgPSBzZXJpYWxpemVQaXBlUG9zaXRpb25zKHRleHQsIGFjdHVhbFN0b3BzKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgRVhQRUNURUQpO1xuXHR9KTtcblxuXHR0ZXN0KCdjdXJzb3JXb3JkUmlnaHQgLSBEb2VzIG5vdCByZWNvZ25pemUgd29yZHMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgRVhQRUNURUQgPSBbXG5cdFx0XHQnLyp8IFx1MzA1M1x1MzA4Q1x1MzA2Rlx1MzBDNlx1MzBCOVx1MzBDOFx1MzA2N1x1MzA1OXwvKnwnLFxuXHRcdF0uam9pbignXFxuJyk7XG5cdFx0Y29uc3QgW3RleHQsXSA9IGRlc2VyaWFsaXplUGlwZVBvc2l0aW9ucyhFWFBFQ1RFRCk7XG5cdFx0Y29uc3QgYWN0dWFsU3RvcHMgPSB0ZXN0UmVwZWF0ZWRBY3Rpb25BbmRFeHRyYWN0UG9zaXRpb25zKFxuXHRcdFx0dGV4dCxcblx0XHRcdG5ldyBQb3NpdGlvbigxLCAxKSxcblx0XHRcdGVkID0+IGN1cnNvcldvcmRSaWdodChlZCksXG5cdFx0XHRlZCA9PiBlZC5nZXRQb3NpdGlvbigpISxcblx0XHRcdGVkID0+IGVkLmdldFBvc2l0aW9uKCkhLmVxdWFscyhuZXcgUG9zaXRpb24oMSwgMTQpKSxcblx0XHRcdHtcblx0XHRcdFx0d29yZFNlZ21lbnRlckxvY2FsZXM6ICcnXG5cdFx0XHR9XG5cdFx0KTtcblx0XHRjb25zdCBhY3R1YWwgPSBzZXJpYWxpemVQaXBlUG9zaXRpb25zKHRleHQsIGFjdHVhbFN0b3BzKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgRVhQRUNURUQpO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlV29yZEVuZFJpZ2h0JywgKCkgPT4ge1xuXHRcdGNvbnN0IEVYUEVDVEVEID0gW1xuXHRcdFx0JyAgIC8qfCBKdXN0fCBzb21lfCAgIG1vcmV8ICAgdGV4dHwgYXwrPXwgM3wgKzV8LTN8ICt8IDd8ICovfCAgfCcsXG5cdFx0XS5qb2luKCdcXG4nKTtcblx0XHRjb25zdCBbdGV4dCxdID0gZGVzZXJpYWxpemVQaXBlUG9zaXRpb25zKEVYUEVDVEVEKTtcblx0XHRjb25zdCBhY3R1YWxTdG9wcyA9IHRlc3RSZXBlYXRlZEFjdGlvbkFuZEV4dHJhY3RQb3NpdGlvbnMoXG5cdFx0XHR0ZXh0LFxuXHRcdFx0bmV3IFBvc2l0aW9uKDEsIDEpLFxuXHRcdFx0ZWQgPT4gbW92ZVdvcmRFbmRSaWdodChlZCksXG5cdFx0XHRlZCA9PiBlZC5nZXRQb3NpdGlvbigpISxcblx0XHRcdGVkID0+IGVkLmdldFBvc2l0aW9uKCkhLmVxdWFscyhuZXcgUG9zaXRpb24oMSwgNTApKVxuXHRcdCk7XG5cdFx0Y29uc3QgYWN0dWFsID0gc2VyaWFsaXplUGlwZVBvc2l0aW9ucyh0ZXh0LCBhY3R1YWxTdG9wcyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIEVYUEVDVEVEKTtcblx0fSk7XG5cblx0dGVzdCgnbW92ZVdvcmRTdGFydFJpZ2h0JywgKCkgPT4ge1xuXHRcdC8vIFRoaXMgaXMgdGhlIGJlaGF2aW91ciBvYnNlcnZlZCBpbiBWaXN1YWwgU3R1ZGlvLCBwbGVhc2UgZG8gbm90IHRvdWNoIHRlc3Rcblx0XHRjb25zdCBFWFBFQ1RFRCA9IFtcblx0XHRcdCcgICB8LyogfEp1c3QgfHNvbWUgICB8bW9yZSAgIHx0ZXh0IHxhfCs9IHwzIHwrfDV8LXwzIHwrIHw3IHwqLyAgfCcsXG5cdFx0XS5qb2luKCdcXG4nKTtcblx0XHRjb25zdCBbdGV4dCxdID0gZGVzZXJpYWxpemVQaXBlUG9zaXRpb25zKEVYUEVDVEVEKTtcblx0XHRjb25zdCBhY3R1YWxTdG9wcyA9IHRlc3RSZXBlYXRlZEFjdGlvbkFuZEV4dHJhY3RQb3NpdGlvbnMoXG5cdFx0XHR0ZXh0LFxuXHRcdFx0bmV3IFBvc2l0aW9uKDEsIDEpLFxuXHRcdFx0ZWQgPT4gbW92ZVdvcmRTdGFydFJpZ2h0KGVkKSxcblx0XHRcdGVkID0+IGVkLmdldFBvc2l0aW9uKCkhLFxuXHRcdFx0ZWQgPT4gZWQuZ2V0UG9zaXRpb24oKSEuZXF1YWxzKG5ldyBQb3NpdGlvbigxLCA1MCkpXG5cdFx0KTtcblx0XHRjb25zdCBhY3R1YWwgPSBzZXJpYWxpemVQaXBlUG9zaXRpb25zKHRleHQsIGFjdHVhbFN0b3BzKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgRVhQRUNURUQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjNTExMTk6IGN1cnNvcldvcmRTdGFydFJpZ2h0IHJlZ3Jlc3Npb24gbWFrZXMgVlMgY29tcGF0aWJpbGl0eSBpbXBvc3NpYmxlJywgKCkgPT4ge1xuXHRcdC8vIFRoaXMgaXMgdGhlIGJlaGF2aW91ciBvYnNlcnZlZCBpbiBWaXN1YWwgU3R1ZGlvLCBwbGVhc2UgZG8gbm90IHRvdWNoIHRlc3Rcblx0XHRjb25zdCBFWFBFQ1RFRCA9IFsndGhpc3wufGlzfC58YXwufHRlc3R8J10uam9pbignXFxuJyk7XG5cdFx0Y29uc3QgW3RleHQsXSA9IGRlc2VyaWFsaXplUGlwZVBvc2l0aW9ucyhFWFBFQ1RFRCk7XG5cdFx0Y29uc3QgYWN0dWFsU3RvcHMgPSB0ZXN0UmVwZWF0ZWRBY3Rpb25BbmRFeHRyYWN0UG9zaXRpb25zKFxuXHRcdFx0dGV4dCxcblx0XHRcdG5ldyBQb3NpdGlvbigxLCAxKSxcblx0XHRcdGVkID0+IG1vdmVXb3JkU3RhcnRSaWdodChlZCksXG5cdFx0XHRlZCA9PiBlZC5nZXRQb3NpdGlvbigpISxcblx0XHRcdGVkID0+IGVkLmdldFBvc2l0aW9uKCkhLmVxdWFscyhuZXcgUG9zaXRpb24oMSwgMTUpKVxuXHRcdCk7XG5cdFx0Y29uc3QgYWN0dWFsID0gc2VyaWFsaXplUGlwZVBvc2l0aW9ucyh0ZXh0LCBhY3R1YWxTdG9wcyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIEVYUEVDVEVEKTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzY0ODEwOiBjdXJzb3JXb3JkU3RhcnRSaWdodCBza2lwcyBmaXJzdCB3b3JkIGFmdGVyIG5ld2xpbmUnLCAoKSA9PiB7XG5cdFx0Ly8gVGhpcyBpcyB0aGUgYmVoYXZpb3VyIG9ic2VydmVkIGluIFZpc3VhbCBTdHVkaW8sIHBsZWFzZSBkbyBub3QgdG91Y2ggdGVzdFxuXHRcdGNvbnN0IEVYUEVDVEVEID0gWydIZWxsbyB8V29ybGR8JywgJ3xIZWkgfG1haWxtYW58J10uam9pbignXFxuJyk7XG5cdFx0Y29uc3QgW3RleHQsXSA9IGRlc2VyaWFsaXplUGlwZVBvc2l0aW9ucyhFWFBFQ1RFRCk7XG5cdFx0Y29uc3QgYWN0dWFsU3RvcHMgPSB0ZXN0UmVwZWF0ZWRBY3Rpb25BbmRFeHRyYWN0UG9zaXRpb25zKFxuXHRcdFx0dGV4dCxcblx0XHRcdG5ldyBQb3NpdGlvbigxLCAxKSxcblx0XHRcdGVkID0+IG1vdmVXb3JkU3RhcnRSaWdodChlZCksXG5cdFx0XHRlZCA9PiBlZC5nZXRQb3NpdGlvbigpISxcblx0XHRcdGVkID0+IGVkLmdldFBvc2l0aW9uKCkhLmVxdWFscyhuZXcgUG9zaXRpb24oMiwgMTIpKVxuXHRcdCk7XG5cdFx0Y29uc3QgYWN0dWFsID0gc2VyaWFsaXplUGlwZVBvc2l0aW9ucyh0ZXh0LCBhY3R1YWxTdG9wcyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIEVYUEVDVEVEKTtcblx0fSk7XG5cblx0dGVzdCgnY3Vyc29yV29yZEFjY2Vzc2liaWxpdHlMZWZ0JywgKCkgPT4ge1xuXHRcdGNvbnN0IEVYUEVDVEVEID0gWyd8ICAgLyogfEp1c3QgfHNvbWUgICB8bW9yZSAgIHx0ZXh0IHxhKz0gfDMgK3w1LXwzICsgfDcgKi8gICddLmpvaW4oJ1xcbicpO1xuXHRcdGNvbnN0IFt0ZXh0LF0gPSBkZXNlcmlhbGl6ZVBpcGVQb3NpdGlvbnMoRVhQRUNURUQpO1xuXHRcdGNvbnN0IGFjdHVhbFN0b3BzID0gdGVzdFJlcGVhdGVkQWN0aW9uQW5kRXh0cmFjdFBvc2l0aW9ucyhcblx0XHRcdHRleHQsXG5cdFx0XHRuZXcgUG9zaXRpb24oMTAwMCwgMTAwMCksXG5cdFx0XHRlZCA9PiBjdXJzb3JXb3JkQWNjZXNzaWJpbGl0eUxlZnQoZWQpLFxuXHRcdFx0ZWQgPT4gZWQuZ2V0UG9zaXRpb24oKSEsXG5cdFx0XHRlZCA9PiBlZC5nZXRQb3NpdGlvbigpIS5lcXVhbHMobmV3IFBvc2l0aW9uKDEsIDEpKVxuXHRcdCk7XG5cdFx0Y29uc3QgYWN0dWFsID0gc2VyaWFsaXplUGlwZVBvc2l0aW9ucyh0ZXh0LCBhY3R1YWxTdG9wcyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIEVYUEVDVEVEKTtcblx0fSk7XG5cblx0dGVzdCgnY3Vyc29yV29yZEFjY2Vzc2liaWxpdHlSaWdodCcsICgpID0+IHtcblx0XHRjb25zdCBFWFBFQ1RFRCA9IFsnICAgLyogfEp1c3QgfHNvbWUgICB8bW9yZSAgIHx0ZXh0IHxhKz0gfDMgK3w1LXwzICsgfDcgKi8gIHwnXS5qb2luKCdcXG4nKTtcblx0XHRjb25zdCBbdGV4dCxdID0gZGVzZXJpYWxpemVQaXBlUG9zaXRpb25zKEVYUEVDVEVEKTtcblx0XHRjb25zdCBhY3R1YWxTdG9wcyA9IHRlc3RSZXBlYXRlZEFjdGlvbkFuZEV4dHJhY3RQb3NpdGlvbnMoXG5cdFx0XHR0ZXh0LFxuXHRcdFx0bmV3IFBvc2l0aW9uKDEsIDEpLFxuXHRcdFx0ZWQgPT4gY3Vyc29yV29yZEFjY2Vzc2liaWxpdHlSaWdodChlZCksXG5cdFx0XHRlZCA9PiBlZC5nZXRQb3NpdGlvbigpISxcblx0XHRcdGVkID0+IGVkLmdldFBvc2l0aW9uKCkhLmVxdWFscyhuZXcgUG9zaXRpb24oMSwgNTApKVxuXHRcdCk7XG5cdFx0Y29uc3QgYWN0dWFsID0gc2VyaWFsaXplUGlwZVBvc2l0aW9ucyh0ZXh0LCBhY3R1YWxTdG9wcyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIEVYUEVDVEVEKTtcblx0fSk7XG5cblx0dGVzdCgnZGVsZXRlV29yZExlZnQgZm9yIG5vbi1lbXB0eSBzZWxlY3Rpb24nLCAoKSA9PiB7XG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKFtcblx0XHRcdCcgICAgXFx0TXkgRmlyc3QgTGluZVxcdCAnLFxuXHRcdFx0J1xcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdCcgICAgVGhpcmQgTGluZVx1RDgzRFx1REMzNicsXG5cdFx0XHQnJyxcblx0XHRcdCcxJyxcblx0XHRdLCB7fSwgKGVkaXRvciwgXykgPT4ge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKSE7XG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMywgNywgMywgOSkpO1xuXHRcdFx0ZGVsZXRlV29yZExlZnQoZWRpdG9yKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgzKSwgJyAgICBUaGQgTGluZVx1RDgzRFx1REMzNicpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0UG9zaXRpb24oKSwgbmV3IFBvc2l0aW9uKDMsIDcpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnZGVsZXRlV29yZExlZnQgZm9yIGN1cnNvciBhdCBiZWdpbm5pbmcgb2YgZG9jdW1lbnQnLCAoKSA9PiB7XG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKFtcblx0XHRcdCcgICAgXFx0TXkgRmlyc3QgTGluZVxcdCAnLFxuXHRcdFx0J1xcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdCcgICAgVGhpcmQgTGluZVx1RDgzRFx1REMzNicsXG5cdFx0XHQnJyxcblx0XHRcdCcxJyxcblx0XHRdLCB7fSwgKGVkaXRvciwgXykgPT4ge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKSE7XG5cdFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDEpKTtcblx0XHRcdGRlbGV0ZVdvcmRMZWZ0KGVkaXRvcik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICcgICAgXFx0TXkgRmlyc3QgTGluZVxcdCAnKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFBvc2l0aW9uKCksIG5ldyBQb3NpdGlvbigxLCAxKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0ZVdvcmRMZWZ0IGZvciBjdXJzb3IgYXQgZW5kIG9mIHdoaXRlc3BhY2UnLCAoKSA9PiB7XG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKFtcblx0XHRcdCcgICAgXFx0TXkgRmlyc3QgTGluZVxcdCAnLFxuXHRcdFx0J1xcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdCcgICAgVGhpcmQgTGluZVx1RDgzRFx1REMzNicsXG5cdFx0XHQnJyxcblx0XHRcdCcxJyxcblx0XHRdLCB7fSwgKGVkaXRvciwgXykgPT4ge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKSE7XG5cdFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24obmV3IFBvc2l0aW9uKDMsIDExKSk7XG5cdFx0XHRkZWxldGVXb3JkTGVmdChlZGl0b3IpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDMpLCAnICAgIExpbmVcdUQ4M0RcdURDMzYnKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFBvc2l0aW9uKCksIG5ldyBQb3NpdGlvbigzLCA1KSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0ZVdvcmRMZWZ0IGZvciBjdXJzb3IganVzdCBiZWhpbmQgYSB3b3JkJywgKCkgPT4ge1xuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihbXG5cdFx0XHQnICAgIFxcdE15IEZpcnN0IExpbmVcXHQgJyxcblx0XHRcdCdcXHRNeSBTZWNvbmQgTGluZScsXG5cdFx0XHQnICAgIFRoaXJkIExpbmVcdUQ4M0RcdURDMzYnLFxuXHRcdFx0JycsXG5cdFx0XHQnMScsXG5cdFx0XSwge30sIChlZGl0b3IsIF8pID0+IHtcblx0XHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCkhO1xuXHRcdFx0ZWRpdG9yLnNldFBvc2l0aW9uKG5ldyBQb3NpdGlvbigyLCAxMSkpO1xuXHRcdFx0ZGVsZXRlV29yZExlZnQoZWRpdG9yKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgyKSwgJ1xcdE15ICBMaW5lJyk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRQb3NpdGlvbigpLCBuZXcgUG9zaXRpb24oMiwgNSkpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWxldGVXb3JkTGVmdCBmb3IgY3Vyc29yIGluc2lkZSBvZiBhIHdvcmQnLCAoKSA9PiB7XG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKFtcblx0XHRcdCcgICAgXFx0TXkgRmlyc3QgTGluZVxcdCAnLFxuXHRcdFx0J1xcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdCcgICAgVGhpcmQgTGluZVx1RDgzRFx1REMzNicsXG5cdFx0XHQnJyxcblx0XHRcdCcxJyxcblx0XHRdLCB7fSwgKGVkaXRvciwgXykgPT4ge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKSE7XG5cdFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDEyKSk7XG5cdFx0XHRkZWxldGVXb3JkTGVmdChlZGl0b3IpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnICAgIFxcdE15IHN0IExpbmVcXHQgJyk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRQb3NpdGlvbigpLCBuZXcgUG9zaXRpb24oMSwgOSkpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWxldGVXb3JkUmlnaHQgZm9yIG5vbi1lbXB0eSBzZWxlY3Rpb24nLCAoKSA9PiB7XG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKFtcblx0XHRcdCcgICAgXFx0TXkgRmlyc3QgTGluZVxcdCAnLFxuXHRcdFx0J1xcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdCcgICAgVGhpcmQgTGluZVx1RDgzRFx1REMzNicsXG5cdFx0XHQnJyxcblx0XHRcdCcxJyxcblx0XHRdLCB7fSwgKGVkaXRvciwgXykgPT4ge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKSE7XG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMywgNywgMywgOSkpO1xuXHRcdFx0ZGVsZXRlV29yZFJpZ2h0KGVkaXRvcik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMyksICcgICAgVGhkIExpbmVcdUQ4M0RcdURDMzYnKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFBvc2l0aW9uKCksIG5ldyBQb3NpdGlvbigzLCA3KSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0ZVdvcmRSaWdodCBmb3IgY3Vyc29yIGF0IGVuZCBvZiBkb2N1bWVudCcsICgpID0+IHtcblx0XHR3aXRoVGVzdENvZGVFZGl0b3IoW1xuXHRcdFx0JyAgICBcXHRNeSBGaXJzdCBMaW5lXFx0ICcsXG5cdFx0XHQnXFx0TXkgU2Vjb25kIExpbmUnLFxuXHRcdFx0JyAgICBUaGlyZCBMaW5lXHVEODNEXHVEQzM2Jyxcblx0XHRcdCcnLFxuXHRcdFx0JzEnLFxuXHRcdF0sIHt9LCAoZWRpdG9yLCBfKSA9PiB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpITtcblx0XHRcdGVkaXRvci5zZXRQb3NpdGlvbihuZXcgUG9zaXRpb24oNSwgMykpO1xuXHRcdFx0ZGVsZXRlV29yZFJpZ2h0KGVkaXRvcik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoNSksICcxJyk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRQb3NpdGlvbigpLCBuZXcgUG9zaXRpb24oNSwgMikpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWxldGVXb3JkUmlnaHQgZm9yIGN1cnNvciBhdCBiZWdnaW5pbmcgb2Ygd2hpdGVzcGFjZScsICgpID0+IHtcblx0XHR3aXRoVGVzdENvZGVFZGl0b3IoW1xuXHRcdFx0JyAgICBcXHRNeSBGaXJzdCBMaW5lXFx0ICcsXG5cdFx0XHQnXFx0TXkgU2Vjb25kIExpbmUnLFxuXHRcdFx0JyAgICBUaGlyZCBMaW5lXHVEODNEXHVEQzM2Jyxcblx0XHRcdCcnLFxuXHRcdFx0JzEnLFxuXHRcdF0sIHt9LCAoZWRpdG9yLCBfKSA9PiB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpITtcblx0XHRcdGVkaXRvci5zZXRQb3NpdGlvbihuZXcgUG9zaXRpb24oMywgMSkpO1xuXHRcdFx0ZGVsZXRlV29yZFJpZ2h0KGVkaXRvcik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMyksICdUaGlyZCBMaW5lXHVEODNEXHVEQzM2Jyk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRQb3NpdGlvbigpLCBuZXcgUG9zaXRpb24oMywgMSkpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWxldGVXb3JkUmlnaHQgZm9yIGN1cnNvciBqdXN0IGJlZm9yZSBhIHdvcmQnLCAoKSA9PiB7XG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKFtcblx0XHRcdCcgICAgXFx0TXkgRmlyc3QgTGluZVxcdCAnLFxuXHRcdFx0J1xcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdCcgICAgVGhpcmQgTGluZVx1RDgzRFx1REMzNicsXG5cdFx0XHQnJyxcblx0XHRcdCcxJyxcblx0XHRdLCB7fSwgKGVkaXRvciwgXykgPT4ge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKSE7XG5cdFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24obmV3IFBvc2l0aW9uKDIsIDUpKTtcblx0XHRcdGRlbGV0ZVdvcmRSaWdodChlZGl0b3IpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnXFx0TXkgIExpbmUnKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFBvc2l0aW9uKCksIG5ldyBQb3NpdGlvbigyLCA1KSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0ZVdvcmRSaWdodCBmb3IgY3Vyc29yIGluc2lkZSBvZiBhIHdvcmQnLCAoKSA9PiB7XG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKFtcblx0XHRcdCcgICAgXFx0TXkgRmlyc3QgTGluZVxcdCAnLFxuXHRcdFx0J1xcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdCcgICAgVGhpcmQgTGluZVx1RDgzRFx1REMzNicsXG5cdFx0XHQnJyxcblx0XHRcdCcxJyxcblx0XHRdLCB7fSwgKGVkaXRvciwgXykgPT4ge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKSE7XG5cdFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDExKSk7XG5cdFx0XHRkZWxldGVXb3JkUmlnaHQoZWRpdG9yKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJyAgICBcXHRNeSBGaSBMaW5lXFx0ICcpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0UG9zaXRpb24oKSwgbmV3IFBvc2l0aW9uKDEsIDExKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0ZVdvcmRMZWZ0IC0gaXNzdWUgIzgzMicsICgpID0+IHtcblx0XHRjb25zdCBFWFBFQ1RFRCA9IFtcblx0XHRcdCd8ICAgfC8qIHxKdXN0IHxzb21lIHx0ZXh0IHxhfCs9IHwzIHwrfDUgfCovfCAgJyxcblx0XHRdLmpvaW4oJ1xcbicpO1xuXHRcdGNvbnN0IFt0ZXh0LF0gPSBkZXNlcmlhbGl6ZVBpcGVQb3NpdGlvbnMoRVhQRUNURUQpO1xuXHRcdGNvbnN0IGFjdHVhbFN0b3BzID0gdGVzdFJlcGVhdGVkQWN0aW9uQW5kRXh0cmFjdFBvc2l0aW9ucyhcblx0XHRcdHRleHQsXG5cdFx0XHRuZXcgUG9zaXRpb24oMTAwMCwgMTAwMDApLFxuXHRcdFx0ZWQgPT4gZGVsZXRlV29yZExlZnQoZWQpLFxuXHRcdFx0ZWQgPT4gZWQuZ2V0UG9zaXRpb24oKSEsXG5cdFx0XHRlZCA9PiBlZC5nZXRWYWx1ZSgpLmxlbmd0aCA9PT0gMFxuXHRcdCk7XG5cdFx0Y29uc3QgYWN0dWFsID0gc2VyaWFsaXplUGlwZVBvc2l0aW9ucyh0ZXh0LCBhY3R1YWxTdG9wcyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIEVYUEVDVEVEKTtcblx0fSk7XG5cblx0dGVzdCgnZGVsZXRlV29yZFN0YXJ0TGVmdCcsICgpID0+IHtcblx0XHRjb25zdCBFWFBFQ1RFRCA9IFtcblx0XHRcdCd8ICAgfC8qIHxKdXN0IHxzb21lIHx0ZXh0IHxhfCs9IHwzIHwrfDUgfCovICAnLFxuXHRcdF0uam9pbignXFxuJyk7XG5cdFx0Y29uc3QgW3RleHQsXSA9IGRlc2VyaWFsaXplUGlwZVBvc2l0aW9ucyhFWFBFQ1RFRCk7XG5cdFx0Y29uc3QgYWN0dWFsU3RvcHMgPSB0ZXN0UmVwZWF0ZWRBY3Rpb25BbmRFeHRyYWN0UG9zaXRpb25zKFxuXHRcdFx0dGV4dCxcblx0XHRcdG5ldyBQb3NpdGlvbigxMDAwLCAxMDAwMCksXG5cdFx0XHRlZCA9PiBkZWxldGVXb3JkU3RhcnRMZWZ0KGVkKSxcblx0XHRcdGVkID0+IGVkLmdldFBvc2l0aW9uKCkhLFxuXHRcdFx0ZWQgPT4gZWQuZ2V0VmFsdWUoKS5sZW5ndGggPT09IDBcblx0XHQpO1xuXHRcdGNvbnN0IGFjdHVhbCA9IHNlcmlhbGl6ZVBpcGVQb3NpdGlvbnModGV4dCwgYWN0dWFsU3RvcHMpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBFWFBFQ1RFRCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0ZVdvcmRFbmRMZWZ0JywgKCkgPT4ge1xuXHRcdGNvbnN0IEVYUEVDVEVEID0gW1xuXHRcdFx0J3wgICAvKnwgSnVzdHwgc29tZXwgdGV4dHwgYXwrPXwgM3wgK3w1fCAqL3wgICcsXG5cdFx0XS5qb2luKCdcXG4nKTtcblx0XHRjb25zdCBbdGV4dCxdID0gZGVzZXJpYWxpemVQaXBlUG9zaXRpb25zKEVYUEVDVEVEKTtcblx0XHRjb25zdCBhY3R1YWxTdG9wcyA9IHRlc3RSZXBlYXRlZEFjdGlvbkFuZEV4dHJhY3RQb3NpdGlvbnMoXG5cdFx0XHR0ZXh0LFxuXHRcdFx0bmV3IFBvc2l0aW9uKDEwMDAsIDEwMDAwKSxcblx0XHRcdGVkID0+IGRlbGV0ZVdvcmRFbmRMZWZ0KGVkKSxcblx0XHRcdGVkID0+IGVkLmdldFBvc2l0aW9uKCkhLFxuXHRcdFx0ZWQgPT4gZWQuZ2V0VmFsdWUoKS5sZW5ndGggPT09IDBcblx0XHQpO1xuXHRcdGNvbnN0IGFjdHVhbCA9IHNlcmlhbGl6ZVBpcGVQb3NpdGlvbnModGV4dCwgYWN0dWFsU3RvcHMpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBFWFBFQ1RFRCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0ZVdvcmRMZWZ0IC0gaXNzdWUgIzI0OTQ3JywgKCkgPT4ge1xuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihbXG5cdFx0XHQneycsXG5cdFx0XHQnfSdcblx0XHRdLCB7fSwgKGVkaXRvciwgXykgPT4ge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKSE7XG5cdFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24obmV3IFBvc2l0aW9uKDIsIDEpKTtcblx0XHRcdGRlbGV0ZVdvcmRMZWZ0KGVkaXRvcik7IGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ3t9Jyk7XG5cdFx0fSk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IoW1xuXHRcdFx0J3snLFxuXHRcdFx0J30nXG5cdFx0XSwge30sIChlZGl0b3IsIF8pID0+IHtcblx0XHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCkhO1xuXHRcdFx0ZWRpdG9yLnNldFBvc2l0aW9uKG5ldyBQb3NpdGlvbigyLCAxKSk7XG5cdFx0XHRkZWxldGVXb3JkU3RhcnRMZWZ0KGVkaXRvcik7IGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ3t9Jyk7XG5cdFx0fSk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IoW1xuXHRcdFx0J3snLFxuXHRcdFx0J30nXG5cdFx0XSwge30sIChlZGl0b3IsIF8pID0+IHtcblx0XHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCkhO1xuXHRcdFx0ZWRpdG9yLnNldFBvc2l0aW9uKG5ldyBQb3NpdGlvbigyLCAxKSk7XG5cdFx0XHRkZWxldGVXb3JkRW5kTGVmdChlZGl0b3IpOyBhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICd7fScpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWxldGVXb3JkUmlnaHQgLSBpc3N1ZSAjODMyJywgKCkgPT4ge1xuXHRcdGNvbnN0IEVYUEVDVEVEID0gJyAgIHwvKnwgSnVzdHwgc29tZXwgdGV4dHwgYXwrPXwgM3wgK3w1fC18M3wgKi98ICB8Jztcblx0XHRjb25zdCBbdGV4dCxdID0gZGVzZXJpYWxpemVQaXBlUG9zaXRpb25zKEVYUEVDVEVEKTtcblx0XHRjb25zdCBhY3R1YWxTdG9wcyA9IHRlc3RSZXBlYXRlZEFjdGlvbkFuZEV4dHJhY3RQb3NpdGlvbnMoXG5cdFx0XHR0ZXh0LFxuXHRcdFx0bmV3IFBvc2l0aW9uKDEsIDEpLFxuXHRcdFx0ZWQgPT4gZGVsZXRlV29yZFJpZ2h0KGVkKSxcblx0XHRcdGVkID0+IG5ldyBQb3NpdGlvbigxLCB0ZXh0Lmxlbmd0aCAtIGVkLmdldFZhbHVlKCkubGVuZ3RoICsgMSksXG5cdFx0XHRlZCA9PiBlZC5nZXRWYWx1ZSgpLmxlbmd0aCA9PT0gMFxuXHRcdCk7XG5cdFx0Y29uc3QgYWN0dWFsID0gc2VyaWFsaXplUGlwZVBvc2l0aW9ucyh0ZXh0LCBhY3R1YWxTdG9wcyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIEVYUEVDVEVEKTtcblx0fSk7XG5cblx0dGVzdCgnZGVsZXRlV29yZFJpZ2h0IC0gaXNzdWUgIzM4ODInLCAoKSA9PiB7XG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKFtcblx0XHRcdCdwdWJsaWMgdm9pZCBBZGQoIGludCB4LCcsXG5cdFx0XHQnICAgICAgICAgICAgICAgICBpbnQgeSApJ1xuXHRcdF0sIHt9LCAoZWRpdG9yLCBfKSA9PiB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpITtcblx0XHRcdGVkaXRvci5zZXRQb3NpdGlvbihuZXcgUG9zaXRpb24oMSwgMjQpKTtcblx0XHRcdGRlbGV0ZVdvcmRSaWdodChlZGl0b3IpOyBhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICdwdWJsaWMgdm9pZCBBZGQoIGludCB4LGludCB5ICknLCAnMDAxJyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0ZVdvcmRTdGFydFJpZ2h0IC0gaXNzdWUgIzM4ODInLCAoKSA9PiB7XG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKFtcblx0XHRcdCdwdWJsaWMgdm9pZCBBZGQoIGludCB4LCcsXG5cdFx0XHQnICAgICAgICAgICAgICAgICBpbnQgeSApJ1xuXHRcdF0sIHt9LCAoZWRpdG9yLCBfKSA9PiB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpITtcblx0XHRcdGVkaXRvci5zZXRQb3NpdGlvbihuZXcgUG9zaXRpb24oMSwgMjQpKTtcblx0XHRcdGRlbGV0ZVdvcmRTdGFydFJpZ2h0KGVkaXRvcik7IGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ3B1YmxpYyB2b2lkIEFkZCggaW50IHgsaW50IHkgKScsICcwMDEnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnZGVsZXRlV29yZEVuZFJpZ2h0IC0gaXNzdWUgIzM4ODInLCAoKSA9PiB7XG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKFtcblx0XHRcdCdwdWJsaWMgdm9pZCBBZGQoIGludCB4LCcsXG5cdFx0XHQnICAgICAgICAgICAgICAgICBpbnQgeSApJ1xuXHRcdF0sIHt9LCAoZWRpdG9yLCBfKSA9PiB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpITtcblx0XHRcdGVkaXRvci5zZXRQb3NpdGlvbihuZXcgUG9zaXRpb24oMSwgMjQpKTtcblx0XHRcdGRlbGV0ZVdvcmRFbmRSaWdodChlZGl0b3IpOyBhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICdwdWJsaWMgdm9pZCBBZGQoIGludCB4LGludCB5ICknLCAnMDAxJyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0ZVdvcmRTdGFydFJpZ2h0JywgKCkgPT4ge1xuXHRcdGNvbnN0IEVYUEVDVEVEID0gJyAgIHwvKiB8SnVzdCB8c29tZSB8dGV4dCB8YXwrPSB8MyB8K3w1fC18MyB8Ki8gIHwnO1xuXHRcdGNvbnN0IFt0ZXh0LF0gPSBkZXNlcmlhbGl6ZVBpcGVQb3NpdGlvbnMoRVhQRUNURUQpO1xuXHRcdGNvbnN0IGFjdHVhbFN0b3BzID0gdGVzdFJlcGVhdGVkQWN0aW9uQW5kRXh0cmFjdFBvc2l0aW9ucyhcblx0XHRcdHRleHQsXG5cdFx0XHRuZXcgUG9zaXRpb24oMSwgMSksXG5cdFx0XHRlZCA9PiBkZWxldGVXb3JkU3RhcnRSaWdodChlZCksXG5cdFx0XHRlZCA9PiBuZXcgUG9zaXRpb24oMSwgdGV4dC5sZW5ndGggLSBlZC5nZXRWYWx1ZSgpLmxlbmd0aCArIDEpLFxuXHRcdFx0ZWQgPT4gZWQuZ2V0VmFsdWUoKS5sZW5ndGggPT09IDBcblx0XHQpO1xuXHRcdGNvbnN0IGFjdHVhbCA9IHNlcmlhbGl6ZVBpcGVQb3NpdGlvbnModGV4dCwgYWN0dWFsU3RvcHMpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBFWFBFQ1RFRCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0ZVdvcmRFbmRSaWdodCcsICgpID0+IHtcblx0XHRjb25zdCBFWFBFQ1RFRCA9ICcgICAvKnwgSnVzdHwgc29tZXwgdGV4dHwgYXwrPXwgM3wgK3w1fC18M3wgKi98ICB8Jztcblx0XHRjb25zdCBbdGV4dCxdID0gZGVzZXJpYWxpemVQaXBlUG9zaXRpb25zKEVYUEVDVEVEKTtcblx0XHRjb25zdCBhY3R1YWxTdG9wcyA9IHRlc3RSZXBlYXRlZEFjdGlvbkFuZEV4dHJhY3RQb3NpdGlvbnMoXG5cdFx0XHR0ZXh0LFxuXHRcdFx0bmV3IFBvc2l0aW9uKDEsIDEpLFxuXHRcdFx0ZWQgPT4gZGVsZXRlV29yZEVuZFJpZ2h0KGVkKSxcblx0XHRcdGVkID0+IG5ldyBQb3NpdGlvbigxLCB0ZXh0Lmxlbmd0aCAtIGVkLmdldFZhbHVlKCkubGVuZ3RoICsgMSksXG5cdFx0XHRlZCA9PiBlZC5nZXRWYWx1ZSgpLmxlbmd0aCA9PT0gMFxuXHRcdCk7XG5cdFx0Y29uc3QgYWN0dWFsID0gc2VyaWFsaXplUGlwZVBvc2l0aW9ucyh0ZXh0LCBhY3R1YWxTdG9wcyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIEVYUEVDVEVEKTtcblx0fSk7XG5cblx0dGVzdCgnZGVsZXRlV29yZFJpZ2h0IC0gaXNzdWUgIzM4ODIgKDEpOiBDdHJsK0RlbGV0ZSByZW1vdmluZyBlbnRpcmUgbGluZSB3aGVuIHVzZWQgYXQgdGhlIGVuZCBvZiBsaW5lJywgKCkgPT4ge1xuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihbXG5cdFx0XHQnQSBsaW5lIHdpdGggdGV4dC4nLFxuXHRcdFx0JyAgIEFuZCBhbm90aGVyIG9uZSdcblx0XHRdLCB7fSwgKGVkaXRvciwgXykgPT4ge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKSE7XG5cdFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDE4KSk7XG5cdFx0XHRkZWxldGVXb3JkUmlnaHQoZWRpdG9yKTsgYXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnQSBsaW5lIHdpdGggdGV4dC5BbmQgYW5vdGhlciBvbmUnLCAnMDAxJyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0ZVdvcmRMZWZ0IC0gaXNzdWUgIzM4ODIgKDIpOiBDdHJsK0RlbGV0ZSByZW1vdmluZyBlbnRpcmUgbGluZSB3aGVuIHVzZWQgYXQgdGhlIGVuZCBvZiBsaW5lJywgKCkgPT4ge1xuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihbXG5cdFx0XHQnQSBsaW5lIHdpdGggdGV4dC4nLFxuXHRcdFx0JyAgIEFuZCBhbm90aGVyIG9uZSdcblx0XHRdLCB7fSwgKGVkaXRvciwgXykgPT4ge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKSE7XG5cdFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24obmV3IFBvc2l0aW9uKDIsIDEpKTtcblx0XHRcdGRlbGV0ZVdvcmRMZWZ0KGVkaXRvcik7IGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ0EgbGluZSB3aXRoIHRleHQuICAgQW5kIGFub3RoZXIgb25lJywgJzAwMScpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWxldGVXb3JkTGVmdCAtIGlzc3VlICM5MTg1NTogTWF0Y2hpbmcgKHF1b3RlLCBicmFja2V0LCBwYXJlbikgZG9lc25cXCd0IGdldCBkZWxldGVkIHdoZW4gaGl0dGluZyBDdHJsK0JhY2tzcGFjZScsICgpID0+IHtcblx0XHRjb25zdCBsYW5ndWFnZUlkID0gJ215VGVzdE1vZGUnO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlU2VydmljZS5yZWdpc3Rlckxhbmd1YWdlKHsgaWQ6IGxhbmd1YWdlSWQgfSkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLnJlZ2lzdGVyKGxhbmd1YWdlSWQsIHtcblx0XHRcdGF1dG9DbG9zaW5nUGFpcnM6IFtcblx0XHRcdFx0eyBvcGVuOiAnXFxcIicsIGNsb3NlOiAnXFxcIicgfVxuXHRcdFx0XVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IG1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRlVGV4dE1vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlLCAnYSBcIlwiJywgbGFuZ3VhZ2VJZCkpO1xuXHRcdGNvbnN0IGVkaXRvciA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0ZVRlc3RDb2RlRWRpdG9yKGluc3RhbnRpYXRpb25TZXJ2aWNlLCBtb2RlbCwgeyBhdXRvQ2xvc2luZ0RlbGV0ZTogJ2Fsd2F5cycgfSkpO1xuXG5cdFx0ZWRpdG9yLnNldFBvc2l0aW9uKG5ldyBQb3NpdGlvbigxLCA0KSk7XG5cdFx0ZGVsZXRlV29yZExlZnQoZWRpdG9yKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICdhICcpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWxldGVJbnNpZGVXb3JkIC0gZW1wdHkgbGluZScsICgpID0+IHtcblx0XHR3aXRoVGVzdENvZGVFZGl0b3IoW1xuXHRcdFx0J0xpbmUxJyxcblx0XHRcdCcnLFxuXHRcdFx0J0xpbmUyJ1xuXHRcdF0sIHt9LCAoZWRpdG9yLCBfKSA9PiB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpITtcblx0XHRcdGVkaXRvci5zZXRQb3NpdGlvbihuZXcgUG9zaXRpb24oMiwgMSkpO1xuXHRcdFx0ZGVsZXRlSW5zaWRlV29yZChlZGl0b3IpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICdMaW5lMVxcbkxpbmUyJyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0ZUluc2lkZVdvcmQgLSBpbiB3aGl0ZXNwYWNlIDEnLCAoKSA9PiB7XG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKFtcblx0XHRcdCdKdXN0ICBzb21lIHRleHQuJ1xuXHRcdF0sIHt9LCAoZWRpdG9yLCBfKSA9PiB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpITtcblx0XHRcdGVkaXRvci5zZXRQb3NpdGlvbihuZXcgUG9zaXRpb24oMSwgNikpO1xuXHRcdFx0ZGVsZXRlSW5zaWRlV29yZChlZGl0b3IpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICdKdXN0c29tZSB0ZXh0LicpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWxldGVJbnNpZGVXb3JkIC0gaW4gd2hpdGVzcGFjZSAyJywgKCkgPT4ge1xuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihbXG5cdFx0XHQnSnVzdCAgICAgc29tZSB0ZXh0Lidcblx0XHRdLCB7fSwgKGVkaXRvciwgXykgPT4ge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKSE7XG5cdFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDYpKTtcblx0XHRcdGRlbGV0ZUluc2lkZVdvcmQoZWRpdG9yKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnSnVzdHNvbWUgdGV4dC4nKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnZGVsZXRlSW5zaWRlV29yZCAtIGluIHdoaXRlc3BhY2UgMycsICgpID0+IHtcblx0XHR3aXRoVGVzdENvZGVFZGl0b3IoW1xuXHRcdFx0J0p1c3QgICAgIFwic29tZSB0ZXh0Lidcblx0XHRdLCB7fSwgKGVkaXRvciwgXykgPT4ge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKSE7XG5cdFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDYpKTtcblx0XHRcdGRlbGV0ZUluc2lkZVdvcmQoZWRpdG9yKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnSnVzdFwic29tZSB0ZXh0LicpO1xuXHRcdFx0ZGVsZXRlSW5zaWRlV29yZChlZGl0b3IpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICdcInNvbWUgdGV4dC4nKTtcblx0XHRcdGRlbGV0ZUluc2lkZVdvcmQoZWRpdG9yKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnc29tZSB0ZXh0LicpO1xuXHRcdFx0ZGVsZXRlSW5zaWRlV29yZChlZGl0b3IpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICd0ZXh0LicpO1xuXHRcdFx0ZGVsZXRlSW5zaWRlV29yZChlZGl0b3IpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICcuJyk7XG5cdFx0XHRkZWxldGVJbnNpZGVXb3JkKGVkaXRvcik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJycpO1xuXHRcdFx0ZGVsZXRlSW5zaWRlV29yZChlZGl0b3IpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICcnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnZGVsZXRlSW5zaWRlV29yZCAtIGluIG5vbi13b3JkcycsICgpID0+IHtcblx0XHR3aXRoVGVzdENvZGVFZGl0b3IoW1xuXHRcdFx0J3g9Mys0KzUrNidcblx0XHRdLCB7fSwgKGVkaXRvciwgXykgPT4ge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKSE7XG5cdFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDcpKTtcblx0XHRcdGRlbGV0ZUluc2lkZVdvcmQoZWRpdG9yKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAneD0zKzQ1KzYnKTtcblx0XHRcdGRlbGV0ZUluc2lkZVdvcmQoZWRpdG9yKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAneD0zKys2Jyk7XG5cdFx0XHRkZWxldGVJbnNpZGVXb3JkKGVkaXRvcik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ3g9MzYnKTtcblx0XHRcdGRlbGV0ZUluc2lkZVdvcmQoZWRpdG9yKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAneD0nKTtcblx0XHRcdGRlbGV0ZUluc2lkZVdvcmQoZWRpdG9yKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAneCcpO1xuXHRcdFx0ZGVsZXRlSW5zaWRlV29yZChlZGl0b3IpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICcnKTtcblx0XHRcdGRlbGV0ZUluc2lkZVdvcmQoZWRpdG9yKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnJyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0ZUluc2lkZVdvcmQgLSBpbiB3b3JkcyAxJywgKCkgPT4ge1xuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihbXG5cdFx0XHQnVGhpcyBpcyBpbnRlcmVzdGluZydcblx0XHRdLCB7fSwgKGVkaXRvciwgXykgPT4ge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKSE7XG5cdFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDcpKTtcblx0XHRcdGRlbGV0ZUluc2lkZVdvcmQoZWRpdG9yKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnVGhpcyBpbnRlcmVzdGluZycpO1xuXHRcdFx0ZGVsZXRlSW5zaWRlV29yZChlZGl0b3IpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICdUaGlzJyk7XG5cdFx0XHRkZWxldGVJbnNpZGVXb3JkKGVkaXRvcik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJycpO1xuXHRcdFx0ZGVsZXRlSW5zaWRlV29yZChlZGl0b3IpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICcnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnZGVsZXRlSW5zaWRlV29yZCAtIGluIHdvcmRzIDInLCAoKSA9PiB7XG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKFtcblx0XHRcdCdUaGlzICBpcyAgaW50ZXJlc3RpbmcnXG5cdFx0XSwge30sIChlZGl0b3IsIF8pID0+IHtcblx0XHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCkhO1xuXHRcdFx0ZWRpdG9yLnNldFBvc2l0aW9uKG5ldyBQb3NpdGlvbigxLCA3KSk7XG5cdFx0XHRkZWxldGVJbnNpZGVXb3JkKGVkaXRvcik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ1RoaXMgIGludGVyZXN0aW5nJyk7XG5cdFx0XHRkZWxldGVJbnNpZGVXb3JkKGVkaXRvcik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ1RoaXMnKTtcblx0XHRcdGRlbGV0ZUluc2lkZVdvcmQoZWRpdG9yKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnJyk7XG5cdFx0XHRkZWxldGVJbnNpZGVXb3JkKGVkaXRvcik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJycpO1xuXHRcdH0pO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsMkJBQTJCO0FBR3BDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsaUJBQWlCO0FBQzFC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
