import assert from "assert";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { TextAreaState } from "../../../browser/controller/editContext/textArea/textAreaEditContextState.js";
import { Range } from "../../../common/core/range.js";
import { Selection } from "../../../common/core/selection.js";
import { createTextModel } from "../../common/testTextModel.js";
import { PagedScreenReaderStrategy } from "../../../browser/controller/editContext/screenReaderUtils.js";
class MockTextAreaWrapper extends Disposable {
  constructor() {
    super();
    this._value = "";
    this._selectionStart = 0;
    this._selectionEnd = 0;
  }
  getValue() {
    return this._value;
  }
  setValue(reason, value) {
    this._value = value;
    this._selectionStart = this._value.length;
    this._selectionEnd = this._value.length;
  }
  getSelectionStart() {
    return this._selectionStart;
  }
  getSelectionEnd() {
    return this._selectionEnd;
  }
  setSelectionRange(reason, selectionStart, selectionEnd) {
    if (selectionStart < 0) {
      selectionStart = 0;
    }
    if (selectionStart > this._value.length) {
      selectionStart = this._value.length;
    }
    if (selectionEnd < 0) {
      selectionEnd = 0;
    }
    if (selectionEnd > this._value.length) {
      selectionEnd = this._value.length;
    }
    this._selectionStart = selectionStart;
    this._selectionEnd = selectionEnd;
  }
}
function equalsTextAreaState(a, b) {
  return a.value === b.value && a.selectionStart === b.selectionStart && a.selectionEnd === b.selectionEnd && Range.equalsRange(a.selection, b.selection) && a.newlineCountBeforeSelection === b.newlineCountBeforeSelection;
}
suite("TextAreaState", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  function assertTextAreaState(actual, value, selectionStart, selectionEnd) {
    const desired = new TextAreaState(value, selectionStart, selectionEnd, null, void 0);
    assert.ok(equalsTextAreaState(desired, actual), desired.toString() + " == " + actual.toString());
  }
  test("fromTextArea", () => {
    const textArea = new MockTextAreaWrapper();
    textArea._value = "Hello world!";
    textArea._selectionStart = 1;
    textArea._selectionEnd = 12;
    let actual = TextAreaState.readFromTextArea(textArea, null);
    assertTextAreaState(actual, "Hello world!", 1, 12);
    assert.strictEqual(actual.value, "Hello world!");
    assert.strictEqual(actual.selectionStart, 1);
    actual = actual.collapseSelection();
    assertTextAreaState(actual, "Hello world!", 12, 12);
    textArea.dispose();
  });
  test("applyToTextArea", () => {
    const textArea = new MockTextAreaWrapper();
    textArea._value = "Hello world!";
    textArea._selectionStart = 1;
    textArea._selectionEnd = 12;
    let state = new TextAreaState("Hi world!", 2, 2, null, void 0);
    state.writeToTextArea("test", textArea, false);
    assert.strictEqual(textArea._value, "Hi world!");
    assert.strictEqual(textArea._selectionStart, 9);
    assert.strictEqual(textArea._selectionEnd, 9);
    state = new TextAreaState("Hi world!", 3, 3, null, void 0);
    state.writeToTextArea("test", textArea, false);
    assert.strictEqual(textArea._value, "Hi world!");
    assert.strictEqual(textArea._selectionStart, 9);
    assert.strictEqual(textArea._selectionEnd, 9);
    state = new TextAreaState("Hi world!", 0, 2, null, void 0);
    state.writeToTextArea("test", textArea, true);
    assert.strictEqual(textArea._value, "Hi world!");
    assert.strictEqual(textArea._selectionStart, 0);
    assert.strictEqual(textArea._selectionEnd, 2);
    textArea.dispose();
  });
  function testDeduceInput(prevState, value, selectionStart, selectionEnd, couldBeEmojiInput, expected, expectedCharReplaceCnt) {
    prevState = prevState || TextAreaState.EMPTY;
    const textArea = new MockTextAreaWrapper();
    textArea._value = value;
    textArea._selectionStart = selectionStart;
    textArea._selectionEnd = selectionEnd;
    const newState = TextAreaState.readFromTextArea(textArea, null);
    const actual = TextAreaState.deduceInput(prevState, newState, couldBeEmojiInput);
    assert.deepStrictEqual(actual, {
      text: expected,
      replacePrevCharCnt: expectedCharReplaceCnt,
      replaceNextCharCnt: 0,
      positionDelta: 0
    });
    textArea.dispose();
  }
  test("extractNewText - no previous state with selection", () => {
    testDeduceInput(
      null,
      "a",
      0,
      1,
      true,
      "a",
      0
    );
  });
  test("issue #2586: Replacing selected end-of-line with newline locks up the document", () => {
    testDeduceInput(
      new TextAreaState("]\n", 1, 2, null, void 0),
      "]\n",
      2,
      2,
      true,
      "\n",
      0
    );
  });
  test("extractNewText - no previous state without selection", () => {
    testDeduceInput(
      null,
      "a",
      1,
      1,
      true,
      "a",
      0
    );
  });
  test("extractNewText - typing does not cause a selection", () => {
    testDeduceInput(
      TextAreaState.EMPTY,
      "a",
      0,
      1,
      true,
      "a",
      0
    );
  });
  test("extractNewText - had the textarea empty", () => {
    testDeduceInput(
      TextAreaState.EMPTY,
      "a",
      1,
      1,
      true,
      "a",
      0
    );
  });
  test("extractNewText - had the entire line selected", () => {
    testDeduceInput(
      new TextAreaState("Hello world!", 0, 12, null, void 0),
      "H",
      1,
      1,
      true,
      "H",
      0
    );
  });
  test("extractNewText - had previous text 1", () => {
    testDeduceInput(
      new TextAreaState("Hello world!", 12, 12, null, void 0),
      "Hello world!a",
      13,
      13,
      true,
      "a",
      0
    );
  });
  test("extractNewText - had previous text 2", () => {
    testDeduceInput(
      new TextAreaState("Hello world!", 0, 0, null, void 0),
      "aHello world!",
      1,
      1,
      true,
      "a",
      0
    );
  });
  test("extractNewText - had previous text 3", () => {
    testDeduceInput(
      new TextAreaState("Hello world!", 6, 11, null, void 0),
      "Hello other!",
      11,
      11,
      true,
      "other",
      0
    );
  });
  test("extractNewText - IME", () => {
    testDeduceInput(
      TextAreaState.EMPTY,
      "\u3053\u308C\u306F",
      3,
      3,
      true,
      "\u3053\u308C\u306F",
      0
    );
  });
  test("extractNewText - isInOverwriteMode", () => {
    testDeduceInput(
      new TextAreaState("Hello world!", 0, 0, null, void 0),
      "Aello world!",
      1,
      1,
      true,
      "A",
      0
    );
  });
  test("extractMacReplacedText - does nothing if there is selection", () => {
    testDeduceInput(
      new TextAreaState("Hello world!", 5, 5, null, void 0),
      "Hell\xF6 world!",
      4,
      5,
      true,
      "\xF6",
      0
    );
  });
  test("extractMacReplacedText - does nothing if there is more than one extra char", () => {
    testDeduceInput(
      new TextAreaState("Hello world!", 5, 5, null, void 0),
      "Hell\xF6\xF6 world!",
      5,
      5,
      true,
      "\xF6\xF6",
      1
    );
  });
  test("extractMacReplacedText - does nothing if there is more than one changed char", () => {
    testDeduceInput(
      new TextAreaState("Hello world!", 5, 5, null, void 0),
      "Hel\xF6\xF6 world!",
      5,
      5,
      true,
      "\xF6\xF6",
      2
    );
  });
  test("extractMacReplacedText", () => {
    testDeduceInput(
      new TextAreaState("Hello world!", 5, 5, null, void 0),
      "Hell\xF6 world!",
      5,
      5,
      true,
      "\xF6",
      1
    );
  });
  test("issue #25101 - First key press ignored", () => {
    testDeduceInput(
      new TextAreaState("a", 0, 1, null, void 0),
      "a",
      1,
      1,
      true,
      "a",
      0
    );
  });
  test("issue #16520 - Cmd-d of single character followed by typing same character as has no effect", () => {
    testDeduceInput(
      new TextAreaState("x x", 0, 1, null, void 0),
      "x x",
      1,
      1,
      true,
      "x",
      0
    );
  });
  function testDeduceAndroidCompositionInput(prevState, value, selectionStart, selectionEnd, expected, expectedReplacePrevCharCnt, expectedReplaceNextCharCnt, expectedPositionDelta) {
    prevState = prevState || TextAreaState.EMPTY;
    const textArea = new MockTextAreaWrapper();
    textArea._value = value;
    textArea._selectionStart = selectionStart;
    textArea._selectionEnd = selectionEnd;
    const newState = TextAreaState.readFromTextArea(textArea, null);
    const actual = TextAreaState.deduceAndroidCompositionInput(prevState, newState);
    assert.deepStrictEqual(actual, {
      text: expected,
      replacePrevCharCnt: expectedReplacePrevCharCnt,
      replaceNextCharCnt: expectedReplaceNextCharCnt,
      positionDelta: expectedPositionDelta
    });
    textArea.dispose();
  }
  test("Android composition input 1", () => {
    testDeduceAndroidCompositionInput(
      new TextAreaState("Microsoft", 4, 4, null, void 0),
      "Microsoft",
      4,
      4,
      "",
      0,
      0,
      0
    );
  });
  test("Android composition input 2", () => {
    testDeduceAndroidCompositionInput(
      new TextAreaState("Microsoft", 4, 4, null, void 0),
      "Microsoft",
      0,
      9,
      "",
      0,
      0,
      5
    );
  });
  test("Android composition input 3", () => {
    testDeduceAndroidCompositionInput(
      new TextAreaState("Microsoft", 0, 9, null, void 0),
      "Microsoft's",
      11,
      11,
      "'s",
      0,
      0,
      0
    );
  });
  test("Android backspace", () => {
    testDeduceAndroidCompositionInput(
      new TextAreaState("undefinedVariable", 2, 2, null, void 0),
      "udefinedVariable",
      1,
      1,
      "",
      1,
      0,
      0
    );
  });
  suite("PagedScreenReaderStrategy", () => {
    function testPagedScreenReaderStrategy(lines, selection, expected) {
      const model = createTextModel(lines.join("\n"));
      const screenReaderContentState = PagedScreenReaderStrategy.fromEditorSelection(model, selection, 10, true);
      const textAreaState = TextAreaState.fromScreenReaderContentState(screenReaderContentState);
      assert.ok(equalsTextAreaState(textAreaState, expected));
      model.dispose();
    }
    test("simple", () => {
      testPagedScreenReaderStrategy(
        [
          "Hello world!"
        ],
        new Selection(1, 13, 1, 13),
        new TextAreaState("Hello world!", 12, 12, new Range(1, 13, 1, 13), 0)
      );
      testPagedScreenReaderStrategy(
        [
          "Hello world!"
        ],
        new Selection(1, 1, 1, 1),
        new TextAreaState("Hello world!", 0, 0, new Range(1, 1, 1, 1), 0)
      );
      testPagedScreenReaderStrategy(
        [
          "Hello world!"
        ],
        new Selection(1, 1, 1, 6),
        new TextAreaState("Hello world!", 0, 5, new Range(1, 1, 1, 6), 0)
      );
    });
    test("multiline", () => {
      testPagedScreenReaderStrategy(
        [
          "Hello world!",
          "How are you?"
        ],
        new Selection(1, 1, 1, 1),
        new TextAreaState("Hello world!\nHow are you?", 0, 0, new Range(1, 1, 1, 1), 0)
      );
      testPagedScreenReaderStrategy(
        [
          "Hello world!",
          "How are you?"
        ],
        new Selection(2, 1, 2, 1),
        new TextAreaState("Hello world!\nHow are you?", 13, 13, new Range(2, 1, 2, 1), 1)
      );
    });
    test("page", () => {
      testPagedScreenReaderStrategy(
        [
          "L1\nL2\nL3\nL4\nL5\nL6\nL7\nL8\nL9\nL10\nL11\nL12\nL13\nL14\nL15\nL16\nL17\nL18\nL19\nL20\nL21"
        ],
        new Selection(1, 1, 1, 1),
        new TextAreaState("L1\nL2\nL3\nL4\nL5\nL6\nL7\nL8\nL9\nL10\n", 0, 0, new Range(1, 1, 1, 1), 0)
      );
      testPagedScreenReaderStrategy(
        [
          "L1\nL2\nL3\nL4\nL5\nL6\nL7\nL8\nL9\nL10\nL11\nL12\nL13\nL14\nL15\nL16\nL17\nL18\nL19\nL20\nL21"
        ],
        new Selection(11, 1, 11, 1),
        new TextAreaState("L11\nL12\nL13\nL14\nL15\nL16\nL17\nL18\nL19\nL20\n", 0, 0, new Range(11, 1, 11, 1), 0)
      );
      testPagedScreenReaderStrategy(
        [
          "L1\nL2\nL3\nL4\nL5\nL6\nL7\nL8\nL9\nL10\nL11\nL12\nL13\nL14\nL15\nL16\nL17\nL18\nL19\nL20\nL21"
        ],
        new Selection(12, 1, 12, 1),
        new TextAreaState("L11\nL12\nL13\nL14\nL15\nL16\nL17\nL18\nL19\nL20\n", 4, 4, new Range(12, 1, 12, 1), 1)
      );
      testPagedScreenReaderStrategy(
        [
          "L1\nL2\nL3\nL4\nL5\nL6\nL7\nL8\nL9\nL10\nL11\nL12\nL13\nL14\nL15\nL16\nL17\nL18\nL19\nL20\nL21"
        ],
        new Selection(21, 1, 21, 1),
        new TextAreaState("L21", 0, 0, new Range(21, 1, 21, 1), 0)
      );
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9icm93c2VyL2NvbnRyb2xsZXIvdGV4dEFyZWFTdGF0ZS50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IElUZXh0QXJlYVdyYXBwZXIsIFRleHRBcmVhU3RhdGUgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2NvbnRyb2xsZXIvZWRpdENvbnRleHQvdGV4dEFyZWEvdGV4dEFyZWFFZGl0Q29udGV4dFN0YXRlLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IGNyZWF0ZVRleHRNb2RlbCB9IGZyb20gJy4uLy4uL2NvbW1vbi90ZXN0VGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IFBhZ2VkU2NyZWVuUmVhZGVyU3RyYXRlZ3kgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2NvbnRyb2xsZXIvZWRpdENvbnRleHQvc2NyZWVuUmVhZGVyVXRpbHMuanMnO1xuXG5jbGFzcyBNb2NrVGV4dEFyZWFXcmFwcGVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElUZXh0QXJlYVdyYXBwZXIge1xuXG5cdHB1YmxpYyBfdmFsdWU6IHN0cmluZztcblx0cHVibGljIF9zZWxlY3Rpb25TdGFydDogbnVtYmVyO1xuXHRwdWJsaWMgX3NlbGVjdGlvbkVuZDogbnVtYmVyO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fdmFsdWUgPSAnJztcblx0XHR0aGlzLl9zZWxlY3Rpb25TdGFydCA9IDA7XG5cdFx0dGhpcy5fc2VsZWN0aW9uRW5kID0gMDtcblx0fVxuXG5cdHB1YmxpYyBnZXRWYWx1ZSgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLl92YWx1ZTtcblx0fVxuXG5cdHB1YmxpYyBzZXRWYWx1ZShyZWFzb246IHN0cmluZywgdmFsdWU6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuX3ZhbHVlID0gdmFsdWU7XG5cdFx0dGhpcy5fc2VsZWN0aW9uU3RhcnQgPSB0aGlzLl92YWx1ZS5sZW5ndGg7XG5cdFx0dGhpcy5fc2VsZWN0aW9uRW5kID0gdGhpcy5fdmFsdWUubGVuZ3RoO1xuXHR9XG5cblx0cHVibGljIGdldFNlbGVjdGlvblN0YXJ0KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX3NlbGVjdGlvblN0YXJ0O1xuXHR9XG5cblx0cHVibGljIGdldFNlbGVjdGlvbkVuZCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl9zZWxlY3Rpb25FbmQ7XG5cdH1cblxuXHRwdWJsaWMgc2V0U2VsZWN0aW9uUmFuZ2UocmVhc29uOiBzdHJpbmcsIHNlbGVjdGlvblN0YXJ0OiBudW1iZXIsIHNlbGVjdGlvbkVuZDogbnVtYmVyKTogdm9pZCB7XG5cdFx0aWYgKHNlbGVjdGlvblN0YXJ0IDwgMCkge1xuXHRcdFx0c2VsZWN0aW9uU3RhcnQgPSAwO1xuXHRcdH1cblx0XHRpZiAoc2VsZWN0aW9uU3RhcnQgPiB0aGlzLl92YWx1ZS5sZW5ndGgpIHtcblx0XHRcdHNlbGVjdGlvblN0YXJ0ID0gdGhpcy5fdmFsdWUubGVuZ3RoO1xuXHRcdH1cblx0XHRpZiAoc2VsZWN0aW9uRW5kIDwgMCkge1xuXHRcdFx0c2VsZWN0aW9uRW5kID0gMDtcblx0XHR9XG5cdFx0aWYgKHNlbGVjdGlvbkVuZCA+IHRoaXMuX3ZhbHVlLmxlbmd0aCkge1xuXHRcdFx0c2VsZWN0aW9uRW5kID0gdGhpcy5fdmFsdWUubGVuZ3RoO1xuXHRcdH1cblx0XHR0aGlzLl9zZWxlY3Rpb25TdGFydCA9IHNlbGVjdGlvblN0YXJ0O1xuXHRcdHRoaXMuX3NlbGVjdGlvbkVuZCA9IHNlbGVjdGlvbkVuZDtcblx0fVxufVxuXG5mdW5jdGlvbiBlcXVhbHNUZXh0QXJlYVN0YXRlKGE6IFRleHRBcmVhU3RhdGUsIGI6IFRleHRBcmVhU3RhdGUpOiBib29sZWFuIHtcblx0cmV0dXJuIChcblx0XHRhLnZhbHVlID09PSBiLnZhbHVlXG5cdFx0JiYgYS5zZWxlY3Rpb25TdGFydCA9PT0gYi5zZWxlY3Rpb25TdGFydFxuXHRcdCYmIGEuc2VsZWN0aW9uRW5kID09PSBiLnNlbGVjdGlvbkVuZFxuXHRcdCYmIFJhbmdlLmVxdWFsc1JhbmdlKGEuc2VsZWN0aW9uLCBiLnNlbGVjdGlvbilcblx0XHQmJiBhLm5ld2xpbmVDb3VudEJlZm9yZVNlbGVjdGlvbiA9PT0gYi5uZXdsaW5lQ291bnRCZWZvcmVTZWxlY3Rpb25cblx0KTtcbn1cblxuc3VpdGUoJ1RleHRBcmVhU3RhdGUnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0ZnVuY3Rpb24gYXNzZXJ0VGV4dEFyZWFTdGF0ZShhY3R1YWw6IFRleHRBcmVhU3RhdGUsIHZhbHVlOiBzdHJpbmcsIHNlbGVjdGlvblN0YXJ0OiBudW1iZXIsIHNlbGVjdGlvbkVuZDogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3QgZGVzaXJlZCA9IG5ldyBUZXh0QXJlYVN0YXRlKHZhbHVlLCBzZWxlY3Rpb25TdGFydCwgc2VsZWN0aW9uRW5kLCBudWxsLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5vayhlcXVhbHNUZXh0QXJlYVN0YXRlKGRlc2lyZWQsIGFjdHVhbCksIGRlc2lyZWQudG9TdHJpbmcoKSArICcgPT0gJyArIGFjdHVhbC50b1N0cmluZygpKTtcblx0fVxuXG5cdHRlc3QoJ2Zyb21UZXh0QXJlYScsICgpID0+IHtcblx0XHRjb25zdCB0ZXh0QXJlYSA9IG5ldyBNb2NrVGV4dEFyZWFXcmFwcGVyKCk7XG5cdFx0dGV4dEFyZWEuX3ZhbHVlID0gJ0hlbGxvIHdvcmxkISc7XG5cdFx0dGV4dEFyZWEuX3NlbGVjdGlvblN0YXJ0ID0gMTtcblx0XHR0ZXh0QXJlYS5fc2VsZWN0aW9uRW5kID0gMTI7XG5cdFx0bGV0IGFjdHVhbCA9IFRleHRBcmVhU3RhdGUucmVhZEZyb21UZXh0QXJlYSh0ZXh0QXJlYSwgbnVsbCk7XG5cblx0XHRhc3NlcnRUZXh0QXJlYVN0YXRlKGFjdHVhbCwgJ0hlbGxvIHdvcmxkIScsIDEsIDEyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLnZhbHVlLCAnSGVsbG8gd29ybGQhJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5zZWxlY3Rpb25TdGFydCwgMSk7XG5cblx0XHRhY3R1YWwgPSBhY3R1YWwuY29sbGFwc2VTZWxlY3Rpb24oKTtcblx0XHRhc3NlcnRUZXh0QXJlYVN0YXRlKGFjdHVhbCwgJ0hlbGxvIHdvcmxkIScsIDEyLCAxMik7XG5cblx0XHR0ZXh0QXJlYS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2FwcGx5VG9UZXh0QXJlYScsICgpID0+IHtcblx0XHRjb25zdCB0ZXh0QXJlYSA9IG5ldyBNb2NrVGV4dEFyZWFXcmFwcGVyKCk7XG5cdFx0dGV4dEFyZWEuX3ZhbHVlID0gJ0hlbGxvIHdvcmxkISc7XG5cdFx0dGV4dEFyZWEuX3NlbGVjdGlvblN0YXJ0ID0gMTtcblx0XHR0ZXh0QXJlYS5fc2VsZWN0aW9uRW5kID0gMTI7XG5cblx0XHRsZXQgc3RhdGUgPSBuZXcgVGV4dEFyZWFTdGF0ZSgnSGkgd29ybGQhJywgMiwgMiwgbnVsbCwgdW5kZWZpbmVkKTtcblx0XHRzdGF0ZS53cml0ZVRvVGV4dEFyZWEoJ3Rlc3QnLCB0ZXh0QXJlYSwgZmFsc2UpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRleHRBcmVhLl92YWx1ZSwgJ0hpIHdvcmxkIScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0QXJlYS5fc2VsZWN0aW9uU3RhcnQsIDkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0QXJlYS5fc2VsZWN0aW9uRW5kLCA5KTtcblxuXHRcdHN0YXRlID0gbmV3IFRleHRBcmVhU3RhdGUoJ0hpIHdvcmxkIScsIDMsIDMsIG51bGwsIHVuZGVmaW5lZCk7XG5cdFx0c3RhdGUud3JpdGVUb1RleHRBcmVhKCd0ZXN0JywgdGV4dEFyZWEsIGZhbHNlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0QXJlYS5fdmFsdWUsICdIaSB3b3JsZCEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dEFyZWEuX3NlbGVjdGlvblN0YXJ0LCA5KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dEFyZWEuX3NlbGVjdGlvbkVuZCwgOSk7XG5cblx0XHRzdGF0ZSA9IG5ldyBUZXh0QXJlYVN0YXRlKCdIaSB3b3JsZCEnLCAwLCAyLCBudWxsLCB1bmRlZmluZWQpO1xuXHRcdHN0YXRlLndyaXRlVG9UZXh0QXJlYSgndGVzdCcsIHRleHRBcmVhLCB0cnVlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0QXJlYS5fdmFsdWUsICdIaSB3b3JsZCEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dEFyZWEuX3NlbGVjdGlvblN0YXJ0LCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dEFyZWEuX3NlbGVjdGlvbkVuZCwgMik7XG5cblx0XHR0ZXh0QXJlYS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIHRlc3REZWR1Y2VJbnB1dChwcmV2U3RhdGU6IFRleHRBcmVhU3RhdGUgfCBudWxsLCB2YWx1ZTogc3RyaW5nLCBzZWxlY3Rpb25TdGFydDogbnVtYmVyLCBzZWxlY3Rpb25FbmQ6IG51bWJlciwgY291bGRCZUVtb2ppSW5wdXQ6IGJvb2xlYW4sIGV4cGVjdGVkOiBzdHJpbmcsIGV4cGVjdGVkQ2hhclJlcGxhY2VDbnQ6IG51bWJlcik6IHZvaWQge1xuXHRcdHByZXZTdGF0ZSA9IHByZXZTdGF0ZSB8fCBUZXh0QXJlYVN0YXRlLkVNUFRZO1xuXG5cdFx0Y29uc3QgdGV4dEFyZWEgPSBuZXcgTW9ja1RleHRBcmVhV3JhcHBlcigpO1xuXHRcdHRleHRBcmVhLl92YWx1ZSA9IHZhbHVlO1xuXHRcdHRleHRBcmVhLl9zZWxlY3Rpb25TdGFydCA9IHNlbGVjdGlvblN0YXJ0O1xuXHRcdHRleHRBcmVhLl9zZWxlY3Rpb25FbmQgPSBzZWxlY3Rpb25FbmQ7XG5cblx0XHRjb25zdCBuZXdTdGF0ZSA9IFRleHRBcmVhU3RhdGUucmVhZEZyb21UZXh0QXJlYSh0ZXh0QXJlYSwgbnVsbCk7XG5cdFx0Y29uc3QgYWN0dWFsID0gVGV4dEFyZWFTdGF0ZS5kZWR1Y2VJbnB1dChwcmV2U3RhdGUsIG5ld1N0YXRlLCBjb3VsZEJlRW1vamlJbnB1dCk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwge1xuXHRcdFx0dGV4dDogZXhwZWN0ZWQsXG5cdFx0XHRyZXBsYWNlUHJldkNoYXJDbnQ6IGV4cGVjdGVkQ2hhclJlcGxhY2VDbnQsXG5cdFx0XHRyZXBsYWNlTmV4dENoYXJDbnQ6IDAsXG5cdFx0XHRwb3NpdGlvbkRlbHRhOiAwLFxuXHRcdH0pO1xuXG5cdFx0dGV4dEFyZWEuZGlzcG9zZSgpO1xuXHR9XG5cblx0dGVzdCgnZXh0cmFjdE5ld1RleHQgLSBubyBwcmV2aW91cyBzdGF0ZSB3aXRoIHNlbGVjdGlvbicsICgpID0+IHtcblx0XHR0ZXN0RGVkdWNlSW5wdXQoXG5cdFx0XHRudWxsLFxuXHRcdFx0J2EnLFxuXHRcdFx0MCwgMSwgdHJ1ZSxcblx0XHRcdCdhJywgMFxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMyNTg2OiBSZXBsYWNpbmcgc2VsZWN0ZWQgZW5kLW9mLWxpbmUgd2l0aCBuZXdsaW5lIGxvY2tzIHVwIHRoZSBkb2N1bWVudCcsICgpID0+IHtcblx0XHR0ZXN0RGVkdWNlSW5wdXQoXG5cdFx0XHRuZXcgVGV4dEFyZWFTdGF0ZSgnXVxcbicsIDEsIDIsIG51bGwsIHVuZGVmaW5lZCksXG5cdFx0XHQnXVxcbicsXG5cdFx0XHQyLCAyLCB0cnVlLFxuXHRcdFx0J1xcbicsIDBcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdleHRyYWN0TmV3VGV4dCAtIG5vIHByZXZpb3VzIHN0YXRlIHdpdGhvdXQgc2VsZWN0aW9uJywgKCkgPT4ge1xuXHRcdHRlc3REZWR1Y2VJbnB1dChcblx0XHRcdG51bGwsXG5cdFx0XHQnYScsXG5cdFx0XHQxLCAxLCB0cnVlLFxuXHRcdFx0J2EnLCAwXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnZXh0cmFjdE5ld1RleHQgLSB0eXBpbmcgZG9lcyBub3QgY2F1c2UgYSBzZWxlY3Rpb24nLCAoKSA9PiB7XG5cdFx0dGVzdERlZHVjZUlucHV0KFxuXHRcdFx0VGV4dEFyZWFTdGF0ZS5FTVBUWSxcblx0XHRcdCdhJyxcblx0XHRcdDAsIDEsIHRydWUsXG5cdFx0XHQnYScsIDBcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdleHRyYWN0TmV3VGV4dCAtIGhhZCB0aGUgdGV4dGFyZWEgZW1wdHknLCAoKSA9PiB7XG5cdFx0dGVzdERlZHVjZUlucHV0KFxuXHRcdFx0VGV4dEFyZWFTdGF0ZS5FTVBUWSxcblx0XHRcdCdhJyxcblx0XHRcdDEsIDEsIHRydWUsXG5cdFx0XHQnYScsIDBcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdleHRyYWN0TmV3VGV4dCAtIGhhZCB0aGUgZW50aXJlIGxpbmUgc2VsZWN0ZWQnLCAoKSA9PiB7XG5cdFx0dGVzdERlZHVjZUlucHV0KFxuXHRcdFx0bmV3IFRleHRBcmVhU3RhdGUoJ0hlbGxvIHdvcmxkIScsIDAsIDEyLCBudWxsLCB1bmRlZmluZWQpLFxuXHRcdFx0J0gnLFxuXHRcdFx0MSwgMSwgdHJ1ZSxcblx0XHRcdCdIJywgMFxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2V4dHJhY3ROZXdUZXh0IC0gaGFkIHByZXZpb3VzIHRleHQgMScsICgpID0+IHtcblx0XHR0ZXN0RGVkdWNlSW5wdXQoXG5cdFx0XHRuZXcgVGV4dEFyZWFTdGF0ZSgnSGVsbG8gd29ybGQhJywgMTIsIDEyLCBudWxsLCB1bmRlZmluZWQpLFxuXHRcdFx0J0hlbGxvIHdvcmxkIWEnLFxuXHRcdFx0MTMsIDEzLCB0cnVlLFxuXHRcdFx0J2EnLCAwXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnZXh0cmFjdE5ld1RleHQgLSBoYWQgcHJldmlvdXMgdGV4dCAyJywgKCkgPT4ge1xuXHRcdHRlc3REZWR1Y2VJbnB1dChcblx0XHRcdG5ldyBUZXh0QXJlYVN0YXRlKCdIZWxsbyB3b3JsZCEnLCAwLCAwLCBudWxsLCB1bmRlZmluZWQpLFxuXHRcdFx0J2FIZWxsbyB3b3JsZCEnLFxuXHRcdFx0MSwgMSwgdHJ1ZSxcblx0XHRcdCdhJywgMFxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2V4dHJhY3ROZXdUZXh0IC0gaGFkIHByZXZpb3VzIHRleHQgMycsICgpID0+IHtcblx0XHR0ZXN0RGVkdWNlSW5wdXQoXG5cdFx0XHRuZXcgVGV4dEFyZWFTdGF0ZSgnSGVsbG8gd29ybGQhJywgNiwgMTEsIG51bGwsIHVuZGVmaW5lZCksXG5cdFx0XHQnSGVsbG8gb3RoZXIhJyxcblx0XHRcdDExLCAxMSwgdHJ1ZSxcblx0XHRcdCdvdGhlcicsIDBcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdleHRyYWN0TmV3VGV4dCAtIElNRScsICgpID0+IHtcblx0XHR0ZXN0RGVkdWNlSW5wdXQoXG5cdFx0XHRUZXh0QXJlYVN0YXRlLkVNUFRZLFxuXHRcdFx0J1x1MzA1M1x1MzA4Q1x1MzA2RicsXG5cdFx0XHQzLCAzLCB0cnVlLFxuXHRcdFx0J1x1MzA1M1x1MzA4Q1x1MzA2RicsIDBcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdleHRyYWN0TmV3VGV4dCAtIGlzSW5PdmVyd3JpdGVNb2RlJywgKCkgPT4ge1xuXHRcdHRlc3REZWR1Y2VJbnB1dChcblx0XHRcdG5ldyBUZXh0QXJlYVN0YXRlKCdIZWxsbyB3b3JsZCEnLCAwLCAwLCBudWxsLCB1bmRlZmluZWQpLFxuXHRcdFx0J0FlbGxvIHdvcmxkIScsXG5cdFx0XHQxLCAxLCB0cnVlLFxuXHRcdFx0J0EnLCAwXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnZXh0cmFjdE1hY1JlcGxhY2VkVGV4dCAtIGRvZXMgbm90aGluZyBpZiB0aGVyZSBpcyBzZWxlY3Rpb24nLCAoKSA9PiB7XG5cdFx0dGVzdERlZHVjZUlucHV0KFxuXHRcdFx0bmV3IFRleHRBcmVhU3RhdGUoJ0hlbGxvIHdvcmxkIScsIDUsIDUsIG51bGwsIHVuZGVmaW5lZCksXG5cdFx0XHQnSGVsbFx1MDBGNiB3b3JsZCEnLFxuXHRcdFx0NCwgNSwgdHJ1ZSxcblx0XHRcdCdcdTAwRjYnLCAwXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnZXh0cmFjdE1hY1JlcGxhY2VkVGV4dCAtIGRvZXMgbm90aGluZyBpZiB0aGVyZSBpcyBtb3JlIHRoYW4gb25lIGV4dHJhIGNoYXInLCAoKSA9PiB7XG5cdFx0dGVzdERlZHVjZUlucHV0KFxuXHRcdFx0bmV3IFRleHRBcmVhU3RhdGUoJ0hlbGxvIHdvcmxkIScsIDUsIDUsIG51bGwsIHVuZGVmaW5lZCksXG5cdFx0XHQnSGVsbFx1MDBGNlx1MDBGNiB3b3JsZCEnLFxuXHRcdFx0NSwgNSwgdHJ1ZSxcblx0XHRcdCdcdTAwRjZcdTAwRjYnLCAxXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnZXh0cmFjdE1hY1JlcGxhY2VkVGV4dCAtIGRvZXMgbm90aGluZyBpZiB0aGVyZSBpcyBtb3JlIHRoYW4gb25lIGNoYW5nZWQgY2hhcicsICgpID0+IHtcblx0XHR0ZXN0RGVkdWNlSW5wdXQoXG5cdFx0XHRuZXcgVGV4dEFyZWFTdGF0ZSgnSGVsbG8gd29ybGQhJywgNSwgNSwgbnVsbCwgdW5kZWZpbmVkKSxcblx0XHRcdCdIZWxcdTAwRjZcdTAwRjYgd29ybGQhJyxcblx0XHRcdDUsIDUsIHRydWUsXG5cdFx0XHQnXHUwMEY2XHUwMEY2JywgMlxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2V4dHJhY3RNYWNSZXBsYWNlZFRleHQnLCAoKSA9PiB7XG5cdFx0dGVzdERlZHVjZUlucHV0KFxuXHRcdFx0bmV3IFRleHRBcmVhU3RhdGUoJ0hlbGxvIHdvcmxkIScsIDUsIDUsIG51bGwsIHVuZGVmaW5lZCksXG5cdFx0XHQnSGVsbFx1MDBGNiB3b3JsZCEnLFxuXHRcdFx0NSwgNSwgdHJ1ZSxcblx0XHRcdCdcdTAwRjYnLCAxXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzI1MTAxIC0gRmlyc3Qga2V5IHByZXNzIGlnbm9yZWQnLCAoKSA9PiB7XG5cdFx0dGVzdERlZHVjZUlucHV0KFxuXHRcdFx0bmV3IFRleHRBcmVhU3RhdGUoJ2EnLCAwLCAxLCBudWxsLCB1bmRlZmluZWQpLFxuXHRcdFx0J2EnLFxuXHRcdFx0MSwgMSwgdHJ1ZSxcblx0XHRcdCdhJywgMFxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxNjUyMCAtIENtZC1kIG9mIHNpbmdsZSBjaGFyYWN0ZXIgZm9sbG93ZWQgYnkgdHlwaW5nIHNhbWUgY2hhcmFjdGVyIGFzIGhhcyBubyBlZmZlY3QnLCAoKSA9PiB7XG5cdFx0dGVzdERlZHVjZUlucHV0KFxuXHRcdFx0bmV3IFRleHRBcmVhU3RhdGUoJ3ggeCcsIDAsIDEsIG51bGwsIHVuZGVmaW5lZCksXG5cdFx0XHQneCB4Jyxcblx0XHRcdDEsIDEsIHRydWUsXG5cdFx0XHQneCcsIDBcblx0XHQpO1xuXHR9KTtcblxuXHRmdW5jdGlvbiB0ZXN0RGVkdWNlQW5kcm9pZENvbXBvc2l0aW9uSW5wdXQoXG5cdFx0cHJldlN0YXRlOiBUZXh0QXJlYVN0YXRlIHwgbnVsbCxcblx0XHR2YWx1ZTogc3RyaW5nLCBzZWxlY3Rpb25TdGFydDogbnVtYmVyLCBzZWxlY3Rpb25FbmQ6IG51bWJlcixcblx0XHRleHBlY3RlZDogc3RyaW5nLCBleHBlY3RlZFJlcGxhY2VQcmV2Q2hhckNudDogbnVtYmVyLCBleHBlY3RlZFJlcGxhY2VOZXh0Q2hhckNudDogbnVtYmVyLCBleHBlY3RlZFBvc2l0aW9uRGVsdGE6IG51bWJlcik6IHZvaWQge1xuXHRcdHByZXZTdGF0ZSA9IHByZXZTdGF0ZSB8fCBUZXh0QXJlYVN0YXRlLkVNUFRZO1xuXG5cdFx0Y29uc3QgdGV4dEFyZWEgPSBuZXcgTW9ja1RleHRBcmVhV3JhcHBlcigpO1xuXHRcdHRleHRBcmVhLl92YWx1ZSA9IHZhbHVlO1xuXHRcdHRleHRBcmVhLl9zZWxlY3Rpb25TdGFydCA9IHNlbGVjdGlvblN0YXJ0O1xuXHRcdHRleHRBcmVhLl9zZWxlY3Rpb25FbmQgPSBzZWxlY3Rpb25FbmQ7XG5cblx0XHRjb25zdCBuZXdTdGF0ZSA9IFRleHRBcmVhU3RhdGUucmVhZEZyb21UZXh0QXJlYSh0ZXh0QXJlYSwgbnVsbCk7XG5cdFx0Y29uc3QgYWN0dWFsID0gVGV4dEFyZWFTdGF0ZS5kZWR1Y2VBbmRyb2lkQ29tcG9zaXRpb25JbnB1dChwcmV2U3RhdGUsIG5ld1N0YXRlKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCB7XG5cdFx0XHR0ZXh0OiBleHBlY3RlZCxcblx0XHRcdHJlcGxhY2VQcmV2Q2hhckNudDogZXhwZWN0ZWRSZXBsYWNlUHJldkNoYXJDbnQsXG5cdFx0XHRyZXBsYWNlTmV4dENoYXJDbnQ6IGV4cGVjdGVkUmVwbGFjZU5leHRDaGFyQ250LFxuXHRcdFx0cG9zaXRpb25EZWx0YTogZXhwZWN0ZWRQb3NpdGlvbkRlbHRhLFxuXHRcdH0pO1xuXG5cdFx0dGV4dEFyZWEuZGlzcG9zZSgpO1xuXHR9XG5cblx0dGVzdCgnQW5kcm9pZCBjb21wb3NpdGlvbiBpbnB1dCAxJywgKCkgPT4ge1xuXHRcdHRlc3REZWR1Y2VBbmRyb2lkQ29tcG9zaXRpb25JbnB1dChcblx0XHRcdG5ldyBUZXh0QXJlYVN0YXRlKCdNaWNyb3NvZnQnLCA0LCA0LCBudWxsLCB1bmRlZmluZWQpLFxuXHRcdFx0J01pY3Jvc29mdCcsXG5cdFx0XHQ0LCA0LFxuXHRcdFx0JycsIDAsIDAsIDAsXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnQW5kcm9pZCBjb21wb3NpdGlvbiBpbnB1dCAyJywgKCkgPT4ge1xuXHRcdHRlc3REZWR1Y2VBbmRyb2lkQ29tcG9zaXRpb25JbnB1dChcblx0XHRcdG5ldyBUZXh0QXJlYVN0YXRlKCdNaWNyb3NvZnQnLCA0LCA0LCBudWxsLCB1bmRlZmluZWQpLFxuXHRcdFx0J01pY3Jvc29mdCcsXG5cdFx0XHQwLCA5LFxuXHRcdFx0JycsIDAsIDAsIDUsXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnQW5kcm9pZCBjb21wb3NpdGlvbiBpbnB1dCAzJywgKCkgPT4ge1xuXHRcdHRlc3REZWR1Y2VBbmRyb2lkQ29tcG9zaXRpb25JbnB1dChcblx0XHRcdG5ldyBUZXh0QXJlYVN0YXRlKCdNaWNyb3NvZnQnLCAwLCA5LCBudWxsLCB1bmRlZmluZWQpLFxuXHRcdFx0J01pY3Jvc29mdFxcJ3MnLFxuXHRcdFx0MTEsIDExLFxuXHRcdFx0J1xcJ3MnLCAwLCAwLCAwLFxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ0FuZHJvaWQgYmFja3NwYWNlJywgKCkgPT4ge1xuXHRcdHRlc3REZWR1Y2VBbmRyb2lkQ29tcG9zaXRpb25JbnB1dChcblx0XHRcdG5ldyBUZXh0QXJlYVN0YXRlKCd1bmRlZmluZWRWYXJpYWJsZScsIDIsIDIsIG51bGwsIHVuZGVmaW5lZCksXG5cdFx0XHQndWRlZmluZWRWYXJpYWJsZScsXG5cdFx0XHQxLCAxLFxuXHRcdFx0JycsIDEsIDAsIDAsXG5cdFx0KTtcblx0fSk7XG5cblx0c3VpdGUoJ1BhZ2VkU2NyZWVuUmVhZGVyU3RyYXRlZ3knLCAoKSA9PiB7XG5cblx0XHRmdW5jdGlvbiB0ZXN0UGFnZWRTY3JlZW5SZWFkZXJTdHJhdGVneShsaW5lczogc3RyaW5nW10sIHNlbGVjdGlvbjogU2VsZWN0aW9uLCBleHBlY3RlZDogVGV4dEFyZWFTdGF0ZSk6IHZvaWQge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwobGluZXMuam9pbignXFxuJykpO1xuXHRcdFx0Y29uc3Qgc2NyZWVuUmVhZGVyQ29udGVudFN0YXRlID0gUGFnZWRTY3JlZW5SZWFkZXJTdHJhdGVneS5mcm9tRWRpdG9yU2VsZWN0aW9uKG1vZGVsLCBzZWxlY3Rpb24sIDEwLCB0cnVlKTtcblx0XHRcdGNvbnN0IHRleHRBcmVhU3RhdGUgPSBUZXh0QXJlYVN0YXRlLmZyb21TY3JlZW5SZWFkZXJDb250ZW50U3RhdGUoc2NyZWVuUmVhZGVyQ29udGVudFN0YXRlKTtcblx0XHRcdGFzc2VydC5vayhlcXVhbHNUZXh0QXJlYVN0YXRlKHRleHRBcmVhU3RhdGUsIGV4cGVjdGVkKSk7XG5cdFx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdFx0fVxuXG5cdFx0dGVzdCgnc2ltcGxlJywgKCkgPT4ge1xuXHRcdFx0dGVzdFBhZ2VkU2NyZWVuUmVhZGVyU3RyYXRlZ3koXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQnSGVsbG8gd29ybGQhJ1xuXHRcdFx0XHRdLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEzLCAxLCAxMyksXG5cdFx0XHRcdG5ldyBUZXh0QXJlYVN0YXRlKCdIZWxsbyB3b3JsZCEnLCAxMiwgMTIsIG5ldyBSYW5nZSgxLCAxMywgMSwgMTMpLCAwKVxuXHRcdFx0KTtcblxuXHRcdFx0dGVzdFBhZ2VkU2NyZWVuUmVhZGVyU3RyYXRlZ3koXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQnSGVsbG8gd29ybGQhJ1xuXHRcdFx0XHRdLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpLFxuXHRcdFx0XHRuZXcgVGV4dEFyZWFTdGF0ZSgnSGVsbG8gd29ybGQhJywgMCwgMCwgbmV3IFJhbmdlKDEsIDEsIDEsIDEpLCAwKVxuXHRcdFx0KTtcblxuXHRcdFx0dGVzdFBhZ2VkU2NyZWVuUmVhZGVyU3RyYXRlZ3koXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQnSGVsbG8gd29ybGQhJ1xuXHRcdFx0XHRdLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDYpLFxuXHRcdFx0XHRuZXcgVGV4dEFyZWFTdGF0ZSgnSGVsbG8gd29ybGQhJywgMCwgNSwgbmV3IFJhbmdlKDEsIDEsIDEsIDYpLCAwKVxuXHRcdFx0KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ211bHRpbGluZScsICgpID0+IHtcblx0XHRcdHRlc3RQYWdlZFNjcmVlblJlYWRlclN0cmF0ZWd5KFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0J0hlbGxvIHdvcmxkIScsXG5cdFx0XHRcdFx0J0hvdyBhcmUgeW91Pydcblx0XHRcdFx0XSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSxcblx0XHRcdFx0bmV3IFRleHRBcmVhU3RhdGUoJ0hlbGxvIHdvcmxkIVxcbkhvdyBhcmUgeW91PycsIDAsIDAsIG5ldyBSYW5nZSgxLCAxLCAxLCAxKSwgMClcblx0XHRcdCk7XG5cblx0XHRcdHRlc3RQYWdlZFNjcmVlblJlYWRlclN0cmF0ZWd5KFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0J0hlbGxvIHdvcmxkIScsXG5cdFx0XHRcdFx0J0hvdyBhcmUgeW91Pydcblx0XHRcdFx0XSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCAxLCAyLCAxKSxcblx0XHRcdFx0bmV3IFRleHRBcmVhU3RhdGUoJ0hlbGxvIHdvcmxkIVxcbkhvdyBhcmUgeW91PycsIDEzLCAxMywgbmV3IFJhbmdlKDIsIDEsIDIsIDEpLCAxKVxuXHRcdFx0KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3BhZ2UnLCAoKSA9PiB7XG5cdFx0XHR0ZXN0UGFnZWRTY3JlZW5SZWFkZXJTdHJhdGVneShcblx0XHRcdFx0W1xuXHRcdFx0XHRcdCdMMVxcbkwyXFxuTDNcXG5MNFxcbkw1XFxuTDZcXG5MN1xcbkw4XFxuTDlcXG5MMTBcXG5MMTFcXG5MMTJcXG5MMTNcXG5MMTRcXG5MMTVcXG5MMTZcXG5MMTdcXG5MMThcXG5MMTlcXG5MMjBcXG5MMjEnXG5cdFx0XHRcdF0sXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSksXG5cdFx0XHRcdG5ldyBUZXh0QXJlYVN0YXRlKCdMMVxcbkwyXFxuTDNcXG5MNFxcbkw1XFxuTDZcXG5MN1xcbkw4XFxuTDlcXG5MMTBcXG4nLCAwLCAwLCBuZXcgUmFuZ2UoMSwgMSwgMSwgMSksIDApXG5cdFx0XHQpO1xuXG5cdFx0XHR0ZXN0UGFnZWRTY3JlZW5SZWFkZXJTdHJhdGVneShcblx0XHRcdFx0W1xuXHRcdFx0XHRcdCdMMVxcbkwyXFxuTDNcXG5MNFxcbkw1XFxuTDZcXG5MN1xcbkw4XFxuTDlcXG5MMTBcXG5MMTFcXG5MMTJcXG5MMTNcXG5MMTRcXG5MMTVcXG5MMTZcXG5MMTdcXG5MMThcXG5MMTlcXG5MMjBcXG5MMjEnXG5cdFx0XHRcdF0sXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMTEsIDEsIDExLCAxKSxcblx0XHRcdFx0bmV3IFRleHRBcmVhU3RhdGUoJ0wxMVxcbkwxMlxcbkwxM1xcbkwxNFxcbkwxNVxcbkwxNlxcbkwxN1xcbkwxOFxcbkwxOVxcbkwyMFxcbicsIDAsIDAsIG5ldyBSYW5nZSgxMSwgMSwgMTEsIDEpLCAwKVxuXHRcdFx0KTtcblxuXHRcdFx0dGVzdFBhZ2VkU2NyZWVuUmVhZGVyU3RyYXRlZ3koXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQnTDFcXG5MMlxcbkwzXFxuTDRcXG5MNVxcbkw2XFxuTDdcXG5MOFxcbkw5XFxuTDEwXFxuTDExXFxuTDEyXFxuTDEzXFxuTDE0XFxuTDE1XFxuTDE2XFxuTDE3XFxuTDE4XFxuTDE5XFxuTDIwXFxuTDIxJ1xuXHRcdFx0XHRdLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEyLCAxLCAxMiwgMSksXG5cdFx0XHRcdG5ldyBUZXh0QXJlYVN0YXRlKCdMMTFcXG5MMTJcXG5MMTNcXG5MMTRcXG5MMTVcXG5MMTZcXG5MMTdcXG5MMThcXG5MMTlcXG5MMjBcXG4nLCA0LCA0LCBuZXcgUmFuZ2UoMTIsIDEsIDEyLCAxKSwgMSlcblx0XHRcdCk7XG5cblx0XHRcdHRlc3RQYWdlZFNjcmVlblJlYWRlclN0cmF0ZWd5KFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0J0wxXFxuTDJcXG5MM1xcbkw0XFxuTDVcXG5MNlxcbkw3XFxuTDhcXG5MOVxcbkwxMFxcbkwxMVxcbkwxMlxcbkwxM1xcbkwxNFxcbkwxNVxcbkwxNlxcbkwxN1xcbkwxOFxcbkwxOVxcbkwyMFxcbkwyMSdcblx0XHRcdFx0XSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigyMSwgMSwgMjEsIDEpLFxuXHRcdFx0XHRuZXcgVGV4dEFyZWFTdGF0ZSgnTDIxJywgMCwgMCwgbmV3IFJhbmdlKDIxLCAxLCAyMSwgMSksIDApXG5cdFx0XHQpO1xuXHRcdH0pO1xuXG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUywrQ0FBK0M7QUFDeEQsU0FBMkIscUJBQXFCO0FBQ2hELFNBQVMsYUFBYTtBQUN0QixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGlDQUFpQztBQUUxQyxNQUFNLDRCQUE0QixXQUF1QztBQUFB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
