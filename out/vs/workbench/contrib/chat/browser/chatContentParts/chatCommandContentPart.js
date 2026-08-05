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
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../nls.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { defaultButtonStyles } from "../../../../../platform/theme/browser/defaultStyles.js";
import { isResponseVM } from "../../common/chatViewModel.js";
const $ = dom.$;
let ChatCommandButtonContentPart = class extends Disposable {
  constructor(commandButton, context, commandService) {
    super();
    this.commandService = commandService;
    this.domNode = $(".chat-command-button");
    const enabled = !isResponseVM(context.element) || !context.element.isStale;
    const tooltip = enabled ? commandButton.command.tooltip : localize("commandButtonDisabled", "Button not available in restored chat");
    const button = this._register(new Button(this.domNode, { ...defaultButtonStyles, supportIcons: true, title: tooltip }));
    button.label = commandButton.command.title;
    button.enabled = enabled;
    this._register(button.onDidClick(() => this.commandService.executeCommand(commandButton.command.id, ...commandButton.command.arguments ?? [])));
  }
  hasSameContent(other) {
    return other.kind === "command";
  }
};
ChatCommandButtonContentPart = __decorateClass([
  __decorateParam(2, ICommandService)
], ChatCommandButtonContentPart);
export {
  ChatCommandButtonContentPart
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdENvbnRlbnRQYXJ0cy9jaGF0Q29tbWFuZENvbnRlbnRQYXJ0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgQnV0dG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2J1dHRvbi9idXR0b24uanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgZGVmYXVsdEJ1dHRvblN0eWxlcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2Jyb3dzZXIvZGVmYXVsdFN0eWxlcy5qcyc7XG5pbXBvcnQgeyBJQ2hhdENvbnRlbnRQYXJ0LCBJQ2hhdENvbnRlbnRQYXJ0UmVuZGVyQ29udGV4dCB9IGZyb20gJy4vY2hhdENvbnRlbnRQYXJ0cy5qcyc7XG5pbXBvcnQgeyBJQ2hhdFByb2dyZXNzUmVuZGVyYWJsZVJlc3BvbnNlQ29udGVudCB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0TW9kZWwuanMnO1xuaW1wb3J0IHsgSUNoYXRDb21tYW5kQnV0dG9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGlzUmVzcG9uc2VWTSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0Vmlld01vZGVsLmpzJztcblxuY29uc3QgJCA9IGRvbS4kO1xuXG5leHBvcnQgY2xhc3MgQ2hhdENvbW1hbmRCdXR0b25Db250ZW50UGFydCBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJQ2hhdENvbnRlbnRQYXJ0IHtcblx0cHVibGljIHJlYWRvbmx5IGRvbU5vZGU6IEhUTUxFbGVtZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGNvbW1hbmRCdXR0b246IElDaGF0Q29tbWFuZEJ1dHRvbixcblx0XHRjb250ZXh0OiBJQ2hhdENvbnRlbnRQYXJ0UmVuZGVyQ29udGV4dCxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5kb21Ob2RlID0gJCgnLmNoYXQtY29tbWFuZC1idXR0b24nKTtcblx0XHRjb25zdCBlbmFibGVkID0gIWlzUmVzcG9uc2VWTShjb250ZXh0LmVsZW1lbnQpIHx8ICFjb250ZXh0LmVsZW1lbnQuaXNTdGFsZTtcblx0XHRjb25zdCB0b29sdGlwID0gZW5hYmxlZCA/XG5cdFx0XHRjb21tYW5kQnV0dG9uLmNvbW1hbmQudG9vbHRpcCA6XG5cdFx0XHRsb2NhbGl6ZSgnY29tbWFuZEJ1dHRvbkRpc2FibGVkJywgXCJCdXR0b24gbm90IGF2YWlsYWJsZSBpbiByZXN0b3JlZCBjaGF0XCIpO1xuXHRcdGNvbnN0IGJ1dHRvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBCdXR0b24odGhpcy5kb21Ob2RlLCB7IC4uLmRlZmF1bHRCdXR0b25TdHlsZXMsIHN1cHBvcnRJY29uczogdHJ1ZSwgdGl0bGU6IHRvb2x0aXAgfSkpO1xuXHRcdGJ1dHRvbi5sYWJlbCA9IGNvbW1hbmRCdXR0b24uY29tbWFuZC50aXRsZTtcblx0XHRidXR0b24uZW5hYmxlZCA9IGVuYWJsZWQ7XG5cblx0XHQvLyBUT0RPIHN0aWxsIG5lZWQgdGVsZW1ldHJ5IGZvciBjb21tYW5kIGJ1dHRvbnNcblx0XHR0aGlzLl9yZWdpc3RlcihidXR0b24ub25EaWRDbGljaygoKSA9PiB0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKGNvbW1hbmRCdXR0b24uY29tbWFuZC5pZCwgLi4uKGNvbW1hbmRCdXR0b24uY29tbWFuZC5hcmd1bWVudHMgPz8gW10pKSkpO1xuXHR9XG5cblx0aGFzU2FtZUNvbnRlbnQob3RoZXI6IElDaGF0UHJvZ3Jlc3NSZW5kZXJhYmxlUmVzcG9uc2VDb250ZW50KTogYm9vbGVhbiB7XG5cdFx0Ly8gTm8gb3RoZXIgY2hhbmdlIGFsbG93ZWQgZm9yIHRoaXMgY29udGVudCB0eXBlXG5cdFx0cmV0dXJuIG90aGVyLmtpbmQgPT09ICdjb21tYW5kJztcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFDckIsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsMkJBQTJCO0FBSXBDLFNBQVMsb0JBQW9CO0FBRTdCLE1BQU0sSUFBSSxJQUFJO0FBRVAsSUFBTSwrQkFBTixjQUEyQyxXQUF1QztBQUFBLEVBR3hGLFlBQ0MsZUFDQSxTQUNrQyxnQkFDakM7QUFDRCxVQUFNO0FBRjRCO0FBSWxDLFNBQUssVUFBVSxFQUFFLHNCQUFzQjtBQUN2QyxVQUFNLFVBQVUsQ0FBQyxhQUFhLFFBQVEsT0FBTyxLQUFLLENBQUMsUUFBUSxRQUFRO0FBQ25FLFVBQU0sVUFBVSxVQUNmLGNBQWMsUUFBUSxVQUN0QixTQUFTLHlCQUF5Qix1Q0FBdUM7QUFDMUUsVUFBTSxTQUFTLEtBQUssVUFBVSxJQUFJLE9BQU8sS0FBSyxTQUFTLEVBQUUsR0FBRyxxQkFBcUIsY0FBYyxNQUFNLE9BQU8sUUFBUSxDQUFDLENBQUM7QUFDdEgsV0FBTyxRQUFRLGNBQWMsUUFBUTtBQUNyQyxXQUFPLFVBQVU7QUFHakIsU0FBSyxVQUFVLE9BQU8sV0FBVyxNQUFNLEtBQUssZUFBZSxlQUFlLGNBQWMsUUFBUSxJQUFJLEdBQUksY0FBYyxRQUFRLGFBQWEsQ0FBQyxDQUFFLENBQUMsQ0FBQztBQUFBLEVBQ2pKO0FBQUEsRUFFQSxlQUFlLE9BQXdEO0FBRXRFLFdBQU8sTUFBTSxTQUFTO0FBQUEsRUFDdkI7QUFDRDtBQTNCYSwrQkFBTjtBQUFBLEVBTUo7QUFBQSxHQU5VOyIsCiAgIm5hbWVzIjogW10KfQo=
