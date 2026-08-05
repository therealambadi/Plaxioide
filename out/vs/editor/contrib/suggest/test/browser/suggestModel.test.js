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
import { Disposable, DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
import { URI } from "../../../../../base/common/uri.js";
import { mock } from "../../../../../base/test/common/mock.js";
import { CoreEditingCommands } from "../../../../browser/coreCommands.js";
import { EditOperation } from "../../../../common/core/editOperation.js";
import { Range } from "../../../../common/core/range.js";
import { Selection } from "../../../../common/core/selection.js";
import { Handler } from "../../../../common/editorCommon.js";
import { CompletionItemKind, CompletionTriggerKind, EncodedTokenizationResult, TokenizationRegistry } from "../../../../common/languages.js";
import { MetadataConsts } from "../../../../common/encodedTokenAttributes.js";
import { ILanguageConfigurationService } from "../../../../common/languages/languageConfigurationRegistry.js";
import { NullState } from "../../../../common/languages/nullTokenize.js";
import { ILanguageService } from "../../../../common/languages/language.js";
import { SnippetController2 } from "../../../snippet/browser/snippetController2.js";
import { SuggestController } from "../../browser/suggestController.js";
import { ISuggestMemoryService } from "../../browser/suggestMemory.js";
import { LineContext, SuggestModel } from "../../browser/suggestModel.js";
import { createTestCodeEditor } from "../../../../test/browser/testCodeEditor.js";
import { createModelServices, createTextModel, instantiateTextModel } from "../../../../test/common/testTextModel.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { MockKeybindingService } from "../../../../../platform/keybinding/test/common/mockKeybindingService.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { InMemoryStorageService, IStorageService } from "../../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { NullTelemetryService } from "../../../../../platform/telemetry/common/telemetryUtils.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { LanguageFeaturesService } from "../../../../common/services/languageFeaturesService.js";
import { ILanguageFeaturesService } from "../../../../common/services/languageFeatures.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { getSnippetSuggestSupport, setSnippetSuggestSupport } from "../../browser/suggest.js";
import { IEnvironmentService } from "../../../../../platform/environment/common/environment.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
function createMockEditor(model, languageFeaturesService) {
  const storeService = new InMemoryStorageService();
  const editor = createTestCodeEditor(model, {
    serviceCollection: new ServiceCollection(
      [ILanguageFeaturesService, languageFeaturesService],
      [ITelemetryService, NullTelemetryService],
      [IStorageService, storeService],
      [IKeybindingService, new MockKeybindingService()],
      [ISuggestMemoryService, new class {
        memorize() {
        }
        select() {
          return -1;
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
    )
  });
  const ctrl = editor.registerAndInstantiateContribution(SnippetController2.ID, SnippetController2);
  editor.hasWidgetFocus = () => true;
  editor.registerDisposable(ctrl);
  editor.registerDisposable(storeService);
  return editor;
}
suite("SuggestModel - Context", function() {
  const OUTER_LANGUAGE_ID = "outerMode";
  const INNER_LANGUAGE_ID = "innerMode";
  let OuterMode = class extends Disposable {
    constructor(languageService, languageConfigurationService) {
      super();
      this.languageId = OUTER_LANGUAGE_ID;
      this._register(languageService.registerLanguage({ id: this.languageId }));
      this._register(languageConfigurationService.register(this.languageId, {}));
      this._register(TokenizationRegistry.register(this.languageId, {
        getInitialState: () => NullState,
        tokenize: void 0,
        tokenizeEncoded: (line, hasEOL, state) => {
          const tokensArr = [];
          let prevLanguageId = void 0;
          for (let i = 0; i < line.length; i++) {
            const languageId = line.charAt(i) === "x" ? INNER_LANGUAGE_ID : OUTER_LANGUAGE_ID;
            const encodedLanguageId = languageService.languageIdCodec.encodeLanguageId(languageId);
            if (prevLanguageId !== languageId) {
              tokensArr.push(i);
              tokensArr.push(encodedLanguageId << MetadataConsts.LANGUAGEID_OFFSET);
            }
            prevLanguageId = languageId;
          }
          const tokens = new Uint32Array(tokensArr.length);
          for (let i = 0; i < tokens.length; i++) {
            tokens[i] = tokensArr[i];
          }
          return new EncodedTokenizationResult(tokens, state);
        }
      }));
    }
  };
  OuterMode = __decorateClass([
    __decorateParam(0, ILanguageService),
    __decorateParam(1, ILanguageConfigurationService)
  ], OuterMode);
  let InnerMode = class extends Disposable {
    constructor(languageService, languageConfigurationService) {
      super();
      this.languageId = INNER_LANGUAGE_ID;
      this._register(languageService.registerLanguage({ id: this.languageId }));
      this._register(languageConfigurationService.register(this.languageId, {}));
    }
  };
  InnerMode = __decorateClass([
    __decorateParam(0, ILanguageService),
    __decorateParam(1, ILanguageConfigurationService)
  ], InnerMode);
  const assertAutoTrigger = (model, offset, expected, message) => {
    const pos = model.getPositionAt(offset);
    const editor = createMockEditor(model, new LanguageFeaturesService());
    editor.setPosition(pos);
    assert.strictEqual(LineContext.shouldAutoTrigger(editor), expected, message);
    editor.dispose();
  };
  let disposables;
  setup(() => {
    disposables = new DisposableStore();
  });
  teardown(function() {
    disposables.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("Context - shouldAutoTrigger", function() {
    const model = createTextModel("Das Pferd frisst keinen Gurkensalat - Philipp Reis 1861.\nWer hat's erfunden?");
    disposables.add(model);
    assertAutoTrigger(model, 3, true, "end of word, Das|");
    assertAutoTrigger(model, 4, false, "no word Das |");
    assertAutoTrigger(model, 1, true, "typing a single character before a word: D|as");
    assertAutoTrigger(model, 55, false, "number, 1861|");
    model.dispose();
  });
  test("shouldAutoTrigger at embedded language boundaries", () => {
    const disposables2 = new DisposableStore();
    const instantiationService = createModelServices(disposables2);
    const outerMode = disposables2.add(instantiationService.createInstance(OuterMode));
    disposables2.add(instantiationService.createInstance(InnerMode));
    const model = disposables2.add(instantiateTextModel(instantiationService, "a<xx>a<x>", outerMode.languageId));
    assertAutoTrigger(model, 1, true, "a|<x \u2014 should trigger at end of word");
    assertAutoTrigger(model, 2, false, "a<|x \u2014 should NOT trigger at start of word");
    assertAutoTrigger(model, 3, true, "a<x|x \u2014  should trigger after typing a single character before a word");
    assertAutoTrigger(model, 4, true, "a<xx|> \u2014 should trigger at boundary between languages");
    assertAutoTrigger(model, 5, false, "a<xx>|a \u2014 should NOT trigger at start of word");
    assertAutoTrigger(model, 6, true, "a<xx>a|< \u2014 should trigger at end of word");
    assertAutoTrigger(model, 8, true, "a<xx>a<x|> \u2014 should trigger at end of word at boundary");
    disposables2.dispose();
  });
});
suite("SuggestModel - TriggerAndCancelOracle", function() {
  function getDefaultSuggestRange(model2, position) {
    const wordUntil = model2.getWordUntilPosition(position);
    return new Range(position.lineNumber, wordUntil.startColumn, position.lineNumber, wordUntil.endColumn);
  }
  const alwaysEmptySupport = {
    _debugDisplayName: "test",
    provideCompletionItems(doc, pos) {
      return {
        incomplete: false,
        suggestions: []
      };
    }
  };
  const alwaysSomethingSupport = {
    _debugDisplayName: "test",
    provideCompletionItems(doc, pos) {
      return {
        incomplete: false,
        suggestions: [{
          label: doc.getWordUntilPosition(pos).word,
          kind: CompletionItemKind.Property,
          insertText: "foofoo",
          range: getDefaultSuggestRange(doc, pos)
        }]
      };
    }
  };
  let disposables;
  let model;
  const languageFeaturesService = new LanguageFeaturesService();
  const registry = languageFeaturesService.completionProvider;
  setup(function() {
    disposables = new DisposableStore();
    model = createTextModel("abc def", void 0, void 0, URI.parse("test:somefile.ttt"));
    disposables.add(model);
  });
  teardown(() => {
    disposables.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  function withOracle(callback) {
    return new Promise((resolve, reject) => {
      const editor = createMockEditor(model, languageFeaturesService);
      const oracle = editor.invokeWithinContext((accessor) => accessor.get(IInstantiationService).createInstance(SuggestModel, editor));
      disposables.add(oracle);
      disposables.add(editor);
      try {
        resolve(callback(oracle, editor));
      } catch (err) {
        reject(err);
      }
    });
  }
  function assertEvent(event, action, assert2) {
    return new Promise((resolve, reject) => {
      const sub = event((e) => {
        sub.dispose();
        try {
          resolve(assert2(e));
        } catch (err) {
          reject(err);
        }
      });
      try {
        action();
      } catch (err) {
        sub.dispose();
        reject(err);
      }
    });
  }
  test("events - cancel/trigger", function() {
    return withOracle((model2) => {
      return Promise.all([
        assertEvent(model2.onDidTrigger, function() {
          model2.trigger({ auto: true });
        }, function(event) {
          assert.strictEqual(event.auto, true);
          return assertEvent(model2.onDidCancel, function() {
            model2.cancel();
          }, function(event2) {
            assert.strictEqual(event2.retrigger, false);
          });
        }),
        assertEvent(model2.onDidTrigger, function() {
          model2.trigger({ auto: true });
        }, function(event) {
          assert.strictEqual(event.auto, true);
        }),
        assertEvent(model2.onDidTrigger, function() {
          model2.trigger({ auto: false });
        }, function(event) {
          assert.strictEqual(event.auto, false);
        })
      ]);
    });
  });
  test("events - suggest/empty", function() {
    disposables.add(registry.register({ scheme: "test" }, alwaysEmptySupport));
    return withOracle((model2) => {
      return Promise.all([
        assertEvent(model2.onDidCancel, function() {
          model2.trigger({ auto: true });
        }, function(event) {
          assert.strictEqual(event.retrigger, false);
        }),
        assertEvent(model2.onDidSuggest, function() {
          model2.trigger({ auto: false });
        }, function(event) {
          assert.strictEqual(event.triggerOptions.auto, false);
          assert.strictEqual(event.isFrozen, false);
          assert.strictEqual(event.completionModel.items.length, 0);
        })
      ]);
    });
  });
  test("trigger - on type", function() {
    disposables.add(registry.register({ scheme: "test" }, alwaysSomethingSupport));
    return withOracle((model2, editor) => {
      return assertEvent(model2.onDidSuggest, () => {
        editor.setPosition({ lineNumber: 1, column: 4 });
        editor.trigger("keyboard", Handler.Type, { text: "d" });
      }, (event) => {
        assert.strictEqual(event.triggerOptions.auto, true);
        assert.strictEqual(event.completionModel.items.length, 1);
        const [first] = event.completionModel.items;
        assert.strictEqual(first.provider, alwaysSomethingSupport);
      });
    });
  });
  test("#17400: Keep filtering suggestModel.ts after space", function() {
    disposables.add(registry.register({ scheme: "test" }, {
      _debugDisplayName: "test",
      provideCompletionItems(doc, pos) {
        return {
          incomplete: false,
          suggestions: [{
            label: "My Table",
            kind: CompletionItemKind.Property,
            insertText: "My Table",
            range: getDefaultSuggestRange(doc, pos)
          }]
        };
      }
    }));
    model.setValue("");
    return withOracle((model2, editor) => {
      return assertEvent(model2.onDidSuggest, () => {
        model2.trigger({ auto: true });
      }, (event) => {
        return assertEvent(model2.onDidSuggest, () => {
          editor.setPosition({ lineNumber: 1, column: 1 });
          editor.trigger("keyboard", Handler.Type, { text: "My" });
        }, (event2) => {
          assert.strictEqual(event2.triggerOptions.auto, true);
          assert.strictEqual(event2.completionModel.items.length, 1);
          const [first] = event2.completionModel.items;
          assert.strictEqual(first.completion.label, "My Table");
          return assertEvent(model2.onDidSuggest, () => {
            editor.setPosition({ lineNumber: 1, column: 3 });
            editor.trigger("keyboard", Handler.Type, { text: " " });
          }, (event3) => {
            assert.strictEqual(event3.triggerOptions.auto, true);
            assert.strictEqual(event3.completionModel.items.length, 1);
            const [first2] = event3.completionModel.items;
            assert.strictEqual(first2.completion.label, "My Table");
          });
        });
      });
    });
  });
  test("#21484: Trigger character always force a new completion session", function() {
    disposables.add(registry.register({ scheme: "test" }, {
      _debugDisplayName: "test",
      provideCompletionItems(doc, pos) {
        return {
          incomplete: false,
          suggestions: [{
            label: "foo.bar",
            kind: CompletionItemKind.Property,
            insertText: "foo.bar",
            range: Range.fromPositions(pos.with(void 0, 1), pos)
          }]
        };
      }
    }));
    disposables.add(registry.register({ scheme: "test" }, {
      _debugDisplayName: "test",
      triggerCharacters: ["."],
      provideCompletionItems(doc, pos) {
        return {
          incomplete: false,
          suggestions: [{
            label: "boom",
            kind: CompletionItemKind.Property,
            insertText: "boom",
            range: Range.fromPositions(
              pos.delta(0, doc.getLineContent(pos.lineNumber)[pos.column - 2] === "." ? 0 : -1),
              pos
            )
          }]
        };
      }
    }));
    model.setValue("");
    return withOracle(async (model2, editor) => {
      await assertEvent(model2.onDidSuggest, () => {
        editor.setPosition({ lineNumber: 1, column: 1 });
        editor.trigger("keyboard", Handler.Type, { text: "foo" });
      }, (event) => {
        assert.strictEqual(event.triggerOptions.auto, true);
        assert.strictEqual(event.completionModel.items.length, 1);
        const [first] = event.completionModel.items;
        assert.strictEqual(first.completion.label, "foo.bar");
      });
      await assertEvent(model2.onDidSuggest, () => {
        editor.trigger("keyboard", Handler.Type, { text: "." });
      }, (event) => {
        assert.strictEqual(event.triggerOptions.auto, true);
        assert.strictEqual(event.completionModel.items.length, 1);
        const [first] = event.completionModel.items;
        assert.strictEqual(first.completion.label, "foo.bar");
      });
      await assertEvent(model2.onDidSuggest, () => {
      }, (event) => {
        assert.strictEqual(event.triggerOptions.auto, true);
        assert.strictEqual(event.completionModel.items.length, 2);
        const [first, second] = event.completionModel.items;
        assert.strictEqual(first.completion.label, "foo.bar");
        assert.strictEqual(second.completion.label, "boom");
      });
    });
  });
  test("Intellisense Completion doesn't respect space after equal sign (.html file), #29353 [1/2]", function() {
    disposables.add(registry.register({ scheme: "test" }, alwaysSomethingSupport));
    return withOracle((model2, editor) => {
      editor.getModel().setValue("fo");
      editor.setPosition({ lineNumber: 1, column: 3 });
      return assertEvent(model2.onDidSuggest, () => {
        model2.trigger({ auto: false });
      }, (event) => {
        assert.strictEqual(event.triggerOptions.auto, false);
        assert.strictEqual(event.isFrozen, false);
        assert.strictEqual(event.completionModel.items.length, 1);
        return assertEvent(model2.onDidCancel, () => {
          editor.trigger("keyboard", Handler.Type, { text: "+" });
        }, (event2) => {
          assert.strictEqual(event2.retrigger, false);
        });
      });
    });
  });
  test("Intellisense Completion doesn't respect space after equal sign (.html file), #29353 [2/2]", function() {
    disposables.add(registry.register({ scheme: "test" }, alwaysSomethingSupport));
    return withOracle((model2, editor) => {
      editor.getModel().setValue("fo");
      editor.setPosition({ lineNumber: 1, column: 3 });
      return assertEvent(model2.onDidSuggest, () => {
        model2.trigger({ auto: false });
      }, (event) => {
        assert.strictEqual(event.triggerOptions.auto, false);
        assert.strictEqual(event.isFrozen, false);
        assert.strictEqual(event.completionModel.items.length, 1);
        return assertEvent(model2.onDidCancel, () => {
          editor.trigger("keyboard", Handler.Type, { text: " " });
        }, (event2) => {
          assert.strictEqual(event2.retrigger, false);
        });
      });
    });
  });
  test("Incomplete suggestion results cause re-triggering when typing w/o further context, #28400 (1/2)", function() {
    disposables.add(registry.register({ scheme: "test" }, {
      _debugDisplayName: "test",
      provideCompletionItems(doc, pos) {
        return {
          incomplete: true,
          suggestions: [{
            label: "foo",
            kind: CompletionItemKind.Property,
            insertText: "foo",
            range: Range.fromPositions(pos.with(void 0, 1), pos)
          }]
        };
      }
    }));
    return withOracle((model2, editor) => {
      editor.getModel().setValue("foo");
      editor.setPosition({ lineNumber: 1, column: 4 });
      return assertEvent(model2.onDidSuggest, () => {
        model2.trigger({ auto: false });
      }, (event) => {
        assert.strictEqual(event.triggerOptions.auto, false);
        assert.strictEqual(event.completionModel.getIncompleteProvider().size, 1);
        assert.strictEqual(event.completionModel.items.length, 1);
        return assertEvent(model2.onDidCancel, () => {
          editor.trigger("keyboard", Handler.Type, { text: ";" });
        }, (event2) => {
          assert.strictEqual(event2.retrigger, false);
        });
      });
    });
  });
  test("Incomplete suggestion results cause re-triggering when typing w/o further context, #28400 (2/2)", function() {
    disposables.add(registry.register({ scheme: "test" }, {
      _debugDisplayName: "test",
      provideCompletionItems(doc, pos) {
        return {
          incomplete: true,
          suggestions: [{
            label: "foo;",
            kind: CompletionItemKind.Property,
            insertText: "foo",
            range: Range.fromPositions(pos.with(void 0, 1), pos)
          }]
        };
      }
    }));
    return withOracle((model2, editor) => {
      editor.getModel().setValue("foo");
      editor.setPosition({ lineNumber: 1, column: 4 });
      return assertEvent(model2.onDidSuggest, () => {
        model2.trigger({ auto: false });
      }, (event) => {
        assert.strictEqual(event.triggerOptions.auto, false);
        assert.strictEqual(event.completionModel.getIncompleteProvider().size, 1);
        assert.strictEqual(event.completionModel.items.length, 1);
        return assertEvent(model2.onDidSuggest, () => {
          editor.trigger("keyboard", Handler.Type, { text: ";" });
        }, (event2) => {
          assert.strictEqual(event2.triggerOptions.auto, false);
          assert.strictEqual(event2.completionModel.getIncompleteProvider().size, 1);
          assert.strictEqual(event2.completionModel.items.length, 1);
        });
      });
    });
  });
  test("Trigger character is provided in suggest context", function() {
    let triggerCharacter = "";
    disposables.add(registry.register({ scheme: "test" }, {
      _debugDisplayName: "test",
      triggerCharacters: ["."],
      provideCompletionItems(doc, pos, context) {
        assert.strictEqual(context.triggerKind, CompletionTriggerKind.TriggerCharacter);
        triggerCharacter = context.triggerCharacter;
        return {
          incomplete: false,
          suggestions: [
            {
              label: "foo.bar",
              kind: CompletionItemKind.Property,
              insertText: "foo.bar",
              range: Range.fromPositions(pos.with(void 0, 1), pos)
            }
          ]
        };
      }
    }));
    model.setValue("");
    return withOracle((model2, editor) => {
      return assertEvent(model2.onDidSuggest, () => {
        editor.setPosition({ lineNumber: 1, column: 1 });
        editor.trigger("keyboard", Handler.Type, { text: "foo." });
      }, (event) => {
        assert.strictEqual(triggerCharacter, ".");
      });
    });
  });
  test("Mac press and hold accent character insertion does not update suggestions, #35269", function() {
    disposables.add(registry.register({ scheme: "test" }, {
      _debugDisplayName: "test",
      provideCompletionItems(doc, pos) {
        return {
          incomplete: true,
          suggestions: [{
            label: "abc",
            kind: CompletionItemKind.Property,
            insertText: "abc",
            range: Range.fromPositions(pos.with(void 0, 1), pos)
          }, {
            label: "\xE4bc",
            kind: CompletionItemKind.Property,
            insertText: "\xE4bc",
            range: Range.fromPositions(pos.with(void 0, 1), pos)
          }]
        };
      }
    }));
    model.setValue("");
    return withOracle((model2, editor) => {
      return assertEvent(model2.onDidSuggest, () => {
        editor.setPosition({ lineNumber: 1, column: 1 });
        editor.trigger("keyboard", Handler.Type, { text: "a" });
      }, (event) => {
        assert.strictEqual(event.completionModel.items.length, 1);
        assert.strictEqual(event.completionModel.items[0].completion.label, "abc");
        return assertEvent(model2.onDidSuggest, () => {
          editor.executeEdits("test", [EditOperation.replace(new Range(1, 1, 1, 2), "\xE4")]);
        }, (event2) => {
          assert.strictEqual(event2.completionModel.items.length, 1);
          assert.strictEqual(event2.completionModel.items[0].completion.label, "\xE4bc");
        });
      });
    });
  });
  test("Backspace should not always cancel code completion, #36491", function() {
    disposables.add(registry.register({ scheme: "test" }, alwaysSomethingSupport));
    return withOracle(async (model2, editor) => {
      await assertEvent(model2.onDidSuggest, () => {
        editor.setPosition({ lineNumber: 1, column: 4 });
        editor.trigger("keyboard", Handler.Type, { text: "d" });
      }, (event) => {
        assert.strictEqual(event.triggerOptions.auto, true);
        assert.strictEqual(event.completionModel.items.length, 1);
        const [first] = event.completionModel.items;
        assert.strictEqual(first.provider, alwaysSomethingSupport);
      });
      await assertEvent(model2.onDidSuggest, () => {
        CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      }, (event) => {
        assert.strictEqual(event.triggerOptions.auto, true);
        assert.strictEqual(event.completionModel.items.length, 1);
        const [first] = event.completionModel.items;
        assert.strictEqual(first.provider, alwaysSomethingSupport);
      });
    });
  });
  test("Text changes for completion CodeAction are affected by the completion #39893", function() {
    disposables.add(registry.register({ scheme: "test" }, {
      _debugDisplayName: "test",
      provideCompletionItems(doc, pos) {
        return {
          incomplete: true,
          suggestions: [{
            label: "bar",
            kind: CompletionItemKind.Property,
            insertText: "bar",
            range: Range.fromPositions(pos.delta(0, -2), pos),
            additionalTextEdits: [{
              text: ", bar",
              range: { startLineNumber: 1, endLineNumber: 1, startColumn: 17, endColumn: 17 }
            }]
          }]
        };
      }
    }));
    model.setValue('ba; import { foo } from "./b"');
    return withOracle(async (sugget, editor) => {
      class TestCtrl extends SuggestController {
        _insertSuggestion_publicForTest(item, flags = 0) {
          super._insertSuggestion(item, flags);
        }
      }
      const ctrl = editor.registerAndInstantiateContribution(TestCtrl.ID, TestCtrl);
      editor.registerAndInstantiateContribution(SnippetController2.ID, SnippetController2);
      await assertEvent(sugget.onDidSuggest, () => {
        editor.setPosition({ lineNumber: 1, column: 3 });
        sugget.trigger({ auto: false });
      }, (event) => {
        assert.strictEqual(event.completionModel.items.length, 1);
        const [first] = event.completionModel.items;
        assert.strictEqual(first.completion.label, "bar");
        ctrl._insertSuggestion_publicForTest({ item: first, index: 0, model: event.completionModel });
      });
      assert.strictEqual(
        model.getValue(),
        'bar; import { foo, bar } from "./b"'
      );
    });
  });
  test("Completion unexpectedly triggers on second keypress of an edit group in a snippet #43523", function() {
    disposables.add(registry.register({ scheme: "test" }, alwaysSomethingSupport));
    return withOracle((model2, editor) => {
      return assertEvent(model2.onDidSuggest, () => {
        editor.setValue("d");
        editor.setSelection(new Selection(1, 1, 1, 2));
        editor.trigger("keyboard", Handler.Type, { text: "e" });
      }, (event) => {
        assert.strictEqual(event.triggerOptions.auto, true);
        assert.strictEqual(event.completionModel.items.length, 1);
        const [first] = event.completionModel.items;
        assert.strictEqual(first.provider, alwaysSomethingSupport);
      });
    });
  });
  test("Fails to render completion details #47988", function() {
    let disposeA = 0;
    let disposeB = 0;
    disposables.add(registry.register({ scheme: "test" }, {
      _debugDisplayName: "test",
      provideCompletionItems(doc, pos) {
        return {
          incomplete: true,
          suggestions: [{
            kind: CompletionItemKind.Folder,
            label: "CompleteNot",
            insertText: "Incomplete",
            sortText: "a",
            range: getDefaultSuggestRange(doc, pos)
          }],
          dispose() {
            disposeA += 1;
          }
        };
      }
    }));
    disposables.add(registry.register({ scheme: "test" }, {
      _debugDisplayName: "test",
      provideCompletionItems(doc, pos) {
        return {
          incomplete: false,
          suggestions: [{
            kind: CompletionItemKind.Folder,
            label: "Complete",
            insertText: "Complete",
            sortText: "z",
            range: getDefaultSuggestRange(doc, pos)
          }],
          dispose() {
            disposeB += 1;
          }
        };
      },
      resolveCompletionItem(item) {
        return item;
      }
    }));
    return withOracle(async (model2, editor) => {
      await assertEvent(model2.onDidSuggest, () => {
        editor.setValue("");
        editor.setSelection(new Selection(1, 1, 1, 1));
        editor.trigger("keyboard", Handler.Type, { text: "c" });
      }, (event) => {
        assert.strictEqual(event.triggerOptions.auto, true);
        assert.strictEqual(event.completionModel.items.length, 2);
        assert.strictEqual(disposeA, 0);
        assert.strictEqual(disposeB, 0);
      });
      await assertEvent(model2.onDidSuggest, () => {
        editor.trigger("keyboard", Handler.Type, { text: "o" });
      }, (event) => {
        assert.strictEqual(event.triggerOptions.auto, true);
        assert.strictEqual(event.completionModel.items.length, 2);
        model2.clear();
        assert.strictEqual(disposeA, 2);
        assert.strictEqual(disposeB, 1);
      });
    });
  });
  test("Trigger (full) completions when (incomplete) completions are already active #99504", function() {
    let countA = 0;
    let countB = 0;
    disposables.add(registry.register({ scheme: "test" }, {
      _debugDisplayName: "test",
      provideCompletionItems(doc, pos) {
        countA += 1;
        return {
          incomplete: false,
          // doesn't matter if incomplete or not
          suggestions: [{
            kind: CompletionItemKind.Class,
            label: "Z aaa",
            insertText: "Z aaa",
            range: new Range(1, 1, pos.lineNumber, pos.column)
          }]
        };
      }
    }));
    disposables.add(registry.register({ scheme: "test" }, {
      _debugDisplayName: "test",
      provideCompletionItems(doc, pos) {
        countB += 1;
        if (!doc.getWordUntilPosition(pos).word.startsWith("a")) {
          return;
        }
        return {
          incomplete: false,
          suggestions: [{
            kind: CompletionItemKind.Folder,
            label: "aaa",
            insertText: "aaa",
            range: getDefaultSuggestRange(doc, pos)
          }]
        };
      }
    }));
    return withOracle(async (model2, editor) => {
      await assertEvent(model2.onDidSuggest, () => {
        editor.setValue("");
        editor.setSelection(new Selection(1, 1, 1, 1));
        editor.trigger("keyboard", Handler.Type, { text: "Z" });
      }, (event) => {
        assert.strictEqual(event.triggerOptions.auto, true);
        assert.strictEqual(event.completionModel.items.length, 1);
        assert.strictEqual(event.completionModel.items[0].textLabel, "Z aaa");
      });
      await assertEvent(model2.onDidSuggest, () => {
        editor.trigger("keyboard", Handler.Type, { text: " a" });
      }, (event) => {
        assert.strictEqual(event.triggerOptions.auto, true);
        assert.strictEqual(event.completionModel.items.length, 2);
        assert.strictEqual(event.completionModel.items[0].textLabel, "Z aaa");
        assert.strictEqual(event.completionModel.items[1].textLabel, "aaa");
        assert.strictEqual(countA, 1);
        assert.strictEqual(countB, 2);
      });
    });
  });
  test("registerCompletionItemProvider with letters as trigger characters block other completion items to show up #127815", async function() {
    disposables.add(registry.register({ scheme: "test" }, {
      _debugDisplayName: "test",
      provideCompletionItems(doc, pos) {
        return {
          suggestions: [{
            kind: CompletionItemKind.Class,
            label: "AAAA",
            insertText: "WordTriggerA",
            range: new Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column)
          }]
        };
      }
    }));
    disposables.add(registry.register({ scheme: "test" }, {
      _debugDisplayName: "test",
      triggerCharacters: ["a", "."],
      provideCompletionItems(doc, pos) {
        return {
          suggestions: [{
            kind: CompletionItemKind.Class,
            label: "AAAA",
            insertText: "AutoTriggerA",
            range: new Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column)
          }]
        };
      }
    }));
    return withOracle(async (model2, editor) => {
      await assertEvent(model2.onDidSuggest, () => {
        editor.setValue("");
        editor.setSelection(new Selection(1, 1, 1, 1));
        editor.trigger("keyboard", Handler.Type, { text: "." });
      }, (event) => {
        assert.strictEqual(event.triggerOptions.auto, true);
        assert.strictEqual(event.completionModel.items.length, 1);
      });
      editor.getModel().setValue("");
      await assertEvent(model2.onDidSuggest, () => {
        editor.setValue("");
        editor.setSelection(new Selection(1, 1, 1, 1));
        editor.trigger("keyboard", Handler.Type, { text: "a" });
      }, (event) => {
        assert.strictEqual(event.triggerOptions.auto, true);
        assert.strictEqual(event.completionModel.items.length, 2);
      });
    });
  });
  test("Unexpected suggest scoring #167242", async function() {
    disposables.add(registry.register("*", {
      // word-based
      _debugDisplayName: "test",
      provideCompletionItems(doc, pos) {
        const word = doc.getWordUntilPosition(pos);
        return {
          suggestions: [{
            kind: CompletionItemKind.Text,
            label: "pull",
            insertText: "pull",
            range: new Range(pos.lineNumber, word.startColumn, pos.lineNumber, word.endColumn)
          }]
        };
      }
    }));
    disposables.add(registry.register({ scheme: "test" }, {
      // JSON-based
      _debugDisplayName: "test",
      provideCompletionItems(doc, pos) {
        return {
          suggestions: [{
            kind: CompletionItemKind.Class,
            label: "git.pull",
            insertText: "git.pull",
            range: new Range(pos.lineNumber, 1, pos.lineNumber, pos.column)
          }]
        };
      }
    }));
    return withOracle(async function(model2, editor) {
      await assertEvent(model2.onDidSuggest, () => {
        editor.setValue("gi");
        editor.setSelection(new Selection(1, 3, 1, 3));
        editor.trigger("keyboard", Handler.Type, { text: "t" });
      }, (event) => {
        assert.strictEqual(event.triggerOptions.auto, true);
        assert.strictEqual(event.completionModel.items.length, 1);
        assert.strictEqual(event.completionModel.items[0].textLabel, "git.pull");
      });
      editor.trigger("keyboard", Handler.Type, { text: "." });
      await assertEvent(model2.onDidSuggest, () => {
        editor.trigger("keyboard", Handler.Type, { text: "p" });
      }, (event) => {
        assert.strictEqual(event.triggerOptions.auto, true);
        assert.strictEqual(event.completionModel.items.length, 1);
        assert.strictEqual(event.completionModel.items[0].textLabel, "git.pull");
      });
    });
  });
  test("Completion list closes unexpectedly when typing a digit after a word separator #169390", function() {
    const requestCounts = [0, 0];
    disposables.add(registry.register({ scheme: "test" }, {
      _debugDisplayName: "test",
      provideCompletionItems(doc, pos) {
        requestCounts[0] += 1;
        return {
          suggestions: [{
            kind: CompletionItemKind.Text,
            label: "foo-20",
            insertText: "foo-20",
            range: new Range(pos.lineNumber, 1, pos.lineNumber, pos.column)
          }, {
            kind: CompletionItemKind.Text,
            label: "foo-hello",
            insertText: "foo-hello",
            range: new Range(pos.lineNumber, 1, pos.lineNumber, pos.column)
          }]
        };
      }
    }));
    disposables.add(registry.register({ scheme: "test" }, {
      _debugDisplayName: "test",
      triggerCharacters: ["2"],
      provideCompletionItems(doc, pos, ctx) {
        requestCounts[1] += 1;
        if (ctx.triggerKind !== CompletionTriggerKind.TriggerCharacter) {
          return;
        }
        return {
          suggestions: [{
            kind: CompletionItemKind.Class,
            label: "foo-210",
            insertText: "foo-210",
            range: new Range(pos.lineNumber, 1, pos.lineNumber, pos.column)
          }]
        };
      }
    }));
    return withOracle(async function(model2, editor) {
      await assertEvent(model2.onDidSuggest, () => {
        editor.setValue("foo");
        editor.setSelection(new Selection(1, 4, 1, 4));
        model2.trigger({ auto: false });
      }, (event) => {
        assert.strictEqual(event.triggerOptions.auto, false);
        assert.strictEqual(event.completionModel.items.length, 2);
        assert.strictEqual(event.completionModel.items[0].textLabel, "foo-20");
        assert.strictEqual(event.completionModel.items[1].textLabel, "foo-hello");
      });
      editor.trigger("keyboard", Handler.Type, { text: "-" });
      await assertEvent(model2.onDidSuggest, () => {
        editor.trigger("keyboard", Handler.Type, { text: "2" });
      }, (event) => {
        assert.strictEqual(event.triggerOptions.auto, true);
        assert.strictEqual(event.completionModel.items.length, 2);
        assert.strictEqual(event.completionModel.items[0].textLabel, "foo-20");
        assert.strictEqual(event.completionModel.items[1].textLabel, "foo-210");
        assert.deepStrictEqual(requestCounts, [1, 2]);
      });
    });
  });
  test("Set refilter-flag, keep triggerKind", function() {
    disposables.add(registry.register({ scheme: "test" }, {
      _debugDisplayName: "test",
      triggerCharacters: ["."],
      provideCompletionItems(doc, pos, ctx) {
        return {
          suggestions: [{
            label: doc.getWordUntilPosition(pos).word || "hello",
            kind: CompletionItemKind.Property,
            insertText: "foofoo",
            range: getDefaultSuggestRange(doc, pos)
          }]
        };
      }
    }));
    return withOracle(async function(model2, editor) {
      await assertEvent(model2.onDidSuggest, () => {
        editor.setValue("foo");
        editor.setSelection(new Selection(1, 4, 1, 4));
        editor.trigger("keyboard", Handler.Type, { text: "o" });
      }, (event) => {
        assert.strictEqual(event.triggerOptions.auto, true);
        assert.strictEqual(event.triggerOptions.triggerCharacter, void 0);
        assert.strictEqual(event.triggerOptions.triggerKind, void 0);
        assert.strictEqual(event.completionModel.items.length, 1);
      });
      await assertEvent(model2.onDidSuggest, () => {
        editor.trigger("keyboard", Handler.Type, { text: "." });
      }, (event) => {
        assert.strictEqual(event.triggerOptions.auto, true);
        assert.strictEqual(event.triggerOptions.refilter, void 0);
        assert.strictEqual(event.triggerOptions.triggerCharacter, ".");
        assert.strictEqual(event.triggerOptions.triggerKind, CompletionTriggerKind.TriggerCharacter);
        assert.strictEqual(event.completionModel.items.length, 1);
      });
      await assertEvent(model2.onDidSuggest, () => {
        editor.trigger("keyboard", Handler.Type, { text: "h" });
      }, (event) => {
        assert.strictEqual(event.triggerOptions.auto, true);
        assert.strictEqual(event.triggerOptions.refilter, true);
        assert.strictEqual(event.triggerOptions.triggerCharacter, ".");
        assert.strictEqual(event.triggerOptions.triggerKind, CompletionTriggerKind.TriggerCharacter);
        assert.strictEqual(event.completionModel.items.length, 1);
      });
    });
  });
  test("Snippets gone from IntelliSense #173244", function() {
    const snippetProvider = {
      _debugDisplayName: "test",
      provideCompletionItems(doc, pos, ctx) {
        return {
          suggestions: [{
            label: "log",
            kind: CompletionItemKind.Snippet,
            insertText: "log",
            range: getDefaultSuggestRange(doc, pos)
          }]
        };
      }
    };
    const old = setSnippetSuggestSupport(snippetProvider);
    disposables.add(toDisposable(() => {
      if (getSnippetSuggestSupport() === snippetProvider) {
        setSnippetSuggestSupport(old);
      }
    }));
    disposables.add(registry.register({ scheme: "test" }, {
      _debugDisplayName: "test",
      triggerCharacters: ["."],
      provideCompletionItems(doc, pos, ctx) {
        return {
          suggestions: [{
            label: "locals",
            kind: CompletionItemKind.Property,
            insertText: "locals",
            range: getDefaultSuggestRange(doc, pos)
          }],
          incomplete: true
        };
      }
    }));
    return withOracle(async function(model2, editor) {
      await assertEvent(model2.onDidSuggest, () => {
        editor.setValue("");
        editor.setSelection(new Selection(1, 1, 1, 1));
        editor.trigger("keyboard", Handler.Type, { text: "l" });
      }, (event) => {
        assert.strictEqual(event.triggerOptions.auto, true);
        assert.strictEqual(event.triggerOptions.triggerCharacter, void 0);
        assert.strictEqual(event.triggerOptions.triggerKind, void 0);
        assert.strictEqual(event.completionModel.items.length, 2);
        assert.strictEqual(event.completionModel.items[0].textLabel, "locals");
        assert.strictEqual(event.completionModel.items[1].textLabel, "log");
      });
      await assertEvent(model2.onDidSuggest, () => {
        editor.trigger("keyboard", Handler.Type, { text: "o" });
      }, (event) => {
        assert.strictEqual(event.triggerOptions.triggerKind, CompletionTriggerKind.TriggerForIncompleteCompletions);
        assert.strictEqual(event.triggerOptions.auto, true);
        assert.strictEqual(event.completionModel.items.length, 2);
        assert.strictEqual(event.completionModel.items[0].textLabel, "locals");
        assert.strictEqual(event.completionModel.items[1].textLabel, "log");
      });
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9zdWdnZXN0L3Rlc3QvYnJvd3Nlci9zdWdnZXN0TW9kZWwudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBtb2NrIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi9tb2NrLmpzJztcbmltcG9ydCB7IENvcmVFZGl0aW5nQ29tbWFuZHMgfSBmcm9tICcuLi8uLi8uLi8uLi9icm93c2VyL2NvcmVDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBFZGl0T3BlcmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvZWRpdE9wZXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IEhhbmRsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL21vZGVsL3RleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBDb21wbGV0aW9uSXRlbUtpbmQsIENvbXBsZXRpb25JdGVtUHJvdmlkZXIsIENvbXBsZXRpb25MaXN0LCBDb21wbGV0aW9uVHJpZ2dlcktpbmQsIEVuY29kZWRUb2tlbml6YXRpb25SZXN1bHQsIElTdGF0ZSwgVG9rZW5pemF0aW9uUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IE1ldGFkYXRhQ29uc3RzIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VuY29kZWRUb2tlbkF0dHJpYnV0ZXMuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlQ29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IE51bGxTdGF0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMvbnVsbFRva2VuaXplLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IFNuaXBwZXRDb250cm9sbGVyMiB9IGZyb20gJy4uLy4uLy4uL3NuaXBwZXQvYnJvd3Nlci9zbmlwcGV0Q29udHJvbGxlcjIuanMnO1xuaW1wb3J0IHsgU3VnZ2VzdENvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi9icm93c2VyL3N1Z2dlc3RDb250cm9sbGVyLmpzJztcbmltcG9ydCB7IElTdWdnZXN0TWVtb3J5U2VydmljZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvc3VnZ2VzdE1lbW9yeS5qcyc7XG5pbXBvcnQgeyBMaW5lQ29udGV4dCwgU3VnZ2VzdE1vZGVsIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9zdWdnZXN0TW9kZWwuanMnO1xuaW1wb3J0IHsgSVNlbGVjdGVkU3VnZ2VzdGlvbiB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvc3VnZ2VzdFdpZGdldC5qcyc7XG5pbXBvcnQgeyBjcmVhdGVUZXN0Q29kZUVkaXRvciwgSVRlc3RDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9icm93c2VyL3Rlc3RDb2RlRWRpdG9yLmpzJztcbmltcG9ydCB7IGNyZWF0ZU1vZGVsU2VydmljZXMsIGNyZWF0ZVRleHRNb2RlbCwgaW5zdGFudGlhdGVUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2NvbW1vbi90ZXN0VGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IFNlcnZpY2VDb2xsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vc2VydmljZUNvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBNb2NrS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL3Rlc3QvY29tbW9uL21vY2tLZXliaW5kaW5nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTGFiZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGFiZWwvY29tbW9uL2xhYmVsLmpzJztcbmltcG9ydCB7IEluTWVtb3J5U3RvcmFnZVNlcnZpY2UsIElTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBOdWxsVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5VXRpbHMuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBnZXRTbmlwcGV0U3VnZ2VzdFN1cHBvcnQsIHNldFNuaXBwZXRTdWdnZXN0U3VwcG9ydCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvc3VnZ2VzdC5qcyc7XG5pbXBvcnQgeyBJRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50LmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuXG5cbmZ1bmN0aW9uIGNyZWF0ZU1vY2tFZGl0b3IobW9kZWw6IFRleHRNb2RlbCwgbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2U6IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSk6IElUZXN0Q29kZUVkaXRvciB7XG5cblx0Y29uc3Qgc3RvcmVTZXJ2aWNlID0gbmV3IEluTWVtb3J5U3RvcmFnZVNlcnZpY2UoKTtcblx0Y29uc3QgZWRpdG9yID0gY3JlYXRlVGVzdENvZGVFZGl0b3IobW9kZWwsIHtcblx0XHRzZXJ2aWNlQ29sbGVjdGlvbjogbmV3IFNlcnZpY2VDb2xsZWN0aW9uKFxuXHRcdFx0W0lMYW5ndWFnZUZlYXR1cmVzU2VydmljZSwgbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2VdLFxuXHRcdFx0W0lUZWxlbWV0cnlTZXJ2aWNlLCBOdWxsVGVsZW1ldHJ5U2VydmljZV0sXG5cdFx0XHRbSVN0b3JhZ2VTZXJ2aWNlLCBzdG9yZVNlcnZpY2VdLFxuXHRcdFx0W0lLZXliaW5kaW5nU2VydmljZSwgbmV3IE1vY2tLZXliaW5kaW5nU2VydmljZSgpXSxcblx0XHRcdFtJU3VnZ2VzdE1lbW9yeVNlcnZpY2UsIG5ldyBjbGFzcyBpbXBsZW1lbnRzIElTdWdnZXN0TWVtb3J5U2VydmljZSB7XG5cdFx0XHRcdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHRcdFx0XHRtZW1vcml6ZSgpOiB2b2lkIHtcblx0XHRcdFx0fVxuXHRcdFx0XHRzZWxlY3QoKTogbnVtYmVyIHtcblx0XHRcdFx0XHRyZXR1cm4gLTE7XG5cdFx0XHRcdH1cblx0XHRcdH1dLFxuXHRcdFx0W0lMYWJlbFNlcnZpY2UsIG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SUxhYmVsU2VydmljZT4oKSB7IH1dLFxuXHRcdFx0W0lXb3Jrc3BhY2VDb250ZXh0U2VydmljZSwgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJV29ya3NwYWNlQ29udGV4dFNlcnZpY2U+KCkgeyB9XSxcblx0XHRcdFtJRW52aXJvbm1lbnRTZXJ2aWNlLCBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElFbnZpcm9ubWVudFNlcnZpY2U+KCkge1xuXHRcdFx0XHRvdmVycmlkZSBpc0J1aWx0OiBib29sZWFuID0gdHJ1ZTtcblx0XHRcdFx0b3ZlcnJpZGUgaXNFeHRlbnNpb25EZXZlbG9wbWVudDogYm9vbGVhbiA9IGZhbHNlO1xuXHRcdFx0fV0sXG5cdFx0KSxcblx0fSk7XG5cdGNvbnN0IGN0cmwgPSBlZGl0b3IucmVnaXN0ZXJBbmRJbnN0YW50aWF0ZUNvbnRyaWJ1dGlvbihTbmlwcGV0Q29udHJvbGxlcjIuSUQsIFNuaXBwZXRDb250cm9sbGVyMik7XG5cdGVkaXRvci5oYXNXaWRnZXRGb2N1cyA9ICgpID0+IHRydWU7XG5cblx0ZWRpdG9yLnJlZ2lzdGVyRGlzcG9zYWJsZShjdHJsKTtcblx0ZWRpdG9yLnJlZ2lzdGVyRGlzcG9zYWJsZShzdG9yZVNlcnZpY2UpO1xuXHRyZXR1cm4gZWRpdG9yO1xufVxuXG5zdWl0ZSgnU3VnZ2VzdE1vZGVsIC0gQ29udGV4dCcsIGZ1bmN0aW9uICgpIHtcblx0Y29uc3QgT1VURVJfTEFOR1VBR0VfSUQgPSAnb3V0ZXJNb2RlJztcblx0Y29uc3QgSU5ORVJfTEFOR1VBR0VfSUQgPSAnaW5uZXJNb2RlJztcblxuXHRjbGFzcyBPdXRlck1vZGUgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0XHRwdWJsaWMgcmVhZG9ubHkgbGFuZ3VhZ2VJZCA9IE9VVEVSX0xBTkdVQUdFX0lEO1xuXHRcdGNvbnN0cnVjdG9yKFxuXHRcdFx0QElMYW5ndWFnZVNlcnZpY2UgbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRcdFx0QElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2U6IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdCkge1xuXHRcdFx0c3VwZXIoKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKGxhbmd1YWdlU2VydmljZS5yZWdpc3Rlckxhbmd1YWdlKHsgaWQ6IHRoaXMubGFuZ3VhZ2VJZCB9KSk7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLnJlZ2lzdGVyKHRoaXMubGFuZ3VhZ2VJZCwge30pKTtcblxuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoVG9rZW5pemF0aW9uUmVnaXN0cnkucmVnaXN0ZXIodGhpcy5sYW5ndWFnZUlkLCB7XG5cdFx0XHRcdGdldEluaXRpYWxTdGF0ZTogKCk6IElTdGF0ZSA9PiBOdWxsU3RhdGUsXG5cdFx0XHRcdHRva2VuaXplOiB1bmRlZmluZWQhLFxuXHRcdFx0XHR0b2tlbml6ZUVuY29kZWQ6IChsaW5lOiBzdHJpbmcsIGhhc0VPTDogYm9vbGVhbiwgc3RhdGU6IElTdGF0ZSk6IEVuY29kZWRUb2tlbml6YXRpb25SZXN1bHQgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IHRva2Vuc0FycjogbnVtYmVyW10gPSBbXTtcblx0XHRcdFx0XHRsZXQgcHJldkxhbmd1YWdlSWQ6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGxpbmUubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRcdGNvbnN0IGxhbmd1YWdlSWQgPSAobGluZS5jaGFyQXQoaSkgPT09ICd4JyA/IElOTkVSX0xBTkdVQUdFX0lEIDogT1VURVJfTEFOR1VBR0VfSUQpO1xuXHRcdFx0XHRcdFx0Y29uc3QgZW5jb2RlZExhbmd1YWdlSWQgPSBsYW5ndWFnZVNlcnZpY2UubGFuZ3VhZ2VJZENvZGVjLmVuY29kZUxhbmd1YWdlSWQobGFuZ3VhZ2VJZCk7XG5cdFx0XHRcdFx0XHRpZiAocHJldkxhbmd1YWdlSWQgIT09IGxhbmd1YWdlSWQpIHtcblx0XHRcdFx0XHRcdFx0dG9rZW5zQXJyLnB1c2goaSk7XG5cdFx0XHRcdFx0XHRcdHRva2Vuc0Fyci5wdXNoKChlbmNvZGVkTGFuZ3VhZ2VJZCA8PCBNZXRhZGF0YUNvbnN0cy5MQU5HVUFHRUlEX09GRlNFVCkpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cHJldkxhbmd1YWdlSWQgPSBsYW5ndWFnZUlkO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNvbnN0IHRva2VucyA9IG5ldyBVaW50MzJBcnJheSh0b2tlbnNBcnIubGVuZ3RoKTtcblx0XHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRva2Vucy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdFx0dG9rZW5zW2ldID0gdG9rZW5zQXJyW2ldO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gbmV3IEVuY29kZWRUb2tlbml6YXRpb25SZXN1bHQodG9rZW5zLCBzdGF0ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9XG5cdH1cblxuXHRjbGFzcyBJbm5lck1vZGUgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0XHRwdWJsaWMgcmVhZG9ubHkgbGFuZ3VhZ2VJZCA9IElOTkVSX0xBTkdVQUdFX0lEO1xuXHRcdGNvbnN0cnVjdG9yKFxuXHRcdFx0QElMYW5ndWFnZVNlcnZpY2UgbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRcdFx0QElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2U6IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlXG5cdFx0KSB7XG5cdFx0XHRzdXBlcigpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIobGFuZ3VhZ2VTZXJ2aWNlLnJlZ2lzdGVyTGFuZ3VhZ2UoeyBpZDogdGhpcy5sYW5ndWFnZUlkIH0pKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UucmVnaXN0ZXIodGhpcy5sYW5ndWFnZUlkLCB7fSkpO1xuXHRcdH1cblx0fVxuXG5cdGNvbnN0IGFzc2VydEF1dG9UcmlnZ2VyID0gKG1vZGVsOiBUZXh0TW9kZWwsIG9mZnNldDogbnVtYmVyLCBleHBlY3RlZDogYm9vbGVhbiwgbWVzc2FnZT86IHN0cmluZyk6IHZvaWQgPT4ge1xuXHRcdGNvbnN0IHBvcyA9IG1vZGVsLmdldFBvc2l0aW9uQXQob2Zmc2V0KTtcblx0XHRjb25zdCBlZGl0b3IgPSBjcmVhdGVNb2NrRWRpdG9yKG1vZGVsLCBuZXcgTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UoKSk7XG5cdFx0ZWRpdG9yLnNldFBvc2l0aW9uKHBvcyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKExpbmVDb250ZXh0LnNob3VsZEF1dG9UcmlnZ2VyKGVkaXRvciksIGV4cGVjdGVkLCBtZXNzYWdlKTtcblx0XHRlZGl0b3IuZGlzcG9zZSgpO1xuXHR9O1xuXG5cdGxldCBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlO1xuXG5cdHNldHVwKCgpID0+IHtcblx0XHRkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0fSk7XG5cblx0dGVhcmRvd24oZnVuY3Rpb24gKCkge1xuXHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnQ29udGV4dCAtIHNob3VsZEF1dG9UcmlnZ2VyJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKCdEYXMgUGZlcmQgZnJpc3N0IGtlaW5lbiBHdXJrZW5zYWxhdCAtIFBoaWxpcHAgUmVpcyAxODYxLlxcbldlciBoYXRcXCdzIGVyZnVuZGVuPycpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtb2RlbCk7XG5cblx0XHRhc3NlcnRBdXRvVHJpZ2dlcihtb2RlbCwgMywgdHJ1ZSwgJ2VuZCBvZiB3b3JkLCBEYXN8Jyk7XG5cdFx0YXNzZXJ0QXV0b1RyaWdnZXIobW9kZWwsIDQsIGZhbHNlLCAnbm8gd29yZCBEYXMgfCcpO1xuXHRcdGFzc2VydEF1dG9UcmlnZ2VyKG1vZGVsLCAxLCB0cnVlLCAndHlwaW5nIGEgc2luZ2xlIGNoYXJhY3RlciBiZWZvcmUgYSB3b3JkOiBEfGFzJyk7XG5cdFx0YXNzZXJ0QXV0b1RyaWdnZXIobW9kZWwsIDU1LCBmYWxzZSwgJ251bWJlciwgMTg2MXwnKTtcblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Nob3VsZEF1dG9UcmlnZ2VyIGF0IGVtYmVkZGVkIGxhbmd1YWdlIGJvdW5kYXJpZXMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBjcmVhdGVNb2RlbFNlcnZpY2VzKGRpc3Bvc2FibGVzKTtcblx0XHRjb25zdCBvdXRlck1vZGUgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoT3V0ZXJNb2RlKSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKElubmVyTW9kZSkpO1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGVUZXh0TW9kZWwoaW5zdGFudGlhdGlvblNlcnZpY2UsICdhPHh4PmE8eD4nLCBvdXRlck1vZGUubGFuZ3VhZ2VJZCkpO1xuXG5cdFx0YXNzZXJ0QXV0b1RyaWdnZXIobW9kZWwsIDEsIHRydWUsICdhfDx4IFx1MjAxNCBzaG91bGQgdHJpZ2dlciBhdCBlbmQgb2Ygd29yZCcpO1xuXHRcdGFzc2VydEF1dG9UcmlnZ2VyKG1vZGVsLCAyLCBmYWxzZSwgJ2E8fHggXHUyMDE0IHNob3VsZCBOT1QgdHJpZ2dlciBhdCBzdGFydCBvZiB3b3JkJyk7XG5cdFx0YXNzZXJ0QXV0b1RyaWdnZXIobW9kZWwsIDMsIHRydWUsICdhPHh8eCBcdTIwMTQgIHNob3VsZCB0cmlnZ2VyIGFmdGVyIHR5cGluZyBhIHNpbmdsZSBjaGFyYWN0ZXIgYmVmb3JlIGEgd29yZCcpO1xuXHRcdGFzc2VydEF1dG9UcmlnZ2VyKG1vZGVsLCA0LCB0cnVlLCAnYTx4eHw+IFx1MjAxNCBzaG91bGQgdHJpZ2dlciBhdCBib3VuZGFyeSBiZXR3ZWVuIGxhbmd1YWdlcycpO1xuXHRcdGFzc2VydEF1dG9UcmlnZ2VyKG1vZGVsLCA1LCBmYWxzZSwgJ2E8eHg+fGEgXHUyMDE0IHNob3VsZCBOT1QgdHJpZ2dlciBhdCBzdGFydCBvZiB3b3JkJyk7XG5cdFx0YXNzZXJ0QXV0b1RyaWdnZXIobW9kZWwsIDYsIHRydWUsICdhPHh4PmF8PCBcdTIwMTQgc2hvdWxkIHRyaWdnZXIgYXQgZW5kIG9mIHdvcmQnKTtcblx0XHRhc3NlcnRBdXRvVHJpZ2dlcihtb2RlbCwgOCwgdHJ1ZSwgJ2E8eHg+YTx4fD4gXHUyMDE0IHNob3VsZCB0cmlnZ2VyIGF0IGVuZCBvZiB3b3JkIGF0IGJvdW5kYXJ5Jyk7XG5cblx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH0pO1xufSk7XG5cbnN1aXRlKCdTdWdnZXN0TW9kZWwgLSBUcmlnZ2VyQW5kQ2FuY2VsT3JhY2xlJywgZnVuY3Rpb24gKCkge1xuXG5cblx0ZnVuY3Rpb24gZ2V0RGVmYXVsdFN1Z2dlc3RSYW5nZShtb2RlbDogSVRleHRNb2RlbCwgcG9zaXRpb246IFBvc2l0aW9uKSB7XG5cdFx0Y29uc3Qgd29yZFVudGlsID0gbW9kZWwuZ2V0V29yZFVudGlsUG9zaXRpb24ocG9zaXRpb24pO1xuXHRcdHJldHVybiBuZXcgUmFuZ2UocG9zaXRpb24ubGluZU51bWJlciwgd29yZFVudGlsLnN0YXJ0Q29sdW1uLCBwb3NpdGlvbi5saW5lTnVtYmVyLCB3b3JkVW50aWwuZW5kQ29sdW1uKTtcblx0fVxuXG5cdGNvbnN0IGFsd2F5c0VtcHR5U3VwcG9ydDogQ29tcGxldGlvbkl0ZW1Qcm92aWRlciA9IHtcblx0XHRfZGVidWdEaXNwbGF5TmFtZTogJ3Rlc3QnLFxuXHRcdHByb3ZpZGVDb21wbGV0aW9uSXRlbXMoZG9jLCBwb3MpOiBDb21wbGV0aW9uTGlzdCB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRpbmNvbXBsZXRlOiBmYWxzZSxcblx0XHRcdFx0c3VnZ2VzdGlvbnM6IFtdXG5cdFx0XHR9O1xuXHRcdH1cblx0fTtcblxuXHRjb25zdCBhbHdheXNTb21ldGhpbmdTdXBwb3J0OiBDb21wbGV0aW9uSXRlbVByb3ZpZGVyID0ge1xuXHRcdF9kZWJ1Z0Rpc3BsYXlOYW1lOiAndGVzdCcsXG5cdFx0cHJvdmlkZUNvbXBsZXRpb25JdGVtcyhkb2MsIHBvcyk6IENvbXBsZXRpb25MaXN0IHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGluY29tcGxldGU6IGZhbHNlLFxuXHRcdFx0XHRzdWdnZXN0aW9uczogW3tcblx0XHRcdFx0XHRsYWJlbDogZG9jLmdldFdvcmRVbnRpbFBvc2l0aW9uKHBvcykud29yZCxcblx0XHRcdFx0XHRraW5kOiBDb21wbGV0aW9uSXRlbUtpbmQuUHJvcGVydHksXG5cdFx0XHRcdFx0aW5zZXJ0VGV4dDogJ2Zvb2ZvbycsXG5cdFx0XHRcdFx0cmFuZ2U6IGdldERlZmF1bHRTdWdnZXN0UmFuZ2UoZG9jLCBwb3MpXG5cdFx0XHRcdH1dXG5cdFx0XHR9O1xuXHRcdH1cblx0fTtcblxuXHRsZXQgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcblx0bGV0IG1vZGVsOiBUZXh0TW9kZWw7XG5cdGNvbnN0IGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlID0gbmV3IExhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlKCk7XG5cdGNvbnN0IHJlZ2lzdHJ5ID0gbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29tcGxldGlvblByb3ZpZGVyO1xuXG5cdHNldHVwKGZ1bmN0aW9uICgpIHtcblx0XHRkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbCgnYWJjIGRlZicsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBVUkkucGFyc2UoJ3Rlc3Q6c29tZWZpbGUudHR0JykpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtb2RlbCk7XG5cdH0pO1xuXG5cdHRlYXJkb3duKCgpID0+IHtcblx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGZ1bmN0aW9uIHdpdGhPcmFjbGUoY2FsbGJhY2s6IChtb2RlbDogU3VnZ2VzdE1vZGVsLCBlZGl0b3I6IElUZXN0Q29kZUVkaXRvcikgPT4gYW55KTogUHJvbWlzZTxhbnk+IHtcblxuXHRcdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRjb25zdCBlZGl0b3IgPSBjcmVhdGVNb2NrRWRpdG9yKG1vZGVsLCBsYW5ndWFnZUZlYXR1cmVzU2VydmljZSk7XG5cdFx0XHRjb25zdCBvcmFjbGUgPSBlZGl0b3IuaW52b2tlV2l0aGluQ29udGV4dChhY2Nlc3NvciA9PiBhY2Nlc3Nvci5nZXQoSUluc3RhbnRpYXRpb25TZXJ2aWNlKS5jcmVhdGVJbnN0YW5jZShTdWdnZXN0TW9kZWwsIGVkaXRvcikpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKG9yYWNsZSk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoZWRpdG9yKTtcblxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0cmVzb2x2ZShjYWxsYmFjayhvcmFjbGUsIGVkaXRvcikpO1xuXHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdHJlamVjdChlcnIpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0ZnVuY3Rpb24gYXNzZXJ0RXZlbnQ8RT4oZXZlbnQ6IEV2ZW50PEU+LCBhY3Rpb246ICgpID0+IGFueSwgYXNzZXJ0OiAoZTogRSkgPT4gYW55KSB7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdGNvbnN0IHN1YiA9IGV2ZW50KGUgPT4ge1xuXHRcdFx0XHRzdWIuZGlzcG9zZSgpO1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdHJlc29sdmUoYXNzZXJ0KGUpKTtcblx0XHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdFx0cmVqZWN0KGVycik7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YWN0aW9uKCk7XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0c3ViLmRpc3Bvc2UoKTtcblx0XHRcdFx0cmVqZWN0KGVycik7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHR0ZXN0KCdldmVudHMgLSBjYW5jZWwvdHJpZ2dlcicsIGZ1bmN0aW9uICgpIHtcblx0XHRyZXR1cm4gd2l0aE9yYWNsZShtb2RlbCA9PiB7XG5cblx0XHRcdHJldHVybiBQcm9taXNlLmFsbChbXG5cblx0XHRcdFx0YXNzZXJ0RXZlbnQobW9kZWwub25EaWRUcmlnZ2VyLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0bW9kZWwudHJpZ2dlcih7IGF1dG86IHRydWUgfSk7XG5cdFx0XHRcdH0sIGZ1bmN0aW9uIChldmVudCkge1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC5hdXRvLCB0cnVlKTtcblxuXHRcdFx0XHRcdHJldHVybiBhc3NlcnRFdmVudChtb2RlbC5vbkRpZENhbmNlbCwgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0bW9kZWwuY2FuY2VsKCk7XG5cdFx0XHRcdFx0fSwgZnVuY3Rpb24gKGV2ZW50KSB7XG5cdFx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQucmV0cmlnZ2VyLCBmYWxzZSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pLFxuXG5cdFx0XHRcdGFzc2VydEV2ZW50KG1vZGVsLm9uRGlkVHJpZ2dlciwgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdG1vZGVsLnRyaWdnZXIoeyBhdXRvOiB0cnVlIH0pO1xuXHRcdFx0XHR9LCBmdW5jdGlvbiAoZXZlbnQpIHtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQuYXV0bywgdHJ1ZSk7XG5cdFx0XHRcdH0pLFxuXG5cdFx0XHRcdGFzc2VydEV2ZW50KG1vZGVsLm9uRGlkVHJpZ2dlciwgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdG1vZGVsLnRyaWdnZXIoeyBhdXRvOiBmYWxzZSB9KTtcblx0XHRcdFx0fSwgZnVuY3Rpb24gKGV2ZW50KSB7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LmF1dG8sIGZhbHNlKTtcblx0XHRcdFx0fSlcblx0XHRcdF0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXG5cdHRlc3QoJ2V2ZW50cyAtIHN1Z2dlc3QvZW1wdHknLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQocmVnaXN0cnkucmVnaXN0ZXIoeyBzY2hlbWU6ICd0ZXN0JyB9LCBhbHdheXNFbXB0eVN1cHBvcnQpKTtcblxuXHRcdHJldHVybiB3aXRoT3JhY2xlKG1vZGVsID0+IHtcblx0XHRcdHJldHVybiBQcm9taXNlLmFsbChbXG5cdFx0XHRcdGFzc2VydEV2ZW50KG1vZGVsLm9uRGlkQ2FuY2VsLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0bW9kZWwudHJpZ2dlcih7IGF1dG86IHRydWUgfSk7XG5cdFx0XHRcdH0sIGZ1bmN0aW9uIChldmVudCkge1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC5yZXRyaWdnZXIsIGZhbHNlKTtcblx0XHRcdFx0fSksXG5cdFx0XHRcdGFzc2VydEV2ZW50KG1vZGVsLm9uRGlkU3VnZ2VzdCwgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdG1vZGVsLnRyaWdnZXIoeyBhdXRvOiBmYWxzZSB9KTtcblx0XHRcdFx0fSwgZnVuY3Rpb24gKGV2ZW50KSB7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LnRyaWdnZXJPcHRpb25zLmF1dG8sIGZhbHNlKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQuaXNGcm96ZW4sIGZhbHNlKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQuY29tcGxldGlvbk1vZGVsLml0ZW1zLmxlbmd0aCwgMCk7XG5cdFx0XHRcdH0pXG5cdFx0XHRdKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgndHJpZ2dlciAtIG9uIHR5cGUnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQocmVnaXN0cnkucmVnaXN0ZXIoeyBzY2hlbWU6ICd0ZXN0JyB9LCBhbHdheXNTb21ldGhpbmdTdXBwb3J0KSk7XG5cblx0XHRyZXR1cm4gd2l0aE9yYWNsZSgobW9kZWwsIGVkaXRvcikgPT4ge1xuXHRcdFx0cmV0dXJuIGFzc2VydEV2ZW50KG1vZGVsLm9uRGlkU3VnZ2VzdCwgKCkgPT4ge1xuXHRcdFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24oeyBsaW5lTnVtYmVyOiAxLCBjb2x1bW46IDQgfSk7XG5cdFx0XHRcdGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsIEhhbmRsZXIuVHlwZSwgeyB0ZXh0OiAnZCcgfSk7XG5cblx0XHRcdH0sIGV2ZW50ID0+IHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LnRyaWdnZXJPcHRpb25zLmF1dG8sIHRydWUpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQuY29tcGxldGlvbk1vZGVsLml0ZW1zLmxlbmd0aCwgMSk7XG5cdFx0XHRcdGNvbnN0IFtmaXJzdF0gPSBldmVudC5jb21wbGV0aW9uTW9kZWwuaXRlbXM7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LnByb3ZpZGVyLCBhbHdheXNTb21ldGhpbmdTdXBwb3J0KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCcjMTc0MDA6IEtlZXAgZmlsdGVyaW5nIHN1Z2dlc3RNb2RlbC50cyBhZnRlciBzcGFjZScsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3RyeS5yZWdpc3Rlcih7IHNjaGVtZTogJ3Rlc3QnIH0sIHtcblx0XHRcdF9kZWJ1Z0Rpc3BsYXlOYW1lOiAndGVzdCcsXG5cdFx0XHRwcm92aWRlQ29tcGxldGlvbkl0ZW1zKGRvYywgcG9zKTogQ29tcGxldGlvbkxpc3Qge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGluY29tcGxldGU6IGZhbHNlLFxuXHRcdFx0XHRcdHN1Z2dlc3Rpb25zOiBbe1xuXHRcdFx0XHRcdFx0bGFiZWw6ICdNeSBUYWJsZScsXG5cdFx0XHRcdFx0XHRraW5kOiBDb21wbGV0aW9uSXRlbUtpbmQuUHJvcGVydHksXG5cdFx0XHRcdFx0XHRpbnNlcnRUZXh0OiAnTXkgVGFibGUnLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IGdldERlZmF1bHRTdWdnZXN0UmFuZ2UoZG9jLCBwb3MpXG5cdFx0XHRcdFx0fV1cblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRtb2RlbC5zZXRWYWx1ZSgnJyk7XG5cblx0XHRyZXR1cm4gd2l0aE9yYWNsZSgobW9kZWwsIGVkaXRvcikgPT4ge1xuXG5cdFx0XHRyZXR1cm4gYXNzZXJ0RXZlbnQobW9kZWwub25EaWRTdWdnZXN0LCAoKSA9PiB7XG5cdFx0XHRcdC8vIG1ha2Ugc3VyZSBjb21wbGV0aW9uTW9kZWwgc3RhcnRzIGhlcmUhXG5cdFx0XHRcdG1vZGVsLnRyaWdnZXIoeyBhdXRvOiB0cnVlIH0pO1xuXHRcdFx0fSwgZXZlbnQgPT4ge1xuXG5cdFx0XHRcdHJldHVybiBhc3NlcnRFdmVudChtb2RlbC5vbkRpZFN1Z2dlc3QsICgpID0+IHtcblx0XHRcdFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24oeyBsaW5lTnVtYmVyOiAxLCBjb2x1bW46IDEgfSk7XG5cdFx0XHRcdFx0ZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgSGFuZGxlci5UeXBlLCB7IHRleHQ6ICdNeScgfSk7XG5cblx0XHRcdFx0fSwgZXZlbnQgPT4ge1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC50cmlnZ2VyT3B0aW9ucy5hdXRvLCB0cnVlKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQuY29tcGxldGlvbk1vZGVsLml0ZW1zLmxlbmd0aCwgMSk7XG5cdFx0XHRcdFx0Y29uc3QgW2ZpcnN0XSA9IGV2ZW50LmNvbXBsZXRpb25Nb2RlbC5pdGVtcztcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QuY29tcGxldGlvbi5sYWJlbCwgJ015IFRhYmxlJyk7XG5cblx0XHRcdFx0XHRyZXR1cm4gYXNzZXJ0RXZlbnQobW9kZWwub25EaWRTdWdnZXN0LCAoKSA9PiB7XG5cdFx0XHRcdFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24oeyBsaW5lTnVtYmVyOiAxLCBjb2x1bW46IDMgfSk7XG5cdFx0XHRcdFx0XHRlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCBIYW5kbGVyLlR5cGUsIHsgdGV4dDogJyAnIH0pO1xuXG5cdFx0XHRcdFx0fSwgZXZlbnQgPT4ge1xuXHRcdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LnRyaWdnZXJPcHRpb25zLmF1dG8sIHRydWUpO1xuXHRcdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LmNvbXBsZXRpb25Nb2RlbC5pdGVtcy5sZW5ndGgsIDEpO1xuXHRcdFx0XHRcdFx0Y29uc3QgW2ZpcnN0XSA9IGV2ZW50LmNvbXBsZXRpb25Nb2RlbC5pdGVtcztcblx0XHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC5jb21wbGV0aW9uLmxhYmVsLCAnTXkgVGFibGUnKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnIzIxNDg0OiBUcmlnZ2VyIGNoYXJhY3RlciBhbHdheXMgZm9yY2UgYSBuZXcgY29tcGxldGlvbiBzZXNzaW9uJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHJlZ2lzdHJ5LnJlZ2lzdGVyKHsgc2NoZW1lOiAndGVzdCcgfSwge1xuXHRcdFx0X2RlYnVnRGlzcGxheU5hbWU6ICd0ZXN0Jyxcblx0XHRcdHByb3ZpZGVDb21wbGV0aW9uSXRlbXMoZG9jLCBwb3MpOiBDb21wbGV0aW9uTGlzdCB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0aW5jb21wbGV0ZTogZmFsc2UsXG5cdFx0XHRcdFx0c3VnZ2VzdGlvbnM6IFt7XG5cdFx0XHRcdFx0XHRsYWJlbDogJ2Zvby5iYXInLFxuXHRcdFx0XHRcdFx0a2luZDogQ29tcGxldGlvbkl0ZW1LaW5kLlByb3BlcnR5LFxuXHRcdFx0XHRcdFx0aW5zZXJ0VGV4dDogJ2Zvby5iYXInLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IFJhbmdlLmZyb21Qb3NpdGlvbnMocG9zLndpdGgodW5kZWZpbmVkLCAxKSwgcG9zKVxuXHRcdFx0XHRcdH1dXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHJlZ2lzdHJ5LnJlZ2lzdGVyKHsgc2NoZW1lOiAndGVzdCcgfSwge1xuXHRcdFx0X2RlYnVnRGlzcGxheU5hbWU6ICd0ZXN0Jyxcblx0XHRcdHRyaWdnZXJDaGFyYWN0ZXJzOiBbJy4nXSxcblx0XHRcdHByb3ZpZGVDb21wbGV0aW9uSXRlbXMoZG9jLCBwb3MpOiBDb21wbGV0aW9uTGlzdCB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0aW5jb21wbGV0ZTogZmFsc2UsXG5cdFx0XHRcdFx0c3VnZ2VzdGlvbnM6IFt7XG5cdFx0XHRcdFx0XHRsYWJlbDogJ2Jvb20nLFxuXHRcdFx0XHRcdFx0a2luZDogQ29tcGxldGlvbkl0ZW1LaW5kLlByb3BlcnR5LFxuXHRcdFx0XHRcdFx0aW5zZXJ0VGV4dDogJ2Jvb20nLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IFJhbmdlLmZyb21Qb3NpdGlvbnMoXG5cdFx0XHRcdFx0XHRcdHBvcy5kZWx0YSgwLCBkb2MuZ2V0TGluZUNvbnRlbnQocG9zLmxpbmVOdW1iZXIpW3Bvcy5jb2x1bW4gLSAyXSA9PT0gJy4nID8gMCA6IC0xKSxcblx0XHRcdFx0XHRcdFx0cG9zXG5cdFx0XHRcdFx0XHQpXG5cdFx0XHRcdFx0fV1cblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRtb2RlbC5zZXRWYWx1ZSgnJyk7XG5cblx0XHRyZXR1cm4gd2l0aE9yYWNsZShhc3luYyAobW9kZWwsIGVkaXRvcikgPT4ge1xuXG5cdFx0XHRhd2FpdCBhc3NlcnRFdmVudChtb2RlbC5vbkRpZFN1Z2dlc3QsICgpID0+IHtcblx0XHRcdFx0ZWRpdG9yLnNldFBvc2l0aW9uKHsgbGluZU51bWJlcjogMSwgY29sdW1uOiAxIH0pO1xuXHRcdFx0XHRlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCBIYW5kbGVyLlR5cGUsIHsgdGV4dDogJ2ZvbycgfSk7XG5cblx0XHRcdH0sIGV2ZW50ID0+IHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LnRyaWdnZXJPcHRpb25zLmF1dG8sIHRydWUpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQuY29tcGxldGlvbk1vZGVsLml0ZW1zLmxlbmd0aCwgMSk7XG5cdFx0XHRcdGNvbnN0IFtmaXJzdF0gPSBldmVudC5jb21wbGV0aW9uTW9kZWwuaXRlbXM7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC5jb21wbGV0aW9uLmxhYmVsLCAnZm9vLmJhcicpO1xuXG5cdFx0XHR9KTtcblxuXHRcdFx0YXdhaXQgYXNzZXJ0RXZlbnQobW9kZWwub25EaWRTdWdnZXN0LCAoKSA9PiB7XG5cdFx0XHRcdGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsIEhhbmRsZXIuVHlwZSwgeyB0ZXh0OiAnLicgfSk7XG5cblx0XHRcdH0sIGV2ZW50ID0+IHtcblx0XHRcdFx0Ly8gU1lOQ1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQudHJpZ2dlck9wdGlvbnMuYXV0bywgdHJ1ZSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC5jb21wbGV0aW9uTW9kZWwuaXRlbXMubGVuZ3RoLCAxKTtcblx0XHRcdFx0Y29uc3QgW2ZpcnN0XSA9IGV2ZW50LmNvbXBsZXRpb25Nb2RlbC5pdGVtcztcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LmNvbXBsZXRpb24ubGFiZWwsICdmb28uYmFyJyk7XG5cdFx0XHR9KTtcblxuXHRcdFx0YXdhaXQgYXNzZXJ0RXZlbnQobW9kZWwub25EaWRTdWdnZXN0LCAoKSA9PiB7XG5cdFx0XHRcdC8vIG5vdGhpbmcgLT4gdHJpZ2dlcmVkIGJ5IHRoZSB0cmlnZ2VyIGNoYXJhY3RlciB0eXBpbmcgKHNlZSBhYm92ZSlcblxuXHRcdFx0fSwgZXZlbnQgPT4ge1xuXHRcdFx0XHQvLyBBU1lOQ1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQudHJpZ2dlck9wdGlvbnMuYXV0bywgdHJ1ZSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC5jb21wbGV0aW9uTW9kZWwuaXRlbXMubGVuZ3RoLCAyKTtcblx0XHRcdFx0Y29uc3QgW2ZpcnN0LCBzZWNvbmRdID0gZXZlbnQuY29tcGxldGlvbk1vZGVsLml0ZW1zO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QuY29tcGxldGlvbi5sYWJlbCwgJ2Zvby5iYXInKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlY29uZC5jb21wbGV0aW9uLmxhYmVsLCAnYm9vbScpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0ludGVsbGlzZW5zZSBDb21wbGV0aW9uIGRvZXNuXFwndCByZXNwZWN0IHNwYWNlIGFmdGVyIGVxdWFsIHNpZ24gKC5odG1sIGZpbGUpLCAjMjkzNTMgWzEvMl0nLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQocmVnaXN0cnkucmVnaXN0ZXIoeyBzY2hlbWU6ICd0ZXN0JyB9LCBhbHdheXNTb21ldGhpbmdTdXBwb3J0KSk7XG5cblx0XHRyZXR1cm4gd2l0aE9yYWNsZSgobW9kZWwsIGVkaXRvcikgPT4ge1xuXG5cdFx0XHRlZGl0b3IuZ2V0TW9kZWwoKSEuc2V0VmFsdWUoJ2ZvJyk7XG5cdFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24oeyBsaW5lTnVtYmVyOiAxLCBjb2x1bW46IDMgfSk7XG5cblx0XHRcdHJldHVybiBhc3NlcnRFdmVudChtb2RlbC5vbkRpZFN1Z2dlc3QsICgpID0+IHtcblx0XHRcdFx0bW9kZWwudHJpZ2dlcih7IGF1dG86IGZhbHNlIH0pO1xuXHRcdFx0fSwgZXZlbnQgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQudHJpZ2dlck9wdGlvbnMuYXV0bywgZmFsc2UpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQuaXNGcm96ZW4sIGZhbHNlKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LmNvbXBsZXRpb25Nb2RlbC5pdGVtcy5sZW5ndGgsIDEpO1xuXG5cdFx0XHRcdHJldHVybiBhc3NlcnRFdmVudChtb2RlbC5vbkRpZENhbmNlbCwgKCkgPT4ge1xuXHRcdFx0XHRcdGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsIEhhbmRsZXIuVHlwZSwgeyB0ZXh0OiAnKycgfSk7XG5cdFx0XHRcdH0sIGV2ZW50ID0+IHtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQucmV0cmlnZ2VyLCBmYWxzZSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0ludGVsbGlzZW5zZSBDb21wbGV0aW9uIGRvZXNuXFwndCByZXNwZWN0IHNwYWNlIGFmdGVyIGVxdWFsIHNpZ24gKC5odG1sIGZpbGUpLCAjMjkzNTMgWzIvMl0nLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQocmVnaXN0cnkucmVnaXN0ZXIoeyBzY2hlbWU6ICd0ZXN0JyB9LCBhbHdheXNTb21ldGhpbmdTdXBwb3J0KSk7XG5cblx0XHRyZXR1cm4gd2l0aE9yYWNsZSgobW9kZWwsIGVkaXRvcikgPT4ge1xuXG5cdFx0XHRlZGl0b3IuZ2V0TW9kZWwoKSEuc2V0VmFsdWUoJ2ZvJyk7XG5cdFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24oeyBsaW5lTnVtYmVyOiAxLCBjb2x1bW46IDMgfSk7XG5cblx0XHRcdHJldHVybiBhc3NlcnRFdmVudChtb2RlbC5vbkRpZFN1Z2dlc3QsICgpID0+IHtcblx0XHRcdFx0bW9kZWwudHJpZ2dlcih7IGF1dG86IGZhbHNlIH0pO1xuXHRcdFx0fSwgZXZlbnQgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQudHJpZ2dlck9wdGlvbnMuYXV0bywgZmFsc2UpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQuaXNGcm96ZW4sIGZhbHNlKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LmNvbXBsZXRpb25Nb2RlbC5pdGVtcy5sZW5ndGgsIDEpO1xuXG5cdFx0XHRcdHJldHVybiBhc3NlcnRFdmVudChtb2RlbC5vbkRpZENhbmNlbCwgKCkgPT4ge1xuXHRcdFx0XHRcdGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsIEhhbmRsZXIuVHlwZSwgeyB0ZXh0OiAnICcgfSk7XG5cdFx0XHRcdH0sIGV2ZW50ID0+IHtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQucmV0cmlnZ2VyLCBmYWxzZSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0luY29tcGxldGUgc3VnZ2VzdGlvbiByZXN1bHRzIGNhdXNlIHJlLXRyaWdnZXJpbmcgd2hlbiB0eXBpbmcgdy9vIGZ1cnRoZXIgY29udGV4dCwgIzI4NDAwICgxLzIpJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHJlZ2lzdHJ5LnJlZ2lzdGVyKHsgc2NoZW1lOiAndGVzdCcgfSwge1xuXHRcdFx0X2RlYnVnRGlzcGxheU5hbWU6ICd0ZXN0Jyxcblx0XHRcdHByb3ZpZGVDb21wbGV0aW9uSXRlbXMoZG9jLCBwb3MpOiBDb21wbGV0aW9uTGlzdCB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0aW5jb21wbGV0ZTogdHJ1ZSxcblx0XHRcdFx0XHRzdWdnZXN0aW9uczogW3tcblx0XHRcdFx0XHRcdGxhYmVsOiAnZm9vJyxcblx0XHRcdFx0XHRcdGtpbmQ6IENvbXBsZXRpb25JdGVtS2luZC5Qcm9wZXJ0eSxcblx0XHRcdFx0XHRcdGluc2VydFRleHQ6ICdmb28nLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IFJhbmdlLmZyb21Qb3NpdGlvbnMocG9zLndpdGgodW5kZWZpbmVkLCAxKSwgcG9zKVxuXHRcdFx0XHRcdH1dXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0cmV0dXJuIHdpdGhPcmFjbGUoKG1vZGVsLCBlZGl0b3IpID0+IHtcblxuXHRcdFx0ZWRpdG9yLmdldE1vZGVsKCkhLnNldFZhbHVlKCdmb28nKTtcblx0XHRcdGVkaXRvci5zZXRQb3NpdGlvbih7IGxpbmVOdW1iZXI6IDEsIGNvbHVtbjogNCB9KTtcblxuXHRcdFx0cmV0dXJuIGFzc2VydEV2ZW50KG1vZGVsLm9uRGlkU3VnZ2VzdCwgKCkgPT4ge1xuXHRcdFx0XHRtb2RlbC50cmlnZ2VyKHsgYXV0bzogZmFsc2UgfSk7XG5cdFx0XHR9LCBldmVudCA9PiB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC50cmlnZ2VyT3B0aW9ucy5hdXRvLCBmYWxzZSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC5jb21wbGV0aW9uTW9kZWwuZ2V0SW5jb21wbGV0ZVByb3ZpZGVyKCkuc2l6ZSwgMSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC5jb21wbGV0aW9uTW9kZWwuaXRlbXMubGVuZ3RoLCAxKTtcblxuXHRcdFx0XHRyZXR1cm4gYXNzZXJ0RXZlbnQobW9kZWwub25EaWRDYW5jZWwsICgpID0+IHtcblx0XHRcdFx0XHRlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCBIYW5kbGVyLlR5cGUsIHsgdGV4dDogJzsnIH0pO1xuXHRcdFx0XHR9LCBldmVudCA9PiB7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LnJldHJpZ2dlciwgZmFsc2UpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdJbmNvbXBsZXRlIHN1Z2dlc3Rpb24gcmVzdWx0cyBjYXVzZSByZS10cmlnZ2VyaW5nIHdoZW4gdHlwaW5nIHcvbyBmdXJ0aGVyIGNvbnRleHQsICMyODQwMCAoMi8yKScsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3RyeS5yZWdpc3Rlcih7IHNjaGVtZTogJ3Rlc3QnIH0sIHtcblx0XHRcdF9kZWJ1Z0Rpc3BsYXlOYW1lOiAndGVzdCcsXG5cdFx0XHRwcm92aWRlQ29tcGxldGlvbkl0ZW1zKGRvYywgcG9zKTogQ29tcGxldGlvbkxpc3Qge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGluY29tcGxldGU6IHRydWUsXG5cdFx0XHRcdFx0c3VnZ2VzdGlvbnM6IFt7XG5cdFx0XHRcdFx0XHRsYWJlbDogJ2ZvbzsnLFxuXHRcdFx0XHRcdFx0a2luZDogQ29tcGxldGlvbkl0ZW1LaW5kLlByb3BlcnR5LFxuXHRcdFx0XHRcdFx0aW5zZXJ0VGV4dDogJ2ZvbycsXG5cdFx0XHRcdFx0XHRyYW5nZTogUmFuZ2UuZnJvbVBvc2l0aW9ucyhwb3Mud2l0aCh1bmRlZmluZWQsIDEpLCBwb3MpXG5cdFx0XHRcdFx0fV1cblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRyZXR1cm4gd2l0aE9yYWNsZSgobW9kZWwsIGVkaXRvcikgPT4ge1xuXG5cdFx0XHRlZGl0b3IuZ2V0TW9kZWwoKSEuc2V0VmFsdWUoJ2ZvbycpO1xuXHRcdFx0ZWRpdG9yLnNldFBvc2l0aW9uKHsgbGluZU51bWJlcjogMSwgY29sdW1uOiA0IH0pO1xuXG5cdFx0XHRyZXR1cm4gYXNzZXJ0RXZlbnQobW9kZWwub25EaWRTdWdnZXN0LCAoKSA9PiB7XG5cdFx0XHRcdG1vZGVsLnRyaWdnZXIoeyBhdXRvOiBmYWxzZSB9KTtcblx0XHRcdH0sIGV2ZW50ID0+IHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LnRyaWdnZXJPcHRpb25zLmF1dG8sIGZhbHNlKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LmNvbXBsZXRpb25Nb2RlbC5nZXRJbmNvbXBsZXRlUHJvdmlkZXIoKS5zaXplLCAxKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LmNvbXBsZXRpb25Nb2RlbC5pdGVtcy5sZW5ndGgsIDEpO1xuXG5cdFx0XHRcdHJldHVybiBhc3NlcnRFdmVudChtb2RlbC5vbkRpZFN1Z2dlc3QsICgpID0+IHtcblx0XHRcdFx0XHQvLyB3aGlsZSB3ZSBjYW5jZWwgaW5jcmVtZW50YWxseSBlbnJpY2hpbmcgdGhlIHNldCBvZlxuXHRcdFx0XHRcdC8vIGNvbXBsZXRpb25zIHdlIHN0aWxsIGZpbHRlciBhZ2FpbnN0IHRob3NlIHRoYXQgd2UgaGF2ZVxuXHRcdFx0XHRcdC8vIHVudGlsIG5vd1xuXHRcdFx0XHRcdGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsIEhhbmRsZXIuVHlwZSwgeyB0ZXh0OiAnOycgfSk7XG5cdFx0XHRcdH0sIGV2ZW50ID0+IHtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQudHJpZ2dlck9wdGlvbnMuYXV0bywgZmFsc2UpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC5jb21wbGV0aW9uTW9kZWwuZ2V0SW5jb21wbGV0ZVByb3ZpZGVyKCkuc2l6ZSwgMSk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LmNvbXBsZXRpb25Nb2RlbC5pdGVtcy5sZW5ndGgsIDEpO1xuXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1RyaWdnZXIgY2hhcmFjdGVyIGlzIHByb3ZpZGVkIGluIHN1Z2dlc3QgY29udGV4dCcsIGZ1bmN0aW9uICgpIHtcblx0XHRsZXQgdHJpZ2dlckNoYXJhY3RlciA9ICcnO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3RyeS5yZWdpc3Rlcih7IHNjaGVtZTogJ3Rlc3QnIH0sIHtcblx0XHRcdF9kZWJ1Z0Rpc3BsYXlOYW1lOiAndGVzdCcsXG5cdFx0XHR0cmlnZ2VyQ2hhcmFjdGVyczogWycuJ10sXG5cdFx0XHRwcm92aWRlQ29tcGxldGlvbkl0ZW1zKGRvYywgcG9zLCBjb250ZXh0KTogQ29tcGxldGlvbkxpc3Qge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGV4dC50cmlnZ2VyS2luZCwgQ29tcGxldGlvblRyaWdnZXJLaW5kLlRyaWdnZXJDaGFyYWN0ZXIpO1xuXHRcdFx0XHR0cmlnZ2VyQ2hhcmFjdGVyID0gY29udGV4dC50cmlnZ2VyQ2hhcmFjdGVyITtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRpbmNvbXBsZXRlOiBmYWxzZSxcblx0XHRcdFx0XHRzdWdnZXN0aW9uczogW1xuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRsYWJlbDogJ2Zvby5iYXInLFxuXHRcdFx0XHRcdFx0XHRraW5kOiBDb21wbGV0aW9uSXRlbUtpbmQuUHJvcGVydHksXG5cdFx0XHRcdFx0XHRcdGluc2VydFRleHQ6ICdmb28uYmFyJyxcblx0XHRcdFx0XHRcdFx0cmFuZ2U6IFJhbmdlLmZyb21Qb3NpdGlvbnMocG9zLndpdGgodW5kZWZpbmVkLCAxKSwgcG9zKVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRtb2RlbC5zZXRWYWx1ZSgnJyk7XG5cblx0XHRyZXR1cm4gd2l0aE9yYWNsZSgobW9kZWwsIGVkaXRvcikgPT4ge1xuXG5cdFx0XHRyZXR1cm4gYXNzZXJ0RXZlbnQobW9kZWwub25EaWRTdWdnZXN0LCAoKSA9PiB7XG5cdFx0XHRcdGVkaXRvci5zZXRQb3NpdGlvbih7IGxpbmVOdW1iZXI6IDEsIGNvbHVtbjogMSB9KTtcblx0XHRcdFx0ZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgSGFuZGxlci5UeXBlLCB7IHRleHQ6ICdmb28uJyB9KTtcblx0XHRcdH0sIGV2ZW50ID0+IHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyaWdnZXJDaGFyYWN0ZXIsICcuJyk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnTWFjIHByZXNzIGFuZCBob2xkIGFjY2VudCBjaGFyYWN0ZXIgaW5zZXJ0aW9uIGRvZXMgbm90IHVwZGF0ZSBzdWdnZXN0aW9ucywgIzM1MjY5JywgZnVuY3Rpb24gKCkge1xuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3RyeS5yZWdpc3Rlcih7IHNjaGVtZTogJ3Rlc3QnIH0sIHtcblx0XHRcdF9kZWJ1Z0Rpc3BsYXlOYW1lOiAndGVzdCcsXG5cdFx0XHRwcm92aWRlQ29tcGxldGlvbkl0ZW1zKGRvYywgcG9zKTogQ29tcGxldGlvbkxpc3Qge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGluY29tcGxldGU6IHRydWUsXG5cdFx0XHRcdFx0c3VnZ2VzdGlvbnM6IFt7XG5cdFx0XHRcdFx0XHRsYWJlbDogJ2FiYycsXG5cdFx0XHRcdFx0XHRraW5kOiBDb21wbGV0aW9uSXRlbUtpbmQuUHJvcGVydHksXG5cdFx0XHRcdFx0XHRpbnNlcnRUZXh0OiAnYWJjJyxcblx0XHRcdFx0XHRcdHJhbmdlOiBSYW5nZS5mcm9tUG9zaXRpb25zKHBvcy53aXRoKHVuZGVmaW5lZCwgMSksIHBvcylcblx0XHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0XHRsYWJlbDogJ1x1MDBFNGJjJyxcblx0XHRcdFx0XHRcdGtpbmQ6IENvbXBsZXRpb25JdGVtS2luZC5Qcm9wZXJ0eSxcblx0XHRcdFx0XHRcdGluc2VydFRleHQ6ICdcdTAwRTRiYycsXG5cdFx0XHRcdFx0XHRyYW5nZTogUmFuZ2UuZnJvbVBvc2l0aW9ucyhwb3Mud2l0aCh1bmRlZmluZWQsIDEpLCBwb3MpXG5cdFx0XHRcdFx0fV1cblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRtb2RlbC5zZXRWYWx1ZSgnJyk7XG5cdFx0cmV0dXJuIHdpdGhPcmFjbGUoKG1vZGVsLCBlZGl0b3IpID0+IHtcblxuXHRcdFx0cmV0dXJuIGFzc2VydEV2ZW50KG1vZGVsLm9uRGlkU3VnZ2VzdCwgKCkgPT4ge1xuXHRcdFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24oeyBsaW5lTnVtYmVyOiAxLCBjb2x1bW46IDEgfSk7XG5cdFx0XHRcdGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsIEhhbmRsZXIuVHlwZSwgeyB0ZXh0OiAnYScgfSk7XG5cdFx0XHR9LCBldmVudCA9PiB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC5jb21wbGV0aW9uTW9kZWwuaXRlbXMubGVuZ3RoLCAxKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LmNvbXBsZXRpb25Nb2RlbC5pdGVtc1swXS5jb21wbGV0aW9uLmxhYmVsLCAnYWJjJyk7XG5cblx0XHRcdFx0cmV0dXJuIGFzc2VydEV2ZW50KG1vZGVsLm9uRGlkU3VnZ2VzdCwgKCkgPT4ge1xuXHRcdFx0XHRcdGVkaXRvci5leGVjdXRlRWRpdHMoJ3Rlc3QnLCBbRWRpdE9wZXJhdGlvbi5yZXBsYWNlKG5ldyBSYW5nZSgxLCAxLCAxLCAyKSwgJ1x1MDBFNCcpXSk7XG5cblx0XHRcdFx0fSwgZXZlbnQgPT4ge1xuXHRcdFx0XHRcdC8vIHN1Z2dlc3QgbW9kZWwgY2hhbmdlZCB0byBcdTAwRTRiY1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC5jb21wbGV0aW9uTW9kZWwuaXRlbXMubGVuZ3RoLCAxKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQuY29tcGxldGlvbk1vZGVsLml0ZW1zWzBdLmNvbXBsZXRpb24ubGFiZWwsICdcdTAwRTRiYycpO1xuXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0JhY2tzcGFjZSBzaG91bGQgbm90IGFsd2F5cyBjYW5jZWwgY29kZSBjb21wbGV0aW9uLCAjMzY0OTEnLCBmdW5jdGlvbiAoKSB7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHJlZ2lzdHJ5LnJlZ2lzdGVyKHsgc2NoZW1lOiAndGVzdCcgfSwgYWx3YXlzU29tZXRoaW5nU3VwcG9ydCkpO1xuXG5cdFx0cmV0dXJuIHdpdGhPcmFjbGUoYXN5bmMgKG1vZGVsLCBlZGl0b3IpID0+IHtcblx0XHRcdGF3YWl0IGFzc2VydEV2ZW50KG1vZGVsLm9uRGlkU3VnZ2VzdCwgKCkgPT4ge1xuXHRcdFx0XHRlZGl0b3Iuc2V0UG9zaXRpb24oeyBsaW5lTnVtYmVyOiAxLCBjb2x1bW46IDQgfSk7XG5cdFx0XHRcdGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsIEhhbmRsZXIuVHlwZSwgeyB0ZXh0OiAnZCcgfSk7XG5cblx0XHRcdH0sIGV2ZW50ID0+IHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LnRyaWdnZXJPcHRpb25zLmF1dG8sIHRydWUpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQuY29tcGxldGlvbk1vZGVsLml0ZW1zLmxlbmd0aCwgMSk7XG5cdFx0XHRcdGNvbnN0IFtmaXJzdF0gPSBldmVudC5jb21wbGV0aW9uTW9kZWwuaXRlbXM7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LnByb3ZpZGVyLCBhbHdheXNTb21ldGhpbmdTdXBwb3J0KTtcblx0XHRcdH0pO1xuXG5cdFx0XHRhd2FpdCBhc3NlcnRFdmVudChtb2RlbC5vbkRpZFN1Z2dlc3QsICgpID0+IHtcblx0XHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVMZWZ0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblxuXHRcdFx0fSwgZXZlbnQgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQudHJpZ2dlck9wdGlvbnMuYXV0bywgdHJ1ZSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC5jb21wbGV0aW9uTW9kZWwuaXRlbXMubGVuZ3RoLCAxKTtcblx0XHRcdFx0Y29uc3QgW2ZpcnN0XSA9IGV2ZW50LmNvbXBsZXRpb25Nb2RlbC5pdGVtcztcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QucHJvdmlkZXIsIGFsd2F5c1NvbWV0aGluZ1N1cHBvcnQpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1RleHQgY2hhbmdlcyBmb3IgY29tcGxldGlvbiBDb2RlQWN0aW9uIGFyZSBhZmZlY3RlZCBieSB0aGUgY29tcGxldGlvbiAjMzk4OTMnLCBmdW5jdGlvbiAoKSB7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHJlZ2lzdHJ5LnJlZ2lzdGVyKHsgc2NoZW1lOiAndGVzdCcgfSwge1xuXHRcdFx0X2RlYnVnRGlzcGxheU5hbWU6ICd0ZXN0Jyxcblx0XHRcdHByb3ZpZGVDb21wbGV0aW9uSXRlbXMoZG9jLCBwb3MpOiBDb21wbGV0aW9uTGlzdCB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0aW5jb21wbGV0ZTogdHJ1ZSxcblx0XHRcdFx0XHRzdWdnZXN0aW9uczogW3tcblx0XHRcdFx0XHRcdGxhYmVsOiAnYmFyJyxcblx0XHRcdFx0XHRcdGtpbmQ6IENvbXBsZXRpb25JdGVtS2luZC5Qcm9wZXJ0eSxcblx0XHRcdFx0XHRcdGluc2VydFRleHQ6ICdiYXInLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IFJhbmdlLmZyb21Qb3NpdGlvbnMocG9zLmRlbHRhKDAsIC0yKSwgcG9zKSxcblx0XHRcdFx0XHRcdGFkZGl0aW9uYWxUZXh0RWRpdHM6IFt7XG5cdFx0XHRcdFx0XHRcdHRleHQ6ICcsIGJhcicsXG5cdFx0XHRcdFx0XHRcdHJhbmdlOiB7IHN0YXJ0TGluZU51bWJlcjogMSwgZW5kTGluZU51bWJlcjogMSwgc3RhcnRDb2x1bW46IDE3LCBlbmRDb2x1bW46IDE3IH1cblx0XHRcdFx0XHRcdH1dXG5cdFx0XHRcdFx0fV1cblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRtb2RlbC5zZXRWYWx1ZSgnYmE7IGltcG9ydCB7IGZvbyB9IGZyb20gXCIuL2JcIicpO1xuXG5cdFx0cmV0dXJuIHdpdGhPcmFjbGUoYXN5bmMgKHN1Z2dldCwgZWRpdG9yKSA9PiB7XG5cdFx0XHRjbGFzcyBUZXN0Q3RybCBleHRlbmRzIFN1Z2dlc3RDb250cm9sbGVyIHtcblx0XHRcdFx0X2luc2VydFN1Z2dlc3Rpb25fcHVibGljRm9yVGVzdChpdGVtOiBJU2VsZWN0ZWRTdWdnZXN0aW9uLCBmbGFnczogbnVtYmVyID0gMCkge1xuXHRcdFx0XHRcdHN1cGVyLl9pbnNlcnRTdWdnZXN0aW9uKGl0ZW0sIGZsYWdzKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Y29uc3QgY3RybCA9IDxUZXN0Q3RybD5lZGl0b3IucmVnaXN0ZXJBbmRJbnN0YW50aWF0ZUNvbnRyaWJ1dGlvbihUZXN0Q3RybC5JRCwgVGVzdEN0cmwpO1xuXHRcdFx0ZWRpdG9yLnJlZ2lzdGVyQW5kSW5zdGFudGlhdGVDb250cmlidXRpb24oU25pcHBldENvbnRyb2xsZXIyLklELCBTbmlwcGV0Q29udHJvbGxlcjIpO1xuXG5cdFx0XHRhd2FpdCBhc3NlcnRFdmVudChzdWdnZXQub25EaWRTdWdnZXN0LCAoKSA9PiB7XG5cdFx0XHRcdGVkaXRvci5zZXRQb3NpdGlvbih7IGxpbmVOdW1iZXI6IDEsIGNvbHVtbjogMyB9KTtcblx0XHRcdFx0c3VnZ2V0LnRyaWdnZXIoeyBhdXRvOiBmYWxzZSB9KTtcblx0XHRcdH0sIGV2ZW50ID0+IHtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQuY29tcGxldGlvbk1vZGVsLml0ZW1zLmxlbmd0aCwgMSk7XG5cdFx0XHRcdGNvbnN0IFtmaXJzdF0gPSBldmVudC5jb21wbGV0aW9uTW9kZWwuaXRlbXM7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC5jb21wbGV0aW9uLmxhYmVsLCAnYmFyJyk7XG5cblx0XHRcdFx0Y3RybC5faW5zZXJ0U3VnZ2VzdGlvbl9wdWJsaWNGb3JUZXN0KHsgaXRlbTogZmlyc3QsIGluZGV4OiAwLCBtb2RlbDogZXZlbnQuY29tcGxldGlvbk1vZGVsIH0pO1xuXHRcdFx0fSk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdFx0bW9kZWwuZ2V0VmFsdWUoKSxcblx0XHRcdFx0J2JhcjsgaW1wb3J0IHsgZm9vLCBiYXIgfSBmcm9tIFwiLi9iXCInXG5cdFx0XHQpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdDb21wbGV0aW9uIHVuZXhwZWN0ZWRseSB0cmlnZ2VycyBvbiBzZWNvbmQga2V5cHJlc3Mgb2YgYW4gZWRpdCBncm91cCBpbiBhIHNuaXBwZXQgIzQzNTIzJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHJlZ2lzdHJ5LnJlZ2lzdGVyKHsgc2NoZW1lOiAndGVzdCcgfSwgYWx3YXlzU29tZXRoaW5nU3VwcG9ydCkpO1xuXG5cdFx0cmV0dXJuIHdpdGhPcmFjbGUoKG1vZGVsLCBlZGl0b3IpID0+IHtcblx0XHRcdHJldHVybiBhc3NlcnRFdmVudChtb2RlbC5vbkRpZFN1Z2dlc3QsICgpID0+IHtcblx0XHRcdFx0ZWRpdG9yLnNldFZhbHVlKCdkJyk7XG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCAxLCAxLCAyKSk7XG5cdFx0XHRcdGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsIEhhbmRsZXIuVHlwZSwgeyB0ZXh0OiAnZScgfSk7XG5cblx0XHRcdH0sIGV2ZW50ID0+IHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LnRyaWdnZXJPcHRpb25zLmF1dG8sIHRydWUpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQuY29tcGxldGlvbk1vZGVsLml0ZW1zLmxlbmd0aCwgMSk7XG5cdFx0XHRcdGNvbnN0IFtmaXJzdF0gPSBldmVudC5jb21wbGV0aW9uTW9kZWwuaXRlbXM7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LnByb3ZpZGVyLCBhbHdheXNTb21ldGhpbmdTdXBwb3J0KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXG5cdHRlc3QoJ0ZhaWxzIHRvIHJlbmRlciBjb21wbGV0aW9uIGRldGFpbHMgIzQ3OTg4JywgZnVuY3Rpb24gKCkge1xuXG5cdFx0bGV0IGRpc3Bvc2VBID0gMDtcblx0XHRsZXQgZGlzcG9zZUIgPSAwO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHJlZ2lzdHJ5LnJlZ2lzdGVyKHsgc2NoZW1lOiAndGVzdCcgfSwge1xuXHRcdFx0X2RlYnVnRGlzcGxheU5hbWU6ICd0ZXN0Jyxcblx0XHRcdHByb3ZpZGVDb21wbGV0aW9uSXRlbXMoZG9jLCBwb3MpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRpbmNvbXBsZXRlOiB0cnVlLFxuXHRcdFx0XHRcdHN1Z2dlc3Rpb25zOiBbe1xuXHRcdFx0XHRcdFx0a2luZDogQ29tcGxldGlvbkl0ZW1LaW5kLkZvbGRlcixcblx0XHRcdFx0XHRcdGxhYmVsOiAnQ29tcGxldGVOb3QnLFxuXHRcdFx0XHRcdFx0aW5zZXJ0VGV4dDogJ0luY29tcGxldGUnLFxuXHRcdFx0XHRcdFx0c29ydFRleHQ6ICdhJyxcblx0XHRcdFx0XHRcdHJhbmdlOiBnZXREZWZhdWx0U3VnZ2VzdFJhbmdlKGRvYywgcG9zKVxuXHRcdFx0XHRcdH1dLFxuXHRcdFx0XHRcdGRpc3Bvc2UoKSB7IGRpc3Bvc2VBICs9IDE7IH1cblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHJlZ2lzdHJ5LnJlZ2lzdGVyKHsgc2NoZW1lOiAndGVzdCcgfSwge1xuXHRcdFx0X2RlYnVnRGlzcGxheU5hbWU6ICd0ZXN0Jyxcblx0XHRcdHByb3ZpZGVDb21wbGV0aW9uSXRlbXMoZG9jLCBwb3MpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRpbmNvbXBsZXRlOiBmYWxzZSxcblx0XHRcdFx0XHRzdWdnZXN0aW9uczogW3tcblx0XHRcdFx0XHRcdGtpbmQ6IENvbXBsZXRpb25JdGVtS2luZC5Gb2xkZXIsXG5cdFx0XHRcdFx0XHRsYWJlbDogJ0NvbXBsZXRlJyxcblx0XHRcdFx0XHRcdGluc2VydFRleHQ6ICdDb21wbGV0ZScsXG5cdFx0XHRcdFx0XHRzb3J0VGV4dDogJ3onLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IGdldERlZmF1bHRTdWdnZXN0UmFuZ2UoZG9jLCBwb3MpXG5cdFx0XHRcdFx0fV0sXG5cdFx0XHRcdFx0ZGlzcG9zZSgpIHsgZGlzcG9zZUIgKz0gMTsgfVxuXHRcdFx0XHR9O1xuXHRcdFx0fSxcblx0XHRcdHJlc29sdmVDb21wbGV0aW9uSXRlbShpdGVtKSB7XG5cdFx0XHRcdHJldHVybiBpdGVtO1xuXHRcdFx0fSxcblx0XHR9KSk7XG5cblx0XHRyZXR1cm4gd2l0aE9yYWNsZShhc3luYyAobW9kZWwsIGVkaXRvcikgPT4ge1xuXG5cdFx0XHRhd2FpdCBhc3NlcnRFdmVudChtb2RlbC5vbkRpZFN1Z2dlc3QsICgpID0+IHtcblx0XHRcdFx0ZWRpdG9yLnNldFZhbHVlKCcnKTtcblx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpKTtcblx0XHRcdFx0ZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgSGFuZGxlci5UeXBlLCB7IHRleHQ6ICdjJyB9KTtcblxuXHRcdFx0fSwgZXZlbnQgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQudHJpZ2dlck9wdGlvbnMuYXV0bywgdHJ1ZSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC5jb21wbGV0aW9uTW9kZWwuaXRlbXMubGVuZ3RoLCAyKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpc3Bvc2VBLCAwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpc3Bvc2VCLCAwKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRhd2FpdCBhc3NlcnRFdmVudChtb2RlbC5vbkRpZFN1Z2dlc3QsICgpID0+IHtcblx0XHRcdFx0ZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgSGFuZGxlci5UeXBlLCB7IHRleHQ6ICdvJyB9KTtcblx0XHRcdH0sIGV2ZW50ID0+IHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LnRyaWdnZXJPcHRpb25zLmF1dG8sIHRydWUpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQuY29tcGxldGlvbk1vZGVsLml0ZW1zLmxlbmd0aCwgMik7XG5cblx0XHRcdFx0Ly8gY2xlYW4gdXBcblx0XHRcdFx0bW9kZWwuY2xlYXIoKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpc3Bvc2VBLCAyKTsgLy8gcHJvdmlkZSBnb3QgY2FsbGVkIHR3byB0aW1lcyFcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpc3Bvc2VCLCAxKTtcblx0XHRcdH0pO1xuXG5cdFx0fSk7XG5cdH0pO1xuXG5cblx0dGVzdCgnVHJpZ2dlciAoZnVsbCkgY29tcGxldGlvbnMgd2hlbiAoaW5jb21wbGV0ZSkgY29tcGxldGlvbnMgYXJlIGFscmVhZHkgYWN0aXZlICM5OTUwNCcsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGxldCBjb3VudEEgPSAwO1xuXHRcdGxldCBjb3VudEIgPSAwO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHJlZ2lzdHJ5LnJlZ2lzdGVyKHsgc2NoZW1lOiAndGVzdCcgfSwge1xuXHRcdFx0X2RlYnVnRGlzcGxheU5hbWU6ICd0ZXN0Jyxcblx0XHRcdHByb3ZpZGVDb21wbGV0aW9uSXRlbXMoZG9jLCBwb3MpIHtcblx0XHRcdFx0Y291bnRBICs9IDE7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0aW5jb21wbGV0ZTogZmFsc2UsIC8vIGRvZXNuJ3QgbWF0dGVyIGlmIGluY29tcGxldGUgb3Igbm90XG5cdFx0XHRcdFx0c3VnZ2VzdGlvbnM6IFt7XG5cdFx0XHRcdFx0XHRraW5kOiBDb21wbGV0aW9uSXRlbUtpbmQuQ2xhc3MsXG5cdFx0XHRcdFx0XHRsYWJlbDogJ1ogYWFhJyxcblx0XHRcdFx0XHRcdGluc2VydFRleHQ6ICdaIGFhYScsXG5cdFx0XHRcdFx0XHRyYW5nZTogbmV3IFJhbmdlKDEsIDEsIHBvcy5saW5lTnVtYmVyLCBwb3MuY29sdW1uKVxuXHRcdFx0XHRcdH1dLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQocmVnaXN0cnkucmVnaXN0ZXIoeyBzY2hlbWU6ICd0ZXN0JyB9LCB7XG5cdFx0XHRfZGVidWdEaXNwbGF5TmFtZTogJ3Rlc3QnLFxuXHRcdFx0cHJvdmlkZUNvbXBsZXRpb25JdGVtcyhkb2MsIHBvcykge1xuXHRcdFx0XHRjb3VudEIgKz0gMTtcblx0XHRcdFx0aWYgKCFkb2MuZ2V0V29yZFVudGlsUG9zaXRpb24ocG9zKS53b3JkLnN0YXJ0c1dpdGgoJ2EnKSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGluY29tcGxldGU6IGZhbHNlLFxuXHRcdFx0XHRcdHN1Z2dlc3Rpb25zOiBbe1xuXHRcdFx0XHRcdFx0a2luZDogQ29tcGxldGlvbkl0ZW1LaW5kLkZvbGRlcixcblx0XHRcdFx0XHRcdGxhYmVsOiAnYWFhJyxcblx0XHRcdFx0XHRcdGluc2VydFRleHQ6ICdhYWEnLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IGdldERlZmF1bHRTdWdnZXN0UmFuZ2UoZG9jLCBwb3MpXG5cdFx0XHRcdFx0fV0sXG5cdFx0XHRcdH07XG5cdFx0XHR9LFxuXHRcdH0pKTtcblxuXHRcdHJldHVybiB3aXRoT3JhY2xlKGFzeW5jIChtb2RlbCwgZWRpdG9yKSA9PiB7XG5cblx0XHRcdGF3YWl0IGFzc2VydEV2ZW50KG1vZGVsLm9uRGlkU3VnZ2VzdCwgKCkgPT4ge1xuXHRcdFx0XHRlZGl0b3Iuc2V0VmFsdWUoJycpO1xuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSkpO1xuXHRcdFx0XHRlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCBIYW5kbGVyLlR5cGUsIHsgdGV4dDogJ1onIH0pO1xuXG5cdFx0XHR9LCBldmVudCA9PiB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC50cmlnZ2VyT3B0aW9ucy5hdXRvLCB0cnVlKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LmNvbXBsZXRpb25Nb2RlbC5pdGVtcy5sZW5ndGgsIDEpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQuY29tcGxldGlvbk1vZGVsLml0ZW1zWzBdLnRleHRMYWJlbCwgJ1ogYWFhJyk7XG5cdFx0XHR9KTtcblxuXHRcdFx0YXdhaXQgYXNzZXJ0RXZlbnQobW9kZWwub25EaWRTdWdnZXN0LCAoKSA9PiB7XG5cdFx0XHRcdC8vIHN0YXJ0ZWQgYW5vdGhlciB3b3JkOiBaIGF8XG5cdFx0XHRcdC8vIGl0ZW0gc2hvdWxkIGJlOiBaIGFhYSwgYWFhXG5cdFx0XHRcdGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsIEhhbmRsZXIuVHlwZSwgeyB0ZXh0OiAnIGEnIH0pO1xuXHRcdFx0fSwgZXZlbnQgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQudHJpZ2dlck9wdGlvbnMuYXV0bywgdHJ1ZSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC5jb21wbGV0aW9uTW9kZWwuaXRlbXMubGVuZ3RoLCAyKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LmNvbXBsZXRpb25Nb2RlbC5pdGVtc1swXS50ZXh0TGFiZWwsICdaIGFhYScpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQuY29tcGxldGlvbk1vZGVsLml0ZW1zWzFdLnRleHRMYWJlbCwgJ2FhYScpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudEEsIDEpOyAvLyBzaG91bGQgd2Uga2VlcCB0aGUgc3VnZ2VzdGlvbnMgZnJvbSB0aGUgXCJhY3RpdmVcIiBwcm92aWRlcj8sIFllcyEgU2VlOiAjMTA2NTczXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudEIsIDIpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlZ2lzdGVyQ29tcGxldGlvbkl0ZW1Qcm92aWRlciB3aXRoIGxldHRlcnMgYXMgdHJpZ2dlciBjaGFyYWN0ZXJzIGJsb2NrIG90aGVyIGNvbXBsZXRpb24gaXRlbXMgdG8gc2hvdyB1cCAjMTI3ODE1JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHJlZ2lzdHJ5LnJlZ2lzdGVyKHsgc2NoZW1lOiAndGVzdCcgfSwge1xuXHRcdFx0X2RlYnVnRGlzcGxheU5hbWU6ICd0ZXN0Jyxcblx0XHRcdHByb3ZpZGVDb21wbGV0aW9uSXRlbXMoZG9jLCBwb3MpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRzdWdnZXN0aW9uczogW3tcblx0XHRcdFx0XHRcdGtpbmQ6IENvbXBsZXRpb25JdGVtS2luZC5DbGFzcyxcblx0XHRcdFx0XHRcdGxhYmVsOiAnQUFBQScsXG5cdFx0XHRcdFx0XHRpbnNlcnRUZXh0OiAnV29yZFRyaWdnZXJBJyxcblx0XHRcdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UocG9zLmxpbmVOdW1iZXIsIHBvcy5jb2x1bW4sIHBvcy5saW5lTnVtYmVyLCBwb3MuY29sdW1uKVxuXHRcdFx0XHRcdH1dLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQocmVnaXN0cnkucmVnaXN0ZXIoeyBzY2hlbWU6ICd0ZXN0JyB9LCB7XG5cdFx0XHRfZGVidWdEaXNwbGF5TmFtZTogJ3Rlc3QnLFxuXHRcdFx0dHJpZ2dlckNoYXJhY3RlcnM6IFsnYScsICcuJ10sXG5cdFx0XHRwcm92aWRlQ29tcGxldGlvbkl0ZW1zKGRvYywgcG9zKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0c3VnZ2VzdGlvbnM6IFt7XG5cdFx0XHRcdFx0XHRraW5kOiBDb21wbGV0aW9uSXRlbUtpbmQuQ2xhc3MsXG5cdFx0XHRcdFx0XHRsYWJlbDogJ0FBQUEnLFxuXHRcdFx0XHRcdFx0aW5zZXJ0VGV4dDogJ0F1dG9UcmlnZ2VyQScsXG5cdFx0XHRcdFx0XHRyYW5nZTogbmV3IFJhbmdlKHBvcy5saW5lTnVtYmVyLCBwb3MuY29sdW1uLCBwb3MubGluZU51bWJlciwgcG9zLmNvbHVtbilcblx0XHRcdFx0XHR9XSxcblx0XHRcdFx0fTtcblx0XHRcdH0sXG5cdFx0fSkpO1xuXG5cdFx0cmV0dXJuIHdpdGhPcmFjbGUoYXN5bmMgKG1vZGVsLCBlZGl0b3IpID0+IHtcblxuXHRcdFx0YXdhaXQgYXNzZXJ0RXZlbnQobW9kZWwub25EaWRTdWdnZXN0LCAoKSA9PiB7XG5cdFx0XHRcdGVkaXRvci5zZXRWYWx1ZSgnJyk7XG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSk7XG5cdFx0XHRcdGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsIEhhbmRsZXIuVHlwZSwgeyB0ZXh0OiAnLicgfSk7XG5cblx0XHRcdH0sIGV2ZW50ID0+IHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LnRyaWdnZXJPcHRpb25zLmF1dG8sIHRydWUpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQuY29tcGxldGlvbk1vZGVsLml0ZW1zLmxlbmd0aCwgMSk7XG5cdFx0XHR9KTtcblxuXG5cdFx0XHRlZGl0b3IuZ2V0TW9kZWwoKS5zZXRWYWx1ZSgnJyk7XG5cblx0XHRcdGF3YWl0IGFzc2VydEV2ZW50KG1vZGVsLm9uRGlkU3VnZ2VzdCwgKCkgPT4ge1xuXHRcdFx0XHRlZGl0b3Iuc2V0VmFsdWUoJycpO1xuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSkpO1xuXHRcdFx0XHRlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCBIYW5kbGVyLlR5cGUsIHsgdGV4dDogJ2EnIH0pO1xuXG5cdFx0XHR9LCBldmVudCA9PiB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC50cmlnZ2VyT3B0aW9ucy5hdXRvLCB0cnVlKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LmNvbXBsZXRpb25Nb2RlbC5pdGVtcy5sZW5ndGgsIDIpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1VuZXhwZWN0ZWQgc3VnZ2VzdCBzY29yaW5nICMxNjcyNDInLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHJlZ2lzdHJ5LnJlZ2lzdGVyKCcqJywge1xuXHRcdFx0Ly8gd29yZC1iYXNlZFxuXHRcdFx0X2RlYnVnRGlzcGxheU5hbWU6ICd0ZXN0Jyxcblx0XHRcdHByb3ZpZGVDb21wbGV0aW9uSXRlbXMoZG9jLCBwb3MpIHtcblx0XHRcdFx0Y29uc3Qgd29yZCA9IGRvYy5nZXRXb3JkVW50aWxQb3NpdGlvbihwb3MpO1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHN1Z2dlc3Rpb25zOiBbe1xuXHRcdFx0XHRcdFx0a2luZDogQ29tcGxldGlvbkl0ZW1LaW5kLlRleHQsXG5cdFx0XHRcdFx0XHRsYWJlbDogJ3B1bGwnLFxuXHRcdFx0XHRcdFx0aW5zZXJ0VGV4dDogJ3B1bGwnLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IG5ldyBSYW5nZShwb3MubGluZU51bWJlciwgd29yZC5zdGFydENvbHVtbiwgcG9zLmxpbmVOdW1iZXIsIHdvcmQuZW5kQ29sdW1uKVxuXHRcdFx0XHRcdH1dLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQocmVnaXN0cnkucmVnaXN0ZXIoeyBzY2hlbWU6ICd0ZXN0JyB9LCB7XG5cdFx0XHQvLyBKU09OLWJhc2VkXG5cdFx0XHRfZGVidWdEaXNwbGF5TmFtZTogJ3Rlc3QnLFxuXHRcdFx0cHJvdmlkZUNvbXBsZXRpb25JdGVtcyhkb2MsIHBvcykge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHN1Z2dlc3Rpb25zOiBbe1xuXHRcdFx0XHRcdFx0a2luZDogQ29tcGxldGlvbkl0ZW1LaW5kLkNsYXNzLFxuXHRcdFx0XHRcdFx0bGFiZWw6ICdnaXQucHVsbCcsXG5cdFx0XHRcdFx0XHRpbnNlcnRUZXh0OiAnZ2l0LnB1bGwnLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IG5ldyBSYW5nZShwb3MubGluZU51bWJlciwgMSwgcG9zLmxpbmVOdW1iZXIsIHBvcy5jb2x1bW4pXG5cdFx0XHRcdFx0fV0sXG5cdFx0XHRcdH07XG5cdFx0XHR9LFxuXHRcdH0pKTtcblxuXHRcdHJldHVybiB3aXRoT3JhY2xlKGFzeW5jIGZ1bmN0aW9uIChtb2RlbCwgZWRpdG9yKSB7XG5cblx0XHRcdGF3YWl0IGFzc2VydEV2ZW50KG1vZGVsLm9uRGlkU3VnZ2VzdCwgKCkgPT4ge1xuXHRcdFx0XHRlZGl0b3Iuc2V0VmFsdWUoJ2dpJyk7XG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCAzLCAxLCAzKSk7XG5cdFx0XHRcdGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsIEhhbmRsZXIuVHlwZSwgeyB0ZXh0OiAndCcgfSk7XG5cblx0XHRcdH0sIGV2ZW50ID0+IHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LnRyaWdnZXJPcHRpb25zLmF1dG8sIHRydWUpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQuY29tcGxldGlvbk1vZGVsLml0ZW1zLmxlbmd0aCwgMSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC5jb21wbGV0aW9uTW9kZWwuaXRlbXNbMF0udGV4dExhYmVsLCAnZ2l0LnB1bGwnKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCBIYW5kbGVyLlR5cGUsIHsgdGV4dDogJy4nIH0pO1xuXG5cdFx0XHRhd2FpdCBhc3NlcnRFdmVudChtb2RlbC5vbkRpZFN1Z2dlc3QsICgpID0+IHtcblx0XHRcdFx0ZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgSGFuZGxlci5UeXBlLCB7IHRleHQ6ICdwJyB9KTtcblxuXHRcdFx0fSwgZXZlbnQgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQudHJpZ2dlck9wdGlvbnMuYXV0bywgdHJ1ZSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC5jb21wbGV0aW9uTW9kZWwuaXRlbXMubGVuZ3RoLCAxKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LmNvbXBsZXRpb25Nb2RlbC5pdGVtc1swXS50ZXh0TGFiZWwsICdnaXQucHVsbCcpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0NvbXBsZXRpb24gbGlzdCBjbG9zZXMgdW5leHBlY3RlZGx5IHdoZW4gdHlwaW5nIGEgZGlnaXQgYWZ0ZXIgYSB3b3JkIHNlcGFyYXRvciAjMTY5MzkwJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgcmVxdWVzdENvdW50cyA9IFswLCAwXTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3RyeS5yZWdpc3Rlcih7IHNjaGVtZTogJ3Rlc3QnIH0sIHtcblx0XHRcdF9kZWJ1Z0Rpc3BsYXlOYW1lOiAndGVzdCcsXG5cblx0XHRcdHByb3ZpZGVDb21wbGV0aW9uSXRlbXMoZG9jLCBwb3MpIHtcblx0XHRcdFx0cmVxdWVzdENvdW50c1swXSArPSAxO1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHN1Z2dlc3Rpb25zOiBbe1xuXHRcdFx0XHRcdFx0a2luZDogQ29tcGxldGlvbkl0ZW1LaW5kLlRleHQsXG5cdFx0XHRcdFx0XHRsYWJlbDogJ2Zvby0yMCcsXG5cdFx0XHRcdFx0XHRpbnNlcnRUZXh0OiAnZm9vLTIwJyxcblx0XHRcdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UocG9zLmxpbmVOdW1iZXIsIDEsIHBvcy5saW5lTnVtYmVyLCBwb3MuY29sdW1uKVxuXHRcdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRcdGtpbmQ6IENvbXBsZXRpb25JdGVtS2luZC5UZXh0LFxuXHRcdFx0XHRcdFx0bGFiZWw6ICdmb28taGVsbG8nLFxuXHRcdFx0XHRcdFx0aW5zZXJ0VGV4dDogJ2Zvby1oZWxsbycsXG5cdFx0XHRcdFx0XHRyYW5nZTogbmV3IFJhbmdlKHBvcy5saW5lTnVtYmVyLCAxLCBwb3MubGluZU51bWJlciwgcG9zLmNvbHVtbilcblx0XHRcdFx0XHR9XSxcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHJlZ2lzdHJ5LnJlZ2lzdGVyKHsgc2NoZW1lOiAndGVzdCcgfSwge1xuXHRcdFx0X2RlYnVnRGlzcGxheU5hbWU6ICd0ZXN0Jyxcblx0XHRcdHRyaWdnZXJDaGFyYWN0ZXJzOiBbJzInXSxcblx0XHRcdHByb3ZpZGVDb21wbGV0aW9uSXRlbXMoZG9jLCBwb3MsIGN0eCkge1xuXHRcdFx0XHRyZXF1ZXN0Q291bnRzWzFdICs9IDE7XG5cdFx0XHRcdGlmIChjdHgudHJpZ2dlcktpbmQgIT09IENvbXBsZXRpb25UcmlnZ2VyS2luZC5UcmlnZ2VyQ2hhcmFjdGVyKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0c3VnZ2VzdGlvbnM6IFt7XG5cdFx0XHRcdFx0XHRraW5kOiBDb21wbGV0aW9uSXRlbUtpbmQuQ2xhc3MsXG5cdFx0XHRcdFx0XHRsYWJlbDogJ2Zvby0yMTAnLFxuXHRcdFx0XHRcdFx0aW5zZXJ0VGV4dDogJ2Zvby0yMTAnLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IG5ldyBSYW5nZShwb3MubGluZU51bWJlciwgMSwgcG9zLmxpbmVOdW1iZXIsIHBvcy5jb2x1bW4pXG5cdFx0XHRcdFx0fV0sXG5cdFx0XHRcdH07XG5cdFx0XHR9LFxuXHRcdH0pKTtcblxuXHRcdHJldHVybiB3aXRoT3JhY2xlKGFzeW5jIGZ1bmN0aW9uIChtb2RlbCwgZWRpdG9yKSB7XG5cblx0XHRcdGF3YWl0IGFzc2VydEV2ZW50KG1vZGVsLm9uRGlkU3VnZ2VzdCwgKCkgPT4ge1xuXHRcdFx0XHRlZGl0b3Iuc2V0VmFsdWUoJ2ZvbycpO1xuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNCkpO1xuXHRcdFx0XHRtb2RlbC50cmlnZ2VyKHsgYXV0bzogZmFsc2UgfSk7XG5cblx0XHRcdH0sIGV2ZW50ID0+IHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LnRyaWdnZXJPcHRpb25zLmF1dG8sIGZhbHNlKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LmNvbXBsZXRpb25Nb2RlbC5pdGVtcy5sZW5ndGgsIDIpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQuY29tcGxldGlvbk1vZGVsLml0ZW1zWzBdLnRleHRMYWJlbCwgJ2Zvby0yMCcpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQuY29tcGxldGlvbk1vZGVsLml0ZW1zWzFdLnRleHRMYWJlbCwgJ2Zvby1oZWxsbycpO1xuXHRcdFx0fSk7XG5cblx0XHRcdGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsIEhhbmRsZXIuVHlwZSwgeyB0ZXh0OiAnLScgfSk7XG5cblxuXHRcdFx0YXdhaXQgYXNzZXJ0RXZlbnQobW9kZWwub25EaWRTdWdnZXN0LCAoKSA9PiB7XG5cdFx0XHRcdGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsIEhhbmRsZXIuVHlwZSwgeyB0ZXh0OiAnMicgfSk7XG5cblx0XHRcdH0sIGV2ZW50ID0+IHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LnRyaWdnZXJPcHRpb25zLmF1dG8sIHRydWUpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQuY29tcGxldGlvbk1vZGVsLml0ZW1zLmxlbmd0aCwgMik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC5jb21wbGV0aW9uTW9kZWwuaXRlbXNbMF0udGV4dExhYmVsLCAnZm9vLTIwJyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC5jb21wbGV0aW9uTW9kZWwuaXRlbXNbMV0udGV4dExhYmVsLCAnZm9vLTIxMCcpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlcXVlc3RDb3VudHMsIFsxLCAyXSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnU2V0IHJlZmlsdGVyLWZsYWcsIGtlZXAgdHJpZ2dlcktpbmQnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQocmVnaXN0cnkucmVnaXN0ZXIoeyBzY2hlbWU6ICd0ZXN0JyB9LCB7XG5cdFx0XHRfZGVidWdEaXNwbGF5TmFtZTogJ3Rlc3QnLFxuXHRcdFx0dHJpZ2dlckNoYXJhY3RlcnM6IFsnLiddLFxuXHRcdFx0cHJvdmlkZUNvbXBsZXRpb25JdGVtcyhkb2MsIHBvcywgY3R4KSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0c3VnZ2VzdGlvbnM6IFt7XG5cdFx0XHRcdFx0XHRsYWJlbDogZG9jLmdldFdvcmRVbnRpbFBvc2l0aW9uKHBvcykud29yZCB8fCAnaGVsbG8nLFxuXHRcdFx0XHRcdFx0a2luZDogQ29tcGxldGlvbkl0ZW1LaW5kLlByb3BlcnR5LFxuXHRcdFx0XHRcdFx0aW5zZXJ0VGV4dDogJ2Zvb2ZvbycsXG5cdFx0XHRcdFx0XHRyYW5nZTogZ2V0RGVmYXVsdFN1Z2dlc3RSYW5nZShkb2MsIHBvcylcblx0XHRcdFx0XHR9XVxuXHRcdFx0XHR9O1xuXHRcdFx0fSxcblx0XHR9KSk7XG5cblx0XHRyZXR1cm4gd2l0aE9yYWNsZShhc3luYyBmdW5jdGlvbiAobW9kZWwsIGVkaXRvcikge1xuXG5cdFx0XHRhd2FpdCBhc3NlcnRFdmVudChtb2RlbC5vbkRpZFN1Z2dlc3QsICgpID0+IHtcblx0XHRcdFx0ZWRpdG9yLnNldFZhbHVlKCdmb28nKTtcblx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDQpKTtcblx0XHRcdFx0ZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgSGFuZGxlci5UeXBlLCB7IHRleHQ6ICdvJyB9KTtcblxuXG5cdFx0XHR9LCBldmVudCA9PiB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC50cmlnZ2VyT3B0aW9ucy5hdXRvLCB0cnVlKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LnRyaWdnZXJPcHRpb25zLnRyaWdnZXJDaGFyYWN0ZXIsIHVuZGVmaW5lZCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC50cmlnZ2VyT3B0aW9ucy50cmlnZ2VyS2luZCwgdW5kZWZpbmVkKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LmNvbXBsZXRpb25Nb2RlbC5pdGVtcy5sZW5ndGgsIDEpO1xuXHRcdFx0fSk7XG5cblx0XHRcdGF3YWl0IGFzc2VydEV2ZW50KG1vZGVsLm9uRGlkU3VnZ2VzdCwgKCkgPT4ge1xuXHRcdFx0XHRlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCBIYW5kbGVyLlR5cGUsIHsgdGV4dDogJy4nIH0pO1xuXG5cdFx0XHR9LCBldmVudCA9PiB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC50cmlnZ2VyT3B0aW9ucy5hdXRvLCB0cnVlKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LnRyaWdnZXJPcHRpb25zLnJlZmlsdGVyLCB1bmRlZmluZWQpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQudHJpZ2dlck9wdGlvbnMudHJpZ2dlckNoYXJhY3RlciwgJy4nKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LnRyaWdnZXJPcHRpb25zLnRyaWdnZXJLaW5kLCBDb21wbGV0aW9uVHJpZ2dlcktpbmQuVHJpZ2dlckNoYXJhY3Rlcik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC5jb21wbGV0aW9uTW9kZWwuaXRlbXMubGVuZ3RoLCAxKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRhd2FpdCBhc3NlcnRFdmVudChtb2RlbC5vbkRpZFN1Z2dlc3QsICgpID0+IHtcblx0XHRcdFx0ZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgSGFuZGxlci5UeXBlLCB7IHRleHQ6ICdoJyB9KTtcblxuXHRcdFx0fSwgZXZlbnQgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQudHJpZ2dlck9wdGlvbnMuYXV0bywgdHJ1ZSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC50cmlnZ2VyT3B0aW9ucy5yZWZpbHRlciwgdHJ1ZSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC50cmlnZ2VyT3B0aW9ucy50cmlnZ2VyQ2hhcmFjdGVyLCAnLicpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQudHJpZ2dlck9wdGlvbnMudHJpZ2dlcktpbmQsIENvbXBsZXRpb25UcmlnZ2VyS2luZC5UcmlnZ2VyQ2hhcmFjdGVyKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LmNvbXBsZXRpb25Nb2RlbC5pdGVtcy5sZW5ndGgsIDEpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1NuaXBwZXRzIGdvbmUgZnJvbSBJbnRlbGxpU2Vuc2UgIzE3MzI0NCcsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IHNuaXBwZXRQcm92aWRlcjogQ29tcGxldGlvbkl0ZW1Qcm92aWRlciA9IHtcblx0XHRcdF9kZWJ1Z0Rpc3BsYXlOYW1lOiAndGVzdCcsXG5cdFx0XHRwcm92aWRlQ29tcGxldGlvbkl0ZW1zKGRvYywgcG9zLCBjdHgpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRzdWdnZXN0aW9uczogW3tcblx0XHRcdFx0XHRcdGxhYmVsOiAnbG9nJyxcblx0XHRcdFx0XHRcdGtpbmQ6IENvbXBsZXRpb25JdGVtS2luZC5TbmlwcGV0LFxuXHRcdFx0XHRcdFx0aW5zZXJ0VGV4dDogJ2xvZycsXG5cdFx0XHRcdFx0XHRyYW5nZTogZ2V0RGVmYXVsdFN1Z2dlc3RSYW5nZShkb2MsIHBvcylcblx0XHRcdFx0XHR9XVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0Y29uc3Qgb2xkID0gc2V0U25pcHBldFN1Z2dlc3RTdXBwb3J0KHNuaXBwZXRQcm92aWRlcik7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdGlmIChnZXRTbmlwcGV0U3VnZ2VzdFN1cHBvcnQoKSA9PT0gc25pcHBldFByb3ZpZGVyKSB7XG5cdFx0XHRcdHNldFNuaXBwZXRTdWdnZXN0U3VwcG9ydChvbGQpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3RyeS5yZWdpc3Rlcih7IHNjaGVtZTogJ3Rlc3QnIH0sIHtcblx0XHRcdF9kZWJ1Z0Rpc3BsYXlOYW1lOiAndGVzdCcsXG5cdFx0XHR0cmlnZ2VyQ2hhcmFjdGVyczogWycuJ10sXG5cdFx0XHRwcm92aWRlQ29tcGxldGlvbkl0ZW1zKGRvYywgcG9zLCBjdHgpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRzdWdnZXN0aW9uczogW3tcblx0XHRcdFx0XHRcdGxhYmVsOiAnbG9jYWxzJyxcblx0XHRcdFx0XHRcdGtpbmQ6IENvbXBsZXRpb25JdGVtS2luZC5Qcm9wZXJ0eSxcblx0XHRcdFx0XHRcdGluc2VydFRleHQ6ICdsb2NhbHMnLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IGdldERlZmF1bHRTdWdnZXN0UmFuZ2UoZG9jLCBwb3MpXG5cdFx0XHRcdFx0fV0sXG5cdFx0XHRcdFx0aW5jb21wbGV0ZTogdHJ1ZVxuXHRcdFx0XHR9O1xuXHRcdFx0fSxcblx0XHR9KSk7XG5cblx0XHRyZXR1cm4gd2l0aE9yYWNsZShhc3luYyBmdW5jdGlvbiAobW9kZWwsIGVkaXRvcikge1xuXG5cdFx0XHRhd2FpdCBhc3NlcnRFdmVudChtb2RlbC5vbkRpZFN1Z2dlc3QsICgpID0+IHtcblx0XHRcdFx0ZWRpdG9yLnNldFZhbHVlKCcnKTtcblx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpKTtcblx0XHRcdFx0ZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgSGFuZGxlci5UeXBlLCB7IHRleHQ6ICdsJyB9KTtcblxuXG5cdFx0XHR9LCBldmVudCA9PiB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC50cmlnZ2VyT3B0aW9ucy5hdXRvLCB0cnVlKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LnRyaWdnZXJPcHRpb25zLnRyaWdnZXJDaGFyYWN0ZXIsIHVuZGVmaW5lZCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC50cmlnZ2VyT3B0aW9ucy50cmlnZ2VyS2luZCwgdW5kZWZpbmVkKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LmNvbXBsZXRpb25Nb2RlbC5pdGVtcy5sZW5ndGgsIDIpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQuY29tcGxldGlvbk1vZGVsLml0ZW1zWzBdLnRleHRMYWJlbCwgJ2xvY2FscycpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQuY29tcGxldGlvbk1vZGVsLml0ZW1zWzFdLnRleHRMYWJlbCwgJ2xvZycpO1xuXHRcdFx0fSk7XG5cblx0XHRcdGF3YWl0IGFzc2VydEV2ZW50KG1vZGVsLm9uRGlkU3VnZ2VzdCwgKCkgPT4ge1xuXHRcdFx0XHRlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCBIYW5kbGVyLlR5cGUsIHsgdGV4dDogJ28nIH0pO1xuXG5cdFx0XHR9LCBldmVudCA9PiB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC50cmlnZ2VyT3B0aW9ucy50cmlnZ2VyS2luZCwgQ29tcGxldGlvblRyaWdnZXJLaW5kLlRyaWdnZXJGb3JJbmNvbXBsZXRlQ29tcGxldGlvbnMpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQudHJpZ2dlck9wdGlvbnMuYXV0bywgdHJ1ZSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC5jb21wbGV0aW9uTW9kZWwuaXRlbXMubGVuZ3RoLCAyKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LmNvbXBsZXRpb25Nb2RlbC5pdGVtc1swXS50ZXh0TGFiZWwsICdsb2NhbHMnKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LmNvbXBsZXRpb25Nb2RlbC5pdGVtc1sxXS50ZXh0TGFiZWwsICdsb2cnKTtcblx0XHRcdH0pO1xuXG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUlBLE9BQU8sWUFBWTtBQUVuQixTQUFTLFlBQVksaUJBQWlCLG9CQUFvQjtBQUMxRCxTQUFTLFdBQVc7QUFDcEIsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMscUJBQXFCO0FBRTlCLFNBQVMsYUFB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
