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
import { Codicon } from "../../../../../base/common/codicons.js";
import { Emitter } from "../../../../../base/common/event.js";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { assertType } from "../../../../../base/common/types.js";
import { localize } from "../../../../../nls.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { defaultButtonStyles } from "../../../../../platform/theme/browser/defaultStyles.js";
import { asCssVariable, textLinkForeground } from "../../../../../platform/theme/common/colorRegistry.js";
import { IChatWidgetService } from "../chat.js";
const $ = dom.$;
let shouldShowRetryButton = false;
let shouldShowWaitWarning = false;
let ChatQuotaExceededPart = class extends Disposable {
  constructor(element, renderer, chatWidgetService, commandService, telemetryService) {
    super();
    this._onDidChangeHeight = this._register(new Emitter());
    this.onDidChangeHeight = this._onDidChangeHeight.event;
    const errorDetails = element.errorDetails;
    assertType(!!errorDetails, "errorDetails");
    this.domNode = $(".chat-quota-error-widget");
    const icon = dom.append(this.domNode, $("span"));
    icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.warning));
    const messageContainer = dom.append(this.domNode, $(".chat-quota-error-message"));
    const markdownContent = renderer.render(new MarkdownString(errorDetails.message));
    dom.append(messageContainer, markdownContent.element);
    const button1 = this._register(new Button(messageContainer, { ...defaultButtonStyles, supportIcons: true }));
    button1.label = localize("upgradeToCopilotPro", "Upgrade to Copilot Pro");
    button1.element.classList.add("chat-quota-error-button");
    let hasAddedWaitWarning = false;
    const addWaitWarningIfNeeded = () => {
      if (!shouldShowWaitWarning || hasAddedWaitWarning) {
        return;
      }
      hasAddedWaitWarning = true;
      dom.append(messageContainer, $(".chat-quota-wait-warning", void 0, localize("waitWarning", "Signing up may take a few minutes to take effect.")));
    };
    let hasAddedRetryButton = false;
    const addRetryButtonIfNeeded = () => {
      if (!shouldShowRetryButton || hasAddedRetryButton) {
        return;
      }
      hasAddedRetryButton = true;
      const button2 = this._register(new Button(messageContainer, {
        buttonBackground: void 0,
        buttonForeground: asCssVariable(textLinkForeground)
      }));
      button2.element.classList.add("chat-quota-error-secondary-button");
      button2.label = localize("signedUpClickToContinue", "Signed up? Click to retry.");
      this._onDidChangeHeight.fire();
      this._register(button2.onDidClick(() => {
        const widget = chatWidgetService.getWidgetBySessionId(element.sessionId);
        if (!widget) {
          return;
        }
        widget.rerunLastRequest();
        shouldShowWaitWarning = true;
        addWaitWarningIfNeeded();
      }));
    };
    this._register(button1.onDidClick(async () => {
      const commandId = "workbench.action.chat.upgradePlan";
      telemetryService.publicLog2("workbenchActionExecuted", { id: commandId, from: "chat-response" });
      await commandService.executeCommand(commandId);
      shouldShowRetryButton = true;
      addRetryButtonIfNeeded();
    }));
    addRetryButtonIfNeeded();
    addWaitWarningIfNeeded();
  }
  hasSameContent(other) {
    return true;
  }
};
ChatQuotaExceededPart = __decorateClass([
  __decorateParam(2, IChatWidgetService),
  __decorateParam(3, ICommandService),
  __decorateParam(4, ITelemetryService)
], ChatQuotaExceededPart);
export {
  ChatQuotaExceededPart
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdENvbnRlbnRQYXJ0cy9jaGF0UXVvdGFFeGNlZWRlZFBhcnQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBCdXR0b24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYnV0dG9uL2J1dHRvbi5qcyc7XG5pbXBvcnQgeyBXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZENsYXNzaWZpY2F0aW9uLCBXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IE1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgYXNzZXJ0VHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IE1hcmtkb3duUmVuZGVyZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci93aWRnZXQvbWFya2Rvd25SZW5kZXJlci9icm93c2VyL21hcmtkb3duUmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgZGVmYXVsdEJ1dHRvblN0eWxlcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2Jyb3dzZXIvZGVmYXVsdFN0eWxlcy5qcyc7XG5pbXBvcnQgeyBhc0Nzc1ZhcmlhYmxlLCB0ZXh0TGlua0ZvcmVncm91bmQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJQ2hhdFJlc3BvbnNlVmlld01vZGVsIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRWaWV3TW9kZWwuanMnO1xuaW1wb3J0IHsgSUNoYXRXaWRnZXRTZXJ2aWNlIH0gZnJvbSAnLi4vY2hhdC5qcyc7XG5pbXBvcnQgeyBJQ2hhdENvbnRlbnRQYXJ0IH0gZnJvbSAnLi9jaGF0Q29udGVudFBhcnRzLmpzJztcblxuY29uc3QgJCA9IGRvbS4kO1xuXG4vKipcbiAqIE9uY2UgdGhlIHNpZ24gdXAgYnV0dG9uIGlzIGNsaWNrZWQsIGFuZCB0aGUgcmV0cnkgYnV0dG9uIGhhcyBiZWVuIHNob3duLCBpdCBzaG91bGQgYmUgc2hvd24gZXZlcnkgdGltZS5cbiAqL1xubGV0IHNob3VsZFNob3dSZXRyeUJ1dHRvbiA9IGZhbHNlO1xuXG4vKipcbiAqIE9uY2UgdGhlICdyZXRyeScgYnV0dG9uIGlzIGNsaWNrZWQsIHRoZSB3YWl0IHdhcm5pbmcgc2hvdWxkIGJlIHNob3duIGV2ZXJ5IHRpbWUuXG4gKi9cbmxldCBzaG91bGRTaG93V2FpdFdhcm5pbmcgPSBmYWxzZTtcblxuZXhwb3J0IGNsYXNzIENoYXRRdW90YUV4Y2VlZGVkUGFydCBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJQ2hhdENvbnRlbnRQYXJ0IHtcblx0cHVibGljIHJlYWRvbmx5IGRvbU5vZGU6IEhUTUxFbGVtZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlSGVpZ2h0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZUhlaWdodCA9IHRoaXMuX29uRGlkQ2hhbmdlSGVpZ2h0LmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGVsZW1lbnQ6IElDaGF0UmVzcG9uc2VWaWV3TW9kZWwsXG5cdFx0cmVuZGVyZXI6IE1hcmtkb3duUmVuZGVyZXIsXG5cdFx0QElDaGF0V2lkZ2V0U2VydmljZSBjaGF0V2lkZ2V0U2VydmljZTogSUNoYXRXaWRnZXRTZXJ2aWNlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRjb25zdCBlcnJvckRldGFpbHMgPSBlbGVtZW50LmVycm9yRGV0YWlscztcblx0XHRhc3NlcnRUeXBlKCEhZXJyb3JEZXRhaWxzLCAnZXJyb3JEZXRhaWxzJyk7XG5cblx0XHR0aGlzLmRvbU5vZGUgPSAkKCcuY2hhdC1xdW90YS1lcnJvci13aWRnZXQnKTtcblx0XHRjb25zdCBpY29uID0gZG9tLmFwcGVuZCh0aGlzLmRvbU5vZGUsICQoJ3NwYW4nKSk7XG5cdFx0aWNvbi5jbGFzc0xpc3QuYWRkKC4uLlRoZW1lSWNvbi5hc0NsYXNzTmFtZUFycmF5KENvZGljb24ud2FybmluZykpO1xuXG5cdFx0Y29uc3QgbWVzc2FnZUNvbnRhaW5lciA9IGRvbS5hcHBlbmQodGhpcy5kb21Ob2RlLCAkKCcuY2hhdC1xdW90YS1lcnJvci1tZXNzYWdlJykpO1xuXHRcdGNvbnN0IG1hcmtkb3duQ29udGVudCA9IHJlbmRlcmVyLnJlbmRlcihuZXcgTWFya2Rvd25TdHJpbmcoZXJyb3JEZXRhaWxzLm1lc3NhZ2UpKTtcblx0XHRkb20uYXBwZW5kKG1lc3NhZ2VDb250YWluZXIsIG1hcmtkb3duQ29udGVudC5lbGVtZW50KTtcblxuXHRcdGNvbnN0IGJ1dHRvbjEgPSB0aGlzLl9yZWdpc3RlcihuZXcgQnV0dG9uKG1lc3NhZ2VDb250YWluZXIsIHsgLi4uZGVmYXVsdEJ1dHRvblN0eWxlcywgc3VwcG9ydEljb25zOiB0cnVlIH0pKTtcblx0XHRidXR0b24xLmxhYmVsID0gbG9jYWxpemUoJ3VwZ3JhZGVUb0NvcGlsb3RQcm8nLCBcIlVwZ3JhZGUgdG8gQ29waWxvdCBQcm9cIik7XG5cdFx0YnV0dG9uMS5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2NoYXQtcXVvdGEtZXJyb3ItYnV0dG9uJyk7XG5cblx0XHRsZXQgaGFzQWRkZWRXYWl0V2FybmluZyA9IGZhbHNlO1xuXHRcdGNvbnN0IGFkZFdhaXRXYXJuaW5nSWZOZWVkZWQgPSAoKSA9PiB7XG5cdFx0XHRpZiAoIXNob3VsZFNob3dXYWl0V2FybmluZyB8fCBoYXNBZGRlZFdhaXRXYXJuaW5nKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aGFzQWRkZWRXYWl0V2FybmluZyA9IHRydWU7XG5cdFx0XHRkb20uYXBwZW5kKG1lc3NhZ2VDb250YWluZXIsICQoJy5jaGF0LXF1b3RhLXdhaXQtd2FybmluZycsIHVuZGVmaW5lZCwgbG9jYWxpemUoJ3dhaXRXYXJuaW5nJywgXCJTaWduaW5nIHVwIG1heSB0YWtlIGEgZmV3IG1pbnV0ZXMgdG8gdGFrZSBlZmZlY3QuXCIpKSk7XG5cdFx0fTtcblxuXHRcdGxldCBoYXNBZGRlZFJldHJ5QnV0dG9uID0gZmFsc2U7XG5cdFx0Y29uc3QgYWRkUmV0cnlCdXR0b25JZk5lZWRlZCA9ICgpID0+IHtcblx0XHRcdGlmICghc2hvdWxkU2hvd1JldHJ5QnV0dG9uIHx8IGhhc0FkZGVkUmV0cnlCdXR0b24pIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRoYXNBZGRlZFJldHJ5QnV0dG9uID0gdHJ1ZTtcblx0XHRcdGNvbnN0IGJ1dHRvbjIgPSB0aGlzLl9yZWdpc3RlcihuZXcgQnV0dG9uKG1lc3NhZ2VDb250YWluZXIsIHtcblx0XHRcdFx0YnV0dG9uQmFja2dyb3VuZDogdW5kZWZpbmVkLFxuXHRcdFx0XHRidXR0b25Gb3JlZ3JvdW5kOiBhc0Nzc1ZhcmlhYmxlKHRleHRMaW5rRm9yZWdyb3VuZClcblx0XHRcdH0pKTtcblx0XHRcdGJ1dHRvbjIuZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdjaGF0LXF1b3RhLWVycm9yLXNlY29uZGFyeS1idXR0b24nKTtcblx0XHRcdGJ1dHRvbjIubGFiZWwgPSBsb2NhbGl6ZSgnc2lnbmVkVXBDbGlja1RvQ29udGludWUnLCBcIlNpZ25lZCB1cD8gQ2xpY2sgdG8gcmV0cnkuXCIpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VIZWlnaHQuZmlyZSgpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoYnV0dG9uMi5vbkRpZENsaWNrKCgpID0+IHtcblx0XHRcdFx0Y29uc3Qgd2lkZ2V0ID0gY2hhdFdpZGdldFNlcnZpY2UuZ2V0V2lkZ2V0QnlTZXNzaW9uSWQoZWxlbWVudC5zZXNzaW9uSWQpO1xuXHRcdFx0XHRpZiAoIXdpZGdldCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHdpZGdldC5yZXJ1bkxhc3RSZXF1ZXN0KCk7XG5cblx0XHRcdFx0c2hvdWxkU2hvd1dhaXRXYXJuaW5nID0gdHJ1ZTtcblx0XHRcdFx0YWRkV2FpdFdhcm5pbmdJZk5lZWRlZCgpO1xuXHRcdFx0fSkpO1xuXHRcdH07XG5cblx0XHR0aGlzLl9yZWdpc3RlcihidXR0b24xLm9uRGlkQ2xpY2soYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgY29tbWFuZElkID0gJ3dvcmtiZW5jaC5hY3Rpb24uY2hhdC51cGdyYWRlUGxhbic7XG5cdFx0XHR0ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8V29ya2JlbmNoQWN0aW9uRXhlY3V0ZWRFdmVudCwgV29ya2JlbmNoQWN0aW9uRXhlY3V0ZWRDbGFzc2lmaWNhdGlvbj4oJ3dvcmtiZW5jaEFjdGlvbkV4ZWN1dGVkJywgeyBpZDogY29tbWFuZElkLCBmcm9tOiAnY2hhdC1yZXNwb25zZScgfSk7XG5cdFx0XHRhd2FpdCBjb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChjb21tYW5kSWQpO1xuXG5cdFx0XHRzaG91bGRTaG93UmV0cnlCdXR0b24gPSB0cnVlO1xuXHRcdFx0YWRkUmV0cnlCdXR0b25JZk5lZWRlZCgpO1xuXHRcdH0pKTtcblxuXHRcdGFkZFJldHJ5QnV0dG9uSWZOZWVkZWQoKTtcblx0XHRhZGRXYWl0V2FybmluZ0lmTmVlZGVkKCk7XG5cdH1cblxuXHRoYXNTYW1lQ29udGVudChvdGhlcjogdW5rbm93bik6IGJvb2xlYW4ge1xuXHRcdC8vIE5vdCBjdXJyZW50bHkgdXNlZFxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLGNBQWM7QUFFdkIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsZUFBZTtBQUN4QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGtCQUFrQjtBQUUzQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLGVBQWUsMEJBQTBCO0FBRWxELFNBQVMsMEJBQTBCO0FBR25DLE1BQU0sSUFBSSxJQUFJO0FBS2QsSUFBSSx3QkFBd0I7QUFLNUIsSUFBSSx3QkFBd0I7QUFFckIsSUFBTSx3QkFBTixjQUFvQyxXQUF1QztBQUFBLEVBTWpGLFlBQ0MsU0FDQSxVQUNvQixtQkFDSCxnQkFDRSxrQkFDbEI7QUFDRCxVQUFNO0FBVlAsU0FBaUIscUJBQXFCLEtBQUssVUFBVSxJQUFJLFFBQWMsQ0FBQztBQUN4RSxTQUFnQixvQkFBb0IsS0FBSyxtQkFBbUI7QUFXM0QsVUFBTSxlQUFlLFFBQVE7QUFDN0IsZUFBVyxDQUFDLENBQUMsY0FBYyxjQUFjO0FBRXpDLFNBQUssVUFBVSxFQUFFLDBCQUEwQjtBQUMzQyxVQUFNLE9BQU8sSUFBSSxPQUFPLEtBQUssU0FBUyxFQUFFLE1BQU0sQ0FBQztBQUMvQyxTQUFLLFVBQVUsSUFBSSxHQUFHLFVBQVUsaUJBQWlCLFFBQVEsT0FBTyxDQUFDO0FBRWpFLFVBQU0sbUJBQW1CLElBQUksT0FBTyxLQUFLLFNBQVMsRUFBRSwyQkFBMkIsQ0FBQztBQUNoRixVQUFNLGtCQUFrQixTQUFTLE9BQU8sSUFBSSxlQUFlLGFBQWEsT0FBTyxDQUFDO0FBQ2hGLFFBQUksT0FBTyxrQkFBa0IsZ0JBQWdCLE9BQU87QUFFcEQsVUFBTSxVQUFVLEtBQUssVUFBVSxJQUFJLE9BQU8sa0JBQWtCLEVBQUUsR0FBRyxxQkFBcUIsY0FBYyxLQUFLLENBQUMsQ0FBQztBQUMzRyxZQUFRLFFBQVEsU0FBUyx1QkFBdUIsd0JBQXdCO0FBQ3hFLFlBQVEsUUFBUSxVQUFVLElBQUkseUJBQXlCO0FBRXZELFFBQUksc0JBQXNCO0FBQzFCLFVBQU0seUJBQXlCLE1BQU07QUFDcEMsVUFBSSxDQUFDLHlCQUF5QixxQkFBcUI7QUFDbEQ7QUFBQSxNQUNEO0FBRUEsNEJBQXNCO0FBQ3RCLFVBQUksT0FBTyxrQkFBa0IsRUFBRSw0QkFBNEIsUUFBVyxTQUFTLGVBQWUsbURBQW1ELENBQUMsQ0FBQztBQUFBLElBQ3BKO0FBRUEsUUFBSSxzQkFBc0I7QUFDMUIsVUFBTSx5QkFBeUIsTUFBTTtBQUNwQyxVQUFJLENBQUMseUJBQXlCLHFCQUFxQjtBQUNsRDtBQUFBLE1BQ0Q7QUFFQSw0QkFBc0I7QUFDdEIsWUFBTSxVQUFVLEtBQUssVUFBVSxJQUFJLE9BQU8sa0JBQWtCO0FBQUEsUUFDM0Qsa0JBQWtCO0FBQUEsUUFDbEIsa0JBQWtCLGNBQWMsa0JBQWtCO0FBQUEsTUFDbkQsQ0FBQyxDQUFDO0FBQ0YsY0FBUSxRQUFRLFVBQVUsSUFBSSxtQ0FBbUM7QUFDakUsY0FBUSxRQUFRLFNBQVMsMkJBQTJCLDRCQUE0QjtBQUNoRixXQUFLLG1CQUFtQixLQUFLO0FBQzdCLFdBQUssVUFBVSxRQUFRLFdBQVcsTUFBTTtBQUN2QyxjQUFNLFNBQVMsa0JBQWtCLHFCQUFxQixRQUFRLFNBQVM7QUFDdkUsWUFBSSxDQUFDLFFBQVE7QUFDWjtBQUFBLFFBQ0Q7QUFFQSxlQUFPLGlCQUFpQjtBQUV4QixnQ0FBd0I7QUFDeEIsK0JBQXVCO0FBQUEsTUFDeEIsQ0FBQyxDQUFDO0FBQUEsSUFDSDtBQUVBLFNBQUssVUFBVSxRQUFRLFdBQVcsWUFBWTtBQUM3QyxZQUFNLFlBQVk7QUFDbEIsdUJBQWlCLFdBQWdGLDJCQUEyQixFQUFFLElBQUksV0FBVyxNQUFNLGdCQUFnQixDQUFDO0FBQ3BLLFlBQU0sZUFBZSxlQUFlLFNBQVM7QUFFN0MsOEJBQXdCO0FBQ3hCLDZCQUF1QjtBQUFBLElBQ3hCLENBQUMsQ0FBQztBQUVGLDJCQUF1QjtBQUN2QiwyQkFBdUI7QUFBQSxFQUN4QjtBQUFBLEVBRUEsZUFBZSxPQUF5QjtBQUV2QyxXQUFPO0FBQUEsRUFDUjtBQUNEO0FBcEZhLHdCQUFOO0FBQUEsRUFTSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FYVTsiLAogICJuYW1lcyI6IFtdCn0K
