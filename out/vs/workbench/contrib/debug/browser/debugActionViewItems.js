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
import * as nls from "../../../../nls.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import * as dom from "../../../../base/browser/dom.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { SelectBox } from "../../../../base/browser/ui/selectBox/selectBox.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IDebugService, State } from "../common/debug.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { selectBorder, selectBackground, asCssVariable } from "../../../../platform/theme/common/colorRegistry.js";
import { IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { dispose } from "../../../../base/common/lifecycle.js";
import { ADD_CONFIGURATION_ID } from "./debugCommands.js";
import { BaseActionViewItem, SelectActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { debugStart } from "./debugIcons.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { defaultSelectBoxStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { AccessibilityVerbositySettingId } from "../../accessibility/browser/accessibilityConfiguration.js";
import { AccessibilityCommandId } from "../../accessibility/common/accessibilityCommands.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
const $ = dom.$;
let StartDebugActionViewItem = class extends BaseActionViewItem {
  constructor(context, action, options, debugService, configurationService, commandService, contextService, contextViewService, keybindingService, hoverService, contextKeyService) {
    super(context, action, options);
    this.context = context;
    this.debugService = debugService;
    this.configurationService = configurationService;
    this.commandService = commandService;
    this.contextService = contextService;
    this.keybindingService = keybindingService;
    this.hoverService = hoverService;
    this.contextKeyService = contextKeyService;
    this.debugOptions = [];
    this.selected = 0;
    this.providers = [];
    this.toDispose = [];
    this.selectBox = new SelectBox([], -1, contextViewService, defaultSelectBoxStyles, { ariaLabel: nls.localize("debugLaunchConfigurations", "Debug Launch Configurations") });
    this.selectBox.setFocusable(false);
    this.toDispose.push(this.selectBox);
    this.registerListeners();
  }
  registerListeners() {
    this.toDispose.push(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("launch")) {
        this.updateOptions();
      }
    }));
    this.toDispose.push(this.debugService.getConfigurationManager().onDidSelectConfiguration(() => {
      this.updateOptions();
    }));
  }
  render(container) {
    this.container = container;
    container.classList.add("start-debug-action-item");
    this.start = dom.append(container, $(ThemeIcon.asCSSSelector(debugStart)));
    const keybinding = this.keybindingService.lookupKeybinding(this.action.id)?.getLabel();
    const keybindingLabel = keybinding ? ` (${keybinding})` : "";
    const title = this.action.label + keybindingLabel;
    this.toDispose.push(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), this.start, title));
    this.start.setAttribute("role", "button");
    this._setAriaLabel(title);
    this.toDispose.push(dom.addDisposableListener(this.start, dom.EventType.CLICK, () => {
      this.start.blur();
      if (this.debugService.state !== State.Initializing) {
        this.actionRunner.run(this.action, this.context);
      }
    }));
    this.toDispose.push(dom.addDisposableListener(this.start, dom.EventType.MOUSE_DOWN, (e) => {
      if (this.action.enabled && e.button === 0) {
        this.start.classList.add("active");
      }
    }));
    this.toDispose.push(dom.addDisposableListener(this.start, dom.EventType.MOUSE_UP, () => {
      this.start.classList.remove("active");
    }));
    this.toDispose.push(dom.addDisposableListener(this.start, dom.EventType.MOUSE_OUT, () => {
      this.start.classList.remove("active");
    }));
    this.toDispose.push(dom.addDisposableListener(this.start, dom.EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.RightArrow)) {
        this.start.tabIndex = -1;
        this.selectBox.focus();
        event.stopPropagation();
      }
    }));
    this.toDispose.push(this.selectBox.onDidSelect(async (e) => {
      const target = this.debugOptions[e.index];
      const shouldBeSelected = target.handler ? await target.handler() : false;
      if (shouldBeSelected) {
        this.selected = e.index;
      } else {
        this.selectBox.select(this.selected);
      }
    }));
    const selectBoxContainer = $(".configuration");
    this.selectBox.render(dom.append(container, selectBoxContainer));
    this.toDispose.push(dom.addDisposableListener(selectBoxContainer, dom.EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.LeftArrow)) {
        this.selectBox.setFocusable(false);
        this.start.tabIndex = 0;
        this.start.focus();
        event.stopPropagation();
        event.preventDefault();
      }
    }));
    this.container.style.border = `1px solid ${asCssVariable(selectBorder)}`;
    selectBoxContainer.style.borderLeft = `1px solid ${asCssVariable(selectBorder)}`;
    this.container.style.backgroundColor = asCssVariable(selectBackground);
    const configManager = this.debugService.getConfigurationManager();
    const updateDynamicConfigs = () => configManager.getDynamicProviders().then((providers) => {
      if (providers.length !== this.providers.length) {
        this.providers = providers;
        this.updateOptions();
      }
    });
    this.toDispose.push(configManager.onDidChangeConfigurationProviders(updateDynamicConfigs));
    updateDynamicConfigs();
    this.updateOptions();
  }
  setActionContext(context) {
    this.context = context;
  }
  isEnabled() {
    return true;
  }
  focus(fromRight) {
    if (fromRight) {
      this.selectBox.focus();
    } else {
      this.start.tabIndex = 0;
      this.start.focus();
    }
  }
  blur() {
    this.start.tabIndex = -1;
    this.selectBox.blur();
    this.container.blur();
  }
  setFocusable(focusable) {
    if (focusable) {
      this.start.tabIndex = 0;
    } else {
      this.start.tabIndex = -1;
      this.selectBox.setFocusable(false);
    }
  }
  dispose() {
    this.toDispose = dispose(this.toDispose);
    super.dispose();
  }
  updateOptions() {
    this.selected = 0;
    this.debugOptions = [];
    const manager = this.debugService.getConfigurationManager();
    const inWorkspace = this.contextService.getWorkbenchState() === WorkbenchState.WORKSPACE;
    let lastGroup;
    const disabledIdxs = [];
    manager.getAllConfigurations().forEach(({ launch, name, presentation }) => {
      if (lastGroup !== presentation?.group) {
        lastGroup = presentation?.group;
        if (this.debugOptions.length) {
          this.debugOptions.push({ label: StartDebugActionViewItem.SEPARATOR, handler: () => Promise.resolve(false) });
          disabledIdxs.push(this.debugOptions.length - 1);
        }
      }
      if (name === manager.selectedConfiguration.name && launch === manager.selectedConfiguration.launch) {
        this.selected = this.debugOptions.length;
      }
      const label = inWorkspace ? `${name} (${launch.name})` : name;
      this.debugOptions.push({
        label,
        handler: async () => {
          await manager.selectConfiguration(launch, name);
          return true;
        }
      });
    });
    manager.getRecentDynamicConfigurations().slice(0, 3).forEach(({ name, type }) => {
      if (type === manager.selectedConfiguration.type && manager.selectedConfiguration.name === name) {
        this.selected = this.debugOptions.length;
      }
      this.debugOptions.push({
        label: name,
        handler: async () => {
          await manager.selectConfiguration(void 0, name, void 0, { type });
          return true;
        }
      });
    });
    if (this.debugOptions.length === 0) {
      this.debugOptions.push({ label: nls.localize("noConfigurations", "No Configurations"), handler: async () => false });
    }
    this.debugOptions.push({ label: StartDebugActionViewItem.SEPARATOR, handler: () => Promise.resolve(false) });
    disabledIdxs.push(this.debugOptions.length - 1);
    this.providers.forEach((p) => {
      this.debugOptions.push({
        label: `${p.label}...`,
        handler: async () => {
          const picked = await p.pick();
          if (picked) {
            await manager.selectConfiguration(picked.launch, picked.config.name, picked.config, { type: p.type });
            return true;
          }
          return false;
        }
      });
    });
    manager.getLaunches().filter((l) => !l.hidden).forEach((l) => {
      const label = inWorkspace ? nls.localize("addConfigTo", "Add Config ({0})...", l.name) : nls.localize("addConfiguration", "Add Configuration...");
      this.debugOptions.push({
        label,
        handler: async () => {
          await this.commandService.executeCommand(ADD_CONFIGURATION_ID, l.uri.toString());
          return false;
        }
      });
    });
    this.selectBox.setOptions(this.debugOptions.map((data, index) => ({ text: data.label, isDisabled: disabledIdxs.indexOf(index) !== -1 })), this.selected);
  }
  _setAriaLabel(title) {
    let ariaLabel = title;
    let keybinding;
    const verbose = this.configurationService.getValue(AccessibilityVerbositySettingId.Debug);
    if (verbose) {
      keybinding = this.keybindingService.lookupKeybinding(AccessibilityCommandId.OpenAccessibilityHelp, this.contextKeyService)?.getLabel() ?? void 0;
    }
    if (keybinding) {
      ariaLabel = nls.localize("commentLabelWithKeybinding", "{0}, use ({1}) for accessibility help", ariaLabel, keybinding);
    } else {
      ariaLabel = nls.localize("commentLabelWithKeybindingNoKeybinding", "{0}, run the command Open Accessibility Help which is currently not triggerable via keybinding.", ariaLabel);
    }
    this.start.ariaLabel = ariaLabel;
  }
};
StartDebugActionViewItem.SEPARATOR = "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500";
StartDebugActionViewItem = __decorateClass([
  __decorateParam(3, IDebugService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, ICommandService),
  __decorateParam(6, IWorkspaceContextService),
  __decorateParam(7, IContextViewService),
  __decorateParam(8, IKeybindingService),
  __decorateParam(9, IHoverService),
  __decorateParam(10, IContextKeyService)
], StartDebugActionViewItem);
let FocusSessionActionViewItem = class extends SelectActionViewItem {
  constructor(action, session, debugService, contextViewService, configurationService) {
    super(null, action, [], -1, contextViewService, defaultSelectBoxStyles, { ariaLabel: nls.localize("debugSession", "Debug Session") });
    this.debugService = debugService;
    this.configurationService = configurationService;
    this._register(this.debugService.getViewModel().onDidFocusSession(() => {
      const session2 = this.getSelectedSession();
      if (session2) {
        const index = this.getSessions().indexOf(session2);
        this.select(index);
      }
    }));
    this._register(this.debugService.onDidNewSession((session2) => {
      const sessionListeners = [];
      sessionListeners.push(session2.onDidChangeName(() => this.update()));
      sessionListeners.push(session2.onDidEndAdapter(() => dispose(sessionListeners)));
      this.update();
    }));
    this.getSessions().forEach((session2) => {
      this._register(session2.onDidChangeName(() => this.update()));
    });
    this._register(this.debugService.onDidEndSession(() => this.update()));
    const selectedSession = session ? this.mapFocusedSessionToSelected(session) : void 0;
    this.update(selectedSession);
  }
  getActionContext(_, index) {
    return this.getSessions()[index];
  }
  update(session) {
    if (!session) {
      session = this.getSelectedSession();
    }
    const sessions = this.getSessions();
    const names = sessions.map((s) => {
      const label = s.getLabel();
      if (s.parentSession) {
        return `\xA0\xA0${label}`;
      }
      return label;
    });
    this.setOptions(names.map((data) => ({ text: data })), session ? sessions.indexOf(session) : void 0);
  }
  getSelectedSession() {
    const session = this.debugService.getViewModel().focusedSession;
    return session ? this.mapFocusedSessionToSelected(session) : void 0;
  }
  getSessions() {
    const showSubSessions = this.configurationService.getValue("debug").showSubSessionsInToolBar;
    const sessions = this.debugService.getModel().getSessions();
    return showSubSessions ? sessions : sessions.filter((s) => !s.parentSession);
  }
  mapFocusedSessionToSelected(focusedSession) {
    const showSubSessions = this.configurationService.getValue("debug").showSubSessionsInToolBar;
    while (focusedSession.parentSession && !showSubSessions) {
      focusedSession = focusedSession.parentSession;
    }
    return focusedSession;
  }
};
FocusSessionActionViewItem = __decorateClass([
  __decorateParam(2, IDebugService),
  __decorateParam(3, IContextViewService),
  __decorateParam(4, IConfigurationService)
], FocusSessionActionViewItem);
export {
  FocusSessionActionViewItem,
  StartDebugActionViewItem
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL2RlYnVnQWN0aW9uVmlld0l0ZW1zLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBLZXlDb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2tleWJvYXJkRXZlbnQuanMnO1xuaW1wb3J0IHsgU2VsZWN0Qm94LCBJU2VsZWN0T3B0aW9uSXRlbSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9zZWxlY3RCb3gvc2VsZWN0Qm94LmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IElEZWJ1Z1NlcnZpY2UsIElEZWJ1Z1Nlc3Npb24sIElEZWJ1Z0NvbmZpZ3VyYXRpb24sIElDb25maWcsIElMYXVuY2gsIFN0YXRlIH0gZnJvbSAnLi4vY29tbW9uL2RlYnVnLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBzZWxlY3RCb3JkZXIsIHNlbGVjdEJhY2tncm91bmQsIGFzQ3NzVmFyaWFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dFZpZXdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIFdvcmtiZW5jaFN0YXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgSURpc3Bvc2FibGUsIGRpc3Bvc2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgQUREX0NPTkZJR1VSQVRJT05fSUQgfSBmcm9tICcuL2RlYnVnQ29tbWFuZHMuanMnO1xuaW1wb3J0IHsgQmFzZUFjdGlvblZpZXdJdGVtLCBJQmFzZUFjdGlvblZpZXdJdGVtT3B0aW9ucywgU2VsZWN0QWN0aW9uVmlld0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvblZpZXdJdGVtcy5qcyc7XG5pbXBvcnQgeyBkZWJ1Z1N0YXJ0IH0gZnJvbSAnLi9kZWJ1Z0ljb25zLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgZGVmYXVsdFNlbGVjdEJveFN0eWxlcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2Jyb3dzZXIvZGVmYXVsdFN0eWxlcy5qcyc7XG5pbXBvcnQgeyBnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3ZlckRlbGVnYXRlRmFjdG9yeS5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBBY2Nlc3NpYmlsaXR5VmVyYm9zaXR5U2V0dGluZ0lkIH0gZnJvbSAnLi4vLi4vYWNjZXNzaWJpbGl0eS9icm93c2VyL2FjY2Vzc2liaWxpdHlDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IEFjY2Vzc2liaWxpdHlDb21tYW5kSWQgfSBmcm9tICcuLi8uLi9hY2Nlc3NpYmlsaXR5L2NvbW1vbi9hY2Nlc3NpYmlsaXR5Q29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5cbmNvbnN0ICQgPSBkb20uJDtcblxuZXhwb3J0IGNsYXNzIFN0YXJ0RGVidWdBY3Rpb25WaWV3SXRlbSBleHRlbmRzIEJhc2VBY3Rpb25WaWV3SXRlbSB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgU0VQQVJBVE9SID0gJ1xcdTI1MDBcXHUyNTAwXFx1MjUwMFxcdTI1MDBcXHUyNTAwXFx1MjUwMFxcdTI1MDBcXHUyNTAwXFx1MjUwMCc7XG5cblx0cHJpdmF0ZSBjb250YWluZXIhOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBzdGFydCE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHNlbGVjdEJveDogU2VsZWN0Qm94O1xuXHRwcml2YXRlIGRlYnVnT3B0aW9uczogeyBsYWJlbDogc3RyaW5nOyBoYW5kbGVyOiAoKCkgPT4gUHJvbWlzZTxib29sZWFuPikgfVtdID0gW107XG5cdHByaXZhdGUgdG9EaXNwb3NlOiBJRGlzcG9zYWJsZVtdO1xuXHRwcml2YXRlIHNlbGVjdGVkID0gMDtcblx0cHJpdmF0ZSBwcm92aWRlcnM6IHsgbGFiZWw6IHN0cmluZzsgdHlwZTogc3RyaW5nOyBwaWNrOiAoKSA9PiBQcm9taXNlPHsgbGF1bmNoOiBJTGF1bmNoOyBjb25maWc6IElDb25maWcgfSB8IHVuZGVmaW5lZD4gfVtdID0gW107XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBjb250ZXh0OiB1bmtub3duLFxuXHRcdGFjdGlvbjogSUFjdGlvbixcblx0XHRvcHRpb25zOiBJQmFzZUFjdGlvblZpZXdJdGVtT3B0aW9ucyxcblx0XHRASURlYnVnU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGRlYnVnU2VydmljZTogSURlYnVnU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASUNvbnRleHRWaWV3U2VydmljZSBjb250ZXh0Vmlld1NlcnZpY2U6IElDb250ZXh0Vmlld1NlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoY29udGV4dCwgYWN0aW9uLCBvcHRpb25zKTtcblx0XHR0aGlzLnRvRGlzcG9zZSA9IFtdO1xuXHRcdHRoaXMuc2VsZWN0Qm94ID0gbmV3IFNlbGVjdEJveChbXSwgLTEsIGNvbnRleHRWaWV3U2VydmljZSwgZGVmYXVsdFNlbGVjdEJveFN0eWxlcywgeyBhcmlhTGFiZWw6IG5scy5sb2NhbGl6ZSgnZGVidWdMYXVuY2hDb25maWd1cmF0aW9ucycsICdEZWJ1ZyBMYXVuY2ggQ29uZmlndXJhdGlvbnMnKSB9KTtcblx0XHR0aGlzLnNlbGVjdEJveC5zZXRGb2N1c2FibGUoZmFsc2UpO1xuXHRcdHRoaXMudG9EaXNwb3NlLnB1c2godGhpcy5zZWxlY3RCb3gpO1xuXG5cdFx0dGhpcy5yZWdpc3Rlckxpc3RlbmVycygpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcblx0XHR0aGlzLnRvRGlzcG9zZS5wdXNoKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ2xhdW5jaCcpKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlT3B0aW9ucygpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLnRvRGlzcG9zZS5wdXNoKHRoaXMuZGVidWdTZXJ2aWNlLmdldENvbmZpZ3VyYXRpb25NYW5hZ2VyKCkub25EaWRTZWxlY3RDb25maWd1cmF0aW9uKCgpID0+IHtcblx0XHRcdHRoaXMudXBkYXRlT3B0aW9ucygpO1xuXHRcdH0pKTtcblx0fVxuXG5cdG92ZXJyaWRlIHJlbmRlcihjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0dGhpcy5jb250YWluZXIgPSBjb250YWluZXI7XG5cdFx0Y29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ3N0YXJ0LWRlYnVnLWFjdGlvbi1pdGVtJyk7XG5cdFx0dGhpcy5zdGFydCA9IGRvbS5hcHBlbmQoY29udGFpbmVyLCAkKFRoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKGRlYnVnU3RhcnQpKSk7XG5cdFx0Y29uc3Qga2V5YmluZGluZyA9IHRoaXMua2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyh0aGlzLmFjdGlvbi5pZCk/LmdldExhYmVsKCk7XG5cdFx0Y29uc3Qga2V5YmluZGluZ0xhYmVsID0ga2V5YmluZGluZyA/IGAgKCR7a2V5YmluZGluZ30pYCA6ICcnO1xuXHRcdGNvbnN0IHRpdGxlID0gdGhpcy5hY3Rpb24ubGFiZWwgKyBrZXliaW5kaW5nTGFiZWw7XG5cdFx0dGhpcy50b0Rpc3Bvc2UucHVzaCh0aGlzLmhvdmVyU2VydmljZS5zZXR1cE1hbmFnZWRIb3ZlcihnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSgnbW91c2UnKSwgdGhpcy5zdGFydCwgdGl0bGUpKTtcblx0XHR0aGlzLnN0YXJ0LnNldEF0dHJpYnV0ZSgncm9sZScsICdidXR0b24nKTtcblx0XHR0aGlzLl9zZXRBcmlhTGFiZWwodGl0bGUpO1xuXG5cdFx0dGhpcy50b0Rpc3Bvc2UucHVzaChkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuc3RhcnQsIGRvbS5FdmVudFR5cGUuQ0xJQ0ssICgpID0+IHtcblx0XHRcdHRoaXMuc3RhcnQuYmx1cigpO1xuXHRcdFx0aWYgKHRoaXMuZGVidWdTZXJ2aWNlLnN0YXRlICE9PSBTdGF0ZS5Jbml0aWFsaXppbmcpIHtcblx0XHRcdFx0dGhpcy5hY3Rpb25SdW5uZXIucnVuKHRoaXMuYWN0aW9uLCB0aGlzLmNvbnRleHQpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMudG9EaXNwb3NlLnB1c2goZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLnN0YXJ0LCBkb20uRXZlbnRUeXBlLk1PVVNFX0RPV04sIChlOiBNb3VzZUV2ZW50KSA9PiB7XG5cdFx0XHRpZiAodGhpcy5hY3Rpb24uZW5hYmxlZCAmJiBlLmJ1dHRvbiA9PT0gMCkge1xuXHRcdFx0XHR0aGlzLnN0YXJ0LmNsYXNzTGlzdC5hZGQoJ2FjdGl2ZScpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLnRvRGlzcG9zZS5wdXNoKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5zdGFydCwgZG9tLkV2ZW50VHlwZS5NT1VTRV9VUCwgKCkgPT4ge1xuXHRcdFx0dGhpcy5zdGFydC5jbGFzc0xpc3QucmVtb3ZlKCdhY3RpdmUnKTtcblx0XHR9KSk7XG5cdFx0dGhpcy50b0Rpc3Bvc2UucHVzaChkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuc3RhcnQsIGRvbS5FdmVudFR5cGUuTU9VU0VfT1VULCAoKSA9PiB7XG5cdFx0XHR0aGlzLnN0YXJ0LmNsYXNzTGlzdC5yZW1vdmUoJ2FjdGl2ZScpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMudG9EaXNwb3NlLnB1c2goZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLnN0YXJ0LCBkb20uRXZlbnRUeXBlLktFWV9ET1dOLCAoZTogS2V5Ym9hcmRFdmVudCkgPT4ge1xuXHRcdFx0Y29uc3QgZXZlbnQgPSBuZXcgU3RhbmRhcmRLZXlib2FyZEV2ZW50KGUpO1xuXHRcdFx0aWYgKGV2ZW50LmVxdWFscyhLZXlDb2RlLlJpZ2h0QXJyb3cpKSB7XG5cdFx0XHRcdHRoaXMuc3RhcnQudGFiSW5kZXggPSAtMTtcblx0XHRcdFx0dGhpcy5zZWxlY3RCb3guZm9jdXMoKTtcblx0XHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMudG9EaXNwb3NlLnB1c2godGhpcy5zZWxlY3RCb3gub25EaWRTZWxlY3QoYXN5bmMgZSA9PiB7XG5cdFx0XHRjb25zdCB0YXJnZXQgPSB0aGlzLmRlYnVnT3B0aW9uc1tlLmluZGV4XTtcblx0XHRcdGNvbnN0IHNob3VsZEJlU2VsZWN0ZWQgPSB0YXJnZXQuaGFuZGxlciA/IGF3YWl0IHRhcmdldC5oYW5kbGVyKCkgOiBmYWxzZTtcblx0XHRcdGlmIChzaG91bGRCZVNlbGVjdGVkKSB7XG5cdFx0XHRcdHRoaXMuc2VsZWN0ZWQgPSBlLmluZGV4O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gU29tZSBzZWxlY3Qgb3B0aW9ucyBzaG91bGQgbm90IHJlbWFpbiBzZWxlY3RlZCBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMzE1MjZcblx0XHRcdFx0dGhpcy5zZWxlY3RCb3guc2VsZWN0KHRoaXMuc2VsZWN0ZWQpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IHNlbGVjdEJveENvbnRhaW5lciA9ICQoJy5jb25maWd1cmF0aW9uJyk7XG5cdFx0dGhpcy5zZWxlY3RCb3gucmVuZGVyKGRvbS5hcHBlbmQoY29udGFpbmVyLCBzZWxlY3RCb3hDb250YWluZXIpKTtcblx0XHR0aGlzLnRvRGlzcG9zZS5wdXNoKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIoc2VsZWN0Qm94Q29udGFpbmVyLCBkb20uRXZlbnRUeXBlLktFWV9ET1dOLCAoZTogS2V5Ym9hcmRFdmVudCkgPT4ge1xuXHRcdFx0Y29uc3QgZXZlbnQgPSBuZXcgU3RhbmRhcmRLZXlib2FyZEV2ZW50KGUpO1xuXHRcdFx0aWYgKGV2ZW50LmVxdWFscyhLZXlDb2RlLkxlZnRBcnJvdykpIHtcblx0XHRcdFx0dGhpcy5zZWxlY3RCb3guc2V0Rm9jdXNhYmxlKGZhbHNlKTtcblx0XHRcdFx0dGhpcy5zdGFydC50YWJJbmRleCA9IDA7XG5cdFx0XHRcdHRoaXMuc3RhcnQuZm9jdXMoKTtcblx0XHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuY29udGFpbmVyLnN0eWxlLmJvcmRlciA9IGAxcHggc29saWQgJHthc0Nzc1ZhcmlhYmxlKHNlbGVjdEJvcmRlcil9YDtcblx0XHRzZWxlY3RCb3hDb250YWluZXIuc3R5bGUuYm9yZGVyTGVmdCA9IGAxcHggc29saWQgJHthc0Nzc1ZhcmlhYmxlKHNlbGVjdEJvcmRlcil9YDtcblx0XHR0aGlzLmNvbnRhaW5lci5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBhc0Nzc1ZhcmlhYmxlKHNlbGVjdEJhY2tncm91bmQpO1xuXG5cdFx0Y29uc3QgY29uZmlnTWFuYWdlciA9IHRoaXMuZGVidWdTZXJ2aWNlLmdldENvbmZpZ3VyYXRpb25NYW5hZ2VyKCk7XG5cdFx0Y29uc3QgdXBkYXRlRHluYW1pY0NvbmZpZ3MgPSAoKSA9PiBjb25maWdNYW5hZ2VyLmdldER5bmFtaWNQcm92aWRlcnMoKS50aGVuKHByb3ZpZGVycyA9PiB7XG5cdFx0XHRpZiAocHJvdmlkZXJzLmxlbmd0aCAhPT0gdGhpcy5wcm92aWRlcnMubGVuZ3RoKSB7XG5cdFx0XHRcdHRoaXMucHJvdmlkZXJzID0gcHJvdmlkZXJzO1xuXHRcdFx0XHR0aGlzLnVwZGF0ZU9wdGlvbnMoKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMudG9EaXNwb3NlLnB1c2goY29uZmlnTWFuYWdlci5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb25Qcm92aWRlcnModXBkYXRlRHluYW1pY0NvbmZpZ3MpKTtcblx0XHR1cGRhdGVEeW5hbWljQ29uZmlncygpO1xuXHRcdHRoaXMudXBkYXRlT3B0aW9ucygpO1xuXHR9XG5cblx0b3ZlcnJpZGUgc2V0QWN0aW9uQ29udGV4dChjb250ZXh0OiBhbnkpOiB2b2lkIHtcblx0XHR0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuXHR9XG5cblx0b3ZlcnJpZGUgaXNFbmFibGVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0b3ZlcnJpZGUgZm9jdXMoZnJvbVJpZ2h0PzogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmIChmcm9tUmlnaHQpIHtcblx0XHRcdHRoaXMuc2VsZWN0Qm94LmZvY3VzKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuc3RhcnQudGFiSW5kZXggPSAwO1xuXHRcdFx0dGhpcy5zdGFydC5mb2N1cygpO1xuXHRcdH1cblx0fVxuXG5cdG92ZXJyaWRlIGJsdXIoKTogdm9pZCB7XG5cdFx0dGhpcy5zdGFydC50YWJJbmRleCA9IC0xO1xuXHRcdHRoaXMuc2VsZWN0Qm94LmJsdXIoKTtcblx0XHR0aGlzLmNvbnRhaW5lci5ibHVyKCk7XG5cdH1cblxuXHRvdmVycmlkZSBzZXRGb2N1c2FibGUoZm9jdXNhYmxlOiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKGZvY3VzYWJsZSkge1xuXHRcdFx0dGhpcy5zdGFydC50YWJJbmRleCA9IDA7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuc3RhcnQudGFiSW5kZXggPSAtMTtcblx0XHRcdHRoaXMuc2VsZWN0Qm94LnNldEZvY3VzYWJsZShmYWxzZSk7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLnRvRGlzcG9zZSA9IGRpc3Bvc2UodGhpcy50b0Rpc3Bvc2UpO1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlT3B0aW9ucygpOiB2b2lkIHtcblx0XHR0aGlzLnNlbGVjdGVkID0gMDtcblx0XHR0aGlzLmRlYnVnT3B0aW9ucyA9IFtdO1xuXHRcdGNvbnN0IG1hbmFnZXIgPSB0aGlzLmRlYnVnU2VydmljZS5nZXRDb25maWd1cmF0aW9uTWFuYWdlcigpO1xuXHRcdGNvbnN0IGluV29ya3NwYWNlID0gdGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3JrYmVuY2hTdGF0ZSgpID09PSBXb3JrYmVuY2hTdGF0ZS5XT1JLU1BBQ0U7XG5cdFx0bGV0IGxhc3RHcm91cDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IGRpc2FibGVkSWR4czogbnVtYmVyW10gPSBbXTtcblx0XHRtYW5hZ2VyLmdldEFsbENvbmZpZ3VyYXRpb25zKCkuZm9yRWFjaCgoeyBsYXVuY2gsIG5hbWUsIHByZXNlbnRhdGlvbiB9KSA9PiB7XG5cdFx0XHRpZiAobGFzdEdyb3VwICE9PSBwcmVzZW50YXRpb24/Lmdyb3VwKSB7XG5cdFx0XHRcdGxhc3RHcm91cCA9IHByZXNlbnRhdGlvbj8uZ3JvdXA7XG5cdFx0XHRcdGlmICh0aGlzLmRlYnVnT3B0aW9ucy5sZW5ndGgpIHtcblx0XHRcdFx0XHR0aGlzLmRlYnVnT3B0aW9ucy5wdXNoKHsgbGFiZWw6IFN0YXJ0RGVidWdBY3Rpb25WaWV3SXRlbS5TRVBBUkFUT1IsIGhhbmRsZXI6ICgpID0+IFByb21pc2UucmVzb2x2ZShmYWxzZSkgfSk7XG5cdFx0XHRcdFx0ZGlzYWJsZWRJZHhzLnB1c2godGhpcy5kZWJ1Z09wdGlvbnMubGVuZ3RoIC0gMSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChuYW1lID09PSBtYW5hZ2VyLnNlbGVjdGVkQ29uZmlndXJhdGlvbi5uYW1lICYmIGxhdW5jaCA9PT0gbWFuYWdlci5zZWxlY3RlZENvbmZpZ3VyYXRpb24ubGF1bmNoKSB7XG5cdFx0XHRcdHRoaXMuc2VsZWN0ZWQgPSB0aGlzLmRlYnVnT3B0aW9ucy5sZW5ndGg7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGxhYmVsID0gaW5Xb3Jrc3BhY2UgPyBgJHtuYW1lfSAoJHtsYXVuY2gubmFtZX0pYCA6IG5hbWU7XG5cdFx0XHR0aGlzLmRlYnVnT3B0aW9ucy5wdXNoKHtcblx0XHRcdFx0bGFiZWwsIGhhbmRsZXI6IGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRhd2FpdCBtYW5hZ2VyLnNlbGVjdENvbmZpZ3VyYXRpb24obGF1bmNoLCBuYW1lKTtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHQvLyBPbmx5IHRha2UgMyBlbGVtZW50cyBmcm9tIHRoZSByZWNlbnQgZHluYW1pYyBjb25maWd1cmF0aW9ucyB0byBub3QgY2x1dHRlciB0aGUgZHJvcGRvd25cblx0XHRtYW5hZ2VyLmdldFJlY2VudER5bmFtaWNDb25maWd1cmF0aW9ucygpLnNsaWNlKDAsIDMpLmZvckVhY2goKHsgbmFtZSwgdHlwZSB9KSA9PiB7XG5cdFx0XHRpZiAodHlwZSA9PT0gbWFuYWdlci5zZWxlY3RlZENvbmZpZ3VyYXRpb24udHlwZSAmJiBtYW5hZ2VyLnNlbGVjdGVkQ29uZmlndXJhdGlvbi5uYW1lID09PSBuYW1lKSB7XG5cdFx0XHRcdHRoaXMuc2VsZWN0ZWQgPSB0aGlzLmRlYnVnT3B0aW9ucy5sZW5ndGg7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmRlYnVnT3B0aW9ucy5wdXNoKHtcblx0XHRcdFx0bGFiZWw6IG5hbWUsXG5cdFx0XHRcdGhhbmRsZXI6IGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRhd2FpdCBtYW5hZ2VyLnNlbGVjdENvbmZpZ3VyYXRpb24odW5kZWZpbmVkLCBuYW1lLCB1bmRlZmluZWQsIHsgdHlwZSB9KTtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHRpZiAodGhpcy5kZWJ1Z09wdGlvbnMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHR0aGlzLmRlYnVnT3B0aW9ucy5wdXNoKHsgbGFiZWw6IG5scy5sb2NhbGl6ZSgnbm9Db25maWd1cmF0aW9ucycsIFwiTm8gQ29uZmlndXJhdGlvbnNcIiksIGhhbmRsZXI6IGFzeW5jICgpID0+IGZhbHNlIH0pO1xuXHRcdH1cblxuXHRcdHRoaXMuZGVidWdPcHRpb25zLnB1c2goeyBsYWJlbDogU3RhcnREZWJ1Z0FjdGlvblZpZXdJdGVtLlNFUEFSQVRPUiwgaGFuZGxlcjogKCkgPT4gUHJvbWlzZS5yZXNvbHZlKGZhbHNlKSB9KTtcblx0XHRkaXNhYmxlZElkeHMucHVzaCh0aGlzLmRlYnVnT3B0aW9ucy5sZW5ndGggLSAxKTtcblxuXHRcdHRoaXMucHJvdmlkZXJzLmZvckVhY2gocCA9PiB7XG5cblx0XHRcdHRoaXMuZGVidWdPcHRpb25zLnB1c2goe1xuXHRcdFx0XHRsYWJlbDogYCR7cC5sYWJlbH0uLi5gLFxuXHRcdFx0XHRoYW5kbGVyOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgcGlja2VkID0gYXdhaXQgcC5waWNrKCk7XG5cdFx0XHRcdFx0aWYgKHBpY2tlZCkge1xuXHRcdFx0XHRcdFx0YXdhaXQgbWFuYWdlci5zZWxlY3RDb25maWd1cmF0aW9uKHBpY2tlZC5sYXVuY2gsIHBpY2tlZC5jb25maWcubmFtZSwgcGlja2VkLmNvbmZpZywgeyB0eXBlOiBwLnR5cGUgfSk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdG1hbmFnZXIuZ2V0TGF1bmNoZXMoKS5maWx0ZXIobCA9PiAhbC5oaWRkZW4pLmZvckVhY2gobCA9PiB7XG5cdFx0XHRjb25zdCBsYWJlbCA9IGluV29ya3NwYWNlID8gbmxzLmxvY2FsaXplKFwiYWRkQ29uZmlnVG9cIiwgXCJBZGQgQ29uZmlnICh7MH0pLi4uXCIsIGwubmFtZSkgOiBubHMubG9jYWxpemUoJ2FkZENvbmZpZ3VyYXRpb24nLCBcIkFkZCBDb25maWd1cmF0aW9uLi4uXCIpO1xuXHRcdFx0dGhpcy5kZWJ1Z09wdGlvbnMucHVzaCh7XG5cdFx0XHRcdGxhYmVsLCBoYW5kbGVyOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChBRERfQ09ORklHVVJBVElPTl9JRCwgbC51cmkudG9TdHJpbmcoKSk7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHRoaXMuc2VsZWN0Qm94LnNldE9wdGlvbnModGhpcy5kZWJ1Z09wdGlvbnMubWFwKChkYXRhLCBpbmRleCk6IElTZWxlY3RPcHRpb25JdGVtID0+ICh7IHRleHQ6IGRhdGEubGFiZWwsIGlzRGlzYWJsZWQ6IGRpc2FibGVkSWR4cy5pbmRleE9mKGluZGV4KSAhPT0gLTEgfSkpLCB0aGlzLnNlbGVjdGVkKTtcblx0fVxuXG5cdHByaXZhdGUgX3NldEFyaWFMYWJlbCh0aXRsZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0bGV0IGFyaWFMYWJlbCA9IHRpdGxlO1xuXHRcdGxldCBrZXliaW5kaW5nOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgdmVyYm9zZSA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoQWNjZXNzaWJpbGl0eVZlcmJvc2l0eVNldHRpbmdJZC5EZWJ1Zyk7XG5cdFx0aWYgKHZlcmJvc2UpIHtcblx0XHRcdGtleWJpbmRpbmcgPSB0aGlzLmtleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoQWNjZXNzaWJpbGl0eUNvbW1hbmRJZC5PcGVuQWNjZXNzaWJpbGl0eUhlbHAsIHRoaXMuY29udGV4dEtleVNlcnZpY2UpPy5nZXRMYWJlbCgpID8/IHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0aWYgKGtleWJpbmRpbmcpIHtcblx0XHRcdGFyaWFMYWJlbCA9IG5scy5sb2NhbGl6ZSgnY29tbWVudExhYmVsV2l0aEtleWJpbmRpbmcnLCBcInswfSwgdXNlICh7MX0pIGZvciBhY2Nlc3NpYmlsaXR5IGhlbHBcIiwgYXJpYUxhYmVsLCBrZXliaW5kaW5nKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXJpYUxhYmVsID0gbmxzLmxvY2FsaXplKCdjb21tZW50TGFiZWxXaXRoS2V5YmluZGluZ05vS2V5YmluZGluZycsIFwiezB9LCBydW4gdGhlIGNvbW1hbmQgT3BlbiBBY2Nlc3NpYmlsaXR5IEhlbHAgd2hpY2ggaXMgY3VycmVudGx5IG5vdCB0cmlnZ2VyYWJsZSB2aWEga2V5YmluZGluZy5cIiwgYXJpYUxhYmVsKTtcblx0XHR9XG5cdFx0dGhpcy5zdGFydC5hcmlhTGFiZWwgPSBhcmlhTGFiZWw7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEZvY3VzU2Vzc2lvbkFjdGlvblZpZXdJdGVtIGV4dGVuZHMgU2VsZWN0QWN0aW9uVmlld0l0ZW08SURlYnVnU2Vzc2lvbj4ge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRhY3Rpb246IElBY3Rpb24sXG5cdFx0c2Vzc2lvbjogSURlYnVnU2Vzc2lvbiB8IHVuZGVmaW5lZCxcblx0XHRASURlYnVnU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgZGVidWdTZXJ2aWNlOiBJRGVidWdTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dFZpZXdTZXJ2aWNlIGNvbnRleHRWaWV3U2VydmljZTogSUNvbnRleHRWaWV3U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihudWxsLCBhY3Rpb24sIFtdLCAtMSwgY29udGV4dFZpZXdTZXJ2aWNlLCBkZWZhdWx0U2VsZWN0Qm94U3R5bGVzLCB7IGFyaWFMYWJlbDogbmxzLmxvY2FsaXplKCdkZWJ1Z1Nlc3Npb24nLCAnRGVidWcgU2Vzc2lvbicpIH0pO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkub25EaWRGb2N1c1Nlc3Npb24oKCkgPT4ge1xuXHRcdFx0Y29uc3Qgc2Vzc2lvbiA9IHRoaXMuZ2V0U2VsZWN0ZWRTZXNzaW9uKCk7XG5cdFx0XHRpZiAoc2Vzc2lvbikge1xuXHRcdFx0XHRjb25zdCBpbmRleCA9IHRoaXMuZ2V0U2Vzc2lvbnMoKS5pbmRleE9mKHNlc3Npb24pO1xuXHRcdFx0XHR0aGlzLnNlbGVjdChpbmRleCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5kZWJ1Z1NlcnZpY2Uub25EaWROZXdTZXNzaW9uKHNlc3Npb24gPT4ge1xuXHRcdFx0Y29uc3Qgc2Vzc2lvbkxpc3RlbmVyczogSURpc3Bvc2FibGVbXSA9IFtdO1xuXHRcdFx0c2Vzc2lvbkxpc3RlbmVycy5wdXNoKHNlc3Npb24ub25EaWRDaGFuZ2VOYW1lKCgpID0+IHRoaXMudXBkYXRlKCkpKTtcblx0XHRcdHNlc3Npb25MaXN0ZW5lcnMucHVzaChzZXNzaW9uLm9uRGlkRW5kQWRhcHRlcigoKSA9PiBkaXNwb3NlKHNlc3Npb25MaXN0ZW5lcnMpKSk7XG5cdFx0XHR0aGlzLnVwZGF0ZSgpO1xuXHRcdH0pKTtcblx0XHR0aGlzLmdldFNlc3Npb25zKCkuZm9yRWFjaChzZXNzaW9uID0+IHtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHNlc3Npb24ub25EaWRDaGFuZ2VOYW1lKCgpID0+IHRoaXMudXBkYXRlKCkpKTtcblx0XHR9KTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmRlYnVnU2VydmljZS5vbkRpZEVuZFNlc3Npb24oKCkgPT4gdGhpcy51cGRhdGUoKSkpO1xuXG5cdFx0Y29uc3Qgc2VsZWN0ZWRTZXNzaW9uID0gc2Vzc2lvbiA/IHRoaXMubWFwRm9jdXNlZFNlc3Npb25Ub1NlbGVjdGVkKHNlc3Npb24pIDogdW5kZWZpbmVkO1xuXHRcdHRoaXMudXBkYXRlKHNlbGVjdGVkU2Vzc2lvbik7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgZ2V0QWN0aW9uQ29udGV4dChfOiBzdHJpbmcsIGluZGV4OiBudW1iZXIpOiBJRGVidWdTZXNzaW9uIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRTZXNzaW9ucygpW2luZGV4XTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlKHNlc3Npb24/OiBJRGVidWdTZXNzaW9uKSB7XG5cdFx0aWYgKCFzZXNzaW9uKSB7XG5cdFx0XHRzZXNzaW9uID0gdGhpcy5nZXRTZWxlY3RlZFNlc3Npb24oKTtcblx0XHR9XG5cdFx0Y29uc3Qgc2Vzc2lvbnMgPSB0aGlzLmdldFNlc3Npb25zKCk7XG5cdFx0Y29uc3QgbmFtZXMgPSBzZXNzaW9ucy5tYXAocyA9PiB7XG5cdFx0XHRjb25zdCBsYWJlbCA9IHMuZ2V0TGFiZWwoKTtcblx0XHRcdGlmIChzLnBhcmVudFNlc3Npb24pIHtcblx0XHRcdFx0Ly8gSW5kZW50IGNoaWxkIHNlc3Npb25zIHNvIHRoZXkgbG9vayBsaWtlIGNoaWxkcmVuXG5cdFx0XHRcdHJldHVybiBgXFx1MDBBMFxcdTAwQTAke2xhYmVsfWA7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBsYWJlbDtcblx0XHR9KTtcblx0XHR0aGlzLnNldE9wdGlvbnMobmFtZXMubWFwKChkYXRhKTogSVNlbGVjdE9wdGlvbkl0ZW0gPT4gKHsgdGV4dDogZGF0YSB9KSksIHNlc3Npb24gPyBzZXNzaW9ucy5pbmRleE9mKHNlc3Npb24pIDogdW5kZWZpbmVkKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0U2VsZWN0ZWRTZXNzaW9uKCk6IElEZWJ1Z1Nlc3Npb24gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHNlc3Npb24gPSB0aGlzLmRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5mb2N1c2VkU2Vzc2lvbjtcblx0XHRyZXR1cm4gc2Vzc2lvbiA/IHRoaXMubWFwRm9jdXNlZFNlc3Npb25Ub1NlbGVjdGVkKHNlc3Npb24pIDogdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldFNlc3Npb25zKCk6IFJlYWRvbmx5QXJyYXk8SURlYnVnU2Vzc2lvbj4ge1xuXHRcdGNvbnN0IHNob3dTdWJTZXNzaW9ucyA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SURlYnVnQ29uZmlndXJhdGlvbj4oJ2RlYnVnJykuc2hvd1N1YlNlc3Npb25zSW5Ub29sQmFyO1xuXHRcdGNvbnN0IHNlc3Npb25zID0gdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKS5nZXRTZXNzaW9ucygpO1xuXG5cdFx0cmV0dXJuIHNob3dTdWJTZXNzaW9ucyA/IHNlc3Npb25zIDogc2Vzc2lvbnMuZmlsdGVyKHMgPT4gIXMucGFyZW50U2Vzc2lvbik7XG5cdH1cblxuXHRwcm90ZWN0ZWQgbWFwRm9jdXNlZFNlc3Npb25Ub1NlbGVjdGVkKGZvY3VzZWRTZXNzaW9uOiBJRGVidWdTZXNzaW9uKTogSURlYnVnU2Vzc2lvbiB7XG5cdFx0Y29uc3Qgc2hvd1N1YlNlc3Npb25zID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJRGVidWdDb25maWd1cmF0aW9uPignZGVidWcnKS5zaG93U3ViU2Vzc2lvbnNJblRvb2xCYXI7XG5cdFx0d2hpbGUgKGZvY3VzZWRTZXNzaW9uLnBhcmVudFNlc3Npb24gJiYgIXNob3dTdWJTZXNzaW9ucykge1xuXHRcdFx0Zm9jdXNlZFNlc3Npb24gPSBmb2N1c2VkU2Vzc2lvbi5wYXJlbnRTZXNzaW9uO1xuXHRcdH1cblx0XHRyZXR1cm4gZm9jdXNlZFNlc3Npb247XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBRXJCLFNBQVMsZUFBZTtBQUN4QixZQUFZLFNBQVM7QUFDckIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxpQkFBb0M7QUFDN0MsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxlQUFxRSxhQUFhO0FBQzNGLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsY0FBYyxrQkFBa0IscUJBQXFCO0FBQzlELFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsMEJBQTBCLHNCQUFzQjtBQUN6RCxTQUFzQixlQUFlO0FBQ3JDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsb0JBQWdELDRCQUE0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
