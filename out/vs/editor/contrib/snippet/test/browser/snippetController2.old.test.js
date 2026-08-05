var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import assert from "assert";
import { mock } from "../../../../../base/test/common/mock.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { Position } from "../../../../common/core/position.js";
import { Selection } from "../../../../common/core/selection.js";
import { LanguageFeaturesService } from "../../../../common/services/languageFeaturesService.js";
import { SnippetController2 } from "../../browser/snippetController2.js";
import { withTestCodeEditor } from "../../../../test/browser/testCodeEditor.js";
import { TestLanguageConfigurationService } from "../../../../test/common/modes/testLanguageConfigurationService.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { NullLogService } from "../../../../../platform/log/common/log.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
let TestSnippetController = class extends SnippetController2 {
  constructor(editor, _contextKeyService) {
    const testLanguageConfigurationService = new TestLanguageConfigurationService();
    super(editor, new NullLogService(), new LanguageFeaturesService(), _contextKeyService, testLanguageConfigurationService);
    this._contextKeyService = _contextKeyService;
    this._testLanguageConfigurationService = testLanguageConfigurationService;
  }
  dispose() {
    super.dispose();
    this._testLanguageConfigurationService.dispose();
  }
  isInSnippetMode() {
    return SnippetController2.InSnippetMode.getValue(this._contextKeyService);
  }
};
TestSnippetController = __decorateClass([
  __decorateParam(1, IContextKeyService)
], TestSnippetController);
suite("SnippetController", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  function snippetTest(cb, lines) {
    if (!lines) {
      lines = [
        "function test() {",
        "	var x = 3;",
        "	var arr = [];",
        "	",
        "}"
      ];
    }
    const serviceCollection = new ServiceCollection(
      [ILabelService, new class extends mock() {
      }()],
      [IWorkspaceContextService, new class extends mock() {
      }()]
    );
    withTestCodeEditor(lines, { serviceCollection }, (editor) => {
      editor.getModel().updateOptions({
        insertSpaces: false
      });
      const snippetController = editor.registerAndInstantiateContribution(TestSnippetController.ID, TestSnippetController);
      const template = [
        "for (var ${1:index}; $1 < ${2:array}.length; $1++) {",
        "	var element = $2[$1];",
        "	$0",
        "}"
      ].join("\n");
      cb(editor, template, snippetController);
      snippetController.dispose();
    });
  }
  test("Simple accepted", () => {
    snippetTest((editor, template, snippetController) => {
      editor.setPosition({ lineNumber: 4, column: 2 });
      snippetController.insert(template);
      assert.strictEqual(editor.getModel().getLineContent(4), "	for (var index; index < array.length; index++) {");
      assert.strictEqual(editor.getModel().getLineContent(5), "		var element = array[index];");
      assert.strictEqual(editor.getModel().getLineContent(6), "		");
      assert.strictEqual(editor.getModel().getLineContent(7), "	}");
      editor.trigger("test", "type", { text: "i" });
      assert.strictEqual(editor.getModel().getLineContent(4), "	for (var i; i < array.length; i++) {");
      assert.strictEqual(editor.getModel().getLineContent(5), "		var element = array[i];");
      assert.strictEqual(editor.getModel().getLineContent(6), "		");
      assert.strictEqual(editor.getModel().getLineContent(7), "	}");
      snippetController.next();
      editor.trigger("test", "type", { text: "arr" });
      assert.strictEqual(editor.getModel().getLineContent(4), "	for (var i; i < arr.length; i++) {");
      assert.strictEqual(editor.getModel().getLineContent(5), "		var element = arr[i];");
      assert.strictEqual(editor.getModel().getLineContent(6), "		");
      assert.strictEqual(editor.getModel().getLineContent(7), "	}");
      snippetController.prev();
      editor.trigger("test", "type", { text: "j" });
      assert.strictEqual(editor.getModel().getLineContent(4), "	for (var j; j < arr.length; j++) {");
      assert.strictEqual(editor.getModel().getLineContent(5), "		var element = arr[j];");
      assert.strictEqual(editor.getModel().getLineContent(6), "		");
      assert.strictEqual(editor.getModel().getLineContent(7), "	}");
      snippetController.next();
      snippetController.next();
      assert.deepStrictEqual(editor.getPosition(), new Position(6, 3));
    });
  });
  test("Simple canceled", () => {
    snippetTest((editor, template, snippetController) => {
      editor.setPosition({ lineNumber: 4, column: 2 });
      snippetController.insert(template);
      assert.strictEqual(editor.getModel().getLineContent(4), "	for (var index; index < array.length; index++) {");
      assert.strictEqual(editor.getModel().getLineContent(5), "		var element = array[index];");
      assert.strictEqual(editor.getModel().getLineContent(6), "		");
      assert.strictEqual(editor.getModel().getLineContent(7), "	}");
      snippetController.cancel();
      assert.deepStrictEqual(editor.getPosition(), new Position(4, 16));
    });
  });
  test("Stops when calling model.setValue()", () => {
    snippetTest((editor, codeSnippet, snippetController) => {
      editor.setPosition({ lineNumber: 4, column: 2 });
      snippetController.insert(codeSnippet);
      editor.getModel().setValue("goodbye");
      assert.strictEqual(snippetController.isInSnippetMode(), false);
    });
  });
  test("Stops when undoing", () => {
    snippetTest((editor, codeSnippet, snippetController) => {
      editor.setPosition({ lineNumber: 4, column: 2 });
      snippetController.insert(codeSnippet);
      editor.getModel().undo();
      assert.strictEqual(snippetController.isInSnippetMode(), false);
    });
  });
  test("Stops when moving cursor outside", () => {
    snippetTest((editor, codeSnippet, snippetController) => {
      editor.setPosition({ lineNumber: 4, column: 2 });
      snippetController.insert(codeSnippet);
      editor.setPosition({ lineNumber: 1, column: 1 });
      assert.strictEqual(snippetController.isInSnippetMode(), false);
    });
  });
  test("Stops when disconnecting editor model", () => {
    snippetTest((editor, codeSnippet, snippetController) => {
      editor.setPosition({ lineNumber: 4, column: 2 });
      snippetController.insert(codeSnippet);
      editor.setModel(null);
      assert.strictEqual(snippetController.isInSnippetMode(), false);
    });
  });
  test("Stops when disposing editor", () => {
    snippetTest((editor, codeSnippet, snippetController) => {
      editor.setPosition({ lineNumber: 4, column: 2 });
      snippetController.insert(codeSnippet);
      snippetController.dispose();
      assert.strictEqual(snippetController.isInSnippetMode(), false);
    });
  });
  test("Final tabstop with multiple selections", () => {
    snippetTest((editor, codeSnippet, snippetController) => {
      editor.setSelections([
        new Selection(1, 1, 1, 1),
        new Selection(2, 1, 2, 1)
      ]);
      codeSnippet = "foo$0";
      snippetController.insert(codeSnippet);
      assert.strictEqual(editor.getSelections().length, 2);
      const [first, second] = editor.getSelections();
      assert.ok(first.equalsRange({ startLineNumber: 1, startColumn: 4, endLineNumber: 1, endColumn: 4 }), first.toString());
      assert.ok(second.equalsRange({ startLineNumber: 2, startColumn: 4, endLineNumber: 2, endColumn: 4 }), second.toString());
    });
    snippetTest((editor, codeSnippet, snippetController) => {
      editor.setSelections([
        new Selection(1, 1, 1, 1),
        new Selection(2, 1, 2, 1)
      ]);
      codeSnippet = "foo$0bar";
      snippetController.insert(codeSnippet);
      assert.strictEqual(editor.getSelections().length, 2);
      const [first, second] = editor.getSelections();
      assert.ok(first.equalsRange({ startLineNumber: 1, startColumn: 4, endLineNumber: 1, endColumn: 4 }), first.toString());
      assert.ok(second.equalsRange({ startLineNumber: 2, startColumn: 4, endLineNumber: 2, endColumn: 4 }), second.toString());
    });
    snippetTest((editor, codeSnippet, snippetController) => {
      editor.setSelections([
        new Selection(1, 1, 1, 1),
        new Selection(1, 5, 1, 5)
      ]);
      codeSnippet = "foo$0bar";
      snippetController.insert(codeSnippet);
      assert.strictEqual(editor.getSelections().length, 2);
      const [first, second] = editor.getSelections();
      assert.ok(first.equalsRange({ startLineNumber: 1, startColumn: 4, endLineNumber: 1, endColumn: 4 }), first.toString());
      assert.ok(second.equalsRange({ startLineNumber: 1, startColumn: 14, endLineNumber: 1, endColumn: 14 }), second.toString());
    });
    snippetTest((editor, codeSnippet, snippetController) => {
      editor.setSelections([
        new Selection(1, 1, 1, 1),
        new Selection(1, 5, 1, 5)
      ]);
      codeSnippet = "foo\n$0\nbar";
      snippetController.insert(codeSnippet);
      assert.strictEqual(editor.getSelections().length, 2);
      const [first, second] = editor.getSelections();
      assert.ok(first.equalsRange({ startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: 1 }), first.toString());
      assert.ok(second.equalsRange({ startLineNumber: 4, startColumn: 1, endLineNumber: 4, endColumn: 1 }), second.toString());
    });
    snippetTest((editor, codeSnippet, snippetController) => {
      editor.setSelections([
        new Selection(1, 1, 1, 1),
        new Selection(1, 5, 1, 5)
      ]);
      codeSnippet = "foo\n$0\nbar";
      snippetController.insert(codeSnippet);
      assert.strictEqual(editor.getSelections().length, 2);
      const [first, second] = editor.getSelections();
      assert.ok(first.equalsRange({ startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: 1 }), first.toString());
      assert.ok(second.equalsRange({ startLineNumber: 4, startColumn: 1, endLineNumber: 4, endColumn: 1 }), second.toString());
    });
    snippetTest((editor, codeSnippet, snippetController) => {
      editor.setSelections([
        new Selection(2, 7, 2, 7)
      ]);
      codeSnippet = "xo$0r";
      snippetController.insert(codeSnippet, { overwriteBefore: 1 });
      assert.strictEqual(editor.getSelections().length, 1);
      assert.ok(editor.getSelection().equalsRange({ startLineNumber: 2, startColumn: 8, endColumn: 8, endLineNumber: 2 }));
    });
  });
  test("Final tabstop, #11742 simple", () => {
    snippetTest((editor, codeSnippet, controller) => {
      editor.setSelection(new Selection(1, 19, 1, 19));
      codeSnippet = "{{% url_**$1** %}}";
      controller.insert(codeSnippet, { overwriteBefore: 2 });
      assert.strictEqual(editor.getSelections().length, 1);
      assert.ok(editor.getSelection().equalsRange({ startLineNumber: 1, startColumn: 27, endLineNumber: 1, endColumn: 27 }));
      assert.strictEqual(editor.getModel().getValue(), "example example {{% url_**** %}}");
    }, ["example example sc"]);
    snippetTest((editor, codeSnippet, controller) => {
      editor.setSelection(new Selection(1, 3, 1, 3));
      codeSnippet = [
        "afterEach((done) => {",
        "	${1}test",
        "});"
      ].join("\n");
      controller.insert(codeSnippet, { overwriteBefore: 2 });
      assert.strictEqual(editor.getSelections().length, 1);
      assert.ok(editor.getSelection().equalsRange({ startLineNumber: 2, startColumn: 2, endLineNumber: 2, endColumn: 2 }), editor.getSelection().toString());
      assert.strictEqual(editor.getModel().getValue(), "afterEach((done) => {\n	test\n});");
    }, ["af"]);
    snippetTest((editor, codeSnippet, controller) => {
      editor.setSelection(new Selection(1, 3, 1, 3));
      codeSnippet = [
        "afterEach((done) => {",
        "${1}	test",
        "});"
      ].join("\n");
      controller.insert(codeSnippet, { overwriteBefore: 2 });
      assert.strictEqual(editor.getSelections().length, 1);
      assert.ok(editor.getSelection().equalsRange({ startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: 1 }), editor.getSelection().toString());
      assert.strictEqual(editor.getModel().getValue(), "afterEach((done) => {\n	test\n});");
    }, ["af"]);
    snippetTest((editor, codeSnippet, controller) => {
      editor.setSelection(new Selection(1, 9, 1, 9));
      codeSnippet = [
        "aft${1}er"
      ].join("\n");
      controller.insert(codeSnippet, { overwriteBefore: 8 });
      assert.strictEqual(editor.getModel().getValue(), "after");
      assert.strictEqual(editor.getSelections().length, 1);
      assert.ok(editor.getSelection().equalsRange({ startLineNumber: 1, startColumn: 4, endLineNumber: 1, endColumn: 4 }), editor.getSelection().toString());
    }, ["afterone"]);
  });
  test("Final tabstop, #11742 different indents", () => {
    snippetTest((editor, codeSnippet, controller) => {
      editor.setSelections([
        new Selection(2, 4, 2, 4),
        new Selection(1, 3, 1, 3)
      ]);
      codeSnippet = [
        "afterEach((done) => {",
        "	${0}test",
        "});"
      ].join("\n");
      controller.insert(codeSnippet, { overwriteBefore: 2 });
      assert.strictEqual(editor.getSelections().length, 2);
      const [first, second] = editor.getSelections();
      assert.ok(first.equalsRange({ startLineNumber: 5, startColumn: 3, endLineNumber: 5, endColumn: 3 }), first.toString());
      assert.ok(second.equalsRange({ startLineNumber: 2, startColumn: 2, endLineNumber: 2, endColumn: 2 }), second.toString());
    }, ["af", "	af"]);
  });
  test("Final tabstop, #11890 stay at the beginning", () => {
    snippetTest((editor, codeSnippet, controller) => {
      editor.setSelections([
        new Selection(1, 5, 1, 5)
      ]);
      codeSnippet = [
        "afterEach((done) => {",
        "${1}	test",
        "});"
      ].join("\n");
      controller.insert(codeSnippet, { overwriteBefore: 2 });
      assert.strictEqual(editor.getSelections().length, 1);
      const [first] = editor.getSelections();
      assert.ok(first.equalsRange({ startLineNumber: 2, startColumn: 3, endLineNumber: 2, endColumn: 3 }), first.toString());
    }, ["  af"]);
  });
  test("Final tabstop, no tabstop", () => {
    snippetTest((editor, codeSnippet, controller) => {
      editor.setSelections([
        new Selection(1, 3, 1, 3)
      ]);
      codeSnippet = "afterEach";
      controller.insert(codeSnippet, { overwriteBefore: 2 });
      assert.ok(editor.getSelection().equalsRange({ startLineNumber: 1, startColumn: 10, endLineNumber: 1, endColumn: 10 }));
    }, ["af", "	af"]);
  });
  test("Multiple cursor and overwriteBefore/After, issue #11060", () => {
    snippetTest((editor, codeSnippet, controller) => {
      editor.setSelections([
        new Selection(1, 7, 1, 7),
        new Selection(2, 4, 2, 4)
      ]);
      codeSnippet = "_foo";
      controller.insert(codeSnippet, { overwriteBefore: 1 });
      assert.strictEqual(editor.getModel().getValue(), "this._foo\nabc_foo");
    }, ["this._", "abc"]);
    snippetTest((editor, codeSnippet, controller) => {
      editor.setSelections([
        new Selection(1, 7, 1, 7),
        new Selection(2, 4, 2, 4)
      ]);
      codeSnippet = "XX";
      controller.insert(codeSnippet, { overwriteBefore: 1 });
      assert.strictEqual(editor.getModel().getValue(), "this.XX\nabcXX");
    }, ["this._", "abc"]);
    snippetTest((editor, codeSnippet, controller) => {
      editor.setSelections([
        new Selection(1, 7, 1, 7),
        new Selection(2, 4, 2, 4),
        new Selection(3, 5, 3, 5)
      ]);
      codeSnippet = "_foo";
      controller.insert(codeSnippet, { overwriteBefore: 1 });
      assert.strictEqual(editor.getModel().getValue(), "this._foo\nabc_foo\ndef_foo");
    }, ["this._", "abc", "def_"]);
    snippetTest((editor, codeSnippet, controller) => {
      editor.setSelections([
        new Selection(1, 7, 1, 7),
        // primary at `this._`
        new Selection(2, 4, 2, 4),
        new Selection(3, 6, 3, 6)
      ]);
      codeSnippet = "._foo";
      controller.insert(codeSnippet, { overwriteBefore: 2 });
      assert.strictEqual(editor.getModel().getValue(), "this._foo\nabc._foo\ndef._foo");
    }, ["this._", "abc", "def._"]);
    snippetTest((editor, codeSnippet, controller) => {
      editor.setSelections([
        new Selection(3, 6, 3, 6),
        // primary at `def._`
        new Selection(1, 7, 1, 7),
        new Selection(2, 4, 2, 4)
      ]);
      codeSnippet = "._foo";
      controller.insert(codeSnippet, { overwriteBefore: 2 });
      assert.strictEqual(editor.getModel().getValue(), "this._foo\nabc._foo\ndef._foo");
    }, ["this._", "abc", "def._"]);
    snippetTest((editor, codeSnippet, controller) => {
      editor.setSelections([
        new Selection(2, 4, 2, 4),
        // primary at `abc`
        new Selection(3, 6, 3, 6),
        new Selection(1, 7, 1, 7)
      ]);
      codeSnippet = "._foo";
      controller.insert(codeSnippet, { overwriteBefore: 2 });
      assert.strictEqual(editor.getModel().getValue(), "this._._foo\na._foo\ndef._._foo");
    }, ["this._", "abc", "def._"]);
  });
  test("Multiple cursor and overwriteBefore/After, #16277", () => {
    snippetTest((editor, codeSnippet, controller) => {
      editor.setSelections([
        new Selection(1, 5, 1, 5),
        new Selection(2, 5, 2, 5)
      ]);
      codeSnippet = "document";
      controller.insert(codeSnippet, { overwriteBefore: 3 });
      assert.strictEqual(editor.getModel().getValue(), "{document}\n{document && true}");
    }, ["{foo}", "{foo && true}"]);
  });
  test("Insert snippet twice, #19449", () => {
    snippetTest((editor, codeSnippet, controller) => {
      editor.setSelections([
        new Selection(1, 1, 1, 1)
      ]);
      codeSnippet = "for (var ${1:i}=0; ${1:i}<len; ${1:i}++) { $0 }";
      controller.insert(codeSnippet);
      assert.strictEqual(editor.getModel().getValue(), "for (var i=0; i<len; i++) {  }for (var i=0; i<len; i++) {  }");
    }, ["for (var i=0; i<len; i++) {  }"]);
    snippetTest((editor, codeSnippet, controller) => {
      editor.setSelections([
        new Selection(1, 1, 1, 1)
      ]);
      codeSnippet = "for (let ${1:i}=0; ${1:i}<len; ${1:i}++) { $0 }";
      controller.insert(codeSnippet);
      assert.strictEqual(editor.getModel().getValue(), "for (let i=0; i<len; i++) {  }for (var i=0; i<len; i++) {  }");
    }, ["for (var i=0; i<len; i++) {  }"]);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9zbmlwcGV0L3Rlc3QvYnJvd3Nlci9zbmlwcGV0Q29udHJvbGxlcjIub2xkLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgbW9jayB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vbW9jay5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IExhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFNuaXBwZXRDb250cm9sbGVyMiB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvc25pcHBldENvbnRyb2xsZXIyLmpzJztcbmltcG9ydCB7IElUZXN0Q29kZUVkaXRvciwgd2l0aFRlc3RDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9icm93c2VyL3Rlc3RDb2RlRWRpdG9yLmpzJztcbmltcG9ydCB7IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9jb21tb24vbW9kZXMvdGVzdExhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL3NlcnZpY2VDb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgTnVsbExvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5cbmNsYXNzIFRlc3RTbmlwcGV0Q29udHJvbGxlciBleHRlbmRzIFNuaXBwZXRDb250cm9sbGVyMiB7XG5cblx0cHJpdmF0ZSBfdGVzdExhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2U6IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGVkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlXG5cdCkge1xuXHRcdGNvbnN0IHRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gbmV3IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKCk7XG5cdFx0c3VwZXIoZWRpdG9yLCBuZXcgTnVsbExvZ1NlcnZpY2UoKSwgbmV3IExhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlKCksIF9jb250ZXh0S2V5U2VydmljZSwgdGVzdExhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdHRoaXMuX3Rlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gdGVzdExhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2U7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl90ZXN0TGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZS5kaXNwb3NlKCk7XG5cdH1cblxuXHRpc0luU25pcHBldE1vZGUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIFNuaXBwZXRDb250cm9sbGVyMi5JblNuaXBwZXRNb2RlLmdldFZhbHVlKHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKSE7XG5cdH1cbn1cblxuc3VpdGUoJ1NuaXBwZXRDb250cm9sbGVyJywgKCkgPT4ge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGZ1bmN0aW9uIHNuaXBwZXRUZXN0KGNiOiAoZWRpdG9yOiBJVGVzdENvZGVFZGl0b3IsIHRlbXBsYXRlOiBzdHJpbmcsIHNuaXBwZXRDb250cm9sbGVyOiBUZXN0U25pcHBldENvbnRyb2xsZXIpID0+IHZvaWQsIGxpbmVzPzogc3RyaW5nW10pOiB2b2lkIHtcblxuXHRcdGlmICghbGluZXMpIHtcblx0XHRcdGxpbmVzID0gW1xuXHRcdFx0XHQnZnVuY3Rpb24gdGVzdCgpIHsnLFxuXHRcdFx0XHQnXFx0dmFyIHggPSAzOycsXG5cdFx0XHRcdCdcXHR2YXIgYXJyID0gW107Jyxcblx0XHRcdFx0J1xcdCcsXG5cdFx0XHRcdCd9J1xuXHRcdFx0XTtcblx0XHR9XG5cblx0XHRjb25zdCBzZXJ2aWNlQ29sbGVjdGlvbiA9IG5ldyBTZXJ2aWNlQ29sbGVjdGlvbihcblx0XHRcdFtJTGFiZWxTZXJ2aWNlLCBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElMYWJlbFNlcnZpY2U+KCkgeyB9XSxcblx0XHRcdFtJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlPigpIHsgfV0sXG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihsaW5lcywgeyBzZXJ2aWNlQ29sbGVjdGlvbiB9LCAoZWRpdG9yKSA9PiB7XG5cdFx0XHRlZGl0b3IuZ2V0TW9kZWwoKSEudXBkYXRlT3B0aW9ucyh7XG5cdFx0XHRcdGluc2VydFNwYWNlczogZmFsc2Vcblx0XHRcdH0pO1xuXHRcdFx0Y29uc3Qgc25pcHBldENvbnRyb2xsZXIgPSBlZGl0b3IucmVnaXN0ZXJBbmRJbnN0YW50aWF0ZUNvbnRyaWJ1dGlvbihUZXN0U25pcHBldENvbnRyb2xsZXIuSUQsIFRlc3RTbmlwcGV0Q29udHJvbGxlcik7XG5cdFx0XHRjb25zdCB0ZW1wbGF0ZSA9IFtcblx0XHRcdFx0J2ZvciAodmFyICR7MTppbmRleH07ICQxIDwgJHsyOmFycmF5fS5sZW5ndGg7ICQxKyspIHsnLFxuXHRcdFx0XHQnXFx0dmFyIGVsZW1lbnQgPSAkMlskMV07Jyxcblx0XHRcdFx0J1xcdCQwJyxcblx0XHRcdFx0J30nXG5cdFx0XHRdLmpvaW4oJ1xcbicpO1xuXG5cdFx0XHRjYihlZGl0b3IsIHRlbXBsYXRlLCBzbmlwcGV0Q29udHJvbGxlcik7XG5cdFx0XHRzbmlwcGV0Q29udHJvbGxlci5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdH1cblxuXHR0ZXN0KCdTaW1wbGUgYWNjZXB0ZWQnLCAoKSA9PiB7XG5cdFx0c25pcHBldFRlc3QoKGVkaXRvciwgdGVtcGxhdGUsIHNuaXBwZXRDb250cm9sbGVyKSA9PiB7XG5cdFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24oeyBsaW5lTnVtYmVyOiA0LCBjb2x1bW46IDIgfSk7XG5cblx0XHRcdHNuaXBwZXRDb250cm9sbGVyLmluc2VydCh0ZW1wbGF0ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDQpLCAnXFx0Zm9yICh2YXIgaW5kZXg7IGluZGV4IDwgYXJyYXkubGVuZ3RoOyBpbmRleCsrKSB7Jyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDUpLCAnXFx0XFx0dmFyIGVsZW1lbnQgPSBhcnJheVtpbmRleF07Jyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDYpLCAnXFx0XFx0Jyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDcpLCAnXFx0fScpO1xuXG5cdFx0XHRlZGl0b3IudHJpZ2dlcigndGVzdCcsICd0eXBlJywgeyB0ZXh0OiAnaScgfSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDQpLCAnXFx0Zm9yICh2YXIgaTsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7Jyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDUpLCAnXFx0XFx0dmFyIGVsZW1lbnQgPSBhcnJheVtpXTsnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0TGluZUNvbnRlbnQoNiksICdcXHRcXHQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0TGluZUNvbnRlbnQoNyksICdcXHR9Jyk7XG5cblx0XHRcdHNuaXBwZXRDb250cm9sbGVyLm5leHQoKTtcblx0XHRcdGVkaXRvci50cmlnZ2VyKCd0ZXN0JywgJ3R5cGUnLCB7IHRleHQ6ICdhcnInIH0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRNb2RlbCgpIS5nZXRMaW5lQ29udGVudCg0KSwgJ1xcdGZvciAodmFyIGk7IGkgPCBhcnIubGVuZ3RoOyBpKyspIHsnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0TGluZUNvbnRlbnQoNSksICdcXHRcXHR2YXIgZWxlbWVudCA9IGFycltpXTsnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0TGluZUNvbnRlbnQoNiksICdcXHRcXHQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0TGluZUNvbnRlbnQoNyksICdcXHR9Jyk7XG5cblx0XHRcdHNuaXBwZXRDb250cm9sbGVyLnByZXYoKTtcblx0XHRcdGVkaXRvci50cmlnZ2VyKCd0ZXN0JywgJ3R5cGUnLCB7IHRleHQ6ICdqJyB9KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0TGluZUNvbnRlbnQoNCksICdcXHRmb3IgKHZhciBqOyBqIDwgYXJyLmxlbmd0aDsgaisrKSB7Jyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDUpLCAnXFx0XFx0dmFyIGVsZW1lbnQgPSBhcnJbal07Jyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDYpLCAnXFx0XFx0Jyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDcpLCAnXFx0fScpO1xuXG5cdFx0XHRzbmlwcGV0Q29udHJvbGxlci5uZXh0KCk7XG5cdFx0XHRzbmlwcGV0Q29udHJvbGxlci5uZXh0KCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRQb3NpdGlvbigpLCBuZXcgUG9zaXRpb24oNiwgMykpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdTaW1wbGUgY2FuY2VsZWQnLCAoKSA9PiB7XG5cdFx0c25pcHBldFRlc3QoKGVkaXRvciwgdGVtcGxhdGUsIHNuaXBwZXRDb250cm9sbGVyKSA9PiB7XG5cdFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24oeyBsaW5lTnVtYmVyOiA0LCBjb2x1bW46IDIgfSk7XG5cblx0XHRcdHNuaXBwZXRDb250cm9sbGVyLmluc2VydCh0ZW1wbGF0ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDQpLCAnXFx0Zm9yICh2YXIgaW5kZXg7IGluZGV4IDwgYXJyYXkubGVuZ3RoOyBpbmRleCsrKSB7Jyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDUpLCAnXFx0XFx0dmFyIGVsZW1lbnQgPSBhcnJheVtpbmRleF07Jyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDYpLCAnXFx0XFx0Jyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDcpLCAnXFx0fScpO1xuXG5cdFx0XHRzbmlwcGV0Q29udHJvbGxlci5jYW5jZWwoKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFBvc2l0aW9uKCksIG5ldyBQb3NpdGlvbig0LCAxNikpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHQvLyB0ZXN0KCdTdG9wcyB3aGVuIGRlbGV0aW5nIGxpbmVzIGFib3ZlJywgKCkgPT4ge1xuXHQvLyBcdHNuaXBwZXRUZXN0KChlZGl0b3IsIGNvZGVTbmlwcGV0LCBzbmlwcGV0Q29udHJvbGxlcikgPT4ge1xuXHQvLyBcdFx0ZWRpdG9yLnNldFBvc2l0aW9uKHsgbGluZU51bWJlcjogNCwgY29sdW1uOiAyIH0pO1xuXHQvLyBcdFx0c25pcHBldENvbnRyb2xsZXIuaW5zZXJ0KGNvZGVTbmlwcGV0LCAwLCAwKTtcblxuXHQvLyBcdFx0ZWRpdG9yLmdldE1vZGVsKCkhLmFwcGx5RWRpdHMoW3tcblx0Ly8gXHRcdFx0Zm9yY2VNb3ZlTWFya2VyczogZmFsc2UsXG5cdC8vIFx0XHRcdGlkZW50aWZpZXI6IG51bGwsXG5cdC8vIFx0XHRcdGlzQXV0b1doaXRlc3BhY2VFZGl0OiBmYWxzZSxcblx0Ly8gXHRcdFx0cmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAzLCAxKSxcblx0Ly8gXHRcdFx0dGV4dDogbnVsbFxuXHQvLyBcdFx0fV0pO1xuXG5cdC8vIFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc25pcHBldENvbnRyb2xsZXIuaXNJblNuaXBwZXRNb2RlKCksIGZhbHNlKTtcblx0Ly8gXHR9KTtcblx0Ly8gfSk7XG5cblx0Ly8gdGVzdCgnU3RvcHMgd2hlbiBkZWxldGluZyBsaW5lcyBiZWxvdycsICgpID0+IHtcblx0Ly8gXHRzbmlwcGV0VGVzdCgoZWRpdG9yLCBjb2RlU25pcHBldCwgc25pcHBldENvbnRyb2xsZXIpID0+IHtcblx0Ly8gXHRcdGVkaXRvci5zZXRQb3NpdGlvbih7IGxpbmVOdW1iZXI6IDQsIGNvbHVtbjogMiB9KTtcblx0Ly8gXHRcdHNuaXBwZXRDb250cm9sbGVyLnJ1bihjb2RlU25pcHBldCwgMCwgMCk7XG5cblx0Ly8gXHRcdGVkaXRvci5nZXRNb2RlbCgpIS5hcHBseUVkaXRzKFt7XG5cdC8vIFx0XHRcdGZvcmNlTW92ZU1hcmtlcnM6IGZhbHNlLFxuXHQvLyBcdFx0XHRpZGVudGlmaWVyOiBudWxsLFxuXHQvLyBcdFx0XHRpc0F1dG9XaGl0ZXNwYWNlRWRpdDogZmFsc2UsXG5cdC8vIFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UoOCwgMSwgOCwgMTAwKSxcblx0Ly8gXHRcdFx0dGV4dDogbnVsbFxuXHQvLyBcdFx0fV0pO1xuXG5cdC8vIFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc25pcHBldENvbnRyb2xsZXIuaXNJblNuaXBwZXRNb2RlKCksIGZhbHNlKTtcblx0Ly8gXHR9KTtcblx0Ly8gfSk7XG5cblx0Ly8gdGVzdCgnU3RvcHMgd2hlbiBpbnNlcnRpbmcgbGluZXMgYWJvdmUnLCAoKSA9PiB7XG5cdC8vIFx0c25pcHBldFRlc3QoKGVkaXRvciwgY29kZVNuaXBwZXQsIHNuaXBwZXRDb250cm9sbGVyKSA9PiB7XG5cdC8vIFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24oeyBsaW5lTnVtYmVyOiA0LCBjb2x1bW46IDIgfSk7XG5cdC8vIFx0XHRzbmlwcGV0Q29udHJvbGxlci5ydW4oY29kZVNuaXBwZXQsIDAsIDApO1xuXG5cdC8vIFx0XHRlZGl0b3IuZ2V0TW9kZWwoKSEuYXBwbHlFZGl0cyhbe1xuXHQvLyBcdFx0XHRmb3JjZU1vdmVNYXJrZXJzOiBmYWxzZSxcblx0Ly8gXHRcdFx0aWRlbnRpZmllcjogbnVsbCxcblx0Ly8gXHRcdFx0aXNBdXRvV2hpdGVzcGFjZUVkaXQ6IGZhbHNlLFxuXHQvLyBcdFx0XHRyYW5nZTogbmV3IFJhbmdlKDEsIDEwMCwgMSwgMTAwKSxcblx0Ly8gXHRcdFx0dGV4dDogJ1xcbkhlbGxvJ1xuXHQvLyBcdFx0fV0pO1xuXG5cdC8vIFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc25pcHBldENvbnRyb2xsZXIuaXNJblNuaXBwZXRNb2RlKCksIGZhbHNlKTtcblx0Ly8gXHR9KTtcblx0Ly8gfSk7XG5cblx0Ly8gdGVzdCgnU3RvcHMgd2hlbiBpbnNlcnRpbmcgbGluZXMgYmVsb3cnLCAoKSA9PiB7XG5cdC8vIFx0c25pcHBldFRlc3QoKGVkaXRvciwgY29kZVNuaXBwZXQsIHNuaXBwZXRDb250cm9sbGVyKSA9PiB7XG5cdC8vIFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24oeyBsaW5lTnVtYmVyOiA0LCBjb2x1bW46IDIgfSk7XG5cdC8vIFx0XHRzbmlwcGV0Q29udHJvbGxlci5ydW4oY29kZVNuaXBwZXQsIDAsIDApO1xuXG5cdC8vIFx0XHRlZGl0b3IuZ2V0TW9kZWwoKSEuYXBwbHlFZGl0cyhbe1xuXHQvLyBcdFx0XHRmb3JjZU1vdmVNYXJrZXJzOiBmYWxzZSxcblx0Ly8gXHRcdFx0aWRlbnRpZmllcjogbnVsbCxcblx0Ly8gXHRcdFx0aXNBdXRvV2hpdGVzcGFjZUVkaXQ6IGZhbHNlLFxuXHQvLyBcdFx0XHRyYW5nZTogbmV3IFJhbmdlKDgsIDEwMCwgOCwgMTAwKSxcblx0Ly8gXHRcdFx0dGV4dDogJ1xcbkhlbGxvJ1xuXHQvLyBcdFx0fV0pO1xuXG5cdC8vIFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc25pcHBldENvbnRyb2xsZXIuaXNJblNuaXBwZXRNb2RlKCksIGZhbHNlKTtcblx0Ly8gXHR9KTtcblx0Ly8gfSk7XG5cblx0dGVzdCgnU3RvcHMgd2hlbiBjYWxsaW5nIG1vZGVsLnNldFZhbHVlKCknLCAoKSA9PiB7XG5cdFx0c25pcHBldFRlc3QoKGVkaXRvciwgY29kZVNuaXBwZXQsIHNuaXBwZXRDb250cm9sbGVyKSA9PiB7XG5cdFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24oeyBsaW5lTnVtYmVyOiA0LCBjb2x1bW46IDIgfSk7XG5cdFx0XHRzbmlwcGV0Q29udHJvbGxlci5pbnNlcnQoY29kZVNuaXBwZXQpO1xuXG5cdFx0XHRlZGl0b3IuZ2V0TW9kZWwoKSEuc2V0VmFsdWUoJ2dvb2RieWUnKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNuaXBwZXRDb250cm9sbGVyLmlzSW5TbmlwcGV0TW9kZSgpLCBmYWxzZSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1N0b3BzIHdoZW4gdW5kb2luZycsICgpID0+IHtcblx0XHRzbmlwcGV0VGVzdCgoZWRpdG9yLCBjb2RlU25pcHBldCwgc25pcHBldENvbnRyb2xsZXIpID0+IHtcblx0XHRcdGVkaXRvci5zZXRQb3NpdGlvbih7IGxpbmVOdW1iZXI6IDQsIGNvbHVtbjogMiB9KTtcblx0XHRcdHNuaXBwZXRDb250cm9sbGVyLmluc2VydChjb2RlU25pcHBldCk7XG5cblx0XHRcdGVkaXRvci5nZXRNb2RlbCgpIS51bmRvKCk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzbmlwcGV0Q29udHJvbGxlci5pc0luU25pcHBldE1vZGUoKSwgZmFsc2UpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdTdG9wcyB3aGVuIG1vdmluZyBjdXJzb3Igb3V0c2lkZScsICgpID0+IHtcblx0XHRzbmlwcGV0VGVzdCgoZWRpdG9yLCBjb2RlU25pcHBldCwgc25pcHBldENvbnRyb2xsZXIpID0+IHtcblx0XHRcdGVkaXRvci5zZXRQb3NpdGlvbih7IGxpbmVOdW1iZXI6IDQsIGNvbHVtbjogMiB9KTtcblx0XHRcdHNuaXBwZXRDb250cm9sbGVyLmluc2VydChjb2RlU25pcHBldCk7XG5cblx0XHRcdGVkaXRvci5zZXRQb3NpdGlvbih7IGxpbmVOdW1iZXI6IDEsIGNvbHVtbjogMSB9KTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNuaXBwZXRDb250cm9sbGVyLmlzSW5TbmlwcGV0TW9kZSgpLCBmYWxzZSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1N0b3BzIHdoZW4gZGlzY29ubmVjdGluZyBlZGl0b3IgbW9kZWwnLCAoKSA9PiB7XG5cdFx0c25pcHBldFRlc3QoKGVkaXRvciwgY29kZVNuaXBwZXQsIHNuaXBwZXRDb250cm9sbGVyKSA9PiB7XG5cdFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24oeyBsaW5lTnVtYmVyOiA0LCBjb2x1bW46IDIgfSk7XG5cdFx0XHRzbmlwcGV0Q29udHJvbGxlci5pbnNlcnQoY29kZVNuaXBwZXQpO1xuXG5cdFx0XHRlZGl0b3Iuc2V0TW9kZWwobnVsbCk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzbmlwcGV0Q29udHJvbGxlci5pc0luU25pcHBldE1vZGUoKSwgZmFsc2UpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdTdG9wcyB3aGVuIGRpc3Bvc2luZyBlZGl0b3InLCAoKSA9PiB7XG5cdFx0c25pcHBldFRlc3QoKGVkaXRvciwgY29kZVNuaXBwZXQsIHNuaXBwZXRDb250cm9sbGVyKSA9PiB7XG5cdFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24oeyBsaW5lTnVtYmVyOiA0LCBjb2x1bW46IDIgfSk7XG5cdFx0XHRzbmlwcGV0Q29udHJvbGxlci5pbnNlcnQoY29kZVNuaXBwZXQpO1xuXG5cdFx0XHRzbmlwcGV0Q29udHJvbGxlci5kaXNwb3NlKCk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzbmlwcGV0Q29udHJvbGxlci5pc0luU25pcHBldE1vZGUoKSwgZmFsc2UpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdGaW5hbCB0YWJzdG9wIHdpdGggbXVsdGlwbGUgc2VsZWN0aW9ucycsICgpID0+IHtcblx0XHRzbmlwcGV0VGVzdCgoZWRpdG9yLCBjb2RlU25pcHBldCwgc25pcHBldENvbnRyb2xsZXIpID0+IHtcblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCAxLCAyLCAxKSxcblx0XHRcdF0pO1xuXG5cdFx0XHRjb2RlU25pcHBldCA9ICdmb28kMCc7XG5cdFx0XHRzbmlwcGV0Q29udHJvbGxlci5pbnNlcnQoY29kZVNuaXBwZXQpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSEubGVuZ3RoLCAyKTtcblx0XHRcdGNvbnN0IFtmaXJzdCwgc2Vjb25kXSA9IGVkaXRvci5nZXRTZWxlY3Rpb25zKCkhO1xuXHRcdFx0YXNzZXJ0Lm9rKGZpcnN0LmVxdWFsc1JhbmdlKHsgc3RhcnRMaW5lTnVtYmVyOiAxLCBzdGFydENvbHVtbjogNCwgZW5kTGluZU51bWJlcjogMSwgZW5kQ29sdW1uOiA0IH0pLCBmaXJzdC50b1N0cmluZygpKTtcblx0XHRcdGFzc2VydC5vayhzZWNvbmQuZXF1YWxzUmFuZ2UoeyBzdGFydExpbmVOdW1iZXI6IDIsIHN0YXJ0Q29sdW1uOiA0LCBlbmRMaW5lTnVtYmVyOiAyLCBlbmRDb2x1bW46IDQgfSksIHNlY29uZC50b1N0cmluZygpKTtcblx0XHR9KTtcblxuXHRcdHNuaXBwZXRUZXN0KChlZGl0b3IsIGNvZGVTbmlwcGV0LCBzbmlwcGV0Q29udHJvbGxlcikgPT4ge1xuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDEsIDIsIDEpLFxuXHRcdFx0XSk7XG5cblx0XHRcdGNvZGVTbmlwcGV0ID0gJ2ZvbyQwYmFyJztcblx0XHRcdHNuaXBwZXRDb250cm9sbGVyLmluc2VydChjb2RlU25pcHBldCk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9ucygpIS5sZW5ndGgsIDIpO1xuXHRcdFx0Y29uc3QgW2ZpcnN0LCBzZWNvbmRdID0gZWRpdG9yLmdldFNlbGVjdGlvbnMoKSE7XG5cdFx0XHRhc3NlcnQub2soZmlyc3QuZXF1YWxzUmFuZ2UoeyBzdGFydExpbmVOdW1iZXI6IDEsIHN0YXJ0Q29sdW1uOiA0LCBlbmRMaW5lTnVtYmVyOiAxLCBlbmRDb2x1bW46IDQgfSksIGZpcnN0LnRvU3RyaW5nKCkpO1xuXHRcdFx0YXNzZXJ0Lm9rKHNlY29uZC5lcXVhbHNSYW5nZSh7IHN0YXJ0TGluZU51bWJlcjogMiwgc3RhcnRDb2x1bW46IDQsIGVuZExpbmVOdW1iZXI6IDIsIGVuZENvbHVtbjogNCB9KSwgc2Vjb25kLnRvU3RyaW5nKCkpO1xuXHRcdH0pO1xuXG5cdFx0c25pcHBldFRlc3QoKGVkaXRvciwgY29kZVNuaXBwZXQsIHNuaXBwZXRDb250cm9sbGVyKSA9PiB7XG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9ucyhbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNSwgMSwgNSksXG5cdFx0XHRdKTtcblxuXHRcdFx0Y29kZVNuaXBwZXQgPSAnZm9vJDBiYXInO1xuXHRcdFx0c25pcHBldENvbnRyb2xsZXIuaW5zZXJ0KGNvZGVTbmlwcGV0KTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCkhLmxlbmd0aCwgMik7XG5cdFx0XHRjb25zdCBbZmlyc3QsIHNlY29uZF0gPSBlZGl0b3IuZ2V0U2VsZWN0aW9ucygpITtcblx0XHRcdGFzc2VydC5vayhmaXJzdC5lcXVhbHNSYW5nZSh7IHN0YXJ0TGluZU51bWJlcjogMSwgc3RhcnRDb2x1bW46IDQsIGVuZExpbmVOdW1iZXI6IDEsIGVuZENvbHVtbjogNCB9KSwgZmlyc3QudG9TdHJpbmcoKSk7XG5cdFx0XHRhc3NlcnQub2soc2Vjb25kLmVxdWFsc1JhbmdlKHsgc3RhcnRMaW5lTnVtYmVyOiAxLCBzdGFydENvbHVtbjogMTQsIGVuZExpbmVOdW1iZXI6IDEsIGVuZENvbHVtbjogMTQgfSksIHNlY29uZC50b1N0cmluZygpKTtcblx0XHR9KTtcblxuXHRcdHNuaXBwZXRUZXN0KChlZGl0b3IsIGNvZGVTbmlwcGV0LCBzbmlwcGV0Q29udHJvbGxlcikgPT4ge1xuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDUsIDEsIDUpLFxuXHRcdFx0XSk7XG5cblx0XHRcdGNvZGVTbmlwcGV0ID0gJ2Zvb1xcbiQwXFxuYmFyJztcblx0XHRcdHNuaXBwZXRDb250cm9sbGVyLmluc2VydChjb2RlU25pcHBldCk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9ucygpIS5sZW5ndGgsIDIpO1xuXHRcdFx0Y29uc3QgW2ZpcnN0LCBzZWNvbmRdID0gZWRpdG9yLmdldFNlbGVjdGlvbnMoKSE7XG5cdFx0XHRhc3NlcnQub2soZmlyc3QuZXF1YWxzUmFuZ2UoeyBzdGFydExpbmVOdW1iZXI6IDIsIHN0YXJ0Q29sdW1uOiAxLCBlbmRMaW5lTnVtYmVyOiAyLCBlbmRDb2x1bW46IDEgfSksIGZpcnN0LnRvU3RyaW5nKCkpO1xuXHRcdFx0YXNzZXJ0Lm9rKHNlY29uZC5lcXVhbHNSYW5nZSh7IHN0YXJ0TGluZU51bWJlcjogNCwgc3RhcnRDb2x1bW46IDEsIGVuZExpbmVOdW1iZXI6IDQsIGVuZENvbHVtbjogMSB9KSwgc2Vjb25kLnRvU3RyaW5nKCkpO1xuXHRcdH0pO1xuXG5cdFx0c25pcHBldFRlc3QoKGVkaXRvciwgY29kZVNuaXBwZXQsIHNuaXBwZXRDb250cm9sbGVyKSA9PiB7XG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9ucyhbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNSwgMSwgNSksXG5cdFx0XHRdKTtcblxuXHRcdFx0Y29kZVNuaXBwZXQgPSAnZm9vXFxuJDBcXG5iYXInO1xuXHRcdFx0c25pcHBldENvbnRyb2xsZXIuaW5zZXJ0KGNvZGVTbmlwcGV0KTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCkhLmxlbmd0aCwgMik7XG5cdFx0XHRjb25zdCBbZmlyc3QsIHNlY29uZF0gPSBlZGl0b3IuZ2V0U2VsZWN0aW9ucygpITtcblx0XHRcdGFzc2VydC5vayhmaXJzdC5lcXVhbHNSYW5nZSh7IHN0YXJ0TGluZU51bWJlcjogMiwgc3RhcnRDb2x1bW46IDEsIGVuZExpbmVOdW1iZXI6IDIsIGVuZENvbHVtbjogMSB9KSwgZmlyc3QudG9TdHJpbmcoKSk7XG5cdFx0XHRhc3NlcnQub2soc2Vjb25kLmVxdWFsc1JhbmdlKHsgc3RhcnRMaW5lTnVtYmVyOiA0LCBzdGFydENvbHVtbjogMSwgZW5kTGluZU51bWJlcjogNCwgZW5kQ29sdW1uOiAxIH0pLCBzZWNvbmQudG9TdHJpbmcoKSk7XG5cdFx0fSk7XG5cblx0XHRzbmlwcGV0VGVzdCgoZWRpdG9yLCBjb2RlU25pcHBldCwgc25pcHBldENvbnRyb2xsZXIpID0+IHtcblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCA3LCAyLCA3KSxcblx0XHRcdF0pO1xuXG5cdFx0XHRjb2RlU25pcHBldCA9ICd4byQwcic7XG5cdFx0XHRzbmlwcGV0Q29udHJvbGxlci5pbnNlcnQoY29kZVNuaXBwZXQsIHsgb3ZlcndyaXRlQmVmb3JlOiAxIH0pO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSEubGVuZ3RoLCAxKTtcblx0XHRcdGFzc2VydC5vayhlZGl0b3IuZ2V0U2VsZWN0aW9uKCkhLmVxdWFsc1JhbmdlKHsgc3RhcnRMaW5lTnVtYmVyOiAyLCBzdGFydENvbHVtbjogOCwgZW5kQ29sdW1uOiA4LCBlbmRMaW5lTnVtYmVyOiAyIH0pKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRmluYWwgdGFic3RvcCwgIzExNzQyIHNpbXBsZScsICgpID0+IHtcblx0XHRzbmlwcGV0VGVzdCgoZWRpdG9yLCBjb2RlU25pcHBldCwgY29udHJvbGxlcikgPT4ge1xuXG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgMTksIDEsIDE5KSk7XG5cblx0XHRcdGNvZGVTbmlwcGV0ID0gJ3t7JSB1cmxfKiokMSoqICV9fSc7XG5cdFx0XHRjb250cm9sbGVyLmluc2VydChjb2RlU25pcHBldCwgeyBvdmVyd3JpdGVCZWZvcmU6IDIgfSk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9ucygpIS5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0Lm9rKGVkaXRvci5nZXRTZWxlY3Rpb24oKSEuZXF1YWxzUmFuZ2UoeyBzdGFydExpbmVOdW1iZXI6IDEsIHN0YXJ0Q29sdW1uOiAyNywgZW5kTGluZU51bWJlcjogMSwgZW5kQ29sdW1uOiAyNyB9KSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldFZhbHVlKCksICdleGFtcGxlIGV4YW1wbGUge3slIHVybF8qKioqICV9fScpO1xuXG5cdFx0fSwgWydleGFtcGxlIGV4YW1wbGUgc2MnXSk7XG5cblx0XHRzbmlwcGV0VGVzdCgoZWRpdG9yLCBjb2RlU25pcHBldCwgY29udHJvbGxlcikgPT4ge1xuXG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgMywgMSwgMykpO1xuXG5cdFx0XHRjb2RlU25pcHBldCA9IFtcblx0XHRcdFx0J2FmdGVyRWFjaCgoZG9uZSkgPT4geycsXG5cdFx0XHRcdCdcXHQkezF9dGVzdCcsXG5cdFx0XHRcdCd9KTsnXG5cdFx0XHRdLmpvaW4oJ1xcbicpO1xuXG5cdFx0XHRjb250cm9sbGVyLmluc2VydChjb2RlU25pcHBldCwgeyBvdmVyd3JpdGVCZWZvcmU6IDIgfSk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9ucygpIS5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0Lm9rKGVkaXRvci5nZXRTZWxlY3Rpb24oKSEuZXF1YWxzUmFuZ2UoeyBzdGFydExpbmVOdW1iZXI6IDIsIHN0YXJ0Q29sdW1uOiAyLCBlbmRMaW5lTnVtYmVyOiAyLCBlbmRDb2x1bW46IDIgfSksIGVkaXRvci5nZXRTZWxlY3Rpb24oKSEudG9TdHJpbmcoKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldFZhbHVlKCksICdhZnRlckVhY2goKGRvbmUpID0+IHtcXG5cXHR0ZXN0XFxufSk7Jyk7XG5cblx0XHR9LCBbJ2FmJ10pO1xuXG5cdFx0c25pcHBldFRlc3QoKGVkaXRvciwgY29kZVNuaXBwZXQsIGNvbnRyb2xsZXIpID0+IHtcblxuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDEsIDMsIDEsIDMpKTtcblxuXHRcdFx0Y29kZVNuaXBwZXQgPSBbXG5cdFx0XHRcdCdhZnRlckVhY2goKGRvbmUpID0+IHsnLFxuXHRcdFx0XHQnJHsxfVxcdHRlc3QnLFxuXHRcdFx0XHQnfSk7J1xuXHRcdFx0XS5qb2luKCdcXG4nKTtcblxuXHRcdFx0Y29udHJvbGxlci5pbnNlcnQoY29kZVNuaXBwZXQsIHsgb3ZlcndyaXRlQmVmb3JlOiAyIH0pO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSEubGVuZ3RoLCAxKTtcblx0XHRcdGFzc2VydC5vayhlZGl0b3IuZ2V0U2VsZWN0aW9uKCkhLmVxdWFsc1JhbmdlKHsgc3RhcnRMaW5lTnVtYmVyOiAyLCBzdGFydENvbHVtbjogMSwgZW5kTGluZU51bWJlcjogMiwgZW5kQ29sdW1uOiAxIH0pLCBlZGl0b3IuZ2V0U2VsZWN0aW9uKCkhLnRvU3RyaW5nKCkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRNb2RlbCgpIS5nZXRWYWx1ZSgpLCAnYWZ0ZXJFYWNoKChkb25lKSA9PiB7XFxuXFx0dGVzdFxcbn0pOycpO1xuXG5cdFx0fSwgWydhZiddKTtcblxuXHRcdHNuaXBwZXRUZXN0KChlZGl0b3IsIGNvZGVTbmlwcGV0LCBjb250cm9sbGVyKSA9PiB7XG5cblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCA5LCAxLCA5KSk7XG5cblx0XHRcdGNvZGVTbmlwcGV0ID0gW1xuXHRcdFx0XHQnYWZ0JHsxfWVyJ1xuXHRcdFx0XS5qb2luKCdcXG4nKTtcblxuXHRcdFx0Y29udHJvbGxlci5pbnNlcnQoY29kZVNuaXBwZXQsIHsgb3ZlcndyaXRlQmVmb3JlOiA4IH0pO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldFZhbHVlKCksICdhZnRlcicpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCkhLmxlbmd0aCwgMSk7XG5cdFx0XHRhc3NlcnQub2soZWRpdG9yLmdldFNlbGVjdGlvbigpIS5lcXVhbHNSYW5nZSh7IHN0YXJ0TGluZU51bWJlcjogMSwgc3RhcnRDb2x1bW46IDQsIGVuZExpbmVOdW1iZXI6IDEsIGVuZENvbHVtbjogNCB9KSwgZWRpdG9yLmdldFNlbGVjdGlvbigpIS50b1N0cmluZygpKTtcblxuXHRcdH0sIFsnYWZ0ZXJvbmUnXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0ZpbmFsIHRhYnN0b3AsICMxMTc0MiBkaWZmZXJlbnQgaW5kZW50cycsICgpID0+IHtcblxuXHRcdHNuaXBwZXRUZXN0KChlZGl0b3IsIGNvZGVTbmlwcGV0LCBjb250cm9sbGVyKSA9PiB7XG5cblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCA0LCAyLCA0KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAzLCAxLCAzKVxuXHRcdFx0XSk7XG5cblx0XHRcdGNvZGVTbmlwcGV0ID0gW1xuXHRcdFx0XHQnYWZ0ZXJFYWNoKChkb25lKSA9PiB7Jyxcblx0XHRcdFx0J1xcdCR7MH10ZXN0Jyxcblx0XHRcdFx0J30pOydcblx0XHRcdF0uam9pbignXFxuJyk7XG5cblx0XHRcdGNvbnRyb2xsZXIuaW5zZXJ0KGNvZGVTbmlwcGV0LCB7IG92ZXJ3cml0ZUJlZm9yZTogMiB9KTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCkhLmxlbmd0aCwgMik7XG5cdFx0XHRjb25zdCBbZmlyc3QsIHNlY29uZF0gPSBlZGl0b3IuZ2V0U2VsZWN0aW9ucygpITtcblxuXHRcdFx0YXNzZXJ0Lm9rKGZpcnN0LmVxdWFsc1JhbmdlKHsgc3RhcnRMaW5lTnVtYmVyOiA1LCBzdGFydENvbHVtbjogMywgZW5kTGluZU51bWJlcjogNSwgZW5kQ29sdW1uOiAzIH0pLCBmaXJzdC50b1N0cmluZygpKTtcblx0XHRcdGFzc2VydC5vayhzZWNvbmQuZXF1YWxzUmFuZ2UoeyBzdGFydExpbmVOdW1iZXI6IDIsIHN0YXJ0Q29sdW1uOiAyLCBlbmRMaW5lTnVtYmVyOiAyLCBlbmRDb2x1bW46IDIgfSksIHNlY29uZC50b1N0cmluZygpKTtcblxuXHRcdH0sIFsnYWYnLCAnXFx0YWYnXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0ZpbmFsIHRhYnN0b3AsICMxMTg5MCBzdGF5IGF0IHRoZSBiZWdpbm5pbmcnLCAoKSA9PiB7XG5cblx0XHRzbmlwcGV0VGVzdCgoZWRpdG9yLCBjb2RlU25pcHBldCwgY29udHJvbGxlcikgPT4ge1xuXG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9ucyhbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNSwgMSwgNSlcblx0XHRcdF0pO1xuXG5cdFx0XHRjb2RlU25pcHBldCA9IFtcblx0XHRcdFx0J2FmdGVyRWFjaCgoZG9uZSkgPT4geycsXG5cdFx0XHRcdCckezF9XFx0dGVzdCcsXG5cdFx0XHRcdCd9KTsnXG5cdFx0XHRdLmpvaW4oJ1xcbicpO1xuXG5cdFx0XHRjb250cm9sbGVyLmluc2VydChjb2RlU25pcHBldCwgeyBvdmVyd3JpdGVCZWZvcmU6IDIgfSk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9ucygpIS5sZW5ndGgsIDEpO1xuXHRcdFx0Y29uc3QgW2ZpcnN0XSA9IGVkaXRvci5nZXRTZWxlY3Rpb25zKCkhO1xuXG5cdFx0XHRhc3NlcnQub2soZmlyc3QuZXF1YWxzUmFuZ2UoeyBzdGFydExpbmVOdW1iZXI6IDIsIHN0YXJ0Q29sdW1uOiAzLCBlbmRMaW5lTnVtYmVyOiAyLCBlbmRDb2x1bW46IDMgfSksIGZpcnN0LnRvU3RyaW5nKCkpO1xuXG5cdFx0fSwgWycgIGFmJ10pO1xuXHR9KTtcblxuXHR0ZXN0KCdGaW5hbCB0YWJzdG9wLCBubyB0YWJzdG9wJywgKCkgPT4ge1xuXG5cdFx0c25pcHBldFRlc3QoKGVkaXRvciwgY29kZVNuaXBwZXQsIGNvbnRyb2xsZXIpID0+IHtcblxuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDMsIDEsIDMpXG5cdFx0XHRdKTtcblxuXHRcdFx0Y29kZVNuaXBwZXQgPSAnYWZ0ZXJFYWNoJztcblxuXHRcdFx0Y29udHJvbGxlci5pbnNlcnQoY29kZVNuaXBwZXQsIHsgb3ZlcndyaXRlQmVmb3JlOiAyIH0pO1xuXG5cdFx0XHRhc3NlcnQub2soZWRpdG9yLmdldFNlbGVjdGlvbigpIS5lcXVhbHNSYW5nZSh7IHN0YXJ0TGluZU51bWJlcjogMSwgc3RhcnRDb2x1bW46IDEwLCBlbmRMaW5lTnVtYmVyOiAxLCBlbmRDb2x1bW46IDEwIH0pKTtcblxuXHRcdH0sIFsnYWYnLCAnXFx0YWYnXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ011bHRpcGxlIGN1cnNvciBhbmQgb3ZlcndyaXRlQmVmb3JlL0FmdGVyLCBpc3N1ZSAjMTEwNjAnLCAoKSA9PiB7XG5cblx0XHRzbmlwcGV0VGVzdCgoZWRpdG9yLCBjb2RlU25pcHBldCwgY29udHJvbGxlcikgPT4ge1xuXG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9ucyhbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNywgMSwgNyksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgNCwgMiwgNClcblx0XHRcdF0pO1xuXG5cdFx0XHRjb2RlU25pcHBldCA9ICdfZm9vJztcblx0XHRcdGNvbnRyb2xsZXIuaW5zZXJ0KGNvZGVTbmlwcGV0LCB7IG92ZXJ3cml0ZUJlZm9yZTogMSB9KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0VmFsdWUoKSwgJ3RoaXMuX2Zvb1xcbmFiY19mb28nKTtcblxuXHRcdH0sIFsndGhpcy5fJywgJ2FiYyddKTtcblxuXHRcdHNuaXBwZXRUZXN0KChlZGl0b3IsIGNvZGVTbmlwcGV0LCBjb250cm9sbGVyKSA9PiB7XG5cblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCA3LCAxLCA3KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCA0LCAyLCA0KVxuXHRcdFx0XSk7XG5cblx0XHRcdGNvZGVTbmlwcGV0ID0gJ1hYJztcblx0XHRcdGNvbnRyb2xsZXIuaW5zZXJ0KGNvZGVTbmlwcGV0LCB7IG92ZXJ3cml0ZUJlZm9yZTogMSB9KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0VmFsdWUoKSwgJ3RoaXMuWFhcXG5hYmNYWCcpO1xuXG5cdFx0fSwgWyd0aGlzLl8nLCAnYWJjJ10pO1xuXG5cdFx0c25pcHBldFRlc3QoKGVkaXRvciwgY29kZVNuaXBwZXQsIGNvbnRyb2xsZXIpID0+IHtcblxuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDcsIDEsIDcpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDQsIDIsIDQpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDMsIDUsIDMsIDUpXG5cdFx0XHRdKTtcblxuXHRcdFx0Y29kZVNuaXBwZXQgPSAnX2Zvbyc7XG5cdFx0XHRjb250cm9sbGVyLmluc2VydChjb2RlU25pcHBldCwgeyBvdmVyd3JpdGVCZWZvcmU6IDEgfSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldFZhbHVlKCksICd0aGlzLl9mb29cXG5hYmNfZm9vXFxuZGVmX2ZvbycpO1xuXG5cdFx0fSwgWyd0aGlzLl8nLCAnYWJjJywgJ2RlZl8nXSk7XG5cblx0XHRzbmlwcGV0VGVzdCgoZWRpdG9yLCBjb2RlU25pcHBldCwgY29udHJvbGxlcikgPT4ge1xuXG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9ucyhbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNywgMSwgNyksIC8vIHByaW1hcnkgYXQgYHRoaXMuX2Bcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCA0LCAyLCA0KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigzLCA2LCAzLCA2KVxuXHRcdFx0XSk7XG5cblx0XHRcdGNvZGVTbmlwcGV0ID0gJy5fZm9vJztcblx0XHRcdGNvbnRyb2xsZXIuaW5zZXJ0KGNvZGVTbmlwcGV0LCB7IG92ZXJ3cml0ZUJlZm9yZTogMiB9KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0VmFsdWUoKSwgJ3RoaXMuX2Zvb1xcbmFiYy5fZm9vXFxuZGVmLl9mb28nKTtcblxuXHRcdH0sIFsndGhpcy5fJywgJ2FiYycsICdkZWYuXyddKTtcblxuXHRcdHNuaXBwZXRUZXN0KChlZGl0b3IsIGNvZGVTbmlwcGV0LCBjb250cm9sbGVyKSA9PiB7XG5cblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigzLCA2LCAzLCA2KSwgLy8gcHJpbWFyeSBhdCBgZGVmLl9gXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNywgMSwgNyksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgNCwgMiwgNCksXG5cdFx0XHRdKTtcblxuXHRcdFx0Y29kZVNuaXBwZXQgPSAnLl9mb28nO1xuXHRcdFx0Y29udHJvbGxlci5pbnNlcnQoY29kZVNuaXBwZXQsIHsgb3ZlcndyaXRlQmVmb3JlOiAyIH0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRNb2RlbCgpIS5nZXRWYWx1ZSgpLCAndGhpcy5fZm9vXFxuYWJjLl9mb29cXG5kZWYuX2ZvbycpO1xuXG5cdFx0fSwgWyd0aGlzLl8nLCAnYWJjJywgJ2RlZi5fJ10pO1xuXG5cdFx0c25pcHBldFRlc3QoKGVkaXRvciwgY29kZVNuaXBwZXQsIGNvbnRyb2xsZXIpID0+IHtcblxuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDQsIDIsIDQpLCAvLyBwcmltYXJ5IGF0IGBhYmNgXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMywgNiwgMywgNiksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNywgMSwgNyksXG5cdFx0XHRdKTtcblxuXHRcdFx0Y29kZVNuaXBwZXQgPSAnLl9mb28nO1xuXHRcdFx0Y29udHJvbGxlci5pbnNlcnQoY29kZVNuaXBwZXQsIHsgb3ZlcndyaXRlQmVmb3JlOiAyIH0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRNb2RlbCgpIS5nZXRWYWx1ZSgpLCAndGhpcy5fLl9mb29cXG5hLl9mb29cXG5kZWYuXy5fZm9vJyk7XG5cblx0XHR9LCBbJ3RoaXMuXycsICdhYmMnLCAnZGVmLl8nXSk7XG5cblx0fSk7XG5cblx0dGVzdCgnTXVsdGlwbGUgY3Vyc29yIGFuZCBvdmVyd3JpdGVCZWZvcmUvQWZ0ZXIsICMxNjI3NycsICgpID0+IHtcblx0XHRzbmlwcGV0VGVzdCgoZWRpdG9yLCBjb2RlU25pcHBldCwgY29udHJvbGxlcikgPT4ge1xuXG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9ucyhbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNSwgMSwgNSksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgNSwgMiwgNSksXG5cdFx0XHRdKTtcblxuXHRcdFx0Y29kZVNuaXBwZXQgPSAnZG9jdW1lbnQnO1xuXHRcdFx0Y29udHJvbGxlci5pbnNlcnQoY29kZVNuaXBwZXQsIHsgb3ZlcndyaXRlQmVmb3JlOiAzIH0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRNb2RlbCgpIS5nZXRWYWx1ZSgpLCAne2RvY3VtZW50fVxcbntkb2N1bWVudCAmJiB0cnVlfScpO1xuXG5cdFx0fSwgWyd7Zm9vfScsICd7Zm9vICYmIHRydWV9J10pO1xuXHR9KTtcblxuXHR0ZXN0KCdJbnNlcnQgc25pcHBldCB0d2ljZSwgIzE5NDQ5JywgKCkgPT4ge1xuXG5cdFx0c25pcHBldFRlc3QoKGVkaXRvciwgY29kZVNuaXBwZXQsIGNvbnRyb2xsZXIpID0+IHtcblxuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpXG5cdFx0XHRdKTtcblxuXHRcdFx0Y29kZVNuaXBwZXQgPSAnZm9yICh2YXIgJHsxOml9PTA7ICR7MTppfTxsZW47ICR7MTppfSsrKSB7ICQwIH0nO1xuXHRcdFx0Y29udHJvbGxlci5pbnNlcnQoY29kZVNuaXBwZXQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRNb2RlbCgpIS5nZXRWYWx1ZSgpLCAnZm9yICh2YXIgaT0wOyBpPGxlbjsgaSsrKSB7ICB9Zm9yICh2YXIgaT0wOyBpPGxlbjsgaSsrKSB7ICB9Jyk7XG5cblx0XHR9LCBbJ2ZvciAodmFyIGk9MDsgaTxsZW47IGkrKykgeyAgfSddKTtcblxuXG5cdFx0c25pcHBldFRlc3QoKGVkaXRvciwgY29kZVNuaXBwZXQsIGNvbnRyb2xsZXIpID0+IHtcblxuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpXG5cdFx0XHRdKTtcblxuXHRcdFx0Y29kZVNuaXBwZXQgPSAnZm9yIChsZXQgJHsxOml9PTA7ICR7MTppfTxsZW47ICR7MTppfSsrKSB7ICQwIH0nO1xuXHRcdFx0Y29udHJvbGxlci5pbnNlcnQoY29kZVNuaXBwZXQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRNb2RlbCgpIS5nZXRWYWx1ZSgpLCAnZm9yIChsZXQgaT0wOyBpPGxlbjsgaSsrKSB7ICB9Zm9yICh2YXIgaT0wOyBpPGxlbjsgaSsrKSB7ICB9Jyk7XG5cblx0XHR9LCBbJ2ZvciAodmFyIGk9MDsgaTxsZW47IGkrKykgeyAgfSddKTtcblxuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFJQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsK0NBQStDO0FBRXhELFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQTBCLDBCQUEwQjtBQUNwRCxTQUFTLHdDQUF3QztBQUNqRCxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGdDQUFnQztBQUV6QyxJQUFNLHdCQUFOLGNBQW9DLG1CQUFtQjtBQUFBLEVBSXRELFlBQ0MsUUFDcUMsb0JBQ3BDO0FBQ0QsVUFBTSxtQ0FBbUMsSUFBSSxpQ0FBaUM7QUFDOUUsVUFBTSxRQUFRLElBQUksZUFBZSxHQUFHLElBQUksd0JBQXdCLEdBQUcsb0JBQW9CLGdDQUFnQztBQUhsRjtBQUlyQyxTQUFLLG9DQUFvQztBQUFBLEVBQzFDO0FBQUEsRUFFUyxVQUFnQjtBQUN4QixVQUFNLFFBQVE7QUFDZCxTQUFLLGtDQUFrQyxRQUFRO0FBQUEsRUFDaEQ7QUFBQSxFQUVBLGtCQUEyQjtBQUMxQixXQUFPLG1CQUFtQixjQUFjLFNBQVMsS0FBSyxrQkFBa0I7QUFBQSxFQUN6RTtBQUNEO0FBckJNLHdCQUFOO0FBQUEsRUFNRztBQUFBLEdBTkc7QUF1Qk4sTUFBTSxxQkFBcUIsTUFBTTtBQUVoQywwQ0FBd0M7QUFFeEMsV0FBUyxZQUFZLElBQW1HLE9BQXdCO0FBRS9JLFFBQUksQ0FBQyxPQUFPO0FBQ1gsY0FBUTtBQUFBLFFBQ1A7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFFQSxVQUFNLG9CQUFvQixJQUFJO0FBQUEsTUFDN0IsQ0FBQyxlQUFlLElBQUksY0FBYyxLQUFvQixFQUFFO0FBQUEsTUFBRSxHQUFDO0FBQUEsTUFDM0QsQ0FBQywwQkFBMEIsSUFBSSxjQUFjLEtBQStCLEVBQUU7QUFBQSxNQUFFLEdBQUM7QUFBQSxJQUNsRjtBQUVBLHVCQUFtQixPQUFPLEVBQUUsa0JBQWtCLEdBQUcsQ0FBQyxXQUFXO0FBQzVELGFBQU8sU0FBUyxFQUFHLGNBQWM7QUFBQSxRQUNoQyxjQUFjO0FBQUEsTUFDZixDQUFDO0FBQ0QsWUFBTSxvQkFBb0IsT0FBTyxtQ0FBbUMsc0JBQXNCLElBQUkscUJBQXFCO0FBQ25ILFlBQU0sV0FBVztBQUFBLFFBQ2hCO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRCxFQUFFLEtBQUssSUFBSTtBQUVYLFNBQUcsUUFBUSxVQUFVLGlCQUFpQjtBQUN0Qyx3QkFBa0IsUUFBUTtBQUFBLElBQzNCLENBQUM7QUFBQSxFQUNGO0FBRUEsT0FBSyxtQkFBbUIsTUFBTTtBQUM3QixnQkFBWSxDQUFDLFFBQVEsVUFBVSxzQkFBc0I7QUFDcEQsYUFBTyxZQUFZLEVBQUUsWUFBWSxHQUFHLFFBQVEsRUFBRSxDQUFDO0FBRS9DLHdCQUFrQixPQUFPLFFBQVE7QUFDakMsYUFBTyxZQUFZLE9BQU8sU0FBUyxFQUFHLGVBQWUsQ0FBQyxHQUFHLG1EQUFvRDtBQUM3RyxhQUFPLFlBQVksT0FBTyxTQUFTLEVBQUcsZUFBZSxDQUFDLEdBQUcsK0JBQWlDO0FBQzFGLGFBQU8sWUFBWSxPQUFPLFNBQVMsRUFBRyxlQUFlLENBQUMsR0FBRyxJQUFNO0FBQy9ELGFBQU8sWUFBWSxPQUFPLFNBQVMsRUFBRyxlQUFlLENBQUMsR0FBRyxJQUFLO0FBRTlELGFBQU8sUUFBUSxRQUFRLFFBQVEsRUFBRSxNQUFNLElBQUksQ0FBQztBQUM1QyxhQUFPLFlBQVksT0FBTyxTQUFTLEVBQUcsZUFBZSxDQUFDLEdBQUcsdUNBQXdDO0FBQ2pHLGFBQU8sWUFBWSxPQUFPLFNBQVMsRUFBRyxlQUFlLENBQUMsR0FBRywyQkFBNkI7QUFDdEYsYUFBTyxZQUFZLE9BQU8sU0FBUyxFQUFHLGVBQWUsQ0FBQyxHQUFHLElBQU07QUFDL0QsYUFBTyxZQUFZLE9BQU8sU0FBUyxFQUFHLGVBQWUsQ0FBQyxHQUFHLElBQUs7QUFFOUQsd0JBQWtCLEtBQUs7QUFDdkIsYUFBTyxRQUFRLFFBQVEsUUFBUSxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBQzlDLGFBQU8sWUFBWSxPQUFPLFNBQVMsRUFBRyxlQUFlLENBQUMsR0FBRyxxQ0FBc0M7QUFDL0YsYUFBTyxZQUFZLE9BQU8sU0FBUyxFQUFHLGVBQWUsQ0FBQyxHQUFHLHlCQUEyQjtBQUNwRixhQUFPLFlBQVksT0FBTyxTQUFTLEVBQUcsZUFBZSxDQUFDLEdBQUcsSUFBTTtBQUMvRCxhQUFPLFlBQVksT0FBTyxTQUFTLEVBQUcsZUFBZSxDQUFDLEdBQUcsSUFBSztBQUU5RCx3QkFBa0IsS0FBSztBQUN2QixhQUFPLFFBQVEsUUFBUSxRQUFRLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFDNUMsYUFBTyxZQUFZLE9BQU8sU0FBUyxFQUFHLGVBQWUsQ0FBQyxHQUFHLHFDQUFzQztBQUMvRixhQUFPLFlBQVksT0FBTyxTQUFTLEVBQUcsZUFBZSxDQUFDLEdBQUcseUJBQTJCO0FBQ3BGLGFBQU8sWUFBWSxPQUFPLFNBQVMsRUFBRyxlQUFlLENBQUMsR0FBRyxJQUFNO0FBQy9ELGFBQU8sWUFBWSxPQUFPLFNBQVMsRUFBRyxlQUFlLENBQUMsR0FBRyxJQUFLO0FBRTlELHdCQUFrQixLQUFLO0FBQ3ZCLHdCQUFrQixLQUFLO0FBQ3ZCLGFBQU8sZ0JBQWdCLE9BQU8sWUFBWSxHQUFHLElBQUksU0FBUyxHQUFHLENBQUMsQ0FBQztBQUFBLElBQ2hFLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLG1CQUFtQixNQUFNO0FBQzdCLGdCQUFZLENBQUMsUUFBUSxVQUFVLHNCQUFzQjtBQUNwRCxhQUFPLFlBQVksRUFBRSxZQUFZLEdBQUcsUUFBUSxFQUFFLENBQUM7QUFFL0Msd0JBQWtCLE9BQU8sUUFBUTtBQUNqQyxhQUFPLFlBQVksT0FBTyxTQUFTLEVBQUcsZUFBZSxDQUFDLEdBQUcsbURBQW9EO0FBQzdHLGFBQU8sWUFBWSxPQUFPLFNBQVMsRUFBRyxlQUFlLENBQUMsR0FBRywrQkFBaUM7QUFDMUYsYUFBTyxZQUFZLE9BQU8sU0FBUyxFQUFHLGVBQWUsQ0FBQyxHQUFHLElBQU07QUFDL0QsYUFBTyxZQUFZLE9BQU8sU0FBUyxFQUFHLGVBQWUsQ0FBQyxHQUFHLElBQUs7QUFFOUQsd0JBQWtCLE9BQU87QUFDekIsYUFBTyxnQkFBZ0IsT0FBTyxZQUFZLEdBQUcsSUFBSSxTQUFTLEdBQUcsRUFBRSxDQUFDO0FBQUEsSUFDakUsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQXNFRCxPQUFLLHVDQUF1QyxNQUFNO0FBQ2pELGdCQUFZLENBQUMsUUFBUSxhQUFhLHNCQUFzQjtBQUN2RCxhQUFPLFlBQVksRUFBRSxZQUFZLEdBQUcsUUFBUSxFQUFFLENBQUM7QUFDL0Msd0JBQWtCLE9BQU8sV0FBVztBQUVwQyxhQUFPLFNBQVMsRUFBRyxTQUFTLFNBQVM7QUFFckMsYUFBTyxZQUFZLGtCQUFrQixnQkFBZ0IsR0FBRyxLQUFLO0FBQUEsSUFDOUQsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUssc0JBQXNCLE1BQU07QUFDaEMsZ0JBQVksQ0FBQyxRQUFRLGFBQWEsc0JBQXNCO0FBQ3ZELGFBQU8sWUFBWSxFQUFFLFlBQVksR0FBRyxRQUFRLEVBQUUsQ0FBQztBQUMvQyx3QkFBa0IsT0FBTyxXQUFXO0FBRXBDLGFBQU8sU0FBUyxFQUFHLEtBQUs7QUFFeEIsYUFBTyxZQUFZLGtCQUFrQixnQkFBZ0IsR0FBRyxLQUFLO0FBQUEsSUFDOUQsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUssb0NBQW9DLE1BQU07QUFDOUMsZ0JBQVksQ0FBQyxRQUFRLGFBQWEsc0JBQXNCO0FBQ3ZELGFBQU8sWUFBWSxFQUFFLFlBQVksR0FBRyxRQUFRLEVBQUUsQ0FBQztBQUMvQyx3QkFBa0IsT0FBTyxXQUFXO0FBRXBDLGFBQU8sWUFBWSxFQUFFLFlBQVksR0FBRyxRQUFRLEVBQUUsQ0FBQztBQUUvQyxhQUFPLFlBQVksa0JBQWtCLGdCQUFnQixHQUFHLEtBQUs7QUFBQSxJQUM5RCxDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSyx5Q0FBeUMsTUFBTTtBQUNuRCxnQkFBWSxDQUFDLFFBQVEsYUFBYSxzQkFBc0I7QUFDdkQsYUFBTyxZQUFZLEVBQUUsWUFBWSxHQUFHLFFBQVEsRUFBRSxDQUFDO0FBQy9DLHdCQUFrQixPQUFPLFdBQVc7QUFFcEMsYUFBTyxTQUFTLElBQUk7QUFFcEIsYUFBTyxZQUFZLGtCQUFrQixnQkFBZ0IsR0FBRyxLQUFLO0FBQUEsSUFDOUQsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUssK0JBQStCLE1BQU07QUFDekMsZ0JBQVksQ0FBQyxRQUFRLGFBQWEsc0JBQXNCO0FBQ3ZELGFBQU8sWUFBWSxFQUFFLFlBQVksR0FBRyxRQUFRLEVBQUUsQ0FBQztBQUMvQyx3QkFBa0IsT0FBTyxXQUFXO0FBRXBDLHdCQUFrQixRQUFRO0FBRTFCLGFBQU8sWUFBWSxrQkFBa0IsZ0JBQWdCLEdBQUcsS0FBSztBQUFBLElBQzlELENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLDBDQUEwQyxNQUFNO0FBQ3BELGdCQUFZLENBQUMsUUFBUSxhQUFhLHNCQUFzQjtBQUN2RCxhQUFPLGNBQWM7QUFBQSxRQUNwQixJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQ3hCLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsTUFDekIsQ0FBQztBQUVELG9CQUFjO0FBQ2Qsd0JBQWtCLE9BQU8sV0FBVztBQUVwQyxhQUFPLFlBQVksT0FBTyxjQUFjLEVBQUcsUUFBUSxDQUFDO0FBQ3BELFlBQU0sQ0FBQyxPQUFPLE1BQU0sSUFBSSxPQUFPLGNBQWM7QUFDN0MsYUFBTyxHQUFHLE1BQU0sWUFBWSxFQUFFLGlCQUFpQixHQUFHLGFBQWEsR0FBRyxlQUFlLEdBQUcsV0FBVyxFQUFFLENBQUMsR0FBRyxNQUFNLFNBQVMsQ0FBQztBQUNySCxhQUFPLEdBQUcsT0FBTyxZQUFZLEVBQUUsaUJBQWlCLEdBQUcsYUFBYSxHQUFHLGVBQWUsR0FBRyxXQUFXLEVBQUUsQ0FBQyxHQUFHLE9BQU8sU0FBUyxDQUFDO0FBQUEsSUFDeEgsQ0FBQztBQUVELGdCQUFZLENBQUMsUUFBUSxhQUFhLHNCQUFzQjtBQUN2RCxhQUFPLGNBQWM7QUFBQSxRQUNwQixJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQ3hCLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsTUFDekIsQ0FBQztBQUVELG9CQUFjO0FBQ2Qsd0JBQWtCLE9BQU8sV0FBVztBQUVwQyxhQUFPLFlBQVksT0FBTyxjQUFjLEVBQUcsUUFBUSxDQUFDO0FBQ3BELFlBQU0sQ0FBQyxPQUFPLE1BQU0sSUFBSSxPQUFPLGNBQWM7QUFDN0MsYUFBTyxHQUFHLE1BQU0sWUFBWSxFQUFFLGlCQUFpQixHQUFHLGFBQWEsR0FBRyxlQUFlLEdBQUcsV0FBVyxFQUFFLENBQUMsR0FBRyxNQUFNLFNBQVMsQ0FBQztBQUNySCxhQUFPLEdBQUcsT0FBTyxZQUFZLEVBQUUsaUJBQWlCLEdBQUcsYUFBYSxHQUFHLGVBQWUsR0FBRyxXQUFXLEVBQUUsQ0FBQyxHQUFHLE9BQU8sU0FBUyxDQUFDO0FBQUEsSUFDeEgsQ0FBQztBQUVELGdCQUFZLENBQUMsUUFBUSxhQUFhLHNCQUFzQjtBQUN2RCxhQUFPLGNBQWM7QUFBQSxRQUNwQixJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQ3hCLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsTUFDekIsQ0FBQztBQUVELG9CQUFjO0FBQ2Qsd0JBQWtCLE9BQU8sV0FBVztBQUVwQyxhQUFPLFlBQVksT0FBTyxjQUFjLEVBQUcsUUFBUSxDQUFDO0FBQ3BELFlBQU0sQ0FBQyxPQUFPLE1BQU0sSUFBSSxPQUFPLGNBQWM7QUFDN0MsYUFBTyxHQUFHLE1BQU0sWUFBWSxFQUFFLGlCQUFpQixHQUFHLGFBQWEsR0FBRyxlQUFlLEdBQUcsV0FBVyxFQUFFLENBQUMsR0FBRyxNQUFNLFNBQVMsQ0FBQztBQUNySCxhQUFPLEdBQUcsT0FBTyxZQUFZLEVBQUUsaUJBQWlCLEdBQUcsYUFBYSxJQUFJLGVBQWUsR0FBRyxXQUFXLEdBQUcsQ0FBQyxHQUFHLE9BQU8sU0FBUyxDQUFDO0FBQUEsSUFDMUgsQ0FBQztBQUVELGdCQUFZLENBQUMsUUFBUSxhQUFhLHNCQUFzQjtBQUN2RCxhQUFPLGNBQWM7QUFBQSxRQUNwQixJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQ3hCLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsTUFDekIsQ0FBQztBQUVELG9CQUFjO0FBQ2Qsd0JBQWtCLE9BQU8sV0FBVztBQUVwQyxhQUFPLFlBQVksT0FBTyxjQUFjLEVBQUcsUUFBUSxDQUFDO0FBQ3BELFlBQU0sQ0FBQyxPQUFPLE1BQU0sSUFBSSxPQUFPLGNBQWM7QUFDN0MsYUFBTyxHQUFHLE1BQU0sWUFBWSxFQUFFLGlCQUFpQixHQUFHLGFBQWEsR0FBRyxlQUFlLEdBQUcsV0FBVyxFQUFFLENBQUMsR0FBRyxNQUFNLFNBQVMsQ0FBQztBQUNySCxhQUFPLEdBQUcsT0FBTyxZQUFZLEVBQUUsaUJBQWlCLEdBQUcsYUFBYSxHQUFHLGVBQWUsR0FBRyxXQUFXLEVBQUUsQ0FBQyxHQUFHLE9BQU8sU0FBUyxDQUFDO0FBQUEsSUFDeEgsQ0FBQztBQUVELGdCQUFZLENBQUMsUUFBUSxhQUFhLHNCQUFzQjtBQUN2RCxhQUFPLGNBQWM7QUFBQSxRQUNwQixJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQ3hCLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsTUFDekIsQ0FBQztBQUVELG9CQUFjO0FBQ2Qsd0JBQWtCLE9BQU8sV0FBVztBQUVwQyxhQUFPLFlBQVksT0FBTyxjQUFjLEVBQUcsUUFBUSxDQUFDO0FBQ3BELFlBQU0sQ0FBQyxPQUFPLE1BQU0sSUFBSSxPQUFPLGNBQWM7QUFDN0MsYUFBTyxHQUFHLE1BQU0sWUFBWSxFQUFFLGlCQUFpQixHQUFHLGFBQWEsR0FBRyxlQUFlLEdBQUcsV0FBVyxFQUFFLENBQUMsR0FBRyxNQUFNLFNBQVMsQ0FBQztBQUNySCxhQUFPLEdBQUcsT0FBTyxZQUFZLEVBQUUsaUJBQWlCLEdBQUcsYUFBYSxHQUFHLGVBQWUsR0FBRyxXQUFXLEVBQUUsQ0FBQyxHQUFHLE9BQU8sU0FBUyxDQUFDO0FBQUEsSUFDeEgsQ0FBQztBQUVELGdCQUFZLENBQUMsUUFBUSxhQUFhLHNCQUFzQjtBQUN2RCxhQUFPLGNBQWM7QUFBQSxRQUNwQixJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQ3pCLENBQUM7QUFFRCxvQkFBYztBQUNkLHdCQUFrQixPQUFPLGFBQWEsRUFBRSxpQkFBaUIsRUFBRSxDQUFDO0FBRTVELGFBQU8sWUFBWSxPQUFPLGNBQWMsRUFBRyxRQUFRLENBQUM7QUFDcEQsYUFBTyxHQUFHLE9BQU8sYUFBYSxFQUFHLFlBQVksRUFBRSxpQkFBaUIsR0FBRyxhQUFhLEdBQUcsV0FBVyxHQUFHLGVBQWUsRUFBRSxDQUFDLENBQUM7QUFBQSxJQUNySCxDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSyxnQ0FBZ0MsTUFBTTtBQUMxQyxnQkFBWSxDQUFDLFFBQVEsYUFBYSxlQUFlO0FBRWhELGFBQU8sYUFBYSxJQUFJLFVBQVUsR0FBRyxJQUFJLEdBQUcsRUFBRSxDQUFDO0FBRS9DLG9CQUFjO0FBQ2QsaUJBQVcsT0FBTyxhQUFhLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQztBQUVyRCxhQUFPLFlBQVksT0FBTyxjQUFjLEVBQUcsUUFBUSxDQUFDO0FBQ3BELGFBQU8sR0FBRyxPQUFPLGFBQWEsRUFBRyxZQUFZLEVBQUUsaUJBQWlCLEdBQUcsYUFBYSxJQUFJLGVBQWUsR0FBRyxXQUFXLEdBQUcsQ0FBQyxDQUFDO0FBQ3RILGFBQU8sWUFBWSxPQUFPLFNBQVMsRUFBRyxTQUFTLEdBQUcsa0NBQWtDO0FBQUEsSUFFckYsR0FBRyxDQUFDLG9CQUFvQixDQUFDO0FBRXpCLGdCQUFZLENBQUMsUUFBUSxhQUFhLGVBQWU7QUFFaEQsYUFBTyxhQUFhLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFFN0Msb0JBQWM7QUFBQSxRQUNiO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNELEVBQUUsS0FBSyxJQUFJO0FBRVgsaUJBQVcsT0FBTyxhQUFhLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQztBQUVyRCxhQUFPLFlBQVksT0FBTyxjQUFjLEVBQUcsUUFBUSxDQUFDO0FBQ3BELGFBQU8sR0FBRyxPQUFPLGFBQWEsRUFBRyxZQUFZLEVBQUUsaUJBQWlCLEdBQUcsYUFBYSxHQUFHLGVBQWUsR0FBRyxXQUFXLEVBQUUsQ0FBQyxHQUFHLE9BQU8sYUFBYSxFQUFHLFNBQVMsQ0FBQztBQUN2SixhQUFPLFlBQVksT0FBTyxTQUFTLEVBQUcsU0FBUyxHQUFHLG1DQUFvQztBQUFBLElBRXZGLEdBQUcsQ0FBQyxJQUFJLENBQUM7QUFFVCxnQkFBWSxDQUFDLFFBQVEsYUFBYSxlQUFlO0FBRWhELGFBQU8sYUFBYSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBRTdDLG9CQUFjO0FBQUEsUUFDYjtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRCxFQUFFLEtBQUssSUFBSTtBQUVYLGlCQUFXLE9BQU8sYUFBYSxFQUFFLGlCQUFpQixFQUFFLENBQUM7QUFFckQsYUFBTyxZQUFZLE9BQU8sY0FBYyxFQUFHLFFBQVEsQ0FBQztBQUNwRCxhQUFPLEdBQUcsT0FBTyxhQUFhLEVBQUcsWUFBWSxFQUFFLGlCQUFpQixHQUFHLGFBQWEsR0FBRyxlQUFlLEdBQUcsV0FBVyxFQUFFLENBQUMsR0FBRyxPQUFPLGFBQWEsRUFBRyxTQUFTLENBQUM7QUFDdkosYUFBTyxZQUFZLE9BQU8sU0FBUyxFQUFHLFNBQVMsR0FBRyxtQ0FBb0M7QUFBQSxJQUV2RixHQUFHLENBQUMsSUFBSSxDQUFDO0FBRVQsZ0JBQVksQ0FBQyxRQUFRLGFBQWEsZUFBZTtBQUVoRCxhQUFPLGFBQWEsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUU3QyxvQkFBYztBQUFBLFFBQ2I7QUFBQSxNQUNELEVBQUUsS0FBSyxJQUFJO0FBRVgsaUJBQVcsT0FBTyxhQUFhLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQztBQUVyRCxhQUFPLFlBQVksT0FBTyxTQUFTLEVBQUcsU0FBUyxHQUFHLE9BQU87QUFDekQsYUFBTyxZQUFZLE9BQU8sY0FBYyxFQUFHLFFBQVEsQ0FBQztBQUNwRCxhQUFPLEdBQUcsT0FBTyxhQUFhLEVBQUcsWUFBWSxFQUFFLGlCQUFpQixHQUFHLGFBQWEsR0FBRyxlQUFlLEdBQUcsV0FBVyxFQUFFLENBQUMsR0FBRyxPQUFPLGFBQWEsRUFBRyxTQUFTLENBQUM7QUFBQSxJQUV4SixHQUFHLENBQUMsVUFBVSxDQUFDO0FBQUEsRUFDaEIsQ0FBQztBQUVELE9BQUssMkNBQTJDLE1BQU07QUFFckQsZ0JBQVksQ0FBQyxRQUFRLGFBQWEsZUFBZTtBQUVoRCxhQUFPLGNBQWM7QUFBQSxRQUNwQixJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQ3hCLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsTUFDekIsQ0FBQztBQUVELG9CQUFjO0FBQUEsUUFDYjtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRCxFQUFFLEtBQUssSUFBSTtBQUVYLGlCQUFXLE9BQU8sYUFBYSxFQUFFLGlCQUFpQixFQUFFLENBQUM7QUFFckQsYUFBTyxZQUFZLE9BQU8sY0FBYyxFQUFHLFFBQVEsQ0FBQztBQUNwRCxZQUFNLENBQUMsT0FBTyxNQUFNLElBQUksT0FBTyxjQUFjO0FBRTdDLGFBQU8sR0FBRyxNQUFNLFlBQVksRUFBRSxpQkFBaUIsR0FBRyxhQUFhLEdBQUcsZUFBZSxHQUFHLFdBQVcsRUFBRSxDQUFDLEdBQUcsTUFBTSxTQUFTLENBQUM7QUFDckgsYUFBTyxHQUFHLE9BQU8sWUFBWSxFQUFFLGlCQUFpQixHQUFHLGFBQWEsR0FBRyxlQUFlLEdBQUcsV0FBVyxFQUFFLENBQUMsR0FBRyxPQUFPLFNBQVMsQ0FBQztBQUFBLElBRXhILEdBQUcsQ0FBQyxNQUFNLEtBQU0sQ0FBQztBQUFBLEVBQ2xCLENBQUM7QUFFRCxPQUFLLCtDQUErQyxNQUFNO0FBRXpELGdCQUFZLENBQUMsUUFBUSxhQUFhLGVBQWU7QUFFaEQsYUFBTyxjQUFjO0FBQUEsUUFDcEIsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxNQUN6QixDQUFDO0FBRUQsb0JBQWM7QUFBQSxRQUNiO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNELEVBQUUsS0FBSyxJQUFJO0FBRVgsaUJBQVcsT0FBTyxhQUFhLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQztBQUVyRCxhQUFPLFlBQVksT0FBTyxjQUFjLEVBQUcsUUFBUSxDQUFDO0FBQ3BELFlBQU0sQ0FBQyxLQUFLLElBQUksT0FBTyxjQUFjO0FBRXJDLGFBQU8sR0FBRyxNQUFNLFlBQVksRUFBRSxpQkFBaUIsR0FBRyxhQUFhLEdBQUcsZUFBZSxHQUFHLFdBQVcsRUFBRSxDQUFDLEdBQUcsTUFBTSxTQUFTLENBQUM7QUFBQSxJQUV0SCxHQUFHLENBQUMsTUFBTSxDQUFDO0FBQUEsRUFDWixDQUFDO0FBRUQsT0FBSyw2QkFBNkIsTUFBTTtBQUV2QyxnQkFBWSxDQUFDLFFBQVEsYUFBYSxlQUFlO0FBRWhELGFBQU8sY0FBYztBQUFBLFFBQ3BCLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsTUFDekIsQ0FBQztBQUVELG9CQUFjO0FBRWQsaUJBQVcsT0FBTyxhQUFhLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQztBQUVyRCxhQUFPLEdBQUcsT0FBTyxhQUFhLEVBQUcsWUFBWSxFQUFFLGlCQUFpQixHQUFHLGFBQWEsSUFBSSxlQUFlLEdBQUcsV0FBVyxHQUFHLENBQUMsQ0FBQztBQUFBLElBRXZILEdBQUcsQ0FBQyxNQUFNLEtBQU0sQ0FBQztBQUFBLEVBQ2xCLENBQUM7QUFFRCxPQUFLLDJEQUEyRCxNQUFNO0FBRXJFLGdCQUFZLENBQUMsUUFBUSxhQUFhLGVBQWU7QUFFaEQsYUFBTyxjQUFjO0FBQUEsUUFDcEIsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUN4QixJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQ3pCLENBQUM7QUFFRCxvQkFBYztBQUNkLGlCQUFXLE9BQU8sYUFBYSxFQUFFLGlCQUFpQixFQUFFLENBQUM7QUFDckQsYUFBTyxZQUFZLE9BQU8sU0FBUyxFQUFHLFNBQVMsR0FBRyxvQkFBb0I7QUFBQSxJQUV2RSxHQUFHLENBQUMsVUFBVSxLQUFLLENBQUM7QUFFcEIsZ0JBQVksQ0FBQyxRQUFRLGFBQWEsZUFBZTtBQUVoRCxhQUFPLGNBQWM7QUFBQSxRQUNwQixJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQ3hCLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsTUFDekIsQ0FBQztBQUVELG9CQUFjO0FBQ2QsaUJBQVcsT0FBTyxhQUFhLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQztBQUNyRCxhQUFPLFlBQVksT0FBTyxTQUFTLEVBQUcsU0FBUyxHQUFHLGdCQUFnQjtBQUFBLElBRW5FLEdBQUcsQ0FBQyxVQUFVLEtBQUssQ0FBQztBQUVwQixnQkFBWSxDQUFDLFFBQVEsYUFBYSxlQUFlO0FBRWhELGFBQU8sY0FBYztBQUFBLFFBQ3BCLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFDeEIsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUN4QixJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQ3pCLENBQUM7QUFFRCxvQkFBYztBQUNkLGlCQUFXLE9BQU8sYUFBYSxFQUFFLGlCQUFpQixFQUFFLENBQUM7QUFDckQsYUFBTyxZQUFZLE9BQU8sU0FBUyxFQUFHLFNBQVMsR0FBRyw2QkFBNkI7QUFBQSxJQUVoRixHQUFHLENBQUMsVUFBVSxPQUFPLE1BQU0sQ0FBQztBQUU1QixnQkFBWSxDQUFDLFFBQVEsYUFBYSxlQUFlO0FBRWhELGFBQU8sY0FBYztBQUFBLFFBQ3BCLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUE7QUFBQSxRQUN4QixJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQ3hCLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsTUFDekIsQ0FBQztBQUVELG9CQUFjO0FBQ2QsaUJBQVcsT0FBTyxhQUFhLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQztBQUNyRCxhQUFPLFlBQVksT0FBTyxTQUFTLEVBQUcsU0FBUyxHQUFHLCtCQUErQjtBQUFBLElBRWxGLEdBQUcsQ0FBQyxVQUFVLE9BQU8sT0FBTyxDQUFDO0FBRTdCLGdCQUFZLENBQUMsUUFBUSxhQUFhLGVBQWU7QUFFaEQsYUFBTyxjQUFjO0FBQUEsUUFDcEIsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQTtBQUFBLFFBQ3hCLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFDeEIsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxNQUN6QixDQUFDO0FBRUQsb0JBQWM7QUFDZCxpQkFBVyxPQUFPLGFBQWEsRUFBRSxpQkFBaUIsRUFBRSxDQUFDO0FBQ3JELGFBQU8sWUFBWSxPQUFPLFNBQVMsRUFBRyxTQUFTLEdBQUcsK0JBQStCO0FBQUEsSUFFbEYsR0FBRyxDQUFDLFVBQVUsT0FBTyxPQUFPLENBQUM7QUFFN0IsZ0JBQVksQ0FBQyxRQUFRLGFBQWEsZUFBZTtBQUVoRCxhQUFPLGNBQWM7QUFBQSxRQUNwQixJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBO0FBQUEsUUFDeEIsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUN4QixJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQ3pCLENBQUM7QUFFRCxvQkFBYztBQUNkLGlCQUFXLE9BQU8sYUFBYSxFQUFFLGlCQUFpQixFQUFFLENBQUM7QUFDckQsYUFBTyxZQUFZLE9BQU8sU0FBUyxFQUFHLFNBQVMsR0FBRyxpQ0FBaUM7QUFBQSxJQUVwRixHQUFHLENBQUMsVUFBVSxPQUFPLE9BQU8sQ0FBQztBQUFBLEVBRTlCLENBQUM7QUFFRCxPQUFLLHFEQUFxRCxNQUFNO0FBQy9ELGdCQUFZLENBQUMsUUFBUSxhQUFhLGVBQWU7QUFFaEQsYUFBTyxjQUFjO0FBQUEsUUFDcEIsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUN4QixJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQ3pCLENBQUM7QUFFRCxvQkFBYztBQUNkLGlCQUFXLE9BQU8sYUFBYSxFQUFFLGlCQUFpQixFQUFFLENBQUM7QUFDckQsYUFBTyxZQUFZLE9BQU8sU0FBUyxFQUFHLFNBQVMsR0FBRyxnQ0FBZ0M7QUFBQSxJQUVuRixHQUFHLENBQUMsU0FBUyxlQUFlLENBQUM7QUFBQSxFQUM5QixDQUFDO0FBRUQsT0FBSyxnQ0FBZ0MsTUFBTTtBQUUxQyxnQkFBWSxDQUFDLFFBQVEsYUFBYSxlQUFlO0FBRWhELGFBQU8sY0FBYztBQUFBLFFBQ3BCLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsTUFDekIsQ0FBQztBQUVELG9CQUFjO0FBQ2QsaUJBQVcsT0FBTyxXQUFXO0FBQzdCLGFBQU8sWUFBWSxPQUFPLFNBQVMsRUFBRyxTQUFTLEdBQUcsOERBQThEO0FBQUEsSUFFakgsR0FBRyxDQUFDLGdDQUFnQyxDQUFDO0FBR3JDLGdCQUFZLENBQUMsUUFBUSxhQUFhLGVBQWU7QUFFaEQsYUFBTyxjQUFjO0FBQUEsUUFDcEIsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxNQUN6QixDQUFDO0FBRUQsb0JBQWM7QUFDZCxpQkFBVyxPQUFPLFdBQVc7QUFDN0IsYUFBTyxZQUFZLE9BQU8sU0FBUyxFQUFHLFNBQVMsR0FBRyw4REFBOEQ7QUFBQSxJQUVqSCxHQUFHLENBQUMsZ0NBQWdDLENBQUM7QUFBQSxFQUV0QyxDQUFDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
