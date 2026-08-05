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
import { Button } from "../../../../base/browser/ui/button/button.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { IChatAgentService } from "../common/chatAgents.js";
import { formatChatQuestion } from "../common/chatParserTypes.js";
const $ = dom.$;
let ChatFollowups = class extends Disposable {
  constructor(container, followups, location, options, clickHandler, chatAgentService) {
    super();
    this.location = location;
    this.options = options;
    this.clickHandler = clickHandler;
    this.chatAgentService = chatAgentService;
    const followupsContainer = dom.append(container, $(".interactive-session-followups"));
    followups.forEach((followup) => this.renderFollowup(followupsContainer, followup));
  }
  renderFollowup(container, followup) {
    if (!this.chatAgentService.getDefaultAgent(this.location)) {
      return;
    }
    const tooltipPrefix = formatChatQuestion(this.chatAgentService, this.location, "", followup.agentId, followup.subCommand);
    if (tooltipPrefix === void 0) {
      return;
    }
    const baseTitle = followup.kind === "reply" ? followup.title || followup.message : followup.title;
    const message = followup.kind === "reply" ? followup.message : followup.title;
    const tooltip = (tooltipPrefix + ("tooltip" in followup && followup.tooltip || message)).trim();
    const button = this._register(new Button(container, { ...this.options, title: tooltip }));
    if (followup.kind === "reply") {
      button.element.classList.add("interactive-followup-reply");
    } else if (followup.kind === "command") {
      button.element.classList.add("interactive-followup-command");
    }
    button.element.ariaLabel = localize("followUpAriaLabel", "Follow up question: {0}", baseTitle);
    button.label = new MarkdownString(baseTitle);
    this._register(button.onDidClick(() => this.clickHandler(followup)));
  }
};
ChatFollowups = __decorateClass([
  __decorateParam(5, IChatAgentService)
], ChatFollowups);
export {
  ChatFollowups
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdEZvbGxvd3Vwcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IEJ1dHRvbiwgSUJ1dHRvblN0eWxlcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9idXR0b24vYnV0dG9uLmpzJztcbmltcG9ydCB7IE1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQ2hhdEFnZW50U2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi9jaGF0QWdlbnRzLmpzJztcbmltcG9ydCB7IGZvcm1hdENoYXRRdWVzdGlvbiB9IGZyb20gJy4uL2NvbW1vbi9jaGF0UGFyc2VyVHlwZXMuanMnO1xuaW1wb3J0IHsgSUNoYXRGb2xsb3d1cCB9IGZyb20gJy4uL2NvbW1vbi9jaGF0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBDaGF0QWdlbnRMb2NhdGlvbiB9IGZyb20gJy4uL2NvbW1vbi9jb25zdGFudHMuanMnO1xuXG5jb25zdCAkID0gZG9tLiQ7XG5cbmV4cG9ydCBjbGFzcyBDaGF0Rm9sbG93dXBzPFQgZXh0ZW5kcyBJQ2hhdEZvbGxvd3VwPiBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdGZvbGxvd3VwczogVFtdLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbG9jYXRpb246IENoYXRBZ2VudExvY2F0aW9uLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgb3B0aW9uczogSUJ1dHRvblN0eWxlcyB8IHVuZGVmaW5lZCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNsaWNrSGFuZGxlcjogKGZvbGxvd3VwOiBUKSA9PiB2b2lkLFxuXHRcdEBJQ2hhdEFnZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNoYXRBZ2VudFNlcnZpY2U6IElDaGF0QWdlbnRTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRjb25zdCBmb2xsb3d1cHNDb250YWluZXIgPSBkb20uYXBwZW5kKGNvbnRhaW5lciwgJCgnLmludGVyYWN0aXZlLXNlc3Npb24tZm9sbG93dXBzJykpO1xuXHRcdGZvbGxvd3Vwcy5mb3JFYWNoKGZvbGxvd3VwID0+IHRoaXMucmVuZGVyRm9sbG93dXAoZm9sbG93dXBzQ29udGFpbmVyLCBmb2xsb3d1cCkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJGb2xsb3d1cChjb250YWluZXI6IEhUTUxFbGVtZW50LCBmb2xsb3d1cDogVCk6IHZvaWQge1xuXG5cdFx0aWYgKCF0aGlzLmNoYXRBZ2VudFNlcnZpY2UuZ2V0RGVmYXVsdEFnZW50KHRoaXMubG9jYXRpb24pKSB7XG5cdFx0XHQvLyBObyBkZWZhdWx0IGFnZW50IHlldCwgd2hpY2ggYWZmZWN0cyBob3cgZm9sbG93dXBzIGFyZSByZW5kZXJlZCwgc28gY2FuJ3QgcmVuZGVyIHRoaXMgeWV0XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdG9vbHRpcFByZWZpeCA9IGZvcm1hdENoYXRRdWVzdGlvbih0aGlzLmNoYXRBZ2VudFNlcnZpY2UsIHRoaXMubG9jYXRpb24sICcnLCBmb2xsb3d1cC5hZ2VudElkLCBmb2xsb3d1cC5zdWJDb21tYW5kKTtcblx0XHRpZiAodG9vbHRpcFByZWZpeCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgYmFzZVRpdGxlID0gZm9sbG93dXAua2luZCA9PT0gJ3JlcGx5JyA/XG5cdFx0XHQoZm9sbG93dXAudGl0bGUgfHwgZm9sbG93dXAubWVzc2FnZSlcblx0XHRcdDogZm9sbG93dXAudGl0bGU7XG5cdFx0Y29uc3QgbWVzc2FnZSA9IGZvbGxvd3VwLmtpbmQgPT09ICdyZXBseScgPyBmb2xsb3d1cC5tZXNzYWdlIDogZm9sbG93dXAudGl0bGU7XG5cdFx0Y29uc3QgdG9vbHRpcCA9ICh0b29sdGlwUHJlZml4ICtcblx0XHRcdCgndG9vbHRpcCcgaW4gZm9sbG93dXAgJiYgZm9sbG93dXAudG9vbHRpcCB8fCBtZXNzYWdlKSkudHJpbSgpO1xuXHRcdGNvbnN0IGJ1dHRvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBCdXR0b24oY29udGFpbmVyLCB7IC4uLnRoaXMub3B0aW9ucywgdGl0bGU6IHRvb2x0aXAgfSkpO1xuXHRcdGlmIChmb2xsb3d1cC5raW5kID09PSAncmVwbHknKSB7XG5cdFx0XHRidXR0b24uZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdpbnRlcmFjdGl2ZS1mb2xsb3d1cC1yZXBseScpO1xuXHRcdH0gZWxzZSBpZiAoZm9sbG93dXAua2luZCA9PT0gJ2NvbW1hbmQnKSB7XG5cdFx0XHRidXR0b24uZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdpbnRlcmFjdGl2ZS1mb2xsb3d1cC1jb21tYW5kJyk7XG5cdFx0fVxuXHRcdGJ1dHRvbi5lbGVtZW50LmFyaWFMYWJlbCA9IGxvY2FsaXplKCdmb2xsb3dVcEFyaWFMYWJlbCcsIFwiRm9sbG93IHVwIHF1ZXN0aW9uOiB7MH1cIiwgYmFzZVRpdGxlKTtcblx0XHRidXR0b24ubGFiZWwgPSBuZXcgTWFya2Rvd25TdHJpbmcoYmFzZVRpdGxlKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGJ1dHRvbi5vbkRpZENsaWNrKCgpID0+IHRoaXMuY2xpY2tIYW5kbGVyKGZvbGxvd3VwKSkpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLGNBQTZCO0FBQ3RDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsMEJBQTBCO0FBSW5DLE1BQU0sSUFBSSxJQUFJO0FBRVAsSUFBTSxnQkFBTixjQUFxRCxXQUFXO0FBQUEsRUFDdEUsWUFDQyxXQUNBLFdBQ2lCLFVBQ0EsU0FDQSxjQUNtQixrQkFDbkM7QUFDRCxVQUFNO0FBTFc7QUFDQTtBQUNBO0FBQ21CO0FBSXBDLFVBQU0scUJBQXFCLElBQUksT0FBTyxXQUFXLEVBQUUsZ0NBQWdDLENBQUM7QUFDcEYsY0FBVSxRQUFRLGNBQVksS0FBSyxlQUFlLG9CQUFvQixRQUFRLENBQUM7QUFBQSxFQUNoRjtBQUFBLEVBRVEsZUFBZSxXQUF3QixVQUFtQjtBQUVqRSxRQUFJLENBQUMsS0FBSyxpQkFBaUIsZ0JBQWdCLEtBQUssUUFBUSxHQUFHO0FBRTFEO0FBQUEsSUFDRDtBQUVBLFVBQU0sZ0JBQWdCLG1CQUFtQixLQUFLLGtCQUFrQixLQUFLLFVBQVUsSUFBSSxTQUFTLFNBQVMsU0FBUyxVQUFVO0FBQ3hILFFBQUksa0JBQWtCLFFBQVc7QUFDaEM7QUFBQSxJQUNEO0FBRUEsVUFBTSxZQUFZLFNBQVMsU0FBUyxVQUNsQyxTQUFTLFNBQVMsU0FBUyxVQUMxQixTQUFTO0FBQ1osVUFBTSxVQUFVLFNBQVMsU0FBUyxVQUFVLFNBQVMsVUFBVSxTQUFTO0FBQ3hFLFVBQU0sV0FBVyxpQkFDZixhQUFhLFlBQVksU0FBUyxXQUFXLFVBQVUsS0FBSztBQUM5RCxVQUFNLFNBQVMsS0FBSyxVQUFVLElBQUksT0FBTyxXQUFXLEVBQUUsR0FBRyxLQUFLLFNBQVMsT0FBTyxRQUFRLENBQUMsQ0FBQztBQUN4RixRQUFJLFNBQVMsU0FBUyxTQUFTO0FBQzlCLGFBQU8sUUFBUSxVQUFVLElBQUksNEJBQTRCO0FBQUEsSUFDMUQsV0FBVyxTQUFTLFNBQVMsV0FBVztBQUN2QyxhQUFPLFFBQVEsVUFBVSxJQUFJLDhCQUE4QjtBQUFBLElBQzVEO0FBQ0EsV0FBTyxRQUFRLFlBQVksU0FBUyxxQkFBcUIsMkJBQTJCLFNBQVM7QUFDN0YsV0FBTyxRQUFRLElBQUksZUFBZSxTQUFTO0FBRTNDLFNBQUssVUFBVSxPQUFPLFdBQVcsTUFBTSxLQUFLLGFBQWEsUUFBUSxDQUFDLENBQUM7QUFBQSxFQUNwRTtBQUNEO0FBNUNhLGdCQUFOO0FBQUEsRUFPSjtBQUFBLEdBUFU7IiwKICAibmFtZXMiOiBbXQp9Cg==
