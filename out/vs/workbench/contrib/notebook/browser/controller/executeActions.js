import { Iterable } from "../../../../../base/common/iterator.js";
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { localize, localize2 } from "../../../../../nls.js";
import { MenuId, MenuRegistry, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { EditorsOrder } from "../../../../common/editor.js";
import { IDebugService } from "../../../debug/common/debug.js";
import { CTX_INLINE_CHAT_FOCUSED } from "../../../inlineChat/common/inlineChat.js";
import { insertCell } from "./cellOperations.js";
import { NotebookChatController } from "./chat/notebookChatController.js";
import { CELL_TITLE_CELL_GROUP_ID, CellToolbarOrder, NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT, NotebookAction, NotebookCellAction, NotebookMultiCellAction, cellExecutionArgs, getContextFromActiveEditor, getContextFromUri, parseMultiCellExecutionArgs } from "./coreActions.js";
import { CellEditState, CellFocusMode, EXECUTE_CELL_COMMAND_ID, ScrollToRevealBehavior } from "../notebookBrowser.js";
import * as icons from "../notebookIcons.js";
import { CellKind, CellUri, NotebookSetting } from "../../common/notebookCommon.js";
import { NOTEBOOK_CELL_EXECUTING, NOTEBOOK_CELL_EXECUTION_STATE, NOTEBOOK_CELL_LIST_FOCUSED, NOTEBOOK_CELL_TYPE, NOTEBOOK_HAS_RUNNING_CELL, NOTEBOOK_HAS_SOMETHING_RUNNING, NOTEBOOK_INTERRUPTIBLE_KERNEL, NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_KERNEL_COUNT, NOTEBOOK_KERNEL_SOURCE_COUNT, NOTEBOOK_LAST_CELL_FAILED, NOTEBOOK_MISSING_KERNEL_EXTENSION } from "../../common/notebookContextKeys.js";
import { NotebookEditorInput } from "../../common/notebookEditorInput.js";
import { INotebookExecutionStateService } from "../../common/notebookExecutionStateService.js";
import { IEditorGroupsService } from "../../../../services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
const EXECUTE_NOTEBOOK_COMMAND_ID = "notebook.execute";
const CANCEL_NOTEBOOK_COMMAND_ID = "notebook.cancelExecution";
const INTERRUPT_NOTEBOOK_COMMAND_ID = "notebook.interruptExecution";
const CANCEL_CELL_COMMAND_ID = "notebook.cell.cancelExecution";
const EXECUTE_CELL_FOCUS_CONTAINER_COMMAND_ID = "notebook.cell.executeAndFocusContainer";
const EXECUTE_CELL_SELECT_BELOW = "notebook.cell.executeAndSelectBelow";
const EXECUTE_CELL_INSERT_BELOW = "notebook.cell.executeAndInsertBelow";
const EXECUTE_CELL_AND_BELOW = "notebook.cell.executeCellAndBelow";
const EXECUTE_CELLS_ABOVE = "notebook.cell.executeCellsAbove";
const RENDER_ALL_MARKDOWN_CELLS = "notebook.renderAllMarkdownCells";
const REVEAL_RUNNING_CELL = "notebook.revealRunningCell";
const REVEAL_LAST_FAILED_CELL = "notebook.revealLastFailedCell";
const executeCondition = ContextKeyExpr.and(
  NOTEBOOK_CELL_TYPE.isEqualTo("code"),
  ContextKeyExpr.or(
    ContextKeyExpr.greater(NOTEBOOK_KERNEL_COUNT.key, 0),
    ContextKeyExpr.greater(NOTEBOOK_KERNEL_SOURCE_COUNT.key, 0),
    NOTEBOOK_MISSING_KERNEL_EXTENSION
  )
);
const executeThisCellCondition = ContextKeyExpr.and(
  executeCondition,
  NOTEBOOK_CELL_EXECUTING.toNegated()
);
const executeSectionCondition = ContextKeyExpr.and(
  NOTEBOOK_CELL_TYPE.isEqualTo("markup")
);
function renderAllMarkdownCells(context) {
  for (let i = 0; i < context.notebookEditor.getLength(); i++) {
    const cell = context.notebookEditor.cellAt(i);
    if (cell.cellKind === CellKind.Markup) {
      cell.updateEditState(CellEditState.Preview, "renderAllMarkdownCells");
    }
  }
}
async function runCell(editorGroupsService, context) {
  const group = editorGroupsService.activeGroup;
  if (group) {
    if (group.activeEditor) {
      group.pinEditor(group.activeEditor);
    }
  }
  if (context.ui && context.cell) {
    await context.notebookEditor.executeNotebookCells(Iterable.single(context.cell));
    if (context.autoReveal) {
      const cellIndex = context.notebookEditor.getCellIndex(context.cell);
      context.notebookEditor.revealCellRangeInView({ start: cellIndex, end: cellIndex + 1 });
    }
  } else if (context.selectedCells?.length || context.cell) {
    const selectedCells = context.selectedCells?.length ? context.selectedCells : [context.cell];
    await context.notebookEditor.executeNotebookCells(selectedCells);
    const firstCell = selectedCells[0];
    if (firstCell && context.autoReveal) {
      const cellIndex = context.notebookEditor.getCellIndex(firstCell);
      context.notebookEditor.revealCellRangeInView({ start: cellIndex, end: cellIndex + 1 });
    }
  }
  let foundEditor = void 0;
  for (const [, codeEditor] of context.notebookEditor.codeEditors) {
    if (isEqual(codeEditor.getModel()?.uri, (context.cell ?? context.selectedCells?.[0])?.uri)) {
      foundEditor = codeEditor;
      break;
    }
  }
  if (!foundEditor) {
    return;
  }
}
registerAction2(class RenderAllMarkdownCellsAction extends NotebookAction {
  constructor() {
    super({
      id: RENDER_ALL_MARKDOWN_CELLS,
      title: localize("notebookActions.renderMarkdown", "Render All Markdown Cells")
    });
  }
  async runWithContext(accessor, context) {
    renderAllMarkdownCells(context);
  }
});
registerAction2(class ExecuteNotebookAction extends NotebookAction {
  constructor() {
    super({
      id: EXECUTE_NOTEBOOK_COMMAND_ID,
      title: localize("notebookActions.executeNotebook", "Run All"),
      icon: icons.executeAllIcon,
      metadata: {
        description: localize("notebookActions.executeNotebook", "Run All"),
        args: [
          {
            name: "uri",
            description: "The document uri"
          }
        ]
      },
      menu: [
        {
          id: MenuId.EditorTitle,
          order: -1,
          group: "navigation",
          when: ContextKeyExpr.and(
            NOTEBOOK_IS_ACTIVE_EDITOR,
            ContextKeyExpr.or(NOTEBOOK_INTERRUPTIBLE_KERNEL.toNegated(), NOTEBOOK_HAS_SOMETHING_RUNNING.toNegated()),
            ContextKeyExpr.notEquals("config.notebook.globalToolbar", true)
          )
        },
        {
          id: MenuId.NotebookToolbar,
          order: -1,
          group: "navigation/execute",
          when: ContextKeyExpr.and(
            ContextKeyExpr.or(
              NOTEBOOK_INTERRUPTIBLE_KERNEL.toNegated(),
              NOTEBOOK_HAS_SOMETHING_RUNNING.toNegated()
            ),
            ContextKeyExpr.and(NOTEBOOK_HAS_SOMETHING_RUNNING, NOTEBOOK_INTERRUPTIBLE_KERNEL.toNegated())?.negate(),
            ContextKeyExpr.equals("config.notebook.globalToolbar", true)
          )
        }
      ]
    });
  }
  getEditorContextFromArgsOrActive(accessor, context) {
    return getContextFromUri(accessor, context) ?? getContextFromActiveEditor(accessor.get(IEditorService));
  }
  async runWithContext(accessor, context) {
    renderAllMarkdownCells(context);
    const editorService = accessor.get(IEditorService);
    const editor = editorService.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).find(
      (editor2) => editor2.editor instanceof NotebookEditorInput && editor2.editor.viewType === context.notebookEditor.textModel.viewType && editor2.editor.resource.toString() === context.notebookEditor.textModel.uri.toString()
    );
    const editorGroupService = accessor.get(IEditorGroupsService);
    if (editor) {
      const group = editorGroupService.getGroup(editor.groupId);
      group?.pinEditor(editor.editor);
    }
    return context.notebookEditor.executeNotebookCells();
  }
});
registerAction2(class ExecuteCell extends NotebookMultiCellAction {
  constructor() {
    super({
      id: EXECUTE_CELL_COMMAND_ID,
      precondition: executeThisCellCondition,
      title: localize("notebookActions.execute", "Execute Cell"),
      keybinding: {
        when: NOTEBOOK_CELL_LIST_FOCUSED,
        primary: KeyMod.WinCtrl | KeyCode.Enter,
        win: {
          primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.Enter
        },
        weight: NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT
      },
      menu: {
        id: MenuId.NotebookCellExecutePrimary,
        when: executeThisCellCondition,
        group: "inline"
      },
      metadata: {
        description: localize("notebookActions.execute", "Execute Cell"),
        args: cellExecutionArgs
      },
      icon: icons.executeIcon
    });
  }
  parseArgs(accessor, ...args) {
    return parseMultiCellExecutionArgs(accessor, ...args);
  }
  async runWithContext(accessor, context) {
    const editorGroupsService = accessor.get(IEditorGroupsService);
    if (context.ui) {
      await context.notebookEditor.focusNotebookCell(context.cell, "container", { skipReveal: true });
    }
    const chatController = NotebookChatController.get(context.notebookEditor);
    const editingCell = chatController?.getEditingCell();
    if (chatController?.hasFocus() && editingCell) {
      const group = editorGroupsService.activeGroup;
      if (group) {
        if (group.activeEditor) {
          group.pinEditor(group.activeEditor);
        }
      }
      await context.notebookEditor.executeNotebookCells([editingCell]);
      return;
    }
    await runCell(editorGroupsService, context);
  }
});
registerAction2(class ExecuteAboveCells extends NotebookMultiCellAction {
  constructor() {
    super({
      id: EXECUTE_CELLS_ABOVE,
      precondition: executeCondition,
      title: localize("notebookActions.executeAbove", "Execute Above Cells"),
      menu: [
        {
          id: MenuId.NotebookCellExecute,
          when: ContextKeyExpr.and(
            executeCondition,
            ContextKeyExpr.equals(`config.${NotebookSetting.consolidatedRunButton}`, true)
          )
        },
        {
          id: MenuId.NotebookCellTitle,
          order: CellToolbarOrder.ExecuteAboveCells,
          group: CELL_TITLE_CELL_GROUP_ID,
          when: ContextKeyExpr.and(
            executeCondition,
            ContextKeyExpr.equals(`config.${NotebookSetting.consolidatedRunButton}`, false)
          )
        }
      ],
      icon: icons.executeAboveIcon
    });
  }
  parseArgs(accessor, ...args) {
    return parseMultiCellExecutionArgs(accessor, ...args);
  }
  async runWithContext(accessor, context) {
    let endCellIdx = void 0;
    if (context.ui) {
      endCellIdx = context.notebookEditor.getCellIndex(context.cell);
      await context.notebookEditor.focusNotebookCell(context.cell, "container", { skipReveal: true });
    } else {
      endCellIdx = Math.min(...context.selectedCells.map((cell) => context.notebookEditor.getCellIndex(cell)));
    }
    if (typeof endCellIdx === "number") {
      const range = { start: 0, end: endCellIdx };
      const cells = context.notebookEditor.getCellsInRange(range);
      context.notebookEditor.executeNotebookCells(cells);
    }
  }
});
registerAction2(class ExecuteCellAndBelow extends NotebookMultiCellAction {
  constructor() {
    super({
      id: EXECUTE_CELL_AND_BELOW,
      precondition: executeCondition,
      title: localize("notebookActions.executeBelow", "Execute Cell and Below"),
      menu: [
        {
          id: MenuId.NotebookCellExecute,
          when: ContextKeyExpr.and(
            executeCondition,
            ContextKeyExpr.equals(`config.${NotebookSetting.consolidatedRunButton}`, true)
          )
        },
        {
          id: MenuId.NotebookCellTitle,
          order: CellToolbarOrder.ExecuteCellAndBelow,
          group: CELL_TITLE_CELL_GROUP_ID,
          when: ContextKeyExpr.and(
            executeCondition,
            ContextKeyExpr.equals(`config.${NotebookSetting.consolidatedRunButton}`, false)
          )
        }
      ],
      icon: icons.executeBelowIcon
    });
  }
  parseArgs(accessor, ...args) {
    return parseMultiCellExecutionArgs(accessor, ...args);
  }
  async runWithContext(accessor, context) {
    let startCellIdx = void 0;
    if (context.ui) {
      startCellIdx = context.notebookEditor.getCellIndex(context.cell);
      await context.notebookEditor.focusNotebookCell(context.cell, "container", { skipReveal: true });
    } else {
      startCellIdx = Math.min(...context.selectedCells.map((cell) => context.notebookEditor.getCellIndex(cell)));
    }
    if (typeof startCellIdx === "number") {
      const range = { start: startCellIdx, end: context.notebookEditor.getLength() };
      const cells = context.notebookEditor.getCellsInRange(range);
      context.notebookEditor.executeNotebookCells(cells);
    }
  }
});
registerAction2(class ExecuteCellFocusContainer extends NotebookMultiCellAction {
  constructor() {
    super({
      id: EXECUTE_CELL_FOCUS_CONTAINER_COMMAND_ID,
      precondition: executeThisCellCondition,
      title: localize("notebookActions.executeAndFocusContainer", "Execute Cell and Focus Container"),
      metadata: {
        description: localize("notebookActions.executeAndFocusContainer", "Execute Cell and Focus Container"),
        args: cellExecutionArgs
      },
      icon: icons.executeIcon
    });
  }
  parseArgs(accessor, ...args) {
    return parseMultiCellExecutionArgs(accessor, ...args);
  }
  async runWithContext(accessor, context) {
    const editorGroupsService = accessor.get(IEditorGroupsService);
    if (context.ui) {
      await context.notebookEditor.focusNotebookCell(context.cell, "container", { skipReveal: true });
    } else {
      const firstCell = context.selectedCells[0];
      if (firstCell) {
        await context.notebookEditor.focusNotebookCell(firstCell, "container", { skipReveal: true });
      }
    }
    await runCell(editorGroupsService, context);
  }
});
const cellCancelCondition = ContextKeyExpr.or(
  ContextKeyExpr.equals(NOTEBOOK_CELL_EXECUTION_STATE.key, "executing"),
  ContextKeyExpr.equals(NOTEBOOK_CELL_EXECUTION_STATE.key, "pending")
);
registerAction2(class CancelExecuteCell extends NotebookMultiCellAction {
  constructor() {
    super({
      id: CANCEL_CELL_COMMAND_ID,
      precondition: cellCancelCondition,
      title: localize("notebookActions.cancel", "Stop Cell Execution"),
      icon: icons.stopIcon,
      menu: {
        id: MenuId.NotebookCellExecutePrimary,
        when: cellCancelCondition,
        group: "inline"
      },
      metadata: {
        description: localize("notebookActions.cancel", "Stop Cell Execution"),
        args: [
          {
            name: "options",
            description: "The cell range options",
            schema: {
              "type": "object",
              "required": ["ranges"],
              "properties": {
                "ranges": {
                  "type": "array",
                  items: [
                    {
                      "type": "object",
                      "required": ["start", "end"],
                      "properties": {
                        "start": {
                          "type": "number"
                        },
                        "end": {
                          "type": "number"
                        }
                      }
                    }
                  ]
                },
                "document": {
                  "type": "object",
                  "description": "The document uri"
                }
              }
            }
          }
        ]
      }
    });
  }
  parseArgs(accessor, ...args) {
    return parseMultiCellExecutionArgs(accessor, ...args);
  }
  async runWithContext(accessor, context) {
    if (context.ui) {
      await context.notebookEditor.focusNotebookCell(context.cell, "container", { skipReveal: true });
      return context.notebookEditor.cancelNotebookCells(Iterable.single(context.cell));
    } else {
      return context.notebookEditor.cancelNotebookCells(context.selectedCells);
    }
  }
});
registerAction2(class ExecuteCellSelectBelow extends NotebookCellAction {
  constructor() {
    super({
      id: EXECUTE_CELL_SELECT_BELOW,
      precondition: ContextKeyExpr.or(executeThisCellCondition, NOTEBOOK_CELL_TYPE.isEqualTo("markup")),
      title: localize("notebookActions.executeAndSelectBelow", "Execute Notebook Cell and Select Below"),
      keybinding: {
        when: ContextKeyExpr.and(
          NOTEBOOK_CELL_LIST_FOCUSED,
          CTX_INLINE_CHAT_FOCUSED.negate()
        ),
        primary: KeyMod.Shift | KeyCode.Enter,
        weight: NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT
      }
    });
  }
  async runWithContext(accessor, context) {
    const editorGroupsService = accessor.get(IEditorGroupsService);
    const idx = context.notebookEditor.getCellIndex(context.cell);
    if (typeof idx !== "number") {
      return;
    }
    const languageService = accessor.get(ILanguageService);
    const config = accessor.get(IConfigurationService);
    const scrollBehavior = config.getValue(NotebookSetting.scrollToRevealCell);
    let focusOptions;
    if (scrollBehavior === "none") {
      focusOptions = { skipReveal: true };
    } else {
      focusOptions = {
        revealBehavior: scrollBehavior === "fullCell" ? ScrollToRevealBehavior.fullCell : ScrollToRevealBehavior.firstLine
      };
    }
    if (context.cell.cellKind === CellKind.Markup) {
      const nextCell = context.notebookEditor.cellAt(idx + 1);
      context.cell.updateEditState(CellEditState.Preview, EXECUTE_CELL_SELECT_BELOW);
      if (nextCell) {
        await context.notebookEditor.focusNotebookCell(nextCell, "container", focusOptions);
      } else {
        const newCell = insertCell(languageService, context.notebookEditor, idx, CellKind.Markup, "below");
        if (newCell) {
          await context.notebookEditor.focusNotebookCell(newCell, "editor", focusOptions);
        }
      }
      return;
    } else {
      const nextCell = context.notebookEditor.cellAt(idx + 1);
      if (nextCell) {
        await context.notebookEditor.focusNotebookCell(nextCell, "container", focusOptions);
      } else {
        const newCell = insertCell(languageService, context.notebookEditor, idx, CellKind.Code, "below");
        if (newCell) {
          await context.notebookEditor.focusNotebookCell(newCell, "editor", focusOptions);
        }
      }
      return runCell(editorGroupsService, context);
    }
  }
});
registerAction2(class ExecuteCellInsertBelow extends NotebookCellAction {
  constructor() {
    super({
      id: EXECUTE_CELL_INSERT_BELOW,
      precondition: ContextKeyExpr.or(executeThisCellCondition, NOTEBOOK_CELL_TYPE.isEqualTo("markup")),
      title: localize("notebookActions.executeAndInsertBelow", "Execute Notebook Cell and Insert Below"),
      keybinding: {
        when: NOTEBOOK_CELL_LIST_FOCUSED,
        primary: KeyMod.Alt | KeyCode.Enter,
        weight: NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT
      }
    });
  }
  async runWithContext(accessor, context) {
    const editorGroupsService = accessor.get(IEditorGroupsService);
    const idx = context.notebookEditor.getCellIndex(context.cell);
    const languageService = accessor.get(ILanguageService);
    const newFocusMode = context.cell.focusMode === CellFocusMode.Editor ? "editor" : "container";
    const newCell = insertCell(languageService, context.notebookEditor, idx, context.cell.cellKind, "below");
    if (newCell) {
      await context.notebookEditor.focusNotebookCell(newCell, newFocusMode);
    }
    if (context.cell.cellKind === CellKind.Markup) {
      context.cell.updateEditState(CellEditState.Preview, EXECUTE_CELL_INSERT_BELOW);
    } else {
      runCell(editorGroupsService, context);
    }
  }
});
class CancelNotebook extends NotebookAction {
  getEditorContextFromArgsOrActive(accessor, context) {
    return getContextFromUri(accessor, context) ?? getContextFromActiveEditor(accessor.get(IEditorService));
  }
  async runWithContext(accessor, context) {
    return context.notebookEditor.cancelNotebookCells();
  }
}
registerAction2(class CancelAllNotebook extends CancelNotebook {
  constructor() {
    super({
      id: CANCEL_NOTEBOOK_COMMAND_ID,
      title: localize2("notebookActions.cancelNotebook", "Stop Execution"),
      icon: icons.stopIcon,
      menu: [
        {
          id: MenuId.EditorTitle,
          order: -1,
          group: "navigation",
          when: ContextKeyExpr.and(
            NOTEBOOK_IS_ACTIVE_EDITOR,
            NOTEBOOK_HAS_SOMETHING_RUNNING,
            NOTEBOOK_INTERRUPTIBLE_KERNEL.toNegated(),
            ContextKeyExpr.notEquals("config.notebook.globalToolbar", true)
          )
        },
        {
          id: MenuId.NotebookToolbar,
          order: -1,
          group: "navigation/execute",
          when: ContextKeyExpr.and(
            NOTEBOOK_HAS_SOMETHING_RUNNING,
            NOTEBOOK_INTERRUPTIBLE_KERNEL.toNegated(),
            ContextKeyExpr.equals("config.notebook.globalToolbar", true)
          )
        }
      ]
    });
  }
});
registerAction2(class InterruptNotebook extends CancelNotebook {
  constructor() {
    super({
      id: INTERRUPT_NOTEBOOK_COMMAND_ID,
      title: localize2("notebookActions.interruptNotebook", "Interrupt"),
      precondition: ContextKeyExpr.and(
        NOTEBOOK_HAS_SOMETHING_RUNNING,
        NOTEBOOK_INTERRUPTIBLE_KERNEL
      ),
      icon: icons.stopIcon,
      menu: [
        {
          id: MenuId.EditorTitle,
          order: -1,
          group: "navigation",
          when: ContextKeyExpr.and(
            NOTEBOOK_IS_ACTIVE_EDITOR,
            NOTEBOOK_HAS_SOMETHING_RUNNING,
            NOTEBOOK_INTERRUPTIBLE_KERNEL,
            ContextKeyExpr.notEquals("config.notebook.globalToolbar", true)
          )
        },
        {
          id: MenuId.NotebookToolbar,
          order: -1,
          group: "navigation/execute",
          when: ContextKeyExpr.and(
            NOTEBOOK_HAS_SOMETHING_RUNNING,
            NOTEBOOK_INTERRUPTIBLE_KERNEL,
            ContextKeyExpr.equals("config.notebook.globalToolbar", true)
          )
        },
        {
          id: MenuId.InteractiveToolbar,
          group: "navigation/execute"
        }
      ]
    });
  }
});
MenuRegistry.appendMenuItem(MenuId.NotebookToolbar, {
  title: localize("revealRunningCellShort", "Go To"),
  submenu: MenuId.NotebookCellExecuteGoTo,
  group: "navigation/execute",
  order: 20,
  icon: ThemeIcon.modify(icons.executingStateIcon, "spin")
});
registerAction2(class RevealRunningCellAction extends NotebookAction {
  constructor() {
    super({
      id: REVEAL_RUNNING_CELL,
      title: localize("revealRunningCell", "Go to Running Cell"),
      tooltip: localize("revealRunningCell", "Go to Running Cell"),
      shortTitle: localize("revealRunningCell", "Go to Running Cell"),
      precondition: NOTEBOOK_HAS_RUNNING_CELL,
      menu: [
        {
          id: MenuId.EditorTitle,
          when: ContextKeyExpr.and(
            NOTEBOOK_IS_ACTIVE_EDITOR,
            NOTEBOOK_HAS_RUNNING_CELL,
            ContextKeyExpr.notEquals("config.notebook.globalToolbar", true)
          ),
          group: "navigation",
          order: 0
        },
        {
          id: MenuId.NotebookCellExecuteGoTo,
          when: ContextKeyExpr.and(
            NOTEBOOK_IS_ACTIVE_EDITOR,
            NOTEBOOK_HAS_RUNNING_CELL,
            ContextKeyExpr.equals("config.notebook.globalToolbar", true)
          ),
          group: "navigation/execute",
          order: 20
        },
        {
          id: MenuId.InteractiveToolbar,
          when: ContextKeyExpr.and(
            NOTEBOOK_HAS_RUNNING_CELL,
            ContextKeyExpr.equals("activeEditor", "workbench.editor.interactive")
          ),
          group: "navigation",
          order: 10
        }
      ],
      icon: ThemeIcon.modify(icons.executingStateIcon, "spin")
    });
  }
  async runWithContext(accessor, context) {
    const notebookExecutionStateService = accessor.get(INotebookExecutionStateService);
    const notebook = context.notebookEditor.textModel.uri;
    const executingCells = notebookExecutionStateService.getCellExecutionsForNotebook(notebook);
    if (executingCells[0]) {
      const topStackFrameCell = this.findCellAtTopFrame(accessor, notebook);
      const focusHandle = topStackFrameCell ?? executingCells[0].cellHandle;
      const cell = context.notebookEditor.getCellByHandle(focusHandle);
      if (cell) {
        context.notebookEditor.focusNotebookCell(cell, "container");
      }
    }
  }
  findCellAtTopFrame(accessor, notebook) {
    const debugService = accessor.get(IDebugService);
    for (const session of debugService.getModel().getSessions()) {
      for (const thread of session.getAllThreads()) {
        const sf = thread.getTopStackFrame();
        if (sf) {
          const parsed = CellUri.parse(sf.source.uri);
          if (parsed && parsed.notebook.toString() === notebook.toString()) {
            return parsed.handle;
          }
        }
      }
    }
    return void 0;
  }
});
registerAction2(class RevealLastFailedCellAction extends NotebookAction {
  constructor() {
    super({
      id: REVEAL_LAST_FAILED_CELL,
      title: localize("revealLastFailedCell", "Go to Most Recently Failed Cell"),
      tooltip: localize("revealLastFailedCell", "Go to Most Recently Failed Cell"),
      shortTitle: localize("revealLastFailedCellShort", "Go to Most Recently Failed Cell"),
      precondition: NOTEBOOK_LAST_CELL_FAILED,
      menu: [
        {
          id: MenuId.EditorTitle,
          when: ContextKeyExpr.and(
            NOTEBOOK_IS_ACTIVE_EDITOR,
            NOTEBOOK_LAST_CELL_FAILED,
            NOTEBOOK_HAS_RUNNING_CELL.toNegated(),
            ContextKeyExpr.notEquals("config.notebook.globalToolbar", true)
          ),
          group: "navigation",
          order: 0
        },
        {
          id: MenuId.NotebookCellExecuteGoTo,
          when: ContextKeyExpr.and(
            NOTEBOOK_IS_ACTIVE_EDITOR,
            NOTEBOOK_LAST_CELL_FAILED,
            NOTEBOOK_HAS_RUNNING_CELL.toNegated(),
            ContextKeyExpr.equals("config.notebook.globalToolbar", true)
          ),
          group: "navigation/execute",
          order: 20
        }
      ],
      icon: icons.errorStateIcon
    });
  }
  async runWithContext(accessor, context) {
    const notebookExecutionStateService = accessor.get(INotebookExecutionStateService);
    const notebook = context.notebookEditor.textModel.uri;
    const lastFailedCellHandle = notebookExecutionStateService.getLastFailedCellForNotebook(notebook);
    if (lastFailedCellHandle !== void 0) {
      const lastFailedCell = context.notebookEditor.getCellByHandle(lastFailedCellHandle);
      if (lastFailedCell) {
        context.notebookEditor.focusNotebookCell(lastFailedCell, "container");
      }
    }
  }
});
export {
  executeCondition,
  executeSectionCondition,
  executeThisCellCondition
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL2NvbnRyb2xsZXIvZXhlY3V0ZUFjdGlvbnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBJdGVyYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2l0ZXJhdG9yLmpzJztcbmltcG9ydCB7IEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IGlzRXF1YWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IFVSSSwgVXJpQ29tcG9uZW50cyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgTWVudUlkLCBNZW51UmVnaXN0cnksIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgRWRpdG9yc09yZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJRGVidWdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vZGVidWcvY29tbW9uL2RlYnVnLmpzJztcbmltcG9ydCB7IENUWF9JTkxJTkVfQ0hBVF9GT0NVU0VEIH0gZnJvbSAnLi4vLi4vLi4vaW5saW5lQ2hhdC9jb21tb24vaW5saW5lQ2hhdC5qcyc7XG5pbXBvcnQgeyBpbnNlcnRDZWxsIH0gZnJvbSAnLi9jZWxsT3BlcmF0aW9ucy5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0NoYXRDb250cm9sbGVyIH0gZnJvbSAnLi9jaGF0L25vdGVib29rQ2hhdENvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgQ0VMTF9USVRMRV9DRUxMX0dST1VQX0lELCBDZWxsVG9vbGJhck9yZGVyLCBJTm90ZWJvb2tBY3Rpb25Db250ZXh0LCBJTm90ZWJvb2tDZWxsQWN0aW9uQ29udGV4dCwgSU5vdGVib29rQ2VsbFRvb2xiYXJBY3Rpb25Db250ZXh0LCBJTm90ZWJvb2tDb21tYW5kQ29udGV4dCwgTk9URUJPT0tfRURJVE9SX1dJREdFVF9BQ1RJT05fV0VJR0hULCBOb3RlYm9va0FjdGlvbiwgTm90ZWJvb2tDZWxsQWN0aW9uLCBOb3RlYm9va011bHRpQ2VsbEFjdGlvbiwgY2VsbEV4ZWN1dGlvbkFyZ3MsIGdldENvbnRleHRGcm9tQWN0aXZlRWRpdG9yLCBnZXRDb250ZXh0RnJvbVVyaSwgcGFyc2VNdWx0aUNlbGxFeGVjdXRpb25BcmdzIH0gZnJvbSAnLi9jb3JlQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDZWxsRWRpdFN0YXRlLCBDZWxsRm9jdXNNb2RlLCBFWEVDVVRFX0NFTExfQ09NTUFORF9JRCwgSUZvY3VzTm90ZWJvb2tDZWxsT3B0aW9ucywgU2Nyb2xsVG9SZXZlYWxCZWhhdmlvciB9IGZyb20gJy4uL25vdGVib29rQnJvd3Nlci5qcyc7XG5pbXBvcnQgKiBhcyBpY29ucyBmcm9tICcuLi9ub3RlYm9va0ljb25zLmpzJztcbmltcG9ydCB7IENlbGxLaW5kLCBDZWxsVXJpLCBOb3RlYm9va1NldHRpbmcgfSBmcm9tICcuLi8uLi9jb21tb24vbm90ZWJvb2tDb21tb24uanMnO1xuaW1wb3J0IHsgTk9URUJPT0tfQ0VMTF9FWEVDVVRJTkcsIE5PVEVCT09LX0NFTExfRVhFQ1VUSU9OX1NUQVRFLCBOT1RFQk9PS19DRUxMX0xJU1RfRk9DVVNFRCwgTk9URUJPT0tfQ0VMTF9UWVBFLCBOT1RFQk9PS19IQVNfUlVOTklOR19DRUxMLCBOT1RFQk9PS19IQVNfU09NRVRISU5HX1JVTk5JTkcsIE5PVEVCT09LX0lOVEVSUlVQVElCTEVfS0VSTkVMLCBOT1RFQk9PS19JU19BQ1RJVkVfRURJVE9SLCBOT1RFQk9PS19LRVJORUxfQ09VTlQsIE5PVEVCT09LX0tFUk5FTF9TT1VSQ0VfQ09VTlQsIE5PVEVCT09LX0xBU1RfQ0VMTF9GQUlMRUQsIE5PVEVCT09LX01JU1NJTkdfS0VSTkVMX0VYVEVOU0lPTiB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va0NvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IE5vdGVib29rRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi9jb21tb24vbm90ZWJvb2tFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vbm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvckdyb3Vwc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvckdyb3Vwc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuXG5jb25zdCBFWEVDVVRFX05PVEVCT09LX0NPTU1BTkRfSUQgPSAnbm90ZWJvb2suZXhlY3V0ZSc7XG5jb25zdCBDQU5DRUxfTk9URUJPT0tfQ09NTUFORF9JRCA9ICdub3RlYm9vay5jYW5jZWxFeGVjdXRpb24nO1xuY29uc3QgSU5URVJSVVBUX05PVEVCT09LX0NPTU1BTkRfSUQgPSAnbm90ZWJvb2suaW50ZXJydXB0RXhlY3V0aW9uJztcbmNvbnN0IENBTkNFTF9DRUxMX0NPTU1BTkRfSUQgPSAnbm90ZWJvb2suY2VsbC5jYW5jZWxFeGVjdXRpb24nO1xuY29uc3QgRVhFQ1VURV9DRUxMX0ZPQ1VTX0NPTlRBSU5FUl9DT01NQU5EX0lEID0gJ25vdGVib29rLmNlbGwuZXhlY3V0ZUFuZEZvY3VzQ29udGFpbmVyJztcbmNvbnN0IEVYRUNVVEVfQ0VMTF9TRUxFQ1RfQkVMT1cgPSAnbm90ZWJvb2suY2VsbC5leGVjdXRlQW5kU2VsZWN0QmVsb3cnO1xuY29uc3QgRVhFQ1VURV9DRUxMX0lOU0VSVF9CRUxPVyA9ICdub3RlYm9vay5jZWxsLmV4ZWN1dGVBbmRJbnNlcnRCZWxvdyc7XG5jb25zdCBFWEVDVVRFX0NFTExfQU5EX0JFTE9XID0gJ25vdGVib29rLmNlbGwuZXhlY3V0ZUNlbGxBbmRCZWxvdyc7XG5jb25zdCBFWEVDVVRFX0NFTExTX0FCT1ZFID0gJ25vdGVib29rLmNlbGwuZXhlY3V0ZUNlbGxzQWJvdmUnO1xuY29uc3QgUkVOREVSX0FMTF9NQVJLRE9XTl9DRUxMUyA9ICdub3RlYm9vay5yZW5kZXJBbGxNYXJrZG93bkNlbGxzJztcbmNvbnN0IFJFVkVBTF9SVU5OSU5HX0NFTEwgPSAnbm90ZWJvb2sucmV2ZWFsUnVubmluZ0NlbGwnO1xuY29uc3QgUkVWRUFMX0xBU1RfRkFJTEVEX0NFTEwgPSAnbm90ZWJvb2sucmV2ZWFsTGFzdEZhaWxlZENlbGwnO1xuXG4vLyBJZiB0aGlzIGNoYW5nZXMsIHVwZGF0ZSBnZXRDb2RlQ2VsbEV4ZWN1dGlvbkNvbnRleHRLZXlTZXJ2aWNlIHRvIG1hdGNoXG5leHBvcnQgY29uc3QgZXhlY3V0ZUNvbmRpdGlvbiA9IENvbnRleHRLZXlFeHByLmFuZChcblx0Tk9URUJPT0tfQ0VMTF9UWVBFLmlzRXF1YWxUbygnY29kZScpLFxuXHRDb250ZXh0S2V5RXhwci5vcihcblx0XHRDb250ZXh0S2V5RXhwci5ncmVhdGVyKE5PVEVCT09LX0tFUk5FTF9DT1VOVC5rZXksIDApLFxuXHRcdENvbnRleHRLZXlFeHByLmdyZWF0ZXIoTk9URUJPT0tfS0VSTkVMX1NPVVJDRV9DT1VOVC5rZXksIDApLFxuXHRcdE5PVEVCT09LX01JU1NJTkdfS0VSTkVMX0VYVEVOU0lPTlxuXHQpKTtcblxuZXhwb3J0IGNvbnN0IGV4ZWN1dGVUaGlzQ2VsbENvbmRpdGlvbiA9IENvbnRleHRLZXlFeHByLmFuZChcblx0ZXhlY3V0ZUNvbmRpdGlvbixcblx0Tk9URUJPT0tfQ0VMTF9FWEVDVVRJTkcudG9OZWdhdGVkKCkpO1xuXG5leHBvcnQgY29uc3QgZXhlY3V0ZVNlY3Rpb25Db25kaXRpb24gPSBDb250ZXh0S2V5RXhwci5hbmQoXG5cdE5PVEVCT09LX0NFTExfVFlQRS5pc0VxdWFsVG8oJ21hcmt1cCcpLFxuKTtcblxuZnVuY3Rpb24gcmVuZGVyQWxsTWFya2Rvd25DZWxscyhjb250ZXh0OiBJTm90ZWJvb2tBY3Rpb25Db250ZXh0KTogdm9pZCB7XG5cdGZvciAobGV0IGkgPSAwOyBpIDwgY29udGV4dC5ub3RlYm9va0VkaXRvci5nZXRMZW5ndGgoKTsgaSsrKSB7XG5cdFx0Y29uc3QgY2VsbCA9IGNvbnRleHQubm90ZWJvb2tFZGl0b3IuY2VsbEF0KGkpO1xuXG5cdFx0aWYgKGNlbGwuY2VsbEtpbmQgPT09IENlbGxLaW5kLk1hcmt1cCkge1xuXHRcdFx0Y2VsbC51cGRhdGVFZGl0U3RhdGUoQ2VsbEVkaXRTdGF0ZS5QcmV2aWV3LCAncmVuZGVyQWxsTWFya2Rvd25DZWxscycpO1xuXHRcdH1cblx0fVxufVxuXG5hc3luYyBmdW5jdGlvbiBydW5DZWxsKGVkaXRvckdyb3Vwc1NlcnZpY2U6IElFZGl0b3JHcm91cHNTZXJ2aWNlLCBjb250ZXh0OiBJTm90ZWJvb2tBY3Rpb25Db250ZXh0KTogUHJvbWlzZTx2b2lkPiB7XG5cdGNvbnN0IGdyb3VwID0gZWRpdG9yR3JvdXBzU2VydmljZS5hY3RpdmVHcm91cDtcblxuXHRpZiAoZ3JvdXApIHtcblx0XHRpZiAoZ3JvdXAuYWN0aXZlRWRpdG9yKSB7XG5cdFx0XHRncm91cC5waW5FZGl0b3IoZ3JvdXAuYWN0aXZlRWRpdG9yKTtcblx0XHR9XG5cdH1cblxuXHRpZiAoY29udGV4dC51aSAmJiBjb250ZXh0LmNlbGwpIHtcblx0XHRhd2FpdCBjb250ZXh0Lm5vdGVib29rRWRpdG9yLmV4ZWN1dGVOb3RlYm9va0NlbGxzKEl0ZXJhYmxlLnNpbmdsZShjb250ZXh0LmNlbGwpKTtcblx0XHRpZiAoY29udGV4dC5hdXRvUmV2ZWFsKSB7XG5cdFx0XHRjb25zdCBjZWxsSW5kZXggPSBjb250ZXh0Lm5vdGVib29rRWRpdG9yLmdldENlbGxJbmRleChjb250ZXh0LmNlbGwpO1xuXHRcdFx0Y29udGV4dC5ub3RlYm9va0VkaXRvci5yZXZlYWxDZWxsUmFuZ2VJblZpZXcoeyBzdGFydDogY2VsbEluZGV4LCBlbmQ6IGNlbGxJbmRleCArIDEgfSk7XG5cdFx0fVxuXHR9IGVsc2UgaWYgKGNvbnRleHQuc2VsZWN0ZWRDZWxscz8ubGVuZ3RoIHx8IGNvbnRleHQuY2VsbCkge1xuXHRcdGNvbnN0IHNlbGVjdGVkQ2VsbHMgPSBjb250ZXh0LnNlbGVjdGVkQ2VsbHM/Lmxlbmd0aCA/IGNvbnRleHQuc2VsZWN0ZWRDZWxscyA6IFtjb250ZXh0LmNlbGwhXTtcblx0XHRhd2FpdCBjb250ZXh0Lm5vdGVib29rRWRpdG9yLmV4ZWN1dGVOb3RlYm9va0NlbGxzKHNlbGVjdGVkQ2VsbHMpO1xuXHRcdGNvbnN0IGZpcnN0Q2VsbCA9IHNlbGVjdGVkQ2VsbHNbMF07XG5cblx0XHRpZiAoZmlyc3RDZWxsICYmIGNvbnRleHQuYXV0b1JldmVhbCkge1xuXHRcdFx0Y29uc3QgY2VsbEluZGV4ID0gY29udGV4dC5ub3RlYm9va0VkaXRvci5nZXRDZWxsSW5kZXgoZmlyc3RDZWxsKTtcblx0XHRcdGNvbnRleHQubm90ZWJvb2tFZGl0b3IucmV2ZWFsQ2VsbFJhbmdlSW5WaWV3KHsgc3RhcnQ6IGNlbGxJbmRleCwgZW5kOiBjZWxsSW5kZXggKyAxIH0pO1xuXHRcdH1cblx0fVxuXG5cdGxldCBmb3VuZEVkaXRvcjogSUNvZGVFZGl0b3IgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdGZvciAoY29uc3QgWywgY29kZUVkaXRvcl0gb2YgY29udGV4dC5ub3RlYm9va0VkaXRvci5jb2RlRWRpdG9ycykge1xuXHRcdGlmIChpc0VxdWFsKGNvZGVFZGl0b3IuZ2V0TW9kZWwoKT8udXJpLCAoY29udGV4dC5jZWxsID8/IGNvbnRleHQuc2VsZWN0ZWRDZWxscz8uWzBdKT8udXJpKSkge1xuXHRcdFx0Zm91bmRFZGl0b3IgPSBjb2RlRWRpdG9yO1xuXHRcdFx0YnJlYWs7XG5cdFx0fVxuXHR9XG5cblx0aWYgKCFmb3VuZEVkaXRvcikge1xuXHRcdHJldHVybjtcblx0fVxufVxuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgUmVuZGVyQWxsTWFya2Rvd25DZWxsc0FjdGlvbiBleHRlbmRzIE5vdGVib29rQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFJFTkRFUl9BTExfTUFSS0RPV05fQ0VMTFMsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ25vdGVib29rQWN0aW9ucy5yZW5kZXJNYXJrZG93bicsIFwiUmVuZGVyIEFsbCBNYXJrZG93biBDZWxsc1wiKSxcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bldpdGhDb250ZXh0KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0OiBJTm90ZWJvb2tBY3Rpb25Db250ZXh0KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmVuZGVyQWxsTWFya2Rvd25DZWxscyhjb250ZXh0KTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBFeGVjdXRlTm90ZWJvb2tBY3Rpb24gZXh0ZW5kcyBOb3RlYm9va0FjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBFWEVDVVRFX05PVEVCT09LX0NPTU1BTkRfSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ25vdGVib29rQWN0aW9ucy5leGVjdXRlTm90ZWJvb2snLCBcIlJ1biBBbGxcIiksXG5cdFx0XHRpY29uOiBpY29ucy5leGVjdXRlQWxsSWNvbixcblx0XHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnbm90ZWJvb2tBY3Rpb25zLmV4ZWN1dGVOb3RlYm9vaycsIFwiUnVuIEFsbFwiKSxcblx0XHRcdFx0YXJnczogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdG5hbWU6ICd1cmknLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246ICdUaGUgZG9jdW1lbnQgdXJpJ1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XVxuXHRcdFx0fSxcblx0XHRcdG1lbnU6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuRWRpdG9yVGl0bGUsXG5cdFx0XHRcdFx0b3JkZXI6IC0xLFxuXHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdFx0Tk9URUJPT0tfSVNfQUNUSVZFX0VESVRPUixcblx0XHRcdFx0XHRcdENvbnRleHRLZXlFeHByLm9yKE5PVEVCT09LX0lOVEVSUlVQVElCTEVfS0VSTkVMLnRvTmVnYXRlZCgpLCBOT1RFQk9PS19IQVNfU09NRVRISU5HX1JVTk5JTkcudG9OZWdhdGVkKCkpLFxuXHRcdFx0XHRcdFx0Q29udGV4dEtleUV4cHIubm90RXF1YWxzKCdjb25maWcubm90ZWJvb2suZ2xvYmFsVG9vbGJhcicsIHRydWUpXG5cdFx0XHRcdFx0KVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5Ob3RlYm9va1Rvb2xiYXIsXG5cdFx0XHRcdFx0b3JkZXI6IC0xLFxuXHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbi9leGVjdXRlJyxcblx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5vcihcblx0XHRcdFx0XHRcdFx0Tk9URUJPT0tfSU5URVJSVVBUSUJMRV9LRVJORUwudG9OZWdhdGVkKCksXG5cdFx0XHRcdFx0XHRcdE5PVEVCT09LX0hBU19TT01FVEhJTkdfUlVOTklORy50b05lZ2F0ZWQoKSxcblx0XHRcdFx0XHRcdCksXG5cdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5hbmQoTk9URUJPT0tfSEFTX1NPTUVUSElOR19SVU5OSU5HLCBOT1RFQk9PS19JTlRFUlJVUFRJQkxFX0tFUk5FTC50b05lZ2F0ZWQoKSk/Lm5lZ2F0ZSgpLFxuXHRcdFx0XHRcdFx0Q29udGV4dEtleUV4cHIuZXF1YWxzKCdjb25maWcubm90ZWJvb2suZ2xvYmFsVG9vbGJhcicsIHRydWUpXG5cdFx0XHRcdFx0KVxuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBnZXRFZGl0b3JDb250ZXh0RnJvbUFyZ3NPckFjdGl2ZShhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY29udGV4dD86IFVyaUNvbXBvbmVudHMpOiBJTm90ZWJvb2tBY3Rpb25Db250ZXh0IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gZ2V0Q29udGV4dEZyb21VcmkoYWNjZXNzb3IsIGNvbnRleHQpID8/IGdldENvbnRleHRGcm9tQWN0aXZlRWRpdG9yKGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSkpO1xuXHR9XG5cblx0YXN5bmMgcnVuV2l0aENvbnRleHQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGNvbnRleHQ6IElOb3RlYm9va0FjdGlvbkNvbnRleHQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZW5kZXJBbGxNYXJrZG93bkNlbGxzKGNvbnRleHQpO1xuXG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0Y29uc3QgZWRpdG9yID0gZWRpdG9yU2VydmljZS5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSkuZmluZChcblx0XHRcdGVkaXRvciA9PiBlZGl0b3IuZWRpdG9yIGluc3RhbmNlb2YgTm90ZWJvb2tFZGl0b3JJbnB1dCAmJiBlZGl0b3IuZWRpdG9yLnZpZXdUeXBlID09PSBjb250ZXh0Lm5vdGVib29rRWRpdG9yLnRleHRNb2RlbC52aWV3VHlwZSAmJiBlZGl0b3IuZWRpdG9yLnJlc291cmNlLnRvU3RyaW5nKCkgPT09IGNvbnRleHQubm90ZWJvb2tFZGl0b3IudGV4dE1vZGVsLnVyaS50b1N0cmluZygpKTtcblx0XHRjb25zdCBlZGl0b3JHcm91cFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvckdyb3Vwc1NlcnZpY2UpO1xuXG5cdFx0aWYgKGVkaXRvcikge1xuXHRcdFx0Y29uc3QgZ3JvdXAgPSBlZGl0b3JHcm91cFNlcnZpY2UuZ2V0R3JvdXAoZWRpdG9yLmdyb3VwSWQpO1xuXHRcdFx0Z3JvdXA/LnBpbkVkaXRvcihlZGl0b3IuZWRpdG9yKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gY29udGV4dC5ub3RlYm9va0VkaXRvci5leGVjdXRlTm90ZWJvb2tDZWxscygpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIEV4ZWN1dGVDZWxsIGV4dGVuZHMgTm90ZWJvb2tNdWx0aUNlbGxBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogRVhFQ1VURV9DRUxMX0NPTU1BTkRfSUQsXG5cdFx0XHRwcmVjb25kaXRpb246IGV4ZWN1dGVUaGlzQ2VsbENvbmRpdGlvbixcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnbm90ZWJvb2tBY3Rpb25zLmV4ZWN1dGUnLCBcIkV4ZWN1dGUgQ2VsbFwiKSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2hlbjogTk9URUJPT0tfQ0VMTF9MSVNUX0ZPQ1VTRUQsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5XaW5DdHJsIHwgS2V5Q29kZS5FbnRlcixcblx0XHRcdFx0d2luOiB7XG5cdFx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5FbnRlclxuXHRcdFx0XHR9LFxuXHRcdFx0XHR3ZWlnaHQ6IE5PVEVCT09LX0VESVRPUl9XSURHRVRfQUNUSU9OX1dFSUdIVFxuXHRcdFx0fSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5Ob3RlYm9va0NlbGxFeGVjdXRlUHJpbWFyeSxcblx0XHRcdFx0d2hlbjogZXhlY3V0ZVRoaXNDZWxsQ29uZGl0aW9uLFxuXHRcdFx0XHRncm91cDogJ2lubGluZSdcblx0XHRcdH0sXG5cdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ25vdGVib29rQWN0aW9ucy5leGVjdXRlJywgXCJFeGVjdXRlIENlbGxcIiksXG5cdFx0XHRcdGFyZ3M6IGNlbGxFeGVjdXRpb25BcmdzXG5cdFx0XHR9LFxuXHRcdFx0aWNvbjogaWNvbnMuZXhlY3V0ZUljb25cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIHBhcnNlQXJncyhhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pOiBJTm90ZWJvb2tDb21tYW5kQ29udGV4dCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHBhcnNlTXVsdGlDZWxsRXhlY3V0aW9uQXJncyhhY2Nlc3NvciwgLi4uYXJncyk7XG5cdH1cblxuXHRhc3luYyBydW5XaXRoQ29udGV4dChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY29udGV4dDogSU5vdGVib29rQ29tbWFuZENvbnRleHQgfCBJTm90ZWJvb2tDZWxsVG9vbGJhckFjdGlvbkNvbnRleHQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBlZGl0b3JHcm91cHNTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JHcm91cHNTZXJ2aWNlKTtcblxuXHRcdGlmIChjb250ZXh0LnVpKSB7XG5cdFx0XHRhd2FpdCBjb250ZXh0Lm5vdGVib29rRWRpdG9yLmZvY3VzTm90ZWJvb2tDZWxsKGNvbnRleHQuY2VsbCwgJ2NvbnRhaW5lcicsIHsgc2tpcFJldmVhbDogdHJ1ZSB9KTtcblx0XHR9XG5cblx0XHRjb25zdCBjaGF0Q29udHJvbGxlciA9IE5vdGVib29rQ2hhdENvbnRyb2xsZXIuZ2V0KGNvbnRleHQubm90ZWJvb2tFZGl0b3IpO1xuXHRcdGNvbnN0IGVkaXRpbmdDZWxsID0gY2hhdENvbnRyb2xsZXI/LmdldEVkaXRpbmdDZWxsKCk7XG5cdFx0aWYgKGNoYXRDb250cm9sbGVyPy5oYXNGb2N1cygpICYmIGVkaXRpbmdDZWxsKSB7XG5cdFx0XHRjb25zdCBncm91cCA9IGVkaXRvckdyb3Vwc1NlcnZpY2UuYWN0aXZlR3JvdXA7XG5cblx0XHRcdGlmIChncm91cCkge1xuXHRcdFx0XHRpZiAoZ3JvdXAuYWN0aXZlRWRpdG9yKSB7XG5cdFx0XHRcdFx0Z3JvdXAucGluRWRpdG9yKGdyb3VwLmFjdGl2ZUVkaXRvcik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0YXdhaXQgY29udGV4dC5ub3RlYm9va0VkaXRvci5leGVjdXRlTm90ZWJvb2tDZWxscyhbZWRpdGluZ0NlbGxdKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRhd2FpdCBydW5DZWxsKGVkaXRvckdyb3Vwc1NlcnZpY2UsIGNvbnRleHQpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIEV4ZWN1dGVBYm92ZUNlbGxzIGV4dGVuZHMgTm90ZWJvb2tNdWx0aUNlbGxBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogRVhFQ1VURV9DRUxMU19BQk9WRSxcblx0XHRcdHByZWNvbmRpdGlvbjogZXhlY3V0ZUNvbmRpdGlvbixcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnbm90ZWJvb2tBY3Rpb25zLmV4ZWN1dGVBYm92ZScsIFwiRXhlY3V0ZSBBYm92ZSBDZWxsc1wiKSxcblx0XHRcdG1lbnU6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuTm90ZWJvb2tDZWxsRXhlY3V0ZSxcblx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0XHRleGVjdXRlQ29uZGl0aW9uLFxuXHRcdFx0XHRcdFx0Q29udGV4dEtleUV4cHIuZXF1YWxzKGBjb25maWcuJHtOb3RlYm9va1NldHRpbmcuY29uc29saWRhdGVkUnVuQnV0dG9ufWAsIHRydWUpKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5Ob3RlYm9va0NlbGxUaXRsZSxcblx0XHRcdFx0XHRvcmRlcjogQ2VsbFRvb2xiYXJPcmRlci5FeGVjdXRlQWJvdmVDZWxscyxcblx0XHRcdFx0XHRncm91cDogQ0VMTF9USVRMRV9DRUxMX0dST1VQX0lELFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRcdGV4ZWN1dGVDb25kaXRpb24sXG5cdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5lcXVhbHMoYGNvbmZpZy4ke05vdGVib29rU2V0dGluZy5jb25zb2xpZGF0ZWRSdW5CdXR0b259YCwgZmFsc2UpKVxuXHRcdFx0XHR9XG5cdFx0XHRdLFxuXHRcdFx0aWNvbjogaWNvbnMuZXhlY3V0ZUFib3ZlSWNvblxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgcGFyc2VBcmdzKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSk6IElOb3RlYm9va0NvbW1hbmRDb250ZXh0IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gcGFyc2VNdWx0aUNlbGxFeGVjdXRpb25BcmdzKGFjY2Vzc29yLCAuLi5hcmdzKTtcblx0fVxuXG5cdGFzeW5jIHJ1bldpdGhDb250ZXh0KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0OiBJTm90ZWJvb2tDb21tYW5kQ29udGV4dCB8IElOb3RlYm9va0NlbGxUb29sYmFyQWN0aW9uQ29udGV4dCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGxldCBlbmRDZWxsSWR4OiBudW1iZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKGNvbnRleHQudWkpIHtcblx0XHRcdGVuZENlbGxJZHggPSBjb250ZXh0Lm5vdGVib29rRWRpdG9yLmdldENlbGxJbmRleChjb250ZXh0LmNlbGwpO1xuXHRcdFx0YXdhaXQgY29udGV4dC5ub3RlYm9va0VkaXRvci5mb2N1c05vdGVib29rQ2VsbChjb250ZXh0LmNlbGwsICdjb250YWluZXInLCB7IHNraXBSZXZlYWw6IHRydWUgfSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGVuZENlbGxJZHggPSBNYXRoLm1pbiguLi5jb250ZXh0LnNlbGVjdGVkQ2VsbHMubWFwKGNlbGwgPT4gY29udGV4dC5ub3RlYm9va0VkaXRvci5nZXRDZWxsSW5kZXgoY2VsbCkpKTtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIGVuZENlbGxJZHggPT09ICdudW1iZXInKSB7XG5cdFx0XHRjb25zdCByYW5nZSA9IHsgc3RhcnQ6IDAsIGVuZDogZW5kQ2VsbElkeCB9O1xuXHRcdFx0Y29uc3QgY2VsbHMgPSBjb250ZXh0Lm5vdGVib29rRWRpdG9yLmdldENlbGxzSW5SYW5nZShyYW5nZSk7XG5cdFx0XHRjb250ZXh0Lm5vdGVib29rRWRpdG9yLmV4ZWN1dGVOb3RlYm9va0NlbGxzKGNlbGxzKTtcblx0XHR9XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgRXhlY3V0ZUNlbGxBbmRCZWxvdyBleHRlbmRzIE5vdGVib29rTXVsdGlDZWxsQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IEVYRUNVVEVfQ0VMTF9BTkRfQkVMT1csXG5cdFx0XHRwcmVjb25kaXRpb246IGV4ZWN1dGVDb25kaXRpb24sXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ25vdGVib29rQWN0aW9ucy5leGVjdXRlQmVsb3cnLCBcIkV4ZWN1dGUgQ2VsbCBhbmQgQmVsb3dcIiksXG5cdFx0XHRtZW51OiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogTWVudUlkLk5vdGVib29rQ2VsbEV4ZWN1dGUsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdFx0ZXhlY3V0ZUNvbmRpdGlvbixcblx0XHRcdFx0XHRcdENvbnRleHRLZXlFeHByLmVxdWFscyhgY29uZmlnLiR7Tm90ZWJvb2tTZXR0aW5nLmNvbnNvbGlkYXRlZFJ1bkJ1dHRvbn1gLCB0cnVlKSlcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuTm90ZWJvb2tDZWxsVGl0bGUsXG5cdFx0XHRcdFx0b3JkZXI6IENlbGxUb29sYmFyT3JkZXIuRXhlY3V0ZUNlbGxBbmRCZWxvdyxcblx0XHRcdFx0XHRncm91cDogQ0VMTF9USVRMRV9DRUxMX0dST1VQX0lELFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRcdGV4ZWN1dGVDb25kaXRpb24sXG5cdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5lcXVhbHMoYGNvbmZpZy4ke05vdGVib29rU2V0dGluZy5jb25zb2xpZGF0ZWRSdW5CdXR0b259YCwgZmFsc2UpKVxuXHRcdFx0XHR9XG5cdFx0XHRdLFxuXHRcdFx0aWNvbjogaWNvbnMuZXhlY3V0ZUJlbG93SWNvblxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgcGFyc2VBcmdzKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSk6IElOb3RlYm9va0NvbW1hbmRDb250ZXh0IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gcGFyc2VNdWx0aUNlbGxFeGVjdXRpb25BcmdzKGFjY2Vzc29yLCAuLi5hcmdzKTtcblx0fVxuXG5cdGFzeW5jIHJ1bldpdGhDb250ZXh0KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0OiBJTm90ZWJvb2tDb21tYW5kQ29udGV4dCB8IElOb3RlYm9va0NlbGxUb29sYmFyQWN0aW9uQ29udGV4dCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGxldCBzdGFydENlbGxJZHg6IG51bWJlciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRpZiAoY29udGV4dC51aSkge1xuXHRcdFx0c3RhcnRDZWxsSWR4ID0gY29udGV4dC5ub3RlYm9va0VkaXRvci5nZXRDZWxsSW5kZXgoY29udGV4dC5jZWxsKTtcblx0XHRcdGF3YWl0IGNvbnRleHQubm90ZWJvb2tFZGl0b3IuZm9jdXNOb3RlYm9va0NlbGwoY29udGV4dC5jZWxsLCAnY29udGFpbmVyJywgeyBza2lwUmV2ZWFsOiB0cnVlIH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRzdGFydENlbGxJZHggPSBNYXRoLm1pbiguLi5jb250ZXh0LnNlbGVjdGVkQ2VsbHMubWFwKGNlbGwgPT4gY29udGV4dC5ub3RlYm9va0VkaXRvci5nZXRDZWxsSW5kZXgoY2VsbCkpKTtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIHN0YXJ0Q2VsbElkeCA9PT0gJ251bWJlcicpIHtcblx0XHRcdGNvbnN0IHJhbmdlID0geyBzdGFydDogc3RhcnRDZWxsSWR4LCBlbmQ6IGNvbnRleHQubm90ZWJvb2tFZGl0b3IuZ2V0TGVuZ3RoKCkgfTtcblx0XHRcdGNvbnN0IGNlbGxzID0gY29udGV4dC5ub3RlYm9va0VkaXRvci5nZXRDZWxsc0luUmFuZ2UocmFuZ2UpO1xuXHRcdFx0Y29udGV4dC5ub3RlYm9va0VkaXRvci5leGVjdXRlTm90ZWJvb2tDZWxscyhjZWxscyk7XG5cdFx0fVxuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIEV4ZWN1dGVDZWxsRm9jdXNDb250YWluZXIgZXh0ZW5kcyBOb3RlYm9va011bHRpQ2VsbEFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBFWEVDVVRFX0NFTExfRk9DVVNfQ09OVEFJTkVSX0NPTU1BTkRfSUQsXG5cdFx0XHRwcmVjb25kaXRpb246IGV4ZWN1dGVUaGlzQ2VsbENvbmRpdGlvbixcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnbm90ZWJvb2tBY3Rpb25zLmV4ZWN1dGVBbmRGb2N1c0NvbnRhaW5lcicsIFwiRXhlY3V0ZSBDZWxsIGFuZCBGb2N1cyBDb250YWluZXJcIiksXG5cdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ25vdGVib29rQWN0aW9ucy5leGVjdXRlQW5kRm9jdXNDb250YWluZXInLCBcIkV4ZWN1dGUgQ2VsbCBhbmQgRm9jdXMgQ29udGFpbmVyXCIpLFxuXHRcdFx0XHRhcmdzOiBjZWxsRXhlY3V0aW9uQXJnc1xuXHRcdFx0fSxcblx0XHRcdGljb246IGljb25zLmV4ZWN1dGVJY29uXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBwYXJzZUFyZ3MoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IGFueVtdKTogSU5vdGVib29rQ29tbWFuZENvbnRleHQgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiBwYXJzZU11bHRpQ2VsbEV4ZWN1dGlvbkFyZ3MoYWNjZXNzb3IsIC4uLmFyZ3MpO1xuXHR9XG5cblx0YXN5bmMgcnVuV2l0aENvbnRleHQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGNvbnRleHQ6IElOb3RlYm9va0NvbW1hbmRDb250ZXh0IHwgSU5vdGVib29rQ2VsbFRvb2xiYXJBY3Rpb25Db250ZXh0KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZWRpdG9yR3JvdXBzU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSk7XG5cblx0XHRpZiAoY29udGV4dC51aSkge1xuXHRcdFx0YXdhaXQgY29udGV4dC5ub3RlYm9va0VkaXRvci5mb2N1c05vdGVib29rQ2VsbChjb250ZXh0LmNlbGwsICdjb250YWluZXInLCB7IHNraXBSZXZlYWw6IHRydWUgfSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGZpcnN0Q2VsbCA9IGNvbnRleHQuc2VsZWN0ZWRDZWxsc1swXTtcblxuXHRcdFx0aWYgKGZpcnN0Q2VsbCkge1xuXHRcdFx0XHRhd2FpdCBjb250ZXh0Lm5vdGVib29rRWRpdG9yLmZvY3VzTm90ZWJvb2tDZWxsKGZpcnN0Q2VsbCwgJ2NvbnRhaW5lcicsIHsgc2tpcFJldmVhbDogdHJ1ZSB9KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRhd2FpdCBydW5DZWxsKGVkaXRvckdyb3Vwc1NlcnZpY2UsIGNvbnRleHQpO1xuXHR9XG59KTtcblxuY29uc3QgY2VsbENhbmNlbENvbmRpdGlvbiA9IENvbnRleHRLZXlFeHByLm9yKFxuXHRDb250ZXh0S2V5RXhwci5lcXVhbHMoTk9URUJPT0tfQ0VMTF9FWEVDVVRJT05fU1RBVEUua2V5LCAnZXhlY3V0aW5nJyksXG5cdENvbnRleHRLZXlFeHByLmVxdWFscyhOT1RFQk9PS19DRUxMX0VYRUNVVElPTl9TVEFURS5rZXksICdwZW5kaW5nJyksXG4pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgQ2FuY2VsRXhlY3V0ZUNlbGwgZXh0ZW5kcyBOb3RlYm9va011bHRpQ2VsbEFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBDQU5DRUxfQ0VMTF9DT01NQU5EX0lELFxuXHRcdFx0cHJlY29uZGl0aW9uOiBjZWxsQ2FuY2VsQ29uZGl0aW9uLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdub3RlYm9va0FjdGlvbnMuY2FuY2VsJywgXCJTdG9wIENlbGwgRXhlY3V0aW9uXCIpLFxuXHRcdFx0aWNvbjogaWNvbnMuc3RvcEljb24sXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuTm90ZWJvb2tDZWxsRXhlY3V0ZVByaW1hcnksXG5cdFx0XHRcdHdoZW46IGNlbGxDYW5jZWxDb25kaXRpb24sXG5cdFx0XHRcdGdyb3VwOiAnaW5saW5lJ1xuXHRcdFx0fSxcblx0XHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnbm90ZWJvb2tBY3Rpb25zLmNhbmNlbCcsIFwiU3RvcCBDZWxsIEV4ZWN1dGlvblwiKSxcblx0XHRcdFx0YXJnczogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdG5hbWU6ICdvcHRpb25zJyxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiAnVGhlIGNlbGwgcmFuZ2Ugb3B0aW9ucycsXG5cdFx0XHRcdFx0XHRzY2hlbWE6IHtcblx0XHRcdFx0XHRcdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRcdFx0J3JlcXVpcmVkJzogWydyYW5nZXMnXSxcblx0XHRcdFx0XHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdFx0XHRcdFx0J3Jhbmdlcyc6IHtcblx0XHRcdFx0XHRcdFx0XHRcdCd0eXBlJzogJ2FycmF5Jyxcblx0XHRcdFx0XHRcdFx0XHRcdGl0ZW1zOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndHlwZSc6ICdvYmplY3QnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdyZXF1aXJlZCc6IFsnc3RhcnQnLCAnZW5kJ10sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc3RhcnQnOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd0eXBlJzogJ251bWJlcidcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZW5kJzoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndHlwZSc6ICdudW1iZXInXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHQnZG9jdW1lbnQnOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHQndHlwZSc6ICdvYmplY3QnLFxuXHRcdFx0XHRcdFx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogJ1RoZSBkb2N1bWVudCB1cmknLFxuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XVxuXHRcdFx0fSxcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIHBhcnNlQXJncyhhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pOiBJTm90ZWJvb2tDb21tYW5kQ29udGV4dCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHBhcnNlTXVsdGlDZWxsRXhlY3V0aW9uQXJncyhhY2Nlc3NvciwgLi4uYXJncyk7XG5cdH1cblxuXHRhc3luYyBydW5XaXRoQ29udGV4dChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY29udGV4dDogSU5vdGVib29rQ29tbWFuZENvbnRleHQgfCBJTm90ZWJvb2tDZWxsVG9vbGJhckFjdGlvbkNvbnRleHQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoY29udGV4dC51aSkge1xuXHRcdFx0YXdhaXQgY29udGV4dC5ub3RlYm9va0VkaXRvci5mb2N1c05vdGVib29rQ2VsbChjb250ZXh0LmNlbGwsICdjb250YWluZXInLCB7IHNraXBSZXZlYWw6IHRydWUgfSk7XG5cdFx0XHRyZXR1cm4gY29udGV4dC5ub3RlYm9va0VkaXRvci5jYW5jZWxOb3RlYm9va0NlbGxzKEl0ZXJhYmxlLnNpbmdsZShjb250ZXh0LmNlbGwpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIGNvbnRleHQubm90ZWJvb2tFZGl0b3IuY2FuY2VsTm90ZWJvb2tDZWxscyhjb250ZXh0LnNlbGVjdGVkQ2VsbHMpO1xuXHRcdH1cblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBFeGVjdXRlQ2VsbFNlbGVjdEJlbG93IGV4dGVuZHMgTm90ZWJvb2tDZWxsQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IEVYRUNVVEVfQ0VMTF9TRUxFQ1RfQkVMT1csXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLm9yKGV4ZWN1dGVUaGlzQ2VsbENvbmRpdGlvbiwgTk9URUJPT0tfQ0VMTF9UWVBFLmlzRXF1YWxUbygnbWFya3VwJykpLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdub3RlYm9va0FjdGlvbnMuZXhlY3V0ZUFuZFNlbGVjdEJlbG93JywgXCJFeGVjdXRlIE5vdGVib29rIENlbGwgYW5kIFNlbGVjdCBCZWxvd1wiKSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdE5PVEVCT09LX0NFTExfTElTVF9GT0NVU0VELFxuXHRcdFx0XHRcdENUWF9JTkxJTkVfQ0hBVF9GT0NVU0VELm5lZ2F0ZSgpXG5cdFx0XHRcdCksXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuRW50ZXIsXG5cdFx0XHRcdHdlaWdodDogTk9URUJPT0tfRURJVE9SX1dJREdFVF9BQ1RJT05fV0VJR0hUXG5cdFx0XHR9LFxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuV2l0aENvbnRleHQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGNvbnRleHQ6IElOb3RlYm9va0NlbGxBY3Rpb25Db250ZXh0KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZWRpdG9yR3JvdXBzU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSk7XG5cdFx0Y29uc3QgaWR4ID0gY29udGV4dC5ub3RlYm9va0VkaXRvci5nZXRDZWxsSW5kZXgoY29udGV4dC5jZWxsKTtcblx0XHRpZiAodHlwZW9mIGlkeCAhPT0gJ251bWJlcicpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgbGFuZ3VhZ2VTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMYW5ndWFnZVNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgY29uZmlnID0gYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0Y29uc3Qgc2Nyb2xsQmVoYXZpb3IgPSBjb25maWcuZ2V0VmFsdWUoTm90ZWJvb2tTZXR0aW5nLnNjcm9sbFRvUmV2ZWFsQ2VsbCk7XG5cdFx0bGV0IGZvY3VzT3B0aW9uczogSUZvY3VzTm90ZWJvb2tDZWxsT3B0aW9ucztcblx0XHRpZiAoc2Nyb2xsQmVoYXZpb3IgPT09ICdub25lJykge1xuXHRcdFx0Zm9jdXNPcHRpb25zID0geyBza2lwUmV2ZWFsOiB0cnVlIH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdGZvY3VzT3B0aW9ucyA9IHtcblx0XHRcdFx0cmV2ZWFsQmVoYXZpb3I6IHNjcm9sbEJlaGF2aW9yID09PSAnZnVsbENlbGwnID8gU2Nyb2xsVG9SZXZlYWxCZWhhdmlvci5mdWxsQ2VsbCA6IFNjcm9sbFRvUmV2ZWFsQmVoYXZpb3IuZmlyc3RMaW5lXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmIChjb250ZXh0LmNlbGwuY2VsbEtpbmQgPT09IENlbGxLaW5kLk1hcmt1cCkge1xuXHRcdFx0Y29uc3QgbmV4dENlbGwgPSBjb250ZXh0Lm5vdGVib29rRWRpdG9yLmNlbGxBdChpZHggKyAxKTtcblx0XHRcdGNvbnRleHQuY2VsbC51cGRhdGVFZGl0U3RhdGUoQ2VsbEVkaXRTdGF0ZS5QcmV2aWV3LCBFWEVDVVRFX0NFTExfU0VMRUNUX0JFTE9XKTtcblx0XHRcdGlmIChuZXh0Q2VsbCkge1xuXHRcdFx0XHRhd2FpdCBjb250ZXh0Lm5vdGVib29rRWRpdG9yLmZvY3VzTm90ZWJvb2tDZWxsKG5leHRDZWxsLCAnY29udGFpbmVyJywgZm9jdXNPcHRpb25zKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IG5ld0NlbGwgPSBpbnNlcnRDZWxsKGxhbmd1YWdlU2VydmljZSwgY29udGV4dC5ub3RlYm9va0VkaXRvciwgaWR4LCBDZWxsS2luZC5NYXJrdXAsICdiZWxvdycpO1xuXG5cdFx0XHRcdGlmIChuZXdDZWxsKSB7XG5cdFx0XHRcdFx0YXdhaXQgY29udGV4dC5ub3RlYm9va0VkaXRvci5mb2N1c05vdGVib29rQ2VsbChuZXdDZWxsLCAnZWRpdG9yJywgZm9jdXNPcHRpb25zKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBuZXh0Q2VsbCA9IGNvbnRleHQubm90ZWJvb2tFZGl0b3IuY2VsbEF0KGlkeCArIDEpO1xuXHRcdFx0aWYgKG5leHRDZWxsKSB7XG5cdFx0XHRcdGF3YWl0IGNvbnRleHQubm90ZWJvb2tFZGl0b3IuZm9jdXNOb3RlYm9va0NlbGwobmV4dENlbGwsICdjb250YWluZXInLCBmb2N1c09wdGlvbnMpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgbmV3Q2VsbCA9IGluc2VydENlbGwobGFuZ3VhZ2VTZXJ2aWNlLCBjb250ZXh0Lm5vdGVib29rRWRpdG9yLCBpZHgsIENlbGxLaW5kLkNvZGUsICdiZWxvdycpO1xuXG5cdFx0XHRcdGlmIChuZXdDZWxsKSB7XG5cdFx0XHRcdFx0YXdhaXQgY29udGV4dC5ub3RlYm9va0VkaXRvci5mb2N1c05vdGVib29rQ2VsbChuZXdDZWxsLCAnZWRpdG9yJywgZm9jdXNPcHRpb25zKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gcnVuQ2VsbChlZGl0b3JHcm91cHNTZXJ2aWNlLCBjb250ZXh0KTtcblx0XHR9XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgRXhlY3V0ZUNlbGxJbnNlcnRCZWxvdyBleHRlbmRzIE5vdGVib29rQ2VsbEFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBFWEVDVVRFX0NFTExfSU5TRVJUX0JFTE9XLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5vcihleGVjdXRlVGhpc0NlbGxDb25kaXRpb24sIE5PVEVCT09LX0NFTExfVFlQRS5pc0VxdWFsVG8oJ21hcmt1cCcpKSxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnbm90ZWJvb2tBY3Rpb25zLmV4ZWN1dGVBbmRJbnNlcnRCZWxvdycsIFwiRXhlY3V0ZSBOb3RlYm9vayBDZWxsIGFuZCBJbnNlcnQgQmVsb3dcIiksXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdoZW46IE5PVEVCT09LX0NFTExfTElTVF9GT0NVU0VELFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQWx0IHwgS2V5Q29kZS5FbnRlcixcblx0XHRcdFx0d2VpZ2h0OiBOT1RFQk9PS19FRElUT1JfV0lER0VUX0FDVElPTl9XRUlHSFRcblx0XHRcdH0sXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW5XaXRoQ29udGV4dChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY29udGV4dDogSU5vdGVib29rQ2VsbEFjdGlvbkNvbnRleHQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBlZGl0b3JHcm91cHNTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JHcm91cHNTZXJ2aWNlKTtcblx0XHRjb25zdCBpZHggPSBjb250ZXh0Lm5vdGVib29rRWRpdG9yLmdldENlbGxJbmRleChjb250ZXh0LmNlbGwpO1xuXHRcdGNvbnN0IGxhbmd1YWdlU2VydmljZSA9IGFjY2Vzc29yLmdldChJTGFuZ3VhZ2VTZXJ2aWNlKTtcblx0XHRjb25zdCBuZXdGb2N1c01vZGUgPSBjb250ZXh0LmNlbGwuZm9jdXNNb2RlID09PSBDZWxsRm9jdXNNb2RlLkVkaXRvciA/ICdlZGl0b3InIDogJ2NvbnRhaW5lcic7XG5cblx0XHRjb25zdCBuZXdDZWxsID0gaW5zZXJ0Q2VsbChsYW5ndWFnZVNlcnZpY2UsIGNvbnRleHQubm90ZWJvb2tFZGl0b3IsIGlkeCwgY29udGV4dC5jZWxsLmNlbGxLaW5kLCAnYmVsb3cnKTtcblx0XHRpZiAobmV3Q2VsbCkge1xuXHRcdFx0YXdhaXQgY29udGV4dC5ub3RlYm9va0VkaXRvci5mb2N1c05vdGVib29rQ2VsbChuZXdDZWxsLCBuZXdGb2N1c01vZGUpO1xuXHRcdH1cblxuXHRcdGlmIChjb250ZXh0LmNlbGwuY2VsbEtpbmQgPT09IENlbGxLaW5kLk1hcmt1cCkge1xuXHRcdFx0Y29udGV4dC5jZWxsLnVwZGF0ZUVkaXRTdGF0ZShDZWxsRWRpdFN0YXRlLlByZXZpZXcsIEVYRUNVVEVfQ0VMTF9JTlNFUlRfQkVMT1cpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRydW5DZWxsKGVkaXRvckdyb3Vwc1NlcnZpY2UsIGNvbnRleHQpO1xuXHRcdH1cblx0fVxufSk7XG5cbmNsYXNzIENhbmNlbE5vdGVib29rIGV4dGVuZHMgTm90ZWJvb2tBY3Rpb24ge1xuXHRvdmVycmlkZSBnZXRFZGl0b3JDb250ZXh0RnJvbUFyZ3NPckFjdGl2ZShhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY29udGV4dD86IFVyaUNvbXBvbmVudHMpOiBJTm90ZWJvb2tBY3Rpb25Db250ZXh0IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gZ2V0Q29udGV4dEZyb21VcmkoYWNjZXNzb3IsIGNvbnRleHQpID8/IGdldENvbnRleHRGcm9tQWN0aXZlRWRpdG9yKGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSkpO1xuXHR9XG5cblx0YXN5bmMgcnVuV2l0aENvbnRleHQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGNvbnRleHQ6IElOb3RlYm9va0FjdGlvbkNvbnRleHQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gY29udGV4dC5ub3RlYm9va0VkaXRvci5jYW5jZWxOb3RlYm9va0NlbGxzKCk7XG5cdH1cbn1cblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIENhbmNlbEFsbE5vdGVib29rIGV4dGVuZHMgQ2FuY2VsTm90ZWJvb2sge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogQ0FOQ0VMX05PVEVCT09LX0NPTU1BTkRfSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdub3RlYm9va0FjdGlvbnMuY2FuY2VsTm90ZWJvb2snLCBcIlN0b3AgRXhlY3V0aW9uXCIpLFxuXHRcdFx0aWNvbjogaWNvbnMuc3RvcEljb24sXG5cdFx0XHRtZW51OiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogTWVudUlkLkVkaXRvclRpdGxlLFxuXHRcdFx0XHRcdG9yZGVyOiAtMSxcblx0XHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRcdE5PVEVCT09LX0lTX0FDVElWRV9FRElUT1IsXG5cdFx0XHRcdFx0XHROT1RFQk9PS19IQVNfU09NRVRISU5HX1JVTk5JTkcsXG5cdFx0XHRcdFx0XHROT1RFQk9PS19JTlRFUlJVUFRJQkxFX0tFUk5FTC50b05lZ2F0ZWQoKSxcblx0XHRcdFx0XHRcdENvbnRleHRLZXlFeHByLm5vdEVxdWFscygnY29uZmlnLm5vdGVib29rLmdsb2JhbFRvb2xiYXInLCB0cnVlKVxuXHRcdFx0XHRcdClcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuTm90ZWJvb2tUb29sYmFyLFxuXHRcdFx0XHRcdG9yZGVyOiAtMSxcblx0XHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24vZXhlY3V0ZScsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdFx0Tk9URUJPT0tfSEFTX1NPTUVUSElOR19SVU5OSU5HLFxuXHRcdFx0XHRcdFx0Tk9URUJPT0tfSU5URVJSVVBUSUJMRV9LRVJORUwudG9OZWdhdGVkKCksXG5cdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2NvbmZpZy5ub3RlYm9vay5nbG9iYWxUb29sYmFyJywgdHJ1ZSlcblx0XHRcdFx0XHQpXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9KTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBJbnRlcnJ1cHROb3RlYm9vayBleHRlbmRzIENhbmNlbE5vdGVib29rIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IElOVEVSUlVQVF9OT1RFQk9PS19DT01NQU5EX0lELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignbm90ZWJvb2tBY3Rpb25zLmludGVycnVwdE5vdGVib29rJywgXCJJbnRlcnJ1cHRcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0Tk9URUJPT0tfSEFTX1NPTUVUSElOR19SVU5OSU5HLFxuXHRcdFx0XHROT1RFQk9PS19JTlRFUlJVUFRJQkxFX0tFUk5FTFxuXHRcdFx0KSxcblx0XHRcdGljb246IGljb25zLnN0b3BJY29uLFxuXHRcdFx0bWVudTogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5FZGl0b3JUaXRsZSxcblx0XHRcdFx0XHRvcmRlcjogLTEsXG5cdFx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0XHROT1RFQk9PS19JU19BQ1RJVkVfRURJVE9SLFxuXHRcdFx0XHRcdFx0Tk9URUJPT0tfSEFTX1NPTUVUSElOR19SVU5OSU5HLFxuXHRcdFx0XHRcdFx0Tk9URUJPT0tfSU5URVJSVVBUSUJMRV9LRVJORUwsXG5cdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5ub3RFcXVhbHMoJ2NvbmZpZy5ub3RlYm9vay5nbG9iYWxUb29sYmFyJywgdHJ1ZSlcblx0XHRcdFx0XHQpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogTWVudUlkLk5vdGVib29rVG9vbGJhcixcblx0XHRcdFx0XHRvcmRlcjogLTEsXG5cdFx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uL2V4ZWN1dGUnLFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRcdE5PVEVCT09LX0hBU19TT01FVEhJTkdfUlVOTklORyxcblx0XHRcdFx0XHRcdE5PVEVCT09LX0lOVEVSUlVQVElCTEVfS0VSTkVMLFxuXHRcdFx0XHRcdFx0Q29udGV4dEtleUV4cHIuZXF1YWxzKCdjb25maWcubm90ZWJvb2suZ2xvYmFsVG9vbGJhcicsIHRydWUpXG5cdFx0XHRcdFx0KVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5JbnRlcmFjdGl2ZVRvb2xiYXIsXG5cdFx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uL2V4ZWN1dGUnXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9KTtcblx0fVxufSk7XG5cblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5Ob3RlYm9va1Rvb2xiYXIsIHtcblx0dGl0bGU6IGxvY2FsaXplKCdyZXZlYWxSdW5uaW5nQ2VsbFNob3J0JywgXCJHbyBUb1wiKSxcblx0c3VibWVudTogTWVudUlkLk5vdGVib29rQ2VsbEV4ZWN1dGVHb1RvLFxuXHRncm91cDogJ25hdmlnYXRpb24vZXhlY3V0ZScsXG5cdG9yZGVyOiAyMCxcblx0aWNvbjogVGhlbWVJY29uLm1vZGlmeShpY29ucy5leGVjdXRpbmdTdGF0ZUljb24sICdzcGluJylcbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgUmV2ZWFsUnVubmluZ0NlbGxBY3Rpb24gZXh0ZW5kcyBOb3RlYm9va0FjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBSRVZFQUxfUlVOTklOR19DRUxMLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdyZXZlYWxSdW5uaW5nQ2VsbCcsIFwiR28gdG8gUnVubmluZyBDZWxsXCIpLFxuXHRcdFx0dG9vbHRpcDogbG9jYWxpemUoJ3JldmVhbFJ1bm5pbmdDZWxsJywgXCJHbyB0byBSdW5uaW5nIENlbGxcIiksXG5cdFx0XHRzaG9ydFRpdGxlOiBsb2NhbGl6ZSgncmV2ZWFsUnVubmluZ0NlbGwnLCBcIkdvIHRvIFJ1bm5pbmcgQ2VsbFwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogTk9URUJPT0tfSEFTX1JVTk5JTkdfQ0VMTCxcblx0XHRcdG1lbnU6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuRWRpdG9yVGl0bGUsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdFx0Tk9URUJPT0tfSVNfQUNUSVZFX0VESVRPUixcblx0XHRcdFx0XHRcdE5PVEVCT09LX0hBU19SVU5OSU5HX0NFTEwsXG5cdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5ub3RFcXVhbHMoJ2NvbmZpZy5ub3RlYm9vay5nbG9iYWxUb29sYmFyJywgdHJ1ZSlcblx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0b3JkZXI6IDBcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuTm90ZWJvb2tDZWxsRXhlY3V0ZUdvVG8sXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdFx0Tk9URUJPT0tfSVNfQUNUSVZFX0VESVRPUixcblx0XHRcdFx0XHRcdE5PVEVCT09LX0hBU19SVU5OSU5HX0NFTEwsXG5cdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2NvbmZpZy5ub3RlYm9vay5nbG9iYWxUb29sYmFyJywgdHJ1ZSlcblx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbi9leGVjdXRlJyxcblx0XHRcdFx0XHRvcmRlcjogMjBcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuSW50ZXJhY3RpdmVUb29sYmFyLFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRcdE5PVEVCT09LX0hBU19SVU5OSU5HX0NFTEwsXG5cdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2FjdGl2ZUVkaXRvcicsICd3b3JrYmVuY2guZWRpdG9yLmludGVyYWN0aXZlJylcblx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0b3JkZXI6IDEwXG5cdFx0XHRcdH1cblx0XHRcdF0sXG5cdFx0XHRpY29uOiBUaGVtZUljb24ubW9kaWZ5KGljb25zLmV4ZWN1dGluZ1N0YXRlSWNvbiwgJ3NwaW4nKVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuV2l0aENvbnRleHQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGNvbnRleHQ6IElOb3RlYm9va0FjdGlvbkNvbnRleHQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBub3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZSA9IGFjY2Vzc29yLmdldChJTm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UpO1xuXHRcdGNvbnN0IG5vdGVib29rID0gY29udGV4dC5ub3RlYm9va0VkaXRvci50ZXh0TW9kZWwudXJpO1xuXHRcdGNvbnN0IGV4ZWN1dGluZ0NlbGxzID0gbm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UuZ2V0Q2VsbEV4ZWN1dGlvbnNGb3JOb3RlYm9vayhub3RlYm9vayk7XG5cdFx0aWYgKGV4ZWN1dGluZ0NlbGxzWzBdKSB7XG5cdFx0XHRjb25zdCB0b3BTdGFja0ZyYW1lQ2VsbCA9IHRoaXMuZmluZENlbGxBdFRvcEZyYW1lKGFjY2Vzc29yLCBub3RlYm9vayk7XG5cdFx0XHRjb25zdCBmb2N1c0hhbmRsZSA9IHRvcFN0YWNrRnJhbWVDZWxsID8/IGV4ZWN1dGluZ0NlbGxzWzBdLmNlbGxIYW5kbGU7XG5cdFx0XHRjb25zdCBjZWxsID0gY29udGV4dC5ub3RlYm9va0VkaXRvci5nZXRDZWxsQnlIYW5kbGUoZm9jdXNIYW5kbGUpO1xuXHRcdFx0aWYgKGNlbGwpIHtcblx0XHRcdFx0Y29udGV4dC5ub3RlYm9va0VkaXRvci5mb2N1c05vdGVib29rQ2VsbChjZWxsLCAnY29udGFpbmVyJyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBmaW5kQ2VsbEF0VG9wRnJhbWUoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIG5vdGVib29rOiBVUkkpOiBudW1iZXIgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGRlYnVnU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGVidWdTZXJ2aWNlKTtcblx0XHRmb3IgKGNvbnN0IHNlc3Npb24gb2YgZGVidWdTZXJ2aWNlLmdldE1vZGVsKCkuZ2V0U2Vzc2lvbnMoKSkge1xuXHRcdFx0Zm9yIChjb25zdCB0aHJlYWQgb2Ygc2Vzc2lvbi5nZXRBbGxUaHJlYWRzKCkpIHtcblx0XHRcdFx0Y29uc3Qgc2YgPSB0aHJlYWQuZ2V0VG9wU3RhY2tGcmFtZSgpO1xuXHRcdFx0XHRpZiAoc2YpIHtcblx0XHRcdFx0XHRjb25zdCBwYXJzZWQgPSBDZWxsVXJpLnBhcnNlKHNmLnNvdXJjZS51cmkpO1xuXHRcdFx0XHRcdGlmIChwYXJzZWQgJiYgcGFyc2VkLm5vdGVib29rLnRvU3RyaW5nKCkgPT09IG5vdGVib29rLnRvU3RyaW5nKCkpIHtcblx0XHRcdFx0XHRcdHJldHVybiBwYXJzZWQuaGFuZGxlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgUmV2ZWFsTGFzdEZhaWxlZENlbGxBY3Rpb24gZXh0ZW5kcyBOb3RlYm9va0FjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBSRVZFQUxfTEFTVF9GQUlMRURfQ0VMTCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgncmV2ZWFsTGFzdEZhaWxlZENlbGwnLCBcIkdvIHRvIE1vc3QgUmVjZW50bHkgRmFpbGVkIENlbGxcIiksXG5cdFx0XHR0b29sdGlwOiBsb2NhbGl6ZSgncmV2ZWFsTGFzdEZhaWxlZENlbGwnLCBcIkdvIHRvIE1vc3QgUmVjZW50bHkgRmFpbGVkIENlbGxcIiksXG5cdFx0XHRzaG9ydFRpdGxlOiBsb2NhbGl6ZSgncmV2ZWFsTGFzdEZhaWxlZENlbGxTaG9ydCcsIFwiR28gdG8gTW9zdCBSZWNlbnRseSBGYWlsZWQgQ2VsbFwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogTk9URUJPT0tfTEFTVF9DRUxMX0ZBSUxFRCxcblx0XHRcdG1lbnU6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuRWRpdG9yVGl0bGUsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdFx0Tk9URUJPT0tfSVNfQUNUSVZFX0VESVRPUixcblx0XHRcdFx0XHRcdE5PVEVCT09LX0xBU1RfQ0VMTF9GQUlMRUQsXG5cdFx0XHRcdFx0XHROT1RFQk9PS19IQVNfUlVOTklOR19DRUxMLnRvTmVnYXRlZCgpLFxuXHRcdFx0XHRcdFx0Q29udGV4dEtleUV4cHIubm90RXF1YWxzKCdjb25maWcubm90ZWJvb2suZ2xvYmFsVG9vbGJhcicsIHRydWUpXG5cdFx0XHRcdFx0KSxcblx0XHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRcdG9yZGVyOiAwXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogTWVudUlkLk5vdGVib29rQ2VsbEV4ZWN1dGVHb1RvLFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRcdE5PVEVCT09LX0lTX0FDVElWRV9FRElUT1IsXG5cdFx0XHRcdFx0XHROT1RFQk9PS19MQVNUX0NFTExfRkFJTEVELFxuXHRcdFx0XHRcdFx0Tk9URUJPT0tfSEFTX1JVTk5JTkdfQ0VMTC50b05lZ2F0ZWQoKSxcblx0XHRcdFx0XHRcdENvbnRleHRLZXlFeHByLmVxdWFscygnY29uZmlnLm5vdGVib29rLmdsb2JhbFRvb2xiYXInLCB0cnVlKVxuXHRcdFx0XHRcdCksXG5cdFx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uL2V4ZWN1dGUnLFxuXHRcdFx0XHRcdG9yZGVyOiAyMFxuXHRcdFx0XHR9LFxuXHRcdFx0XSxcblx0XHRcdGljb246IGljb25zLmVycm9yU3RhdGVJY29uLFxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuV2l0aENvbnRleHQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGNvbnRleHQ6IElOb3RlYm9va0FjdGlvbkNvbnRleHQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBub3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZSA9IGFjY2Vzc29yLmdldChJTm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UpO1xuXHRcdGNvbnN0IG5vdGVib29rID0gY29udGV4dC5ub3RlYm9va0VkaXRvci50ZXh0TW9kZWwudXJpO1xuXHRcdGNvbnN0IGxhc3RGYWlsZWRDZWxsSGFuZGxlID0gbm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UuZ2V0TGFzdEZhaWxlZENlbGxGb3JOb3RlYm9vayhub3RlYm9vayk7XG5cdFx0aWYgKGxhc3RGYWlsZWRDZWxsSGFuZGxlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGNvbnN0IGxhc3RGYWlsZWRDZWxsID0gY29udGV4dC5ub3RlYm9va0VkaXRvci5nZXRDZWxsQnlIYW5kbGUobGFzdEZhaWxlZENlbGxIYW5kbGUpO1xuXHRcdFx0aWYgKGxhc3RGYWlsZWRDZWxsKSB7XG5cdFx0XHRcdGNvbnRleHQubm90ZWJvb2tFZGl0b3IuZm9jdXNOb3RlYm9va0NlbGwobGFzdEZhaWxlZENlbGwsICdjb250YWluZXInKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxTQUFTLGNBQWM7QUFDaEMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsaUJBQWlCO0FBRzFCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsVUFBVSxpQkFBaUI7QUFDcEMsU0FBUyxRQUFRLGNBQWMsdUJBQXVCO0FBQ3RELFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsc0JBQXNCO0FBRS9CLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsMEJBQTBC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
