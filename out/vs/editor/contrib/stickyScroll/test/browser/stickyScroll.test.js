import assert from "assert";
import { withAsyncTestCodeEditor } from "../../../../test/browser/testCodeEditor.js";
import { StickyScrollController } from "../../browser/stickyScrollController.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { ILanguageFeaturesService } from "../../../../common/services/languageFeatures.js";
import { createTextModel } from "../../../../test/common/testTextModel.js";
import { LanguageFeaturesService } from "../../../../common/services/languageFeaturesService.js";
import { SymbolKind } from "../../../../common/languages.js";
import { StickyLineCandidate, StickyLineCandidateProvider } from "../../browser/stickyScrollProvider.js";
import { EditorOption } from "../../../../common/config/editorOptions.js";
import { ILogService, NullLogService } from "../../../../../platform/log/common/log.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { mock } from "../../../../../base/test/common/mock.js";
import { ILanguageConfigurationService } from "../../../../common/languages/languageConfigurationRegistry.js";
import { ILanguageFeatureDebounceService, LanguageFeatureDebounceService } from "../../../../common/services/languageFeatureDebounce.js";
import { TestLanguageConfigurationService } from "../../../../test/common/modes/testLanguageConfigurationService.js";
import { SyncDescriptor } from "../../../../../platform/instantiation/common/descriptors.js";
import { runWithFakedTimers } from "../../../../../base/test/common/timeTravelScheduler.js";
import { IEnvironmentService } from "../../../../../platform/environment/common/environment.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
suite("Sticky Scroll Tests", () => {
  const disposables = new DisposableStore();
  const serviceCollection = new ServiceCollection(
    [ILanguageFeaturesService, new LanguageFeaturesService()],
    [ILogService, new NullLogService()],
    [IContextMenuService, new class extends mock() {
    }()],
    [ILanguageConfigurationService, new TestLanguageConfigurationService()],
    [IEnvironmentService, new class extends mock() {
      constructor() {
        super(...arguments);
        this.isBuilt = true;
        this.isExtensionDevelopment = false;
      }
    }()],
    [ILanguageFeatureDebounceService, new SyncDescriptor(LanguageFeatureDebounceService)]
  );
  const text = [
    "function foo() {",
    "",
    "}",
    "/* comment related to TestClass",
    " end of the comment */",
    "@classDecorator",
    "class TestClass {",
    "// comment related to the function functionOfClass",
    "functionOfClass(){",
    "function function1(){",
    "}",
    "}}",
    "function bar() { function insideBar() {}",
    "}"
  ].join("\n");
  setup(() => {
    disposables.clear();
  });
  teardown(() => {
    disposables.clear();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  function documentSymbolProviderForTestModel() {
    return {
      provideDocumentSymbols() {
        return [
          {
            name: "foo",
            detail: "foo",
            kind: SymbolKind.Function,
            tags: [],
            range: { startLineNumber: 1, endLineNumber: 3, startColumn: 1, endColumn: 1 },
            selectionRange: { startLineNumber: 1, endLineNumber: 1, startColumn: 1, endColumn: 1 }
          },
          {
            name: "TestClass",
            detail: "TestClass",
            kind: SymbolKind.Class,
            tags: [],
            range: { startLineNumber: 4, endLineNumber: 12, startColumn: 1, endColumn: 1 },
            selectionRange: { startLineNumber: 7, endLineNumber: 7, startColumn: 1, endColumn: 1 },
            children: [
              {
                name: "functionOfClass",
                detail: "functionOfClass",
                kind: SymbolKind.Function,
                tags: [],
                range: { startLineNumber: 8, endLineNumber: 12, startColumn: 1, endColumn: 1 },
                selectionRange: { startLineNumber: 9, endLineNumber: 9, startColumn: 1, endColumn: 1 },
                children: [
                  {
                    name: "function1",
                    detail: "function1",
                    kind: SymbolKind.Function,
                    tags: [],
                    range: { startLineNumber: 10, endLineNumber: 11, startColumn: 1, endColumn: 1 },
                    selectionRange: { startLineNumber: 10, endLineNumber: 10, startColumn: 1, endColumn: 1 }
                  }
                ]
              }
            ]
          },
          {
            name: "bar",
            detail: "bar",
            kind: SymbolKind.Function,
            tags: [],
            range: { startLineNumber: 13, endLineNumber: 14, startColumn: 1, endColumn: 1 },
            selectionRange: { startLineNumber: 13, endLineNumber: 13, startColumn: 1, endColumn: 1 },
            children: [
              {
                name: "insideBar",
                detail: "insideBar",
                kind: SymbolKind.Function,
                tags: [],
                range: { startLineNumber: 13, endLineNumber: 13, startColumn: 1, endColumn: 1 },
                selectionRange: { startLineNumber: 13, endLineNumber: 13, startColumn: 1, endColumn: 1 }
              }
            ]
          }
        ];
      }
    };
  }
  test("Testing the function getCandidateStickyLinesIntersecting", () => {
    return runWithFakedTimers({ useFakeTimers: true }, async () => {
      const model = createTextModel(text);
      await withAsyncTestCodeEditor(model, {
        stickyScroll: {
          enabled: true,
          maxLineCount: 5,
          defaultModel: "outlineModel"
        },
        envConfig: {
          outerHeight: 500
        },
        serviceCollection
      }, async (editor, _viewModel, instantiationService) => {
        const languageService = instantiationService.get(ILanguageFeaturesService);
        const languageConfigurationService = instantiationService.get(ILanguageConfigurationService);
        disposables.add(languageService.documentSymbolProvider.register("*", documentSymbolProviderForTestModel()));
        const provider = new StickyLineCandidateProvider(editor, languageService, languageConfigurationService);
        await provider.update();
        assert.deepStrictEqual(provider.getCandidateStickyLinesIntersecting({ startLineNumber: 1, endLineNumber: 4 }), [new StickyLineCandidate(1, 2, 0, 19)]);
        assert.deepStrictEqual(provider.getCandidateStickyLinesIntersecting({ startLineNumber: 8, endLineNumber: 10 }), [new StickyLineCandidate(7, 11, 0, 19), new StickyLineCandidate(9, 11, 19, 19), new StickyLineCandidate(10, 10, 38, 19)]);
        assert.deepStrictEqual(provider.getCandidateStickyLinesIntersecting({ startLineNumber: 10, endLineNumber: 13 }), [new StickyLineCandidate(7, 11, 0, 19), new StickyLineCandidate(9, 11, 19, 19), new StickyLineCandidate(10, 10, 38, 19)]);
        provider.dispose();
        model.dispose();
      });
    });
  });
  test("issue #157180: Render the correct line corresponding to the scope definition", () => {
    return runWithFakedTimers({ useFakeTimers: true }, async () => {
      const model = createTextModel(text);
      await withAsyncTestCodeEditor(model, {
        stickyScroll: {
          enabled: true,
          maxLineCount: 5,
          defaultModel: "outlineModel"
        },
        envConfig: {
          outerHeight: 500
        },
        serviceCollection
      }, async (editor, _viewModel, instantiationService) => {
        const stickyScrollController = editor.registerAndInstantiateContribution(StickyScrollController.ID, StickyScrollController);
        const lineHeight = editor.getOption(EditorOption.lineHeight);
        const languageService = instantiationService.get(ILanguageFeaturesService);
        disposables.add(languageService.documentSymbolProvider.register("*", documentSymbolProviderForTestModel()));
        await stickyScrollController.stickyScrollCandidateProvider.update();
        let state;
        editor.setScrollTop(1);
        state = stickyScrollController.findScrollWidgetState();
        assert.deepStrictEqual(state.startLineNumbers, [1]);
        editor.setScrollTop(lineHeight + 1);
        state = stickyScrollController.findScrollWidgetState();
        assert.deepStrictEqual(state.startLineNumbers, [1]);
        editor.setScrollTop(4 * lineHeight + 1);
        state = stickyScrollController.findScrollWidgetState();
        assert.deepStrictEqual(state.startLineNumbers, []);
        editor.setScrollTop(8 * lineHeight + 1);
        state = stickyScrollController.findScrollWidgetState();
        assert.deepStrictEqual(state.startLineNumbers, [7, 9]);
        editor.setScrollTop(9 * lineHeight + 1);
        state = stickyScrollController.findScrollWidgetState();
        assert.deepStrictEqual(state.startLineNumbers, [7, 9]);
        editor.setScrollTop(10 * lineHeight + 1);
        state = stickyScrollController.findScrollWidgetState();
        assert.deepStrictEqual(state.startLineNumbers, [7]);
        stickyScrollController.dispose();
        stickyScrollController.stickyScrollCandidateProvider.dispose();
        model.dispose();
      });
    });
  });
  test("issue #156268 : Do not reveal sticky lines when they are in a folded region ", () => {
    return runWithFakedTimers({ useFakeTimers: true }, async () => {
      const model = createTextModel(text);
      await withAsyncTestCodeEditor(model, {
        stickyScroll: {
          enabled: true,
          maxLineCount: 5,
          defaultModel: "outlineModel"
        },
        envConfig: {
          outerHeight: 500
        },
        serviceCollection
      }, async (editor, viewModel, instantiationService) => {
        const stickyScrollController = editor.registerAndInstantiateContribution(StickyScrollController.ID, StickyScrollController);
        const lineHeight = editor.getOption(EditorOption.lineHeight);
        const languageService = instantiationService.get(ILanguageFeaturesService);
        disposables.add(languageService.documentSymbolProvider.register("*", documentSymbolProviderForTestModel()));
        await stickyScrollController.stickyScrollCandidateProvider.update();
        editor.setHiddenAreas([{ startLineNumber: 2, endLineNumber: 2, startColumn: 1, endColumn: 1 }, { startLineNumber: 10, endLineNumber: 11, startColumn: 1, endColumn: 1 }]);
        let state;
        editor.setScrollTop(1);
        state = stickyScrollController.findScrollWidgetState();
        assert.deepStrictEqual(state.startLineNumbers, [1]);
        editor.setScrollTop(lineHeight + 1);
        state = stickyScrollController.findScrollWidgetState();
        assert.deepStrictEqual(state.startLineNumbers, []);
        editor.setScrollTop(6 * lineHeight + 1);
        state = stickyScrollController.findScrollWidgetState();
        assert.deepStrictEqual(state.startLineNumbers, [7, 9]);
        editor.setScrollTop(7 * lineHeight + 1);
        state = stickyScrollController.findScrollWidgetState();
        assert.deepStrictEqual(state.startLineNumbers, [7]);
        editor.setScrollTop(10 * lineHeight + 1);
        state = stickyScrollController.findScrollWidgetState();
        assert.deepStrictEqual(state.startLineNumbers, []);
        stickyScrollController.dispose();
        stickyScrollController.stickyScrollCandidateProvider.dispose();
        model.dispose();
      });
    });
  });
  const textWithScopesWithSameStartingLines = [
    "class TestClass { foo() {",
    "function bar(){",
    "",
    "}}",
    "}",
    ""
  ].join("\n");
  function documentSymbolProviderForSecondTestModel() {
    return {
      provideDocumentSymbols() {
        return [
          {
            name: "TestClass",
            detail: "TestClass",
            kind: SymbolKind.Class,
            tags: [],
            range: { startLineNumber: 1, endLineNumber: 5, startColumn: 1, endColumn: 1 },
            selectionRange: { startLineNumber: 1, endLineNumber: 1, startColumn: 1, endColumn: 1 },
            children: [
              {
                name: "foo",
                detail: "foo",
                kind: SymbolKind.Function,
                tags: [],
                range: { startLineNumber: 1, endLineNumber: 4, startColumn: 1, endColumn: 1 },
                selectionRange: { startLineNumber: 1, endLineNumber: 1, startColumn: 1, endColumn: 1 },
                children: [
                  {
                    name: "bar",
                    detail: "bar",
                    kind: SymbolKind.Function,
                    tags: [],
                    range: { startLineNumber: 2, endLineNumber: 4, startColumn: 1, endColumn: 1 },
                    selectionRange: { startLineNumber: 2, endLineNumber: 2, startColumn: 1, endColumn: 1 },
                    children: []
                  }
                ]
              }
            ]
          }
        ];
      }
    };
  }
  test("issue #159271 : render the correct widget state when the child scope starts on the same line as the parent scope", () => {
    return runWithFakedTimers({ useFakeTimers: true }, async () => {
      const model = createTextModel(textWithScopesWithSameStartingLines);
      await withAsyncTestCodeEditor(model, {
        stickyScroll: {
          enabled: true,
          maxLineCount: 5,
          defaultModel: "outlineModel"
        },
        envConfig: {
          outerHeight: 500
        },
        serviceCollection
      }, async (editor, _viewModel, instantiationService) => {
        const stickyScrollController = editor.registerAndInstantiateContribution(StickyScrollController.ID, StickyScrollController);
        await stickyScrollController.stickyScrollCandidateProvider.update();
        const lineHeight = editor.getOption(EditorOption.lineHeight);
        const languageService = instantiationService.get(ILanguageFeaturesService);
        disposables.add(languageService.documentSymbolProvider.register("*", documentSymbolProviderForSecondTestModel()));
        await stickyScrollController.stickyScrollCandidateProvider.update();
        let state;
        editor.setScrollTop(1);
        state = stickyScrollController.findScrollWidgetState();
        assert.deepStrictEqual(state.startLineNumbers, [1, 2]);
        editor.setScrollTop(lineHeight + 1);
        state = stickyScrollController.findScrollWidgetState();
        assert.deepStrictEqual(state.startLineNumbers, [1, 2]);
        editor.setScrollTop(2 * lineHeight + 1);
        state = stickyScrollController.findScrollWidgetState();
        assert.deepStrictEqual(state.startLineNumbers, [1]);
        editor.setScrollTop(3 * lineHeight + 1);
        state = stickyScrollController.findScrollWidgetState();
        assert.deepStrictEqual(state.startLineNumbers, [1]);
        editor.setScrollTop(4 * lineHeight + 1);
        state = stickyScrollController.findScrollWidgetState();
        assert.deepStrictEqual(state.startLineNumbers, []);
        stickyScrollController.dispose();
        stickyScrollController.stickyScrollCandidateProvider.dispose();
        model.dispose();
      });
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9zdGlja3lTY3JvbGwvdGVzdC9icm93c2VyL3N0aWNreVNjcm9sbC50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IHdpdGhBc3luY1Rlc3RDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9icm93c2VyL3Rlc3RDb2RlRWRpdG9yLmpzJztcbmltcG9ydCB7IFN0aWNreVNjcm9sbENvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi9icm93c2VyL3N0aWNreVNjcm9sbENvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgU2VydmljZUNvbGxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9zZXJ2aWNlQ29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlcy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2NvbW1vbi90ZXN0VGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IExhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IERvY3VtZW50U3ltYm9sLCBTeW1ib2xLaW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBTdGlja3lMaW5lQ2FuZGlkYXRlLCBTdGlja3lMaW5lQ2FuZGlkYXRlUHJvdmlkZXIgfSBmcm9tICcuLi8uLi9icm93c2VyL3N0aWNreVNjcm9sbFByb3ZpZGVyLmpzJztcbmltcG9ydCB7IEVkaXRvck9wdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSwgTnVsbExvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBtb2NrIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi9tb2NrLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZUNvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2VTZXJ2aWNlLCBMYW5ndWFnZUZlYXR1cmVEZWJvdW5jZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2UuanMnO1xuaW1wb3J0IHsgVGVzdExhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2NvbW1vbi9tb2Rlcy90ZXN0TGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBTeW5jRGVzY3JpcHRvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2Rlc2NyaXB0b3JzLmpzJztcbmltcG9ydCB7IHJ1bldpdGhGYWtlZFRpbWVycyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdGltZVRyYXZlbFNjaGVkdWxlci5qcyc7XG5pbXBvcnQgeyBJRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50LmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcblxuc3VpdGUoJ1N0aWNreSBTY3JvbGwgVGVzdHMnLCAoKSA9PiB7XG5cblx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0Y29uc3Qgc2VydmljZUNvbGxlY3Rpb24gPSBuZXcgU2VydmljZUNvbGxlY3Rpb24oXG5cdFx0W0lMYW5ndWFnZUZlYXR1cmVzU2VydmljZSwgbmV3IExhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlKCldLFxuXHRcdFtJTG9nU2VydmljZSwgbmV3IE51bGxMb2dTZXJ2aWNlKCldLFxuXHRcdFtJQ29udGV4dE1lbnVTZXJ2aWNlLCBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElDb250ZXh0TWVudVNlcnZpY2U+KCkgeyB9XSxcblx0XHRbSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UsIG5ldyBUZXN0TGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSgpXSxcblx0XHRbSUVudmlyb25tZW50U2VydmljZSwgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJRW52aXJvbm1lbnRTZXJ2aWNlPigpIHtcblx0XHRcdG92ZXJyaWRlIGlzQnVpbHQ6IGJvb2xlYW4gPSB0cnVlO1xuXHRcdFx0b3ZlcnJpZGUgaXNFeHRlbnNpb25EZXZlbG9wbWVudDogYm9vbGVhbiA9IGZhbHNlO1xuXHRcdH1dLFxuXHRcdFtJTGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2VTZXJ2aWNlLCBuZXcgU3luY0Rlc2NyaXB0b3IoTGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2VTZXJ2aWNlKV0sXG5cdCk7XG5cblx0Y29uc3QgdGV4dCA9IFtcblx0XHQnZnVuY3Rpb24gZm9vKCkgeycsXG5cdFx0JycsXG5cdFx0J30nLFxuXHRcdCcvKiBjb21tZW50IHJlbGF0ZWQgdG8gVGVzdENsYXNzJyxcblx0XHQnIGVuZCBvZiB0aGUgY29tbWVudCAqLycsXG5cdFx0J0BjbGFzc0RlY29yYXRvcicsXG5cdFx0J2NsYXNzIFRlc3RDbGFzcyB7Jyxcblx0XHQnLy8gY29tbWVudCByZWxhdGVkIHRvIHRoZSBmdW5jdGlvbiBmdW5jdGlvbk9mQ2xhc3MnLFxuXHRcdCdmdW5jdGlvbk9mQ2xhc3MoKXsnLFxuXHRcdCdmdW5jdGlvbiBmdW5jdGlvbjEoKXsnLFxuXHRcdCd9Jyxcblx0XHQnfX0nLFxuXHRcdCdmdW5jdGlvbiBiYXIoKSB7IGZ1bmN0aW9uIGluc2lkZUJhcigpIHt9Jyxcblx0XHQnfSdcblx0XS5qb2luKCdcXG4nKTtcblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0fSk7XG5cdHRlYXJkb3duKCgpID0+IHtcblx0XHRkaXNwb3NhYmxlcy5jbGVhcigpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRmdW5jdGlvbiBkb2N1bWVudFN5bWJvbFByb3ZpZGVyRm9yVGVzdE1vZGVsKCkge1xuXHRcdHJldHVybiB7XG5cdFx0XHRwcm92aWRlRG9jdW1lbnRTeW1ib2xzKCkge1xuXHRcdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdG5hbWU6ICdmb28nLFxuXHRcdFx0XHRcdFx0ZGV0YWlsOiAnZm9vJyxcblx0XHRcdFx0XHRcdGtpbmQ6IFN5bWJvbEtpbmQuRnVuY3Rpb24sXG5cdFx0XHRcdFx0XHR0YWdzOiBbXSxcblx0XHRcdFx0XHRcdHJhbmdlOiB7IHN0YXJ0TGluZU51bWJlcjogMSwgZW5kTGluZU51bWJlcjogMywgc3RhcnRDb2x1bW46IDEsIGVuZENvbHVtbjogMSB9LFxuXHRcdFx0XHRcdFx0c2VsZWN0aW9uUmFuZ2U6IHsgc3RhcnRMaW5lTnVtYmVyOiAxLCBlbmRMaW5lTnVtYmVyOiAxLCBzdGFydENvbHVtbjogMSwgZW5kQ29sdW1uOiAxIH1cblx0XHRcdFx0XHR9IGFzIERvY3VtZW50U3ltYm9sLFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdG5hbWU6ICdUZXN0Q2xhc3MnLFxuXHRcdFx0XHRcdFx0ZGV0YWlsOiAnVGVzdENsYXNzJyxcblx0XHRcdFx0XHRcdGtpbmQ6IFN5bWJvbEtpbmQuQ2xhc3MsXG5cdFx0XHRcdFx0XHR0YWdzOiBbXSxcblx0XHRcdFx0XHRcdHJhbmdlOiB7IHN0YXJ0TGluZU51bWJlcjogNCwgZW5kTGluZU51bWJlcjogMTIsIHN0YXJ0Q29sdW1uOiAxLCBlbmRDb2x1bW46IDEgfSxcblx0XHRcdFx0XHRcdHNlbGVjdGlvblJhbmdlOiB7IHN0YXJ0TGluZU51bWJlcjogNywgZW5kTGluZU51bWJlcjogNywgc3RhcnRDb2x1bW46IDEsIGVuZENvbHVtbjogMSB9LFxuXHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdmdW5jdGlvbk9mQ2xhc3MnLFxuXHRcdFx0XHRcdFx0XHRcdGRldGFpbDogJ2Z1bmN0aW9uT2ZDbGFzcycsXG5cdFx0XHRcdFx0XHRcdFx0a2luZDogU3ltYm9sS2luZC5GdW5jdGlvbixcblx0XHRcdFx0XHRcdFx0XHR0YWdzOiBbXSxcblx0XHRcdFx0XHRcdFx0XHRyYW5nZTogeyBzdGFydExpbmVOdW1iZXI6IDgsIGVuZExpbmVOdW1iZXI6IDEyLCBzdGFydENvbHVtbjogMSwgZW5kQ29sdW1uOiAxIH0sXG5cdFx0XHRcdFx0XHRcdFx0c2VsZWN0aW9uUmFuZ2U6IHsgc3RhcnRMaW5lTnVtYmVyOiA5LCBlbmRMaW5lTnVtYmVyOiA5LCBzdGFydENvbHVtbjogMSwgZW5kQ29sdW1uOiAxIH0sXG5cdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ2Z1bmN0aW9uMScsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGRldGFpbDogJ2Z1bmN0aW9uMScsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGtpbmQ6IFN5bWJvbEtpbmQuRnVuY3Rpb24sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHRhZ3M6IFtdLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRyYW5nZTogeyBzdGFydExpbmVOdW1iZXI6IDEwLCBlbmRMaW5lTnVtYmVyOiAxMSwgc3RhcnRDb2x1bW46IDEsIGVuZENvbHVtbjogMSB9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRzZWxlY3Rpb25SYW5nZTogeyBzdGFydExpbmVOdW1iZXI6IDEwLCBlbmRMaW5lTnVtYmVyOiAxMCwgc3RhcnRDb2x1bW46IDEsIGVuZENvbHVtbjogMSB9LFxuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHRcdFx0fSBhcyBEb2N1bWVudFN5bWJvbFxuXHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdH0gYXMgRG9jdW1lbnRTeW1ib2wsXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bmFtZTogJ2JhcicsXG5cdFx0XHRcdFx0XHRkZXRhaWw6ICdiYXInLFxuXHRcdFx0XHRcdFx0a2luZDogU3ltYm9sS2luZC5GdW5jdGlvbixcblx0XHRcdFx0XHRcdHRhZ3M6IFtdLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IHsgc3RhcnRMaW5lTnVtYmVyOiAxMywgZW5kTGluZU51bWJlcjogMTQsIHN0YXJ0Q29sdW1uOiAxLCBlbmRDb2x1bW46IDEgfSxcblx0XHRcdFx0XHRcdHNlbGVjdGlvblJhbmdlOiB7IHN0YXJ0TGluZU51bWJlcjogMTMsIGVuZExpbmVOdW1iZXI6IDEzLCBzdGFydENvbHVtbjogMSwgZW5kQ29sdW1uOiAxIH0sXG5cdFx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0bmFtZTogJ2luc2lkZUJhcicsXG5cdFx0XHRcdFx0XHRcdFx0ZGV0YWlsOiAnaW5zaWRlQmFyJyxcblx0XHRcdFx0XHRcdFx0XHRraW5kOiBTeW1ib2xLaW5kLkZ1bmN0aW9uLFxuXHRcdFx0XHRcdFx0XHRcdHRhZ3M6IFtdLFxuXHRcdFx0XHRcdFx0XHRcdHJhbmdlOiB7IHN0YXJ0TGluZU51bWJlcjogMTMsIGVuZExpbmVOdW1iZXI6IDEzLCBzdGFydENvbHVtbjogMSwgZW5kQ29sdW1uOiAxIH0sXG5cdFx0XHRcdFx0XHRcdFx0c2VsZWN0aW9uUmFuZ2U6IHsgc3RhcnRMaW5lTnVtYmVyOiAxMywgZW5kTGluZU51bWJlcjogMTMsIHN0YXJ0Q29sdW1uOiAxLCBlbmRDb2x1bW46IDEgfSxcblx0XHRcdFx0XHRcdFx0fSBhcyBEb2N1bWVudFN5bWJvbFxuXHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdH0gYXMgRG9jdW1lbnRTeW1ib2xcblx0XHRcdFx0XTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0dGVzdCgnVGVzdGluZyB0aGUgZnVuY3Rpb24gZ2V0Q2FuZGlkYXRlU3RpY2t5TGluZXNJbnRlcnNlY3RpbmcnLCAoKSA9PiB7XG5cdFx0cmV0dXJuIHJ1bldpdGhGYWtlZFRpbWVycyh7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwodGV4dCk7XG5cdFx0XHRhd2FpdCB3aXRoQXN5bmNUZXN0Q29kZUVkaXRvcihtb2RlbCwge1xuXHRcdFx0XHRzdGlja3lTY3JvbGw6IHtcblx0XHRcdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0XHRcdG1heExpbmVDb3VudDogNSxcblx0XHRcdFx0XHRkZWZhdWx0TW9kZWw6ICdvdXRsaW5lTW9kZWwnXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGVudkNvbmZpZzoge1xuXHRcdFx0XHRcdG91dGVySGVpZ2h0OiA1MDBcblx0XHRcdFx0fSxcblx0XHRcdFx0c2VydmljZUNvbGxlY3Rpb246IHNlcnZpY2VDb2xsZWN0aW9uXG5cdFx0XHR9LCBhc3luYyAoZWRpdG9yLCBfdmlld01vZGVsLCBpbnN0YW50aWF0aW9uU2VydmljZSkgPT4ge1xuXHRcdFx0XHRjb25zdCBsYW5ndWFnZVNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3QgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0XHRcdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnZVNlcnZpY2UuZG9jdW1lbnRTeW1ib2xQcm92aWRlci5yZWdpc3RlcignKicsIGRvY3VtZW50U3ltYm9sUHJvdmlkZXJGb3JUZXN0TW9kZWwoKSkpO1xuXHRcdFx0XHRjb25zdCBwcm92aWRlcjogU3RpY2t5TGluZUNhbmRpZGF0ZVByb3ZpZGVyID0gbmV3IFN0aWNreUxpbmVDYW5kaWRhdGVQcm92aWRlcihlZGl0b3IsIGxhbmd1YWdlU2VydmljZSwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0XHRcdGF3YWl0IHByb3ZpZGVyLnVwZGF0ZSgpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHByb3ZpZGVyLmdldENhbmRpZGF0ZVN0aWNreUxpbmVzSW50ZXJzZWN0aW5nKHsgc3RhcnRMaW5lTnVtYmVyOiAxLCBlbmRMaW5lTnVtYmVyOiA0IH0pLCBbbmV3IFN0aWNreUxpbmVDYW5kaWRhdGUoMSwgMiwgMCwgMTkpXSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocHJvdmlkZXIuZ2V0Q2FuZGlkYXRlU3RpY2t5TGluZXNJbnRlcnNlY3RpbmcoeyBzdGFydExpbmVOdW1iZXI6IDgsIGVuZExpbmVOdW1iZXI6IDEwIH0pLCBbbmV3IFN0aWNreUxpbmVDYW5kaWRhdGUoNywgMTEsIDAsIDE5KSwgbmV3IFN0aWNreUxpbmVDYW5kaWRhdGUoOSwgMTEsIDE5LCAxOSksIG5ldyBTdGlja3lMaW5lQ2FuZGlkYXRlKDEwLCAxMCwgMzgsIDE5KV0pO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHByb3ZpZGVyLmdldENhbmRpZGF0ZVN0aWNreUxpbmVzSW50ZXJzZWN0aW5nKHsgc3RhcnRMaW5lTnVtYmVyOiAxMCwgZW5kTGluZU51bWJlcjogMTMgfSksIFtuZXcgU3RpY2t5TGluZUNhbmRpZGF0ZSg3LCAxMSwgMCwgMTkpLCBuZXcgU3RpY2t5TGluZUNhbmRpZGF0ZSg5LCAxMSwgMTksIDE5KSwgbmV3IFN0aWNreUxpbmVDYW5kaWRhdGUoMTAsIDEwLCAzOCwgMTkpXSk7XG5cblx0XHRcdFx0cHJvdmlkZXIuZGlzcG9zZSgpO1xuXHRcdFx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzE1NzE4MDogUmVuZGVyIHRoZSBjb3JyZWN0IGxpbmUgY29ycmVzcG9uZGluZyB0byB0aGUgc2NvcGUgZGVmaW5pdGlvbicsICgpID0+IHtcblx0XHRyZXR1cm4gcnVuV2l0aEZha2VkVGltZXJzKHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbCh0ZXh0KTtcblx0XHRcdGF3YWl0IHdpdGhBc3luY1Rlc3RDb2RlRWRpdG9yKG1vZGVsLCB7XG5cdFx0XHRcdHN0aWNreVNjcm9sbDoge1xuXHRcdFx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRcdFx0bWF4TGluZUNvdW50OiA1LFxuXHRcdFx0XHRcdGRlZmF1bHRNb2RlbDogJ291dGxpbmVNb2RlbCdcblx0XHRcdFx0fSxcblx0XHRcdFx0ZW52Q29uZmlnOiB7XG5cdFx0XHRcdFx0b3V0ZXJIZWlnaHQ6IDUwMFxuXHRcdFx0XHR9LFxuXHRcdFx0XHRzZXJ2aWNlQ29sbGVjdGlvblxuXHRcdFx0fSwgYXN5bmMgKGVkaXRvciwgX3ZpZXdNb2RlbCwgaW5zdGFudGlhdGlvblNlcnZpY2UpID0+IHtcblxuXHRcdFx0XHRjb25zdCBzdGlja3lTY3JvbGxDb250cm9sbGVyOiBTdGlja3lTY3JvbGxDb250cm9sbGVyID0gZWRpdG9yLnJlZ2lzdGVyQW5kSW5zdGFudGlhdGVDb250cmlidXRpb24oU3RpY2t5U2Nyb2xsQ29udHJvbGxlci5JRCwgU3RpY2t5U2Nyb2xsQ29udHJvbGxlcik7XG5cdFx0XHRcdGNvbnN0IGxpbmVIZWlnaHQ6IG51bWJlciA9IGVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmxpbmVIZWlnaHQpO1xuXHRcdFx0XHRjb25zdCBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UpO1xuXHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VTZXJ2aWNlLmRvY3VtZW50U3ltYm9sUHJvdmlkZXIucmVnaXN0ZXIoJyonLCBkb2N1bWVudFN5bWJvbFByb3ZpZGVyRm9yVGVzdE1vZGVsKCkpKTtcblx0XHRcdFx0YXdhaXQgc3RpY2t5U2Nyb2xsQ29udHJvbGxlci5zdGlja3lTY3JvbGxDYW5kaWRhdGVQcm92aWRlci51cGRhdGUoKTtcblx0XHRcdFx0bGV0IHN0YXRlO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTY3JvbGxUb3AoMSk7XG5cdFx0XHRcdHN0YXRlID0gc3RpY2t5U2Nyb2xsQ29udHJvbGxlci5maW5kU2Nyb2xsV2lkZ2V0U3RhdGUoKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzdGF0ZS5zdGFydExpbmVOdW1iZXJzLCBbMV0pO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTY3JvbGxUb3AobGluZUhlaWdodCArIDEpO1xuXHRcdFx0XHRzdGF0ZSA9IHN0aWNreVNjcm9sbENvbnRyb2xsZXIuZmluZFNjcm9sbFdpZGdldFN0YXRlKCk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc3RhdGUuc3RhcnRMaW5lTnVtYmVycywgWzFdKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2Nyb2xsVG9wKDQgKiBsaW5lSGVpZ2h0ICsgMSk7XG5cdFx0XHRcdHN0YXRlID0gc3RpY2t5U2Nyb2xsQ29udHJvbGxlci5maW5kU2Nyb2xsV2lkZ2V0U3RhdGUoKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzdGF0ZS5zdGFydExpbmVOdW1iZXJzLCBbXSk7XG5cblx0XHRcdFx0ZWRpdG9yLnNldFNjcm9sbFRvcCg4ICogbGluZUhlaWdodCArIDEpO1xuXHRcdFx0XHRzdGF0ZSA9IHN0aWNreVNjcm9sbENvbnRyb2xsZXIuZmluZFNjcm9sbFdpZGdldFN0YXRlKCk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc3RhdGUuc3RhcnRMaW5lTnVtYmVycywgWzcsIDldKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2Nyb2xsVG9wKDkgKiBsaW5lSGVpZ2h0ICsgMSk7XG5cdFx0XHRcdHN0YXRlID0gc3RpY2t5U2Nyb2xsQ29udHJvbGxlci5maW5kU2Nyb2xsV2lkZ2V0U3RhdGUoKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzdGF0ZS5zdGFydExpbmVOdW1iZXJzLCBbNywgOV0pO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTY3JvbGxUb3AoMTAgKiBsaW5lSGVpZ2h0ICsgMSk7XG5cdFx0XHRcdHN0YXRlID0gc3RpY2t5U2Nyb2xsQ29udHJvbGxlci5maW5kU2Nyb2xsV2lkZ2V0U3RhdGUoKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzdGF0ZS5zdGFydExpbmVOdW1iZXJzLCBbN10pO1xuXG5cdFx0XHRcdHN0aWNreVNjcm9sbENvbnRyb2xsZXIuZGlzcG9zZSgpO1xuXHRcdFx0XHRzdGlja3lTY3JvbGxDb250cm9sbGVyLnN0aWNreVNjcm9sbENhbmRpZGF0ZVByb3ZpZGVyLmRpc3Bvc2UoKTtcblx0XHRcdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxNTYyNjggOiBEbyBub3QgcmV2ZWFsIHN0aWNreSBsaW5lcyB3aGVuIHRoZXkgYXJlIGluIGEgZm9sZGVkIHJlZ2lvbiAnLCAoKSA9PiB7XG5cdFx0cmV0dXJuIHJ1bldpdGhGYWtlZFRpbWVycyh7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwodGV4dCk7XG5cdFx0XHRhd2FpdCB3aXRoQXN5bmNUZXN0Q29kZUVkaXRvcihtb2RlbCwge1xuXHRcdFx0XHRzdGlja3lTY3JvbGw6IHtcblx0XHRcdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0XHRcdG1heExpbmVDb3VudDogNSxcblx0XHRcdFx0XHRkZWZhdWx0TW9kZWw6ICdvdXRsaW5lTW9kZWwnXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGVudkNvbmZpZzoge1xuXHRcdFx0XHRcdG91dGVySGVpZ2h0OiA1MDBcblx0XHRcdFx0fSxcblx0XHRcdFx0c2VydmljZUNvbGxlY3Rpb25cblx0XHRcdH0sIGFzeW5jIChlZGl0b3IsIHZpZXdNb2RlbCwgaW5zdGFudGlhdGlvblNlcnZpY2UpID0+IHtcblxuXHRcdFx0XHRjb25zdCBzdGlja3lTY3JvbGxDb250cm9sbGVyOiBTdGlja3lTY3JvbGxDb250cm9sbGVyID0gZWRpdG9yLnJlZ2lzdGVyQW5kSW5zdGFudGlhdGVDb250cmlidXRpb24oU3RpY2t5U2Nyb2xsQ29udHJvbGxlci5JRCwgU3RpY2t5U2Nyb2xsQ29udHJvbGxlcik7XG5cdFx0XHRcdGNvbnN0IGxpbmVIZWlnaHQgPSBlZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5saW5lSGVpZ2h0KTtcblxuXHRcdFx0XHRjb25zdCBsYW5ndWFnZVNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlKTtcblx0XHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlU2VydmljZS5kb2N1bWVudFN5bWJvbFByb3ZpZGVyLnJlZ2lzdGVyKCcqJywgZG9jdW1lbnRTeW1ib2xQcm92aWRlckZvclRlc3RNb2RlbCgpKSk7XG5cdFx0XHRcdGF3YWl0IHN0aWNreVNjcm9sbENvbnRyb2xsZXIuc3RpY2t5U2Nyb2xsQ2FuZGlkYXRlUHJvdmlkZXIudXBkYXRlKCk7XG5cdFx0XHRcdGVkaXRvci5zZXRIaWRkZW5BcmVhcyhbeyBzdGFydExpbmVOdW1iZXI6IDIsIGVuZExpbmVOdW1iZXI6IDIsIHN0YXJ0Q29sdW1uOiAxLCBlbmRDb2x1bW46IDEgfSwgeyBzdGFydExpbmVOdW1iZXI6IDEwLCBlbmRMaW5lTnVtYmVyOiAxMSwgc3RhcnRDb2x1bW46IDEsIGVuZENvbHVtbjogMSB9XSk7XG5cdFx0XHRcdGxldCBzdGF0ZTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2Nyb2xsVG9wKDEpO1xuXHRcdFx0XHRzdGF0ZSA9IHN0aWNreVNjcm9sbENvbnRyb2xsZXIuZmluZFNjcm9sbFdpZGdldFN0YXRlKCk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc3RhdGUuc3RhcnRMaW5lTnVtYmVycywgWzFdKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2Nyb2xsVG9wKGxpbmVIZWlnaHQgKyAxKTtcblx0XHRcdFx0c3RhdGUgPSBzdGlja3lTY3JvbGxDb250cm9sbGVyLmZpbmRTY3JvbGxXaWRnZXRTdGF0ZSgpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHN0YXRlLnN0YXJ0TGluZU51bWJlcnMsIFtdKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2Nyb2xsVG9wKDYgKiBsaW5lSGVpZ2h0ICsgMSk7XG5cdFx0XHRcdHN0YXRlID0gc3RpY2t5U2Nyb2xsQ29udHJvbGxlci5maW5kU2Nyb2xsV2lkZ2V0U3RhdGUoKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzdGF0ZS5zdGFydExpbmVOdW1iZXJzLCBbNywgOV0pO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTY3JvbGxUb3AoNyAqIGxpbmVIZWlnaHQgKyAxKTtcblx0XHRcdFx0c3RhdGUgPSBzdGlja3lTY3JvbGxDb250cm9sbGVyLmZpbmRTY3JvbGxXaWRnZXRTdGF0ZSgpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHN0YXRlLnN0YXJ0TGluZU51bWJlcnMsIFs3XSk7XG5cblx0XHRcdFx0ZWRpdG9yLnNldFNjcm9sbFRvcCgxMCAqIGxpbmVIZWlnaHQgKyAxKTtcblx0XHRcdFx0c3RhdGUgPSBzdGlja3lTY3JvbGxDb250cm9sbGVyLmZpbmRTY3JvbGxXaWRnZXRTdGF0ZSgpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHN0YXRlLnN0YXJ0TGluZU51bWJlcnMsIFtdKTtcblxuXHRcdFx0XHRzdGlja3lTY3JvbGxDb250cm9sbGVyLmRpc3Bvc2UoKTtcblx0XHRcdFx0c3RpY2t5U2Nyb2xsQ29udHJvbGxlci5zdGlja3lTY3JvbGxDYW5kaWRhdGVQcm92aWRlci5kaXNwb3NlKCk7XG5cdFx0XHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRjb25zdCB0ZXh0V2l0aFNjb3Blc1dpdGhTYW1lU3RhcnRpbmdMaW5lcyA9IFtcblx0XHQnY2xhc3MgVGVzdENsYXNzIHsgZm9vKCkgeycsXG5cdFx0J2Z1bmN0aW9uIGJhcigpeycsXG5cdFx0JycsXG5cdFx0J319Jyxcblx0XHQnfScsXG5cdFx0Jydcblx0XS5qb2luKCdcXG4nKTtcblxuXHRmdW5jdGlvbiBkb2N1bWVudFN5bWJvbFByb3ZpZGVyRm9yU2Vjb25kVGVzdE1vZGVsKCkge1xuXHRcdHJldHVybiB7XG5cdFx0XHRwcm92aWRlRG9jdW1lbnRTeW1ib2xzKCkge1xuXHRcdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdG5hbWU6ICdUZXN0Q2xhc3MnLFxuXHRcdFx0XHRcdFx0ZGV0YWlsOiAnVGVzdENsYXNzJyxcblx0XHRcdFx0XHRcdGtpbmQ6IFN5bWJvbEtpbmQuQ2xhc3MsXG5cdFx0XHRcdFx0XHR0YWdzOiBbXSxcblx0XHRcdFx0XHRcdHJhbmdlOiB7IHN0YXJ0TGluZU51bWJlcjogMSwgZW5kTGluZU51bWJlcjogNSwgc3RhcnRDb2x1bW46IDEsIGVuZENvbHVtbjogMSB9LFxuXHRcdFx0XHRcdFx0c2VsZWN0aW9uUmFuZ2U6IHsgc3RhcnRMaW5lTnVtYmVyOiAxLCBlbmRMaW5lTnVtYmVyOiAxLCBzdGFydENvbHVtbjogMSwgZW5kQ29sdW1uOiAxIH0sXG5cdFx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0bmFtZTogJ2ZvbycsXG5cdFx0XHRcdFx0XHRcdFx0ZGV0YWlsOiAnZm9vJyxcblx0XHRcdFx0XHRcdFx0XHRraW5kOiBTeW1ib2xLaW5kLkZ1bmN0aW9uLFxuXHRcdFx0XHRcdFx0XHRcdHRhZ3M6IFtdLFxuXHRcdFx0XHRcdFx0XHRcdHJhbmdlOiB7IHN0YXJ0TGluZU51bWJlcjogMSwgZW5kTGluZU51bWJlcjogNCwgc3RhcnRDb2x1bW46IDEsIGVuZENvbHVtbjogMSB9LFxuXHRcdFx0XHRcdFx0XHRcdHNlbGVjdGlvblJhbmdlOiB7IHN0YXJ0TGluZU51bWJlcjogMSwgZW5kTGluZU51bWJlcjogMSwgc3RhcnRDb2x1bW46IDEsIGVuZENvbHVtbjogMSB9LFxuXHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdiYXInLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRkZXRhaWw6ICdiYXInLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRraW5kOiBTeW1ib2xLaW5kLkZ1bmN0aW9uLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHR0YWdzOiBbXSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0cmFuZ2U6IHsgc3RhcnRMaW5lTnVtYmVyOiAyLCBlbmRMaW5lTnVtYmVyOiA0LCBzdGFydENvbHVtbjogMSwgZW5kQ29sdW1uOiAxIH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHNlbGVjdGlvblJhbmdlOiB7IHN0YXJ0TGluZU51bWJlcjogMiwgZW5kTGluZU51bWJlcjogMiwgc3RhcnRDb2x1bW46IDEsIGVuZENvbHVtbjogMSB9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjogW11cblx0XHRcdFx0XHRcdFx0XHRcdH0gYXMgRG9jdW1lbnRTeW1ib2xcblx0XHRcdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0XHRcdH0gYXMgRG9jdW1lbnRTeW1ib2wsXG5cdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0fSBhcyBEb2N1bWVudFN5bWJvbFxuXHRcdFx0XHRdO1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHR0ZXN0KCdpc3N1ZSAjMTU5MjcxIDogcmVuZGVyIHRoZSBjb3JyZWN0IHdpZGdldCBzdGF0ZSB3aGVuIHRoZSBjaGlsZCBzY29wZSBzdGFydHMgb24gdGhlIHNhbWUgbGluZSBhcyB0aGUgcGFyZW50IHNjb3BlJywgKCkgPT4ge1xuXHRcdHJldHVybiBydW5XaXRoRmFrZWRUaW1lcnMoeyB1c2VGYWtlVGltZXJzOiB0cnVlIH0sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKHRleHRXaXRoU2NvcGVzV2l0aFNhbWVTdGFydGluZ0xpbmVzKTtcblx0XHRcdGF3YWl0IHdpdGhBc3luY1Rlc3RDb2RlRWRpdG9yKG1vZGVsLCB7XG5cdFx0XHRcdHN0aWNreVNjcm9sbDoge1xuXHRcdFx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRcdFx0bWF4TGluZUNvdW50OiA1LFxuXHRcdFx0XHRcdGRlZmF1bHRNb2RlbDogJ291dGxpbmVNb2RlbCdcblx0XHRcdFx0fSxcblx0XHRcdFx0ZW52Q29uZmlnOiB7XG5cdFx0XHRcdFx0b3V0ZXJIZWlnaHQ6IDUwMFxuXHRcdFx0XHR9LFxuXHRcdFx0XHRzZXJ2aWNlQ29sbGVjdGlvblxuXHRcdFx0fSwgYXN5bmMgKGVkaXRvciwgX3ZpZXdNb2RlbCwgaW5zdGFudGlhdGlvblNlcnZpY2UpID0+IHtcblxuXHRcdFx0XHRjb25zdCBzdGlja3lTY3JvbGxDb250cm9sbGVyOiBTdGlja3lTY3JvbGxDb250cm9sbGVyID0gZWRpdG9yLnJlZ2lzdGVyQW5kSW5zdGFudGlhdGVDb250cmlidXRpb24oU3RpY2t5U2Nyb2xsQ29udHJvbGxlci5JRCwgU3RpY2t5U2Nyb2xsQ29udHJvbGxlcik7XG5cdFx0XHRcdGF3YWl0IHN0aWNreVNjcm9sbENvbnRyb2xsZXIuc3RpY2t5U2Nyb2xsQ2FuZGlkYXRlUHJvdmlkZXIudXBkYXRlKCk7XG5cdFx0XHRcdGNvbnN0IGxpbmVIZWlnaHQgPSBlZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5saW5lSGVpZ2h0KTtcblxuXHRcdFx0XHRjb25zdCBsYW5ndWFnZVNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlKTtcblx0XHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlU2VydmljZS5kb2N1bWVudFN5bWJvbFByb3ZpZGVyLnJlZ2lzdGVyKCcqJywgZG9jdW1lbnRTeW1ib2xQcm92aWRlckZvclNlY29uZFRlc3RNb2RlbCgpKSk7XG5cdFx0XHRcdGF3YWl0IHN0aWNreVNjcm9sbENvbnRyb2xsZXIuc3RpY2t5U2Nyb2xsQ2FuZGlkYXRlUHJvdmlkZXIudXBkYXRlKCk7XG5cdFx0XHRcdGxldCBzdGF0ZTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2Nyb2xsVG9wKDEpO1xuXHRcdFx0XHRzdGF0ZSA9IHN0aWNreVNjcm9sbENvbnRyb2xsZXIuZmluZFNjcm9sbFdpZGdldFN0YXRlKCk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc3RhdGUuc3RhcnRMaW5lTnVtYmVycywgWzEsIDJdKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2Nyb2xsVG9wKGxpbmVIZWlnaHQgKyAxKTtcblx0XHRcdFx0c3RhdGUgPSBzdGlja3lTY3JvbGxDb250cm9sbGVyLmZpbmRTY3JvbGxXaWRnZXRTdGF0ZSgpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHN0YXRlLnN0YXJ0TGluZU51bWJlcnMsIFsxLCAyXSk7XG5cblx0XHRcdFx0ZWRpdG9yLnNldFNjcm9sbFRvcCgyICogbGluZUhlaWdodCArIDEpO1xuXHRcdFx0XHRzdGF0ZSA9IHN0aWNreVNjcm9sbENvbnRyb2xsZXIuZmluZFNjcm9sbFdpZGdldFN0YXRlKCk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc3RhdGUuc3RhcnRMaW5lTnVtYmVycywgWzFdKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2Nyb2xsVG9wKDMgKiBsaW5lSGVpZ2h0ICsgMSk7XG5cdFx0XHRcdHN0YXRlID0gc3RpY2t5U2Nyb2xsQ29udHJvbGxlci5maW5kU2Nyb2xsV2lkZ2V0U3RhdGUoKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzdGF0ZS5zdGFydExpbmVOdW1iZXJzLCBbMV0pO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTY3JvbGxUb3AoNCAqIGxpbmVIZWlnaHQgKyAxKTtcblx0XHRcdFx0c3RhdGUgPSBzdGlja3lTY3JvbGxDb250cm9sbGVyLmZpbmRTY3JvbGxXaWRnZXRTdGF0ZSgpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHN0YXRlLnN0YXJ0TGluZU51bWJlcnMsIFtdKTtcblxuXHRcdFx0XHRzdGlja3lTY3JvbGxDb250cm9sbGVyLmRpc3Bvc2UoKTtcblx0XHRcdFx0c3RpY2t5U2Nyb2xsQ29udHJvbGxlci5zdGlja3lTY3JvbGxDYW5kaWRhdGVQcm92aWRlci5kaXNwb3NlKCk7XG5cdFx0XHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBSUEsT0FBTyxZQUFZO0FBQ25CLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsK0JBQStCO0FBQ3hDLFNBQXlCLGtCQUFrQjtBQUMzQyxTQUFTLHFCQUFxQixtQ0FBbUM7QUFDakUsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxhQUFhLHNCQUFzQjtBQUM1QyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLFlBQVk7QUFDckIsU0FBUyxxQ0FBcUM7QUFDOUMsU0FBUyxpQ0FBaUMsc0NBQXNDO0FBQ2hGLFNBQVMsd0NBQXdDO0FBQ2pELFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsdUJBQXVCO0FBRWhDLE1BQU0sdUJBQXVCLE1BQU07QUFFbEMsUUFBTSxjQUFjLElBQUksZ0JBQWdCO0FBRXhDLFFBQU0sb0JBQW9CLElBQUk7QUFBQSxJQUM3QixDQUFDLDBCQUEwQixJQUFJLHdCQUF3QixDQUFDO0FBQUEsSUFDeEQsQ0FBQyxhQUFh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
