import { localize, localize2 } from "../../../nls.js";
import { IDialogService } from "../../../platform/dialogs/common/dialogs.js";
import { MenuRegistry, MenuId, Action2, registerAction2 } from "../../../platform/actions/common/actions.js";
import { KeyChord, KeyCode, KeyMod } from "../../../base/common/keyCodes.js";
import { IsMainWindowFullscreenContext } from "../../common/contextkeys.js";
import { IsMacNativeContext, IsDevelopmentContext, IsWebContext, IsIOSContext } from "../../../platform/contextkey/common/contextkeys.js";
import { Categories } from "../../../platform/action/common/actionCommonCategories.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../platform/keybinding/common/keybindingsRegistry.js";
import { IQuickInputService } from "../../../platform/quickinput/common/quickInput.js";
import { IWorkspaceContextService } from "../../../platform/workspace/common/workspace.js";
import { ILabelService, Verbosity } from "../../../platform/label/common/label.js";
import { IKeybindingService } from "../../../platform/keybinding/common/keybinding.js";
import { IModelService } from "../../../editor/common/services/model.js";
import { ILanguageService } from "../../../editor/common/languages/language.js";
import { isRecentFolder, isRecentWorkspace, IWorkspacesService } from "../../../platform/workspaces/common/workspaces.js";
import { getIconClasses } from "../../../editor/common/services/getIconClasses.js";
import { FileKind } from "../../../platform/files/common/files.js";
import { splitRecentLabel } from "../../../base/common/labels.js";
import { isMacintosh, isWeb, isWindows } from "../../../base/common/platform.js";
import { ContextKeyExpr } from "../../../platform/contextkey/common/contextkey.js";
import { inQuickPickContext, getQuickNavigateHandler } from "../quickaccess.js";
import { IHostService } from "../../services/host/browser/host.js";
import { ResourceMap } from "../../../base/common/map.js";
import { Codicon } from "../../../base/common/codicons.js";
import { ThemeIcon } from "../../../base/common/themables.js";
import { CommandsRegistry } from "../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { isFolderBackupInfo, isWorkspaceBackupInfo } from "../../../platform/backup/common/backup.js";
import { getActiveElement, getActiveWindow, isHTMLElement } from "../../../base/browser/dom.js";
const inRecentFilesPickerContextKey = "inRecentFilesPicker";
class BaseOpenRecentAction extends Action2 {
  constructor(desc) {
    super(desc);
    this.removeFromRecentlyOpened = {
      iconClass: ThemeIcon.asClassName(Codicon.removeClose),
      tooltip: localize("remove", "Remove from Recently Opened")
    };
    this.dirtyRecentlyOpenedFolder = {
      iconClass: "dirty-workspace " + ThemeIcon.asClassName(Codicon.closeDirty),
      tooltip: localize("dirtyRecentlyOpenedFolder", "Folder With Unsaved Files"),
      alwaysVisible: true
    };
    this.dirtyRecentlyOpenedWorkspace = {
      ...this.dirtyRecentlyOpenedFolder,
      tooltip: localize("dirtyRecentlyOpenedWorkspace", "Workspace With Unsaved Files")
    };
  }
  async run(accessor) {
    const workspacesService = accessor.get(IWorkspacesService);
    const quickInputService = accessor.get(IQuickInputService);
    const contextService = accessor.get(IWorkspaceContextService);
    const labelService = accessor.get(ILabelService);
    const keybindingService = accessor.get(IKeybindingService);
    const modelService = accessor.get(IModelService);
    const languageService = accessor.get(ILanguageService);
    const hostService = accessor.get(IHostService);
    const dialogService = accessor.get(IDialogService);
    const recentlyOpened = await workspacesService.getRecentlyOpened();
    const dirtyWorkspacesAndFolders = await workspacesService.getDirtyWorkspaces();
    let hasWorkspaces = false;
    const dirtyFolders = new ResourceMap();
    const dirtyWorkspaces = new ResourceMap();
    for (const dirtyWorkspace of dirtyWorkspacesAndFolders) {
      if (isFolderBackupInfo(dirtyWorkspace)) {
        dirtyFolders.set(dirtyWorkspace.folderUri, true);
      } else {
        dirtyWorkspaces.set(dirtyWorkspace.workspace.configPath, dirtyWorkspace.workspace);
        hasWorkspaces = true;
      }
    }
    const recentFolders = new ResourceMap();
    const recentWorkspaces = new ResourceMap();
    for (const recent of recentlyOpened.workspaces) {
      if (isRecentFolder(recent)) {
        recentFolders.set(recent.folderUri, true);
      } else {
        recentWorkspaces.set(recent.workspace.configPath, recent.workspace);
        hasWorkspaces = true;
      }
    }
    const workspacePicks = [];
    for (const recent of recentlyOpened.workspaces) {
      const isDirty = isRecentFolder(recent) ? dirtyFolders.has(recent.folderUri) : dirtyWorkspaces.has(recent.workspace.configPath);
      workspacePicks.push(this.toQuickPick(modelService, languageService, labelService, recent, isDirty));
    }
    for (const dirtyWorkspaceOrFolder of dirtyWorkspacesAndFolders) {
      if (isFolderBackupInfo(dirtyWorkspaceOrFolder) && !recentFolders.has(dirtyWorkspaceOrFolder.folderUri)) {
        workspacePicks.push(this.toQuickPick(modelService, languageService, labelService, dirtyWorkspaceOrFolder, true));
      } else if (isWorkspaceBackupInfo(dirtyWorkspaceOrFolder) && !recentWorkspaces.has(dirtyWorkspaceOrFolder.workspace.configPath)) {
        workspacePicks.push(this.toQuickPick(modelService, languageService, labelService, dirtyWorkspaceOrFolder, true));
      }
    }
    const filePicks = recentlyOpened.files.map((p) => this.toQuickPick(modelService, languageService, labelService, p, false));
    const firstEntry = recentlyOpened.workspaces[0];
    const autoFocusSecondEntry = firstEntry && contextService.isCurrentWorkspace(isRecentWorkspace(firstEntry) ? firstEntry.workspace : firstEntry.folderUri);
    let keyMods;
    const workspaceSeparator = { type: "separator", label: hasWorkspaces ? localize("workspacesAndFolders", "folders & workspaces") : localize("folders", "folders") };
    const fileSeparator = { type: "separator", label: localize("files", "files") };
    const picks = [workspaceSeparator, ...workspacePicks, fileSeparator, ...filePicks];
    const pick = await quickInputService.pick(picks, {
      contextKey: inRecentFilesPickerContextKey,
      activeItem: [...workspacePicks, ...filePicks][autoFocusSecondEntry ? 1 : 0],
      placeHolder: isMacintosh ? localize("openRecentPlaceholderMac", "Select to open (hold Cmd-key to force new window or Option-key for same window)") : localize("openRecentPlaceholder", "Select to open (hold Ctrl-key to force new window or Alt-key for same window)"),
      matchOnDescription: true,
      onKeyMods: (mods) => keyMods = mods,
      quickNavigate: this.isQuickNavigate() ? { keybindings: keybindingService.lookupKeybindings(this.desc.id) } : void 0,
      hideInput: this.isQuickNavigate(),
      onDidTriggerItemButton: async (context) => {
        if (context.button === this.removeFromRecentlyOpened) {
          await workspacesService.removeRecentlyOpened([context.item.resource]);
          context.removeItem();
        } else if (context.button === this.dirtyRecentlyOpenedFolder || context.button === this.dirtyRecentlyOpenedWorkspace) {
          const isDirtyWorkspace = context.button === this.dirtyRecentlyOpenedWorkspace;
          const { confirmed } = await dialogService.confirm({
            title: isDirtyWorkspace ? localize("dirtyWorkspace", "Workspace with Unsaved Files") : localize("dirtyFolder", "Folder with Unsaved Files"),
            message: isDirtyWorkspace ? localize("dirtyWorkspaceConfirm", "Do you want to open the workspace to review the unsaved files?") : localize("dirtyFolderConfirm", "Do you want to open the folder to review the unsaved files?"),
            detail: isDirtyWorkspace ? localize("dirtyWorkspaceConfirmDetail", "Workspaces with unsaved files cannot be removed until all unsaved files have been saved or reverted.") : localize("dirtyFolderConfirmDetail", "Folders with unsaved files cannot be removed until all unsaved files have been saved or reverted.")
          });
          if (confirmed) {
            hostService.openWindow(
              [context.item.openable],
              {
                remoteAuthority: context.item.remoteAuthority || null
                // local window if remoteAuthority is not set or can not be deducted from the openable
              }
            );
            quickInputService.cancel();
          }
        }
      }
    });
    if (pick) {
      return hostService.openWindow([pick.openable], {
        forceNewWindow: keyMods?.ctrlCmd,
        forceReuseWindow: keyMods?.alt,
        remoteAuthority: pick.remoteAuthority || null
        // local window if remoteAuthority is not set or can not be deducted from the openable
      });
    }
  }
  toQuickPick(modelService, languageService, labelService, recent, isDirty) {
    let openable;
    let iconClasses;
    let fullLabel;
    let resource;
    let isWorkspace = false;
    if (isRecentFolder(recent)) {
      resource = recent.folderUri;
      iconClasses = getIconClasses(modelService, languageService, resource, FileKind.FOLDER);
      openable = { folderUri: resource };
      fullLabel = recent.label || labelService.getWorkspaceLabel(resource, { verbose: Verbosity.LONG });
    } else if (isRecentWorkspace(recent)) {
      resource = recent.workspace.configPath;
      iconClasses = getIconClasses(modelService, languageService, resource, FileKind.ROOT_FOLDER);
      openable = { workspaceUri: resource };
      fullLabel = recent.label || labelService.getWorkspaceLabel(recent.workspace, { verbose: Verbosity.LONG });
      isWorkspace = true;
    } else {
      resource = recent.fileUri;
      iconClasses = getIconClasses(modelService, languageService, resource, FileKind.FILE);
      openable = { fileUri: resource };
      fullLabel = recent.label || labelService.getUriLabel(resource, { appendWorkspaceSuffix: true });
    }
    const { name, parentPath } = splitRecentLabel(fullLabel);
    return {
      iconClasses,
      label: name,
      ariaLabel: isDirty ? isWorkspace ? localize("recentDirtyWorkspaceAriaLabel", "{0}, workspace with unsaved changes", name) : localize("recentDirtyFolderAriaLabel", "{0}, folder with unsaved changes", name) : name,
      description: parentPath,
      buttons: isDirty ? [isWorkspace ? this.dirtyRecentlyOpenedWorkspace : this.dirtyRecentlyOpenedFolder] : [this.removeFromRecentlyOpened],
      openable,
      resource,
      remoteAuthority: recent.remoteAuthority
    };
  }
}
const _OpenRecentAction = class _OpenRecentAction extends BaseOpenRecentAction {
  constructor() {
    super({
      id: _OpenRecentAction.ID,
      title: {
        ...localize2("openRecent", "Open Recent..."),
        mnemonicTitle: localize({ key: "miMore", comment: ["&& denotes a mnemonic"] }, "&&More...")
      },
      category: Categories.File,
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyCode.KeyR,
        mac: { primary: KeyMod.WinCtrl | KeyCode.KeyR }
      },
      menu: {
        id: MenuId.MenubarRecentMenu,
        group: "y_more",
        order: 1
      }
    });
  }
  isQuickNavigate() {
    return false;
  }
};
_OpenRecentAction.ID = "workbench.action.openRecent";
let OpenRecentAction = _OpenRecentAction;
class QuickPickRecentAction extends BaseOpenRecentAction {
  constructor() {
    super({
      id: "workbench.action.quickOpenRecent",
      title: localize2("quickOpenRecent", "Quick Open Recent..."),
      category: Categories.File,
      f1: false
      // hide quick pickers from command palette to not confuse with the other entry that shows a input field
    });
  }
  isQuickNavigate() {
    return true;
  }
}
class ToggleFullScreenAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.toggleFullScreen",
      title: {
        ...localize2("toggleFullScreen", "Toggle Full Screen"),
        mnemonicTitle: localize({ key: "miToggleFullScreen", comment: ["&& denotes a mnemonic"] }, "&&Full Screen")
      },
      category: Categories.View,
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyCode.F11,
        mac: {
          primary: KeyMod.CtrlCmd | KeyMod.WinCtrl | KeyCode.KeyF
        }
      },
      precondition: IsIOSContext.toNegated(),
      toggled: IsMainWindowFullscreenContext,
      menu: [{
        id: MenuId.MenubarAppearanceMenu,
        group: "1_toggle_view",
        order: 1
      }]
    });
  }
  run(accessor) {
    const hostService = accessor.get(IHostService);
    return hostService.toggleFullScreen(getActiveWindow());
  }
}
const _ReloadWindowAction = class _ReloadWindowAction extends Action2 {
  constructor() {
    super({
      id: _ReloadWindowAction.ID,
      title: localize2("reloadWindow", "Reload Window"),
      category: Categories.Developer,
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib + 50,
        when: IsDevelopmentContext,
        primary: KeyMod.CtrlCmd | KeyCode.KeyR
      }
    });
  }
  async run(accessor) {
    const hostService = accessor.get(IHostService);
    return hostService.reload();
  }
};
_ReloadWindowAction.ID = "workbench.action.reloadWindow";
let ReloadWindowAction = _ReloadWindowAction;
class ShowAboutDialogAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.showAboutDialog",
      title: {
        ...localize2("about", "About"),
        mnemonicTitle: localize({ key: "miAbout", comment: ["&& denotes a mnemonic"] }, "&&About")
      },
      category: Categories.Help,
      f1: true,
      menu: {
        id: MenuId.MenubarHelpMenu,
        group: "z_about",
        order: 1,
        when: IsMacNativeContext.toNegated()
      }
    });
  }
  run(accessor) {
    const dialogService = accessor.get(IDialogService);
    return dialogService.about();
  }
}
class NewWindowAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.newWindow",
      title: {
        ...localize2("newWindow", "New Window"),
        mnemonicTitle: localize({ key: "miNewWindow", comment: ["&& denotes a mnemonic"] }, "New &&Window")
      },
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: isWeb ? isWindows ? KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.Shift | KeyCode.KeyN) : KeyMod.CtrlCmd | KeyMod.Alt | KeyMod.Shift | KeyCode.KeyN : KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyN,
        secondary: isWeb ? [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyN] : void 0
      },
      menu: {
        id: MenuId.MenubarFileMenu,
        group: "1_new",
        order: 3
      }
    });
  }
  run(accessor) {
    const hostService = accessor.get(IHostService);
    return hostService.openWindow({ remoteAuthority: null });
  }
}
class BlurAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.blur",
      title: localize2("blur", "Remove keyboard focus from focused element")
    });
  }
  run() {
    const activeElement = getActiveElement();
    if (isHTMLElement(activeElement)) {
      activeElement.blur();
    }
  }
}
registerAction2(NewWindowAction);
registerAction2(ToggleFullScreenAction);
registerAction2(QuickPickRecentAction);
registerAction2(OpenRecentAction);
registerAction2(ReloadWindowAction);
registerAction2(ShowAboutDialogAction);
registerAction2(BlurAction);
const recentFilesPickerContext = ContextKeyExpr.and(inQuickPickContext, ContextKeyExpr.has(inRecentFilesPickerContextKey));
const quickPickNavigateNextInRecentFilesPickerId = "workbench.action.quickOpenNavigateNextInRecentFilesPicker";
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: quickPickNavigateNextInRecentFilesPickerId,
  weight: KeybindingWeight.WorkbenchContrib + 50,
  handler: getQuickNavigateHandler(quickPickNavigateNextInRecentFilesPickerId, true),
  when: recentFilesPickerContext,
  primary: KeyMod.CtrlCmd | KeyCode.KeyR,
  mac: { primary: KeyMod.WinCtrl | KeyCode.KeyR }
});
const quickPickNavigatePreviousInRecentFilesPicker = "workbench.action.quickOpenNavigatePreviousInRecentFilesPicker";
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: quickPickNavigatePreviousInRecentFilesPicker,
  weight: KeybindingWeight.WorkbenchContrib + 50,
  handler: getQuickNavigateHandler(quickPickNavigatePreviousInRecentFilesPicker, false),
  when: recentFilesPickerContext,
  primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyR,
  mac: { primary: KeyMod.WinCtrl | KeyMod.Shift | KeyCode.KeyR }
});
CommandsRegistry.registerCommand("workbench.action.toggleConfirmBeforeClose", (accessor) => {
  const configurationService = accessor.get(IConfigurationService);
  const setting = configurationService.inspect("window.confirmBeforeClose").userValue;
  return configurationService.updateValue("window.confirmBeforeClose", setting === "never" ? "keyboardOnly" : "never");
});
MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
  group: "z_ConfirmClose",
  command: {
    id: "workbench.action.toggleConfirmBeforeClose",
    title: localize("miConfirmClose", "Confirm Before Close"),
    toggled: ContextKeyExpr.notEquals("config.window.confirmBeforeClose", "never")
  },
  order: 1,
  when: IsWebContext
});
MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
  title: localize({ key: "miOpenRecent", comment: ["&& denotes a mnemonic"] }, "Open &&Recent"),
  submenu: MenuId.MenubarRecentMenu,
  group: "2_open",
  order: 4
});
export {
  OpenRecentAction,
  ReloadWindowAction,
  inRecentFilesPickerContextKey
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9hY3Rpb25zL3dpbmRvd0FjdGlvbnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBsb2NhbGl6ZSwgbG9jYWxpemUyIH0gZnJvbSAnLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElXaW5kb3dPcGVuYWJsZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3dpbmRvdy9jb21tb24vd2luZG93LmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBNZW51UmVnaXN0cnksIE1lbnVJZCwgQWN0aW9uMiwgcmVnaXN0ZXJBY3Rpb24yLCBJQWN0aW9uMk9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IEtleUNob3JkLCBLZXlDb2RlLCBLZXlNb2QgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBJc01haW5XaW5kb3dGdWxsc2NyZWVuQ29udGV4dCB9IGZyb20gJy4uLy4uL2NvbW1vbi9jb250ZXh0a2V5cy5qcyc7XG5pbXBvcnQgeyBJc01hY05hdGl2ZUNvbnRleHQsIElzRGV2ZWxvcG1lbnRDb250ZXh0LCBJc1dlYkNvbnRleHQsIElzSU9TQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXlzLmpzJztcbmltcG9ydCB7IENhdGVnb3JpZXMgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb24vY29tbW9uL2FjdGlvbkNvbW1vbkNhdGVnb3JpZXMuanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ3NSZWdpc3RyeSwgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVF1aWNrSW5wdXRCdXR0b24sIElRdWlja0lucHV0U2VydmljZSwgSVF1aWNrUGlja1NlcGFyYXRvciwgSUtleU1vZHMsIElRdWlja1BpY2tJdGVtIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIElXb3Jrc3BhY2VJZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSwgVmVyYm9zaXR5IH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vbGFiZWwvY29tbW9uL2xhYmVsLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IElSZWNlbnQsIGlzUmVjZW50Rm9sZGVyLCBpc1JlY2VudFdvcmtzcGFjZSwgSVdvcmtzcGFjZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlcy9jb21tb24vd29ya3NwYWNlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZ2V0SWNvbkNsYXNzZXMgfSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL2dldEljb25DbGFzc2VzLmpzJztcbmltcG9ydCB7IEZpbGVLaW5kIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IHNwbGl0UmVjZW50TGFiZWwgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9sYWJlbHMuanMnO1xuaW1wb3J0IHsgaXNNYWNpbnRvc2gsIGlzV2ViLCBpc1dpbmRvd3MgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgaW5RdWlja1BpY2tDb250ZXh0LCBnZXRRdWlja05hdmlnYXRlSGFuZGxlciB9IGZyb20gJy4uL3F1aWNrYWNjZXNzLmpzJztcbmltcG9ydCB7IElIb3N0U2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2hvc3QvYnJvd3Nlci9ob3N0LmpzJztcbmltcG9ydCB7IFJlc291cmNlTWFwIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgQ29tbWFuZHNSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IGlzRm9sZGVyQmFja3VwSW5mbywgaXNXb3Jrc3BhY2VCYWNrdXBJbmZvIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vYmFja3VwL2NvbW1vbi9iYWNrdXAuanMnO1xuaW1wb3J0IHsgZ2V0QWN0aXZlRWxlbWVudCwgZ2V0QWN0aXZlV2luZG93LCBpc0hUTUxFbGVtZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5cbmV4cG9ydCBjb25zdCBpblJlY2VudEZpbGVzUGlja2VyQ29udGV4dEtleSA9ICdpblJlY2VudEZpbGVzUGlja2VyJztcblxuaW50ZXJmYWNlIElSZWNlbnRseU9wZW5lZFBpY2sgZXh0ZW5kcyBJUXVpY2tQaWNrSXRlbSB7XG5cdHJlc291cmNlOiBVUkk7XG5cdG9wZW5hYmxlOiBJV2luZG93T3BlbmFibGU7XG5cdHJlbW90ZUF1dGhvcml0eTogc3RyaW5nIHwgdW5kZWZpbmVkO1xufVxuXG5hYnN0cmFjdCBjbGFzcyBCYXNlT3BlblJlY2VudEFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgcmVtb3ZlRnJvbVJlY2VudGx5T3BlbmVkOiBJUXVpY2tJbnB1dEJ1dHRvbiA9IHtcblx0XHRpY29uQ2xhc3M6IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShDb2RpY29uLnJlbW92ZUNsb3NlKSxcblx0XHR0b29sdGlwOiBsb2NhbGl6ZSgncmVtb3ZlJywgXCJSZW1vdmUgZnJvbSBSZWNlbnRseSBPcGVuZWRcIilcblx0fTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGRpcnR5UmVjZW50bHlPcGVuZWRGb2xkZXI6IElRdWlja0lucHV0QnV0dG9uID0ge1xuXHRcdGljb25DbGFzczogJ2RpcnR5LXdvcmtzcGFjZSAnICsgVGhlbWVJY29uLmFzQ2xhc3NOYW1lKENvZGljb24uY2xvc2VEaXJ0eSksXG5cdFx0dG9vbHRpcDogbG9jYWxpemUoJ2RpcnR5UmVjZW50bHlPcGVuZWRGb2xkZXInLCBcIkZvbGRlciBXaXRoIFVuc2F2ZWQgRmlsZXNcIiksXG5cdFx0YWx3YXlzVmlzaWJsZTogdHJ1ZVxuXHR9O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZGlydHlSZWNlbnRseU9wZW5lZFdvcmtzcGFjZTogSVF1aWNrSW5wdXRCdXR0b24gPSB7XG5cdFx0Li4udGhpcy5kaXJ0eVJlY2VudGx5T3BlbmVkRm9sZGVyLFxuXHRcdHRvb2x0aXA6IGxvY2FsaXplKCdkaXJ0eVJlY2VudGx5T3BlbmVkV29ya3NwYWNlJywgXCJXb3Jrc3BhY2UgV2l0aCBVbnNhdmVkIEZpbGVzXCIpLFxuXHR9O1xuXG5cdGNvbnN0cnVjdG9yKGRlc2M6IFJlYWRvbmx5PElBY3Rpb24yT3B0aW9ucz4pIHtcblx0XHRzdXBlcihkZXNjKTtcblx0fVxuXG5cdHByb3RlY3RlZCBhYnN0cmFjdCBpc1F1aWNrTmF2aWdhdGUoKTogYm9vbGVhbjtcblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB3b3Jrc3BhY2VzU2VydmljZSA9IGFjY2Vzc29yLmdldChJV29ya3NwYWNlc1NlcnZpY2UpO1xuXHRcdGNvbnN0IHF1aWNrSW5wdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElRdWlja0lucHV0U2VydmljZSk7XG5cdFx0Y29uc3QgY29udGV4dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlKTtcblx0XHRjb25zdCBsYWJlbFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxhYmVsU2VydmljZSk7XG5cdFx0Y29uc3Qga2V5YmluZGluZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUtleWJpbmRpbmdTZXJ2aWNlKTtcblx0XHRjb25zdCBtb2RlbFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU1vZGVsU2VydmljZSk7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMYW5ndWFnZVNlcnZpY2UpO1xuXHRcdGNvbnN0IGhvc3RTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElIb3N0U2VydmljZSk7XG5cdFx0Y29uc3QgZGlhbG9nU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGlhbG9nU2VydmljZSk7XG5cblx0XHRjb25zdCByZWNlbnRseU9wZW5lZCA9IGF3YWl0IHdvcmtzcGFjZXNTZXJ2aWNlLmdldFJlY2VudGx5T3BlbmVkKCk7XG5cdFx0Y29uc3QgZGlydHlXb3Jrc3BhY2VzQW5kRm9sZGVycyA9IGF3YWl0IHdvcmtzcGFjZXNTZXJ2aWNlLmdldERpcnR5V29ya3NwYWNlcygpO1xuXG5cdFx0bGV0IGhhc1dvcmtzcGFjZXMgPSBmYWxzZTtcblxuXHRcdC8vIElkZW50aWZ5IGFsbCBmb2xkZXJzIGFuZCB3b3Jrc3BhY2VzIHdpdGggdW5zYXZlZCBmaWxlc1xuXHRcdGNvbnN0IGRpcnR5Rm9sZGVycyA9IG5ldyBSZXNvdXJjZU1hcDxib29sZWFuPigpO1xuXHRcdGNvbnN0IGRpcnR5V29ya3NwYWNlcyA9IG5ldyBSZXNvdXJjZU1hcDxJV29ya3NwYWNlSWRlbnRpZmllcj4oKTtcblx0XHRmb3IgKGNvbnN0IGRpcnR5V29ya3NwYWNlIG9mIGRpcnR5V29ya3NwYWNlc0FuZEZvbGRlcnMpIHtcblx0XHRcdGlmIChpc0ZvbGRlckJhY2t1cEluZm8oZGlydHlXb3Jrc3BhY2UpKSB7XG5cdFx0XHRcdGRpcnR5Rm9sZGVycy5zZXQoZGlydHlXb3Jrc3BhY2UuZm9sZGVyVXJpLCB0cnVlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGRpcnR5V29ya3NwYWNlcy5zZXQoZGlydHlXb3Jrc3BhY2Uud29ya3NwYWNlLmNvbmZpZ1BhdGgsIGRpcnR5V29ya3NwYWNlLndvcmtzcGFjZSk7XG5cdFx0XHRcdGhhc1dvcmtzcGFjZXMgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIElkZW50aWZ5IGFsbCByZWNlbnRseSBvcGVuZWQgZm9sZGVycyBhbmQgd29ya3NwYWNlc1xuXHRcdGNvbnN0IHJlY2VudEZvbGRlcnMgPSBuZXcgUmVzb3VyY2VNYXA8Ym9vbGVhbj4oKTtcblx0XHRjb25zdCByZWNlbnRXb3Jrc3BhY2VzID0gbmV3IFJlc291cmNlTWFwPElXb3Jrc3BhY2VJZGVudGlmaWVyPigpO1xuXHRcdGZvciAoY29uc3QgcmVjZW50IG9mIHJlY2VudGx5T3BlbmVkLndvcmtzcGFjZXMpIHtcblx0XHRcdGlmIChpc1JlY2VudEZvbGRlcihyZWNlbnQpKSB7XG5cdFx0XHRcdHJlY2VudEZvbGRlcnMuc2V0KHJlY2VudC5mb2xkZXJVcmksIHRydWUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVjZW50V29ya3NwYWNlcy5zZXQocmVjZW50LndvcmtzcGFjZS5jb25maWdQYXRoLCByZWNlbnQud29ya3NwYWNlKTtcblx0XHRcdFx0aGFzV29ya3NwYWNlcyA9IHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gRmlsbCBpbiBhbGwga25vd24gcmVjZW50bHkgb3BlbmVkIHdvcmtzcGFjZXNcblx0XHRjb25zdCB3b3Jrc3BhY2VQaWNrczogSVJlY2VudGx5T3BlbmVkUGlja1tdID0gW107XG5cdFx0Zm9yIChjb25zdCByZWNlbnQgb2YgcmVjZW50bHlPcGVuZWQud29ya3NwYWNlcykge1xuXHRcdFx0Y29uc3QgaXNEaXJ0eSA9IGlzUmVjZW50Rm9sZGVyKHJlY2VudCkgPyBkaXJ0eUZvbGRlcnMuaGFzKHJlY2VudC5mb2xkZXJVcmkpIDogZGlydHlXb3Jrc3BhY2VzLmhhcyhyZWNlbnQud29ya3NwYWNlLmNvbmZpZ1BhdGgpO1xuXG5cdFx0XHR3b3Jrc3BhY2VQaWNrcy5wdXNoKHRoaXMudG9RdWlja1BpY2sobW9kZWxTZXJ2aWNlLCBsYW5ndWFnZVNlcnZpY2UsIGxhYmVsU2VydmljZSwgcmVjZW50LCBpc0RpcnR5KSk7XG5cdFx0fVxuXG5cdFx0Ly8gRmlsbCBhbnkgYmFja3VwIHdvcmtzcGFjZSB0aGF0IGlzIG5vdCB5ZXQgc2hvd24gYXQgdGhlIGVuZFxuXHRcdGZvciAoY29uc3QgZGlydHlXb3Jrc3BhY2VPckZvbGRlciBvZiBkaXJ0eVdvcmtzcGFjZXNBbmRGb2xkZXJzKSB7XG5cdFx0XHRpZiAoaXNGb2xkZXJCYWNrdXBJbmZvKGRpcnR5V29ya3NwYWNlT3JGb2xkZXIpICYmICFyZWNlbnRGb2xkZXJzLmhhcyhkaXJ0eVdvcmtzcGFjZU9yRm9sZGVyLmZvbGRlclVyaSkpIHtcblx0XHRcdFx0d29ya3NwYWNlUGlja3MucHVzaCh0aGlzLnRvUXVpY2tQaWNrKG1vZGVsU2VydmljZSwgbGFuZ3VhZ2VTZXJ2aWNlLCBsYWJlbFNlcnZpY2UsIGRpcnR5V29ya3NwYWNlT3JGb2xkZXIsIHRydWUpKTtcblx0XHRcdH0gZWxzZSBpZiAoaXNXb3Jrc3BhY2VCYWNrdXBJbmZvKGRpcnR5V29ya3NwYWNlT3JGb2xkZXIpICYmICFyZWNlbnRXb3Jrc3BhY2VzLmhhcyhkaXJ0eVdvcmtzcGFjZU9yRm9sZGVyLndvcmtzcGFjZS5jb25maWdQYXRoKSkge1xuXHRcdFx0XHR3b3Jrc3BhY2VQaWNrcy5wdXNoKHRoaXMudG9RdWlja1BpY2sobW9kZWxTZXJ2aWNlLCBsYW5ndWFnZVNlcnZpY2UsIGxhYmVsU2VydmljZSwgZGlydHlXb3Jrc3BhY2VPckZvbGRlciwgdHJ1ZSkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGZpbGVQaWNrcyA9IHJlY2VudGx5T3BlbmVkLmZpbGVzLm1hcChwID0+IHRoaXMudG9RdWlja1BpY2sobW9kZWxTZXJ2aWNlLCBsYW5ndWFnZVNlcnZpY2UsIGxhYmVsU2VydmljZSwgcCwgZmFsc2UpKTtcblxuXHRcdC8vIGZvY3VzIHNlY29uZCBlbnRyeSBpZiB0aGUgZmlyc3QgcmVjZW50IHdvcmtzcGFjZSBpcyB0aGUgY3VycmVudCB3b3Jrc3BhY2Vcblx0XHRjb25zdCBmaXJzdEVudHJ5ID0gcmVjZW50bHlPcGVuZWQud29ya3NwYWNlc1swXTtcblx0XHRjb25zdCBhdXRvRm9jdXNTZWNvbmRFbnRyeTogYm9vbGVhbiA9IGZpcnN0RW50cnkgJiYgY29udGV4dFNlcnZpY2UuaXNDdXJyZW50V29ya3NwYWNlKGlzUmVjZW50V29ya3NwYWNlKGZpcnN0RW50cnkpID8gZmlyc3RFbnRyeS53b3Jrc3BhY2UgOiBmaXJzdEVudHJ5LmZvbGRlclVyaSk7XG5cblx0XHRsZXQga2V5TW9kczogSUtleU1vZHMgfCB1bmRlZmluZWQ7XG5cblx0XHRjb25zdCB3b3Jrc3BhY2VTZXBhcmF0b3I6IElRdWlja1BpY2tTZXBhcmF0b3IgPSB7IHR5cGU6ICdzZXBhcmF0b3InLCBsYWJlbDogaGFzV29ya3NwYWNlcyA/IGxvY2FsaXplKCd3b3Jrc3BhY2VzQW5kRm9sZGVycycsIFwiZm9sZGVycyAmIHdvcmtzcGFjZXNcIikgOiBsb2NhbGl6ZSgnZm9sZGVycycsIFwiZm9sZGVyc1wiKSB9O1xuXHRcdGNvbnN0IGZpbGVTZXBhcmF0b3I6IElRdWlja1BpY2tTZXBhcmF0b3IgPSB7IHR5cGU6ICdzZXBhcmF0b3InLCBsYWJlbDogbG9jYWxpemUoJ2ZpbGVzJywgXCJmaWxlc1wiKSB9O1xuXHRcdGNvbnN0IHBpY2tzID0gW3dvcmtzcGFjZVNlcGFyYXRvciwgLi4ud29ya3NwYWNlUGlja3MsIGZpbGVTZXBhcmF0b3IsIC4uLmZpbGVQaWNrc107XG5cblx0XHRjb25zdCBwaWNrID0gYXdhaXQgcXVpY2tJbnB1dFNlcnZpY2UucGljayhwaWNrcywge1xuXHRcdFx0Y29udGV4dEtleTogaW5SZWNlbnRGaWxlc1BpY2tlckNvbnRleHRLZXksXG5cdFx0XHRhY3RpdmVJdGVtOiBbLi4ud29ya3NwYWNlUGlja3MsIC4uLmZpbGVQaWNrc11bYXV0b0ZvY3VzU2Vjb25kRW50cnkgPyAxIDogMF0sXG5cdFx0XHRwbGFjZUhvbGRlcjogaXNNYWNpbnRvc2ggPyBsb2NhbGl6ZSgnb3BlblJlY2VudFBsYWNlaG9sZGVyTWFjJywgXCJTZWxlY3QgdG8gb3BlbiAoaG9sZCBDbWQta2V5IHRvIGZvcmNlIG5ldyB3aW5kb3cgb3IgT3B0aW9uLWtleSBmb3Igc2FtZSB3aW5kb3cpXCIpIDogbG9jYWxpemUoJ29wZW5SZWNlbnRQbGFjZWhvbGRlcicsIFwiU2VsZWN0IHRvIG9wZW4gKGhvbGQgQ3RybC1rZXkgdG8gZm9yY2UgbmV3IHdpbmRvdyBvciBBbHQta2V5IGZvciBzYW1lIHdpbmRvdylcIiksXG5cdFx0XHRtYXRjaE9uRGVzY3JpcHRpb246IHRydWUsXG5cdFx0XHRvbktleU1vZHM6IG1vZHMgPT4ga2V5TW9kcyA9IG1vZHMsXG5cdFx0XHRxdWlja05hdmlnYXRlOiB0aGlzLmlzUXVpY2tOYXZpZ2F0ZSgpID8geyBrZXliaW5kaW5nczoga2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZ3ModGhpcy5kZXNjLmlkKSB9IDogdW5kZWZpbmVkLFxuXHRcdFx0aGlkZUlucHV0OiB0aGlzLmlzUXVpY2tOYXZpZ2F0ZSgpLFxuXHRcdFx0b25EaWRUcmlnZ2VySXRlbUJ1dHRvbjogYXN5bmMgY29udGV4dCA9PiB7XG5cblx0XHRcdFx0Ly8gUmVtb3ZlXG5cdFx0XHRcdGlmIChjb250ZXh0LmJ1dHRvbiA9PT0gdGhpcy5yZW1vdmVGcm9tUmVjZW50bHlPcGVuZWQpIHtcblx0XHRcdFx0XHRhd2FpdCB3b3Jrc3BhY2VzU2VydmljZS5yZW1vdmVSZWNlbnRseU9wZW5lZChbY29udGV4dC5pdGVtLnJlc291cmNlXSk7XG5cdFx0XHRcdFx0Y29udGV4dC5yZW1vdmVJdGVtKCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBEaXJ0eSBGb2xkZXIvV29ya3NwYWNlXG5cdFx0XHRcdGVsc2UgaWYgKGNvbnRleHQuYnV0dG9uID09PSB0aGlzLmRpcnR5UmVjZW50bHlPcGVuZWRGb2xkZXIgfHwgY29udGV4dC5idXR0b24gPT09IHRoaXMuZGlydHlSZWNlbnRseU9wZW5lZFdvcmtzcGFjZSkge1xuXHRcdFx0XHRcdGNvbnN0IGlzRGlydHlXb3Jrc3BhY2UgPSBjb250ZXh0LmJ1dHRvbiA9PT0gdGhpcy5kaXJ0eVJlY2VudGx5T3BlbmVkV29ya3NwYWNlO1xuXHRcdFx0XHRcdGNvbnN0IHsgY29uZmlybWVkIH0gPSBhd2FpdCBkaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0XHRcdFx0dGl0bGU6IGlzRGlydHlXb3Jrc3BhY2UgPyBsb2NhbGl6ZSgnZGlydHlXb3Jrc3BhY2UnLCBcIldvcmtzcGFjZSB3aXRoIFVuc2F2ZWQgRmlsZXNcIikgOiBsb2NhbGl6ZSgnZGlydHlGb2xkZXInLCBcIkZvbGRlciB3aXRoIFVuc2F2ZWQgRmlsZXNcIiksXG5cdFx0XHRcdFx0XHRtZXNzYWdlOiBpc0RpcnR5V29ya3NwYWNlID8gbG9jYWxpemUoJ2RpcnR5V29ya3NwYWNlQ29uZmlybScsIFwiRG8geW91IHdhbnQgdG8gb3BlbiB0aGUgd29ya3NwYWNlIHRvIHJldmlldyB0aGUgdW5zYXZlZCBmaWxlcz9cIikgOiBsb2NhbGl6ZSgnZGlydHlGb2xkZXJDb25maXJtJywgXCJEbyB5b3Ugd2FudCB0byBvcGVuIHRoZSBmb2xkZXIgdG8gcmV2aWV3IHRoZSB1bnNhdmVkIGZpbGVzP1wiKSxcblx0XHRcdFx0XHRcdGRldGFpbDogaXNEaXJ0eVdvcmtzcGFjZSA/IGxvY2FsaXplKCdkaXJ0eVdvcmtzcGFjZUNvbmZpcm1EZXRhaWwnLCBcIldvcmtzcGFjZXMgd2l0aCB1bnNhdmVkIGZpbGVzIGNhbm5vdCBiZSByZW1vdmVkIHVudGlsIGFsbCB1bnNhdmVkIGZpbGVzIGhhdmUgYmVlbiBzYXZlZCBvciByZXZlcnRlZC5cIikgOiBsb2NhbGl6ZSgnZGlydHlGb2xkZXJDb25maXJtRGV0YWlsJywgXCJGb2xkZXJzIHdpdGggdW5zYXZlZCBmaWxlcyBjYW5ub3QgYmUgcmVtb3ZlZCB1bnRpbCBhbGwgdW5zYXZlZCBmaWxlcyBoYXZlIGJlZW4gc2F2ZWQgb3IgcmV2ZXJ0ZWQuXCIpXG5cdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHRpZiAoY29uZmlybWVkKSB7XG5cdFx0XHRcdFx0XHRob3N0U2VydmljZS5vcGVuV2luZG93KFxuXHRcdFx0XHRcdFx0XHRbY29udGV4dC5pdGVtLm9wZW5hYmxlXSwge1xuXHRcdFx0XHRcdFx0XHRyZW1vdGVBdXRob3JpdHk6IGNvbnRleHQuaXRlbS5yZW1vdGVBdXRob3JpdHkgfHwgbnVsbCAvLyBsb2NhbCB3aW5kb3cgaWYgcmVtb3RlQXV0aG9yaXR5IGlzIG5vdCBzZXQgb3IgY2FuIG5vdCBiZSBkZWR1Y3RlZCBmcm9tIHRoZSBvcGVuYWJsZVxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRxdWlja0lucHV0U2VydmljZS5jYW5jZWwoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGlmIChwaWNrKSB7XG5cdFx0XHRyZXR1cm4gaG9zdFNlcnZpY2Uub3BlbldpbmRvdyhbcGljay5vcGVuYWJsZV0sIHtcblx0XHRcdFx0Zm9yY2VOZXdXaW5kb3c6IGtleU1vZHM/LmN0cmxDbWQsXG5cdFx0XHRcdGZvcmNlUmV1c2VXaW5kb3c6IGtleU1vZHM/LmFsdCxcblx0XHRcdFx0cmVtb3RlQXV0aG9yaXR5OiBwaWNrLnJlbW90ZUF1dGhvcml0eSB8fCBudWxsIC8vIGxvY2FsIHdpbmRvdyBpZiByZW1vdGVBdXRob3JpdHkgaXMgbm90IHNldCBvciBjYW4gbm90IGJlIGRlZHVjdGVkIGZyb20gdGhlIG9wZW5hYmxlXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHRvUXVpY2tQaWNrKG1vZGVsU2VydmljZTogSU1vZGVsU2VydmljZSwgbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLCBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsIHJlY2VudDogSVJlY2VudCwgaXNEaXJ0eTogYm9vbGVhbik6IElSZWNlbnRseU9wZW5lZFBpY2sge1xuXHRcdGxldCBvcGVuYWJsZTogSVdpbmRvd09wZW5hYmxlIHwgdW5kZWZpbmVkO1xuXHRcdGxldCBpY29uQ2xhc3Nlczogc3RyaW5nW107XG5cdFx0bGV0IGZ1bGxMYWJlbDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdGxldCByZXNvdXJjZTogVVJJIHwgdW5kZWZpbmVkO1xuXHRcdGxldCBpc1dvcmtzcGFjZSA9IGZhbHNlO1xuXG5cdFx0Ly8gRm9sZGVyXG5cdFx0aWYgKGlzUmVjZW50Rm9sZGVyKHJlY2VudCkpIHtcblx0XHRcdHJlc291cmNlID0gcmVjZW50LmZvbGRlclVyaTtcblx0XHRcdGljb25DbGFzc2VzID0gZ2V0SWNvbkNsYXNzZXMobW9kZWxTZXJ2aWNlLCBsYW5ndWFnZVNlcnZpY2UsIHJlc291cmNlLCBGaWxlS2luZC5GT0xERVIpO1xuXHRcdFx0b3BlbmFibGUgPSB7IGZvbGRlclVyaTogcmVzb3VyY2UgfTtcblx0XHRcdGZ1bGxMYWJlbCA9IHJlY2VudC5sYWJlbCB8fCBsYWJlbFNlcnZpY2UuZ2V0V29ya3NwYWNlTGFiZWwocmVzb3VyY2UsIHsgdmVyYm9zZTogVmVyYm9zaXR5LkxPTkcgfSk7XG5cdFx0fVxuXG5cdFx0Ly8gV29ya3NwYWNlXG5cdFx0ZWxzZSBpZiAoaXNSZWNlbnRXb3Jrc3BhY2UocmVjZW50KSkge1xuXHRcdFx0cmVzb3VyY2UgPSByZWNlbnQud29ya3NwYWNlLmNvbmZpZ1BhdGg7XG5cdFx0XHRpY29uQ2xhc3NlcyA9IGdldEljb25DbGFzc2VzKG1vZGVsU2VydmljZSwgbGFuZ3VhZ2VTZXJ2aWNlLCByZXNvdXJjZSwgRmlsZUtpbmQuUk9PVF9GT0xERVIpO1xuXHRcdFx0b3BlbmFibGUgPSB7IHdvcmtzcGFjZVVyaTogcmVzb3VyY2UgfTtcblx0XHRcdGZ1bGxMYWJlbCA9IHJlY2VudC5sYWJlbCB8fCBsYWJlbFNlcnZpY2UuZ2V0V29ya3NwYWNlTGFiZWwocmVjZW50LndvcmtzcGFjZSwgeyB2ZXJib3NlOiBWZXJib3NpdHkuTE9ORyB9KTtcblx0XHRcdGlzV29ya3NwYWNlID0gdHJ1ZTtcblx0XHR9XG5cblx0XHQvLyBGaWxlXG5cdFx0ZWxzZSB7XG5cdFx0XHRyZXNvdXJjZSA9IHJlY2VudC5maWxlVXJpO1xuXHRcdFx0aWNvbkNsYXNzZXMgPSBnZXRJY29uQ2xhc3Nlcyhtb2RlbFNlcnZpY2UsIGxhbmd1YWdlU2VydmljZSwgcmVzb3VyY2UsIEZpbGVLaW5kLkZJTEUpO1xuXHRcdFx0b3BlbmFibGUgPSB7IGZpbGVVcmk6IHJlc291cmNlIH07XG5cdFx0XHRmdWxsTGFiZWwgPSByZWNlbnQubGFiZWwgfHwgbGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKHJlc291cmNlLCB7IGFwcGVuZFdvcmtzcGFjZVN1ZmZpeDogdHJ1ZSB9KTtcblx0XHR9XG5cblx0XHRjb25zdCB7IG5hbWUsIHBhcmVudFBhdGggfSA9IHNwbGl0UmVjZW50TGFiZWwoZnVsbExhYmVsKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRpY29uQ2xhc3Nlcyxcblx0XHRcdGxhYmVsOiBuYW1lLFxuXHRcdFx0YXJpYUxhYmVsOiBpc0RpcnR5ID8gaXNXb3Jrc3BhY2UgPyBsb2NhbGl6ZSgncmVjZW50RGlydHlXb3Jrc3BhY2VBcmlhTGFiZWwnLCBcInswfSwgd29ya3NwYWNlIHdpdGggdW5zYXZlZCBjaGFuZ2VzXCIsIG5hbWUpIDogbG9jYWxpemUoJ3JlY2VudERpcnR5Rm9sZGVyQXJpYUxhYmVsJywgXCJ7MH0sIGZvbGRlciB3aXRoIHVuc2F2ZWQgY2hhbmdlc1wiLCBuYW1lKSA6IG5hbWUsXG5cdFx0XHRkZXNjcmlwdGlvbjogcGFyZW50UGF0aCxcblx0XHRcdGJ1dHRvbnM6IGlzRGlydHkgPyBbaXNXb3Jrc3BhY2UgPyB0aGlzLmRpcnR5UmVjZW50bHlPcGVuZWRXb3Jrc3BhY2UgOiB0aGlzLmRpcnR5UmVjZW50bHlPcGVuZWRGb2xkZXJdIDogW3RoaXMucmVtb3ZlRnJvbVJlY2VudGx5T3BlbmVkXSxcblx0XHRcdG9wZW5hYmxlLFxuXHRcdFx0cmVzb3VyY2UsXG5cdFx0XHRyZW1vdGVBdXRob3JpdHk6IHJlY2VudC5yZW1vdGVBdXRob3JpdHlcblx0XHR9O1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBPcGVuUmVjZW50QWN0aW9uIGV4dGVuZHMgQmFzZU9wZW5SZWNlbnRBY3Rpb24ge1xuXG5cdHN0YXRpYyBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLm9wZW5SZWNlbnQnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBPcGVuUmVjZW50QWN0aW9uLklELFxuXHRcdFx0dGl0bGU6IHtcblx0XHRcdFx0Li4ubG9jYWxpemUyKCdvcGVuUmVjZW50JywgXCJPcGVuIFJlY2VudC4uLlwiKSxcblx0XHRcdFx0bW5lbW9uaWNUaXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaU1vcmUnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZNb3JlLi4uXCIpLFxuXHRcdFx0fSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLkZpbGUsXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlSLFxuXHRcdFx0XHRtYWM6IHsgcHJpbWFyeTogS2V5TW9kLldpbkN0cmwgfCBLZXlDb2RlLktleVIgfVxuXHRcdFx0fSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5NZW51YmFyUmVjZW50TWVudSxcblx0XHRcdFx0Z3JvdXA6ICd5X21vcmUnLFxuXHRcdFx0XHRvcmRlcjogMVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIGlzUXVpY2tOYXZpZ2F0ZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cbn1cblxuY2xhc3MgUXVpY2tQaWNrUmVjZW50QWN0aW9uIGV4dGVuZHMgQmFzZU9wZW5SZWNlbnRBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5xdWlja09wZW5SZWNlbnQnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMigncXVpY2tPcGVuUmVjZW50JywgJ1F1aWNrIE9wZW4gUmVjZW50Li4uJyksXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5GaWxlLFxuXHRcdFx0ZjE6IGZhbHNlIC8vIGhpZGUgcXVpY2sgcGlja2VycyBmcm9tIGNvbW1hbmQgcGFsZXR0ZSB0byBub3QgY29uZnVzZSB3aXRoIHRoZSBvdGhlciBlbnRyeSB0aGF0IHNob3dzIGEgaW5wdXQgZmllbGRcblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBpc1F1aWNrTmF2aWdhdGUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cbn1cblxuY2xhc3MgVG9nZ2xlRnVsbFNjcmVlbkFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi50b2dnbGVGdWxsU2NyZWVuJyxcblx0XHRcdHRpdGxlOiB7XG5cdFx0XHRcdC4uLmxvY2FsaXplMigndG9nZ2xlRnVsbFNjcmVlbicsIFwiVG9nZ2xlIEZ1bGwgU2NyZWVuXCIpLFxuXHRcdFx0XHRtbmVtb25pY1RpdGxlOiBsb2NhbGl6ZSh7IGtleTogJ21pVG9nZ2xlRnVsbFNjcmVlbicsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJkZ1bGwgU2NyZWVuXCIpLFxuXHRcdFx0fSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXcsXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNvZGUuRjExLFxuXHRcdFx0XHRtYWM6IHtcblx0XHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5XaW5DdHJsIHwgS2V5Q29kZS5LZXlGXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRwcmVjb25kaXRpb246IElzSU9TQ29udGV4dC50b05lZ2F0ZWQoKSxcblx0XHRcdHRvZ2dsZWQ6IElzTWFpbldpbmRvd0Z1bGxzY3JlZW5Db250ZXh0LFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5NZW51YmFyQXBwZWFyYW5jZU1lbnUsXG5cdFx0XHRcdGdyb3VwOiAnMV90b2dnbGVfdmlldycsXG5cdFx0XHRcdG9yZGVyOiAxXG5cdFx0XHR9XVxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgaG9zdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUhvc3RTZXJ2aWNlKTtcblxuXHRcdHJldHVybiBob3N0U2VydmljZS50b2dnbGVGdWxsU2NyZWVuKGdldEFjdGl2ZVdpbmRvdygpKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUmVsb2FkV2luZG93QWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5hY3Rpb24ucmVsb2FkV2luZG93JztcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogUmVsb2FkV2luZG93QWN0aW9uLklELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMigncmVsb2FkV2luZG93JywgJ1JlbG9hZCBXaW5kb3cnKSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLkRldmVsb3Blcixcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYiArIDUwLFxuXHRcdFx0XHR3aGVuOiBJc0RldmVsb3BtZW50Q29udGV4dCxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleVJcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGhvc3RTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElIb3N0U2VydmljZSk7XG5cblx0XHRyZXR1cm4gaG9zdFNlcnZpY2UucmVsb2FkKCk7XG5cdH1cbn1cblxuY2xhc3MgU2hvd0Fib3V0RGlhbG9nQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLnNob3dBYm91dERpYWxvZycsXG5cdFx0XHR0aXRsZToge1xuXHRcdFx0XHQuLi5sb2NhbGl6ZTIoJ2Fib3V0JywgXCJBYm91dFwiKSxcblx0XHRcdFx0bW5lbW9uaWNUaXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaUFib3V0JywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmQWJvdXRcIiksXG5cdFx0XHR9LFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuSGVscCxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLk1lbnViYXJIZWxwTWVudSxcblx0XHRcdFx0Z3JvdXA6ICd6X2Fib3V0Jyxcblx0XHRcdFx0b3JkZXI6IDEsXG5cdFx0XHRcdHdoZW46IElzTWFjTmF0aXZlQ29udGV4dC50b05lZ2F0ZWQoKVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZGlhbG9nU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGlhbG9nU2VydmljZSk7XG5cblx0XHRyZXR1cm4gZGlhbG9nU2VydmljZS5hYm91dCgpO1xuXHR9XG59XG5cbmNsYXNzIE5ld1dpbmRvd0FjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5uZXdXaW5kb3cnLFxuXHRcdFx0dGl0bGU6IHtcblx0XHRcdFx0Li4ubG9jYWxpemUyKCduZXdXaW5kb3cnLCBcIk5ldyBXaW5kb3dcIiksXG5cdFx0XHRcdG1uZW1vbmljVGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlOZXdXaW5kb3cnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiTmV3ICYmV2luZG93XCIpLFxuXHRcdFx0fSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogaXNXZWIgPyAoaXNXaW5kb3dzID8gS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleU1vZC5TaGlmdCB8IEtleUNvZGUuS2V5TikgOiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5BbHQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLktleU4pIDogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLktleU4sXG5cdFx0XHRcdHNlY29uZGFyeTogaXNXZWIgPyBbS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLktleU5dIDogdW5kZWZpbmVkXG5cdFx0XHR9LFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLk1lbnViYXJGaWxlTWVudSxcblx0XHRcdFx0Z3JvdXA6ICcxX25ldycsXG5cdFx0XHRcdG9yZGVyOiAzXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBob3N0U2VydmljZSA9IGFjY2Vzc29yLmdldChJSG9zdFNlcnZpY2UpO1xuXG5cdFx0cmV0dXJuIGhvc3RTZXJ2aWNlLm9wZW5XaW5kb3coeyByZW1vdGVBdXRob3JpdHk6IG51bGwgfSk7XG5cdH1cbn1cblxuY2xhc3MgQmx1ckFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5ibHVyJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2JsdXInLCAnUmVtb3ZlIGtleWJvYXJkIGZvY3VzIGZyb20gZm9jdXNlZCBlbGVtZW50Jylcblx0XHR9KTtcblx0fVxuXG5cdHJ1bigpOiB2b2lkIHtcblx0XHRjb25zdCBhY3RpdmVFbGVtZW50ID0gZ2V0QWN0aXZlRWxlbWVudCgpO1xuXHRcdGlmIChpc0hUTUxFbGVtZW50KGFjdGl2ZUVsZW1lbnQpKSB7XG5cdFx0XHRhY3RpdmVFbGVtZW50LmJsdXIoKTtcblx0XHR9XG5cdH1cbn1cblxuLy8gLS0tIEFjdGlvbnMgUmVnaXN0cmF0aW9uXG5cbnJlZ2lzdGVyQWN0aW9uMihOZXdXaW5kb3dBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKFRvZ2dsZUZ1bGxTY3JlZW5BY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKFF1aWNrUGlja1JlY2VudEFjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoT3BlblJlY2VudEFjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoUmVsb2FkV2luZG93QWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihTaG93QWJvdXREaWFsb2dBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKEJsdXJBY3Rpb24pO1xuXG4vLyAtLS0gQ29tbWFuZHMvS2V5YmluZGluZ3MgUmVnaXN0cmF0aW9uXG5cbmNvbnN0IHJlY2VudEZpbGVzUGlja2VyQ29udGV4dCA9IENvbnRleHRLZXlFeHByLmFuZChpblF1aWNrUGlja0NvbnRleHQsIENvbnRleHRLZXlFeHByLmhhcyhpblJlY2VudEZpbGVzUGlja2VyQ29udGV4dEtleSkpO1xuXG5jb25zdCBxdWlja1BpY2tOYXZpZ2F0ZU5leHRJblJlY2VudEZpbGVzUGlja2VySWQgPSAnd29ya2JlbmNoLmFjdGlvbi5xdWlja09wZW5OYXZpZ2F0ZU5leHRJblJlY2VudEZpbGVzUGlja2VyJztcbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRpZDogcXVpY2tQaWNrTmF2aWdhdGVOZXh0SW5SZWNlbnRGaWxlc1BpY2tlcklkLFxuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYiArIDUwLFxuXHRoYW5kbGVyOiBnZXRRdWlja05hdmlnYXRlSGFuZGxlcihxdWlja1BpY2tOYXZpZ2F0ZU5leHRJblJlY2VudEZpbGVzUGlja2VySWQsIHRydWUpLFxuXHR3aGVuOiByZWNlbnRGaWxlc1BpY2tlckNvbnRleHQsXG5cdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlSLFxuXHRtYWM6IHsgcHJpbWFyeTogS2V5TW9kLldpbkN0cmwgfCBLZXlDb2RlLktleVIgfVxufSk7XG5cbmNvbnN0IHF1aWNrUGlja05hdmlnYXRlUHJldmlvdXNJblJlY2VudEZpbGVzUGlja2VyID0gJ3dvcmtiZW5jaC5hY3Rpb24ucXVpY2tPcGVuTmF2aWdhdGVQcmV2aW91c0luUmVjZW50RmlsZXNQaWNrZXInO1xuS2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdGlkOiBxdWlja1BpY2tOYXZpZ2F0ZVByZXZpb3VzSW5SZWNlbnRGaWxlc1BpY2tlcixcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIgKyA1MCxcblx0aGFuZGxlcjogZ2V0UXVpY2tOYXZpZ2F0ZUhhbmRsZXIocXVpY2tQaWNrTmF2aWdhdGVQcmV2aW91c0luUmVjZW50RmlsZXNQaWNrZXIsIGZhbHNlKSxcblx0d2hlbjogcmVjZW50RmlsZXNQaWNrZXJDb250ZXh0LFxuXHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuS2V5Uixcblx0bWFjOiB7IHByaW1hcnk6IEtleU1vZC5XaW5DdHJsIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5LZXlSIH1cbn0pO1xuXG5Db21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnd29ya2JlbmNoLmFjdGlvbi50b2dnbGVDb25maXJtQmVmb3JlQ2xvc2UnLCBhY2Nlc3NvciA9PiB7XG5cdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdGNvbnN0IHNldHRpbmcgPSBjb25maWd1cmF0aW9uU2VydmljZS5pbnNwZWN0PCdhbHdheXMnIHwgJ2tleWJvYXJkT25seScgfCAnbmV2ZXInPignd2luZG93LmNvbmZpcm1CZWZvcmVDbG9zZScpLnVzZXJWYWx1ZTtcblxuXHRyZXR1cm4gY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoJ3dpbmRvdy5jb25maXJtQmVmb3JlQ2xvc2UnLCBzZXR0aW5nID09PSAnbmV2ZXInID8gJ2tleWJvYXJkT25seScgOiAnbmV2ZXInKTtcbn0pO1xuXG4vLyAtLS0gTWVudSBSZWdpc3RyYXRpb25cblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyRmlsZU1lbnUsIHtcblx0Z3JvdXA6ICd6X0NvbmZpcm1DbG9zZScsXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24udG9nZ2xlQ29uZmlybUJlZm9yZUNsb3NlJyxcblx0XHR0aXRsZTogbG9jYWxpemUoJ21pQ29uZmlybUNsb3NlJywgXCJDb25maXJtIEJlZm9yZSBDbG9zZVwiKSxcblx0XHR0b2dnbGVkOiBDb250ZXh0S2V5RXhwci5ub3RFcXVhbHMoJ2NvbmZpZy53aW5kb3cuY29uZmlybUJlZm9yZUNsb3NlJywgJ25ldmVyJylcblx0fSxcblx0b3JkZXI6IDEsXG5cdHdoZW46IElzV2ViQ29udGV4dFxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuTWVudWJhckZpbGVNZW51LCB7XG5cdHRpdGxlOiBsb2NhbGl6ZSh7IGtleTogJ21pT3BlblJlY2VudCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJPcGVuICYmUmVjZW50XCIpLFxuXHRzdWJtZW51OiBNZW51SWQuTWVudWJhclJlY2VudE1lbnUsXG5cdGdyb3VwOiAnMl9vcGVuJyxcblx0b3JkZXI6IDRcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxVQUFVLGlCQUFpQjtBQUVwQyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGNBQWMsUUFBUSxTQUFTLHVCQUF3QztBQUNoRixTQUFTLFVBQVUsU0FBUyxjQUFjO0FBQzFDLFNBQVMscUNBQXFDO0FBQzlDLFNBQVMsb0JBQW9CLHNCQUFzQixjQUFjLG9CQUFvQjtBQUNyRixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLHFCQUFxQix3QkFBd0I7QUFDdEQsU0FBNEIsMEJBQXlFO0FBQ3JHLFNBQVMsZ0NBQXNEO0FBQy9ELFNBQVMsZUFBZSxpQkFBaUI7QUFDekMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxxQkFBcUI7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
