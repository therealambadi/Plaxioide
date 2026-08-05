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
import { Button } from "../../../../../base/browser/ui/button/button.js";
import { renderIcon } from "../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Event } from "../../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { MarkdownRenderer } from "../../../../../editor/browser/widget/markdownRenderer/browser/markdownRenderer.js";
import { localize } from "../../../../../nls.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { defaultButtonStyles } from "../../../../../platform/theme/browser/defaultStyles.js";
import { IChatAgentService } from "../../common/chatAgents.js";
import { chatViewsWelcomeRegistry } from "./chatViewsWelcome.js";
const $ = dom.$;
let ChatViewWelcomeController = class extends Disposable {
  constructor(container, delegate, location, contextKeyService, instantiationService) {
    super();
    this.container = container;
    this.delegate = delegate;
    this.location = location;
    this.contextKeyService = contextKeyService;
    this.instantiationService = instantiationService;
    this.enabled = false;
    this.enabledDisposables = this._register(new DisposableStore());
    this.renderDisposables = this._register(new DisposableStore());
    this.element = dom.append(this.container, dom.$(".chat-view-welcome"));
    this._register(Event.runAndSubscribe(
      delegate.onDidChangeViewWelcomeState,
      () => this.update()
    ));
    this._register(chatViewsWelcomeRegistry.onDidChange(() => this.update(true)));
  }
  update(force) {
    const enabled = this.delegate.shouldShowWelcome();
    if (this.enabled === enabled && !force) {
      return;
    }
    this.enabled = enabled;
    this.enabledDisposables.clear();
    if (!enabled) {
      this.container.classList.toggle("chat-view-welcome-visible", false);
      this.renderDisposables.clear();
      return;
    }
    const descriptors = chatViewsWelcomeRegistry.get();
    if (descriptors.length) {
      this.render(descriptors);
      const descriptorKeys = new Set(descriptors.flatMap((d) => d.when.keys()));
      this.enabledDisposables.add(this.contextKeyService.onDidChangeContext((e) => {
        if (e.affectsSome(descriptorKeys)) {
          this.render(descriptors);
        }
      }));
    }
  }
  render(descriptors) {
    this.renderDisposables.clear();
    dom.clearNode(this.element);
    const matchingDescriptors = descriptors.filter((descriptor) => this.contextKeyService.contextMatchesRules(descriptor.when));
    let enabledDescriptor;
    for (const descriptor of matchingDescriptors) {
      if (typeof descriptor.content === "function") {
        enabledDescriptor = descriptor;
        break;
      }
    }
    enabledDescriptor = enabledDescriptor ?? matchingDescriptors.at(0);
    if (enabledDescriptor) {
      const content = {
        icon: enabledDescriptor.icon,
        title: enabledDescriptor.title,
        message: enabledDescriptor.content
      };
      const welcomeView = this.renderDisposables.add(this.instantiationService.createInstance(ChatViewWelcomePart, content, { firstLinkToButton: true, location: this.location }));
      this.element.appendChild(welcomeView.element);
      this.container.classList.toggle("chat-view-welcome-visible", true);
    } else {
      this.container.classList.toggle("chat-view-welcome-visible", false);
    }
  }
};
ChatViewWelcomeController = __decorateClass([
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IInstantiationService)
], ChatViewWelcomeController);
let ChatViewWelcomePart = class extends Disposable {
  constructor(content, options, openerService, instantiationService, logService, chatAgentService) {
    super();
    this.content = content;
    this.openerService = openerService;
    this.instantiationService = instantiationService;
    this.logService = logService;
    this.element = dom.$(".chat-welcome-view");
    try {
      const renderer = this.instantiationService.createInstance(MarkdownRenderer, {});
      const icon = dom.append(this.element, $(".chat-welcome-view-icon"));
      if (content.icon) {
        icon.appendChild(renderIcon(content.icon));
      }
      const title = dom.append(this.element, $(".chat-welcome-view-title"));
      title.textContent = content.title;
      if (typeof content.message !== "function" && options?.isWidgetAgentWelcomeViewContent) {
        const container = dom.append(this.element, $(".chat-welcome-view-indicator-container"));
        dom.append(container, $(".chat-welcome-view-subtitle", void 0, localize("agentModeSubtitle", "Agent Mode")));
      }
      const message = dom.append(this.element, $(".chat-welcome-view-message"));
      if (typeof content.message === "function") {
        dom.append(message, content.message(this._register(new DisposableStore())));
      } else {
        const messageResult = this._register(renderer.render(content.message));
        const firstLink = options?.firstLinkToButton ? messageResult.element.querySelector("a") : void 0;
        if (firstLink) {
          const target = firstLink.getAttribute("data-href");
          const button = this._register(new Button(firstLink.parentElement, defaultButtonStyles));
          button.label = firstLink.textContent ?? "";
          if (target) {
            this._register(button.onDidClick(() => {
              this.openerService.open(target, { allowCommands: true });
            }));
          }
          firstLink.replaceWith(button.element);
        }
        dom.append(message, messageResult.element);
      }
      if (content.tips) {
        const tips = dom.append(this.element, $(".chat-welcome-view-tips"));
        const tipsResult = this._register(renderer.render(content.tips));
        tips.appendChild(tipsResult.element);
      }
    } catch (err) {
      this.logService.error("Failed to render chat view welcome content", err);
    }
  }
};
ChatViewWelcomePart = __decorateClass([
  __decorateParam(2, IOpenerService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, ILogService),
  __decorateParam(5, IChatAgentService)
], ChatViewWelcomePart);
export {
  ChatViewWelcomeController,
  ChatViewWelcomePart
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvdmlld3NXZWxjb21lL2NoYXRWaWV3V2VsY29tZUNvbnRyb2xsZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBCdXR0b24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYnV0dG9uL2J1dHRvbi5qcyc7XG5pbXBvcnQgeyByZW5kZXJJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2ljb25MYWJlbC9pY29uTGFiZWxzLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSU1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBNYXJrZG93blJlbmRlcmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L21hcmtkb3duUmVuZGVyZXIvYnJvd3Nlci9tYXJrZG93blJlbmRlcmVyLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgZGVmYXVsdEJ1dHRvblN0eWxlcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2Jyb3dzZXIvZGVmYXVsdFN0eWxlcy5qcyc7XG5pbXBvcnQgeyBJQ2hhdEFnZW50U2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0QWdlbnRzLmpzJztcbmltcG9ydCB7IENoYXRBZ2VudExvY2F0aW9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBjaGF0Vmlld3NXZWxjb21lUmVnaXN0cnksIElDaGF0Vmlld3NXZWxjb21lRGVzY3JpcHRvciB9IGZyb20gJy4vY2hhdFZpZXdzV2VsY29tZS5qcyc7XG5cbmNvbnN0ICQgPSBkb20uJDtcblxuZXhwb3J0IGludGVyZmFjZSBJVmlld1dlbGNvbWVEZWxlZ2F0ZSB7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlVmlld1dlbGNvbWVTdGF0ZTogRXZlbnQ8dm9pZD47XG5cdHNob3VsZFNob3dXZWxjb21lKCk6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBDaGF0Vmlld1dlbGNvbWVDb250cm9sbGVyIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgZWxlbWVudDogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBlbmFibGVkID0gZmFsc2U7XG5cdHByaXZhdGUgcmVhZG9ubHkgZW5hYmxlZERpc3Bvc2FibGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0cHJpdmF0ZSByZWFkb25seSByZW5kZXJEaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZGVsZWdhdGU6IElWaWV3V2VsY29tZURlbGVnYXRlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbG9jYXRpb246IENoYXRBZ2VudExvY2F0aW9uLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJpdmF0ZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5lbGVtZW50ID0gZG9tLmFwcGVuZCh0aGlzLmNvbnRhaW5lciwgZG9tLiQoJy5jaGF0LXZpZXctd2VsY29tZScpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5ydW5BbmRTdWJzY3JpYmUoXG5cdFx0XHRkZWxlZ2F0ZS5vbkRpZENoYW5nZVZpZXdXZWxjb21lU3RhdGUsXG5cdFx0XHQoKSA9PiB0aGlzLnVwZGF0ZSgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoY2hhdFZpZXdzV2VsY29tZVJlZ2lzdHJ5Lm9uRGlkQ2hhbmdlKCgpID0+IHRoaXMudXBkYXRlKHRydWUpKSk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZShmb3JjZT86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRjb25zdCBlbmFibGVkID0gdGhpcy5kZWxlZ2F0ZS5zaG91bGRTaG93V2VsY29tZSgpO1xuXHRcdGlmICh0aGlzLmVuYWJsZWQgPT09IGVuYWJsZWQgJiYgIWZvcmNlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5lbmFibGVkID0gZW5hYmxlZDtcblx0XHR0aGlzLmVuYWJsZWREaXNwb3NhYmxlcy5jbGVhcigpO1xuXG5cdFx0aWYgKCFlbmFibGVkKSB7XG5cdFx0XHR0aGlzLmNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdjaGF0LXZpZXctd2VsY29tZS12aXNpYmxlJywgZmFsc2UpO1xuXHRcdFx0dGhpcy5yZW5kZXJEaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRlc2NyaXB0b3JzID0gY2hhdFZpZXdzV2VsY29tZVJlZ2lzdHJ5LmdldCgpO1xuXHRcdGlmIChkZXNjcmlwdG9ycy5sZW5ndGgpIHtcblx0XHRcdHRoaXMucmVuZGVyKGRlc2NyaXB0b3JzKTtcblxuXHRcdFx0Y29uc3QgZGVzY3JpcHRvcktleXM6IFNldDxzdHJpbmc+ID0gbmV3IFNldChkZXNjcmlwdG9ycy5mbGF0TWFwKGQgPT4gZC53aGVuLmtleXMoKSkpO1xuXHRcdFx0dGhpcy5lbmFibGVkRGlzcG9zYWJsZXMuYWRkKHRoaXMuY29udGV4dEtleVNlcnZpY2Uub25EaWRDaGFuZ2VDb250ZXh0KGUgPT4ge1xuXHRcdFx0XHRpZiAoZS5hZmZlY3RzU29tZShkZXNjcmlwdG9yS2V5cykpIHtcblx0XHRcdFx0XHR0aGlzLnJlbmRlcihkZXNjcmlwdG9ycyk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlcihkZXNjcmlwdG9yczogUmVhZG9ubHlBcnJheTxJQ2hhdFZpZXdzV2VsY29tZURlc2NyaXB0b3I+KTogdm9pZCB7XG5cdFx0dGhpcy5yZW5kZXJEaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdGRvbS5jbGVhck5vZGUodGhpcy5lbGVtZW50ISk7XG5cblx0XHRjb25zdCBtYXRjaGluZ0Rlc2NyaXB0b3JzID0gZGVzY3JpcHRvcnMuZmlsdGVyKGRlc2NyaXB0b3IgPT4gdGhpcy5jb250ZXh0S2V5U2VydmljZS5jb250ZXh0TWF0Y2hlc1J1bGVzKGRlc2NyaXB0b3Iud2hlbikpO1xuXHRcdGxldCBlbmFibGVkRGVzY3JpcHRvcjogSUNoYXRWaWV3c1dlbGNvbWVEZXNjcmlwdG9yIHwgdW5kZWZpbmVkO1xuXHRcdGZvciAoY29uc3QgZGVzY3JpcHRvciBvZiBtYXRjaGluZ0Rlc2NyaXB0b3JzKSB7XG5cdFx0XHRpZiAodHlwZW9mIGRlc2NyaXB0b3IuY29udGVudCA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0XHRlbmFibGVkRGVzY3JpcHRvciA9IGRlc2NyaXB0b3I7IC8vIHdoZW4gbXVsdGlwbGUgZGVzY3JpcHRvcnMgbWF0Y2gsIHByZWZlciBhIFwiY29yZVwiIG9uZSBvdmVyIGEgXCJkZXNjcmlwdGl2ZVwiIG9uZVxuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdFx0ZW5hYmxlZERlc2NyaXB0b3IgPSBlbmFibGVkRGVzY3JpcHRvciA/PyBtYXRjaGluZ0Rlc2NyaXB0b3JzLmF0KDApO1xuXHRcdGlmIChlbmFibGVkRGVzY3JpcHRvcikge1xuXHRcdFx0Y29uc3QgY29udGVudDogSUNoYXRWaWV3V2VsY29tZUNvbnRlbnQgPSB7XG5cdFx0XHRcdGljb246IGVuYWJsZWREZXNjcmlwdG9yLmljb24sXG5cdFx0XHRcdHRpdGxlOiBlbmFibGVkRGVzY3JpcHRvci50aXRsZSxcblx0XHRcdFx0bWVzc2FnZTogZW5hYmxlZERlc2NyaXB0b3IuY29udGVudFxuXHRcdFx0fTtcblx0XHRcdGNvbnN0IHdlbGNvbWVWaWV3ID0gdGhpcy5yZW5kZXJEaXNwb3NhYmxlcy5hZGQodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDaGF0Vmlld1dlbGNvbWVQYXJ0LCBjb250ZW50LCB7IGZpcnN0TGlua1RvQnV0dG9uOiB0cnVlLCBsb2NhdGlvbjogdGhpcy5sb2NhdGlvbiB9KSk7XG5cdFx0XHR0aGlzLmVsZW1lbnQhLmFwcGVuZENoaWxkKHdlbGNvbWVWaWV3LmVsZW1lbnQpO1xuXHRcdFx0dGhpcy5jb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnY2hhdC12aWV3LXdlbGNvbWUtdmlzaWJsZScsIHRydWUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdjaGF0LXZpZXctd2VsY29tZS12aXNpYmxlJywgZmFsc2UpO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDaGF0Vmlld1dlbGNvbWVDb250ZW50IHtcblx0aWNvbj86IFRoZW1lSWNvbjtcblx0dGl0bGU6IHN0cmluZztcblx0bWVzc2FnZTogSU1hcmtkb3duU3RyaW5nIHwgKChkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlKSA9PiBIVE1MRWxlbWVudCk7XG5cdHRpcHM/OiBJTWFya2Rvd25TdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNoYXRWaWV3V2VsY29tZVJlbmRlck9wdGlvbnMge1xuXHRmaXJzdExpbmtUb0J1dHRvbj86IGJvb2xlYW47XG5cdGxvY2F0aW9uOiBDaGF0QWdlbnRMb2NhdGlvbjtcblx0aXNXaWRnZXRBZ2VudFdlbGNvbWVWaWV3Q29udGVudD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBDaGF0Vmlld1dlbGNvbWVQYXJ0IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHB1YmxpYyByZWFkb25seSBlbGVtZW50OiBIVE1MRWxlbWVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgY29udGVudDogSUNoYXRWaWV3V2VsY29tZUNvbnRlbnQsXG5cdFx0b3B0aW9uczogSUNoYXRWaWV3V2VsY29tZVJlbmRlck9wdGlvbnMgfCB1bmRlZmluZWQsXG5cdFx0QElPcGVuZXJTZXJ2aWNlIHByaXZhdGUgb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElDaGF0QWdlbnRTZXJ2aWNlIGNoYXRBZ2VudFNlcnZpY2U6IElDaGF0QWdlbnRTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuZWxlbWVudCA9IGRvbS4kKCcuY2hhdC13ZWxjb21lLXZpZXcnKTtcblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCByZW5kZXJlciA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTWFya2Rvd25SZW5kZXJlciwge30pO1xuXG5cdFx0XHQvLyBJY29uXG5cdFx0XHRjb25zdCBpY29uID0gZG9tLmFwcGVuZCh0aGlzLmVsZW1lbnQsICQoJy5jaGF0LXdlbGNvbWUtdmlldy1pY29uJykpO1xuXHRcdFx0aWYgKGNvbnRlbnQuaWNvbikge1xuXHRcdFx0XHRpY29uLmFwcGVuZENoaWxkKHJlbmRlckljb24oY29udGVudC5pY29uKSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFRpdGxlXG5cdFx0XHRjb25zdCB0aXRsZSA9IGRvbS5hcHBlbmQodGhpcy5lbGVtZW50LCAkKCcuY2hhdC13ZWxjb21lLXZpZXctdGl0bGUnKSk7XG5cdFx0XHR0aXRsZS50ZXh0Q29udGVudCA9IGNvbnRlbnQudGl0bGU7XG5cblx0XHRcdC8vIFByZXZpZXcgaW5kaWNhdG9yXG5cdFx0XHRpZiAodHlwZW9mIGNvbnRlbnQubWVzc2FnZSAhPT0gJ2Z1bmN0aW9uJyAmJiBvcHRpb25zPy5pc1dpZGdldEFnZW50V2VsY29tZVZpZXdDb250ZW50KSB7XG5cdFx0XHRcdGNvbnN0IGNvbnRhaW5lciA9IGRvbS5hcHBlbmQodGhpcy5lbGVtZW50LCAkKCcuY2hhdC13ZWxjb21lLXZpZXctaW5kaWNhdG9yLWNvbnRhaW5lcicpKTtcblx0XHRcdFx0ZG9tLmFwcGVuZChjb250YWluZXIsICQoJy5jaGF0LXdlbGNvbWUtdmlldy1zdWJ0aXRsZScsIHVuZGVmaW5lZCwgbG9jYWxpemUoJ2FnZW50TW9kZVN1YnRpdGxlJywgXCJBZ2VudCBNb2RlXCIpKSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIE1lc3NhZ2Vcblx0XHRcdGNvbnN0IG1lc3NhZ2UgPSBkb20uYXBwZW5kKHRoaXMuZWxlbWVudCwgJCgnLmNoYXQtd2VsY29tZS12aWV3LW1lc3NhZ2UnKSk7XG5cdFx0XHRpZiAodHlwZW9mIGNvbnRlbnQubWVzc2FnZSA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0XHRkb20uYXBwZW5kKG1lc3NhZ2UsIGNvbnRlbnQubWVzc2FnZSh0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBtZXNzYWdlUmVzdWx0ID0gdGhpcy5fcmVnaXN0ZXIocmVuZGVyZXIucmVuZGVyKGNvbnRlbnQubWVzc2FnZSkpO1xuXHRcdFx0XHRjb25zdCBmaXJzdExpbmsgPSBvcHRpb25zPy5maXJzdExpbmtUb0J1dHRvbiA/IG1lc3NhZ2VSZXN1bHQuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCdhJykgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdGlmIChmaXJzdExpbmspIHtcblx0XHRcdFx0XHRjb25zdCB0YXJnZXQgPSBmaXJzdExpbmsuZ2V0QXR0cmlidXRlKCdkYXRhLWhyZWYnKTtcblx0XHRcdFx0XHRjb25zdCBidXR0b24gPSB0aGlzLl9yZWdpc3RlcihuZXcgQnV0dG9uKGZpcnN0TGluay5wYXJlbnRFbGVtZW50ISwgZGVmYXVsdEJ1dHRvblN0eWxlcykpO1xuXHRcdFx0XHRcdGJ1dHRvbi5sYWJlbCA9IGZpcnN0TGluay50ZXh0Q29udGVudCA/PyAnJztcblx0XHRcdFx0XHRpZiAodGFyZ2V0KSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9yZWdpc3RlcihidXR0b24ub25EaWRDbGljaygoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdHRoaXMub3BlbmVyU2VydmljZS5vcGVuKHRhcmdldCwgeyBhbGxvd0NvbW1hbmRzOiB0cnVlIH0pO1xuXHRcdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRmaXJzdExpbmsucmVwbGFjZVdpdGgoYnV0dG9uLmVsZW1lbnQpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0ZG9tLmFwcGVuZChtZXNzYWdlLCBtZXNzYWdlUmVzdWx0LmVsZW1lbnQpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBUaXBzXG5cdFx0XHRpZiAoY29udGVudC50aXBzKSB7XG5cdFx0XHRcdGNvbnN0IHRpcHMgPSBkb20uYXBwZW5kKHRoaXMuZWxlbWVudCwgJCgnLmNoYXQtd2VsY29tZS12aWV3LXRpcHMnKSk7XG5cdFx0XHRcdGNvbnN0IHRpcHNSZXN1bHQgPSB0aGlzLl9yZWdpc3RlcihyZW5kZXJlci5yZW5kZXIoY29udGVudC50aXBzKSk7XG5cdFx0XHRcdHRpcHMuYXBwZW5kQ2hpbGQodGlwc1Jlc3VsdC5lbGVtZW50KTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcignRmFpbGVkIHRvIHJlbmRlciBjaGF0IHZpZXcgd2VsY29tZSBjb250ZW50JywgZXJyKTtcblx0XHR9XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsY0FBYztBQUN2QixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGFBQWE7QUFFdEIsU0FBUyxZQUFZLHVCQUF1QjtBQUU1QyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHlCQUF5QjtBQUVsQyxTQUFTLGdDQUE2RDtBQUV0RSxNQUFNLElBQUksSUFBSTtBQU9QLElBQU0sNEJBQU4sY0FBd0MsV0FBVztBQUFBLEVBT3pELFlBQ2tCLFdBQ0EsVUFDQSxVQUNXLG1CQUNHLHNCQUM5QjtBQUNELFVBQU07QUFOVztBQUNBO0FBQ0E7QUFDVztBQUNHO0FBVGhDLFNBQVEsVUFBVTtBQUNsQixTQUFpQixxQkFBcUIsS0FBSyxVQUFVLElBQUksZ0JBQWdCLENBQUM7QUFDMUUsU0FBaUIsb0JBQW9CLEtBQUssVUFBVSxJQUFJLGdCQUFnQixDQUFDO0FBV3hFLFNBQUssVUFBVSxJQUFJLE9BQU8sS0FBSyxXQUFXLElBQUksRUFBRSxvQkFBb0IsQ0FBQztBQUNyRSxTQUFLLFVBQVUsTUFBTTtBQUFBLE1BQ3BCLFNBQVM7QUFBQSxNQUNULE1BQU0sS0FBSyxPQUFPO0FBQUEsSUFBQyxDQUFDO0FBQ3JCLFNBQUssVUFBVSx5QkFBeUIsWUFBWSxNQUFNLEtBQUssT0FBTyxJQUFJLENBQUMsQ0FBQztBQUFBLEVBQzdFO0FBQUEsRUFFUSxPQUFPLE9BQXVCO0FBQ3JDLFVBQU0sVUFBVSxLQUFLLFNBQVMsa0JBQWtCO0FBQ2hELFFBQUksS0FBSyxZQUFZLFdBQVcsQ0FBQyxPQUFPO0FBQ3ZDO0FBQUEsSUFDRDtB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
