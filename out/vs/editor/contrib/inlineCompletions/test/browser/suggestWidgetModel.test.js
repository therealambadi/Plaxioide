import { timeout } from "../../../../../base/common/async.js";
import { Event } from "../../../../../base/common/event.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { mock } from "../../../../../base/test/common/mock.js";
import { runWithFakedTimers } from "../../../../../base/test/common/timeTravelScheduler.js";
import { Range } from "../../../../common/core/range.js";
import { CompletionItemKind } from "../../../../common/languages.js";
import { IEditorWorkerService } from "../../../../common/services/editorWorker.js";
import { GhostTextContext } from "./utils.js";
import { SnippetController2 } from "../../../snippet/browser/snippetController2.js";
import { SuggestController } from "../../../suggest/browser/suggestController.js";
import { ISuggestMemoryService } from "../../../suggest/browser/suggestMemory.js";
import { withAsyncTestCodeEditor } from "../../../../test/browser/testCodeEditor.js";
import { IMenuService } from "../../../../../platform/actions/common/actions.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { MockKeybindingService } from "../../../../../platform/keybinding/test/common/mockKeybindingService.js";
import { ILogService, NullLogService } from "../../../../../platform/log/common/log.js";
import { InMemoryStorageService, IStorageService } from "../../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { NullTelemetryService } from "../../../../../platform/telemetry/common/telemetryUtils.js";
import assert from "assert";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { LanguageFeaturesService } from "../../../../common/services/languageFeaturesService.js";
import { ILanguageFeaturesService } from "../../../../common/services/languageFeatures.js";
import { InlineCompletionsController } from "../../browser/controller/inlineCompletionsController.js";
import { autorun } from "../../../../../base/common/observable.js";
import { setUnexpectedErrorHandler } from "../../../../../base/common/errors.js";
import { IAccessibilitySignalService } from "../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
suite("Suggest Widget Model", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  setup(() => {
    setUnexpectedErrorHandler(function(err) {
      throw err;
    });
  });
  test.skip("Active", async () => {
    await withAsyncTestCodeEditorAndInlineCompletionsModel(
      "",
      { fakeClock: true, provider },
      async ({ editor, editorViewModel, context, model }) => {
        let last = void 0;
        const history = new Array();
        const d = autorun((reader) => {
          const selectedSuggestItem = !!model.debugGetSelectedSuggestItem().read(reader);
          if (last !== selectedSuggestItem) {
            last = selectedSuggestItem;
            history.push(last);
          }
        });
        context.keyboardType("h");
        const suggestController = editor.getContribution(SuggestController.ID);
        suggestController.triggerSuggest();
        await timeout(1e3);
        assert.deepStrictEqual(history.splice(0), [false, true]);
        context.keyboardType(".");
        await timeout(1e3);
        assert.deepStrictEqual(history.splice(0), []);
        suggestController.cancelSuggestWidget();
        await timeout(1e3);
        assert.deepStrictEqual(history.splice(0), [false]);
        d.dispose();
      }
    );
  });
  test("Ghost Text", async () => {
    await withAsyncTestCodeEditorAndInlineCompletionsModel(
      "",
      { fakeClock: true, provider, suggest: { preview: true } },
      async ({ editor, editorViewModel, context, model }) => {
        context.keyboardType("h");
        const suggestController = editor.getContribution(SuggestController.ID);
        suggestController.triggerSuggest();
        await timeout(1e3);
        assert.deepStrictEqual(context.getAndClearViewStates(), ["", "h[ello]"]);
        context.keyboardType(".");
        await timeout(1e3);
        assert.deepStrictEqual(context.getAndClearViewStates(), ["h", "hello.[hello]"]);
        suggestController.cancelSuggestWidget();
        await timeout(1e3);
        assert.deepStrictEqual(context.getAndClearViewStates(), ["hello."]);
      }
    );
  });
});
const provider = {
  _debugDisplayName: "test",
  triggerCharacters: ["."],
  async provideCompletionItems(model, pos) {
    const word = model.getWordAtPosition(pos);
    const range = word ? { startLineNumber: 1, startColumn: word.startColumn, endLineNumber: 1, endColumn: word.endColumn } : Range.fromPositions(pos);
    return {
      suggestions: [{
        insertText: "hello",
        kind: CompletionItemKind.Text,
        label: "hello",
        range,
        commitCharacters: ["."]
      }]
    };
  }
};
async function withAsyncTestCodeEditorAndInlineCompletionsModel(text, options, callback) {
  await runWithFakedTimers({ useFakeTimers: options.fakeClock }, async () => {
    const disposableStore = new DisposableStore();
    try {
      const serviceCollection = new ServiceCollection(
        [ITelemetryService, NullTelemetryService],
        [ILogService, new NullLogService()],
        [IStorageService, disposableStore.add(new InMemoryStorageService())],
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
        [IAccessibilitySignalService, {
          playSignal: async () => {
          },
          isSoundEnabled(signal) {
            return false;
          }
        }]
      );
      if (options.provider) {
        const languageFeaturesService = new LanguageFeaturesService();
        serviceCollection.set(ILanguageFeaturesService, languageFeaturesService);
        disposableStore.add(languageFeaturesService.completionProvider.register({ pattern: "**" }, options.provider));
      }
      await withAsyncTestCodeEditor(text, { ...options, serviceCollection }, async (editor, editorViewModel, instantiationService) => {
        editor.registerAndInstantiateContribution(SnippetController2.ID, SnippetController2);
        editor.registerAndInstantiateContribution(SuggestController.ID, SuggestController);
        editor.registerAndInstantiateContribution(InlineCompletionsController.ID, InlineCompletionsController);
        const model = InlineCompletionsController.get(editor)?.model.get();
        const context = new GhostTextContext(model, editor);
        await callback({ editor, editorViewModel, model, context });
        context.dispose();
      });
    } finally {
      disposableStore.dispose();
    }
  });
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy90ZXN0L2Jyb3dzZXIvc3VnZ2VzdFdpZGdldE1vZGVsLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgbW9jayB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vbW9jay5qcyc7XG5pbXBvcnQgeyBydW5XaXRoRmFrZWRUaW1lcnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3RpbWVUcmF2ZWxTY2hlZHVsZXIuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBDb21wbGV0aW9uSXRlbUtpbmQsIENvbXBsZXRpb25JdGVtUHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElFZGl0b3JXb3JrZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL2VkaXRvcldvcmtlci5qcyc7XG5pbXBvcnQgeyBWaWV3TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vdmlld01vZGVsL3ZpZXdNb2RlbEltcGwuanMnO1xuaW1wb3J0IHsgR2hvc3RUZXh0Q29udGV4dCB9IGZyb20gJy4vdXRpbHMuanMnO1xuaW1wb3J0IHsgU25pcHBldENvbnRyb2xsZXIyIH0gZnJvbSAnLi4vLi4vLi4vc25pcHBldC9icm93c2VyL3NuaXBwZXRDb250cm9sbGVyMi5qcyc7XG5pbXBvcnQgeyBTdWdnZXN0Q29udHJvbGxlciB9IGZyb20gJy4uLy4uLy4uL3N1Z2dlc3QvYnJvd3Nlci9zdWdnZXN0Q29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyBJU3VnZ2VzdE1lbW9yeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zdWdnZXN0L2Jyb3dzZXIvc3VnZ2VzdE1lbW9yeS5qcyc7XG5pbXBvcnQgeyBJVGVzdENvZGVFZGl0b3IsIFRlc3RDb2RlRWRpdG9ySW5zdGFudGlhdGlvbk9wdGlvbnMsIHdpdGhBc3luY1Rlc3RDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9icm93c2VyL3Rlc3RDb2RlRWRpdG9yLmpzJztcbmltcG9ydCB7IElNZW51LCBJTWVudVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IFNlcnZpY2VDb2xsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vc2VydmljZUNvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBNb2NrS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL3Rlc3QvY29tbW9uL21vY2tLZXliaW5kaW5nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSwgTnVsbExvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJbk1lbW9yeVN0b3JhZ2VTZXJ2aWNlLCBJU3RvcmFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgTnVsbFRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeVV0aWxzLmpzJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgSW5saW5lQ29tcGxldGlvbnNNb2RlbCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvbW9kZWwvaW5saW5lQ29tcGxldGlvbnNNb2RlbC5qcyc7XG5pbXBvcnQgeyBJbmxpbmVDb21wbGV0aW9uc0NvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnRyb2xsZXIvaW5saW5lQ29tcGxldGlvbnNDb250cm9sbGVyLmpzJztcbmltcG9ydCB7IGF1dG9ydW4gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IHNldFVuZXhwZWN0ZWRFcnJvckhhbmRsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgSUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eVNpZ25hbC9icm93c2VyL2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuXG5zdWl0ZSgnU3VnZ2VzdCBXaWRnZXQgTW9kZWwnLCAoKSA9PiB7XG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHNldHVwKCgpID0+IHtcblx0XHRzZXRVbmV4cGVjdGVkRXJyb3JIYW5kbGVyKGZ1bmN0aW9uIChlcnIpIHtcblx0XHRcdHRocm93IGVycjtcblx0XHR9KTtcblx0fSk7XG5cblx0Ly8gVGhpcyB0ZXN0IGlzIHNraXBwZWQgYmVjYXVzZSB0aGUgZml4IGZvciB0aGlzIGNhdXNlcyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTY2MDIzXG5cdHRlc3Quc2tpcCgnQWN0aXZlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHdpdGhBc3luY1Rlc3RDb2RlRWRpdG9yQW5kSW5saW5lQ29tcGxldGlvbnNNb2RlbCgnJyxcblx0XHRcdHsgZmFrZUNsb2NrOiB0cnVlLCBwcm92aWRlciwgfSxcblx0XHRcdGFzeW5jICh7IGVkaXRvciwgZWRpdG9yVmlld01vZGVsLCBjb250ZXh0LCBtb2RlbCB9KSA9PiB7XG5cdFx0XHRcdGxldCBsYXN0OiBib29sZWFuIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRjb25zdCBoaXN0b3J5ID0gbmV3IEFycmF5PGJvb2xlYW4+KCk7XG5cdFx0XHRcdGNvbnN0IGQgPSBhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBkZWJ1ZyAqL1xuXHRcdFx0XHRcdGNvbnN0IHNlbGVjdGVkU3VnZ2VzdEl0ZW0gPSAhIW1vZGVsLmRlYnVnR2V0U2VsZWN0ZWRTdWdnZXN0SXRlbSgpLnJlYWQocmVhZGVyKTtcblx0XHRcdFx0XHRpZiAobGFzdCAhPT0gc2VsZWN0ZWRTdWdnZXN0SXRlbSkge1xuXHRcdFx0XHRcdFx0bGFzdCA9IHNlbGVjdGVkU3VnZ2VzdEl0ZW07XG5cdFx0XHRcdFx0XHRoaXN0b3J5LnB1c2gobGFzdCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRjb250ZXh0LmtleWJvYXJkVHlwZSgnaCcpO1xuXHRcdFx0XHRjb25zdCBzdWdnZXN0Q29udHJvbGxlciA9IChlZGl0b3IuZ2V0Q29udHJpYnV0aW9uKFN1Z2dlc3RDb250cm9sbGVyLklEKSBhcyBTdWdnZXN0Q29udHJvbGxlcik7XG5cdFx0XHRcdHN1Z2dlc3RDb250cm9sbGVyLnRyaWdnZXJTdWdnZXN0KCk7XG5cdFx0XHRcdGF3YWl0IHRpbWVvdXQoMTAwMCk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaGlzdG9yeS5zcGxpY2UoMCksIFtmYWxzZSwgdHJ1ZV0pO1xuXG5cdFx0XHRcdGNvbnRleHQua2V5Ym9hcmRUeXBlKCcuJyk7XG5cdFx0XHRcdGF3YWl0IHRpbWVvdXQoMTAwMCk7XG5cblx0XHRcdFx0Ly8gTm8gZmxpY2tlciBoZXJlXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaGlzdG9yeS5zcGxpY2UoMCksIFtdKTtcblx0XHRcdFx0c3VnZ2VzdENvbnRyb2xsZXIuY2FuY2VsU3VnZ2VzdFdpZGdldCgpO1xuXHRcdFx0XHRhd2FpdCB0aW1lb3V0KDEwMDApO1xuXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaGlzdG9yeS5zcGxpY2UoMCksIFtmYWxzZV0pO1xuXG5cdFx0XHRcdGQuZGlzcG9zZSgpO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ0dob3N0IFRleHQnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgd2l0aEFzeW5jVGVzdENvZGVFZGl0b3JBbmRJbmxpbmVDb21wbGV0aW9uc01vZGVsKCcnLFxuXHRcdFx0eyBmYWtlQ2xvY2s6IHRydWUsIHByb3ZpZGVyLCBzdWdnZXN0OiB7IHByZXZpZXc6IHRydWUgfSB9LFxuXHRcdFx0YXN5bmMgKHsgZWRpdG9yLCBlZGl0b3JWaWV3TW9kZWwsIGNvbnRleHQsIG1vZGVsIH0pID0+IHtcblx0XHRcdFx0Y29udGV4dC5rZXlib2FyZFR5cGUoJ2gnKTtcblx0XHRcdFx0Y29uc3Qgc3VnZ2VzdENvbnRyb2xsZXIgPSAoZWRpdG9yLmdldENvbnRyaWJ1dGlvbihTdWdnZXN0Q29udHJvbGxlci5JRCkgYXMgU3VnZ2VzdENvbnRyb2xsZXIpO1xuXHRcdFx0XHRzdWdnZXN0Q29udHJvbGxlci50cmlnZ2VyU3VnZ2VzdCgpO1xuXHRcdFx0XHRhd2FpdCB0aW1lb3V0KDEwMDApO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNvbnRleHQuZ2V0QW5kQ2xlYXJWaWV3U3RhdGVzKCksIFsnJywgJ2hbZWxsb10nXSk7XG5cblx0XHRcdFx0Y29udGV4dC5rZXlib2FyZFR5cGUoJy4nKTtcblx0XHRcdFx0YXdhaXQgdGltZW91dCgxMDAwKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjb250ZXh0LmdldEFuZENsZWFyVmlld1N0YXRlcygpLCBbJ2gnLCAnaGVsbG8uW2hlbGxvXSddKTtcblxuXHRcdFx0XHRzdWdnZXN0Q29udHJvbGxlci5jYW5jZWxTdWdnZXN0V2lkZ2V0KCk7XG5cblx0XHRcdFx0YXdhaXQgdGltZW91dCgxMDAwKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjb250ZXh0LmdldEFuZENsZWFyVmlld1N0YXRlcygpLCBbJ2hlbGxvLiddKTtcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcbn0pO1xuXG5jb25zdCBwcm92aWRlcjogQ29tcGxldGlvbkl0ZW1Qcm92aWRlciA9IHtcblx0X2RlYnVnRGlzcGxheU5hbWU6ICd0ZXN0Jyxcblx0dHJpZ2dlckNoYXJhY3RlcnM6IFsnLiddLFxuXHRhc3luYyBwcm92aWRlQ29tcGxldGlvbkl0ZW1zKG1vZGVsLCBwb3MpIHtcblx0XHRjb25zdCB3b3JkID0gbW9kZWwuZ2V0V29yZEF0UG9zaXRpb24ocG9zKTtcblx0XHRjb25zdCByYW5nZSA9IHdvcmRcblx0XHRcdD8geyBzdGFydExpbmVOdW1iZXI6IDEsIHN0YXJ0Q29sdW1uOiB3b3JkLnN0YXJ0Q29sdW1uLCBlbmRMaW5lTnVtYmVyOiAxLCBlbmRDb2x1bW46IHdvcmQuZW5kQ29sdW1uIH1cblx0XHRcdDogUmFuZ2UuZnJvbVBvc2l0aW9ucyhwb3MpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHN1Z2dlc3Rpb25zOiBbe1xuXHRcdFx0XHRpbnNlcnRUZXh0OiAnaGVsbG8nLFxuXHRcdFx0XHRraW5kOiBDb21wbGV0aW9uSXRlbUtpbmQuVGV4dCxcblx0XHRcdFx0bGFiZWw6ICdoZWxsbycsXG5cdFx0XHRcdHJhbmdlLFxuXHRcdFx0XHRjb21taXRDaGFyYWN0ZXJzOiBbJy4nXSxcblx0XHRcdH1dXG5cdFx0fTtcblx0fSxcbn07XG5cbmFzeW5jIGZ1bmN0aW9uIHdpdGhBc3luY1Rlc3RDb2RlRWRpdG9yQW5kSW5saW5lQ29tcGxldGlvbnNNb2RlbChcblx0dGV4dDogc3RyaW5nLFxuXHRvcHRpb25zOiBUZXN0Q29kZUVkaXRvckluc3RhbnRpYXRpb25PcHRpb25zICYgeyBwcm92aWRlcj86IENvbXBsZXRpb25JdGVtUHJvdmlkZXI7IGZha2VDbG9jaz86IGJvb2xlYW47IHNlcnZpY2VDb2xsZWN0aW9uPzogbmV2ZXIgfSxcblx0Y2FsbGJhY2s6IChhcmdzOiB7IGVkaXRvcjogSVRlc3RDb2RlRWRpdG9yOyBlZGl0b3JWaWV3TW9kZWw6IFZpZXdNb2RlbDsgbW9kZWw6IElubGluZUNvbXBsZXRpb25zTW9kZWw7IGNvbnRleHQ6IEdob3N0VGV4dENvbnRleHQgfSkgPT4gUHJvbWlzZTx2b2lkPlxuKTogUHJvbWlzZTx2b2lkPiB7XG5cdGF3YWl0IHJ1bldpdGhGYWtlZFRpbWVycyh7IHVzZUZha2VUaW1lcnM6IG9wdGlvbnMuZmFrZUNsb2NrIH0sIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBkaXNwb3NhYmxlU3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3Qgc2VydmljZUNvbGxlY3Rpb24gPSBuZXcgU2VydmljZUNvbGxlY3Rpb24oXG5cdFx0XHRcdFtJVGVsZW1ldHJ5U2VydmljZSwgTnVsbFRlbGVtZXRyeVNlcnZpY2VdLFxuXHRcdFx0XHRbSUxvZ1NlcnZpY2UsIG5ldyBOdWxsTG9nU2VydmljZSgpXSxcblx0XHRcdFx0W0lTdG9yYWdlU2VydmljZSwgZGlzcG9zYWJsZVN0b3JlLmFkZChuZXcgSW5NZW1vcnlTdG9yYWdlU2VydmljZSgpKV0sXG5cdFx0XHRcdFtJS2V5YmluZGluZ1NlcnZpY2UsIG5ldyBNb2NrS2V5YmluZGluZ1NlcnZpY2UoKV0sXG5cdFx0XHRcdFtJRWRpdG9yV29ya2VyU2VydmljZSwgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJRWRpdG9yV29ya2VyU2VydmljZT4oKSB7XG5cdFx0XHRcdFx0b3ZlcnJpZGUgY29tcHV0ZVdvcmRSYW5nZXMoKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHt9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1dLFxuXHRcdFx0XHRbSVN1Z2dlc3RNZW1vcnlTZXJ2aWNlLCBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElTdWdnZXN0TWVtb3J5U2VydmljZT4oKSB7XG5cdFx0XHRcdFx0b3ZlcnJpZGUgbWVtb3JpemUoKTogdm9pZCB7IH1cblx0XHRcdFx0XHRvdmVycmlkZSBzZWxlY3QoKTogbnVtYmVyIHsgcmV0dXJuIDA7IH1cblx0XHRcdFx0fV0sXG5cdFx0XHRcdFtJTWVudVNlcnZpY2UsIG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SU1lbnVTZXJ2aWNlPigpIHtcblx0XHRcdFx0XHRvdmVycmlkZSBjcmVhdGVNZW51KCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SU1lbnU+KCkge1xuXHRcdFx0XHRcdFx0XHRvdmVycmlkZSBvbkRpZENoYW5nZSA9IEV2ZW50Lk5vbmU7XG5cdFx0XHRcdFx0XHRcdG92ZXJyaWRlIGRpc3Bvc2UoKSB7IH1cblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XSxcblx0XHRcdFx0W0lMYWJlbFNlcnZpY2UsIG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SUxhYmVsU2VydmljZT4oKSB7IH1dLFxuXHRcdFx0XHRbSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElXb3Jrc3BhY2VDb250ZXh0U2VydmljZT4oKSB7IH1dLFxuXHRcdFx0XHRbSUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLCB7XG5cdFx0XHRcdFx0cGxheVNpZ25hbDogYXN5bmMgKCkgPT4geyB9LFxuXHRcdFx0XHRcdGlzU291bmRFbmFibGVkKHNpZ25hbDogdW5rbm93bikgeyByZXR1cm4gZmFsc2U7IH0sXG5cdFx0XHRcdH0gYXMgYW55XVxuXHRcdFx0KTtcblxuXHRcdFx0aWYgKG9wdGlvbnMucHJvdmlkZXIpIHtcblx0XHRcdFx0Y29uc3QgbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgPSBuZXcgTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UoKTtcblx0XHRcdFx0c2VydmljZUNvbGxlY3Rpb24uc2V0KElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSwgbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UpO1xuXHRcdFx0XHRkaXNwb3NhYmxlU3RvcmUuYWRkKGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmNvbXBsZXRpb25Qcm92aWRlci5yZWdpc3Rlcih7IHBhdHRlcm46ICcqKicgfSwgb3B0aW9ucy5wcm92aWRlcikpO1xuXHRcdFx0fVxuXG5cdFx0XHRhd2FpdCB3aXRoQXN5bmNUZXN0Q29kZUVkaXRvcih0ZXh0LCB7IC4uLm9wdGlvbnMsIHNlcnZpY2VDb2xsZWN0aW9uIH0sIGFzeW5jIChlZGl0b3IsIGVkaXRvclZpZXdNb2RlbCwgaW5zdGFudGlhdGlvblNlcnZpY2UpID0+IHtcblx0XHRcdFx0ZWRpdG9yLnJlZ2lzdGVyQW5kSW5zdGFudGlhdGVDb250cmlidXRpb24oU25pcHBldENvbnRyb2xsZXIyLklELCBTbmlwcGV0Q29udHJvbGxlcjIpO1xuXHRcdFx0XHRlZGl0b3IucmVnaXN0ZXJBbmRJbnN0YW50aWF0ZUNvbnRyaWJ1dGlvbihTdWdnZXN0Q29udHJvbGxlci5JRCwgU3VnZ2VzdENvbnRyb2xsZXIpO1xuXHRcdFx0XHRlZGl0b3IucmVnaXN0ZXJBbmRJbnN0YW50aWF0ZUNvbnRyaWJ1dGlvbihJbmxpbmVDb21wbGV0aW9uc0NvbnRyb2xsZXIuSUQsIElubGluZUNvbXBsZXRpb25zQ29udHJvbGxlcik7XG5cdFx0XHRcdGNvbnN0IG1vZGVsID0gSW5saW5lQ29tcGxldGlvbnNDb250cm9sbGVyLmdldChlZGl0b3IpPy5tb2RlbC5nZXQoKSE7XG5cblx0XHRcdFx0Y29uc3QgY29udGV4dCA9IG5ldyBHaG9zdFRleHRDb250ZXh0KG1vZGVsLCBlZGl0b3IpO1xuXHRcdFx0XHRhd2FpdCBjYWxsYmFjayh7IGVkaXRvciwgZWRpdG9yVmlld01vZGVsLCBtb2RlbCwgY29udGV4dCB9KTtcblx0XHRcdFx0Y29udGV4dC5kaXNwb3NlKCk7XG5cdFx0XHR9KTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0ZGlzcG9zYWJsZVN0b3JlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsYUFBYTtBQUN0QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLFlBQVk7QUFDckIsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsMEJBQWtEO0FBQzNELFNBQVMsNEJBQTRCO0FBRXJDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQThELCtCQUErQjtBQUM3RixTQUFnQixvQkFBb0I7QUFDcEMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxhQUFhLHNCQUFzQjtBQUM1QyxTQUFTLHdCQUF3Qix1QkFBdUI7QUFDeEQsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyw0QkFBNEI7QUFDckMsT0FBTyxZQUFZO0FBQ25CLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsZ0NBQWdDO0FBRXpDLFNBQVMsbUNBQW1DO0FBQzVDLFNBQVMsZUFBZTtBQUN4QixTQUFTLGlDQUFpQztBQUMxQyxTQUFTLG1DQUFtQztBQUM1QyxTQUFTLCtDQUEr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
