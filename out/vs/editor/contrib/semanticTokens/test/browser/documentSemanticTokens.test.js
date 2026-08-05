import assert from "assert";
import { Barrier, timeout } from "../../../../../base/common/async.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { mock } from "../../../../../base/test/common/mock.js";
import { runWithFakedTimers } from "../../../../../base/test/common/timeTravelScheduler.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { Range } from "../../../../common/core/range.js";
import { ILanguageService } from "../../../../common/languages/language.js";
import { ILanguageConfigurationService } from "../../../../common/languages/languageConfigurationRegistry.js";
import { LanguageFeatureDebounceService } from "../../../../common/services/languageFeatureDebounce.js";
import { LanguageFeaturesService } from "../../../../common/services/languageFeaturesService.js";
import { LanguageService } from "../../../../common/services/languageService.js";
import { ModelService } from "../../../../common/services/modelService.js";
import { SemanticTokensStylingService } from "../../../../common/services/semanticTokensStylingService.js";
import { DocumentSemanticTokensFeature } from "../../browser/documentSemanticTokens.js";
import { getDocumentSemanticTokens, isSemanticTokens } from "../../common/getSemanticTokens.js";
import { TestLanguageConfigurationService } from "../../../../test/common/modes/testLanguageConfigurationService.js";
import { TestTextResourcePropertiesService } from "../../../../test/common/services/testTextResourcePropertiesService.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { TestDialogService } from "../../../../../platform/dialogs/test/common/testDialogService.js";
import { TestInstantiationService } from "../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { NullLogService } from "../../../../../platform/log/common/log.js";
import { TestNotificationService } from "../../../../../platform/notification/test/common/testNotificationService.js";
import { ColorScheme } from "../../../../../platform/theme/common/theme.js";
import { TestColorTheme, TestThemeService } from "../../../../../platform/theme/test/common/testThemeService.js";
import { UndoRedoService } from "../../../../../platform/undoRedo/common/undoRedoService.js";
suite("ModelSemanticColoring", () => {
  const disposables = new DisposableStore();
  let modelService;
  let languageService;
  let languageFeaturesService;
  setup(() => {
    const configService = new TestConfigurationService({ editor: { semanticHighlighting: true } });
    const themeService = new TestThemeService();
    themeService.setTheme(new TestColorTheme({}, ColorScheme.DARK, true));
    const logService = new NullLogService();
    languageFeaturesService = new LanguageFeaturesService();
    languageService = disposables.add(new LanguageService(false));
    const semanticTokensStylingService = disposables.add(new SemanticTokensStylingService(themeService, logService, languageService));
    const instantiationService = new TestInstantiationService();
    instantiationService.set(ILanguageService, languageService);
    instantiationService.set(ILanguageConfigurationService, new TestLanguageConfigurationService());
    modelService = disposables.add(new ModelService(
      configService,
      new TestTextResourcePropertiesService(configService),
      new UndoRedoService(new TestDialogService(), new TestNotificationService()),
      instantiationService
    ));
    const envService = new class extends mock() {
      constructor() {
        super(...arguments);
        this.isBuilt = true;
        this.isExtensionDevelopment = false;
      }
    }();
    disposables.add(new DocumentSemanticTokensFeature(semanticTokensStylingService, modelService, themeService, configService, new LanguageFeatureDebounceService(logService, envService), languageFeaturesService));
  });
  teardown(() => {
    disposables.clear();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("DocumentSemanticTokens should be fetched when the result is empty if there are pending changes", async () => {
    await runWithFakedTimers({}, async () => {
      disposables.add(languageService.registerLanguage({ id: "testMode" }));
      const inFirstCall = new Barrier();
      const delayFirstResult = new Barrier();
      const secondResultProvided = new Barrier();
      let callCount = 0;
      disposables.add(languageFeaturesService.documentSemanticTokensProvider.register("testMode", new class {
        getLegend() {
          return { tokenTypes: ["class"], tokenModifiers: [] };
        }
        async provideDocumentSemanticTokens(model, lastResultId, token) {
          callCount++;
          if (callCount === 1) {
            assert.ok("called once");
            inFirstCall.open();
            await delayFirstResult.wait();
            await timeout(0);
            return null;
          }
          if (callCount === 2) {
            assert.ok("called twice");
            secondResultProvided.open();
            return null;
          }
          assert.fail("Unexpected call");
        }
        releaseDocumentSemanticTokens(resultId) {
        }
      }()));
      const textModel = disposables.add(modelService.createModel("Hello world", languageService.createById("testMode")));
      textModel.onBeforeAttached();
      await inFirstCall.wait();
      textModel.applyEdits([{ range: new Range(1, 1, 1, 1), text: "x" }]);
      delayFirstResult.open();
      await secondResultProvided.wait();
      assert.strictEqual(callCount, 2);
    });
  });
  test("issue #149412: VS Code hangs when bad semantic token data is received", async () => {
    await runWithFakedTimers({}, async () => {
      disposables.add(languageService.registerLanguage({ id: "testMode" }));
      let lastResult = null;
      disposables.add(languageFeaturesService.documentSemanticTokensProvider.register("testMode", new class {
        getLegend() {
          return { tokenTypes: ["class"], tokenModifiers: [] };
        }
        async provideDocumentSemanticTokens(model, lastResultId, token) {
          if (!lastResultId) {
            lastResult = {
              resultId: "1",
              data: new Uint32Array([4294967293, 0, 7, 16, 0, 1, 4, 3, 11, 1])
            };
          } else {
            lastResult = {
              resultId: "2",
              edits: [{
                start: 4294967276,
                deleteCount: 0,
                data: new Uint32Array([2, 0, 3, 11, 0])
              }]
            };
          }
          return lastResult;
        }
        releaseDocumentSemanticTokens(resultId) {
        }
      }()));
      const textModel = disposables.add(modelService.createModel("", languageService.createById("testMode")));
      textModel.onBeforeAttached();
      await Event.toPromise(textModel.onDidChangeTokens);
      assert.strictEqual(lastResult.resultId, "1");
      textModel.applyEdits([{ range: new Range(1, 1, 1, 1), text: "foo" }]);
      await Event.toPromise(textModel.onDidChangeTokens);
      assert.strictEqual(lastResult.resultId, "2");
    });
  });
  test("issue #161573: onDidChangeSemanticTokens doesn't consistently trigger provideDocumentSemanticTokens", async () => {
    await runWithFakedTimers({}, async () => {
      disposables.add(languageService.registerLanguage({ id: "testMode" }));
      const emitter = new Emitter();
      let requestCount = 0;
      disposables.add(languageFeaturesService.documentSemanticTokensProvider.register("testMode", new class {
        constructor() {
          this.onDidChange = emitter.event;
        }
        getLegend() {
          return { tokenTypes: ["class"], tokenModifiers: [] };
        }
        async provideDocumentSemanticTokens(model, lastResultId, token) {
          requestCount++;
          if (requestCount === 1) {
            await timeout(1e3);
            emitter.fire();
            await timeout(1e3);
            return null;
          }
          return null;
        }
        releaseDocumentSemanticTokens(resultId) {
        }
      }()));
      const textModel = disposables.add(modelService.createModel("", languageService.createById("testMode")));
      textModel.onBeforeAttached();
      await timeout(5e3);
      assert.deepStrictEqual(requestCount, 2);
    });
  });
  test("DocumentSemanticTokens should be pick the token provider with actual items", async () => {
    await runWithFakedTimers({}, async () => {
      let callCount = 0;
      disposables.add(languageService.registerLanguage({ id: "testMode2" }));
      disposables.add(languageFeaturesService.documentSemanticTokensProvider.register("testMode2", new class {
        getLegend() {
          return { tokenTypes: ["class1"], tokenModifiers: [] };
        }
        async provideDocumentSemanticTokens(model, lastResultId, token) {
          callCount++;
          if (lastResultId) {
            return {
              data: new Uint32Array([2, 1, 1, 1, 1, 0, 2, 1, 1, 1])
            };
          }
          return {
            resultId: "1",
            data: new Uint32Array([0, 1, 1, 1, 1, 0, 2, 1, 1, 1])
          };
        }
        releaseDocumentSemanticTokens(resultId) {
        }
      }()));
      disposables.add(languageFeaturesService.documentSemanticTokensProvider.register("testMode2", new class {
        getLegend() {
          return { tokenTypes: ["class2"], tokenModifiers: [] };
        }
        async provideDocumentSemanticTokens(model, lastResultId, token) {
          callCount++;
          return null;
        }
        releaseDocumentSemanticTokens(resultId) {
        }
      }()));
      function toArr(arr) {
        const result = [];
        for (let i = 0; i < arr.length; i++) {
          result[i] = arr[i];
        }
        return result;
      }
      const textModel = modelService.createModel("Hello world 2", languageService.createById("testMode2"));
      try {
        let result = await getDocumentSemanticTokens(languageFeaturesService.documentSemanticTokensProvider, textModel, null, null, CancellationToken.None);
        assert.ok(result, `We should have tokens (1)`);
        assert.ok(result.tokens, `Tokens are found from multiple providers (1)`);
        assert.ok(isSemanticTokens(result.tokens), `Tokens are full (1)`);
        assert.ok(result.tokens.resultId, `Token result id found from multiple providers (1)`);
        assert.deepStrictEqual(toArr(result.tokens.data), [0, 1, 1, 1, 1, 0, 2, 1, 1, 1], `Token data returned for multiple providers (1)`);
        assert.deepStrictEqual(callCount, 2, `Called both token providers (1)`);
        assert.deepStrictEqual(result.provider.getLegend(), { tokenTypes: ["class1"], tokenModifiers: [] }, `Legend matches the tokens (1)`);
        result = await getDocumentSemanticTokens(languageFeaturesService.documentSemanticTokensProvider, textModel, result.provider, result.tokens.resultId, CancellationToken.None);
        assert.ok(result, `We should have tokens (2)`);
        assert.ok(result.tokens, `Tokens are found from multiple providers (2)`);
        assert.ok(isSemanticTokens(result.tokens), `Tokens are full (2)`);
        assert.ok(!result.tokens.resultId, `Token result id found from multiple providers (2)`);
        assert.deepStrictEqual(toArr(result.tokens.data), [2, 1, 1, 1, 1, 0, 2, 1, 1, 1], `Token data returned for multiple providers (2)`);
        assert.deepStrictEqual(callCount, 4, `Called both token providers (2)`);
        assert.deepStrictEqual(result.provider.getLegend(), { tokenTypes: ["class1"], tokenModifiers: [] }, `Legend matches the tokens (2)`);
      } finally {
        disposables.clear();
        await timeout(0);
        textModel.dispose();
      }
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9zZW1hbnRpY1Rva2Vucy90ZXN0L2Jyb3dzZXIvZG9jdW1lbnRTZW1hbnRpY1Rva2Vucy50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgQmFycmllciwgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IG1vY2sgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL21vY2suanMnO1xuaW1wb3J0IHsgcnVuV2l0aEZha2VkVGltZXJzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi90aW1lVHJhdmVsU2NoZWR1bGVyLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBEb2N1bWVudFNlbWFudGljVG9rZW5zUHJvdmlkZXIsIFNlbWFudGljVG9rZW5zLCBTZW1hbnRpY1Rva2Vuc0VkaXRzLCBTZW1hbnRpY1Rva2Vuc0xlZ2VuZCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlQ29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgTGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZURlYm91bmNlLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZUZlYXR1cmVzLmpzJztcbmltcG9ydCB7IExhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IExhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy9tb2RlbC5qcyc7XG5pbXBvcnQgeyBNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vc2VydmljZXMvbW9kZWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFNlbWFudGljVG9rZW5zU3R5bGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vc2VydmljZXMvc2VtYW50aWNUb2tlbnNTdHlsaW5nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBEb2N1bWVudFNlbWFudGljVG9rZW5zRmVhdHVyZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvZG9jdW1lbnRTZW1hbnRpY1Rva2Vucy5qcyc7XG5pbXBvcnQgeyBnZXREb2N1bWVudFNlbWFudGljVG9rZW5zLCBpc1NlbWFudGljVG9rZW5zIH0gZnJvbSAnLi4vLi4vY29tbW9uL2dldFNlbWFudGljVG9rZW5zLmpzJztcbmltcG9ydCB7IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9jb21tb24vbW9kZXMvdGVzdExhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGVzdFRleHRSZXNvdXJjZVByb3BlcnRpZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9jb21tb24vc2VydmljZXMvdGVzdFRleHRSZXNvdXJjZVByb3BlcnRpZXNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vdGVzdC9jb21tb24vdGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IFRlc3REaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy90ZXN0L2NvbW1vbi90ZXN0RGlhbG9nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50LmpzJztcbmltcG9ydCB7IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vdGVzdC9jb21tb24vaW5zdGFudGlhdGlvblNlcnZpY2VNb2NrLmpzJztcbmltcG9ydCB7IE51bGxMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgVGVzdE5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vdGVzdC9jb21tb24vdGVzdE5vdGlmaWNhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ29sb3JTY2hlbWUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWUuanMnO1xuaW1wb3J0IHsgVGVzdENvbG9yVGhlbWUsIFRlc3RUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS90ZXN0L2NvbW1vbi90ZXN0VGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFVuZG9SZWRvU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VuZG9SZWRvL2NvbW1vbi91bmRvUmVkb1NlcnZpY2UuanMnO1xuXG5zdWl0ZSgnTW9kZWxTZW1hbnRpY0NvbG9yaW5nJywgKCkgPT4ge1xuXG5cdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRsZXQgbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlO1xuXHRsZXQgbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlO1xuXHRsZXQgbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2U6IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZTtcblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0Y29uc3QgY29uZmlnU2VydmljZSA9IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoeyBlZGl0b3I6IHsgc2VtYW50aWNIaWdobGlnaHRpbmc6IHRydWUgfSB9KTtcblx0XHRjb25zdCB0aGVtZVNlcnZpY2UgPSBuZXcgVGVzdFRoZW1lU2VydmljZSgpO1xuXHRcdHRoZW1lU2VydmljZS5zZXRUaGVtZShuZXcgVGVzdENvbG9yVGhlbWUoe30sIENvbG9yU2NoZW1lLkRBUkssIHRydWUpKTtcblx0XHRjb25zdCBsb2dTZXJ2aWNlID0gbmV3IE51bGxMb2dTZXJ2aWNlKCk7XG5cdFx0bGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgPSBuZXcgTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UoKTtcblx0XHRsYW5ndWFnZVNlcnZpY2UgPSBkaXNwb3NhYmxlcy5hZGQobmV3IExhbmd1YWdlU2VydmljZShmYWxzZSkpO1xuXHRcdGNvbnN0IHNlbWFudGljVG9rZW5zU3R5bGluZ1NlcnZpY2UgPSBkaXNwb3NhYmxlcy5hZGQobmV3IFNlbWFudGljVG9rZW5zU3R5bGluZ1NlcnZpY2UodGhlbWVTZXJ2aWNlLCBsb2dTZXJ2aWNlLCBsYW5ndWFnZVNlcnZpY2UpKTtcblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IG5ldyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UoKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zZXQoSUxhbmd1YWdlU2VydmljZSwgbGFuZ3VhZ2VTZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zZXQoSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UsIG5ldyBUZXN0TGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSgpKTtcblx0XHRtb2RlbFNlcnZpY2UgPSBkaXNwb3NhYmxlcy5hZGQobmV3IE1vZGVsU2VydmljZShcblx0XHRcdGNvbmZpZ1NlcnZpY2UsXG5cdFx0XHRuZXcgVGVzdFRleHRSZXNvdXJjZVByb3BlcnRpZXNTZXJ2aWNlKGNvbmZpZ1NlcnZpY2UpLFxuXHRcdFx0bmV3IFVuZG9SZWRvU2VydmljZShuZXcgVGVzdERpYWxvZ1NlcnZpY2UoKSwgbmV3IFRlc3ROb3RpZmljYXRpb25TZXJ2aWNlKCkpLFxuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Vcblx0XHQpKTtcblx0XHRjb25zdCBlbnZTZXJ2aWNlID0gbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJRW52aXJvbm1lbnRTZXJ2aWNlPigpIHtcblx0XHRcdG92ZXJyaWRlIGlzQnVpbHQ6IGJvb2xlYW4gPSB0cnVlO1xuXHRcdFx0b3ZlcnJpZGUgaXNFeHRlbnNpb25EZXZlbG9wbWVudDogYm9vbGVhbiA9IGZhbHNlO1xuXHRcdH07XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG5ldyBEb2N1bWVudFNlbWFudGljVG9rZW5zRmVhdHVyZShzZW1hbnRpY1Rva2Vuc1N0eWxpbmdTZXJ2aWNlLCBtb2RlbFNlcnZpY2UsIHRoZW1lU2VydmljZSwgY29uZmlnU2VydmljZSwgbmV3IExhbmd1YWdlRmVhdHVyZURlYm91bmNlU2VydmljZShsb2dTZXJ2aWNlLCBlbnZTZXJ2aWNlKSwgbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UpKTtcblx0fSk7XG5cblx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdH0pO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ0RvY3VtZW50U2VtYW50aWNUb2tlbnMgc2hvdWxkIGJlIGZldGNoZWQgd2hlbiB0aGUgcmVzdWx0IGlzIGVtcHR5IGlmIHRoZXJlIGFyZSBwZW5kaW5nIGNoYW5nZXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzKHt9LCBhc3luYyAoKSA9PiB7XG5cblx0XHRcdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnZVNlcnZpY2UucmVnaXN0ZXJMYW5ndWFnZSh7IGlkOiAndGVzdE1vZGUnIH0pKTtcblxuXHRcdFx0Y29uc3QgaW5GaXJzdENhbGwgPSBuZXcgQmFycmllcigpO1xuXHRcdFx0Y29uc3QgZGVsYXlGaXJzdFJlc3VsdCA9IG5ldyBCYXJyaWVyKCk7XG5cdFx0XHRjb25zdCBzZWNvbmRSZXN1bHRQcm92aWRlZCA9IG5ldyBCYXJyaWVyKCk7XG5cdFx0XHRsZXQgY2FsbENvdW50ID0gMDtcblxuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmRvY3VtZW50U2VtYW50aWNUb2tlbnNQcm92aWRlci5yZWdpc3RlcigndGVzdE1vZGUnLCBuZXcgY2xhc3MgaW1wbGVtZW50cyBEb2N1bWVudFNlbWFudGljVG9rZW5zUHJvdmlkZXIge1xuXHRcdFx0XHRnZXRMZWdlbmQoKTogU2VtYW50aWNUb2tlbnNMZWdlbmQge1xuXHRcdFx0XHRcdHJldHVybiB7IHRva2VuVHlwZXM6IFsnY2xhc3MnXSwgdG9rZW5Nb2RpZmllcnM6IFtdIH07XG5cdFx0XHRcdH1cblx0XHRcdFx0YXN5bmMgcHJvdmlkZURvY3VtZW50U2VtYW50aWNUb2tlbnMobW9kZWw6IElUZXh0TW9kZWwsIGxhc3RSZXN1bHRJZDogc3RyaW5nIHwgbnVsbCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxTZW1hbnRpY1Rva2VucyB8IFNlbWFudGljVG9rZW5zRWRpdHMgfCBudWxsPiB7XG5cdFx0XHRcdFx0Y2FsbENvdW50Kys7XG5cdFx0XHRcdFx0aWYgKGNhbGxDb3VudCA9PT0gMSkge1xuXHRcdFx0XHRcdFx0YXNzZXJ0Lm9rKCdjYWxsZWQgb25jZScpO1xuXHRcdFx0XHRcdFx0aW5GaXJzdENhbGwub3BlbigpO1xuXHRcdFx0XHRcdFx0YXdhaXQgZGVsYXlGaXJzdFJlc3VsdC53YWl0KCk7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aW1lb3V0KDApOyAvLyB3YWl0IGZvciB0aGUgc2ltcGxlIHNjaGVkdWxlciB0byBmaXJlIHRvIGNoZWNrIHRoYXQgd2UgZG8gYWN0dWFsbHkgZ2V0IHJlc2NoZWR1bGVkXG5cdFx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGNhbGxDb3VudCA9PT0gMikge1xuXHRcdFx0XHRcdFx0YXNzZXJ0Lm9rKCdjYWxsZWQgdHdpY2UnKTtcblx0XHRcdFx0XHRcdHNlY29uZFJlc3VsdFByb3ZpZGVkLm9wZW4oKTtcblx0XHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRhc3NlcnQuZmFpbCgnVW5leHBlY3RlZCBjYWxsJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVsZWFzZURvY3VtZW50U2VtYW50aWNUb2tlbnMocmVzdWx0SWQ6IHN0cmluZyB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cblx0XHRcdGNvbnN0IHRleHRNb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChtb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWwoJ0hlbGxvIHdvcmxkJywgbGFuZ3VhZ2VTZXJ2aWNlLmNyZWF0ZUJ5SWQoJ3Rlc3RNb2RlJykpKTtcblx0XHRcdC8vIHByZXRlbmQgdGhlIHRleHQgbW9kZWwgaXMgYXR0YWNoZWQgdG8gYW4gZWRpdG9yIChzbyB0aGF0IHNlbWFudGljIHRva2VucyBhcmUgY29tcHV0ZWQpXG5cdFx0XHR0ZXh0TW9kZWwub25CZWZvcmVBdHRhY2hlZCgpO1xuXG5cdFx0XHQvLyB3YWl0IGZvciB0aGUgcHJvdmlkZXIgdG8gYmUgY2FsbGVkXG5cdFx0XHRhd2FpdCBpbkZpcnN0Q2FsbC53YWl0KCk7XG5cblx0XHRcdC8vIHRoZSBwcm92aWRlciBpcyBub3cgaW4gdGhlIHByb3ZpZGUgY2FsbFxuXHRcdFx0Ly8gY2hhbmdlIHRoZSB0ZXh0IGJ1ZmZlciB3aGlsZSB0aGUgcHJvdmlkZXIgaXMgcnVubmluZ1xuXHRcdFx0dGV4dE1vZGVsLmFwcGx5RWRpdHMoW3sgcmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAxLCAxKSwgdGV4dDogJ3gnIH1dKTtcblxuXHRcdFx0Ly8gbGV0IHRoZSBwcm92aWRlciBmaW5pc2ggaXRzIGZpcnN0IHJlc3VsdFxuXHRcdFx0ZGVsYXlGaXJzdFJlc3VsdC5vcGVuKCk7XG5cblx0XHRcdC8vIHdlIG5lZWQgdG8gY2hlY2sgdGhhdCB0aGUgcHJvdmlkZXIgaXMgY2FsbGVkIGFnYWluLCBldmVuIGlmIGl0IHJldHVybnMgbnVsbFxuXHRcdFx0YXdhaXQgc2Vjb25kUmVzdWx0UHJvdmlkZWQud2FpdCgpO1xuXG5cdFx0XHQvLyBhc3NlcnQgdGhhdCBpdCBnb3QgY2FsbGVkIHR3aWNlXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbENvdW50LCAyKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzE0OTQxMjogVlMgQ29kZSBoYW5ncyB3aGVuIGJhZCBzZW1hbnRpYyB0b2tlbiBkYXRhIGlzIHJlY2VpdmVkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHJ1bldpdGhGYWtlZFRpbWVycyh7fSwgYXN5bmMgKCkgPT4ge1xuXG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VTZXJ2aWNlLnJlZ2lzdGVyTGFuZ3VhZ2UoeyBpZDogJ3Rlc3RNb2RlJyB9KSk7XG5cblx0XHRcdGxldCBsYXN0UmVzdWx0OiBTZW1hbnRpY1Rva2VucyB8IFNlbWFudGljVG9rZW5zRWRpdHMgfCBudWxsID0gbnVsbDtcblxuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmRvY3VtZW50U2VtYW50aWNUb2tlbnNQcm92aWRlci5yZWdpc3RlcigndGVzdE1vZGUnLCBuZXcgY2xhc3MgaW1wbGVtZW50cyBEb2N1bWVudFNlbWFudGljVG9rZW5zUHJvdmlkZXIge1xuXHRcdFx0XHRnZXRMZWdlbmQoKTogU2VtYW50aWNUb2tlbnNMZWdlbmQge1xuXHRcdFx0XHRcdHJldHVybiB7IHRva2VuVHlwZXM6IFsnY2xhc3MnXSwgdG9rZW5Nb2RpZmllcnM6IFtdIH07XG5cdFx0XHRcdH1cblx0XHRcdFx0YXN5bmMgcHJvdmlkZURvY3VtZW50U2VtYW50aWNUb2tlbnMobW9kZWw6IElUZXh0TW9kZWwsIGxhc3RSZXN1bHRJZDogc3RyaW5nIHwgbnVsbCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxTZW1hbnRpY1Rva2VucyB8IFNlbWFudGljVG9rZW5zRWRpdHMgfCBudWxsPiB7XG5cdFx0XHRcdFx0aWYgKCFsYXN0UmVzdWx0SWQpIHtcblx0XHRcdFx0XHRcdC8vIHRoaXMgaXMgdGhlIGZpcnN0IGNhbGxcblx0XHRcdFx0XHRcdGxhc3RSZXN1bHQgPSB7XG5cdFx0XHRcdFx0XHRcdHJlc3VsdElkOiAnMScsXG5cdFx0XHRcdFx0XHRcdGRhdGE6IG5ldyBVaW50MzJBcnJheShbNDI5NDk2NzI5MywgMCwgNywgMTYsIDAsIDEsIDQsIDMsIDExLCAxXSlcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdC8vIHRoaXMgaXMgdGhlIHNlY29uZCBjYWxsXG5cdFx0XHRcdFx0XHRsYXN0UmVzdWx0ID0ge1xuXHRcdFx0XHRcdFx0XHRyZXN1bHRJZDogJzInLFxuXHRcdFx0XHRcdFx0XHRlZGl0czogW3tcblx0XHRcdFx0XHRcdFx0XHRzdGFydDogNDI5NDk2NzI3Nixcblx0XHRcdFx0XHRcdFx0XHRkZWxldGVDb3VudDogMCxcblx0XHRcdFx0XHRcdFx0XHRkYXRhOiBuZXcgVWludDMyQXJyYXkoWzIsIDAsIDMsIDExLCAwXSlcblx0XHRcdFx0XHRcdFx0fV1cblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBsYXN0UmVzdWx0O1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJlbGVhc2VEb2N1bWVudFNlbWFudGljVG9rZW5zKHJlc3VsdElkOiBzdHJpbmcgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXG5cdFx0XHRjb25zdCB0ZXh0TW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQobW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsKCcnLCBsYW5ndWFnZVNlcnZpY2UuY3JlYXRlQnlJZCgndGVzdE1vZGUnKSkpO1xuXHRcdFx0Ly8gcHJldGVuZCB0aGUgdGV4dCBtb2RlbCBpcyBhdHRhY2hlZCB0byBhbiBlZGl0b3IgKHNvIHRoYXQgc2VtYW50aWMgdG9rZW5zIGFyZSBjb21wdXRlZClcblx0XHRcdHRleHRNb2RlbC5vbkJlZm9yZUF0dGFjaGVkKCk7XG5cblx0XHRcdC8vIHdhaXQgZm9yIHRoZSBzZW1hbnRpYyB0b2tlbnMgdG8gYmUgZmV0Y2hlZFxuXHRcdFx0YXdhaXQgRXZlbnQudG9Qcm9taXNlKHRleHRNb2RlbC5vbkRpZENoYW5nZVRva2Vucyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFzdFJlc3VsdCEucmVzdWx0SWQsICcxJyk7XG5cblx0XHRcdC8vIGVkaXQgdGhlIHRleHRcblx0XHRcdHRleHRNb2RlbC5hcHBseUVkaXRzKFt7IHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgMSwgMSksIHRleHQ6ICdmb28nIH1dKTtcblxuXHRcdFx0Ly8gd2FpdCBmb3IgdGhlIHNlbWFudGljIHRva2VucyB0byBiZSBmZXRjaGVkIGFnYWluXG5cdFx0XHRhd2FpdCBFdmVudC50b1Byb21pc2UodGV4dE1vZGVsLm9uRGlkQ2hhbmdlVG9rZW5zKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYXN0UmVzdWx0IS5yZXN1bHRJZCwgJzInKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzE2MTU3Mzogb25EaWRDaGFuZ2VTZW1hbnRpY1Rva2VucyBkb2VzblxcJ3QgY29uc2lzdGVudGx5IHRyaWdnZXIgcHJvdmlkZURvY3VtZW50U2VtYW50aWNUb2tlbnMnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzKHt9LCBhc3luYyAoKSA9PiB7XG5cblx0XHRcdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnZVNlcnZpY2UucmVnaXN0ZXJMYW5ndWFnZSh7IGlkOiAndGVzdE1vZGUnIH0pKTtcblxuXHRcdFx0Y29uc3QgZW1pdHRlciA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdFx0XHRsZXQgcmVxdWVzdENvdW50ID0gMDtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kb2N1bWVudFNlbWFudGljVG9rZW5zUHJvdmlkZXIucmVnaXN0ZXIoJ3Rlc3RNb2RlJywgbmV3IGNsYXNzIGltcGxlbWVudHMgRG9jdW1lbnRTZW1hbnRpY1Rva2Vuc1Byb3ZpZGVyIHtcblx0XHRcdFx0b25EaWRDaGFuZ2UgPSBlbWl0dGVyLmV2ZW50O1xuXHRcdFx0XHRnZXRMZWdlbmQoKTogU2VtYW50aWNUb2tlbnNMZWdlbmQge1xuXHRcdFx0XHRcdHJldHVybiB7IHRva2VuVHlwZXM6IFsnY2xhc3MnXSwgdG9rZW5Nb2RpZmllcnM6IFtdIH07XG5cdFx0XHRcdH1cblx0XHRcdFx0YXN5bmMgcHJvdmlkZURvY3VtZW50U2VtYW50aWNUb2tlbnMobW9kZWw6IElUZXh0TW9kZWwsIGxhc3RSZXN1bHRJZDogc3RyaW5nIHwgbnVsbCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxTZW1hbnRpY1Rva2VucyB8IFNlbWFudGljVG9rZW5zRWRpdHMgfCBudWxsPiB7XG5cdFx0XHRcdFx0cmVxdWVzdENvdW50Kys7XG5cdFx0XHRcdFx0aWYgKHJlcXVlc3RDb3VudCA9PT0gMSkge1xuXHRcdFx0XHRcdFx0YXdhaXQgdGltZW91dCgxMDAwKTtcblx0XHRcdFx0XHRcdC8vIHNlbmQgYSBjaGFuZ2UgZXZlbnRcblx0XHRcdFx0XHRcdGVtaXR0ZXIuZmlyZSgpO1xuXHRcdFx0XHRcdFx0YXdhaXQgdGltZW91dCgxMDAwKTtcblx0XHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZWxlYXNlRG9jdW1lbnRTZW1hbnRpY1Rva2VucyhyZXN1bHRJZDogc3RyaW5nIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblxuXHRcdFx0Y29uc3QgdGV4dE1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKG1vZGVsU2VydmljZS5jcmVhdGVNb2RlbCgnJywgbGFuZ3VhZ2VTZXJ2aWNlLmNyZWF0ZUJ5SWQoJ3Rlc3RNb2RlJykpKTtcblx0XHRcdC8vIHByZXRlbmQgdGhlIHRleHQgbW9kZWwgaXMgYXR0YWNoZWQgdG8gYW4gZWRpdG9yIChzbyB0aGF0IHNlbWFudGljIHRva2VucyBhcmUgY29tcHV0ZWQpXG5cdFx0XHR0ZXh0TW9kZWwub25CZWZvcmVBdHRhY2hlZCgpO1xuXG5cdFx0XHRhd2FpdCB0aW1lb3V0KDUwMDApO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXF1ZXN0Q291bnQsIDIpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdEb2N1bWVudFNlbWFudGljVG9rZW5zIHNob3VsZCBiZSBwaWNrIHRoZSB0b2tlbiBwcm92aWRlciB3aXRoIGFjdHVhbCBpdGVtcycsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnMoe30sIGFzeW5jICgpID0+IHtcblxuXHRcdFx0bGV0IGNhbGxDb3VudCA9IDA7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VTZXJ2aWNlLnJlZ2lzdGVyTGFuZ3VhZ2UoeyBpZDogJ3Rlc3RNb2RlMicgfSkpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmRvY3VtZW50U2VtYW50aWNUb2tlbnNQcm92aWRlci5yZWdpc3RlcigndGVzdE1vZGUyJywgbmV3IGNsYXNzIGltcGxlbWVudHMgRG9jdW1lbnRTZW1hbnRpY1Rva2Vuc1Byb3ZpZGVyIHtcblx0XHRcdFx0Z2V0TGVnZW5kKCk6IFNlbWFudGljVG9rZW5zTGVnZW5kIHtcblx0XHRcdFx0XHRyZXR1cm4geyB0b2tlblR5cGVzOiBbJ2NsYXNzMSddLCB0b2tlbk1vZGlmaWVyczogW10gfTtcblx0XHRcdFx0fVxuXHRcdFx0XHRhc3luYyBwcm92aWRlRG9jdW1lbnRTZW1hbnRpY1Rva2Vucyhtb2RlbDogSVRleHRNb2RlbCwgbGFzdFJlc3VsdElkOiBzdHJpbmcgfCBudWxsLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPFNlbWFudGljVG9rZW5zIHwgU2VtYW50aWNUb2tlbnNFZGl0cyB8IG51bGw+IHtcblx0XHRcdFx0XHRjYWxsQ291bnQrKztcblx0XHRcdFx0XHQvLyBGb3IgYSBzZWNvbmRhcnkgcmVxdWVzdCByZXR1cm4gYSBkaWZmZXJlbnQgdmFsdWVcblx0XHRcdFx0XHRpZiAobGFzdFJlc3VsdElkKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0XHRkYXRhOiBuZXcgVWludDMyQXJyYXkoWzIsIDEsIDEsIDEsIDEsIDAsIDIsIDEsIDEsIDFdKVxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdHJlc3VsdElkOiAnMScsXG5cdFx0XHRcdFx0XHRkYXRhOiBuZXcgVWludDMyQXJyYXkoWzAsIDEsIDEsIDEsIDEsIDAsIDIsIDEsIDEsIDFdKVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVsZWFzZURvY3VtZW50U2VtYW50aWNUb2tlbnMocmVzdWx0SWQ6IHN0cmluZyB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuZG9jdW1lbnRTZW1hbnRpY1Rva2Vuc1Byb3ZpZGVyLnJlZ2lzdGVyKCd0ZXN0TW9kZTInLCBuZXcgY2xhc3MgaW1wbGVtZW50cyBEb2N1bWVudFNlbWFudGljVG9rZW5zUHJvdmlkZXIge1xuXHRcdFx0XHRnZXRMZWdlbmQoKTogU2VtYW50aWNUb2tlbnNMZWdlbmQge1xuXHRcdFx0XHRcdHJldHVybiB7IHRva2VuVHlwZXM6IFsnY2xhc3MyJ10sIHRva2VuTW9kaWZpZXJzOiBbXSB9O1xuXHRcdFx0XHR9XG5cdFx0XHRcdGFzeW5jIHByb3ZpZGVEb2N1bWVudFNlbWFudGljVG9rZW5zKG1vZGVsOiBJVGV4dE1vZGVsLCBsYXN0UmVzdWx0SWQ6IHN0cmluZyB8IG51bGwsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8U2VtYW50aWNUb2tlbnMgfCBTZW1hbnRpY1Rva2Vuc0VkaXRzIHwgbnVsbD4ge1xuXHRcdFx0XHRcdGNhbGxDb3VudCsrO1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJlbGVhc2VEb2N1bWVudFNlbWFudGljVG9rZW5zKHJlc3VsdElkOiBzdHJpbmcgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXG5cdFx0XHRmdW5jdGlvbiB0b0FycihhcnI6IFVpbnQzMkFycmF5KTogbnVtYmVyW10ge1xuXHRcdFx0XHRjb25zdCByZXN1bHQ6IG51bWJlcltdID0gW107XG5cdFx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgYXJyLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0cmVzdWx0W2ldID0gYXJyW2ldO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHRleHRNb2RlbCA9IG1vZGVsU2VydmljZS5jcmVhdGVNb2RlbCgnSGVsbG8gd29ybGQgMicsIGxhbmd1YWdlU2VydmljZS5jcmVhdGVCeUlkKCd0ZXN0TW9kZTInKSk7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRsZXQgcmVzdWx0ID0gYXdhaXQgZ2V0RG9jdW1lbnRTZW1hbnRpY1Rva2VucyhsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kb2N1bWVudFNlbWFudGljVG9rZW5zUHJvdmlkZXIsIHRleHRNb2RlbCwgbnVsbCwgbnVsbCwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRcdGFzc2VydC5vayhyZXN1bHQsIGBXZSBzaG91bGQgaGF2ZSB0b2tlbnMgKDEpYCk7XG5cdFx0XHRcdGFzc2VydC5vayhyZXN1bHQudG9rZW5zLCBgVG9rZW5zIGFyZSBmb3VuZCBmcm9tIG11bHRpcGxlIHByb3ZpZGVycyAoMSlgKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKGlzU2VtYW50aWNUb2tlbnMocmVzdWx0LnRva2VucyksIGBUb2tlbnMgYXJlIGZ1bGwgKDEpYCk7XG5cdFx0XHRcdGFzc2VydC5vayhyZXN1bHQudG9rZW5zLnJlc3VsdElkLCBgVG9rZW4gcmVzdWx0IGlkIGZvdW5kIGZyb20gbXVsdGlwbGUgcHJvdmlkZXJzICgxKWApO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRvQXJyKHJlc3VsdC50b2tlbnMuZGF0YSksIFswLCAxLCAxLCAxLCAxLCAwLCAyLCAxLCAxLCAxXSwgYFRva2VuIGRhdGEgcmV0dXJuZWQgZm9yIG11bHRpcGxlIHByb3ZpZGVycyAoMSlgKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjYWxsQ291bnQsIDIsIGBDYWxsZWQgYm90aCB0b2tlbiBwcm92aWRlcnMgKDEpYCk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0LnByb3ZpZGVyLmdldExlZ2VuZCgpLCB7IHRva2VuVHlwZXM6IFsnY2xhc3MxJ10sIHRva2VuTW9kaWZpZXJzOiBbXSB9LCBgTGVnZW5kIG1hdGNoZXMgdGhlIHRva2VucyAoMSlgKTtcblxuXHRcdFx0XHQvLyBNYWtlIGEgc2Vjb25kIHJlcXVlc3QuIE1ha2Ugc3VyZSB3ZSBnZXQgdGhlIHNlY29uZGFyeSB2YWx1ZVxuXHRcdFx0XHRyZXN1bHQgPSBhd2FpdCBnZXREb2N1bWVudFNlbWFudGljVG9rZW5zKGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmRvY3VtZW50U2VtYW50aWNUb2tlbnNQcm92aWRlciwgdGV4dE1vZGVsLCByZXN1bHQucHJvdmlkZXIsIHJlc3VsdC50b2tlbnMucmVzdWx0SWQsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdFx0XHRhc3NlcnQub2socmVzdWx0LCBgV2Ugc2hvdWxkIGhhdmUgdG9rZW5zICgyKWApO1xuXHRcdFx0XHRhc3NlcnQub2socmVzdWx0LnRva2VucywgYFRva2VucyBhcmUgZm91bmQgZnJvbSBtdWx0aXBsZSBwcm92aWRlcnMgKDIpYCk7XG5cdFx0XHRcdGFzc2VydC5vayhpc1NlbWFudGljVG9rZW5zKHJlc3VsdC50b2tlbnMpLCBgVG9rZW5zIGFyZSBmdWxsICgyKWApO1xuXHRcdFx0XHRhc3NlcnQub2soIXJlc3VsdC50b2tlbnMucmVzdWx0SWQsIGBUb2tlbiByZXN1bHQgaWQgZm91bmQgZnJvbSBtdWx0aXBsZSBwcm92aWRlcnMgKDIpYCk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodG9BcnIocmVzdWx0LnRva2Vucy5kYXRhKSwgWzIsIDEsIDEsIDEsIDEsIDAsIDIsIDEsIDEsIDFdLCBgVG9rZW4gZGF0YSByZXR1cm5lZCBmb3IgbXVsdGlwbGUgcHJvdmlkZXJzICgyKWApO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNhbGxDb3VudCwgNCwgYENhbGxlZCBib3RoIHRva2VuIHByb3ZpZGVycyAoMilgKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHQucHJvdmlkZXIuZ2V0TGVnZW5kKCksIHsgdG9rZW5UeXBlczogWydjbGFzczEnXSwgdG9rZW5Nb2RpZmllcnM6IFtdIH0sIGBMZWdlbmQgbWF0Y2hlcyB0aGUgdG9rZW5zICgyKWApO1xuXHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0ZGlzcG9zYWJsZXMuY2xlYXIoKTtcblxuXHRcdFx0XHQvLyBXYWl0IGZvciBzY2hlZHVsZXIgdG8gZmluaXNoXG5cdFx0XHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cblx0XHRcdFx0Ly8gTm93IGRpc3Bvc2UgdGhlIHRleHQgbW9kZWxcblx0XHRcdFx0dGV4dE1vZGVsLmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLFNBQVMsZUFBZTtBQUNqQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLFlBQVk7QUFDckIsU0FBUywwQkFBMEI7QUFDbkMsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyxhQUFhO0FBRXRCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMscUNBQXFDO0FBRTlDLFNBQVMsc0NBQXNDO0FBRS9DLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsdUJBQXVCO0FBRWhDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsb0NBQW9DO0FBQzdDLFNBQVMscUNBQXFDO0FBQzlDLFNBQVMsMkJBQTJCLHdCQUF3QjtBQUM1RCxTQUFTLHdDQUF3QztBQUNqRCxTQUFTLHlDQUF5QztBQUNsRCxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLHlCQUF5QjtBQUVsQyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLCtCQUErQjtBQUN4QyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGdCQUFnQix3QkFBd0I7QUFDakQsU0FBUyx1QkFBdUI7QUFFaEMsTUFBTSx5QkFBeUIsTUFBTTtBQUVwQyxRQUFNLGNBQWMsSUFBSSxnQkFBZ0I7QUFDeEMsTUFBSTtBQUNKLE1BQUk7QUFDSixNQUFJO0FBRUosUUFBTSxNQUFNO0FBQ1gsVUFBTSxnQkFBZ0IsSUFBSSx5QkFBeUIsRUFBRSxRQUFRLEVBQUUsc0JBQXNCLEtBQUss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
