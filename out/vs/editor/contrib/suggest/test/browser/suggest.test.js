import assert from "assert";
import { URI } from "../../../../../base/common/uri.js";
import { Position } from "../../../../common/core/position.js";
import { Range } from "../../../../common/core/range.js";
import { CompletionItemKind } from "../../../../common/languages.js";
import { CompletionOptions, provideSuggestionItems, SnippetSortOrder } from "../../browser/suggest.js";
import { createTextModel } from "../../../../test/common/testTextModel.js";
import { LanguageFeatureRegistry } from "../../../../common/languageFeatureRegistry.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
suite("Suggest", function() {
  let model;
  let registration;
  let registry;
  setup(function() {
    registry = new LanguageFeatureRegistry();
    model = createTextModel("FOO\nbarBAR\nfoo", void 0, void 0, URI.parse("foo:bar/path"));
    registration = registry.register({ pattern: "bar/path", scheme: "foo" }, {
      _debugDisplayName: "test",
      provideCompletionItems(_doc, pos) {
        return {
          incomplete: false,
          suggestions: [{
            label: "aaa",
            kind: CompletionItemKind.Snippet,
            insertText: "aaa",
            range: Range.fromPositions(pos)
          }, {
            label: "zzz",
            kind: CompletionItemKind.Snippet,
            insertText: "zzz",
            range: Range.fromPositions(pos)
          }, {
            label: "fff",
            kind: CompletionItemKind.Property,
            insertText: "fff",
            range: Range.fromPositions(pos)
          }]
        };
      }
    });
  });
  teardown(() => {
    registration.dispose();
    model.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("sort - snippet inline", async function() {
    const { items, disposable } = await provideSuggestionItems(registry, model, new Position(1, 1), new CompletionOptions(SnippetSortOrder.Inline));
    assert.strictEqual(items.length, 3);
    assert.strictEqual(items[0].completion.label, "aaa");
    assert.strictEqual(items[1].completion.label, "fff");
    assert.strictEqual(items[2].completion.label, "zzz");
    disposable.dispose();
  });
  test("sort - snippet top", async function() {
    const { items, disposable } = await provideSuggestionItems(registry, model, new Position(1, 1), new CompletionOptions(SnippetSortOrder.Top));
    assert.strictEqual(items.length, 3);
    assert.strictEqual(items[0].completion.label, "aaa");
    assert.strictEqual(items[1].completion.label, "zzz");
    assert.strictEqual(items[2].completion.label, "fff");
    disposable.dispose();
  });
  test("sort - snippet bottom", async function() {
    const { items, disposable } = await provideSuggestionItems(registry, model, new Position(1, 1), new CompletionOptions(SnippetSortOrder.Bottom));
    assert.strictEqual(items.length, 3);
    assert.strictEqual(items[0].completion.label, "fff");
    assert.strictEqual(items[1].completion.label, "aaa");
    assert.strictEqual(items[2].completion.label, "zzz");
    disposable.dispose();
  });
  test("sort - snippet none", async function() {
    const { items, disposable } = await provideSuggestionItems(registry, model, new Position(1, 1), new CompletionOptions(void 0, (/* @__PURE__ */ new Set()).add(CompletionItemKind.Snippet)));
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].completion.label, "fff");
    disposable.dispose();
  });
  test("only from", function(callback) {
    const foo = {
      triggerCharacters: [],
      provideCompletionItems() {
        return {
          currentWord: "",
          incomplete: false,
          suggestions: [{
            label: "jjj",
            type: "property",
            insertText: "jjj"
          }]
        };
      }
    };
    const registration2 = registry.register({ pattern: "bar/path", scheme: "foo" }, foo);
    provideSuggestionItems(registry, model, new Position(1, 1), new CompletionOptions(void 0, void 0, (/* @__PURE__ */ new Set()).add(foo))).then(({ items, disposable }) => {
      registration2.dispose();
      assert.strictEqual(items.length, 1);
      assert.ok(items[0].provider === foo);
      disposable.dispose();
      callback();
    });
  });
  test("Ctrl+space completions stopped working with the latest Insiders, #97650", async function() {
    const foo = new class {
      constructor() {
        this._debugDisplayName = "test";
        this.triggerCharacters = [];
      }
      provideCompletionItems() {
        return {
          suggestions: [{
            label: "one",
            kind: CompletionItemKind.Class,
            insertText: "one",
            range: {
              insert: new Range(0, 0, 0, 0),
              replace: new Range(0, 0, 0, 10)
            }
          }, {
            label: "two",
            kind: CompletionItemKind.Class,
            insertText: "two",
            range: {
              insert: new Range(0, 0, 0, 0),
              replace: new Range(0, 1, 0, 10)
            }
          }]
        };
      }
    }();
    const registration2 = registry.register({ pattern: "bar/path", scheme: "foo" }, foo);
    const { items, disposable } = await provideSuggestionItems(registry, model, new Position(0, 0), new CompletionOptions(void 0, void 0, (/* @__PURE__ */ new Set()).add(foo)));
    registration2.dispose();
    assert.strictEqual(items.length, 2);
    const [a, b] = items;
    assert.strictEqual(a.completion.label, "one");
    assert.strictEqual(a.isInvalid, false);
    assert.strictEqual(b.completion.label, "two");
    assert.strictEqual(b.isInvalid, true);
    disposable.dispose();
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9zdWdnZXN0L3Rlc3QvYnJvd3Nlci9zdWdnZXN0LnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbW9kZWwvdGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IENvbXBsZXRpb25JdGVtS2luZCwgQ29tcGxldGlvbkl0ZW1Qcm92aWRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgQ29tcGxldGlvbk9wdGlvbnMsIHByb3ZpZGVTdWdnZXN0aW9uSXRlbXMsIFNuaXBwZXRTb3J0T3JkZXIgfSBmcm9tICcuLi8uLi9icm93c2VyL3N1Z2dlc3QuanMnO1xuaW1wb3J0IHsgY3JlYXRlVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9jb21tb24vdGVzdFRleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBMYW5ndWFnZUZlYXR1cmVSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZUZlYXR1cmVSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcblxuXG5zdWl0ZSgnU3VnZ2VzdCcsIGZ1bmN0aW9uICgpIHtcblx0bGV0IG1vZGVsOiBUZXh0TW9kZWw7XG5cdGxldCByZWdpc3RyYXRpb246IElEaXNwb3NhYmxlO1xuXHRsZXQgcmVnaXN0cnk6IExhbmd1YWdlRmVhdHVyZVJlZ2lzdHJ5PENvbXBsZXRpb25JdGVtUHJvdmlkZXI+O1xuXG5cdHNldHVwKGZ1bmN0aW9uICgpIHtcblx0XHRyZWdpc3RyeSA9IG5ldyBMYW5ndWFnZUZlYXR1cmVSZWdpc3RyeSgpO1xuXHRcdG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKCdGT09cXG5iYXJcXEJBUlxcbmZvbycsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBVUkkucGFyc2UoJ2ZvbzpiYXIvcGF0aCcpKTtcblx0XHRyZWdpc3RyYXRpb24gPSByZWdpc3RyeS5yZWdpc3Rlcih7IHBhdHRlcm46ICdiYXIvcGF0aCcsIHNjaGVtZTogJ2ZvbycgfSwge1xuXHRcdFx0X2RlYnVnRGlzcGxheU5hbWU6ICd0ZXN0Jyxcblx0XHRcdHByb3ZpZGVDb21wbGV0aW9uSXRlbXMoX2RvYywgcG9zKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0aW5jb21wbGV0ZTogZmFsc2UsXG5cdFx0XHRcdFx0c3VnZ2VzdGlvbnM6IFt7XG5cdFx0XHRcdFx0XHRsYWJlbDogJ2FhYScsXG5cdFx0XHRcdFx0XHRraW5kOiBDb21wbGV0aW9uSXRlbUtpbmQuU25pcHBldCxcblx0XHRcdFx0XHRcdGluc2VydFRleHQ6ICdhYWEnLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IFJhbmdlLmZyb21Qb3NpdGlvbnMocG9zKVxuXHRcdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRcdGxhYmVsOiAnenp6Jyxcblx0XHRcdFx0XHRcdGtpbmQ6IENvbXBsZXRpb25JdGVtS2luZC5TbmlwcGV0LFxuXHRcdFx0XHRcdFx0aW5zZXJ0VGV4dDogJ3p6eicsXG5cdFx0XHRcdFx0XHRyYW5nZTogUmFuZ2UuZnJvbVBvc2l0aW9ucyhwb3MpXG5cdFx0XHRcdFx0fSwge1xuXHRcdFx0XHRcdFx0bGFiZWw6ICdmZmYnLFxuXHRcdFx0XHRcdFx0a2luZDogQ29tcGxldGlvbkl0ZW1LaW5kLlByb3BlcnR5LFxuXHRcdFx0XHRcdFx0aW5zZXJ0VGV4dDogJ2ZmZicsXG5cdFx0XHRcdFx0XHRyYW5nZTogUmFuZ2UuZnJvbVBvc2l0aW9ucyhwb3MpXG5cdFx0XHRcdFx0fV1cblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9KTtcblx0fSk7XG5cblx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdHJlZ2lzdHJhdGlvbi5kaXNwb3NlKCk7XG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdzb3J0IC0gc25pcHBldCBpbmxpbmUnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgeyBpdGVtcywgZGlzcG9zYWJsZSB9ID0gYXdhaXQgcHJvdmlkZVN1Z2dlc3Rpb25JdGVtcyhyZWdpc3RyeSwgbW9kZWwsIG5ldyBQb3NpdGlvbigxLCAxKSwgbmV3IENvbXBsZXRpb25PcHRpb25zKFNuaXBwZXRTb3J0T3JkZXIuSW5saW5lKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZW1zLmxlbmd0aCwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZW1zWzBdLmNvbXBsZXRpb24ubGFiZWwsICdhYWEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlbXNbMV0uY29tcGxldGlvbi5sYWJlbCwgJ2ZmZicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVtc1syXS5jb21wbGV0aW9uLmxhYmVsLCAnenp6Jyk7XG5cdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NvcnQgLSBzbmlwcGV0IHRvcCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB7IGl0ZW1zLCBkaXNwb3NhYmxlIH0gPSBhd2FpdCBwcm92aWRlU3VnZ2VzdGlvbkl0ZW1zKHJlZ2lzdHJ5LCBtb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDEpLCBuZXcgQ29tcGxldGlvbk9wdGlvbnMoU25pcHBldFNvcnRPcmRlci5Ub3ApKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlbXMubGVuZ3RoLCAzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlbXNbMF0uY29tcGxldGlvbi5sYWJlbCwgJ2FhYScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVtc1sxXS5jb21wbGV0aW9uLmxhYmVsLCAnenp6Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZW1zWzJdLmNvbXBsZXRpb24ubGFiZWwsICdmZmYnKTtcblx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnc29ydCAtIHNuaXBwZXQgYm90dG9tJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHsgaXRlbXMsIGRpc3Bvc2FibGUgfSA9IGF3YWl0IHByb3ZpZGVTdWdnZXN0aW9uSXRlbXMocmVnaXN0cnksIG1vZGVsLCBuZXcgUG9zaXRpb24oMSwgMSksIG5ldyBDb21wbGV0aW9uT3B0aW9ucyhTbmlwcGV0U29ydE9yZGVyLkJvdHRvbSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVtcy5sZW5ndGgsIDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVtc1swXS5jb21wbGV0aW9uLmxhYmVsLCAnZmZmJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZW1zWzFdLmNvbXBsZXRpb24ubGFiZWwsICdhYWEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlbXNbMl0uY29tcGxldGlvbi5sYWJlbCwgJ3p6eicpO1xuXHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdzb3J0IC0gc25pcHBldCBub25lJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHsgaXRlbXMsIGRpc3Bvc2FibGUgfSA9IGF3YWl0IHByb3ZpZGVTdWdnZXN0aW9uSXRlbXMocmVnaXN0cnksIG1vZGVsLCBuZXcgUG9zaXRpb24oMSwgMSksIG5ldyBDb21wbGV0aW9uT3B0aW9ucyh1bmRlZmluZWQsIG5ldyBTZXQ8Q29tcGxldGlvbkl0ZW1LaW5kPigpLmFkZChDb21wbGV0aW9uSXRlbUtpbmQuU25pcHBldCkpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlbXMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlbXNbMF0uY29tcGxldGlvbi5sYWJlbCwgJ2ZmZicpO1xuXHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdvbmx5IGZyb20nLCBmdW5jdGlvbiAoY2FsbGJhY2spIHtcblxuXHRcdGNvbnN0IGZvbzogYW55ID0ge1xuXHRcdFx0dHJpZ2dlckNoYXJhY3RlcnM6IFtdLFxuXHRcdFx0cHJvdmlkZUNvbXBsZXRpb25JdGVtcygpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRjdXJyZW50V29yZDogJycsXG5cdFx0XHRcdFx0aW5jb21wbGV0ZTogZmFsc2UsXG5cdFx0XHRcdFx0c3VnZ2VzdGlvbnM6IFt7XG5cdFx0XHRcdFx0XHRsYWJlbDogJ2pqaicsXG5cdFx0XHRcdFx0XHR0eXBlOiAncHJvcGVydHknLFxuXHRcdFx0XHRcdFx0aW5zZXJ0VGV4dDogJ2pqaidcblx0XHRcdFx0XHR9XVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0Y29uc3QgcmVnaXN0cmF0aW9uID0gcmVnaXN0cnkucmVnaXN0ZXIoeyBwYXR0ZXJuOiAnYmFyL3BhdGgnLCBzY2hlbWU6ICdmb28nIH0sIGZvbyk7XG5cblx0XHRwcm92aWRlU3VnZ2VzdGlvbkl0ZW1zKHJlZ2lzdHJ5LCBtb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDEpLCBuZXcgQ29tcGxldGlvbk9wdGlvbnModW5kZWZpbmVkLCB1bmRlZmluZWQsIG5ldyBTZXQ8Q29tcGxldGlvbkl0ZW1Qcm92aWRlcj4oKS5hZGQoZm9vKSkpLnRoZW4oKHsgaXRlbXMsIGRpc3Bvc2FibGUgfSkgPT4ge1xuXHRcdFx0cmVnaXN0cmF0aW9uLmRpc3Bvc2UoKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZW1zLmxlbmd0aCwgMSk7XG5cdFx0XHRhc3NlcnQub2soaXRlbXNbMF0ucHJvdmlkZXIgPT09IGZvbyk7XG5cdFx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRcdGNhbGxiYWNrKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0N0cmwrc3BhY2UgY29tcGxldGlvbnMgc3RvcHBlZCB3b3JraW5nIHdpdGggdGhlIGxhdGVzdCBJbnNpZGVycywgIzk3NjUwJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cblx0XHRjb25zdCBmb28gPSBuZXcgY2xhc3MgaW1wbGVtZW50cyBDb21wbGV0aW9uSXRlbVByb3ZpZGVyIHtcblxuXHRcdFx0X2RlYnVnRGlzcGxheU5hbWUgPSAndGVzdCc7XG5cdFx0XHR0cmlnZ2VyQ2hhcmFjdGVycyA9IFtdO1xuXG5cdFx0XHRwcm92aWRlQ29tcGxldGlvbkl0ZW1zKCkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHN1Z2dlc3Rpb25zOiBbe1xuXHRcdFx0XHRcdFx0bGFiZWw6ICdvbmUnLFxuXHRcdFx0XHRcdFx0a2luZDogQ29tcGxldGlvbkl0ZW1LaW5kLkNsYXNzLFxuXHRcdFx0XHRcdFx0aW5zZXJ0VGV4dDogJ29uZScsXG5cdFx0XHRcdFx0XHRyYW5nZToge1xuXHRcdFx0XHRcdFx0XHRpbnNlcnQ6IG5ldyBSYW5nZSgwLCAwLCAwLCAwKSxcblx0XHRcdFx0XHRcdFx0cmVwbGFjZTogbmV3IFJhbmdlKDAsIDAsIDAsIDEwKVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRcdGxhYmVsOiAndHdvJyxcblx0XHRcdFx0XHRcdGtpbmQ6IENvbXBsZXRpb25JdGVtS2luZC5DbGFzcyxcblx0XHRcdFx0XHRcdGluc2VydFRleHQ6ICd0d28nLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IHtcblx0XHRcdFx0XHRcdFx0aW5zZXJ0OiBuZXcgUmFuZ2UoMCwgMCwgMCwgMCksXG5cdFx0XHRcdFx0XHRcdHJlcGxhY2U6IG5ldyBSYW5nZSgwLCAxLCAwLCAxMClcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRjb25zdCByZWdpc3RyYXRpb24gPSByZWdpc3RyeS5yZWdpc3Rlcih7IHBhdHRlcm46ICdiYXIvcGF0aCcsIHNjaGVtZTogJ2ZvbycgfSwgZm9vKTtcblx0XHRjb25zdCB7IGl0ZW1zLCBkaXNwb3NhYmxlIH0gPSBhd2FpdCBwcm92aWRlU3VnZ2VzdGlvbkl0ZW1zKHJlZ2lzdHJ5LCBtb2RlbCwgbmV3IFBvc2l0aW9uKDAsIDApLCBuZXcgQ29tcGxldGlvbk9wdGlvbnModW5kZWZpbmVkLCB1bmRlZmluZWQsIG5ldyBTZXQ8Q29tcGxldGlvbkl0ZW1Qcm92aWRlcj4oKS5hZGQoZm9vKSkpO1xuXHRcdHJlZ2lzdHJhdGlvbi5kaXNwb3NlKCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlbXMubGVuZ3RoLCAyKTtcblx0XHRjb25zdCBbYSwgYl0gPSBpdGVtcztcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhLmNvbXBsZXRpb24ubGFiZWwsICdvbmUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYS5pc0ludmFsaWQsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYi5jb21wbGV0aW9uLmxhYmVsLCAndHdvJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGIuaXNJbnZhbGlkLCB0cnVlKTtcblx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUlBLE9BQU8sWUFBWTtBQUVuQixTQUFTLFdBQVc7QUFDcEIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxhQUFhO0FBRXRCLFNBQVMsMEJBQWtEO0FBQzNELFNBQVMsbUJBQW1CLHdCQUF3Qix3QkFBd0I7QUFDNUUsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUywrQkFBK0I7QUFDeEMsU0FBUywrQ0FBK0M7QUFHeEQsTUFBTSxXQUFXLFdBQVk7QUFDNUIsTUFBSTtBQUNKLE1BQUk7QUFDSixNQUFJO0FBRUosUUFBTSxXQUFZO0FBQ2pCLGVBQVcsSUFBSSx3QkFBd0I7QUFDdkMsWUFBUSxnQkFBZ0Isb0JBQXFCLFFBQVcsUUFBVyxJQUFJLE1BQU0sY0FBYyxDQUFDO0FBQzVGLG1CQUFlLFNBQVMsU0FBUyxFQUFFLFNBQVMsWUFBWSxRQUFRLE1BQU0sR0FBRztBQUFBLE1BQ3hFLG1CQUFtQjtBQUFBLE1BQ25CLHVCQUF1QixNQUFNLEtBQUs7QUFDakMsZUFBTztBQUFBLFVBQ04sWUFBWTtBQUFBLFVBQ1osYUFBYSxDQUFDO0FBQUEsWUFDYixPQUFPO0FBQUEsWUFDUCxNQUFNLG1CQUFtQjtBQUFBLFlBQ3pCLFlBQVk7QUFBQSxZQUNaLE9BQU8sTUFBTSxjQUFjLEdBQUc7QUFBQSxVQUMvQixHQUFHO0FBQUEsWUFDRixP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
