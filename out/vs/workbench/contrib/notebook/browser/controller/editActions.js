import { KeyChord, KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { Mimes } from "../../../../../base/common/mime.js";
import { URI } from "../../../../../base/common/uri.js";
import { Selection } from "../../../../../editor/common/core/selection.js";
import { CommandExecutor } from "../../../../../editor/common/cursor/cursor.js";
import { EditorContextKeys } from "../../../../../editor/common/editorContextKeys.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { ILanguageConfigurationService } from "../../../../../editor/common/languages/languageConfigurationRegistry.js";
import { TrackedRangeStickiness } from "../../../../../editor/common/model.js";
import { getIconClasses } from "../../../../../editor/common/services/getIconClasses.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { LineCommentCommand, Type } from "../../../../../editor/contrib/comment/browser/lineCommentCommand.js";
import { localize, localize2 } from "../../../../../nls.js";
import { MenuId, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { InputFocusedContext, InputFocusedContextKey } from "../../../../../platform/contextkey/common/contextkeys.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { InlineChatController } from "../../../inlineChat/browser/inlineChatController.js";
import { CTX_INLINE_CHAT_FOCUSED } from "../../../inlineChat/common/inlineChat.js";
import { changeCellToKind, runDeleteAction } from "./cellOperations.js";
import { CELL_TITLE_CELL_GROUP_ID, CELL_TITLE_OUTPUT_GROUP_ID, CellToolbarOrder, NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT, NotebookAction, NotebookCellAction, NotebookMultiCellAction, executeNotebookCondition, findTargetCellEditor } from "./coreActions.js";
import { NotebookChangeTabDisplaySize, NotebookIndentUsingSpaces, NotebookIndentUsingTabs, NotebookIndentationToSpacesAction, NotebookIndentationToTabsAction } from "./notebookIndentationActions.js";
import { CHANGE_CELL_LANGUAGE, CellEditState, DETECT_CELL_LANGUAGE, QUIT_EDIT_CELL_COMMAND_ID, getNotebookEditorFromEditorPane } from "../notebookBrowser.js";
import * as icons from "../notebookIcons.js";
import { CellEditType, CellKind, NotebookCellExecutionState, NotebookSetting } from "../../common/notebookCommon.js";
import { NOTEBOOK_CELL_EDITABLE, NOTEBOOK_CELL_HAS_OUTPUTS, NOTEBOOK_CELL_IS_FIRST_OUTPUT, NOTEBOOK_CELL_LIST_FOCUSED, NOTEBOOK_CELL_MARKDOWN_EDIT_MODE, NOTEBOOK_CELL_TYPE, NOTEBOOK_EDITOR_EDITABLE, NOTEBOOK_EDITOR_FOCUSED, NOTEBOOK_HAS_OUTPUTS, NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_OUTPUT_FOCUSED, NOTEBOOK_OUTPUT_INPUT_FOCUSED, NOTEBOOK_USE_CONSOLIDATED_OUTPUT_BUTTON } from "../../common/notebookContextKeys.js";
import { INotebookExecutionStateService } from "../../common/notebookExecutionStateService.js";
import { INotebookKernelService } from "../../common/notebookKernelService.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { ILanguageDetectionService } from "../../../../services/languageDetection/common/languageDetectionWorkerService.js";
import { NotebookInlineVariablesController } from "../contrib/notebookVariables/notebookInlineVariables.js";
const CLEAR_ALL_CELLS_OUTPUTS_COMMAND_ID = "notebook.clearAllCellsOutputs";
const EDIT_CELL_COMMAND_ID = "notebook.cell.edit";
const DELETE_CELL_COMMAND_ID = "notebook.cell.delete";
const CLEAR_CELL_OUTPUTS_COMMAND_ID = "notebook.cell.clearOutputs";
const SELECT_NOTEBOOK_INDENTATION_ID = "notebook.selectIndentation";
const COMMENT_SELECTED_CELLS_ID = "notebook.commentSelectedCells";
registerAction2(class EditCellAction extends NotebookCellAction {
  constructor() {
    super(
      {
        id: EDIT_CELL_COMMAND_ID,
        title: localize("notebookActions.editCell", "Edit Cell"),
        keybinding: {
          when: ContextKeyExpr.and(
            NOTEBOOK_CELL_LIST_FOCUSED,
            ContextKeyExpr.not(InputFocusedContextKey),
            EditorContextKeys.hoverFocused.toNegated(),
            NOTEBOOK_OUTPUT_INPUT_FOCUSED.toNegated()
          ),
          primary: KeyCode.Enter,
          weight: KeybindingWeight.WorkbenchContrib
        },
        menu: {
          id: MenuId.NotebookCellTitle,
          when: ContextKeyExpr.and(
            NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true),
            NOTEBOOK_CELL_TYPE.isEqualTo("markup"),
            NOTEBOOK_CELL_MARKDOWN_EDIT_MODE.toNegated(),
            NOTEBOOK_CELL_EDITABLE
          ),
          order: CellToolbarOrder.EditCell,
          group: CELL_TITLE_CELL_GROUP_ID
        },
        icon: icons.editIcon
      }
    );
  }
  async runWithContext(accessor, context) {
    if (!context.notebookEditor.hasModel()) {
      return;
    }
    await context.notebookEditor.focusNotebookCell(context.cell, "editor");
    const foundEditor = context.cell ? findTargetCellEditor(context, context.cell) : void 0;
    if (foundEditor && foundEditor.hasTextFocus() && InlineChatController.get(foundEditor)?.getWidgetPosition()?.lineNumber === foundEditor.getPosition()?.lineNumber) {
      InlineChatController.get(foundEditor)?.focus();
    }
  }
});
const quitEditCondition = ContextKeyExpr.and(
  NOTEBOOK_EDITOR_FOCUSED,
  InputFocusedContext,
  CTX_INLINE_CHAT_FOCUSED.toNegated()
);
registerAction2(class QuitEditCellAction extends NotebookCellAction {
  constructor() {
    super(
      {
        id: QUIT_EDIT_CELL_COMMAND_ID,
        title: localize("notebookActions.quitEdit", "Stop Editing Cell"),
        menu: {
          id: MenuId.NotebookCellTitle,
          when: ContextKeyExpr.and(
            NOTEBOOK_CELL_TYPE.isEqualTo("markup"),
            NOTEBOOK_CELL_MARKDOWN_EDIT_MODE,
            NOTEBOOK_CELL_EDITABLE
          ),
          order: CellToolbarOrder.SaveCell,
          group: CELL_TITLE_CELL_GROUP_ID
        },
        icon: icons.stopEditIcon,
        keybinding: [
          {
            when: ContextKeyExpr.and(
              quitEditCondition,
              EditorContextKeys.hoverVisible.toNegated(),
              EditorContextKeys.hasNonEmptySelection.toNegated(),
              EditorContextKeys.hasMultipleSelections.toNegated()
            ),
            primary: KeyCode.Escape,
            weight: NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT - 5
          },
          {
            when: ContextKeyExpr.and(
              NOTEBOOK_EDITOR_FOCUSED,
              NOTEBOOK_OUTPUT_FOCUSED
            ),
            primary: KeyCode.Escape,
            weight: KeybindingWeight.WorkbenchContrib + 5
          },
          {
            when: ContextKeyExpr.and(
              quitEditCondition,
              NOTEBOOK_CELL_TYPE.isEqualTo("markup")
            ),
            primary: KeyMod.WinCtrl | KeyCode.Enter,
            win: {
              primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.Enter
            },
            weight: NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT - 5
          }
        ]
      }
    );
  }
  async runWithContext(accessor, context) {
    if (context.cell.cellKind === CellKind.Markup) {
      context.cell.updateEditState(CellEditState.Preview, QUIT_EDIT_CELL_COMMAND_ID);
    }
    await context.notebookEditor.focusNotebookCell(context.cell, "container", { skipReveal: true });
  }
});
registerAction2(class DeleteCellAction extends NotebookCellAction {
  constructor() {
    super(
      {
        id: DELETE_CELL_COMMAND_ID,
        title: localize("notebookActions.deleteCell", "Delete Cell"),
        keybinding: {
          primary: KeyCode.Delete,
          mac: {
            primary: KeyMod.CtrlCmd | KeyCode.Backspace
          },
          when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, ContextKeyExpr.not(InputFocusedContextKey), NOTEBOOK_OUTPUT_INPUT_FOCUSED.toNegated()),
          weight: KeybindingWeight.WorkbenchContrib
        },
        menu: [
          {
            id: MenuId.NotebookCellDelete,
            when: NOTEBOOK_EDITOR_EDITABLE,
            group: CELL_TITLE_CELL_GROUP_ID
          },
          {
            id: MenuId.InteractiveCellDelete,
            group: CELL_TITLE_CELL_GROUP_ID
          }
        ],
        icon: icons.deleteCellIcon
      }
    );
  }
  async runWithContext(accessor, context) {
    if (!context.notebookEditor.hasModel()) {
      return;
    }
    let confirmation;
    const notebookExecutionStateService = accessor.get(INotebookExecutionStateService);
    const runState = notebookExecutionStateService.getCellExecution(context.cell.uri)?.state;
    const configService = accessor.get(IConfigurationService);
    if (runState === NotebookCellExecutionState.Executing && configService.getValue(NotebookSetting.confirmDeleteRunningCell)) {
      const dialogService = accessor.get(IDialogService);
      const primaryButton = localize("confirmDeleteButton", "Delete");
      confirmation = await dialogService.confirm({
        type: "question",
        message: localize("confirmDeleteButtonMessage", "This cell is running, are you sure you want to delete it?"),
        primaryButton,
        checkbox: {
          label: localize("doNotAskAgain", "Do not ask me again")
        }
      });
    } else {
      confirmation = { confirmed: true };
    }
    if (!confirmation.confirmed) {
      return;
    }
    if (confirmation.checkboxChecked === true) {
      await configService.updateValue(NotebookSetting.confirmDeleteRunningCell, false);
    }
    runDeleteAction(context.notebookEditor, context.cell);
  }
});
registerAction2(class ClearCellOutputsAction extends NotebookCellAction {
  constructor() {
    super({
      id: CLEAR_CELL_OUTPUTS_COMMAND_ID,
      title: localize("clearCellOutputs", "Clear Cell Outputs"),
      menu: [
        {
          id: MenuId.NotebookCellTitle,
          when: ContextKeyExpr.and(NOTEBOOK_CELL_TYPE.isEqualTo("code"), executeNotebookCondition, NOTEBOOK_CELL_HAS_OUTPUTS, NOTEBOOK_EDITOR_EDITABLE, NOTEBOOK_CELL_EDITABLE, NOTEBOOK_USE_CONSOLIDATED_OUTPUT_BUTTON.toNegated()),
          order: CellToolbarOrder.ClearCellOutput,
          group: CELL_TITLE_OUTPUT_GROUP_ID
        },
        {
          id: MenuId.NotebookOutputToolbar,
          when: ContextKeyExpr.and(NOTEBOOK_CELL_HAS_OUTPUTS, NOTEBOOK_EDITOR_EDITABLE, NOTEBOOK_CELL_EDITABLE, NOTEBOOK_CELL_IS_FIRST_OUTPUT, NOTEBOOK_USE_CONSOLIDATED_OUTPUT_BUTTON)
        }
      ],
      keybinding: {
        when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, ContextKeyExpr.not(InputFocusedContextKey), NOTEBOOK_CELL_HAS_OUTPUTS, NOTEBOOK_EDITOR_EDITABLE, NOTEBOOK_CELL_EDITABLE),
        primary: KeyMod.Alt | KeyCode.Delete,
        weight: KeybindingWeight.WorkbenchContrib
      },
      icon: icons.clearIcon
    });
  }
  async runWithContext(accessor, context) {
    const notebookExecutionStateService = accessor.get(INotebookExecutionStateService);
    const editor = context.notebookEditor;
    if (!editor.hasModel() || !editor.textModel.length) {
      return;
    }
    const cell = context.cell;
    const index = editor.textModel.cells.indexOf(cell.model);
    if (index < 0) {
      return;
    }
    const computeUndoRedo = !editor.isReadOnly;
    editor.textModel.applyEdits([{ editType: CellEditType.Output, index, outputs: [] }], true, void 0, () => void 0, void 0, computeUndoRedo);
    const runState = notebookExecutionStateService.getCellExecution(context.cell.uri)?.state;
    if (runState !== NotebookCellExecutionState.Executing) {
      context.notebookEditor.textModel.applyEdits([{
        editType: CellEditType.PartialInternalMetadata,
        index,
        internalMetadata: {
          runStartTime: null,
          runStartTimeAdjustment: null,
          runEndTime: null,
          executionOrder: null,
          lastRunSuccess: null
        }
      }], true, void 0, () => void 0, void 0, computeUndoRedo);
    }
  }
});
registerAction2(class ClearAllCellOutputsAction extends NotebookAction {
  constructor() {
    super({
      id: CLEAR_ALL_CELLS_OUTPUTS_COMMAND_ID,
      title: localize("clearAllCellsOutputs", "Clear All Outputs"),
      precondition: NOTEBOOK_HAS_OUTPUTS,
      menu: [
        {
          id: MenuId.EditorTitle,
          when: ContextKeyExpr.and(
            NOTEBOOK_IS_ACTIVE_EDITOR,
            ContextKeyExpr.notEquals("config.notebook.globalToolbar", true)
          ),
          group: "navigation",
          order: 0
        },
        {
          id: MenuId.NotebookToolbar,
          when: ContextKeyExpr.and(
            executeNotebookCondition,
            ContextKeyExpr.equals("config.notebook.globalToolbar", true)
          ),
          group: "navigation/execute",
          order: 10
        }
      ],
      icon: icons.clearIcon
    });
  }
  async runWithContext(accessor, context) {
    const notebookExecutionStateService = accessor.get(INotebookExecutionStateService);
    const editor = context.notebookEditor;
    if (!editor.hasModel() || !editor.textModel.length) {
      return;
    }
    const computeUndoRedo = !editor.isReadOnly;
    editor.textModel.applyEdits(
      editor.textModel.cells.map((cell, index) => ({
        editType: CellEditType.Output,
        index,
        outputs: []
      })),
      true,
      void 0,
      () => void 0,
      void 0,
      computeUndoRedo
    );
    const clearExecutionMetadataEdits = editor.textModel.cells.map((cell, index) => {
      const runState = notebookExecutionStateService.getCellExecution(cell.uri)?.state;
      if (runState !== NotebookCellExecutionState.Executing) {
        return {
          editType: CellEditType.PartialInternalMetadata,
          index,
          internalMetadata: {
            runStartTime: null,
            runStartTimeAdjustment: null,
            runEndTime: null,
            executionOrder: null,
            lastRunSuccess: null
          }
        };
      } else {
        return void 0;
      }
    }).filter((edit) => !!edit);
    if (clearExecutionMetadataEdits.length) {
      context.notebookEditor.textModel.applyEdits(clearExecutionMetadataEdits, true, void 0, () => void 0, void 0, computeUndoRedo);
    }
    const controller = editor.getContribution(NotebookInlineVariablesController.id);
    controller.clearNotebookInlineDecorations();
  }
});
registerAction2(class ChangeCellLanguageAction extends NotebookCellAction {
  constructor() {
    super({
      id: CHANGE_CELL_LANGUAGE,
      title: localize("changeLanguage", "Change Cell Language"),
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.KeyM),
        when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, NOTEBOOK_EDITOR_EDITABLE, NOTEBOOK_CELL_EDITABLE)
      },
      metadata: {
        description: localize("changeLanguage", "Change Cell Language"),
        args: [
          {
            name: "range",
            description: "The cell range",
            schema: {
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
          },
          {
            name: "language",
            description: "The target cell language",
            schema: {
              "type": "string"
            }
          }
        ]
      }
    });
  }
  getCellContextFromArgs(accessor, context, ...additionalArgs) {
    if (!context || typeof context.start !== "number" || typeof context.end !== "number" || context.start >= context.end) {
      return;
    }
    const language = additionalArgs.length && typeof additionalArgs[0] === "string" ? additionalArgs[0] : void 0;
    const activeEditorContext = this.getEditorContextFromArgsOrActive(accessor);
    if (!activeEditorContext || !activeEditorContext.notebookEditor.hasModel() || context.start >= activeEditorContext.notebookEditor.getLength()) {
      return;
    }
    return {
      notebookEditor: activeEditorContext.notebookEditor,
      cell: activeEditorContext.notebookEditor.cellAt(context.start),
      language
    };
  }
  async runWithContext(accessor, context) {
    if (context.language) {
      await this.setLanguage(context, context.language);
    } else {
      await this.showLanguagePicker(accessor, context);
    }
  }
  async showLanguagePicker(accessor, context) {
    const topItems = [];
    const mainItems = [];
    const languageService = accessor.get(ILanguageService);
    const modelService = accessor.get(IModelService);
    const quickInputService = accessor.get(IQuickInputService);
    const languageDetectionService = accessor.get(ILanguageDetectionService);
    const kernelService = accessor.get(INotebookKernelService);
    let languages = context.notebookEditor.activeKernel?.supportedLanguages;
    if (!languages) {
      const matchResult = kernelService.getMatchingKernel(context.notebookEditor.textModel);
      const allSupportedLanguages = matchResult.all.flatMap((kernel) => kernel.supportedLanguages);
      languages = allSupportedLanguages.length > 0 ? allSupportedLanguages : languageService.getRegisteredLanguageIds();
    }
    const providerLanguages = /* @__PURE__ */ new Set([
      ...languages,
      "markdown"
    ]);
    providerLanguages.forEach((languageId2) => {
      let description;
      if (context.cell.cellKind === CellKind.Markup ? languageId2 === "markdown" : languageId2 === context.cell.language) {
        description = localize("languageDescription", "({0}) - Current Language", languageId2);
      } else {
        description = localize("languageDescriptionConfigured", "({0})", languageId2);
      }
      const languageName = languageService.getLanguageName(languageId2);
      if (!languageName) {
        return;
      }
      const item = {
        label: languageName,
        iconClasses: getIconClasses(modelService, languageService, this.getFakeResource(languageName, languageService)),
        description,
        languageId: languageId2
      };
      if (languageId2 === "markdown" || languageId2 === context.cell.language) {
        topItems.push(item);
      } else {
        mainItems.push(item);
      }
    });
    mainItems.sort((a, b) => {
      return a.description.localeCompare(b.description);
    });
    const autoDetectMode = {
      label: localize("autoDetect", "Auto Detect")
    };
    const picks = [
      autoDetectMode,
      { type: "separator", label: localize("languagesPicks", "languages (identifier)") },
      ...topItems,
      { type: "separator" },
      ...mainItems
    ];
    const selection = await quickInputService.pick(picks, { placeHolder: localize("pickLanguageToConfigure", "Select Language Mode") });
    const languageId = selection === autoDetectMode ? await languageDetectionService.detectLanguage(context.cell.uri) : selection?.languageId;
    if (languageId) {
      await this.setLanguage(context, languageId);
    }
  }
  async setLanguage(context, languageId) {
    await setCellToLanguage(languageId, context);
  }
  /**
   * Copied from editorStatus.ts
   */
  getFakeResource(lang, languageService) {
    let fakeResource;
    const languageId = languageService.getLanguageIdByLanguageName(lang);
    if (languageId) {
      const extensions = languageService.getExtensions(languageId);
      if (extensions.length) {
        fakeResource = URI.file(extensions[0]);
      } else {
        const filenames = languageService.getFilenames(languageId);
        if (filenames.length) {
          fakeResource = URI.file(filenames[0]);
        }
      }
    }
    return fakeResource;
  }
});
registerAction2(class DetectCellLanguageAction extends NotebookCellAction {
  constructor() {
    super({
      id: DETECT_CELL_LANGUAGE,
      title: localize2("detectLanguage", "Accept Detected Language for Cell"),
      f1: true,
      precondition: ContextKeyExpr.and(NOTEBOOK_EDITOR_EDITABLE, NOTEBOOK_CELL_EDITABLE),
      keybinding: { primary: KeyCode.KeyD | KeyMod.Alt | KeyMod.Shift, weight: KeybindingWeight.WorkbenchContrib }
    });
  }
  async runWithContext(accessor, context) {
    const languageDetectionService = accessor.get(ILanguageDetectionService);
    const notificationService = accessor.get(INotificationService);
    const kernelService = accessor.get(INotebookKernelService);
    const kernel = kernelService.getSelectedOrSuggestedKernel(context.notebookEditor.textModel);
    const providerLanguages = [...kernel?.supportedLanguages ?? []];
    providerLanguages.push("markdown");
    const detection = await languageDetectionService.detectLanguage(context.cell.uri, providerLanguages);
    if (detection) {
      setCellToLanguage(detection, context);
    } else {
      notificationService.warn(localize("noDetection", "Unable to detect cell language"));
    }
  }
});
async function setCellToLanguage(languageId, context) {
  if (languageId === "markdown" && context.cell?.language !== "markdown") {
    const idx = context.notebookEditor.getCellIndex(context.cell);
    await changeCellToKind(CellKind.Markup, { cell: context.cell, notebookEditor: context.notebookEditor, ui: true }, "markdown", Mimes.markdown);
    const newCell = context.notebookEditor.cellAt(idx);
    if (newCell) {
      await context.notebookEditor.focusNotebookCell(newCell, "editor");
    }
  } else if (languageId !== "markdown" && context.cell?.cellKind === CellKind.Markup) {
    await changeCellToKind(CellKind.Code, { cell: context.cell, notebookEditor: context.notebookEditor, ui: true }, languageId);
  } else {
    const index = context.notebookEditor.textModel.cells.indexOf(context.cell.model);
    context.notebookEditor.textModel.applyEdits(
      [{ editType: CellEditType.CellLanguage, index, language: languageId }],
      true,
      void 0,
      () => void 0,
      void 0,
      !context.notebookEditor.isReadOnly
    );
  }
}
registerAction2(class SelectNotebookIndentation extends NotebookAction {
  constructor() {
    super({
      id: SELECT_NOTEBOOK_INDENTATION_ID,
      title: localize2("selectNotebookIndentation", "Select Indentation"),
      f1: true,
      precondition: ContextKeyExpr.and(NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_EDITOR_EDITABLE, NOTEBOOK_CELL_EDITABLE)
    });
  }
  async runWithContext(accessor, context) {
    await this.showNotebookIndentationPicker(accessor, context);
  }
  async showNotebookIndentationPicker(accessor, context) {
    const quickInputService = accessor.get(IQuickInputService);
    const editorService = accessor.get(IEditorService);
    const instantiationService = accessor.get(IInstantiationService);
    const activeNotebook = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
    if (!activeNotebook || activeNotebook.isDisposed) {
      return quickInputService.pick([{ label: localize("noNotebookEditor", "No notebook editor active at this time") }]);
    }
    if (activeNotebook.isReadOnly) {
      return quickInputService.pick([{ label: localize("noWritableCodeEditor", "The active notebook editor is read-only.") }]);
    }
    const picks = [
      new NotebookIndentUsingTabs(),
      // indent using tabs
      new NotebookIndentUsingSpaces(),
      // indent using spaces
      new NotebookChangeTabDisplaySize(),
      // change tab size
      new NotebookIndentationToTabsAction(),
      // convert indentation to tabs
      new NotebookIndentationToSpacesAction()
      // convert indentation to spaces
    ].map((item) => {
      return {
        id: item.desc.id,
        label: item.desc.title.toString(),
        run: () => {
          instantiationService.invokeFunction(item.run);
        }
      };
    });
    picks.splice(3, 0, { type: "separator", label: localize("indentConvert", "convert file") });
    picks.unshift({ type: "separator", label: localize("indentView", "change view") });
    const action = await quickInputService.pick(picks, { placeHolder: localize("pickAction", "Select Action"), matchOnDetail: true });
    if (!action) {
      return;
    }
    action.run();
    context.notebookEditor.focus();
    return;
  }
});
registerAction2(class CommentSelectedCellsAction extends NotebookMultiCellAction {
  constructor() {
    super({
      id: COMMENT_SELECTED_CELLS_ID,
      title: localize("commentSelectedCells", "Comment Selected Cells"),
      keybinding: {
        when: ContextKeyExpr.and(
          NOTEBOOK_EDITOR_FOCUSED,
          NOTEBOOK_EDITOR_EDITABLE,
          ContextKeyExpr.not(InputFocusedContextKey)
        ),
        primary: KeyMod.CtrlCmd | KeyCode.Slash,
        weight: KeybindingWeight.WorkbenchContrib
      }
    });
  }
  async runWithContext(accessor, context) {
    const languageConfigurationService = accessor.get(ILanguageConfigurationService);
    context.selectedCells.forEach(async (cellViewModel) => {
      const textModel = await cellViewModel.resolveTextModel();
      const commentsOptions = cellViewModel.commentOptions;
      const cellCommentCommand = new LineCommentCommand(
        languageConfigurationService,
        new Selection(1, 1, textModel.getLineCount(), textModel.getLineMaxColumn(textModel.getLineCount())),
        // comment the entire cell
        textModel.getOptions().tabSize,
        Type.Toggle,
        commentsOptions.insertSpace ?? true,
        commentsOptions.ignoreEmptyLines ?? true,
        false
      );
      const cellEditorSelections = cellViewModel.getSelections();
      const initialTrackedRangesIDs = cellEditorSelections.map((selection) => {
        return textModel._setTrackedRange(null, selection, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges);
      });
      CommandExecutor.executeCommands(textModel, cellEditorSelections, [cellCommentCommand]);
      const newTrackedSelections = initialTrackedRangesIDs.map((i) => {
        return textModel._getTrackedRange(i);
      }).filter((r) => !!r).map((range) => {
        return new Selection(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn);
      });
      cellViewModel.setSelections(newTrackedSelections ?? []);
    });
  }
});
export {
  CLEAR_CELL_OUTPUTS_COMMAND_ID,
  COMMENT_SELECTED_CELLS_ID,
  SELECT_NOTEBOOK_INDENTATION_ID
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL2NvbnRyb2xsZXIvZWRpdEFjdGlvbnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBLZXlDaG9yZCwgS2V5Q29kZSwgS2V5TW9kIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgTWltZXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9taW1lLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBDb21tYW5kRXhlY3V0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2N1cnNvci9jdXJzb3IuanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29udGV4dEtleXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlQ29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFRyYWNrZWRSYW5nZVN0aWNraW5lc3MgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IGdldEljb25DbGFzc2VzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9nZXRJY29uQ2xhc3Nlcy5qcyc7XG5pbXBvcnQgeyBJTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9tb2RlbC5qcyc7XG5pbXBvcnQgeyBMaW5lQ29tbWVudENvbW1hbmQsIFR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9jb21tZW50L2Jyb3dzZXIvbGluZUNvbW1lbnRDb21tYW5kLmpzJztcbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgTWVudUlkLCByZWdpc3RlckFjdGlvbjIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElucHV0Rm9jdXNlZENvbnRleHQsIElucHV0Rm9jdXNlZENvbnRleHRLZXkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5cy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlybWF0aW9uUmVzdWx0LCBJRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBLZXliaW5kaW5nV2VpZ2h0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZ3NSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IElRdWlja0lucHV0U2VydmljZSwgSVF1aWNrUGlja0l0ZW0sIFF1aWNrUGlja0lucHV0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBJbmxpbmVDaGF0Q29udHJvbGxlciB9IGZyb20gJy4uLy4uLy4uL2lubGluZUNoYXQvYnJvd3Nlci9pbmxpbmVDaGF0Q29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyBDVFhfSU5MSU5FX0NIQVRfRk9DVVNFRCB9IGZyb20gJy4uLy4uLy4uL2lubGluZUNoYXQvY29tbW9uL2lubGluZUNoYXQuanMnO1xuaW1wb3J0IHsgY2hhbmdlQ2VsbFRvS2luZCwgcnVuRGVsZXRlQWN0aW9uIH0gZnJvbSAnLi9jZWxsT3BlcmF0aW9ucy5qcyc7XG5pbXBvcnQgeyBDRUxMX1RJVExFX0NFTExfR1JPVVBfSUQsIENFTExfVElUTEVfT1VUUFVUX0dST1VQX0lELCBDZWxsVG9vbGJhck9yZGVyLCBJTm90ZWJvb2tBY3Rpb25Db250ZXh0LCBJTm90ZWJvb2tDZWxsQWN0aW9uQ29udGV4dCwgSU5vdGVib29rQ29tbWFuZENvbnRleHQsIE5PVEVCT09LX0VESVRPUl9XSURHRVRfQUNUSU9OX1dFSUdIVCwgTm90ZWJvb2tBY3Rpb24sIE5vdGVib29rQ2VsbEFjdGlvbiwgTm90ZWJvb2tNdWx0aUNlbGxBY3Rpb24sIGV4ZWN1dGVOb3RlYm9va0NvbmRpdGlvbiwgZmluZFRhcmdldENlbGxFZGl0b3IgfSBmcm9tICcuL2NvcmVBY3Rpb25zLmpzJztcbmltcG9ydCB7IE5vdGVib29rQ2hhbmdlVGFiRGlzcGxheVNpemUsIE5vdGVib29rSW5kZW50VXNpbmdTcGFjZXMsIE5vdGVib29rSW5kZW50VXNpbmdUYWJzLCBOb3RlYm9va0luZGVudGF0aW9uVG9TcGFjZXNBY3Rpb24sIE5vdGVib29rSW5kZW50YXRpb25Ub1RhYnNBY3Rpb24gfSBmcm9tICcuL25vdGVib29rSW5kZW50YXRpb25BY3Rpb25zLmpzJztcbmltcG9ydCB7IENIQU5HRV9DRUxMX0xBTkdVQUdFLCBDZWxsRWRpdFN0YXRlLCBERVRFQ1RfQ0VMTF9MQU5HVUFHRSwgUVVJVF9FRElUX0NFTExfQ09NTUFORF9JRCwgZ2V0Tm90ZWJvb2tFZGl0b3JGcm9tRWRpdG9yUGFuZSB9IGZyb20gJy4uL25vdGVib29rQnJvd3Nlci5qcyc7XG5pbXBvcnQgKiBhcyBpY29ucyBmcm9tICcuLi9ub3RlYm9va0ljb25zLmpzJztcbmltcG9ydCB7IENlbGxFZGl0VHlwZSwgQ2VsbEtpbmQsIElDZWxsRWRpdE9wZXJhdGlvbiwgTm90ZWJvb2tDZWxsRXhlY3V0aW9uU3RhdGUsIE5vdGVib29rU2V0dGluZyB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va0NvbW1vbi5qcyc7XG5pbXBvcnQgeyBOT1RFQk9PS19DRUxMX0VESVRBQkxFLCBOT1RFQk9PS19DRUxMX0hBU19PVVRQVVRTLCBOT1RFQk9PS19DRUxMX0lTX0ZJUlNUX09VVFBVVCwgTk9URUJPT0tfQ0VMTF9MSVNUX0ZPQ1VTRUQsIE5PVEVCT09LX0NFTExfTUFSS0RPV05fRURJVF9NT0RFLCBOT1RFQk9PS19DRUxMX1RZUEUsIE5PVEVCT09LX0VESVRPUl9FRElUQUJMRSwgTk9URUJPT0tfRURJVE9SX0ZPQ1VTRUQsIE5PVEVCT09LX0hBU19PVVRQVVRTLCBOT1RFQk9PS19JU19BQ1RJVkVfRURJVE9SLCBOT1RFQk9PS19PVVRQVVRfRk9DVVNFRCwgTk9URUJPT0tfT1VUUFVUX0lOUFVUX0ZPQ1VTRUQsIE5PVEVCT09LX1VTRV9DT05TT0xJREFURURfT1VUUFVUX0JVVFRPTiB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va0NvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tLZXJuZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL25vdGVib29rS2VybmVsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ2VsbFJhbmdlIH0gZnJvbSAnLi4vLi4vY29tbW9uL25vdGVib29rUmFuZ2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRGV0ZWN0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2xhbmd1YWdlRGV0ZWN0aW9uL2NvbW1vbi9sYW5ndWFnZURldGVjdGlvbldvcmtlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tJbmxpbmVWYXJpYWJsZXNDb250cm9sbGVyIH0gZnJvbSAnLi4vY29udHJpYi9ub3RlYm9va1ZhcmlhYmxlcy9ub3RlYm9va0lubGluZVZhcmlhYmxlcy5qcyc7XG5cbmNvbnN0IENMRUFSX0FMTF9DRUxMU19PVVRQVVRTX0NPTU1BTkRfSUQgPSAnbm90ZWJvb2suY2xlYXJBbGxDZWxsc091dHB1dHMnO1xuY29uc3QgRURJVF9DRUxMX0NPTU1BTkRfSUQgPSAnbm90ZWJvb2suY2VsbC5lZGl0JztcbmNvbnN0IERFTEVURV9DRUxMX0NPTU1BTkRfSUQgPSAnbm90ZWJvb2suY2VsbC5kZWxldGUnO1xuZXhwb3J0IGNvbnN0IENMRUFSX0NFTExfT1VUUFVUU19DT01NQU5EX0lEID0gJ25vdGVib29rLmNlbGwuY2xlYXJPdXRwdXRzJztcbmV4cG9ydCBjb25zdCBTRUxFQ1RfTk9URUJPT0tfSU5ERU5UQVRJT05fSUQgPSAnbm90ZWJvb2suc2VsZWN0SW5kZW50YXRpb24nO1xuZXhwb3J0IGNvbnN0IENPTU1FTlRfU0VMRUNURURfQ0VMTFNfSUQgPSAnbm90ZWJvb2suY29tbWVudFNlbGVjdGVkQ2VsbHMnO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgRWRpdENlbGxBY3Rpb24gZXh0ZW5kcyBOb3RlYm9va0NlbGxBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcihcblx0XHRcdHtcblx0XHRcdFx0aWQ6IEVESVRfQ0VMTF9DT01NQU5EX0lELFxuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ25vdGVib29rQWN0aW9ucy5lZGl0Q2VsbCcsIFwiRWRpdCBDZWxsXCIpLFxuXHRcdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdFx0Tk9URUJPT0tfQ0VMTF9MSVNUX0ZPQ1VTRUQsXG5cdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5ub3QoSW5wdXRGb2N1c2VkQ29udGV4dEtleSksXG5cdFx0XHRcdFx0XHRFZGl0b3JDb250ZXh0S2V5cy5ob3ZlckZvY3VzZWQudG9OZWdhdGVkKCksXG5cdFx0XHRcdFx0XHROT1RFQk9PS19PVVRQVVRfSU5QVVRfRk9DVVNFRC50b05lZ2F0ZWQoKVxuXHRcdFx0XHRcdCksXG5cdFx0XHRcdFx0cHJpbWFyeTogS2V5Q29kZS5FbnRlcixcblx0XHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYlxuXHRcdFx0XHR9LFxuXHRcdFx0XHRtZW51OiB7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5Ob3RlYm9va0NlbGxUaXRsZSxcblx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0XHROT1RFQk9PS19FRElUT1JfRURJVEFCTEUuaXNFcXVhbFRvKHRydWUpLFxuXHRcdFx0XHRcdFx0Tk9URUJPT0tfQ0VMTF9UWVBFLmlzRXF1YWxUbygnbWFya3VwJyksXG5cdFx0XHRcdFx0XHROT1RFQk9PS19DRUxMX01BUktET1dOX0VESVRfTU9ERS50b05lZ2F0ZWQoKSxcblx0XHRcdFx0XHRcdE5PVEVCT09LX0NFTExfRURJVEFCTEUpLFxuXHRcdFx0XHRcdG9yZGVyOiBDZWxsVG9vbGJhck9yZGVyLkVkaXRDZWxsLFxuXHRcdFx0XHRcdGdyb3VwOiBDRUxMX1RJVExFX0NFTExfR1JPVVBfSURcblx0XHRcdFx0fSxcblx0XHRcdFx0aWNvbjogaWNvbnMuZWRpdEljb24sXG5cdFx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bldpdGhDb250ZXh0KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0OiBJTm90ZWJvb2tDZWxsQWN0aW9uQ29udGV4dCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghY29udGV4dC5ub3RlYm9va0VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0YXdhaXQgY29udGV4dC5ub3RlYm9va0VkaXRvci5mb2N1c05vdGVib29rQ2VsbChjb250ZXh0LmNlbGwsICdlZGl0b3InKTtcblx0XHRjb25zdCBmb3VuZEVkaXRvcjogSUNvZGVFZGl0b3IgfCB1bmRlZmluZWQgPSBjb250ZXh0LmNlbGwgPyBmaW5kVGFyZ2V0Q2VsbEVkaXRvcihjb250ZXh0LCBjb250ZXh0LmNlbGwpIDogdW5kZWZpbmVkO1xuXHRcdGlmIChmb3VuZEVkaXRvciAmJiBmb3VuZEVkaXRvci5oYXNUZXh0Rm9jdXMoKSAmJiBJbmxpbmVDaGF0Q29udHJvbGxlci5nZXQoZm91bmRFZGl0b3IpPy5nZXRXaWRnZXRQb3NpdGlvbigpPy5saW5lTnVtYmVyID09PSBmb3VuZEVkaXRvci5nZXRQb3NpdGlvbigpPy5saW5lTnVtYmVyKSB7XG5cdFx0XHRJbmxpbmVDaGF0Q29udHJvbGxlci5nZXQoZm91bmRFZGl0b3IpPy5mb2N1cygpO1xuXHRcdH1cblx0fVxufSk7XG5cbmNvbnN0IHF1aXRFZGl0Q29uZGl0aW9uID0gQ29udGV4dEtleUV4cHIuYW5kKFxuXHROT1RFQk9PS19FRElUT1JfRk9DVVNFRCxcblx0SW5wdXRGb2N1c2VkQ29udGV4dCxcblx0Q1RYX0lOTElORV9DSEFUX0ZPQ1VTRUQudG9OZWdhdGVkKClcbik7XG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgUXVpdEVkaXRDZWxsQWN0aW9uIGV4dGVuZHMgTm90ZWJvb2tDZWxsQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiBRVUlUX0VESVRfQ0VMTF9DT01NQU5EX0lELFxuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ25vdGVib29rQWN0aW9ucy5xdWl0RWRpdCcsIFwiU3RvcCBFZGl0aW5nIENlbGxcIiksXG5cdFx0XHRcdG1lbnU6IHtcblx0XHRcdFx0XHRpZDogTWVudUlkLk5vdGVib29rQ2VsbFRpdGxlLFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRcdE5PVEVCT09LX0NFTExfVFlQRS5pc0VxdWFsVG8oJ21hcmt1cCcpLFxuXHRcdFx0XHRcdFx0Tk9URUJPT0tfQ0VMTF9NQVJLRE9XTl9FRElUX01PREUsXG5cdFx0XHRcdFx0XHROT1RFQk9PS19DRUxMX0VESVRBQkxFKSxcblx0XHRcdFx0XHRvcmRlcjogQ2VsbFRvb2xiYXJPcmRlci5TYXZlQ2VsbCxcblx0XHRcdFx0XHRncm91cDogQ0VMTF9USVRMRV9DRUxMX0dST1VQX0lEXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGljb246IGljb25zLnN0b3BFZGl0SWNvbixcblx0XHRcdFx0a2V5YmluZGluZzogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChxdWl0RWRpdENvbmRpdGlvbixcblx0XHRcdFx0XHRcdFx0RWRpdG9yQ29udGV4dEtleXMuaG92ZXJWaXNpYmxlLnRvTmVnYXRlZCgpLFxuXHRcdFx0XHRcdFx0XHRFZGl0b3JDb250ZXh0S2V5cy5oYXNOb25FbXB0eVNlbGVjdGlvbi50b05lZ2F0ZWQoKSxcblx0XHRcdFx0XHRcdFx0RWRpdG9yQ29udGV4dEtleXMuaGFzTXVsdGlwbGVTZWxlY3Rpb25zLnRvTmVnYXRlZCgpKSxcblx0XHRcdFx0XHRcdHByaW1hcnk6IEtleUNvZGUuRXNjYXBlLFxuXHRcdFx0XHRcdFx0d2VpZ2h0OiBOT1RFQk9PS19FRElUT1JfV0lER0VUX0FDVElPTl9XRUlHSFQgLSA1XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoTk9URUJPT0tfRURJVE9SX0ZPQ1VTRUQsXG5cdFx0XHRcdFx0XHRcdE5PVEVCT09LX09VVFBVVF9GT0NVU0VEKSxcblx0XHRcdFx0XHRcdHByaW1hcnk6IEtleUNvZGUuRXNjYXBlLFxuXHRcdFx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIgKyA1XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0XHRcdHF1aXRFZGl0Q29uZGl0aW9uLFxuXHRcdFx0XHRcdFx0XHROT1RFQk9PS19DRUxMX1RZUEUuaXNFcXVhbFRvKCdtYXJrdXAnKSksXG5cdFx0XHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuV2luQ3RybCB8IEtleUNvZGUuRW50ZXIsXG5cdFx0XHRcdFx0XHR3aW46IHtcblx0XHRcdFx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5FbnRlclxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdHdlaWdodDogTk9URUJPT0tfRURJVE9SX1dJREdFVF9BQ1RJT05fV0VJR0hUIC0gNVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdF1cblx0XHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuV2l0aENvbnRleHQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGNvbnRleHQ6IElOb3RlYm9va0NlbGxBY3Rpb25Db250ZXh0KSB7XG5cdFx0aWYgKGNvbnRleHQuY2VsbC5jZWxsS2luZCA9PT0gQ2VsbEtpbmQuTWFya3VwKSB7XG5cdFx0XHRjb250ZXh0LmNlbGwudXBkYXRlRWRpdFN0YXRlKENlbGxFZGl0U3RhdGUuUHJldmlldywgUVVJVF9FRElUX0NFTExfQ09NTUFORF9JRCk7XG5cdFx0fVxuXG5cdFx0YXdhaXQgY29udGV4dC5ub3RlYm9va0VkaXRvci5mb2N1c05vdGVib29rQ2VsbChjb250ZXh0LmNlbGwsICdjb250YWluZXInLCB7IHNraXBSZXZlYWw6IHRydWUgfSk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgRGVsZXRlQ2VsbEFjdGlvbiBleHRlbmRzIE5vdGVib29rQ2VsbEFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogREVMRVRFX0NFTExfQ09NTUFORF9JRCxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdub3RlYm9va0FjdGlvbnMuZGVsZXRlQ2VsbCcsIFwiRGVsZXRlIENlbGxcIiksXG5cdFx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0XHRwcmltYXJ5OiBLZXlDb2RlLkRlbGV0ZSxcblx0XHRcdFx0XHRtYWM6IHtcblx0XHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5CYWNrc3BhY2Vcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChOT1RFQk9PS19FRElUT1JfRk9DVVNFRCwgQ29udGV4dEtleUV4cHIubm90KElucHV0Rm9jdXNlZENvbnRleHRLZXkpLCBOT1RFQk9PS19PVVRQVVRfSU5QVVRfRk9DVVNFRC50b05lZ2F0ZWQoKSksXG5cdFx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWJcblx0XHRcdFx0fSxcblx0XHRcdFx0bWVudTogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGlkOiBNZW51SWQuTm90ZWJvb2tDZWxsRGVsZXRlLFxuXHRcdFx0XHRcdFx0d2hlbjogTk9URUJPT0tfRURJVE9SX0VESVRBQkxFLFxuXHRcdFx0XHRcdFx0Z3JvdXA6IENFTExfVElUTEVfQ0VMTF9HUk9VUF9JRFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0aWQ6IE1lbnVJZC5JbnRlcmFjdGl2ZUNlbGxEZWxldGUsXG5cdFx0XHRcdFx0XHRncm91cDogQ0VMTF9USVRMRV9DRUxMX0dST1VQX0lEXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdLFxuXHRcdFx0XHRpY29uOiBpY29ucy5kZWxldGVDZWxsSWNvblxuXHRcdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW5XaXRoQ29udGV4dChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY29udGV4dDogSU5vdGVib29rQ2VsbEFjdGlvbkNvbnRleHQpIHtcblx0XHRpZiAoIWNvbnRleHQubm90ZWJvb2tFZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGxldCBjb25maXJtYXRpb246IElDb25maXJtYXRpb25SZXN1bHQ7XG5cdFx0Y29uc3Qgbm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlKTtcblx0XHRjb25zdCBydW5TdGF0ZSA9IG5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlLmdldENlbGxFeGVjdXRpb24oY29udGV4dC5jZWxsLnVyaSk/LnN0YXRlO1xuXHRcdGNvbnN0IGNvbmZpZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblxuXHRcdGlmIChydW5TdGF0ZSA9PT0gTm90ZWJvb2tDZWxsRXhlY3V0aW9uU3RhdGUuRXhlY3V0aW5nICYmIGNvbmZpZ1NlcnZpY2UuZ2V0VmFsdWUoTm90ZWJvb2tTZXR0aW5nLmNvbmZpcm1EZWxldGVSdW5uaW5nQ2VsbCkpIHtcblx0XHRcdGNvbnN0IGRpYWxvZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSURpYWxvZ1NlcnZpY2UpO1xuXHRcdFx0Y29uc3QgcHJpbWFyeUJ1dHRvbiA9IGxvY2FsaXplKCdjb25maXJtRGVsZXRlQnV0dG9uJywgXCJEZWxldGVcIik7XG5cblx0XHRcdGNvbmZpcm1hdGlvbiA9IGF3YWl0IGRpYWxvZ1NlcnZpY2UuY29uZmlybSh7XG5cdFx0XHRcdHR5cGU6ICdxdWVzdGlvbicsXG5cdFx0XHRcdG1lc3NhZ2U6IGxvY2FsaXplKCdjb25maXJtRGVsZXRlQnV0dG9uTWVzc2FnZScsIFwiVGhpcyBjZWxsIGlzIHJ1bm5pbmcsIGFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBkZWxldGUgaXQ/XCIpLFxuXHRcdFx0XHRwcmltYXJ5QnV0dG9uOiBwcmltYXJ5QnV0dG9uLFxuXHRcdFx0XHRjaGVja2JveDoge1xuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnZG9Ob3RBc2tBZ2FpbicsIFwiRG8gbm90IGFzayBtZSBhZ2FpblwiKVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25maXJtYXRpb24gPSB7IGNvbmZpcm1lZDogdHJ1ZSB9O1xuXHRcdH1cblxuXHRcdGlmICghY29uZmlybWF0aW9uLmNvbmZpcm1lZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChjb25maXJtYXRpb24uY2hlY2tib3hDaGVja2VkID09PSB0cnVlKSB7XG5cdFx0XHRhd2FpdCBjb25maWdTZXJ2aWNlLnVwZGF0ZVZhbHVlKE5vdGVib29rU2V0dGluZy5jb25maXJtRGVsZXRlUnVubmluZ0NlbGwsIGZhbHNlKTtcblx0XHR9XG5cblx0XHRydW5EZWxldGVBY3Rpb24oY29udGV4dC5ub3RlYm9va0VkaXRvciwgY29udGV4dC5jZWxsKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBDbGVhckNlbGxPdXRwdXRzQWN0aW9uIGV4dGVuZHMgTm90ZWJvb2tDZWxsQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IENMRUFSX0NFTExfT1VUUFVUU19DT01NQU5EX0lELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdjbGVhckNlbGxPdXRwdXRzJywgJ0NsZWFyIENlbGwgT3V0cHV0cycpLFxuXHRcdFx0bWVudTogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5Ob3RlYm9va0NlbGxUaXRsZSxcblx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoTk9URUJPT0tfQ0VMTF9UWVBFLmlzRXF1YWxUbygnY29kZScpLCBleGVjdXRlTm90ZWJvb2tDb25kaXRpb24sIE5PVEVCT09LX0NFTExfSEFTX09VVFBVVFMsIE5PVEVCT09LX0VESVRPUl9FRElUQUJMRSwgTk9URUJPT0tfQ0VMTF9FRElUQUJMRSwgTk9URUJPT0tfVVNFX0NPTlNPTElEQVRFRF9PVVRQVVRfQlVUVE9OLnRvTmVnYXRlZCgpKSxcblx0XHRcdFx0XHRvcmRlcjogQ2VsbFRvb2xiYXJPcmRlci5DbGVhckNlbGxPdXRwdXQsXG5cdFx0XHRcdFx0Z3JvdXA6IENFTExfVElUTEVfT1VUUFVUX0dST1VQX0lEXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogTWVudUlkLk5vdGVib29rT3V0cHV0VG9vbGJhcixcblx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoTk9URUJPT0tfQ0VMTF9IQVNfT1VUUFVUUywgTk9URUJPT0tfRURJVE9SX0VESVRBQkxFLCBOT1RFQk9PS19DRUxMX0VESVRBQkxFLCBOT1RFQk9PS19DRUxMX0lTX0ZJUlNUX09VVFBVVCwgTk9URUJPT0tfVVNFX0NPTlNPTElEQVRFRF9PVVRQVVRfQlVUVE9OKVxuXHRcdFx0XHR9LFxuXHRcdFx0XSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKE5PVEVCT09LX0VESVRPUl9GT0NVU0VELCBDb250ZXh0S2V5RXhwci5ub3QoSW5wdXRGb2N1c2VkQ29udGV4dEtleSksIE5PVEVCT09LX0NFTExfSEFTX09VVFBVVFMsIE5PVEVCT09LX0VESVRPUl9FRElUQUJMRSwgTk9URUJPT0tfQ0VMTF9FRElUQUJMRSksXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5BbHQgfCBLZXlDb2RlLkRlbGV0ZSxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWJcblx0XHRcdH0sXG5cdFx0XHRpY29uOiBpY29ucy5jbGVhckljb25cblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bldpdGhDb250ZXh0KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0OiBJTm90ZWJvb2tDZWxsQWN0aW9uQ29udGV4dCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IG5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElOb3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZSk7XG5cdFx0Y29uc3QgZWRpdG9yID0gY29udGV4dC5ub3RlYm9va0VkaXRvcjtcblx0XHRpZiAoIWVkaXRvci5oYXNNb2RlbCgpIHx8ICFlZGl0b3IudGV4dE1vZGVsLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNlbGwgPSBjb250ZXh0LmNlbGw7XG5cdFx0Y29uc3QgaW5kZXggPSBlZGl0b3IudGV4dE1vZGVsLmNlbGxzLmluZGV4T2YoY2VsbC5tb2RlbCk7XG5cblx0XHRpZiAoaW5kZXggPCAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29tcHV0ZVVuZG9SZWRvID0gIWVkaXRvci5pc1JlYWRPbmx5O1xuXHRcdGVkaXRvci50ZXh0TW9kZWwuYXBwbHlFZGl0cyhbeyBlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk91dHB1dCwgaW5kZXgsIG91dHB1dHM6IFtdIH1dLCB0cnVlLCB1bmRlZmluZWQsICgpID0+IHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBjb21wdXRlVW5kb1JlZG8pO1xuXG5cdFx0Y29uc3QgcnVuU3RhdGUgPSBub3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZS5nZXRDZWxsRXhlY3V0aW9uKGNvbnRleHQuY2VsbC51cmkpPy5zdGF0ZTtcblx0XHRpZiAocnVuU3RhdGUgIT09IE5vdGVib29rQ2VsbEV4ZWN1dGlvblN0YXRlLkV4ZWN1dGluZykge1xuXHRcdFx0Y29udGV4dC5ub3RlYm9va0VkaXRvci50ZXh0TW9kZWwuYXBwbHlFZGl0cyhbe1xuXHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlBhcnRpYWxJbnRlcm5hbE1ldGFkYXRhLCBpbmRleCwgaW50ZXJuYWxNZXRhZGF0YToge1xuXHRcdFx0XHRcdHJ1blN0YXJ0VGltZTogbnVsbCxcblx0XHRcdFx0XHRydW5TdGFydFRpbWVBZGp1c3RtZW50OiBudWxsLFxuXHRcdFx0XHRcdHJ1bkVuZFRpbWU6IG51bGwsXG5cdFx0XHRcdFx0ZXhlY3V0aW9uT3JkZXI6IG51bGwsXG5cdFx0XHRcdFx0bGFzdFJ1blN1Y2Nlc3M6IG51bGxcblx0XHRcdFx0fVxuXHRcdFx0fV0sIHRydWUsIHVuZGVmaW5lZCwgKCkgPT4gdW5kZWZpbmVkLCB1bmRlZmluZWQsIGNvbXB1dGVVbmRvUmVkbyk7XG5cdFx0fVxuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIENsZWFyQWxsQ2VsbE91dHB1dHNBY3Rpb24gZXh0ZW5kcyBOb3RlYm9va0FjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBDTEVBUl9BTExfQ0VMTFNfT1VUUFVUU19DT01NQU5EX0lELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdjbGVhckFsbENlbGxzT3V0cHV0cycsICdDbGVhciBBbGwgT3V0cHV0cycpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBOT1RFQk9PS19IQVNfT1VUUFVUUyxcblx0XHRcdG1lbnU6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuRWRpdG9yVGl0bGUsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdFx0Tk9URUJPT0tfSVNfQUNUSVZFX0VESVRPUixcblx0XHRcdFx0XHRcdENvbnRleHRLZXlFeHByLm5vdEVxdWFscygnY29uZmlnLm5vdGVib29rLmdsb2JhbFRvb2xiYXInLCB0cnVlKVxuXHRcdFx0XHRcdCksXG5cdFx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0XHRvcmRlcjogMFxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5Ob3RlYm9va1Rvb2xiYXIsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdFx0ZXhlY3V0ZU5vdGVib29rQ29uZGl0aW9uLFxuXHRcdFx0XHRcdFx0Q29udGV4dEtleUV4cHIuZXF1YWxzKCdjb25maWcubm90ZWJvb2suZ2xvYmFsVG9vbGJhcicsIHRydWUpXG5cdFx0XHRcdFx0KSxcblx0XHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24vZXhlY3V0ZScsXG5cdFx0XHRcdFx0b3JkZXI6IDEwXG5cdFx0XHRcdH1cblx0XHRcdF0sXG5cdFx0XHRpY29uOiBpY29ucy5jbGVhckljb25cblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bldpdGhDb250ZXh0KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0OiBJTm90ZWJvb2tBY3Rpb25Db250ZXh0KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgbm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlKTtcblx0XHRjb25zdCBlZGl0b3IgPSBjb250ZXh0Lm5vdGVib29rRWRpdG9yO1xuXHRcdGlmICghZWRpdG9yLmhhc01vZGVsKCkgfHwgIWVkaXRvci50ZXh0TW9kZWwubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29tcHV0ZVVuZG9SZWRvID0gIWVkaXRvci5pc1JlYWRPbmx5O1xuXHRcdGVkaXRvci50ZXh0TW9kZWwuYXBwbHlFZGl0cyhcblx0XHRcdGVkaXRvci50ZXh0TW9kZWwuY2VsbHMubWFwKChjZWxsLCBpbmRleCkgPT4gKHtcblx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5PdXRwdXQsIGluZGV4LCBvdXRwdXRzOiBbXVxuXHRcdFx0fSkpLCB0cnVlLCB1bmRlZmluZWQsICgpID0+IHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBjb21wdXRlVW5kb1JlZG8pO1xuXG5cdFx0Y29uc3QgY2xlYXJFeGVjdXRpb25NZXRhZGF0YUVkaXRzID0gZWRpdG9yLnRleHRNb2RlbC5jZWxscy5tYXAoKGNlbGwsIGluZGV4KSA9PiB7XG5cdFx0XHRjb25zdCBydW5TdGF0ZSA9IG5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlLmdldENlbGxFeGVjdXRpb24oY2VsbC51cmkpPy5zdGF0ZTtcblx0XHRcdGlmIChydW5TdGF0ZSAhPT0gTm90ZWJvb2tDZWxsRXhlY3V0aW9uU3RhdGUuRXhlY3V0aW5nKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5QYXJ0aWFsSW50ZXJuYWxNZXRhZGF0YSwgaW5kZXgsIGludGVybmFsTWV0YWRhdGE6IHtcblx0XHRcdFx0XHRcdHJ1blN0YXJ0VGltZTogbnVsbCxcblx0XHRcdFx0XHRcdHJ1blN0YXJ0VGltZUFkanVzdG1lbnQ6IG51bGwsXG5cdFx0XHRcdFx0XHRydW5FbmRUaW1lOiBudWxsLFxuXHRcdFx0XHRcdFx0ZXhlY3V0aW9uT3JkZXI6IG51bGwsXG5cdFx0XHRcdFx0XHRsYXN0UnVuU3VjY2VzczogbnVsbFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSkuZmlsdGVyKGVkaXQgPT4gISFlZGl0KSBhcyBJQ2VsbEVkaXRPcGVyYXRpb25bXTtcblx0XHRpZiAoY2xlYXJFeGVjdXRpb25NZXRhZGF0YUVkaXRzLmxlbmd0aCkge1xuXHRcdFx0Y29udGV4dC5ub3RlYm9va0VkaXRvci50ZXh0TW9kZWwuYXBwbHlFZGl0cyhjbGVhckV4ZWN1dGlvbk1ldGFkYXRhRWRpdHMsIHRydWUsIHVuZGVmaW5lZCwgKCkgPT4gdW5kZWZpbmVkLCB1bmRlZmluZWQsIGNvbXB1dGVVbmRvUmVkbyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29udHJvbGxlciA9IGVkaXRvci5nZXRDb250cmlidXRpb248Tm90ZWJvb2tJbmxpbmVWYXJpYWJsZXNDb250cm9sbGVyPihOb3RlYm9va0lubGluZVZhcmlhYmxlc0NvbnRyb2xsZXIuaWQpO1xuXHRcdGNvbnRyb2xsZXIuY2xlYXJOb3RlYm9va0lubGluZURlY29yYXRpb25zKCk7XG5cdH1cbn0pO1xuXG5pbnRlcmZhY2UgSUxhbmd1YWdlUGlja0lucHV0IGV4dGVuZHMgSVF1aWNrUGlja0l0ZW0ge1xuXHRsYW5ndWFnZUlkOiBzdHJpbmc7XG5cdGRlc2NyaXB0aW9uOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBJQ2hhbmdlQ2VsbENvbnRleHQgZXh0ZW5kcyBJTm90ZWJvb2tDZWxsQWN0aW9uQ29udGV4dCB7XG5cdC8vIFRPRE9AcmVib3JuaXggOiBgY2VsbHNgXG5cdC8vIHJhbmdlOiBJQ2VsbFJhbmdlO1xuXHRsYW5ndWFnZT86IHN0cmluZztcbn1cblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIENoYW5nZUNlbGxMYW5ndWFnZUFjdGlvbiBleHRlbmRzIE5vdGVib29rQ2VsbEFjdGlvbjxJQ2VsbFJhbmdlPiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBDSEFOR0VfQ0VMTF9MQU5HVUFHRSxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnY2hhbmdlTGFuZ3VhZ2UnLCAnQ2hhbmdlIENlbGwgTGFuZ3VhZ2UnKSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlDb2RlLktleU0pLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoTk9URUJPT0tfRURJVE9SX0ZPQ1VTRUQsIE5PVEVCT09LX0VESVRPUl9FRElUQUJMRSwgTk9URUJPT0tfQ0VMTF9FRElUQUJMRSlcblx0XHRcdH0sXG5cdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2NoYW5nZUxhbmd1YWdlJywgJ0NoYW5nZSBDZWxsIExhbmd1YWdlJyksXG5cdFx0XHRcdGFyZ3M6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRuYW1lOiAncmFuZ2UnLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246ICdUaGUgY2VsbCByYW5nZScsXG5cdFx0XHRcdFx0XHRzY2hlbWE6IHtcblx0XHRcdFx0XHRcdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRcdFx0J3JlcXVpcmVkJzogWydzdGFydCcsICdlbmQnXSxcblx0XHRcdFx0XHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdFx0XHRcdFx0J3N0YXJ0Jzoge1xuXHRcdFx0XHRcdFx0XHRcdFx0J3R5cGUnOiAnbnVtYmVyJ1xuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0J2VuZCc6IHtcblx0XHRcdFx0XHRcdFx0XHRcdCd0eXBlJzogJ251bWJlcidcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdG5hbWU6ICdsYW5ndWFnZScsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogJ1RoZSB0YXJnZXQgY2VsbCBsYW5ndWFnZScsXG5cdFx0XHRcdFx0XHRzY2hlbWE6IHtcblx0XHRcdFx0XHRcdFx0J3R5cGUnOiAnc3RyaW5nJ1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGdldENlbGxDb250ZXh0RnJvbUFyZ3MoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGNvbnRleHQ/OiBJQ2VsbFJhbmdlLCAuLi5hZGRpdGlvbmFsQXJnczogYW55W10pOiBJQ2hhbmdlQ2VsbENvbnRleHQgfCB1bmRlZmluZWQge1xuXHRcdGlmICghY29udGV4dCB8fCB0eXBlb2YgY29udGV4dC5zdGFydCAhPT0gJ251bWJlcicgfHwgdHlwZW9mIGNvbnRleHQuZW5kICE9PSAnbnVtYmVyJyB8fCBjb250ZXh0LnN0YXJ0ID49IGNvbnRleHQuZW5kKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGFuZ3VhZ2UgPSBhZGRpdGlvbmFsQXJncy5sZW5ndGggJiYgdHlwZW9mIGFkZGl0aW9uYWxBcmdzWzBdID09PSAnc3RyaW5nJyA/IGFkZGl0aW9uYWxBcmdzWzBdIDogdW5kZWZpbmVkO1xuXHRcdGNvbnN0IGFjdGl2ZUVkaXRvckNvbnRleHQgPSB0aGlzLmdldEVkaXRvckNvbnRleHRGcm9tQXJnc09yQWN0aXZlKGFjY2Vzc29yKTtcblxuXHRcdGlmICghYWN0aXZlRWRpdG9yQ29udGV4dCB8fCAhYWN0aXZlRWRpdG9yQ29udGV4dC5ub3RlYm9va0VkaXRvci5oYXNNb2RlbCgpIHx8IGNvbnRleHQuc3RhcnQgPj0gYWN0aXZlRWRpdG9yQ29udGV4dC5ub3RlYm9va0VkaXRvci5nZXRMZW5ndGgoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFRPRE9AcmVib3JuaXgsIHN1cHBvcnQgbXVsdGlwbGUgY2VsbHNcblx0XHRyZXR1cm4ge1xuXHRcdFx0bm90ZWJvb2tFZGl0b3I6IGFjdGl2ZUVkaXRvckNvbnRleHQubm90ZWJvb2tFZGl0b3IsXG5cdFx0XHRjZWxsOiBhY3RpdmVFZGl0b3JDb250ZXh0Lm5vdGVib29rRWRpdG9yLmNlbGxBdChjb250ZXh0LnN0YXJ0KSEsXG5cdFx0XHRsYW5ndWFnZVxuXHRcdH07XG5cdH1cblxuXG5cdGFzeW5jIHJ1bldpdGhDb250ZXh0KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0OiBJQ2hhbmdlQ2VsbENvbnRleHQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoY29udGV4dC5sYW5ndWFnZSkge1xuXHRcdFx0YXdhaXQgdGhpcy5zZXRMYW5ndWFnZShjb250ZXh0LCBjb250ZXh0Lmxhbmd1YWdlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXdhaXQgdGhpcy5zaG93TGFuZ3VhZ2VQaWNrZXIoYWNjZXNzb3IsIGNvbnRleHQpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc2hvd0xhbmd1YWdlUGlja2VyKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0OiBJQ2hhbmdlQ2VsbENvbnRleHQpIHtcblx0XHRjb25zdCB0b3BJdGVtczogSUxhbmd1YWdlUGlja0lucHV0W10gPSBbXTtcblx0XHRjb25zdCBtYWluSXRlbXM6IElMYW5ndWFnZVBpY2tJbnB1dFtdID0gW107XG5cblx0XHRjb25zdCBsYW5ndWFnZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxhbmd1YWdlU2VydmljZSk7XG5cdFx0Y29uc3QgbW9kZWxTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElNb2RlbFNlcnZpY2UpO1xuXHRcdGNvbnN0IHF1aWNrSW5wdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElRdWlja0lucHV0U2VydmljZSk7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VEZXRlY3Rpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMYW5ndWFnZURldGVjdGlvblNlcnZpY2UpO1xuXHRcdGNvbnN0IGtlcm5lbFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU5vdGVib29rS2VybmVsU2VydmljZSk7XG5cblx0XHRsZXQgbGFuZ3VhZ2VzID0gY29udGV4dC5ub3RlYm9va0VkaXRvci5hY3RpdmVLZXJuZWw/LnN1cHBvcnRlZExhbmd1YWdlcztcblx0XHRpZiAoIWxhbmd1YWdlcykge1xuXHRcdFx0Y29uc3QgbWF0Y2hSZXN1bHQgPSBrZXJuZWxTZXJ2aWNlLmdldE1hdGNoaW5nS2VybmVsKGNvbnRleHQubm90ZWJvb2tFZGl0b3IudGV4dE1vZGVsKTtcblx0XHRcdGNvbnN0IGFsbFN1cHBvcnRlZExhbmd1YWdlcyA9IG1hdGNoUmVzdWx0LmFsbC5mbGF0TWFwKGtlcm5lbCA9PiBrZXJuZWwuc3VwcG9ydGVkTGFuZ3VhZ2VzKTtcblx0XHRcdGxhbmd1YWdlcyA9IGFsbFN1cHBvcnRlZExhbmd1YWdlcy5sZW5ndGggPiAwID8gYWxsU3VwcG9ydGVkTGFuZ3VhZ2VzIDogbGFuZ3VhZ2VTZXJ2aWNlLmdldFJlZ2lzdGVyZWRMYW5ndWFnZUlkcygpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByb3ZpZGVyTGFuZ3VhZ2VzID0gbmV3IFNldChbXG5cdFx0XHQuLi5sYW5ndWFnZXMsXG5cdFx0XHQnbWFya2Rvd24nXG5cdFx0XSk7XG5cblx0XHRwcm92aWRlckxhbmd1YWdlcy5mb3JFYWNoKGxhbmd1YWdlSWQgPT4ge1xuXHRcdFx0bGV0IGRlc2NyaXB0aW9uOiBzdHJpbmc7XG5cdFx0XHRpZiAoY29udGV4dC5jZWxsLmNlbGxLaW5kID09PSBDZWxsS2luZC5NYXJrdXAgPyAobGFuZ3VhZ2VJZCA9PT0gJ21hcmtkb3duJykgOiAobGFuZ3VhZ2VJZCA9PT0gY29udGV4dC5jZWxsLmxhbmd1YWdlKSkge1xuXHRcdFx0XHRkZXNjcmlwdGlvbiA9IGxvY2FsaXplKCdsYW5ndWFnZURlc2NyaXB0aW9uJywgXCIoezB9KSAtIEN1cnJlbnQgTGFuZ3VhZ2VcIiwgbGFuZ3VhZ2VJZCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRkZXNjcmlwdGlvbiA9IGxvY2FsaXplKCdsYW5ndWFnZURlc2NyaXB0aW9uQ29uZmlndXJlZCcsIFwiKHswfSlcIiwgbGFuZ3VhZ2VJZCk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGxhbmd1YWdlTmFtZSA9IGxhbmd1YWdlU2VydmljZS5nZXRMYW5ndWFnZU5hbWUobGFuZ3VhZ2VJZCk7XG5cdFx0XHRpZiAoIWxhbmd1YWdlTmFtZSkge1xuXHRcdFx0XHQvLyBOb3RlYm9vayBoYXMgdW5yZWNvZ25pemVkIGxhbmd1YWdlXG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgaXRlbTogSUxhbmd1YWdlUGlja0lucHV0ID0ge1xuXHRcdFx0XHRsYWJlbDogbGFuZ3VhZ2VOYW1lLFxuXHRcdFx0XHRpY29uQ2xhc3NlczogZ2V0SWNvbkNsYXNzZXMobW9kZWxTZXJ2aWNlLCBsYW5ndWFnZVNlcnZpY2UsIHRoaXMuZ2V0RmFrZVJlc291cmNlKGxhbmd1YWdlTmFtZSwgbGFuZ3VhZ2VTZXJ2aWNlKSksXG5cdFx0XHRcdGRlc2NyaXB0aW9uLFxuXHRcdFx0XHRsYW5ndWFnZUlkXG5cdFx0XHR9O1xuXG5cdFx0XHRpZiAobGFuZ3VhZ2VJZCA9PT0gJ21hcmtkb3duJyB8fCBsYW5ndWFnZUlkID09PSBjb250ZXh0LmNlbGwubGFuZ3VhZ2UpIHtcblx0XHRcdFx0dG9wSXRlbXMucHVzaChpdGVtKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG1haW5JdGVtcy5wdXNoKGl0ZW0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0bWFpbkl0ZW1zLnNvcnQoKGEsIGIpID0+IHtcblx0XHRcdHJldHVybiBhLmRlc2NyaXB0aW9uLmxvY2FsZUNvbXBhcmUoYi5kZXNjcmlwdGlvbik7XG5cdFx0fSk7XG5cblx0XHQvLyBPZmZlciB0byBcIkF1dG8gRGV0ZWN0XCJcblx0XHRjb25zdCBhdXRvRGV0ZWN0TW9kZTogSVF1aWNrUGlja0l0ZW0gPSB7XG5cdFx0XHRsYWJlbDogbG9jYWxpemUoJ2F1dG9EZXRlY3QnLCBcIkF1dG8gRGV0ZWN0XCIpXG5cdFx0fTtcblxuXHRcdGNvbnN0IHBpY2tzOiBRdWlja1BpY2tJbnB1dFtdID0gW1xuXHRcdFx0YXV0b0RldGVjdE1vZGUsXG5cdFx0XHR7IHR5cGU6ICdzZXBhcmF0b3InLCBsYWJlbDogbG9jYWxpemUoJ2xhbmd1YWdlc1BpY2tzJywgXCJsYW5ndWFnZXMgKGlkZW50aWZpZXIpXCIpIH0sXG5cdFx0XHQuLi50b3BJdGVtcyxcblx0XHRcdHsgdHlwZTogJ3NlcGFyYXRvcicgfSxcblx0XHRcdC4uLm1haW5JdGVtc1xuXHRcdF07XG5cblx0XHRjb25zdCBzZWxlY3Rpb24gPSBhd2FpdCBxdWlja0lucHV0U2VydmljZS5waWNrKHBpY2tzLCB7IHBsYWNlSG9sZGVyOiBsb2NhbGl6ZSgncGlja0xhbmd1YWdlVG9Db25maWd1cmUnLCBcIlNlbGVjdCBMYW5ndWFnZSBNb2RlXCIpIH0pO1xuXHRcdGNvbnN0IGxhbmd1YWdlSWQgPSBzZWxlY3Rpb24gPT09IGF1dG9EZXRlY3RNb2RlXG5cdFx0XHQ/IGF3YWl0IGxhbmd1YWdlRGV0ZWN0aW9uU2VydmljZS5kZXRlY3RMYW5ndWFnZShjb250ZXh0LmNlbGwudXJpKVxuXHRcdFx0OiAoc2VsZWN0aW9uIGFzIElMYW5ndWFnZVBpY2tJbnB1dCk/Lmxhbmd1YWdlSWQ7XG5cblx0XHRpZiAobGFuZ3VhZ2VJZCkge1xuXHRcdFx0YXdhaXQgdGhpcy5zZXRMYW5ndWFnZShjb250ZXh0LCBsYW5ndWFnZUlkKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHNldExhbmd1YWdlKGNvbnRleHQ6IElDaGFuZ2VDZWxsQ29udGV4dCwgbGFuZ3VhZ2VJZDogc3RyaW5nKSB7XG5cdFx0YXdhaXQgc2V0Q2VsbFRvTGFuZ3VhZ2UobGFuZ3VhZ2VJZCwgY29udGV4dCk7XG5cdH1cblxuXHQvKipcblx0ICogQ29waWVkIGZyb20gZWRpdG9yU3RhdHVzLnRzXG5cdCAqL1xuXHRwcml2YXRlIGdldEZha2VSZXNvdXJjZShsYW5nOiBzdHJpbmcsIGxhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSk6IFVSSSB8IHVuZGVmaW5lZCB7XG5cdFx0bGV0IGZha2VSZXNvdXJjZTogVVJJIHwgdW5kZWZpbmVkO1xuXG5cdFx0Y29uc3QgbGFuZ3VhZ2VJZCA9IGxhbmd1YWdlU2VydmljZS5nZXRMYW5ndWFnZUlkQnlMYW5ndWFnZU5hbWUobGFuZyk7XG5cdFx0aWYgKGxhbmd1YWdlSWQpIHtcblx0XHRcdGNvbnN0IGV4dGVuc2lvbnMgPSBsYW5ndWFnZVNlcnZpY2UuZ2V0RXh0ZW5zaW9ucyhsYW5ndWFnZUlkKTtcblx0XHRcdGlmIChleHRlbnNpb25zLmxlbmd0aCkge1xuXHRcdFx0XHRmYWtlUmVzb3VyY2UgPSBVUkkuZmlsZShleHRlbnNpb25zWzBdKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IGZpbGVuYW1lcyA9IGxhbmd1YWdlU2VydmljZS5nZXRGaWxlbmFtZXMobGFuZ3VhZ2VJZCk7XG5cdFx0XHRcdGlmIChmaWxlbmFtZXMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0ZmFrZVJlc291cmNlID0gVVJJLmZpbGUoZmlsZW5hbWVzWzBdKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBmYWtlUmVzb3VyY2U7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgRGV0ZWN0Q2VsbExhbmd1YWdlQWN0aW9uIGV4dGVuZHMgTm90ZWJvb2tDZWxsQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IERFVEVDVF9DRUxMX0xBTkdVQUdFLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignZGV0ZWN0TGFuZ3VhZ2UnLCBcIkFjY2VwdCBEZXRlY3RlZCBMYW5ndWFnZSBmb3IgQ2VsbFwiKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoTk9URUJPT0tfRURJVE9SX0VESVRBQkxFLCBOT1RFQk9PS19DRUxMX0VESVRBQkxFKSxcblx0XHRcdGtleWJpbmRpbmc6IHsgcHJpbWFyeTogS2V5Q29kZS5LZXlEIHwgS2V5TW9kLkFsdCB8IEtleU1vZC5TaGlmdCwgd2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIgfVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuV2l0aENvbnRleHQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGNvbnRleHQ6IElOb3RlYm9va0NlbGxBY3Rpb25Db250ZXh0KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VEZXRlY3Rpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMYW5ndWFnZURldGVjdGlvblNlcnZpY2UpO1xuXHRcdGNvbnN0IG5vdGlmaWNhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU5vdGlmaWNhdGlvblNlcnZpY2UpO1xuXHRcdGNvbnN0IGtlcm5lbFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU5vdGVib29rS2VybmVsU2VydmljZSk7XG5cdFx0Y29uc3Qga2VybmVsID0ga2VybmVsU2VydmljZS5nZXRTZWxlY3RlZE9yU3VnZ2VzdGVkS2VybmVsKGNvbnRleHQubm90ZWJvb2tFZGl0b3IudGV4dE1vZGVsKTtcblx0XHRjb25zdCBwcm92aWRlckxhbmd1YWdlcyA9IFsuLi5rZXJuZWw/LnN1cHBvcnRlZExhbmd1YWdlcyA/PyBbXV07XG5cdFx0cHJvdmlkZXJMYW5ndWFnZXMucHVzaCgnbWFya2Rvd24nKTtcblx0XHRjb25zdCBkZXRlY3Rpb24gPSBhd2FpdCBsYW5ndWFnZURldGVjdGlvblNlcnZpY2UuZGV0ZWN0TGFuZ3VhZ2UoY29udGV4dC5jZWxsLnVyaSwgcHJvdmlkZXJMYW5ndWFnZXMpO1xuXHRcdGlmIChkZXRlY3Rpb24pIHtcblx0XHRcdHNldENlbGxUb0xhbmd1YWdlKGRldGVjdGlvbiwgY29udGV4dCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG5vdGlmaWNhdGlvblNlcnZpY2Uud2Fybihsb2NhbGl6ZSgnbm9EZXRlY3Rpb24nLCBcIlVuYWJsZSB0byBkZXRlY3QgY2VsbCBsYW5ndWFnZVwiKSk7XG5cdFx0fVxuXHR9XG59KTtcblxuYXN5bmMgZnVuY3Rpb24gc2V0Q2VsbFRvTGFuZ3VhZ2UobGFuZ3VhZ2VJZDogc3RyaW5nLCBjb250ZXh0OiBJQ2hhbmdlQ2VsbENvbnRleHQpIHtcblx0aWYgKGxhbmd1YWdlSWQgPT09ICdtYXJrZG93bicgJiYgY29udGV4dC5jZWxsPy5sYW5ndWFnZSAhPT0gJ21hcmtkb3duJykge1xuXHRcdGNvbnN0IGlkeCA9IGNvbnRleHQubm90ZWJvb2tFZGl0b3IuZ2V0Q2VsbEluZGV4KGNvbnRleHQuY2VsbCk7XG5cdFx0YXdhaXQgY2hhbmdlQ2VsbFRvS2luZChDZWxsS2luZC5NYXJrdXAsIHsgY2VsbDogY29udGV4dC5jZWxsLCBub3RlYm9va0VkaXRvcjogY29udGV4dC5ub3RlYm9va0VkaXRvciwgdWk6IHRydWUgfSwgJ21hcmtkb3duJywgTWltZXMubWFya2Rvd24pO1xuXHRcdGNvbnN0IG5ld0NlbGwgPSBjb250ZXh0Lm5vdGVib29rRWRpdG9yLmNlbGxBdChpZHgpO1xuXG5cdFx0aWYgKG5ld0NlbGwpIHtcblx0XHRcdGF3YWl0IGNvbnRleHQubm90ZWJvb2tFZGl0b3IuZm9jdXNOb3RlYm9va0NlbGwobmV3Q2VsbCwgJ2VkaXRvcicpO1xuXHRcdH1cblx0fSBlbHNlIGlmIChsYW5ndWFnZUlkICE9PSAnbWFya2Rvd24nICYmIGNvbnRleHQuY2VsbD8uY2VsbEtpbmQgPT09IENlbGxLaW5kLk1hcmt1cCkge1xuXHRcdGF3YWl0IGNoYW5nZUNlbGxUb0tpbmQoQ2VsbEtpbmQuQ29kZSwgeyBjZWxsOiBjb250ZXh0LmNlbGwsIG5vdGVib29rRWRpdG9yOiBjb250ZXh0Lm5vdGVib29rRWRpdG9yLCB1aTogdHJ1ZSB9LCBsYW5ndWFnZUlkKTtcblx0fSBlbHNlIHtcblx0XHRjb25zdCBpbmRleCA9IGNvbnRleHQubm90ZWJvb2tFZGl0b3IudGV4dE1vZGVsLmNlbGxzLmluZGV4T2YoY29udGV4dC5jZWxsLm1vZGVsKTtcblx0XHRjb250ZXh0Lm5vdGVib29rRWRpdG9yLnRleHRNb2RlbC5hcHBseUVkaXRzKFxuXHRcdFx0W3sgZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5DZWxsTGFuZ3VhZ2UsIGluZGV4LCBsYW5ndWFnZTogbGFuZ3VhZ2VJZCB9XSxcblx0XHRcdHRydWUsIHVuZGVmaW5lZCwgKCkgPT4gdW5kZWZpbmVkLCB1bmRlZmluZWQsICFjb250ZXh0Lm5vdGVib29rRWRpdG9yLmlzUmVhZE9ubHlcblx0XHQpO1xuXHR9XG59XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBTZWxlY3ROb3RlYm9va0luZGVudGF0aW9uIGV4dGVuZHMgTm90ZWJvb2tBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogU0VMRUNUX05PVEVCT09LX0lOREVOVEFUSU9OX0lELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignc2VsZWN0Tm90ZWJvb2tJbmRlbnRhdGlvbicsICdTZWxlY3QgSW5kZW50YXRpb24nKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoTk9URUJPT0tfSVNfQUNUSVZFX0VESVRPUiwgTk9URUJPT0tfRURJVE9SX0VESVRBQkxFLCBOT1RFQk9PS19DRUxMX0VESVRBQkxFKSxcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bldpdGhDb250ZXh0KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0OiBJTm90ZWJvb2tBY3Rpb25Db250ZXh0KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5zaG93Tm90ZWJvb2tJbmRlbnRhdGlvblBpY2tlcihhY2Nlc3NvciwgY29udGV4dCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHNob3dOb3RlYm9va0luZGVudGF0aW9uUGlja2VyKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0OiBJTm90ZWJvb2tBY3Rpb25Db250ZXh0KSB7XG5cdFx0Y29uc3QgcXVpY2tJbnB1dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVF1aWNrSW5wdXRTZXJ2aWNlKTtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgYWN0aXZlTm90ZWJvb2sgPSBnZXROb3RlYm9va0VkaXRvckZyb21FZGl0b3JQYW5lKGVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZSk7XG5cdFx0aWYgKCFhY3RpdmVOb3RlYm9vayB8fCBhY3RpdmVOb3RlYm9vay5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRyZXR1cm4gcXVpY2tJbnB1dFNlcnZpY2UucGljayhbeyBsYWJlbDogbG9jYWxpemUoJ25vTm90ZWJvb2tFZGl0b3InLCBcIk5vIG5vdGVib29rIGVkaXRvciBhY3RpdmUgYXQgdGhpcyB0aW1lXCIpIH1dKTtcblx0XHR9XG5cblx0XHRpZiAoYWN0aXZlTm90ZWJvb2suaXNSZWFkT25seSkge1xuXHRcdFx0cmV0dXJuIHF1aWNrSW5wdXRTZXJ2aWNlLnBpY2soW3sgbGFiZWw6IGxvY2FsaXplKCdub1dyaXRhYmxlQ29kZUVkaXRvcicsIFwiVGhlIGFjdGl2ZSBub3RlYm9vayBlZGl0b3IgaXMgcmVhZC1vbmx5LlwiKSB9XSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcGlja3M6IFF1aWNrUGlja0lucHV0PElRdWlja1BpY2tJdGVtICYgeyBydW4oKTogdm9pZCB9PltdID0gW1xuXHRcdFx0bmV3IE5vdGVib29rSW5kZW50VXNpbmdUYWJzKCksIC8vIGluZGVudCB1c2luZyB0YWJzXG5cdFx0XHRuZXcgTm90ZWJvb2tJbmRlbnRVc2luZ1NwYWNlcygpLCAvLyBpbmRlbnQgdXNpbmcgc3BhY2VzXG5cdFx0XHRuZXcgTm90ZWJvb2tDaGFuZ2VUYWJEaXNwbGF5U2l6ZSgpLCAvLyBjaGFuZ2UgdGFiIHNpemVcblx0XHRcdG5ldyBOb3RlYm9va0luZGVudGF0aW9uVG9UYWJzQWN0aW9uKCksIC8vIGNvbnZlcnQgaW5kZW50YXRpb24gdG8gdGFic1xuXHRcdFx0bmV3IE5vdGVib29rSW5kZW50YXRpb25Ub1NwYWNlc0FjdGlvbigpIC8vIGNvbnZlcnQgaW5kZW50YXRpb24gdG8gc3BhY2VzXG5cdFx0XS5tYXAoaXRlbSA9PiB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRpZDogaXRlbS5kZXNjLmlkLFxuXHRcdFx0XHRsYWJlbDogaXRlbS5kZXNjLnRpdGxlLnRvU3RyaW5nKCksXG5cdFx0XHRcdHJ1bjogKCkgPT4ge1xuXHRcdFx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGl0ZW0ucnVuKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHR9KTtcblxuXHRcdHBpY2tzLnNwbGljZSgzLCAwLCB7IHR5cGU6ICdzZXBhcmF0b3InLCBsYWJlbDogbG9jYWxpemUoJ2luZGVudENvbnZlcnQnLCBcImNvbnZlcnQgZmlsZVwiKSB9KTtcblx0XHRwaWNrcy51bnNoaWZ0KHsgdHlwZTogJ3NlcGFyYXRvcicsIGxhYmVsOiBsb2NhbGl6ZSgnaW5kZW50VmlldycsIFwiY2hhbmdlIHZpZXdcIikgfSk7XG5cblx0XHRjb25zdCBhY3Rpb24gPSBhd2FpdCBxdWlja0lucHV0U2VydmljZS5waWNrKHBpY2tzLCB7IHBsYWNlSG9sZGVyOiBsb2NhbGl6ZSgncGlja0FjdGlvbicsIFwiU2VsZWN0IEFjdGlvblwiKSwgbWF0Y2hPbkRldGFpbDogdHJ1ZSB9KTtcblx0XHRpZiAoIWFjdGlvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRhY3Rpb24ucnVuKCk7XG5cdFx0Y29udGV4dC5ub3RlYm9va0VkaXRvci5mb2N1cygpO1xuXHRcdHJldHVybjtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBDb21tZW50U2VsZWN0ZWRDZWxsc0FjdGlvbiBleHRlbmRzIE5vdGVib29rTXVsdGlDZWxsQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IENPTU1FTlRfU0VMRUNURURfQ0VMTFNfSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ2NvbW1lbnRTZWxlY3RlZENlbGxzJywgXCJDb21tZW50IFNlbGVjdGVkIENlbGxzXCIpLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0Tk9URUJPT0tfRURJVE9SX0ZPQ1VTRUQsXG5cdFx0XHRcdFx0Tk9URUJPT0tfRURJVE9SX0VESVRBQkxFLFxuXHRcdFx0XHRcdENvbnRleHRLZXlFeHByLm5vdChJbnB1dEZvY3VzZWRDb250ZXh0S2V5KSxcblx0XHRcdFx0KSxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLlNsYXNoLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYlxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuV2l0aENvbnRleHQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGNvbnRleHQ6IElOb3RlYm9va0NvbW1hbmRDb250ZXh0KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cblx0XHRjb250ZXh0LnNlbGVjdGVkQ2VsbHMuZm9yRWFjaChhc3luYyBjZWxsVmlld01vZGVsID0+IHtcblx0XHRcdGNvbnN0IHRleHRNb2RlbCA9IGF3YWl0IGNlbGxWaWV3TW9kZWwucmVzb2x2ZVRleHRNb2RlbCgpO1xuXG5cdFx0XHRjb25zdCBjb21tZW50c09wdGlvbnMgPSBjZWxsVmlld01vZGVsLmNvbW1lbnRPcHRpb25zO1xuXHRcdFx0Y29uc3QgY2VsbENvbW1lbnRDb21tYW5kID0gbmV3IExpbmVDb21tZW50Q29tbWFuZChcblx0XHRcdFx0bGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCB0ZXh0TW9kZWwuZ2V0TGluZUNvdW50KCksIHRleHRNb2RlbC5nZXRMaW5lTWF4Q29sdW1uKHRleHRNb2RlbC5nZXRMaW5lQ291bnQoKSkpLCAvLyBjb21tZW50IHRoZSBlbnRpcmUgY2VsbFxuXHRcdFx0XHR0ZXh0TW9kZWwuZ2V0T3B0aW9ucygpLnRhYlNpemUsXG5cdFx0XHRcdFR5cGUuVG9nZ2xlLFxuXHRcdFx0XHRjb21tZW50c09wdGlvbnMuaW5zZXJ0U3BhY2UgPz8gdHJ1ZSxcblx0XHRcdFx0Y29tbWVudHNPcHRpb25zLmlnbm9yZUVtcHR5TGluZXMgPz8gdHJ1ZSxcblx0XHRcdFx0ZmFsc2Vcblx0XHRcdCk7XG5cblx0XHRcdC8vIHN0b3JlIGFueSBzZWxlY3Rpb25zIHRoYXQgYXJlIGluIHRoZSBjZWxsLCBhbGxvd3MgdGhlbSB0byBiZSBzaGlmdGVkIGJ5IGNvbW1lbnRzIGFuZCBwcmVzZXJ2ZWRcblx0XHRcdGNvbnN0IGNlbGxFZGl0b3JTZWxlY3Rpb25zID0gY2VsbFZpZXdNb2RlbC5nZXRTZWxlY3Rpb25zKCk7XG5cdFx0XHRjb25zdCBpbml0aWFsVHJhY2tlZFJhbmdlc0lEczogc3RyaW5nW10gPSBjZWxsRWRpdG9yU2VsZWN0aW9ucy5tYXAoc2VsZWN0aW9uID0+IHtcblx0XHRcdFx0cmV0dXJuIHRleHRNb2RlbC5fc2V0VHJhY2tlZFJhbmdlKG51bGwsIHNlbGVjdGlvbiwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXMpO1xuXHRcdFx0fSk7XG5cblx0XHRcdENvbW1hbmRFeGVjdXRvci5leGVjdXRlQ29tbWFuZHModGV4dE1vZGVsLCBjZWxsRWRpdG9yU2VsZWN0aW9ucywgW2NlbGxDb21tZW50Q29tbWFuZF0pO1xuXG5cdFx0XHRjb25zdCBuZXdUcmFja2VkU2VsZWN0aW9ucyA9IGluaXRpYWxUcmFja2VkUmFuZ2VzSURzLm1hcChpID0+IHtcblx0XHRcdFx0cmV0dXJuIHRleHRNb2RlbC5fZ2V0VHJhY2tlZFJhbmdlKGkpO1xuXHRcdFx0fSkuZmlsdGVyKHIgPT4gISFyKS5tYXAoKHJhbmdlLCkgPT4ge1xuXHRcdFx0XHRyZXR1cm4gbmV3IFNlbGVjdGlvbihyYW5nZS5zdGFydExpbmVOdW1iZXIsIHJhbmdlLnN0YXJ0Q29sdW1uLCByYW5nZS5lbmRMaW5lTnVtYmVyLCByYW5nZS5lbmRDb2x1bW4pO1xuXHRcdFx0fSk7XG5cdFx0XHRjZWxsVmlld01vZGVsLnNldFNlbGVjdGlvbnMobmV3VHJhY2tlZFNlbGVjdGlvbnMgPz8gW10pO1xuXHRcdH0pOyAvLyBlbmQgb2YgY2VsbHMgZm9yRWFjaFxuXHR9XG5cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxVQUFVLFNBQVMsY0FBYztBQUMxQyxTQUFTLGFBQWE7QUFDdEIsU0FBUyxXQUFXO0FBRXBCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMscUNBQXFDO0FBQzlDLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsb0JBQW9CLFlBQVk7QUFDekMsU0FBUyxVQUFVLGlCQUFpQjtBQUNwQyxTQUFTLFFBQVEsdUJBQXVCO0FBQ3hDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMscUJBQXFCLDhCQUE4QjtBQUM1RCxTQUE4QixzQkFBc0I7QUFDcEQsU0FBUyw2QkFBK0M7QUFDeEQsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyw0QkFBNEI7QUFDckMsU0FBUywwQkFBMEQ7QUFDbkUsU0FBUyw0QkFBNEI7QUFDckMsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyxrQkFBa0IsdUJBQXVCO0FBQ2xELFNBQVMsMEJBQTBCLDRCQUE0QixrQkFBK0Ysc0NBQXNDLGdCQUFnQixvQkFBb0IseUJBQXlCLDBCQUEwQiw0QkFBNEI7QUFDdlQsU0FBUyw4QkFBOEIsMkJBQTJCLHlCQUF5QixtQ0FBbUMsdUNBQXVDO0FBQ3JLLFNBQVMsc0JBQXNCLGVBQWUsc0JBQXNCLDJCQUEyQix1Q0FBdUM7QUFDdEksWUFBWSxXQUFXO0FBQ3ZCLFNBQVMsY0FBYyxVQUE4Qiw0QkFBNEIsdUJBQXVCO0FBQ3hHLFNBQVMsd0JBQXdCLDJCQUEyQiwrQkFBK0IsNEJBQTRCLGtDQUFrQyxvQkFBb0IsMEJBQTBCLHlCQUF5QixzQkFBc0IsMkJBQTJCLHlCQUF5QiwrQkFBK0IsK0NBQStDO0FB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
