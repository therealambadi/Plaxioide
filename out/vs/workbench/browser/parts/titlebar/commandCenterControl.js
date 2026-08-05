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
import { isActiveDocument, reset } from "../../../../base/browser/dom.js";
import { BaseActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { renderIcon } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { SubmenuAction } from "../../../../base/common/actions.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { createActionViewItem } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { HiddenItemStrategy, MenuWorkbenchToolBar, WorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { MenuId, MenuRegistry, SubmenuItemAction } from "../../../../platform/actions/common/actions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
let CommandCenterControl = class {
  constructor(windowTitle, hoverDelegate, instantiationService, quickInputService) {
    this._disposables = new DisposableStore();
    this._onDidChangeVisibility = this._disposables.add(new Emitter());
    this.onDidChangeVisibility = this._onDidChangeVisibility.event;
    this.element = document.createElement("div");
    this.element.classList.add("command-center");
    const titleToolbar = instantiationService.createInstance(MenuWorkbenchToolBar, this.element, MenuId.CommandCenter, {
      contextMenu: MenuId.TitleBarContext,
      hiddenItemStrategy: HiddenItemStrategy.NoHide,
      toolbarOptions: {
        primaryGroup: () => true
      },
      telemetrySource: "commandCenter",
      actionViewItemProvider: (action, options) => {
        if (action instanceof SubmenuItemAction && action.item.submenu === MenuId.CommandCenterCenter) {
          return instantiationService.createInstance(CommandCenterCenterViewItem, action, windowTitle, { ...options, hoverDelegate });
        } else {
          return createActionViewItem(instantiationService, action, { ...options, hoverDelegate });
        }
      }
    });
    this._disposables.add(Event.filter(quickInputService.onShow, () => isActiveDocument(this.element), this._disposables)(this._setVisibility.bind(this, false)));
    this._disposables.add(quickInputService.onHide(this._setVisibility.bind(this, true)));
    this._disposables.add(titleToolbar);
  }
  _setVisibility(show) {
    this.element.classList.toggle("hide", !show);
    this._onDidChangeVisibility.fire();
  }
  dispose() {
    this._disposables.dispose();
  }
};
CommandCenterControl = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IQuickInputService)
], CommandCenterControl);
let CommandCenterCenterViewItem = class extends BaseActionViewItem {
  constructor(_submenu, _windowTitle, options, _hoverService, _keybindingService, _instaService, _editorGroupService) {
    super(void 0, _submenu.actions.find((action) => action.id === "workbench.action.quickOpenWithModes") ?? _submenu.actions[0], options);
    this._submenu = _submenu;
    this._windowTitle = _windowTitle;
    this._hoverService = _hoverService;
    this._keybindingService = _keybindingService;
    this._instaService = _instaService;
    this._editorGroupService = _editorGroupService;
    this._hoverDelegate = options.hoverDelegate ?? getDefaultHoverDelegate("mouse");
  }
  render(container) {
    super.render(container);
    container.classList.add("command-center-center");
    container.classList.toggle("multiple", this._submenu.actions.length > 1);
    const hover = this._store.add(this._hoverService.setupManagedHover(this._hoverDelegate, container, this.getTooltip()));
    this._store.add(this._windowTitle.onDidChange(() => {
      hover.update(this.getTooltip());
    }));
    const groups = [];
    for (const action of this._submenu.actions) {
      if (action instanceof SubmenuAction) {
        groups.push(action.actions);
      } else {
        groups.push([action]);
      }
    }
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const toolbar = this._instaService.createInstance(WorkbenchToolBar, container, {
        hiddenItemStrategy: HiddenItemStrategy.NoHide,
        telemetrySource: "commandCenterCenter",
        actionViewItemProvider: (action, options) => {
          options = {
            ...options,
            hoverDelegate: this._hoverDelegate
          };
          if (action.id !== CommandCenterCenterViewItem._quickOpenCommandId) {
            return createActionViewItem(this._instaService, action, options);
          }
          const that = this;
          return this._instaService.createInstance(class CommandCenterQuickPickItem extends BaseActionViewItem {
            constructor() {
              super(void 0, action, options);
            }
            render(container2) {
              super.render(container2);
              container2.classList.toggle("command-center-quick-pick");
              container2.role = "button";
              container2.style.cssText = "display:flex;align-items:center;justify-content:center;padding:0 12px;cursor:pointer;";
              const logoEl = document.createElement("span");
              logoEl.textContent = "Plaxio";
              logoEl.style.cssText = "font-size:13px;font-weight:600;letter-spacing:0.04em;opacity:0.85;pointer-events:none;";
              container2.addEventListener("mouseenter", () => { logoEl.style.opacity = "1"; });
              container2.addEventListener("mouseleave", () => { logoEl.style.opacity = "0.85"; });
              reset(container2, logoEl);
            }
            getTooltip() {
              return that.getTooltip();
            }
            _getLabel() {
              const { prefix, suffix } = that._windowTitle.getTitleDecorations();
              let label = that._windowTitle.workspaceName;
              if (that._windowTitle.isCustomTitleFormat()) {
                label = that._windowTitle.getWindowTitle();
              } else if (that._editorGroupService.partOptions.showTabs === "none") {
                label = that._windowTitle.fileName ?? label;
              }
              if (!label) {
                label = localize("label.dfl", "Search");
              }
              if (prefix) {
                label = localize("label1", "{0} {1}", prefix, label);
              }
              if (suffix) {
                label = localize("label2", "{0} {1}", label, suffix);
              }
              return label.replaceAll(/\r\n|\r|\n/g, "\u23CE");
            }
          });
        }
      });
      toolbar.setActions(group);
      this._store.add(toolbar);
      if (i < groups.length - 1) {
        const icon = renderIcon(Codicon.circleSmallFilled);
        icon.style.padding = "0 12px";
        icon.style.height = "100%";
        icon.style.opacity = "0.5";
        container.appendChild(icon);
      }
    }
  }
  getTooltip() {
    const kb = this._keybindingService.lookupKeybinding(this.action.id)?.getLabel();
    const title = kb ? localize("title", "Search {0} ({1}) \u2014 {2}", this._windowTitle.workspaceName, kb, this._windowTitle.value) : localize("title2", "Search {0} \u2014 {1}", this._windowTitle.workspaceName, this._windowTitle.value);
    return title;
  }
};
CommandCenterCenterViewItem._quickOpenCommandId = "workbench.action.quickOpenWithModes";
CommandCenterCenterViewItem = __decorateClass([
  __decorateParam(3, IHoverService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IEditorGroupsService)
], CommandCenterCenterViewItem);
MenuRegistry.appendMenuItem(MenuId.CommandCenter, {
  submenu: MenuId.CommandCenterCenter,
  title: localize("title3", "Command Center"),
  icon: Codicon.shield,
  order: 101
});
export {
  CommandCenterControl
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy90aXRsZWJhci9jb21tYW5kQ2VudGVyQ29udHJvbC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGlzQWN0aXZlRG9jdW1lbnQsIHJlc2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBCYXNlQWN0aW9uVmlld0l0ZW0sIElCYXNlQWN0aW9uVmlld0l0ZW1PcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25WaWV3SXRlbXMuanMnO1xuaW1wb3J0IHsgZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXJEZWxlZ2F0ZUZhY3RvcnkuanMnO1xuaW1wb3J0IHsgSUhvdmVyRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXJEZWxlZ2F0ZS5qcyc7XG5pbXBvcnQgeyByZW5kZXJJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2ljb25MYWJlbC9pY29uTGFiZWxzLmpzJztcbmltcG9ydCB7IElBY3Rpb24sIFN1Ym1lbnVBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVBY3Rpb25WaWV3SXRlbSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci9tZW51RW50cnlBY3Rpb25WaWV3SXRlbS5qcyc7XG5pbXBvcnQgeyBIaWRkZW5JdGVtU3RyYXRlZ3ksIE1lbnVXb3JrYmVuY2hUb29sQmFyLCBXb3JrYmVuY2hUb29sQmFyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL3Rvb2xiYXIuanMnO1xuaW1wb3J0IHsgTWVudUlkLCBNZW51UmVnaXN0cnksIFN1Ym1lbnVJdGVtQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgSVF1aWNrSW5wdXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBXaW5kb3dUaXRsZSB9IGZyb20gJy4vd2luZG93VGl0bGUuanMnO1xuaW1wb3J0IHsgSUVkaXRvckdyb3Vwc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvckdyb3Vwc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuXG5leHBvcnQgY2xhc3MgQ29tbWFuZENlbnRlckNvbnRyb2wge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2Rpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlVmlzaWJpbGl0eSA9IHRoaXMuX2Rpc3Bvc2FibGVzLmFkZChuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VWaXNpYmlsaXR5OiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkQ2hhbmdlVmlzaWJpbGl0eS5ldmVudDtcblxuXHRyZWFkb25seSBlbGVtZW50OiBIVE1MRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHdpbmRvd1RpdGxlOiBXaW5kb3dUaXRsZSxcblx0XHRob3ZlckRlbGVnYXRlOiBJSG92ZXJEZWxlZ2F0ZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElRdWlja0lucHV0U2VydmljZSBxdWlja0lucHV0U2VydmljZTogSVF1aWNrSW5wdXRTZXJ2aWNlLFxuXHQpIHtcblx0XHR0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnY29tbWFuZC1jZW50ZXInKTtcblxuXHRcdGNvbnN0IHRpdGxlVG9vbGJhciA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1lbnVXb3JrYmVuY2hUb29sQmFyLCB0aGlzLmVsZW1lbnQsIE1lbnVJZC5Db21tYW5kQ2VudGVyLCB7XG5cdFx0XHRjb250ZXh0TWVudTogTWVudUlkLlRpdGxlQmFyQ29udGV4dCxcblx0XHRcdGhpZGRlbkl0ZW1TdHJhdGVneTogSGlkZGVuSXRlbVN0cmF0ZWd5Lk5vSGlkZSxcblx0XHRcdHRvb2xiYXJPcHRpb25zOiB7XG5cdFx0XHRcdHByaW1hcnlHcm91cDogKCkgPT4gdHJ1ZSxcblx0XHRcdH0sXG5cdFx0XHR0ZWxlbWV0cnlTb3VyY2U6ICdjb21tYW5kQ2VudGVyJyxcblx0XHRcdGFjdGlvblZpZXdJdGVtUHJvdmlkZXI6IChhY3Rpb24sIG9wdGlvbnMpID0+IHtcblx0XHRcdFx0aWYgKGFjdGlvbiBpbnN0YW5jZW9mIFN1Ym1lbnVJdGVtQWN0aW9uICYmIGFjdGlvbi5pdGVtLnN1Ym1lbnUgPT09IE1lbnVJZC5Db21tYW5kQ2VudGVyQ2VudGVyKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbW1hbmRDZW50ZXJDZW50ZXJWaWV3SXRlbSwgYWN0aW9uLCB3aW5kb3dUaXRsZSwgeyAuLi5vcHRpb25zLCBob3ZlckRlbGVnYXRlIH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiBjcmVhdGVBY3Rpb25WaWV3SXRlbShpbnN0YW50aWF0aW9uU2VydmljZSwgYWN0aW9uLCB7IC4uLm9wdGlvbnMsIGhvdmVyRGVsZWdhdGUgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZChFdmVudC5maWx0ZXIocXVpY2tJbnB1dFNlcnZpY2Uub25TaG93LCAoKSA9PiBpc0FjdGl2ZURvY3VtZW50KHRoaXMuZWxlbWVudCksIHRoaXMuX2Rpc3Bvc2FibGVzKSh0aGlzLl9zZXRWaXNpYmlsaXR5LmJpbmQodGhpcywgZmFsc2UpKSk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHF1aWNrSW5wdXRTZXJ2aWNlLm9uSGlkZSh0aGlzLl9zZXRWaXNpYmlsaXR5LmJpbmQodGhpcywgdHJ1ZSkpKTtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQodGl0bGVUb29sYmFyKTtcblx0fVxuXG5cdHByaXZhdGUgX3NldFZpc2liaWxpdHkoc2hvdzogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuZWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCdoaWRlJywgIXNob3cpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlVmlzaWJpbGl0eS5maXJlKCk7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5cbmNsYXNzIENvbW1hbmRDZW50ZXJDZW50ZXJWaWV3SXRlbSBleHRlbmRzIEJhc2VBY3Rpb25WaWV3SXRlbSB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgX3F1aWNrT3BlbkNvbW1hbmRJZCA9ICd3b3JrYmVuY2guYWN0aW9uLnF1aWNrT3BlbldpdGhNb2Rlcyc7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfaG92ZXJEZWxlZ2F0ZTogSUhvdmVyRGVsZWdhdGU7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfc3VibWVudTogU3VibWVudUl0ZW1BY3Rpb24sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfd2luZG93VGl0bGU6IFdpbmRvd1RpdGxlLFxuXHRcdG9wdGlvbnM6IElCYXNlQWN0aW9uVmlld0l0ZW1PcHRpb25zLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2hvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIHByaXZhdGUgX2tleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIF9pbnN0YVNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUVkaXRvckdyb3Vwc1NlcnZpY2UgcHJpdmF0ZSBfZWRpdG9yR3JvdXBTZXJ2aWNlOiBJRWRpdG9yR3JvdXBzU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIodW5kZWZpbmVkLCBfc3VibWVudS5hY3Rpb25zLmZpbmQoYWN0aW9uID0+IGFjdGlvbi5pZCA9PT0gJ3dvcmtiZW5jaC5hY3Rpb24ucXVpY2tPcGVuV2l0aE1vZGVzJykgPz8gX3N1Ym1lbnUuYWN0aW9uc1swXSwgb3B0aW9ucyk7XG5cdFx0dGhpcy5faG92ZXJEZWxlZ2F0ZSA9IG9wdGlvbnMuaG92ZXJEZWxlZ2F0ZSA/PyBnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSgnbW91c2UnKTtcblx0fVxuXG5cdG92ZXJyaWRlIHJlbmRlcihjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0c3VwZXIucmVuZGVyKGNvbnRhaW5lcik7XG5cdFx0Y29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2NvbW1hbmQtY2VudGVyLWNlbnRlcicpO1xuXHRcdGNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdtdWx0aXBsZScsICh0aGlzLl9zdWJtZW51LmFjdGlvbnMubGVuZ3RoID4gMSkpO1xuXG5cdFx0Y29uc3QgaG92ZXIgPSB0aGlzLl9zdG9yZS5hZGQodGhpcy5faG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKHRoaXMuX2hvdmVyRGVsZWdhdGUsIGNvbnRhaW5lciwgdGhpcy5nZXRUb29sdGlwKCkpKTtcblxuXHRcdC8vIHVwZGF0ZSBsYWJlbCAmIHRvb2x0aXAgd2hlbiB3aW5kb3cgdGl0bGUgY2hhbmdlc1xuXHRcdHRoaXMuX3N0b3JlLmFkZCh0aGlzLl93aW5kb3dUaXRsZS5vbkRpZENoYW5nZSgoKSA9PiB7XG5cdFx0XHRob3Zlci51cGRhdGUodGhpcy5nZXRUb29sdGlwKCkpO1xuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGdyb3VwczogKHJlYWRvbmx5IElBY3Rpb25bXSlbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgYWN0aW9uIG9mIHRoaXMuX3N1Ym1lbnUuYWN0aW9ucykge1xuXHRcdFx0aWYgKGFjdGlvbiBpbnN0YW5jZW9mIFN1Ym1lbnVBY3Rpb24pIHtcblx0XHRcdFx0Z3JvdXBzLnB1c2goYWN0aW9uLmFjdGlvbnMpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Z3JvdXBzLnB1c2goW2FjdGlvbl0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBncm91cHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGNvbnN0IGdyb3VwID0gZ3JvdXBzW2ldO1xuXG5cdFx0XHQvLyBuZXN0ZWQgdG9vbGJhclxuXHRcdFx0Y29uc3QgdG9vbGJhciA9IHRoaXMuX2luc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShXb3JrYmVuY2hUb29sQmFyLCBjb250YWluZXIsIHtcblx0XHRcdFx0aGlkZGVuSXRlbVN0cmF0ZWd5OiBIaWRkZW5JdGVtU3RyYXRlZ3kuTm9IaWRlLFxuXHRcdFx0XHR0ZWxlbWV0cnlTb3VyY2U6ICdjb21tYW5kQ2VudGVyQ2VudGVyJyxcblx0XHRcdFx0YWN0aW9uVmlld0l0ZW1Qcm92aWRlcjogKGFjdGlvbiwgb3B0aW9ucykgPT4ge1xuXHRcdFx0XHRcdG9wdGlvbnMgPSB7XG5cdFx0XHRcdFx0XHQuLi5vcHRpb25zLFxuXHRcdFx0XHRcdFx0aG92ZXJEZWxlZ2F0ZTogdGhpcy5faG92ZXJEZWxlZ2F0ZSxcblx0XHRcdFx0XHR9O1xuXG5cdFx0XHRcdFx0aWYgKGFjdGlvbi5pZCAhPT0gQ29tbWFuZENlbnRlckNlbnRlclZpZXdJdGVtLl9xdWlja09wZW5Db21tYW5kSWQpIHtcblx0XHRcdFx0XHRcdHJldHVybiBjcmVhdGVBY3Rpb25WaWV3SXRlbSh0aGlzLl9pbnN0YVNlcnZpY2UsIGFjdGlvbiwgb3B0aW9ucyk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3QgdGhhdCA9IHRoaXM7XG5cblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5faW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKGNsYXNzIENvbW1hbmRDZW50ZXJRdWlja1BpY2tJdGVtIGV4dGVuZHMgQmFzZUFjdGlvblZpZXdJdGVtIHtcblxuXHRcdFx0XHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdFx0XHRcdHN1cGVyKHVuZGVmaW5lZCwgYWN0aW9uLCBvcHRpb25zKTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0b3ZlcnJpZGUgcmVuZGVyKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRcdFx0XHRcdFx0c3VwZXIucmVuZGVyKGNvbnRhaW5lcik7XG5cdFx0XHRcdFx0XHRcdGNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdjb21tYW5kLWNlbnRlci1xdWljay1waWNrJyk7XG5cdFx0XHRcdFx0XHRcdGNvbnRhaW5lci5yb2xlID0gJ2J1dHRvbic7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGFjdGlvbiA9IHRoaXMuYWN0aW9uO1xuXG5cdFx0XHRcdFx0XHRcdC8vIGljb24gKHNlYXJjaClcblx0XHRcdFx0XHRcdFx0Y29uc3Qgc2VhcmNoSWNvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcblx0XHRcdFx0XHRcdFx0c2VhcmNoSWNvbi5hcmlhSGlkZGVuID0gJ3RydWUnO1xuXHRcdFx0XHRcdFx0XHRzZWFyY2hJY29uLmNsYXNzTmFtZSA9IGFjdGlvbi5jbGFzcyA/PyAnJztcblx0XHRcdFx0XHRcdFx0c2VhcmNoSWNvbi5jbGFzc0xpc3QuYWRkKCdzZWFyY2gtaWNvbicpO1xuXG5cdFx0XHRcdFx0XHRcdC8vIGxhYmVsOiBqdXN0IHdvcmtzcGFjZSBuYW1lIGFuZCBvcHRpb25hbCBkZWNvcmF0aW9uc1xuXHRcdFx0XHRcdFx0XHRjb25zdCBsYWJlbCA9IHRoaXMuX2dldExhYmVsKCk7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGxhYmVsRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcblx0XHRcdFx0XHRcdFx0bGFiZWxFbGVtZW50LmNsYXNzTGlzdC5hZGQoJ3NlYXJjaC1sYWJlbCcpO1xuXHRcdFx0XHRcdFx0XHRsYWJlbEVsZW1lbnQuaW5uZXJUZXh0ID0gbGFiZWw7XG5cdFx0XHRcdFx0XHRcdHJlc2V0KGNvbnRhaW5lciwgc2VhcmNoSWNvbiwgbGFiZWxFbGVtZW50KTtcblxuXHRcdFx0XHRcdFx0XHRjb25zdCBob3ZlciA9IHRoaXMuX3N0b3JlLmFkZCh0aGF0Ll9ob3ZlclNlcnZpY2Uuc2V0dXBNYW5hZ2VkSG92ZXIodGhhdC5faG92ZXJEZWxlZ2F0ZSwgY29udGFpbmVyLCB0aGlzLmdldFRvb2x0aXAoKSkpO1xuXG5cdFx0XHRcdFx0XHRcdC8vIHVwZGF0ZSBsYWJlbCAmIHRvb2x0aXAgd2hlbiB3aW5kb3cgdGl0bGUgY2hhbmdlc1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9zdG9yZS5hZGQodGhhdC5fd2luZG93VGl0bGUub25EaWRDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdGhvdmVyLnVwZGF0ZSh0aGlzLmdldFRvb2x0aXAoKSk7XG5cdFx0XHRcdFx0XHRcdFx0bGFiZWxFbGVtZW50LmlubmVyVGV4dCA9IHRoaXMuX2dldExhYmVsKCk7XG5cdFx0XHRcdFx0XHRcdH0pKTtcblxuXHRcdFx0XHRcdFx0XHQvLyB1cGRhdGUgbGFiZWwgJiB0b29sdGlwIHdoZW4gdGFicyB2aXNpYmlsaXR5IGNoYW5nZXNcblx0XHRcdFx0XHRcdFx0dGhpcy5fc3RvcmUuYWRkKHRoYXQuX2VkaXRvckdyb3VwU2VydmljZS5vbkRpZENoYW5nZUVkaXRvclBhcnRPcHRpb25zKCh7IG5ld1BhcnRPcHRpb25zLCBvbGRQYXJ0T3B0aW9ucyB9KSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKG5ld1BhcnRPcHRpb25zLnNob3dUYWJzICE9PSBvbGRQYXJ0T3B0aW9ucy5zaG93VGFicykge1xuXHRcdFx0XHRcdFx0XHRcdFx0aG92ZXIudXBkYXRlKHRoaXMuZ2V0VG9vbHRpcCgpKTtcblx0XHRcdFx0XHRcdFx0XHRcdGxhYmVsRWxlbWVudC5pbm5lclRleHQgPSB0aGlzLl9nZXRMYWJlbCgpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRwcm90ZWN0ZWQgb3ZlcnJpZGUgZ2V0VG9vbHRpcCgpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRoYXQuZ2V0VG9vbHRpcCgpO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRwcml2YXRlIF9nZXRMYWJlbCgpOiBzdHJpbmcge1xuXHRcdFx0XHRcdFx0XHRjb25zdCB7IHByZWZpeCwgc3VmZml4IH0gPSB0aGF0Ll93aW5kb3dUaXRsZS5nZXRUaXRsZURlY29yYXRpb25zKCk7XG5cdFx0XHRcdFx0XHRcdGxldCBsYWJlbCA9IHRoYXQuX3dpbmRvd1RpdGxlLndvcmtzcGFjZU5hbWU7XG5cdFx0XHRcdFx0XHRcdGlmICh0aGF0Ll93aW5kb3dUaXRsZS5pc0N1c3RvbVRpdGxlRm9ybWF0KCkpIHtcblx0XHRcdFx0XHRcdFx0XHRsYWJlbCA9IHRoYXQuX3dpbmRvd1RpdGxlLmdldFdpbmRvd1RpdGxlKCk7XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSBpZiAodGhhdC5fZWRpdG9yR3JvdXBTZXJ2aWNlLnBhcnRPcHRpb25zLnNob3dUYWJzID09PSAnbm9uZScpIHtcblx0XHRcdFx0XHRcdFx0XHRsYWJlbCA9IHRoYXQuX3dpbmRvd1RpdGxlLmZpbGVOYW1lID8/IGxhYmVsO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGlmICghbGFiZWwpIHtcblx0XHRcdFx0XHRcdFx0XHRsYWJlbCA9IGxvY2FsaXplKCdsYWJlbC5kZmwnLCBcIlNlYXJjaFwiKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRpZiAocHJlZml4KSB7XG5cdFx0XHRcdFx0XHRcdFx0bGFiZWwgPSBsb2NhbGl6ZSgnbGFiZWwxJywgXCJ7MH0gezF9XCIsIHByZWZpeCwgbGFiZWwpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGlmIChzdWZmaXgpIHtcblx0XHRcdFx0XHRcdFx0XHRsYWJlbCA9IGxvY2FsaXplKCdsYWJlbDInLCBcInswfSB7MX1cIiwgbGFiZWwsIHN1ZmZpeCk7XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gbGFiZWwucmVwbGFjZUFsbCgvXFxyXFxufFxccnxcXG4vZywgJ1xcdTIzQ0UnKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHR0b29sYmFyLnNldEFjdGlvbnMoZ3JvdXApO1xuXHRcdFx0dGhpcy5fc3RvcmUuYWRkKHRvb2xiYXIpO1xuXG5cblx0XHRcdC8vIHNwYWNlclxuXHRcdFx0aWYgKGkgPCBncm91cHMubGVuZ3RoIC0gMSkge1xuXHRcdFx0XHRjb25zdCBpY29uID0gcmVuZGVySWNvbihDb2RpY29uLmNpcmNsZVNtYWxsRmlsbGVkKTtcblx0XHRcdFx0aWNvbi5zdHlsZS5wYWRkaW5nID0gJzAgMTJweCc7XG5cdFx0XHRcdGljb24uc3R5bGUuaGVpZ2h0ID0gJzEwMCUnO1xuXHRcdFx0XHRpY29uLnN0eWxlLm9wYWNpdHkgPSAnMC41Jztcblx0XHRcdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKGljb24pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBnZXRUb29sdGlwKCkge1xuXG5cdFx0Ly8gdG9vbHRpcDogZnVsbCB3aW5kb3dUaXRsZVxuXHRcdGNvbnN0IGtiID0gdGhpcy5fa2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyh0aGlzLmFjdGlvbi5pZCk/LmdldExhYmVsKCk7XG5cdFx0Y29uc3QgdGl0bGUgPSBrYlxuXHRcdFx0PyBsb2NhbGl6ZSgndGl0bGUnLCBcIlNlYXJjaCB7MH0gKHsxfSkgXFx1MjAxNCB7Mn1cIiwgdGhpcy5fd2luZG93VGl0bGUud29ya3NwYWNlTmFtZSwga2IsIHRoaXMuX3dpbmRvd1RpdGxlLnZhbHVlKVxuXHRcdFx0OiBsb2NhbGl6ZSgndGl0bGUyJywgXCJTZWFyY2ggezB9IFxcdTIwMTQgezF9XCIsIHRoaXMuX3dpbmRvd1RpdGxlLndvcmtzcGFjZU5hbWUsIHRoaXMuX3dpbmRvd1RpdGxlLnZhbHVlKTtcblxuXHRcdHJldHVybiB0aXRsZTtcblx0fVxufVxuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkNvbW1hbmRDZW50ZXIsIHtcblx0c3VibWVudTogTWVudUlkLkNvbW1hbmRDZW50ZXJDZW50ZXIsXG5cdHRpdGxlOiBsb2NhbGl6ZSgndGl0bGUzJywgXCJDb21tYW5kIENlbnRlclwiKSxcblx0aWNvbjogQ29kaWNvbi5zaGllbGQsXG5cdG9yZGVyOiAxMDEsXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxrQkFBa0IsYUFBYTtBQUN4QyxTQUFTLDBCQUFzRDtBQUMvRCxTQUFTLCtCQUErQjtBQUV4QyxTQUFTLGtCQUFrQjtBQUMzQixTQUFrQixxQkFBcUI7QUFDdkMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsU0FBUyxhQUFhO0FBQy9CLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsb0JBQW9CLHNCQUFzQix3QkFBd0I7QUFDM0UsU0FBUyxRQUFRLGNBQWMseUJBQXlCO0FBQ3hELFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsMEJBQTBCO0FBRW5DLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMscUJBQXFCO0FBRXZCLElBQU0sdUJBQU4sTUFBMkI7QUFBQSxFQVNqQyxZ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
