import assert from "assert";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { Event } from "../../../../../base/common/event.js";
import { mock } from "../../../../../base/test/common/mock.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { TestDiffProviderFactoryService } from "../../../../../editor/test/browser/diff/testDiffProviderFactoryService.js";
import { IDiffProviderFactoryService } from "../../../../../editor/browser/widget/diffEditor/diffProviderFactoryService.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { instantiateTestCodeEditor } from "../../../../../editor/test/browser/testCodeEditor.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { SyncDescriptor } from "../../../../../platform/instantiation/common/descriptors.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { MockContextKeyService } from "../../../../../platform/keybinding/test/common/mockKeybindingService.js";
import { IEditorProgressService } from "../../../../../platform/progress/common/progress.js";
import { IViewDescriptorService } from "../../../../common/views.js";
import { IChatAccessibilityService, IChatWidgetService } from "../../../chat/browser/chat.js";
import { HunkState } from "../../browser/inlineChatSession.js";
import { IInlineChatSessionService } from "../../browser/inlineChatSessionService.js";
import { InlineChatSessionServiceImpl } from "../../browser/inlineChatSessionServiceImpl.js";
import { workbenchInstantiationService } from "../../../../test/browser/workbenchTestServices.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { assertType } from "../../../../../base/common/types.js";
import { EditOperation } from "../../../../../editor/common/core/editOperation.js";
import { Position } from "../../../../../editor/common/core/position.js";
import { IEditorWorkerService } from "../../../../../editor/common/services/editorWorker.js";
import { TestWorkerService } from "./testWorkerService.js";
import { IExtensionService, nullExtensionDescription } from "../../../../services/extensions/common/extensions.js";
import { ILogService, NullLogService } from "../../../../../platform/log/common/log.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { NullTelemetryService } from "../../../../../platform/telemetry/common/telemetryUtils.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { ChatWidgetService } from "../../../chat/browser/chatWidget.js";
import { IChatService } from "../../../chat/common/chatService.js";
import { ChatService } from "../../../chat/common/chatServiceImpl.js";
import { IChatSlashCommandService, ChatSlashCommandService } from "../../../chat/common/chatSlashCommands.js";
import { IChatVariablesService } from "../../../chat/common/chatVariables.js";
import { IChatWidgetHistoryService, ChatWidgetHistoryService } from "../../../chat/common/chatWidgetHistoryService.js";
import { IViewsService } from "../../../../services/views/common/viewsService.js";
import { TestExtensionService, TestContextService } from "../../../../test/common/workbenchTestServices.js";
import { IChatAgentService, ChatAgentService } from "../../../chat/common/chatAgents.js";
import { ChatVariablesService } from "../../../chat/browser/chatVariables.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { TestCommandService } from "../../../../../editor/test/browser/editorTestServices.js";
import { IAccessibleViewService } from "../../../../../platform/accessibility/browser/accessibleView.js";
import { IWorkbenchAssignmentService } from "../../../../services/assignment/common/assignmentService.js";
import { NullWorkbenchAssignmentService } from "../../../../services/assignment/test/common/nullAssignmentService.js";
import { ILanguageModelToolsService } from "../../../chat/common/languageModelToolsService.js";
import { MockLanguageModelToolsService } from "../../../chat/test/common/mockLanguageModelToolsService.js";
import { assertSnapshot } from "../../../../../base/test/common/snapshot.js";
import { constObservable } from "../../../../../base/common/observable.js";
import { IChatEditingService } from "../../../chat/common/chatEditingService.js";
import { ChatAgentLocation } from "../../../chat/common/constants.js";
suite("InlineChatSession", function() {
  const store = new DisposableStore();
  let editor;
  let model;
  let instaService;
  let inlineChatSessionService;
  setup(function() {
    const contextKeyService = new MockContextKeyService();
    const serviceCollection = new ServiceCollection(
      [IConfigurationService, new TestConfigurationService()],
      [IChatVariablesService, new SyncDescriptor(ChatVariablesService)],
      [ILogService, new NullLogService()],
      [ITelemetryService, NullTelemetryService],
      [IExtensionService, new TestExtensionService()],
      [IContextKeyService, new MockContextKeyService()],
      [IViewsService, new TestExtensionService()],
      [IWorkspaceContextService, new TestContextService()],
      [IChatWidgetHistoryService, new SyncDescriptor(ChatWidgetHistoryService)],
      [IChatWidgetService, new SyncDescriptor(ChatWidgetService)],
      [IChatSlashCommandService, new SyncDescriptor(ChatSlashCommandService)],
      [IChatService, new SyncDescriptor(ChatService)],
      [IEditorWorkerService, new SyncDescriptor(TestWorkerService)],
      [IChatAgentService, new SyncDescriptor(ChatAgentService)],
      [IContextKeyService, contextKeyService],
      [IDiffProviderFactoryService, new SyncDescriptor(TestDiffProviderFactoryService)],
      [IInlineChatSessionService, new SyncDescriptor(InlineChatSessionServiceImpl)],
      [ICommandService, new SyncDescriptor(TestCommandService)],
      [ILanguageModelToolsService, new MockLanguageModelToolsService()],
      [IEditorProgressService, new class extends mock() {
        show(total, delay) {
          return {
            total() {
            },
            worked(value) {
            },
            done() {
            }
          };
        }
      }()],
      [IChatEditingService, new class extends mock() {
        constructor() {
          super(...arguments);
          this.editingSessionsObs = constObservable([]);
        }
      }()],
      [IChatAccessibilityService, new class extends mock() {
        acceptResponse(response, requestId) {
        }
        acceptRequest() {
          return -1;
        }
      }()],
      [IAccessibleViewService, new class extends mock() {
        getOpenAriaHint(verbositySettingKey) {
          return null;
        }
      }()],
      [IConfigurationService, new TestConfigurationService()],
      [IViewDescriptorService, new class extends mock() {
        constructor() {
          super(...arguments);
          this.onDidChangeLocation = Event.None;
        }
      }()],
      [IWorkbenchAssignmentService, new NullWorkbenchAssignmentService()]
    );
    instaService = store.add(workbenchInstantiationService(void 0, store).createChild(serviceCollection));
    inlineChatSessionService = store.add(instaService.get(IInlineChatSessionService));
    instaService.get(IChatAgentService).registerDynamicAgent({
      extensionId: nullExtensionDescription.identifier,
      publisherDisplayName: "",
      extensionDisplayName: "",
      extensionPublisherId: "",
      id: "testAgent",
      name: "testAgent",
      isDefault: true,
      locations: [ChatAgentLocation.Editor],
      metadata: {},
      slashCommands: [],
      disambiguation: []
    }, {
      async invoke() {
        return {};
      }
    });
    model = store.add(instaService.get(IModelService).createModel("one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\nten\neleven", null));
    editor = store.add(instantiateTestCodeEditor(instaService, model));
  });
  teardown(function() {
    store.clear();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  async function makeEditAsAi(edit) {
    const session = inlineChatSessionService.getSession(editor, editor.getModel().uri);
    assertType(session);
    session.hunkData.ignoreTextModelNChanges = true;
    try {
      editor.executeEdits("test", Array.isArray(edit) ? edit : [edit]);
    } finally {
      session.hunkData.ignoreTextModelNChanges = false;
    }
    await session.hunkData.recompute({ applied: 0, sha1: "fakeSha1" });
  }
  function makeEdit(edit) {
    editor.executeEdits("test", Array.isArray(edit) ? edit : [edit]);
  }
  test("Create, release", async function() {
    const session = await inlineChatSessionService.createSession(editor, {}, CancellationToken.None);
    assertType(session);
    inlineChatSessionService.releaseSession(session);
  });
  test("HunkData, info", async function() {
    const decorationCountThen = model.getAllDecorations().length;
    const session = await inlineChatSessionService.createSession(editor, {}, CancellationToken.None);
    assertType(session);
    assert.ok(session.textModelN === model);
    await makeEditAsAi(EditOperation.insert(new Position(1, 1), "AI_EDIT\n"));
    assert.strictEqual(session.hunkData.size, 1);
    let [hunk] = session.hunkData.getInfo();
    assertType(hunk);
    assert.ok(!session.textModel0.equalsTextBuffer(session.textModelN.getTextBuffer()));
    assert.strictEqual(hunk.getState(), HunkState.Pending);
    assert.ok(hunk.getRangesN()[0].equalsRange({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 8 }));
    await makeEditAsAi(EditOperation.insert(new Position(1, 3), "foobar"));
    [hunk] = session.hunkData.getInfo();
    assert.ok(hunk.getRangesN()[0].equalsRange({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 14 }));
    inlineChatSessionService.releaseSession(session);
    assert.strictEqual(model.getAllDecorations().length, decorationCountThen);
  });
  test("HunkData, accept", async function() {
    const session = await inlineChatSessionService.createSession(editor, {}, CancellationToken.None);
    assertType(session);
    await makeEditAsAi([EditOperation.insert(new Position(1, 1), "AI_EDIT\n"), EditOperation.insert(new Position(10, 1), "AI_EDIT\n")]);
    assert.strictEqual(session.hunkData.size, 2);
    assert.ok(!session.textModel0.equalsTextBuffer(session.textModelN.getTextBuffer()));
    for (const hunk of session.hunkData.getInfo()) {
      assertType(hunk);
      assert.strictEqual(hunk.getState(), HunkState.Pending);
      hunk.acceptChanges();
      assert.strictEqual(hunk.getState(), HunkState.Accepted);
    }
    assert.strictEqual(session.textModel0.getValue(), session.textModelN.getValue());
    inlineChatSessionService.releaseSession(session);
  });
  test("HunkData, reject", async function() {
    const session = await inlineChatSessionService.createSession(editor, {}, CancellationToken.None);
    assertType(session);
    await makeEditAsAi([EditOperation.insert(new Position(1, 1), "AI_EDIT\n"), EditOperation.insert(new Position(10, 1), "AI_EDIT\n")]);
    assert.strictEqual(session.hunkData.size, 2);
    assert.ok(!session.textModel0.equalsTextBuffer(session.textModelN.getTextBuffer()));
    for (const hunk of session.hunkData.getInfo()) {
      assertType(hunk);
      assert.strictEqual(hunk.getState(), HunkState.Pending);
      hunk.discardChanges();
      assert.strictEqual(hunk.getState(), HunkState.Rejected);
    }
    assert.strictEqual(session.textModel0.getValue(), session.textModelN.getValue());
    inlineChatSessionService.releaseSession(session);
  });
  test("HunkData, N rounds", async function() {
    model.setValue("one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\nten\neleven\ntwelwe\nthirteen\nfourteen\nfifteen\nsixteen\nseventeen\neighteen\nnineteen\n");
    const session = await inlineChatSessionService.createSession(editor, {}, CancellationToken.None);
    assertType(session);
    assert.ok(session.textModel0.equalsTextBuffer(session.textModelN.getTextBuffer()));
    assert.strictEqual(session.hunkData.size, 0);
    await makeEditAsAi([
      EditOperation.insert(new Position(1, 1), "AI1"),
      EditOperation.insert(new Position(4, 1), "AI2"),
      EditOperation.insert(new Position(19, 1), "AI3")
    ]);
    assert.strictEqual(session.hunkData.size, 2);
    let [first, second] = session.hunkData.getInfo();
    assert.ok(model.getValueInRange(first.getRangesN()[0]).includes("AI1"));
    assert.ok(model.getValueInRange(first.getRangesN()[0]).includes("AI2"));
    assert.ok(model.getValueInRange(second.getRangesN()[0]).includes("AI3"));
    assert.ok(!session.textModel0.getValueInRange(first.getRangesN()[0]).includes("AI1"));
    assert.ok(!session.textModel0.getValueInRange(first.getRangesN()[0]).includes("AI2"));
    assert.ok(!session.textModel0.getValueInRange(second.getRangesN()[0]).includes("AI3"));
    first.acceptChanges();
    assert.ok(session.textModel0.getValueInRange(first.getRangesN()[0]).includes("AI1"));
    assert.ok(session.textModel0.getValueInRange(first.getRangesN()[0]).includes("AI2"));
    assert.ok(!session.textModel0.getValueInRange(second.getRangesN()[0]).includes("AI3"));
    await makeEditAsAi([
      EditOperation.insert(new Position(7, 1), "AI4")
    ]);
    assert.strictEqual(session.hunkData.size, 2);
    [first, second] = session.hunkData.getInfo();
    assert.ok(model.getValueInRange(first.getRangesN()[0]).includes("AI4"));
    assert.ok(model.getValueInRange(second.getRangesN()[0]).includes("AI3"));
    inlineChatSessionService.releaseSession(session);
  });
  test("HunkData, (mirror) edit before", async function() {
    const lines = ["one", "two", "three"];
    model.setValue(lines.join("\n"));
    const session = await inlineChatSessionService.createSession(editor, {}, CancellationToken.None);
    assertType(session);
    await makeEditAsAi([EditOperation.insert(new Position(3, 1), "AI WAS HERE\n")]);
    assert.strictEqual(session.textModelN.getValue(), ["one", "two", "AI WAS HERE", "three"].join("\n"));
    assert.strictEqual(session.textModel0.getValue(), lines.join("\n"));
    makeEdit([EditOperation.replace(new Range(1, 1, 1, 4), "ONE")]);
    assert.strictEqual(session.textModelN.getValue(), ["ONE", "two", "AI WAS HERE", "three"].join("\n"));
    assert.strictEqual(session.textModel0.getValue(), ["ONE", "two", "three"].join("\n"));
  });
  test("HunkData, (mirror) edit after", async function() {
    const lines = ["one", "two", "three", "four", "five"];
    model.setValue(lines.join("\n"));
    const session = await inlineChatSessionService.createSession(editor, {}, CancellationToken.None);
    assertType(session);
    await makeEditAsAi([EditOperation.insert(new Position(3, 1), "AI_EDIT\n")]);
    assert.strictEqual(session.hunkData.size, 1);
    const [hunk] = session.hunkData.getInfo();
    makeEdit([EditOperation.insert(new Position(1, 1), "USER1")]);
    assert.strictEqual(session.textModelN.getValue(), ["USER1one", "two", "AI_EDIT", "three", "four", "five"].join("\n"));
    assert.strictEqual(session.textModel0.getValue(), ["USER1one", "two", "three", "four", "five"].join("\n"));
    makeEdit([EditOperation.insert(new Position(5, 1), "USER2")]);
    assert.strictEqual(session.textModelN.getValue(), ["USER1one", "two", "AI_EDIT", "three", "USER2four", "five"].join("\n"));
    assert.strictEqual(session.textModel0.getValue(), ["USER1one", "two", "three", "USER2four", "five"].join("\n"));
    hunk.acceptChanges();
    assert.strictEqual(session.textModelN.getValue(), ["USER1one", "two", "AI_EDIT", "three", "USER2four", "five"].join("\n"));
    assert.strictEqual(session.textModel0.getValue(), ["USER1one", "two", "AI_EDIT", "three", "USER2four", "five"].join("\n"));
  });
  test("HunkData, (mirror) edit inside ", async function() {
    const lines = ["one", "two", "three"];
    model.setValue(lines.join("\n"));
    const session = await inlineChatSessionService.createSession(editor, {}, CancellationToken.None);
    assertType(session);
    await makeEditAsAi([EditOperation.insert(new Position(3, 1), "AI WAS HERE\n")]);
    assert.strictEqual(session.textModelN.getValue(), ["one", "two", "AI WAS HERE", "three"].join("\n"));
    assert.strictEqual(session.textModel0.getValue(), lines.join("\n"));
    makeEdit([EditOperation.replace(new Range(3, 4, 3, 7), "wwaaassss")]);
    assert.strictEqual(session.textModelN.getValue(), ["one", "two", "AI wwaaassss HERE", "three"].join("\n"));
    assert.strictEqual(session.textModel0.getValue(), ["one", "two", "three"].join("\n"));
  });
  test("HunkData, (mirror) edit after dicard ", async function() {
    const lines = ["one", "two", "three"];
    model.setValue(lines.join("\n"));
    const session = await inlineChatSessionService.createSession(editor, {}, CancellationToken.None);
    assertType(session);
    await makeEditAsAi([EditOperation.insert(new Position(3, 1), "AI WAS HERE\n")]);
    assert.strictEqual(session.textModelN.getValue(), ["one", "two", "AI WAS HERE", "three"].join("\n"));
    assert.strictEqual(session.textModel0.getValue(), lines.join("\n"));
    assert.strictEqual(session.hunkData.size, 1);
    const [hunk] = session.hunkData.getInfo();
    hunk.discardChanges();
    assert.strictEqual(session.textModelN.getValue(), lines.join("\n"));
    assert.strictEqual(session.textModel0.getValue(), lines.join("\n"));
    makeEdit([EditOperation.replace(new Range(3, 4, 3, 6), "3333")]);
    assert.strictEqual(session.textModelN.getValue(), ["one", "two", "thr3333"].join("\n"));
    assert.strictEqual(session.textModel0.getValue(), ["one", "two", "thr3333"].join("\n"));
  });
  test("HunkData, (mirror) edit after, multi turn", async function() {
    const lines = ["one", "two", "three", "four", "five"];
    model.setValue(lines.join("\n"));
    const session = await inlineChatSessionService.createSession(editor, {}, CancellationToken.None);
    assertType(session);
    await makeEditAsAi([EditOperation.insert(new Position(3, 1), "AI_EDIT\n")]);
    assert.strictEqual(session.hunkData.size, 1);
    makeEdit([EditOperation.insert(new Position(5, 1), "FOO")]);
    assert.strictEqual(session.textModelN.getValue(), ["one", "two", "AI_EDIT", "three", "FOOfour", "five"].join("\n"));
    assert.strictEqual(session.textModel0.getValue(), ["one", "two", "three", "FOOfour", "five"].join("\n"));
    await makeEditAsAi([EditOperation.insert(new Position(2, 4), " zwei")]);
    assert.strictEqual(session.hunkData.size, 1);
    assert.strictEqual(session.textModelN.getValue(), ["one", "two zwei", "AI_EDIT", "three", "FOOfour", "five"].join("\n"));
    assert.strictEqual(session.textModel0.getValue(), ["one", "two", "three", "FOOfour", "five"].join("\n"));
    makeEdit([EditOperation.replace(new Range(6, 3, 6, 5), "vefivefi")]);
    assert.strictEqual(session.textModelN.getValue(), ["one", "two zwei", "AI_EDIT", "three", "FOOfour", "fivefivefi"].join("\n"));
    assert.strictEqual(session.textModel0.getValue(), ["one", "two", "three", "FOOfour", "fivefivefi"].join("\n"));
  });
  test("HunkData, (mirror) edit after, multi turn 2", async function() {
    const lines = ["one", "two", "three", "four", "five"];
    model.setValue(lines.join("\n"));
    const session = await inlineChatSessionService.createSession(editor, {}, CancellationToken.None);
    assertType(session);
    await makeEditAsAi([EditOperation.insert(new Position(3, 1), "AI_EDIT\n")]);
    assert.strictEqual(session.hunkData.size, 1);
    makeEdit([EditOperation.insert(new Position(5, 1), "FOO")]);
    assert.strictEqual(session.textModelN.getValue(), ["one", "two", "AI_EDIT", "three", "FOOfour", "five"].join("\n"));
    assert.strictEqual(session.textModel0.getValue(), ["one", "two", "three", "FOOfour", "five"].join("\n"));
    await makeEditAsAi([EditOperation.insert(new Position(2, 4), "zwei")]);
    assert.strictEqual(session.hunkData.size, 1);
    assert.strictEqual(session.textModelN.getValue(), ["one", "twozwei", "AI_EDIT", "three", "FOOfour", "five"].join("\n"));
    assert.strictEqual(session.textModel0.getValue(), ["one", "two", "three", "FOOfour", "five"].join("\n"));
    makeEdit([EditOperation.replace(new Range(6, 3, 6, 5), "vefivefi")]);
    assert.strictEqual(session.textModelN.getValue(), ["one", "twozwei", "AI_EDIT", "three", "FOOfour", "fivefivefi"].join("\n"));
    assert.strictEqual(session.textModel0.getValue(), ["one", "two", "three", "FOOfour", "fivefivefi"].join("\n"));
    session.hunkData.getInfo()[0].acceptChanges();
    assert.strictEqual(session.textModelN.getValue(), session.textModel0.getValue());
    makeEdit([EditOperation.replace(new Range(1, 1, 1, 1), "done")]);
    assert.strictEqual(session.textModelN.getValue(), session.textModel0.getValue());
  });
  test("HunkData, accept, discardAll", async function() {
    const session = await inlineChatSessionService.createSession(editor, {}, CancellationToken.None);
    assertType(session);
    await makeEditAsAi([EditOperation.insert(new Position(1, 1), "AI_EDIT\n"), EditOperation.insert(new Position(10, 1), "AI_EDIT\n")]);
    assert.strictEqual(session.hunkData.size, 2);
    assert.ok(!session.textModel0.equalsTextBuffer(session.textModelN.getTextBuffer()));
    const textModeNNow = session.textModelN.getValue();
    session.hunkData.getInfo()[0].acceptChanges();
    assert.strictEqual(textModeNNow, session.textModelN.getValue());
    session.hunkData.discardAll();
    assert.strictEqual(session.textModelN.getValue(), "AI_EDIT\none\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\nten\neleven");
    assert.strictEqual(session.textModelN.getValue(), session.textModel0.getValue());
    inlineChatSessionService.releaseSession(session);
  });
  test("HunkData, discardAll return undo edits", async function() {
    const session = await inlineChatSessionService.createSession(editor, {}, CancellationToken.None);
    assertType(session);
    await makeEditAsAi([EditOperation.insert(new Position(1, 1), "AI_EDIT\n"), EditOperation.insert(new Position(10, 1), "AI_EDIT\n")]);
    assert.strictEqual(session.hunkData.size, 2);
    assert.ok(!session.textModel0.equalsTextBuffer(session.textModelN.getTextBuffer()));
    const textModeNNow = session.textModelN.getValue();
    session.hunkData.getInfo()[0].acceptChanges();
    assert.strictEqual(textModeNNow, session.textModelN.getValue());
    const undoEdits = session.hunkData.discardAll();
    assert.strictEqual(session.textModelN.getValue(), "AI_EDIT\none\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\nten\neleven");
    assert.strictEqual(session.textModelN.getValue(), session.textModel0.getValue());
    session.textModelN.pushEditOperations(null, undoEdits, () => null);
    assert.strictEqual(textModeNNow, session.textModelN.getValue());
    inlineChatSessionService.releaseSession(session);
  });
  test('Pressing Escape after inline chat errored with "response filtered" leaves document dirty #7764', async function() {
    const origValue = `class Foo {
	private onError(error: string): void {
		if (/The request timed out|The network connection was lost/i.test(error)) {
			return;
		}

		error = error.replace(/See https://github.com/Squirrel/Squirrel.Mac/issues/182 for more information/, 'This might mean the application was put on quarantine by macOS. See [this link](https://github.com/microsoft/vscode/issues/7426#issuecomment-425093469) for more information');

		this.notificationService.notify({
			severity: Severity.Error,
			message: error,
			source: nls.localize('update service', "Update Service"),
		});
	}
}`;
    model.setValue(origValue);
    const session = await inlineChatSessionService.createSession(editor, {}, CancellationToken.None);
    assertType(session);
    const fakeRequest = new class extends mock() {
      get id() {
        return "one";
      }
    }();
    session.markModelVersion(fakeRequest);
    assert.strictEqual(editor.getModel().getLineCount(), 15);
    await makeEditAsAi([EditOperation.replace(new Range(7, 1, 7, Number.MAX_SAFE_INTEGER), `error = error.replace(
			/See https://github.com/Squirrel/Squirrel.Mac/issues/182 for more information/,
			'This might mean the application was put on quarantine by macOS. See [this link](https://github.com/microsoft/vscode/issues/7426#issuecomment-425093469) for more information'
		);`)]);
    assert.strictEqual(editor.getModel().getLineCount(), 18);
    await session.undoChangesUntil(fakeRequest.id);
    await session.hunkData.recompute({ applied: 0, sha1: "fakeSha1" }, void 0);
    assert.strictEqual(editor.getModel().getValue(), origValue);
    session.hunkData.discardAll();
    assert.strictEqual(editor.getModel().getValue(), origValue);
  });
  test("Apply Code's preview should be easier to undo/esc #7537", async function() {
    model.setValue(`export function fib(n) {
	if (n <= 0) return 0;
	if (n === 1) return 0;
	if (n === 2) return 1;
	return fib(n - 1) + fib(n - 2);
}`);
    const session = await inlineChatSessionService.createSession(editor, {}, CancellationToken.None);
    assertType(session);
    await makeEditAsAi([EditOperation.replace(new Range(5, 1, 6, Number.MAX_SAFE_INTEGER), `
	let a = 0, b = 1, c;
	for (let i = 3; i <= n; i++) {
		c = a + b;
		a = b;
		b = c;
	}
	return b;
}`)]);
    assert.strictEqual(session.hunkData.size, 1);
    assert.strictEqual(session.hunkData.pending, 1);
    assert.ok(session.hunkData.getInfo().every((d) => d.getState() === HunkState.Pending));
    await assertSnapshot(editor.getModel().getValue(), { name: "1" });
    await model.undo();
    await assertSnapshot(editor.getModel().getValue(), { name: "2" });
    assert.strictEqual(session.hunkData.size, 1);
    assert.strictEqual(session.hunkData.pending, 0);
    assert.ok(session.hunkData.getInfo().every((d) => d.getState() === HunkState.Accepted));
    session.hunkData.discardAll();
    await assertSnapshot(editor.getModel().getValue(), { name: "2" });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9pbmxpbmVDaGF0L3Rlc3QvYnJvd3Nlci9pbmxpbmVDaGF0U2Vzc2lvbi50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IG1vY2sgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL21vY2suanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBUZXN0RGlmZlByb3ZpZGVyRmFjdG9yeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvdGVzdC9icm93c2VyL2RpZmYvdGVzdERpZmZQcm92aWRlckZhY3RvcnlTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElBY3RpdmVDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBJRGlmZlByb3ZpZGVyRmFjdG9yeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci93aWRnZXQvZGlmZkVkaXRvci9kaWZmUHJvdmlkZXJGYWN0b3J5U2VydmljZS5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9tb2RlbC5qcyc7XG5pbXBvcnQgeyBpbnN0YW50aWF0ZVRlc3RDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL3Rlc3QvYnJvd3Nlci90ZXN0Q29kZUVkaXRvci5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vdGVzdC9jb21tb24vdGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgU3luY0Rlc2NyaXB0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9kZXNjcmlwdG9ycy5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL3NlcnZpY2VDb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vdGVzdC9jb21tb24vaW5zdGFudGlhdGlvblNlcnZpY2VNb2NrLmpzJztcbmltcG9ydCB7IE1vY2tDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvdGVzdC9jb21tb24vbW9ja0tleWJpbmRpbmdTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JQcm9ncmVzc1NlcnZpY2UsIElQcm9ncmVzc1J1bm5lciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IEFjY2Vzc2liaWxpdHlWZXJib3NpdHlTZXR0aW5nSWQgfSBmcm9tICcuLi8uLi8uLi9hY2Nlc3NpYmlsaXR5L2Jyb3dzZXIvYWNjZXNzaWJpbGl0eUNvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUNoYXRBY2Nlc3NpYmlsaXR5U2VydmljZSwgSUNoYXRXaWRnZXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY2hhdC9icm93c2VyL2NoYXQuanMnO1xuaW1wb3J0IHsgSUNoYXRSZXNwb25zZVZpZXdNb2RlbCB9IGZyb20gJy4uLy4uLy4uL2NoYXQvY29tbW9uL2NoYXRWaWV3TW9kZWwuanMnO1xuaW1wb3J0IHsgSHVua1N0YXRlIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9pbmxpbmVDaGF0U2Vzc2lvbi5qcyc7XG5pbXBvcnQgeyBJSW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9pbmxpbmVDaGF0U2Vzc2lvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlSW1wbCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvaW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlSW1wbC5qcyc7XG5pbXBvcnQgeyB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvYnJvd3Nlci93b3JrYmVuY2hUZXN0U2VydmljZXMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgYXNzZXJ0VHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IEVkaXRPcGVyYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvZWRpdE9wZXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yV29ya2VyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvZWRpdG9yV29ya2VyLmpzJztcbmltcG9ydCB7IFRlc3RXb3JrZXJTZXJ2aWNlIH0gZnJvbSAnLi90ZXN0V29ya2VyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSwgbnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSwgTnVsbExvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IE51bGxUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnlVdGlscy5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBDaGF0V2lkZ2V0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NoYXQvYnJvd3Nlci9jaGF0V2lkZ2V0LmpzJztcbmltcG9ydCB7IElDaGF0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NoYXQvY29tbW9uL2NoYXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENoYXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY2hhdC9jb21tb24vY2hhdFNlcnZpY2VJbXBsLmpzJztcbmltcG9ydCB7IElDaGF0U2xhc2hDb21tYW5kU2VydmljZSwgQ2hhdFNsYXNoQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jaGF0L2NvbW1vbi9jaGF0U2xhc2hDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJQ2hhdFZhcmlhYmxlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jaGF0L2NvbW1vbi9jaGF0VmFyaWFibGVzLmpzJztcbmltcG9ydCB7IElDaGF0V2lkZ2V0SGlzdG9yeVNlcnZpY2UsIENoYXRXaWRnZXRIaXN0b3J5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NoYXQvY29tbW9uL2NoYXRXaWRnZXRIaXN0b3J5U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVmlld3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvdmlld3MvY29tbW9uL3ZpZXdzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUZXN0RXh0ZW5zaW9uU2VydmljZSwgVGVzdENvbnRleHRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9jb21tb24vd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB7IElDaGF0QWdlbnRTZXJ2aWNlLCBDaGF0QWdlbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY2hhdC9jb21tb24vY2hhdEFnZW50cy5qcyc7XG5pbXBvcnQgeyBDaGF0VmFyaWFibGVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NoYXQvYnJvd3Nlci9jaGF0VmFyaWFibGVzLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBUZXN0Q29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvdGVzdC9icm93c2VyL2VkaXRvclRlc3RTZXJ2aWNlcy5qcyc7XG5pbXBvcnQgeyBJQWNjZXNzaWJsZVZpZXdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eS9icm93c2VyL2FjY2Vzc2libGVWaWV3LmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hBc3NpZ25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2Fzc2lnbm1lbnQvY29tbW9uL2Fzc2lnbm1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE51bGxXb3JrYmVuY2hBc3NpZ25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2Fzc2lnbm1lbnQvdGVzdC9jb21tb24vbnVsbEFzc2lnbm1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZU1vZGVsVG9vbHNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY2hhdC9jb21tb24vbGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBNb2NrTGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NoYXQvdGVzdC9jb21tb24vbW9ja0xhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNoYXRSZXF1ZXN0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi9jaGF0L2NvbW1vbi9jaGF0TW9kZWwuanMnO1xuaW1wb3J0IHsgYXNzZXJ0U25hcHNob3QgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3NuYXBzaG90LmpzJztcbmltcG9ydCB7IElPYnNlcnZhYmxlLCBjb25zdE9ic2VydmFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IElDaGF0RWRpdGluZ1NlcnZpY2UsIElDaGF0RWRpdGluZ1Nlc3Npb24gfSBmcm9tICcuLi8uLi8uLi9jaGF0L2NvbW1vbi9jaGF0RWRpdGluZ1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ2hhdEFnZW50TG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi9jaGF0L2NvbW1vbi9jb25zdGFudHMuanMnO1xuXG5zdWl0ZSgnSW5saW5lQ2hhdFNlc3Npb24nLCBmdW5jdGlvbiAoKSB7XG5cblx0Y29uc3Qgc3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdGxldCBlZGl0b3I6IElBY3RpdmVDb2RlRWRpdG9yO1xuXHRsZXQgbW9kZWw6IElUZXh0TW9kZWw7XG5cdGxldCBpbnN0YVNlcnZpY2U6IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZTtcblxuXHRsZXQgaW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlOiBJSW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlO1xuXG5cdHNldHVwKGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBjb250ZXh0S2V5U2VydmljZSA9IG5ldyBNb2NrQ29udGV4dEtleVNlcnZpY2UoKTtcblxuXG5cdFx0Y29uc3Qgc2VydmljZUNvbGxlY3Rpb24gPSBuZXcgU2VydmljZUNvbGxlY3Rpb24oXG5cdFx0XHRbSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBuZXcgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlKCldLFxuXHRcdFx0W0lDaGF0VmFyaWFibGVzU2VydmljZSwgbmV3IFN5bmNEZXNjcmlwdG9yKENoYXRWYXJpYWJsZXNTZXJ2aWNlKV0sXG5cdFx0XHRbSUxvZ1NlcnZpY2UsIG5ldyBOdWxsTG9nU2VydmljZSgpXSxcblx0XHRcdFtJVGVsZW1ldHJ5U2VydmljZSwgTnVsbFRlbGVtZXRyeVNlcnZpY2VdLFxuXHRcdFx0W0lFeHRlbnNpb25TZXJ2aWNlLCBuZXcgVGVzdEV4dGVuc2lvblNlcnZpY2UoKV0sXG5cdFx0XHRbSUNvbnRleHRLZXlTZXJ2aWNlLCBuZXcgTW9ja0NvbnRleHRLZXlTZXJ2aWNlKCldLFxuXHRcdFx0W0lWaWV3c1NlcnZpY2UsIG5ldyBUZXN0RXh0ZW5zaW9uU2VydmljZSgpXSxcblx0XHRcdFtJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIG5ldyBUZXN0Q29udGV4dFNlcnZpY2UoKV0sXG5cdFx0XHRbSUNoYXRXaWRnZXRIaXN0b3J5U2VydmljZSwgbmV3IFN5bmNEZXNjcmlwdG9yKENoYXRXaWRnZXRIaXN0b3J5U2VydmljZSldLFxuXHRcdFx0W0lDaGF0V2lkZ2V0U2VydmljZSwgbmV3IFN5bmNEZXNjcmlwdG9yKENoYXRXaWRnZXRTZXJ2aWNlKV0sXG5cdFx0XHRbSUNoYXRTbGFzaENvbW1hbmRTZXJ2aWNlLCBuZXcgU3luY0Rlc2NyaXB0b3IoQ2hhdFNsYXNoQ29tbWFuZFNlcnZpY2UpXSxcblx0XHRcdFtJQ2hhdFNlcnZpY2UsIG5ldyBTeW5jRGVzY3JpcHRvcihDaGF0U2VydmljZSldLFxuXHRcdFx0W0lFZGl0b3JXb3JrZXJTZXJ2aWNlLCBuZXcgU3luY0Rlc2NyaXB0b3IoVGVzdFdvcmtlclNlcnZpY2UpXSxcblx0XHRcdFtJQ2hhdEFnZW50U2VydmljZSwgbmV3IFN5bmNEZXNjcmlwdG9yKENoYXRBZ2VudFNlcnZpY2UpXSxcblx0XHRcdFtJQ29udGV4dEtleVNlcnZpY2UsIGNvbnRleHRLZXlTZXJ2aWNlXSxcblx0XHRcdFtJRGlmZlByb3ZpZGVyRmFjdG9yeVNlcnZpY2UsIG5ldyBTeW5jRGVzY3JpcHRvcihUZXN0RGlmZlByb3ZpZGVyRmFjdG9yeVNlcnZpY2UpXSxcblx0XHRcdFtJSW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlLCBuZXcgU3luY0Rlc2NyaXB0b3IoSW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlSW1wbCldLFxuXHRcdFx0W0lDb21tYW5kU2VydmljZSwgbmV3IFN5bmNEZXNjcmlwdG9yKFRlc3RDb21tYW5kU2VydmljZSldLFxuXHRcdFx0W0lMYW5ndWFnZU1vZGVsVG9vbHNTZXJ2aWNlLCBuZXcgTW9ja0xhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2UoKV0sXG5cdFx0XHRbSUVkaXRvclByb2dyZXNzU2VydmljZSwgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJRWRpdG9yUHJvZ3Jlc3NTZXJ2aWNlPigpIHtcblx0XHRcdFx0b3ZlcnJpZGUgc2hvdyh0b3RhbDogdW5rbm93biwgZGVsYXk/OiB1bmtub3duKTogSVByb2dyZXNzUnVubmVyIHtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0dG90YWwoKSB7IH0sXG5cdFx0XHRcdFx0XHR3b3JrZWQodmFsdWUpIHsgfSxcblx0XHRcdFx0XHRcdGRvbmUoKSB7IH0sXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXHRcdFx0fV0sXG5cdFx0XHRbSUNoYXRFZGl0aW5nU2VydmljZSwgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJQ2hhdEVkaXRpbmdTZXJ2aWNlPigpIHtcblx0XHRcdFx0b3ZlcnJpZGUgZWRpdGluZ1Nlc3Npb25zT2JzOiBJT2JzZXJ2YWJsZTxyZWFkb25seSBJQ2hhdEVkaXRpbmdTZXNzaW9uW10+ID0gY29uc3RPYnNlcnZhYmxlKFtdKTtcblx0XHRcdH1dLFxuXHRcdFx0W0lDaGF0QWNjZXNzaWJpbGl0eVNlcnZpY2UsIG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SUNoYXRBY2Nlc3NpYmlsaXR5U2VydmljZT4oKSB7XG5cdFx0XHRcdG92ZXJyaWRlIGFjY2VwdFJlc3BvbnNlKHJlc3BvbnNlOiBJQ2hhdFJlc3BvbnNlVmlld01vZGVsIHwgdW5kZWZpbmVkLCByZXF1ZXN0SWQ6IG51bWJlcik6IHZvaWQgeyB9XG5cdFx0XHRcdG92ZXJyaWRlIGFjY2VwdFJlcXVlc3QoKTogbnVtYmVyIHsgcmV0dXJuIC0xOyB9XG5cdFx0XHR9XSxcblx0XHRcdFtJQWNjZXNzaWJsZVZpZXdTZXJ2aWNlLCBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElBY2Nlc3NpYmxlVmlld1NlcnZpY2U+KCkge1xuXHRcdFx0XHRvdmVycmlkZSBnZXRPcGVuQXJpYUhpbnQodmVyYm9zaXR5U2V0dGluZ0tleTogQWNjZXNzaWJpbGl0eVZlcmJvc2l0eVNldHRpbmdJZCk6IHN0cmluZyB8IG51bGwge1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHR9XSxcblx0XHRcdFtJQ29uZmlndXJhdGlvblNlcnZpY2UsIG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoKV0sXG5cdFx0XHRbSVZpZXdEZXNjcmlwdG9yU2VydmljZSwgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlPigpIHtcblx0XHRcdFx0b3ZlcnJpZGUgb25EaWRDaGFuZ2VMb2NhdGlvbiA9IEV2ZW50Lk5vbmU7XG5cdFx0XHR9XSxcblx0XHRcdFtJV29ya2JlbmNoQXNzaWdubWVudFNlcnZpY2UsIG5ldyBOdWxsV29ya2JlbmNoQXNzaWdubWVudFNlcnZpY2UoKV1cblx0XHQpO1xuXG5cblxuXHRcdGluc3RhU2VydmljZSA9IHN0b3JlLmFkZCh3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSh1bmRlZmluZWQsIHN0b3JlKS5jcmVhdGVDaGlsZChzZXJ2aWNlQ29sbGVjdGlvbikpO1xuXHRcdGlubGluZUNoYXRTZXNzaW9uU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YVNlcnZpY2UuZ2V0KElJbmxpbmVDaGF0U2Vzc2lvblNlcnZpY2UpKTtcblxuXHRcdGluc3RhU2VydmljZS5nZXQoSUNoYXRBZ2VudFNlcnZpY2UpLnJlZ2lzdGVyRHluYW1pY0FnZW50KHtcblx0XHRcdGV4dGVuc2lvbklkOiBudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24uaWRlbnRpZmllcixcblx0XHRcdHB1Ymxpc2hlckRpc3BsYXlOYW1lOiAnJyxcblx0XHRcdGV4dGVuc2lvbkRpc3BsYXlOYW1lOiAnJyxcblx0XHRcdGV4dGVuc2lvblB1Ymxpc2hlcklkOiAnJyxcblx0XHRcdGlkOiAndGVzdEFnZW50Jyxcblx0XHRcdG5hbWU6ICd0ZXN0QWdlbnQnLFxuXHRcdFx0aXNEZWZhdWx0OiB0cnVlLFxuXHRcdFx0bG9jYXRpb25zOiBbQ2hhdEFnZW50TG9jYXRpb24uRWRpdG9yXSxcblx0XHRcdG1ldGFkYXRhOiB7fSxcblx0XHRcdHNsYXNoQ29tbWFuZHM6IFtdLFxuXHRcdFx0ZGlzYW1iaWd1YXRpb246IFtdLFxuXHRcdH0sIHtcblx0XHRcdGFzeW5jIGludm9rZSgpIHtcblx0XHRcdFx0cmV0dXJuIHt9O1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cblx0XHRtb2RlbCA9IHN0b3JlLmFkZChpbnN0YVNlcnZpY2UuZ2V0KElNb2RlbFNlcnZpY2UpLmNyZWF0ZU1vZGVsKCdvbmVcXG50d29cXG50aHJlZVxcbmZvdXJcXG5maXZlXFxuc2l4XFxuc2V2ZW5cXG5laWdodFxcbm5pbmVcXG50ZW5cXG5lbGV2ZW4nLCBudWxsKSk7XG5cdFx0ZWRpdG9yID0gc3RvcmUuYWRkKGluc3RhbnRpYXRlVGVzdENvZGVFZGl0b3IoaW5zdGFTZXJ2aWNlLCBtb2RlbCkpO1xuXHR9KTtcblxuXHR0ZWFyZG93bihmdW5jdGlvbiAoKSB7XG5cdFx0c3RvcmUuY2xlYXIoKTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0YXN5bmMgZnVuY3Rpb24gbWFrZUVkaXRBc0FpKGVkaXQ6IEVkaXRPcGVyYXRpb24gfCBFZGl0T3BlcmF0aW9uW10pIHtcblx0XHRjb25zdCBzZXNzaW9uID0gaW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlLmdldFNlc3Npb24oZWRpdG9yLCBlZGl0b3IuZ2V0TW9kZWwoKSEudXJpKTtcblx0XHRhc3NlcnRUeXBlKHNlc3Npb24pO1xuXHRcdHNlc3Npb24uaHVua0RhdGEuaWdub3JlVGV4dE1vZGVsTkNoYW5nZXMgPSB0cnVlO1xuXHRcdHRyeSB7XG5cdFx0XHRlZGl0b3IuZXhlY3V0ZUVkaXRzKCd0ZXN0JywgQXJyYXkuaXNBcnJheShlZGl0KSA/IGVkaXQgOiBbZWRpdF0pO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRzZXNzaW9uLmh1bmtEYXRhLmlnbm9yZVRleHRNb2RlbE5DaGFuZ2VzID0gZmFsc2U7XG5cdFx0fVxuXHRcdGF3YWl0IHNlc3Npb24uaHVua0RhdGEucmVjb21wdXRlKHsgYXBwbGllZDogMCwgc2hhMTogJ2Zha2VTaGExJyB9KTtcblx0fVxuXG5cdGZ1bmN0aW9uIG1ha2VFZGl0KGVkaXQ6IEVkaXRPcGVyYXRpb24gfCBFZGl0T3BlcmF0aW9uW10pIHtcblx0XHRlZGl0b3IuZXhlY3V0ZUVkaXRzKCd0ZXN0JywgQXJyYXkuaXNBcnJheShlZGl0KSA/IGVkaXQgOiBbZWRpdF0pO1xuXHR9XG5cblx0dGVzdCgnQ3JlYXRlLCByZWxlYXNlJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IGF3YWl0IGlubGluZUNoYXRTZXNzaW9uU2VydmljZS5jcmVhdGVTZXNzaW9uKGVkaXRvciwge30sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdGFzc2VydFR5cGUoc2Vzc2lvbik7XG5cdFx0aW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlLnJlbGVhc2VTZXNzaW9uKHNlc3Npb24pO1xuXHR9KTtcblxuXHR0ZXN0KCdIdW5rRGF0YSwgaW5mbycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IGRlY29yYXRpb25Db3VudFRoZW4gPSBtb2RlbC5nZXRBbGxEZWNvcmF0aW9ucygpLmxlbmd0aDtcblxuXHRcdGNvbnN0IHNlc3Npb24gPSBhd2FpdCBpbmxpbmVDaGF0U2Vzc2lvblNlcnZpY2UuY3JlYXRlU2Vzc2lvbihlZGl0b3IsIHt9LCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRhc3NlcnRUeXBlKHNlc3Npb24pO1xuXHRcdGFzc2VydC5vayhzZXNzaW9uLnRleHRNb2RlbE4gPT09IG1vZGVsKTtcblxuXHRcdGF3YWl0IG1ha2VFZGl0QXNBaShFZGl0T3BlcmF0aW9uLmluc2VydChuZXcgUG9zaXRpb24oMSwgMSksICdBSV9FRElUXFxuJykpO1xuXG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbi5odW5rRGF0YS5zaXplLCAxKTtcblx0XHRsZXQgW2h1bmtdID0gc2Vzc2lvbi5odW5rRGF0YS5nZXRJbmZvKCk7XG5cdFx0YXNzZXJ0VHlwZShodW5rKTtcblxuXHRcdGFzc2VydC5vayghc2Vzc2lvbi50ZXh0TW9kZWwwLmVxdWFsc1RleHRCdWZmZXIoc2Vzc2lvbi50ZXh0TW9kZWxOLmdldFRleHRCdWZmZXIoKSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChodW5rLmdldFN0YXRlKCksIEh1bmtTdGF0ZS5QZW5kaW5nKTtcblx0XHRhc3NlcnQub2soaHVuay5nZXRSYW5nZXNOKClbMF0uZXF1YWxzUmFuZ2UoeyBzdGFydExpbmVOdW1iZXI6IDEsIHN0YXJ0Q29sdW1uOiAxLCBlbmRMaW5lTnVtYmVyOiAxLCBlbmRDb2x1bW46IDggfSkpO1xuXG5cdFx0YXdhaXQgbWFrZUVkaXRBc0FpKEVkaXRPcGVyYXRpb24uaW5zZXJ0KG5ldyBQb3NpdGlvbigxLCAzKSwgJ2Zvb2JhcicpKTtcblx0XHRbaHVua10gPSBzZXNzaW9uLmh1bmtEYXRhLmdldEluZm8oKTtcblx0XHRhc3NlcnQub2soaHVuay5nZXRSYW5nZXNOKClbMF0uZXF1YWxzUmFuZ2UoeyBzdGFydExpbmVOdW1iZXI6IDEsIHN0YXJ0Q29sdW1uOiAxLCBlbmRMaW5lTnVtYmVyOiAxLCBlbmRDb2x1bW46IDE0IH0pKTtcblxuXHRcdGlubGluZUNoYXRTZXNzaW9uU2VydmljZS5yZWxlYXNlU2Vzc2lvbihzZXNzaW9uKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRBbGxEZWNvcmF0aW9ucygpLmxlbmd0aCwgZGVjb3JhdGlvbkNvdW50VGhlbik7IC8vIG5vIGxlYWtlZCBkZWNvcmF0aW9ucyFcblx0fSk7XG5cblx0dGVzdCgnSHVua0RhdGEsIGFjY2VwdCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IHNlc3Npb24gPSBhd2FpdCBpbmxpbmVDaGF0U2Vzc2lvblNlcnZpY2UuY3JlYXRlU2Vzc2lvbihlZGl0b3IsIHt9LCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRhc3NlcnRUeXBlKHNlc3Npb24pO1xuXG5cdFx0YXdhaXQgbWFrZUVkaXRBc0FpKFtFZGl0T3BlcmF0aW9uLmluc2VydChuZXcgUG9zaXRpb24oMSwgMSksICdBSV9FRElUXFxuJyksIEVkaXRPcGVyYXRpb24uaW5zZXJ0KG5ldyBQb3NpdGlvbigxMCwgMSksICdBSV9FRElUXFxuJyldKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uLmh1bmtEYXRhLnNpemUsIDIpO1xuXHRcdGFzc2VydC5vayghc2Vzc2lvbi50ZXh0TW9kZWwwLmVxdWFsc1RleHRCdWZmZXIoc2Vzc2lvbi50ZXh0TW9kZWxOLmdldFRleHRCdWZmZXIoKSkpO1xuXG5cdFx0Zm9yIChjb25zdCBodW5rIG9mIHNlc3Npb24uaHVua0RhdGEuZ2V0SW5mbygpKSB7XG5cdFx0XHRhc3NlcnRUeXBlKGh1bmspO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGh1bmsuZ2V0U3RhdGUoKSwgSHVua1N0YXRlLlBlbmRpbmcpO1xuXHRcdFx0aHVuay5hY2NlcHRDaGFuZ2VzKCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaHVuay5nZXRTdGF0ZSgpLCBIdW5rU3RhdGUuQWNjZXB0ZWQpO1xuXHRcdH1cblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uLnRleHRNb2RlbDAuZ2V0VmFsdWUoKSwgc2Vzc2lvbi50ZXh0TW9kZWxOLmdldFZhbHVlKCkpO1xuXHRcdGlubGluZUNoYXRTZXNzaW9uU2VydmljZS5yZWxlYXNlU2Vzc2lvbihzZXNzaW9uKTtcblx0fSk7XG5cblx0dGVzdCgnSHVua0RhdGEsIHJlamVjdCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IHNlc3Npb24gPSBhd2FpdCBpbmxpbmVDaGF0U2Vzc2lvblNlcnZpY2UuY3JlYXRlU2Vzc2lvbihlZGl0b3IsIHt9LCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRhc3NlcnRUeXBlKHNlc3Npb24pO1xuXG5cdFx0YXdhaXQgbWFrZUVkaXRBc0FpKFtFZGl0T3BlcmF0aW9uLmluc2VydChuZXcgUG9zaXRpb24oMSwgMSksICdBSV9FRElUXFxuJyksIEVkaXRPcGVyYXRpb24uaW5zZXJ0KG5ldyBQb3NpdGlvbigxMCwgMSksICdBSV9FRElUXFxuJyldKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uLmh1bmtEYXRhLnNpemUsIDIpO1xuXHRcdGFzc2VydC5vayghc2Vzc2lvbi50ZXh0TW9kZWwwLmVxdWFsc1RleHRCdWZmZXIoc2Vzc2lvbi50ZXh0TW9kZWxOLmdldFRleHRCdWZmZXIoKSkpO1xuXG5cdFx0Zm9yIChjb25zdCBodW5rIG9mIHNlc3Npb24uaHVua0RhdGEuZ2V0SW5mbygpKSB7XG5cdFx0XHRhc3NlcnRUeXBlKGh1bmspO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGh1bmsuZ2V0U3RhdGUoKSwgSHVua1N0YXRlLlBlbmRpbmcpO1xuXHRcdFx0aHVuay5kaXNjYXJkQ2hhbmdlcygpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGh1bmsuZ2V0U3RhdGUoKSwgSHVua1N0YXRlLlJlamVjdGVkKTtcblx0XHR9XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbi50ZXh0TW9kZWwwLmdldFZhbHVlKCksIHNlc3Npb24udGV4dE1vZGVsTi5nZXRWYWx1ZSgpKTtcblx0XHRpbmxpbmVDaGF0U2Vzc2lvblNlcnZpY2UucmVsZWFzZVNlc3Npb24oc2Vzc2lvbik7XG5cdH0pO1xuXG5cdHRlc3QoJ0h1bmtEYXRhLCBOIHJvdW5kcycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdG1vZGVsLnNldFZhbHVlKCdvbmVcXG50d29cXG50aHJlZVxcbmZvdXJcXG5maXZlXFxuc2l4XFxuc2V2ZW5cXG5laWdodFxcbm5pbmVcXG50ZW5cXG5lbGV2ZW5cXG50d2Vsd2VcXG50aGlydGVlblxcbmZvdXJ0ZWVuXFxuZmlmdGVlblxcbnNpeHRlZW5cXG5zZXZlbnRlZW5cXG5laWdodGVlblxcbm5pbmV0ZWVuXFxuJyk7XG5cblx0XHRjb25zdCBzZXNzaW9uID0gYXdhaXQgaW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlLmNyZWF0ZVNlc3Npb24oZWRpdG9yLCB7fSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0YXNzZXJ0VHlwZShzZXNzaW9uKTtcblxuXHRcdGFzc2VydC5vayhzZXNzaW9uLnRleHRNb2RlbDAuZXF1YWxzVGV4dEJ1ZmZlcihzZXNzaW9uLnRleHRNb2RlbE4uZ2V0VGV4dEJ1ZmZlcigpKSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbi5odW5rRGF0YS5zaXplLCAwKTtcblxuXHRcdC8vIFJPVU5EICMxXG5cdFx0YXdhaXQgbWFrZUVkaXRBc0FpKFtcblx0XHRcdEVkaXRPcGVyYXRpb24uaW5zZXJ0KG5ldyBQb3NpdGlvbigxLCAxKSwgJ0FJMScpLFxuXHRcdFx0RWRpdE9wZXJhdGlvbi5pbnNlcnQobmV3IFBvc2l0aW9uKDQsIDEpLCAnQUkyJyksXG5cdFx0XHRFZGl0T3BlcmF0aW9uLmluc2VydChuZXcgUG9zaXRpb24oMTksIDEpLCAnQUkzJylcblx0XHRdKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uLmh1bmtEYXRhLnNpemUsIDIpOyAvLyBBSTEsIEFJMiBhcmUgbWVyZ2VkIGludG8gb25lIGh1bmssIEFJMyBpcyBhIHNlcGFyYXRlIGh1bmtcblxuXHRcdGxldCBbZmlyc3QsIHNlY29uZF0gPSBzZXNzaW9uLmh1bmtEYXRhLmdldEluZm8oKTtcblxuXHRcdGFzc2VydC5vayhtb2RlbC5nZXRWYWx1ZUluUmFuZ2UoZmlyc3QuZ2V0UmFuZ2VzTigpWzBdKS5pbmNsdWRlcygnQUkxJykpO1xuXHRcdGFzc2VydC5vayhtb2RlbC5nZXRWYWx1ZUluUmFuZ2UoZmlyc3QuZ2V0UmFuZ2VzTigpWzBdKS5pbmNsdWRlcygnQUkyJykpO1xuXHRcdGFzc2VydC5vayhtb2RlbC5nZXRWYWx1ZUluUmFuZ2Uoc2Vjb25kLmdldFJhbmdlc04oKVswXSkuaW5jbHVkZXMoJ0FJMycpKTtcblxuXHRcdGFzc2VydC5vayghc2Vzc2lvbi50ZXh0TW9kZWwwLmdldFZhbHVlSW5SYW5nZShmaXJzdC5nZXRSYW5nZXNOKClbMF0pLmluY2x1ZGVzKCdBSTEnKSk7XG5cdFx0YXNzZXJ0Lm9rKCFzZXNzaW9uLnRleHRNb2RlbDAuZ2V0VmFsdWVJblJhbmdlKGZpcnN0LmdldFJhbmdlc04oKVswXSkuaW5jbHVkZXMoJ0FJMicpKTtcblx0XHRhc3NlcnQub2soIXNlc3Npb24udGV4dE1vZGVsMC5nZXRWYWx1ZUluUmFuZ2Uoc2Vjb25kLmdldFJhbmdlc04oKVswXSkuaW5jbHVkZXMoJ0FJMycpKTtcblxuXHRcdGZpcnN0LmFjY2VwdENoYW5nZXMoKTtcblx0XHRhc3NlcnQub2soc2Vzc2lvbi50ZXh0TW9kZWwwLmdldFZhbHVlSW5SYW5nZShmaXJzdC5nZXRSYW5nZXNOKClbMF0pLmluY2x1ZGVzKCdBSTEnKSk7XG5cdFx0YXNzZXJ0Lm9rKHNlc3Npb24udGV4dE1vZGVsMC5nZXRWYWx1ZUluUmFuZ2UoZmlyc3QuZ2V0UmFuZ2VzTigpWzBdKS5pbmNsdWRlcygnQUkyJykpO1xuXHRcdGFzc2VydC5vayghc2Vzc2lvbi50ZXh0TW9kZWwwLmdldFZhbHVlSW5SYW5nZShzZWNvbmQuZ2V0UmFuZ2VzTigpWzBdKS5pbmNsdWRlcygnQUkzJykpO1xuXG5cblx0XHQvLyBST1VORCAjMlxuXHRcdGF3YWl0IG1ha2VFZGl0QXNBaShbXG5cdFx0XHRFZGl0T3BlcmF0aW9uLmluc2VydChuZXcgUG9zaXRpb24oNywgMSksICdBSTQnKSxcblx0XHRdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbi5odW5rRGF0YS5zaXplLCAyKTtcblxuXHRcdFtmaXJzdCwgc2Vjb25kXSA9IHNlc3Npb24uaHVua0RhdGEuZ2V0SW5mbygpO1xuXHRcdGFzc2VydC5vayhtb2RlbC5nZXRWYWx1ZUluUmFuZ2UoZmlyc3QuZ2V0UmFuZ2VzTigpWzBdKS5pbmNsdWRlcygnQUk0JykpOyAvLyB0aGUgbmV3IGh1bmsgKGluIGxpbmUtb3JkZXIpXG5cdFx0YXNzZXJ0Lm9rKG1vZGVsLmdldFZhbHVlSW5SYW5nZShzZWNvbmQuZ2V0UmFuZ2VzTigpWzBdKS5pbmNsdWRlcygnQUkzJykpOyAvLyB0aGUgcHJldmlvdXMgaHVuayByZW1haW5zXG5cblx0XHRpbmxpbmVDaGF0U2Vzc2lvblNlcnZpY2UucmVsZWFzZVNlc3Npb24oc2Vzc2lvbik7XG5cdH0pO1xuXG5cdHRlc3QoJ0h1bmtEYXRhLCAobWlycm9yKSBlZGl0IGJlZm9yZScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IGxpbmVzID0gWydvbmUnLCAndHdvJywgJ3RocmVlJ107XG5cdFx0bW9kZWwuc2V0VmFsdWUobGluZXMuam9pbignXFxuJykpO1xuXHRcdGNvbnN0IHNlc3Npb24gPSBhd2FpdCBpbmxpbmVDaGF0U2Vzc2lvblNlcnZpY2UuY3JlYXRlU2Vzc2lvbihlZGl0b3IsIHt9LCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRhc3NlcnRUeXBlKHNlc3Npb24pO1xuXG5cdFx0YXdhaXQgbWFrZUVkaXRBc0FpKFtFZGl0T3BlcmF0aW9uLmluc2VydChuZXcgUG9zaXRpb24oMywgMSksICdBSSBXQVMgSEVSRVxcbicpXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24udGV4dE1vZGVsTi5nZXRWYWx1ZSgpLCBbJ29uZScsICd0d28nLCAnQUkgV0FTIEhFUkUnLCAndGhyZWUnXS5qb2luKCdcXG4nKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24udGV4dE1vZGVsMC5nZXRWYWx1ZSgpLCBsaW5lcy5qb2luKCdcXG4nKSk7XG5cblx0XHRtYWtlRWRpdChbRWRpdE9wZXJhdGlvbi5yZXBsYWNlKG5ldyBSYW5nZSgxLCAxLCAxLCA0KSwgJ09ORScpXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24udGV4dE1vZGVsTi5nZXRWYWx1ZSgpLCBbJ09ORScsICd0d28nLCAnQUkgV0FTIEhFUkUnLCAndGhyZWUnXS5qb2luKCdcXG4nKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24udGV4dE1vZGVsMC5nZXRWYWx1ZSgpLCBbJ09ORScsICd0d28nLCAndGhyZWUnXS5qb2luKCdcXG4nKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0h1bmtEYXRhLCAobWlycm9yKSBlZGl0IGFmdGVyJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgbGluZXMgPSBbJ29uZScsICd0d28nLCAndGhyZWUnLCAnZm91cicsICdmaXZlJ107XG5cdFx0bW9kZWwuc2V0VmFsdWUobGluZXMuam9pbignXFxuJykpO1xuXG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IGF3YWl0IGlubGluZUNoYXRTZXNzaW9uU2VydmljZS5jcmVhdGVTZXNzaW9uKGVkaXRvciwge30sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdGFzc2VydFR5cGUoc2Vzc2lvbik7XG5cblx0XHRhd2FpdCBtYWtlRWRpdEFzQWkoW0VkaXRPcGVyYXRpb24uaW5zZXJ0KG5ldyBQb3NpdGlvbigzLCAxKSwgJ0FJX0VESVRcXG4nKV0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24uaHVua0RhdGEuc2l6ZSwgMSk7XG5cdFx0Y29uc3QgW2h1bmtdID0gc2Vzc2lvbi5odW5rRGF0YS5nZXRJbmZvKCk7XG5cblx0XHRtYWtlRWRpdChbRWRpdE9wZXJhdGlvbi5pbnNlcnQobmV3IFBvc2l0aW9uKDEsIDEpLCAnVVNFUjEnKV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uLnRleHRNb2RlbE4uZ2V0VmFsdWUoKSwgWydVU0VSMW9uZScsICd0d28nLCAnQUlfRURJVCcsICd0aHJlZScsICdmb3VyJywgJ2ZpdmUnXS5qb2luKCdcXG4nKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24udGV4dE1vZGVsMC5nZXRWYWx1ZSgpLCBbJ1VTRVIxb25lJywgJ3R3bycsICd0aHJlZScsICdmb3VyJywgJ2ZpdmUnXS5qb2luKCdcXG4nKSk7XG5cblx0XHRtYWtlRWRpdChbRWRpdE9wZXJhdGlvbi5pbnNlcnQobmV3IFBvc2l0aW9uKDUsIDEpLCAnVVNFUjInKV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uLnRleHRNb2RlbE4uZ2V0VmFsdWUoKSwgWydVU0VSMW9uZScsICd0d28nLCAnQUlfRURJVCcsICd0aHJlZScsICdVU0VSMmZvdXInLCAnZml2ZSddLmpvaW4oJ1xcbicpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbi50ZXh0TW9kZWwwLmdldFZhbHVlKCksIFsnVVNFUjFvbmUnLCAndHdvJywgJ3RocmVlJywgJ1VTRVIyZm91cicsICdmaXZlJ10uam9pbignXFxuJykpO1xuXG5cdFx0aHVuay5hY2NlcHRDaGFuZ2VzKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24udGV4dE1vZGVsTi5nZXRWYWx1ZSgpLCBbJ1VTRVIxb25lJywgJ3R3bycsICdBSV9FRElUJywgJ3RocmVlJywgJ1VTRVIyZm91cicsICdmaXZlJ10uam9pbignXFxuJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uLnRleHRNb2RlbDAuZ2V0VmFsdWUoKSwgWydVU0VSMW9uZScsICd0d28nLCAnQUlfRURJVCcsICd0aHJlZScsICdVU0VSMmZvdXInLCAnZml2ZSddLmpvaW4oJ1xcbicpKTtcblx0fSk7XG5cblx0dGVzdCgnSHVua0RhdGEsIChtaXJyb3IpIGVkaXQgaW5zaWRlICcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IGxpbmVzID0gWydvbmUnLCAndHdvJywgJ3RocmVlJ107XG5cdFx0bW9kZWwuc2V0VmFsdWUobGluZXMuam9pbignXFxuJykpO1xuXHRcdGNvbnN0IHNlc3Npb24gPSBhd2FpdCBpbmxpbmVDaGF0U2Vzc2lvblNlcnZpY2UuY3JlYXRlU2Vzc2lvbihlZGl0b3IsIHt9LCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRhc3NlcnRUeXBlKHNlc3Npb24pO1xuXG5cdFx0YXdhaXQgbWFrZUVkaXRBc0FpKFtFZGl0T3BlcmF0aW9uLmluc2VydChuZXcgUG9zaXRpb24oMywgMSksICdBSSBXQVMgSEVSRVxcbicpXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24udGV4dE1vZGVsTi5nZXRWYWx1ZSgpLCBbJ29uZScsICd0d28nLCAnQUkgV0FTIEhFUkUnLCAndGhyZWUnXS5qb2luKCdcXG4nKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24udGV4dE1vZGVsMC5nZXRWYWx1ZSgpLCBsaW5lcy5qb2luKCdcXG4nKSk7XG5cblx0XHRtYWtlRWRpdChbRWRpdE9wZXJhdGlvbi5yZXBsYWNlKG5ldyBSYW5nZSgzLCA0LCAzLCA3KSwgJ3d3YWFhc3NzcycpXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24udGV4dE1vZGVsTi5nZXRWYWx1ZSgpLCBbJ29uZScsICd0d28nLCAnQUkgd3dhYWFzc3NzIEhFUkUnLCAndGhyZWUnXS5qb2luKCdcXG4nKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24udGV4dE1vZGVsMC5nZXRWYWx1ZSgpLCBbJ29uZScsICd0d28nLCAndGhyZWUnXS5qb2luKCdcXG4nKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0h1bmtEYXRhLCAobWlycm9yKSBlZGl0IGFmdGVyIGRpY2FyZCAnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBsaW5lcyA9IFsnb25lJywgJ3R3bycsICd0aHJlZSddO1xuXHRcdG1vZGVsLnNldFZhbHVlKGxpbmVzLmpvaW4oJ1xcbicpKTtcblx0XHRjb25zdCBzZXNzaW9uID0gYXdhaXQgaW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlLmNyZWF0ZVNlc3Npb24oZWRpdG9yLCB7fSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0YXNzZXJ0VHlwZShzZXNzaW9uKTtcblxuXHRcdGF3YWl0IG1ha2VFZGl0QXNBaShbRWRpdE9wZXJhdGlvbi5pbnNlcnQobmV3IFBvc2l0aW9uKDMsIDEpLCAnQUkgV0FTIEhFUkVcXG4nKV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uLnRleHRNb2RlbE4uZ2V0VmFsdWUoKSwgWydvbmUnLCAndHdvJywgJ0FJIFdBUyBIRVJFJywgJ3RocmVlJ10uam9pbignXFxuJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uLnRleHRNb2RlbDAuZ2V0VmFsdWUoKSwgbGluZXMuam9pbignXFxuJykpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24uaHVua0RhdGEuc2l6ZSwgMSk7XG5cdFx0Y29uc3QgW2h1bmtdID0gc2Vzc2lvbi5odW5rRGF0YS5nZXRJbmZvKCk7XG5cdFx0aHVuay5kaXNjYXJkQ2hhbmdlcygpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uLnRleHRNb2RlbE4uZ2V0VmFsdWUoKSwgbGluZXMuam9pbignXFxuJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uLnRleHRNb2RlbDAuZ2V0VmFsdWUoKSwgbGluZXMuam9pbignXFxuJykpO1xuXG5cdFx0bWFrZUVkaXQoW0VkaXRPcGVyYXRpb24ucmVwbGFjZShuZXcgUmFuZ2UoMywgNCwgMywgNiksICczMzMzJyldKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbi50ZXh0TW9kZWxOLmdldFZhbHVlKCksIFsnb25lJywgJ3R3bycsICd0aHIzMzMzJ10uam9pbignXFxuJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uLnRleHRNb2RlbDAuZ2V0VmFsdWUoKSwgWydvbmUnLCAndHdvJywgJ3RocjMzMzMnXS5qb2luKCdcXG4nKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0h1bmtEYXRhLCAobWlycm9yKSBlZGl0IGFmdGVyLCBtdWx0aSB0dXJuJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgbGluZXMgPSBbJ29uZScsICd0d28nLCAndGhyZWUnLCAnZm91cicsICdmaXZlJ107XG5cdFx0bW9kZWwuc2V0VmFsdWUobGluZXMuam9pbignXFxuJykpO1xuXG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IGF3YWl0IGlubGluZUNoYXRTZXNzaW9uU2VydmljZS5jcmVhdGVTZXNzaW9uKGVkaXRvciwge30sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdGFzc2VydFR5cGUoc2Vzc2lvbik7XG5cblx0XHRhd2FpdCBtYWtlRWRpdEFzQWkoW0VkaXRPcGVyYXRpb24uaW5zZXJ0KG5ldyBQb3NpdGlvbigzLCAxKSwgJ0FJX0VESVRcXG4nKV0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24uaHVua0RhdGEuc2l6ZSwgMSk7XG5cblx0XHRtYWtlRWRpdChbRWRpdE9wZXJhdGlvbi5pbnNlcnQobmV3IFBvc2l0aW9uKDUsIDEpLCAnRk9PJyldKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbi50ZXh0TW9kZWxOLmdldFZhbHVlKCksIFsnb25lJywgJ3R3bycsICdBSV9FRElUJywgJ3RocmVlJywgJ0ZPT2ZvdXInLCAnZml2ZSddLmpvaW4oJ1xcbicpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbi50ZXh0TW9kZWwwLmdldFZhbHVlKCksIFsnb25lJywgJ3R3bycsICd0aHJlZScsICdGT09mb3VyJywgJ2ZpdmUnXS5qb2luKCdcXG4nKSk7XG5cblx0XHRhd2FpdCBtYWtlRWRpdEFzQWkoW0VkaXRPcGVyYXRpb24uaW5zZXJ0KG5ldyBQb3NpdGlvbigyLCA0KSwgJyB6d2VpJyldKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbi5odW5rRGF0YS5zaXplLCAxKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uLnRleHRNb2RlbE4uZ2V0VmFsdWUoKSwgWydvbmUnLCAndHdvIHp3ZWknLCAnQUlfRURJVCcsICd0aHJlZScsICdGT09mb3VyJywgJ2ZpdmUnXS5qb2luKCdcXG4nKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24udGV4dE1vZGVsMC5nZXRWYWx1ZSgpLCBbJ29uZScsICd0d28nLCAndGhyZWUnLCAnRk9PZm91cicsICdmaXZlJ10uam9pbignXFxuJykpO1xuXG5cdFx0bWFrZUVkaXQoW0VkaXRPcGVyYXRpb24ucmVwbGFjZShuZXcgUmFuZ2UoNiwgMywgNiwgNSksICd2ZWZpdmVmaScpXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24udGV4dE1vZGVsTi5nZXRWYWx1ZSgpLCBbJ29uZScsICd0d28gendlaScsICdBSV9FRElUJywgJ3RocmVlJywgJ0ZPT2ZvdXInLCAnZml2ZWZpdmVmaSddLmpvaW4oJ1xcbicpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbi50ZXh0TW9kZWwwLmdldFZhbHVlKCksIFsnb25lJywgJ3R3bycsICd0aHJlZScsICdGT09mb3VyJywgJ2ZpdmVmaXZlZmknXS5qb2luKCdcXG4nKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0h1bmtEYXRhLCAobWlycm9yKSBlZGl0IGFmdGVyLCBtdWx0aSB0dXJuIDInLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBsaW5lcyA9IFsnb25lJywgJ3R3bycsICd0aHJlZScsICdmb3VyJywgJ2ZpdmUnXTtcblx0XHRtb2RlbC5zZXRWYWx1ZShsaW5lcy5qb2luKCdcXG4nKSk7XG5cblx0XHRjb25zdCBzZXNzaW9uID0gYXdhaXQgaW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlLmNyZWF0ZVNlc3Npb24oZWRpdG9yLCB7fSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0YXNzZXJ0VHlwZShzZXNzaW9uKTtcblxuXHRcdGF3YWl0IG1ha2VFZGl0QXNBaShbRWRpdE9wZXJhdGlvbi5pbnNlcnQobmV3IFBvc2l0aW9uKDMsIDEpLCAnQUlfRURJVFxcbicpXSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbi5odW5rRGF0YS5zaXplLCAxKTtcblxuXHRcdG1ha2VFZGl0KFtFZGl0T3BlcmF0aW9uLmluc2VydChuZXcgUG9zaXRpb24oNSwgMSksICdGT08nKV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uLnRleHRNb2RlbE4uZ2V0VmFsdWUoKSwgWydvbmUnLCAndHdvJywgJ0FJX0VESVQnLCAndGhyZWUnLCAnRk9PZm91cicsICdmaXZlJ10uam9pbignXFxuJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uLnRleHRNb2RlbDAuZ2V0VmFsdWUoKSwgWydvbmUnLCAndHdvJywgJ3RocmVlJywgJ0ZPT2ZvdXInLCAnZml2ZSddLmpvaW4oJ1xcbicpKTtcblxuXHRcdGF3YWl0IG1ha2VFZGl0QXNBaShbRWRpdE9wZXJhdGlvbi5pbnNlcnQobmV3IFBvc2l0aW9uKDIsIDQpLCAnendlaScpXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24uaHVua0RhdGEuc2l6ZSwgMSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbi50ZXh0TW9kZWxOLmdldFZhbHVlKCksIFsnb25lJywgJ3R3b3p3ZWknLCAnQUlfRURJVCcsICd0aHJlZScsICdGT09mb3VyJywgJ2ZpdmUnXS5qb2luKCdcXG4nKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24udGV4dE1vZGVsMC5nZXRWYWx1ZSgpLCBbJ29uZScsICd0d28nLCAndGhyZWUnLCAnRk9PZm91cicsICdmaXZlJ10uam9pbignXFxuJykpO1xuXG5cdFx0bWFrZUVkaXQoW0VkaXRPcGVyYXRpb24ucmVwbGFjZShuZXcgUmFuZ2UoNiwgMywgNiwgNSksICd2ZWZpdmVmaScpXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24udGV4dE1vZGVsTi5nZXRWYWx1ZSgpLCBbJ29uZScsICd0d296d2VpJywgJ0FJX0VESVQnLCAndGhyZWUnLCAnRk9PZm91cicsICdmaXZlZml2ZWZpJ10uam9pbignXFxuJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uLnRleHRNb2RlbDAuZ2V0VmFsdWUoKSwgWydvbmUnLCAndHdvJywgJ3RocmVlJywgJ0ZPT2ZvdXInLCAnZml2ZWZpdmVmaSddLmpvaW4oJ1xcbicpKTtcblxuXHRcdHNlc3Npb24uaHVua0RhdGEuZ2V0SW5mbygpWzBdLmFjY2VwdENoYW5nZXMoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbi50ZXh0TW9kZWxOLmdldFZhbHVlKCksIHNlc3Npb24udGV4dE1vZGVsMC5nZXRWYWx1ZSgpKTtcblxuXHRcdG1ha2VFZGl0KFtFZGl0T3BlcmF0aW9uLnJlcGxhY2UobmV3IFJhbmdlKDEsIDEsIDEsIDEpLCAnZG9uZScpXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24udGV4dE1vZGVsTi5nZXRWYWx1ZSgpLCBzZXNzaW9uLnRleHRNb2RlbDAuZ2V0VmFsdWUoKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0h1bmtEYXRhLCBhY2NlcHQsIGRpc2NhcmRBbGwnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBzZXNzaW9uID0gYXdhaXQgaW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlLmNyZWF0ZVNlc3Npb24oZWRpdG9yLCB7fSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0YXNzZXJ0VHlwZShzZXNzaW9uKTtcblxuXHRcdGF3YWl0IG1ha2VFZGl0QXNBaShbRWRpdE9wZXJhdGlvbi5pbnNlcnQobmV3IFBvc2l0aW9uKDEsIDEpLCAnQUlfRURJVFxcbicpLCBFZGl0T3BlcmF0aW9uLmluc2VydChuZXcgUG9zaXRpb24oMTAsIDEpLCAnQUlfRURJVFxcbicpXSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbi5odW5rRGF0YS5zaXplLCAyKTtcblx0XHRhc3NlcnQub2soIXNlc3Npb24udGV4dE1vZGVsMC5lcXVhbHNUZXh0QnVmZmVyKHNlc3Npb24udGV4dE1vZGVsTi5nZXRUZXh0QnVmZmVyKCkpKTtcblxuXHRcdGNvbnN0IHRleHRNb2RlTk5vdyA9IHNlc3Npb24udGV4dE1vZGVsTi5nZXRWYWx1ZSgpO1xuXG5cdFx0c2Vzc2lvbi5odW5rRGF0YS5nZXRJbmZvKClbMF0uYWNjZXB0Q2hhbmdlcygpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0TW9kZU5Ob3csIHNlc3Npb24udGV4dE1vZGVsTi5nZXRWYWx1ZSgpKTtcblxuXHRcdHNlc3Npb24uaHVua0RhdGEuZGlzY2FyZEFsbCgpOyAvLyBhbGwgcmVtYWluaW5nXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24udGV4dE1vZGVsTi5nZXRWYWx1ZSgpLCAnQUlfRURJVFxcbm9uZVxcbnR3b1xcbnRocmVlXFxuZm91clxcbmZpdmVcXG5zaXhcXG5zZXZlblxcbmVpZ2h0XFxubmluZVxcbnRlblxcbmVsZXZlbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uLnRleHRNb2RlbE4uZ2V0VmFsdWUoKSwgc2Vzc2lvbi50ZXh0TW9kZWwwLmdldFZhbHVlKCkpO1xuXG5cdFx0aW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlLnJlbGVhc2VTZXNzaW9uKHNlc3Npb24pO1xuXHR9KTtcblxuXHR0ZXN0KCdIdW5rRGF0YSwgZGlzY2FyZEFsbCByZXR1cm4gdW5kbyBlZGl0cycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IHNlc3Npb24gPSBhd2FpdCBpbmxpbmVDaGF0U2Vzc2lvblNlcnZpY2UuY3JlYXRlU2Vzc2lvbihlZGl0b3IsIHt9LCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRhc3NlcnRUeXBlKHNlc3Npb24pO1xuXG5cdFx0YXdhaXQgbWFrZUVkaXRBc0FpKFtFZGl0T3BlcmF0aW9uLmluc2VydChuZXcgUG9zaXRpb24oMSwgMSksICdBSV9FRElUXFxuJyksIEVkaXRPcGVyYXRpb24uaW5zZXJ0KG5ldyBQb3NpdGlvbigxMCwgMSksICdBSV9FRElUXFxuJyldKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uLmh1bmtEYXRhLnNpemUsIDIpO1xuXHRcdGFzc2VydC5vayghc2Vzc2lvbi50ZXh0TW9kZWwwLmVxdWFsc1RleHRCdWZmZXIoc2Vzc2lvbi50ZXh0TW9kZWxOLmdldFRleHRCdWZmZXIoKSkpO1xuXG5cdFx0Y29uc3QgdGV4dE1vZGVOTm93ID0gc2Vzc2lvbi50ZXh0TW9kZWxOLmdldFZhbHVlKCk7XG5cblx0XHRzZXNzaW9uLmh1bmtEYXRhLmdldEluZm8oKVswXS5hY2NlcHRDaGFuZ2VzKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRleHRNb2RlTk5vdywgc2Vzc2lvbi50ZXh0TW9kZWxOLmdldFZhbHVlKCkpO1xuXG5cdFx0Y29uc3QgdW5kb0VkaXRzID0gc2Vzc2lvbi5odW5rRGF0YS5kaXNjYXJkQWxsKCk7IC8vIGFsbCByZW1haW5pbmdcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbi50ZXh0TW9kZWxOLmdldFZhbHVlKCksICdBSV9FRElUXFxub25lXFxudHdvXFxudGhyZWVcXG5mb3VyXFxuZml2ZVxcbnNpeFxcbnNldmVuXFxuZWlnaHRcXG5uaW5lXFxudGVuXFxuZWxldmVuJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24udGV4dE1vZGVsTi5nZXRWYWx1ZSgpLCBzZXNzaW9uLnRleHRNb2RlbDAuZ2V0VmFsdWUoKSk7XG5cblx0XHQvLyB1bmRvIHRoZSBkaXNjYXJkc1xuXHRcdHNlc3Npb24udGV4dE1vZGVsTi5wdXNoRWRpdE9wZXJhdGlvbnMobnVsbCwgdW5kb0VkaXRzLCAoKSA9PiBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dE1vZGVOTm93LCBzZXNzaW9uLnRleHRNb2RlbE4uZ2V0VmFsdWUoKSk7XG5cblx0XHRpbmxpbmVDaGF0U2Vzc2lvblNlcnZpY2UucmVsZWFzZVNlc3Npb24oc2Vzc2lvbik7XG5cdH0pO1xuXG5cdHRlc3QoJ1ByZXNzaW5nIEVzY2FwZSBhZnRlciBpbmxpbmUgY2hhdCBlcnJvcmVkIHdpdGggXCJyZXNwb25zZSBmaWx0ZXJlZFwiIGxlYXZlcyBkb2N1bWVudCBkaXJ0eSAjNzc2NCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IG9yaWdWYWx1ZSA9IGBjbGFzcyBGb28ge1xuXHRwcml2YXRlIG9uRXJyb3IoZXJyb3I6IHN0cmluZyk6IHZvaWQge1xuXHRcdGlmICgvVGhlIHJlcXVlc3QgdGltZWQgb3V0fFRoZSBuZXR3b3JrIGNvbm5lY3Rpb24gd2FzIGxvc3QvaS50ZXN0KGVycm9yKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGVycm9yID0gZXJyb3IucmVwbGFjZSgvU2VlIGh0dHBzOlxcL1xcL2dpdGh1YlxcLmNvbVxcL1NxdWlycmVsXFwvU3F1aXJyZWxcXC5NYWNcXC9pc3N1ZXNcXC8xODIgZm9yIG1vcmUgaW5mb3JtYXRpb24vLCAnVGhpcyBtaWdodCBtZWFuIHRoZSBhcHBsaWNhdGlvbiB3YXMgcHV0IG9uIHF1YXJhbnRpbmUgYnkgbWFjT1MuIFNlZSBbdGhpcyBsaW5rXShodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvNzQyNiNpc3N1ZWNvbW1lbnQtNDI1MDkzNDY5KSBmb3IgbW9yZSBpbmZvcm1hdGlvbicpO1xuXG5cdFx0dGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLm5vdGlmeSh7XG5cdFx0XHRzZXZlcml0eTogU2V2ZXJpdHkuRXJyb3IsXG5cdFx0XHRtZXNzYWdlOiBlcnJvcixcblx0XHRcdHNvdXJjZTogbmxzLmxvY2FsaXplKCd1cGRhdGUgc2VydmljZScsIFwiVXBkYXRlIFNlcnZpY2VcIiksXG5cdFx0fSk7XG5cdH1cbn1gO1xuXHRcdG1vZGVsLnNldFZhbHVlKG9yaWdWYWx1ZSk7XG5cblx0XHRjb25zdCBzZXNzaW9uID0gYXdhaXQgaW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlLmNyZWF0ZVNlc3Npb24oZWRpdG9yLCB7fSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0YXNzZXJ0VHlwZShzZXNzaW9uKTtcblxuXHRcdGNvbnN0IGZha2VSZXF1ZXN0ID0gbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJQ2hhdFJlcXVlc3RNb2RlbD4oKSB7XG5cdFx0XHRvdmVycmlkZSBnZXQgaWQoKSB7IHJldHVybiAnb25lJzsgfVxuXHRcdH07XG5cdFx0c2Vzc2lvbi5tYXJrTW9kZWxWZXJzaW9uKGZha2VSZXF1ZXN0KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKS5nZXRMaW5lQ291bnQoKSwgMTUpO1xuXG5cdFx0YXdhaXQgbWFrZUVkaXRBc0FpKFtFZGl0T3BlcmF0aW9uLnJlcGxhY2UobmV3IFJhbmdlKDcsIDEsIDcsIE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKSwgYGVycm9yID0gZXJyb3IucmVwbGFjZShcblx0XHRcdC9TZWUgaHR0cHM6XFwvXFwvZ2l0aHViXFwuY29tXFwvU3F1aXJyZWxcXC9TcXVpcnJlbFxcLk1hY1xcL2lzc3Vlc1xcLzE4MiBmb3IgbW9yZSBpbmZvcm1hdGlvbi8sXG5cdFx0XHQnVGhpcyBtaWdodCBtZWFuIHRoZSBhcHBsaWNhdGlvbiB3YXMgcHV0IG9uIHF1YXJhbnRpbmUgYnkgbWFjT1MuIFNlZSBbdGhpcyBsaW5rXShodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvNzQyNiNpc3N1ZWNvbW1lbnQtNDI1MDkzNDY5KSBmb3IgbW9yZSBpbmZvcm1hdGlvbidcblx0XHQpO2ApXSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkuZ2V0TGluZUNvdW50KCksIDE4KTtcblxuXHRcdC8vIGNhbGxlZCB3aGVuIGEgcmVzcG9uc2UgZXJyb3JzIG91dFxuXHRcdGF3YWl0IHNlc3Npb24udW5kb0NoYW5nZXNVbnRpbChmYWtlUmVxdWVzdC5pZCk7XG5cdFx0YXdhaXQgc2Vzc2lvbi5odW5rRGF0YS5yZWNvbXB1dGUoeyBhcHBsaWVkOiAwLCBzaGExOiAnZmFrZVNoYTEnIH0sIHVuZGVmaW5lZCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkuZ2V0VmFsdWUoKSwgb3JpZ1ZhbHVlKTtcblxuXHRcdHNlc3Npb24uaHVua0RhdGEuZGlzY2FyZEFsbCgpOyAvLyBjYWxsZWQgd2hlbiBkaW1pc3NpbmcgdGhlIHNlc3Npb25cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkuZ2V0VmFsdWUoKSwgb3JpZ1ZhbHVlKTtcblx0fSk7XG5cblx0dGVzdCgnQXBwbHkgQ29kZVxcJ3MgcHJldmlldyBzaG91bGQgYmUgZWFzaWVyIHRvIHVuZG8vZXNjICM3NTM3JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdG1vZGVsLnNldFZhbHVlKGBleHBvcnQgZnVuY3Rpb24gZmliKG4pIHtcblx0aWYgKG4gPD0gMCkgcmV0dXJuIDA7XG5cdGlmIChuID09PSAxKSByZXR1cm4gMDtcblx0aWYgKG4gPT09IDIpIHJldHVybiAxO1xuXHRyZXR1cm4gZmliKG4gLSAxKSArIGZpYihuIC0gMik7XG59YCk7XG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IGF3YWl0IGlubGluZUNoYXRTZXNzaW9uU2VydmljZS5jcmVhdGVTZXNzaW9uKGVkaXRvciwge30sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdGFzc2VydFR5cGUoc2Vzc2lvbik7XG5cblx0XHRhd2FpdCBtYWtlRWRpdEFzQWkoW0VkaXRPcGVyYXRpb24ucmVwbGFjZShuZXcgUmFuZ2UoNSwgMSwgNiwgTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpLCBgXG5cdGxldCBhID0gMCwgYiA9IDEsIGM7XG5cdGZvciAobGV0IGkgPSAzOyBpIDw9IG47IGkrKykge1xuXHRcdGMgPSBhICsgYjtcblx0XHRhID0gYjtcblx0XHRiID0gYztcblx0fVxuXHRyZXR1cm4gYjtcbn1gKV0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24uaHVua0RhdGEuc2l6ZSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24uaHVua0RhdGEucGVuZGluZywgMSk7XG5cdFx0YXNzZXJ0Lm9rKHNlc3Npb24uaHVua0RhdGEuZ2V0SW5mbygpLmV2ZXJ5KGQgPT4gZC5nZXRTdGF0ZSgpID09PSBIdW5rU3RhdGUuUGVuZGluZykpO1xuXG5cdFx0YXdhaXQgYXNzZXJ0U25hcHNob3QoZWRpdG9yLmdldE1vZGVsKCkuZ2V0VmFsdWUoKSwgeyBuYW1lOiAnMScgfSk7XG5cblx0XHRhd2FpdCBtb2RlbC51bmRvKCk7XG5cdFx0YXdhaXQgYXNzZXJ0U25hcHNob3QoZWRpdG9yLmdldE1vZGVsKCkuZ2V0VmFsdWUoKSwgeyBuYW1lOiAnMicgfSk7XG5cblx0XHQvLyBvdmVybGFwcGluZyBlZGl0cyAoZXZlbiBVTkRPKSBtYXJrIGVkaXRzIGFzIGFjY2VwdGVkXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24uaHVua0RhdGEuc2l6ZSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb24uaHVua0RhdGEucGVuZGluZywgMCk7XG5cdFx0YXNzZXJ0Lm9rKHNlc3Npb24uaHVua0RhdGEuZ2V0SW5mbygpLmV2ZXJ5KGQgPT4gZC5nZXRTdGF0ZSgpID09PSBIdW5rU3RhdGUuQWNjZXB0ZWQpKTtcblxuXHRcdC8vIG5vIGZ1cnRoZXIgY2hhbmdlIHdoZW4gZGlzY2FyZGluZ1xuXHRcdHNlc3Npb24uaHVua0RhdGEuZGlzY2FyZEFsbCgpOyAvLyBDQU5DRUxcblx0XHRhd2FpdCBhc3NlcnRTbmFwc2hvdChlZGl0b3IuZ2V0TW9kZWwoKS5nZXRWYWx1ZSgpLCB7IG5hbWU6ICcyJyB9KTtcblx0fSk7XG5cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBSUEsT0FBTyxZQUFZO0FBQ25CLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsYUFBYTtBQUN0QixTQUFTLFlBQVk7QUFDckIsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyxzQ0FBc0M7QUFFL0MsU0FBUyxtQ0FBbUM7QUFDNUMsU0FBUyxhQUFhO0FBRXRCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMseUJBQXlCO0FBRWxDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsOEJBQStDO0FBQ3hELFNBQVMsOEJBQThCO0FBRXZDLFNBQVMsMkJBQTJCLDBCQUEwQjtBQUU5RCxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGlDQUFpQztBQUMxQyxTQUFTLG9DQUFvQztBQUM3QyxTQUFTLHFDQUFxQztBQUM5QyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLHlC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
