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
import { Action } from "../../../../base/common/actions.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { KeyChord, KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { Schemas } from "../../../../base/common/network.js";
import { isWindows } from "../../../../base/common/platform.js";
import { isObject, isString } from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { EndOfLinePreference } from "../../../../editor/common/model.js";
import { localize, localize2 } from "../../../../nls.js";
import { CONTEXT_ACCESSIBILITY_MODE_ENABLED } from "../../../../platform/accessibility/common/accessibility.js";
import { Action2, registerAction2, MenuId } from "../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { IListService } from "../../../../platform/list/browser/listService.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { TerminalExitReason, TerminalLocation, TerminalSettingId } from "../../../../platform/terminal/common/terminal.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { PICK_WORKSPACE_FOLDER_COMMAND_ID } from "../../../browser/actions/workspaceCommands.js";
import { CLOSE_EDITOR_COMMAND_ID } from "../../../browser/parts/editor/editorCommands.js";
import { Direction, ITerminalConfigurationService, ITerminalEditorService, ITerminalGroupService, ITerminalInstanceService, ITerminalService } from "./terminal.js";
import { ITerminalProfileResolverService, ITerminalProfileService, TERMINAL_VIEW_ID, TerminalCommandId } from "../common/terminal.js";
import { TerminalContextKeys } from "../common/terminalContextKey.js";
import { createProfileSchemaEnums } from "../../../../platform/terminal/common/terminalProfiles.js";
import { terminalStrings } from "../common/terminalStrings.js";
import { IConfigurationResolverService } from "../../../services/configurationResolver/common/configurationResolver.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { IHistoryService } from "../../../services/history/common/history.js";
import { IPreferencesService } from "../../../services/preferences/common/preferences.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
import { SIDE_GROUP } from "../../../services/editor/common/editorService.js";
import { isAbsolute } from "../../../../base/common/path.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { getIconId, getColorClass, getUriClasses } from "./terminalIcon.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { dirname } from "../../../../base/common/resources.js";
import { getIconClasses } from "../../../../editor/common/services/getIconClasses.js";
import { FileKind } from "../../../../platform/files/common/files.js";
import { TerminalCapability } from "../../../../platform/terminal/common/capabilities/capabilities.js";
import { killTerminalIcon, newTerminalIcon } from "./terminalIcons.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { accessibleViewCurrentProviderId, accessibleViewIsShown, accessibleViewOnLastLine } from "../../accessibility/browser/accessibilityConfiguration.js";
import { isKeyboardEvent, isMouseEvent, isPointerEvent } from "../../../../base/browser/dom.js";
import { editorGroupToColumn } from "../../../services/editor/common/editorGroupColumn.js";
import { InstanceContext } from "./terminalContextMenu.js";
import { AccessibleViewProviderId } from "../../../../platform/accessibility/browser/accessibleView.js";
import { TerminalTabList } from "./terminalTabsList.js";
import { ConfigurationResolverExpression } from "../../../services/configurationResolver/common/configurationResolverExpression.js";
const switchTerminalActionViewItemSeparator = "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500";
const switchTerminalShowTabsTitle = localize("showTerminalTabs", "Show Tabs");
const category = terminalStrings.actionCategory;
const sharedWhenClause = (() => {
  const terminalAvailable = ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated);
  return {
    terminalAvailable,
    terminalAvailable_and_opened: ContextKeyExpr.and(terminalAvailable, TerminalContextKeys.isOpen),
    terminalAvailable_and_editorActive: ContextKeyExpr.and(terminalAvailable, TerminalContextKeys.terminalEditorActive),
    terminalAvailable_and_singularSelection: ContextKeyExpr.and(terminalAvailable, TerminalContextKeys.tabsSingularSelection),
    focusInAny_and_normalBuffer: ContextKeyExpr.and(TerminalContextKeys.focusInAny, TerminalContextKeys.altBufferActive.negate())
  };
})();
async function getCwdForSplit(instance, folders, commandService, configService) {
  switch (configService.config.splitCwd) {
    case "workspaceRoot":
      if (folders !== void 0 && commandService !== void 0) {
        if (folders.length === 1) {
          return folders[0].uri;
        } else if (folders.length > 1) {
          const options = {
            placeHolder: localize("workbench.action.terminal.newWorkspacePlaceholder", "Select current working directory for new terminal")
          };
          const workspace = await commandService.executeCommand(PICK_WORKSPACE_FOLDER_COMMAND_ID, [options]);
          if (!workspace) {
            return void 0;
          }
          return Promise.resolve(workspace.uri);
        }
      }
      return "";
    case "initial":
      return instance.getInitialCwd();
    case "inherited":
      return instance.getCwd();
  }
}
const terminalSendSequenceCommand = async (accessor, args) => {
  const instance = accessor.get(ITerminalService).activeInstance;
  if (instance) {
    const text = isObject(args) && "text" in args ? toOptionalString(args.text) : void 0;
    if (!text) {
      return;
    }
    const configurationResolverService = accessor.get(IConfigurationResolverService);
    const workspaceContextService = accessor.get(IWorkspaceContextService);
    const historyService = accessor.get(IHistoryService);
    const activeWorkspaceRootUri = historyService.getLastActiveWorkspaceRoot(instance.isRemote ? Schemas.vscodeRemote : Schemas.file);
    const lastActiveWorkspaceRoot = activeWorkspaceRootUri ? workspaceContextService.getWorkspaceFolder(activeWorkspaceRootUri) ?? void 0 : void 0;
    const resolvedText = await configurationResolverService.resolveAsync(lastActiveWorkspaceRoot, text);
    instance.sendText(resolvedText, false);
  }
};
let TerminalLaunchHelpAction = class extends Action {
  constructor(_openerService) {
    super("workbench.action.terminal.launchHelp", localize("terminalLaunchHelp", "Open Help"));
    this._openerService = _openerService;
  }
  async run() {
    this._openerService.open("https://aka.ms/vscode-troubleshoot-terminal-launch");
  }
};
TerminalLaunchHelpAction = __decorateClass([
  __decorateParam(0, IOpenerService)
], TerminalLaunchHelpAction);
function registerTerminalAction(options) {
  options.f1 = options.f1 ?? true;
  options.category = options.category ?? category;
  options.precondition = options.precondition ?? TerminalContextKeys.processSupported;
  const runFunc = options.run;
  const strictOptions = options;
  delete strictOptions["run"];
  return registerAction2(class extends Action2 {
    constructor() {
      super(strictOptions);
    }
    run(accessor, args, args2) {
      return runFunc(getTerminalServices(accessor), accessor, args, args2);
    }
  });
}
function parseActionArgs(args) {
  if (Array.isArray(args)) {
    if (args.every((e) => e instanceof InstanceContext)) {
      return args;
    }
  } else if (args instanceof InstanceContext) {
    return [args];
  }
  return void 0;
}
function registerContextualInstanceAction(options) {
  const originalRun = options.run;
  return registerTerminalAction({
    ...options,
    run: async (c, accessor, focusedInstanceArgs, allInstanceArgs) => {
      let instances = getSelectedInstances2(accessor, allInstanceArgs);
      if (!instances) {
        const activeInstance = (options.activeInstanceType === "view" ? c.groupService : options.activeInstanceType === "editor" ? c.editorService : c.service).activeInstance;
        if (!activeInstance) {
          return;
        }
        instances = [activeInstance];
      }
      const results = [];
      for (const instance of instances) {
        results.push(originalRun(instance, c, accessor, focusedInstanceArgs));
      }
      await Promise.all(results);
      if (options.runAfter) {
        options.runAfter(instances, c, accessor, focusedInstanceArgs);
      }
    }
  });
}
function registerActiveInstanceAction(options) {
  const originalRun = options.run;
  return registerTerminalAction({
    ...options,
    run: (c, accessor, args) => {
      const activeInstance = c.service.activeInstance;
      if (activeInstance) {
        return originalRun(activeInstance, c, accessor, args);
      }
    }
  });
}
function registerActiveXtermAction(options) {
  const originalRun = options.run;
  return registerTerminalAction({
    ...options,
    run: (c, accessor, args) => {
      const activeDetached = Iterable.find(c.service.detachedInstances, (d) => d.xterm.isFocused);
      if (activeDetached) {
        return originalRun(activeDetached.xterm, accessor, activeDetached, args);
      }
      const activeInstance = c.service.activeInstance;
      if (activeInstance?.xterm) {
        return originalRun(activeInstance.xterm, accessor, activeInstance, args);
      }
    }
  });
}
function getTerminalServices(accessor) {
  return {
    service: accessor.get(ITerminalService),
    configService: accessor.get(ITerminalConfigurationService),
    groupService: accessor.get(ITerminalGroupService),
    instanceService: accessor.get(ITerminalInstanceService),
    editorService: accessor.get(ITerminalEditorService),
    profileService: accessor.get(ITerminalProfileService),
    profileResolverService: accessor.get(ITerminalProfileResolverService)
  };
}
function registerTerminalActions() {
  registerTerminalAction({
    id: TerminalCommandId.NewInActiveWorkspace,
    title: localize2("workbench.action.terminal.newInActiveWorkspace", "Create New Terminal (In Active Workspace)"),
    run: async (c) => {
      if (c.service.isProcessSupportRegistered) {
        const instance = await c.service.createTerminal({ location: c.service.defaultLocation });
        if (!instance) {
          return;
        }
        c.service.setActiveInstance(instance);
        await focusActiveTerminal(instance, c);
      }
    }
  });
  refreshTerminalActions([]);
  registerTerminalAction({
    id: TerminalCommandId.CreateTerminalEditor,
    title: localize2("workbench.action.terminal.createTerminalEditor", "Create New Terminal in Editor Area"),
    run: async (c, _, args) => {
      const options = isObject(args) && "location" in args ? args : { location: TerminalLocation.Editor };
      const instance = await c.service.createTerminal(options);
      await instance.focusWhenReady();
    }
  });
  registerTerminalAction({
    id: TerminalCommandId.CreateTerminalEditorSameGroup,
    title: localize2("workbench.action.terminal.createTerminalEditor", "Create New Terminal in Editor Area"),
    f1: false,
    run: async (c, accessor, args) => {
      const editorGroupsService = accessor.get(IEditorGroupsService);
      const instance = await c.service.createTerminal({
        location: { viewColumn: editorGroupToColumn(editorGroupsService, editorGroupsService.activeGroup) }
      });
      await instance.focusWhenReady();
    }
  });
  registerTerminalAction({
    id: TerminalCommandId.CreateTerminalEditorSide,
    title: localize2("workbench.action.terminal.createTerminalEditorSide", "Create New Terminal in Editor Area to the Side"),
    run: async (c) => {
      const instance = await c.service.createTerminal({
        location: { viewColumn: SIDE_GROUP }
      });
      await instance.focusWhenReady();
    }
  });
  registerContextualInstanceAction({
    id: TerminalCommandId.MoveToEditor,
    title: terminalStrings.moveToEditor,
    precondition: sharedWhenClause.terminalAvailable_and_opened,
    activeInstanceType: "view",
    run: (instance, c) => c.service.moveToEditor(instance),
    runAfter: (instances) => instances.at(-1)?.focus()
  });
  registerContextualInstanceAction({
    id: TerminalCommandId.MoveIntoNewWindow,
    title: terminalStrings.moveIntoNewWindow,
    precondition: sharedWhenClause.terminalAvailable_and_opened,
    run: (instance, c) => c.service.moveIntoNewEditor(instance),
    runAfter: (instances) => instances.at(-1)?.focus()
  });
  registerTerminalAction({
    id: TerminalCommandId.MoveToTerminalPanel,
    title: terminalStrings.moveToTerminalPanel,
    precondition: sharedWhenClause.terminalAvailable_and_editorActive,
    run: (c, _, args) => {
      const source = toOptionalUri(args) ?? c.editorService.activeInstance;
      if (source) {
        c.service.moveToTerminalView(source);
      }
    }
  });
  registerTerminalAction({
    id: TerminalCommandId.FocusPreviousPane,
    title: localize2("workbench.action.terminal.focusPreviousPane", "Focus Previous Terminal in Terminal Group"),
    keybinding: {
      primary: KeyMod.Alt | KeyCode.LeftArrow,
      secondary: [KeyMod.Alt | KeyCode.UpArrow],
      mac: {
        primary: KeyMod.Alt | KeyMod.CtrlCmd | KeyCode.LeftArrow,
        secondary: [KeyMod.Alt | KeyMod.CtrlCmd | KeyCode.UpArrow]
      },
      when: TerminalContextKeys.focus,
      weight: KeybindingWeight.WorkbenchContrib
    },
    precondition: sharedWhenClause.terminalAvailable,
    run: async (c) => {
      c.groupService.activeGroup?.focusPreviousPane();
      await c.groupService.showPanel(true);
    }
  });
  registerTerminalAction({
    id: TerminalCommandId.FocusNextPane,
    title: localize2("workbench.action.terminal.focusNextPane", "Focus Next Terminal in Terminal Group"),
    keybinding: {
      primary: KeyMod.Alt | KeyCode.RightArrow,
      secondary: [KeyMod.Alt | KeyCode.DownArrow],
      mac: {
        primary: KeyMod.Alt | KeyMod.CtrlCmd | KeyCode.RightArrow,
        secondary: [KeyMod.Alt | KeyMod.CtrlCmd | KeyCode.DownArrow]
      },
      when: TerminalContextKeys.focus,
      weight: KeybindingWeight.WorkbenchContrib
    },
    precondition: sharedWhenClause.terminalAvailable,
    run: async (c) => {
      c.groupService.activeGroup?.focusNextPane();
      await c.groupService.showPanel(true);
    }
  });
  registerTerminalAction({
    id: TerminalCommandId.ResizePaneLeft,
    title: localize2("workbench.action.terminal.resizePaneLeft", "Resize Terminal Left"),
    keybinding: {
      linux: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.LeftArrow },
      mac: { primary: KeyMod.CtrlCmd | KeyMod.WinCtrl | KeyCode.LeftArrow },
      when: TerminalContextKeys.focus,
      weight: KeybindingWeight.WorkbenchContrib
    },
    precondition: sharedWhenClause.terminalAvailable,
    run: (c) => c.groupService.activeGroup?.resizePane(Direction.Left)
  });
  registerTerminalAction({
    id: TerminalCommandId.ResizePaneRight,
    title: localize2("workbench.action.terminal.resizePaneRight", "Resize Terminal Right"),
    keybinding: {
      linux: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.RightArrow },
      mac: { primary: KeyMod.CtrlCmd | KeyMod.WinCtrl | KeyCode.RightArrow },
      when: TerminalContextKeys.focus,
      weight: KeybindingWeight.WorkbenchContrib
    },
    precondition: sharedWhenClause.terminalAvailable,
    run: (c) => c.groupService.activeGroup?.resizePane(Direction.Right)
  });
  registerTerminalAction({
    id: TerminalCommandId.ResizePaneUp,
    title: localize2("workbench.action.terminal.resizePaneUp", "Resize Terminal Up"),
    keybinding: {
      mac: { primary: KeyMod.CtrlCmd | KeyMod.WinCtrl | KeyCode.UpArrow },
      when: TerminalContextKeys.focus,
      weight: KeybindingWeight.WorkbenchContrib
    },
    precondition: sharedWhenClause.terminalAvailable,
    run: (c) => c.groupService.activeGroup?.resizePane(Direction.Up)
  });
  registerTerminalAction({
    id: TerminalCommandId.ResizePaneDown,
    title: localize2("workbench.action.terminal.resizePaneDown", "Resize Terminal Down"),
    keybinding: {
      mac: { primary: KeyMod.CtrlCmd | KeyMod.WinCtrl | KeyCode.DownArrow },
      when: TerminalContextKeys.focus,
      weight: KeybindingWeight.WorkbenchContrib
    },
    precondition: sharedWhenClause.terminalAvailable,
    run: (c) => c.groupService.activeGroup?.resizePane(Direction.Down)
  });
  registerTerminalAction({
    id: TerminalCommandId.Focus,
    title: terminalStrings.focus,
    keybinding: {
      when: ContextKeyExpr.and(CONTEXT_ACCESSIBILITY_MODE_ENABLED, accessibleViewOnLastLine, accessibleViewCurrentProviderId.isEqualTo(AccessibleViewProviderId.Terminal)),
      primary: KeyMod.CtrlCmd | KeyCode.DownArrow,
      weight: KeybindingWeight.WorkbenchContrib
    },
    precondition: sharedWhenClause.terminalAvailable,
    run: async (c) => {
      const instance = c.service.activeInstance || await c.service.createTerminal({ location: TerminalLocation.Panel });
      if (!instance) {
        return;
      }
      c.service.setActiveInstance(instance);
      focusActiveTerminal(instance, c);
    }
  });
  registerTerminalAction({
    id: TerminalCommandId.FocusTabs,
    title: localize2("workbench.action.terminal.focus.tabsView", "Focus Terminal Tabs View"),
    keybinding: {
      primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Backslash,
      weight: KeybindingWeight.WorkbenchContrib,
      when: ContextKeyExpr.or(TerminalContextKeys.tabsFocus, TerminalContextKeys.focus)
    },
    precondition: sharedWhenClause.terminalAvailable,
    run: (c) => c.groupService.focusTabs()
  });
  registerTerminalAction({
    id: TerminalCommandId.FocusNext,
    title: localize2("workbench.action.terminal.focusNext", "Focus Next Terminal Group"),
    precondition: sharedWhenClause.terminalAvailable,
    keybinding: {
      primary: KeyMod.CtrlCmd | KeyCode.PageDown,
      mac: {
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.BracketRight
      },
      when: ContextKeyExpr.and(TerminalContextKeys.focus, TerminalContextKeys.editorFocus.negate()),
      weight: KeybindingWeight.WorkbenchContrib
    },
    run: async (c) => {
      c.groupService.setActiveGroupToNext();
      await c.groupService.showPanel(true);
    }
  });
  registerTerminalAction({
    id: TerminalCommandId.FocusPrevious,
    title: localize2("workbench.action.terminal.focusPrevious", "Focus Previous Terminal Group"),
    precondition: sharedWhenClause.terminalAvailable,
    keybinding: {
      primary: KeyMod.CtrlCmd | KeyCode.PageUp,
      mac: {
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.BracketLeft
      },
      when: ContextKeyExpr.and(TerminalContextKeys.focus, TerminalContextKeys.editorFocus.negate()),
      weight: KeybindingWeight.WorkbenchContrib
    },
    run: async (c) => {
      c.groupService.setActiveGroupToPrevious();
      await c.groupService.showPanel(true);
    }
  });
  registerTerminalAction({
    id: TerminalCommandId.RunSelectedText,
    title: localize2("workbench.action.terminal.runSelectedText", "Run Selected Text In Active Terminal"),
    run: async (c, accessor) => {
      const codeEditorService = accessor.get(ICodeEditorService);
      const editor = codeEditorService.getActiveCodeEditor();
      if (!editor || !editor.hasModel()) {
        return;
      }
      const instance = await c.service.getActiveOrCreateInstance({ acceptsInput: true });
      const selection = editor.getSelection();
      let text;
      if (selection.isEmpty()) {
        text = editor.getModel().getLineContent(selection.selectionStartLineNumber).trim();
      } else {
        const endOfLinePreference = isWindows ? EndOfLinePreference.LF : EndOfLinePreference.CRLF;
        text = editor.getModel().getValueInRange(selection, endOfLinePreference);
      }
      instance.sendText(text, true, true);
      await c.service.revealActiveTerminal(true);
    }
  });
  registerTerminalAction({
    id: TerminalCommandId.RunActiveFile,
    title: localize2("workbench.action.terminal.runActiveFile", "Run Active File In Active Terminal"),
    precondition: sharedWhenClause.terminalAvailable,
    run: async (c, accessor) => {
      const codeEditorService = accessor.get(ICodeEditorService);
      const notificationService = accessor.get(INotificationService);
      const workbenchEnvironmentService = accessor.get(IWorkbenchEnvironmentService);
      const editor = codeEditorService.getActiveCodeEditor();
      if (!editor || !editor.hasModel()) {
        return;
      }
      const instance = await c.service.getActiveOrCreateInstance({ acceptsInput: true });
      const isRemote = instance ? instance.isRemote : workbenchEnvironmentService.remoteAuthority ? true : false;
      const uri = editor.getModel().uri;
      if (!isRemote && uri.scheme !== Schemas.file && uri.scheme !== Schemas.vscodeUserData || isRemote && uri.scheme !== Schemas.vscodeRemote) {
        notificationService.warn(localize("workbench.action.terminal.runActiveFile.noFile", "Only files on disk can be run in the terminal"));
        return;
      }
      await instance.sendPath(uri, true);
      return c.groupService.showPanel();
    }
  });
  registerActiveXtermAction({
    id: TerminalCommandId.ScrollDownLine,
    title: localize2("workbench.action.terminal.scrollDown", "Scroll Down (Line)"),
    keybinding: {
      primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.PageDown,
      linux: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.DownArrow },
      when: sharedWhenClause.focusInAny_and_normalBuffer,
      weight: KeybindingWeight.WorkbenchContrib
    },
    precondition: sharedWhenClause.terminalAvailable,
    run: (xterm) => xterm.scrollDownLine()
  });
  registerActiveXtermAction({
    id: TerminalCommandId.ScrollDownPage,
    title: localize2("workbench.action.terminal.scrollDownPage", "Scroll Down (Page)"),
    keybinding: {
      primary: KeyMod.Shift | KeyCode.PageDown,
      mac: { primary: KeyCode.PageDown },
      when: sharedWhenClause.focusInAny_and_normalBuffer,
      weight: KeybindingWeight.WorkbenchContrib
    },
    precondition: sharedWhenClause.terminalAvailable,
    run: (xterm) => xterm.scrollDownPage()
  });
  registerActiveXtermAction({
    id: TerminalCommandId.ScrollToBottom,
    title: localize2("workbench.action.terminal.scrollToBottom", "Scroll to Bottom"),
    keybinding: {
      primary: KeyMod.CtrlCmd | KeyCode.End,
      linux: { primary: KeyMod.Shift | KeyCode.End },
      when: sharedWhenClause.focusInAny_and_normalBuffer,
      weight: KeybindingWeight.WorkbenchContrib
    },
    precondition: sharedWhenClause.terminalAvailable,
    run: (xterm) => xterm.scrollToBottom()
  });
  registerActiveXtermAction({
    id: TerminalCommandId.ScrollUpLine,
    title: localize2("workbench.action.terminal.scrollUp", "Scroll Up (Line)"),
    keybinding: {
      primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.PageUp,
      linux: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.UpArrow },
      when: sharedWhenClause.focusInAny_and_normalBuffer,
      weight: KeybindingWeight.WorkbenchContrib
    },
    precondition: sharedWhenClause.terminalAvailable,
    run: (xterm) => xterm.scrollUpLine()
  });
  registerActiveXtermAction({
    id: TerminalCommandId.ScrollUpPage,
    title: localize2("workbench.action.terminal.scrollUpPage", "Scroll Up (Page)"),
    f1: true,
    keybinding: {
      primary: KeyMod.Shift | KeyCode.PageUp,
      mac: { primary: KeyCode.PageUp },
      when: sharedWhenClause.focusInAny_and_normalBuffer,
      weight: KeybindingWeight.WorkbenchContrib
    },
    precondition: sharedWhenClause.terminalAvailable,
    run: (xterm) => xterm.scrollUpPage()
  });
  registerActiveXtermAction({
    id: TerminalCommandId.ScrollToTop,
    title: localize2("workbench.action.terminal.scrollToTop", "Scroll to Top"),
    keybinding: {
      primary: KeyMod.CtrlCmd | KeyCode.Home,
      linux: { primary: KeyMod.Shift | KeyCode.Home },
      when: sharedWhenClause.focusInAny_and_normalBuffer,
      weight: KeybindingWeight.WorkbenchContrib
    },
    precondition: sharedWhenClause.terminalAvailable,
    run: (xterm) => xterm.scrollToTop()
  });
  registerActiveXtermAction({
    id: TerminalCommandId.ClearSelection,
    title: localize2("workbench.action.terminal.clearSelection", "Clear Selection"),
    keybinding: {
      primary: KeyCode.Escape,
      when: ContextKeyExpr.and(TerminalContextKeys.focusInAny, TerminalContextKeys.textSelected, TerminalContextKeys.notFindVisible),
      weight: KeybindingWeight.WorkbenchContrib
    },
    precondition: sharedWhenClause.terminalAvailable,
    run: (xterm) => {
      if (xterm.hasSelection()) {
        xterm.clearSelection();
      }
    }
  });
  registerTerminalAction({
    id: TerminalCommandId.ChangeIcon,
    title: terminalStrings.changeIcon,
    precondition: sharedWhenClause.terminalAvailable,
    run: (c, _, args) => getResourceOrActiveInstance(c, args)?.changeIcon()
  });
  registerTerminalAction({
    id: TerminalCommandId.ChangeIconActiveTab,
    title: terminalStrings.changeIcon,
    f1: false,
    precondition: sharedWhenClause.terminalAvailable_and_singularSelection,
    run: async (c, accessor, args) => {
      let icon;
      if (c.groupService.lastAccessedMenu === "inline-tab") {
        getResourceOrActiveInstance(c, args)?.changeIcon();
        return;
      }
      for (const terminal of getSelectedInstances(accessor) ?? []) {
        icon = await terminal.changeIcon(icon);
      }
    }
  });
  registerTerminalAction({
    id: TerminalCommandId.ChangeColor,
    title: terminalStrings.changeColor,
    precondition: sharedWhenClause.terminalAvailable,
    run: (c, _, args) => getResourceOrActiveInstance(c, args)?.changeColor()
  });
  registerTerminalAction({
    id: TerminalCommandId.ChangeColorActiveTab,
    title: terminalStrings.changeColor,
    f1: false,
    precondition: sharedWhenClause.terminalAvailable_and_singularSelection,
    run: async (c, accessor, args) => {
      let color;
      let i = 0;
      if (c.groupService.lastAccessedMenu === "inline-tab") {
        getResourceOrActiveInstance(c, args)?.changeColor();
        return;
      }
      for (const terminal of getSelectedInstances(accessor) ?? []) {
        const skipQuickPick = i !== 0;
        color = await terminal.changeColor(color, skipQuickPick);
        i++;
      }
    }
  });
  registerTerminalAction({
    id: TerminalCommandId.Rename,
    title: terminalStrings.rename,
    precondition: sharedWhenClause.terminalAvailable,
    run: (c, accessor, args) => renameWithQuickPick(c, accessor, args)
  });
  registerTerminalAction({
    id: TerminalCommandId.RenameActiveTab,
    title: terminalStrings.rename,
    f1: false,
    keybinding: {
      primary: KeyCode.F2,
      mac: {
        primary: KeyCode.Enter
      },
      when: ContextKeyExpr.and(TerminalContextKeys.tabsFocus),
      weight: KeybindingWeight.WorkbenchContrib
    },
    precondition: sharedWhenClause.terminalAvailable_and_singularSelection,
    run: async (c, accessor) => {
      const terminalGroupService = accessor.get(ITerminalGroupService);
      const notificationService = accessor.get(INotificationService);
      const instances = getSelectedInstances(accessor);
      const firstInstance = instances?.[0];
      if (!firstInstance) {
        return;
      }
      if (terminalGroupService.lastAccessedMenu === "inline-tab") {
        return renameWithQuickPick(c, accessor, firstInstance);
      }
      c.service.setEditingTerminal(firstInstance);
      c.service.setEditable(firstInstance, {
        validationMessage: (value) => validateTerminalName(value),
        onFinish: async (value, success) => {
          c.service.setEditable(firstInstance, null);
          c.service.setEditingTerminal(void 0);
          if (success) {
            const promises = [];
            for (const instance of instances) {
              promises.push((async () => {
                await instance.rename(value);
              })());
            }
            try {
              await Promise.all(promises);
            } catch (e) {
              notificationService.error(e);
            }
          }
        }
      });
    }
  });
  registerActiveInstanceAction({
    id: TerminalCommandId.DetachSession,
    title: localize2("workbench.action.terminal.detachSession", "Detach Session"),
    run: (activeInstance) => activeInstance.detachProcessAndDispose(TerminalExitReason.User)
  });
  registerTerminalAction({
    id: TerminalCommandId.AttachToSession,
    title: localize2("workbench.action.terminal.attachToSession", "Attach to Session"),
    run: async (c, accessor) => {
      const quickInputService = accessor.get(IQuickInputService);
      const labelService = accessor.get(ILabelService);
      const remoteAgentService = accessor.get(IRemoteAgentService);
      const notificationService = accessor.get(INotificationService);
      const remoteAuthority = remoteAgentService.getConnection()?.remoteAuthority ?? void 0;
      const backend = await accessor.get(ITerminalInstanceService).getBackend(remoteAuthority);
      if (!backend) {
        throw new Error(`No backend registered for remote authority '${remoteAuthority}'`);
      }
      const terms = await backend.listProcesses();
      backend.reduceConnectionGraceTime();
      const unattachedTerms = terms.filter((term) => !c.service.isAttachedToTerminal(term));
      const items = unattachedTerms.map((term) => {
        const cwdLabel = labelService.getUriLabel(URI.file(term.cwd));
        return {
          label: term.title,
          detail: term.workspaceName ? `${term.workspaceName} \u2E31 ${cwdLabel}` : cwdLabel,
          description: term.pid ? String(term.pid) : "",
          term
        };
      });
      if (items.length === 0) {
        notificationService.info(localize("noUnattachedTerminals", "There are no unattached terminals to attach to"));
        return;
      }
      const selected = await quickInputService.pick(items, { canPickMany: false });
      if (selected) {
        const instance = await c.service.createTerminal({
          config: { attachPersistentProcess: selected.term }
        });
        c.service.setActiveInstance(instance);
        await focusActiveTerminal(instance, c);
      }
    }
  });
  registerActiveInstanceAction({
    id: TerminalCommandId.ScrollToPreviousCommand,
    title: terminalStrings.scrollToPreviousCommand,
    keybinding: {
      primary: KeyMod.CtrlCmd | KeyCode.UpArrow,
      when: ContextKeyExpr.and(TerminalContextKeys.focus, CONTEXT_ACCESSIBILITY_MODE_ENABLED.negate()),
      weight: KeybindingWeight.WorkbenchContrib
    },
    precondition: sharedWhenClause.terminalAvailable,
    icon: Codicon.arrowUp,
    menu: [
      {
        id: MenuId.ViewTitle,
        group: "navigation",
        order: 4,
        when: ContextKeyExpr.equals("view", TERMINAL_VIEW_ID),
        isHiddenByDefault: true
      }
    ],
    run: (activeInstance) => activeInstance.xterm?.markTracker.scrollToPreviousMark(void 0, void 0, activeInstance.capabilities.has(TerminalCapability.CommandDetection))
  });
  registerActiveInstanceAction({
    id: TerminalCommandId.ScrollToNextCommand,
    title: terminalStrings.scrollToNextCommand,
    keybinding: {
      primary: KeyMod.CtrlCmd | KeyCode.DownArrow,
      when: ContextKeyExpr.and(TerminalContextKeys.focus, CONTEXT_ACCESSIBILITY_MODE_ENABLED.negate()),
      weight: KeybindingWeight.WorkbenchContrib
    },
    precondition: sharedWhenClause.terminalAvailable,
    icon: Codicon.arrowDown,
    menu: [
      {
        id: MenuId.ViewTitle,
        group: "navigation",
        order: 4,
        when: ContextKeyExpr.equals("view", TERMINAL_VIEW_ID),
        isHiddenByDefault: true
      }
    ],
    run: (activeInstance) => {
      activeInstance.xterm?.markTracker.scrollToNextMark();
      activeInstance.focus();
    }
  });
  registerActiveInstanceAction({
    id: TerminalCommandId.SelectToPreviousCommand,
    title: localize2("workbench.action.terminal.selectToPreviousCommand", "Select to Previous Command"),
    keybinding: {
      primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.UpArrow,
      when: TerminalContextKeys.focus,
      weight: KeybindingWeight.WorkbenchContrib
    },
    precondition: sharedWhenClause.terminalAvailable,
    run: (activeInstance) => {
      activeInstance.xterm?.markTracker.selectToPreviousMark();
      activeInstance.focus();
    }
  });
  registerActiveInstanceAction({
    id: TerminalCommandId.SelectToNextCommand,
    title: localize2("workbench.action.terminal.selectToNextCommand", "Select to Next Command"),
    keybinding: {
      primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.DownArrow,
      when: TerminalContextKeys.focus,
      weight: KeybindingWeight.WorkbenchContrib
    },
    precondition: sharedWhenClause.terminalAvailable,
    run: (activeInstance) => {
      activeInstance.xterm?.markTracker.selectToNextMark();
      activeInstance.focus();
    }
  });
  registerActiveXtermAction({
    id: TerminalCommandId.SelectToPreviousLine,
    title: localize2("workbench.action.terminal.selectToPreviousLine", "Select to Previous Line"),
    precondition: sharedWhenClause.terminalAvailable,
    run: async (xterm, _, instance) => {
      xterm.markTracker.selectToPreviousLine();
      (instance || xterm).focus();
    }
  });
  registerActiveXtermAction({
    id: TerminalCommandId.SelectToNextLine,
    title: localize2("workbench.action.terminal.selectToNextLine", "Select to Next Line"),
    precondition: sharedWhenClause.terminalAvailable,
    run: async (xterm, _, instance) => {
      xterm.markTracker.selectToNextLine();
      (instance || xterm).focus();
    }
  });
  registerTerminalAction({
    id: TerminalCommandId.SendSequence,
    title: terminalStrings.sendSequence,
    f1: false,
    metadata: {
      description: terminalStrings.sendSequence.value,
      args: [{
        name: "args",
        schema: {
          type: "object",
          required: ["text"],
          properties: {
            text: {
              description: localize("sendSequence", "The sequence of text to send to the terminal"),
              type: "string"
            }
          }
        }
      }]
    },
    run: (c, accessor, args) => terminalSendSequenceCommand(accessor, args)
  });
  registerTerminalAction({
    id: TerminalCommandId.NewWithCwd,
    title: terminalStrings.newWithCwd,
    metadata: {
      description: terminalStrings.newWithCwd.value,
      args: [{
        name: "args",
        schema: {
          type: "object",
          required: ["cwd"],
          properties: {
            cwd: {
              description: localize("workbench.action.terminal.newWithCwd.cwd", "The directory to start the terminal at"),
              type: "string"
            }
          }
        }
      }]
    },
    run: async (c, _, args) => {
      const cwd = isObject(args) && "cwd" in args ? toOptionalString(args.cwd) : void 0;
      const instance = await c.service.createTerminal({ cwd });
      if (!instance) {
        return;
      }
      c.service.setActiveInstance(instance);
      await focusActiveTerminal(instance, c);
    }
  });
  registerActiveInstanceAction({
    id: TerminalCommandId.RenameWithArgs,
    title: terminalStrings.renameWithArgs,
    metadata: {
      description: terminalStrings.renameWithArgs.value,
      args: [{
        name: "args",
        schema: {
          type: "object",
          required: ["name"],
          properties: {
            name: {
              description: localize("workbench.action.terminal.renameWithArg.name", "The new name for the terminal"),
              type: "string",
              minLength: 1
            }
          }
        }
      }]
    },
    precondition: sharedWhenClause.terminalAvailable,
    run: async (activeInstance, c, accessor, args) => {
      const notificationService = accessor.get(INotificationService);
      const name = isObject(args) && "name" in args ? toOptionalString(args.name) : void 0;
      if (!name) {
        notificationService.warn(localize("workbench.action.terminal.renameWithArg.noName", "No name argument provided"));
        return;
      }
      activeInstance.rename(name);
    }
  });
  registerActiveInstanceAction({
    id: TerminalCommandId.Relaunch,
    title: localize2("workbench.action.terminal.relaunch", "Relaunch Active Terminal"),
    run: (activeInstance) => activeInstance.relaunch()
  });
  registerTerminalAction({
    id: TerminalCommandId.Split,
    title: terminalStrings.split,
    precondition: ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.webExtensionContributedProfile),
    keybinding: {
      primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Digit5,
      weight: KeybindingWeight.WorkbenchContrib,
      mac: {
        primary: KeyMod.CtrlCmd | KeyCode.Backslash,
        secondary: [KeyMod.WinCtrl | KeyMod.Shift | KeyCode.Digit5]
      },
      when: TerminalContextKeys.focus
    },
    icon: Codicon.splitHorizontal,
    run: async (c, accessor, args) => {
      const optionsOrProfile = isObject(args) ? args : void 0;
      const commandService = accessor.get(ICommandService);
      const workspaceContextService = accessor.get(IWorkspaceContextService);
      const options = convertOptionsOrProfileToOptions(optionsOrProfile);
      const activeInstance = (await c.service.getInstanceHost(options?.location)).activeInstance;
      if (!activeInstance) {
        return;
      }
      const cwd = await getCwdForSplit(activeInstance, workspaceContextService.getWorkspace().folders, commandService, c.configService);
      if (cwd === void 0) {
        return;
      }
      const instance = await c.service.createTerminal({ location: { parentTerminal: activeInstance }, config: options?.config, cwd });
      await focusActiveTerminal(instance, c);
    }
  });
  registerTerminalAction({
    id: TerminalCommandId.SplitActiveTab,
    title: terminalStrings.split,
    f1: false,
    keybinding: {
      primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Digit5,
      mac: {
        primary: KeyMod.CtrlCmd | KeyCode.Backslash,
        secondary: [KeyMod.WinCtrl | KeyMod.Shift | KeyCode.Digit5]
      },
      weight: KeybindingWeight.WorkbenchContrib,
      when: TerminalContextKeys.tabsFocus
    },
    run: async (c, accessor) => {
      const instances = getSelectedInstances(accessor);
      if (instances) {
        const promises = [];
        for (const t of instances) {
          promises.push((async () => {
            await c.service.createTerminal({ location: { parentTerminal: t } });
            await c.groupService.showPanel(true);
          })());
        }
        await Promise.all(promises);
      }
    }
  });
  registerContextualInstanceAction({
    id: TerminalCommandId.Unsplit,
    title: terminalStrings.unsplit,
    precondition: sharedWhenClause.terminalAvailable,
    run: async (instance, c) => {
      const group = c.groupService.getGroupForInstance(instance);
      if (group && group?.terminalInstances.length > 1) {
        c.groupService.unsplitInstance(instance);
      }
    }
  });
  registerTerminalAction({
    id: TerminalCommandId.JoinActiveTab,
    title: localize2("workbench.action.terminal.joinInstance", "Join Terminals"),
    precondition: ContextKeyExpr.and(sharedWhenClause.terminalAvailable, TerminalContextKeys.tabsSingularSelection.toNegated()),
    run: async (c, accessor) => {
      const instances = getSelectedInstances(accessor);
      if (instances && instances.length > 1) {
        c.groupService.joinInstances(instances);
      }
    }
  });
  registerTerminalAction({
    id: TerminalCommandId.Join,
    title: localize2("workbench.action.terminal.join", "Join Terminals..."),
    precondition: sharedWhenClause.terminalAvailable,
    run: async (c, accessor) => {
      const themeService = accessor.get(IThemeService);
      const notificationService = accessor.get(INotificationService);
      const quickInputService = accessor.get(IQuickInputService);
      const picks = [];
      if (c.groupService.instances.length <= 1) {
        notificationService.warn(localize("workbench.action.terminal.join.insufficientTerminals", "Insufficient terminals for the join action"));
        return;
      }
      const otherInstances = c.groupService.instances.filter((i) => i.instanceId !== c.groupService.activeInstance?.instanceId);
      for (const terminal of otherInstances) {
        const group = c.groupService.getGroupForInstance(terminal);
        if (group?.terminalInstances.length === 1) {
          const iconId = getIconId(accessor, terminal);
          const label = `$(${iconId}): ${terminal.title}`;
          const iconClasses = [];
          const colorClass = getColorClass(terminal);
          if (colorClass) {
            iconClasses.push(colorClass);
          }
          const uriClasses = getUriClasses(terminal, themeService.getColorTheme().type);
          if (uriClasses) {
            iconClasses.push(...uriClasses);
          }
          picks.push({
            terminal,
            label,
            iconClasses
          });
        }
      }
      if (picks.length === 0) {
        notificationService.warn(localize("workbench.action.terminal.join.onlySplits", "All terminals are joined already"));
        return;
      }
      const result = await quickInputService.pick(picks, {});
      if (result) {
        c.groupService.joinInstances([result.terminal, c.groupService.activeInstance]);
      }
    }
  });
  registerActiveInstanceAction({
    id: TerminalCommandId.SplitInActiveWorkspace,
    title: localize2("workbench.action.terminal.splitInActiveWorkspace", "Split Terminal (In Active Workspace)"),
    run: async (instance, c) => {
      const newInstance = await c.service.createTerminal({ location: { parentTerminal: instance } });
      if (newInstance?.target !== TerminalLocation.Editor) {
        await c.groupService.showPanel(true);
      }
    }
  });
  registerActiveXtermAction({
    id: TerminalCommandId.SelectAll,
    title: localize2("workbench.action.terminal.selectAll", "Select All"),
    precondition: sharedWhenClause.terminalAvailable,
    keybinding: [{
      // Don't use ctrl+a by default as that would override the common go to start
      // of prompt shell binding
      primary: 0,
      // Technically this doesn't need to be here as it will fall back to this
      // behavior anyway when handed to xterm.js, having this handled by VS Code
      // makes it easier for users to see how it works though.
      mac: { primary: KeyMod.CtrlCmd | KeyCode.KeyA },
      weight: KeybindingWeight.WorkbenchContrib,
      when: TerminalContextKeys.focusInAny
    }],
    run: (xterm) => xterm.selectAll()
  });
  registerTerminalAction({
    id: TerminalCommandId.New,
    title: localize2("workbench.action.terminal.new", "Create New Terminal"),
    precondition: ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.webExtensionContributedProfile),
    icon: newTerminalIcon,
    keybinding: {
      primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Backquote,
      mac: { primary: KeyMod.WinCtrl | KeyMod.Shift | KeyCode.Backquote },
      weight: KeybindingWeight.WorkbenchContrib
    },
    run: async (c, accessor, args) => {
      let eventOrOptions = isObject(args) ? args : void 0;
      const workspaceContextService = accessor.get(IWorkspaceContextService);
      const commandService = accessor.get(ICommandService);
      const folders = workspaceContextService.getWorkspace().folders;
      if (eventOrOptions && isMouseEvent(eventOrOptions) && (eventOrOptions.altKey || eventOrOptions.ctrlKey)) {
        await c.service.createTerminal({ location: { splitActiveTerminal: true } });
        return;
      }
      if (c.service.isProcessSupportRegistered) {
        eventOrOptions = !eventOrOptions || isMouseEvent(eventOrOptions) ? {} : eventOrOptions;
        let instance;
        if (folders.length <= 1) {
          instance = await c.service.createTerminal(eventOrOptions);
        } else {
          const cwd = (await pickTerminalCwd(accessor))?.cwd;
          if (!cwd) {
            return;
          }
          eventOrOptions.cwd = cwd;
          instance = await c.service.createTerminal(eventOrOptions);
        }
        c.service.setActiveInstance(instance);
        await focusActiveTerminal(instance, c);
      } else {
        if (c.profileService.contributedProfiles.length > 0) {
          commandService.executeCommand(TerminalCommandId.NewWithProfile);
        } else {
          commandService.executeCommand(TerminalCommandId.Toggle);
        }
      }
    }
  });
  async function killInstance(c, instance) {
    if (!instance) {
      return;
    }
    await c.service.safeDisposeTerminal(instance);
    if (c.groupService.instances.length > 0) {
      await c.groupService.showPanel(true);
    }
  }
  registerTerminalAction({
    id: TerminalCommandId.Kill,
    title: localize2("workbench.action.terminal.kill", "Kill the Active Terminal Instance"),
    precondition: ContextKeyExpr.or(sharedWhenClause.terminalAvailable, TerminalContextKeys.isOpen),
    icon: killTerminalIcon,
    run: async (c) => killInstance(c, c.groupService.activeInstance)
  });
  registerTerminalAction({
    id: TerminalCommandId.KillViewOrEditor,
    title: terminalStrings.kill,
    f1: false,
    // This is an internal command used for context menus
    precondition: ContextKeyExpr.or(sharedWhenClause.terminalAvailable, TerminalContextKeys.isOpen),
    run: async (c) => killInstance(c, c.service.activeInstance)
  });
  registerTerminalAction({
    id: TerminalCommandId.KillAll,
    title: localize2("workbench.action.terminal.killAll", "Kill All Terminals"),
    precondition: ContextKeyExpr.or(sharedWhenClause.terminalAvailable, TerminalContextKeys.isOpen),
    icon: Codicon.trash,
    run: async (c) => {
      const disposePromises = [];
      for (const instance of c.service.instances) {
        disposePromises.push(c.service.safeDisposeTerminal(instance));
      }
      await Promise.all(disposePromises);
    }
  });
  registerTerminalAction({
    id: TerminalCommandId.KillEditor,
    title: localize2("workbench.action.terminal.killEditor", "Kill the Active Terminal in Editor Area"),
    precondition: sharedWhenClause.terminalAvailable,
    keybinding: {
      primary: KeyMod.CtrlCmd | KeyCode.KeyW,
      win: { primary: KeyMod.CtrlCmd | KeyCode.F4, secondary: [KeyMod.CtrlCmd | KeyCode.KeyW] },
      weight: KeybindingWeight.WorkbenchContrib,
      when: ContextKeyExpr.and(TerminalContextKeys.focus, TerminalContextKeys.editorFocus)
    },
    run: (c, accessor) => accessor.get(ICommandService).executeCommand(CLOSE_EDITOR_COMMAND_ID)
  });
  registerTerminalAction({
    id: TerminalCommandId.KillActiveTab,
    title: terminalStrings.kill,
    f1: false,
    precondition: ContextKeyExpr.or(sharedWhenClause.terminalAvailable, TerminalContextKeys.isOpen),
    keybinding: {
      primary: KeyCode.Delete,
      mac: {
        primary: KeyMod.CtrlCmd | KeyCode.Backspace,
        secondary: [KeyCode.Delete]
      },
      weight: KeybindingWeight.WorkbenchContrib,
      when: TerminalContextKeys.tabsFocus
    },
    run: async (c, accessor) => {
      const disposePromises = [];
      for (const terminal of getSelectedInstances(accessor, true) ?? []) {
        disposePromises.push(c.service.safeDisposeTerminal(terminal));
      }
      await Promise.all(disposePromises);
      c.groupService.focusTabs();
    }
  });
  registerTerminalAction({
    id: TerminalCommandId.FocusHover,
    title: terminalStrings.focusHover,
    precondition: ContextKeyExpr.or(sharedWhenClause.terminalAvailable, TerminalContextKeys.isOpen),
    keybinding: {
      primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyI),
      weight: KeybindingWeight.WorkbenchContrib,
      when: ContextKeyExpr.or(TerminalContextKeys.tabsFocus, TerminalContextKeys.focus)
    },
    run: (c) => c.groupService.focusHover()
  });
  registerActiveInstanceAction({
    id: TerminalCommandId.Clear,
    title: localize2("workbench.action.terminal.clear", "Clear"),
    precondition: sharedWhenClause.terminalAvailable,
    keybinding: [{
      primary: 0,
      mac: { primary: KeyMod.CtrlCmd | KeyCode.KeyK },
      // Weight is higher than work workbench contributions so the keybinding remains
      // highest priority when chords are registered afterwards
      weight: KeybindingWeight.WorkbenchContrib + 1,
      // Disable the keybinding when accessibility mode is enabled as chords include
      // important screen reader keybindings such as cmd+k, cmd+i to show the hover
      when: ContextKeyExpr.or(ContextKeyExpr.and(TerminalContextKeys.focus, CONTEXT_ACCESSIBILITY_MODE_ENABLED.negate()), ContextKeyExpr.and(CONTEXT_ACCESSIBILITY_MODE_ENABLED, accessibleViewIsShown, accessibleViewCurrentProviderId.isEqualTo(AccessibleViewProviderId.Terminal)))
    }],
    run: (activeInstance) => activeInstance.clearBuffer()
  });
  registerTerminalAction({
    id: TerminalCommandId.SelectDefaultProfile,
    title: localize2("workbench.action.terminal.selectDefaultShell", "Select Default Profile"),
    run: (c) => c.service.showProfileQuickPick("setDefault")
  });
  registerTerminalAction({
    id: TerminalCommandId.ConfigureTerminalSettings,
    title: localize2("workbench.action.terminal.openSettings", "Configure Terminal Settings"),
    precondition: sharedWhenClause.terminalAvailable,
    run: (c, accessor) => accessor.get(IPreferencesService).openSettings({ jsonEditor: false, query: "@feature:terminal" })
  });
  registerActiveInstanceAction({
    id: TerminalCommandId.SetDimensions,
    title: localize2("workbench.action.terminal.setFixedDimensions", "Set Fixed Dimensions"),
    precondition: sharedWhenClause.terminalAvailable_and_opened,
    run: (activeInstance) => activeInstance.setFixedDimensions()
  });
  registerContextualInstanceAction({
    id: TerminalCommandId.SizeToContentWidth,
    title: terminalStrings.toggleSizeToContentWidth,
    precondition: sharedWhenClause.terminalAvailable_and_opened,
    keybinding: {
      primary: KeyMod.Alt | KeyCode.KeyZ,
      weight: KeybindingWeight.WorkbenchContrib,
      when: TerminalContextKeys.focus
    },
    run: (instance) => instance.toggleSizeToContentWidth()
  });
  registerTerminalAction({
    id: TerminalCommandId.SwitchTerminal,
    title: localize2("workbench.action.terminal.switchTerminal", "Switch Terminal"),
    precondition: sharedWhenClause.terminalAvailable,
    run: async (c, accessor, args) => {
      const item = toOptionalString(args);
      if (!item) {
        return;
      }
      if (item === switchTerminalActionViewItemSeparator) {
        c.service.refreshActiveGroup();
        return;
      }
      if (item === switchTerminalShowTabsTitle) {
        accessor.get(IConfigurationService).updateValue(TerminalSettingId.TabsEnabled, true);
        return;
      }
      const terminalIndexRe = /^([0-9]+): /;
      const indexMatches = terminalIndexRe.exec(item);
      if (indexMatches) {
        c.groupService.setActiveGroupByIndex(Number(indexMatches[1]) - 1);
        return c.groupService.showPanel(true);
      }
      const quickSelectProfiles = c.profileService.availableProfiles;
      const profileSelection = item.substring(4);
      if (quickSelectProfiles) {
        const profile = quickSelectProfiles.find((profile2) => profile2.profileName === profileSelection);
        if (profile) {
          const instance = await c.service.createTerminal({
            config: profile
          });
          c.service.setActiveInstance(instance);
        } else {
          console.warn(`No profile with name "${profileSelection}"`);
        }
      } else {
        console.warn(`Unmatched terminal item: "${item}"`);
      }
    }
  });
}
function getSelectedInstances2(accessor, args) {
  const terminalService = accessor.get(ITerminalService);
  const result = [];
  const context = parseActionArgs(args);
  if (context && context.length > 0) {
    for (const instanceContext of context) {
      const instance = terminalService.getInstanceFromId(instanceContext.instanceId);
      if (instance) {
        result.push(instance);
      }
    }
    if (result.length > 0) {
      return result;
    }
  }
  return void 0;
}
function getSelectedInstances(accessor, args, args2) {
  const listService = accessor.get(IListService);
  const terminalService = accessor.get(ITerminalService);
  const terminalGroupService = accessor.get(ITerminalGroupService);
  const result = [];
  const list = listService.lastFocusedList instanceof TerminalTabList ? listService.lastFocusedList : void 0;
  const selections = list?.getSelection();
  if (terminalGroupService.lastAccessedMenu === "inline-tab" && !selections?.length) {
    const instance = terminalGroupService.activeInstance;
    return instance ? [terminalGroupService.activeInstance] : void 0;
  }
  if (!list || !selections) {
    return void 0;
  }
  const focused = list.getFocus();
  if (focused.length === 1 && !selections.includes(focused[0])) {
    result.push(terminalService.getInstanceFromIndex(focused[0]));
    return result;
  }
  for (const selection of selections) {
    result.push(terminalService.getInstanceFromIndex(selection));
  }
  return result.filter((r) => !!r);
}
function validateTerminalName(name) {
  if (!name || name.trim().length === 0) {
    return {
      content: localize("emptyTerminalNameInfo", "Providing no name will reset it to the default value"),
      severity: Severity.Info
    };
  }
  return null;
}
function convertOptionsOrProfileToOptions(optionsOrProfile) {
  if (isObject(optionsOrProfile) && "profileName" in optionsOrProfile) {
    return { config: optionsOrProfile, location: optionsOrProfile.location };
  }
  return optionsOrProfile;
}
let newWithProfileAction;
function refreshTerminalActions(detectedProfiles) {
  const profileEnum = createProfileSchemaEnums(detectedProfiles);
  newWithProfileAction?.dispose();
  newWithProfileAction = registerAction2(class extends Action2 {
    constructor() {
      super({
        id: TerminalCommandId.NewWithProfile,
        title: localize2("workbench.action.terminal.newWithProfile", "Create New Terminal (With Profile)"),
        f1: true,
        precondition: ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.webExtensionContributedProfile),
        metadata: {
          description: TerminalCommandId.NewWithProfile,
          args: [{
            name: "args",
            schema: {
              type: "object",
              required: ["profileName"],
              properties: {
                profileName: {
                  description: localize("workbench.action.terminal.newWithProfile.profileName", "The name of the profile to create"),
                  type: "string",
                  enum: profileEnum.values,
                  markdownEnumDescriptions: profileEnum.markdownDescriptions
                },
                location: {
                  description: localize("newWithProfile.location", "Where to create the terminal"),
                  type: "string",
                  enum: ["view", "editor"],
                  enumDescriptions: [
                    localize("newWithProfile.location.view", "Create the terminal in the terminal view"),
                    localize("newWithProfile.location.editor", "Create the terminal in the editor")
                  ]
                }
              }
            }
          }]
        }
      });
    }
    async run(accessor, eventOrOptionsOrProfile, profile) {
      const c = getTerminalServices(accessor);
      const workspaceContextService = accessor.get(IWorkspaceContextService);
      const commandService = accessor.get(ICommandService);
      let event;
      let options;
      let instance;
      let cwd;
      if (isObject(eventOrOptionsOrProfile) && eventOrOptionsOrProfile && "profileName" in eventOrOptionsOrProfile) {
        const config = c.profileService.availableProfiles.find((profile2) => profile2.profileName === eventOrOptionsOrProfile.profileName);
        if (!config) {
          throw new Error(`Could not find terminal profile "${eventOrOptionsOrProfile.profileName}"`);
        }
        options = { config };
        if ("location" in eventOrOptionsOrProfile) {
          switch (eventOrOptionsOrProfile.location) {
            case "editor":
              options.location = TerminalLocation.Editor;
              break;
            case "view":
              options.location = TerminalLocation.Panel;
              break;
          }
        }
      } else if (isMouseEvent(eventOrOptionsOrProfile) || isPointerEvent(eventOrOptionsOrProfile) || isKeyboardEvent(eventOrOptionsOrProfile)) {
        event = eventOrOptionsOrProfile;
        options = profile ? { config: profile } : void 0;
      } else {
        options = convertOptionsOrProfileToOptions(eventOrOptionsOrProfile);
      }
      if (event && (event.altKey || event.ctrlKey)) {
        const parentTerminal = c.service.activeInstance;
        if (parentTerminal) {
          await c.service.createTerminal({ location: { parentTerminal }, config: options?.config });
          return;
        }
      }
      const folders = workspaceContextService.getWorkspace().folders;
      if (folders.length > 1) {
        const options2 = {
          placeHolder: localize("workbench.action.terminal.newWorkspacePlaceholder", "Select current working directory for new terminal")
        };
        const workspace = await commandService.executeCommand(PICK_WORKSPACE_FOLDER_COMMAND_ID, [options2]);
        if (!workspace) {
          return;
        }
        cwd = workspace.uri;
      }
      if (options) {
        options.cwd = cwd;
        instance = await c.service.createTerminal(options);
      } else {
        instance = await c.service.showProfileQuickPick("createInstance", cwd);
      }
      if (instance) {
        c.service.setActiveInstance(instance);
        await focusActiveTerminal(instance, c);
      }
    }
  });
  return newWithProfileAction;
}
function getResourceOrActiveInstance(c, resource) {
  return c.service.getInstanceFromResource(toOptionalUri(resource)) || c.service.activeInstance;
}
async function pickTerminalCwd(accessor, cancel) {
  const quickInputService = accessor.get(IQuickInputService);
  const labelService = accessor.get(ILabelService);
  const contextService = accessor.get(IWorkspaceContextService);
  const modelService = accessor.get(IModelService);
  const languageService = accessor.get(ILanguageService);
  const configurationService = accessor.get(IConfigurationService);
  const configurationResolverService = accessor.get(IConfigurationResolverService);
  const folders = contextService.getWorkspace().folders;
  if (!folders.length) {
    return;
  }
  const folderCwdPairs = await Promise.all(folders.map((e) => resolveWorkspaceFolderCwd(e, configurationService, configurationResolverService)));
  const shrinkedPairs = shrinkWorkspaceFolderCwdPairs(folderCwdPairs);
  if (shrinkedPairs.length === 1) {
    return shrinkedPairs[0];
  }
  const folderPicks = shrinkedPairs.map((pair) => {
    const label = pair.folder.name;
    const description = pair.isOverridden ? localize("workbench.action.terminal.overriddenCwdDescription", "(Overriden) {0}", labelService.getUriLabel(pair.cwd, { relative: !pair.isAbsolute })) : labelService.getUriLabel(dirname(pair.cwd), { relative: true });
    return {
      label,
      description: description !== label ? description : void 0,
      pair,
      iconClasses: getIconClasses(modelService, languageService, pair.cwd, FileKind.ROOT_FOLDER)
    };
  });
  const options = {
    placeHolder: localize("workbench.action.terminal.newWorkspacePlaceholder", "Select current working directory for new terminal"),
    matchOnDescription: true,
    canPickMany: false
  };
  const token = cancel || CancellationToken.None;
  const pick = await quickInputService.pick(folderPicks, options, token);
  return pick?.pair;
}
async function resolveWorkspaceFolderCwd(folder, configurationService, configurationResolverService) {
  const cwdConfig = configurationService.getValue(TerminalSettingId.Cwd, { resource: folder.uri });
  if (!isString(cwdConfig) || cwdConfig.length === 0) {
    return { folder, cwd: folder.uri, isAbsolute: false, isOverridden: false };
  }
  const resolvedCwdConfig = await configurationResolverService.resolveAsync(folder, cwdConfig);
  return isAbsolute(resolvedCwdConfig) || resolvedCwdConfig.startsWith(ConfigurationResolverExpression.VARIABLE_LHS) ? { folder, isAbsolute: true, isOverridden: true, cwd: URI.from({ ...folder.uri, path: resolvedCwdConfig }) } : { folder, isAbsolute: false, isOverridden: true, cwd: URI.joinPath(folder.uri, resolvedCwdConfig) };
}
function shrinkWorkspaceFolderCwdPairs(pairs) {
  const map = /* @__PURE__ */ new Map();
  for (const pair of pairs) {
    const key = pair.cwd.toString();
    const value = map.get(key);
    if (!value || key === pair.folder.uri.toString()) {
      map.set(key, pair);
    }
  }
  const selectedPairs = new Set(map.values());
  const selectedPairsInOrder = pairs.filter((x) => selectedPairs.has(x));
  return selectedPairsInOrder;
}
async function focusActiveTerminal(instance, c) {
  if (instance.target === TerminalLocation.Editor) {
    await c.editorService.revealActiveEditor();
    await instance.focusWhenReady(true);
  } else {
    await c.groupService.showPanel(true);
  }
}
async function renameWithQuickPick(c, accessor, resource) {
  let instance = resource;
  if (!instance || !instance?.rename) {
    instance = getResourceOrActiveInstance(c, resource);
  }
  if (instance) {
    const title = await accessor.get(IQuickInputService).input({
      value: instance.title,
      prompt: localize("workbench.action.terminal.rename.prompt", "Enter terminal name")
    });
    if (title) {
      instance.rename(title);
    }
  }
}
function toOptionalUri(obj) {
  return URI.isUri(obj) ? obj : void 0;
}
function toOptionalString(obj) {
  return isString(obj) ? obj : void 0;
}
export {
  TerminalLaunchHelpAction,
  getCwdForSplit,
  refreshTerminalActions,
  registerActiveInstanceAction,
  registerActiveXtermAction,
  registerContextualInstanceAction,
  registerTerminalAction,
  registerTerminalActions,
  shrinkWorkspaceFolderCwdPairs,
  switchTerminalActionViewItemSeparator,
  switchTerminalShowTabsTitle,
  terminalSendSequenceCommand,
  validateTerminalName
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsQWN0aW9ucy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IEtleUNob3JkLCBLZXlDb2RlLCBLZXlNb2QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBpc1dpbmRvd3MgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBpc09iamVjdCwgaXNTdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvc2VydmljZXMvY29kZUVkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRW5kT2ZMaW5lUHJlZmVyZW5jZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUsIGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBDT05URVhUX0FDQ0VTU0lCSUxJVFlfTU9ERV9FTkFCTEVEIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eS9jb21tb24vYWNjZXNzaWJpbGl0eS5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCByZWdpc3RlckFjdGlvbjIsIElBY3Rpb24yT3B0aW9ucywgTWVudUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBJTGlzdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9saXN0L2Jyb3dzZXIvbGlzdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UsIFNldmVyaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBJUGlja09wdGlvbnMsIElRdWlja0lucHV0U2VydmljZSwgSVF1aWNrUGlja0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IElUZXJtaW5hbFByb2ZpbGUsIFRlcm1pbmFsRXhpdFJlYXNvbiwgVGVybWluYWxJY29uLCBUZXJtaW5hbExvY2F0aW9uLCBUZXJtaW5hbFNldHRpbmdJZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIElXb3Jrc3BhY2VGb2xkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBQSUNLX1dPUktTUEFDRV9GT0xERVJfQ09NTUFORF9JRCB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvYWN0aW9ucy93b3Jrc3BhY2VDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBDTE9TRV9FRElUT1JfQ09NTUFORF9JRCB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvZWRpdG9yL2VkaXRvckNvbW1hbmRzLmpzJztcbmltcG9ydCB7IERpcmVjdGlvbiwgSUNyZWF0ZVRlcm1pbmFsT3B0aW9ucywgSURldGFjaGVkVGVybWluYWxJbnN0YW5jZSwgSVRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UsIElUZXJtaW5hbEVkaXRvclNlcnZpY2UsIElUZXJtaW5hbEdyb3VwU2VydmljZSwgSVRlcm1pbmFsSW5zdGFuY2UsIElUZXJtaW5hbEluc3RhbmNlU2VydmljZSwgSVRlcm1pbmFsU2VydmljZSwgSVh0ZXJtVGVybWluYWwgfSBmcm9tICcuL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IElSZW1vdGVUZXJtaW5hbEF0dGFjaFRhcmdldCwgSVRlcm1pbmFsUHJvZmlsZVJlc29sdmVyU2VydmljZSwgSVRlcm1pbmFsUHJvZmlsZVNlcnZpY2UsIFRFUk1JTkFMX1ZJRVdfSUQsIFRlcm1pbmFsQ29tbWFuZElkIH0gZnJvbSAnLi4vY29tbW9uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IFRlcm1pbmFsQ29udGV4dEtleXMgfSBmcm9tICcuLi9jb21tb24vdGVybWluYWxDb250ZXh0S2V5LmpzJztcbmltcG9ydCB7IGNyZWF0ZVByb2ZpbGVTY2hlbWFFbnVtcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbFByb2ZpbGVzLmpzJztcbmltcG9ydCB7IHRlcm1pbmFsU3RyaW5ncyB9IGZyb20gJy4uL2NvbW1vbi90ZXJtaW5hbFN0cmluZ3MuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9jb25maWd1cmF0aW9uUmVzb2x2ZXIvY29tbW9uL2NvbmZpZ3VyYXRpb25SZXNvbHZlci5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJSGlzdG9yeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9oaXN0b3J5L2NvbW1vbi9oaXN0b3J5LmpzJztcbmltcG9ydCB7IElQcmVmZXJlbmNlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9wcmVmZXJlbmNlcy9jb21tb24vcHJlZmVyZW5jZXMuanMnO1xuaW1wb3J0IHsgSVJlbW90ZUFnZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3JlbW90ZS9jb21tb24vcmVtb3RlQWdlbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFNJREVfR1JPVVAgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgaXNBYnNvbHV0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgSVRlcm1pbmFsUXVpY2tQaWNrSXRlbSB9IGZyb20gJy4vdGVybWluYWxQcm9maWxlUXVpY2twaWNrLmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGdldEljb25JZCwgZ2V0Q29sb3JDbGFzcywgZ2V0VXJpQ2xhc3NlcyB9IGZyb20gJy4vdGVybWluYWxJY29uLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBkaXJuYW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IGdldEljb25DbGFzc2VzIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9nZXRJY29uQ2xhc3Nlcy5qcyc7XG5pbXBvcnQgeyBGaWxlS2luZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbENhcGFiaWxpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vY2FwYWJpbGl0aWVzL2NhcGFiaWxpdGllcy5qcyc7XG5pbXBvcnQgeyBraWxsVGVybWluYWxJY29uLCBuZXdUZXJtaW5hbEljb24gfSBmcm9tICcuL3Rlcm1pbmFsSWNvbnMuanMnO1xuaW1wb3J0IHsgSUVkaXRvckdyb3Vwc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvckdyb3Vwc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSXRlcmFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9pdGVyYXRvci5qcyc7XG5pbXBvcnQgeyBhY2Nlc3NpYmxlVmlld0N1cnJlbnRQcm92aWRlcklkLCBhY2Nlc3NpYmxlVmlld0lzU2hvd24sIGFjY2Vzc2libGVWaWV3T25MYXN0TGluZSB9IGZyb20gJy4uLy4uL2FjY2Vzc2liaWxpdHkvYnJvd3Nlci9hY2Nlc3NpYmlsaXR5Q29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBpc0tleWJvYXJkRXZlbnQsIGlzTW91c2VFdmVudCwgaXNQb2ludGVyRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IGVkaXRvckdyb3VwVG9Db2x1bW4gfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvckdyb3VwQ29sdW1uLmpzJztcbmltcG9ydCB7IEluc3RhbmNlQ29udGV4dCB9IGZyb20gJy4vdGVybWluYWxDb250ZXh0TWVudS5qcyc7XG5pbXBvcnQgeyBBY2Nlc3NpYmxlVmlld1Byb3ZpZGVySWQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5L2Jyb3dzZXIvYWNjZXNzaWJsZVZpZXcuanMnO1xuaW1wb3J0IHsgVGVybWluYWxUYWJMaXN0IH0gZnJvbSAnLi90ZXJtaW5hbFRhYnNMaXN0LmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25SZXNvbHZlckV4cHJlc3Npb24gfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9jb25maWd1cmF0aW9uUmVzb2x2ZXIvY29tbW9uL2NvbmZpZ3VyYXRpb25SZXNvbHZlckV4cHJlc3Npb24uanMnO1xuXG5leHBvcnQgY29uc3Qgc3dpdGNoVGVybWluYWxBY3Rpb25WaWV3SXRlbVNlcGFyYXRvciA9ICdcXHUyNTAwXFx1MjUwMFxcdTI1MDBcXHUyNTAwXFx1MjUwMFxcdTI1MDBcXHUyNTAwXFx1MjUwMFxcdTI1MDAnO1xuZXhwb3J0IGNvbnN0IHN3aXRjaFRlcm1pbmFsU2hvd1RhYnNUaXRsZSA9IGxvY2FsaXplKCdzaG93VGVybWluYWxUYWJzJywgXCJTaG93IFRhYnNcIik7XG5cbmNvbnN0IGNhdGVnb3J5ID0gdGVybWluYWxTdHJpbmdzLmFjdGlvbkNhdGVnb3J5O1xuXG4vLyBTb21lIHRlcm1pbmFsIGNvbnRleHQga2V5cyBnZXQgY29tcGxpY2F0ZWQuIFNpbmNlIG5vcm1hbGl6aW5nIGFuZC9vciBjb250ZXh0IGtleXMgY2FuIGJlXG4vLyBleHBlbnNpdmUgdGhpcyBpcyBkb25lIG9uY2UgcGVyIGNvbnRleHQga2V5IGFuZCBzaGFyZWQuXG5jb25zdCBzaGFyZWRXaGVuQ2xhdXNlID0gKCgpID0+IHtcblx0Y29uc3QgdGVybWluYWxBdmFpbGFibGUgPSBDb250ZXh0S2V5RXhwci5vcihUZXJtaW5hbENvbnRleHRLZXlzLnByb2Nlc3NTdXBwb3J0ZWQsIFRlcm1pbmFsQ29udGV4dEtleXMudGVybWluYWxIYXNCZWVuQ3JlYXRlZCk7XG5cdHJldHVybiB7XG5cdFx0dGVybWluYWxBdmFpbGFibGUsXG5cdFx0dGVybWluYWxBdmFpbGFibGVfYW5kX29wZW5lZDogQ29udGV4dEtleUV4cHIuYW5kKHRlcm1pbmFsQXZhaWxhYmxlLCBUZXJtaW5hbENvbnRleHRLZXlzLmlzT3BlbiksXG5cdFx0dGVybWluYWxBdmFpbGFibGVfYW5kX2VkaXRvckFjdGl2ZTogQ29udGV4dEtleUV4cHIuYW5kKHRlcm1pbmFsQXZhaWxhYmxlLCBUZXJtaW5hbENvbnRleHRLZXlzLnRlcm1pbmFsRWRpdG9yQWN0aXZlKSxcblx0XHR0ZXJtaW5hbEF2YWlsYWJsZV9hbmRfc2luZ3VsYXJTZWxlY3Rpb246IENvbnRleHRLZXlFeHByLmFuZCh0ZXJtaW5hbEF2YWlsYWJsZSwgVGVybWluYWxDb250ZXh0S2V5cy50YWJzU2luZ3VsYXJTZWxlY3Rpb24pLFxuXHRcdGZvY3VzSW5BbnlfYW5kX25vcm1hbEJ1ZmZlcjogQ29udGV4dEtleUV4cHIuYW5kKFRlcm1pbmFsQ29udGV4dEtleXMuZm9jdXNJbkFueSwgVGVybWluYWxDb250ZXh0S2V5cy5hbHRCdWZmZXJBY3RpdmUubmVnYXRlKCkpXG5cdH07XG59KSgpO1xuXG5leHBvcnQgaW50ZXJmYWNlIFdvcmtzcGFjZUZvbGRlckN3ZFBhaXIge1xuXHRmb2xkZXI6IElXb3Jrc3BhY2VGb2xkZXI7XG5cdGN3ZDogVVJJO1xuXHRpc0Fic29sdXRlOiBib29sZWFuO1xuXHRpc092ZXJyaWRkZW46IGJvb2xlYW47XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRDd2RGb3JTcGxpdChcblx0aW5zdGFuY2U6IElUZXJtaW5hbEluc3RhbmNlLFxuXHRmb2xkZXJzOiBJV29ya3NwYWNlRm9sZGVyW10gfCB1bmRlZmluZWQsXG5cdGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdGNvbmZpZ1NlcnZpY2U6IElUZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlXG4pOiBQcm9taXNlPHN0cmluZyB8IFVSSSB8IHVuZGVmaW5lZD4ge1xuXHRzd2l0Y2ggKGNvbmZpZ1NlcnZpY2UuY29uZmlnLnNwbGl0Q3dkKSB7XG5cdFx0Y2FzZSAnd29ya3NwYWNlUm9vdCc6XG5cdFx0XHRpZiAoZm9sZGVycyAhPT0gdW5kZWZpbmVkICYmIGNvbW1hbmRTZXJ2aWNlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0aWYgKGZvbGRlcnMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZvbGRlcnNbMF0udXJpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGZvbGRlcnMubGVuZ3RoID4gMSkge1xuXHRcdFx0XHRcdC8vIE9ubHkgY2hvb3NlIGEgcGF0aCB3aGVuIHRoZXJlJ3MgbW9yZSB0aGFuIDEgZm9sZGVyXG5cdFx0XHRcdFx0Y29uc3Qgb3B0aW9uczogSVBpY2tPcHRpb25zPElRdWlja1BpY2tJdGVtPiA9IHtcblx0XHRcdFx0XHRcdHBsYWNlSG9sZGVyOiBsb2NhbGl6ZSgnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5uZXdXb3Jrc3BhY2VQbGFjZWhvbGRlcicsIFwiU2VsZWN0IGN1cnJlbnQgd29ya2luZyBkaXJlY3RvcnkgZm9yIG5ldyB0ZXJtaW5hbFwiKVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0Y29uc3Qgd29ya3NwYWNlID0gYXdhaXQgY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoUElDS19XT1JLU1BBQ0VfRk9MREVSX0NPTU1BTkRfSUQsIFtvcHRpb25zXSk7XG5cdFx0XHRcdFx0aWYgKCF3b3Jrc3BhY2UpIHtcblx0XHRcdFx0XHRcdC8vIERvbid0IHNwbGl0IHRoZSBpbnN0YW5jZSBpZiB0aGUgd29ya3NwYWNlIHBpY2tlciB3YXMgY2FuY2VsZWRcblx0XHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUod29ya3NwYWNlLnVyaSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiAnJztcblx0XHRjYXNlICdpbml0aWFsJzpcblx0XHRcdHJldHVybiBpbnN0YW5jZS5nZXRJbml0aWFsQ3dkKCk7XG5cdFx0Y2FzZSAnaW5oZXJpdGVkJzpcblx0XHRcdHJldHVybiBpbnN0YW5jZS5nZXRDd2QoKTtcblx0fVxufVxuXG5leHBvcnQgY29uc3QgdGVybWluYWxTZW5kU2VxdWVuY2VDb21tYW5kID0gYXN5bmMgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBhcmdzOiB1bmtub3duKSA9PiB7XG5cdGNvbnN0IGluc3RhbmNlID0gYWNjZXNzb3IuZ2V0KElUZXJtaW5hbFNlcnZpY2UpLmFjdGl2ZUluc3RhbmNlO1xuXHRpZiAoaW5zdGFuY2UpIHtcblx0XHRjb25zdCB0ZXh0ID0gaXNPYmplY3QoYXJncykgJiYgJ3RleHQnIGluIGFyZ3MgPyB0b09wdGlvbmFsU3RyaW5nKGFyZ3MudGV4dCkgOiB1bmRlZmluZWQ7XG5cdFx0aWYgKCF0ZXh0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UpO1xuXHRcdGNvbnN0IHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSk7XG5cdFx0Y29uc3QgaGlzdG9yeVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUhpc3RvcnlTZXJ2aWNlKTtcblx0XHRjb25zdCBhY3RpdmVXb3Jrc3BhY2VSb290VXJpID0gaGlzdG9yeVNlcnZpY2UuZ2V0TGFzdEFjdGl2ZVdvcmtzcGFjZVJvb3QoaW5zdGFuY2UuaXNSZW1vdGUgPyBTY2hlbWFzLnZzY29kZVJlbW90ZSA6IFNjaGVtYXMuZmlsZSk7XG5cdFx0Y29uc3QgbGFzdEFjdGl2ZVdvcmtzcGFjZVJvb3QgPSBhY3RpdmVXb3Jrc3BhY2VSb290VXJpID8gd29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlRm9sZGVyKGFjdGl2ZVdvcmtzcGFjZVJvb3RVcmkpID8/IHVuZGVmaW5lZCA6IHVuZGVmaW5lZDtcblx0XHRjb25zdCByZXNvbHZlZFRleHQgPSBhd2FpdCBjb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlLnJlc29sdmVBc3luYyhsYXN0QWN0aXZlV29ya3NwYWNlUm9vdCwgdGV4dCk7XG5cdFx0aW5zdGFuY2Uuc2VuZFRleHQocmVzb2x2ZWRUZXh0LCBmYWxzZSk7XG5cdH1cbn07XG5cbmV4cG9ydCBjbGFzcyBUZXJtaW5hbExhdW5jaEhlbHBBY3Rpb24gZXh0ZW5kcyBBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJT3BlbmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9vcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcignd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5sYXVuY2hIZWxwJywgbG9jYWxpemUoJ3Rlcm1pbmFsTGF1bmNoSGVscCcsIFwiT3BlbiBIZWxwXCIpKTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLl9vcGVuZXJTZXJ2aWNlLm9wZW4oJ2h0dHBzOi8vYWthLm1zL3ZzY29kZS10cm91Ymxlc2hvb3QtdGVybWluYWwtbGF1bmNoJyk7XG5cdH1cbn1cblxuLyoqXG4gKiBBIHdyYXBwZXIgZnVuY3Rpb24gYXJvdW5kIHJlZ2lzdGVyQWN0aW9uMiB0byBoZWxwIG1ha2UgcmVnaXN0ZXJpbmcgdGVybWluYWwgYWN0aW9ucyBtb3JlIGNvbmNpc2UuXG4gKiBUaGUgZm9sbG93aW5nIGRlZmF1bHQgb3B0aW9ucyBhcmUgdXNlZCBpZiB1bmRlZmluZWQ6XG4gKlxuICogLSBgZjFgOiB0cnVlXG4gKiAtIGBjYXRlZ29yeWA6IFRlcm1pbmFsXG4gKiAtIGBwcmVjb25kaXRpb25gOiBUZXJtaW5hbENvbnRleHRLZXlzLnByb2Nlc3NTdXBwb3J0ZWRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVyVGVybWluYWxBY3Rpb24oXG5cdG9wdGlvbnM6IElBY3Rpb24yT3B0aW9ucyAmIHsgcnVuOiAoYzogSVRlcm1pbmFsU2VydmljZXNDb2xsZWN0aW9uLCBhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgYXJncz86IHVua25vd24sIGFyZ3MyPzogdW5rbm93bikgPT4gdm9pZCB8IFByb21pc2U8dW5rbm93bj4gfVxuKTogSURpc3Bvc2FibGUge1xuXHQvLyBTZXQgZGVmYXVsdHNcblx0b3B0aW9ucy5mMSA9IG9wdGlvbnMuZjEgPz8gdHJ1ZTtcblx0b3B0aW9ucy5jYXRlZ29yeSA9IG9wdGlvbnMuY2F0ZWdvcnkgPz8gY2F0ZWdvcnk7XG5cdG9wdGlvbnMucHJlY29uZGl0aW9uID0gb3B0aW9ucy5wcmVjb25kaXRpb24gPz8gVGVybWluYWxDb250ZXh0S2V5cy5wcm9jZXNzU3VwcG9ydGVkO1xuXHQvLyBSZW1vdmUgcnVuIGZ1bmN0aW9uIGZyb20gb3B0aW9ucyBzbyBpdCdzIG5vdCBwYXNzZWQgdGhyb3VnaCB0byByZWdpc3RlckFjdGlvbjJcblx0Y29uc3QgcnVuRnVuYyA9IG9wdGlvbnMucnVuO1xuXHRjb25zdCBzdHJpY3RPcHRpb25zOiBJQWN0aW9uMk9wdGlvbnMgJiB7IHJ1bj86IChjOiBJVGVybWluYWxTZXJ2aWNlc0NvbGxlY3Rpb24sIGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBhcmdzPzogdW5rbm93bikgPT4gdm9pZCB8IFByb21pc2U8dW5rbm93bj4gfSA9IG9wdGlvbnM7XG5cdGRlbGV0ZSAoc3RyaWN0T3B0aW9ucyBhcyBJQWN0aW9uMk9wdGlvbnMgJiB7IHJ1bj86IChjOiBJVGVybWluYWxTZXJ2aWNlc0NvbGxlY3Rpb24sIGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBhcmdzPzogdW5rbm93bikgPT4gdm9pZCB8IFByb21pc2U8dW5rbm93bj4gfSlbJ3J1biddO1xuXHQvLyBSZWdpc3RlclxuXHRyZXR1cm4gcmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcihzdHJpY3RPcHRpb25zIGFzIElBY3Rpb24yT3B0aW9ucyk7XG5cdFx0fVxuXHRcdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgYXJncz86IHVua25vd24sIGFyZ3MyPzogdW5rbm93bikge1xuXHRcdFx0cmV0dXJuIHJ1bkZ1bmMoZ2V0VGVybWluYWxTZXJ2aWNlcyhhY2Nlc3NvciksIGFjY2Vzc29yLCBhcmdzLCBhcmdzMik7XG5cdFx0fVxuXHR9KTtcbn1cblxuZnVuY3Rpb24gcGFyc2VBY3Rpb25BcmdzKGFyZ3M/OiB1bmtub3duKTogSW5zdGFuY2VDb250ZXh0W10gfCB1bmRlZmluZWQge1xuXHRpZiAoQXJyYXkuaXNBcnJheShhcmdzKSkge1xuXHRcdGlmIChhcmdzLmV2ZXJ5KGUgPT4gZSBpbnN0YW5jZW9mIEluc3RhbmNlQ29udGV4dCkpIHtcblx0XHRcdHJldHVybiBhcmdzIGFzIEluc3RhbmNlQ29udGV4dFtdO1xuXHRcdH1cblx0fSBlbHNlIGlmIChhcmdzIGluc3RhbmNlb2YgSW5zdGFuY2VDb250ZXh0KSB7XG5cdFx0cmV0dXJuIFthcmdzXTtcblx0fVxuXHRyZXR1cm4gdW5kZWZpbmVkO1xufVxuLyoqXG4gKiBBIHdyYXBwZXIgYXJvdW5kIHtAbGluayByZWdpc3RlclRlcm1pbmFsQWN0aW9ufSB0aGF0IHJ1bnMgYSBjYWxsYmFjayBmb3IgYWxsIGN1cnJlbnRseSBzZWxlY3RlZFxuICogaW5zdGFuY2VzIHByb3ZpZGVkIGluIHRoZSBhY3Rpb24gY29udGV4dC4gVGhpcyBmYWxscyBiYWNrIHRvIHRoZSBhY3RpdmUgaW5zdGFuY2UgaWYgdGhlcmUgYXJlIG5vXG4gKiBjb250ZXh0dWFsIGluc3RhbmNlcyBwcm92aWRlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVyQ29udGV4dHVhbEluc3RhbmNlQWN0aW9uKFxuXHRvcHRpb25zOiBJQWN0aW9uMk9wdGlvbnMgJiB7XG5cdFx0LyoqXG5cdFx0ICogV2hlbiBzcGVjaWZpZWQsIG9ubHkgdGhpcyB0eXBlIG9mIGFjdGl2ZSBpbnN0YW5jZSB3aWxsIGJlIHVzZWQgd2hlbiB0aGVyZSBhcmUgbm9cblx0XHQgKiBjb250ZXh0dWFsIGluc3RhbmNlcy5cblx0XHQgKi9cblx0XHRhY3RpdmVJbnN0YW5jZVR5cGU/OiAndmlldycgfCAnZWRpdG9yJztcblx0XHRydW46IChpbnN0YW5jZTogSVRlcm1pbmFsSW5zdGFuY2UsIGM6IElUZXJtaW5hbFNlcnZpY2VzQ29sbGVjdGlvbiwgYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGFyZ3M/OiB1bmtub3duKSA9PiB2b2lkIHwgUHJvbWlzZTx1bmtub3duPjtcblx0XHQvKipcblx0XHQgKiBBIGNhbGxiYWNrIHRvIHJ1biBhZnRlciB0aGUgYHJ1bmAgY2FsbGJhY2tzIGhhdmUgY29tcGxldGVkLlxuXHRcdCAqIEBwYXJhbSBpbnN0YW5jZXMgVGhlIHNlbGVjdGVkIGluc3RhbmNlKHMpIHRoYXQgdGhlIGNvbW1hbmQgd2FzIHJ1biBvbi5cblx0XHQgKi9cblx0XHRydW5BZnRlcj86IChpbnN0YW5jZXM6IElUZXJtaW5hbEluc3RhbmNlW10sIGM6IElUZXJtaW5hbFNlcnZpY2VzQ29sbGVjdGlvbiwgYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGFyZ3M/OiB1bmtub3duKSA9PiB2b2lkIHwgUHJvbWlzZTx1bmtub3duPjtcblx0fVxuKTogSURpc3Bvc2FibGUge1xuXHRjb25zdCBvcmlnaW5hbFJ1biA9IG9wdGlvbnMucnVuO1xuXHRyZXR1cm4gcmVnaXN0ZXJUZXJtaW5hbEFjdGlvbih7XG5cdFx0Li4ub3B0aW9ucyxcblx0XHRydW46IGFzeW5jIChjLCBhY2Nlc3NvciwgZm9jdXNlZEluc3RhbmNlQXJncywgYWxsSW5zdGFuY2VBcmdzKSA9PiB7XG5cdFx0XHRsZXQgaW5zdGFuY2VzID0gZ2V0U2VsZWN0ZWRJbnN0YW5jZXMyKGFjY2Vzc29yLCBhbGxJbnN0YW5jZUFyZ3MpO1xuXHRcdFx0aWYgKCFpbnN0YW5jZXMpIHtcblx0XHRcdFx0Y29uc3QgYWN0aXZlSW5zdGFuY2UgPSAoXG5cdFx0XHRcdFx0b3B0aW9ucy5hY3RpdmVJbnN0YW5jZVR5cGUgPT09ICd2aWV3J1xuXHRcdFx0XHRcdFx0PyBjLmdyb3VwU2VydmljZVxuXHRcdFx0XHRcdFx0OiBvcHRpb25zLmFjdGl2ZUluc3RhbmNlVHlwZSA9PT0gJ2VkaXRvcicgP1xuXHRcdFx0XHRcdFx0XHRjLmVkaXRvclNlcnZpY2Vcblx0XHRcdFx0XHRcdFx0OiBjLnNlcnZpY2Vcblx0XHRcdFx0KS5hY3RpdmVJbnN0YW5jZTtcblx0XHRcdFx0aWYgKCFhY3RpdmVJbnN0YW5jZSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpbnN0YW5jZXMgPSBbYWN0aXZlSW5zdGFuY2VdO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgcmVzdWx0czogKFByb21pc2U8dW5rbm93bj4gfCB2b2lkKVtdID0gW107XG5cdFx0XHRmb3IgKGNvbnN0IGluc3RhbmNlIG9mIGluc3RhbmNlcykge1xuXHRcdFx0XHRyZXN1bHRzLnB1c2gob3JpZ2luYWxSdW4oaW5zdGFuY2UsIGMsIGFjY2Vzc29yLCBmb2N1c2VkSW5zdGFuY2VBcmdzKSk7XG5cdFx0XHR9XG5cdFx0XHRhd2FpdCBQcm9taXNlLmFsbChyZXN1bHRzKTtcblx0XHRcdGlmIChvcHRpb25zLnJ1bkFmdGVyKSB7XG5cdFx0XHRcdG9wdGlvbnMucnVuQWZ0ZXIoaW5zdGFuY2VzLCBjLCBhY2Nlc3NvciwgZm9jdXNlZEluc3RhbmNlQXJncyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcbn1cblxuLyoqXG4gKiBBIHdyYXBwZXIgYXJvdW5kIHtAbGluayByZWdpc3RlclRlcm1pbmFsQWN0aW9ufSB0aGF0IGVuc3VyZXMgYW4gYWN0aXZlIGluc3RhbmNlIGV4aXN0cyBhbmRcbiAqIHByb3ZpZGVzIGl0IHRvIHRoZSBydW4gZnVuY3Rpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlckFjdGl2ZUluc3RhbmNlQWN0aW9uKFxuXHRvcHRpb25zOiBJQWN0aW9uMk9wdGlvbnMgJiB7IHJ1bjogKGFjdGl2ZUluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSwgYzogSVRlcm1pbmFsU2VydmljZXNDb2xsZWN0aW9uLCBhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgYXJncz86IHVua25vd24pID0+IHZvaWQgfCBQcm9taXNlPHVua25vd24+IH1cbik6IElEaXNwb3NhYmxlIHtcblx0Y29uc3Qgb3JpZ2luYWxSdW4gPSBvcHRpb25zLnJ1bjtcblx0cmV0dXJuIHJlZ2lzdGVyVGVybWluYWxBY3Rpb24oe1xuXHRcdC4uLm9wdGlvbnMsXG5cdFx0cnVuOiAoYywgYWNjZXNzb3IsIGFyZ3MpID0+IHtcblx0XHRcdGNvbnN0IGFjdGl2ZUluc3RhbmNlID0gYy5zZXJ2aWNlLmFjdGl2ZUluc3RhbmNlO1xuXHRcdFx0aWYgKGFjdGl2ZUluc3RhbmNlKSB7XG5cdFx0XHRcdHJldHVybiBvcmlnaW5hbFJ1bihhY3RpdmVJbnN0YW5jZSwgYywgYWNjZXNzb3IsIGFyZ3MpO1xuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG59XG5cbi8qKlxuICogQSB3cmFwcGVyIGFyb3VuZCB7QGxpbmsgcmVnaXN0ZXJUZXJtaW5hbEFjdGlvbn0gdGhhdCBlbnN1cmVzIGFuIGFjdGl2ZSB0ZXJtaW5hbFxuICogZXhpc3RzIGFuZCBwcm92aWRlcyBpdCB0byB0aGUgcnVuIGZ1bmN0aW9uLlxuICpcbiAqIFRoaXMgaW5jbHVkZXMgZGV0YWNoZWQgeHRlcm0gdGVybWluYWxzIHRoYXQgYXJlIG5vdCBtYW5hZ2VkIGJ5IGFuIHtAbGluayBJVGVybWluYWxJbnN0YW5jZX0uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlckFjdGl2ZVh0ZXJtQWN0aW9uKFxuXHRvcHRpb25zOiBJQWN0aW9uMk9wdGlvbnMgJiB7IHJ1bjogKGFjdGl2ZVRlcm1pbmFsOiBJWHRlcm1UZXJtaW5hbCwgYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSB8IElEZXRhY2hlZFRlcm1pbmFsSW5zdGFuY2UsIGFyZ3M/OiB1bmtub3duKSA9PiB2b2lkIHwgUHJvbWlzZTx1bmtub3duPiB9XG4pOiBJRGlzcG9zYWJsZSB7XG5cdGNvbnN0IG9yaWdpbmFsUnVuID0gb3B0aW9ucy5ydW47XG5cdHJldHVybiByZWdpc3RlclRlcm1pbmFsQWN0aW9uKHtcblx0XHQuLi5vcHRpb25zLFxuXHRcdHJ1bjogKGMsIGFjY2Vzc29yLCBhcmdzKSA9PiB7XG5cdFx0XHRjb25zdCBhY3RpdmVEZXRhY2hlZCA9IEl0ZXJhYmxlLmZpbmQoYy5zZXJ2aWNlLmRldGFjaGVkSW5zdGFuY2VzLCBkID0+IGQueHRlcm0uaXNGb2N1c2VkKTtcblx0XHRcdGlmIChhY3RpdmVEZXRhY2hlZCkge1xuXHRcdFx0XHRyZXR1cm4gb3JpZ2luYWxSdW4oYWN0aXZlRGV0YWNoZWQueHRlcm0sIGFjY2Vzc29yLCBhY3RpdmVEZXRhY2hlZCwgYXJncyk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGFjdGl2ZUluc3RhbmNlID0gYy5zZXJ2aWNlLmFjdGl2ZUluc3RhbmNlO1xuXHRcdFx0aWYgKGFjdGl2ZUluc3RhbmNlPy54dGVybSkge1xuXHRcdFx0XHRyZXR1cm4gb3JpZ2luYWxSdW4oYWN0aXZlSW5zdGFuY2UueHRlcm0sIGFjY2Vzc29yLCBhY3RpdmVJbnN0YW5jZSwgYXJncyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJVGVybWluYWxTZXJ2aWNlc0NvbGxlY3Rpb24ge1xuXHRzZXJ2aWNlOiBJVGVybWluYWxTZXJ2aWNlO1xuXHRjb25maWdTZXJ2aWNlOiBJVGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZTtcblx0Z3JvdXBTZXJ2aWNlOiBJVGVybWluYWxHcm91cFNlcnZpY2U7XG5cdGluc3RhbmNlU2VydmljZTogSVRlcm1pbmFsSW5zdGFuY2VTZXJ2aWNlO1xuXHRlZGl0b3JTZXJ2aWNlOiBJVGVybWluYWxFZGl0b3JTZXJ2aWNlO1xuXHRwcm9maWxlU2VydmljZTogSVRlcm1pbmFsUHJvZmlsZVNlcnZpY2U7XG5cdHByb2ZpbGVSZXNvbHZlclNlcnZpY2U6IElUZXJtaW5hbFByb2ZpbGVSZXNvbHZlclNlcnZpY2U7XG59XG5cbmZ1bmN0aW9uIGdldFRlcm1pbmFsU2VydmljZXMoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBJVGVybWluYWxTZXJ2aWNlc0NvbGxlY3Rpb24ge1xuXHRyZXR1cm4ge1xuXHRcdHNlcnZpY2U6IGFjY2Vzc29yLmdldChJVGVybWluYWxTZXJ2aWNlKSxcblx0XHRjb25maWdTZXJ2aWNlOiBhY2Nlc3Nvci5nZXQoSVRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UpLFxuXHRcdGdyb3VwU2VydmljZTogYWNjZXNzb3IuZ2V0KElUZXJtaW5hbEdyb3VwU2VydmljZSksXG5cdFx0aW5zdGFuY2VTZXJ2aWNlOiBhY2Nlc3Nvci5nZXQoSVRlcm1pbmFsSW5zdGFuY2VTZXJ2aWNlKSxcblx0XHRlZGl0b3JTZXJ2aWNlOiBhY2Nlc3Nvci5nZXQoSVRlcm1pbmFsRWRpdG9yU2VydmljZSksXG5cdFx0cHJvZmlsZVNlcnZpY2U6IGFjY2Vzc29yLmdldChJVGVybWluYWxQcm9maWxlU2VydmljZSksXG5cdFx0cHJvZmlsZVJlc29sdmVyU2VydmljZTogYWNjZXNzb3IuZ2V0KElUZXJtaW5hbFByb2ZpbGVSZXNvbHZlclNlcnZpY2UpXG5cdH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlclRlcm1pbmFsQWN0aW9ucygpIHtcblx0cmVnaXN0ZXJUZXJtaW5hbEFjdGlvbih7XG5cdFx0aWQ6IFRlcm1pbmFsQ29tbWFuZElkLk5ld0luQWN0aXZlV29ya3NwYWNlLFxuXHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwubmV3SW5BY3RpdmVXb3Jrc3BhY2UnLCAnQ3JlYXRlIE5ldyBUZXJtaW5hbCAoSW4gQWN0aXZlIFdvcmtzcGFjZSknKSxcblx0XHRydW46IGFzeW5jIChjKSA9PiB7XG5cdFx0XHRpZiAoYy5zZXJ2aWNlLmlzUHJvY2Vzc1N1cHBvcnRSZWdpc3RlcmVkKSB7XG5cdFx0XHRcdGNvbnN0IGluc3RhbmNlID0gYXdhaXQgYy5zZXJ2aWNlLmNyZWF0ZVRlcm1pbmFsKHsgbG9jYXRpb246IGMuc2VydmljZS5kZWZhdWx0TG9jYXRpb24gfSk7XG5cdFx0XHRcdGlmICghaW5zdGFuY2UpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Yy5zZXJ2aWNlLnNldEFjdGl2ZUluc3RhbmNlKGluc3RhbmNlKTtcblx0XHRcdFx0YXdhaXQgZm9jdXNBY3RpdmVUZXJtaW5hbChpbnN0YW5jZSwgYyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcblxuXHQvLyBSZWdpc3RlciBuZXcgd2l0aCBwcm9maWxlIGNvbW1hbmRcblx0cmVmcmVzaFRlcm1pbmFsQWN0aW9ucyhbXSk7XG5cblx0cmVnaXN0ZXJUZXJtaW5hbEFjdGlvbih7XG5cdFx0aWQ6IFRlcm1pbmFsQ29tbWFuZElkLkNyZWF0ZVRlcm1pbmFsRWRpdG9yLFxuXHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuY3JlYXRlVGVybWluYWxFZGl0b3InLCAnQ3JlYXRlIE5ldyBUZXJtaW5hbCBpbiBFZGl0b3IgQXJlYScpLFxuXHRcdHJ1bjogYXN5bmMgKGMsIF8sIGFyZ3MpID0+IHtcblx0XHRcdGNvbnN0IG9wdGlvbnMgPSAoaXNPYmplY3QoYXJncykgJiYgJ2xvY2F0aW9uJyBpbiBhcmdzKSA/IGFyZ3MgYXMgSUNyZWF0ZVRlcm1pbmFsT3B0aW9ucyA6IHsgbG9jYXRpb246IFRlcm1pbmFsTG9jYXRpb24uRWRpdG9yIH07XG5cdFx0XHRjb25zdCBpbnN0YW5jZSA9IGF3YWl0IGMuc2VydmljZS5jcmVhdGVUZXJtaW5hbChvcHRpb25zKTtcblx0XHRcdGF3YWl0IGluc3RhbmNlLmZvY3VzV2hlblJlYWR5KCk7XG5cdFx0fVxuXHR9KTtcblxuXHRyZWdpc3RlclRlcm1pbmFsQWN0aW9uKHtcblx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuQ3JlYXRlVGVybWluYWxFZGl0b3JTYW1lR3JvdXAsXG5cdFx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5jcmVhdGVUZXJtaW5hbEVkaXRvcicsICdDcmVhdGUgTmV3IFRlcm1pbmFsIGluIEVkaXRvciBBcmVhJyksXG5cdFx0ZjE6IGZhbHNlLFxuXHRcdHJ1bjogYXN5bmMgKGMsIGFjY2Vzc29yLCBhcmdzKSA9PiB7XG5cdFx0XHQvLyBGb3JjZSB0aGUgZWRpdG9yIGludG8gdGhlIHNhbWUgZWRpdG9yIGdyb3VwIGlmIGl0J3MgbG9ja2VkLiBUaGlzIGNvbW1hbmQgaXMgb25seSBldmVyXG5cdFx0XHQvLyBjYWxsZWQgd2hlbiBhIHRlcm1pbmFsIGlzIHRoZSBhY3RpdmUgZWRpdG9yXG5cdFx0XHRjb25zdCBlZGl0b3JHcm91cHNTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JHcm91cHNTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGluc3RhbmNlID0gYXdhaXQgYy5zZXJ2aWNlLmNyZWF0ZVRlcm1pbmFsKHtcblx0XHRcdFx0bG9jYXRpb246IHsgdmlld0NvbHVtbjogZWRpdG9yR3JvdXBUb0NvbHVtbihlZGl0b3JHcm91cHNTZXJ2aWNlLCBlZGl0b3JHcm91cHNTZXJ2aWNlLmFjdGl2ZUdyb3VwKSB9XG5cdFx0XHR9KTtcblx0XHRcdGF3YWl0IGluc3RhbmNlLmZvY3VzV2hlblJlYWR5KCk7XG5cdFx0fVxuXHR9KTtcblxuXHRyZWdpc3RlclRlcm1pbmFsQWN0aW9uKHtcblx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuQ3JlYXRlVGVybWluYWxFZGl0b3JTaWRlLFxuXHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuY3JlYXRlVGVybWluYWxFZGl0b3JTaWRlJywgJ0NyZWF0ZSBOZXcgVGVybWluYWwgaW4gRWRpdG9yIEFyZWEgdG8gdGhlIFNpZGUnKSxcblx0XHRydW46IGFzeW5jIChjKSA9PiB7XG5cdFx0XHRjb25zdCBpbnN0YW5jZSA9IGF3YWl0IGMuc2VydmljZS5jcmVhdGVUZXJtaW5hbCh7XG5cdFx0XHRcdGxvY2F0aW9uOiB7IHZpZXdDb2x1bW46IFNJREVfR1JPVVAgfVxuXHRcdFx0fSk7XG5cdFx0XHRhd2FpdCBpbnN0YW5jZS5mb2N1c1doZW5SZWFkeSgpO1xuXHRcdH1cblx0fSk7XG5cblx0cmVnaXN0ZXJDb250ZXh0dWFsSW5zdGFuY2VBY3Rpb24oe1xuXHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5Nb3ZlVG9FZGl0b3IsXG5cdFx0dGl0bGU6IHRlcm1pbmFsU3RyaW5ncy5tb3ZlVG9FZGl0b3IsXG5cdFx0cHJlY29uZGl0aW9uOiBzaGFyZWRXaGVuQ2xhdXNlLnRlcm1pbmFsQXZhaWxhYmxlX2FuZF9vcGVuZWQsXG5cdFx0YWN0aXZlSW5zdGFuY2VUeXBlOiAndmlldycsXG5cdFx0cnVuOiAoaW5zdGFuY2UsIGMpID0+IGMuc2VydmljZS5tb3ZlVG9FZGl0b3IoaW5zdGFuY2UpLFxuXHRcdHJ1bkFmdGVyOiAoaW5zdGFuY2VzKSA9PiBpbnN0YW5jZXMuYXQoLTEpPy5mb2N1cygpXG5cdH0pO1xuXG5cdHJlZ2lzdGVyQ29udGV4dHVhbEluc3RhbmNlQWN0aW9uKHtcblx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuTW92ZUludG9OZXdXaW5kb3csXG5cdFx0dGl0bGU6IHRlcm1pbmFsU3RyaW5ncy5tb3ZlSW50b05ld1dpbmRvdyxcblx0XHRwcmVjb25kaXRpb246IHNoYXJlZFdoZW5DbGF1c2UudGVybWluYWxBdmFpbGFibGVfYW5kX29wZW5lZCxcblx0XHRydW46IChpbnN0YW5jZSwgYykgPT4gYy5zZXJ2aWNlLm1vdmVJbnRvTmV3RWRpdG9yKGluc3RhbmNlKSxcblx0XHRydW5BZnRlcjogKGluc3RhbmNlcykgPT4gaW5zdGFuY2VzLmF0KC0xKT8uZm9jdXMoKVxuXHR9KTtcblxuXHRyZWdpc3RlclRlcm1pbmFsQWN0aW9uKHtcblx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuTW92ZVRvVGVybWluYWxQYW5lbCxcblx0XHR0aXRsZTogdGVybWluYWxTdHJpbmdzLm1vdmVUb1Rlcm1pbmFsUGFuZWwsXG5cdFx0cHJlY29uZGl0aW9uOiBzaGFyZWRXaGVuQ2xhdXNlLnRlcm1pbmFsQXZhaWxhYmxlX2FuZF9lZGl0b3JBY3RpdmUsXG5cdFx0cnVuOiAoYywgXywgYXJncykgPT4ge1xuXHRcdFx0Y29uc3Qgc291cmNlID0gdG9PcHRpb25hbFVyaShhcmdzKSA/PyBjLmVkaXRvclNlcnZpY2UuYWN0aXZlSW5zdGFuY2U7XG5cdFx0XHRpZiAoc291cmNlKSB7XG5cdFx0XHRcdGMuc2VydmljZS5tb3ZlVG9UZXJtaW5hbFZpZXcoc291cmNlKTtcblx0XHRcdH1cblx0XHR9XG5cdH0pO1xuXG5cdHJlZ2lzdGVyVGVybWluYWxBY3Rpb24oe1xuXHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5Gb2N1c1ByZXZpb3VzUGFuZSxcblx0XHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLmZvY3VzUHJldmlvdXNQYW5lJywgJ0ZvY3VzIFByZXZpb3VzIFRlcm1pbmFsIGluIFRlcm1pbmFsIEdyb3VwJyksXG5cdFx0a2V5YmluZGluZzoge1xuXHRcdFx0cHJpbWFyeTogS2V5TW9kLkFsdCB8IEtleUNvZGUuTGVmdEFycm93LFxuXHRcdFx0c2Vjb25kYXJ5OiBbS2V5TW9kLkFsdCB8IEtleUNvZGUuVXBBcnJvd10sXG5cdFx0XHRtYWM6IHtcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkFsdCB8IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5MZWZ0QXJyb3csXG5cdFx0XHRcdHNlY29uZGFyeTogW0tleU1vZC5BbHQgfCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuVXBBcnJvd11cblx0XHRcdH0sXG5cdFx0XHR3aGVuOiBUZXJtaW5hbENvbnRleHRLZXlzLmZvY3VzLFxuXHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWJcblx0XHR9LFxuXHRcdHByZWNvbmRpdGlvbjogc2hhcmVkV2hlbkNsYXVzZS50ZXJtaW5hbEF2YWlsYWJsZSxcblx0XHRydW46IGFzeW5jIChjKSA9PiB7XG5cdFx0XHRjLmdyb3VwU2VydmljZS5hY3RpdmVHcm91cD8uZm9jdXNQcmV2aW91c1BhbmUoKTtcblx0XHRcdGF3YWl0IGMuZ3JvdXBTZXJ2aWNlLnNob3dQYW5lbCh0cnVlKTtcblx0XHR9XG5cdH0pO1xuXG5cdHJlZ2lzdGVyVGVybWluYWxBY3Rpb24oe1xuXHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5Gb2N1c05leHRQYW5lLFxuXHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuZm9jdXNOZXh0UGFuZScsICdGb2N1cyBOZXh0IFRlcm1pbmFsIGluIFRlcm1pbmFsIEdyb3VwJyksXG5cdFx0a2V5YmluZGluZzoge1xuXHRcdFx0cHJpbWFyeTogS2V5TW9kLkFsdCB8IEtleUNvZGUuUmlnaHRBcnJvdyxcblx0XHRcdHNlY29uZGFyeTogW0tleU1vZC5BbHQgfCBLZXlDb2RlLkRvd25BcnJvd10sXG5cdFx0XHRtYWM6IHtcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkFsdCB8IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5SaWdodEFycm93LFxuXHRcdFx0XHRzZWNvbmRhcnk6IFtLZXlNb2QuQWx0IHwgS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkRvd25BcnJvd11cblx0XHRcdH0sXG5cdFx0XHR3aGVuOiBUZXJtaW5hbENvbnRleHRLZXlzLmZvY3VzLFxuXHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWJcblx0XHR9LFxuXHRcdHByZWNvbmRpdGlvbjogc2hhcmVkV2hlbkNsYXVzZS50ZXJtaW5hbEF2YWlsYWJsZSxcblx0XHRydW46IGFzeW5jIChjKSA9PiB7XG5cdFx0XHRjLmdyb3VwU2VydmljZS5hY3RpdmVHcm91cD8uZm9jdXNOZXh0UGFuZSgpO1xuXHRcdFx0YXdhaXQgYy5ncm91cFNlcnZpY2Uuc2hvd1BhbmVsKHRydWUpO1xuXHRcdH1cblx0fSk7XG5cblx0cmVnaXN0ZXJUZXJtaW5hbEFjdGlvbih7XG5cdFx0aWQ6IFRlcm1pbmFsQ29tbWFuZElkLlJlc2l6ZVBhbmVMZWZ0LFxuXHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwucmVzaXplUGFuZUxlZnQnLCAnUmVzaXplIFRlcm1pbmFsIExlZnQnKSxcblx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRsaW51eDogeyBwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuTGVmdEFycm93IH0sXG5cdFx0XHRtYWM6IHsgcHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuV2luQ3RybCB8IEtleUNvZGUuTGVmdEFycm93IH0sXG5cdFx0XHR3aGVuOiBUZXJtaW5hbENvbnRleHRLZXlzLmZvY3VzLFxuXHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWJcblx0XHR9LFxuXHRcdHByZWNvbmRpdGlvbjogc2hhcmVkV2hlbkNsYXVzZS50ZXJtaW5hbEF2YWlsYWJsZSxcblx0XHRydW46IChjKSA9PiBjLmdyb3VwU2VydmljZS5hY3RpdmVHcm91cD8ucmVzaXplUGFuZShEaXJlY3Rpb24uTGVmdClcblx0fSk7XG5cblx0cmVnaXN0ZXJUZXJtaW5hbEFjdGlvbih7XG5cdFx0aWQ6IFRlcm1pbmFsQ29tbWFuZElkLlJlc2l6ZVBhbmVSaWdodCxcblx0XHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnJlc2l6ZVBhbmVSaWdodCcsICdSZXNpemUgVGVybWluYWwgUmlnaHQnKSxcblx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRsaW51eDogeyBwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuUmlnaHRBcnJvdyB9LFxuXHRcdFx0bWFjOiB7IHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLldpbkN0cmwgfCBLZXlDb2RlLlJpZ2h0QXJyb3cgfSxcblx0XHRcdHdoZW46IFRlcm1pbmFsQ29udGV4dEtleXMuZm9jdXMsXG5cdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYlxuXHRcdH0sXG5cdFx0cHJlY29uZGl0aW9uOiBzaGFyZWRXaGVuQ2xhdXNlLnRlcm1pbmFsQXZhaWxhYmxlLFxuXHRcdHJ1bjogKGMpID0+IGMuZ3JvdXBTZXJ2aWNlLmFjdGl2ZUdyb3VwPy5yZXNpemVQYW5lKERpcmVjdGlvbi5SaWdodClcblx0fSk7XG5cblx0cmVnaXN0ZXJUZXJtaW5hbEFjdGlvbih7XG5cdFx0aWQ6IFRlcm1pbmFsQ29tbWFuZElkLlJlc2l6ZVBhbmVVcCxcblx0XHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnJlc2l6ZVBhbmVVcCcsICdSZXNpemUgVGVybWluYWwgVXAnKSxcblx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRtYWM6IHsgcHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuV2luQ3RybCB8IEtleUNvZGUuVXBBcnJvdyB9LFxuXHRcdFx0d2hlbjogVGVybWluYWxDb250ZXh0S2V5cy5mb2N1cyxcblx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliXG5cdFx0fSxcblx0XHRwcmVjb25kaXRpb246IHNoYXJlZFdoZW5DbGF1c2UudGVybWluYWxBdmFpbGFibGUsXG5cdFx0cnVuOiAoYykgPT4gYy5ncm91cFNlcnZpY2UuYWN0aXZlR3JvdXA/LnJlc2l6ZVBhbmUoRGlyZWN0aW9uLlVwKVxuXHR9KTtcblxuXHRyZWdpc3RlclRlcm1pbmFsQWN0aW9uKHtcblx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuUmVzaXplUGFuZURvd24sXG5cdFx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5yZXNpemVQYW5lRG93bicsICdSZXNpemUgVGVybWluYWwgRG93bicpLFxuXHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdG1hYzogeyBwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5XaW5DdHJsIHwgS2V5Q29kZS5Eb3duQXJyb3cgfSxcblx0XHRcdHdoZW46IFRlcm1pbmFsQ29udGV4dEtleXMuZm9jdXMsXG5cdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYlxuXHRcdH0sXG5cdFx0cHJlY29uZGl0aW9uOiBzaGFyZWRXaGVuQ2xhdXNlLnRlcm1pbmFsQXZhaWxhYmxlLFxuXHRcdHJ1bjogKGMpID0+IGMuZ3JvdXBTZXJ2aWNlLmFjdGl2ZUdyb3VwPy5yZXNpemVQYW5lKERpcmVjdGlvbi5Eb3duKVxuXHR9KTtcblxuXHRyZWdpc3RlclRlcm1pbmFsQWN0aW9uKHtcblx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuRm9jdXMsXG5cdFx0dGl0bGU6IHRlcm1pbmFsU3RyaW5ncy5mb2N1cyxcblx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ09OVEVYVF9BQ0NFU1NJQklMSVRZX01PREVfRU5BQkxFRCwgYWNjZXNzaWJsZVZpZXdPbkxhc3RMaW5lLCBhY2Nlc3NpYmxlVmlld0N1cnJlbnRQcm92aWRlcklkLmlzRXF1YWxUbyhBY2Nlc3NpYmxlVmlld1Byb3ZpZGVySWQuVGVybWluYWwpKSxcblx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5Eb3duQXJyb3csXG5cdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYlxuXHRcdH0sXG5cdFx0cHJlY29uZGl0aW9uOiBzaGFyZWRXaGVuQ2xhdXNlLnRlcm1pbmFsQXZhaWxhYmxlLFxuXHRcdHJ1bjogYXN5bmMgKGMpID0+IHtcblx0XHRcdGNvbnN0IGluc3RhbmNlID0gYy5zZXJ2aWNlLmFjdGl2ZUluc3RhbmNlIHx8IGF3YWl0IGMuc2VydmljZS5jcmVhdGVUZXJtaW5hbCh7IGxvY2F0aW9uOiBUZXJtaW5hbExvY2F0aW9uLlBhbmVsIH0pO1xuXHRcdFx0aWYgKCFpbnN0YW5jZSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjLnNlcnZpY2Uuc2V0QWN0aXZlSW5zdGFuY2UoaW5zdGFuY2UpO1xuXHRcdFx0Zm9jdXNBY3RpdmVUZXJtaW5hbChpbnN0YW5jZSwgYyk7XG5cdFx0fVxuXHR9KTtcblxuXHRyZWdpc3RlclRlcm1pbmFsQWN0aW9uKHtcblx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuRm9jdXNUYWJzLFxuXHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuZm9jdXMudGFic1ZpZXcnLCAnRm9jdXMgVGVybWluYWwgVGFicyBWaWV3JyksXG5cdFx0a2V5YmluZGluZzoge1xuXHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkJhY2tzbGFzaCxcblx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIub3IoVGVybWluYWxDb250ZXh0S2V5cy50YWJzRm9jdXMsIFRlcm1pbmFsQ29udGV4dEtleXMuZm9jdXMpLFxuXHRcdH0sXG5cdFx0cHJlY29uZGl0aW9uOiBzaGFyZWRXaGVuQ2xhdXNlLnRlcm1pbmFsQXZhaWxhYmxlLFxuXHRcdHJ1bjogKGMpID0+IGMuZ3JvdXBTZXJ2aWNlLmZvY3VzVGFicygpXG5cdH0pO1xuXG5cdHJlZ2lzdGVyVGVybWluYWxBY3Rpb24oe1xuXHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5Gb2N1c05leHQsXG5cdFx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5mb2N1c05leHQnLCAnRm9jdXMgTmV4dCBUZXJtaW5hbCBHcm91cCcpLFxuXHRcdHByZWNvbmRpdGlvbjogc2hhcmVkV2hlbkNsYXVzZS50ZXJtaW5hbEF2YWlsYWJsZSxcblx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuUGFnZURvd24sXG5cdFx0XHRtYWM6IHtcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkJyYWNrZXRSaWdodFxuXHRcdFx0fSxcblx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChUZXJtaW5hbENvbnRleHRLZXlzLmZvY3VzLCBUZXJtaW5hbENvbnRleHRLZXlzLmVkaXRvckZvY3VzLm5lZ2F0ZSgpKSxcblx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliXG5cdFx0fSxcblx0XHRydW46IGFzeW5jIChjKSA9PiB7XG5cdFx0XHRjLmdyb3VwU2VydmljZS5zZXRBY3RpdmVHcm91cFRvTmV4dCgpO1xuXHRcdFx0YXdhaXQgYy5ncm91cFNlcnZpY2Uuc2hvd1BhbmVsKHRydWUpO1xuXHRcdH1cblx0fSk7XG5cblx0cmVnaXN0ZXJUZXJtaW5hbEFjdGlvbih7XG5cdFx0aWQ6IFRlcm1pbmFsQ29tbWFuZElkLkZvY3VzUHJldmlvdXMsXG5cdFx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5mb2N1c1ByZXZpb3VzJywgJ0ZvY3VzIFByZXZpb3VzIFRlcm1pbmFsIEdyb3VwJyksXG5cdFx0cHJlY29uZGl0aW9uOiBzaGFyZWRXaGVuQ2xhdXNlLnRlcm1pbmFsQXZhaWxhYmxlLFxuXHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5QYWdlVXAsXG5cdFx0XHRtYWM6IHtcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkJyYWNrZXRMZWZ0XG5cdFx0XHR9LFxuXHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFRlcm1pbmFsQ29udGV4dEtleXMuZm9jdXMsIFRlcm1pbmFsQ29udGV4dEtleXMuZWRpdG9yRm9jdXMubmVnYXRlKCkpLFxuXHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWJcblx0XHR9LFxuXHRcdHJ1bjogYXN5bmMgKGMpID0+IHtcblx0XHRcdGMuZ3JvdXBTZXJ2aWNlLnNldEFjdGl2ZUdyb3VwVG9QcmV2aW91cygpO1xuXHRcdFx0YXdhaXQgYy5ncm91cFNlcnZpY2Uuc2hvd1BhbmVsKHRydWUpO1xuXHRcdH1cblx0fSk7XG5cblx0cmVnaXN0ZXJUZXJtaW5hbEFjdGlvbih7XG5cdFx0aWQ6IFRlcm1pbmFsQ29tbWFuZElkLlJ1blNlbGVjdGVkVGV4dCxcblx0XHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnJ1blNlbGVjdGVkVGV4dCcsICdSdW4gU2VsZWN0ZWQgVGV4dCBJbiBBY3RpdmUgVGVybWluYWwnKSxcblx0XHRydW46IGFzeW5jIChjLCBhY2Nlc3NvcikgPT4ge1xuXHRcdFx0Y29uc3QgY29kZUVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvZGVFZGl0b3JTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGVkaXRvciA9IGNvZGVFZGl0b3JTZXJ2aWNlLmdldEFjdGl2ZUNvZGVFZGl0b3IoKTtcblx0XHRcdGlmICghZWRpdG9yIHx8ICFlZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBpbnN0YW5jZSA9IGF3YWl0IGMuc2VydmljZS5nZXRBY3RpdmVPckNyZWF0ZUluc3RhbmNlKHsgYWNjZXB0c0lucHV0OiB0cnVlIH0pO1xuXHRcdFx0Y29uc3Qgc2VsZWN0aW9uID0gZWRpdG9yLmdldFNlbGVjdGlvbigpO1xuXHRcdFx0bGV0IHRleHQ6IHN0cmluZztcblx0XHRcdGlmIChzZWxlY3Rpb24uaXNFbXB0eSgpKSB7XG5cdFx0XHRcdHRleHQgPSBlZGl0b3IuZ2V0TW9kZWwoKS5nZXRMaW5lQ29udGVudChzZWxlY3Rpb24uc2VsZWN0aW9uU3RhcnRMaW5lTnVtYmVyKS50cmltKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBlbmRPZkxpbmVQcmVmZXJlbmNlID0gaXNXaW5kb3dzID8gRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRiA6IEVuZE9mTGluZVByZWZlcmVuY2UuQ1JMRjtcblx0XHRcdFx0dGV4dCA9IGVkaXRvci5nZXRNb2RlbCgpLmdldFZhbHVlSW5SYW5nZShzZWxlY3Rpb24sIGVuZE9mTGluZVByZWZlcmVuY2UpO1xuXHRcdFx0fVxuXHRcdFx0aW5zdGFuY2Uuc2VuZFRleHQodGV4dCwgdHJ1ZSwgdHJ1ZSk7XG5cdFx0XHRhd2FpdCBjLnNlcnZpY2UucmV2ZWFsQWN0aXZlVGVybWluYWwodHJ1ZSk7XG5cdFx0fVxuXHR9KTtcblxuXHRyZWdpc3RlclRlcm1pbmFsQWN0aW9uKHtcblx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuUnVuQWN0aXZlRmlsZSxcblx0XHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnJ1bkFjdGl2ZUZpbGUnLCAnUnVuIEFjdGl2ZSBGaWxlIEluIEFjdGl2ZSBUZXJtaW5hbCcpLFxuXHRcdHByZWNvbmRpdGlvbjogc2hhcmVkV2hlbkNsYXVzZS50ZXJtaW5hbEF2YWlsYWJsZSxcblx0XHRydW46IGFzeW5jIChjLCBhY2Nlc3NvcikgPT4ge1xuXHRcdFx0Y29uc3QgY29kZUVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvZGVFZGl0b3JTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IG5vdGlmaWNhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU5vdGlmaWNhdGlvblNlcnZpY2UpO1xuXHRcdFx0Y29uc3Qgd29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UpO1xuXG5cdFx0XHRjb25zdCBlZGl0b3IgPSBjb2RlRWRpdG9yU2VydmljZS5nZXRBY3RpdmVDb2RlRWRpdG9yKCk7XG5cdFx0XHRpZiAoIWVkaXRvciB8fCAhZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBpbnN0YW5jZSA9IGF3YWl0IGMuc2VydmljZS5nZXRBY3RpdmVPckNyZWF0ZUluc3RhbmNlKHsgYWNjZXB0c0lucHV0OiB0cnVlIH0pO1xuXHRcdFx0Y29uc3QgaXNSZW1vdGUgPSBpbnN0YW5jZSA/IGluc3RhbmNlLmlzUmVtb3RlIDogKHdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZS5yZW1vdGVBdXRob3JpdHkgPyB0cnVlIDogZmFsc2UpO1xuXHRcdFx0Y29uc3QgdXJpID0gZWRpdG9yLmdldE1vZGVsKCkudXJpO1xuXHRcdFx0aWYgKCghaXNSZW1vdGUgJiYgdXJpLnNjaGVtZSAhPT0gU2NoZW1hcy5maWxlICYmIHVyaS5zY2hlbWUgIT09IFNjaGVtYXMudnNjb2RlVXNlckRhdGEpIHx8IChpc1JlbW90ZSAmJiB1cmkuc2NoZW1lICE9PSBTY2hlbWFzLnZzY29kZVJlbW90ZSkpIHtcblx0XHRcdFx0bm90aWZpY2F0aW9uU2VydmljZS53YXJuKGxvY2FsaXplKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnJ1bkFjdGl2ZUZpbGUubm9GaWxlJywgJ09ubHkgZmlsZXMgb24gZGlzayBjYW4gYmUgcnVuIGluIHRoZSB0ZXJtaW5hbCcpKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBUT0RPOiBDb252ZXJ0IHRoaXMgdG8gY3RybCtjLCBjdHJsK3YgZm9yIHB3c2g/XG5cdFx0XHRhd2FpdCBpbnN0YW5jZS5zZW5kUGF0aCh1cmksIHRydWUpO1xuXHRcdFx0cmV0dXJuIGMuZ3JvdXBTZXJ2aWNlLnNob3dQYW5lbCgpO1xuXHRcdH1cblx0fSk7XG5cblx0cmVnaXN0ZXJBY3RpdmVYdGVybUFjdGlvbih7XG5cdFx0aWQ6IFRlcm1pbmFsQ29tbWFuZElkLlNjcm9sbERvd25MaW5lLFxuXHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuc2Nyb2xsRG93bicsICdTY3JvbGwgRG93biAoTGluZSknKSxcblx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5BbHQgfCBLZXlDb2RlLlBhZ2VEb3duLFxuXHRcdFx0bGludXg6IHsgcHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkRvd25BcnJvdyB9LFxuXHRcdFx0d2hlbjogc2hhcmVkV2hlbkNsYXVzZS5mb2N1c0luQW55X2FuZF9ub3JtYWxCdWZmZXIsXG5cdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYlxuXHRcdH0sXG5cdFx0cHJlY29uZGl0aW9uOiBzaGFyZWRXaGVuQ2xhdXNlLnRlcm1pbmFsQXZhaWxhYmxlLFxuXHRcdHJ1bjogKHh0ZXJtKSA9PiB4dGVybS5zY3JvbGxEb3duTGluZSgpXG5cdH0pO1xuXG5cdHJlZ2lzdGVyQWN0aXZlWHRlcm1BY3Rpb24oe1xuXHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5TY3JvbGxEb3duUGFnZSxcblx0XHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnNjcm9sbERvd25QYWdlJywgJ1Njcm9sbCBEb3duIChQYWdlKScpLFxuXHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdHByaW1hcnk6IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuUGFnZURvd24sXG5cdFx0XHRtYWM6IHsgcHJpbWFyeTogS2V5Q29kZS5QYWdlRG93biB9LFxuXHRcdFx0d2hlbjogc2hhcmVkV2hlbkNsYXVzZS5mb2N1c0luQW55X2FuZF9ub3JtYWxCdWZmZXIsXG5cdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYlxuXHRcdH0sXG5cdFx0cHJlY29uZGl0aW9uOiBzaGFyZWRXaGVuQ2xhdXNlLnRlcm1pbmFsQXZhaWxhYmxlLFxuXHRcdHJ1bjogKHh0ZXJtKSA9PiB4dGVybS5zY3JvbGxEb3duUGFnZSgpXG5cdH0pO1xuXG5cdHJlZ2lzdGVyQWN0aXZlWHRlcm1BY3Rpb24oe1xuXHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5TY3JvbGxUb0JvdHRvbSxcblx0XHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnNjcm9sbFRvQm90dG9tJywgJ1Njcm9sbCB0byBCb3R0b20nKSxcblx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRW5kLFxuXHRcdFx0bGludXg6IHsgcHJpbWFyeTogS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5FbmQgfSxcblx0XHRcdHdoZW46IHNoYXJlZFdoZW5DbGF1c2UuZm9jdXNJbkFueV9hbmRfbm9ybWFsQnVmZmVyLFxuXHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWJcblx0XHR9LFxuXHRcdHByZWNvbmRpdGlvbjogc2hhcmVkV2hlbkNsYXVzZS50ZXJtaW5hbEF2YWlsYWJsZSxcblx0XHRydW46ICh4dGVybSkgPT4geHRlcm0uc2Nyb2xsVG9Cb3R0b20oKVxuXHR9KTtcblxuXHRyZWdpc3RlckFjdGl2ZVh0ZXJtQWN0aW9uKHtcblx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuU2Nyb2xsVXBMaW5lLFxuXHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuc2Nyb2xsVXAnLCAnU2Nyb2xsIFVwIChMaW5lKScpLFxuXHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLkFsdCB8IEtleUNvZGUuUGFnZVVwLFxuXHRcdFx0bGludXg6IHsgcHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLlVwQXJyb3cgfSxcblx0XHRcdHdoZW46IHNoYXJlZFdoZW5DbGF1c2UuZm9jdXNJbkFueV9hbmRfbm9ybWFsQnVmZmVyLFxuXHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWJcblx0XHR9LFxuXHRcdHByZWNvbmRpdGlvbjogc2hhcmVkV2hlbkNsYXVzZS50ZXJtaW5hbEF2YWlsYWJsZSxcblx0XHRydW46ICh4dGVybSkgPT4geHRlcm0uc2Nyb2xsVXBMaW5lKClcblx0fSk7XG5cblx0cmVnaXN0ZXJBY3RpdmVYdGVybUFjdGlvbih7XG5cdFx0aWQ6IFRlcm1pbmFsQ29tbWFuZElkLlNjcm9sbFVwUGFnZSxcblx0XHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnNjcm9sbFVwUGFnZScsICdTY3JvbGwgVXAgKFBhZ2UpJyksXG5cdFx0ZjE6IHRydWUsXG5cdFx0a2V5YmluZGluZzoge1xuXHRcdFx0cHJpbWFyeTogS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5QYWdlVXAsXG5cdFx0XHRtYWM6IHsgcHJpbWFyeTogS2V5Q29kZS5QYWdlVXAgfSxcblx0XHRcdHdoZW46IHNoYXJlZFdoZW5DbGF1c2UuZm9jdXNJbkFueV9hbmRfbm9ybWFsQnVmZmVyLFxuXHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWJcblx0XHR9LFxuXHRcdHByZWNvbmRpdGlvbjogc2hhcmVkV2hlbkNsYXVzZS50ZXJtaW5hbEF2YWlsYWJsZSxcblx0XHRydW46ICh4dGVybSkgPT4geHRlcm0uc2Nyb2xsVXBQYWdlKClcblx0fSk7XG5cblx0cmVnaXN0ZXJBY3RpdmVYdGVybUFjdGlvbih7XG5cdFx0aWQ6IFRlcm1pbmFsQ29tbWFuZElkLlNjcm9sbFRvVG9wLFxuXHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuc2Nyb2xsVG9Ub3AnLCAnU2Nyb2xsIHRvIFRvcCcpLFxuXHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5Ib21lLFxuXHRcdFx0bGludXg6IHsgcHJpbWFyeTogS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5Ib21lIH0sXG5cdFx0XHR3aGVuOiBzaGFyZWRXaGVuQ2xhdXNlLmZvY3VzSW5BbnlfYW5kX25vcm1hbEJ1ZmZlcixcblx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliXG5cdFx0fSxcblx0XHRwcmVjb25kaXRpb246IHNoYXJlZFdoZW5DbGF1c2UudGVybWluYWxBdmFpbGFibGUsXG5cdFx0cnVuOiAoeHRlcm0pID0+IHh0ZXJtLnNjcm9sbFRvVG9wKClcblx0fSk7XG5cblx0cmVnaXN0ZXJBY3RpdmVYdGVybUFjdGlvbih7XG5cdFx0aWQ6IFRlcm1pbmFsQ29tbWFuZElkLkNsZWFyU2VsZWN0aW9uLFxuXHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuY2xlYXJTZWxlY3Rpb24nLCAnQ2xlYXIgU2VsZWN0aW9uJyksXG5cdFx0a2V5YmluZGluZzoge1xuXHRcdFx0cHJpbWFyeTogS2V5Q29kZS5Fc2NhcGUsXG5cdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoVGVybWluYWxDb250ZXh0S2V5cy5mb2N1c0luQW55LCBUZXJtaW5hbENvbnRleHRLZXlzLnRleHRTZWxlY3RlZCwgVGVybWluYWxDb250ZXh0S2V5cy5ub3RGaW5kVmlzaWJsZSksXG5cdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYlxuXHRcdH0sXG5cdFx0cHJlY29uZGl0aW9uOiBzaGFyZWRXaGVuQ2xhdXNlLnRlcm1pbmFsQXZhaWxhYmxlLFxuXHRcdHJ1bjogKHh0ZXJtKSA9PiB7XG5cdFx0XHRpZiAoeHRlcm0uaGFzU2VsZWN0aW9uKCkpIHtcblx0XHRcdFx0eHRlcm0uY2xlYXJTZWxlY3Rpb24oKTtcblx0XHRcdH1cblx0XHR9XG5cdH0pO1xuXG5cdHJlZ2lzdGVyVGVybWluYWxBY3Rpb24oe1xuXHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5DaGFuZ2VJY29uLFxuXHRcdHRpdGxlOiB0ZXJtaW5hbFN0cmluZ3MuY2hhbmdlSWNvbixcblx0XHRwcmVjb25kaXRpb246IHNoYXJlZFdoZW5DbGF1c2UudGVybWluYWxBdmFpbGFibGUsXG5cdFx0cnVuOiAoYywgXywgYXJnczogdW5rbm93bikgPT4gZ2V0UmVzb3VyY2VPckFjdGl2ZUluc3RhbmNlKGMsIGFyZ3MpPy5jaGFuZ2VJY29uKClcblx0fSk7XG5cblx0cmVnaXN0ZXJUZXJtaW5hbEFjdGlvbih7XG5cdFx0aWQ6IFRlcm1pbmFsQ29tbWFuZElkLkNoYW5nZUljb25BY3RpdmVUYWIsXG5cdFx0dGl0bGU6IHRlcm1pbmFsU3RyaW5ncy5jaGFuZ2VJY29uLFxuXHRcdGYxOiBmYWxzZSxcblx0XHRwcmVjb25kaXRpb246IHNoYXJlZFdoZW5DbGF1c2UudGVybWluYWxBdmFpbGFibGVfYW5kX3Npbmd1bGFyU2VsZWN0aW9uLFxuXHRcdHJ1bjogYXN5bmMgKGMsIGFjY2Vzc29yLCBhcmdzKSA9PiB7XG5cdFx0XHRsZXQgaWNvbjogVGVybWluYWxJY29uIHwgdW5kZWZpbmVkO1xuXHRcdFx0aWYgKGMuZ3JvdXBTZXJ2aWNlLmxhc3RBY2Nlc3NlZE1lbnUgPT09ICdpbmxpbmUtdGFiJykge1xuXHRcdFx0XHRnZXRSZXNvdXJjZU9yQWN0aXZlSW5zdGFuY2UoYywgYXJncyk/LmNoYW5nZUljb24oKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Zm9yIChjb25zdCB0ZXJtaW5hbCBvZiBnZXRTZWxlY3RlZEluc3RhbmNlcyhhY2Nlc3NvcikgPz8gW10pIHtcblx0XHRcdFx0aWNvbiA9IGF3YWl0IHRlcm1pbmFsLmNoYW5nZUljb24oaWNvbik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcblxuXHRyZWdpc3RlclRlcm1pbmFsQWN0aW9uKHtcblx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuQ2hhbmdlQ29sb3IsXG5cdFx0dGl0bGU6IHRlcm1pbmFsU3RyaW5ncy5jaGFuZ2VDb2xvcixcblx0XHRwcmVjb25kaXRpb246IHNoYXJlZFdoZW5DbGF1c2UudGVybWluYWxBdmFpbGFibGUsXG5cdFx0cnVuOiAoYywgXywgYXJncykgPT4gZ2V0UmVzb3VyY2VPckFjdGl2ZUluc3RhbmNlKGMsIGFyZ3MpPy5jaGFuZ2VDb2xvcigpXG5cdH0pO1xuXG5cdHJlZ2lzdGVyVGVybWluYWxBY3Rpb24oe1xuXHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5DaGFuZ2VDb2xvckFjdGl2ZVRhYixcblx0XHR0aXRsZTogdGVybWluYWxTdHJpbmdzLmNoYW5nZUNvbG9yLFxuXHRcdGYxOiBmYWxzZSxcblx0XHRwcmVjb25kaXRpb246IHNoYXJlZFdoZW5DbGF1c2UudGVybWluYWxBdmFpbGFibGVfYW5kX3Npbmd1bGFyU2VsZWN0aW9uLFxuXHRcdHJ1bjogYXN5bmMgKGMsIGFjY2Vzc29yLCBhcmdzKSA9PiB7XG5cdFx0XHRsZXQgY29sb3I6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRcdGxldCBpID0gMDtcblx0XHRcdGlmIChjLmdyb3VwU2VydmljZS5sYXN0QWNjZXNzZWRNZW51ID09PSAnaW5saW5lLXRhYicpIHtcblx0XHRcdFx0Z2V0UmVzb3VyY2VPckFjdGl2ZUluc3RhbmNlKGMsIGFyZ3MpPy5jaGFuZ2VDb2xvcigpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRmb3IgKGNvbnN0IHRlcm1pbmFsIG9mIGdldFNlbGVjdGVkSW5zdGFuY2VzKGFjY2Vzc29yKSA/PyBbXSkge1xuXHRcdFx0XHRjb25zdCBza2lwUXVpY2tQaWNrID0gaSAhPT0gMDtcblx0XHRcdFx0Ly8gQWx3YXlzIHNob3cgdGhlIHF1aWNrcGljayBvbiB0aGUgZmlyc3QgaXRlcmF0aW9uXG5cdFx0XHRcdGNvbG9yID0gYXdhaXQgdGVybWluYWwuY2hhbmdlQ29sb3IoY29sb3IsIHNraXBRdWlja1BpY2spO1xuXHRcdFx0XHRpKys7XG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcblxuXHRyZWdpc3RlclRlcm1pbmFsQWN0aW9uKHtcblx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuUmVuYW1lLFxuXHRcdHRpdGxlOiB0ZXJtaW5hbFN0cmluZ3MucmVuYW1lLFxuXHRcdHByZWNvbmRpdGlvbjogc2hhcmVkV2hlbkNsYXVzZS50ZXJtaW5hbEF2YWlsYWJsZSxcblx0XHRydW46IChjLCBhY2Nlc3NvciwgYXJncykgPT4gcmVuYW1lV2l0aFF1aWNrUGljayhjLCBhY2Nlc3NvciwgYXJncylcblx0fSk7XG5cblx0cmVnaXN0ZXJUZXJtaW5hbEFjdGlvbih7XG5cdFx0aWQ6IFRlcm1pbmFsQ29tbWFuZElkLlJlbmFtZUFjdGl2ZVRhYixcblx0XHR0aXRsZTogdGVybWluYWxTdHJpbmdzLnJlbmFtZSxcblx0XHRmMTogZmFsc2UsXG5cdFx0a2V5YmluZGluZzoge1xuXHRcdFx0cHJpbWFyeTogS2V5Q29kZS5GMixcblx0XHRcdG1hYzoge1xuXHRcdFx0XHRwcmltYXJ5OiBLZXlDb2RlLkVudGVyXG5cdFx0XHR9LFxuXHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFRlcm1pbmFsQ29udGV4dEtleXMudGFic0ZvY3VzKSxcblx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliXG5cdFx0fSxcblx0XHRwcmVjb25kaXRpb246IHNoYXJlZFdoZW5DbGF1c2UudGVybWluYWxBdmFpbGFibGVfYW5kX3Npbmd1bGFyU2VsZWN0aW9uLFxuXHRcdHJ1bjogYXN5bmMgKGMsIGFjY2Vzc29yKSA9PiB7XG5cdFx0XHRjb25zdCB0ZXJtaW5hbEdyb3VwU2VydmljZSA9IGFjY2Vzc29yLmdldChJVGVybWluYWxHcm91cFNlcnZpY2UpO1xuXHRcdFx0Y29uc3Qgbm90aWZpY2F0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJTm90aWZpY2F0aW9uU2VydmljZSk7XG5cdFx0XHRjb25zdCBpbnN0YW5jZXMgPSBnZXRTZWxlY3RlZEluc3RhbmNlcyhhY2Nlc3Nvcik7XG5cdFx0XHRjb25zdCBmaXJzdEluc3RhbmNlID0gaW5zdGFuY2VzPy5bMF07XG5cdFx0XHRpZiAoIWZpcnN0SW5zdGFuY2UpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGVybWluYWxHcm91cFNlcnZpY2UubGFzdEFjY2Vzc2VkTWVudSA9PT0gJ2lubGluZS10YWInKSB7XG5cdFx0XHRcdHJldHVybiByZW5hbWVXaXRoUXVpY2tQaWNrKGMsIGFjY2Vzc29yLCBmaXJzdEluc3RhbmNlKTtcblx0XHRcdH1cblxuXHRcdFx0Yy5zZXJ2aWNlLnNldEVkaXRpbmdUZXJtaW5hbChmaXJzdEluc3RhbmNlKTtcblx0XHRcdGMuc2VydmljZS5zZXRFZGl0YWJsZShmaXJzdEluc3RhbmNlLCB7XG5cdFx0XHRcdHZhbGlkYXRpb25NZXNzYWdlOiB2YWx1ZSA9PiB2YWxpZGF0ZVRlcm1pbmFsTmFtZSh2YWx1ZSksXG5cdFx0XHRcdG9uRmluaXNoOiBhc3luYyAodmFsdWUsIHN1Y2Nlc3MpID0+IHtcblx0XHRcdFx0XHQvLyBDYW5jZWwgZWRpdGluZyBmaXJzdCBhcyBpbnN0YW5jZS5yZW5hbWUgd2lsbCB0cmlnZ2VyIGEgcmVyZW5kZXIgYXV0b21hdGljYWxseVxuXHRcdFx0XHRcdGMuc2VydmljZS5zZXRFZGl0YWJsZShmaXJzdEluc3RhbmNlLCBudWxsKTtcblx0XHRcdFx0XHRjLnNlcnZpY2Uuc2V0RWRpdGluZ1Rlcm1pbmFsKHVuZGVmaW5lZCk7XG5cdFx0XHRcdFx0aWYgKHN1Y2Nlc3MpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHByb21pc2VzOiBQcm9taXNlPHZvaWQ+W10gPSBbXTtcblx0XHRcdFx0XHRcdGZvciAoY29uc3QgaW5zdGFuY2Ugb2YgaW5zdGFuY2VzKSB7XG5cdFx0XHRcdFx0XHRcdHByb21pc2VzLnB1c2goKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRcdFx0XHRhd2FpdCBpbnN0YW5jZS5yZW5hbWUodmFsdWUpO1xuXHRcdFx0XHRcdFx0XHR9KSgpKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdGF3YWl0IFByb21pc2UuYWxsKHByb21pc2VzKTtcblx0XHRcdFx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0XHRcdFx0bm90aWZpY2F0aW9uU2VydmljZS5lcnJvcihlKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblx0fSk7XG5cblx0cmVnaXN0ZXJBY3RpdmVJbnN0YW5jZUFjdGlvbih7XG5cdFx0aWQ6IFRlcm1pbmFsQ29tbWFuZElkLkRldGFjaFNlc3Npb24sXG5cdFx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5kZXRhY2hTZXNzaW9uJywgJ0RldGFjaCBTZXNzaW9uJyksXG5cdFx0cnVuOiAoYWN0aXZlSW5zdGFuY2UpID0+IGFjdGl2ZUluc3RhbmNlLmRldGFjaFByb2Nlc3NBbmREaXNwb3NlKFRlcm1pbmFsRXhpdFJlYXNvbi5Vc2VyKVxuXHR9KTtcblxuXHRyZWdpc3RlclRlcm1pbmFsQWN0aW9uKHtcblx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuQXR0YWNoVG9TZXNzaW9uLFxuXHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuYXR0YWNoVG9TZXNzaW9uJywgJ0F0dGFjaCB0byBTZXNzaW9uJyksXG5cdFx0cnVuOiBhc3luYyAoYywgYWNjZXNzb3IpID0+IHtcblx0XHRcdGNvbnN0IHF1aWNrSW5wdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElRdWlja0lucHV0U2VydmljZSk7XG5cdFx0XHRjb25zdCBsYWJlbFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxhYmVsU2VydmljZSk7XG5cdFx0XHRjb25zdCByZW1vdGVBZ2VudFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVJlbW90ZUFnZW50U2VydmljZSk7XG5cdFx0XHRjb25zdCBub3RpZmljYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElOb3RpZmljYXRpb25TZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3QgcmVtb3RlQXV0aG9yaXR5ID0gcmVtb3RlQWdlbnRTZXJ2aWNlLmdldENvbm5lY3Rpb24oKT8ucmVtb3RlQXV0aG9yaXR5ID8/IHVuZGVmaW5lZDtcblx0XHRcdGNvbnN0IGJhY2tlbmQgPSBhd2FpdCBhY2Nlc3Nvci5nZXQoSVRlcm1pbmFsSW5zdGFuY2VTZXJ2aWNlKS5nZXRCYWNrZW5kKHJlbW90ZUF1dGhvcml0eSk7XG5cblx0XHRcdGlmICghYmFja2VuZCkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYE5vIGJhY2tlbmQgcmVnaXN0ZXJlZCBmb3IgcmVtb3RlIGF1dGhvcml0eSAnJHtyZW1vdGVBdXRob3JpdHl9J2ApO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB0ZXJtcyA9IGF3YWl0IGJhY2tlbmQubGlzdFByb2Nlc3NlcygpO1xuXG5cdFx0XHRiYWNrZW5kLnJlZHVjZUNvbm5lY3Rpb25HcmFjZVRpbWUoKTtcblxuXHRcdFx0Y29uc3QgdW5hdHRhY2hlZFRlcm1zID0gdGVybXMuZmlsdGVyKHRlcm0gPT4gIWMuc2VydmljZS5pc0F0dGFjaGVkVG9UZXJtaW5hbCh0ZXJtKSk7XG5cdFx0XHRjb25zdCBpdGVtcyA9IHVuYXR0YWNoZWRUZXJtcy5tYXAodGVybSA9PiB7XG5cdFx0XHRcdGNvbnN0IGN3ZExhYmVsID0gbGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKFVSSS5maWxlKHRlcm0uY3dkKSk7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0bGFiZWw6IHRlcm0udGl0bGUsXG5cdFx0XHRcdFx0ZGV0YWlsOiB0ZXJtLndvcmtzcGFjZU5hbWUgPyBgJHt0ZXJtLndvcmtzcGFjZU5hbWV9IFxcdTJFMzEgJHtjd2RMYWJlbH1gIDogY3dkTGFiZWwsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IHRlcm0ucGlkID8gU3RyaW5nKHRlcm0ucGlkKSA6ICcnLFxuXHRcdFx0XHRcdHRlcm1cblx0XHRcdFx0fTtcblx0XHRcdH0pO1xuXHRcdFx0aWYgKGl0ZW1zLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRub3RpZmljYXRpb25TZXJ2aWNlLmluZm8obG9jYWxpemUoJ25vVW5hdHRhY2hlZFRlcm1pbmFscycsICdUaGVyZSBhcmUgbm8gdW5hdHRhY2hlZCB0ZXJtaW5hbHMgdG8gYXR0YWNoIHRvJykpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBzZWxlY3RlZCA9IGF3YWl0IHF1aWNrSW5wdXRTZXJ2aWNlLnBpY2s8SVJlbW90ZVRlcm1pbmFsUGljaz4oaXRlbXMsIHsgY2FuUGlja01hbnk6IGZhbHNlIH0pO1xuXHRcdFx0aWYgKHNlbGVjdGVkKSB7XG5cdFx0XHRcdGNvbnN0IGluc3RhbmNlID0gYXdhaXQgYy5zZXJ2aWNlLmNyZWF0ZVRlcm1pbmFsKHtcblx0XHRcdFx0XHRjb25maWc6IHsgYXR0YWNoUGVyc2lzdGVudFByb2Nlc3M6IHNlbGVjdGVkLnRlcm0gfVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0Yy5zZXJ2aWNlLnNldEFjdGl2ZUluc3RhbmNlKGluc3RhbmNlKTtcblx0XHRcdFx0YXdhaXQgZm9jdXNBY3RpdmVUZXJtaW5hbChpbnN0YW5jZSwgYyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcblxuXHRyZWdpc3RlckFjdGl2ZUluc3RhbmNlQWN0aW9uKHtcblx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuU2Nyb2xsVG9QcmV2aW91c0NvbW1hbmQsXG5cdFx0dGl0bGU6IHRlcm1pbmFsU3RyaW5ncy5zY3JvbGxUb1ByZXZpb3VzQ29tbWFuZCxcblx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuVXBBcnJvdyxcblx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChUZXJtaW5hbENvbnRleHRLZXlzLmZvY3VzLCBDT05URVhUX0FDQ0VTU0lCSUxJVFlfTU9ERV9FTkFCTEVELm5lZ2F0ZSgpKSxcblx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliXG5cdFx0fSxcblx0XHRwcmVjb25kaXRpb246IHNoYXJlZFdoZW5DbGF1c2UudGVybWluYWxBdmFpbGFibGUsXG5cdFx0aWNvbjogQ29kaWNvbi5hcnJvd1VwLFxuXHRcdG1lbnU6IFtcblx0XHRcdHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5WaWV3VGl0bGUsXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdG9yZGVyOiA0LFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXcnLCBURVJNSU5BTF9WSUVXX0lEKSxcblx0XHRcdFx0aXNIaWRkZW5CeURlZmF1bHQ6IHRydWVcblx0XHRcdH1cblx0XHRdLFxuXHRcdHJ1bjogKGFjdGl2ZUluc3RhbmNlKSA9PiBhY3RpdmVJbnN0YW5jZS54dGVybT8ubWFya1RyYWNrZXIuc2Nyb2xsVG9QcmV2aW91c01hcmsodW5kZWZpbmVkLCB1bmRlZmluZWQsIGFjdGl2ZUluc3RhbmNlLmNhcGFiaWxpdGllcy5oYXMoVGVybWluYWxDYXBhYmlsaXR5LkNvbW1hbmREZXRlY3Rpb24pKVxuXHR9KTtcblxuXHRyZWdpc3RlckFjdGl2ZUluc3RhbmNlQWN0aW9uKHtcblx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuU2Nyb2xsVG9OZXh0Q29tbWFuZCxcblx0XHR0aXRsZTogdGVybWluYWxTdHJpbmdzLnNjcm9sbFRvTmV4dENvbW1hbmQsXG5cdFx0a2V5YmluZGluZzoge1xuXHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkRvd25BcnJvdyxcblx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChUZXJtaW5hbENvbnRleHRLZXlzLmZvY3VzLCBDT05URVhUX0FDQ0VTU0lCSUxJVFlfTU9ERV9FTkFCTEVELm5lZ2F0ZSgpKSxcblx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliXG5cdFx0fSxcblx0XHRwcmVjb25kaXRpb246IHNoYXJlZFdoZW5DbGF1c2UudGVybWluYWxBdmFpbGFibGUsXG5cdFx0aWNvbjogQ29kaWNvbi5hcnJvd0Rvd24sXG5cdFx0bWVudTogW1xuXHRcdFx0e1xuXHRcdFx0XHRpZDogTWVudUlkLlZpZXdUaXRsZSxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0b3JkZXI6IDQsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIFRFUk1JTkFMX1ZJRVdfSUQpLFxuXHRcdFx0XHRpc0hpZGRlbkJ5RGVmYXVsdDogdHJ1ZVxuXHRcdFx0fVxuXHRcdF0sXG5cdFx0cnVuOiAoYWN0aXZlSW5zdGFuY2UpID0+IHtcblx0XHRcdGFjdGl2ZUluc3RhbmNlLnh0ZXJtPy5tYXJrVHJhY2tlci5zY3JvbGxUb05leHRNYXJrKCk7XG5cdFx0XHRhY3RpdmVJbnN0YW5jZS5mb2N1cygpO1xuXHRcdH1cblx0fSk7XG5cblx0cmVnaXN0ZXJBY3RpdmVJbnN0YW5jZUFjdGlvbih7XG5cdFx0aWQ6IFRlcm1pbmFsQ29tbWFuZElkLlNlbGVjdFRvUHJldmlvdXNDb21tYW5kLFxuXHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuc2VsZWN0VG9QcmV2aW91c0NvbW1hbmQnLCAnU2VsZWN0IHRvIFByZXZpb3VzIENvbW1hbmQnKSxcblx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuVXBBcnJvdyxcblx0XHRcdHdoZW46IFRlcm1pbmFsQ29udGV4dEtleXMuZm9jdXMsXG5cdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYlxuXHRcdH0sXG5cdFx0cHJlY29uZGl0aW9uOiBzaGFyZWRXaGVuQ2xhdXNlLnRlcm1pbmFsQXZhaWxhYmxlLFxuXHRcdHJ1bjogKGFjdGl2ZUluc3RhbmNlKSA9PiB7XG5cdFx0XHRhY3RpdmVJbnN0YW5jZS54dGVybT8ubWFya1RyYWNrZXIuc2VsZWN0VG9QcmV2aW91c01hcmsoKTtcblx0XHRcdGFjdGl2ZUluc3RhbmNlLmZvY3VzKCk7XG5cdFx0fVxuXHR9KTtcblxuXHRyZWdpc3RlckFjdGl2ZUluc3RhbmNlQWN0aW9uKHtcblx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuU2VsZWN0VG9OZXh0Q29tbWFuZCxcblx0XHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnNlbGVjdFRvTmV4dENvbW1hbmQnLCAnU2VsZWN0IHRvIE5leHQgQ29tbWFuZCcpLFxuXHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5Eb3duQXJyb3csXG5cdFx0XHR3aGVuOiBUZXJtaW5hbENvbnRleHRLZXlzLmZvY3VzLFxuXHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWJcblx0XHR9LFxuXHRcdHByZWNvbmRpdGlvbjogc2hhcmVkV2hlbkNsYXVzZS50ZXJtaW5hbEF2YWlsYWJsZSxcblx0XHRydW46IChhY3RpdmVJbnN0YW5jZSkgPT4ge1xuXHRcdFx0YWN0aXZlSW5zdGFuY2UueHRlcm0/Lm1hcmtUcmFja2VyLnNlbGVjdFRvTmV4dE1hcmsoKTtcblx0XHRcdGFjdGl2ZUluc3RhbmNlLmZvY3VzKCk7XG5cdFx0fVxuXHR9KTtcblxuXHRyZWdpc3RlckFjdGl2ZVh0ZXJtQWN0aW9uKHtcblx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuU2VsZWN0VG9QcmV2aW91c0xpbmUsXG5cdFx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5zZWxlY3RUb1ByZXZpb3VzTGluZScsICdTZWxlY3QgdG8gUHJldmlvdXMgTGluZScpLFxuXHRcdHByZWNvbmRpdGlvbjogc2hhcmVkV2hlbkNsYXVzZS50ZXJtaW5hbEF2YWlsYWJsZSxcblx0XHRydW46IGFzeW5jICh4dGVybSwgXywgaW5zdGFuY2UpID0+IHtcblx0XHRcdHh0ZXJtLm1hcmtUcmFja2VyLnNlbGVjdFRvUHJldmlvdXNMaW5lKCk7XG5cdFx0XHQvLyBwcmVmZXIgdG8gY2FsbCBmb2N1cyBvbiB0aGUgVGVybWluYWxJbnN0YW5jZSBmb3IgYWRkaXRpb25hbCBhY2Nlc3NpYmlsaXR5IHRyaWdnZXJzXG5cdFx0XHQoaW5zdGFuY2UgfHwgeHRlcm0pLmZvY3VzKCk7XG5cdFx0fVxuXHR9KTtcblxuXHRyZWdpc3RlckFjdGl2ZVh0ZXJtQWN0aW9uKHtcblx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuU2VsZWN0VG9OZXh0TGluZSxcblx0XHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnNlbGVjdFRvTmV4dExpbmUnLCAnU2VsZWN0IHRvIE5leHQgTGluZScpLFxuXHRcdHByZWNvbmRpdGlvbjogc2hhcmVkV2hlbkNsYXVzZS50ZXJtaW5hbEF2YWlsYWJsZSxcblx0XHRydW46IGFzeW5jICh4dGVybSwgXywgaW5zdGFuY2UpID0+IHtcblx0XHRcdHh0ZXJtLm1hcmtUcmFja2VyLnNlbGVjdFRvTmV4dExpbmUoKTtcblx0XHRcdC8vIHByZWZlciB0byBjYWxsIGZvY3VzIG9uIHRoZSBUZXJtaW5hbEluc3RhbmNlIGZvciBhZGRpdGlvbmFsIGFjY2Vzc2liaWxpdHkgdHJpZ2dlcnNcblx0XHRcdChpbnN0YW5jZSB8fCB4dGVybSkuZm9jdXMoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHJlZ2lzdGVyVGVybWluYWxBY3Rpb24oe1xuXHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5TZW5kU2VxdWVuY2UsXG5cdFx0dGl0bGU6IHRlcm1pbmFsU3RyaW5ncy5zZW5kU2VxdWVuY2UsXG5cdFx0ZjE6IGZhbHNlLFxuXHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogdGVybWluYWxTdHJpbmdzLnNlbmRTZXF1ZW5jZS52YWx1ZSxcblx0XHRcdGFyZ3M6IFt7XG5cdFx0XHRcdG5hbWU6ICdhcmdzJyxcblx0XHRcdFx0c2NoZW1hOiB7XG5cdFx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdFx0cmVxdWlyZWQ6IFsndGV4dCddLFxuXHRcdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdHRleHQ6IHtcblx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdzZW5kU2VxdWVuY2UnLCBcIlRoZSBzZXF1ZW5jZSBvZiB0ZXh0IHRvIHNlbmQgdG8gdGhlIHRlcm1pbmFsXCIpLFxuXHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH1cblx0XHRcdH1dXG5cdFx0fSxcblx0XHRydW46IChjLCBhY2Nlc3NvciwgYXJncykgPT4gdGVybWluYWxTZW5kU2VxdWVuY2VDb21tYW5kKGFjY2Vzc29yLCBhcmdzKVxuXHR9KTtcblxuXHRyZWdpc3RlclRlcm1pbmFsQWN0aW9uKHtcblx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuTmV3V2l0aEN3ZCxcblx0XHR0aXRsZTogdGVybWluYWxTdHJpbmdzLm5ld1dpdGhDd2QsXG5cdFx0bWV0YWRhdGE6IHtcblx0XHRcdGRlc2NyaXB0aW9uOiB0ZXJtaW5hbFN0cmluZ3MubmV3V2l0aEN3ZC52YWx1ZSxcblx0XHRcdGFyZ3M6IFt7XG5cdFx0XHRcdG5hbWU6ICdhcmdzJyxcblx0XHRcdFx0c2NoZW1hOiB7XG5cdFx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdFx0cmVxdWlyZWQ6IFsnY3dkJ10sXG5cdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0Y3dkOiB7XG5cdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5uZXdXaXRoQ3dkLmN3ZCcsIFwiVGhlIGRpcmVjdG9yeSB0byBzdGFydCB0aGUgdGVybWluYWwgYXRcIiksXG5cdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fVxuXHRcdFx0fV1cblx0XHR9LFxuXHRcdHJ1bjogYXN5bmMgKGMsIF8sIGFyZ3MpID0+IHtcblx0XHRcdGNvbnN0IGN3ZCA9IGlzT2JqZWN0KGFyZ3MpICYmICdjd2QnIGluIGFyZ3MgPyB0b09wdGlvbmFsU3RyaW5nKGFyZ3MuY3dkKSA6IHVuZGVmaW5lZDtcblx0XHRcdGNvbnN0IGluc3RhbmNlID0gYXdhaXQgYy5zZXJ2aWNlLmNyZWF0ZVRlcm1pbmFsKHsgY3dkIH0pO1xuXHRcdFx0aWYgKCFpbnN0YW5jZSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjLnNlcnZpY2Uuc2V0QWN0aXZlSW5zdGFuY2UoaW5zdGFuY2UpO1xuXHRcdFx0YXdhaXQgZm9jdXNBY3RpdmVUZXJtaW5hbChpbnN0YW5jZSwgYyk7XG5cdFx0fVxuXHR9KTtcblxuXHRyZWdpc3RlckFjdGl2ZUluc3RhbmNlQWN0aW9uKHtcblx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuUmVuYW1lV2l0aEFyZ3MsXG5cdFx0dGl0bGU6IHRlcm1pbmFsU3RyaW5ncy5yZW5hbWVXaXRoQXJncyxcblx0XHRtZXRhZGF0YToge1xuXHRcdFx0ZGVzY3JpcHRpb246IHRlcm1pbmFsU3RyaW5ncy5yZW5hbWVXaXRoQXJncy52YWx1ZSxcblx0XHRcdGFyZ3M6IFt7XG5cdFx0XHRcdG5hbWU6ICdhcmdzJyxcblx0XHRcdFx0c2NoZW1hOiB7XG5cdFx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdFx0cmVxdWlyZWQ6IFsnbmFtZSddLFxuXHRcdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdG5hbWU6IHtcblx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnJlbmFtZVdpdGhBcmcubmFtZScsIFwiVGhlIG5ldyBuYW1lIGZvciB0aGUgdGVybWluYWxcIiksXG5cdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRtaW5MZW5ndGg6IDFcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1dXG5cdFx0fSxcblx0XHRwcmVjb25kaXRpb246IHNoYXJlZFdoZW5DbGF1c2UudGVybWluYWxBdmFpbGFibGUsXG5cdFx0cnVuOiBhc3luYyAoYWN0aXZlSW5zdGFuY2UsIGMsIGFjY2Vzc29yLCBhcmdzKSA9PiB7XG5cdFx0XHRjb25zdCBub3RpZmljYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElOb3RpZmljYXRpb25TZXJ2aWNlKTtcblx0XHRcdGNvbnN0IG5hbWUgPSBpc09iamVjdChhcmdzKSAmJiAnbmFtZScgaW4gYXJncyA/IHRvT3B0aW9uYWxTdHJpbmcoYXJncy5uYW1lKSA6IHVuZGVmaW5lZDtcblx0XHRcdGlmICghbmFtZSkge1xuXHRcdFx0XHRub3RpZmljYXRpb25TZXJ2aWNlLndhcm4obG9jYWxpemUoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwucmVuYW1lV2l0aEFyZy5ub05hbWUnLCBcIk5vIG5hbWUgYXJndW1lbnQgcHJvdmlkZWRcIikpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRhY3RpdmVJbnN0YW5jZS5yZW5hbWUobmFtZSk7XG5cdFx0fVxuXHR9KTtcblxuXHRyZWdpc3RlckFjdGl2ZUluc3RhbmNlQWN0aW9uKHtcblx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuUmVsYXVuY2gsXG5cdFx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5yZWxhdW5jaCcsICdSZWxhdW5jaCBBY3RpdmUgVGVybWluYWwnKSxcblx0XHRydW46IChhY3RpdmVJbnN0YW5jZSkgPT4gYWN0aXZlSW5zdGFuY2UucmVsYXVuY2goKVxuXHR9KTtcblxuXHRyZWdpc3RlclRlcm1pbmFsQWN0aW9uKHtcblx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuU3BsaXQsXG5cdFx0dGl0bGU6IHRlcm1pbmFsU3RyaW5ncy5zcGxpdCxcblx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLm9yKFRlcm1pbmFsQ29udGV4dEtleXMucHJvY2Vzc1N1cHBvcnRlZCwgVGVybWluYWxDb250ZXh0S2V5cy53ZWJFeHRlbnNpb25Db250cmlidXRlZFByb2ZpbGUpLFxuXHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5EaWdpdDUsXG5cdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdG1hYzoge1xuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuQmFja3NsYXNoLFxuXHRcdFx0XHRzZWNvbmRhcnk6IFtLZXlNb2QuV2luQ3RybCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuRGlnaXQ1XVxuXHRcdFx0fSxcblx0XHRcdHdoZW46IFRlcm1pbmFsQ29udGV4dEtleXMuZm9jdXNcblx0XHR9LFxuXHRcdGljb246IENvZGljb24uc3BsaXRIb3Jpem9udGFsLFxuXHRcdHJ1bjogYXN5bmMgKGMsIGFjY2Vzc29yLCBhcmdzKSA9PiB7XG5cdFx0XHRjb25zdCBvcHRpb25zT3JQcm9maWxlID0gaXNPYmplY3QoYXJncykgPyBhcmdzIGFzIElDcmVhdGVUZXJtaW5hbE9wdGlvbnMgfCBJVGVybWluYWxQcm9maWxlIDogdW5kZWZpbmVkO1xuXHRcdFx0Y29uc3QgY29tbWFuZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbW1hbmRTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSk7XG5cdFx0XHRjb25zdCBvcHRpb25zID0gY29udmVydE9wdGlvbnNPclByb2ZpbGVUb09wdGlvbnMob3B0aW9uc09yUHJvZmlsZSk7XG5cdFx0XHRjb25zdCBhY3RpdmVJbnN0YW5jZSA9IChhd2FpdCBjLnNlcnZpY2UuZ2V0SW5zdGFuY2VIb3N0KG9wdGlvbnM/LmxvY2F0aW9uKSkuYWN0aXZlSW5zdGFuY2U7XG5cdFx0XHRpZiAoIWFjdGl2ZUluc3RhbmNlKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGN3ZCA9IGF3YWl0IGdldEN3ZEZvclNwbGl0KGFjdGl2ZUluc3RhbmNlLCB3b3Jrc3BhY2VDb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKS5mb2xkZXJzLCBjb21tYW5kU2VydmljZSwgYy5jb25maWdTZXJ2aWNlKTtcblx0XHRcdGlmIChjd2QgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBpbnN0YW5jZSA9IGF3YWl0IGMuc2VydmljZS5jcmVhdGVUZXJtaW5hbCh7IGxvY2F0aW9uOiB7IHBhcmVudFRlcm1pbmFsOiBhY3RpdmVJbnN0YW5jZSB9LCBjb25maWc6IG9wdGlvbnM/LmNvbmZpZywgY3dkIH0pO1xuXHRcdFx0YXdhaXQgZm9jdXNBY3RpdmVUZXJtaW5hbChpbnN0YW5jZSwgYyk7XG5cdFx0fVxuXHR9KTtcblxuXHRyZWdpc3RlclRlcm1pbmFsQWN0aW9uKHtcblx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuU3BsaXRBY3RpdmVUYWIsXG5cdFx0dGl0bGU6IHRlcm1pbmFsU3RyaW5ncy5zcGxpdCxcblx0XHRmMTogZmFsc2UsXG5cdFx0a2V5YmluZGluZzoge1xuXHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkRpZ2l0NSxcblx0XHRcdG1hYzoge1xuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuQmFja3NsYXNoLFxuXHRcdFx0XHRzZWNvbmRhcnk6IFtLZXlNb2QuV2luQ3RybCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuRGlnaXQ1XVxuXHRcdFx0fSxcblx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0d2hlbjogVGVybWluYWxDb250ZXh0S2V5cy50YWJzRm9jdXNcblx0XHR9LFxuXHRcdHJ1bjogYXN5bmMgKGMsIGFjY2Vzc29yKSA9PiB7XG5cdFx0XHRjb25zdCBpbnN0YW5jZXMgPSBnZXRTZWxlY3RlZEluc3RhbmNlcyhhY2Nlc3Nvcik7XG5cdFx0XHRpZiAoaW5zdGFuY2VzKSB7XG5cdFx0XHRcdGNvbnN0IHByb21pc2VzOiBQcm9taXNlPHZvaWQ+W10gPSBbXTtcblx0XHRcdFx0Zm9yIChjb25zdCB0IG9mIGluc3RhbmNlcykge1xuXHRcdFx0XHRcdHByb21pc2VzLnB1c2goKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRcdGF3YWl0IGMuc2VydmljZS5jcmVhdGVUZXJtaW5hbCh7IGxvY2F0aW9uOiB7IHBhcmVudFRlcm1pbmFsOiB0IH0gfSk7XG5cdFx0XHRcdFx0XHRhd2FpdCBjLmdyb3VwU2VydmljZS5zaG93UGFuZWwodHJ1ZSk7XG5cdFx0XHRcdFx0fSkoKSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG5cblx0cmVnaXN0ZXJDb250ZXh0dWFsSW5zdGFuY2VBY3Rpb24oe1xuXHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5VbnNwbGl0LFxuXHRcdHRpdGxlOiB0ZXJtaW5hbFN0cmluZ3MudW5zcGxpdCxcblx0XHRwcmVjb25kaXRpb246IHNoYXJlZFdoZW5DbGF1c2UudGVybWluYWxBdmFpbGFibGUsXG5cdFx0cnVuOiBhc3luYyAoaW5zdGFuY2UsIGMpID0+IHtcblx0XHRcdGNvbnN0IGdyb3VwID0gYy5ncm91cFNlcnZpY2UuZ2V0R3JvdXBGb3JJbnN0YW5jZShpbnN0YW5jZSk7XG5cdFx0XHRpZiAoZ3JvdXAgJiYgZ3JvdXA/LnRlcm1pbmFsSW5zdGFuY2VzLmxlbmd0aCA+IDEpIHtcblx0XHRcdFx0Yy5ncm91cFNlcnZpY2UudW5zcGxpdEluc3RhbmNlKGluc3RhbmNlKTtcblx0XHRcdH1cblx0XHR9XG5cdH0pO1xuXG5cdHJlZ2lzdGVyVGVybWluYWxBY3Rpb24oe1xuXHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5Kb2luQWN0aXZlVGFiLFxuXHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuam9pbkluc3RhbmNlJywgJ0pvaW4gVGVybWluYWxzJyksXG5cdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoc2hhcmVkV2hlbkNsYXVzZS50ZXJtaW5hbEF2YWlsYWJsZSwgVGVybWluYWxDb250ZXh0S2V5cy50YWJzU2luZ3VsYXJTZWxlY3Rpb24udG9OZWdhdGVkKCkpLFxuXHRcdHJ1bjogYXN5bmMgKGMsIGFjY2Vzc29yKSA9PiB7XG5cdFx0XHRjb25zdCBpbnN0YW5jZXMgPSBnZXRTZWxlY3RlZEluc3RhbmNlcyhhY2Nlc3Nvcik7XG5cdFx0XHRpZiAoaW5zdGFuY2VzICYmIGluc3RhbmNlcy5sZW5ndGggPiAxKSB7XG5cdFx0XHRcdGMuZ3JvdXBTZXJ2aWNlLmpvaW5JbnN0YW5jZXMoaW5zdGFuY2VzKTtcblx0XHRcdH1cblx0XHR9XG5cdH0pO1xuXG5cdHJlZ2lzdGVyVGVybWluYWxBY3Rpb24oe1xuXHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5Kb2luLFxuXHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuam9pbicsICdKb2luIFRlcm1pbmFscy4uLicpLFxuXHRcdHByZWNvbmRpdGlvbjogc2hhcmVkV2hlbkNsYXVzZS50ZXJtaW5hbEF2YWlsYWJsZSxcblx0XHRydW46IGFzeW5jIChjLCBhY2Nlc3NvcikgPT4ge1xuXHRcdFx0Y29uc3QgdGhlbWVTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElUaGVtZVNlcnZpY2UpO1xuXHRcdFx0Y29uc3Qgbm90aWZpY2F0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJTm90aWZpY2F0aW9uU2VydmljZSk7XG5cdFx0XHRjb25zdCBxdWlja0lucHV0U2VydmljZSA9IGFjY2Vzc29yLmdldChJUXVpY2tJbnB1dFNlcnZpY2UpO1xuXG5cdFx0XHRjb25zdCBwaWNrczogSVRlcm1pbmFsUXVpY2tQaWNrSXRlbVtdID0gW107XG5cdFx0XHRpZiAoYy5ncm91cFNlcnZpY2UuaW5zdGFuY2VzLmxlbmd0aCA8PSAxKSB7XG5cdFx0XHRcdG5vdGlmaWNhdGlvblNlcnZpY2Uud2Fybihsb2NhbGl6ZSgnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5qb2luLmluc3VmZmljaWVudFRlcm1pbmFscycsICdJbnN1ZmZpY2llbnQgdGVybWluYWxzIGZvciB0aGUgam9pbiBhY3Rpb24nKSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IG90aGVySW5zdGFuY2VzID0gYy5ncm91cFNlcnZpY2UuaW5zdGFuY2VzLmZpbHRlcihpID0+IGkuaW5zdGFuY2VJZCAhPT0gYy5ncm91cFNlcnZpY2UuYWN0aXZlSW5zdGFuY2U/Lmluc3RhbmNlSWQpO1xuXHRcdFx0Zm9yIChjb25zdCB0ZXJtaW5hbCBvZiBvdGhlckluc3RhbmNlcykge1xuXHRcdFx0XHRjb25zdCBncm91cCA9IGMuZ3JvdXBTZXJ2aWNlLmdldEdyb3VwRm9ySW5zdGFuY2UodGVybWluYWwpO1xuXHRcdFx0XHRpZiAoZ3JvdXA/LnRlcm1pbmFsSW5zdGFuY2VzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0XHRcdGNvbnN0IGljb25JZCA9IGdldEljb25JZChhY2Nlc3NvciwgdGVybWluYWwpO1xuXHRcdFx0XHRcdGNvbnN0IGxhYmVsID0gYCQoJHtpY29uSWR9KTogJHt0ZXJtaW5hbC50aXRsZX1gO1xuXHRcdFx0XHRcdGNvbnN0IGljb25DbGFzc2VzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdFx0XHRcdGNvbnN0IGNvbG9yQ2xhc3MgPSBnZXRDb2xvckNsYXNzKHRlcm1pbmFsKTtcblx0XHRcdFx0XHRpZiAoY29sb3JDbGFzcykge1xuXHRcdFx0XHRcdFx0aWNvbkNsYXNzZXMucHVzaChjb2xvckNsYXNzKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29uc3QgdXJpQ2xhc3NlcyA9IGdldFVyaUNsYXNzZXModGVybWluYWwsIHRoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCkudHlwZSk7XG5cdFx0XHRcdFx0aWYgKHVyaUNsYXNzZXMpIHtcblx0XHRcdFx0XHRcdGljb25DbGFzc2VzLnB1c2goLi4udXJpQ2xhc3Nlcyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHBpY2tzLnB1c2goe1xuXHRcdFx0XHRcdFx0dGVybWluYWwsXG5cdFx0XHRcdFx0XHRsYWJlbCxcblx0XHRcdFx0XHRcdGljb25DbGFzc2VzXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChwaWNrcy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0bm90aWZpY2F0aW9uU2VydmljZS53YXJuKGxvY2FsaXplKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLmpvaW4ub25seVNwbGl0cycsICdBbGwgdGVybWluYWxzIGFyZSBqb2luZWQgYWxyZWFkeScpKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgcXVpY2tJbnB1dFNlcnZpY2UucGljayhwaWNrcywge30pO1xuXHRcdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0XHRjLmdyb3VwU2VydmljZS5qb2luSW5zdGFuY2VzKFtyZXN1bHQudGVybWluYWwsIGMuZ3JvdXBTZXJ2aWNlLmFjdGl2ZUluc3RhbmNlIV0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG5cblx0cmVnaXN0ZXJBY3RpdmVJbnN0YW5jZUFjdGlvbih7XG5cdFx0aWQ6IFRlcm1pbmFsQ29tbWFuZElkLlNwbGl0SW5BY3RpdmVXb3Jrc3BhY2UsXG5cdFx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5zcGxpdEluQWN0aXZlV29ya3NwYWNlJywgJ1NwbGl0IFRlcm1pbmFsIChJbiBBY3RpdmUgV29ya3NwYWNlKScpLFxuXHRcdHJ1bjogYXN5bmMgKGluc3RhbmNlLCBjKSA9PiB7XG5cdFx0XHRjb25zdCBuZXdJbnN0YW5jZSA9IGF3YWl0IGMuc2VydmljZS5jcmVhdGVUZXJtaW5hbCh7IGxvY2F0aW9uOiB7IHBhcmVudFRlcm1pbmFsOiBpbnN0YW5jZSB9IH0pO1xuXHRcdFx0aWYgKG5ld0luc3RhbmNlPy50YXJnZXQgIT09IFRlcm1pbmFsTG9jYXRpb24uRWRpdG9yKSB7XG5cdFx0XHRcdGF3YWl0IGMuZ3JvdXBTZXJ2aWNlLnNob3dQYW5lbCh0cnVlKTtcblx0XHRcdH1cblx0XHR9XG5cdH0pO1xuXG5cdHJlZ2lzdGVyQWN0aXZlWHRlcm1BY3Rpb24oe1xuXHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5TZWxlY3RBbGwsXG5cdFx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5zZWxlY3RBbGwnLCAnU2VsZWN0IEFsbCcpLFxuXHRcdHByZWNvbmRpdGlvbjogc2hhcmVkV2hlbkNsYXVzZS50ZXJtaW5hbEF2YWlsYWJsZSxcblx0XHRrZXliaW5kaW5nOiBbe1xuXHRcdFx0Ly8gRG9uJ3QgdXNlIGN0cmwrYSBieSBkZWZhdWx0IGFzIHRoYXQgd291bGQgb3ZlcnJpZGUgdGhlIGNvbW1vbiBnbyB0byBzdGFydFxuXHRcdFx0Ly8gb2YgcHJvbXB0IHNoZWxsIGJpbmRpbmdcblx0XHRcdHByaW1hcnk6IDAsXG5cdFx0XHQvLyBUZWNobmljYWxseSB0aGlzIGRvZXNuJ3QgbmVlZCB0byBiZSBoZXJlIGFzIGl0IHdpbGwgZmFsbCBiYWNrIHRvIHRoaXNcblx0XHRcdC8vIGJlaGF2aW9yIGFueXdheSB3aGVuIGhhbmRlZCB0byB4dGVybS5qcywgaGF2aW5nIHRoaXMgaGFuZGxlZCBieSBWUyBDb2RlXG5cdFx0XHQvLyBtYWtlcyBpdCBlYXNpZXIgZm9yIHVzZXJzIHRvIHNlZSBob3cgaXQgd29ya3MgdGhvdWdoLlxuXHRcdFx0bWFjOiB7IHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlBIH0sXG5cdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdHdoZW46IFRlcm1pbmFsQ29udGV4dEtleXMuZm9jdXNJbkFueVxuXHRcdH1dLFxuXHRcdHJ1bjogKHh0ZXJtKSA9PiB4dGVybS5zZWxlY3RBbGwoKVxuXHR9KTtcblxuXHRyZWdpc3RlclRlcm1pbmFsQWN0aW9uKHtcblx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuTmV3LFxuXHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwubmV3JywgJ0NyZWF0ZSBOZXcgVGVybWluYWwnKSxcblx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLm9yKFRlcm1pbmFsQ29udGV4dEtleXMucHJvY2Vzc1N1cHBvcnRlZCwgVGVybWluYWxDb250ZXh0S2V5cy53ZWJFeHRlbnNpb25Db250cmlidXRlZFByb2ZpbGUpLFxuXHRcdGljb246IG5ld1Rlcm1pbmFsSWNvbixcblx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuQmFja3F1b3RlLFxuXHRcdFx0bWFjOiB7IHByaW1hcnk6IEtleU1vZC5XaW5DdHJsIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5CYWNrcXVvdGUgfSxcblx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliXG5cdFx0fSxcblx0XHRydW46IGFzeW5jIChjLCBhY2Nlc3NvciwgYXJncykgPT4ge1xuXHRcdFx0bGV0IGV2ZW50T3JPcHRpb25zID0gaXNPYmplY3QoYXJncykgPyBhcmdzIGFzIE1vdXNlRXZlbnQgfCBJQ3JlYXRlVGVybWluYWxPcHRpb25zIDogdW5kZWZpbmVkO1xuXHRcdFx0Y29uc3Qgd29ya3NwYWNlQ29udGV4dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGNvbW1hbmRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb21tYW5kU2VydmljZSk7XG5cdFx0XHRjb25zdCBmb2xkZXJzID0gd29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVycztcblx0XHRcdGlmIChldmVudE9yT3B0aW9ucyAmJiBpc01vdXNlRXZlbnQoZXZlbnRPck9wdGlvbnMpICYmIChldmVudE9yT3B0aW9ucy5hbHRLZXkgfHwgZXZlbnRPck9wdGlvbnMuY3RybEtleSkpIHtcblx0XHRcdFx0YXdhaXQgYy5zZXJ2aWNlLmNyZWF0ZVRlcm1pbmFsKHsgbG9jYXRpb246IHsgc3BsaXRBY3RpdmVUZXJtaW5hbDogdHJ1ZSB9IH0pO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmIChjLnNlcnZpY2UuaXNQcm9jZXNzU3VwcG9ydFJlZ2lzdGVyZWQpIHtcblx0XHRcdFx0ZXZlbnRPck9wdGlvbnMgPSAhZXZlbnRPck9wdGlvbnMgfHwgaXNNb3VzZUV2ZW50KGV2ZW50T3JPcHRpb25zKSA/IHt9IDogZXZlbnRPck9wdGlvbnM7XG5cblx0XHRcdFx0bGV0IGluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSB8IHVuZGVmaW5lZDtcblx0XHRcdFx0aWYgKGZvbGRlcnMubGVuZ3RoIDw9IDEpIHtcblx0XHRcdFx0XHQvLyBBbGxvdyB0ZXJtaW5hbCBzZXJ2aWNlIHRvIGhhbmRsZSB0aGUgcGF0aCB3aGVuIHRoZXJlIGlzIG9ubHkgYVxuXHRcdFx0XHRcdC8vIHNpbmdsZSByb290XG5cdFx0XHRcdFx0aW5zdGFuY2UgPSBhd2FpdCBjLnNlcnZpY2UuY3JlYXRlVGVybWluYWwoZXZlbnRPck9wdGlvbnMpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IGN3ZCA9IChhd2FpdCBwaWNrVGVybWluYWxDd2QoYWNjZXNzb3IpKT8uY3dkO1xuXHRcdFx0XHRcdGlmICghY3dkKSB7XG5cdFx0XHRcdFx0XHQvLyBEb24ndCBjcmVhdGUgdGhlIGluc3RhbmNlIGlmIHRoZSB3b3Jrc3BhY2UgcGlja2VyIHdhcyBjYW5jZWxlZFxuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRldmVudE9yT3B0aW9ucy5jd2QgPSBjd2Q7XG5cdFx0XHRcdFx0aW5zdGFuY2UgPSBhd2FpdCBjLnNlcnZpY2UuY3JlYXRlVGVybWluYWwoZXZlbnRPck9wdGlvbnMpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGMuc2VydmljZS5zZXRBY3RpdmVJbnN0YW5jZShpbnN0YW5jZSk7XG5cdFx0XHRcdGF3YWl0IGZvY3VzQWN0aXZlVGVybWluYWwoaW5zdGFuY2UsIGMpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKGMucHJvZmlsZVNlcnZpY2UuY29udHJpYnV0ZWRQcm9maWxlcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0Y29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoVGVybWluYWxDb21tYW5kSWQuTmV3V2l0aFByb2ZpbGUpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKFRlcm1pbmFsQ29tbWFuZElkLlRvZ2dsZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH0pO1xuXG5cdGFzeW5jIGZ1bmN0aW9uIGtpbGxJbnN0YW5jZShjOiBJVGVybWluYWxTZXJ2aWNlc0NvbGxlY3Rpb24sIGluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSB8IHVuZGVmaW5lZCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghaW5zdGFuY2UpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0YXdhaXQgYy5zZXJ2aWNlLnNhZmVEaXNwb3NlVGVybWluYWwoaW5zdGFuY2UpO1xuXHRcdGlmIChjLmdyb3VwU2VydmljZS5pbnN0YW5jZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0YXdhaXQgYy5ncm91cFNlcnZpY2Uuc2hvd1BhbmVsKHRydWUpO1xuXHRcdH1cblx0fVxuXHRyZWdpc3RlclRlcm1pbmFsQWN0aW9uKHtcblx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuS2lsbCxcblx0XHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLmtpbGwnLCAnS2lsbCB0aGUgQWN0aXZlIFRlcm1pbmFsIEluc3RhbmNlJyksXG5cdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5vcihzaGFyZWRXaGVuQ2xhdXNlLnRlcm1pbmFsQXZhaWxhYmxlLCBUZXJtaW5hbENvbnRleHRLZXlzLmlzT3BlbiksXG5cdFx0aWNvbjoga2lsbFRlcm1pbmFsSWNvbixcblx0XHRydW46IGFzeW5jIChjKSA9PiBraWxsSW5zdGFuY2UoYywgYy5ncm91cFNlcnZpY2UuYWN0aXZlSW5zdGFuY2UpXG5cdH0pO1xuXHRyZWdpc3RlclRlcm1pbmFsQWN0aW9uKHtcblx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuS2lsbFZpZXdPckVkaXRvcixcblx0XHR0aXRsZTogdGVybWluYWxTdHJpbmdzLmtpbGwsXG5cdFx0ZjE6IGZhbHNlLCAvLyBUaGlzIGlzIGFuIGludGVybmFsIGNvbW1hbmQgdXNlZCBmb3IgY29udGV4dCBtZW51c1xuXHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIub3Ioc2hhcmVkV2hlbkNsYXVzZS50ZXJtaW5hbEF2YWlsYWJsZSwgVGVybWluYWxDb250ZXh0S2V5cy5pc09wZW4pLFxuXHRcdHJ1bjogYXN5bmMgKGMpID0+IGtpbGxJbnN0YW5jZShjLCBjLnNlcnZpY2UuYWN0aXZlSW5zdGFuY2UpXG5cdH0pO1xuXG5cdHJlZ2lzdGVyVGVybWluYWxBY3Rpb24oe1xuXHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5LaWxsQWxsLFxuXHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwua2lsbEFsbCcsICdLaWxsIEFsbCBUZXJtaW5hbHMnKSxcblx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLm9yKHNoYXJlZFdoZW5DbGF1c2UudGVybWluYWxBdmFpbGFibGUsIFRlcm1pbmFsQ29udGV4dEtleXMuaXNPcGVuKSxcblx0XHRpY29uOiBDb2RpY29uLnRyYXNoLFxuXHRcdHJ1bjogYXN5bmMgKGMpID0+IHtcblx0XHRcdGNvbnN0IGRpc3Bvc2VQcm9taXNlczogUHJvbWlzZTx2b2lkPltdID0gW107XG5cdFx0XHRmb3IgKGNvbnN0IGluc3RhbmNlIG9mIGMuc2VydmljZS5pbnN0YW5jZXMpIHtcblx0XHRcdFx0ZGlzcG9zZVByb21pc2VzLnB1c2goYy5zZXJ2aWNlLnNhZmVEaXNwb3NlVGVybWluYWwoaW5zdGFuY2UpKTtcblx0XHRcdH1cblx0XHRcdGF3YWl0IFByb21pc2UuYWxsKGRpc3Bvc2VQcm9taXNlcyk7XG5cdFx0fVxuXHR9KTtcblxuXHRyZWdpc3RlclRlcm1pbmFsQWN0aW9uKHtcblx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuS2lsbEVkaXRvcixcblx0XHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLmtpbGxFZGl0b3InLCAnS2lsbCB0aGUgQWN0aXZlIFRlcm1pbmFsIGluIEVkaXRvciBBcmVhJyksXG5cdFx0cHJlY29uZGl0aW9uOiBzaGFyZWRXaGVuQ2xhdXNlLnRlcm1pbmFsQXZhaWxhYmxlLFxuXHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlXLFxuXHRcdFx0d2luOiB7IHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5GNCwgc2Vjb25kYXJ5OiBbS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleVddIH0sXG5cdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChUZXJtaW5hbENvbnRleHRLZXlzLmZvY3VzLCBUZXJtaW5hbENvbnRleHRLZXlzLmVkaXRvckZvY3VzKVxuXHRcdH0sXG5cdFx0cnVuOiAoYywgYWNjZXNzb3IpID0+IGFjY2Vzc29yLmdldChJQ29tbWFuZFNlcnZpY2UpLmV4ZWN1dGVDb21tYW5kKENMT1NFX0VESVRPUl9DT01NQU5EX0lEKVxuXHR9KTtcblxuXHRyZWdpc3RlclRlcm1pbmFsQWN0aW9uKHtcblx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuS2lsbEFjdGl2ZVRhYixcblx0XHR0aXRsZTogdGVybWluYWxTdHJpbmdzLmtpbGwsXG5cdFx0ZjE6IGZhbHNlLFxuXHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIub3Ioc2hhcmVkV2hlbkNsYXVzZS50ZXJtaW5hbEF2YWlsYWJsZSwgVGVybWluYWxDb250ZXh0S2V5cy5pc09wZW4pLFxuXHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdHByaW1hcnk6IEtleUNvZGUuRGVsZXRlLFxuXHRcdFx0bWFjOiB7XG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5CYWNrc3BhY2UsXG5cdFx0XHRcdHNlY29uZGFyeTogW0tleUNvZGUuRGVsZXRlXVxuXHRcdFx0fSxcblx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0d2hlbjogVGVybWluYWxDb250ZXh0S2V5cy50YWJzRm9jdXNcblx0XHR9LFxuXHRcdHJ1bjogYXN5bmMgKGMsIGFjY2Vzc29yKSA9PiB7XG5cdFx0XHRjb25zdCBkaXNwb3NlUHJvbWlzZXM6IFByb21pc2U8dm9pZD5bXSA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCB0ZXJtaW5hbCBvZiBnZXRTZWxlY3RlZEluc3RhbmNlcyhhY2Nlc3NvciwgdHJ1ZSkgPz8gW10pIHtcblx0XHRcdFx0ZGlzcG9zZVByb21pc2VzLnB1c2goYy5zZXJ2aWNlLnNhZmVEaXNwb3NlVGVybWluYWwodGVybWluYWwpKTtcblx0XHRcdH1cblx0XHRcdGF3YWl0IFByb21pc2UuYWxsKGRpc3Bvc2VQcm9taXNlcyk7XG5cdFx0XHRjLmdyb3VwU2VydmljZS5mb2N1c1RhYnMoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHJlZ2lzdGVyVGVybWluYWxBY3Rpb24oe1xuXHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5Gb2N1c0hvdmVyLFxuXHRcdHRpdGxlOiB0ZXJtaW5hbFN0cmluZ3MuZm9jdXNIb3Zlcixcblx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLm9yKHNoYXJlZFdoZW5DbGF1c2UudGVybWluYWxBdmFpbGFibGUsIFRlcm1pbmFsQ29udGV4dEtleXMuaXNPcGVuKSxcblx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUkpLFxuXHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5vcihUZXJtaW5hbENvbnRleHRLZXlzLnRhYnNGb2N1cywgVGVybWluYWxDb250ZXh0S2V5cy5mb2N1cylcblx0XHR9LFxuXHRcdHJ1bjogKGMpID0+IGMuZ3JvdXBTZXJ2aWNlLmZvY3VzSG92ZXIoKVxuXHR9KTtcblxuXHRyZWdpc3RlckFjdGl2ZUluc3RhbmNlQWN0aW9uKHtcblx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuQ2xlYXIsXG5cdFx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5jbGVhcicsICdDbGVhcicpLFxuXHRcdHByZWNvbmRpdGlvbjogc2hhcmVkV2hlbkNsYXVzZS50ZXJtaW5hbEF2YWlsYWJsZSxcblx0XHRrZXliaW5kaW5nOiBbe1xuXHRcdFx0cHJpbWFyeTogMCxcblx0XHRcdG1hYzogeyBwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SyB9LFxuXHRcdFx0Ly8gV2VpZ2h0IGlzIGhpZ2hlciB0aGFuIHdvcmsgd29ya2JlbmNoIGNvbnRyaWJ1dGlvbnMgc28gdGhlIGtleWJpbmRpbmcgcmVtYWluc1xuXHRcdFx0Ly8gaGlnaGVzdCBwcmlvcml0eSB3aGVuIGNob3JkcyBhcmUgcmVnaXN0ZXJlZCBhZnRlcndhcmRzXG5cdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYiArIDEsXG5cdFx0XHQvLyBEaXNhYmxlIHRoZSBrZXliaW5kaW5nIHdoZW4gYWNjZXNzaWJpbGl0eSBtb2RlIGlzIGVuYWJsZWQgYXMgY2hvcmRzIGluY2x1ZGVcblx0XHRcdC8vIGltcG9ydGFudCBzY3JlZW4gcmVhZGVyIGtleWJpbmRpbmdzIHN1Y2ggYXMgY21kK2ssIGNtZCtpIHRvIHNob3cgdGhlIGhvdmVyXG5cdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5vcihDb250ZXh0S2V5RXhwci5hbmQoVGVybWluYWxDb250ZXh0S2V5cy5mb2N1cywgQ09OVEVYVF9BQ0NFU1NJQklMSVRZX01PREVfRU5BQkxFRC5uZWdhdGUoKSksIENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX0FDQ0VTU0lCSUxJVFlfTU9ERV9FTkFCTEVELCBhY2Nlc3NpYmxlVmlld0lzU2hvd24sIGFjY2Vzc2libGVWaWV3Q3VycmVudFByb3ZpZGVySWQuaXNFcXVhbFRvKEFjY2Vzc2libGVWaWV3UHJvdmlkZXJJZC5UZXJtaW5hbCkpKSxcblx0XHR9XSxcblx0XHRydW46IChhY3RpdmVJbnN0YW5jZSkgPT4gYWN0aXZlSW5zdGFuY2UuY2xlYXJCdWZmZXIoKVxuXHR9KTtcblxuXHRyZWdpc3RlclRlcm1pbmFsQWN0aW9uKHtcblx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuU2VsZWN0RGVmYXVsdFByb2ZpbGUsXG5cdFx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5zZWxlY3REZWZhdWx0U2hlbGwnLCAnU2VsZWN0IERlZmF1bHQgUHJvZmlsZScpLFxuXHRcdHJ1bjogKGMpID0+IGMuc2VydmljZS5zaG93UHJvZmlsZVF1aWNrUGljaygnc2V0RGVmYXVsdCcpXG5cdH0pO1xuXG5cdHJlZ2lzdGVyVGVybWluYWxBY3Rpb24oe1xuXHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5Db25maWd1cmVUZXJtaW5hbFNldHRpbmdzLFxuXHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwub3BlblNldHRpbmdzJywgJ0NvbmZpZ3VyZSBUZXJtaW5hbCBTZXR0aW5ncycpLFxuXHRcdHByZWNvbmRpdGlvbjogc2hhcmVkV2hlbkNsYXVzZS50ZXJtaW5hbEF2YWlsYWJsZSxcblx0XHRydW46IChjLCBhY2Nlc3NvcikgPT4gYWNjZXNzb3IuZ2V0KElQcmVmZXJlbmNlc1NlcnZpY2UpLm9wZW5TZXR0aW5ncyh7IGpzb25FZGl0b3I6IGZhbHNlLCBxdWVyeTogJ0BmZWF0dXJlOnRlcm1pbmFsJyB9KVxuXHR9KTtcblxuXHRyZWdpc3RlckFjdGl2ZUluc3RhbmNlQWN0aW9uKHtcblx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuU2V0RGltZW5zaW9ucyxcblx0XHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnNldEZpeGVkRGltZW5zaW9ucycsICdTZXQgRml4ZWQgRGltZW5zaW9ucycpLFxuXHRcdHByZWNvbmRpdGlvbjogc2hhcmVkV2hlbkNsYXVzZS50ZXJtaW5hbEF2YWlsYWJsZV9hbmRfb3BlbmVkLFxuXHRcdHJ1bjogKGFjdGl2ZUluc3RhbmNlKSA9PiBhY3RpdmVJbnN0YW5jZS5zZXRGaXhlZERpbWVuc2lvbnMoKVxuXHR9KTtcblxuXHRyZWdpc3RlckNvbnRleHR1YWxJbnN0YW5jZUFjdGlvbih7XG5cdFx0aWQ6IFRlcm1pbmFsQ29tbWFuZElkLlNpemVUb0NvbnRlbnRXaWR0aCxcblx0XHR0aXRsZTogdGVybWluYWxTdHJpbmdzLnRvZ2dsZVNpemVUb0NvbnRlbnRXaWR0aCxcblx0XHRwcmVjb25kaXRpb246IHNoYXJlZFdoZW5DbGF1c2UudGVybWluYWxBdmFpbGFibGVfYW5kX29wZW5lZCxcblx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRwcmltYXJ5OiBLZXlNb2QuQWx0IHwgS2V5Q29kZS5LZXlaLFxuXHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHR3aGVuOiBUZXJtaW5hbENvbnRleHRLZXlzLmZvY3VzXG5cdFx0fSxcblx0XHRydW46IChpbnN0YW5jZSkgPT4gaW5zdGFuY2UudG9nZ2xlU2l6ZVRvQ29udGVudFdpZHRoKClcblx0fSk7XG5cblx0cmVnaXN0ZXJUZXJtaW5hbEFjdGlvbih7XG5cdFx0aWQ6IFRlcm1pbmFsQ29tbWFuZElkLlN3aXRjaFRlcm1pbmFsLFxuXHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuc3dpdGNoVGVybWluYWwnLCAnU3dpdGNoIFRlcm1pbmFsJyksXG5cdFx0cHJlY29uZGl0aW9uOiBzaGFyZWRXaGVuQ2xhdXNlLnRlcm1pbmFsQXZhaWxhYmxlLFxuXHRcdHJ1bjogYXN5bmMgKGMsIGFjY2Vzc29yLCBhcmdzKSA9PiB7XG5cdFx0XHRjb25zdCBpdGVtID0gdG9PcHRpb25hbFN0cmluZyhhcmdzKTtcblx0XHRcdGlmICghaXRlbSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoaXRlbSA9PT0gc3dpdGNoVGVybWluYWxBY3Rpb25WaWV3SXRlbVNlcGFyYXRvcikge1xuXHRcdFx0XHRjLnNlcnZpY2UucmVmcmVzaEFjdGl2ZUdyb3VwKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmIChpdGVtID09PSBzd2l0Y2hUZXJtaW5hbFNob3dUYWJzVGl0bGUpIHtcblx0XHRcdFx0YWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSkudXBkYXRlVmFsdWUoVGVybWluYWxTZXR0aW5nSWQuVGFic0VuYWJsZWQsIHRydWUpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHRlcm1pbmFsSW5kZXhSZSA9IC9eKFswLTldKyk6IC87XG5cdFx0XHRjb25zdCBpbmRleE1hdGNoZXMgPSB0ZXJtaW5hbEluZGV4UmUuZXhlYyhpdGVtKTtcblx0XHRcdGlmIChpbmRleE1hdGNoZXMpIHtcblx0XHRcdFx0Yy5ncm91cFNlcnZpY2Uuc2V0QWN0aXZlR3JvdXBCeUluZGV4KE51bWJlcihpbmRleE1hdGNoZXNbMV0pIC0gMSk7XG5cdFx0XHRcdHJldHVybiBjLmdyb3VwU2VydmljZS5zaG93UGFuZWwodHJ1ZSk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHF1aWNrU2VsZWN0UHJvZmlsZXMgPSBjLnByb2ZpbGVTZXJ2aWNlLmF2YWlsYWJsZVByb2ZpbGVzO1xuXG5cdFx0XHQvLyBSZW1vdmUgJ05ldyAnIGZyb20gdGhlIHNlbGVjdGVkIGl0ZW0gdG8gZ2V0IHRoZSBwcm9maWxlIG5hbWVcblx0XHRcdGNvbnN0IHByb2ZpbGVTZWxlY3Rpb24gPSBpdGVtLnN1YnN0cmluZyg0KTtcblx0XHRcdGlmIChxdWlja1NlbGVjdFByb2ZpbGVzKSB7XG5cdFx0XHRcdGNvbnN0IHByb2ZpbGUgPSBxdWlja1NlbGVjdFByb2ZpbGVzLmZpbmQocHJvZmlsZSA9PiBwcm9maWxlLnByb2ZpbGVOYW1lID09PSBwcm9maWxlU2VsZWN0aW9uKTtcblx0XHRcdFx0aWYgKHByb2ZpbGUpIHtcblx0XHRcdFx0XHRjb25zdCBpbnN0YW5jZSA9IGF3YWl0IGMuc2VydmljZS5jcmVhdGVUZXJtaW5hbCh7XG5cdFx0XHRcdFx0XHRjb25maWc6IHByb2ZpbGVcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRjLnNlcnZpY2Uuc2V0QWN0aXZlSW5zdGFuY2UoaW5zdGFuY2UpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnNvbGUud2FybihgTm8gcHJvZmlsZSB3aXRoIG5hbWUgXCIke3Byb2ZpbGVTZWxlY3Rpb259XCJgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc29sZS53YXJuKGBVbm1hdGNoZWQgdGVybWluYWwgaXRlbTogXCIke2l0ZW19XCJgKTtcblx0XHRcdH1cblx0XHR9XG5cdH0pO1xufVxuXG5pbnRlcmZhY2UgSVJlbW90ZVRlcm1pbmFsUGljayBleHRlbmRzIElRdWlja1BpY2tJdGVtIHtcblx0dGVybTogSVJlbW90ZVRlcm1pbmFsQXR0YWNoVGFyZ2V0O1xufVxuXG5mdW5jdGlvbiBnZXRTZWxlY3RlZEluc3RhbmNlczIoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGFyZ3M/OiB1bmtub3duKTogSVRlcm1pbmFsSW5zdGFuY2VbXSB8IHVuZGVmaW5lZCB7XG5cdGNvbnN0IHRlcm1pbmFsU2VydmljZSA9IGFjY2Vzc29yLmdldChJVGVybWluYWxTZXJ2aWNlKTtcblx0Y29uc3QgcmVzdWx0OiBJVGVybWluYWxJbnN0YW5jZVtdID0gW107XG5cdGNvbnN0IGNvbnRleHQgPSBwYXJzZUFjdGlvbkFyZ3MoYXJncyk7XG5cdGlmIChjb250ZXh0ICYmIGNvbnRleHQubGVuZ3RoID4gMCkge1xuXHRcdGZvciAoY29uc3QgaW5zdGFuY2VDb250ZXh0IG9mIGNvbnRleHQpIHtcblx0XHRcdGNvbnN0IGluc3RhbmNlID0gdGVybWluYWxTZXJ2aWNlLmdldEluc3RhbmNlRnJvbUlkKGluc3RhbmNlQ29udGV4dC5pbnN0YW5jZUlkKTtcblx0XHRcdGlmIChpbnN0YW5jZSkge1xuXHRcdFx0XHRyZXN1bHQucHVzaChpbnN0YW5jZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChyZXN1bHQubGVuZ3RoID4gMCkge1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9XG5cdH1cblx0cmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gZ2V0U2VsZWN0ZWRJbnN0YW5jZXMoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGFyZ3M/OiB1bmtub3duLCBhcmdzMj86IHVua25vd24pOiBJVGVybWluYWxJbnN0YW5jZVtdIHwgdW5kZWZpbmVkIHtcblx0Y29uc3QgbGlzdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxpc3RTZXJ2aWNlKTtcblx0Y29uc3QgdGVybWluYWxTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElUZXJtaW5hbFNlcnZpY2UpO1xuXHRjb25zdCB0ZXJtaW5hbEdyb3VwU2VydmljZSA9IGFjY2Vzc29yLmdldChJVGVybWluYWxHcm91cFNlcnZpY2UpO1xuXHRjb25zdCByZXN1bHQ6IElUZXJtaW5hbEluc3RhbmNlW10gPSBbXTtcblxuXHQvLyBBc3NpZ24gbGlzdCBvbmx5IGlmIGl0J3MgYW4gaW5zdGFuY2Ugb2YgVGVybWluYWxUYWJMaXN0ICgjMjM0NzkxKVxuXHRjb25zdCBsaXN0ID0gbGlzdFNlcnZpY2UubGFzdEZvY3VzZWRMaXN0IGluc3RhbmNlb2YgVGVybWluYWxUYWJMaXN0ID8gbGlzdFNlcnZpY2UubGFzdEZvY3VzZWRMaXN0IDogdW5kZWZpbmVkO1xuXHQvLyBHZXQgc2VsZWN0ZWQgdGFiIGxpc3QgaW5zdGFuY2Uocylcblx0Y29uc3Qgc2VsZWN0aW9ucyA9IGxpc3Q/LmdldFNlbGVjdGlvbigpO1xuXHQvLyBHZXQgaW5saW5lIHRhYiBpbnN0YW5jZSBpZiB0aGVyZSBhcmUgbm90IHRhYiBsaXN0IHNlbGVjdGlvbnMgIzE5NjU3OFxuXHRpZiAodGVybWluYWxHcm91cFNlcnZpY2UubGFzdEFjY2Vzc2VkTWVudSA9PT0gJ2lubGluZS10YWInICYmICFzZWxlY3Rpb25zPy5sZW5ndGgpIHtcblx0XHRjb25zdCBpbnN0YW5jZSA9IHRlcm1pbmFsR3JvdXBTZXJ2aWNlLmFjdGl2ZUluc3RhbmNlO1xuXHRcdHJldHVybiBpbnN0YW5jZSA/IFt0ZXJtaW5hbEdyb3VwU2VydmljZS5hY3RpdmVJbnN0YW5jZV0gOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRpZiAoIWxpc3QgfHwgIXNlbGVjdGlvbnMpIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cdGNvbnN0IGZvY3VzZWQgPSBsaXN0LmdldEZvY3VzKCk7XG5cblx0aWYgKGZvY3VzZWQubGVuZ3RoID09PSAxICYmICFzZWxlY3Rpb25zLmluY2x1ZGVzKGZvY3VzZWRbMF0pKSB7XG5cdFx0Ly8gZm9jdXNlZCBsZW5ndGggaXMgYWx3YXlzIGEgbWF4IG9mIDFcblx0XHQvLyBpZiB0aGUgZm9jdXNlZCBvbmUgaXMgbm90IGluIHRoZSBzZWxlY3RlZCBsaXN0LCByZXR1cm4gdGhhdCBpdGVtXG5cdFx0cmVzdWx0LnB1c2godGVybWluYWxTZXJ2aWNlLmdldEluc3RhbmNlRnJvbUluZGV4KGZvY3VzZWRbMF0pIGFzIElUZXJtaW5hbEluc3RhbmNlKTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0Ly8gbXVsdGktc2VsZWN0XG5cdGZvciAoY29uc3Qgc2VsZWN0aW9uIG9mIHNlbGVjdGlvbnMpIHtcblx0XHRyZXN1bHQucHVzaCh0ZXJtaW5hbFNlcnZpY2UuZ2V0SW5zdGFuY2VGcm9tSW5kZXgoc2VsZWN0aW9uKSBhcyBJVGVybWluYWxJbnN0YW5jZSk7XG5cdH1cblx0cmV0dXJuIHJlc3VsdC5maWx0ZXIociA9PiAhIXIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVUZXJtaW5hbE5hbWUobmFtZTogc3RyaW5nKTogeyBjb250ZW50OiBzdHJpbmc7IHNldmVyaXR5OiBTZXZlcml0eSB9IHwgbnVsbCB7XG5cdGlmICghbmFtZSB8fCBuYW1lLnRyaW0oKS5sZW5ndGggPT09IDApIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Y29udGVudDogbG9jYWxpemUoJ2VtcHR5VGVybWluYWxOYW1lSW5mbycsIFwiUHJvdmlkaW5nIG5vIG5hbWUgd2lsbCByZXNldCBpdCB0byB0aGUgZGVmYXVsdCB2YWx1ZVwiKSxcblx0XHRcdHNldmVyaXR5OiBTZXZlcml0eS5JbmZvXG5cdFx0fTtcblx0fVxuXG5cdHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0T3B0aW9uc09yUHJvZmlsZVRvT3B0aW9ucyhvcHRpb25zT3JQcm9maWxlPzogSUNyZWF0ZVRlcm1pbmFsT3B0aW9ucyB8IElUZXJtaW5hbFByb2ZpbGUpOiBJQ3JlYXRlVGVybWluYWxPcHRpb25zIHwgdW5kZWZpbmVkIHtcblx0aWYgKGlzT2JqZWN0KG9wdGlvbnNPclByb2ZpbGUpICYmICdwcm9maWxlTmFtZScgaW4gb3B0aW9uc09yUHJvZmlsZSkge1xuXHRcdHJldHVybiB7IGNvbmZpZzogb3B0aW9uc09yUHJvZmlsZSBhcyBJVGVybWluYWxQcm9maWxlLCBsb2NhdGlvbjogKG9wdGlvbnNPclByb2ZpbGUgYXMgSUNyZWF0ZVRlcm1pbmFsT3B0aW9ucykubG9jYXRpb24gfTtcblx0fVxuXHRyZXR1cm4gb3B0aW9uc09yUHJvZmlsZTtcbn1cblxubGV0IG5ld1dpdGhQcm9maWxlQWN0aW9uOiBJRGlzcG9zYWJsZTtcblxuZXhwb3J0IGZ1bmN0aW9uIHJlZnJlc2hUZXJtaW5hbEFjdGlvbnMoZGV0ZWN0ZWRQcm9maWxlczogSVRlcm1pbmFsUHJvZmlsZVtdKTogSURpc3Bvc2FibGUge1xuXHRjb25zdCBwcm9maWxlRW51bSA9IGNyZWF0ZVByb2ZpbGVTY2hlbWFFbnVtcyhkZXRlY3RlZFByb2ZpbGVzKTtcblx0bmV3V2l0aFByb2ZpbGVBY3Rpb24/LmRpc3Bvc2UoKTtcblx0Ly8gVE9ETzogVXNlIG5ldyByZWdpc3RlciBmdW5jdGlvblxuXHRuZXdXaXRoUHJvZmlsZUFjdGlvbiA9IHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuTmV3V2l0aFByb2ZpbGUsXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwubmV3V2l0aFByb2ZpbGUnLCAnQ3JlYXRlIE5ldyBUZXJtaW5hbCAoV2l0aCBQcm9maWxlKScpLFxuXHRcdFx0XHRmMTogdHJ1ZSxcblx0XHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5vcihUZXJtaW5hbENvbnRleHRLZXlzLnByb2Nlc3NTdXBwb3J0ZWQsIFRlcm1pbmFsQ29udGV4dEtleXMud2ViRXh0ZW5zaW9uQ29udHJpYnV0ZWRQcm9maWxlKSxcblx0XHRcdFx0bWV0YWRhdGE6IHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogVGVybWluYWxDb21tYW5kSWQuTmV3V2l0aFByb2ZpbGUsXG5cdFx0XHRcdFx0YXJnczogW3tcblx0XHRcdFx0XHRcdG5hbWU6ICdhcmdzJyxcblx0XHRcdFx0XHRcdHNjaGVtYToge1xuXHRcdFx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRcdFx0cmVxdWlyZWQ6IFsncHJvZmlsZU5hbWUnXSxcblx0XHRcdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0XHRcdHByb2ZpbGVOYW1lOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwubmV3V2l0aFByb2ZpbGUucHJvZmlsZU5hbWUnLCBcIlRoZSBuYW1lIG9mIHRoZSBwcm9maWxlIHRvIGNyZWF0ZVwiKSxcblx0XHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRcdFx0ZW51bTogcHJvZmlsZUVudW0udmFsdWVzLFxuXHRcdFx0XHRcdFx0XHRcdFx0bWFya2Rvd25FbnVtRGVzY3JpcHRpb25zOiBwcm9maWxlRW51bS5tYXJrZG93bkRlc2NyaXB0aW9uc1xuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0bG9jYXRpb246IHtcblx0XHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnbmV3V2l0aFByb2ZpbGUubG9jYXRpb24nLCBcIldoZXJlIHRvIGNyZWF0ZSB0aGUgdGVybWluYWxcIiksXG5cdFx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0XHRcdGVudW06IFsndmlldycsICdlZGl0b3InXSxcblx0XHRcdFx0XHRcdFx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0XHRcdFx0XHRcdFx0bG9jYWxpemUoJ25ld1dpdGhQcm9maWxlLmxvY2F0aW9uLnZpZXcnLCAnQ3JlYXRlIHRoZSB0ZXJtaW5hbCBpbiB0aGUgdGVybWluYWwgdmlldycpLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRsb2NhbGl6ZSgnbmV3V2l0aFByb2ZpbGUubG9jYXRpb24uZWRpdG9yJywgJ0NyZWF0ZSB0aGUgdGVybWluYWwgaW4gdGhlIGVkaXRvcicpLFxuXHRcdFx0XHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1dXG5cdFx0XHRcdH0sXG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0YXN5bmMgcnVuKFxuXHRcdFx0YWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsXG5cdFx0XHRldmVudE9yT3B0aW9uc09yUHJvZmlsZTogTW91c2VFdmVudCB8IElDcmVhdGVUZXJtaW5hbE9wdGlvbnMgfCBJVGVybWluYWxQcm9maWxlIHwgeyBwcm9maWxlTmFtZTogc3RyaW5nOyBsb2NhdGlvbj86ICd2aWV3JyB8ICdlZGl0b3InIHwgdW5rbm93biB9IHwgdW5kZWZpbmVkLFxuXHRcdFx0cHJvZmlsZT86IElUZXJtaW5hbFByb2ZpbGVcblx0XHQpIHtcblx0XHRcdGNvbnN0IGMgPSBnZXRUZXJtaW5hbFNlcnZpY2VzKGFjY2Vzc29yKTtcblx0XHRcdGNvbnN0IHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSk7XG5cdFx0XHRjb25zdCBjb21tYW5kU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29tbWFuZFNlcnZpY2UpO1xuXG5cdFx0XHRsZXQgZXZlbnQ6IE1vdXNlRXZlbnQgfCBQb2ludGVyRXZlbnQgfCBLZXlib2FyZEV2ZW50IHwgdW5kZWZpbmVkO1xuXHRcdFx0bGV0IG9wdGlvbnM6IElDcmVhdGVUZXJtaW5hbE9wdGlvbnMgfCB1bmRlZmluZWQ7XG5cdFx0XHRsZXQgaW5zdGFuY2U6IElUZXJtaW5hbEluc3RhbmNlIHwgdW5kZWZpbmVkO1xuXHRcdFx0bGV0IGN3ZDogc3RyaW5nIHwgVVJJIHwgdW5kZWZpbmVkO1xuXG5cdFx0XHRpZiAoaXNPYmplY3QoZXZlbnRPck9wdGlvbnNPclByb2ZpbGUpICYmIGV2ZW50T3JPcHRpb25zT3JQcm9maWxlICYmICdwcm9maWxlTmFtZScgaW4gZXZlbnRPck9wdGlvbnNPclByb2ZpbGUpIHtcblx0XHRcdFx0Y29uc3QgY29uZmlnID0gYy5wcm9maWxlU2VydmljZS5hdmFpbGFibGVQcm9maWxlcy5maW5kKHByb2ZpbGUgPT4gcHJvZmlsZS5wcm9maWxlTmFtZSA9PT0gZXZlbnRPck9wdGlvbnNPclByb2ZpbGUucHJvZmlsZU5hbWUpO1xuXHRcdFx0XHRpZiAoIWNvbmZpZykge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IGZpbmQgdGVybWluYWwgcHJvZmlsZSBcIiR7ZXZlbnRPck9wdGlvbnNPclByb2ZpbGUucHJvZmlsZU5hbWV9XCJgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRvcHRpb25zID0geyBjb25maWcgfTtcblx0XHRcdFx0aWYgKCdsb2NhdGlvbicgaW4gZXZlbnRPck9wdGlvbnNPclByb2ZpbGUpIHtcblx0XHRcdFx0XHRzd2l0Y2ggKGV2ZW50T3JPcHRpb25zT3JQcm9maWxlLmxvY2F0aW9uKSB7XG5cdFx0XHRcdFx0XHRjYXNlICdlZGl0b3InOiBvcHRpb25zLmxvY2F0aW9uID0gVGVybWluYWxMb2NhdGlvbi5FZGl0b3I7IGJyZWFrO1xuXHRcdFx0XHRcdFx0Y2FzZSAndmlldyc6IG9wdGlvbnMubG9jYXRpb24gPSBUZXJtaW5hbExvY2F0aW9uLlBhbmVsOyBicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoaXNNb3VzZUV2ZW50KGV2ZW50T3JPcHRpb25zT3JQcm9maWxlKSB8fCBpc1BvaW50ZXJFdmVudChldmVudE9yT3B0aW9uc09yUHJvZmlsZSkgfHwgaXNLZXlib2FyZEV2ZW50KGV2ZW50T3JPcHRpb25zT3JQcm9maWxlKSkge1xuXHRcdFx0XHRldmVudCA9IGV2ZW50T3JPcHRpb25zT3JQcm9maWxlO1xuXHRcdFx0XHRvcHRpb25zID0gcHJvZmlsZSA/IHsgY29uZmlnOiBwcm9maWxlIH0gOiB1bmRlZmluZWQ7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRvcHRpb25zID0gY29udmVydE9wdGlvbnNPclByb2ZpbGVUb09wdGlvbnMoZXZlbnRPck9wdGlvbnNPclByb2ZpbGUpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBzcGxpdCB0ZXJtaW5hbFxuXHRcdFx0aWYgKGV2ZW50ICYmIChldmVudC5hbHRLZXkgfHwgZXZlbnQuY3RybEtleSkpIHtcblx0XHRcdFx0Y29uc3QgcGFyZW50VGVybWluYWwgPSBjLnNlcnZpY2UuYWN0aXZlSW5zdGFuY2U7XG5cdFx0XHRcdGlmIChwYXJlbnRUZXJtaW5hbCkge1xuXHRcdFx0XHRcdGF3YWl0IGMuc2VydmljZS5jcmVhdGVUZXJtaW5hbCh7IGxvY2F0aW9uOiB7IHBhcmVudFRlcm1pbmFsIH0sIGNvbmZpZzogb3B0aW9ucz8uY29uZmlnIH0pO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBmb2xkZXJzID0gd29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVycztcblx0XHRcdGlmIChmb2xkZXJzLmxlbmd0aCA+IDEpIHtcblx0XHRcdFx0Ly8gbXVsdGktcm9vdCB3b3Jrc3BhY2UsIGNyZWF0ZSByb290IHBpY2tlclxuXHRcdFx0XHRjb25zdCBvcHRpb25zOiBJUGlja09wdGlvbnM8SVF1aWNrUGlja0l0ZW0+ID0ge1xuXHRcdFx0XHRcdHBsYWNlSG9sZGVyOiBsb2NhbGl6ZSgnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5uZXdXb3Jrc3BhY2VQbGFjZWhvbGRlcicsIFwiU2VsZWN0IGN1cnJlbnQgd29ya2luZyBkaXJlY3RvcnkgZm9yIG5ldyB0ZXJtaW5hbFwiKVxuXHRcdFx0XHR9O1xuXHRcdFx0XHRjb25zdCB3b3Jrc3BhY2UgPSBhd2FpdCBjb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChQSUNLX1dPUktTUEFDRV9GT0xERVJfQ09NTUFORF9JRCwgW29wdGlvbnNdKTtcblx0XHRcdFx0aWYgKCF3b3Jrc3BhY2UpIHtcblx0XHRcdFx0XHQvLyBEb24ndCBjcmVhdGUgdGhlIGluc3RhbmNlIGlmIHRoZSB3b3Jrc3BhY2UgcGlja2VyIHdhcyBjYW5jZWxlZFxuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRjd2QgPSB3b3Jrc3BhY2UudXJpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAob3B0aW9ucykge1xuXHRcdFx0XHRvcHRpb25zLmN3ZCA9IGN3ZDtcblx0XHRcdFx0aW5zdGFuY2UgPSBhd2FpdCBjLnNlcnZpY2UuY3JlYXRlVGVybWluYWwob3B0aW9ucyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpbnN0YW5jZSA9IGF3YWl0IGMuc2VydmljZS5zaG93UHJvZmlsZVF1aWNrUGljaygnY3JlYXRlSW5zdGFuY2UnLCBjd2QpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaW5zdGFuY2UpIHtcblx0XHRcdFx0Yy5zZXJ2aWNlLnNldEFjdGl2ZUluc3RhbmNlKGluc3RhbmNlKTtcblx0XHRcdFx0YXdhaXQgZm9jdXNBY3RpdmVUZXJtaW5hbChpbnN0YW5jZSwgYyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcblx0cmV0dXJuIG5ld1dpdGhQcm9maWxlQWN0aW9uO1xufVxuXG5mdW5jdGlvbiBnZXRSZXNvdXJjZU9yQWN0aXZlSW5zdGFuY2UoYzogSVRlcm1pbmFsU2VydmljZXNDb2xsZWN0aW9uLCByZXNvdXJjZTogdW5rbm93bik6IElUZXJtaW5hbEluc3RhbmNlIHwgdW5kZWZpbmVkIHtcblx0cmV0dXJuIGMuc2VydmljZS5nZXRJbnN0YW5jZUZyb21SZXNvdXJjZSh0b09wdGlvbmFsVXJpKHJlc291cmNlKSkgfHwgYy5zZXJ2aWNlLmFjdGl2ZUluc3RhbmNlO1xufVxuXG5hc3luYyBmdW5jdGlvbiBwaWNrVGVybWluYWxDd2QoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGNhbmNlbD86IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxXb3Jrc3BhY2VGb2xkZXJDd2RQYWlyIHwgdW5kZWZpbmVkPiB7XG5cdGNvbnN0IHF1aWNrSW5wdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElRdWlja0lucHV0U2VydmljZSk7XG5cdGNvbnN0IGxhYmVsU2VydmljZSA9IGFjY2Vzc29yLmdldChJTGFiZWxTZXJ2aWNlKTtcblx0Y29uc3QgY29udGV4dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlKTtcblx0Y29uc3QgbW9kZWxTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElNb2RlbFNlcnZpY2UpO1xuXHRjb25zdCBsYW5ndWFnZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxhbmd1YWdlU2VydmljZSk7XG5cdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdGNvbnN0IGNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UpO1xuXG5cdGNvbnN0IGZvbGRlcnMgPSBjb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKS5mb2xkZXJzO1xuXHRpZiAoIWZvbGRlcnMubGVuZ3RoKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0Y29uc3QgZm9sZGVyQ3dkUGFpcnMgPSBhd2FpdCBQcm9taXNlLmFsbChmb2xkZXJzLm1hcChlID0+IHJlc29sdmVXb3Jrc3BhY2VGb2xkZXJDd2QoZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIGNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UpKSk7XG5cdGNvbnN0IHNocmlua2VkUGFpcnMgPSBzaHJpbmtXb3Jrc3BhY2VGb2xkZXJDd2RQYWlycyhmb2xkZXJDd2RQYWlycyk7XG5cblx0aWYgKHNocmlua2VkUGFpcnMubGVuZ3RoID09PSAxKSB7XG5cdFx0cmV0dXJuIHNocmlua2VkUGFpcnNbMF07XG5cdH1cblxuXHR0eXBlIEl0ZW0gPSBJUXVpY2tQaWNrSXRlbSAmIHsgcGFpcjogV29ya3NwYWNlRm9sZGVyQ3dkUGFpciB9O1xuXHRjb25zdCBmb2xkZXJQaWNrczogSXRlbVtdID0gc2hyaW5rZWRQYWlycy5tYXAocGFpciA9PiB7XG5cdFx0Y29uc3QgbGFiZWwgPSBwYWlyLmZvbGRlci5uYW1lO1xuXHRcdGNvbnN0IGRlc2NyaXB0aW9uID0gcGFpci5pc092ZXJyaWRkZW5cblx0XHRcdD8gbG9jYWxpemUoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwub3ZlcnJpZGRlbkN3ZERlc2NyaXB0aW9uJywgXCIoT3ZlcnJpZGVuKSB7MH1cIiwgbGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKHBhaXIuY3dkLCB7IHJlbGF0aXZlOiAhcGFpci5pc0Fic29sdXRlIH0pKVxuXHRcdFx0OiBsYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwoZGlybmFtZShwYWlyLmN3ZCksIHsgcmVsYXRpdmU6IHRydWUgfSk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0bGFiZWwsXG5cdFx0XHRkZXNjcmlwdGlvbjogZGVzY3JpcHRpb24gIT09IGxhYmVsID8gZGVzY3JpcHRpb24gOiB1bmRlZmluZWQsXG5cdFx0XHRwYWlyOiBwYWlyLFxuXHRcdFx0aWNvbkNsYXNzZXM6IGdldEljb25DbGFzc2VzKG1vZGVsU2VydmljZSwgbGFuZ3VhZ2VTZXJ2aWNlLCBwYWlyLmN3ZCwgRmlsZUtpbmQuUk9PVF9GT0xERVIpXG5cdFx0fTtcblx0fSk7XG5cdGNvbnN0IG9wdGlvbnM6IElQaWNrT3B0aW9uczxJdGVtPiA9IHtcblx0XHRwbGFjZUhvbGRlcjogbG9jYWxpemUoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwubmV3V29ya3NwYWNlUGxhY2Vob2xkZXInLCBcIlNlbGVjdCBjdXJyZW50IHdvcmtpbmcgZGlyZWN0b3J5IGZvciBuZXcgdGVybWluYWxcIiksXG5cdFx0bWF0Y2hPbkRlc2NyaXB0aW9uOiB0cnVlLFxuXHRcdGNhblBpY2tNYW55OiBmYWxzZSxcblx0fTtcblxuXHRjb25zdCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4gPSBjYW5jZWwgfHwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZTtcblx0Y29uc3QgcGljayA9IGF3YWl0IHF1aWNrSW5wdXRTZXJ2aWNlLnBpY2s8SXRlbT4oZm9sZGVyUGlja3MsIG9wdGlvbnMsIHRva2VuKTtcblx0cmV0dXJuIHBpY2s/LnBhaXI7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJlc29sdmVXb3Jrc3BhY2VGb2xkZXJDd2QoZm9sZGVyOiBJV29ya3NwYWNlRm9sZGVyLCBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBjb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlOiBJQ29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSk6IFByb21pc2U8V29ya3NwYWNlRm9sZGVyQ3dkUGFpcj4ge1xuXHRjb25zdCBjd2RDb25maWcgPSBjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShUZXJtaW5hbFNldHRpbmdJZC5Dd2QsIHsgcmVzb3VyY2U6IGZvbGRlci51cmkgfSk7XG5cdGlmICghaXNTdHJpbmcoY3dkQ29uZmlnKSB8fCBjd2RDb25maWcubGVuZ3RoID09PSAwKSB7XG5cdFx0cmV0dXJuIHsgZm9sZGVyLCBjd2Q6IGZvbGRlci51cmksIGlzQWJzb2x1dGU6IGZhbHNlLCBpc092ZXJyaWRkZW46IGZhbHNlIH07XG5cdH1cblxuXHRjb25zdCByZXNvbHZlZEN3ZENvbmZpZyA9IGF3YWl0IGNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UucmVzb2x2ZUFzeW5jKGZvbGRlciwgY3dkQ29uZmlnKTtcblx0cmV0dXJuIGlzQWJzb2x1dGUocmVzb2x2ZWRDd2RDb25maWcpIHx8IHJlc29sdmVkQ3dkQ29uZmlnLnN0YXJ0c1dpdGgoQ29uZmlndXJhdGlvblJlc29sdmVyRXhwcmVzc2lvbi5WQVJJQUJMRV9MSFMpXG5cdFx0PyB7IGZvbGRlciwgaXNBYnNvbHV0ZTogdHJ1ZSwgaXNPdmVycmlkZGVuOiB0cnVlLCBjd2Q6IFVSSS5mcm9tKHsgLi4uZm9sZGVyLnVyaSwgcGF0aDogcmVzb2x2ZWRDd2RDb25maWcgfSkgfVxuXHRcdDogeyBmb2xkZXIsIGlzQWJzb2x1dGU6IGZhbHNlLCBpc092ZXJyaWRkZW46IHRydWUsIGN3ZDogVVJJLmpvaW5QYXRoKGZvbGRlci51cmksIHJlc29sdmVkQ3dkQ29uZmlnKSB9O1xufVxuXG4vKipcbiAqIERyb3BzIHJlcGVhdGVkIENXRHMsIGlmIGFueSwgYnkga2VlcGluZyB0aGUgb25lIHdoaWNoIGJlc3QgbWF0Y2hlcyB0aGUgd29ya3NwYWNlIGZvbGRlci4gSXQgYWxzbyBwcmVzZXJ2ZXMgdGhlIG9yaWdpbmFsIG9yZGVyLlxuICovXG5leHBvcnQgZnVuY3Rpb24gc2hyaW5rV29ya3NwYWNlRm9sZGVyQ3dkUGFpcnMocGFpcnM6IFdvcmtzcGFjZUZvbGRlckN3ZFBhaXJbXSk6IFdvcmtzcGFjZUZvbGRlckN3ZFBhaXJbXSB7XG5cdGNvbnN0IG1hcCA9IG5ldyBNYXA8c3RyaW5nLCBXb3Jrc3BhY2VGb2xkZXJDd2RQYWlyPigpO1xuXHRmb3IgKGNvbnN0IHBhaXIgb2YgcGFpcnMpIHtcblx0XHRjb25zdCBrZXkgPSBwYWlyLmN3ZC50b1N0cmluZygpO1xuXHRcdGNvbnN0IHZhbHVlID0gbWFwLmdldChrZXkpO1xuXHRcdGlmICghdmFsdWUgfHwga2V5ID09PSBwYWlyLmZvbGRlci51cmkudG9TdHJpbmcoKSkge1xuXHRcdFx0bWFwLnNldChrZXksIHBhaXIpO1xuXHRcdH1cblx0fVxuXHRjb25zdCBzZWxlY3RlZFBhaXJzID0gbmV3IFNldChtYXAudmFsdWVzKCkpO1xuXHRjb25zdCBzZWxlY3RlZFBhaXJzSW5PcmRlciA9IHBhaXJzLmZpbHRlcih4ID0+IHNlbGVjdGVkUGFpcnMuaGFzKHgpKTtcblx0cmV0dXJuIHNlbGVjdGVkUGFpcnNJbk9yZGVyO1xufVxuXG5hc3luYyBmdW5jdGlvbiBmb2N1c0FjdGl2ZVRlcm1pbmFsKGluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSwgYzogSVRlcm1pbmFsU2VydmljZXNDb2xsZWN0aW9uKTogUHJvbWlzZTx2b2lkPiB7XG5cdGlmIChpbnN0YW5jZS50YXJnZXQgPT09IFRlcm1pbmFsTG9jYXRpb24uRWRpdG9yKSB7XG5cdFx0YXdhaXQgYy5lZGl0b3JTZXJ2aWNlLnJldmVhbEFjdGl2ZUVkaXRvcigpO1xuXHRcdGF3YWl0IGluc3RhbmNlLmZvY3VzV2hlblJlYWR5KHRydWUpO1xuXHR9IGVsc2Uge1xuXHRcdGF3YWl0IGMuZ3JvdXBTZXJ2aWNlLnNob3dQYW5lbCh0cnVlKTtcblx0fVxufVxuXG5hc3luYyBmdW5jdGlvbiByZW5hbWVXaXRoUXVpY2tQaWNrKGM6IElUZXJtaW5hbFNlcnZpY2VzQ29sbGVjdGlvbiwgYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHJlc291cmNlPzogdW5rbm93bikge1xuXHRsZXQgaW5zdGFuY2U6IElUZXJtaW5hbEluc3RhbmNlIHwgdW5kZWZpbmVkID0gcmVzb3VyY2UgYXMgSVRlcm1pbmFsSW5zdGFuY2U7XG5cdC8vIENoZWNrIGlmIHRoZSAnaW5zdGFuY2UnIGRvZXMgbm90IGV4aXN0IG9yIGlmICdpbnN0YW5jZS5yZW5hbWUnIGlzIG5vdCBkZWZpbmVkXG5cdGlmICghaW5zdGFuY2UgfHwgIWluc3RhbmNlPy5yZW5hbWUpIHtcblx0XHQvLyBJZiBub3QsIG9idGFpbiB0aGUgcmVzb3VyY2UgaW5zdGFuY2UgdXNpbmcgJ2dldFJlc291cmNlT3JBY3RpdmVJbnN0YW5jZSdcblx0XHRpbnN0YW5jZSA9IGdldFJlc291cmNlT3JBY3RpdmVJbnN0YW5jZShjLCByZXNvdXJjZSk7XG5cdH1cblxuXHRpZiAoaW5zdGFuY2UpIHtcblx0XHRjb25zdCB0aXRsZSA9IGF3YWl0IGFjY2Vzc29yLmdldChJUXVpY2tJbnB1dFNlcnZpY2UpLmlucHV0KHtcblx0XHRcdHZhbHVlOiBpbnN0YW5jZS50aXRsZSxcblx0XHRcdHByb21wdDogbG9jYWxpemUoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwucmVuYW1lLnByb21wdCcsIFwiRW50ZXIgdGVybWluYWwgbmFtZVwiKSxcblx0XHR9KTtcblx0XHRpZiAodGl0bGUpIHtcblx0XHRcdGluc3RhbmNlLnJlbmFtZSh0aXRsZSk7XG5cdFx0fVxuXHR9XG59XG5cbmZ1bmN0aW9uIHRvT3B0aW9uYWxVcmkob2JqOiB1bmtub3duKTogVVJJIHwgdW5kZWZpbmVkIHtcblx0cmV0dXJuIFVSSS5pc1VyaShvYmopID8gb2JqIDogdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiB0b09wdGlvbmFsU3RyaW5nKG9iajogdW5rbm93bik6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdHJldHVybiBpc1N0cmluZyhvYmopID8gb2JqIDogdW5kZWZpbmVkO1xu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
