import assert from "assert";
import { mock } from "../../../../../base/test/common/mock.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { Position } from "../../../../common/core/position.js";
import { Range } from "../../../../common/core/range.js";
import { Selection } from "../../../../common/core/selection.js";
import { ILanguageConfigurationService } from "../../../../common/languages/languageConfigurationRegistry.js";
import { SnippetParser } from "../../browser/snippetParser.js";
import { SnippetSession } from "../../browser/snippetSession.js";
import { createTestCodeEditor } from "../../../../test/browser/testCodeEditor.js";
import { TestLanguageConfigurationService } from "../../../../test/common/modes/testLanguageConfigurationService.js";
import { createTextModel } from "../../../../test/common/testTextModel.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
suite("SnippetSession", function() {
  let languageConfigurationService;
  let editor;
  let model;
  function assertSelections(editor2, ...s) {
    for (const selection of editor2.getSelections()) {
      const actual = s.shift();
      assert.ok(selection.equalsSelection(actual), `actual=${selection.toString()} <> expected=${actual.toString()}`);
    }
    assert.strictEqual(s.length, 0);
  }
  setup(function() {
    model = createTextModel("function foo() {\n    console.log(a);\n}");
    languageConfigurationService = new TestLanguageConfigurationService();
    const serviceCollection = new ServiceCollection(
      [ILabelService, new class extends mock() {
      }()],
      [ILanguageConfigurationService, languageConfigurationService],
      [IWorkspaceContextService, new class extends mock() {
        getWorkspace() {
          return {
            id: "workspace-id",
            folders: []
          };
        }
      }()]
    );
    editor = createTestCodeEditor(model, { serviceCollection });
    editor.setSelections([new Selection(1, 1, 1, 1), new Selection(2, 5, 2, 5)]);
    assert.strictEqual(model.getEOL(), "\n");
  });
  teardown(function() {
    model.dispose();
    editor.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("normalize whitespace", function() {
    function assertNormalized(position, input, expected) {
      const snippet = new SnippetParser().parse(input);
      SnippetSession.adjustWhitespace(model, position, true, snippet);
      assert.strictEqual(snippet.toTextmateString(), expected);
    }
    assertNormalized(new Position(1, 1), "foo", "foo");
    assertNormalized(new Position(1, 1), "foo\rbar", "foo\nbar");
    assertNormalized(new Position(1, 1), "foo\rbar", "foo\nbar");
    assertNormalized(new Position(2, 5), "foo\r	bar", "foo\n        bar");
    assertNormalized(new Position(2, 3), "foo\r	bar", "foo\n    bar");
    assertNormalized(new Position(2, 5), "foo\r	bar\nfoo", "foo\n        bar\n    foo");
    assertNormalized(new Position(2, 5), "a\nb${1|foo,\nbar|}", "a\n    b${1|foo,\nbar|}");
  });
  test("adjust selection (overwrite[Before|After])", function() {
    let range = SnippetSession.adjustSelection(model, new Selection(1, 2, 1, 2), 1, 0);
    assert.ok(range.equalsRange(new Range(1, 1, 1, 2)));
    range = SnippetSession.adjustSelection(model, new Selection(1, 2, 1, 2), 1111, 0);
    assert.ok(range.equalsRange(new Range(1, 1, 1, 2)));
    range = SnippetSession.adjustSelection(model, new Selection(1, 2, 1, 2), 0, 10);
    assert.ok(range.equalsRange(new Range(1, 2, 1, 12)));
    range = SnippetSession.adjustSelection(model, new Selection(1, 2, 1, 2), 0, 10111);
    assert.ok(range.equalsRange(new Range(1, 2, 1, 17)));
  });
  test("text edits & selection", function() {
    const session = new SnippetSession(editor, "foo${1:bar}foo$0", void 0, languageConfigurationService);
    session.insert();
    assert.strictEqual(editor.getModel().getValue(), "foobarfoofunction foo() {\n    foobarfooconsole.log(a);\n}");
    assertSelections(editor, new Selection(1, 4, 1, 7), new Selection(2, 8, 2, 11));
    session.next();
    assertSelections(editor, new Selection(1, 10, 1, 10), new Selection(2, 14, 2, 14));
  });
  test("text edit with reversed selection", function() {
    const session = new SnippetSession(editor, "${1:bar}$0", void 0, languageConfigurationService);
    editor.setSelections([new Selection(2, 5, 2, 5), new Selection(1, 1, 1, 1)]);
    session.insert();
    assert.strictEqual(model.getValue(), "barfunction foo() {\n    barconsole.log(a);\n}");
    assertSelections(editor, new Selection(2, 5, 2, 8), new Selection(1, 1, 1, 4));
  });
  test("snippets, repeated tabstops", function() {
    const session = new SnippetSession(editor, "${1:abc}foo${1:abc}$0", void 0, languageConfigurationService);
    session.insert();
    assertSelections(
      editor,
      new Selection(1, 1, 1, 4),
      new Selection(1, 7, 1, 10),
      new Selection(2, 5, 2, 8),
      new Selection(2, 11, 2, 14)
    );
    session.next();
    assertSelections(
      editor,
      new Selection(1, 10, 1, 10),
      new Selection(2, 14, 2, 14)
    );
  });
  test("snippets, just text", function() {
    const session = new SnippetSession(editor, "foobar", void 0, languageConfigurationService);
    session.insert();
    assert.strictEqual(model.getValue(), "foobarfunction foo() {\n    foobarconsole.log(a);\n}");
    assertSelections(editor, new Selection(1, 7, 1, 7), new Selection(2, 11, 2, 11));
  });
  test("snippets, selections and new text with newlines", () => {
    const session = new SnippetSession(editor, "foo\n	${1:bar}\n$0", void 0, languageConfigurationService);
    session.insert();
    assert.strictEqual(editor.getModel().getValue(), "foo\n    bar\nfunction foo() {\n    foo\n        bar\n    console.log(a);\n}");
    assertSelections(editor, new Selection(2, 5, 2, 8), new Selection(5, 9, 5, 12));
    session.next();
    assertSelections(editor, new Selection(3, 1, 3, 1), new Selection(6, 5, 6, 5));
  });
  test("snippets, newline NO whitespace adjust", () => {
    editor.setSelection(new Selection(2, 5, 2, 5));
    const session = new SnippetSession(editor, "abc\n    foo\n        bar\n$0", { overwriteBefore: 0, overwriteAfter: 0, adjustWhitespace: false, clipboardText: void 0, overtypingCapturer: void 0 }, languageConfigurationService);
    session.insert();
    assert.strictEqual(editor.getModel().getValue(), "function foo() {\n    abc\n    foo\n        bar\nconsole.log(a);\n}");
  });
  test("snippets, selections -> next/prev", () => {
    const session = new SnippetSession(editor, "f$1oo${2:bar}foo$0", void 0, languageConfigurationService);
    session.insert();
    assertSelections(editor, new Selection(1, 2, 1, 2), new Selection(2, 6, 2, 6));
    session.next();
    assertSelections(editor, new Selection(1, 4, 1, 7), new Selection(2, 8, 2, 11));
    session.prev();
    assertSelections(editor, new Selection(1, 2, 1, 2), new Selection(2, 6, 2, 6));
    session.next();
    assertSelections(editor, new Selection(1, 4, 1, 7), new Selection(2, 8, 2, 11));
    session.next();
    assertSelections(editor, new Selection(1, 10, 1, 10), new Selection(2, 14, 2, 14));
  });
  test("snippets, selections & typing", function() {
    const session = new SnippetSession(editor, "f${1:oo}_$2_$0", void 0, languageConfigurationService);
    session.insert();
    editor.trigger("test", "type", { text: "X" });
    session.next();
    editor.trigger("test", "type", { text: "bar" });
    session.prev();
    assertSelections(editor, new Selection(1, 2, 1, 3), new Selection(2, 6, 2, 7));
    session.next();
    assertSelections(editor, new Selection(1, 4, 1, 7), new Selection(2, 8, 2, 11));
    session.next();
    assert.strictEqual(model.getValue(), "fX_bar_function foo() {\n    fX_bar_console.log(a);\n}");
    assertSelections(editor, new Selection(1, 8, 1, 8), new Selection(2, 12, 2, 12));
  });
  test("snippets, insert shorter snippet into non-empty selection", function() {
    model.setValue("foo_bar_foo");
    editor.setSelections([new Selection(1, 1, 1, 4), new Selection(1, 9, 1, 12)]);
    new SnippetSession(editor, "x$0", void 0, languageConfigurationService).insert();
    assert.strictEqual(model.getValue(), "x_bar_x");
    assertSelections(editor, new Selection(1, 2, 1, 2), new Selection(1, 8, 1, 8));
  });
  test("snippets, insert longer snippet into non-empty selection", function() {
    model.setValue("foo_bar_foo");
    editor.setSelections([new Selection(1, 1, 1, 4), new Selection(1, 9, 1, 12)]);
    new SnippetSession(editor, "LONGER$0", void 0, languageConfigurationService).insert();
    assert.strictEqual(model.getValue(), "LONGER_bar_LONGER");
    assertSelections(editor, new Selection(1, 7, 1, 7), new Selection(1, 18, 1, 18));
  });
  test("snippets, don't grow final tabstop", function() {
    model.setValue("foo_zzz_foo");
    editor.setSelection(new Selection(1, 5, 1, 8));
    const session = new SnippetSession(editor, "$1bar$0", void 0, languageConfigurationService);
    session.insert();
    assertSelections(editor, new Selection(1, 5, 1, 5));
    editor.trigger("test", "type", { text: "foo-" });
    session.next();
    assert.strictEqual(model.getValue(), "foo_foo-bar_foo");
    assertSelections(editor, new Selection(1, 12, 1, 12));
    editor.trigger("test", "type", { text: "XXX" });
    assert.strictEqual(model.getValue(), "foo_foo-barXXX_foo");
    session.prev();
    assertSelections(editor, new Selection(1, 5, 1, 9));
    session.next();
    assertSelections(editor, new Selection(1, 15, 1, 15));
  });
  test("snippets, don't merge touching tabstops 1/2", function() {
    const session = new SnippetSession(editor, "$1$2$3$0", void 0, languageConfigurationService);
    session.insert();
    assertSelections(editor, new Selection(1, 1, 1, 1), new Selection(2, 5, 2, 5));
    session.next();
    assertSelections(editor, new Selection(1, 1, 1, 1), new Selection(2, 5, 2, 5));
    session.next();
    assertSelections(editor, new Selection(1, 1, 1, 1), new Selection(2, 5, 2, 5));
    session.next();
    assertSelections(editor, new Selection(1, 1, 1, 1), new Selection(2, 5, 2, 5));
    session.prev();
    session.prev();
    session.prev();
    assertSelections(editor, new Selection(1, 1, 1, 1), new Selection(2, 5, 2, 5));
    editor.trigger("test", "type", { text: "111" });
    session.next();
    editor.trigger("test", "type", { text: "222" });
    session.next();
    editor.trigger("test", "type", { text: "333" });
    session.next();
    assert.strictEqual(model.getValue(), "111222333function foo() {\n    111222333console.log(a);\n}");
    assertSelections(editor, new Selection(1, 10, 1, 10), new Selection(2, 14, 2, 14));
    session.prev();
    assertSelections(editor, new Selection(1, 7, 1, 10), new Selection(2, 11, 2, 14));
    session.prev();
    assertSelections(editor, new Selection(1, 4, 1, 7), new Selection(2, 8, 2, 11));
    session.prev();
    assertSelections(editor, new Selection(1, 1, 1, 4), new Selection(2, 5, 2, 8));
  });
  test("snippets, don't merge touching tabstops 2/2", function() {
    const session = new SnippetSession(editor, "$1$2$3$0", void 0, languageConfigurationService);
    session.insert();
    assertSelections(editor, new Selection(1, 1, 1, 1), new Selection(2, 5, 2, 5));
    editor.trigger("test", "type", { text: "111" });
    session.next();
    assertSelections(editor, new Selection(1, 4, 1, 4), new Selection(2, 8, 2, 8));
    editor.trigger("test", "type", { text: "222" });
    session.next();
    assertSelections(editor, new Selection(1, 7, 1, 7), new Selection(2, 11, 2, 11));
    editor.trigger("test", "type", { text: "333" });
    session.next();
    assert.strictEqual(session.isAtLastPlaceholder, true);
  });
  test("snippets, gracefully move over final tabstop", function() {
    const session = new SnippetSession(editor, "${1}bar$0", void 0, languageConfigurationService);
    session.insert();
    assert.strictEqual(session.isAtLastPlaceholder, false);
    assertSelections(editor, new Selection(1, 1, 1, 1), new Selection(2, 5, 2, 5));
    session.next();
    assert.strictEqual(session.isAtLastPlaceholder, true);
    assertSelections(editor, new Selection(1, 4, 1, 4), new Selection(2, 8, 2, 8));
    session.next();
    assert.strictEqual(session.isAtLastPlaceholder, true);
    assertSelections(editor, new Selection(1, 4, 1, 4), new Selection(2, 8, 2, 8));
  });
  test("snippets, overwriting nested placeholder", function() {
    const session = new SnippetSession(editor, 'log(${1:"$2"});$0', void 0, languageConfigurationService);
    session.insert();
    assertSelections(editor, new Selection(1, 5, 1, 7), new Selection(2, 9, 2, 11));
    editor.trigger("test", "type", { text: "XXX" });
    assert.strictEqual(model.getValue(), "log(XXX);function foo() {\n    log(XXX);console.log(a);\n}");
    session.next();
    assert.strictEqual(session.isAtLastPlaceholder, false);
    session.next();
    assert.strictEqual(session.isAtLastPlaceholder, true);
    assertSelections(editor, new Selection(1, 10, 1, 10), new Selection(2, 14, 2, 14));
  });
  test("snippets, selections and snippet ranges", function() {
    const session = new SnippetSession(editor, "${1:foo}farboo${2:bar}$0", void 0, languageConfigurationService);
    session.insert();
    assert.strictEqual(model.getValue(), "foofarboobarfunction foo() {\n    foofarboobarconsole.log(a);\n}");
    assertSelections(editor, new Selection(1, 1, 1, 4), new Selection(2, 5, 2, 8));
    assert.strictEqual(session.isSelectionWithinPlaceholders(), true);
    editor.setSelections([new Selection(1, 1, 1, 1)]);
    assert.strictEqual(session.isSelectionWithinPlaceholders(), false);
    editor.setSelections([new Selection(1, 6, 1, 6), new Selection(2, 10, 2, 10)]);
    assert.strictEqual(session.isSelectionWithinPlaceholders(), false);
    editor.setSelections([new Selection(1, 6, 1, 6), new Selection(2, 10, 2, 10), new Selection(1, 1, 1, 1)]);
    assert.strictEqual(session.isSelectionWithinPlaceholders(), false);
    editor.setSelections([new Selection(1, 6, 1, 6), new Selection(2, 10, 2, 10), new Selection(2, 20, 2, 21)]);
    assert.strictEqual(session.isSelectionWithinPlaceholders(), false);
    session.next();
    assert.strictEqual(session.isSelectionWithinPlaceholders(), true);
    assertSelections(editor, new Selection(1, 10, 1, 13), new Selection(2, 14, 2, 17));
    session.next();
    assert.strictEqual(session.isSelectionWithinPlaceholders(), true);
    assert.strictEqual(session.isAtLastPlaceholder, true);
    assertSelections(editor, new Selection(1, 13, 1, 13), new Selection(2, 17, 2, 17));
  });
  test("snippets, nested sessions", function() {
    model.setValue("");
    editor.setSelection(new Selection(1, 1, 1, 1));
    const first = new SnippetSession(editor, "foo${2:bar}foo$0", void 0, languageConfigurationService);
    first.insert();
    assert.strictEqual(model.getValue(), "foobarfoo");
    assertSelections(editor, new Selection(1, 4, 1, 7));
    const second = new SnippetSession(editor, "ba${1:zzzz}$0", void 0, languageConfigurationService);
    second.insert();
    assert.strictEqual(model.getValue(), "foobazzzzfoo");
    assertSelections(editor, new Selection(1, 6, 1, 10));
    second.next();
    assert.strictEqual(second.isAtLastPlaceholder, true);
    assertSelections(editor, new Selection(1, 10, 1, 10));
    first.next();
    assert.strictEqual(first.isAtLastPlaceholder, true);
    assertSelections(editor, new Selection(1, 13, 1, 13));
  });
  test("snippets, typing at final tabstop", function() {
    const session = new SnippetSession(editor, "farboo$0", void 0, languageConfigurationService);
    session.insert();
    assert.strictEqual(session.isAtLastPlaceholder, true);
    assert.strictEqual(session.isSelectionWithinPlaceholders(), false);
    editor.trigger("test", "type", { text: "XXX" });
    assert.strictEqual(session.isSelectionWithinPlaceholders(), false);
  });
  test("snippets, typing at beginning", function() {
    editor.setSelection(new Selection(1, 2, 1, 2));
    const session = new SnippetSession(editor, "farboo$0", void 0, languageConfigurationService);
    session.insert();
    editor.setSelection(new Selection(1, 2, 1, 2));
    assert.strictEqual(session.isSelectionWithinPlaceholders(), false);
    assert.strictEqual(session.isAtLastPlaceholder, true);
    editor.trigger("test", "type", { text: "XXX" });
    assert.strictEqual(model.getLineContent(1), "fXXXfarboounction foo() {");
    assert.strictEqual(session.isSelectionWithinPlaceholders(), false);
    session.next();
    assertSelections(editor, new Selection(1, 11, 1, 11));
  });
  test("snippets, typing with nested placeholder", function() {
    editor.setSelection(new Selection(1, 1, 1, 1));
    const session = new SnippetSession(editor, "This ${1:is ${2:nested}}.$0", void 0, languageConfigurationService);
    session.insert();
    assertSelections(editor, new Selection(1, 6, 1, 15));
    session.next();
    assertSelections(editor, new Selection(1, 9, 1, 15));
    editor.trigger("test", "cut", {});
    assertSelections(editor, new Selection(1, 9, 1, 9));
    editor.trigger("test", "type", { text: "XXX" });
    session.prev();
    assertSelections(editor, new Selection(1, 6, 1, 12));
  });
  test("snippets, snippet with variables", function() {
    const session = new SnippetSession(editor, "@line=$TM_LINE_NUMBER$0", void 0, languageConfigurationService);
    session.insert();
    assert.strictEqual(model.getValue(), "@line=1function foo() {\n    @line=2console.log(a);\n}");
    assertSelections(editor, new Selection(1, 8, 1, 8), new Selection(2, 12, 2, 12));
  });
  test("snippets, merge", function() {
    editor.setSelection(new Selection(1, 1, 1, 1));
    const session = new SnippetSession(editor, "This ${1:is ${2:nested}}.$0", void 0, languageConfigurationService);
    session.insert();
    session.next();
    assertSelections(editor, new Selection(1, 9, 1, 15));
    session.merge("really ${1:nested}$0");
    assertSelections(editor, new Selection(1, 16, 1, 22));
    session.next();
    assertSelections(editor, new Selection(1, 22, 1, 22));
    assert.strictEqual(session.isAtLastPlaceholder, false);
    session.next();
    assert.strictEqual(session.isAtLastPlaceholder, true);
    assertSelections(editor, new Selection(1, 23, 1, 23));
    session.prev();
    editor.trigger("test", "type", { text: "AAA" });
    session.prev();
    assertSelections(editor, new Selection(1, 16, 1, 22));
    session.prev();
    assertSelections(editor, new Selection(1, 6, 1, 25));
  });
  test("snippets, transform", function() {
    editor.getModel().setValue("");
    editor.setSelection(new Selection(1, 1, 1, 1));
    const session = new SnippetSession(editor, "${1/foo/bar/}$0", void 0, languageConfigurationService);
    session.insert();
    assertSelections(editor, new Selection(1, 1, 1, 1));
    editor.trigger("test", "type", { text: "foo" });
    session.next();
    assert.strictEqual(model.getValue(), "bar");
    assert.strictEqual(session.isAtLastPlaceholder, true);
    assertSelections(editor, new Selection(1, 4, 1, 4));
  });
  test("snippets, multi placeholder same index one transform", function() {
    editor.getModel().setValue("");
    editor.setSelection(new Selection(1, 1, 1, 1));
    const session = new SnippetSession(editor, "$1 baz ${1/foo/bar/}$0", void 0, languageConfigurationService);
    session.insert();
    assertSelections(editor, new Selection(1, 1, 1, 1), new Selection(1, 6, 1, 6));
    editor.trigger("test", "type", { text: "foo" });
    session.next();
    assert.strictEqual(model.getValue(), "foo baz bar");
    assert.strictEqual(session.isAtLastPlaceholder, true);
    assertSelections(editor, new Selection(1, 12, 1, 12));
  });
  test("snippets, transform example", function() {
    editor.getModel().setValue("");
    editor.setSelection(new Selection(1, 1, 1, 1));
    const session = new SnippetSession(editor, "${1:name} : ${2:type}${3/\\s:=(.*)/${1:+ :=}${1}/};\n$0", void 0, languageConfigurationService);
    session.insert();
    assertSelections(editor, new Selection(1, 1, 1, 5));
    editor.trigger("test", "type", { text: "clk" });
    session.next();
    assertSelections(editor, new Selection(1, 7, 1, 11));
    editor.trigger("test", "type", { text: "std_logic" });
    session.next();
    assertSelections(editor, new Selection(1, 16, 1, 16));
    session.next();
    assert.strictEqual(model.getValue(), "clk : std_logic;\n");
    assert.strictEqual(session.isAtLastPlaceholder, true);
    assertSelections(editor, new Selection(2, 1, 2, 1));
  });
  test("snippets, transform with indent", function() {
    const snippet = [
      "private readonly ${1} = new Emitter<$2>();",
      "readonly ${1/^_(.*)/$1/}: Event<$2> = this.$1.event;",
      "$0"
    ].join("\n");
    const expected = [
      "{",
      "	private readonly _prop = new Emitter<string>();",
      "	readonly prop: Event<string> = this._prop.event;",
      "	",
      "}"
    ].join("\n");
    const base = [
      "{",
      "	",
      "}"
    ].join("\n");
    editor.getModel().setValue(base);
    editor.getModel().updateOptions({ insertSpaces: false });
    editor.setSelection(new Selection(2, 2, 2, 2));
    const session = new SnippetSession(editor, snippet, void 0, languageConfigurationService);
    session.insert();
    assertSelections(editor, new Selection(2, 19, 2, 19), new Selection(3, 11, 3, 11), new Selection(3, 28, 3, 28));
    editor.trigger("test", "type", { text: "_prop" });
    session.next();
    assertSelections(editor, new Selection(2, 39, 2, 39), new Selection(3, 23, 3, 23));
    editor.trigger("test", "type", { text: "string" });
    session.next();
    assert.strictEqual(model.getValue(), expected);
    assert.strictEqual(session.isAtLastPlaceholder, true);
    assertSelections(editor, new Selection(4, 2, 4, 2));
  });
  test("snippets, transform example hit if", function() {
    editor.getModel().setValue("");
    editor.setSelection(new Selection(1, 1, 1, 1));
    const session = new SnippetSession(editor, "${1:name} : ${2:type}${3/\\s:=(.*)/${1:+ :=}${1}/};\n$0", void 0, languageConfigurationService);
    session.insert();
    assertSelections(editor, new Selection(1, 1, 1, 5));
    editor.trigger("test", "type", { text: "clk" });
    session.next();
    assertSelections(editor, new Selection(1, 7, 1, 11));
    editor.trigger("test", "type", { text: "std_logic" });
    session.next();
    assertSelections(editor, new Selection(1, 16, 1, 16));
    editor.trigger("test", "type", { text: " := '1'" });
    session.next();
    assert.strictEqual(model.getValue(), "clk : std_logic := '1';\n");
    assert.strictEqual(session.isAtLastPlaceholder, true);
    assertSelections(editor, new Selection(2, 1, 2, 1));
  });
  test("Snippet tab stop selection issue #96545, snippets, transform adjacent to previous placeholder", function() {
    editor.getModel().setValue("");
    editor.setSelection(new Selection(1, 1, 1, 1));
    const session = new SnippetSession(editor, "${1:{}${2:fff}${1/{/}/}", void 0, languageConfigurationService);
    session.insert();
    assertSelections(editor, new Selection(1, 1, 1, 2), new Selection(1, 5, 1, 6));
    session.next();
    assert.strictEqual(model.getValue(), "{fff}");
    assertSelections(editor, new Selection(1, 2, 1, 5));
    editor.trigger("test", "type", { text: "ggg" });
    session.next();
    assert.strictEqual(model.getValue(), "{ggg}");
    assert.strictEqual(session.isAtLastPlaceholder, true);
    assertSelections(editor, new Selection(1, 6, 1, 6));
  });
  test("Snippet tab stop selection issue #96545", function() {
    editor.getModel().setValue("");
    const session = new SnippetSession(editor, "${1:{}${2:fff}${1/[\\{]/}/}$0", void 0, languageConfigurationService);
    session.insert();
    assert.strictEqual(editor.getModel().getValue(), "{fff{");
    assertSelections(editor, new Selection(1, 1, 1, 2), new Selection(1, 5, 1, 6));
    session.next();
    assertSelections(editor, new Selection(1, 2, 1, 5));
  });
  test("Snippet placeholder index incorrect after using 2+ snippets in a row that each end with a placeholder, #30769", function() {
    editor.getModel().setValue("");
    editor.setSelection(new Selection(1, 1, 1, 1));
    const session = new SnippetSession(editor, "test ${1:replaceme}", void 0, languageConfigurationService);
    session.insert();
    editor.trigger("test", "type", { text: "1" });
    editor.trigger("test", "type", { text: "\n" });
    assert.strictEqual(editor.getModel().getValue(), "test 1\n");
    session.merge("test ${1:replaceme}");
    editor.trigger("test", "type", { text: "2" });
    editor.trigger("test", "type", { text: "\n" });
    assert.strictEqual(editor.getModel().getValue(), "test 1\ntest 2\n");
    session.merge("test ${1:replaceme}");
    editor.trigger("test", "type", { text: "3" });
    editor.trigger("test", "type", { text: "\n" });
    assert.strictEqual(editor.getModel().getValue(), "test 1\ntest 2\ntest 3\n");
    session.merge("test ${1:replaceme}");
    editor.trigger("test", "type", { text: "4" });
    editor.trigger("test", "type", { text: "\n" });
    assert.strictEqual(editor.getModel().getValue(), "test 1\ntest 2\ntest 3\ntest 4\n");
  });
  test("Snippet variable text isn't whitespace normalised, #31124", function() {
    editor.getModel().setValue([
      "start",
      "		-one",
      "		-two",
      "end"
    ].join("\n"));
    editor.getModel().updateOptions({ insertSpaces: false });
    editor.setSelection(new Selection(2, 2, 3, 7));
    new SnippetSession(editor, "<div>\n	$TM_SELECTED_TEXT\n</div>$0", void 0, languageConfigurationService).insert();
    let expected = [
      "start",
      "	<div>",
      "			-one",
      "			-two",
      "	</div>",
      "end"
    ].join("\n");
    assert.strictEqual(editor.getModel().getValue(), expected);
    editor.getModel().setValue([
      "start",
      "		-one",
      "	-two",
      "end"
    ].join("\n"));
    editor.getModel().updateOptions({ insertSpaces: false });
    editor.setSelection(new Selection(2, 2, 3, 7));
    new SnippetSession(editor, "<div>\n	$TM_SELECTED_TEXT\n</div>$0", void 0, languageConfigurationService).insert();
    expected = [
      "start",
      "	<div>",
      "			-one",
      "		-two",
      "	</div>",
      "end"
    ].join("\n");
    assert.strictEqual(editor.getModel().getValue(), expected);
  });
  test("Selecting text from left to right, and choosing item messes up code, #31199", function() {
    const model2 = editor.getModel();
    model2.setValue("console.log");
    let actual = SnippetSession.adjustSelection(model2, new Selection(1, 12, 1, 9), 3, 0);
    assert.ok(actual.equalsSelection(new Selection(1, 9, 1, 6)));
    actual = SnippetSession.adjustSelection(model2, new Selection(1, 9, 1, 12), 3, 0);
    assert.ok(actual.equalsSelection(new Selection(1, 9, 1, 12)));
    editor.setSelections([new Selection(1, 9, 1, 12)]);
    new SnippetSession(editor, "far", { overwriteBefore: 3, overwriteAfter: 0, adjustWhitespace: true, clipboardText: void 0, overtypingCapturer: void 0 }, languageConfigurationService).insert();
    assert.strictEqual(model2.getValue(), "console.far");
  });
  test("Tabs don't get replaced with spaces in snippet transformations #103818", function() {
    const model2 = editor.getModel();
    model2.setValue("\n{\n  \n}");
    model2.updateOptions({ insertSpaces: true, indentSize: 2 });
    editor.setSelections([new Selection(1, 1, 1, 1), new Selection(3, 6, 3, 6)]);
    const session = new SnippetSession(editor, [
      "function animate () {",
      "	var ${1:a} = 12;",
      "	console.log(${1/(.*)/\n		$1\n	/})",
      "}"
    ].join("\n"), void 0, languageConfigurationService);
    session.insert();
    assert.strictEqual(model2.getValue(), [
      "function animate () {",
      "  var a = 12;",
      "  console.log(a)",
      "}",
      "{",
      "  function animate () {",
      "    var a = 12;",
      "    console.log(a)",
      "  }",
      "}"
    ].join("\n"));
    editor.trigger("test", "type", { text: "bbb" });
    session.next();
    assert.strictEqual(model2.getValue(), [
      "function animate () {",
      "  var bbb = 12;",
      "  console.log(",
      "    bbb",
      "  )",
      "}",
      "{",
      "  function animate () {",
      "    var bbb = 12;",
      "    console.log(",
      "      bbb",
      "    )",
      "  }",
      "}"
    ].join("\n"));
  });
  suite("createEditsAndSnippetsFromEdits", function() {
    test("empty", function() {
      const result = SnippetSession.createEditsAndSnippetsFromEdits(editor, [], true, true, void 0, void 0, languageConfigurationService);
      assert.deepStrictEqual(result.edits, []);
      assert.deepStrictEqual(result.snippets, []);
    });
    test("basic", function() {
      editor.getModel().setValue('foo("bar")');
      const result = SnippetSession.createEditsAndSnippetsFromEdits(
        editor,
        [{ range: new Range(1, 5, 1, 9), template: "$1" }, { range: new Range(1, 1, 1, 1), template: 'const ${1:new_const} = "bar"' }],
        true,
        true,
        void 0,
        void 0,
        languageConfigurationService
      );
      assert.strictEqual(result.edits.length, 2);
      assert.deepStrictEqual(result.edits[0].range, new Range(1, 1, 1, 1));
      assert.deepStrictEqual(result.edits[0].text, 'const new_const = "bar"');
      assert.deepStrictEqual(result.edits[1].range, new Range(1, 5, 1, 9));
      assert.deepStrictEqual(result.edits[1].text, "new_const");
      assert.strictEqual(result.snippets.length, 1);
      assert.strictEqual(result.snippets[0].isTrivialSnippet, false);
    });
    test("with $SELECTION variable", function() {
      editor.getModel().setValue("Some text and a selection");
      editor.setSelections([new Selection(1, 17, 1, 26)]);
      const result = SnippetSession.createEditsAndSnippetsFromEdits(
        editor,
        [{ range: new Range(1, 17, 1, 26), template: "wrapped <$SELECTION>" }],
        true,
        true,
        void 0,
        void 0,
        languageConfigurationService
      );
      assert.strictEqual(result.edits.length, 1);
      assert.deepStrictEqual(result.edits[0].range, new Range(1, 17, 1, 26));
      assert.deepStrictEqual(result.edits[0].text, "wrapped <selection>");
      assert.strictEqual(result.snippets.length, 1);
      assert.strictEqual(result.snippets[0].isTrivialSnippet, true);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9zbmlwcGV0L3Rlc3QvYnJvd3Nlci9zbmlwcGV0U2Vzc2lvbi50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IG1vY2sgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL21vY2suanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBJQWN0aXZlQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBJUG9zaXRpb24sIFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBTZWxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9zZWxlY3Rpb24uanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlQ29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9tb2RlbC90ZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgU25pcHBldFBhcnNlciB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvc25pcHBldFBhcnNlci5qcyc7XG5pbXBvcnQgeyBTbmlwcGV0U2Vzc2lvbiB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvc25pcHBldFNlc3Npb24uanMnO1xuaW1wb3J0IHsgY3JlYXRlVGVzdENvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2Jyb3dzZXIvdGVzdENvZGVFZGl0b3IuanMnO1xuaW1wb3J0IHsgVGVzdExhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2NvbW1vbi9tb2Rlcy90ZXN0TGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2NvbW1vbi90ZXN0VGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IFNlcnZpY2VDb2xsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vc2VydmljZUNvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5cbnN1aXRlKCdTbmlwcGV0U2Vzc2lvbicsIGZ1bmN0aW9uICgpIHtcblxuXHRsZXQgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZTogSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2U7XG5cdGxldCBlZGl0b3I6IElBY3RpdmVDb2RlRWRpdG9yO1xuXHRsZXQgbW9kZWw6IFRleHRNb2RlbDtcblxuXHRmdW5jdGlvbiBhc3NlcnRTZWxlY3Rpb25zKGVkaXRvcjogSUFjdGl2ZUNvZGVFZGl0b3IsIC4uLnM6IFNlbGVjdGlvbltdKSB7XG5cdFx0Zm9yIChjb25zdCBzZWxlY3Rpb24gb2YgZWRpdG9yLmdldFNlbGVjdGlvbnMoKSkge1xuXHRcdFx0Y29uc3QgYWN0dWFsID0gcy5zaGlmdCgpITtcblx0XHRcdGFzc2VydC5vayhzZWxlY3Rpb24uZXF1YWxzU2VsZWN0aW9uKGFjdHVhbCksIGBhY3R1YWw9JHtzZWxlY3Rpb24udG9TdHJpbmcoKX0gPD4gZXhwZWN0ZWQ9JHthY3R1YWwudG9TdHJpbmcoKX1gKTtcblx0XHR9XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHMubGVuZ3RoLCAwKTtcblx0fVxuXG5cdHNldHVwKGZ1bmN0aW9uICgpIHtcblx0XHRtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbCgnZnVuY3Rpb24gZm9vKCkge1xcbiAgICBjb25zb2xlLmxvZyhhKTtcXG59Jyk7XG5cdFx0bGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyBUZXN0TGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSgpO1xuXHRcdGNvbnN0IHNlcnZpY2VDb2xsZWN0aW9uID0gbmV3IFNlcnZpY2VDb2xsZWN0aW9uKFxuXHRcdFx0W0lMYWJlbFNlcnZpY2UsIG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SUxhYmVsU2VydmljZT4oKSB7IH1dLFxuXHRcdFx0W0lMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlXSxcblx0XHRcdFtJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlPigpIHtcblx0XHRcdFx0b3ZlcnJpZGUgZ2V0V29ya3NwYWNlKCkge1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRpZDogJ3dvcmtzcGFjZS1pZCcsXG5cdFx0XHRcdFx0XHRmb2xkZXJzOiBbXSxcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHR9XSxcblx0XHQpO1xuXHRcdGVkaXRvciA9IGNyZWF0ZVRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7IHNlcnZpY2VDb2xsZWN0aW9uIH0pIGFzIElBY3RpdmVDb2RlRWRpdG9yO1xuXHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpLCBuZXcgU2VsZWN0aW9uKDIsIDUsIDIsIDUpXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldEVPTCgpLCAnXFxuJyk7XG5cdH0pO1xuXG5cdHRlYXJkb3duKGZ1bmN0aW9uICgpIHtcblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdFx0ZWRpdG9yLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnbm9ybWFsaXplIHdoaXRlc3BhY2UnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRmdW5jdGlvbiBhc3NlcnROb3JtYWxpemVkKHBvc2l0aW9uOiBJUG9zaXRpb24sIGlucHV0OiBzdHJpbmcsIGV4cGVjdGVkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRcdGNvbnN0IHNuaXBwZXQgPSBuZXcgU25pcHBldFBhcnNlcigpLnBhcnNlKGlucHV0KTtcblx0XHRcdFNuaXBwZXRTZXNzaW9uLmFkanVzdFdoaXRlc3BhY2UobW9kZWwsIHBvc2l0aW9uLCB0cnVlLCBzbmlwcGV0KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzbmlwcGV0LnRvVGV4dG1hdGVTdHJpbmcoKSwgZXhwZWN0ZWQpO1xuXHRcdH1cblxuXHRcdGFzc2VydE5vcm1hbGl6ZWQobmV3IFBvc2l0aW9uKDEsIDEpLCAnZm9vJywgJ2ZvbycpO1xuXHRcdGFzc2VydE5vcm1hbGl6ZWQobmV3IFBvc2l0aW9uKDEsIDEpLCAnZm9vXFxyYmFyJywgJ2Zvb1xcbmJhcicpO1xuXHRcdGFzc2VydE5vcm1hbGl6ZWQobmV3IFBvc2l0aW9uKDEsIDEpLCAnZm9vXFxyYmFyJywgJ2Zvb1xcbmJhcicpO1xuXHRcdGFzc2VydE5vcm1hbGl6ZWQobmV3IFBvc2l0aW9uKDIsIDUpLCAnZm9vXFxyXFx0YmFyJywgJ2Zvb1xcbiAgICAgICAgYmFyJyk7XG5cdFx0YXNzZXJ0Tm9ybWFsaXplZChuZXcgUG9zaXRpb24oMiwgMyksICdmb29cXHJcXHRiYXInLCAnZm9vXFxuICAgIGJhcicpO1xuXHRcdGFzc2VydE5vcm1hbGl6ZWQobmV3IFBvc2l0aW9uKDIsIDUpLCAnZm9vXFxyXFx0YmFyXFxuZm9vJywgJ2Zvb1xcbiAgICAgICAgYmFyXFxuICAgIGZvbycpO1xuXG5cdFx0Ly9JbmRlbnRhdGlvbiBpc3N1ZSB3aXRoIGNob2ljZSBlbGVtZW50cyB0aGF0IHNwYW4gbXVsdGlwbGUgbGluZXMgIzQ2MjY2XG5cdFx0YXNzZXJ0Tm9ybWFsaXplZChuZXcgUG9zaXRpb24oMiwgNSksICdhXFxuYiR7MXxmb28sXFxuYmFyfH0nLCAnYVxcbiAgICBiJHsxfGZvbyxcXG5iYXJ8fScpO1xuXHR9KTtcblxuXHR0ZXN0KCdhZGp1c3Qgc2VsZWN0aW9uIChvdmVyd3JpdGVbQmVmb3JlfEFmdGVyXSknLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRsZXQgcmFuZ2UgPSBTbmlwcGV0U2Vzc2lvbi5hZGp1c3RTZWxlY3Rpb24obW9kZWwsIG5ldyBTZWxlY3Rpb24oMSwgMiwgMSwgMiksIDEsIDApO1xuXHRcdGFzc2VydC5vayhyYW5nZS5lcXVhbHNSYW5nZShuZXcgUmFuZ2UoMSwgMSwgMSwgMikpKTtcblx0XHRyYW5nZSA9IFNuaXBwZXRTZXNzaW9uLmFkanVzdFNlbGVjdGlvbihtb2RlbCwgbmV3IFNlbGVjdGlvbigxLCAyLCAxLCAyKSwgMTExMSwgMCk7XG5cdFx0YXNzZXJ0Lm9rKHJhbmdlLmVxdWFsc1JhbmdlKG5ldyBSYW5nZSgxLCAxLCAxLCAyKSkpO1xuXHRcdHJhbmdlID0gU25pcHBldFNlc3Npb24uYWRqdXN0U2VsZWN0aW9uKG1vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDIsIDEsIDIpLCAwLCAxMCk7XG5cdFx0YXNzZXJ0Lm9rKHJhbmdlLmVxdWFsc1JhbmdlKG5ldyBSYW5nZSgxLCAyLCAxLCAxMikpKTtcblx0XHRyYW5nZSA9IFNuaXBwZXRTZXNzaW9uLmFkanVzdFNlbGVjdGlvbihtb2RlbCwgbmV3IFNlbGVjdGlvbigxLCAyLCAxLCAyKSwgMCwgMTAxMTEpO1xuXHRcdGFzc2VydC5vayhyYW5nZS5lcXVhbHNSYW5nZShuZXcgUmFuZ2UoMSwgMiwgMSwgMTcpKSk7XG5cblx0fSk7XG5cblx0dGVzdCgndGV4dCBlZGl0cyAmIHNlbGVjdGlvbicsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBzZXNzaW9uID0gbmV3IFNuaXBwZXRTZXNzaW9uKGVkaXRvciwgJ2ZvbyR7MTpiYXJ9Zm9vJDAnLCB1bmRlZmluZWQsIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdHNlc3Npb24uaW5zZXJ0KCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRNb2RlbCgpIS5nZXRWYWx1ZSgpLCAnZm9vYmFyZm9vZnVuY3Rpb24gZm9vKCkge1xcbiAgICBmb29iYXJmb29jb25zb2xlLmxvZyhhKTtcXG59Jyk7XG5cblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA3KSwgbmV3IFNlbGVjdGlvbigyLCA4LCAyLCAxMSkpO1xuXHRcdHNlc3Npb24ubmV4dCgpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDEwLCAxLCAxMCksIG5ldyBTZWxlY3Rpb24oMiwgMTQsIDIsIDE0KSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3RleHQgZWRpdCB3aXRoIHJldmVyc2VkIHNlbGVjdGlvbicsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IHNlc3Npb24gPSBuZXcgU25pcHBldFNlc3Npb24oZWRpdG9yLCAnJHsxOmJhcn0kMCcsIHVuZGVmaW5lZCwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoW25ldyBTZWxlY3Rpb24oMiwgNSwgMiwgNSksIG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSldKTtcblxuXHRcdHNlc3Npb24uaW5zZXJ0KCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICdiYXJmdW5jdGlvbiBmb28oKSB7XFxuICAgIGJhcmNvbnNvbGUubG9nKGEpO1xcbn0nKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigyLCA1LCAyLCA4KSwgbmV3IFNlbGVjdGlvbigxLCAxLCAxLCA0KSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NuaXBwZXRzLCByZXBlYXRlZCB0YWJzdG9wcycsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBzZXNzaW9uID0gbmV3IFNuaXBwZXRTZXNzaW9uKGVkaXRvciwgJyR7MTphYmN9Zm9vJHsxOmFiY30kMCcsIHVuZGVmaW5lZCwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0c2Vzc2lvbi5pbnNlcnQoKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvcixcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgNCksIG5ldyBTZWxlY3Rpb24oMSwgNywgMSwgMTApLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigyLCA1LCAyLCA4KSwgbmV3IFNlbGVjdGlvbigyLCAxMSwgMiwgMTQpLFxuXHRcdCk7XG5cdFx0c2Vzc2lvbi5uZXh0KCk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEwLCAxLCAxMCksXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDE0LCAyLCAxNCksXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnc25pcHBldHMsIGp1c3QgdGV4dCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBzZXNzaW9uID0gbmV3IFNuaXBwZXRTZXNzaW9uKGVkaXRvciwgJ2Zvb2JhcicsIHVuZGVmaW5lZCwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0c2Vzc2lvbi5pbnNlcnQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ2Zvb2JhcmZ1bmN0aW9uIGZvbygpIHtcXG4gICAgZm9vYmFyY29uc29sZS5sb2coYSk7XFxufScpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDcsIDEsIDcpLCBuZXcgU2VsZWN0aW9uKDIsIDExLCAyLCAxMSkpO1xuXHR9KTtcblxuXHR0ZXN0KCdzbmlwcGV0cywgc2VsZWN0aW9ucyBhbmQgbmV3IHRleHQgd2l0aCBuZXdsaW5lcycsICgpID0+IHtcblxuXHRcdGNvbnN0IHNlc3Npb24gPSBuZXcgU25pcHBldFNlc3Npb24oZWRpdG9yLCAnZm9vXFxuXFx0JHsxOmJhcn1cXG4kMCcsIHVuZGVmaW5lZCwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0c2Vzc2lvbi5pbnNlcnQoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0VmFsdWUoKSwgJ2Zvb1xcbiAgICBiYXJcXG5mdW5jdGlvbiBmb28oKSB7XFxuICAgIGZvb1xcbiAgICAgICAgYmFyXFxuICAgIGNvbnNvbGUubG9nKGEpO1xcbn0nKTtcblxuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDIsIDUsIDIsIDgpLCBuZXcgU2VsZWN0aW9uKDUsIDksIDUsIDEyKSk7XG5cblx0XHRzZXNzaW9uLm5leHQoKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigzLCAxLCAzLCAxKSwgbmV3IFNlbGVjdGlvbig2LCA1LCA2LCA1KSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NuaXBwZXRzLCBuZXdsaW5lIE5PIHdoaXRlc3BhY2UgYWRqdXN0JywgKCkgPT4ge1xuXG5cdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDIsIDUsIDIsIDUpKTtcblx0XHRjb25zdCBzZXNzaW9uID0gbmV3IFNuaXBwZXRTZXNzaW9uKGVkaXRvciwgJ2FiY1xcbiAgICBmb29cXG4gICAgICAgIGJhclxcbiQwJywgeyBvdmVyd3JpdGVCZWZvcmU6IDAsIG92ZXJ3cml0ZUFmdGVyOiAwLCBhZGp1c3RXaGl0ZXNwYWNlOiBmYWxzZSwgY2xpcGJvYXJkVGV4dDogdW5kZWZpbmVkLCBvdmVydHlwaW5nQ2FwdHVyZXI6IHVuZGVmaW5lZCB9LCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRzZXNzaW9uLmluc2VydCgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0VmFsdWUoKSwgJ2Z1bmN0aW9uIGZvbygpIHtcXG4gICAgYWJjXFxuICAgIGZvb1xcbiAgICAgICAgYmFyXFxuY29uc29sZS5sb2coYSk7XFxufScpO1xuXHR9KTtcblxuXHR0ZXN0KCdzbmlwcGV0cywgc2VsZWN0aW9ucyAtPiBuZXh0L3ByZXYnLCAoKSA9PiB7XG5cblx0XHRjb25zdCBzZXNzaW9uID0gbmV3IFNuaXBwZXRTZXNzaW9uKGVkaXRvciwgJ2YkMW9vJHsyOmJhcn1mb28kMCcsIHVuZGVmaW5lZCwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0c2Vzc2lvbi5pbnNlcnQoKTtcblxuXHRcdC8vIEAgJDJcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCAyLCAxLCAyKSwgbmV3IFNlbGVjdGlvbigyLCA2LCAyLCA2KSk7XG5cdFx0Ly8gQCAkMVxuXHRcdHNlc3Npb24ubmV4dCgpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDcpLCBuZXcgU2VsZWN0aW9uKDIsIDgsIDIsIDExKSk7XG5cdFx0Ly8gQCAkMlxuXHRcdHNlc3Npb24ucHJldigpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDIsIDEsIDIpLCBuZXcgU2VsZWN0aW9uKDIsIDYsIDIsIDYpKTtcblx0XHQvLyBAICQxXG5cdFx0c2Vzc2lvbi5uZXh0KCk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNyksIG5ldyBTZWxlY3Rpb24oMiwgOCwgMiwgMTEpKTtcblx0XHQvLyBAICQwXG5cdFx0c2Vzc2lvbi5uZXh0KCk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMTAsIDEsIDEwKSwgbmV3IFNlbGVjdGlvbigyLCAxNCwgMiwgMTQpKTtcblx0fSk7XG5cblx0dGVzdCgnc25pcHBldHMsIHNlbGVjdGlvbnMgJiB0eXBpbmcnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IG5ldyBTbmlwcGV0U2Vzc2lvbihlZGl0b3IsICdmJHsxOm9vfV8kMl8kMCcsIHVuZGVmaW5lZCwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0c2Vzc2lvbi5pbnNlcnQoKTtcblxuXHRcdGVkaXRvci50cmlnZ2VyKCd0ZXN0JywgJ3R5cGUnLCB7IHRleHQ6ICdYJyB9KTtcblx0XHRzZXNzaW9uLm5leHQoKTtcblx0XHRlZGl0b3IudHJpZ2dlcigndGVzdCcsICd0eXBlJywgeyB0ZXh0OiAnYmFyJyB9KTtcblxuXHRcdC8vIGdvIGJhY2sgdG8gJHsyOm9vfSB3aGljaCBpcyBub3cganVzdCAnWCdcblx0XHRzZXNzaW9uLnByZXYoKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCAyLCAxLCAzKSwgbmV3IFNlbGVjdGlvbigyLCA2LCAyLCA3KSk7XG5cblx0XHQvLyBnbyBmb3J3YXJkIHRvICQxIHdoaWNoIGlzIG5vdyAnYmFyJ1xuXHRcdHNlc3Npb24ubmV4dCgpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDcpLCBuZXcgU2VsZWN0aW9uKDIsIDgsIDIsIDExKSk7XG5cblx0XHQvLyBnbyB0byBmaW5hbCB0YWJzdG9wXG5cdFx0c2Vzc2lvbi5uZXh0KCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICdmWF9iYXJfZnVuY3Rpb24gZm9vKCkge1xcbiAgICBmWF9iYXJfY29uc29sZS5sb2coYSk7XFxufScpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDgsIDEsIDgpLCBuZXcgU2VsZWN0aW9uKDIsIDEyLCAyLCAxMikpO1xuXHR9KTtcblxuXHR0ZXN0KCdzbmlwcGV0cywgaW5zZXJ0IHNob3J0ZXIgc25pcHBldCBpbnRvIG5vbi1lbXB0eSBzZWxlY3Rpb24nLCBmdW5jdGlvbiAoKSB7XG5cdFx0bW9kZWwuc2V0VmFsdWUoJ2Zvb19iYXJfZm9vJyk7XG5cdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoW25ldyBTZWxlY3Rpb24oMSwgMSwgMSwgNCksIG5ldyBTZWxlY3Rpb24oMSwgOSwgMSwgMTIpXSk7XG5cblx0XHRuZXcgU25pcHBldFNlc3Npb24oZWRpdG9yLCAneCQwJywgdW5kZWZpbmVkLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKS5pbnNlcnQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ3hfYmFyX3gnKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCAyLCAxLCAyKSwgbmV3IFNlbGVjdGlvbigxLCA4LCAxLCA4KSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NuaXBwZXRzLCBpbnNlcnQgbG9uZ2VyIHNuaXBwZXQgaW50byBub24tZW1wdHkgc2VsZWN0aW9uJywgZnVuY3Rpb24gKCkge1xuXHRcdG1vZGVsLnNldFZhbHVlKCdmb29fYmFyX2ZvbycpO1xuXHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDQpLCBuZXcgU2VsZWN0aW9uKDEsIDksIDEsIDEyKV0pO1xuXG5cdFx0bmV3IFNuaXBwZXRTZXNzaW9uKGVkaXRvciwgJ0xPTkdFUiQwJywgdW5kZWZpbmVkLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKS5pbnNlcnQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ0xPTkdFUl9iYXJfTE9OR0VSJyk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgNywgMSwgNyksIG5ldyBTZWxlY3Rpb24oMSwgMTgsIDEsIDE4KSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NuaXBwZXRzLCBkb25cXCd0IGdyb3cgZmluYWwgdGFic3RvcCcsIGZ1bmN0aW9uICgpIHtcblx0XHRtb2RlbC5zZXRWYWx1ZSgnZm9vX3p6el9mb28nKTtcblx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgNSwgMSwgOCkpO1xuXHRcdGNvbnN0IHNlc3Npb24gPSBuZXcgU25pcHBldFNlc3Npb24oZWRpdG9yLCAnJDFiYXIkMCcsIHVuZGVmaW5lZCwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0c2Vzc2lvbi5pbnNlcnQoKTtcblxuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDUsIDEsIDUpKTtcblx0XHRlZGl0b3IudHJpZ2dlcigndGVzdCcsICd0eXBlJywgeyB0ZXh0OiAnZm9vLScgfSk7XG5cblx0XHRzZXNzaW9uLm5leHQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ2Zvb19mb28tYmFyX2ZvbycpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDEyLCAxLCAxMikpO1xuXG5cdFx0ZWRpdG9yLnRyaWdnZXIoJ3Rlc3QnLCAndHlwZScsIHsgdGV4dDogJ1hYWCcgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICdmb29fZm9vLWJhclhYWF9mb28nKTtcblx0XHRzZXNzaW9uLnByZXYoKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCA1LCAxLCA5KSk7XG5cdFx0c2Vzc2lvbi5uZXh0KCk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMTUsIDEsIDE1KSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NuaXBwZXRzLCBkb25cXCd0IG1lcmdlIHRvdWNoaW5nIHRhYnN0b3BzIDEvMicsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IHNlc3Npb24gPSBuZXcgU25pcHBldFNlc3Npb24oZWRpdG9yLCAnJDEkMiQzJDAnLCB1bmRlZmluZWQsIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdHNlc3Npb24uaW5zZXJ0KCk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSksIG5ldyBTZWxlY3Rpb24oMiwgNSwgMiwgNSkpO1xuXG5cdFx0c2Vzc2lvbi5uZXh0KCk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSksIG5ldyBTZWxlY3Rpb24oMiwgNSwgMiwgNSkpO1xuXG5cdFx0c2Vzc2lvbi5uZXh0KCk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSksIG5ldyBTZWxlY3Rpb24oMiwgNSwgMiwgNSkpO1xuXG5cdFx0c2Vzc2lvbi5uZXh0KCk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSksIG5ldyBTZWxlY3Rpb24oMiwgNSwgMiwgNSkpO1xuXG5cdFx0c2Vzc2lvbi5wcmV2KCk7XG5cdFx0c2Vzc2lvbi5wcmV2KCk7XG5cdFx0c2Vzc2lvbi5wcmV2KCk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSksIG5ldyBTZWxlY3Rpb24oMiwgNSwgMiwgNSkpO1xuXHRcdGVkaXRvci50cmlnZ2VyKCd0ZXN0JywgJ3R5cGUnLCB7IHRleHQ6ICcxMTEnIH0pO1xuXG5cdFx0c2Vzc2lvbi5uZXh0KCk7XG5cdFx0ZWRpdG9yLnRyaWdnZXIoJ3Rlc3QnLCAndHlwZScsIHsgdGV4dDogJzIyMicgfSk7XG5cblx0XHRzZXNzaW9uLm5leHQoKTtcblx0XHRlZGl0b3IudHJpZ2dlcigndGVzdCcsICd0eXBlJywgeyB0ZXh0OiAnMzMzJyB9KTtcblxuXHRcdHNlc3Npb24ubmV4dCgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnMTExMjIyMzMzZnVuY3Rpb24gZm9vKCkge1xcbiAgICAxMTEyMjIzMzNjb25zb2xlLmxvZyhhKTtcXG59Jyk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMTAsIDEsIDEwKSwgbmV3IFNlbGVjdGlvbigyLCAxNCwgMiwgMTQpKTtcblxuXHRcdHNlc3Npb24ucHJldigpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDcsIDEsIDEwKSwgbmV3IFNlbGVjdGlvbigyLCAxMSwgMiwgMTQpKTtcblx0XHRzZXNzaW9uLnByZXYoKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA3KSwgbmV3IFNlbGVjdGlvbigyLCA4LCAyLCAxMSkpO1xuXHRcdHNlc3Npb24ucHJldigpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDQpLCBuZXcgU2VsZWN0aW9uKDIsIDUsIDIsIDgpKTtcblx0fSk7XG5cdHRlc3QoJ3NuaXBwZXRzLCBkb25cXCd0IG1lcmdlIHRvdWNoaW5nIHRhYnN0b3BzIDIvMicsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IHNlc3Npb24gPSBuZXcgU25pcHBldFNlc3Npb24oZWRpdG9yLCAnJDEkMiQzJDAnLCB1bmRlZmluZWQsIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdHNlc3Npb24uaW5zZXJ0KCk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSksIG5ldyBTZWxlY3Rpb24oMiwgNSwgMiwgNSkpO1xuXG5cdFx0ZWRpdG9yLnRyaWdnZXIoJ3Rlc3QnLCAndHlwZScsIHsgdGV4dDogJzExMScgfSk7XG5cblx0XHRzZXNzaW9uLm5leHQoKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA0KSwgbmV3IFNlbGVjdGlvbigyLCA4LCAyLCA4KSk7XG5cdFx0ZWRpdG9yLnRyaWdnZXIoJ3Rlc3QnLCAndHlwZScsIHsgdGV4dDogJzIyMicgfSk7XG5cblx0XHRzZXNzaW9uLm5leHQoKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCA3LCAxLCA3KSwgbmV3IFNlbGVjdGlvbigyLCAxMSwgMiwgMTEpKTtcblx0XHRlZGl0b3IudHJpZ2dlcigndGVzdCcsICd0eXBlJywgeyB0ZXh0OiAnMzMzJyB9KTtcblxuXHRcdHNlc3Npb24ubmV4dCgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uLmlzQXRMYXN0UGxhY2Vob2xkZXIsIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdzbmlwcGV0cywgZ3JhY2VmdWxseSBtb3ZlIG92ZXIgZmluYWwgdGFic3RvcCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBzZXNzaW9uID0gbmV3IFNuaXBwZXRTZXNzaW9uKGVkaXRvciwgJyR7MX1iYXIkMCcsIHVuZGVmaW5lZCwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0c2Vzc2lvbi5pbnNlcnQoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uLmlzQXRMYXN0UGxhY2Vob2xkZXIsIGZhbHNlKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSwgbmV3IFNlbGVjdGlvbigyLCA1LCAyLCA1KSk7XG5cblx0XHRzZXNzaW9uLm5leHQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbi5pc0F0TGFzdFBsYWNlaG9sZGVyLCB0cnVlKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA0KSwgbmV3IFNlbGVjdGlvbigyLCA4LCAyLCA4KSk7XG5cblx0XHRzZXNzaW9uLm5leHQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbi5pc0F0TGFzdFBsYWNlaG9sZGVyLCB0cnVlKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA0KSwgbmV3IFNlbGVjdGlvbigyLCA4LCAyLCA4KSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NuaXBwZXRzLCBvdmVyd3JpdGluZyBuZXN0ZWQgcGxhY2Vob2xkZXInLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IG5ldyBTbmlwcGV0U2Vzc2lvbihlZGl0b3IsICdsb2coJHsxOlwiJDJcIn0pOyQwJywgdW5kZWZpbmVkLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRzZXNzaW9uLmluc2VydCgpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDUsIDEsIDcpLCBuZXcgU2VsZWN0aW9uKDIsIDksIDIsIDExKSk7XG5cblx0XHRlZGl0b3IudHJpZ2dlcigndGVzdCcsICd0eXBlJywgeyB0ZXh0OiAnWFhYJyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ2xvZyhYWFgpO2Z1bmN0aW9uIGZvbygpIHtcXG4gICAgbG9nKFhYWCk7Y29uc29sZS5sb2coYSk7XFxufScpO1xuXG5cdFx0c2Vzc2lvbi5uZXh0KCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24uaXNBdExhc3RQbGFjZWhvbGRlciwgZmFsc2UpO1xuXHRcdC8vIGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDcsIDEsIDcpLCBuZXcgU2VsZWN0aW9uKDIsIDExLCAyLCAxMSkpO1xuXG5cdFx0c2Vzc2lvbi5uZXh0KCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24uaXNBdExhc3RQbGFjZWhvbGRlciwgdHJ1ZSk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMTAsIDEsIDEwKSwgbmV3IFNlbGVjdGlvbigyLCAxNCwgMiwgMTQpKTtcblx0fSk7XG5cblx0dGVzdCgnc25pcHBldHMsIHNlbGVjdGlvbnMgYW5kIHNuaXBwZXQgcmFuZ2VzJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHNlc3Npb24gPSBuZXcgU25pcHBldFNlc3Npb24oZWRpdG9yLCAnJHsxOmZvb31mYXJib28kezI6YmFyfSQwJywgdW5kZWZpbmVkLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRzZXNzaW9uLmluc2VydCgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnZm9vZmFyYm9vYmFyZnVuY3Rpb24gZm9vKCkge1xcbiAgICBmb29mYXJib29iYXJjb25zb2xlLmxvZyhhKTtcXG59Jyk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgNCksIG5ldyBTZWxlY3Rpb24oMiwgNSwgMiwgOCkpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24uaXNTZWxlY3Rpb25XaXRoaW5QbGFjZWhvbGRlcnMoKSwgdHJ1ZSk7XG5cblx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9ucyhbbmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uLmlzU2VsZWN0aW9uV2l0aGluUGxhY2Vob2xkZXJzKCksIGZhbHNlKTtcblxuXHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtuZXcgU2VsZWN0aW9uKDEsIDYsIDEsIDYpLCBuZXcgU2VsZWN0aW9uKDIsIDEwLCAyLCAxMCldKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbi5pc1NlbGVjdGlvbldpdGhpblBsYWNlaG9sZGVycygpLCBmYWxzZSk7IC8vIGluIHNuaXBwZXQsIG91dHNpZGUgcGxhY2Vob2xkZXJcblxuXHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtuZXcgU2VsZWN0aW9uKDEsIDYsIDEsIDYpLCBuZXcgU2VsZWN0aW9uKDIsIDEwLCAyLCAxMCksIG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSldKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbi5pc1NlbGVjdGlvbldpdGhpblBsYWNlaG9sZGVycygpLCBmYWxzZSk7IC8vIGluIHNuaXBwZXQsIG91dHNpZGUgcGxhY2Vob2xkZXJcblxuXHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtuZXcgU2VsZWN0aW9uKDEsIDYsIDEsIDYpLCBuZXcgU2VsZWN0aW9uKDIsIDEwLCAyLCAxMCksIG5ldyBTZWxlY3Rpb24oMiwgMjAsIDIsIDIxKV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uLmlzU2VsZWN0aW9uV2l0aGluUGxhY2Vob2xkZXJzKCksIGZhbHNlKTtcblxuXHRcdC8vIHJlc2V0IHNlbGVjdGlvbiB0byBwbGFjZWhvbGRlclxuXHRcdHNlc3Npb24ubmV4dCgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uLmlzU2VsZWN0aW9uV2l0aGluUGxhY2Vob2xkZXJzKCksIHRydWUpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDEwLCAxLCAxMyksIG5ldyBTZWxlY3Rpb24oMiwgMTQsIDIsIDE3KSk7XG5cblx0XHQvLyByZXNldCBzZWxlY3Rpb24gdG8gcGxhY2Vob2xkZXJcblx0XHRzZXNzaW9uLm5leHQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbi5pc1NlbGVjdGlvbldpdGhpblBsYWNlaG9sZGVycygpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbi5pc0F0TGFzdFBsYWNlaG9sZGVyLCB0cnVlKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCAxMywgMSwgMTMpLCBuZXcgU2VsZWN0aW9uKDIsIDE3LCAyLCAxNykpO1xuXHR9KTtcblxuXHR0ZXN0KCdzbmlwcGV0cywgbmVzdGVkIHNlc3Npb25zJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0bW9kZWwuc2V0VmFsdWUoJycpO1xuXHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSk7XG5cblx0XHRjb25zdCBmaXJzdCA9IG5ldyBTbmlwcGV0U2Vzc2lvbihlZGl0b3IsICdmb28kezI6YmFyfWZvbyQwJywgdW5kZWZpbmVkLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRmaXJzdC5pbnNlcnQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ2Zvb2JhcmZvbycpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDcpKTtcblxuXHRcdGNvbnN0IHNlY29uZCA9IG5ldyBTbmlwcGV0U2Vzc2lvbihlZGl0b3IsICdiYSR7MTp6enp6fSQwJywgdW5kZWZpbmVkLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRzZWNvbmQuaW5zZXJ0KCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICdmb29iYXp6enpmb28nKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCA2LCAxLCAxMCkpO1xuXG5cdFx0c2Vjb25kLm5leHQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vjb25kLmlzQXRMYXN0UGxhY2Vob2xkZXIsIHRydWUpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDEwLCAxLCAxMCkpO1xuXG5cdFx0Zmlyc3QubmV4dCgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC5pc0F0TGFzdFBsYWNlaG9sZGVyLCB0cnVlKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCAxMywgMSwgMTMpKTtcblx0fSk7XG5cblx0dGVzdCgnc25pcHBldHMsIHR5cGluZyBhdCBmaW5hbCB0YWJzdG9wJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IG5ldyBTbmlwcGV0U2Vzc2lvbihlZGl0b3IsICdmYXJib28kMCcsIHVuZGVmaW5lZCwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0c2Vzc2lvbi5pbnNlcnQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbi5pc0F0TGFzdFBsYWNlaG9sZGVyLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbi5pc1NlbGVjdGlvbldpdGhpblBsYWNlaG9sZGVycygpLCBmYWxzZSk7XG5cblx0XHRlZGl0b3IudHJpZ2dlcigndGVzdCcsICd0eXBlJywgeyB0ZXh0OiAnWFhYJyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbi5pc1NlbGVjdGlvbldpdGhpblBsYWNlaG9sZGVycygpLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NuaXBwZXRzLCB0eXBpbmcgYXQgYmVnaW5uaW5nJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDEsIDIsIDEsIDIpKTtcblx0XHRjb25zdCBzZXNzaW9uID0gbmV3IFNuaXBwZXRTZXNzaW9uKGVkaXRvciwgJ2ZhcmJvbyQwJywgdW5kZWZpbmVkLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRzZXNzaW9uLmluc2VydCgpO1xuXG5cdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDEsIDIsIDEsIDIpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbi5pc1NlbGVjdGlvbldpdGhpblBsYWNlaG9sZGVycygpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24uaXNBdExhc3RQbGFjZWhvbGRlciwgdHJ1ZSk7XG5cblx0XHRlZGl0b3IudHJpZ2dlcigndGVzdCcsICd0eXBlJywgeyB0ZXh0OiAnWFhYJyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICdmWFhYZmFyYm9vdW5jdGlvbiBmb28oKSB7Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24uaXNTZWxlY3Rpb25XaXRoaW5QbGFjZWhvbGRlcnMoKSwgZmFsc2UpO1xuXG5cdFx0c2Vzc2lvbi5uZXh0KCk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMTEsIDEsIDExKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NuaXBwZXRzLCB0eXBpbmcgd2l0aCBuZXN0ZWQgcGxhY2Vob2xkZXInLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSkpO1xuXHRcdGNvbnN0IHNlc3Npb24gPSBuZXcgU25pcHBldFNlc3Npb24oZWRpdG9yLCAnVGhpcyAkezE6aXMgJHsyOm5lc3RlZH19LiQwJywgdW5kZWZpbmVkLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRzZXNzaW9uLmluc2VydCgpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDYsIDEsIDE1KSk7XG5cblx0XHRzZXNzaW9uLm5leHQoKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCA5LCAxLCAxNSkpO1xuXG5cdFx0ZWRpdG9yLnRyaWdnZXIoJ3Rlc3QnLCAnY3V0Jywge30pO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDksIDEsIDkpKTtcblxuXHRcdGVkaXRvci50cmlnZ2VyKCd0ZXN0JywgJ3R5cGUnLCB7IHRleHQ6ICdYWFgnIH0pO1xuXHRcdHNlc3Npb24ucHJldigpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDYsIDEsIDEyKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NuaXBwZXRzLCBzbmlwcGV0IHdpdGggdmFyaWFibGVzJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHNlc3Npb24gPSBuZXcgU25pcHBldFNlc3Npb24oZWRpdG9yLCAnQGxpbmU9JFRNX0xJTkVfTlVNQkVSJDAnLCB1bmRlZmluZWQsIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdHNlc3Npb24uaW5zZXJ0KCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ0BsaW5lPTFmdW5jdGlvbiBmb28oKSB7XFxuICAgIEBsaW5lPTJjb25zb2xlLmxvZyhhKTtcXG59Jyk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgOCwgMSwgOCksIG5ldyBTZWxlY3Rpb24oMiwgMTIsIDIsIDEyKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NuaXBwZXRzLCBtZXJnZScsIGZ1bmN0aW9uICgpIHtcblx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSkpO1xuXHRcdGNvbnN0IHNlc3Npb24gPSBuZXcgU25pcHBldFNlc3Npb24oZWRpdG9yLCAnVGhpcyAkezE6aXMgJHsyOm5lc3RlZH19LiQwJywgdW5kZWZpbmVkLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRzZXNzaW9uLmluc2VydCgpO1xuXHRcdHNlc3Npb24ubmV4dCgpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDksIDEsIDE1KSk7XG5cblx0XHRzZXNzaW9uLm1lcmdlKCdyZWFsbHkgJHsxOm5lc3RlZH0kMCcpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDE2LCAxLCAyMikpO1xuXG5cdFx0c2Vzc2lvbi5uZXh0KCk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMjIsIDEsIDIyKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24uaXNBdExhc3RQbGFjZWhvbGRlciwgZmFsc2UpO1xuXG5cdFx0c2Vzc2lvbi5uZXh0KCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24uaXNBdExhc3RQbGFjZWhvbGRlciwgdHJ1ZSk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMjMsIDEsIDIzKSk7XG5cblx0XHRzZXNzaW9uLnByZXYoKTtcblx0XHRlZGl0b3IudHJpZ2dlcigndGVzdCcsICd0eXBlJywgeyB0ZXh0OiAnQUFBJyB9KTtcblxuXHRcdC8vIGJhY2sgdG8gYHJlYWxseSAkezE6bmVzdGVkfWBcblx0XHRzZXNzaW9uLnByZXYoKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCAxNiwgMSwgMjIpKTtcblxuXHRcdC8vIGJhY2sgdG8gYCR7MTppcyAuLi59YCB3aGljaCBub3cgZ3Jld1xuXHRcdHNlc3Npb24ucHJldigpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDYsIDEsIDI1KSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NuaXBwZXRzLCB0cmFuc2Zvcm0nLCBmdW5jdGlvbiAoKSB7XG5cdFx0ZWRpdG9yLmdldE1vZGVsKCkhLnNldFZhbHVlKCcnKTtcblx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSkpO1xuXHRcdGNvbnN0IHNlc3Npb24gPSBuZXcgU25pcHBldFNlc3Npb24oZWRpdG9yLCAnJHsxL2Zvby9iYXIvfSQwJywgdW5kZWZpbmVkLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRzZXNzaW9uLmluc2VydCgpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpKTtcblxuXHRcdGVkaXRvci50cmlnZ2VyKCd0ZXN0JywgJ3R5cGUnLCB7IHRleHQ6ICdmb28nIH0pO1xuXHRcdHNlc3Npb24ubmV4dCgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICdiYXInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbi5pc0F0TGFzdFBsYWNlaG9sZGVyLCB0cnVlKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA0KSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NuaXBwZXRzLCBtdWx0aSBwbGFjZWhvbGRlciBzYW1lIGluZGV4IG9uZSB0cmFuc2Zvcm0nLCBmdW5jdGlvbiAoKSB7XG5cdFx0ZWRpdG9yLmdldE1vZGVsKCkhLnNldFZhbHVlKCcnKTtcblx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSkpO1xuXHRcdGNvbnN0IHNlc3Npb24gPSBuZXcgU25pcHBldFNlc3Npb24oZWRpdG9yLCAnJDEgYmF6ICR7MS9mb28vYmFyL30kMCcsIHVuZGVmaW5lZCwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0c2Vzc2lvbi5pbnNlcnQoKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSwgbmV3IFNlbGVjdGlvbigxLCA2LCAxLCA2KSk7XG5cblx0XHRlZGl0b3IudHJpZ2dlcigndGVzdCcsICd0eXBlJywgeyB0ZXh0OiAnZm9vJyB9KTtcblx0XHRzZXNzaW9uLm5leHQoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnZm9vIGJheiBiYXInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbi5pc0F0TGFzdFBsYWNlaG9sZGVyLCB0cnVlKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCAxMiwgMSwgMTIpKTtcblx0fSk7XG5cblx0dGVzdCgnc25pcHBldHMsIHRyYW5zZm9ybSBleGFtcGxlJywgZnVuY3Rpb24gKCkge1xuXHRcdGVkaXRvci5nZXRNb2RlbCgpIS5zZXRWYWx1ZSgnJyk7XG5cdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpKTtcblx0XHRjb25zdCBzZXNzaW9uID0gbmV3IFNuaXBwZXRTZXNzaW9uKGVkaXRvciwgJyR7MTpuYW1lfSA6ICR7Mjp0eXBlfSR7My9cXFxcczo9KC4qKS8kezE6KyA6PX0kezF9L307XFxuJDAnLCB1bmRlZmluZWQsIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdHNlc3Npb24uaW5zZXJ0KCk7XG5cblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCAxLCAxLCA1KSk7XG5cdFx0ZWRpdG9yLnRyaWdnZXIoJ3Rlc3QnLCAndHlwZScsIHsgdGV4dDogJ2NsaycgfSk7XG5cdFx0c2Vzc2lvbi5uZXh0KCk7XG5cblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCA3LCAxLCAxMSkpO1xuXHRcdGVkaXRvci50cmlnZ2VyKCd0ZXN0JywgJ3R5cGUnLCB7IHRleHQ6ICdzdGRfbG9naWMnIH0pO1xuXHRcdHNlc3Npb24ubmV4dCgpO1xuXG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMTYsIDEsIDE2KSk7XG5cdFx0c2Vzc2lvbi5uZXh0KCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ2NsayA6IHN0ZF9sb2dpYztcXG4nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbi5pc0F0TGFzdFBsYWNlaG9sZGVyLCB0cnVlKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigyLCAxLCAyLCAxKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NuaXBwZXRzLCB0cmFuc2Zvcm0gd2l0aCBpbmRlbnQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3Qgc25pcHBldCA9IFtcblx0XHRcdCdwcml2YXRlIHJlYWRvbmx5ICR7MX0gPSBuZXcgRW1pdHRlcjwkMj4oKTsnLFxuXHRcdFx0J3JlYWRvbmx5ICR7MS9eXyguKikvJDEvfTogRXZlbnQ8JDI+ID0gdGhpcy4kMS5ldmVudDsnLFxuXHRcdFx0JyQwJ1xuXHRcdF0uam9pbignXFxuJyk7XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBbXG5cdFx0XHQneycsXG5cdFx0XHQnXFx0cHJpdmF0ZSByZWFkb25seSBfcHJvcCA9IG5ldyBFbWl0dGVyPHN0cmluZz4oKTsnLFxuXHRcdFx0J1xcdHJlYWRvbmx5IHByb3A6IEV2ZW50PHN0cmluZz4gPSB0aGlzLl9wcm9wLmV2ZW50OycsXG5cdFx0XHQnXFx0Jyxcblx0XHRcdCd9J1xuXHRcdF0uam9pbignXFxuJyk7XG5cdFx0Y29uc3QgYmFzZSA9IFtcblx0XHRcdCd7Jyxcblx0XHRcdCdcXHQnLFxuXHRcdFx0J30nXG5cdFx0XS5qb2luKCdcXG4nKTtcblxuXHRcdGVkaXRvci5nZXRNb2RlbCgpIS5zZXRWYWx1ZShiYXNlKTtcblx0XHRlZGl0b3IuZ2V0TW9kZWwoKSEudXBkYXRlT3B0aW9ucyh7IGluc2VydFNwYWNlczogZmFsc2UgfSk7XG5cdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDIsIDIsIDIsIDIpKTtcblxuXHRcdGNvbnN0IHNlc3Npb24gPSBuZXcgU25pcHBldFNlc3Npb24oZWRpdG9yLCBzbmlwcGV0LCB1bmRlZmluZWQsIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdHNlc3Npb24uaW5zZXJ0KCk7XG5cblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigyLCAxOSwgMiwgMTkpLCBuZXcgU2VsZWN0aW9uKDMsIDExLCAzLCAxMSksIG5ldyBTZWxlY3Rpb24oMywgMjgsIDMsIDI4KSk7XG5cdFx0ZWRpdG9yLnRyaWdnZXIoJ3Rlc3QnLCAndHlwZScsIHsgdGV4dDogJ19wcm9wJyB9KTtcblx0XHRzZXNzaW9uLm5leHQoKTtcblxuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDIsIDM5LCAyLCAzOSksIG5ldyBTZWxlY3Rpb24oMywgMjMsIDMsIDIzKSk7XG5cdFx0ZWRpdG9yLnRyaWdnZXIoJ3Rlc3QnLCAndHlwZScsIHsgdGV4dDogJ3N0cmluZycgfSk7XG5cdFx0c2Vzc2lvbi5uZXh0KCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgZXhwZWN0ZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uLmlzQXRMYXN0UGxhY2Vob2xkZXIsIHRydWUpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDQsIDIsIDQsIDIpKTtcblxuXHR9KTtcblxuXHR0ZXN0KCdzbmlwcGV0cywgdHJhbnNmb3JtIGV4YW1wbGUgaGl0IGlmJywgZnVuY3Rpb24gKCkge1xuXHRcdGVkaXRvci5nZXRNb2RlbCgpIS5zZXRWYWx1ZSgnJyk7XG5cdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpKTtcblx0XHRjb25zdCBzZXNzaW9uID0gbmV3IFNuaXBwZXRTZXNzaW9uKGVkaXRvciwgJyR7MTpuYW1lfSA6ICR7Mjp0eXBlfSR7My9cXFxcczo9KC4qKS8kezE6KyA6PX0kezF9L307XFxuJDAnLCB1bmRlZmluZWQsIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdHNlc3Npb24uaW5zZXJ0KCk7XG5cblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCAxLCAxLCA1KSk7XG5cdFx0ZWRpdG9yLnRyaWdnZXIoJ3Rlc3QnLCAndHlwZScsIHsgdGV4dDogJ2NsaycgfSk7XG5cdFx0c2Vzc2lvbi5uZXh0KCk7XG5cblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCA3LCAxLCAxMSkpO1xuXHRcdGVkaXRvci50cmlnZ2VyKCd0ZXN0JywgJ3R5cGUnLCB7IHRleHQ6ICdzdGRfbG9naWMnIH0pO1xuXHRcdHNlc3Npb24ubmV4dCgpO1xuXG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMTYsIDEsIDE2KSk7XG5cdFx0ZWRpdG9yLnRyaWdnZXIoJ3Rlc3QnLCAndHlwZScsIHsgdGV4dDogJyA6PSBcXCcxXFwnJyB9KTtcblx0XHRzZXNzaW9uLm5leHQoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnY2xrIDogc3RkX2xvZ2ljIDo9IFxcJzFcXCc7XFxuJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24uaXNBdExhc3RQbGFjZWhvbGRlciwgdHJ1ZSk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMiwgMSwgMiwgMSkpO1xuXHR9KTtcblxuXHR0ZXN0KCdTbmlwcGV0IHRhYiBzdG9wIHNlbGVjdGlvbiBpc3N1ZSAjOTY1NDUsIHNuaXBwZXRzLCB0cmFuc2Zvcm0gYWRqYWNlbnQgdG8gcHJldmlvdXMgcGxhY2Vob2xkZXInLCBmdW5jdGlvbiAoKSB7XG5cdFx0ZWRpdG9yLmdldE1vZGVsKCkhLnNldFZhbHVlKCcnKTtcblx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSkpO1xuXHRcdGNvbnN0IHNlc3Npb24gPSBuZXcgU25pcHBldFNlc3Npb24oZWRpdG9yLCAnJHsxOnt9JHsyOmZmZn0kezEvey99L30nLCB1bmRlZmluZWQsIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdHNlc3Npb24uaW5zZXJ0KCk7XG5cblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCAxLCAxLCAyKSwgbmV3IFNlbGVjdGlvbigxLCA1LCAxLCA2KSk7XG5cdFx0c2Vzc2lvbi5uZXh0KCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ3tmZmZ9Jyk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMiwgMSwgNSkpO1xuXHRcdGVkaXRvci50cmlnZ2VyKCd0ZXN0JywgJ3R5cGUnLCB7IHRleHQ6ICdnZ2cnIH0pO1xuXHRcdHNlc3Npb24ubmV4dCgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICd7Z2dnfScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uLmlzQXRMYXN0UGxhY2Vob2xkZXIsIHRydWUpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDYsIDEsIDYpKTtcblx0fSk7XG5cblx0dGVzdCgnU25pcHBldCB0YWIgc3RvcCBzZWxlY3Rpb24gaXNzdWUgIzk2NTQ1JywgZnVuY3Rpb24gKCkge1xuXHRcdGVkaXRvci5nZXRNb2RlbCgpLnNldFZhbHVlKCcnKTtcblx0XHRjb25zdCBzZXNzaW9uID0gbmV3IFNuaXBwZXRTZXNzaW9uKGVkaXRvciwgJyR7MTp7fSR7MjpmZmZ9JHsxL1tcXFxce10vfS99JDAnLCB1bmRlZmluZWQsIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdHNlc3Npb24uaW5zZXJ0KCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRNb2RlbCgpLmdldFZhbHVlKCksICd7ZmZmeycpO1xuXG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMiksIG5ldyBTZWxlY3Rpb24oMSwgNSwgMSwgNikpO1xuXHRcdHNlc3Npb24ubmV4dCgpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDIsIDEsIDUpKTtcblx0fSk7XG5cblx0dGVzdCgnU25pcHBldCBwbGFjZWhvbGRlciBpbmRleCBpbmNvcnJlY3QgYWZ0ZXIgdXNpbmcgMisgc25pcHBldHMgaW4gYSByb3cgdGhhdCBlYWNoIGVuZCB3aXRoIGEgcGxhY2Vob2xkZXIsICMzMDc2OScsIGZ1bmN0aW9uICgpIHtcblx0XHRlZGl0b3IuZ2V0TW9kZWwoKSEuc2V0VmFsdWUoJycpO1xuXHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSk7XG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IG5ldyBTbmlwcGV0U2Vzc2lvbihlZGl0b3IsICd0ZXN0ICR7MTpyZXBsYWNlbWV9JywgdW5kZWZpbmVkLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRzZXNzaW9uLmluc2VydCgpO1xuXG5cdFx0ZWRpdG9yLnRyaWdnZXIoJ3Rlc3QnLCAndHlwZScsIHsgdGV4dDogJzEnIH0pO1xuXHRcdGVkaXRvci50cmlnZ2VyKCd0ZXN0JywgJ3R5cGUnLCB7IHRleHQ6ICdcXG4nIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0VmFsdWUoKSwgJ3Rlc3QgMVxcbicpO1xuXG5cdFx0c2Vzc2lvbi5tZXJnZSgndGVzdCAkezE6cmVwbGFjZW1lfScpO1xuXHRcdGVkaXRvci50cmlnZ2VyKCd0ZXN0JywgJ3R5cGUnLCB7IHRleHQ6ICcyJyB9KTtcblx0XHRlZGl0b3IudHJpZ2dlcigndGVzdCcsICd0eXBlJywgeyB0ZXh0OiAnXFxuJyB9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0VmFsdWUoKSwgJ3Rlc3QgMVxcbnRlc3QgMlxcbicpO1xuXG5cdFx0c2Vzc2lvbi5tZXJnZSgndGVzdCAkezE6cmVwbGFjZW1lfScpO1xuXHRcdGVkaXRvci50cmlnZ2VyKCd0ZXN0JywgJ3R5cGUnLCB7IHRleHQ6ICczJyB9KTtcblx0XHRlZGl0b3IudHJpZ2dlcigndGVzdCcsICd0eXBlJywgeyB0ZXh0OiAnXFxuJyB9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0VmFsdWUoKSwgJ3Rlc3QgMVxcbnRlc3QgMlxcbnRlc3QgM1xcbicpO1xuXG5cdFx0c2Vzc2lvbi5tZXJnZSgndGVzdCAkezE6cmVwbGFjZW1lfScpO1xuXHRcdGVkaXRvci50cmlnZ2VyKCd0ZXN0JywgJ3R5cGUnLCB7IHRleHQ6ICc0JyB9KTtcblx0XHRlZGl0b3IudHJpZ2dlcigndGVzdCcsICd0eXBlJywgeyB0ZXh0OiAnXFxuJyB9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0VmFsdWUoKSwgJ3Rlc3QgMVxcbnRlc3QgMlxcbnRlc3QgM1xcbnRlc3QgNFxcbicpO1xuXHR9KTtcblxuXHR0ZXN0KCdTbmlwcGV0IHZhcmlhYmxlIHRleHQgaXNuXFwndCB3aGl0ZXNwYWNlIG5vcm1hbGlzZWQsICMzMTEyNCcsIGZ1bmN0aW9uICgpIHtcblx0XHRlZGl0b3IuZ2V0TW9kZWwoKSEuc2V0VmFsdWUoW1xuXHRcdFx0J3N0YXJ0Jyxcblx0XHRcdCdcXHRcXHQtb25lJyxcblx0XHRcdCdcXHRcXHQtdHdvJyxcblx0XHRcdCdlbmQnXG5cdFx0XS5qb2luKCdcXG4nKSk7XG5cblx0XHRlZGl0b3IuZ2V0TW9kZWwoKSEudXBkYXRlT3B0aW9ucyh7IGluc2VydFNwYWNlczogZmFsc2UgfSk7XG5cdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDIsIDIsIDMsIDcpKTtcblxuXHRcdG5ldyBTbmlwcGV0U2Vzc2lvbihlZGl0b3IsICc8ZGl2PlxcblxcdCRUTV9TRUxFQ1RFRF9URVhUXFxuPC9kaXY+JDAnLCB1bmRlZmluZWQsIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpLmluc2VydCgpO1xuXG5cdFx0bGV0IGV4cGVjdGVkID0gW1xuXHRcdFx0J3N0YXJ0Jyxcblx0XHRcdCdcXHQ8ZGl2PicsXG5cdFx0XHQnXFx0XFx0XFx0LW9uZScsXG5cdFx0XHQnXFx0XFx0XFx0LXR3bycsXG5cdFx0XHQnXFx0PC9kaXY+Jyxcblx0XHRcdCdlbmQnXG5cdFx0XS5qb2luKCdcXG4nKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0VmFsdWUoKSwgZXhwZWN0ZWQpO1xuXG5cdFx0ZWRpdG9yLmdldE1vZGVsKCkhLnNldFZhbHVlKFtcblx0XHRcdCdzdGFydCcsXG5cdFx0XHQnXFx0XFx0LW9uZScsXG5cdFx0XHQnXFx0LXR3bycsXG5cdFx0XHQnZW5kJ1xuXHRcdF0uam9pbignXFxuJykpO1xuXG5cdFx0ZWRpdG9yLmdldE1vZGVsKCkhLnVwZGF0ZU9wdGlvbnMoeyBpbnNlcnRTcGFjZXM6IGZhbHNlIH0pO1xuXHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigyLCAyLCAzLCA3KSk7XG5cblx0XHRuZXcgU25pcHBldFNlc3Npb24oZWRpdG9yLCAnPGRpdj5cXG5cXHQkVE1fU0VMRUNURURfVEVYVFxcbjwvZGl2PiQwJywgdW5kZWZpbmVkLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKS5pbnNlcnQoKTtcblxuXHRcdGV4cGVjdGVkID0gW1xuXHRcdFx0J3N0YXJ0Jyxcblx0XHRcdCdcXHQ8ZGl2PicsXG5cdFx0XHQnXFx0XFx0XFx0LW9uZScsXG5cdFx0XHQnXFx0XFx0LXR3bycsXG5cdFx0XHQnXFx0PC9kaXY+Jyxcblx0XHRcdCdlbmQnXG5cdFx0XS5qb2luKCdcXG4nKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0VmFsdWUoKSwgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdTZWxlY3RpbmcgdGV4dCBmcm9tIGxlZnQgdG8gcmlnaHQsIGFuZCBjaG9vc2luZyBpdGVtIG1lc3NlcyB1cCBjb2RlLCAjMzExOTknLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKSE7XG5cdFx0bW9kZWwuc2V0VmFsdWUoJ2NvbnNvbGUubG9nJyk7XG5cblx0XHRsZXQgYWN0dWFsID0gU25pcHBldFNlc3Npb24uYWRqdXN0U2VsZWN0aW9uKG1vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDEyLCAxLCA5KSwgMywgMCk7XG5cdFx0YXNzZXJ0Lm9rKGFjdHVhbC5lcXVhbHNTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCA5LCAxLCA2KSkpO1xuXG5cdFx0YWN0dWFsID0gU25pcHBldFNlc3Npb24uYWRqdXN0U2VsZWN0aW9uKG1vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDksIDEsIDEyKSwgMywgMCk7XG5cdFx0YXNzZXJ0Lm9rKGFjdHVhbC5lcXVhbHNTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCA5LCAxLCAxMikpKTtcblxuXHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtuZXcgU2VsZWN0aW9uKDEsIDksIDEsIDEyKV0pO1xuXHRcdG5ldyBTbmlwcGV0U2Vzc2lvbihlZGl0b3IsICdmYXInLCB7IG92ZXJ3cml0ZUJlZm9yZTogMywgb3ZlcndyaXRlQWZ0ZXI6IDAsIGFkanVzdFdoaXRlc3BhY2U6IHRydWUsIGNsaXBib2FyZFRleHQ6IHVuZGVmaW5lZCwgb3ZlcnR5cGluZ0NhcHR1cmVyOiB1bmRlZmluZWQgfSwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSkuaW5zZXJ0KCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICdjb25zb2xlLmZhcicpO1xuXHR9KTtcblxuXHR0ZXN0KCdUYWJzIGRvblxcJ3QgZ2V0IHJlcGxhY2VkIHdpdGggc3BhY2VzIGluIHNuaXBwZXQgdHJhbnNmb3JtYXRpb25zICMxMDM4MTgnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKSE7XG5cdFx0bW9kZWwuc2V0VmFsdWUoJ1xcbntcXG4gIFxcbn0nKTtcblx0XHRtb2RlbC51cGRhdGVPcHRpb25zKHsgaW5zZXJ0U3BhY2VzOiB0cnVlLCBpbmRlbnRTaXplOiAyIH0pO1xuXHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpLCBuZXcgU2VsZWN0aW9uKDMsIDYsIDMsIDYpXSk7XG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IG5ldyBTbmlwcGV0U2Vzc2lvbihlZGl0b3IsIFtcblx0XHRcdCdmdW5jdGlvbiBhbmltYXRlICgpIHsnLFxuXHRcdFx0J1xcdHZhciAkezE6YX0gPSAxMjsnLFxuXHRcdFx0J1xcdGNvbnNvbGUubG9nKCR7MS8oLiopL1xcblxcdFxcdCQxXFxuXFx0L30pJyxcblx0XHRcdCd9J1xuXHRcdF0uam9pbignXFxuJyksIHVuZGVmaW5lZCwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cblx0XHRzZXNzaW9uLmluc2VydCgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksIFtcblx0XHRcdCdmdW5jdGlvbiBhbmltYXRlICgpIHsnLFxuXHRcdFx0JyAgdmFyIGEgPSAxMjsnLFxuXHRcdFx0JyAgY29uc29sZS5sb2coYSknLFxuXHRcdFx0J30nLFxuXHRcdFx0J3snLFxuXHRcdFx0JyAgZnVuY3Rpb24gYW5pbWF0ZSAoKSB7Jyxcblx0XHRcdCcgICAgdmFyIGEgPSAxMjsnLFxuXHRcdFx0JyAgICBjb25zb2xlLmxvZyhhKScsXG5cdFx0XHQnICB9Jyxcblx0XHRcdCd9Jyxcblx0XHRdLmpvaW4oJ1xcbicpKTtcblxuXHRcdGVkaXRvci50cmlnZ2VyKCd0ZXN0JywgJ3R5cGUnLCB7IHRleHQ6ICdiYmInIH0pO1xuXHRcdHNlc3Npb24ubmV4dCgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksIFtcblx0XHRcdCdmdW5jdGlvbiBhbmltYXRlICgpIHsnLFxuXHRcdFx0JyAgdmFyIGJiYiA9IDEyOycsXG5cdFx0XHQnICBjb25zb2xlLmxvZygnLFxuXHRcdFx0JyAgICBiYmInLFxuXHRcdFx0JyAgKScsXG5cdFx0XHQnfScsXG5cdFx0XHQneycsXG5cdFx0XHQnICBmdW5jdGlvbiBhbmltYXRlICgpIHsnLFxuXHRcdFx0JyAgICB2YXIgYmJiID0gMTI7Jyxcblx0XHRcdCcgICAgY29uc29sZS5sb2coJyxcblx0XHRcdCcgICAgICBiYmInLFxuXHRcdFx0JyAgICApJyxcblx0XHRcdCcgIH0nLFxuXHRcdFx0J30nLFxuXHRcdF0uam9pbignXFxuJykpO1xuXHR9KTtcblxuXG5cdHN1aXRlKCdjcmVhdGVFZGl0c0FuZFNuaXBwZXRzRnJvbUVkaXRzJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0dGVzdCgnZW1wdHknLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRcdGNvbnN0IHJlc3VsdCA9IFNuaXBwZXRTZXNzaW9uLmNyZWF0ZUVkaXRzQW5kU25pcHBldHNGcm9tRWRpdHMoZWRpdG9yLCBbXSwgdHJ1ZSwgdHJ1ZSwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc3VsdC5lZGl0cywgW10pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHQuc25pcHBldHMsIFtdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2Jhc2ljJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0XHRlZGl0b3IuZ2V0TW9kZWwoKS5zZXRWYWx1ZSgnZm9vKFwiYmFyXCIpJyk7XG5cblx0XHRcdGNvbnN0IHJlc3VsdCA9IFNuaXBwZXRTZXNzaW9uLmNyZWF0ZUVkaXRzQW5kU25pcHBldHNGcm9tRWRpdHMoXG5cdFx0XHRcdGVkaXRvcixcblx0XHRcdFx0W3sgcmFuZ2U6IG5ldyBSYW5nZSgxLCA1LCAxLCA5KSwgdGVtcGxhdGU6ICckMScgfSwgeyByYW5nZTogbmV3IFJhbmdlKDEsIDEsIDEsIDEpLCB0ZW1wbGF0ZTogJ2NvbnN0ICR7MTpuZXdfY29uc3R9ID0gXCJiYXJcIicgfV0sXG5cdFx0XHRcdHRydWUsIHRydWUsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlXG5cdFx0XHQpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LmVkaXRzLmxlbmd0aCwgMik7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc3VsdC5lZGl0c1swXS5yYW5nZSwgbmV3IFJhbmdlKDEsIDEsIDEsIDEpKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0LmVkaXRzWzBdLnRleHQsICdjb25zdCBuZXdfY29uc3QgPSBcImJhclwiJyk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc3VsdC5lZGl0c1sxXS5yYW5nZSwgbmV3IFJhbmdlKDEsIDUsIDEsIDkpKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0LmVkaXRzWzFdLnRleHQsICduZXdfY29uc3QnKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5zbmlwcGV0cy5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5zbmlwcGV0c1swXS5pc1RyaXZpYWxTbmlwcGV0LCBmYWxzZSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCd3aXRoICRTRUxFQ1RJT04gdmFyaWFibGUnLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRlZGl0b3IuZ2V0TW9kZWwoKS5zZXRWYWx1ZSgnU29tZSB0ZXh0IGFuZCBhIHNlbGVjdGlvbicpO1xuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoW25ldyBTZWxlY3Rpb24oMSwgMTcsIDEsIDI2KV0pO1xuXG5cdFx0XHRjb25zdCByZXN1bHQgPSBTbmlwcGV0U2Vzc2lvbi5jcmVhdGVFZGl0c0FuZFNuaXBwZXRzRnJvbUVkaXRzKFxuXHRcdFx0XHRlZGl0b3IsXG5cdFx0XHRcdFt7IHJhbmdlOiBuZXcgUmFuZ2UoMSwgMTcsIDEsIDI2KSwgdGVtcGxhdGU6ICd3cmFwcGVkIDwkU0VMRUNUSU9OPicgfV0sXG5cdFx0XHRcdHRydWUsIHRydWUsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlXG5cdFx0XHQpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LmVkaXRzLmxlbmd0aCwgMSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc3VsdC5lZGl0c1swXS5yYW5nZSwgbmV3IFJhbmdlKDEsIDE3LCAxLCAyNikpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHQuZWRpdHNbMF0udGV4dCwgJ3dyYXBwZWQgPHNlbGVjdGlvbj4nKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5zbmlwcGV0cy5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5zbmlwcGV0c1swXS5pc1RyaXZpYWxTbmlwcGV0LCB0cnVlKTtcblx0XHR9KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUlBLE9BQU8sWUFBWTtBQUNuQixTQUFTLFlBQVk7QUFDckIsU0FBUywrQ0FBK0M7QUFFeEQsU0FBb0IsZ0JBQWdCO0FBQ3BDLFNBQVMsYUFBYTtBQUN0QixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLHFDQUFxQztBQUU5QyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLHdDQUF3QztBQUNqRCxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGdDQUFnQztBQUV6QyxNQUFNLGtCQUFrQixXQUFZO0FBRW5DLE1BQUk7QUFDSixNQUFJO0FBQ0osTUFBSTtBQUVKLFdBQVMsaUJBQWlCQSxZQUE4QixHQUFnQjtBQUN2RSxlQUFXLGFBQWFBLFFBQU8sY0FBYyxHQUFHO0FBQy9DLFlBQU0sU0FBUyxFQUFFLE1BQU07QUFDdkIsYUFBTyxHQUFHLFVBQVUsZ0JBQWdCLE1BQU0sR0FBRyxVQUFVLFVBQVUsU0FBUyxDQUFDLGdCQUFnQixPQUFPLFNBQVMsQ0FBQyxFQUFFO0FBQUEsSUFDL0c7QUFDQSxXQUFPLFlBQVksRUFBRSxRQUFRLENBQUM7QUFBQSxFQUMvQjtBQUVBLFFBQU0sV0FBWTtBQUNqQixZQUFRLGdCQUFnQiwwQ0FBMEM7QUFDbEUsbUNBQStCLElBQUksaUNBQWlDO0FBQ3BFLFVBQU0sb0JBQW9CLElBQUk7QUFBQSxNQUM3QixDQUFDLGVBQWUsSUFBSSxjQUFjLEtBQW9CLEVBQUU7QUFBQSxNQUFFLEdBQUM7QUFBQSxNQUMzRCxDQUFDLCtCQUErQiw0QkFBNEI7QUFBQSxNQUM1RCxDQUFDLDBCQUEwQixJQUFJLGNBQWMsS0FBK0IsRUFBRTtBQUFBLFFBQ3BFLGVB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LEdBQUcsQ0FBQyxHQUFHLFVBQVUsS0FBSyxHQUFHLEVBQUUsT0FBTyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLFVBQVUsK0JBQStCLENBQUM7QUFBQSxRQUM3SDtBQUFBLFFBQU07QUFBQSxRQUFNO0FBQUEsUUFBVztBQUFBLFFBQVc7QUFBQSxNQUNuQztBQUVBLGFBQU8sWUFBWSxPQUFPLE1BQU0sUUFBUSxDQUFDO0FBQ3pDLGFBQU8sZ0JBQWdCLE9BQU8sTUFBTSxDQUFDLEVBQUUsT0FBTyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQ25FLGFBQU8sZ0JBQWdCLE9BQU8sTUFBTSxDQUFDLEVBQUUsTUFBTSx5QkFBeUI7QUFDdEUsYUFBTyxnQkFBZ0IsT0FBTyxNQUFNLENBQUMsRUFBRSxPQUFPLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFDbkUsYUFBTyxnQkFBZ0IsT0FBTyxNQUFNLENBQUMsRUFBRSxNQUFNLFdBQVc7QUFFeEQsYUFBTyxZQUFZLE9BQU8sU0FBUyxRQUFRLENBQUM7QUFDNUMsYUFBTyxZQUFZLE9BQU8sU0FBUyxDQUFDLEVBQUUsa0JBQWtCLEtBQUs7QUFBQSxJQUM5RCxDQUFDO0FBRUQsU0FBSyw0QkFBNEIsV0FBWTtBQUM1QyxhQUFPLFNBQVMsRUFBRSxTQUFTLDJCQUEyQjtBQUN0RCxhQUFPLGNBQWMsQ0FBQyxJQUFJLFVBQVUsR0FBRyxJQUFJLEdBQUcsRUFBRSxDQUFDLENBQUM7QUFFbEQsWUFBTSxTQUFTLGVBQWU7QUFBQSxRQUM3QjtBQUFBLFFBQ0EsQ0FBQyxFQUFFLE9BQU8sSUFBSSxNQUFNLEdBQUcsSUFBSSxHQUFHLEVBQUUsR0FBRyxVQUFVLHVCQUF1QixDQUFDO0FBQUEsUUFDckU7QUFBQSxRQUFNO0FBQUEsUUFBTTtBQUFBLFFBQVc7QUFBQSxRQUFXO0FBQUEsTUFDbkM7QUFFQSxhQUFPLFlBQVksT0FBTyxNQUFNLFFBQVEsQ0FBQztBQUN6QyxhQUFPLGdCQUFnQixPQUFPLE1BQU0sQ0FBQyxFQUFFLE9BQU8sSUFBSSxNQUFNLEdBQUcsSUFBSSxHQUFHLEVBQUUsQ0FBQztBQUNyRSxhQUFPLGdCQUFnQixPQUFPLE1BQU0sQ0FBQyxFQUFFLE1BQU0scUJBQXFCO0FBRWxFLGFBQU8sWUFBWSxPQUFPLFNBQVMsUUFBUSxDQUFDO0FBQzVDLGFBQU8sWUFBWSxPQUFPLFNBQVMsQ0FBQyxFQUFFLGtCQUFrQixJQUFJO0FBQUEsSUFDN0QsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbImVkaXRvciIsICJtb2RlbCJdCn0K
