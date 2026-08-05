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
import { renderIcon } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { FileAccess } from "../../../../base/common/network.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { URI } from "../../../../base/common/uri.js";
import { localize } from "../../../../nls.js";
import { getFullyQualifiedId, IChatAgentNameService, IChatAgentService } from "../common/chatAgents.js";
import { showExtensionsWithIdsCommandId } from "../../extensions/browser/extensionsActions.js";
import { IExtensionsWorkbenchService } from "../../extensions/common/extensions.js";
import { verifiedPublisherIcon } from "../../../services/extensionManagement/common/extensionsIcons.js";
let ChatAgentHover = class extends Disposable {
  constructor(chatAgentService, extensionService, chatAgentNameService) {
    super();
    this.chatAgentService = chatAgentService;
    this.extensionService = extensionService;
    this.chatAgentNameService = chatAgentNameService;
    this._onDidChangeContents = this._register(new Emitter());
    this.onDidChangeContents = this._onDidChangeContents.event;
    const hoverElement = dom.h(
      ".chat-agent-hover@root",
      [
        dom.h(".chat-agent-hover-header", [
          dom.h(".chat-agent-hover-icon@icon"),
          dom.h(".chat-agent-hover-details", [
            dom.h(".chat-agent-hover-name@name"),
            dom.h(".chat-agent-hover-extension", [
              dom.h(".chat-agent-hover-extension-name@extensionName"),
              dom.h(".chat-agent-hover-separator@separator"),
              dom.h(".chat-agent-hover-publisher@publisher")
            ])
          ])
        ]),
        dom.h(".chat-agent-hover-warning@warning"),
        dom.h("span.chat-agent-hover-description@description")
      ]
    );
    this.domNode = hoverElement.root;
    this.icon = hoverElement.icon;
    this.name = hoverElement.name;
    this.extensionName = hoverElement.extensionName;
    this.description = hoverElement.description;
    hoverElement.separator.textContent = "|";
    const verifiedBadge = dom.$("span.extension-verified-publisher", void 0, renderIcon(verifiedPublisherIcon));
    this.publisherName = dom.$("span.chat-agent-hover-publisher-name");
    dom.append(
      hoverElement.publisher,
      verifiedBadge,
      this.publisherName
    );
    hoverElement.warning.appendChild(renderIcon(Codicon.warning));
    hoverElement.warning.appendChild(dom.$("span", void 0, localize("reservedName", "This chat extension is using a reserved name.")));
  }
  setAgent(id) {
    const agent = this.chatAgentService.getAgent(id);
    if (agent.metadata.icon instanceof URI) {
      const avatarIcon = dom.$("img.icon");
      avatarIcon.src = FileAccess.uriToBrowserUri(agent.metadata.icon).toString(true);
      this.icon.replaceChildren(dom.$(".avatar", void 0, avatarIcon));
    } else if (agent.metadata.themeIcon) {
      const avatarIcon = dom.$(ThemeIcon.asCSSSelector(agent.metadata.themeIcon));
      this.icon.replaceChildren(dom.$(".avatar.codicon-avatar", void 0, avatarIcon));
    }
    this.domNode.classList.toggle("noExtensionName", !!agent.isDynamic);
    const isAllowed = this.chatAgentNameService.getAgentNameRestriction(agent);
    this.name.textContent = isAllowed ? `@${agent.name}` : getFullyQualifiedId(agent);
    this.extensionName.textContent = agent.extensionDisplayName;
    this.publisherName.textContent = agent.publisherDisplayName ?? agent.extensionPublisherId;
    let description = agent.description ?? "";
    if (description) {
      if (!description.match(/[\.\?\!] *$/)) {
        description += ".";
      }
    }
    this.description.textContent = description;
    this.domNode.classList.toggle("allowedName", isAllowed);
    this.domNode.classList.toggle("verifiedPublisher", false);
    if (!agent.isDynamic) {
      const cancel = this._register(new CancellationTokenSource());
      this.extensionService.getExtensions([{ id: agent.extensionId.value }], cancel.token).then((extensions) => {
        cancel.dispose();
        const extension = extensions[0];
        if (extension?.publisherDomain?.verified) {
          this.domNode.classList.toggle("verifiedPublisher", true);
          this._onDidChangeContents.fire();
        }
      });
    }
  }
};
ChatAgentHover = __decorateClass([
  __decorateParam(0, IChatAgentService),
  __decorateParam(1, IExtensionsWorkbenchService),
  __decorateParam(2, IChatAgentNameService)
], ChatAgentHover);
function getChatAgentHoverOptions(getAgent, commandService) {
  return {
    actions: [
      {
        commandId: showExtensionsWithIdsCommandId,
        label: localize("viewExtensionLabel", "View Extension"),
        run: () => {
          const agent = getAgent();
          if (agent) {
            commandService.executeCommand(showExtensionsWithIdsCommandId, [agent.extensionId.value]);
          }
        }
      }
    ]
  };
}
export {
  ChatAgentHover,
  getChatAgentHoverOptions
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdEFnZW50SG92ZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBJTWFuYWdlZEhvdmVyT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyByZW5kZXJJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2ljb25MYWJlbC9pY29uTGFiZWxzLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgRmlsZUFjY2VzcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgZ2V0RnVsbHlRdWFsaWZpZWRJZCwgSUNoYXRBZ2VudERhdGEsIElDaGF0QWdlbnROYW1lU2VydmljZSwgSUNoYXRBZ2VudFNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vY2hhdEFnZW50cy5qcyc7XG5pbXBvcnQgeyBzaG93RXh0ZW5zaW9uc1dpdGhJZHNDb21tYW5kSWQgfSBmcm9tICcuLi8uLi9leHRlbnNpb25zL2Jyb3dzZXIvZXh0ZW5zaW9uc0FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyB2ZXJpZmllZFB1Ymxpc2hlckljb24gfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25zSWNvbnMuanMnO1xuXG5leHBvcnQgY2xhc3MgQ2hhdEFnZW50SG92ZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHVibGljIHJlYWRvbmx5IGRvbU5vZGU6IEhUTUxFbGVtZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgaWNvbjogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgbmFtZTogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uTmFtZTogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgcHVibGlzaGVyTmFtZTogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgZGVzY3JpcHRpb246IEhUTUxFbGVtZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlQ29udGVudHMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkQ2hhbmdlQ29udGVudHM6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25EaWRDaGFuZ2VDb250ZW50cy5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUNoYXRBZ2VudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjaGF0QWdlbnRTZXJ2aWNlOiBJQ2hhdEFnZW50U2VydmljZSxcblx0XHRASUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLFxuXHRcdEBJQ2hhdEFnZW50TmFtZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjaGF0QWdlbnROYW1lU2VydmljZTogSUNoYXRBZ2VudE5hbWVTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0Y29uc3QgaG92ZXJFbGVtZW50ID0gZG9tLmgoXG5cdFx0XHQnLmNoYXQtYWdlbnQtaG92ZXJAcm9vdCcsXG5cdFx0XHRbXG5cdFx0XHRcdGRvbS5oKCcuY2hhdC1hZ2VudC1ob3Zlci1oZWFkZXInLCBbXG5cdFx0XHRcdFx0ZG9tLmgoJy5jaGF0LWFnZW50LWhvdmVyLWljb25AaWNvbicpLFxuXHRcdFx0XHRcdGRvbS5oKCcuY2hhdC1hZ2VudC1ob3Zlci1kZXRhaWxzJywgW1xuXHRcdFx0XHRcdFx0ZG9tLmgoJy5jaGF0LWFnZW50LWhvdmVyLW5hbWVAbmFtZScpLFxuXHRcdFx0XHRcdFx0ZG9tLmgoJy5jaGF0LWFnZW50LWhvdmVyLWV4dGVuc2lvbicsIFtcblx0XHRcdFx0XHRcdFx0ZG9tLmgoJy5jaGF0LWFnZW50LWhvdmVyLWV4dGVuc2lvbi1uYW1lQGV4dGVuc2lvbk5hbWUnKSxcblx0XHRcdFx0XHRcdFx0ZG9tLmgoJy5jaGF0LWFnZW50LWhvdmVyLXNlcGFyYXRvckBzZXBhcmF0b3InKSxcblx0XHRcdFx0XHRcdFx0ZG9tLmgoJy5jaGF0LWFnZW50LWhvdmVyLXB1Ymxpc2hlckBwdWJsaXNoZXInKSxcblx0XHRcdFx0XHRcdF0pLFxuXHRcdFx0XHRcdF0pLFxuXHRcdFx0XHRdKSxcblx0XHRcdFx0ZG9tLmgoJy5jaGF0LWFnZW50LWhvdmVyLXdhcm5pbmdAd2FybmluZycpLFxuXHRcdFx0XHRkb20uaCgnc3Bhbi5jaGF0LWFnZW50LWhvdmVyLWRlc2NyaXB0aW9uQGRlc2NyaXB0aW9uJyksXG5cdFx0XHRdKTtcblx0XHR0aGlzLmRvbU5vZGUgPSBob3ZlckVsZW1lbnQucm9vdDtcblxuXHRcdHRoaXMuaWNvbiA9IGhvdmVyRWxlbWVudC5pY29uO1xuXHRcdHRoaXMubmFtZSA9IGhvdmVyRWxlbWVudC5uYW1lO1xuXHRcdHRoaXMuZXh0ZW5zaW9uTmFtZSA9IGhvdmVyRWxlbWVudC5leHRlbnNpb25OYW1lO1xuXHRcdHRoaXMuZGVzY3JpcHRpb24gPSBob3ZlckVsZW1lbnQuZGVzY3JpcHRpb247XG5cblx0XHRob3ZlckVsZW1lbnQuc2VwYXJhdG9yLnRleHRDb250ZW50ID0gJ3wnO1xuXG5cdFx0Y29uc3QgdmVyaWZpZWRCYWRnZSA9IGRvbS4kKCdzcGFuLmV4dGVuc2lvbi12ZXJpZmllZC1wdWJsaXNoZXInLCB1bmRlZmluZWQsIHJlbmRlckljb24odmVyaWZpZWRQdWJsaXNoZXJJY29uKSk7XG5cblx0XHR0aGlzLnB1Ymxpc2hlck5hbWUgPSBkb20uJCgnc3Bhbi5jaGF0LWFnZW50LWhvdmVyLXB1Ymxpc2hlci1uYW1lJyk7XG5cdFx0ZG9tLmFwcGVuZChcblx0XHRcdGhvdmVyRWxlbWVudC5wdWJsaXNoZXIsXG5cdFx0XHR2ZXJpZmllZEJhZGdlLFxuXHRcdFx0dGhpcy5wdWJsaXNoZXJOYW1lKTtcblxuXHRcdGhvdmVyRWxlbWVudC53YXJuaW5nLmFwcGVuZENoaWxkKHJlbmRlckljb24oQ29kaWNvbi53YXJuaW5nKSk7XG5cdFx0aG92ZXJFbGVtZW50Lndhcm5pbmcuYXBwZW5kQ2hpbGQoZG9tLiQoJ3NwYW4nLCB1bmRlZmluZWQsIGxvY2FsaXplKCdyZXNlcnZlZE5hbWUnLCBcIlRoaXMgY2hhdCBleHRlbnNpb24gaXMgdXNpbmcgYSByZXNlcnZlZCBuYW1lLlwiKSkpO1xuXHR9XG5cblx0c2V0QWdlbnQoaWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IGFnZW50ID0gdGhpcy5jaGF0QWdlbnRTZXJ2aWNlLmdldEFnZW50KGlkKSE7XG5cdFx0aWYgKGFnZW50Lm1ldGFkYXRhLmljb24gaW5zdGFuY2VvZiBVUkkpIHtcblx0XHRcdGNvbnN0IGF2YXRhckljb24gPSBkb20uJDxIVE1MSW1hZ2VFbGVtZW50PignaW1nLmljb24nKTtcblx0XHRcdGF2YXRhckljb24uc3JjID0gRmlsZUFjY2Vzcy51cmlUb0Jyb3dzZXJVcmkoYWdlbnQubWV0YWRhdGEuaWNvbikudG9TdHJpbmcodHJ1ZSk7XG5cdFx0XHR0aGlzLmljb24ucmVwbGFjZUNoaWxkcmVuKGRvbS4kKCcuYXZhdGFyJywgdW5kZWZpbmVkLCBhdmF0YXJJY29uKSk7XG5cdFx0fSBlbHNlIGlmIChhZ2VudC5tZXRhZGF0YS50aGVtZUljb24pIHtcblx0XHRcdGNvbnN0IGF2YXRhckljb24gPSBkb20uJChUaGVtZUljb24uYXNDU1NTZWxlY3RvcihhZ2VudC5tZXRhZGF0YS50aGVtZUljb24pKTtcblx0XHRcdHRoaXMuaWNvbi5yZXBsYWNlQ2hpbGRyZW4oZG9tLiQoJy5hdmF0YXIuY29kaWNvbi1hdmF0YXInLCB1bmRlZmluZWQsIGF2YXRhckljb24pKTtcblx0XHR9XG5cblx0XHR0aGlzLmRvbU5vZGUuY2xhc3NMaXN0LnRvZ2dsZSgnbm9FeHRlbnNpb25OYW1lJywgISFhZ2VudC5pc0R5bmFtaWMpO1xuXG5cdFx0Y29uc3QgaXNBbGxvd2VkID0gdGhpcy5jaGF0QWdlbnROYW1lU2VydmljZS5nZXRBZ2VudE5hbWVSZXN0cmljdGlvbihhZ2VudCk7XG5cdFx0dGhpcy5uYW1lLnRleHRDb250ZW50ID0gaXNBbGxvd2VkID8gYEAke2FnZW50Lm5hbWV9YCA6IGdldEZ1bGx5UXVhbGlmaWVkSWQoYWdlbnQpO1xuXHRcdHRoaXMuZXh0ZW5zaW9uTmFtZS50ZXh0Q29udGVudCA9IGFnZW50LmV4dGVuc2lvbkRpc3BsYXlOYW1lO1xuXHRcdHRoaXMucHVibGlzaGVyTmFtZS50ZXh0Q29udGVudCA9IGFnZW50LnB1Ymxpc2hlckRpc3BsYXlOYW1lID8/IGFnZW50LmV4dGVuc2lvblB1Ymxpc2hlcklkO1xuXG5cdFx0bGV0IGRlc2NyaXB0aW9uID0gYWdlbnQuZGVzY3JpcHRpb24gPz8gJyc7XG5cdFx0aWYgKGRlc2NyaXB0aW9uKSB7XG5cdFx0XHRpZiAoIWRlc2NyaXB0aW9uLm1hdGNoKC9bXFwuXFw/XFwhXSAqJC8pKSB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uICs9ICcuJztcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLmRlc2NyaXB0aW9uLnRleHRDb250ZW50ID0gZGVzY3JpcHRpb247XG5cdFx0dGhpcy5kb21Ob2RlLmNsYXNzTGlzdC50b2dnbGUoJ2FsbG93ZWROYW1lJywgaXNBbGxvd2VkKTtcblxuXHRcdHRoaXMuZG9tTm9kZS5jbGFzc0xpc3QudG9nZ2xlKCd2ZXJpZmllZFB1Ymxpc2hlcicsIGZhbHNlKTtcblx0XHRpZiAoIWFnZW50LmlzRHluYW1pYykge1xuXHRcdFx0Y29uc3QgY2FuY2VsID0gdGhpcy5fcmVnaXN0ZXIobmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCkpO1xuXHRcdFx0dGhpcy5leHRlbnNpb25TZXJ2aWNlLmdldEV4dGVuc2lvbnMoW3sgaWQ6IGFnZW50LmV4dGVuc2lvbklkLnZhbHVlIH1dLCBjYW5jZWwudG9rZW4pLnRoZW4oZXh0ZW5zaW9ucyA9PiB7XG5cdFx0XHRcdGNhbmNlbC5kaXNwb3NlKCk7XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvbiA9IGV4dGVuc2lvbnNbMF07XG5cdFx0XHRcdGlmIChleHRlbnNpb24/LnB1Ymxpc2hlckRvbWFpbj8udmVyaWZpZWQpIHtcblx0XHRcdFx0XHR0aGlzLmRvbU5vZGUuY2xhc3NMaXN0LnRvZ2dsZSgndmVyaWZpZWRQdWJsaXNoZXInLCB0cnVlKTtcblx0XHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZUNvbnRlbnRzLmZpcmUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDaGF0QWdlbnRIb3Zlck9wdGlvbnMoZ2V0QWdlbnQ6ICgpID0+IElDaGF0QWdlbnREYXRhIHwgdW5kZWZpbmVkLCBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlKTogSU1hbmFnZWRIb3Zlck9wdGlvbnMge1xuXHRyZXR1cm4ge1xuXHRcdGFjdGlvbnM6IFtcblx0XHRcdHtcblx0XHRcdFx0Y29tbWFuZElkOiBzaG93RXh0ZW5zaW9uc1dpdGhJZHNDb21tYW5kSWQsXG5cdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgndmlld0V4dGVuc2lvbkxhYmVsJywgXCJWaWV3IEV4dGVuc2lvblwiKSxcblx0XHRcdFx0cnVuOiAoKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgYWdlbnQgPSBnZXRBZ2VudCgpO1xuXHRcdFx0XHRcdGlmIChhZ2VudCkge1xuXHRcdFx0XHRcdFx0Y29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoc2hvd0V4dGVuc2lvbnNXaXRoSWRzQ29tbWFuZElkLCBbYWdlbnQuZXh0ZW5zaW9uSWQudmFsdWVdKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHR9XG5cdFx0XVxuXHR9O1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFFckIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsZUFBc0I7QUFDL0IsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsZ0JBQWdCO0FBRXpCLFNBQVMscUJBQXFDLHVCQUF1Qix5QkFBeUI7QUFDOUYsU0FBUyxzQ0FBc0M7QUFDL0MsU0FBUyxtQ0FBbUM7QUFDNUMsU0FBUyw2QkFBNkI7QUFFL0IsSUFBTSxpQkFBTixjQUE2QixXQUFXO0FBQUEsRUFZOUMsWUFDcUMsa0JBQ1Usa0JBQ04sc0JBQ3ZDO0FBQ0QsVUFBTTtBQUo4QjtBQUNVO0FBQ047QUFOekMsU0FBaUIsdUJBQXVCLEtBQUssVUFBVSxJQUFJLFFBQWMsQ0FBQztBQUMxRSxTQUFnQixzQkFBbUMsS0FBSyxxQkFBcUI7QUFTNUUsVUFBTSxlQUFlLElBQUk7QUFBQSxNQUN4QjtBQUFBLE1BQ0E7QUFBQSxRQUNDLElBQUksRUFBRSw0QkFBNEI7QUFBQSxVQUNqQyxJQUFJLEVBQUUsNkJBQTZCO0FBQUEsVUFDbkMsSUFBSSxFQUFFLDZCQUE2QjtBQUFBLFlBQ2xDLElBQUksRUFBRSw2QkFBNkI7QUFBQSxZQUNuQyxJQUFJLEVBQUUsK0JBQStCO0FBQUEsY0FDcEMsSUFBSSxFQUFFLGdEQUFnRDtBQUFBLGNBQ3RELElBQUksRUFBRSx1Q0FBdUM7QUFBQSxjQUM3QyxJQUFJLEVBQUUsdUNBQXVDO0FBQUEsWUFDOUMsQ0FBQztBQUFBLFVBQ0YsQ0FBQztBQUFBLFFBQ0YsQ0FBQztBQUFBLFFBQ0QsSUFBSSxFQUFFLG1DQUFtQztBQUFBLFFBQ3pDLElBQUksRUFBRSwrQ0FBK0M7QUFBQSxNQUN0RDtB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
