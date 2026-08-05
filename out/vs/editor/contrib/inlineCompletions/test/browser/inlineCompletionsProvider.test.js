import assert from "assert";
import { timeout } from "../../../../../base/common/async.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { runWithFakedTimers } from "../../../../../base/test/common/timeTravelScheduler.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { Range } from "../../../../common/core/range.js";
import { ILanguageFeaturesService } from "../../../../common/services/languageFeatures.js";
import { LanguageFeaturesService } from "../../../../common/services/languageFeaturesService.js";
import { InlineCompletionsController } from "../../browser/controller/inlineCompletionsController.js";
import { SingleTextEdit } from "../../../../common/core/textEdit.js";
import { GhostTextContext, MockInlineCompletionsProvider } from "./utils.js";
import { withAsyncTestCodeEditor } from "../../../../test/browser/testCodeEditor.js";
import { createTextModel } from "../../../../test/common/testTextModel.js";
import { IAccessibilitySignalService } from "../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { Selection } from "../../../../common/core/selection.js";
import { computeGhostText } from "../../browser/model/computeGhostText.js";
suite("Inline Completions", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  suite("inlineCompletionToGhostText", () => {
    function getOutput(text, suggestion) {
      const rangeStartOffset = text.indexOf("[");
      const rangeEndOffset = text.indexOf("]") - 1;
      const cleanedText = text.replace("[", "").replace("]", "");
      const tempModel = createTextModel(cleanedText);
      const range = Range.fromPositions(tempModel.getPositionAt(rangeStartOffset), tempModel.getPositionAt(rangeEndOffset));
      const options = ["prefix", "subword"];
      const result = {};
      for (const option of options) {
        result[option] = computeGhostText(new SingleTextEdit(range, suggestion), tempModel, option)?.render(cleanedText, true);
      }
      tempModel.dispose();
      if (new Set(Object.values(result)).size === 1) {
        return Object.values(result)[0];
      }
      return result;
    }
    test("Basic", () => {
      assert.deepStrictEqual(getOutput("[foo]baz", "foobar"), "foo[bar]baz");
      assert.deepStrictEqual(getOutput("[aaa]aaa", "aaaaaa"), "aaa[aaa]aaa");
      assert.deepStrictEqual(getOutput("[foo]baz", "boobar"), void 0);
      assert.deepStrictEqual(getOutput("[foo]foo", "foofoo"), "foo[foo]foo");
      assert.deepStrictEqual(getOutput("foo[]", "bar\nhello"), "foo[bar\nhello]");
    });
    test("Empty ghost text", () => {
      assert.deepStrictEqual(getOutput("[foo]", "foo"), "foo");
    });
    test("Whitespace (indentation)", () => {
      assert.deepStrictEqual(getOutput("[ foo]", "foobar"), " foo[bar]");
      assert.deepStrictEqual(getOutput("[	foo]", "foobar"), "	foo[bar]");
      assert.deepStrictEqual(getOutput("[	 foo]", "	foobar"), "	 foo[bar]");
      assert.deepStrictEqual(getOutput("[	foo]", "		foobar"), { prefix: void 0, subword: "	[	]foo[bar]" });
      assert.deepStrictEqual(getOutput("[	]", "		foobar"), "	[	foobar]");
      assert.deepStrictEqual(getOutput("	[]", "	"), "	[	]");
      assert.deepStrictEqual(getOutput("	[	]", ""), "		");
      assert.deepStrictEqual(getOutput("[ ]", "return 1"), " [return 1]");
    });
    test("Whitespace (outside of indentation)", () => {
      assert.deepStrictEqual(getOutput("bar[ foo]", "foobar"), void 0);
      assert.deepStrictEqual(getOutput("bar[	foo]", "foobar"), void 0);
    });
    test("Unsupported Case", () => {
      assert.deepStrictEqual(getOutput("fo[o\n]", "x\nbar"), void 0);
    });
    test("New Line", () => {
      assert.deepStrictEqual(getOutput("fo[o\n]", "o\nbar"), "foo\n[bar]");
    });
    test("Multi Part Diffing", () => {
      assert.deepStrictEqual(getOutput("foo[()]", "(x);"), { prefix: void 0, subword: "foo([x])[;]" });
      assert.deepStrictEqual(getOutput("[	foo]", "		foobar"), { prefix: void 0, subword: "	[	]foo[bar]" });
      assert.deepStrictEqual(getOutput("[(y ===)]", "(y === 1) { f(); }"), { prefix: void 0, subword: "(y ===[ 1])[ { f(); }]" });
      assert.deepStrictEqual(getOutput("[(y ==)]", "(y === 1) { f(); }"), { prefix: void 0, subword: "(y ==[= 1])[ { f(); }]" });
      assert.deepStrictEqual(getOutput("[(y ==)]", "(y === 1) { f(); }"), { prefix: void 0, subword: "(y ==[= 1])[ { f(); }]" });
    });
    test("Multi Part Diffing 1", () => {
      assert.deepStrictEqual(getOutput("[if () ()]", "if (1 == f()) ()"), { prefix: void 0, subword: "if ([1 == f()]) ()" });
    });
    test("Multi Part Diffing 2", () => {
      assert.deepStrictEqual(getOutput("[)]", "())"), { prefix: void 0, subword: "[(])[)]" });
      assert.deepStrictEqual(getOutput("[))]", "(())"), { prefix: void 0, subword: "[((]))" });
    });
    test("Parenthesis Matching", () => {
      assert.deepStrictEqual(getOutput("[console.log()]", 'console.log({ label: "(" })'), {
        prefix: void 0,
        subword: 'console.log([{ label: "(" }])'
      });
    });
  });
  test("Does not trigger automatically if disabled", async function() {
    const provider = new MockInlineCompletionsProvider();
    await withAsyncTestCodeEditorAndInlineCompletionsModel(
      "",
      { fakeClock: true, provider, inlineSuggest: { enabled: false } },
      async ({ editor, editorViewModel, model, context }) => {
        context.keyboardType("foo");
        await timeout(1e3);
        assert.deepStrictEqual(provider.getAndClearCallHistory(), []);
        assert.deepStrictEqual(context.getAndClearViewStates(), [""]);
      }
    );
  });
  test("Ghost text is shown after trigger", async function() {
    const provider = new MockInlineCompletionsProvider();
    await withAsyncTestCodeEditorAndInlineCompletionsModel(
      "",
      { fakeClock: true, provider },
      async ({ editor, editorViewModel, model, context }) => {
        context.keyboardType("foo");
        provider.setReturnValue({ insertText: "foobar", range: new Range(1, 1, 1, 4) });
        model.triggerExplicitly();
        await timeout(1e3);
        assert.deepStrictEqual(provider.getAndClearCallHistory(), [
          { position: "(1,4)", text: "foo", triggerKind: 1 }
        ]);
        assert.deepStrictEqual(context.getAndClearViewStates(), ["", "foo[bar]"]);
      }
    );
  });
  test("Ghost text is shown automatically when configured", async function() {
    const provider = new MockInlineCompletionsProvider();
    await withAsyncTestCodeEditorAndInlineCompletionsModel(
      "",
      { fakeClock: true, provider, inlineSuggest: { enabled: true } },
      async ({ editor, editorViewModel, model, context }) => {
        context.keyboardType("foo");
        provider.setReturnValue({ insertText: "foobar", range: new Range(1, 1, 1, 4) });
        await timeout(1e3);
        assert.deepStrictEqual(provider.getAndClearCallHistory(), [
          { position: "(1,4)", text: "foo", triggerKind: 0 }
        ]);
        assert.deepStrictEqual(context.getAndClearViewStates(), ["", "foo[bar]"]);
      }
    );
  });
  test("Ghost text is updated automatically", async function() {
    const provider = new MockInlineCompletionsProvider();
    await withAsyncTestCodeEditorAndInlineCompletionsModel(
      "",
      { fakeClock: true, provider },
      async ({ editor, editorViewModel, model, context }) => {
        provider.setReturnValue({ insertText: "foobar", range: new Range(1, 1, 1, 4) });
        context.keyboardType("foo");
        model.triggerExplicitly();
        await timeout(1e3);
        provider.setReturnValue({ insertText: "foobizz", range: new Range(1, 1, 1, 6) });
        context.keyboardType("b");
        context.keyboardType("i");
        await timeout(1e3);
        assert.deepStrictEqual(provider.getAndClearCallHistory(), [
          { position: "(1,4)", text: "foo", triggerKind: 1 },
          { position: "(1,6)", text: "foobi", triggerKind: 0 }
        ]);
        assert.deepStrictEqual(
          context.getAndClearViewStates(),
          ["", "foo[bar]", "foob[ar]", "foobi", "foobi[zz]"]
        );
      }
    );
  });
  test("Unindent whitespace", async function() {
    const provider = new MockInlineCompletionsProvider();
    await withAsyncTestCodeEditorAndInlineCompletionsModel(
      "",
      { fakeClock: true, provider },
      async ({ editor, editorViewModel, model, context }) => {
        context.keyboardType("  ");
        provider.setReturnValue({ insertText: "foo", range: new Range(1, 2, 1, 3) });
        model.triggerExplicitly();
        await timeout(1e3);
        assert.deepStrictEqual(context.getAndClearViewStates(), ["", "  [foo]"]);
        model.accept(editor);
        assert.deepStrictEqual(provider.getAndClearCallHistory(), [
          { position: "(1,3)", text: "  ", triggerKind: 1 }
        ]);
        assert.deepStrictEqual(context.getAndClearViewStates(), [" foo"]);
      }
    );
  });
  test("Unindent tab", async function() {
    const provider = new MockInlineCompletionsProvider();
    await withAsyncTestCodeEditorAndInlineCompletionsModel(
      "",
      { fakeClock: true, provider },
      async ({ editor, editorViewModel, model, context }) => {
        context.keyboardType("		");
        provider.setReturnValue({ insertText: "foo", range: new Range(1, 2, 1, 3) });
        model.triggerExplicitly();
        await timeout(1e3);
        assert.deepStrictEqual(context.getAndClearViewStates(), ["", "		[foo]"]);
        model.accept(editor);
        assert.deepStrictEqual(provider.getAndClearCallHistory(), [
          { position: "(1,3)", text: "		", triggerKind: 1 }
        ]);
        assert.deepStrictEqual(context.getAndClearViewStates(), ["	foo"]);
      }
    );
  });
  test("No unindent after indentation", async function() {
    const provider = new MockInlineCompletionsProvider();
    await withAsyncTestCodeEditorAndInlineCompletionsModel(
      "",
      { fakeClock: true, provider },
      async ({ editor, editorViewModel, model, context }) => {
        context.keyboardType("buzz  ");
        provider.setReturnValue({ insertText: "foo", range: new Range(1, 6, 1, 7) });
        model.triggerExplicitly();
        await timeout(1e3);
        assert.deepStrictEqual(context.getAndClearViewStates(), [""]);
        model.accept(editor);
        assert.deepStrictEqual(provider.getAndClearCallHistory(), [
          { position: "(1,7)", text: "buzz  ", triggerKind: 1 }
        ]);
        assert.deepStrictEqual(context.getAndClearViewStates(), []);
      }
    );
  });
  test("Next/previous", async function() {
    const provider = new MockInlineCompletionsProvider();
    await withAsyncTestCodeEditorAndInlineCompletionsModel(
      "",
      { fakeClock: true, provider },
      async ({ editor, editorViewModel, model, context }) => {
        context.keyboardType("foo");
        provider.setReturnValue({ insertText: "foobar1", range: new Range(1, 1, 1, 4) });
        model.trigger();
        await timeout(1e3);
        assert.deepStrictEqual(
          context.getAndClearViewStates(),
          ["", "foo[bar1]"]
        );
        provider.setReturnValues([
          { insertText: "foobar1", range: new Range(1, 1, 1, 4) },
          { insertText: "foobizz2", range: new Range(1, 1, 1, 4) },
          { insertText: "foobuzz3", range: new Range(1, 1, 1, 4) }
        ]);
        model.next();
        await timeout(1e3);
        assert.deepStrictEqual(context.getAndClearViewStates(), ["foo[bizz2]"]);
        model.next();
        await timeout(1e3);
        assert.deepStrictEqual(context.getAndClearViewStates(), ["foo[buzz3]"]);
        model.next();
        await timeout(1e3);
        assert.deepStrictEqual(context.getAndClearViewStates(), ["foo[bar1]"]);
        model.previous();
        await timeout(1e3);
        assert.deepStrictEqual(context.getAndClearViewStates(), ["foo[buzz3]"]);
        model.previous();
        await timeout(1e3);
        assert.deepStrictEqual(context.getAndClearViewStates(), ["foo[bizz2]"]);
        model.previous();
        await timeout(1e3);
        assert.deepStrictEqual(context.getAndClearViewStates(), ["foo[bar1]"]);
        assert.deepStrictEqual(provider.getAndClearCallHistory(), [
          { position: "(1,4)", text: "foo", triggerKind: 0 },
          { position: "(1,4)", text: "foo", triggerKind: 1 }
        ]);
      }
    );
  });
  test("Calling the provider is debounced", async function() {
    const provider = new MockInlineCompletionsProvider();
    await withAsyncTestCodeEditorAndInlineCompletionsModel(
      "",
      { fakeClock: true, provider },
      async ({ editor, editorViewModel, model, context }) => {
        model.trigger();
        context.keyboardType("f");
        await timeout(40);
        context.keyboardType("o");
        await timeout(40);
        context.keyboardType("o");
        await timeout(40);
        assert.deepStrictEqual(provider.getAndClearCallHistory(), []);
        await timeout(400);
        assert.deepStrictEqual(provider.getAndClearCallHistory(), [
          { position: "(1,4)", text: "foo", triggerKind: 0 }
        ]);
        provider.assertNotCalledTwiceWithin50ms();
      }
    );
  });
  test("Backspace is debounced", async function() {
    const provider = new MockInlineCompletionsProvider();
    await withAsyncTestCodeEditorAndInlineCompletionsModel(
      "",
      { fakeClock: true, provider, inlineSuggest: { enabled: true } },
      async ({ editor, editorViewModel, model, context }) => {
        context.keyboardType("foo");
        provider.setReturnValue({ insertText: "foobar", range: new Range(1, 1, 1, 4) });
        await timeout(1e3);
        for (let j = 0; j < 2; j++) {
          for (let i = 0; i < 3; i++) {
            context.leftDelete();
            await timeout(5);
          }
          context.keyboardType("bar");
        }
        await timeout(400);
        provider.assertNotCalledTwiceWithin50ms();
      }
    );
  });
  test("Forward stability", async function() {
    const provider = new MockInlineCompletionsProvider();
    await withAsyncTestCodeEditorAndInlineCompletionsModel(
      "",
      { fakeClock: true, provider },
      async ({ editor, editorViewModel, model, context }) => {
        provider.setReturnValue({ insertText: "foobar", range: new Range(1, 1, 1, 4) });
        context.keyboardType("foo");
        model.trigger();
        await timeout(1e3);
        assert.deepStrictEqual(provider.getAndClearCallHistory(), [
          { position: "(1,4)", text: "foo", triggerKind: 0 }
        ]);
        assert.deepStrictEqual(context.getAndClearViewStates(), ["", "foo[bar]"]);
        provider.setReturnValue({ insertText: "foobar", range: new Range(1, 1, 1, 5) });
        context.keyboardType("b");
        assert.deepStrictEqual(context.currentPrettyViewState, "foob[ar]");
        await timeout(1e3);
        assert.deepStrictEqual(provider.getAndClearCallHistory(), [
          { position: "(1,5)", text: "foob", triggerKind: 0 }
        ]);
        assert.deepStrictEqual(context.getAndClearViewStates(), ["foob[ar]"]);
        provider.setReturnValue({ insertText: "foobar", range: new Range(1, 1, 1, 6) });
        context.keyboardType("a");
        assert.deepStrictEqual(context.currentPrettyViewState, "fooba[r]");
        await timeout(1e3);
        assert.deepStrictEqual(provider.getAndClearCallHistory(), [
          { position: "(1,6)", text: "fooba", triggerKind: 0 }
        ]);
        assert.deepStrictEqual(context.getAndClearViewStates(), ["fooba[r]"]);
      }
    );
  });
  test("Support forward instability", async function() {
    const provider = new MockInlineCompletionsProvider();
    await withAsyncTestCodeEditorAndInlineCompletionsModel(
      "",
      { fakeClock: true, provider },
      async ({ editor, editorViewModel, model, context }) => {
        provider.setReturnValue({ insertText: "foobar", range: new Range(1, 1, 1, 4) });
        context.keyboardType("foo");
        model.triggerExplicitly();
        await timeout(100);
        assert.deepStrictEqual(provider.getAndClearCallHistory(), [
          { position: "(1,4)", text: "foo", triggerKind: 1 }
        ]);
        assert.deepStrictEqual(context.getAndClearViewStates(), ["", "foo[bar]"]);
        provider.setReturnValue({ insertText: "foobaz", range: new Range(1, 1, 1, 5) });
        context.keyboardType("b");
        assert.deepStrictEqual(context.currentPrettyViewState, "foob[ar]");
        await timeout(100);
        assert.deepStrictEqual(provider.getAndClearCallHistory(), [
          { position: "(1,5)", text: "foob", triggerKind: 0 }
        ]);
        assert.deepStrictEqual(context.getAndClearViewStates(), ["foob[ar]", "foob[az]"]);
      }
    );
  });
  test("Support backward instability", async function() {
    const provider = new MockInlineCompletionsProvider();
    await withAsyncTestCodeEditorAndInlineCompletionsModel(
      "",
      { fakeClock: true, provider },
      async ({ editor, editorViewModel, model, context }) => {
        context.keyboardType("fooba");
        provider.setReturnValue({ insertText: "foobar", range: new Range(1, 1, 1, 6) });
        model.triggerExplicitly();
        await timeout(1e3);
        assert.deepStrictEqual(provider.getAndClearCallHistory(), [
          { position: "(1,6)", text: "fooba", triggerKind: 1 }
        ]);
        assert.deepStrictEqual(context.getAndClearViewStates(), ["", "fooba[r]"]);
        provider.setReturnValue({ insertText: "foobaz", range: new Range(1, 1, 1, 5) });
        context.leftDelete();
        await timeout(1e3);
        assert.deepStrictEqual(provider.getAndClearCallHistory(), [
          { position: "(1,5)", text: "foob", triggerKind: 0 }
        ]);
        assert.deepStrictEqual(context.getAndClearViewStates(), [
          "foob[ar]",
          "foob[az]"
        ]);
      }
    );
  });
  test("No race conditions", async function() {
    const provider = new MockInlineCompletionsProvider();
    await withAsyncTestCodeEditorAndInlineCompletionsModel(
      "",
      { fakeClock: true, provider },
      async ({ editor, editorViewModel, model, context }) => {
        context.keyboardType("h");
        provider.setReturnValue({ insertText: "helloworld", range: new Range(1, 1, 1, 2) }, 1e3);
        model.triggerExplicitly();
        await timeout(1030);
        context.keyboardType("ello");
        provider.setReturnValue({ insertText: "helloworld", range: new Range(1, 1, 1, 6) }, 1e3);
        await timeout(2e3);
        assert.deepStrictEqual(context.getAndClearViewStates(), [
          "",
          "hello[world]"
        ]);
      }
    );
  });
  test("Do not reuse cache from previous session (#132516)", async function() {
    const provider = new MockInlineCompletionsProvider();
    await withAsyncTestCodeEditorAndInlineCompletionsModel(
      "",
      { fakeClock: true, provider, inlineSuggest: { enabled: true } },
      async ({ editor, editorViewModel, model, context }) => {
        context.keyboardType("hello\n");
        context.cursorLeft();
        context.keyboardType("x");
        context.leftDelete();
        provider.setReturnValue({ insertText: "helloworld", range: new Range(1, 1, 1, 6) }, 1e3);
        await timeout(2e3);
        assert.deepStrictEqual(provider.getAndClearCallHistory(), [
          {
            position: "(1,6)",
            text: "hello\n",
            triggerKind: 0
          }
        ]);
        provider.setReturnValue({ insertText: "helloworld", range: new Range(2, 1, 2, 6) }, 1e3);
        context.cursorDown();
        context.keyboardType("hello");
        await timeout(40);
        assert.deepStrictEqual(provider.getAndClearCallHistory(), []);
        context.keyboardType("w");
        context.leftDelete();
        await timeout(2e3);
        assert.deepStrictEqual(provider.getAndClearCallHistory(), [
          { position: "(2,6)", triggerKind: 0, text: "hello\nhello" }
        ]);
        assert.deepStrictEqual(context.getAndClearViewStates(), [
          "",
          "hello[world]\n",
          "hello\n",
          "hello\nhello[world]"
        ]);
      }
    );
  });
  test("Additional Text Edits", async function() {
    const provider = new MockInlineCompletionsProvider();
    await withAsyncTestCodeEditorAndInlineCompletionsModel(
      "",
      { fakeClock: true, provider },
      async ({ editor, editorViewModel, model, context }) => {
        context.keyboardType("buzz\nbaz");
        provider.setReturnValue({
          insertText: "bazz",
          range: new Range(2, 1, 2, 4),
          additionalTextEdits: [{
            range: new Range(1, 1, 1, 5),
            text: "bla"
          }]
        });
        model.triggerExplicitly();
        await timeout(1e3);
        model.accept(editor);
        assert.deepStrictEqual(provider.getAndClearCallHistory(), [{ position: "(2,4)", triggerKind: 1, text: "buzz\nbaz" }]);
        assert.deepStrictEqual(context.getAndClearViewStates(), [
          "",
          "buzz\nbaz[z]",
          "bla\nbazz"
        ]);
      }
    );
  });
  suite("inlineCompletionMultiCursor", () => {
    test("Basic", async function() {
      const provider = new MockInlineCompletionsProvider();
      await withAsyncTestCodeEditorAndInlineCompletionsModel(
        "",
        { fakeClock: true, provider },
        async ({ editor, editorViewModel, model, context }) => {
          context.keyboardType("console\nconsole\n");
          editor.setSelections([
            new Selection(1, 1e3, 1, 1e3),
            new Selection(2, 1e3, 2, 1e3)
          ]);
          provider.setReturnValue({
            insertText: 'console.log("hello");',
            range: new Range(1, 1, 1, 1e3)
          });
          model.triggerExplicitly();
          await timeout(1e3);
          model.accept(editor);
          assert.deepStrictEqual(
            editor.getValue(),
            [
              `console.log("hello");`,
              `console.log("hello");`,
              ``
            ].join("\n")
          );
        }
      );
    });
    test("Multi Part", async function() {
      const provider = new MockInlineCompletionsProvider();
      await withAsyncTestCodeEditorAndInlineCompletionsModel(
        "",
        { fakeClock: true, provider },
        async ({ editor, editorViewModel, model, context }) => {
          context.keyboardType("console.log()\nconsole.log\n");
          editor.setSelections([
            new Selection(1, 12, 1, 12),
            new Selection(2, 1e3, 2, 1e3)
          ]);
          provider.setReturnValue({
            insertText: 'console.log("hello");',
            range: new Range(1, 1, 1, 1e3)
          });
          model.triggerExplicitly();
          await timeout(1e3);
          model.accept(editor);
          assert.deepStrictEqual(
            editor.getValue(),
            [
              `console.log("hello");`,
              `console.log("hello");`,
              ``
            ].join("\n")
          );
        }
      );
    });
    test("Multi Part and Different Cursor Columns", async function() {
      const provider = new MockInlineCompletionsProvider();
      await withAsyncTestCodeEditorAndInlineCompletionsModel(
        "",
        { fakeClock: true, provider },
        async ({ editor, editorViewModel, model, context }) => {
          context.keyboardType("console.log()\nconsole.warn\n");
          editor.setSelections([
            new Selection(1, 12, 1, 12),
            new Selection(2, 14, 2, 14)
          ]);
          provider.setReturnValue({
            insertText: 'console.log("hello");',
            range: new Range(1, 1, 1, 1e3)
          });
          model.triggerExplicitly();
          await timeout(1e3);
          model.accept(editor);
          assert.deepStrictEqual(
            editor.getValue(),
            [
              `console.log("hello");`,
              `console.warn("hello");`,
              ``
            ].join("\n")
          );
        }
      );
    });
    async function acceptNextWord(model, editor, timesToAccept = 1) {
      for (let i = 0; i < timesToAccept; i++) {
        model.triggerExplicitly();
        await timeout(1e3);
        await model.acceptNextWord(editor);
      }
    }
    test("Basic Partial Completion", async function() {
      const provider = new MockInlineCompletionsProvider();
      await withAsyncTestCodeEditorAndInlineCompletionsModel(
        "",
        { fakeClock: true, provider },
        async ({ editor, editorViewModel, model, context }) => {
          context.keyboardType("let\nlet\n");
          editor.setSelections([
            new Selection(1, 1e3, 1, 1e3),
            new Selection(2, 1e3, 2, 1e3)
          ]);
          provider.setReturnValue({
            insertText: `let a = 'some word'; `,
            range: new Range(1, 1, 1, 1e3)
          });
          await acceptNextWord(model, editor, 2);
          assert.deepStrictEqual(
            editor.getValue(),
            [
              `let a`,
              `let a`,
              ``
            ].join("\n")
          );
        }
      );
    });
    test("Partial Multi-Part Completion", async function() {
      const provider = new MockInlineCompletionsProvider();
      await withAsyncTestCodeEditorAndInlineCompletionsModel(
        "",
        { fakeClock: true, provider },
        async ({ editor, editorViewModel, model, context }) => {
          context.keyboardType("for ()\nfor \n");
          editor.setSelections([
            new Selection(1, 5, 1, 5),
            new Selection(2, 1e3, 2, 1e3)
          ]);
          provider.setReturnValue({
            insertText: `for (let i = 0; i < 10; i++) {`,
            range: new Range(1, 1, 1, 1e3)
          });
          model.triggerExplicitly();
          await timeout(1e3);
          await acceptNextWord(model, editor, 3);
          assert.deepStrictEqual(
            editor.getValue(),
            [
              `for (let i)`,
              `for (let i`,
              ``
            ].join("\n")
          );
        }
      );
    });
    test("Partial Mutli-Part and Different Cursor Columns Completion", async function() {
      const provider = new MockInlineCompletionsProvider();
      await withAsyncTestCodeEditorAndInlineCompletionsModel(
        "",
        { fakeClock: true, provider },
        async ({ editor, editorViewModel, model, context }) => {
          context.keyboardType(`console.log()
console.warnnnn
`);
          editor.setSelections([
            new Selection(1, 12, 1, 12),
            new Selection(2, 16, 2, 16)
          ]);
          provider.setReturnValue({
            insertText: `console.log("hello" + " " + "world");`,
            range: new Range(1, 1, 1, 1e3)
          });
          model.triggerExplicitly();
          await timeout(1e3);
          await acceptNextWord(model, editor, 4);
          assert.deepStrictEqual(
            editor.getValue(),
            [
              `console.log("hello" + )`,
              `console.warnnnn("hello" + `,
              ``
            ].join("\n")
          );
        }
      );
    });
  });
});
async function withAsyncTestCodeEditorAndInlineCompletionsModel(text, options, callback) {
  return await runWithFakedTimers({
    useFakeTimers: options.fakeClock
  }, async () => {
    const disposableStore = new DisposableStore();
    try {
      if (options.provider) {
        const languageFeaturesService = new LanguageFeaturesService();
        if (!options.serviceCollection) {
          options.serviceCollection = new ServiceCollection();
        }
        options.serviceCollection.set(ILanguageFeaturesService, languageFeaturesService);
        options.serviceCollection.set(IAccessibilitySignalService, {
          playSignal: async () => {
          },
          isSoundEnabled(signal) {
            return false;
          }
        });
        const d = languageFeaturesService.inlineCompletionsProvider.register({ pattern: "**" }, options.provider);
        disposableStore.add(d);
      }
      let result;
      await withAsyncTestCodeEditor(text, options, async (editor, editorViewModel, instantiationService) => {
        const controller = instantiationService.createInstance(InlineCompletionsController, editor);
        const model = controller.model.get();
        const context = new GhostTextContext(model, editor);
        try {
          result = await callback({ editor, editorViewModel, model, context });
        } finally {
          context.dispose();
          model.dispose();
          controller.dispose();
        }
      });
      if (options.provider instanceof MockInlineCompletionsProvider) {
        options.provider.assertNotCalledTwiceWithin50ms();
      }
      return result;
    } finally {
      disposableStore.dispose();
    }
  });
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy90ZXN0L2Jyb3dzZXIvaW5saW5lQ29tcGxldGlvbnNQcm92aWRlci50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBydW5XaXRoRmFrZWRUaW1lcnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3RpbWVUcmF2ZWxTY2hlZHVsZXIuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IElubGluZUNvbXBsZXRpb25zUHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZUZlYXR1cmVzLmpzJztcbmltcG9ydCB7IExhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFZpZXdNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi92aWV3TW9kZWwvdmlld01vZGVsSW1wbC5qcyc7XG5pbXBvcnQgeyBJbmxpbmVDb21wbGV0aW9uc0NvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnRyb2xsZXIvaW5saW5lQ29tcGxldGlvbnNDb250cm9sbGVyLmpzJztcbmltcG9ydCB7IElubGluZUNvbXBsZXRpb25zTW9kZWwgfSBmcm9tICcuLi8uLi9icm93c2VyL21vZGVsL2lubGluZUNvbXBsZXRpb25zTW9kZWwuanMnO1xuaW1wb3J0IHsgU2luZ2xlVGV4dEVkaXQgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS90ZXh0RWRpdC5qcyc7XG5pbXBvcnQgeyBHaG9zdFRleHRDb250ZXh0LCBNb2NrSW5saW5lQ29tcGxldGlvbnNQcm92aWRlciB9IGZyb20gJy4vdXRpbHMuanMnO1xuaW1wb3J0IHsgSVRlc3RDb2RlRWRpdG9yLCBUZXN0Q29kZUVkaXRvckluc3RhbnRpYXRpb25PcHRpb25zLCB3aXRoQXN5bmNUZXN0Q29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvYnJvd3Nlci90ZXN0Q29kZUVkaXRvci5qcyc7XG5pbXBvcnQgeyBjcmVhdGVUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2NvbW1vbi90ZXN0VGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IElBY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHlTaWduYWwvYnJvd3Nlci9hY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL3NlcnZpY2VDb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IFNlbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBjb21wdXRlR2hvc3RUZXh0IH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9tb2RlbC9jb21wdXRlR2hvc3RUZXh0LmpzJztcblxuc3VpdGUoJ0lubGluZSBDb21wbGV0aW9ucycsICgpID0+IHtcblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0c3VpdGUoJ2lubGluZUNvbXBsZXRpb25Ub0dob3N0VGV4dCcsICgpID0+IHtcblxuXHRcdGZ1bmN0aW9uIGdldE91dHB1dCh0ZXh0OiBzdHJpbmcsIHN1Z2dlc3Rpb246IHN0cmluZyk6IHVua25vd24ge1xuXHRcdFx0Y29uc3QgcmFuZ2VTdGFydE9mZnNldCA9IHRleHQuaW5kZXhPZignWycpO1xuXHRcdFx0Y29uc3QgcmFuZ2VFbmRPZmZzZXQgPSB0ZXh0LmluZGV4T2YoJ10nKSAtIDE7XG5cdFx0XHRjb25zdCBjbGVhbmVkVGV4dCA9IHRleHQucmVwbGFjZSgnWycsICcnKS5yZXBsYWNlKCddJywgJycpO1xuXHRcdFx0Y29uc3QgdGVtcE1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKGNsZWFuZWRUZXh0KTtcblx0XHRcdGNvbnN0IHJhbmdlID0gUmFuZ2UuZnJvbVBvc2l0aW9ucyh0ZW1wTW9kZWwuZ2V0UG9zaXRpb25BdChyYW5nZVN0YXJ0T2Zmc2V0KSwgdGVtcE1vZGVsLmdldFBvc2l0aW9uQXQocmFuZ2VFbmRPZmZzZXQpKTtcblx0XHRcdGNvbnN0IG9wdGlvbnMgPSBbJ3ByZWZpeCcsICdzdWJ3b3JkJ10gYXMgY29uc3Q7XG5cdFx0XHRjb25zdCByZXN1bHQgPSB7fSBhcyBhbnk7XG5cdFx0XHRmb3IgKGNvbnN0IG9wdGlvbiBvZiBvcHRpb25zKSB7XG5cdFx0XHRcdHJlc3VsdFtvcHRpb25dID0gY29tcHV0ZUdob3N0VGV4dChuZXcgU2luZ2xlVGV4dEVkaXQocmFuZ2UsIHN1Z2dlc3Rpb24pLCB0ZW1wTW9kZWwsIG9wdGlvbik/LnJlbmRlcihjbGVhbmVkVGV4dCwgdHJ1ZSk7XG5cdFx0XHR9XG5cblx0XHRcdHRlbXBNb2RlbC5kaXNwb3NlKCk7XG5cblx0XHRcdGlmIChuZXcgU2V0KE9iamVjdC52YWx1ZXMocmVzdWx0KSkuc2l6ZSA9PT0gMSkge1xuXHRcdFx0XHRyZXR1cm4gT2JqZWN0LnZhbHVlcyhyZXN1bHQpWzBdO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH1cblxuXHRcdHRlc3QoJ0Jhc2ljJywgKCkgPT4ge1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRPdXRwdXQoJ1tmb29dYmF6JywgJ2Zvb2JhcicpLCAnZm9vW2Jhcl1iYXonKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2V0T3V0cHV0KCdbYWFhXWFhYScsICdhYWFhYWEnKSwgJ2FhYVthYWFdYWFhJyk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldE91dHB1dCgnW2Zvb11iYXonLCAnYm9vYmFyJyksIHVuZGVmaW5lZCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldE91dHB1dCgnW2Zvb11mb28nLCAnZm9vZm9vJyksICdmb29bZm9vXWZvbycpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRPdXRwdXQoJ2Zvb1tdJywgJ2JhclxcbmhlbGxvJyksICdmb29bYmFyXFxuaGVsbG9dJyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdFbXB0eSBnaG9zdCB0ZXh0JywgKCkgPT4ge1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRPdXRwdXQoJ1tmb29dJywgJ2ZvbycpLCAnZm9vJyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdXaGl0ZXNwYWNlIChpbmRlbnRhdGlvbiknLCAoKSA9PiB7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldE91dHB1dCgnWyBmb29dJywgJ2Zvb2JhcicpLCAnIGZvb1tiYXJdJyk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldE91dHB1dCgnW1xcdGZvb10nLCAnZm9vYmFyJyksICdcXHRmb29bYmFyXScpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRPdXRwdXQoJ1tcXHQgZm9vXScsICdcXHRmb29iYXInKSwgJ1x0IGZvb1tiYXJdJyk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldE91dHB1dCgnW1xcdGZvb10nLCAnXFx0XFx0Zm9vYmFyJyksIHsgcHJlZml4OiB1bmRlZmluZWQsIHN1YndvcmQ6ICdcXHRbXFx0XWZvb1tiYXJdJyB9KTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2V0T3V0cHV0KCdbXFx0XScsICdcXHRcXHRmb29iYXInKSwgJ1xcdFtcXHRmb29iYXJdJyk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldE91dHB1dCgnXFx0W10nLCAnXFx0JyksICdcXHRbXFx0XScpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRPdXRwdXQoJ1xcdFtcXHRdJywgJycpLCAnXFx0XFx0Jyk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2V0T3V0cHV0KCdbIF0nLCAncmV0dXJuIDEnKSwgJyBbcmV0dXJuIDFdJyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdXaGl0ZXNwYWNlIChvdXRzaWRlIG9mIGluZGVudGF0aW9uKScsICgpID0+IHtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2V0T3V0cHV0KCdiYXJbIGZvb10nLCAnZm9vYmFyJyksIHVuZGVmaW5lZCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldE91dHB1dCgnYmFyW1xcdGZvb10nLCAnZm9vYmFyJyksIHVuZGVmaW5lZCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdVbnN1cHBvcnRlZCBDYXNlJywgKCkgPT4ge1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRPdXRwdXQoJ2ZvW29cXG5dJywgJ3hcXG5iYXInKSwgdW5kZWZpbmVkKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ05ldyBMaW5lJywgKCkgPT4ge1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRPdXRwdXQoJ2ZvW29cXG5dJywgJ29cXG5iYXInKSwgJ2Zvb1xcbltiYXJdJyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdNdWx0aSBQYXJ0IERpZmZpbmcnLCAoKSA9PiB7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldE91dHB1dCgnZm9vWygpXScsICcoeCk7JyksIHsgcHJlZml4OiB1bmRlZmluZWQsIHN1YndvcmQ6ICdmb28oW3hdKVs7XScgfSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldE91dHB1dCgnW1xcdGZvb10nLCAnXFx0XFx0Zm9vYmFyJyksIHsgcHJlZml4OiB1bmRlZmluZWQsIHN1YndvcmQ6ICdcXHRbXFx0XWZvb1tiYXJdJyB9KTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2V0T3V0cHV0KCdbKHkgPT09KV0nLCAnKHkgPT09IDEpIHsgZigpOyB9JyksIHsgcHJlZml4OiB1bmRlZmluZWQsIHN1YndvcmQ6ICcoeSA9PT1bIDFdKVsgeyBmKCk7IH1dJyB9KTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2V0T3V0cHV0KCdbKHkgPT0pXScsICcoeSA9PT0gMSkgeyBmKCk7IH0nKSwgeyBwcmVmaXg6IHVuZGVmaW5lZCwgc3Vid29yZDogJyh5ID09Wz0gMV0pWyB7IGYoKTsgfV0nIH0pO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldE91dHB1dCgnWyh5ID09KV0nLCAnKHkgPT09IDEpIHsgZigpOyB9JyksIHsgcHJlZml4OiB1bmRlZmluZWQsIHN1YndvcmQ6ICcoeSA9PVs9IDFdKVsgeyBmKCk7IH1dJyB9KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ011bHRpIFBhcnQgRGlmZmluZyAxJywgKCkgPT4ge1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRPdXRwdXQoJ1tpZiAoKSAoKV0nLCAnaWYgKDEgPT0gZigpKSAoKScpLCB7IHByZWZpeDogdW5kZWZpbmVkLCBzdWJ3b3JkOiAnaWYgKFsxID09IGYoKV0pICgpJyB9KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ011bHRpIFBhcnQgRGlmZmluZyAyJywgKCkgPT4ge1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRPdXRwdXQoJ1spXScsICcoKSknKSwgKHsgcHJlZml4OiB1bmRlZmluZWQsIHN1YndvcmQ6IFwiWyhdKVspXVwiIH0pKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2V0T3V0cHV0KCdbKSldJywgJygoKSknKSwgKHsgcHJlZml4OiB1bmRlZmluZWQsIHN1YndvcmQ6IFwiWygoXSkpXCIgfSkpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnUGFyZW50aGVzaXMgTWF0Y2hpbmcnLCAoKSA9PiB7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldE91dHB1dCgnW2NvbnNvbGUubG9nKCldJywgJ2NvbnNvbGUubG9nKHsgbGFiZWw6IFwiKFwiIH0pJyksIHtcblx0XHRcdFx0cHJlZml4OiB1bmRlZmluZWQsXG5cdFx0XHRcdHN1YndvcmQ6ICdjb25zb2xlLmxvZyhbeyBsYWJlbDogXCIoXCIgfV0pJ1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0RvZXMgbm90IHRyaWdnZXIgYXV0b21hdGljYWxseSBpZiBkaXNhYmxlZCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBwcm92aWRlciA9IG5ldyBNb2NrSW5saW5lQ29tcGxldGlvbnNQcm92aWRlcigpO1xuXHRcdGF3YWl0IHdpdGhBc3luY1Rlc3RDb2RlRWRpdG9yQW5kSW5saW5lQ29tcGxldGlvbnNNb2RlbCgnJyxcblx0XHRcdHsgZmFrZUNsb2NrOiB0cnVlLCBwcm92aWRlciwgaW5saW5lU3VnZ2VzdDogeyBlbmFibGVkOiBmYWxzZSB9IH0sXG5cdFx0XHRhc3luYyAoeyBlZGl0b3IsIGVkaXRvclZpZXdNb2RlbCwgbW9kZWwsIGNvbnRleHQgfSkgPT4ge1xuXHRcdFx0XHRjb250ZXh0LmtleWJvYXJkVHlwZSgnZm9vJyk7XG5cdFx0XHRcdGF3YWl0IHRpbWVvdXQoMTAwMCk7XG5cblx0XHRcdFx0Ly8gUHJvdmlkZXIgaXMgbm90IGNhbGxlZCwgbm8gZ2hvc3QgdGV4dCBpcyBzaG93bi5cblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwcm92aWRlci5nZXRBbmRDbGVhckNhbGxIaXN0b3J5KCksIFtdKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjb250ZXh0LmdldEFuZENsZWFyVmlld1N0YXRlcygpLCBbJyddKTtcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdHaG9zdCB0ZXh0IGlzIHNob3duIGFmdGVyIHRyaWdnZXInLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBuZXcgTW9ja0lubGluZUNvbXBsZXRpb25zUHJvdmlkZXIoKTtcblx0XHRhd2FpdCB3aXRoQXN5bmNUZXN0Q29kZUVkaXRvckFuZElubGluZUNvbXBsZXRpb25zTW9kZWwoJycsXG5cdFx0XHR7IGZha2VDbG9jazogdHJ1ZSwgcHJvdmlkZXIgfSxcblx0XHRcdGFzeW5jICh7IGVkaXRvciwgZWRpdG9yVmlld01vZGVsLCBtb2RlbCwgY29udGV4dCB9KSA9PiB7XG5cdFx0XHRcdGNvbnRleHQua2V5Ym9hcmRUeXBlKCdmb28nKTtcblx0XHRcdFx0cHJvdmlkZXIuc2V0UmV0dXJuVmFsdWUoeyBpbnNlcnRUZXh0OiAnZm9vYmFyJywgcmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAxLCA0KSB9KTtcblx0XHRcdFx0bW9kZWwudHJpZ2dlckV4cGxpY2l0bHkoKTtcblx0XHRcdFx0YXdhaXQgdGltZW91dCgxMDAwKTtcblxuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHByb3ZpZGVyLmdldEFuZENsZWFyQ2FsbEhpc3RvcnkoKSwgW1xuXHRcdFx0XHRcdHsgcG9zaXRpb246ICcoMSw0KScsIHRleHQ6ICdmb28nLCB0cmlnZ2VyS2luZDogMSwgfVxuXHRcdFx0XHRdKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjb250ZXh0LmdldEFuZENsZWFyVmlld1N0YXRlcygpLCBbJycsICdmb29bYmFyXSddKTtcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdHaG9zdCB0ZXh0IGlzIHNob3duIGF1dG9tYXRpY2FsbHkgd2hlbiBjb25maWd1cmVkJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHByb3ZpZGVyID0gbmV3IE1vY2tJbmxpbmVDb21wbGV0aW9uc1Byb3ZpZGVyKCk7XG5cdFx0YXdhaXQgd2l0aEFzeW5jVGVzdENvZGVFZGl0b3JBbmRJbmxpbmVDb21wbGV0aW9uc01vZGVsKCcnLFxuXHRcdFx0eyBmYWtlQ2xvY2s6IHRydWUsIHByb3ZpZGVyLCBpbmxpbmVTdWdnZXN0OiB7IGVuYWJsZWQ6IHRydWUgfSB9LFxuXHRcdFx0YXN5bmMgKHsgZWRpdG9yLCBlZGl0b3JWaWV3TW9kZWwsIG1vZGVsLCBjb250ZXh0IH0pID0+IHtcblx0XHRcdFx0Y29udGV4dC5rZXlib2FyZFR5cGUoJ2ZvbycpO1xuXG5cdFx0XHRcdHByb3ZpZGVyLnNldFJldHVyblZhbHVlKHsgaW5zZXJ0VGV4dDogJ2Zvb2JhcicsIHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgMSwgNCkgfSk7XG5cdFx0XHRcdGF3YWl0IHRpbWVvdXQoMTAwMCk7XG5cblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwcm92aWRlci5nZXRBbmRDbGVhckNhbGxIaXN0b3J5KCksIFtcblx0XHRcdFx0XHR7IHBvc2l0aW9uOiAnKDEsNCknLCB0ZXh0OiAnZm9vJywgdHJpZ2dlcktpbmQ6IDAsIH1cblx0XHRcdFx0XSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY29udGV4dC5nZXRBbmRDbGVhclZpZXdTdGF0ZXMoKSwgWycnLCAnZm9vW2Jhcl0nXSk7XG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnR2hvc3QgdGV4dCBpcyB1cGRhdGVkIGF1dG9tYXRpY2FsbHknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBuZXcgTW9ja0lubGluZUNvbXBsZXRpb25zUHJvdmlkZXIoKTtcblx0XHRhd2FpdCB3aXRoQXN5bmNUZXN0Q29kZUVkaXRvckFuZElubGluZUNvbXBsZXRpb25zTW9kZWwoJycsXG5cdFx0XHR7IGZha2VDbG9jazogdHJ1ZSwgcHJvdmlkZXIgfSxcblx0XHRcdGFzeW5jICh7IGVkaXRvciwgZWRpdG9yVmlld01vZGVsLCBtb2RlbCwgY29udGV4dCB9KSA9PiB7XG5cdFx0XHRcdHByb3ZpZGVyLnNldFJldHVyblZhbHVlKHsgaW5zZXJ0VGV4dDogJ2Zvb2JhcicsIHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgMSwgNCkgfSk7XG5cdFx0XHRcdGNvbnRleHQua2V5Ym9hcmRUeXBlKCdmb28nKTtcblx0XHRcdFx0bW9kZWwudHJpZ2dlckV4cGxpY2l0bHkoKTtcblx0XHRcdFx0YXdhaXQgdGltZW91dCgxMDAwKTtcblxuXHRcdFx0XHRwcm92aWRlci5zZXRSZXR1cm5WYWx1ZSh7IGluc2VydFRleHQ6ICdmb29iaXp6JywgcmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAxLCA2KSB9KTtcblx0XHRcdFx0Y29udGV4dC5rZXlib2FyZFR5cGUoJ2InKTtcblx0XHRcdFx0Y29udGV4dC5rZXlib2FyZFR5cGUoJ2knKTtcblx0XHRcdFx0YXdhaXQgdGltZW91dCgxMDAwKTtcblxuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHByb3ZpZGVyLmdldEFuZENsZWFyQ2FsbEhpc3RvcnkoKSwgW1xuXHRcdFx0XHRcdHsgcG9zaXRpb246ICcoMSw0KScsIHRleHQ6ICdmb28nLCB0cmlnZ2VyS2luZDogMSwgfSxcblx0XHRcdFx0XHR7IHBvc2l0aW9uOiAnKDEsNiknLCB0ZXh0OiAnZm9vYmknLCB0cmlnZ2VyS2luZDogMCwgfVxuXHRcdFx0XHRdKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0XHRjb250ZXh0LmdldEFuZENsZWFyVmlld1N0YXRlcygpLFxuXHRcdFx0XHRcdFsnJywgJ2Zvb1tiYXJdJywgJ2Zvb2JbYXJdJywgJ2Zvb2JpJywgJ2Zvb2JpW3p6XSddXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnVW5pbmRlbnQgd2hpdGVzcGFjZScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBwcm92aWRlciA9IG5ldyBNb2NrSW5saW5lQ29tcGxldGlvbnNQcm92aWRlcigpO1xuXHRcdGF3YWl0IHdpdGhBc3luY1Rlc3RDb2RlRWRpdG9yQW5kSW5saW5lQ29tcGxldGlvbnNNb2RlbCgnJyxcblx0XHRcdHsgZmFrZUNsb2NrOiB0cnVlLCBwcm92aWRlciB9LFxuXHRcdFx0YXN5bmMgKHsgZWRpdG9yLCBlZGl0b3JWaWV3TW9kZWwsIG1vZGVsLCBjb250ZXh0IH0pID0+IHtcblx0XHRcdFx0Y29udGV4dC5rZXlib2FyZFR5cGUoJyAgJyk7XG5cdFx0XHRcdHByb3ZpZGVyLnNldFJldHVyblZhbHVlKHsgaW5zZXJ0VGV4dDogJ2ZvbycsIHJhbmdlOiBuZXcgUmFuZ2UoMSwgMiwgMSwgMykgfSk7XG5cdFx0XHRcdG1vZGVsLnRyaWdnZXJFeHBsaWNpdGx5KCk7XG5cdFx0XHRcdGF3YWl0IHRpbWVvdXQoMTAwMCk7XG5cblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjb250ZXh0LmdldEFuZENsZWFyVmlld1N0YXRlcygpLCBbJycsICcgIFtmb29dJ10pO1xuXG5cdFx0XHRcdG1vZGVsLmFjY2VwdChlZGl0b3IpO1xuXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocHJvdmlkZXIuZ2V0QW5kQ2xlYXJDYWxsSGlzdG9yeSgpLCBbXG5cdFx0XHRcdFx0eyBwb3NpdGlvbjogJygxLDMpJywgdGV4dDogJyAgJywgdHJpZ2dlcktpbmQ6IDEsIH0sXG5cdFx0XHRcdF0pO1xuXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY29udGV4dC5nZXRBbmRDbGVhclZpZXdTdGF0ZXMoKSwgWycgZm9vJ10pO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1VuaW5kZW50IHRhYicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBwcm92aWRlciA9IG5ldyBNb2NrSW5saW5lQ29tcGxldGlvbnNQcm92aWRlcigpO1xuXHRcdGF3YWl0IHdpdGhBc3luY1Rlc3RDb2RlRWRpdG9yQW5kSW5saW5lQ29tcGxldGlvbnNNb2RlbCgnJyxcblx0XHRcdHsgZmFrZUNsb2NrOiB0cnVlLCBwcm92aWRlciB9LFxuXHRcdFx0YXN5bmMgKHsgZWRpdG9yLCBlZGl0b3JWaWV3TW9kZWwsIG1vZGVsLCBjb250ZXh0IH0pID0+IHtcblx0XHRcdFx0Y29udGV4dC5rZXlib2FyZFR5cGUoJ1xcdFxcdCcpO1xuXHRcdFx0XHRwcm92aWRlci5zZXRSZXR1cm5WYWx1ZSh7IGluc2VydFRleHQ6ICdmb28nLCByYW5nZTogbmV3IFJhbmdlKDEsIDIsIDEsIDMpIH0pO1xuXHRcdFx0XHRtb2RlbC50cmlnZ2VyRXhwbGljaXRseSgpO1xuXHRcdFx0XHRhd2FpdCB0aW1lb3V0KDEwMDApO1xuXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY29udGV4dC5nZXRBbmRDbGVhclZpZXdTdGF0ZXMoKSwgWycnLCAnXFx0XFx0W2Zvb10nXSk7XG5cblx0XHRcdFx0bW9kZWwuYWNjZXB0KGVkaXRvcik7XG5cblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwcm92aWRlci5nZXRBbmRDbGVhckNhbGxIaXN0b3J5KCksIFtcblx0XHRcdFx0XHR7IHBvc2l0aW9uOiAnKDEsMyknLCB0ZXh0OiAnXFx0XFx0JywgdHJpZ2dlcktpbmQ6IDEsIH0sXG5cdFx0XHRcdF0pO1xuXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY29udGV4dC5nZXRBbmRDbGVhclZpZXdTdGF0ZXMoKSwgWydcXHRmb28nXSk7XG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnTm8gdW5pbmRlbnQgYWZ0ZXIgaW5kZW50YXRpb24nLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBuZXcgTW9ja0lubGluZUNvbXBsZXRpb25zUHJvdmlkZXIoKTtcblx0XHRhd2FpdCB3aXRoQXN5bmNUZXN0Q29kZUVkaXRvckFuZElubGluZUNvbXBsZXRpb25zTW9kZWwoJycsXG5cdFx0XHR7IGZha2VDbG9jazogdHJ1ZSwgcHJvdmlkZXIgfSxcblx0XHRcdGFzeW5jICh7IGVkaXRvciwgZWRpdG9yVmlld01vZGVsLCBtb2RlbCwgY29udGV4dCB9KSA9PiB7XG5cdFx0XHRcdGNvbnRleHQua2V5Ym9hcmRUeXBlKCdidXp6ICAnKTtcblx0XHRcdFx0cHJvdmlkZXIuc2V0UmV0dXJuVmFsdWUoeyBpbnNlcnRUZXh0OiAnZm9vJywgcmFuZ2U6IG5ldyBSYW5nZSgxLCA2LCAxLCA3KSB9KTtcblx0XHRcdFx0bW9kZWwudHJpZ2dlckV4cGxpY2l0bHkoKTtcblx0XHRcdFx0YXdhaXQgdGltZW91dCgxMDAwKTtcblxuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNvbnRleHQuZ2V0QW5kQ2xlYXJWaWV3U3RhdGVzKCksIFsnJ10pO1xuXG5cdFx0XHRcdG1vZGVsLmFjY2VwdChlZGl0b3IpO1xuXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocHJvdmlkZXIuZ2V0QW5kQ2xlYXJDYWxsSGlzdG9yeSgpLCBbXG5cdFx0XHRcdFx0eyBwb3NpdGlvbjogJygxLDcpJywgdGV4dDogJ2J1enogICcsIHRyaWdnZXJLaW5kOiAxLCB9LFxuXHRcdFx0XHRdKTtcblxuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNvbnRleHQuZ2V0QW5kQ2xlYXJWaWV3U3RhdGVzKCksIFtdKTtcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdOZXh0L3ByZXZpb3VzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHByb3ZpZGVyID0gbmV3IE1vY2tJbmxpbmVDb21wbGV0aW9uc1Byb3ZpZGVyKCk7XG5cdFx0YXdhaXQgd2l0aEFzeW5jVGVzdENvZGVFZGl0b3JBbmRJbmxpbmVDb21wbGV0aW9uc01vZGVsKCcnLFxuXHRcdFx0eyBmYWtlQ2xvY2s6IHRydWUsIHByb3ZpZGVyIH0sXG5cdFx0XHRhc3luYyAoeyBlZGl0b3IsIGVkaXRvclZpZXdNb2RlbCwgbW9kZWwsIGNvbnRleHQgfSkgPT4ge1xuXHRcdFx0XHRjb250ZXh0LmtleWJvYXJkVHlwZSgnZm9vJyk7XG5cdFx0XHRcdHByb3ZpZGVyLnNldFJldHVyblZhbHVlKHsgaW5zZXJ0VGV4dDogJ2Zvb2JhcjEnLCByYW5nZTogbmV3IFJhbmdlKDEsIDEsIDEsIDQpIH0pO1xuXHRcdFx0XHRtb2RlbC50cmlnZ2VyKCk7XG5cdFx0XHRcdGF3YWl0IHRpbWVvdXQoMTAwMCk7XG5cblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0XHRjb250ZXh0LmdldEFuZENsZWFyVmlld1N0YXRlcygpLFxuXHRcdFx0XHRcdFsnJywgJ2Zvb1tiYXIxXSddXG5cdFx0XHRcdCk7XG5cblx0XHRcdFx0cHJvdmlkZXIuc2V0UmV0dXJuVmFsdWVzKFtcblx0XHRcdFx0XHR7IGluc2VydFRleHQ6ICdmb29iYXIxJywgcmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAxLCA0KSB9LFxuXHRcdFx0XHRcdHsgaW5zZXJ0VGV4dDogJ2Zvb2JpenoyJywgcmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAxLCA0KSB9LFxuXHRcdFx0XHRcdHsgaW5zZXJ0VGV4dDogJ2Zvb2J1enozJywgcmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAxLCA0KSB9XG5cdFx0XHRcdF0pO1xuXG5cdFx0XHRcdG1vZGVsLm5leHQoKTtcblx0XHRcdFx0YXdhaXQgdGltZW91dCgxMDAwKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjb250ZXh0LmdldEFuZENsZWFyVmlld1N0YXRlcygpLCBbJ2Zvb1tiaXp6Ml0nXSk7XG5cblx0XHRcdFx0bW9kZWwubmV4dCgpO1xuXHRcdFx0XHRhd2FpdCB0aW1lb3V0KDEwMDApO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNvbnRleHQuZ2V0QW5kQ2xlYXJWaWV3U3RhdGVzKCksIFsnZm9vW2J1enozXSddKTtcblxuXHRcdFx0XHRtb2RlbC5uZXh0KCk7XG5cdFx0XHRcdGF3YWl0IHRpbWVvdXQoMTAwMCk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY29udGV4dC5nZXRBbmRDbGVhclZpZXdTdGF0ZXMoKSwgWydmb29bYmFyMV0nXSk7XG5cblx0XHRcdFx0bW9kZWwucHJldmlvdXMoKTtcblx0XHRcdFx0YXdhaXQgdGltZW91dCgxMDAwKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjb250ZXh0LmdldEFuZENsZWFyVmlld1N0YXRlcygpLCBbJ2Zvb1tidXp6M10nXSk7XG5cblx0XHRcdFx0bW9kZWwucHJldmlvdXMoKTtcblx0XHRcdFx0YXdhaXQgdGltZW91dCgxMDAwKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjb250ZXh0LmdldEFuZENsZWFyVmlld1N0YXRlcygpLCBbJ2Zvb1tiaXp6Ml0nXSk7XG5cblx0XHRcdFx0bW9kZWwucHJldmlvdXMoKTtcblx0XHRcdFx0YXdhaXQgdGltZW91dCgxMDAwKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjb250ZXh0LmdldEFuZENsZWFyVmlld1N0YXRlcygpLCBbJ2Zvb1tiYXIxXSddKTtcblxuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHByb3ZpZGVyLmdldEFuZENsZWFyQ2FsbEhpc3RvcnkoKSwgW1xuXHRcdFx0XHRcdHsgcG9zaXRpb246ICcoMSw0KScsIHRleHQ6ICdmb28nLCB0cmlnZ2VyS2luZDogMCwgfSxcblx0XHRcdFx0XHR7IHBvc2l0aW9uOiAnKDEsNCknLCB0ZXh0OiAnZm9vJywgdHJpZ2dlcktpbmQ6IDEsIH0sXG5cdFx0XHRcdF0pO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ0NhbGxpbmcgdGhlIHByb3ZpZGVyIGlzIGRlYm91bmNlZCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBwcm92aWRlciA9IG5ldyBNb2NrSW5saW5lQ29tcGxldGlvbnNQcm92aWRlcigpO1xuXHRcdGF3YWl0IHdpdGhBc3luY1Rlc3RDb2RlRWRpdG9yQW5kSW5saW5lQ29tcGxldGlvbnNNb2RlbCgnJyxcblx0XHRcdHsgZmFrZUNsb2NrOiB0cnVlLCBwcm92aWRlciB9LFxuXHRcdFx0YXN5bmMgKHsgZWRpdG9yLCBlZGl0b3JWaWV3TW9kZWwsIG1vZGVsLCBjb250ZXh0IH0pID0+IHtcblx0XHRcdFx0bW9kZWwudHJpZ2dlcigpO1xuXG5cdFx0XHRcdGNvbnRleHQua2V5Ym9hcmRUeXBlKCdmJyk7XG5cdFx0XHRcdGF3YWl0IHRpbWVvdXQoNDApO1xuXHRcdFx0XHRjb250ZXh0LmtleWJvYXJkVHlwZSgnbycpO1xuXHRcdFx0XHRhd2FpdCB0aW1lb3V0KDQwKTtcblx0XHRcdFx0Y29udGV4dC5rZXlib2FyZFR5cGUoJ28nKTtcblx0XHRcdFx0YXdhaXQgdGltZW91dCg0MCk7XG5cblx0XHRcdFx0Ly8gVGhlIHByb3ZpZGVyIGlzIG5vdCBjYWxsZWRcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwcm92aWRlci5nZXRBbmRDbGVhckNhbGxIaXN0b3J5KCksIFtdKTtcblxuXHRcdFx0XHRhd2FpdCB0aW1lb3V0KDQwMCk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocHJvdmlkZXIuZ2V0QW5kQ2xlYXJDYWxsSGlzdG9yeSgpLCBbXG5cdFx0XHRcdFx0eyBwb3NpdGlvbjogJygxLDQpJywgdGV4dDogJ2ZvbycsIHRyaWdnZXJLaW5kOiAwLCB9XG5cdFx0XHRcdF0pO1xuXG5cdFx0XHRcdHByb3ZpZGVyLmFzc2VydE5vdENhbGxlZFR3aWNlV2l0aGluNTBtcygpO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ0JhY2tzcGFjZSBpcyBkZWJvdW5jZWQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBuZXcgTW9ja0lubGluZUNvbXBsZXRpb25zUHJvdmlkZXIoKTtcblx0XHRhd2FpdCB3aXRoQXN5bmNUZXN0Q29kZUVkaXRvckFuZElubGluZUNvbXBsZXRpb25zTW9kZWwoJycsXG5cdFx0XHR7IGZha2VDbG9jazogdHJ1ZSwgcHJvdmlkZXIsIGlubGluZVN1Z2dlc3Q6IHsgZW5hYmxlZDogdHJ1ZSB9IH0sXG5cdFx0XHRhc3luYyAoeyBlZGl0b3IsIGVkaXRvclZpZXdNb2RlbCwgbW9kZWwsIGNvbnRleHQgfSkgPT4ge1xuXHRcdFx0XHRjb250ZXh0LmtleWJvYXJkVHlwZSgnZm9vJyk7XG5cblx0XHRcdFx0cHJvdmlkZXIuc2V0UmV0dXJuVmFsdWUoeyBpbnNlcnRUZXh0OiAnZm9vYmFyJywgcmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAxLCA0KSB9KTtcblx0XHRcdFx0YXdhaXQgdGltZW91dCgxMDAwKTtcblxuXHRcdFx0XHRmb3IgKGxldCBqID0gMDsgaiA8IDI7IGorKykge1xuXHRcdFx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgMzsgaSsrKSB7XG5cdFx0XHRcdFx0XHRjb250ZXh0LmxlZnREZWxldGUoKTtcblx0XHRcdFx0XHRcdGF3YWl0IHRpbWVvdXQoNSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29udGV4dC5rZXlib2FyZFR5cGUoJ2JhcicpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0YXdhaXQgdGltZW91dCg0MDApO1xuXG5cdFx0XHRcdHByb3ZpZGVyLmFzc2VydE5vdENhbGxlZFR3aWNlV2l0aGluNTBtcygpO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ0ZvcndhcmQgc3RhYmlsaXR5JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdC8vIFRoZSB1c2VyIHR5cGVzIHRoZSB0ZXh0IGFzIHN1Z2dlc3RlZCBhbmQgdGhlIHByb3ZpZGVyIGlzIGZvcndhcmQtc3RhYmxlXG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBuZXcgTW9ja0lubGluZUNvbXBsZXRpb25zUHJvdmlkZXIoKTtcblx0XHRhd2FpdCB3aXRoQXN5bmNUZXN0Q29kZUVkaXRvckFuZElubGluZUNvbXBsZXRpb25zTW9kZWwoJycsXG5cdFx0XHR7IGZha2VDbG9jazogdHJ1ZSwgcHJvdmlkZXIgfSxcblx0XHRcdGFzeW5jICh7IGVkaXRvciwgZWRpdG9yVmlld01vZGVsLCBtb2RlbCwgY29udGV4dCB9KSA9PiB7XG5cdFx0XHRcdHByb3ZpZGVyLnNldFJldHVyblZhbHVlKHsgaW5zZXJ0VGV4dDogJ2Zvb2JhcicsIHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgMSwgNCkgfSk7XG5cdFx0XHRcdGNvbnRleHQua2V5Ym9hcmRUeXBlKCdmb28nKTtcblx0XHRcdFx0bW9kZWwudHJpZ2dlcigpO1xuXHRcdFx0XHRhd2FpdCB0aW1lb3V0KDEwMDApO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHByb3ZpZGVyLmdldEFuZENsZWFyQ2FsbEhpc3RvcnkoKSwgW1xuXHRcdFx0XHRcdHsgcG9zaXRpb246ICcoMSw0KScsIHRleHQ6ICdmb28nLCB0cmlnZ2VyS2luZDogMCwgfVxuXHRcdFx0XHRdKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjb250ZXh0LmdldEFuZENsZWFyVmlld1N0YXRlcygpLCBbJycsICdmb29bYmFyXSddKTtcblxuXHRcdFx0XHRwcm92aWRlci5zZXRSZXR1cm5WYWx1ZSh7IGluc2VydFRleHQ6ICdmb29iYXInLCByYW5nZTogbmV3IFJhbmdlKDEsIDEsIDEsIDUpIH0pO1xuXHRcdFx0XHRjb250ZXh0LmtleWJvYXJkVHlwZSgnYicpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNvbnRleHQuY3VycmVudFByZXR0eVZpZXdTdGF0ZSwgJ2Zvb2JbYXJdJyk7XG5cdFx0XHRcdGF3YWl0IHRpbWVvdXQoMTAwMCk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocHJvdmlkZXIuZ2V0QW5kQ2xlYXJDYWxsSGlzdG9yeSgpLCBbXG5cdFx0XHRcdFx0eyBwb3NpdGlvbjogJygxLDUpJywgdGV4dDogJ2Zvb2InLCB0cmlnZ2VyS2luZDogMCwgfVxuXHRcdFx0XHRdKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjb250ZXh0LmdldEFuZENsZWFyVmlld1N0YXRlcygpLCBbJ2Zvb2JbYXJdJ10pO1xuXG5cdFx0XHRcdHByb3ZpZGVyLnNldFJldHVyblZhbHVlKHsgaW5zZXJ0VGV4dDogJ2Zvb2JhcicsIHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgMSwgNikgfSk7XG5cdFx0XHRcdGNvbnRleHQua2V5Ym9hcmRUeXBlKCdhJyk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY29udGV4dC5jdXJyZW50UHJldHR5Vmlld1N0YXRlLCAnZm9vYmFbcl0nKTtcblx0XHRcdFx0YXdhaXQgdGltZW91dCgxMDAwKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwcm92aWRlci5nZXRBbmRDbGVhckNhbGxIaXN0b3J5KCksIFtcblx0XHRcdFx0XHR7IHBvc2l0aW9uOiAnKDEsNiknLCB0ZXh0OiAnZm9vYmEnLCB0cmlnZ2VyS2luZDogMCwgfVxuXHRcdFx0XHRdKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjb250ZXh0LmdldEFuZENsZWFyVmlld1N0YXRlcygpLCBbJ2Zvb2JhW3JdJ10pO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1N1cHBvcnQgZm9yd2FyZCBpbnN0YWJpbGl0eScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHQvLyBUaGUgdXNlciB0eXBlcyB0aGUgdGV4dCBhcyBzdWdnZXN0ZWQgYW5kIHRoZSBwcm92aWRlciByZXBvcnRzIGEgZGlmZmVyZW50IHN1Z2dlc3Rpb24uXG5cblx0XHRjb25zdCBwcm92aWRlciA9IG5ldyBNb2NrSW5saW5lQ29tcGxldGlvbnNQcm92aWRlcigpO1xuXHRcdGF3YWl0IHdpdGhBc3luY1Rlc3RDb2RlRWRpdG9yQW5kSW5saW5lQ29tcGxldGlvbnNNb2RlbCgnJyxcblx0XHRcdHsgZmFrZUNsb2NrOiB0cnVlLCBwcm92aWRlciB9LFxuXHRcdFx0YXN5bmMgKHsgZWRpdG9yLCBlZGl0b3JWaWV3TW9kZWwsIG1vZGVsLCBjb250ZXh0IH0pID0+IHtcblx0XHRcdFx0cHJvdmlkZXIuc2V0UmV0dXJuVmFsdWUoeyBpbnNlcnRUZXh0OiAnZm9vYmFyJywgcmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAxLCA0KSB9KTtcblx0XHRcdFx0Y29udGV4dC5rZXlib2FyZFR5cGUoJ2ZvbycpO1xuXHRcdFx0XHRtb2RlbC50cmlnZ2VyRXhwbGljaXRseSgpO1xuXHRcdFx0XHRhd2FpdCB0aW1lb3V0KDEwMCk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocHJvdmlkZXIuZ2V0QW5kQ2xlYXJDYWxsSGlzdG9yeSgpLCBbXG5cdFx0XHRcdFx0eyBwb3NpdGlvbjogJygxLDQpJywgdGV4dDogJ2ZvbycsIHRyaWdnZXJLaW5kOiAxLCB9XG5cdFx0XHRcdF0pO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNvbnRleHQuZ2V0QW5kQ2xlYXJWaWV3U3RhdGVzKCksIFsnJywgJ2Zvb1tiYXJdJ10pO1xuXG5cdFx0XHRcdHByb3ZpZGVyLnNldFJldHVyblZhbHVlKHsgaW5zZXJ0VGV4dDogJ2Zvb2JheicsIHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgMSwgNSkgfSk7XG5cdFx0XHRcdGNvbnRleHQua2V5Ym9hcmRUeXBlKCdiJyk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY29udGV4dC5jdXJyZW50UHJldHR5Vmlld1N0YXRlLCAnZm9vYlthcl0nKTtcblx0XHRcdFx0YXdhaXQgdGltZW91dCgxMDApO1xuXHRcdFx0XHQvLyBUaGlzIGJlaGF2aW9yIG1pZ2h0IGNoYW5nZSFcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwcm92aWRlci5nZXRBbmRDbGVhckNhbGxIaXN0b3J5KCksIFtcblx0XHRcdFx0XHR7IHBvc2l0aW9uOiAnKDEsNSknLCB0ZXh0OiAnZm9vYicsIHRyaWdnZXJLaW5kOiAwLCB9XG5cdFx0XHRcdF0pO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNvbnRleHQuZ2V0QW5kQ2xlYXJWaWV3U3RhdGVzKCksIFsnZm9vYlthcl0nLCAnZm9vYlthel0nXSk7XG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnU3VwcG9ydCBiYWNrd2FyZCBpbnN0YWJpbGl0eScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHQvLyBUaGUgdXNlciBkZWxldGVzIHRleHQgYW5kIHRoZSBzdWdnZXN0aW9uIGNoYW5nZXNcblx0XHRjb25zdCBwcm92aWRlciA9IG5ldyBNb2NrSW5saW5lQ29tcGxldGlvbnNQcm92aWRlcigpO1xuXHRcdGF3YWl0IHdpdGhBc3luY1Rlc3RDb2RlRWRpdG9yQW5kSW5saW5lQ29tcGxldGlvbnNNb2RlbCgnJyxcblx0XHRcdHsgZmFrZUNsb2NrOiB0cnVlLCBwcm92aWRlciB9LFxuXHRcdFx0YXN5bmMgKHsgZWRpdG9yLCBlZGl0b3JWaWV3TW9kZWwsIG1vZGVsLCBjb250ZXh0IH0pID0+IHtcblx0XHRcdFx0Y29udGV4dC5rZXlib2FyZFR5cGUoJ2Zvb2JhJyk7XG5cblx0XHRcdFx0cHJvdmlkZXIuc2V0UmV0dXJuVmFsdWUoeyBpbnNlcnRUZXh0OiAnZm9vYmFyJywgcmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAxLCA2KSB9KTtcblxuXHRcdFx0XHRtb2RlbC50cmlnZ2VyRXhwbGljaXRseSgpO1xuXHRcdFx0XHRhd2FpdCB0aW1lb3V0KDEwMDApO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHByb3ZpZGVyLmdldEFuZENsZWFyQ2FsbEhpc3RvcnkoKSwgW1xuXHRcdFx0XHRcdHsgcG9zaXRpb246ICcoMSw2KScsIHRleHQ6ICdmb29iYScsIHRyaWdnZXJLaW5kOiAxLCB9XG5cdFx0XHRcdF0pO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNvbnRleHQuZ2V0QW5kQ2xlYXJWaWV3U3RhdGVzKCksIFsnJywgJ2Zvb2JhW3JdJ10pO1xuXG5cdFx0XHRcdHByb3ZpZGVyLnNldFJldHVyblZhbHVlKHsgaW5zZXJ0VGV4dDogJ2Zvb2JheicsIHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgMSwgNSkgfSk7XG5cdFx0XHRcdGNvbnRleHQubGVmdERlbGV0ZSgpO1xuXHRcdFx0XHRhd2FpdCB0aW1lb3V0KDEwMDApO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHByb3ZpZGVyLmdldEFuZENsZWFyQ2FsbEhpc3RvcnkoKSwgW1xuXHRcdFx0XHRcdHsgcG9zaXRpb246ICcoMSw1KScsIHRleHQ6ICdmb29iJywgdHJpZ2dlcktpbmQ6IDAsIH1cblx0XHRcdFx0XSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY29udGV4dC5nZXRBbmRDbGVhclZpZXdTdGF0ZXMoKSwgW1xuXHRcdFx0XHRcdCdmb29iW2FyXScsXG5cdFx0XHRcdFx0J2Zvb2JbYXpdJ1xuXHRcdFx0XHRdKTtcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdObyByYWNlIGNvbmRpdGlvbnMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBuZXcgTW9ja0lubGluZUNvbXBsZXRpb25zUHJvdmlkZXIoKTtcblx0XHRhd2FpdCB3aXRoQXN5bmNUZXN0Q29kZUVkaXRvckFuZElubGluZUNvbXBsZXRpb25zTW9kZWwoJycsXG5cdFx0XHR7IGZha2VDbG9jazogdHJ1ZSwgcHJvdmlkZXIsIH0sXG5cdFx0XHRhc3luYyAoeyBlZGl0b3IsIGVkaXRvclZpZXdNb2RlbCwgbW9kZWwsIGNvbnRleHQgfSkgPT4ge1xuXHRcdFx0XHRjb250ZXh0LmtleWJvYXJkVHlwZSgnaCcpO1xuXHRcdFx0XHRwcm92aWRlci5zZXRSZXR1cm5WYWx1ZSh7IGluc2VydFRleHQ6ICdoZWxsb3dvcmxkJywgcmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAxLCAyKSB9LCAxMDAwKTtcblxuXHRcdFx0XHRtb2RlbC50cmlnZ2VyRXhwbGljaXRseSgpO1xuXG5cdFx0XHRcdGF3YWl0IHRpbWVvdXQoMTAzMCk7XG5cdFx0XHRcdGNvbnRleHQua2V5Ym9hcmRUeXBlKCdlbGxvJyk7XG5cdFx0XHRcdHByb3ZpZGVyLnNldFJldHVyblZhbHVlKHsgaW5zZXJ0VGV4dDogJ2hlbGxvd29ybGQnLCByYW5nZTogbmV3IFJhbmdlKDEsIDEsIDEsIDYpIH0sIDEwMDApO1xuXG5cdFx0XHRcdC8vIGFmdGVyIDIwbXM6IElubGluZSBjb21wbGV0aW9uIHByb3ZpZGVyIGFuc3dlcnMgYmFja1xuXHRcdFx0XHQvLyBhZnRlciA1MG1zOiBEZWJvdW5jZSBpcyB0cmlnZ2VyZWRcblx0XHRcdFx0YXdhaXQgdGltZW91dCgyMDAwKTtcblxuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNvbnRleHQuZ2V0QW5kQ2xlYXJWaWV3U3RhdGVzKCksIFtcblx0XHRcdFx0XHQnJyxcblx0XHRcdFx0XHQnaGVsbG9bd29ybGRdJyxcblx0XHRcdFx0XSk7XG5cdFx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRG8gbm90IHJldXNlIGNhY2hlIGZyb20gcHJldmlvdXMgc2Vzc2lvbiAoIzEzMjUxNiknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBuZXcgTW9ja0lubGluZUNvbXBsZXRpb25zUHJvdmlkZXIoKTtcblx0XHRhd2FpdCB3aXRoQXN5bmNUZXN0Q29kZUVkaXRvckFuZElubGluZUNvbXBsZXRpb25zTW9kZWwoJycsXG5cdFx0XHR7IGZha2VDbG9jazogdHJ1ZSwgcHJvdmlkZXIsIGlubGluZVN1Z2dlc3Q6IHsgZW5hYmxlZDogdHJ1ZSB9IH0sXG5cdFx0XHRhc3luYyAoeyBlZGl0b3IsIGVkaXRvclZpZXdNb2RlbCwgbW9kZWwsIGNvbnRleHQgfSkgPT4ge1xuXHRcdFx0XHRjb250ZXh0LmtleWJvYXJkVHlwZSgnaGVsbG9cXG4nKTtcblx0XHRcdFx0Y29udGV4dC5jdXJzb3JMZWZ0KCk7XG5cdFx0XHRcdGNvbnRleHQua2V5Ym9hcmRUeXBlKCd4Jyk7XG5cdFx0XHRcdGNvbnRleHQubGVmdERlbGV0ZSgpO1xuXHRcdFx0XHRwcm92aWRlci5zZXRSZXR1cm5WYWx1ZSh7IGluc2VydFRleHQ6ICdoZWxsb3dvcmxkJywgcmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAxLCA2KSB9LCAxMDAwKTtcblx0XHRcdFx0YXdhaXQgdGltZW91dCgyMDAwKTtcblxuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHByb3ZpZGVyLmdldEFuZENsZWFyQ2FsbEhpc3RvcnkoKSwgW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHBvc2l0aW9uOiAnKDEsNiknLFxuXHRcdFx0XHRcdFx0dGV4dDogJ2hlbGxvXFxuJyxcblx0XHRcdFx0XHRcdHRyaWdnZXJLaW5kOiAwLFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XSk7XG5cblx0XHRcdFx0cHJvdmlkZXIuc2V0UmV0dXJuVmFsdWUoeyBpbnNlcnRUZXh0OiAnaGVsbG93b3JsZCcsIHJhbmdlOiBuZXcgUmFuZ2UoMiwgMSwgMiwgNikgfSwgMTAwMCk7XG5cblx0XHRcdFx0Y29udGV4dC5jdXJzb3JEb3duKCk7XG5cdFx0XHRcdGNvbnRleHQua2V5Ym9hcmRUeXBlKCdoZWxsbycpO1xuXHRcdFx0XHRhd2FpdCB0aW1lb3V0KDQwKTtcblxuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHByb3ZpZGVyLmdldEFuZENsZWFyQ2FsbEhpc3RvcnkoKSwgW10pO1xuXG5cdFx0XHRcdC8vIFVwZGF0ZSBnaG9zdCB0ZXh0XG5cdFx0XHRcdGNvbnRleHQua2V5Ym9hcmRUeXBlKCd3Jyk7XG5cdFx0XHRcdGNvbnRleHQubGVmdERlbGV0ZSgpO1xuXG5cdFx0XHRcdGF3YWl0IHRpbWVvdXQoMjAwMCk7XG5cblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwcm92aWRlci5nZXRBbmRDbGVhckNhbGxIaXN0b3J5KCksIFtcblx0XHRcdFx0XHR7IHBvc2l0aW9uOiAnKDIsNiknLCB0cmlnZ2VyS2luZDogMCwgdGV4dDogJ2hlbGxvXFxuaGVsbG8nIH0sXG5cdFx0XHRcdF0pO1xuXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY29udGV4dC5nZXRBbmRDbGVhclZpZXdTdGF0ZXMoKSwgW1xuXHRcdFx0XHRcdCcnLFxuXHRcdFx0XHRcdCdoZWxsb1t3b3JsZF1cXG4nLFxuXHRcdFx0XHRcdCdoZWxsb1xcbicsXG5cdFx0XHRcdFx0J2hlbGxvXFxuaGVsbG9bd29ybGRdJyxcblx0XHRcdFx0XSk7XG5cdFx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnQWRkaXRpb25hbCBUZXh0IEVkaXRzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHByb3ZpZGVyID0gbmV3IE1vY2tJbmxpbmVDb21wbGV0aW9uc1Byb3ZpZGVyKCk7XG5cdFx0YXdhaXQgd2l0aEFzeW5jVGVzdENvZGVFZGl0b3JBbmRJbmxpbmVDb21wbGV0aW9uc01vZGVsKCcnLFxuXHRcdFx0eyBmYWtlQ2xvY2s6IHRydWUsIHByb3ZpZGVyIH0sXG5cdFx0XHRhc3luYyAoeyBlZGl0b3IsIGVkaXRvclZpZXdNb2RlbCwgbW9kZWwsIGNvbnRleHQgfSkgPT4ge1xuXHRcdFx0XHRjb250ZXh0LmtleWJvYXJkVHlwZSgnYnV6elxcbmJheicpO1xuXHRcdFx0XHRwcm92aWRlci5zZXRSZXR1cm5WYWx1ZSh7XG5cdFx0XHRcdFx0aW5zZXJ0VGV4dDogJ2JhenonLFxuXHRcdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UoMiwgMSwgMiwgNCksXG5cdFx0XHRcdFx0YWRkaXRpb25hbFRleHRFZGl0czogW3tcblx0XHRcdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgMSwgNSksXG5cdFx0XHRcdFx0XHR0ZXh0OiAnYmxhJ1xuXHRcdFx0XHRcdH1dLFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0bW9kZWwudHJpZ2dlckV4cGxpY2l0bHkoKTtcblx0XHRcdFx0YXdhaXQgdGltZW91dCgxMDAwKTtcblxuXHRcdFx0XHRtb2RlbC5hY2NlcHQoZWRpdG9yKTtcblxuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHByb3ZpZGVyLmdldEFuZENsZWFyQ2FsbEhpc3RvcnkoKSwgKFt7IHBvc2l0aW9uOiBcIigyLDQpXCIsIHRyaWdnZXJLaW5kOiAxLCB0ZXh0OiBcImJ1enpcXG5iYXpcIiB9XSkpO1xuXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY29udGV4dC5nZXRBbmRDbGVhclZpZXdTdGF0ZXMoKSwgW1xuXHRcdFx0XHRcdCcnLFxuXHRcdFx0XHRcdCdidXp6XFxuYmF6W3pdJyxcblx0XHRcdFx0XHQnYmxhXFxuYmF6eicsXG5cdFx0XHRcdF0pO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHN1aXRlKCdpbmxpbmVDb21wbGV0aW9uTXVsdGlDdXJzb3InLCAoKSA9PiB7XG5cblx0XHR0ZXN0KCdCYXNpYycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRcdGNvbnN0IHByb3ZpZGVyID0gbmV3IE1vY2tJbmxpbmVDb21wbGV0aW9uc1Byb3ZpZGVyKCk7XG5cdFx0XHRhd2FpdCB3aXRoQXN5bmNUZXN0Q29kZUVkaXRvckFuZElubGluZUNvbXBsZXRpb25zTW9kZWwoJycsXG5cdFx0XHRcdHsgZmFrZUNsb2NrOiB0cnVlLCBwcm92aWRlciB9LFxuXHRcdFx0XHRhc3luYyAoeyBlZGl0b3IsIGVkaXRvclZpZXdNb2RlbCwgbW9kZWwsIGNvbnRleHQgfSkgPT4ge1xuXHRcdFx0XHRcdGNvbnRleHQua2V5Ym9hcmRUeXBlKCdjb25zb2xlXFxuY29uc29sZVxcbicpO1xuXHRcdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtcblx0XHRcdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMTAwMCwgMSwgMTAwMCksXG5cdFx0XHRcdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDEwMDAsIDIsIDEwMDApLFxuXHRcdFx0XHRcdF0pO1xuXHRcdFx0XHRcdHByb3ZpZGVyLnNldFJldHVyblZhbHVlKHtcblx0XHRcdFx0XHRcdGluc2VydFRleHQ6ICdjb25zb2xlLmxvZyhcImhlbGxvXCIpOycsXG5cdFx0XHRcdFx0XHRyYW5nZTogbmV3IFJhbmdlKDEsIDEsIDEsIDEwMDApLFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdG1vZGVsLnRyaWdnZXJFeHBsaWNpdGx5KCk7XG5cdFx0XHRcdFx0YXdhaXQgdGltZW91dCgxMDAwKTtcblx0XHRcdFx0XHRtb2RlbC5hY2NlcHQoZWRpdG9yKTtcblx0XHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRcdFx0ZWRpdG9yLmdldFZhbHVlKCksXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdGBjb25zb2xlLmxvZyhcImhlbGxvXCIpO2AsXG5cdFx0XHRcdFx0XHRcdGBjb25zb2xlLmxvZyhcImhlbGxvXCIpO2AsXG5cdFx0XHRcdFx0XHRcdGBgXG5cdFx0XHRcdFx0XHRdLmpvaW4oJ1xcbicpXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0fVxuXHRcdFx0KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ011bHRpIFBhcnQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCBwcm92aWRlciA9IG5ldyBNb2NrSW5saW5lQ29tcGxldGlvbnNQcm92aWRlcigpO1xuXHRcdFx0YXdhaXQgd2l0aEFzeW5jVGVzdENvZGVFZGl0b3JBbmRJbmxpbmVDb21wbGV0aW9uc01vZGVsKCcnLFxuXHRcdFx0XHR7IGZha2VDbG9jazogdHJ1ZSwgcHJvdmlkZXIgfSxcblx0XHRcdFx0YXN5bmMgKHsgZWRpdG9yLCBlZGl0b3JWaWV3TW9kZWwsIG1vZGVsLCBjb250ZXh0IH0pID0+IHtcblx0XHRcdFx0XHRjb250ZXh0LmtleWJvYXJkVHlwZSgnY29uc29sZS5sb2coKVxcbmNvbnNvbGUubG9nXFxuJyk7XG5cdFx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoW1xuXHRcdFx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxMiwgMSwgMTIpLFxuXHRcdFx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCAxMDAwLCAyLCAxMDAwKSxcblx0XHRcdFx0XHRdKTtcblx0XHRcdFx0XHRwcm92aWRlci5zZXRSZXR1cm5WYWx1ZSh7XG5cdFx0XHRcdFx0XHRpbnNlcnRUZXh0OiAnY29uc29sZS5sb2coXCJoZWxsb1wiKTsnLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAxLCAxMDAwKSxcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRtb2RlbC50cmlnZ2VyRXhwbGljaXRseSgpO1xuXHRcdFx0XHRcdGF3YWl0IHRpbWVvdXQoMTAwMCk7XG5cdFx0XHRcdFx0bW9kZWwuYWNjZXB0KGVkaXRvcik7XG5cdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0XHRcdGVkaXRvci5nZXRWYWx1ZSgpLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHRgY29uc29sZS5sb2coXCJoZWxsb1wiKTtgLFxuXHRcdFx0XHRcdFx0XHRgY29uc29sZS5sb2coXCJoZWxsb1wiKTtgLFxuXHRcdFx0XHRcdFx0XHRgYFxuXHRcdFx0XHRcdFx0XS5qb2luKCdcXG4nKVxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdNdWx0aSBQYXJ0IGFuZCBEaWZmZXJlbnQgQ3Vyc29yIENvbHVtbnMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCBwcm92aWRlciA9IG5ldyBNb2NrSW5saW5lQ29tcGxldGlvbnNQcm92aWRlcigpO1xuXHRcdFx0YXdhaXQgd2l0aEFzeW5jVGVzdENvZGVFZGl0b3JBbmRJbmxpbmVDb21wbGV0aW9uc01vZGVsKCcnLFxuXHRcdFx0XHR7IGZha2VDbG9jazogdHJ1ZSwgcHJvdmlkZXIgfSxcblx0XHRcdFx0YXN5bmMgKHsgZWRpdG9yLCBlZGl0b3JWaWV3TW9kZWwsIG1vZGVsLCBjb250ZXh0IH0pID0+IHtcblx0XHRcdFx0XHRjb250ZXh0LmtleWJvYXJkVHlwZSgnY29uc29sZS5sb2coKVxcbmNvbnNvbGUud2FyblxcbicpO1xuXHRcdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtcblx0XHRcdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMTIsIDEsIDEyKSxcblx0XHRcdFx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgMTQsIDIsIDE0KSxcblx0XHRcdFx0XHRdKTtcblx0XHRcdFx0XHRwcm92aWRlci5zZXRSZXR1cm5WYWx1ZSh7XG5cdFx0XHRcdFx0XHRpbnNlcnRUZXh0OiAnY29uc29sZS5sb2coXCJoZWxsb1wiKTsnLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAxLCAxMDAwKSxcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRtb2RlbC50cmlnZ2VyRXhwbGljaXRseSgpO1xuXHRcdFx0XHRcdGF3YWl0IHRpbWVvdXQoMTAwMCk7XG5cdFx0XHRcdFx0bW9kZWwuYWNjZXB0KGVkaXRvcik7XG5cdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0XHRcdGVkaXRvci5nZXRWYWx1ZSgpLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHRgY29uc29sZS5sb2coXCJoZWxsb1wiKTtgLFxuXHRcdFx0XHRcdFx0XHRgY29uc29sZS53YXJuKFwiaGVsbG9cIik7YCxcblx0XHRcdFx0XHRcdFx0YGBcblx0XHRcdFx0XHRcdF0uam9pbignXFxuJylcblx0XHRcdFx0XHQpO1xuXHRcdFx0XHR9XG5cdFx0XHQpO1xuXHRcdH0pO1xuXG5cdFx0YXN5bmMgZnVuY3Rpb24gYWNjZXB0TmV4dFdvcmQobW9kZWw6IElubGluZUNvbXBsZXRpb25zTW9kZWwsIGVkaXRvcjogSVRlc3RDb2RlRWRpdG9yLCB0aW1lc1RvQWNjZXB0OiBudW1iZXIgPSAxKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRpbWVzVG9BY2NlcHQ7IGkrKykge1xuXHRcdFx0XHRtb2RlbC50cmlnZ2VyRXhwbGljaXRseSgpO1xuXHRcdFx0XHRhd2FpdCB0aW1lb3V0KDEwMDApO1xuXHRcdFx0XHRhd2FpdCBtb2RlbC5hY2NlcHROZXh0V29yZChlZGl0b3IpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRlc3QoJ0Jhc2ljIFBhcnRpYWwgQ29tcGxldGlvbicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRcdGNvbnN0IHByb3ZpZGVyID0gbmV3IE1vY2tJbmxpbmVDb21wbGV0aW9uc1Byb3ZpZGVyKCk7XG5cdFx0XHRhd2FpdCB3aXRoQXN5bmNUZXN0Q29kZUVkaXRvckFuZElubGluZUNvbXBsZXRpb25zTW9kZWwoJycsXG5cdFx0XHRcdHsgZmFrZUNsb2NrOiB0cnVlLCBwcm92aWRlciB9LFxuXHRcdFx0XHRhc3luYyAoeyBlZGl0b3IsIGVkaXRvclZpZXdNb2RlbCwgbW9kZWwsIGNvbnRleHQgfSkgPT4ge1xuXHRcdFx0XHRcdGNvbnRleHQua2V5Ym9hcmRUeXBlKCdsZXRcXG5sZXRcXG4nKTtcblx0XHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9ucyhbXG5cdFx0XHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEwMDAsIDEsIDEwMDApLFxuXHRcdFx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCAxMDAwLCAyLCAxMDAwKSxcblx0XHRcdFx0XHRdKTtcblxuXHRcdFx0XHRcdHByb3ZpZGVyLnNldFJldHVyblZhbHVlKHtcblx0XHRcdFx0XHRcdGluc2VydFRleHQ6IGBsZXQgYSA9ICdzb21lIHdvcmQnOyBgLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAxLCAxMDAwKSxcblx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdGF3YWl0IGFjY2VwdE5leHRXb3JkKG1vZGVsLCBlZGl0b3IsIDIpO1xuXG5cdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0XHRcdGVkaXRvci5nZXRWYWx1ZSgpLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHRgbGV0IGFgLFxuXHRcdFx0XHRcdFx0XHRgbGV0IGFgLFxuXHRcdFx0XHRcdFx0XHRgYFxuXHRcdFx0XHRcdFx0XS5qb2luKCdcXG4nKVxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdQYXJ0aWFsIE11bHRpLVBhcnQgQ29tcGxldGlvbicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRcdGNvbnN0IHByb3ZpZGVyID0gbmV3IE1vY2tJbmxpbmVDb21wbGV0aW9uc1Byb3ZpZGVyKCk7XG5cdFx0XHRhd2FpdCB3aXRoQXN5bmNUZXN0Q29kZUVkaXRvckFuZElubGluZUNvbXBsZXRpb25zTW9kZWwoJycsXG5cdFx0XHRcdHsgZmFrZUNsb2NrOiB0cnVlLCBwcm92aWRlciB9LFxuXHRcdFx0XHRhc3luYyAoeyBlZGl0b3IsIGVkaXRvclZpZXdNb2RlbCwgbW9kZWwsIGNvbnRleHQgfSkgPT4ge1xuXHRcdFx0XHRcdGNvbnRleHQua2V5Ym9hcmRUeXBlKCdmb3IgKClcXG5mb3IgXFxuJyk7XG5cdFx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoW1xuXHRcdFx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCA1LCAxLCA1KSxcblx0XHRcdFx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgMTAwMCwgMiwgMTAwMCksXG5cdFx0XHRcdFx0XSk7XG5cblx0XHRcdFx0XHRwcm92aWRlci5zZXRSZXR1cm5WYWx1ZSh7XG5cdFx0XHRcdFx0XHRpbnNlcnRUZXh0OiBgZm9yIChsZXQgaSA9IDA7IGkgPCAxMDsgaSsrKSB7YCxcblx0XHRcdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgMSwgMTAwMCksXG5cdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHRtb2RlbC50cmlnZ2VyRXhwbGljaXRseSgpO1xuXHRcdFx0XHRcdGF3YWl0IHRpbWVvdXQoMTAwMCk7XG5cblx0XHRcdFx0XHRhd2FpdCBhY2NlcHROZXh0V29yZChtb2RlbCwgZWRpdG9yLCAzKTtcblxuXHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdFx0XHRlZGl0b3IuZ2V0VmFsdWUoKSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0YGZvciAobGV0IGkpYCxcblx0XHRcdFx0XHRcdFx0YGZvciAobGV0IGlgLFxuXHRcdFx0XHRcdFx0XHRgYFxuXHRcdFx0XHRcdFx0XS5qb2luKCdcXG4nKVxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdQYXJ0aWFsIE11dGxpLVBhcnQgYW5kIERpZmZlcmVudCBDdXJzb3IgQ29sdW1ucyBDb21wbGV0aW9uJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdFx0Y29uc3QgcHJvdmlkZXIgPSBuZXcgTW9ja0lubGluZUNvbXBsZXRpb25zUHJvdmlkZXIoKTtcblx0XHRcdGF3YWl0IHdpdGhBc3luY1Rlc3RDb2RlRWRpdG9yQW5kSW5saW5lQ29tcGxldGlvbnNNb2RlbCgnJyxcblx0XHRcdFx0eyBmYWtlQ2xvY2s6IHRydWUsIHByb3ZpZGVyIH0sXG5cdFx0XHRcdGFzeW5jICh7IGVkaXRvciwgZWRpdG9yVmlld01vZGVsLCBtb2RlbCwgY29udGV4dCB9KSA9PiB7XG5cdFx0XHRcdFx0Y29udGV4dC5rZXlib2FyZFR5cGUoYGNvbnNvbGUubG9nKClcXG5jb25zb2xlLndhcm5ubm5cXG5gKTtcblx0XHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9ucyhbXG5cdFx0XHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEyLCAxLCAxMiksXG5cdFx0XHRcdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDE2LCAyLCAxNiksXG5cdFx0XHRcdFx0XSk7XG5cblx0XHRcdFx0XHRwcm92aWRlci5zZXRSZXR1cm5WYWx1ZSh7XG5cdFx0XHRcdFx0XHRpbnNlcnRUZXh0OiBgY29uc29sZS5sb2coXCJoZWxsb1wiICsgXCIgXCIgKyBcIndvcmxkXCIpO2AsXG5cdFx0XHRcdFx0XHRyYW5nZTogbmV3IFJhbmdlKDEsIDEsIDEsIDEwMDApLFxuXHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0bW9kZWwudHJpZ2dlckV4cGxpY2l0bHkoKTtcblx0XHRcdFx0XHRhd2FpdCB0aW1lb3V0KDEwMDApO1xuXG5cdFx0XHRcdFx0YXdhaXQgYWNjZXB0TmV4dFdvcmQobW9kZWwsIGVkaXRvciwgNCk7XG5cblx0XHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRcdFx0ZWRpdG9yLmdldFZhbHVlKCksXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdGBjb25zb2xlLmxvZyhcImhlbGxvXCIgKyApYCxcblx0XHRcdFx0XHRcdFx0YGNvbnNvbGUud2Fybm5ubihcImhlbGxvXCIgKyBgLFxuXHRcdFx0XHRcdFx0XHRgYFxuXHRcdFx0XHRcdFx0XS5qb2luKCdcXG4nKVxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG5cbmFzeW5jIGZ1bmN0aW9uIHdpdGhBc3luY1Rlc3RDb2RlRWRpdG9yQW5kSW5saW5lQ29tcGxldGlvbnNNb2RlbDxUPihcblx0dGV4dDogc3RyaW5nLFxuXHRvcHRpb25zOiBUZXN0Q29kZUVkaXRvckluc3RhbnRpYXRpb25PcHRpb25zICYgeyBwcm92aWRlcj86IElubGluZUNvbXBsZXRpb25zUHJvdmlkZXI7IGZha2VDbG9jaz86IGJvb2xlYW4gfSxcblx0Y2FsbGJhY2s6IChhcmdzOiB7IGVkaXRvcjogSVRlc3RDb2RlRWRpdG9yOyBlZGl0b3JWaWV3TW9kZWw6IFZpZXdNb2RlbDsgbW9kZWw6IElubGluZUNvbXBsZXRpb25zTW9kZWw7IGNvbnRleHQ6IEdob3N0VGV4dENvbnRleHQgfSkgPT4gUHJvbWlzZTxUPlxuKTogUHJvbWlzZTxUPiB7XG5cdHJldHVybiBhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnMoe1xuXHRcdHVzZUZha2VUaW1lcnM6IG9wdGlvbnMuZmFrZUNsb2NrLFxuXHR9LCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZVN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGlmIChvcHRpb25zLnByb3ZpZGVyKSB7XG5cdFx0XHRcdGNvbnN0IGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlID0gbmV3IExhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlKCk7XG5cdFx0XHRcdGlmICghb3B0aW9ucy5zZXJ2aWNlQ29sbGVjdGlvbikge1xuXHRcdFx0XHRcdG9wdGlvbnMuc2VydmljZUNvbGxlY3Rpb24gPSBuZXcgU2VydmljZUNvbGxlY3Rpb24oKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRvcHRpb25zLnNlcnZpY2VDb2xsZWN0aW9uLnNldChJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UsIGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlKTtcblx0XHRcdFx0b3B0aW9ucy5zZXJ2aWNlQ29sbGVjdGlvbi5zZXQoSUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLCB7XG5cdFx0XHRcdFx0cGxheVNpZ25hbDogYXN5bmMgKCkgPT4geyB9LFxuXHRcdFx0XHRcdGlzU291bmRFbmFibGVkKHNpZ25hbDogdW5rbm93bikgeyByZXR1cm4gZmFsc2U7IH0sXG5cdFx0XHRcdH0gYXMgYW55KTtcblx0XHRcdFx0Y29uc3QgZCA9IGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmlubGluZUNvbXBsZXRpb25zUHJvdmlkZXIucmVnaXN0ZXIoeyBwYXR0ZXJuOiAnKionIH0sIG9wdGlvbnMucHJvdmlkZXIpO1xuXHRcdFx0XHRkaXNwb3NhYmxlU3RvcmUuYWRkKGQpO1xuXHRcdFx0fVxuXG5cdFx0XHRsZXQgcmVzdWx0OiBUO1xuXHRcdFx0YXdhaXQgd2l0aEFzeW5jVGVzdENvZGVFZGl0b3IodGV4dCwgb3B0aW9ucywgYXN5bmMgKGVkaXRvciwgZWRpdG9yVmlld01vZGVsLCBpbnN0YW50aWF0aW9uU2VydmljZSkgPT4ge1xuXHRcdFx0XHRjb25zdCBjb250cm9sbGVyID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoSW5saW5lQ29tcGxldGlvbnNDb250cm9sbGVyLCBlZGl0b3IpO1xuXHRcdFx0XHRjb25zdCBtb2RlbCA9IGNvbnRyb2xsZXIubW9kZWwuZ2V0KCkhO1xuXHRcdFx0XHRjb25zdCBjb250ZXh0ID0gbmV3IEdob3N0VGV4dENvbnRleHQobW9kZWwsIGVkaXRvcik7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0cmVzdWx0ID0gYXdhaXQgY2FsbGJhY2soeyBlZGl0b3IsIGVkaXRvclZpZXdNb2RlbCwgbW9kZWwsIGNvbnRleHQgfSk7XG5cdFx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdFx0Y29udGV4dC5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdGNvbnRyb2xsZXIuZGlzcG9zZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0aWYgKG9wdGlvbnMucHJvdmlkZXIgaW5zdGFuY2VvZiBNb2NrSW5saW5lQ29tcGxldGlvbnNQcm92aWRlcikge1xuXHRcdFx0XHRvcHRpb25zLnByb3ZpZGVyLmFzc2VydE5vdENhbGxlZFR3aWNlV2l0aGluNTBtcygpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gcmVzdWx0ITtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0ZGlzcG9zYWJsZVN0b3JlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsZUFBZTtBQUN4QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLCtDQUErQztBQUN4RCxTQUFTLGFBQWE7QUFFdEIsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUywrQkFBK0I7QUFFeEMsU0FBUyxtQ0FBbUM7QUFFNUMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxrQkFBa0IscUNBQXFDO0FBQ2hFLFNBQThELCtCQUErQjtBQUM3RixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLG1DQUFtQztBQUM1QyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLHdCQUF3QjtBQUVqQyxNQUFNLHNCQUFzQixNQUFNO0FBQ2pDLDBDQUF3QztBQUV4QyxRQUFNLCtCQUErQixNQUFNO0FBRTFDLGFBQVMsVUFBVSxNQUFjLFlBQTZCO0FBQzdELFlBQU0sbUJBQW1CLEtBQUssUUFBUSxHQUFHO0FBQ3pDLFlBQU0saUJBQWlCLEtBQUssUUFBUSxHQUFHLElBQUk7QUFDM0MsWUFBTSxjQUFjLEtBQUssUUFBUSxLQUFLLEVBQUUsRUFBRSxRQUFRLEtBQUssRUFBRTtBQUN6RCxZQUFNLFlBQVksZ0JBQWdCLFdBQVc7QUFDN0MsWUFBTSxRQUFRLE1BQU0sY0FBYyxVQUFVLGNBQWMsZ0JBQWdCLEdBQUcsVUFBVSxjQUFjLGNBQWMsQ0FBQztBQUNwSCxZQUFNLFVBQVUs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
