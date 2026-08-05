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
import * as dom from "../../../../../base/browser/dom.js";
import { AutoOpenBarrier } from "../../../../../base/common/async.js";
import { Event } from "../../../../../base/common/event.js";
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { DisposableStore, MutableDisposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { isWindows } from "../../../../../base/common/platform.js";
import { localize2 } from "../../../../../nls.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { GeneralShellType, TerminalLocation } from "../../../../../platform/terminal/common/terminal.js";
import { registerActiveInstanceAction, registerTerminalAction } from "../../../terminal/browser/terminalActions.js";
import { registerTerminalContribution } from "../../../terminal/browser/terminalExtensions.js";
import { TerminalContextKeys } from "../../../terminal/common/terminalContextKey.js";
import { TerminalSuggestCommandId } from "../common/terminal.suggest.js";
import { terminalSuggestConfigSection, TerminalSuggestSettingId } from "../common/terminalSuggestConfiguration.js";
import { ITerminalCompletionService, TerminalCompletionService } from "./terminalCompletionService.js";
import { InstantiationType, registerSingleton } from "../../../../../platform/instantiation/common/extensions.js";
import { SuggestAddon } from "./terminalSuggestAddon.js";
import { TerminalClipboardContribution } from "../../clipboard/browser/terminal.clipboard.contribution.js";
import { PwshCompletionProviderAddon } from "./pwshCompletionProviderAddon.js";
import { SimpleSuggestContext } from "../../../../services/suggest/browser/simpleSuggestWidget.js";
import { SuggestDetailsClassName } from "../../../../services/suggest/browser/simpleSuggestWidgetDetails.js";
import { EditorContextKeys } from "../../../../../editor/common/editorContextKeys.js";
import { MenuId } from "../../../../../platform/actions/common/actions.js";
import { IPreferencesService } from "../../../../services/preferences/common/preferences.js";
import "./terminalSymbolIcons.js";
registerSingleton(ITerminalCompletionService, TerminalCompletionService, InstantiationType.Delayed);
let TerminalSuggestContribution = class extends DisposableStore {
  constructor(_ctx, _contextKeyService, _configurationService, _instantiationService, _terminalCompletionService) {
    super();
    this._ctx = _ctx;
    this._contextKeyService = _contextKeyService;
    this._configurationService = _configurationService;
    this._instantiationService = _instantiationService;
    this._terminalCompletionService = _terminalCompletionService;
    this._addon = new MutableDisposable();
    this._pwshAddon = new MutableDisposable();
    this.add(toDisposable(() => {
      this._addon?.dispose();
      this._pwshAddon?.dispose();
    }));
    this._terminalSuggestWidgetVisibleContextKey = TerminalContextKeys.suggestWidgetVisible.bindTo(this._contextKeyService);
    this.add(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(TerminalSuggestSettingId.Enabled)) {
        const completionsEnabled = this._configurationService.getValue(terminalSuggestConfigSection).enabled;
        if (!completionsEnabled) {
          this._addon.clear();
          this._pwshAddon.clear();
        }
        const xtermRaw = this._ctx.instance.xterm?.raw;
        if (!!xtermRaw && completionsEnabled) {
          this._loadAddons(xtermRaw);
        }
      }
    }));
  }
  static get(instance) {
    return instance.getContribution(TerminalSuggestContribution.ID);
  }
  get addon() {
    return this._addon.value;
  }
  get pwshAddon() {
    return this._pwshAddon.value;
  }
  xtermOpen(xterm) {
    const config = this._configurationService.getValue(terminalSuggestConfigSection);
    const enabled = config.enabled;
    if (!enabled) {
      return;
    }
    this._loadAddons(xterm.raw);
    this.add(Event.runAndSubscribe(this._ctx.instance.onDidChangeShellType, async () => {
      this._refreshAddons();
    }));
  }
  async _loadPwshCompletionAddon(xterm) {
    if (this._ctx.instance.shellType !== GeneralShellType.PowerShell || this._ctx.instance.shellLaunchConfig.executable?.endsWith("WindowsPowerShell\\v1.0\\powershell.exe")) {
      this._pwshAddon.clear();
      return;
    }
    await this._ctx.instance.processReady;
    const processTraits = this._ctx.processManager.processTraits;
    if (processTraits?.windowsPty && (processTraits.windowsPty.backend !== "conpty" || processTraits?.windowsPty.buildNumber <= 19045)) {
      return;
    }
    const pwshCompletionProviderAddon = this._pwshAddon.value = this._instantiationService.createInstance(PwshCompletionProviderAddon, this._ctx.instance.capabilities);
    xterm.loadAddon(pwshCompletionProviderAddon);
    this.add(pwshCompletionProviderAddon);
    this.add(pwshCompletionProviderAddon.onDidRequestSendText((text) => {
      this._ctx.instance.sendText(text, false);
    }));
    this.add(this._terminalCompletionService.registerTerminalCompletionProvider("builtinPwsh", pwshCompletionProviderAddon.id, pwshCompletionProviderAddon));
    if (!isWindows) {
      let barrier;
      if (pwshCompletionProviderAddon) {
        this.add(pwshCompletionProviderAddon.onDidRequestSendText(() => {
          barrier = new AutoOpenBarrier(2e3);
          this._ctx.instance.pauseInputEvents(barrier);
        }));
      }
      if (this._pwshAddon.value) {
        this.add(this._pwshAddon.value.onDidReceiveCompletions(() => {
          barrier?.open();
          barrier = void 0;
        }));
      } else {
        throw Error("no addon");
      }
    }
  }
  _loadAddons(xterm) {
    if (this._addon.value) {
      return;
    }
    const addon = this._addon.value = this._instantiationService.createInstance(SuggestAddon, this._ctx.instance.shellType, this._ctx.instance.capabilities, this._terminalSuggestWidgetVisibleContextKey);
    xterm.loadAddon(addon);
    this._loadPwshCompletionAddon(xterm);
    if (this._ctx.instance.target === TerminalLocation.Editor) {
      addon.setContainerWithOverflow(xterm.element);
    } else {
      addon.setContainerWithOverflow(dom.findParentWithClass(xterm.element, "panel"));
    }
    addon.setScreen(xterm.element.querySelector(".xterm-screen"));
    this.add(dom.addDisposableListener(this._ctx.instance.domElement, dom.EventType.FOCUS_OUT, (e) => {
      const focusedElement = e.relatedTarget;
      if (focusedElement?.classList.contains(SuggestDetailsClassName)) {
        return;
      }
      addon.hideSuggestWidget(true);
    }));
    this.add(addon.onAcceptedCompletion(async (text) => {
      this._ctx.instance.focus();
      this._ctx.instance.sendText(text, false);
    }));
    const clipboardContrib = TerminalClipboardContribution.get(this._ctx.instance);
    this.add(clipboardContrib.onWillPaste(() => addon.isPasting = true));
    this.add(clipboardContrib.onDidPaste(() => {
      setTimeout(() => addon.isPasting = false, 100);
    }));
    if (!isWindows) {
      let barrier;
      this.add(addon.onDidReceiveCompletions(() => {
        barrier?.open();
        barrier = void 0;
      }));
    }
  }
  _refreshAddons() {
    const addon = this._addon.value;
    if (!addon) {
      return;
    }
    addon.shellType = this._ctx.instance.shellType;
    if (!this._ctx.instance.xterm?.raw) {
      return;
    }
    this._loadPwshCompletionAddon(this._ctx.instance.xterm.raw);
  }
};
TerminalSuggestContribution.ID = "terminal.suggest";
TerminalSuggestContribution = __decorateClass([
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, ITerminalCompletionService)
], TerminalSuggestContribution);
registerTerminalContribution(TerminalSuggestContribution.ID, TerminalSuggestContribution);
registerTerminalAction({
  id: TerminalSuggestCommandId.ConfigureSettings,
  title: localize2("workbench.action.terminal.configureSuggestSettings", "Configure"),
  f1: false,
  precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
  keybinding: {
    primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Comma,
    weight: KeybindingWeight.WorkbenchContrib
  },
  menu: {
    id: MenuId.MenubarTerminalSuggestStatusMenu,
    group: "right",
    order: 1
  },
  run: (c, accessor) => accessor.get(IPreferencesService).openSettings({ query: terminalSuggestConfigSection })
});
registerActiveInstanceAction({
  id: TerminalSuggestCommandId.RequestCompletions,
  title: localize2("workbench.action.terminal.requestCompletions", "Request Completions"),
  keybinding: {
    primary: KeyMod.CtrlCmd | KeyCode.Space,
    mac: { primary: KeyMod.WinCtrl | KeyCode.Space },
    weight: KeybindingWeight.WorkbenchContrib + 1,
    when: ContextKeyExpr.and(TerminalContextKeys.focus, TerminalContextKeys.suggestWidgetVisible.negate(), ContextKeyExpr.equals(`config.${TerminalSuggestSettingId.Enabled}`, true))
  },
  run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.requestCompletions(true)
});
registerActiveInstanceAction({
  id: TerminalSuggestCommandId.ResetWidgetSize,
  title: localize2("workbench.action.terminal.resetSuggestWidgetSize", "Reset Suggest Widget Size"),
  run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.resetWidgetSize()
});
registerActiveInstanceAction({
  id: TerminalSuggestCommandId.SelectPrevSuggestion,
  title: localize2("workbench.action.terminal.selectPrevSuggestion", "Select the Previous Suggestion"),
  f1: false,
  precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
  keybinding: {
    // Up is bound to other workbench keybindings that this needs to beat
    primary: KeyCode.UpArrow,
    weight: KeybindingWeight.WorkbenchContrib + 1,
    when: ContextKeyExpr.or(SimpleSuggestContext.HasNavigated, ContextKeyExpr.equals(`config.${TerminalSuggestSettingId.UpArrowNavigatesHistory}`, false))
  },
  run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.selectPreviousSuggestion()
});
registerActiveInstanceAction({
  id: TerminalSuggestCommandId.SelectPrevPageSuggestion,
  title: localize2("workbench.action.terminal.selectPrevPageSuggestion", "Select the Previous Page Suggestion"),
  f1: false,
  precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
  keybinding: {
    // Up is bound to other workbench keybindings that this needs to beat
    primary: KeyCode.PageUp,
    weight: KeybindingWeight.WorkbenchContrib + 1
  },
  run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.selectPreviousPageSuggestion()
});
registerActiveInstanceAction({
  id: TerminalSuggestCommandId.SelectNextSuggestion,
  title: localize2("workbench.action.terminal.selectNextSuggestion", "Select the Next Suggestion"),
  f1: false,
  precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
  keybinding: {
    // Down is bound to other workbench keybindings that this needs to beat
    primary: KeyCode.DownArrow,
    weight: KeybindingWeight.WorkbenchContrib + 1
  },
  run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.selectNextSuggestion()
});
registerActiveInstanceAction({
  id: "terminalSuggestToggleExplainMode",
  title: localize2("workbench.action.terminal.suggestToggleExplainMode", "Suggest Toggle Explain Modes"),
  f1: false,
  precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
  keybinding: {
    // Down is bound to other workbench keybindings that this needs to beat
    weight: KeybindingWeight.WorkbenchContrib + 1,
    primary: KeyMod.CtrlCmd | KeyCode.Slash
  },
  run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.toggleExplainMode()
});
registerActiveInstanceAction({
  id: TerminalSuggestCommandId.ToggleDetailsFocus,
  title: localize2("workbench.action.terminal.suggestToggleDetailsFocus", "Suggest Toggle Suggestion Focus"),
  f1: false,
  // HACK: This does not work with a precondition of `TerminalContextKeys.suggestWidgetVisible`, so make sure to not override the editor's keybinding
  precondition: EditorContextKeys.textInputFocus.negate(),
  keybinding: {
    weight: KeybindingWeight.WorkbenchContrib,
    primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.Space,
    mac: { primary: KeyMod.WinCtrl | KeyMod.Alt | KeyCode.Space }
  },
  run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.toggleSuggestionFocus()
});
registerActiveInstanceAction({
  id: TerminalSuggestCommandId.ToggleDetails,
  title: localize2("workbench.action.terminal.suggestToggleDetails", "Suggest Toggle Details"),
  f1: false,
  precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.isOpen, TerminalContextKeys.focus, TerminalContextKeys.suggestWidgetVisible, SimpleSuggestContext.HasFocusedSuggestion),
  keybinding: {
    // HACK: Force weight to be higher than that to start terminal chat
    weight: KeybindingWeight.ExternalExtension + 2,
    primary: KeyMod.CtrlCmd | KeyCode.Space,
    secondary: [KeyMod.CtrlCmd | KeyCode.KeyI],
    mac: { primary: KeyMod.WinCtrl | KeyCode.Space, secondary: [KeyMod.CtrlCmd | KeyCode.KeyI] }
  },
  run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.toggleSuggestionDetails()
});
registerActiveInstanceAction({
  id: TerminalSuggestCommandId.SelectNextPageSuggestion,
  title: localize2("workbench.action.terminal.selectNextPageSuggestion", "Select the Next Page Suggestion"),
  f1: false,
  precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
  keybinding: {
    // Down is bound to other workbench keybindings that this needs to beat
    primary: KeyCode.PageDown,
    weight: KeybindingWeight.WorkbenchContrib + 1
  },
  run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.selectNextPageSuggestion()
});
registerActiveInstanceAction({
  id: TerminalSuggestCommandId.AcceptSelectedSuggestion,
  title: localize2("workbench.action.terminal.acceptSelectedSuggestion", "Insert"),
  f1: false,
  precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
  keybinding: {
    primary: KeyCode.Tab,
    // Tab is bound to other workbench keybindings that this needs to beat
    weight: KeybindingWeight.WorkbenchContrib + 1
  },
  menu: {
    id: MenuId.MenubarTerminalSuggestStatusMenu,
    order: 1,
    group: "left"
  },
  run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.acceptSelectedSuggestion()
});
registerActiveInstanceAction({
  id: TerminalSuggestCommandId.AcceptSelectedSuggestionEnter,
  title: localize2("workbench.action.terminal.acceptSelectedSuggestionEnter", "Accept Selected Suggestion (Enter)"),
  f1: false,
  precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
  keybinding: {
    primary: KeyCode.Enter,
    // Enter is bound to other workbench keybindings that this needs to beat
    weight: KeybindingWeight.WorkbenchContrib + 1,
    when: ContextKeyExpr.notEquals(`config.${TerminalSuggestSettingId.RunOnEnter}`, "ignore")
  },
  run: async (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.acceptSelectedSuggestion(void 0, true)
});
registerActiveInstanceAction({
  id: TerminalSuggestCommandId.HideSuggestWidget,
  title: localize2("workbench.action.terminal.hideSuggestWidget", "Hide Suggest Widget"),
  f1: false,
  precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
  keybinding: {
    primary: KeyCode.Escape,
    // Escape is bound to other workbench keybindings that this needs to beat
    weight: KeybindingWeight.WorkbenchContrib + 1
  },
  run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.hideSuggestWidget(true)
});
registerActiveInstanceAction({
  id: TerminalSuggestCommandId.HideSuggestWidgetAndNavigateHistory,
  title: localize2("workbench.action.terminal.hideSuggestWidgetAndNavigateHistory", "Hide Suggest Widget and Navigate History"),
  f1: false,
  precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
  keybinding: {
    primary: KeyCode.UpArrow,
    when: ContextKeyExpr.and(SimpleSuggestContext.HasNavigated.negate(), ContextKeyExpr.equals(`config.${TerminalSuggestSettingId.UpArrowNavigatesHistory}`, true)),
    weight: KeybindingWeight.WorkbenchContrib + 2
  },
  run: (activeInstance) => {
    TerminalSuggestContribution.get(activeInstance)?.addon?.hideSuggestWidget(true);
    activeInstance.sendText("\x1B[A", false);
  }
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvc3VnZ2VzdC9icm93c2VyL3Rlcm1pbmFsLnN1Z2dlc3QuY29udHJpYnV0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHR5cGUgeyBUZXJtaW5hbCBhcyBSYXdYdGVybVRlcm1pbmFsIH0gZnJvbSAnQHh0ZXJtL3h0ZXJtJztcbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IEF1dG9PcGVuQmFycmllciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSwgS2V5TW9kIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlLCBNdXRhYmxlRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGlzV2luZG93cyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByLCBJQ29udGV4dEtleSwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IEdlbmVyYWxTaGVsbFR5cGUsIFRlcm1pbmFsTG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgSVRlcm1pbmFsQ29udHJpYnV0aW9uLCBJVGVybWluYWxJbnN0YW5jZSwgSVh0ZXJtVGVybWluYWwgfSBmcm9tICcuLi8uLi8uLi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVyQWN0aXZlSW5zdGFuY2VBY3Rpb24sIHJlZ2lzdGVyVGVybWluYWxBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyByZWdpc3RlclRlcm1pbmFsQ29udHJpYnV0aW9uLCB0eXBlIElUZXJtaW5hbENvbnRyaWJ1dGlvbkNvbnRleHQgfSBmcm9tICcuLi8uLi8uLi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbENvbnRleHRLZXlzIH0gZnJvbSAnLi4vLi4vLi4vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsQ29udGV4dEtleS5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbFN1Z2dlc3RDb21tYW5kSWQgfSBmcm9tICcuLi9jb21tb24vdGVybWluYWwuc3VnZ2VzdC5qcyc7XG5pbXBvcnQgeyB0ZXJtaW5hbFN1Z2dlc3RDb25maWdTZWN0aW9uLCBUZXJtaW5hbFN1Z2dlc3RTZXR0aW5nSWQsIHR5cGUgSVRlcm1pbmFsU3VnZ2VzdENvbmZpZ3VyYXRpb24gfSBmcm9tICcuLi9jb21tb24vdGVybWluYWxTdWdnZXN0Q29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxDb21wbGV0aW9uU2VydmljZSwgVGVybWluYWxDb21wbGV0aW9uU2VydmljZSB9IGZyb20gJy4vdGVybWluYWxDb21wbGV0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJbnN0YW50aWF0aW9uVHlwZSwgcmVnaXN0ZXJTaW5nbGV0b24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IFN1Z2dlc3RBZGRvbiB9IGZyb20gJy4vdGVybWluYWxTdWdnZXN0QWRkb24uanMnO1xuaW1wb3J0IHsgVGVybWluYWxDbGlwYm9hcmRDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi9jbGlwYm9hcmQvYnJvd3Nlci90ZXJtaW5hbC5jbGlwYm9hcmQuY29udHJpYnV0aW9uLmpzJztcbmltcG9ydCB7IFB3c2hDb21wbGV0aW9uUHJvdmlkZXJBZGRvbiB9IGZyb20gJy4vcHdzaENvbXBsZXRpb25Qcm92aWRlckFkZG9uLmpzJztcbmltcG9ydCB7IFNpbXBsZVN1Z2dlc3RDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvc3VnZ2VzdC9icm93c2VyL3NpbXBsZVN1Z2dlc3RXaWRnZXQuanMnO1xuaW1wb3J0IHsgU3VnZ2VzdERldGFpbHNDbGFzc05hbWUgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9zdWdnZXN0L2Jyb3dzZXIvc2ltcGxlU3VnZ2VzdFdpZGdldERldGFpbHMuanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29udGV4dEtleXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IE1lbnVJZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSVByZWZlcmVuY2VzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3ByZWZlcmVuY2VzL2NvbW1vbi9wcmVmZXJlbmNlcy5qcyc7XG5pbXBvcnQgJy4vdGVybWluYWxTeW1ib2xJY29ucy5qcyc7XG5cbnJlZ2lzdGVyU2luZ2xldG9uKElUZXJtaW5hbENvbXBsZXRpb25TZXJ2aWNlLCBUZXJtaW5hbENvbXBsZXRpb25TZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5EZWxheWVkKTtcblxuLy8gI3JlZ2lvbiBUZXJtaW5hbCBDb250cmlidXRpb25zXG5cbmNsYXNzIFRlcm1pbmFsU3VnZ2VzdENvbnRyaWJ1dGlvbiBleHRlbmRzIERpc3Bvc2FibGVTdG9yZSBpbXBsZW1lbnRzIElUZXJtaW5hbENvbnRyaWJ1dGlvbiB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd0ZXJtaW5hbC5zdWdnZXN0JztcblxuXHRzdGF0aWMgZ2V0KGluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSk6IFRlcm1pbmFsU3VnZ2VzdENvbnRyaWJ1dGlvbiB8IG51bGwge1xuXHRcdHJldHVybiBpbnN0YW5jZS5nZXRDb250cmlidXRpb248VGVybWluYWxTdWdnZXN0Q29udHJpYnV0aW9uPihUZXJtaW5hbFN1Z2dlc3RDb250cmlidXRpb24uSUQpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfYWRkb246IE11dGFibGVEaXNwb3NhYmxlPFN1Z2dlc3RBZGRvbj4gPSBuZXcgTXV0YWJsZURpc3Bvc2FibGUoKTtcblx0cHJpdmF0ZSByZWFkb25seSBfcHdzaEFkZG9uOiBNdXRhYmxlRGlzcG9zYWJsZTxQd3NoQ29tcGxldGlvblByb3ZpZGVyQWRkb24+ID0gbmV3IE11dGFibGVEaXNwb3NhYmxlKCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsU3VnZ2VzdFdpZGdldFZpc2libGVDb250ZXh0S2V5OiBJQ29udGV4dEtleTxib29sZWFuPjtcblxuXHRnZXQgYWRkb24oKTogU3VnZ2VzdEFkZG9uIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX2FkZG9uLnZhbHVlOyB9XG5cdGdldCBwd3NoQWRkb24oKTogUHdzaENvbXBsZXRpb25Qcm92aWRlckFkZG9uIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX3B3c2hBZGRvbi52YWx1ZTsgfVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2N0eDogSVRlcm1pbmFsQ29udHJpYnV0aW9uQ29udGV4dCxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVRlcm1pbmFsQ29tcGxldGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVybWluYWxDb21wbGV0aW9uU2VydmljZTogSVRlcm1pbmFsQ29tcGxldGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0dGhpcy5fYWRkb24/LmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMuX3B3c2hBZGRvbj8uZGlzcG9zZSgpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl90ZXJtaW5hbFN1Z2dlc3RXaWRnZXRWaXNpYmxlQ29udGV4dEtleSA9IFRlcm1pbmFsQ29udGV4dEtleXMuc3VnZ2VzdFdpZGdldFZpc2libGUuYmluZFRvKHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLmFkZCh0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbihUZXJtaW5hbFN1Z2dlc3RTZXR0aW5nSWQuRW5hYmxlZCkpIHtcblx0XHRcdFx0Y29uc3QgY29tcGxldGlvbnNFbmFibGVkID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SVRlcm1pbmFsU3VnZ2VzdENvbmZpZ3VyYXRpb24+KHRlcm1pbmFsU3VnZ2VzdENvbmZpZ1NlY3Rpb24pLmVuYWJsZWQ7XG5cdFx0XHRcdGlmICghY29tcGxldGlvbnNFbmFibGVkKSB7XG5cdFx0XHRcdFx0dGhpcy5fYWRkb24uY2xlYXIoKTtcblx0XHRcdFx0XHR0aGlzLl9wd3NoQWRkb24uY2xlYXIoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCB4dGVybVJhdyA9IHRoaXMuX2N0eC5pbnN0YW5jZS54dGVybT8ucmF3O1xuXHRcdFx0XHRpZiAoISF4dGVybVJhdyAmJiBjb21wbGV0aW9uc0VuYWJsZWQpIHtcblx0XHRcdFx0XHR0aGlzLl9sb2FkQWRkb25zKHh0ZXJtUmF3KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHh0ZXJtT3Blbih4dGVybTogSVh0ZXJtVGVybWluYWwgJiB7IHJhdzogUmF3WHRlcm1UZXJtaW5hbCB9KTogdm9pZCB7XG5cdFx0Y29uc3QgY29uZmlnID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SVRlcm1pbmFsU3VnZ2VzdENvbmZpZ3VyYXRpb24+KHRlcm1pbmFsU3VnZ2VzdENvbmZpZ1NlY3Rpb24pO1xuXHRcdGNvbnN0IGVuYWJsZWQgPSBjb25maWcuZW5hYmxlZDtcblx0XHRpZiAoIWVuYWJsZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fbG9hZEFkZG9ucyh4dGVybS5yYXcpO1xuXHRcdHRoaXMuYWRkKEV2ZW50LnJ1bkFuZFN1YnNjcmliZSh0aGlzLl9jdHguaW5zdGFuY2Uub25EaWRDaGFuZ2VTaGVsbFR5cGUsIGFzeW5jICgpID0+IHtcblx0XHRcdHRoaXMuX3JlZnJlc2hBZGRvbnMoKTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9sb2FkUHdzaENvbXBsZXRpb25BZGRvbih4dGVybTogUmF3WHRlcm1UZXJtaW5hbCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdC8vIERpc2FibGUgd2hlbiBzaGVsbCB0eXBlIGlzIG5vdCBwb3dlcnNoZWxsLiBBIG5haXZlIGNoZWNrIGlzIGRvbmUgZm9yIFdpbmRvd3MgUG93ZXJTaGVsbFxuXHRcdC8vIGFzIHdlIGRvbid0IGRpZmZlcmVudGlhdGUgaXQgaW4gc2hlbGxUeXBlXG5cdFx0aWYgKFxuXHRcdFx0dGhpcy5fY3R4Lmluc3RhbmNlLnNoZWxsVHlwZSAhPT0gR2VuZXJhbFNoZWxsVHlwZS5Qb3dlclNoZWxsIHx8XG5cdFx0XHR0aGlzLl9jdHguaW5zdGFuY2Uuc2hlbGxMYXVuY2hDb25maWcuZXhlY3V0YWJsZT8uZW5kc1dpdGgoJ1dpbmRvd3NQb3dlclNoZWxsXFxcXHYxLjBcXFxccG93ZXJzaGVsbC5leGUnKVxuXHRcdCkge1xuXHRcdFx0dGhpcy5fcHdzaEFkZG9uLmNsZWFyKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gRGlzYWJsZSB0aGUgYWRkb24gb24gb2xkIGJhY2tlbmRzIChub3QgY29ucHR5IG9yIFdpbmRvd3MgMTEpXG5cdFx0YXdhaXQgdGhpcy5fY3R4Lmluc3RhbmNlLnByb2Nlc3NSZWFkeTtcblx0XHRjb25zdCBwcm9jZXNzVHJhaXRzID0gdGhpcy5fY3R4LnByb2Nlc3NNYW5hZ2VyLnByb2Nlc3NUcmFpdHM7XG5cdFx0aWYgKHByb2Nlc3NUcmFpdHM/LndpbmRvd3NQdHkgJiYgKHByb2Nlc3NUcmFpdHMud2luZG93c1B0eS5iYWNrZW5kICE9PSAnY29ucHR5JyB8fCBwcm9jZXNzVHJhaXRzPy53aW5kb3dzUHR5LmJ1aWxkTnVtYmVyIDw9IDE5MDQ1KSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHB3c2hDb21wbGV0aW9uUHJvdmlkZXJBZGRvbiA9IHRoaXMuX3B3c2hBZGRvbi52YWx1ZSA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFB3c2hDb21wbGV0aW9uUHJvdmlkZXJBZGRvbiwgdGhpcy5fY3R4Lmluc3RhbmNlLmNhcGFiaWxpdGllcyk7XG5cdFx0eHRlcm0ubG9hZEFkZG9uKHB3c2hDb21wbGV0aW9uUHJvdmlkZXJBZGRvbik7XG5cdFx0dGhpcy5hZGQocHdzaENvbXBsZXRpb25Qcm92aWRlckFkZG9uKTtcblx0XHR0aGlzLmFkZChwd3NoQ29tcGxldGlvblByb3ZpZGVyQWRkb24ub25EaWRSZXF1ZXN0U2VuZFRleHQodGV4dCA9PiB7XG5cdFx0XHR0aGlzLl9jdHguaW5zdGFuY2Uuc2VuZFRleHQodGV4dCwgZmFsc2UpO1xuXHRcdH0pKTtcblx0XHR0aGlzLmFkZCh0aGlzLl90ZXJtaW5hbENvbXBsZXRpb25TZXJ2aWNlLnJlZ2lzdGVyVGVybWluYWxDb21wbGV0aW9uUHJvdmlkZXIoJ2J1aWx0aW5Qd3NoJywgcHdzaENvbXBsZXRpb25Qcm92aWRlckFkZG9uLmlkLCBwd3NoQ29tcGxldGlvblByb3ZpZGVyQWRkb24pKTtcblx0XHQvLyBJZiBjb21wbGV0aW9ucyBhcmUgcmVxdWVzdGVkLCBwYXVzZSBhbmQgcXVldWUgaW5wdXQgZXZlbnRzIHVudGlsIGNvbXBsZXRpb25zIGFyZVxuXHRcdC8vIHJlY2VpdmVkLiBUaGlzIGZpeGluZyBzb21lIHByb2JsZW1zIGluIFBvd2VyU2hlbGwsIHBhcnRpY3VsYXJseSBlbnRlciBub3QgZXhlY3V0aW5nXG5cdFx0Ly8gd2hlbiB0eXBpbmcgcXVpY2tseSBhbmQgc29tZSBjaGFyYWN0ZXJzIGJlaW5nIHByaW50ZWQgdHdpY2UuIE9uIFdpbmRvd3MgdGhpcyBpc24ndFxuXHRcdC8vIG5lZWRlZCBiZWNhdXNlIGlucHV0cyBhcmUgX25vdF8gZWNob2VkIHdoZW4gbm90IGhhbmRsZWQgaW1tZWRpYXRlbHkuXG5cdFx0Ly8gVE9ETzogVGhpcyBzaG91bGQgYmUgYmFzZWQgb24gdGhlIE9TIG9mIHRoZSBwdHkgaG9zdCwgbm90IHRoZSBjbGllbnRcblx0XHRpZiAoIWlzV2luZG93cykge1xuXHRcdFx0bGV0IGJhcnJpZXI6IEF1dG9PcGVuQmFycmllciB8IHVuZGVmaW5lZDtcblx0XHRcdGlmIChwd3NoQ29tcGxldGlvblByb3ZpZGVyQWRkb24pIHtcblx0XHRcdFx0dGhpcy5hZGQocHdzaENvbXBsZXRpb25Qcm92aWRlckFkZG9uLm9uRGlkUmVxdWVzdFNlbmRUZXh0KCgpID0+IHtcblx0XHRcdFx0XHRiYXJyaWVyID0gbmV3IEF1dG9PcGVuQmFycmllcigyMDAwKTtcblx0XHRcdFx0XHR0aGlzLl9jdHguaW5zdGFuY2UucGF1c2VJbnB1dEV2ZW50cyhiYXJyaWVyKTtcblx0XHRcdFx0fSkpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRoaXMuX3B3c2hBZGRvbi52YWx1ZSkge1xuXHRcdFx0XHR0aGlzLmFkZCh0aGlzLl9wd3NoQWRkb24udmFsdWUub25EaWRSZWNlaXZlQ29tcGxldGlvbnMoKCkgPT4ge1xuXHRcdFx0XHRcdGJhcnJpZXI/Lm9wZW4oKTtcblx0XHRcdFx0XHRiYXJyaWVyID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR9KSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aHJvdyBFcnJvcignbm8gYWRkb24nKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9sb2FkQWRkb25zKHh0ZXJtOiBSYXdYdGVybVRlcm1pbmFsKTogdm9pZCB7XG5cdFx0Ly8gRG9uJ3QgcmUtY3JlYXRlIHRoZSBhZGRvblxuXHRcdGlmICh0aGlzLl9hZGRvbi52YWx1ZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFkZG9uID0gdGhpcy5fYWRkb24udmFsdWUgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTdWdnZXN0QWRkb24sIHRoaXMuX2N0eC5pbnN0YW5jZS5zaGVsbFR5cGUsIHRoaXMuX2N0eC5pbnN0YW5jZS5jYXBhYmlsaXRpZXMsIHRoaXMuX3Rlcm1pbmFsU3VnZ2VzdFdpZGdldFZpc2libGVDb250ZXh0S2V5KTtcblx0XHR4dGVybS5sb2FkQWRkb24oYWRkb24pO1xuXHRcdHRoaXMuX2xvYWRQd3NoQ29tcGxldGlvbkFkZG9uKHh0ZXJtKTtcblx0XHRpZiAodGhpcy5fY3R4Lmluc3RhbmNlLnRhcmdldCA9PT0gVGVybWluYWxMb2NhdGlvbi5FZGl0b3IpIHtcblx0XHRcdGFkZG9uLnNldENvbnRhaW5lcldpdGhPdmVyZmxvdyh4dGVybS5lbGVtZW50ISk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGFkZG9uLnNldENvbnRhaW5lcldpdGhPdmVyZmxvdyhkb20uZmluZFBhcmVudFdpdGhDbGFzcyh4dGVybS5lbGVtZW50ISwgJ3BhbmVsJykhKTtcblx0XHR9XG5cdFx0YWRkb24uc2V0U2NyZWVuKHh0ZXJtLmVsZW1lbnQhLnF1ZXJ5U2VsZWN0b3IoJy54dGVybS1zY3JlZW4nKSEpO1xuXG5cdFx0dGhpcy5hZGQoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLl9jdHguaW5zdGFuY2UuZG9tRWxlbWVudCwgZG9tLkV2ZW50VHlwZS5GT0NVU19PVVQsIChlKSA9PiB7XG5cdFx0XHRjb25zdCBmb2N1c2VkRWxlbWVudCA9IGUucmVsYXRlZFRhcmdldCBhcyBIVE1MRWxlbWVudDtcblx0XHRcdGlmIChmb2N1c2VkRWxlbWVudD8uY2xhc3NMaXN0LmNvbnRhaW5zKFN1Z2dlc3REZXRhaWxzQ2xhc3NOYW1lKSkge1xuXHRcdFx0XHQvLyBEb24ndCBoaWRlIHRoZSBzdWdnZXN0IHdpZGdldCBpZiB0aGUgZm9jdXMgaXMgbW92aW5nIHRvIHRoZSBkZXRhaWxzXG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGFkZG9uLmhpZGVTdWdnZXN0V2lkZ2V0KHRydWUpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuYWRkKGFkZG9uLm9uQWNjZXB0ZWRDb21wbGV0aW9uKGFzeW5jIHRleHQgPT4ge1xuXHRcdFx0dGhpcy5fY3R4Lmluc3RhbmNlLmZvY3VzKCk7XG5cdFx0XHR0aGlzLl9jdHguaW5zdGFuY2Uuc2VuZFRleHQodGV4dCwgZmFsc2UpO1xuXHRcdH0pKTtcblx0XHRjb25zdCBjbGlwYm9hcmRDb250cmliID0gVGVybWluYWxDbGlwYm9hcmRDb250cmlidXRpb24uZ2V0KHRoaXMuX2N0eC5pbnN0YW5jZSkhO1xuXHRcdHRoaXMuYWRkKGNsaXBib2FyZENvbnRyaWIub25XaWxsUGFzdGUoKCkgPT4gYWRkb24uaXNQYXN0aW5nID0gdHJ1ZSkpO1xuXHRcdHRoaXMuYWRkKGNsaXBib2FyZENvbnRyaWIub25EaWRQYXN0ZSgoKSA9PiB7XG5cdFx0XHQvLyBEZWxheSB0aGlzIHNsaWdodGx5IGFzIHN5bmNocm9uaXppbmcgdGhlIHByb21wdCBpbnB1dCBpcyBkZWJvdW5jZWRcblx0XHRcdHNldFRpbWVvdXQoKCkgPT4gYWRkb24uaXNQYXN0aW5nID0gZmFsc2UsIDEwMCk7XG5cdFx0fSkpO1xuXHRcdGlmICghaXNXaW5kb3dzKSB7XG5cdFx0XHRsZXQgYmFycmllcjogQXV0b09wZW5CYXJyaWVyIHwgdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5hZGQoYWRkb24ub25EaWRSZWNlaXZlQ29tcGxldGlvbnMoKCkgPT4ge1xuXHRcdFx0XHRiYXJyaWVyPy5vcGVuKCk7XG5cdFx0XHRcdGJhcnJpZXIgPSB1bmRlZmluZWQ7XG5cdFx0XHR9KSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfcmVmcmVzaEFkZG9ucygpOiB2b2lkIHtcblx0XHRjb25zdCBhZGRvbiA9IHRoaXMuX2FkZG9uLnZhbHVlO1xuXHRcdGlmICghYWRkb24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0YWRkb24uc2hlbGxUeXBlID0gdGhpcy5fY3R4Lmluc3RhbmNlLnNoZWxsVHlwZTtcblx0XHRpZiAoIXRoaXMuX2N0eC5pbnN0YW5jZS54dGVybT8ucmF3KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdC8vIFJlbGllcyBvbiBzaGVsbCB0eXBlIGJlaW5nIHNldFxuXHRcdHRoaXMuX2xvYWRQd3NoQ29tcGxldGlvbkFkZG9uKHRoaXMuX2N0eC5pbnN0YW5jZS54dGVybS5yYXcpO1xuXHR9XG59XG5cbnJlZ2lzdGVyVGVybWluYWxDb250cmlidXRpb24oVGVybWluYWxTdWdnZXN0Q29udHJpYnV0aW9uLklELCBUZXJtaW5hbFN1Z2dlc3RDb250cmlidXRpb24pO1xuXG4vLyAjZW5kcmVnaW9uXG5cbi8vICNyZWdpb24gQWN0aW9uc1xuXG5yZWdpc3RlclRlcm1pbmFsQWN0aW9uKHtcblx0aWQ6IFRlcm1pbmFsU3VnZ2VzdENvbW1hbmRJZC5Db25maWd1cmVTZXR0aW5ncyxcblx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5jb25maWd1cmVTdWdnZXN0U2V0dGluZ3MnLCAnQ29uZmlndXJlJyksXG5cdGYxOiBmYWxzZSxcblx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIub3IoVGVybWluYWxDb250ZXh0S2V5cy5wcm9jZXNzU3VwcG9ydGVkLCBUZXJtaW5hbENvbnRleHRLZXlzLnRlcm1pbmFsSGFzQmVlbkNyZWF0ZWQpLCBUZXJtaW5hbENvbnRleHRLZXlzLmZvY3VzLCBUZXJtaW5hbENvbnRleHRLZXlzLmlzT3BlbiwgVGVybWluYWxDb250ZXh0S2V5cy5zdWdnZXN0V2lkZ2V0VmlzaWJsZSksXG5cdGtleWJpbmRpbmc6IHtcblx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuQ29tbWEsXG5cdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWJcblx0fSxcblx0bWVudToge1xuXHRcdGlkOiBNZW51SWQuTWVudWJhclRlcm1pbmFsU3VnZ2VzdFN0YXR1c01lbnUsXG5cdFx0Z3JvdXA6ICdyaWdodCcsXG5cdFx0b3JkZXI6IDFcblx0fSxcblx0cnVuOiAoYywgYWNjZXNzb3IpID0+IGFjY2Vzc29yLmdldChJUHJlZmVyZW5jZXNTZXJ2aWNlKS5vcGVuU2V0dGluZ3MoeyBxdWVyeTogdGVybWluYWxTdWdnZXN0Q29uZmlnU2VjdGlvbiB9KVxufSk7XG5cbnJlZ2lzdGVyQWN0aXZlSW5zdGFuY2VBY3Rpb24oe1xuXHRpZDogVGVybWluYWxTdWdnZXN0Q29tbWFuZElkLlJlcXVlc3RDb21wbGV0aW9ucyxcblx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5yZXF1ZXN0Q29tcGxldGlvbnMnLCAnUmVxdWVzdCBDb21wbGV0aW9ucycpLFxuXHRrZXliaW5kaW5nOiB7XG5cdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLlNwYWNlLFxuXHRcdG1hYzogeyBwcmltYXJ5OiBLZXlNb2QuV2luQ3RybCB8IEtleUNvZGUuU3BhY2UgfSxcblx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYiArIDEsXG5cdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFRlcm1pbmFsQ29udGV4dEtleXMuZm9jdXMsIFRlcm1pbmFsQ29udGV4dEtleXMuc3VnZ2VzdFdpZGdldFZpc2libGUubmVnYXRlKCksIENvbnRleHRLZXlFeHByLmVxdWFscyhgY29uZmlnLiR7VGVybWluYWxTdWdnZXN0U2V0dGluZ0lkLkVuYWJsZWR9YCwgdHJ1ZSkpXG5cdH0sXG5cdHJ1bjogKGFjdGl2ZUluc3RhbmNlKSA9PiBUZXJtaW5hbFN1Z2dlc3RDb250cmlidXRpb24uZ2V0KGFjdGl2ZUluc3RhbmNlKT8uYWRkb24/LnJlcXVlc3RDb21wbGV0aW9ucyh0cnVlKVxufSk7XG5cbnJlZ2lzdGVyQWN0aXZlSW5zdGFuY2VBY3Rpb24oe1xuXHRpZDogVGVybWluYWxTdWdnZXN0Q29tbWFuZElkLlJlc2V0V2lkZ2V0U2l6ZSxcblx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5yZXNldFN1Z2dlc3RXaWRnZXRTaXplJywgJ1Jlc2V0IFN1Z2dlc3QgV2lkZ2V0IFNpemUnKSxcblx0cnVuOiAoYWN0aXZlSW5zdGFuY2UpID0+IFRlcm1pbmFsU3VnZ2VzdENvbnRyaWJ1dGlvbi5nZXQoYWN0aXZlSW5zdGFuY2UpPy5hZGRvbj8ucmVzZXRXaWRnZXRTaXplKClcbn0pO1xuXG5yZWdpc3RlckFjdGl2ZUluc3RhbmNlQWN0aW9uKHtcblx0aWQ6IFRlcm1pbmFsU3VnZ2VzdENvbW1hbmRJZC5TZWxlY3RQcmV2U3VnZ2VzdGlvbixcblx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5zZWxlY3RQcmV2U3VnZ2VzdGlvbicsICdTZWxlY3QgdGhlIFByZXZpb3VzIFN1Z2dlc3Rpb24nKSxcblx0ZjE6IGZhbHNlLFxuXHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5vcihUZXJtaW5hbENvbnRleHRLZXlzLnByb2Nlc3NTdXBwb3J0ZWQsIFRlcm1pbmFsQ29udGV4dEtleXMudGVybWluYWxIYXNCZWVuQ3JlYXRlZCksIFRlcm1pbmFsQ29udGV4dEtleXMuZm9jdXMsIFRlcm1pbmFsQ29udGV4dEtleXMuaXNPcGVuLCBUZXJtaW5hbENvbnRleHRLZXlzLnN1Z2dlc3RXaWRnZXRWaXNpYmxlKSxcblx0a2V5YmluZGluZzoge1xuXHRcdC8vIFVwIGlzIGJvdW5kIHRvIG90aGVyIHdvcmtiZW5jaCBrZXliaW5kaW5ncyB0aGF0IHRoaXMgbmVlZHMgdG8gYmVhdFxuXHRcdHByaW1hcnk6IEtleUNvZGUuVXBBcnJvdyxcblx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYiArIDEsXG5cdFx0d2hlbjogQ29udGV4dEtleUV4cHIub3IoU2ltcGxlU3VnZ2VzdENvbnRleHQuSGFzTmF2aWdhdGVkLCBDb250ZXh0S2V5RXhwci5lcXVhbHMoYGNvbmZpZy4ke1Rlcm1pbmFsU3VnZ2VzdFNldHRpbmdJZC5VcEFycm93TmF2aWdhdGVzSGlzdG9yeX1gLCBmYWxzZSkpXG5cdH0sXG5cdHJ1bjogKGFjdGl2ZUluc3RhbmNlKSA9PiBUZXJtaW5hbFN1Z2dlc3RDb250cmlidXRpb24uZ2V0KGFjdGl2ZUluc3RhbmNlKT8uYWRkb24/LnNlbGVjdFByZXZpb3VzU3VnZ2VzdGlvbigpXG59KTtcblxucmVnaXN0ZXJBY3RpdmVJbnN0YW5jZUFjdGlvbih7XG5cdGlkOiBUZXJtaW5hbFN1Z2dlc3RDb21tYW5kSWQuU2VsZWN0UHJldlBhZ2VTdWdnZXN0aW9uLFxuXHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnNlbGVjdFByZXZQYWdlU3VnZ2VzdGlvbicsICdTZWxlY3QgdGhlIFByZXZpb3VzIFBhZ2UgU3VnZ2VzdGlvbicpLFxuXHRmMTogZmFsc2UsXG5cdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnRleHRLZXlFeHByLm9yKFRlcm1pbmFsQ29udGV4dEtleXMucHJvY2Vzc1N1cHBvcnRlZCwgVGVybWluYWxDb250ZXh0S2V5cy50ZXJtaW5hbEhhc0JlZW5DcmVhdGVkKSwgVGVybWluYWxDb250ZXh0S2V5cy5mb2N1cywgVGVybWluYWxDb250ZXh0S2V5cy5pc09wZW4sIFRlcm1pbmFsQ29udGV4dEtleXMuc3VnZ2VzdFdpZGdldFZpc2libGUpLFxuXHRrZXliaW5kaW5nOiB7XG5cdFx0Ly8gVXAgaXMgYm91bmQgdG8gb3RoZXIgd29ya2JlbmNoIGtleWJpbmRpbmdzIHRoYXQgdGhpcyBuZWVkcyB0byBiZWF0XG5cdFx0cHJpbWFyeTogS2V5Q29kZS5QYWdlVXAsXG5cdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIgKyAxXG5cdH0sXG5cdHJ1bjogKGFjdGl2ZUluc3RhbmNlKSA9PiBUZXJtaW5hbFN1Z2dlc3RDb250cmlidXRpb24uZ2V0KGFjdGl2ZUluc3RhbmNlKT8uYWRkb24/LnNlbGVjdFByZXZpb3VzUGFnZVN1Z2dlc3Rpb24oKVxufSk7XG5cbnJlZ2lzdGVyQWN0aXZlSW5zdGFuY2VBY3Rpb24oe1xuXHRpZDogVGVybWluYWxTdWdnZXN0Q29tbWFuZElkLlNlbGVjdE5leHRTdWdnZXN0aW9uLFxuXHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnNlbGVjdE5leHRTdWdnZXN0aW9uJywgJ1NlbGVjdCB0aGUgTmV4dCBTdWdnZXN0aW9uJyksXG5cdGYxOiBmYWxzZSxcblx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIub3IoVGVybWluYWxDb250ZXh0S2V5cy5wcm9jZXNzU3VwcG9ydGVkLCBUZXJtaW5hbENvbnRleHRLZXlzLnRlcm1pbmFsSGFzQmVlbkNyZWF0ZWQpLCBUZXJtaW5hbENvbnRleHRLZXlzLmZvY3VzLCBUZXJtaW5hbENvbnRleHRLZXlzLmlzT3BlbiwgVGVybWluYWxDb250ZXh0S2V5cy5zdWdnZXN0V2lkZ2V0VmlzaWJsZSksXG5cdGtleWJpbmRpbmc6IHtcblx0XHQvLyBEb3duIGlzIGJvdW5kIHRvIG90aGVyIHdvcmtiZW5jaCBrZXliaW5kaW5ncyB0aGF0IHRoaXMgbmVlZHMgdG8gYmVhdFxuXHRcdHByaW1hcnk6IEtleUNvZGUuRG93bkFycm93LFxuXHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliICsgMVxuXHR9LFxuXHRydW46IChhY3RpdmVJbnN0YW5jZSkgPT4gVGVybWluYWxTdWdnZXN0Q29udHJpYnV0aW9uLmdldChhY3RpdmVJbnN0YW5jZSk/LmFkZG9uPy5zZWxlY3ROZXh0U3VnZ2VzdGlvbigpXG59KTtcblxucmVnaXN0ZXJBY3RpdmVJbnN0YW5jZUFjdGlvbih7XG5cdGlkOiAndGVybWluYWxTdWdnZXN0VG9nZ2xlRXhwbGFpbk1vZGUnLFxuXHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnN1Z2dlc3RUb2dnbGVFeHBsYWluTW9kZScsICdTdWdnZXN0IFRvZ2dsZSBFeHBsYWluIE1vZGVzJyksXG5cdGYxOiBmYWxzZSxcblx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIub3IoVGVybWluYWxDb250ZXh0S2V5cy5wcm9jZXNzU3VwcG9ydGVkLCBUZXJtaW5hbENvbnRleHRLZXlzLnRlcm1pbmFsSGFzQmVlbkNyZWF0ZWQpLCBUZXJtaW5hbENvbnRleHRLZXlzLmZvY3VzLCBUZXJtaW5hbENvbnRleHRLZXlzLmlzT3BlbiwgVGVybWluYWxDb250ZXh0S2V5cy5zdWdnZXN0V2lkZ2V0VmlzaWJsZSksXG5cdGtleWJpbmRpbmc6IHtcblx0XHQvLyBEb3duIGlzIGJvdW5kIHRvIG90aGVyIHdvcmtiZW5jaCBrZXliaW5kaW5ncyB0aGF0IHRoaXMgbmVlZHMgdG8gYmVhdFxuXHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliICsgMSxcblx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuU2xhc2gsXG5cdH0sXG5cdHJ1bjogKGFjdGl2ZUluc3RhbmNlKSA9PiBUZXJtaW5hbFN1Z2dlc3RDb250cmlidXRpb24uZ2V0KGFjdGl2ZUluc3RhbmNlKT8uYWRkb24/LnRvZ2dsZUV4cGxhaW5Nb2RlKClcbn0pO1xuXG5yZWdpc3RlckFjdGl2ZUluc3RhbmNlQWN0aW9uKHtcblx0aWQ6IFRlcm1pbmFsU3VnZ2VzdENvbW1hbmRJZC5Ub2dnbGVEZXRhaWxzRm9jdXMsXG5cdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuc3VnZ2VzdFRvZ2dsZURldGFpbHNGb2N1cycsICdTdWdnZXN0IFRvZ2dsZSBTdWdnZXN0aW9uIEZvY3VzJyksXG5cdGYxOiBmYWxzZSxcblx0Ly8gSEFDSzogVGhpcyBkb2VzIG5vdCB3b3JrIHdpdGggYSBwcmVjb25kaXRpb24gb2YgYFRlcm1pbmFsQ29udGV4dEtleXMuc3VnZ2VzdFdpZGdldFZpc2libGVgLCBzbyBtYWtlIHN1cmUgdG8gbm90IG92ZXJyaWRlIHRoZSBlZGl0b3IncyBrZXliaW5kaW5nXG5cdHByZWNvbmRpdGlvbjogRWRpdG9yQ29udGV4dEtleXMudGV4dElucHV0Rm9jdXMubmVnYXRlKCksXG5cdGtleWJpbmRpbmc6IHtcblx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5BbHQgfCBLZXlDb2RlLlNwYWNlLFxuXHRcdG1hYzogeyBwcmltYXJ5OiBLZXlNb2QuV2luQ3RybCB8IEtleU1vZC5BbHQgfCBLZXlDb2RlLlNwYWNlIH1cblx0fSxcblx0cnVuOiAoYWN0aXZlSW5zdGFuY2UpID0+IFRlcm1pbmFsU3VnZ2VzdENvbnRyaWJ1dGlvbi5nZXQoYWN0aXZlSW5zdGFuY2UpPy5hZGRvbj8udG9nZ2xlU3VnZ2VzdGlvbkZvY3VzKClcbn0pO1xuXG5yZWdpc3RlckFjdGl2ZUluc3RhbmNlQWN0aW9uKHtcblx0aWQ6IFRlcm1pbmFsU3VnZ2VzdENvbW1hbmRJZC5Ub2dnbGVEZXRhaWxzLFxuXHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnN1Z2dlc3RUb2dnbGVEZXRhaWxzJywgJ1N1Z2dlc3QgVG9nZ2xlIERldGFpbHMnKSxcblx0ZjE6IGZhbHNlLFxuXHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5vcihUZXJtaW5hbENvbnRleHRLZXlzLnByb2Nlc3NTdXBwb3J0ZWQsIFRlcm1pbmFsQ29udGV4dEtleXMudGVybWluYWxIYXNCZWVuQ3JlYXRlZCksIFRlcm1pbmFsQ29udGV4dEtleXMuaXNPcGVuLCBUZXJtaW5hbENvbnRleHRLZXlzLmZvY3VzLCBUZXJtaW5hbENvbnRleHRLZXlzLnN1Z2dlc3RXaWRnZXRWaXNpYmxlLCBTaW1wbGVTdWdnZXN0Q29udGV4dC5IYXNGb2N1c2VkU3VnZ2VzdGlvbiksXG5cdGtleWJpbmRpbmc6IHtcblx0XHQvLyBIQUNLOiBGb3JjZSB3ZWlnaHQgdG8gYmUgaGlnaGVyIHRoYW4gdGhhdCB0byBzdGFydCB0ZXJtaW5hbCBjaGF0XG5cdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkV4dGVybmFsRXh0ZW5zaW9uICsgMixcblx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuU3BhY2UsXG5cdFx0c2Vjb25kYXJ5OiBbS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUldLFxuXHRcdG1hYzogeyBwcmltYXJ5OiBLZXlNb2QuV2luQ3RybCB8IEtleUNvZGUuU3BhY2UsIHNlY29uZGFyeTogW0tleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlJXSB9XG5cdH0sXG5cdHJ1bjogKGFjdGl2ZUluc3RhbmNlKSA9PiBUZXJtaW5hbFN1Z2dlc3RDb250cmlidXRpb24uZ2V0KGFjdGl2ZUluc3RhbmNlKT8uYWRkb24/LnRvZ2dsZVN1Z2dlc3Rpb25EZXRhaWxzKClcbn0pO1xuXG5yZWdpc3RlckFjdGl2ZUluc3RhbmNlQWN0aW9uKHtcblx0aWQ6IFRlcm1pbmFsU3VnZ2VzdENvbW1hbmRJZC5TZWxlY3ROZXh0UGFnZVN1Z2dlc3Rpb24sXG5cdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuc2VsZWN0TmV4dFBhZ2VTdWdnZXN0aW9uJywgJ1NlbGVjdCB0aGUgTmV4dCBQYWdlIFN1Z2dlc3Rpb24nKSxcblx0ZjE6IGZhbHNlLFxuXHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5vcihUZXJtaW5hbENvbnRleHRLZXlzLnByb2Nlc3NTdXBwb3J0ZWQsIFRlcm1pbmFsQ29udGV4dEtleXMudGVybWluYWxIYXNCZWVuQ3JlYXRlZCksIFRlcm1pbmFsQ29udGV4dEtleXMuZm9jdXMsIFRlcm1pbmFsQ29udGV4dEtleXMuaXNPcGVuLCBUZXJtaW5hbENvbnRleHRLZXlzLnN1Z2dlc3RXaWRnZXRWaXNpYmxlKSxcblx0a2V5YmluZGluZzoge1xuXHRcdC8vIERvd24gaXMgYm91bmQgdG8gb3RoZXIgd29ya2JlbmNoIGtleWJpbmRpbmdzIHRoYXQgdGhpcyBuZWVkcyB0byBiZWF0XG5cdFx0cHJpbWFyeTogS2V5Q29kZS5QYWdlRG93bixcblx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYiArIDFcblx0fSxcblx0cnVuOiAoYWN0aXZlSW5zdGFuY2UpID0+IFRlcm1pbmFsU3VnZ2VzdENvbnRyaWJ1dGlvbi5nZXQoYWN0aXZlSW5zdGFuY2UpPy5hZGRvbj8uc2VsZWN0TmV4dFBhZ2VTdWdnZXN0aW9uKClcbn0pO1xuXG5yZWdpc3RlckFjdGl2ZUluc3RhbmNlQWN0aW9uKHtcblx0aWQ6IFRlcm1pbmFsU3VnZ2VzdENvbW1hbmRJZC5BY2NlcHRTZWxlY3RlZFN1Z2dlc3Rpb24sXG5cdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuYWNjZXB0U2VsZWN0ZWRTdWdnZXN0aW9uJywgJ0luc2VydCcpLFxuXHRmMTogZmFsc2UsXG5cdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnRleHRLZXlFeHByLm9yKFRlcm1pbmFsQ29udGV4dEtleXMucHJvY2Vzc1N1cHBvcnRlZCwgVGVybWluYWxDb250ZXh0S2V5cy50ZXJtaW5hbEhhc0JlZW5DcmVhdGVkKSwgVGVybWluYWxDb250ZXh0S2V5cy5mb2N1cywgVGVybWluYWxDb250ZXh0S2V5cy5pc09wZW4sIFRlcm1pbmFsQ29udGV4dEtleXMuc3VnZ2VzdFdpZGdldFZpc2libGUpLFxuXHRrZXliaW5kaW5nOiB7XG5cdFx0cHJpbWFyeTogS2V5Q29kZS5UYWIsXG5cdFx0Ly8gVGFiIGlzIGJvdW5kIHRvIG90aGVyIHdvcmtiZW5jaCBrZXliaW5kaW5ncyB0aGF0IHRoaXMgbmVlZHMgdG8gYmVhdFxuXHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliICsgMVxuXHR9LFxuXHRtZW51OiB7XG5cdFx0aWQ6IE1lbnVJZC5NZW51YmFyVGVybWluYWxTdWdnZXN0U3RhdHVzTWVudSxcblx0XHRvcmRlcjogMSxcblx0XHRncm91cDogJ2xlZnQnXG5cdH0sXG5cdHJ1bjogKGFjdGl2ZUluc3RhbmNlKSA9PiBUZXJtaW5hbFN1Z2dlc3RDb250cmlidXRpb24uZ2V0KGFjdGl2ZUluc3RhbmNlKT8uYWRkb24/LmFjY2VwdFNlbGVjdGVkU3VnZ2VzdGlvbigpXG59KTtcblxucmVnaXN0ZXJBY3RpdmVJbnN0YW5jZUFjdGlvbih7XG5cdGlkOiBUZXJtaW5hbFN1Z2dlc3RDb21tYW5kSWQuQWNjZXB0U2VsZWN0ZWRTdWdnZXN0aW9uRW50ZXIsXG5cdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuYWNjZXB0U2VsZWN0ZWRTdWdnZXN0aW9uRW50ZXInLCAnQWNjZXB0IFNlbGVjdGVkIFN1Z2dlc3Rpb24gKEVudGVyKScpLFxuXHRmMTogZmFsc2UsXG5cdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnRleHRLZXlFeHByLm9yKFRlcm1pbmFsQ29udGV4dEtleXMucHJvY2Vzc1N1cHBvcnRlZCwgVGVybWluYWxDb250ZXh0S2V5cy50ZXJtaW5hbEhhc0JlZW5DcmVhdGVkKSwgVGVybWluYWxDb250ZXh0S2V5cy5mb2N1cywgVGVybWluYWxDb250ZXh0S2V5cy5pc09wZW4sIFRlcm1pbmFsQ29udGV4dEtleXMuc3VnZ2VzdFdpZGdldFZpc2libGUpLFxuXHRrZXliaW5kaW5nOiB7XG5cdFx0cHJpbWFyeTogS2V5Q29kZS5FbnRlcixcblx0XHQvLyBFbnRlciBpcyBib3VuZCB0byBvdGhlciB3b3JrYmVuY2gga2V5YmluZGluZ3MgdGhhdCB0aGlzIG5lZWRzIHRvIGJlYXRcblx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYiArIDEsXG5cdFx0d2hlbjogQ29udGV4dEtleUV4cHIubm90RXF1YWxzKGBjb25maWcuJHtUZXJtaW5hbFN1Z2dlc3RTZXR0aW5nSWQuUnVuT25FbnRlcn1gLCAnaWdub3JlJyksXG5cdH0sXG5cdHJ1bjogYXN5bmMgKGFjdGl2ZUluc3RhbmNlKSA9PiBUZXJtaW5hbFN1Z2dlc3RDb250cmlidXRpb24uZ2V0KGFjdGl2ZUluc3RhbmNlKT8uYWRkb24/LmFjY2VwdFNlbGVjdGVkU3VnZ2VzdGlvbih1bmRlZmluZWQsIHRydWUpXG59KTtcblxucmVnaXN0ZXJBY3RpdmVJbnN0YW5jZUFjdGlvbih7XG5cdGlkOiBUZXJtaW5hbFN1Z2dlc3RDb21tYW5kSWQuSGlkZVN1Z2dlc3RXaWRnZXQsXG5cdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuaGlkZVN1Z2dlc3RXaWRnZXQnLCAnSGlkZSBTdWdnZXN0IFdpZGdldCcpLFxuXHRmMTogZmFsc2UsXG5cdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnRleHRLZXlFeHByLm9yKFRlcm1pbmFsQ29udGV4dEtleXMucHJvY2Vzc1N1cHBvcnRlZCwgVGVybWluYWxDb250ZXh0S2V5cy50ZXJtaW5hbEhhc0JlZW5DcmVhdGVkKSwgVGVybWluYWxDb250ZXh0S2V5cy5mb2N1cywgVGVybWluYWxDb250ZXh0S2V5cy5pc09wZW4sIFRlcm1pbmFsQ29udGV4dEtleXMuc3VnZ2VzdFdpZGdldFZpc2libGUpLFxuXHRrZXliaW5kaW5nOiB7XG5cdFx0cHJpbWFyeTogS2V5Q29kZS5Fc2NhcGUsXG5cdFx0Ly8gRXNjYXBlIGlzIGJvdW5kIHRvIG90aGVyIHdvcmtiZW5jaCBrZXliaW5kaW5ncyB0aGF0IHRoaXMgbmVlZHMgdG8gYmVhdFxuXHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliICsgMVxuXHR9LFxuXHRydW46IChhY3RpdmVJbnN0YW5jZSkgPT4gVGVybWluYWxTdWdnZXN0Q29udHJpYnV0aW9uLmdldChhY3RpdmVJbnN0YW5jZSk/LmFkZG9uPy5oaWRlU3VnZ2VzdFdpZGdldCh0cnVlKVxufSk7XG5cbnJlZ2lzdGVyQWN0aXZlSW5zdGFuY2VBY3Rpb24oe1xuXHRpZDogVGVybWluYWxTdWdnZXN0Q29tbWFuZElkLkhpZGVTdWdnZXN0V2lkZ2V0QW5kTmF2aWdhdGVIaXN0b3J5LFxuXHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLmhpZGVTdWdnZXN0V2lkZ2V0QW5kTmF2aWdhdGVIaXN0b3J5JywgJ0hpZGUgU3VnZ2VzdCBXaWRnZXQgYW5kIE5hdmlnYXRlIEhpc3RvcnknKSxcblx0ZjE6IGZhbHNlLFxuXHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5vcihUZXJtaW5hbENvbnRleHRLZXlzLnByb2Nlc3NTdXBwb3J0ZWQsIFRlcm1pbmFsQ29udGV4dEtleXMudGVybWluYWxIYXNCZWVuQ3JlYXRlZCksIFRlcm1pbmFsQ29udGV4dEtleXMuZm9jdXMsIFRlcm1pbmFsQ29udGV4dEtleXMuaXNPcGVuLCBUZXJtaW5hbENvbnRleHRLZXlzLnN1Z2dlc3RXaWRnZXRWaXNpYmxlKSxcblx0a2V5YmluZGluZzpcblx0e1xuXHRcdHByaW1hcnk6IEtleUNvZGUuVXBBcnJvdyxcblx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoU2ltcGxlU3VnZ2VzdENvbnRleHQuSGFzTmF2aWdhdGVkLm5lZ2F0ZSgpLCBDb250ZXh0S2V5RXhwci5lcXVhbHMoYGNvbmZpZy4ke1Rlcm1pbmFsU3VnZ2VzdFNldHRpbmdJZC5VcEFycm93TmF2aWdhdGVzSGlzdG9yeX1gLCB0cnVlKSksXG5cdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIgKyAyXG5cdH0sXG5cdHJ1bjogKGFjdGl2ZUluc3RhbmNlKSA9PiB7XG5cdFx0VGVybWluYWxTdWdnZXN0Q29udHJpYnV0aW9uLmdldChhY3RpdmVJbnN0YW5jZSk/LmFkZG9uPy5oaWRlU3VnZ2VzdFdpZGdldCh0cnVlKTtcblx0XHRhY3RpdmVJbnN0YW5jZS5zZW5kVGV4dCgnXFx1MDAxYltBJywgZmFsc2UpOyAvLyBVcCBhcnJvd1xuXHR9XG59KTtcblxuLy8gI2VuZHJlZ2lvblxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFNQSxZQUFZLFNBQVM7QUFDckIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsU0FBUyxjQUFjO0FBQ2hDLFNBQVMsaUJBQWlCLG1CQUFtQixvQkFBb0I7QUFDakUsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxnQkFBNkIsMEJBQTBCO0FBQ2hFLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsa0JBQWtCLHdCQUF3QjtBQUVuRCxTQUFTLDhCQUE4Qiw4QkFBOEI7QUFDckUsU0FBUyxvQ0FBdUU7QUFDaEYsU0FBUywyQkFBMkI7QUFD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
