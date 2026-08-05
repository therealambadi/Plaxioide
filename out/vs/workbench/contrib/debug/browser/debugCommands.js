import * as nls from "../../../../nls.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { List } from "../../../../base/browser/ui/list/listWidget.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IListService } from "../../../../platform/list/browser/listService.js";
import { IDebugService, CONTEXT_BREAKPOINTS_FOCUSED, CONTEXT_WATCH_EXPRESSIONS_FOCUSED, CONTEXT_VARIABLES_FOCUSED, EDITOR_CONTRIBUTION_ID, CONTEXT_IN_DEBUG_MODE, CONTEXT_EXPRESSION_SELECTED, CONTEXT_DEBUG_STATE, CONTEXT_JUMP_TO_CURSOR_SUPPORTED, REPL_VIEW_ID, CONTEXT_DEBUGGERS_AVAILABLE, State, getStateLabel, CONTEXT_BREAKPOINT_INPUT_FOCUSED, CONTEXT_FOCUSED_SESSION_IS_ATTACH, VIEWLET_ID, CONTEXT_DISASSEMBLY_VIEW_FOCUS, CONTEXT_IN_DEBUG_REPL, CONTEXT_STEP_INTO_TARGETS_SUPPORTED, isFrameDeemphasized } from "../common/debug.js";
import { Expression, Variable, Breakpoint, FunctionBreakpoint, DataBreakpoint } from "../common/debugModel.js";
import { IExtensionsWorkbenchService } from "../../extensions/common/extensions.js";
import { isCodeEditor } from "../../../../editor/browser/editorBrowser.js";
import { MenuRegistry, MenuId, Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { EditorContextKeys } from "../../../../editor/common/editorContextKeys.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { openBreakpointSource } from "./breakpointsView.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { InputFocusedContext } from "../../../../platform/contextkey/common/contextkeys.js";
import { ActiveEditorContext, PanelFocusContext, ResourceContextKey } from "../../../common/contextkeys.js";
import { CommandsRegistry, ICommandService } from "../../../../platform/commands/common/commands.js";
import { ITextResourcePropertiesService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { ViewContainerLocation } from "../../../common/views.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { deepClone } from "../../../../base/common/objects.js";
import { isWeb, isWindows } from "../../../../base/common/platform.js";
import { saveAllBeforeDebugStart } from "../common/debugUtils.js";
import { IPaneCompositePartService } from "../../../services/panecomposite/browser/panecomposite.js";
import { showLoadedScriptMenu } from "../common/loadedScriptsPicker.js";
import { showDebugSessionMenu } from "./debugSessionPicker.js";
import { TEXT_FILE_EDITOR_ID } from "../../files/common/files.js";
import { ChatContextKeys } from "../../chat/common/chatContextKeys.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
const ADD_CONFIGURATION_ID = "debug.addConfiguration";
const TOGGLE_INLINE_BREAKPOINT_ID = "editor.debug.action.toggleInlineBreakpoint";
const COPY_STACK_TRACE_ID = "debug.copyStackTrace";
const REVERSE_CONTINUE_ID = "workbench.action.debug.reverseContinue";
const STEP_BACK_ID = "workbench.action.debug.stepBack";
const RESTART_SESSION_ID = "workbench.action.debug.restart";
const TERMINATE_THREAD_ID = "workbench.action.debug.terminateThread";
const STEP_OVER_ID = "workbench.action.debug.stepOver";
const STEP_INTO_ID = "workbench.action.debug.stepInto";
const STEP_INTO_TARGET_ID = "workbench.action.debug.stepIntoTarget";
const STEP_OUT_ID = "workbench.action.debug.stepOut";
const PAUSE_ID = "workbench.action.debug.pause";
const DISCONNECT_ID = "workbench.action.debug.disconnect";
const DISCONNECT_AND_SUSPEND_ID = "workbench.action.debug.disconnectAndSuspend";
const STOP_ID = "workbench.action.debug.stop";
const RESTART_FRAME_ID = "workbench.action.debug.restartFrame";
const CONTINUE_ID = "workbench.action.debug.continue";
const FOCUS_REPL_ID = "workbench.debug.action.focusRepl";
const JUMP_TO_CURSOR_ID = "debug.jumpToCursor";
const FOCUS_SESSION_ID = "workbench.action.debug.focusProcess";
const SELECT_AND_START_ID = "workbench.action.debug.selectandstart";
const SELECT_DEBUG_CONSOLE_ID = "workbench.action.debug.selectDebugConsole";
const SELECT_DEBUG_SESSION_ID = "workbench.action.debug.selectDebugSession";
const DEBUG_CONFIGURE_COMMAND_ID = "workbench.action.debug.configure";
const DEBUG_START_COMMAND_ID = "workbench.action.debug.start";
const DEBUG_RUN_COMMAND_ID = "workbench.action.debug.run";
const EDIT_EXPRESSION_COMMAND_ID = "debug.renameWatchExpression";
const COPY_WATCH_EXPRESSION_COMMAND_ID = "debug.copyWatchExpression";
const SET_EXPRESSION_COMMAND_ID = "debug.setWatchExpression";
const REMOVE_EXPRESSION_COMMAND_ID = "debug.removeWatchExpression";
const NEXT_DEBUG_CONSOLE_ID = "workbench.action.debug.nextConsole";
const PREV_DEBUG_CONSOLE_ID = "workbench.action.debug.prevConsole";
const SHOW_LOADED_SCRIPTS_ID = "workbench.action.debug.showLoadedScripts";
const CALLSTACK_TOP_ID = "workbench.action.debug.callStackTop";
const CALLSTACK_BOTTOM_ID = "workbench.action.debug.callStackBottom";
const CALLSTACK_UP_ID = "workbench.action.debug.callStackUp";
const CALLSTACK_DOWN_ID = "workbench.action.debug.callStackDown";
const ADD_TO_WATCH_ID = "debug.addToWatchExpressions";
const COPY_EVALUATE_PATH_ID = "debug.copyEvaluatePath";
const COPY_VALUE_ID = "workbench.debug.viewlet.action.copyValue";
const DEBUG_COMMAND_CATEGORY = nls.localize2("debug", "Debug");
const RESTART_LABEL = nls.localize2("restartDebug", "Restart");
const STEP_OVER_LABEL = nls.localize2("stepOverDebug", "Step Over");
const STEP_INTO_LABEL = nls.localize2("stepIntoDebug", "Step Into");
const STEP_INTO_TARGET_LABEL = nls.localize2("stepIntoTargetDebug", "Step Into Target");
const STEP_OUT_LABEL = nls.localize2("stepOutDebug", "Step Out");
const PAUSE_LABEL = nls.localize2("pauseDebug", "Pause");
const DISCONNECT_LABEL = nls.localize2("disconnect", "Disconnect");
const DISCONNECT_AND_SUSPEND_LABEL = nls.localize2("disconnectSuspend", "Disconnect and Suspend");
const STOP_LABEL = nls.localize2("stop", "Stop");
const CONTINUE_LABEL = nls.localize2("continueDebug", "Continue");
const FOCUS_SESSION_LABEL = nls.localize2("focusSession", "Focus Session");
const SELECT_AND_START_LABEL = nls.localize2("selectAndStartDebugging", "Select and Start Debugging");
const DEBUG_CONFIGURE_LABEL = nls.localize("openLaunchJson", "Open '{0}'", "launch.json");
const DEBUG_START_LABEL = nls.localize2("startDebug", "Start Debugging");
const DEBUG_RUN_LABEL = nls.localize2("startWithoutDebugging", "Start Without Debugging");
const NEXT_DEBUG_CONSOLE_LABEL = nls.localize2("nextDebugConsole", "Focus Next Debug Console");
const PREV_DEBUG_CONSOLE_LABEL = nls.localize2("prevDebugConsole", "Focus Previous Debug Console");
const OPEN_LOADED_SCRIPTS_LABEL = nls.localize2("openLoadedScript", "Open Loaded Script...");
const CALLSTACK_TOP_LABEL = nls.localize2("callStackTop", "Navigate to Top of Call Stack");
const CALLSTACK_BOTTOM_LABEL = nls.localize2("callStackBottom", "Navigate to Bottom of Call Stack");
const CALLSTACK_UP_LABEL = nls.localize2("callStackUp", "Navigate Up Call Stack");
const CALLSTACK_DOWN_LABEL = nls.localize2("callStackDown", "Navigate Down Call Stack");
const COPY_EVALUATE_PATH_LABEL = nls.localize2("copyAsExpression", "Copy as Expression");
const COPY_VALUE_LABEL = nls.localize2("copyValue", "Copy Value");
const ADD_TO_WATCH_LABEL = nls.localize2("addToWatchExpressions", "Add to Watch");
const SELECT_DEBUG_CONSOLE_LABEL = nls.localize2("selectDebugConsole", "Select Debug Console");
const SELECT_DEBUG_SESSION_LABEL = nls.localize2("selectDebugSession", "Select Debug Session");
const DEBUG_QUICK_ACCESS_PREFIX = "debug ";
const DEBUG_CONSOLE_QUICK_ACCESS_PREFIX = "debug consoles ";
function isThreadContext(obj) {
  return obj && typeof obj.sessionId === "string" && typeof obj.threadId === "string";
}
async function getThreadAndRun(accessor, sessionAndThreadId, run) {
  const debugService = accessor.get(IDebugService);
  let thread;
  if (isThreadContext(sessionAndThreadId)) {
    const session = debugService.getModel().getSession(sessionAndThreadId.sessionId);
    if (session) {
      thread = session.getAllThreads().find((t) => t.getId() === sessionAndThreadId.threadId);
    }
  } else if (isSessionContext(sessionAndThreadId)) {
    const session = debugService.getModel().getSession(sessionAndThreadId.sessionId);
    if (session) {
      const threads = session.getAllThreads();
      thread = threads.length > 0 ? threads[0] : void 0;
    }
  }
  if (!thread) {
    thread = debugService.getViewModel().focusedThread;
    if (!thread) {
      const focusedSession = debugService.getViewModel().focusedSession;
      const threads = focusedSession ? focusedSession.getAllThreads() : void 0;
      thread = threads && threads.length ? threads[0] : void 0;
    }
  }
  if (thread) {
    await run(thread);
  }
}
function isStackFrameContext(obj) {
  return obj && typeof obj.sessionId === "string" && typeof obj.threadId === "string" && typeof obj.frameId === "string";
}
function getFrame(debugService, context) {
  if (isStackFrameContext(context)) {
    const session = debugService.getModel().getSession(context.sessionId);
    if (session) {
      const thread = session.getAllThreads().find((t) => t.getId() === context.threadId);
      if (thread) {
        return thread.getCallStack().find((sf) => sf.getId() === context.frameId);
      }
    }
  } else {
    return debugService.getViewModel().focusedStackFrame;
  }
  return void 0;
}
function isSessionContext(obj) {
  return obj && typeof obj.sessionId === "string";
}
async function changeDebugConsoleFocus(accessor, next) {
  const debugService = accessor.get(IDebugService);
  const viewsService = accessor.get(IViewsService);
  const sessions = debugService.getModel().getSessions(true).filter((s) => s.hasSeparateRepl());
  let currSession = debugService.getViewModel().focusedSession;
  let nextIndex = 0;
  if (sessions.length > 0 && currSession) {
    while (currSession && !currSession.hasSeparateRepl()) {
      currSession = currSession.parentSession;
    }
    if (currSession) {
      const currIndex = sessions.indexOf(currSession);
      if (next) {
        nextIndex = currIndex === sessions.length - 1 ? 0 : currIndex + 1;
      } else {
        nextIndex = currIndex === 0 ? sessions.length - 1 : currIndex - 1;
      }
    }
  }
  await debugService.focusStackFrame(void 0, void 0, sessions[nextIndex], { explicit: true });
  if (!viewsService.isViewVisible(REPL_VIEW_ID)) {
    await viewsService.openView(REPL_VIEW_ID, true);
  }
}
async function navigateCallStack(debugService, down) {
  const frame = debugService.getViewModel().focusedStackFrame;
  if (frame) {
    let callStack = frame.thread.getCallStack();
    let index = callStack.findIndex((elem) => elem.frameId === frame.frameId);
    let nextVisibleFrame;
    if (down) {
      if (index >= callStack.length - 1) {
        if (frame.thread.reachedEndOfCallStack) {
          goToTopOfCallStack(debugService);
          return;
        } else {
          await debugService.getModel().fetchCallstack(frame.thread, 20);
          callStack = frame.thread.getCallStack();
          index = callStack.findIndex((elem) => elem.frameId === frame.frameId);
        }
      }
      nextVisibleFrame = findNextVisibleFrame(true, callStack, index);
    } else {
      if (index <= 0) {
        goToBottomOfCallStack(debugService);
        return;
      }
      nextVisibleFrame = findNextVisibleFrame(false, callStack, index);
    }
    if (nextVisibleFrame) {
      debugService.focusStackFrame(nextVisibleFrame, void 0, void 0, { preserveFocus: false });
    }
  }
}
async function goToBottomOfCallStack(debugService) {
  const thread = debugService.getViewModel().focusedThread;
  if (thread) {
    await debugService.getModel().fetchCallstack(thread);
    const callStack = thread.getCallStack();
    if (callStack.length > 0) {
      const nextVisibleFrame = findNextVisibleFrame(false, callStack, 0);
      if (nextVisibleFrame) {
        debugService.focusStackFrame(nextVisibleFrame, void 0, void 0, { preserveFocus: false });
      }
    }
  }
}
function goToTopOfCallStack(debugService) {
  const thread = debugService.getViewModel().focusedThread;
  if (thread) {
    debugService.focusStackFrame(thread.getTopStackFrame(), void 0, void 0, { preserveFocus: false });
  }
}
function findNextVisibleFrame(down, callStack, startIndex) {
  if (startIndex >= callStack.length) {
    startIndex = callStack.length - 1;
  } else if (startIndex < 0) {
    startIndex = 0;
  }
  let index = startIndex;
  let currFrame;
  do {
    if (down) {
      if (index === callStack.length - 1) {
        index = 0;
      } else {
        index++;
      }
    } else {
      if (index === 0) {
        index = callStack.length - 1;
      } else {
        index--;
      }
    }
    currFrame = callStack[index];
    if (!isFrameDeemphasized(currFrame)) {
      return currFrame;
    }
  } while (index !== startIndex);
  return void 0;
}
CommandsRegistry.registerCommand({
  id: COPY_STACK_TRACE_ID,
  handler: async (accessor, _, context) => {
    const textResourcePropertiesService = accessor.get(ITextResourcePropertiesService);
    const clipboardService = accessor.get(IClipboardService);
    const debugService = accessor.get(IDebugService);
    const frame = getFrame(debugService, context);
    if (frame) {
      const eol = textResourcePropertiesService.getEOL(frame.source.uri);
      await clipboardService.writeText(frame.thread.getCallStack().map((sf) => sf.toString()).join(eol));
    }
  }
});
CommandsRegistry.registerCommand({
  id: REVERSE_CONTINUE_ID,
  handler: async (accessor, _, context) => {
    await getThreadAndRun(accessor, context, (thread) => thread.reverseContinue());
  }
});
CommandsRegistry.registerCommand({
  id: STEP_BACK_ID,
  handler: async (accessor, _, context) => {
    const contextKeyService = accessor.get(IContextKeyService);
    if (CONTEXT_DISASSEMBLY_VIEW_FOCUS.getValue(contextKeyService)) {
      await getThreadAndRun(accessor, context, (thread) => thread.stepBack("instruction"));
    } else {
      await getThreadAndRun(accessor, context, (thread) => thread.stepBack());
    }
  }
});
CommandsRegistry.registerCommand({
  id: TERMINATE_THREAD_ID,
  handler: async (accessor, _, context) => {
    await getThreadAndRun(accessor, context, (thread) => thread.terminate());
  }
});
CommandsRegistry.registerCommand({
  id: JUMP_TO_CURSOR_ID,
  handler: async (accessor) => {
    const debugService = accessor.get(IDebugService);
    const stackFrame = debugService.getViewModel().focusedStackFrame;
    const editorService = accessor.get(IEditorService);
    const activeEditorControl = editorService.activeTextEditorControl;
    const notificationService = accessor.get(INotificationService);
    const quickInputService = accessor.get(IQuickInputService);
    if (stackFrame && isCodeEditor(activeEditorControl) && activeEditorControl.hasModel()) {
      const position = activeEditorControl.getPosition();
      const resource = activeEditorControl.getModel().uri;
      const source = stackFrame.thread.session.getSourceForUri(resource);
      if (source) {
        const response = await stackFrame.thread.session.gotoTargets(source.raw, position.lineNumber, position.column);
        const targets = response?.body.targets;
        if (targets && targets.length) {
          let id = targets[0].id;
          if (targets.length > 1) {
            const picks = targets.map((t) => ({ label: t.label, _id: t.id }));
            const pick = await quickInputService.pick(picks, { placeHolder: nls.localize("chooseLocation", "Choose the specific location") });
            if (!pick) {
              return;
            }
            id = pick._id;
          }
          return await stackFrame.thread.session.goto(stackFrame.thread.threadId, id).catch((e) => notificationService.warn(e));
        }
      }
    }
    return notificationService.warn(nls.localize("noExecutableCode", "No executable code is associated at the current cursor position."));
  }
});
CommandsRegistry.registerCommand({
  id: CALLSTACK_TOP_ID,
  handler: async (accessor, _, context) => {
    const debugService = accessor.get(IDebugService);
    goToTopOfCallStack(debugService);
  }
});
CommandsRegistry.registerCommand({
  id: CALLSTACK_BOTTOM_ID,
  handler: async (accessor, _, context) => {
    const debugService = accessor.get(IDebugService);
    await goToBottomOfCallStack(debugService);
  }
});
CommandsRegistry.registerCommand({
  id: CALLSTACK_UP_ID,
  handler: async (accessor, _, context) => {
    const debugService = accessor.get(IDebugService);
    navigateCallStack(debugService, false);
  }
});
CommandsRegistry.registerCommand({
  id: CALLSTACK_DOWN_ID,
  handler: async (accessor, _, context) => {
    const debugService = accessor.get(IDebugService);
    navigateCallStack(debugService, true);
  }
});
MenuRegistry.appendMenuItem(MenuId.EditorContext, {
  command: {
    id: JUMP_TO_CURSOR_ID,
    title: nls.localize("jumpToCursor", "Jump to Cursor"),
    category: DEBUG_COMMAND_CATEGORY
  },
  when: ContextKeyExpr.and(CONTEXT_JUMP_TO_CURSOR_SUPPORTED, EditorContextKeys.editorTextFocus),
  group: "debug",
  order: 3
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: NEXT_DEBUG_CONSOLE_ID,
  weight: KeybindingWeight.WorkbenchContrib + 1,
  when: CONTEXT_IN_DEBUG_REPL,
  primary: KeyMod.CtrlCmd | KeyCode.PageDown,
  mac: { primary: KeyMod.Shift | KeyMod.CtrlCmd | KeyCode.BracketRight },
  handler: async (accessor, _, context) => {
    changeDebugConsoleFocus(accessor, true);
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: PREV_DEBUG_CONSOLE_ID,
  weight: KeybindingWeight.WorkbenchContrib + 1,
  when: CONTEXT_IN_DEBUG_REPL,
  primary: KeyMod.CtrlCmd | KeyCode.PageUp,
  mac: { primary: KeyMod.Shift | KeyMod.CtrlCmd | KeyCode.BracketLeft },
  handler: async (accessor, _, context) => {
    changeDebugConsoleFocus(accessor, false);
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: RESTART_SESSION_ID,
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyMod.Shift | KeyMod.CtrlCmd | KeyCode.F5,
  when: CONTEXT_IN_DEBUG_MODE,
  handler: async (accessor, _, context) => {
    const debugService = accessor.get(IDebugService);
    const configurationService = accessor.get(IConfigurationService);
    let session;
    if (isSessionContext(context)) {
      session = debugService.getModel().getSession(context.sessionId);
    } else {
      session = debugService.getViewModel().focusedSession;
    }
    if (!session) {
      const { launch, name } = debugService.getConfigurationManager().selectedConfiguration;
      await debugService.startDebugging(launch, name, { noDebug: false, startedByUser: true });
    } else {
      const showSubSessions = configurationService.getValue("debug").showSubSessionsInToolBar;
      while (!showSubSessions && session.lifecycleManagedByParent && session.parentSession) {
        session = session.parentSession;
      }
      session.removeReplExpressions();
      await debugService.restartSession(session);
    }
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: STEP_OVER_ID,
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyCode.F10,
  when: CONTEXT_DEBUG_STATE.isEqualTo("stopped"),
  handler: async (accessor, _, context) => {
    const contextKeyService = accessor.get(IContextKeyService);
    if (CONTEXT_DISASSEMBLY_VIEW_FOCUS.getValue(contextKeyService)) {
      await getThreadAndRun(accessor, context, (thread) => thread.next("instruction"));
    } else {
      await getThreadAndRun(accessor, context, (thread) => thread.next());
    }
  }
});
const STEP_INTO_KEYBINDING = isWeb && isWindows ? KeyMod.Alt | KeyCode.F11 : KeyCode.F11;
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: STEP_INTO_ID,
  weight: KeybindingWeight.WorkbenchContrib + 10,
  // Have a stronger weight to have priority over full screen when debugging
  primary: STEP_INTO_KEYBINDING,
  // Use a more flexible when clause to not allow full screen command to take over when F11 pressed a lot of times
  when: CONTEXT_DEBUG_STATE.notEqualsTo("inactive"),
  handler: async (accessor, _, context) => {
    const contextKeyService = accessor.get(IContextKeyService);
    if (CONTEXT_DISASSEMBLY_VIEW_FOCUS.getValue(contextKeyService)) {
      await getThreadAndRun(accessor, context, (thread) => thread.stepIn("instruction"));
    } else {
      await getThreadAndRun(accessor, context, (thread) => thread.stepIn());
    }
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: STEP_OUT_ID,
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyMod.Shift | KeyCode.F11,
  when: CONTEXT_DEBUG_STATE.isEqualTo("stopped"),
  handler: async (accessor, _, context) => {
    const contextKeyService = accessor.get(IContextKeyService);
    if (CONTEXT_DISASSEMBLY_VIEW_FOCUS.getValue(contextKeyService)) {
      await getThreadAndRun(accessor, context, (thread) => thread.stepOut("instruction"));
    } else {
      await getThreadAndRun(accessor, context, (thread) => thread.stepOut());
    }
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: PAUSE_ID,
  weight: KeybindingWeight.WorkbenchContrib + 2,
  // take priority over focus next part while we are debugging
  primary: KeyCode.F6,
  when: CONTEXT_DEBUG_STATE.isEqualTo("running"),
  handler: async (accessor, _, context) => {
    await getThreadAndRun(accessor, context, (thread) => thread.pause());
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: STEP_INTO_TARGET_ID,
  primary: STEP_INTO_KEYBINDING | KeyMod.CtrlCmd,
  when: ContextKeyExpr.and(CONTEXT_STEP_INTO_TARGETS_SUPPORTED, CONTEXT_IN_DEBUG_MODE, CONTEXT_DEBUG_STATE.isEqualTo("stopped")),
  weight: KeybindingWeight.WorkbenchContrib,
  handler: async (accessor, _, context) => {
    const quickInputService = accessor.get(IQuickInputService);
    const debugService = accessor.get(IDebugService);
    const session = debugService.getViewModel().focusedSession;
    const frame = debugService.getViewModel().focusedStackFrame;
    if (!frame || !session) {
      return;
    }
    const editor = await accessor.get(IEditorService).openEditor({
      resource: frame.source.uri,
      options: { revealIfOpened: true }
    });
    let codeEditor;
    if (editor) {
      const ctrl = editor?.getControl();
      if (isCodeEditor(ctrl)) {
        codeEditor = ctrl;
      }
    }
    const disposables = new DisposableStore();
    const qp = disposables.add(quickInputService.createQuickPick());
    qp.busy = true;
    qp.show();
    disposables.add(qp.onDidChangeActive(([item]) => {
      if (codeEditor && item && item.target.line !== void 0) {
        codeEditor.revealLineInCenterIfOutsideViewport(item.target.line);
        codeEditor.setSelection({
          startLineNumber: item.target.line,
          startColumn: item.target.column || 1,
          endLineNumber: item.target.endLine || item.target.line,
          endColumn: item.target.endColumn || item.target.column || 1
        });
      }
    }));
    disposables.add(qp.onDidAccept(() => {
      if (qp.activeItems.length) {
        session.stepIn(frame.thread.threadId, qp.activeItems[0].target.id);
      }
    }));
    disposables.add(qp.onDidHide(() => disposables.dispose()));
    session.stepInTargets(frame.frameId).then((targets) => {
      qp.busy = false;
      if (targets?.length) {
        qp.items = targets?.map((target) => ({ target, label: target.label }));
      } else {
        qp.placeholder = nls.localize("editor.debug.action.stepIntoTargets.none", "No step targets available");
      }
    });
  }
});
async function stopHandler(accessor, _, context, disconnect, suspend) {
  const debugService = accessor.get(IDebugService);
  let session;
  if (isSessionContext(context)) {
    session = debugService.getModel().getSession(context.sessionId);
  } else {
    session = debugService.getViewModel().focusedSession;
  }
  const configurationService = accessor.get(IConfigurationService);
  const showSubSessions = configurationService.getValue("debug").showSubSessionsInToolBar;
  while (!showSubSessions && session && session.lifecycleManagedByParent && session.parentSession) {
    session = session.parentSession;
  }
  await debugService.stopSession(session, disconnect, suspend);
}
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: DISCONNECT_ID,
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyMod.Shift | KeyCode.F5,
  when: ContextKeyExpr.and(CONTEXT_FOCUSED_SESSION_IS_ATTACH, CONTEXT_IN_DEBUG_MODE),
  handler: (accessor, _, context) => stopHandler(accessor, _, context, true)
});
CommandsRegistry.registerCommand({
  id: DISCONNECT_AND_SUSPEND_ID,
  handler: (accessor, _, context) => stopHandler(accessor, _, context, true, true)
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: STOP_ID,
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyMod.Shift | KeyCode.F5,
  when: ContextKeyExpr.and(CONTEXT_FOCUSED_SESSION_IS_ATTACH.toNegated(), CONTEXT_IN_DEBUG_MODE),
  handler: (accessor, _, context) => stopHandler(accessor, _, context, false)
});
CommandsRegistry.registerCommand({
  id: RESTART_FRAME_ID,
  handler: async (accessor, _, context) => {
    const debugService = accessor.get(IDebugService);
    const notificationService = accessor.get(INotificationService);
    const frame = getFrame(debugService, context);
    if (frame) {
      try {
        await frame.restart();
      } catch (e) {
        notificationService.error(e);
      }
    }
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: CONTINUE_ID,
  weight: KeybindingWeight.WorkbenchContrib + 10,
  // Use a stronger weight to get priority over start debugging F5 shortcut
  primary: KeyCode.F5,
  when: CONTEXT_DEBUG_STATE.isEqualTo("stopped"),
  handler: async (accessor, _, context) => {
    await getThreadAndRun(accessor, context, (thread) => thread.continue());
  }
});
CommandsRegistry.registerCommand({
  id: SHOW_LOADED_SCRIPTS_ID,
  handler: async (accessor) => {
    await showLoadedScriptMenu(accessor);
  }
});
CommandsRegistry.registerCommand({
  id: "debug.startFromConfig",
  handler: async (accessor, config) => {
    const debugService = accessor.get(IDebugService);
    await debugService.startDebugging(void 0, config);
  }
});
CommandsRegistry.registerCommand({
  id: FOCUS_SESSION_ID,
  handler: async (accessor, session) => {
    const debugService = accessor.get(IDebugService);
    const editorService = accessor.get(IEditorService);
    const stoppedChildSession = debugService.getModel().getSessions().find((s) => s.parentSession === session && s.state === State.Stopped);
    if (stoppedChildSession && session.state !== State.Stopped) {
      session = stoppedChildSession;
    }
    await debugService.focusStackFrame(void 0, void 0, session, { explicit: true });
    const stackFrame = debugService.getViewModel().focusedStackFrame;
    if (stackFrame) {
      await stackFrame.openInEditor(editorService, true);
    }
  }
});
CommandsRegistry.registerCommand({
  id: SELECT_AND_START_ID,
  handler: async (accessor, debugType, debugStartOptions) => {
    const quickInputService = accessor.get(IQuickInputService);
    const debugService = accessor.get(IDebugService);
    if (debugType) {
      const configManager = debugService.getConfigurationManager();
      const dynamicProviders = await configManager.getDynamicProviders();
      for (const provider of dynamicProviders) {
        if (provider.type === debugType) {
          const pick = await provider.pick();
          if (pick) {
            await configManager.selectConfiguration(pick.launch, pick.config.name, pick.config, { type: provider.type });
            debugService.startDebugging(pick.launch, pick.config, { noDebug: debugStartOptions?.noDebug, startedByUser: true });
            return;
          }
        }
      }
    }
    quickInputService.quickAccess.show(DEBUG_QUICK_ACCESS_PREFIX);
  }
});
CommandsRegistry.registerCommand({
  id: SELECT_DEBUG_CONSOLE_ID,
  handler: async (accessor) => {
    const quickInputService = accessor.get(IQuickInputService);
    quickInputService.quickAccess.show(DEBUG_CONSOLE_QUICK_ACCESS_PREFIX);
  }
});
CommandsRegistry.registerCommand({
  id: SELECT_DEBUG_SESSION_ID,
  handler: async (accessor) => {
    showDebugSessionMenu(accessor, SELECT_AND_START_ID);
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: DEBUG_START_COMMAND_ID,
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyCode.F5,
  when: ContextKeyExpr.and(CONTEXT_DEBUGGERS_AVAILABLE, CONTEXT_DEBUG_STATE.isEqualTo("inactive")),
  handler: async (accessor, debugStartOptions) => {
    const debugService = accessor.get(IDebugService);
    await saveAllBeforeDebugStart(accessor.get(IConfigurationService), accessor.get(IEditorService));
    const { launch, name, getConfig } = debugService.getConfigurationManager().selectedConfiguration;
    const config = await getConfig();
    const configOrName = config ? Object.assign(deepClone(config), debugStartOptions?.config) : name;
    await debugService.startDebugging(launch, configOrName, { noDebug: debugStartOptions?.noDebug, startedByUser: true }, false);
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: DEBUG_RUN_COMMAND_ID,
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyMod.CtrlCmd | KeyCode.F5,
  mac: { primary: KeyMod.WinCtrl | KeyCode.F5 },
  when: ContextKeyExpr.and(CONTEXT_DEBUGGERS_AVAILABLE, CONTEXT_DEBUG_STATE.notEqualsTo(getStateLabel(State.Initializing))),
  handler: async (accessor) => {
    const commandService = accessor.get(ICommandService);
    await commandService.executeCommand(DEBUG_START_COMMAND_ID, { noDebug: true });
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "debug.toggleBreakpoint",
  weight: KeybindingWeight.WorkbenchContrib + 5,
  when: ContextKeyExpr.and(CONTEXT_BREAKPOINTS_FOCUSED, InputFocusedContext.toNegated()),
  primary: KeyCode.Space,
  handler: (accessor) => {
    const listService = accessor.get(IListService);
    const debugService = accessor.get(IDebugService);
    const list = listService.lastFocusedList;
    if (list instanceof List) {
      const focused = list.getFocusedElements();
      if (focused && focused.length) {
        debugService.enableOrDisableBreakpoints(!focused[0].enabled, focused[0]);
      }
    }
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "debug.enableOrDisableBreakpoint",
  weight: KeybindingWeight.WorkbenchContrib,
  primary: void 0,
  when: EditorContextKeys.editorTextFocus,
  handler: (accessor) => {
    const debugService = accessor.get(IDebugService);
    const editorService = accessor.get(IEditorService);
    const control = editorService.activeTextEditorControl;
    if (isCodeEditor(control)) {
      const model = control.getModel();
      if (model) {
        const position = control.getPosition();
        if (position) {
          const bps = debugService.getModel().getBreakpoints({ uri: model.uri, lineNumber: position.lineNumber });
          if (bps.length) {
            debugService.enableOrDisableBreakpoints(!bps[0].enabled, bps[0]);
          }
        }
      }
    }
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: EDIT_EXPRESSION_COMMAND_ID,
  weight: KeybindingWeight.WorkbenchContrib + 5,
  when: CONTEXT_WATCH_EXPRESSIONS_FOCUSED,
  primary: KeyCode.F2,
  mac: { primary: KeyCode.Enter },
  handler: (accessor, expression) => {
    const debugService = accessor.get(IDebugService);
    if (!(expression instanceof Expression)) {
      const listService = accessor.get(IListService);
      const focused = listService.lastFocusedList;
      if (focused) {
        const elements = focused.getFocus();
        if (Array.isArray(elements) && elements[0] instanceof Expression) {
          expression = elements[0];
        }
      }
    }
    if (expression instanceof Expression) {
      debugService.getViewModel().setSelectedExpression(expression, false);
    }
  }
});
CommandsRegistry.registerCommand({
  id: SET_EXPRESSION_COMMAND_ID,
  handler: async (accessor, expression) => {
    const debugService = accessor.get(IDebugService);
    if (expression instanceof Expression || expression instanceof Variable) {
      debugService.getViewModel().setSelectedExpression(expression, true);
    }
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "debug.setVariable",
  weight: KeybindingWeight.WorkbenchContrib + 5,
  when: CONTEXT_VARIABLES_FOCUSED,
  primary: KeyCode.F2,
  mac: { primary: KeyCode.Enter },
  handler: (accessor) => {
    const listService = accessor.get(IListService);
    const debugService = accessor.get(IDebugService);
    const focused = listService.lastFocusedList;
    if (focused) {
      const elements = focused.getFocus();
      if (Array.isArray(elements) && elements[0] instanceof Variable) {
        debugService.getViewModel().setSelectedExpression(elements[0], false);
      }
    }
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: REMOVE_EXPRESSION_COMMAND_ID,
  weight: KeybindingWeight.WorkbenchContrib,
  when: ContextKeyExpr.and(CONTEXT_WATCH_EXPRESSIONS_FOCUSED, CONTEXT_EXPRESSION_SELECTED.toNegated()),
  primary: KeyCode.Delete,
  mac: { primary: KeyMod.CtrlCmd | KeyCode.Backspace },
  handler: (accessor, expression) => {
    const debugService = accessor.get(IDebugService);
    if (expression instanceof Expression) {
      debugService.removeWatchExpressions(expression.getId());
      return;
    }
    const listService = accessor.get(IListService);
    const focused = listService.lastFocusedList;
    if (focused) {
      let elements = focused.getFocus();
      if (Array.isArray(elements) && elements[0] instanceof Expression) {
        const selection = focused.getSelection();
        if (selection && selection.indexOf(elements[0]) >= 0) {
          elements = selection;
        }
        elements.forEach((e) => debugService.removeWatchExpressions(e.getId()));
      }
    }
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "debug.removeBreakpoint",
  weight: KeybindingWeight.WorkbenchContrib,
  when: ContextKeyExpr.and(CONTEXT_BREAKPOINTS_FOCUSED, CONTEXT_BREAKPOINT_INPUT_FOCUSED.toNegated()),
  primary: KeyCode.Delete,
  mac: { primary: KeyMod.CtrlCmd | KeyCode.Backspace },
  handler: (accessor) => {
    const listService = accessor.get(IListService);
    const debugService = accessor.get(IDebugService);
    const list = listService.lastFocusedList;
    if (list instanceof List) {
      const focused = list.getFocusedElements();
      const element = focused.length ? focused[0] : void 0;
      if (element instanceof Breakpoint) {
        debugService.removeBreakpoints(element.getId());
      } else if (element instanceof FunctionBreakpoint) {
        debugService.removeFunctionBreakpoints(element.getId());
      } else if (element instanceof DataBreakpoint) {
        debugService.removeDataBreakpoints(element.getId());
      }
    }
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "debug.installAdditionalDebuggers",
  weight: KeybindingWeight.WorkbenchContrib,
  when: void 0,
  primary: void 0,
  handler: async (accessor, query) => {
    const extensionsWorkbenchService = accessor.get(IExtensionsWorkbenchService);
    let searchFor = `@category:debuggers`;
    if (typeof query === "string") {
      searchFor += ` ${query}`;
    }
    return extensionsWorkbenchService.openSearch(searchFor);
  }
});
registerAction2(class AddConfigurationAction extends Action2 {
  constructor() {
    super({
      id: ADD_CONFIGURATION_ID,
      title: nls.localize2("addConfiguration", "Add Configuration..."),
      category: DEBUG_COMMAND_CATEGORY,
      f1: true,
      menu: {
        id: MenuId.EditorContent,
        when: ContextKeyExpr.and(
          ContextKeyExpr.regex(ResourceContextKey.Path.key, /\.vscode[/\\]launch\.json$/),
          ActiveEditorContext.isEqualTo(TEXT_FILE_EDITOR_ID)
        )
      }
    });
  }
  async run(accessor, launchUri) {
    const manager = accessor.get(IDebugService).getConfigurationManager();
    const launch = manager.getLaunches().find((l) => l.uri.toString() === launchUri) || manager.selectedConfiguration.launch;
    if (launch) {
      const { editor, created } = await launch.openConfigFile({ preserveFocus: false });
      if (editor && !created) {
        const codeEditor = editor.getControl();
        if (codeEditor) {
          await codeEditor.getContribution(EDITOR_CONTRIBUTION_ID)?.addLaunchConfiguration();
        }
      }
    }
  }
});
const inlineBreakpointHandler = (accessor) => {
  const debugService = accessor.get(IDebugService);
  const editorService = accessor.get(IEditorService);
  const control = editorService.activeTextEditorControl;
  if (isCodeEditor(control)) {
    const position = control.getPosition();
    if (position && control.hasModel() && debugService.canSetBreakpointsIn(control.getModel())) {
      const modelUri = control.getModel().uri;
      const breakpointAlreadySet = debugService.getModel().getBreakpoints({ lineNumber: position.lineNumber, uri: modelUri }).some((bp) => bp.sessionAgnosticData.column === position.column || !bp.column && position.column <= 1);
      if (!breakpointAlreadySet) {
        debugService.addBreakpoints(modelUri, [{ lineNumber: position.lineNumber, column: position.column > 1 ? position.column : void 0 }]);
      }
    }
  }
};
KeybindingsRegistry.registerCommandAndKeybindingRule({
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyMod.Shift | KeyCode.F9,
  when: EditorContextKeys.editorTextFocus,
  id: TOGGLE_INLINE_BREAKPOINT_ID,
  handler: inlineBreakpointHandler
});
MenuRegistry.appendMenuItem(MenuId.EditorContext, {
  command: {
    id: TOGGLE_INLINE_BREAKPOINT_ID,
    title: nls.localize("addInlineBreakpoint", "Add Inline Breakpoint"),
    category: DEBUG_COMMAND_CATEGORY
  },
  when: ContextKeyExpr.and(
    CONTEXT_IN_DEBUG_MODE,
    PanelFocusContext.toNegated(),
    EditorContextKeys.editorTextFocus,
    ChatContextKeys.inChatSession.toNegated()
  ),
  group: "debug",
  order: 1
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "debug.openBreakpointToSide",
  weight: KeybindingWeight.WorkbenchContrib,
  when: CONTEXT_BREAKPOINTS_FOCUSED,
  primary: KeyMod.CtrlCmd | KeyCode.Enter,
  secondary: [KeyMod.Alt | KeyCode.Enter],
  handler: (accessor) => {
    const listService = accessor.get(IListService);
    const list = listService.lastFocusedList;
    if (list instanceof List) {
      const focus = list.getFocusedElements();
      if (focus.length && focus[0] instanceof Breakpoint) {
        return openBreakpointSource(focus[0], true, false, true, accessor.get(IDebugService), accessor.get(IEditorService));
      }
    }
    return void 0;
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "debug.openView",
  weight: KeybindingWeight.WorkbenchContrib,
  when: CONTEXT_DEBUGGERS_AVAILABLE.toNegated(),
  primary: KeyCode.F5,
  secondary: [KeyMod.CtrlCmd | KeyCode.F5],
  handler: async (accessor) => {
    const paneCompositeService = accessor.get(IPaneCompositePartService);
    await paneCompositeService.openPaneComposite(VIEWLET_ID, ViewContainerLocation.Sidebar, true);
  }
});
export {
  ADD_CONFIGURATION_ID,
  ADD_TO_WATCH_ID,
  ADD_TO_WATCH_LABEL,
  CALLSTACK_BOTTOM_ID,
  CALLSTACK_BOTTOM_LABEL,
  CALLSTACK_DOWN_ID,
  CALLSTACK_DOWN_LABEL,
  CALLSTACK_TOP_ID,
  CALLSTACK_TOP_LABEL,
  CALLSTACK_UP_ID,
  CALLSTACK_UP_LABEL,
  CONTINUE_ID,
  CONTINUE_LABEL,
  COPY_EVALUATE_PATH_ID,
  COPY_EVALUATE_PATH_LABEL,
  COPY_STACK_TRACE_ID,
  COPY_VALUE_ID,
  COPY_VALUE_LABEL,
  COPY_WATCH_EXPRESSION_COMMAND_ID,
  DEBUG_COMMAND_CATEGORY,
  DEBUG_CONFIGURE_COMMAND_ID,
  DEBUG_CONFIGURE_LABEL,
  DEBUG_CONSOLE_QUICK_ACCESS_PREFIX,
  DEBUG_QUICK_ACCESS_PREFIX,
  DEBUG_RUN_COMMAND_ID,
  DEBUG_RUN_LABEL,
  DEBUG_START_COMMAND_ID,
  DEBUG_START_LABEL,
  DISCONNECT_AND_SUSPEND_ID,
  DISCONNECT_AND_SUSPEND_LABEL,
  DISCONNECT_ID,
  DISCONNECT_LABEL,
  EDIT_EXPRESSION_COMMAND_ID,
  FOCUS_REPL_ID,
  FOCUS_SESSION_ID,
  FOCUS_SESSION_LABEL,
  JUMP_TO_CURSOR_ID,
  NEXT_DEBUG_CONSOLE_ID,
  NEXT_DEBUG_CONSOLE_LABEL,
  OPEN_LOADED_SCRIPTS_LABEL,
  PAUSE_ID,
  PAUSE_LABEL,
  PREV_DEBUG_CONSOLE_ID,
  PREV_DEBUG_CONSOLE_LABEL,
  REMOVE_EXPRESSION_COMMAND_ID,
  RESTART_FRAME_ID,
  RESTART_LABEL,
  RESTART_SESSION_ID,
  REVERSE_CONTINUE_ID,
  SELECT_AND_START_ID,
  SELECT_AND_START_LABEL,
  SELECT_DEBUG_CONSOLE_ID,
  SELECT_DEBUG_CONSOLE_LABEL,
  SELECT_DEBUG_SESSION_ID,
  SELECT_DEBUG_SESSION_LABEL,
  SET_EXPRESSION_COMMAND_ID,
  SHOW_LOADED_SCRIPTS_ID,
  STEP_BACK_ID,
  STEP_INTO_ID,
  STEP_INTO_LABEL,
  STEP_INTO_TARGET_ID,
  STEP_INTO_TARGET_LABEL,
  STEP_OUT_ID,
  STEP_OUT_LABEL,
  STEP_OVER_ID,
  STEP_OVER_LABEL,
  STOP_ID,
  STOP_LABEL,
  TERMINATE_THREAD_ID,
  TOGGLE_INLINE_BREAKPOINT_ID
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL2RlYnVnQ29tbWFuZHMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IExpc3QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0V2lkZ2V0LmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdzUmVnaXN0cnksIEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElMaXN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xpc3QvYnJvd3Nlci9saXN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRGVidWdTZXJ2aWNlLCBJRW5hYmxlbWVudCwgQ09OVEVYVF9CUkVBS1BPSU5UU19GT0NVU0VELCBDT05URVhUX1dBVENIX0VYUFJFU1NJT05TX0ZPQ1VTRUQsIENPTlRFWFRfVkFSSUFCTEVTX0ZPQ1VTRUQsIEVESVRPUl9DT05UUklCVVRJT05fSUQsIElEZWJ1Z0VkaXRvckNvbnRyaWJ1dGlvbiwgQ09OVEVYVF9JTl9ERUJVR19NT0RFLCBDT05URVhUX0VYUFJFU1NJT05fU0VMRUNURUQsIElDb25maWcsIElTdGFja0ZyYW1lLCBJVGhyZWFkLCBJRGVidWdTZXNzaW9uLCBDT05URVhUX0RFQlVHX1NUQVRFLCBJRGVidWdDb25maWd1cmF0aW9uLCBDT05URVhUX0pVTVBfVE9fQ1VSU09SX1NVUFBPUlRFRCwgUkVQTF9WSUVXX0lELCBDT05URVhUX0RFQlVHR0VSU19BVkFJTEFCTEUsIFN0YXRlLCBnZXRTdGF0ZUxhYmVsLCBDT05URVhUX0JSRUFLUE9JTlRfSU5QVVRfRk9DVVNFRCwgQ09OVEVYVF9GT0NVU0VEX1NFU1NJT05fSVNfQVRUQUNILCBWSUVXTEVUX0lELCBDT05URVhUX0RJU0FTU0VNQkxZX1ZJRVdfRk9DVVMsIENPTlRFWFRfSU5fREVCVUdfUkVQTCwgQ09OVEVYVF9TVEVQX0lOVE9fVEFSR0VUU19TVVBQT1JURUQsIGlzRnJhbWVEZWVtcGhhc2l6ZWQgfSBmcm9tICcuLi9jb21tb24vZGVidWcuanMnO1xuaW1wb3J0IHsgRXhwcmVzc2lvbiwgVmFyaWFibGUsIEJyZWFrcG9pbnQsIEZ1bmN0aW9uQnJlYWtwb2ludCwgRGF0YUJyZWFrcG9pbnQsIFRocmVhZCB9IGZyb20gJy4uL2NvbW1vbi9kZWJ1Z01vZGVsLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSB9IGZyb20gJy4uLy4uL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IsIGlzQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgTWVudVJlZ2lzdHJ5LCBNZW51SWQsIEFjdGlvbjIsIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29udGV4dEtleXMgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByLCBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IG9wZW5CcmVha3BvaW50U291cmNlIH0gZnJvbSAnLi9icmVha3BvaW50c1ZpZXcuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBJbnB1dEZvY3VzZWRDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleXMuanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgQWN0aXZlRWRpdG9yQ29udGV4dCwgUGFuZWxGb2N1c0NvbnRleHQsIFJlc291cmNlQ29udGV4dEtleSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250ZXh0a2V5cy5qcyc7XG5pbXBvcnQgeyBDb21tYW5kc1JlZ2lzdHJ5LCBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSVRleHRSZXNvdXJjZVByb3BlcnRpZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy90ZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElDbGlwYm9hcmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY2xpcGJvYXJkL2NvbW1vbi9jbGlwYm9hcmRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSVF1aWNrSW5wdXRTZXJ2aWNlLCBJUXVpY2tQaWNrSXRlbSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrSW5wdXQuanMnO1xuaW1wb3J0IHsgVmlld0NvbnRhaW5lckxvY2F0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IElWaWV3c1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy92aWV3cy9jb21tb24vdmlld3NTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGRlZXBDbG9uZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29iamVjdHMuanMnO1xuaW1wb3J0IHsgaXNXZWIsIGlzV2luZG93cyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IHNhdmVBbGxCZWZvcmVEZWJ1Z1N0YXJ0IH0gZnJvbSAnLi4vY29tbW9uL2RlYnVnVXRpbHMuanMnO1xuaW1wb3J0IHsgSVBhbmVDb21wb3NpdGVQYXJ0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3BhbmVjb21wb3NpdGUvYnJvd3Nlci9wYW5lY29tcG9zaXRlLmpzJztcbmltcG9ydCB7IHNob3dMb2FkZWRTY3JpcHRNZW51IH0gZnJvbSAnLi4vY29tbW9uL2xvYWRlZFNjcmlwdHNQaWNrZXIuanMnO1xuaW1wb3J0IHsgc2hvd0RlYnVnU2Vzc2lvbk1lbnUgfSBmcm9tICcuL2RlYnVnU2Vzc2lvblBpY2tlci5qcyc7XG5pbXBvcnQgeyBURVhUX0ZJTEVfRURJVE9SX0lEIH0gZnJvbSAnLi4vLi4vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElMb2NhbGl6ZWRTdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb24vY29tbW9uL2FjdGlvbi5qcyc7XG5pbXBvcnQgeyBDaGF0Q29udGV4dEtleXMgfSBmcm9tICcuLi8uLi9jaGF0L2NvbW1vbi9jaGF0Q29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcblxuZXhwb3J0IGNvbnN0IEFERF9DT05GSUdVUkFUSU9OX0lEID0gJ2RlYnVnLmFkZENvbmZpZ3VyYXRpb24nO1xuZXhwb3J0IGNvbnN0IFRPR0dMRV9JTkxJTkVfQlJFQUtQT0lOVF9JRCA9ICdlZGl0b3IuZGVidWcuYWN0aW9uLnRvZ2dsZUlubGluZUJyZWFrcG9pbnQnO1xuZXhwb3J0IGNvbnN0IENPUFlfU1RBQ0tfVFJBQ0VfSUQgPSAnZGVidWcuY29weVN0YWNrVHJhY2UnO1xuZXhwb3J0IGNvbnN0IFJFVkVSU0VfQ09OVElOVUVfSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5kZWJ1Zy5yZXZlcnNlQ29udGludWUnO1xuZXhwb3J0IGNvbnN0IFNURVBfQkFDS19JRCA9ICd3b3JrYmVuY2guYWN0aW9uLmRlYnVnLnN0ZXBCYWNrJztcbmV4cG9ydCBjb25zdCBSRVNUQVJUX1NFU1NJT05fSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5kZWJ1Zy5yZXN0YXJ0JztcbmV4cG9ydCBjb25zdCBURVJNSU5BVEVfVEhSRUFEX0lEID0gJ3dvcmtiZW5jaC5hY3Rpb24uZGVidWcudGVybWluYXRlVGhyZWFkJztcbmV4cG9ydCBjb25zdCBTVEVQX09WRVJfSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5kZWJ1Zy5zdGVwT3Zlcic7XG5leHBvcnQgY29uc3QgU1RFUF9JTlRPX0lEID0gJ3dvcmtiZW5jaC5hY3Rpb24uZGVidWcuc3RlcEludG8nO1xuZXhwb3J0IGNvbnN0IFNURVBfSU5UT19UQVJHRVRfSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5kZWJ1Zy5zdGVwSW50b1RhcmdldCc7XG5leHBvcnQgY29uc3QgU1RFUF9PVVRfSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5kZWJ1Zy5zdGVwT3V0JztcbmV4cG9ydCBjb25zdCBQQVVTRV9JRCA9ICd3b3JrYmVuY2guYWN0aW9uLmRlYnVnLnBhdXNlJztcbmV4cG9ydCBjb25zdCBESVNDT05ORUNUX0lEID0gJ3dvcmtiZW5jaC5hY3Rpb24uZGVidWcuZGlzY29ubmVjdCc7XG5leHBvcnQgY29uc3QgRElTQ09OTkVDVF9BTkRfU1VTUEVORF9JRCA9ICd3b3JrYmVuY2guYWN0aW9uLmRlYnVnLmRpc2Nvbm5lY3RBbmRTdXNwZW5kJztcbmV4cG9ydCBjb25zdCBTVE9QX0lEID0gJ3dvcmtiZW5jaC5hY3Rpb24uZGVidWcuc3RvcCc7XG5leHBvcnQgY29uc3QgUkVTVEFSVF9GUkFNRV9JRCA9ICd3b3JrYmVuY2guYWN0aW9uLmRlYnVnLnJlc3RhcnRGcmFtZSc7XG5leHBvcnQgY29uc3QgQ09OVElOVUVfSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5kZWJ1Zy5jb250aW51ZSc7XG5leHBvcnQgY29uc3QgRk9DVVNfUkVQTF9JRCA9ICd3b3JrYmVuY2guZGVidWcuYWN0aW9uLmZvY3VzUmVwbCc7XG5leHBvcnQgY29uc3QgSlVNUF9UT19DVVJTT1JfSUQgPSAnZGVidWcuanVtcFRvQ3Vyc29yJztcbmV4cG9ydCBjb25zdCBGT0NVU19TRVNTSU9OX0lEID0gJ3dvcmtiZW5jaC5hY3Rpb24uZGVidWcuZm9jdXNQcm9jZXNzJztcbmV4cG9ydCBjb25zdCBTRUxFQ1RfQU5EX1NUQVJUX0lEID0gJ3dvcmtiZW5jaC5hY3Rpb24uZGVidWcuc2VsZWN0YW5kc3RhcnQnO1xuZXhwb3J0IGNvbnN0IFNFTEVDVF9ERUJVR19DT05TT0xFX0lEID0gJ3dvcmtiZW5jaC5hY3Rpb24uZGVidWcuc2VsZWN0RGVidWdDb25zb2xlJztcbmV4cG9ydCBjb25zdCBTRUxFQ1RfREVCVUdfU0VTU0lPTl9JRCA9ICd3b3JrYmVuY2guYWN0aW9uLmRlYnVnLnNlbGVjdERlYnVnU2Vzc2lvbic7XG5leHBvcnQgY29uc3QgREVCVUdfQ09ORklHVVJFX0NPTU1BTkRfSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5kZWJ1Zy5jb25maWd1cmUnO1xuZXhwb3J0IGNvbnN0IERFQlVHX1NUQVJUX0NPTU1BTkRfSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5kZWJ1Zy5zdGFydCc7XG5leHBvcnQgY29uc3QgREVCVUdfUlVOX0NPTU1BTkRfSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5kZWJ1Zy5ydW4nO1xuZXhwb3J0IGNvbnN0IEVESVRfRVhQUkVTU0lPTl9DT01NQU5EX0lEID0gJ2RlYnVnLnJlbmFtZVdhdGNoRXhwcmVzc2lvbic7XG5leHBvcnQgY29uc3QgQ09QWV9XQVRDSF9FWFBSRVNTSU9OX0NPTU1BTkRfSUQgPSAnZGVidWcuY29weVdhdGNoRXhwcmVzc2lvbic7XG5leHBvcnQgY29uc3QgU0VUX0VYUFJFU1NJT05fQ09NTUFORF9JRCA9ICdkZWJ1Zy5zZXRXYXRjaEV4cHJlc3Npb24nO1xuZXhwb3J0IGNvbnN0IFJFTU9WRV9FWFBSRVNTSU9OX0NPTU1BTkRfSUQgPSAnZGVidWcucmVtb3ZlV2F0Y2hFeHByZXNzaW9uJztcbmV4cG9ydCBjb25zdCBORVhUX0RFQlVHX0NPTlNPTEVfSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5kZWJ1Zy5uZXh0Q29uc29sZSc7XG5leHBvcnQgY29uc3QgUFJFVl9ERUJVR19DT05TT0xFX0lEID0gJ3dvcmtiZW5jaC5hY3Rpb24uZGVidWcucHJldkNvbnNvbGUnO1xuZXhwb3J0IGNvbnN0IFNIT1dfTE9BREVEX1NDUklQVFNfSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5kZWJ1Zy5zaG93TG9hZGVkU2NyaXB0cyc7XG5leHBvcnQgY29uc3QgQ0FMTFNUQUNLX1RPUF9JRCA9ICd3b3JrYmVuY2guYWN0aW9uLmRlYnVnLmNhbGxTdGFja1RvcCc7XG5leHBvcnQgY29uc3QgQ0FMTFNUQUNLX0JPVFRPTV9JRCA9ICd3b3JrYmVuY2guYWN0aW9uLmRlYnVnLmNhbGxTdGFja0JvdHRvbSc7XG5leHBvcnQgY29uc3QgQ0FMTFNUQUNLX1VQX0lEID0gJ3dvcmtiZW5jaC5hY3Rpb24uZGVidWcuY2FsbFN0YWNrVXAnO1xuZXhwb3J0IGNvbnN0IENBTExTVEFDS19ET1dOX0lEID0gJ3dvcmtiZW5jaC5hY3Rpb24uZGVidWcuY2FsbFN0YWNrRG93bic7XG5leHBvcnQgY29uc3QgQUREX1RPX1dBVENIX0lEID0gJ2RlYnVnLmFkZFRvV2F0Y2hFeHByZXNzaW9ucyc7XG5leHBvcnQgY29uc3QgQ09QWV9FVkFMVUFURV9QQVRIX0lEID0gJ2RlYnVnLmNvcHlFdmFsdWF0ZVBhdGgnO1xuZXhwb3J0IGNvbnN0IENPUFlfVkFMVUVfSUQgPSAnd29ya2JlbmNoLmRlYnVnLnZpZXdsZXQuYWN0aW9uLmNvcHlWYWx1ZSc7XG5cbmV4cG9ydCBjb25zdCBERUJVR19DT01NQU5EX0NBVEVHT1JZOiBJTG9jYWxpemVkU3RyaW5nID0gbmxzLmxvY2FsaXplMignZGVidWcnLCAnRGVidWcnKTtcbmV4cG9ydCBjb25zdCBSRVNUQVJUX0xBQkVMID0gbmxzLmxvY2FsaXplMigncmVzdGFydERlYnVnJywgXCJSZXN0YXJ0XCIpO1xuZXhwb3J0IGNvbnN0IFNURVBfT1ZFUl9MQUJFTCA9IG5scy5sb2NhbGl6ZTIoJ3N0ZXBPdmVyRGVidWcnLCBcIlN0ZXAgT3ZlclwiKTtcbmV4cG9ydCBjb25zdCBTVEVQX0lOVE9fTEFCRUwgPSBubHMubG9jYWxpemUyKCdzdGVwSW50b0RlYnVnJywgXCJTdGVwIEludG9cIik7XG5leHBvcnQgY29uc3QgU1RFUF9JTlRPX1RBUkdFVF9MQUJFTCA9IG5scy5sb2NhbGl6ZTIoJ3N0ZXBJbnRvVGFyZ2V0RGVidWcnLCBcIlN0ZXAgSW50byBUYXJnZXRcIik7XG5leHBvcnQgY29uc3QgU1RFUF9PVVRfTEFCRUwgPSBubHMubG9jYWxpemUyKCdzdGVwT3V0RGVidWcnLCBcIlN0ZXAgT3V0XCIpO1xuZXhwb3J0IGNvbnN0IFBBVVNFX0xBQkVMID0gbmxzLmxvY2FsaXplMigncGF1c2VEZWJ1ZycsIFwiUGF1c2VcIik7XG5leHBvcnQgY29uc3QgRElTQ09OTkVDVF9MQUJFTCA9IG5scy5sb2NhbGl6ZTIoJ2Rpc2Nvbm5lY3QnLCBcIkRpc2Nvbm5lY3RcIik7XG5leHBvcnQgY29uc3QgRElTQ09OTkVDVF9BTkRfU1VTUEVORF9MQUJFTCA9IG5scy5sb2NhbGl6ZTIoJ2Rpc2Nvbm5lY3RTdXNwZW5kJywgXCJEaXNjb25uZWN0IGFuZCBTdXNwZW5kXCIpO1xuZXhwb3J0IGNvbnN0IFNUT1BfTEFCRUwgPSBubHMubG9jYWxpemUyKCdzdG9wJywgXCJTdG9wXCIpO1xuZXhwb3J0IGNvbnN0IENPTlRJTlVFX0xBQkVMID0gbmxzLmxvY2FsaXplMignY29udGludWVEZWJ1ZycsIFwiQ29udGludWVcIik7XG5leHBvcnQgY29uc3QgRk9DVVNfU0VTU0lPTl9MQUJFTCA9IG5scy5sb2NhbGl6ZTIoJ2ZvY3VzU2Vzc2lvbicsIFwiRm9jdXMgU2Vzc2lvblwiKTtcbmV4cG9ydCBjb25zdCBTRUxFQ1RfQU5EX1NUQVJUX0xBQkVMID0gbmxzLmxvY2FsaXplMignc2VsZWN0QW5kU3RhcnREZWJ1Z2dpbmcnLCBcIlNlbGVjdCBhbmQgU3RhcnQgRGVidWdnaW5nXCIpO1xuZXhwb3J0IGNvbnN0IERFQlVHX0NPTkZJR1VSRV9MQUJFTCA9IG5scy5sb2NhbGl6ZSgnb3BlbkxhdW5jaEpzb24nLCBcIk9wZW4gJ3swfSdcIiwgJ2xhdW5jaC5qc29uJyk7XG5leHBvcnQgY29uc3QgREVCVUdfU1RBUlRfTEFCRUwgPSBubHMubG9jYWxpemUyKCdzdGFydERlYnVnJywgXCJTdGFydCBEZWJ1Z2dpbmdcIik7XG5leHBvcnQgY29uc3QgREVCVUdfUlVOX0xBQkVMID0gbmxzLmxvY2FsaXplMignc3RhcnRXaXRob3V0RGVidWdnaW5nJywgXCJTdGFydCBXaXRob3V0IERlYnVnZ2luZ1wiKTtcbmV4cG9ydCBjb25zdCBORVhUX0RFQlVHX0NPTlNPTEVfTEFCRUwgPSBubHMubG9jYWxpemUyKCduZXh0RGVidWdDb25zb2xlJywgXCJGb2N1cyBOZXh0IERlYnVnIENvbnNvbGVcIik7XG5leHBvcnQgY29uc3QgUFJFVl9ERUJVR19DT05TT0xFX0xBQkVMID0gbmxzLmxvY2FsaXplMigncHJldkRlYnVnQ29uc29sZScsIFwiRm9jdXMgUHJldmlvdXMgRGVidWcgQ29uc29sZVwiKTtcbmV4cG9ydCBjb25zdCBPUEVOX0xPQURFRF9TQ1JJUFRTX0xBQkVMID0gbmxzLmxvY2FsaXplMignb3BlbkxvYWRlZFNjcmlwdCcsIFwiT3BlbiBMb2FkZWQgU2NyaXB0Li4uXCIpO1xuZXhwb3J0IGNvbnN0IENBTExTVEFDS19UT1BfTEFCRUwgPSBubHMubG9jYWxpemUyKCdjYWxsU3RhY2tUb3AnLCBcIk5hdmlnYXRlIHRvIFRvcCBvZiBDYWxsIFN0YWNrXCIpO1xuZXhwb3J0IGNvbnN0IENBTExTVEFDS19CT1RUT01fTEFCRUwgPSBubHMubG9jYWxpemUyKCdjYWxsU3RhY2tCb3R0b20nLCBcIk5hdmlnYXRlIHRvIEJvdHRvbSBvZiBDYWxsIFN0YWNrXCIpO1xuZXhwb3J0IGNvbnN0IENBTExTVEFDS19VUF9MQUJFTCA9IG5scy5sb2NhbGl6ZTIoJ2NhbGxTdGFja1VwJywgXCJOYXZpZ2F0ZSBVcCBDYWxsIFN0YWNrXCIpO1xuZXhwb3J0IGNvbnN0IENBTExTVEFDS19ET1dOX0xBQkVMID0gbmxzLmxvY2FsaXplMignY2FsbFN0YWNrRG93bicsIFwiTmF2aWdhdGUgRG93biBDYWxsIFN0YWNrXCIpO1xuZXhwb3J0IGNvbnN0IENPUFlfRVZBTFVBVEVfUEFUSF9MQUJFTCA9IG5scy5sb2NhbGl6ZTIoJ2NvcHlBc0V4cHJlc3Npb24nLCBcIkNvcHkgYXMgRXhwcmVzc2lvblwiKTtcbmV4cG9ydCBjb25zdCBDT1BZX1ZBTFVFX0xBQkVMID0gbmxzLmxvY2FsaXplMignY29weVZhbHVlJywgXCJDb3B5IFZhbHVlXCIpO1xuZXhwb3J0IGNvbnN0IEFERF9UT19XQVRDSF9MQUJFTCA9IG5scy5sb2NhbGl6ZTIoJ2FkZFRvV2F0Y2hFeHByZXNzaW9ucycsIFwiQWRkIHRvIFdhdGNoXCIpO1xuXG5leHBvcnQgY29uc3QgU0VMRUNUX0RFQlVHX0NPTlNPTEVfTEFCRUwgPSBubHMubG9jYWxpemUyKCdzZWxlY3REZWJ1Z0NvbnNvbGUnLCBcIlNlbGVjdCBEZWJ1ZyBDb25zb2xlXCIpO1xuZXhwb3J0IGNvbnN0IFNFTEVDVF9ERUJVR19TRVNTSU9OX0xBQkVMID0gbmxzLmxvY2FsaXplMignc2VsZWN0RGVidWdTZXNzaW9uJywgXCJTZWxlY3QgRGVidWcgU2Vzc2lvblwiKTtcblxuZXhwb3J0IGNvbnN0IERFQlVHX1FVSUNLX0FDQ0VTU19QUkVGSVggPSAnZGVidWcgJztcbmV4cG9ydCBjb25zdCBERUJVR19DT05TT0xFX1FVSUNLX0FDQ0VTU19QUkVGSVggPSAnZGVidWcgY29uc29sZXMgJztcblxuaW50ZXJmYWNlIENhbGxTdGFja0NvbnRleHQge1xuXHRzZXNzaW9uSWQ6IHN0cmluZztcblx0dGhyZWFkSWQ6IHN0cmluZztcblx0ZnJhbWVJZDogc3RyaW5nO1xufVxuXG5mdW5jdGlvbiBpc1RocmVhZENvbnRleHQob2JqOiBhbnkpOiBvYmogaXMgQ2FsbFN0YWNrQ29udGV4dCB7XG5cdHJldHVybiBvYmogJiYgdHlwZW9mIG9iai5zZXNzaW9uSWQgPT09ICdzdHJpbmcnICYmIHR5cGVvZiBvYmoudGhyZWFkSWQgPT09ICdzdHJpbmcnO1xufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRUaHJlYWRBbmRSdW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHNlc3Npb25BbmRUaHJlYWRJZDogQ2FsbFN0YWNrQ29udGV4dCB8IHVua25vd24sIHJ1bjogKHRocmVhZDogSVRocmVhZCkgPT4gUHJvbWlzZTx2b2lkPik6IFByb21pc2U8dm9pZD4ge1xuXHRjb25zdCBkZWJ1Z1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSURlYnVnU2VydmljZSk7XG5cdGxldCB0aHJlYWQ6IElUaHJlYWQgfCB1bmRlZmluZWQ7XG5cdGlmIChpc1RocmVhZENvbnRleHQoc2Vzc2lvbkFuZFRocmVhZElkKSkge1xuXHRcdGNvbnN0IHNlc3Npb24gPSBkZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKS5nZXRTZXNzaW9uKHNlc3Npb25BbmRUaHJlYWRJZC5zZXNzaW9uSWQpO1xuXHRcdGlmIChzZXNzaW9uKSB7XG5cdFx0XHR0aHJlYWQgPSBzZXNzaW9uLmdldEFsbFRocmVhZHMoKS5maW5kKHQgPT4gdC5nZXRJZCgpID09PSBzZXNzaW9uQW5kVGhyZWFkSWQudGhyZWFkSWQpO1xuXHRcdH1cblx0fSBlbHNlIGlmIChpc1Nlc3Npb25Db250ZXh0KHNlc3Npb25BbmRUaHJlYWRJZCkpIHtcblx0XHRjb25zdCBzZXNzaW9uID0gZGVidWdTZXJ2aWNlLmdldE1vZGVsKCkuZ2V0U2Vzc2lvbihzZXNzaW9uQW5kVGhyZWFkSWQuc2Vzc2lvbklkKTtcblx0XHRpZiAoc2Vzc2lvbikge1xuXHRcdFx0Y29uc3QgdGhyZWFkcyA9IHNlc3Npb24uZ2V0QWxsVGhyZWFkcygpO1xuXHRcdFx0dGhyZWFkID0gdGhyZWFkcy5sZW5ndGggPiAwID8gdGhyZWFkc1swXSA6IHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cblxuXHRpZiAoIXRocmVhZCkge1xuXHRcdHRocmVhZCA9IGRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5mb2N1c2VkVGhyZWFkO1xuXHRcdGlmICghdGhyZWFkKSB7XG5cdFx0XHRjb25zdCBmb2N1c2VkU2Vzc2lvbiA9IGRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5mb2N1c2VkU2Vzc2lvbjtcblx0XHRcdGNvbnN0IHRocmVhZHMgPSBmb2N1c2VkU2Vzc2lvbiA/IGZvY3VzZWRTZXNzaW9uLmdldEFsbFRocmVhZHMoKSA6IHVuZGVmaW5lZDtcblx0XHRcdHRocmVhZCA9IHRocmVhZHMgJiYgdGhyZWFkcy5sZW5ndGggPyB0aHJlYWRzWzBdIDogdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdGlmICh0aHJlYWQpIHtcblx0XHRhd2FpdCBydW4odGhyZWFkKTtcblx0fVxufVxuXG5mdW5jdGlvbiBpc1N0YWNrRnJhbWVDb250ZXh0KG9iajogYW55KTogb2JqIGlzIENhbGxTdGFja0NvbnRleHQge1xuXHRyZXR1cm4gb2JqICYmIHR5cGVvZiBvYmouc2Vzc2lvbklkID09PSAnc3RyaW5nJyAmJiB0eXBlb2Ygb2JqLnRocmVhZElkID09PSAnc3RyaW5nJyAmJiB0eXBlb2Ygb2JqLmZyYW1lSWQgPT09ICdzdHJpbmcnO1xufVxuXG5mdW5jdGlvbiBnZXRGcmFtZShkZWJ1Z1NlcnZpY2U6IElEZWJ1Z1NlcnZpY2UsIGNvbnRleHQ6IENhbGxTdGFja0NvbnRleHQgfCB1bmtub3duKTogSVN0YWNrRnJhbWUgfCB1bmRlZmluZWQge1xuXHRpZiAoaXNTdGFja0ZyYW1lQ29udGV4dChjb250ZXh0KSkge1xuXHRcdGNvbnN0IHNlc3Npb24gPSBkZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKS5nZXRTZXNzaW9uKGNvbnRleHQuc2Vzc2lvbklkKTtcblx0XHRpZiAoc2Vzc2lvbikge1xuXHRcdFx0Y29uc3QgdGhyZWFkID0gc2Vzc2lvbi5nZXRBbGxUaHJlYWRzKCkuZmluZCh0ID0+IHQuZ2V0SWQoKSA9PT0gY29udGV4dC50aHJlYWRJZCk7XG5cdFx0XHRpZiAodGhyZWFkKSB7XG5cdFx0XHRcdHJldHVybiB0aHJlYWQuZ2V0Q2FsbFN0YWNrKCkuZmluZChzZiA9PiBzZi5nZXRJZCgpID09PSBjb250ZXh0LmZyYW1lSWQpO1xuXHRcdFx0fVxuXHRcdH1cblx0fSBlbHNlIHtcblx0XHRyZXR1cm4gZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLmZvY3VzZWRTdGFja0ZyYW1lO1xuXHR9XG5cblx0cmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gaXNTZXNzaW9uQ29udGV4dChvYmo6IGFueSk6IG9iaiBpcyBDYWxsU3RhY2tDb250ZXh0IHtcblx0cmV0dXJuIG9iaiAmJiB0eXBlb2Ygb2JqLnNlc3Npb25JZCA9PT0gJ3N0cmluZyc7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNoYW5nZURlYnVnQ29uc29sZUZvY3VzKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBuZXh0OiBib29sZWFuKSB7XG5cdGNvbnN0IGRlYnVnU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGVidWdTZXJ2aWNlKTtcblx0Y29uc3Qgdmlld3NTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElWaWV3c1NlcnZpY2UpO1xuXHRjb25zdCBzZXNzaW9ucyA9IGRlYnVnU2VydmljZS5nZXRNb2RlbCgpLmdldFNlc3Npb25zKHRydWUpLmZpbHRlcihzID0+IHMuaGFzU2VwYXJhdGVSZXBsKCkpO1xuXHRsZXQgY3VyclNlc3Npb24gPSBkZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkuZm9jdXNlZFNlc3Npb247XG5cblx0bGV0IG5leHRJbmRleCA9IDA7XG5cdGlmIChzZXNzaW9ucy5sZW5ndGggPiAwICYmIGN1cnJTZXNzaW9uKSB7XG5cdFx0d2hpbGUgKGN1cnJTZXNzaW9uICYmICFjdXJyU2Vzc2lvbi5oYXNTZXBhcmF0ZVJlcGwoKSkge1xuXHRcdFx0Y3VyclNlc3Npb24gPSBjdXJyU2Vzc2lvbi5wYXJlbnRTZXNzaW9uO1xuXHRcdH1cblxuXHRcdGlmIChjdXJyU2Vzc2lvbikge1xuXHRcdFx0Y29uc3QgY3VyckluZGV4ID0gc2Vzc2lvbnMuaW5kZXhPZihjdXJyU2Vzc2lvbik7XG5cdFx0XHRpZiAobmV4dCkge1xuXHRcdFx0XHRuZXh0SW5kZXggPSAoY3VyckluZGV4ID09PSAoc2Vzc2lvbnMubGVuZ3RoIC0gMSkgPyAwIDogKGN1cnJJbmRleCArIDEpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG5leHRJbmRleCA9IChjdXJySW5kZXggPT09IDAgPyAoc2Vzc2lvbnMubGVuZ3RoIC0gMSkgOiAoY3VyckluZGV4IC0gMSkpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRhd2FpdCBkZWJ1Z1NlcnZpY2UuZm9jdXNTdGFja0ZyYW1lKHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBzZXNzaW9uc1tuZXh0SW5kZXhdLCB7IGV4cGxpY2l0OiB0cnVlIH0pO1xuXG5cdGlmICghdmlld3NTZXJ2aWNlLmlzVmlld1Zpc2libGUoUkVQTF9WSUVXX0lEKSkge1xuXHRcdGF3YWl0IHZpZXdzU2VydmljZS5vcGVuVmlldyhSRVBMX1ZJRVdfSUQsIHRydWUpO1xuXHR9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIG5hdmlnYXRlQ2FsbFN0YWNrKGRlYnVnU2VydmljZTogSURlYnVnU2VydmljZSwgZG93bjogYm9vbGVhbikge1xuXHRjb25zdCBmcmFtZSA9IGRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5mb2N1c2VkU3RhY2tGcmFtZTtcblx0aWYgKGZyYW1lKSB7XG5cblx0XHRsZXQgY2FsbFN0YWNrID0gZnJhbWUudGhyZWFkLmdldENhbGxTdGFjaygpO1xuXHRcdGxldCBpbmRleCA9IGNhbGxTdGFjay5maW5kSW5kZXgoZWxlbSA9PiBlbGVtLmZyYW1lSWQgPT09IGZyYW1lLmZyYW1lSWQpO1xuXHRcdGxldCBuZXh0VmlzaWJsZUZyYW1lO1xuXHRcdGlmIChkb3duKSB7XG5cdFx0XHRpZiAoaW5kZXggPj0gY2FsbFN0YWNrLmxlbmd0aCAtIDEpIHtcblx0XHRcdFx0aWYgKCg8VGhyZWFkPmZyYW1lLnRocmVhZCkucmVhY2hlZEVuZE9mQ2FsbFN0YWNrKSB7XG5cdFx0XHRcdFx0Z29Ub1RvcE9mQ2FsbFN0YWNrKGRlYnVnU2VydmljZSk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGF3YWl0IGRlYnVnU2VydmljZS5nZXRNb2RlbCgpLmZldGNoQ2FsbHN0YWNrKGZyYW1lLnRocmVhZCwgMjApO1xuXHRcdFx0XHRcdGNhbGxTdGFjayA9IGZyYW1lLnRocmVhZC5nZXRDYWxsU3RhY2soKTtcblx0XHRcdFx0XHRpbmRleCA9IGNhbGxTdGFjay5maW5kSW5kZXgoZWxlbSA9PiBlbGVtLmZyYW1lSWQgPT09IGZyYW1lLmZyYW1lSWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRuZXh0VmlzaWJsZUZyYW1lID0gZmluZE5leHRWaXNpYmxlRnJhbWUodHJ1ZSwgY2FsbFN0YWNrLCBpbmRleCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmIChpbmRleCA8PSAwKSB7XG5cdFx0XHRcdGdvVG9Cb3R0b21PZkNhbGxTdGFjayhkZWJ1Z1NlcnZpY2UpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRuZXh0VmlzaWJsZUZyYW1lID0gZmluZE5leHRWaXNpYmxlRnJhbWUoZmFsc2UsIGNhbGxTdGFjaywgaW5kZXgpO1xuXHRcdH1cblxuXHRcdGlmIChuZXh0VmlzaWJsZUZyYW1lKSB7XG5cdFx0XHRkZWJ1Z1NlcnZpY2UuZm9jdXNTdGFja0ZyYW1lKG5leHRWaXNpYmxlRnJhbWUsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB7IHByZXNlcnZlRm9jdXM6IGZhbHNlIH0pO1xuXHRcdH1cblx0fVxufVxuXG5hc3luYyBmdW5jdGlvbiBnb1RvQm90dG9tT2ZDYWxsU3RhY2soZGVidWdTZXJ2aWNlOiBJRGVidWdTZXJ2aWNlKSB7XG5cdGNvbnN0IHRocmVhZCA9IGRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5mb2N1c2VkVGhyZWFkO1xuXHRpZiAodGhyZWFkKSB7XG5cdFx0YXdhaXQgZGVidWdTZXJ2aWNlLmdldE1vZGVsKCkuZmV0Y2hDYWxsc3RhY2sodGhyZWFkKTtcblx0XHRjb25zdCBjYWxsU3RhY2sgPSB0aHJlYWQuZ2V0Q2FsbFN0YWNrKCk7XG5cdFx0aWYgKGNhbGxTdGFjay5sZW5ndGggPiAwKSB7XG5cdFx0XHRjb25zdCBuZXh0VmlzaWJsZUZyYW1lID0gZmluZE5leHRWaXNpYmxlRnJhbWUoZmFsc2UsIGNhbGxTdGFjaywgMCk7IC8vIG11c3QgY29uc2lkZXIgdGhlIG5leHQgZnJhbWUgdXAgZmlyc3QsIHdoaWNoIHdpbGwgYmUgdGhlIGxhc3QgZnJhbWVcblx0XHRcdGlmIChuZXh0VmlzaWJsZUZyYW1lKSB7XG5cdFx0XHRcdGRlYnVnU2VydmljZS5mb2N1c1N0YWNrRnJhbWUobmV4dFZpc2libGVGcmFtZSwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHsgcHJlc2VydmVGb2N1czogZmFsc2UgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmZ1bmN0aW9uIGdvVG9Ub3BPZkNhbGxTdGFjayhkZWJ1Z1NlcnZpY2U6IElEZWJ1Z1NlcnZpY2UpIHtcblx0Y29uc3QgdGhyZWFkID0gZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLmZvY3VzZWRUaHJlYWQ7XG5cblx0aWYgKHRocmVhZCkge1xuXHRcdGRlYnVnU2VydmljZS5mb2N1c1N0YWNrRnJhbWUodGhyZWFkLmdldFRvcFN0YWNrRnJhbWUoKSwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHsgcHJlc2VydmVGb2N1czogZmFsc2UgfSk7XG5cdH1cbn1cblxuLyoqXG4gKiBGaW5kcyBuZXh0IGZyYW1lIHRoYXQgaXMgbm90IHNraXBwZWQgYnkgU2tpcEZpbGVzLiBTa2lwcyBmcmFtZSBhdCBpbmRleCBhbmQgc3RhcnRzIHNlYXJjaGluZyBhdCBuZXh0LlxuICogTXVzdCBzYXRpc2Z5IGAwIDw9IHN0YXJ0SW5kZXggPD0gY2FsbFN0YWNrIC0gMWBcbiAqIEBwYXJhbSBkb3duIHNwZWNpZmllcyB3aGV0aGVyIHRvIHNlYXJjaCBkb3dud2FyZHMgaWYgdGhlIGN1cnJlbnQgZmlsZSBpcyBza2lwcGVkLlxuICogQHBhcmFtIGNhbGxTdGFjayB0aGUgY2FsbCBzdGFjayB0byBzZWFyY2hcbiAqIEBwYXJhbSBzdGFydEluZGV4IHRoZSBpbmRleCB0byBzdGFydCB0aGUgc2VhcmNoIGF0XG4gKi9cbmZ1bmN0aW9uIGZpbmROZXh0VmlzaWJsZUZyYW1lKGRvd246IGJvb2xlYW4sIGNhbGxTdGFjazogcmVhZG9ubHkgSVN0YWNrRnJhbWVbXSwgc3RhcnRJbmRleDogbnVtYmVyKSB7XG5cblx0aWYgKHN0YXJ0SW5kZXggPj0gY2FsbFN0YWNrLmxlbmd0aCkge1xuXHRcdHN0YXJ0SW5kZXggPSBjYWxsU3RhY2subGVuZ3RoIC0gMTtcblx0fSBlbHNlIGlmIChzdGFydEluZGV4IDwgMCkge1xuXHRcdHN0YXJ0SW5kZXggPSAwO1xuXHR9XG5cblx0bGV0IGluZGV4ID0gc3RhcnRJbmRleDtcblxuXHRsZXQgY3VyckZyYW1lO1xuXHRkbyB7XG5cdFx0aWYgKGRvd24pIHtcblx0XHRcdGlmIChpbmRleCA9PT0gY2FsbFN0YWNrLmxlbmd0aCAtIDEpIHtcblx0XHRcdFx0aW5kZXggPSAwO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aW5kZXgrKztcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKGluZGV4ID09PSAwKSB7XG5cdFx0XHRcdGluZGV4ID0gY2FsbFN0YWNrLmxlbmd0aCAtIDE7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpbmRleC0tO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGN1cnJGcmFtZSA9IGNhbGxTdGFja1tpbmRleF07XG5cdFx0aWYgKCFpc0ZyYW1lRGVlbXBoYXNpemVkKGN1cnJGcmFtZSkpIHtcblx0XHRcdHJldHVybiBjdXJyRnJhbWU7XG5cdFx0fVxuXHR9IHdoaWxlIChpbmRleCAhPT0gc3RhcnRJbmRleCk7IC8vIGVuZCBsb29wIHdoZW4gd2UndmUganVzdCBjaGVja2VkIHRoZSBzdGFydCBpbmRleCwgc2luY2UgdGhhdCBzaG91bGQgYmUgdGhlIGxhc3Qgb25lIGNoZWNrZWRcblxuXHRyZXR1cm4gdW5kZWZpbmVkO1xufVxuXG4vLyBUaGVzZSBjb21tYW5kcyBhcmUgdXNlZCBpbiBjYWxsIHN0YWNrIGNvbnRleHQgbWVudSwgY2FsbCBzdGFjayBpbmxpbmUgYWN0aW9ucywgY29tbWFuZCBwYWxldHRlLCBkZWJ1ZyB0b29sYmFyLCBtYWMgbmF0aXZlIHRvdWNoIGJhclxuLy8gV2hlbiB0aGUgY29tbWFuZCBpcyBleGVjdHVlZCBpbiB0aGUgY29udGV4dCBvZiBhIHRocmVhZChjb250ZXh0IG1lbnUgb24gYSB0aHJlYWQsIGlubGluZSBjYWxsIHN0YWNrIGFjdGlvbikgd2UgcGFzcyB0aGUgdGhyZWFkIGlkXG4vLyBPdGhlcndpc2Ugd2hlbiBpdCBpcyBleGVjdXRlZCBcImdsb2JhbHlcIih1c2luZyB0aGUgdG91Y2ggYmFyLCBkZWJ1ZyB0b29sYmFyLCBjb21tYW5kIHBhbGV0dGUpIHdlIGRvIG5vdCBwYXNzIGFueSBpZCBhbmQganVzdCB0YWtlIHdoYXRldmVyIGlzIHRoZSBmb2N1c3NlZCB0aHJlYWRcbi8vIFNhbWUgZm9yIHN0YWNrRnJhbWUgY29tbWFuZHMgYW5kIHNlc3Npb24gY29tbWFuZHMuXG5Db21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCh7XG5cdGlkOiBDT1BZX1NUQUNLX1RSQUNFX0lELFxuXHRoYW5kbGVyOiBhc3luYyAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIF86IHN0cmluZywgY29udGV4dDogQ2FsbFN0YWNrQ29udGV4dCB8IHVua25vd24pID0+IHtcblx0XHRjb25zdCB0ZXh0UmVzb3VyY2VQcm9wZXJ0aWVzU2VydmljZSA9IGFjY2Vzc29yLmdldChJVGV4dFJlc291cmNlUHJvcGVydGllc1NlcnZpY2UpO1xuXHRcdGNvbnN0IGNsaXBib2FyZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNsaXBib2FyZFNlcnZpY2UpO1xuXHRcdGNvbnN0IGRlYnVnU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGVidWdTZXJ2aWNlKTtcblx0XHRjb25zdCBmcmFtZSA9IGdldEZyYW1lKGRlYnVnU2VydmljZSwgY29udGV4dCk7XG5cdFx0aWYgKGZyYW1lKSB7XG5cdFx0XHRjb25zdCBlb2wgPSB0ZXh0UmVzb3VyY2VQcm9wZXJ0aWVzU2VydmljZS5nZXRFT0woZnJhbWUuc291cmNlLnVyaSk7XG5cdFx0XHRhd2FpdCBjbGlwYm9hcmRTZXJ2aWNlLndyaXRlVGV4dChmcmFtZS50aHJlYWQuZ2V0Q2FsbFN0YWNrKCkubWFwKHNmID0+IHNmLnRvU3RyaW5nKCkpLmpvaW4oZW9sKSk7XG5cdFx0fVxuXHR9XG59KTtcblxuQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoe1xuXHRpZDogUkVWRVJTRV9DT05USU5VRV9JRCxcblx0aGFuZGxlcjogYXN5bmMgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBfOiBzdHJpbmcsIGNvbnRleHQ6IENhbGxTdGFja0NvbnRleHQgfCB1bmtub3duKSA9PiB7XG5cdFx0YXdhaXQgZ2V0VGhyZWFkQW5kUnVuKGFjY2Vzc29yLCBjb250ZXh0LCB0aHJlYWQgPT4gdGhyZWFkLnJldmVyc2VDb250aW51ZSgpKTtcblx0fVxufSk7XG5cbkNvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKHtcblx0aWQ6IFNURVBfQkFDS19JRCxcblx0aGFuZGxlcjogYXN5bmMgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBfOiBzdHJpbmcsIGNvbnRleHQ6IENhbGxTdGFja0NvbnRleHQgfCB1bmtub3duKSA9PiB7XG5cdFx0Y29uc3QgY29udGV4dEtleVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRpZiAoQ09OVEVYVF9ESVNBU1NFTUJMWV9WSUVXX0ZPQ1VTLmdldFZhbHVlKGNvbnRleHRLZXlTZXJ2aWNlKSkge1xuXHRcdFx0YXdhaXQgZ2V0VGhyZWFkQW5kUnVuKGFjY2Vzc29yLCBjb250ZXh0LCAodGhyZWFkOiBJVGhyZWFkKSA9PiB0aHJlYWQuc3RlcEJhY2soJ2luc3RydWN0aW9uJykpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhd2FpdCBnZXRUaHJlYWRBbmRSdW4oYWNjZXNzb3IsIGNvbnRleHQsICh0aHJlYWQ6IElUaHJlYWQpID0+IHRocmVhZC5zdGVwQmFjaygpKTtcblx0XHR9XG5cdH1cbn0pO1xuXG5Db21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCh7XG5cdGlkOiBURVJNSU5BVEVfVEhSRUFEX0lELFxuXHRoYW5kbGVyOiBhc3luYyAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIF86IHN0cmluZywgY29udGV4dDogQ2FsbFN0YWNrQ29udGV4dCB8IHVua25vd24pID0+IHtcblx0XHRhd2FpdCBnZXRUaHJlYWRBbmRSdW4oYWNjZXNzb3IsIGNvbnRleHQsIHRocmVhZCA9PiB0aHJlYWQudGVybWluYXRlKCkpO1xuXHR9XG59KTtcblxuQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoe1xuXHRpZDogSlVNUF9UT19DVVJTT1JfSUQsXG5cdGhhbmRsZXI6IGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvcikgPT4ge1xuXHRcdGNvbnN0IGRlYnVnU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGVidWdTZXJ2aWNlKTtcblx0XHRjb25zdCBzdGFja0ZyYW1lID0gZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLmZvY3VzZWRTdGFja0ZyYW1lO1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IGFjdGl2ZUVkaXRvckNvbnRyb2wgPSBlZGl0b3JTZXJ2aWNlLmFjdGl2ZVRleHRFZGl0b3JDb250cm9sO1xuXHRcdGNvbnN0IG5vdGlmaWNhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU5vdGlmaWNhdGlvblNlcnZpY2UpO1xuXHRcdGNvbnN0IHF1aWNrSW5wdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElRdWlja0lucHV0U2VydmljZSk7XG5cblx0XHRpZiAoc3RhY2tGcmFtZSAmJiBpc0NvZGVFZGl0b3IoYWN0aXZlRWRpdG9yQ29udHJvbCkgJiYgYWN0aXZlRWRpdG9yQ29udHJvbC5oYXNNb2RlbCgpKSB7XG5cdFx0XHRjb25zdCBwb3NpdGlvbiA9IGFjdGl2ZUVkaXRvckNvbnRyb2wuZ2V0UG9zaXRpb24oKTtcblx0XHRcdGNvbnN0IHJlc291cmNlID0gYWN0aXZlRWRpdG9yQ29udHJvbC5nZXRNb2RlbCgpLnVyaTtcblx0XHRcdGNvbnN0IHNvdXJjZSA9IHN0YWNrRnJhbWUudGhyZWFkLnNlc3Npb24uZ2V0U291cmNlRm9yVXJpKHJlc291cmNlKTtcblx0XHRcdGlmIChzb3VyY2UpIHtcblx0XHRcdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBzdGFja0ZyYW1lLnRocmVhZC5zZXNzaW9uLmdvdG9UYXJnZXRzKHNvdXJjZS5yYXcsIHBvc2l0aW9uLmxpbmVOdW1iZXIsIHBvc2l0aW9uLmNvbHVtbik7XG5cdFx0XHRcdGNvbnN0IHRhcmdldHMgPSByZXNwb25zZT8uYm9keS50YXJnZXRzO1xuXHRcdFx0XHRpZiAodGFyZ2V0cyAmJiB0YXJnZXRzLmxlbmd0aCkge1xuXHRcdFx0XHRcdGxldCBpZCA9IHRhcmdldHNbMF0uaWQ7XG5cdFx0XHRcdFx0aWYgKHRhcmdldHMubGVuZ3RoID4gMSkge1xuXHRcdFx0XHRcdFx0Y29uc3QgcGlja3MgPSB0YXJnZXRzLm1hcCh0ID0+ICh7IGxhYmVsOiB0LmxhYmVsLCBfaWQ6IHQuaWQgfSkpO1xuXHRcdFx0XHRcdFx0Y29uc3QgcGljayA9IGF3YWl0IHF1aWNrSW5wdXRTZXJ2aWNlLnBpY2socGlja3MsIHsgcGxhY2VIb2xkZXI6IG5scy5sb2NhbGl6ZSgnY2hvb3NlTG9jYXRpb24nLCBcIkNob29zZSB0aGUgc3BlY2lmaWMgbG9jYXRpb25cIikgfSk7XG5cdFx0XHRcdFx0XHRpZiAoIXBpY2spIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRpZCA9IHBpY2suX2lkO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJldHVybiBhd2FpdCBzdGFja0ZyYW1lLnRocmVhZC5zZXNzaW9uLmdvdG8oc3RhY2tGcmFtZS50aHJlYWQudGhyZWFkSWQsIGlkKS5jYXRjaChlID0+IG5vdGlmaWNhdGlvblNlcnZpY2Uud2FybihlKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbm90aWZpY2F0aW9uU2VydmljZS53YXJuKG5scy5sb2NhbGl6ZSgnbm9FeGVjdXRhYmxlQ29kZScsIFwiTm8gZXhlY3V0YWJsZSBjb2RlIGlzIGFzc29jaWF0ZWQgYXQgdGhlIGN1cnJlbnQgY3Vyc29yIHBvc2l0aW9uLlwiKSk7XG5cdH1cbn0pO1xuXG5cbkNvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKHtcblx0aWQ6IENBTExTVEFDS19UT1BfSUQsXG5cdGhhbmRsZXI6IGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgXzogc3RyaW5nLCBjb250ZXh0OiBDYWxsU3RhY2tDb250ZXh0IHwgdW5rbm93bikgPT4ge1xuXHRcdGNvbnN0IGRlYnVnU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGVidWdTZXJ2aWNlKTtcblx0XHRnb1RvVG9wT2ZDYWxsU3RhY2soZGVidWdTZXJ2aWNlKTtcblx0fVxufSk7XG5cbkNvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKHtcblx0aWQ6IENBTExTVEFDS19CT1RUT01fSUQsXG5cdGhhbmRsZXI6IGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgXzogc3RyaW5nLCBjb250ZXh0OiBDYWxsU3RhY2tDb250ZXh0IHwgdW5rbm93bikgPT4ge1xuXHRcdGNvbnN0IGRlYnVnU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGVidWdTZXJ2aWNlKTtcblx0XHRhd2FpdCBnb1RvQm90dG9tT2ZDYWxsU3RhY2soZGVidWdTZXJ2aWNlKTtcblx0fVxufSk7XG5cbkNvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKHtcblx0aWQ6IENBTExTVEFDS19VUF9JRCxcblx0aGFuZGxlcjogYXN5bmMgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBfOiBzdHJpbmcsIGNvbnRleHQ6IENhbGxTdGFja0NvbnRleHQgfCB1bmtub3duKSA9PiB7XG5cdFx0Y29uc3QgZGVidWdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEZWJ1Z1NlcnZpY2UpO1xuXHRcdG5hdmlnYXRlQ2FsbFN0YWNrKGRlYnVnU2VydmljZSwgZmFsc2UpO1xuXHR9XG59KTtcblxuQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoe1xuXHRpZDogQ0FMTFNUQUNLX0RPV05fSUQsXG5cdGhhbmRsZXI6IGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgXzogc3RyaW5nLCBjb250ZXh0OiBDYWxsU3RhY2tDb250ZXh0IHwgdW5rbm93bikgPT4ge1xuXHRcdGNvbnN0IGRlYnVnU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGVidWdTZXJ2aWNlKTtcblx0XHRuYXZpZ2F0ZUNhbGxTdGFjayhkZWJ1Z1NlcnZpY2UsIHRydWUpO1xuXHR9XG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5FZGl0b3JDb250ZXh0LCB7XG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogSlVNUF9UT19DVVJTT1JfSUQsXG5cdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSgnanVtcFRvQ3Vyc29yJywgXCJKdW1wIHRvIEN1cnNvclwiKSxcblx0XHRjYXRlZ29yeTogREVCVUdfQ09NTUFORF9DQVRFR09SWVxuXHR9LFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ09OVEVYVF9KVU1QX1RPX0NVUlNPUl9TVVBQT1JURUQsIEVkaXRvckNvbnRleHRLZXlzLmVkaXRvclRleHRGb2N1cyksXG5cdGdyb3VwOiAnZGVidWcnLFxuXHRvcmRlcjogM1xufSk7XG5cbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRpZDogTkVYVF9ERUJVR19DT05TT0xFX0lELFxuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYiArIDEsXG5cdHdoZW46IENPTlRFWFRfSU5fREVCVUdfUkVQTCxcblx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLlBhZ2VEb3duLFxuXHRtYWM6IHsgcHJpbWFyeTogS2V5TW9kLlNoaWZ0IHwgS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkJyYWNrZXRSaWdodCB9LFxuXHRoYW5kbGVyOiBhc3luYyAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIF86IHN0cmluZywgY29udGV4dDogQ2FsbFN0YWNrQ29udGV4dCB8IHVua25vd24pID0+IHtcblx0XHRjaGFuZ2VEZWJ1Z0NvbnNvbGVGb2N1cyhhY2Nlc3NvciwgdHJ1ZSk7XG5cdH1cbn0pO1xuXG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0aWQ6IFBSRVZfREVCVUdfQ09OU09MRV9JRCxcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIgKyAxLFxuXHR3aGVuOiBDT05URVhUX0lOX0RFQlVHX1JFUEwsXG5cdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5QYWdlVXAsXG5cdG1hYzogeyBwcmltYXJ5OiBLZXlNb2QuU2hpZnQgfCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuQnJhY2tldExlZnQgfSxcblx0aGFuZGxlcjogYXN5bmMgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBfOiBzdHJpbmcsIGNvbnRleHQ6IENhbGxTdGFja0NvbnRleHQgfCB1bmtub3duKSA9PiB7XG5cdFx0Y2hhbmdlRGVidWdDb25zb2xlRm9jdXMoYWNjZXNzb3IsIGZhbHNlKTtcblx0fVxufSk7XG5cbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRpZDogUkVTVEFSVF9TRVNTSU9OX0lELFxuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0cHJpbWFyeTogS2V5TW9kLlNoaWZ0IHwgS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkY1LFxuXHR3aGVuOiBDT05URVhUX0lOX0RFQlVHX01PREUsXG5cdGhhbmRsZXI6IGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgXzogc3RyaW5nLCBjb250ZXh0OiBDYWxsU3RhY2tDb250ZXh0IHwgdW5rbm93bikgPT4ge1xuXHRcdGNvbnN0IGRlYnVnU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGVidWdTZXJ2aWNlKTtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdGxldCBzZXNzaW9uOiBJRGVidWdTZXNzaW9uIHwgdW5kZWZpbmVkO1xuXHRcdGlmIChpc1Nlc3Npb25Db250ZXh0KGNvbnRleHQpKSB7XG5cdFx0XHRzZXNzaW9uID0gZGVidWdTZXJ2aWNlLmdldE1vZGVsKCkuZ2V0U2Vzc2lvbihjb250ZXh0LnNlc3Npb25JZCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHNlc3Npb24gPSBkZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkuZm9jdXNlZFNlc3Npb247XG5cdFx0fVxuXG5cdFx0aWYgKCFzZXNzaW9uKSB7XG5cdFx0XHRjb25zdCB7IGxhdW5jaCwgbmFtZSB9ID0gZGVidWdTZXJ2aWNlLmdldENvbmZpZ3VyYXRpb25NYW5hZ2VyKCkuc2VsZWN0ZWRDb25maWd1cmF0aW9uO1xuXHRcdFx0YXdhaXQgZGVidWdTZXJ2aWNlLnN0YXJ0RGVidWdnaW5nKGxhdW5jaCwgbmFtZSwgeyBub0RlYnVnOiBmYWxzZSwgc3RhcnRlZEJ5VXNlcjogdHJ1ZSB9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3Qgc2hvd1N1YlNlc3Npb25zID0gY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SURlYnVnQ29uZmlndXJhdGlvbj4oJ2RlYnVnJykuc2hvd1N1YlNlc3Npb25zSW5Ub29sQmFyO1xuXHRcdFx0Ly8gU3RvcCBzaG91bGQgYmUgc2VudCB0byB0aGUgcm9vdCBwYXJlbnQgc2Vzc2lvblxuXHRcdFx0d2hpbGUgKCFzaG93U3ViU2Vzc2lvbnMgJiYgc2Vzc2lvbi5saWZlY3ljbGVNYW5hZ2VkQnlQYXJlbnQgJiYgc2Vzc2lvbi5wYXJlbnRTZXNzaW9uKSB7XG5cdFx0XHRcdHNlc3Npb24gPSBzZXNzaW9uLnBhcmVudFNlc3Npb247XG5cdFx0XHR9XG5cdFx0XHRzZXNzaW9uLnJlbW92ZVJlcGxFeHByZXNzaW9ucygpO1xuXHRcdFx0YXdhaXQgZGVidWdTZXJ2aWNlLnJlc3RhcnRTZXNzaW9uKHNlc3Npb24pO1xuXHRcdH1cblx0fVxufSk7XG5cbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRpZDogU1RFUF9PVkVSX0lELFxuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0cHJpbWFyeTogS2V5Q29kZS5GMTAsXG5cdHdoZW46IENPTlRFWFRfREVCVUdfU1RBVEUuaXNFcXVhbFRvKCdzdG9wcGVkJyksXG5cdGhhbmRsZXI6IGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgXzogc3RyaW5nLCBjb250ZXh0OiBDYWxsU3RhY2tDb250ZXh0IHwgdW5rbm93bikgPT4ge1xuXHRcdGNvbnN0IGNvbnRleHRLZXlTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb250ZXh0S2V5U2VydmljZSk7XG5cdFx0aWYgKENPTlRFWFRfRElTQVNTRU1CTFlfVklFV19GT0NVUy5nZXRWYWx1ZShjb250ZXh0S2V5U2VydmljZSkpIHtcblx0XHRcdGF3YWl0IGdldFRocmVhZEFuZFJ1bihhY2Nlc3NvciwgY29udGV4dCwgKHRocmVhZDogSVRocmVhZCkgPT4gdGhyZWFkLm5leHQoJ2luc3RydWN0aW9uJykpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhd2FpdCBnZXRUaHJlYWRBbmRSdW4oYWNjZXNzb3IsIGNvbnRleHQsICh0aHJlYWQ6IElUaHJlYWQpID0+IHRocmVhZC5uZXh0KCkpO1xuXHRcdH1cblx0fVxufSk7XG5cbi8vIFdpbmRvd3MgYnJvd3NlcnMgdXNlIEYxMSBmb3IgZnVsbCBzY3JlZW4sIHRodXMgdXNlIGFsdCtGMTEgYXMgdGhlIGRlZmF1bHQgc2hvcnRjdXRcbmNvbnN0IFNURVBfSU5UT19LRVlCSU5ESU5HID0gKGlzV2ViICYmIGlzV2luZG93cykgPyAoS2V5TW9kLkFsdCB8IEtleUNvZGUuRjExKSA6IEtleUNvZGUuRjExO1xuXG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0aWQ6IFNURVBfSU5UT19JRCxcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIgKyAxMCwgLy8gSGF2ZSBhIHN0cm9uZ2VyIHdlaWdodCB0byBoYXZlIHByaW9yaXR5IG92ZXIgZnVsbCBzY3JlZW4gd2hlbiBkZWJ1Z2dpbmdcblx0cHJpbWFyeTogU1RFUF9JTlRPX0tFWUJJTkRJTkcsXG5cdC8vIFVzZSBhIG1vcmUgZmxleGlibGUgd2hlbiBjbGF1c2UgdG8gbm90IGFsbG93IGZ1bGwgc2NyZWVuIGNvbW1hbmQgdG8gdGFrZSBvdmVyIHdoZW4gRjExIHByZXNzZWQgYSBsb3Qgb2YgdGltZXNcblx0d2hlbjogQ09OVEVYVF9ERUJVR19TVEFURS5ub3RFcXVhbHNUbygnaW5hY3RpdmUnKSxcblx0aGFuZGxlcjogYXN5bmMgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBfOiBzdHJpbmcsIGNvbnRleHQ6IENhbGxTdGFja0NvbnRleHQgfCB1bmtub3duKSA9PiB7XG5cdFx0Y29uc3QgY29udGV4dEtleVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRpZiAoQ09OVEVYVF9ESVNBU1NFTUJMWV9WSUVXX0ZPQ1VTLmdldFZhbHVlKGNvbnRleHRLZXlTZXJ2aWNlKSkge1xuXHRcdFx0YXdhaXQgZ2V0VGhyZWFkQW5kUnVuKGFjY2Vzc29yLCBjb250ZXh0LCAodGhyZWFkOiBJVGhyZWFkKSA9PiB0aHJlYWQuc3RlcEluKCdpbnN0cnVjdGlvbicpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXdhaXQgZ2V0VGhyZWFkQW5kUnVuKGFjY2Vzc29yLCBjb250ZXh0LCAodGhyZWFkOiBJVGhyZWFkKSA9PiB0aHJlYWQuc3RlcEluKCkpO1xuXHRcdH1cblx0fVxufSk7XG5cbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRpZDogU1RFUF9PVVRfSUQsXG5cdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRwcmltYXJ5OiBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkYxMSxcblx0d2hlbjogQ09OVEVYVF9ERUJVR19TVEFURS5pc0VxdWFsVG8oJ3N0b3BwZWQnKSxcblx0aGFuZGxlcjogYXN5bmMgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBfOiBzdHJpbmcsIGNvbnRleHQ6IENhbGxTdGFja0NvbnRleHQgfCB1bmtub3duKSA9PiB7XG5cdFx0Y29uc3QgY29udGV4dEtleVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRpZiAoQ09OVEVYVF9ESVNBU1NFTUJMWV9WSUVXX0ZPQ1VTLmdldFZhbHVlKGNvbnRleHRLZXlTZXJ2aWNlKSkge1xuXHRcdFx0YXdhaXQgZ2V0VGhyZWFkQW5kUnVuKGFjY2Vzc29yLCBjb250ZXh0LCAodGhyZWFkOiBJVGhyZWFkKSA9PiB0aHJlYWQuc3RlcE91dCgnaW5zdHJ1Y3Rpb24nKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGF3YWl0IGdldFRocmVhZEFuZFJ1bihhY2Nlc3NvciwgY29udGV4dCwgKHRocmVhZDogSVRocmVhZCkgPT4gdGhyZWFkLnN0ZXBPdXQoKSk7XG5cdFx0fVxuXHR9XG59KTtcblxuS2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdGlkOiBQQVVTRV9JRCxcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIgKyAyLCAvLyB0YWtlIHByaW9yaXR5IG92ZXIgZm9jdXMgbmV4dCBwYXJ0IHdoaWxlIHdlIGFyZSBkZWJ1Z2dpbmdcblx0cHJpbWFyeTogS2V5Q29kZS5GNixcblx0d2hlbjogQ09OVEVYVF9ERUJVR19TVEFURS5pc0VxdWFsVG8oJ3J1bm5pbmcnKSxcblx0aGFuZGxlcjogYXN5bmMgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBfOiBzdHJpbmcsIGNvbnRleHQ6IENhbGxTdGFja0NvbnRleHQgfCB1bmtub3duKSA9PiB7XG5cdFx0YXdhaXQgZ2V0VGhyZWFkQW5kUnVuKGFjY2Vzc29yLCBjb250ZXh0LCB0aHJlYWQgPT4gdGhyZWFkLnBhdXNlKCkpO1xuXHR9XG59KTtcblxuXG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0aWQ6IFNURVBfSU5UT19UQVJHRVRfSUQsXG5cdHByaW1hcnk6IFNURVBfSU5UT19LRVlCSU5ESU5HIHwgS2V5TW9kLkN0cmxDbWQsXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX1NURVBfSU5UT19UQVJHRVRTX1NVUFBPUlRFRCwgQ09OVEVYVF9JTl9ERUJVR19NT0RFLCBDT05URVhUX0RFQlVHX1NUQVRFLmlzRXF1YWxUbygnc3RvcHBlZCcpKSxcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdGhhbmRsZXI6IGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgXzogc3RyaW5nLCBjb250ZXh0OiBDYWxsU3RhY2tDb250ZXh0IHwgdW5rbm93bikgPT4ge1xuXHRcdGNvbnN0IHF1aWNrSW5wdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElRdWlja0lucHV0U2VydmljZSk7XG5cdFx0Y29uc3QgZGVidWdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEZWJ1Z1NlcnZpY2UpO1xuXHRcdGNvbnN0IHNlc3Npb24gPSBkZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkuZm9jdXNlZFNlc3Npb247XG5cdFx0Y29uc3QgZnJhbWUgPSBkZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkuZm9jdXNlZFN0YWNrRnJhbWU7XG5cdFx0aWYgKCFmcmFtZSB8fCAhc2Vzc2lvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGVkaXRvciA9IGF3YWl0IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSkub3BlbkVkaXRvcih7XG5cdFx0XHRyZXNvdXJjZTogZnJhbWUuc291cmNlLnVyaSxcblx0XHRcdG9wdGlvbnM6IHsgcmV2ZWFsSWZPcGVuZWQ6IHRydWUgfVxuXHRcdH0pO1xuXG5cdFx0bGV0IGNvZGVFZGl0b3I6IElDb2RlRWRpdG9yIHwgdW5kZWZpbmVkO1xuXHRcdGlmIChlZGl0b3IpIHtcblx0XHRcdGNvbnN0IGN0cmwgPSBlZGl0b3I/LmdldENvbnRyb2woKTtcblx0XHRcdGlmIChpc0NvZGVFZGl0b3IoY3RybCkpIHtcblx0XHRcdFx0Y29kZUVkaXRvciA9IGN0cmw7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aW50ZXJmYWNlIElUYXJnZXRJdGVtIGV4dGVuZHMgSVF1aWNrUGlja0l0ZW0ge1xuXHRcdFx0dGFyZ2V0OiBEZWJ1Z1Byb3RvY29sLlN0ZXBJblRhcmdldDtcblx0XHR9XG5cblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBxcCA9IGRpc3Bvc2FibGVzLmFkZChxdWlja0lucHV0U2VydmljZS5jcmVhdGVRdWlja1BpY2s8SVRhcmdldEl0ZW0+KCkpO1xuXHRcdHFwLmJ1c3kgPSB0cnVlO1xuXHRcdHFwLnNob3coKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChxcC5vbkRpZENoYW5nZUFjdGl2ZSgoW2l0ZW1dKSA9PiB7XG5cdFx0XHRpZiAoY29kZUVkaXRvciAmJiBpdGVtICYmIGl0ZW0udGFyZ2V0LmxpbmUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRjb2RlRWRpdG9yLnJldmVhbExpbmVJbkNlbnRlcklmT3V0c2lkZVZpZXdwb3J0KGl0ZW0udGFyZ2V0LmxpbmUpO1xuXHRcdFx0XHRjb2RlRWRpdG9yLnNldFNlbGVjdGlvbih7XG5cdFx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiBpdGVtLnRhcmdldC5saW5lLFxuXHRcdFx0XHRcdHN0YXJ0Q29sdW1uOiBpdGVtLnRhcmdldC5jb2x1bW4gfHwgMSxcblx0XHRcdFx0XHRlbmRMaW5lTnVtYmVyOiBpdGVtLnRhcmdldC5lbmRMaW5lIHx8IGl0ZW0udGFyZ2V0LmxpbmUsXG5cdFx0XHRcdFx0ZW5kQ29sdW1uOiBpdGVtLnRhcmdldC5lbmRDb2x1bW4gfHwgaXRlbS50YXJnZXQuY29sdW1uIHx8IDEsXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChxcC5vbkRpZEFjY2VwdCgoKSA9PiB7XG5cdFx0XHRpZiAocXAuYWN0aXZlSXRlbXMubGVuZ3RoKSB7XG5cdFx0XHRcdHNlc3Npb24uc3RlcEluKGZyYW1lLnRocmVhZC50aHJlYWRJZCwgcXAuYWN0aXZlSXRlbXNbMF0udGFyZ2V0LmlkKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQocXAub25EaWRIaWRlKCgpID0+IGRpc3Bvc2FibGVzLmRpc3Bvc2UoKSkpO1xuXG5cdFx0c2Vzc2lvbi5zdGVwSW5UYXJnZXRzKGZyYW1lLmZyYW1lSWQpLnRoZW4odGFyZ2V0cyA9PiB7XG5cdFx0XHRxcC5idXN5ID0gZmFsc2U7XG5cdFx0XHRpZiAodGFyZ2V0cz8ubGVuZ3RoKSB7XG5cdFx0XHRcdHFwLml0ZW1zID0gdGFyZ2V0cz8ubWFwKHRhcmdldCA9PiAoeyB0YXJnZXQsIGxhYmVsOiB0YXJnZXQubGFiZWwgfSkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cXAucGxhY2Vob2xkZXIgPSBubHMubG9jYWxpemUoJ2VkaXRvci5kZWJ1Zy5hY3Rpb24uc3RlcEludG9UYXJnZXRzLm5vbmUnLCBcIk5vIHN0ZXAgdGFyZ2V0cyBhdmFpbGFibGVcIik7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn0pO1xuXG5hc3luYyBmdW5jdGlvbiBzdG9wSGFuZGxlcihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgXzogc3RyaW5nLCBjb250ZXh0OiBDYWxsU3RhY2tDb250ZXh0IHwgdW5rbm93biwgZGlzY29ubmVjdDogYm9vbGVhbiwgc3VzcGVuZD86IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0Y29uc3QgZGVidWdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEZWJ1Z1NlcnZpY2UpO1xuXHRsZXQgc2Vzc2lvbjogSURlYnVnU2Vzc2lvbiB8IHVuZGVmaW5lZDtcblx0aWYgKGlzU2Vzc2lvbkNvbnRleHQoY29udGV4dCkpIHtcblx0XHRzZXNzaW9uID0gZGVidWdTZXJ2aWNlLmdldE1vZGVsKCkuZ2V0U2Vzc2lvbihjb250ZXh0LnNlc3Npb25JZCk7XG5cdH0gZWxzZSB7XG5cdFx0c2Vzc2lvbiA9IGRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5mb2N1c2VkU2Vzc2lvbjtcblx0fVxuXG5cdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdGNvbnN0IHNob3dTdWJTZXNzaW9ucyA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElEZWJ1Z0NvbmZpZ3VyYXRpb24+KCdkZWJ1ZycpLnNob3dTdWJTZXNzaW9uc0luVG9vbEJhcjtcblx0Ly8gU3RvcCBzaG91bGQgYmUgc2VudCB0byB0aGUgcm9vdCBwYXJlbnQgc2Vzc2lvblxuXHR3aGlsZSAoIXNob3dTdWJTZXNzaW9ucyAmJiBzZXNzaW9uICYmIHNlc3Npb24ubGlmZWN5Y2xlTWFuYWdlZEJ5UGFyZW50ICYmIHNlc3Npb24ucGFyZW50U2Vzc2lvbikge1xuXHRcdHNlc3Npb24gPSBzZXNzaW9uLnBhcmVudFNlc3Npb247XG5cdH1cblxuXHRhd2FpdCBkZWJ1Z1NlcnZpY2Uuc3RvcFNlc3Npb24oc2Vzc2lvbiwgZGlzY29ubmVjdCwgc3VzcGVuZCk7XG59XG5cbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRpZDogRElTQ09OTkVDVF9JRCxcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdHByaW1hcnk6IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuRjUsXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX0ZPQ1VTRURfU0VTU0lPTl9JU19BVFRBQ0gsIENPTlRFWFRfSU5fREVCVUdfTU9ERSksXG5cdGhhbmRsZXI6IChhY2Nlc3NvciwgXywgY29udGV4dCkgPT4gc3RvcEhhbmRsZXIoYWNjZXNzb3IsIF8sIGNvbnRleHQsIHRydWUpXG59KTtcblxuQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoe1xuXHRpZDogRElTQ09OTkVDVF9BTkRfU1VTUEVORF9JRCxcblx0aGFuZGxlcjogKGFjY2Vzc29yLCBfLCBjb250ZXh0KSA9PiBzdG9wSGFuZGxlcihhY2Nlc3NvciwgXywgY29udGV4dCwgdHJ1ZSwgdHJ1ZSlcbn0pO1xuXG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0aWQ6IFNUT1BfSUQsXG5cdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRwcmltYXJ5OiBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkY1LFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ09OVEVYVF9GT0NVU0VEX1NFU1NJT05fSVNfQVRUQUNILnRvTmVnYXRlZCgpLCBDT05URVhUX0lOX0RFQlVHX01PREUpLFxuXHRoYW5kbGVyOiAoYWNjZXNzb3IsIF8sIGNvbnRleHQpID0+IHN0b3BIYW5kbGVyKGFjY2Vzc29yLCBfLCBjb250ZXh0LCBmYWxzZSlcbn0pO1xuXG5Db21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCh7XG5cdGlkOiBSRVNUQVJUX0ZSQU1FX0lELFxuXHRoYW5kbGVyOiBhc3luYyAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIF86IHN0cmluZywgY29udGV4dDogQ2FsbFN0YWNrQ29udGV4dCB8IHVua25vd24pID0+IHtcblx0XHRjb25zdCBkZWJ1Z1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSURlYnVnU2VydmljZSk7XG5cdFx0Y29uc3Qgbm90aWZpY2F0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJTm90aWZpY2F0aW9uU2VydmljZSk7XG5cdFx0Y29uc3QgZnJhbWUgPSBnZXRGcmFtZShkZWJ1Z1NlcnZpY2UsIGNvbnRleHQpO1xuXHRcdGlmIChmcmFtZSkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgZnJhbWUucmVzdGFydCgpO1xuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKGUpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufSk7XG5cbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRpZDogQ09OVElOVUVfSUQsXG5cdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliICsgMTAsIC8vIFVzZSBhIHN0cm9uZ2VyIHdlaWdodCB0byBnZXQgcHJpb3JpdHkgb3ZlciBzdGFydCBkZWJ1Z2dpbmcgRjUgc2hvcnRjdXRcblx0cHJpbWFyeTogS2V5Q29kZS5GNSxcblx0d2hlbjogQ09OVEVYVF9ERUJVR19TVEFURS5pc0VxdWFsVG8oJ3N0b3BwZWQnKSxcblx0aGFuZGxlcjogYXN5bmMgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBfOiBzdHJpbmcsIGNvbnRleHQ6IENhbGxTdGFja0NvbnRleHQgfCB1bmtub3duKSA9PiB7XG5cdFx0YXdhaXQgZ2V0VGhyZWFkQW5kUnVuKGFjY2Vzc29yLCBjb250ZXh0LCB0aHJlYWQgPT4gdGhyZWFkLmNvbnRpbnVlKCkpO1xuXHR9XG59KTtcblxuQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoe1xuXHRpZDogU0hPV19MT0FERURfU0NSSVBUU19JRCxcblx0aGFuZGxlcjogYXN5bmMgKGFjY2Vzc29yKSA9PiB7XG5cdFx0YXdhaXQgc2hvd0xvYWRlZFNjcmlwdE1lbnUoYWNjZXNzb3IpO1xuXHR9XG59KTtcblxuQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoe1xuXHRpZDogJ2RlYnVnLnN0YXJ0RnJvbUNvbmZpZycsXG5cdGhhbmRsZXI6IGFzeW5jIChhY2Nlc3NvciwgY29uZmlnOiBJQ29uZmlnKSA9PiB7XG5cdFx0Y29uc3QgZGVidWdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEZWJ1Z1NlcnZpY2UpO1xuXHRcdGF3YWl0IGRlYnVnU2VydmljZS5zdGFydERlYnVnZ2luZyh1bmRlZmluZWQsIGNvbmZpZyk7XG5cdH1cbn0pO1xuXG5Db21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCh7XG5cdGlkOiBGT0NVU19TRVNTSU9OX0lELFxuXHRoYW5kbGVyOiBhc3luYyAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHNlc3Npb246IElEZWJ1Z1Nlc3Npb24pID0+IHtcblx0XHRjb25zdCBkZWJ1Z1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSURlYnVnU2VydmljZSk7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0Y29uc3Qgc3RvcHBlZENoaWxkU2Vzc2lvbiA9IGRlYnVnU2VydmljZS5nZXRNb2RlbCgpLmdldFNlc3Npb25zKCkuZmluZChzID0+IHMucGFyZW50U2Vzc2lvbiA9PT0gc2Vzc2lvbiAmJiBzLnN0YXRlID09PSBTdGF0ZS5TdG9wcGVkKTtcblx0XHRpZiAoc3RvcHBlZENoaWxkU2Vzc2lvbiAmJiBzZXNzaW9uLnN0YXRlICE9PSBTdGF0ZS5TdG9wcGVkKSB7XG5cdFx0XHRzZXNzaW9uID0gc3RvcHBlZENoaWxkU2Vzc2lvbjtcblx0XHR9XG5cdFx0YXdhaXQgZGVidWdTZXJ2aWNlLmZvY3VzU3RhY2tGcmFtZSh1bmRlZmluZWQsIHVuZGVmaW5lZCwgc2Vzc2lvbiwgeyBleHBsaWNpdDogdHJ1ZSB9KTtcblx0XHRjb25zdCBzdGFja0ZyYW1lID0gZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLmZvY3VzZWRTdGFja0ZyYW1lO1xuXHRcdGlmIChzdGFja0ZyYW1lKSB7XG5cdFx0XHRhd2FpdCBzdGFja0ZyYW1lLm9wZW5JbkVkaXRvcihlZGl0b3JTZXJ2aWNlLCB0cnVlKTtcblx0XHR9XG5cdH1cbn0pO1xuXG5Db21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCh7XG5cdGlkOiBTRUxFQ1RfQU5EX1NUQVJUX0lELFxuXHRoYW5kbGVyOiBhc3luYyAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGRlYnVnVHlwZTogc3RyaW5nIHwgdW5rbm93biwgZGVidWdTdGFydE9wdGlvbnM/OiB7IG5vRGVidWc/OiBib29sZWFuIH0pID0+IHtcblx0XHRjb25zdCBxdWlja0lucHV0U2VydmljZSA9IGFjY2Vzc29yLmdldChJUXVpY2tJbnB1dFNlcnZpY2UpO1xuXHRcdGNvbnN0IGRlYnVnU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGVidWdTZXJ2aWNlKTtcblxuXHRcdGlmIChkZWJ1Z1R5cGUpIHtcblx0XHRcdGNvbnN0IGNvbmZpZ01hbmFnZXIgPSBkZWJ1Z1NlcnZpY2UuZ2V0Q29uZmlndXJhdGlvbk1hbmFnZXIoKTtcblx0XHRcdGNvbnN0IGR5bmFtaWNQcm92aWRlcnMgPSBhd2FpdCBjb25maWdNYW5hZ2VyLmdldER5bmFtaWNQcm92aWRlcnMoKTtcblx0XHRcdGZvciAoY29uc3QgcHJvdmlkZXIgb2YgZHluYW1pY1Byb3ZpZGVycykge1xuXHRcdFx0XHRpZiAocHJvdmlkZXIudHlwZSA9PT0gZGVidWdUeXBlKSB7XG5cdFx0XHRcdFx0Y29uc3QgcGljayA9IGF3YWl0IHByb3ZpZGVyLnBpY2soKTtcblx0XHRcdFx0XHRpZiAocGljaykge1xuXHRcdFx0XHRcdFx0YXdhaXQgY29uZmlnTWFuYWdlci5zZWxlY3RDb25maWd1cmF0aW9uKHBpY2subGF1bmNoLCBwaWNrLmNvbmZpZy5uYW1lLCBwaWNrLmNvbmZpZywgeyB0eXBlOiBwcm92aWRlci50eXBlIH0pO1xuXHRcdFx0XHRcdFx0ZGVidWdTZXJ2aWNlLnN0YXJ0RGVidWdnaW5nKHBpY2subGF1bmNoLCBwaWNrLmNvbmZpZywgeyBub0RlYnVnOiBkZWJ1Z1N0YXJ0T3B0aW9ucz8ubm9EZWJ1Zywgc3RhcnRlZEJ5VXNlcjogdHJ1ZSB9KTtcblxuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHF1aWNrSW5wdXRTZXJ2aWNlLnF1aWNrQWNjZXNzLnNob3coREVCVUdfUVVJQ0tfQUNDRVNTX1BSRUZJWCk7XG5cdH1cbn0pO1xuXG5Db21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCh7XG5cdGlkOiBTRUxFQ1RfREVCVUdfQ09OU09MRV9JRCxcblx0aGFuZGxlcjogYXN5bmMgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSA9PiB7XG5cdFx0Y29uc3QgcXVpY2tJbnB1dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVF1aWNrSW5wdXRTZXJ2aWNlKTtcblx0XHRxdWlja0lucHV0U2VydmljZS5xdWlja0FjY2Vzcy5zaG93KERFQlVHX0NPTlNPTEVfUVVJQ0tfQUNDRVNTX1BSRUZJWCk7XG5cdH1cbn0pO1xuXG5Db21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCh7XG5cdGlkOiBTRUxFQ1RfREVCVUdfU0VTU0lPTl9JRCxcblx0aGFuZGxlcjogYXN5bmMgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSA9PiB7XG5cdFx0c2hvd0RlYnVnU2Vzc2lvbk1lbnUoYWNjZXNzb3IsIFNFTEVDVF9BTkRfU1RBUlRfSUQpO1xuXHR9XG59KTtcblxuS2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdGlkOiBERUJVR19TVEFSVF9DT01NQU5EX0lELFxuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0cHJpbWFyeTogS2V5Q29kZS5GNSxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENPTlRFWFRfREVCVUdHRVJTX0FWQUlMQUJMRSwgQ09OVEVYVF9ERUJVR19TVEFURS5pc0VxdWFsVG8oJ2luYWN0aXZlJykpLFxuXHRoYW5kbGVyOiBhc3luYyAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGRlYnVnU3RhcnRPcHRpb25zPzogeyBjb25maWc/OiBQYXJ0aWFsPElDb25maWc+OyBub0RlYnVnPzogYm9vbGVhbiB9KSA9PiB7XG5cdFx0Y29uc3QgZGVidWdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEZWJ1Z1NlcnZpY2UpO1xuXHRcdGF3YWl0IHNhdmVBbGxCZWZvcmVEZWJ1Z1N0YXJ0KGFjY2Vzc29yLmdldChJQ29uZmlndXJhdGlvblNlcnZpY2UpLCBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpKTtcblx0XHRjb25zdCB7IGxhdW5jaCwgbmFtZSwgZ2V0Q29uZmlnIH0gPSBkZWJ1Z1NlcnZpY2UuZ2V0Q29uZmlndXJhdGlvbk1hbmFnZXIoKS5zZWxlY3RlZENvbmZpZ3VyYXRpb247XG5cdFx0Y29uc3QgY29uZmlnID0gYXdhaXQgZ2V0Q29uZmlnKCk7XG5cdFx0Y29uc3QgY29uZmlnT3JOYW1lID0gY29uZmlnID8gT2JqZWN0LmFzc2lnbihkZWVwQ2xvbmUoY29uZmlnKSwgZGVidWdTdGFydE9wdGlvbnM/LmNvbmZpZykgOiBuYW1lO1xuXHRcdGF3YWl0IGRlYnVnU2VydmljZS5zdGFydERlYnVnZ2luZyhsYXVuY2gsIGNvbmZpZ09yTmFtZSwgeyBub0RlYnVnOiBkZWJ1Z1N0YXJ0T3B0aW9ucz8ubm9EZWJ1Zywgc3RhcnRlZEJ5VXNlcjogdHJ1ZSB9LCBmYWxzZSk7XG5cdH1cbn0pO1xuXG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0aWQ6IERFQlVHX1JVTl9DT01NQU5EX0lELFxuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkY1LFxuXHRtYWM6IHsgcHJpbWFyeTogS2V5TW9kLldpbkN0cmwgfCBLZXlDb2RlLkY1IH0sXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX0RFQlVHR0VSU19BVkFJTEFCTEUsIENPTlRFWFRfREVCVUdfU1RBVEUubm90RXF1YWxzVG8oZ2V0U3RhdGVMYWJlbChTdGF0ZS5Jbml0aWFsaXppbmcpKSksXG5cdGhhbmRsZXI6IGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvcikgPT4ge1xuXHRcdGNvbnN0IGNvbW1hbmRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb21tYW5kU2VydmljZSk7XG5cdFx0YXdhaXQgY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoREVCVUdfU1RBUlRfQ09NTUFORF9JRCwgeyBub0RlYnVnOiB0cnVlIH0pO1xuXHR9XG59KTtcblxuS2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdGlkOiAnZGVidWcudG9nZ2xlQnJlYWtwb2ludCcsXG5cdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliICsgNSxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENPTlRFWFRfQlJFQUtQT0lOVFNfRk9DVVNFRCwgSW5wdXRGb2N1c2VkQ29udGV4dC50b05lZ2F0ZWQoKSksXG5cdHByaW1hcnk6IEtleUNvZGUuU3BhY2UsXG5cdGhhbmRsZXI6IChhY2Nlc3NvcikgPT4ge1xuXHRcdGNvbnN0IGxpc3RTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMaXN0U2VydmljZSk7XG5cdFx0Y29uc3QgZGVidWdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEZWJ1Z1NlcnZpY2UpO1xuXHRcdGNvbnN0IGxpc3QgPSBsaXN0U2VydmljZS5sYXN0Rm9jdXNlZExpc3Q7XG5cdFx0aWYgKGxpc3QgaW5zdGFuY2VvZiBMaXN0KSB7XG5cdFx0XHRjb25zdCBmb2N1c2VkID0gPElFbmFibGVtZW50W10+bGlzdC5nZXRGb2N1c2VkRWxlbWVudHMoKTtcblx0XHRcdGlmIChmb2N1c2VkICYmIGZvY3VzZWQubGVuZ3RoKSB7XG5cdFx0XHRcdGRlYnVnU2VydmljZS5lbmFibGVPckRpc2FibGVCcmVha3BvaW50cyghZm9jdXNlZFswXS5lbmFibGVkLCBmb2N1c2VkWzBdKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn0pO1xuXG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0aWQ6ICdkZWJ1Zy5lbmFibGVPckRpc2FibGVCcmVha3BvaW50Jyxcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdHByaW1hcnk6IHVuZGVmaW5lZCxcblx0d2hlbjogRWRpdG9yQ29udGV4dEtleXMuZWRpdG9yVGV4dEZvY3VzLFxuXHRoYW5kbGVyOiAoYWNjZXNzb3IpID0+IHtcblx0XHRjb25zdCBkZWJ1Z1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSURlYnVnU2VydmljZSk7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0Y29uc3QgY29udHJvbCA9IGVkaXRvclNlcnZpY2UuYWN0aXZlVGV4dEVkaXRvckNvbnRyb2w7XG5cdFx0aWYgKGlzQ29kZUVkaXRvcihjb250cm9sKSkge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBjb250cm9sLmdldE1vZGVsKCk7XG5cdFx0XHRpZiAobW9kZWwpIHtcblx0XHRcdFx0Y29uc3QgcG9zaXRpb24gPSBjb250cm9sLmdldFBvc2l0aW9uKCk7XG5cdFx0XHRcdGlmIChwb3NpdGlvbikge1xuXHRcdFx0XHRcdGNvbnN0IGJwcyA9IGRlYnVnU2VydmljZS5nZXRNb2RlbCgpLmdldEJyZWFrcG9pbnRzKHsgdXJpOiBtb2RlbC51cmksIGxpbmVOdW1iZXI6IHBvc2l0aW9uLmxpbmVOdW1iZXIgfSk7XG5cdFx0XHRcdFx0aWYgKGJwcy5sZW5ndGgpIHtcblx0XHRcdFx0XHRcdGRlYnVnU2VydmljZS5lbmFibGVPckRpc2FibGVCcmVha3BvaW50cyghYnBzWzBdLmVuYWJsZWQsIGJwc1swXSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59KTtcblxuS2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdGlkOiBFRElUX0VYUFJFU1NJT05fQ09NTUFORF9JRCxcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIgKyA1LFxuXHR3aGVuOiBDT05URVhUX1dBVENIX0VYUFJFU1NJT05TX0ZPQ1VTRUQsXG5cdHByaW1hcnk6IEtleUNvZGUuRjIsXG5cdG1hYzogeyBwcmltYXJ5OiBLZXlDb2RlLkVudGVyIH0sXG5cdGhhbmRsZXI6IChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZXhwcmVzc2lvbjogRXhwcmVzc2lvbiB8IHVua25vd24pID0+IHtcblx0XHRjb25zdCBkZWJ1Z1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSURlYnVnU2VydmljZSk7XG5cdFx0aWYgKCEoZXhwcmVzc2lvbiBpbnN0YW5jZW9mIEV4cHJlc3Npb24pKSB7XG5cdFx0XHRjb25zdCBsaXN0U2VydmljZSA9IGFjY2Vzc29yLmdldChJTGlzdFNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgZm9jdXNlZCA9IGxpc3RTZXJ2aWNlLmxhc3RGb2N1c2VkTGlzdDtcblx0XHRcdGlmIChmb2N1c2VkKSB7XG5cdFx0XHRcdGNvbnN0IGVsZW1lbnRzID0gZm9jdXNlZC5nZXRGb2N1cygpO1xuXHRcdFx0XHRpZiAoQXJyYXkuaXNBcnJheShlbGVtZW50cykgJiYgZWxlbWVudHNbMF0gaW5zdGFuY2VvZiBFeHByZXNzaW9uKSB7XG5cdFx0XHRcdFx0ZXhwcmVzc2lvbiA9IGVsZW1lbnRzWzBdO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGV4cHJlc3Npb24gaW5zdGFuY2VvZiBFeHByZXNzaW9uKSB7XG5cdFx0XHRkZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkuc2V0U2VsZWN0ZWRFeHByZXNzaW9uKGV4cHJlc3Npb24sIGZhbHNlKTtcblx0XHR9XG5cdH1cbn0pO1xuXG5Db21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCh7XG5cdGlkOiBTRVRfRVhQUkVTU0lPTl9DT01NQU5EX0lELFxuXHRoYW5kbGVyOiBhc3luYyAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGV4cHJlc3Npb246IEV4cHJlc3Npb24gfCB1bmtub3duKSA9PiB7XG5cdFx0Y29uc3QgZGVidWdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEZWJ1Z1NlcnZpY2UpO1xuXHRcdGlmIChleHByZXNzaW9uIGluc3RhbmNlb2YgRXhwcmVzc2lvbiB8fCBleHByZXNzaW9uIGluc3RhbmNlb2YgVmFyaWFibGUpIHtcblx0XHRcdGRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5zZXRTZWxlY3RlZEV4cHJlc3Npb24oZXhwcmVzc2lvbiwgdHJ1ZSk7XG5cdFx0fVxuXHR9XG59KTtcblxuS2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdGlkOiAnZGVidWcuc2V0VmFyaWFibGUnLFxuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYiArIDUsXG5cdHdoZW46IENPTlRFWFRfVkFSSUFCTEVTX0ZPQ1VTRUQsXG5cdHByaW1hcnk6IEtleUNvZGUuRjIsXG5cdG1hYzogeyBwcmltYXJ5OiBLZXlDb2RlLkVudGVyIH0sXG5cdGhhbmRsZXI6IChhY2Nlc3NvcikgPT4ge1xuXHRcdGNvbnN0IGxpc3RTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMaXN0U2VydmljZSk7XG5cdFx0Y29uc3QgZGVidWdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEZWJ1Z1NlcnZpY2UpO1xuXHRcdGNvbnN0IGZvY3VzZWQgPSBsaXN0U2VydmljZS5sYXN0Rm9jdXNlZExpc3Q7XG5cblx0XHRpZiAoZm9jdXNlZCkge1xuXHRcdFx0Y29uc3QgZWxlbWVudHMgPSBmb2N1c2VkLmdldEZvY3VzKCk7XG5cdFx0XHRpZiAoQXJyYXkuaXNBcnJheShlbGVtZW50cykgJiYgZWxlbWVudHNbMF0gaW5zdGFuY2VvZiBWYXJpYWJsZSkge1xuXHRcdFx0XHRkZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkuc2V0U2VsZWN0ZWRFeHByZXNzaW9uKGVsZW1lbnRzWzBdLCBmYWxzZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59KTtcblxuS2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdGlkOiBSRU1PVkVfRVhQUkVTU0lPTl9DT01NQU5EX0lELFxuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENPTlRFWFRfV0FUQ0hfRVhQUkVTU0lPTlNfRk9DVVNFRCwgQ09OVEVYVF9FWFBSRVNTSU9OX1NFTEVDVEVELnRvTmVnYXRlZCgpKSxcblx0cHJpbWFyeTogS2V5Q29kZS5EZWxldGUsXG5cdG1hYzogeyBwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuQmFja3NwYWNlIH0sXG5cdGhhbmRsZXI6IChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZXhwcmVzc2lvbjogRXhwcmVzc2lvbiB8IHVua25vd24pID0+IHtcblx0XHRjb25zdCBkZWJ1Z1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSURlYnVnU2VydmljZSk7XG5cblx0XHRpZiAoZXhwcmVzc2lvbiBpbnN0YW5jZW9mIEV4cHJlc3Npb24pIHtcblx0XHRcdGRlYnVnU2VydmljZS5yZW1vdmVXYXRjaEV4cHJlc3Npb25zKGV4cHJlc3Npb24uZ2V0SWQoKSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGlzdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxpc3RTZXJ2aWNlKTtcblx0XHRjb25zdCBmb2N1c2VkID0gbGlzdFNlcnZpY2UubGFzdEZvY3VzZWRMaXN0O1xuXHRcdGlmIChmb2N1c2VkKSB7XG5cdFx0XHRsZXQgZWxlbWVudHMgPSBmb2N1c2VkLmdldEZvY3VzKCk7XG5cdFx0XHRpZiAoQXJyYXkuaXNBcnJheShlbGVtZW50cykgJiYgZWxlbWVudHNbMF0gaW5zdGFuY2VvZiBFeHByZXNzaW9uKSB7XG5cdFx0XHRcdGNvbnN0IHNlbGVjdGlvbiA9IGZvY3VzZWQuZ2V0U2VsZWN0aW9uKCk7XG5cdFx0XHRcdGlmIChzZWxlY3Rpb24gJiYgc2VsZWN0aW9uLmluZGV4T2YoZWxlbWVudHNbMF0pID49IDApIHtcblx0XHRcdFx0XHRlbGVtZW50cyA9IHNlbGVjdGlvbjtcblx0XHRcdFx0fVxuXHRcdFx0XHRlbGVtZW50cy5mb3JFYWNoKChlOiBFeHByZXNzaW9uKSA9PiBkZWJ1Z1NlcnZpY2UucmVtb3ZlV2F0Y2hFeHByZXNzaW9ucyhlLmdldElkKCkpKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn0pO1xuXG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0aWQ6ICdkZWJ1Zy5yZW1vdmVCcmVha3BvaW50Jyxcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX0JSRUFLUE9JTlRTX0ZPQ1VTRUQsIENPTlRFWFRfQlJFQUtQT0lOVF9JTlBVVF9GT0NVU0VELnRvTmVnYXRlZCgpKSxcblx0cHJpbWFyeTogS2V5Q29kZS5EZWxldGUsXG5cdG1hYzogeyBwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuQmFja3NwYWNlIH0sXG5cdGhhbmRsZXI6IChhY2Nlc3NvcikgPT4ge1xuXHRcdGNvbnN0IGxpc3RTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMaXN0U2VydmljZSk7XG5cdFx0Y29uc3QgZGVidWdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEZWJ1Z1NlcnZpY2UpO1xuXHRcdGNvbnN0IGxpc3QgPSBsaXN0U2VydmljZS5sYXN0Rm9jdXNlZExpc3Q7XG5cblx0XHRpZiAobGlzdCBpbnN0YW5jZW9mIExpc3QpIHtcblx0XHRcdGNvbnN0IGZvY3VzZWQgPSBsaXN0LmdldEZvY3VzZWRFbGVtZW50cygpO1xuXHRcdFx0Y29uc3QgZWxlbWVudCA9IGZvY3VzZWQubGVuZ3RoID8gZm9jdXNlZFswXSA6IHVuZGVmaW5lZDtcblx0XHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgQnJlYWtwb2ludCkge1xuXHRcdFx0XHRkZWJ1Z1NlcnZpY2UucmVtb3ZlQnJlYWtwb2ludHMoZWxlbWVudC5nZXRJZCgpKTtcblx0XHRcdH0gZWxzZSBpZiAoZWxlbWVudCBpbnN0YW5jZW9mIEZ1bmN0aW9uQnJlYWtwb2ludCkge1xuXHRcdFx0XHRkZWJ1Z1NlcnZpY2UucmVtb3ZlRnVuY3Rpb25CcmVha3BvaW50cyhlbGVtZW50LmdldElkKCkpO1xuXHRcdFx0fSBlbHNlIGlmIChlbGVtZW50IGluc3RhbmNlb2YgRGF0YUJyZWFrcG9pbnQpIHtcblx0XHRcdFx0ZGVidWdTZXJ2aWNlLnJlbW92ZURhdGFCcmVha3BvaW50cyhlbGVtZW50LmdldElkKCkpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufSk7XG5cbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRpZDogJ2RlYnVnLmluc3RhbGxBZGRpdGlvbmFsRGVidWdnZXJzJyxcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdHdoZW46IHVuZGVmaW5lZCxcblx0cHJpbWFyeTogdW5kZWZpbmVkLFxuXHRoYW5kbGVyOiBhc3luYyAoYWNjZXNzb3IsIHF1ZXJ5OiBzdHJpbmcpID0+IHtcblx0XHRjb25zdCBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZSA9IGFjY2Vzc29yLmdldChJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UpO1xuXHRcdGxldCBzZWFyY2hGb3IgPSBgQGNhdGVnb3J5OmRlYnVnZ2Vyc2A7XG5cdFx0aWYgKHR5cGVvZiBxdWVyeSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHNlYXJjaEZvciArPSBgICR7cXVlcnl9YDtcblx0XHR9XG5cdFx0cmV0dXJuIGV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLm9wZW5TZWFyY2goc2VhcmNoRm9yKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBBZGRDb25maWd1cmF0aW9uQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBBRERfQ09ORklHVVJBVElPTl9JRCxcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdhZGRDb25maWd1cmF0aW9uJywgXCJBZGQgQ29uZmlndXJhdGlvbi4uLlwiKSxcblx0XHRcdGNhdGVnb3J5OiBERUJVR19DT01NQU5EX0NBVEVHT1JZLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuRWRpdG9yQ29udGVudCxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdENvbnRleHRLZXlFeHByLnJlZ2V4KFJlc291cmNlQ29udGV4dEtleS5QYXRoLmtleSwgL1xcLnZzY29kZVsvXFxcXF1sYXVuY2hcXC5qc29uJC8pLFxuXHRcdFx0XHRcdEFjdGl2ZUVkaXRvckNvbnRleHQuaXNFcXVhbFRvKFRFWFRfRklMRV9FRElUT1JfSUQpKVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBsYXVuY2hVcmk6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IG1hbmFnZXIgPSBhY2Nlc3Nvci5nZXQoSURlYnVnU2VydmljZSkuZ2V0Q29uZmlndXJhdGlvbk1hbmFnZXIoKTtcblxuXHRcdGNvbnN0IGxhdW5jaCA9IG1hbmFnZXIuZ2V0TGF1bmNoZXMoKS5maW5kKGwgPT4gbC51cmkudG9TdHJpbmcoKSA9PT0gbGF1bmNoVXJpKSB8fCBtYW5hZ2VyLnNlbGVjdGVkQ29uZmlndXJhdGlvbi5sYXVuY2g7XG5cdFx0aWYgKGxhdW5jaCkge1xuXHRcdFx0Y29uc3QgeyBlZGl0b3IsIGNyZWF0ZWQgfSA9IGF3YWl0IGxhdW5jaC5vcGVuQ29uZmlnRmlsZSh7IHByZXNlcnZlRm9jdXM6IGZhbHNlIH0pO1xuXHRcdFx0aWYgKGVkaXRvciAmJiAhY3JlYXRlZCkge1xuXHRcdFx0XHRjb25zdCBjb2RlRWRpdG9yID0gPElDb2RlRWRpdG9yPmVkaXRvci5nZXRDb250cm9sKCk7XG5cdFx0XHRcdGlmIChjb2RlRWRpdG9yKSB7XG5cdFx0XHRcdFx0YXdhaXQgY29kZUVkaXRvci5nZXRDb250cmlidXRpb248SURlYnVnRWRpdG9yQ29udHJpYnV0aW9uPihFRElUT1JfQ09OVFJJQlVUSU9OX0lEKT8uYWRkTGF1bmNoQ29uZmlndXJhdGlvbigpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59KTtcblxuY29uc3QgaW5saW5lQnJlYWtwb2ludEhhbmRsZXIgPSAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpID0+IHtcblx0Y29uc3QgZGVidWdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEZWJ1Z1NlcnZpY2UpO1xuXHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0Y29uc3QgY29udHJvbCA9IGVkaXRvclNlcnZpY2UuYWN0aXZlVGV4dEVkaXRvckNvbnRyb2w7XG5cdGlmIChpc0NvZGVFZGl0b3IoY29udHJvbCkpIHtcblx0XHRjb25zdCBwb3NpdGlvbiA9IGNvbnRyb2wuZ2V0UG9zaXRpb24oKTtcblx0XHRpZiAocG9zaXRpb24gJiYgY29udHJvbC5oYXNNb2RlbCgpICYmIGRlYnVnU2VydmljZS5jYW5TZXRCcmVha3BvaW50c0luKGNvbnRyb2wuZ2V0TW9kZWwoKSkpIHtcblx0XHRcdGNvbnN0IG1vZGVsVXJpID0gY29udHJvbC5nZXRNb2RlbCgpLnVyaTtcblx0XHRcdGNvbnN0IGJyZWFrcG9pbnRBbHJlYWR5U2V0ID0gZGVidWdTZXJ2aWNlLmdldE1vZGVsKCkuZ2V0QnJlYWtwb2ludHMoeyBsaW5lTnVtYmVyOiBwb3NpdGlvbi5saW5lTnVtYmVyLCB1cmk6IG1vZGVsVXJpIH0pXG5cdFx0XHRcdC5zb21lKGJwID0+IChicC5zZXNzaW9uQWdub3N0aWNEYXRhLmNvbHVtbiA9PT0gcG9zaXRpb24uY29sdW1uIHx8ICghYnAuY29sdW1uICYmIHBvc2l0aW9uLmNvbHVtbiA8PSAxKSkpO1xuXG5cdFx0XHRpZiAoIWJyZWFrcG9pbnRBbHJlYWR5U2V0KSB7XG5cdFx0XHRcdGRlYnVnU2VydmljZS5hZGRCcmVha3BvaW50cyhtb2RlbFVyaSwgW3sgbGluZU51bWJlcjogcG9zaXRpb24ubGluZU51bWJlciwgY29sdW1uOiBwb3NpdGlvbi5jb2x1bW4gPiAxID8gcG9zaXRpb24uY29sdW1uIDogdW5kZWZpbmVkIH1dKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn07XG5cbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0cHJpbWFyeTogS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5GOSxcblx0d2hlbjogRWRpdG9yQ29udGV4dEtleXMuZWRpdG9yVGV4dEZvY3VzLFxuXHRpZDogVE9HR0xFX0lOTElORV9CUkVBS1BPSU5UX0lELFxuXHRoYW5kbGVyOiBpbmxpbmVCcmVha3BvaW50SGFuZGxlclxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRWRpdG9yQ29udGV4dCwge1xuXHRjb21tYW5kOiB7XG5cdFx0aWQ6IFRPR0dMRV9JTkxJTkVfQlJFQUtQT0lOVF9JRCxcblx0XHR0aXRsZTogbmxzLmxvY2FsaXplKCdhZGRJbmxpbmVCcmVha3BvaW50JywgXCJBZGQgSW5saW5lIEJyZWFrcG9pbnRcIiksXG5cdFx0Y2F0ZWdvcnk6IERFQlVHX0NPTU1BTkRfQ0FURUdPUllcblx0fSxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdENPTlRFWFRfSU5fREVCVUdfTU9ERSxcblx0XHRQYW5lbEZvY3VzQ29udGV4dC50b05lZ2F0ZWQoKSxcblx0XHRFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsXG5cdFx0Q2hhdENvbnRleHRLZXlzLmluQ2hhdFNlc3Npb24udG9OZWdhdGVkKCkpLFxuXHRncm91cDogJ2RlYnVnJyxcblx0b3JkZXI6IDFcbn0pO1xuXG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0aWQ6ICdkZWJ1Zy5vcGVuQnJlYWtwb2ludFRvU2lkZScsXG5cdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHR3aGVuOiBDT05URVhUX0JSRUFLUE9JTlRTX0ZPQ1VTRUQsXG5cdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5FbnRlcixcblx0c2Vjb25kYXJ5OiBbS2V5TW9kLkFsdCB8IEtleUNvZGUuRW50ZXJdLFxuXHRoYW5kbGVyOiAoYWNjZXNzb3IpID0+IHtcblx0XHRjb25zdCBsaXN0U2VydmljZSA9IGFjY2Vzc29yLmdldChJTGlzdFNlcnZpY2UpO1xuXHRcdGNvbnN0IGxpc3QgPSBsaXN0U2VydmljZS5sYXN0Rm9jdXNlZExpc3Q7XG5cdFx0aWYgKGxpc3QgaW5zdGFuY2VvZiBMaXN0KSB7XG5cdFx0XHRjb25zdCBmb2N1cyA9IGxpc3QuZ2V0Rm9jdXNlZEVsZW1lbnRzKCk7XG5cdFx0XHRpZiAoZm9jdXMubGVuZ3RoICYmIGZvY3VzWzBdIGluc3RhbmNlb2YgQnJlYWtwb2ludCkge1xuXHRcdFx0XHRyZXR1cm4gb3BlbkJyZWFrcG9pbnRTb3VyY2UoZm9jdXNbMF0sIHRydWUsIGZhbHNlLCB0cnVlLCBhY2Nlc3Nvci5nZXQoSURlYnVnU2VydmljZSksIGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cbn0pO1xuXG4vLyBXaGVuIHRoZXJlIGFyZSBubyBkZWJ1ZyBleHRlbnNpb25zLCBvcGVuIHRoZSBkZWJ1ZyB2aWV3bGV0IHdoZW4gRjUgaXMgcHJlc3NlZCBzbyB0aGUgdXNlciBjYW4gcmVhZCB0aGUgbGltaXRhdGlvbnNcbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRpZDogJ2RlYnVnLm9wZW5WaWV3Jyxcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdHdoZW46IENPTlRFWFRfREVCVUdHRVJTX0FWQUlMQUJMRS50b05lZ2F0ZWQoKSxcblx0cHJpbWFyeTogS2V5Q29kZS5GNSxcblx0c2Vjb25kYXJ5OiBbS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkY1XSxcblx0aGFuZGxlcjogYXN5bmMgKGFjY2Vzc29yKSA9PiB7XG5cdFx0Y29uc3QgcGFuZUNvbXBvc2l0ZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVBhbmVDb21wb3NpdGVQYXJ0U2VydmljZSk7XG5cdFx0YXdhaXQgcGFuZUNvbXBvc2l0ZVNlcnZpY2Uub3BlblBhbmVDb21wb3NpdGUoVklFV0xFVF9JRCwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIsIHRydWUpO1xuXHR9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLFNBQVMsY0FBYztBQUNoQyxTQUFTLFlBQVk7QUFDckIsU0FBUyxxQkFBcUIsd0JBQXdCO0FBQ3RELFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsZUFBNEIsNkJBQTZCLG1DQUFtQywyQkFBMkIsd0JBQWtELHVCQUF1Qiw2QkFBMkUscUJBQTBDLGtDQUFrQyxjQUFjLDZCQUE2QixPQUFPLGVBQWUsa0NBQWtDLG1DQUFtQyxZQUFZLGdDQUFnQyx1QkFBdUIscUNBQXFDLDJCQUEyQjtBQUN6bUIsU0FBUyxZQUFZLFVBQVUsWUFBWSxvQkFBb0Isc0JBQThCO0FBQzdGLFNBQVMsbUNBQW1DO0FBQzVDLFNBQXNCLG9CQUFvQjtBQUMxQyxTQUFTLGNBQWMsUUFBUSxTQUFTLHVCQUF1QjtBQUMvRCxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGdCQUFnQiwwQkFBMEI7QUFDbkQsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyw0QkFBNEI7QUFDckMsU0FBUywyQkFBMkI7QUFFcEMsU0FBUyxxQkFBcUIsbUJBQW1CLDBCQUEwQjtBQUMzRSxTQUFTLGtCQUFrQix1QkFBdUI7QUFDbEQsU0FBUyxzQ0FBc0M7QUFDL0MsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUywwQkFBMEM7QUFDbkQsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxpQkFBaUI7QUFDMUIsU0FB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
