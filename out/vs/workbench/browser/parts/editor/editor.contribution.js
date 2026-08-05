import { Registry } from "../../../../platform/registry/common/platform.js";
import { localize, localize2 } from "../../../../nls.js";
import { EditorPaneDescriptor } from "../../editor.js";
import { EditorExtensions } from "../../../common/editor.js";
import {
  TextCompareEditorActiveContext,
  ActiveEditorPinnedContext,
  EditorGroupEditorsCountContext,
  ActiveEditorStickyContext,
  ActiveEditorAvailableEditorIdsContext,
  EditorPartMultipleEditorGroupsContext,
  ActiveEditorDirtyContext,
  ActiveEditorGroupLockedContext,
  ActiveEditorCanSplitInGroupContext,
  SideBySideEditorActiveContext,
  EditorTabsVisibleContext,
  ActiveEditorLastInGroupContext,
  EditorPartMaximizedEditorGroupContext,
  MultipleEditorGroupsContext,
  InEditorZenModeContext,
  IsAuxiliaryEditorPartContext,
  ActiveCompareEditorCanSwapContext,
  MultipleEditorsSelectedInGroupContext
} from "../../../common/contextkeys.js";
import { SideBySideEditorInput, SideBySideEditorInputSerializer } from "../../../common/editor/sideBySideEditorInput.js";
import { TextResourceEditor } from "./textResourceEditor.js";
import { SideBySideEditor } from "./sideBySideEditor.js";
import { DiffEditorInput, DiffEditorInputSerializer } from "../../../common/editor/diffEditorInput.js";
import { UntitledTextEditorInput } from "../../../services/untitled/common/untitledTextEditorInput.js";
import { TextResourceEditorInput } from "../../../common/editor/textResourceEditorInput.js";
import { TextDiffEditor } from "./textDiffEditor.js";
import { BinaryResourceDiffEditor } from "./binaryDiffEditor.js";
import { ChangeEncodingAction, ChangeEOLAction, ChangeLanguageAction, EditorStatusContribution } from "./editorStatus.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { MenuRegistry, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { KeyMod, KeyCode } from "../../../../base/common/keyCodes.js";
import {
  CloseEditorsInOtherGroupsAction,
  CloseAllEditorsAction,
  MoveGroupLeftAction,
  MoveGroupRightAction,
  SplitEditorAction,
  JoinTwoGroupsAction,
  RevertAndCloseEditorAction,
  NavigateBetweenGroupsAction,
  FocusActiveGroupAction,
  FocusFirstGroupAction,
  ResetGroupSizesAction,
  MinimizeOtherGroupsAction,
  FocusPreviousGroup,
  FocusNextGroup,
  CloseLeftEditorsInGroupAction,
  OpenNextEditor,
  OpenPreviousEditor,
  NavigateBackwardsAction,
  NavigateForwardAction,
  NavigatePreviousAction,
  ReopenClosedEditorAction,
  QuickAccessPreviousRecentlyUsedEditorInGroupAction,
  QuickAccessPreviousEditorFromHistoryAction,
  ShowAllEditorsByAppearanceAction,
  ClearEditorHistoryAction,
  MoveEditorRightInGroupAction,
  OpenNextEditorInGroup,
  OpenPreviousEditorInGroup,
  OpenNextRecentlyUsedEditorAction,
  OpenPreviousRecentlyUsedEditorAction,
  MoveEditorToPreviousGroupAction,
  MoveEditorToNextGroupAction,
  MoveEditorToFirstGroupAction,
  MoveEditorLeftInGroupAction,
  ClearRecentFilesAction,
  OpenLastEditorInGroup,
  ShowEditorsInActiveGroupByMostRecentlyUsedAction,
  MoveEditorToLastGroupAction,
  OpenFirstEditorInGroup,
  MoveGroupUpAction,
  MoveGroupDownAction,
  FocusLastGroupAction,
  SplitEditorLeftAction,
  SplitEditorRightAction,
  SplitEditorUpAction,
  SplitEditorDownAction,
  MoveEditorToLeftGroupAction,
  MoveEditorToRightGroupAction,
  MoveEditorToAboveGroupAction,
  MoveEditorToBelowGroupAction,
  CloseAllEditorGroupsAction,
  JoinAllGroupsAction,
  FocusLeftGroup,
  FocusAboveGroup,
  FocusRightGroup,
  FocusBelowGroup,
  EditorLayoutSingleAction,
  EditorLayoutTwoColumnsAction,
  EditorLayoutThreeColumnsAction,
  EditorLayoutTwoByTwoGridAction,
  EditorLayoutTwoRowsAction,
  EditorLayoutThreeRowsAction,
  EditorLayoutTwoColumnsBottomAction,
  EditorLayoutTwoRowsRightAction,
  NewEditorGroupLeftAction,
  NewEditorGroupRightAction,
  NewEditorGroupAboveAction,
  NewEditorGroupBelowAction,
  SplitEditorOrthogonalAction,
  CloseEditorInAllGroupsAction,
  NavigateToLastEditLocationAction,
  ToggleGroupSizesAction,
  ShowAllEditorsByMostRecentlyUsedAction,
  QuickAccessPreviousRecentlyUsedEditorAction,
  OpenPreviousRecentlyUsedEditorInGroupAction,
  OpenNextRecentlyUsedEditorInGroupAction,
  QuickAccessLeastRecentlyUsedEditorAction,
  QuickAccessLeastRecentlyUsedEditorInGroupAction,
  ReOpenInTextEditorAction,
  DuplicateGroupDownAction,
  DuplicateGroupLeftAction,
  DuplicateGroupRightAction,
  DuplicateGroupUpAction,
  ToggleEditorTypeAction,
  SplitEditorToAboveGroupAction,
  SplitEditorToBelowGroupAction,
  SplitEditorToFirstGroupAction,
  SplitEditorToLastGroupAction,
  SplitEditorToLeftGroupAction,
  SplitEditorToNextGroupAction,
  SplitEditorToPreviousGroupAction,
  SplitEditorToRightGroupAction,
  NavigateForwardInEditsAction,
  NavigateBackwardsInEditsAction,
  NavigateForwardInNavigationsAction,
  NavigateBackwardsInNavigationsAction,
  NavigatePreviousInNavigationsAction,
  NavigatePreviousInEditsAction,
  NavigateToLastNavigationLocationAction,
  MaximizeGroupHideSidebarAction,
  MoveEditorToNewWindowAction,
  CopyEditorToNewindowAction,
  RestoreEditorsToMainWindowAction,
  ToggleMaximizeEditorGroupAction,
  MinimizeOtherGroupsHideSidebarAction,
  CopyEditorGroupToNewWindowAction,
  MoveEditorGroupToNewWindowAction,
  NewEmptyEditorWindowAction
} from "./editorActions.js";
import {
  CLOSE_EDITORS_AND_GROUP_COMMAND_ID,
  CLOSE_EDITORS_IN_GROUP_COMMAND_ID,
  CLOSE_EDITORS_TO_THE_RIGHT_COMMAND_ID,
  CLOSE_EDITOR_COMMAND_ID,
  CLOSE_EDITOR_GROUP_COMMAND_ID,
  CLOSE_OTHER_EDITORS_IN_GROUP_COMMAND_ID,
  CLOSE_PINNED_EDITOR_COMMAND_ID,
  CLOSE_SAVED_EDITORS_COMMAND_ID,
  KEEP_EDITOR_COMMAND_ID,
  PIN_EDITOR_COMMAND_ID,
  SHOW_EDITORS_IN_GROUP,
  SPLIT_EDITOR_DOWN,
  SPLIT_EDITOR_LEFT,
  SPLIT_EDITOR_RIGHT,
  SPLIT_EDITOR_UP,
  TOGGLE_KEEP_EDITORS_COMMAND_ID,
  UNPIN_EDITOR_COMMAND_ID,
  setup as registerEditorCommands,
  REOPEN_WITH_COMMAND_ID,
  TOGGLE_LOCK_GROUP_COMMAND_ID,
  UNLOCK_GROUP_COMMAND_ID,
  SPLIT_EDITOR_IN_GROUP,
  JOIN_EDITOR_IN_GROUP,
  FOCUS_FIRST_SIDE_EDITOR,
  FOCUS_SECOND_SIDE_EDITOR,
  TOGGLE_SPLIT_EDITOR_IN_GROUP_LAYOUT,
  LOCK_GROUP_COMMAND_ID,
  SPLIT_EDITOR,
  TOGGLE_MAXIMIZE_EDITOR_GROUP,
  MOVE_EDITOR_INTO_NEW_WINDOW_COMMAND_ID,
  COPY_EDITOR_INTO_NEW_WINDOW_COMMAND_ID,
  MOVE_EDITOR_GROUP_INTO_NEW_WINDOW_COMMAND_ID,
  COPY_EDITOR_GROUP_INTO_NEW_WINDOW_COMMAND_ID,
  NEW_EMPTY_EDITOR_WINDOW_COMMAND_ID
} from "./editorCommands.js";
import { GOTO_NEXT_CHANGE, GOTO_PREVIOUS_CHANGE, TOGGLE_DIFF_IGNORE_TRIM_WHITESPACE, TOGGLE_DIFF_SIDE_BY_SIDE, DIFF_SWAP_SIDES } from "./diffEditorCommands.js";
import { inQuickPickContext, getQuickNavigateHandler } from "../../quickaccess.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { isMacintosh } from "../../../../base/common/platform.js";
import { EditorContributionInstantiation, registerEditorContribution } from "../../../../editor/browser/editorExtensions.js";
import { FloatingEditorClickMenu } from "../../codeeditor.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { EditorAutoSave } from "./editorAutoSave.js";
import { Extensions as QuickAccessExtensions } from "../../../../platform/quickinput/common/quickAccess.js";
import { ActiveGroupEditorsByMostRecentlyUsedQuickAccess, AllEditorsByAppearanceQuickAccess, AllEditorsByMostRecentlyUsedQuickAccess } from "./editorQuickAccess.js";
import { FileAccess } from "../../../../base/common/network.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { UntitledTextEditorInputSerializer, UntitledTextEditorWorkingCopyEditorHandler } from "../../../services/untitled/common/untitledTextEditorHandler.js";
import { DynamicEditorConfigurations } from "./editorConfiguration.js";
import { ConfigureEditorAction, ConfigureEditorTabsAction, EditorActionsDefaultAction, EditorActionsTitleBarAction, HideEditorActionsAction, HideEditorTabsAction, ShowMultipleEditorTabsAction, ShowSingleEditorTabAction, ZenHideEditorTabsAction, ZenShowMultipleEditorTabsAction, ZenShowSingleEditorTabAction } from "../../actions/layoutActions.js";
import { EditorContextKeys } from "../../../../editor/common/editorContextKeys.js";
import { getFontSnippets } from "../../../../base/browser/fonts.js";
import { registerEditorFontConfigurations } from "../../../../editor/common/config/editorConfigurationSchema.js";
Registry.as(EditorExtensions.EditorPane).registerEditorPane(
  EditorPaneDescriptor.create(
    TextResourceEditor,
    TextResourceEditor.ID,
    localize("textEditor", "Text Editor")
  ),
  [
    new SyncDescriptor(UntitledTextEditorInput),
    new SyncDescriptor(TextResourceEditorInput)
  ]
);
Registry.as(EditorExtensions.EditorPane).registerEditorPane(
  EditorPaneDescriptor.create(
    TextDiffEditor,
    TextDiffEditor.ID,
    localize("textDiffEditor", "Text Diff Editor")
  ),
  [
    new SyncDescriptor(DiffEditorInput)
  ]
);
Registry.as(EditorExtensions.EditorPane).registerEditorPane(
  EditorPaneDescriptor.create(
    BinaryResourceDiffEditor,
    BinaryResourceDiffEditor.ID,
    localize("binaryDiffEditor", "Binary Diff Editor")
  ),
  [
    new SyncDescriptor(DiffEditorInput)
  ]
);
Registry.as(EditorExtensions.EditorPane).registerEditorPane(
  EditorPaneDescriptor.create(
    SideBySideEditor,
    SideBySideEditor.ID,
    localize("sideBySideEditor", "Side by Side Editor")
  ),
  [
    new SyncDescriptor(SideBySideEditorInput)
  ]
);
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(UntitledTextEditorInput.ID, UntitledTextEditorInputSerializer);
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(SideBySideEditorInput.ID, SideBySideEditorInputSerializer);
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(DiffEditorInput.ID, DiffEditorInputSerializer);
registerWorkbenchContribution2(EditorAutoSave.ID, EditorAutoSave, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(EditorStatusContribution.ID, EditorStatusContribution, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(UntitledTextEditorWorkingCopyEditorHandler.ID, UntitledTextEditorWorkingCopyEditorHandler, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(DynamicEditorConfigurations.ID, DynamicEditorConfigurations, WorkbenchPhase.BlockRestore);
registerEditorContribution(FloatingEditorClickMenu.ID, FloatingEditorClickMenu, EditorContributionInstantiation.AfterFirstRender);
const quickAccessRegistry = Registry.as(QuickAccessExtensions.Quickaccess);
const editorPickerContextKey = "inEditorsPicker";
const editorPickerContext = ContextKeyExpr.and(inQuickPickContext, ContextKeyExpr.has(editorPickerContextKey));
quickAccessRegistry.registerQuickAccessProvider({
  ctor: ActiveGroupEditorsByMostRecentlyUsedQuickAccess,
  prefix: ActiveGroupEditorsByMostRecentlyUsedQuickAccess.PREFIX,
  contextKey: editorPickerContextKey,
  placeholder: localize("editorQuickAccessPlaceholder", "Type the name of an editor to open it."),
  helpEntries: [{ description: localize("activeGroupEditorsByMostRecentlyUsedQuickAccess", "Show Editors in Active Group by Most Recently Used"), commandId: ShowEditorsInActiveGroupByMostRecentlyUsedAction.ID }]
});
quickAccessRegistry.registerQuickAccessProvider({
  ctor: AllEditorsByAppearanceQuickAccess,
  prefix: AllEditorsByAppearanceQuickAccess.PREFIX,
  contextKey: editorPickerContextKey,
  placeholder: localize("editorQuickAccessPlaceholder", "Type the name of an editor to open it."),
  helpEntries: [{ description: localize("allEditorsByAppearanceQuickAccess", "Show All Opened Editors By Appearance"), commandId: ShowAllEditorsByAppearanceAction.ID }]
});
quickAccessRegistry.registerQuickAccessProvider({
  ctor: AllEditorsByMostRecentlyUsedQuickAccess,
  prefix: AllEditorsByMostRecentlyUsedQuickAccess.PREFIX,
  contextKey: editorPickerContextKey,
  placeholder: localize("editorQuickAccessPlaceholder", "Type the name of an editor to open it."),
  helpEntries: [{ description: localize("allEditorsByMostRecentlyUsedQuickAccess", "Show All Opened Editors By Most Recently Used"), commandId: ShowAllEditorsByMostRecentlyUsedAction.ID }]
});
registerAction2(ChangeLanguageAction);
registerAction2(ChangeEOLAction);
registerAction2(ChangeEncodingAction);
registerAction2(NavigateForwardAction);
registerAction2(NavigateBackwardsAction);
registerAction2(OpenNextEditor);
registerAction2(OpenPreviousEditor);
registerAction2(OpenNextEditorInGroup);
registerAction2(OpenPreviousEditorInGroup);
registerAction2(OpenFirstEditorInGroup);
registerAction2(OpenLastEditorInGroup);
registerAction2(OpenNextRecentlyUsedEditorAction);
registerAction2(OpenPreviousRecentlyUsedEditorAction);
registerAction2(OpenNextRecentlyUsedEditorInGroupAction);
registerAction2(OpenPreviousRecentlyUsedEditorInGroupAction);
registerAction2(ReopenClosedEditorAction);
registerAction2(ClearRecentFilesAction);
registerAction2(ShowAllEditorsByAppearanceAction);
registerAction2(ShowAllEditorsByMostRecentlyUsedAction);
registerAction2(ShowEditorsInActiveGroupByMostRecentlyUsedAction);
registerAction2(CloseAllEditorsAction);
registerAction2(CloseAllEditorGroupsAction);
registerAction2(CloseLeftEditorsInGroupAction);
registerAction2(CloseEditorsInOtherGroupsAction);
registerAction2(CloseEditorInAllGroupsAction);
registerAction2(RevertAndCloseEditorAction);
registerAction2(SplitEditorAction);
registerAction2(SplitEditorOrthogonalAction);
registerAction2(SplitEditorLeftAction);
registerAction2(SplitEditorRightAction);
registerAction2(SplitEditorUpAction);
registerAction2(SplitEditorDownAction);
registerAction2(JoinTwoGroupsAction);
registerAction2(JoinAllGroupsAction);
registerAction2(NavigateBetweenGroupsAction);
registerAction2(ResetGroupSizesAction);
registerAction2(ToggleGroupSizesAction);
registerAction2(MaximizeGroupHideSidebarAction);
registerAction2(ToggleMaximizeEditorGroupAction);
registerAction2(MinimizeOtherGroupsAction);
registerAction2(MinimizeOtherGroupsHideSidebarAction);
registerAction2(MoveEditorLeftInGroupAction);
registerAction2(MoveEditorRightInGroupAction);
registerAction2(MoveGroupLeftAction);
registerAction2(MoveGroupRightAction);
registerAction2(MoveGroupUpAction);
registerAction2(MoveGroupDownAction);
registerAction2(DuplicateGroupLeftAction);
registerAction2(DuplicateGroupRightAction);
registerAction2(DuplicateGroupUpAction);
registerAction2(DuplicateGroupDownAction);
registerAction2(MoveEditorToPreviousGroupAction);
registerAction2(MoveEditorToNextGroupAction);
registerAction2(MoveEditorToFirstGroupAction);
registerAction2(MoveEditorToLastGroupAction);
registerAction2(MoveEditorToLeftGroupAction);
registerAction2(MoveEditorToRightGroupAction);
registerAction2(MoveEditorToAboveGroupAction);
registerAction2(MoveEditorToBelowGroupAction);
registerAction2(SplitEditorToPreviousGroupAction);
registerAction2(SplitEditorToNextGroupAction);
registerAction2(SplitEditorToFirstGroupAction);
registerAction2(SplitEditorToLastGroupAction);
registerAction2(SplitEditorToLeftGroupAction);
registerAction2(SplitEditorToRightGroupAction);
registerAction2(SplitEditorToAboveGroupAction);
registerAction2(SplitEditorToBelowGroupAction);
registerAction2(FocusActiveGroupAction);
registerAction2(FocusFirstGroupAction);
registerAction2(FocusLastGroupAction);
registerAction2(FocusPreviousGroup);
registerAction2(FocusNextGroup);
registerAction2(FocusLeftGroup);
registerAction2(FocusRightGroup);
registerAction2(FocusAboveGroup);
registerAction2(FocusBelowGroup);
registerAction2(NewEditorGroupLeftAction);
registerAction2(NewEditorGroupRightAction);
registerAction2(NewEditorGroupAboveAction);
registerAction2(NewEditorGroupBelowAction);
registerAction2(NavigatePreviousAction);
registerAction2(NavigateForwardInEditsAction);
registerAction2(NavigateBackwardsInEditsAction);
registerAction2(NavigatePreviousInEditsAction);
registerAction2(NavigateToLastEditLocationAction);
registerAction2(NavigateForwardInNavigationsAction);
registerAction2(NavigateBackwardsInNavigationsAction);
registerAction2(NavigatePreviousInNavigationsAction);
registerAction2(NavigateToLastNavigationLocationAction);
registerAction2(ClearEditorHistoryAction);
registerAction2(EditorLayoutSingleAction);
registerAction2(EditorLayoutTwoColumnsAction);
registerAction2(EditorLayoutThreeColumnsAction);
registerAction2(EditorLayoutTwoRowsAction);
registerAction2(EditorLayoutThreeRowsAction);
registerAction2(EditorLayoutTwoByTwoGridAction);
registerAction2(EditorLayoutTwoRowsRightAction);
registerAction2(EditorLayoutTwoColumnsBottomAction);
registerAction2(ToggleEditorTypeAction);
registerAction2(ReOpenInTextEditorAction);
registerAction2(QuickAccessPreviousRecentlyUsedEditorAction);
registerAction2(QuickAccessLeastRecentlyUsedEditorAction);
registerAction2(QuickAccessPreviousRecentlyUsedEditorInGroupAction);
registerAction2(QuickAccessLeastRecentlyUsedEditorInGroupAction);
registerAction2(QuickAccessPreviousEditorFromHistoryAction);
registerAction2(MoveEditorToNewWindowAction);
registerAction2(CopyEditorToNewindowAction);
registerAction2(MoveEditorGroupToNewWindowAction);
registerAction2(CopyEditorGroupToNewWindowAction);
registerAction2(RestoreEditorsToMainWindowAction);
registerAction2(NewEmptyEditorWindowAction);
const quickAccessNavigateNextInEditorPickerId = "workbench.action.quickOpenNavigateNextInEditorPicker";
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: quickAccessNavigateNextInEditorPickerId,
  weight: KeybindingWeight.WorkbenchContrib + 50,
  handler: getQuickNavigateHandler(quickAccessNavigateNextInEditorPickerId, true),
  when: editorPickerContext,
  primary: KeyMod.CtrlCmd | KeyCode.Tab,
  mac: { primary: KeyMod.WinCtrl | KeyCode.Tab }
});
const quickAccessNavigatePreviousInEditorPickerId = "workbench.action.quickOpenNavigatePreviousInEditorPicker";
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: quickAccessNavigatePreviousInEditorPickerId,
  weight: KeybindingWeight.WorkbenchContrib + 50,
  handler: getQuickNavigateHandler(quickAccessNavigatePreviousInEditorPickerId, false),
  when: editorPickerContext,
  primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Tab,
  mac: { primary: KeyMod.WinCtrl | KeyMod.Shift | KeyCode.Tab }
});
registerEditorCommands();
if (isMacintosh) {
  MenuRegistry.appendMenuItem(MenuId.TouchBarContext, {
    command: { id: NavigateBackwardsAction.ID, title: NavigateBackwardsAction.LABEL, icon: { dark: FileAccess.asFileUri("vs/workbench/browser/parts/editor/media/back-tb.png") } },
    group: "navigation",
    order: 0
  });
  MenuRegistry.appendMenuItem(MenuId.TouchBarContext, {
    command: { id: NavigateForwardAction.ID, title: NavigateForwardAction.LABEL, icon: { dark: FileAccess.asFileUri("vs/workbench/browser/parts/editor/media/forward-tb.png") } },
    group: "navigation",
    order: 1
  });
}
MenuRegistry.appendMenuItem(MenuId.EmptyEditorGroup, { command: { id: LOCK_GROUP_COMMAND_ID, title: localize("lockGroupAction", "Lock Group"), icon: Codicon.unlock }, group: "navigation", order: 10, when: ContextKeyExpr.and(IsAuxiliaryEditorPartContext, ActiveEditorGroupLockedContext.toNegated()) });
MenuRegistry.appendMenuItem(MenuId.EmptyEditorGroup, { command: { id: UNLOCK_GROUP_COMMAND_ID, title: localize("unlockGroupAction", "Unlock Group"), icon: Codicon.lock, toggled: ContextKeyExpr.true() }, group: "navigation", order: 10, when: ActiveEditorGroupLockedContext });
MenuRegistry.appendMenuItem(MenuId.EmptyEditorGroup, { command: { id: CLOSE_EDITOR_GROUP_COMMAND_ID, title: localize("closeGroupAction", "Close Group"), icon: Codicon.close }, group: "navigation", order: 20, when: ContextKeyExpr.or(IsAuxiliaryEditorPartContext, EditorPartMultipleEditorGroupsContext) });
MenuRegistry.appendMenuItem(MenuId.EmptyEditorGroupContext, { command: { id: SPLIT_EDITOR_UP, title: localize("splitUp", "Split Up") }, group: "2_split", order: 10 });
MenuRegistry.appendMenuItem(MenuId.EmptyEditorGroupContext, { command: { id: SPLIT_EDITOR_DOWN, title: localize("splitDown", "Split Down") }, group: "2_split", order: 20 });
MenuRegistry.appendMenuItem(MenuId.EmptyEditorGroupContext, { command: { id: SPLIT_EDITOR_LEFT, title: localize("splitLeft", "Split Left") }, group: "2_split", order: 30 });
MenuRegistry.appendMenuItem(MenuId.EmptyEditorGroupContext, { command: { id: SPLIT_EDITOR_RIGHT, title: localize("splitRight", "Split Right") }, group: "2_split", order: 40 });
MenuRegistry.appendMenuItem(MenuId.EmptyEditorGroupContext, { command: { id: NEW_EMPTY_EDITOR_WINDOW_COMMAND_ID, title: localize("newWindow", "New Window") }, group: "3_window", order: 10 });
MenuRegistry.appendMenuItem(MenuId.EmptyEditorGroupContext, {
  command: { id: TOGGLE_LOCK_GROUP_COMMAND_ID, title: localize("toggleLockGroup", "Lock Group"), toggled: ActiveEditorGroupLockedContext },
  group: "4_lock",
  order: 10,
  when: IsAuxiliaryEditorPartContext.toNegated()
  /* already a primary action for aux windows */
});
MenuRegistry.appendMenuItem(MenuId.EmptyEditorGroupContext, { command: { id: CLOSE_EDITOR_GROUP_COMMAND_ID, title: localize("close", "Close") }, group: "5_close", order: 10, when: MultipleEditorGroupsContext });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarContext, { command: { id: SPLIT_EDITOR_UP, title: localize("splitUp", "Split Up") }, group: "2_split", order: 10 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarContext, { command: { id: SPLIT_EDITOR_DOWN, title: localize("splitDown", "Split Down") }, group: "2_split", order: 20 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarContext, { command: { id: SPLIT_EDITOR_LEFT, title: localize("splitLeft", "Split Left") }, group: "2_split", order: 30 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarContext, { command: { id: SPLIT_EDITOR_RIGHT, title: localize("splitRight", "Split Right") }, group: "2_split", order: 40 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarContext, { command: { id: MOVE_EDITOR_GROUP_INTO_NEW_WINDOW_COMMAND_ID, title: localize("moveEditorGroupToNewWindow", "Move into New Window") }, group: "3_window", order: 10 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarContext, { command: { id: COPY_EDITOR_GROUP_INTO_NEW_WINDOW_COMMAND_ID, title: localize("copyEditorGroupToNewWindow", "Copy into New Window") }, group: "3_window", order: 20 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarContext, { submenu: MenuId.EditorTabsBarShowTabsSubmenu, title: localize("tabBar", "Tab Bar"), group: "4_config", order: 10, when: InEditorZenModeContext.negate() });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarShowTabsSubmenu, { command: { id: ShowMultipleEditorTabsAction.ID, title: localize("multipleTabs", "Multiple Tabs"), toggled: ContextKeyExpr.equals("config.workbench.editor.showTabs", "multiple") }, group: "1_config", order: 10 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarShowTabsSubmenu, { command: { id: ShowSingleEditorTabAction.ID, title: localize("singleTab", "Single Tab"), toggled: ContextKeyExpr.equals("config.workbench.editor.showTabs", "single") }, group: "1_config", order: 20 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarShowTabsSubmenu, { command: { id: HideEditorTabsAction.ID, title: localize("hideTabs", "Hidden"), toggled: ContextKeyExpr.equals("config.workbench.editor.showTabs", "none") }, group: "1_config", order: 30 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarContext, { submenu: MenuId.EditorTabsBarShowTabsZenModeSubmenu, title: localize("tabBar", "Tab Bar"), group: "4_config", order: 10, when: InEditorZenModeContext });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarShowTabsZenModeSubmenu, { command: { id: ZenShowMultipleEditorTabsAction.ID, title: localize("multipleTabs", "Multiple Tabs"), toggled: ContextKeyExpr.equals("config.zenMode.showTabs", "multiple") }, group: "1_config", order: 10 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarShowTabsZenModeSubmenu, { command: { id: ZenShowSingleEditorTabAction.ID, title: localize("singleTab", "Single Tab"), toggled: ContextKeyExpr.equals("config.zenMode.showTabs", "single") }, group: "1_config", order: 20 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarShowTabsZenModeSubmenu, { command: { id: ZenHideEditorTabsAction.ID, title: localize("hideTabs", "Hidden"), toggled: ContextKeyExpr.equals("config.zenMode.showTabs", "none") }, group: "1_config", order: 30 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarContext, { submenu: MenuId.EditorActionsPositionSubmenu, title: localize("editorActionsPosition", "Editor Actions Position"), group: "4_config", order: 20 });
MenuRegistry.appendMenuItem(MenuId.EditorActionsPositionSubmenu, { command: { id: EditorActionsDefaultAction.ID, title: localize("tabBar", "Tab Bar"), toggled: ContextKeyExpr.equals("config.workbench.editor.editorActionsLocation", "default") }, group: "1_config", order: 10, when: ContextKeyExpr.equals("config.workbench.editor.showTabs", "none").negate() });
MenuRegistry.appendMenuItem(MenuId.EditorActionsPositionSubmenu, { command: { id: EditorActionsTitleBarAction.ID, title: localize("titleBar", "Title Bar"), toggled: ContextKeyExpr.or(ContextKeyExpr.equals("config.workbench.editor.editorActionsLocation", "titleBar"), ContextKeyExpr.and(ContextKeyExpr.equals("config.workbench.editor.showTabs", "none"), ContextKeyExpr.equals("config.workbench.editor.editorActionsLocation", "default"))) }, group: "1_config", order: 20 });
MenuRegistry.appendMenuItem(MenuId.EditorActionsPositionSubmenu, { command: { id: HideEditorActionsAction.ID, title: localize("hidden", "Hidden"), toggled: ContextKeyExpr.equals("config.workbench.editor.editorActionsLocation", "hidden") }, group: "1_config", order: 30 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarContext, { command: { id: ConfigureEditorTabsAction.ID, title: localize("configureTabs", "Configure Tabs") }, group: "9_configure", order: 10 });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: CLOSE_EDITOR_COMMAND_ID, title: localize("close", "Close") }, group: "1_close", order: 10 });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: CLOSE_OTHER_EDITORS_IN_GROUP_COMMAND_ID, title: localize("closeOthers", "Close Others"), precondition: EditorGroupEditorsCountContext.notEqualsTo("1") }, group: "1_close", order: 20 });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: CLOSE_EDITORS_TO_THE_RIGHT_COMMAND_ID, title: localize("closeRight", "Close to the Right"), precondition: ContextKeyExpr.and(ActiveEditorLastInGroupContext.toNegated(), MultipleEditorsSelectedInGroupContext.negate()) }, group: "1_close", order: 30, when: EditorTabsVisibleContext });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: CLOSE_SAVED_EDITORS_COMMAND_ID, title: localize("closeAllSaved", "Close Saved") }, group: "1_close", order: 40 });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: CLOSE_EDITORS_IN_GROUP_COMMAND_ID, title: localize("closeAll", "Close All") }, group: "1_close", order: 50 });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: REOPEN_WITH_COMMAND_ID, title: localize("reopenWith", "Reopen Editor With...") }, group: "1_open", order: 10, when: ActiveEditorAvailableEditorIdsContext });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: KEEP_EDITOR_COMMAND_ID, title: localize("keepOpen", "Keep Open"), precondition: ActiveEditorPinnedContext.toNegated() }, group: "3_preview", order: 10, when: ContextKeyExpr.has("config.workbench.editor.enablePreview") });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: PIN_EDITOR_COMMAND_ID, title: localize("pin", "Pin") }, group: "3_preview", order: 20, when: ActiveEditorStickyContext.toNegated() });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: UNPIN_EDITOR_COMMAND_ID, title: localize("unpin", "Unpin") }, group: "3_preview", order: 20, when: ActiveEditorStickyContext });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: SPLIT_EDITOR_UP, title: localize("splitUp", "Split Up") }, group: "5_split", order: 10 });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: SPLIT_EDITOR_DOWN, title: localize("splitDown", "Split Down") }, group: "5_split", order: 20 });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: SPLIT_EDITOR_LEFT, title: localize("splitLeft", "Split Left") }, group: "5_split", order: 30 });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: SPLIT_EDITOR_RIGHT, title: localize("splitRight", "Split Right") }, group: "5_split", order: 40 });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: SPLIT_EDITOR_IN_GROUP, title: localize("splitInGroup", "Split in Group"), precondition: MultipleEditorsSelectedInGroupContext.negate() }, group: "6_split_in_group", order: 10, when: ActiveEditorCanSplitInGroupContext });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: JOIN_EDITOR_IN_GROUP, title: localize("joinInGroup", "Join in Group"), precondition: MultipleEditorsSelectedInGroupContext.negate() }, group: "6_split_in_group", order: 10, when: SideBySideEditorActiveContext });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: MOVE_EDITOR_INTO_NEW_WINDOW_COMMAND_ID, title: localize("moveToNewWindow", "Move into New Window") }, group: "7_new_window", order: 10 });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: COPY_EDITOR_INTO_NEW_WINDOW_COMMAND_ID, title: localize("copyToNewWindow", "Copy into New Window") }, group: "7_new_window", order: 20 });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { submenu: MenuId.EditorTitleContextShare, title: localize("share", "Share"), group: "11_share", order: -1, when: MultipleEditorsSelectedInGroupContext.negate() });
MenuRegistry.appendMenuItem(MenuId.EditorTitle, { command: { id: TOGGLE_DIFF_SIDE_BY_SIDE, title: localize("inlineView", "Inline View"), toggled: ContextKeyExpr.equals("config.diffEditor.renderSideBySide", false) }, group: "1_diff", order: 10, when: ContextKeyExpr.has("isInDiffEditor") });
MenuRegistry.appendMenuItem(MenuId.EditorTitle, { command: { id: SHOW_EDITORS_IN_GROUP, title: localize("showOpenedEditors", "Show Opened Editors") }, group: "3_open", order: 10 });
MenuRegistry.appendMenuItem(MenuId.EditorTitle, { command: { id: CLOSE_EDITORS_IN_GROUP_COMMAND_ID, title: localize("closeAll", "Close All") }, group: "5_close", order: 10 });
MenuRegistry.appendMenuItem(MenuId.EditorTitle, { command: { id: CLOSE_SAVED_EDITORS_COMMAND_ID, title: localize("closeAllSaved", "Close Saved") }, group: "5_close", order: 20 });
MenuRegistry.appendMenuItem(MenuId.EditorTitle, { command: { id: TOGGLE_KEEP_EDITORS_COMMAND_ID, title: localize("togglePreviewMode", "Enable Preview Editors"), toggled: ContextKeyExpr.has("config.workbench.editor.enablePreview") }, group: "7_settings", order: 10 });
MenuRegistry.appendMenuItem(MenuId.EditorTitle, { command: { id: TOGGLE_MAXIMIZE_EDITOR_GROUP, title: localize("maximizeGroup", "Maximize Group") }, group: "8_group_operations", order: 5, when: ContextKeyExpr.and(EditorPartMaximizedEditorGroupContext.negate(), EditorPartMultipleEditorGroupsContext) });
MenuRegistry.appendMenuItem(MenuId.EditorTitle, { command: { id: TOGGLE_MAXIMIZE_EDITOR_GROUP, title: localize("unmaximizeGroup", "Unmaximize Group") }, group: "8_group_operations", order: 5, when: EditorPartMaximizedEditorGroupContext });
MenuRegistry.appendMenuItem(MenuId.EditorTitle, {
  command: { id: TOGGLE_LOCK_GROUP_COMMAND_ID, title: localize("lockGroup", "Lock Group"), toggled: ActiveEditorGroupLockedContext },
  group: "8_group_operations",
  order: 10,
  when: IsAuxiliaryEditorPartContext.toNegated()
  /* already a primary action for aux windows */
});
MenuRegistry.appendMenuItem(MenuId.EditorTitle, { command: { id: ConfigureEditorAction.ID, title: localize("configureEditors", "Configure Editors") }, group: "9_configure", order: 10 });
function appendEditorToolItem(primary, when, order, alternative, precondition) {
  const item = {
    command: {
      id: primary.id,
      title: primary.title,
      icon: primary.icon,
      toggled: primary.toggled,
      precondition
    },
    group: "navigation",
    when,
    order
  };
  if (alternative) {
    item.alt = {
      id: alternative.id,
      title: alternative.title,
      icon: alternative.icon
    };
  }
  MenuRegistry.appendMenuItem(MenuId.EditorTitle, item);
}
const SPLIT_ORDER = 1e5;
const CLOSE_ORDER = 1e6;
appendEditorToolItem(
  {
    id: SPLIT_EDITOR,
    title: localize("splitEditorRight", "Split Editor Right"),
    icon: Codicon.splitHorizontal
  },
  ContextKeyExpr.not("splitEditorsVertically"),
  SPLIT_ORDER,
  {
    id: SPLIT_EDITOR_DOWN,
    title: localize("splitEditorDown", "Split Editor Down"),
    icon: Codicon.splitVertical
  }
);
appendEditorToolItem(
  {
    id: SPLIT_EDITOR,
    title: localize("splitEditorDown", "Split Editor Down"),
    icon: Codicon.splitVertical
  },
  ContextKeyExpr.has("splitEditorsVertically"),
  SPLIT_ORDER,
  {
    id: SPLIT_EDITOR_RIGHT,
    title: localize("splitEditorRight", "Split Editor Right"),
    icon: Codicon.splitHorizontal
  }
);
appendEditorToolItem(
  {
    id: TOGGLE_SPLIT_EDITOR_IN_GROUP_LAYOUT,
    title: localize("toggleSplitEditorInGroupLayout", "Toggle Layout"),
    icon: Codicon.editorLayout
  },
  SideBySideEditorActiveContext,
  SPLIT_ORDER - 1
  // left to split actions
);
appendEditorToolItem(
  {
    id: CLOSE_EDITOR_COMMAND_ID,
    title: localize("close", "Close"),
    icon: Codicon.close
  },
  ContextKeyExpr.and(EditorTabsVisibleContext.toNegated(), ActiveEditorDirtyContext.toNegated(), ActiveEditorStickyContext.toNegated()),
  CLOSE_ORDER,
  {
    id: CLOSE_EDITORS_IN_GROUP_COMMAND_ID,
    title: localize("closeAll", "Close All"),
    icon: Codicon.closeAll
  }
);
appendEditorToolItem(
  {
    id: CLOSE_EDITOR_COMMAND_ID,
    title: localize("close", "Close"),
    icon: Codicon.closeDirty
  },
  ContextKeyExpr.and(EditorTabsVisibleContext.toNegated(), ActiveEditorDirtyContext, ActiveEditorStickyContext.toNegated()),
  CLOSE_ORDER,
  {
    id: CLOSE_EDITORS_IN_GROUP_COMMAND_ID,
    title: localize("closeAll", "Close All"),
    icon: Codicon.closeAll
  }
);
appendEditorToolItem(
  {
    id: UNPIN_EDITOR_COMMAND_ID,
    title: localize("unpin", "Unpin"),
    icon: Codicon.pinned
  },
  ContextKeyExpr.and(EditorTabsVisibleContext.toNegated(), ActiveEditorDirtyContext.toNegated(), ActiveEditorStickyContext),
  CLOSE_ORDER,
  {
    id: CLOSE_EDITOR_COMMAND_ID,
    title: localize("close", "Close"),
    icon: Codicon.close
  }
);
appendEditorToolItem(
  {
    id: UNPIN_EDITOR_COMMAND_ID,
    title: localize("unpin", "Unpin"),
    icon: Codicon.pinnedDirty
  },
  ContextKeyExpr.and(EditorTabsVisibleContext.toNegated(), ActiveEditorDirtyContext, ActiveEditorStickyContext),
  CLOSE_ORDER,
  {
    id: CLOSE_EDITOR_COMMAND_ID,
    title: localize("close", "Close"),
    icon: Codicon.close
  }
);
appendEditorToolItem(
  {
    id: LOCK_GROUP_COMMAND_ID,
    title: localize("lockEditorGroup", "Lock Group"),
    icon: Codicon.unlock
  },
  ContextKeyExpr.and(IsAuxiliaryEditorPartContext, ActiveEditorGroupLockedContext.toNegated()),
  CLOSE_ORDER - 1
  // immediately to the left of close action
);
appendEditorToolItem(
  {
    id: UNLOCK_GROUP_COMMAND_ID,
    title: localize("unlockEditorGroup", "Unlock Group"),
    icon: Codicon.lock,
    toggled: ContextKeyExpr.true()
  },
  ActiveEditorGroupLockedContext,
  CLOSE_ORDER - 1
  // immediately to the left of close action
);
const previousChangeIcon = registerIcon("diff-editor-previous-change", Codicon.arrowUp, localize("previousChangeIcon", "Icon for the previous change action in the diff editor."));
appendEditorToolItem(
  {
    id: GOTO_PREVIOUS_CHANGE,
    title: localize("navigate.prev.label", "Previous Change"),
    icon: previousChangeIcon
  },
  TextCompareEditorActiveContext,
  10,
  void 0,
  EditorContextKeys.hasChanges
);
const nextChangeIcon = registerIcon("diff-editor-next-change", Codicon.arrowDown, localize("nextChangeIcon", "Icon for the next change action in the diff editor."));
appendEditorToolItem(
  {
    id: GOTO_NEXT_CHANGE,
    title: localize("navigate.next.label", "Next Change"),
    icon: nextChangeIcon
  },
  TextCompareEditorActiveContext,
  11,
  void 0,
  EditorContextKeys.hasChanges
);
appendEditorToolItem(
  {
    id: DIFF_SWAP_SIDES,
    title: localize("swapDiffSides", "Swap Left and Right Side"),
    icon: Codicon.arrowSwap
  },
  ContextKeyExpr.and(TextCompareEditorActiveContext, ActiveCompareEditorCanSwapContext),
  15,
  void 0,
  void 0
);
const toggleWhitespace = registerIcon("diff-editor-toggle-whitespace", Codicon.whitespace, localize("toggleWhitespace", "Icon for the toggle whitespace action in the diff editor."));
MenuRegistry.appendMenuItem(MenuId.EditorTitle, {
  command: {
    id: TOGGLE_DIFF_IGNORE_TRIM_WHITESPACE,
    title: localize("ignoreTrimWhitespace.label", "Show Leading/Trailing Whitespace Differences"),
    icon: toggleWhitespace,
    precondition: TextCompareEditorActiveContext,
    toggled: ContextKeyExpr.equals("config.diffEditor.ignoreTrimWhitespace", false)
  },
  group: "navigation",
  when: TextCompareEditorActiveContext,
  order: 20
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: KEEP_EDITOR_COMMAND_ID, title: localize2("keepEditor", "Keep Editor"), category: Categories.View }, when: ContextKeyExpr.has("config.workbench.editor.enablePreview") });
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: PIN_EDITOR_COMMAND_ID, title: localize2("pinEditor", "Pin Editor"), category: Categories.View } });
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: UNPIN_EDITOR_COMMAND_ID, title: localize2("unpinEditor", "Unpin Editor"), category: Categories.View } });
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: CLOSE_EDITOR_COMMAND_ID, title: localize2("closeEditor", "Close Editor"), category: Categories.View } });
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: CLOSE_PINNED_EDITOR_COMMAND_ID, title: localize2("closePinnedEditor", "Close Pinned Editor"), category: Categories.View } });
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: CLOSE_EDITORS_IN_GROUP_COMMAND_ID, title: localize2("closeEditorsInGroup", "Close All Editors in Group"), category: Categories.View } });
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: CLOSE_SAVED_EDITORS_COMMAND_ID, title: localize2("closeSavedEditors", "Close Saved Editors in Group"), category: Categories.View } });
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: CLOSE_OTHER_EDITORS_IN_GROUP_COMMAND_ID, title: localize2("closeOtherEditors", "Close Other Editors in Group"), category: Categories.View } });
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: CLOSE_EDITORS_TO_THE_RIGHT_COMMAND_ID, title: localize2("closeRightEditors", "Close Editors to the Right in Group"), category: Categories.View }, when: ActiveEditorLastInGroupContext.toNegated() });
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: CLOSE_EDITORS_AND_GROUP_COMMAND_ID, title: localize2("closeEditorGroup", "Close Editor Group"), category: Categories.View }, when: MultipleEditorGroupsContext });
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: REOPEN_WITH_COMMAND_ID, title: localize2("reopenWith", "Reopen Editor With..."), category: Categories.View }, when: ActiveEditorAvailableEditorIdsContext });
MenuRegistry.appendMenuItem(MenuId.MenubarRecentMenu, {
  group: "1_editor",
  command: {
    id: ReopenClosedEditorAction.ID,
    title: localize({ key: "miReopenClosedEditor", comment: ["&& denotes a mnemonic"] }, "&&Reopen Closed Editor"),
    precondition: ContextKeyExpr.has("canReopenClosedEditor")
  },
  order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarRecentMenu, {
  group: "z_clear",
  command: {
    id: ClearRecentFilesAction.ID,
    title: localize({ key: "miClearRecentOpen", comment: ["&& denotes a mnemonic"] }, "&&Clear Recently Opened...")
  },
  order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
  title: localize("miShare", "Share"),
  submenu: MenuId.MenubarShare,
  group: "45_share",
  order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarViewMenu, {
  group: "2_appearance",
  title: localize({ key: "miEditorLayout", comment: ["&& denotes a mnemonic"] }, "Editor &&Layout"),
  submenu: MenuId.MenubarLayoutMenu,
  order: 2
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
  group: "1_split",
  command: {
    id: SPLIT_EDITOR_UP,
    title: {
      ...localize2("miSplitEditorUpWithoutMnemonic", "Split Up"),
      mnemonicTitle: localize({ key: "miSplitEditorUp", comment: ["&& denotes a mnemonic"] }, "Split &&Up")
    }
  },
  order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
  group: "1_split",
  command: {
    id: SPLIT_EDITOR_DOWN,
    title: {
      ...localize2("miSplitEditorDownWithoutMnemonic", "Split Down"),
      mnemonicTitle: localize({ key: "miSplitEditorDown", comment: ["&& denotes a mnemonic"] }, "Split &&Down")
    }
  },
  order: 2
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
  group: "1_split",
  command: {
    id: SPLIT_EDITOR_LEFT,
    title: {
      ...localize2("miSplitEditorLeftWithoutMnemonic", "Split Left"),
      mnemonicTitle: localize({ key: "miSplitEditorLeft", comment: ["&& denotes a mnemonic"] }, "Split &&Left")
    }
  },
  order: 3
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
  group: "1_split",
  command: {
    id: SPLIT_EDITOR_RIGHT,
    title: {
      ...localize2("miSplitEditorRightWithoutMnemonic", "Split Right"),
      mnemonicTitle: localize({ key: "miSplitEditorRight", comment: ["&& denotes a mnemonic"] }, "Split &&Right")
    }
  },
  order: 4
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
  group: "2_split_in_group",
  command: {
    id: SPLIT_EDITOR_IN_GROUP,
    title: {
      ...localize2("miSplitEditorInGroupWithoutMnemonic", "Split in Group"),
      mnemonicTitle: localize({ key: "miSplitEditorInGroup", comment: ["&& denotes a mnemonic"] }, "Split in &&Group")
    }
  },
  when: ActiveEditorCanSplitInGroupContext,
  order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
  group: "2_split_in_group",
  command: {
    id: JOIN_EDITOR_IN_GROUP,
    title: {
      ...localize2("miJoinEditorInGroupWithoutMnemonic", "Join in Group"),
      mnemonicTitle: localize({ key: "miJoinEditorInGroup", comment: ["&& denotes a mnemonic"] }, "Join in &&Group")
    }
  },
  when: SideBySideEditorActiveContext,
  order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
  group: "3_new_window",
  command: {
    id: MOVE_EDITOR_INTO_NEW_WINDOW_COMMAND_ID,
    title: {
      ...localize2("moveEditorToNewWindow", "Move Editor into New Window"),
      mnemonicTitle: localize({ key: "miMoveEditorToNewWindow", comment: ["&& denotes a mnemonic"] }, "&&Move Editor into New Window")
    }
  },
  order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
  group: "3_new_window",
  command: {
    id: COPY_EDITOR_INTO_NEW_WINDOW_COMMAND_ID,
    title: {
      ...localize2("copyEditorToNewWindow", "Copy Editor into New Window"),
      mnemonicTitle: localize({ key: "miCopyEditorToNewWindow", comment: ["&& denotes a mnemonic"] }, "&&Copy Editor into New Window")
    }
  },
  order: 2
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
  group: "4_layouts",
  command: {
    id: EditorLayoutSingleAction.ID,
    title: {
      ...localize2("miSingleColumnEditorLayoutWithoutMnemonic", "Single"),
      mnemonicTitle: localize({ key: "miSingleColumnEditorLayout", comment: ["&& denotes a mnemonic"] }, "&&Single")
    }
  },
  order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
  group: "4_layouts",
  command: {
    id: EditorLayoutTwoColumnsAction.ID,
    title: {
      ...localize2("miTwoColumnsEditorLayoutWithoutMnemonic", "Two Columns"),
      mnemonicTitle: localize({ key: "miTwoColumnsEditorLayout", comment: ["&& denotes a mnemonic"] }, "&&Two Columns")
    }
  },
  order: 3
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
  group: "4_layouts",
  command: {
    id: EditorLayoutThreeColumnsAction.ID,
    title: {
      ...localize2("miThreeColumnsEditorLayoutWithoutMnemonic", "Three Columns"),
      mnemonicTitle: localize({ key: "miThreeColumnsEditorLayout", comment: ["&& denotes a mnemonic"] }, "T&&hree Columns")
    }
  },
  order: 4
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
  group: "4_layouts",
  command: {
    id: EditorLayoutTwoRowsAction.ID,
    title: {
      ...localize2("miTwoRowsEditorLayoutWithoutMnemonic", "Two Rows"),
      mnemonicTitle: localize({ key: "miTwoRowsEditorLayout", comment: ["&& denotes a mnemonic"] }, "T&&wo Rows")
    }
  },
  order: 5
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
  group: "4_layouts",
  command: {
    id: EditorLayoutThreeRowsAction.ID,
    title: {
      ...localize2("miThreeRowsEditorLayoutWithoutMnemonic", "Three Rows"),
      mnemonicTitle: localize({ key: "miThreeRowsEditorLayout", comment: ["&& denotes a mnemonic"] }, "Three &&Rows")
    }
  },
  order: 6
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
  group: "4_layouts",
  command: {
    id: EditorLayoutTwoByTwoGridAction.ID,
    title: {
      ...localize2("miTwoByTwoGridEditorLayoutWithoutMnemonic", "Grid (2x2)"),
      mnemonicTitle: localize({ key: "miTwoByTwoGridEditorLayout", comment: ["&& denotes a mnemonic"] }, "&&Grid (2x2)")
    }
  },
  order: 7
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
  group: "4_layouts",
  command: {
    id: EditorLayoutTwoRowsRightAction.ID,
    title: {
      ...localize2("miTwoRowsRightEditorLayoutWithoutMnemonic", "Two Rows Right"),
      mnemonicTitle: localize({ key: "miTwoRowsRightEditorLayout", comment: ["&& denotes a mnemonic"] }, "Two R&&ows Right")
    }
  },
  order: 8
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
  group: "4_layouts",
  command: {
    id: EditorLayoutTwoColumnsBottomAction.ID,
    title: {
      ...localize2("miTwoColumnsBottomEditorLayoutWithoutMnemonic", "Two Columns Bottom"),
      mnemonicTitle: localize({ key: "miTwoColumnsBottomEditorLayout", comment: ["&& denotes a mnemonic"] }, "Two &&Columns Bottom")
    }
  },
  order: 9
});
MenuRegistry.appendMenuItem(MenuId.MenubarGoMenu, {
  group: "1_history_nav",
  command: {
    id: "workbench.action.navigateToLastEditLocation",
    title: localize({ key: "miLastEditLocation", comment: ["&& denotes a mnemonic"] }, "&&Last Edit Location"),
    precondition: ContextKeyExpr.has("canNavigateToLastEditLocation")
  },
  order: 3
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchEditorMenu, {
  group: "1_sideBySide",
  command: {
    id: FOCUS_FIRST_SIDE_EDITOR,
    title: localize({ key: "miFirstSideEditor", comment: ["&& denotes a mnemonic"] }, "&&First Side in Editor")
  },
  when: ContextKeyExpr.or(SideBySideEditorActiveContext, TextCompareEditorActiveContext),
  order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchEditorMenu, {
  group: "1_sideBySide",
  command: {
    id: FOCUS_SECOND_SIDE_EDITOR,
    title: localize({ key: "miSecondSideEditor", comment: ["&& denotes a mnemonic"] }, "&&Second Side in Editor")
  },
  when: ContextKeyExpr.or(SideBySideEditorActiveContext, TextCompareEditorActiveContext),
  order: 2
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchEditorMenu, {
  group: "2_any",
  command: {
    id: "workbench.action.nextEditor",
    title: localize({ key: "miNextEditor", comment: ["&& denotes a mnemonic"] }, "&&Next Editor")
  },
  order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchEditorMenu, {
  group: "2_any",
  command: {
    id: "workbench.action.previousEditor",
    title: localize({ key: "miPreviousEditor", comment: ["&& denotes a mnemonic"] }, "&&Previous Editor")
  },
  order: 2
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchEditorMenu, {
  group: "3_any_used",
  command: {
    id: "workbench.action.openNextRecentlyUsedEditor",
    title: localize({ key: "miNextRecentlyUsedEditor", comment: ["&& denotes a mnemonic"] }, "&&Next Used Editor")
  },
  order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchEditorMenu, {
  group: "3_any_used",
  command: {
    id: "workbench.action.openPreviousRecentlyUsedEditor",
    title: localize({ key: "miPreviousRecentlyUsedEditor", comment: ["&& denotes a mnemonic"] }, "&&Previous Used Editor")
  },
  order: 2
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchEditorMenu, {
  group: "4_group",
  command: {
    id: "workbench.action.nextEditorInGroup",
    title: localize({ key: "miNextEditorInGroup", comment: ["&& denotes a mnemonic"] }, "&&Next Editor in Group")
  },
  order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchEditorMenu, {
  group: "4_group",
  command: {
    id: "workbench.action.previousEditorInGroup",
    title: localize({ key: "miPreviousEditorInGroup", comment: ["&& denotes a mnemonic"] }, "&&Previous Editor in Group")
  },
  order: 2
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchEditorMenu, {
  group: "5_group_used",
  command: {
    id: "workbench.action.openNextRecentlyUsedEditorInGroup",
    title: localize({ key: "miNextUsedEditorInGroup", comment: ["&& denotes a mnemonic"] }, "&&Next Used Editor in Group")
  },
  order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchEditorMenu, {
  group: "5_group_used",
  command: {
    id: "workbench.action.openPreviousRecentlyUsedEditorInGroup",
    title: localize({ key: "miPreviousUsedEditorInGroup", comment: ["&& denotes a mnemonic"] }, "&&Previous Used Editor in Group")
  },
  order: 2
});
MenuRegistry.appendMenuItem(MenuId.MenubarGoMenu, {
  group: "2_editor_nav",
  title: localize({ key: "miSwitchEditor", comment: ["&& denotes a mnemonic"] }, "Switch &&Editor"),
  submenu: MenuId.MenubarSwitchEditorMenu,
  order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
  group: "1_focus_index",
  command: {
    id: "workbench.action.focusFirstEditorGroup",
    title: localize({ key: "miFocusFirstGroup", comment: ["&& denotes a mnemonic"] }, "Group &&1")
  },
  order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
  group: "1_focus_index",
  command: {
    id: "workbench.action.focusSecondEditorGroup",
    title: localize({ key: "miFocusSecondGroup", comment: ["&& denotes a mnemonic"] }, "Group &&2")
  },
  order: 2
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
  group: "1_focus_index",
  command: {
    id: "workbench.action.focusThirdEditorGroup",
    title: localize({ key: "miFocusThirdGroup", comment: ["&& denotes a mnemonic"] }, "Group &&3"),
    precondition: MultipleEditorGroupsContext
  },
  order: 3
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
  group: "1_focus_index",
  command: {
    id: "workbench.action.focusFourthEditorGroup",
    title: localize({ key: "miFocusFourthGroup", comment: ["&& denotes a mnemonic"] }, "Group &&4"),
    precondition: MultipleEditorGroupsContext
  },
  order: 4
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
  group: "1_focus_index",
  command: {
    id: "workbench.action.focusFifthEditorGroup",
    title: localize({ key: "miFocusFifthGroup", comment: ["&& denotes a mnemonic"] }, "Group &&5"),
    precondition: MultipleEditorGroupsContext
  },
  order: 5
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
  group: "2_next_prev",
  command: {
    id: "workbench.action.focusNextGroup",
    title: localize({ key: "miNextGroup", comment: ["&& denotes a mnemonic"] }, "&&Next Group"),
    precondition: MultipleEditorGroupsContext
  },
  order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
  group: "2_next_prev",
  command: {
    id: "workbench.action.focusPreviousGroup",
    title: localize({ key: "miPreviousGroup", comment: ["&& denotes a mnemonic"] }, "&&Previous Group"),
    precondition: MultipleEditorGroupsContext
  },
  order: 2
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
  group: "3_directional",
  command: {
    id: "workbench.action.focusLeftGroup",
    title: localize({ key: "miFocusLeftGroup", comment: ["&& denotes a mnemonic"] }, "Group &&Left"),
    precondition: MultipleEditorGroupsContext
  },
  order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
  group: "3_directional",
  command: {
    id: "workbench.action.focusRightGroup",
    title: localize({ key: "miFocusRightGroup", comment: ["&& denotes a mnemonic"] }, "Group &&Right"),
    precondition: MultipleEditorGroupsContext
  },
  order: 2
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
  group: "3_directional",
  command: {
    id: "workbench.action.focusAboveGroup",
    title: localize({ key: "miFocusAboveGroup", comment: ["&& denotes a mnemonic"] }, "Group &&Above"),
    precondition: MultipleEditorGroupsContext
  },
  order: 3
});
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
  group: "3_directional",
  command: {
    id: "workbench.action.focusBelowGroup",
    title: localize({ key: "miFocusBelowGroup", comment: ["&& denotes a mnemonic"] }, "Group &&Below"),
    precondition: MultipleEditorGroupsContext
  },
  order: 4
});
MenuRegistry.appendMenuItem(MenuId.MenubarGoMenu, {
  group: "2_editor_nav",
  title: localize({ key: "miSwitchGroup", comment: ["&& denotes a mnemonic"] }, "Switch &&Group"),
  submenu: MenuId.MenubarSwitchGroupMenu,
  order: 2
});
registerEditorFontConfigurations(getFontSnippets);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9lZGl0b3IvZWRpdG9yLmNvbnRyaWJ1dGlvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUVkaXRvclBhbmVSZWdpc3RyeSwgRWRpdG9yUGFuZURlc2NyaXB0b3IgfSBmcm9tICcuLi8uLi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSUVkaXRvckZhY3RvcnlSZWdpc3RyeSwgRWRpdG9yRXh0ZW5zaW9ucyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHtcblx0VGV4dENvbXBhcmVFZGl0b3JBY3RpdmVDb250ZXh0LCBBY3RpdmVFZGl0b3JQaW5uZWRDb250ZXh0LCBFZGl0b3JHcm91cEVkaXRvcnNDb3VudENvbnRleHQsIEFjdGl2ZUVkaXRvclN0aWNreUNvbnRleHQsIEFjdGl2ZUVkaXRvckF2YWlsYWJsZUVkaXRvcklkc0NvbnRleHQsXG5cdEVkaXRvclBhcnRNdWx0aXBsZUVkaXRvckdyb3Vwc0NvbnRleHQsIEFjdGl2ZUVkaXRvckRpcnR5Q29udGV4dCwgQWN0aXZlRWRpdG9yR3JvdXBMb2NrZWRDb250ZXh0LCBBY3RpdmVFZGl0b3JDYW5TcGxpdEluR3JvdXBDb250ZXh0LCBTaWRlQnlTaWRlRWRpdG9yQWN0aXZlQ29udGV4dCxcblx0RWRpdG9yVGFic1Zpc2libGVDb250ZXh0LCBBY3RpdmVFZGl0b3JMYXN0SW5Hcm91cENvbnRleHQsIEVkaXRvclBhcnRNYXhpbWl6ZWRFZGl0b3JHcm91cENvbnRleHQsIE11bHRpcGxlRWRpdG9yR3JvdXBzQ29udGV4dCwgSW5FZGl0b3JaZW5Nb2RlQ29udGV4dCxcblx0SXNBdXhpbGlhcnlFZGl0b3JQYXJ0Q29udGV4dCwgQWN0aXZlQ29tcGFyZUVkaXRvckNhblN3YXBDb250ZXh0LCBNdWx0aXBsZUVkaXRvcnNTZWxlY3RlZEluR3JvdXBDb250ZXh0XG59IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250ZXh0a2V5cy5qcyc7XG5pbXBvcnQgeyBTaWRlQnlTaWRlRWRpdG9ySW5wdXQsIFNpZGVCeVNpZGVFZGl0b3JJbnB1dFNlcmlhbGl6ZXIgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yL3NpZGVCeVNpZGVFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBUZXh0UmVzb3VyY2VFZGl0b3IgfSBmcm9tICcuL3RleHRSZXNvdXJjZUVkaXRvci5qcyc7XG5pbXBvcnQgeyBTaWRlQnlTaWRlRWRpdG9yIH0gZnJvbSAnLi9zaWRlQnlTaWRlRWRpdG9yLmpzJztcbmltcG9ydCB7IERpZmZFZGl0b3JJbnB1dCwgRGlmZkVkaXRvcklucHV0U2VyaWFsaXplciB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvZGlmZkVkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IFVudGl0bGVkVGV4dEVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdW50aXRsZWQvY29tbW9uL3VudGl0bGVkVGV4dEVkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IFRleHRSZXNvdXJjZUVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci90ZXh0UmVzb3VyY2VFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBUZXh0RGlmZkVkaXRvciB9IGZyb20gJy4vdGV4dERpZmZFZGl0b3IuanMnO1xuaW1wb3J0IHsgQmluYXJ5UmVzb3VyY2VEaWZmRWRpdG9yIH0gZnJvbSAnLi9iaW5hcnlEaWZmRWRpdG9yLmpzJztcbmltcG9ydCB7IENoYW5nZUVuY29kaW5nQWN0aW9uLCBDaGFuZ2VFT0xBY3Rpb24sIENoYW5nZUxhbmd1YWdlQWN0aW9uLCBFZGl0b3JTdGF0dXNDb250cmlidXRpb24gfSBmcm9tICcuL2VkaXRvclN0YXR1cy5qcyc7XG5pbXBvcnQgeyBDYXRlZ29yaWVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9uL2NvbW1vbi9hY3Rpb25Db21tb25DYXRlZ29yaWVzLmpzJztcbmltcG9ydCB7IE1lbnVSZWdpc3RyeSwgTWVudUlkLCBJTWVudUl0ZW0sIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgU3luY0Rlc2NyaXB0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9kZXNjcmlwdG9ycy5qcyc7XG5pbXBvcnQgeyBLZXlNb2QsIEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQge1xuXHRDbG9zZUVkaXRvcnNJbk90aGVyR3JvdXBzQWN0aW9uLCBDbG9zZUFsbEVkaXRvcnNBY3Rpb24sIE1vdmVHcm91cExlZnRBY3Rpb24sIE1vdmVHcm91cFJpZ2h0QWN0aW9uLCBTcGxpdEVkaXRvckFjdGlvbiwgSm9pblR3b0dyb3Vwc0FjdGlvbiwgUmV2ZXJ0QW5kQ2xvc2VFZGl0b3JBY3Rpb24sXG5cdE5hdmlnYXRlQmV0d2Vlbkdyb3Vwc0FjdGlvbiwgRm9jdXNBY3RpdmVHcm91cEFjdGlvbiwgRm9jdXNGaXJzdEdyb3VwQWN0aW9uLCBSZXNldEdyb3VwU2l6ZXNBY3Rpb24sIE1pbmltaXplT3RoZXJHcm91cHNBY3Rpb24sIEZvY3VzUHJldmlvdXNHcm91cCwgRm9jdXNOZXh0R3JvdXAsXG5cdENsb3NlTGVmdEVkaXRvcnNJbkdyb3VwQWN0aW9uLCBPcGVuTmV4dEVkaXRvciwgT3BlblByZXZpb3VzRWRpdG9yLCBOYXZpZ2F0ZUJhY2t3YXJkc0FjdGlvbiwgTmF2aWdhdGVGb3J3YXJkQWN0aW9uLCBOYXZpZ2F0ZVByZXZpb3VzQWN0aW9uLCBSZW9wZW5DbG9zZWRFZGl0b3JBY3Rpb24sXG5cdFF1aWNrQWNjZXNzUHJldmlvdXNSZWNlbnRseVVzZWRFZGl0b3JJbkdyb3VwQWN0aW9uLCBRdWlja0FjY2Vzc1ByZXZpb3VzRWRpdG9yRnJvbUhpc3RvcnlBY3Rpb24sIFNob3dBbGxFZGl0b3JzQnlBcHBlYXJhbmNlQWN0aW9uLCBDbGVhckVkaXRvckhpc3RvcnlBY3Rpb24sIE1vdmVFZGl0b3JSaWdodEluR3JvdXBBY3Rpb24sIE9wZW5OZXh0RWRpdG9ySW5Hcm91cCxcblx0T3BlblByZXZpb3VzRWRpdG9ySW5Hcm91cCwgT3Blbk5leHRSZWNlbnRseVVzZWRFZGl0b3JBY3Rpb24sIE9wZW5QcmV2aW91c1JlY2VudGx5VXNlZEVkaXRvckFjdGlvbiwgTW92ZUVkaXRvclRvUHJldmlvdXNHcm91cEFjdGlvbixcblx0TW92ZUVkaXRvclRvTmV4dEdyb3VwQWN0aW9uLCBNb3ZlRWRpdG9yVG9GaXJzdEdyb3VwQWN0aW9uLCBNb3ZlRWRpdG9yTGVmdEluR3JvdXBBY3Rpb24sIENsZWFyUmVjZW50RmlsZXNBY3Rpb24sIE9wZW5MYXN0RWRpdG9ySW5Hcm91cCxcblx0U2hvd0VkaXRvcnNJbkFjdGl2ZUdyb3VwQnlNb3N0UmVjZW50bHlVc2VkQWN0aW9uLCBNb3ZlRWRpdG9yVG9MYXN0R3JvdXBBY3Rpb24sIE9wZW5GaXJzdEVkaXRvckluR3JvdXAsIE1vdmVHcm91cFVwQWN0aW9uLCBNb3ZlR3JvdXBEb3duQWN0aW9uLCBGb2N1c0xhc3RHcm91cEFjdGlvbiwgU3BsaXRFZGl0b3JMZWZ0QWN0aW9uLCBTcGxpdEVkaXRvclJpZ2h0QWN0aW9uLFxuXHRTcGxpdEVkaXRvclVwQWN0aW9uLCBTcGxpdEVkaXRvckRvd25BY3Rpb24sIE1vdmVFZGl0b3JUb0xlZnRHcm91cEFjdGlvbiwgTW92ZUVkaXRvclRvUmlnaHRHcm91cEFjdGlvbiwgTW92ZUVkaXRvclRvQWJvdmVHcm91cEFjdGlvbiwgTW92ZUVkaXRvclRvQmVsb3dHcm91cEFjdGlvbiwgQ2xvc2VBbGxFZGl0b3JHcm91cHNBY3Rpb24sXG5cdEpvaW5BbGxHcm91cHNBY3Rpb24sIEZvY3VzTGVmdEdyb3VwLCBGb2N1c0Fib3ZlR3JvdXAsIEZvY3VzUmlnaHRHcm91cCwgRm9jdXNCZWxvd0dyb3VwLCBFZGl0b3JMYXlvdXRTaW5nbGVBY3Rpb24sIEVkaXRvckxheW91dFR3b0NvbHVtbnNBY3Rpb24sIEVkaXRvckxheW91dFRocmVlQ29sdW1uc0FjdGlvbiwgRWRpdG9yTGF5b3V0VHdvQnlUd29HcmlkQWN0aW9uLFxuXHRFZGl0b3JMYXlvdXRUd29Sb3dzQWN0aW9uLCBFZGl0b3JMYXlvdXRUaHJlZVJvd3NBY3Rpb24sIEVkaXRvckxheW91dFR3b0NvbHVtbnNCb3R0b21BY3Rpb24sIEVkaXRvckxheW91dFR3b1Jvd3NSaWdodEFjdGlvbiwgTmV3RWRpdG9yR3JvdXBMZWZ0QWN0aW9uLCBOZXdFZGl0b3JHcm91cFJpZ2h0QWN0aW9uLFxuXHROZXdFZGl0b3JHcm91cEFib3ZlQWN0aW9uLCBOZXdFZGl0b3JHcm91cEJlbG93QWN0aW9uLCBTcGxpdEVkaXRvck9ydGhvZ29uYWxBY3Rpb24sIENsb3NlRWRpdG9ySW5BbGxHcm91cHNBY3Rpb24sIE5hdmlnYXRlVG9MYXN0RWRpdExvY2F0aW9uQWN0aW9uLCBUb2dnbGVHcm91cFNpemVzQWN0aW9uLCBTaG93QWxsRWRpdG9yc0J5TW9zdFJlY2VudGx5VXNlZEFjdGlvbixcblx0UXVpY2tBY2Nlc3NQcmV2aW91c1JlY2VudGx5VXNlZEVkaXRvckFjdGlvbiwgT3BlblByZXZpb3VzUmVjZW50bHlVc2VkRWRpdG9ySW5Hcm91cEFjdGlvbiwgT3Blbk5leHRSZWNlbnRseVVzZWRFZGl0b3JJbkdyb3VwQWN0aW9uLCBRdWlja0FjY2Vzc0xlYXN0UmVjZW50bHlVc2VkRWRpdG9yQWN0aW9uLCBRdWlja0FjY2Vzc0xlYXN0UmVjZW50bHlVc2VkRWRpdG9ySW5Hcm91cEFjdGlvbixcblx0UmVPcGVuSW5UZXh0RWRpdG9yQWN0aW9uLCBEdXBsaWNhdGVHcm91cERvd25BY3Rpb24sIER1cGxpY2F0ZUdyb3VwTGVmdEFjdGlvbiwgRHVwbGljYXRlR3JvdXBSaWdodEFjdGlvbiwgRHVwbGljYXRlR3JvdXBVcEFjdGlvbiwgVG9nZ2xlRWRpdG9yVHlwZUFjdGlvbiwgU3BsaXRFZGl0b3JUb0Fib3ZlR3JvdXBBY3Rpb24sIFNwbGl0RWRpdG9yVG9CZWxvd0dyb3VwQWN0aW9uLFxuXHRTcGxpdEVkaXRvclRvRmlyc3RHcm91cEFjdGlvbiwgU3BsaXRFZGl0b3JUb0xhc3RHcm91cEFjdGlvbiwgU3BsaXRFZGl0b3JUb0xlZnRHcm91cEFjdGlvbiwgU3BsaXRFZGl0b3JUb05leHRHcm91cEFjdGlvbiwgU3BsaXRFZGl0b3JUb1ByZXZpb3VzR3JvdXBBY3Rpb24sIFNwbGl0RWRpdG9yVG9SaWdodEdyb3VwQWN0aW9uLCBOYXZpZ2F0ZUZvcndhcmRJbkVkaXRzQWN0aW9uLFxuXHROYXZpZ2F0ZUJhY2t3YXJkc0luRWRpdHNBY3Rpb24sIE5hdmlnYXRlRm9yd2FyZEluTmF2aWdhdGlvbnNBY3Rpb24sIE5hdmlnYXRlQmFja3dhcmRzSW5OYXZpZ2F0aW9uc0FjdGlvbiwgTmF2aWdhdGVQcmV2aW91c0luTmF2aWdhdGlvbnNBY3Rpb24sIE5hdmlnYXRlUHJldmlvdXNJbkVkaXRzQWN0aW9uLCBOYXZpZ2F0ZVRvTGFzdE5hdmlnYXRpb25Mb2NhdGlvbkFjdGlvbixcblx0TWF4aW1pemVHcm91cEhpZGVTaWRlYmFyQWN0aW9uLCBNb3ZlRWRpdG9yVG9OZXdXaW5kb3dBY3Rpb24sIENvcHlFZGl0b3JUb05ld2luZG93QWN0aW9uLCBSZXN0b3JlRWRpdG9yc1RvTWFpbldpbmRvd0FjdGlvbiwgVG9nZ2xlTWF4aW1pemVFZGl0b3JHcm91cEFjdGlvbiwgTWluaW1pemVPdGhlckdyb3Vwc0hpZGVTaWRlYmFyQWN0aW9uLCBDb3B5RWRpdG9yR3JvdXBUb05ld1dpbmRvd0FjdGlvbixcblx0TW92ZUVkaXRvckdyb3VwVG9OZXdXaW5kb3dBY3Rpb24sIE5ld0VtcHR5RWRpdG9yV2luZG93QWN0aW9uXG59IGZyb20gJy4vZWRpdG9yQWN0aW9ucy5qcyc7XG5pbXBvcnQge1xuXHRDTE9TRV9FRElUT1JTX0FORF9HUk9VUF9DT01NQU5EX0lELCBDTE9TRV9FRElUT1JTX0lOX0dST1VQX0NPTU1BTkRfSUQsIENMT1NFX0VESVRPUlNfVE9fVEhFX1JJR0hUX0NPTU1BTkRfSUQsIENMT1NFX0VESVRPUl9DT01NQU5EX0lELCBDTE9TRV9FRElUT1JfR1JPVVBfQ09NTUFORF9JRCwgQ0xPU0VfT1RIRVJfRURJVE9SU19JTl9HUk9VUF9DT01NQU5EX0lELFxuXHRDTE9TRV9QSU5ORURfRURJVE9SX0NPTU1BTkRfSUQsIENMT1NFX1NBVkVEX0VESVRPUlNfQ09NTUFORF9JRCwgS0VFUF9FRElUT1JfQ09NTUFORF9JRCwgUElOX0VESVRPUl9DT01NQU5EX0lELCBTSE9XX0VESVRPUlNfSU5fR1JPVVAsIFNQTElUX0VESVRPUl9ET1dOLCBTUExJVF9FRElUT1JfTEVGVCxcblx0U1BMSVRfRURJVE9SX1JJR0hULCBTUExJVF9FRElUT1JfVVAsIFRPR0dMRV9LRUVQX0VESVRPUlNfQ09NTUFORF9JRCwgVU5QSU5fRURJVE9SX0NPTU1BTkRfSUQsIHNldHVwIGFzIHJlZ2lzdGVyRWRpdG9yQ29tbWFuZHMsIFJFT1BFTl9XSVRIX0NPTU1BTkRfSUQsXG5cdFRPR0dMRV9MT0NLX0dST1VQX0NPTU1BTkRfSUQsIFVOTE9DS19HUk9VUF9DT01NQU5EX0lELCBTUExJVF9FRElUT1JfSU5fR1JPVVAsIEpPSU5fRURJVE9SX0lOX0dST1VQLCBGT0NVU19GSVJTVF9TSURFX0VESVRPUiwgRk9DVVNfU0VDT05EX1NJREVfRURJVE9SLCBUT0dHTEVfU1BMSVRfRURJVE9SX0lOX0dST1VQX0xBWU9VVCwgTE9DS19HUk9VUF9DT01NQU5EX0lELFxuXHRTUExJVF9FRElUT1IsIFRPR0dMRV9NQVhJTUlaRV9FRElUT1JfR1JPVVAsIE1PVkVfRURJVE9SX0lOVE9fTkVXX1dJTkRPV19DT01NQU5EX0lELCBDT1BZX0VESVRPUl9JTlRPX05FV19XSU5ET1dfQ09NTUFORF9JRCwgTU9WRV9FRElUT1JfR1JPVVBfSU5UT19ORVdfV0lORE9XX0NPTU1BTkRfSUQsIENPUFlfRURJVE9SX0dST1VQX0lOVE9fTkVXX1dJTkRPV19DT01NQU5EX0lELFxuXHRORVdfRU1QVFlfRURJVE9SX1dJTkRPV19DT01NQU5EX0lEXG59IGZyb20gJy4vZWRpdG9yQ29tbWFuZHMuanMnO1xuaW1wb3J0IHsgR09UT19ORVhUX0NIQU5HRSwgR09UT19QUkVWSU9VU19DSEFOR0UsIFRPR0dMRV9ESUZGX0lHTk9SRV9UUklNX1dISVRFU1BBQ0UsIFRPR0dMRV9ESUZGX1NJREVfQllfU0lERSwgRElGRl9TV0FQX1NJREVTIH0gZnJvbSAnLi9kaWZmRWRpdG9yQ29tbWFuZHMuanMnO1xuaW1wb3J0IHsgaW5RdWlja1BpY2tDb250ZXh0LCBnZXRRdWlja05hdmlnYXRlSGFuZGxlciB9IGZyb20gJy4uLy4uL3F1aWNrYWNjZXNzLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdzUmVnaXN0cnksIEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByLCBDb250ZXh0S2V5RXhwcmVzc2lvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgaXNNYWNpbnRvc2ggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JDb250cmlidXRpb25JbnN0YW50aWF0aW9uLCByZWdpc3RlckVkaXRvckNvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgRmxvYXRpbmdFZGl0b3JDbGlja01lbnUgfSBmcm9tICcuLi8uLi9jb2RlZWRpdG9yLmpzJztcbmltcG9ydCB7IFdvcmtiZW5jaFBoYXNlLCByZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JBdXRvU2F2ZSB9IGZyb20gJy4vZWRpdG9yQXV0b1NhdmUuanMnO1xuaW1wb3J0IHsgSVF1aWNrQWNjZXNzUmVnaXN0cnksIEV4dGVuc2lvbnMgYXMgUXVpY2tBY2Nlc3NFeHRlbnNpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tBY2Nlc3MuanMnO1xuaW1wb3J0IHsgQWN0aXZlR3JvdXBFZGl0b3JzQnlNb3N0UmVjZW50bHlVc2VkUXVpY2tBY2Nlc3MsIEFsbEVkaXRvcnNCeUFwcGVhcmFuY2VRdWlja0FjY2VzcywgQWxsRWRpdG9yc0J5TW9zdFJlY2VudGx5VXNlZFF1aWNrQWNjZXNzIH0gZnJvbSAnLi9lZGl0b3JRdWlja0FjY2Vzcy5qcyc7XG5pbXBvcnQgeyBGaWxlQWNjZXNzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2ljb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBVbnRpdGxlZFRleHRFZGl0b3JJbnB1dFNlcmlhbGl6ZXIsIFVudGl0bGVkVGV4dEVkaXRvcldvcmtpbmdDb3B5RWRpdG9ySGFuZGxlciB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3VudGl0bGVkL2NvbW1vbi91bnRpdGxlZFRleHRFZGl0b3JIYW5kbGVyLmpzJztcbmltcG9ydCB7IER5bmFtaWNFZGl0b3JDb25maWd1cmF0aW9ucyB9IGZyb20gJy4vZWRpdG9yQ29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmVFZGl0b3JBY3Rpb24sIENvbmZpZ3VyZUVkaXRvclRhYnNBY3Rpb24sIEVkaXRvckFjdGlvbnNEZWZhdWx0QWN0aW9uLCBFZGl0b3JBY3Rpb25zVGl0bGVCYXJBY3Rpb24sIEhpZGVFZGl0b3JBY3Rpb25zQWN0aW9uLCBIaWRlRWRpdG9yVGFic0FjdGlvbiwgU2hvd011bHRpcGxlRWRpdG9yVGFic0FjdGlvbiwgU2hvd1NpbmdsZUVkaXRvclRhYkFjdGlvbiwgWmVuSGlkZUVkaXRvclRhYnNBY3Rpb24sIFplblNob3dNdWx0aXBsZUVkaXRvclRhYnNBY3Rpb24sIFplblNob3dTaW5nbGVFZGl0b3JUYWJBY3Rpb24gfSBmcm9tICcuLi8uLi9hY3Rpb25zL2xheW91dEFjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb24vY29tbW9uL2FjdGlvbi5qcyc7XG5pbXBvcnQgeyBFZGl0b3JDb250ZXh0S2V5cyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yQ29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgZ2V0Rm9udFNuaXBwZXRzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2ZvbnRzLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVyRWRpdG9yRm9udENvbmZpZ3VyYXRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb25maWcvZWRpdG9yQ29uZmlndXJhdGlvblNjaGVtYS5qcyc7XG5cbi8vI3JlZ2lvbiBFZGl0b3IgUmVnaXN0cmF0aW9uc1xuXG5SZWdpc3RyeS5hczxJRWRpdG9yUGFuZVJlZ2lzdHJ5PihFZGl0b3JFeHRlbnNpb25zLkVkaXRvclBhbmUpLnJlZ2lzdGVyRWRpdG9yUGFuZShcblx0RWRpdG9yUGFuZURlc2NyaXB0b3IuY3JlYXRlKFxuXHRcdFRleHRSZXNvdXJjZUVkaXRvcixcblx0XHRUZXh0UmVzb3VyY2VFZGl0b3IuSUQsXG5cdFx0bG9jYWxpemUoJ3RleHRFZGl0b3InLCBcIlRleHQgRWRpdG9yXCIpLFxuXHQpLFxuXHRbXG5cdFx0bmV3IFN5bmNEZXNjcmlwdG9yKFVudGl0bGVkVGV4dEVkaXRvcklucHV0KSxcblx0XHRuZXcgU3luY0Rlc2NyaXB0b3IoVGV4dFJlc291cmNlRWRpdG9ySW5wdXQpXG5cdF1cbik7XG5cblJlZ2lzdHJ5LmFzPElFZGl0b3JQYW5lUmVnaXN0cnk+KEVkaXRvckV4dGVuc2lvbnMuRWRpdG9yUGFuZSkucmVnaXN0ZXJFZGl0b3JQYW5lKFxuXHRFZGl0b3JQYW5lRGVzY3JpcHRvci5jcmVhdGUoXG5cdFx0VGV4dERpZmZFZGl0b3IsXG5cdFx0VGV4dERpZmZFZGl0b3IuSUQsXG5cdFx0bG9jYWxpemUoJ3RleHREaWZmRWRpdG9yJywgXCJUZXh0IERpZmYgRWRpdG9yXCIpXG5cdCksXG5cdFtcblx0XHRuZXcgU3luY0Rlc2NyaXB0b3IoRGlmZkVkaXRvcklucHV0KVxuXHRdXG4pO1xuXG5SZWdpc3RyeS5hczxJRWRpdG9yUGFuZVJlZ2lzdHJ5PihFZGl0b3JFeHRlbnNpb25zLkVkaXRvclBhbmUpLnJlZ2lzdGVyRWRpdG9yUGFuZShcblx0RWRpdG9yUGFuZURlc2NyaXB0b3IuY3JlYXRlKFxuXHRcdEJpbmFyeVJlc291cmNlRGlmZkVkaXRvcixcblx0XHRCaW5hcnlSZXNvdXJjZURpZmZFZGl0b3IuSUQsXG5cdFx0bG9jYWxpemUoJ2JpbmFyeURpZmZFZGl0b3InLCBcIkJpbmFyeSBEaWZmIEVkaXRvclwiKVxuXHQpLFxuXHRbXG5cdFx0bmV3IFN5bmNEZXNjcmlwdG9yKERpZmZFZGl0b3JJbnB1dClcblx0XVxuKTtcblxuUmVnaXN0cnkuYXM8SUVkaXRvclBhbmVSZWdpc3RyeT4oRWRpdG9yRXh0ZW5zaW9ucy5FZGl0b3JQYW5lKS5yZWdpc3RlckVkaXRvclBhbmUoXG5cdEVkaXRvclBhbmVEZXNjcmlwdG9yLmNyZWF0ZShcblx0XHRTaWRlQnlTaWRlRWRpdG9yLFxuXHRcdFNpZGVCeVNpZGVFZGl0b3IuSUQsXG5cdFx0bG9jYWxpemUoJ3NpZGVCeVNpZGVFZGl0b3InLCBcIlNpZGUgYnkgU2lkZSBFZGl0b3JcIilcblx0KSxcblx0W1xuXHRcdG5ldyBTeW5jRGVzY3JpcHRvcihTaWRlQnlTaWRlRWRpdG9ySW5wdXQpXG5cdF1cbik7XG5cblJlZ2lzdHJ5LmFzPElFZGl0b3JGYWN0b3J5UmVnaXN0cnk+KEVkaXRvckV4dGVuc2lvbnMuRWRpdG9yRmFjdG9yeSkucmVnaXN0ZXJFZGl0b3JTZXJpYWxpemVyKFVudGl0bGVkVGV4dEVkaXRvcklucHV0LklELCBVbnRpdGxlZFRleHRFZGl0b3JJbnB1dFNlcmlhbGl6ZXIpO1xuUmVnaXN0cnkuYXM8SUVkaXRvckZhY3RvcnlSZWdpc3RyeT4oRWRpdG9yRXh0ZW5zaW9ucy5FZGl0b3JGYWN0b3J5KS5yZWdpc3RlckVkaXRvclNlcmlhbGl6ZXIoU2lkZUJ5U2lkZUVkaXRvcklucHV0LklELCBTaWRlQnlTaWRlRWRpdG9ySW5wdXRTZXJpYWxpemVyKTtcblJlZ2lzdHJ5LmFzPElFZGl0b3JGYWN0b3J5UmVnaXN0cnk+KEVkaXRvckV4dGVuc2lvbnMuRWRpdG9yRmFjdG9yeSkucmVnaXN0ZXJFZGl0b3JTZXJpYWxpemVyKERpZmZFZGl0b3JJbnB1dC5JRCwgRGlmZkVkaXRvcklucHV0U2VyaWFsaXplcik7XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gV29ya2JlbmNoIENvbnRyaWJ1dGlvbnNcblxucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKEVkaXRvckF1dG9TYXZlLklELCBFZGl0b3JBdXRvU2F2ZSwgV29ya2JlbmNoUGhhc2UuQmxvY2tSZXN0b3JlKTtcbnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMihFZGl0b3JTdGF0dXNDb250cmlidXRpb24uSUQsIEVkaXRvclN0YXR1c0NvbnRyaWJ1dGlvbiwgV29ya2JlbmNoUGhhc2UuQmxvY2tSZXN0b3JlKTtcbnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMihVbnRpdGxlZFRleHRFZGl0b3JXb3JraW5nQ29weUVkaXRvckhhbmRsZXIuSUQsIFVudGl0bGVkVGV4dEVkaXRvcldvcmtpbmdDb3B5RWRpdG9ySGFuZGxlciwgV29ya2JlbmNoUGhhc2UuQmxvY2tSZXN0b3JlKTtcbnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMihEeW5hbWljRWRpdG9yQ29uZmlndXJhdGlvbnMuSUQsIER5bmFtaWNFZGl0b3JDb25maWd1cmF0aW9ucywgV29ya2JlbmNoUGhhc2UuQmxvY2tSZXN0b3JlKTtcblxucmVnaXN0ZXJFZGl0b3JDb250cmlidXRpb24oRmxvYXRpbmdFZGl0b3JDbGlja01lbnUuSUQsIEZsb2F0aW5nRWRpdG9yQ2xpY2tNZW51LCBFZGl0b3JDb250cmlidXRpb25JbnN0YW50aWF0aW9uLkFmdGVyRmlyc3RSZW5kZXIpO1xuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIFF1aWNrIEFjY2Vzc1xuXG5jb25zdCBxdWlja0FjY2Vzc1JlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SVF1aWNrQWNjZXNzUmVnaXN0cnk+KFF1aWNrQWNjZXNzRXh0ZW5zaW9ucy5RdWlja2FjY2Vzcyk7XG5jb25zdCBlZGl0b3JQaWNrZXJDb250ZXh0S2V5ID0gJ2luRWRpdG9yc1BpY2tlcic7XG5jb25zdCBlZGl0b3JQaWNrZXJDb250ZXh0ID0gQ29udGV4dEtleUV4cHIuYW5kKGluUXVpY2tQaWNrQ29udGV4dCwgQ29udGV4dEtleUV4cHIuaGFzKGVkaXRvclBpY2tlckNvbnRleHRLZXkpKTtcblxucXVpY2tBY2Nlc3NSZWdpc3RyeS5yZWdpc3RlclF1aWNrQWNjZXNzUHJvdmlkZXIoe1xuXHRjdG9yOiBBY3RpdmVHcm91cEVkaXRvcnNCeU1vc3RSZWNlbnRseVVzZWRRdWlja0FjY2Vzcyxcblx0cHJlZml4OiBBY3RpdmVHcm91cEVkaXRvcnNCeU1vc3RSZWNlbnRseVVzZWRRdWlja0FjY2Vzcy5QUkVGSVgsXG5cdGNvbnRleHRLZXk6IGVkaXRvclBpY2tlckNvbnRleHRLZXksXG5cdHBsYWNlaG9sZGVyOiBsb2NhbGl6ZSgnZWRpdG9yUXVpY2tBY2Nlc3NQbGFjZWhvbGRlcicsIFwiVHlwZSB0aGUgbmFtZSBvZiBhbiBlZGl0b3IgdG8gb3BlbiBpdC5cIiksXG5cdGhlbHBFbnRyaWVzOiBbeyBkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2FjdGl2ZUdyb3VwRWRpdG9yc0J5TW9zdFJlY2VudGx5VXNlZFF1aWNrQWNjZXNzJywgXCJTaG93IEVkaXRvcnMgaW4gQWN0aXZlIEdyb3VwIGJ5IE1vc3QgUmVjZW50bHkgVXNlZFwiKSwgY29tbWFuZElkOiBTaG93RWRpdG9yc0luQWN0aXZlR3JvdXBCeU1vc3RSZWNlbnRseVVzZWRBY3Rpb24uSUQgfV1cbn0pO1xuXG5xdWlja0FjY2Vzc1JlZ2lzdHJ5LnJlZ2lzdGVyUXVpY2tBY2Nlc3NQcm92aWRlcih7XG5cdGN0b3I6IEFsbEVkaXRvcnNCeUFwcGVhcmFuY2VRdWlja0FjY2Vzcyxcblx0cHJlZml4OiBBbGxFZGl0b3JzQnlBcHBlYXJhbmNlUXVpY2tBY2Nlc3MuUFJFRklYLFxuXHRjb250ZXh0S2V5OiBlZGl0b3JQaWNrZXJDb250ZXh0S2V5LFxuXHRwbGFjZWhvbGRlcjogbG9jYWxpemUoJ2VkaXRvclF1aWNrQWNjZXNzUGxhY2Vob2xkZXInLCBcIlR5cGUgdGhlIG5hbWUgb2YgYW4gZWRpdG9yIHRvIG9wZW4gaXQuXCIpLFxuXHRoZWxwRW50cmllczogW3sgZGVzY3JpcHRpb246IGxvY2FsaXplKCdhbGxFZGl0b3JzQnlBcHBlYXJhbmNlUXVpY2tBY2Nlc3MnLCBcIlNob3cgQWxsIE9wZW5lZCBFZGl0b3JzIEJ5IEFwcGVhcmFuY2VcIiksIGNvbW1hbmRJZDogU2hvd0FsbEVkaXRvcnNCeUFwcGVhcmFuY2VBY3Rpb24uSUQgfV1cbn0pO1xuXG5xdWlja0FjY2Vzc1JlZ2lzdHJ5LnJlZ2lzdGVyUXVpY2tBY2Nlc3NQcm92aWRlcih7XG5cdGN0b3I6IEFsbEVkaXRvcnNCeU1vc3RSZWNlbnRseVVzZWRRdWlja0FjY2Vzcyxcblx0cHJlZml4OiBBbGxFZGl0b3JzQnlNb3N0UmVjZW50bHlVc2VkUXVpY2tBY2Nlc3MuUFJFRklYLFxuXHRjb250ZXh0S2V5OiBlZGl0b3JQaWNrZXJDb250ZXh0S2V5LFxuXHRwbGFjZWhvbGRlcjogbG9jYWxpemUoJ2VkaXRvclF1aWNrQWNjZXNzUGxhY2Vob2xkZXInLCBcIlR5cGUgdGhlIG5hbWUgb2YgYW4gZWRpdG9yIHRvIG9wZW4gaXQuXCIpLFxuXHRoZWxwRW50cmllczogW3sgZGVzY3JpcHRpb246IGxvY2FsaXplKCdhbGxFZGl0b3JzQnlNb3N0UmVjZW50bHlVc2VkUXVpY2tBY2Nlc3MnLCBcIlNob3cgQWxsIE9wZW5lZCBFZGl0b3JzIEJ5IE1vc3QgUmVjZW50bHkgVXNlZFwiKSwgY29tbWFuZElkOiBTaG93QWxsRWRpdG9yc0J5TW9zdFJlY2VudGx5VXNlZEFjdGlvbi5JRCB9XVxufSk7XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gQWN0aW9ucyAmIENvbW1hbmRzXG5cbnJlZ2lzdGVyQWN0aW9uMihDaGFuZ2VMYW5ndWFnZUFjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoQ2hhbmdlRU9MQWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihDaGFuZ2VFbmNvZGluZ0FjdGlvbik7XG5cbnJlZ2lzdGVyQWN0aW9uMihOYXZpZ2F0ZUZvcndhcmRBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKE5hdmlnYXRlQmFja3dhcmRzQWN0aW9uKTtcblxucmVnaXN0ZXJBY3Rpb24yKE9wZW5OZXh0RWRpdG9yKTtcbnJlZ2lzdGVyQWN0aW9uMihPcGVuUHJldmlvdXNFZGl0b3IpO1xucmVnaXN0ZXJBY3Rpb24yKE9wZW5OZXh0RWRpdG9ySW5Hcm91cCk7XG5yZWdpc3RlckFjdGlvbjIoT3BlblByZXZpb3VzRWRpdG9ySW5Hcm91cCk7XG5yZWdpc3RlckFjdGlvbjIoT3BlbkZpcnN0RWRpdG9ySW5Hcm91cCk7XG5yZWdpc3RlckFjdGlvbjIoT3Blbkxhc3RFZGl0b3JJbkdyb3VwKTtcblxucmVnaXN0ZXJBY3Rpb24yKE9wZW5OZXh0UmVjZW50bHlVc2VkRWRpdG9yQWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihPcGVuUHJldmlvdXNSZWNlbnRseVVzZWRFZGl0b3JBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKE9wZW5OZXh0UmVjZW50bHlVc2VkRWRpdG9ySW5Hcm91cEFjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoT3BlblByZXZpb3VzUmVjZW50bHlVc2VkRWRpdG9ySW5Hcm91cEFjdGlvbik7XG5cbnJlZ2lzdGVyQWN0aW9uMihSZW9wZW5DbG9zZWRFZGl0b3JBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKENsZWFyUmVjZW50RmlsZXNBY3Rpb24pO1xuXG5yZWdpc3RlckFjdGlvbjIoU2hvd0FsbEVkaXRvcnNCeUFwcGVhcmFuY2VBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKFNob3dBbGxFZGl0b3JzQnlNb3N0UmVjZW50bHlVc2VkQWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihTaG93RWRpdG9yc0luQWN0aXZlR3JvdXBCeU1vc3RSZWNlbnRseVVzZWRBY3Rpb24pO1xuXG5yZWdpc3RlckFjdGlvbjIoQ2xvc2VBbGxFZGl0b3JzQWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihDbG9zZUFsbEVkaXRvckdyb3Vwc0FjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoQ2xvc2VMZWZ0RWRpdG9yc0luR3JvdXBBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKENsb3NlRWRpdG9yc0luT3RoZXJHcm91cHNBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKENsb3NlRWRpdG9ySW5BbGxHcm91cHNBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKFJldmVydEFuZENsb3NlRWRpdG9yQWN0aW9uKTtcblxucmVnaXN0ZXJBY3Rpb24yKFNwbGl0RWRpdG9yQWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihTcGxpdEVkaXRvck9ydGhvZ29uYWxBY3Rpb24pO1xuXG5yZWdpc3RlckFjdGlvbjIoU3BsaXRFZGl0b3JMZWZ0QWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihTcGxpdEVkaXRvclJpZ2h0QWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihTcGxpdEVkaXRvclVwQWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihTcGxpdEVkaXRvckRvd25BY3Rpb24pO1xuXG5yZWdpc3RlckFjdGlvbjIoSm9pblR3b0dyb3Vwc0FjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoSm9pbkFsbEdyb3Vwc0FjdGlvbik7XG5cbnJlZ2lzdGVyQWN0aW9uMihOYXZpZ2F0ZUJldHdlZW5Hcm91cHNBY3Rpb24pO1xuXG5yZWdpc3RlckFjdGlvbjIoUmVzZXRHcm91cFNpemVzQWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihUb2dnbGVHcm91cFNpemVzQWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihNYXhpbWl6ZUdyb3VwSGlkZVNpZGViYXJBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKFRvZ2dsZU1heGltaXplRWRpdG9yR3JvdXBBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKE1pbmltaXplT3RoZXJHcm91cHNBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKE1pbmltaXplT3RoZXJHcm91cHNIaWRlU2lkZWJhckFjdGlvbik7XG5cbnJlZ2lzdGVyQWN0aW9uMihNb3ZlRWRpdG9yTGVmdEluR3JvdXBBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKE1vdmVFZGl0b3JSaWdodEluR3JvdXBBY3Rpb24pO1xuXG5yZWdpc3RlckFjdGlvbjIoTW92ZUdyb3VwTGVmdEFjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoTW92ZUdyb3VwUmlnaHRBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKE1vdmVHcm91cFVwQWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihNb3ZlR3JvdXBEb3duQWN0aW9uKTtcblxucmVnaXN0ZXJBY3Rpb24yKER1cGxpY2F0ZUdyb3VwTGVmdEFjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoRHVwbGljYXRlR3JvdXBSaWdodEFjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoRHVwbGljYXRlR3JvdXBVcEFjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoRHVwbGljYXRlR3JvdXBEb3duQWN0aW9uKTtcblxucmVnaXN0ZXJBY3Rpb24yKE1vdmVFZGl0b3JUb1ByZXZpb3VzR3JvdXBBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKE1vdmVFZGl0b3JUb05leHRHcm91cEFjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoTW92ZUVkaXRvclRvRmlyc3RHcm91cEFjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoTW92ZUVkaXRvclRvTGFzdEdyb3VwQWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihNb3ZlRWRpdG9yVG9MZWZ0R3JvdXBBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKE1vdmVFZGl0b3JUb1JpZ2h0R3JvdXBBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKE1vdmVFZGl0b3JUb0Fib3ZlR3JvdXBBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKE1vdmVFZGl0b3JUb0JlbG93R3JvdXBBY3Rpb24pO1xuXG5yZWdpc3RlckFjdGlvbjIoU3BsaXRFZGl0b3JUb1ByZXZpb3VzR3JvdXBBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKFNwbGl0RWRpdG9yVG9OZXh0R3JvdXBBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKFNwbGl0RWRpdG9yVG9GaXJzdEdyb3VwQWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihTcGxpdEVkaXRvclRvTGFzdEdyb3VwQWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihTcGxpdEVkaXRvclRvTGVmdEdyb3VwQWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihTcGxpdEVkaXRvclRvUmlnaHRHcm91cEFjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoU3BsaXRFZGl0b3JUb0Fib3ZlR3JvdXBBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKFNwbGl0RWRpdG9yVG9CZWxvd0dyb3VwQWN0aW9uKTtcblxucmVnaXN0ZXJBY3Rpb24yKEZvY3VzQWN0aXZlR3JvdXBBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKEZvY3VzRmlyc3RHcm91cEFjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoRm9jdXNMYXN0R3JvdXBBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKEZvY3VzUHJldmlvdXNHcm91cCk7XG5yZWdpc3RlckFjdGlvbjIoRm9jdXNOZXh0R3JvdXApO1xucmVnaXN0ZXJBY3Rpb24yKEZvY3VzTGVmdEdyb3VwKTtcbnJlZ2lzdGVyQWN0aW9uMihGb2N1c1JpZ2h0R3JvdXApO1xucmVnaXN0ZXJBY3Rpb24yKEZvY3VzQWJvdmVHcm91cCk7XG5yZWdpc3RlckFjdGlvbjIoRm9jdXNCZWxvd0dyb3VwKTtcblxucmVnaXN0ZXJBY3Rpb24yKE5ld0VkaXRvckdyb3VwTGVmdEFjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoTmV3RWRpdG9yR3JvdXBSaWdodEFjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoTmV3RWRpdG9yR3JvdXBBYm92ZUFjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoTmV3RWRpdG9yR3JvdXBCZWxvd0FjdGlvbik7XG5cbnJlZ2lzdGVyQWN0aW9uMihOYXZpZ2F0ZVByZXZpb3VzQWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihOYXZpZ2F0ZUZvcndhcmRJbkVkaXRzQWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihOYXZpZ2F0ZUJhY2t3YXJkc0luRWRpdHNBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKE5hdmlnYXRlUHJldmlvdXNJbkVkaXRzQWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihOYXZpZ2F0ZVRvTGFzdEVkaXRMb2NhdGlvbkFjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoTmF2aWdhdGVGb3J3YXJkSW5OYXZpZ2F0aW9uc0FjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoTmF2aWdhdGVCYWNrd2FyZHNJbk5hdmlnYXRpb25zQWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihOYXZpZ2F0ZVByZXZpb3VzSW5OYXZpZ2F0aW9uc0FjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoTmF2aWdhdGVUb0xhc3ROYXZpZ2F0aW9uTG9jYXRpb25BY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKENsZWFyRWRpdG9ySGlzdG9yeUFjdGlvbik7XG5cbnJlZ2lzdGVyQWN0aW9uMihFZGl0b3JMYXlvdXRTaW5nbGVBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKEVkaXRvckxheW91dFR3b0NvbHVtbnNBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKEVkaXRvckxheW91dFRocmVlQ29sdW1uc0FjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoRWRpdG9yTGF5b3V0VHdvUm93c0FjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoRWRpdG9yTGF5b3V0VGhyZWVSb3dzQWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihFZGl0b3JMYXlvdXRUd29CeVR3b0dyaWRBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKEVkaXRvckxheW91dFR3b1Jvd3NSaWdodEFjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoRWRpdG9yTGF5b3V0VHdvQ29sdW1uc0JvdHRvbUFjdGlvbik7XG5cbnJlZ2lzdGVyQWN0aW9uMihUb2dnbGVFZGl0b3JUeXBlQWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihSZU9wZW5JblRleHRFZGl0b3JBY3Rpb24pO1xuXG5yZWdpc3RlckFjdGlvbjIoUXVpY2tBY2Nlc3NQcmV2aW91c1JlY2VudGx5VXNlZEVkaXRvckFjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoUXVpY2tBY2Nlc3NMZWFzdFJlY2VudGx5VXNlZEVkaXRvckFjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoUXVpY2tBY2Nlc3NQcmV2aW91c1JlY2VudGx5VXNlZEVkaXRvckluR3JvdXBBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKFF1aWNrQWNjZXNzTGVhc3RSZWNlbnRseVVzZWRFZGl0b3JJbkdyb3VwQWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihRdWlja0FjY2Vzc1ByZXZpb3VzRWRpdG9yRnJvbUhpc3RvcnlBY3Rpb24pO1xuXG5yZWdpc3RlckFjdGlvbjIoTW92ZUVkaXRvclRvTmV3V2luZG93QWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihDb3B5RWRpdG9yVG9OZXdpbmRvd0FjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoTW92ZUVkaXRvckdyb3VwVG9OZXdXaW5kb3dBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKENvcHlFZGl0b3JHcm91cFRvTmV3V2luZG93QWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihSZXN0b3JlRWRpdG9yc1RvTWFpbldpbmRvd0FjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoTmV3RW1wdHlFZGl0b3JXaW5kb3dBY3Rpb24pO1xuXG5jb25zdCBxdWlja0FjY2Vzc05hdmlnYXRlTmV4dEluRWRpdG9yUGlja2VySWQgPSAnd29ya2JlbmNoLmFjdGlvbi5xdWlja09wZW5OYXZpZ2F0ZU5leHRJbkVkaXRvclBpY2tlcic7XG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0aWQ6IHF1aWNrQWNjZXNzTmF2aWdhdGVOZXh0SW5FZGl0b3JQaWNrZXJJZCxcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIgKyA1MCxcblx0aGFuZGxlcjogZ2V0UXVpY2tOYXZpZ2F0ZUhhbmRsZXIocXVpY2tBY2Nlc3NOYXZpZ2F0ZU5leHRJbkVkaXRvclBpY2tlcklkLCB0cnVlKSxcblx0d2hlbjogZWRpdG9yUGlja2VyQ29udGV4dCxcblx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLlRhYixcblx0bWFjOiB7IHByaW1hcnk6IEtleU1vZC5XaW5DdHJsIHwgS2V5Q29kZS5UYWIgfVxufSk7XG5cbmNvbnN0IHF1aWNrQWNjZXNzTmF2aWdhdGVQcmV2aW91c0luRWRpdG9yUGlja2VySWQgPSAnd29ya2JlbmNoLmFjdGlvbi5xdWlja09wZW5OYXZpZ2F0ZVByZXZpb3VzSW5FZGl0b3JQaWNrZXInO1xuS2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdGlkOiBxdWlja0FjY2Vzc05hdmlnYXRlUHJldmlvdXNJbkVkaXRvclBpY2tlcklkLFxuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYiArIDUwLFxuXHRoYW5kbGVyOiBnZXRRdWlja05hdmlnYXRlSGFuZGxlcihxdWlja0FjY2Vzc05hdmlnYXRlUHJldmlvdXNJbkVkaXRvclBpY2tlcklkLCBmYWxzZSksXG5cdHdoZW46IGVkaXRvclBpY2tlckNvbnRleHQsXG5cdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5UYWIsXG5cdG1hYzogeyBwcmltYXJ5OiBLZXlNb2QuV2luQ3RybCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuVGFiIH1cbn0pO1xuXG5yZWdpc3RlckVkaXRvckNvbW1hbmRzKCk7XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gTWVudXNcblxuLy8gbWFjT1M6IFRvdWNoYmFyXG5pZiAoaXNNYWNpbnRvc2gpIHtcblx0TWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5Ub3VjaEJhckNvbnRleHQsIHtcblx0XHRjb21tYW5kOiB7IGlkOiBOYXZpZ2F0ZUJhY2t3YXJkc0FjdGlvbi5JRCwgdGl0bGU6IE5hdmlnYXRlQmFja3dhcmRzQWN0aW9uLkxBQkVMLCBpY29uOiB7IGRhcms6IEZpbGVBY2Nlc3MuYXNGaWxlVXJpKCd2cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9lZGl0b3IvbWVkaWEvYmFjay10Yi5wbmcnKSB9IH0sXG5cdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRvcmRlcjogMFxuXHR9KTtcblxuXHRNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLlRvdWNoQmFyQ29udGV4dCwge1xuXHRcdGNvbW1hbmQ6IHsgaWQ6IE5hdmlnYXRlRm9yd2FyZEFjdGlvbi5JRCwgdGl0bGU6IE5hdmlnYXRlRm9yd2FyZEFjdGlvbi5MQUJFTCwgaWNvbjogeyBkYXJrOiBGaWxlQWNjZXNzLmFzRmlsZVVyaSgndnMvd29ya2JlbmNoL2Jyb3dzZXIvcGFydHMvZWRpdG9yL21lZGlhL2ZvcndhcmQtdGIucG5nJykgfSB9LFxuXHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0b3JkZXI6IDFcblx0fSk7XG59XG5cbi8vIEVtcHR5IEVkaXRvciBHcm91cCBUb29sYmFyXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkVtcHR5RWRpdG9yR3JvdXAsIHsgY29tbWFuZDogeyBpZDogTE9DS19HUk9VUF9DT01NQU5EX0lELCB0aXRsZTogbG9jYWxpemUoJ2xvY2tHcm91cEFjdGlvbicsIFwiTG9jayBHcm91cFwiKSwgaWNvbjogQ29kaWNvbi51bmxvY2sgfSwgZ3JvdXA6ICduYXZpZ2F0aW9uJywgb3JkZXI6IDEwLCB3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoSXNBdXhpbGlhcnlFZGl0b3JQYXJ0Q29udGV4dCwgQWN0aXZlRWRpdG9yR3JvdXBMb2NrZWRDb250ZXh0LnRvTmVnYXRlZCgpKSB9KTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRW1wdHlFZGl0b3JHcm91cCwgeyBjb21tYW5kOiB7IGlkOiBVTkxPQ0tfR1JPVVBfQ09NTUFORF9JRCwgdGl0bGU6IGxvY2FsaXplKCd1bmxvY2tHcm91cEFjdGlvbicsIFwiVW5sb2NrIEdyb3VwXCIpLCBpY29uOiBDb2RpY29uLmxvY2ssIHRvZ2dsZWQ6IENvbnRleHRLZXlFeHByLnRydWUoKSB9LCBncm91cDogJ25hdmlnYXRpb24nLCBvcmRlcjogMTAsIHdoZW46IEFjdGl2ZUVkaXRvckdyb3VwTG9ja2VkQ29udGV4dCB9KTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRW1wdHlFZGl0b3JHcm91cCwgeyBjb21tYW5kOiB7IGlkOiBDTE9TRV9FRElUT1JfR1JPVVBfQ09NTUFORF9JRCwgdGl0bGU6IGxvY2FsaXplKCdjbG9zZUdyb3VwQWN0aW9uJywgXCJDbG9zZSBHcm91cFwiKSwgaWNvbjogQ29kaWNvbi5jbG9zZSB9LCBncm91cDogJ25hdmlnYXRpb24nLCBvcmRlcjogMjAsIHdoZW46IENvbnRleHRLZXlFeHByLm9yKElzQXV4aWxpYXJ5RWRpdG9yUGFydENvbnRleHQsIEVkaXRvclBhcnRNdWx0aXBsZUVkaXRvckdyb3Vwc0NvbnRleHQpIH0pO1xuXG4vLyBFbXB0eSBFZGl0b3IgR3JvdXAgQ29udGV4dCBNZW51XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkVtcHR5RWRpdG9yR3JvdXBDb250ZXh0LCB7IGNvbW1hbmQ6IHsgaWQ6IFNQTElUX0VESVRPUl9VUCwgdGl0bGU6IGxvY2FsaXplKCdzcGxpdFVwJywgXCJTcGxpdCBVcFwiKSB9LCBncm91cDogJzJfc3BsaXQnLCBvcmRlcjogMTAgfSk7XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkVtcHR5RWRpdG9yR3JvdXBDb250ZXh0LCB7IGNvbW1hbmQ6IHsgaWQ6IFNQTElUX0VESVRPUl9ET1dOLCB0aXRsZTogbG9jYWxpemUoJ3NwbGl0RG93bicsIFwiU3BsaXQgRG93blwiKSB9LCBncm91cDogJzJfc3BsaXQnLCBvcmRlcjogMjAgfSk7XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkVtcHR5RWRpdG9yR3JvdXBDb250ZXh0LCB7IGNvbW1hbmQ6IHsgaWQ6IFNQTElUX0VESVRPUl9MRUZULCB0aXRsZTogbG9jYWxpemUoJ3NwbGl0TGVmdCcsIFwiU3BsaXQgTGVmdFwiKSB9LCBncm91cDogJzJfc3BsaXQnLCBvcmRlcjogMzAgfSk7XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkVtcHR5RWRpdG9yR3JvdXBDb250ZXh0LCB7IGNvbW1hbmQ6IHsgaWQ6IFNQTElUX0VESVRPUl9SSUdIVCwgdGl0bGU6IGxvY2FsaXplKCdzcGxpdFJpZ2h0JywgXCJTcGxpdCBSaWdodFwiKSB9LCBncm91cDogJzJfc3BsaXQnLCBvcmRlcjogNDAgfSk7XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkVtcHR5RWRpdG9yR3JvdXBDb250ZXh0LCB7IGNvbW1hbmQ6IHsgaWQ6IE5FV19FTVBUWV9FRElUT1JfV0lORE9XX0NPTU1BTkRfSUQsIHRpdGxlOiBsb2NhbGl6ZSgnbmV3V2luZG93JywgXCJOZXcgV2luZG93XCIpIH0sIGdyb3VwOiAnM193aW5kb3cnLCBvcmRlcjogMTAgfSk7XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkVtcHR5RWRpdG9yR3JvdXBDb250ZXh0LCB7IGNvbW1hbmQ6IHsgaWQ6IFRPR0dMRV9MT0NLX0dST1VQX0NPTU1BTkRfSUQsIHRpdGxlOiBsb2NhbGl6ZSgndG9nZ2xlTG9ja0dyb3VwJywgXCJMb2NrIEdyb3VwXCIpLCB0b2dnbGVkOiBBY3RpdmVFZGl0b3JHcm91cExvY2tlZENvbnRleHQgfSwgZ3JvdXA6ICc0X2xvY2snLCBvcmRlcjogMTAsIHdoZW46IElzQXV4aWxpYXJ5RWRpdG9yUGFydENvbnRleHQudG9OZWdhdGVkKCkgLyogYWxyZWFkeSBhIHByaW1hcnkgYWN0aW9uIGZvciBhdXggd2luZG93cyAqLyB9KTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRW1wdHlFZGl0b3JHcm91cENvbnRleHQsIHsgY29tbWFuZDogeyBpZDogQ0xPU0VfRURJVE9SX0dST1VQX0NPTU1BTkRfSUQsIHRpdGxlOiBsb2NhbGl6ZSgnY2xvc2UnLCBcIkNsb3NlXCIpIH0sIGdyb3VwOiAnNV9jbG9zZScsIG9yZGVyOiAxMCwgd2hlbjogTXVsdGlwbGVFZGl0b3JHcm91cHNDb250ZXh0IH0pO1xuXG4vLyBFZGl0b3IgVGFiIENvbnRhaW5lciBDb250ZXh0IE1lbnVcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRWRpdG9yVGFic0JhckNvbnRleHQsIHsgY29tbWFuZDogeyBpZDogU1BMSVRfRURJVE9SX1VQLCB0aXRsZTogbG9jYWxpemUoJ3NwbGl0VXAnLCBcIlNwbGl0IFVwXCIpIH0sIGdyb3VwOiAnMl9zcGxpdCcsIG9yZGVyOiAxMCB9KTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRWRpdG9yVGFic0JhckNvbnRleHQsIHsgY29tbWFuZDogeyBpZDogU1BMSVRfRURJVE9SX0RPV04sIHRpdGxlOiBsb2NhbGl6ZSgnc3BsaXREb3duJywgXCJTcGxpdCBEb3duXCIpIH0sIGdyb3VwOiAnMl9zcGxpdCcsIG9yZGVyOiAyMCB9KTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRWRpdG9yVGFic0JhckNvbnRleHQsIHsgY29tbWFuZDogeyBpZDogU1BMSVRfRURJVE9SX0xFRlQsIHRpdGxlOiBsb2NhbGl6ZSgnc3BsaXRMZWZ0JywgXCJTcGxpdCBMZWZ0XCIpIH0sIGdyb3VwOiAnMl9zcGxpdCcsIG9yZGVyOiAzMCB9KTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRWRpdG9yVGFic0JhckNvbnRleHQsIHsgY29tbWFuZDogeyBpZDogU1BMSVRfRURJVE9SX1JJR0hULCB0aXRsZTogbG9jYWxpemUoJ3NwbGl0UmlnaHQnLCBcIlNwbGl0IFJpZ2h0XCIpIH0sIGdyb3VwOiAnMl9zcGxpdCcsIG9yZGVyOiA0MCB9KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5FZGl0b3JUYWJzQmFyQ29udGV4dCwgeyBjb21tYW5kOiB7IGlkOiBNT1ZFX0VESVRPUl9HUk9VUF9JTlRPX05FV19XSU5ET1dfQ09NTUFORF9JRCwgdGl0bGU6IGxvY2FsaXplKCdtb3ZlRWRpdG9yR3JvdXBUb05ld1dpbmRvdycsIFwiTW92ZSBpbnRvIE5ldyBXaW5kb3dcIikgfSwgZ3JvdXA6ICczX3dpbmRvdycsIG9yZGVyOiAxMCB9KTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRWRpdG9yVGFic0JhckNvbnRleHQsIHsgY29tbWFuZDogeyBpZDogQ09QWV9FRElUT1JfR1JPVVBfSU5UT19ORVdfV0lORE9XX0NPTU1BTkRfSUQsIHRpdGxlOiBsb2NhbGl6ZSgnY29weUVkaXRvckdyb3VwVG9OZXdXaW5kb3cnLCBcIkNvcHkgaW50byBOZXcgV2luZG93XCIpIH0sIGdyb3VwOiAnM193aW5kb3cnLCBvcmRlcjogMjAgfSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRWRpdG9yVGFic0JhckNvbnRleHQsIHsgc3VibWVudTogTWVudUlkLkVkaXRvclRhYnNCYXJTaG93VGFic1N1Ym1lbnUsIHRpdGxlOiBsb2NhbGl6ZSgndGFiQmFyJywgXCJUYWIgQmFyXCIpLCBncm91cDogJzRfY29uZmlnJywgb3JkZXI6IDEwLCB3aGVuOiBJbkVkaXRvclplbk1vZGVDb250ZXh0Lm5lZ2F0ZSgpIH0pO1xuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5FZGl0b3JUYWJzQmFyU2hvd1RhYnNTdWJtZW51LCB7IGNvbW1hbmQ6IHsgaWQ6IFNob3dNdWx0aXBsZUVkaXRvclRhYnNBY3Rpb24uSUQsIHRpdGxlOiBsb2NhbGl6ZSgnbXVsdGlwbGVUYWJzJywgXCJNdWx0aXBsZSBUYWJzXCIpLCB0b2dnbGVkOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2NvbmZpZy53b3JrYmVuY2guZWRpdG9yLnNob3dUYWJzJywgJ211bHRpcGxlJykgfSwgZ3JvdXA6ICcxX2NvbmZpZycsIG9yZGVyOiAxMCB9KTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRWRpdG9yVGFic0JhclNob3dUYWJzU3VibWVudSwgeyBjb21tYW5kOiB7IGlkOiBTaG93U2luZ2xlRWRpdG9yVGFiQWN0aW9uLklELCB0aXRsZTogbG9jYWxpemUoJ3NpbmdsZVRhYicsIFwiU2luZ2xlIFRhYlwiKSwgdG9nZ2xlZDogQ29udGV4dEtleUV4cHIuZXF1YWxzKCdjb25maWcud29ya2JlbmNoLmVkaXRvci5zaG93VGFicycsICdzaW5nbGUnKSB9LCBncm91cDogJzFfY29uZmlnJywgb3JkZXI6IDIwIH0pO1xuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5FZGl0b3JUYWJzQmFyU2hvd1RhYnNTdWJtZW51LCB7IGNvbW1hbmQ6IHsgaWQ6IEhpZGVFZGl0b3JUYWJzQWN0aW9uLklELCB0aXRsZTogbG9jYWxpemUoJ2hpZGVUYWJzJywgXCJIaWRkZW5cIiksIHRvZ2dsZWQ6IENvbnRleHRLZXlFeHByLmVxdWFscygnY29uZmlnLndvcmtiZW5jaC5lZGl0b3Iuc2hvd1RhYnMnLCAnbm9uZScpIH0sIGdyb3VwOiAnMV9jb25maWcnLCBvcmRlcjogMzAgfSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRWRpdG9yVGFic0JhckNvbnRleHQsIHsgc3VibWVudTogTWVudUlkLkVkaXRvclRhYnNCYXJTaG93VGFic1plbk1vZGVTdWJtZW51LCB0aXRsZTogbG9jYWxpemUoJ3RhYkJhcicsIFwiVGFiIEJhclwiKSwgZ3JvdXA6ICc0X2NvbmZpZycsIG9yZGVyOiAxMCwgd2hlbjogSW5FZGl0b3JaZW5Nb2RlQ29udGV4dCB9KTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRWRpdG9yVGFic0JhclNob3dUYWJzWmVuTW9kZVN1Ym1lbnUsIHsgY29tbWFuZDogeyBpZDogWmVuU2hvd011bHRpcGxlRWRpdG9yVGFic0FjdGlvbi5JRCwgdGl0bGU6IGxvY2FsaXplKCdtdWx0aXBsZVRhYnMnLCBcIk11bHRpcGxlIFRhYnNcIiksIHRvZ2dsZWQ6IENvbnRleHRLZXlFeHByLmVxdWFscygnY29uZmlnLnplbk1vZGUuc2hvd1RhYnMnLCAnbXVsdGlwbGUnKSB9LCBncm91cDogJzFfY29uZmlnJywgb3JkZXI6IDEwIH0pO1xuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5FZGl0b3JUYWJzQmFyU2hvd1RhYnNaZW5Nb2RlU3VibWVudSwgeyBjb21tYW5kOiB7IGlkOiBaZW5TaG93U2luZ2xlRWRpdG9yVGFiQWN0aW9uLklELCB0aXRsZTogbG9jYWxpemUoJ3NpbmdsZVRhYicsIFwiU2luZ2xlIFRhYlwiKSwgdG9nZ2xlZDogQ29udGV4dEtleUV4cHIuZXF1YWxzKCdjb25maWcuemVuTW9kZS5zaG93VGFicycsICdzaW5nbGUnKSB9LCBncm91cDogJzFfY29uZmlnJywgb3JkZXI6IDIwIH0pO1xuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5FZGl0b3JUYWJzQmFyU2hvd1RhYnNaZW5Nb2RlU3VibWVudSwgeyBjb21tYW5kOiB7IGlkOiBaZW5IaWRlRWRpdG9yVGFic0FjdGlvbi5JRCwgdGl0bGU6IGxvY2FsaXplKCdoaWRlVGFicycsIFwiSGlkZGVuXCIpLCB0b2dnbGVkOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2NvbmZpZy56ZW5Nb2RlLnNob3dUYWJzJywgJ25vbmUnKSB9LCBncm91cDogJzFfY29uZmlnJywgb3JkZXI6IDMwIH0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkVkaXRvclRhYnNCYXJDb250ZXh0LCB7IHN1Ym1lbnU6IE1lbnVJZC5FZGl0b3JBY3Rpb25zUG9zaXRpb25TdWJtZW51LCB0aXRsZTogbG9jYWxpemUoJ2VkaXRvckFjdGlvbnNQb3NpdGlvbicsIFwiRWRpdG9yIEFjdGlvbnMgUG9zaXRpb25cIiksIGdyb3VwOiAnNF9jb25maWcnLCBvcmRlcjogMjAgfSk7XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkVkaXRvckFjdGlvbnNQb3NpdGlvblN1Ym1lbnUsIHsgY29tbWFuZDogeyBpZDogRWRpdG9yQWN0aW9uc0RlZmF1bHRBY3Rpb24uSUQsIHRpdGxlOiBsb2NhbGl6ZSgndGFiQmFyJywgXCJUYWIgQmFyXCIpLCB0b2dnbGVkOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2NvbmZpZy53b3JrYmVuY2guZWRpdG9yLmVkaXRvckFjdGlvbnNMb2NhdGlvbicsICdkZWZhdWx0JykgfSwgZ3JvdXA6ICcxX2NvbmZpZycsIG9yZGVyOiAxMCwgd2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCdjb25maWcud29ya2JlbmNoLmVkaXRvci5zaG93VGFicycsICdub25lJykubmVnYXRlKCkgfSk7XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkVkaXRvckFjdGlvbnNQb3NpdGlvblN1Ym1lbnUsIHsgY29tbWFuZDogeyBpZDogRWRpdG9yQWN0aW9uc1RpdGxlQmFyQWN0aW9uLklELCB0aXRsZTogbG9jYWxpemUoJ3RpdGxlQmFyJywgXCJUaXRsZSBCYXJcIiksIHRvZ2dsZWQ6IENvbnRleHRLZXlFeHByLm9yKENvbnRleHRLZXlFeHByLmVxdWFscygnY29uZmlnLndvcmtiZW5jaC5lZGl0b3IuZWRpdG9yQWN0aW9uc0xvY2F0aW9uJywgJ3RpdGxlQmFyJyksIENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2NvbmZpZy53b3JrYmVuY2guZWRpdG9yLnNob3dUYWJzJywgJ25vbmUnKSwgQ29udGV4dEtleUV4cHIuZXF1YWxzKCdjb25maWcud29ya2JlbmNoLmVkaXRvci5lZGl0b3JBY3Rpb25zTG9jYXRpb24nLCAnZGVmYXVsdCcpKSkgfSwgZ3JvdXA6ICcxX2NvbmZpZycsIG9yZGVyOiAyMCB9KTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRWRpdG9yQWN0aW9uc1Bvc2l0aW9uU3VibWVudSwgeyBjb21tYW5kOiB7IGlkOiBIaWRlRWRpdG9yQWN0aW9uc0FjdGlvbi5JRCwgdGl0bGU6IGxvY2FsaXplKCdoaWRkZW4nLCBcIkhpZGRlblwiKSwgdG9nZ2xlZDogQ29udGV4dEtleUV4cHIuZXF1YWxzKCdjb25maWcud29ya2JlbmNoLmVkaXRvci5lZGl0b3JBY3Rpb25zTG9jYXRpb24nLCAnaGlkZGVuJykgfSwgZ3JvdXA6ICcxX2NvbmZpZycsIG9yZGVyOiAzMCB9KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5FZGl0b3JUYWJzQmFyQ29udGV4dCwgeyBjb21tYW5kOiB7IGlkOiBDb25maWd1cmVFZGl0b3JUYWJzQWN0aW9uLklELCB0aXRsZTogbG9jYWxpemUoJ2NvbmZpZ3VyZVRhYnMnLCBcIkNvbmZpZ3VyZSBUYWJzXCIpIH0sIGdyb3VwOiAnOV9jb25maWd1cmUnLCBvcmRlcjogMTAgfSk7XG5cbi8vIEVkaXRvciBUaXRsZSBDb250ZXh0IE1lbnVcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRWRpdG9yVGl0bGVDb250ZXh0LCB7IGNvbW1hbmQ6IHsgaWQ6IENMT1NFX0VESVRPUl9DT01NQU5EX0lELCB0aXRsZTogbG9jYWxpemUoJ2Nsb3NlJywgXCJDbG9zZVwiKSB9LCBncm91cDogJzFfY2xvc2UnLCBvcmRlcjogMTAgfSk7XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkVkaXRvclRpdGxlQ29udGV4dCwgeyBjb21tYW5kOiB7IGlkOiBDTE9TRV9PVEhFUl9FRElUT1JTX0lOX0dST1VQX0NPTU1BTkRfSUQsIHRpdGxlOiBsb2NhbGl6ZSgnY2xvc2VPdGhlcnMnLCBcIkNsb3NlIE90aGVyc1wiKSwgcHJlY29uZGl0aW9uOiBFZGl0b3JHcm91cEVkaXRvcnNDb3VudENvbnRleHQubm90RXF1YWxzVG8oJzEnKSB9LCBncm91cDogJzFfY2xvc2UnLCBvcmRlcjogMjAgfSk7XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkVkaXRvclRpdGxlQ29udGV4dCwgeyBjb21tYW5kOiB7IGlkOiBDTE9TRV9FRElUT1JTX1RPX1RIRV9SSUdIVF9DT01NQU5EX0lELCB0aXRsZTogbG9jYWxpemUoJ2Nsb3NlUmlnaHQnLCBcIkNsb3NlIHRvIHRoZSBSaWdodFwiKSwgcHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoQWN0aXZlRWRpdG9yTGFzdEluR3JvdXBDb250ZXh0LnRvTmVnYXRlZCgpLCBNdWx0aXBsZUVkaXRvcnNTZWxlY3RlZEluR3JvdXBDb250ZXh0Lm5lZ2F0ZSgpKSB9LCBncm91cDogJzFfY2xvc2UnLCBvcmRlcjogMzAsIHdoZW46IEVkaXRvclRhYnNWaXNpYmxlQ29udGV4dCB9KTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRWRpdG9yVGl0bGVDb250ZXh0LCB7IGNvbW1hbmQ6IHsgaWQ6IENMT1NFX1NBVkVEX0VESVRPUlNfQ09NTUFORF9JRCwgdGl0bGU6IGxvY2FsaXplKCdjbG9zZUFsbFNhdmVkJywgXCJDbG9zZSBTYXZlZFwiKSB9LCBncm91cDogJzFfY2xvc2UnLCBvcmRlcjogNDAgfSk7XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkVkaXRvclRpdGxlQ29udGV4dCwgeyBjb21tYW5kOiB7IGlkOiBDTE9TRV9FRElUT1JTX0lOX0dST1VQX0NPTU1BTkRfSUQsIHRpdGxlOiBsb2NhbGl6ZSgnY2xvc2VBbGwnLCBcIkNsb3NlIEFsbFwiKSB9LCBncm91cDogJzFfY2xvc2UnLCBvcmRlcjogNTAgfSk7XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkVkaXRvclRpdGxlQ29udGV4dCwgeyBjb21tYW5kOiB7IGlkOiBSRU9QRU5fV0lUSF9DT01NQU5EX0lELCB0aXRsZTogbG9jYWxpemUoJ3Jlb3BlbldpdGgnLCBcIlJlb3BlbiBFZGl0b3IgV2l0aC4uLlwiKSB9LCBncm91cDogJzFfb3BlbicsIG9yZGVyOiAxMCwgd2hlbjogQWN0aXZlRWRpdG9yQXZhaWxhYmxlRWRpdG9ySWRzQ29udGV4dCB9KTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRWRpdG9yVGl0bGVDb250ZXh0LCB7IGNvbW1hbmQ6IHsgaWQ6IEtFRVBfRURJVE9SX0NPTU1BTkRfSUQsIHRpdGxlOiBsb2NhbGl6ZSgna2VlcE9wZW4nLCBcIktlZXAgT3BlblwiKSwgcHJlY29uZGl0aW9uOiBBY3RpdmVFZGl0b3JQaW5uZWRDb250ZXh0LnRvTmVnYXRlZCgpIH0sIGdyb3VwOiAnM19wcmV2aWV3Jywgb3JkZXI6IDEwLCB3aGVuOiBDb250ZXh0S2V5RXhwci5oYXMoJ2NvbmZpZy53b3JrYmVuY2guZWRpdG9yLmVuYWJsZVByZXZpZXcnKSB9KTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRWRpdG9yVGl0bGVDb250ZXh0LCB7IGNvbW1hbmQ6IHsgaWQ6IFBJTl9FRElUT1JfQ09NTUFORF9JRCwgdGl0bGU6IGxvY2FsaXplKCdwaW4nLCBcIlBpblwiKSB9LCBncm91cDogJzNfcHJldmlldycsIG9yZGVyOiAyMCwgd2hlbjogQWN0aXZlRWRpdG9yU3RpY2t5Q29udGV4dC50b05lZ2F0ZWQoKSB9KTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRWRpdG9yVGl0bGVDb250ZXh0LCB7IGNvbW1hbmQ6IHsgaWQ6IFVOUElOX0VESVRPUl9DT01NQU5EX0lELCB0aXRsZTogbG9jYWxpemUoJ3VucGluJywgXCJVbnBpblwiKSB9LCBncm91cDogJzNfcHJldmlldycsIG9yZGVyOiAyMCwgd2hlbjogQWN0aXZlRWRpdG9yU3RpY2t5Q29udGV4dCB9KTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRWRpdG9yVGl0bGVDb250ZXh0LCB7IGNvbW1hbmQ6IHsgaWQ6IFNQTElUX0VESVRPUl9VUCwgdGl0bGU6IGxvY2FsaXplKCdzcGxpdFVwJywgXCJTcGxpdCBVcFwiKSB9LCBncm91cDogJzVfc3BsaXQnLCBvcmRlcjogMTAgfSk7XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkVkaXRvclRpdGxlQ29udGV4dCwgeyBjb21tYW5kOiB7IGlkOiBTUExJVF9FRElUT1JfRE9XTiwgdGl0bGU6IGxvY2FsaXplKCdzcGxpdERvd24nLCBcIlNwbGl0IERvd25cIikgfSwgZ3JvdXA6ICc1X3NwbGl0Jywgb3JkZXI6IDIwIH0pO1xuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5FZGl0b3JUaXRsZUNvbnRleHQsIHsgY29tbWFuZDogeyBpZDogU1BMSVRfRURJVE9SX0xFRlQsIHRpdGxlOiBsb2NhbGl6ZSgnc3BsaXRMZWZ0JywgXCJTcGxpdCBMZWZ0XCIpIH0sIGdyb3VwOiAnNV9zcGxpdCcsIG9yZGVyOiAzMCB9KTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRWRpdG9yVGl0bGVDb250ZXh0LCB7IGNvbW1hbmQ6IHsgaWQ6IFNQTElUX0VESVRPUl9SSUdIVCwgdGl0bGU6IGxvY2FsaXplKCdzcGxpdFJpZ2h0JywgXCJTcGxpdCBSaWdodFwiKSB9LCBncm91cDogJzVfc3BsaXQnLCBvcmRlcjogNDAgfSk7XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkVkaXRvclRpdGxlQ29udGV4dCwgeyBjb21tYW5kOiB7IGlkOiBTUExJVF9FRElUT1JfSU5fR1JPVVAsIHRpdGxlOiBsb2NhbGl6ZSgnc3BsaXRJbkdyb3VwJywgXCJTcGxpdCBpbiBHcm91cFwiKSwgcHJlY29uZGl0aW9uOiBNdWx0aXBsZUVkaXRvcnNTZWxlY3RlZEluR3JvdXBDb250ZXh0Lm5lZ2F0ZSgpIH0sIGdyb3VwOiAnNl9zcGxpdF9pbl9ncm91cCcsIG9yZGVyOiAxMCwgd2hlbjogQWN0aXZlRWRpdG9yQ2FuU3BsaXRJbkdyb3VwQ29udGV4dCB9KTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRWRpdG9yVGl0bGVDb250ZXh0LCB7IGNvbW1hbmQ6IHsgaWQ6IEpPSU5fRURJVE9SX0lOX0dST1VQLCB0aXRsZTogbG9jYWxpemUoJ2pvaW5Jbkdyb3VwJywgXCJKb2luIGluIEdyb3VwXCIpLCBwcmVjb25kaXRpb246IE11bHRpcGxlRWRpdG9yc1NlbGVjdGVkSW5Hcm91cENvbnRleHQubmVnYXRlKCkgfSwgZ3JvdXA6ICc2X3NwbGl0X2luX2dyb3VwJywgb3JkZXI6IDEwLCB3aGVuOiBTaWRlQnlTaWRlRWRpdG9yQWN0aXZlQ29udGV4dCB9KTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRWRpdG9yVGl0bGVDb250ZXh0LCB7IGNvbW1hbmQ6IHsgaWQ6IE1PVkVfRURJVE9SX0lOVE9fTkVXX1dJTkRPV19DT01NQU5EX0lELCB0aXRsZTogbG9jYWxpemUoJ21vdmVUb05ld1dpbmRvdycsIFwiTW92ZSBpbnRvIE5ldyBXaW5kb3dcIikgfSwgZ3JvdXA6ICc3X25ld193aW5kb3cnLCBvcmRlcjogMTAgfSk7XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkVkaXRvclRpdGxlQ29udGV4dCwgeyBjb21tYW5kOiB7IGlkOiBDT1BZX0VESVRPUl9JTlRPX05FV19XSU5ET1dfQ09NTUFORF9JRCwgdGl0bGU6IGxvY2FsaXplKCdjb3B5VG9OZXdXaW5kb3cnLCBcIkNvcHkgaW50byBOZXcgV2luZG93XCIpIH0sIGdyb3VwOiAnN19uZXdfd2luZG93Jywgb3JkZXI6IDIwIH0pO1xuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5FZGl0b3JUaXRsZUNvbnRleHQsIHsgc3VibWVudTogTWVudUlkLkVkaXRvclRpdGxlQ29udGV4dFNoYXJlLCB0aXRsZTogbG9jYWxpemUoJ3NoYXJlJywgXCJTaGFyZVwiKSwgZ3JvdXA6ICcxMV9zaGFyZScsIG9yZGVyOiAtMSwgd2hlbjogTXVsdGlwbGVFZGl0b3JzU2VsZWN0ZWRJbkdyb3VwQ29udGV4dC5uZWdhdGUoKSB9KTtcblxuLy8gRWRpdG9yIFRpdGxlIE1lbnVcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRWRpdG9yVGl0bGUsIHsgY29tbWFuZDogeyBpZDogVE9HR0xFX0RJRkZfU0lERV9CWV9TSURFLCB0aXRsZTogbG9jYWxpemUoJ2lubGluZVZpZXcnLCBcIklubGluZSBWaWV3XCIpLCB0b2dnbGVkOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2NvbmZpZy5kaWZmRWRpdG9yLnJlbmRlclNpZGVCeVNpZGUnLCBmYWxzZSkgfSwgZ3JvdXA6ICcxX2RpZmYnLCBvcmRlcjogMTAsIHdoZW46IENvbnRleHRLZXlFeHByLmhhcygnaXNJbkRpZmZFZGl0b3InKSB9KTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRWRpdG9yVGl0bGUsIHsgY29tbWFuZDogeyBpZDogU0hPV19FRElUT1JTX0lOX0dST1VQLCB0aXRsZTogbG9jYWxpemUoJ3Nob3dPcGVuZWRFZGl0b3JzJywgXCJTaG93IE9wZW5lZCBFZGl0b3JzXCIpIH0sIGdyb3VwOiAnM19vcGVuJywgb3JkZXI6IDEwIH0pO1xuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5FZGl0b3JUaXRsZSwgeyBjb21tYW5kOiB7IGlkOiBDTE9TRV9FRElUT1JTX0lOX0dST1VQX0NPTU1BTkRfSUQsIHRpdGxlOiBsb2NhbGl6ZSgnY2xvc2VBbGwnLCBcIkNsb3NlIEFsbFwiKSB9LCBncm91cDogJzVfY2xvc2UnLCBvcmRlcjogMTAgfSk7XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkVkaXRvclRpdGxlLCB7IGNvbW1hbmQ6IHsgaWQ6IENMT1NFX1NBVkVEX0VESVRPUlNfQ09NTUFORF9JRCwgdGl0bGU6IGxvY2FsaXplKCdjbG9zZUFsbFNhdmVkJywgXCJDbG9zZSBTYXZlZFwiKSB9LCBncm91cDogJzVfY2xvc2UnLCBvcmRlcjogMjAgfSk7XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkVkaXRvclRpdGxlLCB7IGNvbW1hbmQ6IHsgaWQ6IFRPR0dMRV9LRUVQX0VESVRPUlNfQ09NTUFORF9JRCwgdGl0bGU6IGxvY2FsaXplKCd0b2dnbGVQcmV2aWV3TW9kZScsIFwiRW5hYmxlIFByZXZpZXcgRWRpdG9yc1wiKSwgdG9nZ2xlZDogQ29udGV4dEtleUV4cHIuaGFzKCdjb25maWcud29ya2JlbmNoLmVkaXRvci5lbmFibGVQcmV2aWV3JykgfSwgZ3JvdXA6ICc3X3NldHRpbmdzJywgb3JkZXI6IDEwIH0pO1xuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5FZGl0b3JUaXRsZSwgeyBjb21tYW5kOiB7IGlkOiBUT0dHTEVfTUFYSU1JWkVfRURJVE9SX0dST1VQLCB0aXRsZTogbG9jYWxpemUoJ21heGltaXplR3JvdXAnLCBcIk1heGltaXplIEdyb3VwXCIpIH0sIGdyb3VwOiAnOF9ncm91cF9vcGVyYXRpb25zJywgb3JkZXI6IDUsIHdoZW46IENvbnRleHRLZXlFeHByLmFuZChFZGl0b3JQYXJ0TWF4aW1pemVkRWRpdG9yR3JvdXBDb250ZXh0Lm5lZ2F0ZSgpLCBFZGl0b3JQYXJ0TXVsdGlwbGVFZGl0b3JHcm91cHNDb250ZXh0KSB9KTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRWRpdG9yVGl0bGUsIHsgY29tbWFuZDogeyBpZDogVE9HR0xFX01BWElNSVpFX0VESVRPUl9HUk9VUCwgdGl0bGU6IGxvY2FsaXplKCd1bm1heGltaXplR3JvdXAnLCBcIlVubWF4aW1pemUgR3JvdXBcIikgfSwgZ3JvdXA6ICc4X2dyb3VwX29wZXJhdGlvbnMnLCBvcmRlcjogNSwgd2hlbjogRWRpdG9yUGFydE1heGltaXplZEVkaXRvckdyb3VwQ29udGV4dCB9KTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRWRpdG9yVGl0bGUsIHsgY29tbWFuZDogeyBpZDogVE9HR0xFX0xPQ0tfR1JPVVBfQ09NTUFORF9JRCwgdGl0bGU6IGxvY2FsaXplKCdsb2NrR3JvdXAnLCBcIkxvY2sgR3JvdXBcIiksIHRvZ2dsZWQ6IEFjdGl2ZUVkaXRvckdyb3VwTG9ja2VkQ29udGV4dCB9LCBncm91cDogJzhfZ3JvdXBfb3BlcmF0aW9ucycsIG9yZGVyOiAxMCwgd2hlbjogSXNBdXhpbGlhcnlFZGl0b3JQYXJ0Q29udGV4dC50b05lZ2F0ZWQoKSAvKiBhbHJlYWR5IGEgcHJpbWFyeSBhY3Rpb24gZm9yIGF1eCB3aW5kb3dzICovIH0pO1xuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5FZGl0b3JUaXRsZSwgeyBjb21tYW5kOiB7IGlkOiBDb25maWd1cmVFZGl0b3JBY3Rpb24uSUQsIHRpdGxlOiBsb2NhbGl6ZSgnY29uZmlndXJlRWRpdG9ycycsIFwiQ29uZmlndXJlIEVkaXRvcnNcIikgfSwgZ3JvdXA6ICc5X2NvbmZpZ3VyZScsIG9yZGVyOiAxMCB9KTtcblxuZnVuY3Rpb24gYXBwZW5kRWRpdG9yVG9vbEl0ZW0ocHJpbWFyeTogSUNvbW1hbmRBY3Rpb24sIHdoZW46IENvbnRleHRLZXlFeHByZXNzaW9uIHwgdW5kZWZpbmVkLCBvcmRlcjogbnVtYmVyLCBhbHRlcm5hdGl2ZT86IElDb21tYW5kQWN0aW9uLCBwcmVjb25kaXRpb24/OiBDb250ZXh0S2V5RXhwcmVzc2lvbiB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRjb25zdCBpdGVtOiBJTWVudUl0ZW0gPSB7XG5cdFx0Y29tbWFuZDoge1xuXHRcdFx0aWQ6IHByaW1hcnkuaWQsXG5cdFx0XHR0aXRsZTogcHJpbWFyeS50aXRsZSxcblx0XHRcdGljb246IHByaW1hcnkuaWNvbixcblx0XHRcdHRvZ2dsZWQ6IHByaW1hcnkudG9nZ2xlZCxcblx0XHRcdHByZWNvbmRpdGlvblxuXHRcdH0sXG5cdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHR3aGVuLFxuXHRcdG9yZGVyXG5cdH07XG5cblx0aWYgKGFsdGVybmF0aXZlKSB7XG5cdFx0aXRlbS5hbHQgPSB7XG5cdFx0XHRpZDogYWx0ZXJuYXRpdmUuaWQsXG5cdFx0XHR0aXRsZTogYWx0ZXJuYXRpdmUudGl0bGUsXG5cdFx0XHRpY29uOiBhbHRlcm5hdGl2ZS5pY29uXG5cdFx0fTtcblx0fVxuXG5cdE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRWRpdG9yVGl0bGUsIGl0ZW0pO1xufVxuXG5jb25zdCBTUExJVF9PUkRFUiA9IDEwMDAwMDsgIC8vIHRvd2FyZHMgdGhlIGVuZFxuY29uc3QgQ0xPU0VfT1JERVIgPSAxMDAwMDAwOyAvLyB0b3dhcmRzIHRoZSBmYXIgZW5kXG5cbi8vIEVkaXRvciBUaXRsZSBNZW51OiBTcGxpdCBFZGl0b3JcbmFwcGVuZEVkaXRvclRvb2xJdGVtKFxuXHR7XG5cdFx0aWQ6IFNQTElUX0VESVRPUixcblx0XHR0aXRsZTogbG9jYWxpemUoJ3NwbGl0RWRpdG9yUmlnaHQnLCBcIlNwbGl0IEVkaXRvciBSaWdodFwiKSxcblx0XHRpY29uOiBDb2RpY29uLnNwbGl0SG9yaXpvbnRhbFxuXHR9LFxuXHRDb250ZXh0S2V5RXhwci5ub3QoJ3NwbGl0RWRpdG9yc1ZlcnRpY2FsbHknKSxcblx0U1BMSVRfT1JERVIsXG5cdHtcblx0XHRpZDogU1BMSVRfRURJVE9SX0RPV04sXG5cdFx0dGl0bGU6IGxvY2FsaXplKCdzcGxpdEVkaXRvckRvd24nLCBcIlNwbGl0IEVkaXRvciBEb3duXCIpLFxuXHRcdGljb246IENvZGljb24uc3BsaXRWZXJ0aWNhbFxuXHR9XG4pO1xuXG5hcHBlbmRFZGl0b3JUb29sSXRlbShcblx0e1xuXHRcdGlkOiBTUExJVF9FRElUT1IsXG5cdFx0dGl0bGU6IGxvY2FsaXplKCdzcGxpdEVkaXRvckRvd24nLCBcIlNwbGl0IEVkaXRvciBEb3duXCIpLFxuXHRcdGljb246IENvZGljb24uc3BsaXRWZXJ0aWNhbFxuXHR9LFxuXHRDb250ZXh0S2V5RXhwci5oYXMoJ3NwbGl0RWRpdG9yc1ZlcnRpY2FsbHknKSxcblx0U1BMSVRfT1JERVIsXG5cdHtcblx0XHRpZDogU1BMSVRfRURJVE9SX1JJR0hULFxuXHRcdHRpdGxlOiBsb2NhbGl6ZSgnc3BsaXRFZGl0b3JSaWdodCcsIFwiU3BsaXQgRWRpdG9yIFJpZ2h0XCIpLFxuXHRcdGljb246IENvZGljb24uc3BsaXRIb3Jpem9udGFsXG5cdH1cbik7XG5cbi8vIFNpZGUgYnkgc2lkZTogbGF5b3V0XG5hcHBlbmRFZGl0b3JUb29sSXRlbShcblx0e1xuXHRcdGlkOiBUT0dHTEVfU1BMSVRfRURJVE9SX0lOX0dST1VQX0xBWU9VVCxcblx0XHR0aXRsZTogbG9jYWxpemUoJ3RvZ2dsZVNwbGl0RWRpdG9ySW5Hcm91cExheW91dCcsIFwiVG9nZ2xlIExheW91dFwiKSxcblx0XHRpY29uOiBDb2RpY29uLmVkaXRvckxheW91dFxuXHR9LFxuXHRTaWRlQnlTaWRlRWRpdG9yQWN0aXZlQ29udGV4dCxcblx0U1BMSVRfT1JERVIgLSAxLCAvLyBsZWZ0IHRvIHNwbGl0IGFjdGlvbnNcbik7XG5cbi8vIEVkaXRvciBUaXRsZSBNZW51OiBDbG9zZSAodGFicyBkaXNhYmxlZCwgbm9ybWFsIGVkaXRvcilcbmFwcGVuZEVkaXRvclRvb2xJdGVtKFxuXHR7XG5cdFx0aWQ6IENMT1NFX0VESVRPUl9DT01NQU5EX0lELFxuXHRcdHRpdGxlOiBsb2NhbGl6ZSgnY2xvc2UnLCBcIkNsb3NlXCIpLFxuXHRcdGljb246IENvZGljb24uY2xvc2Vcblx0fSxcblx0Q29udGV4dEtleUV4cHIuYW5kKEVkaXRvclRhYnNWaXNpYmxlQ29udGV4dC50b05lZ2F0ZWQoKSwgQWN0aXZlRWRpdG9yRGlydHlDb250ZXh0LnRvTmVnYXRlZCgpLCBBY3RpdmVFZGl0b3JTdGlja3lDb250ZXh0LnRvTmVnYXRlZCgpKSxcblx0Q0xPU0VfT1JERVIsXG5cdHtcblx0XHRpZDogQ0xPU0VfRURJVE9SU19JTl9HUk9VUF9DT01NQU5EX0lELFxuXHRcdHRpdGxlOiBsb2NhbGl6ZSgnY2xvc2VBbGwnLCBcIkNsb3NlIEFsbFwiKSxcblx0XHRpY29uOiBDb2RpY29uLmNsb3NlQWxsXG5cdH1cbik7XG5cbi8vIEVkaXRvciBUaXRsZSBNZW51OiBDbG9zZSAodGFicyBkaXNhYmxlZCwgZGlydHkgZWRpdG9yKVxuYXBwZW5kRWRpdG9yVG9vbEl0ZW0oXG5cdHtcblx0XHRpZDogQ0xPU0VfRURJVE9SX0NPTU1BTkRfSUQsXG5cdFx0dGl0bGU6IGxvY2FsaXplKCdjbG9zZScsIFwiQ2xvc2VcIiksXG5cdFx0aWNvbjogQ29kaWNvbi5jbG9zZURpcnR5XG5cdH0sXG5cdENvbnRleHRLZXlFeHByLmFuZChFZGl0b3JUYWJzVmlzaWJsZUNvbnRleHQudG9OZWdhdGVkKCksIEFjdGl2ZUVkaXRvckRpcnR5Q29udGV4dCwgQWN0aXZlRWRpdG9yU3RpY2t5Q29udGV4dC50b05lZ2F0ZWQoKSksXG5cdENMT1NFX09SREVSLFxuXHR7XG5cdFx0aWQ6IENMT1NFX0VESVRPUlNfSU5fR1JPVVBfQ09NTUFORF9JRCxcblx0XHR0aXRsZTogbG9jYWxpemUoJ2Nsb3NlQWxsJywgXCJDbG9zZSBBbGxcIiksXG5cdFx0aWNvbjogQ29kaWNvbi5jbG9zZUFsbFxuXHR9XG4pO1xuXG4vLyBFZGl0b3IgVGl0bGUgTWVudTogQ2xvc2UgKHRhYnMgZGlzYWJsZWQsIHN0aWNreSBlZGl0b3IpXG5hcHBlbmRFZGl0b3JUb29sSXRlbShcblx0e1xuXHRcdGlkOiBVTlBJTl9FRElUT1JfQ09NTUFORF9JRCxcblx0XHR0aXRsZTogbG9jYWxpemUoJ3VucGluJywgXCJVbnBpblwiKSxcblx0XHRpY29uOiBDb2RpY29uLnBpbm5lZFxuXHR9LFxuXHRDb250ZXh0S2V5RXhwci5hbmQoRWRpdG9yVGFic1Zpc2libGVDb250ZXh0LnRvTmVnYXRlZCgpLCBBY3RpdmVFZGl0b3JEaXJ0eUNvbnRleHQudG9OZWdhdGVkKCksIEFjdGl2ZUVkaXRvclN0aWNreUNvbnRleHQpLFxuXHRDTE9TRV9PUkRFUixcblx0e1xuXHRcdGlkOiBDTE9TRV9FRElUT1JfQ09NTUFORF9JRCxcblx0XHR0aXRsZTogbG9jYWxpemUoJ2Nsb3NlJywgXCJDbG9zZVwiKSxcblx0XHRpY29uOiBDb2RpY29uLmNsb3NlXG5cdH1cbik7XG5cbi8vIEVkaXRvciBUaXRsZSBNZW51OiBDbG9zZSAodGFicyBkaXNhYmxlZCwgZGlydHkgJiBzdGlja3kgZWRpdG9yKVxuYXBwZW5kRWRpdG9yVG9vbEl0ZW0oXG5cdHtcblx0XHRpZDogVU5QSU5fRURJVE9SX0NPTU1BTkRfSUQsXG5cdFx0dGl0bGU6IGxvY2FsaXplKCd1bnBpbicsIFwiVW5waW5cIiksXG5cdFx0aWNvbjogQ29kaWNvbi5waW5uZWREaXJ0eVxuXHR9LFxuXHRDb250ZXh0S2V5RXhwci5hbmQoRWRpdG9yVGFic1Zpc2libGVDb250ZXh0LnRvTmVnYXRlZCgpLCBBY3RpdmVFZGl0b3JEaXJ0eUNvbnRleHQsIEFjdGl2ZUVkaXRvclN0aWNreUNvbnRleHQpLFxuXHRDTE9TRV9PUkRFUixcblx0e1xuXHRcdGlkOiBDTE9TRV9FRElUT1JfQ09NTUFORF9JRCxcblx0XHR0aXRsZTogbG9jYWxpemUoJ2Nsb3NlJywgXCJDbG9zZVwiKSxcblx0XHRpY29uOiBDb2RpY29uLmNsb3NlXG5cdH1cbik7XG5cbi8vIExvY2sgR3JvdXA6IG9ubHkgb24gYXV4aWxpYXJ5IHdpbmRvdyBhbmQgd2hlbiBncm91cCBpcyB1bmxvY2tlZFxuYXBwZW5kRWRpdG9yVG9vbEl0ZW0oXG5cdHtcblx0XHRpZDogTE9DS19HUk9VUF9DT01NQU5EX0lELFxuXHRcdHRpdGxlOiBsb2NhbGl6ZSgnbG9ja0VkaXRvckdyb3VwJywgXCJMb2NrIEdyb3VwXCIpLFxuXHRcdGljb246IENvZGljb24udW5sb2NrXG5cdH0sXG5cdENvbnRleHRLZXlFeHByLmFuZChJc0F1eGlsaWFyeUVkaXRvclBhcnRDb250ZXh0LCBBY3RpdmVFZGl0b3JHcm91cExvY2tlZENvbnRleHQudG9OZWdhdGVkKCkpLFxuXHRDTE9TRV9PUkRFUiAtIDEsIC8vIGltbWVkaWF0ZWx5IHRvIHRoZSBsZWZ0IG9mIGNsb3NlIGFjdGlvblxuKTtcblxuLy8gVW5sb2NrIEdyb3VwOiBvbmx5IHdoZW4gZ3JvdXAgaXMgbG9ja2VkXG5hcHBlbmRFZGl0b3JUb29sSXRlbShcblx0e1xuXHRcdGlkOiBVTkxPQ0tfR1JPVVBfQ09NTUFORF9JRCxcblx0XHR0aXRsZTogbG9jYWxpemUoJ3VubG9ja0VkaXRvckdyb3VwJywgXCJVbmxvY2sgR3JvdXBcIiksXG5cdFx0aWNvbjogQ29kaWNvbi5sb2NrLFxuXHRcdHRvZ2dsZWQ6IENvbnRleHRLZXlFeHByLnRydWUoKVxuXHR9LFxuXHRBY3RpdmVFZGl0b3JHcm91cExvY2tlZENvbnRleHQsXG5cdENMT1NFX09SREVSIC0gMSwgLy8gaW1tZWRpYXRlbHkgdG8gdGhlIGxlZnQgb2YgY2xvc2UgYWN0aW9uXG4pO1xuXG4vLyBEaWZmIEVkaXRvciBUaXRsZSBNZW51OiBQcmV2aW91cyBDaGFuZ2VcbmNvbnN0IHByZXZpb3VzQ2hhbmdlSWNvbiA9IHJlZ2lzdGVySWNvbignZGlmZi1lZGl0b3ItcHJldmlvdXMtY2hhbmdlJywgQ29kaWNvbi5hcnJvd1VwLCBsb2NhbGl6ZSgncHJldmlvdXNDaGFuZ2VJY29uJywgJ0ljb24gZm9yIHRoZSBwcmV2aW91cyBjaGFuZ2UgYWN0aW9uIGluIHRoZSBkaWZmIGVkaXRvci4nKSk7XG5hcHBlbmRFZGl0b3JUb29sSXRlbShcblx0e1xuXHRcdGlkOiBHT1RPX1BSRVZJT1VTX0NIQU5HRSxcblx0XHR0aXRsZTogbG9jYWxpemUoJ25hdmlnYXRlLnByZXYubGFiZWwnLCBcIlByZXZpb3VzIENoYW5nZVwiKSxcblx0XHRpY29uOiBwcmV2aW91c0NoYW5nZUljb25cblx0fSxcblx0VGV4dENvbXBhcmVFZGl0b3JBY3RpdmVDb250ZXh0LFxuXHQxMCxcblx0dW5kZWZpbmVkLFxuXHRFZGl0b3JDb250ZXh0S2V5cy5oYXNDaGFuZ2VzXG4pO1xuXG4vLyBEaWZmIEVkaXRvciBUaXRsZSBNZW51OiBOZXh0IENoYW5nZVxuY29uc3QgbmV4dENoYW5nZUljb24gPSByZWdpc3Rlckljb24oJ2RpZmYtZWRpdG9yLW5leHQtY2hhbmdlJywgQ29kaWNvbi5hcnJvd0Rvd24sIGxvY2FsaXplKCduZXh0Q2hhbmdlSWNvbicsICdJY29uIGZvciB0aGUgbmV4dCBjaGFuZ2UgYWN0aW9uIGluIHRoZSBkaWZmIGVkaXRvci4nKSk7XG5hcHBlbmRFZGl0b3JUb29sSXRlbShcblx0e1xuXHRcdGlkOiBHT1RPX05FWFRfQ0hBTkdFLFxuXHRcdHRpdGxlOiBsb2NhbGl6ZSgnbmF2aWdhdGUubmV4dC5sYWJlbCcsIFwiTmV4dCBDaGFuZ2VcIiksXG5cdFx0aWNvbjogbmV4dENoYW5nZUljb25cblx0fSxcblx0VGV4dENvbXBhcmVFZGl0b3JBY3RpdmVDb250ZXh0LFxuXHQxMSxcblx0dW5kZWZpbmVkLFxuXHRFZGl0b3JDb250ZXh0S2V5cy5oYXNDaGFuZ2VzXG4pO1xuXG4vLyBEaWZmIEVkaXRvciBUaXRsZSBNZW51OiBTd2FwIFNpZGVzXG5hcHBlbmRFZGl0b3JUb29sSXRlbShcblx0e1xuXHRcdGlkOiBESUZGX1NXQVBfU0lERVMsXG5cdFx0dGl0bGU6IGxvY2FsaXplKCdzd2FwRGlmZlNpZGVzJywgXCJTd2FwIExlZnQgYW5kIFJpZ2h0IFNpZGVcIiksXG5cdFx0aWNvbjogQ29kaWNvbi5hcnJvd1N3YXBcblx0fSxcblx0Q29udGV4dEtleUV4cHIuYW5kKFRleHRDb21wYXJlRWRpdG9yQWN0aXZlQ29udGV4dCwgQWN0aXZlQ29tcGFyZUVkaXRvckNhblN3YXBDb250ZXh0KSxcblx0MTUsXG5cdHVuZGVmaW5lZCxcblx0dW5kZWZpbmVkXG4pO1xuXG5jb25zdCB0b2dnbGVXaGl0ZXNwYWNlID0gcmVnaXN0ZXJJY29uKCdkaWZmLWVkaXRvci10b2dnbGUtd2hpdGVzcGFjZScsIENvZGljb24ud2hpdGVzcGFjZSwgbG9jYWxpemUoJ3RvZ2dsZVdoaXRlc3BhY2UnLCAnSWNvbiBmb3IgdGhlIHRvZ2dsZSB3aGl0ZXNwYWNlIGFjdGlvbiBpbiB0aGUgZGlmZiBlZGl0b3IuJykpO1xuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5FZGl0b3JUaXRsZSwge1xuXHRjb21tYW5kOiB7XG5cdFx0aWQ6IFRPR0dMRV9ESUZGX0lHTk9SRV9UUklNX1dISVRFU1BBQ0UsXG5cdFx0dGl0bGU6IGxvY2FsaXplKCdpZ25vcmVUcmltV2hpdGVzcGFjZS5sYWJlbCcsIFwiU2hvdyBMZWFkaW5nL1RyYWlsaW5nIFdoaXRlc3BhY2UgRGlmZmVyZW5jZXNcIiksXG5cdFx0aWNvbjogdG9nZ2xlV2hpdGVzcGFjZSxcblx0XHRwcmVjb25kaXRpb246IFRleHRDb21wYXJlRWRpdG9yQWN0aXZlQ29udGV4dCxcblx0XHR0b2dnbGVkOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2NvbmZpZy5kaWZmRWRpdG9yLmlnbm9yZVRyaW1XaGl0ZXNwYWNlJywgZmFsc2UpLFxuXHR9LFxuXHRncm91cDogJ25hdmlnYXRpb24nLFxuXHR3aGVuOiBUZXh0Q29tcGFyZUVkaXRvckFjdGl2ZUNvbnRleHQsXG5cdG9yZGVyOiAyMCxcbn0pO1xuXG4vLyBFZGl0b3IgQ29tbWFuZHMgZm9yIENvbW1hbmQgUGFsZXR0ZVxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5Db21tYW5kUGFsZXR0ZSwgeyBjb21tYW5kOiB7IGlkOiBLRUVQX0VESVRPUl9DT01NQU5EX0lELCB0aXRsZTogbG9jYWxpemUyKCdrZWVwRWRpdG9yJywgJ0tlZXAgRWRpdG9yJyksIGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXcgfSwgd2hlbjogQ29udGV4dEtleUV4cHIuaGFzKCdjb25maWcud29ya2JlbmNoLmVkaXRvci5lbmFibGVQcmV2aWV3JykgfSk7XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkNvbW1hbmRQYWxldHRlLCB7IGNvbW1hbmQ6IHsgaWQ6IFBJTl9FRElUT1JfQ09NTUFORF9JRCwgdGl0bGU6IGxvY2FsaXplMigncGluRWRpdG9yJywgJ1BpbiBFZGl0b3InKSwgY2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlldyB9IH0pO1xuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5Db21tYW5kUGFsZXR0ZSwgeyBjb21tYW5kOiB7IGlkOiBVTlBJTl9FRElUT1JfQ09NTUFORF9JRCwgdGl0bGU6IGxvY2FsaXplMigndW5waW5FZGl0b3InLCAnVW5waW4gRWRpdG9yJyksIGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXcgfSB9KTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuQ29tbWFuZFBhbGV0dGUsIHsgY29tbWFuZDogeyBpZDogQ0xPU0VfRURJVE9SX0NPTU1BTkRfSUQsIHRpdGxlOiBsb2NhbGl6ZTIoJ2Nsb3NlRWRpdG9yJywgJ0Nsb3NlIEVkaXRvcicpLCBjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3IH0gfSk7XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkNvbW1hbmRQYWxldHRlLCB7IGNvbW1hbmQ6IHsgaWQ6IENMT1NFX1BJTk5FRF9FRElUT1JfQ09NTUFORF9JRCwgdGl0bGU6IGxvY2FsaXplMignY2xvc2VQaW5uZWRFZGl0b3InLCAnQ2xvc2UgUGlubmVkIEVkaXRvcicpLCBjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3IH0gfSk7XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkNvbW1hbmRQYWxldHRlLCB7IGNvbW1hbmQ6IHsgaWQ6IENMT1NFX0VESVRPUlNfSU5fR1JPVVBfQ09NTUFORF9JRCwgdGl0bGU6IGxvY2FsaXplMignY2xvc2VFZGl0b3JzSW5Hcm91cCcsICdDbG9zZSBBbGwgRWRpdG9ycyBpbiBHcm91cCcpLCBjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3IH0gfSk7XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkNvbW1hbmRQYWxldHRlLCB7IGNvbW1hbmQ6IHsgaWQ6IENMT1NFX1NBVkVEX0VESVRPUlNfQ09NTUFORF9JRCwgdGl0bGU6IGxvY2FsaXplMignY2xvc2VTYXZlZEVkaXRvcnMnLCAnQ2xvc2UgU2F2ZWQgRWRpdG9ycyBpbiBHcm91cCcpLCBjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3IH0gfSk7XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkNvbW1hbmRQYWxldHRlLCB7IGNvbW1hbmQ6IHsgaWQ6IENMT1NFX09USEVSX0VESVRPUlNfSU5fR1JPVVBfQ09NTUFORF9JRCwgdGl0bGU6IGxvY2FsaXplMignY2xvc2VPdGhlckVkaXRvcnMnLCAnQ2xvc2UgT3RoZXIgRWRpdG9ycyBpbiBHcm91cCcpLCBjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3IH0gfSk7XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkNvbW1hbmRQYWxldHRlLCB7IGNvbW1hbmQ6IHsgaWQ6IENMT1NFX0VESVRPUlNfVE9fVEhFX1JJR0hUX0NPTU1BTkRfSUQsIHRpdGxlOiBsb2NhbGl6ZTIoJ2Nsb3NlUmlnaHRFZGl0b3JzJywgJ0Nsb3NlIEVkaXRvcnMgdG8gdGhlIFJpZ2h0IGluIEdyb3VwJyksIGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXcgfSwgd2hlbjogQWN0aXZlRWRpdG9yTGFzdEluR3JvdXBDb250ZXh0LnRvTmVnYXRlZCgpIH0pO1xuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5Db21tYW5kUGFsZXR0ZSwgeyBjb21tYW5kOiB7IGlkOiBDTE9TRV9FRElUT1JTX0FORF9HUk9VUF9DT01NQU5EX0lELCB0aXRsZTogbG9jYWxpemUyKCdjbG9zZUVkaXRvckdyb3VwJywgJ0Nsb3NlIEVkaXRvciBHcm91cCcpLCBjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3IH0sIHdoZW46IE11bHRpcGxlRWRpdG9yR3JvdXBzQ29udGV4dCB9KTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuQ29tbWFuZFBhbGV0dGUsIHsgY29tbWFuZDogeyBpZDogUkVPUEVOX1dJVEhfQ09NTUFORF9JRCwgdGl0bGU6IGxvY2FsaXplMigncmVvcGVuV2l0aCcsIFwiUmVvcGVuIEVkaXRvciBXaXRoLi4uXCIpLCBjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3IH0sIHdoZW46IEFjdGl2ZUVkaXRvckF2YWlsYWJsZUVkaXRvcklkc0NvbnRleHQgfSk7XG5cbi8vIEZpbGUgbWVudVxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyUmVjZW50TWVudSwge1xuXHRncm91cDogJzFfZWRpdG9yJyxcblx0Y29tbWFuZDoge1xuXHRcdGlkOiBSZW9wZW5DbG9zZWRFZGl0b3JBY3Rpb24uSUQsXG5cdFx0dGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlSZW9wZW5DbG9zZWRFZGl0b3InLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZSZW9wZW4gQ2xvc2VkIEVkaXRvclwiKSxcblx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmhhcygnY2FuUmVvcGVuQ2xvc2VkRWRpdG9yJylcblx0fSxcblx0b3JkZXI6IDFcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJSZWNlbnRNZW51LCB7XG5cdGdyb3VwOiAnel9jbGVhcicsXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogQ2xlYXJSZWNlbnRGaWxlc0FjdGlvbi5JRCxcblx0XHR0aXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaUNsZWFyUmVjZW50T3BlbicsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJkNsZWFyIFJlY2VudGx5IE9wZW5lZC4uLlwiKVxuXHR9LFxuXHRvcmRlcjogMVxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuTWVudWJhckZpbGVNZW51LCB7XG5cdHRpdGxlOiBsb2NhbGl6ZSgnbWlTaGFyZScsIFwiU2hhcmVcIiksXG5cdHN1Ym1lbnU6IE1lbnVJZC5NZW51YmFyU2hhcmUsXG5cdGdyb3VwOiAnNDVfc2hhcmUnLFxuXHRvcmRlcjogMSxcbn0pO1xuXG4vLyBMYXlvdXQgbWVudVxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyVmlld01lbnUsIHtcblx0Z3JvdXA6ICcyX2FwcGVhcmFuY2UnLFxuXHR0aXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaUVkaXRvckxheW91dCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJFZGl0b3IgJiZMYXlvdXRcIiksXG5cdHN1Ym1lbnU6IE1lbnVJZC5NZW51YmFyTGF5b3V0TWVudSxcblx0b3JkZXI6IDJcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJMYXlvdXRNZW51LCB7XG5cdGdyb3VwOiAnMV9zcGxpdCcsXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogU1BMSVRfRURJVE9SX1VQLFxuXHRcdHRpdGxlOiB7XG5cdFx0XHQuLi5sb2NhbGl6ZTIoJ21pU3BsaXRFZGl0b3JVcFdpdGhvdXRNbmVtb25pYycsIFwiU3BsaXQgVXBcIiksXG5cdFx0XHRtbmVtb25pY1RpdGxlOiBsb2NhbGl6ZSh7IGtleTogJ21pU3BsaXRFZGl0b3JVcCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJTcGxpdCAmJlVwXCIpLFxuXHRcdH1cblx0fSxcblx0b3JkZXI6IDFcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJMYXlvdXRNZW51LCB7XG5cdGdyb3VwOiAnMV9zcGxpdCcsXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogU1BMSVRfRURJVE9SX0RPV04sXG5cdFx0dGl0bGU6IHtcblx0XHRcdC4uLmxvY2FsaXplMignbWlTcGxpdEVkaXRvckRvd25XaXRob3V0TW5lbW9uaWMnLCBcIlNwbGl0IERvd25cIiksXG5cdFx0XHRtbmVtb25pY1RpdGxlOiBsb2NhbGl6ZSh7IGtleTogJ21pU3BsaXRFZGl0b3JEb3duJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIlNwbGl0ICYmRG93blwiKSxcblx0XHR9XG5cdH0sXG5cdG9yZGVyOiAyXG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyTGF5b3V0TWVudSwge1xuXHRncm91cDogJzFfc3BsaXQnLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6IFNQTElUX0VESVRPUl9MRUZULFxuXHRcdHRpdGxlOiB7XG5cdFx0XHQuLi5sb2NhbGl6ZTIoJ21pU3BsaXRFZGl0b3JMZWZ0V2l0aG91dE1uZW1vbmljJywgXCJTcGxpdCBMZWZ0XCIpLFxuXHRcdFx0bW5lbW9uaWNUaXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaVNwbGl0RWRpdG9yTGVmdCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJTcGxpdCAmJkxlZnRcIiksXG5cdFx0fVxuXHR9LFxuXHRvcmRlcjogM1xufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuTWVudWJhckxheW91dE1lbnUsIHtcblx0Z3JvdXA6ICcxX3NwbGl0Jyxcblx0Y29tbWFuZDoge1xuXHRcdGlkOiBTUExJVF9FRElUT1JfUklHSFQsXG5cdFx0dGl0bGU6IHtcblx0XHRcdC4uLmxvY2FsaXplMignbWlTcGxpdEVkaXRvclJpZ2h0V2l0aG91dE1uZW1vbmljJywgXCJTcGxpdCBSaWdodFwiKSxcblx0XHRcdG1uZW1vbmljVGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlTcGxpdEVkaXRvclJpZ2h0JywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIlNwbGl0ICYmUmlnaHRcIiksXG5cdFx0fVxuXHR9LFxuXHRvcmRlcjogNFxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuTWVudWJhckxheW91dE1lbnUsIHtcblx0Z3JvdXA6ICcyX3NwbGl0X2luX2dyb3VwJyxcblx0Y29tbWFuZDoge1xuXHRcdGlkOiBTUExJVF9FRElUT1JfSU5fR1JPVVAsXG5cdFx0dGl0bGU6IHtcblx0XHRcdC4uLmxvY2FsaXplMignbWlTcGxpdEVkaXRvckluR3JvdXBXaXRob3V0TW5lbW9uaWMnLCBcIlNwbGl0IGluIEdyb3VwXCIpLFxuXHRcdFx0bW5lbW9uaWNUaXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaVNwbGl0RWRpdG9ySW5Hcm91cCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJTcGxpdCBpbiAmJkdyb3VwXCIpLFxuXHRcdH1cblx0fSxcblx0d2hlbjogQWN0aXZlRWRpdG9yQ2FuU3BsaXRJbkdyb3VwQ29udGV4dCxcblx0b3JkZXI6IDFcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJMYXlvdXRNZW51LCB7XG5cdGdyb3VwOiAnMl9zcGxpdF9pbl9ncm91cCcsXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogSk9JTl9FRElUT1JfSU5fR1JPVVAsXG5cdFx0dGl0bGU6IHtcblx0XHRcdC4uLmxvY2FsaXplMignbWlKb2luRWRpdG9ySW5Hcm91cFdpdGhvdXRNbmVtb25pYycsIFwiSm9pbiBpbiBHcm91cFwiKSxcblx0XHRcdG1uZW1vbmljVGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlKb2luRWRpdG9ySW5Hcm91cCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJKb2luIGluICYmR3JvdXBcIiksXG5cdFx0fVxuXHR9LFxuXHR3aGVuOiBTaWRlQnlTaWRlRWRpdG9yQWN0aXZlQ29udGV4dCxcblx0b3JkZXI6IDFcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJMYXlvdXRNZW51LCB7XG5cdGdyb3VwOiAnM19uZXdfd2luZG93Jyxcblx0Y29tbWFuZDoge1xuXHRcdGlkOiBNT1ZFX0VESVRPUl9JTlRPX05FV19XSU5ET1dfQ09NTUFORF9JRCxcblx0XHR0aXRsZToge1xuXHRcdFx0Li4ubG9jYWxpemUyKCdtb3ZlRWRpdG9yVG9OZXdXaW5kb3cnLCBcIk1vdmUgRWRpdG9yIGludG8gTmV3IFdpbmRvd1wiKSxcblx0XHRcdG1uZW1vbmljVGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlNb3ZlRWRpdG9yVG9OZXdXaW5kb3cnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZNb3ZlIEVkaXRvciBpbnRvIE5ldyBXaW5kb3dcIiksXG5cdFx0fVxuXHR9LFxuXHRvcmRlcjogMVxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuTWVudWJhckxheW91dE1lbnUsIHtcblx0Z3JvdXA6ICczX25ld193aW5kb3cnLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6IENPUFlfRURJVE9SX0lOVE9fTkVXX1dJTkRPV19DT01NQU5EX0lELFxuXHRcdHRpdGxlOiB7XG5cdFx0XHQuLi5sb2NhbGl6ZTIoJ2NvcHlFZGl0b3JUb05ld1dpbmRvdycsIFwiQ29weSBFZGl0b3IgaW50byBOZXcgV2luZG93XCIpLFxuXHRcdFx0bW5lbW9uaWNUaXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaUNvcHlFZGl0b3JUb05ld1dpbmRvdycsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJkNvcHkgRWRpdG9yIGludG8gTmV3IFdpbmRvd1wiKSxcblx0XHR9XG5cdH0sXG5cdG9yZGVyOiAyXG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyTGF5b3V0TWVudSwge1xuXHRncm91cDogJzRfbGF5b3V0cycsXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogRWRpdG9yTGF5b3V0U2luZ2xlQWN0aW9uLklELFxuXHRcdHRpdGxlOiB7XG5cdFx0XHQuLi5sb2NhbGl6ZTIoJ21pU2luZ2xlQ29sdW1uRWRpdG9yTGF5b3V0V2l0aG91dE1uZW1vbmljJywgXCJTaW5nbGVcIiksXG5cdFx0XHRtbmVtb25pY1RpdGxlOiBsb2NhbGl6ZSh7IGtleTogJ21pU2luZ2xlQ29sdW1uRWRpdG9yTGF5b3V0JywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmU2luZ2xlXCIpLFxuXHRcdH1cblx0fSxcblx0b3JkZXI6IDFcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJMYXlvdXRNZW51LCB7XG5cdGdyb3VwOiAnNF9sYXlvdXRzJyxcblx0Y29tbWFuZDoge1xuXHRcdGlkOiBFZGl0b3JMYXlvdXRUd29Db2x1bW5zQWN0aW9uLklELFxuXHRcdHRpdGxlOiB7XG5cdFx0XHQuLi5sb2NhbGl6ZTIoJ21pVHdvQ29sdW1uc0VkaXRvckxheW91dFdpdGhvdXRNbmVtb25pYycsIFwiVHdvIENvbHVtbnNcIiksXG5cdFx0XHRtbmVtb25pY1RpdGxlOiBsb2NhbGl6ZSh7IGtleTogJ21pVHdvQ29sdW1uc0VkaXRvckxheW91dCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJlR3byBDb2x1bW5zXCIpLFxuXHRcdH1cblx0fSxcblx0b3JkZXI6IDNcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJMYXlvdXRNZW51LCB7XG5cdGdyb3VwOiAnNF9sYXlvdXRzJyxcblx0Y29tbWFuZDoge1xuXHRcdGlkOiBFZGl0b3JMYXlvdXRUaHJlZUNvbHVtbnNBY3Rpb24uSUQsXG5cdFx0dGl0bGU6IHtcblx0XHRcdC4uLmxvY2FsaXplMignbWlUaHJlZUNvbHVtbnNFZGl0b3JMYXlvdXRXaXRob3V0TW5lbW9uaWMnLCBcIlRocmVlIENvbHVtbnNcIiksXG5cdFx0XHRtbmVtb25pY1RpdGxlOiBsb2NhbGl6ZSh7IGtleTogJ21pVGhyZWVDb2x1bW5zRWRpdG9yTGF5b3V0JywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIlQmJmhyZWUgQ29sdW1uc1wiKSxcblx0XHR9XG5cdH0sXG5cdG9yZGVyOiA0XG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyTGF5b3V0TWVudSwge1xuXHRncm91cDogJzRfbGF5b3V0cycsXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogRWRpdG9yTGF5b3V0VHdvUm93c0FjdGlvbi5JRCxcblx0XHR0aXRsZToge1xuXHRcdFx0Li4ubG9jYWxpemUyKCdtaVR3b1Jvd3NFZGl0b3JMYXlvdXRXaXRob3V0TW5lbW9uaWMnLCBcIlR3byBSb3dzXCIpLFxuXHRcdFx0bW5lbW9uaWNUaXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaVR3b1Jvd3NFZGl0b3JMYXlvdXQnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiVCYmd28gUm93c1wiKSxcblx0XHR9XG5cdH0sXG5cdG9yZGVyOiA1XG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyTGF5b3V0TWVudSwge1xuXHRncm91cDogJzRfbGF5b3V0cycsXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogRWRpdG9yTGF5b3V0VGhyZWVSb3dzQWN0aW9uLklELFxuXHRcdHRpdGxlOiB7XG5cdFx0XHQuLi5sb2NhbGl6ZTIoJ21pVGhyZWVSb3dzRWRpdG9yTGF5b3V0V2l0aG91dE1uZW1vbmljJywgXCJUaHJlZSBSb3dzXCIpLFxuXHRcdFx0bW5lbW9uaWNUaXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaVRocmVlUm93c0VkaXRvckxheW91dCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJUaHJlZSAmJlJvd3NcIiksXG5cdFx0fVxuXHR9LFxuXHRvcmRlcjogNlxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuTWVudWJhckxheW91dE1lbnUsIHtcblx0Z3JvdXA6ICc0X2xheW91dHMnLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6IEVkaXRvckxheW91dFR3b0J5VHdvR3JpZEFjdGlvbi5JRCxcblx0XHR0aXRsZToge1xuXHRcdFx0Li4ubG9jYWxpemUyKCdtaVR3b0J5VHdvR3JpZEVkaXRvckxheW91dFdpdGhvdXRNbmVtb25pYycsIFwiR3JpZCAoMngyKVwiKSxcblx0XHRcdG1uZW1vbmljVGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlUd29CeVR3b0dyaWRFZGl0b3JMYXlvdXQnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZHcmlkICgyeDIpXCIpLFxuXHRcdH1cblx0fSxcblx0b3JkZXI6IDdcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJMYXlvdXRNZW51LCB7XG5cdGdyb3VwOiAnNF9sYXlvdXRzJyxcblx0Y29tbWFuZDoge1xuXHRcdGlkOiBFZGl0b3JMYXlvdXRUd29Sb3dzUmlnaHRBY3Rpb24uSUQsXG5cdFx0dGl0bGU6IHtcblx0XHRcdC4uLmxvY2FsaXplMignbWlUd29Sb3dzUmlnaHRFZGl0b3JMYXlvdXRXaXRob3V0TW5lbW9uaWMnLCBcIlR3byBSb3dzIFJpZ2h0XCIpLFxuXHRcdFx0bW5lbW9uaWNUaXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaVR3b1Jvd3NSaWdodEVkaXRvckxheW91dCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJUd28gUiYmb3dzIFJpZ2h0XCIpLFxuXHRcdH1cblx0fSxcblx0b3JkZXI6IDhcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJMYXlvdXRNZW51LCB7XG5cdGdyb3VwOiAnNF9sYXlvdXRzJyxcblx0Y29tbWFuZDoge1xuXHRcdGlkOiBFZGl0b3JMYXlvdXRUd29Db2x1bW5zQm90dG9tQWN0aW9uLklELFxuXHRcdHRpdGxlOiB7XG5cdFx0XHQuLi5sb2NhbGl6ZTIoJ21pVHdvQ29sdW1uc0JvdHRvbUVkaXRvckxheW91dFdpdGhvdXRNbmVtb25pYycsIFwiVHdvIENvbHVtbnMgQm90dG9tXCIpLFxuXHRcdFx0bW5lbW9uaWNUaXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaVR3b0NvbHVtbnNCb3R0b21FZGl0b3JMYXlvdXQnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiVHdvICYmQ29sdW1ucyBCb3R0b21cIiksXG5cdFx0fVxuXHR9LFxuXHRvcmRlcjogOVxufSk7XG5cbi8vIE1haW4gTWVudSBCYXIgQ29udHJpYnV0aW9uczpcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyR29NZW51LCB7XG5cdGdyb3VwOiAnMV9oaXN0b3J5X25hdicsXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ubmF2aWdhdGVUb0xhc3RFZGl0TG9jYXRpb24nLFxuXHRcdHRpdGxlOiBsb2NhbGl6ZSh7IGtleTogJ21pTGFzdEVkaXRMb2NhdGlvbicsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJkxhc3QgRWRpdCBMb2NhdGlvblwiKSxcblx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmhhcygnY2FuTmF2aWdhdGVUb0xhc3RFZGl0TG9jYXRpb24nKVxuXHR9LFxuXHRvcmRlcjogM1xufSk7XG5cbi8vIFN3aXRjaCBFZGl0b3JcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyU3dpdGNoRWRpdG9yTWVudSwge1xuXHRncm91cDogJzFfc2lkZUJ5U2lkZScsXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogRk9DVVNfRklSU1RfU0lERV9FRElUT1IsXG5cdFx0dGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlGaXJzdFNpZGVFZGl0b3InLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZGaXJzdCBTaWRlIGluIEVkaXRvclwiKVxuXHR9LFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5vcihTaWRlQnlTaWRlRWRpdG9yQWN0aXZlQ29udGV4dCwgVGV4dENvbXBhcmVFZGl0b3JBY3RpdmVDb250ZXh0KSxcblx0b3JkZXI6IDFcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJTd2l0Y2hFZGl0b3JNZW51LCB7XG5cdGdyb3VwOiAnMV9zaWRlQnlTaWRlJyxcblx0Y29tbWFuZDoge1xuXHRcdGlkOiBGT0NVU19TRUNPTkRfU0lERV9FRElUT1IsXG5cdFx0dGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlTZWNvbmRTaWRlRWRpdG9yJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmU2Vjb25kIFNpZGUgaW4gRWRpdG9yXCIpXG5cdH0sXG5cdHdoZW46IENvbnRleHRLZXlFeHByLm9yKFNpZGVCeVNpZGVFZGl0b3JBY3RpdmVDb250ZXh0LCBUZXh0Q29tcGFyZUVkaXRvckFjdGl2ZUNvbnRleHQpLFxuXHRvcmRlcjogMlxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuTWVudWJhclN3aXRjaEVkaXRvck1lbnUsIHtcblx0Z3JvdXA6ICcyX2FueScsXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ubmV4dEVkaXRvcicsXG5cdFx0dGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlOZXh0RWRpdG9yJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmTmV4dCBFZGl0b3JcIilcblx0fSxcblx0b3JkZXI6IDFcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJTd2l0Y2hFZGl0b3JNZW51LCB7XG5cdGdyb3VwOiAnMl9hbnknLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLnByZXZpb3VzRWRpdG9yJyxcblx0XHR0aXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaVByZXZpb3VzRWRpdG9yJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmUHJldmlvdXMgRWRpdG9yXCIpXG5cdH0sXG5cdG9yZGVyOiAyXG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyU3dpdGNoRWRpdG9yTWVudSwge1xuXHRncm91cDogJzNfYW55X3VzZWQnLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLm9wZW5OZXh0UmVjZW50bHlVc2VkRWRpdG9yJyxcblx0XHR0aXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaU5leHRSZWNlbnRseVVzZWRFZGl0b3InLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZOZXh0IFVzZWQgRWRpdG9yXCIpXG5cdH0sXG5cdG9yZGVyOiAxXG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyU3dpdGNoRWRpdG9yTWVudSwge1xuXHRncm91cDogJzNfYW55X3VzZWQnLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLm9wZW5QcmV2aW91c1JlY2VudGx5VXNlZEVkaXRvcicsXG5cdFx0dGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlQcmV2aW91c1JlY2VudGx5VXNlZEVkaXRvcicsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJlByZXZpb3VzIFVzZWQgRWRpdG9yXCIpXG5cdH0sXG5cdG9yZGVyOiAyXG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyU3dpdGNoRWRpdG9yTWVudSwge1xuXHRncm91cDogJzRfZ3JvdXAnLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLm5leHRFZGl0b3JJbkdyb3VwJyxcblx0XHR0aXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaU5leHRFZGl0b3JJbkdyb3VwJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmTmV4dCBFZGl0b3IgaW4gR3JvdXBcIilcblx0fSxcblx0b3JkZXI6IDFcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJTd2l0Y2hFZGl0b3JNZW51LCB7XG5cdGdyb3VwOiAnNF9ncm91cCcsXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ucHJldmlvdXNFZGl0b3JJbkdyb3VwJyxcblx0XHR0aXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaVByZXZpb3VzRWRpdG9ySW5Hcm91cCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJlByZXZpb3VzIEVkaXRvciBpbiBHcm91cFwiKVxuXHR9LFxuXHRvcmRlcjogMlxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuTWVudWJhclN3aXRjaEVkaXRvck1lbnUsIHtcblx0Z3JvdXA6ICc1X2dyb3VwX3VzZWQnLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLm9wZW5OZXh0UmVjZW50bHlVc2VkRWRpdG9ySW5Hcm91cCcsXG5cdFx0dGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlOZXh0VXNlZEVkaXRvckluR3JvdXAnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZOZXh0IFVzZWQgRWRpdG9yIGluIEdyb3VwXCIpXG5cdH0sXG5cdG9yZGVyOiAxXG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyU3dpdGNoRWRpdG9yTWVudSwge1xuXHRncm91cDogJzVfZ3JvdXBfdXNlZCcsXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ub3BlblByZXZpb3VzUmVjZW50bHlVc2VkRWRpdG9ySW5Hcm91cCcsXG5cdFx0dGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlQcmV2aW91c1VzZWRFZGl0b3JJbkdyb3VwJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmUHJldmlvdXMgVXNlZCBFZGl0b3IgaW4gR3JvdXBcIilcblx0fSxcblx0b3JkZXI6IDJcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJHb01lbnUsIHtcblx0Z3JvdXA6ICcyX2VkaXRvcl9uYXYnLFxuXHR0aXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaVN3aXRjaEVkaXRvcicsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJTd2l0Y2ggJiZFZGl0b3JcIiksXG5cdHN1Ym1lbnU6IE1lbnVJZC5NZW51YmFyU3dpdGNoRWRpdG9yTWVudSxcblx0b3JkZXI6IDFcbn0pO1xuXG4vLyBTd2l0Y2ggR3JvdXBcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuTWVudWJhclN3aXRjaEdyb3VwTWVudSwge1xuXHRncm91cDogJzFfZm9jdXNfaW5kZXgnLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmZvY3VzRmlyc3RFZGl0b3JHcm91cCcsXG5cdFx0dGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlGb2N1c0ZpcnN0R3JvdXAnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiR3JvdXAgJiYxXCIpXG5cdH0sXG5cdG9yZGVyOiAxXG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyU3dpdGNoR3JvdXBNZW51LCB7XG5cdGdyb3VwOiAnMV9mb2N1c19pbmRleCcsXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uZm9jdXNTZWNvbmRFZGl0b3JHcm91cCcsXG5cdFx0dGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlGb2N1c1NlY29uZEdyb3VwJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIkdyb3VwICYmMlwiKVxuXHR9LFxuXHRvcmRlcjogMlxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuTWVudWJhclN3aXRjaEdyb3VwTWVudSwge1xuXHRncm91cDogJzFfZm9jdXNfaW5kZXgnLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmZvY3VzVGhpcmRFZGl0b3JHcm91cCcsXG5cdFx0dGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlGb2N1c1RoaXJkR3JvdXAnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiR3JvdXAgJiYzXCIpLFxuXHRcdHByZWNvbmRpdGlvbjogTXVsdGlwbGVFZGl0b3JHcm91cHNDb250ZXh0XG5cdH0sXG5cdG9yZGVyOiAzXG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyU3dpdGNoR3JvdXBNZW51LCB7XG5cdGdyb3VwOiAnMV9mb2N1c19pbmRleCcsXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uZm9jdXNGb3VydGhFZGl0b3JHcm91cCcsXG5cdFx0dGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlGb2N1c0ZvdXJ0aEdyb3VwJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIkdyb3VwICYmNFwiKSxcblx0XHRwcmVjb25kaXRpb246IE11bHRpcGxlRWRpdG9yR3JvdXBzQ29udGV4dFxuXHR9LFxuXHRvcmRlcjogNFxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuTWVudWJhclN3aXRjaEdyb3VwTWVudSwge1xuXHRncm91cDogJzFfZm9jdXNfaW5kZXgnLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmZvY3VzRmlmdGhFZGl0b3JHcm91cCcsXG5cdFx0dGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlGb2N1c0ZpZnRoR3JvdXAnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiR3JvdXAgJiY1XCIpLFxuXHRcdHByZWNvbmRpdGlvbjogTXVsdGlwbGVFZGl0b3JHcm91cHNDb250ZXh0XG5cdH0sXG5cdG9yZGVyOiA1XG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyU3dpdGNoR3JvdXBNZW51LCB7XG5cdGdyb3VwOiAnMl9uZXh0X3ByZXYnLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmZvY3VzTmV4dEdyb3VwJyxcblx0XHR0aXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaU5leHRHcm91cCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJk5leHQgR3JvdXBcIiksXG5cdFx0cHJlY29uZGl0aW9uOiBNdWx0aXBsZUVkaXRvckdyb3Vwc0NvbnRleHRcblx0fSxcblx0b3JkZXI6IDFcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJTd2l0Y2hHcm91cE1lbnUsIHtcblx0Z3JvdXA6ICcyX25leHRfcHJldicsXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uZm9jdXNQcmV2aW91c0dyb3VwJyxcblx0XHR0aXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaVByZXZpb3VzR3JvdXAnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZQcmV2aW91cyBHcm91cFwiKSxcblx0XHRwcmVjb25kaXRpb246IE11bHRpcGxlRWRpdG9yR3JvdXBzQ29udGV4dFxuXHR9LFxuXHRvcmRlcjogMlxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuTWVudWJhclN3aXRjaEdyb3VwTWVudSwge1xuXHRncm91cDogJzNfZGlyZWN0aW9uYWwnLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmZvY3VzTGVmdEdyb3VwJyxcblx0XHR0aXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaUZvY3VzTGVmdEdyb3VwJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIkdyb3VwICYmTGVmdFwiKSxcblx0XHRwcmVjb25kaXRpb246IE11bHRpcGxlRWRpdG9yR3JvdXBzQ29udGV4dFxuXHR9LFxuXHRvcmRlcjogMVxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuTWVudWJhclN3aXRjaEdyb3VwTWVudSwge1xuXHRncm91cDogJzNfZGlyZWN0aW9uYWwnLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmZvY3VzUmlnaHRHcm91cCcsXG5cdFx0dGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlGb2N1c1JpZ2h0R3JvdXAnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiR3JvdXAgJiZSaWdodFwiKSxcblx0XHRwcmVjb25kaXRpb246IE11bHRpcGxlRWRpdG9yR3JvdXBzQ29udGV4dFxuXHR9LFxuXHRvcmRlcjogMlxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuTWVudWJhclN3aXRjaEdyb3VwTWVudSwge1xuXHRncm91cDogJzNfZGlyZWN0aW9uYWwnLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmZvY3VzQWJvdmVHcm91cCcsXG5cdFx0dGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlGb2N1c0Fib3ZlR3JvdXAnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiR3JvdXAgJiZBYm92ZVwiKSxcblx0XHRwcmVjb25kaXRpb246IE11bHRpcGxlRWRpdG9yR3JvdXBzQ29udGV4dFxuXHR9LFxuXHRvcmRlcjogM1xufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuTWVudWJhclN3aXRjaEdyb3VwTWVudSwge1xuXHRncm91cDogJzNfZGlyZWN0aW9uYWwnLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmZvY3VzQmVsb3dHcm91cCcsXG5cdFx0dGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlGb2N1c0JlbG93R3JvdXAnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiR3JvdXAgJiZCZWxvd1wiKSxcblx0XHRwcmVjb25kaXRpb246IE11bHRpcGxlRWRpdG9yR3JvdXBzQ29udGV4dFxuXHR9LFxuXHRvcmRlcjogNFxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuTWVudWJhckdvTWVudSwge1xuXHRncm91cDogJzJfZWRpdG9yX25hdicsXG5cdHRpdGxlOiBsb2NhbGl6ZSh7IGtleTogJ21pU3dpdGNoR3JvdXAnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiU3dpdGNoICYmR3JvdXBcIiksXG5cdHN1Ym1lbnU6IE1lbnVJZC5NZW51YmFyU3dpdGNoR3JvdXBNZW51LFxuXHRvcmRlcjogMlxufSk7XG5cbi8vI2VuZHJlZ2lvblxuXG5cbnJlZ2lzdGVyRWRpdG9yRm9udENvbmZpZ3VyYXRpb25zKGdldEZvbnRTbmlwcGV0cyk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFVBQVUsaUJBQWlCO0FBQ3BDLFNBQThCLDRCQUE0QjtBQUMxRCxTQUFpQyx3QkFBd0I7QUFDekQ7QUFBQSxFQUNDO0FBQUEsRUFBZ0M7QUFBQSxFQUEyQjtBQUFBLEVBQWdDO0FBQUEsRUFBMkI7QUFBQSxFQUN0SDtBQUFBLEVBQXVDO0FBQUEsRUFBMEI7QUFBQSxFQUFnQztBQUFBLEVBQW9DO0FBQUEsRUFDckk7QUFBQSxFQUEwQjtBQUFBLEVB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
