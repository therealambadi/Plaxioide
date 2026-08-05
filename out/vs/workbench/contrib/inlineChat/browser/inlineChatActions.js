import { Codicon } from "../../../../base/common/codicons.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { isCodeEditor, isDiffEditor } from "../../../../editor/browser/editorBrowser.js";
import { EditorAction2 } from "../../../../editor/browser/editorExtensions.js";
import { EmbeddedDiffEditorWidget } from "../../../../editor/browser/widget/diffEditor/embeddedDiffEditorWidget.js";
import { EmbeddedCodeEditorWidget } from "../../../../editor/browser/widget/codeEditor/embeddedCodeEditorWidget.js";
import { EditorContextKeys } from "../../../../editor/common/editorContextKeys.js";
import { InlineChatController, InlineChatController1, InlineChatController2, InlineChatRunOptions } from "./inlineChatController.js";
import { ACTION_ACCEPT_CHANGES, CTX_INLINE_CHAT_HAS_AGENT, CTX_INLINE_CHAT_HAS_STASHED_SESSION, CTX_INLINE_CHAT_FOCUSED, CTX_INLINE_CHAT_INNER_CURSOR_FIRST, CTX_INLINE_CHAT_INNER_CURSOR_LAST, CTX_INLINE_CHAT_VISIBLE, CTX_INLINE_CHAT_OUTER_CURSOR_POSITION, MENU_INLINE_CHAT_WIDGET_STATUS, CTX_INLINE_CHAT_REQUEST_IN_PROGRESS, CTX_INLINE_CHAT_RESPONSE_TYPE, InlineChatResponseType, ACTION_REGENERATE_RESPONSE, ACTION_VIEW_IN_CHAT, ACTION_TOGGLE_DIFF, CTX_INLINE_CHAT_CHANGE_HAS_DIFF, CTX_INLINE_CHAT_CHANGE_SHOWS_DIFF, MENU_INLINE_CHAT_ZONE, ACTION_DISCARD_CHANGES, CTX_INLINE_CHAT_POSSIBLE, ACTION_START, CTX_INLINE_CHAT_HAS_AGENT2, MENU_INLINE_CHAT_SIDE } from "../common/inlineChat.js";
import { ctxIsGlobalEditingSession, ctxRequestCount } from "../../chat/browser/chatEditing/chatEditingEditorContextKeys.js";
import { localize, localize2 } from "../../../../nls.js";
import { Action2, MenuId } from "../../../../platform/actions/common/actions.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { CONTEXT_ACCESSIBILITY_MODE_ENABLED } from "../../../../platform/accessibility/common/accessibility.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { IPreferencesService } from "../../../services/preferences/common/preferences.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IChatService } from "../../chat/common/chatService.js";
import { ChatContextKeys } from "../../chat/common/chatContextKeys.js";
import { IChatWidgetService } from "../../chat/browser/chat.js";
import { IInlineChatSessionService } from "./inlineChatSessionService.js";
CommandsRegistry.registerCommandAlias("interactiveEditor.start", "inlineChat.start");
CommandsRegistry.registerCommandAlias("interactive.acceptChanges", ACTION_ACCEPT_CHANGES);
const START_INLINE_CHAT = registerIcon("start-inline-chat", Codicon.sparkle, localize("startInlineChat", "Icon which spawns the inline chat from the editor toolbar."));
let _holdForSpeech = void 0;
function setHoldForSpeech(holdForSpeech) {
  _holdForSpeech = holdForSpeech;
}
class StartSessionAction extends Action2 {
  constructor() {
    super({
      id: ACTION_START,
      title: localize2("run", "Editor Inline Chat"),
      category: AbstractInline1ChatAction.category,
      f1: true,
      precondition: ContextKeyExpr.and(
        ContextKeyExpr.or(CTX_INLINE_CHAT_HAS_AGENT, CTX_INLINE_CHAT_HAS_AGENT2),
        CTX_INLINE_CHAT_POSSIBLE,
        EditorContextKeys.writable,
        EditorContextKeys.editorSimpleInput.negate()
      ),
      keybinding: {
        when: EditorContextKeys.focus,
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyCode.KeyI
      },
      icon: START_INLINE_CHAT,
      menu: {
        id: MenuId.ChatTitleBarMenu,
        group: "a_open",
        order: 3
      }
    });
  }
  run(accessor, ...args) {
    const codeEditorService = accessor.get(ICodeEditorService);
    const editor = codeEditorService.getActiveCodeEditor();
    if (!editor || editor.isSimpleWidget) {
      return;
    }
    return editor.invokeWithinContext((editorAccessor) => {
      const kbService = editorAccessor.get(IContextKeyService);
      const logService = editorAccessor.get(ILogService);
      const enabled = kbService.contextMatchesRules(this.desc.precondition ?? void 0);
      if (!enabled) {
        logService.debug(`[EditorAction2] NOT running command because its precondition is FALSE`, this.desc.id, this.desc.precondition?.serialize());
        return;
      }
      return this._runEditorCommand(editorAccessor, editor, ...args);
    });
  }
  _runEditorCommand(accessor, editor, ..._args) {
    const ctrl = InlineChatController.get(editor);
    if (!ctrl) {
      return;
    }
    if (_holdForSpeech) {
      accessor.get(IInstantiationService).invokeFunction(_holdForSpeech, ctrl, this);
    }
    let options;
    const arg = _args[0];
    if (arg && InlineChatRunOptions.isInlineChatRunOptions(arg)) {
      options = arg;
    }
    InlineChatController.get(editor)?.run({ ...options });
  }
}
class FocusInlineChat extends EditorAction2 {
  constructor() {
    super({
      id: "inlineChat.focus",
      title: localize2("focus", "Focus Input"),
      f1: true,
      category: AbstractInline1ChatAction.category,
      precondition: ContextKeyExpr.and(EditorContextKeys.editorTextFocus, CTX_INLINE_CHAT_VISIBLE, CTX_INLINE_CHAT_FOCUSED.negate(), CONTEXT_ACCESSIBILITY_MODE_ENABLED.negate()),
      keybinding: [{
        weight: KeybindingWeight.EditorCore + 10,
        // win against core_command
        when: ContextKeyExpr.and(CTX_INLINE_CHAT_OUTER_CURSOR_POSITION.isEqualTo("above"), EditorContextKeys.isEmbeddedDiffEditor.negate()),
        primary: KeyMod.CtrlCmd | KeyCode.DownArrow
      }, {
        weight: KeybindingWeight.EditorCore + 10,
        // win against core_command
        when: ContextKeyExpr.and(CTX_INLINE_CHAT_OUTER_CURSOR_POSITION.isEqualTo("below"), EditorContextKeys.isEmbeddedDiffEditor.negate()),
        primary: KeyMod.CtrlCmd | KeyCode.UpArrow
      }]
    });
  }
  runEditorCommand(_accessor, editor, ..._args) {
    InlineChatController.get(editor)?.focus();
  }
}
class UnstashSessionAction extends EditorAction2 {
  constructor() {
    super({
      id: "inlineChat.unstash",
      title: localize2("unstash", "Resume Last Dismissed Inline Chat"),
      category: AbstractInline1ChatAction.category,
      precondition: ContextKeyExpr.and(CTX_INLINE_CHAT_HAS_STASHED_SESSION, EditorContextKeys.writable),
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyCode.KeyZ
      }
    });
  }
  async runEditorCommand(_accessor, editor, ..._args) {
    const ctrl = InlineChatController1.get(editor);
    if (ctrl) {
      const session = ctrl.unstashLastSession();
      if (session) {
        ctrl.run({
          existingSession: session
        });
      }
    }
  }
}
const _AbstractInline1ChatAction = class _AbstractInline1ChatAction extends EditorAction2 {
  constructor(desc) {
    super({
      ...desc,
      category: _AbstractInline1ChatAction.category,
      precondition: ContextKeyExpr.and(CTX_INLINE_CHAT_HAS_AGENT, desc.precondition)
    });
  }
  runEditorCommand(accessor, editor, ..._args) {
    const editorService = accessor.get(IEditorService);
    const logService = accessor.get(ILogService);
    let ctrl = InlineChatController1.get(editor);
    if (!ctrl) {
      const { activeTextEditorControl } = editorService;
      if (isCodeEditor(activeTextEditorControl)) {
        editor = activeTextEditorControl;
      } else if (isDiffEditor(activeTextEditorControl)) {
        editor = activeTextEditorControl.getModifiedEditor();
      }
      ctrl = InlineChatController1.get(editor);
    }
    if (!ctrl) {
      logService.warn("[IE] NO controller found for action", this.desc.id, editor.getModel()?.uri);
      return;
    }
    if (editor instanceof EmbeddedCodeEditorWidget) {
      editor = editor.getParentEditor();
    }
    if (!ctrl) {
      for (const diffEditor of accessor.get(ICodeEditorService).listDiffEditors()) {
        if (diffEditor.getOriginalEditor() === editor || diffEditor.getModifiedEditor() === editor) {
          if (diffEditor instanceof EmbeddedDiffEditorWidget) {
            this.runEditorCommand(accessor, diffEditor.getParentEditor(), ..._args);
          }
        }
      }
      return;
    }
    this.runInlineChatCommand(accessor, ctrl, editor, ..._args);
  }
};
_AbstractInline1ChatAction.category = localize2("cat", "Inline Chat");
let AbstractInline1ChatAction = _AbstractInline1ChatAction;
class ArrowOutUpAction extends AbstractInline1ChatAction {
  constructor() {
    super({
      id: "inlineChat.arrowOutUp",
      title: localize("arrowUp", "Cursor Up"),
      precondition: ContextKeyExpr.and(CTX_INLINE_CHAT_FOCUSED, CTX_INLINE_CHAT_INNER_CURSOR_FIRST, EditorContextKeys.isEmbeddedDiffEditor.negate(), CONTEXT_ACCESSIBILITY_MODE_ENABLED.negate()),
      keybinding: {
        weight: KeybindingWeight.EditorCore,
        primary: KeyMod.CtrlCmd | KeyCode.UpArrow
      }
    });
  }
  runInlineChatCommand(_accessor, ctrl, _editor, ..._args) {
    ctrl.arrowOut(true);
  }
}
class ArrowOutDownAction extends AbstractInline1ChatAction {
  constructor() {
    super({
      id: "inlineChat.arrowOutDown",
      title: localize("arrowDown", "Cursor Down"),
      precondition: ContextKeyExpr.and(CTX_INLINE_CHAT_FOCUSED, CTX_INLINE_CHAT_INNER_CURSOR_LAST, EditorContextKeys.isEmbeddedDiffEditor.negate(), CONTEXT_ACCESSIBILITY_MODE_ENABLED.negate()),
      keybinding: {
        weight: KeybindingWeight.EditorCore,
        primary: KeyMod.CtrlCmd | KeyCode.DownArrow
      }
    });
  }
  runInlineChatCommand(_accessor, ctrl, _editor, ..._args) {
    ctrl.arrowOut(false);
  }
}
class AcceptChanges extends AbstractInline1ChatAction {
  constructor() {
    super({
      id: ACTION_ACCEPT_CHANGES,
      title: localize2("apply1", "Accept Changes"),
      shortTitle: localize("apply2", "Accept"),
      icon: Codicon.check,
      f1: true,
      precondition: ContextKeyExpr.and(CTX_INLINE_CHAT_VISIBLE),
      keybinding: [{
        weight: KeybindingWeight.WorkbenchContrib + 10,
        primary: KeyMod.CtrlCmd | KeyCode.Enter
      }],
      menu: [{
        id: MENU_INLINE_CHAT_WIDGET_STATUS,
        group: "0_main",
        order: 1,
        when: ContextKeyExpr.and(
          ChatContextKeys.inputHasText.toNegated(),
          CTX_INLINE_CHAT_REQUEST_IN_PROGRESS.toNegated(),
          CTX_INLINE_CHAT_RESPONSE_TYPE.isEqualTo(InlineChatResponseType.MessagesAndEdits)
        )
      }, {
        id: MENU_INLINE_CHAT_ZONE,
        group: "navigation",
        order: 1
      }]
    });
  }
  async runInlineChatCommand(_accessor, ctrl, _editor, hunk) {
    ctrl.acceptHunk(hunk);
  }
}
class DiscardHunkAction extends AbstractInline1ChatAction {
  constructor() {
    super({
      id: ACTION_DISCARD_CHANGES,
      title: localize("discard", "Discard"),
      icon: Codicon.chromeClose,
      precondition: CTX_INLINE_CHAT_VISIBLE,
      menu: [{
        id: MENU_INLINE_CHAT_ZONE,
        group: "navigation",
        order: 2
      }],
      keybinding: {
        weight: KeybindingWeight.EditorContrib,
        primary: KeyCode.Escape,
        when: CTX_INLINE_CHAT_RESPONSE_TYPE.isEqualTo(InlineChatResponseType.MessagesAndEdits)
      }
    });
  }
  async runInlineChatCommand(_accessor, ctrl, _editor, hunk) {
    return ctrl.discardHunk(hunk);
  }
}
class RerunAction extends AbstractInline1ChatAction {
  constructor() {
    super({
      id: ACTION_REGENERATE_RESPONSE,
      title: localize2("chat.rerun.label", "Rerun Request"),
      shortTitle: localize("rerun", "Rerun"),
      f1: false,
      icon: Codicon.refresh,
      precondition: CTX_INLINE_CHAT_VISIBLE,
      menu: {
        id: MENU_INLINE_CHAT_WIDGET_STATUS,
        group: "0_main",
        order: 5,
        when: ContextKeyExpr.and(
          ChatContextKeys.inputHasText.toNegated(),
          CTX_INLINE_CHAT_REQUEST_IN_PROGRESS.negate(),
          CTX_INLINE_CHAT_RESPONSE_TYPE.notEqualsTo(InlineChatResponseType.None)
        )
      },
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyCode.KeyR
      }
    });
  }
  async runInlineChatCommand(accessor, ctrl, _editor, ..._args) {
    const chatService = accessor.get(IChatService);
    const chatWidgetService = accessor.get(IChatWidgetService);
    const model = ctrl.chatWidget.viewModel?.model;
    if (!model) {
      return;
    }
    const lastRequest = model.getRequests().at(-1);
    if (lastRequest) {
      const widget = chatWidgetService.getWidgetBySessionId(model.sessionId);
      await chatService.resendRequest(lastRequest, {
        noCommandDetection: false,
        attempt: lastRequest.attempt + 1,
        location: ctrl.chatWidget.location,
        userSelectedModelId: widget?.input.currentLanguageModel
      });
    }
  }
}
class CloseAction extends AbstractInline1ChatAction {
  constructor() {
    super({
      id: "inlineChat.close",
      title: localize("close", "Close"),
      icon: Codicon.close,
      precondition: CTX_INLINE_CHAT_VISIBLE,
      keybinding: {
        weight: KeybindingWeight.EditorContrib + 1,
        primary: KeyCode.Escape
      },
      menu: [{
        id: MENU_INLINE_CHAT_WIDGET_STATUS,
        group: "0_main",
        order: 1,
        when: ContextKeyExpr.and(
          CTX_INLINE_CHAT_REQUEST_IN_PROGRESS.negate()
        )
      }]
    });
  }
  async runInlineChatCommand(_accessor, ctrl, _editor, ..._args) {
    ctrl.cancelSession();
  }
}
class ConfigureInlineChatAction extends AbstractInline1ChatAction {
  constructor() {
    super({
      id: "inlineChat.configure",
      title: localize2("configure", "Configure Inline Chat"),
      icon: Codicon.settingsGear,
      precondition: CTX_INLINE_CHAT_VISIBLE,
      f1: true,
      menu: {
        id: MENU_INLINE_CHAT_WIDGET_STATUS,
        group: "zzz",
        order: 5
      }
    });
  }
  async runInlineChatCommand(accessor, ctrl, _editor, ..._args) {
    accessor.get(IPreferencesService).openSettings({ query: "inlineChat" });
  }
}
class MoveToNextHunk extends AbstractInline1ChatAction {
  constructor() {
    super({
      id: "inlineChat.moveToNextHunk",
      title: localize2("moveToNextHunk", "Move to Next Change"),
      precondition: CTX_INLINE_CHAT_VISIBLE,
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyCode.F7
      }
    });
  }
  runInlineChatCommand(accessor, ctrl, editor, ...args) {
    ctrl.moveHunk(true);
  }
}
class MoveToPreviousHunk extends AbstractInline1ChatAction {
  constructor() {
    super({
      id: "inlineChat.moveToPreviousHunk",
      title: localize2("moveToPreviousHunk", "Move to Previous Change"),
      f1: true,
      precondition: CTX_INLINE_CHAT_VISIBLE,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.Shift | KeyCode.F7
      }
    });
  }
  runInlineChatCommand(accessor, ctrl, editor, ...args) {
    ctrl.moveHunk(false);
  }
}
class ViewInChatAction extends AbstractInline1ChatAction {
  constructor() {
    super({
      id: ACTION_VIEW_IN_CHAT,
      title: localize("viewInChat", "View in Chat"),
      icon: Codicon.commentDiscussion,
      precondition: CTX_INLINE_CHAT_VISIBLE,
      menu: [{
        id: MENU_INLINE_CHAT_WIDGET_STATUS,
        group: "more",
        order: 1,
        when: CTX_INLINE_CHAT_RESPONSE_TYPE.notEqualsTo(InlineChatResponseType.Messages)
      }, {
        id: MENU_INLINE_CHAT_WIDGET_STATUS,
        group: "0_main",
        order: 1,
        when: ContextKeyExpr.and(
          ChatContextKeys.inputHasText.toNegated(),
          CTX_INLINE_CHAT_RESPONSE_TYPE.isEqualTo(InlineChatResponseType.Messages),
          CTX_INLINE_CHAT_REQUEST_IN_PROGRESS.negate()
        )
      }],
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyCode.DownArrow,
        when: ChatContextKeys.inChatInput
      }
    });
  }
  runInlineChatCommand(_accessor, ctrl, _editor, ..._args) {
    return ctrl.viewInChat();
  }
}
class ToggleDiffForChange extends AbstractInline1ChatAction {
  constructor() {
    super({
      id: ACTION_TOGGLE_DIFF,
      precondition: ContextKeyExpr.and(CTX_INLINE_CHAT_VISIBLE, CTX_INLINE_CHAT_CHANGE_HAS_DIFF),
      title: localize2("showChanges", "Toggle Changes"),
      icon: Codicon.diffSingle,
      toggled: {
        condition: CTX_INLINE_CHAT_CHANGE_SHOWS_DIFF
      },
      menu: [{
        id: MENU_INLINE_CHAT_WIDGET_STATUS,
        group: "zzz",
        order: 1
      }, {
        id: MENU_INLINE_CHAT_ZONE,
        group: "navigation",
        when: CTX_INLINE_CHAT_CHANGE_HAS_DIFF,
        order: 2
      }]
    });
  }
  runInlineChatCommand(_accessor, ctrl, _editor, hunkInfo) {
    ctrl.toggleDiff(hunkInfo);
  }
}
const _AbstractInline2ChatAction = class _AbstractInline2ChatAction extends EditorAction2 {
  constructor(desc) {
    super({
      ...desc,
      category: _AbstractInline2ChatAction.category,
      precondition: ContextKeyExpr.and(CTX_INLINE_CHAT_HAS_AGENT2, desc.precondition)
    });
  }
  runEditorCommand(accessor, editor, ..._args) {
    const editorService = accessor.get(IEditorService);
    const logService = accessor.get(ILogService);
    let ctrl = InlineChatController2.get(editor);
    if (!ctrl) {
      const { activeTextEditorControl } = editorService;
      if (isCodeEditor(activeTextEditorControl)) {
        editor = activeTextEditorControl;
      } else if (isDiffEditor(activeTextEditorControl)) {
        editor = activeTextEditorControl.getModifiedEditor();
      }
      ctrl = InlineChatController2.get(editor);
    }
    if (!ctrl) {
      logService.warn("[IE] NO controller found for action", this.desc.id, editor.getModel()?.uri);
      return;
    }
    if (editor instanceof EmbeddedCodeEditorWidget) {
      editor = editor.getParentEditor();
    }
    if (!ctrl) {
      for (const diffEditor of accessor.get(ICodeEditorService).listDiffEditors()) {
        if (diffEditor.getOriginalEditor() === editor || diffEditor.getModifiedEditor() === editor) {
          if (diffEditor instanceof EmbeddedDiffEditorWidget) {
            this.runEditorCommand(accessor, diffEditor.getParentEditor(), ..._args);
          }
        }
      }
      return;
    }
    this.runInlineChatCommand(accessor, ctrl, editor, ..._args);
  }
};
_AbstractInline2ChatAction.category = localize2("cat", "Inline Chat");
let AbstractInline2ChatAction = _AbstractInline2ChatAction;
class StopSessionAction2 extends AbstractInline2ChatAction {
  constructor() {
    super({
      id: "inlineChat2.stop",
      title: localize2("stop", "Undo & Close"),
      f1: true,
      icon: Codicon.close,
      precondition: CTX_INLINE_CHAT_VISIBLE,
      keybinding: [{
        when: ctxRequestCount.isEqualTo(0),
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyCode.KeyI
      }, {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyCode.Escape
      }],
      menu: {
        id: MENU_INLINE_CHAT_SIDE,
        group: "navigation",
        when: CTX_INLINE_CHAT_HAS_AGENT2
      }
    });
  }
  runInlineChatCommand(accessor, _ctrl, editor, ...args) {
    const inlineChatSessions = accessor.get(IInlineChatSessionService);
    if (!editor.hasModel()) {
      return;
    }
    const textModel = editor.getModel();
    inlineChatSessions.getSession2(textModel.uri)?.dispose();
  }
}
class RevealWidget extends AbstractInline2ChatAction {
  constructor() {
    super({
      id: "inlineChat2.reveal",
      title: localize2("reveal", "Toggle Inline Chat"),
      f1: true,
      icon: Codicon.copilot,
      precondition: ContextKeyExpr.and(ctxIsGlobalEditingSession.negate(), ContextKeyExpr.greaterEquals(ctxRequestCount.key, 1)),
      toggled: CTX_INLINE_CHAT_VISIBLE,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyCode.KeyI
      },
      menu: {
        id: MenuId.ChatEditingEditorContent,
        when: ContextKeyExpr.and(
          ContextKeyExpr.greaterEquals(ctxRequestCount.key, 1),
          ctxIsGlobalEditingSession.negate()
        ),
        group: "navigate",
        order: 4
      }
    });
  }
  runInlineChatCommand(_accessor, ctrl, _editor) {
    ctrl.toggleWidgetUntilNextRequest();
    ctrl.markActiveController();
  }
}
export {
  AbstractInline1ChatAction,
  AcceptChanges,
  ArrowOutDownAction,
  ArrowOutUpAction,
  CloseAction,
  ConfigureInlineChatAction,
  DiscardHunkAction,
  FocusInlineChat,
  MoveToNextHunk,
  MoveToPreviousHunk,
  RerunAction,
  RevealWidget,
  START_INLINE_CHAT,
  StartSessionAction,
  StopSessionAction2,
  ToggleDiffForChange,
  UnstashSessionAction,
  ViewInChatAction,
  setHoldForSpeech
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9pbmxpbmVDaGF0L2Jyb3dzZXIvaW5saW5lQ2hhdEFjdGlvbnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSwgS2V5TW9kIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IsIGlzQ29kZUVkaXRvciwgaXNEaWZmRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JBY3Rpb24yIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBFbWJlZGRlZERpZmZFZGl0b3JXaWRnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci93aWRnZXQvZGlmZkVkaXRvci9lbWJlZGRlZERpZmZFZGl0b3JXaWRnZXQuanMnO1xuaW1wb3J0IHsgRW1iZWRkZWRDb2RlRWRpdG9yV2lkZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L2NvZGVFZGl0b3IvZW1iZWRkZWRDb2RlRWRpdG9yV2lkZ2V0LmpzJztcbmltcG9ydCB7IEVkaXRvckNvbnRleHRLZXlzIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBJbmxpbmVDaGF0Q29udHJvbGxlciwgSW5saW5lQ2hhdENvbnRyb2xsZXIxLCBJbmxpbmVDaGF0Q29udHJvbGxlcjIsIElubGluZUNoYXRSdW5PcHRpb25zIH0gZnJvbSAnLi9pbmxpbmVDaGF0Q29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyBBQ1RJT05fQUNDRVBUX0NIQU5HRVMsIENUWF9JTkxJTkVfQ0hBVF9IQVNfQUdFTlQsIENUWF9JTkxJTkVfQ0hBVF9IQVNfU1RBU0hFRF9TRVNTSU9OLCBDVFhfSU5MSU5FX0NIQVRfRk9DVVNFRCwgQ1RYX0lOTElORV9DSEFUX0lOTkVSX0NVUlNPUl9GSVJTVCwgQ1RYX0lOTElORV9DSEFUX0lOTkVSX0NVUlNPUl9MQVNULCBDVFhfSU5MSU5FX0NIQVRfVklTSUJMRSwgQ1RYX0lOTElORV9DSEFUX09VVEVSX0NVUlNPUl9QT1NJVElPTiwgTUVOVV9JTkxJTkVfQ0hBVF9XSURHRVRfU1RBVFVTLCBDVFhfSU5MSU5FX0NIQVRfUkVRVUVTVF9JTl9QUk9HUkVTUywgQ1RYX0lOTElORV9DSEFUX1JFU1BPTlNFX1RZUEUsIElubGluZUNoYXRSZXNwb25zZVR5cGUsIEFDVElPTl9SRUdFTkVSQVRFX1JFU1BPTlNFLCBBQ1RJT05fVklFV19JTl9DSEFULCBBQ1RJT05fVE9HR0xFX0RJRkYsIENUWF9JTkxJTkVfQ0hBVF9DSEFOR0VfSEFTX0RJRkYsIENUWF9JTkxJTkVfQ0hBVF9DSEFOR0VfU0hPV1NfRElGRiwgTUVOVV9JTkxJTkVfQ0hBVF9aT05FLCBBQ1RJT05fRElTQ0FSRF9DSEFOR0VTLCBDVFhfSU5MSU5FX0NIQVRfUE9TU0lCTEUsIEFDVElPTl9TVEFSVCwgQ1RYX0lOTElORV9DSEFUX0hBU19BR0VOVDIsIE1FTlVfSU5MSU5FX0NIQVRfU0lERSB9IGZyb20gJy4uL2NvbW1vbi9pbmxpbmVDaGF0LmpzJztcbmltcG9ydCB7IGN0eElzR2xvYmFsRWRpdGluZ1Nlc3Npb24sIGN0eFJlcXVlc3RDb3VudCB9IGZyb20gJy4uLy4uL2NoYXQvYnJvd3Nlci9jaGF0RWRpdGluZy9jaGF0RWRpdGluZ0VkaXRvckNvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQWN0aW9uMiwgSUFjdGlvbjJPcHRpb25zLCBNZW51SWQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByLCBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSwgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvc2VydmljZXMvY29kZUVkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ09OVEVYVF9BQ0NFU1NJQklMSVRZX01PREVfRU5BQkxFRCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvY29tbW9uL2FjY2Vzc2liaWxpdHkuanMnO1xuaW1wb3J0IHsgQ29tbWFuZHNSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyByZWdpc3Rlckljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vaWNvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElQcmVmZXJlbmNlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9wcmVmZXJlbmNlcy9jb21tb24vcHJlZmVyZW5jZXMuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJQ2hhdFNlcnZpY2UgfSBmcm9tICcuLi8uLi9jaGF0L2NvbW1vbi9jaGF0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBDaGF0Q29udGV4dEtleXMgfSBmcm9tICcuLi8uLi9jaGF0L2NvbW1vbi9jaGF0Q29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgSHVua0luZm9ybWF0aW9uIH0gZnJvbSAnLi9pbmxpbmVDaGF0U2Vzc2lvbi5qcyc7XG5pbXBvcnQgeyBJQ2hhdFdpZGdldFNlcnZpY2UgfSBmcm9tICcuLi8uLi9jaGF0L2Jyb3dzZXIvY2hhdC5qcyc7XG5pbXBvcnQgeyBJSW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlIH0gZnJvbSAnLi9pbmxpbmVDaGF0U2Vzc2lvblNlcnZpY2UuanMnO1xuXG5cbkNvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQWxpYXMoJ2ludGVyYWN0aXZlRWRpdG9yLnN0YXJ0JywgJ2lubGluZUNoYXQuc3RhcnQnKTtcbkNvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQWxpYXMoJ2ludGVyYWN0aXZlLmFjY2VwdENoYW5nZXMnLCBBQ1RJT05fQUNDRVBUX0NIQU5HRVMpO1xuXG5cbmV4cG9ydCBjb25zdCBTVEFSVF9JTkxJTkVfQ0hBVCA9IHJlZ2lzdGVySWNvbignc3RhcnQtaW5saW5lLWNoYXQnLCBDb2RpY29uLnNwYXJrbGUsIGxvY2FsaXplKCdzdGFydElubGluZUNoYXQnLCAnSWNvbiB3aGljaCBzcGF3bnMgdGhlIGlubGluZSBjaGF0IGZyb20gdGhlIGVkaXRvciB0b29sYmFyLicpKTtcblxuLy8gc29tZSBneW1uYXN0aWNzIHRvIGVuYWJsZSBob2xkIGZvciBzcGVlY2ggd2l0aG91dCBtb3ZpbmcgdGhlIFN0YXJ0U2Vzc2lvbkFjdGlvbiBpbnRvIHRoZSBlbGVjdHJvbi1sYXllclxuXG5leHBvcnQgaW50ZXJmYWNlIElIb2xkRm9yU3BlZWNoIHtcblx0KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250cm9sbGVyOiBJbmxpbmVDaGF0Q29udHJvbGxlciwgc291cmNlOiBBY3Rpb24yKTogdm9pZDtcbn1cbmxldCBfaG9sZEZvclNwZWVjaDogSUhvbGRGb3JTcGVlY2ggfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5leHBvcnQgZnVuY3Rpb24gc2V0SG9sZEZvclNwZWVjaChob2xkRm9yU3BlZWNoOiBJSG9sZEZvclNwZWVjaCkge1xuXHRfaG9sZEZvclNwZWVjaCA9IGhvbGRGb3JTcGVlY2g7XG59XG5cbmV4cG9ydCBjbGFzcyBTdGFydFNlc3Npb25BY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogQUNUSU9OX1NUQVJULFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMigncnVuJywgJ0VkaXRvciBJbmxpbmUgQ2hhdCcpLFxuXHRcdFx0Y2F0ZWdvcnk6IEFic3RyYWN0SW5saW5lMUNoYXRBY3Rpb24uY2F0ZWdvcnksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRDb250ZXh0S2V5RXhwci5vcihDVFhfSU5MSU5FX0NIQVRfSEFTX0FHRU5ULCBDVFhfSU5MSU5FX0NIQVRfSEFTX0FHRU5UMiksXG5cdFx0XHRcdENUWF9JTkxJTkVfQ0hBVF9QT1NTSUJMRSxcblx0XHRcdFx0RWRpdG9yQ29udGV4dEtleXMud3JpdGFibGUsXG5cdFx0XHRcdEVkaXRvckNvbnRleHRLZXlzLmVkaXRvclNpbXBsZUlucHV0Lm5lZ2F0ZSgpXG5cdFx0XHQpLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3aGVuOiBFZGl0b3JDb250ZXh0S2V5cy5mb2N1cyxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlJXG5cdFx0XHR9LFxuXHRcdFx0aWNvbjogU1RBUlRfSU5MSU5FX0NIQVQsXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuQ2hhdFRpdGxlQmFyTWVudSxcblx0XHRcdFx0Z3JvdXA6ICdhX29wZW4nLFxuXHRcdFx0XHRvcmRlcjogMyxcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXHRvdmVycmlkZSBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IGFueVtdKTogYW55IHtcblxuXHRcdGNvbnN0IGNvZGVFZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb2RlRWRpdG9yU2VydmljZSk7XG5cdFx0Y29uc3QgZWRpdG9yID0gY29kZUVkaXRvclNlcnZpY2UuZ2V0QWN0aXZlQ29kZUVkaXRvcigpO1xuXHRcdGlmICghZWRpdG9yIHx8IGVkaXRvci5pc1NpbXBsZVdpZGdldCkge1xuXHRcdFx0Ly8gd2VsbCwgYXQgbGVhc3Qgd2UgdHJpZWQuLi5cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblxuXHRcdC8vIHByZWNvbmRpdGlvbiBkb2VzIGhvbGRcblx0XHRyZXR1cm4gZWRpdG9yLmludm9rZVdpdGhpbkNvbnRleHQoKGVkaXRvckFjY2Vzc29yKSA9PiB7XG5cdFx0XHRjb25zdCBrYlNlcnZpY2UgPSBlZGl0b3JBY2Nlc3Nvci5nZXQoSUNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGxvZ1NlcnZpY2UgPSBlZGl0b3JBY2Nlc3Nvci5nZXQoSUxvZ1NlcnZpY2UpO1xuXHRcdFx0Y29uc3QgZW5hYmxlZCA9IGtiU2VydmljZS5jb250ZXh0TWF0Y2hlc1J1bGVzKHRoaXMuZGVzYy5wcmVjb25kaXRpb24gPz8gdW5kZWZpbmVkKTtcblx0XHRcdGlmICghZW5hYmxlZCkge1xuXHRcdFx0XHRsb2dTZXJ2aWNlLmRlYnVnKGBbRWRpdG9yQWN0aW9uMl0gTk9UIHJ1bm5pbmcgY29tbWFuZCBiZWNhdXNlIGl0cyBwcmVjb25kaXRpb24gaXMgRkFMU0VgLCB0aGlzLmRlc2MuaWQsIHRoaXMuZGVzYy5wcmVjb25kaXRpb24/LnNlcmlhbGl6ZSgpKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXMuX3J1bkVkaXRvckNvbW1hbmQoZWRpdG9yQWNjZXNzb3IsIGVkaXRvciwgLi4uYXJncyk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9ydW5FZGl0b3JDb21tYW5kKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yLCAuLi5fYXJnczogYW55W10pIHtcblxuXHRcdGNvbnN0IGN0cmwgPSBJbmxpbmVDaGF0Q29udHJvbGxlci5nZXQoZWRpdG9yKTtcblx0XHRpZiAoIWN0cmwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoX2hvbGRGb3JTcGVlY2gpIHtcblx0XHRcdGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpLmludm9rZUZ1bmN0aW9uKF9ob2xkRm9yU3BlZWNoLCBjdHJsLCB0aGlzKTtcblx0XHR9XG5cblx0XHRsZXQgb3B0aW9uczogSW5saW5lQ2hhdFJ1bk9wdGlvbnMgfCB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgYXJnID0gX2FyZ3NbMF07XG5cdFx0aWYgKGFyZyAmJiBJbmxpbmVDaGF0UnVuT3B0aW9ucy5pc0lubGluZUNoYXRSdW5PcHRpb25zKGFyZykpIHtcblx0XHRcdG9wdGlvbnMgPSBhcmc7XG5cdFx0fVxuXHRcdElubGluZUNoYXRDb250cm9sbGVyLmdldChlZGl0b3IpPy5ydW4oeyAuLi5vcHRpb25zIH0pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBGb2N1c0lubGluZUNoYXQgZXh0ZW5kcyBFZGl0b3JBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2lubGluZUNoYXQuZm9jdXMnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignZm9jdXMnLCBcIkZvY3VzIElucHV0XCIpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRjYXRlZ29yeTogQWJzdHJhY3RJbmxpbmUxQ2hhdEFjdGlvbi5jYXRlZ29yeSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKEVkaXRvckNvbnRleHRLZXlzLmVkaXRvclRleHRGb2N1cywgQ1RYX0lOTElORV9DSEFUX1ZJU0lCTEUsIENUWF9JTkxJTkVfQ0hBVF9GT0NVU0VELm5lZ2F0ZSgpLCBDT05URVhUX0FDQ0VTU0lCSUxJVFlfTU9ERV9FTkFCTEVELm5lZ2F0ZSgpKSxcblx0XHRcdGtleWJpbmRpbmc6IFt7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb3JlICsgMTAsIC8vIHdpbiBhZ2FpbnN0IGNvcmVfY29tbWFuZFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ1RYX0lOTElORV9DSEFUX09VVEVSX0NVUlNPUl9QT1NJVElPTi5pc0VxdWFsVG8oJ2Fib3ZlJyksIEVkaXRvckNvbnRleHRLZXlzLmlzRW1iZWRkZWREaWZmRWRpdG9yLm5lZ2F0ZSgpKSxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkRvd25BcnJvdyxcblx0XHRcdH0sIHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvcmUgKyAxMCwgLy8gd2luIGFnYWluc3QgY29yZV9jb21tYW5kXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDVFhfSU5MSU5FX0NIQVRfT1VURVJfQ1VSU09SX1BPU0lUSU9OLmlzRXF1YWxUbygnYmVsb3cnKSwgRWRpdG9yQ29udGV4dEtleXMuaXNFbWJlZGRlZERpZmZFZGl0b3IubmVnYXRlKCkpLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuVXBBcnJvdyxcblx0XHRcdH1dXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBydW5FZGl0b3JDb21tYW5kKF9hY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvciwgLi4uX2FyZ3M6IGFueVtdKSB7XG5cdFx0SW5saW5lQ2hhdENvbnRyb2xsZXIuZ2V0KGVkaXRvcik/LmZvY3VzKCk7XG5cdH1cbn1cblxuLy8jcmVnaW9uIC0tLSBWRVJTSU9OIDFcblxuZXhwb3J0IGNsYXNzIFVuc3Rhc2hTZXNzaW9uQWN0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnaW5saW5lQ2hhdC51bnN0YXNoJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3Vuc3Rhc2gnLCBcIlJlc3VtZSBMYXN0IERpc21pc3NlZCBJbmxpbmUgQ2hhdFwiKSxcblx0XHRcdGNhdGVnb3J5OiBBYnN0cmFjdElubGluZTFDaGF0QWN0aW9uLmNhdGVnb3J5LFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoQ1RYX0lOTElORV9DSEFUX0hBU19TVEFTSEVEX1NFU1NJT04sIEVkaXRvckNvbnRleHRLZXlzLndyaXRhYmxlKSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlaLFxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuRWRpdG9yQ29tbWFuZChfYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IsIC4uLl9hcmdzOiBhbnlbXSkge1xuXHRcdGNvbnN0IGN0cmwgPSBJbmxpbmVDaGF0Q29udHJvbGxlcjEuZ2V0KGVkaXRvcik7XG5cdFx0aWYgKGN0cmwpIHtcblx0XHRcdGNvbnN0IHNlc3Npb24gPSBjdHJsLnVuc3Rhc2hMYXN0U2Vzc2lvbigpO1xuXHRcdFx0aWYgKHNlc3Npb24pIHtcblx0XHRcdFx0Y3RybC5ydW4oe1xuXHRcdFx0XHRcdGV4aXN0aW5nU2Vzc2lvbjogc2Vzc2lvbixcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBBYnN0cmFjdElubGluZTFDaGF0QWN0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uMiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IGNhdGVnb3J5ID0gbG9jYWxpemUyKCdjYXQnLCBcIklubGluZSBDaGF0XCIpO1xuXG5cdGNvbnN0cnVjdG9yKGRlc2M6IElBY3Rpb24yT3B0aW9ucykge1xuXHRcdHN1cGVyKHtcblx0XHRcdC4uLmRlc2MsXG5cdFx0XHRjYXRlZ29yeTogQWJzdHJhY3RJbmxpbmUxQ2hhdEFjdGlvbi5jYXRlZ29yeSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKENUWF9JTkxJTkVfQ0hBVF9IQVNfQUdFTlQsIGRlc2MucHJlY29uZGl0aW9uKVxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgcnVuRWRpdG9yQ29tbWFuZChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvciwgLi4uX2FyZ3M6IGFueVtdKSB7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0Y29uc3QgbG9nU2VydmljZSA9IGFjY2Vzc29yLmdldChJTG9nU2VydmljZSk7XG5cblx0XHRsZXQgY3RybCA9IElubGluZUNoYXRDb250cm9sbGVyMS5nZXQoZWRpdG9yKTtcblx0XHRpZiAoIWN0cmwpIHtcblx0XHRcdGNvbnN0IHsgYWN0aXZlVGV4dEVkaXRvckNvbnRyb2wgfSA9IGVkaXRvclNlcnZpY2U7XG5cdFx0XHRpZiAoaXNDb2RlRWRpdG9yKGFjdGl2ZVRleHRFZGl0b3JDb250cm9sKSkge1xuXHRcdFx0XHRlZGl0b3IgPSBhY3RpdmVUZXh0RWRpdG9yQ29udHJvbDtcblx0XHRcdH0gZWxzZSBpZiAoaXNEaWZmRWRpdG9yKGFjdGl2ZVRleHRFZGl0b3JDb250cm9sKSkge1xuXHRcdFx0XHRlZGl0b3IgPSBhY3RpdmVUZXh0RWRpdG9yQ29udHJvbC5nZXRNb2RpZmllZEVkaXRvcigpO1xuXHRcdFx0fVxuXHRcdFx0Y3RybCA9IElubGluZUNoYXRDb250cm9sbGVyMS5nZXQoZWRpdG9yKTtcblx0XHR9XG5cblx0XHRpZiAoIWN0cmwpIHtcblx0XHRcdGxvZ1NlcnZpY2Uud2FybignW0lFXSBOTyBjb250cm9sbGVyIGZvdW5kIGZvciBhY3Rpb24nLCB0aGlzLmRlc2MuaWQsIGVkaXRvci5nZXRNb2RlbCgpPy51cmkpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChlZGl0b3IgaW5zdGFuY2VvZiBFbWJlZGRlZENvZGVFZGl0b3JXaWRnZXQpIHtcblx0XHRcdGVkaXRvciA9IGVkaXRvci5nZXRQYXJlbnRFZGl0b3IoKTtcblx0XHR9XG5cdFx0aWYgKCFjdHJsKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGRpZmZFZGl0b3Igb2YgYWNjZXNzb3IuZ2V0KElDb2RlRWRpdG9yU2VydmljZSkubGlzdERpZmZFZGl0b3JzKCkpIHtcblx0XHRcdFx0aWYgKGRpZmZFZGl0b3IuZ2V0T3JpZ2luYWxFZGl0b3IoKSA9PT0gZWRpdG9yIHx8IGRpZmZFZGl0b3IuZ2V0TW9kaWZpZWRFZGl0b3IoKSA9PT0gZWRpdG9yKSB7XG5cdFx0XHRcdFx0aWYgKGRpZmZFZGl0b3IgaW5zdGFuY2VvZiBFbWJlZGRlZERpZmZFZGl0b3JXaWRnZXQpIHtcblx0XHRcdFx0XHRcdHRoaXMucnVuRWRpdG9yQ29tbWFuZChhY2Nlc3NvciwgZGlmZkVkaXRvci5nZXRQYXJlbnRFZGl0b3IoKSwgLi4uX2FyZ3MpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLnJ1bklubGluZUNoYXRDb21tYW5kKGFjY2Vzc29yLCBjdHJsLCBlZGl0b3IsIC4uLl9hcmdzKTtcblx0fVxuXG5cdGFic3RyYWN0IHJ1bklubGluZUNoYXRDb21tYW5kKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjdHJsOiBJbmxpbmVDaGF0Q29udHJvbGxlcjEsIGVkaXRvcjogSUNvZGVFZGl0b3IsIC4uLmFyZ3M6IGFueVtdKTogdm9pZDtcbn1cblxuZXhwb3J0IGNsYXNzIEFycm93T3V0VXBBY3Rpb24gZXh0ZW5kcyBBYnN0cmFjdElubGluZTFDaGF0QWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdpbmxpbmVDaGF0LmFycm93T3V0VXAnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdhcnJvd1VwJywgJ0N1cnNvciBVcCcpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoQ1RYX0lOTElORV9DSEFUX0ZPQ1VTRUQsIENUWF9JTkxJTkVfQ0hBVF9JTk5FUl9DVVJTT1JfRklSU1QsIEVkaXRvckNvbnRleHRLZXlzLmlzRW1iZWRkZWREaWZmRWRpdG9yLm5lZ2F0ZSgpLCBDT05URVhUX0FDQ0VTU0lCSUxJVFlfTU9ERV9FTkFCTEVELm5lZ2F0ZSgpKSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvcmUsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5VcEFycm93XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRydW5JbmxpbmVDaGF0Q29tbWFuZChfYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGN0cmw6IElubGluZUNoYXRDb250cm9sbGVyMSwgX2VkaXRvcjogSUNvZGVFZGl0b3IsIC4uLl9hcmdzOiBhbnlbXSk6IHZvaWQge1xuXHRcdGN0cmwuYXJyb3dPdXQodHJ1ZSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEFycm93T3V0RG93bkFjdGlvbiBleHRlbmRzIEFic3RyYWN0SW5saW5lMUNoYXRBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2lubGluZUNoYXQuYXJyb3dPdXREb3duJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnYXJyb3dEb3duJywgJ0N1cnNvciBEb3duJyksXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChDVFhfSU5MSU5FX0NIQVRfRk9DVVNFRCwgQ1RYX0lOTElORV9DSEFUX0lOTkVSX0NVUlNPUl9MQVNULCBFZGl0b3JDb250ZXh0S2V5cy5pc0VtYmVkZGVkRGlmZkVkaXRvci5uZWdhdGUoKSwgQ09OVEVYVF9BQ0NFU1NJQklMSVRZX01PREVfRU5BQkxFRC5uZWdhdGUoKSksXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb3JlLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRG93bkFycm93XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRydW5JbmxpbmVDaGF0Q29tbWFuZChfYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGN0cmw6IElubGluZUNoYXRDb250cm9sbGVyMSwgX2VkaXRvcjogSUNvZGVFZGl0b3IsIC4uLl9hcmdzOiBhbnlbXSk6IHZvaWQge1xuXHRcdGN0cmwuYXJyb3dPdXQoZmFsc2UpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBBY2NlcHRDaGFuZ2VzIGV4dGVuZHMgQWJzdHJhY3RJbmxpbmUxQ2hhdEFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IEFDVElPTl9BQ0NFUFRfQ0hBTkdFUyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2FwcGx5MScsIFwiQWNjZXB0IENoYW5nZXNcIiksXG5cdFx0XHRzaG9ydFRpdGxlOiBsb2NhbGl6ZSgnYXBwbHkyJywgJ0FjY2VwdCcpLFxuXHRcdFx0aWNvbjogQ29kaWNvbi5jaGVjayxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoQ1RYX0lOTElORV9DSEFUX1ZJU0lCTEUpLFxuXHRcdFx0a2V5YmluZGluZzogW3tcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIgKyAxMCxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkVudGVyLFxuXHRcdFx0fV0sXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTUVOVV9JTkxJTkVfQ0hBVF9XSURHRVRfU1RBVFVTLFxuXHRcdFx0XHRncm91cDogJzBfbWFpbicsXG5cdFx0XHRcdG9yZGVyOiAxLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0Q2hhdENvbnRleHRLZXlzLmlucHV0SGFzVGV4dC50b05lZ2F0ZWQoKSxcblx0XHRcdFx0XHRDVFhfSU5MSU5FX0NIQVRfUkVRVUVTVF9JTl9QUk9HUkVTUy50b05lZ2F0ZWQoKSxcblx0XHRcdFx0XHRDVFhfSU5MSU5FX0NIQVRfUkVTUE9OU0VfVFlQRS5pc0VxdWFsVG8oSW5saW5lQ2hhdFJlc3BvbnNlVHlwZS5NZXNzYWdlc0FuZEVkaXRzKVxuXHRcdFx0XHQpLFxuXHRcdFx0fSwge1xuXHRcdFx0XHRpZDogTUVOVV9JTkxJTkVfQ0hBVF9aT05FLFxuXHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRvcmRlcjogMSxcblx0XHRcdH1dXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW5JbmxpbmVDaGF0Q29tbWFuZChfYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGN0cmw6IElubGluZUNoYXRDb250cm9sbGVyMSwgX2VkaXRvcjogSUNvZGVFZGl0b3IsIGh1bms/OiBIdW5rSW5mb3JtYXRpb24gfCBhbnkpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjdHJsLmFjY2VwdEh1bmsoaHVuayk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIERpc2NhcmRIdW5rQWN0aW9uIGV4dGVuZHMgQWJzdHJhY3RJbmxpbmUxQ2hhdEFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IEFDVElPTl9ESVNDQVJEX0NIQU5HRVMsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ2Rpc2NhcmQnLCAnRGlzY2FyZCcpLFxuXHRcdFx0aWNvbjogQ29kaWNvbi5jaHJvbWVDbG9zZSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ1RYX0lOTElORV9DSEFUX1ZJU0lCTEUsXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTUVOVV9JTkxJTkVfQ0hBVF9aT05FLFxuXHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRvcmRlcjogMlxuXHRcdFx0fV0sXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlDb2RlLkVzY2FwZSxcblx0XHRcdFx0d2hlbjogQ1RYX0lOTElORV9DSEFUX1JFU1BPTlNFX1RZUEUuaXNFcXVhbFRvKElubGluZUNoYXRSZXNwb25zZVR5cGUuTWVzc2FnZXNBbmRFZGl0cylcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bklubGluZUNoYXRDb21tYW5kKF9hY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY3RybDogSW5saW5lQ2hhdENvbnRyb2xsZXIxLCBfZWRpdG9yOiBJQ29kZUVkaXRvciwgaHVuaz86IEh1bmtJbmZvcm1hdGlvbiB8IGFueSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiBjdHJsLmRpc2NhcmRIdW5rKGh1bmspO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBSZXJ1bkFjdGlvbiBleHRlbmRzIEFic3RyYWN0SW5saW5lMUNoYXRBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogQUNUSU9OX1JFR0VORVJBVEVfUkVTUE9OU0UsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdjaGF0LnJlcnVuLmxhYmVsJywgXCJSZXJ1biBSZXF1ZXN0XCIpLFxuXHRcdFx0c2hvcnRUaXRsZTogbG9jYWxpemUoJ3JlcnVuJywgJ1JlcnVuJyksXG5cdFx0XHRmMTogZmFsc2UsXG5cdFx0XHRpY29uOiBDb2RpY29uLnJlZnJlc2gsXG5cdFx0XHRwcmVjb25kaXRpb246IENUWF9JTkxJTkVfQ0hBVF9WSVNJQkxFLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTUVOVV9JTkxJTkVfQ0hBVF9XSURHRVRfU1RBVFVTLFxuXHRcdFx0XHRncm91cDogJzBfbWFpbicsXG5cdFx0XHRcdG9yZGVyOiA1LFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0Q2hhdENvbnRleHRLZXlzLmlucHV0SGFzVGV4dC50b05lZ2F0ZWQoKSxcblx0XHRcdFx0XHRDVFhfSU5MSU5FX0NIQVRfUkVRVUVTVF9JTl9QUk9HUkVTUy5uZWdhdGUoKSxcblx0XHRcdFx0XHRDVFhfSU5MSU5FX0NIQVRfUkVTUE9OU0VfVFlQRS5ub3RFcXVhbHNUbyhJbmxpbmVDaGF0UmVzcG9uc2VUeXBlLk5vbmUpXG5cdFx0XHRcdClcblx0XHRcdH0sXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5UlxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuSW5saW5lQ2hhdENvbW1hbmQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGN0cmw6IElubGluZUNoYXRDb250cm9sbGVyMSwgX2VkaXRvcjogSUNvZGVFZGl0b3IsIC4uLl9hcmdzOiBhbnlbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGNoYXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDaGF0U2VydmljZSk7XG5cdFx0Y29uc3QgY2hhdFdpZGdldFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRXaWRnZXRTZXJ2aWNlKTtcblx0XHRjb25zdCBtb2RlbCA9IGN0cmwuY2hhdFdpZGdldC52aWV3TW9kZWw/Lm1vZGVsO1xuXHRcdGlmICghbW9kZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBsYXN0UmVxdWVzdCA9IG1vZGVsLmdldFJlcXVlc3RzKCkuYXQoLTEpO1xuXHRcdGlmIChsYXN0UmVxdWVzdCkge1xuXHRcdFx0Y29uc3Qgd2lkZ2V0ID0gY2hhdFdpZGdldFNlcnZpY2UuZ2V0V2lkZ2V0QnlTZXNzaW9uSWQobW9kZWwuc2Vzc2lvbklkKTtcblx0XHRcdGF3YWl0IGNoYXRTZXJ2aWNlLnJlc2VuZFJlcXVlc3QobGFzdFJlcXVlc3QsIHtcblx0XHRcdFx0bm9Db21tYW5kRGV0ZWN0aW9uOiBmYWxzZSxcblx0XHRcdFx0YXR0ZW1wdDogbGFzdFJlcXVlc3QuYXR0ZW1wdCArIDEsXG5cdFx0XHRcdGxvY2F0aW9uOiBjdHJsLmNoYXRXaWRnZXQubG9jYXRpb24sXG5cdFx0XHRcdHVzZXJTZWxlY3RlZE1vZGVsSWQ6IHdpZGdldD8uaW5wdXQuY3VycmVudExhbmd1YWdlTW9kZWxcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ2xvc2VBY3Rpb24gZXh0ZW5kcyBBYnN0cmFjdElubGluZTFDaGF0QWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2lubGluZUNoYXQuY2xvc2UnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdjbG9zZScsICdDbG9zZScpLFxuXHRcdFx0aWNvbjogQ29kaWNvbi5jbG9zZSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ1RYX0lOTElORV9DSEFUX1ZJU0lCTEUsXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliICsgMSxcblx0XHRcdFx0cHJpbWFyeTogS2V5Q29kZS5Fc2NhcGUsXG5cdFx0XHR9LFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1FTlVfSU5MSU5FX0NIQVRfV0lER0VUX1NUQVRVUyxcblx0XHRcdFx0Z3JvdXA6ICcwX21haW4nLFxuXHRcdFx0XHRvcmRlcjogMSxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdENUWF9JTkxJTkVfQ0hBVF9SRVFVRVNUX0lOX1BST0dSRVNTLm5lZ2F0ZSgpXG5cdFx0XHRcdCksXG5cdFx0XHR9XVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuSW5saW5lQ2hhdENvbW1hbmQoX2FjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjdHJsOiBJbmxpbmVDaGF0Q29udHJvbGxlcjEsIF9lZGl0b3I6IElDb2RlRWRpdG9yLCAuLi5fYXJnczogYW55W10pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjdHJsLmNhbmNlbFNlc3Npb24oKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ29uZmlndXJlSW5saW5lQ2hhdEFjdGlvbiBleHRlbmRzIEFic3RyYWN0SW5saW5lMUNoYXRBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2lubGluZUNoYXQuY29uZmlndXJlJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2NvbmZpZ3VyZScsICdDb25maWd1cmUgSW5saW5lIENoYXQnKSxcblx0XHRcdGljb246IENvZGljb24uc2V0dGluZ3NHZWFyLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDVFhfSU5MSU5FX0NIQVRfVklTSUJMRSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTUVOVV9JTkxJTkVfQ0hBVF9XSURHRVRfU1RBVFVTLFxuXHRcdFx0XHRncm91cDogJ3p6eicsXG5cdFx0XHRcdG9yZGVyOiA1XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW5JbmxpbmVDaGF0Q29tbWFuZChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY3RybDogSW5saW5lQ2hhdENvbnRyb2xsZXIxLCBfZWRpdG9yOiBJQ29kZUVkaXRvciwgLi4uX2FyZ3M6IGFueVtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YWNjZXNzb3IuZ2V0KElQcmVmZXJlbmNlc1NlcnZpY2UpLm9wZW5TZXR0aW5ncyh7IHF1ZXJ5OiAnaW5saW5lQ2hhdCcgfSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE1vdmVUb05leHRIdW5rIGV4dGVuZHMgQWJzdHJhY3RJbmxpbmUxQ2hhdEFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdpbmxpbmVDaGF0Lm1vdmVUb05leHRIdW5rJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ21vdmVUb05leHRIdW5rJywgJ01vdmUgdG8gTmV4dCBDaGFuZ2UnKSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ1RYX0lOTElORV9DSEFUX1ZJU0lCTEUsXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNvZGUuRjdcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIHJ1bklubGluZUNoYXRDb21tYW5kKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjdHJsOiBJbmxpbmVDaGF0Q29udHJvbGxlcjEsIGVkaXRvcjogSUNvZGVFZGl0b3IsIC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XG5cdFx0Y3RybC5tb3ZlSHVuayh0cnVlKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTW92ZVRvUHJldmlvdXNIdW5rIGV4dGVuZHMgQWJzdHJhY3RJbmxpbmUxQ2hhdEFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdpbmxpbmVDaGF0Lm1vdmVUb1ByZXZpb3VzSHVuaycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdtb3ZlVG9QcmV2aW91c0h1bmsnLCAnTW92ZSB0byBQcmV2aW91cyBDaGFuZ2UnKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDVFhfSU5MSU5FX0NIQVRfVklTSUJMRSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuRjdcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIHJ1bklubGluZUNoYXRDb21tYW5kKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjdHJsOiBJbmxpbmVDaGF0Q29udHJvbGxlcjEsIGVkaXRvcjogSUNvZGVFZGl0b3IsIC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XG5cdFx0Y3RybC5tb3ZlSHVuayhmYWxzZSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFZpZXdJbkNoYXRBY3Rpb24gZXh0ZW5kcyBBYnN0cmFjdElubGluZTFDaGF0QWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IEFDVElPTl9WSUVXX0lOX0NIQVQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ3ZpZXdJbkNoYXQnLCAnVmlldyBpbiBDaGF0JyksXG5cdFx0XHRpY29uOiBDb2RpY29uLmNvbW1lbnREaXNjdXNzaW9uLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDVFhfSU5MSU5FX0NIQVRfVklTSUJMRSxcblx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdGlkOiBNRU5VX0lOTElORV9DSEFUX1dJREdFVF9TVEFUVVMsXG5cdFx0XHRcdGdyb3VwOiAnbW9yZScsXG5cdFx0XHRcdG9yZGVyOiAxLFxuXHRcdFx0XHR3aGVuOiBDVFhfSU5MSU5FX0NIQVRfUkVTUE9OU0VfVFlQRS5ub3RFcXVhbHNUbyhJbmxpbmVDaGF0UmVzcG9uc2VUeXBlLk1lc3NhZ2VzKVxuXHRcdFx0fSwge1xuXHRcdFx0XHRpZDogTUVOVV9JTkxJTkVfQ0hBVF9XSURHRVRfU1RBVFVTLFxuXHRcdFx0XHRncm91cDogJzBfbWFpbicsXG5cdFx0XHRcdG9yZGVyOiAxLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0Q2hhdENvbnRleHRLZXlzLmlucHV0SGFzVGV4dC50b05lZ2F0ZWQoKSxcblx0XHRcdFx0XHRDVFhfSU5MSU5FX0NIQVRfUkVTUE9OU0VfVFlQRS5pc0VxdWFsVG8oSW5saW5lQ2hhdFJlc3BvbnNlVHlwZS5NZXNzYWdlcyksXG5cdFx0XHRcdFx0Q1RYX0lOTElORV9DSEFUX1JFUVVFU1RfSU5fUFJPR1JFU1MubmVnYXRlKClcblx0XHRcdFx0KVxuXHRcdFx0fV0sXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRG93bkFycm93LFxuXHRcdFx0XHR3aGVuOiBDaGF0Q29udGV4dEtleXMuaW5DaGF0SW5wdXRcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXHRvdmVycmlkZSBydW5JbmxpbmVDaGF0Q29tbWFuZChfYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGN0cmw6IElubGluZUNoYXRDb250cm9sbGVyMSwgX2VkaXRvcjogSUNvZGVFZGl0b3IsIC4uLl9hcmdzOiBhbnlbXSkge1xuXHRcdHJldHVybiBjdHJsLnZpZXdJbkNoYXQoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVG9nZ2xlRGlmZkZvckNoYW5nZSBleHRlbmRzIEFic3RyYWN0SW5saW5lMUNoYXRBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBBQ1RJT05fVE9HR0xFX0RJRkYsXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChDVFhfSU5MSU5FX0NIQVRfVklTSUJMRSwgQ1RYX0lOTElORV9DSEFUX0NIQU5HRV9IQVNfRElGRiksXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdzaG93Q2hhbmdlcycsICdUb2dnbGUgQ2hhbmdlcycpLFxuXHRcdFx0aWNvbjogQ29kaWNvbi5kaWZmU2luZ2xlLFxuXHRcdFx0dG9nZ2xlZDoge1xuXHRcdFx0XHRjb25kaXRpb246IENUWF9JTkxJTkVfQ0hBVF9DSEFOR0VfU0hPV1NfRElGRixcblx0XHRcdH0sXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTUVOVV9JTkxJTkVfQ0hBVF9XSURHRVRfU1RBVFVTLFxuXHRcdFx0XHRncm91cDogJ3p6eicsXG5cdFx0XHRcdG9yZGVyOiAxLFxuXHRcdFx0fSwge1xuXHRcdFx0XHRpZDogTUVOVV9JTkxJTkVfQ0hBVF9aT05FLFxuXHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHR3aGVuOiBDVFhfSU5MSU5FX0NIQVRfQ0hBTkdFX0hBU19ESUZGLFxuXHRcdFx0XHRvcmRlcjogMlxuXHRcdFx0fV1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIHJ1bklubGluZUNoYXRDb21tYW5kKF9hY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY3RybDogSW5saW5lQ2hhdENvbnRyb2xsZXIxLCBfZWRpdG9yOiBJQ29kZUVkaXRvciwgaHVua0luZm86IEh1bmtJbmZvcm1hdGlvbiB8IGFueSk6IHZvaWQge1xuXHRcdGN0cmwudG9nZ2xlRGlmZihodW5rSW5mbyk7XG5cdH1cbn1cblxuLy8jZW5kcmVnaW9uXG5cblxuLy8jcmVnaW9uIC0tLSBWRVJTSU9OIDJcbmFic3RyYWN0IGNsYXNzIEFic3RyYWN0SW5saW5lMkNoYXRBY3Rpb24gZXh0ZW5kcyBFZGl0b3JBY3Rpb24yIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgY2F0ZWdvcnkgPSBsb2NhbGl6ZTIoJ2NhdCcsIFwiSW5saW5lIENoYXRcIik7XG5cblx0Y29uc3RydWN0b3IoZGVzYzogSUFjdGlvbjJPcHRpb25zKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0Li4uZGVzYyxcblx0XHRcdGNhdGVnb3J5OiBBYnN0cmFjdElubGluZTJDaGF0QWN0aW9uLmNhdGVnb3J5LFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoQ1RYX0lOTElORV9DSEFUX0hBU19BR0VOVDIsIGRlc2MucHJlY29uZGl0aW9uKVxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgcnVuRWRpdG9yQ29tbWFuZChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvciwgLi4uX2FyZ3M6IGFueVtdKSB7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0Y29uc3QgbG9nU2VydmljZSA9IGFjY2Vzc29yLmdldChJTG9nU2VydmljZSk7XG5cblx0XHRsZXQgY3RybCA9IElubGluZUNoYXRDb250cm9sbGVyMi5nZXQoZWRpdG9yKTtcblx0XHRpZiAoIWN0cmwpIHtcblx0XHRcdGNvbnN0IHsgYWN0aXZlVGV4dEVkaXRvckNvbnRyb2wgfSA9IGVkaXRvclNlcnZpY2U7XG5cdFx0XHRpZiAoaXNDb2RlRWRpdG9yKGFjdGl2ZVRleHRFZGl0b3JDb250cm9sKSkge1xuXHRcdFx0XHRlZGl0b3IgPSBhY3RpdmVUZXh0RWRpdG9yQ29udHJvbDtcblx0XHRcdH0gZWxzZSBpZiAoaXNEaWZmRWRpdG9yKGFjdGl2ZVRleHRFZGl0b3JDb250cm9sKSkge1xuXHRcdFx0XHRlZGl0b3IgPSBhY3RpdmVUZXh0RWRpdG9yQ29udHJvbC5nZXRNb2RpZmllZEVkaXRvcigpO1xuXHRcdFx0fVxuXHRcdFx0Y3RybCA9IElubGluZUNoYXRDb250cm9sbGVyMi5nZXQoZWRpdG9yKTtcblx0XHR9XG5cblx0XHRpZiAoIWN0cmwpIHtcblx0XHRcdGxvZ1NlcnZpY2Uud2FybignW0lFXSBOTyBjb250cm9sbGVyIGZvdW5kIGZvciBhY3Rpb24nLCB0aGlzLmRlc2MuaWQsIGVkaXRvci5nZXRNb2RlbCgpPy51cmkpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChlZGl0b3IgaW5zdGFuY2VvZiBFbWJlZGRlZENvZGVFZGl0b3JXaWRnZXQpIHtcblx0XHRcdGVkaXRvciA9IGVkaXRvci5nZXRQYXJlbnRFZGl0b3IoKTtcblx0XHR9XG5cdFx0aWYgKCFjdHJsKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGRpZmZFZGl0b3Igb2YgYWNjZXNzb3IuZ2V0KElDb2RlRWRpdG9yU2VydmljZSkubGlzdERpZmZFZGl0b3JzKCkpIHtcblx0XHRcdFx0aWYgKGRpZmZFZGl0b3IuZ2V0T3JpZ2luYWxFZGl0b3IoKSA9PT0gZWRpdG9yIHx8IGRpZmZFZGl0b3IuZ2V0TW9kaWZpZWRFZGl0b3IoKSA9PT0gZWRpdG9yKSB7XG5cdFx0XHRcdFx0aWYgKGRpZmZFZGl0b3IgaW5zdGFuY2VvZiBFbWJlZGRlZERpZmZFZGl0b3JXaWRnZXQpIHtcblx0XHRcdFx0XHRcdHRoaXMucnVuRWRpdG9yQ29tbWFuZChhY2Nlc3NvciwgZGlmZkVkaXRvci5nZXRQYXJlbnRFZGl0b3IoKSwgLi4uX2FyZ3MpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLnJ1bklubGluZUNoYXRDb21tYW5kKGFjY2Vzc29yLCBjdHJsLCBlZGl0b3IsIC4uLl9hcmdzKTtcblx0fVxuXG5cdGFic3RyYWN0IHJ1bklubGluZUNoYXRDb21tYW5kKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjdHJsOiBJbmxpbmVDaGF0Q29udHJvbGxlcjIsIGVkaXRvcjogSUNvZGVFZGl0b3IsIC4uLmFyZ3M6IGFueVtdKTogdm9pZDtcbn1cblxuZXhwb3J0IGNsYXNzIFN0b3BTZXNzaW9uQWN0aW9uMiBleHRlbmRzIEFic3RyYWN0SW5saW5lMkNoYXRBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnaW5saW5lQ2hhdDIuc3RvcCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdzdG9wJywgXCJVbmRvICYgQ2xvc2VcIiksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGljb246IENvZGljb24uY2xvc2UsXG5cdFx0XHRwcmVjb25kaXRpb246IENUWF9JTkxJTkVfQ0hBVF9WSVNJQkxFLFxuXHRcdFx0a2V5YmluZGluZzogW3tcblx0XHRcdFx0d2hlbjogY3R4UmVxdWVzdENvdW50LmlzRXF1YWxUbygwKSxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlJLFxuXHRcdFx0fSwge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogS2V5Q29kZS5Fc2NhcGUsXG5cdFx0XHR9XSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1FTlVfSU5MSU5FX0NIQVRfU0lERSxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0d2hlbjogQ1RYX0lOTElORV9DSEFUX0hBU19BR0VOVDJcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHJ1bklubGluZUNoYXRDb21tYW5kKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBfY3RybDogSW5saW5lQ2hhdENvbnRyb2xsZXIyLCBlZGl0b3I6IElDb2RlRWRpdG9yLCAuLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xuXHRcdGNvbnN0IGlubGluZUNoYXRTZXNzaW9ucyA9IGFjY2Vzc29yLmdldChJSW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlKTtcblx0XHRpZiAoIWVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHRleHRNb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGlubGluZUNoYXRTZXNzaW9ucy5nZXRTZXNzaW9uMih0ZXh0TW9kZWwudXJpKT8uZGlzcG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBSZXZlYWxXaWRnZXQgZXh0ZW5kcyBBYnN0cmFjdElubGluZTJDaGF0QWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdpbmxpbmVDaGF0Mi5yZXZlYWwnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMigncmV2ZWFsJywgXCJUb2dnbGUgSW5saW5lIENoYXRcIiksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGljb246IENvZGljb24uY29waWxvdCxcblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKGN0eElzR2xvYmFsRWRpdGluZ1Nlc3Npb24ubmVnYXRlKCksIENvbnRleHRLZXlFeHByLmdyZWF0ZXJFcXVhbHMoY3R4UmVxdWVzdENvdW50LmtleSwgMSkpLFxuXHRcdFx0dG9nZ2xlZDogQ1RYX0lOTElORV9DSEFUX1ZJU0lCTEUsXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SVxuXHRcdFx0fSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5DaGF0RWRpdGluZ0VkaXRvckNvbnRlbnQsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5ncmVhdGVyRXF1YWxzKGN0eFJlcXVlc3RDb3VudC5rZXksIDEpLFxuXHRcdFx0XHRcdGN0eElzR2xvYmFsRWRpdGluZ1Nlc3Npb24ubmVnYXRlKCksXG5cdFx0XHRcdCksXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGUnLFxuXHRcdFx0XHRvcmRlcjogNCxcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHJ1bklubGluZUNoYXRDb21tYW5kKF9hY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY3RybDogSW5saW5lQ2hhdENvbnRyb2xsZXIyLCBfZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRcdGN0cmwudG9nZ2xlV2lkZ2V0VW50aWxOZXh0UmVxdWVzdCgpO1xuXHRcdGN0cmwubWFya0FjdGl2ZUNvbnRyb2xsZXIoKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsU0FBUyxjQUFjO0FBQ2hDLFNBQXNCLGNBQWMsb0JBQW9CO0FBQ3hELFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMs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
