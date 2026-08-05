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
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { chatSubcommandLeader } from "../../common/chatParserTypes.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { localize } from "../../../../../nls.js";
import { Button } from "../../../../../base/browser/ui/button/button.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
let ChatAgentCommandContentPart = class extends Disposable {
  constructor(cmd, onClick, _hoverService) {
    super();
    this._hoverService = _hoverService;
    this.domNode = document.createElement("span");
    this.domNode.classList.add("chat-agent-command");
    this.domNode.setAttribute("aria-label", cmd.name);
    this.domNode.setAttribute("role", "button");
    const groupId = generateUuid();
    const commandSpan = document.createElement("span");
    this.domNode.appendChild(commandSpan);
    commandSpan.innerText = chatSubcommandLeader + cmd.name;
    this._store.add(this._hoverService.setupDelayedHover(commandSpan, { content: cmd.description, appearance: { showPointer: true } }, { groupId }));
    const rerun = localize("rerun", "Rerun without {0}{1}", chatSubcommandLeader, cmd.name);
    const btn = new Button(this.domNode, { ariaLabel: rerun });
    btn.icon = Codicon.close;
    this._store.add(btn.onDidClick(() => onClick()));
    this._store.add(btn);
    this._store.add(this._hoverService.setupDelayedHover(btn.element, { content: rerun, appearance: { showPointer: true } }, { groupId }));
  }
  hasSameContent(other, followingContent, element) {
    return false;
  }
};
ChatAgentCommandContentPart = __decorateClass([
  __decorateParam(2, IHoverService)
], ChatAgentCommandContentPart);
export {
  ChatAgentCommandContentPart
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdENvbnRlbnRQYXJ0cy9jaGF0QWdlbnRDb21tYW5kQ29udGVudFBhcnQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5cbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgSUNoYXRBZ2VudENvbW1hbmQgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdEFnZW50cy5qcyc7XG5pbXBvcnQgeyBjaGF0U3ViY29tbWFuZExlYWRlciB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0UGFyc2VyVHlwZXMuanMnO1xuaW1wb3J0IHsgSUNoYXRSZW5kZXJlckNvbnRlbnQgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdFZpZXdNb2RlbC5qcyc7XG5pbXBvcnQgeyBDaGF0VHJlZUl0ZW0gfSBmcm9tICcuLi9jaGF0LmpzJztcbmltcG9ydCB7IElDaGF0Q29udGVudFBhcnQgfSBmcm9tICcuL2NoYXRDb250ZW50UGFydHMuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IEJ1dHRvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9idXR0b24vYnV0dG9uLmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuXG5cbmV4cG9ydCBjbGFzcyBDaGF0QWdlbnRDb21tYW5kQ29udGVudFBhcnQgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUNoYXRDb250ZW50UGFydCB7XG5cblx0cmVhZG9ubHkgZG9tTm9kZTogSFRNTEVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0Y21kOiBJQ2hhdEFnZW50Q29tbWFuZCxcblx0XHRvbkNsaWNrOiAoKSA9PiB2b2lkLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2hvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLmRvbU5vZGUuY2xhc3NMaXN0LmFkZCgnY2hhdC1hZ2VudC1jb21tYW5kJyk7XG5cdFx0dGhpcy5kb21Ob2RlLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIGNtZC5uYW1lKTtcblx0XHR0aGlzLmRvbU5vZGUuc2V0QXR0cmlidXRlKCdyb2xlJywgJ2J1dHRvbicpO1xuXG5cdFx0Y29uc3QgZ3JvdXBJZCA9IGdlbmVyYXRlVXVpZCgpO1xuXG5cdFx0Y29uc3QgY29tbWFuZFNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG5cdFx0dGhpcy5kb21Ob2RlLmFwcGVuZENoaWxkKGNvbW1hbmRTcGFuKTtcblx0XHRjb21tYW5kU3Bhbi5pbm5lclRleHQgPSBjaGF0U3ViY29tbWFuZExlYWRlciArIGNtZC5uYW1lO1xuXHRcdHRoaXMuX3N0b3JlLmFkZCh0aGlzLl9ob3ZlclNlcnZpY2Uuc2V0dXBEZWxheWVkSG92ZXIoY29tbWFuZFNwYW4sIHsgY29udGVudDogY21kLmRlc2NyaXB0aW9uLCBhcHBlYXJhbmNlOiB7IHNob3dQb2ludGVyOiB0cnVlIH0gfSwgeyBncm91cElkIH0pKTtcblxuXHRcdGNvbnN0IHJlcnVuID0gbG9jYWxpemUoJ3JlcnVuJywgXCJSZXJ1biB3aXRob3V0IHswfXsxfVwiLCBjaGF0U3ViY29tbWFuZExlYWRlciwgY21kLm5hbWUpO1xuXHRcdGNvbnN0IGJ0biA9IG5ldyBCdXR0b24odGhpcy5kb21Ob2RlLCB7IGFyaWFMYWJlbDogcmVydW4gfSk7XG5cdFx0YnRuLmljb24gPSBDb2RpY29uLmNsb3NlO1xuXHRcdHRoaXMuX3N0b3JlLmFkZChidG4ub25EaWRDbGljaygoKSA9PiBvbkNsaWNrKCkpKTtcblx0XHR0aGlzLl9zdG9yZS5hZGQoYnRuKTtcblx0XHR0aGlzLl9zdG9yZS5hZGQodGhpcy5faG92ZXJTZXJ2aWNlLnNldHVwRGVsYXllZEhvdmVyKGJ0bi5lbGVtZW50LCB7IGNvbnRlbnQ6IHJlcnVuLCBhcHBlYXJhbmNlOiB7IHNob3dQb2ludGVyOiB0cnVlIH0gfSwgeyBncm91cElkIH0pKTtcblx0fVxuXG5cdGhhc1NhbWVDb250ZW50KG90aGVyOiBJQ2hhdFJlbmRlcmVyQ29udGVudCwgZm9sbG93aW5nQ29udGVudDogSUNoYXRSZW5kZXJlckNvbnRlbnRbXSwgZWxlbWVudDogQ2hhdFRyZWVJdGVtKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQU1BLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMscUJBQXFCO0FBRTlCLFNBQVMsNEJBQTRCO0FBSXJDLFNBQVMsZUFBZTtBQUN4QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGNBQWM7QUFDdkIsU0FBUyxvQkFBb0I7QUFHdEIsSUFBTSw4QkFBTixjQUEwQyxXQUF1QztBQUFBLEVBSXZGLFlBQ0MsS0FDQSxTQUNnQyxlQUMvQjtBQUNELFVBQU07QUFGMEI7QUFMakMsU0FBUyxVQUF1QixTQUFTLGNBQWMsTUFBTTtBQVE1RCxTQUFLLFFBQVEsVUFBVSxJQUFJLG9CQUFvQjtBQUMvQyxTQUFLLFFBQVEsYUFBYSxjQUFjLElBQUksSUFBSTtBQUNoRCxTQUFLLFFBQVEsYUFBYSxRQUFRLFFBQVE7QUFFMUMsVUFBTSxVQUFVLGFBQWE7QUFFN0IsVUFBTSxjQUFjLFNBQVMsY0FBYyxNQUFNO0FBQ2pELFNBQUssUUFBUSxZQUFZLFdBQVc7QUFDcEMsZ0JBQVksWUFBWSx1QkFBdUIsSUFBSTtBQUNuRCxTQUFLLE9BQU8sSUFBSSxLQUFLLGNBQWMsa0JBQWtCLGFBQWEsRUFBRSxTQUFTLElBQUksYUFBYSxZQUFZLEVBQUUsYUFBYSxLQUFLLEVBQUUsR0FBRyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBRS9JLFVBQU0sUUFBUSxTQUFTLFNBQVMsd0JBQXdCLHNCQUFzQixJQUFJLElBQUk7QUFDdEYsVUFBTSxNQUFNLElBQUksT0FBTyxLQUFLLFNBQVMsRUFBRSxXQUFXLE1BQU0sQ0FBQztBQUN6RCxRQUFJLE9BQU8sUUFBUTtBQUNuQixTQUFLLE9BQU8sSUFBSSxJQUFJLFdBQVcsTUFBTSxRQUFRLENBQUMsQ0FBQztBQUMvQyxTQUFLLE9BQU8sSUFBSSxHQUFHO0FBQ25CLFNBQUssT0FBTyxJQUFJLEtBQUssY0FBYyxrQkFBa0IsSUFBSSxTQUFTLEVBQUUsU0FBUyxPQUFPLFlBQVksRUFBRSxhQUFhLEtBQUssRUFBRSxHQUFHLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFBQSxFQUN0STtBQUFBLEVBRUEsZUFBZSxPQUE2QixrQkFBMEMsU0FBZ0M7QUFDckgsV0FBTztBQUFBLEVBQ1I7QUFDRDtBQWhDYSw4QkFBTjtBQUFBLEVBT0o7QUFBQSxHQVBVOyIsCiAgIm5hbWVzIjogW10KfQo=
