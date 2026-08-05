import assert from "assert";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { Range } from "../../../common/core/range.js";
import { Selection } from "../../../common/core/selection.js";
import { ILanguageService } from "../../../common/languages/language.js";
import { ILanguageConfigurationService } from "../../../common/languages/languageConfigurationRegistry.js";
import { withTestCodeEditor } from "../testCodeEditor.js";
suite("CodeEditorWidget", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("onDidChangeModelDecorations", () => {
    withTestCodeEditor("", {}, (editor, viewModel) => {
      const disposables = new DisposableStore();
      let invoked = false;
      disposables.add(editor.onDidChangeModelDecorations((e) => {
        invoked = true;
      }));
      viewModel.model.deltaDecorations([], [{ range: new Range(1, 1, 1, 1), options: { description: "test" } }]);
      assert.deepStrictEqual(invoked, true);
      disposables.dispose();
    });
  });
  test("onDidChangeModelLanguage", () => {
    withTestCodeEditor("", {}, (editor, viewModel, instantiationService) => {
      const languageService = instantiationService.get(ILanguageService);
      const disposables = new DisposableStore();
      disposables.add(languageService.registerLanguage({ id: "testMode" }));
      let invoked = false;
      disposables.add(editor.onDidChangeModelLanguage((e) => {
        invoked = true;
      }));
      viewModel.model.setLanguage("testMode");
      assert.deepStrictEqual(invoked, true);
      disposables.dispose();
    });
  });
  test("onDidChangeModelLanguageConfiguration", () => {
    withTestCodeEditor("", {}, (editor, viewModel, instantiationService) => {
      const languageConfigurationService = instantiationService.get(ILanguageConfigurationService);
      const languageService = instantiationService.get(ILanguageService);
      const disposables = new DisposableStore();
      disposables.add(languageService.registerLanguage({ id: "testMode" }));
      viewModel.model.setLanguage("testMode");
      let invoked = false;
      disposables.add(editor.onDidChangeModelLanguageConfiguration((e) => {
        invoked = true;
      }));
      disposables.add(languageConfigurationService.register("testMode", {
        brackets: [["(", ")"]]
      }));
      assert.deepStrictEqual(invoked, true);
      disposables.dispose();
    });
  });
  test("onDidChangeModelContent", () => {
    withTestCodeEditor("", {}, (editor, viewModel) => {
      const disposables = new DisposableStore();
      let invoked = false;
      disposables.add(editor.onDidChangeModelContent((e) => {
        invoked = true;
      }));
      viewModel.type("hello", "test");
      assert.deepStrictEqual(invoked, true);
      disposables.dispose();
    });
  });
  test("onDidChangeModelOptions", () => {
    withTestCodeEditor("", {}, (editor, viewModel) => {
      const disposables = new DisposableStore();
      let invoked = false;
      disposables.add(editor.onDidChangeModelOptions((e) => {
        invoked = true;
      }));
      viewModel.model.updateOptions({
        tabSize: 3
      });
      assert.deepStrictEqual(invoked, true);
      disposables.dispose();
    });
  });
  test("issue #145872 - Model change events are emitted before the selection updates", () => {
    withTestCodeEditor("", {}, (editor, viewModel) => {
      const disposables = new DisposableStore();
      let observedSelection = null;
      disposables.add(editor.onDidChangeModelContent((e) => {
        observedSelection = editor.getSelection();
      }));
      viewModel.type("hello", "test");
      assert.deepStrictEqual(observedSelection, new Selection(1, 6, 1, 6));
      disposables.dispose();
    });
  });
  test("monaco-editor issue #2774 - Wrong order of events onDidChangeModelContent and onDidChangeCursorSelection on redo", () => {
    withTestCodeEditor("", {}, (editor, viewModel) => {
      const disposables = new DisposableStore();
      const calls = [];
      disposables.add(editor.onDidChangeModelContent((e) => {
        calls.push(`contentchange(${e.changes.reduce((aggr, c) => [...aggr, c.text, c.rangeOffset, c.rangeLength], []).join(", ")})`);
      }));
      disposables.add(editor.onDidChangeCursorSelection((e) => {
        calls.push(`cursorchange(${e.selection.positionLineNumber}, ${e.selection.positionColumn})`);
      }));
      viewModel.type("a", "test");
      viewModel.model.undo();
      viewModel.model.redo();
      assert.deepStrictEqual(calls, [
        "contentchange(a, 0, 0)",
        "cursorchange(1, 2)",
        "contentchange(, 0, 1)",
        "cursorchange(1, 1)",
        "contentchange(a, 0, 0)",
        "cursorchange(1, 2)"
      ]);
      disposables.dispose();
    });
  });
  test("issue #146174: Events delivered out of order when adding decorations in content change listener (1 of 2)", () => {
    withTestCodeEditor("", {}, (editor, viewModel) => {
      const disposables = new DisposableStore();
      const calls = [];
      disposables.add(editor.onDidChangeModelContent((e) => {
        calls.push(`listener1 - contentchange(${e.changes.reduce((aggr, c) => [...aggr, c.text, c.rangeOffset, c.rangeLength], []).join(", ")})`);
      }));
      disposables.add(editor.onDidChangeCursorSelection((e) => {
        calls.push(`listener1 - cursorchange(${e.selection.positionLineNumber}, ${e.selection.positionColumn})`);
      }));
      disposables.add(editor.onDidChangeModelContent((e) => {
        calls.push(`listener2 - contentchange(${e.changes.reduce((aggr, c) => [...aggr, c.text, c.rangeOffset, c.rangeLength], []).join(", ")})`);
      }));
      disposables.add(editor.onDidChangeCursorSelection((e) => {
        calls.push(`listener2 - cursorchange(${e.selection.positionLineNumber}, ${e.selection.positionColumn})`);
      }));
      viewModel.type("a", "test");
      assert.deepStrictEqual(calls, [
        "listener1 - contentchange(a, 0, 0)",
        "listener2 - contentchange(a, 0, 0)",
        "listener1 - cursorchange(1, 2)",
        "listener2 - cursorchange(1, 2)"
      ]);
      disposables.dispose();
    });
  });
  test("issue #146174: Events delivered out of order when adding decorations in content change listener (2 of 2)", () => {
    withTestCodeEditor("", {}, (editor, viewModel) => {
      const disposables = new DisposableStore();
      const calls = [];
      disposables.add(editor.onDidChangeModelContent((e) => {
        calls.push(`listener1 - contentchange(${e.changes.reduce((aggr, c) => [...aggr, c.text, c.rangeOffset, c.rangeLength], []).join(", ")})`);
        editor.changeDecorations((changeAccessor) => {
          changeAccessor.deltaDecorations([], [{ range: new Range(1, 1, 1, 1), options: { description: "test" } }]);
        });
      }));
      disposables.add(editor.onDidChangeCursorSelection((e) => {
        calls.push(`listener1 - cursorchange(${e.selection.positionLineNumber}, ${e.selection.positionColumn})`);
      }));
      disposables.add(editor.onDidChangeModelContent((e) => {
        calls.push(`listener2 - contentchange(${e.changes.reduce((aggr, c) => [...aggr, c.text, c.rangeOffset, c.rangeLength], []).join(", ")})`);
      }));
      disposables.add(editor.onDidChangeCursorSelection((e) => {
        calls.push(`listener2 - cursorchange(${e.selection.positionLineNumber}, ${e.selection.positionColumn})`);
      }));
      viewModel.type("a", "test");
      assert.deepStrictEqual(calls, [
        "listener1 - contentchange(a, 0, 0)",
        "listener2 - contentchange(a, 0, 0)",
        "listener1 - cursorchange(1, 2)",
        "listener2 - cursorchange(1, 2)"
      ]);
      disposables.dispose();
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9icm93c2VyL3dpZGdldC9jb2RlRWRpdG9yV2lkZ2V0LnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IFNlbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2VDb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgd2l0aFRlc3RDb2RlRWRpdG9yIH0gZnJvbSAnLi4vdGVzdENvZGVFZGl0b3IuanMnO1xuXG5zdWl0ZSgnQ29kZUVkaXRvcldpZGdldCcsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdvbkRpZENoYW5nZU1vZGVsRGVjb3JhdGlvbnMnLCAoKSA9PiB7XG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKCcnLCB7fSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdFx0bGV0IGludm9rZWQgPSBmYWxzZTtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChlZGl0b3Iub25EaWRDaGFuZ2VNb2RlbERlY29yYXRpb25zKChlKSA9PiB7XG5cdFx0XHRcdGludm9rZWQgPSB0cnVlO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHR2aWV3TW9kZWwubW9kZWwuZGVsdGFEZWNvcmF0aW9ucyhbXSwgW3sgcmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAxLCAxKSwgb3B0aW9uczogeyBkZXNjcmlwdGlvbjogJ3Rlc3QnIH0gfV0pO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGludm9rZWQsIHRydWUpO1xuXG5cdFx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ29uRGlkQ2hhbmdlTW9kZWxMYW5ndWFnZScsICgpID0+IHtcblx0XHR3aXRoVGVzdENvZGVFZGl0b3IoJycsIHt9LCAoZWRpdG9yLCB2aWV3TW9kZWwsIGluc3RhbnRpYXRpb25TZXJ2aWNlKSA9PiB7XG5cdFx0XHRjb25zdCBsYW5ndWFnZVNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUxhbmd1YWdlU2VydmljZSk7XG5cdFx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnZVNlcnZpY2UucmVnaXN0ZXJMYW5ndWFnZSh7IGlkOiAndGVzdE1vZGUnIH0pKTtcblxuXHRcdFx0bGV0IGludm9rZWQgPSBmYWxzZTtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChlZGl0b3Iub25EaWRDaGFuZ2VNb2RlbExhbmd1YWdlKChlKSA9PiB7XG5cdFx0XHRcdGludm9rZWQgPSB0cnVlO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHR2aWV3TW9kZWwubW9kZWwuc2V0TGFuZ3VhZ2UoJ3Rlc3RNb2RlJyk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaW52b2tlZCwgdHJ1ZSk7XG5cblx0XHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnb25EaWRDaGFuZ2VNb2RlbExhbmd1YWdlQ29uZmlndXJhdGlvbicsICgpID0+IHtcblx0XHR3aXRoVGVzdENvZGVFZGl0b3IoJycsIHt9LCAoZWRpdG9yLCB2aWV3TW9kZWwsIGluc3RhbnRpYXRpb25TZXJ2aWNlKSA9PiB7XG5cdFx0XHRjb25zdCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGxhbmd1YWdlU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTGFuZ3VhZ2VTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlU2VydmljZS5yZWdpc3Rlckxhbmd1YWdlKHsgaWQ6ICd0ZXN0TW9kZScgfSkpO1xuXHRcdFx0dmlld01vZGVsLm1vZGVsLnNldExhbmd1YWdlKCd0ZXN0TW9kZScpO1xuXG5cdFx0XHRsZXQgaW52b2tlZCA9IGZhbHNlO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGVkaXRvci5vbkRpZENoYW5nZU1vZGVsTGFuZ3VhZ2VDb25maWd1cmF0aW9uKChlKSA9PiB7XG5cdFx0XHRcdGludm9rZWQgPSB0cnVlO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZS5yZWdpc3RlcigndGVzdE1vZGUnLCB7XG5cdFx0XHRcdGJyYWNrZXRzOiBbWycoJywgJyknXV1cblx0XHRcdH0pKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChpbnZva2VkLCB0cnVlKTtcblxuXHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdvbkRpZENoYW5nZU1vZGVsQ29udGVudCcsICgpID0+IHtcblx0XHR3aXRoVGVzdENvZGVFZGl0b3IoJycsIHt9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0XHRsZXQgaW52b2tlZCA9IGZhbHNlO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGVkaXRvci5vbkRpZENoYW5nZU1vZGVsQ29udGVudCgoZSkgPT4ge1xuXHRcdFx0XHRpbnZva2VkID0gdHJ1ZTtcblx0XHRcdH0pKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ2hlbGxvJywgJ3Rlc3QnKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChpbnZva2VkLCB0cnVlKTtcblxuXHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdvbkRpZENoYW5nZU1vZGVsT3B0aW9ucycsICgpID0+IHtcblx0XHR3aXRoVGVzdENvZGVFZGl0b3IoJycsIHt9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0XHRsZXQgaW52b2tlZCA9IGZhbHNlO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGVkaXRvci5vbkRpZENoYW5nZU1vZGVsT3B0aW9ucygoZSkgPT4ge1xuXHRcdFx0XHRpbnZva2VkID0gdHJ1ZTtcblx0XHRcdH0pKTtcblxuXHRcdFx0dmlld01vZGVsLm1vZGVsLnVwZGF0ZU9wdGlvbnMoe1xuXHRcdFx0XHR0YWJTaXplOiAzXG5cdFx0XHR9KTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChpbnZva2VkLCB0cnVlKTtcblxuXHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTQ1ODcyIC0gTW9kZWwgY2hhbmdlIGV2ZW50cyBhcmUgZW1pdHRlZCBiZWZvcmUgdGhlIHNlbGVjdGlvbiB1cGRhdGVzJywgKCkgPT4ge1xuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcignJywge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRcdGxldCBvYnNlcnZlZFNlbGVjdGlvbjogU2VsZWN0aW9uIHwgbnVsbCA9IG51bGw7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoZWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWxDb250ZW50KChlKSA9PiB7XG5cdFx0XHRcdG9ic2VydmVkU2VsZWN0aW9uID0gZWRpdG9yLmdldFNlbGVjdGlvbigpO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnaGVsbG8nLCAndGVzdCcpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG9ic2VydmVkU2VsZWN0aW9uLCBuZXcgU2VsZWN0aW9uKDEsIDYsIDEsIDYpKTtcblxuXHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb25hY28tZWRpdG9yIGlzc3VlICMyNzc0IC0gV3Jvbmcgb3JkZXIgb2YgZXZlbnRzIG9uRGlkQ2hhbmdlTW9kZWxDb250ZW50IGFuZCBvbkRpZENoYW5nZUN1cnNvclNlbGVjdGlvbiBvbiByZWRvJywgKCkgPT4ge1xuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcignJywge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRcdGNvbnN0IGNhbGxzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGVkaXRvci5vbkRpZENoYW5nZU1vZGVsQ29udGVudCgoZSkgPT4ge1xuXHRcdFx0XHRjYWxscy5wdXNoKGBjb250ZW50Y2hhbmdlKCR7ZS5jaGFuZ2VzLnJlZHVjZTxhbnlbXT4oKGFnZ3IsIGMpID0+IFsuLi5hZ2dyLCBjLnRleHQsIGMucmFuZ2VPZmZzZXQsIGMucmFuZ2VMZW5ndGhdLCBbXSkuam9pbignLCAnKX0pYCk7XG5cdFx0XHR9KSk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoZWRpdG9yLm9uRGlkQ2hhbmdlQ3Vyc29yU2VsZWN0aW9uKChlKSA9PiB7XG5cdFx0XHRcdGNhbGxzLnB1c2goYGN1cnNvcmNoYW5nZSgke2Uuc2VsZWN0aW9uLnBvc2l0aW9uTGluZU51bWJlcn0sICR7ZS5zZWxlY3Rpb24ucG9zaXRpb25Db2x1bW59KWApO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnYScsICd0ZXN0Jyk7XG5cdFx0XHR2aWV3TW9kZWwubW9kZWwudW5kbygpO1xuXHRcdFx0dmlld01vZGVsLm1vZGVsLnJlZG8oKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjYWxscywgW1xuXHRcdFx0XHQnY29udGVudGNoYW5nZShhLCAwLCAwKScsXG5cdFx0XHRcdCdjdXJzb3JjaGFuZ2UoMSwgMiknLFxuXHRcdFx0XHQnY29udGVudGNoYW5nZSgsIDAsIDEpJyxcblx0XHRcdFx0J2N1cnNvcmNoYW5nZSgxLCAxKScsXG5cdFx0XHRcdCdjb250ZW50Y2hhbmdlKGEsIDAsIDApJyxcblx0XHRcdFx0J2N1cnNvcmNoYW5nZSgxLCAyKSdcblx0XHRcdF0pO1xuXG5cdFx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxNDYxNzQ6IEV2ZW50cyBkZWxpdmVyZWQgb3V0IG9mIG9yZGVyIHdoZW4gYWRkaW5nIGRlY29yYXRpb25zIGluIGNvbnRlbnQgY2hhbmdlIGxpc3RlbmVyICgxIG9mIDIpJywgKCkgPT4ge1xuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcignJywge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRcdGNvbnN0IGNhbGxzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGVkaXRvci5vbkRpZENoYW5nZU1vZGVsQ29udGVudCgoZSkgPT4ge1xuXHRcdFx0XHRjYWxscy5wdXNoKGBsaXN0ZW5lcjEgLSBjb250ZW50Y2hhbmdlKCR7ZS5jaGFuZ2VzLnJlZHVjZTxhbnlbXT4oKGFnZ3IsIGMpID0+IFsuLi5hZ2dyLCBjLnRleHQsIGMucmFuZ2VPZmZzZXQsIGMucmFuZ2VMZW5ndGhdLCBbXSkuam9pbignLCAnKX0pYCk7XG5cdFx0XHR9KSk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoZWRpdG9yLm9uRGlkQ2hhbmdlQ3Vyc29yU2VsZWN0aW9uKChlKSA9PiB7XG5cdFx0XHRcdGNhbGxzLnB1c2goYGxpc3RlbmVyMSAtIGN1cnNvcmNoYW5nZSgke2Uuc2VsZWN0aW9uLnBvc2l0aW9uTGluZU51bWJlcn0sICR7ZS5zZWxlY3Rpb24ucG9zaXRpb25Db2x1bW59KWApO1xuXHRcdFx0fSkpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGVkaXRvci5vbkRpZENoYW5nZU1vZGVsQ29udGVudCgoZSkgPT4ge1xuXHRcdFx0XHRjYWxscy5wdXNoKGBsaXN0ZW5lcjIgLSBjb250ZW50Y2hhbmdlKCR7ZS5jaGFuZ2VzLnJlZHVjZTxhbnlbXT4oKGFnZ3IsIGMpID0+IFsuLi5hZ2dyLCBjLnRleHQsIGMucmFuZ2VPZmZzZXQsIGMucmFuZ2VMZW5ndGhdLCBbXSkuam9pbignLCAnKX0pYCk7XG5cdFx0XHR9KSk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoZWRpdG9yLm9uRGlkQ2hhbmdlQ3Vyc29yU2VsZWN0aW9uKChlKSA9PiB7XG5cdFx0XHRcdGNhbGxzLnB1c2goYGxpc3RlbmVyMiAtIGN1cnNvcmNoYW5nZSgke2Uuc2VsZWN0aW9uLnBvc2l0aW9uTGluZU51bWJlcn0sICR7ZS5zZWxlY3Rpb24ucG9zaXRpb25Db2x1bW59KWApO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnYScsICd0ZXN0Jyk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2FsbHMsIChbXG5cdFx0XHRcdCdsaXN0ZW5lcjEgLSBjb250ZW50Y2hhbmdlKGEsIDAsIDApJyxcblx0XHRcdFx0J2xpc3RlbmVyMiAtIGNvbnRlbnRjaGFuZ2UoYSwgMCwgMCknLFxuXHRcdFx0XHQnbGlzdGVuZXIxIC0gY3Vyc29yY2hhbmdlKDEsIDIpJyxcblx0XHRcdFx0J2xpc3RlbmVyMiAtIGN1cnNvcmNoYW5nZSgxLCAyKScsXG5cdFx0XHRdKSk7XG5cblx0XHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzE0NjE3NDogRXZlbnRzIGRlbGl2ZXJlZCBvdXQgb2Ygb3JkZXIgd2hlbiBhZGRpbmcgZGVjb3JhdGlvbnMgaW4gY29udGVudCBjaGFuZ2UgbGlzdGVuZXIgKDIgb2YgMiknLCAoKSA9PiB7XG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKCcnLCB7fSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdFx0Y29uc3QgY2FsbHM6IHN0cmluZ1tdID0gW107XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoZWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWxDb250ZW50KChlKSA9PiB7XG5cdFx0XHRcdGNhbGxzLnB1c2goYGxpc3RlbmVyMSAtIGNvbnRlbnRjaGFuZ2UoJHtlLmNoYW5nZXMucmVkdWNlPGFueVtdPigoYWdnciwgYykgPT4gWy4uLmFnZ3IsIGMudGV4dCwgYy5yYW5nZU9mZnNldCwgYy5yYW5nZUxlbmd0aF0sIFtdKS5qb2luKCcsICcpfSlgKTtcblx0XHRcdFx0ZWRpdG9yLmNoYW5nZURlY29yYXRpb25zKChjaGFuZ2VBY2Nlc3NvcikgPT4ge1xuXHRcdFx0XHRcdGNoYW5nZUFjY2Vzc29yLmRlbHRhRGVjb3JhdGlvbnMoW10sIFt7IHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgMSwgMSksIG9wdGlvbnM6IHsgZGVzY3JpcHRpb246ICd0ZXN0JyB9IH1dKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KSk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoZWRpdG9yLm9uRGlkQ2hhbmdlQ3Vyc29yU2VsZWN0aW9uKChlKSA9PiB7XG5cdFx0XHRcdGNhbGxzLnB1c2goYGxpc3RlbmVyMSAtIGN1cnNvcmNoYW5nZSgke2Uuc2VsZWN0aW9uLnBvc2l0aW9uTGluZU51bWJlcn0sICR7ZS5zZWxlY3Rpb24ucG9zaXRpb25Db2x1bW59KWApO1xuXHRcdFx0fSkpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGVkaXRvci5vbkRpZENoYW5nZU1vZGVsQ29udGVudCgoZSkgPT4ge1xuXHRcdFx0XHRjYWxscy5wdXNoKGBsaXN0ZW5lcjIgLSBjb250ZW50Y2hhbmdlKCR7ZS5jaGFuZ2VzLnJlZHVjZTxhbnlbXT4oKGFnZ3IsIGMpID0+IFsuLi5hZ2dyLCBjLnRleHQsIGMucmFuZ2VPZmZzZXQsIGMucmFuZ2VMZW5ndGhdLCBbXSkuam9pbignLCAnKX0pYCk7XG5cdFx0XHR9KSk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoZWRpdG9yLm9uRGlkQ2hhbmdlQ3Vyc29yU2VsZWN0aW9uKChlKSA9PiB7XG5cdFx0XHRcdGNhbGxzLnB1c2goYGxpc3RlbmVyMiAtIGN1cnNvcmNoYW5nZSgke2Uuc2VsZWN0aW9uLnBvc2l0aW9uTGluZU51bWJlcn0sICR7ZS5zZWxlY3Rpb24ucG9zaXRpb25Db2x1bW59KWApO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnYScsICd0ZXN0Jyk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2FsbHMsIChbXG5cdFx0XHRcdCdsaXN0ZW5lcjEgLSBjb250ZW50Y2hhbmdlKGEsIDAsIDApJyxcblx0XHRcdFx0J2xpc3RlbmVyMiAtIGNvbnRlbnRjaGFuZ2UoYSwgMCwgMCknLFxuXHRcdFx0XHQnbGlzdGVuZXIxIC0gY3Vyc29yY2hhbmdlKDEsIDIpJyxcblx0XHRcdFx0J2xpc3RlbmVyMiAtIGN1cnNvcmNoYW5nZSgxLCAyKScsXG5cdFx0XHRdKSk7XG5cblx0XHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHR9KTtcblx0fSk7XG5cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsYUFBYTtBQUN0QixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHFDQUFxQztBQUM5QyxTQUFTLDBCQUEwQjtBQUVuQyxNQUFNLG9CQUFvQixNQUFNO0FBRS9CLDBDQUF3QztBQUV4QyxPQUFLLCtCQUErQixNQUFNO0FBQ3pDLHVCQUFtQixJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsY0FBYztBQUNqRCxZQUFNLGNBQWMsSUFBSSxnQkFBZ0I7QUFFeEMsVUFBSSxVQUFVO0FBQ2Qsa0JBQVksSUFB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QixDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSyw0R0FBNEcsTUFBTTtBQUN0SCx1QkFBbUIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLGNBQWM7QUFDakQsWUFBTSxjQUFjLElBQUksZ0JBQWdCO0FBRXhDLFlBQU0sUUFBa0IsQ0FBQztBQUN6QixrQkFBWSxJQUFJLE9BQU8sd0JBQXdCLENBQUMsTUFBTTtBQUNyRCxjQUFNLEtBQUssNkJBQTZCLEVBQUUsUUFBUSxPQUFjLENBQUMsTUFBTSxNQUFNLENBQUMsR0FBRyxNQUFNLEVBQUUsTUFBTSxFQUFFLGFBQWEsRUFBRSxXQUFXLEdBQUcsQ0FBQyxDQUFDLEVBQUUsS0FBSyxJQUFJLENBQUMsR0FBRztBQUMvSSxlQUFPLGtCQUFrQixDQUFDLG1CQUFtQjtBQUM1Qyx5QkFBZSxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsRUFBRSxPQUFPLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsU0FBUyxFQUFFLGFBQWEsT0FBTyxFQUFFLENBQUMsQ0FBQztBQUFBLFFBQ3pHLENBQUM7QUFBQSxNQUNGLENBQUMsQ0FBQztBQUNGLGtCQUFZLElBQUksT0FBTywyQkFBMkIsQ0FBQyxNQUFNO0FBQ3hELGNBQU0sS0FBSyw0QkFBNEIsRUFBRSxVQUFVLGtCQUFrQixLQUFLLEVBQUUsVUFBVSxjQUFjLEdBQUc7QUFBQSxNQUN4RyxDQUFDLENBQUM7QUFDRixrQkFBWSxJQUFJLE9BQU8sd0JBQXdCLENBQUMsTUFBTTtBQUNyRCxjQUFNLEtBQUssNkJBQTZCLEVBQUUsUUFBUSxPQUFjLENBQUMsTUFBTSxNQUFNLENBQUMsR0FBRyxNQUFNLEVBQUUsTUFBTSxFQUFFLGFBQWEsRUFBRSxXQUFXLEdBQUcsQ0FBQyxDQUFDLEVBQUUsS0FBSyxJQUFJLENBQUMsR0FBRztBQUFBLE1BQ2hKLENBQUMsQ0FBQztBQUNGLGtCQUFZLElBQUksT0FBTywyQkFBMkIsQ0FBQyxNQUFNO0FBQ3hELGNBQU0sS0FBSyw0QkFBNEIsRUFBRSxVQUFVLGtCQUFrQixLQUFLLEVBQUUsVUFBVSxjQUFjLEdBQUc7QUFBQSxNQUN4RyxDQUFDLENBQUM7QUFFRixnQkFBVSxLQUFLLEtBQUssTUFBTTtBQUUxQixhQUFPLGdCQUFnQixPQUFRO0FBQUEsUUFDOUI7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNELENBQUU7QUFFRixrQkFBWSxRQUFRO0FBQUEsSUFDckIsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
