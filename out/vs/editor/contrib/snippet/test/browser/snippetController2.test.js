import assert from "assert";
import { mock } from "../../../../../base/test/common/mock.js";
import { CoreEditingCommands } from "../../../../browser/coreCommands.js";
import { Selection } from "../../../../common/core/selection.js";
import { Range } from "../../../../common/core/range.js";
import { Handler } from "../../../../common/editorCommon.js";
import { SnippetController2 } from "../../browser/snippetController2.js";
import { createTestCodeEditor } from "../../../../test/browser/testCodeEditor.js";
import { createTextModel } from "../../../../test/common/testTextModel.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { InstantiationService } from "../../../../../platform/instantiation/common/instantiationService.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { MockContextKeyService } from "../../../../../platform/keybinding/test/common/mockKeybindingService.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { ILogService, NullLogService } from "../../../../../platform/log/common/log.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { EndOfLineSequence } from "../../../../common/model.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
suite("SnippetController2", function() {
  function assertSelections(editor2, ...s) {
    for (const selection of editor2.getSelections()) {
      const actual = s.shift();
      assert.ok(selection.equalsSelection(actual), `actual=${selection.toString()} <> expected=${actual.toString()}`);
    }
    assert.strictEqual(s.length, 0);
  }
  function assertContextKeys(service, inSnippet, hasPrev, hasNext) {
    const state = getContextState(service);
    assert.strictEqual(state.inSnippet, inSnippet, `inSnippetMode`);
    assert.strictEqual(state.hasPrev, hasPrev, `HasPrevTabstop`);
    assert.strictEqual(state.hasNext, hasNext, `HasNextTabstop`);
  }
  function getContextState(service = contextKeys) {
    return {
      inSnippet: SnippetController2.InSnippetMode.getValue(service),
      hasPrev: SnippetController2.HasPrevTabstop.getValue(service),
      hasNext: SnippetController2.HasNextTabstop.getValue(service)
    };
  }
  let ctrl;
  let editor;
  let model;
  let contextKeys;
  let instaService;
  setup(function() {
    contextKeys = new MockContextKeyService();
    model = createTextModel("if\n    $state\nfi");
    const serviceCollection = new ServiceCollection(
      [ILabelService, new class extends mock() {
      }()],
      [IWorkspaceContextService, new class extends mock() {
        getWorkspace() {
          return { id: "foo", folders: [] };
        }
      }()],
      [ILogService, new NullLogService()],
      [IContextKeyService, contextKeys]
    );
    instaService = new InstantiationService(serviceCollection);
    editor = createTestCodeEditor(model, { serviceCollection });
    editor.setSelections([new Selection(1, 1, 1, 1), new Selection(2, 5, 2, 5)]);
    assert.strictEqual(model.getEOL(), "\n");
  });
  teardown(function() {
    model.dispose();
    ctrl.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("creation", () => {
    ctrl = instaService.createInstance(SnippetController2, editor);
    assertContextKeys(contextKeys, false, false, false);
  });
  test("insert, insert -> abort", function() {
    ctrl = instaService.createInstance(SnippetController2, editor);
    ctrl.insert("foo${1:bar}foo$0");
    assertContextKeys(contextKeys, true, false, true);
    assertSelections(editor, new Selection(1, 4, 1, 7), new Selection(2, 8, 2, 11));
    ctrl.cancel();
    assertContextKeys(contextKeys, false, false, false);
    assertSelections(editor, new Selection(1, 4, 1, 7), new Selection(2, 8, 2, 11));
  });
  test("insert, insert -> tab, tab, done", function() {
    ctrl = instaService.createInstance(SnippetController2, editor);
    ctrl.insert("${1:one}${2:two}$0");
    assertContextKeys(contextKeys, true, false, true);
    ctrl.next();
    assertContextKeys(contextKeys, true, true, true);
    ctrl.next();
    assertContextKeys(contextKeys, false, false, false);
    editor.trigger("test", "type", { text: "	" });
    assert.strictEqual(SnippetController2.InSnippetMode.getValue(contextKeys), false);
    assert.strictEqual(SnippetController2.HasNextTabstop.getValue(contextKeys), false);
    assert.strictEqual(SnippetController2.HasPrevTabstop.getValue(contextKeys), false);
  });
  test("insert, insert -> cursor moves out (left/right)", function() {
    ctrl = instaService.createInstance(SnippetController2, editor);
    ctrl.insert("foo${1:bar}foo$0");
    assertContextKeys(contextKeys, true, false, true);
    assertSelections(editor, new Selection(1, 4, 1, 7), new Selection(2, 8, 2, 11));
    editor.setSelections([new Selection(1, 12, 1, 12), new Selection(2, 16, 2, 16)]);
    assertContextKeys(contextKeys, false, false, false);
  });
  test("insert, insert -> cursor moves out (up/down)", function() {
    ctrl = instaService.createInstance(SnippetController2, editor);
    ctrl.insert("foo${1:bar}foo$0");
    assertContextKeys(contextKeys, true, false, true);
    assertSelections(editor, new Selection(1, 4, 1, 7), new Selection(2, 8, 2, 11));
    editor.setSelections([new Selection(2, 4, 2, 7), new Selection(3, 8, 3, 11)]);
    assertContextKeys(contextKeys, false, false, false);
  });
  test("insert, insert -> cursors collapse", function() {
    ctrl = instaService.createInstance(SnippetController2, editor);
    ctrl.insert("foo${1:bar}foo$0");
    assert.strictEqual(SnippetController2.InSnippetMode.getValue(contextKeys), true);
    assertSelections(editor, new Selection(1, 4, 1, 7), new Selection(2, 8, 2, 11));
    editor.setSelections([new Selection(1, 4, 1, 7)]);
    assertContextKeys(contextKeys, false, false, false);
  });
  test("insert, insert plain text -> no snippet mode", function() {
    ctrl = instaService.createInstance(SnippetController2, editor);
    ctrl.insert("foobar");
    assertContextKeys(contextKeys, false, false, false);
    assertSelections(editor, new Selection(1, 7, 1, 7), new Selection(2, 11, 2, 11));
  });
  test("insert, delete snippet text", function() {
    ctrl = instaService.createInstance(SnippetController2, editor);
    ctrl.insert("${1:foobar}$0");
    assertContextKeys(contextKeys, true, false, true);
    assertSelections(editor, new Selection(1, 1, 1, 7), new Selection(2, 5, 2, 11));
    editor.trigger("test", "cut", {});
    assertContextKeys(contextKeys, true, false, true);
    assertSelections(editor, new Selection(1, 1, 1, 1), new Selection(2, 5, 2, 5));
    editor.trigger("test", "type", { text: "abc" });
    assertContextKeys(contextKeys, true, false, true);
    ctrl.next();
    assertContextKeys(contextKeys, false, false, false);
    editor.trigger("test", "tab", {});
    assertContextKeys(contextKeys, false, false, false);
  });
  test("insert, nested trivial snippet", function() {
    ctrl = instaService.createInstance(SnippetController2, editor);
    ctrl.insert("${1:foo}bar$0");
    assertContextKeys(contextKeys, true, false, true);
    assertSelections(editor, new Selection(1, 1, 1, 4), new Selection(2, 5, 2, 8));
    ctrl.insert("FOO$0");
    assertSelections(editor, new Selection(1, 4, 1, 4), new Selection(2, 8, 2, 8));
    assertContextKeys(contextKeys, true, false, true);
    ctrl.next();
    assertSelections(editor, new Selection(1, 7, 1, 7), new Selection(2, 11, 2, 11));
    assertContextKeys(contextKeys, false, false, false);
  });
  test("insert, nested snippet", function() {
    ctrl = instaService.createInstance(SnippetController2, editor);
    ctrl.insert("${1:foobar}$0");
    assertContextKeys(contextKeys, true, false, true);
    assertSelections(editor, new Selection(1, 1, 1, 7), new Selection(2, 5, 2, 11));
    ctrl.insert("far$1boo$0");
    assertSelections(editor, new Selection(1, 4, 1, 4), new Selection(2, 8, 2, 8));
    assertContextKeys(contextKeys, true, false, true);
    ctrl.next();
    assertSelections(editor, new Selection(1, 7, 1, 7), new Selection(2, 11, 2, 11));
    assertContextKeys(contextKeys, true, true, true);
    ctrl.next();
    assertSelections(editor, new Selection(1, 7, 1, 7), new Selection(2, 11, 2, 11));
    assertContextKeys(contextKeys, false, false, false);
  });
  test("insert, nested plain text", function() {
    ctrl = instaService.createInstance(SnippetController2, editor);
    ctrl.insert("${1:foobar}$0");
    assertContextKeys(contextKeys, true, false, true);
    assertSelections(editor, new Selection(1, 1, 1, 7), new Selection(2, 5, 2, 11));
    ctrl.insert("farboo");
    assertSelections(editor, new Selection(1, 7, 1, 7), new Selection(2, 11, 2, 11));
    assertContextKeys(contextKeys, true, false, true);
    ctrl.next();
    assertSelections(editor, new Selection(1, 7, 1, 7), new Selection(2, 11, 2, 11));
    assertContextKeys(contextKeys, false, false, false);
  });
  test("Nested snippets without final placeholder jumps to next outer placeholder, #27898", function() {
    ctrl = instaService.createInstance(SnippetController2, editor);
    ctrl.insert("for(const ${1:element} of ${2:array}) {$0}");
    assertContextKeys(contextKeys, true, false, true);
    assertSelections(editor, new Selection(1, 11, 1, 18), new Selection(2, 15, 2, 22));
    ctrl.next();
    assertContextKeys(contextKeys, true, true, true);
    assertSelections(editor, new Selection(1, 22, 1, 27), new Selection(2, 26, 2, 31));
    ctrl.insert("document");
    assertContextKeys(contextKeys, true, true, true);
    assertSelections(editor, new Selection(1, 30, 1, 30), new Selection(2, 34, 2, 34));
    ctrl.next();
    assertContextKeys(contextKeys, false, false, false);
  });
  test("Inconsistent tab stop behaviour with recursive snippets and tab / shift tab, #27543", function() {
    ctrl = instaService.createInstance(SnippetController2, editor);
    ctrl.insert("1_calize(${1:nl}, '${2:value}')$0");
    assertContextKeys(contextKeys, true, false, true);
    assertSelections(editor, new Selection(1, 10, 1, 12), new Selection(2, 14, 2, 16));
    ctrl.insert("2_calize(${1:nl}, '${2:value}')$0");
    assertSelections(editor, new Selection(1, 19, 1, 21), new Selection(2, 23, 2, 25));
    ctrl.next();
    assertSelections(editor, new Selection(1, 24, 1, 29), new Selection(2, 28, 2, 33));
    ctrl.next();
    assertSelections(editor, new Selection(1, 31, 1, 31), new Selection(2, 35, 2, 35));
    ctrl.next();
    assertSelections(editor, new Selection(1, 34, 1, 39), new Selection(2, 38, 2, 43));
    ctrl.prev();
    assertSelections(editor, new Selection(1, 31, 1, 31), new Selection(2, 35, 2, 35));
  });
  test("Snippet tabstop selecting content of previously entered variable only works when separated by space, #23728", function() {
    ctrl = instaService.createInstance(SnippetController2, editor);
    model.setValue("");
    editor.setSelection(new Selection(1, 1, 1, 1));
    ctrl.insert("import ${2:${1:module}} from '${1:module}'$0");
    assertContextKeys(contextKeys, true, false, true);
    assertSelections(editor, new Selection(1, 8, 1, 14), new Selection(1, 21, 1, 27));
    ctrl.insert("foo");
    assertSelections(editor, new Selection(1, 11, 1, 11), new Selection(1, 21, 1, 21));
    ctrl.next();
    assertSelections(editor, new Selection(1, 8, 1, 11));
  });
  test("HTML Snippets Combine, #32211", function() {
    ctrl = instaService.createInstance(SnippetController2, editor);
    model.setValue("");
    model.updateOptions({ insertSpaces: false, tabSize: 4, trimAutoWhitespace: false });
    editor.setSelection(new Selection(1, 1, 1, 1));
    ctrl.insert(`
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=\${2:device-width}, initial-scale=\${3:1.0}">
				<meta http-equiv="X-UA-Compatible" content="\${5:ie=edge}">
				<title>\${7:Document}</title>
			</head>
			<body>
				\${8}
			</body>
			</html>
		`);
    ctrl.next();
    ctrl.next();
    ctrl.next();
    ctrl.next();
    assertSelections(editor, new Selection(11, 5, 11, 5));
    ctrl.insert('<input type="${2:text}">');
    assertSelections(editor, new Selection(11, 18, 11, 22));
  });
  test("Problems with nested snippet insertion #39594", function() {
    ctrl = instaService.createInstance(SnippetController2, editor);
    model.setValue("");
    editor.setSelection(new Selection(1, 1, 1, 1));
    ctrl.insert("$1 = ConvertTo-Json $1");
    assertSelections(editor, new Selection(1, 1, 1, 1), new Selection(1, 19, 1, 19));
    editor.setSelection(new Selection(1, 19, 1, 19));
    assertContextKeys(contextKeys, false, false, false);
  });
  test("Problems with nested snippet insertion #39594 (part2)", function() {
    ctrl = instaService.createInstance(SnippetController2, editor);
    model.setValue("a-\naaa-");
    editor.setSelections([new Selection(2, 5, 2, 5), new Selection(1, 3, 1, 3)]);
    ctrl.insert("log($1);$0");
    assertSelections(editor, new Selection(2, 9, 2, 9), new Selection(1, 7, 1, 7));
    assertContextKeys(contextKeys, true, false, true);
  });
  test("\u201CNested\u201D snippets terminating abruptly in VSCode 1.19.2. #42012", function() {
    ctrl = instaService.createInstance(SnippetController2, editor);
    model.setValue("");
    editor.setSelection(new Selection(1, 1, 1, 1));
    ctrl.insert("var ${2:${1:name}} = ${1:name} + 1;${0}");
    assertSelections(editor, new Selection(1, 5, 1, 9), new Selection(1, 12, 1, 16));
    assertContextKeys(contextKeys, true, false, true);
    ctrl.next();
    assertContextKeys(contextKeys, true, true, true);
  });
  test("Placeholders order #58267", function() {
    ctrl = instaService.createInstance(SnippetController2, editor);
    model.setValue("");
    editor.setSelection(new Selection(1, 1, 1, 1));
    ctrl.insert("\\pth{$1}$0");
    assertSelections(editor, new Selection(1, 6, 1, 6));
    assertContextKeys(contextKeys, true, false, true);
    ctrl.insert("\\itv{${1:left}}{${2:right}}{${3:left_value}}{${4:right_value}}$0");
    assertSelections(editor, new Selection(1, 11, 1, 15));
    ctrl.next();
    assertSelections(editor, new Selection(1, 17, 1, 22));
    ctrl.next();
    assertSelections(editor, new Selection(1, 24, 1, 34));
    ctrl.next();
    assertSelections(editor, new Selection(1, 36, 1, 47));
    ctrl.next();
    assertSelections(editor, new Selection(1, 48, 1, 48));
    ctrl.next();
    assertSelections(editor, new Selection(1, 49, 1, 49));
    assertContextKeys(contextKeys, false, false, false);
  });
  test("Must tab through deleted tab stops in snippets #31619", function() {
    ctrl = instaService.createInstance(SnippetController2, editor);
    model.setValue("");
    editor.setSelection(new Selection(1, 1, 1, 1));
    ctrl.insert("foo${1:a${2:bar}baz}end$0");
    assertSelections(editor, new Selection(1, 4, 1, 11));
    editor.trigger("test", Handler.Cut, null);
    assertSelections(editor, new Selection(1, 4, 1, 4));
    ctrl.next();
    assertSelections(editor, new Selection(1, 7, 1, 7));
    assertContextKeys(contextKeys, false, false, false);
  });
  test("Cancelling snippet mode should discard added cursors #68512 (soft cancel)", function() {
    ctrl = instaService.createInstance(SnippetController2, editor);
    model.setValue("");
    editor.setSelection(new Selection(1, 1, 1, 1));
    ctrl.insert(".REGION ${2:FUNCTION_NAME}\nCREATE.FUNCTION ${1:VOID} ${2:FUNCTION_NAME}(${3:})\n	${4:}\nEND\n.ENDREGION$0");
    assertSelections(editor, new Selection(2, 17, 2, 21));
    ctrl.next();
    assertSelections(editor, new Selection(1, 9, 1, 22), new Selection(2, 22, 2, 35));
    assertContextKeys(contextKeys, true, true, true);
    editor.setSelections([new Selection(1, 22, 1, 22), new Selection(2, 35, 2, 35)]);
    assertContextKeys(contextKeys, true, true, true);
    editor.setSelections([new Selection(2, 1, 2, 1), new Selection(2, 36, 2, 36)]);
    assertContextKeys(contextKeys, false, false, false);
    assertSelections(editor, new Selection(2, 1, 2, 1), new Selection(2, 36, 2, 36));
  });
  test("Cancelling snippet mode should discard added cursors #68512 (hard cancel)", function() {
    ctrl = instaService.createInstance(SnippetController2, editor);
    model.setValue("");
    editor.setSelection(new Selection(1, 1, 1, 1));
    ctrl.insert(".REGION ${2:FUNCTION_NAME}\nCREATE.FUNCTION ${1:VOID} ${2:FUNCTION_NAME}(${3:})\n	${4:}\nEND\n.ENDREGION$0");
    assertSelections(editor, new Selection(2, 17, 2, 21));
    ctrl.next();
    assertSelections(editor, new Selection(1, 9, 1, 22), new Selection(2, 22, 2, 35));
    assertContextKeys(contextKeys, true, true, true);
    editor.setSelections([new Selection(1, 22, 1, 22), new Selection(2, 35, 2, 35)]);
    assertContextKeys(contextKeys, true, true, true);
    ctrl.cancel(true);
    assertContextKeys(contextKeys, false, false, false);
    assertSelections(editor, new Selection(1, 22, 1, 22));
  });
  test("User defined snippet tab stops ignored #72862", function() {
    ctrl = instaService.createInstance(SnippetController2, editor);
    model.setValue("");
    editor.setSelection(new Selection(1, 1, 1, 1));
    ctrl.insert("export default $1");
    assertContextKeys(contextKeys, true, false, true);
  });
  test("Optional tabstop in snippets #72358", function() {
    ctrl = instaService.createInstance(SnippetController2, editor);
    model.setValue("");
    editor.setSelection(new Selection(1, 1, 1, 1));
    ctrl.insert("${1:prop: {$2\\},}\nmore$0");
    assertContextKeys(contextKeys, true, false, true);
    assertSelections(editor, new Selection(1, 1, 1, 10));
    editor.trigger("test", Handler.Cut, {});
    assertSelections(editor, new Selection(1, 1, 1, 1));
    ctrl.next();
    assertSelections(editor, new Selection(2, 5, 2, 5));
    assertContextKeys(contextKeys, false, false, false);
  });
  test("issue #90135: confusing trim whitespace edits", function() {
    ctrl = instaService.createInstance(SnippetController2, editor);
    model.setValue("");
    CoreEditingCommands.Tab.runEditorCommand(null, editor, null);
    ctrl.insert("\nfoo");
    assertSelections(editor, new Selection(2, 8, 2, 8));
  });
  test("issue #145727: insertSnippet can put snippet selections in wrong positions (1 of 2)", function() {
    ctrl = instaService.createInstance(SnippetController2, editor);
    model.setValue("");
    CoreEditingCommands.Tab.runEditorCommand(null, editor, null);
    ctrl.insert("\naProperty: aClass<${2:boolean}> = new aClass<${2:boolean}>();\n", { adjustWhitespace: false });
    assertSelections(editor, new Selection(2, 19, 2, 26), new Selection(2, 41, 2, 48));
  });
  test("issue #145727: insertSnippet can put snippet selections in wrong positions (2 of 2)", function() {
    ctrl = instaService.createInstance(SnippetController2, editor);
    model.setValue("");
    CoreEditingCommands.Tab.runEditorCommand(null, editor, null);
    ctrl.insert("\naProperty: aClass<${2:boolean}> = new aClass<${2:boolean}>();\n");
    assertSelections(editor, new Selection(2, 23, 2, 30), new Selection(2, 45, 2, 52));
  });
  test("leading TAB by snippets won't replace by spaces #101870", function() {
    ctrl = instaService.createInstance(SnippetController2, editor);
    model.setValue("");
    model.updateOptions({ insertSpaces: true, tabSize: 4 });
    ctrl.insert("	Hello World\n	New Line");
    assert.strictEqual(model.getValue(), "    Hello World\n    New Line");
  });
  test("leading TAB by snippets won't replace by spaces #101870 (part 2)", function() {
    ctrl = instaService.createInstance(SnippetController2, editor);
    model.setValue("");
    model.updateOptions({ insertSpaces: true, tabSize: 4 });
    ctrl.insert("	Hello World\n	New Line\n${1:	more}");
    assert.strictEqual(model.getValue(), "    Hello World\n    New Line\n    more");
  });
  test.skip("Snippet transformation does not work after inserting variable using intellisense, #112362", function() {
    {
      ctrl = instaService.createInstance(SnippetController2, editor);
      model.setValue("");
      model.updateOptions({ insertSpaces: true, tabSize: 4 });
      ctrl.insert("$1\n\n${1/([A-Za-z0-9]+): ([A-Za-z]+).*/$1: '$2',/gm}");
      assertSelections(editor, new Selection(1, 1, 1, 1), new Selection(3, 1, 3, 1));
      editor.trigger("test", "type", { text: "foo: number;" });
      ctrl.next();
      assert.strictEqual(model.getValue(), `foo: number;

foo: 'number',`);
    }
    ctrl = instaService.createInstance(SnippetController2, editor);
    model.setValue("");
    model.updateOptions({ insertSpaces: true, tabSize: 4 });
    ctrl.insert("$1\n\n${1/([A-Za-z0-9]+): ([A-Za-z]+).*/$1: '$2',/gm}");
    assertSelections(editor, new Selection(1, 1, 1, 1), new Selection(3, 1, 3, 1));
    editor.trigger("test", "type", { text: "foo: " });
    ctrl.insert("number;");
    ctrl.next();
    assert.strictEqual(model.getValue(), `foo: number;

foo: 'number',`);
  });
  suite("createEditsAndSnippetsFromEdits", function() {
    test("apply, tab, done", function() {
      ctrl = instaService.createInstance(SnippetController2, editor);
      model.setValue('foo("bar")');
      ctrl.apply([
        { range: new Range(1, 5, 1, 10), template: "$1" },
        { range: new Range(1, 1, 1, 1), template: 'const ${1:new_const} = "bar";\n' }
      ]);
      assert.strictEqual(model.getValue(), 'const new_const = "bar";\nfoo(new_const)');
      assertContextKeys(contextKeys, true, false, true);
      assert.deepStrictEqual(editor.getSelections(), [new Selection(1, 7, 1, 16), new Selection(2, 5, 2, 14)]);
      ctrl.next();
      assertContextKeys(contextKeys, false, false, false);
      assert.deepStrictEqual(editor.getSelections(), [new Selection(2, 14, 2, 14)]);
    });
    test("apply, tab, done with special final tabstop", function() {
      model.setValue('foo("bar")');
      ctrl = instaService.createInstance(SnippetController2, editor);
      ctrl.apply([
        { range: new Range(1, 5, 1, 10), template: "$1" },
        { range: new Range(1, 1, 1, 1), template: 'const ${1:new_const}$0 = "bar";\n' }
      ]);
      assert.strictEqual(model.getValue(), 'const new_const = "bar";\nfoo(new_const)');
      assertContextKeys(contextKeys, true, false, true);
      assert.deepStrictEqual(editor.getSelections(), [new Selection(1, 7, 1, 16), new Selection(2, 5, 2, 14)]);
      ctrl.next();
      assertContextKeys(contextKeys, false, false, false);
      assert.deepStrictEqual(editor.getSelections(), [new Selection(1, 16, 1, 16)]);
    });
    test("apply, tab, tab, done", function() {
      model.setValue("foo\nbar");
      ctrl = instaService.createInstance(SnippetController2, editor);
      ctrl.apply([
        { range: new Range(1, 4, 1, 4), template: "${3}" },
        { range: new Range(2, 4, 2, 4), template: "$3" },
        { range: new Range(1, 1, 1, 1), template: "### ${2:Header}\n" }
      ]);
      assert.strictEqual(model.getValue(), "### Header\nfoo\nbar");
      assert.deepStrictEqual(getContextState(), { inSnippet: true, hasPrev: false, hasNext: true });
      assert.deepStrictEqual(editor.getSelections(), [new Selection(1, 5, 1, 11)]);
      ctrl.next();
      assert.deepStrictEqual(getContextState(), { inSnippet: true, hasPrev: true, hasNext: true });
      assert.deepStrictEqual(editor.getSelections(), [new Selection(2, 4, 2, 4), new Selection(3, 4, 3, 4)]);
      ctrl.next();
      assert.deepStrictEqual(getContextState(), { inSnippet: false, hasPrev: false, hasNext: false });
      assert.deepStrictEqual(editor.getSelections(), [new Selection(3, 4, 3, 4)]);
    });
    test("nested into apply works", function() {
      ctrl = instaService.createInstance(SnippetController2, editor);
      model.setValue("onetwo");
      editor.setSelections([new Selection(1, 1, 1, 1), new Selection(2, 1, 2, 1)]);
      ctrl.apply([{
        range: new Range(1, 7, 1, 7),
        template: "$0${1:three}"
      }]);
      assert.strictEqual(model.getValue(), "onetwothree");
      assert.deepStrictEqual(getContextState(), { inSnippet: true, hasPrev: false, hasNext: true });
      assert.deepStrictEqual(editor.getSelections(), [new Selection(1, 7, 1, 12)]);
      ctrl.insert("foo$1bar$1");
      assert.strictEqual(model.getValue(), "onetwofoobar");
      assert.deepStrictEqual(editor.getSelections(), [new Selection(1, 10, 1, 10), new Selection(1, 13, 1, 13)]);
      assert.deepStrictEqual(getContextState(), { inSnippet: true, hasPrev: false, hasNext: true });
      ctrl.next();
      assert.deepStrictEqual(getContextState(), { inSnippet: true, hasPrev: true, hasNext: true });
      assert.deepStrictEqual(editor.getSelections(), [new Selection(1, 13, 1, 13)]);
      ctrl.next();
      assert.deepStrictEqual(getContextState(), { inSnippet: false, hasPrev: false, hasNext: false });
      assert.deepStrictEqual(editor.getSelections(), [new Selection(1, 7, 1, 7)]);
    });
    test('nested into insert abort "outer" snippet', function() {
      ctrl = instaService.createInstance(SnippetController2, editor);
      model.setValue("one\ntwo");
      editor.setSelections([new Selection(1, 1, 1, 1), new Selection(2, 1, 2, 1)]);
      ctrl.insert("foo${1:bar}bazz${1:bang}");
      assert.deepStrictEqual(editor.getSelections(), [new Selection(1, 4, 1, 7), new Selection(1, 11, 1, 14), new Selection(2, 4, 2, 7), new Selection(2, 11, 2, 14)]);
      assert.deepStrictEqual(getContextState(), { inSnippet: true, hasPrev: false, hasNext: true });
      ctrl.apply([{
        range: new Range(1, 4, 1, 7),
        template: "$0A"
      }]);
      assert.strictEqual(model.getValue(), "fooAbazzbarone\nfoobarbazzbartwo");
      assert.deepStrictEqual(getContextState(), { inSnippet: false, hasPrev: false, hasNext: false });
      assert.deepStrictEqual(editor.getSelections(), [new Selection(1, 4, 1, 4)]);
    });
    test('nested into "insert" abort "outer" snippet (2)', function() {
      ctrl = instaService.createInstance(SnippetController2, editor);
      model.setValue("one\ntwo");
      editor.setSelections([new Selection(1, 1, 1, 1), new Selection(2, 1, 2, 1)]);
      ctrl.insert("foo${1:bar}bazz${1:bang}");
      assert.deepStrictEqual(editor.getSelections(), [new Selection(1, 4, 1, 7), new Selection(1, 11, 1, 14), new Selection(2, 4, 2, 7), new Selection(2, 11, 2, 14)]);
      assert.deepStrictEqual(getContextState(), { inSnippet: true, hasPrev: false, hasNext: true });
      const edits = [{
        range: new Range(1, 4, 1, 7),
        template: "A"
      }, {
        range: new Range(1, 11, 1, 14),
        template: "B"
      }, {
        range: new Range(2, 4, 2, 7),
        template: "C"
      }, {
        range: new Range(2, 11, 2, 14),
        template: "D"
      }];
      ctrl.apply(edits);
      assert.strictEqual(model.getValue(), "fooAbazzBone\nfooCbazzDtwo");
      assert.deepStrictEqual(getContextState(), { inSnippet: false, hasPrev: false, hasNext: false });
      assert.deepStrictEqual(editor.getSelections(), [new Selection(1, 5, 1, 5), new Selection(1, 10, 1, 10), new Selection(2, 5, 2, 5), new Selection(2, 10, 2, 10)]);
    });
  });
  test("Bug: cursor position $0 with user snippets #163808", function() {
    ctrl = instaService.createInstance(SnippetController2, editor);
    model.setValue("");
    ctrl.insert('<Element1 Attr1="foo" $1>\n  <Element2 Attr1="$2"/>\n$0"\n</Element1>');
    assert.deepStrictEqual(editor.getSelections(), [new Selection(1, 23, 1, 23)]);
    ctrl.insert('Qualifier="$0"');
    assert.strictEqual(model.getValue(), '<Element1 Attr1="foo" Qualifier="">\n  <Element2 Attr1=""/>\n"\n</Element1>');
    assert.deepStrictEqual(editor.getSelections(), [new Selection(1, 34, 1, 34)]);
  });
  test("EOL-Sequence (CRLF) shifts tab stop in isFileTemplate snippets #167386", function() {
    ctrl = instaService.createInstance(SnippetController2, editor);
    model.setValue("");
    model.setEOL(EndOfLineSequence.CRLF);
    ctrl.apply([{
      range: model.getFullModelRange(),
      template: "line 54321${1:FOO}\nline 54321${1:FOO}\n(no tab stop)\nline 54321${1:FOO}\nline 54321"
    }]);
    assert.deepStrictEqual(editor.getSelections(), [new Selection(1, 11, 1, 14), new Selection(2, 11, 2, 14), new Selection(4, 11, 4, 14)]);
  });
  test('"Surround With" code action snippets use incorrect indentation levels and styles #169319', function() {
    model.setValue("function foo(f, x, condition) {\n    f();\n    return x;\n}");
    const sel = new Range(2, 5, 3, 14);
    editor.setSelection(sel);
    ctrl = instaService.createInstance(SnippetController2, editor);
    ctrl.apply([{
      range: sel,
      template: "if (${1:condition}) {\n	$TM_SELECTED_TEXT$0\n}"
    }]);
    assert.strictEqual(model.getValue(), `function foo(f, x, condition) {
    if (condition) {
        f();
        return x;
    }
}`);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9zbmlwcGV0L3Rlc3QvYnJvd3Nlci9zbmlwcGV0Q29udHJvbGxlcjIudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBtb2NrIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi9tb2NrLmpzJztcbmltcG9ydCB7IENvcmVFZGl0aW5nQ29tbWFuZHMgfSBmcm9tICcuLi8uLi8uLi8uLi9icm93c2VyL2NvcmVDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBTZWxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9zZWxlY3Rpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBIYW5kbGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbW9kZWwvdGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IFNuaXBwZXRDb250cm9sbGVyMiB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvc25pcHBldENvbnRyb2xsZXIyLmpzJztcbmltcG9ydCB7IGNyZWF0ZVRlc3RDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9icm93c2VyL3Rlc3RDb2RlRWRpdG9yLmpzJztcbmltcG9ydCB7IGNyZWF0ZVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvY29tbW9uL3Rlc3RUZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgU2VydmljZUNvbGxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9zZXJ2aWNlQ29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBNb2NrQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL3Rlc3QvY29tbW9uL21vY2tLZXliaW5kaW5nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTGFiZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGFiZWwvY29tbW9uL2xhYmVsLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlLCBOdWxsTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IEVuZE9mTGluZVNlcXVlbmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuXG5zdWl0ZSgnU25pcHBldENvbnRyb2xsZXIyJywgZnVuY3Rpb24gKCkge1xuXG5cdC8qKiBAZGVwcmVjYXRlZCAqL1xuXHRmdW5jdGlvbiBhc3NlcnRTZWxlY3Rpb25zKGVkaXRvcjogSUNvZGVFZGl0b3IsIC4uLnM6IFNlbGVjdGlvbltdKSB7XG5cdFx0Zm9yIChjb25zdCBzZWxlY3Rpb24gb2YgZWRpdG9yLmdldFNlbGVjdGlvbnMoKSEpIHtcblx0XHRcdGNvbnN0IGFjdHVhbCA9IHMuc2hpZnQoKSE7XG5cdFx0XHRhc3NlcnQub2soc2VsZWN0aW9uLmVxdWFsc1NlbGVjdGlvbihhY3R1YWwpLCBgYWN0dWFsPSR7c2VsZWN0aW9uLnRvU3RyaW5nKCl9IDw+IGV4cGVjdGVkPSR7YWN0dWFsLnRvU3RyaW5nKCl9YCk7XG5cdFx0fVxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzLmxlbmd0aCwgMCk7XG5cdH1cblxuXHRmdW5jdGlvbiBhc3NlcnRDb250ZXh0S2V5cyhzZXJ2aWNlOiBNb2NrQ29udGV4dEtleVNlcnZpY2UsIGluU25pcHBldDogYm9vbGVhbiwgaGFzUHJldjogYm9vbGVhbiwgaGFzTmV4dDogYm9vbGVhbik6IHZvaWQge1xuXHRcdGNvbnN0IHN0YXRlID0gZ2V0Q29udGV4dFN0YXRlKHNlcnZpY2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGF0ZS5pblNuaXBwZXQsIGluU25pcHBldCwgYGluU25pcHBldE1vZGVgKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RhdGUuaGFzUHJldiwgaGFzUHJldiwgYEhhc1ByZXZUYWJzdG9wYCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0YXRlLmhhc05leHQsIGhhc05leHQsIGBIYXNOZXh0VGFic3RvcGApO1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0Q29udGV4dFN0YXRlKHNlcnZpY2U6IE1vY2tDb250ZXh0S2V5U2VydmljZSA9IGNvbnRleHRLZXlzKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGluU25pcHBldDogU25pcHBldENvbnRyb2xsZXIyLkluU25pcHBldE1vZGUuZ2V0VmFsdWUoc2VydmljZSksXG5cdFx0XHRoYXNQcmV2OiBTbmlwcGV0Q29udHJvbGxlcjIuSGFzUHJldlRhYnN0b3AuZ2V0VmFsdWUoc2VydmljZSksXG5cdFx0XHRoYXNOZXh0OiBTbmlwcGV0Q29udHJvbGxlcjIuSGFzTmV4dFRhYnN0b3AuZ2V0VmFsdWUoc2VydmljZSksXG5cdFx0fTtcblx0fVxuXG5cdGxldCBjdHJsOiBTbmlwcGV0Q29udHJvbGxlcjI7XG5cdGxldCBlZGl0b3I6IElDb2RlRWRpdG9yO1xuXHRsZXQgbW9kZWw6IFRleHRNb2RlbDtcblx0bGV0IGNvbnRleHRLZXlzOiBNb2NrQ29udGV4dEtleVNlcnZpY2U7XG5cdGxldCBpbnN0YVNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZTtcblxuXHRzZXR1cChmdW5jdGlvbiAoKSB7XG5cdFx0Y29udGV4dEtleXMgPSBuZXcgTW9ja0NvbnRleHRLZXlTZXJ2aWNlKCk7XG5cdFx0bW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoJ2lmXFxuICAgICRzdGF0ZVxcbmZpJyk7XG5cdFx0Y29uc3Qgc2VydmljZUNvbGxlY3Rpb24gPSBuZXcgU2VydmljZUNvbGxlY3Rpb24oXG5cdFx0XHRbSUxhYmVsU2VydmljZSwgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJTGFiZWxTZXJ2aWNlPigpIHsgfV0sXG5cdFx0XHRbSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElXb3Jrc3BhY2VDb250ZXh0U2VydmljZT4oKSB7XG5cdFx0XHRcdG92ZXJyaWRlIGdldFdvcmtzcGFjZSgpIHtcblx0XHRcdFx0XHRyZXR1cm4geyBpZDogJ2ZvbycsIGZvbGRlcnM6IFtdIH07XG5cdFx0XHRcdH1cblx0XHRcdH1dLFxuXHRcdFx0W0lMb2dTZXJ2aWNlLCBuZXcgTnVsbExvZ1NlcnZpY2UoKV0sXG5cdFx0XHRbSUNvbnRleHRLZXlTZXJ2aWNlLCBjb250ZXh0S2V5c10sXG5cdFx0KTtcblx0XHRpbnN0YVNlcnZpY2UgPSBuZXcgSW5zdGFudGlhdGlvblNlcnZpY2Uoc2VydmljZUNvbGxlY3Rpb24pO1xuXHRcdGVkaXRvciA9IGNyZWF0ZVRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7IHNlcnZpY2VDb2xsZWN0aW9uIH0pO1xuXHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpLCBuZXcgU2VsZWN0aW9uKDIsIDUsIDIsIDUpXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldEVPTCgpLCAnXFxuJyk7XG5cdH0pO1xuXG5cdHRlYXJkb3duKGZ1bmN0aW9uICgpIHtcblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdFx0Y3RybC5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ2NyZWF0aW9uJywgKCkgPT4ge1xuXHRcdGN0cmwgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU25pcHBldENvbnRyb2xsZXIyLCBlZGl0b3IpO1xuXHRcdGFzc2VydENvbnRleHRLZXlzKGNvbnRleHRLZXlzLCBmYWxzZSwgZmFsc2UsIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnaW5zZXJ0LCBpbnNlcnQgLT4gYWJvcnQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y3RybCA9IGluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShTbmlwcGV0Q29udHJvbGxlcjIsIGVkaXRvcik7XG5cblx0XHRjdHJsLmluc2VydCgnZm9vJHsxOmJhcn1mb28kMCcpO1xuXHRcdGFzc2VydENvbnRleHRLZXlzKGNvbnRleHRLZXlzLCB0cnVlLCBmYWxzZSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNyksIG5ldyBTZWxlY3Rpb24oMiwgOCwgMiwgMTEpKTtcblxuXHRcdGN0cmwuY2FuY2VsKCk7XG5cdFx0YXNzZXJ0Q29udGV4dEtleXMoY29udGV4dEtleXMsIGZhbHNlLCBmYWxzZSwgZmFsc2UpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDcpLCBuZXcgU2VsZWN0aW9uKDIsIDgsIDIsIDExKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2luc2VydCwgaW5zZXJ0IC0+IHRhYiwgdGFiLCBkb25lJywgZnVuY3Rpb24gKCkge1xuXHRcdGN0cmwgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU25pcHBldENvbnRyb2xsZXIyLCBlZGl0b3IpO1xuXG5cdFx0Y3RybC5pbnNlcnQoJyR7MTpvbmV9JHsyOnR3b30kMCcpO1xuXHRcdGFzc2VydENvbnRleHRLZXlzKGNvbnRleHRLZXlzLCB0cnVlLCBmYWxzZSwgdHJ1ZSk7XG5cblx0XHRjdHJsLm5leHQoKTtcblx0XHRhc3NlcnRDb250ZXh0S2V5cyhjb250ZXh0S2V5cywgdHJ1ZSwgdHJ1ZSwgdHJ1ZSk7XG5cblx0XHRjdHJsLm5leHQoKTtcblx0XHRhc3NlcnRDb250ZXh0S2V5cyhjb250ZXh0S2V5cywgZmFsc2UsIGZhbHNlLCBmYWxzZSk7XG5cblx0XHRlZGl0b3IudHJpZ2dlcigndGVzdCcsICd0eXBlJywgeyB0ZXh0OiAnXFx0JyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoU25pcHBldENvbnRyb2xsZXIyLkluU25pcHBldE1vZGUuZ2V0VmFsdWUoY29udGV4dEtleXMpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFNuaXBwZXRDb250cm9sbGVyMi5IYXNOZXh0VGFic3RvcC5nZXRWYWx1ZShjb250ZXh0S2V5cyksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoU25pcHBldENvbnRyb2xsZXIyLkhhc1ByZXZUYWJzdG9wLmdldFZhbHVlKGNvbnRleHRLZXlzKSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdpbnNlcnQsIGluc2VydCAtPiBjdXJzb3IgbW92ZXMgb3V0IChsZWZ0L3JpZ2h0KScsIGZ1bmN0aW9uICgpIHtcblx0XHRjdHJsID0gaW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNuaXBwZXRDb250cm9sbGVyMiwgZWRpdG9yKTtcblxuXHRcdGN0cmwuaW5zZXJ0KCdmb28kezE6YmFyfWZvbyQwJyk7XG5cdFx0YXNzZXJ0Q29udGV4dEtleXMoY29udGV4dEtleXMsIHRydWUsIGZhbHNlLCB0cnVlKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA3KSwgbmV3IFNlbGVjdGlvbigyLCA4LCAyLCAxMSkpO1xuXG5cdFx0Ly8gYmFkIHNlbGVjdGlvbiBjaGFuZ2Vcblx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9ucyhbbmV3IFNlbGVjdGlvbigxLCAxMiwgMSwgMTIpLCBuZXcgU2VsZWN0aW9uKDIsIDE2LCAyLCAxNildKTtcblx0XHRhc3NlcnRDb250ZXh0S2V5cyhjb250ZXh0S2V5cywgZmFsc2UsIGZhbHNlLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2luc2VydCwgaW5zZXJ0IC0+IGN1cnNvciBtb3ZlcyBvdXQgKHVwL2Rvd24pJywgZnVuY3Rpb24gKCkge1xuXHRcdGN0cmwgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU25pcHBldENvbnRyb2xsZXIyLCBlZGl0b3IpO1xuXG5cdFx0Y3RybC5pbnNlcnQoJ2ZvbyR7MTpiYXJ9Zm9vJDAnKTtcblx0XHRhc3NlcnRDb250ZXh0S2V5cyhjb250ZXh0S2V5cywgdHJ1ZSwgZmFsc2UsIHRydWUpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDcpLCBuZXcgU2VsZWN0aW9uKDIsIDgsIDIsIDExKSk7XG5cblx0XHQvLyBiYWQgc2VsZWN0aW9uIGNoYW5nZVxuXHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtuZXcgU2VsZWN0aW9uKDIsIDQsIDIsIDcpLCBuZXcgU2VsZWN0aW9uKDMsIDgsIDMsIDExKV0pO1xuXHRcdGFzc2VydENvbnRleHRLZXlzKGNvbnRleHRLZXlzLCBmYWxzZSwgZmFsc2UsIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnaW5zZXJ0LCBpbnNlcnQgLT4gY3Vyc29ycyBjb2xsYXBzZScsIGZ1bmN0aW9uICgpIHtcblx0XHRjdHJsID0gaW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNuaXBwZXRDb250cm9sbGVyMiwgZWRpdG9yKTtcblxuXHRcdGN0cmwuaW5zZXJ0KCdmb28kezE6YmFyfWZvbyQwJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFNuaXBwZXRDb250cm9sbGVyMi5JblNuaXBwZXRNb2RlLmdldFZhbHVlKGNvbnRleHRLZXlzKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNyksIG5ldyBTZWxlY3Rpb24oMiwgOCwgMiwgMTEpKTtcblxuXHRcdC8vIGJhZCBzZWxlY3Rpb24gY2hhbmdlXG5cdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoW25ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNyldKTtcblx0XHRhc3NlcnRDb250ZXh0S2V5cyhjb250ZXh0S2V5cywgZmFsc2UsIGZhbHNlLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2luc2VydCwgaW5zZXJ0IHBsYWluIHRleHQgLT4gbm8gc25pcHBldCBtb2RlJywgZnVuY3Rpb24gKCkge1xuXHRcdGN0cmwgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU25pcHBldENvbnRyb2xsZXIyLCBlZGl0b3IpO1xuXG5cdFx0Y3RybC5pbnNlcnQoJ2Zvb2JhcicpO1xuXHRcdGFzc2VydENvbnRleHRLZXlzKGNvbnRleHRLZXlzLCBmYWxzZSwgZmFsc2UsIGZhbHNlKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCA3LCAxLCA3KSwgbmV3IFNlbGVjdGlvbigyLCAxMSwgMiwgMTEpKTtcblx0fSk7XG5cblx0dGVzdCgnaW5zZXJ0LCBkZWxldGUgc25pcHBldCB0ZXh0JywgZnVuY3Rpb24gKCkge1xuXHRcdGN0cmwgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU25pcHBldENvbnRyb2xsZXIyLCBlZGl0b3IpO1xuXG5cdFx0Y3RybC5pbnNlcnQoJyR7MTpmb29iYXJ9JDAnKTtcblx0XHRhc3NlcnRDb250ZXh0S2V5cyhjb250ZXh0S2V5cywgdHJ1ZSwgZmFsc2UsIHRydWUpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDcpLCBuZXcgU2VsZWN0aW9uKDIsIDUsIDIsIDExKSk7XG5cblx0XHRlZGl0b3IudHJpZ2dlcigndGVzdCcsICdjdXQnLCB7fSk7XG5cdFx0YXNzZXJ0Q29udGV4dEtleXMoY29udGV4dEtleXMsIHRydWUsIGZhbHNlLCB0cnVlKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSwgbmV3IFNlbGVjdGlvbigyLCA1LCAyLCA1KSk7XG5cblx0XHRlZGl0b3IudHJpZ2dlcigndGVzdCcsICd0eXBlJywgeyB0ZXh0OiAnYWJjJyB9KTtcblx0XHRhc3NlcnRDb250ZXh0S2V5cyhjb250ZXh0S2V5cywgdHJ1ZSwgZmFsc2UsIHRydWUpO1xuXG5cdFx0Y3RybC5uZXh0KCk7XG5cdFx0YXNzZXJ0Q29udGV4dEtleXMoY29udGV4dEtleXMsIGZhbHNlLCBmYWxzZSwgZmFsc2UpO1xuXG5cdFx0ZWRpdG9yLnRyaWdnZXIoJ3Rlc3QnLCAndGFiJywge30pO1xuXHRcdGFzc2VydENvbnRleHRLZXlzKGNvbnRleHRLZXlzLCBmYWxzZSwgZmFsc2UsIGZhbHNlKTtcblxuXHRcdC8vIGVkaXRvci50cmlnZ2VyKCd0ZXN0JywgJ3R5cGUnLCB7IHRleHQ6ICdhYmMnIH0pO1xuXHRcdC8vIGFzc2VydENvbnRleHRLZXlzKGNvbnRleHRLZXlzLCBmYWxzZSwgZmFsc2UsIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnaW5zZXJ0LCBuZXN0ZWQgdHJpdmlhbCBzbmlwcGV0JywgZnVuY3Rpb24gKCkge1xuXHRcdGN0cmwgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU25pcHBldENvbnRyb2xsZXIyLCBlZGl0b3IpO1xuXHRcdGN0cmwuaW5zZXJ0KCckezE6Zm9vfWJhciQwJyk7XG5cdFx0YXNzZXJ0Q29udGV4dEtleXMoY29udGV4dEtleXMsIHRydWUsIGZhbHNlLCB0cnVlKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCAxLCAxLCA0KSwgbmV3IFNlbGVjdGlvbigyLCA1LCAyLCA4KSk7XG5cblx0XHRjdHJsLmluc2VydCgnRk9PJDAnKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA0KSwgbmV3IFNlbGVjdGlvbigyLCA4LCAyLCA4KSk7XG5cdFx0YXNzZXJ0Q29udGV4dEtleXMoY29udGV4dEtleXMsIHRydWUsIGZhbHNlLCB0cnVlKTtcblxuXHRcdGN0cmwubmV4dCgpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDcsIDEsIDcpLCBuZXcgU2VsZWN0aW9uKDIsIDExLCAyLCAxMSkpO1xuXHRcdGFzc2VydENvbnRleHRLZXlzKGNvbnRleHRLZXlzLCBmYWxzZSwgZmFsc2UsIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnaW5zZXJ0LCBuZXN0ZWQgc25pcHBldCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjdHJsID0gaW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNuaXBwZXRDb250cm9sbGVyMiwgZWRpdG9yKTtcblx0XHRjdHJsLmluc2VydCgnJHsxOmZvb2Jhcn0kMCcpO1xuXHRcdGFzc2VydENvbnRleHRLZXlzKGNvbnRleHRLZXlzLCB0cnVlLCBmYWxzZSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgNyksIG5ldyBTZWxlY3Rpb24oMiwgNSwgMiwgMTEpKTtcblxuXHRcdGN0cmwuaW5zZXJ0KCdmYXIkMWJvbyQwJyk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNCksIG5ldyBTZWxlY3Rpb24oMiwgOCwgMiwgOCkpO1xuXHRcdGFzc2VydENvbnRleHRLZXlzKGNvbnRleHRLZXlzLCB0cnVlLCBmYWxzZSwgdHJ1ZSk7XG5cblx0XHRjdHJsLm5leHQoKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCA3LCAxLCA3KSwgbmV3IFNlbGVjdGlvbigyLCAxMSwgMiwgMTEpKTtcblx0XHRhc3NlcnRDb250ZXh0S2V5cyhjb250ZXh0S2V5cywgdHJ1ZSwgdHJ1ZSwgdHJ1ZSk7XG5cblx0XHRjdHJsLm5leHQoKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCA3LCAxLCA3KSwgbmV3IFNlbGVjdGlvbigyLCAxMSwgMiwgMTEpKTtcblx0XHRhc3NlcnRDb250ZXh0S2V5cyhjb250ZXh0S2V5cywgZmFsc2UsIGZhbHNlLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2luc2VydCwgbmVzdGVkIHBsYWluIHRleHQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y3RybCA9IGluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShTbmlwcGV0Q29udHJvbGxlcjIsIGVkaXRvcik7XG5cdFx0Y3RybC5pbnNlcnQoJyR7MTpmb29iYXJ9JDAnKTtcblx0XHRhc3NlcnRDb250ZXh0S2V5cyhjb250ZXh0S2V5cywgdHJ1ZSwgZmFsc2UsIHRydWUpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDcpLCBuZXcgU2VsZWN0aW9uKDIsIDUsIDIsIDExKSk7XG5cblx0XHRjdHJsLmluc2VydCgnZmFyYm9vJyk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgNywgMSwgNyksIG5ldyBTZWxlY3Rpb24oMiwgMTEsIDIsIDExKSk7XG5cdFx0YXNzZXJ0Q29udGV4dEtleXMoY29udGV4dEtleXMsIHRydWUsIGZhbHNlLCB0cnVlKTtcblxuXHRcdGN0cmwubmV4dCgpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDcsIDEsIDcpLCBuZXcgU2VsZWN0aW9uKDIsIDExLCAyLCAxMSkpO1xuXHRcdGFzc2VydENvbnRleHRLZXlzKGNvbnRleHRLZXlzLCBmYWxzZSwgZmFsc2UsIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnTmVzdGVkIHNuaXBwZXRzIHdpdGhvdXQgZmluYWwgcGxhY2Vob2xkZXIganVtcHMgdG8gbmV4dCBvdXRlciBwbGFjZWhvbGRlciwgIzI3ODk4JywgZnVuY3Rpb24gKCkge1xuXHRcdGN0cmwgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU25pcHBldENvbnRyb2xsZXIyLCBlZGl0b3IpO1xuXG5cdFx0Y3RybC5pbnNlcnQoJ2Zvcihjb25zdCAkezE6ZWxlbWVudH0gb2YgJHsyOmFycmF5fSkgeyQwfScpO1xuXHRcdGFzc2VydENvbnRleHRLZXlzKGNvbnRleHRLZXlzLCB0cnVlLCBmYWxzZSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMTEsIDEsIDE4KSwgbmV3IFNlbGVjdGlvbigyLCAxNSwgMiwgMjIpKTtcblxuXHRcdGN0cmwubmV4dCgpO1xuXHRcdGFzc2VydENvbnRleHRLZXlzKGNvbnRleHRLZXlzLCB0cnVlLCB0cnVlLCB0cnVlKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCAyMiwgMSwgMjcpLCBuZXcgU2VsZWN0aW9uKDIsIDI2LCAyLCAzMSkpO1xuXG5cdFx0Y3RybC5pbnNlcnQoJ2RvY3VtZW50Jyk7XG5cdFx0YXNzZXJ0Q29udGV4dEtleXMoY29udGV4dEtleXMsIHRydWUsIHRydWUsIHRydWUpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDMwLCAxLCAzMCksIG5ldyBTZWxlY3Rpb24oMiwgMzQsIDIsIDM0KSk7XG5cblx0XHRjdHJsLm5leHQoKTtcblx0XHRhc3NlcnRDb250ZXh0S2V5cyhjb250ZXh0S2V5cywgZmFsc2UsIGZhbHNlLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0luY29uc2lzdGVudCB0YWIgc3RvcCBiZWhhdmlvdXIgd2l0aCByZWN1cnNpdmUgc25pcHBldHMgYW5kIHRhYiAvIHNoaWZ0IHRhYiwgIzI3NTQzJywgZnVuY3Rpb24gKCkge1xuXHRcdGN0cmwgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU25pcHBldENvbnRyb2xsZXIyLCBlZGl0b3IpO1xuXHRcdGN0cmwuaW5zZXJ0KCcxX2NhbGl6ZSgkezE6bmx9LCBcXCckezI6dmFsdWV9XFwnKSQwJyk7XG5cblx0XHRhc3NlcnRDb250ZXh0S2V5cyhjb250ZXh0S2V5cywgdHJ1ZSwgZmFsc2UsIHRydWUpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDEwLCAxLCAxMiksIG5ldyBTZWxlY3Rpb24oMiwgMTQsIDIsIDE2KSk7XG5cblx0XHRjdHJsLmluc2VydCgnMl9jYWxpemUoJHsxOm5sfSwgXFwnJHsyOnZhbHVlfVxcJykkMCcpO1xuXG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMTksIDEsIDIxKSwgbmV3IFNlbGVjdGlvbigyLCAyMywgMiwgMjUpKTtcblxuXHRcdGN0cmwubmV4dCgpOyAvLyBpbm5lciBgdmFsdWVgXG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMjQsIDEsIDI5KSwgbmV3IFNlbGVjdGlvbigyLCAyOCwgMiwgMzMpKTtcblxuXHRcdGN0cmwubmV4dCgpOyAvLyBpbm5lciBgJDBgXG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMzEsIDEsIDMxKSwgbmV3IFNlbGVjdGlvbigyLCAzNSwgMiwgMzUpKTtcblxuXHRcdGN0cmwubmV4dCgpOyAvLyBvdXRlciBgdmFsdWVgXG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMzQsIDEsIDM5KSwgbmV3IFNlbGVjdGlvbigyLCAzOCwgMiwgNDMpKTtcblxuXHRcdGN0cmwucHJldigpOyAvLyBpbm5lciBgJDBgXG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMzEsIDEsIDMxKSwgbmV3IFNlbGVjdGlvbigyLCAzNSwgMiwgMzUpKTtcblx0fSk7XG5cblx0dGVzdCgnU25pcHBldCB0YWJzdG9wIHNlbGVjdGluZyBjb250ZW50IG9mIHByZXZpb3VzbHkgZW50ZXJlZCB2YXJpYWJsZSBvbmx5IHdvcmtzIHdoZW4gc2VwYXJhdGVkIGJ5IHNwYWNlLCAjMjM3MjgnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y3RybCA9IGluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShTbmlwcGV0Q29udHJvbGxlcjIsIGVkaXRvcik7XG5cblx0XHRtb2RlbC5zZXRWYWx1ZSgnJyk7XG5cdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpKTtcblxuXHRcdGN0cmwuaW5zZXJ0KCdpbXBvcnQgJHsyOiR7MTptb2R1bGV9fSBmcm9tIFxcJyR7MTptb2R1bGV9XFwnJDAnKTtcblxuXHRcdGFzc2VydENvbnRleHRLZXlzKGNvbnRleHRLZXlzLCB0cnVlLCBmYWxzZSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgOCwgMSwgMTQpLCBuZXcgU2VsZWN0aW9uKDEsIDIxLCAxLCAyNykpO1xuXG5cdFx0Y3RybC5pbnNlcnQoJ2ZvbycpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDExLCAxLCAxMSksIG5ldyBTZWxlY3Rpb24oMSwgMjEsIDEsIDIxKSk7XG5cblx0XHRjdHJsLm5leHQoKTsgLy8gJHsyOi4uLn1cblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCA4LCAxLCAxMSkpO1xuXHR9KTtcblxuXHR0ZXN0KCdIVE1MIFNuaXBwZXRzIENvbWJpbmUsICMzMjIxMScsIGZ1bmN0aW9uICgpIHtcblx0XHRjdHJsID0gaW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNuaXBwZXRDb250cm9sbGVyMiwgZWRpdG9yKTtcblxuXHRcdG1vZGVsLnNldFZhbHVlKCcnKTtcblx0XHRtb2RlbC51cGRhdGVPcHRpb25zKHsgaW5zZXJ0U3BhY2VzOiBmYWxzZSwgdGFiU2l6ZTogNCwgdHJpbUF1dG9XaGl0ZXNwYWNlOiBmYWxzZSB9KTtcblx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSkpO1xuXG5cdFx0Y3RybC5pbnNlcnQoYFxuXHRcdFx0PCFET0NUWVBFIGh0bWw+XG5cdFx0XHQ8aHRtbCBsYW5nPVwiZW5cIj5cblx0XHRcdDxoZWFkPlxuXHRcdFx0XHQ8bWV0YSBjaGFyc2V0PVwiVVRGLThcIj5cblx0XHRcdFx0PG1ldGEgbmFtZT1cInZpZXdwb3J0XCIgY29udGVudD1cIndpZHRoPVxcJHsyOmRldmljZS13aWR0aH0sIGluaXRpYWwtc2NhbGU9XFwkezM6MS4wfVwiPlxuXHRcdFx0XHQ8bWV0YSBodHRwLWVxdWl2PVwiWC1VQS1Db21wYXRpYmxlXCIgY29udGVudD1cIlxcJHs1OmllPWVkZ2V9XCI+XG5cdFx0XHRcdDx0aXRsZT5cXCR7NzpEb2N1bWVudH08L3RpdGxlPlxuXHRcdFx0PC9oZWFkPlxuXHRcdFx0PGJvZHk+XG5cdFx0XHRcdFxcJHs4fVxuXHRcdFx0PC9ib2R5PlxuXHRcdFx0PC9odG1sPlxuXHRcdGApO1xuXHRcdGN0cmwubmV4dCgpO1xuXHRcdGN0cmwubmV4dCgpO1xuXHRcdGN0cmwubmV4dCgpO1xuXHRcdGN0cmwubmV4dCgpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDExLCA1LCAxMSwgNSkpO1xuXG5cdFx0Y3RybC5pbnNlcnQoJzxpbnB1dCB0eXBlPVwiJHsyOnRleHR9XCI+Jyk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMTEsIDE4LCAxMSwgMjIpKTtcblx0fSk7XG5cblx0dGVzdCgnUHJvYmxlbXMgd2l0aCBuZXN0ZWQgc25pcHBldCBpbnNlcnRpb24gIzM5NTk0JywgZnVuY3Rpb24gKCkge1xuXHRcdGN0cmwgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU25pcHBldENvbnRyb2xsZXIyLCBlZGl0b3IpO1xuXG5cdFx0bW9kZWwuc2V0VmFsdWUoJycpO1xuXHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSk7XG5cblx0XHRjdHJsLmluc2VydCgnJDEgPSBDb252ZXJ0VG8tSnNvbiAkMScpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpLCBuZXcgU2VsZWN0aW9uKDEsIDE5LCAxLCAxOSkpO1xuXG5cdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDEsIDE5LCAxLCAxOSkpO1xuXG5cdFx0Ly8gc25pcHBldCBtb2RlIHNob3VsZCBzdG9wIGJlY2F1c2UgJDEgaGFzIHR3byBvY2N1cnJlbmNlc1xuXHRcdC8vIGFuZCB3ZSBvbmx5IGhhdmUgb25lIHNlbGVjdGlvbiBsZWZ0XG5cdFx0YXNzZXJ0Q29udGV4dEtleXMoY29udGV4dEtleXMsIGZhbHNlLCBmYWxzZSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdQcm9ibGVtcyB3aXRoIG5lc3RlZCBzbmlwcGV0IGluc2VydGlvbiAjMzk1OTQgKHBhcnQyKScsIGZ1bmN0aW9uICgpIHtcblx0XHQvLyBlbnN1cmUgc2VsZWN0aW9uLWNoYW5nZS10by1jYW5jZWwgbG9naWMgaXNuJ3QgdG9vIGFnZ3Jlc3NpdmVcblx0XHRjdHJsID0gaW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNuaXBwZXRDb250cm9sbGVyMiwgZWRpdG9yKTtcblxuXHRcdG1vZGVsLnNldFZhbHVlKCdhLVxcbmFhYS0nKTtcblx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9ucyhbbmV3IFNlbGVjdGlvbigyLCA1LCAyLCA1KSwgbmV3IFNlbGVjdGlvbigxLCAzLCAxLCAzKV0pO1xuXG5cdFx0Y3RybC5pbnNlcnQoJ2xvZygkMSk7JDAnKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigyLCA5LCAyLCA5KSwgbmV3IFNlbGVjdGlvbigxLCA3LCAxLCA3KSk7XG5cdFx0YXNzZXJ0Q29udGV4dEtleXMoY29udGV4dEtleXMsIHRydWUsIGZhbHNlLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnXHUyMDFDTmVzdGVkXHUyMDFEIHNuaXBwZXRzIHRlcm1pbmF0aW5nIGFicnVwdGx5IGluIFZTQ29kZSAxLjE5LjIuICM0MjAxMicsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGN0cmwgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU25pcHBldENvbnRyb2xsZXIyLCBlZGl0b3IpO1xuXHRcdG1vZGVsLnNldFZhbHVlKCcnKTtcblx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSkpO1xuXHRcdGN0cmwuaW5zZXJ0KCd2YXIgJHsyOiR7MTpuYW1lfX0gPSAkezE6bmFtZX0gKyAxOyR7MH0nKTtcblxuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDUsIDEsIDkpLCBuZXcgU2VsZWN0aW9uKDEsIDEyLCAxLCAxNikpO1xuXHRcdGFzc2VydENvbnRleHRLZXlzKGNvbnRleHRLZXlzLCB0cnVlLCBmYWxzZSwgdHJ1ZSk7XG5cblx0XHRjdHJsLm5leHQoKTtcblx0XHRhc3NlcnRDb250ZXh0S2V5cyhjb250ZXh0S2V5cywgdHJ1ZSwgdHJ1ZSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1BsYWNlaG9sZGVycyBvcmRlciAjNTgyNjcnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRjdHJsID0gaW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNuaXBwZXRDb250cm9sbGVyMiwgZWRpdG9yKTtcblx0XHRtb2RlbC5zZXRWYWx1ZSgnJyk7XG5cdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpKTtcblx0XHRjdHJsLmluc2VydCgnXFxcXHB0aHskMX0kMCcpO1xuXG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgNiwgMSwgNikpO1xuXHRcdGFzc2VydENvbnRleHRLZXlzKGNvbnRleHRLZXlzLCB0cnVlLCBmYWxzZSwgdHJ1ZSk7XG5cblx0XHRjdHJsLmluc2VydCgnXFxcXGl0dnskezE6bGVmdH19eyR7MjpyaWdodH19eyR7MzpsZWZ0X3ZhbHVlfX17JHs0OnJpZ2h0X3ZhbHVlfX0kMCcpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDExLCAxLCAxNSkpO1xuXG5cdFx0Y3RybC5uZXh0KCk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMTcsIDEsIDIyKSk7XG5cblx0XHRjdHJsLm5leHQoKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCAyNCwgMSwgMzQpKTtcblxuXHRcdGN0cmwubmV4dCgpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDM2LCAxLCA0NykpO1xuXG5cdFx0Y3RybC5uZXh0KCk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgNDgsIDEsIDQ4KSk7XG5cblx0XHRjdHJsLm5leHQoKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCA0OSwgMSwgNDkpKTtcblx0XHRhc3NlcnRDb250ZXh0S2V5cyhjb250ZXh0S2V5cywgZmFsc2UsIGZhbHNlLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ011c3QgdGFiIHRocm91Z2ggZGVsZXRlZCB0YWIgc3RvcHMgaW4gc25pcHBldHMgIzMxNjE5JywgZnVuY3Rpb24gKCkge1xuXHRcdGN0cmwgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU25pcHBldENvbnRyb2xsZXIyLCBlZGl0b3IpO1xuXHRcdG1vZGVsLnNldFZhbHVlKCcnKTtcblx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSkpO1xuXHRcdGN0cmwuaW5zZXJ0KCdmb28kezE6YSR7MjpiYXJ9YmF6fWVuZCQwJyk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgNCwgMSwgMTEpKTtcblxuXHRcdGVkaXRvci50cmlnZ2VyKCd0ZXN0JywgSGFuZGxlci5DdXQsIG51bGwpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDQpKTtcblxuXHRcdGN0cmwubmV4dCgpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDEsIDcsIDEsIDcpKTtcblx0XHRhc3NlcnRDb250ZXh0S2V5cyhjb250ZXh0S2V5cywgZmFsc2UsIGZhbHNlLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0NhbmNlbGxpbmcgc25pcHBldCBtb2RlIHNob3VsZCBkaXNjYXJkIGFkZGVkIGN1cnNvcnMgIzY4NTEyIChzb2Z0IGNhbmNlbCknLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y3RybCA9IGluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShTbmlwcGV0Q29udHJvbGxlcjIsIGVkaXRvcik7XG5cdFx0bW9kZWwuc2V0VmFsdWUoJycpO1xuXHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSk7XG5cblx0XHRjdHJsLmluc2VydCgnLlJFR0lPTiAkezI6RlVOQ1RJT05fTkFNRX1cXG5DUkVBVEUuRlVOQ1RJT04gJHsxOlZPSUR9ICR7MjpGVU5DVElPTl9OQU1FfSgkezM6fSlcXG5cXHQkezQ6fVxcbkVORFxcbi5FTkRSRUdJT04kMCcpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDIsIDE3LCAyLCAyMSkpO1xuXG5cdFx0Y3RybC5uZXh0KCk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgOSwgMSwgMjIpLCBuZXcgU2VsZWN0aW9uKDIsIDIyLCAyLCAzNSkpO1xuXHRcdGFzc2VydENvbnRleHRLZXlzKGNvbnRleHRLZXlzLCB0cnVlLCB0cnVlLCB0cnVlKTtcblxuXHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtuZXcgU2VsZWN0aW9uKDEsIDIyLCAxLCAyMiksIG5ldyBTZWxlY3Rpb24oMiwgMzUsIDIsIDM1KV0pO1xuXHRcdGFzc2VydENvbnRleHRLZXlzKGNvbnRleHRLZXlzLCB0cnVlLCB0cnVlLCB0cnVlKTtcblxuXHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtuZXcgU2VsZWN0aW9uKDIsIDEsIDIsIDEpLCBuZXcgU2VsZWN0aW9uKDIsIDM2LCAyLCAzNildKTtcblx0XHRhc3NlcnRDb250ZXh0S2V5cyhjb250ZXh0S2V5cywgZmFsc2UsIGZhbHNlLCBmYWxzZSk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMiwgMSwgMiwgMSksIG5ldyBTZWxlY3Rpb24oMiwgMzYsIDIsIDM2KSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0NhbmNlbGxpbmcgc25pcHBldCBtb2RlIHNob3VsZCBkaXNjYXJkIGFkZGVkIGN1cnNvcnMgIzY4NTEyIChoYXJkIGNhbmNlbCknLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y3RybCA9IGluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShTbmlwcGV0Q29udHJvbGxlcjIsIGVkaXRvcik7XG5cdFx0bW9kZWwuc2V0VmFsdWUoJycpO1xuXHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSk7XG5cblx0XHRjdHJsLmluc2VydCgnLlJFR0lPTiAkezI6RlVOQ1RJT05fTkFNRX1cXG5DUkVBVEUuRlVOQ1RJT04gJHsxOlZPSUR9ICR7MjpGVU5DVElPTl9OQU1FfSgkezM6fSlcXG5cXHQkezQ6fVxcbkVORFxcbi5FTkRSRUdJT04kMCcpO1xuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDIsIDE3LCAyLCAyMSkpO1xuXG5cdFx0Y3RybC5uZXh0KCk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgOSwgMSwgMjIpLCBuZXcgU2VsZWN0aW9uKDIsIDIyLCAyLCAzNSkpO1xuXHRcdGFzc2VydENvbnRleHRLZXlzKGNvbnRleHRLZXlzLCB0cnVlLCB0cnVlLCB0cnVlKTtcblxuXHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtuZXcgU2VsZWN0aW9uKDEsIDIyLCAxLCAyMiksIG5ldyBTZWxlY3Rpb24oMiwgMzUsIDIsIDM1KV0pO1xuXHRcdGFzc2VydENvbnRleHRLZXlzKGNvbnRleHRLZXlzLCB0cnVlLCB0cnVlLCB0cnVlKTtcblxuXHRcdGN0cmwuY2FuY2VsKHRydWUpO1xuXHRcdGFzc2VydENvbnRleHRLZXlzKGNvbnRleHRLZXlzLCBmYWxzZSwgZmFsc2UsIGZhbHNlKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCAyMiwgMSwgMjIpKTtcblx0fSk7XG5cblx0dGVzdCgnVXNlciBkZWZpbmVkIHNuaXBwZXQgdGFiIHN0b3BzIGlnbm9yZWQgIzcyODYyJywgZnVuY3Rpb24gKCkge1xuXHRcdGN0cmwgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU25pcHBldENvbnRyb2xsZXIyLCBlZGl0b3IpO1xuXHRcdG1vZGVsLnNldFZhbHVlKCcnKTtcblx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSkpO1xuXG5cdFx0Y3RybC5pbnNlcnQoJ2V4cG9ydCBkZWZhdWx0ICQxJyk7XG5cdFx0YXNzZXJ0Q29udGV4dEtleXMoY29udGV4dEtleXMsIHRydWUsIGZhbHNlLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnT3B0aW9uYWwgdGFic3RvcCBpbiBzbmlwcGV0cyAjNzIzNTgnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y3RybCA9IGluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShTbmlwcGV0Q29udHJvbGxlcjIsIGVkaXRvcik7XG5cdFx0bW9kZWwuc2V0VmFsdWUoJycpO1xuXHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSk7XG5cblx0XHRjdHJsLmluc2VydCgnJHsxOnByb3A6IHskMlxcXFx9LH1cXG5tb3JlJDAnKTtcblx0XHRhc3NlcnRDb250ZXh0S2V5cyhjb250ZXh0S2V5cywgdHJ1ZSwgZmFsc2UsIHRydWUpO1xuXG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMTApKTtcblx0XHRlZGl0b3IudHJpZ2dlcigndGVzdCcsIEhhbmRsZXIuQ3V0LCB7fSk7XG5cblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSk7XG5cblx0XHRjdHJsLm5leHQoKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigyLCA1LCAyLCA1KSk7XG5cdFx0YXNzZXJ0Q29udGV4dEtleXMoY29udGV4dEtleXMsIGZhbHNlLCBmYWxzZSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjOTAxMzU6IGNvbmZ1c2luZyB0cmltIHdoaXRlc3BhY2UgZWRpdHMnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y3RybCA9IGluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShTbmlwcGV0Q29udHJvbGxlcjIsIGVkaXRvcik7XG5cdFx0bW9kZWwuc2V0VmFsdWUoJycpO1xuXHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuVGFiLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblxuXHRcdGN0cmwuaW5zZXJ0KCdcXG5mb28nKTtcblx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigyLCA4LCAyLCA4KSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxNDU3Mjc6IGluc2VydFNuaXBwZXQgY2FuIHB1dCBzbmlwcGV0IHNlbGVjdGlvbnMgaW4gd3JvbmcgcG9zaXRpb25zICgxIG9mIDIpJywgZnVuY3Rpb24gKCkge1xuXHRcdGN0cmwgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU25pcHBldENvbnRyb2xsZXIyLCBlZGl0b3IpO1xuXHRcdG1vZGVsLnNldFZhbHVlKCcnKTtcblx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlRhYi5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cblx0XHRjdHJsLmluc2VydCgnXFxuYVByb3BlcnR5OiBhQ2xhc3M8JHsyOmJvb2xlYW59PiA9IG5ldyBhQ2xhc3M8JHsyOmJvb2xlYW59PigpO1xcbicsIHsgYWRqdXN0V2hpdGVzcGFjZTogZmFsc2UgfSk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMiwgMTksIDIsIDI2KSwgbmV3IFNlbGVjdGlvbigyLCA0MSwgMiwgNDgpKTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzE0NTcyNzogaW5zZXJ0U25pcHBldCBjYW4gcHV0IHNuaXBwZXQgc2VsZWN0aW9ucyBpbiB3cm9uZyBwb3NpdGlvbnMgKDIgb2YgMiknLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y3RybCA9IGluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShTbmlwcGV0Q29udHJvbGxlcjIsIGVkaXRvcik7XG5cdFx0bW9kZWwuc2V0VmFsdWUoJycpO1xuXHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuVGFiLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblxuXHRcdGN0cmwuaW5zZXJ0KCdcXG5hUHJvcGVydHk6IGFDbGFzczwkezI6Ym9vbGVhbn0+ID0gbmV3IGFDbGFzczwkezI6Ym9vbGVhbn0+KCk7XFxuJyk7XG5cdFx0Ly8gVGhpcyB3aWxsIGluc2VydCBcXG4gICAgYVByb3BlcnR5Li4uLlxuXHRcdGFzc2VydFNlbGVjdGlvbnMoZWRpdG9yLCBuZXcgU2VsZWN0aW9uKDIsIDIzLCAyLCAzMCksIG5ldyBTZWxlY3Rpb24oMiwgNDUsIDIsIDUyKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2xlYWRpbmcgVEFCIGJ5IHNuaXBwZXRzIHdvblxcJ3QgcmVwbGFjZSBieSBzcGFjZXMgIzEwMTg3MCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjdHJsID0gaW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNuaXBwZXRDb250cm9sbGVyMiwgZWRpdG9yKTtcblx0XHRtb2RlbC5zZXRWYWx1ZSgnJyk7XG5cdFx0bW9kZWwudXBkYXRlT3B0aW9ucyh7IGluc2VydFNwYWNlczogdHJ1ZSwgdGFiU2l6ZTogNCB9KTtcblx0XHRjdHJsLmluc2VydCgnXFx0SGVsbG8gV29ybGRcXG5cXHROZXcgTGluZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnICAgIEhlbGxvIFdvcmxkXFxuICAgIE5ldyBMaW5lJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2xlYWRpbmcgVEFCIGJ5IHNuaXBwZXRzIHdvblxcJ3QgcmVwbGFjZSBieSBzcGFjZXMgIzEwMTg3MCAocGFydCAyKScsIGZ1bmN0aW9uICgpIHtcblx0XHRjdHJsID0gaW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNuaXBwZXRDb250cm9sbGVyMiwgZWRpdG9yKTtcblx0XHRtb2RlbC5zZXRWYWx1ZSgnJyk7XG5cdFx0bW9kZWwudXBkYXRlT3B0aW9ucyh7IGluc2VydFNwYWNlczogdHJ1ZSwgdGFiU2l6ZTogNCB9KTtcblx0XHRjdHJsLmluc2VydCgnXFx0SGVsbG8gV29ybGRcXG5cXHROZXcgTGluZVxcbiR7MTpcXHRtb3JlfScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnICAgIEhlbGxvIFdvcmxkXFxuICAgIE5ldyBMaW5lXFxuICAgIG1vcmUnKTtcblx0fSk7XG5cblx0dGVzdC5za2lwKCdTbmlwcGV0IHRyYW5zZm9ybWF0aW9uIGRvZXMgbm90IHdvcmsgYWZ0ZXIgaW5zZXJ0aW5nIHZhcmlhYmxlIHVzaW5nIGludGVsbGlzZW5zZSwgIzExMjM2MicsIGZ1bmN0aW9uICgpIHtcblxuXHRcdHtcblx0XHRcdC8vIEhBUFBZIC0gbm8gbmVzdGVkIHNuaXBwZXRcblx0XHRcdGN0cmwgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU25pcHBldENvbnRyb2xsZXIyLCBlZGl0b3IpO1xuXHRcdFx0bW9kZWwuc2V0VmFsdWUoJycpO1xuXHRcdFx0bW9kZWwudXBkYXRlT3B0aW9ucyh7IGluc2VydFNwYWNlczogdHJ1ZSwgdGFiU2l6ZTogNCB9KTtcblx0XHRcdGN0cmwuaW5zZXJ0KCckMVxcblxcbiR7MS8oW0EtWmEtejAtOV0rKTogKFtBLVphLXpdKykuKi8kMTogXFwnJDJcXCcsL2dtfScpO1xuXG5cdFx0XHRhc3NlcnRTZWxlY3Rpb25zKGVkaXRvciwgbmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSwgbmV3IFNlbGVjdGlvbigzLCAxLCAzLCAxKSk7XG5cdFx0XHRlZGl0b3IudHJpZ2dlcigndGVzdCcsICd0eXBlJywgeyB0ZXh0OiAnZm9vOiBudW1iZXI7JyB9KTtcblx0XHRcdGN0cmwubmV4dCgpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksIGBmb286IG51bWJlcjtcXG5cXG5mb286ICdudW1iZXInLGApO1xuXHRcdH1cblxuXHRcdGN0cmwgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU25pcHBldENvbnRyb2xsZXIyLCBlZGl0b3IpO1xuXHRcdG1vZGVsLnNldFZhbHVlKCcnKTtcblx0XHRtb2RlbC51cGRhdGVPcHRpb25zKHsgaW5zZXJ0U3BhY2VzOiB0cnVlLCB0YWJTaXplOiA0IH0pO1xuXHRcdGN0cmwuaW5zZXJ0KCckMVxcblxcbiR7MS8oW0EtWmEtejAtOV0rKTogKFtBLVphLXpdKykuKi8kMTogXFwnJDJcXCcsL2dtfScpO1xuXG5cdFx0YXNzZXJ0U2VsZWN0aW9ucyhlZGl0b3IsIG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSksIG5ldyBTZWxlY3Rpb24oMywgMSwgMywgMSkpO1xuXHRcdGVkaXRvci50cmlnZ2VyKCd0ZXN0JywgJ3R5cGUnLCB7IHRleHQ6ICdmb286ICcgfSk7XG5cdFx0Y3RybC5pbnNlcnQoJ251bWJlcjsnKTtcblx0XHRjdHJsLm5leHQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgYGZvbzogbnVtYmVyO1xcblxcbmZvbzogJ251bWJlcicsYCk7XG5cdFx0Ly8gZWRpdG9yLnRyaWdnZXIoJ3Rlc3QnLCAndHlwZScsIHsgdGV4dDogJzsnIH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgnY3JlYXRlRWRpdHNBbmRTbmlwcGV0c0Zyb21FZGl0cycsIGZ1bmN0aW9uICgpIHtcblxuXHRcdHRlc3QoJ2FwcGx5LCB0YWIsIGRvbmUnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRcdGN0cmwgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU25pcHBldENvbnRyb2xsZXIyLCBlZGl0b3IpO1xuXG5cdFx0XHRtb2RlbC5zZXRWYWx1ZSgnZm9vKFwiYmFyXCIpJyk7XG5cblx0XHRcdGN0cmwuYXBwbHkoW1xuXHRcdFx0XHR7IHJhbmdlOiBuZXcgUmFuZ2UoMSwgNSwgMSwgMTApLCB0ZW1wbGF0ZTogJyQxJyB9LFxuXHRcdFx0XHR7IHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgMSwgMSksIHRlbXBsYXRlOiAnY29uc3QgJHsxOm5ld19jb25zdH0gPSBcImJhclwiO1xcbicgfVxuXHRcdFx0XSk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCBcImNvbnN0IG5ld19jb25zdCA9IFxcXCJiYXJcXFwiO1xcbmZvbyhuZXdfY29uc3QpXCIpO1xuXHRcdFx0YXNzZXJ0Q29udGV4dEtleXMoY29udGV4dEtleXMsIHRydWUsIGZhbHNlLCB0cnVlKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSwgW25ldyBTZWxlY3Rpb24oMSwgNywgMSwgMTYpLCBuZXcgU2VsZWN0aW9uKDIsIDUsIDIsIDE0KV0pO1xuXG5cdFx0XHRjdHJsLm5leHQoKTtcblx0XHRcdGFzc2VydENvbnRleHRLZXlzKGNvbnRleHRLZXlzLCBmYWxzZSwgZmFsc2UsIGZhbHNlKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSwgW25ldyBTZWxlY3Rpb24oMiwgMTQsIDIsIDE0KV0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnYXBwbHksIHRhYiwgZG9uZSB3aXRoIHNwZWNpYWwgZmluYWwgdGFic3RvcCcsIGZ1bmN0aW9uICgpIHtcblxuXHRcdFx0bW9kZWwuc2V0VmFsdWUoJ2ZvbyhcImJhclwiKScpO1xuXG5cdFx0XHRjdHJsID0gaW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNuaXBwZXRDb250cm9sbGVyMiwgZWRpdG9yKTtcblx0XHRcdGN0cmwuYXBwbHkoW1xuXHRcdFx0XHR7IHJhbmdlOiBuZXcgUmFuZ2UoMSwgNSwgMSwgMTApLCB0ZW1wbGF0ZTogJyQxJyB9LFxuXHRcdFx0XHR7IHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgMSwgMSksIHRlbXBsYXRlOiAnY29uc3QgJHsxOm5ld19jb25zdH0kMCA9IFwiYmFyXCI7XFxuJyB9XG5cdFx0XHRdKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksIFwiY29uc3QgbmV3X2NvbnN0ID0gXFxcImJhclxcXCI7XFxuZm9vKG5ld19jb25zdClcIik7XG5cdFx0XHRhc3NlcnRDb250ZXh0S2V5cyhjb250ZXh0S2V5cywgdHJ1ZSwgZmFsc2UsIHRydWUpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9ucygpLCBbbmV3IFNlbGVjdGlvbigxLCA3LCAxLCAxNiksIG5ldyBTZWxlY3Rpb24oMiwgNSwgMiwgMTQpXSk7XG5cblx0XHRcdGN0cmwubmV4dCgpO1xuXHRcdFx0YXNzZXJ0Q29udGV4dEtleXMoY29udGV4dEtleXMsIGZhbHNlLCBmYWxzZSwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9ucygpLCBbbmV3IFNlbGVjdGlvbigxLCAxNiwgMSwgMTYpXSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdhcHBseSwgdGFiLCB0YWIsIGRvbmUnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRcdG1vZGVsLnNldFZhbHVlKCdmb29cXG5iYXInKTtcblxuXHRcdFx0Y3RybCA9IGluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShTbmlwcGV0Q29udHJvbGxlcjIsIGVkaXRvcik7XG5cdFx0XHRjdHJsLmFwcGx5KFtcblx0XHRcdFx0eyByYW5nZTogbmV3IFJhbmdlKDEsIDQsIDEsIDQpLCB0ZW1wbGF0ZTogJyR7M30nIH0sXG5cdFx0XHRcdHsgcmFuZ2U6IG5ldyBSYW5nZSgyLCA0LCAyLCA0KSwgdGVtcGxhdGU6ICckMycgfSxcblx0XHRcdFx0eyByYW5nZTogbmV3IFJhbmdlKDEsIDEsIDEsIDEpLCB0ZW1wbGF0ZTogJyMjIyAkezI6SGVhZGVyfVxcbicgfVxuXHRcdFx0XSk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCBcIiMjIyBIZWFkZXJcXG5mb29cXG5iYXJcIik7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldENvbnRleHRTdGF0ZSgpLCB7IGluU25pcHBldDogdHJ1ZSwgaGFzUHJldjogZmFsc2UsIGhhc05leHQ6IHRydWUgfSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCksIFtuZXcgU2VsZWN0aW9uKDEsIDUsIDEsIDExKV0pO1xuXG5cdFx0XHRjdHJsLm5leHQoKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2V0Q29udGV4dFN0YXRlKCksIHsgaW5TbmlwcGV0OiB0cnVlLCBoYXNQcmV2OiB0cnVlLCBoYXNOZXh0OiB0cnVlIH0pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9ucygpLCBbbmV3IFNlbGVjdGlvbigyLCA0LCAyLCA0KSwgbmV3IFNlbGVjdGlvbigzLCA0LCAzLCA0KV0pO1xuXG5cdFx0XHRjdHJsLm5leHQoKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2V0Q29udGV4dFN0YXRlKCksIHsgaW5TbmlwcGV0OiBmYWxzZSwgaGFzUHJldjogZmFsc2UsIGhhc05leHQ6IGZhbHNlIH0pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9ucygpLCBbbmV3IFNlbGVjdGlvbigzLCA0LCAzLCA0KV0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnbmVzdGVkIGludG8gYXBwbHkgd29ya3MnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRcdGN0cmwgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU25pcHBldENvbnRyb2xsZXIyLCBlZGl0b3IpO1xuXHRcdFx0bW9kZWwuc2V0VmFsdWUoJ29uZXR3bycpO1xuXG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9ucyhbbmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSwgbmV3IFNlbGVjdGlvbigyLCAxLCAyLCAxKV0pO1xuXG5cdFx0XHRjdHJsLmFwcGx5KFt7XG5cdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UoMSwgNywgMSwgNyksXG5cdFx0XHRcdHRlbXBsYXRlOiAnJDAkezE6dGhyZWV9J1xuXHRcdFx0fV0pO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ29uZXR3b3RocmVlJyk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldENvbnRleHRTdGF0ZSgpLCB7IGluU25pcHBldDogdHJ1ZSwgaGFzUHJldjogZmFsc2UsIGhhc05leHQ6IHRydWUgfSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCksIFtuZXcgU2VsZWN0aW9uKDEsIDcsIDEsIDEyKV0pO1xuXG5cdFx0XHRjdHJsLmluc2VydCgnZm9vJDFiYXIkMScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICdvbmV0d29mb29iYXInKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSwgW25ldyBTZWxlY3Rpb24oMSwgMTAsIDEsIDEwKSwgbmV3IFNlbGVjdGlvbigxLCAxMywgMSwgMTMpXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldENvbnRleHRTdGF0ZSgpLCAoeyBpblNuaXBwZXQ6IHRydWUsIGhhc1ByZXY6IGZhbHNlLCBoYXNOZXh0OiB0cnVlIH0pKTtcblxuXHRcdFx0Y3RybC5uZXh0KCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldENvbnRleHRTdGF0ZSgpLCAoeyBpblNuaXBwZXQ6IHRydWUsIGhhc1ByZXY6IHRydWUsIGhhc05leHQ6IHRydWUgfSkpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9ucygpLCBbbmV3IFNlbGVjdGlvbigxLCAxMywgMSwgMTMpXSk7XG5cblx0XHRcdGN0cmwubmV4dCgpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRDb250ZXh0U3RhdGUoKSwgeyBpblNuaXBwZXQ6IGZhbHNlLCBoYXNQcmV2OiBmYWxzZSwgaGFzTmV4dDogZmFsc2UgfSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCksIFtuZXcgU2VsZWN0aW9uKDEsIDcsIDEsIDcpXSk7XG5cblx0XHR9KTtcblxuXHRcdHRlc3QoJ25lc3RlZCBpbnRvIGluc2VydCBhYm9ydCBcIm91dGVyXCIgc25pcHBldCcsIGZ1bmN0aW9uICgpIHtcblxuXHRcdFx0Y3RybCA9IGluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShTbmlwcGV0Q29udHJvbGxlcjIsIGVkaXRvcik7XG5cdFx0XHRtb2RlbC5zZXRWYWx1ZSgnb25lXFxudHdvJyk7XG5cblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpLCBuZXcgU2VsZWN0aW9uKDIsIDEsIDIsIDEpXSk7XG5cblx0XHRcdGN0cmwuaW5zZXJ0KCdmb28kezE6YmFyfWJhenokezE6YmFuZ30nKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSwgW25ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNyksIG5ldyBTZWxlY3Rpb24oMSwgMTEsIDEsIDE0KSwgbmV3IFNlbGVjdGlvbigyLCA0LCAyLCA3KSwgbmV3IFNlbGVjdGlvbigyLCAxMSwgMiwgMTQpXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldENvbnRleHRTdGF0ZSgpLCB7IGluU25pcHBldDogdHJ1ZSwgaGFzUHJldjogZmFsc2UsIGhhc05leHQ6IHRydWUgfSk7XG5cblx0XHRcdGN0cmwuYXBwbHkoW3tcblx0XHRcdFx0cmFuZ2U6IG5ldyBSYW5nZSgxLCA0LCAxLCA3KSxcblx0XHRcdFx0dGVtcGxhdGU6ICckMEEnXG5cdFx0XHR9XSk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnZm9vQWJhenpiYXJvbmVcXG5mb29iYXJiYXp6YmFydHdvJyk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldENvbnRleHRTdGF0ZSgpLCB7IGluU25pcHBldDogZmFsc2UsIGhhc1ByZXY6IGZhbHNlLCBoYXNOZXh0OiBmYWxzZSB9KTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSwgW25ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNCldKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ25lc3RlZCBpbnRvIFwiaW5zZXJ0XCIgYWJvcnQgXCJvdXRlclwiIHNuaXBwZXQgKDIpJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0XHRjdHJsID0gaW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNuaXBwZXRDb250cm9sbGVyMiwgZWRpdG9yKTtcblx0XHRcdG1vZGVsLnNldFZhbHVlKCdvbmVcXG50d28nKTtcblxuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoW25ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSksIG5ldyBTZWxlY3Rpb24oMiwgMSwgMiwgMSldKTtcblxuXHRcdFx0Y3RybC5pbnNlcnQoJ2ZvbyR7MTpiYXJ9YmF6eiR7MTpiYW5nfScpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9ucygpLCBbbmV3IFNlbGVjdGlvbigxLCA0LCAxLCA3KSwgbmV3IFNlbGVjdGlvbigxLCAxMSwgMSwgMTQpLCBuZXcgU2VsZWN0aW9uKDIsIDQsIDIsIDcpLCBuZXcgU2VsZWN0aW9uKDIsIDExLCAyLCAxNCldKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2V0Q29udGV4dFN0YXRlKCksIHsgaW5TbmlwcGV0OiB0cnVlLCBoYXNQcmV2OiBmYWxzZSwgaGFzTmV4dDogdHJ1ZSB9KTtcblxuXHRcdFx0Y29uc3QgZWRpdHMgPSBbe1xuXHRcdFx0XHRyYW5nZTogbmV3IFJhbmdlKDEsIDQsIDEsIDcpLFxuXHRcdFx0XHR0ZW1wbGF0ZTogJ0EnXG5cdFx0XHR9LCB7XG5cdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UoMSwgMTEsIDEsIDE0KSxcblx0XHRcdFx0dGVtcGxhdGU6ICdCJ1xuXHRcdFx0fSwge1xuXHRcdFx0XHRyYW5nZTogbmV3IFJhbmdlKDIsIDQsIDIsIDcpLFxuXHRcdFx0XHR0ZW1wbGF0ZTogJ0MnXG5cdFx0XHR9LCB7XG5cdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UoMiwgMTEsIDIsIDE0KSxcblx0XHRcdFx0dGVtcGxhdGU6ICdEJ1xuXHRcdFx0fV07XG5cdFx0XHRjdHJsLmFwcGx5KGVkaXRzKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksIFwiZm9vQWJhenpCb25lXFxuZm9vQ2JhenpEdHdvXCIpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRDb250ZXh0U3RhdGUoKSwgeyBpblNuaXBwZXQ6IGZhbHNlLCBoYXNQcmV2OiBmYWxzZSwgaGFzTmV4dDogZmFsc2UgfSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCksIFtuZXcgU2VsZWN0aW9uKDEsIDUsIDEsIDUpLCBuZXcgU2VsZWN0aW9uKDEsIDEwLCAxLCAxMCksIG5ldyBTZWxlY3Rpb24oMiwgNSwgMiwgNSksIG5ldyBTZWxlY3Rpb24oMiwgMTAsIDIsIDEwKV0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdCdWc6IGN1cnNvciBwb3NpdGlvbiAkMCB3aXRoIHVzZXIgc25pcHBldHMgIzE2MzgwOCcsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGN0cmwgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU25pcHBldENvbnRyb2xsZXIyLCBlZGl0b3IpO1xuXHRcdG1vZGVsLnNldFZhbHVlKCcnKTtcblxuXHRcdGN0cmwuaW5zZXJ0KCc8RWxlbWVudDEgQXR0cjE9XCJmb29cIiAkMT5cXG4gIDxFbGVtZW50MiBBdHRyMT1cIiQyXCIvPlxcbiQwXCJcXG48L0VsZW1lbnQxPicpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSwgW25ldyBTZWxlY3Rpb24oMSwgMjMsIDEsIDIzKV0pO1xuXG5cdFx0Y3RybC5pbnNlcnQoJ1F1YWxpZmllcj1cIiQwXCInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJzxFbGVtZW50MSBBdHRyMT1cImZvb1wiIFF1YWxpZmllcj1cIlwiPlxcbiAgPEVsZW1lbnQyIEF0dHIxPVwiXCIvPlxcblwiXFxuPC9FbGVtZW50MT4nKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCksIFtuZXcgU2VsZWN0aW9uKDEsIDM0LCAxLCAzNCldKTtcblxuXHR9KTtcblxuXHR0ZXN0KCdFT0wtU2VxdWVuY2UgKENSTEYpIHNoaWZ0cyB0YWIgc3RvcCBpbiBpc0ZpbGVUZW1wbGF0ZSBzbmlwcGV0cyAjMTY3Mzg2JywgZnVuY3Rpb24gKCkge1xuXHRcdGN0cmwgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU25pcHBldENvbnRyb2xsZXIyLCBlZGl0b3IpO1xuXHRcdG1vZGVsLnNldFZhbHVlKCcnKTtcblx0XHRtb2RlbC5zZXRFT0woRW5kT2ZMaW5lU2VxdWVuY2UuQ1JMRik7XG5cblx0XHRjdHJsLmFwcGx5KFt7XG5cdFx0XHRyYW5nZTogbW9kZWwuZ2V0RnVsbE1vZGVsUmFuZ2UoKSxcblx0XHRcdHRlbXBsYXRlOiAnbGluZSA1NDMyMSR7MTpGT099XFxubGluZSA1NDMyMSR7MTpGT099XFxuKG5vIHRhYiBzdG9wKVxcbmxpbmUgNTQzMjEkezE6Rk9PfVxcbmxpbmUgNTQzMjEnXG5cdFx0fV0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9ucygpLCBbbmV3IFNlbGVjdGlvbigxLCAxMSwgMSwgMTQpLCBuZXcgU2VsZWN0aW9uKDIsIDExLCAyLCAxNCksIG5ldyBTZWxlY3Rpb24oNCwgMTEsIDQsIDE0KV0pO1xuXG5cdH0pO1xuXG5cdHRlc3QoJ1wiU3Vycm91bmQgV2l0aFwiIGNvZGUgYWN0aW9uIHNuaXBwZXRzIHVzZSBpbmNvcnJlY3QgaW5kZW50YXRpb24gbGV2ZWxzIGFuZCBzdHlsZXMgIzE2OTMxOScsIGZ1bmN0aW9uICgpIHtcblx0XHRtb2RlbC5zZXRWYWx1ZSgnZnVuY3Rpb24gZm9vKGYsIHgsIGNvbmRpdGlvbikge1xcbiAgICBmKCk7XFxuICAgIHJldHVybiB4O1xcbn0nKTtcblx0XHRjb25zdCBzZWwgPSBuZXcgUmFuZ2UoMiwgNSwgMywgMTQpO1xuXHRcdGVkaXRvci5zZXRTZWxlY3Rpb24oc2VsKTtcblx0XHRjdHJsID0gaW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNuaXBwZXRDb250cm9sbGVyMiwgZWRpdG9yKTtcblx0XHRjdHJsLmFwcGx5KFt7XG5cdFx0XHRyYW5nZTogc2VsLFxuXHRcdFx0dGVtcGxhdGU6ICdpZiAoJHsxOmNvbmRpdGlvbn0pIHtcXG5cXHQkVE1fU0VMRUNURURfVEVYVCQwXFxufSdcblx0XHR9XSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgYGZ1bmN0aW9uIGZvbyhmLCB4LCBjb25kaXRpb24pIHtcXG4gICAgaWYgKGNvbmRpdGlvbikge1xcbiAgICAgICAgZigpO1xcbiAgICAgICAgcmV0dXJuIHg7XFxuICAgIH1cXG59YCk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFJQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsMkJBQTJCO0FBRXBDLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsYUFBYTtBQUN0QixTQUFTLGVBQWU7QUFFeEIsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUywwQkFBMEI7QUFFbkMsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxhQUFhLHNCQUFzQjtBQUM1QyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLCtDQUErQztBQUV4RCxNQUFNLHNCQUFzQixXQUFZO0FBR3ZDLFdBQVMsaUJBQWlCQSxZQUF3QixHQUFnQjtBQUNqRSxlQUFXLGFBQWFBLFFBQU8sY0FBYyxHQUFJO0FBQ2hELFlBQU0sU0FBUyxFQUFFLE1BQU07QUFDdkIsYUFBTyxHQUFHLFVBQVUsZ0JBQWdCLE1BQU0sR0FBRyxVQUFVLFVBQVUsU0FBUyxDQUFDLGdCQUFnQixPQUFPLFNBQVMsQ0FBQyxFQUFFO0FBQUEsSUFDL0c7QUFDQSxXQUFPLFlBQVksRUFBRSxRQUFRLENBQUM7QUFBQSxFQUMvQjtBQUVBLFdBQVMsa0JBQWtCLFNBQWdDLFdBQW9CLFNBQWtCLFNBQXdCO0FBQ3hILFVBQU0sUUFBUSxnQkFBZ0IsT0FBTztB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
