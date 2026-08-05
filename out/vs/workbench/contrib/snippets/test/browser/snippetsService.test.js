import assert from "assert";
import { SnippetCompletionProvider } from "../../browser/snippetCompletionProvider.js";
import { Position } from "../../../../../editor/common/core/position.js";
import { createModelServices, instantiateTextModel } from "../../../../../editor/test/common/testTextModel.js";
import { Snippet, SnippetSource } from "../../browser/snippetsFile.js";
import { CompletionTriggerKind } from "../../../../../editor/common/languages.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { TestLanguageConfigurationService } from "../../../../../editor/test/common/modes/testLanguageConfigurationService.js";
import { EditOperation } from "../../../../../editor/common/core/editOperation.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { CompletionModel } from "../../../../../editor/contrib/suggest/browser/completionModel.js";
import { CompletionItem } from "../../../../../editor/contrib/suggest/browser/suggest.js";
import { WordDistance } from "../../../../../editor/contrib/suggest/browser/wordDistance.js";
import { EditorOptions } from "../../../../../editor/common/config/editorOptions.js";
class SimpleSnippetService {
  constructor(snippets) {
    this.snippets = snippets;
  }
  getSnippets() {
    return Promise.resolve(this.getSnippetsSync());
  }
  getSnippetsSync() {
    return this.snippets;
  }
  getSnippetFiles() {
    throw new Error();
  }
  isEnabled() {
    throw new Error();
  }
  updateEnablement() {
    throw new Error();
  }
  updateUsageTimestamp(snippet) {
    throw new Error();
  }
}
suite("SnippetsService", function() {
  const defaultCompletionContext = { triggerKind: CompletionTriggerKind.Invoke };
  let disposables;
  let instantiationService;
  let languageService;
  let snippetService;
  setup(function() {
    disposables = new DisposableStore();
    instantiationService = createModelServices(disposables);
    languageService = instantiationService.get(ILanguageService);
    disposables.add(languageService.registerLanguage({
      id: "fooLang",
      extensions: [".fooLang"]
    }));
    snippetService = new SimpleSnippetService([new Snippet(
      false,
      ["fooLang"],
      "barTest",
      "bar",
      "",
      "barCodeSnippet",
      "",
      SnippetSource.User,
      generateUuid()
    ), new Snippet(
      false,
      ["fooLang"],
      "bazzTest",
      "bazz",
      "",
      "bazzCodeSnippet",
      "",
      SnippetSource.User,
      generateUuid()
    )]);
  });
  teardown(() => {
    disposables.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  async function asCompletionModel(model, position, provider, context = defaultCompletionContext) {
    const list = await provider.provideCompletionItems(model, Position.lift(position), context);
    const result = new CompletionModel(
      list.suggestions.map((s) => {
        return new CompletionItem(position, s, list, provider);
      }),
      position.column,
      { characterCountDelta: 0, leadingLineContent: model.getLineContent(position.lineNumber).substring(0, position.column - 1) },
      WordDistance.None,
      EditorOptions.suggest.defaultValue,
      EditorOptions.snippetSuggestions.defaultValue,
      void 0
    );
    return result;
  }
  test("snippet completions - simple", async function() {
    const provider = new SnippetCompletionProvider(languageService, snippetService, disposables.add(new TestLanguageConfigurationService()));
    const model = disposables.add(instantiateTextModel(instantiationService, "", "fooLang"));
    await provider.provideCompletionItems(model, new Position(1, 1), defaultCompletionContext).then((result) => {
      assert.strictEqual(result.incomplete, void 0);
      assert.strictEqual(result.suggestions.length, 2);
    });
    const completions = await asCompletionModel(model, new Position(1, 1), provider);
    assert.strictEqual(completions.items.length, 2);
  });
  test("snippet completions - simple 2", async function() {
    const provider = new SnippetCompletionProvider(languageService, snippetService, disposables.add(new TestLanguageConfigurationService()));
    const model = disposables.add(instantiateTextModel(instantiationService, "hello ", "fooLang"));
    await provider.provideCompletionItems(model, new Position(1, 6), defaultCompletionContext).then((result) => {
      assert.strictEqual(result.incomplete, void 0);
      assert.strictEqual(result.suggestions.length, 0);
    });
    await provider.provideCompletionItems(model, new Position(1, 7), defaultCompletionContext).then((result) => {
      assert.strictEqual(result.incomplete, void 0);
      assert.strictEqual(result.suggestions.length, 2);
    });
    const completions1 = await asCompletionModel(model, new Position(1, 6), provider);
    assert.strictEqual(completions1.items.length, 0);
    const completions2 = await asCompletionModel(model, new Position(1, 7), provider);
    assert.strictEqual(completions2.items.length, 2);
  });
  test("snippet completions - with prefix", async function() {
    const provider = new SnippetCompletionProvider(languageService, snippetService, disposables.add(new TestLanguageConfigurationService()));
    const model = disposables.add(instantiateTextModel(instantiationService, "bar", "fooLang"));
    await provider.provideCompletionItems(model, new Position(1, 4), defaultCompletionContext).then((result) => {
      assert.strictEqual(result.incomplete, void 0);
      assert.strictEqual(result.suggestions.length, 1);
      assert.deepStrictEqual(result.suggestions[0].label, {
        label: "bar",
        description: "barTest"
      });
      assert.strictEqual(result.suggestions[0].range.insert.startColumn, 1);
      assert.strictEqual(result.suggestions[0].insertText, "barCodeSnippet");
    });
    const completions = await asCompletionModel(model, new Position(1, 4), provider);
    assert.strictEqual(completions.items.length, 1);
    assert.deepStrictEqual(completions.items[0].completion.label, {
      label: "bar",
      description: "barTest"
    });
    assert.strictEqual(completions.items[0].completion.range.insert.startColumn, 1);
    assert.strictEqual(completions.items[0].completion.insertText, "barCodeSnippet");
  });
  test("snippet completions - with different prefixes", async function() {
    snippetService = new SimpleSnippetService([new Snippet(
      false,
      ["fooLang"],
      "barTest",
      "bar",
      "",
      "s1",
      "",
      SnippetSource.User,
      generateUuid()
    ), new Snippet(
      false,
      ["fooLang"],
      "name",
      "bar-bar",
      "",
      "s2",
      "",
      SnippetSource.User,
      generateUuid()
    )]);
    const provider = new SnippetCompletionProvider(languageService, snippetService, disposables.add(new TestLanguageConfigurationService()));
    const model = disposables.add(instantiateTextModel(instantiationService, "bar-bar", "fooLang"));
    {
      await provider.provideCompletionItems(model, new Position(1, 3), defaultCompletionContext).then((result) => {
        assert.strictEqual(result.incomplete, void 0);
        assert.strictEqual(result.suggestions.length, 2);
        assert.deepStrictEqual(result.suggestions[0].label, {
          label: "bar",
          description: "barTest"
        });
        assert.strictEqual(result.suggestions[0].insertText, "s1");
        assert.strictEqual(result.suggestions[0].range.insert.startColumn, 1);
        assert.deepStrictEqual(result.suggestions[1].label, {
          label: "bar-bar",
          description: "name"
        });
        assert.strictEqual(result.suggestions[1].insertText, "s2");
        assert.strictEqual(result.suggestions[1].range.insert.startColumn, 1);
      });
      const completions = await asCompletionModel(model, new Position(1, 3), provider);
      assert.strictEqual(completions.items.length, 2);
      assert.deepStrictEqual(completions.items[0].completion.label, {
        label: "bar",
        description: "barTest"
      });
      assert.strictEqual(completions.items[0].completion.insertText, "s1");
      assert.strictEqual(completions.items[0].completion.range.insert.startColumn, 1);
      assert.deepStrictEqual(completions.items[1].completion.label, {
        label: "bar-bar",
        description: "name"
      });
      assert.strictEqual(completions.items[1].completion.insertText, "s2");
      assert.strictEqual(completions.items[1].completion.range.insert.startColumn, 1);
    }
    {
      await provider.provideCompletionItems(model, new Position(1, 5), defaultCompletionContext).then((result) => {
        assert.strictEqual(result.incomplete, void 0);
        assert.strictEqual(result.suggestions.length, 2);
        const [first2, second2] = result.suggestions;
        assert.deepStrictEqual(first2.label, {
          label: "bar",
          description: "barTest"
        });
        assert.strictEqual(first2.insertText, "s1");
        assert.strictEqual(first2.range.insert.startColumn, 5);
        assert.deepStrictEqual(second2.label, {
          label: "bar-bar",
          description: "name"
        });
        assert.strictEqual(second2.insertText, "s2");
        assert.strictEqual(second2.range.insert.startColumn, 1);
      });
      const completions = await asCompletionModel(model, new Position(1, 5), provider);
      assert.strictEqual(completions.items.length, 2);
      const [first, second] = completions.items.map((i) => i.completion);
      assert.deepStrictEqual(first.label, {
        label: "bar-bar",
        description: "name"
      });
      assert.strictEqual(first.insertText, "s2");
      assert.strictEqual(first.range.insert.startColumn, 1);
      assert.deepStrictEqual(second.label, {
        label: "bar",
        description: "barTest"
      });
      assert.strictEqual(second.insertText, "s1");
      assert.strictEqual(second.range.insert.startColumn, 5);
    }
    {
      await provider.provideCompletionItems(model, new Position(1, 6), defaultCompletionContext).then((result) => {
        assert.strictEqual(result.incomplete, void 0);
        assert.strictEqual(result.suggestions.length, 2);
        assert.deepStrictEqual(result.suggestions[0].label, {
          label: "bar",
          description: "barTest"
        });
        assert.strictEqual(result.suggestions[0].insertText, "s1");
        assert.strictEqual(result.suggestions[0].range.insert.startColumn, 5);
        assert.deepStrictEqual(result.suggestions[1].label, {
          label: "bar-bar",
          description: "name"
        });
        assert.strictEqual(result.suggestions[1].insertText, "s2");
        assert.strictEqual(result.suggestions[1].range.insert.startColumn, 1);
      });
      const completions = await asCompletionModel(model, new Position(1, 6), provider);
      assert.strictEqual(completions.items.length, 2);
      assert.deepStrictEqual(completions.items[0].completion.label, {
        label: "bar-bar",
        description: "name"
      });
      assert.strictEqual(completions.items[0].completion.insertText, "s2");
      assert.strictEqual(completions.items[0].completion.range.insert.startColumn, 1);
      assert.deepStrictEqual(completions.items[1].completion.label, {
        label: "bar",
        description: "barTest"
      });
      assert.strictEqual(completions.items[1].completion.insertText, "s1");
      assert.strictEqual(completions.items[1].completion.range.insert.startColumn, 5);
    }
  });
  test('Cannot use "<?php" as user snippet prefix anymore, #26275', async function() {
    snippetService = new SimpleSnippetService([new Snippet(
      false,
      ["fooLang"],
      "",
      "<?php",
      "",
      "insert me",
      "",
      SnippetSource.User,
      generateUuid()
    )]);
    const provider = new SnippetCompletionProvider(languageService, snippetService, disposables.add(new TestLanguageConfigurationService()));
    let model = instantiateTextModel(instantiationService, "	<?php", "fooLang");
    await provider.provideCompletionItems(model, new Position(1, 7), defaultCompletionContext).then((result) => {
      assert.strictEqual(result.suggestions.length, 1);
    });
    const completions1 = await asCompletionModel(model, new Position(1, 7), provider);
    assert.strictEqual(completions1.items.length, 1);
    model.dispose();
    model = instantiateTextModel(instantiationService, "	<?", "fooLang");
    await provider.provideCompletionItems(model, new Position(1, 4), defaultCompletionContext).then((result) => {
      assert.strictEqual(result.suggestions.length, 1);
      assert.strictEqual(result.suggestions[0].range.insert.startColumn, 2);
    });
    const completions2 = await asCompletionModel(model, new Position(1, 4), provider);
    assert.strictEqual(completions2.items.length, 1);
    assert.strictEqual(completions2.items[0].completion.range.insert.startColumn, 2);
    model.dispose();
    model = instantiateTextModel(instantiationService, "a<?", "fooLang");
    await provider.provideCompletionItems(model, new Position(1, 4), defaultCompletionContext).then((result) => {
      assert.strictEqual(result.suggestions.length, 1);
      assert.strictEqual(result.suggestions[0].range.insert.startColumn, 2);
    });
    const completions3 = await asCompletionModel(model, new Position(1, 4), provider);
    assert.strictEqual(completions3.items.length, 1);
    assert.strictEqual(completions3.items[0].completion.range.insert.startColumn, 2);
    model.dispose();
  });
  test("No user snippets in suggestions, when inside the code, #30508", async function() {
    snippetService = new SimpleSnippetService([new Snippet(
      false,
      ["fooLang"],
      "",
      "foo",
      "",
      "<foo>$0</foo>",
      "",
      SnippetSource.User,
      generateUuid()
    )]);
    const provider = new SnippetCompletionProvider(languageService, snippetService, disposables.add(new TestLanguageConfigurationService()));
    const model = disposables.add(instantiateTextModel(instantiationService, "<head>\n	\n>/head>", "fooLang"));
    await provider.provideCompletionItems(model, new Position(1, 1), defaultCompletionContext).then((result) => {
      assert.strictEqual(result.suggestions.length, 1);
    });
    const completions = await asCompletionModel(model, new Position(1, 1), provider);
    assert.strictEqual(completions.items.length, 1);
    await provider.provideCompletionItems(model, new Position(2, 2), defaultCompletionContext).then((result) => {
      assert.strictEqual(result.suggestions.length, 1);
    });
    const completions2 = await asCompletionModel(model, new Position(2, 2), provider);
    assert.strictEqual(completions2.items.length, 1);
  });
  test("SnippetSuggest - ensure extension snippets come last ", async function() {
    snippetService = new SimpleSnippetService([new Snippet(
      false,
      ["fooLang"],
      "second",
      "second",
      "",
      "second",
      "",
      SnippetSource.Extension,
      generateUuid()
    ), new Snippet(
      false,
      ["fooLang"],
      "first",
      "first",
      "",
      "first",
      "",
      SnippetSource.User,
      generateUuid()
    )]);
    const provider = new SnippetCompletionProvider(languageService, snippetService, disposables.add(new TestLanguageConfigurationService()));
    const model = disposables.add(instantiateTextModel(instantiationService, "", "fooLang"));
    await provider.provideCompletionItems(model, new Position(1, 1), defaultCompletionContext).then((result) => {
      assert.strictEqual(result.suggestions.length, 2);
      const [first2, second2] = result.suggestions;
      assert.deepStrictEqual(first2.label, {
        label: "first",
        description: "first"
      });
      assert.deepStrictEqual(second2.label, {
        label: "second",
        description: "second"
      });
    });
    const completions = await asCompletionModel(model, new Position(1, 1), provider);
    assert.strictEqual(completions.items.length, 2);
    const [first, second] = completions.items;
    assert.deepStrictEqual(first.completion.label, {
      label: "first",
      description: "first"
    });
    assert.deepStrictEqual(second.completion.label, {
      label: "second",
      description: "second"
    });
  });
  test("Dash in snippets prefix broken #53945", async function() {
    snippetService = new SimpleSnippetService([new Snippet(
      false,
      ["fooLang"],
      "p-a",
      "p-a",
      "",
      "second",
      "",
      SnippetSource.User,
      generateUuid()
    )]);
    const provider = new SnippetCompletionProvider(languageService, snippetService, disposables.add(new TestLanguageConfigurationService()));
    const model = disposables.add(instantiateTextModel(instantiationService, "p-", "fooLang"));
    let result = await provider.provideCompletionItems(model, new Position(1, 2), defaultCompletionContext);
    let completions = await asCompletionModel(model, new Position(1, 2), provider);
    assert.strictEqual(result.suggestions.length, 1);
    assert.strictEqual(completions.items.length, 1);
    result = await provider.provideCompletionItems(model, new Position(1, 3), defaultCompletionContext);
    completions = await asCompletionModel(model, new Position(1, 3), provider);
    assert.strictEqual(result.suggestions.length, 1);
    assert.strictEqual(completions.items.length, 1);
    result = await provider.provideCompletionItems(model, new Position(1, 3), defaultCompletionContext);
    completions = await asCompletionModel(model, new Position(1, 3), provider);
    assert.strictEqual(result.suggestions.length, 1);
    assert.strictEqual(completions.items.length, 1);
  });
  test("No snippets suggestion on long lines beyond character 100 #58807", async function() {
    snippetService = new SimpleSnippetService([new Snippet(
      false,
      ["fooLang"],
      "bug",
      "bug",
      "",
      "second",
      "",
      SnippetSource.User,
      generateUuid()
    )]);
    const provider = new SnippetCompletionProvider(languageService, snippetService, disposables.add(new TestLanguageConfigurationService()));
    const model = disposables.add(instantiateTextModel(instantiationService, "Thisisaverylonglinegoingwithmore100bcharactersandthismakesintellisensebecomea Thisisaverylonglinegoingwithmore100bcharactersandthismakesintellisensebecomea b", "fooLang"));
    const result = await provider.provideCompletionItems(model, new Position(1, 158), defaultCompletionContext);
    const completions = await asCompletionModel(model, new Position(1, 158), provider);
    assert.strictEqual(result.suggestions.length, 1);
    assert.strictEqual(completions.items.length, 1);
  });
  test("Type colon will trigger snippet #60746", async function() {
    snippetService = new SimpleSnippetService([new Snippet(
      false,
      ["fooLang"],
      "bug",
      "bug",
      "",
      "second",
      "",
      SnippetSource.User,
      generateUuid()
    )]);
    const provider = new SnippetCompletionProvider(languageService, snippetService, disposables.add(new TestLanguageConfigurationService()));
    const model = disposables.add(instantiateTextModel(instantiationService, ":", "fooLang"));
    const result = await provider.provideCompletionItems(model, new Position(1, 2), defaultCompletionContext);
    assert.strictEqual(result.suggestions.length, 0);
    const completions = await asCompletionModel(model, new Position(1, 2), provider);
    assert.strictEqual(completions.items.length, 0);
  });
  test("substring of prefix can't trigger snippet #60737", async function() {
    snippetService = new SimpleSnippetService([new Snippet(
      false,
      ["fooLang"],
      "mytemplate",
      "mytemplate",
      "",
      "second",
      "",
      SnippetSource.User,
      generateUuid()
    )]);
    const provider = new SnippetCompletionProvider(languageService, snippetService, disposables.add(new TestLanguageConfigurationService()));
    const model = disposables.add(instantiateTextModel(instantiationService, "template", "fooLang"));
    const result = await provider.provideCompletionItems(model, new Position(1, 9), defaultCompletionContext);
    assert.strictEqual(result.suggestions.length, 1);
    assert.deepStrictEqual(result.suggestions[0].label, {
      label: "mytemplate",
      description: "mytemplate"
    });
    const completions = await asCompletionModel(model, new Position(1, 9), provider);
    assert.strictEqual(completions.items.length, 0);
  });
  test("No snippets suggestion beyond character 100 if not at end of line #60247", async function() {
    snippetService = new SimpleSnippetService([new Snippet(
      false,
      ["fooLang"],
      "bug",
      "bug",
      "",
      "second",
      "",
      SnippetSource.User,
      generateUuid()
    )]);
    const provider = new SnippetCompletionProvider(languageService, snippetService, disposables.add(new TestLanguageConfigurationService()));
    const model = disposables.add(instantiateTextModel(instantiationService, "Thisisaverylonglinegoingwithmore100bcharactersandthismakesintellisensebecomea Thisisaverylonglinegoingwithmore100bcharactersandthismakesintellisensebecomea b text_after_b", "fooLang"));
    const result = await provider.provideCompletionItems(model, new Position(1, 158), defaultCompletionContext);
    assert.strictEqual(result.suggestions.length, 1);
    const completions = await asCompletionModel(model, new Position(1, 158), provider);
    assert.strictEqual(completions.items.length, 1);
  });
  test("issue #61296: VS code freezes when editing CSS fi`le with emoji", async function() {
    const languageConfigurationService = disposables.add(new TestLanguageConfigurationService());
    disposables.add(languageConfigurationService.register("fooLang", {
      wordPattern: /(#?-?\d*\.\d\w*%?)|(::?[\w-]*(?=[^,{;]*[,{]))|(([@#.!])?[\w\-?]+%?|[@#!.])/g
    }));
    snippetService = new SimpleSnippetService([new Snippet(
      false,
      ["fooLang"],
      "bug",
      "-a-bug",
      "",
      "second",
      "",
      SnippetSource.User,
      generateUuid()
    )]);
    const provider = new SnippetCompletionProvider(languageService, snippetService, languageConfigurationService);
    const model = disposables.add(instantiateTextModel(instantiationService, ".\u{1F437}-a-b", "fooLang"));
    const result = await provider.provideCompletionItems(model, new Position(1, 8), defaultCompletionContext);
    assert.strictEqual(result.suggestions.length, 1);
    const completions = await asCompletionModel(model, new Position(1, 8), provider);
    assert.strictEqual(completions.items.length, 1);
  });
  test("No snippets shown when triggering completions at whitespace on line that already has text #62335", async function() {
    snippetService = new SimpleSnippetService([new Snippet(
      false,
      ["fooLang"],
      "bug",
      "bug",
      "",
      "second",
      "",
      SnippetSource.User,
      generateUuid()
    )]);
    const provider = new SnippetCompletionProvider(languageService, snippetService, disposables.add(new TestLanguageConfigurationService()));
    const model = disposables.add(instantiateTextModel(instantiationService, "a ", "fooLang"));
    const result = await provider.provideCompletionItems(model, new Position(1, 3), defaultCompletionContext);
    assert.strictEqual(result.suggestions.length, 1);
    const completions = await asCompletionModel(model, new Position(1, 3), provider);
    assert.strictEqual(completions.items.length, 1);
  });
  test("Snippet prefix with special chars and numbers does not work #62906", async function() {
    snippetService = new SimpleSnippetService([new Snippet(
      false,
      ["fooLang"],
      "noblockwdelay",
      "<<",
      "",
      '<= #dly"',
      "",
      SnippetSource.User,
      generateUuid()
    ), new Snippet(
      false,
      ["fooLang"],
      "noblockwdelay",
      "11",
      "",
      "eleven",
      "",
      SnippetSource.User,
      generateUuid()
    )]);
    const provider = new SnippetCompletionProvider(languageService, snippetService, disposables.add(new TestLanguageConfigurationService()));
    let model = instantiateTextModel(instantiationService, " <", "fooLang");
    let result = await provider.provideCompletionItems(model, new Position(1, 3), defaultCompletionContext);
    assert.strictEqual(result.suggestions.length, 1);
    let [first] = result.suggestions;
    assert.strictEqual(first.range.insert.startColumn, 2);
    let completions = await asCompletionModel(model, new Position(1, 3), provider);
    assert.strictEqual(completions.items.length, 1);
    assert.strictEqual(completions.items[0].editStart.column, 2);
    model.dispose();
    model = instantiateTextModel(instantiationService, "1", "fooLang");
    result = await provider.provideCompletionItems(model, new Position(1, 2), defaultCompletionContext);
    completions = await asCompletionModel(model, new Position(1, 2), provider);
    assert.strictEqual(result.suggestions.length, 1);
    [first] = result.suggestions;
    assert.strictEqual(first.range.insert.startColumn, 1);
    assert.strictEqual(completions.items.length, 1);
    assert.strictEqual(completions.items[0].editStart.column, 1);
    model.dispose();
  });
  test("Snippet replace range", async function() {
    snippetService = new SimpleSnippetService([new Snippet(
      false,
      ["fooLang"],
      "notWordTest",
      "not word",
      "",
      "not word snippet",
      "",
      SnippetSource.User,
      generateUuid()
    )]);
    const provider = new SnippetCompletionProvider(languageService, snippetService, disposables.add(new TestLanguageConfigurationService()));
    let model = instantiateTextModel(instantiationService, "not wordFoo bar", "fooLang");
    let result = await provider.provideCompletionItems(model, new Position(1, 3), defaultCompletionContext);
    assert.strictEqual(result.suggestions.length, 1);
    let [first] = result.suggestions;
    assert.strictEqual(first.range.insert.endColumn, 3);
    assert.strictEqual(first.range.replace.endColumn, 9);
    let completions = await asCompletionModel(model, new Position(1, 3), provider);
    assert.strictEqual(completions.items.length, 1);
    assert.strictEqual(completions.items[0].editInsertEnd.column, 3);
    assert.strictEqual(completions.items[0].editReplaceEnd.column, 9);
    model.dispose();
    model = instantiateTextModel(instantiationService, "not woFoo bar", "fooLang");
    result = await provider.provideCompletionItems(model, new Position(1, 3), defaultCompletionContext);
    assert.strictEqual(result.suggestions.length, 1);
    [first] = result.suggestions;
    assert.strictEqual(first.range.insert.endColumn, 3);
    assert.strictEqual(first.range.replace.endColumn, 3);
    completions = await asCompletionModel(model, new Position(1, 3), provider);
    assert.strictEqual(completions.items.length, 1);
    assert.strictEqual(completions.items[0].editInsertEnd.column, 3);
    assert.strictEqual(completions.items[0].editReplaceEnd.column, 3);
    model.dispose();
    model = instantiateTextModel(instantiationService, "not word", "fooLang");
    result = await provider.provideCompletionItems(model, new Position(1, 1), defaultCompletionContext);
    assert.strictEqual(result.suggestions.length, 1);
    [first] = result.suggestions;
    assert.strictEqual(first.range.insert.endColumn, 1);
    assert.strictEqual(first.range.replace.endColumn, 9);
    completions = await asCompletionModel(model, new Position(1, 1), provider);
    assert.strictEqual(completions.items.length, 1);
    assert.strictEqual(completions.items[0].editInsertEnd.column, 1);
    assert.strictEqual(completions.items[0].editReplaceEnd.column, 9);
    model.dispose();
  });
  test("Snippet replace-range incorrect #108894", async function() {
    snippetService = new SimpleSnippetService([new Snippet(
      false,
      ["fooLang"],
      "eng",
      "eng",
      "",
      "<span></span>",
      "",
      SnippetSource.User,
      generateUuid()
    )]);
    const provider = new SnippetCompletionProvider(languageService, snippetService, disposables.add(new TestLanguageConfigurationService()));
    const model = instantiateTextModel(instantiationService, "filler e KEEP ng filler", "fooLang");
    const result = await provider.provideCompletionItems(model, new Position(1, 9), defaultCompletionContext);
    const completions = await asCompletionModel(model, new Position(1, 9), provider);
    assert.strictEqual(result.suggestions.length, 1);
    const [first] = result.suggestions;
    assert.strictEqual(first.range.insert.endColumn, 9);
    assert.strictEqual(first.range.replace.endColumn, 9);
    assert.strictEqual(completions.items.length, 1);
    assert.strictEqual(completions.items[0].editInsertEnd.column, 9);
    assert.strictEqual(completions.items[0].editReplaceEnd.column, 9);
    model.dispose();
  });
  test("Snippet will replace auto-closing pair if specified in prefix", async function() {
    const languageConfigurationService = disposables.add(new TestLanguageConfigurationService());
    disposables.add(languageConfigurationService.register("fooLang", {
      brackets: [
        ["{", "}"],
        ["[", "]"],
        ["(", ")"]
      ]
    }));
    snippetService = new SimpleSnippetService([new Snippet(
      false,
      ["fooLang"],
      "PSCustomObject",
      "[PSCustomObject]",
      "",
      "[PSCustomObject] @{ Key = Value }",
      "",
      SnippetSource.User,
      generateUuid()
    )]);
    const provider = new SnippetCompletionProvider(languageService, snippetService, languageConfigurationService);
    const model = instantiateTextModel(instantiationService, "[psc]", "fooLang");
    const result = await provider.provideCompletionItems(model, new Position(1, 5), defaultCompletionContext);
    const completions = await asCompletionModel(model, new Position(1, 5), provider);
    assert.strictEqual(result.suggestions.length, 1);
    const [first] = result.suggestions;
    assert.strictEqual(first.range.insert.endColumn, 5);
    assert.strictEqual(first.range.replace.endColumn, 6);
    assert.strictEqual(completions.items.length, 1);
    assert.strictEqual(completions.items[0].editInsertEnd.column, 5);
    assert.strictEqual(completions.items[0].editReplaceEnd.column, 6);
    model.dispose();
  });
  test("Leading whitespace in snippet prefix #123860", async function() {
    snippetService = new SimpleSnippetService([new Snippet(
      false,
      ["fooLang"],
      "cite-name",
      " cite",
      "",
      "~\\cite{$CLIPBOARD}",
      "",
      SnippetSource.User,
      generateUuid()
    )]);
    const provider = new SnippetCompletionProvider(languageService, snippetService, disposables.add(new TestLanguageConfigurationService()));
    const model = instantiateTextModel(instantiationService, " ci", "fooLang");
    const result = await provider.provideCompletionItems(model, new Position(1, 4), defaultCompletionContext);
    const completions = await asCompletionModel(model, new Position(1, 4), provider);
    assert.strictEqual(result.suggestions.length, 1);
    const [first] = result.suggestions;
    assert.strictEqual(first.label.label, " cite");
    assert.strictEqual(first.range.insert.startColumn, 1);
    assert.strictEqual(completions.items.length, 1);
    assert.strictEqual(completions.items[0].textLabel, " cite");
    assert.strictEqual(completions.items[0].editStart.column, 1);
    model.dispose();
  });
  test("still show suggestions in string when disable string suggestion #136611", async function() {
    snippetService = new SimpleSnippetService([
      new Snippet(false, ["fooLang"], "aaa", "aaa", "", "value", "", SnippetSource.User, generateUuid()),
      new Snippet(false, ["fooLang"], "bbb", "bbb", "", "value", "", SnippetSource.User, generateUuid())
      // new Snippet(['fooLang'], '\'ccc', '\'ccc', '', 'value', '', SnippetSource.User, generateUuid())
    ]);
    const provider = new SnippetCompletionProvider(languageService, snippetService, disposables.add(new TestLanguageConfigurationService()));
    const model = instantiateTextModel(instantiationService, "''", "fooLang");
    const result = await provider.provideCompletionItems(
      model,
      new Position(1, 2),
      { triggerKind: CompletionTriggerKind.TriggerCharacter, triggerCharacter: "'" }
    );
    assert.strictEqual(result.suggestions.length, 0);
    model.dispose();
  });
  test("still show suggestions in string when disable string suggestion #136611 (part 2)", async function() {
    snippetService = new SimpleSnippetService([
      new Snippet(false, ["fooLang"], "aaa", "aaa", "", "value", "", SnippetSource.User, generateUuid()),
      new Snippet(false, ["fooLang"], "bbb", "bbb", "", "value", "", SnippetSource.User, generateUuid()),
      new Snippet(false, ["fooLang"], "'ccc", "'ccc", "", "value", "", SnippetSource.User, generateUuid())
    ]);
    const provider = new SnippetCompletionProvider(languageService, snippetService, disposables.add(new TestLanguageConfigurationService()));
    const model = instantiateTextModel(instantiationService, "''", "fooLang");
    const result = await provider.provideCompletionItems(
      model,
      new Position(1, 2),
      { triggerKind: CompletionTriggerKind.TriggerCharacter, triggerCharacter: "'" }
    );
    assert.strictEqual(result.suggestions.length, 1);
    const completions = await asCompletionModel(model, new Position(1, 2), provider, { triggerKind: CompletionTriggerKind.TriggerCharacter, triggerCharacter: "'" });
    assert.strictEqual(completions.items.length, 1);
    model.dispose();
  });
  test("Snippet suggestions are too eager #138707 (word)", async function() {
    snippetService = new SimpleSnippetService([
      new Snippet(false, ["fooLang"], "tys", "tys", "", "value", "", SnippetSource.User, generateUuid()),
      new Snippet(false, ["fooLang"], "hell_or_tell", "hell_or_tell", "", "value", "", SnippetSource.User, generateUuid()),
      new Snippet(false, ["fooLang"], "^y", "^y", "", "value", "", SnippetSource.User, generateUuid())
    ]);
    const provider = new SnippetCompletionProvider(languageService, snippetService, disposables.add(new TestLanguageConfigurationService()));
    const model = instantiateTextModel(instantiationService, "'hellot'", "fooLang");
    const result = await provider.provideCompletionItems(
      model,
      new Position(1, 8),
      { triggerKind: CompletionTriggerKind.Invoke }
    );
    assert.strictEqual(result.suggestions.length, 1);
    assert.strictEqual(result.suggestions[0].label.label, "hell_or_tell");
    const completions = await asCompletionModel(model, new Position(1, 8), provider, { triggerKind: CompletionTriggerKind.Invoke });
    assert.strictEqual(completions.items.length, 1);
    assert.strictEqual(completions.items[0].textLabel, "hell_or_tell");
    model.dispose();
  });
  test("Snippet suggestions are too eager #138707 (no word)", async function() {
    snippetService = new SimpleSnippetService([
      new Snippet(false, ["fooLang"], "tys", "tys", "", "value", "", SnippetSource.User, generateUuid()),
      new Snippet(false, ["fooLang"], "t", "t", "", "value", "", SnippetSource.User, generateUuid()),
      new Snippet(false, ["fooLang"], "^y", "^y", "", "value", "", SnippetSource.User, generateUuid())
    ]);
    const provider = new SnippetCompletionProvider(languageService, snippetService, disposables.add(new TestLanguageConfigurationService()));
    const model = instantiateTextModel(instantiationService, ")*&^", "fooLang");
    const result = await provider.provideCompletionItems(
      model,
      new Position(1, 5),
      { triggerKind: CompletionTriggerKind.Invoke }
    );
    assert.strictEqual(result.suggestions.length, 1);
    assert.strictEqual(result.suggestions[0].label.label, "^y");
    const completions = await asCompletionModel(model, new Position(1, 5), provider, { triggerKind: CompletionTriggerKind.Invoke });
    assert.strictEqual(completions.items.length, 1);
    assert.strictEqual(completions.items[0].textLabel, "^y");
    model.dispose();
  });
  test("Snippet suggestions are too eager #138707 (word/word)", async function() {
    snippetService = new SimpleSnippetService([
      new Snippet(false, ["fooLang"], "async arrow function", "async arrow function", "", "value", "", SnippetSource.User, generateUuid()),
      new Snippet(false, ["fooLang"], "foobarrrrrr", "foobarrrrrr", "", "value", "", SnippetSource.User, generateUuid())
    ]);
    const provider = new SnippetCompletionProvider(languageService, snippetService, disposables.add(new TestLanguageConfigurationService()));
    const model = instantiateTextModel(instantiationService, "foobar", "fooLang");
    const result = await provider.provideCompletionItems(
      model,
      new Position(1, 7),
      { triggerKind: CompletionTriggerKind.Invoke }
    );
    assert.strictEqual(result.suggestions.length, 1);
    assert.strictEqual(result.suggestions[0].label.label, "foobarrrrrr");
    const completions = await asCompletionModel(model, new Position(1, 7), provider, { triggerKind: CompletionTriggerKind.Invoke });
    assert.strictEqual(completions.items.length, 1);
    assert.strictEqual(completions.items[0].textLabel, "foobarrrrrr");
    model.dispose();
  });
  test("Strange and useless autosuggestion #region/#endregion PHP #140039", async function() {
    snippetService = new SimpleSnippetService([
      new Snippet(false, ["fooLang"], "reg", "#region", "", "value", "", SnippetSource.User, generateUuid())
    ]);
    const provider = new SnippetCompletionProvider(languageService, snippetService, disposables.add(new TestLanguageConfigurationService()));
    const model = instantiateTextModel(instantiationService, "function abc(w)", "fooLang");
    const result = await provider.provideCompletionItems(
      model,
      new Position(1, 15),
      { triggerKind: CompletionTriggerKind.Invoke }
    );
    assert.strictEqual(result.suggestions.length, 0);
    model.dispose();
  });
  test.skip("Snippets disappear with . key #145960", async function() {
    snippetService = new SimpleSnippetService([
      new Snippet(false, ["fooLang"], "div", "div", "", "div", "", SnippetSource.User, generateUuid()),
      new Snippet(false, ["fooLang"], "div.", "div.", "", "div.", "", SnippetSource.User, generateUuid()),
      new Snippet(false, ["fooLang"], "div#", "div#", "", "div#", "", SnippetSource.User, generateUuid())
    ]);
    const provider = new SnippetCompletionProvider(languageService, snippetService, disposables.add(new TestLanguageConfigurationService()));
    const model = instantiateTextModel(instantiationService, "di", "fooLang");
    const result = await provider.provideCompletionItems(
      model,
      new Position(1, 3),
      { triggerKind: CompletionTriggerKind.Invoke }
    );
    assert.strictEqual(result.suggestions.length, 3);
    model.applyEdits([EditOperation.insert(new Position(1, 3), ".")]);
    assert.strictEqual(model.getValue(), "di.");
    const result2 = await provider.provideCompletionItems(
      model,
      new Position(1, 4),
      { triggerKind: CompletionTriggerKind.TriggerCharacter, triggerCharacter: "." }
    );
    assert.strictEqual(result2.suggestions.length, 1);
    assert.strictEqual(result2.suggestions[0].insertText, "div.");
    model.dispose();
  });
  test("Hyphen in snippet prefix de-indents snippet #139016", async function() {
    snippetService = new SimpleSnippetService([
      new Snippet(false, ["fooLang"], "foo", "Foo- Bar", "", "Foo", "", SnippetSource.User, generateUuid())
    ]);
    const model = disposables.add(instantiateTextModel(instantiationService, "    bar", "fooLang"));
    const provider = new SnippetCompletionProvider(languageService, snippetService, disposables.add(new TestLanguageConfigurationService()));
    const result = await provider.provideCompletionItems(
      model,
      new Position(1, 8),
      { triggerKind: CompletionTriggerKind.Invoke }
    );
    assert.strictEqual(result.suggestions.length, 1);
    const first = result.suggestions[0];
    assert.strictEqual(first.range.insert.startColumn, 5);
    const completions = await asCompletionModel(model, new Position(1, 8), provider);
    assert.strictEqual(completions.items.length, 1);
    assert.strictEqual(completions.items[0].editStart.column, 5);
  });
  test("Autocomplete suggests based on the last letter of a word and it depends on the typing speed #191070", async function() {
    snippetService = new SimpleSnippetService([
      new Snippet(false, ["fooLang"], "/whiletrue", "/whiletrue", "", "one", "", SnippetSource.User, generateUuid()),
      new Snippet(false, ["fooLang"], "/sc not expanding", "/sc not expanding", "", "two", "", SnippetSource.User, generateUuid())
    ]);
    const provider = new SnippetCompletionProvider(languageService, snippetService, disposables.add(new TestLanguageConfigurationService()));
    const model = disposables.add(instantiateTextModel(instantiationService, "", "fooLang"));
    {
      model.setValue("w");
      const result1 = await provider.provideCompletionItems(
        model,
        new Position(1, 2),
        { triggerKind: CompletionTriggerKind.Invoke }
      );
      assert.strictEqual(result1.suggestions[0].insertText, "one");
      assert.strictEqual(result1.suggestions.length, 1);
    }
    {
      model.setValue("where");
      const result2 = await provider.provideCompletionItems(
        model,
        new Position(1, 6),
        { triggerKind: CompletionTriggerKind.Invoke }
      );
      assert.strictEqual(result2.suggestions[0].insertText, "one");
      assert.strictEqual(result2.suggestions.length, 1);
    }
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zbmlwcGV0cy90ZXN0L2Jyb3dzZXIvc25pcHBldHNTZXJ2aWNlLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBTbmlwcGV0Q29tcGxldGlvbiwgU25pcHBldENvbXBsZXRpb25Qcm92aWRlciB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvc25pcHBldENvbXBsZXRpb25Qcm92aWRlci5qcyc7XG5pbXBvcnQgeyBJUG9zaXRpb24sIFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IGNyZWF0ZU1vZGVsU2VydmljZXMsIGluc3RhbnRpYXRlVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL3Rlc3QvY29tbW9uL3Rlc3RUZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgSVNuaXBwZXRzU2VydmljZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvc25pcHBldHMuanMnO1xuaW1wb3J0IHsgU25pcHBldCwgU25pcHBldFNvdXJjZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvc25pcHBldHNGaWxlLmpzJztcbmltcG9ydCB7IENvbXBsZXRpb25Db250ZXh0LCBDb21wbGV0aW9uSXRlbUxhYmVsLCBDb21wbGV0aW9uSXRlbVJhbmdlcywgQ29tcGxldGlvblRyaWdnZXJLaW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL3Rlc3QvY29tbW9uL21vZGVzL3Rlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IEVkaXRPcGVyYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvZWRpdE9wZXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL3Rlc3QvY29tbW9uL2luc3RhbnRpYXRpb25TZXJ2aWNlTW9jay5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVVdWlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXVpZC5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IENvbXBsZXRpb25Nb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL3N1Z2dlc3QvYnJvd3Nlci9jb21wbGV0aW9uTW9kZWwuanMnO1xuaW1wb3J0IHsgQ29tcGxldGlvbkl0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9zdWdnZXN0L2Jyb3dzZXIvc3VnZ2VzdC5qcyc7XG5pbXBvcnQgeyBXb3JkRGlzdGFuY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9zdWdnZXN0L2Jyb3dzZXIvd29yZERpc3RhbmNlLmpzJztcbmltcG9ydCB7IEVkaXRvck9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcblxuY2xhc3MgU2ltcGxlU25pcHBldFNlcnZpY2UgaW1wbGVtZW50cyBJU25pcHBldHNTZXJ2aWNlIHtcblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdGNvbnN0cnVjdG9yKHJlYWRvbmx5IHNuaXBwZXRzOiBTbmlwcGV0W10pIHsgfVxuXHRnZXRTbmlwcGV0cygpIHtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuZ2V0U25pcHBldHNTeW5jKCkpO1xuXHR9XG5cdGdldFNuaXBwZXRzU3luYygpOiBTbmlwcGV0W10ge1xuXHRcdHJldHVybiB0aGlzLnNuaXBwZXRzO1xuXHR9XG5cdGdldFNuaXBwZXRGaWxlcygpOiBhbnkge1xuXHRcdHRocm93IG5ldyBFcnJvcigpO1xuXHR9XG5cdGlzRW5hYmxlZCgpOiBib29sZWFuIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoKTtcblx0fVxuXHR1cGRhdGVFbmFibGVtZW50KCk6IHZvaWQge1xuXHRcdHRocm93IG5ldyBFcnJvcigpO1xuXHR9XG5cdHVwZGF0ZVVzYWdlVGltZXN0YW1wKHNuaXBwZXQ6IFNuaXBwZXQpOiB2b2lkIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoKTtcblx0fVxufVxuXG5zdWl0ZSgnU25pcHBldHNTZXJ2aWNlJywgZnVuY3Rpb24gKCkge1xuXHRjb25zdCBkZWZhdWx0Q29tcGxldGlvbkNvbnRleHQ6IENvbXBsZXRpb25Db250ZXh0ID0geyB0cmlnZ2VyS2luZDogQ29tcGxldGlvblRyaWdnZXJLaW5kLkludm9rZSB9O1xuXG5cdGxldCBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlO1xuXHRsZXQgaW5zdGFudGlhdGlvblNlcnZpY2U6IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZTtcblx0bGV0IGxhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZTtcblx0bGV0IHNuaXBwZXRTZXJ2aWNlOiBJU25pcHBldHNTZXJ2aWNlO1xuXG5cdHNldHVwKGZ1bmN0aW9uICgpIHtcblx0XHRkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZSA9IGNyZWF0ZU1vZGVsU2VydmljZXMoZGlzcG9zYWJsZXMpO1xuXHRcdGxhbmd1YWdlU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTGFuZ3VhZ2VTZXJ2aWNlKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VTZXJ2aWNlLnJlZ2lzdGVyTGFuZ3VhZ2Uoe1xuXHRcdFx0aWQ6ICdmb29MYW5nJyxcblx0XHRcdGV4dGVuc2lvbnM6IFsnLmZvb0xhbmcnLF1cblx0XHR9KSk7XG5cdFx0c25pcHBldFNlcnZpY2UgPSBuZXcgU2ltcGxlU25pcHBldFNlcnZpY2UoW25ldyBTbmlwcGV0KFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRbJ2Zvb0xhbmcnXSxcblx0XHRcdCdiYXJUZXN0Jyxcblx0XHRcdCdiYXInLFxuXHRcdFx0JycsXG5cdFx0XHQnYmFyQ29kZVNuaXBwZXQnLFxuXHRcdFx0JycsXG5cdFx0XHRTbmlwcGV0U291cmNlLlVzZXIsXG5cdFx0XHRnZW5lcmF0ZVV1aWQoKVxuXHRcdCksIG5ldyBTbmlwcGV0KFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRbJ2Zvb0xhbmcnXSxcblx0XHRcdCdiYXp6VGVzdCcsXG5cdFx0XHQnYmF6eicsXG5cdFx0XHQnJyxcblx0XHRcdCdiYXp6Q29kZVNuaXBwZXQnLFxuXHRcdFx0JycsXG5cdFx0XHRTbmlwcGV0U291cmNlLlVzZXIsXG5cdFx0XHRnZW5lcmF0ZVV1aWQoKVxuXHRcdCldKTtcblx0fSk7XG5cblx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0YXN5bmMgZnVuY3Rpb24gYXNDb21wbGV0aW9uTW9kZWwobW9kZWw6IElUZXh0TW9kZWwsIHBvc2l0aW9uOiBJUG9zaXRpb24sIHByb3ZpZGVyOiBTbmlwcGV0Q29tcGxldGlvblByb3ZpZGVyLCBjb250ZXh0OiBDb21wbGV0aW9uQ29udGV4dCA9IGRlZmF1bHRDb21wbGV0aW9uQ29udGV4dCkge1xuXG5cdFx0Y29uc3QgbGlzdCA9IGF3YWl0IHByb3ZpZGVyLnByb3ZpZGVDb21wbGV0aW9uSXRlbXMobW9kZWwsIFBvc2l0aW9uLmxpZnQocG9zaXRpb24pLCBjb250ZXh0KTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IG5ldyBDb21wbGV0aW9uTW9kZWwobGlzdC5zdWdnZXN0aW9ucy5tYXAocyA9PiB7XG5cdFx0XHRyZXR1cm4gbmV3IENvbXBsZXRpb25JdGVtKHBvc2l0aW9uLCBzLCBsaXN0LCBwcm92aWRlcik7XG5cdFx0fSksXG5cdFx0XHRwb3NpdGlvbi5jb2x1bW4sXG5cdFx0XHR7IGNoYXJhY3RlckNvdW50RGVsdGE6IDAsIGxlYWRpbmdMaW5lQ29udGVudDogbW9kZWwuZ2V0TGluZUNvbnRlbnQocG9zaXRpb24ubGluZU51bWJlcikuc3Vic3RyaW5nKDAsIHBvc2l0aW9uLmNvbHVtbiAtIDEpIH0sXG5cdFx0XHRXb3JkRGlzdGFuY2UuTm9uZSwgRWRpdG9yT3B0aW9ucy5zdWdnZXN0LmRlZmF1bHRWYWx1ZSwgRWRpdG9yT3B0aW9ucy5zbmlwcGV0U3VnZ2VzdGlvbnMuZGVmYXVsdFZhbHVlLCB1bmRlZmluZWRcblx0XHQpO1xuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHRlc3QoJ3NuaXBwZXQgY29tcGxldGlvbnMgLSBzaW1wbGUnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBwcm92aWRlciA9IG5ldyBTbmlwcGV0Q29tcGxldGlvblByb3ZpZGVyKGxhbmd1YWdlU2VydmljZSwgc25pcHBldFNlcnZpY2UsIGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdExhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UoKSkpO1xuXHRcdGNvbnN0IG1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRlVGV4dE1vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlLCAnJywgJ2Zvb0xhbmcnKSk7XG5cblx0XHRhd2FpdCBwcm92aWRlci5wcm92aWRlQ29tcGxldGlvbkl0ZW1zKG1vZGVsLCBuZXcgUG9zaXRpb24oMSwgMSksIGRlZmF1bHRDb21wbGV0aW9uQ29udGV4dCkhLnRoZW4ocmVzdWx0ID0+IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuaW5jb21wbGV0ZSwgdW5kZWZpbmVkKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuc3VnZ2VzdGlvbnMubGVuZ3RoLCAyKTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IGNvbXBsZXRpb25zID0gYXdhaXQgYXNDb21wbGV0aW9uTW9kZWwobW9kZWwsIG5ldyBQb3NpdGlvbigxLCAxKSwgcHJvdmlkZXIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb21wbGV0aW9ucy5pdGVtcy5sZW5ndGgsIDIpO1xuXHR9KTtcblxuXHR0ZXN0KCdzbmlwcGV0IGNvbXBsZXRpb25zIC0gc2ltcGxlIDInLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBwcm92aWRlciA9IG5ldyBTbmlwcGV0Q29tcGxldGlvblByb3ZpZGVyKGxhbmd1YWdlU2VydmljZSwgc25pcHBldFNlcnZpY2UsIGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdExhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UoKSkpO1xuXHRcdGNvbnN0IG1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRlVGV4dE1vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlLCAnaGVsbG8gJywgJ2Zvb0xhbmcnKSk7XG5cblx0XHRhd2FpdCBwcm92aWRlci5wcm92aWRlQ29tcGxldGlvbkl0ZW1zKG1vZGVsLCBuZXcgUG9zaXRpb24oMSwgNikgLyogaGVsbG98ICovLCBkZWZhdWx0Q29tcGxldGlvbkNvbnRleHQpIS50aGVuKHJlc3VsdCA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LmluY29tcGxldGUsIHVuZGVmaW5lZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LnN1Z2dlc3Rpb25zLmxlbmd0aCwgMCk7XG5cdFx0fSk7XG5cblx0XHRhd2FpdCBwcm92aWRlci5wcm92aWRlQ29tcGxldGlvbkl0ZW1zKG1vZGVsLCBuZXcgUG9zaXRpb24oMSwgNykgLyogaGVsbG8gfCovLCBkZWZhdWx0Q29tcGxldGlvbkNvbnRleHQpIS50aGVuKHJlc3VsdCA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LmluY29tcGxldGUsIHVuZGVmaW5lZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LnN1Z2dlc3Rpb25zLmxlbmd0aCwgMik7XG5cdFx0fSk7XG5cblx0XHRjb25zdCBjb21wbGV0aW9uczEgPSBhd2FpdCBhc0NvbXBsZXRpb25Nb2RlbChtb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDYpLyogaGVsbG98ICovLCBwcm92aWRlcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbXBsZXRpb25zMS5pdGVtcy5sZW5ndGgsIDApO1xuXG5cdFx0Y29uc3QgY29tcGxldGlvbnMyID0gYXdhaXQgYXNDb21wbGV0aW9uTW9kZWwobW9kZWwsIG5ldyBQb3NpdGlvbigxLCA3KS8qIGhlbGxvIHwqLywgcHJvdmlkZXIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb21wbGV0aW9uczIuaXRlbXMubGVuZ3RoLCAyKTtcblx0fSk7XG5cblx0dGVzdCgnc25pcHBldCBjb21wbGV0aW9ucyAtIHdpdGggcHJlZml4JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBuZXcgU25pcHBldENvbXBsZXRpb25Qcm92aWRlcihsYW5ndWFnZVNlcnZpY2UsIHNuaXBwZXRTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKCkpKTtcblx0XHRjb25zdCBtb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0ZVRleHRNb2RlbChpbnN0YW50aWF0aW9uU2VydmljZSwgJ2JhcicsICdmb29MYW5nJykpO1xuXG5cdFx0YXdhaXQgcHJvdmlkZXIucHJvdmlkZUNvbXBsZXRpb25JdGVtcyhtb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDQpLCBkZWZhdWx0Q29tcGxldGlvbkNvbnRleHQpIS50aGVuKHJlc3VsdCA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LmluY29tcGxldGUsIHVuZGVmaW5lZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LnN1Z2dlc3Rpb25zLmxlbmd0aCwgMSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc3VsdC5zdWdnZXN0aW9uc1swXS5sYWJlbCwge1xuXHRcdFx0XHRsYWJlbDogJ2JhcicsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiAnYmFyVGVzdCdcblx0XHRcdH0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChyZXN1bHQuc3VnZ2VzdGlvbnNbMF0ucmFuZ2UgYXMgYW55KS5pbnNlcnQuc3RhcnRDb2x1bW4sIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5zdWdnZXN0aW9uc1swXS5pbnNlcnRUZXh0LCAnYmFyQ29kZVNuaXBwZXQnKTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IGNvbXBsZXRpb25zID0gYXdhaXQgYXNDb21wbGV0aW9uTW9kZWwobW9kZWwsIG5ldyBQb3NpdGlvbigxLCA0KSwgcHJvdmlkZXIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb21wbGV0aW9ucy5pdGVtcy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY29tcGxldGlvbnMuaXRlbXNbMF0uY29tcGxldGlvbi5sYWJlbCwge1xuXHRcdFx0bGFiZWw6ICdiYXInLFxuXHRcdFx0ZGVzY3JpcHRpb246ICdiYXJUZXN0J1xuXHRcdH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoY29tcGxldGlvbnMuaXRlbXNbMF0uY29tcGxldGlvbi5yYW5nZSBhcyBhbnkpLmluc2VydC5zdGFydENvbHVtbiwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbXBsZXRpb25zLml0ZW1zWzBdLmNvbXBsZXRpb24uaW5zZXJ0VGV4dCwgJ2JhckNvZGVTbmlwcGV0Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NuaXBwZXQgY29tcGxldGlvbnMgLSB3aXRoIGRpZmZlcmVudCBwcmVmaXhlcycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRzbmlwcGV0U2VydmljZSA9IG5ldyBTaW1wbGVTbmlwcGV0U2VydmljZShbbmV3IFNuaXBwZXQoXG5cdFx0XHRmYWxzZSxcblx0XHRcdFsnZm9vTGFuZyddLFxuXHRcdFx0J2JhclRlc3QnLFxuXHRcdFx0J2JhcicsXG5cdFx0XHQnJyxcblx0XHRcdCdzMScsXG5cdFx0XHQnJyxcblx0XHRcdFNuaXBwZXRTb3VyY2UuVXNlcixcblx0XHRcdGdlbmVyYXRlVXVpZCgpXG5cdFx0KSwgbmV3IFNuaXBwZXQoXG5cdFx0XHRmYWxzZSxcblx0XHRcdFsnZm9vTGFuZyddLFxuXHRcdFx0J25hbWUnLFxuXHRcdFx0J2Jhci1iYXInLFxuXHRcdFx0JycsXG5cdFx0XHQnczInLFxuXHRcdFx0JycsXG5cdFx0XHRTbmlwcGV0U291cmNlLlVzZXIsXG5cdFx0XHRnZW5lcmF0ZVV1aWQoKVxuXHRcdCldKTtcblxuXHRcdGNvbnN0IHByb3ZpZGVyID0gbmV3IFNuaXBwZXRDb21wbGV0aW9uUHJvdmlkZXIobGFuZ3VhZ2VTZXJ2aWNlLCBzbmlwcGV0U2VydmljZSwgZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0TGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSgpKSk7XG5cdFx0Y29uc3QgbW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGVUZXh0TW9kZWwoaW5zdGFudGlhdGlvblNlcnZpY2UsICdiYXItYmFyJywgJ2Zvb0xhbmcnKSk7XG5cblx0XHR7XG5cdFx0XHRhd2FpdCBwcm92aWRlci5wcm92aWRlQ29tcGxldGlvbkl0ZW1zKG1vZGVsLCBuZXcgUG9zaXRpb24oMSwgMyksIGRlZmF1bHRDb21wbGV0aW9uQ29udGV4dCkhLnRoZW4ocmVzdWx0ID0+IHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5pbmNvbXBsZXRlLCB1bmRlZmluZWQpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LnN1Z2dlc3Rpb25zLmxlbmd0aCwgMik7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0LnN1Z2dlc3Rpb25zWzBdLmxhYmVsLCB7XG5cdFx0XHRcdFx0bGFiZWw6ICdiYXInLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiAnYmFyVGVzdCdcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuc3VnZ2VzdGlvbnNbMF0uaW5zZXJ0VGV4dCwgJ3MxJyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgocmVzdWx0LnN1Z2dlc3Rpb25zWzBdLnJhbmdlIGFzIENvbXBsZXRpb25JdGVtUmFuZ2VzKS5pbnNlcnQuc3RhcnRDb2x1bW4sIDEpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc3VsdC5zdWdnZXN0aW9uc1sxXS5sYWJlbCwge1xuXHRcdFx0XHRcdGxhYmVsOiAnYmFyLWJhcicsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246ICduYW1lJ1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5zdWdnZXN0aW9uc1sxXS5pbnNlcnRUZXh0LCAnczInKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChyZXN1bHQuc3VnZ2VzdGlvbnNbMV0ucmFuZ2UgYXMgQ29tcGxldGlvbkl0ZW1SYW5nZXMpLmluc2VydC5zdGFydENvbHVtbiwgMSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgY29tcGxldGlvbnMgPSBhd2FpdCBhc0NvbXBsZXRpb25Nb2RlbChtb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDMpLCBwcm92aWRlcik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29tcGxldGlvbnMuaXRlbXMubGVuZ3RoLCAyKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY29tcGxldGlvbnMuaXRlbXNbMF0uY29tcGxldGlvbi5sYWJlbCwge1xuXHRcdFx0XHRsYWJlbDogJ2JhcicsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiAnYmFyVGVzdCdcblx0XHRcdH0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbXBsZXRpb25zLml0ZW1zWzBdLmNvbXBsZXRpb24uaW5zZXJ0VGV4dCwgJ3MxJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGNvbXBsZXRpb25zLml0ZW1zWzBdLmNvbXBsZXRpb24ucmFuZ2UgYXMgQ29tcGxldGlvbkl0ZW1SYW5nZXMpLmluc2VydC5zdGFydENvbHVtbiwgMSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNvbXBsZXRpb25zLml0ZW1zWzFdLmNvbXBsZXRpb24ubGFiZWwsIHtcblx0XHRcdFx0bGFiZWw6ICdiYXItYmFyJyxcblx0XHRcdFx0ZGVzY3JpcHRpb246ICduYW1lJ1xuXHRcdFx0fSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29tcGxldGlvbnMuaXRlbXNbMV0uY29tcGxldGlvbi5pbnNlcnRUZXh0LCAnczInKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoY29tcGxldGlvbnMuaXRlbXNbMV0uY29tcGxldGlvbi5yYW5nZSBhcyBDb21wbGV0aW9uSXRlbVJhbmdlcykuaW5zZXJ0LnN0YXJ0Q29sdW1uLCAxKTtcblx0XHR9XG5cblx0XHR7XG5cdFx0XHRhd2FpdCBwcm92aWRlci5wcm92aWRlQ29tcGxldGlvbkl0ZW1zKG1vZGVsLCBuZXcgUG9zaXRpb24oMSwgNSksIGRlZmF1bHRDb21wbGV0aW9uQ29udGV4dCkhLnRoZW4ocmVzdWx0ID0+IHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5pbmNvbXBsZXRlLCB1bmRlZmluZWQpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LnN1Z2dlc3Rpb25zLmxlbmd0aCwgMik7XG5cblx0XHRcdFx0Y29uc3QgW2ZpcnN0LCBzZWNvbmRdID0gcmVzdWx0LnN1Z2dlc3Rpb25zO1xuXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmlyc3QubGFiZWwsIHtcblx0XHRcdFx0XHRsYWJlbDogJ2JhcicsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246ICdiYXJUZXN0J1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0Lmluc2VydFRleHQsICdzMScpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGZpcnN0LnJhbmdlIGFzIENvbXBsZXRpb25JdGVtUmFuZ2VzKS5pbnNlcnQuc3RhcnRDb2x1bW4sIDUpO1xuXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2Vjb25kLmxhYmVsLCB7XG5cdFx0XHRcdFx0bGFiZWw6ICdiYXItYmFyJyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogJ25hbWUnXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vjb25kLmluc2VydFRleHQsICdzMicpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKHNlY29uZC5yYW5nZSBhcyBDb21wbGV0aW9uSXRlbVJhbmdlcykuaW5zZXJ0LnN0YXJ0Q29sdW1uLCAxKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRjb25zdCBjb21wbGV0aW9ucyA9IGF3YWl0IGFzQ29tcGxldGlvbk1vZGVsKG1vZGVsLCBuZXcgUG9zaXRpb24oMSwgNSksIHByb3ZpZGVyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb21wbGV0aW9ucy5pdGVtcy5sZW5ndGgsIDIpO1xuXG5cdFx0XHRjb25zdCBbZmlyc3QsIHNlY29uZF0gPSBjb21wbGV0aW9ucy5pdGVtcy5tYXAoaSA9PiBpLmNvbXBsZXRpb24pO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpcnN0LmxhYmVsLCB7XG5cdFx0XHRcdGxhYmVsOiAnYmFyLWJhcicsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiAnbmFtZSdcblx0XHRcdH0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0Lmluc2VydFRleHQsICdzMicpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChmaXJzdC5yYW5nZSBhcyBDb21wbGV0aW9uSXRlbVJhbmdlcykuaW5zZXJ0LnN0YXJ0Q29sdW1uLCAxKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzZWNvbmQubGFiZWwsIHtcblx0XHRcdFx0bGFiZWw6ICdiYXInLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogJ2JhclRlc3QnXG5cdFx0XHR9KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZWNvbmQuaW5zZXJ0VGV4dCwgJ3MxJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKHNlY29uZC5yYW5nZSBhcyBDb21wbGV0aW9uSXRlbVJhbmdlcykuaW5zZXJ0LnN0YXJ0Q29sdW1uLCA1KTtcblx0XHR9XG5cblx0XHR7XG5cdFx0XHRhd2FpdCBwcm92aWRlci5wcm92aWRlQ29tcGxldGlvbkl0ZW1zKG1vZGVsLCBuZXcgUG9zaXRpb24oMSwgNiksIGRlZmF1bHRDb21wbGV0aW9uQ29udGV4dCkhLnRoZW4ocmVzdWx0ID0+IHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5pbmNvbXBsZXRlLCB1bmRlZmluZWQpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LnN1Z2dlc3Rpb25zLmxlbmd0aCwgMik7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0LnN1Z2dlc3Rpb25zWzBdLmxhYmVsLCB7XG5cdFx0XHRcdFx0bGFiZWw6ICdiYXInLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiAnYmFyVGVzdCdcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuc3VnZ2VzdGlvbnNbMF0uaW5zZXJ0VGV4dCwgJ3MxJyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgocmVzdWx0LnN1Z2dlc3Rpb25zWzBdLnJhbmdlIGFzIGFueSkuaW5zZXJ0LnN0YXJ0Q29sdW1uLCA1KTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHQuc3VnZ2VzdGlvbnNbMV0ubGFiZWwsIHtcblx0XHRcdFx0XHRsYWJlbDogJ2Jhci1iYXInLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiAnbmFtZSdcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuc3VnZ2VzdGlvbnNbMV0uaW5zZXJ0VGV4dCwgJ3MyJyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgocmVzdWx0LnN1Z2dlc3Rpb25zWzFdLnJhbmdlIGFzIGFueSkuaW5zZXJ0LnN0YXJ0Q29sdW1uLCAxKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRjb25zdCBjb21wbGV0aW9ucyA9IGF3YWl0IGFzQ29tcGxldGlvbk1vZGVsKG1vZGVsLCBuZXcgUG9zaXRpb24oMSwgNiksIHByb3ZpZGVyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb21wbGV0aW9ucy5pdGVtcy5sZW5ndGgsIDIpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjb21wbGV0aW9ucy5pdGVtc1swXS5jb21wbGV0aW9uLmxhYmVsLCB7XG5cdFx0XHRcdGxhYmVsOiAnYmFyLWJhcicsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiAnbmFtZSdcblx0XHRcdH0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbXBsZXRpb25zLml0ZW1zWzBdLmNvbXBsZXRpb24uaW5zZXJ0VGV4dCwgJ3MyJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGNvbXBsZXRpb25zLml0ZW1zWzBdLmNvbXBsZXRpb24ucmFuZ2UgYXMgYW55KS5pbnNlcnQuc3RhcnRDb2x1bW4sIDEpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjb21wbGV0aW9ucy5pdGVtc1sxXS5jb21wbGV0aW9uLmxhYmVsLCB7XG5cdFx0XHRcdGxhYmVsOiAnYmFyJyxcblx0XHRcdFx0ZGVzY3JpcHRpb246ICdiYXJUZXN0J1xuXHRcdFx0fSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29tcGxldGlvbnMuaXRlbXNbMV0uY29tcGxldGlvbi5pbnNlcnRUZXh0LCAnczEnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoY29tcGxldGlvbnMuaXRlbXNbMV0uY29tcGxldGlvbi5yYW5nZSBhcyBhbnkpLmluc2VydC5zdGFydENvbHVtbiwgNSk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdDYW5ub3QgdXNlIFwiPD9waHBcIiBhcyB1c2VyIHNuaXBwZXQgcHJlZml4IGFueW1vcmUsICMyNjI3NScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRzbmlwcGV0U2VydmljZSA9IG5ldyBTaW1wbGVTbmlwcGV0U2VydmljZShbbmV3IFNuaXBwZXQoXG5cdFx0XHRmYWxzZSxcblx0XHRcdFsnZm9vTGFuZyddLFxuXHRcdFx0JycsXG5cdFx0XHQnPD9waHAnLFxuXHRcdFx0JycsXG5cdFx0XHQnaW5zZXJ0IG1lJyxcblx0XHRcdCcnLFxuXHRcdFx0U25pcHBldFNvdXJjZS5Vc2VyLFxuXHRcdFx0Z2VuZXJhdGVVdWlkKClcblx0XHQpXSk7XG5cblx0XHRjb25zdCBwcm92aWRlciA9IG5ldyBTbmlwcGV0Q29tcGxldGlvblByb3ZpZGVyKGxhbmd1YWdlU2VydmljZSwgc25pcHBldFNlcnZpY2UsIGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdExhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UoKSkpO1xuXG5cdFx0bGV0IG1vZGVsID0gaW5zdGFudGlhdGVUZXh0TW9kZWwoaW5zdGFudGlhdGlvblNlcnZpY2UsICdcXHQ8P3BocCcsICdmb29MYW5nJyk7XG5cdFx0YXdhaXQgcHJvdmlkZXIucHJvdmlkZUNvbXBsZXRpb25JdGVtcyhtb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDcpLCBkZWZhdWx0Q29tcGxldGlvbkNvbnRleHQpIS50aGVuKHJlc3VsdCA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LnN1Z2dlc3Rpb25zLmxlbmd0aCwgMSk7XG5cdFx0fSk7XG5cdFx0Y29uc3QgY29tcGxldGlvbnMxID0gYXdhaXQgYXNDb21wbGV0aW9uTW9kZWwobW9kZWwsIG5ldyBQb3NpdGlvbigxLCA3KSwgcHJvdmlkZXIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb21wbGV0aW9uczEuaXRlbXMubGVuZ3RoLCAxKTtcblxuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0XHRtb2RlbCA9IGluc3RhbnRpYXRlVGV4dE1vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlLCAnXFx0PD8nLCAnZm9vTGFuZycpO1xuXHRcdGF3YWl0IHByb3ZpZGVyLnByb3ZpZGVDb21wbGV0aW9uSXRlbXMobW9kZWwsIG5ldyBQb3NpdGlvbigxLCA0KSwgZGVmYXVsdENvbXBsZXRpb25Db250ZXh0KS50aGVuKHJlc3VsdCA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LnN1Z2dlc3Rpb25zLmxlbmd0aCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKHJlc3VsdC5zdWdnZXN0aW9uc1swXS5yYW5nZSBhcyBhbnkpLmluc2VydC5zdGFydENvbHVtbiwgMik7XG5cdFx0fSk7XG5cdFx0Y29uc3QgY29tcGxldGlvbnMyID0gYXdhaXQgYXNDb21wbGV0aW9uTW9kZWwobW9kZWwsIG5ldyBQb3NpdGlvbigxLCA0KSwgcHJvdmlkZXIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb21wbGV0aW9uczIuaXRlbXMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGNvbXBsZXRpb25zMi5pdGVtc1swXS5jb21wbGV0aW9uLnJhbmdlIGFzIGFueSkuaW5zZXJ0LnN0YXJ0Q29sdW1uLCAyKTtcblxuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0XHRtb2RlbCA9IGluc3RhbnRpYXRlVGV4dE1vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlLCAnYTw/JywgJ2Zvb0xhbmcnKTtcblx0XHRhd2FpdCBwcm92aWRlci5wcm92aWRlQ29tcGxldGlvbkl0ZW1zKG1vZGVsLCBuZXcgUG9zaXRpb24oMSwgNCksIGRlZmF1bHRDb21wbGV0aW9uQ29udGV4dCkhLnRoZW4ocmVzdWx0ID0+IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuc3VnZ2VzdGlvbnMubGVuZ3RoLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgocmVzdWx0LnN1Z2dlc3Rpb25zWzBdLnJhbmdlIGFzIGFueSkuaW5zZXJ0LnN0YXJ0Q29sdW1uLCAyKTtcblx0XHR9KTtcblx0XHRjb25zdCBjb21wbGV0aW9uczMgPSBhd2FpdCBhc0NvbXBsZXRpb25Nb2RlbChtb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDQpLCBwcm92aWRlcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbXBsZXRpb25zMy5pdGVtcy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoY29tcGxldGlvbnMzLml0ZW1zWzBdLmNvbXBsZXRpb24ucmFuZ2UgYXMgYW55KS5pbnNlcnQuc3RhcnRDb2x1bW4sIDIpO1xuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnTm8gdXNlciBzbmlwcGV0cyBpbiBzdWdnZXN0aW9ucywgd2hlbiBpbnNpZGUgdGhlIGNvZGUsICMzMDUwOCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdHNuaXBwZXRTZXJ2aWNlID0gbmV3IFNpbXBsZVNuaXBwZXRTZXJ2aWNlKFtuZXcgU25pcHBldChcblx0XHRcdGZhbHNlLFxuXHRcdFx0Wydmb29MYW5nJ10sXG5cdFx0XHQnJyxcblx0XHRcdCdmb28nLFxuXHRcdFx0JycsXG5cdFx0XHQnPGZvbz4kMDwvZm9vPicsXG5cdFx0XHQnJyxcblx0XHRcdFNuaXBwZXRTb3VyY2UuVXNlcixcblx0XHRcdGdlbmVyYXRlVXVpZCgpXG5cdFx0KV0pO1xuXG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBuZXcgU25pcHBldENvbXBsZXRpb25Qcm92aWRlcihsYW5ndWFnZVNlcnZpY2UsIHNuaXBwZXRTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKCkpKTtcblxuXHRcdGNvbnN0IG1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRlVGV4dE1vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlLCAnPGhlYWQ+XFxuXFx0XFxuPi9oZWFkPicsICdmb29MYW5nJykpO1xuXHRcdGF3YWl0IHByb3ZpZGVyLnByb3ZpZGVDb21wbGV0aW9uSXRlbXMobW9kZWwsIG5ldyBQb3NpdGlvbigxLCAxKSwgZGVmYXVsdENvbXBsZXRpb25Db250ZXh0KSEudGhlbihyZXN1bHQgPT4ge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5zdWdnZXN0aW9ucy5sZW5ndGgsIDEpO1xuXHRcdH0pO1xuXHRcdGNvbnN0IGNvbXBsZXRpb25zID0gYXdhaXQgYXNDb21wbGV0aW9uTW9kZWwobW9kZWwsIG5ldyBQb3NpdGlvbigxLCAxKSwgcHJvdmlkZXIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb21wbGV0aW9ucy5pdGVtcy5sZW5ndGgsIDEpO1xuXG5cblx0XHRhd2FpdCBwcm92aWRlci5wcm92aWRlQ29tcGxldGlvbkl0ZW1zKG1vZGVsLCBuZXcgUG9zaXRpb24oMiwgMiksIGRlZmF1bHRDb21wbGV0aW9uQ29udGV4dCkudGhlbihyZXN1bHQgPT4ge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5zdWdnZXN0aW9ucy5sZW5ndGgsIDEpO1xuXHRcdH0pO1xuXHRcdGNvbnN0IGNvbXBsZXRpb25zMiA9IGF3YWl0IGFzQ29tcGxldGlvbk1vZGVsKG1vZGVsLCBuZXcgUG9zaXRpb24oMiwgMiksIHByb3ZpZGVyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29tcGxldGlvbnMyLml0ZW1zLmxlbmd0aCwgMSk7XG5cblx0fSk7XG5cblx0dGVzdCgnU25pcHBldFN1Z2dlc3QgLSBlbnN1cmUgZXh0ZW5zaW9uIHNuaXBwZXRzIGNvbWUgbGFzdCAnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0c25pcHBldFNlcnZpY2UgPSBuZXcgU2ltcGxlU25pcHBldFNlcnZpY2UoW25ldyBTbmlwcGV0KFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRbJ2Zvb0xhbmcnXSxcblx0XHRcdCdzZWNvbmQnLFxuXHRcdFx0J3NlY29uZCcsXG5cdFx0XHQnJyxcblx0XHRcdCdzZWNvbmQnLFxuXHRcdFx0JycsXG5cdFx0XHRTbmlwcGV0U291cmNlLkV4dGVuc2lvbixcblx0XHRcdGdlbmVyYXRlVXVpZCgpXG5cdFx0KSwgbmV3IFNuaXBwZXQoXG5cdFx0XHRmYWxzZSxcblx0XHRcdFsnZm9vTGFuZyddLFxuXHRcdFx0J2ZpcnN0Jyxcblx0XHRcdCdmaXJzdCcsXG5cdFx0XHQnJyxcblx0XHRcdCdmaXJzdCcsXG5cdFx0XHQnJyxcblx0XHRcdFNuaXBwZXRTb3VyY2UuVXNlcixcblx0XHRcdGdlbmVyYXRlVXVpZCgpXG5cdFx0KV0pO1xuXG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBuZXcgU25pcHBldENvbXBsZXRpb25Qcm92aWRlcihsYW5ndWFnZVNlcnZpY2UsIHNuaXBwZXRTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKCkpKTtcblxuXHRcdGNvbnN0IG1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRlVGV4dE1vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlLCAnJywgJ2Zvb0xhbmcnKSk7XG5cdFx0YXdhaXQgcHJvdmlkZXIucHJvdmlkZUNvbXBsZXRpb25JdGVtcyhtb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDEpLCBkZWZhdWx0Q29tcGxldGlvbkNvbnRleHQpIS50aGVuKHJlc3VsdCA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LnN1Z2dlc3Rpb25zLmxlbmd0aCwgMik7XG5cdFx0XHRjb25zdCBbZmlyc3QsIHNlY29uZF0gPSByZXN1bHQuc3VnZ2VzdGlvbnM7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpcnN0LmxhYmVsLCB7XG5cdFx0XHRcdGxhYmVsOiAnZmlyc3QnLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogJ2ZpcnN0J1xuXHRcdFx0fSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNlY29uZC5sYWJlbCwge1xuXHRcdFx0XHRsYWJlbDogJ3NlY29uZCcsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiAnc2Vjb25kJ1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHRjb25zdCBjb21wbGV0aW9ucyA9IGF3YWl0IGFzQ29tcGxldGlvbk1vZGVsKG1vZGVsLCBuZXcgUG9zaXRpb24oMSwgMSksIHByb3ZpZGVyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29tcGxldGlvbnMuaXRlbXMubGVuZ3RoLCAyKTtcblx0XHRjb25zdCBbZmlyc3QsIHNlY29uZF0gPSBjb21wbGV0aW9ucy5pdGVtcztcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpcnN0LmNvbXBsZXRpb24ubGFiZWwsIHtcblx0XHRcdGxhYmVsOiAnZmlyc3QnLFxuXHRcdFx0ZGVzY3JpcHRpb246ICdmaXJzdCdcblx0XHR9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNlY29uZC5jb21wbGV0aW9uLmxhYmVsLCB7XG5cdFx0XHRsYWJlbDogJ3NlY29uZCcsXG5cdFx0XHRkZXNjcmlwdGlvbjogJ3NlY29uZCdcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRGFzaCBpbiBzbmlwcGV0cyBwcmVmaXggYnJva2VuICM1Mzk0NScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRzbmlwcGV0U2VydmljZSA9IG5ldyBTaW1wbGVTbmlwcGV0U2VydmljZShbbmV3IFNuaXBwZXQoXG5cdFx0XHRmYWxzZSxcblx0XHRcdFsnZm9vTGFuZyddLFxuXHRcdFx0J3AtYScsXG5cdFx0XHQncC1hJyxcblx0XHRcdCcnLFxuXHRcdFx0J3NlY29uZCcsXG5cdFx0XHQnJyxcblx0XHRcdFNuaXBwZXRTb3VyY2UuVXNlcixcblx0XHRcdGdlbmVyYXRlVXVpZCgpXG5cdFx0KV0pO1xuXHRcdGNvbnN0IHByb3ZpZGVyID0gbmV3IFNuaXBwZXRDb21wbGV0aW9uUHJvdmlkZXIobGFuZ3VhZ2VTZXJ2aWNlLCBzbmlwcGV0U2VydmljZSwgZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0TGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSgpKSk7XG5cblx0XHRjb25zdCBtb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0ZVRleHRNb2RlbChpbnN0YW50aWF0aW9uU2VydmljZSwgJ3AtJywgJ2Zvb0xhbmcnKSk7XG5cblx0XHRsZXQgcmVzdWx0ID0gYXdhaXQgcHJvdmlkZXIucHJvdmlkZUNvbXBsZXRpb25JdGVtcyhtb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDIpLCBkZWZhdWx0Q29tcGxldGlvbkNvbnRleHQpITtcblx0XHRsZXQgY29tcGxldGlvbnMgPSBhd2FpdCBhc0NvbXBsZXRpb25Nb2RlbChtb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDIpLCBwcm92aWRlcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5zdWdnZXN0aW9ucy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb21wbGV0aW9ucy5pdGVtcy5sZW5ndGgsIDEpO1xuXG5cdFx0cmVzdWx0ID0gYXdhaXQgcHJvdmlkZXIucHJvdmlkZUNvbXBsZXRpb25JdGVtcyhtb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDMpLCBkZWZhdWx0Q29tcGxldGlvbkNvbnRleHQpITtcblx0XHRjb21wbGV0aW9ucyA9IGF3YWl0IGFzQ29tcGxldGlvbk1vZGVsKG1vZGVsLCBuZXcgUG9zaXRpb24oMSwgMyksIHByb3ZpZGVyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LnN1Z2dlc3Rpb25zLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbXBsZXRpb25zLml0ZW1zLmxlbmd0aCwgMSk7XG5cblx0XHRyZXN1bHQgPSBhd2FpdCBwcm92aWRlci5wcm92aWRlQ29tcGxldGlvbkl0ZW1zKG1vZGVsLCBuZXcgUG9zaXRpb24oMSwgMyksIGRlZmF1bHRDb21wbGV0aW9uQ29udGV4dCkhO1xuXHRcdGNvbXBsZXRpb25zID0gYXdhaXQgYXNDb21wbGV0aW9uTW9kZWwobW9kZWwsIG5ldyBQb3NpdGlvbigxLCAzKSwgcHJvdmlkZXIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuc3VnZ2VzdGlvbnMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29tcGxldGlvbnMuaXRlbXMubGVuZ3RoLCAxKTtcblx0fSk7XG5cblx0dGVzdCgnTm8gc25pcHBldHMgc3VnZ2VzdGlvbiBvbiBsb25nIGxpbmVzIGJleW9uZCBjaGFyYWN0ZXIgMTAwICM1ODgwNycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRzbmlwcGV0U2VydmljZSA9IG5ldyBTaW1wbGVTbmlwcGV0U2VydmljZShbbmV3IFNuaXBwZXQoXG5cdFx0XHRmYWxzZSxcblx0XHRcdFsnZm9vTGFuZyddLFxuXHRcdFx0J2J1ZycsXG5cdFx0XHQnYnVnJyxcblx0XHRcdCcnLFxuXHRcdFx0J3NlY29uZCcsXG5cdFx0XHQnJyxcblx0XHRcdFNuaXBwZXRTb3VyY2UuVXNlcixcblx0XHRcdGdlbmVyYXRlVXVpZCgpXG5cdFx0KV0pO1xuXG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBuZXcgU25pcHBldENvbXBsZXRpb25Qcm92aWRlcihsYW5ndWFnZVNlcnZpY2UsIHNuaXBwZXRTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKCkpKTtcblxuXHRcdGNvbnN0IG1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRlVGV4dE1vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlLCAnVGhpc2lzYXZlcnlsb25nbGluZWdvaW5nd2l0aG1vcmUxMDBiY2hhcmFjdGVyc2FuZHRoaXNtYWtlc2ludGVsbGlzZW5zZWJlY29tZWEgVGhpc2lzYXZlcnlsb25nbGluZWdvaW5nd2l0aG1vcmUxMDBiY2hhcmFjdGVyc2FuZHRoaXNtYWtlc2ludGVsbGlzZW5zZWJlY29tZWEgYicsICdmb29MYW5nJykpO1xuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByb3ZpZGVyLnByb3ZpZGVDb21wbGV0aW9uSXRlbXMobW9kZWwsIG5ldyBQb3NpdGlvbigxLCAxNTgpLCBkZWZhdWx0Q29tcGxldGlvbkNvbnRleHQpITtcblx0XHRjb25zdCBjb21wbGV0aW9ucyA9IGF3YWl0IGFzQ29tcGxldGlvbk1vZGVsKG1vZGVsLCBuZXcgUG9zaXRpb24oMSwgMTU4KSwgcHJvdmlkZXIpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5zdWdnZXN0aW9ucy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb21wbGV0aW9ucy5pdGVtcy5sZW5ndGgsIDEpO1xuXHR9KTtcblxuXHR0ZXN0KCdUeXBlIGNvbG9uIHdpbGwgdHJpZ2dlciBzbmlwcGV0ICM2MDc0NicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRzbmlwcGV0U2VydmljZSA9IG5ldyBTaW1wbGVTbmlwcGV0U2VydmljZShbbmV3IFNuaXBwZXQoXG5cdFx0XHRmYWxzZSxcblx0XHRcdFsnZm9vTGFuZyddLFxuXHRcdFx0J2J1ZycsXG5cdFx0XHQnYnVnJyxcblx0XHRcdCcnLFxuXHRcdFx0J3NlY29uZCcsXG5cdFx0XHQnJyxcblx0XHRcdFNuaXBwZXRTb3VyY2UuVXNlcixcblx0XHRcdGdlbmVyYXRlVXVpZCgpXG5cdFx0KV0pO1xuXG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBuZXcgU25pcHBldENvbXBsZXRpb25Qcm92aWRlcihsYW5ndWFnZVNlcnZpY2UsIHNuaXBwZXRTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKCkpKTtcblxuXHRcdGNvbnN0IG1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRlVGV4dE1vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlLCAnOicsICdmb29MYW5nJykpO1xuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByb3ZpZGVyLnByb3ZpZGVDb21wbGV0aW9uSXRlbXMobW9kZWwsIG5ldyBQb3NpdGlvbigxLCAyKSwgZGVmYXVsdENvbXBsZXRpb25Db250ZXh0KSE7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5zdWdnZXN0aW9ucy5sZW5ndGgsIDApO1xuXG5cdFx0Y29uc3QgY29tcGxldGlvbnMgPSBhd2FpdCBhc0NvbXBsZXRpb25Nb2RlbChtb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDIpLCBwcm92aWRlcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbXBsZXRpb25zLml0ZW1zLmxlbmd0aCwgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3N1YnN0cmluZyBvZiBwcmVmaXggY2FuXFwndCB0cmlnZ2VyIHNuaXBwZXQgIzYwNzM3JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdHNuaXBwZXRTZXJ2aWNlID0gbmV3IFNpbXBsZVNuaXBwZXRTZXJ2aWNlKFtuZXcgU25pcHBldChcblx0XHRcdGZhbHNlLFxuXHRcdFx0Wydmb29MYW5nJ10sXG5cdFx0XHQnbXl0ZW1wbGF0ZScsXG5cdFx0XHQnbXl0ZW1wbGF0ZScsXG5cdFx0XHQnJyxcblx0XHRcdCdzZWNvbmQnLFxuXHRcdFx0JycsXG5cdFx0XHRTbmlwcGV0U291cmNlLlVzZXIsXG5cdFx0XHRnZW5lcmF0ZVV1aWQoKVxuXHRcdCldKTtcblxuXHRcdGNvbnN0IHByb3ZpZGVyID0gbmV3IFNuaXBwZXRDb21wbGV0aW9uUHJvdmlkZXIobGFuZ3VhZ2VTZXJ2aWNlLCBzbmlwcGV0U2VydmljZSwgZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0TGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSgpKSk7XG5cblx0XHRjb25zdCBtb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0ZVRleHRNb2RlbChpbnN0YW50aWF0aW9uU2VydmljZSwgJ3RlbXBsYXRlJywgJ2Zvb0xhbmcnKSk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgcHJvdmlkZXIucHJvdmlkZUNvbXBsZXRpb25JdGVtcyhtb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDkpLCBkZWZhdWx0Q29tcGxldGlvbkNvbnRleHQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5zdWdnZXN0aW9ucy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0LnN1Z2dlc3Rpb25zWzBdLmxhYmVsLCB7XG5cdFx0XHRsYWJlbDogJ215dGVtcGxhdGUnLFxuXHRcdFx0ZGVzY3JpcHRpb246ICdteXRlbXBsYXRlJ1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgY29tcGxldGlvbnMgPSBhd2FpdCBhc0NvbXBsZXRpb25Nb2RlbChtb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDkpLCBwcm92aWRlcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbXBsZXRpb25zLml0ZW1zLmxlbmd0aCwgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ05vIHNuaXBwZXRzIHN1Z2dlc3Rpb24gYmV5b25kIGNoYXJhY3RlciAxMDAgaWYgbm90IGF0IGVuZCBvZiBsaW5lICM2MDI0NycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRzbmlwcGV0U2VydmljZSA9IG5ldyBTaW1wbGVTbmlwcGV0U2VydmljZShbbmV3IFNuaXBwZXQoXG5cdFx0XHRmYWxzZSxcblx0XHRcdFsnZm9vTGFuZyddLFxuXHRcdFx0J2J1ZycsXG5cdFx0XHQnYnVnJyxcblx0XHRcdCcnLFxuXHRcdFx0J3NlY29uZCcsXG5cdFx0XHQnJyxcblx0XHRcdFNuaXBwZXRTb3VyY2UuVXNlcixcblx0XHRcdGdlbmVyYXRlVXVpZCgpXG5cdFx0KV0pO1xuXG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBuZXcgU25pcHBldENvbXBsZXRpb25Qcm92aWRlcihsYW5ndWFnZVNlcnZpY2UsIHNuaXBwZXRTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKCkpKTtcblxuXHRcdGNvbnN0IG1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRlVGV4dE1vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlLCAnVGhpc2lzYXZlcnlsb25nbGluZWdvaW5nd2l0aG1vcmUxMDBiY2hhcmFjdGVyc2FuZHRoaXNtYWtlc2ludGVsbGlzZW5zZWJlY29tZWEgVGhpc2lzYXZlcnlsb25nbGluZWdvaW5nd2l0aG1vcmUxMDBiY2hhcmFjdGVyc2FuZHRoaXNtYWtlc2ludGVsbGlzZW5zZWJlY29tZWEgYiB0ZXh0X2FmdGVyX2InLCAnZm9vTGFuZycpKTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByb3ZpZGVyLnByb3ZpZGVDb21wbGV0aW9uSXRlbXMobW9kZWwsIG5ldyBQb3NpdGlvbigxLCAxNTgpLCBkZWZhdWx0Q29tcGxldGlvbkNvbnRleHQpITtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LnN1Z2dlc3Rpb25zLmxlbmd0aCwgMSk7XG5cblx0XHRjb25zdCBjb21wbGV0aW9ucyA9IGF3YWl0IGFzQ29tcGxldGlvbk1vZGVsKG1vZGVsLCBuZXcgUG9zaXRpb24oMSwgMTU4KSwgcHJvdmlkZXIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb21wbGV0aW9ucy5pdGVtcy5sZW5ndGgsIDEpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjNjEyOTY6IFZTIGNvZGUgZnJlZXplcyB3aGVuIGVkaXRpbmcgQ1NTIGZpYGxlIHdpdGggZW1vamknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSA9IGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdExhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UoKSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UucmVnaXN0ZXIoJ2Zvb0xhbmcnLCB7XG5cdFx0XHR3b3JkUGF0dGVybjogLygjPy0/XFxkKlxcLlxcZFxcdyolPyl8KDo6P1tcXHctXSooPz1bXix7O10qWyx7XSkpfCgoW0AjLiFdKT9bXFx3XFwtP10rJT98W0AjIS5dKS9nXG5cdFx0fSkpO1xuXG5cdFx0c25pcHBldFNlcnZpY2UgPSBuZXcgU2ltcGxlU25pcHBldFNlcnZpY2UoW25ldyBTbmlwcGV0KFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRbJ2Zvb0xhbmcnXSxcblx0XHRcdCdidWcnLFxuXHRcdFx0Jy1hLWJ1ZycsXG5cdFx0XHQnJyxcblx0XHRcdCdzZWNvbmQnLFxuXHRcdFx0JycsXG5cdFx0XHRTbmlwcGV0U291cmNlLlVzZXIsXG5cdFx0XHRnZW5lcmF0ZVV1aWQoKVxuXHRcdCldKTtcblxuXHRcdGNvbnN0IHByb3ZpZGVyID0gbmV3IFNuaXBwZXRDb21wbGV0aW9uUHJvdmlkZXIobGFuZ3VhZ2VTZXJ2aWNlLCBzbmlwcGV0U2VydmljZSwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cblx0XHRjb25zdCBtb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0ZVRleHRNb2RlbChpbnN0YW50aWF0aW9uU2VydmljZSwgJy5cdUQ4M0RcdURDMzctYS1iJywgJ2Zvb0xhbmcnKSk7XG5cblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBwcm92aWRlci5wcm92aWRlQ29tcGxldGlvbkl0ZW1zKG1vZGVsLCBuZXcgUG9zaXRpb24oMSwgOCksIGRlZmF1bHRDb21wbGV0aW9uQ29udGV4dCkhO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuc3VnZ2VzdGlvbnMubGVuZ3RoLCAxKTtcblxuXHRcdGNvbnN0IGNvbXBsZXRpb25zID0gYXdhaXQgYXNDb21wbGV0aW9uTW9kZWwobW9kZWwsIG5ldyBQb3NpdGlvbigxLCA4KSwgcHJvdmlkZXIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb21wbGV0aW9ucy5pdGVtcy5sZW5ndGgsIDEpO1xuXHR9KTtcblxuXHR0ZXN0KCdObyBzbmlwcGV0cyBzaG93biB3aGVuIHRyaWdnZXJpbmcgY29tcGxldGlvbnMgYXQgd2hpdGVzcGFjZSBvbiBsaW5lIHRoYXQgYWxyZWFkeSBoYXMgdGV4dCAjNjIzMzUnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0c25pcHBldFNlcnZpY2UgPSBuZXcgU2ltcGxlU25pcHBldFNlcnZpY2UoW25ldyBTbmlwcGV0KFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRbJ2Zvb0xhbmcnXSxcblx0XHRcdCdidWcnLFxuXHRcdFx0J2J1ZycsXG5cdFx0XHQnJyxcblx0XHRcdCdzZWNvbmQnLFxuXHRcdFx0JycsXG5cdFx0XHRTbmlwcGV0U291cmNlLlVzZXIsXG5cdFx0XHRnZW5lcmF0ZVV1aWQoKVxuXHRcdCldKTtcblxuXHRcdGNvbnN0IHByb3ZpZGVyID0gbmV3IFNuaXBwZXRDb21wbGV0aW9uUHJvdmlkZXIobGFuZ3VhZ2VTZXJ2aWNlLCBzbmlwcGV0U2VydmljZSwgZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0TGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSgpKSk7XG5cblx0XHRjb25zdCBtb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0ZVRleHRNb2RlbChpbnN0YW50aWF0aW9uU2VydmljZSwgJ2EgJywgJ2Zvb0xhbmcnKSk7XG5cblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBwcm92aWRlci5wcm92aWRlQ29tcGxldGlvbkl0ZW1zKG1vZGVsLCBuZXcgUG9zaXRpb24oMSwgMyksIGRlZmF1bHRDb21wbGV0aW9uQ29udGV4dCkhO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuc3VnZ2VzdGlvbnMubGVuZ3RoLCAxKTtcblxuXHRcdGNvbnN0IGNvbXBsZXRpb25zID0gYXdhaXQgYXNDb21wbGV0aW9uTW9kZWwobW9kZWwsIG5ldyBQb3NpdGlvbigxLCAzKSwgcHJvdmlkZXIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb21wbGV0aW9ucy5pdGVtcy5sZW5ndGgsIDEpO1xuXHR9KTtcblxuXHR0ZXN0KCdTbmlwcGV0IHByZWZpeCB3aXRoIHNwZWNpYWwgY2hhcnMgYW5kIG51bWJlcnMgZG9lcyBub3Qgd29yayAjNjI5MDYnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0c25pcHBldFNlcnZpY2UgPSBuZXcgU2ltcGxlU25pcHBldFNlcnZpY2UoW25ldyBTbmlwcGV0KFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRbJ2Zvb0xhbmcnXSxcblx0XHRcdCdub2Jsb2Nrd2RlbGF5Jyxcblx0XHRcdCc8PCcsXG5cdFx0XHQnJyxcblx0XHRcdCc8PSAjZGx5XCInLFxuXHRcdFx0JycsXG5cdFx0XHRTbmlwcGV0U291cmNlLlVzZXIsXG5cdFx0XHRnZW5lcmF0ZVV1aWQoKVxuXHRcdCksIG5ldyBTbmlwcGV0KFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRbJ2Zvb0xhbmcnXSxcblx0XHRcdCdub2Jsb2Nrd2RlbGF5Jyxcblx0XHRcdCcxMScsXG5cdFx0XHQnJyxcblx0XHRcdCdlbGV2ZW4nLFxuXHRcdFx0JycsXG5cdFx0XHRTbmlwcGV0U291cmNlLlVzZXIsXG5cdFx0XHRnZW5lcmF0ZVV1aWQoKVxuXHRcdCldKTtcblxuXHRcdGNvbnN0IHByb3ZpZGVyID0gbmV3IFNuaXBwZXRDb21wbGV0aW9uUHJvdmlkZXIobGFuZ3VhZ2VTZXJ2aWNlLCBzbmlwcGV0U2VydmljZSwgZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0TGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSgpKSk7XG5cblx0XHRsZXQgbW9kZWwgPSBpbnN0YW50aWF0ZVRleHRNb2RlbChpbnN0YW50aWF0aW9uU2VydmljZSwgJyA8JywgJ2Zvb0xhbmcnKTtcblxuXHRcdGxldCByZXN1bHQgPSBhd2FpdCBwcm92aWRlci5wcm92aWRlQ29tcGxldGlvbkl0ZW1zKG1vZGVsLCBuZXcgUG9zaXRpb24oMSwgMyksIGRlZmF1bHRDb21wbGV0aW9uQ29udGV4dCkhO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuc3VnZ2VzdGlvbnMubGVuZ3RoLCAxKTtcblx0XHRsZXQgW2ZpcnN0XSA9IHJlc3VsdC5zdWdnZXN0aW9ucztcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGZpcnN0LnJhbmdlIGFzIGFueSkuaW5zZXJ0LnN0YXJ0Q29sdW1uLCAyKTtcblxuXHRcdGxldCBjb21wbGV0aW9ucyA9IGF3YWl0IGFzQ29tcGxldGlvbk1vZGVsKG1vZGVsLCBuZXcgUG9zaXRpb24oMSwgMyksIHByb3ZpZGVyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29tcGxldGlvbnMuaXRlbXMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29tcGxldGlvbnMuaXRlbXNbMF0uZWRpdFN0YXJ0LmNvbHVtbiwgMik7XG5cblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdFx0bW9kZWwgPSBpbnN0YW50aWF0ZVRleHRNb2RlbChpbnN0YW50aWF0aW9uU2VydmljZSwgJzEnLCAnZm9vTGFuZycpO1xuXHRcdHJlc3VsdCA9IGF3YWl0IHByb3ZpZGVyLnByb3ZpZGVDb21wbGV0aW9uSXRlbXMobW9kZWwsIG5ldyBQb3NpdGlvbigxLCAyKSwgZGVmYXVsdENvbXBsZXRpb25Db250ZXh0KSE7XG5cdFx0Y29tcGxldGlvbnMgPSBhd2FpdCBhc0NvbXBsZXRpb25Nb2RlbChtb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDIpLCBwcm92aWRlcik7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LnN1Z2dlc3Rpb25zLmxlbmd0aCwgMSk7XG5cdFx0W2ZpcnN0XSA9IHJlc3VsdC5zdWdnZXN0aW9ucztcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGZpcnN0LnJhbmdlIGFzIGFueSkuaW5zZXJ0LnN0YXJ0Q29sdW1uLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29tcGxldGlvbnMuaXRlbXMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29tcGxldGlvbnMuaXRlbXNbMF0uZWRpdFN0YXJ0LmNvbHVtbiwgMSk7XG5cblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1NuaXBwZXQgcmVwbGFjZSByYW5nZScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRzbmlwcGV0U2VydmljZSA9IG5ldyBTaW1wbGVTbmlwcGV0U2VydmljZShbbmV3IFNuaXBwZXQoXG5cdFx0XHRmYWxzZSxcblx0XHRcdFsnZm9vTGFuZyddLFxuXHRcdFx0J25vdFdvcmRUZXN0Jyxcblx0XHRcdCdub3Qgd29yZCcsXG5cdFx0XHQnJyxcblx0XHRcdCdub3Qgd29yZCBzbmlwcGV0Jyxcblx0XHRcdCcnLFxuXHRcdFx0U25pcHBldFNvdXJjZS5Vc2VyLFxuXHRcdFx0Z2VuZXJhdGVVdWlkKClcblx0XHQpXSk7XG5cblx0XHRjb25zdCBwcm92aWRlciA9IG5ldyBTbmlwcGV0Q29tcGxldGlvblByb3ZpZGVyKGxhbmd1YWdlU2VydmljZSwgc25pcHBldFNlcnZpY2UsIGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdExhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UoKSkpO1xuXG5cdFx0bGV0IG1vZGVsID0gaW5zdGFudGlhdGVUZXh0TW9kZWwoaW5zdGFudGlhdGlvblNlcnZpY2UsICdub3Qgd29yZEZvbyBiYXInLCAnZm9vTGFuZycpO1xuXG5cdFx0bGV0IHJlc3VsdCA9IGF3YWl0IHByb3ZpZGVyLnByb3ZpZGVDb21wbGV0aW9uSXRlbXMobW9kZWwsIG5ldyBQb3NpdGlvbigxLCAzKSwgZGVmYXVsdENvbXBsZXRpb25Db250ZXh0KSE7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5zdWdnZXN0aW9ucy5sZW5ndGgsIDEpO1xuXHRcdGxldCBbZmlyc3RdID0gcmVzdWx0LnN1Z2dlc3Rpb25zO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoZmlyc3QucmFuZ2UgYXMgYW55KS5pbnNlcnQuZW5kQ29sdW1uLCAzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGZpcnN0LnJhbmdlIGFzIGFueSkucmVwbGFjZS5lbmRDb2x1bW4sIDkpO1xuXG5cdFx0bGV0IGNvbXBsZXRpb25zID0gYXdhaXQgYXNDb21wbGV0aW9uTW9kZWwobW9kZWwsIG5ldyBQb3NpdGlvbigxLCAzKSwgcHJvdmlkZXIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb21wbGV0aW9ucy5pdGVtcy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb21wbGV0aW9ucy5pdGVtc1swXS5lZGl0SW5zZXJ0RW5kLmNvbHVtbiwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbXBsZXRpb25zLml0ZW1zWzBdLmVkaXRSZXBsYWNlRW5kLmNvbHVtbiwgOSk7XG5cblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdFx0bW9kZWwgPSBpbnN0YW50aWF0ZVRleHRNb2RlbChpbnN0YW50aWF0aW9uU2VydmljZSwgJ25vdCB3b0ZvbyBiYXInLCAnZm9vTGFuZycpO1xuXHRcdHJlc3VsdCA9IGF3YWl0IHByb3ZpZGVyLnByb3ZpZGVDb21wbGV0aW9uSXRlbXMobW9kZWwsIG5ldyBQb3NpdGlvbigxLCAzKSwgZGVmYXVsdENvbXBsZXRpb25Db250ZXh0KSE7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LnN1Z2dlc3Rpb25zLmxlbmd0aCwgMSk7XG5cdFx0W2ZpcnN0XSA9IHJlc3VsdC5zdWdnZXN0aW9ucztcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGZpcnN0LnJhbmdlIGFzIGFueSkuaW5zZXJ0LmVuZENvbHVtbiwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChmaXJzdC5yYW5nZSBhcyBhbnkpLnJlcGxhY2UuZW5kQ29sdW1uLCAzKTtcblxuXHRcdGNvbXBsZXRpb25zID0gYXdhaXQgYXNDb21wbGV0aW9uTW9kZWwobW9kZWwsIG5ldyBQb3NpdGlvbigxLCAzKSwgcHJvdmlkZXIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb21wbGV0aW9ucy5pdGVtcy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb21wbGV0aW9ucy5pdGVtc1swXS5lZGl0SW5zZXJ0RW5kLmNvbHVtbiwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbXBsZXRpb25zLml0ZW1zWzBdLmVkaXRSZXBsYWNlRW5kLmNvbHVtbiwgMyk7XG5cblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdFx0bW9kZWwgPSBpbnN0YW50aWF0ZVRleHRNb2RlbChpbnN0YW50aWF0aW9uU2VydmljZSwgJ25vdCB3b3JkJywgJ2Zvb0xhbmcnKTtcblx0XHRyZXN1bHQgPSBhd2FpdCBwcm92aWRlci5wcm92aWRlQ29tcGxldGlvbkl0ZW1zKG1vZGVsLCBuZXcgUG9zaXRpb24oMSwgMSksIGRlZmF1bHRDb21wbGV0aW9uQ29udGV4dCkhO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5zdWdnZXN0aW9ucy5sZW5ndGgsIDEpO1xuXHRcdFtmaXJzdF0gPSByZXN1bHQuc3VnZ2VzdGlvbnM7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChmaXJzdC5yYW5nZSBhcyBhbnkpLmluc2VydC5lbmRDb2x1bW4sIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoZmlyc3QucmFuZ2UgYXMgYW55KS5yZXBsYWNlLmVuZENvbHVtbiwgOSk7XG5cblx0XHRjb21wbGV0aW9ucyA9IGF3YWl0IGFzQ29tcGxldGlvbk1vZGVsKG1vZGVsLCBuZXcgUG9zaXRpb24oMSwgMSksIHByb3ZpZGVyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29tcGxldGlvbnMuaXRlbXMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29tcGxldGlvbnMuaXRlbXNbMF0uZWRpdEluc2VydEVuZC5jb2x1bW4sIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb21wbGV0aW9ucy5pdGVtc1swXS5lZGl0UmVwbGFjZUVuZC5jb2x1bW4sIDkpO1xuXG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdTbmlwcGV0IHJlcGxhY2UtcmFuZ2UgaW5jb3JyZWN0ICMxMDg4OTQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHRzbmlwcGV0U2VydmljZSA9IG5ldyBTaW1wbGVTbmlwcGV0U2VydmljZShbbmV3IFNuaXBwZXQoXG5cdFx0XHRmYWxzZSxcblx0XHRcdFsnZm9vTGFuZyddLFxuXHRcdFx0J2VuZycsXG5cdFx0XHQnZW5nJyxcblx0XHRcdCcnLFxuXHRcdFx0JzxzcGFuPjwvc3Bhbj4nLFxuXHRcdFx0JycsXG5cdFx0XHRTbmlwcGV0U291cmNlLlVzZXIsXG5cdFx0XHRnZW5lcmF0ZVV1aWQoKVxuXHRcdCldKTtcblxuXHRcdGNvbnN0IHByb3ZpZGVyID0gbmV3IFNuaXBwZXRDb21wbGV0aW9uUHJvdmlkZXIobGFuZ3VhZ2VTZXJ2aWNlLCBzbmlwcGV0U2VydmljZSwgZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0TGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSgpKSk7XG5cblx0XHRjb25zdCBtb2RlbCA9IGluc3RhbnRpYXRlVGV4dE1vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlLCAnZmlsbGVyIGUgS0VFUCBuZyBmaWxsZXInLCAnZm9vTGFuZycpO1xuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByb3ZpZGVyLnByb3ZpZGVDb21wbGV0aW9uSXRlbXMobW9kZWwsIG5ldyBQb3NpdGlvbigxLCA5KSwgZGVmYXVsdENvbXBsZXRpb25Db250ZXh0KSE7XG5cdFx0Y29uc3QgY29tcGxldGlvbnMgPSBhd2FpdCBhc0NvbXBsZXRpb25Nb2RlbChtb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDkpLCBwcm92aWRlcik7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LnN1Z2dlc3Rpb25zLmxlbmd0aCwgMSk7XG5cdFx0Y29uc3QgW2ZpcnN0XSA9IHJlc3VsdC5zdWdnZXN0aW9ucztcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGZpcnN0LnJhbmdlIGFzIGFueSkuaW5zZXJ0LmVuZENvbHVtbiwgOSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChmaXJzdC5yYW5nZSBhcyBhbnkpLnJlcGxhY2UuZW5kQ29sdW1uLCA5KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb21wbGV0aW9ucy5pdGVtcy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb21wbGV0aW9ucy5pdGVtc1swXS5lZGl0SW5zZXJ0RW5kLmNvbHVtbiwgOSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbXBsZXRpb25zLml0ZW1zWzBdLmVkaXRSZXBsYWNlRW5kLmNvbHVtbiwgOSk7XG5cblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1NuaXBwZXQgd2lsbCByZXBsYWNlIGF1dG8tY2xvc2luZyBwYWlyIGlmIHNwZWNpZmllZCBpbiBwcmVmaXgnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSA9IGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdExhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UoKSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UucmVnaXN0ZXIoJ2Zvb0xhbmcnLCB7XG5cdFx0XHRicmFja2V0czogW1xuXHRcdFx0XHRbJ3snLCAnfSddLFxuXHRcdFx0XHRbJ1snLCAnXSddLFxuXHRcdFx0XHRbJygnLCAnKSddLFxuXHRcdFx0XVxuXHRcdH0pKTtcblxuXHRcdHNuaXBwZXRTZXJ2aWNlID0gbmV3IFNpbXBsZVNuaXBwZXRTZXJ2aWNlKFtuZXcgU25pcHBldChcblx0XHRcdGZhbHNlLFxuXHRcdFx0Wydmb29MYW5nJ10sXG5cdFx0XHQnUFNDdXN0b21PYmplY3QnLFxuXHRcdFx0J1tQU0N1c3RvbU9iamVjdF0nLFxuXHRcdFx0JycsXG5cdFx0XHQnW1BTQ3VzdG9tT2JqZWN0XSBAeyBLZXkgPSBWYWx1ZSB9Jyxcblx0XHRcdCcnLFxuXHRcdFx0U25pcHBldFNvdXJjZS5Vc2VyLFxuXHRcdFx0Z2VuZXJhdGVVdWlkKClcblx0XHQpXSk7XG5cblx0XHRjb25zdCBwcm92aWRlciA9IG5ldyBTbmlwcGV0Q29tcGxldGlvblByb3ZpZGVyKGxhbmd1YWdlU2VydmljZSwgc25pcHBldFNlcnZpY2UsIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBpbnN0YW50aWF0ZVRleHRNb2RlbChpbnN0YW50aWF0aW9uU2VydmljZSwgJ1twc2NdJywgJ2Zvb0xhbmcnKTtcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBwcm92aWRlci5wcm92aWRlQ29tcGxldGlvbkl0ZW1zKG1vZGVsLCBuZXcgUG9zaXRpb24oMSwgNSksIGRlZmF1bHRDb21wbGV0aW9uQ29udGV4dCkhO1xuXHRcdGNvbnN0IGNvbXBsZXRpb25zID0gYXdhaXQgYXNDb21wbGV0aW9uTW9kZWwobW9kZWwsIG5ldyBQb3NpdGlvbigxLCA1KSwgcHJvdmlkZXIpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5zdWdnZXN0aW9ucy5sZW5ndGgsIDEpO1xuXHRcdGNvbnN0IFtmaXJzdF0gPSByZXN1bHQuc3VnZ2VzdGlvbnM7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChmaXJzdC5yYW5nZSBhcyBhbnkpLmluc2VydC5lbmRDb2x1bW4sIDUpO1xuXHRcdC8vIFRoaXMgaXMgNiBiZWNhdXNlIGl0IHNob3VsZCBlYXQgdGhlIGBdYCBhdCB0aGUgZW5kIG9mIHRoZSB0ZXh0IGV2ZW4gaWYgY3Vyc29yIGlzIGJlZm9yZSBpdFxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoZmlyc3QucmFuZ2UgYXMgYW55KS5yZXBsYWNlLmVuZENvbHVtbiwgNik7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29tcGxldGlvbnMuaXRlbXMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29tcGxldGlvbnMuaXRlbXNbMF0uZWRpdEluc2VydEVuZC5jb2x1bW4sIDUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb21wbGV0aW9ucy5pdGVtc1swXS5lZGl0UmVwbGFjZUVuZC5jb2x1bW4sIDYpO1xuXG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdMZWFkaW5nIHdoaXRlc3BhY2UgaW4gc25pcHBldCBwcmVmaXggIzEyMzg2MCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdHNuaXBwZXRTZXJ2aWNlID0gbmV3IFNpbXBsZVNuaXBwZXRTZXJ2aWNlKFtuZXcgU25pcHBldChcblx0XHRcdGZhbHNlLFxuXHRcdFx0Wydmb29MYW5nJ10sXG5cdFx0XHQnY2l0ZS1uYW1lJyxcblx0XHRcdCcgY2l0ZScsXG5cdFx0XHQnJyxcblx0XHRcdCd+XFxcXGNpdGV7JENMSVBCT0FSRH0nLFxuXHRcdFx0JycsXG5cdFx0XHRTbmlwcGV0U291cmNlLlVzZXIsXG5cdFx0XHRnZW5lcmF0ZVV1aWQoKVxuXHRcdCldKTtcblxuXHRcdGNvbnN0IHByb3ZpZGVyID0gbmV3IFNuaXBwZXRDb21wbGV0aW9uUHJvdmlkZXIobGFuZ3VhZ2VTZXJ2aWNlLCBzbmlwcGV0U2VydmljZSwgZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0TGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSgpKSk7XG5cblx0XHRjb25zdCBtb2RlbCA9IGluc3RhbnRpYXRlVGV4dE1vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlLCAnIGNpJywgJ2Zvb0xhbmcnKTtcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBwcm92aWRlci5wcm92aWRlQ29tcGxldGlvbkl0ZW1zKG1vZGVsLCBuZXcgUG9zaXRpb24oMSwgNCksIGRlZmF1bHRDb21wbGV0aW9uQ29udGV4dCkhO1xuXHRcdGNvbnN0IGNvbXBsZXRpb25zID0gYXdhaXQgYXNDb21wbGV0aW9uTW9kZWwobW9kZWwsIG5ldyBQb3NpdGlvbigxLCA0KSwgcHJvdmlkZXIpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5zdWdnZXN0aW9ucy5sZW5ndGgsIDEpO1xuXHRcdGNvbnN0IFtmaXJzdF0gPSByZXN1bHQuc3VnZ2VzdGlvbnM7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCg8Q29tcGxldGlvbkl0ZW1MYWJlbD5maXJzdC5sYWJlbCkubGFiZWwsICcgY2l0ZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoPENvbXBsZXRpb25JdGVtUmFuZ2VzPmZpcnN0LnJhbmdlKS5pbnNlcnQuc3RhcnRDb2x1bW4sIDEpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbXBsZXRpb25zLml0ZW1zLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbXBsZXRpb25zLml0ZW1zWzBdLnRleHRMYWJlbCwgJyBjaXRlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbXBsZXRpb25zLml0ZW1zWzBdLmVkaXRTdGFydC5jb2x1bW4sIDEpO1xuXG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdzdGlsbCBzaG93IHN1Z2dlc3Rpb25zIGluIHN0cmluZyB3aGVuIGRpc2FibGUgc3RyaW5nIHN1Z2dlc3Rpb24gIzEzNjYxMScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdHNuaXBwZXRTZXJ2aWNlID0gbmV3IFNpbXBsZVNuaXBwZXRTZXJ2aWNlKFtcblx0XHRcdG5ldyBTbmlwcGV0KGZhbHNlLCBbJ2Zvb0xhbmcnXSwgJ2FhYScsICdhYWEnLCAnJywgJ3ZhbHVlJywgJycsIFNuaXBwZXRTb3VyY2UuVXNlciwgZ2VuZXJhdGVVdWlkKCkpLFxuXHRcdFx0bmV3IFNuaXBwZXQoZmFsc2UsIFsnZm9vTGFuZyddLCAnYmJiJywgJ2JiYicsICcnLCAndmFsdWUnLCAnJywgU25pcHBldFNvdXJjZS5Vc2VyLCBnZW5lcmF0ZVV1aWQoKSksXG5cdFx0XHQvLyBuZXcgU25pcHBldChbJ2Zvb0xhbmcnXSwgJ1xcJ2NjYycsICdcXCdjY2MnLCAnJywgJ3ZhbHVlJywgJycsIFNuaXBwZXRTb3VyY2UuVXNlciwgZ2VuZXJhdGVVdWlkKCkpXG5cdFx0XSk7XG5cblx0XHRjb25zdCBwcm92aWRlciA9IG5ldyBTbmlwcGV0Q29tcGxldGlvblByb3ZpZGVyKGxhbmd1YWdlU2VydmljZSwgc25pcHBldFNlcnZpY2UsIGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdExhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UoKSkpO1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBpbnN0YW50aWF0ZVRleHRNb2RlbChpbnN0YW50aWF0aW9uU2VydmljZSwgJ1xcJ1xcJycsICdmb29MYW5nJyk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgcHJvdmlkZXIucHJvdmlkZUNvbXBsZXRpb25JdGVtcyhcblx0XHRcdG1vZGVsLFxuXHRcdFx0bmV3IFBvc2l0aW9uKDEsIDIpLFxuXHRcdFx0eyB0cmlnZ2VyS2luZDogQ29tcGxldGlvblRyaWdnZXJLaW5kLlRyaWdnZXJDaGFyYWN0ZXIsIHRyaWdnZXJDaGFyYWN0ZXI6ICdcXCcnIH1cblx0XHQpITtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuc3VnZ2VzdGlvbnMubGVuZ3RoLCAwKTtcblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cblx0fSk7XG5cblx0dGVzdCgnc3RpbGwgc2hvdyBzdWdnZXN0aW9ucyBpbiBzdHJpbmcgd2hlbiBkaXNhYmxlIHN0cmluZyBzdWdnZXN0aW9uICMxMzY2MTEgKHBhcnQgMiknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHRzbmlwcGV0U2VydmljZSA9IG5ldyBTaW1wbGVTbmlwcGV0U2VydmljZShbXG5cdFx0XHRuZXcgU25pcHBldChmYWxzZSwgWydmb29MYW5nJ10sICdhYWEnLCAnYWFhJywgJycsICd2YWx1ZScsICcnLCBTbmlwcGV0U291cmNlLlVzZXIsIGdlbmVyYXRlVXVpZCgpKSxcblx0XHRcdG5ldyBTbmlwcGV0KGZhbHNlLCBbJ2Zvb0xhbmcnXSwgJ2JiYicsICdiYmInLCAnJywgJ3ZhbHVlJywgJycsIFNuaXBwZXRTb3VyY2UuVXNlciwgZ2VuZXJhdGVVdWlkKCkpLFxuXHRcdFx0bmV3IFNuaXBwZXQoZmFsc2UsIFsnZm9vTGFuZyddLCAnXFwnY2NjJywgJ1xcJ2NjYycsICcnLCAndmFsdWUnLCAnJywgU25pcHBldFNvdXJjZS5Vc2VyLCBnZW5lcmF0ZVV1aWQoKSlcblx0XHRdKTtcblxuXHRcdGNvbnN0IHByb3ZpZGVyID0gbmV3IFNuaXBwZXRDb21wbGV0aW9uUHJvdmlkZXIobGFuZ3VhZ2VTZXJ2aWNlLCBzbmlwcGV0U2VydmljZSwgZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0TGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSgpKSk7XG5cblx0XHRjb25zdCBtb2RlbCA9IGluc3RhbnRpYXRlVGV4dE1vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlLCAnXFwnXFwnJywgJ2Zvb0xhbmcnKTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByb3ZpZGVyLnByb3ZpZGVDb21wbGV0aW9uSXRlbXMoXG5cdFx0XHRtb2RlbCxcblx0XHRcdG5ldyBQb3NpdGlvbigxLCAyKSxcblx0XHRcdHsgdHJpZ2dlcktpbmQ6IENvbXBsZXRpb25UcmlnZ2VyS2luZC5UcmlnZ2VyQ2hhcmFjdGVyLCB0cmlnZ2VyQ2hhcmFjdGVyOiAnXFwnJyB9XG5cdFx0KSE7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LnN1Z2dlc3Rpb25zLmxlbmd0aCwgMSk7XG5cblx0XHRjb25zdCBjb21wbGV0aW9ucyA9IGF3YWl0IGFzQ29tcGxldGlvbk1vZGVsKG1vZGVsLCBuZXcgUG9zaXRpb24oMSwgMiksIHByb3ZpZGVyLCB7IHRyaWdnZXJLaW5kOiBDb21wbGV0aW9uVHJpZ2dlcktpbmQuVHJpZ2dlckNoYXJhY3RlciwgdHJpZ2dlckNoYXJhY3RlcjogJ1xcJycgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbXBsZXRpb25zLml0ZW1zLmxlbmd0aCwgMSk7XG5cblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1NuaXBwZXQgc3VnZ2VzdGlvbnMgYXJlIHRvbyBlYWdlciAjMTM4NzA3ICh3b3JkKScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRzbmlwcGV0U2VydmljZSA9IG5ldyBTaW1wbGVTbmlwcGV0U2VydmljZShbXG5cdFx0XHRuZXcgU25pcHBldChmYWxzZSwgWydmb29MYW5nJ10sICd0eXMnLCAndHlzJywgJycsICd2YWx1ZScsICcnLCBTbmlwcGV0U291cmNlLlVzZXIsIGdlbmVyYXRlVXVpZCgpKSxcblx0XHRcdG5ldyBTbmlwcGV0KGZhbHNlLCBbJ2Zvb0xhbmcnXSwgJ2hlbGxfb3JfdGVsbCcsICdoZWxsX29yX3RlbGwnLCAnJywgJ3ZhbHVlJywgJycsIFNuaXBwZXRTb3VyY2UuVXNlciwgZ2VuZXJhdGVVdWlkKCkpLFxuXHRcdFx0bmV3IFNuaXBwZXQoZmFsc2UsIFsnZm9vTGFuZyddLCAnXnknLCAnXnknLCAnJywgJ3ZhbHVlJywgJycsIFNuaXBwZXRTb3VyY2UuVXNlciwgZ2VuZXJhdGVVdWlkKCkpLFxuXHRcdF0pO1xuXG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBuZXcgU25pcHBldENvbXBsZXRpb25Qcm92aWRlcihsYW5ndWFnZVNlcnZpY2UsIHNuaXBwZXRTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKCkpKTtcblx0XHRjb25zdCBtb2RlbCA9IGluc3RhbnRpYXRlVGV4dE1vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlLCAnXFwnaGVsbG90XFwnJywgJ2Zvb0xhbmcnKTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByb3ZpZGVyLnByb3ZpZGVDb21wbGV0aW9uSXRlbXMoXG5cdFx0XHRtb2RlbCxcblx0XHRcdG5ldyBQb3NpdGlvbigxLCA4KSxcblx0XHRcdHsgdHJpZ2dlcktpbmQ6IENvbXBsZXRpb25UcmlnZ2VyS2luZC5JbnZva2UgfVxuXHRcdCkhO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5zdWdnZXN0aW9ucy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoPFNuaXBwZXRDb21wbGV0aW9uPnJlc3VsdC5zdWdnZXN0aW9uc1swXSkubGFiZWwubGFiZWwsICdoZWxsX29yX3RlbGwnKTtcblxuXHRcdGNvbnN0IGNvbXBsZXRpb25zID0gYXdhaXQgYXNDb21wbGV0aW9uTW9kZWwobW9kZWwsIG5ldyBQb3NpdGlvbigxLCA4KSwgcHJvdmlkZXIsIHsgdHJpZ2dlcktpbmQ6IENvbXBsZXRpb25UcmlnZ2VyS2luZC5JbnZva2UgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbXBsZXRpb25zLml0ZW1zLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbXBsZXRpb25zLml0ZW1zWzBdLnRleHRMYWJlbCwgJ2hlbGxfb3JfdGVsbCcpO1xuXG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdTbmlwcGV0IHN1Z2dlc3Rpb25zIGFyZSB0b28gZWFnZXIgIzEzODcwNyAobm8gd29yZCknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0c25pcHBldFNlcnZpY2UgPSBuZXcgU2ltcGxlU25pcHBldFNlcnZpY2UoW1xuXHRcdFx0bmV3IFNuaXBwZXQoZmFsc2UsIFsnZm9vTGFuZyddLCAndHlzJywgJ3R5cycsICcnLCAndmFsdWUnLCAnJywgU25pcHBldFNvdXJjZS5Vc2VyLCBnZW5lcmF0ZVV1aWQoKSksXG5cdFx0XHRuZXcgU25pcHBldChmYWxzZSwgWydmb29MYW5nJ10sICd0JywgJ3QnLCAnJywgJ3ZhbHVlJywgJycsIFNuaXBwZXRTb3VyY2UuVXNlciwgZ2VuZXJhdGVVdWlkKCkpLFxuXHRcdFx0bmV3IFNuaXBwZXQoZmFsc2UsIFsnZm9vTGFuZyddLCAnXnknLCAnXnknLCAnJywgJ3ZhbHVlJywgJycsIFNuaXBwZXRTb3VyY2UuVXNlciwgZ2VuZXJhdGVVdWlkKCkpLFxuXHRcdF0pO1xuXG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBuZXcgU25pcHBldENvbXBsZXRpb25Qcm92aWRlcihsYW5ndWFnZVNlcnZpY2UsIHNuaXBwZXRTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKCkpKTtcblx0XHRjb25zdCBtb2RlbCA9IGluc3RhbnRpYXRlVGV4dE1vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlLCAnKSomXicsICdmb29MYW5nJyk7XG5cblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBwcm92aWRlci5wcm92aWRlQ29tcGxldGlvbkl0ZW1zKFxuXHRcdFx0bW9kZWwsXG5cdFx0XHRuZXcgUG9zaXRpb24oMSwgNSksXG5cdFx0XHR7IHRyaWdnZXJLaW5kOiBDb21wbGV0aW9uVHJpZ2dlcktpbmQuSW52b2tlIH1cblx0XHQpITtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuc3VnZ2VzdGlvbnMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKDxTbmlwcGV0Q29tcGxldGlvbj5yZXN1bHQuc3VnZ2VzdGlvbnNbMF0pLmxhYmVsLmxhYmVsLCAnXnknKTtcblxuXG5cdFx0Y29uc3QgY29tcGxldGlvbnMgPSBhd2FpdCBhc0NvbXBsZXRpb25Nb2RlbChtb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDUpLCBwcm92aWRlciwgeyB0cmlnZ2VyS2luZDogQ29tcGxldGlvblRyaWdnZXJLaW5kLkludm9rZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29tcGxldGlvbnMuaXRlbXMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29tcGxldGlvbnMuaXRlbXNbMF0udGV4dExhYmVsLCAnXnknKTtcblxuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnU25pcHBldCBzdWdnZXN0aW9ucyBhcmUgdG9vIGVhZ2VyICMxMzg3MDcgKHdvcmQvd29yZCknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0c25pcHBldFNlcnZpY2UgPSBuZXcgU2ltcGxlU25pcHBldFNlcnZpY2UoW1xuXHRcdFx0bmV3IFNuaXBwZXQoZmFsc2UsIFsnZm9vTGFuZyddLCAnYXN5bmMgYXJyb3cgZnVuY3Rpb24nLCAnYXN5bmMgYXJyb3cgZnVuY3Rpb24nLCAnJywgJ3ZhbHVlJywgJycsIFNuaXBwZXRTb3VyY2UuVXNlciwgZ2VuZXJhdGVVdWlkKCkpLFxuXHRcdFx0bmV3IFNuaXBwZXQoZmFsc2UsIFsnZm9vTGFuZyddLCAnZm9vYmFycnJycnInLCAnZm9vYmFycnJycnInLCAnJywgJ3ZhbHVlJywgJycsIFNuaXBwZXRTb3VyY2UuVXNlciwgZ2VuZXJhdGVVdWlkKCkpLFxuXHRcdF0pO1xuXG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBuZXcgU25pcHBldENvbXBsZXRpb25Qcm92aWRlcihsYW5ndWFnZVNlcnZpY2UsIHNuaXBwZXRTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKCkpKTtcblx0XHRjb25zdCBtb2RlbCA9IGluc3RhbnRpYXRlVGV4dE1vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlLCAnZm9vYmFyJywgJ2Zvb0xhbmcnKTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByb3ZpZGVyLnByb3ZpZGVDb21wbGV0aW9uSXRlbXMoXG5cdFx0XHRtb2RlbCxcblx0XHRcdG5ldyBQb3NpdGlvbigxLCA3KSxcblx0XHRcdHsgdHJpZ2dlcktpbmQ6IENvbXBsZXRpb25UcmlnZ2VyS2luZC5JbnZva2UgfVxuXHRcdCkhO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5zdWdnZXN0aW9ucy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoPFNuaXBwZXRDb21wbGV0aW9uPnJlc3VsdC5zdWdnZXN0aW9uc1swXSkubGFiZWwubGFiZWwsICdmb29iYXJycnJycicpO1xuXG5cdFx0Y29uc3QgY29tcGxldGlvbnMgPSBhd2FpdCBhc0NvbXBsZXRpb25Nb2RlbChtb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDcpLCBwcm92aWRlciwgeyB0cmlnZ2VyS2luZDogQ29tcGxldGlvblRyaWdnZXJLaW5kLkludm9rZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29tcGxldGlvbnMuaXRlbXMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29tcGxldGlvbnMuaXRlbXNbMF0udGV4dExhYmVsLCAnZm9vYmFycnJycnInKTtcblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1N0cmFuZ2UgYW5kIHVzZWxlc3MgYXV0b3N1Z2dlc3Rpb24gI3JlZ2lvbi8jZW5kcmVnaW9uIFBIUCAjMTQwMDM5JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdHNuaXBwZXRTZXJ2aWNlID0gbmV3IFNpbXBsZVNuaXBwZXRTZXJ2aWNlKFtcblx0XHRcdG5ldyBTbmlwcGV0KGZhbHNlLCBbJ2Zvb0xhbmcnXSwgJ3JlZycsICcjcmVnaW9uJywgJycsICd2YWx1ZScsICcnLCBTbmlwcGV0U291cmNlLlVzZXIsIGdlbmVyYXRlVXVpZCgpKSxcblx0XHRdKTtcblxuXG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBuZXcgU25pcHBldENvbXBsZXRpb25Qcm92aWRlcihsYW5ndWFnZVNlcnZpY2UsIHNuaXBwZXRTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKCkpKTtcblx0XHRjb25zdCBtb2RlbCA9IGluc3RhbnRpYXRlVGV4dE1vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlLCAnZnVuY3Rpb24gYWJjKHcpJywgJ2Zvb0xhbmcnKTtcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBwcm92aWRlci5wcm92aWRlQ29tcGxldGlvbkl0ZW1zKFxuXHRcdFx0bW9kZWwsXG5cdFx0XHRuZXcgUG9zaXRpb24oMSwgMTUpLFxuXHRcdFx0eyB0cmlnZ2VyS2luZDogQ29tcGxldGlvblRyaWdnZXJLaW5kLkludm9rZSB9XG5cdFx0KSE7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LnN1Z2dlc3Rpb25zLmxlbmd0aCwgMCk7XG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0LnNraXAoJ1NuaXBwZXRzIGRpc2FwcGVhciB3aXRoIC4ga2V5ICMxNDU5NjAnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0c25pcHBldFNlcnZpY2UgPSBuZXcgU2ltcGxlU25pcHBldFNlcnZpY2UoW1xuXHRcdFx0bmV3IFNuaXBwZXQoZmFsc2UsIFsnZm9vTGFuZyddLCAnZGl2JywgJ2RpdicsICcnLCAnZGl2JywgJycsIFNuaXBwZXRTb3VyY2UuVXNlciwgZ2VuZXJhdGVVdWlkKCkpLFxuXHRcdFx0bmV3IFNuaXBwZXQoZmFsc2UsIFsnZm9vTGFuZyddLCAnZGl2LicsICdkaXYuJywgJycsICdkaXYuJywgJycsIFNuaXBwZXRTb3VyY2UuVXNlciwgZ2VuZXJhdGVVdWlkKCkpLFxuXHRcdFx0bmV3IFNuaXBwZXQoZmFsc2UsIFsnZm9vTGFuZyddLCAnZGl2IycsICdkaXYjJywgJycsICdkaXYjJywgJycsIFNuaXBwZXRTb3VyY2UuVXNlciwgZ2VuZXJhdGVVdWlkKCkpLFxuXHRcdF0pO1xuXG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBuZXcgU25pcHBldENvbXBsZXRpb25Qcm92aWRlcihsYW5ndWFnZVNlcnZpY2UsIHNuaXBwZXRTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKCkpKTtcblx0XHRjb25zdCBtb2RlbCA9IGluc3RhbnRpYXRlVGV4dE1vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlLCAnZGknLCAnZm9vTGFuZycpO1xuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByb3ZpZGVyLnByb3ZpZGVDb21wbGV0aW9uSXRlbXMoXG5cdFx0XHRtb2RlbCxcblx0XHRcdG5ldyBQb3NpdGlvbigxLCAzKSxcblx0XHRcdHsgdHJpZ2dlcktpbmQ6IENvbXBsZXRpb25UcmlnZ2VyS2luZC5JbnZva2UgfVxuXHRcdCkhO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5zdWdnZXN0aW9ucy5sZW5ndGgsIDMpO1xuXG5cblx0XHRtb2RlbC5hcHBseUVkaXRzKFtFZGl0T3BlcmF0aW9uLmluc2VydChuZXcgUG9zaXRpb24oMSwgMyksICcuJyldKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ2RpLicpO1xuXHRcdGNvbnN0IHJlc3VsdDIgPSBhd2FpdCBwcm92aWRlci5wcm92aWRlQ29tcGxldGlvbkl0ZW1zKFxuXHRcdFx0bW9kZWwsXG5cdFx0XHRuZXcgUG9zaXRpb24oMSwgNCksXG5cdFx0XHR7IHRyaWdnZXJLaW5kOiBDb21wbGV0aW9uVHJpZ2dlcktpbmQuVHJpZ2dlckNoYXJhY3RlciwgdHJpZ2dlckNoYXJhY3RlcjogJy4nIH1cblx0XHQpITtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQyLnN1Z2dlc3Rpb25zLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdDIuc3VnZ2VzdGlvbnNbMF0uaW5zZXJ0VGV4dCwgJ2Rpdi4nKTtcblxuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnSHlwaGVuIGluIHNuaXBwZXQgcHJlZml4IGRlLWluZGVudHMgc25pcHBldCAjMTM5MDE2JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdHNuaXBwZXRTZXJ2aWNlID0gbmV3IFNpbXBsZVNuaXBwZXRTZXJ2aWNlKFtcblx0XHRcdG5ldyBTbmlwcGV0KGZhbHNlLCBbJ2Zvb0xhbmcnXSwgJ2ZvbycsICdGb28tIEJhcicsICcnLCAnRm9vJywgJycsIFNuaXBwZXRTb3VyY2UuVXNlciwgZ2VuZXJhdGVVdWlkKCkpLFxuXHRcdF0pO1xuXHRcdGNvbnN0IG1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRlVGV4dE1vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlLCAnICAgIGJhcicsICdmb29MYW5nJykpO1xuXHRcdGNvbnN0IHByb3ZpZGVyID0gbmV3IFNuaXBwZXRDb21wbGV0aW9uUHJvdmlkZXIobGFuZ3VhZ2VTZXJ2aWNlLCBzbmlwcGV0U2VydmljZSwgZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0TGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSgpKSk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgcHJvdmlkZXIucHJvdmlkZUNvbXBsZXRpb25JdGVtcyhcblx0XHRcdG1vZGVsLFxuXHRcdFx0bmV3IFBvc2l0aW9uKDEsIDgpLFxuXHRcdFx0eyB0cmlnZ2VyS2luZDogQ29tcGxldGlvblRyaWdnZXJLaW5kLkludm9rZSB9XG5cdFx0KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuc3VnZ2VzdGlvbnMubGVuZ3RoLCAxKTtcblx0XHRjb25zdCBmaXJzdCA9IHJlc3VsdC5zdWdnZXN0aW9uc1swXTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKDxDb21wbGV0aW9uSXRlbVJhbmdlcz5maXJzdC5yYW5nZSkuaW5zZXJ0LnN0YXJ0Q29sdW1uLCA1KTtcblxuXHRcdGNvbnN0IGNvbXBsZXRpb25zID0gYXdhaXQgYXNDb21wbGV0aW9uTW9kZWwobW9kZWwsIG5ldyBQb3NpdGlvbigxLCA4KSwgcHJvdmlkZXIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb21wbGV0aW9ucy5pdGVtcy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb21wbGV0aW9ucy5pdGVtc1swXS5lZGl0U3RhcnQuY29sdW1uLCA1KTtcblx0fSk7XG5cblx0dGVzdCgnQXV0b2NvbXBsZXRlIHN1Z2dlc3RzIGJhc2VkIG9uIHRoZSBsYXN0IGxldHRlciBvZiBhIHdvcmQgYW5kIGl0IGRlcGVuZHMgb24gdGhlIHR5cGluZyBzcGVlZCAjMTkxMDcwJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdHNuaXBwZXRTZXJ2aWNlID0gbmV3IFNpbXBsZVNuaXBwZXRTZXJ2aWNlKFtcblx0XHRcdG5ldyBTbmlwcGV0KGZhbHNlLCBbJ2Zvb0xhbmcnXSwgJy93aGlsZXRydWUnLCAnL3doaWxldHJ1ZScsICcnLCAnb25lJywgJycsIFNuaXBwZXRTb3VyY2UuVXNlciwgZ2VuZXJhdGVVdWlkKCkpLFxuXHRcdFx0bmV3IFNuaXBwZXQoZmFsc2UsIFsnZm9vTGFuZyddLCAnL3NjIG5vdCBleHBhbmRpbmcnLCAnL3NjIG5vdCBleHBhbmRpbmcnLCAnJywgJ3R3bycsICcnLCBTbmlwcGV0U291cmNlLlVzZXIsIGdlbmVyYXRlVXVpZCgpKSxcblx0XHRdKTtcblxuXHRcdGNvbnN0IHByb3ZpZGVyID0gbmV3IFNuaXBwZXRDb21wbGV0aW9uUHJvdmlkZXIobGFuZ3VhZ2VTZXJ2aWNlLCBzbmlwcGV0U2VydmljZSwgZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0TGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSgpKSk7XG5cdFx0Y29uc3QgbW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGVUZXh0TW9kZWwoaW5zdGFudGlhdGlvblNlcnZpY2UsICcnLCAnZm9vTGFuZycpKTtcblxuXHRcdHsgLy8gUFJFRklYOiB3XG5cdFx0XHRtb2RlbC5zZXRWYWx1ZSgndycpO1xuXHRcdFx0Y29uc3QgcmVzdWx0MSA9IGF3YWl0IHByb3ZpZGVyLnByb3ZpZGVDb21wbGV0aW9uSXRlbXMoXG5cdFx0XHRcdG1vZGVsLFxuXHRcdFx0XHRuZXcgUG9zaXRpb24oMSwgMiksXG5cdFx0XHRcdHsgdHJpZ2dlcktpbmQ6IENvbXBsZXRpb25UcmlnZ2VyS2luZC5JbnZva2UgfVxuXHRcdFx0KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQxLnN1Z2dlc3Rpb25zWzBdLmluc2VydFRleHQsICdvbmUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQxLnN1Z2dlc3Rpb25zLmxlbmd0aCwgMSk7XG5cdFx0fVxuXG5cdFx0eyAvLyBQUkVGSVg6IHdoZXJlXG5cdFx0XHRtb2RlbC5zZXRWYWx1ZSgnd2hlcmUnKTtcblx0XHRcdGNvbnN0IHJlc3VsdDIgPSBhd2FpdCBwcm92aWRlci5wcm92aWRlQ29tcGxldGlvbkl0ZW1zKFxuXHRcdFx0XHRtb2RlbCxcblx0XHRcdFx0bmV3IFBvc2l0aW9uKDEsIDYpLFxuXHRcdFx0XHR7IHRyaWdnZXJLaW5kOiBDb21wbGV0aW9uVHJpZ2dlcktpbmQuSW52b2tlIH1cblx0XHRcdCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0Mi5zdWdnZXN0aW9uc1swXS5pbnNlcnRUZXh0LCAnb25lJyk7IC8vIC93aGlsZXRydWUgbWF0Y2hlcyB3aGVyZSAoV0hpbEV0UnVFKVxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdDIuc3VnZ2VzdGlvbnMubGVuZ3RoLCAxKTtcblx0XHR9XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBNEIsaUNBQWlDO0FBQzdELFNBQW9CLGdCQUFnQjtBQUNwQyxTQUFTLHFCQUFxQiw0QkFBNEI7QUFFMUQsU0FBUyxTQUFTLHFCQUFxQjtBQUN2QyxTQUF1RSw2QkFBNkI7QUFDcEcsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyx3Q0FBd0M7QUFDakQsU0FBUyxxQkFBcUI7QUFFOUIsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUywrQ0FBK0M7QUFFeEQsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxxQkFBcUI7QUFFOUIsTUFBTSxxQkFBaUQ7QUFBQSxFQUV0RCxZQUFxQixVQUFxQjtBQUFyQjtBQUFBLEVBQXVCO0FBQUEsRUFDNUMsY0FBYztBQUNiLFdBQU8sUUFBUSxRQUFRLEtBQUssZ0JBQWdCLENBQUM7QUFBQSxFQUM5QztBQUFBLEVBQ0Esa0JBQTZCO0FBQzVCLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUNBLGtCQUF1QjtBQUN0QixVQUFNLElBQUksTUFBTTtBQUFBLEVBQ2pCO0FBQUEsRUFDQSxZQUFxQjtBQUNwQixVQUFNLElBQUksTUFBTTtBQUFBLEVBQ2pCO0FBQUEsRUFDQSxtQkFBeUI7QUFDeEIsVUFBTSxJQUFJLE1BQU07QUFBQSxFQUNqQjtBQUFBLEVBQ0EscUJBQXFCLFNBQXdCO0FBQzVDLFVBQU0sSUFBSSxNQUFNO0FBQUEsRUFDakI7QUFDRDtBQUVBLE1BQU0sbUJBQW1CLFdBQVk7QUFDcEMsUUFBTSwyQkFBOEMsRUFBRSxhQUFhLHNCQUFzQixPQUFPO0FBRWhHLE1BQUk7QUFDSixNQUFJO0FBQ0osTUFBSTtBQUNKLE1BQUk7QUFFSixRQUFNLFdBQVk7QUFDakIsa0JBQWMsSUFBSSxnQkFBZ0I7QUFDbEMsMkJBQXVCLG9CQUFvQixXQUFXO0FBQ3RELHNCQUFrQixxQkFBcUIsSUFBSSxnQkFBZ0I7QUFDM0QsZ0JBQVksSUFBSSxnQkFBZ0IsaUJBQWlCO0FBQUEsTUFDaEQsSUFBSTtBQUFBLE1BQ0osWUFBWSxDQUFDLFVBQVc7QUFBQSxJQUN6QixDQUFDLENBQUM7QUFDRixxQkFBaUIsSUFBSSxxQkFBcUIsQ0FBQyxJQUFJO0FBQUEsTUFDOUM7QUFBQSxNQUNBLENBQUMsU0FBUztBQUFBLE1BQ1Y7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQSxjQUFjO0FBQUEsTUFDZCxhQUFhO0FBQUEsSUFDZCxHQUFHLElBQUk7QUFBQSxNQUNOO0FBQUEsTUFDQSxDQUFDLFNBQVM7QUFBQSxNQUNWO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0EsY0FBYztBQUFBLE1BQ2QsYUFBYTtBQUFBLElBQ2QsQ0FBQyxDQUFDO0FBQUEsRUFDSCxDQUFDO0FBRUQsV0FBUyxNQUFNO0FBQ2QsZ0JBQVksUUFBUTtBQUFBLEVBQ3JCLENBQUM7QUFFRCwwQ0FBd0M7QUFFeEMsaUJBQWUsa0JBQWtCLE9BQW1CLFVBQXFCLFVBQXFDLFVBQTZCLDBCQUEwQjtBQUVwSyxVQUFNLE9BQU8sTUFBTSxTQUFTLHVCQUF1QixPQUFPLFNBQVMsS0FBSyxRQUFRLEdBQUcsT0FBTztBQUUxRixVQUFNLFNBQVMsSUFBSTtBQUFBLE1BQWdCLEtBQUssWUFBWSxJQUFJLE9BQUs7QUFDNUQsZUFBTyxJQUFJLGVBQWUsVUFBVSxHQUFHLE1BQU0sUUFBUTtBQUFBLE1BQ3RELENBQUM7QUFBQSxNQUNBLFNBQVM7QUFBQSxNQUNULEVBQUUscUJBQXFCLEdBQUcsb0JBQW9CLE1BQU0sZUFBZSxTQUFTLFVBQVUsRUFBRSxVQUFVLEdBQUcsU0FBUyxTQUFTLENBQUMsRUFBRTtBQUFBLE1BQzFILGFBQWE7QUFBQSxNQUFNLGNBQWMsUUFBUTtBQUFBLE1BQWMsY0FBYyxtQkFBbUI7QUFBQSxNQUFjO0FBQUEsSUFDdkc7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUVBLE9BQUssZ0NBQWdDLGlCQUFrQjtBQUV0RCxVQUFNLFdBQVcsSUFBSSwwQkFBMEIsaUJBQWlCLGdCQUFnQixZQUFZLElBQUksSUFBSSxpQ0FBaUMsQ0FBQyxDQUFDO0FBQ3ZJLFVBQU0sUUFBUSxZQUFZLElBQUkscUJBQXFCLHNCQUFzQixJQUFJLFNBQVMsQ0FBQztBQUV2RixVQUFNLFNBQVMsdUJBQXVCLE9BQU8sSUFBSSxTQUFTLEdBQUcsQ0FBQyxHQUFHLHdCQUF3QixFQUFHLEtBQUssWUFBVTtBQUMxRyxhQUFPLFlBQVksT0FBTyxZQUFZLE1BQVM7QUFDL0MsYUFBTyxZQUFZLE9BQU8sWUFBWSxRQUFRLENBQUM7QUFBQSxJQUNoRCxDQUFDO0FBRUQsVUFBTSxjQUFjLE1BQU0sa0JBQWtCLE9BQU8sSUFBSSxTQUFTLEdBQUcsQ0FBQyxHQUFHLFFBQVE7QUFDL0UsV0FBTyxZQUFZLFlBQVksTUFBTSxRQUFRLENBQUM7QUFBQSxFQUMvQyxDQUFDO0FBRUQsT0FBSyxrQ0FBa0MsaUJBQWtCO0FBRXhELFVBQU0sV0FBVyxJQUFJLDBCQUEwQixpQkFBaUIsZ0JBQWdCLFlBQVksSUFBSSxJQUFJLGlDQUFpQyxDQUFDLENBQUM7QUFDdkksVUFBTSxRQUFRLFlBQVksSUFBSSxxQkFBcUIsc0JBQXNCLFVBQVUsU0FBUyxDQUFDO0FBRTdGLFVBQU0sU0FBUyx1QkFBdUIsT0FBTyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQWdCLHdCQUF3QixFQUFHLEtBQUssWUFBVTtBQUN2SCxhQUFPLFlBQVksT0FBTyxZQUFZLE1BQVM7QUFDL0MsYUFBTyxZQUFZLE9BQU8sWUFBWSxRQUFRLENBQUM7QUFBQSxJQUNoRCxDQUFDO0FBRUQsVUFBTSxTQUFTLHVCQUF1QixPQUFPLElBQUksU0FBUyxHQUFHLENBQUMsR0FBZ0Isd0JBQXdCLEVBQUcsS0FBSyxZQUFVO0FBQ3ZILGFBQU8sWUFBWSxPQUFPLFlBQVksTUFBUztBQUMvQyxhQUFPLFlBQVksT0FBTyxZQUFZLFFBQVEsQ0FBQztBQUFBLElBQ2hELENBQUM7QUFFRCxVQUFNLGVBQWUsTUFBTSxrQkFBa0IsT0FBTyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQWUsUUFBUTtBQUM1RixXQUFPLFlBQVksYUFBYSxNQUFNLFFBQVEsQ0FBQztBQUUvQyxVQUFNLGVBQWUsTUFBTSxrQkFBa0IsT0FBTyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQWUsUUFBUTtBQUM1RixXQUFPLFlBQVksYUFBYSxNQUFNLFFBQVEsQ0FBQztBQUFBLEVBQ2hELENBQUM7QUFFRCxPQUFLLHFDQUFxQyxpQkFBa0I7QUFFM0QsVUFBTSxXQUFXLElBQUksMEJBQTBCLGlCQUFpQixnQkFBZ0IsWUFBWSxJQUFJLElBQUksaUNBQWlDLENBQUMsQ0FBQztBQUN2SSxVQUFNLFFBQVEsWUFBWSxJQUFJLHFCQUFxQixzQkFBc0IsT0FBTyxTQUFTLENBQUM7QUFFMUYsVUFBTSxTQUFTLHVCQUF1QixPQUFPLElBQUksU0FBUyxHQUFHLENBQUMsR0FBRyx3QkFBd0IsRUFBRyxLQUFLLFlBQVU7QUFDMUcsYUFBTyxZQUFZLE9BQU8sWUFBWSxNQUFTO0FBQy9DLGFBQU8sWUFBWSxPQUFPLFlBQVksUUFBUSxDQUFDO0FBQy9DLGFBQU8sZ0JBQWdCLE9BQU8sWUFBWSxDQUFDLEVBQUUsT0FBTztBQUFBLFFBQ25ELE9BQU87QUFBQSxRQUNQLGFBQWE7QUFBQSxNQUNkLENBQUM7QUFDRCxhQUFPLFlBQWEsT0FBTyxZQUFZLENBQUMsRUFBRSxNQUFjLE9BQU8sYUFBYSxDQUFDO0FBQzdFLGFBQU8sWUFBWSxPQUFPLFlBQVksQ0FBQyxFQUFFLFlBQVksZ0JBQWdCO0FBQUEsSUFDdEUsQ0FBQztBQUVELFVBQU0sY0FBYyxNQUFNLGtCQUFrQixPQUFPLElBQUksU0FBUyxHQUFHLENBQUMsR0FBRyxRQUFRO0FBQy9FLFdBQU8sWUFBWSxZQUFZLE1BQU0sUUFBUSxDQUFDO0FBQzlDLFdBQU8sZ0JBQWdCLFlBQVksTUFBTSxDQUFDLEVBQUUsV0FBVyxPQUFPO0FBQUEsTUFDN0QsT0FBTztBQUFBLE1BQ1AsYUFBYTtBQUFBLElBQ2QsQ0FBQztBQUNELFdBQU8sWUFBYSxZQUFZLE1BQU0sQ0FBQyxFQUFFLFdBQVcsTUFBYyxPQUFPLGFBQWEsQ0FBQztBQUN2RixXQUFPLFlBQVksWUFBWSxNQUFNLENBQUMsRUFBRSxXQUFXLFlBQVksZ0JBQWdCO0FBQUEsRUFDaEYsQ0FBQztBQUVELE9BQUssaURBQWlELGlCQUFrQjtBQUN2RSxxQkFBaUIsSUFBSSxxQkFBcUIsQ0FBQyxJQUFJO0FBQUEsTUFDOUM7QUFBQSxNQUNBLENBQUMsU0FBUztBQUFBLE1BQ1Y7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQSxjQUFjO0FBQUEsTUFDZCxhQUFhO0FBQUEsSUFDZCxHQUFHLElBQUk7QUFBQSxNQUNOO0FBQUEsTUFDQSxDQUFDLFNBQVM7QUFBQSxNQUNWO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0EsY0FBYztBQUFBLE1BQ2QsYUFBYTtBQUFBLElBQ2QsQ0FBQyxDQUFDO0FBRUYsVUFBTSxXQUFXLElBQUksMEJBQTBCLGlCQUFpQixnQkFBZ0IsWUFBWSxJQUFJLElBQUksaUNBQWlDLENBQUMsQ0FBQztBQUN2SSxVQUFNLFFBQVEsWUFBWSxJQUFJLHFCQUFxQixzQkFBc0IsV0FBVyxTQUFTLENBQUM7QUFFOUY7QUFDQyxZQUFNLFNBQVMsdUJBQXVCLE9BQU8sSUFBSSxTQUFTLEdBQUcsQ0FBQyxHQUFHLHdCQUF3QixFQUFHLEtBQUssWUFBVTtBQUMxRyxlQUFPLFlBQVksT0FBTyxZQUFZLE1BQVM7QUFDL0MsZUFBTyxZQUFZLE9BQU8sWUFBWSxRQUFRLENBQUM7QUFDL0MsZUFBTyxnQkFBZ0IsT0FBTyxZQUFZLENBQUMsRUFBRSxPQUFPO0FBQUEsVUFDbkQsT0FBTztBQUFBLFVBQ1AsYUFBYTtBQUFBLFFBQ2QsQ0FBQztBQUNELGVBQU8sWUFBWSxPQUFPLFlBQVksQ0FBQyxFQUFFLFlBQVksSUFBSTtBQUN6RCxlQUFPLFlBQWEsT0FBTyxZQUFZLENBQUMsRUFBRSxNQUErQixPQUFPLGFBQWEsQ0FBQztBQUM5RixlQUFPLGdCQUFnQixPQUFPLFlBQVksQ0FBQyxFQUFFLE9BQU87QUFBQSxVQUNuRCxPQUFPO0FBQUEsVUFDUCxhQUFhO0FBQUEsUUFDZCxDQUFDO0FBQ0QsZUFBTyxZQUFZLE9BQU8sWUFBWSxDQUFDLEVBQUUsWUFBWSxJQUFJO0FBQ3pELGVBQU8sWUFBYSxPQUFPLFlBQVksQ0FBQyxFQUFFLE1BQStCLE9BQU8sYUFBYSxDQUFDO0FBQUEsTUFDL0YsQ0FBQztBQUVELFlBQU0sY0FBYyxNQUFNLGtCQUFrQixPQUFPLElBQUksU0FBUyxHQUFHLENBQUMsR0FBRyxRQUFRO0FBQy9FLGFBQU8sWUFBWSxZQUFZLE1BQU0sUUFBUSxDQUFDO0FBQzlDLGFBQU8sZ0JBQWdCLFlBQVksTUFBTSxDQUFDLEVBQUUsV0FBVyxPQUFPO0FBQUEsUUFDN0QsT0FBTztBQUFBLFFBQ1AsYUFBYTtBQUFBLE1BQ2QsQ0FBQztBQUNELGFBQU8sWUFBWSxZQUFZLE1BQU0sQ0FBQyxFQUFFLFdBQVcsWUFBWSxJQUFJO0FBQ25FLGFBQU8sWUFBYSxZQUFZLE1BQU0sQ0FBQyxFQUFFLFdBQVcsTUFBK0IsT0FBTyxhQUFhLENBQUM7QUFDeEcsYUFBTyxnQkFBZ0IsWUFBWSxNQUFNLENBQUMsRUFBRSxXQUFXLE9BQU87QUFBQSxRQUM3RCxPQUFPO0FBQUEsUUFDUCxhQUFhO0FBQUEsTUFDZCxDQUFDO0FBQ0QsYUFBTyxZQUFZLFlBQVksTUFBTSxDQUFDLEVBQUUsV0FBVyxZQUFZLElBQUk7QUFDbkUsYUFBTyxZQUFhLFlBQVksTUFBTSxDQUFDLEVBQUUsV0FBVyxNQUErQixPQUFPLGFBQWEsQ0FBQztBQUFBLElBQ3pHO0FBRUE7QUFDQyxZQUFNLFNBQVMsdUJBQXVCLE9BQU8sSUFBSSxTQUFTLEdBQUcsQ0FBQyxHQUFHLHdCQUF3QixFQUFHLEtBQUssWUFBVTtBQUMxRyxlQUFPLFlBQVksT0FBTyxZQUFZLE1BQVM7QUFDL0MsZUFBTyxZQUFZLE9BQU8sWUFBWSxRQUFRLENBQUM7QUFFL0MsY0FBTSxDQUFDQSxRQUFPQyxPQUFNLElBQUksT0FBTztBQUUvQixlQUFPLGdCQUFnQkQsT0FBTSxPQUFPO0FBQUEsVUFDbkMsT0FBTztBQUFBLFVBQ1AsYUFBYTtBQUFBLFFBQ2QsQ0FBQztBQUNELGVBQU8sWUFBWUEsT0FBTSxZQUFZLElBQUk7QUFDekMsZUFBTyxZQUFhQSxPQUFNLE1BQStCLE9BQU8sYUFBYSxDQUFDO0FBRTlFLGVBQU8sZ0JBQWdCQyxRQUFPLE9BQU87QUFBQSxVQUNwQyxPQUFPO0FBQUEsVUFDUCxhQUFhO0FBQUEsUUFDZCxDQUFDO0FBQ0QsZUFBTyxZQUFZQSxRQUFPLFlBQVksSUFBSTtBQUMxQyxlQUFPLFlBQWFBLFFBQU8sTUFBK0IsT0FBTyxhQUFhLENBQUM7QUFBQSxNQUNoRixDQUFDO0FBRUQsWUFBTSxjQUFjLE1BQU0sa0JBQWtCLE9BQU8sSUFBSSxTQUFTLEdBQUcsQ0FBQyxHQUFHLFFBQVE7QUFDL0UsYUFBTyxZQUFZLFlBQVksTUFBTSxRQUFRLENBQUM7QUFFOUMsWUFBTSxDQUFDLE9BQU8sTUFBTSxJQUFJLFlBQVksTUFBTSxJQUFJLE9BQUssRUFBRSxVQUFVO0FBRS9ELGFBQU8sZ0JBQWdCLE1BQU0sT0FBTztBQUFBLFFBQ25DLE9BQU87QUFBQSxRQUNQLGFBQWE7QUFBQSxNQUNkLENBQUM7QUFDRCxhQUFPLFlBQVksTUFBTSxZQUFZLElBQUk7QUFDekMsYUFBTyxZQUFhLE1BQU0sTUFBK0IsT0FBTyxhQUFhLENBQUM7QUFFOUUsYUFBTyxnQkFBZ0IsT0FBTyxPQUFPO0FBQUEsUUFDcEMsT0FBTztBQUFBLFFBQ1AsYUFBYTtBQUFBLE1BQ2QsQ0FBQztBQUNELGFBQU8sWUFBWSxPQUFPLFlBQVksSUFBSTtBQUMxQyxhQUFPLFlBQWEsT0FBTyxNQUErQixPQUFPLGFBQWEsQ0FBQztBQUFBLElBQ2hGO0FBRUE7QUFDQyxZQUFNLFNBQVMsdUJBQXVCLE9BQU8sSUFBSSxTQUFTLEdBQUcsQ0FBQyxHQUFHLHdCQUF3QixFQUFHLEtBQUssWUFBVTtBQUMxRyxlQUFPLFlBQVksT0FBTyxZQUFZLE1BQVM7QUFDL0MsZUFBTyxZQUFZLE9BQU8sWUFBWSxRQUFRLENBQUM7QUFDL0MsZUFBTyxnQkFBZ0IsT0FBTyxZQUFZLENBQUMsRUFBRSxPQUFPO0FBQUEsVUFDbkQsT0FBTztBQUFBLFVBQ1AsYUFBYTtBQUFBLFFBQ2QsQ0FBQztBQUNELGVBQU8sWUFBWSxPQUFPLFlBQVksQ0FBQyxFQUFFLFlBQVksSUFBSTtBQUN6RCxlQUFPLFlBQWEsT0FBTyxZQUFZLENBQUMsRUFBRSxNQUFjLE9BQU8sYUFBYSxDQUFDO0FBQzdFLGVBQU8sZ0JBQWdCLE9BQU8sWUFBWSxDQUFDLEVBQUUsT0FBTztBQUFBLFVBQ25ELE9BQU87QUFBQSxVQUNQLGFBQWE7QUFBQSxRQUNkLENBQUM7QUFDRCxlQUFPLFlBQVksT0FBTyxZQUFZLENBQUMsRUFBRSxZQUFZLElBQUk7QUFDekQsZUFBTyxZQUFhLE9BQU8sWUFBWSxDQUFDLEVBQUUsTUFBYyxPQUFPLGFBQWEsQ0FBQztBQUFBLE1BQzlFLENBQUM7QUFFRCxZQUFNLGNBQWMsTUFBTSxrQkFBa0IsT0FBTyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsUUFBUTtBQUMvRSxhQUFPLFlBQVksWUFBWSxNQUFNLFFBQVEsQ0FBQztBQUM5QyxhQUFPLGdCQUFnQixZQUFZLE1BQU0sQ0FBQyxFQUFFLFdBQVcsT0FBTztBQUFBLFFBQzdELE9BQU87QUFBQSxRQUNQLGFBQWE7QUFBQSxNQUNkLENBQUM7QUFDRCxhQUFPLFlBQVksWUFBWSxNQUFNLENBQUMsRUFBRSxXQUFXLFlBQVksSUFBSTtBQUNuRSxhQUFPLFlBQWEsWUFBWSxNQUFNLENBQUMsRUFBRSxXQUFXLE1BQWMsT0FBTyxhQUFhLENBQUM7QUFDdkYsYUFBTyxnQkFBZ0IsWUFBWSxNQUFNLENBQUMsRUFBRSxXQUFXLE9BQU87QUFBQSxRQUM3RCxPQUFPO0FBQUEsUUFDUCxhQUFhO0FBQUEsTUFDZCxDQUFDO0FBQ0QsYUFBTyxZQUFZLFlBQVksTUFBTSxDQUFDLEVBQUUsV0FBVyxZQUFZLElBQUk7QUFDbkUsYUFBTyxZQUFhLFlBQVksTUFBTSxDQUFDLEVBQUUsV0FBVyxNQUFjLE9BQU8sYUFBYSxDQUFDO0FBQUEsSUFDeEY7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLDZEQUE2RCxpQkFBa0I7QUFDbkYscUJBQWlCLElBQUkscUJBQXFCLENBQUMsSUFBSTtBQUFBLE1BQzlDO0FBQUEsTUFDQSxDQUFDLFNBQVM7QUFBQSxNQUNWO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0EsY0FBYztBQUFBLE1BQ2QsYUFBYTtBQUFBLElBQ2QsQ0FBQyxDQUFDO0FBRUYsVUFBTSxXQUFXLElBQUksMEJBQTBCLGlCQUFpQixnQkFBZ0IsWUFBWSxJQUFJLElBQUksaUNBQWlDLENBQUMsQ0FBQztBQUV2SSxRQUFJLFFBQVEscUJBQXFCLHNCQUFzQixVQUFXLFNBQVM7QUFDM0UsVUFBTSxTQUFTLHVCQUF1QixPQUFPLElBQUksU0FBUyxHQUFHLENBQUMsR0FBRyx3QkFBd0IsRUFBRyxLQUFLLFlBQVU7QUFDMUcsYUFBTyxZQUFZLE9BQU8sWUFBWSxRQUFRLENBQUM7QUFBQSxJQUNoRCxDQUFDO0FBQ0QsVUFBTSxlQUFlLE1BQU0sa0JBQWtCLE9BQU8sSUFBSSxTQUFTLEdBQUcsQ0FBQyxHQUFHLFFBQVE7QUFDaEYsV0FBTyxZQUFZLGFBQWEsTUFBTSxRQUFRLENBQUM7QUFFL0MsVUFBTSxRQUFRO0FBQ2QsWUFBUSxxQkFBcUIsc0JBQXNCLE9BQVEsU0FBUztBQUNwRSxVQUFNLFNBQVMsdUJBQXVCLE9BQU8sSUFBSSxTQUFTLEdBQUcsQ0FBQyxHQUFHLHdCQUF3QixFQUFFLEtBQUssWUFBVTtBQUN6RyxhQUFPLFlBQVksT0FBTyxZQUFZLFFBQVEsQ0FBQztBQUMvQyxhQUFPLFlBQWEsT0FBTyxZQUFZLENBQUMsRUFBRSxNQUFjLE9BQU8sYUFBYSxDQUFDO0FBQUEsSUFDOUUsQ0FBQztBQUNELFVBQU0sZUFBZSxNQUFNLGtCQUFrQixPQUFPLElBQUksU0FBUyxHQUFHLENBQUMsR0FBRyxRQUFRO0FBQ2hGLFdBQU8sWUFBWSxhQUFhLE1BQU0sUUFBUSxDQUFDO0FBQy9DLFdBQU8sWUFBYSxhQUFhLE1BQU0sQ0FBQyxFQUFFLFdBQVcsTUFBYyxPQUFPLGFBQWEsQ0FBQztBQUV4RixVQUFNLFFBQVE7QUFDZCxZQUFRLHFCQUFxQixzQkFBc0IsT0FBTyxTQUFTO0FBQ25FLFVBQU0sU0FBUyx1QkFBdUIsT0FBTyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsd0JBQXdCLEVBQUcsS0FBSyxZQUFVO0FBQzFHLGFBQU8sWUFBWSxPQUFPLFlBQVksUUFBUSxDQUFDO0FBQy9DLGFBQU8sWUFBYSxPQUFPLFlBQVksQ0FBQyxFQUFFLE1BQWMsT0FBTyxhQUFhLENBQUM7QUFBQSxJQUM5RSxDQUFDO0FBQ0QsVUFBTSxlQUFlLE1BQU0sa0JBQWtCLE9BQU8sSUFBSSxTQUFTLEdBQUcsQ0FBQyxHQUFHLFFBQVE7QUFDaEYsV0FBTyxZQUFZLGFBQWEsTUFBTSxRQUFRLENBQUM7QUFDL0MsV0FBTyxZQUFhLGFBQWEsTUFBTSxDQUFDLEVBQUUsV0FBVyxNQUFjLE9BQU8sYUFBYSxDQUFDO0FBQ3hGLFVBQU0sUUFBUTtBQUFBLEVBQ2YsQ0FBQztBQUVELE9BQUssaUVBQWlFLGlCQUFrQjtBQUV2RixxQkFBaUIsSUFBSSxxQkFBcUIsQ0FBQyxJQUFJO0FBQUEsTUFDOUM7QUFBQSxNQUNBLENBQUMsU0FBUztBQUFBLE1BQ1Y7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQSxjQUFjO0FBQUEsTUFDZCxhQUFhO0FBQUEsSUFDZCxDQUFDLENBQUM7QUFFRixVQUFNLFdBQVcsSUFBSSwwQkFBMEIsaUJBQWlCLGdCQUFnQixZQUFZLElBQUksSUFBSSxpQ0FBaUMsQ0FBQyxDQUFDO0FBRXZJLFVBQU0sUUFBUSxZQUFZLElBQUkscUJBQXFCLHNCQUFzQixzQkFBdUIsU0FBUyxDQUFDO0FBQzFHLFVBQU0sU0FBUyx1QkFBdUIsT0FBTyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsd0JBQXdCLEVBQUcsS0FBSyxZQUFVO0FBQzFHLGFBQU8sWUFBWSxPQUFPLFlBQVksUUFBUSxDQUFDO0FBQUEsSUFDaEQsQ0FBQztBQUNELFVBQU0sY0FBYyxNQUFNLGtCQUFrQixPQUFPLElBQUksU0FBUyxHQUFHLENBQUMsR0FBRyxRQUFRO0FBQy9FLFdBQU8sWUFBWSxZQUFZLE1BQU0sUUFBUSxDQUFDO0FBRzlDLFVBQU0sU0FBUyx1QkFBdUIsT0FBTyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsd0JBQXdCLEVBQUUsS0FBSyxZQUFVO0FBQ3pHLGFBQU8sWUFBWSxPQUFPLFlBQVksUUFBUSxDQUFDO0FBQUEsSUFDaEQsQ0FBQztBQUNELFVBQU0sZUFBZSxNQUFNLGtCQUFrQixPQUFPLElBQUksU0FBUyxHQUFHLENBQUMsR0FBRyxRQUFRO0FBQ2hGLFdBQU8sWUFBWSxhQUFhLE1BQU0sUUFBUSxDQUFDO0FBQUEsRUFFaEQsQ0FBQztBQUVELE9BQUsseURBQXlELGlCQUFrQjtBQUMvRSxxQkFBaUIsSUFBSSxxQkFBcUIsQ0FBQyxJQUFJO0FBQUEsTUFDOUM7QUFBQSxNQUNBLENBQUMsU0FBUztBQUFBLE1BQ1Y7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQSxjQUFjO0FBQUEsTUFDZCxhQUFhO0FBQUEsSUFDZCxHQUFHLElBQUk7QUFBQSxNQUNOO0FBQUEsTUFDQSxDQUFDLFNBQVM7QUFBQSxNQUNWO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0EsY0FBYztBQUFBLE1BQ2QsYUFBYTtBQUFBLElBQ2QsQ0FBQyxDQUFDO0FBRUYsVUFBTSxXQUFXLElBQUksMEJBQTBCLGlCQUFpQixnQkFBZ0IsWUFBWSxJQUFJLElBQUksaUNBQWlDLENBQUMsQ0FBQztBQUV2SSxVQUFNLFFBQVEsWUFBWSxJQUFJLHFCQUFxQixzQkFBc0IsSUFBSSxTQUFTLENBQUM7QUFDdkYsVUFBTSxTQUFTLHVCQUF1QixPQUFPLElBQUksU0FBUyxHQUFHLENBQUMsR0FBRyx3QkFBd0IsRUFBRyxLQUFLLFlBQVU7QUFDMUcsYUFBTyxZQUFZLE9BQU8sWUFBWSxRQUFRLENBQUM7QUFDL0MsWUFBTSxDQUFDRCxRQUFPQyxPQUFNLElBQUksT0FBTztBQUMvQixhQUFPLGdCQUFnQkQsT0FBTSxPQUFPO0FBQUEsUUFDbkMsT0FBTztBQUFBLFFBQ1AsYUFBYTtBQUFBLE1BQ2QsQ0FBQztBQUNELGFBQU8sZ0JBQWdCQyxRQUFPLE9BQU87QUFBQSxRQUNwQyxPQUFPO0FBQUEsUUFDUCxhQUFhO0FBQUEsTUFDZCxDQUFDO0FBQUEsSUFDRixDQUFDO0FBRUQsVUFBTSxjQUFjLE1BQU0sa0JBQWtCLE9BQU8sSUFBSSxTQUFTLEdBQUcsQ0FBQyxHQUFHLFFBQVE7QUFDL0UsV0FBTyxZQUFZLFlBQVksTUFBTSxRQUFRLENBQUM7QUFDOUMsVUFBTSxDQUFDLE9BQU8sTUFBTSxJQUFJLFlBQVk7QUFDcEMsV0FBTyxnQkFBZ0IsTUFBTSxXQUFXLE9BQU87QUFBQSxNQUM5QyxPQUFPO0FBQUEsTUFDUCxhQUFhO0FBQUEsSUFDZCxDQUFDO0FBQ0QsV0FBTyxnQkFBZ0IsT0FBTyxXQUFXLE9BQU87QUFBQSxNQUMvQyxPQUFPO0FBQUEsTUFDUCxhQUFhO0FBQUEsSUFDZCxDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSyx5Q0FBeUMsaUJBQWtCO0FBQy9ELHFCQUFpQixJQUFJLHFCQUFxQixDQUFDLElBQUk7QUFBQSxNQUM5QztBQUFBLE1BQ0EsQ0FBQyxTQUFTO0FBQUEsTUFDVjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBLGNBQWM7QUFBQSxNQUNkLGFBQWE7QUFBQSxJQUNkLENBQUMsQ0FBQztBQUNGLFVBQU0sV0FBVyxJQUFJLDBCQUEwQixpQkFBaUIsZ0JBQWdCLFlBQVksSUFBSSxJQUFJLGlDQUFpQyxDQUFDLENBQUM7QUFFdkksVUFBTSxRQUFRLFlBQVksSUFBSSxxQkFBcUIsc0JBQXNCLE1BQU0sU0FBUyxDQUFDO0FBRXpGLFFBQUksU0FBUyxNQUFNLFNBQVMsdUJBQXVCLE9BQU8sSUFBSSxTQUFTLEdBQUcsQ0FBQyxHQUFHLHdCQUF3QjtBQUN0RyxRQUFJLGNBQWMsTUFBTSxrQkFBa0IsT0FBTyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsUUFBUTtBQUM3RSxXQUFPLFlBQVksT0FBTyxZQUFZLFFBQVEsQ0FBQztBQUMvQyxXQUFPLFlBQVksWUFBWSxNQUFNLFFBQVEsQ0FBQztBQUU5QyxhQUFTLE1BQU0sU0FBUyx1QkFBdUIsT0FBTyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsd0JBQXdCO0FBQ2xHLGtCQUFjLE1BQU0sa0JBQWtCLE9BQU8sSUFBSSxTQUFTLEdBQUcsQ0FBQyxHQUFHLFFBQVE7QUFDekUsV0FBTyxZQUFZLE9BQU8sWUFBWSxRQUFRLENBQUM7QUFDL0MsV0FBTyxZQUFZLFlBQVksTUFBTSxRQUFRLENBQUM7QUFFOUMsYUFBUyxNQUFNLFNBQVMsdUJBQXVCLE9BQU8sSUFBSSxTQUFTLEdBQUcsQ0FBQyxHQUFHLHdCQUF3QjtBQUNsRyxrQkFBYyxNQUFNLGtCQUFrQixPQUFPLElBQUksU0FBUyxHQUFHLENBQUMsR0FBRyxRQUFRO0FBQ3pFLFdBQU8sWUFBWSxPQUFPLFlBQVksUUFBUSxDQUFDO0FBQy9DLFdBQU8sWUFBWSxZQUFZLE1BQU0sUUFBUSxDQUFDO0FBQUEsRUFDL0MsQ0FBQztBQUVELE9BQUssb0VBQW9FLGlCQUFrQjtBQUMxRixxQkFBaUIsSUFBSSxxQkFBcUIsQ0FBQyxJQUFJO0FBQUEsTUFDOUM7QUFBQSxNQUNBLENBQUMsU0FBUztBQUFBLE1BQ1Y7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQSxjQUFjO0FBQUEsTUFDZCxhQUFhO0FBQUEsSUFDZCxDQUFDLENBQUM7QUFFRixVQUFNLFdBQVcsSUFBSSwwQkFBMEIsaUJBQWlCLGdCQUFnQixZQUFZLElBQUksSUFBSSxpQ0FBaUMsQ0FBQyxDQUFDO0FBRXZJLFVBQU0sUUFBUSxZQUFZLElBQUkscUJBQXFCLHNCQUFzQixpS0FBaUssU0FBUyxDQUFDO0FBQ3BQLFVBQU0sU0FBUyxNQUFNLFNBQVMsdUJBQXVCLE9BQU8sSUFBSSxTQUFTLEdBQUcsR0FBRyxHQUFHLHdCQUF3QjtBQUMxRyxVQUFNLGNBQWMsTUFBTSxrQkFBa0IsT0FBTyxJQUFJLFNBQVMsR0FBRyxHQUFHLEdBQUcsUUFBUTtBQUVqRixXQUFPLFlBQVksT0FBTyxZQUFZLFFBQVEsQ0FBQztBQUMvQyxXQUFPLFlBQVksWUFBWSxNQUFNLFFBQVEsQ0FBQztBQUFBLEVBQy9DLENBQUM7QUFFRCxPQUFLLDBDQUEwQyxpQkFBa0I7QUFDaEUscUJBQWlCLElBQUkscUJBQXFCLENBQUMsSUFBSTtBQUFBLE1BQzlDO0FBQUEsTUFDQSxDQUFDLFNBQVM7QUFBQSxNQUNWO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0EsY0FBYztBQUFBLE1BQ2QsYUFBYTtBQUFBLElBQ2QsQ0FBQyxDQUFDO0FBRUYsVUFBTSxXQUFXLElBQUksMEJBQTBCLGlCQUFpQixnQkFBZ0IsWUFBWSxJQUFJLElBQUksaUNBQWlDLENBQUMsQ0FBQztBQUV2SSxVQUFNLFFBQVEsWUFBWSxJQUFJLHFCQUFxQixzQkFBc0IsS0FBSyxTQUFTLENBQUM7QUFDeEYsVUFBTSxTQUFTLE1BQU0sU0FBUyx1QkFBdUIsT0FBTyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsd0JBQXdCO0FBQ3hHLFdBQU8sWUFBWSxPQUFPLFlBQVksUUFBUSxDQUFDO0FBRS9DLFVBQU0sY0FBYyxNQUFNLGtCQUFrQixPQUFPLElBQUksU0FBUyxHQUFHLENBQUMsR0FBRyxRQUFRO0FBQy9FLFdBQU8sWUFBWSxZQUFZLE1BQU0sUUFBUSxDQUFDO0FBQUEsRUFDL0MsQ0FBQztBQUVELE9BQUssb0RBQXFELGlCQUFrQjtBQUMzRSxxQkFBaUIsSUFBSSxxQkFBcUIsQ0FBQyxJQUFJO0FBQUEsTUFDOUM7QUFBQSxNQUNBLENBQUMsU0FBUztBQUFBLE1BQ1Y7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQSxjQUFjO0FBQUEsTUFDZCxhQUFhO0FBQUEsSUFDZCxDQUFDLENBQUM7QUFFRixVQUFNLFdBQVcsSUFBSSwwQkFBMEIsaUJBQWlCLGdCQUFnQixZQUFZLElBQUksSUFBSSxpQ0FBaUMsQ0FBQyxDQUFDO0FBRXZJLFVBQU0sUUFBUSxZQUFZLElBQUkscUJBQXFCLHNCQUFzQixZQUFZLFNBQVMsQ0FBQztBQUMvRixVQUFNLFNBQVMsTUFBTSxTQUFTLHVCQUF1QixPQUFPLElBQUksU0FBUyxHQUFHLENBQUMsR0FBRyx3QkFBd0I7QUFFeEcsV0FBTyxZQUFZLE9BQU8sWUFBWSxRQUFRLENBQUM7QUFDL0MsV0FBTyxnQkFBZ0IsT0FBTyxZQUFZLENBQUMsRUFBRSxPQUFPO0FBQUEsTUFDbkQsT0FBTztBQUFBLE1BQ1AsYUFBYTtBQUFBLElBQ2QsQ0FBQztBQUVELFVBQU0sY0FBYyxNQUFNLGtCQUFrQixPQUFPLElBQUksU0FBUyxHQUFHLENBQUMsR0FBRyxRQUFRO0FBQy9FLFdBQU8sWUFBWSxZQUFZLE1BQU0sUUFBUSxDQUFDO0FBQUEsRUFDL0MsQ0FBQztBQUVELE9BQUssNEVBQTRFLGlCQUFrQjtBQUNsRyxxQkFBaUIsSUFBSSxxQkFBcUIsQ0FBQyxJQUFJO0FBQUEsTUFDOUM7QUFBQSxNQUNBLENBQUMsU0FBUztBQUFBLE1BQ1Y7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQSxjQUFjO0FBQUEsTUFDZCxhQUFhO0FBQUEsSUFDZCxDQUFDLENBQUM7QUFFRixVQUFNLFdBQVcsSUFBSSwwQkFBMEIsaUJBQWlCLGdCQUFnQixZQUFZLElBQUksSUFBSSxpQ0FBaUMsQ0FBQyxDQUFDO0FBRXZJLFVBQU0sUUFBUSxZQUFZLElBQUkscUJBQXFCLHNCQUFzQiw4S0FBOEssU0FBUyxDQUFDO0FBRWpRLFVBQU0sU0FBUyxNQUFNLFNBQVMsdUJBQXVCLE9BQU8sSUFBSSxTQUFTLEdBQUcsR0FBRyxHQUFHLHdCQUF3QjtBQUMxRyxXQUFPLFlBQVksT0FBTyxZQUFZLFFBQVEsQ0FBQztBQUUvQyxVQUFNLGNBQWMsTUFBTSxrQkFBa0IsT0FBTyxJQUFJLFNBQVMsR0FBRyxHQUFHLEdBQUcsUUFBUTtBQUNqRixXQUFPLFlBQVksWUFBWSxNQUFNLFFBQVEsQ0FBQztBQUFBLEVBQy9DLENBQUM7QUFFRCxPQUFLLG1FQUFtRSxpQkFBa0I7QUFDekYsVUFBTSwrQkFBK0IsWUFBWSxJQUFJLElBQUksaUNBQWlDLENBQUM7QUFDM0YsZ0JBQVksSUFBSSw2QkFBNkIsU0FBUyxXQUFXO0FBQUEsTUFDaEUsYUFBYTtBQUFBLElBQ2QsQ0FBQyxDQUFDO0FBRUYscUJBQWlCLElBQUkscUJBQXFCLENBQUMsSUFBSTtBQUFBLE1BQzlDO0FBQUEsTUFDQSxDQUFDLFNBQVM7QUFBQSxNQUNWO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0EsY0FBYztBQUFBLE1BQ2QsYUFBYTtBQUFBLElBQ2QsQ0FBQyxDQUFDO0FBRUYsVUFBTSxXQUFXLElBQUksMEJBQTBCLGlCQUFpQixnQkFBZ0IsNEJBQTRCO0FBRTVHLFVBQU0sUUFBUSxZQUFZLElBQUkscUJBQXFCLHNCQUFzQixrQkFBVyxTQUFTLENBQUM7QUFFOUYsVUFBTSxTQUFTLE1BQU0sU0FBUyx1QkFBdUIsT0FBTyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsd0JBQXdCO0FBQ3hHLFdBQU8sWUFBWSxPQUFPLFlBQVksUUFBUSxDQUFDO0FBRS9DLFVBQU0sY0FBYyxNQUFNLGtCQUFrQixPQUFPLElBQUksU0FBUyxHQUFHLENBQUMsR0FBRyxRQUFRO0FBQy9FLFdBQU8sWUFBWSxZQUFZLE1BQU0sUUFBUSxDQUFDO0FBQUEsRUFDL0MsQ0FBQztBQUVELE9BQUssb0dBQW9HLGlCQUFrQjtBQUMxSCxxQkFBaUIsSUFBSSxxQkFBcUIsQ0FBQyxJQUFJO0FBQUEsTUFDOUM7QUFBQSxNQUNBLENBQUMsU0FBUztBQUFBLE1BQ1Y7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQSxjQUFjO0FBQUEsTUFDZCxhQUFhO0FBQUEsSUFDZCxDQUFDLENBQUM7QUFFRixVQUFNLFdBQVcsSUFBSSwwQkFBMEIsaUJBQWlCLGdCQUFnQixZQUFZLElBQUksSUFBSSxpQ0FBaUMsQ0FBQyxDQUFDO0FBRXZJLFVBQU0sUUFBUSxZQUFZLElBQUkscUJBQXFCLHNCQUFzQixNQUFNLFNBQVMsQ0FBQztBQUV6RixVQUFNLFNBQVMsTUFBTSxTQUFTLHVCQUF1QixPQUFPLElBQUksU0FBUyxHQUFHLENBQUMsR0FBRyx3QkFBd0I7QUFDeEcsV0FBTyxZQUFZLE9BQU8sWUFBWSxRQUFRLENBQUM7QUFFL0MsVUFBTSxjQUFjLE1BQU0sa0JBQWtCLE9BQU8sSUFBSSxTQUFTLEdBQUcsQ0FBQyxHQUFHLFFBQVE7QUFDL0UsV0FBTyxZQUFZLFlBQVksTUFBTSxRQUFRLENBQUM7QUFBQSxFQUMvQyxDQUFDO0FBRUQsT0FBSyxzRUFBc0UsaUJBQWtCO0FBQzVGLHFCQUFpQixJQUFJLHFCQUFxQixDQUFDLElBQUk7QUFBQSxNQUM5QztBQUFBLE1BQ0EsQ0FBQyxTQUFTO0FBQUEsTUFDVjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBLGNBQWM7QUFBQSxNQUNkLGFBQWE7QUFBQSxJQUNkLEdBQUcsSUFBSTtBQUFBLE1BQ047QUFBQSxNQUNBLENBQUMsU0FBUztBQUFBLE1BQ1Y7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQSxjQUFjO0FBQUEsTUFDZCxhQUFhO0FBQUEsSUFDZCxDQUFDLENBQUM7QUFFRixVQUFNLFdBQVcsSUFBSSwwQkFBMEIsaUJBQWlCLGdCQUFnQixZQUFZLElBQUksSUFBSSxpQ0FBaUMsQ0FBQyxDQUFDO0FBRXZJLFFBQUksUUFBUSxxQkFBcUIsc0JBQXNCLE1BQU0sU0FBUztBQUV0RSxRQUFJLFNBQVMsTUFBTSxTQUFTLHVCQUF1QixPQUFPLElBQUksU0FBUyxHQUFHLENBQUMsR0FBRyx3QkFBd0I7QUFDdEcsV0FBTyxZQUFZLE9BQU8sWUFBWSxRQUFRLENBQUM7QUFDL0MsUUFBSSxDQUFDLEtBQUssSUFBSSxPQUFPO0FBQ3JCLFdBQU8sWUFBYSxNQUFNLE1BQWMsT0FBTyxhQUFhLENBQUM7QUFFN0QsUUFBSSxjQUFjLE1BQU0sa0JBQWtCLE9BQU8sSUFBSSxTQUFTLEdBQUcsQ0FBQyxHQUFHLFFBQVE7QUFDN0UsV0FBTyxZQUFZLFlBQVksTUFBTSxRQUFRLENBQUM7QUFDOUMsV0FBTyxZQUFZLFlBQVksTUFBTSxDQUFDLEVBQUUsVUFBVSxRQUFRLENBQUM7QUFFM0QsVUFBTSxRQUFRO0FBQ2QsWUFBUSxxQkFBcUIsc0JBQXNCLEtBQUssU0FBUztBQUNqRSxhQUFTLE1BQU0sU0FBUyx1QkFBdUIsT0FBTyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsd0JBQXdCO0FBQ2xHLGtCQUFjLE1BQU0sa0JBQWtCLE9BQU8sSUFBSSxTQUFTLEdBQUcsQ0FBQyxHQUFHLFFBQVE7QUFFekUsV0FBTyxZQUFZLE9BQU8sWUFBWSxRQUFRLENBQUM7QUFDL0MsS0FBQyxLQUFLLElBQUksT0FBTztBQUNqQixXQUFPLFlBQWEsTUFBTSxNQUFjLE9BQU8sYUFBYSxDQUFDO0FBQzdELFdBQU8sWUFBWSxZQUFZLE1BQU0sUUFBUSxDQUFDO0FBQzlDLFdBQU8sWUFBWSxZQUFZLE1BQU0sQ0FBQyxFQUFFLFVBQVUsUUFBUSxDQUFDO0FBRTNELFVBQU0sUUFBUTtBQUFBLEVBQ2YsQ0FBQztBQUVELE9BQUsseUJBQXlCLGlCQUFrQjtBQUMvQyxxQkFBaUIsSUFBSSxxQkFBcUIsQ0FBQyxJQUFJO0FBQUEsTUFDOUM7QUFBQSxNQUNBLENBQUMsU0FBUztBQUFBLE1BQ1Y7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQSxjQUFjO0FBQUEsTUFDZCxhQUFhO0FBQUEsSUFDZCxDQUFDLENBQUM7QUFFRixVQUFNLFdBQVcsSUFBSSwwQkFBMEIsaUJBQWlCLGdCQUFnQixZQUFZLElBQUksSUFBSSxpQ0FBaUMsQ0FBQyxDQUFDO0FBRXZJLFFBQUksUUFBUSxxQkFBcUIsc0JBQXNCLG1CQUFtQixTQUFTO0FBRW5GLFFBQUksU0FBUyxNQUFNLFNBQVMsdUJBQXVCLE9BQU8sSUFBSSxTQUFTLEdBQUcsQ0FBQyxHQUFHLHdCQUF3QjtBQUN0RyxXQUFPLFlBQVksT0FBTyxZQUFZLFFBQVEsQ0FBQztBQUMvQyxRQUFJLENBQUMsS0FBSyxJQUFJLE9BQU87QUFDckIsV0FBTyxZQUFhLE1BQU0sTUFBYyxPQUFPLFdBQVcsQ0FBQztBQUMzRCxXQUFPLFlBQWEsTUFBTSxNQUFjLFFBQVEsV0FBVyxDQUFDO0FBRTVELFFBQUksY0FBYyxNQUFNLGtCQUFrQixPQUFPLElBQUksU0FBUyxHQUFHLENBQUMsR0FBRyxRQUFRO0FBQzdFLFdBQU8sWUFBWSxZQUFZLE1BQU0sUUFBUSxDQUFDO0FBQzlDLFdBQU8sWUFBWSxZQUFZLE1BQU0sQ0FBQyxFQUFFLGNBQWMsUUFBUSxDQUFDO0FBQy9ELFdBQU8sWUFBWSxZQUFZLE1BQU0sQ0FBQyxFQUFFLGVBQWUsUUFBUSxDQUFDO0FBRWhFLFVBQU0sUUFBUTtBQUNkLFlBQVEscUJBQXFCLHNCQUFzQixpQkFBaUIsU0FBUztBQUM3RSxhQUFTLE1BQU0sU0FBUyx1QkFBdUIsT0FBTyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsd0JBQXdCO0FBRWxHLFdBQU8sWUFBWSxPQUFPLFlBQVksUUFBUSxDQUFDO0FBQy9DLEtBQUMsS0FBSyxJQUFJLE9BQU87QUFDakIsV0FBTyxZQUFhLE1BQU0sTUFBYyxPQUFPLFdBQVcsQ0FBQztBQUMzRCxXQUFPLFlBQWEsTUFBTSxNQUFjLFFBQVEsV0FBVyxDQUFDO0FBRTVELGtCQUFjLE1BQU0sa0JBQWtCLE9BQU8sSUFBSSxTQUFTLEdBQUcsQ0FBQyxHQUFHLFFBQVE7QUFDekUsV0FBTyxZQUFZLFlBQVksTUFBTSxRQUFRLENBQUM7QUFDOUMsV0FBTyxZQUFZLFlBQVksTUFBTSxDQUFDLEVBQUUsY0FBYyxRQUFRLENBQUM7QUFDL0QsV0FBTyxZQUFZLFlBQVksTUFBTSxDQUFDLEVBQUUsZUFBZSxRQUFRLENBQUM7QUFFaEUsVUFBTSxRQUFRO0FBQ2QsWUFBUSxxQkFBcUIsc0JBQXNCLFlBQVksU0FBUztBQUN4RSxhQUFTLE1BQU0sU0FBUyx1QkFBdUIsT0FBTyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsd0JBQXdCO0FBRWxHLFdBQU8sWUFBWSxPQUFPLFlBQVksUUFBUSxDQUFDO0FBQy9DLEtBQUMsS0FBSyxJQUFJLE9BQU87QUFDakIsV0FBTyxZQUFhLE1BQU0sTUFBYyxPQUFPLFdBQVcsQ0FBQztBQUMzRCxXQUFPLFlBQWEsTUFBTSxNQUFjLFFBQVEsV0FBVyxDQUFDO0FBRTVELGtCQUFjLE1BQU0sa0JBQWtCLE9BQU8sSUFBSSxTQUFTLEdBQUcsQ0FBQyxHQUFHLFFBQVE7QUFDekUsV0FBTyxZQUFZLFlBQVksTUFBTSxRQUFRLENBQUM7QUFDOUMsV0FBTyxZQUFZLFlBQVksTUFBTSxDQUFDLEVBQUUsY0FBYyxRQUFRLENBQUM7QUFDL0QsV0FBTyxZQUFZLFlBQVksTUFBTSxDQUFDLEVBQUUsZUFBZSxRQUFRLENBQUM7QUFFaEUsVUFBTSxRQUFRO0FBQUEsRUFDZixDQUFDO0FBRUQsT0FBSywyQ0FBMkMsaUJBQWtCO0FBRWpFLHFCQUFpQixJQUFJLHFCQUFxQixDQUFDLElBQUk7QUFBQSxNQUM5QztBQUFBLE1BQ0EsQ0FBQyxTQUFTO0FBQUEsTUFDVjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBLGNBQWM7QUFBQSxNQUNkLGFBQWE7QUFBQSxJQUNkLENBQUMsQ0FBQztBQUVGLFVBQU0sV0FBVyxJQUFJLDBCQUEwQixpQkFBaUIsZ0JBQWdCLFlBQVksSUFBSSxJQUFJLGlDQUFpQyxDQUFDLENBQUM7QUFFdkksVUFBTSxRQUFRLHFCQUFxQixzQkFBc0IsMkJBQTJCLFNBQVM7QUFDN0YsVUFBTSxTQUFTLE1BQU0sU0FBUyx1QkFBdUIsT0FBTyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsd0JBQXdCO0FBQ3hHLFVBQU0sY0FBYyxNQUFNLGtCQUFrQixPQUFPLElBQUksU0FBUyxHQUFHLENBQUMsR0FBRyxRQUFRO0FBRS9FLFdBQU8sWUFBWSxPQUFPLFlBQVksUUFBUSxDQUFDO0FBQy9DLFVBQU0sQ0FBQyxLQUFLLElBQUksT0FBTztBQUN2QixXQUFPLFlBQWEsTUFBTSxNQUFjLE9BQU8sV0FBVyxDQUFDO0FBQzNELFdBQU8sWUFBYSxNQUFNLE1BQWMsUUFBUSxXQUFXLENBQUM7QUFFNUQsV0FBTyxZQUFZLFlBQVksTUFBTSxRQUFRLENBQUM7QUFDOUMsV0FBTyxZQUFZLFlBQVksTUFBTSxDQUFDLEVBQUUsY0FBYyxRQUFRLENBQUM7QUFDL0QsV0FBTyxZQUFZLFlBQVksTUFBTSxDQUFDLEVBQUUsZUFBZSxRQUFRLENBQUM7QUFFaEUsVUFBTSxRQUFRO0FBQUEsRUFDZixDQUFDO0FBRUQsT0FBSyxpRUFBaUUsaUJBQWtCO0FBQ3ZGLFVBQU0sK0JBQStCLFlBQVksSUFBSSxJQUFJLGlDQUFpQyxDQUFDO0FBQzNGLGdCQUFZLElBQUksNkJBQTZCLFNBQVMsV0FBVztBQUFBLE1BQ2hFLFVBQVU7QUFBQSxRQUNULENBQUMsS0FBSyxHQUFHO0FBQUEsUUFDVCxDQUFDLEtBQUssR0FBRztBQUFBLFFBQ1QsQ0FBQyxLQUFLLEdBQUc7QUFBQSxNQUNWO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFFRixxQkFBaUIsSUFBSSxxQkFBcUIsQ0FBQyxJQUFJO0FBQUEsTUFDOUM7QUFBQSxNQUNBLENBQUMsU0FBUztBQUFBLE1BQ1Y7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQSxjQUFjO0FBQUEsTUFDZCxhQUFhO0FBQUEsSUFDZCxDQUFDLENBQUM7QUFFRixVQUFNLFdBQVcsSUFBSSwwQkFBMEIsaUJBQWlCLGdCQUFnQiw0QkFBNEI7QUFFNUcsVUFBTSxRQUFRLHFCQUFxQixzQkFBc0IsU0FBUyxTQUFTO0FBQzNFLFVBQU0sU0FBUyxNQUFNLFNBQVMsdUJBQXVCLE9BQU8sSUFBSSxTQUFTLEdBQUcsQ0FBQyxHQUFHLHdCQUF3QjtBQUN4RyxVQUFNLGNBQWMsTUFBTSxrQkFBa0IsT0FBTyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsUUFBUTtBQUUvRSxXQUFPLFlBQVksT0FBTyxZQUFZLFFBQVEsQ0FBQztBQUMvQyxVQUFNLENBQUMsS0FBSyxJQUFJLE9BQU87QUFDdkIsV0FBTyxZQUFhLE1BQU0sTUFBYyxPQUFPLFdBQVcsQ0FBQztBQUUzRCxXQUFPLFlBQWEsTUFBTSxNQUFjLFFBQVEsV0FBVyxDQUFDO0FBRTVELFdBQU8sWUFBWSxZQUFZLE1BQU0sUUFBUSxDQUFDO0FBQzlDLFdBQU8sWUFBWSxZQUFZLE1BQU0sQ0FBQyxFQUFFLGNBQWMsUUFBUSxDQUFDO0FBQy9ELFdBQU8sWUFBWSxZQUFZLE1BQU0sQ0FBQyxFQUFFLGVBQWUsUUFBUSxDQUFDO0FBRWhFLFVBQU0sUUFBUTtBQUFBLEVBQ2YsQ0FBQztBQUVELE9BQUssZ0RBQWdELGlCQUFrQjtBQUV0RSxxQkFBaUIsSUFBSSxxQkFBcUIsQ0FBQyxJQUFJO0FBQUEsTUFDOUM7QUFBQSxNQUNBLENBQUMsU0FBUztBQUFBLE1BQ1Y7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQSxjQUFjO0FBQUEsTUFDZCxhQUFhO0FBQUEsSUFDZCxDQUFDLENBQUM7QUFFRixVQUFNLFdBQVcsSUFBSSwwQkFBMEIsaUJBQWlCLGdCQUFnQixZQUFZLElBQUksSUFBSSxpQ0FBaUMsQ0FBQyxDQUFDO0FBRXZJLFVBQU0sUUFBUSxxQkFBcUIsc0JBQXNCLE9BQU8sU0FBUztBQUN6RSxVQUFNLFNBQVMsTUFBTSxTQUFTLHVCQUF1QixPQUFPLElBQUksU0FBUyxHQUFHLENBQUMsR0FBRyx3QkFBd0I7QUFDeEcsVUFBTSxjQUFjLE1BQU0sa0JBQWtCLE9BQU8sSUFBSSxTQUFTLEdBQUcsQ0FBQyxHQUFHLFFBQVE7QUFFL0UsV0FBTyxZQUFZLE9BQU8sWUFBWSxRQUFRLENBQUM7QUFDL0MsVUFBTSxDQUFDLEtBQUssSUFBSSxPQUFPO0FBQ3ZCLFdBQU8sWUFBa0MsTUFBTSxNQUFPLE9BQU8sT0FBTztBQUNwRSxXQUFPLFlBQW1DLE1BQU0sTUFBTyxPQUFPLGFBQWEsQ0FBQztBQUU1RSxXQUFPLFlBQVksWUFBWSxNQUFNLFFBQVEsQ0FBQztBQUM5QyxXQUFPLFlBQVksWUFBWSxNQUFNLENBQUMsRUFBRSxXQUFXLE9BQU87QUFDMUQsV0FBTyxZQUFZLFlBQVksTUFBTSxDQUFDLEVBQUUsVUFBVSxRQUFRLENBQUM7QUFFM0QsVUFBTSxRQUFRO0FBQUEsRUFDZixDQUFDO0FBRUQsT0FBSywyRUFBMkUsaUJBQWtCO0FBRWpHLHFCQUFpQixJQUFJLHFCQUFxQjtBQUFBLE1BQ3pDLElBQUksUUFBUSxPQUFPLENBQUMsU0FBUyxHQUFHLE9BQU8sT0FBTyxJQUFJLFNBQVMsSUFBSSxjQUFjLE1BQU0sYUFBYSxDQUFDO0FBQUEsTUFDakcsSUFBSSxRQUFRLE9BQU8sQ0FBQyxTQUFTLEdBQUcsT0FBTyxPQUFPLElBQUksU0FBUyxJQUFJLGNBQWMsTUFBTSxhQUFhLENBQUM7QUFBQTtBQUFBLElBRWxHLENBQUM7QUFFRCxVQUFNLFdBQVcsSUFBSSwwQkFBMEIsaUJBQWlCLGdCQUFnQixZQUFZLElBQUksSUFBSSxpQ0FBaUMsQ0FBQyxDQUFDO0FBRXZJLFVBQU0sUUFBUSxxQkFBcUIsc0JBQXNCLE1BQVEsU0FBUztBQUMxRSxVQUFNLFNBQVMsTUFBTSxTQUFTO0FBQUEsTUFDN0I7QUFBQSxNQUNBLElBQUksU0FBUyxHQUFHLENBQUM7QUFBQSxNQUNqQixFQUFFLGFBQWEsc0JBQXNCLGtCQUFrQixrQkFBa0IsSUFBSztBQUFBLElBQy9FO0FBRUEsV0FBTyxZQUFZLE9BQU8sWUFBWSxRQUFRLENBQUM7QUFDL0MsVUFBTSxRQUFRO0FBQUEsRUFFZixDQUFDO0FBRUQsT0FBSyxvRkFBb0YsaUJBQWtCO0FBRTFHLHFCQUFpQixJQUFJLHFCQUFxQjtBQUFBLE1BQ3pDLElBQUksUUFBUSxPQUFPLENBQUMsU0FBUyxHQUFHLE9BQU8sT0FBTyxJQUFJLFNBQVMsSUFBSSxjQUFjLE1BQU0sYUFBYSxDQUFDO0FBQUEsTUFDakcsSUFBSSxRQUFRLE9BQU8sQ0FBQyxTQUFTLEdBQUcsT0FBTyxPQUFPLElBQUksU0FBUyxJQUFJLGNBQWMsTUFBTSxhQUFhLENBQUM7QUFBQSxNQUNqRyxJQUFJLFFBQVEsT0FBTyxDQUFDLFNBQVMsR0FBRyxRQUFTLFFBQVMsSUFBSSxTQUFTLElBQUksY0FBYyxNQUFNLGFBQWEsQ0FBQztBQUFBLElBQ3RHLENBQUM7QUFFRCxVQUFNLFdBQVcsSUFBSSwwQkFBMEIsaUJBQWlCLGdCQUFnQixZQUFZLElBQUksSUFBSSxpQ0FBaUMsQ0FBQyxDQUFDO0FBRXZJLFVBQU0sUUFBUSxxQkFBcUIsc0JBQXNCLE1BQVEsU0FBUztBQUUxRSxVQUFNLFNBQVMsTUFBTSxTQUFTO0FBQUEsTUFDN0I7QUFBQSxNQUNBLElBQUksU0FBUyxHQUFHLENBQUM7QUFBQSxNQUNqQixFQUFFLGFBQWEsc0JBQXNCLGtCQUFrQixrQkFBa0IsSUFBSztBQUFBLElBQy9FO0FBRUEsV0FBTyxZQUFZLE9BQU8sWUFBWSxRQUFRLENBQUM7QUFFL0MsVUFBTSxjQUFjLE1BQU0sa0JBQWtCLE9BQU8sSUFBSSxTQUFTLEdBQUcsQ0FBQyxHQUFHLFVBQVUsRUFBRSxhQUFhLHNCQUFzQixrQkFBa0Isa0JBQWtCLElBQUssQ0FBQztBQUNoSyxXQUFPLFlBQVksWUFBWSxNQUFNLFFBQVEsQ0FBQztBQUU5QyxVQUFNLFFBQVE7QUFBQSxFQUNmLENBQUM7QUFFRCxPQUFLLG9EQUFvRCxpQkFBa0I7QUFDMUUscUJBQWlCLElBQUkscUJBQXFCO0FBQUEsTUFDekMsSUFBSSxRQUFRLE9BQU8sQ0FBQyxTQUFTLEdBQUcsT0FBTyxPQUFPLElBQUksU0FBUyxJQUFJLGNBQWMsTUFBTSxhQUFhLENBQUM7QUFBQSxNQUNqRyxJQUFJLFFBQVEsT0FBTyxDQUFDLFNBQVMsR0FBRyxnQkFBZ0IsZ0JBQWdCLElBQUksU0FBUyxJQUFJLGNBQWMsTUFBTSxhQUFhLENBQUM7QUFBQSxNQUNuSCxJQUFJLFFBQVEsT0FBTyxDQUFDLFNBQVMsR0FBRyxNQUFNLE1BQU0sSUFBSSxTQUFTLElBQUksY0FBYyxNQUFNLGFBQWEsQ0FBQztBQUFBLElBQ2hHLENBQUM7QUFFRCxVQUFNLFdBQVcsSUFBSSwwQkFBMEIsaUJBQWlCLGdCQUFnQixZQUFZLElBQUksSUFBSSxpQ0FBaUMsQ0FBQyxDQUFDO0FBQ3ZJLFVBQU0sUUFBUSxxQkFBcUIsc0JBQXNCLFlBQWMsU0FBUztBQUVoRixVQUFNLFNBQVMsTUFBTSxTQUFTO0FBQUEsTUFDN0I7QUFBQSxNQUNBLElBQUksU0FBUyxHQUFHLENBQUM7QUFBQSxNQUNqQixFQUFFLGFBQWEsc0JBQXNCLE9BQU87QUFBQSxJQUM3QztBQUVBLFdBQU8sWUFBWSxPQUFPLFlBQVksUUFBUSxDQUFDO0FBQy9DLFdBQU8sWUFBZ0MsT0FBTyxZQUFZLENBQUMsRUFBRyxNQUFNLE9BQU8sY0FBYztBQUV6RixVQUFNLGNBQWMsTUFBTSxrQkFBa0IsT0FBTyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsVUFBVSxFQUFFLGFBQWEsc0JBQXNCLE9BQU8sQ0FBQztBQUM5SCxXQUFPLFlBQVksWUFBWSxNQUFNLFFBQVEsQ0FBQztBQUM5QyxXQUFPLFlBQVksWUFBWSxNQUFNLENBQUMsRUFBRSxXQUFXLGNBQWM7QUFFakUsVUFBTSxRQUFRO0FBQUEsRUFDZixDQUFDO0FBRUQsT0FBSyx1REFBdUQsaUJBQWtCO0FBQzdFLHFCQUFpQixJQUFJLHFCQUFxQjtBQUFBLE1BQ3pDLElBQUksUUFBUSxPQUFPLENBQUMsU0FBUyxHQUFHLE9BQU8sT0FBTyxJQUFJLFNBQVMsSUFBSSxjQUFjLE1BQU0sYUFBYSxDQUFDO0FBQUEsTUFDakcsSUFBSSxRQUFRLE9BQU8sQ0FBQyxTQUFTLEdBQUcsS0FBSyxLQUFLLElBQUksU0FBUyxJQUFJLGNBQWMsTUFBTSxhQUFhLENBQUM7QUFBQSxNQUM3RixJQUFJLFFBQVEsT0FBTyxDQUFDLFNBQVMsR0FBRyxNQUFNLE1BQU0sSUFBSSxTQUFTLElBQUksY0FBYyxNQUFNLGFBQWEsQ0FBQztBQUFBLElBQ2hHLENBQUM7QUFFRCxVQUFNLFdBQVcsSUFBSSwwQkFBMEIsaUJBQWlCLGdCQUFnQixZQUFZLElBQUksSUFBSSxpQ0FBaUMsQ0FBQyxDQUFDO0FBQ3ZJLFVBQU0sUUFBUSxxQkFBcUIsc0JBQXNCLFFBQVEsU0FBUztBQUUxRSxVQUFNLFNBQVMsTUFBTSxTQUFTO0FBQUEsTUFDN0I7QUFBQSxNQUNBLElBQUksU0FBUyxHQUFHLENBQUM7QUFBQSxNQUNqQixFQUFFLGFBQWEsc0JBQXNCLE9BQU87QUFBQSxJQUM3QztBQUVBLFdBQU8sWUFBWSxPQUFPLFlBQVksUUFBUSxDQUFDO0FBQy9DLFdBQU8sWUFBZ0MsT0FBTyxZQUFZLENBQUMsRUFBRyxNQUFNLE9BQU8sSUFBSTtBQUcvRSxVQUFNLGNBQWMsTUFBTSxrQkFBa0IsT0FBTyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsVUFBVSxFQUFFLGFBQWEsc0JBQXNCLE9BQU8sQ0FBQztBQUM5SCxXQUFPLFlBQVksWUFBWSxNQUFNLFFBQVEsQ0FBQztBQUM5QyxXQUFPLFlBQVksWUFBWSxNQUFNLENBQUMsRUFBRSxXQUFXLElBQUk7QUFFdkQsVUFBTSxRQUFRO0FBQUEsRUFDZixDQUFDO0FBRUQsT0FBSyx5REFBeUQsaUJBQWtCO0FBQy9FLHFCQUFpQixJQUFJLHFCQUFxQjtBQUFBLE1BQ3pDLElBQUksUUFBUSxPQUFPLENBQUMsU0FBUyxHQUFHLHdCQUF3Qix3QkFBd0IsSUFBSSxTQUFTLElBQUksY0FBYyxNQUFNLGFBQWEsQ0FBQztBQUFBLE1BQ25JLElBQUksUUFBUSxPQUFPLENBQUMsU0FBUyxHQUFHLGVBQWUsZUFBZSxJQUFJLFNBQVMsSUFBSSxjQUFjLE1BQU0sYUFBYSxDQUFDO0FBQUEsSUFDbEgsQ0FBQztBQUVELFVBQU0sV0FBVyxJQUFJLDBCQUEwQixpQkFBaUIsZ0JBQWdCLFlBQVksSUFBSSxJQUFJLGlDQUFpQyxDQUFDLENBQUM7QUFDdkksVUFBTSxRQUFRLHFCQUFxQixzQkFBc0IsVUFBVSxTQUFTO0FBRTVFLFVBQU0sU0FBUyxNQUFNLFNBQVM7QUFBQSxNQUM3QjtBQUFBLE1BQ0EsSUFBSSxTQUFTLEdBQUcsQ0FBQztBQUFBLE1BQ2pCLEVBQUUsYUFBYSxzQkFBc0IsT0FBTztBQUFBLElBQzdDO0FBRUEsV0FBTyxZQUFZLE9BQU8sWUFBWSxRQUFRLENBQUM7QUFDL0MsV0FBTyxZQUFnQyxPQUFPLFlBQVksQ0FBQyxFQUFHLE1BQU0sT0FBTyxhQUFhO0FBRXhGLFVBQU0sY0FBYyxNQUFNLGtCQUFrQixPQUFPLElBQUksU0FBUyxHQUFHLENBQUMsR0FBRyxVQUFVLEVBQUUsYUFBYSxzQkFBc0IsT0FBTyxDQUFDO0FBQzlILFdBQU8sWUFBWSxZQUFZLE1BQU0sUUFBUSxDQUFDO0FBQzlDLFdBQU8sWUFBWSxZQUFZLE1BQU0sQ0FBQyxFQUFFLFdBQVcsYUFBYTtBQUNoRSxVQUFNLFFBQVE7QUFBQSxFQUNmLENBQUM7QUFFRCxPQUFLLHFFQUFxRSxpQkFBa0I7QUFDM0YscUJBQWlCLElBQUkscUJBQXFCO0FBQUEsTUFDekMsSUFBSSxRQUFRLE9BQU8sQ0FBQyxTQUFTLEdBQUcsT0FBTyxXQUFXLElBQUksU0FBUyxJQUFJLGNBQWMsTUFBTSxhQUFhLENBQUM7QUFBQSxJQUN0RyxDQUFDO0FBR0QsVUFBTSxXQUFXLElBQUksMEJBQTBCLGlCQUFpQixnQkFBZ0IsWUFBWSxJQUFJLElBQUksaUNBQWlDLENBQUMsQ0FBQztBQUN2SSxVQUFNLFFBQVEscUJBQXFCLHNCQUFzQixtQkFBbUIsU0FBUztBQUNyRixVQUFNLFNBQVMsTUFBTSxTQUFTO0FBQUEsTUFDN0I7QUFBQSxNQUNBLElBQUksU0FBUyxHQUFHLEVBQUU7QUFBQSxNQUNsQixFQUFFLGFBQWEsc0JBQXNCLE9BQU87QUFBQSxJQUM3QztBQUVBLFdBQU8sWUFBWSxPQUFPLFlBQVksUUFBUSxDQUFDO0FBQy9DLFVBQU0sUUFBUTtBQUFBLEVBQ2YsQ0FBQztBQUVELE9BQUssS0FBSyx5Q0FBeUMsaUJBQWtCO0FBQ3BFLHFCQUFpQixJQUFJLHFCQUFxQjtBQUFBLE1BQ3pDLElBQUksUUFBUSxPQUFPLENBQUMsU0FBUyxHQUFHLE9BQU8sT0FBTyxJQUFJLE9BQU8sSUFBSSxjQUFjLE1BQU0sYUFBYSxDQUFDO0FBQUEsTUFDL0YsSUFBSSxRQUFRLE9BQU8sQ0FBQyxTQUFTLEdBQUcsUUFBUSxRQUFRLElBQUksUUFBUSxJQUFJLGNBQWMsTUFBTSxhQUFhLENBQUM7QUFBQSxNQUNsRyxJQUFJLFFBQVEsT0FBTyxDQUFDLFNBQVMsR0FBRyxRQUFRLFFBQVEsSUFBSSxRQUFRLElBQUksY0FBYyxNQUFNLGFBQWEsQ0FBQztBQUFBLElBQ25HLENBQUM7QUFFRCxVQUFNLFdBQVcsSUFBSSwwQkFBMEIsaUJBQWlCLGdCQUFnQixZQUFZLElBQUksSUFBSSxpQ0FBaUMsQ0FBQyxDQUFDO0FBQ3ZJLFVBQU0sUUFBUSxxQkFBcUIsc0JBQXNCLE1BQU0sU0FBUztBQUN4RSxVQUFNLFNBQVMsTUFBTSxTQUFTO0FBQUEsTUFDN0I7QUFBQSxNQUNBLElBQUksU0FBUyxHQUFHLENBQUM7QUFBQSxNQUNqQixFQUFFLGFBQWEsc0JBQXNCLE9BQU87QUFBQSxJQUM3QztBQUVBLFdBQU8sWUFBWSxPQUFPLFlBQVksUUFBUSxDQUFDO0FBRy9DLFVBQU0sV0FBVyxDQUFDLGNBQWMsT0FBTyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFDaEUsV0FBTyxZQUFZLE1BQU0sU0FBUyxHQUFHLEtBQUs7QUFDMUMsVUFBTSxVQUFVLE1BQU0sU0FBUztBQUFBLE1BQzlCO0FBQUEsTUFDQSxJQUFJLFNBQVMsR0FBRyxDQUFDO0FBQUEsTUFDakIsRUFBRSxhQUFhLHNCQUFzQixrQkFBa0Isa0JBQWtCLElBQUk7QUFBQSxJQUM5RTtBQUVBLFdBQU8sWUFBWSxRQUFRLFlBQVksUUFBUSxDQUFDO0FBQ2hELFdBQU8sWUFBWSxRQUFRLFlBQVksQ0FBQyxFQUFFLFlBQVksTUFBTTtBQUU1RCxVQUFNLFFBQVE7QUFBQSxFQUNmLENBQUM7QUFFRCxPQUFLLHVEQUF1RCxpQkFBa0I7QUFDN0UscUJBQWlCLElBQUkscUJBQXFCO0FBQUEsTUFDekMsSUFBSSxRQUFRLE9BQU8sQ0FBQyxTQUFTLEdBQUcsT0FBTyxZQUFZLElBQUksT0FBTyxJQUFJLGNBQWMsTUFBTSxhQUFhLENBQUM7QUFBQSxJQUNyRyxDQUFDO0FBQ0QsVUFBTSxRQUFRLFlBQVksSUFBSSxxQkFBcUIsc0JBQXNCLFdBQVcsU0FBUyxDQUFDO0FBQzlGLFVBQU0sV0FBVyxJQUFJLDBCQUEwQixpQkFBaUIsZ0JBQWdCLFlBQVksSUFBSSxJQUFJLGlDQUFpQyxDQUFDLENBQUM7QUFDdkksVUFBTSxTQUFTLE1BQU0sU0FBUztBQUFBLE1BQzdCO0FBQUEsTUFDQSxJQUFJLFNBQVMsR0FBRyxDQUFDO0FBQUEsTUFDakIsRUFBRSxhQUFhLHNCQUFzQixPQUFPO0FBQUEsSUFDN0M7QUFFQSxXQUFPLFlBQVksT0FBTyxZQUFZLFFBQVEsQ0FBQztBQUMvQyxVQUFNLFFBQVEsT0FBTyxZQUFZLENBQUM7QUFDbEMsV0FBTyxZQUFtQyxNQUFNLE1BQU8sT0FBTyxhQUFhLENBQUM7QUFFNUUsVUFBTSxjQUFjLE1BQU0sa0JBQWtCLE9BQU8sSUFBSSxTQUFTLEdBQUcsQ0FBQyxHQUFHLFFBQVE7QUFDL0UsV0FBTyxZQUFZLFlBQVksTUFBTSxRQUFRLENBQUM7QUFDOUMsV0FBTyxZQUFZLFlBQVksTUFBTSxDQUFDLEVBQUUsVUFBVSxRQUFRLENBQUM7QUFBQSxFQUM1RCxDQUFDO0FBRUQsT0FBSyx1R0FBdUcsaUJBQWtCO0FBQzdILHFCQUFpQixJQUFJLHFCQUFxQjtBQUFBLE1BQ3pDLElBQUksUUFBUSxPQUFPLENBQUMsU0FBUyxHQUFHLGNBQWMsY0FBYyxJQUFJLE9BQU8sSUFBSSxjQUFjLE1BQU0sYUFBYSxDQUFDO0FBQUEsTUFDN0csSUFBSSxRQUFRLE9BQU8sQ0FBQyxTQUFTLEdBQUcscUJBQXFCLHFCQUFxQixJQUFJLE9BQU8sSUFBSSxjQUFjLE1BQU0sYUFBYSxDQUFDO0FBQUEsSUFDNUgsQ0FBQztBQUVELFVBQU0sV0FBVyxJQUFJLDBCQUEwQixpQkFBaUIsZ0JBQWdCLFlBQVksSUFBSSxJQUFJLGlDQUFpQyxDQUFDLENBQUM7QUFDdkksVUFBTSxRQUFRLFlBQVksSUFBSSxxQkFBcUIsc0JBQXNCLElBQUksU0FBUyxDQUFDO0FBRXZGO0FBQ0MsWUFBTSxTQUFTLEdBQUc7QUFDbEIsWUFBTSxVQUFVLE1BQU0sU0FBUztBQUFBLFFBQzlCO0FBQUEsUUFDQSxJQUFJLFNBQVMsR0FBRyxDQUFDO0FBQUEsUUFDakIsRUFBRSxhQUFhLHNCQUFzQixPQUFPO0FBQUEsTUFDN0M7QUFDQSxhQUFPLFlBQVksUUFBUSxZQUFZLENBQUMsRUFBRSxZQUFZLEtBQUs7QUFDM0QsYUFBTyxZQUFZLFFBQVEsWUFBWSxRQUFRLENBQUM7QUFBQSxJQUNqRDtBQUVBO0FBQ0MsWUFBTSxTQUFTLE9BQU87QUFDdEIsWUFBTSxVQUFVLE1BQU0sU0FBUztBQUFBLFFBQzlCO0FBQUEsUUFDQSxJQUFJLFNBQVMsR0FBRyxDQUFDO0FBQUEsUUFDakIsRUFBRSxhQUFhLHNCQUFzQixPQUFPO0FBQUEsTUFDN0M7QUFDQSxhQUFPLFlBQVksUUFBUSxZQUFZLENBQUMsRUFBRSxZQUFZLEtBQUs7QUFDM0QsYUFBTyxZQUFZLFFBQVEsWUFBWSxRQUFRLENBQUM7QUFBQSxJQUNqRDtBQUFBLEVBQ0QsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbImZpcnN0IiwgInNlY29uZCJdCn0K
