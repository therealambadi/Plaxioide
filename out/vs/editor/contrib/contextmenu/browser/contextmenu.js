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
import * as dom from "../../../../base/browser/dom.js";
import { ActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { Separator, SubmenuAction } from "../../../../base/common/actions.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { isIOS } from "../../../../base/common/platform.js";
import { MouseTargetType } from "../../../browser/editorBrowser.js";
import { EditorAction, EditorContributionInstantiation, registerEditorAction, registerEditorContribution } from "../../../browser/editorExtensions.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { ScrollType } from "../../../common/editorCommon.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import * as nls from "../../../../nls.js";
import { IMenuService, SubmenuItemAction } from "../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService, IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IWorkspaceContextService, isStandaloneEditorWorkspace } from "../../../../platform/workspace/common/workspace.js";
let ContextMenuController = class {
  constructor(editor, _contextMenuService, _contextViewService, _contextKeyService, _keybindingService, _menuService, _configurationService, _workspaceContextService) {
    this._contextMenuService = _contextMenuService;
    this._contextViewService = _contextViewService;
    this._contextKeyService = _contextKeyService;
    this._keybindingService = _keybindingService;
    this._menuService = _menuService;
    this._configurationService = _configurationService;
    this._workspaceContextService = _workspaceContextService;
    this._toDispose = new DisposableStore();
    this._contextMenuIsBeingShownCount = 0;
    this._editor = editor;
    this._toDispose.add(this._editor.onContextMenu((e) => this._onContextMenu(e)));
    this._toDispose.add(this._editor.onMouseWheel((e) => {
      if (this._contextMenuIsBeingShownCount > 0) {
        const view = this._contextViewService.getContextViewElement();
        const target = e.srcElement;
        if (!(target.shadowRoot && dom.getShadowRoot(view) === target.shadowRoot)) {
          this._contextViewService.hideContextView();
        }
      }
    }));
    this._toDispose.add(this._editor.onKeyDown((e) => {
      if (!this._editor.getOption(EditorOption.contextmenu)) {
        return;
      }
      if (e.keyCode === KeyCode.ContextMenu) {
        e.preventDefault();
        e.stopPropagation();
        this.showContextMenu();
      }
    }));
  }
  static get(editor) {
    return editor.getContribution(ContextMenuController.ID);
  }
  _onContextMenu(e) {
    if (!this._editor.hasModel()) {
      return;
    }
    if (!this._editor.getOption(EditorOption.contextmenu)) {
      this._editor.focus();
      if (e.target.position && !this._editor.getSelection().containsPosition(e.target.position)) {
        this._editor.setPosition(e.target.position);
      }
      return;
    }
    if (e.target.type === MouseTargetType.OVERLAY_WIDGET) {
      return;
    }
    if (e.target.type === MouseTargetType.CONTENT_TEXT && e.target.detail.injectedText) {
      return;
    }
    e.event.preventDefault();
    e.event.stopPropagation();
    if (e.target.type === MouseTargetType.SCROLLBAR) {
      return this._showScrollbarContextMenu(e.event);
    }
    if (e.target.type !== MouseTargetType.CONTENT_TEXT && e.target.type !== MouseTargetType.CONTENT_EMPTY && e.target.type !== MouseTargetType.TEXTAREA) {
      return;
    }
    this._editor.focus();
    if (e.target.position) {
      let hasSelectionAtPosition = false;
      for (const selection of this._editor.getSelections()) {
        if (selection.containsPosition(e.target.position)) {
          hasSelectionAtPosition = true;
          break;
        }
      }
      if (!hasSelectionAtPosition) {
        this._editor.setPosition(e.target.position);
      }
    }
    let anchor = null;
    if (e.target.type !== MouseTargetType.TEXTAREA) {
      anchor = e.event;
    }
    this.showContextMenu(anchor);
  }
  showContextMenu(anchor) {
    if (!this._editor.getOption(EditorOption.contextmenu)) {
      return;
    }
    if (!this._editor.hasModel()) {
      return;
    }
    const menuActions = this._getMenuActions(
      this._editor.getModel(),
      this._editor.contextMenuId
    );
    if (menuActions.length > 0) {
      this._doShowContextMenu(menuActions, anchor);
    }
  }
  _getMenuActions(model, menuId) {
    const result = [];
    const groups = this._menuService.getMenuActions(menuId, this._contextKeyService, { arg: model.uri });
    for (const group of groups) {
      const [, actions] = group;
      let addedItems = 0;
      for (const action of actions) {
        if (action instanceof SubmenuItemAction) {
          const subActions = this._getMenuActions(model, action.item.submenu);
          if (subActions.length > 0) {
            result.push(new SubmenuAction(action.id, action.label, subActions));
            addedItems++;
          }
        } else {
          result.push(action);
          addedItems++;
        }
      }
      if (addedItems) {
        result.push(new Separator());
      }
    }
    if (result.length) {
      result.pop();
    }
    return result;
  }
  _doShowContextMenu(actions, event = null) {
    if (!this._editor.hasModel()) {
      return;
    }
    const oldHoverSetting = this._editor.getOption(EditorOption.hover);
    this._editor.updateOptions({
      hover: {
        enabled: false
      }
    });
    let anchor = event;
    if (!anchor) {
      this._editor.revealPosition(this._editor.getPosition(), ScrollType.Immediate);
      this._editor.render();
      const cursorCoords = this._editor.getScrolledVisiblePosition(this._editor.getPosition());
      const editorCoords = dom.getDomNodePagePosition(this._editor.getDomNode());
      const posx = editorCoords.left + cursorCoords.left;
      const posy = editorCoords.top + cursorCoords.top + cursorCoords.height;
      anchor = { x: posx, y: posy };
    }
    const useShadowDOM = this._editor.getOption(EditorOption.useShadowDOM) && !isIOS;
    this._contextMenuIsBeingShownCount++;
    this._contextMenuService.showContextMenu({
      domForShadowRoot: useShadowDOM ? this._editor.getOverflowWidgetsDomNode() ?? this._editor.getDomNode() : void 0,
      getAnchor: () => anchor,
      getActions: () => actions,
      getActionViewItem: (action) => {
        const keybinding = this._keybindingFor(action);
        if (keybinding) {
          return new ActionViewItem(action, action, { label: true, keybinding: keybinding.getLabel(), isMenu: true });
        }
        const customActionViewItem = action;
        if (typeof customActionViewItem.getActionViewItem === "function") {
          return customActionViewItem.getActionViewItem();
        }
        return new ActionViewItem(action, action, { icon: true, label: true, isMenu: true });
      },
      getKeyBinding: (action) => {
        return this._keybindingFor(action);
      },
      onHide: (wasCancelled) => {
        this._contextMenuIsBeingShownCount--;
        this._editor.updateOptions({
          hover: oldHoverSetting
        });
      }
    });
  }
  _showScrollbarContextMenu(anchor) {
    if (!this._editor.hasModel()) {
      return;
    }
    if (isStandaloneEditorWorkspace(this._workspaceContextService.getWorkspace())) {
      return;
    }
    const minimapOptions = this._editor.getOption(EditorOption.minimap);
    let lastId = 0;
    const createAction = (opts) => {
      return {
        id: `menu-action-${++lastId}`,
        label: opts.label,
        tooltip: "",
        class: void 0,
        enabled: typeof opts.enabled === "undefined" ? true : opts.enabled,
        checked: opts.checked,
        run: opts.run
      };
    };
    const createSubmenuAction = (label, actions2) => {
      return new SubmenuAction(
        `menu-action-${++lastId}`,
        label,
        actions2,
        void 0
      );
    };
    const createEnumAction = (label, enabled, configName, configuredValue, options) => {
      if (!enabled) {
        return createAction({ label, enabled, run: () => {
        } });
      }
      const createRunner = (value) => {
        return () => {
          this._configurationService.updateValue(configName, value);
        };
      };
      const actions2 = [];
      for (const option of options) {
        actions2.push(createAction({
          label: option.label,
          checked: configuredValue === option.value,
          run: createRunner(option.value)
        }));
      }
      return createSubmenuAction(
        label,
        actions2
      );
    };
    const actions = [];
    actions.push(createAction({
      label: nls.localize("context.minimap.minimap", "Minimap"),
      checked: minimapOptions.enabled,
      run: () => {
        this._configurationService.updateValue(`editor.minimap.enabled`, !minimapOptions.enabled);
      }
    }));
    actions.push(new Separator());
    actions.push(createAction({
      label: nls.localize("context.minimap.renderCharacters", "Render Characters"),
      enabled: minimapOptions.enabled,
      checked: minimapOptions.renderCharacters,
      run: () => {
        this._configurationService.updateValue(`editor.minimap.renderCharacters`, !minimapOptions.renderCharacters);
      }
    }));
    actions.push(createEnumAction(
      nls.localize("context.minimap.size", "Vertical size"),
      minimapOptions.enabled,
      "editor.minimap.size",
      minimapOptions.size,
      [{
        label: nls.localize("context.minimap.size.proportional", "Proportional"),
        value: "proportional"
      }, {
        label: nls.localize("context.minimap.size.fill", "Fill"),
        value: "fill"
      }, {
        label: nls.localize("context.minimap.size.fit", "Fit"),
        value: "fit"
      }]
    ));
    actions.push(createEnumAction(
      nls.localize("context.minimap.slider", "Slider"),
      minimapOptions.enabled,
      "editor.minimap.showSlider",
      minimapOptions.showSlider,
      [{
        label: nls.localize("context.minimap.slider.mouseover", "Mouse Over"),
        value: "mouseover"
      }, {
        label: nls.localize("context.minimap.slider.always", "Always"),
        value: "always"
      }]
    ));
    const useShadowDOM = this._editor.getOption(EditorOption.useShadowDOM) && !isIOS;
    this._contextMenuIsBeingShownCount++;
    this._contextMenuService.showContextMenu({
      domForShadowRoot: useShadowDOM ? this._editor.getDomNode() : void 0,
      getAnchor: () => anchor,
      getActions: () => actions,
      onHide: (wasCancelled) => {
        this._contextMenuIsBeingShownCount--;
        this._editor.focus();
      }
    });
  }
  _keybindingFor(action) {
    return this._keybindingService.lookupKeybinding(action.id);
  }
  dispose() {
    if (this._contextMenuIsBeingShownCount > 0) {
      this._contextViewService.hideContextView();
    }
    this._toDispose.dispose();
  }
};
ContextMenuController.ID = "editor.contrib.contextmenu";
ContextMenuController = __decorateClass([
  __decorateParam(1, IContextMenuService),
  __decorateParam(2, IContextViewService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IMenuService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IWorkspaceContextService)
], ContextMenuController);
class ShowContextMenu extends EditorAction {
  constructor() {
    super({
      id: "editor.action.showContextMenu",
      label: nls.localize2("action.showContextMenu.label", "Show Editor Context Menu"),
      precondition: void 0,
      kbOpts: {
        kbExpr: EditorContextKeys.textInputFocus,
        primary: KeyMod.Shift | KeyCode.F10,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  run(accessor, editor) {
    ContextMenuController.get(editor)?.showContextMenu();
  }
}
registerEditorContribution(ContextMenuController.ID, ContextMenuController, EditorContributionInstantiation.BeforeFirstInteraction);
registerEditorAction(ShowContextMenu);
export {
  ContextMenuController
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9jb250ZXh0bWVudS9icm93c2VyL2NvbnRleHRtZW51LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgSUtleWJvYXJkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIva2V5Ym9hcmRFdmVudC5qcyc7XG5pbXBvcnQgeyBJTW91c2VFdmVudCwgSU1vdXNlV2hlZWxFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9tb3VzZUV2ZW50LmpzJztcbmltcG9ydCB7IEFjdGlvblZpZXdJdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25WaWV3SXRlbXMuanMnO1xuaW1wb3J0IHsgSUFuY2hvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9jb250ZXh0dmlldy9jb250ZXh0dmlldy5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uLCBTZXBhcmF0b3IsIFN1Ym1lbnVBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IFJlc29sdmVkS2V5YmluZGluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleWJpbmRpbmdzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBpc0lPUyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yLCBJRWRpdG9yTW91c2VFdmVudCwgTW91c2VUYXJnZXRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IEVkaXRvckFjdGlvbiwgRWRpdG9yQ29udHJpYnV0aW9uSW5zdGFudGlhdGlvbiwgcmVnaXN0ZXJFZGl0b3JBY3Rpb24sIHJlZ2lzdGVyRWRpdG9yQ29udHJpYnV0aW9uLCBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IEVkaXRvck9wdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yQ29udHJpYnV0aW9uLCBTY3JvbGxUeXBlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBFZGl0b3JDb250ZXh0S2V5cyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3JDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSU1lbnVTZXJ2aWNlLCBNZW51SWQsIFN1Ym1lbnVJdGVtQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UsIElDb250ZXh0Vmlld1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIGlzU3RhbmRhbG9uZUVkaXRvcldvcmtzcGFjZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcblxuZXhwb3J0IGNsYXNzIENvbnRleHRNZW51Q29udHJvbGxlciBpbXBsZW1lbnRzIElFZGl0b3JDb250cmlidXRpb24ge1xuXG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgSUQgPSAnZWRpdG9yLmNvbnRyaWIuY29udGV4dG1lbnUnO1xuXG5cdHB1YmxpYyBzdGF0aWMgZ2V0KGVkaXRvcjogSUNvZGVFZGl0b3IpOiBDb250ZXh0TWVudUNvbnRyb2xsZXIgfCBudWxsIHtcblx0XHRyZXR1cm4gZWRpdG9yLmdldENvbnRyaWJ1dGlvbjxDb250ZXh0TWVudUNvbnRyb2xsZXI+KENvbnRleHRNZW51Q29udHJvbGxlci5JRCk7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF90b0Rpc3Bvc2UgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdHByaXZhdGUgX2NvbnRleHRNZW51SXNCZWluZ1Nob3duQ291bnQ6IG51bWJlciA9IDA7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcjogSUNvZGVFZGl0b3I7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0ZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElDb250ZXh0Vmlld1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29udGV4dFZpZXdTZXJ2aWNlOiBJQ29udGV4dFZpZXdTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2tleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9tZW51U2VydmljZTogSU1lbnVTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3dvcmtzcGFjZUNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdCkge1xuXHRcdHRoaXMuX2VkaXRvciA9IGVkaXRvcjtcblxuXHRcdHRoaXMuX3RvRGlzcG9zZS5hZGQodGhpcy5fZWRpdG9yLm9uQ29udGV4dE1lbnUoKGU6IElFZGl0b3JNb3VzZUV2ZW50KSA9PiB0aGlzLl9vbkNvbnRleHRNZW51KGUpKSk7XG5cdFx0dGhpcy5fdG9EaXNwb3NlLmFkZCh0aGlzLl9lZGl0b3Iub25Nb3VzZVdoZWVsKChlOiBJTW91c2VXaGVlbEV2ZW50KSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fY29udGV4dE1lbnVJc0JlaW5nU2hvd25Db3VudCA+IDApIHtcblx0XHRcdFx0Y29uc3QgdmlldyA9IHRoaXMuX2NvbnRleHRWaWV3U2VydmljZS5nZXRDb250ZXh0Vmlld0VsZW1lbnQoKTtcblx0XHRcdFx0Y29uc3QgdGFyZ2V0ID0gZS5zcmNFbGVtZW50IGFzIEhUTUxFbGVtZW50O1xuXG5cdFx0XHRcdC8vIEV2ZW50IHRyaWdnZXJzIG9uIHNoYWRvdyByb290IGhvc3QgZmlyc3Rcblx0XHRcdFx0Ly8gQ2hlY2sgaWYgdGhlIGNvbnRleHQgdmlldyBpcyB1bmRlciB0aGlzIGhvc3QgYmVmb3JlIGhpZGluZyBpdCAjMTAzMTY5XG5cdFx0XHRcdGlmICghKHRhcmdldC5zaGFkb3dSb290ICYmIGRvbS5nZXRTaGFkb3dSb290KHZpZXcpID09PSB0YXJnZXQuc2hhZG93Um9vdCkpIHtcblx0XHRcdFx0XHR0aGlzLl9jb250ZXh0Vmlld1NlcnZpY2UuaGlkZUNvbnRleHRWaWV3KCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fdG9EaXNwb3NlLmFkZCh0aGlzLl9lZGl0b3Iub25LZXlEb3duKChlOiBJS2V5Ym9hcmRFdmVudCkgPT4ge1xuXHRcdFx0aWYgKCF0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5jb250ZXh0bWVudSkpIHtcblx0XHRcdFx0cmV0dXJuOyAvLyBDb250ZXh0IG1lbnUgaXMgdHVybmVkIG9mZiB0aHJvdWdoIGNvbmZpZ3VyYXRpb25cblx0XHRcdH1cblx0XHRcdGlmIChlLmtleUNvZGUgPT09IEtleUNvZGUuQ29udGV4dE1lbnUpIHtcblx0XHRcdFx0Ly8gQ2hyb21lIGlzIGZ1bm55IGxpa2UgdGhhdFxuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdHRoaXMuc2hvd0NvbnRleHRNZW51KCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfb25Db250ZXh0TWVudShlOiBJRWRpdG9yTW91c2VFdmVudCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmNvbnRleHRtZW51KSkge1xuXHRcdFx0dGhpcy5fZWRpdG9yLmZvY3VzKCk7XG5cdFx0XHQvLyBFbnN1cmUgdGhlIGN1cnNvciBpcyBhdCB0aGUgcG9zaXRpb24gb2YgdGhlIG1vdXNlIGNsaWNrXG5cdFx0XHRpZiAoZS50YXJnZXQucG9zaXRpb24gJiYgIXRoaXMuX2VkaXRvci5nZXRTZWxlY3Rpb24oKS5jb250YWluc1Bvc2l0aW9uKGUudGFyZ2V0LnBvc2l0aW9uKSkge1xuXHRcdFx0XHR0aGlzLl9lZGl0b3Iuc2V0UG9zaXRpb24oZS50YXJnZXQucG9zaXRpb24pO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuOyAvLyBDb250ZXh0IG1lbnUgaXMgdHVybmVkIG9mZiB0aHJvdWdoIGNvbmZpZ3VyYXRpb25cblx0XHR9XG5cblx0XHRpZiAoZS50YXJnZXQudHlwZSA9PT0gTW91c2VUYXJnZXRUeXBlLk9WRVJMQVlfV0lER0VUKSB7XG5cdFx0XHRyZXR1cm47IC8vIGFsbG93IG5hdGl2ZSBtZW51IG9uIHdpZGdldHMgdG8gc3VwcG9ydCByaWdodCBjbGljayBvbiBpbnB1dCBmaWVsZCBmb3IgZXhhbXBsZSBpbiBmaW5kXG5cdFx0fVxuXHRcdGlmIChlLnRhcmdldC50eXBlID09PSBNb3VzZVRhcmdldFR5cGUuQ09OVEVOVF9URVhUICYmIGUudGFyZ2V0LmRldGFpbC5pbmplY3RlZFRleHQpIHtcblx0XHRcdHJldHVybjsgLy8gYWxsb3cgbmF0aXZlIG1lbnUgb24gaW5qZWN0ZWQgdGV4dFxuXHRcdH1cblxuXHRcdGUuZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRlLmV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXG5cdFx0aWYgKGUudGFyZ2V0LnR5cGUgPT09IE1vdXNlVGFyZ2V0VHlwZS5TQ1JPTExCQVIpIHtcblx0XHRcdHJldHVybiB0aGlzLl9zaG93U2Nyb2xsYmFyQ29udGV4dE1lbnUoZS5ldmVudCk7XG5cdFx0fVxuXG5cdFx0aWYgKGUudGFyZ2V0LnR5cGUgIT09IE1vdXNlVGFyZ2V0VHlwZS5DT05URU5UX1RFWFQgJiYgZS50YXJnZXQudHlwZSAhPT0gTW91c2VUYXJnZXRUeXBlLkNPTlRFTlRfRU1QVFkgJiYgZS50YXJnZXQudHlwZSAhPT0gTW91c2VUYXJnZXRUeXBlLlRFWFRBUkVBKSB7XG5cdFx0XHRyZXR1cm47IC8vIG9ubHkgc3VwcG9ydCBtb3VzZSBjbGljayBpbnRvIHRleHQgb3IgbmF0aXZlIGNvbnRleHQgbWVudSBrZXkgZm9yIG5vd1xuXHRcdH1cblxuXHRcdC8vIEVuc3VyZSB0aGUgZWRpdG9yIGdldHMgZm9jdXMgaWYgaXQgaGFzbid0LCBzbyB0aGUgcmlnaHQgZXZlbnRzIGFyZSBiZWluZyBzZW50IHRvIG90aGVyIGNvbnRyaWJ1dGlvbnNcblx0XHR0aGlzLl9lZGl0b3IuZm9jdXMoKTtcblxuXHRcdC8vIEVuc3VyZSB0aGUgY3Vyc29yIGlzIGF0IHRoZSBwb3NpdGlvbiBvZiB0aGUgbW91c2UgY2xpY2tcblx0XHRpZiAoZS50YXJnZXQucG9zaXRpb24pIHtcblx0XHRcdGxldCBoYXNTZWxlY3Rpb25BdFBvc2l0aW9uID0gZmFsc2U7XG5cdFx0XHRmb3IgKGNvbnN0IHNlbGVjdGlvbiBvZiB0aGlzLl9lZGl0b3IuZ2V0U2VsZWN0aW9ucygpKSB7XG5cdFx0XHRcdGlmIChzZWxlY3Rpb24uY29udGFpbnNQb3NpdGlvbihlLnRhcmdldC5wb3NpdGlvbikpIHtcblx0XHRcdFx0XHRoYXNTZWxlY3Rpb25BdFBvc2l0aW9uID0gdHJ1ZTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIWhhc1NlbGVjdGlvbkF0UG9zaXRpb24pIHtcblx0XHRcdFx0dGhpcy5fZWRpdG9yLnNldFBvc2l0aW9uKGUudGFyZ2V0LnBvc2l0aW9uKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBVbmxlc3MgdGhlIHVzZXIgdHJpZ2dlcmQgdGhlIGNvbnRleHQgbWVudSB0aHJvdWdoIFNoaWZ0K0YxMCwgdXNlIHRoZSBtb3VzZSBwb3NpdGlvbiBhcyBtZW51IHBvc2l0aW9uXG5cdFx0bGV0IGFuY2hvcjogSU1vdXNlRXZlbnQgfCBudWxsID0gbnVsbDtcblx0XHRpZiAoZS50YXJnZXQudHlwZSAhPT0gTW91c2VUYXJnZXRUeXBlLlRFWFRBUkVBKSB7XG5cdFx0XHRhbmNob3IgPSBlLmV2ZW50O1xuXHRcdH1cblxuXHRcdC8vIFNob3cgdGhlIGNvbnRleHQgbWVudVxuXHRcdHRoaXMuc2hvd0NvbnRleHRNZW51KGFuY2hvcik7XG5cdH1cblxuXHRwdWJsaWMgc2hvd0NvbnRleHRNZW51KGFuY2hvcj86IElNb3VzZUV2ZW50IHwgbnVsbCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uY29udGV4dG1lbnUpKSB7XG5cdFx0XHRyZXR1cm47IC8vIENvbnRleHQgbWVudSBpcyB0dXJuZWQgb2ZmIHRocm91Z2ggY29uZmlndXJhdGlvblxuXHRcdH1cblx0XHRpZiAoIXRoaXMuX2VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gRmluZCBhY3Rpb25zIGF2YWlsYWJsZSBmb3IgbWVudVxuXHRcdGNvbnN0IG1lbnVBY3Rpb25zID0gdGhpcy5fZ2V0TWVudUFjdGlvbnModGhpcy5fZWRpdG9yLmdldE1vZGVsKCksXG5cdFx0XHR0aGlzLl9lZGl0b3IuY29udGV4dE1lbnVJZCk7XG5cblx0XHQvLyBTaG93IG1lbnUgaWYgd2UgaGF2ZSBhY3Rpb25zIHRvIHNob3dcblx0XHRpZiAobWVudUFjdGlvbnMubGVuZ3RoID4gMCkge1xuXHRcdFx0dGhpcy5fZG9TaG93Q29udGV4dE1lbnUobWVudUFjdGlvbnMsIGFuY2hvcik7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0TWVudUFjdGlvbnMobW9kZWw6IElUZXh0TW9kZWwsIG1lbnVJZDogTWVudUlkKTogSUFjdGlvbltdIHtcblx0XHRjb25zdCByZXN1bHQ6IElBY3Rpb25bXSA9IFtdO1xuXG5cdFx0Ly8gZ2V0IG1lbnUgZ3JvdXBzXG5cdFx0Y29uc3QgZ3JvdXBzID0gdGhpcy5fbWVudVNlcnZpY2UuZ2V0TWVudUFjdGlvbnMobWVudUlkLCB0aGlzLl9jb250ZXh0S2V5U2VydmljZSwgeyBhcmc6IG1vZGVsLnVyaSB9KTtcblxuXHRcdC8vIHRyYW5zbGF0ZSB0aGVtIGludG8gb3RoZXIgYWN0aW9uc1xuXHRcdGZvciAoY29uc3QgZ3JvdXAgb2YgZ3JvdXBzKSB7XG5cdFx0XHRjb25zdCBbLCBhY3Rpb25zXSA9IGdyb3VwO1xuXHRcdFx0bGV0IGFkZGVkSXRlbXMgPSAwO1xuXHRcdFx0Zm9yIChjb25zdCBhY3Rpb24gb2YgYWN0aW9ucykge1xuXHRcdFx0XHRpZiAoYWN0aW9uIGluc3RhbmNlb2YgU3VibWVudUl0ZW1BY3Rpb24pIHtcblx0XHRcdFx0XHRjb25zdCBzdWJBY3Rpb25zID0gdGhpcy5fZ2V0TWVudUFjdGlvbnMobW9kZWwsIGFjdGlvbi5pdGVtLnN1Ym1lbnUpO1xuXHRcdFx0XHRcdGlmIChzdWJBY3Rpb25zLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRcdHJlc3VsdC5wdXNoKG5ldyBTdWJtZW51QWN0aW9uKGFjdGlvbi5pZCwgYWN0aW9uLmxhYmVsLCBzdWJBY3Rpb25zKSk7XG5cdFx0XHRcdFx0XHRhZGRlZEl0ZW1zKys7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJlc3VsdC5wdXNoKGFjdGlvbik7XG5cdFx0XHRcdFx0YWRkZWRJdGVtcysrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmIChhZGRlZEl0ZW1zKSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKG5ldyBTZXBhcmF0b3IoKSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHJlc3VsdC5sZW5ndGgpIHtcblx0XHRcdHJlc3VsdC5wb3AoKTsgLy8gcmVtb3ZlIGxhc3Qgc2VwYXJhdG9yXG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgX2RvU2hvd0NvbnRleHRNZW51KGFjdGlvbnM6IElBY3Rpb25bXSwgZXZlbnQ6IElNb3VzZUV2ZW50IHwgbnVsbCA9IG51bGwpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX2VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gRGlzYWJsZSBob3ZlclxuXHRcdGNvbnN0IG9sZEhvdmVyU2V0dGluZyA9IHRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmhvdmVyKTtcblx0XHR0aGlzLl9lZGl0b3IudXBkYXRlT3B0aW9ucyh7XG5cdFx0XHRob3Zlcjoge1xuXHRcdFx0XHRlbmFibGVkOiBmYWxzZVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0bGV0IGFuY2hvcjogSU1vdXNlRXZlbnQgfCBJQW5jaG9yIHwgbnVsbCA9IGV2ZW50O1xuXHRcdGlmICghYW5jaG9yKSB7XG5cdFx0XHQvLyBFbnN1cmUgc2VsZWN0aW9uIGlzIHZpc2libGVcblx0XHRcdHRoaXMuX2VkaXRvci5yZXZlYWxQb3NpdGlvbih0aGlzLl9lZGl0b3IuZ2V0UG9zaXRpb24oKSwgU2Nyb2xsVHlwZS5JbW1lZGlhdGUpO1xuXG5cdFx0XHR0aGlzLl9lZGl0b3IucmVuZGVyKCk7XG5cdFx0XHRjb25zdCBjdXJzb3JDb29yZHMgPSB0aGlzLl9lZGl0b3IuZ2V0U2Nyb2xsZWRWaXNpYmxlUG9zaXRpb24odGhpcy5fZWRpdG9yLmdldFBvc2l0aW9uKCkpO1xuXG5cdFx0XHQvLyBUcmFuc2xhdGUgdG8gYWJzb2x1dGUgZWRpdG9yIHBvc2l0aW9uXG5cdFx0XHRjb25zdCBlZGl0b3JDb29yZHMgPSBkb20uZ2V0RG9tTm9kZVBhZ2VQb3NpdGlvbih0aGlzLl9lZGl0b3IuZ2V0RG9tTm9kZSgpKTtcblx0XHRcdGNvbnN0IHBvc3ggPSBlZGl0b3JDb29yZHMubGVmdCArIGN1cnNvckNvb3Jkcy5sZWZ0O1xuXHRcdFx0Y29uc3QgcG9zeSA9IGVkaXRvckNvb3Jkcy50b3AgKyBjdXJzb3JDb29yZHMudG9wICsgY3Vyc29yQ29vcmRzLmhlaWdodDtcblxuXHRcdFx0YW5jaG9yID0geyB4OiBwb3N4LCB5OiBwb3N5IH07XG5cdFx0fVxuXG5cdFx0Y29uc3QgdXNlU2hhZG93RE9NID0gdGhpcy5fZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24udXNlU2hhZG93RE9NKSAmJiAhaXNJT1M7IC8vIERvIG5vdCB1c2Ugc2hhZG93IGRvbSBvbiBJT1MgIzEyMjAzNVxuXG5cdFx0Ly8gU2hvdyBtZW51XG5cdFx0dGhpcy5fY29udGV4dE1lbnVJc0JlaW5nU2hvd25Db3VudCsrO1xuXHRcdHRoaXMuX2NvbnRleHRNZW51U2VydmljZS5zaG93Q29udGV4dE1lbnUoe1xuXHRcdFx0ZG9tRm9yU2hhZG93Um9vdDogdXNlU2hhZG93RE9NID8gdGhpcy5fZWRpdG9yLmdldE92ZXJmbG93V2lkZ2V0c0RvbU5vZGUoKSA/PyB0aGlzLl9lZGl0b3IuZ2V0RG9tTm9kZSgpIDogdW5kZWZpbmVkLFxuXG5cdFx0XHRnZXRBbmNob3I6ICgpID0+IGFuY2hvcixcblxuXHRcdFx0Z2V0QWN0aW9uczogKCkgPT4gYWN0aW9ucyxcblxuXHRcdFx0Z2V0QWN0aW9uVmlld0l0ZW06IChhY3Rpb24pID0+IHtcblx0XHRcdFx0Y29uc3Qga2V5YmluZGluZyA9IHRoaXMuX2tleWJpbmRpbmdGb3IoYWN0aW9uKTtcblx0XHRcdFx0aWYgKGtleWJpbmRpbmcpIHtcblx0XHRcdFx0XHRyZXR1cm4gbmV3IEFjdGlvblZpZXdJdGVtKGFjdGlvbiwgYWN0aW9uLCB7IGxhYmVsOiB0cnVlLCBrZXliaW5kaW5nOiBrZXliaW5kaW5nLmdldExhYmVsKCksIGlzTWVudTogdHJ1ZSB9KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGN1c3RvbUFjdGlvblZpZXdJdGVtID0gPGFueT5hY3Rpb247XG5cdFx0XHRcdGlmICh0eXBlb2YgY3VzdG9tQWN0aW9uVmlld0l0ZW0uZ2V0QWN0aW9uVmlld0l0ZW0gPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0XHRyZXR1cm4gY3VzdG9tQWN0aW9uVmlld0l0ZW0uZ2V0QWN0aW9uVmlld0l0ZW0oKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBuZXcgQWN0aW9uVmlld0l0ZW0oYWN0aW9uLCBhY3Rpb24sIHsgaWNvbjogdHJ1ZSwgbGFiZWw6IHRydWUsIGlzTWVudTogdHJ1ZSB9KTtcblx0XHRcdH0sXG5cblx0XHRcdGdldEtleUJpbmRpbmc6IChhY3Rpb24pOiBSZXNvbHZlZEtleWJpbmRpbmcgfCB1bmRlZmluZWQgPT4ge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fa2V5YmluZGluZ0ZvcihhY3Rpb24pO1xuXHRcdFx0fSxcblxuXHRcdFx0b25IaWRlOiAod2FzQ2FuY2VsbGVkOiBib29sZWFuKSA9PiB7XG5cdFx0XHRcdHRoaXMuX2NvbnRleHRNZW51SXNCZWluZ1Nob3duQ291bnQtLTtcblx0XHRcdFx0dGhpcy5fZWRpdG9yLnVwZGF0ZU9wdGlvbnMoe1xuXHRcdFx0XHRcdGhvdmVyOiBvbGRIb3ZlclNldHRpbmdcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9zaG93U2Nyb2xsYmFyQ29udGV4dE1lbnUoYW5jaG9yOiBJTW91c2VFdmVudCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoaXNTdGFuZGFsb25lRWRpdG9yV29ya3NwYWNlKHRoaXMuX3dvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpKSkge1xuXHRcdFx0Ly8gY2FuJ3QgdXBkYXRlIHRoZSBjb25maWd1cmF0aW9uIHByb3Blcmx5IGluIHRoZSBzdGFuZGFsb25lIGVkaXRvclxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1pbmltYXBPcHRpb25zID0gdGhpcy5fZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24ubWluaW1hcCk7XG5cblx0XHRsZXQgbGFzdElkID0gMDtcblx0XHRjb25zdCBjcmVhdGVBY3Rpb24gPSAob3B0czogeyBsYWJlbDogc3RyaW5nOyBlbmFibGVkPzogYm9vbGVhbjsgY2hlY2tlZD86IGJvb2xlYW47IHJ1bjogKCkgPT4gdm9pZCB9KTogSUFjdGlvbiA9PiB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRpZDogYG1lbnUtYWN0aW9uLSR7KytsYXN0SWR9YCxcblx0XHRcdFx0bGFiZWw6IG9wdHMubGFiZWwsXG5cdFx0XHRcdHRvb2x0aXA6ICcnLFxuXHRcdFx0XHRjbGFzczogdW5kZWZpbmVkLFxuXHRcdFx0XHRlbmFibGVkOiAodHlwZW9mIG9wdHMuZW5hYmxlZCA9PT0gJ3VuZGVmaW5lZCcgPyB0cnVlIDogb3B0cy5lbmFibGVkKSxcblx0XHRcdFx0Y2hlY2tlZDogb3B0cy5jaGVja2VkLFxuXHRcdFx0XHRydW46IG9wdHMucnVuXG5cdFx0XHR9O1xuXHRcdH07XG5cdFx0Y29uc3QgY3JlYXRlU3VibWVudUFjdGlvbiA9IChsYWJlbDogc3RyaW5nLCBhY3Rpb25zOiBJQWN0aW9uW10pOiBTdWJtZW51QWN0aW9uID0+IHtcblx0XHRcdHJldHVybiBuZXcgU3VibWVudUFjdGlvbihcblx0XHRcdFx0YG1lbnUtYWN0aW9uLSR7KytsYXN0SWR9YCxcblx0XHRcdFx0bGFiZWwsXG5cdFx0XHRcdGFjdGlvbnMsXG5cdFx0XHRcdHVuZGVmaW5lZFxuXHRcdFx0KTtcblx0XHR9O1xuXHRcdGNvbnN0IGNyZWF0ZUVudW1BY3Rpb24gPSA8VD4obGFiZWw6IHN0cmluZywgZW5hYmxlZDogYm9vbGVhbiwgY29uZmlnTmFtZTogc3RyaW5nLCBjb25maWd1cmVkVmFsdWU6IFQsIG9wdGlvbnM6IHsgbGFiZWw6IHN0cmluZzsgdmFsdWU6IFQgfVtdKTogSUFjdGlvbiA9PiB7XG5cdFx0XHRpZiAoIWVuYWJsZWQpIHtcblx0XHRcdFx0cmV0dXJuIGNyZWF0ZUFjdGlvbih7IGxhYmVsLCBlbmFibGVkLCBydW46ICgpID0+IHsgfSB9KTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGNyZWF0ZVJ1bm5lciA9ICh2YWx1ZTogVCkgPT4ge1xuXHRcdFx0XHRyZXR1cm4gKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKGNvbmZpZ05hbWUsIHZhbHVlKTtcblx0XHRcdFx0fTtcblx0XHRcdH07XG5cdFx0XHRjb25zdCBhY3Rpb25zOiBJQWN0aW9uW10gPSBbXTtcblx0XHRcdGZvciAoY29uc3Qgb3B0aW9uIG9mIG9wdGlvbnMpIHtcblx0XHRcdFx0YWN0aW9ucy5wdXNoKGNyZWF0ZUFjdGlvbih7XG5cdFx0XHRcdFx0bGFiZWw6IG9wdGlvbi5sYWJlbCxcblx0XHRcdFx0XHRjaGVja2VkOiBjb25maWd1cmVkVmFsdWUgPT09IG9wdGlvbi52YWx1ZSxcblx0XHRcdFx0XHRydW46IGNyZWF0ZVJ1bm5lcihvcHRpb24udmFsdWUpXG5cdFx0XHRcdH0pKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBjcmVhdGVTdWJtZW51QWN0aW9uKFxuXHRcdFx0XHRsYWJlbCxcblx0XHRcdFx0YWN0aW9uc1xuXHRcdFx0KTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgYWN0aW9uczogSUFjdGlvbltdID0gW107XG5cdFx0YWN0aW9ucy5wdXNoKGNyZWF0ZUFjdGlvbih7XG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCdjb250ZXh0Lm1pbmltYXAubWluaW1hcCcsIFwiTWluaW1hcFwiKSxcblx0XHRcdGNoZWNrZWQ6IG1pbmltYXBPcHRpb25zLmVuYWJsZWQsXG5cdFx0XHRydW46ICgpID0+IHtcblx0XHRcdFx0dGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoYGVkaXRvci5taW5pbWFwLmVuYWJsZWRgLCAhbWluaW1hcE9wdGlvbnMuZW5hYmxlZCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdGFjdGlvbnMucHVzaChuZXcgU2VwYXJhdG9yKCkpO1xuXHRcdGFjdGlvbnMucHVzaChjcmVhdGVBY3Rpb24oe1xuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSgnY29udGV4dC5taW5pbWFwLnJlbmRlckNoYXJhY3RlcnMnLCBcIlJlbmRlciBDaGFyYWN0ZXJzXCIpLFxuXHRcdFx0ZW5hYmxlZDogbWluaW1hcE9wdGlvbnMuZW5hYmxlZCxcblx0XHRcdGNoZWNrZWQ6IG1pbmltYXBPcHRpb25zLnJlbmRlckNoYXJhY3RlcnMsXG5cdFx0XHRydW46ICgpID0+IHtcblx0XHRcdFx0dGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoYGVkaXRvci5taW5pbWFwLnJlbmRlckNoYXJhY3RlcnNgLCAhbWluaW1hcE9wdGlvbnMucmVuZGVyQ2hhcmFjdGVycyk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdGFjdGlvbnMucHVzaChjcmVhdGVFbnVtQWN0aW9uPCdwcm9wb3J0aW9uYWwnIHwgJ2ZpbGwnIHwgJ2ZpdCc+KFxuXHRcdFx0bmxzLmxvY2FsaXplKCdjb250ZXh0Lm1pbmltYXAuc2l6ZScsIFwiVmVydGljYWwgc2l6ZVwiKSxcblx0XHRcdG1pbmltYXBPcHRpb25zLmVuYWJsZWQsXG5cdFx0XHQnZWRpdG9yLm1pbmltYXAuc2l6ZScsXG5cdFx0XHRtaW5pbWFwT3B0aW9ucy5zaXplLFxuXHRcdFx0W3tcblx0XHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSgnY29udGV4dC5taW5pbWFwLnNpemUucHJvcG9ydGlvbmFsJywgXCJQcm9wb3J0aW9uYWxcIiksXG5cdFx0XHRcdHZhbHVlOiAncHJvcG9ydGlvbmFsJ1xuXHRcdFx0fSwge1xuXHRcdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCdjb250ZXh0Lm1pbmltYXAuc2l6ZS5maWxsJywgXCJGaWxsXCIpLFxuXHRcdFx0XHR2YWx1ZTogJ2ZpbGwnXG5cdFx0XHR9LCB7XG5cdFx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ2NvbnRleHQubWluaW1hcC5zaXplLmZpdCcsIFwiRml0XCIpLFxuXHRcdFx0XHR2YWx1ZTogJ2ZpdCdcblx0XHRcdH1dXG5cdFx0KSk7XG5cdFx0YWN0aW9ucy5wdXNoKGNyZWF0ZUVudW1BY3Rpb248J2Fsd2F5cycgfCAnbW91c2VvdmVyJz4oXG5cdFx0XHRubHMubG9jYWxpemUoJ2NvbnRleHQubWluaW1hcC5zbGlkZXInLCBcIlNsaWRlclwiKSxcblx0XHRcdG1pbmltYXBPcHRpb25zLmVuYWJsZWQsXG5cdFx0XHQnZWRpdG9yLm1pbmltYXAuc2hvd1NsaWRlcicsXG5cdFx0XHRtaW5pbWFwT3B0aW9ucy5zaG93U2xpZGVyLFxuXHRcdFx0W3tcblx0XHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSgnY29udGV4dC5taW5pbWFwLnNsaWRlci5tb3VzZW92ZXInLCBcIk1vdXNlIE92ZXJcIiksXG5cdFx0XHRcdHZhbHVlOiAnbW91c2VvdmVyJ1xuXHRcdFx0fSwge1xuXHRcdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCdjb250ZXh0Lm1pbmltYXAuc2xpZGVyLmFsd2F5cycsIFwiQWx3YXlzXCIpLFxuXHRcdFx0XHR2YWx1ZTogJ2Fsd2F5cydcblx0XHRcdH1dXG5cdFx0KSk7XG5cblx0XHRjb25zdCB1c2VTaGFkb3dET00gPSB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi51c2VTaGFkb3dET00pICYmICFpc0lPUzsgLy8gRG8gbm90IHVzZSBzaGFkb3cgZG9tIG9uIElPUyAjMTIyMDM1XG5cdFx0dGhpcy5fY29udGV4dE1lbnVJc0JlaW5nU2hvd25Db3VudCsrO1xuXHRcdHRoaXMuX2NvbnRleHRNZW51U2VydmljZS5zaG93Q29udGV4dE1lbnUoe1xuXHRcdFx0ZG9tRm9yU2hhZG93Um9vdDogdXNlU2hhZG93RE9NID8gdGhpcy5fZWRpdG9yLmdldERvbU5vZGUoKSA6IHVuZGVmaW5lZCxcblx0XHRcdGdldEFuY2hvcjogKCkgPT4gYW5jaG9yLFxuXHRcdFx0Z2V0QWN0aW9uczogKCkgPT4gYWN0aW9ucyxcblx0XHRcdG9uSGlkZTogKHdhc0NhbmNlbGxlZDogYm9vbGVhbikgPT4ge1xuXHRcdFx0XHR0aGlzLl9jb250ZXh0TWVudUlzQmVpbmdTaG93bkNvdW50LS07XG5cdFx0XHRcdHRoaXMuX2VkaXRvci5mb2N1cygpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfa2V5YmluZGluZ0ZvcihhY3Rpb246IElBY3Rpb24pOiBSZXNvbHZlZEtleWJpbmRpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKGFjdGlvbi5pZCk7XG5cdH1cblxuXHRwdWJsaWMgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fY29udGV4dE1lbnVJc0JlaW5nU2hvd25Db3VudCA+IDApIHtcblx0XHRcdHRoaXMuX2NvbnRleHRWaWV3U2VydmljZS5oaWRlQ29udGV4dFZpZXcoKTtcblx0XHR9XG5cblx0XHR0aGlzLl90b0Rpc3Bvc2UuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmNsYXNzIFNob3dDb250ZXh0TWVudSBleHRlbmRzIEVkaXRvckFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdlZGl0b3IuYWN0aW9uLnNob3dDb250ZXh0TWVudScsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignYWN0aW9uLnNob3dDb250ZXh0TWVudS5sYWJlbCcsIFwiU2hvdyBFZGl0b3IgQ29udGV4dCBNZW51XCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWQsXG5cdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy50ZXh0SW5wdXRGb2N1cyxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5GMTAsXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogdm9pZCB7XG5cdFx0Q29udGV4dE1lbnVDb250cm9sbGVyLmdldChlZGl0b3IpPy5zaG93Q29udGV4dE1lbnUoKTtcblx0fVxufVxuXG5yZWdpc3RlckVkaXRvckNvbnRyaWJ1dGlvbihDb250ZXh0TWVudUNvbnRyb2xsZXIuSUQsIENvbnRleHRNZW51Q29udHJvbGxlciwgRWRpdG9yQ29udHJpYnV0aW9uSW5zdGFudGlhdGlvbi5CZWZvcmVGaXJzdEludGVyYWN0aW9uKTtcbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKFNob3dDb250ZXh0TWVudSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUdyQixTQUFTLHNCQUFzQjtBQUUvQixTQUFrQixXQUFXLHFCQUFxQjtBQUNsRCxTQUFTLFNBQVMsY0FBYztBQUVoQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGFBQWE7QUFDdEIsU0FB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
