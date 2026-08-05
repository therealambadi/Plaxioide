import { Codicon } from "../../../../../../base/common/codicons.js";
import { KeyChord, KeyCode, KeyMod } from "../../../../../../base/common/keyCodes.js";
import { EditorContextKeys } from "../../../../../../editor/common/editorContextKeys.js";
import { localize, localize2 } from "../../../../../../nls.js";
import { CONTEXT_ACCESSIBILITY_MODE_ENABLED } from "../../../../../../platform/accessibility/common/accessibility.js";
import { MenuId, MenuRegistry, registerAction2 } from "../../../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr } from "../../../../../../platform/contextkey/common/contextkey.js";
import { InputFocusedContextKey } from "../../../../../../platform/contextkey/common/contextkeys.js";
import { KeybindingWeight } from "../../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { CTX_INLINE_CHAT_FOCUSED, CTX_INLINE_CHAT_INNER_CURSOR_FIRST, CTX_INLINE_CHAT_INNER_CURSOR_LAST, CTX_INLINE_CHAT_REQUEST_IN_PROGRESS, CTX_INLINE_CHAT_RESPONSE_TYPE, CTX_INLINE_CHAT_VISIBLE, InlineChatResponseType, MENU_INLINE_CHAT_WIDGET_STATUS } from "../../../../inlineChat/common/inlineChat.js";
import { CTX_NOTEBOOK_CELL_CHAT_FOCUSED, CTX_NOTEBOOK_CHAT_HAS_ACTIVE_REQUEST, CTX_NOTEBOOK_CHAT_HAS_AGENT, CTX_NOTEBOOK_CHAT_OUTER_FOCUS_POSITION, CTX_NOTEBOOK_CHAT_USER_DID_EDIT, MENU_CELL_CHAT_INPUT, MENU_CELL_CHAT_WIDGET, MENU_CELL_CHAT_WIDGET_STATUS } from "./notebookChatContext.js";
import { NotebookChatController } from "./notebookChatController.js";
import { CELL_TITLE_CELL_GROUP_ID, NotebookAction, NotebookCellAction, getContextFromActiveEditor, getEditorFromArgsOrActivePane } from "../coreActions.js";
import { insertNewCell } from "../insertCellActions.js";
import { CellEditState } from "../../notebookBrowser.js";
import { CellKind, NOTEBOOK_EDITOR_CURSOR_BOUNDARY, NotebookSetting } from "../../../common/notebookCommon.js";
import { IS_COMPOSITE_NOTEBOOK, NOTEBOOK_CELL_EDITOR_FOCUSED, NOTEBOOK_CELL_GENERATED_BY_CHAT, NOTEBOOK_EDITOR_EDITABLE, NOTEBOOK_EDITOR_FOCUSED } from "../../../common/notebookContextKeys.js";
import { Iterable } from "../../../../../../base/common/iterator.js";
import { IEditorService } from "../../../../../services/editor/common/editorService.js";
import { ChatContextKeys } from "../../../../chat/common/chatContextKeys.js";
import { InlineChatController } from "../../../../inlineChat/browser/inlineChatController.js";
import { EditorAction2 } from "../../../../../../editor/browser/editorExtensions.js";
registerAction2(class extends NotebookAction {
  constructor() {
    super(
      {
        id: "notebook.cell.chat.accept",
        title: localize2("notebook.cell.chat.accept", "Make Request"),
        icon: Codicon.send,
        keybinding: {
          when: ContextKeyExpr.and(CTX_NOTEBOOK_CELL_CHAT_FOCUSED, CTX_INLINE_CHAT_FOCUSED, NOTEBOOK_CELL_EDITOR_FOCUSED.negate()),
          weight: KeybindingWeight.WorkbenchContrib,
          primary: KeyCode.Enter
        },
        menu: {
          id: MENU_CELL_CHAT_INPUT,
          group: "navigation",
          order: 1,
          when: CTX_NOTEBOOK_CHAT_HAS_ACTIVE_REQUEST.negate()
        },
        f1: false
      }
    );
  }
  async runWithContext(accessor, context) {
    NotebookChatController.get(context.notebookEditor)?.acceptInput();
  }
});
registerAction2(class extends NotebookCellAction {
  constructor() {
    super(
      {
        id: "notebook.cell.chat.arrowOutUp",
        title: localize("arrowUp", "Cursor Up"),
        keybinding: {
          when: ContextKeyExpr.and(
            CTX_NOTEBOOK_CELL_CHAT_FOCUSED,
            CTX_INLINE_CHAT_FOCUSED,
            CTX_INLINE_CHAT_INNER_CURSOR_FIRST,
            NOTEBOOK_CELL_EDITOR_FOCUSED.negate(),
            CONTEXT_ACCESSIBILITY_MODE_ENABLED.negate()
          ),
          weight: KeybindingWeight.EditorCore + 7,
          primary: KeyMod.CtrlCmd | KeyCode.UpArrow
        },
        f1: false
      }
    );
  }
  async runWithContext(accessor, context) {
    const editor = context.notebookEditor;
    const activeCell = context.cell;
    const idx = editor.getCellIndex(activeCell);
    if (typeof idx !== "number") {
      return;
    }
    if (idx < 1 || editor.getLength() === 0) {
      return;
    }
    const newCell = editor.cellAt(idx - 1);
    const newFocusMode = newCell.cellKind === CellKind.Markup && newCell.getEditState() === CellEditState.Preview ? "container" : "editor";
    const focusEditorLine = newCell.textBuffer.getLineCount();
    await editor.focusNotebookCell(newCell, newFocusMode, { focusEditorLine });
  }
});
registerAction2(class extends NotebookAction {
  constructor() {
    super(
      {
        id: "notebook.cell.chat.arrowOutDown",
        title: localize("arrowDown", "Cursor Down"),
        keybinding: {
          when: ContextKeyExpr.and(
            CTX_NOTEBOOK_CELL_CHAT_FOCUSED,
            CTX_INLINE_CHAT_FOCUSED,
            CTX_INLINE_CHAT_INNER_CURSOR_LAST,
            NOTEBOOK_CELL_EDITOR_FOCUSED.negate(),
            CONTEXT_ACCESSIBILITY_MODE_ENABLED.negate()
          ),
          weight: KeybindingWeight.EditorCore + 7,
          primary: KeyMod.CtrlCmd | KeyCode.DownArrow
        },
        f1: false
      }
    );
  }
  async runWithContext(accessor, context) {
    await NotebookChatController.get(context.notebookEditor)?.focusNext();
  }
});
registerAction2(class extends NotebookCellAction {
  constructor() {
    super(
      {
        id: "notebook.cell.focusChatWidget",
        title: localize("focusChatWidget", "Focus Chat Widget"),
        keybinding: {
          when: ContextKeyExpr.and(
            NOTEBOOK_EDITOR_FOCUSED,
            CONTEXT_ACCESSIBILITY_MODE_ENABLED.negate(),
            ContextKeyExpr.and(
              ContextKeyExpr.has(InputFocusedContextKey),
              EditorContextKeys.editorTextFocus,
              NOTEBOOK_EDITOR_CURSOR_BOUNDARY.notEqualsTo("bottom"),
              NOTEBOOK_EDITOR_CURSOR_BOUNDARY.notEqualsTo("none")
            ),
            EditorContextKeys.isEmbeddedDiffEditor.negate()
          ),
          weight: KeybindingWeight.EditorCore + 7,
          primary: KeyMod.CtrlCmd | KeyCode.UpArrow
        },
        f1: false
      }
    );
  }
  async runWithContext(accessor, context) {
    const index = context.notebookEditor.getCellIndex(context.cell);
    await NotebookChatController.get(context.notebookEditor)?.focusNearestWidget(index, "above");
  }
});
registerAction2(class extends NotebookCellAction {
  constructor() {
    super(
      {
        id: "notebook.cell.focusNextChatWidget",
        title: localize("focusNextChatWidget", "Focus Next Cell Chat Widget"),
        keybinding: {
          when: ContextKeyExpr.and(
            CONTEXT_ACCESSIBILITY_MODE_ENABLED.negate(),
            ContextKeyExpr.and(
              ContextKeyExpr.has(InputFocusedContextKey),
              EditorContextKeys.editorTextFocus,
              NOTEBOOK_EDITOR_CURSOR_BOUNDARY.notEqualsTo("top"),
              NOTEBOOK_EDITOR_CURSOR_BOUNDARY.notEqualsTo("none")
            ),
            EditorContextKeys.isEmbeddedDiffEditor.negate()
          ),
          weight: KeybindingWeight.EditorCore + 7,
          primary: KeyMod.CtrlCmd | KeyCode.DownArrow
        },
        f1: false,
        precondition: ContextKeyExpr.or(
          ContextKeyExpr.and(IS_COMPOSITE_NOTEBOOK.negate(), NOTEBOOK_CELL_EDITOR_FOCUSED),
          ContextKeyExpr.and(IS_COMPOSITE_NOTEBOOK, NOTEBOOK_CELL_EDITOR_FOCUSED.negate())
        )
      }
    );
  }
  async runWithContext(accessor, context) {
    const index = context.notebookEditor.getCellIndex(context.cell);
    await NotebookChatController.get(context.notebookEditor)?.focusNearestWidget(index, "below");
  }
});
registerAction2(class extends NotebookAction {
  constructor() {
    super(
      {
        id: "notebook.cell.chat.stop",
        title: localize2("notebook.cell.chat.stop", "Stop Request"),
        icon: Codicon.debugStop,
        menu: {
          id: MENU_CELL_CHAT_INPUT,
          group: "navigation",
          order: 1,
          when: CTX_NOTEBOOK_CHAT_HAS_ACTIVE_REQUEST
        },
        f1: false
      }
    );
  }
  async runWithContext(accessor, context) {
    NotebookChatController.get(context.notebookEditor)?.cancelCurrentRequest(false);
  }
});
registerAction2(class extends NotebookAction {
  constructor() {
    super(
      {
        id: "notebook.cell.chat.close",
        title: localize2("notebook.cell.chat.close", "Close Chat"),
        icon: Codicon.close,
        menu: {
          id: MENU_CELL_CHAT_WIDGET,
          group: "navigation",
          order: 2
        },
        f1: false
      }
    );
  }
  async runWithContext(accessor, context) {
    NotebookChatController.get(context.notebookEditor)?.dismiss(false);
  }
});
registerAction2(class extends NotebookAction {
  constructor() {
    super(
      {
        id: "notebook.cell.chat.acceptChanges",
        title: localize2("apply1", "Accept Changes"),
        shortTitle: localize("apply2", "Accept"),
        icon: Codicon.check,
        tooltip: localize("apply3", "Accept Changes"),
        keybinding: [
          {
            when: ContextKeyExpr.and(CTX_NOTEBOOK_CELL_CHAT_FOCUSED, CTX_INLINE_CHAT_FOCUSED, NOTEBOOK_CELL_EDITOR_FOCUSED.negate()),
            weight: KeybindingWeight.EditorContrib + 10,
            primary: KeyMod.CtrlCmd | KeyCode.Enter
          },
          {
            when: ContextKeyExpr.and(CTX_NOTEBOOK_CELL_CHAT_FOCUSED, CTX_INLINE_CHAT_FOCUSED, CTX_NOTEBOOK_CHAT_USER_DID_EDIT, NOTEBOOK_CELL_EDITOR_FOCUSED.negate()),
            weight: KeybindingWeight.EditorCore + 10,
            primary: KeyCode.Escape
          },
          {
            when: ContextKeyExpr.and(
              NOTEBOOK_EDITOR_FOCUSED,
              ContextKeyExpr.not(InputFocusedContextKey),
              NOTEBOOK_CELL_EDITOR_FOCUSED.negate(),
              CTX_NOTEBOOK_CHAT_OUTER_FOCUS_POSITION.isEqualTo("below")
            ),
            primary: KeyMod.CtrlCmd | KeyCode.Enter,
            weight: KeybindingWeight.WorkbenchContrib
          }
        ],
        menu: [
          {
            id: MENU_CELL_CHAT_WIDGET_STATUS,
            group: "0_main",
            order: 0,
            when: CTX_INLINE_CHAT_RESPONSE_TYPE.notEqualsTo(InlineChatResponseType.Messages)
          }
        ],
        f1: false
      }
    );
  }
  async runWithContext(accessor, context) {
    NotebookChatController.get(context.notebookEditor)?.acceptSession();
  }
});
registerAction2(class extends NotebookAction {
  constructor() {
    super(
      {
        id: "notebook.cell.chat.discard",
        title: localize("discard", "Discard"),
        icon: Codicon.discard,
        keybinding: {
          when: ContextKeyExpr.and(CTX_NOTEBOOK_CELL_CHAT_FOCUSED, CTX_INLINE_CHAT_FOCUSED, CTX_NOTEBOOK_CHAT_USER_DID_EDIT.negate(), NOTEBOOK_CELL_EDITOR_FOCUSED.negate()),
          weight: KeybindingWeight.EditorContrib,
          primary: KeyCode.Escape
        },
        menu: {
          id: MENU_CELL_CHAT_WIDGET_STATUS,
          group: "0_main",
          order: 1
        },
        f1: false
      }
    );
  }
  async runWithContext(accessor, context) {
    NotebookChatController.get(context.notebookEditor)?.discard();
  }
});
async function startChat(accessor, context, index, input, autoSend, source) {
  const configurationService = accessor.get(IConfigurationService);
  const commandService = accessor.get(ICommandService);
  if (configurationService.getValue(NotebookSetting.cellGenerate) || configurationService.getValue(NotebookSetting.cellChat)) {
    const activeCell = context.notebookEditor.getActiveCell();
    const targetCell = activeCell?.getTextLength() === 0 && source !== "insertToolbar" ? activeCell : await insertNewCell(accessor, context, CellKind.Code, "below", true);
    if (targetCell) {
      targetCell.enableAutoLanguageDetection();
      await context.notebookEditor.revealFirstLineIfOutsideViewport(targetCell);
      const codeEditor = context.notebookEditor.codeEditors.find((ce) => ce[0] === targetCell)?.[1];
      if (codeEditor) {
        codeEditor.focus();
        commandService.executeCommand("inlineChat.start");
      }
    }
  }
}
registerAction2(class extends NotebookAction {
  constructor() {
    super(
      {
        id: "notebook.cell.chat.start",
        title: {
          value: "$(sparkle) " + localize("notebookActions.menu.insertCodeCellWithChat", "Generate"),
          original: "$(sparkle) Generate"
        },
        tooltip: localize("notebookActions.menu.insertCodeCellWithChat.tooltip", "Start Chat to Generate Code"),
        metadata: {
          description: localize("notebookActions.menu.insertCodeCellWithChat.tooltip", "Start Chat to Generate Code"),
          args: [
            {
              name: "args",
              schema: {
                type: "object",
                required: ["index"],
                properties: {
                  "index": {
                    type: "number"
                  },
                  "input": {
                    type: "string"
                  },
                  "autoSend": {
                    type: "boolean"
                  }
                }
              }
            }
          ]
        },
        f1: false,
        keybinding: {
          when: ContextKeyExpr.and(
            NOTEBOOK_EDITOR_FOCUSED,
            NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true),
            ContextKeyExpr.not(InputFocusedContextKey),
            CTX_NOTEBOOK_CHAT_HAS_AGENT,
            ContextKeyExpr.or(
              ContextKeyExpr.equals(`config.${NotebookSetting.cellChat}`, true),
              ContextKeyExpr.equals(`config.${NotebookSetting.cellGenerate}`, true)
            )
          ),
          weight: KeybindingWeight.WorkbenchContrib,
          primary: KeyMod.CtrlCmd | KeyCode.KeyI,
          secondary: [KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.KeyI)]
        },
        menu: [
          {
            id: MenuId.NotebookCellBetween,
            group: "inline",
            order: -1,
            when: ContextKeyExpr.and(
              NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true),
              CTX_NOTEBOOK_CHAT_HAS_AGENT,
              ContextKeyExpr.or(
                ContextKeyExpr.equals(`config.${NotebookSetting.cellChat}`, true),
                ContextKeyExpr.equals(`config.${NotebookSetting.cellGenerate}`, true)
              )
            )
          }
        ]
      }
    );
  }
  getEditorContextFromArgsOrActive(accessor, ...args) {
    const [firstArg] = args;
    if (!firstArg) {
      const notebookEditor2 = getEditorFromArgsOrActivePane(accessor);
      if (!notebookEditor2) {
        return void 0;
      }
      const activeCell = notebookEditor2.getActiveCell();
      if (!activeCell) {
        return void 0;
      }
      return {
        cell: activeCell,
        notebookEditor: notebookEditor2,
        input: void 0,
        autoSend: void 0
      };
    }
    if (typeof firstArg !== "object" || typeof firstArg.index !== "number") {
      return void 0;
    }
    const notebookEditor = getEditorFromArgsOrActivePane(accessor);
    if (!notebookEditor) {
      return void 0;
    }
    const cell = firstArg.index <= 0 ? void 0 : notebookEditor.cellAt(firstArg.index - 1);
    return {
      cell,
      notebookEditor,
      input: firstArg.input,
      autoSend: firstArg.autoSend
    };
  }
  async runWithContext(accessor, context) {
    const index = Math.max(0, context.cell ? context.notebookEditor.getCellIndex(context.cell) + 1 : 0);
    await startChat(accessor, context, index, context.input, context.autoSend, context.source);
  }
});
registerAction2(class extends NotebookAction {
  constructor() {
    super(
      {
        id: "notebook.cell.chat.startAtTop",
        title: {
          value: "$(sparkle) " + localize("notebookActions.menu.insertCodeCellWithChat", "Generate"),
          original: "$(sparkle) Generate"
        },
        tooltip: localize("notebookActions.menu.insertCodeCellWithChat.tooltip", "Start Chat to Generate Code"),
        f1: false,
        menu: [
          {
            id: MenuId.NotebookCellListTop,
            group: "inline",
            order: -1,
            when: ContextKeyExpr.and(
              NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true),
              CTX_NOTEBOOK_CHAT_HAS_AGENT,
              ContextKeyExpr.or(
                ContextKeyExpr.equals(`config.${NotebookSetting.cellChat}`, true),
                ContextKeyExpr.equals(`config.${NotebookSetting.cellGenerate}`, true)
              )
            )
          }
        ]
      }
    );
  }
  async runWithContext(accessor, context) {
    await startChat(accessor, context, 0, "", false);
  }
});
MenuRegistry.appendMenuItem(MenuId.NotebookToolbar, {
  command: {
    id: "notebook.cell.chat.start",
    icon: Codicon.sparkle,
    title: localize("notebookActions.menu.insertCode.ontoolbar", "Generate"),
    tooltip: localize("notebookActions.menu.insertCode.tooltip", "Start Chat to Generate Code")
  },
  order: -10,
  group: "navigation/add",
  when: ContextKeyExpr.and(
    NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true),
    ContextKeyExpr.notEquals("config.notebook.insertToolbarLocation", "betweenCells"),
    ContextKeyExpr.notEquals("config.notebook.insertToolbarLocation", "hidden"),
    CTX_NOTEBOOK_CHAT_HAS_AGENT,
    ContextKeyExpr.or(
      ContextKeyExpr.equals(`config.${NotebookSetting.cellChat}`, true),
      ContextKeyExpr.equals(`config.${NotebookSetting.cellGenerate}`, true)
    )
  )
});
registerAction2(class extends NotebookAction {
  constructor() {
    super({
      id: "notebook.cell.chat.focus",
      title: localize("focusNotebookChat", "Focus Chat"),
      keybinding: [
        {
          when: ContextKeyExpr.and(
            NOTEBOOK_EDITOR_FOCUSED,
            ContextKeyExpr.not(InputFocusedContextKey),
            CTX_NOTEBOOK_CHAT_OUTER_FOCUS_POSITION.isEqualTo("above")
          ),
          primary: KeyMod.CtrlCmd | KeyCode.DownArrow,
          weight: KeybindingWeight.WorkbenchContrib
        },
        {
          when: ContextKeyExpr.and(
            NOTEBOOK_EDITOR_FOCUSED,
            ContextKeyExpr.not(InputFocusedContextKey),
            CTX_NOTEBOOK_CHAT_OUTER_FOCUS_POSITION.isEqualTo("below")
          ),
          primary: KeyMod.CtrlCmd | KeyCode.UpArrow,
          weight: KeybindingWeight.WorkbenchContrib
        }
      ],
      f1: false
    });
  }
  async runWithContext(accessor, context) {
    NotebookChatController.get(context.notebookEditor)?.focus();
  }
});
registerAction2(class extends NotebookAction {
  constructor() {
    super({
      id: "notebook.cell.chat.focusNextCell",
      title: localize("focusNextCell", "Focus Next Cell"),
      keybinding: [
        {
          when: ContextKeyExpr.and(
            CTX_NOTEBOOK_CELL_CHAT_FOCUSED,
            CTX_INLINE_CHAT_FOCUSED
          ),
          primary: KeyMod.CtrlCmd | KeyCode.DownArrow,
          weight: KeybindingWeight.WorkbenchContrib
        }
      ],
      f1: false
    });
  }
  async runWithContext(accessor, context) {
    NotebookChatController.get(context.notebookEditor)?.focusNext();
  }
});
registerAction2(class extends NotebookAction {
  constructor() {
    super({
      id: "notebook.cell.chat.focusPreviousCell",
      title: localize("focusPreviousCell", "Focus Previous Cell"),
      keybinding: [
        {
          when: ContextKeyExpr.and(
            CTX_NOTEBOOK_CELL_CHAT_FOCUSED,
            CTX_INLINE_CHAT_FOCUSED
          ),
          primary: KeyMod.CtrlCmd | KeyCode.UpArrow,
          weight: KeybindingWeight.WorkbenchContrib
        }
      ],
      f1: false
    });
  }
  async runWithContext(accessor, context) {
    NotebookChatController.get(context.notebookEditor)?.focusAbove();
  }
});
registerAction2(class extends NotebookAction {
  constructor() {
    super(
      {
        id: "notebook.cell.chat.previousFromHistory",
        title: localize2("notebook.cell.chat.previousFromHistory", "Previous From History"),
        precondition: ContextKeyExpr.and(CTX_NOTEBOOK_CELL_CHAT_FOCUSED, CTX_INLINE_CHAT_FOCUSED),
        keybinding: {
          when: ContextKeyExpr.and(CTX_NOTEBOOK_CELL_CHAT_FOCUSED, CTX_INLINE_CHAT_FOCUSED),
          weight: KeybindingWeight.EditorCore + 10,
          primary: KeyCode.UpArrow
        },
        f1: false
      }
    );
  }
  async runWithContext(accessor, context) {
    NotebookChatController.get(context.notebookEditor)?.populateHistory(true);
  }
});
registerAction2(class extends NotebookAction {
  constructor() {
    super(
      {
        id: "notebook.cell.chat.nextFromHistory",
        title: localize2("notebook.cell.chat.nextFromHistory", "Next From History"),
        precondition: ContextKeyExpr.and(CTX_NOTEBOOK_CELL_CHAT_FOCUSED, CTX_INLINE_CHAT_FOCUSED),
        keybinding: {
          when: ContextKeyExpr.and(CTX_NOTEBOOK_CELL_CHAT_FOCUSED, CTX_INLINE_CHAT_FOCUSED),
          weight: KeybindingWeight.EditorCore + 10,
          primary: KeyCode.DownArrow
        },
        f1: false
      }
    );
  }
  async runWithContext(accessor, context) {
    NotebookChatController.get(context.notebookEditor)?.populateHistory(false);
  }
});
registerAction2(class extends NotebookCellAction {
  constructor() {
    super(
      {
        id: "notebook.cell.chat.restore",
        title: localize2("notebookActions.restoreCellprompt", "Generate"),
        icon: Codicon.sparkle,
        menu: {
          id: MenuId.NotebookCellTitle,
          group: CELL_TITLE_CELL_GROUP_ID,
          order: 0,
          when: ContextKeyExpr.and(
            NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true),
            CTX_NOTEBOOK_CHAT_HAS_AGENT,
            NOTEBOOK_CELL_GENERATED_BY_CHAT,
            ContextKeyExpr.equals(`config.${NotebookSetting.cellChat}`, true)
          )
        },
        f1: false
      }
    );
  }
  async runWithContext(accessor, context) {
    const cell = context.cell;
    if (!cell) {
      return;
    }
    const notebookEditor = context.notebookEditor;
    const controller = NotebookChatController.get(notebookEditor);
    if (!controller) {
      return;
    }
    const prompt = controller.getPromptFromCache(cell);
    if (prompt) {
      controller.restore(cell, prompt);
    }
  }
});
class AcceptChangesAndRun extends EditorAction2 {
  constructor() {
    super({
      id: "notebook.inlineChat.acceptChangesAndRun",
      title: localize2("notebook.apply1", "Accept and Run"),
      shortTitle: localize("notebook.apply2", "Accept & Run"),
      tooltip: localize("notebook.apply3", "Accept the changes and run the cell"),
      icon: Codicon.check,
      f1: true,
      precondition: ContextKeyExpr.and(
        NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true),
        CTX_INLINE_CHAT_VISIBLE
      ),
      keybinding: void 0,
      menu: [{
        id: MENU_INLINE_CHAT_WIDGET_STATUS,
        group: "0_main",
        order: 2,
        when: ContextKeyExpr.and(
          NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true),
          ChatContextKeys.inputHasText.toNegated(),
          CTX_INLINE_CHAT_REQUEST_IN_PROGRESS.toNegated(),
          CTX_INLINE_CHAT_RESPONSE_TYPE.isEqualTo(InlineChatResponseType.MessagesAndEdits)
        )
      }]
    });
  }
  runEditorCommand(accessor, codeEditor) {
    const editor = getContextFromActiveEditor(accessor.get(IEditorService));
    const ctrl = InlineChatController.get(codeEditor);
    if (!editor || !ctrl) {
      return;
    }
    const matchedCell = editor.notebookEditor.codeEditors.find((e) => e[1] === codeEditor);
    const cell = matchedCell?.[0];
    if (!cell) {
      return;
    }
    ctrl.acceptSession();
    return editor.notebookEditor.executeNotebookCells(Iterable.single(cell));
  }
}
registerAction2(AcceptChangesAndRun);
export {
  AcceptChangesAndRun
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL2NvbnRyb2xsZXIvY2hhdC9jZWxsQ2hhdEFjdGlvbnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgS2V5Q2hvcmQsIEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IEVkaXRvckNvbnRleHRLZXlzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSwgbG9jYWxpemUyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IENPTlRFWFRfQUNDRVNTSUJJTElUWV9NT0RFX0VOQUJMRUQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5L2NvbW1vbi9hY2Nlc3NpYmlsaXR5LmpzJztcbmltcG9ydCB7IE1lbnVJZCwgTWVudVJlZ2lzdHJ5LCByZWdpc3RlckFjdGlvbjIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJbnB1dEZvY3VzZWRDb250ZXh0S2V5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleXMuanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgQ1RYX0lOTElORV9DSEFUX0ZPQ1VTRUQsIENUWF9JTkxJTkVfQ0hBVF9JTk5FUl9DVVJTT1JfRklSU1QsIENUWF9JTkxJTkVfQ0hBVF9JTk5FUl9DVVJTT1JfTEFTVCwgQ1RYX0lOTElORV9DSEFUX1JFUVVFU1RfSU5fUFJPR1JFU1MsIENUWF9JTkxJTkVfQ0hBVF9SRVNQT05TRV9UWVBFLCBDVFhfSU5MSU5FX0NIQVRfVklTSUJMRSwgSW5saW5lQ2hhdFJlc3BvbnNlVHlwZSwgTUVOVV9JTkxJTkVfQ0hBVF9XSURHRVRfU1RBVFVTIH0gZnJvbSAnLi4vLi4vLi4vLi4vaW5saW5lQ2hhdC9jb21tb24vaW5saW5lQ2hhdC5qcyc7XG5pbXBvcnQgeyBDVFhfTk9URUJPT0tfQ0VMTF9DSEFUX0ZPQ1VTRUQsIENUWF9OT1RFQk9PS19DSEFUX0hBU19BQ1RJVkVfUkVRVUVTVCwgQ1RYX05PVEVCT09LX0NIQVRfSEFTX0FHRU5ULCBDVFhfTk9URUJPT0tfQ0hBVF9PVVRFUl9GT0NVU19QT1NJVElPTiwgQ1RYX05PVEVCT09LX0NIQVRfVVNFUl9ESURfRURJVCwgTUVOVV9DRUxMX0NIQVRfSU5QVVQsIE1FTlVfQ0VMTF9DSEFUX1dJREdFVCwgTUVOVV9DRUxMX0NIQVRfV0lER0VUX1NUQVRVUyB9IGZyb20gJy4vbm90ZWJvb2tDaGF0Q29udGV4dC5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0NoYXRDb250cm9sbGVyIH0gZnJvbSAnLi9ub3RlYm9va0NoYXRDb250cm9sbGVyLmpzJztcbmltcG9ydCB7IENFTExfVElUTEVfQ0VMTF9HUk9VUF9JRCwgSU5vdGVib29rQWN0aW9uQ29udGV4dCwgSU5vdGVib29rQ2VsbEFjdGlvbkNvbnRleHQsIE5vdGVib29rQWN0aW9uLCBOb3RlYm9va0NlbGxBY3Rpb24sIGdldENvbnRleHRGcm9tQWN0aXZlRWRpdG9yLCBnZXRFZGl0b3JGcm9tQXJnc09yQWN0aXZlUGFuZSB9IGZyb20gJy4uL2NvcmVBY3Rpb25zLmpzJztcbmltcG9ydCB7IGluc2VydE5ld0NlbGwgfSBmcm9tICcuLi9pbnNlcnRDZWxsQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDZWxsRWRpdFN0YXRlIH0gZnJvbSAnLi4vLi4vbm90ZWJvb2tCcm93c2VyLmpzJztcbmltcG9ydCB7IENlbGxLaW5kLCBOT1RFQk9PS19FRElUT1JfQ1VSU09SX0JPVU5EQVJZLCBOb3RlYm9va1NldHRpbmcgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbm90ZWJvb2tDb21tb24uanMnO1xuaW1wb3J0IHsgSVNfQ09NUE9TSVRFX05PVEVCT09LLCBOT1RFQk9PS19DRUxMX0VESVRPUl9GT0NVU0VELCBOT1RFQk9PS19DRUxMX0dFTkVSQVRFRF9CWV9DSEFULCBOT1RFQk9PS19FRElUT1JfRURJVEFCTEUsIE5PVEVCT09LX0VESVRPUl9GT0NVU0VEIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL25vdGVib29rQ29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgSXRlcmFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9pdGVyYXRvci5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ2hhdENvbnRleHRLZXlzIH0gZnJvbSAnLi4vLi4vLi4vLi4vY2hhdC9jb21tb24vY2hhdENvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IElubGluZUNoYXRDb250cm9sbGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vaW5saW5lQ2hhdC9icm93c2VyL2lubGluZUNoYXRDb250cm9sbGVyLmpzJztcbmltcG9ydCB7IEVkaXRvckFjdGlvbjIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLmpzJztcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgTm90ZWJvb2tBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcihcblx0XHRcdHtcblx0XHRcdFx0aWQ6ICdub3RlYm9vay5jZWxsLmNoYXQuYWNjZXB0Jyxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMignbm90ZWJvb2suY2VsbC5jaGF0LmFjY2VwdCcsIFwiTWFrZSBSZXF1ZXN0XCIpLFxuXHRcdFx0XHRpY29uOiBDb2RpY29uLnNlbmQsXG5cdFx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ1RYX05PVEVCT09LX0NFTExfQ0hBVF9GT0NVU0VELCBDVFhfSU5MSU5FX0NIQVRfRk9DVVNFRCwgTk9URUJPT0tfQ0VMTF9FRElUT1JfRk9DVVNFRC5uZWdhdGUoKSksXG5cdFx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdFx0cHJpbWFyeTogS2V5Q29kZS5FbnRlclxuXHRcdFx0XHR9LFxuXHRcdFx0XHRtZW51OiB7XG5cdFx0XHRcdFx0aWQ6IE1FTlVfQ0VMTF9DSEFUX0lOUFVULFxuXHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0b3JkZXI6IDEsXG5cdFx0XHRcdFx0d2hlbjogQ1RYX05PVEVCT09LX0NIQVRfSEFTX0FDVElWRV9SRVFVRVNULm5lZ2F0ZSgpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGYxOiBmYWxzZVxuXHRcdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW5XaXRoQ29udGV4dChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY29udGV4dDogSU5vdGVib29rQWN0aW9uQ29udGV4dCkge1xuXHRcdE5vdGVib29rQ2hhdENvbnRyb2xsZXIuZ2V0KGNvbnRleHQubm90ZWJvb2tFZGl0b3IpPy5hY2NlcHRJbnB1dCgpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgTm90ZWJvb2tDZWxsQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiAnbm90ZWJvb2suY2VsbC5jaGF0LmFycm93T3V0VXAnLFxuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ2Fycm93VXAnLCAnQ3Vyc29yIFVwJyksXG5cdFx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0XHRDVFhfTk9URUJPT0tfQ0VMTF9DSEFUX0ZPQ1VTRUQsXG5cdFx0XHRcdFx0XHRDVFhfSU5MSU5FX0NIQVRfRk9DVVNFRCxcblx0XHRcdFx0XHRcdENUWF9JTkxJTkVfQ0hBVF9JTk5FUl9DVVJTT1JfRklSU1QsXG5cdFx0XHRcdFx0XHROT1RFQk9PS19DRUxMX0VESVRPUl9GT0NVU0VELm5lZ2F0ZSgpLFxuXHRcdFx0XHRcdFx0Q09OVEVYVF9BQ0NFU1NJQklMSVRZX01PREVfRU5BQkxFRC5uZWdhdGUoKVxuXHRcdFx0XHRcdCksXG5cdFx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvcmUgKyA3LFxuXHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5VcEFycm93XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGYxOiBmYWxzZVxuXHRcdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW5XaXRoQ29udGV4dChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY29udGV4dDogSU5vdGVib29rQ2VsbEFjdGlvbkNvbnRleHQpIHtcblx0XHRjb25zdCBlZGl0b3IgPSBjb250ZXh0Lm5vdGVib29rRWRpdG9yO1xuXHRcdGNvbnN0IGFjdGl2ZUNlbGwgPSBjb250ZXh0LmNlbGw7XG5cblx0XHRjb25zdCBpZHggPSBlZGl0b3IuZ2V0Q2VsbEluZGV4KGFjdGl2ZUNlbGwpO1xuXHRcdGlmICh0eXBlb2YgaWR4ICE9PSAnbnVtYmVyJykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChpZHggPCAxIHx8IGVkaXRvci5nZXRMZW5ndGgoKSA9PT0gMCkge1xuXHRcdFx0Ly8gd2UgZG9uJ3QgZG8gbG9vcFxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IG5ld0NlbGwgPSBlZGl0b3IuY2VsbEF0KGlkeCAtIDEpO1xuXHRcdGNvbnN0IG5ld0ZvY3VzTW9kZSA9IG5ld0NlbGwuY2VsbEtpbmQgPT09IENlbGxLaW5kLk1hcmt1cCAmJiBuZXdDZWxsLmdldEVkaXRTdGF0ZSgpID09PSBDZWxsRWRpdFN0YXRlLlByZXZpZXcgPyAnY29udGFpbmVyJyA6ICdlZGl0b3InO1xuXHRcdGNvbnN0IGZvY3VzRWRpdG9yTGluZSA9IG5ld0NlbGwudGV4dEJ1ZmZlci5nZXRMaW5lQ291bnQoKTtcblx0XHRhd2FpdCBlZGl0b3IuZm9jdXNOb3RlYm9va0NlbGwobmV3Q2VsbCwgbmV3Rm9jdXNNb2RlLCB7IGZvY3VzRWRpdG9yTGluZTogZm9jdXNFZGl0b3JMaW5lIH0pO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgTm90ZWJvb2tBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcihcblx0XHRcdHtcblx0XHRcdFx0aWQ6ICdub3RlYm9vay5jZWxsLmNoYXQuYXJyb3dPdXREb3duJyxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdhcnJvd0Rvd24nLCAnQ3Vyc29yIERvd24nKSxcblx0XHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRcdENUWF9OT1RFQk9PS19DRUxMX0NIQVRfRk9DVVNFRCxcblx0XHRcdFx0XHRcdENUWF9JTkxJTkVfQ0hBVF9GT0NVU0VELFxuXHRcdFx0XHRcdFx0Q1RYX0lOTElORV9DSEFUX0lOTkVSX0NVUlNPUl9MQVNULFxuXHRcdFx0XHRcdFx0Tk9URUJPT0tfQ0VMTF9FRElUT1JfRk9DVVNFRC5uZWdhdGUoKSxcblx0XHRcdFx0XHRcdENPTlRFWFRfQUNDRVNTSUJJTElUWV9NT0RFX0VOQUJMRUQubmVnYXRlKClcblx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb3JlICsgNyxcblx0XHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRG93bkFycm93XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGYxOiBmYWxzZVxuXHRcdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW5XaXRoQ29udGV4dChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY29udGV4dDogSU5vdGVib29rQWN0aW9uQ29udGV4dCkge1xuXHRcdGF3YWl0IE5vdGVib29rQ2hhdENvbnRyb2xsZXIuZ2V0KGNvbnRleHQubm90ZWJvb2tFZGl0b3IpPy5mb2N1c05leHQoKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIE5vdGVib29rQ2VsbEFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogJ25vdGVib29rLmNlbGwuZm9jdXNDaGF0V2lkZ2V0Jyxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdmb2N1c0NoYXRXaWRnZXQnLCAnRm9jdXMgQ2hhdCBXaWRnZXQnKSxcblx0XHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRcdE5PVEVCT09LX0VESVRPUl9GT0NVU0VELFxuXHRcdFx0XHRcdFx0Q09OVEVYVF9BQ0NFU1NJQklMSVRZX01PREVfRU5BQkxFRC5uZWdhdGUoKSxcblx0XHRcdFx0XHRcdENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRcdFx0Q29udGV4dEtleUV4cHIuaGFzKElucHV0Rm9jdXNlZENvbnRleHRLZXkpLFxuXHRcdFx0XHRcdFx0XHRFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsXG5cdFx0XHRcdFx0XHRcdE5PVEVCT09LX0VESVRPUl9DVVJTT1JfQk9VTkRBUlkubm90RXF1YWxzVG8oJ2JvdHRvbScpLFxuXHRcdFx0XHRcdFx0XHROT1RFQk9PS19FRElUT1JfQ1VSU09SX0JPVU5EQVJZLm5vdEVxdWFsc1RvKCdub25lJyksXG5cdFx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdFx0RWRpdG9yQ29udGV4dEtleXMuaXNFbWJlZGRlZERpZmZFZGl0b3IubmVnYXRlKClcblx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb3JlICsgNyxcblx0XHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuVXBBcnJvd1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRmMTogZmFsc2Vcblx0XHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuV2l0aENvbnRleHQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGNvbnRleHQ6IElOb3RlYm9va0NlbGxBY3Rpb25Db250ZXh0KSB7XG5cdFx0Y29uc3QgaW5kZXggPSBjb250ZXh0Lm5vdGVib29rRWRpdG9yLmdldENlbGxJbmRleChjb250ZXh0LmNlbGwpO1xuXHRcdGF3YWl0IE5vdGVib29rQ2hhdENvbnRyb2xsZXIuZ2V0KGNvbnRleHQubm90ZWJvb2tFZGl0b3IpPy5mb2N1c05lYXJlc3RXaWRnZXQoaW5kZXgsICdhYm92ZScpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgTm90ZWJvb2tDZWxsQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiAnbm90ZWJvb2suY2VsbC5mb2N1c05leHRDaGF0V2lkZ2V0Jyxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdmb2N1c05leHRDaGF0V2lkZ2V0JywgJ0ZvY3VzIE5leHQgQ2VsbCBDaGF0IFdpZGdldCcpLFxuXHRcdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdFx0Q09OVEVYVF9BQ0NFU1NJQklMSVRZX01PREVfRU5BQkxFRC5uZWdhdGUoKSxcblx0XHRcdFx0XHRcdENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRcdFx0Q29udGV4dEtleUV4cHIuaGFzKElucHV0Rm9jdXNlZENvbnRleHRLZXkpLFxuXHRcdFx0XHRcdFx0XHRFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsXG5cdFx0XHRcdFx0XHRcdE5PVEVCT09LX0VESVRPUl9DVVJTT1JfQk9VTkRBUlkubm90RXF1YWxzVG8oJ3RvcCcpLFxuXHRcdFx0XHRcdFx0XHROT1RFQk9PS19FRElUT1JfQ1VSU09SX0JPVU5EQVJZLm5vdEVxdWFsc1RvKCdub25lJyksXG5cdFx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdFx0RWRpdG9yQ29udGV4dEtleXMuaXNFbWJlZGRlZERpZmZFZGl0b3IubmVnYXRlKClcblx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb3JlICsgNyxcblx0XHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRG93bkFycm93XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5vcihcblx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5hbmQoSVNfQ09NUE9TSVRFX05PVEVCT09LLm5lZ2F0ZSgpLCBOT1RFQk9PS19DRUxMX0VESVRPUl9GT0NVU0VEKSxcblx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5hbmQoSVNfQ09NUE9TSVRFX05PVEVCT09LLCBOT1RFQk9PS19DRUxMX0VESVRPUl9GT0NVU0VELm5lZ2F0ZSgpKSxcblx0XHRcdFx0KVxuXHRcdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW5XaXRoQ29udGV4dChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY29udGV4dDogSU5vdGVib29rQ2VsbEFjdGlvbkNvbnRleHQpIHtcblx0XHRjb25zdCBpbmRleCA9IGNvbnRleHQubm90ZWJvb2tFZGl0b3IuZ2V0Q2VsbEluZGV4KGNvbnRleHQuY2VsbCk7XG5cdFx0YXdhaXQgTm90ZWJvb2tDaGF0Q29udHJvbGxlci5nZXQoY29udGV4dC5ub3RlYm9va0VkaXRvcik/LmZvY3VzTmVhcmVzdFdpZGdldChpbmRleCwgJ2JlbG93Jyk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBOb3RlYm9va0FjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogJ25vdGVib29rLmNlbGwuY2hhdC5zdG9wJyxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMignbm90ZWJvb2suY2VsbC5jaGF0LnN0b3AnLCBcIlN0b3AgUmVxdWVzdFwiKSxcblx0XHRcdFx0aWNvbjogQ29kaWNvbi5kZWJ1Z1N0b3AsXG5cdFx0XHRcdG1lbnU6IHtcblx0XHRcdFx0XHRpZDogTUVOVV9DRUxMX0NIQVRfSU5QVVQsXG5cdFx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0XHRvcmRlcjogMSxcblx0XHRcdFx0XHR3aGVuOiBDVFhfTk9URUJPT0tfQ0hBVF9IQVNfQUNUSVZFX1JFUVVFU1Rcblx0XHRcdFx0fSxcblx0XHRcdFx0ZjE6IGZhbHNlXG5cdFx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bldpdGhDb250ZXh0KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0OiBJTm90ZWJvb2tBY3Rpb25Db250ZXh0KSB7XG5cdFx0Tm90ZWJvb2tDaGF0Q29udHJvbGxlci5nZXQoY29udGV4dC5ub3RlYm9va0VkaXRvcik/LmNhbmNlbEN1cnJlbnRSZXF1ZXN0KGZhbHNlKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIE5vdGVib29rQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiAnbm90ZWJvb2suY2VsbC5jaGF0LmNsb3NlJyxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMignbm90ZWJvb2suY2VsbC5jaGF0LmNsb3NlJywgXCJDbG9zZSBDaGF0XCIpLFxuXHRcdFx0XHRpY29uOiBDb2RpY29uLmNsb3NlLFxuXHRcdFx0XHRtZW51OiB7XG5cdFx0XHRcdFx0aWQ6IE1FTlVfQ0VMTF9DSEFUX1dJREdFVCxcblx0XHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRcdG9yZGVyOiAyXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGYxOiBmYWxzZVxuXHRcdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW5XaXRoQ29udGV4dChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY29udGV4dDogSU5vdGVib29rQWN0aW9uQ29udGV4dCkge1xuXHRcdE5vdGVib29rQ2hhdENvbnRyb2xsZXIuZ2V0KGNvbnRleHQubm90ZWJvb2tFZGl0b3IpPy5kaXNtaXNzKGZhbHNlKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIE5vdGVib29rQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiAnbm90ZWJvb2suY2VsbC5jaGF0LmFjY2VwdENoYW5nZXMnLFxuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUyKCdhcHBseTEnLCBcIkFjY2VwdCBDaGFuZ2VzXCIpLFxuXHRcdFx0XHRzaG9ydFRpdGxlOiBsb2NhbGl6ZSgnYXBwbHkyJywgJ0FjY2VwdCcpLFxuXHRcdFx0XHRpY29uOiBDb2RpY29uLmNoZWNrLFxuXHRcdFx0XHR0b29sdGlwOiBsb2NhbGl6ZSgnYXBwbHkzJywgJ0FjY2VwdCBDaGFuZ2VzJyksXG5cdFx0XHRcdGtleWJpbmRpbmc6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ1RYX05PVEVCT09LX0NFTExfQ0hBVF9GT0NVU0VELCBDVFhfSU5MSU5FX0NIQVRfRk9DVVNFRCwgTk9URUJPT0tfQ0VMTF9FRElUT1JfRk9DVVNFRC5uZWdhdGUoKSksXG5cdFx0XHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYiArIDEwLFxuXHRcdFx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkVudGVyLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENUWF9OT1RFQk9PS19DRUxMX0NIQVRfRk9DVVNFRCwgQ1RYX0lOTElORV9DSEFUX0ZPQ1VTRUQsIENUWF9OT1RFQk9PS19DSEFUX1VTRVJfRElEX0VESVQsIE5PVEVCT09LX0NFTExfRURJVE9SX0ZPQ1VTRUQubmVnYXRlKCkpLFxuXHRcdFx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvcmUgKyAxMCxcblx0XHRcdFx0XHRcdHByaW1hcnk6IEtleUNvZGUuRXNjYXBlXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0XHRcdE5PVEVCT09LX0VESVRPUl9GT0NVU0VELFxuXHRcdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5ub3QoSW5wdXRGb2N1c2VkQ29udGV4dEtleSksXG5cdFx0XHRcdFx0XHRcdE5PVEVCT09LX0NFTExfRURJVE9SX0ZPQ1VTRUQubmVnYXRlKCksXG5cdFx0XHRcdFx0XHRcdENUWF9OT1RFQk9PS19DSEFUX09VVEVSX0ZPQ1VTX1BPU0lUSU9OLmlzRXF1YWxUbygnYmVsb3cnKVxuXHRcdFx0XHRcdFx0KSxcblx0XHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5FbnRlcixcblx0XHRcdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdLFxuXHRcdFx0XHRtZW51OiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0aWQ6IE1FTlVfQ0VMTF9DSEFUX1dJREdFVF9TVEFUVVMsXG5cdFx0XHRcdFx0XHRncm91cDogJzBfbWFpbicsXG5cdFx0XHRcdFx0XHRvcmRlcjogMCxcblx0XHRcdFx0XHRcdHdoZW46IENUWF9JTkxJTkVfQ0hBVF9SRVNQT05TRV9UWVBFLm5vdEVxdWFsc1RvKElubGluZUNoYXRSZXNwb25zZVR5cGUuTWVzc2FnZXMpLFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XSxcblx0XHRcdFx0ZjE6IGZhbHNlXG5cdFx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bldpdGhDb250ZXh0KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0OiBJTm90ZWJvb2tBY3Rpb25Db250ZXh0KSB7XG5cdFx0Tm90ZWJvb2tDaGF0Q29udHJvbGxlci5nZXQoY29udGV4dC5ub3RlYm9va0VkaXRvcik/LmFjY2VwdFNlc3Npb24oKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIE5vdGVib29rQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiAnbm90ZWJvb2suY2VsbC5jaGF0LmRpc2NhcmQnLFxuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ2Rpc2NhcmQnLCAnRGlzY2FyZCcpLFxuXHRcdFx0XHRpY29uOiBDb2RpY29uLmRpc2NhcmQsXG5cdFx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ1RYX05PVEVCT09LX0NFTExfQ0hBVF9GT0NVU0VELCBDVFhfSU5MSU5FX0NIQVRfRk9DVVNFRCwgQ1RYX05PVEVCT09LX0NIQVRfVVNFUl9ESURfRURJVC5uZWdhdGUoKSwgTk9URUJPT0tfQ0VMTF9FRElUT1JfRk9DVVNFRC5uZWdhdGUoKSksXG5cdFx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWIsXG5cdFx0XHRcdFx0cHJpbWFyeTogS2V5Q29kZS5Fc2NhcGVcblx0XHRcdFx0fSxcblx0XHRcdFx0bWVudToge1xuXHRcdFx0XHRcdGlkOiBNRU5VX0NFTExfQ0hBVF9XSURHRVRfU1RBVFVTLFxuXHRcdFx0XHRcdGdyb3VwOiAnMF9tYWluJyxcblx0XHRcdFx0XHRvcmRlcjogMVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRmMTogZmFsc2Vcblx0XHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuV2l0aENvbnRleHQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGNvbnRleHQ6IElOb3RlYm9va0FjdGlvbkNvbnRleHQpIHtcblx0XHROb3RlYm9va0NoYXRDb250cm9sbGVyLmdldChjb250ZXh0Lm5vdGVib29rRWRpdG9yKT8uZGlzY2FyZCgpO1xuXHR9XG59KTtcblxuaW50ZXJmYWNlIElJbnNlcnRDZWxsV2l0aENoYXRBcmdzIGV4dGVuZHMgSU5vdGVib29rQWN0aW9uQ29udGV4dCB7XG5cdGlucHV0Pzogc3RyaW5nO1xuXHRhdXRvU2VuZD86IGJvb2xlYW47XG5cdHNvdXJjZT86IHN0cmluZztcbn1cblxuYXN5bmMgZnVuY3Rpb24gc3RhcnRDaGF0KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0OiBJTm90ZWJvb2tBY3Rpb25Db250ZXh0LCBpbmRleDogbnVtYmVyLCBpbnB1dD86IHN0cmluZywgYXV0b1NlbmQ/OiBib29sZWFuLCBzb3VyY2U/OiBzdHJpbmcpIHtcblx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0Y29uc3QgY29tbWFuZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbW1hbmRTZXJ2aWNlKTtcblxuXHRpZiAoY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oTm90ZWJvb2tTZXR0aW5nLmNlbGxHZW5lcmF0ZSkgfHwgY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oTm90ZWJvb2tTZXR0aW5nLmNlbGxDaGF0KSkge1xuXHRcdGNvbnN0IGFjdGl2ZUNlbGwgPSBjb250ZXh0Lm5vdGVib29rRWRpdG9yLmdldEFjdGl2ZUNlbGwoKTtcblx0XHRjb25zdCB0YXJnZXRDZWxsID0gYWN0aXZlQ2VsbD8uZ2V0VGV4dExlbmd0aCgpID09PSAwICYmIHNvdXJjZSAhPT0gJ2luc2VydFRvb2xiYXInID8gYWN0aXZlQ2VsbCA6IChhd2FpdCBpbnNlcnROZXdDZWxsKGFjY2Vzc29yLCBjb250ZXh0LCBDZWxsS2luZC5Db2RlLCAnYmVsb3cnLCB0cnVlKSk7XG5cblx0XHRpZiAodGFyZ2V0Q2VsbCkge1xuXHRcdFx0dGFyZ2V0Q2VsbC5lbmFibGVBdXRvTGFuZ3VhZ2VEZXRlY3Rpb24oKTtcblx0XHRcdGF3YWl0IGNvbnRleHQubm90ZWJvb2tFZGl0b3IucmV2ZWFsRmlyc3RMaW5lSWZPdXRzaWRlVmlld3BvcnQodGFyZ2V0Q2VsbCk7XG5cdFx0XHRjb25zdCBjb2RlRWRpdG9yID0gY29udGV4dC5ub3RlYm9va0VkaXRvci5jb2RlRWRpdG9ycy5maW5kKGNlID0+IGNlWzBdID09PSB0YXJnZXRDZWxsKT8uWzFdO1xuXHRcdFx0aWYgKGNvZGVFZGl0b3IpIHtcblx0XHRcdFx0Y29kZUVkaXRvci5mb2N1cygpO1xuXHRcdFx0XHRjb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZCgnaW5saW5lQ2hhdC5zdGFydCcpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBOb3RlYm9va0FjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogJ25vdGVib29rLmNlbGwuY2hhdC5zdGFydCcsXG5cdFx0XHRcdHRpdGxlOiB7XG5cdFx0XHRcdFx0dmFsdWU6ICckKHNwYXJrbGUpICcgKyBsb2NhbGl6ZSgnbm90ZWJvb2tBY3Rpb25zLm1lbnUuaW5zZXJ0Q29kZUNlbGxXaXRoQ2hhdCcsIFwiR2VuZXJhdGVcIiksXG5cdFx0XHRcdFx0b3JpZ2luYWw6ICckKHNwYXJrbGUpIEdlbmVyYXRlJyxcblx0XHRcdFx0fSxcblx0XHRcdFx0dG9vbHRpcDogbG9jYWxpemUoJ25vdGVib29rQWN0aW9ucy5tZW51Lmluc2VydENvZGVDZWxsV2l0aENoYXQudG9vbHRpcCcsIFwiU3RhcnQgQ2hhdCB0byBHZW5lcmF0ZSBDb2RlXCIpLFxuXHRcdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnbm90ZWJvb2tBY3Rpb25zLm1lbnUuaW5zZXJ0Q29kZUNlbGxXaXRoQ2hhdC50b29sdGlwJywgXCJTdGFydCBDaGF0IHRvIEdlbmVyYXRlIENvZGVcIiksXG5cdFx0XHRcdFx0YXJnczogW1xuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRuYW1lOiAnYXJncycsXG5cdFx0XHRcdFx0XHRcdHNjaGVtYToge1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRcdFx0XHRcdHJlcXVpcmVkOiBbJ2luZGV4J10sXG5cdFx0XHRcdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0XHRcdFx0J2luZGV4Jzoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnbnVtYmVyJ1xuXHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdCdpbnB1dCc6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHQnYXV0b1NlbmQnOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJ1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSxcblx0XHRcdFx0ZjE6IGZhbHNlLFxuXHRcdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdFx0Tk9URUJPT0tfRURJVE9SX0ZPQ1VTRUQsXG5cdFx0XHRcdFx0XHROT1RFQk9PS19FRElUT1JfRURJVEFCTEUuaXNFcXVhbFRvKHRydWUpLFxuXHRcdFx0XHRcdFx0Q29udGV4dEtleUV4cHIubm90KElucHV0Rm9jdXNlZENvbnRleHRLZXkpLFxuXHRcdFx0XHRcdFx0Q1RYX05PVEVCT09LX0NIQVRfSEFTX0FHRU5ULFxuXHRcdFx0XHRcdFx0Q29udGV4dEtleUV4cHIub3IoXG5cdFx0XHRcdFx0XHRcdENvbnRleHRLZXlFeHByLmVxdWFscyhgY29uZmlnLiR7Tm90ZWJvb2tTZXR0aW5nLmNlbGxDaGF0fWAsIHRydWUpLFxuXHRcdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5lcXVhbHMoYGNvbmZpZy4ke05vdGVib29rU2V0dGluZy5jZWxsR2VuZXJhdGV9YCwgdHJ1ZSlcblx0XHRcdFx0XHRcdClcblx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlJLFxuXHRcdFx0XHRcdHNlY29uZGFyeTogW0tleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlDb2RlLktleUkpXSxcblx0XHRcdFx0fSxcblx0XHRcdFx0bWVudTogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGlkOiBNZW51SWQuTm90ZWJvb2tDZWxsQmV0d2Vlbixcblx0XHRcdFx0XHRcdGdyb3VwOiAnaW5saW5lJyxcblx0XHRcdFx0XHRcdG9yZGVyOiAtMSxcblx0XHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRcdFx0Tk9URUJPT0tfRURJVE9SX0VESVRBQkxFLmlzRXF1YWxUbyh0cnVlKSxcblx0XHRcdFx0XHRcdFx0Q1RYX05PVEVCT09LX0NIQVRfSEFTX0FHRU5ULFxuXHRcdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5vcihcblx0XHRcdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5lcXVhbHMoYGNvbmZpZy4ke05vdGVib29rU2V0dGluZy5jZWxsQ2hhdH1gLCB0cnVlKSxcblx0XHRcdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5lcXVhbHMoYGNvbmZpZy4ke05vdGVib29rU2V0dGluZy5jZWxsR2VuZXJhdGV9YCwgdHJ1ZSlcblx0XHRcdFx0XHRcdFx0KVxuXHRcdFx0XHRcdFx0KVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XVxuXHRcdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBnZXRFZGl0b3JDb250ZXh0RnJvbUFyZ3NPckFjdGl2ZShhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pOiBJSW5zZXJ0Q2VsbFdpdGhDaGF0QXJncyB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgW2ZpcnN0QXJnXSA9IGFyZ3M7XG5cdFx0aWYgKCFmaXJzdEFyZykge1xuXHRcdFx0Y29uc3Qgbm90ZWJvb2tFZGl0b3IgPSBnZXRFZGl0b3JGcm9tQXJnc09yQWN0aXZlUGFuZShhY2Nlc3Nvcik7XG5cdFx0XHRpZiAoIW5vdGVib29rRWRpdG9yKSB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGFjdGl2ZUNlbGwgPSBub3RlYm9va0VkaXRvci5nZXRBY3RpdmVDZWxsKCk7XG5cdFx0XHRpZiAoIWFjdGl2ZUNlbGwpIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0Y2VsbDogYWN0aXZlQ2VsbCxcblx0XHRcdFx0bm90ZWJvb2tFZGl0b3IsXG5cdFx0XHRcdGlucHV0OiB1bmRlZmluZWQsXG5cdFx0XHRcdGF1dG9TZW5kOiB1bmRlZmluZWRcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiBmaXJzdEFyZyAhPT0gJ29iamVjdCcgfHwgdHlwZW9mIGZpcnN0QXJnLmluZGV4ICE9PSAnbnVtYmVyJykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBub3RlYm9va0VkaXRvciA9IGdldEVkaXRvckZyb21BcmdzT3JBY3RpdmVQYW5lKGFjY2Vzc29yKTtcblx0XHRpZiAoIW5vdGVib29rRWRpdG9yKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNlbGwgPSBmaXJzdEFyZy5pbmRleCA8PSAwID8gdW5kZWZpbmVkIDogbm90ZWJvb2tFZGl0b3IuY2VsbEF0KGZpcnN0QXJnLmluZGV4IC0gMSk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0Y2VsbCxcblx0XHRcdG5vdGVib29rRWRpdG9yLFxuXHRcdFx0aW5wdXQ6IGZpcnN0QXJnLmlucHV0LFxuXHRcdFx0YXV0b1NlbmQ6IGZpcnN0QXJnLmF1dG9TZW5kXG5cdFx0fTtcblx0fVxuXG5cdGFzeW5jIHJ1bldpdGhDb250ZXh0KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0OiBJSW5zZXJ0Q2VsbFdpdGhDaGF0QXJncykge1xuXHRcdGNvbnN0IGluZGV4ID0gTWF0aC5tYXgoMCwgY29udGV4dC5jZWxsID8gY29udGV4dC5ub3RlYm9va0VkaXRvci5nZXRDZWxsSW5kZXgoY29udGV4dC5jZWxsKSArIDEgOiAwKTtcblx0XHRhd2FpdCBzdGFydENoYXQoYWNjZXNzb3IsIGNvbnRleHQsIGluZGV4LCBjb250ZXh0LmlucHV0LCBjb250ZXh0LmF1dG9TZW5kLCBjb250ZXh0LnNvdXJjZSk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBOb3RlYm9va0FjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogJ25vdGVib29rLmNlbGwuY2hhdC5zdGFydEF0VG9wJyxcblx0XHRcdFx0dGl0bGU6IHtcblx0XHRcdFx0XHR2YWx1ZTogJyQoc3BhcmtsZSkgJyArIGxvY2FsaXplKCdub3RlYm9va0FjdGlvbnMubWVudS5pbnNlcnRDb2RlQ2VsbFdpdGhDaGF0JywgXCJHZW5lcmF0ZVwiKSxcblx0XHRcdFx0XHRvcmlnaW5hbDogJyQoc3BhcmtsZSkgR2VuZXJhdGUnLFxuXHRcdFx0XHR9LFxuXHRcdFx0XHR0b29sdGlwOiBsb2NhbGl6ZSgnbm90ZWJvb2tBY3Rpb25zLm1lbnUuaW5zZXJ0Q29kZUNlbGxXaXRoQ2hhdC50b29sdGlwJywgXCJTdGFydCBDaGF0IHRvIEdlbmVyYXRlIENvZGVcIiksXG5cdFx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdFx0bWVudTogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGlkOiBNZW51SWQuTm90ZWJvb2tDZWxsTGlzdFRvcCxcblx0XHRcdFx0XHRcdGdyb3VwOiAnaW5saW5lJyxcblx0XHRcdFx0XHRcdG9yZGVyOiAtMSxcblx0XHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRcdFx0Tk9URUJPT0tfRURJVE9SX0VESVRBQkxFLmlzRXF1YWxUbyh0cnVlKSxcblx0XHRcdFx0XHRcdFx0Q1RYX05PVEVCT09LX0NIQVRfSEFTX0FHRU5ULFxuXHRcdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5vcihcblx0XHRcdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5lcXVhbHMoYGNvbmZpZy4ke05vdGVib29rU2V0dGluZy5jZWxsQ2hhdH1gLCB0cnVlKSxcblx0XHRcdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5lcXVhbHMoYGNvbmZpZy4ke05vdGVib29rU2V0dGluZy5jZWxsR2VuZXJhdGV9YCwgdHJ1ZSlcblx0XHRcdFx0XHRcdFx0KVxuXHRcdFx0XHRcdFx0KVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdF1cblx0XHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuV2l0aENvbnRleHQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGNvbnRleHQ6IElOb3RlYm9va0FjdGlvbkNvbnRleHQpIHtcblx0XHRhd2FpdCBzdGFydENoYXQoYWNjZXNzb3IsIGNvbnRleHQsIDAsICcnLCBmYWxzZSk7XG5cdH1cbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk5vdGVib29rVG9vbGJhciwge1xuXHRjb21tYW5kOiB7XG5cdFx0aWQ6ICdub3RlYm9vay5jZWxsLmNoYXQuc3RhcnQnLFxuXHRcdGljb246IENvZGljb24uc3BhcmtsZSxcblx0XHR0aXRsZTogbG9jYWxpemUoJ25vdGVib29rQWN0aW9ucy5tZW51Lmluc2VydENvZGUub250b29sYmFyJywgXCJHZW5lcmF0ZVwiKSxcblx0XHR0b29sdGlwOiBsb2NhbGl6ZSgnbm90ZWJvb2tBY3Rpb25zLm1lbnUuaW5zZXJ0Q29kZS50b29sdGlwJywgXCJTdGFydCBDaGF0IHRvIEdlbmVyYXRlIENvZGVcIilcblx0fSxcblx0b3JkZXI6IC0xMCxcblx0Z3JvdXA6ICduYXZpZ2F0aW9uL2FkZCcsXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHROT1RFQk9PS19FRElUT1JfRURJVEFCTEUuaXNFcXVhbFRvKHRydWUpLFxuXHRcdENvbnRleHRLZXlFeHByLm5vdEVxdWFscygnY29uZmlnLm5vdGVib29rLmluc2VydFRvb2xiYXJMb2NhdGlvbicsICdiZXR3ZWVuQ2VsbHMnKSxcblx0XHRDb250ZXh0S2V5RXhwci5ub3RFcXVhbHMoJ2NvbmZpZy5ub3RlYm9vay5pbnNlcnRUb29sYmFyTG9jYXRpb24nLCAnaGlkZGVuJyksXG5cdFx0Q1RYX05PVEVCT09LX0NIQVRfSEFTX0FHRU5ULFxuXHRcdENvbnRleHRLZXlFeHByLm9yKFxuXHRcdFx0Q29udGV4dEtleUV4cHIuZXF1YWxzKGBjb25maWcuJHtOb3RlYm9va1NldHRpbmcuY2VsbENoYXR9YCwgdHJ1ZSksXG5cdFx0XHRDb250ZXh0S2V5RXhwci5lcXVhbHMoYGNvbmZpZy4ke05vdGVib29rU2V0dGluZy5jZWxsR2VuZXJhdGV9YCwgdHJ1ZSlcblx0XHQpXG5cdClcbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBOb3RlYm9va0FjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnbm90ZWJvb2suY2VsbC5jaGF0LmZvY3VzJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnZm9jdXNOb3RlYm9va0NoYXQnLCAnRm9jdXMgQ2hhdCcpLFxuXHRcdFx0a2V5YmluZGluZzogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdFx0Tk9URUJPT0tfRURJVE9SX0ZPQ1VTRUQsXG5cdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5ub3QoSW5wdXRGb2N1c2VkQ29udGV4dEtleSksXG5cdFx0XHRcdFx0XHRDVFhfTk9URUJPT0tfQ0hBVF9PVVRFUl9GT0NVU19QT1NJVElPTi5pc0VxdWFsVG8oJ2Fib3ZlJylcblx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5Eb3duQXJyb3csXG5cdFx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWJcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRcdE5PVEVCT09LX0VESVRPUl9GT0NVU0VELFxuXHRcdFx0XHRcdFx0Q29udGV4dEtleUV4cHIubm90KElucHV0Rm9jdXNlZENvbnRleHRLZXkpLFxuXHRcdFx0XHRcdFx0Q1RYX05PVEVCT09LX0NIQVRfT1VURVJfRk9DVVNfUE9TSVRJT04uaXNFcXVhbFRvKCdiZWxvdycpXG5cdFx0XHRcdFx0KSxcblx0XHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuVXBBcnJvdyxcblx0XHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYlxuXHRcdFx0XHR9XG5cdFx0XHRdLFxuXHRcdFx0ZjE6IGZhbHNlXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW5XaXRoQ29udGV4dChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY29udGV4dDogSU5vdGVib29rQWN0aW9uQ29udGV4dCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdE5vdGVib29rQ2hhdENvbnRyb2xsZXIuZ2V0KGNvbnRleHQubm90ZWJvb2tFZGl0b3IpPy5mb2N1cygpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgTm90ZWJvb2tBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ25vdGVib29rLmNlbGwuY2hhdC5mb2N1c05leHRDZWxsJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnZm9jdXNOZXh0Q2VsbCcsICdGb2N1cyBOZXh0IENlbGwnKSxcblx0XHRcdGtleWJpbmRpbmc6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRcdENUWF9OT1RFQk9PS19DRUxMX0NIQVRfRk9DVVNFRCxcblx0XHRcdFx0XHRcdENUWF9JTkxJTkVfQ0hBVF9GT0NVU0VELFxuXHRcdFx0XHRcdCksXG5cdFx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkRvd25BcnJvdyxcblx0XHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYlxuXHRcdFx0XHR9XG5cdFx0XHRdLFxuXHRcdFx0ZjE6IGZhbHNlXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW5XaXRoQ29udGV4dChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY29udGV4dDogSU5vdGVib29rQWN0aW9uQ29udGV4dCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdE5vdGVib29rQ2hhdENvbnRyb2xsZXIuZ2V0KGNvbnRleHQubm90ZWJvb2tFZGl0b3IpPy5mb2N1c05leHQoKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIE5vdGVib29rQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdub3RlYm9vay5jZWxsLmNoYXQuZm9jdXNQcmV2aW91c0NlbGwnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdmb2N1c1ByZXZpb3VzQ2VsbCcsICdGb2N1cyBQcmV2aW91cyBDZWxsJyksXG5cdFx0XHRrZXliaW5kaW5nOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0XHRDVFhfTk9URUJPT0tfQ0VMTF9DSEFUX0ZPQ1VTRUQsXG5cdFx0XHRcdFx0XHRDVFhfSU5MSU5FX0NIQVRfRk9DVVNFRCxcblx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5VcEFycm93LFxuXHRcdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliXG5cdFx0XHRcdH1cblx0XHRcdF0sXG5cdFx0XHRmMTogZmFsc2Vcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bldpdGhDb250ZXh0KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0OiBJTm90ZWJvb2tBY3Rpb25Db250ZXh0KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Tm90ZWJvb2tDaGF0Q29udHJvbGxlci5nZXQoY29udGV4dC5ub3RlYm9va0VkaXRvcik/LmZvY3VzQWJvdmUoKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIE5vdGVib29rQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiAnbm90ZWJvb2suY2VsbC5jaGF0LnByZXZpb3VzRnJvbUhpc3RvcnknLFxuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUyKCdub3RlYm9vay5jZWxsLmNoYXQucHJldmlvdXNGcm9tSGlzdG9yeScsIFwiUHJldmlvdXMgRnJvbSBIaXN0b3J5XCIpLFxuXHRcdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChDVFhfTk9URUJPT0tfQ0VMTF9DSEFUX0ZPQ1VTRUQsIENUWF9JTkxJTkVfQ0hBVF9GT0NVU0VEKSxcblx0XHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDVFhfTk9URUJPT0tfQ0VMTF9DSEFUX0ZPQ1VTRUQsIENUWF9JTkxJTkVfQ0hBVF9GT0NVU0VEKSxcblx0XHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29yZSArIDEwLFxuXHRcdFx0XHRcdHByaW1hcnk6IEtleUNvZGUuVXBBcnJvdyxcblx0XHRcdFx0fSxcblx0XHRcdFx0ZjE6IGZhbHNlXG5cdFx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bldpdGhDb250ZXh0KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0OiBJTm90ZWJvb2tBY3Rpb25Db250ZXh0KSB7XG5cdFx0Tm90ZWJvb2tDaGF0Q29udHJvbGxlci5nZXQoY29udGV4dC5ub3RlYm9va0VkaXRvcik/LnBvcHVsYXRlSGlzdG9yeSh0cnVlKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIE5vdGVib29rQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiAnbm90ZWJvb2suY2VsbC5jaGF0Lm5leHRGcm9tSGlzdG9yeScsXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ25vdGVib29rLmNlbGwuY2hhdC5uZXh0RnJvbUhpc3RvcnknLCBcIk5leHQgRnJvbSBIaXN0b3J5XCIpLFxuXHRcdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChDVFhfTk9URUJPT0tfQ0VMTF9DSEFUX0ZPQ1VTRUQsIENUWF9JTkxJTkVfQ0hBVF9GT0NVU0VEKSxcblx0XHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDVFhfTk9URUJPT0tfQ0VMTF9DSEFUX0ZPQ1VTRUQsIENUWF9JTkxJTkVfQ0hBVF9GT0NVU0VEKSxcblx0XHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29yZSArIDEwLFxuXHRcdFx0XHRcdHByaW1hcnk6IEtleUNvZGUuRG93bkFycm93XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGYxOiBmYWxzZVxuXHRcdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW5XaXRoQ29udGV4dChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY29udGV4dDogSU5vdGVib29rQWN0aW9uQ29udGV4dCkge1xuXHRcdE5vdGVib29rQ2hhdENvbnRyb2xsZXIuZ2V0KGNvbnRleHQubm90ZWJvb2tFZGl0b3IpPy5wb3B1bGF0ZUhpc3RvcnkoZmFsc2UpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgTm90ZWJvb2tDZWxsQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiAnbm90ZWJvb2suY2VsbC5jaGF0LnJlc3RvcmUnLFxuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUyKCdub3RlYm9va0FjdGlvbnMucmVzdG9yZUNlbGxwcm9tcHQnLCBcIkdlbmVyYXRlXCIpLFxuXHRcdFx0XHRpY29uOiBDb2RpY29uLnNwYXJrbGUsXG5cdFx0XHRcdG1lbnU6IHtcblx0XHRcdFx0XHRpZDogTWVudUlkLk5vdGVib29rQ2VsbFRpdGxlLFxuXHRcdFx0XHRcdGdyb3VwOiBDRUxMX1RJVExFX0NFTExfR1JPVVBfSUQsXG5cdFx0XHRcdFx0b3JkZXI6IDAsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdFx0Tk9URUJPT0tfRURJVE9SX0VESVRBQkxFLmlzRXF1YWxUbyh0cnVlKSxcblx0XHRcdFx0XHRcdENUWF9OT1RFQk9PS19DSEFUX0hBU19BR0VOVCxcblx0XHRcdFx0XHRcdE5PVEVCT09LX0NFTExfR0VORVJBVEVEX0JZX0NIQVQsXG5cdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5lcXVhbHMoYGNvbmZpZy4ke05vdGVib29rU2V0dGluZy5jZWxsQ2hhdH1gLCB0cnVlKVxuXHRcdFx0XHRcdClcblx0XHRcdFx0fSxcblx0XHRcdFx0ZjE6IGZhbHNlXG5cdFx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bldpdGhDb250ZXh0KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0OiBJTm90ZWJvb2tDZWxsQWN0aW9uQ29udGV4dCkge1xuXHRcdGNvbnN0IGNlbGwgPSBjb250ZXh0LmNlbGw7XG5cblx0XHRpZiAoIWNlbGwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBub3RlYm9va0VkaXRvciA9IGNvbnRleHQubm90ZWJvb2tFZGl0b3I7XG5cdFx0Y29uc3QgY29udHJvbGxlciA9IE5vdGVib29rQ2hhdENvbnRyb2xsZXIuZ2V0KG5vdGVib29rRWRpdG9yKTtcblxuXHRcdGlmICghY29udHJvbGxlcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByb21wdCA9IGNvbnRyb2xsZXIuZ2V0UHJvbXB0RnJvbUNhY2hlKGNlbGwpO1xuXG5cdFx0aWYgKHByb21wdCkge1xuXHRcdFx0Y29udHJvbGxlci5yZXN0b3JlKGNlbGwsIHByb21wdCk7XG5cdFx0fVxuXHR9XG59KTtcblxuXG5leHBvcnQgY2xhc3MgQWNjZXB0Q2hhbmdlc0FuZFJ1biBleHRlbmRzIEVkaXRvckFjdGlvbjIge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnbm90ZWJvb2suaW5saW5lQ2hhdC5hY2NlcHRDaGFuZ2VzQW5kUnVuJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ25vdGVib29rLmFwcGx5MScsIFwiQWNjZXB0IGFuZCBSdW5cIiksXG5cdFx0XHRzaG9ydFRpdGxlOiBsb2NhbGl6ZSgnbm90ZWJvb2suYXBwbHkyJywgJ0FjY2VwdCAmIFJ1bicpLFxuXHRcdFx0dG9vbHRpcDogbG9jYWxpemUoJ25vdGVib29rLmFwcGx5MycsICdBY2NlcHQgdGhlIGNoYW5nZXMgYW5kIHJ1biB0aGUgY2VsbCcpLFxuXHRcdFx0aWNvbjogQ29kaWNvbi5jaGVjayxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdE5PVEVCT09LX0VESVRPUl9FRElUQUJMRS5pc0VxdWFsVG8odHJ1ZSksXG5cdFx0XHRcdENUWF9JTkxJTkVfQ0hBVF9WSVNJQkxFLFxuXHRcdFx0KSxcblx0XHRcdGtleWJpbmRpbmc6IHVuZGVmaW5lZCxcblx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdGlkOiBNRU5VX0lOTElORV9DSEFUX1dJREdFVF9TVEFUVVMsXG5cdFx0XHRcdGdyb3VwOiAnMF9tYWluJyxcblx0XHRcdFx0b3JkZXI6IDIsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHROT1RFQk9PS19FRElUT1JfRURJVEFCTEUuaXNFcXVhbFRvKHRydWUpLFxuXHRcdFx0XHRcdENoYXRDb250ZXh0S2V5cy5pbnB1dEhhc1RleHQudG9OZWdhdGVkKCksXG5cdFx0XHRcdFx0Q1RYX0lOTElORV9DSEFUX1JFUVVFU1RfSU5fUFJPR1JFU1MudG9OZWdhdGVkKCksXG5cdFx0XHRcdFx0Q1RYX0lOTElORV9DSEFUX1JFU1BPTlNFX1RZUEUuaXNFcXVhbFRvKElubGluZUNoYXRSZXNwb25zZVR5cGUuTWVzc2FnZXNBbmRFZGl0cylcblx0XHRcdFx0KVxuXHRcdFx0fV1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIHJ1bkVkaXRvckNvbW1hbmQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGNvZGVFZGl0b3I6IElDb2RlRWRpdG9yKSB7XG5cdFx0Y29uc3QgZWRpdG9yID0gZ2V0Q29udGV4dEZyb21BY3RpdmVFZGl0b3IoYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKSk7XG5cdFx0Y29uc3QgY3RybCA9IElubGluZUNoYXRDb250cm9sbGVyLmdldChjb2RlRWRpdG9yKTtcblxuXHRcdGlmICghZWRpdG9yIHx8ICFjdHJsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbWF0Y2hlZENlbGwgPSBlZGl0b3Iubm90ZWJvb2tFZGl0b3IuY29kZUVkaXRvcnMuZmluZChlID0+IGVbMV0gPT09IGNvZGVFZGl0b3IpO1xuXHRcdGNvbnN0IGNlbGwgPSBtYXRjaGVkQ2VsbD8uWzBdO1xuXG5cdFx0aWYgKCFjZWxsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y3RybC5hY2NlcHRTZXNzaW9uKCk7XG5cdFx0cmV0dXJuIGVkaXRvci5ub3RlYm9va0VkaXRvci5leGVjdXRlTm90ZWJvb2tDZWxscyhJdGVyYWJsZS5zaW5nbGUoY2VsbCkpO1xuXHR9XG59XG5yZWdpc3RlckFjdGlvbjIoQWNjZXB0Q2hhbmdlc0FuZFJ1bik7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLGVBQWU7QUFDeEIsU0FBUyxVQUFVLFNBQVMsY0FBYztBQUMxQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLFVBQVUsaUJBQWlCO0FBQ3BDLFNBQVMsMENBQTBDO0FBQ25ELFNBQVMsUUFBUSxjQUFjLHVCQUF1QjtBQUN0RCxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLDhCQUE4QjtBQUV2QyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHlCQUF5QixvQ0FBb0MsbUNBQW1DLHFDQUFxQywrQkFBK0IseUJBQXlCLHdCQUF3QixzQ0FBc0M7QUFDcFEsU0FBUyxnQ0FB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WTtBQUNoQjtBQUFBLElBQ0Q7QUFFQSxVQUFNLFNBQVMsV0FBVyxtQkFBbUIsSUFBSTtBQUVqRCxRQUFJLFFBQVE7QUFDWCxpQkFBVyxRQUFRLE1BQU0sTUFBTTtBQUFBLElBQ2hDO0FBQUEsRUFDRDtBQUNELENBQUM7QUFHTSxNQUFNLDRCQUE0QixjQUFjO0FBQUEsRUFFdEQsY0FBYztBQUNiLFVBQU07QUFBQSxNQUNMLElBQUk7QUFBQSxNQUNKLE9BQU8sVUFBVSxtQkFBbUIsZ0JBQWdCO0FBQUEsTUFDcEQsWUFBWSxTQUFTLG1CQUFtQixjQUFjO0FBQUEsTUFDdEQsU0FBUyxTQUFTLG1CQUFtQixxQ0FBcUM7QUFBQSxNQUMxRSxNQUFNLFFBQVE7QUFBQSxNQUNkLElBQUk7QUFBQSxNQUNKLGNBQWMsZUFBZTtBQUFBLFFBQzVCLHlCQUF5QixVQUFVLElBQUk7QUFBQSxRQUN2QztBQUFBLE1BQ0Q7QUFBQSxNQUNBLFlBQVk7QUFBQSxNQUNaLE1BQU0sQ0FBQztBQUFBLFFBQ04sSUFBSTtBQUFBLFFBQ0osT0FBTztBQUFBLFFBQ1AsT0FBTztBQUFBLFFBQ1AsTUFBTSxlQUFlO0FBQUEsVUFDcEIseUJBQXlCLFVBQVUsSUFBSTtBQUFBLFVBQ3ZDLGdCQUFnQixhQUFhLFVBQVU7QUFBQSxVQUN2QyxvQ0FBb0MsVUFBVTtBQUFBLFVBQzlDLDhCQUE4QixVQUFVLHVCQUF1QixnQkFBZ0I7QUFBQSxRQUNoRjtBQUFBLE1BQ0QsQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVTLGlCQUFpQixVQUE0QixZQUF5QjtBQUM5RSxVQUFNLFNBQVMsMkJBQTJCLFNBQVMsSUFBSSxjQUFjLENBQUM7QUFDdEUsVUFBTSxPQUFPLHFCQUFxQixJQUFJLFVBQVU7QUFFaEQsUUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNO0FBQ3JCO0FBQUEsSUFDRDtBQUVBLFVBQU0sY0FBYyxPQUFPLGVBQWUsWUFBWSxLQUFLLE9BQUssRUFBRSxDQUFDLE1BQU0sVUFBVTtBQUNuRixVQUFNLE9BQU8sY0FBYyxDQUFDO0FBRTVCLFFBQUksQ0FBQyxNQUFNO0FBQ1Y7QUFBQSxJQUNEO0FBRUEsU0FBSyxjQUFjO0FBQ25CLFdBQU8sT0FBTyxlQUFlLHFCQUFxQixTQUFTLE9BQU8sSUFBSSxDQUFDO0FBQUEsRUFDeEU7QUFDRDtBQUNBLGdCQUFnQixtQkFBbUI7IiwKICAibmFtZXMiOiBbIm5vdGVib29rRWRpdG9yIl0KfQo=
