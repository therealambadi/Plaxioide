import assert from "assert";
import { promiseWithResolvers } from "../../../../../base/common/async.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { URI } from "../../../../../base/common/uri.js";
import { runWithFakedTimers } from "../../../../../base/test/common/timeTravelScheduler.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { Handler } from "../../../../common/editorCommon.js";
import { LanguageFeatureRegistry } from "../../../../common/languageFeatureRegistry.js";
import * as languages from "../../../../common/languages.js";
import { ParameterHintsModel } from "../../browser/parameterHintsModel.js";
import { createTestCodeEditor } from "../../../../test/browser/testCodeEditor.js";
import { createTextModel } from "../../../../test/common/testTextModel.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { InMemoryStorageService, IStorageService } from "../../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { NullTelemetryService } from "../../../../../platform/telemetry/common/telemetryUtils.js";
const mockFile = URI.parse("test:somefile.ttt");
const mockFileSelector = { scheme: "test" };
const emptySigHelp = {
  signatures: [{
    label: "none",
    parameters: []
  }],
  activeParameter: 0,
  activeSignature: 0
};
const emptySigHelpResult = {
  value: emptySigHelp,
  dispose: () => {
  }
};
suite("ParameterHintsModel", () => {
  const disposables = new DisposableStore();
  let registry;
  setup(() => {
    disposables.clear();
    registry = new LanguageFeatureRegistry();
  });
  teardown(() => {
    disposables.clear();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  function createMockEditor(fileContents) {
    const textModel = disposables.add(createTextModel(fileContents, void 0, void 0, mockFile));
    const editor = disposables.add(createTestCodeEditor(textModel, {
      serviceCollection: new ServiceCollection(
        [ITelemetryService, NullTelemetryService],
        [IStorageService, disposables.add(new InMemoryStorageService())]
      )
    }));
    return editor;
  }
  function getNextHint(model) {
    return new Promise((resolve) => {
      const sub = disposables.add(model.onChangedHints((e) => {
        sub.dispose();
        return resolve(e ? { value: e, dispose: () => {
        } } : void 0);
      }));
    });
  }
  test("Provider should get trigger character on type", async () => {
    const { promise: donePromise, resolve: done } = promiseWithResolvers();
    const triggerChar = "(";
    const editor = createMockEditor("");
    disposables.add(new ParameterHintsModel(editor, registry));
    disposables.add(registry.register(mockFileSelector, new class {
      constructor() {
        this.signatureHelpTriggerCharacters = [triggerChar];
        this.signatureHelpRetriggerCharacters = [];
      }
      provideSignatureHelp(_model, _position, _token, context) {
        assert.strictEqual(context.triggerKind, languages.SignatureHelpTriggerKind.TriggerCharacter);
        assert.strictEqual(context.triggerCharacter, triggerChar);
        done();
        return void 0;
      }
    }()));
    await runWithFakedTimers({ useFakeTimers: true }, async () => {
      editor.trigger("keyboard", Handler.Type, { text: triggerChar });
      await donePromise;
    });
  });
  test("Provider should be retriggered if already active", async () => {
    const { promise: donePromise, resolve: done } = promiseWithResolvers();
    const triggerChar = "(";
    const editor = createMockEditor("");
    disposables.add(new ParameterHintsModel(editor, registry));
    let invokeCount = 0;
    disposables.add(registry.register(mockFileSelector, new class {
      constructor() {
        this.signatureHelpTriggerCharacters = [triggerChar];
        this.signatureHelpRetriggerCharacters = [];
      }
      provideSignatureHelp(_model, _position, _token, context) {
        ++invokeCount;
        try {
          if (invokeCount === 1) {
            assert.strictEqual(context.triggerKind, languages.SignatureHelpTriggerKind.TriggerCharacter);
            assert.strictEqual(context.triggerCharacter, triggerChar);
            assert.strictEqual(context.isRetrigger, false);
            assert.strictEqual(context.activeSignatureHelp, void 0);
            setTimeout(() => editor.trigger("keyboard", Handler.Type, { text: triggerChar }), 0);
          } else {
            assert.strictEqual(invokeCount, 2);
            assert.strictEqual(context.triggerKind, languages.SignatureHelpTriggerKind.TriggerCharacter);
            assert.strictEqual(context.isRetrigger, true);
            assert.strictEqual(context.triggerCharacter, triggerChar);
            assert.strictEqual(context.activeSignatureHelp, emptySigHelp);
            done();
          }
          return emptySigHelpResult;
        } catch (err) {
          console.error(err);
          throw err;
        }
      }
    }()));
    await runWithFakedTimers({ useFakeTimers: true }, async () => {
      editor.trigger("keyboard", Handler.Type, { text: triggerChar });
      await donePromise;
    });
  });
  test("Provider should not be retriggered if previous help is canceled first", async () => {
    const { promise: donePromise, resolve: done } = promiseWithResolvers();
    const triggerChar = "(";
    const editor = createMockEditor("");
    const hintModel = disposables.add(new ParameterHintsModel(editor, registry));
    let invokeCount = 0;
    disposables.add(registry.register(mockFileSelector, new class {
      constructor() {
        this.signatureHelpTriggerCharacters = [triggerChar];
        this.signatureHelpRetriggerCharacters = [];
      }
      provideSignatureHelp(_model, _position, _token, context) {
        try {
          ++invokeCount;
          if (invokeCount === 1) {
            assert.strictEqual(context.triggerKind, languages.SignatureHelpTriggerKind.TriggerCharacter);
            assert.strictEqual(context.triggerCharacter, triggerChar);
            assert.strictEqual(context.isRetrigger, false);
            assert.strictEqual(context.activeSignatureHelp, void 0);
            hintModel.cancel();
            editor.trigger("keyboard", Handler.Type, { text: triggerChar });
          } else {
            assert.strictEqual(invokeCount, 2);
            assert.strictEqual(context.triggerKind, languages.SignatureHelpTriggerKind.TriggerCharacter);
            assert.strictEqual(context.triggerCharacter, triggerChar);
            assert.strictEqual(context.isRetrigger, true);
            assert.strictEqual(context.activeSignatureHelp, void 0);
            done();
          }
          return emptySigHelpResult;
        } catch (err) {
          console.error(err);
          throw err;
        }
      }
    }()));
    await runWithFakedTimers({ useFakeTimers: true }, () => {
      editor.trigger("keyboard", Handler.Type, { text: triggerChar });
      return donePromise;
    });
  });
  test("Provider should get last trigger character when triggered multiple times and only be invoked once", async () => {
    const { promise: donePromise, resolve: done } = promiseWithResolvers();
    const editor = createMockEditor("");
    disposables.add(new ParameterHintsModel(editor, registry, 5));
    let invokeCount = 0;
    disposables.add(registry.register(mockFileSelector, new class {
      constructor() {
        this.signatureHelpTriggerCharacters = ["a", "b", "c"];
        this.signatureHelpRetriggerCharacters = [];
      }
      provideSignatureHelp(_model, _position, _token, context) {
        try {
          ++invokeCount;
          assert.strictEqual(context.triggerKind, languages.SignatureHelpTriggerKind.TriggerCharacter);
          assert.strictEqual(context.isRetrigger, false);
          assert.strictEqual(context.triggerCharacter, "c");
          setTimeout(() => {
            assert.strictEqual(invokeCount, 1);
            done();
          }, 50);
          return void 0;
        } catch (err) {
          console.error(err);
          throw err;
        }
      }
    }()));
    await runWithFakedTimers({ useFakeTimers: true }, async () => {
      editor.trigger("keyboard", Handler.Type, { text: "a" });
      editor.trigger("keyboard", Handler.Type, { text: "b" });
      editor.trigger("keyboard", Handler.Type, { text: "c" });
      await donePromise;
    });
  });
  test("Provider should be retriggered if already active", async () => {
    const { promise: donePromise, resolve: done } = promiseWithResolvers();
    const editor = createMockEditor("");
    disposables.add(new ParameterHintsModel(editor, registry, 5));
    let invokeCount = 0;
    disposables.add(registry.register(mockFileSelector, new class {
      constructor() {
        this.signatureHelpTriggerCharacters = ["a", "b"];
        this.signatureHelpRetriggerCharacters = [];
      }
      provideSignatureHelp(_model, _position, _token, context) {
        try {
          ++invokeCount;
          if (invokeCount === 1) {
            assert.strictEqual(context.triggerKind, languages.SignatureHelpTriggerKind.TriggerCharacter);
            assert.strictEqual(context.triggerCharacter, "a");
            setTimeout(() => editor.trigger("keyboard", Handler.Type, { text: "b" }), 50);
          } else if (invokeCount === 2) {
            assert.strictEqual(context.triggerKind, languages.SignatureHelpTriggerKind.TriggerCharacter);
            assert.ok(context.isRetrigger);
            assert.strictEqual(context.triggerCharacter, "b");
            done();
          } else {
            assert.fail("Unexpected invoke");
          }
          return emptySigHelpResult;
        } catch (err) {
          console.error(err);
          throw err;
        }
      }
    }()));
    await runWithFakedTimers({ useFakeTimers: true }, () => {
      editor.trigger("keyboard", Handler.Type, { text: "a" });
      return donePromise;
    });
  });
  test("Should cancel existing request when new request comes in", async () => {
    const editor = createMockEditor("abc def");
    const hintsModel = disposables.add(new ParameterHintsModel(editor, registry));
    let didRequestCancellationOf = -1;
    let invokeCount = 0;
    const longRunningProvider = new class {
      constructor() {
        this.signatureHelpTriggerCharacters = [];
        this.signatureHelpRetriggerCharacters = [];
      }
      provideSignatureHelp(_model, _position, token) {
        try {
          const count = invokeCount++;
          disposables.add(token.onCancellationRequested(() => {
            didRequestCancellationOf = count;
          }));
          if (count === 0) {
            hintsModel.trigger({ triggerKind: languages.SignatureHelpTriggerKind.Invoke }, 0);
          }
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                value: {
                  signatures: [{
                    label: "" + count,
                    parameters: []
                  }],
                  activeParameter: 0,
                  activeSignature: 0
                },
                dispose: () => {
                }
              });
            }, 100);
          });
        } catch (err) {
          console.error(err);
          throw err;
        }
      }
    }();
    disposables.add(registry.register(mockFileSelector, longRunningProvider));
    await runWithFakedTimers({ useFakeTimers: true }, async () => {
      hintsModel.trigger({ triggerKind: languages.SignatureHelpTriggerKind.Invoke }, 0);
      assert.strictEqual(-1, didRequestCancellationOf);
      return new Promise((resolve, reject) => disposables.add(hintsModel.onChangedHints((newParamterHints) => {
        try {
          assert.strictEqual(0, didRequestCancellationOf);
          assert.strictEqual("1", newParamterHints.signatures[0].label);
          resolve();
        } catch (e) {
          reject(e);
        }
      })));
    });
  });
  test("Provider should be retriggered by retrigger character", async () => {
    const { promise: donePromise, resolve: done } = promiseWithResolvers();
    const triggerChar = "a";
    const retriggerChar = "b";
    const editor = createMockEditor("");
    disposables.add(new ParameterHintsModel(editor, registry, 5));
    let invokeCount = 0;
    disposables.add(registry.register(mockFileSelector, new class {
      constructor() {
        this.signatureHelpTriggerCharacters = [triggerChar];
        this.signatureHelpRetriggerCharacters = [retriggerChar];
      }
      provideSignatureHelp(_model, _position, _token, context) {
        try {
          ++invokeCount;
          if (invokeCount === 1) {
            assert.strictEqual(context.triggerKind, languages.SignatureHelpTriggerKind.TriggerCharacter);
            assert.strictEqual(context.triggerCharacter, triggerChar);
            setTimeout(() => editor.trigger("keyboard", Handler.Type, { text: retriggerChar }), 50);
          } else if (invokeCount === 2) {
            assert.strictEqual(context.triggerKind, languages.SignatureHelpTriggerKind.TriggerCharacter);
            assert.ok(context.isRetrigger);
            assert.strictEqual(context.triggerCharacter, retriggerChar);
            done();
          } else {
            assert.fail("Unexpected invoke");
          }
          return emptySigHelpResult;
        } catch (err) {
          console.error(err);
          throw err;
        }
      }
    }()));
    await runWithFakedTimers({ useFakeTimers: true }, async () => {
      editor.trigger("keyboard", Handler.Type, { text: retriggerChar });
      editor.trigger("keyboard", Handler.Type, { text: triggerChar });
      return donePromise;
    });
  });
  test("should use first result from multiple providers", async () => {
    const triggerChar = "a";
    const firstProviderId = "firstProvider";
    const secondProviderId = "secondProvider";
    const paramterLabel = "parameter";
    const editor = createMockEditor("");
    const model = disposables.add(new ParameterHintsModel(editor, registry, 5));
    disposables.add(registry.register(mockFileSelector, new class {
      constructor() {
        this.signatureHelpTriggerCharacters = [triggerChar];
        this.signatureHelpRetriggerCharacters = [];
      }
      async provideSignatureHelp(_model, _position, _token, context) {
        try {
          if (!context.isRetrigger) {
            setTimeout(() => editor.trigger("keyboard", Handler.Type, { text: triggerChar }), 50);
            return {
              value: {
                activeParameter: 0,
                activeSignature: 0,
                signatures: [{
                  label: firstProviderId,
                  parameters: [
                    { label: paramterLabel }
                  ]
                }]
              },
              dispose: () => {
              }
            };
          }
          return void 0;
        } catch (err) {
          console.error(err);
          throw err;
        }
      }
    }()));
    disposables.add(registry.register(mockFileSelector, new class {
      constructor() {
        this.signatureHelpTriggerCharacters = [triggerChar];
        this.signatureHelpRetriggerCharacters = [];
      }
      async provideSignatureHelp(_model, _position, _token, context) {
        if (context.isRetrigger) {
          return {
            value: {
              activeParameter: 0,
              activeSignature: context.activeSignatureHelp ? context.activeSignatureHelp.activeSignature + 1 : 0,
              signatures: [{
                label: secondProviderId,
                parameters: context.activeSignatureHelp ? context.activeSignatureHelp.signatures[0].parameters : []
              }]
            },
            dispose: () => {
            }
          };
        }
        return void 0;
      }
    }()));
    await runWithFakedTimers({ useFakeTimers: true }, async () => {
      editor.trigger("keyboard", Handler.Type, { text: triggerChar });
      const firstHint = (await getNextHint(model)).value;
      assert.strictEqual(firstHint.signatures[0].label, firstProviderId);
      assert.strictEqual(firstHint.activeSignature, 0);
      assert.strictEqual(firstHint.signatures[0].parameters[0].label, paramterLabel);
      const secondHint = (await getNextHint(model)).value;
      assert.strictEqual(secondHint.signatures[0].label, secondProviderId);
      assert.strictEqual(secondHint.activeSignature, 1);
      assert.strictEqual(secondHint.signatures[0].parameters[0].label, paramterLabel);
    });
  });
  test("Quick typing should use the first trigger character", async () => {
    const editor = createMockEditor("");
    const model = disposables.add(new ParameterHintsModel(editor, registry, 50));
    const triggerCharacter = "a";
    let invokeCount = 0;
    disposables.add(registry.register(mockFileSelector, new class {
      constructor() {
        this.signatureHelpTriggerCharacters = [triggerCharacter];
        this.signatureHelpRetriggerCharacters = [];
      }
      provideSignatureHelp(_model, _position, _token, context) {
        try {
          ++invokeCount;
          if (invokeCount === 1) {
            assert.strictEqual(context.triggerKind, languages.SignatureHelpTriggerKind.TriggerCharacter);
            assert.strictEqual(context.triggerCharacter, triggerCharacter);
          } else {
            assert.fail("Unexpected invoke");
          }
          return emptySigHelpResult;
        } catch (err) {
          console.error(err);
          throw err;
        }
      }
    }()));
    await runWithFakedTimers({ useFakeTimers: true }, async () => {
      editor.trigger("keyboard", Handler.Type, { text: triggerCharacter });
      editor.trigger("keyboard", Handler.Type, { text: "x" });
      await getNextHint(model);
    });
  });
  test("Retrigger while a pending resolve is still going on should preserve last active signature #96702", async () => {
    const { promise: donePromise, resolve: done } = promiseWithResolvers();
    const editor = createMockEditor("");
    const model = disposables.add(new ParameterHintsModel(editor, registry, 50));
    const triggerCharacter = "a";
    const retriggerCharacter = "b";
    let invokeCount = 0;
    disposables.add(registry.register(mockFileSelector, new class {
      constructor() {
        this.signatureHelpTriggerCharacters = [triggerCharacter];
        this.signatureHelpRetriggerCharacters = [retriggerCharacter];
      }
      async provideSignatureHelp(_model, _position, _token, context) {
        try {
          ++invokeCount;
          if (invokeCount === 1) {
            assert.strictEqual(context.triggerKind, languages.SignatureHelpTriggerKind.TriggerCharacter);
            assert.strictEqual(context.triggerCharacter, triggerCharacter);
            setTimeout(() => editor.trigger("keyboard", Handler.Type, { text: retriggerCharacter }), 50);
          } else if (invokeCount === 2) {
            setTimeout(() => editor.trigger("keyboard", Handler.Type, { text: retriggerCharacter }), 50);
            await new Promise((resolve) => setTimeout(resolve, 1e3));
          } else if (invokeCount === 3) {
            assert.strictEqual(context.activeSignatureHelp, emptySigHelp);
            done();
          } else {
            assert.fail("Unexpected invoke");
          }
          return emptySigHelpResult;
        } catch (err) {
          console.error(err);
          done(err);
          throw err;
        }
      }
    }()));
    await runWithFakedTimers({ useFakeTimers: true }, async () => {
      editor.trigger("keyboard", Handler.Type, { text: triggerCharacter });
      await getNextHint(model);
      await getNextHint(model);
      await donePromise;
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9wYXJhbWV0ZXJIaW50cy90ZXN0L2Jyb3dzZXIvcGFyYW1ldGVySGludHNNb2RlbC50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgcHJvbWlzZVdpdGhSZXNvbHZlcnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IHJ1bldpdGhGYWtlZFRpbWVycyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdGltZVRyYXZlbFNjaGVkdWxlci5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgSGFuZGxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgTGFuZ3VhZ2VGZWF0dXJlUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VGZWF0dXJlUmVnaXN0cnkuanMnO1xuaW1wb3J0ICogYXMgbGFuZ3VhZ2VzIGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBQYXJhbWV0ZXJIaW50c01vZGVsIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9wYXJhbWV0ZXJIaW50c01vZGVsLmpzJztcbmltcG9ydCB7IGNyZWF0ZVRlc3RDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9icm93c2VyL3Rlc3RDb2RlRWRpdG9yLmpzJztcbmltcG9ydCB7IGNyZWF0ZVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvY29tbW9uL3Rlc3RUZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgU2VydmljZUNvbGxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9zZXJ2aWNlQ29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBJbk1lbW9yeVN0b3JhZ2VTZXJ2aWNlLCBJU3RvcmFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgTnVsbFRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeVV0aWxzLmpzJztcblxuY29uc3QgbW9ja0ZpbGUgPSBVUkkucGFyc2UoJ3Rlc3Q6c29tZWZpbGUudHR0Jyk7XG5jb25zdCBtb2NrRmlsZVNlbGVjdG9yID0geyBzY2hlbWU6ICd0ZXN0JyB9O1xuXG5cbmNvbnN0IGVtcHR5U2lnSGVscDogbGFuZ3VhZ2VzLlNpZ25hdHVyZUhlbHAgPSB7XG5cdHNpZ25hdHVyZXM6IFt7XG5cdFx0bGFiZWw6ICdub25lJyxcblx0XHRwYXJhbWV0ZXJzOiBbXVxuXHR9XSxcblx0YWN0aXZlUGFyYW1ldGVyOiAwLFxuXHRhY3RpdmVTaWduYXR1cmU6IDBcbn07XG5cbmNvbnN0IGVtcHR5U2lnSGVscFJlc3VsdDogbGFuZ3VhZ2VzLlNpZ25hdHVyZUhlbHBSZXN1bHQgPSB7XG5cdHZhbHVlOiBlbXB0eVNpZ0hlbHAsXG5cdGRpc3Bvc2U6ICgpID0+IHsgfVxufTtcblxuc3VpdGUoJ1BhcmFtZXRlckhpbnRzTW9kZWwnLCAoKSA9PiB7XG5cdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRsZXQgcmVnaXN0cnk6IExhbmd1YWdlRmVhdHVyZVJlZ2lzdHJ5PGxhbmd1YWdlcy5TaWduYXR1cmVIZWxwUHJvdmlkZXI+O1xuXG5cdHNldHVwKCgpID0+IHtcblx0XHRkaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdHJlZ2lzdHJ5ID0gbmV3IExhbmd1YWdlRmVhdHVyZVJlZ2lzdHJ5PGxhbmd1YWdlcy5TaWduYXR1cmVIZWxwUHJvdmlkZXI+KCk7XG5cdH0pO1xuXG5cdHRlYXJkb3duKCgpID0+IHtcblx0XHRkaXNwb3NhYmxlcy5jbGVhcigpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRmdW5jdGlvbiBjcmVhdGVNb2NrRWRpdG9yKGZpbGVDb250ZW50czogc3RyaW5nKSB7XG5cdFx0Y29uc3QgdGV4dE1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGNyZWF0ZVRleHRNb2RlbChmaWxlQ29udGVudHMsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBtb2NrRmlsZSkpO1xuXHRcdGNvbnN0IGVkaXRvciA9IGRpc3Bvc2FibGVzLmFkZChjcmVhdGVUZXN0Q29kZUVkaXRvcih0ZXh0TW9kZWwsIHtcblx0XHRcdHNlcnZpY2VDb2xsZWN0aW9uOiBuZXcgU2VydmljZUNvbGxlY3Rpb24oXG5cdFx0XHRcdFtJVGVsZW1ldHJ5U2VydmljZSwgTnVsbFRlbGVtZXRyeVNlcnZpY2VdLFxuXHRcdFx0XHRbSVN0b3JhZ2VTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IEluTWVtb3J5U3RvcmFnZVNlcnZpY2UoKSldXG5cdFx0XHQpXG5cdFx0fSkpO1xuXHRcdHJldHVybiBlZGl0b3I7XG5cdH1cblxuXHRmdW5jdGlvbiBnZXROZXh0SGludChtb2RlbDogUGFyYW1ldGVySGludHNNb2RlbCkge1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZTxsYW5ndWFnZXMuU2lnbmF0dXJlSGVscFJlc3VsdCB8IHVuZGVmaW5lZD4ocmVzb2x2ZSA9PiB7XG5cdFx0XHRjb25zdCBzdWIgPSBkaXNwb3NhYmxlcy5hZGQobW9kZWwub25DaGFuZ2VkSGludHMoZSA9PiB7XG5cdFx0XHRcdHN1Yi5kaXNwb3NlKCk7XG5cdFx0XHRcdHJldHVybiByZXNvbHZlKGUgPyB7IHZhbHVlOiBlLCBkaXNwb3NlOiAoKSA9PiB7IH0gfSA6IHVuZGVmaW5lZCk7XG5cdFx0XHR9KSk7XG5cdFx0fSk7XG5cdH1cblxuXHR0ZXN0KCdQcm92aWRlciBzaG91bGQgZ2V0IHRyaWdnZXIgY2hhcmFjdGVyIG9uIHR5cGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgeyBwcm9taXNlOiBkb25lUHJvbWlzZSwgcmVzb2x2ZTogZG9uZSB9ID0gcHJvbWlzZVdpdGhSZXNvbHZlcnM8dm9pZD4oKTtcblxuXHRcdGNvbnN0IHRyaWdnZXJDaGFyID0gJygnO1xuXG5cdFx0Y29uc3QgZWRpdG9yID0gY3JlYXRlTW9ja0VkaXRvcignJyk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG5ldyBQYXJhbWV0ZXJIaW50c01vZGVsKGVkaXRvciwgcmVnaXN0cnkpKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3RyeS5yZWdpc3Rlcihtb2NrRmlsZVNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyBsYW5ndWFnZXMuU2lnbmF0dXJlSGVscFByb3ZpZGVyIHtcblx0XHRcdHNpZ25hdHVyZUhlbHBUcmlnZ2VyQ2hhcmFjdGVycyA9IFt0cmlnZ2VyQ2hhcl07XG5cdFx0XHRzaWduYXR1cmVIZWxwUmV0cmlnZ2VyQ2hhcmFjdGVycyA9IFtdO1xuXG5cdFx0XHRwcm92aWRlU2lnbmF0dXJlSGVscChfbW9kZWw6IElUZXh0TW9kZWwsIF9wb3NpdGlvbjogUG9zaXRpb24sIF90b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4sIGNvbnRleHQ6IGxhbmd1YWdlcy5TaWduYXR1cmVIZWxwQ29udGV4dCkge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGV4dC50cmlnZ2VyS2luZCwgbGFuZ3VhZ2VzLlNpZ25hdHVyZUhlbHBUcmlnZ2VyS2luZC5UcmlnZ2VyQ2hhcmFjdGVyKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbnRleHQudHJpZ2dlckNoYXJhY3RlciwgdHJpZ2dlckNoYXIpO1xuXHRcdFx0XHRkb25lKCk7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzKHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCBIYW5kbGVyLlR5cGUsIHsgdGV4dDogdHJpZ2dlckNoYXIgfSk7XG5cdFx0XHRhd2FpdCBkb25lUHJvbWlzZTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnUHJvdmlkZXIgc2hvdWxkIGJlIHJldHJpZ2dlcmVkIGlmIGFscmVhZHkgYWN0aXZlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHsgcHJvbWlzZTogZG9uZVByb21pc2UsIHJlc29sdmU6IGRvbmUgfSA9IHByb21pc2VXaXRoUmVzb2x2ZXJzPHZvaWQ+KCk7XG5cblx0XHRjb25zdCB0cmlnZ2VyQ2hhciA9ICcoJztcblxuXHRcdGNvbnN0IGVkaXRvciA9IGNyZWF0ZU1vY2tFZGl0b3IoJycpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChuZXcgUGFyYW1ldGVySGludHNNb2RlbChlZGl0b3IsIHJlZ2lzdHJ5KSk7XG5cblx0XHRsZXQgaW52b2tlQ291bnQgPSAwO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3RyeS5yZWdpc3Rlcihtb2NrRmlsZVNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyBsYW5ndWFnZXMuU2lnbmF0dXJlSGVscFByb3ZpZGVyIHtcblx0XHRcdHNpZ25hdHVyZUhlbHBUcmlnZ2VyQ2hhcmFjdGVycyA9IFt0cmlnZ2VyQ2hhcl07XG5cdFx0XHRzaWduYXR1cmVIZWxwUmV0cmlnZ2VyQ2hhcmFjdGVycyA9IFtdO1xuXG5cdFx0XHRwcm92aWRlU2lnbmF0dXJlSGVscChfbW9kZWw6IElUZXh0TW9kZWwsIF9wb3NpdGlvbjogUG9zaXRpb24sIF90b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4sIGNvbnRleHQ6IGxhbmd1YWdlcy5TaWduYXR1cmVIZWxwQ29udGV4dCk6IGxhbmd1YWdlcy5TaWduYXR1cmVIZWxwUmVzdWx0IHwgUHJvbWlzZTxsYW5ndWFnZXMuU2lnbmF0dXJlSGVscFJlc3VsdD4ge1xuXHRcdFx0XHQrK2ludm9rZUNvdW50O1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGlmIChpbnZva2VDb3VudCA9PT0gMSkge1xuXHRcdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbnRleHQudHJpZ2dlcktpbmQsIGxhbmd1YWdlcy5TaWduYXR1cmVIZWxwVHJpZ2dlcktpbmQuVHJpZ2dlckNoYXJhY3Rlcik7XG5cdFx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGV4dC50cmlnZ2VyQ2hhcmFjdGVyLCB0cmlnZ2VyQ2hhcik7XG5cdFx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGV4dC5pc1JldHJpZ2dlciwgZmFsc2UpO1xuXHRcdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbnRleHQuYWN0aXZlU2lnbmF0dXJlSGVscCwgdW5kZWZpbmVkKTtcblxuXHRcdFx0XHRcdFx0Ly8gUmV0cmlnZ2VyXG5cdFx0XHRcdFx0XHRzZXRUaW1lb3V0KCgpID0+IGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsIEhhbmRsZXIuVHlwZSwgeyB0ZXh0OiB0cmlnZ2VyQ2hhciB9KSwgMCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnZva2VDb3VudCwgMik7XG5cdFx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGV4dC50cmlnZ2VyS2luZCwgbGFuZ3VhZ2VzLlNpZ25hdHVyZUhlbHBUcmlnZ2VyS2luZC5UcmlnZ2VyQ2hhcmFjdGVyKTtcblx0XHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb250ZXh0LmlzUmV0cmlnZ2VyLCB0cnVlKTtcblx0XHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb250ZXh0LnRyaWdnZXJDaGFyYWN0ZXIsIHRyaWdnZXJDaGFyKTtcblx0XHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb250ZXh0LmFjdGl2ZVNpZ25hdHVyZUhlbHAsIGVtcHR5U2lnSGVscCk7XG5cblx0XHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIGVtcHR5U2lnSGVscFJlc3VsdDtcblx0XHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdFx0Y29uc29sZS5lcnJvcihlcnIpO1xuXHRcdFx0XHRcdHRocm93IGVycjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGF3YWl0IHJ1bldpdGhGYWtlZFRpbWVycyh7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0ZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgSGFuZGxlci5UeXBlLCB7IHRleHQ6IHRyaWdnZXJDaGFyIH0pO1xuXHRcdFx0YXdhaXQgZG9uZVByb21pc2U7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1Byb3ZpZGVyIHNob3VsZCBub3QgYmUgcmV0cmlnZ2VyZWQgaWYgcHJldmlvdXMgaGVscCBpcyBjYW5jZWxlZCBmaXJzdCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB7IHByb21pc2U6IGRvbmVQcm9taXNlLCByZXNvbHZlOiBkb25lIH0gPSBwcm9taXNlV2l0aFJlc29sdmVyczx2b2lkPigpO1xuXG5cdFx0Y29uc3QgdHJpZ2dlckNoYXIgPSAnKCc7XG5cblx0XHRjb25zdCBlZGl0b3IgPSBjcmVhdGVNb2NrRWRpdG9yKCcnKTtcblx0XHRjb25zdCBoaW50TW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQobmV3IFBhcmFtZXRlckhpbnRzTW9kZWwoZWRpdG9yLCByZWdpc3RyeSkpO1xuXG5cdFx0bGV0IGludm9rZUNvdW50ID0gMDtcblx0XHRkaXNwb3NhYmxlcy5hZGQocmVnaXN0cnkucmVnaXN0ZXIobW9ja0ZpbGVTZWxlY3RvciwgbmV3IGNsYXNzIGltcGxlbWVudHMgbGFuZ3VhZ2VzLlNpZ25hdHVyZUhlbHBQcm92aWRlciB7XG5cdFx0XHRzaWduYXR1cmVIZWxwVHJpZ2dlckNoYXJhY3RlcnMgPSBbdHJpZ2dlckNoYXJdO1xuXHRcdFx0c2lnbmF0dXJlSGVscFJldHJpZ2dlckNoYXJhY3RlcnMgPSBbXTtcblxuXHRcdFx0cHJvdmlkZVNpZ25hdHVyZUhlbHAoX21vZGVsOiBJVGV4dE1vZGVsLCBfcG9zaXRpb246IFBvc2l0aW9uLCBfdG9rZW46IENhbmNlbGxhdGlvblRva2VuLCBjb250ZXh0OiBsYW5ndWFnZXMuU2lnbmF0dXJlSGVscENvbnRleHQpOiBsYW5ndWFnZXMuU2lnbmF0dXJlSGVscFJlc3VsdCB8IFByb21pc2U8bGFuZ3VhZ2VzLlNpZ25hdHVyZUhlbHBSZXN1bHQ+IHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHQrK2ludm9rZUNvdW50O1xuXHRcdFx0XHRcdGlmIChpbnZva2VDb3VudCA9PT0gMSkge1xuXHRcdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbnRleHQudHJpZ2dlcktpbmQsIGxhbmd1YWdlcy5TaWduYXR1cmVIZWxwVHJpZ2dlcktpbmQuVHJpZ2dlckNoYXJhY3Rlcik7XG5cdFx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGV4dC50cmlnZ2VyQ2hhcmFjdGVyLCB0cmlnZ2VyQ2hhcik7XG5cdFx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGV4dC5pc1JldHJpZ2dlciwgZmFsc2UpO1xuXHRcdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbnRleHQuYWN0aXZlU2lnbmF0dXJlSGVscCwgdW5kZWZpbmVkKTtcblxuXHRcdFx0XHRcdFx0Ly8gQ2FuY2VsIGFuZCByZXRyaWdnZXJcblx0XHRcdFx0XHRcdGhpbnRNb2RlbC5jYW5jZWwoKTtcblx0XHRcdFx0XHRcdGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsIEhhbmRsZXIuVHlwZSwgeyB0ZXh0OiB0cmlnZ2VyQ2hhciB9KTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGludm9rZUNvdW50LCAyKTtcblx0XHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb250ZXh0LnRyaWdnZXJLaW5kLCBsYW5ndWFnZXMuU2lnbmF0dXJlSGVscFRyaWdnZXJLaW5kLlRyaWdnZXJDaGFyYWN0ZXIpO1xuXHRcdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbnRleHQudHJpZ2dlckNoYXJhY3RlciwgdHJpZ2dlckNoYXIpO1xuXHRcdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbnRleHQuaXNSZXRyaWdnZXIsIHRydWUpO1xuXHRcdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbnRleHQuYWN0aXZlU2lnbmF0dXJlSGVscCwgdW5kZWZpbmVkKTtcblx0XHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIGVtcHR5U2lnSGVscFJlc3VsdDtcblx0XHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdFx0Y29uc29sZS5lcnJvcihlcnIpO1xuXHRcdFx0XHRcdHRocm93IGVycjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGF3YWl0IHJ1bldpdGhGYWtlZFRpbWVycyh7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgKCkgPT4ge1xuXHRcdFx0ZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgSGFuZGxlci5UeXBlLCB7IHRleHQ6IHRyaWdnZXJDaGFyIH0pO1xuXHRcdFx0cmV0dXJuIGRvbmVQcm9taXNlO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdQcm92aWRlciBzaG91bGQgZ2V0IGxhc3QgdHJpZ2dlciBjaGFyYWN0ZXIgd2hlbiB0cmlnZ2VyZWQgbXVsdGlwbGUgdGltZXMgYW5kIG9ubHkgYmUgaW52b2tlZCBvbmNlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHsgcHJvbWlzZTogZG9uZVByb21pc2UsIHJlc29sdmU6IGRvbmUgfSA9IHByb21pc2VXaXRoUmVzb2x2ZXJzPHZvaWQ+KCk7XG5cblx0XHRjb25zdCBlZGl0b3IgPSBjcmVhdGVNb2NrRWRpdG9yKCcnKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobmV3IFBhcmFtZXRlckhpbnRzTW9kZWwoZWRpdG9yLCByZWdpc3RyeSwgNSkpO1xuXG5cdFx0bGV0IGludm9rZUNvdW50ID0gMDtcblx0XHRkaXNwb3NhYmxlcy5hZGQocmVnaXN0cnkucmVnaXN0ZXIobW9ja0ZpbGVTZWxlY3RvciwgbmV3IGNsYXNzIGltcGxlbWVudHMgbGFuZ3VhZ2VzLlNpZ25hdHVyZUhlbHBQcm92aWRlciB7XG5cdFx0XHRzaWduYXR1cmVIZWxwVHJpZ2dlckNoYXJhY3RlcnMgPSBbJ2EnLCAnYicsICdjJ107XG5cdFx0XHRzaWduYXR1cmVIZWxwUmV0cmlnZ2VyQ2hhcmFjdGVycyA9IFtdO1xuXG5cdFx0XHRwcm92aWRlU2lnbmF0dXJlSGVscChfbW9kZWw6IElUZXh0TW9kZWwsIF9wb3NpdGlvbjogUG9zaXRpb24sIF90b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4sIGNvbnRleHQ6IGxhbmd1YWdlcy5TaWduYXR1cmVIZWxwQ29udGV4dCkge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdCsraW52b2tlQ291bnQ7XG5cblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGV4dC50cmlnZ2VyS2luZCwgbGFuZ3VhZ2VzLlNpZ25hdHVyZUhlbHBUcmlnZ2VyS2luZC5UcmlnZ2VyQ2hhcmFjdGVyKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGV4dC5pc1JldHJpZ2dlciwgZmFsc2UpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb250ZXh0LnRyaWdnZXJDaGFyYWN0ZXIsICdjJyk7XG5cblx0XHRcdFx0XHQvLyBHaXZlIHNvbWUgdGltZSB0byBhbGxvdyBmb3IgbGF0ZXIgdHJpZ2dlcnNcblx0XHRcdFx0XHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnZva2VDb3VudCwgMSk7XG5cblx0XHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0XHR9LCA1MCk7XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdFx0Y29uc29sZS5lcnJvcihlcnIpO1xuXHRcdFx0XHRcdHRocm93IGVycjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGF3YWl0IHJ1bldpdGhGYWtlZFRpbWVycyh7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0ZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgSGFuZGxlci5UeXBlLCB7IHRleHQ6ICdhJyB9KTtcblx0XHRcdGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsIEhhbmRsZXIuVHlwZSwgeyB0ZXh0OiAnYicgfSk7XG5cdFx0XHRlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCBIYW5kbGVyLlR5cGUsIHsgdGV4dDogJ2MnIH0pO1xuXG5cdFx0XHRhd2FpdCBkb25lUHJvbWlzZTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnUHJvdmlkZXIgc2hvdWxkIGJlIHJldHJpZ2dlcmVkIGlmIGFscmVhZHkgYWN0aXZlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHsgcHJvbWlzZTogZG9uZVByb21pc2UsIHJlc29sdmU6IGRvbmUgfSA9IHByb21pc2VXaXRoUmVzb2x2ZXJzPHZvaWQ+KCk7XG5cblx0XHRjb25zdCBlZGl0b3IgPSBjcmVhdGVNb2NrRWRpdG9yKCcnKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobmV3IFBhcmFtZXRlckhpbnRzTW9kZWwoZWRpdG9yLCByZWdpc3RyeSwgNSkpO1xuXG5cdFx0bGV0IGludm9rZUNvdW50ID0gMDtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3RyeS5yZWdpc3Rlcihtb2NrRmlsZVNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyBsYW5ndWFnZXMuU2lnbmF0dXJlSGVscFByb3ZpZGVyIHtcblx0XHRcdHNpZ25hdHVyZUhlbHBUcmlnZ2VyQ2hhcmFjdGVycyA9IFsnYScsICdiJ107XG5cdFx0XHRzaWduYXR1cmVIZWxwUmV0cmlnZ2VyQ2hhcmFjdGVycyA9IFtdO1xuXG5cdFx0XHRwcm92aWRlU2lnbmF0dXJlSGVscChfbW9kZWw6IElUZXh0TW9kZWwsIF9wb3NpdGlvbjogUG9zaXRpb24sIF90b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4sIGNvbnRleHQ6IGxhbmd1YWdlcy5TaWduYXR1cmVIZWxwQ29udGV4dCk6IGxhbmd1YWdlcy5TaWduYXR1cmVIZWxwUmVzdWx0IHwgUHJvbWlzZTxsYW5ndWFnZXMuU2lnbmF0dXJlSGVscFJlc3VsdD4ge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdCsraW52b2tlQ291bnQ7XG5cdFx0XHRcdFx0aWYgKGludm9rZUNvdW50ID09PSAxKSB7XG5cdFx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGV4dC50cmlnZ2VyS2luZCwgbGFuZ3VhZ2VzLlNpZ25hdHVyZUhlbHBUcmlnZ2VyS2luZC5UcmlnZ2VyQ2hhcmFjdGVyKTtcblx0XHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb250ZXh0LnRyaWdnZXJDaGFyYWN0ZXIsICdhJyk7XG5cblx0XHRcdFx0XHRcdC8vIHJldHJpZ2dlciBhZnRlciBkZWxheSBmb3Igd2lkZ2V0IHRvIHNob3cgdXBcblx0XHRcdFx0XHRcdHNldFRpbWVvdXQoKCkgPT4gZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgSGFuZGxlci5UeXBlLCB7IHRleHQ6ICdiJyB9KSwgNTApO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoaW52b2tlQ291bnQgPT09IDIpIHtcblx0XHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb250ZXh0LnRyaWdnZXJLaW5kLCBsYW5ndWFnZXMuU2lnbmF0dXJlSGVscFRyaWdnZXJLaW5kLlRyaWdnZXJDaGFyYWN0ZXIpO1xuXHRcdFx0XHRcdFx0YXNzZXJ0Lm9rKGNvbnRleHQuaXNSZXRyaWdnZXIpO1xuXHRcdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbnRleHQudHJpZ2dlckNoYXJhY3RlciwgJ2InKTtcblx0XHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0YXNzZXJ0LmZhaWwoJ1VuZXhwZWN0ZWQgaW52b2tlJyk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmV0dXJuIGVtcHR5U2lnSGVscFJlc3VsdDtcblx0XHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdFx0Y29uc29sZS5lcnJvcihlcnIpO1xuXHRcdFx0XHRcdHRocm93IGVycjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGF3YWl0IHJ1bldpdGhGYWtlZFRpbWVycyh7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgKCkgPT4ge1xuXHRcdFx0ZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgSGFuZGxlci5UeXBlLCB7IHRleHQ6ICdhJyB9KTtcblx0XHRcdHJldHVybiBkb25lUHJvbWlzZTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnU2hvdWxkIGNhbmNlbCBleGlzdGluZyByZXF1ZXN0IHdoZW4gbmV3IHJlcXVlc3QgY29tZXMgaW4nLCBhc3luYyAoKSA9PiB7XG5cblx0XHRjb25zdCBlZGl0b3IgPSBjcmVhdGVNb2NrRWRpdG9yKCdhYmMgZGVmJyk7XG5cdFx0Y29uc3QgaGludHNNb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgUGFyYW1ldGVySGludHNNb2RlbChlZGl0b3IsIHJlZ2lzdHJ5KSk7XG5cblx0XHRsZXQgZGlkUmVxdWVzdENhbmNlbGxhdGlvbk9mID0gLTE7XG5cdFx0bGV0IGludm9rZUNvdW50ID0gMDtcblx0XHRjb25zdCBsb25nUnVubmluZ1Byb3ZpZGVyID0gbmV3IGNsYXNzIGltcGxlbWVudHMgbGFuZ3VhZ2VzLlNpZ25hdHVyZUhlbHBQcm92aWRlciB7XG5cdFx0XHRzaWduYXR1cmVIZWxwVHJpZ2dlckNoYXJhY3RlcnMgPSBbXTtcblx0XHRcdHNpZ25hdHVyZUhlbHBSZXRyaWdnZXJDaGFyYWN0ZXJzID0gW107XG5cblxuXHRcdFx0cHJvdmlkZVNpZ25hdHVyZUhlbHAoX21vZGVsOiBJVGV4dE1vZGVsLCBfcG9zaXRpb246IFBvc2l0aW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBsYW5ndWFnZXMuU2lnbmF0dXJlSGVscFJlc3VsdCB8IFByb21pc2U8bGFuZ3VhZ2VzLlNpZ25hdHVyZUhlbHBSZXN1bHQ+IHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRjb25zdCBjb3VudCA9IGludm9rZUNvdW50Kys7XG5cdFx0XHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IHsgZGlkUmVxdWVzdENhbmNlbGxhdGlvbk9mID0gY291bnQ7IH0pKTtcblxuXHRcdFx0XHRcdC8vIHJldHJpZ2dlciBvbiBmaXJzdCByZXF1ZXN0XG5cdFx0XHRcdFx0aWYgKGNvdW50ID09PSAwKSB7XG5cdFx0XHRcdFx0XHRoaW50c01vZGVsLnRyaWdnZXIoeyB0cmlnZ2VyS2luZDogbGFuZ3VhZ2VzLlNpZ25hdHVyZUhlbHBUcmlnZ2VyS2luZC5JbnZva2UgfSwgMCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlPGxhbmd1YWdlcy5TaWduYXR1cmVIZWxwUmVzdWx0PihyZXNvbHZlID0+IHtcblx0XHRcdFx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRyZXNvbHZlKHtcblx0XHRcdFx0XHRcdFx0XHR2YWx1ZToge1xuXHRcdFx0XHRcdFx0XHRcdFx0c2lnbmF0dXJlczogW3tcblx0XHRcdFx0XHRcdFx0XHRcdFx0bGFiZWw6ICcnICsgY291bnQsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHBhcmFtZXRlcnM6IFtdXG5cdFx0XHRcdFx0XHRcdFx0XHR9XSxcblx0XHRcdFx0XHRcdFx0XHRcdGFjdGl2ZVBhcmFtZXRlcjogMCxcblx0XHRcdFx0XHRcdFx0XHRcdGFjdGl2ZVNpZ25hdHVyZTogMFxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0ZGlzcG9zZTogKCkgPT4geyB9XG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0fSwgMTAwKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdFx0Y29uc29sZS5lcnJvcihlcnIpO1xuXHRcdFx0XHRcdHRocm93IGVycjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQocmVnaXN0cnkucmVnaXN0ZXIobW9ja0ZpbGVTZWxlY3RvciwgbG9uZ1J1bm5pbmdQcm92aWRlcikpO1xuXG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzKHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cblx0XHRcdGhpbnRzTW9kZWwudHJpZ2dlcih7IHRyaWdnZXJLaW5kOiBsYW5ndWFnZXMuU2lnbmF0dXJlSGVscFRyaWdnZXJLaW5kLkludm9rZSB9LCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgtMSwgZGlkUmVxdWVzdENhbmNlbGxhdGlvbk9mKTtcblxuXHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+XG5cdFx0XHRcdGRpc3Bvc2FibGVzLmFkZChoaW50c01vZGVsLm9uQ2hhbmdlZEhpbnRzKG5ld1BhcmFtdGVySGludHMgPT4ge1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoMCwgZGlkUmVxdWVzdENhbmNlbGxhdGlvbk9mKTtcblx0XHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgnMScsIG5ld1BhcmFtdGVySGludHMhLnNpZ25hdHVyZXNbMF0ubGFiZWwpO1xuXHRcdFx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0XHRcdHJlamVjdChlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1Byb3ZpZGVyIHNob3VsZCBiZSByZXRyaWdnZXJlZCBieSByZXRyaWdnZXIgY2hhcmFjdGVyJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHsgcHJvbWlzZTogZG9uZVByb21pc2UsIHJlc29sdmU6IGRvbmUgfSA9IHByb21pc2VXaXRoUmVzb2x2ZXJzPHZvaWQ+KCk7XG5cblx0XHRjb25zdCB0cmlnZ2VyQ2hhciA9ICdhJztcblx0XHRjb25zdCByZXRyaWdnZXJDaGFyID0gJ2InO1xuXG5cdFx0Y29uc3QgZWRpdG9yID0gY3JlYXRlTW9ja0VkaXRvcignJyk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG5ldyBQYXJhbWV0ZXJIaW50c01vZGVsKGVkaXRvciwgcmVnaXN0cnksIDUpKTtcblxuXHRcdGxldCBpbnZva2VDb3VudCA9IDA7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHJlZ2lzdHJ5LnJlZ2lzdGVyKG1vY2tGaWxlU2VsZWN0b3IsIG5ldyBjbGFzcyBpbXBsZW1lbnRzIGxhbmd1YWdlcy5TaWduYXR1cmVIZWxwUHJvdmlkZXIge1xuXHRcdFx0c2lnbmF0dXJlSGVscFRyaWdnZXJDaGFyYWN0ZXJzID0gW3RyaWdnZXJDaGFyXTtcblx0XHRcdHNpZ25hdHVyZUhlbHBSZXRyaWdnZXJDaGFyYWN0ZXJzID0gW3JldHJpZ2dlckNoYXJdO1xuXG5cdFx0XHRwcm92aWRlU2lnbmF0dXJlSGVscChfbW9kZWw6IElUZXh0TW9kZWwsIF9wb3NpdGlvbjogUG9zaXRpb24sIF90b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4sIGNvbnRleHQ6IGxhbmd1YWdlcy5TaWduYXR1cmVIZWxwQ29udGV4dCk6IGxhbmd1YWdlcy5TaWduYXR1cmVIZWxwUmVzdWx0IHwgUHJvbWlzZTxsYW5ndWFnZXMuU2lnbmF0dXJlSGVscFJlc3VsdD4ge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdCsraW52b2tlQ291bnQ7XG5cdFx0XHRcdFx0aWYgKGludm9rZUNvdW50ID09PSAxKSB7XG5cdFx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGV4dC50cmlnZ2VyS2luZCwgbGFuZ3VhZ2VzLlNpZ25hdHVyZUhlbHBUcmlnZ2VyS2luZC5UcmlnZ2VyQ2hhcmFjdGVyKTtcblx0XHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb250ZXh0LnRyaWdnZXJDaGFyYWN0ZXIsIHRyaWdnZXJDaGFyKTtcblxuXHRcdFx0XHRcdFx0Ly8gcmV0cmlnZ2VyIGFmdGVyIGRlbGF5IGZvciB3aWRnZXQgdG8gc2hvdyB1cFxuXHRcdFx0XHRcdFx0c2V0VGltZW91dCgoKSA9PiBlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCBIYW5kbGVyLlR5cGUsIHsgdGV4dDogcmV0cmlnZ2VyQ2hhciB9KSwgNTApO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoaW52b2tlQ291bnQgPT09IDIpIHtcblx0XHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb250ZXh0LnRyaWdnZXJLaW5kLCBsYW5ndWFnZXMuU2lnbmF0dXJlSGVscFRyaWdnZXJLaW5kLlRyaWdnZXJDaGFyYWN0ZXIpO1xuXHRcdFx0XHRcdFx0YXNzZXJ0Lm9rKGNvbnRleHQuaXNSZXRyaWdnZXIpO1xuXHRcdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbnRleHQudHJpZ2dlckNoYXJhY3RlciwgcmV0cmlnZ2VyQ2hhcik7XG5cdFx0XHRcdFx0XHRkb25lKCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGFzc2VydC5mYWlsKCdVbmV4cGVjdGVkIGludm9rZScpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJldHVybiBlbXB0eVNpZ0hlbHBSZXN1bHQ7XG5cdFx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoZXJyKTtcblx0XHRcdFx0XHR0aHJvdyBlcnI7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnMoeyB1c2VGYWtlVGltZXJzOiB0cnVlIH0sIGFzeW5jICgpID0+IHtcblx0XHRcdC8vIFRoaXMgc2hvdWxkIG5vdCB0cmlnZ2VyIGFueXRoaW5nXG5cdFx0XHRlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCBIYW5kbGVyLlR5cGUsIHsgdGV4dDogcmV0cmlnZ2VyQ2hhciB9KTtcblxuXHRcdFx0Ly8gQnV0IGEgdHJpZ2dlciBjaGFyYWN0ZXIgc2hvdWxkXG5cdFx0XHRlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCBIYW5kbGVyLlR5cGUsIHsgdGV4dDogdHJpZ2dlckNoYXIgfSk7XG5cblx0XHRcdHJldHVybiBkb25lUHJvbWlzZTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnc2hvdWxkIHVzZSBmaXJzdCByZXN1bHQgZnJvbSBtdWx0aXBsZSBwcm92aWRlcnMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgdHJpZ2dlckNoYXIgPSAnYSc7XG5cdFx0Y29uc3QgZmlyc3RQcm92aWRlcklkID0gJ2ZpcnN0UHJvdmlkZXInO1xuXHRcdGNvbnN0IHNlY29uZFByb3ZpZGVySWQgPSAnc2Vjb25kUHJvdmlkZXInO1xuXHRcdGNvbnN0IHBhcmFtdGVyTGFiZWwgPSAncGFyYW1ldGVyJztcblxuXHRcdGNvbnN0IGVkaXRvciA9IGNyZWF0ZU1vY2tFZGl0b3IoJycpO1xuXHRcdGNvbnN0IG1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBQYXJhbWV0ZXJIaW50c01vZGVsKGVkaXRvciwgcmVnaXN0cnksIDUpKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3RyeS5yZWdpc3Rlcihtb2NrRmlsZVNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyBsYW5ndWFnZXMuU2lnbmF0dXJlSGVscFByb3ZpZGVyIHtcblx0XHRcdHNpZ25hdHVyZUhlbHBUcmlnZ2VyQ2hhcmFjdGVycyA9IFt0cmlnZ2VyQ2hhcl07XG5cdFx0XHRzaWduYXR1cmVIZWxwUmV0cmlnZ2VyQ2hhcmFjdGVycyA9IFtdO1xuXG5cdFx0XHRhc3luYyBwcm92aWRlU2lnbmF0dXJlSGVscChfbW9kZWw6IElUZXh0TW9kZWwsIF9wb3NpdGlvbjogUG9zaXRpb24sIF90b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4sIGNvbnRleHQ6IGxhbmd1YWdlcy5TaWduYXR1cmVIZWxwQ29udGV4dCk6IFByb21pc2U8bGFuZ3VhZ2VzLlNpZ25hdHVyZUhlbHBSZXN1bHQgfCB1bmRlZmluZWQ+IHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRpZiAoIWNvbnRleHQuaXNSZXRyaWdnZXIpIHtcblx0XHRcdFx0XHRcdC8vIHJldHJpZ2dlciBhZnRlciBkZWxheSBmb3Igd2lkZ2V0IHRvIHNob3cgdXBcblx0XHRcdFx0XHRcdHNldFRpbWVvdXQoKCkgPT4gZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgSGFuZGxlci5UeXBlLCB7IHRleHQ6IHRyaWdnZXJDaGFyIH0pLCA1MCk7XG5cblx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdHZhbHVlOiB7XG5cdFx0XHRcdFx0XHRcdFx0YWN0aXZlUGFyYW1ldGVyOiAwLFxuXHRcdFx0XHRcdFx0XHRcdGFjdGl2ZVNpZ25hdHVyZTogMCxcblx0XHRcdFx0XHRcdFx0XHRzaWduYXR1cmVzOiBbe1xuXHRcdFx0XHRcdFx0XHRcdFx0bGFiZWw6IGZpcnN0UHJvdmlkZXJJZCxcblx0XHRcdFx0XHRcdFx0XHRcdHBhcmFtZXRlcnM6IFtcblx0XHRcdFx0XHRcdFx0XHRcdFx0eyBsYWJlbDogcGFyYW10ZXJMYWJlbCB9XG5cdFx0XHRcdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0XHRcdFx0fV1cblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0ZGlzcG9zZTogKCkgPT4geyB9XG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoZXJyKTtcblx0XHRcdFx0XHR0aHJvdyBlcnI7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQocmVnaXN0cnkucmVnaXN0ZXIobW9ja0ZpbGVTZWxlY3RvciwgbmV3IGNsYXNzIGltcGxlbWVudHMgbGFuZ3VhZ2VzLlNpZ25hdHVyZUhlbHBQcm92aWRlciB7XG5cdFx0XHRzaWduYXR1cmVIZWxwVHJpZ2dlckNoYXJhY3RlcnMgPSBbdHJpZ2dlckNoYXJdO1xuXHRcdFx0c2lnbmF0dXJlSGVscFJldHJpZ2dlckNoYXJhY3RlcnMgPSBbXTtcblxuXHRcdFx0YXN5bmMgcHJvdmlkZVNpZ25hdHVyZUhlbHAoX21vZGVsOiBJVGV4dE1vZGVsLCBfcG9zaXRpb246IFBvc2l0aW9uLCBfdG9rZW46IENhbmNlbGxhdGlvblRva2VuLCBjb250ZXh0OiBsYW5ndWFnZXMuU2lnbmF0dXJlSGVscENvbnRleHQpOiBQcm9taXNlPGxhbmd1YWdlcy5TaWduYXR1cmVIZWxwUmVzdWx0IHwgdW5kZWZpbmVkPiB7XG5cdFx0XHRcdGlmIChjb250ZXh0LmlzUmV0cmlnZ2VyKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdHZhbHVlOiB7XG5cdFx0XHRcdFx0XHRcdGFjdGl2ZVBhcmFtZXRlcjogMCxcblx0XHRcdFx0XHRcdFx0YWN0aXZlU2lnbmF0dXJlOiBjb250ZXh0LmFjdGl2ZVNpZ25hdHVyZUhlbHAgPyBjb250ZXh0LmFjdGl2ZVNpZ25hdHVyZUhlbHAuYWN0aXZlU2lnbmF0dXJlICsgMSA6IDAsXG5cdFx0XHRcdFx0XHRcdHNpZ25hdHVyZXM6IFt7XG5cdFx0XHRcdFx0XHRcdFx0bGFiZWw6IHNlY29uZFByb3ZpZGVySWQsXG5cdFx0XHRcdFx0XHRcdFx0cGFyYW1ldGVyczogY29udGV4dC5hY3RpdmVTaWduYXR1cmVIZWxwID8gY29udGV4dC5hY3RpdmVTaWduYXR1cmVIZWxwLnNpZ25hdHVyZXNbMF0ucGFyYW1ldGVycyA6IFtdXG5cdFx0XHRcdFx0XHRcdH1dXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0ZGlzcG9zZTogKCkgPT4geyB9XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzKHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCBIYW5kbGVyLlR5cGUsIHsgdGV4dDogdHJpZ2dlckNoYXIgfSk7XG5cblx0XHRcdGNvbnN0IGZpcnN0SGludCA9IChhd2FpdCBnZXROZXh0SGludChtb2RlbCkpIS52YWx1ZTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdEhpbnQuc2lnbmF0dXJlc1swXS5sYWJlbCwgZmlyc3RQcm92aWRlcklkKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdEhpbnQuYWN0aXZlU2lnbmF0dXJlLCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdEhpbnQuc2lnbmF0dXJlc1swXS5wYXJhbWV0ZXJzWzBdLmxhYmVsLCBwYXJhbXRlckxhYmVsKTtcblxuXHRcdFx0Y29uc3Qgc2Vjb25kSGludCA9IChhd2FpdCBnZXROZXh0SGludChtb2RlbCkpIS52YWx1ZTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZWNvbmRIaW50LnNpZ25hdHVyZXNbMF0ubGFiZWwsIHNlY29uZFByb3ZpZGVySWQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlY29uZEhpbnQuYWN0aXZlU2lnbmF0dXJlLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZWNvbmRIaW50LnNpZ25hdHVyZXNbMF0ucGFyYW1ldGVyc1swXS5sYWJlbCwgcGFyYW10ZXJMYWJlbCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1F1aWNrIHR5cGluZyBzaG91bGQgdXNlIHRoZSBmaXJzdCB0cmlnZ2VyIGNoYXJhY3RlcicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBlZGl0b3IgPSBjcmVhdGVNb2NrRWRpdG9yKCcnKTtcblx0XHRjb25zdCBtb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgUGFyYW1ldGVySGludHNNb2RlbChlZGl0b3IsIHJlZ2lzdHJ5LCA1MCkpO1xuXG5cdFx0Y29uc3QgdHJpZ2dlckNoYXJhY3RlciA9ICdhJztcblxuXHRcdGxldCBpbnZva2VDb3VudCA9IDA7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHJlZ2lzdHJ5LnJlZ2lzdGVyKG1vY2tGaWxlU2VsZWN0b3IsIG5ldyBjbGFzcyBpbXBsZW1lbnRzIGxhbmd1YWdlcy5TaWduYXR1cmVIZWxwUHJvdmlkZXIge1xuXHRcdFx0c2lnbmF0dXJlSGVscFRyaWdnZXJDaGFyYWN0ZXJzID0gW3RyaWdnZXJDaGFyYWN0ZXJdO1xuXHRcdFx0c2lnbmF0dXJlSGVscFJldHJpZ2dlckNoYXJhY3RlcnMgPSBbXTtcblxuXHRcdFx0cHJvdmlkZVNpZ25hdHVyZUhlbHAoX21vZGVsOiBJVGV4dE1vZGVsLCBfcG9zaXRpb246IFBvc2l0aW9uLCBfdG9rZW46IENhbmNlbGxhdGlvblRva2VuLCBjb250ZXh0OiBsYW5ndWFnZXMuU2lnbmF0dXJlSGVscENvbnRleHQpOiBsYW5ndWFnZXMuU2lnbmF0dXJlSGVscFJlc3VsdCB8IFByb21pc2U8bGFuZ3VhZ2VzLlNpZ25hdHVyZUhlbHBSZXN1bHQ+IHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHQrK2ludm9rZUNvdW50O1xuXG5cdFx0XHRcdFx0aWYgKGludm9rZUNvdW50ID09PSAxKSB7XG5cdFx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGV4dC50cmlnZ2VyS2luZCwgbGFuZ3VhZ2VzLlNpZ25hdHVyZUhlbHBUcmlnZ2VyS2luZC5UcmlnZ2VyQ2hhcmFjdGVyKTtcblx0XHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb250ZXh0LnRyaWdnZXJDaGFyYWN0ZXIsIHRyaWdnZXJDaGFyYWN0ZXIpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRhc3NlcnQuZmFpbCgnVW5leHBlY3RlZCBpbnZva2UnKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4gZW1wdHlTaWdIZWxwUmVzdWx0O1xuXHRcdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0XHRjb25zb2xlLmVycm9yKGVycik7XG5cdFx0XHRcdFx0dGhyb3cgZXJyO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzKHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCBIYW5kbGVyLlR5cGUsIHsgdGV4dDogdHJpZ2dlckNoYXJhY3RlciB9KTtcblx0XHRcdGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsIEhhbmRsZXIuVHlwZSwgeyB0ZXh0OiAneCcgfSk7XG5cblx0XHRcdGF3YWl0IGdldE5leHRIaW50KG1vZGVsKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnUmV0cmlnZ2VyIHdoaWxlIGEgcGVuZGluZyByZXNvbHZlIGlzIHN0aWxsIGdvaW5nIG9uIHNob3VsZCBwcmVzZXJ2ZSBsYXN0IGFjdGl2ZSBzaWduYXR1cmUgIzk2NzAyJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHsgcHJvbWlzZTogZG9uZVByb21pc2UsIHJlc29sdmU6IGRvbmUgfSA9IHByb21pc2VXaXRoUmVzb2x2ZXJzPHZvaWQ+KCk7XG5cblx0XHRjb25zdCBlZGl0b3IgPSBjcmVhdGVNb2NrRWRpdG9yKCcnKTtcblx0XHRjb25zdCBtb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgUGFyYW1ldGVySGludHNNb2RlbChlZGl0b3IsIHJlZ2lzdHJ5LCA1MCkpO1xuXG5cdFx0Y29uc3QgdHJpZ2dlckNoYXJhY3RlciA9ICdhJztcblx0XHRjb25zdCByZXRyaWdnZXJDaGFyYWN0ZXIgPSAnYic7XG5cblx0XHRsZXQgaW52b2tlQ291bnQgPSAwO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3RyeS5yZWdpc3Rlcihtb2NrRmlsZVNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyBsYW5ndWFnZXMuU2lnbmF0dXJlSGVscFByb3ZpZGVyIHtcblx0XHRcdHNpZ25hdHVyZUhlbHBUcmlnZ2VyQ2hhcmFjdGVycyA9IFt0cmlnZ2VyQ2hhcmFjdGVyXTtcblx0XHRcdHNpZ25hdHVyZUhlbHBSZXRyaWdnZXJDaGFyYWN0ZXJzID0gW3JldHJpZ2dlckNoYXJhY3Rlcl07XG5cblx0XHRcdGFzeW5jIHByb3ZpZGVTaWduYXR1cmVIZWxwKF9tb2RlbDogSVRleHRNb2RlbCwgX3Bvc2l0aW9uOiBQb3NpdGlvbiwgX3Rva2VuOiBDYW5jZWxsYXRpb25Ub2tlbiwgY29udGV4dDogbGFuZ3VhZ2VzLlNpZ25hdHVyZUhlbHBDb250ZXh0KTogUHJvbWlzZTxsYW5ndWFnZXMuU2lnbmF0dXJlSGVscFJlc3VsdD4ge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdCsraW52b2tlQ291bnQ7XG5cblx0XHRcdFx0XHRpZiAoaW52b2tlQ291bnQgPT09IDEpIHtcblx0XHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb250ZXh0LnRyaWdnZXJLaW5kLCBsYW5ndWFnZXMuU2lnbmF0dXJlSGVscFRyaWdnZXJLaW5kLlRyaWdnZXJDaGFyYWN0ZXIpO1xuXHRcdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbnRleHQudHJpZ2dlckNoYXJhY3RlciwgdHJpZ2dlckNoYXJhY3Rlcik7XG5cdFx0XHRcdFx0XHRzZXRUaW1lb3V0KCgpID0+IGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsIEhhbmRsZXIuVHlwZSwgeyB0ZXh0OiByZXRyaWdnZXJDaGFyYWN0ZXIgfSksIDUwKTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKGludm9rZUNvdW50ID09PSAyKSB7XG5cdFx0XHRcdFx0XHQvLyBUcmlnZ2VyIGFnYWluIHdoaWxlIHdlIHdhaXQgZm9yIHJlc29sdmUgdG8gdGFrZSBwbGFjZVxuXHRcdFx0XHRcdFx0c2V0VGltZW91dCgoKSA9PiBlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCBIYW5kbGVyLlR5cGUsIHsgdGV4dDogcmV0cmlnZ2VyQ2hhcmFjdGVyIH0pLCA1MCk7XG5cdFx0XHRcdFx0XHRhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgMTAwMCkpO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoaW52b2tlQ291bnQgPT09IDMpIHtcblx0XHRcdFx0XHRcdC8vIE1ha2Ugc3VyZSB0aGF0IGluIGEgcmV0cmlnZ2VyIGR1cmluZyBhIHBlbmRpbmcgcmVzb2x2ZSwgd2Ugc3RpbGwgaGF2ZSB0aGUgb2xkIGFjdGl2ZSBzaWduYXR1cmUuXG5cdFx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGV4dC5hY3RpdmVTaWduYXR1cmVIZWxwLCBlbXB0eVNpZ0hlbHApO1xuXHRcdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRhc3NlcnQuZmFpbCgnVW5leHBlY3RlZCBpbnZva2UnKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4gZW1wdHlTaWdIZWxwUmVzdWx0O1xuXHRcdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0XHRjb25zb2xlLmVycm9yKGVycik7XG5cdFx0XHRcdFx0ZG9uZShlcnIpO1xuXHRcdFx0XHRcdHRocm93IGVycjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGF3YWl0IHJ1bldpdGhGYWtlZFRpbWVycyh7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXG5cdFx0XHRlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCBIYW5kbGVyLlR5cGUsIHsgdGV4dDogdHJpZ2dlckNoYXJhY3RlciB9KTtcblxuXHRcdFx0YXdhaXQgZ2V0TmV4dEhpbnQobW9kZWwpO1xuXHRcdFx0YXdhaXQgZ2V0TmV4dEhpbnQobW9kZWwpO1xuXG5cdFx0XHRhd2FpdCBkb25lUHJvbWlzZTtcblx0XHR9KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLDRCQUE0QjtBQUVyQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLFdBQVc7QUFDcEIsU0FBUywwQkFBMEI7QUFDbkMsU0FBUywrQ0FBK0M7QUFFeEQsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsK0JBQStCO0FBQ3hDLFlBQVksZUFBZTtBQUUzQixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHdCQUF3Qix1QkFBdUI7QUFDeEQsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyw0QkFBNEI7QUFFckMsTUFBTSxXQUFXLElBQUksTUFBTSxtQkFBbUI7QUFDOUMsTUFBTSxtQkFBbUIsRUFBRSxRQUFRLE9BQU87QUFHMUMsTUFBTSxlQUF3QztBQUFBLEVBQzdDLFlBQVksQ0FBQztBQUFBLElBQ1osT0FBTztBQUFBLElBQ1AsWUFBWSxDQUFDO0FBQUEsRUFDZCxDQUFDO0FBQUEsRUFDRCxpQkFBaUI7QUFBQSxFQUNqQixpQkFBaUI7QUFDbEI7QUFFQSxNQUFNLHFCQUFvRDtBQUFBLEVBQ3pELE9BQU87QUFBQSxFQUNQLFNBQVMsTUFBTTtBQUFBLEVBQUU7QUFDbEI7QUFFQSxNQUFNLHVCQUF1QixNQUFNO0FBQ2xDLFFBQU0sY0FBYyxJQUFJLGdCQUFnQjtBQUN4QyxNQUFJO0FBRUosUUFBTSxNQUFNO0FBQ1gsZ0JBQVksTUFBTTtBQUNsQixlQUFXLElBQUksd0JBQXlEO0FBQUEsRUFDekUsQ0FBQztBQUVELFdBQVMsTUFBTTtBQUNkLGdCQUFZLE1BQU07QUFBQSxFQUNuQixDQUFDO0FBRUQsMENBQXdDO0FBRXhDLFdBQVMsaUJBQWlCLGNBQXNCO0FBQy9DLFVBQU0sWUFBWSxZQUFZLElBQUksZ0JBQWdCLGNBQWMsUUFBVyxRQUFXLFFBQVEsQ0FBQztBQUMvRixVQUFNLFNBQVMsWUFBWSxJQUFJLHFCQUFxQixXQUFXO0FBQUEsTUFDOUQsbUJBQW1CLElBQUk7QUFBQSxRQUN0QixDQUFDLG1CQUFtQixvQkFBb0I7QUFBQSxRQUN4QyxDQUFDLGlCQUFpQixZQUFZLElBQUksSUFBSSx1QkFBdUIsQ0FBQyxDQUFDO0FBQUEsTUFDaEU7QUFBQSxJQUNELENBQUMsQ0FBQztBQUNGLFdBQU87QUFBQSxFQUNSO0FBRUEsV0FBUyxZQUFZLE9BQTRCO0FBQ2hELFdBQU8sSUFBSSxRQUFtRCxhQUFXO0FBQ3hFLFlBQU0sTUFBTSxZQUFZLElBQUksTUFBTSxlQUFlLE9BQUs7QUFDckQsWUFBSSxRQUFRO0FBQ1osZUFBTyxRQUFRLElBQUksRUFBRSxPQUFPLEdBQUcsU0FBUyxNQUFNO0FBQUEsUUFBRSxFQUFFLElBQUksTUFBUztBQUFBLE1BQ2hFLENBQUMsQ0FBQztBQUFBLElBQ0gsQ0FBQztBQUFBLEVBQ0Y7QUFFQSxPQUFLLGlEQUFpRCxZQUFZO0FBQ2pFLFVBQU0sRUFBRSxTQUFTLGFBQWEsU0FBUyxLQUFLLElBQUkscUJBQTJCO0FBRTNFLFVBQU0sY0FBYztBQUVwQixVQUFNLFNBQVMsaUJBQWlCLEVBQUU7QUFDbEMsZ0JBQVksSUFBSSxJQUFJLG9CQUFvQixRQUFRLFFBQVEsQ0FBQztBQUV6RCxnQkFBWSxJQUFJLFNBQVMsU0FBUyxrQkFBa0IsSUFBSSxNQUFpRDtBQUFBLE1BQWpEO0FBQ3ZELDhDQUFpQyxDQUFDLFdBQVc7QUFDN0MsZ0RBQW1DLENBQUM7QUFBQTtBQUFBLE1BRXBDLHFCQUFxQixRQUFvQixXQUFxQixRQUEyQixTQUF5QztBQUNqSSxlQUFPLFlBQVksUUFBUSxhQUFhLFVBQVUseUJBQXlCLGdCQUFnQjtBQUMzRixlQUFPLFlBQVksUUFBUSxrQkFBa0IsV0FBVztBQUN4RCxhQUFLO0FBQ0wsZUFBTztBQUFBLE1BQ1I7QUFBQSxJQUNELEdBQUMsQ0FBQztBQUVGLFVBQU0sbUJBQW1CLEVBQUUsZUFBZSxLQUFLLEdBQUcsWUFBWTtBQUM3RCxhQUFPLFFBQVEsWUFBWSxRQUFRLE1BQU0sRUFBRSxNQUFNLFlBQVksQ0FBQztBQUM5RCxZQUFNO0FBQUEsSUFDUCxDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSyxvREFBb0QsWUFBWTtBQUNwRSxVQUFNLEVBQUUsU0FBUyxhQUFhLFNBQVMsS0FBSyxJQUFJLHFCQUEyQjtBQUUzRSxVQUFNLGNBQWM7QUFFcEIsVUFBTSxTQUFTLGlCQUFpQixFQUFFO0FBQ2xDLGdCQUFZLElBQUksSUFBSSxvQkFBb0IsUUFBUSxRQUFRLENBQUM7QUFFekQsUUFBSSxjQUFjO0FBQ2xCLGdCQUFZLElBQUksU0FBUyxTQUFTLGtCQUFrQixJQUFJLE1BQWlEO0FBQUEsTUFBakQ7QUFDdkQsOENBQWlDLENBQUMsV0FBVztBQUM3QyxnREFBbUMsQ0FBQztBQUFBO0FBQUEsTUFFcEMscUJBQXFCLFFBQW9CLFdBQXFCLFFBQTJCLFNBQWlIO0FBQ3pNLFVBQUU7QUFDRixZQUFJO0FBQ0gsY0FBSSxnQkFBZ0IsR0FBRztBQUN0QixtQkFBTyxZQUFZLFFBQVEsYUFBYSxVQUFVLHlCQUF5QixnQkFBZ0I7QUFDM0YsbUJBQU8sWUFBWSxRQUFRLGtCQUFrQixXQUFXO0FBQ3hELG1CQUFPLFlBQVksUUFBUSxhQUFhLEtBQUs7QUFDN0MsbUJBQU8sWUFBWSxRQUFRLHFCQUFxQixNQUFTO0FBR3pELHVCQUFXLE1BQU0sT0FBTyxRQUFRLFlBQVksUUFBUSxNQUFNLEVBQUUsTUFBTSxZQUFZLENBQUMsR0FBRyxDQUFDO0FBQUEsVUFDcEYsT0FBTztBQUNOLG1CQUFPLFlBQVksYUFBYSxDQUFDO0FBQ2pDLG1CQUFPLFlBQVksUUFBUSxhQUFhLFVBQVUseUJBQXlCLGdCQUFnQjtBQUMzRixtQkFBTyxZQUFZLFFBQVEsYUFBYSxJQUFJO0FBQzVDLG1CQUFPLFlBQVksUUFBUSxrQkFBa0IsV0FBVztBQUN4RCxtQkFBTyxZQUFZLFFBQVEscUJBQXFCLFlBQVk7QUFFNUQsaUJBQUs7QUFBQSxVQUNOO0FBQ0EsaUJBQU87QUFBQSxRQUNSLFNBQVMsS0FBSztBQUNiLGtCQUFRLE1BQU0sR0FBRztBQUNqQixnQkFBTTtBQUFBLFFBQ1A7QUFBQSxNQUNEO0FBQUEsSUFDRCxHQUFDLENBQUM7QUFFRixVQUFNLG1CQUFtQixFQUFFLGVBQWUsS0FBSyxHQUFHLFlBQVk7QUFDN0QsYUFBTyxRQUFRLFlBQVksUUFBUSxNQUFNLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFDOUQsWUFBTTtBQUFBLElBQ1AsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUsseUVBQXlFLFlBQVk7QUFDekYsVUFBTSxFQUFFLFNBQVMsYUFBYSxTQUFTLEtBQUssSUFBSSxxQkFBMkI7QUFFM0UsVUFBTSxjQUFjO0FBRXBCLFVBQU0sU0FBUyxpQkFBaUIsRUFBRTtBQUNsQyxVQUFNLFlBQVksWUFBWSxJQUFJLElBQUksb0JBQW9CLFFBQVEsUUFBUSxDQUFDO0FBRTNFLFFBQUksY0FBYztBQUNsQixnQkFBWSxJQUFJLFNBQVMsU0FBUyxrQkFBa0IsSUFBSSxNQUFpRDtBQUFBLE1BQWpEO0FBQ3ZELDhDQUFpQyxDQUFDLFdBQVc7QUFDN0MsZ0RBQW1DLENBQUM7QUFBQTtBQUFBLE1BRXBDLHFCQUFxQixRQUFvQixXQUFxQixRQUEyQixTQUFpSDtBQUN6TSxZQUFJO0FBQ0gsWUFBRTtBQUNGLGNBQUksZ0JBQWdCLEdBQUc7QUFDdEIsbUJBQU8sWUFBWSxRQUFRLGFBQWEsVUFBVSx5QkFBeUIsZ0JBQWdCO0FBQzNGLG1CQUFPLFlBQVksUUFBUSxrQkFBa0IsV0FBVztBQUN4RCxtQkFBTyxZQUFZLFFBQVEsYUFBYSxLQUFLO0FBQzdDLG1CQUFPLFlBQVksUUFBUSxxQkFBcUIsTUFBUztBQUd6RCxzQkFBVSxPQUFPO0FBQ2pCLG1CQUFPLFFBQVEsWUFBWSxRQUFRLE1BQU0sRUFBRSxNQUFNLFlBQVksQ0FBQztBQUFBLFVBQy9ELE9BQU87QUFDTixtQkFBTyxZQUFZLGFBQWEsQ0FBQztBQUNqQyxtQkFBTyxZQUFZLFFBQVEsYUFBYSxVQUFVLHlCQUF5QixnQkFBZ0I7QUFDM0YsbUJBQU8sWUFBWSxRQUFRLGtCQUFrQixXQUFXO0FBQ3hELG1CQUFPLFlBQVksUUFBUSxhQUFhLElBQUk7QUFDNUMsbUJBQU8sWUFBWSxRQUFRLHFCQUFxQixNQUFTO0FBQ3pELGlCQUFLO0FBQUEsVUFDTjtBQUNBLGlCQUFPO0FBQUEsUUFDUixTQUFTLEtBQUs7QUFDYixrQkFBUSxNQUFNLEdBQUc7QUFDakIsZ0JBQU07QUFBQSxRQUNQO0FBQUEsTUFDRDtBQUFBLElBQ0QsR0FBQyxDQUFDO0FBRUYsVUFBTSxtQkFBbUIsRUFBRSxlQUFlLEtBQUssR0FBRyxNQUFNO0FBQ3ZELGFBQU8sUUFBUSxZQUFZLFFBQVEsTUFBTSxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQzlELGFBQU87QUFBQSxJQUNSLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLHFHQUFxRyxZQUFZO0FBQ3JILFVBQU0sRUFBRSxTQUFTLGFBQWEsU0FBUyxLQUFLLElBQUkscUJBQTJCO0FBRTNFLFVBQU0sU0FBUyxpQkFBaUIsRUFBRTtBQUNsQyxnQkFBWSxJQUFJLElBQUksb0JBQW9CLFFBQVEsVUFBVSxDQUFDLENBQUM7QUFFNUQsUUFBSSxjQUFjO0FBQ2xCLGdCQUFZLElBQUksU0FBUyxTQUFTLGtCQUFrQixJQUFJLE1BQWlEO0FBQUEsTUFBakQ7QUFDdkQsOENBQWlDLENBQUMsS0FBSyxLQUFLLEdBQUc7QUFDL0MsZ0RBQW1DLENBQUM7QUFBQTtBQUFBLE1BRXBDLHFCQUFxQixRQUFvQixXQUFxQixRQUEyQixTQUF5QztBQUNqSSxZQUFJO0FBQ0gsWUFBRTtBQUVGLGlCQUFPLFlBQVksUUFBUSxhQUFhLFVBQVUseUJBQXlCLGdCQUFnQjtBQUMzRixpQkFBTyxZQUFZLFFBQVEsYUFBYSxLQUFLO0FBQzdDLGlCQUFPLFlBQVksUUFBUSxrQkFBa0IsR0FBRztBQUdoRCxxQkFBVyxNQUFNO0FBQ2hCLG1CQUFPLFlBQVksYUFBYSxDQUFDO0FBRWpDLGlCQUFLO0FBQUEsVUFDTixHQUFHLEVBQUU7QUFDTCxpQkFBTztBQUFBLFFBQ1IsU0FBUyxLQUFLO0FBQ2Isa0JBQVEsTUFBTSxHQUFHO0FBQ2pCLGdCQUFNO0FBQUEsUUFDUDtBQUFBLE1BQ0Q7QUFBQSxJQUNELEdBQUMsQ0FBQztBQUVGLFVBQU0sbUJBQW1CLEVBQUUsZUFBZSxLQUFLLEdBQUcsWUFBWTtBQUM3RCxhQUFPLFFBQVEsWUFBWSxRQUFRLE1BQU0sRUFBRSxNQUFNLElBQUksQ0FBQztBQUN0RCxhQUFPLFFBQVEsWUFBWSxRQUFRLE1BQU0sRUFBRSxNQUFNLElBQUksQ0FBQztBQUN0RCxhQUFPLFFBQVEsWUFBWSxRQUFRLE1BQU0sRUFBRSxNQUFNLElBQUksQ0FBQztBQUV0RCxZQUFNO0FBQUEsSUFDUCxDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSyxvREFBb0QsWUFBWTtBQUNwRSxVQUFNLEVBQUUsU0FBUyxhQUFhLFNBQVMsS0FBSyxJQUFJLHFCQUEyQjtBQUUzRSxVQUFNLFNBQVMsaUJBQWlCLEVBQUU7QUFDbEMsZ0JBQVksSUFBSSxJQUFJLG9CQUFvQixRQUFRLFVBQVUsQ0FBQyxDQUFDO0FBRTVELFFBQUksY0FBYztBQUVsQixnQkFBWSxJQUFJLFNBQVMsU0FBUyxrQkFBa0IsSUFBSSxNQUFpRDtBQUFBLE1BQWpEO0FBQ3ZELDhDQUFpQyxDQUFDLEtBQUssR0FBRztBQUMxQyxnREFBbUMsQ0FBQztBQUFBO0FBQUEsTUFFcEMscUJBQXFCLFFBQW9CLFdBQXFCLFFBQTJCLFNBQWlIO0FBQ3pNLFlBQUk7QUFDSCxZQUFFO0FBQ0YsY0FBSSxnQkFBZ0IsR0FBRztBQUN0QixtQkFBTyxZQUFZLFFBQVEsYUFBYSxVQUFVLHlCQUF5QixnQkFBZ0I7QUFDM0YsbUJBQU8sWUFBWSxRQUFRLGtCQUFrQixHQUFHO0FBR2hELHVCQUFXLE1BQU0sT0FBTyxRQUFRLFlBQVksUUFBUSxNQUFNLEVBQUUsTUFBTSxJQUFJLENBQUMsR0FBRyxFQUFFO0FBQUEsVUFDN0UsV0FBVyxnQkFBZ0IsR0FBRztBQUM3QixtQkFBTyxZQUFZLFFBQVEsYUFBYSxVQUFVLHlCQUF5QixnQkFBZ0I7QUFDM0YsbUJBQU8sR0FBRyxRQUFRLFdBQVc7QUFDN0IsbUJBQU8sWUFBWSxRQUFRLGtCQUFrQixHQUFHO0FBQ2hELGlCQUFLO0FBQUEsVUFDTixPQUFPO0FBQ04sbUJBQU8sS0FBSyxtQkFBbUI7QUFBQSxVQUNoQztBQUVBLGlCQUFPO0FBQUEsUUFDUixTQUFTLEtBQUs7QUFDYixrQkFBUSxNQUFNLEdBQUc7QUFDakIsZ0JBQU07QUFBQSxRQUNQO0FBQUEsTUFDRDtBQUFBLElBQ0QsR0FBQyxDQUFDO0FBRUYsVUFBTSxtQkFBbUIsRUFBRSxlQUFlLEtBQUssR0FBRyxNQUFNO0FBQ3ZELGFBQU8sUUFBUSxZQUFZLFFBQVEsTUFBTSxFQUFFLE1BQU0sSUFBSSxDQUFDO0FBQ3RELGFBQU87QUFBQSxJQUNSLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLDREQUE0RCxZQUFZO0FBRTVFLFVBQU0sU0FBUyxpQkFBaUIsU0FBUztBQUN6QyxVQUFNLGFBQWEsWUFBWSxJQUFJLElBQUksb0JBQW9CLFFBQVEsUUFBUSxDQUFDO0FBRTVFLFFBQUksMkJBQTJCO0FBQy9CLFFBQUksY0FBYztBQUNsQixVQUFNLHNCQUFzQixJQUFJLE1BQWlEO0FBQUEsTUFBakQ7QUFDL0IsOENBQWlDLENBQUM7QUFDbEMsZ0RBQW1DLENBQUM7QUFBQTtBQUFBLE1BR3BDLHFCQUFxQixRQUFvQixXQUFxQixPQUFrRztBQUMvSixZQUFJO0FBQ0gsZ0JBQU0sUUFBUTtBQUNkLHNCQUFZLElBQUksTUFBTSx3QkFBd0IsTUFBTTtBQUFFLHVDQUEyQjtBQUFBLFVBQU8sQ0FBQyxDQUFDO0FBRzFGLGNBQUksVUFBVSxHQUFHO0FBQ2hCLHVCQUFXLFFBQVEsRUFBRSxhQUFhLFVBQVUseUJBQXlCLE9BQU8sR0FBRyxDQUFDO0FBQUEsVUFDakY7QUFFQSxpQkFBTyxJQUFJLFFBQXVDLGFBQVc7QUFDNUQsdUJBQVcsTUFBTTtBQUNoQixzQkFBUTtBQUFBLGdCQUNQLE9BQU87QUFBQSxrQkFDTixZQUFZLENBQUM7QUFBQSxvQkFDWixPQUFPLEtBQUs7QUFBQSxvQkFDWixZQUFZLENBQUM7QUFBQSxrQkFDZCxDQUFDO0FBQUEsa0JBQ0QsaUJBQWlCO0FBQUEsa0JBQ2pCLGlCQUFpQjtBQUFBLGdCQUNsQjtBQUFBLGdCQUNBLFNBQVMsTUFBTTtBQUFBLGdCQUFFO0FBQUEsY0FDbEIsQ0FBQztBQUFBLFlBQ0YsR0FBRyxHQUFHO0FBQUEsVUFDUCxDQUFDO0FBQUEsUUFDRixTQUFTLEtBQUs7QUFDYixrQkFBUSxNQUFNLEdBQUc7QUFDakIsZ0JBQU07QUFBQSxRQUNQO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFFQSxnQkFBWSxJQUFJLFNBQVMsU0FBUyxrQkFBa0IsbUJBQW1CLENBQUM7QUFFeEUsVUFBTSxtQkFBbUIsRUFBRSxlQUFlLEtBQUssR0FBRyxZQUFZO0FBRTdELGlCQUFXLFFBQVEsRUFBRSxhQUFhLFVBQVUseUJBQXlCLE9BQU8sR0FBRyxDQUFDO0FBQ2hGLGFBQU8sWUFBWSxJQUFJLHdCQUF3QjtBQUUvQyxhQUFPLElBQUksUUFBYyxDQUFDLFNBQVMsV0FDbEMsWUFBWSxJQUFJLFdBQVcsZUFBZSxzQkFBb0I7QUFDN0QsWUFBSTtBQUNILGlCQUFPLFlBQVksR0FBRyx3QkFBd0I7QUFDOUMsaUJBQU8sWUFBWSxLQUFLLGlCQUFrQixXQUFXLENBQUMsRUFBRSxLQUFLO0FBQzdELGtCQUFRO0FBQUEsUUFDVCxTQUFTLEdBQUc7QUFDWCxpQkFBTyxDQUFDO0FBQUEsUUFDVDtBQUFBLE1BQ0QsQ0FBQyxDQUFDLENBQUM7QUFBQSxJQUNMLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLHlEQUF5RCxZQUFZO0FBQ3pFLFVBQU0sRUFBRSxTQUFTLGFBQWEsU0FBUyxLQUFLLElBQUkscUJBQTJCO0FBRTNFLFVBQU0sY0FBYztBQUNwQixVQUFNLGdCQUFnQjtBQUV0QixVQUFNLFNBQVMsaUJBQWlCLEVBQUU7QUFDbEMsZ0JBQVksSUFBSSxJQUFJLG9CQUFvQixRQUFRLFVBQVUsQ0FBQyxDQUFDO0FBRTVELFFBQUksY0FBYztBQUNsQixnQkFBWSxJQUFJLFNBQVMsU0FBUyxrQkFBa0IsSUFBSSxNQUFpRDtBQUFBLE1BQWpEO0FBQ3ZELDhDQUFpQyxDQUFDLFdBQVc7QUFDN0MsZ0RBQW1DLENBQUMsYUFBYTtBQUFBO0FBQUEsTUFFakQscUJBQXFCLFFBQW9CLFdBQXFCLFFBQTJCLFNBQWlIO0FBQ3pNLFlBQUk7QUFDSCxZQUFFO0FBQ0YsY0FBSSxnQkFBZ0IsR0FBRztBQUN0QixtQkFBTyxZQUFZLFFBQVEsYUFBYSxVQUFVLHlCQUF5QixnQkFBZ0I7QUFDM0YsbUJBQU8sWUFBWSxRQUFRLGtCQUFrQixXQUFXO0FBR3hELHVCQUFXLE1BQU0sT0FBTyxRQUFRLFlBQVksUUFBUSxNQUFNLEVBQUUsTUFBTSxjQUFjLENBQUMsR0FBRyxFQUFFO0FBQUEsVUFDdkYsV0FBVyxnQkFBZ0IsR0FBRztBQUM3QixtQkFBTyxZQUFZLFFBQVEsYUFBYSxVQUFVLHlCQUF5QixnQkFBZ0I7QUFDM0YsbUJBQU8sR0FBRyxRQUFRLFdBQVc7QUFDN0IsbUJBQU8sWUFBWSxRQUFRLGtCQUFrQixhQUFhO0FBQzFELGlCQUFLO0FBQUEsVUFDTixPQUFPO0FBQ04sbUJBQU8sS0FBSyxtQkFBbUI7QUFBQSxVQUNoQztBQUVBLGlCQUFPO0FBQUEsUUFDUixTQUFTLEtBQUs7QUFDYixrQkFBUSxNQUFNLEdBQUc7QUFDakIsZ0JBQU07QUFBQSxRQUNQO0FBQUEsTUFDRDtBQUFBLElBQ0QsR0FBQyxDQUFDO0FBRUYsVUFBTSxtQkFBbUIsRUFBRSxlQUFlLEtBQUssR0FBRyxZQUFZO0FBRTdELGFBQU8sUUFBUSxZQUFZLFFBQVEsTUFBTSxFQUFFLE1BQU0sY0FBYyxDQUFDO0FBR2hFLGFBQU8sUUFBUSxZQUFZLFFBQVEsTUFBTSxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRTlELGFBQU87QUFBQSxJQUNSLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLG1EQUFtRCxZQUFZO0FBQ25FLFVBQU0sY0FBYztBQUNwQixVQUFNLGtCQUFrQjtBQUN4QixVQUFNLG1CQUFtQjtBQUN6QixVQUFNLGdCQUFnQjtBQUV0QixVQUFNLFNBQVMsaUJBQWlCLEVBQUU7QUFDbEMsVUFBTSxRQUFRLFlBQVksSUFBSSxJQUFJLG9CQUFvQixRQUFRLFVBQVUsQ0FBQyxDQUFDO0FBRTFFLGdCQUFZLElBQUksU0FBUyxTQUFTLGtCQUFrQixJQUFJLE1BQWlEO0FBQUEsTUFBakQ7QUFDdkQsOENBQWlDLENBQUMsV0FBVztBQUM3QyxnREFBbUMsQ0FBQztBQUFBO0FBQUEsTUFFcEMsTUFBTSxxQkFBcUIsUUFBb0IsV0FBcUIsUUFBMkIsU0FBNkY7QUFDM0wsWUFBSTtBQUNILGNBQUksQ0FBQyxRQUFRLGFBQWE7QUFFekIsdUJBQVcsTUFBTSxPQUFPLFFBQVEsWUFBWSxRQUFRLE1BQU0sRUFBRSxNQUFNLFlBQVksQ0FBQyxHQUFHLEVBQUU7QUFFcEYsbUJBQU87QUFBQSxjQUNOLE9BQU87QUFBQSxnQkFDTixpQkFBaUI7QUFBQSxnQkFDakIsaUJBQWlCO0FBQUEsZ0JBQ2pCLFlBQVksQ0FBQztBQUFBLGtCQUNaLE9BQU87QUFBQSxrQkFDUCxZQUFZO0FBQUEsb0JBQ1gsRUFBRSxPQUFPLGNBQWM7QUFBQSxrQkFDeEI7QUFBQSxnQkFDRCxDQUFDO0FBQUEsY0FDRjtBQUFBLGNBQ0EsU0FBUyxNQUFNO0FBQUEsY0FBRTtBQUFBLFlBQ2xCO0FBQUEsVUFDRDtBQUVBLGlCQUFPO0FBQUEsUUFDUixTQUFTLEtBQUs7QUFDYixrQkFBUSxNQUFNLEdBQUc7QUFDakIsZ0JBQU07QUFBQSxRQUNQO0FBQUEsTUFDRDtBQUFBLElBQ0QsR0FBQyxDQUFDO0FBRUYsZ0JBQVksSUFBSSxTQUFTLFNBQVMsa0JBQWtCLElBQUksTUFBaUQ7QUFBQSxNQUFqRDtBQUN2RCw4Q0FBaUMsQ0FBQyxXQUFXO0FBQzdDLGdEQUFtQyxDQUFDO0FBQUE7QUFBQSxNQUVwQyxNQUFNLHFCQUFxQixRQUFvQixXQUFxQixRQUEyQixTQUE2RjtBQUMzTCxZQUFJLFFBQVEsYUFBYTtBQUN4QixpQkFBTztBQUFBLFlBQ04sT0FBTztBQUFBLGNBQ04saUJBQWlCO0FBQUEsY0FDakIsaUJBQWlCLFFBQVEsc0JBQXNCLFFBQVEsb0JBQW9CLGtCQUFrQixJQUFJO0FBQUEsY0FDakcsWUFBWSxDQUFDO0FBQUEsZ0JBQ1osT0FBTztBQUFBLGdCQUNQLFlBQVksUUFBUSxzQkFBc0IsUUFBUSxvQkFBb0IsV0FBVyxDQUFDLEVBQUUsYUFBYSxDQUFDO0FBQUEsY0FDbkcsQ0FBQztBQUFBLFlBQ0Y7QUFBQSxZQUNBLFNBQVMsTUFBTTtBQUFBLFlBQUU7QUFBQSxVQUNsQjtBQUFBLFFBQ0Q7QUFFQSxlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0QsR0FBQyxDQUFDO0FBRUYsVUFBTSxtQkFBbUIsRUFBRSxlQUFlLEtBQUssR0FBRyxZQUFZO0FBQzdELGFBQU8sUUFBUSxZQUFZLFFBQVEsTUFBTSxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRTlELFlBQU0sYUFBYSxNQUFNLFlBQVksS0FBSyxHQUFJO0FBQzlDLGFBQU8sWUFBWSxVQUFVLFdBQVcsQ0FBQyxFQUFFLE9BQU8sZUFBZTtBQUNqRSxhQUFPLFlBQVksVUFBVSxpQkFBaUIsQ0FBQztBQUMvQyxhQUFPLFlBQVksVUFBVSxXQUFXLENBQUMsRUFBRSxXQUFXLENBQUMsRUFBRSxPQUFPLGFBQWE7QUFFN0UsWUFBTSxjQUFjLE1BQU0sWUFBWSxLQUFLLEdBQUk7QUFDL0MsYUFBTyxZQUFZLFdBQVcsV0FBVyxDQUFDLEVBQUUsT0FBTyxnQkFBZ0I7QUFDbkUsYUFBTyxZQUFZLFdBQVcsaUJBQWlCLENBQUM7QUFDaEQsYUFBTyxZQUFZLFdBQVcsV0FBVyxDQUFDLEVBQUUsV0FBVyxDQUFDLEVBQUUsT0FBTyxhQUFhO0FBQUEsSUFDL0UsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUssdURBQXVELFlBQVk7QUFDdkUsVUFBTSxTQUFTLGlCQUFpQixFQUFFO0FBQ2xDLFVBQU0sUUFBUSxZQUFZLElBQUksSUFBSSxvQkFBb0IsUUFBUSxVQUFVLEVBQUUsQ0FBQztBQUUzRSxVQUFNLG1CQUFtQjtBQUV6QixRQUFJLGNBQWM7QUFDbEIsZ0JBQVksSUFBSSxTQUFTLFNBQVMsa0JBQWtCLElBQUksTUFBaUQ7QUFBQSxNQUFqRDtBQUN2RCw4Q0FBaUMsQ0FBQyxnQkFBZ0I7QUFDbEQsZ0RBQW1DLENBQUM7QUFBQTtBQUFBLE1BRXBDLHFCQUFxQixRQUFvQixXQUFxQixRQUEyQixTQUFpSDtBQUN6TSxZQUFJO0FBQ0gsWUFBRTtBQUVGLGNBQUksZ0JBQWdCLEdBQUc7QUFDdEIsbUJBQU8sWUFBWSxRQUFRLGFBQWEsVUFBVSx5QkFBeUIsZ0JBQWdCO0FBQzNGLG1CQUFPLFlBQVksUUFBUSxrQkFBa0IsZ0JBQWdCO0FBQUEsVUFDOUQsT0FBTztBQUNOLG1CQUFPLEtBQUssbUJBQW1CO0FBQUEsVUFDaEM7QUFFQSxpQkFBTztBQUFBLFFBQ1IsU0FBUyxLQUFLO0FBQ2Isa0JBQVEsTUFBTSxHQUFHO0FBQ2pCLGdCQUFNO0FBQUEsUUFDUDtBQUFBLE1BQ0Q7QUFBQSxJQUNELEdBQUMsQ0FBQztBQUVGLFVBQU0sbUJBQW1CLEVBQUUsZUFBZSxLQUFLLEdBQUcsWUFBWTtBQUM3RCxhQUFPLFFBQVEsWUFBWSxRQUFRLE1BQU0sRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQ25FLGFBQU8sUUFBUSxZQUFZLFFBQVEsTUFBTSxFQUFFLE1BQU0sSUFBSSxDQUFDO0FBRXRELFlBQU0sWUFBWSxLQUFLO0FBQUEsSUFDeEIsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUssb0dBQW9HLFlBQVk7QUFDcEgsVUFBTSxFQUFFLFNBQVMsYUFBYSxTQUFTLEtBQUssSUFBSSxxQkFBMkI7QUFFM0UsVUFBTSxTQUFTLGlCQUFpQixFQUFFO0FBQ2xDLFVBQU0sUUFBUSxZQUFZLElBQUksSUFBSSxvQkFBb0IsUUFBUSxVQUFVLEVBQUUsQ0FBQztBQUUzRSxVQUFNLG1CQUFtQjtBQUN6QixVQUFNLHFCQUFxQjtBQUUzQixRQUFJLGNBQWM7QUFDbEIsZ0JBQVksSUFBSSxTQUFTLFNBQVMsa0JBQWtCLElBQUksTUFBaUQ7QUFBQSxNQUFqRDtBQUN2RCw4Q0FBaUMsQ0FBQyxnQkFBZ0I7QUFDbEQsZ0RBQW1DLENBQUMsa0JBQWtCO0FBQUE7QUFBQSxNQUV0RCxNQUFNLHFCQUFxQixRQUFvQixXQUFxQixRQUEyQixTQUFpRjtBQUMvSyxZQUFJO0FBQ0gsWUFBRTtBQUVGLGNBQUksZ0JBQWdCLEdBQUc7QUFDdEIsbUJBQU8sWUFBWSxRQUFRLGFBQWEsVUFBVSx5QkFBeUIsZ0JBQWdCO0FBQzNGLG1CQUFPLFlBQVksUUFBUSxrQkFBa0IsZ0JBQWdCO0FBQzdELHVCQUFXLE1BQU0sT0FBTyxRQUFRLFlBQVksUUFBUSxNQUFNLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQyxHQUFHLEVBQUU7QUFBQSxVQUM1RixXQUFXLGdCQUFnQixHQUFHO0FBRTdCLHVCQUFXLE1BQU0sT0FBTyxRQUFRLFlBQVksUUFBUSxNQUFNLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQyxHQUFHLEVBQUU7QUFDM0Ysa0JBQU0sSUFBSSxRQUFRLGFBQVcsV0FBVyxTQUFTLEdBQUksQ0FBQztBQUFBLFVBQ3ZELFdBQVcsZ0JBQWdCLEdBQUc7QUFFN0IsbUJBQU8sWUFBWSxRQUFRLHFCQUFxQixZQUFZO0FBQzVELGlCQUFLO0FBQUEsVUFDTixPQUFPO0FBQ04sbUJBQU8sS0FBSyxtQkFBbUI7QUFBQSxVQUNoQztBQUVBLGlCQUFPO0FBQUEsUUFDUixTQUFTLEtBQUs7QUFDYixrQkFBUSxNQUFNLEdBQUc7QUFDakIsZUFBSyxHQUFHO0FBQ1IsZ0JBQU07QUFBQSxRQUNQO0FBQUEsTUFDRDtBQUFBLElBQ0QsR0FBQyxDQUFDO0FBRUYsVUFBTSxtQkFBbUIsRUFBRSxlQUFlLEtBQUssR0FBRyxZQUFZO0FBRTdELGFBQU8sUUFBUSxZQUFZLFFBQVEsTUFBTSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFFbkUsWUFBTSxZQUFZLEtBQUs7QUFDdkIsWUFBTSxZQUFZLEtBQUs7QUFFdkIsWUFBTTtBQUFBLElBQ1AsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
