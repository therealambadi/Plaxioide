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
import { ContextView, ContextViewDOMPosition } from "../../../base/browser/ui/contextview/contextview.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { ILayoutService } from "../../layout/browser/layoutService.js";
import { getWindow } from "../../../base/browser/dom.js";
let ContextViewHandler = class extends Disposable {
  constructor(layoutService) {
    super();
    this.layoutService = layoutService;
    this.contextView = this._register(new ContextView(this.layoutService.mainContainer, ContextViewDOMPosition.ABSOLUTE));
    this.layout();
    this._register(layoutService.onDidLayoutContainer(() => this.layout()));
  }
  // ContextView
  showContextView(delegate, container, shadowRoot) {
    let domPosition;
    if (container) {
      if (container === this.layoutService.getContainer(getWindow(container))) {
        domPosition = ContextViewDOMPosition.ABSOLUTE;
      } else if (shadowRoot) {
        domPosition = ContextViewDOMPosition.FIXED_SHADOW;
      } else {
        domPosition = ContextViewDOMPosition.FIXED;
      }
    } else {
      domPosition = ContextViewDOMPosition.ABSOLUTE;
    }
    this.contextView.setContainer(container ?? this.layoutService.activeContainer, domPosition);
    this.contextView.show(delegate);
    const openContextView = {
      close: () => {
        if (this.openContextView === openContextView) {
          this.hideContextView();
        }
      }
    };
    this.openContextView = openContextView;
    return openContextView;
  }
  layout() {
    this.contextView.layout();
  }
  hideContextView(data) {
    this.contextView.hide(data);
    this.openContextView = void 0;
  }
};
ContextViewHandler = __decorateClass([
  __decorateParam(0, ILayoutService)
], ContextViewHandler);
class ContextViewService extends ContextViewHandler {
  getContextViewElement() {
    return this.contextView.getViewElement();
  }
}
export {
  ContextViewHandler,
  ContextViewService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3U2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IENvbnRleHRWaWV3LCBDb250ZXh0Vmlld0RPTVBvc2l0aW9uLCBJQ29udGV4dFZpZXdQcm92aWRlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9jb250ZXh0dmlldy9jb250ZXh0dmlldy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElMYXlvdXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vbGF5b3V0L2Jyb3dzZXIvbGF5b3V0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dFZpZXdEZWxlZ2F0ZSwgSUNvbnRleHRWaWV3U2VydmljZSwgSU9wZW5Db250ZXh0VmlldyB9IGZyb20gJy4vY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgZ2V0V2luZG93IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5cbmV4cG9ydCBjbGFzcyBDb250ZXh0Vmlld0hhbmRsZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUNvbnRleHRWaWV3UHJvdmlkZXIge1xuXG5cdHByaXZhdGUgb3BlbkNvbnRleHRWaWV3OiBJT3BlbkNvbnRleHRWaWV3IHwgdW5kZWZpbmVkO1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgY29udGV4dFZpZXc6IENvbnRleHRWaWV3O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTGF5b3V0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxheW91dFNlcnZpY2U6IElMYXlvdXRTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLmNvbnRleHRWaWV3ID0gdGhpcy5fcmVnaXN0ZXIobmV3IENvbnRleHRWaWV3KHRoaXMubGF5b3V0U2VydmljZS5tYWluQ29udGFpbmVyLCBDb250ZXh0Vmlld0RPTVBvc2l0aW9uLkFCU09MVVRFKSk7XG5cblx0XHR0aGlzLmxheW91dCgpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGxheW91dFNlcnZpY2Uub25EaWRMYXlvdXRDb250YWluZXIoKCkgPT4gdGhpcy5sYXlvdXQoKSkpO1xuXHR9XG5cblx0Ly8gQ29udGV4dFZpZXdcblxuXHRzaG93Q29udGV4dFZpZXcoZGVsZWdhdGU6IElDb250ZXh0Vmlld0RlbGVnYXRlLCBjb250YWluZXI/OiBIVE1MRWxlbWVudCwgc2hhZG93Um9vdD86IGJvb2xlYW4pOiBJT3BlbkNvbnRleHRWaWV3IHtcblx0XHRsZXQgZG9tUG9zaXRpb246IENvbnRleHRWaWV3RE9NUG9zaXRpb247XG5cdFx0aWYgKGNvbnRhaW5lcikge1xuXHRcdFx0aWYgKGNvbnRhaW5lciA9PT0gdGhpcy5sYXlvdXRTZXJ2aWNlLmdldENvbnRhaW5lcihnZXRXaW5kb3coY29udGFpbmVyKSkpIHtcblx0XHRcdFx0ZG9tUG9zaXRpb24gPSBDb250ZXh0Vmlld0RPTVBvc2l0aW9uLkFCU09MVVRFO1xuXHRcdFx0fSBlbHNlIGlmIChzaGFkb3dSb290KSB7XG5cdFx0XHRcdGRvbVBvc2l0aW9uID0gQ29udGV4dFZpZXdET01Qb3NpdGlvbi5GSVhFRF9TSEFET1c7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRkb21Qb3NpdGlvbiA9IENvbnRleHRWaWV3RE9NUG9zaXRpb24uRklYRUQ7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGRvbVBvc2l0aW9uID0gQ29udGV4dFZpZXdET01Qb3NpdGlvbi5BQlNPTFVURTtcblx0XHR9XG5cblx0XHR0aGlzLmNvbnRleHRWaWV3LnNldENvbnRhaW5lcihjb250YWluZXIgPz8gdGhpcy5sYXlvdXRTZXJ2aWNlLmFjdGl2ZUNvbnRhaW5lciwgZG9tUG9zaXRpb24pO1xuXG5cdFx0dGhpcy5jb250ZXh0Vmlldy5zaG93KGRlbGVnYXRlKTtcblxuXHRcdGNvbnN0IG9wZW5Db250ZXh0VmlldzogSU9wZW5Db250ZXh0VmlldyA9IHtcblx0XHRcdGNsb3NlOiAoKSA9PiB7XG5cdFx0XHRcdGlmICh0aGlzLm9wZW5Db250ZXh0VmlldyA9PT0gb3BlbkNvbnRleHRWaWV3KSB7XG5cdFx0XHRcdFx0dGhpcy5oaWRlQ29udGV4dFZpZXcoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHR0aGlzLm9wZW5Db250ZXh0VmlldyA9IG9wZW5Db250ZXh0Vmlldztcblx0XHRyZXR1cm4gb3BlbkNvbnRleHRWaWV3O1xuXHR9XG5cblx0bGF5b3V0KCk6IHZvaWQge1xuXHRcdHRoaXMuY29udGV4dFZpZXcubGF5b3V0KCk7XG5cdH1cblxuXHRoaWRlQ29udGV4dFZpZXcoZGF0YT86IGFueSk6IHZvaWQge1xuXHRcdHRoaXMuY29udGV4dFZpZXcuaGlkZShkYXRhKTtcblx0XHR0aGlzLm9wZW5Db250ZXh0VmlldyA9IHVuZGVmaW5lZDtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ29udGV4dFZpZXdTZXJ2aWNlIGV4dGVuZHMgQ29udGV4dFZpZXdIYW5kbGVyIGltcGxlbWVudHMgSUNvbnRleHRWaWV3U2VydmljZSB7XG5cblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0Z2V0Q29udGV4dFZpZXdFbGVtZW50KCk6IEhUTUxFbGVtZW50IHtcblx0XHRyZXR1cm4gdGhpcy5jb250ZXh0Vmlldy5nZXRWaWV3RWxlbWVudCgpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsYUFBYSw4QkFBb0Q7QUFDMUUsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxzQkFBc0I7QUFFL0IsU0FBUyxpQkFBaUI7QUFFbkIsSUFBTSxxQkFBTixjQUFpQyxXQUEyQztBQUFBLEVBS2xGLFlBQ2tDLGVBQ2hDO0FBQ0QsVUFBTTtBQUYyQjtBQUlqQyxTQUFLLGNBQWMsS0FBSyxVQUFVLElBQUksWUFBWSxLQUFLLGNBQWMsZUFBZSx1QkFBdUIsUUFBUSxDQUFDO0FBRXBILFNBQUssT0FBTztBQUNaLFNBQUssVUFBVSxjQUFjLHFCQUFxQixNQUFNLEtBQUssT0FBTyxDQUFDLENBQUM7QUFBQSxFQUN2RTtBQUFBO0FBQUEsRUFJQSxnQkFBZ0IsVUFBZ0MsV0FBeUIsWUFBd0M7QUFDaEgsUUFBSTtBQUNKLFFBQUksV0FBVztBQUNkLFVBQUksY0FBYyxLQUFLLGNBQWMsYUFBYSxVQUFVLFNBQVMsQ0FBQyxHQUFHO0FBQ3hFLHNCQUFjLHVCQUF1QjtBQUFBLE1BQ3RDLFdBQVcsWUFBWTtBQUN0QixzQkFBYyx1QkFBdUI7QUFBQSxNQUN0QyxPQUFPO0FBQ04sc0JBQWMsdUJBQXVCO0FBQUEsTUFDdEM7QUFBQSxJQUNELE9BQU87QUFDTixvQkFBYyx1QkFBdUI7QUFBQSxJQUN0QztBQUVBLFNBQUssWUFBWSxhQUFhLGFBQWEsS0FBSyxjQUFjLGlCQUFpQixXQUFXO0FBRTFGLFNBQUssWUFBWSxLQUFLLFFBQVE7QUFFOUIsVUFBTSxrQkFBb0M7QUFBQSxNQUN6QyxPQUFPLE1BQU07QUFDWixZQUFJLEtBQUssb0JBQW9CLGlCQUFpQjtBQUM3QyxlQUFLLGdCQUFnQjtBQUFBLFFBQ3RCO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFFQSxTQUFLLGtCQUFrQjtBQUN2QixXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsU0FBZTtBQUNkLFNBQUssWUFBWSxPQUFPO0FBQUEsRUFDekI7QUFBQSxFQUVBLGdCQUFnQixNQUFrQjtBQUNqQyxTQUFLLFlBQVksS0FBSyxJQUFJO0FBQzFCLFNBQUssa0JBQWtCO0FBQUEsRUFDeEI7QUFDRDtBQXhEYSxxQkFBTjtBQUFBLEVBTUo7QUFBQSxHQU5VO0FBMEROLE1BQU0sMkJBQTJCLG1CQUFrRDtBQUFBLEVBSXpGLHdCQUFxQztBQUNwQyxXQUFPLEtBQUssWUFBWSxlQUFlO0FBQUEsRUFDeEM7QUFDRDsiLAogICJuYW1lcyI6IFtdCn0K
