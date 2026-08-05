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
import { Event } from "../../../../../base/common/event.js";
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { isWindows } from "../../../../../base/common/platform.js";
import { Position } from "../../../../../editor/common/core/position.js";
import { localize2 } from "../../../../../nls.js";
import { AccessibleViewProviderId, IAccessibleViewService, NavigationType } from "../../../../../platform/accessibility/browser/accessibleView.js";
import { CONTEXT_ACCESSIBILITY_MODE_ENABLED } from "../../../../../platform/accessibility/common/accessibility.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { Action2, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { TerminalCapability } from "../../../../../platform/terminal/common/capabilities/capabilities.js";
import { TerminalSettingId } from "../../../../../platform/terminal/common/terminal.js";
import { accessibleViewCurrentProviderId, accessibleViewIsShown } from "../../../accessibility/browser/accessibilityConfiguration.js";
import { AccessibilityHelpAction, AccessibleViewAction } from "../../../accessibility/browser/accessibleViewActions.js";
import { ITerminalService } from "../../../terminal/browser/terminal.js";
import { registerTerminalAction } from "../../../terminal/browser/terminalActions.js";
import { registerTerminalContribution } from "../../../terminal/browser/terminalExtensions.js";
import { TerminalContextKeys } from "../../../terminal/common/terminalContextKey.js";
import { TerminalAccessibilityCommandId } from "../common/terminal.accessibility.js";
import { TerminalAccessibilitySettingId } from "../common/terminalAccessibilityConfiguration.js";
import { BufferContentTracker } from "./bufferContentTracker.js";
import { TerminalAccessibilityHelpProvider } from "./terminalAccessibilityHelp.js";
import { TerminalAccessibleBufferProvider } from "./terminalAccessibleBufferProvider.js";
import { TextAreaSyncAddon } from "./textAreaSyncAddon.js";
import { alert } from "../../../../../base/browser/ui/aria/aria.js";
let TextAreaSyncContribution = class extends DisposableStore {
  constructor(_ctx, _instantiationService) {
    super();
    this._ctx = _ctx;
    this._instantiationService = _instantiationService;
  }
  static get(instance) {
    return instance.getContribution(TextAreaSyncContribution.ID);
  }
  layout(xterm) {
    if (this._addon) {
      return;
    }
    this._addon = this.add(this._instantiationService.createInstance(TextAreaSyncAddon, this._ctx.instance.capabilities));
    xterm.raw.loadAddon(this._addon);
    this._addon.activate(xterm.raw);
  }
};
TextAreaSyncContribution.ID = "terminal.textAreaSync";
TextAreaSyncContribution = __decorateClass([
  __decorateParam(1, IInstantiationService)
], TextAreaSyncContribution);
registerTerminalContribution(TextAreaSyncContribution.ID, TextAreaSyncContribution);
let TerminalAccessibleViewContribution = class extends Disposable {
  constructor(_ctx, _accessibilitySignalService, _accessibleViewService, _configurationService, _contextKeyService, _instantiationService, _terminalService) {
    super();
    this._ctx = _ctx;
    this._accessibilitySignalService = _accessibilitySignalService;
    this._accessibleViewService = _accessibleViewService;
    this._configurationService = _configurationService;
    this._contextKeyService = _contextKeyService;
    this._instantiationService = _instantiationService;
    this._terminalService = _terminalService;
    this._onDidRunCommand = this._register(new MutableDisposable());
    this._register(AccessibleViewAction.addImplementation(90, "terminal", () => {
      if (this._terminalService.activeInstance !== this._ctx.instance) {
        return false;
      }
      this.show();
      return true;
    }, TerminalContextKeys.focus));
    this._register(this._ctx.instance.onDidExecuteText(() => {
      const focusAfterRun = _configurationService.getValue(TerminalSettingId.FocusAfterRun);
      if (focusAfterRun === "terminal") {
        this._ctx.instance.focus(true);
      } else if (focusAfterRun === "accessible-buffer") {
        this.show();
      }
    }));
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(TerminalAccessibilitySettingId.AccessibleViewFocusOnCommandExecution)) {
        this._updateCommandExecutedListener();
      }
    }));
    this._register(this._ctx.instance.capabilities.onDidAddCapability((e) => {
      if (e.capability.type === TerminalCapability.CommandDetection) {
        this._updateCommandExecutedListener();
      }
    }));
  }
  static get(instance) {
    return instance.getContribution(TerminalAccessibleViewContribution.ID);
  }
  xtermReady(xterm) {
    const addon = this._instantiationService.createInstance(TextAreaSyncAddon, this._ctx.instance.capabilities);
    xterm.raw.loadAddon(addon);
    addon.activate(xterm.raw);
    this._xterm = xterm;
    this._register(this._xterm.raw.onWriteParsed(async () => {
      if (this._terminalService.activeInstance !== this._ctx.instance) {
        return;
      }
      if (this._isTerminalAccessibleViewOpen() && this._xterm.raw.buffer.active.baseY === 0) {
        this.show();
      }
    }));
    const onRequestUpdateEditor = Event.latch(this._xterm.raw.onScroll);
    this._register(onRequestUpdateEditor(() => {
      if (this._terminalService.activeInstance !== this._ctx.instance) {
        return;
      }
      if (this._isTerminalAccessibleViewOpen()) {
        this.show();
      }
    }));
  }
  _updateCommandExecutedListener() {
    if (!this._ctx.instance.capabilities.has(TerminalCapability.CommandDetection)) {
      return;
    }
    if (!this._configurationService.getValue(TerminalAccessibilitySettingId.AccessibleViewFocusOnCommandExecution)) {
      this._onDidRunCommand.clear();
      return;
    } else if (this._onDidRunCommand.value) {
      return;
    }
    const capability = this._ctx.instance.capabilities.get(TerminalCapability.CommandDetection);
    this._onDidRunCommand.value = capability.onCommandExecuted(() => {
      if (this._ctx.instance.hasFocus) {
        this.show();
      }
    });
  }
  _isTerminalAccessibleViewOpen() {
    return accessibleViewCurrentProviderId.getValue(this._contextKeyService) === AccessibleViewProviderId.Terminal;
  }
  show() {
    if (!this._xterm) {
      return;
    }
    if (!this._bufferTracker) {
      this._bufferTracker = this._register(this._instantiationService.createInstance(BufferContentTracker, this._xterm));
    }
    if (!this._bufferProvider) {
      this._bufferProvider = this._register(this._instantiationService.createInstance(TerminalAccessibleBufferProvider, this._ctx.instance, this._bufferTracker, () => {
        return this._register(this._instantiationService.createInstance(TerminalAccessibilityHelpProvider, this._ctx.instance, this._xterm)).provideContent();
      }));
    }
    const position = this._configurationService.getValue(TerminalAccessibilitySettingId.AccessibleViewPreserveCursorPosition) ? this._accessibleViewService.getPosition(AccessibleViewProviderId.Terminal) : void 0;
    this._accessibleViewService.show(this._bufferProvider, position);
  }
  navigateToCommand(type) {
    const currentLine = this._accessibleViewService.getPosition(AccessibleViewProviderId.Terminal)?.lineNumber;
    const commands = this._getCommandsWithEditorLine();
    if (!commands?.length || !currentLine) {
      return;
    }
    const filteredCommands = type === NavigationType.Previous ? commands.filter((c) => c.lineNumber < currentLine).sort((a, b) => b.lineNumber - a.lineNumber) : commands.filter((c) => c.lineNumber > currentLine).sort((a, b) => a.lineNumber - b.lineNumber);
    if (!filteredCommands.length) {
      return;
    }
    const command = filteredCommands[0];
    const commandLine = command.command.command;
    if (!isWindows && commandLine) {
      this._accessibleViewService.setPosition(new Position(command.lineNumber, 1), true);
      alert(commandLine);
    } else {
      this._accessibleViewService.setPosition(new Position(command.lineNumber, 1), true, true);
    }
    if (command.exitCode) {
      this._accessibilitySignalService.playSignal(AccessibilitySignal.terminalCommandFailed);
    } else {
      this._accessibilitySignalService.playSignal(AccessibilitySignal.terminalCommandSucceeded);
    }
  }
  _getCommandsWithEditorLine() {
    const capability = this._ctx.instance.capabilities.get(TerminalCapability.CommandDetection);
    const commands = capability?.commands;
    const currentCommand = capability?.currentCommand;
    if (!commands?.length) {
      return;
    }
    const result = [];
    for (const command of commands) {
      const lineNumber = this._getEditorLineForCommand(command);
      if (!lineNumber) {
        continue;
      }
      result.push({ command, lineNumber, exitCode: command.exitCode });
    }
    if (currentCommand) {
      const lineNumber = this._getEditorLineForCommand(currentCommand);
      if (!!lineNumber) {
        result.push({ command: currentCommand, lineNumber });
      }
    }
    return result;
  }
  _getEditorLineForCommand(command) {
    if (!this._bufferTracker) {
      return;
    }
    let line;
    if ("marker" in command) {
      line = command.marker?.line;
    } else if ("commandStartMarker" in command) {
      line = command.commandStartMarker?.line;
    }
    if (line === void 0 || line < 0) {
      return;
    }
    line = this._bufferTracker.bufferToEditorLineMapping.get(line);
    if (line === void 0) {
      return;
    }
    return line + 1;
  }
};
TerminalAccessibleViewContribution.ID = "terminal.accessibleBufferProvider";
TerminalAccessibleViewContribution = __decorateClass([
  __decorateParam(1, IAccessibilitySignalService),
  __decorateParam(2, IAccessibleViewService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, ITerminalService)
], TerminalAccessibleViewContribution);
registerTerminalContribution(TerminalAccessibleViewContribution.ID, TerminalAccessibleViewContribution);
class TerminalAccessibilityHelpContribution extends Disposable {
  constructor() {
    super();
    this._register(AccessibilityHelpAction.addImplementation(105, "terminal", async (accessor) => {
      const instantiationService = accessor.get(IInstantiationService);
      const terminalService = accessor.get(ITerminalService);
      const accessibleViewService = accessor.get(IAccessibleViewService);
      const instance = await terminalService.getActiveOrCreateInstance();
      await terminalService.revealActiveTerminal();
      const terminal = instance?.xterm;
      if (!terminal) {
        return;
      }
      accessibleViewService.show(instantiationService.createInstance(TerminalAccessibilityHelpProvider, instance, terminal));
    }, ContextKeyExpr.or(TerminalContextKeys.focus, ContextKeyExpr.and(accessibleViewIsShown, ContextKeyExpr.equals(accessibleViewCurrentProviderId.key, AccessibleViewProviderId.Terminal)))));
  }
}
registerTerminalContribution(TerminalAccessibilityHelpContribution.ID, TerminalAccessibilityHelpContribution);
class FocusAccessibleBufferAction extends Action2 {
  constructor() {
    super({
      id: TerminalAccessibilityCommandId.FocusAccessibleBuffer,
      title: localize2("workbench.action.terminal.focusAccessibleBuffer", "Focus Accessible Terminal View"),
      precondition: ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated),
      keybinding: [
        {
          primary: KeyMod.Alt | KeyCode.F2,
          secondary: [KeyMod.CtrlCmd | KeyCode.UpArrow],
          linux: {
            primary: KeyMod.Alt | KeyCode.F2 | KeyMod.Shift,
            secondary: [KeyMod.CtrlCmd | KeyCode.UpArrow]
          },
          weight: KeybindingWeight.WorkbenchContrib,
          when: ContextKeyExpr.and(CONTEXT_ACCESSIBILITY_MODE_ENABLED, TerminalContextKeys.focus)
        }
      ]
    });
  }
  async run(accessor, ...args) {
    const terminalService = accessor.get(ITerminalService);
    const terminal = await terminalService.getActiveOrCreateInstance();
    if (!terminal?.xterm) {
      return;
    }
    TerminalAccessibleViewContribution.get(terminal)?.show();
  }
}
registerAction2(FocusAccessibleBufferAction);
registerTerminalAction({
  id: TerminalAccessibilityCommandId.AccessibleBufferGoToNextCommand,
  title: localize2("workbench.action.terminal.accessibleBufferGoToNextCommand", "Accessible Buffer Go to Next Command"),
  precondition: ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated, ContextKeyExpr.and(accessibleViewIsShown, ContextKeyExpr.equals(accessibleViewCurrentProviderId.key, AccessibleViewProviderId.Terminal))),
  keybinding: [
    {
      primary: KeyMod.Alt | KeyCode.DownArrow,
      when: ContextKeyExpr.and(ContextKeyExpr.and(accessibleViewIsShown, ContextKeyExpr.equals(accessibleViewCurrentProviderId.key, AccessibleViewProviderId.Terminal))),
      weight: KeybindingWeight.WorkbenchContrib + 2
    }
  ],
  run: async (c) => {
    const instance = c.service.activeInstance;
    if (!instance) {
      return;
    }
    TerminalAccessibleViewContribution.get(instance)?.navigateToCommand(NavigationType.Next);
  }
});
registerTerminalAction({
  id: TerminalAccessibilityCommandId.AccessibleBufferGoToPreviousCommand,
  title: localize2("workbench.action.terminal.accessibleBufferGoToPreviousCommand", "Accessible Buffer Go to Previous Command"),
  precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), ContextKeyExpr.and(accessibleViewIsShown, ContextKeyExpr.equals(accessibleViewCurrentProviderId.key, AccessibleViewProviderId.Terminal))),
  keybinding: [
    {
      primary: KeyMod.Alt | KeyCode.UpArrow,
      when: ContextKeyExpr.and(ContextKeyExpr.and(accessibleViewIsShown, ContextKeyExpr.equals(accessibleViewCurrentProviderId.key, AccessibleViewProviderId.Terminal))),
      weight: KeybindingWeight.WorkbenchContrib + 2
    }
  ],
  run: async (c) => {
    const instance = c.service.activeInstance;
    if (!instance) {
      return;
    }
    TerminalAccessibleViewContribution.get(instance)?.navigateToCommand(NavigationType.Previous);
  }
});
registerTerminalAction({
  id: TerminalAccessibilityCommandId.ScrollToBottomAccessibleView,
  title: localize2("workbench.action.terminal.scrollToBottomAccessibleView", "Scroll to Accessible View Bottom"),
  precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), ContextKeyExpr.and(accessibleViewIsShown, ContextKeyExpr.equals(accessibleViewCurrentProviderId.key, AccessibleViewProviderId.Terminal))),
  keybinding: {
    primary: KeyMod.CtrlCmd | KeyCode.End,
    linux: { primary: KeyMod.Shift | KeyCode.End },
    when: accessibleViewCurrentProviderId.isEqualTo(AccessibleViewProviderId.Terminal),
    weight: KeybindingWeight.WorkbenchContrib
  },
  run: (c, accessor) => {
    const accessibleViewService = accessor.get(IAccessibleViewService);
    const lastPosition = accessibleViewService.getLastPosition();
    if (!lastPosition) {
      return;
    }
    accessibleViewService.setPosition(lastPosition, true);
  }
});
registerTerminalAction({
  id: TerminalAccessibilityCommandId.ScrollToTopAccessibleView,
  title: localize2("workbench.action.terminal.scrollToTopAccessibleView", "Scroll to Accessible View Top"),
  precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), ContextKeyExpr.and(accessibleViewIsShown, ContextKeyExpr.equals(accessibleViewCurrentProviderId.key, AccessibleViewProviderId.Terminal))),
  keybinding: {
    primary: KeyMod.CtrlCmd | KeyCode.Home,
    linux: { primary: KeyMod.Shift | KeyCode.Home },
    when: accessibleViewCurrentProviderId.isEqualTo(AccessibleViewProviderId.Terminal),
    weight: KeybindingWeight.WorkbenchContrib
  },
  run: (c, accessor) => accessor.get(IAccessibleViewService)?.setPosition(new Position(1, 1), true)
});
export {
  TerminalAccessibilityHelpContribution,
  TerminalAccessibleViewContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvYWNjZXNzaWJpbGl0eS9icm93c2VyL3Rlcm1pbmFsLmFjY2Vzc2liaWxpdHkuY29udHJpYnV0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHR5cGUgeyBUZXJtaW5hbCB9IGZyb20gJ0B4dGVybS94dGVybSc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgTXV0YWJsZURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgaXNXaW5kb3dzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgbG9jYWxpemUyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IEFjY2Vzc2libGVWaWV3UHJvdmlkZXJJZCwgSUFjY2Vzc2libGVWaWV3U2VydmljZSwgTmF2aWdhdGlvblR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5L2Jyb3dzZXIvYWNjZXNzaWJsZVZpZXcuanMnO1xuaW1wb3J0IHsgQ09OVEVYVF9BQ0NFU1NJQklMSVRZX01PREVfRU5BQkxFRCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvY29tbW9uL2FjY2Vzc2liaWxpdHkuanMnO1xuaW1wb3J0IHsgQWNjZXNzaWJpbGl0eVNpZ25hbCwgSUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eVNpZ25hbC9icm93c2VyL2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEFjdGlvbjIsIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElUZXJtaW5hbENvbW1hbmQsIFRlcm1pbmFsQ2FwYWJpbGl0eSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi9jYXBhYmlsaXRpZXMvY2FwYWJpbGl0aWVzLmpzJztcbmltcG9ydCB7IElDdXJyZW50UGFydGlhbENvbW1hbmQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vY2FwYWJpbGl0aWVzL2NvbW1hbmREZXRlY3Rpb24vdGVybWluYWxDb21tYW5kLmpzJztcbmltcG9ydCB7IFRlcm1pbmFsU2V0dGluZ0lkIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IGFjY2Vzc2libGVWaWV3Q3VycmVudFByb3ZpZGVySWQsIGFjY2Vzc2libGVWaWV3SXNTaG93biB9IGZyb20gJy4uLy4uLy4uL2FjY2Vzc2liaWxpdHkvYnJvd3Nlci9hY2Nlc3NpYmlsaXR5Q29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBBY2Nlc3NpYmlsaXR5SGVscEFjdGlvbiwgQWNjZXNzaWJsZVZpZXdBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi9hY2Nlc3NpYmlsaXR5L2Jyb3dzZXIvYWNjZXNzaWJsZVZpZXdBY3Rpb25zLmpzJztcbmltcG9ydCB7IElUZXJtaW5hbENvbnRyaWJ1dGlvbiwgSVRlcm1pbmFsSW5zdGFuY2UsIElUZXJtaW5hbFNlcnZpY2UsIElYdGVybVRlcm1pbmFsIH0gZnJvbSAnLi4vLi4vLi4vdGVybWluYWwvYnJvd3Nlci90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyByZWdpc3RlclRlcm1pbmFsQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vdGVybWluYWwvYnJvd3Nlci90ZXJtaW5hbEFjdGlvbnMuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJUZXJtaW5hbENvbnRyaWJ1dGlvbiwgdHlwZSBJVGVybWluYWxDb250cmlidXRpb25Db250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vdGVybWluYWwvYnJvd3Nlci90ZXJtaW5hbEV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgVGVybWluYWxDb250ZXh0S2V5cyB9IGZyb20gJy4uLy4uLy4uL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbENvbnRleHRLZXkuanMnO1xuaW1wb3J0IHsgVGVybWluYWxBY2Nlc3NpYmlsaXR5Q29tbWFuZElkIH0gZnJvbSAnLi4vY29tbW9uL3Rlcm1pbmFsLmFjY2Vzc2liaWxpdHkuanMnO1xuaW1wb3J0IHsgVGVybWluYWxBY2Nlc3NpYmlsaXR5U2V0dGluZ0lkIH0gZnJvbSAnLi4vY29tbW9uL3Rlcm1pbmFsQWNjZXNzaWJpbGl0eUNvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgQnVmZmVyQ29udGVudFRyYWNrZXIgfSBmcm9tICcuL2J1ZmZlckNvbnRlbnRUcmFja2VyLmpzJztcbmltcG9ydCB7IFRlcm1pbmFsQWNjZXNzaWJpbGl0eUhlbHBQcm92aWRlciB9IGZyb20gJy4vdGVybWluYWxBY2Nlc3NpYmlsaXR5SGVscC5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFdpdGhFZGl0b3JMaW5lLCBUZXJtaW5hbEFjY2Vzc2libGVCdWZmZXJQcm92aWRlciB9IGZyb20gJy4vdGVybWluYWxBY2Nlc3NpYmxlQnVmZmVyUHJvdmlkZXIuanMnO1xuaW1wb3J0IHsgVGV4dEFyZWFTeW5jQWRkb24gfSBmcm9tICcuL3RleHRBcmVhU3luY0FkZG9uLmpzJztcbmltcG9ydCB7IGFsZXJ0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FyaWEvYXJpYS5qcyc7XG5cbi8vICNyZWdpb24gVGVybWluYWwgQ29udHJpYnV0aW9uc1xuXG5jbGFzcyBUZXh0QXJlYVN5bmNDb250cmlidXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlU3RvcmUgaW1wbGVtZW50cyBJVGVybWluYWxDb250cmlidXRpb24ge1xuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAndGVybWluYWwudGV4dEFyZWFTeW5jJztcblx0c3RhdGljIGdldChpbnN0YW5jZTogSVRlcm1pbmFsSW5zdGFuY2UpOiBUZXh0QXJlYVN5bmNDb250cmlidXRpb24gfCBudWxsIHtcblx0XHRyZXR1cm4gaW5zdGFuY2UuZ2V0Q29udHJpYnV0aW9uPFRleHRBcmVhU3luY0NvbnRyaWJ1dGlvbj4oVGV4dEFyZWFTeW5jQ29udHJpYnV0aW9uLklEKTtcblx0fVxuXHRwcml2YXRlIF9hZGRvbjogVGV4dEFyZWFTeW5jQWRkb24gfCB1bmRlZmluZWQ7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2N0eDogSVRlcm1pbmFsQ29udHJpYnV0aW9uQ29udGV4dCxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblx0bGF5b3V0KHh0ZXJtOiBJWHRlcm1UZXJtaW5hbCAmIHsgcmF3OiBUZXJtaW5hbCB9KTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2FkZG9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX2FkZG9uID0gdGhpcy5hZGQodGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGV4dEFyZWFTeW5jQWRkb24sIHRoaXMuX2N0eC5pbnN0YW5jZS5jYXBhYmlsaXRpZXMpKTtcblx0XHR4dGVybS5yYXcubG9hZEFkZG9uKHRoaXMuX2FkZG9uKTtcblx0XHR0aGlzLl9hZGRvbi5hY3RpdmF0ZSh4dGVybS5yYXcpO1xuXHR9XG59XG5yZWdpc3RlclRlcm1pbmFsQ29udHJpYnV0aW9uKFRleHRBcmVhU3luY0NvbnRyaWJ1dGlvbi5JRCwgVGV4dEFyZWFTeW5jQ29udHJpYnV0aW9uKTtcblxuZXhwb3J0IGNsYXNzIFRlcm1pbmFsQWNjZXNzaWJsZVZpZXdDb250cmlidXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVRlcm1pbmFsQ29udHJpYnV0aW9uIHtcblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3Rlcm1pbmFsLmFjY2Vzc2libGVCdWZmZXJQcm92aWRlcic7XG5cdHN0YXRpYyBnZXQoaW5zdGFuY2U6IElUZXJtaW5hbEluc3RhbmNlKTogVGVybWluYWxBY2Nlc3NpYmxlVmlld0NvbnRyaWJ1dGlvbiB8IG51bGwge1xuXHRcdHJldHVybiBpbnN0YW5jZS5nZXRDb250cmlidXRpb248VGVybWluYWxBY2Nlc3NpYmxlVmlld0NvbnRyaWJ1dGlvbj4oVGVybWluYWxBY2Nlc3NpYmxlVmlld0NvbnRyaWJ1dGlvbi5JRCk7XG5cdH1cblx0cHJpdmF0ZSBfYnVmZmVyVHJhY2tlcjogQnVmZmVyQ29udGVudFRyYWNrZXIgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2J1ZmZlclByb3ZpZGVyOiBUZXJtaW5hbEFjY2Vzc2libGVCdWZmZXJQcm92aWRlciB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfeHRlcm06IFBpY2s8SVh0ZXJtVGVybWluYWwsICdzaGVsbEludGVncmF0aW9uJyB8ICdnZXRGb250Jz4gJiB7IHJhdzogVGVybWluYWwgfSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSdW5Db21tYW5kID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2N0eDogSVRlcm1pbmFsQ29udHJpYnV0aW9uQ29udGV4dCxcblx0XHRASUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlOiBJQWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UsXG5cdFx0QElBY2Nlc3NpYmxlVmlld1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfYWNjZXNzaWJsZVZpZXdTZXJ2aWNlOiBJQWNjZXNzaWJsZVZpZXdTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGVybWluYWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsU2VydmljZTogSVRlcm1pbmFsU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9yZWdpc3RlcihBY2Nlc3NpYmxlVmlld0FjdGlvbi5hZGRJbXBsZW1lbnRhdGlvbig5MCwgJ3Rlcm1pbmFsJywgKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuX3Rlcm1pbmFsU2VydmljZS5hY3RpdmVJbnN0YW5jZSAhPT0gdGhpcy5fY3R4Lmluc3RhbmNlKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHRoaXMuc2hvdygpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSwgVGVybWluYWxDb250ZXh0S2V5cy5mb2N1cykpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2N0eC5pbnN0YW5jZS5vbkRpZEV4ZWN1dGVUZXh0KCgpID0+IHtcblx0XHRcdGNvbnN0IGZvY3VzQWZ0ZXJSdW4gPSBfY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoVGVybWluYWxTZXR0aW5nSWQuRm9jdXNBZnRlclJ1bik7XG5cdFx0XHRpZiAoZm9jdXNBZnRlclJ1biA9PT0gJ3Rlcm1pbmFsJykge1xuXHRcdFx0XHR0aGlzLl9jdHguaW5zdGFuY2UuZm9jdXModHJ1ZSk7XG5cdFx0XHR9IGVsc2UgaWYgKGZvY3VzQWZ0ZXJSdW4gPT09ICdhY2Nlc3NpYmxlLWJ1ZmZlcicpIHtcblx0XHRcdFx0dGhpcy5zaG93KCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKFRlcm1pbmFsQWNjZXNzaWJpbGl0eVNldHRpbmdJZC5BY2Nlc3NpYmxlVmlld0ZvY3VzT25Db21tYW5kRXhlY3V0aW9uKSkge1xuXHRcdFx0XHR0aGlzLl91cGRhdGVDb21tYW5kRXhlY3V0ZWRMaXN0ZW5lcigpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9jdHguaW5zdGFuY2UuY2FwYWJpbGl0aWVzLm9uRGlkQWRkQ2FwYWJpbGl0eShlID0+IHtcblx0XHRcdGlmIChlLmNhcGFiaWxpdHkudHlwZSA9PT0gVGVybWluYWxDYXBhYmlsaXR5LkNvbW1hbmREZXRlY3Rpb24pIHtcblx0XHRcdFx0dGhpcy5fdXBkYXRlQ29tbWFuZEV4ZWN1dGVkTGlzdGVuZXIoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHR4dGVybVJlYWR5KHh0ZXJtOiBJWHRlcm1UZXJtaW5hbCAmIHsgcmF3OiBUZXJtaW5hbCB9KTogdm9pZCB7XG5cdFx0Y29uc3QgYWRkb24gPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXh0QXJlYVN5bmNBZGRvbiwgdGhpcy5fY3R4Lmluc3RhbmNlLmNhcGFiaWxpdGllcyk7XG5cdFx0eHRlcm0ucmF3LmxvYWRBZGRvbihhZGRvbik7XG5cdFx0YWRkb24uYWN0aXZhdGUoeHRlcm0ucmF3KTtcblx0XHR0aGlzLl94dGVybSA9IHh0ZXJtO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3h0ZXJtLnJhdy5vbldyaXRlUGFyc2VkKGFzeW5jICgpID0+IHtcblx0XHRcdGlmICh0aGlzLl90ZXJtaW5hbFNlcnZpY2UuYWN0aXZlSW5zdGFuY2UgIT09IHRoaXMuX2N0eC5pbnN0YW5jZSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5faXNUZXJtaW5hbEFjY2Vzc2libGVWaWV3T3BlbigpICYmIHRoaXMuX3h0ZXJtIS5yYXcuYnVmZmVyLmFjdGl2ZS5iYXNlWSA9PT0gMCkge1xuXHRcdFx0XHR0aGlzLnNob3coKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRjb25zdCBvblJlcXVlc3RVcGRhdGVFZGl0b3IgPSBFdmVudC5sYXRjaCh0aGlzLl94dGVybS5yYXcub25TY3JvbGwpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKG9uUmVxdWVzdFVwZGF0ZUVkaXRvcigoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fdGVybWluYWxTZXJ2aWNlLmFjdGl2ZUluc3RhbmNlICE9PSB0aGlzLl9jdHguaW5zdGFuY2UpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRoaXMuX2lzVGVybWluYWxBY2Nlc3NpYmxlVmlld09wZW4oKSkge1xuXHRcdFx0XHR0aGlzLnNob3coKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVDb21tYW5kRXhlY3V0ZWRMaXN0ZW5lcigpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX2N0eC5pbnN0YW5jZS5jYXBhYmlsaXRpZXMuaGFzKFRlcm1pbmFsQ2FwYWJpbGl0eS5Db21tYW5kRGV0ZWN0aW9uKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoIXRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKFRlcm1pbmFsQWNjZXNzaWJpbGl0eVNldHRpbmdJZC5BY2Nlc3NpYmxlVmlld0ZvY3VzT25Db21tYW5kRXhlY3V0aW9uKSkge1xuXHRcdFx0dGhpcy5fb25EaWRSdW5Db21tYW5kLmNsZWFyKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fSBlbHNlIGlmICh0aGlzLl9vbkRpZFJ1bkNvbW1hbmQudmFsdWUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBjYXBhYmlsaXR5ID0gdGhpcy5fY3R4Lmluc3RhbmNlLmNhcGFiaWxpdGllcy5nZXQoVGVybWluYWxDYXBhYmlsaXR5LkNvbW1hbmREZXRlY3Rpb24pITtcblx0XHR0aGlzLl9vbkRpZFJ1bkNvbW1hbmQudmFsdWUgPSBjYXBhYmlsaXR5Lm9uQ29tbWFuZEV4ZWN1dGVkKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLl9jdHguaW5zdGFuY2UuaGFzRm9jdXMpIHtcblx0XHRcdFx0dGhpcy5zaG93KCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9pc1Rlcm1pbmFsQWNjZXNzaWJsZVZpZXdPcGVuKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBhY2Nlc3NpYmxlVmlld0N1cnJlbnRQcm92aWRlcklkLmdldFZhbHVlKHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKSA9PT0gQWNjZXNzaWJsZVZpZXdQcm92aWRlcklkLlRlcm1pbmFsO1xuXHR9XG5cblx0c2hvdygpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX3h0ZXJtKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICghdGhpcy5fYnVmZmVyVHJhY2tlcikge1xuXHRcdFx0dGhpcy5fYnVmZmVyVHJhY2tlciA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEJ1ZmZlckNvbnRlbnRUcmFja2VyLCB0aGlzLl94dGVybSkpO1xuXHRcdH1cblx0XHRpZiAoIXRoaXMuX2J1ZmZlclByb3ZpZGVyKSB7XG5cdFx0XHR0aGlzLl9idWZmZXJQcm92aWRlciA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlcm1pbmFsQWNjZXNzaWJsZUJ1ZmZlclByb3ZpZGVyLCB0aGlzLl9jdHguaW5zdGFuY2UsIHRoaXMuX2J1ZmZlclRyYWNrZXIsICgpID0+IHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlcm1pbmFsQWNjZXNzaWJpbGl0eUhlbHBQcm92aWRlciwgdGhpcy5fY3R4Lmluc3RhbmNlLCB0aGlzLl94dGVybSEpKS5wcm92aWRlQ29udGVudCgpO1xuXHRcdFx0fSkpO1xuXHRcdH1cblx0XHRjb25zdCBwb3NpdGlvbiA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKFRlcm1pbmFsQWNjZXNzaWJpbGl0eVNldHRpbmdJZC5BY2Nlc3NpYmxlVmlld1ByZXNlcnZlQ3Vyc29yUG9zaXRpb24pID8gdGhpcy5fYWNjZXNzaWJsZVZpZXdTZXJ2aWNlLmdldFBvc2l0aW9uKEFjY2Vzc2libGVWaWV3UHJvdmlkZXJJZC5UZXJtaW5hbCkgOiB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fYWNjZXNzaWJsZVZpZXdTZXJ2aWNlLnNob3codGhpcy5fYnVmZmVyUHJvdmlkZXIsIHBvc2l0aW9uKTtcblx0fVxuXHRuYXZpZ2F0ZVRvQ29tbWFuZCh0eXBlOiBOYXZpZ2F0aW9uVHlwZSk6IHZvaWQge1xuXHRcdGNvbnN0IGN1cnJlbnRMaW5lID0gdGhpcy5fYWNjZXNzaWJsZVZpZXdTZXJ2aWNlLmdldFBvc2l0aW9uKEFjY2Vzc2libGVWaWV3UHJvdmlkZXJJZC5UZXJtaW5hbCk/LmxpbmVOdW1iZXI7XG5cdFx0Y29uc3QgY29tbWFuZHMgPSB0aGlzLl9nZXRDb21tYW5kc1dpdGhFZGl0b3JMaW5lKCk7XG5cdFx0aWYgKCFjb21tYW5kcz8ubGVuZ3RoIHx8ICFjdXJyZW50TGluZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZpbHRlcmVkQ29tbWFuZHMgPSB0eXBlID09PSBOYXZpZ2F0aW9uVHlwZS5QcmV2aW91cyA/IGNvbW1hbmRzLmZpbHRlcihjID0+IGMubGluZU51bWJlciA8IGN1cnJlbnRMaW5lKS5zb3J0KChhLCBiKSA9PiBiLmxpbmVOdW1iZXIgLSBhLmxpbmVOdW1iZXIpIDogY29tbWFuZHMuZmlsdGVyKGMgPT4gYy5saW5lTnVtYmVyID4gY3VycmVudExpbmUpLnNvcnQoKGEsIGIpID0+IGEubGluZU51bWJlciAtIGIubGluZU51bWJlcik7XG5cdFx0aWYgKCFmaWx0ZXJlZENvbW1hbmRzLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBjb21tYW5kID0gZmlsdGVyZWRDb21tYW5kc1swXTtcblx0XHRjb25zdCBjb21tYW5kTGluZSA9IGNvbW1hbmQuY29tbWFuZC5jb21tYW5kO1xuXHRcdGlmICghaXNXaW5kb3dzICYmIGNvbW1hbmRMaW5lKSB7XG5cdFx0XHR0aGlzLl9hY2Nlc3NpYmxlVmlld1NlcnZpY2Uuc2V0UG9zaXRpb24obmV3IFBvc2l0aW9uKGNvbW1hbmQubGluZU51bWJlciwgMSksIHRydWUpO1xuXHRcdFx0YWxlcnQoY29tbWFuZExpbmUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9hY2Nlc3NpYmxlVmlld1NlcnZpY2Uuc2V0UG9zaXRpb24obmV3IFBvc2l0aW9uKGNvbW1hbmQubGluZU51bWJlciwgMSksIHRydWUsIHRydWUpO1xuXHRcdH1cblxuXHRcdGlmIChjb21tYW5kLmV4aXRDb2RlKSB7XG5cdFx0XHR0aGlzLl9hY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZS5wbGF5U2lnbmFsKEFjY2Vzc2liaWxpdHlTaWduYWwudGVybWluYWxDb21tYW5kRmFpbGVkKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fYWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UucGxheVNpZ25hbChBY2Nlc3NpYmlsaXR5U2lnbmFsLnRlcm1pbmFsQ29tbWFuZFN1Y2NlZWRlZCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0Q29tbWFuZHNXaXRoRWRpdG9yTGluZSgpOiBJQ29tbWFuZFdpdGhFZGl0b3JMaW5lW10gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGNhcGFiaWxpdHkgPSB0aGlzLl9jdHguaW5zdGFuY2UuY2FwYWJpbGl0aWVzLmdldChUZXJtaW5hbENhcGFiaWxpdHkuQ29tbWFuZERldGVjdGlvbik7XG5cdFx0Y29uc3QgY29tbWFuZHMgPSBjYXBhYmlsaXR5Py5jb21tYW5kcztcblx0XHRjb25zdCBjdXJyZW50Q29tbWFuZCA9IGNhcGFiaWxpdHk/LmN1cnJlbnRDb21tYW5kO1xuXHRcdGlmICghY29tbWFuZHM/Lmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCByZXN1bHQ6IElDb21tYW5kV2l0aEVkaXRvckxpbmVbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgY29tbWFuZCBvZiBjb21tYW5kcykge1xuXHRcdFx0Y29uc3QgbGluZU51bWJlciA9IHRoaXMuX2dldEVkaXRvckxpbmVGb3JDb21tYW5kKGNvbW1hbmQpO1xuXHRcdFx0aWYgKCFsaW5lTnVtYmVyKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0cmVzdWx0LnB1c2goeyBjb21tYW5kLCBsaW5lTnVtYmVyLCBleGl0Q29kZTogY29tbWFuZC5leGl0Q29kZSB9KTtcblx0XHR9XG5cdFx0aWYgKGN1cnJlbnRDb21tYW5kKSB7XG5cdFx0XHRjb25zdCBsaW5lTnVtYmVyID0gdGhpcy5fZ2V0RWRpdG9yTGluZUZvckNvbW1hbmQoY3VycmVudENvbW1hbmQpO1xuXHRcdFx0aWYgKCEhbGluZU51bWJlcikge1xuXHRcdFx0XHRyZXN1bHQucHVzaCh7IGNvbW1hbmQ6IGN1cnJlbnRDb21tYW5kLCBsaW5lTnVtYmVyIH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0RWRpdG9yTGluZUZvckNvbW1hbmQoY29tbWFuZDogSVRlcm1pbmFsQ29tbWFuZCB8IElDdXJyZW50UGFydGlhbENvbW1hbmQpOiBudW1iZXIgfCB1bmRlZmluZWQge1xuXHRcdGlmICghdGhpcy5fYnVmZmVyVHJhY2tlcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRsZXQgbGluZTogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRcdGlmICgnbWFya2VyJyBpbiBjb21tYW5kKSB7XG5cdFx0XHRsaW5lID0gY29tbWFuZC5tYXJrZXI/LmxpbmU7XG5cdFx0fSBlbHNlIGlmICgnY29tbWFuZFN0YXJ0TWFya2VyJyBpbiBjb21tYW5kKSB7XG5cdFx0XHRsaW5lID0gY29tbWFuZC5jb21tYW5kU3RhcnRNYXJrZXI/LmxpbmU7XG5cdFx0fVxuXHRcdGlmIChsaW5lID09PSB1bmRlZmluZWQgfHwgbGluZSA8IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0bGluZSA9IHRoaXMuX2J1ZmZlclRyYWNrZXIuYnVmZmVyVG9FZGl0b3JMaW5lTWFwcGluZy5nZXQobGluZSk7XG5cdFx0aWYgKGxpbmUgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRyZXR1cm4gbGluZSArIDE7XG5cdH1cblxufVxucmVnaXN0ZXJUZXJtaW5hbENvbnRyaWJ1dGlvbihUZXJtaW5hbEFjY2Vzc2libGVWaWV3Q29udHJpYnV0aW9uLklELCBUZXJtaW5hbEFjY2Vzc2libGVWaWV3Q29udHJpYnV0aW9uKTtcblxuZXhwb3J0IGNsYXNzIFRlcm1pbmFsQWNjZXNzaWJpbGl0eUhlbHBDb250cmlidXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0c3RhdGljIElEOiAndGVybWluYWxBY2Nlc3NpYmlsaXR5SGVscENvbnRyaWJ1dGlvbic7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihBY2Nlc3NpYmlsaXR5SGVscEFjdGlvbi5hZGRJbXBsZW1lbnRhdGlvbigxMDUsICd0ZXJtaW5hbCcsIGFzeW5jIGFjY2Vzc29yID0+IHtcblx0XHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElJbnN0YW50aWF0aW9uU2VydmljZSk7XG5cdFx0XHRjb25zdCB0ZXJtaW5hbFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVRlcm1pbmFsU2VydmljZSk7XG5cdFx0XHRjb25zdCBhY2Nlc3NpYmxlVmlld1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUFjY2Vzc2libGVWaWV3U2VydmljZSk7XG5cdFx0XHRjb25zdCBpbnN0YW5jZSA9IGF3YWl0IHRlcm1pbmFsU2VydmljZS5nZXRBY3RpdmVPckNyZWF0ZUluc3RhbmNlKCk7XG5cdFx0XHRhd2FpdCB0ZXJtaW5hbFNlcnZpY2UucmV2ZWFsQWN0aXZlVGVybWluYWwoKTtcblx0XHRcdGNvbnN0IHRlcm1pbmFsID0gaW5zdGFuY2U/Lnh0ZXJtO1xuXHRcdFx0aWYgKCF0ZXJtaW5hbCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRhY2Nlc3NpYmxlVmlld1NlcnZpY2Uuc2hvdyhpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbEFjY2Vzc2liaWxpdHlIZWxwUHJvdmlkZXIsIGluc3RhbmNlLCB0ZXJtaW5hbCkpO1xuXHRcdH0sIENvbnRleHRLZXlFeHByLm9yKFRlcm1pbmFsQ29udGV4dEtleXMuZm9jdXMsIENvbnRleHRLZXlFeHByLmFuZChhY2Nlc3NpYmxlVmlld0lzU2hvd24sIENvbnRleHRLZXlFeHByLmVxdWFscyhhY2Nlc3NpYmxlVmlld0N1cnJlbnRQcm92aWRlcklkLmtleSwgQWNjZXNzaWJsZVZpZXdQcm92aWRlcklkLlRlcm1pbmFsKSkpKSk7XG5cdH1cbn1cbnJlZ2lzdGVyVGVybWluYWxDb250cmlidXRpb24oVGVybWluYWxBY2Nlc3NpYmlsaXR5SGVscENvbnRyaWJ1dGlvbi5JRCwgVGVybWluYWxBY2Nlc3NpYmlsaXR5SGVscENvbnRyaWJ1dGlvbik7XG5cbi8vICNlbmRyZWdpb25cblxuLy8gI3JlZ2lvbiBBY3Rpb25zXG5cbmNsYXNzIEZvY3VzQWNjZXNzaWJsZUJ1ZmZlckFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogVGVybWluYWxBY2Nlc3NpYmlsaXR5Q29tbWFuZElkLkZvY3VzQWNjZXNzaWJsZUJ1ZmZlcixcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuZm9jdXNBY2Nlc3NpYmxlQnVmZmVyJywgXCJGb2N1cyBBY2Nlc3NpYmxlIFRlcm1pbmFsIFZpZXdcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLm9yKFRlcm1pbmFsQ29udGV4dEtleXMucHJvY2Vzc1N1cHBvcnRlZCwgVGVybWluYWxDb250ZXh0S2V5cy50ZXJtaW5hbEhhc0JlZW5DcmVhdGVkKSxcblx0XHRcdGtleWJpbmRpbmc6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5BbHQgfCBLZXlDb2RlLkYyLFxuXHRcdFx0XHRcdHNlY29uZGFyeTogW0tleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5VcEFycm93XSxcblx0XHRcdFx0XHRsaW51eDoge1xuXHRcdFx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkFsdCB8IEtleUNvZGUuRjIgfCBLZXlNb2QuU2hpZnQsXG5cdFx0XHRcdFx0XHRzZWNvbmRhcnk6IFtLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuVXBBcnJvd11cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX0FDQ0VTU0lCSUxJVFlfTU9ERV9FTkFCTEVELCBUZXJtaW5hbENvbnRleHRLZXlzLmZvY3VzKVxuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fSk7XG5cdH1cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHRlcm1pbmFsU2VydmljZSA9IGFjY2Vzc29yLmdldChJVGVybWluYWxTZXJ2aWNlKTtcblx0XHRjb25zdCB0ZXJtaW5hbCA9IGF3YWl0IHRlcm1pbmFsU2VydmljZS5nZXRBY3RpdmVPckNyZWF0ZUluc3RhbmNlKCk7XG5cdFx0aWYgKCF0ZXJtaW5hbD8ueHRlcm0pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0VGVybWluYWxBY2Nlc3NpYmxlVmlld0NvbnRyaWJ1dGlvbi5nZXQodGVybWluYWwpPy5zaG93KCk7XG5cdH1cbn1cbnJlZ2lzdGVyQWN0aW9uMihGb2N1c0FjY2Vzc2libGVCdWZmZXJBY3Rpb24pO1xuXG5yZWdpc3RlclRlcm1pbmFsQWN0aW9uKHtcblx0aWQ6IFRlcm1pbmFsQWNjZXNzaWJpbGl0eUNvbW1hbmRJZC5BY2Nlc3NpYmxlQnVmZmVyR29Ub05leHRDb21tYW5kLFxuXHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLmFjY2Vzc2libGVCdWZmZXJHb1RvTmV4dENvbW1hbmQnLCBcIkFjY2Vzc2libGUgQnVmZmVyIEdvIHRvIE5leHQgQ29tbWFuZFwiKSxcblx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5vcihUZXJtaW5hbENvbnRleHRLZXlzLnByb2Nlc3NTdXBwb3J0ZWQsIFRlcm1pbmFsQ29udGV4dEtleXMudGVybWluYWxIYXNCZWVuQ3JlYXRlZCwgQ29udGV4dEtleUV4cHIuYW5kKGFjY2Vzc2libGVWaWV3SXNTaG93biwgQ29udGV4dEtleUV4cHIuZXF1YWxzKGFjY2Vzc2libGVWaWV3Q3VycmVudFByb3ZpZGVySWQua2V5LCBBY2Nlc3NpYmxlVmlld1Byb3ZpZGVySWQuVGVybWluYWwpKSksXG5cdGtleWJpbmRpbmc6IFtcblx0XHR7XG5cdFx0XHRwcmltYXJ5OiBLZXlNb2QuQWx0IHwgS2V5Q29kZS5Eb3duQXJyb3csXG5cdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIuYW5kKGFjY2Vzc2libGVWaWV3SXNTaG93biwgQ29udGV4dEtleUV4cHIuZXF1YWxzKGFjY2Vzc2libGVWaWV3Q3VycmVudFByb3ZpZGVySWQua2V5LCBBY2Nlc3NpYmxlVmlld1Byb3ZpZGVySWQuVGVybWluYWwpKSksXG5cdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYiArIDJcblx0XHR9XG5cdF0sXG5cdHJ1bjogYXN5bmMgKGMpID0+IHtcblx0XHRjb25zdCBpbnN0YW5jZSA9IGMuc2VydmljZS5hY3RpdmVJbnN0YW5jZTtcblx0XHRpZiAoIWluc3RhbmNlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdFRlcm1pbmFsQWNjZXNzaWJsZVZpZXdDb250cmlidXRpb24uZ2V0KGluc3RhbmNlKT8ubmF2aWdhdGVUb0NvbW1hbmQoTmF2aWdhdGlvblR5cGUuTmV4dCk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlclRlcm1pbmFsQWN0aW9uKHtcblx0aWQ6IFRlcm1pbmFsQWNjZXNzaWJpbGl0eUNvbW1hbmRJZC5BY2Nlc3NpYmxlQnVmZmVyR29Ub1ByZXZpb3VzQ29tbWFuZCxcblx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5hY2Nlc3NpYmxlQnVmZmVyR29Ub1ByZXZpb3VzQ29tbWFuZCcsIFwiQWNjZXNzaWJsZSBCdWZmZXIgR28gdG8gUHJldmlvdXMgQ29tbWFuZFwiKSxcblx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIub3IoVGVybWluYWxDb250ZXh0S2V5cy5wcm9jZXNzU3VwcG9ydGVkLCBUZXJtaW5hbENvbnRleHRLZXlzLnRlcm1pbmFsSGFzQmVlbkNyZWF0ZWQpLCBDb250ZXh0S2V5RXhwci5hbmQoYWNjZXNzaWJsZVZpZXdJc1Nob3duLCBDb250ZXh0S2V5RXhwci5lcXVhbHMoYWNjZXNzaWJsZVZpZXdDdXJyZW50UHJvdmlkZXJJZC5rZXksIEFjY2Vzc2libGVWaWV3UHJvdmlkZXJJZC5UZXJtaW5hbCkpKSxcblx0a2V5YmluZGluZzogW1xuXHRcdHtcblx0XHRcdHByaW1hcnk6IEtleU1vZC5BbHQgfCBLZXlDb2RlLlVwQXJyb3csXG5cdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIuYW5kKGFjY2Vzc2libGVWaWV3SXNTaG93biwgQ29udGV4dEtleUV4cHIuZXF1YWxzKGFjY2Vzc2libGVWaWV3Q3VycmVudFByb3ZpZGVySWQua2V5LCBBY2Nlc3NpYmxlVmlld1Byb3ZpZGVySWQuVGVybWluYWwpKSksXG5cdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYiArIDJcblx0XHR9XG5cdF0sXG5cdHJ1bjogYXN5bmMgKGMpID0+IHtcblx0XHRjb25zdCBpbnN0YW5jZSA9IGMuc2VydmljZS5hY3RpdmVJbnN0YW5jZTtcblx0XHRpZiAoIWluc3RhbmNlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdFRlcm1pbmFsQWNjZXNzaWJsZVZpZXdDb250cmlidXRpb24uZ2V0KGluc3RhbmNlKT8ubmF2aWdhdGVUb0NvbW1hbmQoTmF2aWdhdGlvblR5cGUuUHJldmlvdXMpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJUZXJtaW5hbEFjdGlvbih7XG5cdGlkOiBUZXJtaW5hbEFjY2Vzc2liaWxpdHlDb21tYW5kSWQuU2Nyb2xsVG9Cb3R0b21BY2Nlc3NpYmxlVmlldyxcblx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5zY3JvbGxUb0JvdHRvbUFjY2Vzc2libGVWaWV3JywgJ1Njcm9sbCB0byBBY2Nlc3NpYmxlIFZpZXcgQm90dG9tJyksXG5cdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnRleHRLZXlFeHByLm9yKFRlcm1pbmFsQ29udGV4dEtleXMucHJvY2Vzc1N1cHBvcnRlZCwgVGVybWluYWxDb250ZXh0S2V5cy50ZXJtaW5hbEhhc0JlZW5DcmVhdGVkKSwgQ29udGV4dEtleUV4cHIuYW5kKGFjY2Vzc2libGVWaWV3SXNTaG93biwgQ29udGV4dEtleUV4cHIuZXF1YWxzKGFjY2Vzc2libGVWaWV3Q3VycmVudFByb3ZpZGVySWQua2V5LCBBY2Nlc3NpYmxlVmlld1Byb3ZpZGVySWQuVGVybWluYWwpKSksXG5cdGtleWJpbmRpbmc6IHtcblx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRW5kLFxuXHRcdGxpbnV4OiB7IHByaW1hcnk6IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuRW5kIH0sXG5cdFx0d2hlbjogYWNjZXNzaWJsZVZpZXdDdXJyZW50UHJvdmlkZXJJZC5pc0VxdWFsVG8oQWNjZXNzaWJsZVZpZXdQcm92aWRlcklkLlRlcm1pbmFsKSxcblx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYlxuXHR9LFxuXHRydW46IChjLCBhY2Nlc3NvcikgPT4ge1xuXHRcdGNvbnN0IGFjY2Vzc2libGVWaWV3U2VydmljZSA9IGFjY2Vzc29yLmdldChJQWNjZXNzaWJsZVZpZXdTZXJ2aWNlKTtcblx0XHRjb25zdCBsYXN0UG9zaXRpb24gPSBhY2Nlc3NpYmxlVmlld1NlcnZpY2UuZ2V0TGFzdFBvc2l0aW9uKCk7XG5cdFx0aWYgKCFsYXN0UG9zaXRpb24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0YWNjZXNzaWJsZVZpZXdTZXJ2aWNlLnNldFBvc2l0aW9uKGxhc3RQb3NpdGlvbiwgdHJ1ZSk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlclRlcm1pbmFsQWN0aW9uKHtcblx0aWQ6IFRlcm1pbmFsQWNjZXNzaWJpbGl0eUNvbW1hbmRJZC5TY3JvbGxUb1RvcEFjY2Vzc2libGVWaWV3LFxuXHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnNjcm9sbFRvVG9wQWNjZXNzaWJsZVZpZXcnLCAnU2Nyb2xsIHRvIEFjY2Vzc2libGUgVmlldyBUb3AnKSxcblx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIub3IoVGVybWluYWxDb250ZXh0S2V5cy5wcm9jZXNzU3VwcG9ydGVkLCBUZXJtaW5hbENvbnRleHRLZXlzLnRlcm1pbmFsSGFzQmVlbkNyZWF0ZWQpLCBDb250ZXh0S2V5RXhwci5hbmQoYWNjZXNzaWJsZVZpZXdJc1Nob3duLCBDb250ZXh0S2V5RXhwci5lcXVhbHMoYWNjZXNzaWJsZVZpZXdDdXJyZW50UHJvdmlkZXJJZC5rZXksIEFjY2Vzc2libGVWaWV3UHJvdmlkZXJJZC5UZXJtaW5hbCkpKSxcblx0a2V5YmluZGluZzoge1xuXHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5Ib21lLFxuXHRcdGxpbnV4OiB7IHByaW1hcnk6IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuSG9tZSB9LFxuXHRcdHdoZW46IGFjY2Vzc2libGVWaWV3Q3VycmVudFByb3ZpZGVySWQuaXNFcXVhbFRvKEFjY2Vzc2libGVWaWV3UHJvdmlkZXJJZC5UZXJtaW5hbCksXG5cdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWJcblx0fSxcblx0cnVuOiAoYywgYWNjZXNzb3IpID0+IGFjY2Vzc29yLmdldChJQWNjZXNzaWJsZVZpZXdTZXJ2aWNlKT8uc2V0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDEpLCB0cnVlKVxufSk7XG5cbi8vICNlbmRyZWdpb25cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBTUEsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsU0FBUyxjQUFjO0FBQ2hDLFNBQVMsWUFBWSxpQkFBaUIseUJB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
