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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { MarshalledId } from "../../../../base/common/marshallingIds.js";
import { CommentFormActions } from "./commentFormActions.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
let CommentThreadAdditionalActions = class extends Disposable {
  constructor(container, _commentThread, _contextKeyService, _commentMenus, _actionRunDelegate, _keybindingService, _contextMenuService) {
    super();
    this._commentThread = _commentThread;
    this._contextKeyService = _contextKeyService;
    this._commentMenus = _commentMenus;
    this._actionRunDelegate = _actionRunDelegate;
    this._keybindingService = _keybindingService;
    this._contextMenuService = _contextMenuService;
    this._container = dom.append(container, dom.$(".comment-additional-actions"));
    dom.append(this._container, dom.$(".section-separator"));
    this._buttonBar = dom.append(this._container, dom.$(".button-bar"));
    this._createAdditionalActions(this._buttonBar);
  }
  _showMenu() {
    this._container?.classList.remove("hidden");
  }
  _hideMenu() {
    this._container?.classList.add("hidden");
  }
  _enableDisableMenu(menu) {
    const groups = menu.getActions({ shouldForwardArgs: true });
    for (const group of groups) {
      const [, actions] = group;
      for (const action of actions) {
        if (action.enabled) {
          this._showMenu();
          return;
        }
        for (const subAction of action.actions ?? []) {
          if (subAction.enabled) {
            this._showMenu();
            return;
          }
        }
      }
    }
    this._hideMenu();
  }
  _createAdditionalActions(container) {
    const menu = this._commentMenus.getCommentThreadAdditionalActions(this._contextKeyService);
    this._register(menu);
    this._register(menu.onDidChange(() => {
      this._commentFormActions.setActions(
        menu,
        /*hasOnlySecondaryActions*/
        true
      );
      this._enableDisableMenu(menu);
    }));
    this._commentFormActions = new CommentFormActions(this._keybindingService, this._contextKeyService, this._contextMenuService, container, async (action) => {
      this._actionRunDelegate?.();
      action.run({
        thread: this._commentThread,
        $mid: MarshalledId.CommentThreadInstance
      });
    }, 4, true);
    this._register(this._commentFormActions);
    this._commentFormActions.setActions(
      menu,
      /*hasOnlySecondaryActions*/
      true
    );
    this._enableDisableMenu(menu);
  }
};
CommentThreadAdditionalActions = __decorateClass([
  __decorateParam(5, IKeybindingService),
  __decorateParam(6, IContextMenuService)
], CommentThreadAdditionalActions);
export {
  CommentThreadAdditionalActions
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb21tZW50cy9icm93c2VyL2NvbW1lbnRUaHJlYWRBZGRpdGlvbmFsQWN0aW9ucy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcblxuaW1wb3J0IHsgSUFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSU1lbnUsIFN1Ym1lbnVJdGVtQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IE1hcnNoYWxsZWRJZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcnNoYWxsaW5nSWRzLmpzJztcbmltcG9ydCB7IElSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgKiBhcyBsYW5ndWFnZXMgZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBDb21tZW50Rm9ybUFjdGlvbnMgfSBmcm9tICcuL2NvbW1lbnRGb3JtQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDb21tZW50TWVudXMgfSBmcm9tICcuL2NvbW1lbnRNZW51cy5qcyc7XG5pbXBvcnQgeyBJQ2VsbFJhbmdlIH0gZnJvbSAnLi4vLi4vbm90ZWJvb2svY29tbW9uL25vdGVib29rUmFuZ2UuanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBDb21tZW50VGhyZWFkQWRkaXRpb25hbEFjdGlvbnM8VCBleHRlbmRzIElSYW5nZSB8IElDZWxsUmFuZ2U+IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgX2NvbnRhaW5lcjogSFRNTEVsZW1lbnQgfCBudWxsO1xuXHRwcml2YXRlIF9idXR0b25CYXI6IEhUTUxFbGVtZW50IHwgbnVsbDtcblx0cHJpdmF0ZSBfY29tbWVudEZvcm1BY3Rpb25zITogQ29tbWVudEZvcm1BY3Rpb25zO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0cHJpdmF0ZSBfY29tbWVudFRocmVhZDogbGFuZ3VhZ2VzLkNvbW1lbnRUaHJlYWQ8VD4sXG5cdFx0cHJpdmF0ZSBfY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRwcml2YXRlIF9jb21tZW50TWVudXM6IENvbW1lbnRNZW51cyxcblx0XHRwcml2YXRlIF9hY3Rpb25SdW5EZWxlZ2F0ZTogKCgpID0+IHZvaWQpIHwgbnVsbCxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIHByaXZhdGUgX2tleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgcHJpdmF0ZSBfY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fY29udGFpbmVyID0gZG9tLmFwcGVuZChjb250YWluZXIsIGRvbS4kKCcuY29tbWVudC1hZGRpdGlvbmFsLWFjdGlvbnMnKSk7XG5cdFx0ZG9tLmFwcGVuZCh0aGlzLl9jb250YWluZXIsIGRvbS4kKCcuc2VjdGlvbi1zZXBhcmF0b3InKSk7XG5cblx0XHR0aGlzLl9idXR0b25CYXIgPSBkb20uYXBwZW5kKHRoaXMuX2NvbnRhaW5lciwgZG9tLiQoJy5idXR0b24tYmFyJykpO1xuXHRcdHRoaXMuX2NyZWF0ZUFkZGl0aW9uYWxBY3Rpb25zKHRoaXMuX2J1dHRvbkJhcik7XG5cdH1cblxuXHRwcml2YXRlIF9zaG93TWVudSgpIHtcblx0XHR0aGlzLl9jb250YWluZXI/LmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGRlbicpO1xuXHR9XG5cblx0cHJpdmF0ZSBfaGlkZU1lbnUoKSB7XG5cdFx0dGhpcy5fY29udGFpbmVyPy5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKTtcblx0fVxuXG5cdHByaXZhdGUgX2VuYWJsZURpc2FibGVNZW51KG1lbnU6IElNZW51KSB7XG5cdFx0Y29uc3QgZ3JvdXBzID0gbWVudS5nZXRBY3Rpb25zKHsgc2hvdWxkRm9yd2FyZEFyZ3M6IHRydWUgfSk7XG5cblx0XHQvLyBTaG93IHRoZSBtZW51IGlmIGF0IGxlYXN0IG9uZSBhY3Rpb24gaXMgZW5hYmxlZC5cblx0XHRmb3IgKGNvbnN0IGdyb3VwIG9mIGdyb3Vwcykge1xuXHRcdFx0Y29uc3QgWywgYWN0aW9uc10gPSBncm91cDtcblx0XHRcdGZvciAoY29uc3QgYWN0aW9uIG9mIGFjdGlvbnMpIHtcblx0XHRcdFx0aWYgKGFjdGlvbi5lbmFibGVkKSB7XG5cdFx0XHRcdFx0dGhpcy5fc2hvd01lbnUoKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRmb3IgKGNvbnN0IHN1YkFjdGlvbiBvZiAoYWN0aW9uIGFzIFN1Ym1lbnVJdGVtQWN0aW9uKS5hY3Rpb25zID8/IFtdKSB7XG5cdFx0XHRcdFx0aWYgKHN1YkFjdGlvbi5lbmFibGVkKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9zaG93TWVudSgpO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX2hpZGVNZW51KCk7XG5cdH1cblxuXG5cdHByaXZhdGUgX2NyZWF0ZUFkZGl0aW9uYWxBY3Rpb25zKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpIHtcblx0XHRjb25zdCBtZW51ID0gdGhpcy5fY29tbWVudE1lbnVzLmdldENvbW1lbnRUaHJlYWRBZGRpdGlvbmFsQWN0aW9ucyh0aGlzLl9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIobWVudSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIobWVudS5vbkRpZENoYW5nZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9jb21tZW50Rm9ybUFjdGlvbnMuc2V0QWN0aW9ucyhtZW51LCAvKmhhc09ubHlTZWNvbmRhcnlBY3Rpb25zKi8gdHJ1ZSk7XG5cdFx0XHR0aGlzLl9lbmFibGVEaXNhYmxlTWVudShtZW51KTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9jb21tZW50Rm9ybUFjdGlvbnMgPSBuZXcgQ29tbWVudEZvcm1BY3Rpb25zKHRoaXMuX2tleWJpbmRpbmdTZXJ2aWNlLCB0aGlzLl9jb250ZXh0S2V5U2VydmljZSwgdGhpcy5fY29udGV4dE1lbnVTZXJ2aWNlLCBjb250YWluZXIsIGFzeW5jIChhY3Rpb246IElBY3Rpb24pID0+IHtcblx0XHRcdHRoaXMuX2FjdGlvblJ1bkRlbGVnYXRlPy4oKTtcblxuXHRcdFx0YWN0aW9uLnJ1bih7XG5cdFx0XHRcdHRocmVhZDogdGhpcy5fY29tbWVudFRocmVhZCxcblx0XHRcdFx0JG1pZDogTWFyc2hhbGxlZElkLkNvbW1lbnRUaHJlYWRJbnN0YW5jZVxuXHRcdFx0fSk7XG5cdFx0fSwgNCwgdHJ1ZSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9jb21tZW50Rm9ybUFjdGlvbnMpO1xuXHRcdHRoaXMuX2NvbW1lbnRGb3JtQWN0aW9ucy5zZXRBY3Rpb25zKG1lbnUsIC8qaGFzT25seVNlY29uZGFyeUFjdGlvbnMqLyB0cnVlKTtcblx0XHR0aGlzLl9lbmFibGVEaXNhYmxlTWVudShtZW51KTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFJckIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxvQkFBb0I7QUFJN0IsU0FBUywwQkFBMEI7QUFHbkMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUywyQkFBMkI7QUFFN0IsSUFBTSxpQ0FBTixjQUE0RSxXQUFXO0FBQUEsRUFLN0YsWUFDQyxXQUNRLGdCQUNBLG9CQUNBLGVBQ0Esb0JBQ29CLG9CQUNDLHFCQUM1QjtBQUNELFVBQU07QUFQRTtBQUNBO0FBQ0E7QUFDQTtBQUNvQjtBQUNDO0FBSTdCLFNBQUssYUFBYSxJQUFJLE9BQU8sV0FBVyxJQUFJLEVBQUUsNkJBQTZCLENBQUM7QUFDNUUsUUFBSSxPQUFPLEtBQUssWUFBWSxJQUFJLEVBQUUsb0JBQW9CLENBQUM7QUFFdkQsU0FBSyxhQUFhLElBQUksT0FBTyxLQUFLLFlBQVksSUFBSSxFQUFFLGFBQWEsQ0FBQztBQUNsRSxTQUFLLHlCQUF5QixLQUFLLFVBQVU7QUFBQSxFQUM5QztBQUFBLEVBRVEsWUFBWTtBQUNuQixTQUFLLFlBQVksVUFBVSxPQUFPLFFBQVE7QUFBQSxFQUMzQztBQUFBLEVBRVEsWUFBWTtBQUNuQixTQUFLLFlBQVksVUFBVSxJQUFJLFFBQVE7QUFBQSxFQUN4QztBQUFBLEVBRVEsbUJBQW1CLE1BQWE7QUFDdkMsVUFBTSxTQUFTLEtBQUssV0FBVyxFQUFFLG1CQUFtQixLQUFLLENBQUM7QUFHMUQsZUFBVyxTQUFTLFFBQVE7QUFDM0IsWUFBTSxDQUFDLEVBQUUsT0FBTyxJQUFJO0FBQ3BCLGlCQUFXLFVBQVUsU0FBUztBQUM3QixZQUFJLE9BQU8sU0FBUztBQUNuQixlQUFLLFVBQVU7QUFDZjtBQUFBLFFBQ0Q7QUFFQSxtQkFBVyxhQUFjLE9BQTZCLFdBQVcsQ0FBQyxHQUFHO0FBQ3BFLGNBQUksVUFBVSxTQUFTO0FBQ3RCLGlCQUFLLFVBQVU7QUFDZjtBQUFBLFVBQ0Q7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFFQSxTQUFLLFVBQVU7QUFBQSxFQUNoQjtBQUFBLEVBR1EseUJBQXlCLFdBQXdCO0FBQ3hELFVBQU0sT0FBTyxLQUFLLGNBQWMsa0NBQWtDLEtBQUssa0JBQWtCO0FBQ3pGLFNBQUssVUFBVSxJQUFJO0FBQ25CLFNBQUssVUFBVSxLQUFLLFlBQVksTUFBTTtBQUNyQyxXQUFLLG9CQUFvQjtBQUFBLFFBQVc7QUFBQTtBQUFBLFFBQWtDO0FBQUEsTUFBSTtBQUMxRSxXQUFLLG1CQUFtQixJQUFJO0FBQUEsSUFDN0IsQ0FBQyxDQUFDO0FBRUYsU0FBSyxzQkFBc0IsSUFBSSxtQkFBbUIsS0FBSyxvQkFBb0IsS0FBSyxvQkFBb0IsS0FBSyxxQkFBcUIsV0FBVyxPQUFPLFdBQW9CO0FBQ25LLFdBQUsscUJBQXFCO0FBRTFCLGFBQU8sSUFBSTtBQUFBLFFBQ1YsUUFBUSxLQUFLO0FBQUEsUUFDYixNQUFNLGFBQWE7QUFBQSxNQUNwQixDQUFDO0FBQUEsSUFDRixHQUFHLEdBQUcsSUFBSTtBQUVWLFNBQUssVUFBVSxLQUFLLG1CQUFtQjtBQUN2QyxTQUFLLG9CQUFvQjtBQUFBLE1BQVc7QUFBQTtBQUFBLE1BQWtDO0FBQUEsSUFBSTtBQUMxRSxTQUFLLG1CQUFtQixJQUFJO0FBQUEsRUFDN0I7QUFDRDtBQTdFYSxpQ0FBTjtBQUFBLEVBV0o7QUFBQSxFQUNBO0FBQUEsR0FaVTsiLAogICJuYW1lcyI6IFtdCn0K
