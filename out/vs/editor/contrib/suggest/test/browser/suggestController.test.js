import assert from "assert";
import { timeout } from "../../../../../base/common/async.js";
import { Event } from "../../../../../base/common/event.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { URI } from "../../../../../base/common/uri.js";
import { mock } from "../../../../../base/test/common/mock.js";
import { Range } from "../../../../common/core/range.js";
import { Selection } from "../../../../common/core/selection.js";
import { CompletionItemInsertTextRule, CompletionItemKind } from "../../../../common/languages.js";
import { IEditorWorkerService } from "../../../../common/services/editorWorker.js";
import { SnippetController2 } from "../../../snippet/browser/snippetController2.js";
import { SuggestController } from "../../browser/suggestController.js";
import { ISuggestMemoryService } from "../../browser/suggestMemory.js";
import { createTestCodeEditor } from "../../../../test/browser/testCodeEditor.js";
import { createTextModel } from "../../../../test/common/testTextModel.js";
import { IMenuService } from "../../../../../platform/actions/common/actions.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { MockKeybindingService } from "../../../../../platform/keybinding/test/common/mockKeybindingService.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { ILogService, NullLogService } from "../../../../../platform/log/common/log.js";
import { InMemoryStorageService, IStorageService } from "../../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { NullTelemetryService } from "../../../../../platform/telemetry/common/telemetryUtils.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { LanguageFeaturesService } from "../../../../common/services/languageFeaturesService.js";
import { ILanguageFeaturesService } from "../../../../common/services/languageFeatures.js";
import { IEnvironmentService } from "../../../../../platform/environment/common/environment.js";
import { DeleteLinesAction } from "../../../linesOperations/browser/linesOperations.js";
suite("SuggestController", function() {
  const disposables = new DisposableStore();
  let controller;
  let editor;
  let model;
  const languageFeaturesService = new LanguageFeaturesService();
  teardown(function() {
    disposables.clear();
  });
  setup(function() {
    const serviceCollection = new ServiceCollection(
      [ILanguageFeaturesService, languageFeaturesService],
      [ITelemetryService, NullTelemetryService],
      [ILogService, new NullLogService()],
      [IStorageService, disposables.add(new InMemoryStorageService())],
      [IKeybindingService, new MockKeybindingService()],
      [IEditorWorkerService, new class extends mock() {
        computeWordRanges() {
          return Promise.resolve({});
        }
      }()],
      [ISuggestMemoryService, new class extends mock() {
        memorize() {
        }
        select() {
          return 0;
        }
      }()],
      [IMenuService, new class extends mock() {
        createMenu() {
          return new class extends mock() {
            constructor() {
              super(...arguments);
              this.onDidChange = Event.None;
            }
            dispose() {
            }
          }();
        }
      }()],
      [ILabelService, new class extends mock() {
      }()],
      [IWorkspaceContextService, new class extends mock() {
      }()],
      [IEnvironmentService, new class extends mock() {
        constructor() {
          super(...arguments);
          this.isBuilt = true;
          this.isExtensionDevelopment = false;
        }
      }()]
    );
    model = disposables.add(createTextModel("", void 0, void 0, URI.from({ scheme: "test-ctrl", path: "/path.tst" })));
    editor = disposables.add(createTestCodeEditor(model, { serviceCollection }));
    editor.registerAndInstantiateContribution(SnippetController2.ID, SnippetController2);
    controller = editor.registerAndInstantiateContribution(SuggestController.ID, SuggestController);
  });
  test("postfix completion reports incorrect position #86984", async function() {
    disposables.add(languageFeaturesService.completionProvider.register({ scheme: "test-ctrl" }, {
      _debugDisplayName: "test",
      provideCompletionItems(doc, pos) {
        return {
          suggestions: [{
            kind: CompletionItemKind.Snippet,
            label: "let",
            insertText: "let ${1:name} = foo$0",
            insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
            range: { startLineNumber: 1, startColumn: 9, endLineNumber: 1, endColumn: 11 },
            additionalTextEdits: [{
              text: "",
              range: { startLineNumber: 1, startColumn: 5, endLineNumber: 1, endColumn: 9 }
            }]
          }]
        };
      }
    }));
    editor.setValue("    foo.le");
    editor.setSelection(new Selection(1, 11, 1, 11));
    const p1 = Event.toPromise(controller.model.onDidSuggest);
    controller.triggerSuggest();
    await p1;
    const p2 = Event.toPromise(controller.model.onDidCancel);
    controller.acceptSelectedSuggestion(false, false);
    await p2;
    assert.strictEqual(editor.getValue(), "    let name = foo");
  });
  test("use additionalTextEdits sync when possible", async function() {
    disposables.add(languageFeaturesService.completionProvider.register({ scheme: "test-ctrl" }, {
      _debugDisplayName: "test",
      provideCompletionItems(doc, pos) {
        return {
          suggestions: [{
            kind: CompletionItemKind.Snippet,
            label: "let",
            insertText: "hello",
            range: Range.fromPositions(pos),
            additionalTextEdits: [{
              text: "I came sync",
              range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 }
            }]
          }]
        };
      },
      async resolveCompletionItem(item) {
        return item;
      }
    }));
    editor.setValue("hello\nhallo");
    editor.setSelection(new Selection(2, 6, 2, 6));
    const p1 = Event.toPromise(controller.model.onDidSuggest);
    controller.triggerSuggest();
    await p1;
    const p2 = Event.toPromise(controller.model.onDidCancel);
    controller.acceptSelectedSuggestion(false, false);
    await p2;
    assert.strictEqual(editor.getValue(), "I came synchello\nhallohello");
  });
  test("resolve additionalTextEdits async when needed", async function() {
    let resolveCallCount = 0;
    disposables.add(languageFeaturesService.completionProvider.register({ scheme: "test-ctrl" }, {
      _debugDisplayName: "test",
      provideCompletionItems(doc, pos) {
        return {
          suggestions: [{
            kind: CompletionItemKind.Snippet,
            label: "let",
            insertText: "hello",
            range: Range.fromPositions(pos)
          }]
        };
      },
      async resolveCompletionItem(item) {
        resolveCallCount += 1;
        await timeout(10);
        item.additionalTextEdits = [{
          text: "I came late",
          range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 }
        }];
        return item;
      }
    }));
    editor.setValue("hello\nhallo");
    editor.setSelection(new Selection(2, 6, 2, 6));
    const p1 = Event.toPromise(controller.model.onDidSuggest);
    controller.triggerSuggest();
    await p1;
    const p2 = Event.toPromise(controller.model.onDidCancel);
    controller.acceptSelectedSuggestion(false, false);
    await p2;
    assert.strictEqual(editor.getValue(), "hello\nhallohello");
    assert.strictEqual(resolveCallCount, 1);
    await timeout(20);
    assert.strictEqual(editor.getValue(), "I came latehello\nhallohello");
    editor.getModel()?.undo();
    assert.strictEqual(editor.getValue(), "hello\nhallo");
  });
  test("resolve additionalTextEdits async when needed (typing)", async function() {
    let resolveCallCount = 0;
    let resolve = () => {
    };
    disposables.add(languageFeaturesService.completionProvider.register({ scheme: "test-ctrl" }, {
      _debugDisplayName: "test",
      provideCompletionItems(doc, pos) {
        return {
          suggestions: [{
            kind: CompletionItemKind.Snippet,
            label: "let",
            insertText: "hello",
            range: Range.fromPositions(pos)
          }]
        };
      },
      async resolveCompletionItem(item) {
        resolveCallCount += 1;
        await new Promise((_resolve) => resolve = _resolve);
        item.additionalTextEdits = [{
          text: "I came late",
          range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 }
        }];
        return item;
      }
    }));
    editor.setValue("hello\nhallo");
    editor.setSelection(new Selection(2, 6, 2, 6));
    const p1 = Event.toPromise(controller.model.onDidSuggest);
    controller.triggerSuggest();
    await p1;
    const p2 = Event.toPromise(controller.model.onDidCancel);
    controller.acceptSelectedSuggestion(false, false);
    await p2;
    assert.strictEqual(editor.getValue(), "hello\nhallohello");
    assert.strictEqual(resolveCallCount, 1);
    assert.ok(editor.getSelection()?.equalsSelection(new Selection(2, 11, 2, 11)));
    editor.trigger("test", "type", { text: "TYPING" });
    assert.strictEqual(editor.getValue(), "hello\nhallohelloTYPING");
    resolve();
    await timeout(10);
    assert.strictEqual(editor.getValue(), "I came latehello\nhallohelloTYPING");
    assert.ok(editor.getSelection()?.equalsSelection(new Selection(2, 17, 2, 17)));
  });
  test("resolve additionalTextEdits async when needed (simple conflict)", async function() {
    let resolveCallCount = 0;
    let resolve = () => {
    };
    disposables.add(languageFeaturesService.completionProvider.register({ scheme: "test-ctrl" }, {
      _debugDisplayName: "test",
      provideCompletionItems(doc, pos) {
        return {
          suggestions: [{
            kind: CompletionItemKind.Snippet,
            label: "let",
            insertText: "hello",
            range: Range.fromPositions(pos)
          }]
        };
      },
      async resolveCompletionItem(item) {
        resolveCallCount += 1;
        await new Promise((_resolve) => resolve = _resolve);
        item.additionalTextEdits = [{
          text: "I came late",
          range: { startLineNumber: 1, startColumn: 6, endLineNumber: 1, endColumn: 6 }
        }];
        return item;
      }
    }));
    editor.setValue("");
    editor.setSelection(new Selection(1, 1, 1, 1));
    const p1 = Event.toPromise(controller.model.onDidSuggest);
    controller.triggerSuggest();
    await p1;
    const p2 = Event.toPromise(controller.model.onDidCancel);
    controller.acceptSelectedSuggestion(false, false);
    await p2;
    assert.strictEqual(editor.getValue(), "hello");
    assert.strictEqual(resolveCallCount, 1);
    resolve();
    await timeout(10);
    assert.strictEqual(editor.getValue(), "hello");
  });
  test("resolve additionalTextEdits async when needed (conflict)", async function() {
    let resolveCallCount = 0;
    let resolve = () => {
    };
    disposables.add(languageFeaturesService.completionProvider.register({ scheme: "test-ctrl" }, {
      _debugDisplayName: "test",
      provideCompletionItems(doc, pos) {
        return {
          suggestions: [{
            kind: CompletionItemKind.Snippet,
            label: "let",
            insertText: "hello",
            range: Range.fromPositions(pos)
          }]
        };
      },
      async resolveCompletionItem(item) {
        resolveCallCount += 1;
        await new Promise((_resolve) => resolve = _resolve);
        item.additionalTextEdits = [{
          text: "I came late",
          range: { startLineNumber: 1, startColumn: 2, endLineNumber: 1, endColumn: 2 }
        }];
        return item;
      }
    }));
    editor.setValue("hello\nhallo");
    editor.setSelection(new Selection(2, 6, 2, 6));
    const p1 = Event.toPromise(controller.model.onDidSuggest);
    controller.triggerSuggest();
    await p1;
    const p2 = Event.toPromise(controller.model.onDidCancel);
    controller.acceptSelectedSuggestion(false, false);
    await p2;
    assert.strictEqual(editor.getValue(), "hello\nhallohello");
    assert.strictEqual(resolveCallCount, 1);
    editor.setSelection(new Selection(1, 1, 1, 1));
    editor.trigger("test", "type", { text: "TYPING" });
    assert.strictEqual(editor.getValue(), "TYPINGhello\nhallohello");
    resolve();
    await timeout(10);
    assert.strictEqual(editor.getValue(), "TYPINGhello\nhallohello");
    assert.ok(editor.getSelection()?.equalsSelection(new Selection(1, 7, 1, 7)));
  });
  test("resolve additionalTextEdits async when needed (cancel)", async function() {
    const resolve = [];
    disposables.add(languageFeaturesService.completionProvider.register({ scheme: "test-ctrl" }, {
      _debugDisplayName: "test",
      provideCompletionItems(doc, pos) {
        return {
          suggestions: [{
            kind: CompletionItemKind.Snippet,
            label: "let",
            insertText: "hello",
            range: Range.fromPositions(pos)
          }, {
            kind: CompletionItemKind.Snippet,
            label: "let",
            insertText: "hallo",
            range: Range.fromPositions(pos)
          }]
        };
      },
      async resolveCompletionItem(item) {
        await new Promise((_resolve) => resolve.push(_resolve));
        item.additionalTextEdits = [{
          text: "additionalTextEdits",
          range: { startLineNumber: 1, startColumn: 2, endLineNumber: 1, endColumn: 2 }
        }];
        return item;
      }
    }));
    editor.setValue("abc");
    editor.setSelection(new Selection(1, 1, 1, 1));
    const p1 = Event.toPromise(controller.model.onDidSuggest);
    controller.triggerSuggest();
    await p1;
    const p2 = Event.toPromise(controller.model.onDidCancel);
    controller.acceptSelectedSuggestion(true, false);
    await p2;
    assert.strictEqual(editor.getValue(), "helloabc");
    controller.acceptNextSuggestion();
    resolve.forEach((fn) => fn);
    resolve.length = 0;
    await timeout(10);
    assert.strictEqual(editor.getValue(), "halloabc");
  });
  test("Completion edits are applied inconsistently when additionalTextEdits and textEdit start at the same offset #143888", async function() {
    disposables.add(languageFeaturesService.completionProvider.register({ scheme: "test-ctrl" }, {
      _debugDisplayName: "test",
      provideCompletionItems(doc, pos) {
        return {
          suggestions: [{
            kind: CompletionItemKind.Text,
            label: "MyClassName",
            insertText: "MyClassName",
            range: Range.fromPositions(pos),
            additionalTextEdits: [{
              range: Range.fromPositions(pos),
              text: 'import "my_class.txt";\n'
            }]
          }]
        };
      }
    }));
    editor.setValue("");
    editor.setSelection(new Selection(1, 1, 1, 1));
    const p1 = Event.toPromise(controller.model.onDidSuggest);
    controller.triggerSuggest();
    await p1;
    const p2 = Event.toPromise(controller.model.onDidCancel);
    controller.acceptSelectedSuggestion(true, false);
    await p2;
    assert.strictEqual(editor.getValue(), 'import "my_class.txt";\nMyClassName');
  });
  test("Pressing enter on autocomplete should always apply the selected dropdown completion, not a different, hidden one #161883", async function() {
    disposables.add(languageFeaturesService.completionProvider.register({ scheme: "test-ctrl" }, {
      _debugDisplayName: "test",
      provideCompletionItems(doc, pos) {
        const word = doc.getWordUntilPosition(pos);
        const range = new Range(pos.lineNumber, word.startColumn, pos.lineNumber, word.endColumn);
        return {
          suggestions: [{
            kind: CompletionItemKind.Text,
            label: "filterBankSize",
            insertText: "filterBankSize",
            sortText: "a",
            range
          }, {
            kind: CompletionItemKind.Text,
            label: "filter",
            insertText: "filter",
            sortText: "b",
            range
          }]
        };
      }
    }));
    editor.setValue("filte");
    editor.setSelection(new Selection(1, 6, 1, 6));
    const p1 = Event.toPromise(controller.model.onDidSuggest);
    controller.triggerSuggest();
    const { completionModel } = await p1;
    assert.strictEqual(completionModel.items.length, 2);
    const [first, second] = completionModel.items;
    assert.strictEqual(first.textLabel, "filterBankSize");
    assert.strictEqual(second.textLabel, "filter");
    assert.deepStrictEqual(editor.getSelection(), new Selection(1, 6, 1, 6));
    editor.trigger("keyboard", "type", { text: "r" });
    assert.deepStrictEqual(editor.getSelection(), new Selection(1, 7, 1, 7));
    controller.acceptSelectedSuggestion(false, false);
    assert.strictEqual(editor.getValue(), "filter");
  });
  test("Fast autocomple typing selects the previous autocomplete suggestion, #71795", async function() {
    disposables.add(languageFeaturesService.completionProvider.register({ scheme: "test-ctrl" }, {
      _debugDisplayName: "test",
      provideCompletionItems(doc, pos) {
        const word = doc.getWordUntilPosition(pos);
        const range = new Range(pos.lineNumber, word.startColumn, pos.lineNumber, word.endColumn);
        return {
          suggestions: [{
            kind: CompletionItemKind.Text,
            label: "false",
            insertText: "false",
            range
          }, {
            kind: CompletionItemKind.Text,
            label: "float",
            insertText: "float",
            range
          }, {
            kind: CompletionItemKind.Text,
            label: "for",
            insertText: "for",
            range
          }, {
            kind: CompletionItemKind.Text,
            label: "foreach",
            insertText: "foreach",
            range
          }]
        };
      }
    }));
    editor.setValue("f");
    editor.setSelection(new Selection(1, 2, 1, 2));
    const p1 = Event.toPromise(controller.model.onDidSuggest);
    controller.triggerSuggest();
    const { completionModel } = await p1;
    assert.strictEqual(completionModel.items.length, 4);
    const [first, second, third, fourth] = completionModel.items;
    assert.strictEqual(first.textLabel, "false");
    assert.strictEqual(second.textLabel, "float");
    assert.strictEqual(third.textLabel, "for");
    assert.strictEqual(fourth.textLabel, "foreach");
    assert.deepStrictEqual(editor.getSelection(), new Selection(1, 2, 1, 2));
    editor.trigger("keyboard", "type", { text: "o" });
    assert.deepStrictEqual(editor.getSelection(), new Selection(1, 3, 1, 3));
    controller.acceptSelectedSuggestion(false, false);
    assert.strictEqual(editor.getValue(), "for");
  });
  test.skip("Suggest widget gets orphaned in editor #187779", async function() {
    disposables.add(languageFeaturesService.completionProvider.register({ scheme: "test-ctrl" }, {
      _debugDisplayName: "test",
      provideCompletionItems(doc, pos) {
        const word = doc.getLineContent(pos.lineNumber);
        const range = new Range(pos.lineNumber, 1, pos.lineNumber, pos.column);
        return {
          suggestions: [{
            kind: CompletionItemKind.Text,
            label: word,
            insertText: word,
            range
          }]
        };
      }
    }));
    editor.setValue(`console.log(example.)
console.log(EXAMPLE.not)`);
    editor.setSelection(new Selection(1, 21, 1, 21));
    const p1 = Event.toPromise(controller.model.onDidSuggest);
    controller.triggerSuggest();
    await p1;
    const p2 = Event.toPromise(controller.model.onDidCancel);
    new DeleteLinesAction().run(null, editor);
    await p2;
  });
  test("Ranges where additionalTextEdits are applied are not appropriate when characters are typed #177591", async function() {
    disposables.add(languageFeaturesService.completionProvider.register({ scheme: "test-ctrl" }, {
      _debugDisplayName: "test",
      provideCompletionItems(doc, pos) {
        return {
          suggestions: [{
            kind: CompletionItemKind.Snippet,
            label: "aaa",
            insertText: "aaa",
            range: Range.fromPositions(pos),
            additionalTextEdits: [{
              range: Range.fromPositions(pos.delta(0, 10)),
              text: "aaa"
            }]
          }]
        };
      }
    }));
    {
      editor.setValue(`123456789123456789`);
      editor.setSelection(new Selection(1, 1, 1, 1));
      const p1 = Event.toPromise(controller.model.onDidSuggest);
      controller.triggerSuggest();
      const e = await p1;
      assert.strictEqual(e.completionModel.items.length, 1);
      assert.strictEqual(e.completionModel.items[0].textLabel, "aaa");
      controller.acceptSelectedSuggestion(false, false);
      assert.strictEqual(editor.getValue(), "aaa1234567891aaa23456789");
    }
    {
      editor.setValue(`123456789123456789`);
      editor.setSelection(new Selection(1, 1, 1, 1));
      const p1 = Event.toPromise(controller.model.onDidSuggest);
      controller.triggerSuggest();
      const e = await p1;
      assert.strictEqual(e.completionModel.items.length, 1);
      assert.strictEqual(e.completionModel.items[0].textLabel, "aaa");
      editor.trigger("keyboard", "type", { text: "aa" });
      controller.acceptSelectedSuggestion(false, false);
      assert.strictEqual(editor.getValue(), "aaa1234567891aaa23456789");
    }
  });
  test.skip('[Bug] "No suggestions" persists while typing if the completion helper is set to return an empty list for empty content#3557', async function() {
    let requestCount = 0;
    disposables.add(languageFeaturesService.completionProvider.register({ scheme: "test-ctrl" }, {
      _debugDisplayName: "test",
      provideCompletionItems(doc, pos) {
        requestCount += 1;
        if (requestCount === 1) {
          return void 0;
        }
        return {
          suggestions: [{
            kind: CompletionItemKind.Text,
            label: "foo",
            insertText: "foo",
            range: new Range(pos.lineNumber, 1, pos.lineNumber, pos.column)
          }]
        };
      }
    }));
    const p1 = Event.toPromise(controller.model.onDidSuggest);
    controller.triggerSuggest();
    const e1 = await p1;
    assert.strictEqual(e1.completionModel.items.length, 0);
    assert.strictEqual(requestCount, 1);
    const p2 = Event.toPromise(controller.model.onDidSuggest);
    editor.trigger("keyboard", "type", { text: "f" });
    const e2 = await p2;
    assert.strictEqual(e2.completionModel.items.length, 1);
    assert.strictEqual(requestCount, 2);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9zdWdnZXN0L3Rlc3QvYnJvd3Nlci9zdWdnZXN0Q29udHJvbGxlci50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBtb2NrIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi9tb2NrLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IFRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9tb2RlbC90ZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgQ29tcGxldGlvbkl0ZW1JbnNlcnRUZXh0UnVsZSwgQ29tcGxldGlvbkl0ZW1LaW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yV29ya2VyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy9lZGl0b3JXb3JrZXIuanMnO1xuaW1wb3J0IHsgU25pcHBldENvbnRyb2xsZXIyIH0gZnJvbSAnLi4vLi4vLi4vc25pcHBldC9icm93c2VyL3NuaXBwZXRDb250cm9sbGVyMi5qcyc7XG5pbXBvcnQgeyBTdWdnZXN0Q29udHJvbGxlciB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvc3VnZ2VzdENvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgSVN1Z2dlc3RNZW1vcnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9zdWdnZXN0TWVtb3J5LmpzJztcbmltcG9ydCB7IGNyZWF0ZVRlc3RDb2RlRWRpdG9yLCBJVGVzdENvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2Jyb3dzZXIvdGVzdENvZGVFZGl0b3IuanMnO1xuaW1wb3J0IHsgY3JlYXRlVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9jb21tb24vdGVzdFRleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBJTWVudSwgSU1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL3NlcnZpY2VDb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgTW9ja0tleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy90ZXN0L2NvbW1vbi9tb2NrS2V5YmluZGluZ1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSwgTnVsbExvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJbk1lbW9yeVN0b3JhZ2VTZXJ2aWNlLCBJU3RvcmFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgTnVsbFRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeVV0aWxzLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IExhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZUZlYXR1cmVzLmpzJztcbmltcG9ydCB7IElFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnQuanMnO1xuaW1wb3J0IHsgRGVsZXRlTGluZXNBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi9saW5lc09wZXJhdGlvbnMvYnJvd3Nlci9saW5lc09wZXJhdGlvbnMuanMnO1xuXG5zdWl0ZSgnU3VnZ2VzdENvbnRyb2xsZXInLCBmdW5jdGlvbiAoKSB7XG5cblx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0bGV0IGNvbnRyb2xsZXI6IFN1Z2dlc3RDb250cm9sbGVyO1xuXHRsZXQgZWRpdG9yOiBJVGVzdENvZGVFZGl0b3I7XG5cdGxldCBtb2RlbDogVGV4dE1vZGVsO1xuXHRjb25zdCBsYW5ndWFnZUZlYXR1cmVzU2VydmljZSA9IG5ldyBMYW5ndWFnZUZlYXR1cmVzU2VydmljZSgpO1xuXG5cdHRlYXJkb3duKGZ1bmN0aW9uICgpIHtcblxuXHRcdGRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdH0pO1xuXG5cdC8vIGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHNldHVwKGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IHNlcnZpY2VDb2xsZWN0aW9uID0gbmV3IFNlcnZpY2VDb2xsZWN0aW9uKFxuXHRcdFx0W0lMYW5ndWFnZUZlYXR1cmVzU2VydmljZSwgbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2VdLFxuXHRcdFx0W0lUZWxlbWV0cnlTZXJ2aWNlLCBOdWxsVGVsZW1ldHJ5U2VydmljZV0sXG5cdFx0XHRbSUxvZ1NlcnZpY2UsIG5ldyBOdWxsTG9nU2VydmljZSgpXSxcblx0XHRcdFtJU3RvcmFnZVNlcnZpY2UsIGRpc3Bvc2FibGVzLmFkZChuZXcgSW5NZW1vcnlTdG9yYWdlU2VydmljZSgpKV0sXG5cdFx0XHRbSUtleWJpbmRpbmdTZXJ2aWNlLCBuZXcgTW9ja0tleWJpbmRpbmdTZXJ2aWNlKCldLFxuXHRcdFx0W0lFZGl0b3JXb3JrZXJTZXJ2aWNlLCBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElFZGl0b3JXb3JrZXJTZXJ2aWNlPigpIHtcblx0XHRcdFx0b3ZlcnJpZGUgY29tcHV0ZVdvcmRSYW5nZXMoKSB7XG5cdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh7fSk7XG5cdFx0XHRcdH1cblx0XHRcdH1dLFxuXHRcdFx0W0lTdWdnZXN0TWVtb3J5U2VydmljZSwgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJU3VnZ2VzdE1lbW9yeVNlcnZpY2U+KCkge1xuXHRcdFx0XHRvdmVycmlkZSBtZW1vcml6ZSgpOiB2b2lkIHsgfVxuXHRcdFx0XHRvdmVycmlkZSBzZWxlY3QoKTogbnVtYmVyIHsgcmV0dXJuIDA7IH1cblx0XHRcdH1dLFxuXHRcdFx0W0lNZW51U2VydmljZSwgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJTWVudVNlcnZpY2U+KCkge1xuXHRcdFx0XHRvdmVycmlkZSBjcmVhdGVNZW51KCkge1xuXHRcdFx0XHRcdHJldHVybiBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElNZW51PigpIHtcblx0XHRcdFx0XHRcdG92ZXJyaWRlIG9uRGlkQ2hhbmdlID0gRXZlbnQuTm9uZTtcblx0XHRcdFx0XHRcdG92ZXJyaWRlIGRpc3Bvc2UoKSB7IH1cblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHR9XSxcblx0XHRcdFtJTGFiZWxTZXJ2aWNlLCBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElMYWJlbFNlcnZpY2U+KCkgeyB9XSxcblx0XHRcdFtJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlPigpIHsgfV0sXG5cdFx0XHRbSUVudmlyb25tZW50U2VydmljZSwgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJRW52aXJvbm1lbnRTZXJ2aWNlPigpIHtcblx0XHRcdFx0b3ZlcnJpZGUgaXNCdWlsdDogYm9vbGVhbiA9IHRydWU7XG5cdFx0XHRcdG92ZXJyaWRlIGlzRXh0ZW5zaW9uRGV2ZWxvcG1lbnQ6IGJvb2xlYW4gPSBmYWxzZTtcblx0XHRcdH1dLFxuXHRcdCk7XG5cblx0XHRtb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChjcmVhdGVUZXh0TW9kZWwoJycsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBVUkkuZnJvbSh7IHNjaGVtZTogJ3Rlc3QtY3RybCcsIHBhdGg6ICcvcGF0aC50c3QnIH0pKSk7XG5cdFx0ZWRpdG9yID0gZGlzcG9zYWJsZXMuYWRkKGNyZWF0ZVRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7IHNlcnZpY2VDb2xsZWN0aW9uIH0pKTtcblxuXHRcdGVkaXRvci5yZWdpc3RlckFuZEluc3RhbnRpYXRlQ29udHJpYnV0aW9uKFNuaXBwZXRDb250cm9sbGVyMi5JRCwgU25pcHBldENvbnRyb2xsZXIyKTtcblx0XHRjb250cm9sbGVyID0gZWRpdG9yLnJlZ2lzdGVyQW5kSW5zdGFudGlhdGVDb250cmlidXRpb24oU3VnZ2VzdENvbnRyb2xsZXIuSUQsIFN1Z2dlc3RDb250cm9sbGVyKTtcblx0fSk7XG5cblx0dGVzdCgncG9zdGZpeCBjb21wbGV0aW9uIHJlcG9ydHMgaW5jb3JyZWN0IHBvc2l0aW9uICM4Njk4NCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29tcGxldGlvblByb3ZpZGVyLnJlZ2lzdGVyKHsgc2NoZW1lOiAndGVzdC1jdHJsJyB9LCB7XG5cdFx0XHRfZGVidWdEaXNwbGF5TmFtZTogJ3Rlc3QnLFxuXHRcdFx0cHJvdmlkZUNvbXBsZXRpb25JdGVtcyhkb2MsIHBvcykge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHN1Z2dlc3Rpb25zOiBbe1xuXHRcdFx0XHRcdFx0a2luZDogQ29tcGxldGlvbkl0ZW1LaW5kLlNuaXBwZXQsXG5cdFx0XHRcdFx0XHRsYWJlbDogJ2xldCcsXG5cdFx0XHRcdFx0XHRpbnNlcnRUZXh0OiAnbGV0ICR7MTpuYW1lfSA9IGZvbyQwJyxcblx0XHRcdFx0XHRcdGluc2VydFRleHRSdWxlczogQ29tcGxldGlvbkl0ZW1JbnNlcnRUZXh0UnVsZS5JbnNlcnRBc1NuaXBwZXQsXG5cdFx0XHRcdFx0XHRyYW5nZTogeyBzdGFydExpbmVOdW1iZXI6IDEsIHN0YXJ0Q29sdW1uOiA5LCBlbmRMaW5lTnVtYmVyOiAxLCBlbmRDb2x1bW46IDExIH0sXG5cdFx0XHRcdFx0XHRhZGRpdGlvbmFsVGV4dEVkaXRzOiBbe1xuXHRcdFx0XHRcdFx0XHR0ZXh0OiAnJyxcblx0XHRcdFx0XHRcdFx0cmFuZ2U6IHsgc3RhcnRMaW5lTnVtYmVyOiAxLCBzdGFydENvbHVtbjogNSwgZW5kTGluZU51bWJlcjogMSwgZW5kQ29sdW1uOiA5IH1cblx0XHRcdFx0XHRcdH1dXG5cdFx0XHRcdFx0fV1cblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRlZGl0b3Iuc2V0VmFsdWUoJyAgICBmb28ubGUnKTtcblx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgMTEsIDEsIDExKSk7XG5cblx0XHQvLyB0cmlnZ2VyXG5cdFx0Y29uc3QgcDEgPSBFdmVudC50b1Byb21pc2UoY29udHJvbGxlci5tb2RlbC5vbkRpZFN1Z2dlc3QpO1xuXHRcdGNvbnRyb2xsZXIudHJpZ2dlclN1Z2dlc3QoKTtcblx0XHRhd2FpdCBwMTtcblxuXHRcdC8vXG5cdFx0Y29uc3QgcDIgPSBFdmVudC50b1Byb21pc2UoY29udHJvbGxlci5tb2RlbC5vbkRpZENhbmNlbCk7XG5cdFx0Y29udHJvbGxlci5hY2NlcHRTZWxlY3RlZFN1Z2dlc3Rpb24oZmFsc2UsIGZhbHNlKTtcblx0XHRhd2FpdCBwMjtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0VmFsdWUoKSwgJyAgICBsZXQgbmFtZSA9IGZvbycpO1xuXHR9KTtcblxuXHR0ZXN0KCd1c2UgYWRkaXRpb25hbFRleHRFZGl0cyBzeW5jIHdoZW4gcG9zc2libGUnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29tcGxldGlvblByb3ZpZGVyLnJlZ2lzdGVyKHsgc2NoZW1lOiAndGVzdC1jdHJsJyB9LCB7XG5cdFx0XHRfZGVidWdEaXNwbGF5TmFtZTogJ3Rlc3QnLFxuXHRcdFx0cHJvdmlkZUNvbXBsZXRpb25JdGVtcyhkb2MsIHBvcykge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHN1Z2dlc3Rpb25zOiBbe1xuXHRcdFx0XHRcdFx0a2luZDogQ29tcGxldGlvbkl0ZW1LaW5kLlNuaXBwZXQsXG5cdFx0XHRcdFx0XHRsYWJlbDogJ2xldCcsXG5cdFx0XHRcdFx0XHRpbnNlcnRUZXh0OiAnaGVsbG8nLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IFJhbmdlLmZyb21Qb3NpdGlvbnMocG9zKSxcblx0XHRcdFx0XHRcdGFkZGl0aW9uYWxUZXh0RWRpdHM6IFt7XG5cdFx0XHRcdFx0XHRcdHRleHQ6ICdJIGNhbWUgc3luYycsXG5cdFx0XHRcdFx0XHRcdHJhbmdlOiB7IHN0YXJ0TGluZU51bWJlcjogMSwgc3RhcnRDb2x1bW46IDEsIGVuZExpbmVOdW1iZXI6IDEsIGVuZENvbHVtbjogMSB9XG5cdFx0XHRcdFx0XHR9XVxuXHRcdFx0XHRcdH1dXG5cdFx0XHRcdH07XG5cdFx0XHR9LFxuXHRcdFx0YXN5bmMgcmVzb2x2ZUNvbXBsZXRpb25JdGVtKGl0ZW0pIHtcblx0XHRcdFx0cmV0dXJuIGl0ZW07XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0ZWRpdG9yLnNldFZhbHVlKCdoZWxsb1xcbmhhbGxvJyk7XG5cdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDIsIDYsIDIsIDYpKTtcblxuXHRcdC8vIHRyaWdnZXJcblx0XHRjb25zdCBwMSA9IEV2ZW50LnRvUHJvbWlzZShjb250cm9sbGVyLm1vZGVsLm9uRGlkU3VnZ2VzdCk7XG5cdFx0Y29udHJvbGxlci50cmlnZ2VyU3VnZ2VzdCgpO1xuXHRcdGF3YWl0IHAxO1xuXG5cdFx0Ly9cblx0XHRjb25zdCBwMiA9IEV2ZW50LnRvUHJvbWlzZShjb250cm9sbGVyLm1vZGVsLm9uRGlkQ2FuY2VsKTtcblx0XHRjb250cm9sbGVyLmFjY2VwdFNlbGVjdGVkU3VnZ2VzdGlvbihmYWxzZSwgZmFsc2UpO1xuXHRcdGF3YWl0IHAyO1xuXG5cdFx0Ly8gaW5zZXJ0VGV4dCBoYXBwZW5zIHN5bmMhXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRWYWx1ZSgpLCAnSSBjYW1lIHN5bmNoZWxsb1xcbmhhbGxvaGVsbG8nKTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZSBhZGRpdGlvbmFsVGV4dEVkaXRzIGFzeW5jIHdoZW4gbmVlZGVkJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0bGV0IHJlc29sdmVDYWxsQ291bnQgPSAwO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmNvbXBsZXRpb25Qcm92aWRlci5yZWdpc3Rlcih7IHNjaGVtZTogJ3Rlc3QtY3RybCcgfSwge1xuXHRcdFx0X2RlYnVnRGlzcGxheU5hbWU6ICd0ZXN0Jyxcblx0XHRcdHByb3ZpZGVDb21wbGV0aW9uSXRlbXMoZG9jLCBwb3MpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRzdWdnZXN0aW9uczogW3tcblx0XHRcdFx0XHRcdGtpbmQ6IENvbXBsZXRpb25JdGVtS2luZC5TbmlwcGV0LFxuXHRcdFx0XHRcdFx0bGFiZWw6ICdsZXQnLFxuXHRcdFx0XHRcdFx0aW5zZXJ0VGV4dDogJ2hlbGxvJyxcblx0XHRcdFx0XHRcdHJhbmdlOiBSYW5nZS5mcm9tUG9zaXRpb25zKHBvcylcblx0XHRcdFx0XHR9XVxuXHRcdFx0XHR9O1xuXHRcdFx0fSxcblx0XHRcdGFzeW5jIHJlc29sdmVDb21wbGV0aW9uSXRlbShpdGVtKSB7XG5cdFx0XHRcdHJlc29sdmVDYWxsQ291bnQgKz0gMTtcblx0XHRcdFx0YXdhaXQgdGltZW91dCgxMCk7XG5cdFx0XHRcdGl0ZW0uYWRkaXRpb25hbFRleHRFZGl0cyA9IFt7XG5cdFx0XHRcdFx0dGV4dDogJ0kgY2FtZSBsYXRlJyxcblx0XHRcdFx0XHRyYW5nZTogeyBzdGFydExpbmVOdW1iZXI6IDEsIHN0YXJ0Q29sdW1uOiAxLCBlbmRMaW5lTnVtYmVyOiAxLCBlbmRDb2x1bW46IDEgfVxuXHRcdFx0XHR9XTtcblx0XHRcdFx0cmV0dXJuIGl0ZW07XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0ZWRpdG9yLnNldFZhbHVlKCdoZWxsb1xcbmhhbGxvJyk7XG5cdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDIsIDYsIDIsIDYpKTtcblxuXHRcdC8vIHRyaWdnZXJcblx0XHRjb25zdCBwMSA9IEV2ZW50LnRvUHJvbWlzZShjb250cm9sbGVyLm1vZGVsLm9uRGlkU3VnZ2VzdCk7XG5cdFx0Y29udHJvbGxlci50cmlnZ2VyU3VnZ2VzdCgpO1xuXHRcdGF3YWl0IHAxO1xuXG5cdFx0Ly9cblx0XHRjb25zdCBwMiA9IEV2ZW50LnRvUHJvbWlzZShjb250cm9sbGVyLm1vZGVsLm9uRGlkQ2FuY2VsKTtcblx0XHRjb250cm9sbGVyLmFjY2VwdFNlbGVjdGVkU3VnZ2VzdGlvbihmYWxzZSwgZmFsc2UpO1xuXHRcdGF3YWl0IHAyO1xuXG5cdFx0Ly8gaW5zZXJ0VGV4dCBoYXBwZW5zIHN5bmMhXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRWYWx1ZSgpLCAnaGVsbG9cXG5oYWxsb2hlbGxvJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc29sdmVDYWxsQ291bnQsIDEpO1xuXG5cdFx0Ly8gYWRkaXRpb25hbCBlZGl0cyBoYXBwZW5lZCBhZnRlciBhIGxpdHRlIHdhaXRcblx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldFZhbHVlKCksICdJIGNhbWUgbGF0ZWhlbGxvXFxuaGFsbG9oZWxsbycpO1xuXG5cdFx0Ly8gc2luZ2xlIHVuZG8gc3RvcFxuXHRcdGVkaXRvci5nZXRNb2RlbCgpPy51bmRvKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRWYWx1ZSgpLCAnaGVsbG9cXG5oYWxsbycpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlIGFkZGl0aW9uYWxUZXh0RWRpdHMgYXN5bmMgd2hlbiBuZWVkZWQgKHR5cGluZyknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHRsZXQgcmVzb2x2ZUNhbGxDb3VudCA9IDA7XG5cdFx0bGV0IHJlc29sdmU6IEZ1bmN0aW9uID0gKCkgPT4geyB9O1xuXHRcdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5jb21wbGV0aW9uUHJvdmlkZXIucmVnaXN0ZXIoeyBzY2hlbWU6ICd0ZXN0LWN0cmwnIH0sIHtcblx0XHRcdF9kZWJ1Z0Rpc3BsYXlOYW1lOiAndGVzdCcsXG5cdFx0XHRwcm92aWRlQ29tcGxldGlvbkl0ZW1zKGRvYywgcG9zKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0c3VnZ2VzdGlvbnM6IFt7XG5cdFx0XHRcdFx0XHRraW5kOiBDb21wbGV0aW9uSXRlbUtpbmQuU25pcHBldCxcblx0XHRcdFx0XHRcdGxhYmVsOiAnbGV0Jyxcblx0XHRcdFx0XHRcdGluc2VydFRleHQ6ICdoZWxsbycsXG5cdFx0XHRcdFx0XHRyYW5nZTogUmFuZ2UuZnJvbVBvc2l0aW9ucyhwb3MpXG5cdFx0XHRcdFx0fV1cblx0XHRcdFx0fTtcblx0XHRcdH0sXG5cdFx0XHRhc3luYyByZXNvbHZlQ29tcGxldGlvbkl0ZW0oaXRlbSkge1xuXHRcdFx0XHRyZXNvbHZlQ2FsbENvdW50ICs9IDE7XG5cdFx0XHRcdGF3YWl0IG5ldyBQcm9taXNlKF9yZXNvbHZlID0+IHJlc29sdmUgPSBfcmVzb2x2ZSk7XG5cdFx0XHRcdGl0ZW0uYWRkaXRpb25hbFRleHRFZGl0cyA9IFt7XG5cdFx0XHRcdFx0dGV4dDogJ0kgY2FtZSBsYXRlJyxcblx0XHRcdFx0XHRyYW5nZTogeyBzdGFydExpbmVOdW1iZXI6IDEsIHN0YXJ0Q29sdW1uOiAxLCBlbmRMaW5lTnVtYmVyOiAxLCBlbmRDb2x1bW46IDEgfVxuXHRcdFx0XHR9XTtcblx0XHRcdFx0cmV0dXJuIGl0ZW07XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0ZWRpdG9yLnNldFZhbHVlKCdoZWxsb1xcbmhhbGxvJyk7XG5cdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDIsIDYsIDIsIDYpKTtcblxuXHRcdC8vIHRyaWdnZXJcblx0XHRjb25zdCBwMSA9IEV2ZW50LnRvUHJvbWlzZShjb250cm9sbGVyLm1vZGVsLm9uRGlkU3VnZ2VzdCk7XG5cdFx0Y29udHJvbGxlci50cmlnZ2VyU3VnZ2VzdCgpO1xuXHRcdGF3YWl0IHAxO1xuXG5cdFx0Ly9cblx0XHRjb25zdCBwMiA9IEV2ZW50LnRvUHJvbWlzZShjb250cm9sbGVyLm1vZGVsLm9uRGlkQ2FuY2VsKTtcblx0XHRjb250cm9sbGVyLmFjY2VwdFNlbGVjdGVkU3VnZ2VzdGlvbihmYWxzZSwgZmFsc2UpO1xuXHRcdGF3YWl0IHAyO1xuXG5cdFx0Ly8gaW5zZXJ0VGV4dCBoYXBwZW5zIHN5bmMhXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRWYWx1ZSgpLCAnaGVsbG9cXG5oYWxsb2hlbGxvJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc29sdmVDYWxsQ291bnQsIDEpO1xuXG5cdFx0Ly8gYWRkaXRpb25hbCBlZGl0cyBoYXBwZW5lZCBhZnRlciBhIGxpdHRlIHdhaXRcblx0XHRhc3NlcnQub2soZWRpdG9yLmdldFNlbGVjdGlvbigpPy5lcXVhbHNTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigyLCAxMSwgMiwgMTEpKSk7XG5cdFx0ZWRpdG9yLnRyaWdnZXIoJ3Rlc3QnLCAndHlwZScsIHsgdGV4dDogJ1RZUElORycgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldFZhbHVlKCksICdoZWxsb1xcbmhhbGxvaGVsbG9UWVBJTkcnKTtcblxuXHRcdHJlc29sdmUoKTtcblx0XHRhd2FpdCB0aW1lb3V0KDEwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldFZhbHVlKCksICdJIGNhbWUgbGF0ZWhlbGxvXFxuaGFsbG9oZWxsb1RZUElORycpO1xuXHRcdGFzc2VydC5vayhlZGl0b3IuZ2V0U2VsZWN0aW9uKCk/LmVxdWFsc1NlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDIsIDE3LCAyLCAxNykpKTtcblx0fSk7XG5cblx0Ly8gYWRkaXRpb25hbCBlZGl0IGNvbWUgbGF0ZSBhbmQgYXJlIEFGVEVSIHRoZSBzZWxlY3Rpb24gLT4gY2FuY2VsXG5cdHRlc3QoJ3Jlc29sdmUgYWRkaXRpb25hbFRleHRFZGl0cyBhc3luYyB3aGVuIG5lZWRlZCAoc2ltcGxlIGNvbmZsaWN0KScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGxldCByZXNvbHZlQ2FsbENvdW50ID0gMDtcblx0XHRsZXQgcmVzb2x2ZTogRnVuY3Rpb24gPSAoKSA9PiB7IH07XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmNvbXBsZXRpb25Qcm92aWRlci5yZWdpc3Rlcih7IHNjaGVtZTogJ3Rlc3QtY3RybCcgfSwge1xuXHRcdFx0X2RlYnVnRGlzcGxheU5hbWU6ICd0ZXN0Jyxcblx0XHRcdHByb3ZpZGVDb21wbGV0aW9uSXRlbXMoZG9jLCBwb3MpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRzdWdnZXN0aW9uczogW3tcblx0XHRcdFx0XHRcdGtpbmQ6IENvbXBsZXRpb25JdGVtS2luZC5TbmlwcGV0LFxuXHRcdFx0XHRcdFx0bGFiZWw6ICdsZXQnLFxuXHRcdFx0XHRcdFx0aW5zZXJ0VGV4dDogJ2hlbGxvJyxcblx0XHRcdFx0XHRcdHJhbmdlOiBSYW5nZS5mcm9tUG9zaXRpb25zKHBvcylcblx0XHRcdFx0XHR9XVxuXHRcdFx0XHR9O1xuXHRcdFx0fSxcblx0XHRcdGFzeW5jIHJlc29sdmVDb21wbGV0aW9uSXRlbShpdGVtKSB7XG5cdFx0XHRcdHJlc29sdmVDYWxsQ291bnQgKz0gMTtcblx0XHRcdFx0YXdhaXQgbmV3IFByb21pc2UoX3Jlc29sdmUgPT4gcmVzb2x2ZSA9IF9yZXNvbHZlKTtcblx0XHRcdFx0aXRlbS5hZGRpdGlvbmFsVGV4dEVkaXRzID0gW3tcblx0XHRcdFx0XHR0ZXh0OiAnSSBjYW1lIGxhdGUnLFxuXHRcdFx0XHRcdHJhbmdlOiB7IHN0YXJ0TGluZU51bWJlcjogMSwgc3RhcnRDb2x1bW46IDYsIGVuZExpbmVOdW1iZXI6IDEsIGVuZENvbHVtbjogNiB9XG5cdFx0XHRcdH1dO1xuXHRcdFx0XHRyZXR1cm4gaXRlbTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRlZGl0b3Iuc2V0VmFsdWUoJycpO1xuXHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSk7XG5cblx0XHQvLyB0cmlnZ2VyXG5cdFx0Y29uc3QgcDEgPSBFdmVudC50b1Byb21pc2UoY29udHJvbGxlci5tb2RlbC5vbkRpZFN1Z2dlc3QpO1xuXHRcdGNvbnRyb2xsZXIudHJpZ2dlclN1Z2dlc3QoKTtcblx0XHRhd2FpdCBwMTtcblxuXHRcdC8vXG5cdFx0Y29uc3QgcDIgPSBFdmVudC50b1Byb21pc2UoY29udHJvbGxlci5tb2RlbC5vbkRpZENhbmNlbCk7XG5cdFx0Y29udHJvbGxlci5hY2NlcHRTZWxlY3RlZFN1Z2dlc3Rpb24oZmFsc2UsIGZhbHNlKTtcblx0XHRhd2FpdCBwMjtcblxuXHRcdC8vIGluc2VydFRleHQgaGFwcGVucyBzeW5jIVxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0VmFsdWUoKSwgJ2hlbGxvJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc29sdmVDYWxsQ291bnQsIDEpO1xuXG5cdFx0cmVzb2x2ZSgpO1xuXHRcdGF3YWl0IHRpbWVvdXQoMTApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0VmFsdWUoKSwgJ2hlbGxvJyk7XG5cdH0pO1xuXG5cdC8vIGFkZGl0aW9uYWwgZWRpdCBjb21lIGxhdGUgYW5kIGFyZSBBRlRFUiB0aGUgcG9zaXRpb24gYXQgd2hpY2ggdGhlIHVzZXIgdHlwZWQgLT4gY2FuY2VsbGVkXG5cdHRlc3QoJ3Jlc29sdmUgYWRkaXRpb25hbFRleHRFZGl0cyBhc3luYyB3aGVuIG5lZWRlZCAoY29uZmxpY3QpJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0bGV0IHJlc29sdmVDYWxsQ291bnQgPSAwO1xuXHRcdGxldCByZXNvbHZlOiBGdW5jdGlvbiA9ICgpID0+IHsgfTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29tcGxldGlvblByb3ZpZGVyLnJlZ2lzdGVyKHsgc2NoZW1lOiAndGVzdC1jdHJsJyB9LCB7XG5cdFx0XHRfZGVidWdEaXNwbGF5TmFtZTogJ3Rlc3QnLFxuXHRcdFx0cHJvdmlkZUNvbXBsZXRpb25JdGVtcyhkb2MsIHBvcykge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHN1Z2dlc3Rpb25zOiBbe1xuXHRcdFx0XHRcdFx0a2luZDogQ29tcGxldGlvbkl0ZW1LaW5kLlNuaXBwZXQsXG5cdFx0XHRcdFx0XHRsYWJlbDogJ2xldCcsXG5cdFx0XHRcdFx0XHRpbnNlcnRUZXh0OiAnaGVsbG8nLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IFJhbmdlLmZyb21Qb3NpdGlvbnMocG9zKVxuXHRcdFx0XHRcdH1dXG5cdFx0XHRcdH07XG5cdFx0XHR9LFxuXHRcdFx0YXN5bmMgcmVzb2x2ZUNvbXBsZXRpb25JdGVtKGl0ZW0pIHtcblx0XHRcdFx0cmVzb2x2ZUNhbGxDb3VudCArPSAxO1xuXHRcdFx0XHRhd2FpdCBuZXcgUHJvbWlzZShfcmVzb2x2ZSA9PiByZXNvbHZlID0gX3Jlc29sdmUpO1xuXHRcdFx0XHRpdGVtLmFkZGl0aW9uYWxUZXh0RWRpdHMgPSBbe1xuXHRcdFx0XHRcdHRleHQ6ICdJIGNhbWUgbGF0ZScsXG5cdFx0XHRcdFx0cmFuZ2U6IHsgc3RhcnRMaW5lTnVtYmVyOiAxLCBzdGFydENvbHVtbjogMiwgZW5kTGluZU51bWJlcjogMSwgZW5kQ29sdW1uOiAyIH1cblx0XHRcdFx0fV07XG5cdFx0XHRcdHJldHVybiBpdGVtO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGVkaXRvci5zZXRWYWx1ZSgnaGVsbG9cXG5oYWxsbycpO1xuXHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigyLCA2LCAyLCA2KSk7XG5cblx0XHQvLyB0cmlnZ2VyXG5cdFx0Y29uc3QgcDEgPSBFdmVudC50b1Byb21pc2UoY29udHJvbGxlci5tb2RlbC5vbkRpZFN1Z2dlc3QpO1xuXHRcdGNvbnRyb2xsZXIudHJpZ2dlclN1Z2dlc3QoKTtcblx0XHRhd2FpdCBwMTtcblxuXHRcdC8vXG5cdFx0Y29uc3QgcDIgPSBFdmVudC50b1Byb21pc2UoY29udHJvbGxlci5tb2RlbC5vbkRpZENhbmNlbCk7XG5cdFx0Y29udHJvbGxlci5hY2NlcHRTZWxlY3RlZFN1Z2dlc3Rpb24oZmFsc2UsIGZhbHNlKTtcblx0XHRhd2FpdCBwMjtcblxuXHRcdC8vIGluc2VydFRleHQgaGFwcGVucyBzeW5jIVxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0VmFsdWUoKSwgJ2hlbGxvXFxuaGFsbG9oZWxsbycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXNvbHZlQ2FsbENvdW50LCAxKTtcblxuXHRcdC8vIGFkZGl0aW9uYWwgZWRpdHMgaGFwcGVuZWQgYWZ0ZXIgYSBsaXR0ZSB3YWl0XG5cdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpKTtcblx0XHRlZGl0b3IudHJpZ2dlcigndGVzdCcsICd0eXBlJywgeyB0ZXh0OiAnVFlQSU5HJyB9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0VmFsdWUoKSwgJ1RZUElOR2hlbGxvXFxuaGFsbG9oZWxsbycpO1xuXG5cdFx0cmVzb2x2ZSgpO1xuXHRcdGF3YWl0IHRpbWVvdXQoMTApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0VmFsdWUoKSwgJ1RZUElOR2hlbGxvXFxuaGFsbG9oZWxsbycpO1xuXHRcdGFzc2VydC5vayhlZGl0b3IuZ2V0U2VsZWN0aW9uKCk/LmVxdWFsc1NlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDEsIDcsIDEsIDcpKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmUgYWRkaXRpb25hbFRleHRFZGl0cyBhc3luYyB3aGVuIG5lZWRlZCAoY2FuY2VsKScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IHJlc29sdmU6IEZ1bmN0aW9uW10gPSBbXTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29tcGxldGlvblByb3ZpZGVyLnJlZ2lzdGVyKHsgc2NoZW1lOiAndGVzdC1jdHJsJyB9LCB7XG5cdFx0XHRfZGVidWdEaXNwbGF5TmFtZTogJ3Rlc3QnLFxuXHRcdFx0cHJvdmlkZUNvbXBsZXRpb25JdGVtcyhkb2MsIHBvcykge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHN1Z2dlc3Rpb25zOiBbe1xuXHRcdFx0XHRcdFx0a2luZDogQ29tcGxldGlvbkl0ZW1LaW5kLlNuaXBwZXQsXG5cdFx0XHRcdFx0XHRsYWJlbDogJ2xldCcsXG5cdFx0XHRcdFx0XHRpbnNlcnRUZXh0OiAnaGVsbG8nLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IFJhbmdlLmZyb21Qb3NpdGlvbnMocG9zKVxuXHRcdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRcdGtpbmQ6IENvbXBsZXRpb25JdGVtS2luZC5TbmlwcGV0LFxuXHRcdFx0XHRcdFx0bGFiZWw6ICdsZXQnLFxuXHRcdFx0XHRcdFx0aW5zZXJ0VGV4dDogJ2hhbGxvJyxcblx0XHRcdFx0XHRcdHJhbmdlOiBSYW5nZS5mcm9tUG9zaXRpb25zKHBvcylcblx0XHRcdFx0XHR9XVxuXHRcdFx0XHR9O1xuXHRcdFx0fSxcblx0XHRcdGFzeW5jIHJlc29sdmVDb21wbGV0aW9uSXRlbShpdGVtKSB7XG5cdFx0XHRcdGF3YWl0IG5ldyBQcm9taXNlKF9yZXNvbHZlID0+IHJlc29sdmUucHVzaChfcmVzb2x2ZSkpO1xuXHRcdFx0XHRpdGVtLmFkZGl0aW9uYWxUZXh0RWRpdHMgPSBbe1xuXHRcdFx0XHRcdHRleHQ6ICdhZGRpdGlvbmFsVGV4dEVkaXRzJyxcblx0XHRcdFx0XHRyYW5nZTogeyBzdGFydExpbmVOdW1iZXI6IDEsIHN0YXJ0Q29sdW1uOiAyLCBlbmRMaW5lTnVtYmVyOiAxLCBlbmRDb2x1bW46IDIgfVxuXHRcdFx0XHR9XTtcblx0XHRcdFx0cmV0dXJuIGl0ZW07XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0ZWRpdG9yLnNldFZhbHVlKCdhYmMnKTtcblx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSkpO1xuXG5cdFx0Ly8gdHJpZ2dlclxuXHRcdGNvbnN0IHAxID0gRXZlbnQudG9Qcm9taXNlKGNvbnRyb2xsZXIubW9kZWwub25EaWRTdWdnZXN0KTtcblx0XHRjb250cm9sbGVyLnRyaWdnZXJTdWdnZXN0KCk7XG5cdFx0YXdhaXQgcDE7XG5cblx0XHQvL1xuXHRcdGNvbnN0IHAyID0gRXZlbnQudG9Qcm9taXNlKGNvbnRyb2xsZXIubW9kZWwub25EaWRDYW5jZWwpO1xuXHRcdGNvbnRyb2xsZXIuYWNjZXB0U2VsZWN0ZWRTdWdnZXN0aW9uKHRydWUsIGZhbHNlKTtcblx0XHRhd2FpdCBwMjtcblxuXHRcdC8vIGluc2VydFRleHQgaGFwcGVucyBzeW5jIVxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0VmFsdWUoKSwgJ2hlbGxvYWJjJyk7XG5cblx0XHQvLyBuZXh0XG5cdFx0Y29udHJvbGxlci5hY2NlcHROZXh0U3VnZ2VzdGlvbigpO1xuXG5cdFx0Ly8gcmVzb2x2ZSBhZGRpdGlvbmFsIGVkaXRzIChNVVNUIGJlIGNhbmNlbGxlZClcblx0XHRyZXNvbHZlLmZvckVhY2goZm4gPT4gZm4pO1xuXHRcdHJlc29sdmUubGVuZ3RoID0gMDtcblx0XHRhd2FpdCB0aW1lb3V0KDEwKTtcblxuXHRcdC8vIG5leHQgc3VnZ2VzdGlvbiB1c2VkXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRWYWx1ZSgpLCAnaGFsbG9hYmMnKTtcblx0fSk7XG5cblx0dGVzdCgnQ29tcGxldGlvbiBlZGl0cyBhcmUgYXBwbGllZCBpbmNvbnNpc3RlbnRseSB3aGVuIGFkZGl0aW9uYWxUZXh0RWRpdHMgYW5kIHRleHRFZGl0IHN0YXJ0IGF0IHRoZSBzYW1lIG9mZnNldCAjMTQzODg4JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cblx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29tcGxldGlvblByb3ZpZGVyLnJlZ2lzdGVyKHsgc2NoZW1lOiAndGVzdC1jdHJsJyB9LCB7XG5cdFx0XHRfZGVidWdEaXNwbGF5TmFtZTogJ3Rlc3QnLFxuXHRcdFx0cHJvdmlkZUNvbXBsZXRpb25JdGVtcyhkb2MsIHBvcykge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHN1Z2dlc3Rpb25zOiBbe1xuXHRcdFx0XHRcdFx0a2luZDogQ29tcGxldGlvbkl0ZW1LaW5kLlRleHQsXG5cdFx0XHRcdFx0XHRsYWJlbDogJ015Q2xhc3NOYW1lJyxcblx0XHRcdFx0XHRcdGluc2VydFRleHQ6ICdNeUNsYXNzTmFtZScsXG5cdFx0XHRcdFx0XHRyYW5nZTogUmFuZ2UuZnJvbVBvc2l0aW9ucyhwb3MpLFxuXHRcdFx0XHRcdFx0YWRkaXRpb25hbFRleHRFZGl0czogW3tcblx0XHRcdFx0XHRcdFx0cmFuZ2U6IFJhbmdlLmZyb21Qb3NpdGlvbnMocG9zKSxcblx0XHRcdFx0XHRcdFx0dGV4dDogJ2ltcG9ydCBcIm15X2NsYXNzLnR4dFwiO1xcbidcblx0XHRcdFx0XHRcdH1dXG5cdFx0XHRcdFx0fV1cblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRlZGl0b3Iuc2V0VmFsdWUoJycpO1xuXHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSk7XG5cblx0XHQvLyB0cmlnZ2VyXG5cdFx0Y29uc3QgcDEgPSBFdmVudC50b1Byb21pc2UoY29udHJvbGxlci5tb2RlbC5vbkRpZFN1Z2dlc3QpO1xuXHRcdGNvbnRyb2xsZXIudHJpZ2dlclN1Z2dlc3QoKTtcblx0XHRhd2FpdCBwMTtcblxuXHRcdC8vXG5cdFx0Y29uc3QgcDIgPSBFdmVudC50b1Byb21pc2UoY29udHJvbGxlci5tb2RlbC5vbkRpZENhbmNlbCk7XG5cdFx0Y29udHJvbGxlci5hY2NlcHRTZWxlY3RlZFN1Z2dlc3Rpb24odHJ1ZSwgZmFsc2UpO1xuXHRcdGF3YWl0IHAyO1xuXG5cdFx0Ly8gaW5zZXJ0VGV4dCBoYXBwZW5zIHN5bmMhXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRWYWx1ZSgpLCAnaW1wb3J0IFwibXlfY2xhc3MudHh0XCI7XFxuTXlDbGFzc05hbWUnKTtcblxuXHR9KTtcblxuXHR0ZXN0KCdQcmVzc2luZyBlbnRlciBvbiBhdXRvY29tcGxldGUgc2hvdWxkIGFsd2F5cyBhcHBseSB0aGUgc2VsZWN0ZWQgZHJvcGRvd24gY29tcGxldGlvbiwgbm90IGEgZGlmZmVyZW50LCBoaWRkZW4gb25lICMxNjE4ODMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmNvbXBsZXRpb25Qcm92aWRlci5yZWdpc3Rlcih7IHNjaGVtZTogJ3Rlc3QtY3RybCcgfSwge1xuXHRcdFx0X2RlYnVnRGlzcGxheU5hbWU6ICd0ZXN0Jyxcblx0XHRcdHByb3ZpZGVDb21wbGV0aW9uSXRlbXMoZG9jLCBwb3MpIHtcblxuXHRcdFx0XHRjb25zdCB3b3JkID0gZG9jLmdldFdvcmRVbnRpbFBvc2l0aW9uKHBvcyk7XG5cdFx0XHRcdGNvbnN0IHJhbmdlID0gbmV3IFJhbmdlKHBvcy5saW5lTnVtYmVyLCB3b3JkLnN0YXJ0Q29sdW1uLCBwb3MubGluZU51bWJlciwgd29yZC5lbmRDb2x1bW4pO1xuXG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0c3VnZ2VzdGlvbnM6IFt7XG5cdFx0XHRcdFx0XHRraW5kOiBDb21wbGV0aW9uSXRlbUtpbmQuVGV4dCxcblx0XHRcdFx0XHRcdGxhYmVsOiAnZmlsdGVyQmFua1NpemUnLFxuXHRcdFx0XHRcdFx0aW5zZXJ0VGV4dDogJ2ZpbHRlckJhbmtTaXplJyxcblx0XHRcdFx0XHRcdHNvcnRUZXh0OiAnYScsXG5cdFx0XHRcdFx0XHRyYW5nZVxuXHRcdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRcdGtpbmQ6IENvbXBsZXRpb25JdGVtS2luZC5UZXh0LFxuXHRcdFx0XHRcdFx0bGFiZWw6ICdmaWx0ZXInLFxuXHRcdFx0XHRcdFx0aW5zZXJ0VGV4dDogJ2ZpbHRlcicsXG5cdFx0XHRcdFx0XHRzb3J0VGV4dDogJ2InLFxuXHRcdFx0XHRcdFx0cmFuZ2Vcblx0XHRcdFx0XHR9XVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGVkaXRvci5zZXRWYWx1ZSgnZmlsdGUnKTtcblx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgNiwgMSwgNikpO1xuXG5cdFx0Y29uc3QgcDEgPSBFdmVudC50b1Byb21pc2UoY29udHJvbGxlci5tb2RlbC5vbkRpZFN1Z2dlc3QpO1xuXHRcdGNvbnRyb2xsZXIudHJpZ2dlclN1Z2dlc3QoKTtcblxuXHRcdGNvbnN0IHsgY29tcGxldGlvbk1vZGVsIH0gPSBhd2FpdCBwMTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29tcGxldGlvbk1vZGVsLml0ZW1zLmxlbmd0aCwgMik7XG5cblx0XHRjb25zdCBbZmlyc3QsIHNlY29uZF0gPSBjb21wbGV0aW9uTW9kZWwuaXRlbXM7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LnRleHRMYWJlbCwgJ2ZpbHRlckJhbmtTaXplJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlY29uZC50ZXh0TGFiZWwsICdmaWx0ZXInKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbigpLCBuZXcgU2VsZWN0aW9uKDEsIDYsIDEsIDYpKTtcblx0XHRlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCAndHlwZScsIHsgdGV4dDogJ3InIH0pOyAvLyBub3cgZmlsdGVyIFwib3ZlcnRha2VzXCIgZmlsdGVyQmFua1NpemUgYmVjYXVzZSBpdCBpcyBmdWxseSBtYXRjaGVkXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9uKCksIG5ldyBTZWxlY3Rpb24oMSwgNywgMSwgNykpO1xuXG5cdFx0Y29udHJvbGxlci5hY2NlcHRTZWxlY3RlZFN1Z2dlc3Rpb24oZmFsc2UsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldFZhbHVlKCksICdmaWx0ZXInKTtcblx0fSk7XG5cblx0dGVzdCgnRmFzdCBhdXRvY29tcGxlIHR5cGluZyBzZWxlY3RzIHRoZSBwcmV2aW91cyBhdXRvY29tcGxldGUgc3VnZ2VzdGlvbiwgIzcxNzk1JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5jb21wbGV0aW9uUHJvdmlkZXIucmVnaXN0ZXIoeyBzY2hlbWU6ICd0ZXN0LWN0cmwnIH0sIHtcblx0XHRcdF9kZWJ1Z0Rpc3BsYXlOYW1lOiAndGVzdCcsXG5cdFx0XHRwcm92aWRlQ29tcGxldGlvbkl0ZW1zKGRvYywgcG9zKSB7XG5cblx0XHRcdFx0Y29uc3Qgd29yZCA9IGRvYy5nZXRXb3JkVW50aWxQb3NpdGlvbihwb3MpO1xuXHRcdFx0XHRjb25zdCByYW5nZSA9IG5ldyBSYW5nZShwb3MubGluZU51bWJlciwgd29yZC5zdGFydENvbHVtbiwgcG9zLmxpbmVOdW1iZXIsIHdvcmQuZW5kQ29sdW1uKTtcblxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHN1Z2dlc3Rpb25zOiBbe1xuXHRcdFx0XHRcdFx0a2luZDogQ29tcGxldGlvbkl0ZW1LaW5kLlRleHQsXG5cdFx0XHRcdFx0XHRsYWJlbDogJ2ZhbHNlJyxcblx0XHRcdFx0XHRcdGluc2VydFRleHQ6ICdmYWxzZScsXG5cdFx0XHRcdFx0XHRyYW5nZVxuXHRcdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRcdGtpbmQ6IENvbXBsZXRpb25JdGVtS2luZC5UZXh0LFxuXHRcdFx0XHRcdFx0bGFiZWw6ICdmbG9hdCcsXG5cdFx0XHRcdFx0XHRpbnNlcnRUZXh0OiAnZmxvYXQnLFxuXHRcdFx0XHRcdFx0cmFuZ2Vcblx0XHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0XHRraW5kOiBDb21wbGV0aW9uSXRlbUtpbmQuVGV4dCxcblx0XHRcdFx0XHRcdGxhYmVsOiAnZm9yJyxcblx0XHRcdFx0XHRcdGluc2VydFRleHQ6ICdmb3InLFxuXHRcdFx0XHRcdFx0cmFuZ2Vcblx0XHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0XHRraW5kOiBDb21wbGV0aW9uSXRlbUtpbmQuVGV4dCxcblx0XHRcdFx0XHRcdGxhYmVsOiAnZm9yZWFjaCcsXG5cdFx0XHRcdFx0XHRpbnNlcnRUZXh0OiAnZm9yZWFjaCcsXG5cdFx0XHRcdFx0XHRyYW5nZVxuXHRcdFx0XHRcdH1dXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0ZWRpdG9yLnNldFZhbHVlKCdmJyk7XG5cdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDEsIDIsIDEsIDIpKTtcblxuXHRcdGNvbnN0IHAxID0gRXZlbnQudG9Qcm9taXNlKGNvbnRyb2xsZXIubW9kZWwub25EaWRTdWdnZXN0KTtcblx0XHRjb250cm9sbGVyLnRyaWdnZXJTdWdnZXN0KCk7XG5cblx0XHRjb25zdCB7IGNvbXBsZXRpb25Nb2RlbCB9ID0gYXdhaXQgcDE7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbXBsZXRpb25Nb2RlbC5pdGVtcy5sZW5ndGgsIDQpO1xuXG5cdFx0Y29uc3QgW2ZpcnN0LCBzZWNvbmQsIHRoaXJkLCBmb3VydGhdID0gY29tcGxldGlvbk1vZGVsLml0ZW1zO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC50ZXh0TGFiZWwsICdmYWxzZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZWNvbmQudGV4dExhYmVsLCAnZmxvYXQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGhpcmQudGV4dExhYmVsLCAnZm9yJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvdXJ0aC50ZXh0TGFiZWwsICdmb3JlYWNoJyk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb24oKSwgbmV3IFNlbGVjdGlvbigxLCAyLCAxLCAyKSk7XG5cdFx0ZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgJ3R5cGUnLCB7IHRleHQ6ICdvJyB9KTsgLy8gZmlsdGVyc2BmYWxzZWAgYW5kIGBmbG9hdGBcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb24oKSwgbmV3IFNlbGVjdGlvbigxLCAzLCAxLCAzKSk7XG5cblx0XHRjb250cm9sbGVyLmFjY2VwdFNlbGVjdGVkU3VnZ2VzdGlvbihmYWxzZSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0VmFsdWUoKSwgJ2ZvcicpO1xuXHR9KTtcblxuXHR0ZXN0LnNraXAoJ1N1Z2dlc3Qgd2lkZ2V0IGdldHMgb3JwaGFuZWQgaW4gZWRpdG9yICMxODc3NzknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29tcGxldGlvblByb3ZpZGVyLnJlZ2lzdGVyKHsgc2NoZW1lOiAndGVzdC1jdHJsJyB9LCB7XG5cdFx0XHRfZGVidWdEaXNwbGF5TmFtZTogJ3Rlc3QnLFxuXHRcdFx0cHJvdmlkZUNvbXBsZXRpb25JdGVtcyhkb2MsIHBvcykge1xuXG5cdFx0XHRcdGNvbnN0IHdvcmQgPSBkb2MuZ2V0TGluZUNvbnRlbnQocG9zLmxpbmVOdW1iZXIpO1xuXHRcdFx0XHRjb25zdCByYW5nZSA9IG5ldyBSYW5nZShwb3MubGluZU51bWJlciwgMSwgcG9zLmxpbmVOdW1iZXIsIHBvcy5jb2x1bW4pO1xuXG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0c3VnZ2VzdGlvbnM6IFt7XG5cdFx0XHRcdFx0XHRraW5kOiBDb21wbGV0aW9uSXRlbUtpbmQuVGV4dCxcblx0XHRcdFx0XHRcdGxhYmVsOiB3b3JkLFxuXHRcdFx0XHRcdFx0aW5zZXJ0VGV4dDogd29yZCxcblx0XHRcdFx0XHRcdHJhbmdlXG5cdFx0XHRcdFx0fV1cblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRlZGl0b3Iuc2V0VmFsdWUoYGNvbnNvbGUubG9nKGV4YW1wbGUuKVxcbmNvbnNvbGUubG9nKEVYQU1QTEUubm90KWApO1xuXHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCAyMSwgMSwgMjEpKTtcblxuXHRcdGNvbnN0IHAxID0gRXZlbnQudG9Qcm9taXNlKGNvbnRyb2xsZXIubW9kZWwub25EaWRTdWdnZXN0KTtcblx0XHRjb250cm9sbGVyLnRyaWdnZXJTdWdnZXN0KCk7XG5cblx0XHRhd2FpdCBwMTtcblxuXHRcdGNvbnN0IHAyID0gRXZlbnQudG9Qcm9taXNlKGNvbnRyb2xsZXIubW9kZWwub25EaWRDYW5jZWwpO1xuXHRcdG5ldyBEZWxldGVMaW5lc0FjdGlvbigpLnJ1bihudWxsISwgZWRpdG9yKTtcblxuXHRcdGF3YWl0IHAyO1xuXHR9KTtcblxuXHR0ZXN0KCdSYW5nZXMgd2hlcmUgYWRkaXRpb25hbFRleHRFZGl0cyBhcmUgYXBwbGllZCBhcmUgbm90IGFwcHJvcHJpYXRlIHdoZW4gY2hhcmFjdGVycyBhcmUgdHlwZWQgIzE3NzU5MScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29tcGxldGlvblByb3ZpZGVyLnJlZ2lzdGVyKHsgc2NoZW1lOiAndGVzdC1jdHJsJyB9LCB7XG5cdFx0XHRfZGVidWdEaXNwbGF5TmFtZTogJ3Rlc3QnLFxuXHRcdFx0cHJvdmlkZUNvbXBsZXRpb25JdGVtcyhkb2MsIHBvcykge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHN1Z2dlc3Rpb25zOiBbe1xuXHRcdFx0XHRcdFx0a2luZDogQ29tcGxldGlvbkl0ZW1LaW5kLlNuaXBwZXQsXG5cdFx0XHRcdFx0XHRsYWJlbDogJ2FhYScsXG5cdFx0XHRcdFx0XHRpbnNlcnRUZXh0OiAnYWFhJyxcblx0XHRcdFx0XHRcdHJhbmdlOiBSYW5nZS5mcm9tUG9zaXRpb25zKHBvcyksXG5cdFx0XHRcdFx0XHRhZGRpdGlvbmFsVGV4dEVkaXRzOiBbe1xuXHRcdFx0XHRcdFx0XHRyYW5nZTogUmFuZ2UuZnJvbVBvc2l0aW9ucyhwb3MuZGVsdGEoMCwgMTApKSxcblx0XHRcdFx0XHRcdFx0dGV4dDogJ2FhYSdcblx0XHRcdFx0XHRcdH1dXG5cdFx0XHRcdFx0fV1cblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR7IC8vIFBBUlQxIC0gbm8gdHlwaW5nXG5cdFx0XHRlZGl0b3Iuc2V0VmFsdWUoYDEyMzQ1Njc4OTEyMzQ1Njc4OWApO1xuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpKTtcblx0XHRcdGNvbnN0IHAxID0gRXZlbnQudG9Qcm9taXNlKGNvbnRyb2xsZXIubW9kZWwub25EaWRTdWdnZXN0KTtcblx0XHRcdGNvbnRyb2xsZXIudHJpZ2dlclN1Z2dlc3QoKTtcblxuXHRcdFx0Y29uc3QgZSA9IGF3YWl0IHAxO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGUuY29tcGxldGlvbk1vZGVsLml0ZW1zLmxlbmd0aCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZS5jb21wbGV0aW9uTW9kZWwuaXRlbXNbMF0udGV4dExhYmVsLCAnYWFhJyk7XG5cblx0XHRcdGNvbnRyb2xsZXIuYWNjZXB0U2VsZWN0ZWRTdWdnZXN0aW9uKGZhbHNlLCBmYWxzZSk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0VmFsdWUoKSwgJ2FhYTEyMzQ1Njc4OTFhYWEyMzQ1Njc4OScpO1xuXHRcdH1cblxuXHRcdHsgLy8gUEFSVDIgLSB0eXBpbmdcblx0XHRcdGVkaXRvci5zZXRWYWx1ZShgMTIzNDU2Nzg5MTIzNDU2Nzg5YCk7XG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSkpO1xuXHRcdFx0Y29uc3QgcDEgPSBFdmVudC50b1Byb21pc2UoY29udHJvbGxlci5tb2RlbC5vbkRpZFN1Z2dlc3QpO1xuXHRcdFx0Y29udHJvbGxlci50cmlnZ2VyU3VnZ2VzdCgpO1xuXG5cdFx0XHRjb25zdCBlID0gYXdhaXQgcDE7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZS5jb21wbGV0aW9uTW9kZWwuaXRlbXMubGVuZ3RoLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlLmNvbXBsZXRpb25Nb2RlbC5pdGVtc1swXS50ZXh0TGFiZWwsICdhYWEnKTtcblxuXHRcdFx0ZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgJ3R5cGUnLCB7IHRleHQ6ICdhYScgfSk7XG5cblx0XHRcdGNvbnRyb2xsZXIuYWNjZXB0U2VsZWN0ZWRTdWdnZXN0aW9uKGZhbHNlLCBmYWxzZSk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0VmFsdWUoKSwgJ2FhYTEyMzQ1Njc4OTFhYWEyMzQ1Njc4OScpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdC5za2lwKCdbQnVnXSBcIk5vIHN1Z2dlc3Rpb25zXCIgcGVyc2lzdHMgd2hpbGUgdHlwaW5nIGlmIHRoZSBjb21wbGV0aW9uIGhlbHBlciBpcyBzZXQgdG8gcmV0dXJuIGFuIGVtcHR5IGxpc3QgZm9yIGVtcHR5IGNvbnRlbnQjMzU1NycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRsZXQgcmVxdWVzdENvdW50ID0gMDtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5jb21wbGV0aW9uUHJvdmlkZXIucmVnaXN0ZXIoeyBzY2hlbWU6ICd0ZXN0LWN0cmwnIH0sIHtcblx0XHRcdF9kZWJ1Z0Rpc3BsYXlOYW1lOiAndGVzdCcsXG5cdFx0XHRwcm92aWRlQ29tcGxldGlvbkl0ZW1zKGRvYywgcG9zKSB7XG5cdFx0XHRcdHJlcXVlc3RDb3VudCArPSAxO1xuXG5cdFx0XHRcdGlmIChyZXF1ZXN0Q291bnQgPT09IDEpIHtcblx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRzdWdnZXN0aW9uczogW3tcblx0XHRcdFx0XHRcdGtpbmQ6IENvbXBsZXRpb25JdGVtS2luZC5UZXh0LFxuXHRcdFx0XHRcdFx0bGFiZWw6ICdmb28nLFxuXHRcdFx0XHRcdFx0aW5zZXJ0VGV4dDogJ2ZvbycsXG5cdFx0XHRcdFx0XHRyYW5nZTogbmV3IFJhbmdlKHBvcy5saW5lTnVtYmVyLCAxLCBwb3MubGluZU51bWJlciwgcG9zLmNvbHVtbilcblx0XHRcdFx0XHR9XSxcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRjb25zdCBwMSA9IEV2ZW50LnRvUHJvbWlzZShjb250cm9sbGVyLm1vZGVsLm9uRGlkU3VnZ2VzdCk7XG5cdFx0Y29udHJvbGxlci50cmlnZ2VyU3VnZ2VzdCgpO1xuXG5cdFx0Y29uc3QgZTEgPSBhd2FpdCBwMTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZTEuY29tcGxldGlvbk1vZGVsLml0ZW1zLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcXVlc3RDb3VudCwgMSk7XG5cblx0XHRjb25zdCBwMiA9IEV2ZW50LnRvUHJvbWlzZShjb250cm9sbGVyLm1vZGVsLm9uRGlkU3VnZ2VzdCk7XG5cdFx0ZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgJ3R5cGUnLCB7IHRleHQ6ICdmJyB9KTtcblxuXHRcdGNvbnN0IGUyID0gYXdhaXQgcDI7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGUyLmNvbXBsZXRpb25Nb2RlbC5pdGVtcy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXF1ZXN0Q291bnQsIDIpO1xuXG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsYUFBYTtBQUN0QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLFdBQVc7QUFDcEIsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsYUFBYTtBQUN0QixTQUFTLGlCQUFpQjtBQUUxQixTQUFTLDhCQUE4QiwwQkFBMEI7QUFDakUsU0FBUyw0QkFBNEI7QUFDckMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyw0QkFBNkM7QUFDdEQsU0FBUyx1QkFBdUI7QUFDaEMsU0FBZ0Isb0JBQW9CO0FBQ3BDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsYUFBYSxzQkFBc0I7QUFDNUMsU0FBUyx3QkFBd0IsdUJBQXVCO0FBQ3hELFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMseUJBQXlCO0FBRWxDLE1BQU0scUJBQXFCLFdBQVk7QUFFdEMsUUFBTSxjQUFjLElBQUksZ0JBQWdCO0FBRXhDLE1BQUk7QUFDSixNQUFJO0FBQ0osTUFBSTtBQUNKLFFBQU0sMEJBQTBCLElBQUksd0JBQXdCO0FBRTVELFdBQVMsV0FBWTtBQUVwQixnQkFBWSxNQUFNO0FBQUEsRUFDbkIsQ0FBQztBQUlELFFBQU0sV0FBWTtBQUVqQixVQUFNLG9CQUFvQixJQUFJO0FBQUEsTUFDN0IsQ0FBQywwQkFBMEIsdUJBQXVCO0FBQUEsTUFDbEQsQ0FBQyxtQkFBbUIsb0JBQW9CO0FBQUEsTUFDeEMsQ0FBQyxhQUFhLElBQUksZUFBZSxDQUFDO0FBQUEsTUFDbEMsQ0FBQyxpQkFBaUIsWUFBWSxJQUFJLElBQUksdUJBQXVCLENBQUMsQ0FBQztBQUFBLE1BQy9ELENBQUMsb0JBQW9CLElBQUksc0JBQXNCLENBQUM7QUFBQSxNQUNoRCxDQUFDLHNCQUFzQixJQUFJLGNBQWMsS0FBMkIsRUFBRTtBQUFBLFFBQzVELG9CQUFvQjtBQUM1QixpQkFBTyxRQUFRLFFBQVEsQ0FBQyxDQUFDO0FBQUEsUUFDMUI7QUFBQSxNQUNELEdBQUM7QUFBQSxNQUNELENBQUMsdUJBQXVCLElBQUksY0FBYyxLQUE0QixFQUFFO0FBQUEsUUFDOUQsV0FBaUI7QUFBQSxRQUFFO0FBQUEsUUFDbkIsU0FBaUI7QUFBRSxpQkFBTztBQUFBLFFBQUc7QUFBQSxNQUN2QyxHQUFDO0FBQUEsTUFDRCxDQUFDLGNBQWMsSUFBSSxjQUFjLEtBQW1CLEVBQUU7QUFBQSxRQUM1QyxhQUFhO0FBQ3JCLGlCQUFPLElBQUksY0FBYyxLQUFZLEVBQUU7QUFBQSxZQUE1QjtBQUFBO0FBQ1YsbUJBQVMsY0FBYyxNQUFNO0FBQUE7QUFBQSxZQUNwQixVQUFVO0FBQUEsWUFBRTtBQUFBLFVBQ3RCO0FBQUEsUUFDRDtBQUFBLE1BQ0QsR0FBQztBQUFBLE1BQ0QsQ0FBQyxlQUFlLElBQUksY0FBYyxLQUFvQixFQUFFO0FBQUEsTUFBRSxHQUFDO0FBQUEsTUFDM0QsQ0FBQywwQkFBMEIsSUFBSSxjQUFjLEtBQStCLEVBQUU7QUFBQSxNQUFFLEdBQUM7QUFBQSxNQUNqRixDQUFDLHFCQUFxQixJQUFJLGNBQWMsS0FBMEIsRUFBRTtBQUFBLFFBQTFDO0FBQUE7QUFDekIsZUFBUyxVQUFtQjtBQUM1QixlQUFTLHlCQUFrQztBQUFBO0FBQUEsTUFDNUMsR0FBQztBQUFBLElBQ0Y7QUFFQSxZQUFRLFlBQVksSUFBSSxnQkFBZ0IsSUFBSSxRQUFXLFFBQVcsSUFBSSxLQUFLLEVBQUUsUUFBUSxhQUFhLE1BQU0sWUFBWSxDQUFDLENBQUMsQ0FBQztBQUN2SCxhQUFTLFlBQVksSUFBSSxxQkFBcUIsT0FBTyxFQUFFLGtCQUFrQixDQUFDLENBQUM7QUFFM0UsV0FBTyxtQ0FBbUMsbUJBQW1CLElBQUksa0JBQWtCO0FBQ25GLGlCQUFhLE9BQU8sbUNBQW1DLGtCQUFrQixJQUFJLGlCQUFpQjtBQUFBLEVBQy9GLENBQUM7QUFFRCxPQUFLLHdEQUF3RCxpQkFBa0I7QUFDOUUsZ0JBQVksSUFBSSx3QkFBd0IsbUJBQW1CLFNBQVMsRUFBRSxRQUFRLFlBQVksR0FBRztBQUFBLE1BQzVGLG1CQUFtQjtBQUFBLE1BQ25CLHVCQUF1QixLQUFLLEtBQUs7QUFDaEMsZUFBTztBQUFBLFVBQ04sYUFBYSxDQUFDO0FBQUEsWUFDYixNQUFNLG1CQUFtQjtBQUFBLFlBQ3pCLE9BQU87QUFBQSxZQUNQLFlBQVk7QUFBQSxZQUNaLGlCQUFpQiw2QkFBNkI7QUFBQSxZQUM5QyxPQUFPLEVBQUUsaUJBQWlCLEdBQUcsYUFBYSxHQUFHLGVBQWUsR0FBRyxXQUFXLEdBQUc7QUFBQSxZQUM3RSxxQkFBcUIsQ0FBQztBQUFBLGNBQ3JCLE1BQU07QUFBQSxjQUNOLE9BQU8sRUFBRSxpQkFBaUIsR0FBRyxhQUFhLEdBQUcsZUFBZSxHQUFHLFdBQVcsRUFBRTtBQUFBLFlBQzdFLENBQUM7QUFBQSxVQUNGLENBQUM7QUFBQSxRQUNGO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBRUYsV0FBTyxTQUFTLFlBQVk7QUFDNUIsV0FBTyxhQUFhLElBQUksVUFBVSxHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7QUFHL0MsVUFBTSxLQUFLLE1BQU0sVUFBVSxXQUFXLE1BQU0sWUFBWTtBQUN4RCxlQUFXLGVBQWU7QUFDMUIsVUFBTTtBQUdOLFVBQU0sS0FBSyxNQUFNLFVBQVUsV0FBVyxNQUFNLFdBQVc7QUFDdkQsZUFBVyx5QkFBeUIsT0FBTyxLQUFLO0FBQ2hELFVBQU07QUFFTixXQUFPLFlBQVksT0FBTyxTQUFTLEdBQUcsb0JBQW9CO0FBQUEsRUFDM0QsQ0FBQztBQUVELE9BQUssOENBQThDLGlCQUFrQjtBQUVwRSxnQkFBWSxJQUFJLHdCQUF3QixtQkFBbUIsU0FBUyxFQUFFLFFBQVEsWUFBWSxHQUFHO0FBQUEsTUFDNUYsbUJBQW1CO0FBQUEsTUFDbkIsdUJBQXVCLEtBQUssS0FBSztBQUNoQyxlQUFPO0FBQUEsVUFDTixhQUFhLENBQUM7QUFBQSxZQUNiLE1BQU0sbUJBQW1CO0FBQUEsWUFDekIsT0FBTztBQUFBLFlBQ1AsWUFBWTtBQUFBLFlBQ1osT0FBTyxNQUFNLGNBQWMsR0FBRztBQUFBLFlBQzlCLHFCQUFxQixDQUFDO0FBQUEsY0FDckIsTUFBTTtBQUFBLGNBQ04sT0FBTyxFQUFFLGlCQUFpQixHQUFHLGFBQWEsR0FBRyxlQUFlLEdBQUcsV0FBVyxFQUFFO0FBQUEsWUFDN0UsQ0FBQztBQUFBLFVBQ0YsQ0FBQztBQUFBLFFBQ0Y7QUFBQSxNQUNEO0FBQUEsTUFDQSxNQUFNLHNCQUFzQixNQUFNO0FBQ2pDLGVBQU87QUFBQSxNQUNSO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFFRixXQUFPLFNBQVMsY0FBYztBQUM5QixXQUFPLGFBQWEsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUc3QyxVQUFNLEtBQUssTUFBTSxVQUFVLFdBQVcsTUFBTSxZQUFZO0FBQ3hELGVBQVcsZUFBZTtBQUMxQixVQUFNO0FBR04sVUFBTSxLQUFLLE1BQU0sVUFBVSxXQUFXLE1BQU0sV0FBVztBQUN2RCxlQUFXLHlCQUF5QixPQUFPLEtBQUs7QUFDaEQsVUFBTTtBQUdOLFdBQU8sWUFBWSxPQUFPLFNBQVMsR0FBRyw4QkFBOEI7QUFBQSxFQUNyRSxDQUFDO0FBRUQsT0FBSyxpREFBaUQsaUJBQWtCO0FBRXZFLFFBQUksbUJBQW1CO0FBRXZCLGdCQUFZLElBQUksd0JBQXdCLG1CQUFtQixTQUFTLEVBQUUsUUFBUSxZQUFZLEdBQUc7QUFBQSxNQUM1RixtQkFBbUI7QUFBQSxNQUNuQix1QkFBdUIsS0FBSyxLQUFLO0FBQ2hDLGVBQU87QUFBQSxVQUNOLGFBQWEsQ0FBQztBQUFBLFlBQ2IsTUFBTSxtQkFBbUI7QUFBQSxZQUN6QixPQUFPO0FBQUEsWUFDUCxZQUFZO0FBQUEsWUFDWixPQUFPLE1BQU0sY0FBYyxHQUFHO0FBQUEsVUFDL0IsQ0FBQztBQUFBLFFBQ0Y7QUFBQSxNQUNEO0FBQUEsTUFDQSxNQUFNLHNCQUFzQixNQUFNO0FBQ2pDLDRCQUFvQjtBQUNwQixjQUFNLFFBQVEsRUFBRTtBQUNoQixhQUFLLHNCQUFzQixDQUFDO0FBQUEsVUFDM0IsTUFBTTtBQUFBLFVBQ04sT0FBTyxFQUFFLGlCQUFpQixHQUFHLGFBQWEsR0FBRyxlQUFlLEdBQUcsV0FBVyxFQUFFO0FBQUEsUUFDN0UsQ0FBQztBQUNELGVBQU87QUFBQSxNQUNSO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFFRixXQUFPLFNBQVMsY0FBYztBQUM5QixXQUFPLGFBQWEsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUc3QyxVQUFNLEtBQUssTUFBTSxVQUFVLFdBQVcsTUFBTSxZQUFZO0FBQ3hELGVBQVcsZUFBZTtBQUMxQixVQUFNO0FBR04sVUFBTSxLQUFLLE1BQU0sVUFBVSxXQUFXLE1BQU0sV0FBVztBQUN2RCxlQUFXLHlCQUF5QixPQUFPLEtBQUs7QUFDaEQsVUFBTTtBQUdOLFdBQU8sWUFBWSxPQUFPLFNBQVMsR0FBRyxtQkFBbUI7QUFDekQsV0FBTyxZQUFZLGtCQUFrQixDQUFDO0FBR3RDLFVBQU0sUUFBUSxFQUFFO0FBQ2hCLFdBQU8sWUFBWSxPQUFPLFNBQVMsR0FBRyw4QkFBOEI7QUFHcEUsV0FBTyxTQUFTLEdBQUcsS0FBSztBQUN4QixXQUFPLFlBQVksT0FBTyxTQUFTLEdBQUcsY0FBYztBQUFBLEVBQ3JELENBQUM7QUFFRCxPQUFLLDBEQUEwRCxpQkFBa0I7QUFFaEYsUUFBSSxtQkFBbUI7QUFDdkIsUUFBSSxVQUFvQixNQUFNO0FBQUEsSUFBRTtBQUNoQyxnQkFBWSxJQUFJLHdCQUF3QixtQkFBbUIsU0FBUyxFQUFFLFFBQVEsWUFBWSxHQUFHO0FBQUEsTUFDNUYsbUJBQW1CO0FBQUEsTUFDbkIsdUJBQXVCLEtBQUssS0FBSztBQUNoQyxlQUFPO0FBQUEsVUFDTixhQUFhLENBQUM7QUFBQSxZQUNiLE1BQU0sbUJBQW1CO0FBQUEsWUFDekIsT0FBTztBQUFBLFlBQ1AsWUFBWTtBQUFBLFlBQ1osT0FBTyxNQUFNLGNBQWMsR0FBRztBQUFBLFVBQy9CLENBQUM7QUFBQSxRQUNGO0FBQUEsTUFDRDtBQUFBLE1BQ0EsTUFBTSxzQkFBc0IsTUFBTTtBQUNqQyw0QkFBb0I7QUFDcEIsY0FBTSxJQUFJLFFBQVEsY0FBWSxVQUFVLFFBQVE7QUFDaEQsYUFBSyxzQkFBc0IsQ0FBQztBQUFBLFVBQzNCLE1BQU07QUFBQSxVQUNOLE9BQU8sRUFBRSxpQkFBaUIsR0FBRyxhQUFhLEdBQUcsZUFBZSxHQUFHLFdBQVcsRUFBRTtBQUFBLFFBQzdFLENBQUM7QUFDRCxlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBRUYsV0FBTyxTQUFTLGNBQWM7QUFDOUIsV0FBTyxhQUFhLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFHN0MsVUFBTSxLQUFLLE1BQU0sVUFBVSxXQUFXLE1BQU0sWUFBWTtBQUN4RCxlQUFXLGVBQWU7QUFDMUIsVUFBTTtBQUdOLFVBQU0sS0FBSyxNQUFNLFVBQVUsV0FBVyxNQUFNLFdBQVc7QUFDdkQsZUFBVyx5QkFBeUIsT0FBTyxLQUFLO0FBQ2hELFVBQU07QUFHTixXQUFPLFlBQVksT0FBTyxTQUFTLEdBQUcsbUJBQW1CO0FBQ3pELFdBQU8sWUFBWSxrQkFBa0IsQ0FBQztBQUd0QyxXQUFPLEdBQUcsT0FBTyxhQUFhLEdBQUcsZ0JBQWdCLElBQUksVUFBVSxHQUFHLElBQUksR0FBRyxFQUFFLENBQUMsQ0FBQztBQUM3RSxXQUFPLFFBQVEsUUFBUSxRQUFRLEVBQUUsTUFBTSxTQUFTLENBQUM7QUFFakQsV0FBTyxZQUFZLE9BQU8sU0FBUyxHQUFHLHlCQUF5QjtBQUUvRCxZQUFRO0FBQ1IsVUFBTSxRQUFRLEVBQUU7QUFDaEIsV0FBTyxZQUFZLE9BQU8sU0FBUyxHQUFHLG9DQUFvQztBQUMxRSxXQUFPLEdBQUcsT0FBTyxhQUFhLEdBQUcsZ0JBQWdCLElBQUksVUFBVSxHQUFHLElBQUksR0FBRyxFQUFFLENBQUMsQ0FBQztBQUFBLEVBQzlFLENBQUM7QUFHRCxPQUFLLG1FQUFtRSxpQkFBa0I7QUFFekYsUUFBSSxtQkFBbUI7QUFDdkIsUUFBSSxVQUFvQixNQUFNO0FBQUEsSUFBRTtBQUNoQyxnQkFBWSxJQUFJLHdCQUF3QixtQkFBbUIsU0FBUyxFQUFFLFFBQVEsWUFBWSxHQUFHO0FBQUEsTUFDNUYsbUJBQW1CO0FBQUEsTUFDbkIsdUJBQXVCLEtBQUssS0FBSztBQUNoQyxlQUFPO0FBQUEsVUFDTixhQUFhLENBQUM7QUFBQSxZQUNiLE1BQU0sbUJBQW1CO0FBQUEsWUFDekIsT0FBTztBQUFBLFlBQ1AsWUFBWTtBQUFBLFlBQ1osT0FBTyxNQUFNLGNBQWMsR0FBRztBQUFBLFVBQy9CLENBQUM7QUFBQSxRQUNGO0FBQUEsTUFDRDtBQUFBLE1BQ0EsTUFBTSxzQkFBc0IsTUFBTTtBQUNqQyw0QkFBb0I7QUFDcEIsY0FBTSxJQUFJLFFBQVEsY0FBWSxVQUFVLFFBQVE7QUFDaEQsYUFBSyxzQkFBc0IsQ0FBQztBQUFBLFVBQzNCLE1BQU07QUFBQSxVQUNOLE9BQU8sRUFBRSxpQkFBaUIsR0FBRyxhQUFhLEdBQUcsZUFBZSxHQUFHLFdBQVcsRUFBRTtBQUFBLFFBQzdFLENBQUM7QUFDRCxlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBRUYsV0FBTyxTQUFTLEVBQUU7QUFDbEIsV0FBTyxhQUFhLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFHN0MsVUFBTSxLQUFLLE1BQU0sVUFBVSxXQUFXLE1BQU0sWUFBWTtBQUN4RCxlQUFXLGVBQWU7QUFDMUIsVUFBTTtBQUdOLFVBQU0sS0FBSyxNQUFNLFVBQVUsV0FBVyxNQUFNLFdBQVc7QUFDdkQsZUFBVyx5QkFBeUIsT0FBTyxLQUFLO0FBQ2hELFVBQU07QUFHTixXQUFPLFlBQVksT0FBTyxTQUFTLEdBQUcsT0FBTztBQUM3QyxXQUFPLFlBQVksa0JBQWtCLENBQUM7QUFFdEMsWUFBUTtBQUNSLFVBQU0sUUFBUSxFQUFFO0FBQ2hCLFdBQU8sWUFBWSxPQUFPLFNBQVMsR0FBRyxPQUFPO0FBQUEsRUFDOUMsQ0FBQztBQUdELE9BQUssNERBQTRELGlCQUFrQjtBQUVsRixRQUFJLG1CQUFtQjtBQUN2QixRQUFJLFVBQW9CLE1BQU07QUFBQSxJQUFFO0FBQ2hDLGdCQUFZLElBQUksd0JBQXdCLG1CQUFtQixTQUFTLEVBQUUsUUFBUSxZQUFZLEdBQUc7QUFBQSxNQUM1RixtQkFBbUI7QUFBQSxNQUNuQix1QkFBdUIsS0FBSyxLQUFLO0FBQ2hDLGVBQU87QUFBQSxVQUNOLGFBQWEsQ0FBQztBQUFBLFlBQ2IsTUFBTSxtQkFBbUI7QUFBQSxZQUN6QixPQUFPO0FBQUEsWUFDUCxZQUFZO0FBQUEsWUFDWixPQUFPLE1BQU0sY0FBYyxHQUFHO0FBQUEsVUFDL0IsQ0FBQztBQUFBLFFBQ0Y7QUFBQSxNQUNEO0FBQUEsTUFDQSxNQUFNLHNCQUFzQixNQUFNO0FBQ2pDLDRCQUFvQjtBQUNwQixjQUFNLElBQUksUUFBUSxjQUFZLFVBQVUsUUFBUTtBQUNoRCxhQUFLLHNCQUFzQixDQUFDO0FBQUEsVUFDM0IsTUFBTTtBQUFBLFVBQ04sT0FBTyxFQUFFLGlCQUFpQixHQUFHLGFBQWEsR0FBRyxlQUFlLEdBQUcsV0FBVyxFQUFFO0FBQUEsUUFDN0UsQ0FBQztBQUNELGVBQU87QUFBQSxNQUNSO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFFRixXQUFPLFNBQVMsY0FBYztBQUM5QixXQUFPLGFBQWEsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUc3QyxVQUFNLEtBQUssTUFBTSxVQUFVLFdBQVcsTUFBTSxZQUFZO0FBQ3hELGVBQVcsZUFBZTtBQUMxQixVQUFNO0FBR04sVUFBTSxLQUFLLE1BQU0sVUFBVSxXQUFXLE1BQU0sV0FBVztBQUN2RCxlQUFXLHlCQUF5QixPQUFPLEtBQUs7QUFDaEQsVUFBTTtBQUdOLFdBQU8sWUFBWSxPQUFPLFNBQVMsR0FBRyxtQkFBbUI7QUFDekQsV0FBTyxZQUFZLGtCQUFrQixDQUFDO0FBR3RDLFdBQU8sYUFBYSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQzdDLFdBQU8sUUFBUSxRQUFRLFFBQVEsRUFBRSxNQUFNLFNBQVMsQ0FBQztBQUVqRCxXQUFPLFlBQVksT0FBTyxTQUFTLEdBQUcseUJBQXlCO0FBRS9ELFlBQVE7QUFDUixVQUFNLFFBQVEsRUFBRTtBQUNoQixXQUFPLFlBQVksT0FBTyxTQUFTLEdBQUcseUJBQXlCO0FBQy9ELFdBQU8sR0FBRyxPQUFPLGFBQWEsR0FBRyxnQkFBZ0IsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQUEsRUFDNUUsQ0FBQztBQUVELE9BQUssMERBQTBELGlCQUFrQjtBQUVoRixVQUFNLFVBQXNCLENBQUM7QUFDN0IsZ0JBQVksSUFBSSx3QkFBd0IsbUJBQW1CLFNBQVMsRUFBRSxRQUFRLFlBQVksR0FBRztBQUFBLE1BQzVGLG1CQUFtQjtBQUFBLE1BQ25CLHVCQUF1QixLQUFLLEtBQUs7QUFDaEMsZUFBTztBQUFBLFVBQ04sYUFBYSxDQUFDO0FBQUEsWUFDYixNQUFNLG1CQUFtQjtBQUFBLFlBQ3pCLE9BQU87QUFBQSxZQUNQLFlBQVk7QUFBQSxZQUNaLE9BQU8sTUFBTSxjQUFjLEdBQUc7QUFBQSxVQUMvQixHQUFHO0FBQUEsWUFDRixNQUFNLG1CQUFtQjtBQUFBLFlBQ3pCLE9BQU87QUFBQSxZQUNQLFlBQVk7QUFBQSxZQUNaLE9BQU8sTUFBTSxjQUFjLEdBQUc7QUFBQSxVQUMvQixDQUFDO0FBQUEsUUFDRjtBQUFBLE1BQ0Q7QUFBQSxNQUNBLE1BQU0sc0JBQXNCLE1BQU07QUFDakMsY0FBTSxJQUFJLFFBQVEsY0FBWSxRQUFRLEtBQUssUUFBUSxDQUFDO0FBQ3BELGFBQUssc0JBQXNCLENBQUM7QUFBQSxVQUMzQixNQUFNO0FBQUEsVUFDTixPQUFPLEVBQUUsaUJBQWlCLEdBQUcsYUFBYSxHQUFHLGVBQWUsR0FBRyxXQUFXLEVBQUU7QUFBQSxRQUM3RSxDQUFDO0FBQ0QsZUFBTztBQUFBLE1BQ1I7QUFBQSxJQUNELENBQUMsQ0FBQztBQUVGLFdBQU8sU0FBUyxLQUFLO0FBQ3JCLFdBQU8sYUFBYSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBRzdDLFVBQU0sS0FBSyxNQUFNLFVBQVUsV0FBVyxNQUFNLFlBQVk7QUFDeEQsZUFBVyxlQUFlO0FBQzFCLFVBQU07QUFHTixVQUFNLEtBQUssTUFBTSxVQUFVLFdBQVcsTUFBTSxXQUFXO0FBQ3ZELGVBQVcseUJBQXlCLE1BQU0sS0FBSztBQUMvQyxVQUFNO0FBR04sV0FBTyxZQUFZLE9BQU8sU0FBUyxHQUFHLFVBQVU7QUFHaEQsZUFBVyxxQkFBcUI7QUFHaEMsWUFBUSxRQUFRLFFBQU0sRUFBRTtBQUN4QixZQUFRLFNBQVM7QUFDakIsVUFBTSxRQUFRLEVBQUU7QUFHaEIsV0FBTyxZQUFZLE9BQU8sU0FBUyxHQUFHLFVBQVU7QUFBQSxFQUNqRCxDQUFDO0FBRUQsT0FBSyxzSEFBc0gsaUJBQWtCO0FBRzVJLGdCQUFZLElBQUksd0JBQXdCLG1CQUFtQixTQUFTLEVBQUUsUUFBUSxZQUFZLEdBQUc7QUFBQSxNQUM1RixtQkFBbUI7QUFBQSxNQUNuQix1QkFBdUIsS0FBSyxLQUFLO0FBQ2hDLGVBQU87QUFBQSxVQUNOLGFBQWEsQ0FBQztBQUFBLFlBQ2IsTUFBTSxtQkFBbUI7QUFBQSxZQUN6QixPQUFPO0FBQUEsWUFDUCxZQUFZO0FBQUEsWUFDWixPQUFPLE1BQU0sY0FBYyxHQUFHO0FBQUEsWUFDOUIscUJBQXFCLENBQUM7QUFBQSxjQUNyQixPQUFPLE1BQU0sY0FBYyxHQUFHO0FBQUEsY0FDOUIsTUFBTTtBQUFBLFlBQ1AsQ0FBQztBQUFBLFVBQ0YsQ0FBQztBQUFBLFFBQ0Y7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFFRixXQUFPLFNBQVMsRUFBRTtBQUNsQixXQUFPLGFBQWEsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUc3QyxVQUFNLEtBQUssTUFBTSxVQUFVLFdBQVcsTUFBTSxZQUFZO0FBQ3hELGVBQVcsZUFBZTtBQUMxQixVQUFNO0FBR04sVUFBTSxLQUFLLE1BQU0sVUFBVSxXQUFXLE1BQU0sV0FBVztBQUN2RCxlQUFXLHlCQUF5QixNQUFNLEtBQUs7QUFDL0MsVUFBTTtBQUdOLFdBQU8sWUFBWSxPQUFPLFNBQVMsR0FBRyxxQ0FBcUM7QUFBQSxFQUU1RSxDQUFDO0FBRUQsT0FBSyw0SEFBNEgsaUJBQWtCO0FBQ2xKLGdCQUFZLElBQUksd0JBQXdCLG1CQUFtQixTQUFTLEVBQUUsUUFBUSxZQUFZLEdBQUc7QUFBQSxNQUM1RixtQkFBbUI7QUFBQSxNQUNuQix1QkFBdUIsS0FBSyxLQUFLO0FBRWhDLGNBQU0sT0FBTyxJQUFJLHFCQUFxQixHQUFHO0FBQ3pDLGNBQU0sUUFBUSxJQUFJLE1BQU0sSUFBSSxZQUFZLEtBQUssYUFBYSxJQUFJLFlBQVksS0FBSyxTQUFTO0FBRXhGLGVBQU87QUFBQSxVQUNOLGFBQWEsQ0FBQztBQUFBLFlBQ2IsTUFBTSxtQkFBbUI7QUFBQSxZQUN6QixPQUFPO0FBQUEsWUFDUCxZQUFZO0FBQUEsWUFDWixVQUFVO0FBQUEsWUFDVjtBQUFBLFVBQ0QsR0FBRztBQUFBLFlBQ0YsTUFBTSxtQkFBbUI7QUFBQSxZQUN6QixPQUFPO0FBQUEsWUFDUCxZQUFZO0FBQUEsWUFDWixVQUFVO0FBQUEsWUFDVjtBQUFBLFVBQ0QsQ0FBQztBQUFBLFFBQ0Y7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFFRixXQUFPLFNBQVMsT0FBTztBQUN2QixXQUFPLGFBQWEsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUU3QyxVQUFNLEtBQUssTUFBTSxVQUFVLFdBQVcsTUFBTSxZQUFZO0FBQ3hELGVBQVcsZUFBZTtBQUUxQixVQUFNLEVBQUUsZ0JBQWdCLElBQUksTUFBTTtBQUNsQyxXQUFPLFlBQVksZ0JBQWdCLE1BQU0sUUFBUSxDQUFDO0FBRWxELFVBQU0sQ0FBQyxPQUFPLE1BQU0sSUFBSSxnQkFBZ0I7QUFDeEMsV0FBTyxZQUFZLE1BQU0sV0FBVyxnQkFBZ0I7QUFDcEQsV0FBTyxZQUFZLE9BQU8sV0FBVyxRQUFRO0FBRTdDLFdBQU8sZ0JBQWdCLE9BQU8sYUFBYSxHQUFHLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFDdkUsV0FBTyxRQUFRLFlBQVksUUFBUSxFQUFFLE1BQU0sSUFBSSxDQUFDO0FBQ2hELFdBQU8sZ0JBQWdCLE9BQU8sYUFBYSxHQUFHLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFFdkUsZUFBVyx5QkFBeUIsT0FBTyxLQUFLO0FBQ2hELFdBQU8sWUFBWSxPQUFPLFNBQVMsR0FBRyxRQUFRO0FBQUEsRUFDL0MsQ0FBQztBQUVELE9BQUssK0VBQStFLGlCQUFrQjtBQUNyRyxnQkFBWSxJQUFJLHdCQUF3QixtQkFBbUIsU0FBUyxFQUFFLFFBQVEsWUFBWSxHQUFHO0FBQUEsTUFDNUYsbUJBQW1CO0FBQUEsTUFDbkIsdUJBQXVCLEtBQUssS0FBSztBQUVoQyxjQUFNLE9BQU8sSUFBSSxxQkFBcUIsR0FBRztBQUN6QyxjQUFNLFFBQVEsSUFBSSxNQUFNLElBQUksWUFBWSxLQUFLLGFBQWEsSUFBSSxZQUFZLEtBQUssU0FBUztBQUV4RixlQUFPO0FBQUEsVUFDTixhQUFhLENBQUM7QUFBQSxZQUNiLE1BQU0sbUJBQW1CO0FBQUEsWUFDekIsT0FBTztBQUFBLFlBQ1AsWUFBWTtBQUFBLFlBQ1o7QUFBQSxVQUNELEdBQUc7QUFBQSxZQUNGLE1BQU0sbUJBQW1CO0FBQUEsWUFDekIsT0FBTztBQUFBLFlBQ1AsWUFBWTtBQUFBLFlBQ1o7QUFBQSxVQUNELEdBQUc7QUFBQSxZQUNGLE1BQU0sbUJBQW1CO0FBQUEsWUFDekIsT0FBTztBQUFBLFlBQ1AsWUFBWTtBQUFBLFlBQ1o7QUFBQSxVQUNELEdBQUc7QUFBQSxZQUNGLE1BQU0sbUJBQW1CO0FBQUEsWUFDekIsT0FBTztBQUFBLFlBQ1AsWUFBWTtBQUFBLFlBQ1o7QUFBQSxVQUNELENBQUM7QUFBQSxRQUNGO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBRUYsV0FBTyxTQUFTLEdBQUc7QUFDbkIsV0FBTyxhQUFhLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFFN0MsVUFBTSxLQUFLLE1BQU0sVUFBVSxXQUFXLE1BQU0sWUFBWTtBQUN4RCxlQUFXLGVBQWU7QUFFMUIsVUFBTSxFQUFFLGdCQUFnQixJQUFJLE1BQU07QUFDbEMsV0FBTyxZQUFZLGdCQUFnQixNQUFNLFFBQVEsQ0FBQztBQUVsRCxVQUFNLENBQUMsT0FBTyxRQUFRLE9BQU8sTUFBTSxJQUFJLGdCQUFnQjtBQUN2RCxXQUFPLFlBQVksTUFBTSxXQUFXLE9BQU87QUFDM0MsV0FBTyxZQUFZLE9BQU8sV0FBVyxPQUFPO0FBQzVDLFdBQU8sWUFBWSxNQUFNLFdBQVcsS0FBSztBQUN6QyxXQUFPLFlBQVksT0FBTyxXQUFXLFNBQVM7QUFFOUMsV0FBTyxnQkFBZ0IsT0FBTyxhQUFhLEdBQUcsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUN2RSxXQUFPLFFBQVEsWUFBWSxRQUFRLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFDaEQsV0FBTyxnQkFBZ0IsT0FBTyxhQUFhLEdBQUcsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUV2RSxlQUFXLHlCQUF5QixPQUFPLEtBQUs7QUFDaEQsV0FBTyxZQUFZLE9BQU8sU0FBUyxHQUFHLEtBQUs7QUFBQSxFQUM1QyxDQUFDO0FBRUQsT0FBSyxLQUFLLGtEQUFrRCxpQkFBa0I7QUFFN0UsZ0JBQVksSUFBSSx3QkFBd0IsbUJBQW1CLFNBQVMsRUFBRSxRQUFRLFlBQVksR0FBRztBQUFBLE1BQzVGLG1CQUFtQjtBQUFBLE1BQ25CLHVCQUF1QixLQUFLLEtBQUs7QUFFaEMsY0FBTSxPQUFPLElBQUksZUFBZSxJQUFJLFVBQVU7QUFDOUMsY0FBTSxRQUFRLElBQUksTUFBTSxJQUFJLFlBQVksR0FBRyxJQUFJLFlBQVksSUFBSSxNQUFNO0FBRXJFLGVBQU87QUFBQSxVQUNOLGFBQWEsQ0FBQztBQUFBLFlBQ2IsTUFBTSxtQkFBbUI7QUFBQSxZQUN6QixPQUFPO0FBQUEsWUFDUCxZQUFZO0FBQUEsWUFDWjtBQUFBLFVBQ0QsQ0FBQztBQUFBLFFBQ0Y7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFFRixXQUFPLFNBQVM7QUFBQSx5QkFBaUQ7QUFDakUsV0FBTyxhQUFhLElBQUksVUFBVSxHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7QUFFL0MsVUFBTSxLQUFLLE1BQU0sVUFBVSxXQUFXLE1BQU0sWUFBWTtBQUN4RCxlQUFXLGVBQWU7QUFFMUIsVUFBTTtBQUVOLFVBQU0sS0FBSyxNQUFNLFVBQVUsV0FBVyxNQUFNLFdBQVc7QUFDdkQsUUFBSSxrQkFBa0IsRUFBRSxJQUFJLE1BQU8sTUFBTTtBQUV6QyxVQUFNO0FBQUEsRUFDUCxDQUFDO0FBRUQsT0FBSyxzR0FBc0csaUJBQWtCO0FBQzVILGdCQUFZLElBQUksd0JBQXdCLG1CQUFtQixTQUFTLEVBQUUsUUFBUSxZQUFZLEdBQUc7QUFBQSxNQUM1RixtQkFBbUI7QUFBQSxNQUNuQix1QkFBdUIsS0FBSyxLQUFLO0FBQ2hDLGVBQU87QUFBQSxVQUNOLGFBQWEsQ0FBQztBQUFBLFlBQ2IsTUFBTSxtQkFBbUI7QUFBQSxZQUN6QixPQUFPO0FBQUEsWUFDUCxZQUFZO0FBQUEsWUFDWixPQUFPLE1BQU0sY0FBYyxHQUFHO0FBQUEsWUFDOUIscUJBQXFCLENBQUM7QUFBQSxjQUNyQixPQUFPLE1BQU0sY0FBYyxJQUFJLE1BQU0sR0FBRyxFQUFFLENBQUM7QUFBQSxjQUMzQyxNQUFNO0FBQUEsWUFDUCxDQUFDO0FBQUEsVUFDRixDQUFDO0FBQUEsUUFDRjtBQUFBLE1BQ0Q7QUFBQSxJQUNELENBQUMsQ0FBQztBQUVGO0FBQ0MsYUFBTyxTQUFTLG9CQUFvQjtBQUNwQyxhQUFPLGFBQWEsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUM3QyxZQUFNLEtBQUssTUFBTSxVQUFVLFdBQVcsTUFBTSxZQUFZO0FBQ3hELGlCQUFXLGVBQWU7QUFFMUIsWUFBTSxJQUFJLE1BQU07QUFDaEIsYUFBTyxZQUFZLEVBQUUsZ0JBQWdCLE1BQU0sUUFBUSxDQUFDO0FBQ3BELGFBQU8sWUFBWSxFQUFFLGdCQUFnQixNQUFNLENBQUMsRUFBRSxXQUFXLEtBQUs7QUFFOUQsaUJBQVcseUJBQXlCLE9BQU8sS0FBSztBQUVoRCxhQUFPLFlBQVksT0FBTyxTQUFTLEdBQUcsMEJBQTBCO0FBQUEsSUFDakU7QUFFQTtBQUNDLGFBQU8sU0FBUyxvQkFBb0I7QUFDcEMsYUFBTyxhQUFhLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFDN0MsWUFBTSxLQUFLLE1BQU0sVUFBVSxXQUFXLE1BQU0sWUFBWTtBQUN4RCxpQkFBVyxlQUFlO0FBRTFCLFlBQU0sSUFBSSxNQUFNO0FBQ2hCLGFBQU8sWUFBWSxFQUFFLGdCQUFnQixNQUFNLFFBQVEsQ0FBQztBQUNwRCxhQUFPLFlBQVksRUFBRSxnQkFBZ0IsTUFBTSxDQUFDLEVBQUUsV0FBVyxLQUFLO0FBRTlELGFBQU8sUUFBUSxZQUFZLFFBQVEsRUFBRSxNQUFNLEtBQUssQ0FBQztBQUVqRCxpQkFBVyx5QkFBeUIsT0FBTyxLQUFLO0FBRWhELGFBQU8sWUFBWSxPQUFPLFNBQVMsR0FBRywwQkFBMEI7QUFBQSxJQUNqRTtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssS0FBSywrSEFBK0gsaUJBQWtCO0FBQzFKLFFBQUksZUFBZTtBQUVuQixnQkFBWSxJQUFJLHdCQUF3QixtQkFBbUIsU0FBUyxFQUFFLFFBQVEsWUFBWSxHQUFHO0FBQUEsTUFDNUYsbUJBQW1CO0FBQUEsTUFDbkIsdUJBQXVCLEtBQUssS0FBSztBQUNoQyx3QkFBZ0I7QUFFaEIsWUFBSSxpQkFBaUIsR0FBRztBQUN2QixpQkFBTztBQUFBLFFBQ1I7QUFFQSxlQUFPO0FBQUEsVUFDTixhQUFhLENBQUM7QUFBQSxZQUNiLE1BQU0sbUJBQW1CO0FBQUEsWUFDekIsT0FBTztBQUFBLFlBQ1AsWUFBWTtBQUFBLFlBQ1osT0FBTyxJQUFJLE1BQU0sSUFBSSxZQUFZLEdBQUcsSUFBSSxZQUFZLElBQUksTUFBTTtBQUFBLFVBQy9ELENBQUM7QUFBQSxRQUNGO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBRUYsVUFBTSxLQUFLLE1BQU0sVUFBVSxXQUFXLE1BQU0sWUFBWTtBQUN4RCxlQUFXLGVBQWU7QUFFMUIsVUFBTSxLQUFLLE1BQU07QUFDakIsV0FBTyxZQUFZLEdBQUcsZ0JBQWdCLE1BQU0sUUFBUSxDQUFDO0FBQ3JELFdBQU8sWUFBWSxjQUFjLENBQUM7QUFFbEMsVUFBTSxLQUFLLE1BQU0sVUFBVSxXQUFXLE1BQU0sWUFBWTtBQUN4RCxXQUFPLFFBQVEsWUFBWSxRQUFRLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFFaEQsVUFBTSxLQUFLLE1BQU07QUFDakIsV0FBTyxZQUFZLEdBQUcsZ0JBQWdCLE1BQU0sUUFBUSxDQUFDO0FBQ3JELFdBQU8sWUFBWSxjQUFjLENBQUM7QUFBQSxFQUVuQyxDQUFDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
