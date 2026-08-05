var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { localize, localize2 } from "../../../../nls.js";
import { Action } from "../../../../base/common/actions.js";
import { CloseDirection, SaveReason, EditorsOrder, EditorInputCapabilities, DEFAULT_EDITOR_ASSOCIATION, EditorResourceAccessor } from "../../../common/editor.js";
import { SideBySideEditorInput } from "../../../common/editor/sideBySideEditorInput.js";
import { IWorkbenchLayoutService, Parts } from "../../../services/layout/browser/layoutService.js";
import { GoFilter, IHistoryService } from "../../../services/history/common/history.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { CLOSE_EDITOR_COMMAND_ID, MOVE_ACTIVE_EDITOR_COMMAND_ID, SPLIT_EDITOR_LEFT, SPLIT_EDITOR_RIGHT, SPLIT_EDITOR_UP, SPLIT_EDITOR_DOWN, splitEditor, LAYOUT_EDITOR_GROUPS_COMMAND_ID, UNPIN_EDITOR_COMMAND_ID, COPY_ACTIVE_EDITOR_COMMAND_ID, SPLIT_EDITOR, TOGGLE_MAXIMIZE_EDITOR_GROUP, MOVE_EDITOR_INTO_NEW_WINDOW_COMMAND_ID, COPY_EDITOR_INTO_NEW_WINDOW_COMMAND_ID, MOVE_EDITOR_GROUP_INTO_NEW_WINDOW_COMMAND_ID, COPY_EDITOR_GROUP_INTO_NEW_WINDOW_COMMAND_ID, NEW_EMPTY_EDITOR_WINDOW_COMMAND_ID } from "./editorCommands.js";
import { IEditorGroupsService, GroupsArrangement, GroupLocation, GroupDirection, preferredSideBySideGroupDirection, GroupOrientation, GroupsOrder, MergeGroupMode } from "../../../services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IWorkspacesService } from "../../../../platform/workspaces/common/workspaces.js";
import { IFileDialogService, ConfirmResult, IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { ItemActivation, IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { AllEditorsByMostRecentlyUsedQuickAccess, ActiveGroupEditorsByMostRecentlyUsedQuickAccess, AllEditorsByAppearanceQuickAccess } from "./editorQuickAccess.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { IFilesConfigurationService, AutoSaveMode } from "../../../services/filesConfiguration/common/filesConfigurationService.js";
import { IEditorResolverService } from "../../../services/editor/common/editorResolverService.js";
import { isLinux, isNative, isWindows } from "../../../../base/common/platform.js";
import { Action2, MenuId } from "../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { KeyChord, KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { ActiveEditorAvailableEditorIdsContext, ActiveEditorContext, ActiveEditorGroupEmptyContext, AuxiliaryBarVisibleContext, EditorPartMaximizedEditorGroupContext, EditorPartMultipleEditorGroupsContext, IsAuxiliaryWindowFocusedContext, MultipleEditorGroupsContext, SideBarVisibleContext } from "../../../common/contextkeys.js";
import { getActiveDocument } from "../../../../base/browser/dom.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { resolveCommandsContext } from "./editorCommandsContext.js";
import { IListService } from "../../../../platform/list/browser/listService.js";
import { prepareMoveCopyEditors } from "./editor.js";
class ExecuteCommandAction extends Action2 {
  constructor(desc, commandId, commandArgs) {
    super(desc);
    this.commandId = commandId;
    this.commandArgs = commandArgs;
  }
  run(accessor) {
    const commandService = accessor.get(ICommandService);
    return commandService.executeCommand(this.commandId, this.commandArgs);
  }
}
class AbstractSplitEditorAction extends Action2 {
  getDirection(configurationService) {
    return preferredSideBySideGroupDirection(configurationService);
  }
  async run(accessor, ...args) {
    const editorGroupsService = accessor.get(IEditorGroupsService);
    const configurationService = accessor.get(IConfigurationService);
    const editorService = accessor.get(IEditorService);
    const listService = accessor.get(IListService);
    const direction = this.getDirection(configurationService);
    const commandContext = resolveCommandsContext(args, editorService, editorGroupsService, listService);
    splitEditor(editorGroupsService, direction, commandContext);
  }
}
const _SplitEditorAction = class _SplitEditorAction extends AbstractSplitEditorAction {
  constructor() {
    super({
      id: _SplitEditorAction.ID,
      title: localize2("splitEditor", "Split Editor"),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyCode.Backslash
      },
      category: Categories.View
    });
  }
};
_SplitEditorAction.ID = SPLIT_EDITOR;
let SplitEditorAction = _SplitEditorAction;
class SplitEditorOrthogonalAction extends AbstractSplitEditorAction {
  constructor() {
    super({
      id: "workbench.action.splitEditorOrthogonal",
      title: localize2("splitEditorOrthogonal", "Split Editor Orthogonal"),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.Backslash)
      },
      category: Categories.View
    });
  }
  getDirection(configurationService) {
    const direction = preferredSideBySideGroupDirection(configurationService);
    return direction === GroupDirection.RIGHT ? GroupDirection.DOWN : GroupDirection.RIGHT;
  }
}
class SplitEditorLeftAction extends ExecuteCommandAction {
  constructor() {
    super({
      id: SPLIT_EDITOR_LEFT,
      title: localize2("splitEditorGroupLeft", "Split Editor Left"),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.Backslash)
      },
      category: Categories.View
    }, SPLIT_EDITOR_LEFT);
  }
}
class SplitEditorRightAction extends ExecuteCommandAction {
  constructor() {
    super({
      id: SPLIT_EDITOR_RIGHT,
      title: localize2("splitEditorGroupRight", "Split Editor Right"),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.Backslash)
      },
      category: Categories.View
    }, SPLIT_EDITOR_RIGHT);
  }
}
class SplitEditorUpAction extends ExecuteCommandAction {
  constructor() {
    super({
      id: SPLIT_EDITOR_UP,
      title: localize2("splitEditorGroupUp", "Split Editor Up"),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.Backslash)
      },
      category: Categories.View
    }, SPLIT_EDITOR_UP);
  }
}
SplitEditorUpAction.LABEL = localize("splitEditorGroupUp", "Split Editor Up");
class SplitEditorDownAction extends ExecuteCommandAction {
  constructor() {
    super({
      id: SPLIT_EDITOR_DOWN,
      title: localize2("splitEditorGroupDown", "Split Editor Down"),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.Backslash)
      },
      category: Categories.View
    }, SPLIT_EDITOR_DOWN);
  }
}
SplitEditorDownAction.LABEL = localize("splitEditorGroupDown", "Split Editor Down");
class JoinTwoGroupsAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.joinTwoGroups",
      title: localize2("joinTwoGroups", "Join Editor Group with Next Group"),
      f1: true,
      category: Categories.View
    });
  }
  async run(accessor, context) {
    const editorGroupService = accessor.get(IEditorGroupsService);
    let sourceGroup;
    if (context && typeof context.groupId === "number") {
      sourceGroup = editorGroupService.getGroup(context.groupId);
    } else {
      sourceGroup = editorGroupService.activeGroup;
    }
    if (sourceGroup) {
      const targetGroupDirections = [GroupDirection.RIGHT, GroupDirection.DOWN, GroupDirection.LEFT, GroupDirection.UP];
      for (const targetGroupDirection of targetGroupDirections) {
        const targetGroup = editorGroupService.findGroup({ direction: targetGroupDirection }, sourceGroup);
        if (targetGroup && sourceGroup !== targetGroup) {
          editorGroupService.mergeGroup(sourceGroup, targetGroup);
          break;
        }
      }
    }
  }
}
class JoinAllGroupsAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.joinAllGroups",
      title: localize2("joinAllGroups", "Join All Editor Groups"),
      f1: true,
      category: Categories.View
    });
  }
  async run(accessor) {
    const editorGroupService = accessor.get(IEditorGroupsService);
    editorGroupService.mergeAllGroups(editorGroupService.activeGroup);
  }
}
class NavigateBetweenGroupsAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.navigateEditorGroups",
      title: localize2("navigateEditorGroups", "Navigate Between Editor Groups"),
      f1: true,
      category: Categories.View
    });
  }
  async run(accessor) {
    const editorGroupService = accessor.get(IEditorGroupsService);
    const nextGroup = editorGroupService.findGroup({ location: GroupLocation.NEXT }, editorGroupService.activeGroup, true);
    nextGroup?.focus();
  }
}
class FocusActiveGroupAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.focusActiveEditorGroup",
      title: localize2("focusActiveEditorGroup", "Focus Active Editor Group"),
      f1: true,
      category: Categories.View
    });
  }
  async run(accessor) {
    const editorGroupService = accessor.get(IEditorGroupsService);
    editorGroupService.activeGroup.focus();
  }
}
class AbstractFocusGroupAction extends Action2 {
  constructor(desc, scope) {
    super(desc);
    this.scope = scope;
  }
  async run(accessor) {
    const editorGroupService = accessor.get(IEditorGroupsService);
    const group = editorGroupService.findGroup(this.scope, editorGroupService.activeGroup, true);
    group?.focus();
  }
}
class FocusFirstGroupAction extends AbstractFocusGroupAction {
  constructor() {
    super({
      id: "workbench.action.focusFirstEditorGroup",
      title: localize2("focusFirstEditorGroup", "Focus First Editor Group"),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyCode.Digit1
      },
      category: Categories.View
    }, { location: GroupLocation.FIRST });
  }
}
class FocusLastGroupAction extends AbstractFocusGroupAction {
  constructor() {
    super({
      id: "workbench.action.focusLastEditorGroup",
      title: localize2("focusLastEditorGroup", "Focus Last Editor Group"),
      f1: true,
      category: Categories.View
    }, { location: GroupLocation.LAST });
  }
}
class FocusNextGroup extends AbstractFocusGroupAction {
  constructor() {
    super({
      id: "workbench.action.focusNextGroup",
      title: localize2("focusNextGroup", "Focus Next Editor Group"),
      f1: true,
      category: Categories.View
    }, { location: GroupLocation.NEXT });
  }
}
class FocusPreviousGroup extends AbstractFocusGroupAction {
  constructor() {
    super({
      id: "workbench.action.focusPreviousGroup",
      title: localize2("focusPreviousGroup", "Focus Previous Editor Group"),
      f1: true,
      category: Categories.View
    }, { location: GroupLocation.PREVIOUS });
  }
}
class FocusLeftGroup extends AbstractFocusGroupAction {
  constructor() {
    super({
      id: "workbench.action.focusLeftGroup",
      title: localize2("focusLeftGroup", "Focus Left Editor Group"),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.LeftArrow)
      },
      category: Categories.View
    }, { direction: GroupDirection.LEFT });
  }
}
class FocusRightGroup extends AbstractFocusGroupAction {
  constructor() {
    super({
      id: "workbench.action.focusRightGroup",
      title: localize2("focusRightGroup", "Focus Right Editor Group"),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.RightArrow)
      },
      category: Categories.View
    }, { direction: GroupDirection.RIGHT });
  }
}
class FocusAboveGroup extends AbstractFocusGroupAction {
  constructor() {
    super({
      id: "workbench.action.focusAboveGroup",
      title: localize2("focusAboveGroup", "Focus Editor Group Above"),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.UpArrow)
      },
      category: Categories.View
    }, { direction: GroupDirection.UP });
  }
}
class FocusBelowGroup extends AbstractFocusGroupAction {
  constructor() {
    super({
      id: "workbench.action.focusBelowGroup",
      title: localize2("focusBelowGroup", "Focus Editor Group Below"),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.DownArrow)
      },
      category: Categories.View
    }, { direction: GroupDirection.DOWN });
  }
}
let CloseEditorAction = class extends Action {
  constructor(id, label, commandService) {
    super(id, label, ThemeIcon.asClassName(Codicon.close));
    this.commandService = commandService;
  }
  run(context) {
    return this.commandService.executeCommand(CLOSE_EDITOR_COMMAND_ID, void 0, context);
  }
};
CloseEditorAction.ID = "workbench.action.closeActiveEditor";
CloseEditorAction.LABEL = localize("closeEditor", "Close Editor");
CloseEditorAction = __decorateClass([
  __decorateParam(2, ICommandService)
], CloseEditorAction);
let UnpinEditorAction = class extends Action {
  constructor(id, label, commandService) {
    super(id, label, ThemeIcon.asClassName(Codicon.pinned));
    this.commandService = commandService;
  }
  run(context) {
    return this.commandService.executeCommand(UNPIN_EDITOR_COMMAND_ID, void 0, context);
  }
};
UnpinEditorAction.ID = "workbench.action.unpinActiveEditor";
UnpinEditorAction.LABEL = localize("unpinEditor", "Unpin Editor");
UnpinEditorAction = __decorateClass([
  __decorateParam(2, ICommandService)
], UnpinEditorAction);
let CloseEditorTabAction = class extends Action {
  constructor(id, label, editorGroupService) {
    super(id, label, ThemeIcon.asClassName(Codicon.close));
    this.editorGroupService = editorGroupService;
  }
  async run(context) {
    const group = context ? this.editorGroupService.getGroup(context.groupId) : this.editorGroupService.activeGroup;
    if (!group) {
      return;
    }
    const targetEditor = context?.editorIndex !== void 0 ? group.getEditorByIndex(context.editorIndex) : group.activeEditor;
    if (!targetEditor) {
      return;
    }
    const editors = [];
    if (group.isSelected(targetEditor)) {
      editors.push(...group.selectedEditors);
    } else {
      editors.push(targetEditor);
    }
    for (const editor of editors) {
      await group.closeEditor(editor, { preserveFocus: context?.preserveFocus });
    }
  }
};
CloseEditorTabAction.ID = "workbench.action.closeActiveEditor";
CloseEditorTabAction.LABEL = localize("closeOneEditor", "Close");
CloseEditorTabAction = __decorateClass([
  __decorateParam(2, IEditorGroupsService)
], CloseEditorTabAction);
class RevertAndCloseEditorAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.revertAndCloseActiveEditor",
      title: localize2("revertAndCloseActiveEditor", "Revert and Close Editor"),
      f1: true,
      category: Categories.View
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const logService = accessor.get(ILogService);
    const activeEditorPane = editorService.activeEditorPane;
    if (activeEditorPane) {
      const editor = activeEditorPane.input;
      const group = activeEditorPane.group;
      try {
        await editorService.revert({ editor, groupId: group.id });
      } catch (error) {
        logService.error(error);
        await editorService.revert({ editor, groupId: group.id }, { soft: true });
      }
      await group.closeEditor(editor);
    }
  }
}
class CloseLeftEditorsInGroupAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.closeEditorsToTheLeft",
      title: localize2("closeEditorsToTheLeft", "Close Editors to the Left in Group"),
      f1: true,
      category: Categories.View
    });
  }
  async run(accessor, context) {
    const editorGroupService = accessor.get(IEditorGroupsService);
    const { group, editor } = this.getTarget(editorGroupService, context);
    if (group && editor) {
      await group.closeEditors({ direction: CloseDirection.LEFT, except: editor, excludeSticky: true });
    }
  }
  getTarget(editorGroupService, context) {
    if (context) {
      return { editor: context.editor, group: editorGroupService.getGroup(context.groupId) };
    }
    return { group: editorGroupService.activeGroup, editor: editorGroupService.activeGroup.activeEditor };
  }
}
class AbstractCloseAllAction extends Action2 {
  groupsToClose(editorGroupService) {
    const groupsToClose = [];
    const groups = editorGroupService.getGroups(GroupsOrder.GRID_APPEARANCE);
    for (let i = groups.length - 1; i >= 0; i--) {
      groupsToClose.push(groups[i]);
    }
    return groupsToClose;
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const logService = accessor.get(ILogService);
    const progressService = accessor.get(IProgressService);
    const editorGroupService = accessor.get(IEditorGroupsService);
    const filesConfigurationService = accessor.get(IFilesConfigurationService);
    const fileDialogService = accessor.get(IFileDialogService);
    const dirtyEditorsWithDefaultConfirm = /* @__PURE__ */ new Set();
    const dirtyAutoSaveOnFocusChangeEditors = /* @__PURE__ */ new Set();
    const dirtyAutoSaveOnWindowChangeEditors = /* @__PURE__ */ new Set();
    const editorsWithCustomConfirm = /* @__PURE__ */ new Map();
    for (const { editor, groupId } of editorService.getEditors(EditorsOrder.SEQUENTIAL, { excludeSticky: this.excludeSticky })) {
      let confirmClose = false;
      if (editor.closeHandler) {
        confirmClose = editor.closeHandler.showConfirm();
      } else {
        confirmClose = editor.isDirty() && !editor.isSaving();
      }
      if (!confirmClose) {
        continue;
      }
      if (typeof editor.closeHandler?.confirm === "function") {
        let customEditorsToConfirm = editorsWithCustomConfirm.get(editor.typeId);
        if (!customEditorsToConfirm) {
          customEditorsToConfirm = /* @__PURE__ */ new Set();
          editorsWithCustomConfirm.set(editor.typeId, customEditorsToConfirm);
        }
        customEditorsToConfirm.add({ editor, groupId });
      } else if (!editor.hasCapability(EditorInputCapabilities.Untitled) && filesConfigurationService.getAutoSaveMode(editor).mode === AutoSaveMode.ON_FOCUS_CHANGE) {
        dirtyAutoSaveOnFocusChangeEditors.add({ editor, groupId });
      } else if (isNative && (isWindows || isLinux) && !editor.hasCapability(EditorInputCapabilities.Untitled) && filesConfigurationService.getAutoSaveMode(editor).mode === AutoSaveMode.ON_WINDOW_CHANGE) {
        dirtyAutoSaveOnWindowChangeEditors.add({ editor, groupId });
      } else {
        dirtyEditorsWithDefaultConfirm.add({ editor, groupId });
      }
    }
    if (dirtyEditorsWithDefaultConfirm.size > 0) {
      const editors = Array.from(dirtyEditorsWithDefaultConfirm.values());
      await this.revealEditorsToConfirm(editors, editorGroupService);
      const confirmation = await fileDialogService.showSaveConfirm(editors.map(({ editor }) => {
        if (editor instanceof SideBySideEditorInput) {
          return editor.primary.getName();
        }
        return editor.getName();
      }));
      switch (confirmation) {
        case ConfirmResult.CANCEL:
          return;
        case ConfirmResult.DONT_SAVE:
          await this.revertEditors(editorService, logService, progressService, editors);
          break;
        case ConfirmResult.SAVE:
          await editorService.save(editors, { reason: SaveReason.EXPLICIT });
          break;
      }
    }
    for (const [, editorIdentifiers] of editorsWithCustomConfirm) {
      const editors = Array.from(editorIdentifiers.values());
      await this.revealEditorsToConfirm(editors, editorGroupService);
      const confirmation = await editors.at(0)?.editor.closeHandler?.confirm?.(editors);
      if (typeof confirmation === "number") {
        switch (confirmation) {
          case ConfirmResult.CANCEL:
            return;
          case ConfirmResult.DONT_SAVE:
            await this.revertEditors(editorService, logService, progressService, editors);
            break;
          case ConfirmResult.SAVE:
            await editorService.save(editors, { reason: SaveReason.EXPLICIT });
            break;
        }
      }
    }
    if (dirtyAutoSaveOnFocusChangeEditors.size > 0) {
      const editors = Array.from(dirtyAutoSaveOnFocusChangeEditors.values());
      await editorService.save(editors, { reason: SaveReason.FOCUS_CHANGE });
    }
    if (dirtyAutoSaveOnWindowChangeEditors.size > 0) {
      const editors = Array.from(dirtyAutoSaveOnWindowChangeEditors.values());
      await editorService.save(editors, { reason: SaveReason.WINDOW_CHANGE });
    }
    return this.doCloseAll(editorGroupService);
  }
  revertEditors(editorService, logService, progressService, editors) {
    return progressService.withProgress({
      location: ProgressLocation.Window,
      // use window progress to not be too annoying about this operation
      delay: 800,
      // delay so that it only appears when operation takes a long time
      title: localize("reverting", "Reverting Editors...")
    }, () => this.doRevertEditors(editorService, logService, editors));
  }
  async doRevertEditors(editorService, logService, editors) {
    try {
      await editorService.revert(editors);
    } catch (error) {
      logService.error(error);
      await editorService.revert(editors, { soft: true });
    }
  }
  async revealEditorsToConfirm(editors, editorGroupService) {
    try {
      const handledGroups = /* @__PURE__ */ new Set();
      for (const { editor, groupId } of editors) {
        if (handledGroups.has(groupId)) {
          continue;
        }
        handledGroups.add(groupId);
        const group = editorGroupService.getGroup(groupId);
        await group?.openEditor(editor);
      }
    } catch (error) {
    }
  }
  async doCloseAll(editorGroupService) {
    await Promise.all(this.groupsToClose(editorGroupService).map((group) => group.closeAllEditors({ excludeSticky: this.excludeSticky })));
  }
}
const _CloseAllEditorsAction = class _CloseAllEditorsAction extends AbstractCloseAllAction {
  constructor() {
    super({
      id: _CloseAllEditorsAction.ID,
      title: _CloseAllEditorsAction.LABEL,
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyW)
      },
      icon: Codicon.closeAll,
      category: Categories.View
    });
  }
  get excludeSticky() {
    return true;
  }
};
_CloseAllEditorsAction.ID = "workbench.action.closeAllEditors";
_CloseAllEditorsAction.LABEL = localize2("closeAllEditors", "Close All Editors");
let CloseAllEditorsAction = _CloseAllEditorsAction;
class CloseAllEditorGroupsAction extends AbstractCloseAllAction {
  constructor() {
    super({
      id: "workbench.action.closeAllGroups",
      title: localize2("closeAllGroups", "Close All Editor Groups"),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyW)
      },
      category: Categories.View
    });
  }
  get excludeSticky() {
    return false;
  }
  async doCloseAll(editorGroupService) {
    await super.doCloseAll(editorGroupService);
    for (const groupToClose of this.groupsToClose(editorGroupService)) {
      editorGroupService.removeGroup(groupToClose);
    }
  }
}
class CloseEditorsInOtherGroupsAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.closeEditorsInOtherGroups",
      title: localize2("closeEditorsInOtherGroups", "Close Editors in Other Groups"),
      f1: true,
      category: Categories.View
    });
  }
  async run(accessor, context) {
    const editorGroupService = accessor.get(IEditorGroupsService);
    const groupToSkip = context ? editorGroupService.getGroup(context.groupId) : editorGroupService.activeGroup;
    await Promise.all(editorGroupService.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE).map(async (group) => {
      if (groupToSkip && group.id === groupToSkip.id) {
        return;
      }
      return group.closeAllEditors({ excludeSticky: true });
    }));
  }
}
class CloseEditorInAllGroupsAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.closeEditorInAllGroups",
      title: localize2("closeEditorInAllGroups", "Close Editor in All Groups"),
      f1: true,
      category: Categories.View
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const editorGroupService = accessor.get(IEditorGroupsService);
    const activeEditor = editorService.activeEditor;
    if (activeEditor) {
      await Promise.all(editorGroupService.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE).map((group) => group.closeEditor(activeEditor)));
    }
  }
}
class AbstractMoveCopyGroupAction extends Action2 {
  constructor(desc, direction, isMove) {
    super(desc);
    this.direction = direction;
    this.isMove = isMove;
  }
  async run(accessor, context) {
    const editorGroupService = accessor.get(IEditorGroupsService);
    let sourceGroup;
    if (context && typeof context.groupId === "number") {
      sourceGroup = editorGroupService.getGroup(context.groupId);
    } else {
      sourceGroup = editorGroupService.activeGroup;
    }
    if (sourceGroup) {
      let resultGroup = void 0;
      if (this.isMove) {
        const targetGroup = this.findTargetGroup(editorGroupService, sourceGroup);
        if (targetGroup) {
          resultGroup = editorGroupService.moveGroup(sourceGroup, targetGroup, this.direction);
        }
      } else {
        resultGroup = editorGroupService.copyGroup(sourceGroup, sourceGroup, this.direction);
      }
      if (resultGroup) {
        editorGroupService.activateGroup(resultGroup);
      }
    }
  }
  findTargetGroup(editorGroupService, sourceGroup) {
    const targetNeighbours = [this.direction];
    switch (this.direction) {
      case GroupDirection.LEFT:
      case GroupDirection.RIGHT:
        targetNeighbours.push(GroupDirection.UP, GroupDirection.DOWN);
        break;
      case GroupDirection.UP:
      case GroupDirection.DOWN:
        targetNeighbours.push(GroupDirection.LEFT, GroupDirection.RIGHT);
        break;
    }
    for (const targetNeighbour of targetNeighbours) {
      const targetNeighbourGroup = editorGroupService.findGroup({ direction: targetNeighbour }, sourceGroup);
      if (targetNeighbourGroup) {
        return targetNeighbourGroup;
      }
    }
    return void 0;
  }
}
class AbstractMoveGroupAction extends AbstractMoveCopyGroupAction {
  constructor(desc, direction) {
    super(desc, direction, true);
  }
}
class MoveGroupLeftAction extends AbstractMoveGroupAction {
  constructor() {
    super({
      id: "workbench.action.moveActiveEditorGroupLeft",
      title: localize2("moveActiveGroupLeft", "Move Editor Group Left"),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.LeftArrow)
      },
      category: Categories.View
    }, GroupDirection.LEFT);
  }
}
class MoveGroupRightAction extends AbstractMoveGroupAction {
  constructor() {
    super({
      id: "workbench.action.moveActiveEditorGroupRight",
      title: localize2("moveActiveGroupRight", "Move Editor Group Right"),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.RightArrow)
      },
      category: Categories.View
    }, GroupDirection.RIGHT);
  }
}
class MoveGroupUpAction extends AbstractMoveGroupAction {
  constructor() {
    super({
      id: "workbench.action.moveActiveEditorGroupUp",
      title: localize2("moveActiveGroupUp", "Move Editor Group Up"),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.UpArrow)
      },
      category: Categories.View
    }, GroupDirection.UP);
  }
}
class MoveGroupDownAction extends AbstractMoveGroupAction {
  constructor() {
    super({
      id: "workbench.action.moveActiveEditorGroupDown",
      title: localize2("moveActiveGroupDown", "Move Editor Group Down"),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.DownArrow)
      },
      category: Categories.View
    }, GroupDirection.DOWN);
  }
}
class AbstractDuplicateGroupAction extends AbstractMoveCopyGroupAction {
  constructor(desc, direction) {
    super(desc, direction, false);
  }
}
class DuplicateGroupLeftAction extends AbstractDuplicateGroupAction {
  constructor() {
    super({
      id: "workbench.action.duplicateActiveEditorGroupLeft",
      title: localize2("duplicateActiveGroupLeft", "Duplicate Editor Group Left"),
      f1: true,
      category: Categories.View
    }, GroupDirection.LEFT);
  }
}
class DuplicateGroupRightAction extends AbstractDuplicateGroupAction {
  constructor() {
    super({
      id: "workbench.action.duplicateActiveEditorGroupRight",
      title: localize2("duplicateActiveGroupRight", "Duplicate Editor Group Right"),
      f1: true,
      category: Categories.View
    }, GroupDirection.RIGHT);
  }
}
class DuplicateGroupUpAction extends AbstractDuplicateGroupAction {
  constructor() {
    super({
      id: "workbench.action.duplicateActiveEditorGroupUp",
      title: localize2("duplicateActiveGroupUp", "Duplicate Editor Group Up"),
      f1: true,
      category: Categories.View
    }, GroupDirection.UP);
  }
}
class DuplicateGroupDownAction extends AbstractDuplicateGroupAction {
  constructor() {
    super({
      id: "workbench.action.duplicateActiveEditorGroupDown",
      title: localize2("duplicateActiveGroupDown", "Duplicate Editor Group Down"),
      f1: true,
      category: Categories.View
    }, GroupDirection.DOWN);
  }
}
class MinimizeOtherGroupsAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.minimizeOtherEditors",
      title: localize2("minimizeOtherEditorGroups", "Expand Editor Group"),
      f1: true,
      category: Categories.View,
      precondition: MultipleEditorGroupsContext
    });
  }
  async run(accessor) {
    const editorGroupService = accessor.get(IEditorGroupsService);
    editorGroupService.arrangeGroups(GroupsArrangement.EXPAND);
  }
}
class MinimizeOtherGroupsHideSidebarAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.minimizeOtherEditorsHideSidebar",
      title: localize2("minimizeOtherEditorGroupsHideSidebar", "Expand Editor Group and Hide Side Bars"),
      f1: true,
      category: Categories.View,
      precondition: ContextKeyExpr.or(MultipleEditorGroupsContext, SideBarVisibleContext, AuxiliaryBarVisibleContext)
    });
  }
  async run(accessor) {
    const editorGroupService = accessor.get(IEditorGroupsService);
    const layoutService = accessor.get(IWorkbenchLayoutService);
    layoutService.setPartHidden(true, Parts.SIDEBAR_PART);
    layoutService.setPartHidden(true, Parts.AUXILIARYBAR_PART);
    editorGroupService.arrangeGroups(GroupsArrangement.EXPAND);
  }
}
class ResetGroupSizesAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.evenEditorWidths",
      title: localize2("evenEditorGroups", "Reset Editor Group Sizes"),
      f1: true,
      category: Categories.View
    });
  }
  async run(accessor) {
    const editorGroupService = accessor.get(IEditorGroupsService);
    editorGroupService.arrangeGroups(GroupsArrangement.EVEN);
  }
}
class ToggleGroupSizesAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.toggleEditorWidths",
      title: localize2("toggleEditorWidths", "Toggle Editor Group Sizes"),
      f1: true,
      category: Categories.View
    });
  }
  async run(accessor) {
    const editorGroupService = accessor.get(IEditorGroupsService);
    editorGroupService.toggleExpandGroup();
  }
}
class MaximizeGroupHideSidebarAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.maximizeEditorHideSidebar",
      title: localize2("maximizeEditorHideSidebar", "Maximize Editor Group and Hide Side Bars"),
      f1: true,
      category: Categories.View,
      precondition: ContextKeyExpr.or(ContextKeyExpr.and(EditorPartMaximizedEditorGroupContext.negate(), EditorPartMultipleEditorGroupsContext), SideBarVisibleContext, AuxiliaryBarVisibleContext)
    });
  }
  async run(accessor) {
    const layoutService = accessor.get(IWorkbenchLayoutService);
    const editorGroupService = accessor.get(IEditorGroupsService);
    const editorService = accessor.get(IEditorService);
    if (editorService.activeEditor) {
      layoutService.setPartHidden(true, Parts.SIDEBAR_PART);
      layoutService.setPartHidden(true, Parts.AUXILIARYBAR_PART);
      editorGroupService.arrangeGroups(GroupsArrangement.MAXIMIZE);
    }
  }
}
class ToggleMaximizeEditorGroupAction extends Action2 {
  constructor() {
    super({
      id: TOGGLE_MAXIMIZE_EDITOR_GROUP,
      title: localize2("toggleMaximizeEditorGroup", "Toggle Maximize Editor Group"),
      f1: true,
      category: Categories.View,
      precondition: ContextKeyExpr.or(EditorPartMultipleEditorGroupsContext, EditorPartMaximizedEditorGroupContext),
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyM)
      },
      menu: [
        {
          id: MenuId.EditorTitle,
          order: -1e4,
          // towards the front
          group: "navigation",
          when: EditorPartMaximizedEditorGroupContext
        },
        {
          id: MenuId.EmptyEditorGroup,
          order: -1e4,
          // towards the front
          group: "navigation",
          when: EditorPartMaximizedEditorGroupContext
        }
      ],
      icon: Codicon.screenFull,
      toggled: EditorPartMaximizedEditorGroupContext
    });
  }
  async run(accessor, ...args) {
    const editorGroupsService = accessor.get(IEditorGroupsService);
    const editorService = accessor.get(IEditorService);
    const listService = accessor.get(IListService);
    const resolvedContext = resolveCommandsContext(args, editorService, editorGroupsService, listService);
    if (resolvedContext.groupedEditors.length) {
      editorGroupsService.toggleMaximizeGroup(resolvedContext.groupedEditors[0].group);
    }
  }
}
class AbstractNavigateEditorAction extends Action2 {
  async run(accessor) {
    const editorGroupService = accessor.get(IEditorGroupsService);
    const result = this.navigate(editorGroupService);
    if (!result) {
      return;
    }
    const { groupId, editor } = result;
    if (!editor) {
      return;
    }
    const group = editorGroupService.getGroup(groupId);
    if (group) {
      await group.openEditor(editor);
    }
  }
}
class OpenNextEditor extends AbstractNavigateEditorAction {
  constructor() {
    super({
      id: "workbench.action.nextEditor",
      title: localize2("openNextEditor", "Open Next Editor"),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyCode.PageDown,
        mac: {
          primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.RightArrow,
          secondary: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.BracketRight]
        }
      },
      category: Categories.View
    });
  }
  navigate(editorGroupService) {
    const activeGroup = editorGroupService.activeGroup;
    const activeGroupEditors = activeGroup.getEditors(EditorsOrder.SEQUENTIAL);
    const activeEditorIndex = activeGroup.activeEditor ? activeGroupEditors.indexOf(activeGroup.activeEditor) : -1;
    if (activeEditorIndex + 1 < activeGroupEditors.length) {
      return { editor: activeGroupEditors[activeEditorIndex + 1], groupId: activeGroup.id };
    }
    const handledGroups = /* @__PURE__ */ new Set();
    let currentGroup = editorGroupService.activeGroup;
    while (currentGroup && !handledGroups.has(currentGroup.id)) {
      currentGroup = editorGroupService.findGroup({ location: GroupLocation.NEXT }, currentGroup, true);
      if (currentGroup) {
        handledGroups.add(currentGroup.id);
        const groupEditors = currentGroup.getEditors(EditorsOrder.SEQUENTIAL);
        if (groupEditors.length > 0) {
          return { editor: groupEditors[0], groupId: currentGroup.id };
        }
      }
    }
    return void 0;
  }
}
class OpenPreviousEditor extends AbstractNavigateEditorAction {
  constructor() {
    super({
      id: "workbench.action.previousEditor",
      title: localize2("openPreviousEditor", "Open Previous Editor"),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyCode.PageUp,
        mac: {
          primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.LeftArrow,
          secondary: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.BracketLeft]
        }
      },
      category: Categories.View
    });
  }
  navigate(editorGroupService) {
    const activeGroup = editorGroupService.activeGroup;
    const activeGroupEditors = activeGroup.getEditors(EditorsOrder.SEQUENTIAL);
    const activeEditorIndex = activeGroup.activeEditor ? activeGroupEditors.indexOf(activeGroup.activeEditor) : -1;
    if (activeEditorIndex > 0) {
      return { editor: activeGroupEditors[activeEditorIndex - 1], groupId: activeGroup.id };
    }
    const handledGroups = /* @__PURE__ */ new Set();
    let currentGroup = editorGroupService.activeGroup;
    while (currentGroup && !handledGroups.has(currentGroup.id)) {
      currentGroup = editorGroupService.findGroup({ location: GroupLocation.PREVIOUS }, currentGroup, true);
      if (currentGroup) {
        handledGroups.add(currentGroup.id);
        const groupEditors = currentGroup.getEditors(EditorsOrder.SEQUENTIAL);
        if (groupEditors.length > 0) {
          return { editor: groupEditors[groupEditors.length - 1], groupId: currentGroup.id };
        }
      }
    }
    return void 0;
  }
}
class OpenNextEditorInGroup extends AbstractNavigateEditorAction {
  constructor() {
    super({
      id: "workbench.action.nextEditorInGroup",
      title: localize2("nextEditorInGroup", "Open Next Editor in Group"),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.PageDown),
        mac: {
          primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.RightArrow)
        }
      },
      category: Categories.View
    });
  }
  navigate(editorGroupService) {
    const group = editorGroupService.activeGroup;
    const editors = group.getEditors(EditorsOrder.SEQUENTIAL);
    const index = group.activeEditor ? editors.indexOf(group.activeEditor) : -1;
    return { editor: index + 1 < editors.length ? editors[index + 1] : editors[0], groupId: group.id };
  }
}
class OpenPreviousEditorInGroup extends AbstractNavigateEditorAction {
  constructor() {
    super({
      id: "workbench.action.previousEditorInGroup",
      title: localize2("openPreviousEditorInGroup", "Open Previous Editor in Group"),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.PageUp),
        mac: {
          primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.LeftArrow)
        }
      },
      category: Categories.View
    });
  }
  navigate(editorGroupService) {
    const group = editorGroupService.activeGroup;
    const editors = group.getEditors(EditorsOrder.SEQUENTIAL);
    const index = group.activeEditor ? editors.indexOf(group.activeEditor) : -1;
    return { editor: index > 0 ? editors[index - 1] : editors[editors.length - 1], groupId: group.id };
  }
}
class OpenFirstEditorInGroup extends AbstractNavigateEditorAction {
  constructor() {
    super({
      id: "workbench.action.firstEditorInGroup",
      title: localize2("firstEditorInGroup", "Open First Editor in Group"),
      f1: true,
      category: Categories.View
    });
  }
  navigate(editorGroupService) {
    const group = editorGroupService.activeGroup;
    const editors = group.getEditors(EditorsOrder.SEQUENTIAL);
    return { editor: editors[0], groupId: group.id };
  }
}
class OpenLastEditorInGroup extends AbstractNavigateEditorAction {
  constructor() {
    super({
      id: "workbench.action.lastEditorInGroup",
      title: localize2("lastEditorInGroup", "Open Last Editor in Group"),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.Alt | KeyCode.Digit0,
        secondary: [KeyMod.CtrlCmd | KeyCode.Digit9],
        mac: {
          primary: KeyMod.WinCtrl | KeyCode.Digit0,
          secondary: [KeyMod.CtrlCmd | KeyCode.Digit9]
        }
      },
      category: Categories.View
    });
  }
  navigate(editorGroupService) {
    const group = editorGroupService.activeGroup;
    const editors = group.getEditors(EditorsOrder.SEQUENTIAL);
    return { editor: editors[editors.length - 1], groupId: group.id };
  }
}
const _NavigateForwardAction = class _NavigateForwardAction extends Action2 {
  constructor() {
    super({
      id: _NavigateForwardAction.ID,
      title: {
        ...localize2("navigateForward", "Go Forward"),
        mnemonicTitle: localize({ key: "miForward", comment: ["&& denotes a mnemonic"] }, "&&Forward")
      },
      f1: true,
      icon: Codicon.arrowRight,
      precondition: ContextKeyExpr.has("canNavigateForward"),
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        win: { primary: KeyMod.Alt | KeyCode.RightArrow, secondary: [KeyCode.BrowserForward] },
        mac: { primary: KeyMod.WinCtrl | KeyMod.Shift | KeyCode.Minus, secondary: [KeyCode.BrowserForward] },
        linux: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Minus, secondary: [KeyCode.BrowserForward] }
      },
      menu: [
        { id: MenuId.MenubarGoMenu, group: "1_history_nav", order: 2 },
        { id: MenuId.CommandCenter, order: 2, when: ContextKeyExpr.has("config.workbench.navigationControl.enabled") }
      ]
    });
  }
  async run(accessor) {
    const historyService = accessor.get(IHistoryService);
    await historyService.goForward(GoFilter.NONE);
  }
};
_NavigateForwardAction.ID = "workbench.action.navigateForward";
_NavigateForwardAction.LABEL = localize("navigateForward", "Go Forward");
let NavigateForwardAction = _NavigateForwardAction;
const _NavigateBackwardsAction = class _NavigateBackwardsAction extends Action2 {
  constructor() {
    super({
      id: _NavigateBackwardsAction.ID,
      title: {
        ...localize2("navigateBack", "Go Back"),
        mnemonicTitle: localize({ key: "miBack", comment: ["&& denotes a mnemonic"] }, "&&Back")
      },
      f1: true,
      precondition: ContextKeyExpr.has("canNavigateBack"),
      icon: Codicon.arrowLeft,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        win: { primary: KeyMod.Alt | KeyCode.LeftArrow, secondary: [KeyCode.BrowserBack] },
        mac: { primary: KeyMod.WinCtrl | KeyCode.Minus, secondary: [KeyCode.BrowserBack] },
        linux: { primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.Minus, secondary: [KeyCode.BrowserBack] }
      },
      menu: [
        { id: MenuId.MenubarGoMenu, group: "1_history_nav", order: 1 },
        { id: MenuId.CommandCenter, order: 1, when: ContextKeyExpr.has("config.workbench.navigationControl.enabled") }
      ]
    });
  }
  async run(accessor) {
    const historyService = accessor.get(IHistoryService);
    await historyService.goBack(GoFilter.NONE);
  }
};
_NavigateBackwardsAction.ID = "workbench.action.navigateBack";
_NavigateBackwardsAction.LABEL = localize("navigateBack", "Go Back");
let NavigateBackwardsAction = _NavigateBackwardsAction;
class NavigatePreviousAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.navigateLast",
      title: localize2("navigatePrevious", "Go Previous"),
      f1: true
    });
  }
  async run(accessor) {
    const historyService = accessor.get(IHistoryService);
    await historyService.goPrevious(GoFilter.NONE);
  }
}
class NavigateForwardInEditsAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.navigateForwardInEditLocations",
      title: localize2("navigateForwardInEdits", "Go Forward in Edit Locations"),
      f1: true
    });
  }
  async run(accessor) {
    const historyService = accessor.get(IHistoryService);
    await historyService.goForward(GoFilter.EDITS);
  }
}
class NavigateBackwardsInEditsAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.navigateBackInEditLocations",
      title: localize2("navigateBackInEdits", "Go Back in Edit Locations"),
      f1: true
    });
  }
  async run(accessor) {
    const historyService = accessor.get(IHistoryService);
    await historyService.goBack(GoFilter.EDITS);
  }
}
class NavigatePreviousInEditsAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.navigatePreviousInEditLocations",
      title: localize2("navigatePreviousInEdits", "Go Previous in Edit Locations"),
      f1: true
    });
  }
  async run(accessor) {
    const historyService = accessor.get(IHistoryService);
    await historyService.goPrevious(GoFilter.EDITS);
  }
}
class NavigateToLastEditLocationAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.navigateToLastEditLocation",
      title: localize2("navigateToLastEditLocation", "Go to Last Edit Location"),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyQ)
      }
    });
  }
  async run(accessor) {
    const historyService = accessor.get(IHistoryService);
    await historyService.goLast(GoFilter.EDITS);
  }
}
class NavigateForwardInNavigationsAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.navigateForwardInNavigationLocations",
      title: localize2("navigateForwardInNavigations", "Go Forward in Navigation Locations"),
      f1: true
    });
  }
  async run(accessor) {
    const historyService = accessor.get(IHistoryService);
    await historyService.goForward(GoFilter.NAVIGATION);
  }
}
class NavigateBackwardsInNavigationsAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.navigateBackInNavigationLocations",
      title: localize2("navigateBackInNavigations", "Go Back in Navigation Locations"),
      f1: true
    });
  }
  async run(accessor) {
    const historyService = accessor.get(IHistoryService);
    await historyService.goBack(GoFilter.NAVIGATION);
  }
}
class NavigatePreviousInNavigationsAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.navigatePreviousInNavigationLocations",
      title: localize2("navigatePreviousInNavigationLocations", "Go Previous in Navigation Locations"),
      f1: true
    });
  }
  async run(accessor) {
    const historyService = accessor.get(IHistoryService);
    await historyService.goPrevious(GoFilter.NAVIGATION);
  }
}
class NavigateToLastNavigationLocationAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.navigateToLastNavigationLocation",
      title: localize2("navigateToLastNavigationLocation", "Go to Last Navigation Location"),
      f1: true
    });
  }
  async run(accessor) {
    const historyService = accessor.get(IHistoryService);
    await historyService.goLast(GoFilter.NAVIGATION);
  }
}
const _ReopenClosedEditorAction = class _ReopenClosedEditorAction extends Action2 {
  constructor() {
    super({
      id: _ReopenClosedEditorAction.ID,
      title: localize2("reopenClosedEditor", "Reopen Closed Editor"),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyT
      },
      category: Categories.View
    });
  }
  async run(accessor) {
    const historyService = accessor.get(IHistoryService);
    await historyService.reopenLastClosedEditor();
  }
};
_ReopenClosedEditorAction.ID = "workbench.action.reopenClosedEditor";
let ReopenClosedEditorAction = _ReopenClosedEditorAction;
const _ClearRecentFilesAction = class _ClearRecentFilesAction extends Action2 {
  constructor() {
    super({
      id: _ClearRecentFilesAction.ID,
      title: localize2("clearRecentFiles", "Clear Recently Opened..."),
      f1: true,
      category: Categories.File
    });
  }
  async run(accessor) {
    const dialogService = accessor.get(IDialogService);
    const workspacesService = accessor.get(IWorkspacesService);
    const historyService = accessor.get(IHistoryService);
    const { confirmed } = await dialogService.confirm({
      type: "warning",
      message: localize("confirmClearRecentsMessage", "Do you want to clear all recently opened files and workspaces?"),
      detail: localize("confirmClearDetail", "This action is irreversible!"),
      primaryButton: localize({ key: "clearButtonLabel", comment: ["&& denotes a mnemonic"] }, "&&Clear")
    });
    if (!confirmed) {
      return;
    }
    workspacesService.clearRecentlyOpened();
    historyService.clearRecentlyOpened();
  }
};
_ClearRecentFilesAction.ID = "workbench.action.clearRecentFiles";
let ClearRecentFilesAction = _ClearRecentFilesAction;
const _ShowEditorsInActiveGroupByMostRecentlyUsedAction = class _ShowEditorsInActiveGroupByMostRecentlyUsedAction extends Action2 {
  constructor() {
    super({
      id: _ShowEditorsInActiveGroupByMostRecentlyUsedAction.ID,
      title: localize2("showEditorsInActiveGroup", "Show Editors in Active Group By Most Recently Used"),
      f1: true,
      category: Categories.View
    });
  }
  async run(accessor) {
    const quickInputService = accessor.get(IQuickInputService);
    quickInputService.quickAccess.show(ActiveGroupEditorsByMostRecentlyUsedQuickAccess.PREFIX);
  }
};
_ShowEditorsInActiveGroupByMostRecentlyUsedAction.ID = "workbench.action.showEditorsInActiveGroup";
let ShowEditorsInActiveGroupByMostRecentlyUsedAction = _ShowEditorsInActiveGroupByMostRecentlyUsedAction;
const _ShowAllEditorsByAppearanceAction = class _ShowAllEditorsByAppearanceAction extends Action2 {
  constructor() {
    super({
      id: _ShowAllEditorsByAppearanceAction.ID,
      title: localize2("showAllEditors", "Show All Editors By Appearance"),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyP),
        mac: {
          primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.Tab
        }
      },
      category: Categories.File
    });
  }
  async run(accessor) {
    const quickInputService = accessor.get(IQuickInputService);
    quickInputService.quickAccess.show(AllEditorsByAppearanceQuickAccess.PREFIX);
  }
};
_ShowAllEditorsByAppearanceAction.ID = "workbench.action.showAllEditors";
let ShowAllEditorsByAppearanceAction = _ShowAllEditorsByAppearanceAction;
const _ShowAllEditorsByMostRecentlyUsedAction = class _ShowAllEditorsByMostRecentlyUsedAction extends Action2 {
  constructor() {
    super({
      id: _ShowAllEditorsByMostRecentlyUsedAction.ID,
      title: localize2("showAllEditorsByMostRecentlyUsed", "Show All Editors By Most Recently Used"),
      f1: true,
      category: Categories.View
    });
  }
  async run(accessor) {
    const quickInputService = accessor.get(IQuickInputService);
    quickInputService.quickAccess.show(AllEditorsByMostRecentlyUsedQuickAccess.PREFIX);
  }
};
_ShowAllEditorsByMostRecentlyUsedAction.ID = "workbench.action.showAllEditorsByMostRecentlyUsed";
let ShowAllEditorsByMostRecentlyUsedAction = _ShowAllEditorsByMostRecentlyUsedAction;
class AbstractQuickAccessEditorAction extends Action2 {
  constructor(desc, prefix, itemActivation) {
    super(desc);
    this.prefix = prefix;
    this.itemActivation = itemActivation;
  }
  async run(accessor) {
    const keybindingService = accessor.get(IKeybindingService);
    const quickInputService = accessor.get(IQuickInputService);
    const keybindings = keybindingService.lookupKeybindings(this.desc.id);
    quickInputService.quickAccess.show(this.prefix, {
      quickNavigateConfiguration: { keybindings },
      itemActivation: this.itemActivation
    });
  }
}
class QuickAccessPreviousRecentlyUsedEditorAction extends AbstractQuickAccessEditorAction {
  constructor() {
    super({
      id: "workbench.action.quickOpenPreviousRecentlyUsedEditor",
      title: localize2("quickOpenPreviousRecentlyUsedEditor", "Quick Open Previous Recently Used Editor"),
      f1: true,
      category: Categories.View
    }, AllEditorsByMostRecentlyUsedQuickAccess.PREFIX, void 0);
  }
}
class QuickAccessLeastRecentlyUsedEditorAction extends AbstractQuickAccessEditorAction {
  constructor() {
    super({
      id: "workbench.action.quickOpenLeastRecentlyUsedEditor",
      title: localize2("quickOpenLeastRecentlyUsedEditor", "Quick Open Least Recently Used Editor"),
      f1: true,
      category: Categories.View
    }, AllEditorsByMostRecentlyUsedQuickAccess.PREFIX, void 0);
  }
}
class QuickAccessPreviousRecentlyUsedEditorInGroupAction extends AbstractQuickAccessEditorAction {
  constructor() {
    super({
      id: "workbench.action.quickOpenPreviousRecentlyUsedEditorInGroup",
      title: localize2("quickOpenPreviousRecentlyUsedEditorInGroup", "Quick Open Previous Recently Used Editor in Group"),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyCode.Tab,
        mac: {
          primary: KeyMod.WinCtrl | KeyCode.Tab
        }
      },
      precondition: ActiveEditorGroupEmptyContext.toNegated(),
      category: Categories.View
    }, ActiveGroupEditorsByMostRecentlyUsedQuickAccess.PREFIX, void 0);
  }
}
class QuickAccessLeastRecentlyUsedEditorInGroupAction extends AbstractQuickAccessEditorAction {
  constructor() {
    super({
      id: "workbench.action.quickOpenLeastRecentlyUsedEditorInGroup",
      title: localize2("quickOpenLeastRecentlyUsedEditorInGroup", "Quick Open Least Recently Used Editor in Group"),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Tab,
        mac: {
          primary: KeyMod.WinCtrl | KeyMod.Shift | KeyCode.Tab
        }
      },
      precondition: ActiveEditorGroupEmptyContext.toNegated(),
      category: Categories.View
    }, ActiveGroupEditorsByMostRecentlyUsedQuickAccess.PREFIX, ItemActivation.LAST);
  }
}
const _QuickAccessPreviousEditorFromHistoryAction = class _QuickAccessPreviousEditorFromHistoryAction extends Action2 {
  constructor() {
    super({
      id: _QuickAccessPreviousEditorFromHistoryAction.ID,
      title: localize2("navigateEditorHistoryByInput", "Quick Open Previous Editor from History"),
      f1: true
    });
  }
  async run(accessor) {
    const keybindingService = accessor.get(IKeybindingService);
    const quickInputService = accessor.get(IQuickInputService);
    const editorGroupService = accessor.get(IEditorGroupsService);
    const keybindings = keybindingService.lookupKeybindings(_QuickAccessPreviousEditorFromHistoryAction.ID);
    let itemActivation = void 0;
    if (editorGroupService.activeGroup.count === 0) {
      itemActivation = ItemActivation.FIRST;
    }
    quickInputService.quickAccess.show("", { quickNavigateConfiguration: { keybindings }, itemActivation });
  }
};
_QuickAccessPreviousEditorFromHistoryAction.ID = "workbench.action.openPreviousEditorFromHistory";
let QuickAccessPreviousEditorFromHistoryAction = _QuickAccessPreviousEditorFromHistoryAction;
class OpenNextRecentlyUsedEditorAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.openNextRecentlyUsedEditor",
      title: localize2("openNextRecentlyUsedEditor", "Open Next Recently Used Editor"),
      f1: true,
      category: Categories.View
    });
  }
  async run(accessor) {
    const historyService = accessor.get(IHistoryService);
    historyService.openNextRecentlyUsedEditor();
  }
}
class OpenPreviousRecentlyUsedEditorAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.openPreviousRecentlyUsedEditor",
      title: localize2("openPreviousRecentlyUsedEditor", "Open Previous Recently Used Editor"),
      f1: true,
      category: Categories.View
    });
  }
  async run(accessor) {
    const historyService = accessor.get(IHistoryService);
    historyService.openPreviouslyUsedEditor();
  }
}
class OpenNextRecentlyUsedEditorInGroupAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.openNextRecentlyUsedEditorInGroup",
      title: localize2("openNextRecentlyUsedEditorInGroup", "Open Next Recently Used Editor In Group"),
      f1: true,
      category: Categories.View
    });
  }
  async run(accessor) {
    const historyService = accessor.get(IHistoryService);
    const editorGroupsService = accessor.get(IEditorGroupsService);
    historyService.openNextRecentlyUsedEditor(editorGroupsService.activeGroup.id);
  }
}
class OpenPreviousRecentlyUsedEditorInGroupAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.openPreviousRecentlyUsedEditorInGroup",
      title: localize2("openPreviousRecentlyUsedEditorInGroup", "Open Previous Recently Used Editor In Group"),
      f1: true,
      category: Categories.View
    });
  }
  async run(accessor) {
    const historyService = accessor.get(IHistoryService);
    const editorGroupsService = accessor.get(IEditorGroupsService);
    historyService.openPreviouslyUsedEditor(editorGroupsService.activeGroup.id);
  }
}
class ClearEditorHistoryAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.clearEditorHistory",
      title: localize2("clearEditorHistory", "Clear Editor History"),
      f1: true
    });
  }
  async run(accessor) {
    const dialogService = accessor.get(IDialogService);
    const historyService = accessor.get(IHistoryService);
    const { confirmed } = await dialogService.confirm({
      type: "warning",
      message: localize("confirmClearEditorHistoryMessage", "Do you want to clear the history of recently opened editors?"),
      detail: localize("confirmClearDetail", "This action is irreversible!"),
      primaryButton: localize({ key: "clearButtonLabel", comment: ["&& denotes a mnemonic"] }, "&&Clear")
    });
    if (!confirmed) {
      return;
    }
    historyService.clear();
  }
}
class MoveEditorLeftInGroupAction extends ExecuteCommandAction {
  constructor() {
    super({
      id: "workbench.action.moveEditorLeftInGroup",
      title: localize2("moveEditorLeft", "Move Editor Left"),
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.PageUp,
        mac: {
          primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.LeftArrow)
        }
      },
      f1: true,
      category: Categories.View
    }, MOVE_ACTIVE_EDITOR_COMMAND_ID, { to: "left" });
  }
}
class MoveEditorRightInGroupAction extends ExecuteCommandAction {
  constructor() {
    super({
      id: "workbench.action.moveEditorRightInGroup",
      title: localize2("moveEditorRight", "Move Editor Right"),
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.PageDown,
        mac: {
          primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.RightArrow)
        }
      },
      f1: true,
      category: Categories.View
    }, MOVE_ACTIVE_EDITOR_COMMAND_ID, { to: "right" });
  }
}
class MoveEditorToPreviousGroupAction extends ExecuteCommandAction {
  constructor() {
    super({
      id: "workbench.action.moveEditorToPreviousGroup",
      title: localize2("moveEditorToPreviousGroup", "Move Editor into Previous Group"),
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.LeftArrow,
        mac: {
          primary: KeyMod.CtrlCmd | KeyMod.WinCtrl | KeyCode.LeftArrow
        }
      },
      f1: true,
      category: Categories.View
    }, MOVE_ACTIVE_EDITOR_COMMAND_ID, { to: "previous", by: "group" });
  }
}
class MoveEditorToNextGroupAction extends ExecuteCommandAction {
  constructor() {
    super({
      id: "workbench.action.moveEditorToNextGroup",
      title: localize2("moveEditorToNextGroup", "Move Editor into Next Group"),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.RightArrow,
        mac: {
          primary: KeyMod.CtrlCmd | KeyMod.WinCtrl | KeyCode.RightArrow
        }
      },
      category: Categories.View
    }, MOVE_ACTIVE_EDITOR_COMMAND_ID, { to: "next", by: "group" });
  }
}
class MoveEditorToAboveGroupAction extends ExecuteCommandAction {
  constructor() {
    super({
      id: "workbench.action.moveEditorToAboveGroup",
      title: localize2("moveEditorToAboveGroup", "Move Editor into Group Above"),
      f1: true,
      category: Categories.View
    }, MOVE_ACTIVE_EDITOR_COMMAND_ID, { to: "up", by: "group" });
  }
}
class MoveEditorToBelowGroupAction extends ExecuteCommandAction {
  constructor() {
    super({
      id: "workbench.action.moveEditorToBelowGroup",
      title: localize2("moveEditorToBelowGroup", "Move Editor into Group Below"),
      f1: true,
      category: Categories.View
    }, MOVE_ACTIVE_EDITOR_COMMAND_ID, { to: "down", by: "group" });
  }
}
class MoveEditorToLeftGroupAction extends ExecuteCommandAction {
  constructor() {
    super({
      id: "workbench.action.moveEditorToLeftGroup",
      title: localize2("moveEditorToLeftGroup", "Move Editor into Left Group"),
      f1: true,
      category: Categories.View
    }, MOVE_ACTIVE_EDITOR_COMMAND_ID, { to: "left", by: "group" });
  }
}
class MoveEditorToRightGroupAction extends ExecuteCommandAction {
  constructor() {
    super({
      id: "workbench.action.moveEditorToRightGroup",
      title: localize2("moveEditorToRightGroup", "Move Editor into Right Group"),
      f1: true,
      category: Categories.View
    }, MOVE_ACTIVE_EDITOR_COMMAND_ID, { to: "right", by: "group" });
  }
}
class MoveEditorToFirstGroupAction extends ExecuteCommandAction {
  constructor() {
    super({
      id: "workbench.action.moveEditorToFirstGroup",
      title: localize2("moveEditorToFirstGroup", "Move Editor into First Group"),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.Shift | KeyMod.Alt | KeyCode.Digit1,
        mac: {
          primary: KeyMod.CtrlCmd | KeyMod.WinCtrl | KeyCode.Digit1
        }
      },
      category: Categories.View
    }, MOVE_ACTIVE_EDITOR_COMMAND_ID, { to: "first", by: "group" });
  }
}
class MoveEditorToLastGroupAction extends ExecuteCommandAction {
  constructor() {
    super({
      id: "workbench.action.moveEditorToLastGroup",
      title: localize2("moveEditorToLastGroup", "Move Editor into Last Group"),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.Shift | KeyMod.Alt | KeyCode.Digit9,
        mac: {
          primary: KeyMod.CtrlCmd | KeyMod.WinCtrl | KeyCode.Digit9
        }
      },
      category: Categories.View
    }, MOVE_ACTIVE_EDITOR_COMMAND_ID, { to: "last", by: "group" });
  }
}
class SplitEditorToPreviousGroupAction extends ExecuteCommandAction {
  constructor() {
    super({
      id: "workbench.action.splitEditorToPreviousGroup",
      title: localize2("splitEditorToPreviousGroup", "Split Editor into Previous Group"),
      f1: true,
      category: Categories.View
    }, COPY_ACTIVE_EDITOR_COMMAND_ID, { to: "previous", by: "group" });
  }
}
class SplitEditorToNextGroupAction extends ExecuteCommandAction {
  constructor() {
    super({
      id: "workbench.action.splitEditorToNextGroup",
      title: localize2("splitEditorToNextGroup", "Split Editor into Next Group"),
      f1: true,
      category: Categories.View
    }, COPY_ACTIVE_EDITOR_COMMAND_ID, { to: "next", by: "group" });
  }
}
class SplitEditorToAboveGroupAction extends ExecuteCommandAction {
  constructor() {
    super({
      id: "workbench.action.splitEditorToAboveGroup",
      title: localize2("splitEditorToAboveGroup", "Split Editor into Group Above"),
      f1: true,
      category: Categories.View
    }, COPY_ACTIVE_EDITOR_COMMAND_ID, { to: "up", by: "group" });
  }
}
class SplitEditorToBelowGroupAction extends ExecuteCommandAction {
  constructor() {
    super({
      id: "workbench.action.splitEditorToBelowGroup",
      title: localize2("splitEditorToBelowGroup", "Split Editor into Group Below"),
      f1: true,
      category: Categories.View
    }, COPY_ACTIVE_EDITOR_COMMAND_ID, { to: "down", by: "group" });
  }
}
class SplitEditorToLeftGroupAction extends ExecuteCommandAction {
  constructor() {
    super({
      id: "workbench.action.splitEditorToLeftGroup",
      title: localize2("splitEditorToLeftGroup", "Split Editor into Left Group"),
      f1: true,
      category: Categories.View
    }, COPY_ACTIVE_EDITOR_COMMAND_ID, { to: "left", by: "group" });
  }
}
SplitEditorToLeftGroupAction.ID = "workbench.action.splitEditorToLeftGroup";
SplitEditorToLeftGroupAction.LABEL = localize("splitEditorToLeftGroup", "Split Editor into Left Group");
class SplitEditorToRightGroupAction extends ExecuteCommandAction {
  constructor() {
    super({
      id: "workbench.action.splitEditorToRightGroup",
      title: localize2("splitEditorToRightGroup", "Split Editor into Right Group"),
      f1: true,
      category: Categories.View
    }, COPY_ACTIVE_EDITOR_COMMAND_ID, { to: "right", by: "group" });
  }
}
class SplitEditorToFirstGroupAction extends ExecuteCommandAction {
  constructor() {
    super({
      id: "workbench.action.splitEditorToFirstGroup",
      title: localize2("splitEditorToFirstGroup", "Split Editor into First Group"),
      f1: true,
      category: Categories.View
    }, COPY_ACTIVE_EDITOR_COMMAND_ID, { to: "first", by: "group" });
  }
}
class SplitEditorToLastGroupAction extends ExecuteCommandAction {
  constructor() {
    super({
      id: "workbench.action.splitEditorToLastGroup",
      title: localize2("splitEditorToLastGroup", "Split Editor into Last Group"),
      f1: true,
      category: Categories.View
    }, COPY_ACTIVE_EDITOR_COMMAND_ID, { to: "last", by: "group" });
  }
}
const _EditorLayoutSingleAction = class _EditorLayoutSingleAction extends ExecuteCommandAction {
  constructor() {
    super({
      id: _EditorLayoutSingleAction.ID,
      title: localize2("editorLayoutSingle", "Single Column Editor Layout"),
      f1: true,
      category: Categories.View
    }, LAYOUT_EDITOR_GROUPS_COMMAND_ID, { groups: [{}], orientation: GroupOrientation.HORIZONTAL });
  }
};
_EditorLayoutSingleAction.ID = "workbench.action.editorLayoutSingle";
let EditorLayoutSingleAction = _EditorLayoutSingleAction;
const _EditorLayoutTwoColumnsAction = class _EditorLayoutTwoColumnsAction extends ExecuteCommandAction {
  constructor() {
    super({
      id: _EditorLayoutTwoColumnsAction.ID,
      title: localize2("editorLayoutTwoColumns", "Two Columns Editor Layout"),
      f1: true,
      category: Categories.View
    }, LAYOUT_EDITOR_GROUPS_COMMAND_ID, { groups: [{}, {}], orientation: GroupOrientation.HORIZONTAL });
  }
};
_EditorLayoutTwoColumnsAction.ID = "workbench.action.editorLayoutTwoColumns";
let EditorLayoutTwoColumnsAction = _EditorLayoutTwoColumnsAction;
const _EditorLayoutThreeColumnsAction = class _EditorLayoutThreeColumnsAction extends ExecuteCommandAction {
  constructor() {
    super({
      id: _EditorLayoutThreeColumnsAction.ID,
      title: localize2("editorLayoutThreeColumns", "Three Columns Editor Layout"),
      f1: true,
      category: Categories.View
    }, LAYOUT_EDITOR_GROUPS_COMMAND_ID, { groups: [{}, {}, {}], orientation: GroupOrientation.HORIZONTAL });
  }
};
_EditorLayoutThreeColumnsAction.ID = "workbench.action.editorLayoutThreeColumns";
let EditorLayoutThreeColumnsAction = _EditorLayoutThreeColumnsAction;
const _EditorLayoutTwoRowsAction = class _EditorLayoutTwoRowsAction extends ExecuteCommandAction {
  constructor() {
    super({
      id: _EditorLayoutTwoRowsAction.ID,
      title: localize2("editorLayoutTwoRows", "Two Rows Editor Layout"),
      f1: true,
      category: Categories.View
    }, LAYOUT_EDITOR_GROUPS_COMMAND_ID, { groups: [{}, {}], orientation: GroupOrientation.VERTICAL });
  }
};
_EditorLayoutTwoRowsAction.ID = "workbench.action.editorLayoutTwoRows";
let EditorLayoutTwoRowsAction = _EditorLayoutTwoRowsAction;
const _EditorLayoutThreeRowsAction = class _EditorLayoutThreeRowsAction extends ExecuteCommandAction {
  constructor() {
    super({
      id: _EditorLayoutThreeRowsAction.ID,
      title: localize2("editorLayoutThreeRows", "Three Rows Editor Layout"),
      f1: true,
      category: Categories.View
    }, LAYOUT_EDITOR_GROUPS_COMMAND_ID, { groups: [{}, {}, {}], orientation: GroupOrientation.VERTICAL });
  }
};
_EditorLayoutThreeRowsAction.ID = "workbench.action.editorLayoutThreeRows";
let EditorLayoutThreeRowsAction = _EditorLayoutThreeRowsAction;
const _EditorLayoutTwoByTwoGridAction = class _EditorLayoutTwoByTwoGridAction extends ExecuteCommandAction {
  constructor() {
    super({
      id: _EditorLayoutTwoByTwoGridAction.ID,
      title: localize2("editorLayoutTwoByTwoGrid", "Grid Editor Layout (2x2)"),
      f1: true,
      category: Categories.View
    }, LAYOUT_EDITOR_GROUPS_COMMAND_ID, { groups: [{ groups: [{}, {}] }, { groups: [{}, {}] }], orientation: GroupOrientation.HORIZONTAL });
  }
};
_EditorLayoutTwoByTwoGridAction.ID = "workbench.action.editorLayoutTwoByTwoGrid";
let EditorLayoutTwoByTwoGridAction = _EditorLayoutTwoByTwoGridAction;
const _EditorLayoutTwoColumnsBottomAction = class _EditorLayoutTwoColumnsBottomAction extends ExecuteCommandAction {
  constructor() {
    super({
      id: _EditorLayoutTwoColumnsBottomAction.ID,
      title: localize2("editorLayoutTwoColumnsBottom", "Two Columns Bottom Editor Layout"),
      f1: true,
      category: Categories.View
    }, LAYOUT_EDITOR_GROUPS_COMMAND_ID, { groups: [{}, { groups: [{}, {}] }], orientation: GroupOrientation.VERTICAL });
  }
};
_EditorLayoutTwoColumnsBottomAction.ID = "workbench.action.editorLayoutTwoColumnsBottom";
let EditorLayoutTwoColumnsBottomAction = _EditorLayoutTwoColumnsBottomAction;
const _EditorLayoutTwoRowsRightAction = class _EditorLayoutTwoRowsRightAction extends ExecuteCommandAction {
  constructor() {
    super({
      id: _EditorLayoutTwoRowsRightAction.ID,
      title: localize2("editorLayoutTwoRowsRight", "Two Rows Right Editor Layout"),
      f1: true,
      category: Categories.View
    }, LAYOUT_EDITOR_GROUPS_COMMAND_ID, { groups: [{}, { groups: [{}, {}] }], orientation: GroupOrientation.HORIZONTAL });
  }
};
_EditorLayoutTwoRowsRightAction.ID = "workbench.action.editorLayoutTwoRowsRight";
let EditorLayoutTwoRowsRightAction = _EditorLayoutTwoRowsRightAction;
class AbstractCreateEditorGroupAction extends Action2 {
  constructor(desc, direction) {
    super(desc);
    this.direction = direction;
  }
  async run(accessor) {
    const editorGroupService = accessor.get(IEditorGroupsService);
    const layoutService = accessor.get(IWorkbenchLayoutService);
    const activeDocument = getActiveDocument();
    const focusNewGroup = layoutService.hasFocus(Parts.EDITOR_PART) || activeDocument.activeElement === activeDocument.body;
    const group = editorGroupService.addGroup(editorGroupService.activeGroup, this.direction);
    editorGroupService.activateGroup(group);
    if (focusNewGroup) {
      group.focus();
    }
  }
}
class NewEditorGroupLeftAction extends AbstractCreateEditorGroupAction {
  constructor() {
    super({
      id: "workbench.action.newGroupLeft",
      title: localize2("newGroupLeft", "New Editor Group to the Left"),
      f1: true,
      category: Categories.View
    }, GroupDirection.LEFT);
  }
}
class NewEditorGroupRightAction extends AbstractCreateEditorGroupAction {
  constructor() {
    super({
      id: "workbench.action.newGroupRight",
      title: localize2("newGroupRight", "New Editor Group to the Right"),
      f1: true,
      category: Categories.View
    }, GroupDirection.RIGHT);
  }
}
class NewEditorGroupAboveAction extends AbstractCreateEditorGroupAction {
  constructor() {
    super({
      id: "workbench.action.newGroupAbove",
      title: localize2("newGroupAbove", "New Editor Group Above"),
      f1: true,
      category: Categories.View
    }, GroupDirection.UP);
  }
}
class NewEditorGroupBelowAction extends AbstractCreateEditorGroupAction {
  constructor() {
    super({
      id: "workbench.action.newGroupBelow",
      title: localize2("newGroupBelow", "New Editor Group Below"),
      f1: true,
      category: Categories.View
    }, GroupDirection.DOWN);
  }
}
class ToggleEditorTypeAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.toggleEditorType",
      title: localize2("toggleEditorType", "Toggle Editor Type"),
      f1: true,
      category: Categories.View,
      precondition: ActiveEditorAvailableEditorIdsContext
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const editorResolverService = accessor.get(IEditorResolverService);
    const activeEditorPane = editorService.activeEditorPane;
    if (!activeEditorPane) {
      return;
    }
    const activeEditorResource = EditorResourceAccessor.getCanonicalUri(activeEditorPane.input);
    if (!activeEditorResource) {
      return;
    }
    const editorIds = editorResolverService.getEditors(activeEditorResource).map((editor) => editor.id).filter((id) => id !== activeEditorPane.input.editorId);
    if (editorIds.length === 0) {
      return;
    }
    await editorService.replaceEditors([
      {
        editor: activeEditorPane.input,
        replacement: {
          resource: activeEditorResource,
          options: {
            override: editorIds[0]
          }
        }
      }
    ], activeEditorPane.group);
  }
}
class ReOpenInTextEditorAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.reopenTextEditor",
      title: localize2("reopenTextEditor", "Reopen Editor with Text Editor"),
      f1: true,
      category: Categories.View,
      precondition: ActiveEditorAvailableEditorIdsContext
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const activeEditorPane = editorService.activeEditorPane;
    if (!activeEditorPane) {
      return;
    }
    const activeEditorResource = EditorResourceAccessor.getCanonicalUri(activeEditorPane.input);
    if (!activeEditorResource) {
      return;
    }
    await editorService.replaceEditors([
      {
        editor: activeEditorPane.input,
        replacement: {
          resource: activeEditorResource,
          options: {
            override: DEFAULT_EDITOR_ASSOCIATION.id
          }
        }
      }
    ], activeEditorPane.group);
  }
}
class BaseMoveCopyEditorToNewWindowAction extends Action2 {
  constructor(id, title, keybinding, move) {
    super({
      id,
      title,
      category: Categories.View,
      precondition: ActiveEditorContext,
      keybinding,
      f1: true
    });
    this.move = move;
  }
  async run(accessor, ...args) {
    const editorGroupsService = accessor.get(IEditorGroupsService);
    const editorService = accessor.get(IEditorService);
    const listService = accessor.get(IListService);
    const resolvedContext = resolveCommandsContext(args, editorService, editorGroupsService, listService);
    if (!resolvedContext.groupedEditors.length) {
      return;
    }
    const auxiliaryEditorPart = await editorGroupsService.createAuxiliaryEditorPart();
    const { group, editors } = resolvedContext.groupedEditors[0];
    const editorsWithOptions = prepareMoveCopyEditors(group, editors, resolvedContext.preserveFocus);
    if (this.move) {
      group.moveEditors(editorsWithOptions, auxiliaryEditorPart.activeGroup);
    } else {
      group.copyEditors(editorsWithOptions, auxiliaryEditorPart.activeGroup);
    }
    auxiliaryEditorPart.activeGroup.focus();
  }
}
class MoveEditorToNewWindowAction extends BaseMoveCopyEditorToNewWindowAction {
  constructor() {
    super(
      MOVE_EDITOR_INTO_NEW_WINDOW_COMMAND_ID,
      {
        ...localize2("moveEditorToNewWindow", "Move Editor into New Window"),
        mnemonicTitle: localize({ key: "miMoveEditorToNewWindow", comment: ["&& denotes a mnemonic"] }, "&&Move Editor into New Window")
      },
      void 0,
      true
    );
  }
}
class CopyEditorToNewindowAction extends BaseMoveCopyEditorToNewWindowAction {
  constructor() {
    super(
      COPY_EDITOR_INTO_NEW_WINDOW_COMMAND_ID,
      {
        ...localize2("copyEditorToNewWindow", "Copy Editor into New Window"),
        mnemonicTitle: localize({ key: "miCopyEditorToNewWindow", comment: ["&& denotes a mnemonic"] }, "&&Copy Editor into New Window")
      },
      { primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.KeyO), weight: KeybindingWeight.WorkbenchContrib },
      false
    );
  }
}
class BaseMoveCopyEditorGroupToNewWindowAction extends Action2 {
  constructor(id, title, move) {
    super({
      id,
      title,
      category: Categories.View,
      f1: true
    });
    this.move = move;
  }
  async run(accessor) {
    const editorGroupService = accessor.get(IEditorGroupsService);
    const activeGroup = editorGroupService.activeGroup;
    const auxiliaryEditorPart = await editorGroupService.createAuxiliaryEditorPart();
    editorGroupService.mergeGroup(activeGroup, auxiliaryEditorPart.activeGroup, {
      mode: this.move ? MergeGroupMode.MOVE_EDITORS : MergeGroupMode.COPY_EDITORS
    });
    auxiliaryEditorPart.activeGroup.focus();
  }
}
class MoveEditorGroupToNewWindowAction extends BaseMoveCopyEditorGroupToNewWindowAction {
  constructor() {
    super(
      MOVE_EDITOR_GROUP_INTO_NEW_WINDOW_COMMAND_ID,
      {
        ...localize2("moveEditorGroupToNewWindow", "Move Editor Group into New Window"),
        mnemonicTitle: localize({ key: "miMoveEditorGroupToNewWindow", comment: ["&& denotes a mnemonic"] }, "&&Move Editor Group into New Window")
      },
      true
    );
  }
}
class CopyEditorGroupToNewWindowAction extends BaseMoveCopyEditorGroupToNewWindowAction {
  constructor() {
    super(
      COPY_EDITOR_GROUP_INTO_NEW_WINDOW_COMMAND_ID,
      {
        ...localize2("copyEditorGroupToNewWindow", "Copy Editor Group into New Window"),
        mnemonicTitle: localize({ key: "miCopyEditorGroupToNewWindow", comment: ["&& denotes a mnemonic"] }, "&&Copy Editor Group into New Window")
      },
      false
    );
  }
}
class RestoreEditorsToMainWindowAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.restoreEditorsToMainWindow",
      title: {
        ...localize2("restoreEditorsToMainWindow", "Restore Editors into Main Window"),
        mnemonicTitle: localize({ key: "miRestoreEditorsToMainWindow", comment: ["&& denotes a mnemonic"] }, "&&Restore Editors into Main Window")
      },
      f1: true,
      precondition: IsAuxiliaryWindowFocusedContext,
      category: Categories.View
    });
  }
  async run(accessor) {
    const editorGroupService = accessor.get(IEditorGroupsService);
    editorGroupService.mergeAllGroups(editorGroupService.mainPart.activeGroup);
  }
}
class NewEmptyEditorWindowAction extends Action2 {
  constructor() {
    super({
      id: NEW_EMPTY_EDITOR_WINDOW_COMMAND_ID,
      title: {
        ...localize2("newEmptyEditorWindow", "New Empty Editor Window"),
        mnemonicTitle: localize({ key: "miNewEmptyEditorWindow", comment: ["&& denotes a mnemonic"] }, "&&New Empty Editor Window")
      },
      f1: true,
      category: Categories.View
    });
  }
  async run(accessor) {
    const editorGroupService = accessor.get(IEditorGroupsService);
    const auxiliaryEditorPart = await editorGroupService.createAuxiliaryEditorPart();
    auxiliaryEditorPart.activeGroup.focus();
  }
}
export {
  ClearEditorHistoryAction,
  ClearRecentFilesAction,
  CloseAllEditorGroupsAction,
  CloseAllEditorsAction,
  CloseEditorAction,
  CloseEditorInAllGroupsAction,
  CloseEditorTabAction,
  CloseEditorsInOtherGroupsAction,
  CloseLeftEditorsInGroupAction,
  CopyEditorGroupToNewWindowAction,
  CopyEditorToNewindowAction,
  DuplicateGroupDownAction,
  DuplicateGroupLeftAction,
  DuplicateGroupRightAction,
  DuplicateGroupUpAction,
  EditorLayoutSingleAction,
  EditorLayoutThreeColumnsAction,
  EditorLayoutThreeRowsAction,
  EditorLayoutTwoByTwoGridAction,
  EditorLayoutTwoColumnsAction,
  EditorLayoutTwoColumnsBottomAction,
  EditorLayoutTwoRowsAction,
  EditorLayoutTwoRowsRightAction,
  FocusAboveGroup,
  FocusActiveGroupAction,
  FocusBelowGroup,
  FocusFirstGroupAction,
  FocusLastGroupAction,
  FocusLeftGroup,
  FocusNextGroup,
  FocusPreviousGroup,
  FocusRightGroup,
  JoinAllGroupsAction,
  JoinTwoGroupsAction,
  MaximizeGroupHideSidebarAction,
  MinimizeOtherGroupsAction,
  MinimizeOtherGroupsHideSidebarAction,
  MoveEditorGroupToNewWindowAction,
  MoveEditorLeftInGroupAction,
  MoveEditorRightInGroupAction,
  MoveEditorToAboveGroupAction,
  MoveEditorToBelowGroupAction,
  MoveEditorToFirstGroupAction,
  MoveEditorToLastGroupAction,
  MoveEditorToLeftGroupAction,
  MoveEditorToNewWindowAction,
  MoveEditorToNextGroupAction,
  MoveEditorToPreviousGroupAction,
  MoveEditorToRightGroupAction,
  MoveGroupDownAction,
  MoveGroupLeftAction,
  MoveGroupRightAction,
  MoveGroupUpAction,
  NavigateBackwardsAction,
  NavigateBackwardsInEditsAction,
  NavigateBackwardsInNavigationsAction,
  NavigateBetweenGroupsAction,
  NavigateForwardAction,
  NavigateForwardInEditsAction,
  NavigateForwardInNavigationsAction,
  NavigatePreviousAction,
  NavigatePreviousInEditsAction,
  NavigatePreviousInNavigationsAction,
  NavigateToLastEditLocationAction,
  NavigateToLastNavigationLocationAction,
  NewEditorGroupAboveAction,
  NewEditorGroupBelowAction,
  NewEditorGroupLeftAction,
  NewEditorGroupRightAction,
  NewEmptyEditorWindowAction,
  OpenFirstEditorInGroup,
  OpenLastEditorInGroup,
  OpenNextEditor,
  OpenNextEditorInGroup,
  OpenNextRecentlyUsedEditorAction,
  OpenNextRecentlyUsedEditorInGroupAction,
  OpenPreviousEditor,
  OpenPreviousEditorInGroup,
  OpenPreviousRecentlyUsedEditorAction,
  OpenPreviousRecentlyUsedEditorInGroupAction,
  QuickAccessLeastRecentlyUsedEditorAction,
  QuickAccessLeastRecentlyUsedEditorInGroupAction,
  QuickAccessPreviousEditorFromHistoryAction,
  QuickAccessPreviousRecentlyUsedEditorAction,
  QuickAccessPreviousRecentlyUsedEditorInGroupAction,
  ReOpenInTextEditorAction,
  ReopenClosedEditorAction,
  ResetGroupSizesAction,
  RestoreEditorsToMainWindowAction,
  RevertAndCloseEditorAction,
  ShowAllEditorsByAppearanceAction,
  ShowAllEditorsByMostRecentlyUsedAction,
  ShowEditorsInActiveGroupByMostRecentlyUsedAction,
  SplitEditorAction,
  SplitEditorDownAction,
  SplitEditorLeftAction,
  SplitEditorOrthogonalAction,
  SplitEditorRightAction,
  SplitEditorToAboveGroupAction,
  SplitEditorToBelowGroupAction,
  SplitEditorToFirstGroupAction,
  SplitEditorToLastGroupAction,
  SplitEditorToLeftGroupAction,
  SplitEditorToNextGroupAction,
  SplitEditorToPreviousGroupAction,
  SplitEditorToRightGroupAction,
  SplitEditorUpAction,
  ToggleEditorTypeAction,
  ToggleGroupSizesAction,
  ToggleMaximizeEditorGroupAction,
  UnpinEditorAction
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9lZGl0b3IvZWRpdG9yQWN0aW9ucy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9ySWRlbnRpZmllciwgSUVkaXRvckNvbW1hbmRzQ29udGV4dCwgQ2xvc2VEaXJlY3Rpb24sIFNhdmVSZWFzb24sIEVkaXRvcnNPcmRlciwgRWRpdG9ySW5wdXRDYXBhYmlsaXRpZXMsIERFRkFVTFRfRURJVE9SX0FTU09DSUFUSU9OLCBHcm91cElkZW50aWZpZXIsIEVkaXRvclJlc291cmNlQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IEVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci9lZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBTaWRlQnlTaWRlRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yL3NpZGVCeVNpZGVFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoTGF5b3V0U2VydmljZSwgUGFydHMgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9sYXlvdXQvYnJvd3Nlci9sYXlvdXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEdvRmlsdGVyLCBJSGlzdG9yeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9oaXN0b3J5L2NvbW1vbi9oaXN0b3J5LmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IENMT1NFX0VESVRPUl9DT01NQU5EX0lELCBNT1ZFX0FDVElWRV9FRElUT1JfQ09NTUFORF9JRCwgU2VsZWN0ZWRFZGl0b3JzTW92ZUNvcHlBcmd1bWVudHMsIFNQTElUX0VESVRPUl9MRUZULCBTUExJVF9FRElUT1JfUklHSFQsIFNQTElUX0VESVRPUl9VUCwgU1BMSVRfRURJVE9SX0RPV04sIHNwbGl0RWRpdG9yLCBMQVlPVVRfRURJVE9SX0dST1VQU19DT01NQU5EX0lELCBVTlBJTl9FRElUT1JfQ09NTUFORF9JRCwgQ09QWV9BQ1RJVkVfRURJVE9SX0NPTU1BTkRfSUQsIFNQTElUX0VESVRPUiwgVE9HR0xFX01BWElNSVpFX0VESVRPUl9HUk9VUCwgTU9WRV9FRElUT1JfSU5UT19ORVdfV0lORE9XX0NPTU1BTkRfSUQsIENPUFlfRURJVE9SX0lOVE9fTkVXX1dJTkRPV19DT01NQU5EX0lELCBNT1ZFX0VESVRPUl9HUk9VUF9JTlRPX05FV19XSU5ET1dfQ09NTUFORF9JRCwgQ09QWV9FRElUT1JfR1JPVVBfSU5UT19ORVdfV0lORE9XX0NPTU1BTkRfSUQsIE5FV19FTVBUWV9FRElUT1JfV0lORE9XX0NPTU1BTkRfSUQgYXMgTkVXX0VNUFRZX0VESVRPUl9XSU5ET1dfQ09NTUFORF9JRCB9IGZyb20gJy4vZWRpdG9yQ29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUVkaXRvckdyb3Vwc1NlcnZpY2UsIElFZGl0b3JHcm91cCwgR3JvdXBzQXJyYW5nZW1lbnQsIEdyb3VwTG9jYXRpb24sIEdyb3VwRGlyZWN0aW9uLCBwcmVmZXJyZWRTaWRlQnlTaWRlR3JvdXBEaXJlY3Rpb24sIElGaW5kR3JvdXBTY29wZSwgR3JvdXBPcmllbnRhdGlvbiwgRWRpdG9yR3JvdXBMYXlvdXQsIEdyb3Vwc09yZGVyLCBNZXJnZUdyb3VwTW9kZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZXMvY29tbW9uL3dvcmtzcGFjZXMuanMnO1xuaW1wb3J0IHsgSUZpbGVEaWFsb2dTZXJ2aWNlLCBDb25maXJtUmVzdWx0LCBJRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgSXRlbUFjdGl2YXRpb24sIElRdWlja0lucHV0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrSW5wdXQuanMnO1xuaW1wb3J0IHsgQWxsRWRpdG9yc0J5TW9zdFJlY2VudGx5VXNlZFF1aWNrQWNjZXNzLCBBY3RpdmVHcm91cEVkaXRvcnNCeU1vc3RSZWNlbnRseVVzZWRRdWlja0FjY2VzcywgQWxsRWRpdG9yc0J5QXBwZWFyYW5jZVF1aWNrQWNjZXNzIH0gZnJvbSAnLi9lZGl0b3JRdWlja0FjY2Vzcy5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IElGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLCBBdXRvU2F2ZU1vZGUgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9maWxlc0NvbmZpZ3VyYXRpb24vY29tbW9uL2ZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvclJlc29sdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yUmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGlzTGludXgsIGlzTmF0aXZlLCBpc1dpbmRvd3MgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCBJQWN0aW9uMk9wdGlvbnMsIE1lbnVJZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IEtleUNob3JkLCBLZXlDb2RlLCBLZXlNb2QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1J1bGUsIEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgQ2F0ZWdvcmllcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbi9jb21tb24vYWN0aW9uQ29tbW9uQ2F0ZWdvcmllcy5qcyc7XG5pbXBvcnQgeyBBY3RpdmVFZGl0b3JBdmFpbGFibGVFZGl0b3JJZHNDb250ZXh0LCBBY3RpdmVFZGl0b3JDb250ZXh0LCBBY3RpdmVFZGl0b3JHcm91cEVtcHR5Q29udGV4dCwgQXV4aWxpYXJ5QmFyVmlzaWJsZUNvbnRleHQsIEVkaXRvclBhcnRNYXhpbWl6ZWRFZGl0b3JHcm91cENvbnRleHQsIEVkaXRvclBhcnRNdWx0aXBsZUVkaXRvckdyb3Vwc0NvbnRleHQsIElzQXV4aWxpYXJ5V2luZG93Rm9jdXNlZENvbnRleHQsIE11bHRpcGxlRWRpdG9yR3JvdXBzQ29udGV4dCwgU2lkZUJhclZpc2libGVDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRleHRrZXlzLmpzJztcbmltcG9ydCB7IGdldEFjdGl2ZURvY3VtZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZEFjdGlvblRpdGxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9uL2NvbW1vbi9hY3Rpb24uanMnO1xuaW1wb3J0IHsgSVByb2dyZXNzU2VydmljZSwgUHJvZ3Jlc3NMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyByZXNvbHZlQ29tbWFuZHNDb250ZXh0IH0gZnJvbSAnLi9lZGl0b3JDb21tYW5kc0NvbnRleHQuanMnO1xuaW1wb3J0IHsgSUxpc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGlzdC9icm93c2VyL2xpc3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IHByZXBhcmVNb3ZlQ29weUVkaXRvcnMgfSBmcm9tICcuL2VkaXRvci5qcyc7XG5cbmNsYXNzIEV4ZWN1dGVDb21tYW5kQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0ZGVzYzogUmVhZG9ubHk8SUFjdGlvbjJPcHRpb25zPixcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNvbW1hbmRJZDogc3RyaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY29tbWFuZEFyZ3M/OiB1bmtub3duXG5cdCkge1xuXHRcdHN1cGVyKGRlc2MpO1xuXHR9XG5cblx0b3ZlcnJpZGUgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY29tbWFuZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbW1hbmRTZXJ2aWNlKTtcblxuXHRcdHJldHVybiBjb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZCh0aGlzLmNvbW1hbmRJZCwgdGhpcy5jb21tYW5kQXJncyk7XG5cdH1cbn1cblxuYWJzdHJhY3QgY2xhc3MgQWJzdHJhY3RTcGxpdEVkaXRvckFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdHByb3RlY3RlZCBnZXREaXJlY3Rpb24oY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSk6IEdyb3VwRGlyZWN0aW9uIHtcblx0XHRyZXR1cm4gcHJlZmVycmVkU2lkZUJ5U2lkZUdyb3VwRGlyZWN0aW9uKGNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogdW5rbm93bltdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZWRpdG9yR3JvdXBzU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSk7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRjb25zdCBsaXN0U2VydmljZSA9IGFjY2Vzc29yLmdldChJTGlzdFNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgZGlyZWN0aW9uID0gdGhpcy5nZXREaXJlY3Rpb24oY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdGNvbnN0IGNvbW1hbmRDb250ZXh0ID0gcmVzb2x2ZUNvbW1hbmRzQ29udGV4dChhcmdzLCBlZGl0b3JTZXJ2aWNlLCBlZGl0b3JHcm91cHNTZXJ2aWNlLCBsaXN0U2VydmljZSk7XG5cblx0XHRzcGxpdEVkaXRvcihlZGl0b3JHcm91cHNTZXJ2aWNlLCBkaXJlY3Rpb24sIGNvbW1hbmRDb250ZXh0KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU3BsaXRFZGl0b3JBY3Rpb24gZXh0ZW5kcyBBYnN0cmFjdFNwbGl0RWRpdG9yQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSBTUExJVF9FRElUT1I7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFNwbGl0RWRpdG9yQWN0aW9uLklELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignc3BsaXRFZGl0b3InLCAnU3BsaXQgRWRpdG9yJyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5CYWNrc2xhc2hcblx0XHRcdH0sXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3XG5cdFx0fSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFNwbGl0RWRpdG9yT3J0aG9nb25hbEFjdGlvbiBleHRlbmRzIEFic3RyYWN0U3BsaXRFZGl0b3JBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5zcGxpdEVkaXRvck9ydGhvZ29uYWwnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignc3BsaXRFZGl0b3JPcnRob2dvbmFsJywgJ1NwbGl0IEVkaXRvciBPcnRob2dvbmFsJyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuQmFja3NsYXNoKVxuXHRcdFx0fSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXdcblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBnZXREaXJlY3Rpb24oY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSk6IEdyb3VwRGlyZWN0aW9uIHtcblx0XHRjb25zdCBkaXJlY3Rpb24gPSBwcmVmZXJyZWRTaWRlQnlTaWRlR3JvdXBEaXJlY3Rpb24oY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXG5cdFx0cmV0dXJuIGRpcmVjdGlvbiA9PT0gR3JvdXBEaXJlY3Rpb24uUklHSFQgPyBHcm91cERpcmVjdGlvbi5ET1dOIDogR3JvdXBEaXJlY3Rpb24uUklHSFQ7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFNwbGl0RWRpdG9yTGVmdEFjdGlvbiBleHRlbmRzIEV4ZWN1dGVDb21tYW5kQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogU1BMSVRfRURJVE9SX0xFRlQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdzcGxpdEVkaXRvckdyb3VwTGVmdCcsICdTcGxpdCBFZGl0b3IgTGVmdCcpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkJhY2tzbGFzaClcblx0XHRcdH0sXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3XG5cdFx0fSwgU1BMSVRfRURJVE9SX0xFRlQpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTcGxpdEVkaXRvclJpZ2h0QWN0aW9uIGV4dGVuZHMgRXhlY3V0ZUNvbW1hbmRBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBTUExJVF9FRElUT1JfUklHSFQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdzcGxpdEVkaXRvckdyb3VwUmlnaHQnLCAnU3BsaXQgRWRpdG9yIFJpZ2h0JyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuQmFja3NsYXNoKVxuXHRcdFx0fSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXdcblx0XHR9LCBTUExJVF9FRElUT1JfUklHSFQpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTcGxpdEVkaXRvclVwQWN0aW9uIGV4dGVuZHMgRXhlY3V0ZUNvbW1hbmRBY3Rpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBMQUJFTCA9IGxvY2FsaXplKCdzcGxpdEVkaXRvckdyb3VwVXAnLCBcIlNwbGl0IEVkaXRvciBVcFwiKTtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogU1BMSVRfRURJVE9SX1VQLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignc3BsaXRFZGl0b3JHcm91cFVwJywgXCJTcGxpdCBFZGl0b3IgVXBcIiksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuQmFja3NsYXNoKVxuXHRcdFx0fSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXdcblx0XHR9LCBTUExJVF9FRElUT1JfVVApO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTcGxpdEVkaXRvckRvd25BY3Rpb24gZXh0ZW5kcyBFeGVjdXRlQ29tbWFuZEFjdGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IExBQkVMID0gbG9jYWxpemUoJ3NwbGl0RWRpdG9yR3JvdXBEb3duJywgXCJTcGxpdCBFZGl0b3IgRG93blwiKTtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogU1BMSVRfRURJVE9SX0RPV04sXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdzcGxpdEVkaXRvckdyb3VwRG93bicsIFwiU3BsaXQgRWRpdG9yIERvd25cIiksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuQmFja3NsYXNoKVxuXHRcdFx0fSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXdcblx0XHR9LCBTUExJVF9FRElUT1JfRE9XTik7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEpvaW5Ud29Hcm91cHNBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uam9pblR3b0dyb3VwcycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdqb2luVHdvR3JvdXBzJywgJ0pvaW4gRWRpdG9yIEdyb3VwIHdpdGggTmV4dCBHcm91cCcpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3XG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGNvbnRleHQ/OiBJRWRpdG9ySWRlbnRpZmllcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGVkaXRvckdyb3VwU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSk7XG5cblx0XHRsZXQgc291cmNlR3JvdXA6IElFZGl0b3JHcm91cCB8IHVuZGVmaW5lZDtcblx0XHRpZiAoY29udGV4dCAmJiB0eXBlb2YgY29udGV4dC5ncm91cElkID09PSAnbnVtYmVyJykge1xuXHRcdFx0c291cmNlR3JvdXAgPSBlZGl0b3JHcm91cFNlcnZpY2UuZ2V0R3JvdXAoY29udGV4dC5ncm91cElkKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0c291cmNlR3JvdXAgPSBlZGl0b3JHcm91cFNlcnZpY2UuYWN0aXZlR3JvdXA7XG5cdFx0fVxuXG5cdFx0aWYgKHNvdXJjZUdyb3VwKSB7XG5cdFx0XHRjb25zdCB0YXJnZXRHcm91cERpcmVjdGlvbnMgPSBbR3JvdXBEaXJlY3Rpb24uUklHSFQsIEdyb3VwRGlyZWN0aW9uLkRPV04sIEdyb3VwRGlyZWN0aW9uLkxFRlQsIEdyb3VwRGlyZWN0aW9uLlVQXTtcblx0XHRcdGZvciAoY29uc3QgdGFyZ2V0R3JvdXBEaXJlY3Rpb24gb2YgdGFyZ2V0R3JvdXBEaXJlY3Rpb25zKSB7XG5cdFx0XHRcdGNvbnN0IHRhcmdldEdyb3VwID0gZWRpdG9yR3JvdXBTZXJ2aWNlLmZpbmRHcm91cCh7IGRpcmVjdGlvbjogdGFyZ2V0R3JvdXBEaXJlY3Rpb24gfSwgc291cmNlR3JvdXApO1xuXHRcdFx0XHRpZiAodGFyZ2V0R3JvdXAgJiYgc291cmNlR3JvdXAgIT09IHRhcmdldEdyb3VwKSB7XG5cdFx0XHRcdFx0ZWRpdG9yR3JvdXBTZXJ2aWNlLm1lcmdlR3JvdXAoc291cmNlR3JvdXAsIHRhcmdldEdyb3VwKTtcblxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBKb2luQWxsR3JvdXBzQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmpvaW5BbGxHcm91cHMnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignam9pbkFsbEdyb3VwcycsICdKb2luIEFsbCBFZGl0b3IgR3JvdXBzJyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXdcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGVkaXRvckdyb3VwU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSk7XG5cblx0XHRlZGl0b3JHcm91cFNlcnZpY2UubWVyZ2VBbGxHcm91cHMoZWRpdG9yR3JvdXBTZXJ2aWNlLmFjdGl2ZUdyb3VwKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTmF2aWdhdGVCZXR3ZWVuR3JvdXBzQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLm5hdmlnYXRlRWRpdG9yR3JvdXBzJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ25hdmlnYXRlRWRpdG9yR3JvdXBzJywgJ05hdmlnYXRlIEJldHdlZW4gRWRpdG9yIEdyb3VwcycpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3XG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBlZGl0b3JHcm91cFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvckdyb3Vwc1NlcnZpY2UpO1xuXG5cdFx0Y29uc3QgbmV4dEdyb3VwID0gZWRpdG9yR3JvdXBTZXJ2aWNlLmZpbmRHcm91cCh7IGxvY2F0aW9uOiBHcm91cExvY2F0aW9uLk5FWFQgfSwgZWRpdG9yR3JvdXBTZXJ2aWNlLmFjdGl2ZUdyb3VwLCB0cnVlKTtcblx0XHRuZXh0R3JvdXA/LmZvY3VzKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEZvY3VzQWN0aXZlR3JvdXBBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uZm9jdXNBY3RpdmVFZGl0b3JHcm91cCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdmb2N1c0FjdGl2ZUVkaXRvckdyb3VwJywgJ0ZvY3VzIEFjdGl2ZSBFZGl0b3IgR3JvdXAnKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlld1xuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZWRpdG9yR3JvdXBTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JHcm91cHNTZXJ2aWNlKTtcblxuXHRcdGVkaXRvckdyb3VwU2VydmljZS5hY3RpdmVHcm91cC5mb2N1cygpO1xuXHR9XG59XG5cbmFic3RyYWN0IGNsYXNzIEFic3RyYWN0Rm9jdXNHcm91cEFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGRlc2M6IFJlYWRvbmx5PElBY3Rpb24yT3B0aW9ucz4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBzY29wZTogSUZpbmRHcm91cFNjb3BlXG5cdCkge1xuXHRcdHN1cGVyKGRlc2MpO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZWRpdG9yR3JvdXBTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JHcm91cHNTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGdyb3VwID0gZWRpdG9yR3JvdXBTZXJ2aWNlLmZpbmRHcm91cCh0aGlzLnNjb3BlLCBlZGl0b3JHcm91cFNlcnZpY2UuYWN0aXZlR3JvdXAsIHRydWUpO1xuXHRcdGdyb3VwPy5mb2N1cygpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBGb2N1c0ZpcnN0R3JvdXBBY3Rpb24gZXh0ZW5kcyBBYnN0cmFjdEZvY3VzR3JvdXBBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5mb2N1c0ZpcnN0RWRpdG9yR3JvdXAnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignZm9jdXNGaXJzdEVkaXRvckdyb3VwJywgJ0ZvY3VzIEZpcnN0IEVkaXRvciBHcm91cCcpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRGlnaXQxXG5cdFx0XHR9LFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlld1xuXHRcdH0sIHsgbG9jYXRpb246IEdyb3VwTG9jYXRpb24uRklSU1QgfSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEZvY3VzTGFzdEdyb3VwQWN0aW9uIGV4dGVuZHMgQWJzdHJhY3RGb2N1c0dyb3VwQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uZm9jdXNMYXN0RWRpdG9yR3JvdXAnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignZm9jdXNMYXN0RWRpdG9yR3JvdXAnLCAnRm9jdXMgTGFzdCBFZGl0b3IgR3JvdXAnKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlld1xuXHRcdH0sIHsgbG9jYXRpb246IEdyb3VwTG9jYXRpb24uTEFTVCB9KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRm9jdXNOZXh0R3JvdXAgZXh0ZW5kcyBBYnN0cmFjdEZvY3VzR3JvdXBBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5mb2N1c05leHRHcm91cCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdmb2N1c05leHRHcm91cCcsICdGb2N1cyBOZXh0IEVkaXRvciBHcm91cCcpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3XG5cdFx0fSwgeyBsb2NhdGlvbjogR3JvdXBMb2NhdGlvbi5ORVhUIH0pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBGb2N1c1ByZXZpb3VzR3JvdXAgZXh0ZW5kcyBBYnN0cmFjdEZvY3VzR3JvdXBBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5mb2N1c1ByZXZpb3VzR3JvdXAnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignZm9jdXNQcmV2aW91c0dyb3VwJywgJ0ZvY3VzIFByZXZpb3VzIEVkaXRvciBHcm91cCcpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3XG5cdFx0fSwgeyBsb2NhdGlvbjogR3JvdXBMb2NhdGlvbi5QUkVWSU9VUyB9KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRm9jdXNMZWZ0R3JvdXAgZXh0ZW5kcyBBYnN0cmFjdEZvY3VzR3JvdXBBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5mb2N1c0xlZnRHcm91cCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdmb2N1c0xlZnRHcm91cCcsICdGb2N1cyBMZWZ0IEVkaXRvciBHcm91cCcpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkxlZnRBcnJvdylcblx0XHRcdH0sXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3XG5cdFx0fSwgeyBkaXJlY3Rpb246IEdyb3VwRGlyZWN0aW9uLkxFRlQgfSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEZvY3VzUmlnaHRHcm91cCBleHRlbmRzIEFic3RyYWN0Rm9jdXNHcm91cEFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmZvY3VzUmlnaHRHcm91cCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdmb2N1c1JpZ2h0R3JvdXAnLCAnRm9jdXMgUmlnaHQgRWRpdG9yIEdyb3VwJyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuUmlnaHRBcnJvdylcblx0XHRcdH0sXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3XG5cdFx0fSwgeyBkaXJlY3Rpb246IEdyb3VwRGlyZWN0aW9uLlJJR0hUIH0pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBGb2N1c0Fib3ZlR3JvdXAgZXh0ZW5kcyBBYnN0cmFjdEZvY3VzR3JvdXBBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5mb2N1c0Fib3ZlR3JvdXAnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignZm9jdXNBYm92ZUdyb3VwJywgJ0ZvY3VzIEVkaXRvciBHcm91cCBBYm92ZScpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLlVwQXJyb3cpXG5cdFx0XHR9LFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlld1xuXHRcdH0sIHsgZGlyZWN0aW9uOiBHcm91cERpcmVjdGlvbi5VUCB9KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRm9jdXNCZWxvd0dyb3VwIGV4dGVuZHMgQWJzdHJhY3RGb2N1c0dyb3VwQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uZm9jdXNCZWxvd0dyb3VwJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2ZvY3VzQmVsb3dHcm91cCcsICdGb2N1cyBFZGl0b3IgR3JvdXAgQmVsb3cnKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5Eb3duQXJyb3cpXG5cdFx0XHR9LFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlld1xuXHRcdH0sIHsgZGlyZWN0aW9uOiBHcm91cERpcmVjdGlvbi5ET1dOIH0pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDbG9zZUVkaXRvckFjdGlvbiBleHRlbmRzIEFjdGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5hY3Rpb24uY2xvc2VBY3RpdmVFZGl0b3InO1xuXHRzdGF0aWMgcmVhZG9ubHkgTEFCRUwgPSBsb2NhbGl6ZSgnY2xvc2VFZGl0b3InLCBcIkNsb3NlIEVkaXRvclwiKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRpZDogc3RyaW5nLFxuXHRcdGxhYmVsOiBzdHJpbmcsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoaWQsIGxhYmVsLCBUaGVtZUljb24uYXNDbGFzc05hbWUoQ29kaWNvbi5jbG9zZSkpO1xuXHR9XG5cblx0b3ZlcnJpZGUgcnVuKGNvbnRleHQ/OiBJRWRpdG9yQ29tbWFuZHNDb250ZXh0KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoQ0xPU0VfRURJVE9SX0NPTU1BTkRfSUQsIHVuZGVmaW5lZCwgY29udGV4dCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFVucGluRWRpdG9yQWN0aW9uIGV4dGVuZHMgQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi51bnBpbkFjdGl2ZUVkaXRvcic7XG5cdHN0YXRpYyByZWFkb25seSBMQUJFTCA9IGxvY2FsaXplKCd1bnBpbkVkaXRvcicsIFwiVW5waW4gRWRpdG9yXCIpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGlkOiBzdHJpbmcsXG5cdFx0bGFiZWw6IHN0cmluZyxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihpZCwgbGFiZWwsIFRoZW1lSWNvbi5hc0NsYXNzTmFtZShDb2RpY29uLnBpbm5lZCkpO1xuXHR9XG5cblx0b3ZlcnJpZGUgcnVuKGNvbnRleHQ/OiBJRWRpdG9yQ29tbWFuZHNDb250ZXh0KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoVU5QSU5fRURJVE9SX0NPTU1BTkRfSUQsIHVuZGVmaW5lZCwgY29udGV4dCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIENsb3NlRWRpdG9yVGFiQWN0aW9uIGV4dGVuZHMgQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5jbG9zZUFjdGl2ZUVkaXRvcic7XG5cdHN0YXRpYyByZWFkb25seSBMQUJFTCA9IGxvY2FsaXplKCdjbG9zZU9uZUVkaXRvcicsIFwiQ2xvc2VcIik7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0aWQ6IHN0cmluZyxcblx0XHRsYWJlbDogc3RyaW5nLFxuXHRcdEBJRWRpdG9yR3JvdXBzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvckdyb3VwU2VydmljZTogSUVkaXRvckdyb3Vwc1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoaWQsIGxhYmVsLCBUaGVtZUljb24uYXNDbGFzc05hbWUoQ29kaWNvbi5jbG9zZSkpO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGNvbnRleHQ/OiBJRWRpdG9yQ29tbWFuZHNDb250ZXh0KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZ3JvdXAgPSBjb250ZXh0ID8gdGhpcy5lZGl0b3JHcm91cFNlcnZpY2UuZ2V0R3JvdXAoY29udGV4dC5ncm91cElkKSA6IHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLmFjdGl2ZUdyb3VwO1xuXHRcdGlmICghZ3JvdXApIHtcblx0XHRcdC8vIGdyb3VwIG1lbnRpb25lZCBpbiBjb250ZXh0IGRvZXMgbm90IGV4aXN0XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGFyZ2V0RWRpdG9yID0gY29udGV4dD8uZWRpdG9ySW5kZXggIT09IHVuZGVmaW5lZCA/IGdyb3VwLmdldEVkaXRvckJ5SW5kZXgoY29udGV4dC5lZGl0b3JJbmRleCkgOiBncm91cC5hY3RpdmVFZGl0b3I7XG5cdFx0aWYgKCF0YXJnZXRFZGl0b3IpIHtcblx0XHRcdC8vIE5vIGVkaXRvciBvcGVuIG9yIGVkaXRvciBhdCBpbmRleCBkb2VzIG5vdCBleGlzdFxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGVkaXRvcnM6IEVkaXRvcklucHV0W10gPSBbXTtcblx0XHRpZiAoZ3JvdXAuaXNTZWxlY3RlZCh0YXJnZXRFZGl0b3IpKSB7XG5cdFx0XHRlZGl0b3JzLnB1c2goLi4uZ3JvdXAuc2VsZWN0ZWRFZGl0b3JzKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZWRpdG9ycy5wdXNoKHRhcmdldEVkaXRvcik7XG5cdFx0fVxuXG5cdFx0Ly8gQ2xvc2Ugc3BlY2lmaWMgZWRpdG9ycyBpbiBncm91cFxuXHRcdGZvciAoY29uc3QgZWRpdG9yIG9mIGVkaXRvcnMpIHtcblx0XHRcdGF3YWl0IGdyb3VwLmNsb3NlRWRpdG9yKGVkaXRvciwgeyBwcmVzZXJ2ZUZvY3VzOiBjb250ZXh0Py5wcmVzZXJ2ZUZvY3VzIH0pO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUmV2ZXJ0QW5kQ2xvc2VFZGl0b3JBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ucmV2ZXJ0QW5kQ2xvc2VBY3RpdmVFZGl0b3InLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMigncmV2ZXJ0QW5kQ2xvc2VBY3RpdmVFZGl0b3InLCAnUmV2ZXJ0IGFuZCBDbG9zZSBFZGl0b3InKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlld1xuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0Y29uc3QgbG9nU2VydmljZSA9IGFjY2Vzc29yLmdldChJTG9nU2VydmljZSk7XG5cblx0XHRjb25zdCBhY3RpdmVFZGl0b3JQYW5lID0gZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3JQYW5lO1xuXHRcdGlmIChhY3RpdmVFZGl0b3JQYW5lKSB7XG5cdFx0XHRjb25zdCBlZGl0b3IgPSBhY3RpdmVFZGl0b3JQYW5lLmlucHV0O1xuXHRcdFx0Y29uc3QgZ3JvdXAgPSBhY3RpdmVFZGl0b3JQYW5lLmdyb3VwO1xuXG5cdFx0XHQvLyBmaXJzdCB0cnkgYSBub3JtYWwgcmV2ZXJ0IHdoZXJlIHRoZSBjb250ZW50cyBvZiB0aGUgZWRpdG9yIGFyZSByZXN0b3JlZFxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgZWRpdG9yU2VydmljZS5yZXZlcnQoeyBlZGl0b3IsIGdyb3VwSWQ6IGdyb3VwLmlkIH0pO1xuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0bG9nU2VydmljZS5lcnJvcihlcnJvcik7XG5cblx0XHRcdFx0Ly8gaWYgdGhhdCBmYWlscywgc2luY2Ugd2UgYXJlIGFib3V0IHRvIGNsb3NlIHRoZSBlZGl0b3IsIHdlIGFjY2VwdCB0aGF0XG5cdFx0XHRcdC8vIHRoZSBlZGl0b3IgY2Fubm90IGJlIHJldmVydGVkIGFuZCBpbnN0ZWFkIGRvIGEgc29mdCByZXZlcnQgdGhhdCBqdXN0XG5cdFx0XHRcdC8vIGVuYWJsZXMgdXMgdG8gY2xvc2UgdGhlIGVkaXRvci4gV2l0aCB0aGlzLCBhIHVzZXIgY2FuIGFsd2F5cyBjbG9zZSBhXG5cdFx0XHRcdC8vIGRpcnR5IGVkaXRvciBldmVuIHdoZW4gcmV2ZXJ0aW5nIGZhaWxzLlxuXG5cdFx0XHRcdGF3YWl0IGVkaXRvclNlcnZpY2UucmV2ZXJ0KHsgZWRpdG9yLCBncm91cElkOiBncm91cC5pZCB9LCB7IHNvZnQ6IHRydWUgfSk7XG5cdFx0XHR9XG5cblx0XHRcdGF3YWl0IGdyb3VwLmNsb3NlRWRpdG9yKGVkaXRvcik7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDbG9zZUxlZnRFZGl0b3JzSW5Hcm91cEFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5jbG9zZUVkaXRvcnNUb1RoZUxlZnQnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignY2xvc2VFZGl0b3JzVG9UaGVMZWZ0JywgJ0Nsb3NlIEVkaXRvcnMgdG8gdGhlIExlZnQgaW4gR3JvdXAnKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlld1xuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0PzogSUVkaXRvcklkZW50aWZpZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBlZGl0b3JHcm91cFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvckdyb3Vwc1NlcnZpY2UpO1xuXG5cdFx0Y29uc3QgeyBncm91cCwgZWRpdG9yIH0gPSB0aGlzLmdldFRhcmdldChlZGl0b3JHcm91cFNlcnZpY2UsIGNvbnRleHQpO1xuXHRcdGlmIChncm91cCAmJiBlZGl0b3IpIHtcblx0XHRcdGF3YWl0IGdyb3VwLmNsb3NlRWRpdG9ycyh7IGRpcmVjdGlvbjogQ2xvc2VEaXJlY3Rpb24uTEVGVCwgZXhjZXB0OiBlZGl0b3IsIGV4Y2x1ZGVTdGlja3k6IHRydWUgfSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRUYXJnZXQoZWRpdG9yR3JvdXBTZXJ2aWNlOiBJRWRpdG9yR3JvdXBzU2VydmljZSwgY29udGV4dD86IElFZGl0b3JJZGVudGlmaWVyKTogeyBlZGl0b3I6IEVkaXRvcklucHV0IHwgbnVsbDsgZ3JvdXA6IElFZGl0b3JHcm91cCB8IHVuZGVmaW5lZCB9IHtcblx0XHRpZiAoY29udGV4dCkge1xuXHRcdFx0cmV0dXJuIHsgZWRpdG9yOiBjb250ZXh0LmVkaXRvciwgZ3JvdXA6IGVkaXRvckdyb3VwU2VydmljZS5nZXRHcm91cChjb250ZXh0Lmdyb3VwSWQpIH07XG5cdFx0fVxuXG5cdFx0Ly8gRmFsbGJhY2sgdG8gYWN0aXZlIGdyb3VwXG5cdFx0cmV0dXJuIHsgZ3JvdXA6IGVkaXRvckdyb3VwU2VydmljZS5hY3RpdmVHcm91cCwgZWRpdG9yOiBlZGl0b3JHcm91cFNlcnZpY2UuYWN0aXZlR3JvdXAuYWN0aXZlRWRpdG9yIH07XG5cdH1cbn1cblxuYWJzdHJhY3QgY2xhc3MgQWJzdHJhY3RDbG9zZUFsbEFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdHByb3RlY3RlZCBncm91cHNUb0Nsb3NlKGVkaXRvckdyb3VwU2VydmljZTogSUVkaXRvckdyb3Vwc1NlcnZpY2UpOiBJRWRpdG9yR3JvdXBbXSB7XG5cdFx0Y29uc3QgZ3JvdXBzVG9DbG9zZTogSUVkaXRvckdyb3VwW10gPSBbXTtcblxuXHRcdC8vIENsb3NlIGVkaXRvcnMgaW4gcmV2ZXJzZSBvcmRlciBvZiB0aGVpciBncmlkIGFwcGVhcmFuY2Ugc28gdGhhdCB0aGUgZWRpdG9yXG5cdFx0Ly8gZ3JvdXAgdGhhdCBpcyB0aGUgZmlyc3QgKHRvcC1sZWZ0KSByZW1haW5zLiBUaGlzIGhlbHBzIHRvIGtlZXAgdmlldyBzdGF0ZVxuXHRcdC8vIGZvciBlZGl0b3JzIGFyb3VuZCB0aGF0IGhhdmUgYmVlbiBvcGVuZWQgaW4gdGhpcyB2aXN1YWxseSBmaXJzdCBncm91cC5cblx0XHRjb25zdCBncm91cHMgPSBlZGl0b3JHcm91cFNlcnZpY2UuZ2V0R3JvdXBzKEdyb3Vwc09yZGVyLkdSSURfQVBQRUFSQU5DRSk7XG5cdFx0Zm9yIChsZXQgaSA9IGdyb3Vwcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuXHRcdFx0Z3JvdXBzVG9DbG9zZS5wdXNoKGdyb3Vwc1tpXSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGdyb3Vwc1RvQ2xvc2U7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRjb25zdCBsb2dTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMb2dTZXJ2aWNlKTtcblx0XHRjb25zdCBwcm9ncmVzc1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVByb2dyZXNzU2VydmljZSk7XG5cdFx0Y29uc3QgZWRpdG9yR3JvdXBTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JHcm91cHNTZXJ2aWNlKTtcblx0XHRjb25zdCBmaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCBmaWxlRGlhbG9nU2VydmljZSA9IGFjY2Vzc29yLmdldChJRmlsZURpYWxvZ1NlcnZpY2UpO1xuXG5cdFx0Ly8gRGVwZW5kaW5nIG9uIHRoZSBlZGl0b3IgYW5kIGF1dG8gc2F2ZSBjb25maWd1cmF0aW9uLFxuXHRcdC8vIHNwbGl0IGVkaXRvcnMgaW50byBidWNrZXRzIGZvciBoYW5kbGluZyBjb25maXJtYXRpb25cblxuXHRcdGNvbnN0IGRpcnR5RWRpdG9yc1dpdGhEZWZhdWx0Q29uZmlybSA9IG5ldyBTZXQ8SUVkaXRvcklkZW50aWZpZXI+KCk7XG5cdFx0Y29uc3QgZGlydHlBdXRvU2F2ZU9uRm9jdXNDaGFuZ2VFZGl0b3JzID0gbmV3IFNldDxJRWRpdG9ySWRlbnRpZmllcj4oKTtcblx0XHRjb25zdCBkaXJ0eUF1dG9TYXZlT25XaW5kb3dDaGFuZ2VFZGl0b3JzID0gbmV3IFNldDxJRWRpdG9ySWRlbnRpZmllcj4oKTtcblx0XHRjb25zdCBlZGl0b3JzV2l0aEN1c3RvbUNvbmZpcm0gPSBuZXcgTWFwPHN0cmluZyAvKiB0eXBlSWQgKi8sIFNldDxJRWRpdG9ySWRlbnRpZmllcj4+KCk7XG5cblx0XHRmb3IgKGNvbnN0IHsgZWRpdG9yLCBncm91cElkIH0gb2YgZWRpdG9yU2VydmljZS5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMLCB7IGV4Y2x1ZGVTdGlja3k6IHRoaXMuZXhjbHVkZVN0aWNreSB9KSkge1xuXHRcdFx0bGV0IGNvbmZpcm1DbG9zZSA9IGZhbHNlO1xuXHRcdFx0aWYgKGVkaXRvci5jbG9zZUhhbmRsZXIpIHtcblx0XHRcdFx0Y29uZmlybUNsb3NlID0gZWRpdG9yLmNsb3NlSGFuZGxlci5zaG93Q29uZmlybSgpOyAvLyBjdXN0b20gaGFuZGxpbmcgb2YgY29uZmlybWF0aW9uIG9uIGNsb3NlXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25maXJtQ2xvc2UgPSBlZGl0b3IuaXNEaXJ0eSgpICYmICFlZGl0b3IuaXNTYXZpbmcoKTsgLy8gZGVmYXVsdCBjb25maXJtIG9ubHkgd2hlbiBkaXJ0eSBhbmQgbm90IHNhdmluZ1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIWNvbmZpcm1DbG9zZSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gRWRpdG9yIGhhcyBjdXN0b20gY29uZmlybSBpbXBsZW1lbnRhdGlvblxuXHRcdFx0aWYgKHR5cGVvZiBlZGl0b3IuY2xvc2VIYW5kbGVyPy5jb25maXJtID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRcdGxldCBjdXN0b21FZGl0b3JzVG9Db25maXJtID0gZWRpdG9yc1dpdGhDdXN0b21Db25maXJtLmdldChlZGl0b3IudHlwZUlkKTtcblx0XHRcdFx0aWYgKCFjdXN0b21FZGl0b3JzVG9Db25maXJtKSB7XG5cdFx0XHRcdFx0Y3VzdG9tRWRpdG9yc1RvQ29uZmlybSA9IG5ldyBTZXQoKTtcblx0XHRcdFx0XHRlZGl0b3JzV2l0aEN1c3RvbUNvbmZpcm0uc2V0KGVkaXRvci50eXBlSWQsIGN1c3RvbUVkaXRvcnNUb0NvbmZpcm0pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y3VzdG9tRWRpdG9yc1RvQ29uZmlybS5hZGQoeyBlZGl0b3IsIGdyb3VwSWQgfSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEVkaXRvciB3aWxsIGJlIHNhdmVkIG9uIGZvY3VzIGNoYW5nZSB3aGVuIGFcblx0XHRcdC8vIGRpYWxvZyBhcHBlYXJzLCBzbyBqdXN0IHRyYWNrIHRoYXQgc2VwYXJhdGVcblx0XHRcdGVsc2UgaWYgKCFlZGl0b3IuaGFzQ2FwYWJpbGl0eShFZGl0b3JJbnB1dENhcGFiaWxpdGllcy5VbnRpdGxlZCkgJiYgZmlsZXNDb25maWd1cmF0aW9uU2VydmljZS5nZXRBdXRvU2F2ZU1vZGUoZWRpdG9yKS5tb2RlID09PSBBdXRvU2F2ZU1vZGUuT05fRk9DVVNfQ0hBTkdFKSB7XG5cdFx0XHRcdGRpcnR5QXV0b1NhdmVPbkZvY3VzQ2hhbmdlRWRpdG9ycy5hZGQoeyBlZGl0b3IsIGdyb3VwSWQgfSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFdpbmRvd3MsIExpbnV4OiBlZGl0b3Igd2lsbCBiZSBzYXZlZCBvbiB3aW5kb3cgY2hhbmdlXG5cdFx0XHQvLyB3aGVuIGEgbmF0aXZlIGRpYWxvZyBhcHBlYXJzLCBzbyBqdXN0IHRyYWNrIHRoYXQgc2VwYXJhdGVcblx0XHRcdC8vIChzZWUgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEzNDI1MClcblx0XHRcdGVsc2UgaWYgKChpc05hdGl2ZSAmJiAoaXNXaW5kb3dzIHx8IGlzTGludXgpKSAmJiAhZWRpdG9yLmhhc0NhcGFiaWxpdHkoRWRpdG9ySW5wdXRDYXBhYmlsaXRpZXMuVW50aXRsZWQpICYmIGZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UuZ2V0QXV0b1NhdmVNb2RlKGVkaXRvcikubW9kZSA9PT0gQXV0b1NhdmVNb2RlLk9OX1dJTkRPV19DSEFOR0UpIHtcblx0XHRcdFx0ZGlydHlBdXRvU2F2ZU9uV2luZG93Q2hhbmdlRWRpdG9ycy5hZGQoeyBlZGl0b3IsIGdyb3VwSWQgfSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEVkaXRvciB3aWxsIHNob3cgaW4gZ2VuZXJpYyBmaWxlIGJhc2VkIGRpYWxvZ1xuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdGRpcnR5RWRpdG9yc1dpdGhEZWZhdWx0Q29uZmlybS5hZGQoeyBlZGl0b3IsIGdyb3VwSWQgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gMS4pIFNob3cgZGVmYXVsdCBmaWxlIGJhc2VkIGRpYWxvZ1xuXHRcdGlmIChkaXJ0eUVkaXRvcnNXaXRoRGVmYXVsdENvbmZpcm0uc2l6ZSA+IDApIHtcblx0XHRcdGNvbnN0IGVkaXRvcnMgPSBBcnJheS5mcm9tKGRpcnR5RWRpdG9yc1dpdGhEZWZhdWx0Q29uZmlybS52YWx1ZXMoKSk7XG5cblx0XHRcdGF3YWl0IHRoaXMucmV2ZWFsRWRpdG9yc1RvQ29uZmlybShlZGl0b3JzLCBlZGl0b3JHcm91cFNlcnZpY2UpOyAvLyBoZWxwIHVzZXIgbWFrZSBhIGRlY2lzaW9uIGJ5IHJldmVhbGluZyBlZGl0b3JzXG5cblx0XHRcdGNvbnN0IGNvbmZpcm1hdGlvbiA9IGF3YWl0IGZpbGVEaWFsb2dTZXJ2aWNlLnNob3dTYXZlQ29uZmlybShlZGl0b3JzLm1hcCgoeyBlZGl0b3IgfSkgPT4ge1xuXHRcdFx0XHRpZiAoZWRpdG9yIGluc3RhbmNlb2YgU2lkZUJ5U2lkZUVkaXRvcklucHV0KSB7XG5cdFx0XHRcdFx0cmV0dXJuIGVkaXRvci5wcmltYXJ5LmdldE5hbWUoKTsgLy8gcHJlZmVyIHNob3J0ZXIgbmFtZXMgYnkgdXNpbmcgcHJpbWFyeSdzIG5hbWUgaW4gdGhpcyBjYXNlXG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gZWRpdG9yLmdldE5hbWUoKTtcblx0XHRcdH0pKTtcblxuXHRcdFx0c3dpdGNoIChjb25maXJtYXRpb24pIHtcblx0XHRcdFx0Y2FzZSBDb25maXJtUmVzdWx0LkNBTkNFTDpcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdGNhc2UgQ29uZmlybVJlc3VsdC5ET05UX1NBVkU6XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5yZXZlcnRFZGl0b3JzKGVkaXRvclNlcnZpY2UsIGxvZ1NlcnZpY2UsIHByb2dyZXNzU2VydmljZSwgZWRpdG9ycyk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgQ29uZmlybVJlc3VsdC5TQVZFOlxuXHRcdFx0XHRcdGF3YWl0IGVkaXRvclNlcnZpY2Uuc2F2ZShlZGl0b3JzLCB7IHJlYXNvbjogU2F2ZVJlYXNvbi5FWFBMSUNJVCB9KTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyAyLikgU2hvdyBjdXN0b20gY29uZmlybSBiYXNlZCBkaWFsb2dcblx0XHRmb3IgKGNvbnN0IFssIGVkaXRvcklkZW50aWZpZXJzXSBvZiBlZGl0b3JzV2l0aEN1c3RvbUNvbmZpcm0pIHtcblx0XHRcdGNvbnN0IGVkaXRvcnMgPSBBcnJheS5mcm9tKGVkaXRvcklkZW50aWZpZXJzLnZhbHVlcygpKTtcblxuXHRcdFx0YXdhaXQgdGhpcy5yZXZlYWxFZGl0b3JzVG9Db25maXJtKGVkaXRvcnMsIGVkaXRvckdyb3VwU2VydmljZSk7IC8vIGhlbHAgdXNlciBtYWtlIGEgZGVjaXNpb24gYnkgcmV2ZWFsaW5nIGVkaXRvcnNcblxuXHRcdFx0Y29uc3QgY29uZmlybWF0aW9uID0gYXdhaXQgZWRpdG9ycy5hdCgwKT8uZWRpdG9yLmNsb3NlSGFuZGxlcj8uY29uZmlybT8uKGVkaXRvcnMpO1xuXHRcdFx0aWYgKHR5cGVvZiBjb25maXJtYXRpb24gPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdHN3aXRjaCAoY29uZmlybWF0aW9uKSB7XG5cdFx0XHRcdFx0Y2FzZSBDb25maXJtUmVzdWx0LkNBTkNFTDpcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRjYXNlIENvbmZpcm1SZXN1bHQuRE9OVF9TQVZFOlxuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5yZXZlcnRFZGl0b3JzKGVkaXRvclNlcnZpY2UsIGxvZ1NlcnZpY2UsIHByb2dyZXNzU2VydmljZSwgZWRpdG9ycyk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlIENvbmZpcm1SZXN1bHQuU0FWRTpcblx0XHRcdFx0XHRcdGF3YWl0IGVkaXRvclNlcnZpY2Uuc2F2ZShlZGl0b3JzLCB7IHJlYXNvbjogU2F2ZVJlYXNvbi5FWFBMSUNJVCB9KTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gMy4pIFNhdmUgYXV0b3NhdmVhYmxlIGVkaXRvcnMgKGZvY3VzIGNoYW5nZSlcblx0XHRpZiAoZGlydHlBdXRvU2F2ZU9uRm9jdXNDaGFuZ2VFZGl0b3JzLnNpemUgPiAwKSB7XG5cdFx0XHRjb25zdCBlZGl0b3JzID0gQXJyYXkuZnJvbShkaXJ0eUF1dG9TYXZlT25Gb2N1c0NoYW5nZUVkaXRvcnMudmFsdWVzKCkpO1xuXG5cdFx0XHRhd2FpdCBlZGl0b3JTZXJ2aWNlLnNhdmUoZWRpdG9ycywgeyByZWFzb246IFNhdmVSZWFzb24uRk9DVVNfQ0hBTkdFIH0pO1xuXHRcdH1cblxuXHRcdC8vIDQuKSBTYXZlIGF1dG9zYXZlYWJsZSBlZGl0b3JzICh3aW5kb3cgY2hhbmdlKVxuXHRcdGlmIChkaXJ0eUF1dG9TYXZlT25XaW5kb3dDaGFuZ2VFZGl0b3JzLnNpemUgPiAwKSB7XG5cdFx0XHRjb25zdCBlZGl0b3JzID0gQXJyYXkuZnJvbShkaXJ0eUF1dG9TYXZlT25XaW5kb3dDaGFuZ2VFZGl0b3JzLnZhbHVlcygpKTtcblxuXHRcdFx0YXdhaXQgZWRpdG9yU2VydmljZS5zYXZlKGVkaXRvcnMsIHsgcmVhc29uOiBTYXZlUmVhc29uLldJTkRPV19DSEFOR0UgfSk7XG5cdFx0fVxuXG5cdFx0Ly8gNS4pIEZpbmFsbHkgY2xvc2UgYWxsIGVkaXRvcnM6IGV2ZW4gaWYgYW4gZWRpdG9yIGZhaWxlZCB0b1xuXHRcdC8vIHNhdmUgb3IgcmV2ZXJ0IGFuZCBzdGlsbCByZXBvcnRzIGRpcnR5LCB0aGUgZWRpdG9yIHBhcnQgbWFrZXNcblx0XHQvLyBzdXJlIHRvIGJyaW5nIHVwIGFub3RoZXIgY29uZmlybSBkaWFsb2cgZm9yIHRob3NlIGVkaXRvcnNcblx0XHQvLyBzcGVjaWZpY2FsbHkuXG5cdFx0cmV0dXJuIHRoaXMuZG9DbG9zZUFsbChlZGl0b3JHcm91cFNlcnZpY2UpO1xuXHR9XG5cblx0cHJpdmF0ZSByZXZlcnRFZGl0b3JzKGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLCBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSwgcHJvZ3Jlc3NTZXJ2aWNlOiBJUHJvZ3Jlc3NTZXJ2aWNlLCBlZGl0b3JzOiBJRWRpdG9ySWRlbnRpZmllcltdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHByb2dyZXNzU2VydmljZS53aXRoUHJvZ3Jlc3Moe1xuXHRcdFx0bG9jYXRpb246IFByb2dyZXNzTG9jYXRpb24uV2luZG93LCBcdC8vIHVzZSB3aW5kb3cgcHJvZ3Jlc3MgdG8gbm90IGJlIHRvbyBhbm5veWluZyBhYm91dCB0aGlzIG9wZXJhdGlvblxuXHRcdFx0ZGVsYXk6IDgwMCxcdFx0XHRcdFx0XHRcdC8vIGRlbGF5IHNvIHRoYXQgaXQgb25seSBhcHBlYXJzIHdoZW4gb3BlcmF0aW9uIHRha2VzIGEgbG9uZyB0aW1lXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ3JldmVydGluZycsIFwiUmV2ZXJ0aW5nIEVkaXRvcnMuLi5cIiksXG5cdFx0fSwgKCkgPT4gdGhpcy5kb1JldmVydEVkaXRvcnMoZWRpdG9yU2VydmljZSwgbG9nU2VydmljZSwgZWRpdG9ycykpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb1JldmVydEVkaXRvcnMoZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsIGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLCBlZGl0b3JzOiBJRWRpdG9ySWRlbnRpZmllcltdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dHJ5IHtcblx0XHRcdC8vIFdlIGZpcnN0IGF0dGVtcHQgdG8gcmV2ZXJ0IGFsbCBlZGl0b3JzIHdpdGggYHNvZnQ6IGZhbHNlYCwgdG8gZW5zdXJlIHRoYXRcblx0XHRcdC8vIHdvcmtpbmcgY29waWVzIHJldmVydCB0byB0aGVpciBzdGF0ZSBvbiBkaXNrLiBFdmVuIHRob3VnaCB3ZSBjbG9zZSBlZGl0b3JzLFxuXHRcdFx0Ly8gaXQgaXMgcG9zc2libGUgdGhhdCBvdGhlciBwYXJ0aWVzIGhvbGQgYSByZWZlcmVuY2UgdG8gdGhlIHdvcmtpbmcgY29weVxuXHRcdFx0Ly8gYW5kIGV4cGVjdCBpdCB0byBiZSBpbiBhIGNlcnRhaW4gc3RhdGUgYWZ0ZXIgdGhlIGVkaXRvciBpcyBjbG9zZWQgd2l0aG91dFxuXHRcdFx0Ly8gc2F2aW5nLlxuXHRcdFx0YXdhaXQgZWRpdG9yU2VydmljZS5yZXZlcnQoZWRpdG9ycyk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGxvZ1NlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXG5cdFx0XHQvLyBpZiB0aGF0IGZhaWxzLCBzaW5jZSB3ZSBhcmUgYWJvdXQgdG8gY2xvc2UgdGhlIGVkaXRvciwgd2UgYWNjZXB0IHRoYXRcblx0XHRcdC8vIHRoZSBlZGl0b3IgY2Fubm90IGJlIHJldmVydGVkIGFuZCBpbnN0ZWFkIGRvIGEgc29mdCByZXZlcnQgdGhhdCBqdXN0XG5cdFx0XHQvLyBlbmFibGVzIHVzIHRvIGNsb3NlIHRoZSBlZGl0b3IuIFdpdGggdGhpcywgYSB1c2VyIGNhbiBhbHdheXMgY2xvc2UgYVxuXHRcdFx0Ly8gZGlydHkgZWRpdG9yIGV2ZW4gd2hlbiByZXZlcnRpbmcgZmFpbHMuXG5cdFx0XHRhd2FpdCBlZGl0b3JTZXJ2aWNlLnJldmVydChlZGl0b3JzLCB7IHNvZnQ6IHRydWUgfSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZXZlYWxFZGl0b3JzVG9Db25maXJtKGVkaXRvcnM6IFJlYWRvbmx5QXJyYXk8SUVkaXRvcklkZW50aWZpZXI+LCBlZGl0b3JHcm91cFNlcnZpY2U6IElFZGl0b3JHcm91cHNTZXJ2aWNlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGhhbmRsZWRHcm91cHMgPSBuZXcgU2V0PEdyb3VwSWRlbnRpZmllcj4oKTtcblx0XHRcdGZvciAoY29uc3QgeyBlZGl0b3IsIGdyb3VwSWQgfSBvZiBlZGl0b3JzKSB7XG5cdFx0XHRcdGlmIChoYW5kbGVkR3JvdXBzLmhhcyhncm91cElkKSkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aGFuZGxlZEdyb3Vwcy5hZGQoZ3JvdXBJZCk7XG5cblx0XHRcdFx0Y29uc3QgZ3JvdXAgPSBlZGl0b3JHcm91cFNlcnZpY2UuZ2V0R3JvdXAoZ3JvdXBJZCk7XG5cdFx0XHRcdGF3YWl0IGdyb3VwPy5vcGVuRWRpdG9yKGVkaXRvcik7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdC8vIGlnbm9yZSBhbnkgZXJyb3IgYXMgdGhlIHJldmVhbGluZyBpcyBqdXN0IGNvbnZpbmllbmNlXG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIGFic3RyYWN0IGdldCBleGNsdWRlU3RpY2t5KCk6IGJvb2xlYW47XG5cblx0cHJvdGVjdGVkIGFzeW5jIGRvQ2xvc2VBbGwoZWRpdG9yR3JvdXBTZXJ2aWNlOiBJRWRpdG9yR3JvdXBzU2VydmljZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IFByb21pc2UuYWxsKHRoaXMuZ3JvdXBzVG9DbG9zZShlZGl0b3JHcm91cFNlcnZpY2UpLm1hcChncm91cCA9PiBncm91cC5jbG9zZUFsbEVkaXRvcnMoeyBleGNsdWRlU3RpY2t5OiB0aGlzLmV4Y2x1ZGVTdGlja3kgfSkpKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ2xvc2VBbGxFZGl0b3JzQWN0aW9uIGV4dGVuZHMgQWJzdHJhY3RDbG9zZUFsbEFjdGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5hY3Rpb24uY2xvc2VBbGxFZGl0b3JzJztcblx0c3RhdGljIHJlYWRvbmx5IExBQkVMID0gbG9jYWxpemUyKCdjbG9zZUFsbEVkaXRvcnMnLCAnQ2xvc2UgQWxsIEVkaXRvcnMnKTtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogQ2xvc2VBbGxFZGl0b3JzQWN0aW9uLklELFxuXHRcdFx0dGl0bGU6IENsb3NlQWxsRWRpdG9yc0FjdGlvbi5MQUJFTCxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlXKVxuXHRcdFx0fSxcblx0XHRcdGljb246IENvZGljb24uY2xvc2VBbGwsXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3XG5cdFx0fSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0IGV4Y2x1ZGVTdGlja3koKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRydWU7IC8vIGV4Y2x1ZGUgc3RpY2t5IGZyb20gdGhpcyBtYXNzLWNsb3Npbmcgb3BlcmF0aW9uXG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIENsb3NlQWxsRWRpdG9yR3JvdXBzQWN0aW9uIGV4dGVuZHMgQWJzdHJhY3RDbG9zZUFsbEFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmNsb3NlQWxsR3JvdXBzJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2Nsb3NlQWxsR3JvdXBzJywgJ0Nsb3NlIEFsbCBFZGl0b3IgR3JvdXBzJyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuS2V5Vylcblx0XHRcdH0sXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3XG5cdFx0fSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0IGV4Y2x1ZGVTdGlja3koKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGZhbHNlOyAvLyB0aGUgaW50ZW50IHRvIGNsb3NlIGdyb3VwcyBtZWFucywgZXZlbiBzdGlja3kgYXJlIGluY2x1ZGVkXG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgYXN5bmMgZG9DbG9zZUFsbChlZGl0b3JHcm91cFNlcnZpY2U6IElFZGl0b3JHcm91cHNTZXJ2aWNlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgc3VwZXIuZG9DbG9zZUFsbChlZGl0b3JHcm91cFNlcnZpY2UpO1xuXG5cdFx0Zm9yIChjb25zdCBncm91cFRvQ2xvc2Ugb2YgdGhpcy5ncm91cHNUb0Nsb3NlKGVkaXRvckdyb3VwU2VydmljZSkpIHtcblx0XHRcdGVkaXRvckdyb3VwU2VydmljZS5yZW1vdmVHcm91cChncm91cFRvQ2xvc2UpO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ2xvc2VFZGl0b3JzSW5PdGhlckdyb3Vwc0FjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5jbG9zZUVkaXRvcnNJbk90aGVyR3JvdXBzJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2Nsb3NlRWRpdG9yc0luT3RoZXJHcm91cHMnLCAnQ2xvc2UgRWRpdG9ycyBpbiBPdGhlciBHcm91cHMnKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlld1xuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0PzogSUVkaXRvcklkZW50aWZpZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBlZGl0b3JHcm91cFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvckdyb3Vwc1NlcnZpY2UpO1xuXG5cdFx0Y29uc3QgZ3JvdXBUb1NraXAgPSBjb250ZXh0ID8gZWRpdG9yR3JvdXBTZXJ2aWNlLmdldEdyb3VwKGNvbnRleHQuZ3JvdXBJZCkgOiBlZGl0b3JHcm91cFNlcnZpY2UuYWN0aXZlR3JvdXA7XG5cdFx0YXdhaXQgUHJvbWlzZS5hbGwoZWRpdG9yR3JvdXBTZXJ2aWNlLmdldEdyb3VwcyhHcm91cHNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSkubWFwKGFzeW5jIGdyb3VwID0+IHtcblx0XHRcdGlmIChncm91cFRvU2tpcCAmJiBncm91cC5pZCA9PT0gZ3JvdXBUb1NraXAuaWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gZ3JvdXAuY2xvc2VBbGxFZGl0b3JzKHsgZXhjbHVkZVN0aWNreTogdHJ1ZSB9KTtcblx0XHR9KSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIENsb3NlRWRpdG9ySW5BbGxHcm91cHNBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uY2xvc2VFZGl0b3JJbkFsbEdyb3VwcycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdjbG9zZUVkaXRvckluQWxsR3JvdXBzJywgJ0Nsb3NlIEVkaXRvciBpbiBBbGwgR3JvdXBzJyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXdcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IGVkaXRvckdyb3VwU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSk7XG5cblx0XHRjb25zdCBhY3RpdmVFZGl0b3IgPSBlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvcjtcblx0XHRpZiAoYWN0aXZlRWRpdG9yKSB7XG5cdFx0XHRhd2FpdCBQcm9taXNlLmFsbChlZGl0b3JHcm91cFNlcnZpY2UuZ2V0R3JvdXBzKEdyb3Vwc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFKS5tYXAoZ3JvdXAgPT4gZ3JvdXAuY2xvc2VFZGl0b3IoYWN0aXZlRWRpdG9yKSkpO1xuXHRcdH1cblx0fVxufVxuXG5hYnN0cmFjdCBjbGFzcyBBYnN0cmFjdE1vdmVDb3B5R3JvdXBBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRkZXNjOiBSZWFkb25seTxJQWN0aW9uMk9wdGlvbnM+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZGlyZWN0aW9uOiBHcm91cERpcmVjdGlvbixcblx0XHRwcml2YXRlIHJlYWRvbmx5IGlzTW92ZTogYm9vbGVhblxuXHQpIHtcblx0XHRzdXBlcihkZXNjKTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY29udGV4dD86IElFZGl0b3JJZGVudGlmaWVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZWRpdG9yR3JvdXBTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JHcm91cHNTZXJ2aWNlKTtcblxuXHRcdGxldCBzb3VyY2VHcm91cDogSUVkaXRvckdyb3VwIHwgdW5kZWZpbmVkO1xuXHRcdGlmIChjb250ZXh0ICYmIHR5cGVvZiBjb250ZXh0Lmdyb3VwSWQgPT09ICdudW1iZXInKSB7XG5cdFx0XHRzb3VyY2VHcm91cCA9IGVkaXRvckdyb3VwU2VydmljZS5nZXRHcm91cChjb250ZXh0Lmdyb3VwSWQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRzb3VyY2VHcm91cCA9IGVkaXRvckdyb3VwU2VydmljZS5hY3RpdmVHcm91cDtcblx0XHR9XG5cblx0XHRpZiAoc291cmNlR3JvdXApIHtcblx0XHRcdGxldCByZXN1bHRHcm91cDogSUVkaXRvckdyb3VwIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0aWYgKHRoaXMuaXNNb3ZlKSB7XG5cdFx0XHRcdGNvbnN0IHRhcmdldEdyb3VwID0gdGhpcy5maW5kVGFyZ2V0R3JvdXAoZWRpdG9yR3JvdXBTZXJ2aWNlLCBzb3VyY2VHcm91cCk7XG5cdFx0XHRcdGlmICh0YXJnZXRHcm91cCkge1xuXHRcdFx0XHRcdHJlc3VsdEdyb3VwID0gZWRpdG9yR3JvdXBTZXJ2aWNlLm1vdmVHcm91cChzb3VyY2VHcm91cCwgdGFyZ2V0R3JvdXAsIHRoaXMuZGlyZWN0aW9uKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVzdWx0R3JvdXAgPSBlZGl0b3JHcm91cFNlcnZpY2UuY29weUdyb3VwKHNvdXJjZUdyb3VwLCBzb3VyY2VHcm91cCwgdGhpcy5kaXJlY3Rpb24pO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAocmVzdWx0R3JvdXApIHtcblx0XHRcdFx0ZWRpdG9yR3JvdXBTZXJ2aWNlLmFjdGl2YXRlR3JvdXAocmVzdWx0R3JvdXApO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZmluZFRhcmdldEdyb3VwKGVkaXRvckdyb3VwU2VydmljZTogSUVkaXRvckdyb3Vwc1NlcnZpY2UsIHNvdXJjZUdyb3VwOiBJRWRpdG9yR3JvdXApOiBJRWRpdG9yR3JvdXAgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHRhcmdldE5laWdoYm91cnM6IEdyb3VwRGlyZWN0aW9uW10gPSBbdGhpcy5kaXJlY3Rpb25dO1xuXG5cdFx0Ly8gQWxsb3cgdGhlIHRhcmdldCBncm91cCB0byBiZSBpbiBhbHRlcm5hdGl2ZSBsb2NhdGlvbnMgdG8gc3VwcG9ydCBtb3JlXG5cdFx0Ly8gc2NlbmFyaW9zIG9mIG1vdmluZyB0aGUgZ3JvdXAgdG8gdGhlIHRhcmV0IGxvY2F0aW9uLlxuXHRcdC8vIEhlbHBzIGZvciBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvNTA3NDFcblx0XHRzd2l0Y2ggKHRoaXMuZGlyZWN0aW9uKSB7XG5cdFx0XHRjYXNlIEdyb3VwRGlyZWN0aW9uLkxFRlQ6XG5cdFx0XHRjYXNlIEdyb3VwRGlyZWN0aW9uLlJJR0hUOlxuXHRcdFx0XHR0YXJnZXROZWlnaGJvdXJzLnB1c2goR3JvdXBEaXJlY3Rpb24uVVAsIEdyb3VwRGlyZWN0aW9uLkRPV04pO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgR3JvdXBEaXJlY3Rpb24uVVA6XG5cdFx0XHRjYXNlIEdyb3VwRGlyZWN0aW9uLkRPV046XG5cdFx0XHRcdHRhcmdldE5laWdoYm91cnMucHVzaChHcm91cERpcmVjdGlvbi5MRUZULCBHcm91cERpcmVjdGlvbi5SSUdIVCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgdGFyZ2V0TmVpZ2hib3VyIG9mIHRhcmdldE5laWdoYm91cnMpIHtcblx0XHRcdGNvbnN0IHRhcmdldE5laWdoYm91ckdyb3VwID0gZWRpdG9yR3JvdXBTZXJ2aWNlLmZpbmRHcm91cCh7IGRpcmVjdGlvbjogdGFyZ2V0TmVpZ2hib3VyIH0sIHNvdXJjZUdyb3VwKTtcblx0XHRcdGlmICh0YXJnZXROZWlnaGJvdXJHcm91cCkge1xuXHRcdFx0XHRyZXR1cm4gdGFyZ2V0TmVpZ2hib3VyR3JvdXA7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxufVxuXG5hYnN0cmFjdCBjbGFzcyBBYnN0cmFjdE1vdmVHcm91cEFjdGlvbiBleHRlbmRzIEFic3RyYWN0TW92ZUNvcHlHcm91cEFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0ZGVzYzogUmVhZG9ubHk8SUFjdGlvbjJPcHRpb25zPixcblx0XHRkaXJlY3Rpb246IEdyb3VwRGlyZWN0aW9uXG5cdCkge1xuXHRcdHN1cGVyKGRlc2MsIGRpcmVjdGlvbiwgdHJ1ZSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE1vdmVHcm91cExlZnRBY3Rpb24gZXh0ZW5kcyBBYnN0cmFjdE1vdmVHcm91cEFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLm1vdmVBY3RpdmVFZGl0b3JHcm91cExlZnQnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignbW92ZUFjdGl2ZUdyb3VwTGVmdCcsICdNb3ZlIEVkaXRvciBHcm91cCBMZWZ0JyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlDb2RlLkxlZnRBcnJvdylcblx0XHRcdH0sXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3XG5cdFx0fSwgR3JvdXBEaXJlY3Rpb24uTEVGVCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE1vdmVHcm91cFJpZ2h0QWN0aW9uIGV4dGVuZHMgQWJzdHJhY3RNb3ZlR3JvdXBBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5tb3ZlQWN0aXZlRWRpdG9yR3JvdXBSaWdodCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdtb3ZlQWN0aXZlR3JvdXBSaWdodCcsICdNb3ZlIEVkaXRvciBHcm91cCBSaWdodCcpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5Q29kZS5SaWdodEFycm93KVxuXHRcdFx0fSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXdcblx0XHR9LCBHcm91cERpcmVjdGlvbi5SSUdIVCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE1vdmVHcm91cFVwQWN0aW9uIGV4dGVuZHMgQWJzdHJhY3RNb3ZlR3JvdXBBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5tb3ZlQWN0aXZlRWRpdG9yR3JvdXBVcCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdtb3ZlQWN0aXZlR3JvdXBVcCcsICdNb3ZlIEVkaXRvciBHcm91cCBVcCcpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5Q29kZS5VcEFycm93KVxuXHRcdFx0fSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXdcblx0XHR9LCBHcm91cERpcmVjdGlvbi5VUCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE1vdmVHcm91cERvd25BY3Rpb24gZXh0ZW5kcyBBYnN0cmFjdE1vdmVHcm91cEFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLm1vdmVBY3RpdmVFZGl0b3JHcm91cERvd24nLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignbW92ZUFjdGl2ZUdyb3VwRG93bicsICdNb3ZlIEVkaXRvciBHcm91cCBEb3duJyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlDb2RlLkRvd25BcnJvdylcblx0XHRcdH0sXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3XG5cdFx0fSwgR3JvdXBEaXJlY3Rpb24uRE9XTik7XG5cdH1cbn1cblxuYWJzdHJhY3QgY2xhc3MgQWJzdHJhY3REdXBsaWNhdGVHcm91cEFjdGlvbiBleHRlbmRzIEFic3RyYWN0TW92ZUNvcHlHcm91cEFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0ZGVzYzogUmVhZG9ubHk8SUFjdGlvbjJPcHRpb25zPixcblx0XHRkaXJlY3Rpb246IEdyb3VwRGlyZWN0aW9uXG5cdCkge1xuXHRcdHN1cGVyKGRlc2MsIGRpcmVjdGlvbiwgZmFsc2UpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBEdXBsaWNhdGVHcm91cExlZnRBY3Rpb24gZXh0ZW5kcyBBYnN0cmFjdER1cGxpY2F0ZUdyb3VwQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uZHVwbGljYXRlQWN0aXZlRWRpdG9yR3JvdXBMZWZ0Jyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2R1cGxpY2F0ZUFjdGl2ZUdyb3VwTGVmdCcsICdEdXBsaWNhdGUgRWRpdG9yIEdyb3VwIExlZnQnKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlld1xuXHRcdH0sIEdyb3VwRGlyZWN0aW9uLkxFRlQpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBEdXBsaWNhdGVHcm91cFJpZ2h0QWN0aW9uIGV4dGVuZHMgQWJzdHJhY3REdXBsaWNhdGVHcm91cEFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmR1cGxpY2F0ZUFjdGl2ZUVkaXRvckdyb3VwUmlnaHQnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignZHVwbGljYXRlQWN0aXZlR3JvdXBSaWdodCcsICdEdXBsaWNhdGUgRWRpdG9yIEdyb3VwIFJpZ2h0JyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXdcblx0XHR9LCBHcm91cERpcmVjdGlvbi5SSUdIVCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIER1cGxpY2F0ZUdyb3VwVXBBY3Rpb24gZXh0ZW5kcyBBYnN0cmFjdER1cGxpY2F0ZUdyb3VwQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uZHVwbGljYXRlQWN0aXZlRWRpdG9yR3JvdXBVcCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdkdXBsaWNhdGVBY3RpdmVHcm91cFVwJywgJ0R1cGxpY2F0ZSBFZGl0b3IgR3JvdXAgVXAnKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlld1xuXHRcdH0sIEdyb3VwRGlyZWN0aW9uLlVQKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRHVwbGljYXRlR3JvdXBEb3duQWN0aW9uIGV4dGVuZHMgQWJzdHJhY3REdXBsaWNhdGVHcm91cEFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmR1cGxpY2F0ZUFjdGl2ZUVkaXRvckdyb3VwRG93bicsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdkdXBsaWNhdGVBY3RpdmVHcm91cERvd24nLCAnRHVwbGljYXRlIEVkaXRvciBHcm91cCBEb3duJyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXdcblx0XHR9LCBHcm91cERpcmVjdGlvbi5ET1dOKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTWluaW1pemVPdGhlckdyb3Vwc0FjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5taW5pbWl6ZU90aGVyRWRpdG9ycycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdtaW5pbWl6ZU90aGVyRWRpdG9yR3JvdXBzJywgJ0V4cGFuZCBFZGl0b3IgR3JvdXAnKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlldyxcblx0XHRcdHByZWNvbmRpdGlvbjogTXVsdGlwbGVFZGl0b3JHcm91cHNDb250ZXh0XG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBlZGl0b3JHcm91cFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvckdyb3Vwc1NlcnZpY2UpO1xuXG5cdFx0ZWRpdG9yR3JvdXBTZXJ2aWNlLmFycmFuZ2VHcm91cHMoR3JvdXBzQXJyYW5nZW1lbnQuRVhQQU5EKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTWluaW1pemVPdGhlckdyb3Vwc0hpZGVTaWRlYmFyQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLm1pbmltaXplT3RoZXJFZGl0b3JzSGlkZVNpZGViYXInLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignbWluaW1pemVPdGhlckVkaXRvckdyb3Vwc0hpZGVTaWRlYmFyJywgJ0V4cGFuZCBFZGl0b3IgR3JvdXAgYW5kIEhpZGUgU2lkZSBCYXJzJyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXcsXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLm9yKE11bHRpcGxlRWRpdG9yR3JvdXBzQ29udGV4dCwgU2lkZUJhclZpc2libGVDb250ZXh0LCBBdXhpbGlhcnlCYXJWaXNpYmxlQ29udGV4dClcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGVkaXRvckdyb3VwU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSk7XG5cdFx0Y29uc3QgbGF5b3V0U2VydmljZSA9IGFjY2Vzc29yLmdldChJV29ya2JlbmNoTGF5b3V0U2VydmljZSk7XG5cblx0XHRsYXlvdXRTZXJ2aWNlLnNldFBhcnRIaWRkZW4odHJ1ZSwgUGFydHMuU0lERUJBUl9QQVJUKTtcblx0XHRsYXlvdXRTZXJ2aWNlLnNldFBhcnRIaWRkZW4odHJ1ZSwgUGFydHMuQVVYSUxJQVJZQkFSX1BBUlQpO1xuXHRcdGVkaXRvckdyb3VwU2VydmljZS5hcnJhbmdlR3JvdXBzKEdyb3Vwc0FycmFuZ2VtZW50LkVYUEFORCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFJlc2V0R3JvdXBTaXplc0FjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5ldmVuRWRpdG9yV2lkdGhzJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2V2ZW5FZGl0b3JHcm91cHMnLCAnUmVzZXQgRWRpdG9yIEdyb3VwIFNpemVzJyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXdcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGVkaXRvckdyb3VwU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSk7XG5cblx0XHRlZGl0b3JHcm91cFNlcnZpY2UuYXJyYW5nZUdyb3VwcyhHcm91cHNBcnJhbmdlbWVudC5FVkVOKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVG9nZ2xlR3JvdXBTaXplc0FjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi50b2dnbGVFZGl0b3JXaWR0aHMnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMigndG9nZ2xlRWRpdG9yV2lkdGhzJywgJ1RvZ2dsZSBFZGl0b3IgR3JvdXAgU2l6ZXMnKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlld1xuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZWRpdG9yR3JvdXBTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JHcm91cHNTZXJ2aWNlKTtcblxuXHRcdGVkaXRvckdyb3VwU2VydmljZS50b2dnbGVFeHBhbmRHcm91cCgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBNYXhpbWl6ZUdyb3VwSGlkZVNpZGViYXJBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ubWF4aW1pemVFZGl0b3JIaWRlU2lkZWJhcicsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdtYXhpbWl6ZUVkaXRvckhpZGVTaWRlYmFyJywgJ01heGltaXplIEVkaXRvciBHcm91cCBhbmQgSGlkZSBTaWRlIEJhcnMnKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlldyxcblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIub3IoQ29udGV4dEtleUV4cHIuYW5kKEVkaXRvclBhcnRNYXhpbWl6ZWRFZGl0b3JHcm91cENvbnRleHQubmVnYXRlKCksIEVkaXRvclBhcnRNdWx0aXBsZUVkaXRvckdyb3Vwc0NvbnRleHQpLCBTaWRlQmFyVmlzaWJsZUNvbnRleHQsIEF1eGlsaWFyeUJhclZpc2libGVDb250ZXh0KVxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgbGF5b3V0U2VydmljZSA9IGFjY2Vzc29yLmdldChJV29ya2JlbmNoTGF5b3V0U2VydmljZSk7XG5cdFx0Y29uc3QgZWRpdG9yR3JvdXBTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JHcm91cHNTZXJ2aWNlKTtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblxuXHRcdGlmIChlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvcikge1xuXHRcdFx0bGF5b3V0U2VydmljZS5zZXRQYXJ0SGlkZGVuKHRydWUsIFBhcnRzLlNJREVCQVJfUEFSVCk7XG5cdFx0XHRsYXlvdXRTZXJ2aWNlLnNldFBhcnRIaWRkZW4odHJ1ZSwgUGFydHMuQVVYSUxJQVJZQkFSX1BBUlQpO1xuXHRcdFx0ZWRpdG9yR3JvdXBTZXJ2aWNlLmFycmFuZ2VHcm91cHMoR3JvdXBzQXJyYW5nZW1lbnQuTUFYSU1JWkUpO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVG9nZ2xlTWF4aW1pemVFZGl0b3JHcm91cEFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBUT0dHTEVfTUFYSU1JWkVfRURJVE9SX0dST1VQLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMigndG9nZ2xlTWF4aW1pemVFZGl0b3JHcm91cCcsICdUb2dnbGUgTWF4aW1pemUgRWRpdG9yIEdyb3VwJyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXcsXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLm9yKEVkaXRvclBhcnRNdWx0aXBsZUVkaXRvckdyb3Vwc0NvbnRleHQsIEVkaXRvclBhcnRNYXhpbWl6ZWRFZGl0b3JHcm91cENvbnRleHQpLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlNKSxcblx0XHRcdH0sXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTWVudUlkLkVkaXRvclRpdGxlLFxuXHRcdFx0XHRvcmRlcjogLTEwMDAwLCAvLyB0b3dhcmRzIHRoZSBmcm9udFxuXHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHR3aGVuOiBFZGl0b3JQYXJ0TWF4aW1pemVkRWRpdG9yR3JvdXBDb250ZXh0XG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogTWVudUlkLkVtcHR5RWRpdG9yR3JvdXAsXG5cdFx0XHRcdG9yZGVyOiAtMTAwMDAsIC8vIHRvd2FyZHMgdGhlIGZyb250XG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdHdoZW46IEVkaXRvclBhcnRNYXhpbWl6ZWRFZGl0b3JHcm91cENvbnRleHRcblx0XHRcdH1dLFxuXHRcdFx0aWNvbjogQ29kaWNvbi5zY3JlZW5GdWxsLFxuXHRcdFx0dG9nZ2xlZDogRWRpdG9yUGFydE1heGltaXplZEVkaXRvckdyb3VwQ29udGV4dCxcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogdW5rbm93bltdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZWRpdG9yR3JvdXBzU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSk7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0Y29uc3QgbGlzdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxpc3RTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IHJlc29sdmVkQ29udGV4dCA9IHJlc29sdmVDb21tYW5kc0NvbnRleHQoYXJncywgZWRpdG9yU2VydmljZSwgZWRpdG9yR3JvdXBzU2VydmljZSwgbGlzdFNlcnZpY2UpO1xuXHRcdGlmIChyZXNvbHZlZENvbnRleHQuZ3JvdXBlZEVkaXRvcnMubGVuZ3RoKSB7XG5cdFx0XHRlZGl0b3JHcm91cHNTZXJ2aWNlLnRvZ2dsZU1heGltaXplR3JvdXAocmVzb2x2ZWRDb250ZXh0Lmdyb3VwZWRFZGl0b3JzWzBdLmdyb3VwKTtcblx0XHR9XG5cdH1cbn1cblxuYWJzdHJhY3QgY2xhc3MgQWJzdHJhY3ROYXZpZ2F0ZUVkaXRvckFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGVkaXRvckdyb3VwU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSk7XG5cblx0XHRjb25zdCByZXN1bHQgPSB0aGlzLm5hdmlnYXRlKGVkaXRvckdyb3VwU2VydmljZSk7XG5cdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB7IGdyb3VwSWQsIGVkaXRvciB9ID0gcmVzdWx0O1xuXHRcdGlmICghZWRpdG9yKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZ3JvdXAgPSBlZGl0b3JHcm91cFNlcnZpY2UuZ2V0R3JvdXAoZ3JvdXBJZCk7XG5cdFx0aWYgKGdyb3VwKSB7XG5cdFx0XHRhd2FpdCBncm91cC5vcGVuRWRpdG9yKGVkaXRvcik7XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIGFic3RyYWN0IG5hdmlnYXRlKGVkaXRvckdyb3VwU2VydmljZTogSUVkaXRvckdyb3Vwc1NlcnZpY2UpOiBJRWRpdG9ySWRlbnRpZmllciB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGNsYXNzIE9wZW5OZXh0RWRpdG9yIGV4dGVuZHMgQWJzdHJhY3ROYXZpZ2F0ZUVkaXRvckFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLm5leHRFZGl0b3InLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignb3Blbk5leHRFZGl0b3InLCAnT3BlbiBOZXh0IEVkaXRvcicpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuUGFnZURvd24sXG5cdFx0XHRcdG1hYzoge1xuXHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLkFsdCB8IEtleUNvZGUuUmlnaHRBcnJvdyxcblx0XHRcdFx0XHRzZWNvbmRhcnk6IFtLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuQnJhY2tldFJpZ2h0XVxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlld1xuXHRcdH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIG5hdmlnYXRlKGVkaXRvckdyb3VwU2VydmljZTogSUVkaXRvckdyb3Vwc1NlcnZpY2UpOiBJRWRpdG9ySWRlbnRpZmllciB8IHVuZGVmaW5lZCB7XG5cblx0XHQvLyBOYXZpZ2F0ZSBpbiBhY3RpdmUgZ3JvdXAgaWYgcG9zc2libGVcblx0XHRjb25zdCBhY3RpdmVHcm91cCA9IGVkaXRvckdyb3VwU2VydmljZS5hY3RpdmVHcm91cDtcblx0XHRjb25zdCBhY3RpdmVHcm91cEVkaXRvcnMgPSBhY3RpdmVHcm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKTtcblx0XHRjb25zdCBhY3RpdmVFZGl0b3JJbmRleCA9IGFjdGl2ZUdyb3VwLmFjdGl2ZUVkaXRvciA/IGFjdGl2ZUdyb3VwRWRpdG9ycy5pbmRleE9mKGFjdGl2ZUdyb3VwLmFjdGl2ZUVkaXRvcikgOiAtMTtcblx0XHRpZiAoYWN0aXZlRWRpdG9ySW5kZXggKyAxIDwgYWN0aXZlR3JvdXBFZGl0b3JzLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIHsgZWRpdG9yOiBhY3RpdmVHcm91cEVkaXRvcnNbYWN0aXZlRWRpdG9ySW5kZXggKyAxXSwgZ3JvdXBJZDogYWN0aXZlR3JvdXAuaWQgfTtcblx0XHR9XG5cblx0XHQvLyBPdGhlcndpc2UgdHJ5IGluIG5leHQgZ3JvdXAgdGhhdCBoYXMgZWRpdG9yc1xuXHRcdGNvbnN0IGhhbmRsZWRHcm91cHMgPSBuZXcgU2V0PG51bWJlcj4oKTtcblx0XHRsZXQgY3VycmVudEdyb3VwOiBJRWRpdG9yR3JvdXAgfCB1bmRlZmluZWQgPSBlZGl0b3JHcm91cFNlcnZpY2UuYWN0aXZlR3JvdXA7XG5cdFx0d2hpbGUgKGN1cnJlbnRHcm91cCAmJiAhaGFuZGxlZEdyb3Vwcy5oYXMoY3VycmVudEdyb3VwLmlkKSkge1xuXHRcdFx0Y3VycmVudEdyb3VwID0gZWRpdG9yR3JvdXBTZXJ2aWNlLmZpbmRHcm91cCh7IGxvY2F0aW9uOiBHcm91cExvY2F0aW9uLk5FWFQgfSwgY3VycmVudEdyb3VwLCB0cnVlKTtcblx0XHRcdGlmIChjdXJyZW50R3JvdXApIHtcblx0XHRcdFx0aGFuZGxlZEdyb3Vwcy5hZGQoY3VycmVudEdyb3VwLmlkKTtcblxuXHRcdFx0XHRjb25zdCBncm91cEVkaXRvcnMgPSBjdXJyZW50R3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTCk7XG5cdFx0XHRcdGlmIChncm91cEVkaXRvcnMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdHJldHVybiB7IGVkaXRvcjogZ3JvdXBFZGl0b3JzWzBdLCBncm91cElkOiBjdXJyZW50R3JvdXAuaWQgfTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE9wZW5QcmV2aW91c0VkaXRvciBleHRlbmRzIEFic3RyYWN0TmF2aWdhdGVFZGl0b3JBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5wcmV2aW91c0VkaXRvcicsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdvcGVuUHJldmlvdXNFZGl0b3InLCAnT3BlbiBQcmV2aW91cyBFZGl0b3InKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLlBhZ2VVcCxcblx0XHRcdFx0bWFjOiB7XG5cdFx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5MZWZ0QXJyb3csXG5cdFx0XHRcdFx0c2Vjb25kYXJ5OiBbS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkJyYWNrZXRMZWZ0XVxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlld1xuXHRcdH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIG5hdmlnYXRlKGVkaXRvckdyb3VwU2VydmljZTogSUVkaXRvckdyb3Vwc1NlcnZpY2UpOiBJRWRpdG9ySWRlbnRpZmllciB8IHVuZGVmaW5lZCB7XG5cblx0XHQvLyBOYXZpZ2F0ZSBpbiBhY3RpdmUgZ3JvdXAgaWYgcG9zc2libGVcblx0XHRjb25zdCBhY3RpdmVHcm91cCA9IGVkaXRvckdyb3VwU2VydmljZS5hY3RpdmVHcm91cDtcblx0XHRjb25zdCBhY3RpdmVHcm91cEVkaXRvcnMgPSBhY3RpdmVHcm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKTtcblx0XHRjb25zdCBhY3RpdmVFZGl0b3JJbmRleCA9IGFjdGl2ZUdyb3VwLmFjdGl2ZUVkaXRvciA/IGFjdGl2ZUdyb3VwRWRpdG9ycy5pbmRleE9mKGFjdGl2ZUdyb3VwLmFjdGl2ZUVkaXRvcikgOiAtMTtcblx0XHRpZiAoYWN0aXZlRWRpdG9ySW5kZXggPiAwKSB7XG5cdFx0XHRyZXR1cm4geyBlZGl0b3I6IGFjdGl2ZUdyb3VwRWRpdG9yc1thY3RpdmVFZGl0b3JJbmRleCAtIDFdLCBncm91cElkOiBhY3RpdmVHcm91cC5pZCB9O1xuXHRcdH1cblxuXHRcdC8vIE90aGVyd2lzZSB0cnkgaW4gcHJldmlvdXMgZ3JvdXAgdGhhdCBoYXMgZWRpdG9yc1xuXHRcdGNvbnN0IGhhbmRsZWRHcm91cHMgPSBuZXcgU2V0PG51bWJlcj4oKTtcblx0XHRsZXQgY3VycmVudEdyb3VwOiBJRWRpdG9yR3JvdXAgfCB1bmRlZmluZWQgPSBlZGl0b3JHcm91cFNlcnZpY2UuYWN0aXZlR3JvdXA7XG5cdFx0d2hpbGUgKGN1cnJlbnRHcm91cCAmJiAhaGFuZGxlZEdyb3Vwcy5oYXMoY3VycmVudEdyb3VwLmlkKSkge1xuXHRcdFx0Y3VycmVudEdyb3VwID0gZWRpdG9yR3JvdXBTZXJ2aWNlLmZpbmRHcm91cCh7IGxvY2F0aW9uOiBHcm91cExvY2F0aW9uLlBSRVZJT1VTIH0sIGN1cnJlbnRHcm91cCwgdHJ1ZSk7XG5cdFx0XHRpZiAoY3VycmVudEdyb3VwKSB7XG5cdFx0XHRcdGhhbmRsZWRHcm91cHMuYWRkKGN1cnJlbnRHcm91cC5pZCk7XG5cblx0XHRcdFx0Y29uc3QgZ3JvdXBFZGl0b3JzID0gY3VycmVudEdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwpO1xuXHRcdFx0XHRpZiAoZ3JvdXBFZGl0b3JzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRyZXR1cm4geyBlZGl0b3I6IGdyb3VwRWRpdG9yc1tncm91cEVkaXRvcnMubGVuZ3RoIC0gMV0sIGdyb3VwSWQ6IGN1cnJlbnRHcm91cC5pZCB9O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgT3Blbk5leHRFZGl0b3JJbkdyb3VwIGV4dGVuZHMgQWJzdHJhY3ROYXZpZ2F0ZUVkaXRvckFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLm5leHRFZGl0b3JJbkdyb3VwJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ25leHRFZGl0b3JJbkdyb3VwJywgJ09wZW4gTmV4dCBFZGl0b3IgaW4gR3JvdXAnKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5QYWdlRG93biksXG5cdFx0XHRcdG1hYzoge1xuXHRcdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5BbHQgfCBLZXlDb2RlLlJpZ2h0QXJyb3cpXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3XG5cdFx0fSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgbmF2aWdhdGUoZWRpdG9yR3JvdXBTZXJ2aWNlOiBJRWRpdG9yR3JvdXBzU2VydmljZSk6IElFZGl0b3JJZGVudGlmaWVyIHtcblx0XHRjb25zdCBncm91cCA9IGVkaXRvckdyb3VwU2VydmljZS5hY3RpdmVHcm91cDtcblx0XHRjb25zdCBlZGl0b3JzID0gZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTCk7XG5cdFx0Y29uc3QgaW5kZXggPSBncm91cC5hY3RpdmVFZGl0b3IgPyBlZGl0b3JzLmluZGV4T2YoZ3JvdXAuYWN0aXZlRWRpdG9yKSA6IC0xO1xuXG5cdFx0cmV0dXJuIHsgZWRpdG9yOiBpbmRleCArIDEgPCBlZGl0b3JzLmxlbmd0aCA/IGVkaXRvcnNbaW5kZXggKyAxXSA6IGVkaXRvcnNbMF0sIGdyb3VwSWQ6IGdyb3VwLmlkIH07XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE9wZW5QcmV2aW91c0VkaXRvckluR3JvdXAgZXh0ZW5kcyBBYnN0cmFjdE5hdmlnYXRlRWRpdG9yQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ucHJldmlvdXNFZGl0b3JJbkdyb3VwJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ29wZW5QcmV2aW91c0VkaXRvckluR3JvdXAnLCAnT3BlbiBQcmV2aW91cyBFZGl0b3IgaW4gR3JvdXAnKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5QYWdlVXApLFxuXHRcdFx0XHRtYWM6IHtcblx0XHRcdFx0XHRwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5MZWZ0QXJyb3cpXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3XG5cdFx0fSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgbmF2aWdhdGUoZWRpdG9yR3JvdXBTZXJ2aWNlOiBJRWRpdG9yR3JvdXBzU2VydmljZSk6IElFZGl0b3JJZGVudGlmaWVyIHtcblx0XHRjb25zdCBncm91cCA9IGVkaXRvckdyb3VwU2VydmljZS5hY3RpdmVHcm91cDtcblx0XHRjb25zdCBlZGl0b3JzID0gZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTCk7XG5cdFx0Y29uc3QgaW5kZXggPSBncm91cC5hY3RpdmVFZGl0b3IgPyBlZGl0b3JzLmluZGV4T2YoZ3JvdXAuYWN0aXZlRWRpdG9yKSA6IC0xO1xuXG5cdFx0cmV0dXJuIHsgZWRpdG9yOiBpbmRleCA+IDAgPyBlZGl0b3JzW2luZGV4IC0gMV0gOiBlZGl0b3JzW2VkaXRvcnMubGVuZ3RoIC0gMV0sIGdyb3VwSWQ6IGdyb3VwLmlkIH07XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE9wZW5GaXJzdEVkaXRvckluR3JvdXAgZXh0ZW5kcyBBYnN0cmFjdE5hdmlnYXRlRWRpdG9yQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uZmlyc3RFZGl0b3JJbkdyb3VwJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2ZpcnN0RWRpdG9ySW5Hcm91cCcsICdPcGVuIEZpcnN0IEVkaXRvciBpbiBHcm91cCcpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3XG5cdFx0fSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgbmF2aWdhdGUoZWRpdG9yR3JvdXBTZXJ2aWNlOiBJRWRpdG9yR3JvdXBzU2VydmljZSk6IElFZGl0b3JJZGVudGlmaWVyIHtcblx0XHRjb25zdCBncm91cCA9IGVkaXRvckdyb3VwU2VydmljZS5hY3RpdmVHcm91cDtcblx0XHRjb25zdCBlZGl0b3JzID0gZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTCk7XG5cblx0XHRyZXR1cm4geyBlZGl0b3I6IGVkaXRvcnNbMF0sIGdyb3VwSWQ6IGdyb3VwLmlkIH07XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE9wZW5MYXN0RWRpdG9ySW5Hcm91cCBleHRlbmRzIEFic3RyYWN0TmF2aWdhdGVFZGl0b3JBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5sYXN0RWRpdG9ySW5Hcm91cCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdsYXN0RWRpdG9ySW5Hcm91cCcsICdPcGVuIExhc3QgRWRpdG9yIGluIEdyb3VwJyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5BbHQgfCBLZXlDb2RlLkRpZ2l0MCxcblx0XHRcdFx0c2Vjb25kYXJ5OiBbS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkRpZ2l0OV0sXG5cdFx0XHRcdG1hYzoge1xuXHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5XaW5DdHJsIHwgS2V5Q29kZS5EaWdpdDAsXG5cdFx0XHRcdFx0c2Vjb25kYXJ5OiBbS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkRpZ2l0OV1cblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXdcblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBuYXZpZ2F0ZShlZGl0b3JHcm91cFNlcnZpY2U6IElFZGl0b3JHcm91cHNTZXJ2aWNlKTogSUVkaXRvcklkZW50aWZpZXIge1xuXHRcdGNvbnN0IGdyb3VwID0gZWRpdG9yR3JvdXBTZXJ2aWNlLmFjdGl2ZUdyb3VwO1xuXHRcdGNvbnN0IGVkaXRvcnMgPSBncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKTtcblxuXHRcdHJldHVybiB7IGVkaXRvcjogZWRpdG9yc1tlZGl0b3JzLmxlbmd0aCAtIDFdLCBncm91cElkOiBncm91cC5pZCB9O1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBOYXZpZ2F0ZUZvcndhcmRBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5uYXZpZ2F0ZUZvcndhcmQnO1xuXHRzdGF0aWMgcmVhZG9ubHkgTEFCRUwgPSBsb2NhbGl6ZSgnbmF2aWdhdGVGb3J3YXJkJywgXCJHbyBGb3J3YXJkXCIpO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBOYXZpZ2F0ZUZvcndhcmRBY3Rpb24uSUQsXG5cdFx0XHR0aXRsZToge1xuXHRcdFx0XHQuLi5sb2NhbGl6ZTIoJ25hdmlnYXRlRm9yd2FyZCcsIFwiR28gRm9yd2FyZFwiKSxcblx0XHRcdFx0bW5lbW9uaWNUaXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaUZvcndhcmQnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZGb3J3YXJkXCIpXG5cdFx0XHR9LFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRpY29uOiBDb2RpY29uLmFycm93UmlnaHQsXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmhhcygnY2FuTmF2aWdhdGVGb3J3YXJkJyksXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHR3aW46IHsgcHJpbWFyeTogS2V5TW9kLkFsdCB8IEtleUNvZGUuUmlnaHRBcnJvdywgc2Vjb25kYXJ5OiBbS2V5Q29kZS5Ccm93c2VyRm9yd2FyZF0gfSxcblx0XHRcdFx0bWFjOiB7IHByaW1hcnk6IEtleU1vZC5XaW5DdHJsIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5NaW51cywgc2Vjb25kYXJ5OiBbS2V5Q29kZS5Ccm93c2VyRm9yd2FyZF0gfSxcblx0XHRcdFx0bGludXg6IHsgcHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLk1pbnVzLCBzZWNvbmRhcnk6IFtLZXlDb2RlLkJyb3dzZXJGb3J3YXJkXSB9XG5cdFx0XHR9LFxuXHRcdFx0bWVudTogW1xuXHRcdFx0XHR7IGlkOiBNZW51SWQuTWVudWJhckdvTWVudSwgZ3JvdXA6ICcxX2hpc3RvcnlfbmF2Jywgb3JkZXI6IDIgfSxcblx0XHRcdFx0eyBpZDogTWVudUlkLkNvbW1hbmRDZW50ZXIsIG9yZGVyOiAyLCB3aGVuOiBDb250ZXh0S2V5RXhwci5oYXMoJ2NvbmZpZy53b3JrYmVuY2gubmF2aWdhdGlvbkNvbnRyb2wuZW5hYmxlZCcpIH1cblx0XHRcdF1cblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGhpc3RvcnlTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElIaXN0b3J5U2VydmljZSk7XG5cblx0XHRhd2FpdCBoaXN0b3J5U2VydmljZS5nb0ZvcndhcmQoR29GaWx0ZXIuTk9ORSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE5hdmlnYXRlQmFja3dhcmRzQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5hY3Rpb24ubmF2aWdhdGVCYWNrJztcblx0c3RhdGljIHJlYWRvbmx5IExBQkVMID0gbG9jYWxpemUoJ25hdmlnYXRlQmFjaycsIFwiR28gQmFja1wiKTtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogTmF2aWdhdGVCYWNrd2FyZHNBY3Rpb24uSUQsXG5cdFx0XHR0aXRsZToge1xuXHRcdFx0XHQuLi5sb2NhbGl6ZTIoJ25hdmlnYXRlQmFjaycsIFwiR28gQmFja1wiKSxcblx0XHRcdFx0bW5lbW9uaWNUaXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaUJhY2snLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZCYWNrXCIpXG5cdFx0XHR9LFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmhhcygnY2FuTmF2aWdhdGVCYWNrJyksXG5cdFx0XHRpY29uOiBDb2RpY29uLmFycm93TGVmdCxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHdpbjogeyBwcmltYXJ5OiBLZXlNb2QuQWx0IHwgS2V5Q29kZS5MZWZ0QXJyb3csIHNlY29uZGFyeTogW0tleUNvZGUuQnJvd3NlckJhY2tdIH0sXG5cdFx0XHRcdG1hYzogeyBwcmltYXJ5OiBLZXlNb2QuV2luQ3RybCB8IEtleUNvZGUuTWludXMsIHNlY29uZGFyeTogW0tleUNvZGUuQnJvd3NlckJhY2tdIH0sXG5cdFx0XHRcdGxpbnV4OiB7IHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLkFsdCB8IEtleUNvZGUuTWludXMsIHNlY29uZGFyeTogW0tleUNvZGUuQnJvd3NlckJhY2tdIH1cblx0XHRcdH0sXG5cdFx0XHRtZW51OiBbXG5cdFx0XHRcdHsgaWQ6IE1lbnVJZC5NZW51YmFyR29NZW51LCBncm91cDogJzFfaGlzdG9yeV9uYXYnLCBvcmRlcjogMSB9LFxuXHRcdFx0XHR7IGlkOiBNZW51SWQuQ29tbWFuZENlbnRlciwgb3JkZXI6IDEsIHdoZW46IENvbnRleHRLZXlFeHByLmhhcygnY29uZmlnLndvcmtiZW5jaC5uYXZpZ2F0aW9uQ29udHJvbC5lbmFibGVkJykgfVxuXHRcdFx0XVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgaGlzdG9yeVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUhpc3RvcnlTZXJ2aWNlKTtcblxuXHRcdGF3YWl0IGhpc3RvcnlTZXJ2aWNlLmdvQmFjayhHb0ZpbHRlci5OT05FKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTmF2aWdhdGVQcmV2aW91c0FjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5uYXZpZ2F0ZUxhc3QnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignbmF2aWdhdGVQcmV2aW91cycsICdHbyBQcmV2aW91cycpLFxuXHRcdFx0ZjE6IHRydWVcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGhpc3RvcnlTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElIaXN0b3J5U2VydmljZSk7XG5cblx0XHRhd2FpdCBoaXN0b3J5U2VydmljZS5nb1ByZXZpb3VzKEdvRmlsdGVyLk5PTkUpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBOYXZpZ2F0ZUZvcndhcmRJbkVkaXRzQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLm5hdmlnYXRlRm9yd2FyZEluRWRpdExvY2F0aW9ucycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCduYXZpZ2F0ZUZvcndhcmRJbkVkaXRzJywgJ0dvIEZvcndhcmQgaW4gRWRpdCBMb2NhdGlvbnMnKSxcblx0XHRcdGYxOiB0cnVlXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBoaXN0b3J5U2VydmljZSA9IGFjY2Vzc29yLmdldChJSGlzdG9yeVNlcnZpY2UpO1xuXG5cdFx0YXdhaXQgaGlzdG9yeVNlcnZpY2UuZ29Gb3J3YXJkKEdvRmlsdGVyLkVESVRTKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTmF2aWdhdGVCYWNrd2FyZHNJbkVkaXRzQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLm5hdmlnYXRlQmFja0luRWRpdExvY2F0aW9ucycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCduYXZpZ2F0ZUJhY2tJbkVkaXRzJywgJ0dvIEJhY2sgaW4gRWRpdCBMb2NhdGlvbnMnKSxcblx0XHRcdGYxOiB0cnVlXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBoaXN0b3J5U2VydmljZSA9IGFjY2Vzc29yLmdldChJSGlzdG9yeVNlcnZpY2UpO1xuXG5cdFx0YXdhaXQgaGlzdG9yeVNlcnZpY2UuZ29CYWNrKEdvRmlsdGVyLkVESVRTKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTmF2aWdhdGVQcmV2aW91c0luRWRpdHNBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ubmF2aWdhdGVQcmV2aW91c0luRWRpdExvY2F0aW9ucycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCduYXZpZ2F0ZVByZXZpb3VzSW5FZGl0cycsICdHbyBQcmV2aW91cyBpbiBFZGl0IExvY2F0aW9ucycpLFxuXHRcdFx0ZjE6IHRydWVcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGhpc3RvcnlTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElIaXN0b3J5U2VydmljZSk7XG5cblx0XHRhd2FpdCBoaXN0b3J5U2VydmljZS5nb1ByZXZpb3VzKEdvRmlsdGVyLkVESVRTKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTmF2aWdhdGVUb0xhc3RFZGl0TG9jYXRpb25BY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ubmF2aWdhdGVUb0xhc3RFZGl0TG9jYXRpb24nLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignbmF2aWdhdGVUb0xhc3RFZGl0TG9jYXRpb24nLCAnR28gdG8gTGFzdCBFZGl0IExvY2F0aW9uJyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5USlcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGhpc3RvcnlTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElIaXN0b3J5U2VydmljZSk7XG5cblx0XHRhd2FpdCBoaXN0b3J5U2VydmljZS5nb0xhc3QoR29GaWx0ZXIuRURJVFMpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBOYXZpZ2F0ZUZvcndhcmRJbk5hdmlnYXRpb25zQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLm5hdmlnYXRlRm9yd2FyZEluTmF2aWdhdGlvbkxvY2F0aW9ucycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCduYXZpZ2F0ZUZvcndhcmRJbk5hdmlnYXRpb25zJywgJ0dvIEZvcndhcmQgaW4gTmF2aWdhdGlvbiBMb2NhdGlvbnMnKSxcblx0XHRcdGYxOiB0cnVlXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBoaXN0b3J5U2VydmljZSA9IGFjY2Vzc29yLmdldChJSGlzdG9yeVNlcnZpY2UpO1xuXG5cdFx0YXdhaXQgaGlzdG9yeVNlcnZpY2UuZ29Gb3J3YXJkKEdvRmlsdGVyLk5BVklHQVRJT04pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBOYXZpZ2F0ZUJhY2t3YXJkc0luTmF2aWdhdGlvbnNBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ubmF2aWdhdGVCYWNrSW5OYXZpZ2F0aW9uTG9jYXRpb25zJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ25hdmlnYXRlQmFja0luTmF2aWdhdGlvbnMnLCAnR28gQmFjayBpbiBOYXZpZ2F0aW9uIExvY2F0aW9ucycpLFxuXHRcdFx0ZjE6IHRydWVcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGhpc3RvcnlTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElIaXN0b3J5U2VydmljZSk7XG5cblx0XHRhd2FpdCBoaXN0b3J5U2VydmljZS5nb0JhY2soR29GaWx0ZXIuTkFWSUdBVElPTik7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE5hdmlnYXRlUHJldmlvdXNJbk5hdmlnYXRpb25zQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLm5hdmlnYXRlUHJldmlvdXNJbk5hdmlnYXRpb25Mb2NhdGlvbnMnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignbmF2aWdhdGVQcmV2aW91c0luTmF2aWdhdGlvbkxvY2F0aW9ucycsICdHbyBQcmV2aW91cyBpbiBOYXZpZ2F0aW9uIExvY2F0aW9ucycpLFxuXHRcdFx0ZjE6IHRydWVcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGhpc3RvcnlTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElIaXN0b3J5U2VydmljZSk7XG5cblx0XHRhd2FpdCBoaXN0b3J5U2VydmljZS5nb1ByZXZpb3VzKEdvRmlsdGVyLk5BVklHQVRJT04pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBOYXZpZ2F0ZVRvTGFzdE5hdmlnYXRpb25Mb2NhdGlvbkFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5uYXZpZ2F0ZVRvTGFzdE5hdmlnYXRpb25Mb2NhdGlvbicsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCduYXZpZ2F0ZVRvTGFzdE5hdmlnYXRpb25Mb2NhdGlvbicsICdHbyB0byBMYXN0IE5hdmlnYXRpb24gTG9jYXRpb24nKSxcblx0XHRcdGYxOiB0cnVlXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBoaXN0b3J5U2VydmljZSA9IGFjY2Vzc29yLmdldChJSGlzdG9yeVNlcnZpY2UpO1xuXG5cdFx0YXdhaXQgaGlzdG9yeVNlcnZpY2UuZ29MYXN0KEdvRmlsdGVyLk5BVklHQVRJT04pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBSZW9wZW5DbG9zZWRFZGl0b3JBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5yZW9wZW5DbG9zZWRFZGl0b3InO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBSZW9wZW5DbG9zZWRFZGl0b3JBY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdyZW9wZW5DbG9zZWRFZGl0b3InLCAnUmVvcGVuIENsb3NlZCBFZGl0b3InKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLktleVRcblx0XHRcdH0sXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3XG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBoaXN0b3J5U2VydmljZSA9IGFjY2Vzc29yLmdldChJSGlzdG9yeVNlcnZpY2UpO1xuXG5cdFx0YXdhaXQgaGlzdG9yeVNlcnZpY2UucmVvcGVuTGFzdENsb3NlZEVkaXRvcigpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDbGVhclJlY2VudEZpbGVzQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5hY3Rpb24uY2xlYXJSZWNlbnRGaWxlcyc7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IENsZWFyUmVjZW50RmlsZXNBY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdjbGVhclJlY2VudEZpbGVzJywgJ0NsZWFyIFJlY2VudGx5IE9wZW5lZC4uLicpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5GaWxlXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBkaWFsb2dTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEaWFsb2dTZXJ2aWNlKTtcblx0XHRjb25zdCB3b3Jrc3BhY2VzU2VydmljZSA9IGFjY2Vzc29yLmdldChJV29ya3NwYWNlc1NlcnZpY2UpO1xuXHRcdGNvbnN0IGhpc3RvcnlTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElIaXN0b3J5U2VydmljZSk7XG5cblx0XHQvLyBBc2sgZm9yIGNvbmZpcm1hdGlvblxuXHRcdGNvbnN0IHsgY29uZmlybWVkIH0gPSBhd2FpdCBkaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0dHlwZTogJ3dhcm5pbmcnLFxuXHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ2NvbmZpcm1DbGVhclJlY2VudHNNZXNzYWdlJywgXCJEbyB5b3Ugd2FudCB0byBjbGVhciBhbGwgcmVjZW50bHkgb3BlbmVkIGZpbGVzIGFuZCB3b3Jrc3BhY2VzP1wiKSxcblx0XHRcdGRldGFpbDogbG9jYWxpemUoJ2NvbmZpcm1DbGVhckRldGFpbCcsIFwiVGhpcyBhY3Rpb24gaXMgaXJyZXZlcnNpYmxlIVwiKSxcblx0XHRcdHByaW1hcnlCdXR0b246IGxvY2FsaXplKHsga2V5OiAnY2xlYXJCdXR0b25MYWJlbCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJkNsZWFyXCIpXG5cdFx0fSk7XG5cblx0XHRpZiAoIWNvbmZpcm1lZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIENsZWFyIGdsb2JhbCByZWNlbnRseSBvcGVuZWRcblx0XHR3b3Jrc3BhY2VzU2VydmljZS5jbGVhclJlY2VudGx5T3BlbmVkKCk7XG5cblx0XHQvLyBDbGVhciB3b3Jrc3BhY2Ugc3BlY2lmaWMgcmVjZW50bHkgb3BlbmVkXG5cdFx0aGlzdG9yeVNlcnZpY2UuY2xlYXJSZWNlbnRseU9wZW5lZCgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTaG93RWRpdG9yc0luQWN0aXZlR3JvdXBCeU1vc3RSZWNlbnRseVVzZWRBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5zaG93RWRpdG9yc0luQWN0aXZlR3JvdXAnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBTaG93RWRpdG9yc0luQWN0aXZlR3JvdXBCeU1vc3RSZWNlbnRseVVzZWRBY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdzaG93RWRpdG9yc0luQWN0aXZlR3JvdXAnLCAnU2hvdyBFZGl0b3JzIGluIEFjdGl2ZSBHcm91cCBCeSBNb3N0IFJlY2VudGx5IFVzZWQnKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlld1xuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcXVpY2tJbnB1dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVF1aWNrSW5wdXRTZXJ2aWNlKTtcblxuXHRcdHF1aWNrSW5wdXRTZXJ2aWNlLnF1aWNrQWNjZXNzLnNob3coQWN0aXZlR3JvdXBFZGl0b3JzQnlNb3N0UmVjZW50bHlVc2VkUXVpY2tBY2Nlc3MuUFJFRklYKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU2hvd0FsbEVkaXRvcnNCeUFwcGVhcmFuY2VBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5zaG93QWxsRWRpdG9ycyc7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFNob3dBbGxFZGl0b3JzQnlBcHBlYXJhbmNlQWN0aW9uLklELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignc2hvd0FsbEVkaXRvcnMnLCAnU2hvdyBBbGwgRWRpdG9ycyBCeSBBcHBlYXJhbmNlJyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5UCksXG5cdFx0XHRcdG1hYzoge1xuXHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLkFsdCB8IEtleUNvZGUuVGFiXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5GaWxlXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBxdWlja0lucHV0U2VydmljZSA9IGFjY2Vzc29yLmdldChJUXVpY2tJbnB1dFNlcnZpY2UpO1xuXG5cdFx0cXVpY2tJbnB1dFNlcnZpY2UucXVpY2tBY2Nlc3Muc2hvdyhBbGxFZGl0b3JzQnlBcHBlYXJhbmNlUXVpY2tBY2Nlc3MuUFJFRklYKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU2hvd0FsbEVkaXRvcnNCeU1vc3RSZWNlbnRseVVzZWRBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5zaG93QWxsRWRpdG9yc0J5TW9zdFJlY2VudGx5VXNlZCc7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFNob3dBbGxFZGl0b3JzQnlNb3N0UmVjZW50bHlVc2VkQWN0aW9uLklELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignc2hvd0FsbEVkaXRvcnNCeU1vc3RSZWNlbnRseVVzZWQnLCAnU2hvdyBBbGwgRWRpdG9ycyBCeSBNb3N0IFJlY2VudGx5IFVzZWQnKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlld1xuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcXVpY2tJbnB1dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVF1aWNrSW5wdXRTZXJ2aWNlKTtcblxuXHRcdHF1aWNrSW5wdXRTZXJ2aWNlLnF1aWNrQWNjZXNzLnNob3coQWxsRWRpdG9yc0J5TW9zdFJlY2VudGx5VXNlZFF1aWNrQWNjZXNzLlBSRUZJWCk7XG5cdH1cbn1cblxuYWJzdHJhY3QgY2xhc3MgQWJzdHJhY3RRdWlja0FjY2Vzc0VkaXRvckFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGRlc2M6IFJlYWRvbmx5PElBY3Rpb24yT3B0aW9ucz4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBwcmVmaXg6IHN0cmluZyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGl0ZW1BY3RpdmF0aW9uOiBJdGVtQWN0aXZhdGlvbiB8IHVuZGVmaW5lZCxcblx0KSB7XG5cdFx0c3VwZXIoZGVzYyk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBrZXliaW5kaW5nU2VydmljZSA9IGFjY2Vzc29yLmdldChJS2V5YmluZGluZ1NlcnZpY2UpO1xuXHRcdGNvbnN0IHF1aWNrSW5wdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElRdWlja0lucHV0U2VydmljZSk7XG5cblx0XHRjb25zdCBrZXliaW5kaW5ncyA9IGtleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmdzKHRoaXMuZGVzYy5pZCk7XG5cblx0XHRxdWlja0lucHV0U2VydmljZS5xdWlja0FjY2Vzcy5zaG93KHRoaXMucHJlZml4LCB7XG5cdFx0XHRxdWlja05hdmlnYXRlQ29uZmlndXJhdGlvbjogeyBrZXliaW5kaW5ncyB9LFxuXHRcdFx0aXRlbUFjdGl2YXRpb246IHRoaXMuaXRlbUFjdGl2YXRpb25cblx0XHR9KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUXVpY2tBY2Nlc3NQcmV2aW91c1JlY2VudGx5VXNlZEVkaXRvckFjdGlvbiBleHRlbmRzIEFic3RyYWN0UXVpY2tBY2Nlc3NFZGl0b3JBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5xdWlja09wZW5QcmV2aW91c1JlY2VudGx5VXNlZEVkaXRvcicsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdxdWlja09wZW5QcmV2aW91c1JlY2VudGx5VXNlZEVkaXRvcicsICdRdWljayBPcGVuIFByZXZpb3VzIFJlY2VudGx5IFVzZWQgRWRpdG9yJyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXdcblx0XHR9LCBBbGxFZGl0b3JzQnlNb3N0UmVjZW50bHlVc2VkUXVpY2tBY2Nlc3MuUFJFRklYLCB1bmRlZmluZWQpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBRdWlja0FjY2Vzc0xlYXN0UmVjZW50bHlVc2VkRWRpdG9yQWN0aW9uIGV4dGVuZHMgQWJzdHJhY3RRdWlja0FjY2Vzc0VkaXRvckFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLnF1aWNrT3BlbkxlYXN0UmVjZW50bHlVc2VkRWRpdG9yJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3F1aWNrT3BlbkxlYXN0UmVjZW50bHlVc2VkRWRpdG9yJywgJ1F1aWNrIE9wZW4gTGVhc3QgUmVjZW50bHkgVXNlZCBFZGl0b3InKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlld1xuXHRcdH0sIEFsbEVkaXRvcnNCeU1vc3RSZWNlbnRseVVzZWRRdWlja0FjY2Vzcy5QUkVGSVgsIHVuZGVmaW5lZCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFF1aWNrQWNjZXNzUHJldmlvdXNSZWNlbnRseVVzZWRFZGl0b3JJbkdyb3VwQWN0aW9uIGV4dGVuZHMgQWJzdHJhY3RRdWlja0FjY2Vzc0VkaXRvckFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLnF1aWNrT3BlblByZXZpb3VzUmVjZW50bHlVc2VkRWRpdG9ySW5Hcm91cCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdxdWlja09wZW5QcmV2aW91c1JlY2VudGx5VXNlZEVkaXRvckluR3JvdXAnLCAnUXVpY2sgT3BlbiBQcmV2aW91cyBSZWNlbnRseSBVc2VkIEVkaXRvciBpbiBHcm91cCcpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuVGFiLFxuXHRcdFx0XHRtYWM6IHtcblx0XHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuV2luQ3RybCB8IEtleUNvZGUuVGFiXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRwcmVjb25kaXRpb246IEFjdGl2ZUVkaXRvckdyb3VwRW1wdHlDb250ZXh0LnRvTmVnYXRlZCgpLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlld1xuXHRcdH0sIEFjdGl2ZUdyb3VwRWRpdG9yc0J5TW9zdFJlY2VudGx5VXNlZFF1aWNrQWNjZXNzLlBSRUZJWCwgdW5kZWZpbmVkKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUXVpY2tBY2Nlc3NMZWFzdFJlY2VudGx5VXNlZEVkaXRvckluR3JvdXBBY3Rpb24gZXh0ZW5kcyBBYnN0cmFjdFF1aWNrQWNjZXNzRWRpdG9yQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ucXVpY2tPcGVuTGVhc3RSZWNlbnRseVVzZWRFZGl0b3JJbkdyb3VwJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3F1aWNrT3BlbkxlYXN0UmVjZW50bHlVc2VkRWRpdG9ySW5Hcm91cCcsICdRdWljayBPcGVuIExlYXN0IFJlY2VudGx5IFVzZWQgRWRpdG9yIGluIEdyb3VwJyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5UYWIsXG5cdFx0XHRcdG1hYzoge1xuXHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5XaW5DdHJsIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5UYWJcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHByZWNvbmRpdGlvbjogQWN0aXZlRWRpdG9yR3JvdXBFbXB0eUNvbnRleHQudG9OZWdhdGVkKCksXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3XG5cdFx0fSwgQWN0aXZlR3JvdXBFZGl0b3JzQnlNb3N0UmVjZW50bHlVc2VkUXVpY2tBY2Nlc3MuUFJFRklYLCBJdGVtQWN0aXZhdGlvbi5MQVNUKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUXVpY2tBY2Nlc3NQcmV2aW91c0VkaXRvckZyb21IaXN0b3J5QWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5vcGVuUHJldmlvdXNFZGl0b3JGcm9tSGlzdG9yeSc7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFF1aWNrQWNjZXNzUHJldmlvdXNFZGl0b3JGcm9tSGlzdG9yeUFjdGlvbi5JRCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ25hdmlnYXRlRWRpdG9ySGlzdG9yeUJ5SW5wdXQnLCAnUXVpY2sgT3BlbiBQcmV2aW91cyBFZGl0b3IgZnJvbSBIaXN0b3J5JyksXG5cdFx0XHRmMTogdHJ1ZVxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qga2V5YmluZGluZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUtleWJpbmRpbmdTZXJ2aWNlKTtcblx0XHRjb25zdCBxdWlja0lucHV0U2VydmljZSA9IGFjY2Vzc29yLmdldChJUXVpY2tJbnB1dFNlcnZpY2UpO1xuXHRcdGNvbnN0IGVkaXRvckdyb3VwU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSk7XG5cblx0XHRjb25zdCBrZXliaW5kaW5ncyA9IGtleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmdzKFF1aWNrQWNjZXNzUHJldmlvdXNFZGl0b3JGcm9tSGlzdG9yeUFjdGlvbi5JRCk7XG5cblx0XHQvLyBFbmZvcmNlIHRvIGFjdGl2YXRlIHRoZSBmaXJzdCBpdGVtIGluIHF1aWNrIGFjY2VzcyBpZlxuXHRcdC8vIHRoZSBjdXJyZW50bHkgYWN0aXZlIGVkaXRvciBncm91cCBoYXMgbiBlZGl0b3Igb3BlbmVkXG5cdFx0bGV0IGl0ZW1BY3RpdmF0aW9uOiBJdGVtQWN0aXZhdGlvbiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRpZiAoZWRpdG9yR3JvdXBTZXJ2aWNlLmFjdGl2ZUdyb3VwLmNvdW50ID09PSAwKSB7XG5cdFx0XHRpdGVtQWN0aXZhdGlvbiA9IEl0ZW1BY3RpdmF0aW9uLkZJUlNUO1xuXHRcdH1cblxuXHRcdHF1aWNrSW5wdXRTZXJ2aWNlLnF1aWNrQWNjZXNzLnNob3coJycsIHsgcXVpY2tOYXZpZ2F0ZUNvbmZpZ3VyYXRpb246IHsga2V5YmluZGluZ3MgfSwgaXRlbUFjdGl2YXRpb24gfSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE9wZW5OZXh0UmVjZW50bHlVc2VkRWRpdG9yQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLm9wZW5OZXh0UmVjZW50bHlVc2VkRWRpdG9yJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ29wZW5OZXh0UmVjZW50bHlVc2VkRWRpdG9yJywgJ09wZW4gTmV4dCBSZWNlbnRseSBVc2VkIEVkaXRvcicpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3XG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBoaXN0b3J5U2VydmljZSA9IGFjY2Vzc29yLmdldChJSGlzdG9yeVNlcnZpY2UpO1xuXG5cdFx0aGlzdG9yeVNlcnZpY2Uub3Blbk5leHRSZWNlbnRseVVzZWRFZGl0b3IoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgT3BlblByZXZpb3VzUmVjZW50bHlVc2VkRWRpdG9yQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLm9wZW5QcmV2aW91c1JlY2VudGx5VXNlZEVkaXRvcicsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdvcGVuUHJldmlvdXNSZWNlbnRseVVzZWRFZGl0b3InLCAnT3BlbiBQcmV2aW91cyBSZWNlbnRseSBVc2VkIEVkaXRvcicpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3XG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBoaXN0b3J5U2VydmljZSA9IGFjY2Vzc29yLmdldChJSGlzdG9yeVNlcnZpY2UpO1xuXG5cdFx0aGlzdG9yeVNlcnZpY2Uub3BlblByZXZpb3VzbHlVc2VkRWRpdG9yKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE9wZW5OZXh0UmVjZW50bHlVc2VkRWRpdG9ySW5Hcm91cEFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5vcGVuTmV4dFJlY2VudGx5VXNlZEVkaXRvckluR3JvdXAnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignb3Blbk5leHRSZWNlbnRseVVzZWRFZGl0b3JJbkdyb3VwJywgJ09wZW4gTmV4dCBSZWNlbnRseSBVc2VkIEVkaXRvciBJbiBHcm91cCcpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3XG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBoaXN0b3J5U2VydmljZSA9IGFjY2Vzc29yLmdldChJSGlzdG9yeVNlcnZpY2UpO1xuXHRcdGNvbnN0IGVkaXRvckdyb3Vwc1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvckdyb3Vwc1NlcnZpY2UpO1xuXG5cdFx0aGlzdG9yeVNlcnZpY2Uub3Blbk5leHRSZWNlbnRseVVzZWRFZGl0b3IoZWRpdG9yR3JvdXBzU2VydmljZS5hY3RpdmVHcm91cC5pZCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE9wZW5QcmV2aW91c1JlY2VudGx5VXNlZEVkaXRvckluR3JvdXBBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ub3BlblByZXZpb3VzUmVjZW50bHlVc2VkRWRpdG9ySW5Hcm91cCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdvcGVuUHJldmlvdXNSZWNlbnRseVVzZWRFZGl0b3JJbkdyb3VwJywgJ09wZW4gUHJldmlvdXMgUmVjZW50bHkgVXNlZCBFZGl0b3IgSW4gR3JvdXAnKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlld1xuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgaGlzdG9yeVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUhpc3RvcnlTZXJ2aWNlKTtcblx0XHRjb25zdCBlZGl0b3JHcm91cHNTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JHcm91cHNTZXJ2aWNlKTtcblxuXHRcdGhpc3RvcnlTZXJ2aWNlLm9wZW5QcmV2aW91c2x5VXNlZEVkaXRvcihlZGl0b3JHcm91cHNTZXJ2aWNlLmFjdGl2ZUdyb3VwLmlkKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ2xlYXJFZGl0b3JIaXN0b3J5QWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmNsZWFyRWRpdG9ySGlzdG9yeScsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdjbGVhckVkaXRvckhpc3RvcnknLCAnQ2xlYXIgRWRpdG9yIEhpc3RvcnknKSxcblx0XHRcdGYxOiB0cnVlXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBkaWFsb2dTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEaWFsb2dTZXJ2aWNlKTtcblx0XHRjb25zdCBoaXN0b3J5U2VydmljZSA9IGFjY2Vzc29yLmdldChJSGlzdG9yeVNlcnZpY2UpO1xuXG5cdFx0Ly8gQXNrIGZvciBjb25maXJtYXRpb25cblx0XHRjb25zdCB7IGNvbmZpcm1lZCB9ID0gYXdhaXQgZGlhbG9nU2VydmljZS5jb25maXJtKHtcblx0XHRcdHR5cGU6ICd3YXJuaW5nJyxcblx0XHRcdG1lc3NhZ2U6IGxvY2FsaXplKCdjb25maXJtQ2xlYXJFZGl0b3JIaXN0b3J5TWVzc2FnZScsIFwiRG8geW91IHdhbnQgdG8gY2xlYXIgdGhlIGhpc3Rvcnkgb2YgcmVjZW50bHkgb3BlbmVkIGVkaXRvcnM/XCIpLFxuXHRcdFx0ZGV0YWlsOiBsb2NhbGl6ZSgnY29uZmlybUNsZWFyRGV0YWlsJywgXCJUaGlzIGFjdGlvbiBpcyBpcnJldmVyc2libGUhXCIpLFxuXHRcdFx0cHJpbWFyeUJ1dHRvbjogbG9jYWxpemUoeyBrZXk6ICdjbGVhckJ1dHRvbkxhYmVsJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmQ2xlYXJcIilcblx0XHR9KTtcblxuXHRcdGlmICghY29uZmlybWVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gQ2xlYXIgZWRpdG9yIGhpc3Rvcnlcblx0XHRoaXN0b3J5U2VydmljZS5jbGVhcigpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBNb3ZlRWRpdG9yTGVmdEluR3JvdXBBY3Rpb24gZXh0ZW5kcyBFeGVjdXRlQ29tbWFuZEFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLm1vdmVFZGl0b3JMZWZ0SW5Hcm91cCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdtb3ZlRWRpdG9yTGVmdCcsICdNb3ZlIEVkaXRvciBMZWZ0JyksXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuUGFnZVVwLFxuXHRcdFx0XHRtYWM6IHtcblx0XHRcdFx0XHRwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkxlZnRBcnJvdylcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlld1xuXHRcdH0sIE1PVkVfQUNUSVZFX0VESVRPUl9DT01NQU5EX0lELCB7IHRvOiAnbGVmdCcgfSBzYXRpc2ZpZXMgU2VsZWN0ZWRFZGl0b3JzTW92ZUNvcHlBcmd1bWVudHMpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBNb3ZlRWRpdG9yUmlnaHRJbkdyb3VwQWN0aW9uIGV4dGVuZHMgRXhlY3V0ZUNvbW1hbmRBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5tb3ZlRWRpdG9yUmlnaHRJbkdyb3VwJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ21vdmVFZGl0b3JSaWdodCcsICdNb3ZlIEVkaXRvciBSaWdodCcpLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLlBhZ2VEb3duLFxuXHRcdFx0XHRtYWM6IHtcblx0XHRcdFx0XHRwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLlJpZ2h0QXJyb3cpXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXdcblx0XHR9LCBNT1ZFX0FDVElWRV9FRElUT1JfQ09NTUFORF9JRCwgeyB0bzogJ3JpZ2h0JyB9IHNhdGlzZmllcyBTZWxlY3RlZEVkaXRvcnNNb3ZlQ29weUFyZ3VtZW50cyk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE1vdmVFZGl0b3JUb1ByZXZpb3VzR3JvdXBBY3Rpb24gZXh0ZW5kcyBFeGVjdXRlQ29tbWFuZEFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLm1vdmVFZGl0b3JUb1ByZXZpb3VzR3JvdXAnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignbW92ZUVkaXRvclRvUHJldmlvdXNHcm91cCcsICdNb3ZlIEVkaXRvciBpbnRvIFByZXZpb3VzIEdyb3VwJyksXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5BbHQgfCBLZXlDb2RlLkxlZnRBcnJvdyxcblx0XHRcdFx0bWFjOiB7XG5cdFx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuV2luQ3RybCB8IEtleUNvZGUuTGVmdEFycm93XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXcsXG5cdFx0fSwgTU9WRV9BQ1RJVkVfRURJVE9SX0NPTU1BTkRfSUQsIHsgdG86ICdwcmV2aW91cycsIGJ5OiAnZ3JvdXAnIH0gc2F0aXNmaWVzIFNlbGVjdGVkRWRpdG9yc01vdmVDb3B5QXJndW1lbnRzKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTW92ZUVkaXRvclRvTmV4dEdyb3VwQWN0aW9uIGV4dGVuZHMgRXhlY3V0ZUNvbW1hbmRBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5tb3ZlRWRpdG9yVG9OZXh0R3JvdXAnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignbW92ZUVkaXRvclRvTmV4dEdyb3VwJywgJ01vdmUgRWRpdG9yIGludG8gTmV4dCBHcm91cCcpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5BbHQgfCBLZXlDb2RlLlJpZ2h0QXJyb3csXG5cdFx0XHRcdG1hYzoge1xuXHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLldpbkN0cmwgfCBLZXlDb2RlLlJpZ2h0QXJyb3dcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXdcblx0XHR9LCBNT1ZFX0FDVElWRV9FRElUT1JfQ09NTUFORF9JRCwgeyB0bzogJ25leHQnLCBieTogJ2dyb3VwJyB9IHNhdGlzZmllcyBTZWxlY3RlZEVkaXRvcnNNb3ZlQ29weUFyZ3VtZW50cyk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE1vdmVFZGl0b3JUb0Fib3ZlR3JvdXBBY3Rpb24gZXh0ZW5kcyBFeGVjdXRlQ29tbWFuZEFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLm1vdmVFZGl0b3JUb0Fib3ZlR3JvdXAnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignbW92ZUVkaXRvclRvQWJvdmVHcm91cCcsICdNb3ZlIEVkaXRvciBpbnRvIEdyb3VwIEFib3ZlJyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXdcblx0XHR9LCBNT1ZFX0FDVElWRV9FRElUT1JfQ09NTUFORF9JRCwgeyB0bzogJ3VwJywgYnk6ICdncm91cCcgfSBzYXRpc2ZpZXMgU2VsZWN0ZWRFZGl0b3JzTW92ZUNvcHlBcmd1bWVudHMpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBNb3ZlRWRpdG9yVG9CZWxvd0dyb3VwQWN0aW9uIGV4dGVuZHMgRXhlY3V0ZUNvbW1hbmRBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5tb3ZlRWRpdG9yVG9CZWxvd0dyb3VwJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ21vdmVFZGl0b3JUb0JlbG93R3JvdXAnLCAnTW92ZSBFZGl0b3IgaW50byBHcm91cCBCZWxvdycpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3XG5cdFx0fSwgTU9WRV9BQ1RJVkVfRURJVE9SX0NPTU1BTkRfSUQsIHsgdG86ICdkb3duJywgYnk6ICdncm91cCcgfSBzYXRpc2ZpZXMgU2VsZWN0ZWRFZGl0b3JzTW92ZUNvcHlBcmd1bWVudHMpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBNb3ZlRWRpdG9yVG9MZWZ0R3JvdXBBY3Rpb24gZXh0ZW5kcyBFeGVjdXRlQ29tbWFuZEFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLm1vdmVFZGl0b3JUb0xlZnRHcm91cCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdtb3ZlRWRpdG9yVG9MZWZ0R3JvdXAnLCAnTW92ZSBFZGl0b3IgaW50byBMZWZ0IEdyb3VwJyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXdcblx0XHR9LCBNT1ZFX0FDVElWRV9FRElUT1JfQ09NTUFORF9JRCwgeyB0bzogJ2xlZnQnLCBieTogJ2dyb3VwJyB9IHNhdGlzZmllcyBTZWxlY3RlZEVkaXRvcnNNb3ZlQ29weUFyZ3VtZW50cyk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE1vdmVFZGl0b3JUb1JpZ2h0R3JvdXBBY3Rpb24gZXh0ZW5kcyBFeGVjdXRlQ29tbWFuZEFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLm1vdmVFZGl0b3JUb1JpZ2h0R3JvdXAnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignbW92ZUVkaXRvclRvUmlnaHRHcm91cCcsICdNb3ZlIEVkaXRvciBpbnRvIFJpZ2h0IEdyb3VwJyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXdcblx0XHR9LCBNT1ZFX0FDVElWRV9FRElUT1JfQ09NTUFORF9JRCwgeyB0bzogJ3JpZ2h0JywgYnk6ICdncm91cCcgfSBzYXRpc2ZpZXMgU2VsZWN0ZWRFZGl0b3JzTW92ZUNvcHlBcmd1bWVudHMpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBNb3ZlRWRpdG9yVG9GaXJzdEdyb3VwQWN0aW9uIGV4dGVuZHMgRXhlY3V0ZUNvbW1hbmRBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5tb3ZlRWRpdG9yVG9GaXJzdEdyb3VwJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ21vdmVFZGl0b3JUb0ZpcnN0R3JvdXAnLCAnTW92ZSBFZGl0b3IgaW50byBGaXJzdCBHcm91cCcpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuU2hpZnQgfCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5EaWdpdDEsXG5cdFx0XHRcdG1hYzoge1xuXHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLldpbkN0cmwgfCBLZXlDb2RlLkRpZ2l0MVxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlld1xuXHRcdH0sIE1PVkVfQUNUSVZFX0VESVRPUl9DT01NQU5EX0lELCB7IHRvOiAnZmlyc3QnLCBieTogJ2dyb3VwJyB9IHNhdGlzZmllcyBTZWxlY3RlZEVkaXRvcnNNb3ZlQ29weUFyZ3VtZW50cyk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE1vdmVFZGl0b3JUb0xhc3RHcm91cEFjdGlvbiBleHRlbmRzIEV4ZWN1dGVDb21tYW5kQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ubW92ZUVkaXRvclRvTGFzdEdyb3VwJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ21vdmVFZGl0b3JUb0xhc3RHcm91cCcsICdNb3ZlIEVkaXRvciBpbnRvIExhc3QgR3JvdXAnKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLlNoaWZ0IHwgS2V5TW9kLkFsdCB8IEtleUNvZGUuRGlnaXQ5LFxuXHRcdFx0XHRtYWM6IHtcblx0XHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5XaW5DdHJsIHwgS2V5Q29kZS5EaWdpdDlcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXdcblx0XHR9LCBNT1ZFX0FDVElWRV9FRElUT1JfQ09NTUFORF9JRCwgeyB0bzogJ2xhc3QnLCBieTogJ2dyb3VwJyB9IHNhdGlzZmllcyBTZWxlY3RlZEVkaXRvcnNNb3ZlQ29weUFyZ3VtZW50cyk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFNwbGl0RWRpdG9yVG9QcmV2aW91c0dyb3VwQWN0aW9uIGV4dGVuZHMgRXhlY3V0ZUNvbW1hbmRBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5zcGxpdEVkaXRvclRvUHJldmlvdXNHcm91cCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdzcGxpdEVkaXRvclRvUHJldmlvdXNHcm91cCcsICdTcGxpdCBFZGl0b3IgaW50byBQcmV2aW91cyBHcm91cCcpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3XG5cdFx0fSwgQ09QWV9BQ1RJVkVfRURJVE9SX0NPTU1BTkRfSUQsIHsgdG86ICdwcmV2aW91cycsIGJ5OiAnZ3JvdXAnIH0gc2F0aXNmaWVzIFNlbGVjdGVkRWRpdG9yc01vdmVDb3B5QXJndW1lbnRzKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU3BsaXRFZGl0b3JUb05leHRHcm91cEFjdGlvbiBleHRlbmRzIEV4ZWN1dGVDb21tYW5kQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uc3BsaXRFZGl0b3JUb05leHRHcm91cCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdzcGxpdEVkaXRvclRvTmV4dEdyb3VwJywgJ1NwbGl0IEVkaXRvciBpbnRvIE5leHQgR3JvdXAnKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlld1xuXHRcdH0sIENPUFlfQUNUSVZFX0VESVRPUl9DT01NQU5EX0lELCB7IHRvOiAnbmV4dCcsIGJ5OiAnZ3JvdXAnIH0gc2F0aXNmaWVzIFNlbGVjdGVkRWRpdG9yc01vdmVDb3B5QXJndW1lbnRzKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU3BsaXRFZGl0b3JUb0Fib3ZlR3JvdXBBY3Rpb24gZXh0ZW5kcyBFeGVjdXRlQ29tbWFuZEFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLnNwbGl0RWRpdG9yVG9BYm92ZUdyb3VwJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3NwbGl0RWRpdG9yVG9BYm92ZUdyb3VwJywgJ1NwbGl0IEVkaXRvciBpbnRvIEdyb3VwIEFib3ZlJyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXdcblx0XHR9LCBDT1BZX0FDVElWRV9FRElUT1JfQ09NTUFORF9JRCwgeyB0bzogJ3VwJywgYnk6ICdncm91cCcgfSBzYXRpc2ZpZXMgU2VsZWN0ZWRFZGl0b3JzTW92ZUNvcHlBcmd1bWVudHMpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTcGxpdEVkaXRvclRvQmVsb3dHcm91cEFjdGlvbiBleHRlbmRzIEV4ZWN1dGVDb21tYW5kQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uc3BsaXRFZGl0b3JUb0JlbG93R3JvdXAnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignc3BsaXRFZGl0b3JUb0JlbG93R3JvdXAnLCAnU3BsaXQgRWRpdG9yIGludG8gR3JvdXAgQmVsb3cnKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlld1xuXHRcdH0sIENPUFlfQUNUSVZFX0VESVRPUl9DT01NQU5EX0lELCB7IHRvOiAnZG93bicsIGJ5OiAnZ3JvdXAnIH0gc2F0aXNmaWVzIFNlbGVjdGVkRWRpdG9yc01vdmVDb3B5QXJndW1lbnRzKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU3BsaXRFZGl0b3JUb0xlZnRHcm91cEFjdGlvbiBleHRlbmRzIEV4ZWN1dGVDb21tYW5kQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5zcGxpdEVkaXRvclRvTGVmdEdyb3VwJztcblx0c3RhdGljIHJlYWRvbmx5IExBQkVMID0gbG9jYWxpemUoJ3NwbGl0RWRpdG9yVG9MZWZ0R3JvdXAnLCBcIlNwbGl0IEVkaXRvciBpbnRvIExlZnQgR3JvdXBcIik7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLnNwbGl0RWRpdG9yVG9MZWZ0R3JvdXAnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignc3BsaXRFZGl0b3JUb0xlZnRHcm91cCcsIFwiU3BsaXQgRWRpdG9yIGludG8gTGVmdCBHcm91cFwiKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlld1xuXHRcdH0sIENPUFlfQUNUSVZFX0VESVRPUl9DT01NQU5EX0lELCB7IHRvOiAnbGVmdCcsIGJ5OiAnZ3JvdXAnIH0gc2F0aXNmaWVzIFNlbGVjdGVkRWRpdG9yc01vdmVDb3B5QXJndW1lbnRzKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU3BsaXRFZGl0b3JUb1JpZ2h0R3JvdXBBY3Rpb24gZXh0ZW5kcyBFeGVjdXRlQ29tbWFuZEFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLnNwbGl0RWRpdG9yVG9SaWdodEdyb3VwJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3NwbGl0RWRpdG9yVG9SaWdodEdyb3VwJywgJ1NwbGl0IEVkaXRvciBpbnRvIFJpZ2h0IEdyb3VwJyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXdcblx0XHR9LCBDT1BZX0FDVElWRV9FRElUT1JfQ09NTUFORF9JRCwgeyB0bzogJ3JpZ2h0JywgYnk6ICdncm91cCcgfSBzYXRpc2ZpZXMgU2VsZWN0ZWRFZGl0b3JzTW92ZUNvcHlBcmd1bWVudHMpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTcGxpdEVkaXRvclRvRmlyc3RHcm91cEFjdGlvbiBleHRlbmRzIEV4ZWN1dGVDb21tYW5kQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uc3BsaXRFZGl0b3JUb0ZpcnN0R3JvdXAnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignc3BsaXRFZGl0b3JUb0ZpcnN0R3JvdXAnLCAnU3BsaXQgRWRpdG9yIGludG8gRmlyc3QgR3JvdXAnKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlld1xuXHRcdH0sIENPUFlfQUNUSVZFX0VESVRPUl9DT01NQU5EX0lELCB7IHRvOiAnZmlyc3QnLCBieTogJ2dyb3VwJyB9IHNhdGlzZmllcyBTZWxlY3RlZEVkaXRvcnNNb3ZlQ29weUFyZ3VtZW50cyk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFNwbGl0RWRpdG9yVG9MYXN0R3JvdXBBY3Rpb24gZXh0ZW5kcyBFeGVjdXRlQ29tbWFuZEFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLnNwbGl0RWRpdG9yVG9MYXN0R3JvdXAnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignc3BsaXRFZGl0b3JUb0xhc3RHcm91cCcsICdTcGxpdCBFZGl0b3IgaW50byBMYXN0IEdyb3VwJyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXdcblx0XHR9LCBDT1BZX0FDVElWRV9FRElUT1JfQ09NTUFORF9JRCwgeyB0bzogJ2xhc3QnLCBieTogJ2dyb3VwJyB9IHNhdGlzZmllcyBTZWxlY3RlZEVkaXRvcnNNb3ZlQ29weUFyZ3VtZW50cyk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEVkaXRvckxheW91dFNpbmdsZUFjdGlvbiBleHRlbmRzIEV4ZWN1dGVDb21tYW5kQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5lZGl0b3JMYXlvdXRTaW5nbGUnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBFZGl0b3JMYXlvdXRTaW5nbGVBY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdlZGl0b3JMYXlvdXRTaW5nbGUnLCAnU2luZ2xlIENvbHVtbiBFZGl0b3IgTGF5b3V0JyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXdcblx0XHR9LCBMQVlPVVRfRURJVE9SX0dST1VQU19DT01NQU5EX0lELCB7IGdyb3VwczogW3t9XSwgb3JpZW50YXRpb246IEdyb3VwT3JpZW50YXRpb24uSE9SSVpPTlRBTCB9IHNhdGlzZmllcyBFZGl0b3JHcm91cExheW91dCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEVkaXRvckxheW91dFR3b0NvbHVtbnNBY3Rpb24gZXh0ZW5kcyBFeGVjdXRlQ29tbWFuZEFjdGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5hY3Rpb24uZWRpdG9yTGF5b3V0VHdvQ29sdW1ucyc7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IEVkaXRvckxheW91dFR3b0NvbHVtbnNBY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdlZGl0b3JMYXlvdXRUd29Db2x1bW5zJywgJ1R3byBDb2x1bW5zIEVkaXRvciBMYXlvdXQnKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlld1xuXHRcdH0sIExBWU9VVF9FRElUT1JfR1JPVVBTX0NPTU1BTkRfSUQsIHsgZ3JvdXBzOiBbe30sIHt9XSwgb3JpZW50YXRpb246IEdyb3VwT3JpZW50YXRpb24uSE9SSVpPTlRBTCB9IHNhdGlzZmllcyBFZGl0b3JHcm91cExheW91dCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEVkaXRvckxheW91dFRocmVlQ29sdW1uc0FjdGlvbiBleHRlbmRzIEV4ZWN1dGVDb21tYW5kQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5lZGl0b3JMYXlvdXRUaHJlZUNvbHVtbnMnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBFZGl0b3JMYXlvdXRUaHJlZUNvbHVtbnNBY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdlZGl0b3JMYXlvdXRUaHJlZUNvbHVtbnMnLCAnVGhyZWUgQ29sdW1ucyBFZGl0b3IgTGF5b3V0JyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXdcblx0XHR9LCBMQVlPVVRfRURJVE9SX0dST1VQU19DT01NQU5EX0lELCB7IGdyb3VwczogW3t9LCB7fSwge31dLCBvcmllbnRhdGlvbjogR3JvdXBPcmllbnRhdGlvbi5IT1JJWk9OVEFMIH0gc2F0aXNmaWVzIEVkaXRvckdyb3VwTGF5b3V0KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRWRpdG9yTGF5b3V0VHdvUm93c0FjdGlvbiBleHRlbmRzIEV4ZWN1dGVDb21tYW5kQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5lZGl0b3JMYXlvdXRUd29Sb3dzJztcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogRWRpdG9yTGF5b3V0VHdvUm93c0FjdGlvbi5JRCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2VkaXRvckxheW91dFR3b1Jvd3MnLCAnVHdvIFJvd3MgRWRpdG9yIExheW91dCcpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3XG5cdFx0fSwgTEFZT1VUX0VESVRPUl9HUk9VUFNfQ09NTUFORF9JRCwgeyBncm91cHM6IFt7fSwge31dLCBvcmllbnRhdGlvbjogR3JvdXBPcmllbnRhdGlvbi5WRVJUSUNBTCB9IHNhdGlzZmllcyBFZGl0b3JHcm91cExheW91dCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEVkaXRvckxheW91dFRocmVlUm93c0FjdGlvbiBleHRlbmRzIEV4ZWN1dGVDb21tYW5kQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5lZGl0b3JMYXlvdXRUaHJlZVJvd3MnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBFZGl0b3JMYXlvdXRUaHJlZVJvd3NBY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdlZGl0b3JMYXlvdXRUaHJlZVJvd3MnLCAnVGhyZWUgUm93cyBFZGl0b3IgTGF5b3V0JyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXdcblx0XHR9LCBMQVlPVVRfRURJVE9SX0dST1VQU19DT01NQU5EX0lELCB7IGdyb3VwczogW3t9LCB7fSwge31dLCBvcmllbnRhdGlvbjogR3JvdXBPcmllbnRhdGlvbi5WRVJUSUNBTCB9IHNhdGlzZmllcyBFZGl0b3JHcm91cExheW91dCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEVkaXRvckxheW91dFR3b0J5VHdvR3JpZEFjdGlvbiBleHRlbmRzIEV4ZWN1dGVDb21tYW5kQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5lZGl0b3JMYXlvdXRUd29CeVR3b0dyaWQnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBFZGl0b3JMYXlvdXRUd29CeVR3b0dyaWRBY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdlZGl0b3JMYXlvdXRUd29CeVR3b0dyaWQnLCAnR3JpZCBFZGl0b3IgTGF5b3V0ICgyeDIpJyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXdcblx0XHR9LCBMQVlPVVRfRURJVE9SX0dST1VQU19DT01NQU5EX0lELCB7IGdyb3VwczogW3sgZ3JvdXBzOiBbe30sIHt9XSB9LCB7IGdyb3VwczogW3t9LCB7fV0gfV0sIG9yaWVudGF0aW9uOiBHcm91cE9yaWVudGF0aW9uLkhPUklaT05UQUwgfSBzYXRpc2ZpZXMgRWRpdG9yR3JvdXBMYXlvdXQpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBFZGl0b3JMYXlvdXRUd29Db2x1bW5zQm90dG9tQWN0aW9uIGV4dGVuZHMgRXhlY3V0ZUNvbW1hbmRBY3Rpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLmVkaXRvckxheW91dFR3b0NvbHVtbnNCb3R0b20nO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBFZGl0b3JMYXlvdXRUd29Db2x1bW5zQm90dG9tQWN0aW9uLklELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignZWRpdG9yTGF5b3V0VHdvQ29sdW1uc0JvdHRvbScsICdUd28gQ29sdW1ucyBCb3R0b20gRWRpdG9yIExheW91dCcpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3XG5cdFx0fSwgTEFZT1VUX0VESVRPUl9HUk9VUFNfQ09NTUFORF9JRCwgeyBncm91cHM6IFt7fSwgeyBncm91cHM6IFt7fSwge31dIH1dLCBvcmllbnRhdGlvbjogR3JvdXBPcmllbnRhdGlvbi5WRVJUSUNBTCB9IHNhdGlzZmllcyBFZGl0b3JHcm91cExheW91dCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEVkaXRvckxheW91dFR3b1Jvd3NSaWdodEFjdGlvbiBleHRlbmRzIEV4ZWN1dGVDb21tYW5kQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5lZGl0b3JMYXlvdXRUd29Sb3dzUmlnaHQnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBFZGl0b3JMYXlvdXRUd29Sb3dzUmlnaHRBY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdlZGl0b3JMYXlvdXRUd29Sb3dzUmlnaHQnLCAnVHdvIFJvd3MgUmlnaHQgRWRpdG9yIExheW91dCcpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3XG5cdFx0fSwgTEFZT1VUX0VESVRPUl9HUk9VUFNfQ09NTUFORF9JRCwgeyBncm91cHM6IFt7fSwgeyBncm91cHM6IFt7fSwge31dIH1dLCBvcmllbnRhdGlvbjogR3JvdXBPcmllbnRhdGlvbi5IT1JJWk9OVEFMIH0gc2F0aXNmaWVzIEVkaXRvckdyb3VwTGF5b3V0KTtcblx0fVxufVxuXG5hYnN0cmFjdCBjbGFzcyBBYnN0cmFjdENyZWF0ZUVkaXRvckdyb3VwQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0ZGVzYzogUmVhZG9ubHk8SUFjdGlvbjJPcHRpb25zPixcblx0XHRwcml2YXRlIHJlYWRvbmx5IGRpcmVjdGlvbjogR3JvdXBEaXJlY3Rpb25cblx0KSB7XG5cdFx0c3VwZXIoZGVzYyk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBlZGl0b3JHcm91cFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvckdyb3Vwc1NlcnZpY2UpO1xuXHRcdGNvbnN0IGxheW91dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdvcmtiZW5jaExheW91dFNlcnZpY2UpO1xuXG5cdFx0Ly8gV2UgYXJlIGFib3V0IHRvIGNyZWF0ZSBhIG5ldyBlbXB0eSBlZGl0b3IgZ3JvdXAuIFdlIG1ha2UgYW4gb3BpbmlhdGVkXG5cdFx0Ly8gZGVjaXNpb24gaGVyZSB3aGV0aGVyIHRvIGZvY3VzIHRoYXQgbmV3IGVkaXRvciBncm91cCBvciBub3QgYmFzZWRcblx0XHQvLyBvbiB3aGF0IGlzIGN1cnJlbnRseSBmb2N1c2VkLiBJZiBmb2N1cyBpcyBvdXRzaWRlIHRoZSBlZGl0b3IgYXJlYSBub3Rcblx0XHQvLyBpbiB0aGUgPGJvZHk+LCB3ZSBkbyBub3QgZm9jdXMsIHdpdGggdGhlIHJhdGlvbmFsZSB0aGF0IGEgdXNlciBtaWdodFxuXHRcdC8vIGhhdmUgZm9jdXMgb24gYSB0cmVlL2xpc3Qgd2l0aCB0aGUgaW50ZW50aW9uIHRvIHBpY2sgYW4gZWxlbWVudCB0b1xuXHRcdC8vIG9wZW4gaW4gdGhlIG5ldyBncm91cCBmcm9tIHRoYXQgdHJlZS9saXN0LlxuXHRcdC8vXG5cdFx0Ly8gSWYgZm9jdXMgaXMgaW5zaWRlIHRoZSBlZGl0b3IgYXJlYSwgd2Ugd2FudCB0byBwcmV2ZW50IHRoZSBzaXR1YXRpb25cblx0XHQvLyBvZiBhbiBlZGl0b3IgaGF2aW5nIGtleWJvYXJkIGZvY3VzIGluIGFuIGluYWN0aXZlIGVkaXRvciBncm91cFxuXHRcdC8vIChzZWUgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzE4OTI1NilcblxuXHRcdGNvbnN0IGFjdGl2ZURvY3VtZW50ID0gZ2V0QWN0aXZlRG9jdW1lbnQoKTtcblx0XHRjb25zdCBmb2N1c05ld0dyb3VwID0gbGF5b3V0U2VydmljZS5oYXNGb2N1cyhQYXJ0cy5FRElUT1JfUEFSVCkgfHwgYWN0aXZlRG9jdW1lbnQuYWN0aXZlRWxlbWVudCA9PT0gYWN0aXZlRG9jdW1lbnQuYm9keTtcblxuXHRcdGNvbnN0IGdyb3VwID0gZWRpdG9yR3JvdXBTZXJ2aWNlLmFkZEdyb3VwKGVkaXRvckdyb3VwU2VydmljZS5hY3RpdmVHcm91cCwgdGhpcy5kaXJlY3Rpb24pO1xuXHRcdGVkaXRvckdyb3VwU2VydmljZS5hY3RpdmF0ZUdyb3VwKGdyb3VwKTtcblxuXHRcdGlmIChmb2N1c05ld0dyb3VwKSB7XG5cdFx0XHRncm91cC5mb2N1cygpO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTmV3RWRpdG9yR3JvdXBMZWZ0QWN0aW9uIGV4dGVuZHMgQWJzdHJhY3RDcmVhdGVFZGl0b3JHcm91cEFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLm5ld0dyb3VwTGVmdCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCduZXdHcm91cExlZnQnLCAnTmV3IEVkaXRvciBHcm91cCB0byB0aGUgTGVmdCcpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3XG5cdFx0fSwgR3JvdXBEaXJlY3Rpb24uTEVGVCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE5ld0VkaXRvckdyb3VwUmlnaHRBY3Rpb24gZXh0ZW5kcyBBYnN0cmFjdENyZWF0ZUVkaXRvckdyb3VwQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ubmV3R3JvdXBSaWdodCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCduZXdHcm91cFJpZ2h0JywgJ05ldyBFZGl0b3IgR3JvdXAgdG8gdGhlIFJpZ2h0JyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXdcblx0XHR9LCBHcm91cERpcmVjdGlvbi5SSUdIVCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE5ld0VkaXRvckdyb3VwQWJvdmVBY3Rpb24gZXh0ZW5kcyBBYnN0cmFjdENyZWF0ZUVkaXRvckdyb3VwQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ubmV3R3JvdXBBYm92ZScsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCduZXdHcm91cEFib3ZlJywgJ05ldyBFZGl0b3IgR3JvdXAgQWJvdmUnKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlld1xuXHRcdH0sIEdyb3VwRGlyZWN0aW9uLlVQKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTmV3RWRpdG9yR3JvdXBCZWxvd0FjdGlvbiBleHRlbmRzIEFic3RyYWN0Q3JlYXRlRWRpdG9yR3JvdXBBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5uZXdHcm91cEJlbG93Jyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ25ld0dyb3VwQmVsb3cnLCAnTmV3IEVkaXRvciBHcm91cCBCZWxvdycpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3XG5cdFx0fSwgR3JvdXBEaXJlY3Rpb24uRE9XTik7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFRvZ2dsZUVkaXRvclR5cGVBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24udG9nZ2xlRWRpdG9yVHlwZScsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd0b2dnbGVFZGl0b3JUeXBlJywgJ1RvZ2dsZSBFZGl0b3IgVHlwZScpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3LFxuXHRcdFx0cHJlY29uZGl0aW9uOiBBY3RpdmVFZGl0b3JBdmFpbGFibGVFZGl0b3JJZHNDb250ZXh0XG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRjb25zdCBlZGl0b3JSZXNvbHZlclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclJlc29sdmVyU2VydmljZSk7XG5cblx0XHRjb25zdCBhY3RpdmVFZGl0b3JQYW5lID0gZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3JQYW5lO1xuXHRcdGlmICghYWN0aXZlRWRpdG9yUGFuZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFjdGl2ZUVkaXRvclJlc291cmNlID0gRWRpdG9yUmVzb3VyY2VBY2Nlc3Nvci5nZXRDYW5vbmljYWxVcmkoYWN0aXZlRWRpdG9yUGFuZS5pbnB1dCk7XG5cdFx0aWYgKCFhY3RpdmVFZGl0b3JSZXNvdXJjZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGVkaXRvcklkcyA9IGVkaXRvclJlc29sdmVyU2VydmljZS5nZXRFZGl0b3JzKGFjdGl2ZUVkaXRvclJlc291cmNlKS5tYXAoZWRpdG9yID0+IGVkaXRvci5pZCkuZmlsdGVyKGlkID0+IGlkICE9PSBhY3RpdmVFZGl0b3JQYW5lLmlucHV0LmVkaXRvcklkKTtcblx0XHRpZiAoZWRpdG9ySWRzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFJlcGxhY2UgdGhlIGN1cnJlbnQgZWRpdG9yIHdpdGggdGhlIG5leHQgYXZhaWFibGUgZWRpdG9yIHR5cGVcblx0XHRhd2FpdCBlZGl0b3JTZXJ2aWNlLnJlcGxhY2VFZGl0b3JzKFtcblx0XHRcdHtcblx0XHRcdFx0ZWRpdG9yOiBhY3RpdmVFZGl0b3JQYW5lLmlucHV0LFxuXHRcdFx0XHRyZXBsYWNlbWVudDoge1xuXHRcdFx0XHRcdHJlc291cmNlOiBhY3RpdmVFZGl0b3JSZXNvdXJjZSxcblx0XHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0XHRvdmVycmlkZTogZWRpdG9ySWRzWzBdXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XSwgYWN0aXZlRWRpdG9yUGFuZS5ncm91cCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFJlT3BlbkluVGV4dEVkaXRvckFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5yZW9wZW5UZXh0RWRpdG9yJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3Jlb3BlblRleHRFZGl0b3InLCAnUmVvcGVuIEVkaXRvciB3aXRoIFRleHQgRWRpdG9yJyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXcsXG5cdFx0XHRwcmVjb25kaXRpb246IEFjdGl2ZUVkaXRvckF2YWlsYWJsZUVkaXRvcklkc0NvbnRleHRcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgYWN0aXZlRWRpdG9yUGFuZSA9IGVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZTtcblx0XHRpZiAoIWFjdGl2ZUVkaXRvclBhbmUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBhY3RpdmVFZGl0b3JSZXNvdXJjZSA9IEVkaXRvclJlc291cmNlQWNjZXNzb3IuZ2V0Q2Fub25pY2FsVXJpKGFjdGl2ZUVkaXRvclBhbmUuaW5wdXQpO1xuXHRcdGlmICghYWN0aXZlRWRpdG9yUmVzb3VyY2UpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBSZXBsYWNlIHRoZSBjdXJyZW50IGVkaXRvciB3aXRoIHRoZSB0ZXh0IGVkaXRvclxuXHRcdGF3YWl0IGVkaXRvclNlcnZpY2UucmVwbGFjZUVkaXRvcnMoW1xuXHRcdFx0e1xuXHRcdFx0XHRlZGl0b3I6IGFjdGl2ZUVkaXRvclBhbmUuaW5wdXQsXG5cdFx0XHRcdHJlcGxhY2VtZW50OiB7XG5cdFx0XHRcdFx0cmVzb3VyY2U6IGFjdGl2ZUVkaXRvclJlc291cmNlLFxuXHRcdFx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0XHRcdG92ZXJyaWRlOiBERUZBVUxUX0VESVRPUl9BU1NPQ0lBVElPTi5pZFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdF0sIGFjdGl2ZUVkaXRvclBhbmUuZ3JvdXApO1xuXHR9XG59XG5cblxuYWJzdHJhY3QgY2xhc3MgQmFzZU1vdmVDb3B5RWRpdG9yVG9OZXdXaW5kb3dBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRpZDogc3RyaW5nLFxuXHRcdHRpdGxlOiBJQ29tbWFuZEFjdGlvblRpdGxlLFxuXHRcdGtleWJpbmRpbmc6IE9taXQ8SUtleWJpbmRpbmdSdWxlLCAnaWQnPiB8IHVuZGVmaW5lZCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IG1vdmU6IGJvb2xlYW5cblx0KSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQsXG5cdFx0XHR0aXRsZSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXcsXG5cdFx0XHRwcmVjb25kaXRpb246IEFjdGl2ZUVkaXRvckNvbnRleHQsXG5cdFx0XHRrZXliaW5kaW5nLFxuXHRcdFx0ZjE6IHRydWVcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogdW5rbm93bltdKSB7XG5cdFx0Y29uc3QgZWRpdG9yR3JvdXBzU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSk7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0Y29uc3QgbGlzdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxpc3RTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IHJlc29sdmVkQ29udGV4dCA9IHJlc29sdmVDb21tYW5kc0NvbnRleHQoYXJncywgZWRpdG9yU2VydmljZSwgZWRpdG9yR3JvdXBzU2VydmljZSwgbGlzdFNlcnZpY2UpO1xuXHRcdGlmICghcmVzb2x2ZWRDb250ZXh0Lmdyb3VwZWRFZGl0b3JzLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGF1eGlsaWFyeUVkaXRvclBhcnQgPSBhd2FpdCBlZGl0b3JHcm91cHNTZXJ2aWNlLmNyZWF0ZUF1eGlsaWFyeUVkaXRvclBhcnQoKTtcblxuXHRcdGNvbnN0IHsgZ3JvdXAsIGVkaXRvcnMgfSA9IHJlc29sdmVkQ29udGV4dC5ncm91cGVkRWRpdG9yc1swXTsgLy8gb25seSBzaW5nbGUgZ3JvdXAgc3VwcG9ydGVkIGZvciBtb3ZlL2NvcHkgZm9yIG5vd1xuXHRcdGNvbnN0IGVkaXRvcnNXaXRoT3B0aW9ucyA9IHByZXBhcmVNb3ZlQ29weUVkaXRvcnMoZ3JvdXAsIGVkaXRvcnMsIHJlc29sdmVkQ29udGV4dC5wcmVzZXJ2ZUZvY3VzKTtcblx0XHRpZiAodGhpcy5tb3ZlKSB7XG5cdFx0XHRncm91cC5tb3ZlRWRpdG9ycyhlZGl0b3JzV2l0aE9wdGlvbnMsIGF1eGlsaWFyeUVkaXRvclBhcnQuYWN0aXZlR3JvdXApO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRncm91cC5jb3B5RWRpdG9ycyhlZGl0b3JzV2l0aE9wdGlvbnMsIGF1eGlsaWFyeUVkaXRvclBhcnQuYWN0aXZlR3JvdXApO1xuXHRcdH1cblxuXHRcdGF1eGlsaWFyeUVkaXRvclBhcnQuYWN0aXZlR3JvdXAuZm9jdXMoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTW92ZUVkaXRvclRvTmV3V2luZG93QWN0aW9uIGV4dGVuZHMgQmFzZU1vdmVDb3B5RWRpdG9yVG9OZXdXaW5kb3dBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKFxuXHRcdFx0TU9WRV9FRElUT1JfSU5UT19ORVdfV0lORE9XX0NPTU1BTkRfSUQsXG5cdFx0XHR7XG5cdFx0XHRcdC4uLmxvY2FsaXplMignbW92ZUVkaXRvclRvTmV3V2luZG93JywgXCJNb3ZlIEVkaXRvciBpbnRvIE5ldyBXaW5kb3dcIiksXG5cdFx0XHRcdG1uZW1vbmljVGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlNb3ZlRWRpdG9yVG9OZXdXaW5kb3cnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZNb3ZlIEVkaXRvciBpbnRvIE5ldyBXaW5kb3dcIiksXG5cdFx0XHR9LFxuXHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0dHJ1ZVxuXHRcdCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIENvcHlFZGl0b3JUb05ld2luZG93QWN0aW9uIGV4dGVuZHMgQmFzZU1vdmVDb3B5RWRpdG9yVG9OZXdXaW5kb3dBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKFxuXHRcdFx0Q09QWV9FRElUT1JfSU5UT19ORVdfV0lORE9XX0NPTU1BTkRfSUQsXG5cdFx0XHR7XG5cdFx0XHRcdC4uLmxvY2FsaXplMignY29weUVkaXRvclRvTmV3V2luZG93JywgXCJDb3B5IEVkaXRvciBpbnRvIE5ldyBXaW5kb3dcIiksXG5cdFx0XHRcdG1uZW1vbmljVGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlDb3B5RWRpdG9yVG9OZXdXaW5kb3cnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZDb3B5IEVkaXRvciBpbnRvIE5ldyBXaW5kb3dcIiksXG5cdFx0XHR9LFxuXHRcdFx0eyBwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5Q29kZS5LZXlPKSwgd2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIgfSxcblx0XHRcdGZhbHNlXG5cdFx0KTtcblx0fVxufVxuXG5hYnN0cmFjdCBjbGFzcyBCYXNlTW92ZUNvcHlFZGl0b3JHcm91cFRvTmV3V2luZG93QWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0aWQ6IHN0cmluZyxcblx0XHR0aXRsZTogSUNvbW1hbmRBY3Rpb25UaXRsZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IG1vdmU6IGJvb2xlYW5cblx0KSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQsXG5cdFx0XHR0aXRsZSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXcsXG5cdFx0XHRmMTogdHJ1ZVxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZWRpdG9yR3JvdXBTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JHcm91cHNTZXJ2aWNlKTtcblx0XHRjb25zdCBhY3RpdmVHcm91cCA9IGVkaXRvckdyb3VwU2VydmljZS5hY3RpdmVHcm91cDtcblxuXHRcdGNvbnN0IGF1eGlsaWFyeUVkaXRvclBhcnQgPSBhd2FpdCBlZGl0b3JHcm91cFNlcnZpY2UuY3JlYXRlQXV4aWxpYXJ5RWRpdG9yUGFydCgpO1xuXG5cdFx0ZWRpdG9yR3JvdXBTZXJ2aWNlLm1lcmdlR3JvdXAoYWN0aXZlR3JvdXAsIGF1eGlsaWFyeUVkaXRvclBhcnQuYWN0aXZlR3JvdXAsIHtcblx0XHRcdG1vZGU6IHRoaXMubW92ZSA/IE1lcmdlR3JvdXBNb2RlLk1PVkVfRURJVE9SUyA6IE1lcmdlR3JvdXBNb2RlLkNPUFlfRURJVE9SU1xuXHRcdH0pO1xuXG5cdFx0YXV4aWxpYXJ5RWRpdG9yUGFydC5hY3RpdmVHcm91cC5mb2N1cygpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBNb3ZlRWRpdG9yR3JvdXBUb05ld1dpbmRvd0FjdGlvbiBleHRlbmRzIEJhc2VNb3ZlQ29weUVkaXRvckdyb3VwVG9OZXdXaW5kb3dBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKFxuXHRcdFx0TU9WRV9FRElUT1JfR1JPVVBfSU5UT19ORVdfV0lORE9XX0NPTU1BTkRfSUQsXG5cdFx0XHR7XG5cdFx0XHRcdC4uLmxvY2FsaXplMignbW92ZUVkaXRvckdyb3VwVG9OZXdXaW5kb3cnLCBcIk1vdmUgRWRpdG9yIEdyb3VwIGludG8gTmV3IFdpbmRvd1wiKSxcblx0XHRcdFx0bW5lbW9uaWNUaXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaU1vdmVFZGl0b3JHcm91cFRvTmV3V2luZG93JywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmTW92ZSBFZGl0b3IgR3JvdXAgaW50byBOZXcgV2luZG93XCIpLFxuXHRcdFx0fSxcblx0XHRcdHRydWVcblx0XHQpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDb3B5RWRpdG9yR3JvdXBUb05ld1dpbmRvd0FjdGlvbiBleHRlbmRzIEJhc2VNb3ZlQ29weUVkaXRvckdyb3VwVG9OZXdXaW5kb3dBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKFxuXHRcdFx0Q09QWV9FRElUT1JfR1JPVVBfSU5UT19ORVdfV0lORE9XX0NPTU1BTkRfSUQsXG5cdFx0XHR7XG5cdFx0XHRcdC4uLmxvY2FsaXplMignY29weUVkaXRvckdyb3VwVG9OZXdXaW5kb3cnLCBcIkNvcHkgRWRpdG9yIEdyb3VwIGludG8gTmV3IFdpbmRvd1wiKSxcblx0XHRcdFx0bW5lbW9uaWNUaXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaUNvcHlFZGl0b3JHcm91cFRvTmV3V2luZG93JywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmQ29weSBFZGl0b3IgR3JvdXAgaW50byBOZXcgV2luZG93XCIpLFxuXHRcdFx0fSxcblx0XHRcdGZhbHNlXG5cdFx0KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUmVzdG9yZUVkaXRvcnNUb01haW5XaW5kb3dBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ucmVzdG9yZUVkaXRvcnNUb01haW5XaW5kb3cnLFxuXHRcdFx0dGl0bGU6IHtcblx0XHRcdFx0Li4ubG9jYWxpemUyKCdyZXN0b3JlRWRpdG9yc1RvTWFpbldpbmRvdycsIFwiUmVzdG9yZSBFZGl0b3JzIGludG8gTWFpbiBXaW5kb3dcIiksXG5cdFx0XHRcdG1uZW1vbmljVGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlSZXN0b3JlRWRpdG9yc1RvTWFpbldpbmRvdycsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJlJlc3RvcmUgRWRpdG9ycyBpbnRvIE1haW4gV2luZG93XCIpLFxuXHRcdFx0fSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBJc0F1eGlsaWFyeVdpbmRvd0ZvY3VzZWRDb250ZXh0LFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlld1xuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZWRpdG9yR3JvdXBTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JHcm91cHNTZXJ2aWNlKTtcblxuXHRcdGVkaXRvckdyb3VwU2VydmljZS5tZXJnZUFsbEdyb3VwcyhlZGl0b3JHcm91cFNlcnZpY2UubWFpblBhcnQuYWN0aXZlR3JvdXApO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBOZXdFbXB0eUVkaXRvcldpbmRvd0FjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBORVdfRU1QVFlfRURJVE9SX1dJTkRPV19DT01NQU5EX0lELFxuXHRcdFx0dGl0bGU6IHtcblx0XHRcdFx0Li4ubG9jYWxpemUyKCduZXdFbXB0eUVkaXRvcldpbmRvdycsIFwiTmV3IEVtcHR5IEVkaXRvciBXaW5kb3dcIiksXG5cdFx0XHRcdG1uZW1vbmljVGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlOZXdFbXB0eUVkaXRvcldpbmRvdycsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJk5ldyBFbXB0eSBFZGl0b3IgV2luZG93XCIpLFxuXHRcdFx0fSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlld1xuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZWRpdG9yR3JvdXBTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JHcm91cHNTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGF1eGlsaWFyeUVkaXRvclBhcnQgPSBhd2FpdCBlZGl0b3JHcm91cFNlcnZpY2UuY3JlYXRlQXV4aWxpYXJ5RWRpdG9yUGFydCgpO1xuXHRcdGF1eGlsaWFyeUVkaXRvclBhcnQuYWN0aXZlR3JvdXAuZm9jdXMoKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLFVBQVUsaUJBQWlCO0FBQ3BDLFNBQVMsY0FBYztBQUN2QixTQUFvRCxnQkFBZ0IsWUFBWSxjQUFjLHlCQUF5Qiw0QkFBNkMsOEJBQThCO0FBRWxNLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMseUJBQXlCLGFBQWE7QUFDL0MsU0FBUyxVQUFVLHVCQUF1QjtBQUMxQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFT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
