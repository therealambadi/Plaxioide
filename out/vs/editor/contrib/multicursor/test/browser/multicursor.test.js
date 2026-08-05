import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { Selection } from "../../../../common/core/selection.js";
import { Handler } from "../../../../common/editorCommon.js";
import { EndOfLineSequence } from "../../../../common/model.js";
import { CommonFindController } from "../../../find/browser/findController.js";
import { AddSelectionToNextFindMatchAction, InsertCursorAbove, InsertCursorBelow, MultiCursorSelectionController, SelectHighlightsAction } from "../../browser/multicursor.js";
import { withTestCodeEditor } from "../../../../test/browser/testCodeEditor.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { IStorageService, InMemoryStorageService } from "../../../../../platform/storage/common/storage.js";
suite("Multicursor", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("issue #26393: Multiple cursors + Word wrap", () => {
    withTestCodeEditor([
      "a".repeat(20),
      "a".repeat(20)
    ], { wordWrap: "wordWrapColumn", wordWrapColumn: 10 }, (editor, viewModel) => {
      const addCursorDownAction = new InsertCursorBelow();
      addCursorDownAction.run(null, editor, {});
      assert.strictEqual(viewModel.getCursorStates().length, 2);
      assert.strictEqual(viewModel.getCursorStates()[0].viewState.position.lineNumber, 1);
      assert.strictEqual(viewModel.getCursorStates()[1].viewState.position.lineNumber, 3);
      editor.setPosition({ lineNumber: 4, column: 1 });
      const addCursorUpAction = new InsertCursorAbove();
      addCursorUpAction.run(null, editor, {});
      assert.strictEqual(viewModel.getCursorStates().length, 2);
      assert.strictEqual(viewModel.getCursorStates()[0].viewState.position.lineNumber, 4);
      assert.strictEqual(viewModel.getCursorStates()[1].viewState.position.lineNumber, 2);
    });
  });
  test("issue #2205: Multi-cursor pastes in reverse order", () => {
    withTestCodeEditor([
      "abc",
      "def"
    ], {}, (editor, viewModel) => {
      const addCursorUpAction = new InsertCursorAbove();
      editor.setSelection(new Selection(2, 1, 2, 1));
      addCursorUpAction.run(null, editor, {});
      assert.strictEqual(viewModel.getSelections().length, 2);
      editor.trigger("test", Handler.Paste, {
        text: "1\n2",
        multicursorText: [
          "1",
          "2"
        ]
      });
      assert.strictEqual(editor.getModel().getLineContent(1), "1abc");
      assert.strictEqual(editor.getModel().getLineContent(2), "2def");
    });
  });
  test("issue #1336: Insert cursor below on last line adds a cursor to the end of the current line", () => {
    withTestCodeEditor([
      "abc"
    ], {}, (editor, viewModel) => {
      const addCursorDownAction = new InsertCursorBelow();
      addCursorDownAction.run(null, editor, {});
      assert.strictEqual(viewModel.getSelections().length, 1);
    });
  });
});
function fromRange(rng) {
  return [rng.startLineNumber, rng.startColumn, rng.endLineNumber, rng.endColumn];
}
suite("Multicursor selection", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  const serviceCollection = new ServiceCollection();
  serviceCollection.set(IStorageService, new InMemoryStorageService());
  test("issue #8817: Cursor position changes when you cancel multicursor", () => {
    withTestCodeEditor([
      "var x = (3 * 5)",
      "var y = (3 * 5)",
      "var z = (3 * 5)"
    ], { serviceCollection }, (editor) => {
      const findController = editor.registerAndInstantiateContribution(CommonFindController.ID, CommonFindController);
      const multiCursorSelectController = editor.registerAndInstantiateContribution(MultiCursorSelectionController.ID, MultiCursorSelectionController);
      const selectHighlightsAction = new SelectHighlightsAction();
      editor.setSelection(new Selection(2, 9, 2, 16));
      selectHighlightsAction.run(null, editor);
      assert.deepStrictEqual(editor.getSelections().map(fromRange), [
        [2, 9, 2, 16],
        [1, 9, 1, 16],
        [3, 9, 3, 16]
      ]);
      editor.trigger("test", "removeSecondaryCursors", null);
      assert.deepStrictEqual(fromRange(editor.getSelection()), [2, 9, 2, 16]);
      multiCursorSelectController.dispose();
      findController.dispose();
    });
  });
  test('issue #5400: "Select All Occurrences of Find Match" does not select all if find uses regex', () => {
    withTestCodeEditor([
      "something",
      "someething",
      "someeething",
      "nothing"
    ], { serviceCollection }, (editor) => {
      const findController = editor.registerAndInstantiateContribution(CommonFindController.ID, CommonFindController);
      const multiCursorSelectController = editor.registerAndInstantiateContribution(MultiCursorSelectionController.ID, MultiCursorSelectionController);
      const selectHighlightsAction = new SelectHighlightsAction();
      editor.setSelection(new Selection(1, 1, 1, 1));
      findController.getState().change({ searchString: "some+thing", isRegex: true, isRevealed: true }, false);
      selectHighlightsAction.run(null, editor);
      assert.deepStrictEqual(editor.getSelections().map(fromRange), [
        [1, 1, 1, 10],
        [2, 1, 2, 11],
        [3, 1, 3, 12]
      ]);
      assert.strictEqual(findController.getState().searchString, "some+thing");
      multiCursorSelectController.dispose();
      findController.dispose();
    });
  });
  test("AddSelectionToNextFindMatchAction can work with multiline", () => {
    withTestCodeEditor([
      "",
      "qwe",
      "rty",
      "",
      "qwe",
      "",
      "rty",
      "qwe",
      "rty"
    ], { serviceCollection }, (editor) => {
      const findController = editor.registerAndInstantiateContribution(CommonFindController.ID, CommonFindController);
      const multiCursorSelectController = editor.registerAndInstantiateContribution(MultiCursorSelectionController.ID, MultiCursorSelectionController);
      const addSelectionToNextFindMatch = new AddSelectionToNextFindMatchAction();
      editor.setSelection(new Selection(2, 1, 3, 4));
      addSelectionToNextFindMatch.run(null, editor);
      assert.deepStrictEqual(editor.getSelections().map(fromRange), [
        [2, 1, 3, 4],
        [8, 1, 9, 4]
      ]);
      editor.trigger("test", "removeSecondaryCursors", null);
      assert.deepStrictEqual(fromRange(editor.getSelection()), [2, 1, 3, 4]);
      multiCursorSelectController.dispose();
      findController.dispose();
    });
  });
  test("issue #6661: AddSelectionToNextFindMatchAction can work with touching ranges", () => {
    withTestCodeEditor([
      "abcabc",
      "abc",
      "abcabc"
    ], { serviceCollection }, (editor) => {
      const findController = editor.registerAndInstantiateContribution(CommonFindController.ID, CommonFindController);
      const multiCursorSelectController = editor.registerAndInstantiateContribution(MultiCursorSelectionController.ID, MultiCursorSelectionController);
      const addSelectionToNextFindMatch = new AddSelectionToNextFindMatchAction();
      editor.setSelection(new Selection(1, 1, 1, 4));
      addSelectionToNextFindMatch.run(null, editor);
      assert.deepStrictEqual(editor.getSelections().map(fromRange), [
        [1, 1, 1, 4],
        [1, 4, 1, 7]
      ]);
      addSelectionToNextFindMatch.run(null, editor);
      addSelectionToNextFindMatch.run(null, editor);
      addSelectionToNextFindMatch.run(null, editor);
      assert.deepStrictEqual(editor.getSelections().map(fromRange), [
        [1, 1, 1, 4],
        [1, 4, 1, 7],
        [2, 1, 2, 4],
        [3, 1, 3, 4],
        [3, 4, 3, 7]
      ]);
      editor.trigger("test", Handler.Type, { text: "z" });
      assert.deepStrictEqual(editor.getSelections().map(fromRange), [
        [1, 2, 1, 2],
        [1, 3, 1, 3],
        [2, 2, 2, 2],
        [3, 2, 3, 2],
        [3, 3, 3, 3]
      ]);
      assert.strictEqual(editor.getValue(), [
        "zz",
        "z",
        "zz"
      ].join("\n"));
      multiCursorSelectController.dispose();
      findController.dispose();
    });
  });
  test("issue #23541: Multiline Ctrl+D does not work in CRLF files", () => {
    withTestCodeEditor([
      "",
      "qwe",
      "rty",
      "",
      "qwe",
      "",
      "rty",
      "qwe",
      "rty"
    ], { serviceCollection }, (editor) => {
      editor.getModel().setEOL(EndOfLineSequence.CRLF);
      const findController = editor.registerAndInstantiateContribution(CommonFindController.ID, CommonFindController);
      const multiCursorSelectController = editor.registerAndInstantiateContribution(MultiCursorSelectionController.ID, MultiCursorSelectionController);
      const addSelectionToNextFindMatch = new AddSelectionToNextFindMatchAction();
      editor.setSelection(new Selection(2, 1, 3, 4));
      addSelectionToNextFindMatch.run(null, editor);
      assert.deepStrictEqual(editor.getSelections().map(fromRange), [
        [2, 1, 3, 4],
        [8, 1, 9, 4]
      ]);
      editor.trigger("test", "removeSecondaryCursors", null);
      assert.deepStrictEqual(fromRange(editor.getSelection()), [2, 1, 3, 4]);
      multiCursorSelectController.dispose();
      findController.dispose();
    });
  });
  function testMulticursor(text, callback) {
    withTestCodeEditor(text, { serviceCollection }, (editor) => {
      const findController = editor.registerAndInstantiateContribution(CommonFindController.ID, CommonFindController);
      const multiCursorSelectController = editor.registerAndInstantiateContribution(MultiCursorSelectionController.ID, MultiCursorSelectionController);
      callback(editor, findController);
      multiCursorSelectController.dispose();
      findController.dispose();
    });
  }
  function testAddSelectionToNextFindMatchAction(text, callback) {
    testMulticursor(text, (editor, findController) => {
      const action = new AddSelectionToNextFindMatchAction();
      callback(editor, action, findController);
    });
  }
  test("AddSelectionToNextFindMatchAction starting with single collapsed selection", () => {
    const text = [
      "abc pizza",
      "abc house",
      "abc bar"
    ];
    testAddSelectionToNextFindMatchAction(text, (editor, action, findController) => {
      editor.setSelections([
        new Selection(1, 2, 1, 2)
      ]);
      action.run(null, editor);
      assert.deepStrictEqual(editor.getSelections(), [
        new Selection(1, 1, 1, 4)
      ]);
      action.run(null, editor);
      assert.deepStrictEqual(editor.getSelections(), [
        new Selection(1, 1, 1, 4),
        new Selection(2, 1, 2, 4)
      ]);
      action.run(null, editor);
      assert.deepStrictEqual(editor.getSelections(), [
        new Selection(1, 1, 1, 4),
        new Selection(2, 1, 2, 4),
        new Selection(3, 1, 3, 4)
      ]);
      action.run(null, editor);
      assert.deepStrictEqual(editor.getSelections(), [
        new Selection(1, 1, 1, 4),
        new Selection(2, 1, 2, 4),
        new Selection(3, 1, 3, 4)
      ]);
    });
  });
  test("AddSelectionToNextFindMatchAction starting with two selections, one being collapsed 1)", () => {
    const text = [
      "abc pizza",
      "abc house",
      "abc bar"
    ];
    testAddSelectionToNextFindMatchAction(text, (editor, action, findController) => {
      editor.setSelections([
        new Selection(1, 1, 1, 4),
        new Selection(2, 2, 2, 2)
      ]);
      action.run(null, editor);
      assert.deepStrictEqual(editor.getSelections(), [
        new Selection(1, 1, 1, 4),
        new Selection(2, 1, 2, 4)
      ]);
      action.run(null, editor);
      assert.deepStrictEqual(editor.getSelections(), [
        new Selection(1, 1, 1, 4),
        new Selection(2, 1, 2, 4),
        new Selection(3, 1, 3, 4)
      ]);
      action.run(null, editor);
      assert.deepStrictEqual(editor.getSelections(), [
        new Selection(1, 1, 1, 4),
        new Selection(2, 1, 2, 4),
        new Selection(3, 1, 3, 4)
      ]);
    });
  });
  test("AddSelectionToNextFindMatchAction starting with two selections, one being collapsed 2)", () => {
    const text = [
      "abc pizza",
      "abc house",
      "abc bar"
    ];
    testAddSelectionToNextFindMatchAction(text, (editor, action, findController) => {
      editor.setSelections([
        new Selection(1, 2, 1, 2),
        new Selection(2, 1, 2, 4)
      ]);
      action.run(null, editor);
      assert.deepStrictEqual(editor.getSelections(), [
        new Selection(1, 1, 1, 4),
        new Selection(2, 1, 2, 4)
      ]);
      action.run(null, editor);
      assert.deepStrictEqual(editor.getSelections(), [
        new Selection(1, 1, 1, 4),
        new Selection(2, 1, 2, 4),
        new Selection(3, 1, 3, 4)
      ]);
      action.run(null, editor);
      assert.deepStrictEqual(editor.getSelections(), [
        new Selection(1, 1, 1, 4),
        new Selection(2, 1, 2, 4),
        new Selection(3, 1, 3, 4)
      ]);
    });
  });
  test("AddSelectionToNextFindMatchAction starting with all collapsed selections", () => {
    const text = [
      "abc pizza",
      "abc house",
      "abc bar"
    ];
    testAddSelectionToNextFindMatchAction(text, (editor, action, findController) => {
      editor.setSelections([
        new Selection(1, 2, 1, 2),
        new Selection(2, 2, 2, 2),
        new Selection(3, 1, 3, 1)
      ]);
      action.run(null, editor);
      assert.deepStrictEqual(editor.getSelections(), [
        new Selection(1, 1, 1, 4),
        new Selection(2, 1, 2, 4),
        new Selection(3, 1, 3, 4)
      ]);
      action.run(null, editor);
      assert.deepStrictEqual(editor.getSelections(), [
        new Selection(1, 1, 1, 4),
        new Selection(2, 1, 2, 4),
        new Selection(3, 1, 3, 4)
      ]);
    });
  });
  test("AddSelectionToNextFindMatchAction starting with all collapsed selections on different words", () => {
    const text = [
      "abc pizza",
      "abc house",
      "abc bar"
    ];
    testAddSelectionToNextFindMatchAction(text, (editor, action, findController) => {
      editor.setSelections([
        new Selection(1, 6, 1, 6),
        new Selection(2, 6, 2, 6),
        new Selection(3, 6, 3, 6)
      ]);
      action.run(null, editor);
      assert.deepStrictEqual(editor.getSelections(), [
        new Selection(1, 5, 1, 10),
        new Selection(2, 5, 2, 10),
        new Selection(3, 5, 3, 8)
      ]);
      action.run(null, editor);
      assert.deepStrictEqual(editor.getSelections(), [
        new Selection(1, 5, 1, 10),
        new Selection(2, 5, 2, 10),
        new Selection(3, 5, 3, 8)
      ]);
    });
  });
  test("issue #20651: AddSelectionToNextFindMatchAction case insensitive", () => {
    const text = [
      "test",
      "testte",
      "Test",
      "testte",
      "test"
    ];
    testAddSelectionToNextFindMatchAction(text, (editor, action, findController) => {
      editor.setSelections([
        new Selection(1, 1, 1, 5)
      ]);
      action.run(null, editor);
      assert.deepStrictEqual(editor.getSelections(), [
        new Selection(1, 1, 1, 5),
        new Selection(2, 1, 2, 5)
      ]);
      action.run(null, editor);
      assert.deepStrictEqual(editor.getSelections(), [
        new Selection(1, 1, 1, 5),
        new Selection(2, 1, 2, 5),
        new Selection(3, 1, 3, 5)
      ]);
      action.run(null, editor);
      assert.deepStrictEqual(editor.getSelections(), [
        new Selection(1, 1, 1, 5),
        new Selection(2, 1, 2, 5),
        new Selection(3, 1, 3, 5),
        new Selection(4, 1, 4, 5)
      ]);
      action.run(null, editor);
      assert.deepStrictEqual(editor.getSelections(), [
        new Selection(1, 1, 1, 5),
        new Selection(2, 1, 2, 5),
        new Selection(3, 1, 3, 5),
        new Selection(4, 1, 4, 5),
        new Selection(5, 1, 5, 5)
      ]);
      action.run(null, editor);
      assert.deepStrictEqual(editor.getSelections(), [
        new Selection(1, 1, 1, 5),
        new Selection(2, 1, 2, 5),
        new Selection(3, 1, 3, 5),
        new Selection(4, 1, 4, 5),
        new Selection(5, 1, 5, 5)
      ]);
    });
  });
  suite("Find state disassociation", () => {
    const text = [
      "app",
      "apples",
      "whatsapp",
      "app",
      "App",
      " app"
    ];
    test("enters mode", () => {
      testAddSelectionToNextFindMatchAction(text, (editor, action, findController) => {
        editor.setSelections([
          new Selection(1, 2, 1, 2)
        ]);
        action.run(null, editor);
        assert.deepStrictEqual(editor.getSelections(), [
          new Selection(1, 1, 1, 4)
        ]);
        action.run(null, editor);
        assert.deepStrictEqual(editor.getSelections(), [
          new Selection(1, 1, 1, 4),
          new Selection(4, 1, 4, 4)
        ]);
        action.run(null, editor);
        assert.deepStrictEqual(editor.getSelections(), [
          new Selection(1, 1, 1, 4),
          new Selection(4, 1, 4, 4),
          new Selection(6, 2, 6, 5)
        ]);
      });
    });
    test("leaves mode when selection changes", () => {
      testAddSelectionToNextFindMatchAction(text, (editor, action, findController) => {
        editor.setSelections([
          new Selection(1, 2, 1, 2)
        ]);
        action.run(null, editor);
        assert.deepStrictEqual(editor.getSelections(), [
          new Selection(1, 1, 1, 4)
        ]);
        action.run(null, editor);
        assert.deepStrictEqual(editor.getSelections(), [
          new Selection(1, 1, 1, 4),
          new Selection(4, 1, 4, 4)
        ]);
        editor.setSelections([
          new Selection(1, 1, 1, 4)
        ]);
        action.run(null, editor);
        assert.deepStrictEqual(editor.getSelections(), [
          new Selection(1, 1, 1, 4),
          new Selection(2, 1, 2, 4)
        ]);
      });
    });
    test("Select Highlights respects mode ", () => {
      testMulticursor(text, (editor, findController) => {
        const action = new SelectHighlightsAction();
        editor.setSelections([
          new Selection(1, 2, 1, 2)
        ]);
        action.run(null, editor);
        assert.deepStrictEqual(editor.getSelections(), [
          new Selection(1, 1, 1, 4),
          new Selection(4, 1, 4, 4),
          new Selection(6, 2, 6, 5)
        ]);
        action.run(null, editor);
        assert.deepStrictEqual(editor.getSelections(), [
          new Selection(1, 1, 1, 4),
          new Selection(4, 1, 4, 4),
          new Selection(6, 2, 6, 5)
        ]);
      });
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9tdWx0aWN1cnNvci90ZXN0L2Jyb3dzZXIvbXVsdGljdXJzb3IudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IEhhbmRsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCB7IEVuZE9mTGluZVNlcXVlbmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IENvbW1vbkZpbmRDb250cm9sbGVyIH0gZnJvbSAnLi4vLi4vLi4vZmluZC9icm93c2VyL2ZpbmRDb250cm9sbGVyLmpzJztcbmltcG9ydCB7IEFkZFNlbGVjdGlvblRvTmV4dEZpbmRNYXRjaEFjdGlvbiwgSW5zZXJ0Q3Vyc29yQWJvdmUsIEluc2VydEN1cnNvckJlbG93LCBNdWx0aUN1cnNvclNlbGVjdGlvbkNvbnRyb2xsZXIsIFNlbGVjdEhpZ2hsaWdodHNBY3Rpb24gfSBmcm9tICcuLi8uLi9icm93c2VyL211bHRpY3Vyc29yLmpzJztcbmltcG9ydCB7IElUZXN0Q29kZUVkaXRvciwgd2l0aFRlc3RDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9icm93c2VyL3Rlc3RDb2RlRWRpdG9yLmpzJztcbmltcG9ydCB7IFNlcnZpY2VDb2xsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vc2VydmljZUNvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBJbk1lbW9yeVN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5cbnN1aXRlKCdNdWx0aWN1cnNvcicsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdpc3N1ZSAjMjYzOTM6IE11bHRpcGxlIGN1cnNvcnMgKyBXb3JkIHdyYXAnLCAoKSA9PiB7XG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKFtcblx0XHRcdCdhJy5yZXBlYXQoMjApLFxuXHRcdFx0J2EnLnJlcGVhdCgyMCksXG5cdFx0XSwgeyB3b3JkV3JhcDogJ3dvcmRXcmFwQ29sdW1uJywgd29yZFdyYXBDb2x1bW46IDEwIH0sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0Y29uc3QgYWRkQ3Vyc29yRG93bkFjdGlvbiA9IG5ldyBJbnNlcnRDdXJzb3JCZWxvdygpO1xuXHRcdFx0YWRkQ3Vyc29yRG93bkFjdGlvbi5ydW4obnVsbCEsIGVkaXRvciwge30pO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlld01vZGVsLmdldEN1cnNvclN0YXRlcygpLmxlbmd0aCwgMik7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0Q3Vyc29yU3RhdGVzKClbMF0udmlld1N0YXRlLnBvc2l0aW9uLmxpbmVOdW1iZXIsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXdNb2RlbC5nZXRDdXJzb3JTdGF0ZXMoKVsxXS52aWV3U3RhdGUucG9zaXRpb24ubGluZU51bWJlciwgMyk7XG5cblx0XHRcdGVkaXRvci5zZXRQb3NpdGlvbih7IGxpbmVOdW1iZXI6IDQsIGNvbHVtbjogMSB9KTtcblx0XHRcdGNvbnN0IGFkZEN1cnNvclVwQWN0aW9uID0gbmV3IEluc2VydEN1cnNvckFib3ZlKCk7XG5cdFx0XHRhZGRDdXJzb3JVcEFjdGlvbi5ydW4obnVsbCEsIGVkaXRvciwge30pO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlld01vZGVsLmdldEN1cnNvclN0YXRlcygpLmxlbmd0aCwgMik7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0Q3Vyc29yU3RhdGVzKClbMF0udmlld1N0YXRlLnBvc2l0aW9uLmxpbmVOdW1iZXIsIDQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXdNb2RlbC5nZXRDdXJzb3JTdGF0ZXMoKVsxXS52aWV3U3RhdGUucG9zaXRpb24ubGluZU51bWJlciwgMik7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMyMjA1OiBNdWx0aS1jdXJzb3IgcGFzdGVzIGluIHJldmVyc2Ugb3JkZXInLCAoKSA9PiB7XG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKFtcblx0XHRcdCdhYmMnLFxuXHRcdFx0J2RlZidcblx0XHRdLCB7fSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRjb25zdCBhZGRDdXJzb3JVcEFjdGlvbiA9IG5ldyBJbnNlcnRDdXJzb3JBYm92ZSgpO1xuXG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMiwgMSwgMiwgMSkpO1xuXHRcdFx0YWRkQ3Vyc29yVXBBY3Rpb24ucnVuKG51bGwhLCBlZGl0b3IsIHt9KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0U2VsZWN0aW9ucygpLmxlbmd0aCwgMik7XG5cblx0XHRcdGVkaXRvci50cmlnZ2VyKCd0ZXN0JywgSGFuZGxlci5QYXN0ZSwge1xuXHRcdFx0XHR0ZXh0OiAnMVxcbjInLFxuXHRcdFx0XHRtdWx0aWN1cnNvclRleHQ6IFtcblx0XHRcdFx0XHQnMScsXG5cdFx0XHRcdFx0JzInXG5cdFx0XHRcdF1cblx0XHRcdH0pO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDEpLCAnMWFiYycpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRNb2RlbCgpIS5nZXRMaW5lQ29udGVudCgyKSwgJzJkZWYnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzEzMzY6IEluc2VydCBjdXJzb3IgYmVsb3cgb24gbGFzdCBsaW5lIGFkZHMgYSBjdXJzb3IgdG8gdGhlIGVuZCBvZiB0aGUgY3VycmVudCBsaW5lJywgKCkgPT4ge1xuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihbXG5cdFx0XHQnYWJjJ1xuXHRcdF0sIHt9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdGNvbnN0IGFkZEN1cnNvckRvd25BY3Rpb24gPSBuZXcgSW5zZXJ0Q3Vyc29yQmVsb3coKTtcblx0XHRcdGFkZEN1cnNvckRvd25BY3Rpb24ucnVuKG51bGwhLCBlZGl0b3IsIHt9KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0U2VsZWN0aW9ucygpLmxlbmd0aCwgMSk7XG5cdFx0fSk7XG5cdH0pO1xuXG59KTtcblxuZnVuY3Rpb24gZnJvbVJhbmdlKHJuZzogUmFuZ2UpOiBudW1iZXJbXSB7XG5cdHJldHVybiBbcm5nLnN0YXJ0TGluZU51bWJlciwgcm5nLnN0YXJ0Q29sdW1uLCBybmcuZW5kTGluZU51bWJlciwgcm5nLmVuZENvbHVtbl07XG59XG5cbnN1aXRlKCdNdWx0aWN1cnNvciBzZWxlY3Rpb24nLCAoKSA9PiB7XG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGNvbnN0IHNlcnZpY2VDb2xsZWN0aW9uID0gbmV3IFNlcnZpY2VDb2xsZWN0aW9uKCk7XG5cdHNlcnZpY2VDb2xsZWN0aW9uLnNldChJU3RvcmFnZVNlcnZpY2UsIG5ldyBJbk1lbW9yeVN0b3JhZ2VTZXJ2aWNlKCkpO1xuXG5cdHRlc3QoJ2lzc3VlICM4ODE3OiBDdXJzb3IgcG9zaXRpb24gY2hhbmdlcyB3aGVuIHlvdSBjYW5jZWwgbXVsdGljdXJzb3InLCAoKSA9PiB7XG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKFtcblx0XHRcdCd2YXIgeCA9ICgzICogNSknLFxuXHRcdFx0J3ZhciB5ID0gKDMgKiA1KScsXG5cdFx0XHQndmFyIHogPSAoMyAqIDUpJyxcblx0XHRdLCB7IHNlcnZpY2VDb2xsZWN0aW9uOiBzZXJ2aWNlQ29sbGVjdGlvbiB9LCAoZWRpdG9yKSA9PiB7XG5cblx0XHRcdGNvbnN0IGZpbmRDb250cm9sbGVyID0gZWRpdG9yLnJlZ2lzdGVyQW5kSW5zdGFudGlhdGVDb250cmlidXRpb24oQ29tbW9uRmluZENvbnRyb2xsZXIuSUQsIENvbW1vbkZpbmRDb250cm9sbGVyKTtcblx0XHRcdGNvbnN0IG11bHRpQ3Vyc29yU2VsZWN0Q29udHJvbGxlciA9IGVkaXRvci5yZWdpc3RlckFuZEluc3RhbnRpYXRlQ29udHJpYnV0aW9uKE11bHRpQ3Vyc29yU2VsZWN0aW9uQ29udHJvbGxlci5JRCwgTXVsdGlDdXJzb3JTZWxlY3Rpb25Db250cm9sbGVyKTtcblx0XHRcdGNvbnN0IHNlbGVjdEhpZ2hsaWdodHNBY3Rpb24gPSBuZXcgU2VsZWN0SGlnaGxpZ2h0c0FjdGlvbigpO1xuXG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMiwgOSwgMiwgMTYpKTtcblxuXHRcdFx0c2VsZWN0SGlnaGxpZ2h0c0FjdGlvbi5ydW4obnVsbCEsIGVkaXRvcik7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCkhLm1hcChmcm9tUmFuZ2UpLCBbXG5cdFx0XHRcdFsyLCA5LCAyLCAxNl0sXG5cdFx0XHRcdFsxLCA5LCAxLCAxNl0sXG5cdFx0XHRcdFszLCA5LCAzLCAxNl0sXG5cdFx0XHRdKTtcblxuXHRcdFx0ZWRpdG9yLnRyaWdnZXIoJ3Rlc3QnLCAncmVtb3ZlU2Vjb25kYXJ5Q3Vyc29ycycsIG51bGwpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZyb21SYW5nZShlZGl0b3IuZ2V0U2VsZWN0aW9uKCkhKSwgWzIsIDksIDIsIDE2XSk7XG5cblx0XHRcdG11bHRpQ3Vyc29yU2VsZWN0Q29udHJvbGxlci5kaXNwb3NlKCk7XG5cdFx0XHRmaW5kQ29udHJvbGxlci5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICM1NDAwOiBcIlNlbGVjdCBBbGwgT2NjdXJyZW5jZXMgb2YgRmluZCBNYXRjaFwiIGRvZXMgbm90IHNlbGVjdCBhbGwgaWYgZmluZCB1c2VzIHJlZ2V4JywgKCkgPT4ge1xuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihbXG5cdFx0XHQnc29tZXRoaW5nJyxcblx0XHRcdCdzb21lZXRoaW5nJyxcblx0XHRcdCdzb21lZWV0aGluZycsXG5cdFx0XHQnbm90aGluZydcblx0XHRdLCB7IHNlcnZpY2VDb2xsZWN0aW9uOiBzZXJ2aWNlQ29sbGVjdGlvbiB9LCAoZWRpdG9yKSA9PiB7XG5cblx0XHRcdGNvbnN0IGZpbmRDb250cm9sbGVyID0gZWRpdG9yLnJlZ2lzdGVyQW5kSW5zdGFudGlhdGVDb250cmlidXRpb24oQ29tbW9uRmluZENvbnRyb2xsZXIuSUQsIENvbW1vbkZpbmRDb250cm9sbGVyKTtcblx0XHRcdGNvbnN0IG11bHRpQ3Vyc29yU2VsZWN0Q29udHJvbGxlciA9IGVkaXRvci5yZWdpc3RlckFuZEluc3RhbnRpYXRlQ29udHJpYnV0aW9uKE11bHRpQ3Vyc29yU2VsZWN0aW9uQ29udHJvbGxlci5JRCwgTXVsdGlDdXJzb3JTZWxlY3Rpb25Db250cm9sbGVyKTtcblx0XHRcdGNvbnN0IHNlbGVjdEhpZ2hsaWdodHNBY3Rpb24gPSBuZXcgU2VsZWN0SGlnaGxpZ2h0c0FjdGlvbigpO1xuXG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSkpO1xuXHRcdFx0ZmluZENvbnRyb2xsZXIuZ2V0U3RhdGUoKS5jaGFuZ2UoeyBzZWFyY2hTdHJpbmc6ICdzb21lK3RoaW5nJywgaXNSZWdleDogdHJ1ZSwgaXNSZXZlYWxlZDogdHJ1ZSB9LCBmYWxzZSk7XG5cblx0XHRcdHNlbGVjdEhpZ2hsaWdodHNBY3Rpb24ucnVuKG51bGwhLCBlZGl0b3IpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9ucygpIS5tYXAoZnJvbVJhbmdlKSwgW1xuXHRcdFx0XHRbMSwgMSwgMSwgMTBdLFxuXHRcdFx0XHRbMiwgMSwgMiwgMTFdLFxuXHRcdFx0XHRbMywgMSwgMywgMTJdLFxuXHRcdFx0XSk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kQ29udHJvbGxlci5nZXRTdGF0ZSgpLnNlYXJjaFN0cmluZywgJ3NvbWUrdGhpbmcnKTtcblxuXHRcdFx0bXVsdGlDdXJzb3JTZWxlY3RDb250cm9sbGVyLmRpc3Bvc2UoKTtcblx0XHRcdGZpbmRDb250cm9sbGVyLmRpc3Bvc2UoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnQWRkU2VsZWN0aW9uVG9OZXh0RmluZE1hdGNoQWN0aW9uIGNhbiB3b3JrIHdpdGggbXVsdGlsaW5lJywgKCkgPT4ge1xuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihbXG5cdFx0XHQnJyxcblx0XHRcdCdxd2UnLFxuXHRcdFx0J3J0eScsXG5cdFx0XHQnJyxcblx0XHRcdCdxd2UnLFxuXHRcdFx0JycsXG5cdFx0XHQncnR5Jyxcblx0XHRcdCdxd2UnLFxuXHRcdFx0J3J0eSdcblx0XHRdLCB7IHNlcnZpY2VDb2xsZWN0aW9uOiBzZXJ2aWNlQ29sbGVjdGlvbiB9LCAoZWRpdG9yKSA9PiB7XG5cblx0XHRcdGNvbnN0IGZpbmRDb250cm9sbGVyID0gZWRpdG9yLnJlZ2lzdGVyQW5kSW5zdGFudGlhdGVDb250cmlidXRpb24oQ29tbW9uRmluZENvbnRyb2xsZXIuSUQsIENvbW1vbkZpbmRDb250cm9sbGVyKTtcblx0XHRcdGNvbnN0IG11bHRpQ3Vyc29yU2VsZWN0Q29udHJvbGxlciA9IGVkaXRvci5yZWdpc3RlckFuZEluc3RhbnRpYXRlQ29udHJpYnV0aW9uKE11bHRpQ3Vyc29yU2VsZWN0aW9uQ29udHJvbGxlci5JRCwgTXVsdGlDdXJzb3JTZWxlY3Rpb25Db250cm9sbGVyKTtcblx0XHRcdGNvbnN0IGFkZFNlbGVjdGlvblRvTmV4dEZpbmRNYXRjaCA9IG5ldyBBZGRTZWxlY3Rpb25Ub05leHRGaW5kTWF0Y2hBY3Rpb24oKTtcblxuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDIsIDEsIDMsIDQpKTtcblxuXHRcdFx0YWRkU2VsZWN0aW9uVG9OZXh0RmluZE1hdGNoLnJ1bihudWxsISwgZWRpdG9yKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSEubWFwKGZyb21SYW5nZSksIFtcblx0XHRcdFx0WzIsIDEsIDMsIDRdLFxuXHRcdFx0XHRbOCwgMSwgOSwgNF1cblx0XHRcdF0pO1xuXG5cdFx0XHRlZGl0b3IudHJpZ2dlcigndGVzdCcsICdyZW1vdmVTZWNvbmRhcnlDdXJzb3JzJywgbnVsbCk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZnJvbVJhbmdlKGVkaXRvci5nZXRTZWxlY3Rpb24oKSEpLCBbMiwgMSwgMywgNF0pO1xuXG5cdFx0XHRtdWx0aUN1cnNvclNlbGVjdENvbnRyb2xsZXIuZGlzcG9zZSgpO1xuXHRcdFx0ZmluZENvbnRyb2xsZXIuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjNjY2MTogQWRkU2VsZWN0aW9uVG9OZXh0RmluZE1hdGNoQWN0aW9uIGNhbiB3b3JrIHdpdGggdG91Y2hpbmcgcmFuZ2VzJywgKCkgPT4ge1xuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihbXG5cdFx0XHQnYWJjYWJjJyxcblx0XHRcdCdhYmMnLFxuXHRcdFx0J2FiY2FiYycsXG5cdFx0XSwgeyBzZXJ2aWNlQ29sbGVjdGlvbjogc2VydmljZUNvbGxlY3Rpb24gfSwgKGVkaXRvcikgPT4ge1xuXG5cdFx0XHRjb25zdCBmaW5kQ29udHJvbGxlciA9IGVkaXRvci5yZWdpc3RlckFuZEluc3RhbnRpYXRlQ29udHJpYnV0aW9uKENvbW1vbkZpbmRDb250cm9sbGVyLklELCBDb21tb25GaW5kQ29udHJvbGxlcik7XG5cdFx0XHRjb25zdCBtdWx0aUN1cnNvclNlbGVjdENvbnRyb2xsZXIgPSBlZGl0b3IucmVnaXN0ZXJBbmRJbnN0YW50aWF0ZUNvbnRyaWJ1dGlvbihNdWx0aUN1cnNvclNlbGVjdGlvbkNvbnRyb2xsZXIuSUQsIE11bHRpQ3Vyc29yU2VsZWN0aW9uQ29udHJvbGxlcik7XG5cdFx0XHRjb25zdCBhZGRTZWxlY3Rpb25Ub05leHRGaW5kTWF0Y2ggPSBuZXcgQWRkU2VsZWN0aW9uVG9OZXh0RmluZE1hdGNoQWN0aW9uKCk7XG5cblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCAxLCAxLCA0KSk7XG5cblx0XHRcdGFkZFNlbGVjdGlvblRvTmV4dEZpbmRNYXRjaC5ydW4obnVsbCEsIGVkaXRvcik7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCkhLm1hcChmcm9tUmFuZ2UpLCBbXG5cdFx0XHRcdFsxLCAxLCAxLCA0XSxcblx0XHRcdFx0WzEsIDQsIDEsIDddXG5cdFx0XHRdKTtcblxuXHRcdFx0YWRkU2VsZWN0aW9uVG9OZXh0RmluZE1hdGNoLnJ1bihudWxsISwgZWRpdG9yKTtcblx0XHRcdGFkZFNlbGVjdGlvblRvTmV4dEZpbmRNYXRjaC5ydW4obnVsbCEsIGVkaXRvcik7XG5cdFx0XHRhZGRTZWxlY3Rpb25Ub05leHRGaW5kTWF0Y2gucnVuKG51bGwhLCBlZGl0b3IpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9ucygpIS5tYXAoZnJvbVJhbmdlKSwgW1xuXHRcdFx0XHRbMSwgMSwgMSwgNF0sXG5cdFx0XHRcdFsxLCA0LCAxLCA3XSxcblx0XHRcdFx0WzIsIDEsIDIsIDRdLFxuXHRcdFx0XHRbMywgMSwgMywgNF0sXG5cdFx0XHRcdFszLCA0LCAzLCA3XVxuXHRcdFx0XSk7XG5cblx0XHRcdGVkaXRvci50cmlnZ2VyKCd0ZXN0JywgSGFuZGxlci5UeXBlLCB7IHRleHQ6ICd6JyB9KTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSEubWFwKGZyb21SYW5nZSksIFtcblx0XHRcdFx0WzEsIDIsIDEsIDJdLFxuXHRcdFx0XHRbMSwgMywgMSwgM10sXG5cdFx0XHRcdFsyLCAyLCAyLCAyXSxcblx0XHRcdFx0WzMsIDIsIDMsIDJdLFxuXHRcdFx0XHRbMywgMywgMywgM11cblx0XHRcdF0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRWYWx1ZSgpLCBbXG5cdFx0XHRcdCd6eicsXG5cdFx0XHRcdCd6Jyxcblx0XHRcdFx0J3p6Jyxcblx0XHRcdF0uam9pbignXFxuJykpO1xuXG5cdFx0XHRtdWx0aUN1cnNvclNlbGVjdENvbnRyb2xsZXIuZGlzcG9zZSgpO1xuXHRcdFx0ZmluZENvbnRyb2xsZXIuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMjM1NDE6IE11bHRpbGluZSBDdHJsK0QgZG9lcyBub3Qgd29yayBpbiBDUkxGIGZpbGVzJywgKCkgPT4ge1xuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihbXG5cdFx0XHQnJyxcblx0XHRcdCdxd2UnLFxuXHRcdFx0J3J0eScsXG5cdFx0XHQnJyxcblx0XHRcdCdxd2UnLFxuXHRcdFx0JycsXG5cdFx0XHQncnR5Jyxcblx0XHRcdCdxd2UnLFxuXHRcdFx0J3J0eSdcblx0XHRdLCB7IHNlcnZpY2VDb2xsZWN0aW9uOiBzZXJ2aWNlQ29sbGVjdGlvbiB9LCAoZWRpdG9yKSA9PiB7XG5cblx0XHRcdGVkaXRvci5nZXRNb2RlbCgpIS5zZXRFT0woRW5kT2ZMaW5lU2VxdWVuY2UuQ1JMRik7XG5cblx0XHRcdGNvbnN0IGZpbmRDb250cm9sbGVyID0gZWRpdG9yLnJlZ2lzdGVyQW5kSW5zdGFudGlhdGVDb250cmlidXRpb24oQ29tbW9uRmluZENvbnRyb2xsZXIuSUQsIENvbW1vbkZpbmRDb250cm9sbGVyKTtcblx0XHRcdGNvbnN0IG11bHRpQ3Vyc29yU2VsZWN0Q29udHJvbGxlciA9IGVkaXRvci5yZWdpc3RlckFuZEluc3RhbnRpYXRlQ29udHJpYnV0aW9uKE11bHRpQ3Vyc29yU2VsZWN0aW9uQ29udHJvbGxlci5JRCwgTXVsdGlDdXJzb3JTZWxlY3Rpb25Db250cm9sbGVyKTtcblx0XHRcdGNvbnN0IGFkZFNlbGVjdGlvblRvTmV4dEZpbmRNYXRjaCA9IG5ldyBBZGRTZWxlY3Rpb25Ub05leHRGaW5kTWF0Y2hBY3Rpb24oKTtcblxuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDIsIDEsIDMsIDQpKTtcblxuXHRcdFx0YWRkU2VsZWN0aW9uVG9OZXh0RmluZE1hdGNoLnJ1bihudWxsISwgZWRpdG9yKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSEubWFwKGZyb21SYW5nZSksIFtcblx0XHRcdFx0WzIsIDEsIDMsIDRdLFxuXHRcdFx0XHRbOCwgMSwgOSwgNF1cblx0XHRcdF0pO1xuXG5cdFx0XHRlZGl0b3IudHJpZ2dlcigndGVzdCcsICdyZW1vdmVTZWNvbmRhcnlDdXJzb3JzJywgbnVsbCk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZnJvbVJhbmdlKGVkaXRvci5nZXRTZWxlY3Rpb24oKSEpLCBbMiwgMSwgMywgNF0pO1xuXG5cdFx0XHRtdWx0aUN1cnNvclNlbGVjdENvbnRyb2xsZXIuZGlzcG9zZSgpO1xuXHRcdFx0ZmluZENvbnRyb2xsZXIuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRmdW5jdGlvbiB0ZXN0TXVsdGljdXJzb3IodGV4dDogc3RyaW5nW10sIGNhbGxiYWNrOiAoZWRpdG9yOiBJVGVzdENvZGVFZGl0b3IsIGZpbmRDb250cm9sbGVyOiBDb21tb25GaW5kQ29udHJvbGxlcikgPT4gdm9pZCk6IHZvaWQge1xuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcih0ZXh0LCB7IHNlcnZpY2VDb2xsZWN0aW9uOiBzZXJ2aWNlQ29sbGVjdGlvbiB9LCAoZWRpdG9yKSA9PiB7XG5cdFx0XHRjb25zdCBmaW5kQ29udHJvbGxlciA9IGVkaXRvci5yZWdpc3RlckFuZEluc3RhbnRpYXRlQ29udHJpYnV0aW9uKENvbW1vbkZpbmRDb250cm9sbGVyLklELCBDb21tb25GaW5kQ29udHJvbGxlcik7XG5cdFx0XHRjb25zdCBtdWx0aUN1cnNvclNlbGVjdENvbnRyb2xsZXIgPSBlZGl0b3IucmVnaXN0ZXJBbmRJbnN0YW50aWF0ZUNvbnRyaWJ1dGlvbihNdWx0aUN1cnNvclNlbGVjdGlvbkNvbnRyb2xsZXIuSUQsIE11bHRpQ3Vyc29yU2VsZWN0aW9uQ29udHJvbGxlcik7XG5cblx0XHRcdGNhbGxiYWNrKGVkaXRvciwgZmluZENvbnRyb2xsZXIpO1xuXG5cdFx0XHRtdWx0aUN1cnNvclNlbGVjdENvbnRyb2xsZXIuZGlzcG9zZSgpO1xuXHRcdFx0ZmluZENvbnRyb2xsZXIuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXHR9XG5cblx0ZnVuY3Rpb24gdGVzdEFkZFNlbGVjdGlvblRvTmV4dEZpbmRNYXRjaEFjdGlvbih0ZXh0OiBzdHJpbmdbXSwgY2FsbGJhY2s6IChlZGl0b3I6IElUZXN0Q29kZUVkaXRvciwgYWN0aW9uOiBBZGRTZWxlY3Rpb25Ub05leHRGaW5kTWF0Y2hBY3Rpb24sIGZpbmRDb250cm9sbGVyOiBDb21tb25GaW5kQ29udHJvbGxlcikgPT4gdm9pZCk6IHZvaWQge1xuXHRcdHRlc3RNdWx0aWN1cnNvcih0ZXh0LCAoZWRpdG9yLCBmaW5kQ29udHJvbGxlcikgPT4ge1xuXHRcdFx0Y29uc3QgYWN0aW9uID0gbmV3IEFkZFNlbGVjdGlvblRvTmV4dEZpbmRNYXRjaEFjdGlvbigpO1xuXHRcdFx0Y2FsbGJhY2soZWRpdG9yLCBhY3Rpb24sIGZpbmRDb250cm9sbGVyKTtcblx0XHR9KTtcblx0fVxuXG5cdHRlc3QoJ0FkZFNlbGVjdGlvblRvTmV4dEZpbmRNYXRjaEFjdGlvbiBzdGFydGluZyB3aXRoIHNpbmdsZSBjb2xsYXBzZWQgc2VsZWN0aW9uJywgKCkgPT4ge1xuXHRcdGNvbnN0IHRleHQgPSBbXG5cdFx0XHQnYWJjIHBpenphJyxcblx0XHRcdCdhYmMgaG91c2UnLFxuXHRcdFx0J2FiYyBiYXInXG5cdFx0XTtcblx0XHR0ZXN0QWRkU2VsZWN0aW9uVG9OZXh0RmluZE1hdGNoQWN0aW9uKHRleHQsIChlZGl0b3IsIGFjdGlvbiwgZmluZENvbnRyb2xsZXIpID0+IHtcblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAyLCAxLCAyKSxcblx0XHRcdF0pO1xuXG5cdFx0XHRhY3Rpb24ucnVuKG51bGwhLCBlZGl0b3IpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9ucygpLCBbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgNCksXG5cdFx0XHRdKTtcblxuXHRcdFx0YWN0aW9uLnJ1bihudWxsISwgZWRpdG9yKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSwgW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDQpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDEsIDIsIDQpLFxuXHRcdFx0XSk7XG5cblx0XHRcdGFjdGlvbi5ydW4obnVsbCEsIGVkaXRvcik7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCksIFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAxLCA0KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCAxLCAyLCA0KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigzLCAxLCAzLCA0KSxcblx0XHRcdF0pO1xuXG5cdFx0XHRhY3Rpb24ucnVuKG51bGwhLCBlZGl0b3IpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9ucygpLCBbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgNCksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgMSwgMiwgNCksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMywgMSwgMywgNCksXG5cdFx0XHRdKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnQWRkU2VsZWN0aW9uVG9OZXh0RmluZE1hdGNoQWN0aW9uIHN0YXJ0aW5nIHdpdGggdHdvIHNlbGVjdGlvbnMsIG9uZSBiZWluZyBjb2xsYXBzZWQgMSknLCAoKSA9PiB7XG5cdFx0Y29uc3QgdGV4dCA9IFtcblx0XHRcdCdhYmMgcGl6emEnLFxuXHRcdFx0J2FiYyBob3VzZScsXG5cdFx0XHQnYWJjIGJhcidcblx0XHRdO1xuXHRcdHRlc3RBZGRTZWxlY3Rpb25Ub05leHRGaW5kTWF0Y2hBY3Rpb24odGV4dCwgKGVkaXRvciwgYWN0aW9uLCBmaW5kQ29udHJvbGxlcikgPT4ge1xuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDQpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDIsIDIsIDIpLFxuXHRcdFx0XSk7XG5cblx0XHRcdGFjdGlvbi5ydW4obnVsbCEsIGVkaXRvcik7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCksIFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAxLCA0KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCAxLCAyLCA0KSxcblx0XHRcdF0pO1xuXG5cdFx0XHRhY3Rpb24ucnVuKG51bGwhLCBlZGl0b3IpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9ucygpLCBbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgNCksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgMSwgMiwgNCksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMywgMSwgMywgNCksXG5cdFx0XHRdKTtcblxuXHRcdFx0YWN0aW9uLnJ1bihudWxsISwgZWRpdG9yKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSwgW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDQpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDEsIDIsIDQpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDMsIDEsIDMsIDQpLFxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0FkZFNlbGVjdGlvblRvTmV4dEZpbmRNYXRjaEFjdGlvbiBzdGFydGluZyB3aXRoIHR3byBzZWxlY3Rpb25zLCBvbmUgYmVpbmcgY29sbGFwc2VkIDIpJywgKCkgPT4ge1xuXHRcdGNvbnN0IHRleHQgPSBbXG5cdFx0XHQnYWJjIHBpenphJyxcblx0XHRcdCdhYmMgaG91c2UnLFxuXHRcdFx0J2FiYyBiYXInXG5cdFx0XTtcblx0XHR0ZXN0QWRkU2VsZWN0aW9uVG9OZXh0RmluZE1hdGNoQWN0aW9uKHRleHQsIChlZGl0b3IsIGFjdGlvbiwgZmluZENvbnRyb2xsZXIpID0+IHtcblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAyLCAxLCAyKSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCAxLCAyLCA0KSxcblx0XHRcdF0pO1xuXG5cdFx0XHRhY3Rpb24ucnVuKG51bGwhLCBlZGl0b3IpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9ucygpLCBbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgNCksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgMSwgMiwgNCksXG5cdFx0XHRdKTtcblxuXHRcdFx0YWN0aW9uLnJ1bihudWxsISwgZWRpdG9yKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSwgW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDQpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDEsIDIsIDQpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDMsIDEsIDMsIDQpLFxuXHRcdFx0XSk7XG5cblx0XHRcdGFjdGlvbi5ydW4obnVsbCEsIGVkaXRvcik7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCksIFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAxLCA0KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCAxLCAyLCA0KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigzLCAxLCAzLCA0KSxcblx0XHRcdF0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdBZGRTZWxlY3Rpb25Ub05leHRGaW5kTWF0Y2hBY3Rpb24gc3RhcnRpbmcgd2l0aCBhbGwgY29sbGFwc2VkIHNlbGVjdGlvbnMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgdGV4dCA9IFtcblx0XHRcdCdhYmMgcGl6emEnLFxuXHRcdFx0J2FiYyBob3VzZScsXG5cdFx0XHQnYWJjIGJhcidcblx0XHRdO1xuXHRcdHRlc3RBZGRTZWxlY3Rpb25Ub05leHRGaW5kTWF0Y2hBY3Rpb24odGV4dCwgKGVkaXRvciwgYWN0aW9uLCBmaW5kQ29udHJvbGxlcikgPT4ge1xuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDIsIDEsIDIpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDIsIDIsIDIpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDMsIDEsIDMsIDEpLFxuXHRcdFx0XSk7XG5cblx0XHRcdGFjdGlvbi5ydW4obnVsbCEsIGVkaXRvcik7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCksIFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAxLCA0KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCAxLCAyLCA0KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigzLCAxLCAzLCA0KSxcblx0XHRcdF0pO1xuXG5cdFx0XHRhY3Rpb24ucnVuKG51bGwhLCBlZGl0b3IpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9ucygpLCBbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgNCksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgMSwgMiwgNCksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMywgMSwgMywgNCksXG5cdFx0XHRdKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnQWRkU2VsZWN0aW9uVG9OZXh0RmluZE1hdGNoQWN0aW9uIHN0YXJ0aW5nIHdpdGggYWxsIGNvbGxhcHNlZCBzZWxlY3Rpb25zIG9uIGRpZmZlcmVudCB3b3JkcycsICgpID0+IHtcblx0XHRjb25zdCB0ZXh0ID0gW1xuXHRcdFx0J2FiYyBwaXp6YScsXG5cdFx0XHQnYWJjIGhvdXNlJyxcblx0XHRcdCdhYmMgYmFyJ1xuXHRcdF07XG5cdFx0dGVzdEFkZFNlbGVjdGlvblRvTmV4dEZpbmRNYXRjaEFjdGlvbih0ZXh0LCAoZWRpdG9yLCBhY3Rpb24sIGZpbmRDb250cm9sbGVyKSA9PiB7XG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9ucyhbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNiwgMSwgNiksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgNiwgMiwgNiksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMywgNiwgMywgNiksXG5cdFx0XHRdKTtcblxuXHRcdFx0YWN0aW9uLnJ1bihudWxsISwgZWRpdG9yKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSwgW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDUsIDEsIDEwKSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCA1LCAyLCAxMCksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMywgNSwgMywgOCksXG5cdFx0XHRdKTtcblxuXHRcdFx0YWN0aW9uLnJ1bihudWxsISwgZWRpdG9yKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSwgW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDUsIDEsIDEwKSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCA1LCAyLCAxMCksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMywgNSwgMywgOCksXG5cdFx0XHRdKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzIwNjUxOiBBZGRTZWxlY3Rpb25Ub05leHRGaW5kTWF0Y2hBY3Rpb24gY2FzZSBpbnNlbnNpdGl2ZScsICgpID0+IHtcblx0XHRjb25zdCB0ZXh0ID0gW1xuXHRcdFx0J3Rlc3QnLFxuXHRcdFx0J3Rlc3R0ZScsXG5cdFx0XHQnVGVzdCcsXG5cdFx0XHQndGVzdHRlJyxcblx0XHRcdCd0ZXN0J1xuXHRcdF07XG5cdFx0dGVzdEFkZFNlbGVjdGlvblRvTmV4dEZpbmRNYXRjaEFjdGlvbih0ZXh0LCAoZWRpdG9yLCBhY3Rpb24sIGZpbmRDb250cm9sbGVyKSA9PiB7XG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9ucyhbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgNSksXG5cdFx0XHRdKTtcblxuXHRcdFx0YWN0aW9uLnJ1bihudWxsISwgZWRpdG9yKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSwgW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDUpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDEsIDIsIDUpLFxuXHRcdFx0XSk7XG5cblx0XHRcdGFjdGlvbi5ydW4obnVsbCEsIGVkaXRvcik7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCksIFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAxLCA1KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCAxLCAyLCA1KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigzLCAxLCAzLCA1KSxcblx0XHRcdF0pO1xuXG5cdFx0XHRhY3Rpb24ucnVuKG51bGwhLCBlZGl0b3IpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9ucygpLCBbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgNSksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgMSwgMiwgNSksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMywgMSwgMywgNSksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oNCwgMSwgNCwgNSksXG5cdFx0XHRdKTtcblxuXHRcdFx0YWN0aW9uLnJ1bihudWxsISwgZWRpdG9yKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSwgW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDUpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDEsIDIsIDUpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDMsIDEsIDMsIDUpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDQsIDEsIDQsIDUpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDUsIDEsIDUsIDUpLFxuXHRcdFx0XSk7XG5cblx0XHRcdGFjdGlvbi5ydW4obnVsbCEsIGVkaXRvcik7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCksIFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAxLCA1KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCAxLCAyLCA1KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigzLCAxLCAzLCA1KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbig0LCAxLCA0LCA1KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbig1LCAxLCA1LCA1KSxcblx0XHRcdF0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgnRmluZCBzdGF0ZSBkaXNhc3NvY2lhdGlvbicsICgpID0+IHtcblxuXHRcdGNvbnN0IHRleHQgPSBbXG5cdFx0XHQnYXBwJyxcblx0XHRcdCdhcHBsZXMnLFxuXHRcdFx0J3doYXRzYXBwJyxcblx0XHRcdCdhcHAnLFxuXHRcdFx0J0FwcCcsXG5cdFx0XHQnIGFwcCdcblx0XHRdO1xuXG5cdFx0dGVzdCgnZW50ZXJzIG1vZGUnLCAoKSA9PiB7XG5cdFx0XHR0ZXN0QWRkU2VsZWN0aW9uVG9OZXh0RmluZE1hdGNoQWN0aW9uKHRleHQsIChlZGl0b3IsIGFjdGlvbiwgZmluZENvbnRyb2xsZXIpID0+IHtcblx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoW1xuXHRcdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMiwgMSwgMiksXG5cdFx0XHRcdF0pO1xuXG5cdFx0XHRcdGFjdGlvbi5ydW4obnVsbCEsIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSwgW1xuXHRcdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgNCksXG5cdFx0XHRcdF0pO1xuXG5cdFx0XHRcdGFjdGlvbi5ydW4obnVsbCEsIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSwgW1xuXHRcdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgNCksXG5cdFx0XHRcdFx0bmV3IFNlbGVjdGlvbig0LCAxLCA0LCA0KSxcblx0XHRcdFx0XSk7XG5cblx0XHRcdFx0YWN0aW9uLnJ1bihudWxsISwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9ucygpLCBbXG5cdFx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAxLCA0KSxcblx0XHRcdFx0XHRuZXcgU2VsZWN0aW9uKDQsIDEsIDQsIDQpLFxuXHRcdFx0XHRcdG5ldyBTZWxlY3Rpb24oNiwgMiwgNiwgNSksXG5cdFx0XHRcdF0pO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdsZWF2ZXMgbW9kZSB3aGVuIHNlbGVjdGlvbiBjaGFuZ2VzJywgKCkgPT4ge1xuXHRcdFx0dGVzdEFkZFNlbGVjdGlvblRvTmV4dEZpbmRNYXRjaEFjdGlvbih0ZXh0LCAoZWRpdG9yLCBhY3Rpb24sIGZpbmRDb250cm9sbGVyKSA9PiB7XG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtcblx0XHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDIsIDEsIDIpLFxuXHRcdFx0XHRdKTtcblxuXHRcdFx0XHRhY3Rpb24ucnVuKG51bGwhLCBlZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCksIFtcblx0XHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDQpLFxuXHRcdFx0XHRdKTtcblxuXHRcdFx0XHRhY3Rpb24ucnVuKG51bGwhLCBlZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCksIFtcblx0XHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDQpLFxuXHRcdFx0XHRcdG5ldyBTZWxlY3Rpb24oNCwgMSwgNCwgNCksXG5cdFx0XHRcdF0pO1xuXG5cdFx0XHRcdC8vIGNoYW5nZSBzZWxlY3Rpb25cblx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoW1xuXHRcdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgNCksXG5cdFx0XHRcdF0pO1xuXG5cdFx0XHRcdGFjdGlvbi5ydW4obnVsbCEsIGVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSwgW1xuXHRcdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgNCksXG5cdFx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCAxLCAyLCA0KSxcblx0XHRcdFx0XSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ1NlbGVjdCBIaWdobGlnaHRzIHJlc3BlY3RzIG1vZGUgJywgKCkgPT4ge1xuXHRcdFx0dGVzdE11bHRpY3Vyc29yKHRleHQsIChlZGl0b3IsIGZpbmRDb250cm9sbGVyKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGFjdGlvbiA9IG5ldyBTZWxlY3RIaWdobGlnaHRzQWN0aW9uKCk7XG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtcblx0XHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDIsIDEsIDIpLFxuXHRcdFx0XHRdKTtcblxuXHRcdFx0XHRhY3Rpb24ucnVuKG51bGwhLCBlZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCksIFtcblx0XHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDQpLFxuXHRcdFx0XHRcdG5ldyBTZWxlY3Rpb24oNCwgMSwgNCwgNCksXG5cdFx0XHRcdFx0bmV3IFNlbGVjdGlvbig2LCAyLCA2LCA1KSxcblx0XHRcdFx0XSk7XG5cblx0XHRcdFx0YWN0aW9uLnJ1bihudWxsISwgZWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9ucygpLCBbXG5cdFx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAxLCA0KSxcblx0XHRcdFx0XHRuZXcgU2VsZWN0aW9uKDQsIDEsIDQsIDQpLFxuXHRcdFx0XHRcdG5ldyBTZWxlY3Rpb24oNiwgMiwgNiwgNSksXG5cdFx0XHRcdF0pO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUlBLE9BQU8sWUFBWTtBQUNuQixTQUFTLCtDQUErQztBQUV4RCxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGVBQWU7QUFDeEIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxtQ0FBbUMsbUJBQW1CLG1CQUFtQixnQ0FBZ0MsOEJBQThCO0FBQ2hKLFNBQTBCLDBCQUEwQjtBQUNwRCxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGlCQUFpQiw4QkFBOEI7QUFFeEQsTUFBTSxlQUFlLE1BQU07QUFFMUIsMENBQXdDO0FBRXhDLE9BQUssOENBQThDLE1BQU07QUFDeEQsdUJBQW1CO0FBQUEsTUFDbEIsSUFBSSxPQUFPLEVBQUU7QUFBQSxNQUNiLElBQUksT0FBTyxFQUFFO0FBQUEsSUFDZCxHQUFHLEVBQUUsVUFBVSxrQkFBa0IsZ0JBQWdCLEdBQUcsR0FBRyxDQUFDLFFBQVEs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
