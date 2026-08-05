import assert from "assert";
import { promiseWithResolvers } from "../../../../../base/common/async.js";
import { assertType } from "../../../../../base/common/types.js";
import { URI } from "../../../../../base/common/uri.js";
import { runWithFakedTimers } from "../../../../../base/test/common/timeTravelScheduler.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { MockContextKeyService } from "../../../../../platform/keybinding/test/common/mockKeybindingService.js";
import { MarkerService } from "../../../../../platform/markers/common/markerService.js";
import { LanguageFeatureRegistry } from "../../../../common/languageFeatureRegistry.js";
import * as languages from "../../../../common/languages.js";
import { createTestCodeEditor } from "../../../../test/browser/testCodeEditor.js";
import { createTextModel } from "../../../../test/common/testTextModel.js";
import { CodeActionModel, CodeActionsState } from "../../browser/codeActionModel.js";
const testProvider = {
  provideCodeActions() {
    return {
      actions: [
        { title: "test", command: { id: "test-command", title: "test", arguments: [] } }
      ],
      dispose() {
      }
    };
  }
};
suite("CodeActionModel", () => {
  const languageId = "foo-lang";
  const uri = URI.parse("untitled:path");
  let model;
  let markerService;
  let editor;
  let registry;
  setup(() => {
    markerService = new MarkerService();
    model = createTextModel("foobar  foo bar\nfarboo far boo", languageId, void 0, uri);
    editor = createTestCodeEditor(model);
    editor.setPosition({ lineNumber: 1, column: 1 });
    registry = new LanguageFeatureRegistry();
  });
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  teardown(() => {
    editor.dispose();
    model.dispose();
    markerService.dispose();
  });
  test("Oracle -> marker added", async () => {
    const { promise: donePromise, resolve: done } = promiseWithResolvers();
    await runWithFakedTimers({ useFakeTimers: true }, () => {
      const reg = registry.register(languageId, testProvider);
      store.add(reg);
      const contextKeys = new MockContextKeyService();
      const model2 = store.add(new CodeActionModel(editor, registry, markerService, contextKeys, void 0));
      store.add(model2.onDidChangeState((e) => {
        assertType(e.type === CodeActionsState.Type.Triggered);
        assert.strictEqual(e.trigger.type, languages.CodeActionTriggerType.Auto);
        assert.ok(e.actions);
        e.actions.then((fixes) => {
          model2.dispose();
          assert.strictEqual(fixes.validActions.length, 1);
          done();
        }, done);
      }));
      markerService.changeOne("fake", uri, [{
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 6,
        message: "error",
        severity: 1,
        code: "",
        source: ""
      }]);
      return donePromise;
    });
  });
  test("Oracle -> position changed", async () => {
    await runWithFakedTimers({ useFakeTimers: true }, () => {
      const reg = registry.register(languageId, testProvider);
      store.add(reg);
      markerService.changeOne("fake", uri, [{
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 6,
        message: "error",
        severity: 1,
        code: "",
        source: ""
      }]);
      editor.setPosition({ lineNumber: 2, column: 1 });
      return new Promise((resolve, reject) => {
        const contextKeys = new MockContextKeyService();
        const model2 = store.add(new CodeActionModel(editor, registry, markerService, contextKeys, void 0));
        store.add(model2.onDidChangeState((e) => {
          assertType(e.type === CodeActionsState.Type.Triggered);
          assert.strictEqual(e.trigger.type, languages.CodeActionTriggerType.Auto);
          assert.ok(e.actions);
          e.actions.then((fixes) => {
            model2.dispose();
            assert.strictEqual(fixes.validActions.length, 1);
            resolve(void 0);
          }, reject);
        }));
        editor.setPosition({ lineNumber: 1, column: 1 });
      });
    });
  });
  test("Oracle -> should only auto trigger once for cursor and marker update right after each other", async () => {
    const { promise: donePromise, resolve: done } = promiseWithResolvers();
    await runWithFakedTimers({ useFakeTimers: true }, () => {
      const reg = registry.register(languageId, testProvider);
      store.add(reg);
      let triggerCount = 0;
      const contextKeys = new MockContextKeyService();
      const model2 = store.add(new CodeActionModel(editor, registry, markerService, contextKeys, void 0));
      store.add(model2.onDidChangeState(
        (e) => {
          assertType(e.type === CodeActionsState.Type.Triggered);
          assert.strictEqual(e.trigger.type, languages.CodeActionTriggerType.Auto);
          ++triggerCount;
          setTimeout(() => {
            model2.dispose();
            assert.strictEqual(triggerCount, 1);
            done();
          }, 0);
        },
        5
        /*delay*/
      ));
      markerService.changeOne("fake", uri, [{
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 6,
        message: "error",
        severity: 1,
        code: "",
        source: ""
      }]);
      editor.setSelection({ startLineNumber: 1, startColumn: 1, endLineNumber: 4, endColumn: 1 });
      return donePromise;
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9jb2RlQWN0aW9uL3Rlc3QvYnJvd3Nlci9jb2RlQWN0aW9uTW9kZWwudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IHByb21pc2VXaXRoUmVzb2x2ZXJzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgYXNzZXJ0VHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBydW5XaXRoRmFrZWRUaW1lcnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3RpbWVUcmF2ZWxTY2hlZHVsZXIuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBNb2NrQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL3Rlc3QvY29tbW9uL21vY2tLZXliaW5kaW5nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBNYXJrZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbWFya2Vycy9jb21tb24vbWFya2VyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBMYW5ndWFnZUZlYXR1cmVSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZUZlYXR1cmVSZWdpc3RyeS5qcyc7XG5pbXBvcnQgKiBhcyBsYW5ndWFnZXMgZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbW9kZWwvdGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IGNyZWF0ZVRlc3RDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9icm93c2VyL3Rlc3RDb2RlRWRpdG9yLmpzJztcbmltcG9ydCB7IGNyZWF0ZVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvY29tbW9uL3Rlc3RUZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgQ29kZUFjdGlvbk1vZGVsLCBDb2RlQWN0aW9uc1N0YXRlIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9jb2RlQWN0aW9uTW9kZWwuanMnO1xuXG5jb25zdCB0ZXN0UHJvdmlkZXIgPSB7XG5cdHByb3ZpZGVDb2RlQWN0aW9ucygpOiBsYW5ndWFnZXMuQ29kZUFjdGlvbkxpc3Qge1xuXHRcdHJldHVybiB7XG5cdFx0XHRhY3Rpb25zOiBbXG5cdFx0XHRcdHsgdGl0bGU6ICd0ZXN0JywgY29tbWFuZDogeyBpZDogJ3Rlc3QtY29tbWFuZCcsIHRpdGxlOiAndGVzdCcsIGFyZ3VtZW50czogW10gfSB9XG5cdFx0XHRdLFxuXHRcdFx0ZGlzcG9zZSgpIHsgLyogbm9vcCovIH1cblx0XHR9O1xuXHR9XG59O1xuXG5zdWl0ZSgnQ29kZUFjdGlvbk1vZGVsJywgKCkgPT4ge1xuXG5cdGNvbnN0IGxhbmd1YWdlSWQgPSAnZm9vLWxhbmcnO1xuXHRjb25zdCB1cmkgPSBVUkkucGFyc2UoJ3VudGl0bGVkOnBhdGgnKTtcblx0bGV0IG1vZGVsOiBUZXh0TW9kZWw7XG5cdGxldCBtYXJrZXJTZXJ2aWNlOiBNYXJrZXJTZXJ2aWNlO1xuXHRsZXQgZWRpdG9yOiBJQ29kZUVkaXRvcjtcblx0bGV0IHJlZ2lzdHJ5OiBMYW5ndWFnZUZlYXR1cmVSZWdpc3RyeTxsYW5ndWFnZXMuQ29kZUFjdGlvblByb3ZpZGVyPjtcblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0bWFya2VyU2VydmljZSA9IG5ldyBNYXJrZXJTZXJ2aWNlKCk7XG5cdFx0bW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoJ2Zvb2JhciAgZm9vIGJhclxcbmZhcmJvbyBmYXIgYm9vJywgbGFuZ3VhZ2VJZCwgdW5kZWZpbmVkLCB1cmkpO1xuXHRcdGVkaXRvciA9IGNyZWF0ZVRlc3RDb2RlRWRpdG9yKG1vZGVsKTtcblx0XHRlZGl0b3Iuc2V0UG9zaXRpb24oeyBsaW5lTnVtYmVyOiAxLCBjb2x1bW46IDEgfSk7XG5cdFx0cmVnaXN0cnkgPSBuZXcgTGFuZ3VhZ2VGZWF0dXJlUmVnaXN0cnkoKTtcblx0fSk7XG5cblx0Y29uc3Qgc3RvcmUgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0ZWRpdG9yLmRpc3Bvc2UoKTtcblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdFx0bWFya2VyU2VydmljZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ09yYWNsZSAtPiBtYXJrZXIgYWRkZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgeyBwcm9taXNlOiBkb25lUHJvbWlzZSwgcmVzb2x2ZTogZG9uZSB9ID0gcHJvbWlzZVdpdGhSZXNvbHZlcnM8dm9pZD4oKTtcblxuXHRcdGF3YWl0IHJ1bldpdGhGYWtlZFRpbWVycyh7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcmVnID0gcmVnaXN0cnkucmVnaXN0ZXIobGFuZ3VhZ2VJZCwgdGVzdFByb3ZpZGVyKTtcblx0XHRcdHN0b3JlLmFkZChyZWcpO1xuXG5cdFx0XHRjb25zdCBjb250ZXh0S2V5cyA9IG5ldyBNb2NrQ29udGV4dEtleVNlcnZpY2UoKTtcblx0XHRcdGNvbnN0IG1vZGVsID0gc3RvcmUuYWRkKG5ldyBDb2RlQWN0aW9uTW9kZWwoZWRpdG9yLCByZWdpc3RyeSwgbWFya2VyU2VydmljZSwgY29udGV4dEtleXMsIHVuZGVmaW5lZCkpO1xuXHRcdFx0c3RvcmUuYWRkKG1vZGVsLm9uRGlkQ2hhbmdlU3RhdGUoKGU6IENvZGVBY3Rpb25zU3RhdGUuU3RhdGUpID0+IHtcblx0XHRcdFx0YXNzZXJ0VHlwZShlLnR5cGUgPT09IENvZGVBY3Rpb25zU3RhdGUuVHlwZS5UcmlnZ2VyZWQpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlLnRyaWdnZXIudHlwZSwgbGFuZ3VhZ2VzLkNvZGVBY3Rpb25UcmlnZ2VyVHlwZS5BdXRvKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKGUuYWN0aW9ucyk7XG5cblx0XHRcdFx0ZS5hY3Rpb25zLnRoZW4oZml4ZXMgPT4ge1xuXHRcdFx0XHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4ZXMudmFsaWRBY3Rpb25zLmxlbmd0aCwgMSk7XG5cdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHR9LCBkb25lKTtcblx0XHRcdH0pKTtcblxuXHRcdFx0Ly8gc3RhcnQgaGVyZVxuXHRcdFx0bWFya2VyU2VydmljZS5jaGFuZ2VPbmUoJ2Zha2UnLCB1cmksIFt7XG5cdFx0XHRcdHN0YXJ0TGluZU51bWJlcjogMSwgc3RhcnRDb2x1bW46IDEsIGVuZExpbmVOdW1iZXI6IDEsIGVuZENvbHVtbjogNixcblx0XHRcdFx0bWVzc2FnZTogJ2Vycm9yJyxcblx0XHRcdFx0c2V2ZXJpdHk6IDEsXG5cdFx0XHRcdGNvZGU6ICcnLFxuXHRcdFx0XHRzb3VyY2U6ICcnXG5cdFx0XHR9XSk7XG5cdFx0XHRyZXR1cm4gZG9uZVByb21pc2U7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ09yYWNsZSAtPiBwb3NpdGlvbiBjaGFuZ2VkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHJ1bldpdGhGYWtlZFRpbWVycyh7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcmVnID0gcmVnaXN0cnkucmVnaXN0ZXIobGFuZ3VhZ2VJZCwgdGVzdFByb3ZpZGVyKTtcblx0XHRcdHN0b3JlLmFkZChyZWcpO1xuXG5cdFx0XHRtYXJrZXJTZXJ2aWNlLmNoYW5nZU9uZSgnZmFrZScsIHVyaSwgW3tcblx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiAxLCBzdGFydENvbHVtbjogMSwgZW5kTGluZU51bWJlcjogMSwgZW5kQ29sdW1uOiA2LFxuXHRcdFx0XHRtZXNzYWdlOiAnZXJyb3InLFxuXHRcdFx0XHRzZXZlcml0eTogMSxcblx0XHRcdFx0Y29kZTogJycsXG5cdFx0XHRcdHNvdXJjZTogJydcblx0XHRcdH1dKTtcblxuXHRcdFx0ZWRpdG9yLnNldFBvc2l0aW9uKHsgbGluZU51bWJlcjogMiwgY29sdW1uOiAxIH0pO1xuXG5cdFx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0XHRjb25zdCBjb250ZXh0S2V5cyA9IG5ldyBNb2NrQ29udGV4dEtleVNlcnZpY2UoKTtcblx0XHRcdFx0Y29uc3QgbW9kZWwgPSBzdG9yZS5hZGQobmV3IENvZGVBY3Rpb25Nb2RlbChlZGl0b3IsIHJlZ2lzdHJ5LCBtYXJrZXJTZXJ2aWNlLCBjb250ZXh0S2V5cywgdW5kZWZpbmVkKSk7XG5cdFx0XHRcdHN0b3JlLmFkZChtb2RlbC5vbkRpZENoYW5nZVN0YXRlKChlOiBDb2RlQWN0aW9uc1N0YXRlLlN0YXRlKSA9PiB7XG5cdFx0XHRcdFx0YXNzZXJ0VHlwZShlLnR5cGUgPT09IENvZGVBY3Rpb25zU3RhdGUuVHlwZS5UcmlnZ2VyZWQpO1xuXG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGUudHJpZ2dlci50eXBlLCBsYW5ndWFnZXMuQ29kZUFjdGlvblRyaWdnZXJUeXBlLkF1dG8pO1xuXHRcdFx0XHRcdGFzc2VydC5vayhlLmFjdGlvbnMpO1xuXHRcdFx0XHRcdGUuYWN0aW9ucy50aGVuKGZpeGVzID0+IHtcblx0XHRcdFx0XHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXhlcy52YWxpZEFjdGlvbnMubGVuZ3RoLCAxKTtcblx0XHRcdFx0XHRcdHJlc29sdmUodW5kZWZpbmVkKTtcblx0XHRcdFx0XHR9LCByZWplY3QpO1xuXHRcdFx0XHR9KSk7XG5cdFx0XHRcdC8vIHN0YXJ0IGhlcmVcblx0XHRcdFx0ZWRpdG9yLnNldFBvc2l0aW9uKHsgbGluZU51bWJlcjogMSwgY29sdW1uOiAxIH0pO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ09yYWNsZSAtPiBzaG91bGQgb25seSBhdXRvIHRyaWdnZXIgb25jZSBmb3IgY3Vyc29yIGFuZCBtYXJrZXIgdXBkYXRlIHJpZ2h0IGFmdGVyIGVhY2ggb3RoZXInLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgeyBwcm9taXNlOiBkb25lUHJvbWlzZSwgcmVzb2x2ZTogZG9uZSB9ID0gcHJvbWlzZVdpdGhSZXNvbHZlcnM8dm9pZD4oKTtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnMoeyB1c2VGYWtlVGltZXJzOiB0cnVlIH0sICgpID0+IHtcblx0XHRcdGNvbnN0IHJlZyA9IHJlZ2lzdHJ5LnJlZ2lzdGVyKGxhbmd1YWdlSWQsIHRlc3RQcm92aWRlcik7XG5cdFx0XHRzdG9yZS5hZGQocmVnKTtcblxuXHRcdFx0bGV0IHRyaWdnZXJDb3VudCA9IDA7XG5cdFx0XHRjb25zdCBjb250ZXh0S2V5cyA9IG5ldyBNb2NrQ29udGV4dEtleVNlcnZpY2UoKTtcblx0XHRcdGNvbnN0IG1vZGVsID0gc3RvcmUuYWRkKG5ldyBDb2RlQWN0aW9uTW9kZWwoZWRpdG9yLCByZWdpc3RyeSwgbWFya2VyU2VydmljZSwgY29udGV4dEtleXMsIHVuZGVmaW5lZCkpO1xuXHRcdFx0c3RvcmUuYWRkKG1vZGVsLm9uRGlkQ2hhbmdlU3RhdGUoKGU6IENvZGVBY3Rpb25zU3RhdGUuU3RhdGUpID0+IHtcblx0XHRcdFx0YXNzZXJ0VHlwZShlLnR5cGUgPT09IENvZGVBY3Rpb25zU3RhdGUuVHlwZS5UcmlnZ2VyZWQpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlLnRyaWdnZXIudHlwZSwgbGFuZ3VhZ2VzLkNvZGVBY3Rpb25UcmlnZ2VyVHlwZS5BdXRvKTtcblx0XHRcdFx0Kyt0cmlnZ2VyQ291bnQ7XG5cblx0XHRcdFx0Ly8gZ2l2ZSB0aW1lIGZvciBzZWNvbmQgdHJpZ2dlciBiZWZvcmUgY29tcGxldGluZyB0ZXN0XG5cdFx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJpZ2dlckNvdW50LCAxKTtcblx0XHRcdFx0XHRkb25lKCk7XG5cdFx0XHRcdH0sIDApO1xuXHRcdFx0fSwgNSAvKmRlbGF5Ki8pKTtcblxuXHRcdFx0bWFya2VyU2VydmljZS5jaGFuZ2VPbmUoJ2Zha2UnLCB1cmksIFt7XG5cdFx0XHRcdHN0YXJ0TGluZU51bWJlcjogMSwgc3RhcnRDb2x1bW46IDEsIGVuZExpbmVOdW1iZXI6IDEsIGVuZENvbHVtbjogNixcblx0XHRcdFx0bWVzc2FnZTogJ2Vycm9yJyxcblx0XHRcdFx0c2V2ZXJpdHk6IDEsXG5cdFx0XHRcdGNvZGU6ICcnLFxuXHRcdFx0XHRzb3VyY2U6ICcnXG5cdFx0XHR9XSk7XG5cblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24oeyBzdGFydExpbmVOdW1iZXI6IDEsIHN0YXJ0Q29sdW1uOiAxLCBlbmRMaW5lTnVtYmVyOiA0LCBlbmRDb2x1bW46IDEgfSk7XG5cblx0XHRcdHJldHVybiBkb25lUHJvbWlzZTtcblx0XHR9KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLFdBQVc7QUFDcEIsU0FBUywwQkFBMEI7QUFDbkMsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxxQkFBcUI7QUFFOUIsU0FBUywrQkFBK0I7QUFDeEMsWUFBWSxlQUFlO0FBRTNCLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsaUJBQWlCLHdCQUF3QjtBQUVsRCxNQUFNLGVBQWU7QUFBQSxFQUNwQixxQkFBK0M7QUFDOUMsV0FBTztBQUFBLE1BQ04sU0FBUztBQUFBLFFBQ1IsRUFBRSxPQUFPLFFBQVEsU0FBUyxFQUFFLElBQUksZ0JBQWdCLE9BQU8sUUFBUSxXQUFXLENBQUMsRUFBRSxFQUFFO0FBQUEsTUFDaEY7QUFBQSxNQUNBLFVBQVU7QUFBQSxNQUFZO0FBQUEsSUFDdkI7QUFBQSxFQUNEO0FBQ0Q7QUFFQSxNQUFNLG1CQUFtQixNQUFNO0FBRTlCLFFBQU0sYUFBYTtBQUNuQixRQUFNLE1BQU0sSUFBSSxNQUFNLGVBQWU7QUFDckMsTUFBSTtBQUNKLE1BQUk7QUFDSixNQUFJO0FBQ0osTUFBSTtBQUVKLFFBQU0sTUFBTTtBQUNYLG9CQUFnQixJQUFJLGNBQWM7QUFDbEMsWUFBUSxnQkFBZ0IsbUNBQW1DLFlBQVksUUFBVyxHQUFHO0FBQ3JGLGFB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
