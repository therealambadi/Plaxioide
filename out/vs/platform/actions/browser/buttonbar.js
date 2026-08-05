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
import { ButtonBar } from "../../../base/browser/ui/button/button.js";
import { createInstantHoverDelegate } from "../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { ActionRunner, SubmenuAction } from "../../../base/common/actions.js";
import { Codicon } from "../../../base/common/codicons.js";
import { Emitter } from "../../../base/common/event.js";
import { DisposableStore } from "../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../base/common/themables.js";
import { localize } from "../../../nls.js";
import { getActionBarActions } from "./menuEntryActionViewItem.js";
import { IMenuService, MenuItemAction } from "../common/actions.js";
import { IContextKeyService } from "../../contextkey/common/contextkey.js";
import { IContextMenuService } from "../../contextview/browser/contextView.js";
import { IHoverService } from "../../hover/browser/hover.js";
import { IKeybindingService } from "../../keybinding/common/keybinding.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
let WorkbenchButtonBar = class extends ButtonBar {
  constructor(container, _options, _contextMenuService, _keybindingService, telemetryService, _hoverService) {
    super(container);
    this._options = _options;
    this._contextMenuService = _contextMenuService;
    this._keybindingService = _keybindingService;
    this._hoverService = _hoverService;
    this._store = new DisposableStore();
    this._updateStore = new DisposableStore();
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
    this._actionRunner = this._store.add(new ActionRunner());
    if (_options?.telemetrySource) {
      this._actionRunner.onDidRun((e) => {
        telemetryService.publicLog2(
          "workbenchActionExecuted",
          { id: e.action.id, from: _options.telemetrySource }
        );
      }, void 0, this._store);
    }
  }
  dispose() {
    this._onDidChange.dispose();
    this._updateStore.dispose();
    this._store.dispose();
    super.dispose();
  }
  update(actions, secondary) {
    const conifgProvider = this._options?.buttonConfigProvider ?? (() => ({ showLabel: true }));
    this._updateStore.clear();
    this.clear();
    const hoverDelegate = this._updateStore.add(createInstantHoverDelegate());
    for (let i = 0; i < actions.length; i++) {
      const secondary2 = i > 0;
      const actionOrSubmenu = actions[i];
      let action;
      let btn;
      if (actionOrSubmenu instanceof SubmenuAction && actionOrSubmenu.actions.length > 0) {
        const [first, ...rest] = actionOrSubmenu.actions;
        action = first;
        btn = this.addButtonWithDropdown({
          secondary: conifgProvider(action, i)?.isSecondary ?? secondary2,
          actionRunner: this._actionRunner,
          actions: rest,
          contextMenuProvider: this._contextMenuService,
          ariaLabel: action.label,
          supportIcons: true
        });
      } else {
        action = actionOrSubmenu;
        btn = this.addButton({
          secondary: conifgProvider(action, i)?.isSecondary ?? secondary2,
          ariaLabel: action.label,
          supportIcons: true
        });
      }
      btn.enabled = action.enabled;
      btn.checked = action.checked ?? false;
      btn.element.classList.add("default-colors");
      const showLabel = conifgProvider(action, i)?.showLabel ?? true;
      if (showLabel) {
        btn.label = action.label;
      } else {
        btn.element.classList.add("monaco-text-button");
      }
      if (conifgProvider(action, i)?.showIcon) {
        if (action instanceof MenuItemAction && ThemeIcon.isThemeIcon(action.item.icon)) {
          if (!showLabel) {
            btn.icon = action.item.icon;
          } else {
            btn.label = `$(${action.item.icon.id}) ${action.label}`;
          }
        } else if (action.class) {
          btn.element.classList.add(...action.class.split(" "));
        }
      }
      const kb = this._keybindingService.lookupKeybinding(action.id);
      let tooltip;
      if (kb) {
        tooltip = localize("labelWithKeybinding", "{0} ({1})", action.tooltip || action.label, kb.getLabel());
      } else {
        tooltip = action.tooltip || action.label;
      }
      this._updateStore.add(this._hoverService.setupManagedHover(hoverDelegate, btn.element, tooltip));
      this._updateStore.add(btn.onDidClick(async () => {
        this._actionRunner.run(action);
      }));
    }
    if (secondary.length > 0) {
      const btn = this.addButton({
        secondary: true,
        ariaLabel: localize("moreActions", "More Actions")
      });
      btn.icon = Codicon.dropDownButton;
      btn.element.classList.add("default-colors", "monaco-text-button");
      btn.enabled = true;
      this._updateStore.add(this._hoverService.setupManagedHover(hoverDelegate, btn.element, localize("moreActions", "More Actions")));
      this._updateStore.add(btn.onDidClick(async () => {
        this._contextMenuService.showContextMenu({
          getAnchor: () => btn.element,
          getActions: () => secondary,
          actionRunner: this._actionRunner,
          onHide: () => btn.element.setAttribute("aria-expanded", "false")
        });
        btn.element.setAttribute("aria-expanded", "true");
      }));
    }
    this._onDidChange.fire(this);
  }
};
WorkbenchButtonBar = __decorateClass([
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, ITelemetryService),
  __decorateParam(5, IHoverService)
], WorkbenchButtonBar);
let MenuWorkbenchButtonBar = class extends WorkbenchButtonBar {
  constructor(container, menuId, options, menuService, contextKeyService, contextMenuService, keybindingService, telemetryService, hoverService) {
    super(container, options, contextMenuService, keybindingService, telemetryService, hoverService);
    const menu = menuService.createMenu(menuId, contextKeyService);
    this._store.add(menu);
    const update = () => {
      this.clear();
      const actions = getActionBarActions(
        menu.getActions(options?.menuOptions),
        options?.toolbarOptions?.primaryGroup
      );
      super.update(actions.primary, actions.secondary);
    };
    this._store.add(menu.onDidChange(update));
    update();
  }
  dispose() {
    super.dispose();
  }
  update(_actions) {
    throw new Error("Use Menu or WorkbenchButtonBar");
  }
};
MenuWorkbenchButtonBar = __decorateClass([
  __decorateParam(3, IMenuService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IContextMenuService),
  __decorateParam(6, IKeybindingService),
  __decorateParam(7, ITelemetryService),
  __decorateParam(8, IHoverService)
], MenuWorkbenchButtonBar);
export {
  MenuWorkbenchButtonBar,
  WorkbenchButtonBar
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvYnV0dG9uYmFyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQnV0dG9uQmFyLCBJQnV0dG9uIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2J1dHRvbi9idXR0b24uanMnO1xuaW1wb3J0IHsgY3JlYXRlSW5zdGFudEhvdmVyRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXJEZWxlZ2F0ZUZhY3RvcnkuanMnO1xuaW1wb3J0IHsgQWN0aW9uUnVubmVyLCBJQWN0aW9uLCBJQWN0aW9uUnVubmVyLCBTdWJtZW51QWN0aW9uLCBXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZENsYXNzaWZpY2F0aW9uLCBXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IGdldEFjdGlvbkJhckFjdGlvbnMgfSBmcm9tICcuL21lbnVFbnRyeUFjdGlvblZpZXdJdGVtLmpzJztcbmltcG9ydCB7IElUb29sQmFyUmVuZGVyT3B0aW9ucyB9IGZyb20gJy4vdG9vbGJhci5qcyc7XG5pbXBvcnQgeyBNZW51SWQsIElNZW51U2VydmljZSwgTWVudUl0ZW1BY3Rpb24sIElNZW51QWN0aW9uT3B0aW9ucyB9IGZyb20gJy4uL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgSUhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcblxuZXhwb3J0IHR5cGUgSUJ1dHRvbkNvbmZpZ1Byb3ZpZGVyID0gKGFjdGlvbjogSUFjdGlvbiwgaW5kZXg6IG51bWJlcikgPT4ge1xuXHRzaG93SWNvbj86IGJvb2xlYW47XG5cdHNob3dMYWJlbD86IGJvb2xlYW47XG5cdGlzU2Vjb25kYXJ5PzogYm9vbGVhbjtcbn0gfCB1bmRlZmluZWQ7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVdvcmtiZW5jaEJ1dHRvbkJhck9wdGlvbnMge1xuXHR0ZWxlbWV0cnlTb3VyY2U/OiBzdHJpbmc7XG5cdGJ1dHRvbkNvbmZpZ1Byb3ZpZGVyPzogSUJ1dHRvbkNvbmZpZ1Byb3ZpZGVyO1xufVxuXG5leHBvcnQgY2xhc3MgV29ya2JlbmNoQnV0dG9uQmFyIGV4dGVuZHMgQnV0dG9uQmFyIHtcblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX3N0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX3VwZGF0ZVN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2FjdGlvblJ1bm5lcjogSUFjdGlvblJ1bm5lcjtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2UgPSBuZXcgRW1pdHRlcjx0aGlzPigpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZTogRXZlbnQ8dGhpcz4gPSB0aGlzLl9vbkRpZENoYW5nZS5ldmVudDtcblxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfb3B0aW9uczogSVdvcmtiZW5jaEJ1dHRvbkJhck9wdGlvbnMgfCB1bmRlZmluZWQsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfa2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihjb250YWluZXIpO1xuXG5cdFx0dGhpcy5fYWN0aW9uUnVubmVyID0gdGhpcy5fc3RvcmUuYWRkKG5ldyBBY3Rpb25SdW5uZXIoKSk7XG5cdFx0aWYgKF9vcHRpb25zPy50ZWxlbWV0cnlTb3VyY2UpIHtcblx0XHRcdHRoaXMuX2FjdGlvblJ1bm5lci5vbkRpZFJ1bihlID0+IHtcblx0XHRcdFx0dGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFdvcmtiZW5jaEFjdGlvbkV4ZWN1dGVkRXZlbnQsIFdvcmtiZW5jaEFjdGlvbkV4ZWN1dGVkQ2xhc3NpZmljYXRpb24+KFxuXHRcdFx0XHRcdCd3b3JrYmVuY2hBY3Rpb25FeGVjdXRlZCcsXG5cdFx0XHRcdFx0eyBpZDogZS5hY3Rpb24uaWQsIGZyb206IF9vcHRpb25zLnRlbGVtZXRyeVNvdXJjZSEgfVxuXHRcdFx0XHQpO1xuXHRcdFx0fSwgdW5kZWZpbmVkLCB0aGlzLl9zdG9yZSk7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpIHtcblx0XHR0aGlzLl9vbkRpZENoYW5nZS5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fdXBkYXRlU3RvcmUuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX3N0b3JlLmRpc3Bvc2UoKTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cblxuXHR1cGRhdGUoYWN0aW9uczogSUFjdGlvbltdLCBzZWNvbmRhcnk6IElBY3Rpb25bXSk6IHZvaWQge1xuXG5cdFx0Y29uc3QgY29uaWZnUHJvdmlkZXI6IElCdXR0b25Db25maWdQcm92aWRlciA9IHRoaXMuX29wdGlvbnM/LmJ1dHRvbkNvbmZpZ1Byb3ZpZGVyID8/ICgoKSA9PiAoeyBzaG93TGFiZWw6IHRydWUgfSkpO1xuXG5cdFx0dGhpcy5fdXBkYXRlU3RvcmUuY2xlYXIoKTtcblx0XHR0aGlzLmNsZWFyKCk7XG5cblx0XHQvLyBTdXBwb3J0IGluc3RhbXQgaG92ZXIgYmV0d2VlbiBidXR0b25zXG5cdFx0Y29uc3QgaG92ZXJEZWxlZ2F0ZSA9IHRoaXMuX3VwZGF0ZVN0b3JlLmFkZChjcmVhdGVJbnN0YW50SG92ZXJEZWxlZ2F0ZSgpKTtcblxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgYWN0aW9ucy5sZW5ndGg7IGkrKykge1xuXG5cdFx0XHRjb25zdCBzZWNvbmRhcnkgPSBpID4gMDtcblx0XHRcdGNvbnN0IGFjdGlvbk9yU3VibWVudSA9IGFjdGlvbnNbaV07XG5cdFx0XHRsZXQgYWN0aW9uOiBJQWN0aW9uO1xuXHRcdFx0bGV0IGJ0bjogSUJ1dHRvbjtcblxuXHRcdFx0aWYgKGFjdGlvbk9yU3VibWVudSBpbnN0YW5jZW9mIFN1Ym1lbnVBY3Rpb24gJiYgYWN0aW9uT3JTdWJtZW51LmFjdGlvbnMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRjb25zdCBbZmlyc3QsIC4uLnJlc3RdID0gYWN0aW9uT3JTdWJtZW51LmFjdGlvbnM7XG5cdFx0XHRcdGFjdGlvbiA9IDxNZW51SXRlbUFjdGlvbj5maXJzdDtcblx0XHRcdFx0YnRuID0gdGhpcy5hZGRCdXR0b25XaXRoRHJvcGRvd24oe1xuXHRcdFx0XHRcdHNlY29uZGFyeTogY29uaWZnUHJvdmlkZXIoYWN0aW9uLCBpKT8uaXNTZWNvbmRhcnkgPz8gc2Vjb25kYXJ5LFxuXHRcdFx0XHRcdGFjdGlvblJ1bm5lcjogdGhpcy5fYWN0aW9uUnVubmVyLFxuXHRcdFx0XHRcdGFjdGlvbnM6IHJlc3QsXG5cdFx0XHRcdFx0Y29udGV4dE1lbnVQcm92aWRlcjogdGhpcy5fY29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdFx0XHRcdGFyaWFMYWJlbDogYWN0aW9uLmxhYmVsLFxuXHRcdFx0XHRcdHN1cHBvcnRJY29uczogdHJ1ZSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRhY3Rpb24gPSBhY3Rpb25PclN1Ym1lbnU7XG5cdFx0XHRcdGJ0biA9IHRoaXMuYWRkQnV0dG9uKHtcblx0XHRcdFx0XHRzZWNvbmRhcnk6IGNvbmlmZ1Byb3ZpZGVyKGFjdGlvbiwgaSk/LmlzU2Vjb25kYXJ5ID8/IHNlY29uZGFyeSxcblx0XHRcdFx0XHRhcmlhTGFiZWw6IGFjdGlvbi5sYWJlbCxcblx0XHRcdFx0XHRzdXBwb3J0SWNvbnM6IHRydWUsXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRidG4uZW5hYmxlZCA9IGFjdGlvbi5lbmFibGVkO1xuXHRcdFx0YnRuLmNoZWNrZWQgPSBhY3Rpb24uY2hlY2tlZCA/PyBmYWxzZTtcblx0XHRcdGJ0bi5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2RlZmF1bHQtY29sb3JzJyk7XG5cdFx0XHRjb25zdCBzaG93TGFiZWwgPSBjb25pZmdQcm92aWRlcihhY3Rpb24sIGkpPy5zaG93TGFiZWwgPz8gdHJ1ZTtcblx0XHRcdGlmIChzaG93TGFiZWwpIHtcblx0XHRcdFx0YnRuLmxhYmVsID0gYWN0aW9uLmxhYmVsO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YnRuLmVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnbW9uYWNvLXRleHQtYnV0dG9uJyk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoY29uaWZnUHJvdmlkZXIoYWN0aW9uLCBpKT8uc2hvd0ljb24pIHtcblx0XHRcdFx0aWYgKGFjdGlvbiBpbnN0YW5jZW9mIE1lbnVJdGVtQWN0aW9uICYmIFRoZW1lSWNvbi5pc1RoZW1lSWNvbihhY3Rpb24uaXRlbS5pY29uKSkge1xuXHRcdFx0XHRcdGlmICghc2hvd0xhYmVsKSB7XG5cdFx0XHRcdFx0XHRidG4uaWNvbiA9IGFjdGlvbi5pdGVtLmljb247XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdC8vIHRoaXMgaXMgUkVBTExZIGhhY2t5IGJ1dCBjb21iaW5pbmcgYSBjb2RpY29uIGFuZCBub3JtYWwgdGV4dCBpcyB1Z2x5IGJlY2F1c2Vcblx0XHRcdFx0XHRcdC8vIHRoZSBmb3JtZXIgZGVmaW5lIGEgZm9udCB3aGljaCBkb2Vzbid0IHdvcmsgZm9yIHRleHRcblx0XHRcdFx0XHRcdGJ0bi5sYWJlbCA9IGAkKCR7YWN0aW9uLml0ZW0uaWNvbi5pZH0pICR7YWN0aW9uLmxhYmVsfWA7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2UgaWYgKGFjdGlvbi5jbGFzcykge1xuXHRcdFx0XHRcdGJ0bi5lbGVtZW50LmNsYXNzTGlzdC5hZGQoLi4uYWN0aW9uLmNsYXNzLnNwbGl0KCcgJykpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBrYiA9IHRoaXMuX2tleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoYWN0aW9uLmlkKTtcblx0XHRcdGxldCB0b29sdGlwOiBzdHJpbmc7XG5cdFx0XHRpZiAoa2IpIHtcblx0XHRcdFx0dG9vbHRpcCA9IGxvY2FsaXplKCdsYWJlbFdpdGhLZXliaW5kaW5nJywgXCJ7MH0gKHsxfSlcIiwgYWN0aW9uLnRvb2x0aXAgfHwgYWN0aW9uLmxhYmVsLCBrYi5nZXRMYWJlbCgpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRvb2x0aXAgPSBhY3Rpb24udG9vbHRpcCB8fCBhY3Rpb24ubGFiZWw7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl91cGRhdGVTdG9yZS5hZGQodGhpcy5faG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGhvdmVyRGVsZWdhdGUsIGJ0bi5lbGVtZW50LCB0b29sdGlwKSk7XG5cdFx0XHR0aGlzLl91cGRhdGVTdG9yZS5hZGQoYnRuLm9uRGlkQ2xpY2soYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9hY3Rpb25SdW5uZXIucnVuKGFjdGlvbik7XG5cdFx0XHR9KSk7XG5cdFx0fVxuXG5cdFx0aWYgKHNlY29uZGFyeS5sZW5ndGggPiAwKSB7XG5cblx0XHRcdGNvbnN0IGJ0biA9IHRoaXMuYWRkQnV0dG9uKHtcblx0XHRcdFx0c2Vjb25kYXJ5OiB0cnVlLFxuXHRcdFx0XHRhcmlhTGFiZWw6IGxvY2FsaXplKCdtb3JlQWN0aW9ucycsIFwiTW9yZSBBY3Rpb25zXCIpXG5cdFx0XHR9KTtcblxuXHRcdFx0YnRuLmljb24gPSBDb2RpY29uLmRyb3BEb3duQnV0dG9uO1xuXHRcdFx0YnRuLmVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnZGVmYXVsdC1jb2xvcnMnLCAnbW9uYWNvLXRleHQtYnV0dG9uJyk7XG5cblx0XHRcdGJ0bi5lbmFibGVkID0gdHJ1ZTtcblx0XHRcdHRoaXMuX3VwZGF0ZVN0b3JlLmFkZCh0aGlzLl9ob3ZlclNlcnZpY2Uuc2V0dXBNYW5hZ2VkSG92ZXIoaG92ZXJEZWxlZ2F0ZSwgYnRuLmVsZW1lbnQsIGxvY2FsaXplKCdtb3JlQWN0aW9ucycsIFwiTW9yZSBBY3Rpb25zXCIpKSk7XG5cdFx0XHR0aGlzLl91cGRhdGVTdG9yZS5hZGQoYnRuLm9uRGlkQ2xpY2soYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9jb250ZXh0TWVudVNlcnZpY2Uuc2hvd0NvbnRleHRNZW51KHtcblx0XHRcdFx0XHRnZXRBbmNob3I6ICgpID0+IGJ0bi5lbGVtZW50LFxuXHRcdFx0XHRcdGdldEFjdGlvbnM6ICgpID0+IHNlY29uZGFyeSxcblx0XHRcdFx0XHRhY3Rpb25SdW5uZXI6IHRoaXMuX2FjdGlvblJ1bm5lcixcblx0XHRcdFx0XHRvbkhpZGU6ICgpID0+IGJ0bi5lbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsICdmYWxzZScpXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRidG4uZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCAndHJ1ZScpO1xuXG5cdFx0XHR9KSk7XG5cdFx0fVxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUodGhpcyk7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJTWVudVdvcmtiZW5jaEJ1dHRvbkJhck9wdGlvbnMgZXh0ZW5kcyBJV29ya2JlbmNoQnV0dG9uQmFyT3B0aW9ucyB7XG5cdG1lbnVPcHRpb25zPzogSU1lbnVBY3Rpb25PcHRpb25zO1xuXG5cdHRvb2xiYXJPcHRpb25zPzogSVRvb2xCYXJSZW5kZXJPcHRpb25zO1xufVxuXG5leHBvcnQgY2xhc3MgTWVudVdvcmtiZW5jaEJ1dHRvbkJhciBleHRlbmRzIFdvcmtiZW5jaEJ1dHRvbkJhciB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0Y29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRtZW51SWQ6IE1lbnVJZCxcblx0XHRvcHRpb25zOiBJTWVudVdvcmtiZW5jaEJ1dHRvbkJhck9wdGlvbnMgfCB1bmRlZmluZWQsXG5cdFx0QElNZW51U2VydmljZSBtZW51U2VydmljZTogSU1lbnVTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKGNvbnRhaW5lciwgb3B0aW9ucywgY29udGV4dE1lbnVTZXJ2aWNlLCBrZXliaW5kaW5nU2VydmljZSwgdGVsZW1ldHJ5U2VydmljZSwgaG92ZXJTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IG1lbnUgPSBtZW51U2VydmljZS5jcmVhdGVNZW51KG1lbnVJZCwgY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX3N0b3JlLmFkZChtZW51KTtcblxuXHRcdGNvbnN0IHVwZGF0ZSA9ICgpID0+IHtcblxuXHRcdFx0dGhpcy5jbGVhcigpO1xuXG5cdFx0XHRjb25zdCBhY3Rpb25zID0gZ2V0QWN0aW9uQmFyQWN0aW9ucyhcblx0XHRcdFx0bWVudS5nZXRBY3Rpb25zKG9wdGlvbnM/Lm1lbnVPcHRpb25zKSxcblx0XHRcdFx0b3B0aW9ucz8udG9vbGJhck9wdGlvbnM/LnByaW1hcnlHcm91cFxuXHRcdFx0KTtcblxuXHRcdFx0c3VwZXIudXBkYXRlKGFjdGlvbnMucHJpbWFyeSwgYWN0aW9ucy5zZWNvbmRhcnkpO1xuXHRcdH07XG5cdFx0dGhpcy5fc3RvcmUuYWRkKG1lbnUub25EaWRDaGFuZ2UodXBkYXRlKSk7XG5cdFx0dXBkYXRlKCk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCkge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdG92ZXJyaWRlIHVwZGF0ZShfYWN0aW9uczogSUFjdGlvbltdKTogdm9pZCB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdVc2UgTWVudSBvciBXb3JrYmVuY2hCdXR0b25CYXInKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGlCQUEwQjtBQUNuQyxTQUFTLGtDQUFrQztBQUMzQyxTQUFTLGNBQXNDLHFCQUEwRjtBQUN6SSxTQUFTLGVBQWU7QUFDeEIsU0FBUyxlQUFzQjtBQUMvQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDJCQUEyQjtBQUVwQyxTQUFpQixjQUFjLHNCQUEwQztBQUN6RSxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHlCQUF5QjtBQWEzQixJQUFNLHFCQUFOLGNBQWlDLFVBQVU7QUFBQSxFQVVqRCxZQUNDLFdBQ2lCLFVBQ3FCLHFCQUNELG9CQUNsQixrQkFDYSxlQUMvQjtBQUNELFVBQU0sU0FBUztBQU5FO0FBQ3FCO0FBQ0Q7QUFFTDtBQWRqQyxTQUFtQixTQUFTLElBQUksZ0JBQWdCO0FBQ2hELFNBQW1CLGVBQWUs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
