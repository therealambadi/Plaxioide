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
import "./media/chatConfirmationWidget.css";
import { Button, ButtonWithDropdown } from "../../../../../base/browser/ui/button/button.js";
import { Emitter } from "../../../../../base/common/event.js";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { MarkdownRenderer } from "../../../../../editor/browser/widget/markdownRenderer/browser/markdownRenderer.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { defaultButtonStyles } from "../../../../../platform/theme/browser/defaultStyles.js";
import { autorun, observableValue } from "../../../../../base/common/observable.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Action } from "../../../../../base/common/actions.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IHostService } from "../../../../services/host/browser/host.js";
let BaseChatConfirmationWidget = class extends Disposable {
  constructor(title, buttons, expandableMessage, instantiationService, contextMenuService, _configurationService, _hostService) {
    super();
    this.instantiationService = instantiationService;
    this._configurationService = _configurationService;
    this._hostService = _hostService;
    this._onDidClick = this._register(new Emitter());
    this._onDidChangeHeight = this._register(new Emitter());
    const elements = dom.h(".chat-confirmation-widget@root", [
      dom.h(".chat-confirmation-widget-expando@expando"),
      dom.h(".chat-confirmation-widget-title@title"),
      dom.h(".chat-confirmation-widget-message@message"),
      dom.h(".chat-confirmation-buttons-container@buttonsContainer")
    ]);
    this._domNode = elements.root;
    this.markdownRenderer = this.instantiationService.createInstance(MarkdownRenderer, {});
    if (expandableMessage) {
      const expanded = observableValue(this, false);
      const btn = this._register(new Button(elements.expando, {}));
      this._register(autorun((r) => {
        const value = expanded.read(r);
        btn.icon = value ? Codicon.chevronDown : Codicon.chevronRight;
        elements.message.classList.toggle("hidden", !value);
        this._onDidChangeHeight.fire();
      }));
      this._register(btn.onDidClick(() => {
        const value = expanded.get();
        expanded.set(!value, void 0);
      }));
    }
    const renderedTitle = this._register(this.markdownRenderer.render(new MarkdownString(title, { supportThemeIcons: true }), {
      asyncRenderCallback: () => this._onDidChangeHeight.fire()
    }));
    elements.title.append(renderedTitle.element);
    this.messageElement = elements.message;
    buttons.forEach((buttonData) => {
      const buttonOptions = { ...defaultButtonStyles, secondary: buttonData.isSecondary, title: buttonData.tooltip };
      let button;
      if (buttonData.moreActions) {
        button = new ButtonWithDropdown(elements.buttonsContainer, {
          ...buttonOptions,
          contextMenuProvider: contextMenuService,
          addPrimaryActionToDropdown: false,
          actions: buttonData.moreActions.map((action) => this._register(new Action(
            action.label,
            action.label,
            void 0,
            true,
            () => {
              this._onDidClick.fire(action);
              return Promise.resolve();
            }
          )))
        });
      } else {
        button = new Button(elements.buttonsContainer, buttonOptions);
      }
      this._register(button);
      button.label = buttonData.label;
      this._register(button.onDidClick(() => this._onDidClick.fire(buttonData)));
    });
  }
  get onDidClick() {
    return this._onDidClick.event;
  }
  get onDidChangeHeight() {
    return this._onDidChangeHeight.event;
  }
  get domNode() {
    return this._domNode;
  }
  setShowButtons(showButton) {
    this.domNode.classList.toggle("hideButtons", !showButton);
  }
  renderMessage(element) {
    this.messageElement.append(element);
    if (this._configurationService.getValue("chat.focusWindowOnConfirmation")) {
      const targetWindow = dom.getWindow(element);
      if (!targetWindow.document.hasFocus()) {
        this._hostService.focus(targetWindow, {
          force: true
          /* Application may not be active */
        });
      }
    }
  }
};
BaseChatConfirmationWidget = __decorateClass([
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IHostService)
], BaseChatConfirmationWidget);
let ChatConfirmationWidget = class extends BaseChatConfirmationWidget {
  constructor(title, message, buttons, instantiationService, contextMenuService, configurationService, hostService) {
    super(title, buttons, false, instantiationService, contextMenuService, configurationService, hostService);
    this.message = message;
    const renderedMessage = this._register(this.markdownRenderer.render(
      typeof this.message === "string" ? new MarkdownString(this.message) : this.message,
      { asyncRenderCallback: () => this._onDidChangeHeight.fire() }
    ));
    this.renderMessage(renderedMessage.element);
  }
};
ChatConfirmationWidget = __decorateClass([
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IHostService)
], ChatConfirmationWidget);
let ChatCustomConfirmationWidget = class extends BaseChatConfirmationWidget {
  constructor(title, messageElement, messageElementIsExpandable, buttons, instantiationService, contextMenuService, configurationService, hostService) {
    super(title, buttons, messageElementIsExpandable, instantiationService, contextMenuService, configurationService, hostService);
    this.renderMessage(messageElement);
  }
};
ChatCustomConfirmationWidget = __decorateClass([
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IContextMenuService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IHostService)
], ChatCustomConfirmationWidget);
export {
  ChatConfirmationWidget,
  ChatCustomConfirmationWidget
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdENvbnRlbnRQYXJ0cy9jaGF0Q29uZmlybWF0aW9uV2lkZ2V0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0ICcuL21lZGlhL2NoYXRDb25maXJtYXRpb25XaWRnZXQuY3NzJztcbmltcG9ydCB7IEJ1dHRvbiwgQnV0dG9uV2l0aERyb3Bkb3duLCBJQnV0dG9uLCBJQnV0dG9uT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9idXR0b24vYnV0dG9uLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSU1hcmtkb3duU3RyaW5nLCBNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgTWFya2Rvd25SZW5kZXJlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9tYXJrZG93blJlbmRlcmVyL2Jyb3dzZXIvbWFya2Rvd25SZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IGRlZmF1bHRCdXR0b25TdHlsZXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9icm93c2VyL2RlZmF1bHRTdHlsZXMuanMnO1xuaW1wb3J0IHsgYXV0b3J1biwgb2JzZXJ2YWJsZVZhbHVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZS5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElIb3N0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2hvc3QvYnJvd3Nlci9ob3N0LmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdENvbmZpcm1hdGlvbkJ1dHRvbiB7XG5cdGxhYmVsOiBzdHJpbmc7XG5cdGlzU2Vjb25kYXJ5PzogYm9vbGVhbjtcblx0dG9vbHRpcD86IHN0cmluZztcblx0ZGF0YTogYW55O1xuXHRtb3JlQWN0aW9ucz86IElDaGF0Q29uZmlybWF0aW9uQnV0dG9uW107XG59XG5cbmFic3RyYWN0IGNsYXNzIEJhc2VDaGF0Q29uZmlybWF0aW9uV2lkZ2V0IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgX29uRGlkQ2xpY2sgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJQ2hhdENvbmZpcm1hdGlvbkJ1dHRvbj4oKSk7XG5cdGdldCBvbkRpZENsaWNrKCk6IEV2ZW50PElDaGF0Q29uZmlybWF0aW9uQnV0dG9uPiB7IHJldHVybiB0aGlzLl9vbkRpZENsaWNrLmV2ZW50OyB9XG5cblx0cHJvdGVjdGVkIF9vbkRpZENoYW5nZUhlaWdodCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRnZXQgb25EaWRDaGFuZ2VIZWlnaHQoKTogRXZlbnQ8dm9pZD4geyByZXR1cm4gdGhpcy5fb25EaWRDaGFuZ2VIZWlnaHQuZXZlbnQ7IH1cblxuXHRwcml2YXRlIF9kb21Ob2RlOiBIVE1MRWxlbWVudDtcblx0Z2V0IGRvbU5vZGUoKTogSFRNTEVsZW1lbnQge1xuXHRcdHJldHVybiB0aGlzLl9kb21Ob2RlO1xuXHR9XG5cblx0c2V0U2hvd0J1dHRvbnMoc2hvd0J1dHRvbjogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuZG9tTm9kZS5jbGFzc0xpc3QudG9nZ2xlKCdoaWRlQnV0dG9ucycsICFzaG93QnV0dG9uKTtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgbWVzc2FnZUVsZW1lbnQ6IEhUTUxFbGVtZW50O1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgbWFya2Rvd25SZW5kZXJlcjogTWFya2Rvd25SZW5kZXJlcjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHR0aXRsZTogc3RyaW5nLFxuXHRcdGJ1dHRvbnM6IElDaGF0Q29uZmlybWF0aW9uQnV0dG9uW10sXG5cdFx0ZXhwYW5kYWJsZU1lc3NhZ2U6IGJvb2xlYW4sXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJSG9zdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaG9zdFNlcnZpY2U6IElIb3N0U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdGNvbnN0IGVsZW1lbnRzID0gZG9tLmgoJy5jaGF0LWNvbmZpcm1hdGlvbi13aWRnZXRAcm9vdCcsIFtcblx0XHRcdGRvbS5oKCcuY2hhdC1jb25maXJtYXRpb24td2lkZ2V0LWV4cGFuZG9AZXhwYW5kbycpLFxuXHRcdFx0ZG9tLmgoJy5jaGF0LWNvbmZpcm1hdGlvbi13aWRnZXQtdGl0bGVAdGl0bGUnKSxcblx0XHRcdGRvbS5oKCcuY2hhdC1jb25maXJtYXRpb24td2lkZ2V0LW1lc3NhZ2VAbWVzc2FnZScpLFxuXHRcdFx0ZG9tLmgoJy5jaGF0LWNvbmZpcm1hdGlvbi1idXR0b25zLWNvbnRhaW5lckBidXR0b25zQ29udGFpbmVyJyksXG5cdFx0XSk7XG5cdFx0dGhpcy5fZG9tTm9kZSA9IGVsZW1lbnRzLnJvb3Q7XG5cdFx0dGhpcy5tYXJrZG93blJlbmRlcmVyID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNYXJrZG93blJlbmRlcmVyLCB7fSk7XG5cblx0XHRpZiAoZXhwYW5kYWJsZU1lc3NhZ2UpIHtcblx0XHRcdGNvbnN0IGV4cGFuZGVkID0gb2JzZXJ2YWJsZVZhbHVlKHRoaXMsIGZhbHNlKTtcblx0XHRcdGNvbnN0IGJ0biA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBCdXR0b24oZWxlbWVudHMuZXhwYW5kbywge30pKTtcblxuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bihyID0+IHtcblx0XHRcdFx0Y29uc3QgdmFsdWUgPSBleHBhbmRlZC5yZWFkKHIpO1xuXHRcdFx0XHRidG4uaWNvbiA9IHZhbHVlID8gQ29kaWNvbi5jaGV2cm9uRG93biA6IENvZGljb24uY2hldnJvblJpZ2h0O1xuXHRcdFx0XHRlbGVtZW50cy5tZXNzYWdlLmNsYXNzTGlzdC50b2dnbGUoJ2hpZGRlbicsICF2YWx1ZSk7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlSGVpZ2h0LmZpcmUoKTtcblx0XHRcdH0pKTtcblxuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoYnRuLm9uRGlkQ2xpY2soKCkgPT4ge1xuXHRcdFx0XHRjb25zdCB2YWx1ZSA9IGV4cGFuZGVkLmdldCgpO1xuXHRcdFx0XHRleHBhbmRlZC5zZXQoIXZhbHVlLCB1bmRlZmluZWQpO1xuXHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlbmRlcmVkVGl0bGUgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLm1hcmtkb3duUmVuZGVyZXIucmVuZGVyKG5ldyBNYXJrZG93blN0cmluZyh0aXRsZSwgeyBzdXBwb3J0VGhlbWVJY29uczogdHJ1ZSB9KSwge1xuXHRcdFx0YXN5bmNSZW5kZXJDYWxsYmFjazogKCkgPT4gdGhpcy5fb25EaWRDaGFuZ2VIZWlnaHQuZmlyZSgpLFxuXHRcdH0pKTtcblx0XHRlbGVtZW50cy50aXRsZS5hcHBlbmQocmVuZGVyZWRUaXRsZS5lbGVtZW50KTtcblx0XHR0aGlzLm1lc3NhZ2VFbGVtZW50ID0gZWxlbWVudHMubWVzc2FnZTtcblx0XHRidXR0b25zLmZvckVhY2goYnV0dG9uRGF0YSA9PiB7XG5cdFx0XHRjb25zdCBidXR0b25PcHRpb25zOiBJQnV0dG9uT3B0aW9ucyA9IHsgLi4uZGVmYXVsdEJ1dHRvblN0eWxlcywgc2Vjb25kYXJ5OiBidXR0b25EYXRhLmlzU2Vjb25kYXJ5LCB0aXRsZTogYnV0dG9uRGF0YS50b29sdGlwIH07XG5cblx0XHRcdGxldCBidXR0b246IElCdXR0b247XG5cdFx0XHRpZiAoYnV0dG9uRGF0YS5tb3JlQWN0aW9ucykge1xuXHRcdFx0XHRidXR0b24gPSBuZXcgQnV0dG9uV2l0aERyb3Bkb3duKGVsZW1lbnRzLmJ1dHRvbnNDb250YWluZXIsIHtcblx0XHRcdFx0XHQuLi5idXR0b25PcHRpb25zLFxuXHRcdFx0XHRcdGNvbnRleHRNZW51UHJvdmlkZXI6IGNvbnRleHRNZW51U2VydmljZSxcblx0XHRcdFx0XHRhZGRQcmltYXJ5QWN0aW9uVG9Ecm9wZG93bjogZmFsc2UsXG5cdFx0XHRcdFx0YWN0aW9uczogYnV0dG9uRGF0YS5tb3JlQWN0aW9ucy5tYXAoYWN0aW9uID0+IHRoaXMuX3JlZ2lzdGVyKG5ldyBBY3Rpb24oXG5cdFx0XHRcdFx0XHRhY3Rpb24ubGFiZWwsXG5cdFx0XHRcdFx0XHRhY3Rpb24ubGFiZWwsXG5cdFx0XHRcdFx0XHR1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHR0cnVlLFxuXHRcdFx0XHRcdFx0KCkgPT4ge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9vbkRpZENsaWNrLmZpcmUoYWN0aW9uKTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHQpKSksXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YnV0dG9uID0gbmV3IEJ1dHRvbihlbGVtZW50cy5idXR0b25zQ29udGFpbmVyLCBidXR0b25PcHRpb25zKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoYnV0dG9uKTtcblx0XHRcdGJ1dHRvbi5sYWJlbCA9IGJ1dHRvbkRhdGEubGFiZWw7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihidXR0b24ub25EaWRDbGljaygoKSA9PiB0aGlzLl9vbkRpZENsaWNrLmZpcmUoYnV0dG9uRGF0YSkpKTtcblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCByZW5kZXJNZXNzYWdlKGVsZW1lbnQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0dGhpcy5tZXNzYWdlRWxlbWVudC5hcHBlbmQoZWxlbWVudCk7XG5cblx0XHRpZiAodGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oJ2NoYXQuZm9jdXNXaW5kb3dPbkNvbmZpcm1hdGlvbicpKSB7XG5cdFx0XHRjb25zdCB0YXJnZXRXaW5kb3cgPSBkb20uZ2V0V2luZG93KGVsZW1lbnQpO1xuXHRcdFx0aWYgKCF0YXJnZXRXaW5kb3cuZG9jdW1lbnQuaGFzRm9jdXMoKSkge1xuXHRcdFx0XHR0aGlzLl9ob3N0U2VydmljZS5mb2N1cyh0YXJnZXRXaW5kb3csIHsgZm9yY2U6IHRydWUgLyogQXBwbGljYXRpb24gbWF5IG5vdCBiZSBhY3RpdmUgKi8gfSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDaGF0Q29uZmlybWF0aW9uV2lkZ2V0IGV4dGVuZHMgQmFzZUNoYXRDb25maXJtYXRpb25XaWRnZXQge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHR0aXRsZTogc3RyaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbWVzc2FnZTogc3RyaW5nIHwgSU1hcmtkb3duU3RyaW5nLFxuXHRcdGJ1dHRvbnM6IElDaGF0Q29uZmlybWF0aW9uQnV0dG9uW10sXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElIb3N0U2VydmljZSBob3N0U2VydmljZTogSUhvc3RTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcih0aXRsZSwgYnV0dG9ucywgZmFsc2UsIGluc3RhbnRpYXRpb25TZXJ2aWNlLCBjb250ZXh0TWVudVNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBob3N0U2VydmljZSk7XG5cblx0XHRjb25zdCByZW5kZXJlZE1lc3NhZ2UgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLm1hcmtkb3duUmVuZGVyZXIucmVuZGVyKFxuXHRcdFx0dHlwZW9mIHRoaXMubWVzc2FnZSA9PT0gJ3N0cmluZycgPyBuZXcgTWFya2Rvd25TdHJpbmcodGhpcy5tZXNzYWdlKSA6IHRoaXMubWVzc2FnZSxcblx0XHRcdHsgYXN5bmNSZW5kZXJDYWxsYmFjazogKCkgPT4gdGhpcy5fb25EaWRDaGFuZ2VIZWlnaHQuZmlyZSgpIH1cblx0XHQpKTtcblx0XHR0aGlzLnJlbmRlck1lc3NhZ2UocmVuZGVyZWRNZXNzYWdlLmVsZW1lbnQpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDaGF0Q3VzdG9tQ29uZmlybWF0aW9uV2lkZ2V0IGV4dGVuZHMgQmFzZUNoYXRDb25maXJtYXRpb25XaWRnZXQge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHR0aXRsZTogc3RyaW5nLFxuXHRcdG1lc3NhZ2VFbGVtZW50OiBIVE1MRWxlbWVudCxcblx0XHRtZXNzYWdlRWxlbWVudElzRXhwYW5kYWJsZTogYm9vbGVhbixcblx0XHRidXR0b25zOiBJQ2hhdENvbmZpcm1hdGlvbkJ1dHRvbltdLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJSG9zdFNlcnZpY2UgaG9zdFNlcnZpY2U6IElIb3N0U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIodGl0bGUsIGJ1dHRvbnMsIG1lc3NhZ2VFbGVtZW50SXNFeHBhbmRhYmxlLCBpbnN0YW50aWF0aW9uU2VydmljZSwgY29udGV4dE1lbnVTZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSwgaG9zdFNlcnZpY2UpO1xuXHRcdHRoaXMucmVuZGVyTWVzc2FnZShtZXNzYWdlRWxlbWVudCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBQ3JCLE9BQU87QUFDUCxTQUFTLFFBQVEsMEJBQW1EO0FBQ3BFLFNBQVMsZUFBc0I7QUFDL0IsU0FBMEIsc0JBQXNCO0FBQ2hELFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsU0FBUyx1QkFBdUI7QUFDekMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsY0FBYztBQUN2QixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLG9CQUFvQjtBQVU3QixJQUFlLDZCQUFmLGNBQWtELFdBQVc7QUFBQSxFQW1CNUQsWUFDQyxPQUNBLFNBQ0EsbUJBQzBDLHNCQUNyQixvQkFDbUIsdUJBQ1QsY0FDOUI7QUFDRCxVQUFNO0FBTG9DO0FBRUY7QUFDVDtBQXpCaEMsU0FBUSxjQUFjLEtBQUssVUFBVSxJQUFJLFFBQWlDLENBQUM7QUFHM0UsU0FBVSxxQkFBcUIsS0FBSyxVQUFVLElBQUksUUFBYyxDQUFDO0FBMEJoRSxVQUFNLFdBQVcsSUFBSSxFQUFFLGtDQUFrQztBQUFBLE1BQ3hELElBQUksRUFBRSwyQ0FBMkM7QUFBQSxNQUNqRCxJQUFJLEVBQUUsdUNBQXVDO0FBQUEsTUFDN0MsSUFBSSxFQUFFLDJDQUEy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
