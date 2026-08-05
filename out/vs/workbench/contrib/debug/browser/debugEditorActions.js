import { getDomNodePagePosition } from "../../../../base/browser/dom.js";
import { Action } from "../../../../base/common/actions.js";
import { KeyChord, KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { EditorAction, registerEditorAction } from "../../../../editor/browser/editorExtensions.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { Position } from "../../../../editor/common/core/position.js";
import { EditorContextKeys } from "../../../../editor/common/editorContextKeys.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { MessageController } from "../../../../editor/contrib/message/browser/messageController.js";
import * as nls from "../../../../nls.js";
import { Action2, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { PanelFocusContext } from "../../../common/contextkeys.js";
import { ChatContextKeys } from "../../chat/common/chatContextKeys.js";
import { openBreakpointSource } from "./breakpointsView.js";
import { DisassemblyView } from "./disassemblyView.js";
import { BREAKPOINT_EDITOR_CONTRIBUTION_ID, BreakpointWidgetContext, CONTEXT_CALLSTACK_ITEM_TYPE, CONTEXT_DEBUG_STATE, CONTEXT_DEBUGGERS_AVAILABLE, CONTEXT_DISASSEMBLE_REQUEST_SUPPORTED, CONTEXT_DISASSEMBLY_VIEW_FOCUS, CONTEXT_EXCEPTION_WIDGET_VISIBLE, CONTEXT_FOCUSED_STACK_FRAME_HAS_INSTRUCTION_POINTER_REFERENCE, CONTEXT_IN_DEBUG_MODE, CONTEXT_LANGUAGE_SUPPORTS_DISASSEMBLE_REQUEST, CONTEXT_STEP_INTO_TARGETS_SUPPORTED, EDITOR_CONTRIBUTION_ID, IDebugService, REPL_VIEW_ID, WATCH_VIEW_ID } from "../common/debug.js";
import { getEvaluatableExpressionAtPosition } from "../common/debugUtils.js";
import { DisassemblyViewInput } from "../common/disassemblyViewInput.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
class ToggleBreakpointAction extends Action2 {
  constructor() {
    super({
      id: "editor.debug.action.toggleBreakpoint",
      title: {
        ...nls.localize2("toggleBreakpointAction", "Debug: Toggle Breakpoint"),
        mnemonicTitle: nls.localize({ key: "miToggleBreakpoint", comment: ["&& denotes a mnemonic"] }, "Toggle &&Breakpoint")
      },
      f1: true,
      precondition: CONTEXT_DEBUGGERS_AVAILABLE,
      keybinding: {
        when: ContextKeyExpr.or(EditorContextKeys.editorTextFocus, CONTEXT_DISASSEMBLY_VIEW_FOCUS),
        primary: KeyCode.F9,
        weight: KeybindingWeight.EditorContrib
      },
      menu: {
        id: MenuId.MenubarDebugMenu,
        when: CONTEXT_DEBUGGERS_AVAILABLE,
        group: "4_new_breakpoint",
        order: 1
      }
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const debugService = accessor.get(IDebugService);
    const activePane = editorService.activeEditorPane;
    if (activePane instanceof DisassemblyView) {
      const location = activePane.focusedAddressAndOffset;
      if (location) {
        const bps = debugService.getModel().getInstructionBreakpoints();
        const toRemove = bps.find((bp) => bp.address === location.address);
        if (toRemove) {
          debugService.removeInstructionBreakpoints(toRemove.instructionReference, toRemove.offset);
        } else {
          debugService.addInstructionBreakpoint({ instructionReference: location.reference, offset: location.offset, address: location.address, canPersist: false });
        }
      }
      return;
    }
    const codeEditorService = accessor.get(ICodeEditorService);
    const editor = codeEditorService.getFocusedCodeEditor() || codeEditorService.getActiveCodeEditor();
    if (editor?.hasModel()) {
      const modelUri = editor.getModel().uri;
      const canSet = debugService.canSetBreakpointsIn(editor.getModel());
      const lineNumbers = [...new Set(editor.getSelections().map((s) => s.getPosition().lineNumber))];
      await Promise.all(lineNumbers.map(async (line) => {
        const bps = debugService.getModel().getBreakpoints({ lineNumber: line, uri: modelUri });
        if (bps.length) {
          await Promise.all(bps.map((bp) => debugService.removeBreakpoints(bp.getId())));
        } else if (canSet) {
          await debugService.addBreakpoints(modelUri, [{ lineNumber: line }]);
        }
      }));
    }
  }
}
class ConditionalBreakpointAction extends EditorAction {
  constructor() {
    super({
      id: "editor.debug.action.conditionalBreakpoint",
      label: nls.localize2("conditionalBreakpointEditorAction", "Debug: Add Conditional Breakpoint..."),
      precondition: CONTEXT_DEBUGGERS_AVAILABLE,
      menuOpts: {
        menuId: MenuId.MenubarNewBreakpointMenu,
        title: nls.localize({ key: "miConditionalBreakpoint", comment: ["&& denotes a mnemonic"] }, "&&Conditional Breakpoint..."),
        group: "1_breakpoints",
        order: 1,
        when: CONTEXT_DEBUGGERS_AVAILABLE
      }
    });
  }
  async run(accessor, editor) {
    const debugService = accessor.get(IDebugService);
    const position = editor.getPosition();
    if (position && editor.hasModel() && debugService.canSetBreakpointsIn(editor.getModel())) {
      editor.getContribution(BREAKPOINT_EDITOR_CONTRIBUTION_ID)?.showBreakpointWidget(position.lineNumber, void 0, BreakpointWidgetContext.CONDITION);
    }
  }
}
class LogPointAction extends EditorAction {
  constructor() {
    super({
      id: "editor.debug.action.addLogPoint",
      label: nls.localize2("logPointEditorAction", "Debug: Add Logpoint..."),
      precondition: CONTEXT_DEBUGGERS_AVAILABLE,
      menuOpts: [
        {
          menuId: MenuId.MenubarNewBreakpointMenu,
          title: nls.localize({ key: "miLogPoint", comment: ["&& denotes a mnemonic"] }, "&&Logpoint..."),
          group: "1_breakpoints",
          order: 4,
          when: CONTEXT_DEBUGGERS_AVAILABLE
        }
      ]
    });
  }
  async run(accessor, editor) {
    const debugService = accessor.get(IDebugService);
    const position = editor.getPosition();
    if (position && editor.hasModel() && debugService.canSetBreakpointsIn(editor.getModel())) {
      editor.getContribution(BREAKPOINT_EDITOR_CONTRIBUTION_ID)?.showBreakpointWidget(position.lineNumber, position.column, BreakpointWidgetContext.LOG_MESSAGE);
    }
  }
}
class TriggerByBreakpointAction extends EditorAction {
  constructor() {
    super({
      id: "editor.debug.action.triggerByBreakpoint",
      label: nls.localize("triggerByBreakpointEditorAction", "Debug: Add Triggered Breakpoint..."),
      precondition: CONTEXT_DEBUGGERS_AVAILABLE,
      alias: "Debug: Triggered Breakpoint...",
      menuOpts: [
        {
          menuId: MenuId.MenubarNewBreakpointMenu,
          title: nls.localize({ key: "miTriggerByBreakpoint", comment: ["&& denotes a mnemonic"] }, "&&Triggered Breakpoint..."),
          group: "1_breakpoints",
          order: 4,
          when: CONTEXT_DEBUGGERS_AVAILABLE
        }
      ]
    });
  }
  async run(accessor, editor) {
    const debugService = accessor.get(IDebugService);
    const position = editor.getPosition();
    if (position && editor.hasModel() && debugService.canSetBreakpointsIn(editor.getModel())) {
      editor.getContribution(BREAKPOINT_EDITOR_CONTRIBUTION_ID)?.showBreakpointWidget(position.lineNumber, position.column, BreakpointWidgetContext.TRIGGER_POINT);
    }
  }
}
class EditBreakpointAction extends EditorAction {
  constructor() {
    super({
      id: "editor.debug.action.editBreakpoint",
      label: nls.localize("EditBreakpointEditorAction", "Debug: Edit Breakpoint"),
      alias: "Debug: Edit Existing Breakpoint",
      precondition: CONTEXT_DEBUGGERS_AVAILABLE,
      menuOpts: {
        menuId: MenuId.MenubarNewBreakpointMenu,
        title: nls.localize({ key: "miEditBreakpoint", comment: ["&& denotes a mnemonic"] }, "&&Edit Breakpoint"),
        group: "1_breakpoints",
        order: 1,
        when: CONTEXT_DEBUGGERS_AVAILABLE
      }
    });
  }
  async run(accessor, editor) {
    const debugService = accessor.get(IDebugService);
    const position = editor.getPosition();
    const debugModel = debugService.getModel();
    if (!(editor.hasModel() && position)) {
      return;
    }
    const lineBreakpoints = debugModel.getBreakpoints({ lineNumber: position.lineNumber });
    if (lineBreakpoints.length === 0) {
      return;
    }
    const breakpointDistances = lineBreakpoints.map((b) => {
      if (!b.column) {
        return position.column;
      }
      return Math.abs(b.column - position.column);
    });
    const closestBreakpointIndex = breakpointDistances.indexOf(Math.min(...breakpointDistances));
    const closestBreakpoint = lineBreakpoints[closestBreakpointIndex];
    editor.getContribution(BREAKPOINT_EDITOR_CONTRIBUTION_ID)?.showBreakpointWidget(closestBreakpoint.lineNumber, closestBreakpoint.column);
  }
}
const _OpenDisassemblyViewAction = class _OpenDisassemblyViewAction extends Action2 {
  constructor() {
    super({
      id: _OpenDisassemblyViewAction.ID,
      title: {
        ...nls.localize2("openDisassemblyView", "Open Disassembly View"),
        mnemonicTitle: nls.localize({ key: "miDisassemblyView", comment: ["&& denotes a mnemonic"] }, "&&DisassemblyView")
      },
      precondition: CONTEXT_FOCUSED_STACK_FRAME_HAS_INSTRUCTION_POINTER_REFERENCE,
      menu: [
        {
          id: MenuId.EditorContext,
          group: "debug",
          order: 5,
          when: ContextKeyExpr.and(CONTEXT_IN_DEBUG_MODE, PanelFocusContext.toNegated(), CONTEXT_DEBUG_STATE.isEqualTo("stopped"), EditorContextKeys.editorTextFocus, CONTEXT_DISASSEMBLE_REQUEST_SUPPORTED, CONTEXT_LANGUAGE_SUPPORTS_DISASSEMBLE_REQUEST)
        },
        {
          id: MenuId.DebugCallStackContext,
          group: "z_commands",
          order: 50,
          when: ContextKeyExpr.and(CONTEXT_IN_DEBUG_MODE, CONTEXT_DEBUG_STATE.isEqualTo("stopped"), CONTEXT_CALLSTACK_ITEM_TYPE.isEqualTo("stackFrame"), CONTEXT_DISASSEMBLE_REQUEST_SUPPORTED)
        },
        {
          id: MenuId.CommandPalette,
          when: ContextKeyExpr.and(CONTEXT_IN_DEBUG_MODE, CONTEXT_DEBUG_STATE.isEqualTo("stopped"), CONTEXT_DISASSEMBLE_REQUEST_SUPPORTED)
        }
      ]
    });
  }
  run(accessor) {
    const editorService = accessor.get(IEditorService);
    editorService.openEditor(DisassemblyViewInput.instance, { pinned: true, revealIfOpened: true });
  }
};
_OpenDisassemblyViewAction.ID = "debug.action.openDisassemblyView";
let OpenDisassemblyViewAction = _OpenDisassemblyViewAction;
const _ToggleDisassemblyViewSourceCodeAction = class _ToggleDisassemblyViewSourceCodeAction extends Action2 {
  constructor() {
    super({
      id: _ToggleDisassemblyViewSourceCodeAction.ID,
      title: {
        ...nls.localize2("toggleDisassemblyViewSourceCode", "Toggle Source Code in Disassembly View"),
        mnemonicTitle: nls.localize({ key: "mitogglesource", comment: ["&& denotes a mnemonic"] }, "&&ToggleSource")
      },
      metadata: {
        description: nls.localize2("toggleDisassemblyViewSourceCodeDescription", "Shows or hides source code in disassembly")
      },
      f1: true
    });
  }
  run(accessor, editor, ...args) {
    const configService = accessor.get(IConfigurationService);
    if (configService) {
      const value = configService.getValue("debug").disassemblyView.showSourceCode;
      configService.updateValue(_ToggleDisassemblyViewSourceCodeAction.configID, !value);
    }
  }
};
_ToggleDisassemblyViewSourceCodeAction.ID = "debug.action.toggleDisassemblyViewSourceCode";
_ToggleDisassemblyViewSourceCodeAction.configID = "debug.disassemblyView.showSourceCode";
let ToggleDisassemblyViewSourceCodeAction = _ToggleDisassemblyViewSourceCodeAction;
const _RunToCursorAction = class _RunToCursorAction extends EditorAction {
  constructor() {
    super({
      id: _RunToCursorAction.ID,
      label: _RunToCursorAction.LABEL.value,
      alias: "Debug: Run to Cursor",
      precondition: ContextKeyExpr.and(
        CONTEXT_DEBUGGERS_AVAILABLE,
        PanelFocusContext.toNegated(),
        ContextKeyExpr.or(EditorContextKeys.editorTextFocus, CONTEXT_DISASSEMBLY_VIEW_FOCUS),
        ChatContextKeys.inChatSession.negate()
      ),
      contextMenuOpts: {
        group: "debug",
        order: 2,
        when: CONTEXT_IN_DEBUG_MODE
      }
    });
  }
  async run(accessor, editor) {
    const position = editor.getPosition();
    if (!(editor.hasModel() && position)) {
      return;
    }
    const uri = editor.getModel().uri;
    const debugService = accessor.get(IDebugService);
    const viewModel = debugService.getViewModel();
    const uriIdentityService = accessor.get(IUriIdentityService);
    let column = void 0;
    const focusedStackFrame = viewModel.focusedStackFrame;
    if (focusedStackFrame && uriIdentityService.extUri.isEqual(focusedStackFrame.source.uri, uri) && focusedStackFrame.range.startLineNumber === position.lineNumber) {
      column = position.column;
    }
    await debugService.runTo(uri, position.lineNumber, column);
  }
};
_RunToCursorAction.ID = "editor.debug.action.runToCursor";
_RunToCursorAction.LABEL = nls.localize2("runToCursor", "Run to Cursor");
let RunToCursorAction = _RunToCursorAction;
const _SelectionToReplAction = class _SelectionToReplAction extends EditorAction {
  constructor() {
    super({
      id: _SelectionToReplAction.ID,
      label: _SelectionToReplAction.LABEL.value,
      alias: "Debug: Evaluate in Console",
      precondition: ContextKeyExpr.and(
        CONTEXT_IN_DEBUG_MODE,
        EditorContextKeys.editorTextFocus,
        ChatContextKeys.inChatSession.negate()
      ),
      contextMenuOpts: {
        group: "debug",
        order: 0
      }
    });
  }
  async run(accessor, editor) {
    const debugService = accessor.get(IDebugService);
    const viewsService = accessor.get(IViewsService);
    const viewModel = debugService.getViewModel();
    const session = viewModel.focusedSession;
    if (!editor.hasModel() || !session) {
      return;
    }
    const selection = editor.getSelection();
    let text;
    if (selection.isEmpty()) {
      text = editor.getModel().getLineContent(selection.selectionStartLineNumber).trim();
    } else {
      text = editor.getModel().getValueInRange(selection);
    }
    const replView = await viewsService.openView(REPL_VIEW_ID, false);
    replView?.sendReplInput(text);
  }
};
_SelectionToReplAction.ID = "editor.debug.action.selectionToRepl";
_SelectionToReplAction.LABEL = nls.localize2("evaluateInDebugConsole", "Evaluate in Debug Console");
let SelectionToReplAction = _SelectionToReplAction;
const _SelectionToWatchExpressionsAction = class _SelectionToWatchExpressionsAction extends EditorAction {
  constructor() {
    super({
      id: _SelectionToWatchExpressionsAction.ID,
      label: _SelectionToWatchExpressionsAction.LABEL.value,
      alias: "Debug: Add to Watch",
      precondition: ContextKeyExpr.and(
        CONTEXT_IN_DEBUG_MODE,
        EditorContextKeys.editorTextFocus,
        ChatContextKeys.inChatSession.negate()
      ),
      contextMenuOpts: {
        group: "debug",
        order: 1
      }
    });
  }
  async run(accessor, editor) {
    const debugService = accessor.get(IDebugService);
    const viewsService = accessor.get(IViewsService);
    const languageFeaturesService = accessor.get(ILanguageFeaturesService);
    if (!editor.hasModel()) {
      return;
    }
    let expression = void 0;
    const model = editor.getModel();
    const selection = editor.getSelection();
    if (!selection.isEmpty()) {
      expression = model.getValueInRange(selection);
    } else {
      const position = editor.getPosition();
      const evaluatableExpression = await getEvaluatableExpressionAtPosition(languageFeaturesService, model, position);
      if (!evaluatableExpression) {
        return;
      }
      expression = evaluatableExpression.matchingExpression;
    }
    if (!expression) {
      return;
    }
    await viewsService.openView(WATCH_VIEW_ID);
    debugService.addWatchExpression(expression);
  }
};
_SelectionToWatchExpressionsAction.ID = "editor.debug.action.selectionToWatch";
_SelectionToWatchExpressionsAction.LABEL = nls.localize2("addToWatch", "Add to Watch");
let SelectionToWatchExpressionsAction = _SelectionToWatchExpressionsAction;
class ShowDebugHoverAction extends EditorAction {
  constructor() {
    super({
      id: "editor.debug.action.showDebugHover",
      label: nls.localize2("showDebugHover", "Debug: Show Hover"),
      precondition: CONTEXT_IN_DEBUG_MODE,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyI),
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  async run(accessor, editor) {
    const position = editor.getPosition();
    if (!position || !editor.hasModel()) {
      return;
    }
    return editor.getContribution(EDITOR_CONTRIBUTION_ID)?.showHover(position, true);
  }
}
const NO_TARGETS_MESSAGE = nls.localize("editor.debug.action.stepIntoTargets.notAvailable", "Step targets are not available here");
const _StepIntoTargetsAction = class _StepIntoTargetsAction extends EditorAction {
  constructor() {
    super({
      id: _StepIntoTargetsAction.ID,
      label: _StepIntoTargetsAction.LABEL,
      alias: "Debug: Step Into Target",
      precondition: ContextKeyExpr.and(CONTEXT_STEP_INTO_TARGETS_SUPPORTED, CONTEXT_IN_DEBUG_MODE, CONTEXT_DEBUG_STATE.isEqualTo("stopped"), EditorContextKeys.editorTextFocus),
      contextMenuOpts: {
        group: "debug",
        order: 1.5
      }
    });
  }
  async run(accessor, editor) {
    const debugService = accessor.get(IDebugService);
    const contextMenuService = accessor.get(IContextMenuService);
    const uriIdentityService = accessor.get(IUriIdentityService);
    const session = debugService.getViewModel().focusedSession;
    const frame = debugService.getViewModel().focusedStackFrame;
    const selection = editor.getSelection();
    const targetPosition = selection?.getPosition() || frame && { lineNumber: frame.range.startLineNumber, column: frame.range.startColumn };
    if (!session || !frame || !editor.hasModel() || !uriIdentityService.extUri.isEqual(editor.getModel().uri, frame.source.uri)) {
      if (targetPosition) {
        MessageController.get(editor)?.showMessage(NO_TARGETS_MESSAGE, targetPosition);
      }
      return;
    }
    const targets = await session.stepInTargets(frame.frameId);
    if (!targets?.length) {
      MessageController.get(editor)?.showMessage(NO_TARGETS_MESSAGE, targetPosition);
      return;
    }
    if (selection) {
      const positionalTargets = [];
      for (const target of targets) {
        if (target.line) {
          positionalTargets.push({
            start: new Position(target.line, target.column || 1),
            end: target.endLine ? new Position(target.endLine, target.endColumn || 1) : void 0,
            target
          });
        }
      }
      positionalTargets.sort((a, b) => b.start.lineNumber - a.start.lineNumber || b.start.column - a.start.column);
      const needle = selection.getPosition();
      const best = positionalTargets.find((t) => t.end && needle.isBefore(t.end) && t.start.isBeforeOrEqual(needle)) || positionalTargets.find((t) => t.end === void 0 && t.start.isBeforeOrEqual(needle));
      if (best) {
        session.stepIn(frame.thread.threadId, best.target.id);
        return;
      }
    }
    editor.revealLineInCenterIfOutsideViewport(frame.range.startLineNumber);
    const cursorCoords = editor.getScrolledVisiblePosition(targetPosition);
    const editorCoords = getDomNodePagePosition(editor.getDomNode());
    const x = editorCoords.left + cursorCoords.left;
    const y = editorCoords.top + cursorCoords.top + cursorCoords.height;
    contextMenuService.showContextMenu({
      getAnchor: () => ({ x, y }),
      getActions: () => {
        return targets.map((t) => new Action(`stepIntoTarget:${t.id}`, t.label, void 0, true, () => session.stepIn(frame.thread.threadId, t.id)));
      }
    });
  }
};
_StepIntoTargetsAction.ID = "editor.debug.action.stepIntoTargets";
_StepIntoTargetsAction.LABEL = nls.localize({ key: "stepIntoTargets", comment: ["Step Into Targets lets the user step into an exact function he or she is interested in."] }, "Step Into Target");
let StepIntoTargetsAction = _StepIntoTargetsAction;
class GoToBreakpointAction extends EditorAction {
  constructor(isNext, opts) {
    super(opts);
    this.isNext = isNext;
  }
  async run(accessor, editor) {
    const debugService = accessor.get(IDebugService);
    const editorService = accessor.get(IEditorService);
    const uriIdentityService = accessor.get(IUriIdentityService);
    if (editor.hasModel()) {
      const currentUri = editor.getModel().uri;
      const currentLine = editor.getPosition().lineNumber;
      const allEnabledBreakpoints = debugService.getModel().getBreakpoints({ enabledOnly: true });
      let moveBreakpoint = this.isNext ? allEnabledBreakpoints.filter((bp) => uriIdentityService.extUri.isEqual(bp.uri, currentUri) && bp.lineNumber > currentLine).shift() : allEnabledBreakpoints.filter((bp) => uriIdentityService.extUri.isEqual(bp.uri, currentUri) && bp.lineNumber < currentLine).pop();
      if (!moveBreakpoint) {
        moveBreakpoint = this.isNext ? allEnabledBreakpoints.filter((bp) => bp.uri.toString() > currentUri.toString()).shift() : allEnabledBreakpoints.filter((bp) => bp.uri.toString() < currentUri.toString()).pop();
      }
      if (!moveBreakpoint && allEnabledBreakpoints.length) {
        moveBreakpoint = this.isNext ? allEnabledBreakpoints[0] : allEnabledBreakpoints[allEnabledBreakpoints.length - 1];
      }
      if (moveBreakpoint) {
        return openBreakpointSource(moveBreakpoint, false, true, false, debugService, editorService);
      }
    }
  }
}
class GoToNextBreakpointAction extends GoToBreakpointAction {
  constructor() {
    super(true, {
      id: "editor.debug.action.goToNextBreakpoint",
      label: nls.localize2("goToNextBreakpoint", "Debug: Go to Next Breakpoint"),
      precondition: CONTEXT_DEBUGGERS_AVAILABLE
    });
  }
}
class GoToPreviousBreakpointAction extends GoToBreakpointAction {
  constructor() {
    super(false, {
      id: "editor.debug.action.goToPreviousBreakpoint",
      label: nls.localize2("goToPreviousBreakpoint", "Debug: Go to Previous Breakpoint"),
      precondition: CONTEXT_DEBUGGERS_AVAILABLE
    });
  }
}
class CloseExceptionWidgetAction extends EditorAction {
  constructor() {
    super({
      id: "editor.debug.action.closeExceptionWidget",
      label: nls.localize2("closeExceptionWidget", "Close Exception Widget"),
      precondition: CONTEXT_EXCEPTION_WIDGET_VISIBLE,
      kbOpts: {
        primary: KeyCode.Escape,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  async run(_accessor, editor) {
    const contribution = editor.getContribution(EDITOR_CONTRIBUTION_ID);
    contribution?.closeExceptionWidget();
  }
}
registerAction2(OpenDisassemblyViewAction);
registerAction2(ToggleDisassemblyViewSourceCodeAction);
registerAction2(ToggleBreakpointAction);
registerEditorAction(ConditionalBreakpointAction);
registerEditorAction(LogPointAction);
registerEditorAction(TriggerByBreakpointAction);
registerEditorAction(EditBreakpointAction);
registerEditorAction(RunToCursorAction);
registerEditorAction(StepIntoTargetsAction);
registerEditorAction(SelectionToReplAction);
registerEditorAction(SelectionToWatchExpressionsAction);
registerEditorAction(ShowDebugHoverAction);
registerEditorAction(GoToNextBreakpointAction);
registerEditorAction(GoToPreviousBreakpointAction);
registerEditorAction(CloseExceptionWidgetAction);
export {
  RunToCursorAction,
  SelectionToReplAction,
  SelectionToWatchExpressionsAction
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL2RlYnVnRWRpdG9yQWN0aW9ucy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGdldERvbU5vZGVQYWdlUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IEFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgS2V5Q2hvcmQsIEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JBY3Rpb24sIElBY3Rpb25PcHRpb25zLCByZWdpc3RlckVkaXRvckFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvc2VydmljZXMvY29kZUVkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29udGV4dEtleXMgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlcy5qcyc7XG5pbXBvcnQgeyBNZXNzYWdlQ29udHJvbGxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL21lc3NhZ2UvYnJvd3Nlci9tZXNzYWdlQ29udHJvbGxlci5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElMb2NhbGl6ZWRTdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb24vY29tbW9uL2FjdGlvbi5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCBNZW51SWQsIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVVyaUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VyaUlkZW50aXR5L2NvbW1vbi91cmlJZGVudGl0eS5qcyc7XG5pbXBvcnQgeyBQYW5lbEZvY3VzQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250ZXh0a2V5cy5qcyc7XG5pbXBvcnQgeyBDaGF0Q29udGV4dEtleXMgfSBmcm9tICcuLi8uLi9jaGF0L2NvbW1vbi9jaGF0Q29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgb3BlbkJyZWFrcG9pbnRTb3VyY2UgfSBmcm9tICcuL2JyZWFrcG9pbnRzVmlldy5qcyc7XG5pbXBvcnQgeyBEaXNhc3NlbWJseVZpZXcgfSBmcm9tICcuL2Rpc2Fzc2VtYmx5Vmlldy5qcyc7XG5pbXBvcnQgeyBSZXBsIH0gZnJvbSAnLi9yZXBsLmpzJztcbmltcG9ydCB7IEJSRUFLUE9JTlRfRURJVE9SX0NPTlRSSUJVVElPTl9JRCwgQnJlYWtwb2ludFdpZGdldENvbnRleHQsIENPTlRFWFRfQ0FMTFNUQUNLX0lURU1fVFlQRSwgQ09OVEVYVF9ERUJVR19TVEFURSwgQ09OVEVYVF9ERUJVR0dFUlNfQVZBSUxBQkxFLCBDT05URVhUX0RJU0FTU0VNQkxFX1JFUVVFU1RfU1VQUE9SVEVELCBDT05URVhUX0RJU0FTU0VNQkxZX1ZJRVdfRk9DVVMsIENPTlRFWFRfRVhDRVBUSU9OX1dJREdFVF9WSVNJQkxFLCBDT05URVhUX0ZPQ1VTRURfU1RBQ0tfRlJBTUVfSEFTX0lOU1RSVUNUSU9OX1BPSU5URVJfUkVGRVJFTkNFLCBDT05URVhUX0lOX0RFQlVHX01PREUsIENPTlRFWFRfTEFOR1VBR0VfU1VQUE9SVFNfRElTQVNTRU1CTEVfUkVRVUVTVCwgQ09OVEVYVF9TVEVQX0lOVE9fVEFSR0VUU19TVVBQT1JURUQsIEVESVRPUl9DT05UUklCVVRJT05fSUQsIElCcmVha3BvaW50RWRpdG9yQ29udHJpYnV0aW9uLCBJRGVidWdDb25maWd1cmF0aW9uLCBJRGVidWdFZGl0b3JDb250cmlidXRpb24sIElEZWJ1Z1NlcnZpY2UsIFJFUExfVklFV19JRCwgV0FUQ0hfVklFV19JRCB9IGZyb20gJy4uL2NvbW1vbi9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBnZXRFdmFsdWF0YWJsZUV4cHJlc3Npb25BdFBvc2l0aW9uIH0gZnJvbSAnLi4vY29tbW9uL2RlYnVnVXRpbHMuanMnO1xuaW1wb3J0IHsgRGlzYXNzZW1ibHlWaWV3SW5wdXQgfSBmcm9tICcuLi9jb21tb24vZGlzYXNzZW1ibHlWaWV3SW5wdXQuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVZpZXdzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3ZpZXdzL2NvbW1vbi92aWV3c1NlcnZpY2UuanMnO1xuXG5jbGFzcyBUb2dnbGVCcmVha3BvaW50QWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZWRpdG9yLmRlYnVnLmFjdGlvbi50b2dnbGVCcmVha3BvaW50Jyxcblx0XHRcdHRpdGxlOiB7XG5cdFx0XHRcdC4uLm5scy5sb2NhbGl6ZTIoJ3RvZ2dsZUJyZWFrcG9pbnRBY3Rpb24nLCBcIkRlYnVnOiBUb2dnbGUgQnJlYWtwb2ludFwiKSxcblx0XHRcdFx0bW5lbW9uaWNUaXRsZTogbmxzLmxvY2FsaXplKHsga2V5OiAnbWlUb2dnbGVCcmVha3BvaW50JywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIlRvZ2dsZSAmJkJyZWFrcG9pbnRcIiksXG5cdFx0XHR9LFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRwcmVjb25kaXRpb246IENPTlRFWFRfREVCVUdHRVJTX0FWQUlMQUJMRSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIub3IoRWRpdG9yQ29udGV4dEtleXMuZWRpdG9yVGV4dEZvY3VzLCBDT05URVhUX0RJU0FTU0VNQkxZX1ZJRVdfRk9DVVMpLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlDb2RlLkY5LFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5NZW51YmFyRGVidWdNZW51LFxuXHRcdFx0XHR3aGVuOiBDT05URVhUX0RFQlVHR0VSU19BVkFJTEFCTEUsXG5cdFx0XHRcdGdyb3VwOiAnNF9uZXdfYnJlYWtwb2ludCcsXG5cdFx0XHRcdG9yZGVyOiAxXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRjb25zdCBkZWJ1Z1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSURlYnVnU2VydmljZSk7XG5cblx0XHRjb25zdCBhY3RpdmVQYW5lID0gZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3JQYW5lO1xuXHRcdGlmIChhY3RpdmVQYW5lIGluc3RhbmNlb2YgRGlzYXNzZW1ibHlWaWV3KSB7XG5cdFx0XHRjb25zdCBsb2NhdGlvbiA9IGFjdGl2ZVBhbmUuZm9jdXNlZEFkZHJlc3NBbmRPZmZzZXQ7XG5cdFx0XHRpZiAobG9jYXRpb24pIHtcblx0XHRcdFx0Y29uc3QgYnBzID0gZGVidWdTZXJ2aWNlLmdldE1vZGVsKCkuZ2V0SW5zdHJ1Y3Rpb25CcmVha3BvaW50cygpO1xuXHRcdFx0XHRjb25zdCB0b1JlbW92ZSA9IGJwcy5maW5kKGJwID0+IGJwLmFkZHJlc3MgPT09IGxvY2F0aW9uLmFkZHJlc3MpO1xuXHRcdFx0XHRpZiAodG9SZW1vdmUpIHtcblx0XHRcdFx0XHRkZWJ1Z1NlcnZpY2UucmVtb3ZlSW5zdHJ1Y3Rpb25CcmVha3BvaW50cyh0b1JlbW92ZS5pbnN0cnVjdGlvblJlZmVyZW5jZSwgdG9SZW1vdmUub2Zmc2V0KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRkZWJ1Z1NlcnZpY2UuYWRkSW5zdHJ1Y3Rpb25CcmVha3BvaW50KHsgaW5zdHJ1Y3Rpb25SZWZlcmVuY2U6IGxvY2F0aW9uLnJlZmVyZW5jZSwgb2Zmc2V0OiBsb2NhdGlvbi5vZmZzZXQsIGFkZHJlc3M6IGxvY2F0aW9uLmFkZHJlc3MsIGNhblBlcnNpc3Q6IGZhbHNlIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29kZUVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvZGVFZGl0b3JTZXJ2aWNlKTtcblx0XHRjb25zdCBlZGl0b3IgPSBjb2RlRWRpdG9yU2VydmljZS5nZXRGb2N1c2VkQ29kZUVkaXRvcigpIHx8IGNvZGVFZGl0b3JTZXJ2aWNlLmdldEFjdGl2ZUNvZGVFZGl0b3IoKTtcblx0XHRpZiAoZWRpdG9yPy5oYXNNb2RlbCgpKSB7XG5cdFx0XHRjb25zdCBtb2RlbFVyaSA9IGVkaXRvci5nZXRNb2RlbCgpLnVyaTtcblx0XHRcdGNvbnN0IGNhblNldCA9IGRlYnVnU2VydmljZS5jYW5TZXRCcmVha3BvaW50c0luKGVkaXRvci5nZXRNb2RlbCgpKTtcblx0XHRcdC8vIERvZXMgbm90IGFjY291bnQgZm9yIG11bHRpIGxpbmUgc2VsZWN0aW9ucywgU2V0IHRvIHJlbW92ZSBtdWx0aXBsZSBjdXJzb3Igb24gdGhlIHNhbWUgbGluZVxuXHRcdFx0Y29uc3QgbGluZU51bWJlcnMgPSBbLi4ubmV3IFNldChlZGl0b3IuZ2V0U2VsZWN0aW9ucygpLm1hcChzID0+IHMuZ2V0UG9zaXRpb24oKS5saW5lTnVtYmVyKSldO1xuXG5cdFx0XHRhd2FpdCBQcm9taXNlLmFsbChsaW5lTnVtYmVycy5tYXAoYXN5bmMgbGluZSA9PiB7XG5cdFx0XHRcdGNvbnN0IGJwcyA9IGRlYnVnU2VydmljZS5nZXRNb2RlbCgpLmdldEJyZWFrcG9pbnRzKHsgbGluZU51bWJlcjogbGluZSwgdXJpOiBtb2RlbFVyaSB9KTtcblx0XHRcdFx0aWYgKGJwcy5sZW5ndGgpIHtcblx0XHRcdFx0XHRhd2FpdCBQcm9taXNlLmFsbChicHMubWFwKGJwID0+IGRlYnVnU2VydmljZS5yZW1vdmVCcmVha3BvaW50cyhicC5nZXRJZCgpKSkpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGNhblNldCkge1xuXHRcdFx0XHRcdGF3YWl0IGRlYnVnU2VydmljZS5hZGRCcmVha3BvaW50cyhtb2RlbFVyaSwgW3sgbGluZU51bWJlcjogbGluZSB9XSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgQ29uZGl0aW9uYWxCcmVha3BvaW50QWN0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdlZGl0b3IuZGVidWcuYWN0aW9uLmNvbmRpdGlvbmFsQnJlYWtwb2ludCcsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignY29uZGl0aW9uYWxCcmVha3BvaW50RWRpdG9yQWN0aW9uJywgXCJEZWJ1ZzogQWRkIENvbmRpdGlvbmFsIEJyZWFrcG9pbnQuLi5cIiksXG5cdFx0XHRwcmVjb25kaXRpb246IENPTlRFWFRfREVCVUdHRVJTX0FWQUlMQUJMRSxcblx0XHRcdG1lbnVPcHRzOiB7XG5cdFx0XHRcdG1lbnVJZDogTWVudUlkLk1lbnViYXJOZXdCcmVha3BvaW50TWVudSxcblx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSh7IGtleTogJ21pQ29uZGl0aW9uYWxCcmVha3BvaW50JywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmQ29uZGl0aW9uYWwgQnJlYWtwb2ludC4uLlwiKSxcblx0XHRcdFx0Z3JvdXA6ICcxX2JyZWFrcG9pbnRzJyxcblx0XHRcdFx0b3JkZXI6IDEsXG5cdFx0XHRcdHdoZW46IENPTlRFWFRfREVCVUdHRVJTX0FWQUlMQUJMRVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZGVidWdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEZWJ1Z1NlcnZpY2UpO1xuXG5cdFx0Y29uc3QgcG9zaXRpb24gPSBlZGl0b3IuZ2V0UG9zaXRpb24oKTtcblx0XHRpZiAocG9zaXRpb24gJiYgZWRpdG9yLmhhc01vZGVsKCkgJiYgZGVidWdTZXJ2aWNlLmNhblNldEJyZWFrcG9pbnRzSW4oZWRpdG9yLmdldE1vZGVsKCkpKSB7XG5cdFx0XHRlZGl0b3IuZ2V0Q29udHJpYnV0aW9uPElCcmVha3BvaW50RWRpdG9yQ29udHJpYnV0aW9uPihCUkVBS1BPSU5UX0VESVRPUl9DT05UUklCVVRJT05fSUQpPy5zaG93QnJlYWtwb2ludFdpZGdldChwb3NpdGlvbi5saW5lTnVtYmVyLCB1bmRlZmluZWQsIEJyZWFrcG9pbnRXaWRnZXRDb250ZXh0LkNPTkRJVElPTik7XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIExvZ1BvaW50QWN0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2VkaXRvci5kZWJ1Zy5hY3Rpb24uYWRkTG9nUG9pbnQnLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ2xvZ1BvaW50RWRpdG9yQWN0aW9uJywgXCJEZWJ1ZzogQWRkIExvZ3BvaW50Li4uXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDT05URVhUX0RFQlVHR0VSU19BVkFJTEFCTEUsXG5cdFx0XHRtZW51T3B0czogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bWVudUlkOiBNZW51SWQuTWVudWJhck5ld0JyZWFrcG9pbnRNZW51LFxuXHRcdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUoeyBrZXk6ICdtaUxvZ1BvaW50JywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmTG9ncG9pbnQuLi5cIiksXG5cdFx0XHRcdFx0Z3JvdXA6ICcxX2JyZWFrcG9pbnRzJyxcblx0XHRcdFx0XHRvcmRlcjogNCxcblx0XHRcdFx0XHR3aGVuOiBDT05URVhUX0RFQlVHR0VSU19BVkFJTEFCTEUsXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGRlYnVnU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGVidWdTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IHBvc2l0aW9uID0gZWRpdG9yLmdldFBvc2l0aW9uKCk7XG5cdFx0aWYgKHBvc2l0aW9uICYmIGVkaXRvci5oYXNNb2RlbCgpICYmIGRlYnVnU2VydmljZS5jYW5TZXRCcmVha3BvaW50c0luKGVkaXRvci5nZXRNb2RlbCgpKSkge1xuXHRcdFx0ZWRpdG9yLmdldENvbnRyaWJ1dGlvbjxJQnJlYWtwb2ludEVkaXRvckNvbnRyaWJ1dGlvbj4oQlJFQUtQT0lOVF9FRElUT1JfQ09OVFJJQlVUSU9OX0lEKT8uc2hvd0JyZWFrcG9pbnRXaWRnZXQocG9zaXRpb24ubGluZU51bWJlciwgcG9zaXRpb24uY29sdW1uLCBCcmVha3BvaW50V2lkZ2V0Q29udGV4dC5MT0dfTUVTU0FHRSk7XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIFRyaWdnZXJCeUJyZWFrcG9pbnRBY3Rpb24gZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZWRpdG9yLmRlYnVnLmFjdGlvbi50cmlnZ2VyQnlCcmVha3BvaW50Jyxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ3RyaWdnZXJCeUJyZWFrcG9pbnRFZGl0b3JBY3Rpb24nLCBcIkRlYnVnOiBBZGQgVHJpZ2dlcmVkIEJyZWFrcG9pbnQuLi5cIiksXG5cdFx0XHRwcmVjb25kaXRpb246IENPTlRFWFRfREVCVUdHRVJTX0FWQUlMQUJMRSxcblx0XHRcdGFsaWFzOiAnRGVidWc6IFRyaWdnZXJlZCBCcmVha3BvaW50Li4uJyxcblx0XHRcdG1lbnVPcHRzOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRtZW51SWQ6IE1lbnVJZC5NZW51YmFyTmV3QnJlYWtwb2ludE1lbnUsXG5cdFx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSh7IGtleTogJ21pVHJpZ2dlckJ5QnJlYWtwb2ludCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJlRyaWdnZXJlZCBCcmVha3BvaW50Li4uXCIpLFxuXHRcdFx0XHRcdGdyb3VwOiAnMV9icmVha3BvaW50cycsXG5cdFx0XHRcdFx0b3JkZXI6IDQsXG5cdFx0XHRcdFx0d2hlbjogQ09OVEVYVF9ERUJVR0dFUlNfQVZBSUxBQkxFLFxuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBkZWJ1Z1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSURlYnVnU2VydmljZSk7XG5cblx0XHRjb25zdCBwb3NpdGlvbiA9IGVkaXRvci5nZXRQb3NpdGlvbigpO1xuXHRcdGlmIChwb3NpdGlvbiAmJiBlZGl0b3IuaGFzTW9kZWwoKSAmJiBkZWJ1Z1NlcnZpY2UuY2FuU2V0QnJlYWtwb2ludHNJbihlZGl0b3IuZ2V0TW9kZWwoKSkpIHtcblx0XHRcdGVkaXRvci5nZXRDb250cmlidXRpb248SUJyZWFrcG9pbnRFZGl0b3JDb250cmlidXRpb24+KEJSRUFLUE9JTlRfRURJVE9SX0NPTlRSSUJVVElPTl9JRCk/LnNob3dCcmVha3BvaW50V2lkZ2V0KHBvc2l0aW9uLmxpbmVOdW1iZXIsIHBvc2l0aW9uLmNvbHVtbiwgQnJlYWtwb2ludFdpZGdldENvbnRleHQuVFJJR0dFUl9QT0lOVCk7XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIEVkaXRCcmVha3BvaW50QWN0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdlZGl0b3IuZGVidWcuYWN0aW9uLmVkaXRCcmVha3BvaW50Jyxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ0VkaXRCcmVha3BvaW50RWRpdG9yQWN0aW9uJywgXCJEZWJ1ZzogRWRpdCBCcmVha3BvaW50XCIpLFxuXHRcdFx0YWxpYXM6ICdEZWJ1ZzogRWRpdCBFeGlzdGluZyBCcmVha3BvaW50Jyxcblx0XHRcdHByZWNvbmRpdGlvbjogQ09OVEVYVF9ERUJVR0dFUlNfQVZBSUxBQkxFLFxuXHRcdFx0bWVudU9wdHM6IHtcblx0XHRcdFx0bWVudUlkOiBNZW51SWQuTWVudWJhck5ld0JyZWFrcG9pbnRNZW51LFxuXHRcdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplKHsga2V5OiAnbWlFZGl0QnJlYWtwb2ludCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJkVkaXQgQnJlYWtwb2ludFwiKSxcblx0XHRcdFx0Z3JvdXA6ICcxX2JyZWFrcG9pbnRzJyxcblx0XHRcdFx0b3JkZXI6IDEsXG5cdFx0XHRcdHdoZW46IENPTlRFWFRfREVCVUdHRVJTX0FWQUlMQUJMRVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZGVidWdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEZWJ1Z1NlcnZpY2UpO1xuXG5cdFx0Y29uc3QgcG9zaXRpb24gPSBlZGl0b3IuZ2V0UG9zaXRpb24oKTtcblx0XHRjb25zdCBkZWJ1Z01vZGVsID0gZGVidWdTZXJ2aWNlLmdldE1vZGVsKCk7XG5cdFx0aWYgKCEoZWRpdG9yLmhhc01vZGVsKCkgJiYgcG9zaXRpb24pKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGluZUJyZWFrcG9pbnRzID0gZGVidWdNb2RlbC5nZXRCcmVha3BvaW50cyh7IGxpbmVOdW1iZXI6IHBvc2l0aW9uLmxpbmVOdW1iZXIgfSk7XG5cdFx0aWYgKGxpbmVCcmVha3BvaW50cy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBicmVha3BvaW50RGlzdGFuY2VzID0gbGluZUJyZWFrcG9pbnRzLm1hcChiID0+IHtcblx0XHRcdGlmICghYi5jb2x1bW4pIHtcblx0XHRcdFx0cmV0dXJuIHBvc2l0aW9uLmNvbHVtbjtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIE1hdGguYWJzKGIuY29sdW1uIC0gcG9zaXRpb24uY29sdW1uKTtcblx0XHR9KTtcblx0XHRjb25zdCBjbG9zZXN0QnJlYWtwb2ludEluZGV4ID0gYnJlYWtwb2ludERpc3RhbmNlcy5pbmRleE9mKE1hdGgubWluKC4uLmJyZWFrcG9pbnREaXN0YW5jZXMpKTtcblx0XHRjb25zdCBjbG9zZXN0QnJlYWtwb2ludCA9IGxpbmVCcmVha3BvaW50c1tjbG9zZXN0QnJlYWtwb2ludEluZGV4XTtcblxuXHRcdGVkaXRvci5nZXRDb250cmlidXRpb248SUJyZWFrcG9pbnRFZGl0b3JDb250cmlidXRpb24+KEJSRUFLUE9JTlRfRURJVE9SX0NPTlRSSUJVVElPTl9JRCk/LnNob3dCcmVha3BvaW50V2lkZ2V0KGNsb3Nlc3RCcmVha3BvaW50LmxpbmVOdW1iZXIsIGNsb3Nlc3RCcmVha3BvaW50LmNvbHVtbik7XG5cdH1cbn1cblxuY2xhc3MgT3BlbkRpc2Fzc2VtYmx5Vmlld0FjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgSUQgPSAnZGVidWcuYWN0aW9uLm9wZW5EaXNhc3NlbWJseVZpZXcnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBPcGVuRGlzYXNzZW1ibHlWaWV3QWN0aW9uLklELFxuXHRcdFx0dGl0bGU6IHtcblx0XHRcdFx0Li4ubmxzLmxvY2FsaXplMignb3BlbkRpc2Fzc2VtYmx5VmlldycsIFwiT3BlbiBEaXNhc3NlbWJseSBWaWV3XCIpLFxuXHRcdFx0XHRtbmVtb25pY1RpdGxlOiBubHMubG9jYWxpemUoeyBrZXk6ICdtaURpc2Fzc2VtYmx5VmlldycsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJkRpc2Fzc2VtYmx5Vmlld1wiKSxcblx0XHRcdH0sXG5cdFx0XHRwcmVjb25kaXRpb246IENPTlRFWFRfRk9DVVNFRF9TVEFDS19GUkFNRV9IQVNfSU5TVFJVQ1RJT05fUE9JTlRFUl9SRUZFUkVOQ0UsXG5cdFx0XHRtZW51OiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogTWVudUlkLkVkaXRvckNvbnRleHQsXG5cdFx0XHRcdFx0Z3JvdXA6ICdkZWJ1ZycsXG5cdFx0XHRcdFx0b3JkZXI6IDUsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENPTlRFWFRfSU5fREVCVUdfTU9ERSwgUGFuZWxGb2N1c0NvbnRleHQudG9OZWdhdGVkKCksIENPTlRFWFRfREVCVUdfU1RBVEUuaXNFcXVhbFRvKCdzdG9wcGVkJyksIEVkaXRvckNvbnRleHRLZXlzLmVkaXRvclRleHRGb2N1cywgQ09OVEVYVF9ESVNBU1NFTUJMRV9SRVFVRVNUX1NVUFBPUlRFRCwgQ09OVEVYVF9MQU5HVUFHRV9TVVBQT1JUU19ESVNBU1NFTUJMRV9SRVFVRVNUKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5EZWJ1Z0NhbGxTdGFja0NvbnRleHQsXG5cdFx0XHRcdFx0Z3JvdXA6ICd6X2NvbW1hbmRzJyxcblx0XHRcdFx0XHRvcmRlcjogNTAsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENPTlRFWFRfSU5fREVCVUdfTU9ERSwgQ09OVEVYVF9ERUJVR19TVEFURS5pc0VxdWFsVG8oJ3N0b3BwZWQnKSwgQ09OVEVYVF9DQUxMU1RBQ0tfSVRFTV9UWVBFLmlzRXF1YWxUbygnc3RhY2tGcmFtZScpLCBDT05URVhUX0RJU0FTU0VNQkxFX1JFUVVFU1RfU1VQUE9SVEVEKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ09OVEVYVF9JTl9ERUJVR19NT0RFLCBDT05URVhUX0RFQlVHX1NUQVRFLmlzRXF1YWxUbygnc3RvcHBlZCcpLCBDT05URVhUX0RJU0FTU0VNQkxFX1JFUVVFU1RfU1VQUE9SVEVEKVxuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fSk7XG5cdH1cblxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiB2b2lkIHtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRlZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3IoRGlzYXNzZW1ibHlWaWV3SW5wdXQuaW5zdGFuY2UsIHsgcGlubmVkOiB0cnVlLCByZXZlYWxJZk9wZW5lZDogdHJ1ZSB9KTtcblx0fVxufVxuXG5jbGFzcyBUb2dnbGVEaXNhc3NlbWJseVZpZXdTb3VyY2VDb2RlQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0cHVibGljIHN0YXRpYyByZWFkb25seSBJRCA9ICdkZWJ1Zy5hY3Rpb24udG9nZ2xlRGlzYXNzZW1ibHlWaWV3U291cmNlQ29kZSc7XG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgY29uZmlnSUQ6IHN0cmluZyA9ICdkZWJ1Zy5kaXNhc3NlbWJseVZpZXcuc2hvd1NvdXJjZUNvZGUnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBUb2dnbGVEaXNhc3NlbWJseVZpZXdTb3VyY2VDb2RlQWN0aW9uLklELFxuXHRcdFx0dGl0bGU6IHtcblx0XHRcdFx0Li4ubmxzLmxvY2FsaXplMigndG9nZ2xlRGlzYXNzZW1ibHlWaWV3U291cmNlQ29kZScsIFwiVG9nZ2xlIFNvdXJjZSBDb2RlIGluIERpc2Fzc2VtYmx5IFZpZXdcIiksXG5cdFx0XHRcdG1uZW1vbmljVGl0bGU6IG5scy5sb2NhbGl6ZSh7IGtleTogJ21pdG9nZ2xlc291cmNlJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmVG9nZ2xlU291cmNlXCIpLFxuXHRcdFx0fSxcblx0XHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUyKCd0b2dnbGVEaXNhc3NlbWJseVZpZXdTb3VyY2VDb2RlRGVzY3JpcHRpb24nLCAnU2hvd3Mgb3IgaGlkZXMgc291cmNlIGNvZGUgaW4gZGlzYXNzZW1ibHknKVxuXHRcdFx0fSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdH0pO1xuXHR9XG5cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yLCAuLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xuXHRcdGNvbnN0IGNvbmZpZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRpZiAoY29uZmlnU2VydmljZSkge1xuXHRcdFx0Y29uc3QgdmFsdWUgPSBjb25maWdTZXJ2aWNlLmdldFZhbHVlPElEZWJ1Z0NvbmZpZ3VyYXRpb24+KCdkZWJ1ZycpLmRpc2Fzc2VtYmx5Vmlldy5zaG93U291cmNlQ29kZTtcblx0XHRcdGNvbmZpZ1NlcnZpY2UudXBkYXRlVmFsdWUoVG9nZ2xlRGlzYXNzZW1ibHlWaWV3U291cmNlQ29kZUFjdGlvbi5jb25maWdJRCwgIXZhbHVlKTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFJ1blRvQ3Vyc29yQWN0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblxuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IElEID0gJ2VkaXRvci5kZWJ1Zy5hY3Rpb24ucnVuVG9DdXJzb3InO1xuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IExBQkVMOiBJTG9jYWxpemVkU3RyaW5nID0gbmxzLmxvY2FsaXplMigncnVuVG9DdXJzb3InLCBcIlJ1biB0byBDdXJzb3JcIik7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFJ1blRvQ3Vyc29yQWN0aW9uLklELFxuXHRcdFx0bGFiZWw6IFJ1blRvQ3Vyc29yQWN0aW9uLkxBQkVMLnZhbHVlLFxuXHRcdFx0YWxpYXM6ICdEZWJ1ZzogUnVuIHRvIEN1cnNvcicsXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0Q09OVEVYVF9ERUJVR0dFUlNfQVZBSUxBQkxFLFxuXHRcdFx0XHRQYW5lbEZvY3VzQ29udGV4dC50b05lZ2F0ZWQoKSxcblx0XHRcdFx0Q29udGV4dEtleUV4cHIub3IoRWRpdG9yQ29udGV4dEtleXMuZWRpdG9yVGV4dEZvY3VzLCBDT05URVhUX0RJU0FTU0VNQkxZX1ZJRVdfRk9DVVMpLFxuXHRcdFx0XHRDaGF0Q29udGV4dEtleXMuaW5DaGF0U2Vzc2lvbi5uZWdhdGUoKVxuXHRcdFx0KSxcblx0XHRcdGNvbnRleHRNZW51T3B0czoge1xuXHRcdFx0XHRncm91cDogJ2RlYnVnJyxcblx0XHRcdFx0b3JkZXI6IDIsXG5cdFx0XHRcdHdoZW46IENPTlRFWFRfSU5fREVCVUdfTU9ERVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcG9zaXRpb24gPSBlZGl0b3IuZ2V0UG9zaXRpb24oKTtcblx0XHRpZiAoIShlZGl0b3IuaGFzTW9kZWwoKSAmJiBwb3NpdGlvbikpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgdXJpID0gZWRpdG9yLmdldE1vZGVsKCkudXJpO1xuXG5cdFx0Y29uc3QgZGVidWdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEZWJ1Z1NlcnZpY2UpO1xuXHRcdGNvbnN0IHZpZXdNb2RlbCA9IGRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKTtcblx0XHRjb25zdCB1cmlJZGVudGl0eVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVVyaUlkZW50aXR5U2VydmljZSk7XG5cblx0XHRsZXQgY29sdW1uOiBudW1iZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgZm9jdXNlZFN0YWNrRnJhbWUgPSB2aWV3TW9kZWwuZm9jdXNlZFN0YWNrRnJhbWU7XG5cdFx0aWYgKGZvY3VzZWRTdGFja0ZyYW1lICYmIHVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbChmb2N1c2VkU3RhY2tGcmFtZS5zb3VyY2UudXJpLCB1cmkpICYmIGZvY3VzZWRTdGFja0ZyYW1lLnJhbmdlLnN0YXJ0TGluZU51bWJlciA9PT0gcG9zaXRpb24ubGluZU51bWJlcikge1xuXHRcdFx0Ly8gSWYgdGhlIGN1cnNvciBpcyBvbiBhIGxpbmUgZGlmZmVyZW50IHRoYW4gdGhlIG9uZSB0aGUgZGVidWdnZXIgaXMgY3VycmVudGx5IHBhdXNlZCBvbiwgdGhlbiBzZW5kIHRoZSBicmVha3BvaW50IG9uIHRoZSBsaW5lIHdpdGhvdXQgYSBjb2x1bW5cblx0XHRcdC8vIG90aGVyd2lzZSBzZXQgaXQgYXQgdGhlIHByZWNpc2UgY29sdW1uICMxMDIxOTlcblx0XHRcdGNvbHVtbiA9IHBvc2l0aW9uLmNvbHVtbjtcblx0XHR9XG5cdFx0YXdhaXQgZGVidWdTZXJ2aWNlLnJ1blRvKHVyaSwgcG9zaXRpb24ubGluZU51bWJlciwgY29sdW1uKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU2VsZWN0aW9uVG9SZXBsQWN0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblxuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IElEID0gJ2VkaXRvci5kZWJ1Zy5hY3Rpb24uc2VsZWN0aW9uVG9SZXBsJztcblx0cHVibGljIHN0YXRpYyByZWFkb25seSBMQUJFTDogSUxvY2FsaXplZFN0cmluZyA9IG5scy5sb2NhbGl6ZTIoJ2V2YWx1YXRlSW5EZWJ1Z0NvbnNvbGUnLCBcIkV2YWx1YXRlIGluIERlYnVnIENvbnNvbGVcIik7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFNlbGVjdGlvblRvUmVwbEFjdGlvbi5JRCxcblx0XHRcdGxhYmVsOiBTZWxlY3Rpb25Ub1JlcGxBY3Rpb24uTEFCRUwudmFsdWUsXG5cdFx0XHRhbGlhczogJ0RlYnVnOiBFdmFsdWF0ZSBpbiBDb25zb2xlJyxcblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRDT05URVhUX0lOX0RFQlVHX01PREUsXG5cdFx0XHRcdEVkaXRvckNvbnRleHRLZXlzLmVkaXRvclRleHRGb2N1cyxcblx0XHRcdFx0Q2hhdENvbnRleHRLZXlzLmluQ2hhdFNlc3Npb24ubmVnYXRlKCkpLFxuXHRcdFx0Y29udGV4dE1lbnVPcHRzOiB7XG5cdFx0XHRcdGdyb3VwOiAnZGVidWcnLFxuXHRcdFx0XHRvcmRlcjogMFxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZGVidWdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEZWJ1Z1NlcnZpY2UpO1xuXHRcdGNvbnN0IHZpZXdzU2VydmljZSA9IGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKTtcblx0XHRjb25zdCB2aWV3TW9kZWwgPSBkZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCk7XG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IHZpZXdNb2RlbC5mb2N1c2VkU2Vzc2lvbjtcblx0XHRpZiAoIWVkaXRvci5oYXNNb2RlbCgpIHx8ICFzZXNzaW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2VsZWN0aW9uID0gZWRpdG9yLmdldFNlbGVjdGlvbigpO1xuXHRcdGxldCB0ZXh0OiBzdHJpbmc7XG5cdFx0aWYgKHNlbGVjdGlvbi5pc0VtcHR5KCkpIHtcblx0XHRcdHRleHQgPSBlZGl0b3IuZ2V0TW9kZWwoKS5nZXRMaW5lQ29udGVudChzZWxlY3Rpb24uc2VsZWN0aW9uU3RhcnRMaW5lTnVtYmVyKS50cmltKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRleHQgPSBlZGl0b3IuZ2V0TW9kZWwoKS5nZXRWYWx1ZUluUmFuZ2Uoc2VsZWN0aW9uKTtcblx0XHR9XG5cblx0XHRjb25zdCByZXBsVmlldyA9IGF3YWl0IHZpZXdzU2VydmljZS5vcGVuVmlldyhSRVBMX1ZJRVdfSUQsIGZhbHNlKSBhcyBSZXBsIHwgdW5kZWZpbmVkO1xuXHRcdHJlcGxWaWV3Py5zZW5kUmVwbElucHV0KHRleHQpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTZWxlY3Rpb25Ub1dhdGNoRXhwcmVzc2lvbnNBY3Rpb24gZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgSUQgPSAnZWRpdG9yLmRlYnVnLmFjdGlvbi5zZWxlY3Rpb25Ub1dhdGNoJztcblx0cHVibGljIHN0YXRpYyByZWFkb25seSBMQUJFTDogSUxvY2FsaXplZFN0cmluZyA9IG5scy5sb2NhbGl6ZTIoJ2FkZFRvV2F0Y2gnLCBcIkFkZCB0byBXYXRjaFwiKTtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogU2VsZWN0aW9uVG9XYXRjaEV4cHJlc3Npb25zQWN0aW9uLklELFxuXHRcdFx0bGFiZWw6IFNlbGVjdGlvblRvV2F0Y2hFeHByZXNzaW9uc0FjdGlvbi5MQUJFTC52YWx1ZSxcblx0XHRcdGFsaWFzOiAnRGVidWc6IEFkZCB0byBXYXRjaCcsXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0Q09OVEVYVF9JTl9ERUJVR19NT0RFLFxuXHRcdFx0XHRFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsXG5cdFx0XHRcdENoYXRDb250ZXh0S2V5cy5pbkNoYXRTZXNzaW9uLm5lZ2F0ZSgpKSxcblx0XHRcdGNvbnRleHRNZW51T3B0czoge1xuXHRcdFx0XHRncm91cDogJ2RlYnVnJyxcblx0XHRcdFx0b3JkZXI6IDFcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGRlYnVnU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGVidWdTZXJ2aWNlKTtcblx0XHRjb25zdCB2aWV3c1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVZpZXdzU2VydmljZSk7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlKTtcblx0XHRpZiAoIWVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bGV0IGV4cHJlc3Npb246IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0Y29uc3Qgc2VsZWN0aW9uID0gZWRpdG9yLmdldFNlbGVjdGlvbigpO1xuXG5cdFx0aWYgKCFzZWxlY3Rpb24uaXNFbXB0eSgpKSB7XG5cdFx0XHRleHByZXNzaW9uID0gbW9kZWwuZ2V0VmFsdWVJblJhbmdlKHNlbGVjdGlvbik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IHBvc2l0aW9uID0gZWRpdG9yLmdldFBvc2l0aW9uKCk7XG5cdFx0XHRjb25zdCBldmFsdWF0YWJsZUV4cHJlc3Npb24gPSBhd2FpdCBnZXRFdmFsdWF0YWJsZUV4cHJlc3Npb25BdFBvc2l0aW9uKGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLCBtb2RlbCwgcG9zaXRpb24pO1xuXHRcdFx0aWYgKCFldmFsdWF0YWJsZUV4cHJlc3Npb24pIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0ZXhwcmVzc2lvbiA9IGV2YWx1YXRhYmxlRXhwcmVzc2lvbi5tYXRjaGluZ0V4cHJlc3Npb247XG5cdFx0fVxuXG5cdFx0aWYgKCFleHByZXNzaW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0YXdhaXQgdmlld3NTZXJ2aWNlLm9wZW5WaWV3KFdBVENIX1ZJRVdfSUQpO1xuXHRcdGRlYnVnU2VydmljZS5hZGRXYXRjaEV4cHJlc3Npb24oZXhwcmVzc2lvbik7XG5cdH1cbn1cblxuY2xhc3MgU2hvd0RlYnVnSG92ZXJBY3Rpb24gZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZWRpdG9yLmRlYnVnLmFjdGlvbi5zaG93RGVidWdIb3ZlcicsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignc2hvd0RlYnVnSG92ZXInLCBcIkRlYnVnOiBTaG93IEhvdmVyXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDT05URVhUX0lOX0RFQlVHX01PREUsXG5cdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SSksXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBwb3NpdGlvbiA9IGVkaXRvci5nZXRQb3NpdGlvbigpO1xuXHRcdGlmICghcG9zaXRpb24gfHwgIWVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGVkaXRvci5nZXRDb250cmlidXRpb248SURlYnVnRWRpdG9yQ29udHJpYnV0aW9uPihFRElUT1JfQ09OVFJJQlVUSU9OX0lEKT8uc2hvd0hvdmVyKHBvc2l0aW9uLCB0cnVlKTtcblx0fVxufVxuXG5jb25zdCBOT19UQVJHRVRTX01FU1NBR0UgPSBubHMubG9jYWxpemUoJ2VkaXRvci5kZWJ1Zy5hY3Rpb24uc3RlcEludG9UYXJnZXRzLm5vdEF2YWlsYWJsZScsIFwiU3RlcCB0YXJnZXRzIGFyZSBub3QgYXZhaWxhYmxlIGhlcmVcIik7XG5cbmNsYXNzIFN0ZXBJbnRvVGFyZ2V0c0FjdGlvbiBleHRlbmRzIEVkaXRvckFjdGlvbiB7XG5cblx0cHVibGljIHN0YXRpYyByZWFkb25seSBJRCA9ICdlZGl0b3IuZGVidWcuYWN0aW9uLnN0ZXBJbnRvVGFyZ2V0cyc7XG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgTEFCRUwgPSBubHMubG9jYWxpemUoeyBrZXk6ICdzdGVwSW50b1RhcmdldHMnLCBjb21tZW50OiBbJ1N0ZXAgSW50byBUYXJnZXRzIGxldHMgdGhlIHVzZXIgc3RlcCBpbnRvIGFuIGV4YWN0IGZ1bmN0aW9uIGhlIG9yIHNoZSBpcyBpbnRlcmVzdGVkIGluLiddIH0sIFwiU3RlcCBJbnRvIFRhcmdldFwiKTtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogU3RlcEludG9UYXJnZXRzQWN0aW9uLklELFxuXHRcdFx0bGFiZWw6IFN0ZXBJbnRvVGFyZ2V0c0FjdGlvbi5MQUJFTCxcblx0XHRcdGFsaWFzOiAnRGVidWc6IFN0ZXAgSW50byBUYXJnZXQnLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoQ09OVEVYVF9TVEVQX0lOVE9fVEFSR0VUU19TVVBQT1JURUQsIENPTlRFWFRfSU5fREVCVUdfTU9ERSwgQ09OVEVYVF9ERUJVR19TVEFURS5pc0VxdWFsVG8oJ3N0b3BwZWQnKSwgRWRpdG9yQ29udGV4dEtleXMuZWRpdG9yVGV4dEZvY3VzKSxcblx0XHRcdGNvbnRleHRNZW51T3B0czoge1xuXHRcdFx0XHRncm91cDogJ2RlYnVnJyxcblx0XHRcdFx0b3JkZXI6IDEuNVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZGVidWdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEZWJ1Z1NlcnZpY2UpO1xuXHRcdGNvbnN0IGNvbnRleHRNZW51U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29udGV4dE1lbnVTZXJ2aWNlKTtcblx0XHRjb25zdCB1cmlJZGVudGl0eVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVVyaUlkZW50aXR5U2VydmljZSk7XG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IGRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5mb2N1c2VkU2Vzc2lvbjtcblx0XHRjb25zdCBmcmFtZSA9IGRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5mb2N1c2VkU3RhY2tGcmFtZTtcblx0XHRjb25zdCBzZWxlY3Rpb24gPSBlZGl0b3IuZ2V0U2VsZWN0aW9uKCk7XG5cblx0XHRjb25zdCB0YXJnZXRQb3NpdGlvbiA9IHNlbGVjdGlvbj8uZ2V0UG9zaXRpb24oKSB8fCAoZnJhbWUgJiYgeyBsaW5lTnVtYmVyOiBmcmFtZS5yYW5nZS5zdGFydExpbmVOdW1iZXIsIGNvbHVtbjogZnJhbWUucmFuZ2Uuc3RhcnRDb2x1bW4gfSk7XG5cblx0XHRpZiAoIXNlc3Npb24gfHwgIWZyYW1lIHx8ICFlZGl0b3IuaGFzTW9kZWwoKSB8fCAhdXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsKGVkaXRvci5nZXRNb2RlbCgpLnVyaSwgZnJhbWUuc291cmNlLnVyaSkpIHtcblx0XHRcdGlmICh0YXJnZXRQb3NpdGlvbikge1xuXHRcdFx0XHRNZXNzYWdlQ29udHJvbGxlci5nZXQoZWRpdG9yKT8uc2hvd01lc3NhZ2UoTk9fVEFSR0VUU19NRVNTQUdFLCB0YXJnZXRQb3NpdGlvbik7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cblx0XHRjb25zdCB0YXJnZXRzID0gYXdhaXQgc2Vzc2lvbi5zdGVwSW5UYXJnZXRzKGZyYW1lLmZyYW1lSWQpO1xuXHRcdGlmICghdGFyZ2V0cz8ubGVuZ3RoKSB7XG5cdFx0XHRNZXNzYWdlQ29udHJvbGxlci5nZXQoZWRpdG9yKT8uc2hvd01lc3NhZ2UoTk9fVEFSR0VUU19NRVNTQUdFLCB0YXJnZXRQb3NpdGlvbiEpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIElmIHRoZXJlIGlzIGEgc2VsZWN0aW9uLCB0cnkgdG8gZmluZCB0aGUgYmVzdCB0YXJnZXQgd2l0aCBhIHBvc2l0aW9uIHRvIHN0ZXAgaW50by5cblx0XHRpZiAoc2VsZWN0aW9uKSB7XG5cdFx0XHRjb25zdCBwb3NpdGlvbmFsVGFyZ2V0czogeyBzdGFydDogUG9zaXRpb247IGVuZD86IFBvc2l0aW9uOyB0YXJnZXQ6IERlYnVnUHJvdG9jb2wuU3RlcEluVGFyZ2V0IH1bXSA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCB0YXJnZXQgb2YgdGFyZ2V0cykge1xuXHRcdFx0XHRpZiAodGFyZ2V0LmxpbmUpIHtcblx0XHRcdFx0XHRwb3NpdGlvbmFsVGFyZ2V0cy5wdXNoKHtcblx0XHRcdFx0XHRcdHN0YXJ0OiBuZXcgUG9zaXRpb24odGFyZ2V0LmxpbmUsIHRhcmdldC5jb2x1bW4gfHwgMSksXG5cdFx0XHRcdFx0XHRlbmQ6IHRhcmdldC5lbmRMaW5lID8gbmV3IFBvc2l0aW9uKHRhcmdldC5lbmRMaW5lLCB0YXJnZXQuZW5kQ29sdW1uIHx8IDEpIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0dGFyZ2V0XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cG9zaXRpb25hbFRhcmdldHMuc29ydCgoYSwgYikgPT4gYi5zdGFydC5saW5lTnVtYmVyIC0gYS5zdGFydC5saW5lTnVtYmVyIHx8IGIuc3RhcnQuY29sdW1uIC0gYS5zdGFydC5jb2x1bW4pO1xuXG5cdFx0XHRjb25zdCBuZWVkbGUgPSBzZWxlY3Rpb24uZ2V0UG9zaXRpb24oKTtcblxuXHRcdFx0Ly8gVHJ5IHRvIGZpbmQgYSB0YXJnZXQgd2l0aCBhIHN0YXJ0IGFuZCBlbmQgdGhhdCBpcyBhcm91bmQgdGhlIGN1cnNvclxuXHRcdFx0Ly8gcG9zaXRpb24uIE9yLCBpZiBub25lLCB3aGF0ZXZlciBpcyBiZWZvcmUgdGhlIGN1cnNvci5cblx0XHRcdGNvbnN0IGJlc3QgPSBwb3NpdGlvbmFsVGFyZ2V0cy5maW5kKHQgPT4gdC5lbmQgJiYgbmVlZGxlLmlzQmVmb3JlKHQuZW5kKSAmJiB0LnN0YXJ0LmlzQmVmb3JlT3JFcXVhbChuZWVkbGUpKSB8fCBwb3NpdGlvbmFsVGFyZ2V0cy5maW5kKHQgPT4gdC5lbmQgPT09IHVuZGVmaW5lZCAmJiB0LnN0YXJ0LmlzQmVmb3JlT3JFcXVhbChuZWVkbGUpKTtcblx0XHRcdGlmIChiZXN0KSB7XG5cdFx0XHRcdHNlc3Npb24uc3RlcEluKGZyYW1lLnRocmVhZC50aHJlYWRJZCwgYmVzdC50YXJnZXQuaWQpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gT3RoZXJ3aXNlLCBzaG93IGEgY29udGV4dCBtZW51IGFuZCBoYXZlIHRoZSB1c2VyIHBpY2sgYSB0YXJnZXRcblx0XHRlZGl0b3IucmV2ZWFsTGluZUluQ2VudGVySWZPdXRzaWRlVmlld3BvcnQoZnJhbWUucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyKTtcblx0XHRjb25zdCBjdXJzb3JDb29yZHMgPSBlZGl0b3IuZ2V0U2Nyb2xsZWRWaXNpYmxlUG9zaXRpb24odGFyZ2V0UG9zaXRpb24hKTtcblx0XHRjb25zdCBlZGl0b3JDb29yZHMgPSBnZXREb21Ob2RlUGFnZVBvc2l0aW9uKGVkaXRvci5nZXREb21Ob2RlKCkpO1xuXHRcdGNvbnN0IHggPSBlZGl0b3JDb29yZHMubGVmdCArIGN1cnNvckNvb3Jkcy5sZWZ0O1xuXHRcdGNvbnN0IHkgPSBlZGl0b3JDb29yZHMudG9wICsgY3Vyc29yQ29vcmRzLnRvcCArIGN1cnNvckNvb3Jkcy5oZWlnaHQ7XG5cblx0XHRjb250ZXh0TWVudVNlcnZpY2Uuc2hvd0NvbnRleHRNZW51KHtcblx0XHRcdGdldEFuY2hvcjogKCkgPT4gKHsgeCwgeSB9KSxcblx0XHRcdGdldEFjdGlvbnM6ICgpID0+IHtcblx0XHRcdFx0cmV0dXJuIHRhcmdldHMubWFwKHQgPT4gbmV3IEFjdGlvbihgc3RlcEludG9UYXJnZXQ6JHt0LmlkfWAsIHQubGFiZWwsIHVuZGVmaW5lZCwgdHJ1ZSwgKCkgPT4gc2Vzc2lvbi5zdGVwSW4oZnJhbWUudGhyZWFkLnRocmVhZElkLCB0LmlkKSkpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG59XG5cbmNsYXNzIEdvVG9CcmVha3BvaW50QWN0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblx0Y29uc3RydWN0b3IocHJpdmF0ZSBpc05leHQ6IGJvb2xlYW4sIG9wdHM6IElBY3Rpb25PcHRpb25zKSB7XG5cdFx0c3VwZXIob3B0cyk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IpOiBQcm9taXNlPGFueT4ge1xuXHRcdGNvbnN0IGRlYnVnU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGVidWdTZXJ2aWNlKTtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRjb25zdCB1cmlJZGVudGl0eVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVVyaUlkZW50aXR5U2VydmljZSk7XG5cblx0XHRpZiAoZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdGNvbnN0IGN1cnJlbnRVcmkgPSBlZGl0b3IuZ2V0TW9kZWwoKS51cmk7XG5cdFx0XHRjb25zdCBjdXJyZW50TGluZSA9IGVkaXRvci5nZXRQb3NpdGlvbigpLmxpbmVOdW1iZXI7XG5cdFx0XHQvL0JyZWFrcG9pbnRzIHJldHVybmVkIGZyb20gYGdldEJyZWFrcG9pbnRzYCBhcmUgYWxyZWFkeSBzb3J0ZWQuXG5cdFx0XHRjb25zdCBhbGxFbmFibGVkQnJlYWtwb2ludHMgPSBkZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKS5nZXRCcmVha3BvaW50cyh7IGVuYWJsZWRPbmx5OiB0cnVlIH0pO1xuXG5cdFx0XHQvL1RyeSB0byBmaW5kIGJyZWFrcG9pbnQgaW4gY3VycmVudCBmaWxlXG5cdFx0XHRsZXQgbW92ZUJyZWFrcG9pbnQgPVxuXHRcdFx0XHR0aGlzLmlzTmV4dFxuXHRcdFx0XHRcdD8gYWxsRW5hYmxlZEJyZWFrcG9pbnRzLmZpbHRlcihicCA9PiB1cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwoYnAudXJpLCBjdXJyZW50VXJpKSAmJiBicC5saW5lTnVtYmVyID4gY3VycmVudExpbmUpLnNoaWZ0KClcblx0XHRcdFx0XHQ6IGFsbEVuYWJsZWRCcmVha3BvaW50cy5maWx0ZXIoYnAgPT4gdXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsKGJwLnVyaSwgY3VycmVudFVyaSkgJiYgYnAubGluZU51bWJlciA8IGN1cnJlbnRMaW5lKS5wb3AoKTtcblxuXHRcdFx0Ly9UcnkgdG8gZmluZCBicmVha3BvaW50cyBpbiBmb2xsb3dpbmcgZmlsZXNcblx0XHRcdGlmICghbW92ZUJyZWFrcG9pbnQpIHtcblx0XHRcdFx0bW92ZUJyZWFrcG9pbnQgPVxuXHRcdFx0XHRcdHRoaXMuaXNOZXh0XG5cdFx0XHRcdFx0XHQ/IGFsbEVuYWJsZWRCcmVha3BvaW50cy5maWx0ZXIoYnAgPT4gYnAudXJpLnRvU3RyaW5nKCkgPiBjdXJyZW50VXJpLnRvU3RyaW5nKCkpLnNoaWZ0KClcblx0XHRcdFx0XHRcdDogYWxsRW5hYmxlZEJyZWFrcG9pbnRzLmZpbHRlcihicCA9PiBicC51cmkudG9TdHJpbmcoKSA8IGN1cnJlbnRVcmkudG9TdHJpbmcoKSkucG9wKCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vTW92ZSB0byBmaXJzdCBvciBsYXN0IHBvc3NpYmxlIGJyZWFrcG9pbnRcblx0XHRcdGlmICghbW92ZUJyZWFrcG9pbnQgJiYgYWxsRW5hYmxlZEJyZWFrcG9pbnRzLmxlbmd0aCkge1xuXHRcdFx0XHRtb3ZlQnJlYWtwb2ludCA9IHRoaXMuaXNOZXh0ID8gYWxsRW5hYmxlZEJyZWFrcG9pbnRzWzBdIDogYWxsRW5hYmxlZEJyZWFrcG9pbnRzW2FsbEVuYWJsZWRCcmVha3BvaW50cy5sZW5ndGggLSAxXTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKG1vdmVCcmVha3BvaW50KSB7XG5cdFx0XHRcdHJldHVybiBvcGVuQnJlYWtwb2ludFNvdXJjZShtb3ZlQnJlYWtwb2ludCwgZmFsc2UsIHRydWUsIGZhbHNlLCBkZWJ1Z1NlcnZpY2UsIGVkaXRvclNlcnZpY2UpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuXG5jbGFzcyBHb1RvTmV4dEJyZWFrcG9pbnRBY3Rpb24gZXh0ZW5kcyBHb1RvQnJlYWtwb2ludEFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHRydWUsIHtcblx0XHRcdGlkOiAnZWRpdG9yLmRlYnVnLmFjdGlvbi5nb1RvTmV4dEJyZWFrcG9pbnQnLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ2dvVG9OZXh0QnJlYWtwb2ludCcsIFwiRGVidWc6IEdvIHRvIE5leHQgQnJlYWtwb2ludFwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ09OVEVYVF9ERUJVR0dFUlNfQVZBSUxBQkxFXG5cdFx0fSk7XG5cdH1cbn1cblxuY2xhc3MgR29Ub1ByZXZpb3VzQnJlYWtwb2ludEFjdGlvbiBleHRlbmRzIEdvVG9CcmVha3BvaW50QWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoZmFsc2UsIHtcblx0XHRcdGlkOiAnZWRpdG9yLmRlYnVnLmFjdGlvbi5nb1RvUHJldmlvdXNCcmVha3BvaW50Jyxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCdnb1RvUHJldmlvdXNCcmVha3BvaW50JywgXCJEZWJ1ZzogR28gdG8gUHJldmlvdXMgQnJlYWtwb2ludFwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ09OVEVYVF9ERUJVR0dFUlNfQVZBSUxBQkxFXG5cdFx0fSk7XG5cdH1cbn1cblxuY2xhc3MgQ2xvc2VFeGNlcHRpb25XaWRnZXRBY3Rpb24gZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZWRpdG9yLmRlYnVnLmFjdGlvbi5jbG9zZUV4Y2VwdGlvbldpZGdldCcsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignY2xvc2VFeGNlcHRpb25XaWRnZXQnLCBcIkNsb3NlIEV4Y2VwdGlvbiBXaWRnZXRcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IENPTlRFWFRfRVhDRVBUSU9OX1dJREdFVF9WSVNJQkxFLFxuXHRcdFx0a2JPcHRzOiB7XG5cdFx0XHRcdHByaW1hcnk6IEtleUNvZGUuRXNjYXBlLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKF9hY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGNvbnRyaWJ1dGlvbiA9IGVkaXRvci5nZXRDb250cmlidXRpb248SURlYnVnRWRpdG9yQ29udHJpYnV0aW9uPihFRElUT1JfQ09OVFJJQlVUSU9OX0lEKTtcblx0XHRjb250cmlidXRpb24/LmNsb3NlRXhjZXB0aW9uV2lkZ2V0KCk7XG5cdH1cbn1cblxucmVnaXN0ZXJBY3Rpb24yKE9wZW5EaXNhc3NlbWJseVZpZXdBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKFRvZ2dsZURpc2Fzc2VtYmx5Vmlld1NvdXJjZUNvZGVBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKFRvZ2dsZUJyZWFrcG9pbnRBY3Rpb24pO1xucmVnaXN0ZXJFZGl0b3JBY3Rpb24oQ29uZGl0aW9uYWxCcmVha3BvaW50QWN0aW9uKTtcbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKExvZ1BvaW50QWN0aW9uKTtcbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKFRyaWdnZXJCeUJyZWFrcG9pbnRBY3Rpb24pO1xucmVnaXN0ZXJFZGl0b3JBY3Rpb24oRWRpdEJyZWFrcG9pbnRBY3Rpb24pO1xucmVnaXN0ZXJFZGl0b3JBY3Rpb24oUnVuVG9DdXJzb3JBY3Rpb24pO1xucmVnaXN0ZXJFZGl0b3JBY3Rpb24oU3RlcEludG9UYXJnZXRzQWN0aW9uKTtcbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKFNlbGVjdGlvblRvUmVwbEFjdGlvbik7XG5yZWdpc3RlckVkaXRvckFjdGlvbihTZWxlY3Rpb25Ub1dhdGNoRXhwcmVzc2lvbnNBY3Rpb24pO1xucmVnaXN0ZXJFZGl0b3JBY3Rpb24oU2hvd0RlYnVnSG92ZXJBY3Rpb24pO1xucmVnaXN0ZXJFZGl0b3JBY3Rpb24oR29Ub05leHRCcmVha3BvaW50QWN0aW9uKTtcbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKEdvVG9QcmV2aW91c0JyZWFrcG9pbnRBY3Rpb24pO1xucmVnaXN0ZXJFZGl0b3JBY3Rpb24oQ2xvc2VFeGNlcHRpb25XaWRnZXRBY3Rpb24pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsVUFBVSxTQUFTLGNBQWM7QUFFMUMsU0FBUyxjQUE4Qiw0QkFBNEI7QUFDbkUsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyx5QkFBeUI7QUFDbEMsWUFBWSxTQUFTO0FBRXJCLFNBQVMsU0FBUyxRQUFRLHVCQUF1QjtBQUNqRCxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLDJCQUEyQjtBQUVwQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLHVCQUF1QjtBQUVoQyxTQUFTLG1DQUFtQyx5QkFBeUIsNkJBQTZCLHFCQUFxQiw2QkFBNkIsdUNBQXVDLGdDQUFnQyxrQ0FBa0MsK0RBQStELHVCQUF1QiwrQ0FBK0MscUNBQXFDLHdCQUFzRyxlQUFlLGNBQWMscUJBQXFCO0FBQy9qQixTQUFTLDBDQUEwQztBQUNuRCxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHFCQUFxQjtBQUU5QixNQUFNLCtCQUErQixRQUFRO0FBQUEsRUFDNUMsY0FBYztBQUNiLFVBQU07QUFBQSxNQUNMLElBQUk7QUFBQSxN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
