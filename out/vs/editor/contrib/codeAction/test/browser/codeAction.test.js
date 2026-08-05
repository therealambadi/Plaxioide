import assert from "assert";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { HierarchicalKind } from "../../../../../base/common/hierarchicalKind.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { URI } from "../../../../../base/common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { Range } from "../../../../common/core/range.js";
import { LanguageFeatureRegistry } from "../../../../common/languageFeatureRegistry.js";
import * as languages from "../../../../common/languages.js";
import { getCodeActions } from "../../browser/codeAction.js";
import { CodeActionItem, CodeActionKind, CodeActionTriggerSource } from "../../common/types.js";
import { createTextModel } from "../../../../test/common/testTextModel.js";
import { MarkerSeverity } from "../../../../../platform/markers/common/markers.js";
import { Progress } from "../../../../../platform/progress/common/progress.js";
function staticCodeActionProvider(...actions) {
  return new class {
    provideCodeActions() {
      return {
        actions,
        dispose: () => {
        }
      };
    }
  }();
}
suite("CodeAction", () => {
  const langId = "fooLang";
  const uri = URI.parse("untitled:path");
  let model;
  let registry;
  const disposables = new DisposableStore();
  const testData = {
    diagnostics: {
      abc: {
        title: "bTitle",
        diagnostics: [{
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 2,
          endColumn: 1,
          severity: MarkerSeverity.Error,
          message: "abc"
        }]
      },
      bcd: {
        title: "aTitle",
        diagnostics: [{
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 2,
          endColumn: 1,
          severity: MarkerSeverity.Error,
          message: "bcd"
        }]
      }
    },
    command: {
      abc: {
        command: new class {
        }(),
        title: 'Extract to inner function in function "test"'
      }
    },
    spelling: {
      bcd: {
        diagnostics: [],
        edit: new class {
        }(),
        title: "abc"
      }
    },
    tsLint: {
      abc: {
        $ident: "funny57",
        arguments: [],
        id: "_internal_command_delegation",
        title: "abc"
      },
      bcd: {
        $ident: "funny47",
        arguments: [],
        id: "_internal_command_delegation",
        title: "bcd"
      }
    }
  };
  setup(() => {
    registry = new LanguageFeatureRegistry();
    disposables.clear();
    model = createTextModel("test1\ntest2\ntest3", langId, void 0, uri);
    disposables.add(model);
  });
  teardown(() => {
    disposables.clear();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("CodeActions are sorted by type, #38623", async () => {
    const provider = staticCodeActionProvider(
      testData.command.abc,
      testData.diagnostics.bcd,
      testData.spelling.bcd,
      testData.tsLint.bcd,
      testData.tsLint.abc,
      testData.diagnostics.abc
    );
    disposables.add(registry.register("fooLang", provider));
    const expected = [
      // CodeActions with a diagnostics array are shown first without further sorting
      new CodeActionItem(testData.diagnostics.bcd, provider),
      new CodeActionItem(testData.diagnostics.abc, provider),
      // CodeActions without diagnostics are shown in the given order without any further sorting
      new CodeActionItem(testData.command.abc, provider),
      new CodeActionItem(testData.spelling.bcd, provider),
      new CodeActionItem(testData.tsLint.bcd, provider),
      new CodeActionItem(testData.tsLint.abc, provider)
    ];
    const { validActions: actions } = disposables.add(await getCodeActions(registry, model, new Range(1, 1, 2, 1), { type: languages.CodeActionTriggerType.Invoke, triggerAction: CodeActionTriggerSource.Default }, Progress.None, CancellationToken.None));
    assert.strictEqual(actions.length, 6);
    assert.deepStrictEqual(actions, expected);
  });
  test("getCodeActions should filter by scope", async () => {
    const provider = staticCodeActionProvider(
      { title: "a", kind: "a" },
      { title: "b", kind: "b" },
      { title: "a.b", kind: "a.b" }
    );
    disposables.add(registry.register("fooLang", provider));
    {
      const { validActions: actions } = disposables.add(await getCodeActions(registry, model, new Range(1, 1, 2, 1), { type: languages.CodeActionTriggerType.Auto, triggerAction: CodeActionTriggerSource.Default, filter: { include: new HierarchicalKind("a") } }, Progress.None, CancellationToken.None));
      assert.strictEqual(actions.length, 2);
      assert.strictEqual(actions[0].action.title, "a");
      assert.strictEqual(actions[1].action.title, "a.b");
    }
    {
      const { validActions: actions } = disposables.add(await getCodeActions(registry, model, new Range(1, 1, 2, 1), { type: languages.CodeActionTriggerType.Auto, triggerAction: CodeActionTriggerSource.Default, filter: { include: new HierarchicalKind("a.b") } }, Progress.None, CancellationToken.None));
      assert.strictEqual(actions.length, 1);
      assert.strictEqual(actions[0].action.title, "a.b");
    }
    {
      const { validActions: actions } = disposables.add(await getCodeActions(registry, model, new Range(1, 1, 2, 1), { type: languages.CodeActionTriggerType.Auto, triggerAction: CodeActionTriggerSource.Default, filter: { include: new HierarchicalKind("a.b.c") } }, Progress.None, CancellationToken.None));
      assert.strictEqual(actions.length, 0);
    }
  });
  test("getCodeActions should forward requested scope to providers", async () => {
    const provider = new class {
      provideCodeActions(_model, _range, context, _token) {
        return {
          actions: [
            { title: context.only || "", kind: context.only }
          ],
          dispose: () => {
          }
        };
      }
    }();
    disposables.add(registry.register("fooLang", provider));
    const { validActions: actions } = disposables.add(await getCodeActions(registry, model, new Range(1, 1, 2, 1), { type: languages.CodeActionTriggerType.Auto, triggerAction: CodeActionTriggerSource.Default, filter: { include: new HierarchicalKind("a") } }, Progress.None, CancellationToken.None));
    assert.strictEqual(actions.length, 1);
    assert.strictEqual(actions[0].action.title, "a");
  });
  test("getCodeActions should not return source code action by default", async () => {
    const provider = staticCodeActionProvider(
      { title: "a", kind: CodeActionKind.Source.value },
      { title: "b", kind: "b" }
    );
    disposables.add(registry.register("fooLang", provider));
    {
      const { validActions: actions } = disposables.add(await getCodeActions(registry, model, new Range(1, 1, 2, 1), { type: languages.CodeActionTriggerType.Auto, triggerAction: CodeActionTriggerSource.SourceAction }, Progress.None, CancellationToken.None));
      assert.strictEqual(actions.length, 1);
      assert.strictEqual(actions[0].action.title, "b");
    }
    {
      const { validActions: actions } = disposables.add(await getCodeActions(registry, model, new Range(1, 1, 2, 1), { type: languages.CodeActionTriggerType.Auto, triggerAction: CodeActionTriggerSource.Default, filter: { include: CodeActionKind.Source, includeSourceActions: true } }, Progress.None, CancellationToken.None));
      assert.strictEqual(actions.length, 1);
      assert.strictEqual(actions[0].action.title, "a");
    }
  });
  test("getCodeActions should support filtering out some requested source code actions #84602", async () => {
    const provider = staticCodeActionProvider(
      { title: "a", kind: CodeActionKind.Source.value },
      { title: "b", kind: CodeActionKind.Source.append("test").value },
      { title: "c", kind: "c" }
    );
    disposables.add(registry.register("fooLang", provider));
    {
      const { validActions: actions } = disposables.add(await getCodeActions(registry, model, new Range(1, 1, 2, 1), {
        type: languages.CodeActionTriggerType.Auto,
        triggerAction: CodeActionTriggerSource.SourceAction,
        filter: {
          include: CodeActionKind.Source.append("test"),
          excludes: [CodeActionKind.Source],
          includeSourceActions: true
        }
      }, Progress.None, CancellationToken.None));
      assert.strictEqual(actions.length, 1);
      assert.strictEqual(actions[0].action.title, "b");
    }
  });
  test("getCodeActions no invoke a provider that has been excluded #84602", async () => {
    const baseType = CodeActionKind.Refactor;
    const subType = CodeActionKind.Refactor.append("sub");
    disposables.add(registry.register("fooLang", staticCodeActionProvider(
      { title: "a", kind: baseType.value }
    )));
    let didInvoke = false;
    disposables.add(registry.register("fooLang", new class {
      constructor() {
        this.providedCodeActionKinds = [subType.value];
      }
      provideCodeActions() {
        didInvoke = true;
        return {
          actions: [
            { title: "x", kind: subType.value }
          ],
          dispose: () => {
          }
        };
      }
    }()));
    {
      const { validActions: actions } = disposables.add(await getCodeActions(registry, model, new Range(1, 1, 2, 1), {
        type: languages.CodeActionTriggerType.Auto,
        triggerAction: CodeActionTriggerSource.Refactor,
        filter: {
          include: baseType,
          excludes: [subType]
        }
      }, Progress.None, CancellationToken.None));
      assert.strictEqual(didInvoke, false);
      assert.strictEqual(actions.length, 1);
      assert.strictEqual(actions[0].action.title, "a");
    }
  });
  test("getCodeActions should not invoke code action providers filtered out by providedCodeActionKinds", async () => {
    let wasInvoked = false;
    const provider = new class {
      constructor() {
        this.providedCodeActionKinds = [CodeActionKind.Refactor.value];
      }
      provideCodeActions() {
        wasInvoked = true;
        return { actions: [], dispose: () => {
        } };
      }
    }();
    disposables.add(registry.register("fooLang", provider));
    const { validActions: actions } = disposables.add(await getCodeActions(registry, model, new Range(1, 1, 2, 1), {
      type: languages.CodeActionTriggerType.Auto,
      triggerAction: CodeActionTriggerSource.Refactor,
      filter: {
        include: CodeActionKind.QuickFix
      }
    }, Progress.None, CancellationToken.None));
    assert.strictEqual(actions.length, 0);
    assert.strictEqual(wasInvoked, false);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9jb2RlQWN0aW9uL3Rlc3QvYnJvd3Nlci9jb2RlQWN0aW9uLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgSGllcmFyY2hpY2FsS2luZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2hpZXJhcmNoaWNhbEtpbmQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgTGFuZ3VhZ2VGZWF0dXJlUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VGZWF0dXJlUmVnaXN0cnkuanMnO1xuaW1wb3J0ICogYXMgbGFuZ3VhZ2VzIGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL21vZGVsL3RleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBnZXRDb2RlQWN0aW9ucyB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29kZUFjdGlvbi5qcyc7XG5pbXBvcnQgeyBDb2RlQWN0aW9uSXRlbSwgQ29kZUFjdGlvbktpbmQsIENvZGVBY3Rpb25UcmlnZ2VyU291cmNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IGNyZWF0ZVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvY29tbW9uL3Rlc3RUZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgSU1hcmtlckRhdGEsIE1hcmtlclNldmVyaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbWFya2Vycy9jb21tb24vbWFya2Vycy5qcyc7XG5pbXBvcnQgeyBQcm9ncmVzcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5cbmZ1bmN0aW9uIHN0YXRpY0NvZGVBY3Rpb25Qcm92aWRlciguLi5hY3Rpb25zOiBsYW5ndWFnZXMuQ29kZUFjdGlvbltdKTogbGFuZ3VhZ2VzLkNvZGVBY3Rpb25Qcm92aWRlciB7XG5cdHJldHVybiBuZXcgY2xhc3MgaW1wbGVtZW50cyBsYW5ndWFnZXMuQ29kZUFjdGlvblByb3ZpZGVyIHtcblx0XHRwcm92aWRlQ29kZUFjdGlvbnMoKTogbGFuZ3VhZ2VzLkNvZGVBY3Rpb25MaXN0IHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGFjdGlvbnM6IGFjdGlvbnMsXG5cdFx0XHRcdGRpc3Bvc2U6ICgpID0+IHsgfVxuXHRcdFx0fTtcblx0XHR9XG5cdH07XG59XG5cblxuc3VpdGUoJ0NvZGVBY3Rpb24nLCAoKSA9PiB7XG5cblx0Y29uc3QgbGFuZ0lkID0gJ2Zvb0xhbmcnO1xuXHRjb25zdCB1cmkgPSBVUkkucGFyc2UoJ3VudGl0bGVkOnBhdGgnKTtcblx0bGV0IG1vZGVsOiBUZXh0TW9kZWw7XG5cdGxldCByZWdpc3RyeTogTGFuZ3VhZ2VGZWF0dXJlUmVnaXN0cnk8bGFuZ3VhZ2VzLkNvZGVBY3Rpb25Qcm92aWRlcj47XG5cdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRjb25zdCB0ZXN0RGF0YSA9IHtcblx0XHRkaWFnbm9zdGljczoge1xuXHRcdFx0YWJjOiB7XG5cdFx0XHRcdHRpdGxlOiAnYlRpdGxlJyxcblx0XHRcdFx0ZGlhZ25vc3RpY3M6IFt7XG5cdFx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiAxLFxuXHRcdFx0XHRcdHN0YXJ0Q29sdW1uOiAxLFxuXHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IDIsXG5cdFx0XHRcdFx0ZW5kQ29sdW1uOiAxLFxuXHRcdFx0XHRcdHNldmVyaXR5OiBNYXJrZXJTZXZlcml0eS5FcnJvcixcblx0XHRcdFx0XHRtZXNzYWdlOiAnYWJjJ1xuXHRcdFx0XHR9XVxuXHRcdFx0fSxcblx0XHRcdGJjZDoge1xuXHRcdFx0XHR0aXRsZTogJ2FUaXRsZScsXG5cdFx0XHRcdGRpYWdub3N0aWNzOiBbe1xuXHRcdFx0XHRcdHN0YXJ0TGluZU51bWJlcjogMSxcblx0XHRcdFx0XHRzdGFydENvbHVtbjogMSxcblx0XHRcdFx0XHRlbmRMaW5lTnVtYmVyOiAyLFxuXHRcdFx0XHRcdGVuZENvbHVtbjogMSxcblx0XHRcdFx0XHRzZXZlcml0eTogTWFya2VyU2V2ZXJpdHkuRXJyb3IsXG5cdFx0XHRcdFx0bWVzc2FnZTogJ2JjZCdcblx0XHRcdFx0fV1cblx0XHRcdH1cblx0XHR9LFxuXHRcdGNvbW1hbmQ6IHtcblx0XHRcdGFiYzoge1xuXHRcdFx0XHRjb21tYW5kOiBuZXcgY2xhc3MgaW1wbGVtZW50cyBsYW5ndWFnZXMuQ29tbWFuZCB7XG5cdFx0XHRcdFx0aWQhOiAnMSc7XG5cdFx0XHRcdFx0dGl0bGUhOiAnYWJjJztcblx0XHRcdFx0fSxcblx0XHRcdFx0dGl0bGU6ICdFeHRyYWN0IHRvIGlubmVyIGZ1bmN0aW9uIGluIGZ1bmN0aW9uIFwidGVzdFwiJ1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0c3BlbGxpbmc6IHtcblx0XHRcdGJjZDoge1xuXHRcdFx0XHRkaWFnbm9zdGljczogPElNYXJrZXJEYXRhW10+W10sXG5cdFx0XHRcdGVkaXQ6IG5ldyBjbGFzcyBpbXBsZW1lbnRzIGxhbmd1YWdlcy5Xb3Jrc3BhY2VFZGl0IHtcblx0XHRcdFx0XHRlZGl0cyE6IGxhbmd1YWdlcy5JV29ya3NwYWNlVGV4dEVkaXRbXTtcblx0XHRcdFx0fSxcblx0XHRcdFx0dGl0bGU6ICdhYmMnXG5cdFx0XHR9XG5cdFx0fSxcblx0XHR0c0xpbnQ6IHtcblx0XHRcdGFiYzoge1xuXHRcdFx0XHQkaWRlbnQ6ICdmdW5ueScgKyA1Nyxcblx0XHRcdFx0YXJndW1lbnRzOiA8SU1hcmtlckRhdGFbXT5bXSxcblx0XHRcdFx0aWQ6ICdfaW50ZXJuYWxfY29tbWFuZF9kZWxlZ2F0aW9uJyxcblx0XHRcdFx0dGl0bGU6ICdhYmMnXG5cdFx0XHR9LFxuXHRcdFx0YmNkOiB7XG5cdFx0XHRcdCRpZGVudDogJ2Z1bm55JyArIDQ3LFxuXHRcdFx0XHRhcmd1bWVudHM6IDxJTWFya2VyRGF0YVtdPltdLFxuXHRcdFx0XHRpZDogJ19pbnRlcm5hbF9jb21tYW5kX2RlbGVnYXRpb24nLFxuXHRcdFx0XHR0aXRsZTogJ2JjZCdcblx0XHRcdH1cblx0XHR9XG5cdH07XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdHJlZ2lzdHJ5ID0gbmV3IExhbmd1YWdlRmVhdHVyZVJlZ2lzdHJ5KCk7XG5cdFx0ZGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHRtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbCgndGVzdDFcXG50ZXN0MlxcbnRlc3QzJywgbGFuZ0lkLCB1bmRlZmluZWQsIHVyaSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG1vZGVsKTtcblx0fSk7XG5cblx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdH0pO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ0NvZGVBY3Rpb25zIGFyZSBzb3J0ZWQgYnkgdHlwZSwgIzM4NjIzJywgYXN5bmMgKCkgPT4ge1xuXG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBzdGF0aWNDb2RlQWN0aW9uUHJvdmlkZXIoXG5cdFx0XHR0ZXN0RGF0YS5jb21tYW5kLmFiYyxcblx0XHRcdHRlc3REYXRhLmRpYWdub3N0aWNzLmJjZCxcblx0XHRcdHRlc3REYXRhLnNwZWxsaW5nLmJjZCxcblx0XHRcdHRlc3REYXRhLnRzTGludC5iY2QsXG5cdFx0XHR0ZXN0RGF0YS50c0xpbnQuYWJjLFxuXHRcdFx0dGVzdERhdGEuZGlhZ25vc3RpY3MuYWJjXG5cdFx0KTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3RyeS5yZWdpc3RlcignZm9vTGFuZycsIHByb3ZpZGVyKSk7XG5cblx0XHRjb25zdCBleHBlY3RlZCA9IFtcblx0XHRcdC8vIENvZGVBY3Rpb25zIHdpdGggYSBkaWFnbm9zdGljcyBhcnJheSBhcmUgc2hvd24gZmlyc3Qgd2l0aG91dCBmdXJ0aGVyIHNvcnRpbmdcblx0XHRcdG5ldyBDb2RlQWN0aW9uSXRlbSh0ZXN0RGF0YS5kaWFnbm9zdGljcy5iY2QsIHByb3ZpZGVyKSxcblx0XHRcdG5ldyBDb2RlQWN0aW9uSXRlbSh0ZXN0RGF0YS5kaWFnbm9zdGljcy5hYmMsIHByb3ZpZGVyKSxcblxuXHRcdFx0Ly8gQ29kZUFjdGlvbnMgd2l0aG91dCBkaWFnbm9zdGljcyBhcmUgc2hvd24gaW4gdGhlIGdpdmVuIG9yZGVyIHdpdGhvdXQgYW55IGZ1cnRoZXIgc29ydGluZ1xuXHRcdFx0bmV3IENvZGVBY3Rpb25JdGVtKHRlc3REYXRhLmNvbW1hbmQuYWJjLCBwcm92aWRlciksXG5cdFx0XHRuZXcgQ29kZUFjdGlvbkl0ZW0odGVzdERhdGEuc3BlbGxpbmcuYmNkLCBwcm92aWRlciksXG5cdFx0XHRuZXcgQ29kZUFjdGlvbkl0ZW0odGVzdERhdGEudHNMaW50LmJjZCwgcHJvdmlkZXIpLFxuXHRcdFx0bmV3IENvZGVBY3Rpb25JdGVtKHRlc3REYXRhLnRzTGludC5hYmMsIHByb3ZpZGVyKVxuXHRcdF07XG5cblx0XHRjb25zdCB7IHZhbGlkQWN0aW9uczogYWN0aW9ucyB9ID0gZGlzcG9zYWJsZXMuYWRkKGF3YWl0IGdldENvZGVBY3Rpb25zKHJlZ2lzdHJ5LCBtb2RlbCwgbmV3IFJhbmdlKDEsIDEsIDIsIDEpLCB7IHR5cGU6IGxhbmd1YWdlcy5Db2RlQWN0aW9uVHJpZ2dlclR5cGUuSW52b2tlLCB0cmlnZ2VyQWN0aW9uOiBDb2RlQWN0aW9uVHJpZ2dlclNvdXJjZS5EZWZhdWx0IH0sIFByb2dyZXNzLk5vbmUsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0aW9ucy5sZW5ndGgsIDYpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0aW9ucywgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdnZXRDb2RlQWN0aW9ucyBzaG91bGQgZmlsdGVyIGJ5IHNjb3BlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHByb3ZpZGVyID0gc3RhdGljQ29kZUFjdGlvblByb3ZpZGVyKFxuXHRcdFx0eyB0aXRsZTogJ2EnLCBraW5kOiAnYScgfSxcblx0XHRcdHsgdGl0bGU6ICdiJywga2luZDogJ2InIH0sXG5cdFx0XHR7IHRpdGxlOiAnYS5iJywga2luZDogJ2EuYicgfVxuXHRcdCk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQocmVnaXN0cnkucmVnaXN0ZXIoJ2Zvb0xhbmcnLCBwcm92aWRlcikpO1xuXG5cdFx0e1xuXHRcdFx0Y29uc3QgeyB2YWxpZEFjdGlvbnM6IGFjdGlvbnMgfSA9IGRpc3Bvc2FibGVzLmFkZChhd2FpdCBnZXRDb2RlQWN0aW9ucyhyZWdpc3RyeSwgbW9kZWwsIG5ldyBSYW5nZSgxLCAxLCAyLCAxKSwgeyB0eXBlOiBsYW5ndWFnZXMuQ29kZUFjdGlvblRyaWdnZXJUeXBlLkF1dG8sIHRyaWdnZXJBY3Rpb246IENvZGVBY3Rpb25UcmlnZ2VyU291cmNlLkRlZmF1bHQsIGZpbHRlcjogeyBpbmNsdWRlOiBuZXcgSGllcmFyY2hpY2FsS2luZCgnYScpIH0gfSwgUHJvZ3Jlc3MuTm9uZSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdGlvbnMubGVuZ3RoLCAyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3Rpb25zWzBdLmFjdGlvbi50aXRsZSwgJ2EnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3Rpb25zWzFdLmFjdGlvbi50aXRsZSwgJ2EuYicpO1xuXHRcdH1cblxuXHRcdHtcblx0XHRcdGNvbnN0IHsgdmFsaWRBY3Rpb25zOiBhY3Rpb25zIH0gPSBkaXNwb3NhYmxlcy5hZGQoYXdhaXQgZ2V0Q29kZUFjdGlvbnMocmVnaXN0cnksIG1vZGVsLCBuZXcgUmFuZ2UoMSwgMSwgMiwgMSksIHsgdHlwZTogbGFuZ3VhZ2VzLkNvZGVBY3Rpb25UcmlnZ2VyVHlwZS5BdXRvLCB0cmlnZ2VyQWN0aW9uOiBDb2RlQWN0aW9uVHJpZ2dlclNvdXJjZS5EZWZhdWx0LCBmaWx0ZXI6IHsgaW5jbHVkZTogbmV3IEhpZXJhcmNoaWNhbEtpbmQoJ2EuYicpIH0gfSwgUHJvZ3Jlc3MuTm9uZSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdGlvbnMubGVuZ3RoLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3Rpb25zWzBdLmFjdGlvbi50aXRsZSwgJ2EuYicpO1xuXHRcdH1cblxuXHRcdHtcblx0XHRcdGNvbnN0IHsgdmFsaWRBY3Rpb25zOiBhY3Rpb25zIH0gPSBkaXNwb3NhYmxlcy5hZGQoYXdhaXQgZ2V0Q29kZUFjdGlvbnMocmVnaXN0cnksIG1vZGVsLCBuZXcgUmFuZ2UoMSwgMSwgMiwgMSksIHsgdHlwZTogbGFuZ3VhZ2VzLkNvZGVBY3Rpb25UcmlnZ2VyVHlwZS5BdXRvLCB0cmlnZ2VyQWN0aW9uOiBDb2RlQWN0aW9uVHJpZ2dlclNvdXJjZS5EZWZhdWx0LCBmaWx0ZXI6IHsgaW5jbHVkZTogbmV3IEhpZXJhcmNoaWNhbEtpbmQoJ2EuYi5jJykgfSB9LCBQcm9ncmVzcy5Ob25lLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0aW9ucy5sZW5ndGgsIDApO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnZ2V0Q29kZUFjdGlvbnMgc2hvdWxkIGZvcndhcmQgcmVxdWVzdGVkIHNjb3BlIHRvIHByb3ZpZGVycycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBwcm92aWRlciA9IG5ldyBjbGFzcyBpbXBsZW1lbnRzIGxhbmd1YWdlcy5Db2RlQWN0aW9uUHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZUNvZGVBY3Rpb25zKF9tb2RlbDogYW55LCBfcmFuZ2U6IFJhbmdlLCBjb250ZXh0OiBsYW5ndWFnZXMuQ29kZUFjdGlvbkNvbnRleHQsIF90b2tlbjogYW55KTogbGFuZ3VhZ2VzLkNvZGVBY3Rpb25MaXN0IHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRhY3Rpb25zOiBbXG5cdFx0XHRcdFx0XHR7IHRpdGxlOiBjb250ZXh0Lm9ubHkgfHwgJycsIGtpbmQ6IGNvbnRleHQub25seSB9XG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRkaXNwb3NlOiAoKSA9PiB7IH1cblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHJlZ2lzdHJ5LnJlZ2lzdGVyKCdmb29MYW5nJywgcHJvdmlkZXIpKTtcblxuXHRcdGNvbnN0IHsgdmFsaWRBY3Rpb25zOiBhY3Rpb25zIH0gPSBkaXNwb3NhYmxlcy5hZGQoYXdhaXQgZ2V0Q29kZUFjdGlvbnMocmVnaXN0cnksIG1vZGVsLCBuZXcgUmFuZ2UoMSwgMSwgMiwgMSksIHsgdHlwZTogbGFuZ3VhZ2VzLkNvZGVBY3Rpb25UcmlnZ2VyVHlwZS5BdXRvLCB0cmlnZ2VyQWN0aW9uOiBDb2RlQWN0aW9uVHJpZ2dlclNvdXJjZS5EZWZhdWx0LCBmaWx0ZXI6IHsgaW5jbHVkZTogbmV3IEhpZXJhcmNoaWNhbEtpbmQoJ2EnKSB9IH0sIFByb2dyZXNzLk5vbmUsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0aW9ucy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3Rpb25zWzBdLmFjdGlvbi50aXRsZSwgJ2EnKTtcblx0fSk7XG5cblx0dGVzdCgnZ2V0Q29kZUFjdGlvbnMgc2hvdWxkIG5vdCByZXR1cm4gc291cmNlIGNvZGUgYWN0aW9uIGJ5IGRlZmF1bHQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBzdGF0aWNDb2RlQWN0aW9uUHJvdmlkZXIoXG5cdFx0XHR7IHRpdGxlOiAnYScsIGtpbmQ6IENvZGVBY3Rpb25LaW5kLlNvdXJjZS52YWx1ZSB9LFxuXHRcdFx0eyB0aXRsZTogJ2InLCBraW5kOiAnYicgfVxuXHRcdCk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQocmVnaXN0cnkucmVnaXN0ZXIoJ2Zvb0xhbmcnLCBwcm92aWRlcikpO1xuXG5cdFx0e1xuXHRcdFx0Y29uc3QgeyB2YWxpZEFjdGlvbnM6IGFjdGlvbnMgfSA9IGRpc3Bvc2FibGVzLmFkZChhd2FpdCBnZXRDb2RlQWN0aW9ucyhyZWdpc3RyeSwgbW9kZWwsIG5ldyBSYW5nZSgxLCAxLCAyLCAxKSwgeyB0eXBlOiBsYW5ndWFnZXMuQ29kZUFjdGlvblRyaWdnZXJUeXBlLkF1dG8sIHRyaWdnZXJBY3Rpb246IENvZGVBY3Rpb25UcmlnZ2VyU291cmNlLlNvdXJjZUFjdGlvbiB9LCBQcm9ncmVzcy5Ob25lLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0aW9ucy5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdGlvbnNbMF0uYWN0aW9uLnRpdGxlLCAnYicpO1xuXHRcdH1cblxuXHRcdHtcblx0XHRcdGNvbnN0IHsgdmFsaWRBY3Rpb25zOiBhY3Rpb25zIH0gPSBkaXNwb3NhYmxlcy5hZGQoYXdhaXQgZ2V0Q29kZUFjdGlvbnMocmVnaXN0cnksIG1vZGVsLCBuZXcgUmFuZ2UoMSwgMSwgMiwgMSksIHsgdHlwZTogbGFuZ3VhZ2VzLkNvZGVBY3Rpb25UcmlnZ2VyVHlwZS5BdXRvLCB0cmlnZ2VyQWN0aW9uOiBDb2RlQWN0aW9uVHJpZ2dlclNvdXJjZS5EZWZhdWx0LCBmaWx0ZXI6IHsgaW5jbHVkZTogQ29kZUFjdGlvbktpbmQuU291cmNlLCBpbmNsdWRlU291cmNlQWN0aW9uczogdHJ1ZSB9IH0sIFByb2dyZXNzLk5vbmUsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3Rpb25zLmxlbmd0aCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0aW9uc1swXS5hY3Rpb24udGl0bGUsICdhJyk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdnZXRDb2RlQWN0aW9ucyBzaG91bGQgc3VwcG9ydCBmaWx0ZXJpbmcgb3V0IHNvbWUgcmVxdWVzdGVkIHNvdXJjZSBjb2RlIGFjdGlvbnMgIzg0NjAyJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHByb3ZpZGVyID0gc3RhdGljQ29kZUFjdGlvblByb3ZpZGVyKFxuXHRcdFx0eyB0aXRsZTogJ2EnLCBraW5kOiBDb2RlQWN0aW9uS2luZC5Tb3VyY2UudmFsdWUgfSxcblx0XHRcdHsgdGl0bGU6ICdiJywga2luZDogQ29kZUFjdGlvbktpbmQuU291cmNlLmFwcGVuZCgndGVzdCcpLnZhbHVlIH0sXG5cdFx0XHR7IHRpdGxlOiAnYycsIGtpbmQ6ICdjJyB9XG5cdFx0KTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3RyeS5yZWdpc3RlcignZm9vTGFuZycsIHByb3ZpZGVyKSk7XG5cblx0XHR7XG5cdFx0XHRjb25zdCB7IHZhbGlkQWN0aW9uczogYWN0aW9ucyB9ID0gZGlzcG9zYWJsZXMuYWRkKGF3YWl0IGdldENvZGVBY3Rpb25zKHJlZ2lzdHJ5LCBtb2RlbCwgbmV3IFJhbmdlKDEsIDEsIDIsIDEpLCB7XG5cdFx0XHRcdHR5cGU6IGxhbmd1YWdlcy5Db2RlQWN0aW9uVHJpZ2dlclR5cGUuQXV0bywgdHJpZ2dlckFjdGlvbjogQ29kZUFjdGlvblRyaWdnZXJTb3VyY2UuU291cmNlQWN0aW9uLCBmaWx0ZXI6IHtcblx0XHRcdFx0XHRpbmNsdWRlOiBDb2RlQWN0aW9uS2luZC5Tb3VyY2UuYXBwZW5kKCd0ZXN0JyksXG5cdFx0XHRcdFx0ZXhjbHVkZXM6IFtDb2RlQWN0aW9uS2luZC5Tb3VyY2VdLFxuXHRcdFx0XHRcdGluY2x1ZGVTb3VyY2VBY3Rpb25zOiB0cnVlLFxuXHRcdFx0XHR9XG5cdFx0XHR9LCBQcm9ncmVzcy5Ob25lLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0aW9ucy5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdGlvbnNbMF0uYWN0aW9uLnRpdGxlLCAnYicpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnZ2V0Q29kZUFjdGlvbnMgbm8gaW52b2tlIGEgcHJvdmlkZXIgdGhhdCBoYXMgYmVlbiBleGNsdWRlZCAjODQ2MDInLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgYmFzZVR5cGUgPSBDb2RlQWN0aW9uS2luZC5SZWZhY3Rvcjtcblx0XHRjb25zdCBzdWJUeXBlID0gQ29kZUFjdGlvbktpbmQuUmVmYWN0b3IuYXBwZW5kKCdzdWInKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3RyeS5yZWdpc3RlcignZm9vTGFuZycsIHN0YXRpY0NvZGVBY3Rpb25Qcm92aWRlcihcblx0XHRcdHsgdGl0bGU6ICdhJywga2luZDogYmFzZVR5cGUudmFsdWUgfVxuXHRcdCkpKTtcblxuXHRcdGxldCBkaWRJbnZva2UgPSBmYWxzZTtcblx0XHRkaXNwb3NhYmxlcy5hZGQocmVnaXN0cnkucmVnaXN0ZXIoJ2Zvb0xhbmcnLCBuZXcgY2xhc3MgaW1wbGVtZW50cyBsYW5ndWFnZXMuQ29kZUFjdGlvblByb3ZpZGVyIHtcblxuXHRcdFx0cHJvdmlkZWRDb2RlQWN0aW9uS2luZHMgPSBbc3ViVHlwZS52YWx1ZV07XG5cblx0XHRcdHByb3ZpZGVDb2RlQWN0aW9ucygpOiBsYW5ndWFnZXMuUHJvdmlkZXJSZXN1bHQ8bGFuZ3VhZ2VzLkNvZGVBY3Rpb25MaXN0PiB7XG5cdFx0XHRcdGRpZEludm9rZSA9IHRydWU7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0YWN0aW9uczogW1xuXHRcdFx0XHRcdFx0eyB0aXRsZTogJ3gnLCBraW5kOiBzdWJUeXBlLnZhbHVlIH1cblx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdGRpc3Bvc2U6ICgpID0+IHsgfVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHtcblx0XHRcdGNvbnN0IHsgdmFsaWRBY3Rpb25zOiBhY3Rpb25zIH0gPSBkaXNwb3NhYmxlcy5hZGQoYXdhaXQgZ2V0Q29kZUFjdGlvbnMocmVnaXN0cnksIG1vZGVsLCBuZXcgUmFuZ2UoMSwgMSwgMiwgMSksIHtcblx0XHRcdFx0dHlwZTogbGFuZ3VhZ2VzLkNvZGVBY3Rpb25UcmlnZ2VyVHlwZS5BdXRvLCB0cmlnZ2VyQWN0aW9uOiBDb2RlQWN0aW9uVHJpZ2dlclNvdXJjZS5SZWZhY3RvciwgZmlsdGVyOiB7XG5cdFx0XHRcdFx0aW5jbHVkZTogYmFzZVR5cGUsXG5cdFx0XHRcdFx0ZXhjbHVkZXM6IFtzdWJUeXBlXSxcblx0XHRcdFx0fVxuXHRcdFx0fSwgUHJvZ3Jlc3MuTm9uZSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpZEludm9rZSwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdGlvbnMubGVuZ3RoLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3Rpb25zWzBdLmFjdGlvbi50aXRsZSwgJ2EnKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2dldENvZGVBY3Rpb25zIHNob3VsZCBub3QgaW52b2tlIGNvZGUgYWN0aW9uIHByb3ZpZGVycyBmaWx0ZXJlZCBvdXQgYnkgcHJvdmlkZWRDb2RlQWN0aW9uS2luZHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0bGV0IHdhc0ludm9rZWQgPSBmYWxzZTtcblx0XHRjb25zdCBwcm92aWRlciA9IG5ldyBjbGFzcyBpbXBsZW1lbnRzIGxhbmd1YWdlcy5Db2RlQWN0aW9uUHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZUNvZGVBY3Rpb25zKCk6IGxhbmd1YWdlcy5Db2RlQWN0aW9uTGlzdCB7XG5cdFx0XHRcdHdhc0ludm9rZWQgPSB0cnVlO1xuXHRcdFx0XHRyZXR1cm4geyBhY3Rpb25zOiBbXSwgZGlzcG9zZTogKCkgPT4geyB9IH07XG5cdFx0XHR9XG5cblx0XHRcdHByb3ZpZGVkQ29kZUFjdGlvbktpbmRzID0gW0NvZGVBY3Rpb25LaW5kLlJlZmFjdG9yLnZhbHVlXTtcblx0XHR9O1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHJlZ2lzdHJ5LnJlZ2lzdGVyKCdmb29MYW5nJywgcHJvdmlkZXIpKTtcblxuXHRcdGNvbnN0IHsgdmFsaWRBY3Rpb25zOiBhY3Rpb25zIH0gPSBkaXNwb3NhYmxlcy5hZGQoYXdhaXQgZ2V0Q29kZUFjdGlvbnMocmVnaXN0cnksIG1vZGVsLCBuZXcgUmFuZ2UoMSwgMSwgMiwgMSksIHtcblx0XHRcdHR5cGU6IGxhbmd1YWdlcy5Db2RlQWN0aW9uVHJpZ2dlclR5cGUuQXV0bywgdHJpZ2dlckFjdGlvbjogQ29kZUFjdGlvblRyaWdnZXJTb3VyY2UuUmVmYWN0b3IsXG5cdFx0XHRmaWx0ZXI6IHtcblx0XHRcdFx0aW5jbHVkZTogQ29kZUFjdGlvbktpbmQuUXVpY2tGaXhcblx0XHRcdH1cblx0XHR9LCBQcm9ncmVzcy5Ob25lLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdGlvbnMubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod2FzSW52b2tlZCwgZmFsc2UpO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBSUEsT0FBTyxZQUFZO0FBQ25CLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsV0FBVztBQUNwQixTQUFTLCtDQUErQztBQUN4RCxTQUFTLGFBQWE7QUFDdEIsU0FBUywrQkFBK0I7QUFDeEMsWUFBWSxlQUFlO0FBRTNCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsZ0JBQWdCLGdCQUFnQiwrQkFBK0I7QUFDeEUsU0FBUyx1QkFBdUI7QUFDaEMsU0FBc0Isc0JBQXNCO0FBQzVDLFNBQVMsZ0JBQWdCO0FBRXpCLFNBQVMsNEJBQTRCLFNBQStEO0FBQ25HLFNBQU8sSUFBSSxNQUE4QztBQUFBLElBQ3hELHFCQUErQztBQUM5QyxhQUFPO0FBQUEsUUFDTjtBQUFBLFFBQ0EsU0FBUyxNQUFNO0FBQUEsUUFBRTtBQUFBLE1BQ2xCO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFDRDtBQUdBLE1BQU0sY0FBYyxNQUFNO0FBRXpCLFFBQU0sU0FBUztBQUNmLFFBQU0sTUFBTSxJQUFJLE1BQU0sZUFBZTtBQUNyQyxN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
