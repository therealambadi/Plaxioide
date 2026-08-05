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
import { renderFormattedText } from "../../../../../base/browser/formattedTextRenderer.js";
import { StandardMouseEvent } from "../../../../../base/browser/mouseEvent.js";
import { status } from "../../../../../base/browser/ui/aria/aria.js";
import { KeybindingLabel } from "../../../../../base/browser/ui/keybindingLabel/keybindingLabel.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { OS } from "../../../../../base/common/platform.js";
import { localize } from "../../../../../nls.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { TerminalCapability } from "../../../../../platform/terminal/common/capabilities/capabilities.js";
import { AccessibilityVerbositySettingId } from "../../../accessibility/browser/accessibilityConfiguration.js";
import { IChatAgentService } from "../../../chat/common/chatAgents.js";
import { ITerminalEditorService, ITerminalGroupService, ITerminalService } from "../../../terminal/browser/terminal.js";
import { registerTerminalContribution } from "../../../terminal/browser/terminalExtensions.js";
import { TerminalInstance } from "../../../terminal/browser/terminalInstance.js";
import { TerminalInitialHintSettingId } from "../common/terminalInitialHintConfiguration.js";
import "./media/terminalInitialHint.css";
import { TerminalChatCommandId } from "./terminalChat.js";
import { ChatAgentLocation } from "../../../chat/common/constants.js";
const $ = dom.$;
var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2["InitialHintHideStorageKey"] = "terminal.initialHint.hide";
  return Constants2;
})(Constants || {});
class InitialHintAddon extends Disposable {
  constructor(_capabilities, _onDidChangeAgents) {
    super();
    this._capabilities = _capabilities;
    this._onDidChangeAgents = _onDidChangeAgents;
    this._onDidRequestCreateHint = this._register(new Emitter());
    this._disposables = this._register(new MutableDisposable());
  }
  get onDidRequestCreateHint() {
    return this._onDidRequestCreateHint.event;
  }
  activate(terminal) {
    const store = this._register(new DisposableStore());
    this._disposables.value = store;
    const capability = this._capabilities.get(TerminalCapability.CommandDetection);
    if (capability) {
      store.add(Event.once(capability.promptInputModel.onDidStartInput)(() => this._onDidRequestCreateHint.fire()));
    } else {
      this._register(this._capabilities.onDidAddCapability((e) => {
        if (e.id === TerminalCapability.CommandDetection) {
          const capability2 = e.capability;
          store.add(Event.once(capability2.promptInputModel.onDidStartInput)(() => this._onDidRequestCreateHint.fire()));
          if (!capability2.promptInputModel.value) {
            this._onDidRequestCreateHint.fire();
          }
        }
      }));
    }
    const agentListener = this._onDidChangeAgents((e) => {
      if (e?.locations.includes(ChatAgentLocation.Terminal)) {
        this._onDidRequestCreateHint.fire();
        agentListener.dispose();
      }
    });
    this._disposables.value?.add(agentListener);
  }
}
let TerminalInitialHintContribution = class extends Disposable {
  constructor(_ctx, _chatAgentService, _configurationService, _instantiationService, _storageService, _terminalEditorService, _terminalGroupService) {
    super();
    this._ctx = _ctx;
    this._chatAgentService = _chatAgentService;
    this._configurationService = _configurationService;
    this._instantiationService = _instantiationService;
    this._storageService = _storageService;
    this._terminalEditorService = _terminalEditorService;
    this._terminalGroupService = _terminalGroupService;
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(TerminalInitialHintSettingId.Enabled)) {
        this._storageService.remove("terminal.initialHint.hide" /* InitialHintHideStorageKey */, StorageScope.APPLICATION);
      }
    }));
  }
  static get(instance) {
    return instance.getContribution(TerminalInitialHintContribution.ID);
  }
  xtermOpen(xterm) {
    if ("shellLaunchConfig" in this._ctx.instance && (this._ctx.instance.shellLaunchConfig.isExtensionOwnedTerminal || this._ctx.instance.shellLaunchConfig.isFeatureTerminal)) {
      return;
    }
    if (this._storageService.getBoolean("terminal.initialHint.hide" /* InitialHintHideStorageKey */, StorageScope.APPLICATION, false)) {
      return;
    }
    if (this._terminalGroupService.instances.length + this._terminalEditorService.instances.length !== 1) {
      return;
    }
    this._xterm = xterm;
    this._addon = this._register(this._instantiationService.createInstance(InitialHintAddon, this._ctx.instance.capabilities, this._chatAgentService.onDidChangeAgents));
    this._xterm.raw.loadAddon(this._addon);
    this._register(this._addon.onDidRequestCreateHint(() => this._createHint()));
  }
  _createHint() {
    const instance = this._ctx.instance instanceof TerminalInstance ? this._ctx.instance : void 0;
    const commandDetectionCapability = instance?.capabilities.get(TerminalCapability.CommandDetection);
    if (!instance || !this._xterm || this._hintWidget || !commandDetectionCapability || commandDetectionCapability.promptInputModel.value || !!instance.shellLaunchConfig.attachPersistentProcess) {
      return;
    }
    if (!this._configurationService.getValue(TerminalInitialHintSettingId.Enabled)) {
      return;
    }
    if (!this._decoration) {
      const marker = this._xterm.raw.registerMarker();
      if (!marker) {
        return;
      }
      if (this._xterm.raw.buffer.active.cursorX === 0) {
        return;
      }
      this._register(marker);
      this._decoration = this._xterm.raw.registerDecoration({
        marker,
        x: this._xterm.raw.buffer.active.cursorX + 1
      });
      if (this._decoration) {
        this._register(this._decoration);
      }
    }
    this._register(this._xterm.raw.onKey(() => this.dispose()));
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(TerminalInitialHintSettingId.Enabled) && !this._configurationService.getValue(TerminalInitialHintSettingId.Enabled)) {
        this.dispose();
      }
    }));
    const inputModel = commandDetectionCapability.promptInputModel;
    if (inputModel) {
      this._register(inputModel.onDidChangeInput(() => {
        if (inputModel.value) {
          this.dispose();
        }
      }));
    }
    if (!this._decoration) {
      return;
    }
    this._register(this._decoration);
    this._register(this._decoration.onRender((e) => {
      if (!this._hintWidget && this._xterm?.isFocused && this._terminalGroupService.instances.length + this._terminalEditorService.instances.length === 1) {
        const terminalAgents = this._chatAgentService.getActivatedAgents().filter((candidate) => candidate.locations.includes(ChatAgentLocation.Terminal));
        if (terminalAgents?.length) {
          const widget = this._register(this._instantiationService.createInstance(TerminalInitialHintWidget, instance));
          this._addon?.dispose();
          this._hintWidget = widget.getDomNode(terminalAgents);
          if (!this._hintWidget) {
            return;
          }
          e.appendChild(this._hintWidget);
          e.classList.add("terminal-initial-hint");
          const font = this._xterm.getFont();
          if (font) {
            e.style.fontFamily = font.fontFamily;
            e.style.fontSize = font.fontSize + "px";
          }
        }
      }
      if (this._hintWidget && this._xterm) {
        const decoration = this._hintWidget.parentElement;
        if (decoration) {
          decoration.style.width = (this._xterm.raw.cols - this._xterm.raw.buffer.active.cursorX) / this._xterm.raw.cols * 100 + "%";
        }
      }
    }));
  }
};
TerminalInitialHintContribution.ID = "terminal.initialHint";
TerminalInitialHintContribution = __decorateClass([
  __decorateParam(1, IChatAgentService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, ITerminalEditorService),
  __decorateParam(6, ITerminalGroupService)
], TerminalInitialHintContribution);
registerTerminalContribution(TerminalInitialHintContribution.ID, TerminalInitialHintContribution, false);
let TerminalInitialHintWidget = class extends Disposable {
  constructor(_instance, _chatAgentService, _commandService, _configurationService, _contextMenuService, _keybindingService, _productService, _storageService, _telemetryService, _terminalService) {
    super();
    this._instance = _instance;
    this._chatAgentService = _chatAgentService;
    this._commandService = _commandService;
    this._configurationService = _configurationService;
    this._contextMenuService = _contextMenuService;
    this._keybindingService = _keybindingService;
    this._productService = _productService;
    this._storageService = _storageService;
    this._telemetryService = _telemetryService;
    this._terminalService = _terminalService;
    this._toDispose = this._register(new DisposableStore());
    this._isVisible = false;
    this._ariaLabel = "";
    this._toDispose.add(_instance.onDidFocus(() => {
      if (this._instance.hasFocus && this._isVisible && this._ariaLabel && this._configurationService.getValue(AccessibilityVerbositySettingId.TerminalChat)) {
        status(this._ariaLabel);
      }
    }));
    this._toDispose.add(_terminalService.onDidChangeInstances(() => {
      if (this._terminalService.instances.length !== 1) {
        this.dispose();
      }
    }));
    this._toDispose.add(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(TerminalInitialHintSettingId.Enabled) && !this._configurationService.getValue(TerminalInitialHintSettingId.Enabled)) {
        this.dispose();
      }
    }));
  }
  _getHintInlineChat(agents) {
    let providerName = (agents.length === 1 ? agents[0].fullName : void 0) ?? this._productService.nameShort;
    const defaultAgent = this._chatAgentService.getDefaultAgent(ChatAgentLocation.Panel);
    if (defaultAgent?.extensionId.value === agents[0].extensionId.value) {
      providerName = defaultAgent.fullName ?? providerName;
    }
    let ariaLabel = `Ask ${providerName} something or start typing to dismiss.`;
    const handleClick = () => {
      this._storageService.store("terminal.initialHint.hide" /* InitialHintHideStorageKey */, true, StorageScope.APPLICATION, StorageTarget.USER);
      this._telemetryService.publicLog2("workbenchActionExecuted", {
        id: "terminalInlineChat.hintAction",
        from: "hint"
      });
      this._commandService.executeCommand(TerminalChatCommandId.Start, { from: "hint" });
    };
    this._toDispose.add(this._commandService.onDidExecuteCommand((e) => {
      if (e.commandId === TerminalChatCommandId.Start) {
        this._storageService.store("terminal.initialHint.hide" /* InitialHintHideStorageKey */, true, StorageScope.APPLICATION, StorageTarget.USER);
        this.dispose();
      }
    }));
    const hintHandler = {
      disposables: this._toDispose,
      callback: (index, _event) => {
        switch (index) {
          case "0":
            handleClick();
            break;
        }
      }
    };
    const hintElement = $("div.terminal-initial-hint");
    hintElement.style.display = "block";
    const keybindingHint = this._keybindingService.lookupKeybinding(TerminalChatCommandId.Start);
    const keybindingHintLabel = keybindingHint?.getLabel();
    if (keybindingHint && keybindingHintLabel) {
      const actionPart = localize("emptyHintText", "Press {0} to ask {1} to do something. ", keybindingHintLabel, providerName);
      const [before, after] = actionPart.split(keybindingHintLabel).map((fragment) => {
        const hintPart = $("a", void 0, fragment);
        this._toDispose.add(dom.addDisposableListener(hintPart, dom.EventType.CLICK, handleClick));
        return hintPart;
      });
      hintElement.appendChild(before);
      const label = hintHandler.disposables.add(new KeybindingLabel(hintElement, OS));
      label.set(keybindingHint);
      label.element.style.width = "min-content";
      label.element.style.display = "inline";
      label.element.style.cursor = "pointer";
      this._toDispose.add(dom.addDisposableListener(label.element, dom.EventType.CLICK, handleClick));
      hintElement.appendChild(after);
      const typeToDismiss = localize("hintTextDismiss", "Start typing to dismiss.");
      const textHint2 = $("span.detail", void 0, typeToDismiss);
      hintElement.appendChild(textHint2);
      ariaLabel = actionPart.concat(typeToDismiss);
    } else {
      const hintMsg = localize({
        key: "inlineChatHint",
        comment: [
          "Preserve double-square brackets and their order"
        ]
      }, "[[Ask {0} to do something]] or start typing to dismiss.", providerName);
      const rendered = renderFormattedText(hintMsg, { actionHandler: hintHandler });
      hintElement.appendChild(rendered);
    }
    return { ariaLabel, hintHandler, hintElement };
  }
  getDomNode(agents) {
    if (!this._domNode) {
      this._domNode = $(".terminal-initial-hint");
      this._domNode.style.paddingLeft = "4px";
      const { hintElement, ariaLabel } = this._getHintInlineChat(agents);
      this._domNode.append(hintElement);
      this._ariaLabel = ariaLabel.concat(localize("disableHint", " Toggle {0} in settings to disable this hint.", AccessibilityVerbositySettingId.TerminalChat));
      this._toDispose.add(dom.addDisposableListener(this._domNode, "click", () => {
        this._domNode?.remove();
        this._domNode = void 0;
      }));
      this._toDispose.add(dom.addDisposableListener(this._domNode, dom.EventType.CONTEXT_MENU, (e) => {
        this._contextMenuService.showContextMenu({
          getAnchor: () => {
            return new StandardMouseEvent(dom.getActiveWindow(), e);
          },
          getActions: () => {
            return [
              {
                id: "workench.action.disableTerminalInitialHint",
                label: localize("disableInitialHint", "Disable Initial Hint"),
                tooltip: localize("disableInitialHint", "Disable Initial Hint"),
                enabled: true,
                class: void 0,
                run: () => this._configurationService.updateValue(TerminalInitialHintSettingId.Enabled, false)
              }
            ];
          }
        });
      }));
    }
    return this._domNode;
  }
  dispose() {
    this._domNode?.remove();
    super.dispose();
  }
};
TerminalInitialHintWidget = __decorateClass([
  __decorateParam(1, IChatAgentService),
  __decorateParam(2, ICommandService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, IKeybindingService),
  __decorateParam(6, IProductService),
  __decorateParam(7, IStorageService),
  __decorateParam(8, ITelemetryService),
  __decorateParam(9, ITerminalService)
], TerminalInitialHintWidget);
export {
  InitialHintAddon,
  TerminalInitialHintContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvY2hhdC9icm93c2VyL3Rlcm1pbmFsLmluaXRpYWxIaW50LmNvbnRyaWJ1dGlvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5pbXBvcnQgdHlwZSB7IElEZWNvcmF0aW9uLCBJVGVybWluYWxBZGRvbiwgVGVybWluYWwgYXMgUmF3WHRlcm1UZXJtaW5hbCB9IGZyb20gJ0B4dGVybS94dGVybSc7XG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBJQ29udGVudEFjdGlvbkhhbmRsZXIsIHJlbmRlckZvcm1hdHRlZFRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZm9ybWF0dGVkVGV4dFJlbmRlcmVyLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkTW91c2VFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9tb3VzZUV2ZW50LmpzJztcbmltcG9ydCB7IHN0YXR1cyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hcmlhL2FyaWEuanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ0xhYmVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2tleWJpbmRpbmdMYWJlbC9rZXliaW5kaW5nTGFiZWwuanMnO1xuaW1wb3J0IHsgV29ya2JlbmNoQWN0aW9uRXhlY3V0ZWRDbGFzc2lmaWNhdGlvbiwgV29ya2JlbmNoQWN0aW9uRXhlY3V0ZWRFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIE11dGFibGVEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IE9TIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IElUZXJtaW5hbENhcGFiaWxpdHlTdG9yZSwgVGVybWluYWxDYXBhYmlsaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL2NhcGFiaWxpdGllcy9jYXBhYmlsaXRpZXMuanMnO1xuaW1wb3J0IHsgQWNjZXNzaWJpbGl0eVZlcmJvc2l0eVNldHRpbmdJZCB9IGZyb20gJy4uLy4uLy4uL2FjY2Vzc2liaWxpdHkvYnJvd3Nlci9hY2Nlc3NpYmlsaXR5Q29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ2hhdEFnZW50LCBJQ2hhdEFnZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NoYXQvY29tbW9uL2NoYXRBZ2VudHMuanMnO1xuaW1wb3J0IHsgSURldGFjaGVkVGVybWluYWxJbnN0YW5jZSwgSVRlcm1pbmFsQ29udHJpYnV0aW9uLCBJVGVybWluYWxFZGl0b3JTZXJ2aWNlLCBJVGVybWluYWxHcm91cFNlcnZpY2UsIElUZXJtaW5hbEluc3RhbmNlLCBJVGVybWluYWxTZXJ2aWNlLCBJWHRlcm1UZXJtaW5hbCB9IGZyb20gJy4uLy4uLy4uL3Rlcm1pbmFsL2Jyb3dzZXIvdGVybWluYWwuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJUZXJtaW5hbENvbnRyaWJ1dGlvbiwgdHlwZSBJRGV0YWNoZWRDb21wYXRpYmxlVGVybWluYWxDb250cmlidXRpb25Db250ZXh0LCB0eXBlIElUZXJtaW5hbENvbnRyaWJ1dGlvbkNvbnRleHQgfSBmcm9tICcuLi8uLi8uLi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbEluc3RhbmNlIH0gZnJvbSAnLi4vLi4vLi4vdGVybWluYWwvYnJvd3Nlci90ZXJtaW5hbEluc3RhbmNlLmpzJztcbmltcG9ydCB7IFRlcm1pbmFsSW5pdGlhbEhpbnRTZXR0aW5nSWQgfSBmcm9tICcuLi9jb21tb24vdGVybWluYWxJbml0aWFsSGludENvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0ICcuL21lZGlhL3Rlcm1pbmFsSW5pdGlhbEhpbnQuY3NzJztcbmltcG9ydCB7IFRlcm1pbmFsQ2hhdENvbW1hbmRJZCB9IGZyb20gJy4vdGVybWluYWxDaGF0LmpzJztcbmltcG9ydCB7IENoYXRBZ2VudExvY2F0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY2hhdC9jb21tb24vY29uc3RhbnRzLmpzJztcblxuY29uc3QgJCA9IGRvbS4kO1xuXG5jb25zdCBlbnVtIENvbnN0YW50cyB7XG5cdEluaXRpYWxIaW50SGlkZVN0b3JhZ2VLZXkgPSAndGVybWluYWwuaW5pdGlhbEhpbnQuaGlkZSdcbn1cblxuZXhwb3J0IGNsYXNzIEluaXRpYWxIaW50QWRkb24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVRlcm1pbmFsQWRkb24ge1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFJlcXVlc3RDcmVhdGVIaW50ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdGdldCBvbkRpZFJlcXVlc3RDcmVhdGVIaW50KCk6IEV2ZW50PHZvaWQ+IHsgcmV0dXJuIHRoaXMuX29uRGlkUmVxdWVzdENyZWF0ZUhpbnQuZXZlbnQ7IH1cblx0cHJpdmF0ZSByZWFkb25seSBfZGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGU8RGlzcG9zYWJsZVN0b3JlPigpKTtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IF9jYXBhYmlsaXRpZXM6IElUZXJtaW5hbENhcGFiaWxpdHlTdG9yZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUFnZW50czogRXZlbnQ8SUNoYXRBZ2VudCB8IHVuZGVmaW5lZD4pIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cdGFjdGl2YXRlKHRlcm1pbmFsOiBSYXdYdGVybVRlcm1pbmFsKTogdm9pZCB7XG5cdFx0Y29uc3Qgc3RvcmUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLnZhbHVlID0gc3RvcmU7XG5cdFx0Y29uc3QgY2FwYWJpbGl0eSA9IHRoaXMuX2NhcGFiaWxpdGllcy5nZXQoVGVybWluYWxDYXBhYmlsaXR5LkNvbW1hbmREZXRlY3Rpb24pO1xuXHRcdGlmIChjYXBhYmlsaXR5KSB7XG5cdFx0XHRzdG9yZS5hZGQoRXZlbnQub25jZShjYXBhYmlsaXR5LnByb21wdElucHV0TW9kZWwub25EaWRTdGFydElucHV0KSgoKSA9PiB0aGlzLl9vbkRpZFJlcXVlc3RDcmVhdGVIaW50LmZpcmUoKSkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9jYXBhYmlsaXRpZXMub25EaWRBZGRDYXBhYmlsaXR5KGUgPT4ge1xuXHRcdFx0XHRpZiAoZS5pZCA9PT0gVGVybWluYWxDYXBhYmlsaXR5LkNvbW1hbmREZXRlY3Rpb24pIHtcblx0XHRcdFx0XHRjb25zdCBjYXBhYmlsaXR5ID0gZS5jYXBhYmlsaXR5O1xuXHRcdFx0XHRcdHN0b3JlLmFkZChFdmVudC5vbmNlKGNhcGFiaWxpdHkucHJvbXB0SW5wdXRNb2RlbC5vbkRpZFN0YXJ0SW5wdXQpKCgpID0+IHRoaXMuX29uRGlkUmVxdWVzdENyZWF0ZUhpbnQuZmlyZSgpKSk7XG5cdFx0XHRcdFx0aWYgKCFjYXBhYmlsaXR5LnByb21wdElucHV0TW9kZWwudmFsdWUpIHtcblx0XHRcdFx0XHRcdHRoaXMuX29uRGlkUmVxdWVzdENyZWF0ZUhpbnQuZmlyZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH1cblx0XHRjb25zdCBhZ2VudExpc3RlbmVyID0gdGhpcy5fb25EaWRDaGFuZ2VBZ2VudHMoKGUpID0+IHtcblx0XHRcdGlmIChlPy5sb2NhdGlvbnMuaW5jbHVkZXMoQ2hhdEFnZW50TG9jYXRpb24uVGVybWluYWwpKSB7XG5cdFx0XHRcdHRoaXMuX29uRGlkUmVxdWVzdENyZWF0ZUhpbnQuZmlyZSgpO1xuXHRcdFx0XHRhZ2VudExpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy52YWx1ZT8uYWRkKGFnZW50TGlzdGVuZXIpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBUZXJtaW5hbEluaXRpYWxIaW50Q29udHJpYnV0aW9uIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElUZXJtaW5hbENvbnRyaWJ1dGlvbiB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd0ZXJtaW5hbC5pbml0aWFsSGludCc7XG5cblx0cHJpdmF0ZSBfYWRkb246IEluaXRpYWxIaW50QWRkb24gfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBfaGludFdpZGdldDogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cblx0c3RhdGljIGdldChpbnN0YW5jZTogSVRlcm1pbmFsSW5zdGFuY2UgfCBJRGV0YWNoZWRUZXJtaW5hbEluc3RhbmNlKTogVGVybWluYWxJbml0aWFsSGludENvbnRyaWJ1dGlvbiB8IG51bGwge1xuXHRcdHJldHVybiBpbnN0YW5jZS5nZXRDb250cmlidXRpb248VGVybWluYWxJbml0aWFsSGludENvbnRyaWJ1dGlvbj4oVGVybWluYWxJbml0aWFsSGludENvbnRyaWJ1dGlvbi5JRCk7XG5cdH1cblx0cHJpdmF0ZSBfZGVjb3JhdGlvbjogSURlY29yYXRpb24gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX3h0ZXJtOiBJWHRlcm1UZXJtaW5hbCAmIHsgcmF3OiBSYXdYdGVybVRlcm1pbmFsIH0gfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfY3R4OiBJVGVybWluYWxDb250cmlidXRpb25Db250ZXh0IHwgSURldGFjaGVkQ29tcGF0aWJsZVRlcm1pbmFsQ29udHJpYnV0aW9uQ29udGV4dCxcblx0XHRASUNoYXRBZ2VudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY2hhdEFnZW50U2VydmljZTogSUNoYXRBZ2VudFNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3N0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElUZXJtaW5hbEVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVybWluYWxFZGl0b3JTZXJ2aWNlOiBJVGVybWluYWxFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJVGVybWluYWxHcm91cFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVybWluYWxHcm91cFNlcnZpY2U6IElUZXJtaW5hbEdyb3VwU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdC8vIFJlc2V0IGhpbnQgc3RhdGUgd2hlbiBjb25maWcgY2hhbmdlc1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKFRlcm1pbmFsSW5pdGlhbEhpbnRTZXR0aW5nSWQuRW5hYmxlZCkpIHtcblx0XHRcdFx0dGhpcy5fc3RvcmFnZVNlcnZpY2UucmVtb3ZlKENvbnN0YW50cy5Jbml0aWFsSGludEhpZGVTdG9yYWdlS2V5LCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHh0ZXJtT3Blbih4dGVybTogSVh0ZXJtVGVybWluYWwgJiB7IHJhdzogUmF3WHRlcm1UZXJtaW5hbCB9KTogdm9pZCB7XG5cdFx0Ly8gRG9uJ3Qgc2hvdyBpcyB0aGUgdGVybWluYWwgd2FzIGxhdW5jaGVkIGJ5IGFuIGV4dGVuc2lvbiBvciBhIGZlYXR1cmUgbGlrZSBkZWJ1Z1xuXHRcdGlmICgnc2hlbGxMYXVuY2hDb25maWcnIGluIHRoaXMuX2N0eC5pbnN0YW5jZSAmJiAodGhpcy5fY3R4Lmluc3RhbmNlLnNoZWxsTGF1bmNoQ29uZmlnLmlzRXh0ZW5zaW9uT3duZWRUZXJtaW5hbCB8fCB0aGlzLl9jdHguaW5zdGFuY2Uuc2hlbGxMYXVuY2hDb25maWcuaXNGZWF0dXJlVGVybWluYWwpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdC8vIERvbid0IHNob3cgaWYgZGlzYWJsZWRcblx0XHRpZiAodGhpcy5fc3RvcmFnZVNlcnZpY2UuZ2V0Qm9vbGVhbihDb25zdGFudHMuSW5pdGlhbEhpbnRIaWRlU3RvcmFnZUtleSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBmYWxzZSkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Ly8gT25seSBzaG93IGZvciB0aGUgZmlyc3QgdGVybWluYWxcblx0XHRpZiAodGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2UuaW5zdGFuY2VzLmxlbmd0aCArIHRoaXMuX3Rlcm1pbmFsRWRpdG9yU2VydmljZS5pbnN0YW5jZXMubGVuZ3RoICE9PSAxKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX3h0ZXJtID0geHRlcm07XG5cdFx0dGhpcy5fYWRkb24gPSB0aGlzLl9yZWdpc3Rlcih0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShJbml0aWFsSGludEFkZG9uLCB0aGlzLl9jdHguaW5zdGFuY2UuY2FwYWJpbGl0aWVzLCB0aGlzLl9jaGF0QWdlbnRTZXJ2aWNlLm9uRGlkQ2hhbmdlQWdlbnRzKSk7XG5cdFx0dGhpcy5feHRlcm0ucmF3LmxvYWRBZGRvbih0aGlzLl9hZGRvbik7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fYWRkb24ub25EaWRSZXF1ZXN0Q3JlYXRlSGludCgoKSA9PiB0aGlzLl9jcmVhdGVIaW50KCkpKTtcblx0fVxuXG5cdHByaXZhdGUgX2NyZWF0ZUhpbnQoKTogdm9pZCB7XG5cdFx0Y29uc3QgaW5zdGFuY2UgPSB0aGlzLl9jdHguaW5zdGFuY2UgaW5zdGFuY2VvZiBUZXJtaW5hbEluc3RhbmNlID8gdGhpcy5fY3R4Lmluc3RhbmNlIDogdW5kZWZpbmVkO1xuXHRcdGNvbnN0IGNvbW1hbmREZXRlY3Rpb25DYXBhYmlsaXR5ID0gaW5zdGFuY2U/LmNhcGFiaWxpdGllcy5nZXQoVGVybWluYWxDYXBhYmlsaXR5LkNvbW1hbmREZXRlY3Rpb24pO1xuXHRcdGlmICghaW5zdGFuY2UgfHwgIXRoaXMuX3h0ZXJtIHx8IHRoaXMuX2hpbnRXaWRnZXQgfHwgIWNvbW1hbmREZXRlY3Rpb25DYXBhYmlsaXR5IHx8IGNvbW1hbmREZXRlY3Rpb25DYXBhYmlsaXR5LnByb21wdElucHV0TW9kZWwudmFsdWUgfHwgISFpbnN0YW5jZS5zaGVsbExhdW5jaENvbmZpZy5hdHRhY2hQZXJzaXN0ZW50UHJvY2Vzcykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoVGVybWluYWxJbml0aWFsSGludFNldHRpbmdJZC5FbmFibGVkKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5fZGVjb3JhdGlvbikge1xuXHRcdFx0Y29uc3QgbWFya2VyID0gdGhpcy5feHRlcm0ucmF3LnJlZ2lzdGVyTWFya2VyKCk7XG5cdFx0XHRpZiAoIW1hcmtlcikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLl94dGVybS5yYXcuYnVmZmVyLmFjdGl2ZS5jdXJzb3JYID09PSAwKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMuX3JlZ2lzdGVyKG1hcmtlcik7XG5cdFx0XHR0aGlzLl9kZWNvcmF0aW9uID0gdGhpcy5feHRlcm0ucmF3LnJlZ2lzdGVyRGVjb3JhdGlvbih7XG5cdFx0XHRcdG1hcmtlcixcblx0XHRcdFx0eDogdGhpcy5feHRlcm0ucmF3LmJ1ZmZlci5hY3RpdmUuY3Vyc29yWCArIDEsXG5cdFx0XHR9KTtcblx0XHRcdGlmICh0aGlzLl9kZWNvcmF0aW9uKSB7XG5cdFx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2RlY29yYXRpb24pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3h0ZXJtLnJhdy5vbktleSgoKSA9PiB0aGlzLmRpc3Bvc2UoKSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oVGVybWluYWxJbml0aWFsSGludFNldHRpbmdJZC5FbmFibGVkKSAmJiAhdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoVGVybWluYWxJbml0aWFsSGludFNldHRpbmdJZC5FbmFibGVkKSkge1xuXHRcdFx0XHR0aGlzLmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRjb25zdCBpbnB1dE1vZGVsID0gY29tbWFuZERldGVjdGlvbkNhcGFiaWxpdHkucHJvbXB0SW5wdXRNb2RlbDtcblx0XHRpZiAoaW5wdXRNb2RlbCkge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoaW5wdXRNb2RlbC5vbkRpZENoYW5nZUlucHV0KCgpID0+IHtcblx0XHRcdFx0aWYgKGlucHV0TW9kZWwudmFsdWUpIHtcblx0XHRcdFx0XHR0aGlzLmRpc3Bvc2UoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5fZGVjb3JhdGlvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9kZWNvcmF0aW9uKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9kZWNvcmF0aW9uLm9uUmVuZGVyKChlKSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuX2hpbnRXaWRnZXQgJiYgdGhpcy5feHRlcm0/LmlzRm9jdXNlZCAmJiB0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5pbnN0YW5jZXMubGVuZ3RoICsgdGhpcy5fdGVybWluYWxFZGl0b3JTZXJ2aWNlLmluc3RhbmNlcy5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0Y29uc3QgdGVybWluYWxBZ2VudHMgPSB0aGlzLl9jaGF0QWdlbnRTZXJ2aWNlLmdldEFjdGl2YXRlZEFnZW50cygpLmZpbHRlcihjYW5kaWRhdGUgPT4gY2FuZGlkYXRlLmxvY2F0aW9ucy5pbmNsdWRlcyhDaGF0QWdlbnRMb2NhdGlvbi5UZXJtaW5hbCkpO1xuXHRcdFx0XHRpZiAodGVybWluYWxBZ2VudHM/Lmxlbmd0aCkge1xuXHRcdFx0XHRcdGNvbnN0IHdpZGdldCA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlcm1pbmFsSW5pdGlhbEhpbnRXaWRnZXQsIGluc3RhbmNlKSk7XG5cdFx0XHRcdFx0dGhpcy5fYWRkb24/LmRpc3Bvc2UoKTtcblx0XHRcdFx0XHR0aGlzLl9oaW50V2lkZ2V0ID0gd2lkZ2V0LmdldERvbU5vZGUodGVybWluYWxBZ2VudHMpO1xuXHRcdFx0XHRcdGlmICghdGhpcy5faGludFdpZGdldCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlLmFwcGVuZENoaWxkKHRoaXMuX2hpbnRXaWRnZXQpO1xuXHRcdFx0XHRcdGUuY2xhc3NMaXN0LmFkZCgndGVybWluYWwtaW5pdGlhbC1oaW50Jyk7XG5cdFx0XHRcdFx0Y29uc3QgZm9udCA9IHRoaXMuX3h0ZXJtLmdldEZvbnQoKTtcblx0XHRcdFx0XHRpZiAoZm9udCkge1xuXHRcdFx0XHRcdFx0ZS5zdHlsZS5mb250RmFtaWx5ID0gZm9udC5mb250RmFtaWx5O1xuXHRcdFx0XHRcdFx0ZS5zdHlsZS5mb250U2l6ZSA9IGZvbnQuZm9udFNpemUgKyAncHgnO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKHRoaXMuX2hpbnRXaWRnZXQgJiYgdGhpcy5feHRlcm0pIHtcblx0XHRcdFx0Y29uc3QgZGVjb3JhdGlvbiA9IHRoaXMuX2hpbnRXaWRnZXQucGFyZW50RWxlbWVudDtcblx0XHRcdFx0aWYgKGRlY29yYXRpb24pIHtcblx0XHRcdFx0XHRkZWNvcmF0aW9uLnN0eWxlLndpZHRoID0gKHRoaXMuX3h0ZXJtLnJhdy5jb2xzIC0gdGhpcy5feHRlcm0ucmF3LmJ1ZmZlci5hY3RpdmUuY3Vyc29yWCkgLyB0aGlzLl94dGVybSEucmF3LmNvbHMgKiAxMDAgKyAnJSc7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cbn1cbnJlZ2lzdGVyVGVybWluYWxDb250cmlidXRpb24oVGVybWluYWxJbml0aWFsSGludENvbnRyaWJ1dGlvbi5JRCwgVGVybWluYWxJbml0aWFsSGludENvbnRyaWJ1dGlvbiwgZmFsc2UpO1xuXG5jbGFzcyBUZXJtaW5hbEluaXRpYWxIaW50V2lkZ2V0IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSBfZG9tTm9kZTogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3RvRGlzcG9zZTogRGlzcG9zYWJsZVN0b3JlID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0cHJpdmF0ZSBfaXNWaXNpYmxlID0gZmFsc2U7XG5cdHByaXZhdGUgX2FyaWFMYWJlbDogc3RyaW5nID0gJyc7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfaW5zdGFuY2U6IElUZXJtaW5hbEluc3RhbmNlLFxuXHRcdEBJQ2hhdEFnZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jaGF0QWdlbnRTZXJ2aWNlOiBJQ2hhdEFnZW50U2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2tleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9wcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElUZXJtaW5hbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVybWluYWxTZXJ2aWNlOiBJVGVybWluYWxTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX3RvRGlzcG9zZS5hZGQoX2luc3RhbmNlLm9uRGlkRm9jdXMoKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuX2luc3RhbmNlLmhhc0ZvY3VzICYmIHRoaXMuX2lzVmlzaWJsZSAmJiB0aGlzLl9hcmlhTGFiZWwgJiYgdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoQWNjZXNzaWJpbGl0eVZlcmJvc2l0eVNldHRpbmdJZC5UZXJtaW5hbENoYXQpKSB7XG5cdFx0XHRcdHN0YXR1cyh0aGlzLl9hcmlhTGFiZWwpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl90b0Rpc3Bvc2UuYWRkKF90ZXJtaW5hbFNlcnZpY2Uub25EaWRDaGFuZ2VJbnN0YW5jZXMoKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuX3Rlcm1pbmFsU2VydmljZS5pbnN0YW5jZXMubGVuZ3RoICE9PSAxKSB7XG5cdFx0XHRcdHRoaXMuZGlzcG9zZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl90b0Rpc3Bvc2UuYWRkKHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKFRlcm1pbmFsSW5pdGlhbEhpbnRTZXR0aW5nSWQuRW5hYmxlZCkgJiYgIXRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKFRlcm1pbmFsSW5pdGlhbEhpbnRTZXR0aW5nSWQuRW5hYmxlZCkpIHtcblx0XHRcdFx0dGhpcy5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0SGludElubGluZUNoYXQoYWdlbnRzOiBJQ2hhdEFnZW50W10pIHtcblx0XHRsZXQgcHJvdmlkZXJOYW1lID0gKGFnZW50cy5sZW5ndGggPT09IDEgPyBhZ2VudHNbMF0uZnVsbE5hbWUgOiB1bmRlZmluZWQpID8/IHRoaXMuX3Byb2R1Y3RTZXJ2aWNlLm5hbWVTaG9ydDtcblx0XHRjb25zdCBkZWZhdWx0QWdlbnQgPSB0aGlzLl9jaGF0QWdlbnRTZXJ2aWNlLmdldERlZmF1bHRBZ2VudChDaGF0QWdlbnRMb2NhdGlvbi5QYW5lbCk7XG5cdFx0aWYgKGRlZmF1bHRBZ2VudD8uZXh0ZW5zaW9uSWQudmFsdWUgPT09IGFnZW50c1swXS5leHRlbnNpb25JZC52YWx1ZSkge1xuXHRcdFx0cHJvdmlkZXJOYW1lID0gZGVmYXVsdEFnZW50LmZ1bGxOYW1lID8/IHByb3ZpZGVyTmFtZTtcblx0XHR9XG5cblx0XHRsZXQgYXJpYUxhYmVsID0gYEFzayAke3Byb3ZpZGVyTmFtZX0gc29tZXRoaW5nIG9yIHN0YXJ0IHR5cGluZyB0byBkaXNtaXNzLmA7XG5cblx0XHRjb25zdCBoYW5kbGVDbGljayA9ICgpID0+IHtcblx0XHRcdHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLnN0b3JlKENvbnN0YW50cy5Jbml0aWFsSGludEhpZGVTdG9yYWdlS2V5LCB0cnVlLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sIFN0b3JhZ2VUYXJnZXQuVVNFUik7XG5cdFx0XHR0aGlzLl90ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8V29ya2JlbmNoQWN0aW9uRXhlY3V0ZWRFdmVudCwgV29ya2JlbmNoQWN0aW9uRXhlY3V0ZWRDbGFzc2lmaWNhdGlvbj4oJ3dvcmtiZW5jaEFjdGlvbkV4ZWN1dGVkJywge1xuXHRcdFx0XHRpZDogJ3Rlcm1pbmFsSW5saW5lQ2hhdC5oaW50QWN0aW9uJyxcblx0XHRcdFx0ZnJvbTogJ2hpbnQnXG5cdFx0XHR9KTtcblx0XHRcdHRoaXMuX2NvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKFRlcm1pbmFsQ2hhdENvbW1hbmRJZC5TdGFydCwgeyBmcm9tOiAnaGludCcgfSk7XG5cdFx0fTtcblx0XHR0aGlzLl90b0Rpc3Bvc2UuYWRkKHRoaXMuX2NvbW1hbmRTZXJ2aWNlLm9uRGlkRXhlY3V0ZUNvbW1hbmQoZSA9PiB7XG5cdFx0XHRpZiAoZS5jb21tYW5kSWQgPT09IFRlcm1pbmFsQ2hhdENvbW1hbmRJZC5TdGFydCkge1xuXHRcdFx0XHR0aGlzLl9zdG9yYWdlU2VydmljZS5zdG9yZShDb25zdGFudHMuSW5pdGlhbEhpbnRIaWRlU3RvcmFnZUtleSwgdHJ1ZSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBTdG9yYWdlVGFyZ2V0LlVTRVIpO1xuXHRcdFx0XHR0aGlzLmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRjb25zdCBoaW50SGFuZGxlcjogSUNvbnRlbnRBY3Rpb25IYW5kbGVyID0ge1xuXHRcdFx0ZGlzcG9zYWJsZXM6IHRoaXMuX3RvRGlzcG9zZSxcblx0XHRcdGNhbGxiYWNrOiAoaW5kZXgsIF9ldmVudCkgPT4ge1xuXHRcdFx0XHRzd2l0Y2ggKGluZGV4KSB7XG5cdFx0XHRcdFx0Y2FzZSAnMCc6XG5cdFx0XHRcdFx0XHRoYW5kbGVDbGljaygpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Y29uc3QgaGludEVsZW1lbnQgPSAkKCdkaXYudGVybWluYWwtaW5pdGlhbC1oaW50Jyk7XG5cdFx0aGludEVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG5cblx0XHRjb25zdCBrZXliaW5kaW5nSGludCA9IHRoaXMuX2tleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoVGVybWluYWxDaGF0Q29tbWFuZElkLlN0YXJ0KTtcblx0XHRjb25zdCBrZXliaW5kaW5nSGludExhYmVsID0ga2V5YmluZGluZ0hpbnQ/LmdldExhYmVsKCk7XG5cblx0XHRpZiAoa2V5YmluZGluZ0hpbnQgJiYga2V5YmluZGluZ0hpbnRMYWJlbCkge1xuXHRcdFx0Y29uc3QgYWN0aW9uUGFydCA9IGxvY2FsaXplKCdlbXB0eUhpbnRUZXh0JywgJ1ByZXNzIHswfSB0byBhc2sgezF9IHRvIGRvIHNvbWV0aGluZy4gJywga2V5YmluZGluZ0hpbnRMYWJlbCwgcHJvdmlkZXJOYW1lKTtcblxuXHRcdFx0Y29uc3QgW2JlZm9yZSwgYWZ0ZXJdID0gYWN0aW9uUGFydC5zcGxpdChrZXliaW5kaW5nSGludExhYmVsKS5tYXAoKGZyYWdtZW50KSA9PiB7XG5cdFx0XHRcdGNvbnN0IGhpbnRQYXJ0ID0gJCgnYScsIHVuZGVmaW5lZCwgZnJhZ21lbnQpO1xuXHRcdFx0XHR0aGlzLl90b0Rpc3Bvc2UuYWRkKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIoaGludFBhcnQsIGRvbS5FdmVudFR5cGUuQ0xJQ0ssIGhhbmRsZUNsaWNrKSk7XG5cdFx0XHRcdHJldHVybiBoaW50UGFydDtcblx0XHRcdH0pO1xuXG5cdFx0XHRoaW50RWxlbWVudC5hcHBlbmRDaGlsZChiZWZvcmUpO1xuXG5cdFx0XHRjb25zdCBsYWJlbCA9IGhpbnRIYW5kbGVyLmRpc3Bvc2FibGVzLmFkZChuZXcgS2V5YmluZGluZ0xhYmVsKGhpbnRFbGVtZW50LCBPUykpO1xuXHRcdFx0bGFiZWwuc2V0KGtleWJpbmRpbmdIaW50KTtcblx0XHRcdGxhYmVsLmVsZW1lbnQuc3R5bGUud2lkdGggPSAnbWluLWNvbnRlbnQnO1xuXHRcdFx0bGFiZWwuZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZSc7XG5cblx0XHRcdGxhYmVsLmVsZW1lbnQuc3R5bGUuY3Vyc29yID0gJ3BvaW50ZXInO1xuXHRcdFx0dGhpcy5fdG9EaXNwb3NlLmFkZChkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGxhYmVsLmVsZW1lbnQsIGRvbS5FdmVudFR5cGUuQ0xJQ0ssIGhhbmRsZUNsaWNrKSk7XG5cblx0XHRcdGhpbnRFbGVtZW50LmFwcGVuZENoaWxkKGFmdGVyKTtcblxuXHRcdFx0Y29uc3QgdHlwZVRvRGlzbWlzcyA9IGxvY2FsaXplKCdoaW50VGV4dERpc21pc3MnLCAnU3RhcnQgdHlwaW5nIHRvIGRpc21pc3MuJyk7XG5cdFx0XHRjb25zdCB0ZXh0SGludDIgPSAkKCdzcGFuLmRldGFpbCcsIHVuZGVmaW5lZCwgdHlwZVRvRGlzbWlzcyk7XG5cdFx0XHRoaW50RWxlbWVudC5hcHBlbmRDaGlsZCh0ZXh0SGludDIpO1xuXG5cdFx0XHRhcmlhTGFiZWwgPSBhY3Rpb25QYXJ0LmNvbmNhdCh0eXBlVG9EaXNtaXNzKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgaGludE1zZyA9IGxvY2FsaXplKHtcblx0XHRcdFx0a2V5OiAnaW5saW5lQ2hhdEhpbnQnLFxuXHRcdFx0XHRjb21tZW50OiBbXG5cdFx0XHRcdFx0J1ByZXNlcnZlIGRvdWJsZS1zcXVhcmUgYnJhY2tldHMgYW5kIHRoZWlyIG9yZGVyJyxcblx0XHRcdFx0XVxuXHRcdFx0fSwgJ1tbQXNrIHswfSB0byBkbyBzb21ldGhpbmddXSBvciBzdGFydCB0eXBpbmcgdG8gZGlzbWlzcy4nLCBwcm92aWRlck5hbWUpO1xuXHRcdFx0Y29uc3QgcmVuZGVyZWQgPSByZW5kZXJGb3JtYXR0ZWRUZXh0KGhpbnRNc2csIHsgYWN0aW9uSGFuZGxlcjogaGludEhhbmRsZXIgfSk7XG5cdFx0XHRoaW50RWxlbWVudC5hcHBlbmRDaGlsZChyZW5kZXJlZCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgYXJpYUxhYmVsLCBoaW50SGFuZGxlciwgaGludEVsZW1lbnQgfTtcblx0fVxuXG5cdGdldERvbU5vZGUoYWdlbnRzOiBJQ2hhdEFnZW50W10pOiBIVE1MRWxlbWVudCB7XG5cdFx0aWYgKCF0aGlzLl9kb21Ob2RlKSB7XG5cdFx0XHR0aGlzLl9kb21Ob2RlID0gJCgnLnRlcm1pbmFsLWluaXRpYWwtaGludCcpO1xuXHRcdFx0dGhpcy5fZG9tTm9kZSEuc3R5bGUucGFkZGluZ0xlZnQgPSAnNHB4JztcblxuXHRcdFx0Y29uc3QgeyBoaW50RWxlbWVudCwgYXJpYUxhYmVsIH0gPSB0aGlzLl9nZXRIaW50SW5saW5lQ2hhdChhZ2VudHMpO1xuXHRcdFx0dGhpcy5fZG9tTm9kZS5hcHBlbmQoaGludEVsZW1lbnQpO1xuXHRcdFx0dGhpcy5fYXJpYUxhYmVsID0gYXJpYUxhYmVsLmNvbmNhdChsb2NhbGl6ZSgnZGlzYWJsZUhpbnQnLCAnIFRvZ2dsZSB7MH0gaW4gc2V0dGluZ3MgdG8gZGlzYWJsZSB0aGlzIGhpbnQuJywgQWNjZXNzaWJpbGl0eVZlcmJvc2l0eVNldHRpbmdJZC5UZXJtaW5hbENoYXQpKTtcblxuXHRcdFx0dGhpcy5fdG9EaXNwb3NlLmFkZChkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuX2RvbU5vZGUsICdjbGljaycsICgpID0+IHtcblx0XHRcdFx0dGhpcy5fZG9tTm9kZT8ucmVtb3ZlKCk7XG5cdFx0XHRcdHRoaXMuX2RvbU5vZGUgPSB1bmRlZmluZWQ7XG5cdFx0XHR9KSk7XG5cblx0XHRcdHRoaXMuX3RvRGlzcG9zZS5hZGQoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLl9kb21Ob2RlLCBkb20uRXZlbnRUeXBlLkNPTlRFWFRfTUVOVSwgKGUpID0+IHtcblx0XHRcdFx0dGhpcy5fY29udGV4dE1lbnVTZXJ2aWNlLnNob3dDb250ZXh0TWVudSh7XG5cdFx0XHRcdFx0Z2V0QW5jaG9yOiAoKSA9PiB7IHJldHVybiBuZXcgU3RhbmRhcmRNb3VzZUV2ZW50KGRvbS5nZXRBY3RpdmVXaW5kb3coKSwgZSk7IH0sXG5cdFx0XHRcdFx0Z2V0QWN0aW9uczogKCkgPT4ge1xuXHRcdFx0XHRcdFx0cmV0dXJuIFt7XG5cdFx0XHRcdFx0XHRcdGlkOiAnd29ya2VuY2guYWN0aW9uLmRpc2FibGVUZXJtaW5hbEluaXRpYWxIaW50Jyxcblx0XHRcdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdkaXNhYmxlSW5pdGlhbEhpbnQnLCBcIkRpc2FibGUgSW5pdGlhbCBIaW50XCIpLFxuXHRcdFx0XHRcdFx0XHR0b29sdGlwOiBsb2NhbGl6ZSgnZGlzYWJsZUluaXRpYWxIaW50JywgXCJEaXNhYmxlIEluaXRpYWwgSGludFwiKSxcblx0XHRcdFx0XHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0Y2xhc3M6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0cnVuOiAoKSA9PiB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVWYWx1ZShUZXJtaW5hbEluaXRpYWxIaW50U2V0dGluZ0lkLkVuYWJsZWQsIGZhbHNlKVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSkpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fZG9tTm9kZTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fZG9tTm9kZT8ucmVtb3ZlKCk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixTQUFnQywyQkFBMkI7QUFDM0QsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsdUJBQXVCO0FBRWhDLFNBQVMsU0FBUyxhQUFhO0FBQy9CLFNBQVMsWUFBWSxpQkFBaUIseUJBQXlCO0FBQy9ELFNBQVMsVUFBVTtBQUNuQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGlCQUFpQixjQUFjLHFCQUFxQjtBQUM3RCxTQUFTLHlCQUF5QjtBQUNsQyxTQUFtQywwQkFBMEI7QUFDN0QsU0FBUyx1Q0FBdUM7QUFDaEQsU0FB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QUFzQixzQkFBc0I7QUFBQSxnQkFDNUQsU0FBUyxTQUFTLHNCQUFzQixzQkFBc0I7QUFBQSxnQkFDOUQsU0FBUztBQUFBLGdCQUNULE9BQU87QUFBQSxnQkFDUCxLQUFLLE1BQU0sS0FBSyxzQkFBc0IsWUFBWSw2QkFBNkIsU0FBUyxLQUFLO0FBQUEsY0FDOUY7QUFBQSxZQUNBO0FBQUEsVUFDRDtBQUFBLFFBQ0QsQ0FBQztBQUFBLE1BQ0YsQ0FBQyxDQUFDO0FBQUEsSUFDSDtBQUNBLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUVTLFVBQWdCO0FBQ3hCLFNBQUssVUFBVSxPQUFPO0FBQ3RCLFVBQU0sUUFBUTtBQUFBLEVBQ2Y7QUFDRDtBQTVKTSw0QkFBTjtBQUFBLEVBU0c7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBakJHOyIsCiAgIm5hbWVzIjogWyJDb25zdGFudHMiLCAiY2FwYWJpbGl0eSJdCn0K
