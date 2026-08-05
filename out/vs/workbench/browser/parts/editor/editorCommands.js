import { KeyChord, KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { Schemas, matchesScheme } from "../../../../base/common/network.js";
import { extname } from "../../../../base/common/resources.js";
import { isNumber, isObject, isString, isUndefined } from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import { isDiffEditor } from "../../../../editor/browser/editorBrowser.js";
import { EditorContextKeys } from "../../../../editor/common/editorContextKeys.js";
import { localize, localize2 } from "../../../../nls.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { CommandsRegistry, ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { EditorResolution } from "../../../../platform/editor/common/editor.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight, KeybindingsRegistry } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IListService } from "../../../../platform/list/browser/listService.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { ActiveGroupEditorsByMostRecentlyUsedQuickAccess } from "./editorQuickAccess.js";
import { SideBySideEditor } from "./sideBySideEditor.js";
import { TextDiffEditor } from "./textDiffEditor.js";
import { ActiveEditorCanSplitInGroupContext, ActiveEditorGroupEmptyContext, ActiveEditorGroupLockedContext, ActiveEditorStickyContext, MultipleEditorGroupsContext, SideBySideEditorActiveContext, TextCompareEditorActiveContext } from "../../../common/contextkeys.js";
import { CloseDirection, EditorInputCapabilities, EditorsOrder, isEditorInputWithOptionsAndGroup } from "../../../common/editor.js";
import { DiffEditorInput } from "../../../common/editor/diffEditorInput.js";
import { SideBySideEditorInput } from "../../../common/editor/sideBySideEditorInput.js";
import { columnToEditorGroup } from "../../../services/editor/common/editorGroupColumn.js";
import { GroupDirection, GroupLocation, GroupsOrder, IEditorGroupsService, preferredSideBySideGroupDirection } from "../../../services/editor/common/editorGroupsService.js";
import { IEditorResolverService } from "../../../services/editor/common/editorResolverService.js";
import { IEditorService, SIDE_GROUP } from "../../../services/editor/common/editorService.js";
import { IPathService } from "../../../services/path/common/pathService.js";
import { IUntitledTextEditorService } from "../../../services/untitled/common/untitledTextEditorService.js";
import { DIFF_FOCUS_OTHER_SIDE, DIFF_FOCUS_PRIMARY_SIDE, DIFF_FOCUS_SECONDARY_SIDE, DIFF_OPEN_SIDE, registerDiffEditorCommands } from "./diffEditorCommands.js";
import { resolveCommandsContext } from "./editorCommandsContext.js";
import { prepareMoveCopyEditors } from "./editor.js";
const CLOSE_SAVED_EDITORS_COMMAND_ID = "workbench.action.closeUnmodifiedEditors";
const CLOSE_EDITORS_IN_GROUP_COMMAND_ID = "workbench.action.closeEditorsInGroup";
const CLOSE_EDITORS_AND_GROUP_COMMAND_ID = "workbench.action.closeEditorsAndGroup";
const CLOSE_EDITORS_TO_THE_RIGHT_COMMAND_ID = "workbench.action.closeEditorsToTheRight";
const CLOSE_EDITOR_COMMAND_ID = "workbench.action.closeActiveEditor";
const CLOSE_PINNED_EDITOR_COMMAND_ID = "workbench.action.closeActivePinnedEditor";
const CLOSE_EDITOR_GROUP_COMMAND_ID = "workbench.action.closeGroup";
const CLOSE_OTHER_EDITORS_IN_GROUP_COMMAND_ID = "workbench.action.closeOtherEditors";
const MOVE_ACTIVE_EDITOR_COMMAND_ID = "moveActiveEditor";
const COPY_ACTIVE_EDITOR_COMMAND_ID = "copyActiveEditor";
const LAYOUT_EDITOR_GROUPS_COMMAND_ID = "layoutEditorGroups";
const KEEP_EDITOR_COMMAND_ID = "workbench.action.keepEditor";
const TOGGLE_KEEP_EDITORS_COMMAND_ID = "workbench.action.toggleKeepEditors";
const TOGGLE_LOCK_GROUP_COMMAND_ID = "workbench.action.toggleEditorGroupLock";
const LOCK_GROUP_COMMAND_ID = "workbench.action.lockEditorGroup";
const UNLOCK_GROUP_COMMAND_ID = "workbench.action.unlockEditorGroup";
const SHOW_EDITORS_IN_GROUP = "workbench.action.showEditorsInGroup";
const REOPEN_WITH_COMMAND_ID = "workbench.action.reopenWithEditor";
const PIN_EDITOR_COMMAND_ID = "workbench.action.pinEditor";
const UNPIN_EDITOR_COMMAND_ID = "workbench.action.unpinEditor";
const SPLIT_EDITOR = "workbench.action.splitEditor";
const SPLIT_EDITOR_UP = "workbench.action.splitEditorUp";
const SPLIT_EDITOR_DOWN = "workbench.action.splitEditorDown";
const SPLIT_EDITOR_LEFT = "workbench.action.splitEditorLeft";
const SPLIT_EDITOR_RIGHT = "workbench.action.splitEditorRight";
const TOGGLE_MAXIMIZE_EDITOR_GROUP = "workbench.action.toggleMaximizeEditorGroup";
const SPLIT_EDITOR_IN_GROUP = "workbench.action.splitEditorInGroup";
const TOGGLE_SPLIT_EDITOR_IN_GROUP = "workbench.action.toggleSplitEditorInGroup";
const JOIN_EDITOR_IN_GROUP = "workbench.action.joinEditorInGroup";
const TOGGLE_SPLIT_EDITOR_IN_GROUP_LAYOUT = "workbench.action.toggleSplitEditorInGroupLayout";
const FOCUS_FIRST_SIDE_EDITOR = "workbench.action.focusFirstSideEditor";
const FOCUS_SECOND_SIDE_EDITOR = "workbench.action.focusSecondSideEditor";
const FOCUS_OTHER_SIDE_EDITOR = "workbench.action.focusOtherSideEditor";
const FOCUS_LEFT_GROUP_WITHOUT_WRAP_COMMAND_ID = "workbench.action.focusLeftGroupWithoutWrap";
const FOCUS_RIGHT_GROUP_WITHOUT_WRAP_COMMAND_ID = "workbench.action.focusRightGroupWithoutWrap";
const FOCUS_ABOVE_GROUP_WITHOUT_WRAP_COMMAND_ID = "workbench.action.focusAboveGroupWithoutWrap";
const FOCUS_BELOW_GROUP_WITHOUT_WRAP_COMMAND_ID = "workbench.action.focusBelowGroupWithoutWrap";
const OPEN_EDITOR_AT_INDEX_COMMAND_ID = "workbench.action.openEditorAtIndex";
const MOVE_EDITOR_INTO_NEW_WINDOW_COMMAND_ID = "workbench.action.moveEditorToNewWindow";
const COPY_EDITOR_INTO_NEW_WINDOW_COMMAND_ID = "workbench.action.copyEditorToNewWindow";
const MOVE_EDITOR_GROUP_INTO_NEW_WINDOW_COMMAND_ID = "workbench.action.moveEditorGroupToNewWindow";
const COPY_EDITOR_GROUP_INTO_NEW_WINDOW_COMMAND_ID = "workbench.action.copyEditorGroupToNewWindow";
const NEW_EMPTY_EDITOR_WINDOW_COMMAND_ID = "workbench.action.newEmptyEditorWindow";
const API_OPEN_EDITOR_COMMAND_ID = "_workbench.open";
const API_OPEN_DIFF_EDITOR_COMMAND_ID = "_workbench.diff";
const API_OPEN_WITH_EDITOR_COMMAND_ID = "_workbench.openWith";
const EDITOR_CORE_NAVIGATION_COMMANDS = [
  SPLIT_EDITOR,
  CLOSE_EDITOR_COMMAND_ID,
  UNPIN_EDITOR_COMMAND_ID,
  UNLOCK_GROUP_COMMAND_ID,
  TOGGLE_MAXIMIZE_EDITOR_GROUP
];
const isSelectedEditorsMoveCopyArg = function(arg) {
  if (!isObject(arg)) {
    return false;
  }
  if (!isString(arg.to)) {
    return false;
  }
  if (!isUndefined(arg.by) && !isString(arg.by)) {
    return false;
  }
  if (!isUndefined(arg.value) && !isNumber(arg.value)) {
    return false;
  }
  return true;
};
function registerActiveEditorMoveCopyCommand() {
  const moveCopyJSONSchema = {
    "type": "object",
    "required": ["to"],
    "properties": {
      "to": {
        "type": "string",
        "enum": ["left", "right"]
      },
      "by": {
        "type": "string",
        "enum": ["tab", "group"]
      },
      "value": {
        "type": "number"
      }
    }
  };
  KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: MOVE_ACTIVE_EDITOR_COMMAND_ID,
    weight: KeybindingWeight.WorkbenchContrib,
    when: EditorContextKeys.editorTextFocus,
    primary: 0,
    handler: (accessor, args) => moveCopySelectedEditors(true, args, accessor),
    metadata: {
      description: localize("editorCommand.activeEditorMove.description", "Move the active editor by tabs or groups"),
      args: [
        {
          name: localize("editorCommand.activeEditorMove.arg.name", "Active editor move argument"),
          description: localize("editorCommand.activeEditorMove.arg.description", "Argument Properties:\n	* 'to': String value providing where to move.\n	* 'by': String value providing the unit for move (by tab or by group).\n	* 'value': Number value providing how many positions or an absolute position to move."),
          constraint: isSelectedEditorsMoveCopyArg,
          schema: moveCopyJSONSchema
        }
      ]
    }
  });
  KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: COPY_ACTIVE_EDITOR_COMMAND_ID,
    weight: KeybindingWeight.WorkbenchContrib,
    when: EditorContextKeys.editorTextFocus,
    primary: 0,
    handler: (accessor, args) => moveCopySelectedEditors(false, args, accessor),
    metadata: {
      description: localize("editorCommand.activeEditorCopy.description", "Copy the active editor by groups"),
      args: [
        {
          name: localize("editorCommand.activeEditorCopy.arg.name", "Active editor copy argument"),
          description: localize("editorCommand.activeEditorCopy.arg.description", "Argument Properties:\n	* 'to': String value providing where to copy.\n	* 'value': Number value providing how many positions or an absolute position to copy."),
          constraint: isSelectedEditorsMoveCopyArg,
          schema: moveCopyJSONSchema
        }
      ]
    }
  });
  function moveCopySelectedEditors(isMove, args = /* @__PURE__ */ Object.create(null), accessor) {
    args.to = args.to || "right";
    args.by = args.by || "tab";
    args.value = typeof args.value === "number" ? args.value : 1;
    const activeGroup = accessor.get(IEditorGroupsService).activeGroup;
    const selectedEditors = activeGroup.selectedEditors;
    if (selectedEditors.length > 0) {
      switch (args.by) {
        case "tab":
          if (isMove) {
            return moveTabs(args, activeGroup, selectedEditors);
          }
          break;
        case "group":
          return moveCopyActiveEditorToGroup(isMove, args, activeGroup, selectedEditors, accessor);
      }
    }
  }
  function moveTabs(args, group, editors) {
    const to = args.to;
    if (to === "first" || to === "right") {
      editors = [...editors].reverse();
    } else if (to === "position" && (args.value ?? 1) < group.getIndexOfEditor(editors[0])) {
      editors = [...editors].reverse();
    }
    for (const editor of editors) {
      moveTab(args, group, editor);
    }
  }
  function moveTab(args, group, editor) {
    let index = group.getIndexOfEditor(editor);
    switch (args.to) {
      case "first":
        index = 0;
        break;
      case "last":
        index = group.count - 1;
        break;
      case "left":
        index = index - (args.value ?? 1);
        break;
      case "right":
        index = index + (args.value ?? 1);
        break;
      case "center":
        index = Math.round(group.count / 2) - 1;
        break;
      case "position":
        index = (args.value ?? 1) - 1;
        break;
    }
    index = index < 0 ? 0 : index >= group.count ? group.count - 1 : index;
    group.moveEditor(editor, group, { index });
  }
  function moveCopyActiveEditorToGroup(isMove, args, sourceGroup, editors, accessor) {
    const editorGroupsService = accessor.get(IEditorGroupsService);
    const configurationService = accessor.get(IConfigurationService);
    let targetGroup;
    switch (args.to) {
      case "left":
        targetGroup = editorGroupsService.findGroup({ direction: GroupDirection.LEFT }, sourceGroup);
        if (!targetGroup) {
          targetGroup = editorGroupsService.addGroup(sourceGroup, GroupDirection.LEFT);
        }
        break;
      case "right":
        targetGroup = editorGroupsService.findGroup({ direction: GroupDirection.RIGHT }, sourceGroup);
        if (!targetGroup) {
          targetGroup = editorGroupsService.addGroup(sourceGroup, GroupDirection.RIGHT);
        }
        break;
      case "up":
        targetGroup = editorGroupsService.findGroup({ direction: GroupDirection.UP }, sourceGroup);
        if (!targetGroup) {
          targetGroup = editorGroupsService.addGroup(sourceGroup, GroupDirection.UP);
        }
        break;
      case "down":
        targetGroup = editorGroupsService.findGroup({ direction: GroupDirection.DOWN }, sourceGroup);
        if (!targetGroup) {
          targetGroup = editorGroupsService.addGroup(sourceGroup, GroupDirection.DOWN);
        }
        break;
      case "first":
        targetGroup = editorGroupsService.findGroup({ location: GroupLocation.FIRST }, sourceGroup);
        break;
      case "last":
        targetGroup = editorGroupsService.findGroup({ location: GroupLocation.LAST }, sourceGroup);
        break;
      case "previous":
        targetGroup = editorGroupsService.findGroup({ location: GroupLocation.PREVIOUS }, sourceGroup);
        break;
      case "next":
        targetGroup = editorGroupsService.findGroup({ location: GroupLocation.NEXT }, sourceGroup);
        if (!targetGroup) {
          targetGroup = editorGroupsService.addGroup(sourceGroup, preferredSideBySideGroupDirection(configurationService));
        }
        break;
      case "center":
        targetGroup = editorGroupsService.getGroups(GroupsOrder.GRID_APPEARANCE)[editorGroupsService.count / 2 - 1];
        break;
      case "position":
        targetGroup = editorGroupsService.getGroups(GroupsOrder.GRID_APPEARANCE)[(args.value ?? 1) - 1];
        break;
    }
    if (targetGroup) {
      const editorsWithOptions = prepareMoveCopyEditors(sourceGroup, editors);
      if (isMove) {
        sourceGroup.moveEditors(editorsWithOptions, targetGroup);
      } else if (sourceGroup.id !== targetGroup.id) {
        sourceGroup.copyEditors(editorsWithOptions, targetGroup);
      }
      targetGroup.focus();
    }
  }
}
function registerEditorGroupsLayoutCommands() {
  function applyEditorLayout(accessor, layout) {
    if (!layout || typeof layout !== "object") {
      return;
    }
    const editorGroupsService = accessor.get(IEditorGroupsService);
    editorGroupsService.applyLayout(layout);
  }
  CommandsRegistry.registerCommand(LAYOUT_EDITOR_GROUPS_COMMAND_ID, (accessor, args) => {
    applyEditorLayout(accessor, args);
  });
  CommandsRegistry.registerCommand({
    id: "vscode.setEditorLayout",
    handler: (accessor, args) => applyEditorLayout(accessor, args),
    metadata: {
      "description": `Set the editor layout. Editor layout is represented as a tree of groups in which the first group is the root group of the layout.
					The orientation of the first group is 0 (horizontal) by default unless specified otherwise. The other orientations are 1 (vertical).
					The orientation of subsequent groups is the opposite of the orientation of the group that contains it.
					Here are some examples: A layout representing 1 row and 2 columns: { orientation: 0, groups: [{}, {}] }.
					A layout representing 3 rows and 1 column: { orientation: 1, groups: [{}, {}, {}] }.
					A layout representing 3 rows and 1 column in which the second row has 2 columns: { orientation: 1, groups: [{}, { groups: [{}, {}] }, {}] }
					`,
      args: [{
        name: "args",
        schema: {
          "type": "object",
          "required": ["groups"],
          "properties": {
            "orientation": {
              "type": "number",
              "default": 0,
              "description": `The orientation of the root group in the layout. 0 for horizontal, 1 for vertical.`,
              "enum": [0, 1],
              "enumDescriptions": [
                localize("editorGroupLayout.horizontal", "Horizontal"),
                localize("editorGroupLayout.vertical", "Vertical")
              ]
            },
            "groups": {
              "$ref": "#/definitions/editorGroupsSchema",
              "default": [{}, {}]
            }
          }
        }
      }]
    }
  });
  CommandsRegistry.registerCommand({
    id: "vscode.getEditorLayout",
    handler: (accessor) => {
      const editorGroupsService = accessor.get(IEditorGroupsService);
      return editorGroupsService.getLayout();
    },
    metadata: {
      description: "Get Editor Layout",
      args: [],
      returns: "An editor layout object, in the same format as vscode.setEditorLayout"
    }
  });
}
function registerOpenEditorAPICommands() {
  function mixinContext(context, options, column) {
    if (!context) {
      return [options, column];
    }
    return [
      { ...context.editorOptions, ...options ?? /* @__PURE__ */ Object.create(null) },
      context.sideBySide ? SIDE_GROUP : column
    ];
  }
  CommandsRegistry.registerCommand({
    id: "vscode.open",
    handler: (accessor, arg) => {
      accessor.get(ICommandService).executeCommand(API_OPEN_EDITOR_COMMAND_ID, arg);
    },
    metadata: {
      description: "Opens the provided resource in the editor.",
      args: [{ name: "Uri" }]
    }
  });
  CommandsRegistry.registerCommand(API_OPEN_EDITOR_COMMAND_ID, async function(accessor, resourceArg, columnAndOptions, label, context) {
    const editorService = accessor.get(IEditorService);
    const editorGroupsService = accessor.get(IEditorGroupsService);
    const openerService = accessor.get(IOpenerService);
    const pathService = accessor.get(IPathService);
    const configurationService = accessor.get(IConfigurationService);
    const untitledTextEditorService = accessor.get(IUntitledTextEditorService);
    const resourceOrString = typeof resourceArg === "string" ? resourceArg : URI.from(resourceArg, true);
    const [columnArg, optionsArg] = columnAndOptions ?? [];
    if (optionsArg || typeof columnArg === "number" || matchesScheme(resourceOrString, Schemas.untitled)) {
      const [options, column] = mixinContext(context, optionsArg, columnArg);
      const resource = URI.isUri(resourceOrString) ? resourceOrString : URI.parse(resourceOrString);
      let input;
      if (untitledTextEditorService.isUntitledWithAssociatedResource(resource)) {
        input = { resource: resource.with({ scheme: pathService.defaultUriScheme }), forceUntitled: true, options, label };
      } else {
        input = { resource, options, label };
      }
      await editorService.openEditor(input, columnToEditorGroup(editorGroupsService, configurationService, column));
    } else if (matchesScheme(resourceOrString, Schemas.command)) {
      return;
    } else {
      await openerService.open(resourceOrString, { openToSide: context?.sideBySide, editorOptions: context?.editorOptions });
    }
  });
  CommandsRegistry.registerCommand({
    id: "vscode.diff",
    handler: (accessor, left, right, label) => {
      accessor.get(ICommandService).executeCommand(API_OPEN_DIFF_EDITOR_COMMAND_ID, left, right, label);
    },
    metadata: {
      description: "Opens the provided resources in the diff editor to compare their contents.",
      args: [
        { name: "left", description: "Left-hand side resource of the diff editor" },
        { name: "right", description: "Right-hand side resource of the diff editor" },
        { name: "title", description: "Human readable title for the diff editor" }
      ]
    }
  });
  CommandsRegistry.registerCommand(API_OPEN_DIFF_EDITOR_COMMAND_ID, async function(accessor, originalResource, modifiedResource, labelAndOrDescription, columnAndOptions, context) {
    const editorService = accessor.get(IEditorService);
    const editorGroupsService = accessor.get(IEditorGroupsService);
    const configurationService = accessor.get(IConfigurationService);
    const [columnArg, optionsArg] = columnAndOptions ?? [];
    const [options, column] = mixinContext(context, optionsArg, columnArg);
    let label = void 0;
    let description = void 0;
    if (typeof labelAndOrDescription === "string") {
      label = labelAndOrDescription;
    } else if (labelAndOrDescription) {
      label = labelAndOrDescription.label;
      description = labelAndOrDescription.description;
    }
    await editorService.openEditor({
      original: { resource: URI.from(originalResource, true) },
      modified: { resource: URI.from(modifiedResource, true) },
      label,
      description,
      options
    }, columnToEditorGroup(editorGroupsService, configurationService, column));
  });
  CommandsRegistry.registerCommand(API_OPEN_WITH_EDITOR_COMMAND_ID, async (accessor, resource, id, columnAndOptions) => {
    const editorService = accessor.get(IEditorService);
    const editorGroupsService = accessor.get(IEditorGroupsService);
    const configurationService = accessor.get(IConfigurationService);
    const [columnArg, optionsArg] = columnAndOptions ?? [];
    await editorService.openEditor({ resource: URI.from(resource, true), options: { pinned: true, ...optionsArg, override: id } }, columnToEditorGroup(editorGroupsService, configurationService, columnArg));
  });
  CommandsRegistry.registerCommand({
    id: "vscode.changes",
    handler: (accessor, title, resources) => {
      accessor.get(ICommandService).executeCommand("_workbench.changes", title, resources);
    },
    metadata: {
      description: "Opens a list of resources in the changes editor to compare their contents.",
      args: [
        { name: "title", description: "Human readable title for the diff editor" },
        { name: "resources", description: "List of resources to open in the changes editor" }
      ]
    }
  });
  CommandsRegistry.registerCommand("_workbench.changes", async (accessor, title, resources) => {
    const editorService = accessor.get(IEditorService);
    const editor = [];
    for (const [label, original, modified] of resources) {
      editor.push({
        resource: URI.revive(label),
        original: { resource: URI.revive(original) },
        modified: { resource: URI.revive(modified) }
      });
    }
    await editorService.openEditor({ resources: editor, label: title });
  });
  CommandsRegistry.registerCommand("_workbench.openMultiDiffEditor", async (accessor, options) => {
    const editorService = accessor.get(IEditorService);
    await editorService.openEditor({
      multiDiffSource: options.multiDiffSourceUri ? URI.revive(options.multiDiffSourceUri) : void 0,
      resources: options.resources?.map((r) => ({ original: { resource: URI.revive(r.originalUri) }, modified: { resource: URI.revive(r.modifiedUri) } })),
      label: options.title
    });
  });
}
function registerOpenEditorAtIndexCommands() {
  const openEditorAtIndex = (accessor, editorIndex) => {
    const editorService = accessor.get(IEditorService);
    const activeEditorPane = editorService.activeEditorPane;
    if (activeEditorPane) {
      const editor = activeEditorPane.group.getEditorByIndex(editorIndex);
      if (editor) {
        editorService.openEditor(editor);
      }
    }
  };
  CommandsRegistry.registerCommand({
    id: OPEN_EDITOR_AT_INDEX_COMMAND_ID,
    handler: openEditorAtIndex
  });
  for (let i = 0; i < 9; i++) {
    const editorIndex = i;
    const visibleIndex = i + 1;
    KeybindingsRegistry.registerCommandAndKeybindingRule({
      id: OPEN_EDITOR_AT_INDEX_COMMAND_ID + visibleIndex,
      weight: KeybindingWeight.WorkbenchContrib,
      when: void 0,
      primary: KeyMod.Alt | toKeyCode(visibleIndex),
      mac: { primary: KeyMod.WinCtrl | toKeyCode(visibleIndex) },
      handler: (accessor) => openEditorAtIndex(accessor, editorIndex)
    });
  }
  function toKeyCode(index) {
    switch (index) {
      case 0:
        return KeyCode.Digit0;
      case 1:
        return KeyCode.Digit1;
      case 2:
        return KeyCode.Digit2;
      case 3:
        return KeyCode.Digit3;
      case 4:
        return KeyCode.Digit4;
      case 5:
        return KeyCode.Digit5;
      case 6:
        return KeyCode.Digit6;
      case 7:
        return KeyCode.Digit7;
      case 8:
        return KeyCode.Digit8;
      case 9:
        return KeyCode.Digit9;
    }
    throw new Error("invalid index");
  }
}
function registerFocusEditorGroupAtIndexCommands() {
  for (let groupIndex = 1; groupIndex < 8; groupIndex++) {
    KeybindingsRegistry.registerCommandAndKeybindingRule({
      id: toCommandId(groupIndex),
      weight: KeybindingWeight.WorkbenchContrib,
      when: void 0,
      primary: KeyMod.CtrlCmd | toKeyCode(groupIndex),
      handler: (accessor) => {
        const editorGroupsService = accessor.get(IEditorGroupsService);
        const configurationService = accessor.get(IConfigurationService);
        if (groupIndex > editorGroupsService.count) {
          return;
        }
        const groups = editorGroupsService.getGroups(GroupsOrder.GRID_APPEARANCE);
        if (groups[groupIndex]) {
          return groups[groupIndex].focus();
        }
        const direction = preferredSideBySideGroupDirection(configurationService);
        const lastGroup = editorGroupsService.findGroup({ location: GroupLocation.LAST });
        if (!lastGroup) {
          return;
        }
        const newGroup = editorGroupsService.addGroup(lastGroup, direction);
        newGroup.focus();
      }
    });
  }
  function toCommandId(index) {
    switch (index) {
      case 1:
        return "workbench.action.focusSecondEditorGroup";
      case 2:
        return "workbench.action.focusThirdEditorGroup";
      case 3:
        return "workbench.action.focusFourthEditorGroup";
      case 4:
        return "workbench.action.focusFifthEditorGroup";
      case 5:
        return "workbench.action.focusSixthEditorGroup";
      case 6:
        return "workbench.action.focusSeventhEditorGroup";
      case 7:
        return "workbench.action.focusEighthEditorGroup";
    }
    throw new Error("Invalid index");
  }
  function toKeyCode(index) {
    switch (index) {
      case 1:
        return KeyCode.Digit2;
      case 2:
        return KeyCode.Digit3;
      case 3:
        return KeyCode.Digit4;
      case 4:
        return KeyCode.Digit5;
      case 5:
        return KeyCode.Digit6;
      case 6:
        return KeyCode.Digit7;
      case 7:
        return KeyCode.Digit8;
    }
    throw new Error("Invalid index");
  }
}
function splitEditor(editorGroupsService, direction, resolvedContext) {
  if (!resolvedContext.groupedEditors.length) {
    return;
  }
  const { group, editors } = resolvedContext.groupedEditors[0];
  const preserveFocus = resolvedContext.preserveFocus;
  const newGroup = editorGroupsService.addGroup(group, direction);
  for (const editorToCopy of editors) {
    if (editorToCopy && !editorToCopy.hasCapability(EditorInputCapabilities.Singleton)) {
      group.copyEditor(editorToCopy, newGroup, { preserveFocus });
    }
  }
  newGroup.focus();
}
function registerSplitEditorCommands() {
  [
    { id: SPLIT_EDITOR_UP, direction: GroupDirection.UP },
    { id: SPLIT_EDITOR_DOWN, direction: GroupDirection.DOWN },
    { id: SPLIT_EDITOR_LEFT, direction: GroupDirection.LEFT },
    { id: SPLIT_EDITOR_RIGHT, direction: GroupDirection.RIGHT }
  ].forEach(({ id, direction }) => {
    CommandsRegistry.registerCommand(id, function(accessor, ...args) {
      const resolvedContext = resolveCommandsContext(args, accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IListService));
      splitEditor(accessor.get(IEditorGroupsService), direction, resolvedContext);
    });
  });
}
function registerCloseEditorCommands() {
  function closeEditorHandler(accessor, forceCloseStickyEditors, ...args) {
    const editorGroupsService = accessor.get(IEditorGroupsService);
    const editorService = accessor.get(IEditorService);
    let keepStickyEditors = void 0;
    if (forceCloseStickyEditors) {
      keepStickyEditors = false;
    } else if (args.length) {
      keepStickyEditors = false;
    } else {
      keepStickyEditors = editorGroupsService.partOptions.preventPinnedEditorClose === "keyboard" || editorGroupsService.partOptions.preventPinnedEditorClose === "keyboardAndMouse";
    }
    if (keepStickyEditors) {
      const activeGroup = editorGroupsService.activeGroup;
      const activeEditor = activeGroup.activeEditor;
      if (activeEditor && activeGroup.isSticky(activeEditor)) {
        const nextNonStickyEditorInGroup = activeGroup.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE, { excludeSticky: true })[0];
        if (nextNonStickyEditorInGroup) {
          return activeGroup.openEditor(nextNonStickyEditorInGroup);
        }
        const nextNonStickyEditorInAllGroups = editorService.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE, { excludeSticky: true })[0];
        if (nextNonStickyEditorInAllGroups) {
          return Promise.resolve(editorGroupsService.getGroup(nextNonStickyEditorInAllGroups.groupId)?.openEditor(nextNonStickyEditorInAllGroups.editor));
        }
      }
    }
    const resolvedContext = resolveCommandsContext(args, accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IListService));
    const preserveFocus = resolvedContext.preserveFocus;
    return Promise.all(resolvedContext.groupedEditors.map(async ({ group, editors }) => {
      const editorsToClose = editors.filter((editor) => !keepStickyEditors || !group.isSticky(editor));
      await group.closeEditors(editorsToClose, { preserveFocus });
    }));
  }
  KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: CLOSE_EDITOR_COMMAND_ID,
    weight: KeybindingWeight.WorkbenchContrib,
    when: void 0,
    primary: KeyMod.CtrlCmd | KeyCode.KeyW,
    win: { primary: KeyMod.CtrlCmd | KeyCode.F4, secondary: [KeyMod.CtrlCmd | KeyCode.KeyW] },
    handler: (accessor, ...args) => {
      return closeEditorHandler(accessor, false, ...args);
    }
  });
  CommandsRegistry.registerCommand(CLOSE_PINNED_EDITOR_COMMAND_ID, (accessor, ...args) => {
    return closeEditorHandler(accessor, true, ...args);
  });
  KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: CLOSE_EDITORS_IN_GROUP_COMMAND_ID,
    weight: KeybindingWeight.WorkbenchContrib,
    when: void 0,
    primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.KeyW),
    handler: (accessor, ...args) => {
      const resolvedContext = resolveCommandsContext(args, accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IListService));
      return Promise.all(resolvedContext.groupedEditors.map(async ({ group }) => {
        await group.closeAllEditors({ excludeSticky: true });
      }));
    }
  });
  KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: CLOSE_EDITOR_GROUP_COMMAND_ID,
    weight: KeybindingWeight.WorkbenchContrib,
    when: ContextKeyExpr.and(ActiveEditorGroupEmptyContext, MultipleEditorGroupsContext),
    primary: KeyMod.CtrlCmd | KeyCode.KeyW,
    win: { primary: KeyMod.CtrlCmd | KeyCode.F4, secondary: [KeyMod.CtrlCmd | KeyCode.KeyW] },
    handler: (accessor, ...args) => {
      const editorGroupsService = accessor.get(IEditorGroupsService);
      const commandsContext = resolveCommandsContext(args, accessor.get(IEditorService), editorGroupsService, accessor.get(IListService));
      if (commandsContext.groupedEditors.length) {
        editorGroupsService.removeGroup(commandsContext.groupedEditors[0].group);
      }
    }
  });
  KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: CLOSE_SAVED_EDITORS_COMMAND_ID,
    weight: KeybindingWeight.WorkbenchContrib,
    when: void 0,
    primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.KeyU),
    handler: (accessor, ...args) => {
      const resolvedContext = resolveCommandsContext(args, accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IListService));
      return Promise.all(resolvedContext.groupedEditors.map(async ({ group }) => {
        await group.closeEditors({ savedOnly: true, excludeSticky: true }, { preserveFocus: resolvedContext.preserveFocus });
      }));
    }
  });
  KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: CLOSE_OTHER_EDITORS_IN_GROUP_COMMAND_ID,
    weight: KeybindingWeight.WorkbenchContrib,
    when: void 0,
    primary: void 0,
    mac: { primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyT },
    handler: (accessor, ...args) => {
      const resolvedContext = resolveCommandsContext(args, accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IListService));
      return Promise.all(resolvedContext.groupedEditors.map(async ({ group, editors }) => {
        const editorsToClose = group.getEditors(EditorsOrder.SEQUENTIAL, { excludeSticky: true }).filter((editor) => !editors.includes(editor));
        for (const editorToKeep of editors) {
          if (editorToKeep) {
            group.pinEditor(editorToKeep);
          }
        }
        await group.closeEditors(editorsToClose, { preserveFocus: resolvedContext.preserveFocus });
      }));
    }
  });
  KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: CLOSE_EDITORS_TO_THE_RIGHT_COMMAND_ID,
    weight: KeybindingWeight.WorkbenchContrib,
    when: void 0,
    primary: void 0,
    handler: async (accessor, ...args) => {
      const resolvedContext = resolveCommandsContext(args, accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IListService));
      if (resolvedContext.groupedEditors.length) {
        const { group, editors } = resolvedContext.groupedEditors[0];
        if (group.activeEditor) {
          group.pinEditor(group.activeEditor);
        }
        await group.closeEditors({ direction: CloseDirection.RIGHT, except: editors[0], excludeSticky: true }, { preserveFocus: resolvedContext.preserveFocus });
      }
    }
  });
  KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: REOPEN_WITH_COMMAND_ID,
    weight: KeybindingWeight.WorkbenchContrib,
    when: void 0,
    primary: void 0,
    handler: async (accessor, ...args) => {
      const editorService = accessor.get(IEditorService);
      const editorResolverService = accessor.get(IEditorResolverService);
      const telemetryService = accessor.get(ITelemetryService);
      const resolvedContext = resolveCommandsContext(args, editorService, accessor.get(IEditorGroupsService), accessor.get(IListService));
      const editorReplacements = /* @__PURE__ */ new Map();
      for (const { group, editors } of resolvedContext.groupedEditors) {
        for (const editor of editors) {
          const untypedEditor = editor.toUntyped();
          if (!untypedEditor) {
            return;
          }
          untypedEditor.options = { ...editorService.activeEditorPane?.options, override: EditorResolution.PICK };
          const resolvedEditor = await editorResolverService.resolveEditor(untypedEditor, group);
          if (!isEditorInputWithOptionsAndGroup(resolvedEditor)) {
            return;
          }
          let editorReplacementsInGroup = editorReplacements.get(group);
          if (!editorReplacementsInGroup) {
            editorReplacementsInGroup = [];
            editorReplacements.set(group, editorReplacementsInGroup);
          }
          editorReplacementsInGroup.push({
            editor,
            replacement: resolvedEditor.editor,
            forceReplaceDirty: editor.resource?.scheme === Schemas.untitled,
            options: resolvedEditor.options
          });
          telemetryService.publicLog2("workbenchEditorReopen", {
            scheme: editor.resource?.scheme ?? "",
            ext: editor.resource ? extname(editor.resource) : "",
            from: editor.editorId ?? "",
            to: resolvedEditor.editor.editorId ?? ""
          });
        }
      }
      for (const [group, replacements] of editorReplacements) {
        await group.replaceEditors(replacements);
        await group.openEditor(replacements[0].replacement);
      }
    }
  });
  CommandsRegistry.registerCommand(CLOSE_EDITORS_AND_GROUP_COMMAND_ID, async (accessor, ...args) => {
    const editorGroupsService = accessor.get(IEditorGroupsService);
    const resolvedContext = resolveCommandsContext(args, accessor.get(IEditorService), editorGroupsService, accessor.get(IListService));
    if (resolvedContext.groupedEditors.length) {
      const { group } = resolvedContext.groupedEditors[0];
      await group.closeAllEditors();
      if (group.count === 0 && editorGroupsService.getGroup(group.id)) {
        editorGroupsService.removeGroup(group);
      }
    }
  });
}
function registerFocusEditorGroupWihoutWrapCommands() {
  const commands = [
    {
      id: FOCUS_LEFT_GROUP_WITHOUT_WRAP_COMMAND_ID,
      direction: GroupDirection.LEFT
    },
    {
      id: FOCUS_RIGHT_GROUP_WITHOUT_WRAP_COMMAND_ID,
      direction: GroupDirection.RIGHT
    },
    {
      id: FOCUS_ABOVE_GROUP_WITHOUT_WRAP_COMMAND_ID,
      direction: GroupDirection.UP
    },
    {
      id: FOCUS_BELOW_GROUP_WITHOUT_WRAP_COMMAND_ID,
      direction: GroupDirection.DOWN
    }
  ];
  for (const command of commands) {
    CommandsRegistry.registerCommand(command.id, async (accessor) => {
      const editorGroupsService = accessor.get(IEditorGroupsService);
      const group = editorGroupsService.findGroup({ direction: command.direction }, editorGroupsService.activeGroup, false) ?? editorGroupsService.activeGroup;
      group.focus();
    });
  }
}
function registerSplitEditorInGroupCommands() {
  async function splitEditorInGroup(accessor, resolvedContext) {
    const instantiationService = accessor.get(IInstantiationService);
    if (!resolvedContext.groupedEditors.length) {
      return;
    }
    const { group, editors } = resolvedContext.groupedEditors[0];
    const editor = editors[0];
    if (!editor) {
      return;
    }
    await group.replaceEditors([{
      editor,
      replacement: instantiationService.createInstance(SideBySideEditorInput, void 0, void 0, editor, editor),
      forceReplaceDirty: true
    }]);
  }
  registerAction2(class extends Action2 {
    constructor() {
      super({
        id: SPLIT_EDITOR_IN_GROUP,
        title: localize2("splitEditorInGroup", "Split Editor in Group"),
        category: Categories.View,
        precondition: ActiveEditorCanSplitInGroupContext,
        f1: true,
        keybinding: {
          weight: KeybindingWeight.WorkbenchContrib,
          when: ActiveEditorCanSplitInGroupContext,
          primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Backslash)
        }
      });
    }
    run(accessor, ...args) {
      return splitEditorInGroup(accessor, resolveCommandsContext(args, accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IListService)));
    }
  });
  async function joinEditorInGroup(resolvedContext) {
    if (!resolvedContext.groupedEditors.length) {
      return;
    }
    const { group, editors } = resolvedContext.groupedEditors[0];
    const editor = editors[0];
    if (!editor) {
      return;
    }
    if (!(editor instanceof SideBySideEditorInput)) {
      return;
    }
    let options = void 0;
    const activeEditorPane = group.activeEditorPane;
    if (activeEditorPane instanceof SideBySideEditor && group.activeEditor === editor) {
      for (const pane of [activeEditorPane.getPrimaryEditorPane(), activeEditorPane.getSecondaryEditorPane()]) {
        if (pane?.hasFocus()) {
          options = { viewState: pane.getViewState() };
          break;
        }
      }
    }
    await group.replaceEditors([{
      editor,
      replacement: editor.primary,
      options
    }]);
  }
  registerAction2(class extends Action2 {
    constructor() {
      super({
        id: JOIN_EDITOR_IN_GROUP,
        title: localize2("joinEditorInGroup", "Join Editor in Group"),
        category: Categories.View,
        precondition: SideBySideEditorActiveContext,
        f1: true,
        keybinding: {
          weight: KeybindingWeight.WorkbenchContrib,
          when: SideBySideEditorActiveContext,
          primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Backslash)
        }
      });
    }
    run(accessor, ...args) {
      return joinEditorInGroup(resolveCommandsContext(args, accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IListService)));
    }
  });
  registerAction2(class extends Action2 {
    constructor() {
      super({
        id: TOGGLE_SPLIT_EDITOR_IN_GROUP,
        title: localize2("toggleJoinEditorInGroup", "Toggle Split Editor in Group"),
        category: Categories.View,
        precondition: ContextKeyExpr.or(ActiveEditorCanSplitInGroupContext, SideBySideEditorActiveContext),
        f1: true
      });
    }
    async run(accessor, ...args) {
      const resolvedContext = resolveCommandsContext(args, accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IListService));
      if (!resolvedContext.groupedEditors.length) {
        return;
      }
      const { editors } = resolvedContext.groupedEditors[0];
      if (editors[0] instanceof SideBySideEditorInput) {
        await joinEditorInGroup(resolvedContext);
      } else if (editors[0]) {
        await splitEditorInGroup(accessor, resolvedContext);
      }
    }
  });
  registerAction2(class extends Action2 {
    constructor() {
      super({
        id: TOGGLE_SPLIT_EDITOR_IN_GROUP_LAYOUT,
        title: localize2("toggleSplitEditorInGroupLayout", "Toggle Layout of Split Editor in Group"),
        category: Categories.View,
        precondition: SideBySideEditorActiveContext,
        f1: true
      });
    }
    async run(accessor) {
      const configurationService = accessor.get(IConfigurationService);
      const currentSetting = configurationService.getValue(SideBySideEditor.SIDE_BY_SIDE_LAYOUT_SETTING);
      let newSetting;
      if (currentSetting !== "horizontal") {
        newSetting = "horizontal";
      } else {
        newSetting = "vertical";
      }
      return configurationService.updateValue(SideBySideEditor.SIDE_BY_SIDE_LAYOUT_SETTING, newSetting);
    }
  });
}
function registerFocusSideEditorsCommands() {
  registerAction2(class extends Action2 {
    constructor() {
      super({
        id: FOCUS_FIRST_SIDE_EDITOR,
        title: localize2("focusLeftSideEditor", "Focus First Side in Active Editor"),
        category: Categories.View,
        precondition: ContextKeyExpr.or(SideBySideEditorActiveContext, TextCompareEditorActiveContext),
        f1: true
      });
    }
    async run(accessor) {
      const editorService = accessor.get(IEditorService);
      const commandService = accessor.get(ICommandService);
      const activeEditorPane = editorService.activeEditorPane;
      if (activeEditorPane instanceof SideBySideEditor) {
        activeEditorPane.getSecondaryEditorPane()?.focus();
      } else if (activeEditorPane instanceof TextDiffEditor) {
        await commandService.executeCommand(DIFF_FOCUS_SECONDARY_SIDE);
      }
    }
  });
  registerAction2(class extends Action2 {
    constructor() {
      super({
        id: FOCUS_SECOND_SIDE_EDITOR,
        title: localize2("focusRightSideEditor", "Focus Second Side in Active Editor"),
        category: Categories.View,
        precondition: ContextKeyExpr.or(SideBySideEditorActiveContext, TextCompareEditorActiveContext),
        f1: true
      });
    }
    async run(accessor) {
      const editorService = accessor.get(IEditorService);
      const commandService = accessor.get(ICommandService);
      const activeEditorPane = editorService.activeEditorPane;
      if (activeEditorPane instanceof SideBySideEditor) {
        activeEditorPane.getPrimaryEditorPane()?.focus();
      } else if (activeEditorPane instanceof TextDiffEditor) {
        await commandService.executeCommand(DIFF_FOCUS_PRIMARY_SIDE);
      }
    }
  });
  registerAction2(class extends Action2 {
    constructor() {
      super({
        id: FOCUS_OTHER_SIDE_EDITOR,
        title: localize2("focusOtherSideEditor", "Focus Other Side in Active Editor"),
        category: Categories.View,
        precondition: ContextKeyExpr.or(SideBySideEditorActiveContext, TextCompareEditorActiveContext),
        f1: true
      });
    }
    async run(accessor) {
      const editorService = accessor.get(IEditorService);
      const commandService = accessor.get(ICommandService);
      const activeEditorPane = editorService.activeEditorPane;
      if (activeEditorPane instanceof SideBySideEditor) {
        if (activeEditorPane.getPrimaryEditorPane()?.hasFocus()) {
          activeEditorPane.getSecondaryEditorPane()?.focus();
        } else {
          activeEditorPane.getPrimaryEditorPane()?.focus();
        }
      } else if (activeEditorPane instanceof TextDiffEditor) {
        await commandService.executeCommand(DIFF_FOCUS_OTHER_SIDE);
      }
    }
  });
}
function registerOtherEditorCommands() {
  KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: KEEP_EDITOR_COMMAND_ID,
    weight: KeybindingWeight.WorkbenchContrib,
    when: void 0,
    primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.Enter),
    handler: async (accessor, ...args) => {
      const resolvedContext = resolveCommandsContext(args, accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IListService));
      for (const { group, editors } of resolvedContext.groupedEditors) {
        for (const editor of editors) {
          group.pinEditor(editor);
        }
      }
    }
  });
  CommandsRegistry.registerCommand({
    id: TOGGLE_KEEP_EDITORS_COMMAND_ID,
    handler: (accessor) => {
      const configurationService = accessor.get(IConfigurationService);
      const currentSetting = configurationService.getValue("workbench.editor.enablePreview");
      const newSetting = currentSetting === true ? false : true;
      configurationService.updateValue("workbench.editor.enablePreview", newSetting);
    }
  });
  function setEditorGroupLock(accessor, locked, ...args) {
    const resolvedContext = resolveCommandsContext(args, accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IListService));
    const group = resolvedContext.groupedEditors[0]?.group;
    group?.lock(locked ?? !group.isLocked);
  }
  registerAction2(class extends Action2 {
    constructor() {
      super({
        id: TOGGLE_LOCK_GROUP_COMMAND_ID,
        title: localize2("toggleEditorGroupLock", "Toggle Editor Group Lock"),
        category: Categories.View,
        f1: true
      });
    }
    async run(accessor, ...args) {
      setEditorGroupLock(accessor, void 0, ...args);
    }
  });
  registerAction2(class extends Action2 {
    constructor() {
      super({
        id: LOCK_GROUP_COMMAND_ID,
        title: localize2("lockEditorGroup", "Lock Editor Group"),
        category: Categories.View,
        precondition: ActiveEditorGroupLockedContext.toNegated(),
        f1: true
      });
    }
    async run(accessor, ...args) {
      setEditorGroupLock(accessor, true, ...args);
    }
  });
  registerAction2(class extends Action2 {
    constructor() {
      super({
        id: UNLOCK_GROUP_COMMAND_ID,
        title: localize2("unlockEditorGroup", "Unlock Editor Group"),
        precondition: ActiveEditorGroupLockedContext,
        category: Categories.View,
        f1: true
      });
    }
    async run(accessor, ...args) {
      setEditorGroupLock(accessor, false, ...args);
    }
  });
  KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: PIN_EDITOR_COMMAND_ID,
    weight: KeybindingWeight.WorkbenchContrib,
    when: ActiveEditorStickyContext.toNegated(),
    primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.Shift | KeyCode.Enter),
    handler: async (accessor, ...args) => {
      const resolvedContext = resolveCommandsContext(args, accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IListService));
      for (const { group, editors } of resolvedContext.groupedEditors) {
        for (const editor of editors) {
          group.stickEditor(editor);
        }
      }
    }
  });
  KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: DIFF_OPEN_SIDE,
    weight: KeybindingWeight.WorkbenchContrib,
    when: EditorContextKeys.inDiffEditor,
    primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.Shift | KeyCode.KeyO),
    handler: async (accessor) => {
      const editorService = accessor.get(IEditorService);
      const editorGroupsService = accessor.get(IEditorGroupsService);
      const activeEditor = editorService.activeEditor;
      const activeTextEditorControl = editorService.activeTextEditorControl;
      if (!isDiffEditor(activeTextEditorControl) || !(activeEditor instanceof DiffEditorInput)) {
        return;
      }
      let editor;
      const originalEditor = activeTextEditorControl.getOriginalEditor();
      if (originalEditor.hasTextFocus()) {
        editor = activeEditor.original;
      } else {
        editor = activeEditor.modified;
      }
      return editorGroupsService.activeGroup.openEditor(editor);
    }
  });
  KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: UNPIN_EDITOR_COMMAND_ID,
    weight: KeybindingWeight.WorkbenchContrib,
    when: ActiveEditorStickyContext,
    primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.Shift | KeyCode.Enter),
    handler: async (accessor, ...args) => {
      const resolvedContext = resolveCommandsContext(args, accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IListService));
      for (const { group, editors } of resolvedContext.groupedEditors) {
        for (const editor of editors) {
          group.unstickEditor(editor);
        }
      }
    }
  });
  KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: SHOW_EDITORS_IN_GROUP,
    weight: KeybindingWeight.WorkbenchContrib,
    when: void 0,
    primary: void 0,
    handler: (accessor, ...args) => {
      const editorGroupsService = accessor.get(IEditorGroupsService);
      const quickInputService = accessor.get(IQuickInputService);
      const commandsContext = resolveCommandsContext(args, accessor.get(IEditorService), editorGroupsService, accessor.get(IListService));
      const group = commandsContext.groupedEditors[0]?.group;
      if (group) {
        editorGroupsService.activateGroup(group);
      }
      return quickInputService.quickAccess.show(ActiveGroupEditorsByMostRecentlyUsedQuickAccess.PREFIX);
    }
  });
}
function setup() {
  registerActiveEditorMoveCopyCommand();
  registerEditorGroupsLayoutCommands();
  registerDiffEditorCommands();
  registerOpenEditorAPICommands();
  registerOpenEditorAtIndexCommands();
  registerCloseEditorCommands();
  registerOtherEditorCommands();
  registerSplitEditorInGroupCommands();
  registerFocusSideEditorsCommands();
  registerFocusEditorGroupAtIndexCommands();
  registerSplitEditorCommands();
  registerFocusEditorGroupWihoutWrapCommands();
}
export {
  API_OPEN_DIFF_EDITOR_COMMAND_ID,
  API_OPEN_EDITOR_COMMAND_ID,
  API_OPEN_WITH_EDITOR_COMMAND_ID,
  CLOSE_EDITORS_AND_GROUP_COMMAND_ID,
  CLOSE_EDITORS_IN_GROUP_COMMAND_ID,
  CLOSE_EDITORS_TO_THE_RIGHT_COMMAND_ID,
  CLOSE_EDITOR_COMMAND_ID,
  CLOSE_EDITOR_GROUP_COMMAND_ID,
  CLOSE_OTHER_EDITORS_IN_GROUP_COMMAND_ID,
  CLOSE_PINNED_EDITOR_COMMAND_ID,
  CLOSE_SAVED_EDITORS_COMMAND_ID,
  COPY_ACTIVE_EDITOR_COMMAND_ID,
  COPY_EDITOR_GROUP_INTO_NEW_WINDOW_COMMAND_ID,
  COPY_EDITOR_INTO_NEW_WINDOW_COMMAND_ID,
  EDITOR_CORE_NAVIGATION_COMMANDS,
  FOCUS_ABOVE_GROUP_WITHOUT_WRAP_COMMAND_ID,
  FOCUS_BELOW_GROUP_WITHOUT_WRAP_COMMAND_ID,
  FOCUS_FIRST_SIDE_EDITOR,
  FOCUS_LEFT_GROUP_WITHOUT_WRAP_COMMAND_ID,
  FOCUS_OTHER_SIDE_EDITOR,
  FOCUS_RIGHT_GROUP_WITHOUT_WRAP_COMMAND_ID,
  FOCUS_SECOND_SIDE_EDITOR,
  JOIN_EDITOR_IN_GROUP,
  KEEP_EDITOR_COMMAND_ID,
  LAYOUT_EDITOR_GROUPS_COMMAND_ID,
  LOCK_GROUP_COMMAND_ID,
  MOVE_ACTIVE_EDITOR_COMMAND_ID,
  MOVE_EDITOR_GROUP_INTO_NEW_WINDOW_COMMAND_ID,
  MOVE_EDITOR_INTO_NEW_WINDOW_COMMAND_ID,
  NEW_EMPTY_EDITOR_WINDOW_COMMAND_ID,
  OPEN_EDITOR_AT_INDEX_COMMAND_ID,
  PIN_EDITOR_COMMAND_ID,
  REOPEN_WITH_COMMAND_ID,
  SHOW_EDITORS_IN_GROUP,
  SPLIT_EDITOR,
  SPLIT_EDITOR_DOWN,
  SPLIT_EDITOR_IN_GROUP,
  SPLIT_EDITOR_LEFT,
  SPLIT_EDITOR_RIGHT,
  SPLIT_EDITOR_UP,
  TOGGLE_KEEP_EDITORS_COMMAND_ID,
  TOGGLE_LOCK_GROUP_COMMAND_ID,
  TOGGLE_MAXIMIZE_EDITOR_GROUP,
  TOGGLE_SPLIT_EDITOR_IN_GROUP,
  TOGGLE_SPLIT_EDITOR_IN_GROUP_LAYOUT,
  UNLOCK_GROUP_COMMAND_ID,
  UNPIN_EDITOR_COMMAND_ID,
  setup,
  splitEditor
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9lZGl0b3IvZWRpdG9yQ29tbWFuZHMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBJSlNPTlNjaGVtYSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb25TY2hlbWEuanMnO1xuaW1wb3J0IHsgS2V5Q2hvcmQsIEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IFNjaGVtYXMsIG1hdGNoZXNTY2hlbWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IGV4dG5hbWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgaXNOdW1iZXIsIGlzT2JqZWN0LCBpc1N0cmluZywgaXNVbmRlZmluZWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBVUkksIFVyaUNvbXBvbmVudHMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgaXNEaWZmRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JDb250ZXh0S2V5cyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yQ29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUsIGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBDYXRlZ29yaWVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9uL2NvbW1vbi9hY3Rpb25Db21tb25DYXRlZ29yaWVzLmpzJztcbmltcG9ydCB7IEFjdGlvbjIsIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ29tbWFuZHNSZWdpc3RyeSwgSUNvbW1hbmRIYW5kbGVyLCBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgRWRpdG9yUmVzb2x1dGlvbiwgSUVkaXRvck9wdGlvbnMsIElSZXNvdXJjZUVkaXRvcklucHV0LCBJVGV4dEVkaXRvck9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9lZGl0b3IvY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdXZWlnaHQsIEtleWJpbmRpbmdzUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElMaXN0U2VydmljZSwgSU9wZW5FdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xpc3QvYnJvd3Nlci9saXN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IElRdWlja0lucHV0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrSW5wdXQuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBBY3RpdmVHcm91cEVkaXRvcnNCeU1vc3RSZWNlbnRseVVzZWRRdWlja0FjY2VzcyB9IGZyb20gJy4vZWRpdG9yUXVpY2tBY2Nlc3MuanMnO1xuaW1wb3J0IHsgU2lkZUJ5U2lkZUVkaXRvciB9IGZyb20gJy4vc2lkZUJ5U2lkZUVkaXRvci5qcyc7XG5pbXBvcnQgeyBUZXh0RGlmZkVkaXRvciB9IGZyb20gJy4vdGV4dERpZmZFZGl0b3IuanMnO1xuaW1wb3J0IHsgQWN0aXZlRWRpdG9yQ2FuU3BsaXRJbkdyb3VwQ29udGV4dCwgQWN0aXZlRWRpdG9yR3JvdXBFbXB0eUNvbnRleHQsIEFjdGl2ZUVkaXRvckdyb3VwTG9ja2VkQ29udGV4dCwgQWN0aXZlRWRpdG9yU3RpY2t5Q29udGV4dCwgTXVsdGlwbGVFZGl0b3JHcm91cHNDb250ZXh0LCBTaWRlQnlTaWRlRWRpdG9yQWN0aXZlQ29udGV4dCwgVGV4dENvbXBhcmVFZGl0b3JBY3RpdmVDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRleHRrZXlzLmpzJztcbmltcG9ydCB7IENsb3NlRGlyZWN0aW9uLCBFZGl0b3JJbnB1dENhcGFiaWxpdGllcywgRWRpdG9yc09yZGVyLCBJUmVzb3VyY2VEaWZmRWRpdG9ySW5wdXQsIElVbnRpdGxlZFRleHRSZXNvdXJjZUVkaXRvcklucHV0LCBpc0VkaXRvcklucHV0V2l0aE9wdGlvbnNBbmRHcm91cCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgRGlmZkVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci9kaWZmRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yL2VkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IFNpZGVCeVNpZGVFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3Ivc2lkZUJ5U2lkZUVkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IEVkaXRvckdyb3VwQ29sdW1uLCBjb2x1bW5Ub0VkaXRvckdyb3VwIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JHcm91cENvbHVtbi5qcyc7XG5pbXBvcnQgeyBFZGl0b3JHcm91cExheW91dCwgR3JvdXBEaXJlY3Rpb24sIEdyb3VwTG9jYXRpb24sIEdyb3Vwc09yZGVyLCBJRWRpdG9yR3JvdXAsIElFZGl0b3JHcm91cHNTZXJ2aWNlLCBJRWRpdG9yUmVwbGFjZW1lbnQsIHByZWZlcnJlZFNpZGVCeVNpZGVHcm91cERpcmVjdGlvbiB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yUmVzb2x2ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JSZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UsIFNJREVfR1JPVVAgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVBhdGhTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcGF0aC9jb21tb24vcGF0aFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVVudGl0bGVkVGV4dEVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy91bnRpdGxlZC9jb21tb24vdW50aXRsZWRUZXh0RWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBESUZGX0ZPQ1VTX09USEVSX1NJREUsIERJRkZfRk9DVVNfUFJJTUFSWV9TSURFLCBESUZGX0ZPQ1VTX1NFQ09OREFSWV9TSURFLCBESUZGX09QRU5fU0lERSwgcmVnaXN0ZXJEaWZmRWRpdG9yQ29tbWFuZHMgfSBmcm9tICcuL2RpZmZFZGl0b3JDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJUmVzb2x2ZWRFZGl0b3JDb21tYW5kc0NvbnRleHQsIHJlc29sdmVDb21tYW5kc0NvbnRleHQgfSBmcm9tICcuL2VkaXRvckNvbW1hbmRzQ29udGV4dC5qcyc7XG5pbXBvcnQgeyBwcmVwYXJlTW92ZUNvcHlFZGl0b3JzIH0gZnJvbSAnLi9lZGl0b3IuanMnO1xuXG5leHBvcnQgY29uc3QgQ0xPU0VfU0FWRURfRURJVE9SU19DT01NQU5EX0lEID0gJ3dvcmtiZW5jaC5hY3Rpb24uY2xvc2VVbm1vZGlmaWVkRWRpdG9ycyc7XG5leHBvcnQgY29uc3QgQ0xPU0VfRURJVE9SU19JTl9HUk9VUF9DT01NQU5EX0lEID0gJ3dvcmtiZW5jaC5hY3Rpb24uY2xvc2VFZGl0b3JzSW5Hcm91cCc7XG5leHBvcnQgY29uc3QgQ0xPU0VfRURJVE9SU19BTkRfR1JPVVBfQ09NTUFORF9JRCA9ICd3b3JrYmVuY2guYWN0aW9uLmNsb3NlRWRpdG9yc0FuZEdyb3VwJztcbmV4cG9ydCBjb25zdCBDTE9TRV9FRElUT1JTX1RPX1RIRV9SSUdIVF9DT01NQU5EX0lEID0gJ3dvcmtiZW5jaC5hY3Rpb24uY2xvc2VFZGl0b3JzVG9UaGVSaWdodCc7XG5leHBvcnQgY29uc3QgQ0xPU0VfRURJVE9SX0NPTU1BTkRfSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5jbG9zZUFjdGl2ZUVkaXRvcic7XG5leHBvcnQgY29uc3QgQ0xPU0VfUElOTkVEX0VESVRPUl9DT01NQU5EX0lEID0gJ3dvcmtiZW5jaC5hY3Rpb24uY2xvc2VBY3RpdmVQaW5uZWRFZGl0b3InO1xuZXhwb3J0IGNvbnN0IENMT1NFX0VESVRPUl9HUk9VUF9DT01NQU5EX0lEID0gJ3dvcmtiZW5jaC5hY3Rpb24uY2xvc2VHcm91cCc7XG5leHBvcnQgY29uc3QgQ0xPU0VfT1RIRVJfRURJVE9SU19JTl9HUk9VUF9DT01NQU5EX0lEID0gJ3dvcmtiZW5jaC5hY3Rpb24uY2xvc2VPdGhlckVkaXRvcnMnO1xuXG5leHBvcnQgY29uc3QgTU9WRV9BQ1RJVkVfRURJVE9SX0NPTU1BTkRfSUQgPSAnbW92ZUFjdGl2ZUVkaXRvcic7XG5leHBvcnQgY29uc3QgQ09QWV9BQ1RJVkVfRURJVE9SX0NPTU1BTkRfSUQgPSAnY29weUFjdGl2ZUVkaXRvcic7XG5leHBvcnQgY29uc3QgTEFZT1VUX0VESVRPUl9HUk9VUFNfQ09NTUFORF9JRCA9ICdsYXlvdXRFZGl0b3JHcm91cHMnO1xuZXhwb3J0IGNvbnN0IEtFRVBfRURJVE9SX0NPTU1BTkRfSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5rZWVwRWRpdG9yJztcbmV4cG9ydCBjb25zdCBUT0dHTEVfS0VFUF9FRElUT1JTX0NPTU1BTkRfSUQgPSAnd29ya2JlbmNoLmFjdGlvbi50b2dnbGVLZWVwRWRpdG9ycyc7XG5leHBvcnQgY29uc3QgVE9HR0xFX0xPQ0tfR1JPVVBfQ09NTUFORF9JRCA9ICd3b3JrYmVuY2guYWN0aW9uLnRvZ2dsZUVkaXRvckdyb3VwTG9jayc7XG5leHBvcnQgY29uc3QgTE9DS19HUk9VUF9DT01NQU5EX0lEID0gJ3dvcmtiZW5jaC5hY3Rpb24ubG9ja0VkaXRvckdyb3VwJztcbmV4cG9ydCBjb25zdCBVTkxPQ0tfR1JPVVBfQ09NTUFORF9JRCA9ICd3b3JrYmVuY2guYWN0aW9uLnVubG9ja0VkaXRvckdyb3VwJztcbmV4cG9ydCBjb25zdCBTSE9XX0VESVRPUlNfSU5fR1JPVVAgPSAnd29ya2JlbmNoLmFjdGlvbi5zaG93RWRpdG9yc0luR3JvdXAnO1xuZXhwb3J0IGNvbnN0IFJFT1BFTl9XSVRIX0NPTU1BTkRfSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5yZW9wZW5XaXRoRWRpdG9yJztcblxuZXhwb3J0IGNvbnN0IFBJTl9FRElUT1JfQ09NTUFORF9JRCA9ICd3b3JrYmVuY2guYWN0aW9uLnBpbkVkaXRvcic7XG5leHBvcnQgY29uc3QgVU5QSU5fRURJVE9SX0NPTU1BTkRfSUQgPSAnd29ya2JlbmNoLmFjdGlvbi51bnBpbkVkaXRvcic7XG5cbmV4cG9ydCBjb25zdCBTUExJVF9FRElUT1IgPSAnd29ya2JlbmNoLmFjdGlvbi5zcGxpdEVkaXRvcic7XG5leHBvcnQgY29uc3QgU1BMSVRfRURJVE9SX1VQID0gJ3dvcmtiZW5jaC5hY3Rpb24uc3BsaXRFZGl0b3JVcCc7XG5leHBvcnQgY29uc3QgU1BMSVRfRURJVE9SX0RPV04gPSAnd29ya2JlbmNoLmFjdGlvbi5zcGxpdEVkaXRvckRvd24nO1xuZXhwb3J0IGNvbnN0IFNQTElUX0VESVRPUl9MRUZUID0gJ3dvcmtiZW5jaC5hY3Rpb24uc3BsaXRFZGl0b3JMZWZ0JztcbmV4cG9ydCBjb25zdCBTUExJVF9FRElUT1JfUklHSFQgPSAnd29ya2JlbmNoLmFjdGlvbi5zcGxpdEVkaXRvclJpZ2h0JztcblxuZXhwb3J0IGNvbnN0IFRPR0dMRV9NQVhJTUlaRV9FRElUT1JfR1JPVVAgPSAnd29ya2JlbmNoLmFjdGlvbi50b2dnbGVNYXhpbWl6ZUVkaXRvckdyb3VwJztcblxuZXhwb3J0IGNvbnN0IFNQTElUX0VESVRPUl9JTl9HUk9VUCA9ICd3b3JrYmVuY2guYWN0aW9uLnNwbGl0RWRpdG9ySW5Hcm91cCc7XG5leHBvcnQgY29uc3QgVE9HR0xFX1NQTElUX0VESVRPUl9JTl9HUk9VUCA9ICd3b3JrYmVuY2guYWN0aW9uLnRvZ2dsZVNwbGl0RWRpdG9ySW5Hcm91cCc7XG5leHBvcnQgY29uc3QgSk9JTl9FRElUT1JfSU5fR1JPVVAgPSAnd29ya2JlbmNoLmFjdGlvbi5qb2luRWRpdG9ySW5Hcm91cCc7XG5leHBvcnQgY29uc3QgVE9HR0xFX1NQTElUX0VESVRPUl9JTl9HUk9VUF9MQVlPVVQgPSAnd29ya2JlbmNoLmFjdGlvbi50b2dnbGVTcGxpdEVkaXRvckluR3JvdXBMYXlvdXQnO1xuXG5leHBvcnQgY29uc3QgRk9DVVNfRklSU1RfU0lERV9FRElUT1IgPSAnd29ya2JlbmNoLmFjdGlvbi5mb2N1c0ZpcnN0U2lkZUVkaXRvcic7XG5leHBvcnQgY29uc3QgRk9DVVNfU0VDT05EX1NJREVfRURJVE9SID0gJ3dvcmtiZW5jaC5hY3Rpb24uZm9jdXNTZWNvbmRTaWRlRWRpdG9yJztcbmV4cG9ydCBjb25zdCBGT0NVU19PVEhFUl9TSURFX0VESVRPUiA9ICd3b3JrYmVuY2guYWN0aW9uLmZvY3VzT3RoZXJTaWRlRWRpdG9yJztcblxuZXhwb3J0IGNvbnN0IEZPQ1VTX0xFRlRfR1JPVVBfV0lUSE9VVF9XUkFQX0NPTU1BTkRfSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5mb2N1c0xlZnRHcm91cFdpdGhvdXRXcmFwJztcbmV4cG9ydCBjb25zdCBGT0NVU19SSUdIVF9HUk9VUF9XSVRIT1VUX1dSQVBfQ09NTUFORF9JRCA9ICd3b3JrYmVuY2guYWN0aW9uLmZvY3VzUmlnaHRHcm91cFdpdGhvdXRXcmFwJztcbmV4cG9ydCBjb25zdCBGT0NVU19BQk9WRV9HUk9VUF9XSVRIT1VUX1dSQVBfQ09NTUFORF9JRCA9ICd3b3JrYmVuY2guYWN0aW9uLmZvY3VzQWJvdmVHcm91cFdpdGhvdXRXcmFwJztcbmV4cG9ydCBjb25zdCBGT0NVU19CRUxPV19HUk9VUF9XSVRIT1VUX1dSQVBfQ09NTUFORF9JRCA9ICd3b3JrYmVuY2guYWN0aW9uLmZvY3VzQmVsb3dHcm91cFdpdGhvdXRXcmFwJztcblxuZXhwb3J0IGNvbnN0IE9QRU5fRURJVE9SX0FUX0lOREVYX0NPTU1BTkRfSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5vcGVuRWRpdG9yQXRJbmRleCc7XG5cbmV4cG9ydCBjb25zdCBNT1ZFX0VESVRPUl9JTlRPX05FV19XSU5ET1dfQ09NTUFORF9JRCA9ICd3b3JrYmVuY2guYWN0aW9uLm1vdmVFZGl0b3JUb05ld1dpbmRvdyc7XG5leHBvcnQgY29uc3QgQ09QWV9FRElUT1JfSU5UT19ORVdfV0lORE9XX0NPTU1BTkRfSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5jb3B5RWRpdG9yVG9OZXdXaW5kb3cnO1xuXG5leHBvcnQgY29uc3QgTU9WRV9FRElUT1JfR1JPVVBfSU5UT19ORVdfV0lORE9XX0NPTU1BTkRfSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5tb3ZlRWRpdG9yR3JvdXBUb05ld1dpbmRvdyc7XG5leHBvcnQgY29uc3QgQ09QWV9FRElUT1JfR1JPVVBfSU5UT19ORVdfV0lORE9XX0NPTU1BTkRfSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5jb3B5RWRpdG9yR3JvdXBUb05ld1dpbmRvdyc7XG5cbmV4cG9ydCBjb25zdCBORVdfRU1QVFlfRURJVE9SX1dJTkRPV19DT01NQU5EX0lEID0gJ3dvcmtiZW5jaC5hY3Rpb24ubmV3RW1wdHlFZGl0b3JXaW5kb3cnO1xuXG5leHBvcnQgY29uc3QgQVBJX09QRU5fRURJVE9SX0NPTU1BTkRfSUQgPSAnX3dvcmtiZW5jaC5vcGVuJztcbmV4cG9ydCBjb25zdCBBUElfT1BFTl9ESUZGX0VESVRPUl9DT01NQU5EX0lEID0gJ193b3JrYmVuY2guZGlmZic7XG5leHBvcnQgY29uc3QgQVBJX09QRU5fV0lUSF9FRElUT1JfQ09NTUFORF9JRCA9ICdfd29ya2JlbmNoLm9wZW5XaXRoJztcblxuZXhwb3J0IGNvbnN0IEVESVRPUl9DT1JFX05BVklHQVRJT05fQ09NTUFORFMgPSBbXG5cdFNQTElUX0VESVRPUixcblx0Q0xPU0VfRURJVE9SX0NPTU1BTkRfSUQsXG5cdFVOUElOX0VESVRPUl9DT01NQU5EX0lELFxuXHRVTkxPQ0tfR1JPVVBfQ09NTUFORF9JRCxcblx0VE9HR0xFX01BWElNSVpFX0VESVRPUl9HUk9VUFxuXTtcblxuZXhwb3J0IGludGVyZmFjZSBTZWxlY3RlZEVkaXRvcnNNb3ZlQ29weUFyZ3VtZW50cyB7XG5cdHRvPzogJ2ZpcnN0JyB8ICdsYXN0JyB8ICdsZWZ0JyB8ICdyaWdodCcgfCAndXAnIHwgJ2Rvd24nIHwgJ2NlbnRlcicgfCAncG9zaXRpb24nIHwgJ3ByZXZpb3VzJyB8ICduZXh0Jztcblx0Ynk/OiAndGFiJyB8ICdncm91cCc7XG5cdHZhbHVlPzogbnVtYmVyO1xufVxuXG5jb25zdCBpc1NlbGVjdGVkRWRpdG9yc01vdmVDb3B5QXJnID0gZnVuY3Rpb24gKGFyZzogU2VsZWN0ZWRFZGl0b3JzTW92ZUNvcHlBcmd1bWVudHMpOiBib29sZWFuIHtcblx0aWYgKCFpc09iamVjdChhcmcpKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0aWYgKCFpc1N0cmluZyhhcmcudG8pKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0aWYgKCFpc1VuZGVmaW5lZChhcmcuYnkpICYmICFpc1N0cmluZyhhcmcuYnkpKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0aWYgKCFpc1VuZGVmaW5lZChhcmcudmFsdWUpICYmICFpc051bWJlcihhcmcudmFsdWUpKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cmV0dXJuIHRydWU7XG59O1xuXG5mdW5jdGlvbiByZWdpc3RlckFjdGl2ZUVkaXRvck1vdmVDb3B5Q29tbWFuZCgpOiB2b2lkIHtcblxuXHRjb25zdCBtb3ZlQ29weUpTT05TY2hlbWE6IElKU09OU2NoZW1hID0ge1xuXHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0J3JlcXVpcmVkJzogWyd0byddLFxuXHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0J3RvJzoge1xuXHRcdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0XHQnZW51bSc6IFsnbGVmdCcsICdyaWdodCddXG5cdFx0XHR9LFxuXHRcdFx0J2J5Jzoge1xuXHRcdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0XHQnZW51bSc6IFsndGFiJywgJ2dyb3VwJ11cblx0XHRcdH0sXG5cdFx0XHQndmFsdWUnOiB7XG5cdFx0XHRcdCd0eXBlJzogJ251bWJlcidcblx0XHRcdH1cblx0XHR9XG5cdH07XG5cblx0S2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdFx0aWQ6IE1PVkVfQUNUSVZFX0VESVRPUl9DT01NQU5EX0lELFxuXHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdHdoZW46IEVkaXRvckNvbnRleHRLZXlzLmVkaXRvclRleHRGb2N1cyxcblx0XHRwcmltYXJ5OiAwLFxuXHRcdGhhbmRsZXI6IChhY2Nlc3NvciwgYXJncykgPT4gbW92ZUNvcHlTZWxlY3RlZEVkaXRvcnModHJ1ZSwgYXJncywgYWNjZXNzb3IpLFxuXHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2VkaXRvckNvbW1hbmQuYWN0aXZlRWRpdG9yTW92ZS5kZXNjcmlwdGlvbicsIFwiTW92ZSB0aGUgYWN0aXZlIGVkaXRvciBieSB0YWJzIG9yIGdyb3Vwc1wiKSxcblx0XHRcdGFyZ3M6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdG5hbWU6IGxvY2FsaXplKCdlZGl0b3JDb21tYW5kLmFjdGl2ZUVkaXRvck1vdmUuYXJnLm5hbWUnLCBcIkFjdGl2ZSBlZGl0b3IgbW92ZSBhcmd1bWVudFwiKSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2VkaXRvckNvbW1hbmQuYWN0aXZlRWRpdG9yTW92ZS5hcmcuZGVzY3JpcHRpb24nLCBcIkFyZ3VtZW50IFByb3BlcnRpZXM6XFxuXFx0KiAndG8nOiBTdHJpbmcgdmFsdWUgcHJvdmlkaW5nIHdoZXJlIHRvIG1vdmUuXFxuXFx0KiAnYnknOiBTdHJpbmcgdmFsdWUgcHJvdmlkaW5nIHRoZSB1bml0IGZvciBtb3ZlIChieSB0YWIgb3IgYnkgZ3JvdXApLlxcblxcdCogJ3ZhbHVlJzogTnVtYmVyIHZhbHVlIHByb3ZpZGluZyBob3cgbWFueSBwb3NpdGlvbnMgb3IgYW4gYWJzb2x1dGUgcG9zaXRpb24gdG8gbW92ZS5cIiksXG5cdFx0XHRcdFx0Y29uc3RyYWludDogaXNTZWxlY3RlZEVkaXRvcnNNb3ZlQ29weUFyZyxcblx0XHRcdFx0XHRzY2hlbWE6IG1vdmVDb3B5SlNPTlNjaGVtYVxuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fVxuXHR9KTtcblxuXHRLZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0XHRpZDogQ09QWV9BQ1RJVkVfRURJVE9SX0NPTU1BTkRfSUQsXG5cdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0d2hlbjogRWRpdG9yQ29udGV4dEtleXMuZWRpdG9yVGV4dEZvY3VzLFxuXHRcdHByaW1hcnk6IDAsXG5cdFx0aGFuZGxlcjogKGFjY2Vzc29yLCBhcmdzKSA9PiBtb3ZlQ29weVNlbGVjdGVkRWRpdG9ycyhmYWxzZSwgYXJncywgYWNjZXNzb3IpLFxuXHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2VkaXRvckNvbW1hbmQuYWN0aXZlRWRpdG9yQ29weS5kZXNjcmlwdGlvbicsIFwiQ29weSB0aGUgYWN0aXZlIGVkaXRvciBieSBncm91cHNcIiksXG5cdFx0XHRhcmdzOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRuYW1lOiBsb2NhbGl6ZSgnZWRpdG9yQ29tbWFuZC5hY3RpdmVFZGl0b3JDb3B5LmFyZy5uYW1lJywgXCJBY3RpdmUgZWRpdG9yIGNvcHkgYXJndW1lbnRcIiksXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdlZGl0b3JDb21tYW5kLmFjdGl2ZUVkaXRvckNvcHkuYXJnLmRlc2NyaXB0aW9uJywgXCJBcmd1bWVudCBQcm9wZXJ0aWVzOlxcblxcdCogJ3RvJzogU3RyaW5nIHZhbHVlIHByb3ZpZGluZyB3aGVyZSB0byBjb3B5LlxcblxcdCogJ3ZhbHVlJzogTnVtYmVyIHZhbHVlIHByb3ZpZGluZyBob3cgbWFueSBwb3NpdGlvbnMgb3IgYW4gYWJzb2x1dGUgcG9zaXRpb24gdG8gY29weS5cIiksXG5cdFx0XHRcdFx0Y29uc3RyYWludDogaXNTZWxlY3RlZEVkaXRvcnNNb3ZlQ29weUFyZyxcblx0XHRcdFx0XHRzY2hlbWE6IG1vdmVDb3B5SlNPTlNjaGVtYVxuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fVxuXHR9KTtcblxuXHRmdW5jdGlvbiBtb3ZlQ29weVNlbGVjdGVkRWRpdG9ycyhpc01vdmU6IGJvb2xlYW4sIGFyZ3M6IFNlbGVjdGVkRWRpdG9yc01vdmVDb3B5QXJndW1lbnRzID0gT2JqZWN0LmNyZWF0ZShudWxsKSwgYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiB2b2lkIHtcblx0XHRhcmdzLnRvID0gYXJncy50byB8fCAncmlnaHQnO1xuXHRcdGFyZ3MuYnkgPSBhcmdzLmJ5IHx8ICd0YWInO1xuXHRcdGFyZ3MudmFsdWUgPSB0eXBlb2YgYXJncy52YWx1ZSA9PT0gJ251bWJlcicgPyBhcmdzLnZhbHVlIDogMTtcblxuXHRcdGNvbnN0IGFjdGl2ZUdyb3VwID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JHcm91cHNTZXJ2aWNlKS5hY3RpdmVHcm91cDtcblx0XHRjb25zdCBzZWxlY3RlZEVkaXRvcnMgPSBhY3RpdmVHcm91cC5zZWxlY3RlZEVkaXRvcnM7XG5cdFx0aWYgKHNlbGVjdGVkRWRpdG9ycy5sZW5ndGggPiAwKSB7XG5cdFx0XHRzd2l0Y2ggKGFyZ3MuYnkpIHtcblx0XHRcdFx0Y2FzZSAndGFiJzpcblx0XHRcdFx0XHRpZiAoaXNNb3ZlKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbW92ZVRhYnMoYXJncywgYWN0aXZlR3JvdXAsIHNlbGVjdGVkRWRpdG9ycyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlICdncm91cCc6XG5cdFx0XHRcdFx0cmV0dXJuIG1vdmVDb3B5QWN0aXZlRWRpdG9yVG9Hcm91cChpc01vdmUsIGFyZ3MsIGFjdGl2ZUdyb3VwLCBzZWxlY3RlZEVkaXRvcnMsIGFjY2Vzc29yKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBtb3ZlVGFicyhhcmdzOiBTZWxlY3RlZEVkaXRvcnNNb3ZlQ29weUFyZ3VtZW50cywgZ3JvdXA6IElFZGl0b3JHcm91cCwgZWRpdG9yczogRWRpdG9ySW5wdXRbXSk6IHZvaWQge1xuXHRcdGNvbnN0IHRvID0gYXJncy50bztcblx0XHRpZiAodG8gPT09ICdmaXJzdCcgfHwgdG8gPT09ICdyaWdodCcpIHtcblx0XHRcdGVkaXRvcnMgPSBbLi4uZWRpdG9yc10ucmV2ZXJzZSgpO1xuXHRcdH0gZWxzZSBpZiAodG8gPT09ICdwb3NpdGlvbicgJiYgKGFyZ3MudmFsdWUgPz8gMSkgPCBncm91cC5nZXRJbmRleE9mRWRpdG9yKGVkaXRvcnNbMF0pKSB7XG5cdFx0XHRlZGl0b3JzID0gWy4uLmVkaXRvcnNdLnJldmVyc2UoKTtcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IGVkaXRvciBvZiBlZGl0b3JzKSB7XG5cdFx0XHRtb3ZlVGFiKGFyZ3MsIGdyb3VwLCBlZGl0b3IpO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIG1vdmVUYWIoYXJnczogU2VsZWN0ZWRFZGl0b3JzTW92ZUNvcHlBcmd1bWVudHMsIGdyb3VwOiBJRWRpdG9yR3JvdXAsIGVkaXRvcjogRWRpdG9ySW5wdXQpOiB2b2lkIHtcblx0XHRsZXQgaW5kZXggPSBncm91cC5nZXRJbmRleE9mRWRpdG9yKGVkaXRvcik7XG5cdFx0c3dpdGNoIChhcmdzLnRvKSB7XG5cdFx0XHRjYXNlICdmaXJzdCc6XG5cdFx0XHRcdGluZGV4ID0gMDtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdsYXN0Jzpcblx0XHRcdFx0aW5kZXggPSBncm91cC5jb3VudCAtIDE7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnbGVmdCc6XG5cdFx0XHRcdGluZGV4ID0gaW5kZXggLSAoYXJncy52YWx1ZSA/PyAxKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdyaWdodCc6XG5cdFx0XHRcdGluZGV4ID0gaW5kZXggKyAoYXJncy52YWx1ZSA/PyAxKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdjZW50ZXInOlxuXHRcdFx0XHRpbmRleCA9IE1hdGgucm91bmQoZ3JvdXAuY291bnQgLyAyKSAtIDE7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAncG9zaXRpb24nOlxuXHRcdFx0XHRpbmRleCA9IChhcmdzLnZhbHVlID8/IDEpIC0gMTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXG5cdFx0aW5kZXggPSBpbmRleCA8IDAgPyAwIDogaW5kZXggPj0gZ3JvdXAuY291bnQgPyBncm91cC5jb3VudCAtIDEgOiBpbmRleDtcblx0XHRncm91cC5tb3ZlRWRpdG9yKGVkaXRvciwgZ3JvdXAsIHsgaW5kZXggfSk7XG5cdH1cblxuXHRmdW5jdGlvbiBtb3ZlQ29weUFjdGl2ZUVkaXRvclRvR3JvdXAoaXNNb3ZlOiBib29sZWFuLCBhcmdzOiBTZWxlY3RlZEVkaXRvcnNNb3ZlQ29weUFyZ3VtZW50cywgc291cmNlR3JvdXA6IElFZGl0b3JHcm91cCwgZWRpdG9yczogRWRpdG9ySW5wdXRbXSwgYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiB2b2lkIHtcblx0XHRjb25zdCBlZGl0b3JHcm91cHNTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JHcm91cHNTZXJ2aWNlKTtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXG5cdFx0bGV0IHRhcmdldEdyb3VwOiBJRWRpdG9yR3JvdXAgfCB1bmRlZmluZWQ7XG5cblx0XHRzd2l0Y2ggKGFyZ3MudG8pIHtcblx0XHRcdGNhc2UgJ2xlZnQnOlxuXHRcdFx0XHR0YXJnZXRHcm91cCA9IGVkaXRvckdyb3Vwc1NlcnZpY2UuZmluZEdyb3VwKHsgZGlyZWN0aW9uOiBHcm91cERpcmVjdGlvbi5MRUZUIH0sIHNvdXJjZUdyb3VwKTtcblx0XHRcdFx0aWYgKCF0YXJnZXRHcm91cCkge1xuXHRcdFx0XHRcdHRhcmdldEdyb3VwID0gZWRpdG9yR3JvdXBzU2VydmljZS5hZGRHcm91cChzb3VyY2VHcm91cCwgR3JvdXBEaXJlY3Rpb24uTEVGVCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdyaWdodCc6XG5cdFx0XHRcdHRhcmdldEdyb3VwID0gZWRpdG9yR3JvdXBzU2VydmljZS5maW5kR3JvdXAoeyBkaXJlY3Rpb246IEdyb3VwRGlyZWN0aW9uLlJJR0hUIH0sIHNvdXJjZUdyb3VwKTtcblx0XHRcdFx0aWYgKCF0YXJnZXRHcm91cCkge1xuXHRcdFx0XHRcdHRhcmdldEdyb3VwID0gZWRpdG9yR3JvdXBzU2VydmljZS5hZGRHcm91cChzb3VyY2VHcm91cCwgR3JvdXBEaXJlY3Rpb24uUklHSFQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAndXAnOlxuXHRcdFx0XHR0YXJnZXRHcm91cCA9IGVkaXRvckdyb3Vwc1NlcnZpY2UuZmluZEdyb3VwKHsgZGlyZWN0aW9uOiBHcm91cERpcmVjdGlvbi5VUCB9LCBzb3VyY2VHcm91cCk7XG5cdFx0XHRcdGlmICghdGFyZ2V0R3JvdXApIHtcblx0XHRcdFx0XHR0YXJnZXRHcm91cCA9IGVkaXRvckdyb3Vwc1NlcnZpY2UuYWRkR3JvdXAoc291cmNlR3JvdXAsIEdyb3VwRGlyZWN0aW9uLlVQKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgJ2Rvd24nOlxuXHRcdFx0XHR0YXJnZXRHcm91cCA9IGVkaXRvckdyb3Vwc1NlcnZpY2UuZmluZEdyb3VwKHsgZGlyZWN0aW9uOiBHcm91cERpcmVjdGlvbi5ET1dOIH0sIHNvdXJjZUdyb3VwKTtcblx0XHRcdFx0aWYgKCF0YXJnZXRHcm91cCkge1xuXHRcdFx0XHRcdHRhcmdldEdyb3VwID0gZWRpdG9yR3JvdXBzU2VydmljZS5hZGRHcm91cChzb3VyY2VHcm91cCwgR3JvdXBEaXJlY3Rpb24uRE9XTik7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdmaXJzdCc6XG5cdFx0XHRcdHRhcmdldEdyb3VwID0gZWRpdG9yR3JvdXBzU2VydmljZS5maW5kR3JvdXAoeyBsb2NhdGlvbjogR3JvdXBMb2NhdGlvbi5GSVJTVCB9LCBzb3VyY2VHcm91cCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnbGFzdCc6XG5cdFx0XHRcdHRhcmdldEdyb3VwID0gZWRpdG9yR3JvdXBzU2VydmljZS5maW5kR3JvdXAoeyBsb2NhdGlvbjogR3JvdXBMb2NhdGlvbi5MQVNUIH0sIHNvdXJjZUdyb3VwKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdwcmV2aW91cyc6XG5cdFx0XHRcdHRhcmdldEdyb3VwID0gZWRpdG9yR3JvdXBzU2VydmljZS5maW5kR3JvdXAoeyBsb2NhdGlvbjogR3JvdXBMb2NhdGlvbi5QUkVWSU9VUyB9LCBzb3VyY2VHcm91cCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnbmV4dCc6XG5cdFx0XHRcdHRhcmdldEdyb3VwID0gZWRpdG9yR3JvdXBzU2VydmljZS5maW5kR3JvdXAoeyBsb2NhdGlvbjogR3JvdXBMb2NhdGlvbi5ORVhUIH0sIHNvdXJjZUdyb3VwKTtcblx0XHRcdFx0aWYgKCF0YXJnZXRHcm91cCkge1xuXHRcdFx0XHRcdHRhcmdldEdyb3VwID0gZWRpdG9yR3JvdXBzU2VydmljZS5hZGRHcm91cChzb3VyY2VHcm91cCwgcHJlZmVycmVkU2lkZUJ5U2lkZUdyb3VwRGlyZWN0aW9uKGNvbmZpZ3VyYXRpb25TZXJ2aWNlKSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdjZW50ZXInOlxuXHRcdFx0XHR0YXJnZXRHcm91cCA9IGVkaXRvckdyb3Vwc1NlcnZpY2UuZ2V0R3JvdXBzKEdyb3Vwc09yZGVyLkdSSURfQVBQRUFSQU5DRSlbKGVkaXRvckdyb3Vwc1NlcnZpY2UuY291bnQgLyAyKSAtIDFdO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgJ3Bvc2l0aW9uJzpcblx0XHRcdFx0dGFyZ2V0R3JvdXAgPSBlZGl0b3JHcm91cHNTZXJ2aWNlLmdldEdyb3VwcyhHcm91cHNPcmRlci5HUklEX0FQUEVBUkFOQ0UpWyhhcmdzLnZhbHVlID8/IDEpIC0gMV07XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHRcdGlmICh0YXJnZXRHcm91cCkge1xuXHRcdFx0Y29uc3QgZWRpdG9yc1dpdGhPcHRpb25zID0gcHJlcGFyZU1vdmVDb3B5RWRpdG9ycyhzb3VyY2VHcm91cCwgZWRpdG9ycyk7XG5cdFx0XHRpZiAoaXNNb3ZlKSB7XG5cdFx0XHRcdHNvdXJjZUdyb3VwLm1vdmVFZGl0b3JzKGVkaXRvcnNXaXRoT3B0aW9ucywgdGFyZ2V0R3JvdXApO1xuXHRcdFx0fSBlbHNlIGlmIChzb3VyY2VHcm91cC5pZCAhPT0gdGFyZ2V0R3JvdXAuaWQpIHtcblx0XHRcdFx0c291cmNlR3JvdXAuY29weUVkaXRvcnMoZWRpdG9yc1dpdGhPcHRpb25zLCB0YXJnZXRHcm91cCk7XG5cdFx0XHR9XG5cblx0XHRcdHRhcmdldEdyb3VwLmZvY3VzKCk7XG5cdFx0fVxuXHR9XG59XG5cbmZ1bmN0aW9uIHJlZ2lzdGVyRWRpdG9yR3JvdXBzTGF5b3V0Q29tbWFuZHMoKTogdm9pZCB7XG5cblx0ZnVuY3Rpb24gYXBwbHlFZGl0b3JMYXlvdXQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGxheW91dDogRWRpdG9yR3JvdXBMYXlvdXQpOiB2b2lkIHtcblx0XHRpZiAoIWxheW91dCB8fCB0eXBlb2YgbGF5b3V0ICE9PSAnb2JqZWN0Jykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGVkaXRvckdyb3Vwc1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvckdyb3Vwc1NlcnZpY2UpO1xuXHRcdGVkaXRvckdyb3Vwc1NlcnZpY2UuYXBwbHlMYXlvdXQobGF5b3V0KTtcblx0fVxuXG5cdENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKExBWU9VVF9FRElUT1JfR1JPVVBTX0NPTU1BTkRfSUQsIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgYXJnczogRWRpdG9yR3JvdXBMYXlvdXQpID0+IHtcblx0XHRhcHBseUVkaXRvckxheW91dChhY2Nlc3NvciwgYXJncyk7XG5cdH0pO1xuXG5cdC8vIEFQSSBDb21tYW5kc1xuXHRDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCh7XG5cdFx0aWQ6ICd2c2NvZGUuc2V0RWRpdG9yTGF5b3V0Jyxcblx0XHRoYW5kbGVyOiAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGFyZ3M6IEVkaXRvckdyb3VwTGF5b3V0KSA9PiBhcHBseUVkaXRvckxheW91dChhY2Nlc3NvciwgYXJncyksXG5cdFx0bWV0YWRhdGE6IHtcblx0XHRcdCdkZXNjcmlwdGlvbic6IGBTZXQgdGhlIGVkaXRvciBsYXlvdXQuIEVkaXRvciBsYXlvdXQgaXMgcmVwcmVzZW50ZWQgYXMgYSB0cmVlIG9mIGdyb3VwcyBpbiB3aGljaCB0aGUgZmlyc3QgZ3JvdXAgaXMgdGhlIHJvb3QgZ3JvdXAgb2YgdGhlIGxheW91dC5cblx0XHRcdFx0XHRUaGUgb3JpZW50YXRpb24gb2YgdGhlIGZpcnN0IGdyb3VwIGlzIDAgKGhvcml6b250YWwpIGJ5IGRlZmF1bHQgdW5sZXNzIHNwZWNpZmllZCBvdGhlcndpc2UuIFRoZSBvdGhlciBvcmllbnRhdGlvbnMgYXJlIDEgKHZlcnRpY2FsKS5cblx0XHRcdFx0XHRUaGUgb3JpZW50YXRpb24gb2Ygc3Vic2VxdWVudCBncm91cHMgaXMgdGhlIG9wcG9zaXRlIG9mIHRoZSBvcmllbnRhdGlvbiBvZiB0aGUgZ3JvdXAgdGhhdCBjb250YWlucyBpdC5cblx0XHRcdFx0XHRIZXJlIGFyZSBzb21lIGV4YW1wbGVzOiBBIGxheW91dCByZXByZXNlbnRpbmcgMSByb3cgYW5kIDIgY29sdW1uczogeyBvcmllbnRhdGlvbjogMCwgZ3JvdXBzOiBbe30sIHt9XSB9LlxuXHRcdFx0XHRcdEEgbGF5b3V0IHJlcHJlc2VudGluZyAzIHJvd3MgYW5kIDEgY29sdW1uOiB7IG9yaWVudGF0aW9uOiAxLCBncm91cHM6IFt7fSwge30sIHt9XSB9LlxuXHRcdFx0XHRcdEEgbGF5b3V0IHJlcHJlc2VudGluZyAzIHJvd3MgYW5kIDEgY29sdW1uIGluIHdoaWNoIHRoZSBzZWNvbmQgcm93IGhhcyAyIGNvbHVtbnM6IHsgb3JpZW50YXRpb246IDEsIGdyb3VwczogW3t9LCB7IGdyb3VwczogW3t9LCB7fV0gfSwge31dIH1cblx0XHRcdFx0XHRgLFxuXHRcdFx0YXJnczogW3tcblx0XHRcdFx0bmFtZTogJ2FyZ3MnLFxuXHRcdFx0XHRzY2hlbWE6IHtcblx0XHRcdFx0XHQndHlwZSc6ICdvYmplY3QnLFxuXHRcdFx0XHRcdCdyZXF1aXJlZCc6IFsnZ3JvdXBzJ10sXG5cdFx0XHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdFx0XHQnb3JpZW50YXRpb24nOiB7XG5cdFx0XHRcdFx0XHRcdCd0eXBlJzogJ251bWJlcicsXG5cdFx0XHRcdFx0XHRcdCdkZWZhdWx0JzogMCxcblx0XHRcdFx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogYFRoZSBvcmllbnRhdGlvbiBvZiB0aGUgcm9vdCBncm91cCBpbiB0aGUgbGF5b3V0LiAwIGZvciBob3Jpem9udGFsLCAxIGZvciB2ZXJ0aWNhbC5gLFxuXHRcdFx0XHRcdFx0XHQnZW51bSc6IFswLCAxXSxcblx0XHRcdFx0XHRcdFx0J2VudW1EZXNjcmlwdGlvbnMnOiBbXG5cdFx0XHRcdFx0XHRcdFx0bG9jYWxpemUoJ2VkaXRvckdyb3VwTGF5b3V0Lmhvcml6b250YWwnLCBcIkhvcml6b250YWxcIiksXG5cdFx0XHRcdFx0XHRcdFx0bG9jYWxpemUoJ2VkaXRvckdyb3VwTGF5b3V0LnZlcnRpY2FsJywgXCJWZXJ0aWNhbFwiKVxuXHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdCdncm91cHMnOiB7XG5cdFx0XHRcdFx0XHRcdCckcmVmJzogJyMvZGVmaW5pdGlvbnMvZWRpdG9yR3JvdXBzU2NoZW1hJyxcblx0XHRcdFx0XHRcdFx0J2RlZmF1bHQnOiBbe30sIHt9XVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fV1cblx0XHR9XG5cdH0pO1xuXG5cdENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKHtcblx0XHRpZDogJ3ZzY29kZS5nZXRFZGl0b3JMYXlvdXQnLFxuXHRcdGhhbmRsZXI6IChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvcikgPT4ge1xuXHRcdFx0Y29uc3QgZWRpdG9yR3JvdXBzU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSk7XG5cblx0XHRcdHJldHVybiBlZGl0b3JHcm91cHNTZXJ2aWNlLmdldExheW91dCgpO1xuXHRcdH0sXG5cdFx0bWV0YWRhdGE6IHtcblx0XHRcdGRlc2NyaXB0aW9uOiAnR2V0IEVkaXRvciBMYXlvdXQnLFxuXHRcdFx0YXJnczogW10sXG5cdFx0XHRyZXR1cm5zOiAnQW4gZWRpdG9yIGxheW91dCBvYmplY3QsIGluIHRoZSBzYW1lIGZvcm1hdCBhcyB2c2NvZGUuc2V0RWRpdG9yTGF5b3V0J1xuXHRcdH1cblx0fSk7XG59XG5cbmZ1bmN0aW9uIHJlZ2lzdGVyT3BlbkVkaXRvckFQSUNvbW1hbmRzKCk6IHZvaWQge1xuXG5cdGZ1bmN0aW9uIG1peGluQ29udGV4dChjb250ZXh0OiBJT3BlbkV2ZW50PHVua25vd24+IHwgdW5kZWZpbmVkLCBvcHRpb25zOiBJVGV4dEVkaXRvck9wdGlvbnMgfCB1bmRlZmluZWQsIGNvbHVtbjogRWRpdG9yR3JvdXBDb2x1bW4gfCB1bmRlZmluZWQpOiBbSVRleHRFZGl0b3JPcHRpb25zIHwgdW5kZWZpbmVkLCBFZGl0b3JHcm91cENvbHVtbiB8IHVuZGVmaW5lZF0ge1xuXHRcdGlmICghY29udGV4dCkge1xuXHRcdFx0cmV0dXJuIFtvcHRpb25zLCBjb2x1bW5dO1xuXHRcdH1cblxuXHRcdHJldHVybiBbXG5cdFx0XHR7IC4uLmNvbnRleHQuZWRpdG9yT3B0aW9ucywgLi4uKG9wdGlvbnMgPz8gT2JqZWN0LmNyZWF0ZShudWxsKSkgfSxcblx0XHRcdGNvbnRleHQuc2lkZUJ5U2lkZSA/IFNJREVfR1JPVVAgOiBjb2x1bW5cblx0XHRdO1xuXHR9XG5cblx0Ly8gcGFydGlhbCwgcmVuZGVyZXItc2lkZSBBUEkgY29tbWFuZCB0byBvcGVuIGVkaXRvclxuXHQvLyBjb21wbGVtZW50cyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9ibG9iLzJiMTY0ZWZiMGU2YTVkZTM4MjZiZmY2MjY4M2VhZWFmZTAzMjI4NGYvc3JjL3ZzL3dvcmtiZW5jaC9hcGkvY29tbW9uL2V4dEhvc3RBcGlDb21tYW5kcy50cyNMMzczXG5cdENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKHtcblx0XHRpZDogJ3ZzY29kZS5vcGVuJyxcblx0XHRoYW5kbGVyOiAoYWNjZXNzb3IsIGFyZykgPT4ge1xuXHRcdFx0YWNjZXNzb3IuZ2V0KElDb21tYW5kU2VydmljZSkuZXhlY3V0ZUNvbW1hbmQoQVBJX09QRU5fRURJVE9SX0NPTU1BTkRfSUQsIGFyZyk7XG5cdFx0fSxcblx0XHRtZXRhZGF0YToge1xuXHRcdFx0ZGVzY3JpcHRpb246ICdPcGVucyB0aGUgcHJvdmlkZWQgcmVzb3VyY2UgaW4gdGhlIGVkaXRvci4nLFxuXHRcdFx0YXJnczogW3sgbmFtZTogJ1VyaScgfV1cblx0XHR9XG5cdH0pO1xuXG5cdENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKEFQSV9PUEVOX0VESVRPUl9DT01NQU5EX0lELCBhc3luYyBmdW5jdGlvbiAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHJlc291cmNlQXJnOiBVcmlDb21wb25lbnRzIHwgc3RyaW5nLCBjb2x1bW5BbmRPcHRpb25zPzogW0VkaXRvckdyb3VwQ29sdW1uPywgSVRleHRFZGl0b3JPcHRpb25zP10sIGxhYmVsPzogc3RyaW5nLCBjb250ZXh0PzogSU9wZW5FdmVudDx1bmtub3duPikge1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IGVkaXRvckdyb3Vwc1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvckdyb3Vwc1NlcnZpY2UpO1xuXHRcdGNvbnN0IG9wZW5lclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU9wZW5lclNlcnZpY2UpO1xuXHRcdGNvbnN0IHBhdGhTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElQYXRoU2VydmljZSk7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCB1bnRpdGxlZFRleHRFZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElVbnRpdGxlZFRleHRFZGl0b3JTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IHJlc291cmNlT3JTdHJpbmcgPSB0eXBlb2YgcmVzb3VyY2VBcmcgPT09ICdzdHJpbmcnID8gcmVzb3VyY2VBcmcgOiBVUkkuZnJvbShyZXNvdXJjZUFyZywgdHJ1ZSk7XG5cdFx0Y29uc3QgW2NvbHVtbkFyZywgb3B0aW9uc0FyZ10gPSBjb2x1bW5BbmRPcHRpb25zID8/IFtdO1xuXG5cdFx0Ly8gdXNlIGVkaXRvciBvcHRpb25zIG9yIGVkaXRvciB2aWV3IGNvbHVtbiBvciByZXNvdXJjZSBzY2hlbWVcblx0XHQvLyBhcyBhIGhpbnQgdG8gdXNlIHRoZSBlZGl0b3Igc2VydmljZSBmb3Igb3BlbmluZyBkaXJlY3RseVxuXHRcdGlmIChvcHRpb25zQXJnIHx8IHR5cGVvZiBjb2x1bW5BcmcgPT09ICdudW1iZXInIHx8IG1hdGNoZXNTY2hlbWUocmVzb3VyY2VPclN0cmluZywgU2NoZW1hcy51bnRpdGxlZCkpIHtcblx0XHRcdGNvbnN0IFtvcHRpb25zLCBjb2x1bW5dID0gbWl4aW5Db250ZXh0KGNvbnRleHQsIG9wdGlvbnNBcmcsIGNvbHVtbkFyZyk7XG5cdFx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5pc1VyaShyZXNvdXJjZU9yU3RyaW5nKSA/IHJlc291cmNlT3JTdHJpbmcgOiBVUkkucGFyc2UocmVzb3VyY2VPclN0cmluZyk7XG5cblx0XHRcdGxldCBpbnB1dDogSVJlc291cmNlRWRpdG9ySW5wdXQgfCBJVW50aXRsZWRUZXh0UmVzb3VyY2VFZGl0b3JJbnB1dDtcblx0XHRcdGlmICh1bnRpdGxlZFRleHRFZGl0b3JTZXJ2aWNlLmlzVW50aXRsZWRXaXRoQXNzb2NpYXRlZFJlc291cmNlKHJlc291cmNlKSkge1xuXHRcdFx0XHQvLyBzcGVjaWFsIGNhc2UgZm9yIHVudGl0bGVkOiB3ZSBhcmUgZ2V0dGluZyBhIHJlc291cmNlIHdpdGggbWVhbmluZ2Z1bFxuXHRcdFx0XHQvLyBwYXRoIGZyb20gYW4gZXh0ZW5zaW9uIHRvIHVzZSBmb3IgdGhlIHVudGl0bGVkIGVkaXRvci4gYXMgc3VjaCwgd2Vcblx0XHRcdFx0Ly8gaGF2ZSB0byBhc3N1bWUgaXQgYXMgYW4gYXNzb2NpYXRlZCByZXNvdXJjZSB0byB1c2Ugd2hlbiBzYXZpbmcuIHdlXG5cdFx0XHRcdC8vIGRvIHNvIGJ5IHNldHRpbmcgdGhlIGBmb3JjZVVudGl0bGVkOiB0cnVlYCBhbmQgY2hhbmdpbmcgdGhlIHNjaGVtZVxuXHRcdFx0XHQvLyB0byBhIGZpbGUgYmFzZWQgb25lLiB0aGUgdW50aXRsZWQgZWRpdG9yIHNlcnZpY2UgdGFrZXMgY2FyZSB0b1xuXHRcdFx0XHQvLyBhc3NvY2lhdGUgdGhlIHBhdGggcHJvcGVybHkgdGhlbi5cblx0XHRcdFx0aW5wdXQgPSB7IHJlc291cmNlOiByZXNvdXJjZS53aXRoKHsgc2NoZW1lOiBwYXRoU2VydmljZS5kZWZhdWx0VXJpU2NoZW1lIH0pLCBmb3JjZVVudGl0bGVkOiB0cnVlLCBvcHRpb25zLCBsYWJlbCB9O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gdXNlIGFueSBvdGhlciByZXNvdXJjZSBhcyBpc1xuXHRcdFx0XHRpbnB1dCA9IHsgcmVzb3VyY2UsIG9wdGlvbnMsIGxhYmVsIH07XG5cdFx0XHR9XG5cblx0XHRcdGF3YWl0IGVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcihpbnB1dCwgY29sdW1uVG9FZGl0b3JHcm91cChlZGl0b3JHcm91cHNTZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSwgY29sdW1uKSk7XG5cdFx0fVxuXG5cdFx0Ly8gZG8gbm90IGFsbG93IHRvIGV4ZWN1dGUgY29tbWFuZHMgZnJvbSBoZXJlXG5cdFx0ZWxzZSBpZiAobWF0Y2hlc1NjaGVtZShyZXNvdXJjZU9yU3RyaW5nLCBTY2hlbWFzLmNvbW1hbmQpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gZmluYWxseSwgZGVsZWdhdGUgdG8gb3BlbmVyIHNlcnZpY2Vcblx0XHRlbHNlIHtcblx0XHRcdGF3YWl0IG9wZW5lclNlcnZpY2Uub3BlbihyZXNvdXJjZU9yU3RyaW5nLCB7IG9wZW5Ub1NpZGU6IGNvbnRleHQ/LnNpZGVCeVNpZGUsIGVkaXRvck9wdGlvbnM6IGNvbnRleHQ/LmVkaXRvck9wdGlvbnMgfSk7XG5cdFx0fVxuXHR9KTtcblxuXHQvLyBwYXJ0aWFsLCByZW5kZXJlci1zaWRlIEFQSSBjb21tYW5kIHRvIG9wZW4gZGlmZiBlZGl0b3Jcblx0Ly8gY29tcGxlbWVudHMgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvYmxvYi8yYjE2NGVmYjBlNmE1ZGUzODI2YmZmNjI2ODNlYWVhZmUwMzIyODRmL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0QXBpQ29tbWFuZHMudHMjTDM5N1xuXHRDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCh7XG5cdFx0aWQ6ICd2c2NvZGUuZGlmZicsXG5cdFx0aGFuZGxlcjogKGFjY2Vzc29yLCBsZWZ0LCByaWdodCwgbGFiZWwpID0+IHtcblx0XHRcdGFjY2Vzc29yLmdldChJQ29tbWFuZFNlcnZpY2UpLmV4ZWN1dGVDb21tYW5kKEFQSV9PUEVOX0RJRkZfRURJVE9SX0NPTU1BTkRfSUQsIGxlZnQsIHJpZ2h0LCBsYWJlbCk7XG5cdFx0fSxcblx0XHRtZXRhZGF0YToge1xuXHRcdFx0ZGVzY3JpcHRpb246ICdPcGVucyB0aGUgcHJvdmlkZWQgcmVzb3VyY2VzIGluIHRoZSBkaWZmIGVkaXRvciB0byBjb21wYXJlIHRoZWlyIGNvbnRlbnRzLicsXG5cdFx0XHRhcmdzOiBbXG5cdFx0XHRcdHsgbmFtZTogJ2xlZnQnLCBkZXNjcmlwdGlvbjogJ0xlZnQtaGFuZCBzaWRlIHJlc291cmNlIG9mIHRoZSBkaWZmIGVkaXRvcicgfSxcblx0XHRcdFx0eyBuYW1lOiAncmlnaHQnLCBkZXNjcmlwdGlvbjogJ1JpZ2h0LWhhbmQgc2lkZSByZXNvdXJjZSBvZiB0aGUgZGlmZiBlZGl0b3InIH0sXG5cdFx0XHRcdHsgbmFtZTogJ3RpdGxlJywgZGVzY3JpcHRpb246ICdIdW1hbiByZWFkYWJsZSB0aXRsZSBmb3IgdGhlIGRpZmYgZWRpdG9yJyB9LFxuXHRcdFx0XVxuXHRcdH1cblx0fSk7XG5cblx0Q29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoQVBJX09QRU5fRElGRl9FRElUT1JfQ09NTUFORF9JRCwgYXN5bmMgZnVuY3Rpb24gKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBvcmlnaW5hbFJlc291cmNlOiBVcmlDb21wb25lbnRzLCBtb2RpZmllZFJlc291cmNlOiBVcmlDb21wb25lbnRzLCBsYWJlbEFuZE9yRGVzY3JpcHRpb24/OiBzdHJpbmcgfCB7IGxhYmVsOiBzdHJpbmc7IGRlc2NyaXB0aW9uOiBzdHJpbmcgfSwgY29sdW1uQW5kT3B0aW9ucz86IFtFZGl0b3JHcm91cENvbHVtbj8sIElUZXh0RWRpdG9yT3B0aW9ucz9dLCBjb250ZXh0PzogSU9wZW5FdmVudDx1bmtub3duPikge1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IGVkaXRvckdyb3Vwc1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvckdyb3Vwc1NlcnZpY2UpO1xuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cblx0XHRjb25zdCBbY29sdW1uQXJnLCBvcHRpb25zQXJnXSA9IGNvbHVtbkFuZE9wdGlvbnMgPz8gW107XG5cdFx0Y29uc3QgW29wdGlvbnMsIGNvbHVtbl0gPSBtaXhpbkNvbnRleHQoY29udGV4dCwgb3B0aW9uc0FyZywgY29sdW1uQXJnKTtcblxuXHRcdGxldCBsYWJlbDogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGxldCBkZXNjcmlwdGlvbjogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGlmICh0eXBlb2YgbGFiZWxBbmRPckRlc2NyaXB0aW9uID09PSAnc3RyaW5nJykge1xuXHRcdFx0bGFiZWwgPSBsYWJlbEFuZE9yRGVzY3JpcHRpb247XG5cdFx0fSBlbHNlIGlmIChsYWJlbEFuZE9yRGVzY3JpcHRpb24pIHtcblx0XHRcdGxhYmVsID0gbGFiZWxBbmRPckRlc2NyaXB0aW9uLmxhYmVsO1xuXHRcdFx0ZGVzY3JpcHRpb24gPSBsYWJlbEFuZE9yRGVzY3JpcHRpb24uZGVzY3JpcHRpb247XG5cdFx0fVxuXG5cdFx0YXdhaXQgZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHtcblx0XHRcdG9yaWdpbmFsOiB7IHJlc291cmNlOiBVUkkuZnJvbShvcmlnaW5hbFJlc291cmNlLCB0cnVlKSB9LFxuXHRcdFx0bW9kaWZpZWQ6IHsgcmVzb3VyY2U6IFVSSS5mcm9tKG1vZGlmaWVkUmVzb3VyY2UsIHRydWUpIH0sXG5cdFx0XHRsYWJlbCxcblx0XHRcdGRlc2NyaXB0aW9uLFxuXHRcdFx0b3B0aW9uc1xuXHRcdH0sIGNvbHVtblRvRWRpdG9yR3JvdXAoZWRpdG9yR3JvdXBzU2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIGNvbHVtbikpO1xuXHR9KTtcblxuXHRDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZChBUElfT1BFTl9XSVRIX0VESVRPUl9DT01NQU5EX0lELCBhc3luYyAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHJlc291cmNlOiBVcmlDb21wb25lbnRzLCBpZDogc3RyaW5nLCBjb2x1bW5BbmRPcHRpb25zPzogW0VkaXRvckdyb3VwQ29sdW1uPywgSVRleHRFZGl0b3JPcHRpb25zP10pID0+IHtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRjb25zdCBlZGl0b3JHcm91cHNTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JHcm91cHNTZXJ2aWNlKTtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgW2NvbHVtbkFyZywgb3B0aW9uc0FyZ10gPSBjb2x1bW5BbmRPcHRpb25zID8/IFtdO1xuXG5cdFx0YXdhaXQgZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHsgcmVzb3VyY2U6IFVSSS5mcm9tKHJlc291cmNlLCB0cnVlKSwgb3B0aW9uczogeyBwaW5uZWQ6IHRydWUsIC4uLm9wdGlvbnNBcmcsIG92ZXJyaWRlOiBpZCB9IH0sIGNvbHVtblRvRWRpdG9yR3JvdXAoZWRpdG9yR3JvdXBzU2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIGNvbHVtbkFyZykpO1xuXHR9KTtcblxuXHQvLyBwYXJ0aWFsLCByZW5kZXJlci1zaWRlIEFQSSBjb21tYW5kIHRvIG9wZW4gZGlmZiBlZGl0b3Jcblx0Ly8gY29tcGxlbWVudHMgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvYmxvYi8yYjE2NGVmYjBlNmE1ZGUzODI2YmZmNjI2ODNlYWVhZmUwMzIyODRmL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0QXBpQ29tbWFuZHMudHMjTDM5N1xuXHRDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCh7XG5cdFx0aWQ6ICd2c2NvZGUuY2hhbmdlcycsXG5cdFx0aGFuZGxlcjogKGFjY2Vzc29yLCB0aXRsZTogc3RyaW5nLCByZXNvdXJjZXM6IFtVcmlDb21wb25lbnRzLCBVcmlDb21wb25lbnRzPywgVXJpQ29tcG9uZW50cz9dW10pID0+IHtcblx0XHRcdGFjY2Vzc29yLmdldChJQ29tbWFuZFNlcnZpY2UpLmV4ZWN1dGVDb21tYW5kKCdfd29ya2JlbmNoLmNoYW5nZXMnLCB0aXRsZSwgcmVzb3VyY2VzKTtcblx0XHR9LFxuXHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogJ09wZW5zIGEgbGlzdCBvZiByZXNvdXJjZXMgaW4gdGhlIGNoYW5nZXMgZWRpdG9yIHRvIGNvbXBhcmUgdGhlaXIgY29udGVudHMuJyxcblx0XHRcdGFyZ3M6IFtcblx0XHRcdFx0eyBuYW1lOiAndGl0bGUnLCBkZXNjcmlwdGlvbjogJ0h1bWFuIHJlYWRhYmxlIHRpdGxlIGZvciB0aGUgZGlmZiBlZGl0b3InIH0sXG5cdFx0XHRcdHsgbmFtZTogJ3Jlc291cmNlcycsIGRlc2NyaXB0aW9uOiAnTGlzdCBvZiByZXNvdXJjZXMgdG8gb3BlbiBpbiB0aGUgY2hhbmdlcyBlZGl0b3InIH1cblx0XHRcdF1cblx0XHR9XG5cdH0pO1xuXG5cdENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCdfd29ya2JlbmNoLmNoYW5nZXMnLCBhc3luYyAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHRpdGxlOiBzdHJpbmcsIHJlc291cmNlczogW1VyaUNvbXBvbmVudHMsIFVyaUNvbXBvbmVudHM/LCBVcmlDb21wb25lbnRzP11bXSkgPT4ge1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgZWRpdG9yOiAoSVJlc291cmNlRGlmZkVkaXRvcklucHV0ICYgeyByZXNvdXJjZTogVVJJIH0pW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IFtsYWJlbCwgb3JpZ2luYWwsIG1vZGlmaWVkXSBvZiByZXNvdXJjZXMpIHtcblx0XHRcdGVkaXRvci5wdXNoKHtcblx0XHRcdFx0cmVzb3VyY2U6IFVSSS5yZXZpdmUobGFiZWwpLFxuXHRcdFx0XHRvcmlnaW5hbDogeyByZXNvdXJjZTogVVJJLnJldml2ZShvcmlnaW5hbCkgfSxcblx0XHRcdFx0bW9kaWZpZWQ6IHsgcmVzb3VyY2U6IFVSSS5yZXZpdmUobW9kaWZpZWQpIH0sXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRhd2FpdCBlZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3IoeyByZXNvdXJjZXM6IGVkaXRvciwgbGFiZWw6IHRpdGxlIH0pO1xuXHR9KTtcblxuXHRDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnX3dvcmtiZW5jaC5vcGVuTXVsdGlEaWZmRWRpdG9yJywgYXN5bmMgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBvcHRpb25zOiBPcGVuTXVsdGlGaWxlRGlmZkVkaXRvck9wdGlvbnMpID0+IHtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRhd2FpdCBlZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3Ioe1xuXHRcdFx0bXVsdGlEaWZmU291cmNlOiBvcHRpb25zLm11bHRpRGlmZlNvdXJjZVVyaSA/IFVSSS5yZXZpdmUob3B0aW9ucy5tdWx0aURpZmZTb3VyY2VVcmkpIDogdW5kZWZpbmVkLFxuXHRcdFx0cmVzb3VyY2VzOiBvcHRpb25zLnJlc291cmNlcz8ubWFwKHIgPT4gKHsgb3JpZ2luYWw6IHsgcmVzb3VyY2U6IFVSSS5yZXZpdmUoci5vcmlnaW5hbFVyaSkgfSwgbW9kaWZpZWQ6IHsgcmVzb3VyY2U6IFVSSS5yZXZpdmUoci5tb2RpZmllZFVyaSkgfSB9KSksXG5cdFx0XHRsYWJlbDogb3B0aW9ucy50aXRsZSxcblx0XHR9KTtcblx0fSk7XG59XG5cbmludGVyZmFjZSBPcGVuTXVsdGlGaWxlRGlmZkVkaXRvck9wdGlvbnMge1xuXHR0aXRsZTogc3RyaW5nO1xuXHRtdWx0aURpZmZTb3VyY2VVcmk/OiBVcmlDb21wb25lbnRzO1xuXHRyZXNvdXJjZXM/OiB7IG9yaWdpbmFsVXJpOiBVcmlDb21wb25lbnRzOyBtb2RpZmllZFVyaTogVXJpQ29tcG9uZW50cyB9W107XG59XG5cbmZ1bmN0aW9uIHJlZ2lzdGVyT3BlbkVkaXRvckF0SW5kZXhDb21tYW5kcygpOiB2b2lkIHtcblx0Y29uc3Qgb3BlbkVkaXRvckF0SW5kZXg6IElDb21tYW5kSGFuZGxlciA9IChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9ySW5kZXg6IG51bWJlcik6IHZvaWQgPT4ge1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IGFjdGl2ZUVkaXRvclBhbmUgPSBlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvclBhbmU7XG5cdFx0aWYgKGFjdGl2ZUVkaXRvclBhbmUpIHtcblx0XHRcdGNvbnN0IGVkaXRvciA9IGFjdGl2ZUVkaXRvclBhbmUuZ3JvdXAuZ2V0RWRpdG9yQnlJbmRleChlZGl0b3JJbmRleCk7XG5cdFx0XHRpZiAoZWRpdG9yKSB7XG5cdFx0XHRcdGVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcihlZGl0b3IpO1xuXHRcdFx0fVxuXHRcdH1cblx0fTtcblxuXHQvLyBUaGlzIGNvbW1hbmQgdGFrZXMgaW4gdGhlIGVkaXRvciBpbmRleCBudW1iZXIgdG8gb3BlbiBhcyBhbiBhcmd1bWVudFxuXHRDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCh7XG5cdFx0aWQ6IE9QRU5fRURJVE9SX0FUX0lOREVYX0NPTU1BTkRfSUQsXG5cdFx0aGFuZGxlcjogb3BlbkVkaXRvckF0SW5kZXhcblx0fSk7XG5cblx0Ly8gS2V5YmluZGluZ3MgdG8gZm9jdXMgYSBzcGVjaWZpYyBpbmRleCBpbiB0aGUgdGFiIGZvbGRlciBpZiB0YWJzIGFyZSBlbmFibGVkXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgOTsgaSsrKSB7XG5cdFx0Y29uc3QgZWRpdG9ySW5kZXggPSBpO1xuXHRcdGNvbnN0IHZpc2libGVJbmRleCA9IGkgKyAxO1xuXG5cdFx0S2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdFx0XHRpZDogT1BFTl9FRElUT1JfQVRfSU5ERVhfQ09NTUFORF9JRCArIHZpc2libGVJbmRleCxcblx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0d2hlbjogdW5kZWZpbmVkLFxuXHRcdFx0cHJpbWFyeTogS2V5TW9kLkFsdCB8IHRvS2V5Q29kZSh2aXNpYmxlSW5kZXgpLFxuXHRcdFx0bWFjOiB7IHByaW1hcnk6IEtleU1vZC5XaW5DdHJsIHwgdG9LZXlDb2RlKHZpc2libGVJbmRleCkgfSxcblx0XHRcdGhhbmRsZXI6IGFjY2Vzc29yID0+IG9wZW5FZGl0b3JBdEluZGV4KGFjY2Vzc29yLCBlZGl0b3JJbmRleClcblx0XHR9KTtcblx0fVxuXG5cdGZ1bmN0aW9uIHRvS2V5Q29kZShpbmRleDogbnVtYmVyKTogS2V5Q29kZSB7XG5cdFx0c3dpdGNoIChpbmRleCkge1xuXHRcdFx0Y2FzZSAwOiByZXR1cm4gS2V5Q29kZS5EaWdpdDA7XG5cdFx0XHRjYXNlIDE6IHJldHVybiBLZXlDb2RlLkRpZ2l0MTtcblx0XHRcdGNhc2UgMjogcmV0dXJuIEtleUNvZGUuRGlnaXQyO1xuXHRcdFx0Y2FzZSAzOiByZXR1cm4gS2V5Q29kZS5EaWdpdDM7XG5cdFx0XHRjYXNlIDQ6IHJldHVybiBLZXlDb2RlLkRpZ2l0NDtcblx0XHRcdGNhc2UgNTogcmV0dXJuIEtleUNvZGUuRGlnaXQ1O1xuXHRcdFx0Y2FzZSA2OiByZXR1cm4gS2V5Q29kZS5EaWdpdDY7XG5cdFx0XHRjYXNlIDc6IHJldHVybiBLZXlDb2RlLkRpZ2l0Nztcblx0XHRcdGNhc2UgODogcmV0dXJuIEtleUNvZGUuRGlnaXQ4O1xuXHRcdFx0Y2FzZSA5OiByZXR1cm4gS2V5Q29kZS5EaWdpdDk7XG5cdFx0fVxuXG5cdFx0dGhyb3cgbmV3IEVycm9yKCdpbnZhbGlkIGluZGV4Jyk7XG5cdH1cbn1cblxuZnVuY3Rpb24gcmVnaXN0ZXJGb2N1c0VkaXRvckdyb3VwQXRJbmRleENvbW1hbmRzKCk6IHZvaWQge1xuXG5cdC8vIEtleWJpbmRpbmdzIHRvIGZvY3VzIGEgc3BlY2lmaWMgZ3JvdXAgKDItOCkgaW4gdGhlIGVkaXRvciBhcmVhXG5cdGZvciAobGV0IGdyb3VwSW5kZXggPSAxOyBncm91cEluZGV4IDwgODsgZ3JvdXBJbmRleCsrKSB7XG5cdFx0S2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdFx0XHRpZDogdG9Db21tYW5kSWQoZ3JvdXBJbmRleCksXG5cdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdHdoZW46IHVuZGVmaW5lZCxcblx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgdG9LZXlDb2RlKGdyb3VwSW5kZXgpLFxuXHRcdFx0aGFuZGxlcjogYWNjZXNzb3IgPT4ge1xuXHRcdFx0XHRjb25zdCBlZGl0b3JHcm91cHNTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JHcm91cHNTZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblxuXHRcdFx0XHQvLyBUbyBrZWVwIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5IChwcmUtZ3JpZCksIGFsbG93IHRvIGZvY3VzIGEgZ3JvdXBcblx0XHRcdFx0Ly8gdGhhdCBkb2VzIG5vdCBleGlzdCBhcyBsb25nIGFzIGl0IGlzIHRoZSBuZXh0IGdyb3VwIGFmdGVyIHRoZSBsYXN0XG5cdFx0XHRcdC8vIG9wZW5lZCBncm91cC4gT3RoZXJ3aXNlIHdlIHJldHVybi5cblx0XHRcdFx0aWYgKGdyb3VwSW5kZXggPiBlZGl0b3JHcm91cHNTZXJ2aWNlLmNvdW50KSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gR3JvdXAgZXhpc3RzOiBqdXN0IGZvY3VzXG5cdFx0XHRcdGNvbnN0IGdyb3VwcyA9IGVkaXRvckdyb3Vwc1NlcnZpY2UuZ2V0R3JvdXBzKEdyb3Vwc09yZGVyLkdSSURfQVBQRUFSQU5DRSk7XG5cdFx0XHRcdGlmIChncm91cHNbZ3JvdXBJbmRleF0pIHtcblx0XHRcdFx0XHRyZXR1cm4gZ3JvdXBzW2dyb3VwSW5kZXhdLmZvY3VzKCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBHcm91cCBkb2VzIG5vdCBleGlzdDogY3JlYXRlIG5ldyBieSBzcGxpdHRpbmcgdGhlIGFjdGl2ZSBvbmUgb2YgdGhlIGxhc3QgZ3JvdXBcblx0XHRcdFx0Y29uc3QgZGlyZWN0aW9uID0gcHJlZmVycmVkU2lkZUJ5U2lkZUdyb3VwRGlyZWN0aW9uKGNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3QgbGFzdEdyb3VwID0gZWRpdG9yR3JvdXBzU2VydmljZS5maW5kR3JvdXAoeyBsb2NhdGlvbjogR3JvdXBMb2NhdGlvbi5MQVNUIH0pO1xuXHRcdFx0XHRpZiAoIWxhc3RHcm91cCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IG5ld0dyb3VwID0gZWRpdG9yR3JvdXBzU2VydmljZS5hZGRHcm91cChsYXN0R3JvdXAsIGRpcmVjdGlvbik7XG5cblx0XHRcdFx0Ly8gRm9jdXNcblx0XHRcdFx0bmV3R3JvdXAuZm9jdXMoKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdGZ1bmN0aW9uIHRvQ29tbWFuZElkKGluZGV4OiBudW1iZXIpOiBzdHJpbmcge1xuXHRcdHN3aXRjaCAoaW5kZXgpIHtcblx0XHRcdGNhc2UgMTogcmV0dXJuICd3b3JrYmVuY2guYWN0aW9uLmZvY3VzU2Vjb25kRWRpdG9yR3JvdXAnO1xuXHRcdFx0Y2FzZSAyOiByZXR1cm4gJ3dvcmtiZW5jaC5hY3Rpb24uZm9jdXNUaGlyZEVkaXRvckdyb3VwJztcblx0XHRcdGNhc2UgMzogcmV0dXJuICd3b3JrYmVuY2guYWN0aW9uLmZvY3VzRm91cnRoRWRpdG9yR3JvdXAnO1xuXHRcdFx0Y2FzZSA0OiByZXR1cm4gJ3dvcmtiZW5jaC5hY3Rpb24uZm9jdXNGaWZ0aEVkaXRvckdyb3VwJztcblx0XHRcdGNhc2UgNTogcmV0dXJuICd3b3JrYmVuY2guYWN0aW9uLmZvY3VzU2l4dGhFZGl0b3JHcm91cCc7XG5cdFx0XHRjYXNlIDY6IHJldHVybiAnd29ya2JlbmNoLmFjdGlvbi5mb2N1c1NldmVudGhFZGl0b3JHcm91cCc7XG5cdFx0XHRjYXNlIDc6IHJldHVybiAnd29ya2JlbmNoLmFjdGlvbi5mb2N1c0VpZ2h0aEVkaXRvckdyb3VwJztcblx0XHR9XG5cblx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaW5kZXgnKTtcblx0fVxuXG5cdGZ1bmN0aW9uIHRvS2V5Q29kZShpbmRleDogbnVtYmVyKTogS2V5Q29kZSB7XG5cdFx0c3dpdGNoIChpbmRleCkge1xuXHRcdFx0Y2FzZSAxOiByZXR1cm4gS2V5Q29kZS5EaWdpdDI7XG5cdFx0XHRjYXNlIDI6IHJldHVybiBLZXlDb2RlLkRpZ2l0Mztcblx0XHRcdGNhc2UgMzogcmV0dXJuIEtleUNvZGUuRGlnaXQ0O1xuXHRcdFx0Y2FzZSA0OiByZXR1cm4gS2V5Q29kZS5EaWdpdDU7XG5cdFx0XHRjYXNlIDU6IHJldHVybiBLZXlDb2RlLkRpZ2l0Njtcblx0XHRcdGNhc2UgNjogcmV0dXJuIEtleUNvZGUuRGlnaXQ3O1xuXHRcdFx0Y2FzZSA3OiByZXR1cm4gS2V5Q29kZS5EaWdpdDg7XG5cdFx0fVxuXG5cdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGluZGV4Jyk7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNwbGl0RWRpdG9yKGVkaXRvckdyb3Vwc1NlcnZpY2U6IElFZGl0b3JHcm91cHNTZXJ2aWNlLCBkaXJlY3Rpb246IEdyb3VwRGlyZWN0aW9uLCByZXNvbHZlZENvbnRleHQ6IElSZXNvbHZlZEVkaXRvckNvbW1hbmRzQ29udGV4dCk6IHZvaWQge1xuXHRpZiAoIXJlc29sdmVkQ29udGV4dC5ncm91cGVkRWRpdG9ycy5sZW5ndGgpIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHQvLyBPbmx5IHN1cHBvcnQgc3BsaXR0aW5nIGZyb20gb25lIHNvdXJjZSBncm91cFxuXHRjb25zdCB7IGdyb3VwLCBlZGl0b3JzIH0gPSByZXNvbHZlZENvbnRleHQuZ3JvdXBlZEVkaXRvcnNbMF07XG5cdGNvbnN0IHByZXNlcnZlRm9jdXMgPSByZXNvbHZlZENvbnRleHQucHJlc2VydmVGb2N1cztcblx0Y29uc3QgbmV3R3JvdXAgPSBlZGl0b3JHcm91cHNTZXJ2aWNlLmFkZEdyb3VwKGdyb3VwLCBkaXJlY3Rpb24pO1xuXG5cdGZvciAoY29uc3QgZWRpdG9yVG9Db3B5IG9mIGVkaXRvcnMpIHtcblx0XHQvLyBTcGxpdCBlZGl0b3IgKGlmIGl0IGNhbiBiZSBzcGxpdClcblx0XHRpZiAoZWRpdG9yVG9Db3B5ICYmICFlZGl0b3JUb0NvcHkuaGFzQ2FwYWJpbGl0eShFZGl0b3JJbnB1dENhcGFiaWxpdGllcy5TaW5nbGV0b24pKSB7XG5cdFx0XHRncm91cC5jb3B5RWRpdG9yKGVkaXRvclRvQ29weSwgbmV3R3JvdXAsIHsgcHJlc2VydmVGb2N1cyB9KTtcblx0XHR9XG5cdH1cblxuXHQvLyBGb2N1c1xuXHRuZXdHcm91cC5mb2N1cygpO1xufVxuXG5mdW5jdGlvbiByZWdpc3RlclNwbGl0RWRpdG9yQ29tbWFuZHMoKSB7XG5cdFtcblx0XHR7IGlkOiBTUExJVF9FRElUT1JfVVAsIGRpcmVjdGlvbjogR3JvdXBEaXJlY3Rpb24uVVAgfSxcblx0XHR7IGlkOiBTUExJVF9FRElUT1JfRE9XTiwgZGlyZWN0aW9uOiBHcm91cERpcmVjdGlvbi5ET1dOIH0sXG5cdFx0eyBpZDogU1BMSVRfRURJVE9SX0xFRlQsIGRpcmVjdGlvbjogR3JvdXBEaXJlY3Rpb24uTEVGVCB9LFxuXHRcdHsgaWQ6IFNQTElUX0VESVRPUl9SSUdIVCwgZGlyZWN0aW9uOiBHcm91cERpcmVjdGlvbi5SSUdIVCB9XG5cdF0uZm9yRWFjaCgoeyBpZCwgZGlyZWN0aW9uIH0pID0+IHtcblx0XHRDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZChpZCwgZnVuY3Rpb24gKGFjY2Vzc29yLCAuLi5hcmdzKSB7XG5cdFx0XHRjb25zdCByZXNvbHZlZENvbnRleHQgPSByZXNvbHZlQ29tbWFuZHNDb250ZXh0KGFyZ3MsIGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSksIGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSksIGFjY2Vzc29yLmdldChJTGlzdFNlcnZpY2UpKTtcblx0XHRcdHNwbGl0RWRpdG9yKGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSksIGRpcmVjdGlvbiwgcmVzb2x2ZWRDb250ZXh0KTtcblx0XHR9KTtcblx0fSk7XG59XG5cbmZ1bmN0aW9uIHJlZ2lzdGVyQ2xvc2VFZGl0b3JDb21tYW5kcygpIHtcblxuXHQvLyBBIHNwZWNpYWwgaGFuZGxlciBmb3IgXCJDbG9zZSBFZGl0b3JcIiBkZXBlbmRpbmcgb24gY29udGV4dFxuXHQvLyAtIGtleWJpbmRpbmluZzogZG8gbm90IGNsb3NlIHN0aWNreSBlZGl0b3JzLCByYXRoZXIgb3BlbiB0aGUgbmV4dCBub24tc3RpY2t5IGVkaXRvclxuXHQvLyAtIG1lbnU6IGFsd2F5cyBjbG9zZSBlZGl0b3IsIGV2ZW4gc3RpY2t5IG9uZXNcblx0ZnVuY3Rpb24gY2xvc2VFZGl0b3JIYW5kbGVyKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBmb3JjZUNsb3NlU3RpY2t5RWRpdG9yczogYm9vbGVhbiwgLi4uYXJnczogdW5rbm93bltdKTogUHJvbWlzZTx1bmtub3duPiB7XG5cdFx0Y29uc3QgZWRpdG9yR3JvdXBzU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSk7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cblx0XHRsZXQga2VlcFN0aWNreUVkaXRvcnM6IGJvb2xlYW4gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKGZvcmNlQ2xvc2VTdGlja3lFZGl0b3JzKSB7XG5cdFx0XHRrZWVwU3RpY2t5RWRpdG9ycyA9IGZhbHNlOyAvLyBleHBsaWNpdGx5IGNsb3NlIHN0aWNreSBlZGl0b3JzXG5cdFx0fSBlbHNlIGlmIChhcmdzLmxlbmd0aCkge1xuXHRcdFx0a2VlcFN0aWNreUVkaXRvcnMgPSBmYWxzZTsgLy8gd2UgaGF2ZSBhIGNvbnRleHQsIGFzIHN1Y2ggdGhpcyBjb21tYW5kIHdhcyB1c2VkIGUuZy4gZnJvbSB0aGUgdGFiIGNvbnRleHQgbWVudVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRrZWVwU3RpY2t5RWRpdG9ycyA9IGVkaXRvckdyb3Vwc1NlcnZpY2UucGFydE9wdGlvbnMucHJldmVudFBpbm5lZEVkaXRvckNsb3NlID09PSAna2V5Ym9hcmQnIHx8IGVkaXRvckdyb3Vwc1NlcnZpY2UucGFydE9wdGlvbnMucHJldmVudFBpbm5lZEVkaXRvckNsb3NlID09PSAna2V5Ym9hcmRBbmRNb3VzZSc7IC8vIHJlc3BlY3Qgc2V0dGluZyBvdGhlcndpc2Vcblx0XHR9XG5cblx0XHQvLyBTa2lwIG92ZXIgc3RpY2t5IGVkaXRvciBhbmQgc2VsZWN0IG5leHQgaWYgd2UgYXJlIGNvbmZpZ3VyZWQgdG8gZG8gc29cblx0XHRpZiAoa2VlcFN0aWNreUVkaXRvcnMpIHtcblx0XHRcdGNvbnN0IGFjdGl2ZUdyb3VwID0gZWRpdG9yR3JvdXBzU2VydmljZS5hY3RpdmVHcm91cDtcblx0XHRcdGNvbnN0IGFjdGl2ZUVkaXRvciA9IGFjdGl2ZUdyb3VwLmFjdGl2ZUVkaXRvcjtcblxuXHRcdFx0aWYgKGFjdGl2ZUVkaXRvciAmJiBhY3RpdmVHcm91cC5pc1N0aWNreShhY3RpdmVFZGl0b3IpKSB7XG5cblx0XHRcdFx0Ly8gT3BlbiBuZXh0IHJlY2VudGx5IGFjdGl2ZSBpbiBzYW1lIGdyb3VwXG5cdFx0XHRcdGNvbnN0IG5leHROb25TdGlja3lFZGl0b3JJbkdyb3VwID0gYWN0aXZlR3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUsIHsgZXhjbHVkZVN0aWNreTogdHJ1ZSB9KVswXTtcblx0XHRcdFx0aWYgKG5leHROb25TdGlja3lFZGl0b3JJbkdyb3VwKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGFjdGl2ZUdyb3VwLm9wZW5FZGl0b3IobmV4dE5vblN0aWNreUVkaXRvckluR3JvdXApO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gT3BlbiBuZXh0IHJlY2VudGx5IGFjdGl2ZSBhY3Jvc3MgYWxsIGdyb3Vwc1xuXHRcdFx0XHRjb25zdCBuZXh0Tm9uU3RpY2t5RWRpdG9ySW5BbGxHcm91cHMgPSBlZGl0b3JTZXJ2aWNlLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFLCB7IGV4Y2x1ZGVTdGlja3k6IHRydWUgfSlbMF07XG5cdFx0XHRcdGlmIChuZXh0Tm9uU3RpY2t5RWRpdG9ySW5BbGxHcm91cHMpIHtcblx0XHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGVkaXRvckdyb3Vwc1NlcnZpY2UuZ2V0R3JvdXAobmV4dE5vblN0aWNreUVkaXRvckluQWxsR3JvdXBzLmdyb3VwSWQpPy5vcGVuRWRpdG9yKG5leHROb25TdGlja3lFZGl0b3JJbkFsbEdyb3Vwcy5lZGl0b3IpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFdpdGggY29udGV4dDogcHJvY2VlZCB0byBjbG9zZSBlZGl0b3JzIGFzIGluc3RydWN0ZWRcblx0XHRjb25zdCByZXNvbHZlZENvbnRleHQgPSByZXNvbHZlQ29tbWFuZHNDb250ZXh0KGFyZ3MsIGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSksIGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSksIGFjY2Vzc29yLmdldChJTGlzdFNlcnZpY2UpKTtcblx0XHRjb25zdCBwcmVzZXJ2ZUZvY3VzID0gcmVzb2x2ZWRDb250ZXh0LnByZXNlcnZlRm9jdXM7XG5cblx0XHRyZXR1cm4gUHJvbWlzZS5hbGwocmVzb2x2ZWRDb250ZXh0Lmdyb3VwZWRFZGl0b3JzLm1hcChhc3luYyAoeyBncm91cCwgZWRpdG9ycyB9KSA9PiB7XG5cdFx0XHRjb25zdCBlZGl0b3JzVG9DbG9zZSA9IGVkaXRvcnMuZmlsdGVyKGVkaXRvciA9PiAha2VlcFN0aWNreUVkaXRvcnMgfHwgIWdyb3VwLmlzU3RpY2t5KGVkaXRvcikpO1xuXHRcdFx0YXdhaXQgZ3JvdXAuY2xvc2VFZGl0b3JzKGVkaXRvcnNUb0Nsb3NlLCB7IHByZXNlcnZlRm9jdXMgfSk7XG5cdFx0fSkpO1xuXHR9XG5cblx0S2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdFx0aWQ6IENMT1NFX0VESVRPUl9DT01NQU5EX0lELFxuXHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdHdoZW46IHVuZGVmaW5lZCxcblx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5Vyxcblx0XHR3aW46IHsgcHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkY0LCBzZWNvbmRhcnk6IFtLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5V10gfSxcblx0XHRoYW5kbGVyOiAoYWNjZXNzb3IsIC4uLmFyZ3M6IHVua25vd25bXSkgPT4ge1xuXHRcdFx0cmV0dXJuIGNsb3NlRWRpdG9ySGFuZGxlcihhY2Nlc3NvciwgZmFsc2UsIC4uLmFyZ3MpO1xuXHRcdH1cblx0fSk7XG5cblx0Q29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoQ0xPU0VfUElOTkVEX0VESVRPUl9DT01NQU5EX0lELCAoYWNjZXNzb3IsIC4uLmFyZ3M6IHVua25vd25bXSkgPT4ge1xuXHRcdHJldHVybiBjbG9zZUVkaXRvckhhbmRsZXIoYWNjZXNzb3IsIHRydWUgLyogZm9yY2UgY2xvc2UgcGlubmVkIGVkaXRvcnMgKi8sIC4uLmFyZ3MpO1xuXHR9KTtcblxuXHRLZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0XHRpZDogQ0xPU0VfRURJVE9SU19JTl9HUk9VUF9DT01NQU5EX0lELFxuXHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdHdoZW46IHVuZGVmaW5lZCxcblx0XHRwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5Q29kZS5LZXlXKSxcblx0XHRoYW5kbGVyOiAoYWNjZXNzb3IsIC4uLmFyZ3M6IHVua25vd25bXSkgPT4ge1xuXHRcdFx0Y29uc3QgcmVzb2x2ZWRDb250ZXh0ID0gcmVzb2x2ZUNvbW1hbmRzQ29udGV4dChhcmdzLCBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpLCBhY2Nlc3Nvci5nZXQoSUVkaXRvckdyb3Vwc1NlcnZpY2UpLCBhY2Nlc3Nvci5nZXQoSUxpc3RTZXJ2aWNlKSk7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5hbGwocmVzb2x2ZWRDb250ZXh0Lmdyb3VwZWRFZGl0b3JzLm1hcChhc3luYyAoeyBncm91cCB9KSA9PiB7XG5cdFx0XHRcdGF3YWl0IGdyb3VwLmNsb3NlQWxsRWRpdG9ycyh7IGV4Y2x1ZGVTdGlja3k6IHRydWUgfSk7XG5cdFx0XHR9KSk7XG5cdFx0fVxuXHR9KTtcblxuXHRLZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0XHRpZDogQ0xPU0VfRURJVE9SX0dST1VQX0NPTU1BTkRfSUQsXG5cdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKEFjdGl2ZUVkaXRvckdyb3VwRW1wdHlDb250ZXh0LCBNdWx0aXBsZUVkaXRvckdyb3Vwc0NvbnRleHQpLFxuXHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlXLFxuXHRcdHdpbjogeyBwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRjQsIHNlY29uZGFyeTogW0tleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlXXSB9LFxuXHRcdGhhbmRsZXI6IChhY2Nlc3NvciwgLi4uYXJnczogdW5rbm93bltdKSA9PiB7XG5cdFx0XHRjb25zdCBlZGl0b3JHcm91cHNTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JHcm91cHNTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGNvbW1hbmRzQ29udGV4dCA9IHJlc29sdmVDb21tYW5kc0NvbnRleHQoYXJncywgYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKSwgZWRpdG9yR3JvdXBzU2VydmljZSwgYWNjZXNzb3IuZ2V0KElMaXN0U2VydmljZSkpO1xuXG5cdFx0XHRpZiAoY29tbWFuZHNDb250ZXh0Lmdyb3VwZWRFZGl0b3JzLmxlbmd0aCkge1xuXHRcdFx0XHRlZGl0b3JHcm91cHNTZXJ2aWNlLnJlbW92ZUdyb3VwKGNvbW1hbmRzQ29udGV4dC5ncm91cGVkRWRpdG9yc1swXS5ncm91cCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcblxuXHRLZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0XHRpZDogQ0xPU0VfU0FWRURfRURJVE9SU19DT01NQU5EX0lELFxuXHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdHdoZW46IHVuZGVmaW5lZCxcblx0XHRwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5Q29kZS5LZXlVKSxcblx0XHRoYW5kbGVyOiAoYWNjZXNzb3IsIC4uLmFyZ3M6IHVua25vd25bXSkgPT4ge1xuXHRcdFx0Y29uc3QgcmVzb2x2ZWRDb250ZXh0ID0gcmVzb2x2ZUNvbW1hbmRzQ29udGV4dChhcmdzLCBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpLCBhY2Nlc3Nvci5nZXQoSUVkaXRvckdyb3Vwc1NlcnZpY2UpLCBhY2Nlc3Nvci5nZXQoSUxpc3RTZXJ2aWNlKSk7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5hbGwocmVzb2x2ZWRDb250ZXh0Lmdyb3VwZWRFZGl0b3JzLm1hcChhc3luYyAoeyBncm91cCB9KSA9PiB7XG5cdFx0XHRcdGF3YWl0IGdyb3VwLmNsb3NlRWRpdG9ycyh7IHNhdmVkT25seTogdHJ1ZSwgZXhjbHVkZVN0aWNreTogdHJ1ZSB9LCB7IHByZXNlcnZlRm9jdXM6IHJlc29sdmVkQ29udGV4dC5wcmVzZXJ2ZUZvY3VzIH0pO1xuXHRcdFx0fSkpO1xuXHRcdH1cblx0fSk7XG5cblx0S2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdFx0aWQ6IENMT1NFX09USEVSX0VESVRPUlNfSU5fR1JPVVBfQ09NTUFORF9JRCxcblx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHR3aGVuOiB1bmRlZmluZWQsXG5cdFx0cHJpbWFyeTogdW5kZWZpbmVkLFxuXHRcdG1hYzogeyBwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5BbHQgfCBLZXlDb2RlLktleVQgfSxcblx0XHRoYW5kbGVyOiAoYWNjZXNzb3IsIC4uLmFyZ3M6IHVua25vd25bXSkgPT4ge1xuXHRcdFx0Y29uc3QgcmVzb2x2ZWRDb250ZXh0ID0gcmVzb2x2ZUNvbW1hbmRzQ29udGV4dChhcmdzLCBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpLCBhY2Nlc3Nvci5nZXQoSUVkaXRvckdyb3Vwc1NlcnZpY2UpLCBhY2Nlc3Nvci5nZXQoSUxpc3RTZXJ2aWNlKSk7XG5cblx0XHRcdHJldHVybiBQcm9taXNlLmFsbChyZXNvbHZlZENvbnRleHQuZ3JvdXBlZEVkaXRvcnMubWFwKGFzeW5jICh7IGdyb3VwLCBlZGl0b3JzIH0pID0+IHtcblx0XHRcdFx0Y29uc3QgZWRpdG9yc1RvQ2xvc2UgPSBncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMLCB7IGV4Y2x1ZGVTdGlja3k6IHRydWUgfSkuZmlsdGVyKGVkaXRvciA9PiAhZWRpdG9ycy5pbmNsdWRlcyhlZGl0b3IpKTtcblxuXHRcdFx0XHRmb3IgKGNvbnN0IGVkaXRvclRvS2VlcCBvZiBlZGl0b3JzKSB7XG5cdFx0XHRcdFx0aWYgKGVkaXRvclRvS2VlcCkge1xuXHRcdFx0XHRcdFx0Z3JvdXAucGluRWRpdG9yKGVkaXRvclRvS2VlcCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0YXdhaXQgZ3JvdXAuY2xvc2VFZGl0b3JzKGVkaXRvcnNUb0Nsb3NlLCB7IHByZXNlcnZlRm9jdXM6IHJlc29sdmVkQ29udGV4dC5wcmVzZXJ2ZUZvY3VzIH0pO1xuXHRcdFx0fSkpO1xuXHRcdH1cblx0fSk7XG5cblx0S2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdFx0aWQ6IENMT1NFX0VESVRPUlNfVE9fVEhFX1JJR0hUX0NPTU1BTkRfSUQsXG5cdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0d2hlbjogdW5kZWZpbmVkLFxuXHRcdHByaW1hcnk6IHVuZGVmaW5lZCxcblx0XHRoYW5kbGVyOiBhc3luYyAoYWNjZXNzb3IsIC4uLmFyZ3M6IHVua25vd25bXSkgPT4ge1xuXHRcdFx0Y29uc3QgcmVzb2x2ZWRDb250ZXh0ID0gcmVzb2x2ZUNvbW1hbmRzQ29udGV4dChhcmdzLCBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpLCBhY2Nlc3Nvci5nZXQoSUVkaXRvckdyb3Vwc1NlcnZpY2UpLCBhY2Nlc3Nvci5nZXQoSUxpc3RTZXJ2aWNlKSk7XG5cdFx0XHRpZiAocmVzb2x2ZWRDb250ZXh0Lmdyb3VwZWRFZGl0b3JzLmxlbmd0aCkge1xuXHRcdFx0XHRjb25zdCB7IGdyb3VwLCBlZGl0b3JzIH0gPSByZXNvbHZlZENvbnRleHQuZ3JvdXBlZEVkaXRvcnNbMF07XG5cdFx0XHRcdGlmIChncm91cC5hY3RpdmVFZGl0b3IpIHtcblx0XHRcdFx0XHRncm91cC5waW5FZGl0b3IoZ3JvdXAuYWN0aXZlRWRpdG9yKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGF3YWl0IGdyb3VwLmNsb3NlRWRpdG9ycyh7IGRpcmVjdGlvbjogQ2xvc2VEaXJlY3Rpb24uUklHSFQsIGV4Y2VwdDogZWRpdG9yc1swXSwgZXhjbHVkZVN0aWNreTogdHJ1ZSB9LCB7IHByZXNlcnZlRm9jdXM6IHJlc29sdmVkQ29udGV4dC5wcmVzZXJ2ZUZvY3VzIH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG5cblx0S2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdFx0aWQ6IFJFT1BFTl9XSVRIX0NPTU1BTkRfSUQsXG5cdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0d2hlbjogdW5kZWZpbmVkLFxuXHRcdHByaW1hcnk6IHVuZGVmaW5lZCxcblx0XHRoYW5kbGVyOiBhc3luYyAoYWNjZXNzb3IsIC4uLmFyZ3M6IHVua25vd25bXSkgPT4ge1xuXHRcdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0XHRjb25zdCBlZGl0b3JSZXNvbHZlclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclJlc29sdmVyU2VydmljZSk7XG5cdFx0XHRjb25zdCB0ZWxlbWV0cnlTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElUZWxlbWV0cnlTZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3QgcmVzb2x2ZWRDb250ZXh0ID0gcmVzb2x2ZUNvbW1hbmRzQ29udGV4dChhcmdzLCBlZGl0b3JTZXJ2aWNlLCBhY2Nlc3Nvci5nZXQoSUVkaXRvckdyb3Vwc1NlcnZpY2UpLCBhY2Nlc3Nvci5nZXQoSUxpc3RTZXJ2aWNlKSk7XG5cdFx0XHRjb25zdCBlZGl0b3JSZXBsYWNlbWVudHMgPSBuZXcgTWFwPElFZGl0b3JHcm91cCwgSUVkaXRvclJlcGxhY2VtZW50W10+KCk7XG5cblx0XHRcdGZvciAoY29uc3QgeyBncm91cCwgZWRpdG9ycyB9IG9mIHJlc29sdmVkQ29udGV4dC5ncm91cGVkRWRpdG9ycykge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGVkaXRvciBvZiBlZGl0b3JzKSB7XG5cdFx0XHRcdFx0Y29uc3QgdW50eXBlZEVkaXRvciA9IGVkaXRvci50b1VudHlwZWQoKTtcblx0XHRcdFx0XHRpZiAoIXVudHlwZWRFZGl0b3IpIHtcblx0XHRcdFx0XHRcdHJldHVybjsgLy8gUmVzb2x2ZXIgY2FuIG9ubHkgcmVzb2x2ZSB1bnR5cGVkIGVkaXRvcnNcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR1bnR5cGVkRWRpdG9yLm9wdGlvbnMgPSB7IC4uLmVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZT8ub3B0aW9ucywgb3ZlcnJpZGU6IEVkaXRvclJlc29sdXRpb24uUElDSyB9O1xuXHRcdFx0XHRcdGNvbnN0IHJlc29sdmVkRWRpdG9yID0gYXdhaXQgZWRpdG9yUmVzb2x2ZXJTZXJ2aWNlLnJlc29sdmVFZGl0b3IodW50eXBlZEVkaXRvciwgZ3JvdXApO1xuXHRcdFx0XHRcdGlmICghaXNFZGl0b3JJbnB1dFdpdGhPcHRpb25zQW5kR3JvdXAocmVzb2x2ZWRFZGl0b3IpKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0bGV0IGVkaXRvclJlcGxhY2VtZW50c0luR3JvdXAgPSBlZGl0b3JSZXBsYWNlbWVudHMuZ2V0KGdyb3VwKTtcblx0XHRcdFx0XHRpZiAoIWVkaXRvclJlcGxhY2VtZW50c0luR3JvdXApIHtcblx0XHRcdFx0XHRcdGVkaXRvclJlcGxhY2VtZW50c0luR3JvdXAgPSBbXTtcblx0XHRcdFx0XHRcdGVkaXRvclJlcGxhY2VtZW50cy5zZXQoZ3JvdXAsIGVkaXRvclJlcGxhY2VtZW50c0luR3JvdXApO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGVkaXRvclJlcGxhY2VtZW50c0luR3JvdXAucHVzaCh7XG5cdFx0XHRcdFx0XHRlZGl0b3I6IGVkaXRvcixcblx0XHRcdFx0XHRcdHJlcGxhY2VtZW50OiByZXNvbHZlZEVkaXRvci5lZGl0b3IsXG5cdFx0XHRcdFx0XHRmb3JjZVJlcGxhY2VEaXJ0eTogZWRpdG9yLnJlc291cmNlPy5zY2hlbWUgPT09IFNjaGVtYXMudW50aXRsZWQsXG5cdFx0XHRcdFx0XHRvcHRpb25zOiByZXNvbHZlZEVkaXRvci5vcHRpb25zXG5cdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHQvLyBUZWxlbWV0cnlcblx0XHRcdFx0XHR0eXBlIFdvcmtiZW5jaEVkaXRvclJlb3BlbkNsYXNzaWZpY2F0aW9uID0ge1xuXHRcdFx0XHRcdFx0b3duZXI6ICdyZWJvcm5peCc7XG5cdFx0XHRcdFx0XHRjb21tZW50OiAnSWRlbnRpZnkgaG93IGEgZG9jdW1lbnQgaXMgcmVvcGVuZWQnO1xuXHRcdFx0XHRcdFx0c2NoZW1lOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnRmlsZSBzeXN0ZW0gcHJvdmlkZXIgc2NoZW1lIGZvciB0aGUgcmVzb3VyY2UnIH07XG5cdFx0XHRcdFx0XHRleHQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdGaWxlIGV4dGVuc2lvbiBmb3IgdGhlIHJlc291cmNlJyB9O1xuXHRcdFx0XHRcdFx0ZnJvbTogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSBlZGl0b3IgdmlldyB0eXBlIHRoZSByZXNvdXJjZSBpcyBzd2l0Y2hlZCBmcm9tJyB9O1xuXHRcdFx0XHRcdFx0dG86IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgZWRpdG9yIHZpZXcgdHlwZSB0aGUgcmVzb3VyY2UgaXMgc3dpdGNoZWQgdG8nIH07XG5cdFx0XHRcdFx0fTtcblxuXHRcdFx0XHRcdHR5cGUgV29ya2JlbmNoRWRpdG9yUmVvcGVuRXZlbnQgPSB7XG5cdFx0XHRcdFx0XHRzY2hlbWU6IHN0cmluZztcblx0XHRcdFx0XHRcdGV4dDogc3RyaW5nO1xuXHRcdFx0XHRcdFx0ZnJvbTogc3RyaW5nO1xuXHRcdFx0XHRcdFx0dG86IHN0cmluZztcblx0XHRcdFx0XHR9O1xuXG5cdFx0XHRcdFx0dGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFdvcmtiZW5jaEVkaXRvclJlb3BlbkV2ZW50LCBXb3JrYmVuY2hFZGl0b3JSZW9wZW5DbGFzc2lmaWNhdGlvbj4oJ3dvcmtiZW5jaEVkaXRvclJlb3BlbicsIHtcblx0XHRcdFx0XHRcdHNjaGVtZTogZWRpdG9yLnJlc291cmNlPy5zY2hlbWUgPz8gJycsXG5cdFx0XHRcdFx0XHRleHQ6IGVkaXRvci5yZXNvdXJjZSA/IGV4dG5hbWUoZWRpdG9yLnJlc291cmNlKSA6ICcnLFxuXHRcdFx0XHRcdFx0ZnJvbTogZWRpdG9yLmVkaXRvcklkID8/ICcnLFxuXHRcdFx0XHRcdFx0dG86IHJlc29sdmVkRWRpdG9yLmVkaXRvci5lZGl0b3JJZCA/PyAnJ1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIFJlcGxhY2UgZWRpdG9yIHdpdGggcmVzb2x2ZWQgb25lIGFuZCBtYWtlIGFjdGl2ZVxuXHRcdFx0Zm9yIChjb25zdCBbZ3JvdXAsIHJlcGxhY2VtZW50c10gb2YgZWRpdG9yUmVwbGFjZW1lbnRzKSB7XG5cdFx0XHRcdGF3YWl0IGdyb3VwLnJlcGxhY2VFZGl0b3JzKHJlcGxhY2VtZW50cyk7XG5cdFx0XHRcdGF3YWl0IGdyb3VwLm9wZW5FZGl0b3IocmVwbGFjZW1lbnRzWzBdLnJlcGxhY2VtZW50KTtcblx0XHRcdH1cblx0XHR9XG5cdH0pO1xuXG5cdENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKENMT1NFX0VESVRPUlNfQU5EX0dST1VQX0NPTU1BTkRfSUQsIGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogdW5rbm93bltdKSA9PiB7XG5cdFx0Y29uc3QgZWRpdG9yR3JvdXBzU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSk7XG5cblx0XHRjb25zdCByZXNvbHZlZENvbnRleHQgPSByZXNvbHZlQ29tbWFuZHNDb250ZXh0KGFyZ3MsIGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSksIGVkaXRvckdyb3Vwc1NlcnZpY2UsIGFjY2Vzc29yLmdldChJTGlzdFNlcnZpY2UpKTtcblx0XHRpZiAocmVzb2x2ZWRDb250ZXh0Lmdyb3VwZWRFZGl0b3JzLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgeyBncm91cCB9ID0gcmVzb2x2ZWRDb250ZXh0Lmdyb3VwZWRFZGl0b3JzWzBdO1xuXHRcdFx0YXdhaXQgZ3JvdXAuY2xvc2VBbGxFZGl0b3JzKCk7XG5cblx0XHRcdGlmIChncm91cC5jb3VudCA9PT0gMCAmJiBlZGl0b3JHcm91cHNTZXJ2aWNlLmdldEdyb3VwKGdyb3VwLmlkKSAvKiBjb3VsZCBiZSBnb25lIGJ5IG5vdyAqLykge1xuXHRcdFx0XHRlZGl0b3JHcm91cHNTZXJ2aWNlLnJlbW92ZUdyb3VwKGdyb3VwKTsgLy8gb25seSByZW1vdmUgZ3JvdXAgaWYgaXQgaXMgbm93IGVtcHR5XG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcbn1cblxuZnVuY3Rpb24gcmVnaXN0ZXJGb2N1c0VkaXRvckdyb3VwV2lob3V0V3JhcENvbW1hbmRzKCk6IHZvaWQge1xuXG5cdGNvbnN0IGNvbW1hbmRzID0gW1xuXHRcdHtcblx0XHRcdGlkOiBGT0NVU19MRUZUX0dST1VQX1dJVEhPVVRfV1JBUF9DT01NQU5EX0lELFxuXHRcdFx0ZGlyZWN0aW9uOiBHcm91cERpcmVjdGlvbi5MRUZUXG5cdFx0fSxcblx0XHR7XG5cdFx0XHRpZDogRk9DVVNfUklHSFRfR1JPVVBfV0lUSE9VVF9XUkFQX0NPTU1BTkRfSUQsXG5cdFx0XHRkaXJlY3Rpb246IEdyb3VwRGlyZWN0aW9uLlJJR0hUXG5cdFx0fSxcblx0XHR7XG5cdFx0XHRpZDogRk9DVVNfQUJPVkVfR1JPVVBfV0lUSE9VVF9XUkFQX0NPTU1BTkRfSUQsXG5cdFx0XHRkaXJlY3Rpb246IEdyb3VwRGlyZWN0aW9uLlVQLFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0aWQ6IEZPQ1VTX0JFTE9XX0dST1VQX1dJVEhPVVRfV1JBUF9DT01NQU5EX0lELFxuXHRcdFx0ZGlyZWN0aW9uOiBHcm91cERpcmVjdGlvbi5ET1dOXG5cdFx0fVxuXHRdO1xuXG5cdGZvciAoY29uc3QgY29tbWFuZCBvZiBjb21tYW5kcykge1xuXHRcdENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKGNvbW1hbmQuaWQsIGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvcikgPT4ge1xuXHRcdFx0Y29uc3QgZWRpdG9yR3JvdXBzU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSk7XG5cblx0XHRcdGNvbnN0IGdyb3VwID0gZWRpdG9yR3JvdXBzU2VydmljZS5maW5kR3JvdXAoeyBkaXJlY3Rpb246IGNvbW1hbmQuZGlyZWN0aW9uIH0sIGVkaXRvckdyb3Vwc1NlcnZpY2UuYWN0aXZlR3JvdXAsIGZhbHNlKSA/PyBlZGl0b3JHcm91cHNTZXJ2aWNlLmFjdGl2ZUdyb3VwO1xuXHRcdFx0Z3JvdXAuZm9jdXMoKTtcblx0XHR9KTtcblx0fVxufVxuXG5mdW5jdGlvbiByZWdpc3RlclNwbGl0RWRpdG9ySW5Hcm91cENvbW1hbmRzKCk6IHZvaWQge1xuXG5cdGFzeW5jIGZ1bmN0aW9uIHNwbGl0RWRpdG9ySW5Hcm91cChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgcmVzb2x2ZWRDb250ZXh0OiBJUmVzb2x2ZWRFZGl0b3JDb21tYW5kc0NvbnRleHQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXG5cdFx0aWYgKCFyZXNvbHZlZENvbnRleHQuZ3JvdXBlZEVkaXRvcnMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgeyBncm91cCwgZWRpdG9ycyB9ID0gcmVzb2x2ZWRDb250ZXh0Lmdyb3VwZWRFZGl0b3JzWzBdO1xuXHRcdGNvbnN0IGVkaXRvciA9IGVkaXRvcnNbMF07XG5cdFx0aWYgKCFlZGl0b3IpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRhd2FpdCBncm91cC5yZXBsYWNlRWRpdG9ycyhbe1xuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0cmVwbGFjZW1lbnQ6IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNpZGVCeVNpZGVFZGl0b3JJbnB1dCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGVkaXRvciwgZWRpdG9yKSxcblx0XHRcdGZvcmNlUmVwbGFjZURpcnR5OiB0cnVlXG5cdFx0fV0pO1xuXHR9XG5cblx0cmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiBTUExJVF9FRElUT1JfSU5fR1JPVVAsXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3NwbGl0RWRpdG9ySW5Hcm91cCcsICdTcGxpdCBFZGl0b3IgaW4gR3JvdXAnKSxcblx0XHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlldyxcblx0XHRcdFx0cHJlY29uZGl0aW9uOiBBY3RpdmVFZGl0b3JDYW5TcGxpdEluR3JvdXBDb250ZXh0LFxuXHRcdFx0XHRmMTogdHJ1ZSxcblx0XHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRcdHdoZW46IEFjdGl2ZUVkaXRvckNhblNwbGl0SW5Hcm91cENvbnRleHQsXG5cdFx0XHRcdFx0cHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5CYWNrc2xhc2gpXG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblx0XHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IHVua25vd25bXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0cmV0dXJuIHNwbGl0RWRpdG9ySW5Hcm91cChhY2Nlc3NvciwgcmVzb2x2ZUNvbW1hbmRzQ29udGV4dChhcmdzLCBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpLCBhY2Nlc3Nvci5nZXQoSUVkaXRvckdyb3Vwc1NlcnZpY2UpLCBhY2Nlc3Nvci5nZXQoSUxpc3RTZXJ2aWNlKSkpO1xuXHRcdH1cblx0fSk7XG5cblx0YXN5bmMgZnVuY3Rpb24gam9pbkVkaXRvckluR3JvdXAocmVzb2x2ZWRDb250ZXh0OiBJUmVzb2x2ZWRFZGl0b3JDb21tYW5kc0NvbnRleHQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXJlc29sdmVkQ29udGV4dC5ncm91cGVkRWRpdG9ycy5sZW5ndGgpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB7IGdyb3VwLCBlZGl0b3JzIH0gPSByZXNvbHZlZENvbnRleHQuZ3JvdXBlZEVkaXRvcnNbMF07XG5cdFx0Y29uc3QgZWRpdG9yID0gZWRpdG9yc1swXTtcblx0XHRpZiAoIWVkaXRvcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghKGVkaXRvciBpbnN0YW5jZW9mIFNpZGVCeVNpZGVFZGl0b3JJbnB1dCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRsZXQgb3B0aW9uczogSUVkaXRvck9wdGlvbnMgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgYWN0aXZlRWRpdG9yUGFuZSA9IGdyb3VwLmFjdGl2ZUVkaXRvclBhbmU7XG5cdFx0aWYgKGFjdGl2ZUVkaXRvclBhbmUgaW5zdGFuY2VvZiBTaWRlQnlTaWRlRWRpdG9yICYmIGdyb3VwLmFjdGl2ZUVkaXRvciA9PT0gZWRpdG9yKSB7XG5cdFx0XHRmb3IgKGNvbnN0IHBhbmUgb2YgW2FjdGl2ZUVkaXRvclBhbmUuZ2V0UHJpbWFyeUVkaXRvclBhbmUoKSwgYWN0aXZlRWRpdG9yUGFuZS5nZXRTZWNvbmRhcnlFZGl0b3JQYW5lKCldKSB7XG5cdFx0XHRcdGlmIChwYW5lPy5oYXNGb2N1cygpKSB7XG5cdFx0XHRcdFx0b3B0aW9ucyA9IHsgdmlld1N0YXRlOiBwYW5lLmdldFZpZXdTdGF0ZSgpIH07XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRhd2FpdCBncm91cC5yZXBsYWNlRWRpdG9ycyhbe1xuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0cmVwbGFjZW1lbnQ6IGVkaXRvci5wcmltYXJ5LFxuXHRcdFx0b3B0aW9uc1xuXHRcdH1dKTtcblx0fVxuXG5cdHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRpZDogSk9JTl9FRElUT1JfSU5fR1JPVVAsXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2pvaW5FZGl0b3JJbkdyb3VwJywgJ0pvaW4gRWRpdG9yIGluIEdyb3VwJyksXG5cdFx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXcsXG5cdFx0XHRcdHByZWNvbmRpdGlvbjogU2lkZUJ5U2lkZUVkaXRvckFjdGl2ZUNvbnRleHQsXG5cdFx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdFx0d2hlbjogU2lkZUJ5U2lkZUVkaXRvckFjdGl2ZUNvbnRleHQsXG5cdFx0XHRcdFx0cHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5CYWNrc2xhc2gpXG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblx0XHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IHVua25vd25bXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0cmV0dXJuIGpvaW5FZGl0b3JJbkdyb3VwKHJlc29sdmVDb21tYW5kc0NvbnRleHQoYXJncywgYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKSwgYWNjZXNzb3IuZ2V0KElFZGl0b3JHcm91cHNTZXJ2aWNlKSwgYWNjZXNzb3IuZ2V0KElMaXN0U2VydmljZSkpKTtcblx0XHR9XG5cdH0pO1xuXG5cdHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRpZDogVE9HR0xFX1NQTElUX0VESVRPUl9JTl9HUk9VUCxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMigndG9nZ2xlSm9pbkVkaXRvckluR3JvdXAnLCAnVG9nZ2xlIFNwbGl0IEVkaXRvciBpbiBHcm91cCcpLFxuXHRcdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3LFxuXHRcdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLm9yKEFjdGl2ZUVkaXRvckNhblNwbGl0SW5Hcm91cENvbnRleHQsIFNpZGVCeVNpZGVFZGl0b3JBY3RpdmVDb250ZXh0KSxcblx0XHRcdFx0ZjE6IHRydWVcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IHVua25vd25bXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0Y29uc3QgcmVzb2x2ZWRDb250ZXh0ID0gcmVzb2x2ZUNvbW1hbmRzQ29udGV4dChhcmdzLCBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpLCBhY2Nlc3Nvci5nZXQoSUVkaXRvckdyb3Vwc1NlcnZpY2UpLCBhY2Nlc3Nvci5nZXQoSUxpc3RTZXJ2aWNlKSk7XG5cdFx0XHRpZiAoIXJlc29sdmVkQ29udGV4dC5ncm91cGVkRWRpdG9ycy5sZW5ndGgpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB7IGVkaXRvcnMgfSA9IHJlc29sdmVkQ29udGV4dC5ncm91cGVkRWRpdG9yc1swXTtcblxuXHRcdFx0aWYgKGVkaXRvcnNbMF0gaW5zdGFuY2VvZiBTaWRlQnlTaWRlRWRpdG9ySW5wdXQpIHtcblx0XHRcdFx0YXdhaXQgam9pbkVkaXRvckluR3JvdXAocmVzb2x2ZWRDb250ZXh0KTtcblx0XHRcdH0gZWxzZSBpZiAoZWRpdG9yc1swXSkge1xuXHRcdFx0XHRhd2FpdCBzcGxpdEVkaXRvckluR3JvdXAoYWNjZXNzb3IsIHJlc29sdmVkQ29udGV4dCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcblxuXHRyZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdHN1cGVyKHtcblx0XHRcdFx0aWQ6IFRPR0dMRV9TUExJVF9FRElUT1JfSU5fR1JPVVBfTEFZT1VULFxuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUyKCd0b2dnbGVTcGxpdEVkaXRvckluR3JvdXBMYXlvdXQnLCAnVG9nZ2xlIExheW91dCBvZiBTcGxpdCBFZGl0b3IgaW4gR3JvdXAnKSxcblx0XHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlldyxcblx0XHRcdFx0cHJlY29uZGl0aW9uOiBTaWRlQnlTaWRlRWRpdG9yQWN0aXZlQ29udGV4dCxcblx0XHRcdFx0ZjE6IHRydWVcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0XHRjb25zdCBjdXJyZW50U2V0dGluZyA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPHVua25vd24+KFNpZGVCeVNpZGVFZGl0b3IuU0lERV9CWV9TSURFX0xBWU9VVF9TRVRUSU5HKTtcblxuXHRcdFx0bGV0IG5ld1NldHRpbmc6ICd2ZXJ0aWNhbCcgfCAnaG9yaXpvbnRhbCc7XG5cdFx0XHRpZiAoY3VycmVudFNldHRpbmcgIT09ICdob3Jpem9udGFsJykge1xuXHRcdFx0XHRuZXdTZXR0aW5nID0gJ2hvcml6b250YWwnO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bmV3U2V0dGluZyA9ICd2ZXJ0aWNhbCc7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBjb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVWYWx1ZShTaWRlQnlTaWRlRWRpdG9yLlNJREVfQllfU0lERV9MQVlPVVRfU0VUVElORywgbmV3U2V0dGluZyk7XG5cdFx0fVxuXHR9KTtcbn1cblxuZnVuY3Rpb24gcmVnaXN0ZXJGb2N1c1NpZGVFZGl0b3JzQ29tbWFuZHMoKTogdm9pZCB7XG5cblx0cmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiBGT0NVU19GSVJTVF9TSURFX0VESVRPUixcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMignZm9jdXNMZWZ0U2lkZUVkaXRvcicsICdGb2N1cyBGaXJzdCBTaWRlIGluIEFjdGl2ZSBFZGl0b3InKSxcblx0XHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlldyxcblx0XHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5vcihTaWRlQnlTaWRlRWRpdG9yQWN0aXZlQ29udGV4dCwgVGV4dENvbXBhcmVFZGl0b3JBY3RpdmVDb250ZXh0KSxcblx0XHRcdFx0ZjE6IHRydWVcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgY29tbWFuZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbW1hbmRTZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3QgYWN0aXZlRWRpdG9yUGFuZSA9IGVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZTtcblx0XHRcdGlmIChhY3RpdmVFZGl0b3JQYW5lIGluc3RhbmNlb2YgU2lkZUJ5U2lkZUVkaXRvcikge1xuXHRcdFx0XHRhY3RpdmVFZGl0b3JQYW5lLmdldFNlY29uZGFyeUVkaXRvclBhbmUoKT8uZm9jdXMoKTtcblx0XHRcdH0gZWxzZSBpZiAoYWN0aXZlRWRpdG9yUGFuZSBpbnN0YW5jZW9mIFRleHREaWZmRWRpdG9yKSB7XG5cdFx0XHRcdGF3YWl0IGNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKERJRkZfRk9DVVNfU0VDT05EQVJZX1NJREUpO1xuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG5cblx0cmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiBGT0NVU19TRUNPTkRfU0lERV9FRElUT1IsXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2ZvY3VzUmlnaHRTaWRlRWRpdG9yJywgJ0ZvY3VzIFNlY29uZCBTaWRlIGluIEFjdGl2ZSBFZGl0b3InKSxcblx0XHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlldyxcblx0XHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5vcihTaWRlQnlTaWRlRWRpdG9yQWN0aXZlQ29udGV4dCwgVGV4dENvbXBhcmVFZGl0b3JBY3RpdmVDb250ZXh0KSxcblx0XHRcdFx0ZjE6IHRydWVcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgY29tbWFuZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbW1hbmRTZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3QgYWN0aXZlRWRpdG9yUGFuZSA9IGVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZTtcblx0XHRcdGlmIChhY3RpdmVFZGl0b3JQYW5lIGluc3RhbmNlb2YgU2lkZUJ5U2lkZUVkaXRvcikge1xuXHRcdFx0XHRhY3RpdmVFZGl0b3JQYW5lLmdldFByaW1hcnlFZGl0b3JQYW5lKCk/LmZvY3VzKCk7XG5cdFx0XHR9IGVsc2UgaWYgKGFjdGl2ZUVkaXRvclBhbmUgaW5zdGFuY2VvZiBUZXh0RGlmZkVkaXRvcikge1xuXHRcdFx0XHRhd2FpdCBjb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChESUZGX0ZPQ1VTX1BSSU1BUllfU0lERSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcblxuXHRyZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdHN1cGVyKHtcblx0XHRcdFx0aWQ6IEZPQ1VTX09USEVSX1NJREVfRURJVE9SLFxuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUyKCdmb2N1c090aGVyU2lkZUVkaXRvcicsICdGb2N1cyBPdGhlciBTaWRlIGluIEFjdGl2ZSBFZGl0b3InKSxcblx0XHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlldyxcblx0XHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5vcihTaWRlQnlTaWRlRWRpdG9yQWN0aXZlQ29udGV4dCwgVGV4dENvbXBhcmVFZGl0b3JBY3RpdmVDb250ZXh0KSxcblx0XHRcdFx0ZjE6IHRydWVcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgY29tbWFuZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbW1hbmRTZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3QgYWN0aXZlRWRpdG9yUGFuZSA9IGVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZTtcblx0XHRcdGlmIChhY3RpdmVFZGl0b3JQYW5lIGluc3RhbmNlb2YgU2lkZUJ5U2lkZUVkaXRvcikge1xuXHRcdFx0XHRpZiAoYWN0aXZlRWRpdG9yUGFuZS5nZXRQcmltYXJ5RWRpdG9yUGFuZSgpPy5oYXNGb2N1cygpKSB7XG5cdFx0XHRcdFx0YWN0aXZlRWRpdG9yUGFuZS5nZXRTZWNvbmRhcnlFZGl0b3JQYW5lKCk/LmZvY3VzKCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YWN0aXZlRWRpdG9yUGFuZS5nZXRQcmltYXJ5RWRpdG9yUGFuZSgpPy5mb2N1cygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKGFjdGl2ZUVkaXRvclBhbmUgaW5zdGFuY2VvZiBUZXh0RGlmZkVkaXRvcikge1xuXHRcdFx0XHRhd2FpdCBjb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChESUZGX0ZPQ1VTX09USEVSX1NJREUpO1xuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG59XG5cbmZ1bmN0aW9uIHJlZ2lzdGVyT3RoZXJFZGl0b3JDb21tYW5kcygpOiB2b2lkIHtcblxuXHRLZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0XHRpZDogS0VFUF9FRElUT1JfQ09NTUFORF9JRCxcblx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHR3aGVuOiB1bmRlZmluZWQsXG5cdFx0cHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleUNvZGUuRW50ZXIpLFxuXHRcdGhhbmRsZXI6IGFzeW5jIChhY2Nlc3NvciwgLi4uYXJnczogdW5rbm93bltdKSA9PiB7XG5cdFx0XHRjb25zdCByZXNvbHZlZENvbnRleHQgPSByZXNvbHZlQ29tbWFuZHNDb250ZXh0KGFyZ3MsIGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSksIGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSksIGFjY2Vzc29yLmdldChJTGlzdFNlcnZpY2UpKTtcblx0XHRcdGZvciAoY29uc3QgeyBncm91cCwgZWRpdG9ycyB9IG9mIHJlc29sdmVkQ29udGV4dC5ncm91cGVkRWRpdG9ycykge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGVkaXRvciBvZiBlZGl0b3JzKSB7XG5cdFx0XHRcdFx0Z3JvdXAucGluRWRpdG9yKGVkaXRvcik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH0pO1xuXG5cdENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKHtcblx0XHRpZDogVE9HR0xFX0tFRVBfRURJVE9SU19DT01NQU5EX0lELFxuXHRcdGhhbmRsZXI6IGFjY2Vzc29yID0+IHtcblx0XHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cblx0XHRcdGNvbnN0IGN1cnJlbnRTZXR0aW5nID0gY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ3dvcmtiZW5jaC5lZGl0b3IuZW5hYmxlUHJldmlldycpO1xuXHRcdFx0Y29uc3QgbmV3U2V0dGluZyA9IGN1cnJlbnRTZXR0aW5nID09PSB0cnVlID8gZmFsc2UgOiB0cnVlO1xuXHRcdFx0Y29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoJ3dvcmtiZW5jaC5lZGl0b3IuZW5hYmxlUHJldmlldycsIG5ld1NldHRpbmcpO1xuXHRcdH1cblx0fSk7XG5cblx0ZnVuY3Rpb24gc2V0RWRpdG9yR3JvdXBMb2NrKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBsb2NrZWQ6IGJvb2xlYW4gfCB1bmRlZmluZWQsIC4uLmFyZ3M6IHVua25vd25bXSk6IHZvaWQge1xuXHRcdGNvbnN0IHJlc29sdmVkQ29udGV4dCA9IHJlc29sdmVDb21tYW5kc0NvbnRleHQoYXJncywgYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKSwgYWNjZXNzb3IuZ2V0KElFZGl0b3JHcm91cHNTZXJ2aWNlKSwgYWNjZXNzb3IuZ2V0KElMaXN0U2VydmljZSkpO1xuXHRcdGNvbnN0IGdyb3VwID0gcmVzb2x2ZWRDb250ZXh0Lmdyb3VwZWRFZGl0b3JzWzBdPy5ncm91cDtcblx0XHRncm91cD8ubG9jayhsb2NrZWQgPz8gIWdyb3VwLmlzTG9ja2VkKTtcblx0fVxuXG5cdHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRpZDogVE9HR0xFX0xPQ0tfR1JPVVBfQ09NTUFORF9JRCxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMigndG9nZ2xlRWRpdG9yR3JvdXBMb2NrJywgJ1RvZ2dsZSBFZGl0b3IgR3JvdXAgTG9jaycpLFxuXHRcdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3LFxuXHRcdFx0XHRmMTogdHJ1ZVxuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogdW5rbm93bltdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRzZXRFZGl0b3JHcm91cExvY2soYWNjZXNzb3IsIHVuZGVmaW5lZCwgLi4uYXJncyk7XG5cdFx0fVxuXHR9KTtcblxuXHRyZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdHN1cGVyKHtcblx0XHRcdFx0aWQ6IExPQ0tfR1JPVVBfQ09NTUFORF9JRCxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMignbG9ja0VkaXRvckdyb3VwJywgJ0xvY2sgRWRpdG9yIEdyb3VwJyksXG5cdFx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXcsXG5cdFx0XHRcdHByZWNvbmRpdGlvbjogQWN0aXZlRWRpdG9yR3JvdXBMb2NrZWRDb250ZXh0LnRvTmVnYXRlZCgpLFxuXHRcdFx0XHRmMTogdHJ1ZVxuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogdW5rbm93bltdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRzZXRFZGl0b3JHcm91cExvY2soYWNjZXNzb3IsIHRydWUsIC4uLmFyZ3MpO1xuXHRcdH1cblx0fSk7XG5cblx0cmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiBVTkxPQ0tfR1JPVVBfQ09NTUFORF9JRCxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMigndW5sb2NrRWRpdG9yR3JvdXAnLCAnVW5sb2NrIEVkaXRvciBHcm91cCcpLFxuXHRcdFx0XHRwcmVjb25kaXRpb246IEFjdGl2ZUVkaXRvckdyb3VwTG9ja2VkQ29udGV4dCxcblx0XHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlldyxcblx0XHRcdFx0ZjE6IHRydWVcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IHVua25vd25bXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0c2V0RWRpdG9yR3JvdXBMb2NrKGFjY2Vzc29yLCBmYWxzZSwgLi4uYXJncyk7XG5cdFx0fVxuXHR9KTtcblxuXHRLZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0XHRpZDogUElOX0VESVRPUl9DT01NQU5EX0lELFxuXHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdHdoZW46IEFjdGl2ZUVkaXRvclN0aWNreUNvbnRleHQudG9OZWdhdGVkKCksXG5cdFx0cHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleU1vZC5TaGlmdCB8IEtleUNvZGUuRW50ZXIpLFxuXHRcdGhhbmRsZXI6IGFzeW5jIChhY2Nlc3NvciwgLi4uYXJnczogdW5rbm93bltdKSA9PiB7XG5cdFx0XHRjb25zdCByZXNvbHZlZENvbnRleHQgPSByZXNvbHZlQ29tbWFuZHNDb250ZXh0KGFyZ3MsIGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSksIGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSksIGFjY2Vzc29yLmdldChJTGlzdFNlcnZpY2UpKTtcblx0XHRcdGZvciAoY29uc3QgeyBncm91cCwgZWRpdG9ycyB9IG9mIHJlc29sdmVkQ29udGV4dC5ncm91cGVkRWRpdG9ycykge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGVkaXRvciBvZiBlZGl0b3JzKSB7XG5cdFx0XHRcdFx0Z3JvdXAuc3RpY2tFZGl0b3IoZWRpdG9yKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG5cblx0S2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdFx0aWQ6IERJRkZfT1BFTl9TSURFLFxuXHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdHdoZW46IEVkaXRvckNvbnRleHRLZXlzLmluRGlmZkVkaXRvcixcblx0XHRwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5LZXlPKSxcblx0XHRoYW5kbGVyOiBhc3luYyBhY2Nlc3NvciA9PiB7XG5cdFx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGVkaXRvckdyb3Vwc1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvckdyb3Vwc1NlcnZpY2UpO1xuXG5cdFx0XHRjb25zdCBhY3RpdmVFZGl0b3IgPSBlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvcjtcblx0XHRcdGNvbnN0IGFjdGl2ZVRleHRFZGl0b3JDb250cm9sID0gZWRpdG9yU2VydmljZS5hY3RpdmVUZXh0RWRpdG9yQ29udHJvbDtcblx0XHRcdGlmICghaXNEaWZmRWRpdG9yKGFjdGl2ZVRleHRFZGl0b3JDb250cm9sKSB8fCAhKGFjdGl2ZUVkaXRvciBpbnN0YW5jZW9mIERpZmZFZGl0b3JJbnB1dCkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRsZXQgZWRpdG9yOiBFZGl0b3JJbnB1dCB8IHVuZGVmaW5lZDtcblx0XHRcdGNvbnN0IG9yaWdpbmFsRWRpdG9yID0gYWN0aXZlVGV4dEVkaXRvckNvbnRyb2wuZ2V0T3JpZ2luYWxFZGl0b3IoKTtcblx0XHRcdGlmIChvcmlnaW5hbEVkaXRvci5oYXNUZXh0Rm9jdXMoKSkge1xuXHRcdFx0XHRlZGl0b3IgPSBhY3RpdmVFZGl0b3Iub3JpZ2luYWw7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRlZGl0b3IgPSBhY3RpdmVFZGl0b3IubW9kaWZpZWQ7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBlZGl0b3JHcm91cHNTZXJ2aWNlLmFjdGl2ZUdyb3VwLm9wZW5FZGl0b3IoZWRpdG9yKTtcblx0XHR9XG5cdH0pO1xuXG5cdEtleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRcdGlkOiBVTlBJTl9FRElUT1JfQ09NTUFORF9JRCxcblx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHR3aGVuOiBBY3RpdmVFZGl0b3JTdGlja3lDb250ZXh0LFxuXHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkVudGVyKSxcblx0XHRoYW5kbGVyOiBhc3luYyAoYWNjZXNzb3IsIC4uLmFyZ3M6IHVua25vd25bXSkgPT4ge1xuXHRcdFx0Y29uc3QgcmVzb2x2ZWRDb250ZXh0ID0gcmVzb2x2ZUNvbW1hbmRzQ29udGV4dChhcmdzLCBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpLCBhY2Nlc3Nvci5nZXQoSUVkaXRvckdyb3Vwc1NlcnZpY2UpLCBhY2Nlc3Nvci5nZXQoSUxpc3RTZXJ2aWNlKSk7XG5cdFx0XHRmb3IgKGNvbnN0IHsgZ3JvdXAsIGVkaXRvcnMgfSBvZiByZXNvbHZlZENvbnRleHQuZ3JvdXBlZEVkaXRvcnMpIHtcblx0XHRcdFx0Zm9yIChjb25zdCBlZGl0b3Igb2YgZWRpdG9ycykge1xuXHRcdFx0XHRcdGdyb3VwLnVuc3RpY2tFZGl0b3IoZWRpdG9yKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG5cblx0S2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdFx0aWQ6IFNIT1dfRURJVE9SU19JTl9HUk9VUCxcblx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHR3aGVuOiB1bmRlZmluZWQsXG5cdFx0cHJpbWFyeTogdW5kZWZpbmVkLFxuXHRcdGhhbmRsZXI6IChhY2Nlc3NvciwgLi4uYXJnczogdW5rbm93bltdKSA9PiB7XG5cdFx0XHRjb25zdCBlZGl0b3JHcm91cHNTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JHcm91cHNTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHF1aWNrSW5wdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElRdWlja0lucHV0U2VydmljZSk7XG5cblx0XHRcdGNvbnN0IGNvbW1hbmRzQ29udGV4dCA9IHJlc29sdmVDb21tYW5kc0NvbnRleHQoYXJncywgYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKSwgZWRpdG9yR3JvdXBzU2VydmljZSwgYWNjZXNzb3IuZ2V0KElMaXN0U2VydmljZSkpO1xuXHRcdFx0Y29uc3QgZ3JvdXAgPSBjb21tYW5kc0NvbnRleHQuZ3JvdXBlZEVkaXRvcnNbMF0/Lmdyb3VwO1xuXHRcdFx0aWYgKGdyb3VwKSB7XG5cdFx0XHRcdGVkaXRvckdyb3Vwc1NlcnZpY2UuYWN0aXZhdGVHcm91cChncm91cCk7IC8vIHdlIG5lZWQgdGhlIGdyb3VwIHRvIGJlIGFjdGl2ZVxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gcXVpY2tJbnB1dFNlcnZpY2UucXVpY2tBY2Nlc3Muc2hvdyhBY3RpdmVHcm91cEVkaXRvcnNCeU1vc3RSZWNlbnRseVVzZWRRdWlja0FjY2Vzcy5QUkVGSVgpO1xuXHRcdH1cblx0fSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXR1cCgpOiB2b2lkIHtcblx0cmVnaXN0ZXJBY3RpdmVFZGl0b3JNb3ZlQ29weUNvbW1hbmQoKTtcblx0cmVnaXN0ZXJFZGl0b3JHcm91cHNMYXlvdXRDb21tYW5kcygpO1xuXHRyZWdpc3RlckRpZmZFZGl0b3JDb21tYW5kcygpO1xuXHRyZWdpc3Rlck9wZW5FZGl0b3JBUElDb21tYW5kcygpO1xuXHRyZWdpc3Rlck9wZW5FZGl0b3JBdEluZGV4Q29tbWFuZHMoKTtcblx0cmVnaXN0ZXJDbG9zZUVkaXRvckNvbW1hbmRzKCk7XG5cdHJlZ2lzdGVyT3RoZXJFZGl0b3JDb21tYW5kcygpO1xuXHRyZWdpc3RlclNwbGl0RWRpdG9ySW5Hcm91cENvbW1hbmRzKCk7XG5cdHJlZ2lzdGVyRm9jdXNTaWRlRWRpdG9yc0NvbW1hbmRzKCk7XG5cdHJlZ2lzdGVyRm9jdXNFZGl0b3JHcm91cEF0SW5kZXhDb21tYW5kcygpO1xuXHRyZWdpc3RlclNwbGl0RWRpdG9yQ29tbWFuZHMoKTtcblx0cmVnaXN0ZXJGb2N1c0VkaXRvckdyb3VwV2lob3V0V3JhcENvbW1hbmRzKCk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFNQSxTQUFTLFVBQVUsU0FB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
