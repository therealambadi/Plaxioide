import assert from "assert";
import { equals } from "../../../../../base/common/arrays.js";
import { DeferredPromise, raceCancellation, timeout } from "../../../../../base/common/async.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { mock } from "../../../../../base/test/common/mock.js";
import { runWithFakedTimers } from "../../../../../base/test/common/timeTravelScheduler.js";
import { IDiffProviderFactoryService } from "../../../../../editor/browser/widget/diffEditor/diffProviderFactoryService.js";
import { EditOperation } from "../../../../../editor/common/core/editOperation.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { EndOfLineSequence } from "../../../../../editor/common/model.js";
import { IEditorWorkerService } from "../../../../../editor/common/services/editorWorker.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { TestDiffProviderFactoryService } from "../../../../../editor/test/browser/diff/testDiffProviderFactoryService.js";
import { instantiateTestCodeEditor } from "../../../../../editor/test/browser/testCodeEditor.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { SyncDescriptor } from "../../../../../platform/instantiation/common/descriptors.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { MockContextKeyService } from "../../../../../platform/keybinding/test/common/mockKeybindingService.js";
import { IEditorProgressService } from "../../../../../platform/progress/common/progress.js";
import { IViewDescriptorService } from "../../../../common/views.js";
import { IAccessibleViewService } from "../../../../../platform/accessibility/browser/accessibleView.js";
import { IChatAccessibilityService, IChatWidgetService } from "../../../chat/browser/chat.js";
import { ChatAgentService, IChatAgentNameService, IChatAgentService } from "../../../chat/common/chatAgents.js";
import { InlineChatController1, State } from "../../browser/inlineChatController.js";
import { CTX_INLINE_CHAT_RESPONSE_TYPE, InlineChatConfigKeys, InlineChatResponseType } from "../../common/inlineChat.js";
import { TestViewsService, workbenchInstantiationService } from "../../../../test/browser/workbenchTestServices.js";
import { IExtensionService, nullExtensionDescription } from "../../../../services/extensions/common/extensions.js";
import { IChatService } from "../../../chat/common/chatService.js";
import { ChatService } from "../../../chat/common/chatServiceImpl.js";
import { IChatVariablesService } from "../../../chat/common/chatVariables.js";
import { ILogService, NullLogService } from "../../../../../platform/log/common/log.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { NullTelemetryService } from "../../../../../platform/telemetry/common/telemetryUtils.js";
import { TestContextService, TestExtensionService } from "../../../../test/common/workbenchTestServices.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { IViewsService } from "../../../../services/views/common/viewsService.js";
import { ChatSlashCommandService, IChatSlashCommandService } from "../../../chat/common/chatSlashCommands.js";
import { ChatWidgetService } from "../../../chat/browser/chatWidget.js";
import { ChatWidgetHistoryService, IChatWidgetHistoryService } from "../../../chat/common/chatWidgetHistoryService.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { NullHoverService } from "../../../../../platform/hover/test/browser/nullHoverService.js";
import { ChatVariablesService } from "../../../chat/browser/chatVariables.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { TestCommandService } from "../../../../../editor/test/browser/editorTestServices.js";
import { INotebookEditorService } from "../../../notebook/browser/services/notebookEditorService.js";
import { RerunAction } from "../../browser/inlineChatActions.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { assertType } from "../../../../../base/common/types.js";
import { IWorkbenchAssignmentService } from "../../../../services/assignment/common/assignmentService.js";
import { NullWorkbenchAssignmentService } from "../../../../services/assignment/test/common/nullAssignmentService.js";
import { IInlineChatSessionService } from "../../browser/inlineChatSessionService.js";
import { InlineChatSessionServiceImpl } from "../../browser/inlineChatSessionServiceImpl.js";
import { TestWorkerService } from "./testWorkerService.js";
import { ILanguageModelsService, LanguageModelsService } from "../../../chat/common/languageModels.js";
import { IChatEditingService } from "../../../chat/common/chatEditingService.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { TextModelResolverService } from "../../../../services/textmodelResolver/common/textModelResolverService.js";
import { ChatInputBoxContentProvider } from "../../../chat/browser/chatEdinputInputContentProvider.js";
import { constObservable } from "../../../../../base/common/observable.js";
import { ILanguageModelToolsService } from "../../../chat/common/languageModelToolsService.js";
import { MockLanguageModelToolsService } from "../../../chat/test/common/mockLanguageModelToolsService.js";
import { ChatAgentLocation } from "../../../chat/common/constants.js";
suite("InlineChatController", function() {
  const agentData = {
    extensionId: nullExtensionDescription.identifier,
    publisherDisplayName: "",
    extensionDisplayName: "",
    extensionPublisherId: "",
    // id: 'testEditorAgent',
    name: "testEditorAgent",
    isDefault: true,
    locations: [ChatAgentLocation.Editor],
    metadata: {},
    slashCommands: [],
    disambiguation: []
  };
  const _TestController = class _TestController extends InlineChatController1 {
    constructor() {
      super(...arguments);
      this.onDidChangeState = this._onDidEnterState.event;
      this.states = [];
    }
    awaitStates(states) {
      const actual = [];
      return new Promise((resolve, reject) => {
        const d = this.onDidChangeState((state) => {
          actual.push(state);
          if (equals(states, actual)) {
            d.dispose();
            resolve(void 0);
          }
        });
        setTimeout(() => {
          d.dispose();
          resolve(`[${states.join(",")}] <> [${actual.join(",")}]`);
        }, 1e3);
      });
    }
  };
  _TestController.INIT_SEQUENCE = [State.CREATE_SESSION, State.INIT_UI, State.WAIT_FOR_INPUT];
  _TestController.INIT_SEQUENCE_AUTO_SEND = [..._TestController.INIT_SEQUENCE, State.SHOW_REQUEST, State.WAIT_FOR_INPUT];
  let TestController = _TestController;
  const store = new DisposableStore();
  let configurationService;
  let editor;
  let model;
  let ctrl;
  let contextKeyService;
  let chatService;
  let chatAgentService;
  let inlineChatSessionService;
  let instaService;
  let chatWidget;
  setup(function() {
    const serviceCollection = new ServiceCollection(
      [IConfigurationService, new TestConfigurationService()],
      [IChatVariablesService, new SyncDescriptor(ChatVariablesService)],
      [ILogService, new NullLogService()],
      [ITelemetryService, NullTelemetryService],
      [IHoverService, NullHoverService],
      [IExtensionService, new TestExtensionService()],
      [IContextKeyService, new MockContextKeyService()],
      [IViewsService, new class extends TestViewsService {
        async openView(id, focus) {
          return { widget: chatWidget ?? null };
        }
      }()],
      [IWorkspaceContextService, new TestContextService()],
      [IChatWidgetHistoryService, new SyncDescriptor(ChatWidgetHistoryService)],
      [IChatWidgetService, new SyncDescriptor(ChatWidgetService)],
      [IChatSlashCommandService, new SyncDescriptor(ChatSlashCommandService)],
      [IChatService, new SyncDescriptor(ChatService)],
      [IChatAgentNameService, new class extends mock() {
        getAgentNameRestriction(chatAgentData) {
          return false;
        }
      }()],
      [IEditorWorkerService, new SyncDescriptor(TestWorkerService)],
      [IContextKeyService, contextKeyService],
      [IChatAgentService, new SyncDescriptor(ChatAgentService)],
      [IDiffProviderFactoryService, new SyncDescriptor(TestDiffProviderFactoryService)],
      [IInlineChatSessionService, new SyncDescriptor(InlineChatSessionServiceImpl)],
      [ICommandService, new SyncDescriptor(TestCommandService)],
      [IChatEditingService, new class extends mock() {
        constructor() {
          super(...arguments);
          this.editingSessionsObs = constObservable([]);
        }
      }()],
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
      [IConfigurationService, configurationService],
      [IViewDescriptorService, new class extends mock() {
        constructor() {
          super(...arguments);
          this.onDidChangeLocation = Event.None;
        }
      }()],
      [INotebookEditorService, new class extends mock() {
        listNotebookEditors() {
          return [];
        }
      }()],
      [IWorkbenchAssignmentService, new NullWorkbenchAssignmentService()],
      [ILanguageModelsService, new SyncDescriptor(LanguageModelsService)],
      [ITextModelService, new SyncDescriptor(TextModelResolverService)],
      [ILanguageModelToolsService, new SyncDescriptor(MockLanguageModelToolsService)]
    );
    instaService = store.add(store.add(workbenchInstantiationService(void 0, store)).createChild(serviceCollection));
    configurationService = instaService.get(IConfigurationService);
    configurationService.setUserConfiguration("chat", { editor: { fontSize: 14, fontFamily: "default" } });
    configurationService.setUserConfiguration("editor", {});
    contextKeyService = instaService.get(IContextKeyService);
    chatService = instaService.get(IChatService);
    chatAgentService = instaService.get(IChatAgentService);
    inlineChatSessionService = store.add(instaService.get(IInlineChatSessionService));
    store.add(instaService.get(ILanguageModelsService));
    store.add(instaService.createInstance(ChatInputBoxContentProvider));
    model = store.add(instaService.get(IModelService).createModel("Hello\nWorld\nHello Again\nHello World\n", null));
    model.setEOL(EndOfLineSequence.LF);
    editor = store.add(instantiateTestCodeEditor(instaService, model));
    store.add(chatAgentService.registerDynamicAgent({ id: "testEditorAgent", ...agentData }, {
      async invoke(request, progress, history, token) {
        progress({
          kind: "textEdit",
          uri: model.uri,
          edits: [{
            range: new Range(1, 1, 1, 1),
            text: request.message
          }]
        });
        return {};
      }
    }));
  });
  teardown(function() {
    store.clear();
    ctrl?.dispose();
  });
  test("creation, not showing anything", function() {
    ctrl = instaService.createInstance(TestController, editor);
    assert.ok(ctrl);
    assert.strictEqual(ctrl.getWidgetPosition(), void 0);
  });
  test("run (show/hide)", async function() {
    ctrl = instaService.createInstance(TestController, editor);
    const actualStates = ctrl.awaitStates(TestController.INIT_SEQUENCE_AUTO_SEND);
    const run = ctrl.run({ message: "Hello", autoSend: true });
    assert.strictEqual(await actualStates, void 0);
    assert.ok(ctrl.getWidgetPosition() !== void 0);
    await ctrl.cancelSession();
    await run;
    assert.ok(ctrl.getWidgetPosition() === void 0);
  });
  test("wholeRange does not expand to whole lines, editor selection default", async function() {
    editor.setSelection(new Range(1, 1, 1, 3));
    ctrl = instaService.createInstance(TestController, editor);
    ctrl.run({});
    await Event.toPromise(Event.filter(ctrl.onDidChangeState, (e) => e === State.WAIT_FOR_INPUT));
    const session = inlineChatSessionService.getSession(editor, editor.getModel().uri);
    assert.ok(session);
    assert.deepStrictEqual(session.wholeRange.value, new Range(1, 1, 1, 3));
    await ctrl.cancelSession();
  });
  test("typing outside of wholeRange finishes session", async function() {
    configurationService.setUserConfiguration(InlineChatConfigKeys.FinishOnType, true);
    ctrl = instaService.createInstance(TestController, editor);
    const actualStates = ctrl.awaitStates(TestController.INIT_SEQUENCE_AUTO_SEND);
    const r = ctrl.run({ message: "Hello", autoSend: true });
    assert.strictEqual(await actualStates, void 0);
    const session = inlineChatSessionService.getSession(editor, editor.getModel().uri);
    assert.ok(session);
    assert.deepStrictEqual(session.wholeRange.value, new Range(
      1,
      1,
      1,
      11
      /* line length */
    ));
    editor.setSelection(new Range(2, 1, 2, 1));
    editor.trigger("test", "type", { text: "a" });
    assert.strictEqual(await ctrl.awaitStates([State.ACCEPT]), void 0);
    await r;
  });
  test("'whole range' isn't updated for edits outside whole range #4346", async function() {
    editor.setSelection(new Range(3, 1, 3, 3));
    store.add(chatAgentService.registerDynamicAgent({
      id: "testEditorAgent2",
      ...agentData
    }, {
      async invoke(request, progress, history, token) {
        progress({
          kind: "textEdit",
          uri: editor.getModel().uri,
          edits: [{
            range: new Range(1, 1, 1, 1),
            // EDIT happens outside of whole range
            text: `${request.message}
${request.message}`
          }]
        });
        return {};
      }
    }));
    ctrl = instaService.createInstance(TestController, editor);
    const p = ctrl.awaitStates(TestController.INIT_SEQUENCE);
    const r = ctrl.run({ message: "GENGEN", autoSend: false });
    assert.strictEqual(await p, void 0);
    const session = inlineChatSessionService.getSession(editor, editor.getModel().uri);
    assert.ok(session);
    assert.deepStrictEqual(session.wholeRange.value, new Range(3, 1, 3, 3));
    ctrl.chatWidget.setInput("GENGEN");
    ctrl.chatWidget.acceptInput();
    assert.strictEqual(await ctrl.awaitStates([State.SHOW_REQUEST, State.WAIT_FOR_INPUT]), void 0);
    assert.deepStrictEqual(session.wholeRange.value, new Range(1, 1, 4, 3));
    await ctrl.cancelSession();
    await r;
  });
  test("Stuck inline chat widget #211", async function() {
    store.add(chatAgentService.registerDynamicAgent({
      id: "testEditorAgent2",
      ...agentData
    }, {
      async invoke(request, progress, history, token) {
        return new Promise(() => {
        });
      }
    }));
    ctrl = instaService.createInstance(TestController, editor);
    const p = ctrl.awaitStates([...TestController.INIT_SEQUENCE, State.SHOW_REQUEST]);
    const r = ctrl.run({ message: "Hello", autoSend: true });
    assert.strictEqual(await p, void 0);
    ctrl.acceptSession();
    await r;
    assert.strictEqual(ctrl.getWidgetPosition(), void 0);
  });
  test("[Bug] Inline Chat's streaming pushed broken iterations to the undo stack #2403", async function() {
    store.add(chatAgentService.registerDynamicAgent({
      id: "testEditorAgent2",
      ...agentData
    }, {
      async invoke(request, progress, history, token) {
        progress({ kind: "textEdit", uri: model.uri, edits: [{ range: new Range(1, 1, 1, 1), text: "hEllo1\n" }] });
        progress({ kind: "textEdit", uri: model.uri, edits: [{ range: new Range(2, 1, 2, 1), text: "hEllo2\n" }] });
        progress({ kind: "textEdit", uri: model.uri, edits: [{ range: new Range(1, 1, 1e3, 1), text: "Hello1\nHello2\n" }] });
        return {};
      }
    }));
    const valueThen = editor.getModel().getValue();
    ctrl = instaService.createInstance(TestController, editor);
    const p = ctrl.awaitStates([...TestController.INIT_SEQUENCE, State.SHOW_REQUEST, State.WAIT_FOR_INPUT]);
    const r = ctrl.run({ message: "Hello", autoSend: true });
    assert.strictEqual(await p, void 0);
    ctrl.acceptSession();
    await r;
    assert.strictEqual(editor.getModel().getValue(), "Hello1\nHello2\n");
    editor.getModel().undo();
    assert.strictEqual(editor.getModel().getValue(), valueThen);
  });
  test.skip("UI is streaming edits minutes after the response is finished #3345", async function() {
    return runWithFakedTimers({ maxTaskCount: Number.MAX_SAFE_INTEGER }, async () => {
      store.add(chatAgentService.registerDynamicAgent({
        id: "testEditorAgent2",
        ...agentData
      }, {
        async invoke(request, progress, history, token) {
          const text = "${CSI}#a\n${CSI}#b\n${CSI}#c\n";
          await timeout(10);
          progress({ kind: "textEdit", uri: model.uri, edits: [{ range: new Range(1, 1, 1, 1), text }] });
          await timeout(10);
          progress({ kind: "textEdit", uri: model.uri, edits: [{ range: new Range(1, 1, 1, 1), text: text.repeat(1e3) + "DONE" }] });
          throw new Error("Too long");
        }
      }));
      ctrl = instaService.createInstance(TestController, editor);
      const p = ctrl.awaitStates([...TestController.INIT_SEQUENCE, State.SHOW_REQUEST, State.WAIT_FOR_INPUT]);
      const r = ctrl.run({ message: "Hello", autoSend: true });
      assert.strictEqual(await p, void 0);
      assert.ok(!editor.getModel().getValue().includes("DONE"));
      await timeout(10);
      assert.ok(!editor.getModel().getValue().includes("DONE"));
      await ctrl.cancelSession();
      await r;
    });
  });
  test("escape doesn't remove code added from inline editor chat #3523 1/2", async function() {
    ctrl = instaService.createInstance(TestController, editor);
    const p = ctrl.awaitStates([...TestController.INIT_SEQUENCE, State.SHOW_REQUEST, State.WAIT_FOR_INPUT]);
    const r = ctrl.run({ message: "GENERATED", autoSend: true });
    assert.strictEqual(await p, void 0);
    assert.ok(model.getValue().includes("GENERATED"));
    ctrl.cancelSession();
    await r;
    assert.ok(!model.getValue().includes("GENERATED"));
  });
  test("escape doesn't remove code added from inline editor chat #3523, 2/2", async function() {
    ctrl = instaService.createInstance(TestController, editor);
    const p = ctrl.awaitStates([...TestController.INIT_SEQUENCE, State.SHOW_REQUEST, State.WAIT_FOR_INPUT]);
    const r = ctrl.run({ message: "GENERATED", autoSend: true });
    assert.strictEqual(await p, void 0);
    assert.ok(model.getValue().includes("GENERATED"));
    editor.executeEdits("test", [EditOperation.insert(model.getFullModelRange().getEndPosition(), "MANUAL")]);
    ctrl.acceptSession();
    await r;
    assert.ok(model.getValue().includes("GENERATED"));
    assert.ok(model.getValue().includes("MANUAL"));
  });
  test("re-run should discard pending edits", async function() {
    let count = 1;
    store.add(chatAgentService.registerDynamicAgent({
      id: "testEditorAgent2",
      ...agentData
    }, {
      async invoke(request, progress, history, token) {
        progress({ kind: "textEdit", uri: model.uri, edits: [{ range: new Range(1, 1, 1, 1), text: request.message + count++ }] });
        return {};
      }
    }));
    ctrl = instaService.createInstance(TestController, editor);
    const rerun = new RerunAction();
    model.setValue("");
    const p = ctrl.awaitStates([...TestController.INIT_SEQUENCE, State.SHOW_REQUEST, State.WAIT_FOR_INPUT]);
    const r = ctrl.run({ message: "PROMPT_", autoSend: true });
    assert.strictEqual(await p, void 0);
    assert.strictEqual(model.getValue(), "PROMPT_1");
    const p2 = ctrl.awaitStates([State.SHOW_REQUEST, State.WAIT_FOR_INPUT]);
    await instaService.invokeFunction(rerun.runInlineChatCommand, ctrl, editor);
    assert.strictEqual(await p2, void 0);
    assert.strictEqual(model.getValue(), "PROMPT_2");
    ctrl.acceptSession();
    await r;
  });
  test("Retry undoes all changes, not just those from the request#5736", async function() {
    const text = [
      "eins-",
      "zwei-",
      "drei-"
    ];
    store.add(chatAgentService.registerDynamicAgent({
      id: "testEditorAgent2",
      ...agentData
    }, {
      async invoke(request, progress, history, token) {
        progress({ kind: "textEdit", uri: model.uri, edits: [{ range: new Range(1, 1, 1, 1), text: text.shift() ?? "" }] });
        return {};
      }
    }));
    ctrl = instaService.createInstance(TestController, editor);
    const rerun = new RerunAction();
    model.setValue("");
    const p = ctrl.awaitStates([...TestController.INIT_SEQUENCE, State.SHOW_REQUEST, State.WAIT_FOR_INPUT]);
    const r = ctrl.run({ message: "1", autoSend: true });
    assert.strictEqual(await p, void 0);
    assert.strictEqual(model.getValue(), "eins-");
    const p2 = ctrl.awaitStates([State.SHOW_REQUEST, State.WAIT_FOR_INPUT]);
    ctrl.chatWidget.setInput("1");
    await ctrl.chatWidget.acceptInput();
    assert.strictEqual(await p2, void 0);
    assert.strictEqual(model.getValue(), "zwei-eins-");
    const p3 = ctrl.awaitStates([State.SHOW_REQUEST, State.WAIT_FOR_INPUT]);
    await instaService.invokeFunction(rerun.runInlineChatCommand, ctrl, editor);
    assert.strictEqual(await p3, void 0);
    assert.strictEqual(model.getValue(), "drei-eins-");
    ctrl.acceptSession();
    await r;
  });
  test("moving inline chat to another model undoes changes", async function() {
    const text = [
      "eins\n",
      "zwei\n"
    ];
    store.add(chatAgentService.registerDynamicAgent({
      id: "testEditorAgent2",
      ...agentData
    }, {
      async invoke(request, progress, history, token) {
        progress({ kind: "textEdit", uri: model.uri, edits: [{ range: new Range(1, 1, 1, 1), text: text.shift() ?? "" }] });
        return {};
      }
    }));
    ctrl = instaService.createInstance(TestController, editor);
    const p = ctrl.awaitStates([...TestController.INIT_SEQUENCE, State.SHOW_REQUEST, State.WAIT_FOR_INPUT]);
    ctrl.run({ message: "1", autoSend: true });
    assert.strictEqual(await p, void 0);
    assert.strictEqual(model.getValue(), "eins\nHello\nWorld\nHello Again\nHello World\n");
    const targetModel = chatService.startSession(ChatAgentLocation.Editor, CancellationToken.None);
    store.add(targetModel);
    chatWidget = new class extends mock() {
      get viewModel() {
        return { model: targetModel };
      }
      focusLastMessage() {
      }
    }();
    const r = ctrl.joinCurrentRun();
    await ctrl.viewInChat();
    assert.strictEqual(model.getValue(), "Hello\nWorld\nHello Again\nHello World\n");
    await r;
  });
  test("moving inline chat to another model undoes changes (2 requests)", async function() {
    const text = [
      "eins\n",
      "zwei\n"
    ];
    store.add(chatAgentService.registerDynamicAgent({
      id: "testEditorAgent2",
      ...agentData
    }, {
      async invoke(request, progress, history, token) {
        progress({ kind: "textEdit", uri: model.uri, edits: [{ range: new Range(1, 1, 1, 1), text: text.shift() ?? "" }] });
        return {};
      }
    }));
    ctrl = instaService.createInstance(TestController, editor);
    const p = ctrl.awaitStates([...TestController.INIT_SEQUENCE, State.SHOW_REQUEST, State.WAIT_FOR_INPUT]);
    ctrl.run({ message: "1", autoSend: true });
    assert.strictEqual(await p, void 0);
    assert.strictEqual(model.getValue(), "eins\nHello\nWorld\nHello Again\nHello World\n");
    const p2 = ctrl.awaitStates([State.SHOW_REQUEST, State.WAIT_FOR_INPUT]);
    ctrl.chatWidget.setInput("1");
    await ctrl.chatWidget.acceptInput();
    assert.strictEqual(await p2, void 0);
    assert.strictEqual(model.getValue(), "zwei\neins\nHello\nWorld\nHello Again\nHello World\n");
    const targetModel = chatService.startSession(ChatAgentLocation.Editor, CancellationToken.None);
    store.add(targetModel);
    chatWidget = new class extends mock() {
      get viewModel() {
        return { model: targetModel };
      }
      focusLastMessage() {
      }
    }();
    const r = ctrl.joinCurrentRun();
    await ctrl.viewInChat();
    assert.strictEqual(model.getValue(), "Hello\nWorld\nHello Again\nHello World\n");
    await r;
  });
  test('Clicking "re-run without /doc" while a request is in progress closes the widget #5997', async function() {
    model.setValue("");
    let count = 0;
    const commandDetection = [];
    const onDidInvoke = new Emitter();
    store.add(chatAgentService.registerDynamicAgent({
      id: "testEditorAgent2",
      ...agentData
    }, {
      async invoke(request2, progress, history, token) {
        queueMicrotask(() => onDidInvoke.fire());
        commandDetection.push(request2.enableCommandDetection);
        progress({ kind: "textEdit", uri: model.uri, edits: [{ range: new Range(1, 1, 1, 1), text: request2.message + count++ }] });
        if (count === 1) {
          await raceCancellation(new Promise(() => {
          }), token);
        } else {
          await timeout(10);
        }
        return {};
      }
    }));
    ctrl = instaService.createInstance(TestController, editor);
    const p = Event.toPromise(onDidInvoke.event);
    ctrl.run({ message: "Hello-", autoSend: true });
    await p;
    const request = ctrl.chatWidget.viewModel?.model.getRequests().at(-1);
    assertType(request);
    const p2 = Event.toPromise(onDidInvoke.event);
    const p3 = ctrl.awaitStates([State.SHOW_REQUEST, State.WAIT_FOR_INPUT]);
    chatService.resendRequest(request, { noCommandDetection: true, attempt: request.attempt + 1, location: ChatAgentLocation.Editor });
    await p2;
    assert.strictEqual(await p3, void 0);
    assert.deepStrictEqual(commandDetection, [true, false]);
    assert.strictEqual(model.getValue(), "Hello-1");
  });
  test("Re-run without after request is done", async function() {
    model.setValue("");
    let count = 0;
    const commandDetection = [];
    store.add(chatAgentService.registerDynamicAgent({
      id: "testEditorAgent2",
      ...agentData
    }, {
      async invoke(request2, progress, history, token) {
        commandDetection.push(request2.enableCommandDetection);
        progress({ kind: "textEdit", uri: model.uri, edits: [{ range: new Range(1, 1, 1, 1), text: request2.message + count++ }] });
        return {};
      }
    }));
    ctrl = instaService.createInstance(TestController, editor);
    const p = ctrl.awaitStates([...TestController.INIT_SEQUENCE, State.SHOW_REQUEST, State.WAIT_FOR_INPUT]);
    ctrl.run({ message: "Hello-", autoSend: true });
    assert.strictEqual(await p, void 0);
    const request = ctrl.chatWidget.viewModel?.model.getRequests().at(-1);
    assertType(request);
    const p2 = ctrl.awaitStates([State.SHOW_REQUEST, State.WAIT_FOR_INPUT]);
    chatService.resendRequest(request, { noCommandDetection: true, attempt: request.attempt + 1, location: ChatAgentLocation.Editor });
    assert.strictEqual(await p2, void 0);
    assert.deepStrictEqual(commandDetection, [true, false]);
    assert.strictEqual(model.getValue(), "Hello-1");
  });
  test("Inline: Pressing Rerun request while the response streams breaks the response #5442", async function() {
    model.setValue("two\none\n");
    const attempts = [];
    const deferred = new DeferredPromise();
    store.add(chatAgentService.registerDynamicAgent({
      id: "testEditorAgent2",
      ...agentData
    }, {
      async invoke(request, progress, history, token) {
        attempts.push(request.attempt);
        progress({ kind: "textEdit", uri: model.uri, edits: [{ range: new Range(1, 1, 1, 1), text: `TRY:${request.attempt}
` }] });
        await raceCancellation(deferred.p, token);
        deferred.complete();
        await timeout(10);
        return {};
      }
    }));
    ctrl = instaService.createInstance(TestController, editor);
    const p = ctrl.awaitStates([...TestController.INIT_SEQUENCE, State.SHOW_REQUEST]);
    ctrl.run({ message: "Hello-", autoSend: true });
    assert.strictEqual(await p, void 0);
    await timeout(10);
    assert.deepStrictEqual(attempts, [0]);
    const p2 = ctrl.awaitStates([State.SHOW_REQUEST, State.WAIT_FOR_INPUT]);
    const rerun = new RerunAction();
    await instaService.invokeFunction(rerun.runInlineChatCommand, ctrl, editor);
    assert.strictEqual(await p2, void 0);
    assert.deepStrictEqual(attempts, [0, 1]);
    assert.strictEqual(model.getValue(), "TRY:1\ntwo\none\n");
  });
  test("Stopping/cancelling a request should NOT undo its changes", async function() {
    model.setValue("World");
    const deferred = new DeferredPromise();
    let progress;
    store.add(chatAgentService.registerDynamicAgent({
      id: "testEditorAgent2",
      ...agentData
    }, {
      async invoke(request, _progress, history, token) {
        progress = _progress;
        await deferred.p;
        return {};
      }
    }));
    ctrl = instaService.createInstance(TestController, editor);
    const p = ctrl.awaitStates([...TestController.INIT_SEQUENCE, State.SHOW_REQUEST]);
    ctrl.run({ message: "Hello", autoSend: true });
    await timeout(10);
    assert.strictEqual(await p, void 0);
    assertType(progress);
    const modelChange = new Promise((resolve) => model.onDidChangeContent(() => resolve()));
    progress({ kind: "textEdit", uri: model.uri, edits: [{ range: new Range(1, 1, 1, 1), text: "Hello-Hello" }] });
    await modelChange;
    assert.strictEqual(model.getValue(), "HelloWorld");
    const p2 = ctrl.awaitStates([State.WAIT_FOR_INPUT]);
    chatService.cancelCurrentRequestForSession(ctrl.chatWidget.viewModel.model.sessionId);
    assert.strictEqual(await p2, void 0);
    assert.strictEqual(model.getValue(), "HelloWorld");
  });
  test("Apply Edits from existing session w/ edits", async function() {
    model.setValue("");
    const newSession = await inlineChatSessionService.createSession(editor, {}, CancellationToken.None);
    assertType(newSession);
    await (await chatService.sendRequest(newSession.chatModel.sessionId, "Existing", { location: ChatAgentLocation.Editor }))?.responseCreatedPromise;
    assert.strictEqual(newSession.chatModel.requestInProgress, true);
    const response = newSession.chatModel.lastRequest?.response;
    assertType(response);
    await new Promise((resolve) => {
      if (response.isComplete) {
        resolve(void 0);
      }
      const d = response.onDidChange(() => {
        if (response.isComplete) {
          d.dispose();
          resolve(void 0);
        }
      });
    });
    ctrl = instaService.createInstance(TestController, editor);
    const p = ctrl.awaitStates([...TestController.INIT_SEQUENCE]);
    ctrl.run({ existingSession: newSession });
    assert.strictEqual(await p, void 0);
    assert.strictEqual(model.getValue(), "Existing");
  });
  test("Undo on error (2 rounds)", async function() {
    return runWithFakedTimers({}, async () => {
      store.add(chatAgentService.registerDynamicAgent({ id: "testEditorAgent", ...agentData }, {
        async invoke(request, progress, history, token) {
          progress({
            kind: "textEdit",
            uri: model.uri,
            edits: [{
              range: new Range(1, 1, 1, 1),
              text: request.message
            }]
          });
          if (request.message === "two") {
            await timeout(100);
            return {
              errorDetails: { message: "FAILED" }
            };
          }
          return {};
        }
      }));
      model.setValue("");
      ctrl = instaService.createInstance(TestController, editor);
      const p = ctrl.awaitStates([...TestController.INIT_SEQUENCE, State.SHOW_REQUEST, State.WAIT_FOR_INPUT]);
      ctrl.run({ autoSend: true, message: "one" });
      assert.strictEqual(await p, void 0);
      assert.strictEqual(model.getValue(), "one");
      const p2 = ctrl.awaitStates([State.SHOW_REQUEST, State.WAIT_FOR_INPUT]);
      const values = /* @__PURE__ */ new Set();
      store.add(model.onDidChangeContent(() => values.add(model.getValue())));
      ctrl.chatWidget.acceptInput("two");
      assert.strictEqual(await p2, void 0);
      assert.strictEqual(model.getValue(), "one");
      assert.ok(values.has("twoone"));
    });
  });
  test('Inline chat "discard" button does not always appear if response is stopped #228030', async function() {
    model.setValue("World");
    const deferred = new DeferredPromise();
    store.add(chatAgentService.registerDynamicAgent({
      id: "testEditorAgent2",
      ...agentData
    }, {
      async invoke(request, progress, history, token) {
        progress({ kind: "textEdit", uri: model.uri, edits: [{ range: new Range(1, 1, 1, 1), text: "Hello-Hello" }] });
        await deferred.p;
        return {};
      }
    }));
    ctrl = instaService.createInstance(TestController, editor);
    const p = ctrl.awaitStates([...TestController.INIT_SEQUENCE, State.SHOW_REQUEST]);
    ctrl.run({ message: "Hello", autoSend: true });
    assert.strictEqual(await p, void 0);
    const p2 = ctrl.awaitStates([State.WAIT_FOR_INPUT]);
    chatService.cancelCurrentRequestForSession(ctrl.chatWidget.viewModel.model.sessionId);
    assert.strictEqual(await p2, void 0);
    const value = contextKeyService.getContextKeyValue(CTX_INLINE_CHAT_RESPONSE_TYPE.key);
    assert.notStrictEqual(value, InlineChatResponseType.None);
  });
  test("Restore doesn't edit on errored result", async function() {
    return runWithFakedTimers({ useFakeTimers: true }, async () => {
      const model2 = store.add(instaService.get(IModelService).createModel("ABC", null));
      model.setValue("World");
      store.add(chatAgentService.registerDynamicAgent({
        id: "testEditorAgent2",
        ...agentData
      }, {
        async invoke(request, progress, history, token) {
          progress({ kind: "textEdit", uri: model.uri, edits: [{ range: new Range(1, 1, 1, 1), text: "Hello1" }] });
          await timeout(100);
          progress({ kind: "textEdit", uri: model.uri, edits: [{ range: new Range(1, 1, 1, 1), text: "Hello2" }] });
          await timeout(100);
          progress({ kind: "textEdit", uri: model.uri, edits: [{ range: new Range(1, 1, 1, 1), text: "Hello3" }] });
          await timeout(100);
          return {
            errorDetails: { message: "FAILED" }
          };
        }
      }));
      ctrl = instaService.createInstance(TestController, editor);
      const p = ctrl.awaitStates([...TestController.INIT_SEQUENCE, State.SHOW_REQUEST, State.WAIT_FOR_INPUT]);
      ctrl.run({ message: "Hello", autoSend: true });
      assert.strictEqual(await p, void 0);
      const p2 = ctrl.awaitStates([State.PAUSE]);
      editor.setModel(model2);
      assert.strictEqual(await p2, void 0);
      const p3 = ctrl.awaitStates([...TestController.INIT_SEQUENCE]);
      editor.setModel(model);
      assert.strictEqual(await p3, void 0);
      assert.strictEqual(model.getValue(), "World");
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9pbmxpbmVDaGF0L3Rlc3QvYnJvd3Nlci9pbmxpbmVDaGF0Q29udHJvbGxlci50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgZXF1YWxzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IERlZmVycmVkUHJvbWlzZSwgcmFjZUNhbmNlbGxhdGlvbiwgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IG1vY2sgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL21vY2suanMnO1xuaW1wb3J0IHsgcnVuV2l0aEZha2VkVGltZXJzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi90aW1lVHJhdmVsU2NoZWR1bGVyLmpzJztcbmltcG9ydCB7IElBY3RpdmVDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBJRGlmZlByb3ZpZGVyRmFjdG9yeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci93aWRnZXQvZGlmZkVkaXRvci9kaWZmUHJvdmlkZXJGYWN0b3J5U2VydmljZS5qcyc7XG5pbXBvcnQgeyBFZGl0T3BlcmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL2VkaXRPcGVyYXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgRW5kT2ZMaW5lU2VxdWVuY2UsIElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElFZGl0b3JXb3JrZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9lZGl0b3JXb3JrZXIuanMnO1xuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0IHsgVGVzdERpZmZQcm92aWRlckZhY3RvcnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL3Rlc3QvYnJvd3Nlci9kaWZmL3Rlc3REaWZmUHJvdmlkZXJGYWN0b3J5U2VydmljZS5qcyc7XG5pbXBvcnQgeyBpbnN0YW50aWF0ZVRlc3RDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL3Rlc3QvYnJvd3Nlci90ZXN0Q29kZUVkaXRvci5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vdGVzdC9jb21tb24vdGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgU3luY0Rlc2NyaXB0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9kZXNjcmlwdG9ycy5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL3NlcnZpY2VDb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vdGVzdC9jb21tb24vaW5zdGFudGlhdGlvblNlcnZpY2VNb2NrLmpzJztcbmltcG9ydCB7IE1vY2tDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvdGVzdC9jb21tb24vbW9ja0tleWJpbmRpbmdTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JQcm9ncmVzc1NlcnZpY2UsIElQcm9ncmVzc1J1bm5lciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyBJVmlldywgSVZpZXdEZXNjcmlwdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi92aWV3cy5qcyc7XG5pbXBvcnQgeyBBY2Nlc3NpYmlsaXR5VmVyYm9zaXR5U2V0dGluZ0lkIH0gZnJvbSAnLi4vLi4vLi4vYWNjZXNzaWJpbGl0eS9icm93c2VyL2FjY2Vzc2liaWxpdHlDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElBY2Nlc3NpYmxlVmlld1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5L2Jyb3dzZXIvYWNjZXNzaWJsZVZpZXcuanMnO1xuaW1wb3J0IHsgSUNoYXRBY2Nlc3NpYmlsaXR5U2VydmljZSwgSUNoYXRXaWRnZXQsIElDaGF0V2lkZ2V0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NoYXQvYnJvd3Nlci9jaGF0LmpzJztcbmltcG9ydCB7IENoYXRBZ2VudFNlcnZpY2UsIElDaGF0QWdlbnREYXRhLCBJQ2hhdEFnZW50TmFtZVNlcnZpY2UsIElDaGF0QWdlbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY2hhdC9jb21tb24vY2hhdEFnZW50cy5qcyc7XG5pbXBvcnQgeyBJQ2hhdFJlc3BvbnNlVmlld01vZGVsIH0gZnJvbSAnLi4vLi4vLi4vY2hhdC9jb21tb24vY2hhdFZpZXdNb2RlbC5qcyc7XG5pbXBvcnQgeyBJbmxpbmVDaGF0Q29udHJvbGxlcjEsIFN0YXRlIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9pbmxpbmVDaGF0Q29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyBDVFhfSU5MSU5FX0NIQVRfUkVTUE9OU0VfVFlQRSwgSW5saW5lQ2hhdENvbmZpZ0tleXMsIElubGluZUNoYXRSZXNwb25zZVR5cGUgfSBmcm9tICcuLi8uLi9jb21tb24vaW5saW5lQ2hhdC5qcyc7XG5pbXBvcnQgeyBUZXN0Vmlld3NTZXJ2aWNlLCB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvYnJvd3Nlci93b3JrYmVuY2hUZXN0U2VydmljZXMuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblNlcnZpY2UsIG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUNoYXRQcm9ncmVzcywgSUNoYXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY2hhdC9jb21tb24vY2hhdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ2hhdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jaGF0L2NvbW1vbi9jaGF0U2VydmljZUltcGwuanMnO1xuaW1wb3J0IHsgSUNoYXRWYXJpYWJsZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY2hhdC9jb21tb24vY2hhdFZhcmlhYmxlcy5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSwgTnVsbExvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IE51bGxUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnlVdGlscy5qcyc7XG5pbXBvcnQgeyBUZXN0Q29udGV4dFNlcnZpY2UsIFRlc3RFeHRlbnNpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9jb21tb24vd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElWaWV3c1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy92aWV3cy9jb21tb24vdmlld3NTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENoYXRTbGFzaENvbW1hbmRTZXJ2aWNlLCBJQ2hhdFNsYXNoQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jaGF0L2NvbW1vbi9jaGF0U2xhc2hDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBDaGF0V2lkZ2V0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NoYXQvYnJvd3Nlci9jaGF0V2lkZ2V0LmpzJztcbmltcG9ydCB7IENoYXRXaWRnZXRIaXN0b3J5U2VydmljZSwgSUNoYXRXaWRnZXRIaXN0b3J5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NoYXQvY29tbW9uL2NoYXRXaWRnZXRIaXN0b3J5U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBOdWxsSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvdGVzdC9icm93c2VyL251bGxIb3ZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ2hhdFZhcmlhYmxlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jaGF0L2Jyb3dzZXIvY2hhdFZhcmlhYmxlcy5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgVGVzdENvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL3Rlc3QvYnJvd3Nlci9lZGl0b3JUZXN0U2VydmljZXMuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL25vdGVib29rL2Jyb3dzZXIvc2VydmljZXMvbm90ZWJvb2tFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFJlcnVuQWN0aW9uIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9pbmxpbmVDaGF0QWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBhc3NlcnRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEFzc2lnbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvYXNzaWdubWVudC9jb21tb24vYXNzaWdubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgTnVsbFdvcmtiZW5jaEFzc2lnbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvYXNzaWdubWVudC90ZXN0L2NvbW1vbi9udWxsQXNzaWdubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUlubGluZUNoYXRTZXNzaW9uU2VydmljZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvaW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElubGluZUNoYXRTZXNzaW9uU2VydmljZUltcGwgfSBmcm9tICcuLi8uLi9icm93c2VyL2lubGluZUNoYXRTZXNzaW9uU2VydmljZUltcGwuanMnO1xuaW1wb3J0IHsgVGVzdFdvcmtlclNlcnZpY2UgfSBmcm9tICcuL3Rlc3RXb3JrZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZU1vZGVsc1NlcnZpY2UsIExhbmd1YWdlTW9kZWxzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NoYXQvY29tbW9uL2xhbmd1YWdlTW9kZWxzLmpzJztcbmltcG9ydCB7IElDaGF0RWRpdGluZ1NlcnZpY2UsIElDaGF0RWRpdGluZ1Nlc3Npb24gfSBmcm9tICcuLi8uLi8uLi9jaGF0L2NvbW1vbi9jaGF0RWRpdGluZ1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3Jlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUZXh0TW9kZWxSZXNvbHZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy90ZXh0bW9kZWxSZXNvbHZlci9jb21tb24vdGV4dE1vZGVsUmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENoYXRJbnB1dEJveENvbnRlbnRQcm92aWRlciB9IGZyb20gJy4uLy4uLy4uL2NoYXQvYnJvd3Nlci9jaGF0RWRpbnB1dElucHV0Q29udGVudFByb3ZpZGVyLmpzJztcbmltcG9ydCB7IGNvbnN0T2JzZXJ2YWJsZSwgSU9ic2VydmFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZU1vZGVsVG9vbHNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY2hhdC9jb21tb24vbGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBNb2NrTGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NoYXQvdGVzdC9jb21tb24vbW9ja0xhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ2hhdEFnZW50TG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi9jaGF0L2NvbW1vbi9jb25zdGFudHMuanMnO1xuXG5zdWl0ZSgnSW5saW5lQ2hhdENvbnRyb2xsZXInLCBmdW5jdGlvbiAoKSB7XG5cblx0Y29uc3QgYWdlbnREYXRhID0ge1xuXHRcdGV4dGVuc2lvbklkOiBudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24uaWRlbnRpZmllcixcblx0XHRwdWJsaXNoZXJEaXNwbGF5TmFtZTogJycsXG5cdFx0ZXh0ZW5zaW9uRGlzcGxheU5hbWU6ICcnLFxuXHRcdGV4dGVuc2lvblB1Ymxpc2hlcklkOiAnJyxcblx0XHQvLyBpZDogJ3Rlc3RFZGl0b3JBZ2VudCcsXG5cdFx0bmFtZTogJ3Rlc3RFZGl0b3JBZ2VudCcsXG5cdFx0aXNEZWZhdWx0OiB0cnVlLFxuXHRcdGxvY2F0aW9uczogW0NoYXRBZ2VudExvY2F0aW9uLkVkaXRvcl0sXG5cdFx0bWV0YWRhdGE6IHt9LFxuXHRcdHNsYXNoQ29tbWFuZHM6IFtdLFxuXHRcdGRpc2FtYmlndWF0aW9uOiBbXSxcblx0fTtcblxuXHRjbGFzcyBUZXN0Q29udHJvbGxlciBleHRlbmRzIElubGluZUNoYXRDb250cm9sbGVyMSB7XG5cblx0XHRzdGF0aWMgSU5JVF9TRVFVRU5DRTogcmVhZG9ubHkgU3RhdGVbXSA9IFtTdGF0ZS5DUkVBVEVfU0VTU0lPTiwgU3RhdGUuSU5JVF9VSSwgU3RhdGUuV0FJVF9GT1JfSU5QVVRdO1xuXHRcdHN0YXRpYyBJTklUX1NFUVVFTkNFX0FVVE9fU0VORDogcmVhZG9ubHkgU3RhdGVbXSA9IFsuLi50aGlzLklOSVRfU0VRVUVOQ0UsIFN0YXRlLlNIT1dfUkVRVUVTVCwgU3RhdGUuV0FJVF9GT1JfSU5QVVRdO1xuXG5cblx0XHRyZWFkb25seSBvbkRpZENoYW5nZVN0YXRlOiBFdmVudDxTdGF0ZT4gPSB0aGlzLl9vbkRpZEVudGVyU3RhdGUuZXZlbnQ7XG5cblx0XHRyZWFkb25seSBzdGF0ZXM6IHJlYWRvbmx5IFN0YXRlW10gPSBbXTtcblxuXHRcdGF3YWl0U3RhdGVzKHN0YXRlczogcmVhZG9ubHkgU3RhdGVbXSk6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7XG5cdFx0XHRjb25zdCBhY3R1YWw6IFN0YXRlW10gPSBbXTtcblxuXHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0XHRjb25zdCBkID0gdGhpcy5vbkRpZENoYW5nZVN0YXRlKHN0YXRlID0+IHtcblx0XHRcdFx0XHRhY3R1YWwucHVzaChzdGF0ZSk7XG5cdFx0XHRcdFx0aWYgKGVxdWFscyhzdGF0ZXMsIGFjdHVhbCkpIHtcblx0XHRcdFx0XHRcdGQuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdFx0cmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0c2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdFx0ZC5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0cmVzb2x2ZShgWyR7c3RhdGVzLmpvaW4oJywnKX1dIDw+IFske2FjdHVhbC5qb2luKCcsJyl9XWApO1xuXHRcdFx0XHR9LCAxMDAwKTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRsZXQgY29uZmlndXJhdGlvblNlcnZpY2U6IFRlc3RDb25maWd1cmF0aW9uU2VydmljZTtcblx0bGV0IGVkaXRvcjogSUFjdGl2ZUNvZGVFZGl0b3I7XG5cdGxldCBtb2RlbDogSVRleHRNb2RlbDtcblx0bGV0IGN0cmw6IFRlc3RDb250cm9sbGVyO1xuXHRsZXQgY29udGV4dEtleVNlcnZpY2U6IE1vY2tDb250ZXh0S2V5U2VydmljZTtcblx0bGV0IGNoYXRTZXJ2aWNlOiBJQ2hhdFNlcnZpY2U7XG5cdGxldCBjaGF0QWdlbnRTZXJ2aWNlOiBJQ2hhdEFnZW50U2VydmljZTtcblx0bGV0IGlubGluZUNoYXRTZXNzaW9uU2VydmljZTogSUlubGluZUNoYXRTZXNzaW9uU2VydmljZTtcblx0bGV0IGluc3RhU2VydmljZTogVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXG5cdGxldCBjaGF0V2lkZ2V0OiBJQ2hhdFdpZGdldDtcblxuXHRzZXR1cChmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBzZXJ2aWNlQ29sbGVjdGlvbiA9IG5ldyBTZXJ2aWNlQ29sbGVjdGlvbihcblx0XHRcdFtJQ29uZmlndXJhdGlvblNlcnZpY2UsIG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoKV0sXG5cdFx0XHRbSUNoYXRWYXJpYWJsZXNTZXJ2aWNlLCBuZXcgU3luY0Rlc2NyaXB0b3IoQ2hhdFZhcmlhYmxlc1NlcnZpY2UpXSxcblx0XHRcdFtJTG9nU2VydmljZSwgbmV3IE51bGxMb2dTZXJ2aWNlKCldLFxuXHRcdFx0W0lUZWxlbWV0cnlTZXJ2aWNlLCBOdWxsVGVsZW1ldHJ5U2VydmljZV0sXG5cdFx0XHRbSUhvdmVyU2VydmljZSwgTnVsbEhvdmVyU2VydmljZV0sXG5cdFx0XHRbSUV4dGVuc2lvblNlcnZpY2UsIG5ldyBUZXN0RXh0ZW5zaW9uU2VydmljZSgpXSxcblx0XHRcdFtJQ29udGV4dEtleVNlcnZpY2UsIG5ldyBNb2NrQ29udGV4dEtleVNlcnZpY2UoKV0sXG5cdFx0XHRbSVZpZXdzU2VydmljZSwgbmV3IGNsYXNzIGV4dGVuZHMgVGVzdFZpZXdzU2VydmljZSB7XG5cdFx0XHRcdG92ZXJyaWRlIGFzeW5jIG9wZW5WaWV3PFQgZXh0ZW5kcyBJVmlldz4oaWQ6IHN0cmluZywgZm9jdXM/OiBib29sZWFuIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxUIHwgbnVsbD4ge1xuXHRcdFx0XHRcdHJldHVybiB7IHdpZGdldDogY2hhdFdpZGdldCA/PyBudWxsIH0gYXMgYW55O1xuXHRcdFx0XHR9XG5cdFx0XHR9KCldLFxuXHRcdFx0W0lXb3Jrc3BhY2VDb250ZXh0U2VydmljZSwgbmV3IFRlc3RDb250ZXh0U2VydmljZSgpXSxcblx0XHRcdFtJQ2hhdFdpZGdldEhpc3RvcnlTZXJ2aWNlLCBuZXcgU3luY0Rlc2NyaXB0b3IoQ2hhdFdpZGdldEhpc3RvcnlTZXJ2aWNlKV0sXG5cdFx0XHRbSUNoYXRXaWRnZXRTZXJ2aWNlLCBuZXcgU3luY0Rlc2NyaXB0b3IoQ2hhdFdpZGdldFNlcnZpY2UpXSxcblx0XHRcdFtJQ2hhdFNsYXNoQ29tbWFuZFNlcnZpY2UsIG5ldyBTeW5jRGVzY3JpcHRvcihDaGF0U2xhc2hDb21tYW5kU2VydmljZSldLFxuXHRcdFx0W0lDaGF0U2VydmljZSwgbmV3IFN5bmNEZXNjcmlwdG9yKENoYXRTZXJ2aWNlKV0sXG5cdFx0XHRbSUNoYXRBZ2VudE5hbWVTZXJ2aWNlLCBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElDaGF0QWdlbnROYW1lU2VydmljZT4oKSB7XG5cdFx0XHRcdG92ZXJyaWRlIGdldEFnZW50TmFtZVJlc3RyaWN0aW9uKGNoYXRBZ2VudERhdGE6IElDaGF0QWdlbnREYXRhKTogYm9vbGVhbiB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XSxcblx0XHRcdFtJRWRpdG9yV29ya2VyU2VydmljZSwgbmV3IFN5bmNEZXNjcmlwdG9yKFRlc3RXb3JrZXJTZXJ2aWNlKV0sXG5cdFx0XHRbSUNvbnRleHRLZXlTZXJ2aWNlLCBjb250ZXh0S2V5U2VydmljZV0sXG5cdFx0XHRbSUNoYXRBZ2VudFNlcnZpY2UsIG5ldyBTeW5jRGVzY3JpcHRvcihDaGF0QWdlbnRTZXJ2aWNlKV0sXG5cdFx0XHRbSURpZmZQcm92aWRlckZhY3RvcnlTZXJ2aWNlLCBuZXcgU3luY0Rlc2NyaXB0b3IoVGVzdERpZmZQcm92aWRlckZhY3RvcnlTZXJ2aWNlKV0sXG5cdFx0XHRbSUlubGluZUNoYXRTZXNzaW9uU2VydmljZSwgbmV3IFN5bmNEZXNjcmlwdG9yKElubGluZUNoYXRTZXNzaW9uU2VydmljZUltcGwpXSxcblx0XHRcdFtJQ29tbWFuZFNlcnZpY2UsIG5ldyBTeW5jRGVzY3JpcHRvcihUZXN0Q29tbWFuZFNlcnZpY2UpXSxcblx0XHRcdFtJQ2hhdEVkaXRpbmdTZXJ2aWNlLCBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElDaGF0RWRpdGluZ1NlcnZpY2U+KCkge1xuXHRcdFx0XHRvdmVycmlkZSBlZGl0aW5nU2Vzc2lvbnNPYnM6IElPYnNlcnZhYmxlPHJlYWRvbmx5IElDaGF0RWRpdGluZ1Nlc3Npb25bXT4gPSBjb25zdE9ic2VydmFibGUoW10pO1xuXHRcdFx0fV0sXG5cdFx0XHRbSUVkaXRvclByb2dyZXNzU2VydmljZSwgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJRWRpdG9yUHJvZ3Jlc3NTZXJ2aWNlPigpIHtcblx0XHRcdFx0b3ZlcnJpZGUgc2hvdyh0b3RhbDogdW5rbm93biwgZGVsYXk/OiB1bmtub3duKTogSVByb2dyZXNzUnVubmVyIHtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0dG90YWwoKSB7IH0sXG5cdFx0XHRcdFx0XHR3b3JrZWQodmFsdWUpIHsgfSxcblx0XHRcdFx0XHRcdGRvbmUoKSB7IH0sXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXHRcdFx0fV0sXG5cdFx0XHRbSUNoYXRBY2Nlc3NpYmlsaXR5U2VydmljZSwgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJQ2hhdEFjY2Vzc2liaWxpdHlTZXJ2aWNlPigpIHtcblx0XHRcdFx0b3ZlcnJpZGUgYWNjZXB0UmVzcG9uc2UocmVzcG9uc2U6IElDaGF0UmVzcG9uc2VWaWV3TW9kZWwgfCB1bmRlZmluZWQsIHJlcXVlc3RJZDogbnVtYmVyKTogdm9pZCB7IH1cblx0XHRcdFx0b3ZlcnJpZGUgYWNjZXB0UmVxdWVzdCgpOiBudW1iZXIgeyByZXR1cm4gLTE7IH1cblx0XHRcdH1dLFxuXHRcdFx0W0lBY2Nlc3NpYmxlVmlld1NlcnZpY2UsIG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SUFjY2Vzc2libGVWaWV3U2VydmljZT4oKSB7XG5cdFx0XHRcdG92ZXJyaWRlIGdldE9wZW5BcmlhSGludCh2ZXJib3NpdHlTZXR0aW5nS2V5OiBBY2Nlc3NpYmlsaXR5VmVyYm9zaXR5U2V0dGluZ0lkKTogc3RyaW5nIHwgbnVsbCB7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdH1dLFxuXHRcdFx0W0lDb25maWd1cmF0aW9uU2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2VdLFxuXHRcdFx0W0lWaWV3RGVzY3JpcHRvclNlcnZpY2UsIG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SVZpZXdEZXNjcmlwdG9yU2VydmljZT4oKSB7XG5cdFx0XHRcdG92ZXJyaWRlIG9uRGlkQ2hhbmdlTG9jYXRpb24gPSBFdmVudC5Ob25lO1xuXHRcdFx0fV0sXG5cdFx0XHRbSU5vdGVib29rRWRpdG9yU2VydmljZSwgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJTm90ZWJvb2tFZGl0b3JTZXJ2aWNlPigpIHtcblx0XHRcdFx0b3ZlcnJpZGUgbGlzdE5vdGVib29rRWRpdG9ycygpIHsgcmV0dXJuIFtdOyB9XG5cdFx0XHR9XSxcblx0XHRcdFtJV29ya2JlbmNoQXNzaWdubWVudFNlcnZpY2UsIG5ldyBOdWxsV29ya2JlbmNoQXNzaWdubWVudFNlcnZpY2UoKV0sXG5cdFx0XHRbSUxhbmd1YWdlTW9kZWxzU2VydmljZSwgbmV3IFN5bmNEZXNjcmlwdG9yKExhbmd1YWdlTW9kZWxzU2VydmljZSldLFxuXHRcdFx0W0lUZXh0TW9kZWxTZXJ2aWNlLCBuZXcgU3luY0Rlc2NyaXB0b3IoVGV4dE1vZGVsUmVzb2x2ZXJTZXJ2aWNlKV0sXG5cdFx0XHRbSUxhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2UsIG5ldyBTeW5jRGVzY3JpcHRvcihNb2NrTGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZSldLFxuXHRcdCk7XG5cblx0XHRpbnN0YVNlcnZpY2UgPSBzdG9yZS5hZGQoKHN0b3JlLmFkZCh3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSh1bmRlZmluZWQsIHN0b3JlKSkpLmNyZWF0ZUNoaWxkKHNlcnZpY2VDb2xsZWN0aW9uKSk7XG5cblx0XHRjb25maWd1cmF0aW9uU2VydmljZSA9IGluc3RhU2VydmljZS5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKSBhcyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2U7XG5cdFx0Y29uZmlndXJhdGlvblNlcnZpY2Uuc2V0VXNlckNvbmZpZ3VyYXRpb24oJ2NoYXQnLCB7IGVkaXRvcjogeyBmb250U2l6ZTogMTQsIGZvbnRGYW1pbHk6ICdkZWZhdWx0JyB9IH0pO1xuXG5cdFx0Y29uZmlndXJhdGlvblNlcnZpY2Uuc2V0VXNlckNvbmZpZ3VyYXRpb24oJ2VkaXRvcicsIHt9KTtcblxuXHRcdGNvbnRleHRLZXlTZXJ2aWNlID0gaW5zdGFTZXJ2aWNlLmdldChJQ29udGV4dEtleVNlcnZpY2UpIGFzIE1vY2tDb250ZXh0S2V5U2VydmljZTtcblx0XHRjaGF0U2VydmljZSA9IGluc3RhU2VydmljZS5nZXQoSUNoYXRTZXJ2aWNlKTtcblx0XHRjaGF0QWdlbnRTZXJ2aWNlID0gaW5zdGFTZXJ2aWNlLmdldChJQ2hhdEFnZW50U2VydmljZSk7XG5cblx0XHRpbmxpbmVDaGF0U2Vzc2lvblNlcnZpY2UgPSBzdG9yZS5hZGQoaW5zdGFTZXJ2aWNlLmdldChJSW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlKSk7XG5cblx0XHRzdG9yZS5hZGQoaW5zdGFTZXJ2aWNlLmdldChJTGFuZ3VhZ2VNb2RlbHNTZXJ2aWNlKSBhcyBMYW5ndWFnZU1vZGVsc1NlcnZpY2UpO1xuXG5cdFx0c3RvcmUuYWRkKGluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShDaGF0SW5wdXRCb3hDb250ZW50UHJvdmlkZXIpKTtcblxuXHRcdG1vZGVsID0gc3RvcmUuYWRkKGluc3RhU2VydmljZS5nZXQoSU1vZGVsU2VydmljZSkuY3JlYXRlTW9kZWwoJ0hlbGxvXFxuV29ybGRcXG5IZWxsbyBBZ2FpblxcbkhlbGxvIFdvcmxkXFxuJywgbnVsbCkpO1xuXHRcdG1vZGVsLnNldEVPTChFbmRPZkxpbmVTZXF1ZW5jZS5MRik7XG5cdFx0ZWRpdG9yID0gc3RvcmUuYWRkKGluc3RhbnRpYXRlVGVzdENvZGVFZGl0b3IoaW5zdGFTZXJ2aWNlLCBtb2RlbCkpO1xuXG5cdFx0c3RvcmUuYWRkKGNoYXRBZ2VudFNlcnZpY2UucmVnaXN0ZXJEeW5hbWljQWdlbnQoeyBpZDogJ3Rlc3RFZGl0b3JBZ2VudCcsIC4uLmFnZW50RGF0YSwgfSwge1xuXHRcdFx0YXN5bmMgaW52b2tlKHJlcXVlc3QsIHByb2dyZXNzLCBoaXN0b3J5LCB0b2tlbikge1xuXHRcdFx0XHRwcm9ncmVzcyh7XG5cdFx0XHRcdFx0a2luZDogJ3RleHRFZGl0Jyxcblx0XHRcdFx0XHR1cmk6IG1vZGVsLnVyaSxcblx0XHRcdFx0XHRlZGl0czogW3tcblx0XHRcdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgMSwgMSksXG5cdFx0XHRcdFx0XHR0ZXh0OiByZXF1ZXN0Lm1lc3NhZ2Vcblx0XHRcdFx0XHR9XVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0cmV0dXJuIHt9O1xuXHRcdFx0fSxcblx0XHR9KSk7XG5cblx0fSk7XG5cblx0dGVhcmRvd24oZnVuY3Rpb24gKCkge1xuXHRcdHN0b3JlLmNsZWFyKCk7XG5cdFx0Y3RybD8uZGlzcG9zZSgpO1xuXHR9KTtcblxuXHQvLyBUT0RPQGpyaWVrZW4gcmUtZW5hYmxlLCBsb29rcyBsaWtlIExpc3QvQ2hhdFdpZGdldCBpcyBsZWFraW5nXG5cdC8vIGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ2NyZWF0aW9uLCBub3Qgc2hvd2luZyBhbnl0aGluZycsIGZ1bmN0aW9uICgpIHtcblx0XHRjdHJsID0gaW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RDb250cm9sbGVyLCBlZGl0b3IpO1xuXHRcdGFzc2VydC5vayhjdHJsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY3RybC5nZXRXaWRnZXRQb3NpdGlvbigpLCB1bmRlZmluZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdydW4gKHNob3cvaGlkZSknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y3RybCA9IGluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0Q29udHJvbGxlciwgZWRpdG9yKTtcblx0XHRjb25zdCBhY3R1YWxTdGF0ZXMgPSBjdHJsLmF3YWl0U3RhdGVzKFRlc3RDb250cm9sbGVyLklOSVRfU0VRVUVOQ0VfQVVUT19TRU5EKTtcblx0XHRjb25zdCBydW4gPSBjdHJsLnJ1bih7IG1lc3NhZ2U6ICdIZWxsbycsIGF1dG9TZW5kOiB0cnVlIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBhY3R1YWxTdGF0ZXMsIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0Lm9rKGN0cmwuZ2V0V2lkZ2V0UG9zaXRpb24oKSAhPT0gdW5kZWZpbmVkKTtcblx0XHRhd2FpdCBjdHJsLmNhbmNlbFNlc3Npb24oKTtcblxuXHRcdGF3YWl0IHJ1bjtcblxuXHRcdGFzc2VydC5vayhjdHJsLmdldFdpZGdldFBvc2l0aW9uKCkgPT09IHVuZGVmaW5lZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3dob2xlUmFuZ2UgZG9lcyBub3QgZXhwYW5kIHRvIHdob2xlIGxpbmVzLCBlZGl0b3Igc2VsZWN0aW9uIGRlZmF1bHQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBSYW5nZSgxLCAxLCAxLCAzKSk7XG5cdFx0Y3RybCA9IGluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0Q29udHJvbGxlciwgZWRpdG9yKTtcblxuXHRcdGN0cmwucnVuKHt9KTtcblx0XHRhd2FpdCBFdmVudC50b1Byb21pc2UoRXZlbnQuZmlsdGVyKGN0cmwub25EaWRDaGFuZ2VTdGF0ZSwgZSA9PiBlID09PSBTdGF0ZS5XQUlUX0ZPUl9JTlBVVCkpO1xuXG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IGlubGluZUNoYXRTZXNzaW9uU2VydmljZS5nZXRTZXNzaW9uKGVkaXRvciwgZWRpdG9yLmdldE1vZGVsKCkhLnVyaSk7XG5cdFx0YXNzZXJ0Lm9rKHNlc3Npb24pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2Vzc2lvbi53aG9sZVJhbmdlLnZhbHVlLCBuZXcgUmFuZ2UoMSwgMSwgMSwgMykpO1xuXG5cdFx0YXdhaXQgY3RybC5jYW5jZWxTZXNzaW9uKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3R5cGluZyBvdXRzaWRlIG9mIHdob2xlUmFuZ2UgZmluaXNoZXMgc2Vzc2lvbicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlLnNldFVzZXJDb25maWd1cmF0aW9uKElubGluZUNoYXRDb25maWdLZXlzLkZpbmlzaE9uVHlwZSwgdHJ1ZSk7XG5cblx0XHRjdHJsID0gaW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RDb250cm9sbGVyLCBlZGl0b3IpO1xuXHRcdGNvbnN0IGFjdHVhbFN0YXRlcyA9IGN0cmwuYXdhaXRTdGF0ZXMoVGVzdENvbnRyb2xsZXIuSU5JVF9TRVFVRU5DRV9BVVRPX1NFTkQpO1xuXHRcdGNvbnN0IHIgPSBjdHJsLnJ1bih7IG1lc3NhZ2U6ICdIZWxsbycsIGF1dG9TZW5kOiB0cnVlIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IGFjdHVhbFN0YXRlcywgdW5kZWZpbmVkKTtcblxuXHRcdGNvbnN0IHNlc3Npb24gPSBpbmxpbmVDaGF0U2Vzc2lvblNlcnZpY2UuZ2V0U2Vzc2lvbihlZGl0b3IsIGVkaXRvci5nZXRNb2RlbCgpIS51cmkpO1xuXHRcdGFzc2VydC5vayhzZXNzaW9uKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNlc3Npb24ud2hvbGVSYW5nZS52YWx1ZSwgbmV3IFJhbmdlKDEsIDEsIDEsIDExIC8qIGxpbmUgbGVuZ3RoICovKSk7XG5cblx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBSYW5nZSgyLCAxLCAyLCAxKSk7XG5cdFx0ZWRpdG9yLnRyaWdnZXIoJ3Rlc3QnLCAndHlwZScsIHsgdGV4dDogJ2EnIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IGN0cmwuYXdhaXRTdGF0ZXMoW1N0YXRlLkFDQ0VQVF0pLCB1bmRlZmluZWQpO1xuXHRcdGF3YWl0IHI7XG5cdH0pO1xuXG5cdHRlc3QoJ1xcJ3dob2xlIHJhbmdlXFwnIGlzblxcJ3QgdXBkYXRlZCBmb3IgZWRpdHMgb3V0c2lkZSB3aG9sZSByYW5nZSAjNDM0NicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFJhbmdlKDMsIDEsIDMsIDMpKTtcblxuXHRcdHN0b3JlLmFkZChjaGF0QWdlbnRTZXJ2aWNlLnJlZ2lzdGVyRHluYW1pY0FnZW50KHtcblx0XHRcdGlkOiAndGVzdEVkaXRvckFnZW50MicsXG5cdFx0XHQuLi5hZ2VudERhdGFcblx0XHR9LCB7XG5cdFx0XHRhc3luYyBpbnZva2UocmVxdWVzdCwgcHJvZ3Jlc3MsIGhpc3RvcnksIHRva2VuKSB7XG5cdFx0XHRcdHByb2dyZXNzKHtcblx0XHRcdFx0XHRraW5kOiAndGV4dEVkaXQnLFxuXHRcdFx0XHRcdHVyaTogZWRpdG9yLmdldE1vZGVsKCkudXJpLFxuXHRcdFx0XHRcdGVkaXRzOiBbe1xuXHRcdFx0XHRcdFx0cmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAxLCAxKSwgLy8gRURJVCBoYXBwZW5zIG91dHNpZGUgb2Ygd2hvbGUgcmFuZ2Vcblx0XHRcdFx0XHRcdHRleHQ6IGAke3JlcXVlc3QubWVzc2FnZX1cXG4ke3JlcXVlc3QubWVzc2FnZX1gXG5cdFx0XHRcdFx0fV1cblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0cmV0dXJuIHt9O1xuXHRcdFx0fSxcblx0XHR9KSk7XG5cblx0XHRjdHJsID0gaW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RDb250cm9sbGVyLCBlZGl0b3IpO1xuXHRcdGNvbnN0IHAgPSBjdHJsLmF3YWl0U3RhdGVzKFRlc3RDb250cm9sbGVyLklOSVRfU0VRVUVOQ0UpO1xuXHRcdGNvbnN0IHIgPSBjdHJsLnJ1bih7IG1lc3NhZ2U6ICdHRU5HRU4nLCBhdXRvU2VuZDogZmFsc2UgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgcCwgdW5kZWZpbmVkKTtcblxuXG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IGlubGluZUNoYXRTZXNzaW9uU2VydmljZS5nZXRTZXNzaW9uKGVkaXRvciwgZWRpdG9yLmdldE1vZGVsKCkhLnVyaSk7XG5cdFx0YXNzZXJ0Lm9rKHNlc3Npb24pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2Vzc2lvbi53aG9sZVJhbmdlLnZhbHVlLCBuZXcgUmFuZ2UoMywgMSwgMywgMykpOyAvLyBpbml0aWFsXG5cblx0XHRjdHJsLmNoYXRXaWRnZXQuc2V0SW5wdXQoJ0dFTkdFTicpO1xuXHRcdGN0cmwuY2hhdFdpZGdldC5hY2NlcHRJbnB1dCgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBjdHJsLmF3YWl0U3RhdGVzKFtTdGF0ZS5TSE9XX1JFUVVFU1QsIFN0YXRlLldBSVRfRk9SX0lOUFVUXSksIHVuZGVmaW5lZCk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNlc3Npb24ud2hvbGVSYW5nZS52YWx1ZSwgbmV3IFJhbmdlKDEsIDEsIDQsIDMpKTtcblxuXHRcdGF3YWl0IGN0cmwuY2FuY2VsU2Vzc2lvbigpO1xuXHRcdGF3YWl0IHI7XG5cdH0pO1xuXG5cdHRlc3QoJ1N0dWNrIGlubGluZSBjaGF0IHdpZGdldCAjMjExJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0c3RvcmUuYWRkKGNoYXRBZ2VudFNlcnZpY2UucmVnaXN0ZXJEeW5hbWljQWdlbnQoe1xuXHRcdFx0aWQ6ICd0ZXN0RWRpdG9yQWdlbnQyJyxcblx0XHRcdC4uLmFnZW50RGF0YVxuXHRcdH0sIHtcblx0XHRcdGFzeW5jIGludm9rZShyZXF1ZXN0LCBwcm9ncmVzcywgaGlzdG9yeSwgdG9rZW4pIHtcblx0XHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlPG5ldmVyPigoKSA9PiB7IH0pO1xuXHRcdFx0fSxcblx0XHR9KSk7XG5cblx0XHRjdHJsID0gaW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RDb250cm9sbGVyLCBlZGl0b3IpO1xuXHRcdGNvbnN0IHAgPSBjdHJsLmF3YWl0U3RhdGVzKFsuLi5UZXN0Q29udHJvbGxlci5JTklUX1NFUVVFTkNFLCBTdGF0ZS5TSE9XX1JFUVVFU1RdKTtcblx0XHRjb25zdCByID0gY3RybC5ydW4oeyBtZXNzYWdlOiAnSGVsbG8nLCBhdXRvU2VuZDogdHJ1ZSB9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBwLCB1bmRlZmluZWQpO1xuXG5cdFx0Y3RybC5hY2NlcHRTZXNzaW9uKCk7XG5cblx0XHRhd2FpdCByO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjdHJsLmdldFdpZGdldFBvc2l0aW9uKCksIHVuZGVmaW5lZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1tCdWddIElubGluZSBDaGF0XFwncyBzdHJlYW1pbmcgcHVzaGVkIGJyb2tlbiBpdGVyYXRpb25zIHRvIHRoZSB1bmRvIHN0YWNrICMyNDAzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0c3RvcmUuYWRkKGNoYXRBZ2VudFNlcnZpY2UucmVnaXN0ZXJEeW5hbWljQWdlbnQoe1xuXHRcdFx0aWQ6ICd0ZXN0RWRpdG9yQWdlbnQyJyxcblx0XHRcdC4uLmFnZW50RGF0YVxuXHRcdH0sIHtcblx0XHRcdGFzeW5jIGludm9rZShyZXF1ZXN0LCBwcm9ncmVzcywgaGlzdG9yeSwgdG9rZW4pIHtcblxuXHRcdFx0XHRwcm9ncmVzcyh7IGtpbmQ6ICd0ZXh0RWRpdCcsIHVyaTogbW9kZWwudXJpLCBlZGl0czogW3sgcmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAxLCAxKSwgdGV4dDogJ2hFbGxvMVxcbicgfV0gfSk7XG5cdFx0XHRcdHByb2dyZXNzKHsga2luZDogJ3RleHRFZGl0JywgdXJpOiBtb2RlbC51cmksIGVkaXRzOiBbeyByYW5nZTogbmV3IFJhbmdlKDIsIDEsIDIsIDEpLCB0ZXh0OiAnaEVsbG8yXFxuJyB9XSB9KTtcblx0XHRcdFx0cHJvZ3Jlc3MoeyBraW5kOiAndGV4dEVkaXQnLCB1cmk6IG1vZGVsLnVyaSwgZWRpdHM6IFt7IHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgMTAwMCwgMSksIHRleHQ6ICdIZWxsbzFcXG5IZWxsbzJcXG4nIH1dIH0pO1xuXG5cdFx0XHRcdHJldHVybiB7fTtcblx0XHRcdH0sXG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgdmFsdWVUaGVuID0gZWRpdG9yLmdldE1vZGVsKCkuZ2V0VmFsdWUoKTtcblxuXHRcdGN0cmwgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdENvbnRyb2xsZXIsIGVkaXRvcik7XG5cdFx0Y29uc3QgcCA9IGN0cmwuYXdhaXRTdGF0ZXMoWy4uLlRlc3RDb250cm9sbGVyLklOSVRfU0VRVUVOQ0UsIFN0YXRlLlNIT1dfUkVRVUVTVCwgU3RhdGUuV0FJVF9GT1JfSU5QVVRdKTtcblx0XHRjb25zdCByID0gY3RybC5ydW4oeyBtZXNzYWdlOiAnSGVsbG8nLCBhdXRvU2VuZDogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgcCwgdW5kZWZpbmVkKTtcblx0XHRjdHJsLmFjY2VwdFNlc3Npb24oKTtcblx0XHRhd2FpdCByO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRNb2RlbCgpLmdldFZhbHVlKCksICdIZWxsbzFcXG5IZWxsbzJcXG4nKTtcblxuXHRcdGVkaXRvci5nZXRNb2RlbCgpLnVuZG8oKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkuZ2V0VmFsdWUoKSwgdmFsdWVUaGVuKTtcblx0fSk7XG5cblxuXG5cdHRlc3Quc2tpcCgnVUkgaXMgc3RyZWFtaW5nIGVkaXRzIG1pbnV0ZXMgYWZ0ZXIgdGhlIHJlc3BvbnNlIGlzIGZpbmlzaGVkICMzMzQ1JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cblx0XHRyZXR1cm4gcnVuV2l0aEZha2VkVGltZXJzKHsgbWF4VGFza0NvdW50OiBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUiB9LCBhc3luYyAoKSA9PiB7XG5cblx0XHRcdHN0b3JlLmFkZChjaGF0QWdlbnRTZXJ2aWNlLnJlZ2lzdGVyRHluYW1pY0FnZW50KHtcblx0XHRcdFx0aWQ6ICd0ZXN0RWRpdG9yQWdlbnQyJyxcblx0XHRcdFx0Li4uYWdlbnREYXRhXG5cdFx0XHR9LCB7XG5cdFx0XHRcdGFzeW5jIGludm9rZShyZXF1ZXN0LCBwcm9ncmVzcywgaGlzdG9yeSwgdG9rZW4pIHtcblxuXHRcdFx0XHRcdGNvbnN0IHRleHQgPSAnJHtDU0l9I2FcXG4ke0NTSX0jYlxcbiR7Q1NJfSNjXFxuJztcblxuXHRcdFx0XHRcdGF3YWl0IHRpbWVvdXQoMTApO1xuXHRcdFx0XHRcdHByb2dyZXNzKHsga2luZDogJ3RleHRFZGl0JywgdXJpOiBtb2RlbC51cmksIGVkaXRzOiBbeyByYW5nZTogbmV3IFJhbmdlKDEsIDEsIDEsIDEpLCB0ZXh0OiB0ZXh0IH1dIH0pO1xuXG5cdFx0XHRcdFx0YXdhaXQgdGltZW91dCgxMCk7XG5cdFx0XHRcdFx0cHJvZ3Jlc3MoeyBraW5kOiAndGV4dEVkaXQnLCB1cmk6IG1vZGVsLnVyaSwgZWRpdHM6IFt7IHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgMSwgMSksIHRleHQ6IHRleHQucmVwZWF0KDEwMDApICsgJ0RPTkUnIH1dIH0pO1xuXG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdUb28gbG9uZycpO1xuXHRcdFx0XHR9LFxuXHRcdFx0fSkpO1xuXG5cblx0XHRcdC8vIGxldCBtb2RlbENoYW5nZUNvdW50ZXIgPSAwO1xuXHRcdFx0Ly8gc3RvcmUuYWRkKGVkaXRvci5nZXRNb2RlbCgpLm9uRGlkQ2hhbmdlQ29udGVudCgoKSA9PiB7IG1vZGVsQ2hhbmdlQ291bnRlcisrOyB9KSk7XG5cblx0XHRcdGN0cmwgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdENvbnRyb2xsZXIsIGVkaXRvcik7XG5cdFx0XHRjb25zdCBwID0gY3RybC5hd2FpdFN0YXRlcyhbLi4uVGVzdENvbnRyb2xsZXIuSU5JVF9TRVFVRU5DRSwgU3RhdGUuU0hPV19SRVFVRVNULCBTdGF0ZS5XQUlUX0ZPUl9JTlBVVF0pO1xuXHRcdFx0Y29uc3QgciA9IGN0cmwucnVuKHsgbWVzc2FnZTogJ0hlbGxvJywgYXV0b1NlbmQ6IHRydWUgfSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgcCwgdW5kZWZpbmVkKTtcblxuXHRcdFx0Ly8gYXNzZXJ0Lm9rKG1vZGVsQ2hhbmdlQ291bnRlciA+IDAsIG1vZGVsQ2hhbmdlQ291bnRlci50b1N0cmluZygpKTsgLy8gc29tZSBjaGFuZ2VzIGhhdmUgYmVlbiBtYWRlXG5cdFx0XHQvLyBjb25zdCBtb2RlbENoYW5nZUNvdW50ZXJOb3cgPSBtb2RlbENoYW5nZUNvdW50ZXI7XG5cblx0XHRcdGFzc2VydC5vayghZWRpdG9yLmdldE1vZGVsKCkuZ2V0VmFsdWUoKS5pbmNsdWRlcygnRE9ORScpKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMTApO1xuXG5cdFx0XHQvLyBhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWxDaGFuZ2VDb3VudGVyTm93LCBtb2RlbENoYW5nZUNvdW50ZXIpO1xuXHRcdFx0YXNzZXJ0Lm9rKCFlZGl0b3IuZ2V0TW9kZWwoKS5nZXRWYWx1ZSgpLmluY2x1ZGVzKCdET05FJykpO1xuXG5cdFx0XHRhd2FpdCBjdHJsLmNhbmNlbFNlc3Npb24oKTtcblx0XHRcdGF3YWl0IHI7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2VzY2FwZSBkb2VzblxcJ3QgcmVtb3ZlIGNvZGUgYWRkZWQgZnJvbSBpbmxpbmUgZWRpdG9yIGNoYXQgIzM1MjMgMS8yJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cblx0XHQvLyBOTyBtYW51YWwgZWRpdHMgLT4gY2FuY2VsXG5cdFx0Y3RybCA9IGluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0Q29udHJvbGxlciwgZWRpdG9yKTtcblx0XHRjb25zdCBwID0gY3RybC5hd2FpdFN0YXRlcyhbLi4uVGVzdENvbnRyb2xsZXIuSU5JVF9TRVFVRU5DRSwgU3RhdGUuU0hPV19SRVFVRVNULCBTdGF0ZS5XQUlUX0ZPUl9JTlBVVF0pO1xuXHRcdGNvbnN0IHIgPSBjdHJsLnJ1bih7IG1lc3NhZ2U6ICdHRU5FUkFURUQnLCBhdXRvU2VuZDogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgcCwgdW5kZWZpbmVkKTtcblxuXHRcdGFzc2VydC5vayhtb2RlbC5nZXRWYWx1ZSgpLmluY2x1ZGVzKCdHRU5FUkFURUQnKSk7XG5cdFx0Y3RybC5jYW5jZWxTZXNzaW9uKCk7XG5cdFx0YXdhaXQgcjtcblx0XHRhc3NlcnQub2soIW1vZGVsLmdldFZhbHVlKCkuaW5jbHVkZXMoJ0dFTkVSQVRFRCcpKTtcblxuXHR9KTtcblxuXHR0ZXN0KCdlc2NhcGUgZG9lc25cXCd0IHJlbW92ZSBjb2RlIGFkZGVkIGZyb20gaW5saW5lIGVkaXRvciBjaGF0ICMzNTIzLCAyLzInLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHQvLyBtYW51YWwgZWRpdHMgLT4gZmluaXNoXG5cdFx0Y3RybCA9IGluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0Q29udHJvbGxlciwgZWRpdG9yKTtcblx0XHRjb25zdCBwID0gY3RybC5hd2FpdFN0YXRlcyhbLi4uVGVzdENvbnRyb2xsZXIuSU5JVF9TRVFVRU5DRSwgU3RhdGUuU0hPV19SRVFVRVNULCBTdGF0ZS5XQUlUX0ZPUl9JTlBVVF0pO1xuXHRcdGNvbnN0IHIgPSBjdHJsLnJ1bih7IG1lc3NhZ2U6ICdHRU5FUkFURUQnLCBhdXRvU2VuZDogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgcCwgdW5kZWZpbmVkKTtcblxuXHRcdGFzc2VydC5vayhtb2RlbC5nZXRWYWx1ZSgpLmluY2x1ZGVzKCdHRU5FUkFURUQnKSk7XG5cblx0XHRlZGl0b3IuZXhlY3V0ZUVkaXRzKCd0ZXN0JywgW0VkaXRPcGVyYXRpb24uaW5zZXJ0KG1vZGVsLmdldEZ1bGxNb2RlbFJhbmdlKCkuZ2V0RW5kUG9zaXRpb24oKSwgJ01BTlVBTCcpXSk7XG5cblx0XHRjdHJsLmFjY2VwdFNlc3Npb24oKTtcblx0XHRhd2FpdCByO1xuXHRcdGFzc2VydC5vayhtb2RlbC5nZXRWYWx1ZSgpLmluY2x1ZGVzKCdHRU5FUkFURUQnKSk7XG5cdFx0YXNzZXJ0Lm9rKG1vZGVsLmdldFZhbHVlKCkuaW5jbHVkZXMoJ01BTlVBTCcpKTtcblxuXHR9KTtcblxuXHR0ZXN0KCdyZS1ydW4gc2hvdWxkIGRpc2NhcmQgcGVuZGluZyBlZGl0cycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGxldCBjb3VudCA9IDE7XG5cblx0XHRzdG9yZS5hZGQoY2hhdEFnZW50U2VydmljZS5yZWdpc3RlckR5bmFtaWNBZ2VudCh7XG5cdFx0XHRpZDogJ3Rlc3RFZGl0b3JBZ2VudDInLFxuXHRcdFx0Li4uYWdlbnREYXRhXG5cdFx0fSwge1xuXHRcdFx0YXN5bmMgaW52b2tlKHJlcXVlc3QsIHByb2dyZXNzLCBoaXN0b3J5LCB0b2tlbikge1xuXHRcdFx0XHRwcm9ncmVzcyh7IGtpbmQ6ICd0ZXh0RWRpdCcsIHVyaTogbW9kZWwudXJpLCBlZGl0czogW3sgcmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAxLCAxKSwgdGV4dDogcmVxdWVzdC5tZXNzYWdlICsgKGNvdW50KyspIH1dIH0pO1xuXHRcdFx0XHRyZXR1cm4ge307XG5cdFx0XHR9LFxuXHRcdH0pKTtcblxuXHRcdGN0cmwgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdENvbnRyb2xsZXIsIGVkaXRvcik7XG5cdFx0Y29uc3QgcmVydW4gPSBuZXcgUmVydW5BY3Rpb24oKTtcblxuXHRcdG1vZGVsLnNldFZhbHVlKCcnKTtcblxuXHRcdGNvbnN0IHAgPSBjdHJsLmF3YWl0U3RhdGVzKFsuLi5UZXN0Q29udHJvbGxlci5JTklUX1NFUVVFTkNFLCBTdGF0ZS5TSE9XX1JFUVVFU1QsIFN0YXRlLldBSVRfRk9SX0lOUFVUXSk7XG5cdFx0Y29uc3QgciA9IGN0cmwucnVuKHsgbWVzc2FnZTogJ1BST01QVF8nLCBhdXRvU2VuZDogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgcCwgdW5kZWZpbmVkKTtcblxuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICdQUk9NUFRfMScpO1xuXG5cdFx0Y29uc3QgcDIgPSBjdHJsLmF3YWl0U3RhdGVzKFtTdGF0ZS5TSE9XX1JFUVVFU1QsIFN0YXRlLldBSVRfRk9SX0lOUFVUXSk7XG5cdFx0YXdhaXQgaW5zdGFTZXJ2aWNlLmludm9rZUZ1bmN0aW9uKHJlcnVuLnJ1bklubGluZUNoYXRDb21tYW5kLCBjdHJsLCBlZGl0b3IpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IHAyLCB1bmRlZmluZWQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICdQUk9NUFRfMicpO1xuXHRcdGN0cmwuYWNjZXB0U2Vzc2lvbigpO1xuXHRcdGF3YWl0IHI7XG5cdH0pO1xuXG5cdHRlc3QoJ1JldHJ5IHVuZG9lcyBhbGwgY2hhbmdlcywgbm90IGp1c3QgdGhvc2UgZnJvbSB0aGUgcmVxdWVzdCM1NzM2JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgdGV4dCA9IFtcblx0XHRcdCdlaW5zLScsXG5cdFx0XHQnendlaS0nLFxuXHRcdFx0J2RyZWktJ1xuXHRcdF07XG5cblx0XHRzdG9yZS5hZGQoY2hhdEFnZW50U2VydmljZS5yZWdpc3RlckR5bmFtaWNBZ2VudCh7XG5cdFx0XHRpZDogJ3Rlc3RFZGl0b3JBZ2VudDInLFxuXHRcdFx0Li4uYWdlbnREYXRhXG5cdFx0fSwge1xuXHRcdFx0YXN5bmMgaW52b2tlKHJlcXVlc3QsIHByb2dyZXNzLCBoaXN0b3J5LCB0b2tlbikge1xuXHRcdFx0XHRwcm9ncmVzcyh7IGtpbmQ6ICd0ZXh0RWRpdCcsIHVyaTogbW9kZWwudXJpLCBlZGl0czogW3sgcmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAxLCAxKSwgdGV4dDogdGV4dC5zaGlmdCgpID8/ICcnIH1dIH0pO1xuXHRcdFx0XHRyZXR1cm4ge307XG5cdFx0XHR9LFxuXHRcdH0pKTtcblxuXHRcdGN0cmwgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdENvbnRyb2xsZXIsIGVkaXRvcik7XG5cdFx0Y29uc3QgcmVydW4gPSBuZXcgUmVydW5BY3Rpb24oKTtcblxuXHRcdG1vZGVsLnNldFZhbHVlKCcnKTtcblxuXHRcdC8vIFJFUVVFU1QgMVxuXHRcdGNvbnN0IHAgPSBjdHJsLmF3YWl0U3RhdGVzKFsuLi5UZXN0Q29udHJvbGxlci5JTklUX1NFUVVFTkNFLCBTdGF0ZS5TSE9XX1JFUVVFU1QsIFN0YXRlLldBSVRfRk9SX0lOUFVUXSk7XG5cdFx0Y29uc3QgciA9IGN0cmwucnVuKHsgbWVzc2FnZTogJzEnLCBhdXRvU2VuZDogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgcCwgdW5kZWZpbmVkKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnZWlucy0nKTtcblxuXHRcdC8vIFJFUVVFU1QgMlxuXHRcdGNvbnN0IHAyID0gY3RybC5hd2FpdFN0YXRlcyhbU3RhdGUuU0hPV19SRVFVRVNULCBTdGF0ZS5XQUlUX0ZPUl9JTlBVVF0pO1xuXHRcdGN0cmwuY2hhdFdpZGdldC5zZXRJbnB1dCgnMScpO1xuXHRcdGF3YWl0IGN0cmwuY2hhdFdpZGdldC5hY2NlcHRJbnB1dCgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBwMiwgdW5kZWZpbmVkKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnendlaS1laW5zLScpO1xuXG5cdFx0Ly8gUkVRVUVTVCAyIC0gUkVSVU5cblx0XHRjb25zdCBwMyA9IGN0cmwuYXdhaXRTdGF0ZXMoW1N0YXRlLlNIT1dfUkVRVUVTVCwgU3RhdGUuV0FJVF9GT1JfSU5QVVRdKTtcblx0XHRhd2FpdCBpbnN0YVNlcnZpY2UuaW52b2tlRnVuY3Rpb24ocmVydW4ucnVuSW5saW5lQ2hhdENvbW1hbmQsIGN0cmwsIGVkaXRvcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IHAzLCB1bmRlZmluZWQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICdkcmVpLWVpbnMtJyk7XG5cblx0XHRjdHJsLmFjY2VwdFNlc3Npb24oKTtcblx0XHRhd2FpdCByO1xuXG5cdH0pO1xuXG5cdHRlc3QoJ21vdmluZyBpbmxpbmUgY2hhdCB0byBhbm90aGVyIG1vZGVsIHVuZG9lcyBjaGFuZ2VzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHRleHQgPSBbXG5cdFx0XHQnZWluc1xcbicsXG5cdFx0XHQnendlaVxcbidcblx0XHRdO1xuXG5cdFx0c3RvcmUuYWRkKGNoYXRBZ2VudFNlcnZpY2UucmVnaXN0ZXJEeW5hbWljQWdlbnQoe1xuXHRcdFx0aWQ6ICd0ZXN0RWRpdG9yQWdlbnQyJyxcblx0XHRcdC4uLmFnZW50RGF0YVxuXHRcdH0sIHtcblx0XHRcdGFzeW5jIGludm9rZShyZXF1ZXN0LCBwcm9ncmVzcywgaGlzdG9yeSwgdG9rZW4pIHtcblx0XHRcdFx0cHJvZ3Jlc3MoeyBraW5kOiAndGV4dEVkaXQnLCB1cmk6IG1vZGVsLnVyaSwgZWRpdHM6IFt7IHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgMSwgMSksIHRleHQ6IHRleHQuc2hpZnQoKSA/PyAnJyB9XSB9KTtcblx0XHRcdFx0cmV0dXJuIHt9O1xuXHRcdFx0fSxcblx0XHR9KSk7XG5cdFx0Y3RybCA9IGluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0Q29udHJvbGxlciwgZWRpdG9yKTtcblxuXHRcdC8vIFJFUVVFU1QgMVxuXHRcdGNvbnN0IHAgPSBjdHJsLmF3YWl0U3RhdGVzKFsuLi5UZXN0Q29udHJvbGxlci5JTklUX1NFUVVFTkNFLCBTdGF0ZS5TSE9XX1JFUVVFU1QsIFN0YXRlLldBSVRfRk9SX0lOUFVUXSk7XG5cdFx0Y3RybC5ydW4oeyBtZXNzYWdlOiAnMScsIGF1dG9TZW5kOiB0cnVlIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBwLCB1bmRlZmluZWQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICdlaW5zXFxuSGVsbG9cXG5Xb3JsZFxcbkhlbGxvIEFnYWluXFxuSGVsbG8gV29ybGRcXG4nKTtcblxuXHRcdGNvbnN0IHRhcmdldE1vZGVsID0gY2hhdFNlcnZpY2Uuc3RhcnRTZXNzaW9uKENoYXRBZ2VudExvY2F0aW9uLkVkaXRvciwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSkhO1xuXHRcdHN0b3JlLmFkZCh0YXJnZXRNb2RlbCk7XG5cdFx0Y2hhdFdpZGdldCA9IG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SUNoYXRXaWRnZXQ+KCkge1xuXHRcdFx0b3ZlcnJpZGUgZ2V0IHZpZXdNb2RlbCgpIHtcblx0XHRcdFx0cmV0dXJuIHsgbW9kZWw6IHRhcmdldE1vZGVsIH0gYXMgYW55O1xuXHRcdFx0fVxuXHRcdFx0b3ZlcnJpZGUgZm9jdXNMYXN0TWVzc2FnZSgpIHsgfVxuXHRcdH07XG5cblx0XHRjb25zdCByID0gY3RybC5qb2luQ3VycmVudFJ1bigpO1xuXHRcdGF3YWl0IGN0cmwudmlld0luQ2hhdCgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICdIZWxsb1xcbldvcmxkXFxuSGVsbG8gQWdhaW5cXG5IZWxsbyBXb3JsZFxcbicpO1xuXHRcdGF3YWl0IHI7XG5cdH0pO1xuXG5cdHRlc3QoJ21vdmluZyBpbmxpbmUgY2hhdCB0byBhbm90aGVyIG1vZGVsIHVuZG9lcyBjaGFuZ2VzICgyIHJlcXVlc3RzKScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB0ZXh0ID0gW1xuXHRcdFx0J2VpbnNcXG4nLFxuXHRcdFx0J3p3ZWlcXG4nXG5cdFx0XTtcblxuXHRcdHN0b3JlLmFkZChjaGF0QWdlbnRTZXJ2aWNlLnJlZ2lzdGVyRHluYW1pY0FnZW50KHtcblx0XHRcdGlkOiAndGVzdEVkaXRvckFnZW50MicsXG5cdFx0XHQuLi5hZ2VudERhdGFcblx0XHR9LCB7XG5cdFx0XHRhc3luYyBpbnZva2UocmVxdWVzdCwgcHJvZ3Jlc3MsIGhpc3RvcnksIHRva2VuKSB7XG5cdFx0XHRcdHByb2dyZXNzKHsga2luZDogJ3RleHRFZGl0JywgdXJpOiBtb2RlbC51cmksIGVkaXRzOiBbeyByYW5nZTogbmV3IFJhbmdlKDEsIDEsIDEsIDEpLCB0ZXh0OiB0ZXh0LnNoaWZ0KCkgPz8gJycgfV0gfSk7XG5cdFx0XHRcdHJldHVybiB7fTtcblx0XHRcdH0sXG5cdFx0fSkpO1xuXHRcdGN0cmwgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdENvbnRyb2xsZXIsIGVkaXRvcik7XG5cblx0XHQvLyBSRVFVRVNUIDFcblx0XHRjb25zdCBwID0gY3RybC5hd2FpdFN0YXRlcyhbLi4uVGVzdENvbnRyb2xsZXIuSU5JVF9TRVFVRU5DRSwgU3RhdGUuU0hPV19SRVFVRVNULCBTdGF0ZS5XQUlUX0ZPUl9JTlBVVF0pO1xuXHRcdGN0cmwucnVuKHsgbWVzc2FnZTogJzEnLCBhdXRvU2VuZDogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgcCwgdW5kZWZpbmVkKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnZWluc1xcbkhlbGxvXFxuV29ybGRcXG5IZWxsbyBBZ2FpblxcbkhlbGxvIFdvcmxkXFxuJyk7XG5cblx0XHQvLyBSRVFVRVNUIDJcblx0XHRjb25zdCBwMiA9IGN0cmwuYXdhaXRTdGF0ZXMoW1N0YXRlLlNIT1dfUkVRVUVTVCwgU3RhdGUuV0FJVF9GT1JfSU5QVVRdKTtcblx0XHRjdHJsLmNoYXRXaWRnZXQuc2V0SW5wdXQoJzEnKTtcblx0XHRhd2FpdCBjdHJsLmNoYXRXaWRnZXQuYWNjZXB0SW5wdXQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgcDIsIHVuZGVmaW5lZCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ3p3ZWlcXG5laW5zXFxuSGVsbG9cXG5Xb3JsZFxcbkhlbGxvIEFnYWluXFxuSGVsbG8gV29ybGRcXG4nKTtcblxuXHRcdGNvbnN0IHRhcmdldE1vZGVsID0gY2hhdFNlcnZpY2Uuc3RhcnRTZXNzaW9uKENoYXRBZ2VudExvY2F0aW9uLkVkaXRvciwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSkhO1xuXHRcdHN0b3JlLmFkZCh0YXJnZXRNb2RlbCk7XG5cdFx0Y2hhdFdpZGdldCA9IG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SUNoYXRXaWRnZXQ+KCkge1xuXHRcdFx0b3ZlcnJpZGUgZ2V0IHZpZXdNb2RlbCgpIHtcblx0XHRcdFx0cmV0dXJuIHsgbW9kZWw6IHRhcmdldE1vZGVsIH0gYXMgYW55O1xuXHRcdFx0fVxuXHRcdFx0b3ZlcnJpZGUgZm9jdXNMYXN0TWVzc2FnZSgpIHsgfVxuXHRcdH07XG5cblx0XHRjb25zdCByID0gY3RybC5qb2luQ3VycmVudFJ1bigpO1xuXG5cdFx0YXdhaXQgY3RybC52aWV3SW5DaGF0KCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ0hlbGxvXFxuV29ybGRcXG5IZWxsbyBBZ2FpblxcbkhlbGxvIFdvcmxkXFxuJyk7XG5cblx0XHRhd2FpdCByO1xuXHR9KTtcblxuXHR0ZXN0KCdDbGlja2luZyBcInJlLXJ1biB3aXRob3V0IC9kb2NcIiB3aGlsZSBhIHJlcXVlc3QgaXMgaW4gcHJvZ3Jlc3MgY2xvc2VzIHRoZSB3aWRnZXQgIzU5OTcnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHRtb2RlbC5zZXRWYWx1ZSgnJyk7XG5cblx0XHRsZXQgY291bnQgPSAwO1xuXHRcdGNvbnN0IGNvbW1hbmREZXRlY3Rpb246IChib29sZWFuIHwgdW5kZWZpbmVkKVtdID0gW107XG5cblx0XHRjb25zdCBvbkRpZEludm9rZSA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cblx0XHRzdG9yZS5hZGQoY2hhdEFnZW50U2VydmljZS5yZWdpc3RlckR5bmFtaWNBZ2VudCh7XG5cdFx0XHRpZDogJ3Rlc3RFZGl0b3JBZ2VudDInLFxuXHRcdFx0Li4uYWdlbnREYXRhXG5cdFx0fSwge1xuXHRcdFx0YXN5bmMgaW52b2tlKHJlcXVlc3QsIHByb2dyZXNzLCBoaXN0b3J5LCB0b2tlbikge1xuXHRcdFx0XHRxdWV1ZU1pY3JvdGFzaygoKSA9PiBvbkRpZEludm9rZS5maXJlKCkpO1xuXHRcdFx0XHRjb21tYW5kRGV0ZWN0aW9uLnB1c2gocmVxdWVzdC5lbmFibGVDb21tYW5kRGV0ZWN0aW9uKTtcblx0XHRcdFx0cHJvZ3Jlc3MoeyBraW5kOiAndGV4dEVkaXQnLCB1cmk6IG1vZGVsLnVyaSwgZWRpdHM6IFt7IHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgMSwgMSksIHRleHQ6IHJlcXVlc3QubWVzc2FnZSArIChjb3VudCsrKSB9XSB9KTtcblxuXHRcdFx0XHRpZiAoY291bnQgPT09IDEpIHtcblx0XHRcdFx0XHQvLyBGSVJTVCBjYWxsIHdhaXRzIGZvciBjYW5jZWxsYXRpb25cblx0XHRcdFx0XHRhd2FpdCByYWNlQ2FuY2VsbGF0aW9uKG5ldyBQcm9taXNlPG5ldmVyPigoKSA9PiB7IH0pLCB0b2tlbik7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YXdhaXQgdGltZW91dCgxMCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4ge307XG5cdFx0XHR9LFxuXHRcdH0pKTtcblx0XHRjdHJsID0gaW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RDb250cm9sbGVyLCBlZGl0b3IpO1xuXG5cdFx0Ly8gUkVRVUVTVCAxXG5cdFx0Ly8gY29uc3QgcCA9IGN0cmwuYXdhaXRTdGF0ZXMoWy4uLlRlc3RDb250cm9sbGVyLklOSVRfU0VRVUVOQ0UsIFN0YXRlLlNIT1dfUkVRVUVTVF0pO1xuXHRcdGNvbnN0IHAgPSBFdmVudC50b1Byb21pc2Uob25EaWRJbnZva2UuZXZlbnQpO1xuXHRcdGN0cmwucnVuKHsgbWVzc2FnZTogJ0hlbGxvLScsIGF1dG9TZW5kOiB0cnVlIH0pO1xuXG5cdFx0YXdhaXQgcDtcblxuXHRcdC8vIGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBwLCB1bmRlZmluZWQpO1xuXG5cdFx0Ly8gcmVzZW5kIHBlbmRpbmcgcmVxdWVzdCB3aXRob3V0IGNvbW1hbmQgZGV0ZWN0aW9uXG5cdFx0Y29uc3QgcmVxdWVzdCA9IGN0cmwuY2hhdFdpZGdldC52aWV3TW9kZWw/Lm1vZGVsLmdldFJlcXVlc3RzKCkuYXQoLTEpO1xuXHRcdGFzc2VydFR5cGUocmVxdWVzdCk7XG5cdFx0Y29uc3QgcDIgPSBFdmVudC50b1Byb21pc2Uob25EaWRJbnZva2UuZXZlbnQpO1xuXHRcdGNvbnN0IHAzID0gY3RybC5hd2FpdFN0YXRlcyhbU3RhdGUuU0hPV19SRVFVRVNULCBTdGF0ZS5XQUlUX0ZPUl9JTlBVVF0pO1xuXHRcdGNoYXRTZXJ2aWNlLnJlc2VuZFJlcXVlc3QocmVxdWVzdCwgeyBub0NvbW1hbmREZXRlY3Rpb246IHRydWUsIGF0dGVtcHQ6IHJlcXVlc3QuYXR0ZW1wdCArIDEsIGxvY2F0aW9uOiBDaGF0QWdlbnRMb2NhdGlvbi5FZGl0b3IgfSk7XG5cblx0XHRhd2FpdCBwMjtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgcDMsIHVuZGVmaW5lZCk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNvbW1hbmREZXRlY3Rpb24sIFt0cnVlLCBmYWxzZV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnSGVsbG8tMScpO1xuXHR9KTtcblxuXHR0ZXN0KCdSZS1ydW4gd2l0aG91dCBhZnRlciByZXF1ZXN0IGlzIGRvbmUnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHRtb2RlbC5zZXRWYWx1ZSgnJyk7XG5cblx0XHRsZXQgY291bnQgPSAwO1xuXHRcdGNvbnN0IGNvbW1hbmREZXRlY3Rpb246IChib29sZWFuIHwgdW5kZWZpbmVkKVtdID0gW107XG5cblx0XHRzdG9yZS5hZGQoY2hhdEFnZW50U2VydmljZS5yZWdpc3RlckR5bmFtaWNBZ2VudCh7XG5cdFx0XHRpZDogJ3Rlc3RFZGl0b3JBZ2VudDInLFxuXHRcdFx0Li4uYWdlbnREYXRhXG5cdFx0fSwge1xuXHRcdFx0YXN5bmMgaW52b2tlKHJlcXVlc3QsIHByb2dyZXNzLCBoaXN0b3J5LCB0b2tlbikge1xuXHRcdFx0XHRjb21tYW5kRGV0ZWN0aW9uLnB1c2gocmVxdWVzdC5lbmFibGVDb21tYW5kRGV0ZWN0aW9uKTtcblx0XHRcdFx0cHJvZ3Jlc3MoeyBraW5kOiAndGV4dEVkaXQnLCB1cmk6IG1vZGVsLnVyaSwgZWRpdHM6IFt7IHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgMSwgMSksIHRleHQ6IHJlcXVlc3QubWVzc2FnZSArIChjb3VudCsrKSB9XSB9KTtcblx0XHRcdFx0cmV0dXJuIHt9O1xuXHRcdFx0fSxcblx0XHR9KSk7XG5cdFx0Y3RybCA9IGluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0Q29udHJvbGxlciwgZWRpdG9yKTtcblxuXHRcdC8vIFJFUVVFU1QgMVxuXHRcdGNvbnN0IHAgPSBjdHJsLmF3YWl0U3RhdGVzKFsuLi5UZXN0Q29udHJvbGxlci5JTklUX1NFUVVFTkNFLCBTdGF0ZS5TSE9XX1JFUVVFU1QsIFN0YXRlLldBSVRfRk9SX0lOUFVUXSk7XG5cdFx0Y3RybC5ydW4oeyBtZXNzYWdlOiAnSGVsbG8tJywgYXV0b1NlbmQ6IHRydWUgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IHAsIHVuZGVmaW5lZCk7XG5cblx0XHQvLyByZXNlbmQgcGVuZGluZyByZXF1ZXN0IHdpdGhvdXQgY29tbWFuZCBkZXRlY3Rpb25cblx0XHRjb25zdCByZXF1ZXN0ID0gY3RybC5jaGF0V2lkZ2V0LnZpZXdNb2RlbD8ubW9kZWwuZ2V0UmVxdWVzdHMoKS5hdCgtMSk7XG5cdFx0YXNzZXJ0VHlwZShyZXF1ZXN0KTtcblx0XHRjb25zdCBwMiA9IGN0cmwuYXdhaXRTdGF0ZXMoW1N0YXRlLlNIT1dfUkVRVUVTVCwgU3RhdGUuV0FJVF9GT1JfSU5QVVRdKTtcblx0XHRjaGF0U2VydmljZS5yZXNlbmRSZXF1ZXN0KHJlcXVlc3QsIHsgbm9Db21tYW5kRGV0ZWN0aW9uOiB0cnVlLCBhdHRlbXB0OiByZXF1ZXN0LmF0dGVtcHQgKyAxLCBsb2NhdGlvbjogQ2hhdEFnZW50TG9jYXRpb24uRWRpdG9yIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IHAyLCB1bmRlZmluZWQpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjb21tYW5kRGV0ZWN0aW9uLCBbdHJ1ZSwgZmFsc2VdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ0hlbGxvLTEnKTtcblx0fSk7XG5cblxuXHR0ZXN0KCdJbmxpbmU6IFByZXNzaW5nIFJlcnVuIHJlcXVlc3Qgd2hpbGUgdGhlIHJlc3BvbnNlIHN0cmVhbXMgYnJlYWtzIHRoZSByZXNwb25zZSAjNTQ0MicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdG1vZGVsLnNldFZhbHVlKCd0d29cXG5vbmVcXG4nKTtcblxuXHRcdGNvbnN0IGF0dGVtcHRzOiAobnVtYmVyIHwgdW5kZWZpbmVkKVtdID0gW107XG5cblx0XHRjb25zdCBkZWZlcnJlZCA9IG5ldyBEZWZlcnJlZFByb21pc2U8dm9pZD4oKTtcblxuXHRcdHN0b3JlLmFkZChjaGF0QWdlbnRTZXJ2aWNlLnJlZ2lzdGVyRHluYW1pY0FnZW50KHtcblx0XHRcdGlkOiAndGVzdEVkaXRvckFnZW50MicsXG5cdFx0XHQuLi5hZ2VudERhdGFcblx0XHR9LCB7XG5cdFx0XHRhc3luYyBpbnZva2UocmVxdWVzdCwgcHJvZ3Jlc3MsIGhpc3RvcnksIHRva2VuKSB7XG5cblx0XHRcdFx0YXR0ZW1wdHMucHVzaChyZXF1ZXN0LmF0dGVtcHQpO1xuXG5cdFx0XHRcdHByb2dyZXNzKHsga2luZDogJ3RleHRFZGl0JywgdXJpOiBtb2RlbC51cmksIGVkaXRzOiBbeyByYW5nZTogbmV3IFJhbmdlKDEsIDEsIDEsIDEpLCB0ZXh0OiBgVFJZOiR7cmVxdWVzdC5hdHRlbXB0fVxcbmAgfV0gfSk7XG5cdFx0XHRcdGF3YWl0IHJhY2VDYW5jZWxsYXRpb24oZGVmZXJyZWQucCwgdG9rZW4pO1xuXHRcdFx0XHRkZWZlcnJlZC5jb21wbGV0ZSgpO1xuXHRcdFx0XHRhd2FpdCB0aW1lb3V0KDEwKTtcblx0XHRcdFx0cmV0dXJuIHt9O1xuXHRcdFx0fSxcblx0XHR9KSk7XG5cblx0XHRjdHJsID0gaW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RDb250cm9sbGVyLCBlZGl0b3IpO1xuXG5cdFx0Ly8gUkVRVUVTVCAxXG5cdFx0Y29uc3QgcCA9IGN0cmwuYXdhaXRTdGF0ZXMoWy4uLlRlc3RDb250cm9sbGVyLklOSVRfU0VRVUVOQ0UsIFN0YXRlLlNIT1dfUkVRVUVTVF0pO1xuXHRcdGN0cmwucnVuKHsgbWVzc2FnZTogJ0hlbGxvLScsIGF1dG9TZW5kOiB0cnVlIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBwLCB1bmRlZmluZWQpO1xuXHRcdGF3YWl0IHRpbWVvdXQoMTApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYXR0ZW1wdHMsIFswXSk7XG5cblx0XHQvLyBSRVJVTiAoY2FuY2VsLCB1bmRvLCByZWRvKVxuXHRcdGNvbnN0IHAyID0gY3RybC5hd2FpdFN0YXRlcyhbU3RhdGUuU0hPV19SRVFVRVNULCBTdGF0ZS5XQUlUX0ZPUl9JTlBVVF0pO1xuXHRcdGNvbnN0IHJlcnVuID0gbmV3IFJlcnVuQWN0aW9uKCk7XG5cdFx0YXdhaXQgaW5zdGFTZXJ2aWNlLmludm9rZUZ1bmN0aW9uKHJlcnVuLnJ1bklubGluZUNoYXRDb21tYW5kLCBjdHJsLCBlZGl0b3IpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBwMiwgdW5kZWZpbmVkKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYXR0ZW1wdHMsIFswLCAxXSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ1RSWToxXFxudHdvXFxub25lXFxuJyk7XG5cblx0fSk7XG5cblx0dGVzdCgnU3RvcHBpbmcvY2FuY2VsbGluZyBhIHJlcXVlc3Qgc2hvdWxkIE5PVCB1bmRvIGl0cyBjaGFuZ2VzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0bW9kZWwuc2V0VmFsdWUoJ1dvcmxkJyk7XG5cblx0XHRjb25zdCBkZWZlcnJlZCA9IG5ldyBEZWZlcnJlZFByb21pc2U8dm9pZD4oKTtcblx0XHRsZXQgcHJvZ3Jlc3M6ICgocGFydDogSUNoYXRQcm9ncmVzcykgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cblx0XHRzdG9yZS5hZGQoY2hhdEFnZW50U2VydmljZS5yZWdpc3RlckR5bmFtaWNBZ2VudCh7XG5cdFx0XHRpZDogJ3Rlc3RFZGl0b3JBZ2VudDInLFxuXHRcdFx0Li4uYWdlbnREYXRhXG5cdFx0fSwge1xuXHRcdFx0YXN5bmMgaW52b2tlKHJlcXVlc3QsIF9wcm9ncmVzcywgaGlzdG9yeSwgdG9rZW4pIHtcblxuXHRcdFx0XHRwcm9ncmVzcyA9IF9wcm9ncmVzcztcblx0XHRcdFx0YXdhaXQgZGVmZXJyZWQucDtcblx0XHRcdFx0cmV0dXJuIHt9O1xuXHRcdFx0fSxcblx0XHR9KSk7XG5cblx0XHRjdHJsID0gaW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RDb250cm9sbGVyLCBlZGl0b3IpO1xuXG5cdFx0Ly8gUkVRVUVTVCAxXG5cdFx0Y29uc3QgcCA9IGN0cmwuYXdhaXRTdGF0ZXMoWy4uLlRlc3RDb250cm9sbGVyLklOSVRfU0VRVUVOQ0UsIFN0YXRlLlNIT1dfUkVRVUVTVF0pO1xuXHRcdGN0cmwucnVuKHsgbWVzc2FnZTogJ0hlbGxvJywgYXV0b1NlbmQ6IHRydWUgfSk7XG5cdFx0YXdhaXQgdGltZW91dCgxMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IHAsIHVuZGVmaW5lZCk7XG5cblx0XHRhc3NlcnRUeXBlKHByb2dyZXNzKTtcblxuXHRcdGNvbnN0IG1vZGVsQ2hhbmdlID0gbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiBtb2RlbC5vbkRpZENoYW5nZUNvbnRlbnQoKCkgPT4gcmVzb2x2ZSgpKSk7XG5cblx0XHRwcm9ncmVzcyh7IGtpbmQ6ICd0ZXh0RWRpdCcsIHVyaTogbW9kZWwudXJpLCBlZGl0czogW3sgcmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAxLCAxKSwgdGV4dDogJ0hlbGxvLUhlbGxvJyB9XSB9KTtcblxuXHRcdGF3YWl0IG1vZGVsQ2hhbmdlO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnSGVsbG9Xb3JsZCcpOyAvLyBmaXJzdCB3b3JkIGhhcyBiZWVuIHN0cmVhbWVkXG5cblx0XHRjb25zdCBwMiA9IGN0cmwuYXdhaXRTdGF0ZXMoW1N0YXRlLldBSVRfRk9SX0lOUFVUXSk7XG5cdFx0Y2hhdFNlcnZpY2UuY2FuY2VsQ3VycmVudFJlcXVlc3RGb3JTZXNzaW9uKGN0cmwuY2hhdFdpZGdldC52aWV3TW9kZWwhLm1vZGVsLnNlc3Npb25JZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IHAyLCB1bmRlZmluZWQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICdIZWxsb1dvcmxkJyk7IC8vIENBTkNFTCBqdXN0IHN0b3BzIHRoZSByZXF1ZXN0IGFuZCBwcm9ncmVzc2l2ZSB0eXBpbmcgYnV0IGRvZXNuJ3QgdW5kb1xuXG5cdH0pO1xuXG5cdHRlc3QoJ0FwcGx5IEVkaXRzIGZyb20gZXhpc3Rpbmcgc2Vzc2lvbiB3LyBlZGl0cycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdG1vZGVsLnNldFZhbHVlKCcnKTtcblxuXHRcdGNvbnN0IG5ld1Nlc3Npb24gPSBhd2FpdCBpbmxpbmVDaGF0U2Vzc2lvblNlcnZpY2UuY3JlYXRlU2Vzc2lvbihlZGl0b3IsIHt9LCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRhc3NlcnRUeXBlKG5ld1Nlc3Npb24pO1xuXG5cdFx0YXdhaXQgKGF3YWl0IGNoYXRTZXJ2aWNlLnNlbmRSZXF1ZXN0KG5ld1Nlc3Npb24uY2hhdE1vZGVsLnNlc3Npb25JZCwgJ0V4aXN0aW5nJywgeyBsb2NhdGlvbjogQ2hhdEFnZW50TG9jYXRpb24uRWRpdG9yIH0pKT8ucmVzcG9uc2VDcmVhdGVkUHJvbWlzZTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChuZXdTZXNzaW9uLmNoYXRNb2RlbC5yZXF1ZXN0SW5Qcm9ncmVzcywgdHJ1ZSk7XG5cblx0XHRjb25zdCByZXNwb25zZSA9IG5ld1Nlc3Npb24uY2hhdE1vZGVsLmxhc3RSZXF1ZXN0Py5yZXNwb25zZTtcblx0XHRhc3NlcnRUeXBlKHJlc3BvbnNlKTtcblxuXHRcdGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuXHRcdFx0aWYgKHJlc3BvbnNlLmlzQ29tcGxldGUpIHtcblx0XHRcdFx0cmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgZCA9IHJlc3BvbnNlLm9uRGlkQ2hhbmdlKCgpID0+IHtcblx0XHRcdFx0aWYgKHJlc3BvbnNlLmlzQ29tcGxldGUpIHtcblx0XHRcdFx0XHRkLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRyZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0Y3RybCA9IGluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0Q29udHJvbGxlciwgZWRpdG9yKTtcblx0XHRjb25zdCBwID0gY3RybC5hd2FpdFN0YXRlcyhbLi4uVGVzdENvbnRyb2xsZXIuSU5JVF9TRVFVRU5DRV0pO1xuXHRcdGN0cmwucnVuKHsgZXhpc3RpbmdTZXNzaW9uOiBuZXdTZXNzaW9uIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IHAsIHVuZGVmaW5lZCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ0V4aXN0aW5nJyk7XG5cblx0fSk7XG5cblx0dGVzdCgnVW5kbyBvbiBlcnJvciAoMiByb3VuZHMpJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0cmV0dXJuIHJ1bldpdGhGYWtlZFRpbWVycyh7fSwgYXN5bmMgKCkgPT4ge1xuXG5cblx0XHRcdHN0b3JlLmFkZChjaGF0QWdlbnRTZXJ2aWNlLnJlZ2lzdGVyRHluYW1pY0FnZW50KHsgaWQ6ICd0ZXN0RWRpdG9yQWdlbnQnLCAuLi5hZ2VudERhdGEsIH0sIHtcblx0XHRcdFx0YXN5bmMgaW52b2tlKHJlcXVlc3QsIHByb2dyZXNzLCBoaXN0b3J5LCB0b2tlbikge1xuXG5cdFx0XHRcdFx0cHJvZ3Jlc3Moe1xuXHRcdFx0XHRcdFx0a2luZDogJ3RleHRFZGl0Jyxcblx0XHRcdFx0XHRcdHVyaTogbW9kZWwudXJpLFxuXHRcdFx0XHRcdFx0ZWRpdHM6IFt7XG5cdFx0XHRcdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgMSwgMSksXG5cdFx0XHRcdFx0XHRcdHRleHQ6IHJlcXVlc3QubWVzc2FnZVxuXHRcdFx0XHRcdFx0fV1cblx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdGlmIChyZXF1ZXN0Lm1lc3NhZ2UgPT09ICd0d28nKSB7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aW1lb3V0KDEwMCk7IC8vIGdpdmUgZWRpdCBhIGNoYW5jZVxuXHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0ZXJyb3JEZXRhaWxzOiB7IG1lc3NhZ2U6ICdGQUlMRUQnIH1cblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB7fTtcblx0XHRcdFx0fSxcblx0XHRcdH0pKTtcblxuXHRcdFx0bW9kZWwuc2V0VmFsdWUoJycpO1xuXG5cdFx0XHQvLyBST1VORCAxXG5cblx0XHRcdGN0cmwgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdENvbnRyb2xsZXIsIGVkaXRvcik7XG5cdFx0XHRjb25zdCBwID0gY3RybC5hd2FpdFN0YXRlcyhbLi4uVGVzdENvbnRyb2xsZXIuSU5JVF9TRVFVRU5DRSwgU3RhdGUuU0hPV19SRVFVRVNULCBTdGF0ZS5XQUlUX0ZPUl9JTlBVVF0pO1xuXHRcdFx0Y3RybC5ydW4oeyBhdXRvU2VuZDogdHJ1ZSwgbWVzc2FnZTogJ29uZScgfSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgcCwgdW5kZWZpbmVkKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnb25lJyk7XG5cblxuXHRcdFx0Ly8gUk9VTkQgMlxuXG5cdFx0XHRjb25zdCBwMiA9IGN0cmwuYXdhaXRTdGF0ZXMoW1N0YXRlLlNIT1dfUkVRVUVTVCwgU3RhdGUuV0FJVF9GT1JfSU5QVVRdKTtcblx0XHRcdGNvbnN0IHZhbHVlcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRcdFx0c3RvcmUuYWRkKG1vZGVsLm9uRGlkQ2hhbmdlQ29udGVudCgoKSA9PiB2YWx1ZXMuYWRkKG1vZGVsLmdldFZhbHVlKCkpKSk7XG5cdFx0XHRjdHJsLmNoYXRXaWRnZXQuYWNjZXB0SW5wdXQoJ3R3bycpOyAvLyBXSUxMIFRyaWdnZXIgYSBmYWlsdXJlXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgcDIsIHVuZGVmaW5lZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ29uZScpOyAvLyB1bmRvbmVcblx0XHRcdGFzc2VydC5vayh2YWx1ZXMuaGFzKCd0d29vbmUnKSk7IC8vIHdlIGhhZCBidXQgdGhlIGNoYW5nZSBnb3QgdW5kb25lXG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0lubGluZSBjaGF0IFwiZGlzY2FyZFwiIGJ1dHRvbiBkb2VzIG5vdCBhbHdheXMgYXBwZWFyIGlmIHJlc3BvbnNlIGlzIHN0b3BwZWQgIzIyODAzMCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdG1vZGVsLnNldFZhbHVlKCdXb3JsZCcpO1xuXG5cdFx0Y29uc3QgZGVmZXJyZWQgPSBuZXcgRGVmZXJyZWRQcm9taXNlPHZvaWQ+KCk7XG5cblx0XHRzdG9yZS5hZGQoY2hhdEFnZW50U2VydmljZS5yZWdpc3RlckR5bmFtaWNBZ2VudCh7XG5cdFx0XHRpZDogJ3Rlc3RFZGl0b3JBZ2VudDInLFxuXHRcdFx0Li4uYWdlbnREYXRhXG5cdFx0fSwge1xuXHRcdFx0YXN5bmMgaW52b2tlKHJlcXVlc3QsIHByb2dyZXNzLCBoaXN0b3J5LCB0b2tlbikge1xuXG5cdFx0XHRcdHByb2dyZXNzKHsga2luZDogJ3RleHRFZGl0JywgdXJpOiBtb2RlbC51cmksIGVkaXRzOiBbeyByYW5nZTogbmV3IFJhbmdlKDEsIDEsIDEsIDEpLCB0ZXh0OiAnSGVsbG8tSGVsbG8nIH1dIH0pO1xuXHRcdFx0XHRhd2FpdCBkZWZlcnJlZC5wO1xuXHRcdFx0XHRyZXR1cm4ge307XG5cdFx0XHR9LFxuXHRcdH0pKTtcblxuXHRcdGN0cmwgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdENvbnRyb2xsZXIsIGVkaXRvcik7XG5cblx0XHQvLyBSRVFVRVNUIDFcblx0XHRjb25zdCBwID0gY3RybC5hd2FpdFN0YXRlcyhbLi4uVGVzdENvbnRyb2xsZXIuSU5JVF9TRVFVRU5DRSwgU3RhdGUuU0hPV19SRVFVRVNUXSk7XG5cdFx0Y3RybC5ydW4oeyBtZXNzYWdlOiAnSGVsbG8nLCBhdXRvU2VuZDogdHJ1ZSB9KTtcblxuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IHAsIHVuZGVmaW5lZCk7XG5cblx0XHRjb25zdCBwMiA9IGN0cmwuYXdhaXRTdGF0ZXMoW1N0YXRlLldBSVRfRk9SX0lOUFVUXSk7XG5cdFx0Y2hhdFNlcnZpY2UuY2FuY2VsQ3VycmVudFJlcXVlc3RGb3JTZXNzaW9uKGN0cmwuY2hhdFdpZGdldC52aWV3TW9kZWwhLm1vZGVsLnNlc3Npb25JZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IHAyLCB1bmRlZmluZWQpO1xuXG5cblx0XHRjb25zdCB2YWx1ZSA9IGNvbnRleHRLZXlTZXJ2aWNlLmdldENvbnRleHRLZXlWYWx1ZShDVFhfSU5MSU5FX0NIQVRfUkVTUE9OU0VfVFlQRS5rZXkpO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbCh2YWx1ZSwgSW5saW5lQ2hhdFJlc3BvbnNlVHlwZS5Ob25lKTtcblx0fSk7XG5cblx0dGVzdCgnUmVzdG9yZSBkb2VzblxcJ3QgZWRpdCBvbiBlcnJvcmVkIHJlc3VsdCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRyZXR1cm4gcnVuV2l0aEZha2VkVGltZXJzKHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cblx0XHRcdGNvbnN0IG1vZGVsMiA9IHN0b3JlLmFkZChpbnN0YVNlcnZpY2UuZ2V0KElNb2RlbFNlcnZpY2UpLmNyZWF0ZU1vZGVsKCdBQkMnLCBudWxsKSk7XG5cblx0XHRcdG1vZGVsLnNldFZhbHVlKCdXb3JsZCcpO1xuXG5cdFx0XHRzdG9yZS5hZGQoY2hhdEFnZW50U2VydmljZS5yZWdpc3RlckR5bmFtaWNBZ2VudCh7XG5cdFx0XHRcdGlkOiAndGVzdEVkaXRvckFnZW50MicsXG5cdFx0XHRcdC4uLmFnZW50RGF0YVxuXHRcdFx0fSwge1xuXHRcdFx0XHRhc3luYyBpbnZva2UocmVxdWVzdCwgcHJvZ3Jlc3MsIGhpc3RvcnksIHRva2VuKSB7XG5cblx0XHRcdFx0XHRwcm9ncmVzcyh7IGtpbmQ6ICd0ZXh0RWRpdCcsIHVyaTogbW9kZWwudXJpLCBlZGl0czogW3sgcmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAxLCAxKSwgdGV4dDogJ0hlbGxvMScgfV0gfSk7XG5cdFx0XHRcdFx0YXdhaXQgdGltZW91dCgxMDApO1xuXHRcdFx0XHRcdHByb2dyZXNzKHsga2luZDogJ3RleHRFZGl0JywgdXJpOiBtb2RlbC51cmksIGVkaXRzOiBbeyByYW5nZTogbmV3IFJhbmdlKDEsIDEsIDEsIDEpLCB0ZXh0OiAnSGVsbG8yJyB9XSB9KTtcblx0XHRcdFx0XHRhd2FpdCB0aW1lb3V0KDEwMCk7XG5cdFx0XHRcdFx0cHJvZ3Jlc3MoeyBraW5kOiAndGV4dEVkaXQnLCB1cmk6IG1vZGVsLnVyaSwgZWRpdHM6IFt7IHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgMSwgMSksIHRleHQ6ICdIZWxsbzMnIH1dIH0pO1xuXHRcdFx0XHRcdGF3YWl0IHRpbWVvdXQoMTAwKTtcblxuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRlcnJvckRldGFpbHM6IHsgbWVzc2FnZTogJ0ZBSUxFRCcgfVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0sXG5cdFx0XHR9KSk7XG5cblx0XHRcdGN0cmwgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdENvbnRyb2xsZXIsIGVkaXRvcik7XG5cblx0XHRcdC8vIFJFUVVFU1QgMVxuXHRcdFx0Y29uc3QgcCA9IGN0cmwuYXdhaXRTdGF0ZXMoWy4uLlRlc3RDb250cm9sbGVyLklOSVRfU0VRVUVOQ0UsIFN0YXRlLlNIT1dfUkVRVUVTVCwgU3RhdGUuV0FJVF9GT1JfSU5QVVRdKTtcblx0XHRcdGN0cmwucnVuKHsgbWVzc2FnZTogJ0hlbGxvJywgYXV0b1NlbmQ6IHRydWUgfSk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBwLCB1bmRlZmluZWQpO1xuXG5cdFx0XHRjb25zdCBwMiA9IGN0cmwuYXdhaXRTdGF0ZXMoW1N0YXRlLlBBVVNFXSk7XG5cdFx0XHRlZGl0b3Iuc2V0TW9kZWwobW9kZWwyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBwMiwgdW5kZWZpbmVkKTtcblxuXHRcdFx0Y29uc3QgcDMgPSBjdHJsLmF3YWl0U3RhdGVzKFsuLi5UZXN0Q29udHJvbGxlci5JTklUX1NFUVVFTkNFXSk7XG5cdFx0XHRlZGl0b3Iuc2V0TW9kZWwobW9kZWwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IHAzLCB1bmRlZmluZWQpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ1dvcmxkJyk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMs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
