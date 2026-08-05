import "./media/actions.css";
import { URI } from "../../../base/common/uri.js";
import { localize, localize2 } from "../../../nls.js";
import { ApplyZoomTarget, MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL, applyZoom } from "../../../platform/window/electron-sandbox/window.js";
import { IKeybindingService } from "../../../platform/keybinding/common/keybinding.js";
import { getZoomLevel } from "../../../base/browser/browser.js";
import { FileKind } from "../../../platform/files/common/files.js";
import { IModelService } from "../../../editor/common/services/model.js";
import { ILanguageService } from "../../../editor/common/languages/language.js";
import { IQuickInputService } from "../../../platform/quickinput/common/quickInput.js";
import { getIconClasses } from "../../../editor/common/services/getIconClasses.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { INativeHostService } from "../../../platform/native/common/native.js";
import { Codicon } from "../../../base/common/codicons.js";
import { ThemeIcon } from "../../../base/common/themables.js";
import { isSingleFolderWorkspaceIdentifier, isWorkspaceIdentifier } from "../../../platform/workspace/common/workspace.js";
import { Action2, MenuId } from "../../../platform/actions/common/actions.js";
import { Categories } from "../../../platform/action/common/actionCommonCategories.js";
import { KeyCode, KeyMod } from "../../../base/common/keyCodes.js";
import { KeybindingWeight } from "../../../platform/keybinding/common/keybindingsRegistry.js";
import { isMacintosh } from "../../../base/common/platform.js";
import { getActiveWindow } from "../../../base/browser/dom.js";
import { isOpenedAuxiliaryWindow } from "../../../platform/window/common/window.js";
const _CloseWindowAction = class _CloseWindowAction extends Action2 {
  constructor() {
    super({
      id: _CloseWindowAction.ID,
      title: {
        ...localize2("closeWindow", "Close Window"),
        mnemonicTitle: localize({ key: "miCloseWindow", comment: ["&& denotes a mnemonic"] }, "Clos&&e Window")
      },
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        mac: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyW },
        linux: { primary: KeyMod.Alt | KeyCode.F4, secondary: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyW] },
        win: { primary: KeyMod.Alt | KeyCode.F4, secondary: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyW] }
      },
      menu: {
        id: MenuId.MenubarFileMenu,
        group: "6_close",
        order: 4
      }
    });
  }
  async run(accessor) {
    const nativeHostService = accessor.get(INativeHostService);
    return nativeHostService.closeWindow({ targetWindowId: getActiveWindow().vscodeWindowId });
  }
};
_CloseWindowAction.ID = "workbench.action.closeWindow";
let CloseWindowAction = _CloseWindowAction;
const _BaseZoomAction = class _BaseZoomAction extends Action2 {
  constructor(desc) {
    super(desc);
  }
  async setZoomLevel(accessor, levelOrReset) {
    const configurationService = accessor.get(IConfigurationService);
    let target;
    if (configurationService.getValue(_BaseZoomAction.ZOOM_PER_WINDOW_SETTING_KEY) !== false) {
      target = ApplyZoomTarget.ACTIVE_WINDOW;
    } else {
      target = ApplyZoomTarget.ALL_WINDOWS;
    }
    let level;
    if (typeof levelOrReset === "number") {
      level = Math.round(levelOrReset);
    } else {
      if (target === ApplyZoomTarget.ALL_WINDOWS) {
        level = 0;
      } else {
        const defaultLevel = configurationService.getValue(_BaseZoomAction.ZOOM_LEVEL_SETTING_KEY);
        if (typeof defaultLevel === "number") {
          level = defaultLevel;
        } else {
          level = 0;
        }
      }
    }
    if (level > MAX_ZOOM_LEVEL || level < MIN_ZOOM_LEVEL) {
      return;
    }
    if (target === ApplyZoomTarget.ALL_WINDOWS) {
      await configurationService.updateValue(_BaseZoomAction.ZOOM_LEVEL_SETTING_KEY, level);
    }
    applyZoom(level, target);
  }
};
_BaseZoomAction.ZOOM_LEVEL_SETTING_KEY = "window.zoomLevel";
_BaseZoomAction.ZOOM_PER_WINDOW_SETTING_KEY = "window.zoomPerWindow";
let BaseZoomAction = _BaseZoomAction;
class ZoomInAction extends BaseZoomAction {
  constructor() {
    super({
      id: "workbench.action.zoomIn",
      title: {
        ...localize2("zoomIn", "Zoom In"),
        mnemonicTitle: localize({ key: "miZoomIn", comment: ["&& denotes a mnemonic"] }, "&&Zoom In")
      },
      category: Categories.View,
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyCode.Equal,
        secondary: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Equal, KeyMod.CtrlCmd | KeyCode.NumpadAdd]
      },
      menu: {
        id: MenuId.MenubarAppearanceMenu,
        group: "5_zoom",
        order: 1
      }
    });
  }
  run(accessor) {
    return super.setZoomLevel(accessor, getZoomLevel(getActiveWindow()) + 1);
  }
}
class ZoomOutAction extends BaseZoomAction {
  constructor() {
    super({
      id: "workbench.action.zoomOut",
      title: {
        ...localize2("zoomOut", "Zoom Out"),
        mnemonicTitle: localize({ key: "miZoomOut", comment: ["&& denotes a mnemonic"] }, "&&Zoom Out")
      },
      category: Categories.View,
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyCode.Minus,
        secondary: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Minus, KeyMod.CtrlCmd | KeyCode.NumpadSubtract],
        linux: {
          primary: KeyMod.CtrlCmd | KeyCode.Minus,
          secondary: [KeyMod.CtrlCmd | KeyCode.NumpadSubtract]
        }
      },
      menu: {
        id: MenuId.MenubarAppearanceMenu,
        group: "5_zoom",
        order: 2
      }
    });
  }
  run(accessor) {
    return super.setZoomLevel(accessor, getZoomLevel(getActiveWindow()) - 1);
  }
}
class ZoomResetAction extends BaseZoomAction {
  constructor() {
    super({
      id: "workbench.action.zoomReset",
      title: {
        ...localize2("zoomReset", "Reset Zoom"),
        mnemonicTitle: localize({ key: "miZoomReset", comment: ["&& denotes a mnemonic"] }, "&&Reset Zoom")
      },
      category: Categories.View,
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyCode.Numpad0
      },
      menu: {
        id: MenuId.MenubarAppearanceMenu,
        group: "5_zoom",
        order: 3
      }
    });
  }
  run(accessor) {
    return super.setZoomLevel(accessor, true);
  }
}
class BaseSwitchWindow extends Action2 {
  constructor(desc) {
    super(desc);
    this.closeWindowAction = {
      iconClass: ThemeIcon.asClassName(Codicon.removeClose),
      tooltip: localize("close", "Close Window")
    };
    this.closeDirtyWindowAction = {
      iconClass: "dirty-window " + ThemeIcon.asClassName(Codicon.closeDirty),
      tooltip: localize("close", "Close Window"),
      alwaysVisible: true
    };
  }
  async run(accessor) {
    const quickInputService = accessor.get(IQuickInputService);
    const keybindingService = accessor.get(IKeybindingService);
    const modelService = accessor.get(IModelService);
    const languageService = accessor.get(ILanguageService);
    const nativeHostService = accessor.get(INativeHostService);
    const currentWindowId = getActiveWindow().vscodeWindowId;
    const windows = await nativeHostService.getWindows({ includeAuxiliaryWindows: true });
    const mainWindows = /* @__PURE__ */ new Set();
    const mapMainWindowToAuxiliaryWindows = /* @__PURE__ */ new Map();
    for (const window of windows) {
      if (isOpenedAuxiliaryWindow(window)) {
        let auxiliaryWindows = mapMainWindowToAuxiliaryWindows.get(window.parentId);
        if (!auxiliaryWindows) {
          auxiliaryWindows = /* @__PURE__ */ new Set();
          mapMainWindowToAuxiliaryWindows.set(window.parentId, auxiliaryWindows);
        }
        auxiliaryWindows.add(window);
      } else {
        mainWindows.add(window);
      }
    }
    function isWindowPickItem(candidate) {
      const windowPickItem = candidate;
      return typeof windowPickItem?.windowId === "number";
    }
    const picks = [];
    for (const window of mainWindows) {
      const auxiliaryWindows = mapMainWindowToAuxiliaryWindows.get(window.id);
      if (mapMainWindowToAuxiliaryWindows.size > 0) {
        picks.push({ type: "separator", label: auxiliaryWindows ? localize("windowGroup", "window group") : void 0 });
      }
      const resource = window.filename ? URI.file(window.filename) : isSingleFolderWorkspaceIdentifier(window.workspace) ? window.workspace.uri : isWorkspaceIdentifier(window.workspace) ? window.workspace.configPath : void 0;
      const fileKind = window.filename ? FileKind.FILE : isSingleFolderWorkspaceIdentifier(window.workspace) ? FileKind.FOLDER : isWorkspaceIdentifier(window.workspace) ? FileKind.ROOT_FOLDER : FileKind.FILE;
      const pick2 = {
        windowId: window.id,
        label: window.title,
        ariaLabel: window.dirty ? localize("windowDirtyAriaLabel", "{0}, window with unsaved changes", window.title) : window.title,
        iconClasses: getIconClasses(modelService, languageService, resource, fileKind),
        description: currentWindowId === window.id ? localize("current", "Current Window") : void 0,
        buttons: currentWindowId !== window.id ? window.dirty ? [this.closeDirtyWindowAction] : [this.closeWindowAction] : void 0
      };
      picks.push(pick2);
      if (auxiliaryWindows) {
        for (const auxiliaryWindow of auxiliaryWindows) {
          const pick3 = {
            windowId: auxiliaryWindow.id,
            label: auxiliaryWindow.title,
            iconClasses: getIconClasses(modelService, languageService, auxiliaryWindow.filename ? URI.file(auxiliaryWindow.filename) : void 0, FileKind.FILE),
            description: currentWindowId === auxiliaryWindow.id ? localize("current", "Current Window") : void 0,
            buttons: [this.closeWindowAction]
          };
          picks.push(pick3);
        }
      }
    }
    const pick = await quickInputService.pick(picks, {
      contextKey: "inWindowsPicker",
      activeItem: (() => {
        for (let i = 0; i < picks.length; i++) {
          const pick2 = picks[i];
          if (isWindowPickItem(pick2) && pick2.windowId === currentWindowId) {
            let nextPick = picks[i + 1];
            if (isWindowPickItem(nextPick)) {
              return nextPick;
            }
            nextPick = picks[i + 2];
            if (isWindowPickItem(nextPick)) {
              return nextPick;
            }
          }
        }
        return void 0;
      })(),
      placeHolder: localize("switchWindowPlaceHolder", "Select a window to switch to"),
      quickNavigate: this.isQuickNavigate() ? { keybindings: keybindingService.lookupKeybindings(this.desc.id) } : void 0,
      hideInput: this.isQuickNavigate(),
      onDidTriggerItemButton: async (context) => {
        await nativeHostService.closeWindow({ targetWindowId: context.item.windowId });
        context.removeItem();
      }
    });
    if (pick) {
      nativeHostService.focusWindow({ targetWindowId: pick.windowId });
    }
  }
}
class SwitchWindowAction extends BaseSwitchWindow {
  constructor() {
    super({
      id: "workbench.action.switchWindow",
      title: localize2("switchWindow", "Switch Window..."),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: 0,
        mac: { primary: KeyMod.WinCtrl | KeyCode.KeyW }
      }
    });
  }
  isQuickNavigate() {
    return false;
  }
}
class QuickSwitchWindowAction extends BaseSwitchWindow {
  constructor() {
    super({
      id: "workbench.action.quickSwitchWindow",
      title: localize2("quickSwitchWindow", "Quick Switch Window..."),
      f1: false
      // hide quick pickers from command palette to not confuse with the other entry that shows a input field
    });
  }
  isQuickNavigate() {
    return true;
  }
}
function canRunNativeTabsHandler(accessor) {
  if (!isMacintosh) {
    return false;
  }
  const configurationService = accessor.get(IConfigurationService);
  return configurationService.getValue("window.nativeTabs") === true;
}
const NewWindowTabHandler = function(accessor) {
  if (!canRunNativeTabsHandler(accessor)) {
    return;
  }
  return accessor.get(INativeHostService).newWindowTab();
};
const ShowPreviousWindowTabHandler = function(accessor) {
  if (!canRunNativeTabsHandler(accessor)) {
    return;
  }
  return accessor.get(INativeHostService).showPreviousWindowTab();
};
const ShowNextWindowTabHandler = function(accessor) {
  if (!canRunNativeTabsHandler(accessor)) {
    return;
  }
  return accessor.get(INativeHostService).showNextWindowTab();
};
const MoveWindowTabToNewWindowHandler = function(accessor) {
  if (!canRunNativeTabsHandler(accessor)) {
    return;
  }
  return accessor.get(INativeHostService).moveWindowTabToNewWindow();
};
const MergeWindowTabsHandlerHandler = function(accessor) {
  if (!canRunNativeTabsHandler(accessor)) {
    return;
  }
  return accessor.get(INativeHostService).mergeAllWindowTabs();
};
const ToggleWindowTabsBarHandler = function(accessor) {
  if (!canRunNativeTabsHandler(accessor)) {
    return;
  }
  return accessor.get(INativeHostService).toggleWindowTabsBar();
};
export {
  CloseWindowAction,
  MergeWindowTabsHandlerHandler,
  MoveWindowTabToNewWindowHandler,
  NewWindowTabHandler,
  QuickSwitchWindowAction,
  ShowNextWindowTabHandler,
  ShowPreviousWindowTabHandler,
  SwitchWindowAction,
  ToggleWindowTabsBarHandler,
  ZoomInAction,
  ZoomOutAction,
  ZoomResetAction
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvZWxlY3Ryb24tc2FuZGJveC9hY3Rpb25zL3dpbmRvd0FjdGlvbnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgJy4vbWVkaWEvYWN0aW9ucy5jc3MnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQXBwbHlab29tVGFyZ2V0LCBNQVhfWk9PTV9MRVZFTCwgTUlOX1pPT01fTEVWRUwsIGFwcGx5Wm9vbSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3dpbmRvdy9lbGVjdHJvbi1zYW5kYm94L3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IGdldFpvb21MZXZlbCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9icm93c2VyLmpzJztcbmltcG9ydCB7IEZpbGVLaW5kIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBJUXVpY2tJbnB1dFNlcnZpY2UsIElRdWlja0lucHV0QnV0dG9uLCBJUXVpY2tQaWNrSXRlbSwgUXVpY2tQaWNrSW5wdXQgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IGdldEljb25DbGFzc2VzIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9nZXRJY29uQ2xhc3Nlcy5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZEhhbmRsZXIgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTmF0aXZlSG9zdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9uYXRpdmUvY29tbW9uL25hdGl2ZS5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IGlzU2luZ2xlRm9sZGVyV29ya3NwYWNlSWRlbnRpZmllciwgaXNXb3Jrc3BhY2VJZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgQWN0aW9uMiwgSUFjdGlvbjJPcHRpb25zLCBNZW51SWQgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IENhdGVnb3JpZXMgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb24vY29tbW9uL2FjdGlvbkNvbW1vbkNhdGVnb3JpZXMuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSwgS2V5TW9kIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgaXNNYWNpbnRvc2ggfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBnZXRBY3RpdmVXaW5kb3cgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IElPcGVuZWRBdXhpbGlhcnlXaW5kb3csIElPcGVuZWRNYWluV2luZG93LCBpc09wZW5lZEF1eGlsaWFyeVdpbmRvdyB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3dpbmRvdy9jb21tb24vd2luZG93LmpzJztcblxuZXhwb3J0IGNsYXNzIENsb3NlV2luZG93QWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5hY3Rpb24uY2xvc2VXaW5kb3cnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBDbG9zZVdpbmRvd0FjdGlvbi5JRCxcblx0XHRcdHRpdGxlOiB7XG5cdFx0XHRcdC4uLmxvY2FsaXplMignY2xvc2VXaW5kb3cnLCBcIkNsb3NlIFdpbmRvd1wiKSxcblx0XHRcdFx0bW5lbW9uaWNUaXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaUNsb3NlV2luZG93JywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIkNsb3MmJmUgV2luZG93XCIpLFxuXHRcdFx0fSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0bWFjOiB7IHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5LZXlXIH0sXG5cdFx0XHRcdGxpbnV4OiB7IHByaW1hcnk6IEtleU1vZC5BbHQgfCBLZXlDb2RlLkY0LCBzZWNvbmRhcnk6IFtLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuS2V5V10gfSxcblx0XHRcdFx0d2luOiB7IHByaW1hcnk6IEtleU1vZC5BbHQgfCBLZXlDb2RlLkY0LCBzZWNvbmRhcnk6IFtLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuS2V5V10gfVxuXHRcdFx0fSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5NZW51YmFyRmlsZU1lbnUsXG5cdFx0XHRcdGdyb3VwOiAnNl9jbG9zZScsXG5cdFx0XHRcdG9yZGVyOiA0XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBuYXRpdmVIb3N0U2VydmljZSA9IGFjY2Vzc29yLmdldChJTmF0aXZlSG9zdFNlcnZpY2UpO1xuXG5cdFx0cmV0dXJuIG5hdGl2ZUhvc3RTZXJ2aWNlLmNsb3NlV2luZG93KHsgdGFyZ2V0V2luZG93SWQ6IGdldEFjdGl2ZVdpbmRvdygpLnZzY29kZVdpbmRvd0lkIH0pO1xuXHR9XG59XG5cbmFic3RyYWN0IGNsYXNzIEJhc2Vab29tQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgWk9PTV9MRVZFTF9TRVRUSU5HX0tFWSA9ICd3aW5kb3cuem9vbUxldmVsJztcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgWk9PTV9QRVJfV0lORE9XX1NFVFRJTkdfS0VZID0gJ3dpbmRvdy56b29tUGVyV2luZG93JztcblxuXHRjb25zdHJ1Y3RvcihkZXNjOiBSZWFkb25seTxJQWN0aW9uMk9wdGlvbnM+KSB7XG5cdFx0c3VwZXIoZGVzYyk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgc2V0Wm9vbUxldmVsKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBsZXZlbE9yUmVzZXQ6IG51bWJlciB8IHRydWUpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXG5cdFx0bGV0IHRhcmdldDogQXBwbHlab29tVGFyZ2V0O1xuXHRcdGlmIChjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShCYXNlWm9vbUFjdGlvbi5aT09NX1BFUl9XSU5ET1dfU0VUVElOR19LRVkpICE9PSBmYWxzZSkge1xuXHRcdFx0dGFyZ2V0ID0gQXBwbHlab29tVGFyZ2V0LkFDVElWRV9XSU5ET1c7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRhcmdldCA9IEFwcGx5Wm9vbVRhcmdldC5BTExfV0lORE9XUztcblx0XHR9XG5cblx0XHRsZXQgbGV2ZWw6IG51bWJlcjtcblx0XHRpZiAodHlwZW9mIGxldmVsT3JSZXNldCA9PT0gJ251bWJlcicpIHtcblx0XHRcdGxldmVsID0gTWF0aC5yb3VuZChsZXZlbE9yUmVzZXQpOyAvLyBwcmV2ZW50IGZyYWN0aW9uYWwgem9vbSBsZXZlbHNcblx0XHR9IGVsc2Uge1xuXG5cdFx0XHQvLyByZXNldCB0byAwIHdoZW4gd2UgYXBwbHkgdG8gYWxsIHdpbmRvd3Ncblx0XHRcdGlmICh0YXJnZXQgPT09IEFwcGx5Wm9vbVRhcmdldC5BTExfV0lORE9XUykge1xuXHRcdFx0XHRsZXZlbCA9IDA7XG5cdFx0XHR9XG5cblx0XHRcdC8vIG90aGVyd2lzZSwgcmVzZXQgdG8gdGhlIGRlZmF1bHQgem9vbSBsZXZlbFxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdGNvbnN0IGRlZmF1bHRMZXZlbCA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKEJhc2Vab29tQWN0aW9uLlpPT01fTEVWRUxfU0VUVElOR19LRVkpO1xuXHRcdFx0XHRpZiAodHlwZW9mIGRlZmF1bHRMZXZlbCA9PT0gJ251bWJlcicpIHtcblx0XHRcdFx0XHRsZXZlbCA9IGRlZmF1bHRMZXZlbDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRsZXZlbCA9IDA7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAobGV2ZWwgPiBNQVhfWk9PTV9MRVZFTCB8fCBsZXZlbCA8IE1JTl9aT09NX0xFVkVMKSB7XG5cdFx0XHRyZXR1cm47IC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy80ODM1N1xuXHRcdH1cblxuXHRcdGlmICh0YXJnZXQgPT09IEFwcGx5Wm9vbVRhcmdldC5BTExfV0lORE9XUykge1xuXHRcdFx0YXdhaXQgY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoQmFzZVpvb21BY3Rpb24uWk9PTV9MRVZFTF9TRVRUSU5HX0tFWSwgbGV2ZWwpO1xuXHRcdH1cblxuXHRcdGFwcGx5Wm9vbShsZXZlbCwgdGFyZ2V0KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgWm9vbUluQWN0aW9uIGV4dGVuZHMgQmFzZVpvb21BY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi56b29tSW4nLFxuXHRcdFx0dGl0bGU6IHtcblx0XHRcdFx0Li4ubG9jYWxpemUyKCd6b29tSW4nLCBcIlpvb20gSW5cIiksXG5cdFx0XHRcdG1uZW1vbmljVGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlab29tSW4nLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZab29tIEluXCIpLFxuXHRcdFx0fSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXcsXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5FcXVhbCxcblx0XHRcdFx0c2Vjb25kYXJ5OiBbS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkVxdWFsLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuTnVtcGFkQWRkXVxuXHRcdFx0fSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5NZW51YmFyQXBwZWFyYW5jZU1lbnUsXG5cdFx0XHRcdGdyb3VwOiAnNV96b29tJyxcblx0XHRcdFx0b3JkZXI6IDFcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiBzdXBlci5zZXRab29tTGV2ZWwoYWNjZXNzb3IsIGdldFpvb21MZXZlbChnZXRBY3RpdmVXaW5kb3coKSkgKyAxKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgWm9vbU91dEFjdGlvbiBleHRlbmRzIEJhc2Vab29tQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uem9vbU91dCcsXG5cdFx0XHR0aXRsZToge1xuXHRcdFx0XHQuLi5sb2NhbGl6ZTIoJ3pvb21PdXQnLCBcIlpvb20gT3V0XCIpLFxuXHRcdFx0XHRtbmVtb25pY1RpdGxlOiBsb2NhbGl6ZSh7IGtleTogJ21pWm9vbU91dCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJlpvb20gT3V0XCIpLFxuXHRcdFx0fSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXcsXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5NaW51cyxcblx0XHRcdFx0c2Vjb25kYXJ5OiBbS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLk1pbnVzLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuTnVtcGFkU3VidHJhY3RdLFxuXHRcdFx0XHRsaW51eDoge1xuXHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5NaW51cyxcblx0XHRcdFx0XHRzZWNvbmRhcnk6IFtLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuTnVtcGFkU3VidHJhY3RdXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuTWVudWJhckFwcGVhcmFuY2VNZW51LFxuXHRcdFx0XHRncm91cDogJzVfem9vbScsXG5cdFx0XHRcdG9yZGVyOiAyXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gc3VwZXIuc2V0Wm9vbUxldmVsKGFjY2Vzc29yLCBnZXRab29tTGV2ZWwoZ2V0QWN0aXZlV2luZG93KCkpIC0gMSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFpvb21SZXNldEFjdGlvbiBleHRlbmRzIEJhc2Vab29tQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uem9vbVJlc2V0Jyxcblx0XHRcdHRpdGxlOiB7XG5cdFx0XHRcdC4uLmxvY2FsaXplMignem9vbVJlc2V0JywgXCJSZXNldCBab29tXCIpLFxuXHRcdFx0XHRtbmVtb25pY1RpdGxlOiBsb2NhbGl6ZSh7IGtleTogJ21pWm9vbVJlc2V0JywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmUmVzZXQgWm9vbVwiKSxcblx0XHRcdH0sXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3LFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuTnVtcGFkMFxuXHRcdFx0fSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5NZW51YmFyQXBwZWFyYW5jZU1lbnUsXG5cdFx0XHRcdGdyb3VwOiAnNV96b29tJyxcblx0XHRcdFx0b3JkZXI6IDNcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiBzdXBlci5zZXRab29tTGV2ZWwoYWNjZXNzb3IsIHRydWUpO1xuXHR9XG59XG5cbmFic3RyYWN0IGNsYXNzIEJhc2VTd2l0Y2hXaW5kb3cgZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGNsb3NlV2luZG93QWN0aW9uOiBJUXVpY2tJbnB1dEJ1dHRvbiA9IHtcblx0XHRpY29uQ2xhc3M6IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShDb2RpY29uLnJlbW92ZUNsb3NlKSxcblx0XHR0b29sdGlwOiBsb2NhbGl6ZSgnY2xvc2UnLCBcIkNsb3NlIFdpbmRvd1wiKVxuXHR9O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgY2xvc2VEaXJ0eVdpbmRvd0FjdGlvbjogSVF1aWNrSW5wdXRCdXR0b24gPSB7XG5cdFx0aWNvbkNsYXNzOiAnZGlydHktd2luZG93ICcgKyBUaGVtZUljb24uYXNDbGFzc05hbWUoQ29kaWNvbi5jbG9zZURpcnR5KSxcblx0XHR0b29sdGlwOiBsb2NhbGl6ZSgnY2xvc2UnLCBcIkNsb3NlIFdpbmRvd1wiKSxcblx0XHRhbHdheXNWaXNpYmxlOiB0cnVlXG5cdH07XG5cblx0Y29uc3RydWN0b3IoZGVzYzogUmVhZG9ubHk8SUFjdGlvbjJPcHRpb25zPikge1xuXHRcdHN1cGVyKGRlc2MpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFic3RyYWN0IGlzUXVpY2tOYXZpZ2F0ZSgpOiBib29sZWFuO1xuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHF1aWNrSW5wdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElRdWlja0lucHV0U2VydmljZSk7XG5cdFx0Y29uc3Qga2V5YmluZGluZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUtleWJpbmRpbmdTZXJ2aWNlKTtcblx0XHRjb25zdCBtb2RlbFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU1vZGVsU2VydmljZSk7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMYW5ndWFnZVNlcnZpY2UpO1xuXHRcdGNvbnN0IG5hdGl2ZUhvc3RTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElOYXRpdmVIb3N0U2VydmljZSk7XG5cblx0XHRjb25zdCBjdXJyZW50V2luZG93SWQgPSBnZXRBY3RpdmVXaW5kb3coKS52c2NvZGVXaW5kb3dJZDtcblxuXHRcdGNvbnN0IHdpbmRvd3MgPSBhd2FpdCBuYXRpdmVIb3N0U2VydmljZS5nZXRXaW5kb3dzKHsgaW5jbHVkZUF1eGlsaWFyeVdpbmRvd3M6IHRydWUgfSk7XG5cblx0XHRjb25zdCBtYWluV2luZG93cyA9IG5ldyBTZXQ8SU9wZW5lZE1haW5XaW5kb3c+KCk7XG5cdFx0Y29uc3QgbWFwTWFpbldpbmRvd1RvQXV4aWxpYXJ5V2luZG93cyA9IG5ldyBNYXA8bnVtYmVyLCBTZXQ8SU9wZW5lZEF1eGlsaWFyeVdpbmRvdz4+KCk7XG5cdFx0Zm9yIChjb25zdCB3aW5kb3cgb2Ygd2luZG93cykge1xuXHRcdFx0aWYgKGlzT3BlbmVkQXV4aWxpYXJ5V2luZG93KHdpbmRvdykpIHtcblx0XHRcdFx0bGV0IGF1eGlsaWFyeVdpbmRvd3MgPSBtYXBNYWluV2luZG93VG9BdXhpbGlhcnlXaW5kb3dzLmdldCh3aW5kb3cucGFyZW50SWQpO1xuXHRcdFx0XHRpZiAoIWF1eGlsaWFyeVdpbmRvd3MpIHtcblx0XHRcdFx0XHRhdXhpbGlhcnlXaW5kb3dzID0gbmV3IFNldDxJT3BlbmVkQXV4aWxpYXJ5V2luZG93PigpO1xuXHRcdFx0XHRcdG1hcE1haW5XaW5kb3dUb0F1eGlsaWFyeVdpbmRvd3Muc2V0KHdpbmRvdy5wYXJlbnRJZCwgYXV4aWxpYXJ5V2luZG93cyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YXV4aWxpYXJ5V2luZG93cy5hZGQod2luZG93KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG1haW5XaW5kb3dzLmFkZCh3aW5kb3cpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGludGVyZmFjZSBJV2luZG93UGlja0l0ZW0gZXh0ZW5kcyBJUXVpY2tQaWNrSXRlbSB7XG5cdFx0XHRyZWFkb25seSB3aW5kb3dJZDogbnVtYmVyO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGlzV2luZG93UGlja0l0ZW0oY2FuZGlkYXRlOiB1bmtub3duKTogY2FuZGlkYXRlIGlzIElXaW5kb3dQaWNrSXRlbSB7XG5cdFx0XHRjb25zdCB3aW5kb3dQaWNrSXRlbSA9IGNhbmRpZGF0ZSBhcyBJV2luZG93UGlja0l0ZW0gfCB1bmRlZmluZWQ7XG5cblx0XHRcdHJldHVybiB0eXBlb2Ygd2luZG93UGlja0l0ZW0/LndpbmRvd0lkID09PSAnbnVtYmVyJztcblx0XHR9XG5cblx0XHRjb25zdCBwaWNrczogQXJyYXk8UXVpY2tQaWNrSW5wdXQ8SVdpbmRvd1BpY2tJdGVtPj4gPSBbXTtcblx0XHRmb3IgKGNvbnN0IHdpbmRvdyBvZiBtYWluV2luZG93cykge1xuXHRcdFx0Y29uc3QgYXV4aWxpYXJ5V2luZG93cyA9IG1hcE1haW5XaW5kb3dUb0F1eGlsaWFyeVdpbmRvd3MuZ2V0KHdpbmRvdy5pZCk7XG5cdFx0XHRpZiAobWFwTWFpbldpbmRvd1RvQXV4aWxpYXJ5V2luZG93cy5zaXplID4gMCkge1xuXHRcdFx0XHRwaWNrcy5wdXNoKHsgdHlwZTogJ3NlcGFyYXRvcicsIGxhYmVsOiBhdXhpbGlhcnlXaW5kb3dzID8gbG9jYWxpemUoJ3dpbmRvd0dyb3VwJywgXCJ3aW5kb3cgZ3JvdXBcIikgOiB1bmRlZmluZWQgfSk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHJlc291cmNlID0gd2luZG93LmZpbGVuYW1lID8gVVJJLmZpbGUod2luZG93LmZpbGVuYW1lKSA6IGlzU2luZ2xlRm9sZGVyV29ya3NwYWNlSWRlbnRpZmllcih3aW5kb3cud29ya3NwYWNlKSA/IHdpbmRvdy53b3Jrc3BhY2UudXJpIDogaXNXb3Jrc3BhY2VJZGVudGlmaWVyKHdpbmRvdy53b3Jrc3BhY2UpID8gd2luZG93LndvcmtzcGFjZS5jb25maWdQYXRoIDogdW5kZWZpbmVkO1xuXHRcdFx0Y29uc3QgZmlsZUtpbmQgPSB3aW5kb3cuZmlsZW5hbWUgPyBGaWxlS2luZC5GSUxFIDogaXNTaW5nbGVGb2xkZXJXb3Jrc3BhY2VJZGVudGlmaWVyKHdpbmRvdy53b3Jrc3BhY2UpID8gRmlsZUtpbmQuRk9MREVSIDogaXNXb3Jrc3BhY2VJZGVudGlmaWVyKHdpbmRvdy53b3Jrc3BhY2UpID8gRmlsZUtpbmQuUk9PVF9GT0xERVIgOiBGaWxlS2luZC5GSUxFO1xuXHRcdFx0Y29uc3QgcGljazogSVdpbmRvd1BpY2tJdGVtID0ge1xuXHRcdFx0XHR3aW5kb3dJZDogd2luZG93LmlkLFxuXHRcdFx0XHRsYWJlbDogd2luZG93LnRpdGxlLFxuXHRcdFx0XHRhcmlhTGFiZWw6IHdpbmRvdy5kaXJ0eSA/IGxvY2FsaXplKCd3aW5kb3dEaXJ0eUFyaWFMYWJlbCcsIFwiezB9LCB3aW5kb3cgd2l0aCB1bnNhdmVkIGNoYW5nZXNcIiwgd2luZG93LnRpdGxlKSA6IHdpbmRvdy50aXRsZSxcblx0XHRcdFx0aWNvbkNsYXNzZXM6IGdldEljb25DbGFzc2VzKG1vZGVsU2VydmljZSwgbGFuZ3VhZ2VTZXJ2aWNlLCByZXNvdXJjZSwgZmlsZUtpbmQpLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogKGN1cnJlbnRXaW5kb3dJZCA9PT0gd2luZG93LmlkKSA/IGxvY2FsaXplKCdjdXJyZW50JywgXCJDdXJyZW50IFdpbmRvd1wiKSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0YnV0dG9uczogY3VycmVudFdpbmRvd0lkICE9PSB3aW5kb3cuaWQgPyB3aW5kb3cuZGlydHkgPyBbdGhpcy5jbG9zZURpcnR5V2luZG93QWN0aW9uXSA6IFt0aGlzLmNsb3NlV2luZG93QWN0aW9uXSA6IHVuZGVmaW5lZFxuXHRcdFx0fTtcblx0XHRcdHBpY2tzLnB1c2gocGljayk7XG5cblx0XHRcdGlmIChhdXhpbGlhcnlXaW5kb3dzKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgYXV4aWxpYXJ5V2luZG93IG9mIGF1eGlsaWFyeVdpbmRvd3MpIHtcblx0XHRcdFx0XHRjb25zdCBwaWNrOiBJV2luZG93UGlja0l0ZW0gPSB7XG5cdFx0XHRcdFx0XHR3aW5kb3dJZDogYXV4aWxpYXJ5V2luZG93LmlkLFxuXHRcdFx0XHRcdFx0bGFiZWw6IGF1eGlsaWFyeVdpbmRvdy50aXRsZSxcblx0XHRcdFx0XHRcdGljb25DbGFzc2VzOiBnZXRJY29uQ2xhc3Nlcyhtb2RlbFNlcnZpY2UsIGxhbmd1YWdlU2VydmljZSwgYXV4aWxpYXJ5V2luZG93LmZpbGVuYW1lID8gVVJJLmZpbGUoYXV4aWxpYXJ5V2luZG93LmZpbGVuYW1lKSA6IHVuZGVmaW5lZCwgRmlsZUtpbmQuRklMRSksXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogKGN1cnJlbnRXaW5kb3dJZCA9PT0gYXV4aWxpYXJ5V2luZG93LmlkKSA/IGxvY2FsaXplKCdjdXJyZW50JywgXCJDdXJyZW50IFdpbmRvd1wiKSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdGJ1dHRvbnM6IFt0aGlzLmNsb3NlV2luZG93QWN0aW9uXVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0cGlja3MucHVzaChwaWNrKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IHBpY2sgPSBhd2FpdCBxdWlja0lucHV0U2VydmljZS5waWNrKHBpY2tzLCB7XG5cdFx0XHRjb250ZXh0S2V5OiAnaW5XaW5kb3dzUGlja2VyJyxcblx0XHRcdGFjdGl2ZUl0ZW06ICgoKSA9PiB7XG5cdFx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgcGlja3MubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRjb25zdCBwaWNrID0gcGlja3NbaV07XG5cdFx0XHRcdFx0aWYgKGlzV2luZG93UGlja0l0ZW0ocGljaykgJiYgcGljay53aW5kb3dJZCA9PT0gY3VycmVudFdpbmRvd0lkKSB7XG5cdFx0XHRcdFx0XHRsZXQgbmV4dFBpY2sgPSBwaWNrc1tpICsgMV07IC8vIHRyeSB0byBzZWxlY3QgbmV4dCB3aW5kb3cgdW5sZXNzIGl0J3MgYSBzZXBhcmF0b3Jcblx0XHRcdFx0XHRcdGlmIChpc1dpbmRvd1BpY2tJdGVtKG5leHRQaWNrKSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gbmV4dFBpY2s7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdG5leHRQaWNrID0gcGlja3NbaSArIDJdOyAvLyBvdGhlcndpc2UgdHJ5IHRvIHNlbGVjdCB0aGUgbmV4dCB3aW5kb3cgYWZ0ZXIgdGhlIHNlcGFyYXRvclxuXHRcdFx0XHRcdFx0aWYgKGlzV2luZG93UGlja0l0ZW0obmV4dFBpY2spKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBuZXh0UGljaztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fSkoKSxcblx0XHRcdHBsYWNlSG9sZGVyOiBsb2NhbGl6ZSgnc3dpdGNoV2luZG93UGxhY2VIb2xkZXInLCBcIlNlbGVjdCBhIHdpbmRvdyB0byBzd2l0Y2ggdG9cIiksXG5cdFx0XHRxdWlja05hdmlnYXRlOiB0aGlzLmlzUXVpY2tOYXZpZ2F0ZSgpID8geyBrZXliaW5kaW5nczoga2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZ3ModGhpcy5kZXNjLmlkKSB9IDogdW5kZWZpbmVkLFxuXHRcdFx0aGlkZUlucHV0OiB0aGlzLmlzUXVpY2tOYXZpZ2F0ZSgpLFxuXHRcdFx0b25EaWRUcmlnZ2VySXRlbUJ1dHRvbjogYXN5bmMgY29udGV4dCA9PiB7XG5cdFx0XHRcdGF3YWl0IG5hdGl2ZUhvc3RTZXJ2aWNlLmNsb3NlV2luZG93KHsgdGFyZ2V0V2luZG93SWQ6IGNvbnRleHQuaXRlbS53aW5kb3dJZCB9KTtcblx0XHRcdFx0Y29udGV4dC5yZW1vdmVJdGVtKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRpZiAocGljaykge1xuXHRcdFx0bmF0aXZlSG9zdFNlcnZpY2UuZm9jdXNXaW5kb3coeyB0YXJnZXRXaW5kb3dJZDogcGljay53aW5kb3dJZCB9KTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFN3aXRjaFdpbmRvd0FjdGlvbiBleHRlbmRzIEJhc2VTd2l0Y2hXaW5kb3cge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5zd2l0Y2hXaW5kb3cnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignc3dpdGNoV2luZG93JywgJ1N3aXRjaCBXaW5kb3cuLi4nKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogMCxcblx0XHRcdFx0bWFjOiB7IHByaW1hcnk6IEtleU1vZC5XaW5DdHJsIHwgS2V5Q29kZS5LZXlXIH1cblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBpc1F1aWNrTmF2aWdhdGUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBRdWlja1N3aXRjaFdpbmRvd0FjdGlvbiBleHRlbmRzIEJhc2VTd2l0Y2hXaW5kb3cge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5xdWlja1N3aXRjaFdpbmRvdycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdxdWlja1N3aXRjaFdpbmRvdycsICdRdWljayBTd2l0Y2ggV2luZG93Li4uJyksXG5cdFx0XHRmMTogZmFsc2UgLy8gaGlkZSBxdWljayBwaWNrZXJzIGZyb20gY29tbWFuZCBwYWxldHRlIHRvIG5vdCBjb25mdXNlIHdpdGggdGhlIG90aGVyIGVudHJ5IHRoYXQgc2hvd3MgYSBpbnB1dCBmaWVsZFxuXHRcdH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIGlzUXVpY2tOYXZpZ2F0ZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxufVxuXG5mdW5jdGlvbiBjYW5SdW5OYXRpdmVUYWJzSGFuZGxlcihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IGJvb2xlYW4ge1xuXHRpZiAoIWlzTWFjaW50b3NoKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0cmV0dXJuIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPHVua25vd24+KCd3aW5kb3cubmF0aXZlVGFicycpID09PSB0cnVlO1xufVxuXG5leHBvcnQgY29uc3QgTmV3V2luZG93VGFiSGFuZGxlcjogSUNvbW1hbmRIYW5kbGVyID0gZnVuY3Rpb24gKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdGlmICghY2FuUnVuTmF0aXZlVGFic0hhbmRsZXIoYWNjZXNzb3IpKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0cmV0dXJuIGFjY2Vzc29yLmdldChJTmF0aXZlSG9zdFNlcnZpY2UpLm5ld1dpbmRvd1RhYigpO1xufTtcblxuZXhwb3J0IGNvbnN0IFNob3dQcmV2aW91c1dpbmRvd1RhYkhhbmRsZXI6IElDb21tYW5kSGFuZGxlciA9IGZ1bmN0aW9uIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcikge1xuXHRpZiAoIWNhblJ1bk5hdGl2ZVRhYnNIYW5kbGVyKGFjY2Vzc29yKSkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdHJldHVybiBhY2Nlc3Nvci5nZXQoSU5hdGl2ZUhvc3RTZXJ2aWNlKS5zaG93UHJldmlvdXNXaW5kb3dUYWIoKTtcbn07XG5cbmV4cG9ydCBjb25zdCBTaG93TmV4dFdpbmRvd1RhYkhhbmRsZXI6IElDb21tYW5kSGFuZGxlciA9IGZ1bmN0aW9uIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcikge1xuXHRpZiAoIWNhblJ1bk5hdGl2ZVRhYnNIYW5kbGVyKGFjY2Vzc29yKSkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdHJldHVybiBhY2Nlc3Nvci5nZXQoSU5hdGl2ZUhvc3RTZXJ2aWNlKS5zaG93TmV4dFdpbmRvd1RhYigpO1xufTtcblxuZXhwb3J0IGNvbnN0IE1vdmVXaW5kb3dUYWJUb05ld1dpbmRvd0hhbmRsZXI6IElDb21tYW5kSGFuZGxlciA9IGZ1bmN0aW9uIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcikge1xuXHRpZiAoIWNhblJ1bk5hdGl2ZVRhYnNIYW5kbGVyKGFjY2Vzc29yKSkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdHJldHVybiBhY2Nlc3Nvci5nZXQoSU5hdGl2ZUhvc3RTZXJ2aWNlKS5tb3ZlV2luZG93VGFiVG9OZXdXaW5kb3coKTtcbn07XG5cbmV4cG9ydCBjb25zdCBNZXJnZVdpbmRvd1RhYnNIYW5kbGVySGFuZGxlcjogSUNvbW1hbmRIYW5kbGVyID0gZnVuY3Rpb24gKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdGlmICghY2FuUnVuTmF0aXZlVGFic0hhbmRsZXIoYWNjZXNzb3IpKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0cmV0dXJuIGFjY2Vzc29yLmdldChJTmF0aXZlSG9zdFNlcnZpY2UpLm1lcmdlQWxsV2luZG93VGFicygpO1xufTtcblxuZXhwb3J0IGNvbnN0IFRvZ2dsZVdpbmRvd1RhYnNCYXJIYW5kbGVyOiBJQ29tbWFuZEhhbmRsZXIgPSBmdW5jdGlvbiAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0aWYgKCFjYW5SdW5OYXRpdmVUYWJzSGFuZGxlcihhY2Nlc3NvcikpIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRyZXR1cm4gYWNjZXNzb3IuZ2V0KElOYXRpdmVIb3N0U2VydmljZSkudG9nZ2xlV2luZG93VGFic0JhcigpO1xufTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU87QUFDUCxTQUFTLFdBQVc7QUFDcEIsU0FBUyxVQUFVLGlCQUFpQjtBQUNwQyxTQUFTLGlCQUFpQixnQkFBZ0IsZ0JBQWdCLGlCQUFpQjtBQUMzRSxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHdCQUF3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
