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
import { Separator } from "../../../../base/common/actions.js";
import { IMenuService, SubmenuItemAction, MenuItemAction } from "../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IWorkspacesService } from "../../../../platform/workspaces/common/workspaces.js";
import { isMacintosh } from "../../../../base/common/platform.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { INativeWorkbenchEnvironmentService } from "../../../services/environment/electron-sandbox/environmentService.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { IUpdateService } from "../../../../platform/update/common/update.js";
import { MenubarControl } from "../../../browser/parts/titlebar/menubarControl.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { IMenubarService } from "../../../../platform/menubar/electron-sandbox/menubar.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { IPreferencesService } from "../../../services/preferences/common/preferences.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { OpenRecentAction } from "../../../browser/actions/windowActions.js";
import { isICommandActionToggleInfo } from "../../../../platform/action/common/action.js";
import { getFlatContextMenuActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
let NativeMenubarControl = class extends MenubarControl {
  constructor(menuService, workspacesService, contextKeyService, keybindingService, configurationService, labelService, updateService, storageService, notificationService, preferencesService, environmentService, accessibilityService, menubarService, hostService, nativeHostService, commandService) {
    super(menuService, workspacesService, contextKeyService, keybindingService, configurationService, labelService, updateService, storageService, notificationService, preferencesService, environmentService, accessibilityService, hostService, commandService);
    this.menubarService = menubarService;
    this.nativeHostService = nativeHostService;
    (async () => {
      this.recentlyOpened = await this.workspacesService.getRecentlyOpened();
      this.doUpdateMenubar();
    })();
    this.registerListeners();
  }
  setupMainMenu() {
    super.setupMainMenu();
    for (const topLevelMenuName of Object.keys(this.topLevelTitles)) {
      const menu = this.menus[topLevelMenuName];
      if (menu) {
        this.mainMenuDisposables.add(menu.onDidChange(() => this.updateMenubar()));
      }
    }
  }
  doUpdateMenubar() {
    if (!this.hostService.hasFocus) {
      return;
    }
    const menubarData = { menus: {}, keybindings: {} };
    if (this.getMenubarMenus(menubarData)) {
      this.menubarService.updateMenubar(this.nativeHostService.windowId, menubarData);
    }
  }
  getMenubarMenus(menubarData) {
    if (!menubarData) {
      return false;
    }
    menubarData.keybindings = this.getAdditionalKeybindings();
    for (const topLevelMenuName of Object.keys(this.topLevelTitles)) {
      const menu = this.menus[topLevelMenuName];
      if (menu) {
        const menubarMenu = { items: [] };
        const menuActions = getFlatContextMenuActions(menu.getActions({ shouldForwardArgs: true }));
        this.populateMenuItems(menuActions, menubarMenu, menubarData.keybindings);
        if (menubarMenu.items.length === 0) {
          return false;
        }
        menubarData.menus[topLevelMenuName] = menubarMenu;
      }
    }
    return true;
  }
  populateMenuItems(menuActions, menuToPopulate, keybindings) {
    for (const menuItem of menuActions) {
      if (menuItem instanceof Separator) {
        menuToPopulate.items.push({ id: "vscode.menubar.separator" });
      } else if (menuItem instanceof MenuItemAction || menuItem instanceof SubmenuItemAction) {
        const title = typeof menuItem.item.title === "string" ? menuItem.item.title : menuItem.item.title.mnemonicTitle ?? menuItem.item.title.value;
        if (menuItem instanceof SubmenuItemAction) {
          const submenu = { items: [] };
          this.populateMenuItems(menuItem.actions, submenu, keybindings);
          if (submenu.items.length > 0) {
            const menubarSubmenuItem = {
              id: menuItem.id,
              label: title,
              submenu
            };
            menuToPopulate.items.push(menubarSubmenuItem);
          }
        } else {
          if (menuItem.id === OpenRecentAction.ID) {
            const actions = this.getOpenRecentActions().map(this.transformOpenRecentAction);
            menuToPopulate.items.push(...actions);
          }
          const menubarMenuItem = {
            id: menuItem.id,
            label: title
          };
          if (isICommandActionToggleInfo(menuItem.item.toggled)) {
            menubarMenuItem.label = menuItem.item.toggled.mnemonicTitle ?? menuItem.item.toggled.title ?? title;
          }
          if (menuItem.checked) {
            menubarMenuItem.checked = true;
          }
          if (!menuItem.enabled) {
            menubarMenuItem.enabled = false;
          }
          keybindings[menuItem.id] = this.getMenubarKeybinding(menuItem.id);
          menuToPopulate.items.push(menubarMenuItem);
        }
      }
    }
  }
  transformOpenRecentAction(action) {
    if (action instanceof Separator) {
      return { id: "vscode.menubar.separator" };
    }
    return {
      id: action.id,
      uri: action.uri,
      remoteAuthority: action.remoteAuthority,
      enabled: action.enabled,
      label: action.label
    };
  }
  getAdditionalKeybindings() {
    const keybindings = {};
    if (isMacintosh) {
      const keybinding = this.getMenubarKeybinding("workbench.action.quit");
      if (keybinding) {
        keybindings["workbench.action.quit"] = keybinding;
      }
    }
    return keybindings;
  }
  getMenubarKeybinding(id) {
    const binding = this.keybindingService.lookupKeybinding(id);
    if (!binding) {
      return void 0;
    }
    const electronAccelerator = binding.getElectronAccelerator();
    if (electronAccelerator) {
      return { label: electronAccelerator, userSettingsLabel: binding.getUserSettingsLabel() ?? void 0 };
    }
    const acceleratorLabel = binding.getLabel();
    if (acceleratorLabel) {
      return { label: acceleratorLabel, isNative: false, userSettingsLabel: binding.getUserSettingsLabel() ?? void 0 };
    }
    return void 0;
  }
};
NativeMenubarControl = __decorateClass([
  __decorateParam(0, IMenuService),
  __decorateParam(1, IWorkspacesService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, ILabelService),
  __decorateParam(6, IUpdateService),
  __decorateParam(7, IStorageService),
  __decorateParam(8, INotificationService),
  __decorateParam(9, IPreferencesService),
  __decorateParam(10, INativeWorkbenchEnvironmentService),
  __decorateParam(11, IAccessibilityService),
  __decorateParam(12, IMenubarService),
  __decorateParam(13, IHostService),
  __decorateParam(14, INativeHostService),
  __decorateParam(15, ICommandService)
], NativeMenubarControl);
export {
  NativeMenubarControl
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvZWxlY3Ryb24tc2FuZGJveC9wYXJ0cy90aXRsZWJhci9tZW51YmFyQ29udHJvbC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IElBY3Rpb24sIFNlcGFyYXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSU1lbnVTZXJ2aWNlLCBTdWJtZW51SXRlbUFjdGlvbiwgTWVudUl0ZW1BY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlcy9jb21tb24vd29ya3NwYWNlcy5qcyc7XG5pbXBvcnQgeyBpc01hY2ludG9zaCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBJTmF0aXZlV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZW52aXJvbm1lbnQvZWxlY3Ryb24tc2FuZGJveC9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUFjY2Vzc2liaWxpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eS9jb21tb24vYWNjZXNzaWJpbGl0eS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgSVVwZGF0ZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91cGRhdGUvY29tbW9uL3VwZGF0ZS5qcyc7XG5pbXBvcnQgeyBJT3BlblJlY2VudEFjdGlvbiwgTWVudWJhckNvbnRyb2wgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3BhcnRzL3RpdGxlYmFyL21lbnViYXJDb250cm9sLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSU1lbnViYXJEYXRhLCBJTWVudWJhck1lbnUsIElNZW51YmFyS2V5YmluZGluZywgSU1lbnViYXJNZW51SXRlbVN1Ym1lbnUsIElNZW51YmFyTWVudUl0ZW1BY3Rpb24sIE1lbnViYXJNZW51SXRlbSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL21lbnViYXIvY29tbW9uL21lbnViYXIuanMnO1xuaW1wb3J0IHsgSU1lbnViYXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbWVudWJhci9lbGVjdHJvbi1zYW5kYm94L21lbnViYXIuanMnO1xuaW1wb3J0IHsgSU5hdGl2ZUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbmF0aXZlL2NvbW1vbi9uYXRpdmUuanMnO1xuaW1wb3J0IHsgSUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvaG9zdC9icm93c2VyL2hvc3QuanMnO1xuaW1wb3J0IHsgSVByZWZlcmVuY2VzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3ByZWZlcmVuY2VzL2NvbW1vbi9wcmVmZXJlbmNlcy5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgT3BlblJlY2VudEFjdGlvbiB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvYWN0aW9ucy93aW5kb3dBY3Rpb25zLmpzJztcbmltcG9ydCB7IGlzSUNvbW1hbmRBY3Rpb25Ub2dnbGVJbmZvIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9uL2NvbW1vbi9hY3Rpb24uanMnO1xuaW1wb3J0IHsgZ2V0RmxhdENvbnRleHRNZW51QWN0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci9tZW51RW50cnlBY3Rpb25WaWV3SXRlbS5qcyc7XG5cbmV4cG9ydCBjbGFzcyBOYXRpdmVNZW51YmFyQ29udHJvbCBleHRlbmRzIE1lbnViYXJDb250cm9sIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASU1lbnVTZXJ2aWNlIG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VzU2VydmljZSB3b3Jrc3BhY2VzU2VydmljZTogSVdvcmtzcGFjZXNTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJTGFiZWxTZXJ2aWNlIGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSxcblx0XHRASVVwZGF0ZVNlcnZpY2UgdXBkYXRlU2VydmljZTogSVVwZGF0ZVNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASVByZWZlcmVuY2VzU2VydmljZSBwcmVmZXJlbmNlc1NlcnZpY2U6IElQcmVmZXJlbmNlc1NlcnZpY2UsXG5cdFx0QElOYXRpdmVXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgZW52aXJvbm1lbnRTZXJ2aWNlOiBJTmF0aXZlV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJQWNjZXNzaWJpbGl0eVNlcnZpY2UgYWNjZXNzaWJpbGl0eVNlcnZpY2U6IElBY2Nlc3NpYmlsaXR5U2VydmljZSxcblx0XHRASU1lbnViYXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbWVudWJhclNlcnZpY2U6IElNZW51YmFyU2VydmljZSxcblx0XHRASUhvc3RTZXJ2aWNlIGhvc3RTZXJ2aWNlOiBJSG9zdFNlcnZpY2UsXG5cdFx0QElOYXRpdmVIb3N0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5hdGl2ZUhvc3RTZXJ2aWNlOiBJTmF0aXZlSG9zdFNlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihtZW51U2VydmljZSwgd29ya3NwYWNlc1NlcnZpY2UsIGNvbnRleHRLZXlTZXJ2aWNlLCBrZXliaW5kaW5nU2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIGxhYmVsU2VydmljZSwgdXBkYXRlU2VydmljZSwgc3RvcmFnZVNlcnZpY2UsIG5vdGlmaWNhdGlvblNlcnZpY2UsIHByZWZlcmVuY2VzU2VydmljZSwgZW52aXJvbm1lbnRTZXJ2aWNlLCBhY2Nlc3NpYmlsaXR5U2VydmljZSwgaG9zdFNlcnZpY2UsIGNvbW1hbmRTZXJ2aWNlKTtcblxuXHRcdChhc3luYyAoKSA9PiB7XG5cdFx0XHR0aGlzLnJlY2VudGx5T3BlbmVkID0gYXdhaXQgdGhpcy53b3Jrc3BhY2VzU2VydmljZS5nZXRSZWNlbnRseU9wZW5lZCgpO1xuXG5cdFx0XHR0aGlzLmRvVXBkYXRlTWVudWJhcigpO1xuXHRcdH0pKCk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgc2V0dXBNYWluTWVudSgpOiB2b2lkIHtcblx0XHRzdXBlci5zZXR1cE1haW5NZW51KCk7XG5cblx0XHRmb3IgKGNvbnN0IHRvcExldmVsTWVudU5hbWUgb2YgT2JqZWN0LmtleXModGhpcy50b3BMZXZlbFRpdGxlcykpIHtcblx0XHRcdGNvbnN0IG1lbnUgPSB0aGlzLm1lbnVzW3RvcExldmVsTWVudU5hbWVdO1xuXHRcdFx0aWYgKG1lbnUpIHtcblx0XHRcdFx0dGhpcy5tYWluTWVudURpc3Bvc2FibGVzLmFkZChtZW51Lm9uRGlkQ2hhbmdlKCgpID0+IHRoaXMudXBkYXRlTWVudWJhcigpKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIGRvVXBkYXRlTWVudWJhcigpOiB2b2lkIHtcblx0XHQvLyBTaW5jZSB0aGUgbmF0aXZlIG1lbnViYXIgaXMgc2hhcmVkIGJldHdlZW4gd2luZG93cyAobWFpbiBwcm9jZXNzKVxuXHRcdC8vIG9ubHkgYWxsb3cgdGhlIGZvY3VzZWQgd2luZG93IHRvIHVwZGF0ZSB0aGUgbWVudWJhclxuXHRcdGlmICghdGhpcy5ob3N0U2VydmljZS5oYXNGb2N1cykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFNlbmQgbWVudXMgdG8gbWFpbiBwcm9jZXNzIHRvIGJlIHJlbmRlcmVkIGJ5IEVsZWN0cm9uXG5cdFx0Y29uc3QgbWVudWJhckRhdGEgPSB7IG1lbnVzOiB7fSwga2V5YmluZGluZ3M6IHt9IH07XG5cdFx0aWYgKHRoaXMuZ2V0TWVudWJhck1lbnVzKG1lbnViYXJEYXRhKSkge1xuXHRcdFx0dGhpcy5tZW51YmFyU2VydmljZS51cGRhdGVNZW51YmFyKHRoaXMubmF0aXZlSG9zdFNlcnZpY2Uud2luZG93SWQsIG1lbnViYXJEYXRhKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldE1lbnViYXJNZW51cyhtZW51YmFyRGF0YTogSU1lbnViYXJEYXRhKTogYm9vbGVhbiB7XG5cdFx0aWYgKCFtZW51YmFyRGF0YSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdG1lbnViYXJEYXRhLmtleWJpbmRpbmdzID0gdGhpcy5nZXRBZGRpdGlvbmFsS2V5YmluZGluZ3MoKTtcblx0XHRmb3IgKGNvbnN0IHRvcExldmVsTWVudU5hbWUgb2YgT2JqZWN0LmtleXModGhpcy50b3BMZXZlbFRpdGxlcykpIHtcblx0XHRcdGNvbnN0IG1lbnUgPSB0aGlzLm1lbnVzW3RvcExldmVsTWVudU5hbWVdO1xuXHRcdFx0aWYgKG1lbnUpIHtcblx0XHRcdFx0Y29uc3QgbWVudWJhck1lbnU6IElNZW51YmFyTWVudSA9IHsgaXRlbXM6IFtdIH07XG5cdFx0XHRcdGNvbnN0IG1lbnVBY3Rpb25zID0gZ2V0RmxhdENvbnRleHRNZW51QWN0aW9ucyhtZW51LmdldEFjdGlvbnMoeyBzaG91bGRGb3J3YXJkQXJnczogdHJ1ZSB9KSk7XG5cdFx0XHRcdHRoaXMucG9wdWxhdGVNZW51SXRlbXMobWVudUFjdGlvbnMsIG1lbnViYXJNZW51LCBtZW51YmFyRGF0YS5rZXliaW5kaW5ncyk7XG5cdFx0XHRcdGlmIChtZW51YmFyTWVudS5pdGVtcy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7IC8vIE1lbnVzIGFyZSBpbmNvbXBsZXRlXG5cdFx0XHRcdH1cblx0XHRcdFx0bWVudWJhckRhdGEubWVudXNbdG9wTGV2ZWxNZW51TmFtZV0gPSBtZW51YmFyTWVudTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgcG9wdWxhdGVNZW51SXRlbXMobWVudUFjdGlvbnM6IHJlYWRvbmx5IElBY3Rpb25bXSwgbWVudVRvUG9wdWxhdGU6IElNZW51YmFyTWVudSwga2V5YmluZGluZ3M6IHsgW2lkOiBzdHJpbmddOiBJTWVudWJhcktleWJpbmRpbmcgfCB1bmRlZmluZWQgfSkge1xuXHRcdGZvciAoY29uc3QgbWVudUl0ZW0gb2YgbWVudUFjdGlvbnMpIHtcblx0XHRcdGlmIChtZW51SXRlbSBpbnN0YW5jZW9mIFNlcGFyYXRvcikge1xuXHRcdFx0XHRtZW51VG9Qb3B1bGF0ZS5pdGVtcy5wdXNoKHsgaWQ6ICd2c2NvZGUubWVudWJhci5zZXBhcmF0b3InIH0pO1xuXHRcdFx0fSBlbHNlIGlmIChtZW51SXRlbSBpbnN0YW5jZW9mIE1lbnVJdGVtQWN0aW9uIHx8IG1lbnVJdGVtIGluc3RhbmNlb2YgU3VibWVudUl0ZW1BY3Rpb24pIHtcblxuXHRcdFx0XHQvLyB1c2UgbW5lbW9uaWNUaXRsZSB3aGVuZXZlciBwb3NzaWJsZVxuXHRcdFx0XHRjb25zdCB0aXRsZSA9IHR5cGVvZiBtZW51SXRlbS5pdGVtLnRpdGxlID09PSAnc3RyaW5nJ1xuXHRcdFx0XHRcdD8gbWVudUl0ZW0uaXRlbS50aXRsZVxuXHRcdFx0XHRcdDogbWVudUl0ZW0uaXRlbS50aXRsZS5tbmVtb25pY1RpdGxlID8/IG1lbnVJdGVtLml0ZW0udGl0bGUudmFsdWU7XG5cblx0XHRcdFx0aWYgKG1lbnVJdGVtIGluc3RhbmNlb2YgU3VibWVudUl0ZW1BY3Rpb24pIHtcblx0XHRcdFx0XHRjb25zdCBzdWJtZW51ID0geyBpdGVtczogW10gfTtcblxuXHRcdFx0XHRcdHRoaXMucG9wdWxhdGVNZW51SXRlbXMobWVudUl0ZW0uYWN0aW9ucywgc3VibWVudSwga2V5YmluZGluZ3MpO1xuXG5cdFx0XHRcdFx0aWYgKHN1Ym1lbnUuaXRlbXMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgbWVudWJhclN1Ym1lbnVJdGVtOiBJTWVudWJhck1lbnVJdGVtU3VibWVudSA9IHtcblx0XHRcdFx0XHRcdFx0aWQ6IG1lbnVJdGVtLmlkLFxuXHRcdFx0XHRcdFx0XHRsYWJlbDogdGl0bGUsXG5cdFx0XHRcdFx0XHRcdHN1Ym1lbnVcblx0XHRcdFx0XHRcdH07XG5cblx0XHRcdFx0XHRcdG1lbnVUb1BvcHVsYXRlLml0ZW1zLnB1c2gobWVudWJhclN1Ym1lbnVJdGVtKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aWYgKG1lbnVJdGVtLmlkID09PSBPcGVuUmVjZW50QWN0aW9uLklEKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBhY3Rpb25zID0gdGhpcy5nZXRPcGVuUmVjZW50QWN0aW9ucygpLm1hcCh0aGlzLnRyYW5zZm9ybU9wZW5SZWNlbnRBY3Rpb24pO1xuXHRcdFx0XHRcdFx0bWVudVRvUG9wdWxhdGUuaXRlbXMucHVzaCguLi5hY3Rpb25zKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjb25zdCBtZW51YmFyTWVudUl0ZW06IElNZW51YmFyTWVudUl0ZW1BY3Rpb24gPSB7XG5cdFx0XHRcdFx0XHRpZDogbWVudUl0ZW0uaWQsXG5cdFx0XHRcdFx0XHRsYWJlbDogdGl0bGVcblx0XHRcdFx0XHR9O1xuXG5cdFx0XHRcdFx0aWYgKGlzSUNvbW1hbmRBY3Rpb25Ub2dnbGVJbmZvKG1lbnVJdGVtLml0ZW0udG9nZ2xlZCkpIHtcblx0XHRcdFx0XHRcdG1lbnViYXJNZW51SXRlbS5sYWJlbCA9IG1lbnVJdGVtLml0ZW0udG9nZ2xlZC5tbmVtb25pY1RpdGxlID8/IG1lbnVJdGVtLml0ZW0udG9nZ2xlZC50aXRsZSA/PyB0aXRsZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAobWVudUl0ZW0uY2hlY2tlZCkge1xuXHRcdFx0XHRcdFx0bWVudWJhck1lbnVJdGVtLmNoZWNrZWQgPSB0cnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmICghbWVudUl0ZW0uZW5hYmxlZCkge1xuXHRcdFx0XHRcdFx0bWVudWJhck1lbnVJdGVtLmVuYWJsZWQgPSBmYWxzZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRrZXliaW5kaW5nc1ttZW51SXRlbS5pZF0gPSB0aGlzLmdldE1lbnViYXJLZXliaW5kaW5nKG1lbnVJdGVtLmlkKTtcblx0XHRcdFx0XHRtZW51VG9Qb3B1bGF0ZS5pdGVtcy5wdXNoKG1lbnViYXJNZW51SXRlbSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHRyYW5zZm9ybU9wZW5SZWNlbnRBY3Rpb24oYWN0aW9uOiBTZXBhcmF0b3IgfCBJT3BlblJlY2VudEFjdGlvbik6IE1lbnViYXJNZW51SXRlbSB7XG5cdFx0aWYgKGFjdGlvbiBpbnN0YW5jZW9mIFNlcGFyYXRvcikge1xuXHRcdFx0cmV0dXJuIHsgaWQ6ICd2c2NvZGUubWVudWJhci5zZXBhcmF0b3InIH07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGlkOiBhY3Rpb24uaWQsXG5cdFx0XHR1cmk6IGFjdGlvbi51cmksXG5cdFx0XHRyZW1vdGVBdXRob3JpdHk6IGFjdGlvbi5yZW1vdGVBdXRob3JpdHksXG5cdFx0XHRlbmFibGVkOiBhY3Rpb24uZW5hYmxlZCxcblx0XHRcdGxhYmVsOiBhY3Rpb24ubGFiZWxcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRBZGRpdGlvbmFsS2V5YmluZGluZ3MoKTogeyBbaWQ6IHN0cmluZ106IElNZW51YmFyS2V5YmluZGluZyB9IHtcblx0XHRjb25zdCBrZXliaW5kaW5nczogeyBbaWQ6IHN0cmluZ106IElNZW51YmFyS2V5YmluZGluZyB9ID0ge307XG5cdFx0aWYgKGlzTWFjaW50b3NoKSB7XG5cdFx0XHRjb25zdCBrZXliaW5kaW5nID0gdGhpcy5nZXRNZW51YmFyS2V5YmluZGluZygnd29ya2JlbmNoLmFjdGlvbi5xdWl0Jyk7XG5cdFx0XHRpZiAoa2V5YmluZGluZykge1xuXHRcdFx0XHRrZXliaW5kaW5nc1snd29ya2JlbmNoLmFjdGlvbi5xdWl0J10gPSBrZXliaW5kaW5nO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBrZXliaW5kaW5ncztcblx0fVxuXG5cdHByaXZhdGUgZ2V0TWVudWJhcktleWJpbmRpbmcoaWQ6IHN0cmluZyk6IElNZW51YmFyS2V5YmluZGluZyB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgYmluZGluZyA9IHRoaXMua2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyhpZCk7XG5cdFx0aWYgKCFiaW5kaW5nKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdC8vIGZpcnN0IHRyeSB0byByZXNvbHZlIGEgbmF0aXZlIGFjY2VsZXJhdG9yXG5cdFx0Y29uc3QgZWxlY3Ryb25BY2NlbGVyYXRvciA9IGJpbmRpbmcuZ2V0RWxlY3Ryb25BY2NlbGVyYXRvcigpO1xuXHRcdGlmIChlbGVjdHJvbkFjY2VsZXJhdG9yKSB7XG5cdFx0XHRyZXR1cm4geyBsYWJlbDogZWxlY3Ryb25BY2NlbGVyYXRvciwgdXNlclNldHRpbmdzTGFiZWw6IGJpbmRpbmcuZ2V0VXNlclNldHRpbmdzTGFiZWwoKSA/PyB1bmRlZmluZWQgfTtcblx0XHR9XG5cblx0XHQvLyB3ZSBuZWVkIHRoaXMgZmFsbGJhY2sgdG8gc3VwcG9ydCBrZXliaW5kaW5ncyB0aGF0IGNhbm5vdCBzaG93IGluIGVsZWN0cm9uIG1lbnVzIChlLmcuIGNob3Jkcylcblx0XHRjb25zdCBhY2NlbGVyYXRvckxhYmVsID0gYmluZGluZy5nZXRMYWJlbCgpO1xuXHRcdGlmIChhY2NlbGVyYXRvckxhYmVsKSB7XG5cdFx0XHRyZXR1cm4geyBsYWJlbDogYWNjZWxlcmF0b3JMYWJlbCwgaXNOYXRpdmU6IGZhbHNlLCB1c2VyU2V0dGluZ3NMYWJlbDogYmluZGluZy5nZXRVc2VyU2V0dGluZ3NMYWJlbCgpID8/IHVuZGVmaW5lZCB9O1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBa0IsaUJBQWlCO0FBQ25DLFNBQVMsY0FBYyxtQkFBbUIsc0JBQXNCO0FBQ2hFLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsMENBQTBDO0FBQ25ELFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQTRCLHNCQUFzQjtBQUNsRCxTQUFTLHVCQUF1QjtBQUVoQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLGtDQUFrQztBQUMzQyxTQUFTLGlDQUFpQztBQUVuQyxJQUFNLHVCQUFOLGNBQW1DLGVBQWU7QUFBQSxFQUV4RCxZQUNlLGFBQ00sbUJBQ0EsbUJBQ0EsbUJBQ0csc0JBQ1IsY0FDQyxlQUNDLGdCQUNLLHFCQUNELG9CQUNlLG9CQUNiLHNCQUNXLGdCQUNwQixhQUN1QixtQkFDcEIsZ0JBQ2hCO0FBQ0QsVUFBTSxhQUFhLG1CQUFtQixtQkFBbUIsbUJBQW1CLHNCQUFzQixjQUFjLGVBQWUsZ0JBQWdCLHFCQUFxQixvQkFBb0Isb0JBQW9CLHNCQUFzQixhQUFhLGNBQWM7QUFMM047QUFFRztBQUtyQyxLQUFDLFlBQVk7QUFDWixXQUFLLGlCQUFpQixNQUFNLEtBQUssa0JBQWtCLGtCQUFrQjtBQUVyRSxXQUFLLGdCQUFnQjtBQUFBLElBQ3RCLEdBQUc7QUFFSCxTQUFLLGtCQUFrQjtBQUFBLEVBQ3hCO0FBQUEsRUFFbUIsZ0JBQXNCO0FBQ3hDLFVBQU0sY0FBYztBQUVwQixlQUFXLG9CQUFvQixPQUFPLEtBQUssS0FBSyxjQUFjLEdBQUc7QUFDaEUsWUFBTSxPQUFPLEtBQUssTUFBTSxnQkFBZ0I7QUFDeEMsVUFBSSxNQUFNO0FBQ1QsYUFBSyxvQkFBb0IsSUFBSSxLQUFLLFlBQVksTUFBTSxLQUFLLGNBQWMsQ0FBQyxDQUFDO0FBQUEsTUFDMUU7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUFBLEVBRVUsa0JBQXdCO0FBR2pDLFFBQUksQ0FBQyxLQUFLLFlBQVksVUFBVTtBQUMvQjtBQUFBLElBQ0Q7QUFHQSxVQUFNLGNBQWMsRUFBRSxPQUFPLENBQUMsR0FBRyxhQUFhLENBQUMsRUFBRTtBQUNqRCxRQUFJLEtBQUssZ0JBQWdCLFdBQVcsR0FBRztBQUN0QyxXQUFLLGVBQWUsY0FBYyxLQUFLLGtCQUFrQixVQUFVLFdBQVc7QUFBQSxJQUMvRTtBQUFBLEVBQ0Q7QUFBQSxFQUVRLGdCQUFnQixhQUFvQztBQUMzRCxRQUFJLENBQUMsYUFBYTtBQUNqQixhQUFPO0FBQUEsSUFDUjtBQUVBLGdCQUFZLGNBQWMsS0FBSyx5QkFBeUI7QUFDeEQsZUFBVyxvQkFBb0IsT0FBTyxLQUFLLEtBQUssY0FBYyxHQUFHO0FBQ2hFLFlBQU0sT0FBTyxLQUFLLE1BQU0sZ0JBQWdCO0FBQ3hDLFVBQUksTUFBTTtBQUNULGNBQU0sY0FBNEIsRUFBRSxPQUFPLENBQUMsRUFBRTtBQUM5QyxjQUFNLGNBQWMsMEJBQTBCLEtBQUssV0FBVyxFQUFFLG1CQUFtQixLQUFLLENBQUMsQ0FBQztBQUMxRixhQUFLLGtCQUFrQixhQUFhLGFBQWEsWUFBWSxXQUFXO0FBQ3hFLFlBQUksWUFBWSxNQUFNLFdBQVcsR0FBRztBQUNuQyxpQkFBTztBQUFBLFFBQ1I7QUFDQSxvQkFBWSxNQUFNLGdCQUFnQixJQUFJO0FBQUEsTUFDdkM7QUFBQSxJQUNEO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLGtCQUFrQixhQUFpQyxnQkFBOEIsYUFBK0Q7QUFDdkosZUFBVyxZQUFZLGFBQWE7QUFDbkMsVUFBSSxvQkFBb0IsV0FBVztBQUNsQyx1QkFBZSxNQUFNLEtBQUssRUFBRSxJQUFJLDJCQUEyQixDQUFDO0FBQUEsTUFDN0QsV0FBVyxvQkFBb0Isa0JBQWtCLG9CQUFvQixtQkFBbUI7QUFHdkYsY0FBTSxRQUFRLE9BQU8sU0FBUyxLQUFLLFVBQVUsV0FDMUMsU0FBUyxLQUFLLFFBQ2QsU0FBUyxLQUFLLE1BQU0saUJBQWlCLFNBQVMsS0FBSyxNQUFNO0FBRTVELFlBQUksb0JBQW9CLG1CQUFtQjtBQUMxQyxnQkFBTSxVQUFVLEVBQUUsT0FBTyxDQUFDLEVBQUU7QUFFNUIsZUFBSyxrQkFBa0IsU0FBUyxTQUFTLFNBQVMsV0FBVztBQUU3RCxjQUFJLFFBQVEsTUFBTSxTQUFTLEdBQUc7QUFDN0Isa0JBQU0scUJBQThDO0FBQUEsY0FDbkQsSUFBSSxTQUFTO0FBQUEsY0FDYixPQUFPO0FBQUEsY0FDUDtBQUFBLFlBQ0Q7QUFFQSwyQkFBZSxNQUFNLEtBQUssa0JBQWtCO0FBQUEsVUFDN0M7QUFBQSxRQUNELE9BQU87QUFDTixjQUFJLFNBQVMsT0FBTyxpQkFBaUIsSUFBSTtBQUN4QyxrQkFBTSxVQUFVLEtBQUsscUJBQXFCLEVBQUUsSUFBSSxLQUFLLHlCQUF5QjtBQUM5RSwyQkFBZSxNQUFNLEtBQUssR0FBRyxPQUFPO0FBQUEsVUFDckM7QUFFQSxnQkFBTSxrQkFBMEM7QUFBQSxZQUMvQyxJQUFJLFNBQVM7QUFBQSxZQUNiLE9BQU87QUFBQSxVQUNSO0FBRUEsY0FBSSwyQkFBMkIsU0FBUyxLQUFLLE9BQU8sR0FBRztBQUN0RCw0QkFBZ0IsUUFBUSxTQUFTLEtBQUssUUFBUSxpQkFBaUIsU0FBUyxLQUFLLFFBQVEsU0FBUztBQUFBLFVBQy9GO0FBRUEsY0FBSSxTQUFTLFNBQVM7QUFDckIsNEJBQWdCLFVBQVU7QUFBQSxVQUMzQjtBQUVBLGNBQUksQ0FBQyxTQUFTLFNBQVM7QUFDdEIsNEJBQWdCLFVBQVU7QUFBQSxVQUMzQjtBQUVBLHNCQUFZLFNBQVMsRUFBRSxJQUFJLEtBQUsscUJBQXFCLFNBQVMsRUFBRTtBQUNoRSx5QkFBZSxNQUFNLEtBQUssZUFBZTtBQUFBLFFBQzFDO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQUEsRUFFUSwwQkFBMEIsUUFBd0Q7QUFDekYsUUFBSSxrQkFBa0IsV0FBVztBQUNoQyxhQUFPLEVBQUUsSUFBSSwyQkFBMkI7QUFBQSxJQUN6QztBQUVBLFdBQU87QUFBQSxNQUNOLElBQUksT0FBTztBQUFBLE1BQ1gsS0FBSyxPQUFPO0FBQUEsTUFDWixpQkFBaUIsT0FBTztBQUFBLE1BQ3hCLFNBQVMsT0FBTztBQUFBLE1BQ2hCLE9BQU8sT0FBTztBQUFBLElBQ2Y7QUFBQSxFQUNEO0FBQUEsRUFFUSwyQkFBaUU7QUFDeEUsVUFBTSxjQUFvRCxDQUFDO0FBQzNELFFBQUksYUFBYTtBQUNoQixZQUFNLGFBQWEsS0FBSyxxQkFBcUIsdUJBQXVCO0FBQ3BFLFVBQUksWUFBWTtBQUNmLG9CQUFZLHVCQUF1QixJQUFJO0FBQUEsTUFDeEM7QUFBQSxJQUNEO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLHFCQUFxQixJQUE0QztBQUN4RSxVQUFNLFVBQVUsS0FBSyxrQkFBa0IsaUJBQWlCLEVBQUU7QUFDMUQsUUFBSSxDQUFDLFNBQVM7QUFDYixhQUFPO0FBQUEsSUFDUjtBQUdBLFVBQU0sc0JBQXNCLFFBQVEsdUJBQXVCO0FBQzNELFFBQUkscUJBQXFCO0FBQ3hCLGFBQU8sRUFBRSxPQUFPLHFCQUFxQixtQkFBbUIsUUFBUSxxQkFBcUIsS0FBSyxPQUFVO0FBQUEsSUFDckc7QUFHQSxVQUFNLG1CQUFtQixRQUFRLFNBQVM7QUFDMUMsUUFBSSxrQkFBa0I7QUFDckIsYUFBTyxFQUFFLE9BQU8sa0JBQWtCLFVBQVUsT0FBTyxtQkFBbUIsUUFBUSxxQkFBcUIsS0FBSyxPQUFVO0FBQUEsSUFDbkg7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUNEO0FBbkxhLHVCQUFOO0FBQUEsRUFHSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBbEJVOyIsCiAgIm5hbWVzIjogW10KfQo=
