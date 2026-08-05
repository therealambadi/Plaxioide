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
import "./media/editorHoverWrapper.css";
import * as dom from "../../../../../base/browser/dom.js";
import { HoverAction } from "../../../../../base/browser/ui/hover/hoverWidget.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
const $ = dom.$;
const h = dom.h;
let ChatEditorHoverWrapper = class {
  constructor(hoverContentElement, actions, keybindingService) {
    this.keybindingService = keybindingService;
    const hoverElement = h(
      ".chat-editor-hover-wrapper@root",
      [h(".chat-editor-hover-wrapper-content@content")]
    );
    this.domNode = hoverElement.root;
    hoverElement.content.appendChild(hoverContentElement);
    if (actions && actions.length > 0) {
      const statusBarElement = $(".hover-row.status-bar");
      const actionsElement = $(".actions");
      actions.forEach((action) => {
        const keybinding = this.keybindingService.lookupKeybinding(action.commandId);
        const keybindingLabel = keybinding ? keybinding.getLabel() : null;
        HoverAction.render(actionsElement, {
          label: action.label,
          commandId: action.commandId,
          run: (e) => {
            action.run(e);
          },
          iconClass: action.iconClass
        }, keybindingLabel);
      });
      statusBarElement.appendChild(actionsElement);
      this.domNode.appendChild(statusBarElement);
    }
  }
};
ChatEditorHoverWrapper = __decorateClass([
  __decorateParam(2, IKeybindingService)
], ChatEditorHoverWrapper);
export {
  ChatEditorHoverWrapper
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY29udHJpYi9lZGl0b3JIb3ZlcldyYXBwZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgJy4vbWVkaWEvZWRpdG9ySG92ZXJXcmFwcGVyLmNzcyc7XG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBJSG92ZXJBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgSG92ZXJBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXJXaWRnZXQuanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5cbmNvbnN0ICQgPSBkb20uJDtcbmNvbnN0IGggPSBkb20uaDtcblxuLyoqXG4gKiBUaGlzIGJvcnJvd3Mgc29tZSBvZiBIb3ZlcldpZGdldCBzbyB0aGF0IGEgY2hhdCBlZGl0b3IgaG92ZXIgY2FuIGJlIHJlbmRlcmVkIGluIHRoZSBzYW1lIHdheSBhcyBhIHdvcmtiZW5jaCBob3Zlci5cbiAqIE1heWJlIGl0IGNhbiBiZSByZXVzYWJsZSBpbiBhIGdlbmVyaWMgd2F5LlxuICovXG5leHBvcnQgY2xhc3MgQ2hhdEVkaXRvckhvdmVyV3JhcHBlciB7XG5cdHB1YmxpYyByZWFkb25seSBkb21Ob2RlOiBIVE1MRWxlbWVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRob3ZlckNvbnRlbnRFbGVtZW50OiBIVE1MRWxlbWVudCxcblx0XHRhY3Rpb25zOiBJSG92ZXJBY3Rpb25bXSB8IHVuZGVmaW5lZCxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0KSB7XG5cdFx0Y29uc3QgaG92ZXJFbGVtZW50ID0gaChcblx0XHRcdCcuY2hhdC1lZGl0b3ItaG92ZXItd3JhcHBlckByb290Jyxcblx0XHRcdFtoKCcuY2hhdC1lZGl0b3ItaG92ZXItd3JhcHBlci1jb250ZW50QGNvbnRlbnQnKV0pO1xuXHRcdHRoaXMuZG9tTm9kZSA9IGhvdmVyRWxlbWVudC5yb290O1xuXHRcdGhvdmVyRWxlbWVudC5jb250ZW50LmFwcGVuZENoaWxkKGhvdmVyQ29udGVudEVsZW1lbnQpO1xuXG5cdFx0aWYgKGFjdGlvbnMgJiYgYWN0aW9ucy5sZW5ndGggPiAwKSB7XG5cdFx0XHRjb25zdCBzdGF0dXNCYXJFbGVtZW50ID0gJCgnLmhvdmVyLXJvdy5zdGF0dXMtYmFyJyk7XG5cdFx0XHRjb25zdCBhY3Rpb25zRWxlbWVudCA9ICQoJy5hY3Rpb25zJyk7XG5cdFx0XHRhY3Rpb25zLmZvckVhY2goYWN0aW9uID0+IHtcblx0XHRcdFx0Y29uc3Qga2V5YmluZGluZyA9IHRoaXMua2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyhhY3Rpb24uY29tbWFuZElkKTtcblx0XHRcdFx0Y29uc3Qga2V5YmluZGluZ0xhYmVsID0ga2V5YmluZGluZyA/IGtleWJpbmRpbmcuZ2V0TGFiZWwoKSA6IG51bGw7XG5cdFx0XHRcdEhvdmVyQWN0aW9uLnJlbmRlcihhY3Rpb25zRWxlbWVudCwge1xuXHRcdFx0XHRcdGxhYmVsOiBhY3Rpb24ubGFiZWwsXG5cdFx0XHRcdFx0Y29tbWFuZElkOiBhY3Rpb24uY29tbWFuZElkLFxuXHRcdFx0XHRcdHJ1bjogZSA9PiB7XG5cdFx0XHRcdFx0XHRhY3Rpb24ucnVuKGUpO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0aWNvbkNsYXNzOiBhY3Rpb24uaWNvbkNsYXNzXG5cdFx0XHRcdH0sIGtleWJpbmRpbmdMYWJlbCk7XG5cdFx0XHR9KTtcblx0XHRcdHN0YXR1c0JhckVsZW1lbnQuYXBwZW5kQ2hpbGQoYWN0aW9uc0VsZW1lbnQpO1xuXHRcdFx0dGhpcy5kb21Ob2RlLmFwcGVuZENoaWxkKHN0YXR1c0JhckVsZW1lbnQpO1xuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxPQUFPO0FBQ1AsWUFBWSxTQUFTO0FBRXJCLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsMEJBQTBCO0FBRW5DLE1BQU0sSUFBSSxJQUFJO0FBQ2QsTUFBTSxJQUFJLElBQUk7QUFNUCxJQUFNLHlCQUFOLE1BQTZCO0FBQUEsRUFHbkMsWUFDQyxxQkFDQSxTQUNxQyxtQkFDcEM7QUFEb0M7QUFFckMsVUFBTSxlQUFlO0FBQUEsTUFDcEI7QUFBQSxNQUNBLENBQUMsRUFBRSw0Q0FBNEMsQ0FBQztBQUFBLElBQUM7QUFDbEQsU0FBSyxVQUFVLGFBQWE7QUFDNUIsaUJBQWEsUUFBUSxZQUFZLG1CQUFtQjtBQUVwRCxRQUFJLFdBQVcsUUFBUSxTQUFTLEdBQUc7QUFDbEMsWUFBTSxtQkFBbUIsRUFBRSx1QkFBdUI7QUFDbEQsWUFBTSxpQkFBaUIsRUFBRSxVQUFVO0FBQ25DLGNBQVEsUUFBUSxZQUFVO0FBQ3pCLGNBQU0sYUFBYSxLQUFLLGtCQUFrQixpQkFBaUIsT0FBTyxTQUFTO0FBQzNFLGNBQU0sa0JBQWtCLGFBQWEsV0FBVyxTQUFTLElBQUk7QUFDN0Qsb0JBQVksT0FBTyxnQkFBZ0I7QUFBQSxVQUNsQyxPQUFPLE9BQU87QUFBQSxVQUNkLFdBQVcsT0FBTztBQUFBLFVBQ2xCLEtBQUssT0FBSztBQUNULG1CQUFPLElBQUksQ0FBQztBQUFBLFVBQ2I7QUFBQSxVQUNBLFdBQVcsT0FBTztBQUFBLFFBQ25CLEdBQUcsZUFBZTtBQUFBLE1BQ25CLENBQUM7QUFDRCx1QkFBaUIsWUFBWSxjQUFjO0FBQzNDLFdBQUssUUFBUSxZQUFZLGdCQUFnQjtBQUFBLElBQzFDO0FBQUEsRUFDRDtBQUNEO0FBakNhLHlCQUFOO0FBQUEsRUFNSjtBQUFBLEdBTlU7IiwKICAibmFtZXMiOiBbXQp9Cg==
