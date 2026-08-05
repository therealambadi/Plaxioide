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
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { TextOnlyMenuEntryActionViewItem } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IMenuService, MenuItemAction } from "../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
let SuggestWidgetStatus = class {
  constructor(container, _menuId, instantiationService, _menuService, _contextKeyService) {
    this._menuId = _menuId;
    this._menuService = _menuService;
    this._contextKeyService = _contextKeyService;
    this._menuDisposables = new DisposableStore();
    this.element = dom.append(container, dom.$(".suggest-status-bar"));
    const actionViewItemProvider = (action) => {
      return action instanceof MenuItemAction ? instantiationService.createInstance(TextOnlyMenuEntryActionViewItem, action, { useComma: true }) : void 0;
    };
    this._leftActions = new ActionBar(this.element, { actionViewItemProvider });
    this._rightActions = new ActionBar(this.element, { actionViewItemProvider });
    this._leftActions.domNode.classList.add("left");
    this._rightActions.domNode.classList.add("right");
  }
  dispose() {
    this._menuDisposables.dispose();
    this._leftActions.dispose();
    this._rightActions.dispose();
    this.element.remove();
  }
  show() {
    const menu = this._menuService.createMenu(this._menuId, this._contextKeyService);
    const renderMenu = () => {
      const left = [];
      const right = [];
      for (const [group, actions] of menu.getActions()) {
        if (group === "left") {
          left.push(...actions);
        } else {
          right.push(...actions);
        }
      }
      this._leftActions.clear();
      this._leftActions.push(left);
      this._rightActions.clear();
      this._rightActions.push(right);
    };
    this._menuDisposables.add(menu.onDidChange(() => renderMenu()));
    this._menuDisposables.add(menu);
  }
  hide() {
    this._menuDisposables.clear();
  }
};
SuggestWidgetStatus = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IMenuService),
  __decorateParam(4, IContextKeyService)
], SuggestWidgetStatus);
export {
  SuggestWidgetStatus
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9zdWdnZXN0L2Jyb3dzZXIvc3VnZ2VzdFdpZGdldFN0YXR1cy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IEFjdGlvbkJhciwgSUFjdGlvblZpZXdJdGVtUHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvbmJhci5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVGV4dE9ubHlNZW51RW50cnlBY3Rpb25WaWV3SXRlbSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci9tZW51RW50cnlBY3Rpb25WaWV3SXRlbS5qcyc7XG5pbXBvcnQgeyBJTWVudVNlcnZpY2UsIE1lbnVJZCwgTWVudUl0ZW1BY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5cbmV4cG9ydCBjbGFzcyBTdWdnZXN0V2lkZ2V0U3RhdHVzIHtcblxuXHRyZWFkb25seSBlbGVtZW50OiBIVE1MRWxlbWVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9sZWZ0QWN0aW9uczogQWN0aW9uQmFyO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9yaWdodEFjdGlvbnM6IEFjdGlvbkJhcjtcblx0cHJpdmF0ZSByZWFkb25seSBfbWVudURpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbWVudUlkOiBNZW51SWQsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJTWVudVNlcnZpY2UgcHJpdmF0ZSBfbWVudVNlcnZpY2U6IElNZW51U2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgX2NvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdCkge1xuXHRcdHRoaXMuZWxlbWVudCA9IGRvbS5hcHBlbmQoY29udGFpbmVyLCBkb20uJCgnLnN1Z2dlc3Qtc3RhdHVzLWJhcicpKTtcblxuXHRcdGNvbnN0IGFjdGlvblZpZXdJdGVtUHJvdmlkZXIgPSA8SUFjdGlvblZpZXdJdGVtUHJvdmlkZXI+KGFjdGlvbiA9PiB7XG5cdFx0XHRyZXR1cm4gYWN0aW9uIGluc3RhbmNlb2YgTWVudUl0ZW1BY3Rpb24gPyBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXh0T25seU1lbnVFbnRyeUFjdGlvblZpZXdJdGVtLCBhY3Rpb24sIHsgdXNlQ29tbWE6IHRydWUgfSkgOiB1bmRlZmluZWQ7XG5cdFx0fSk7XG5cdFx0dGhpcy5fbGVmdEFjdGlvbnMgPSBuZXcgQWN0aW9uQmFyKHRoaXMuZWxlbWVudCwgeyBhY3Rpb25WaWV3SXRlbVByb3ZpZGVyIH0pO1xuXHRcdHRoaXMuX3JpZ2h0QWN0aW9ucyA9IG5ldyBBY3Rpb25CYXIodGhpcy5lbGVtZW50LCB7IGFjdGlvblZpZXdJdGVtUHJvdmlkZXIgfSk7XG5cblx0XHR0aGlzLl9sZWZ0QWN0aW9ucy5kb21Ob2RlLmNsYXNzTGlzdC5hZGQoJ2xlZnQnKTtcblx0XHR0aGlzLl9yaWdodEFjdGlvbnMuZG9tTm9kZS5jbGFzc0xpc3QuYWRkKCdyaWdodCcpO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9tZW51RGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX2xlZnRBY3Rpb25zLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9yaWdodEFjdGlvbnMuZGlzcG9zZSgpO1xuXHRcdHRoaXMuZWxlbWVudC5yZW1vdmUoKTtcblx0fVxuXG5cdHNob3coKTogdm9pZCB7XG5cdFx0Y29uc3QgbWVudSA9IHRoaXMuX21lbnVTZXJ2aWNlLmNyZWF0ZU1lbnUodGhpcy5fbWVudUlkLCB0aGlzLl9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0Y29uc3QgcmVuZGVyTWVudSA9ICgpID0+IHtcblx0XHRcdGNvbnN0IGxlZnQ6IElBY3Rpb25bXSA9IFtdO1xuXHRcdFx0Y29uc3QgcmlnaHQ6IElBY3Rpb25bXSA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCBbZ3JvdXAsIGFjdGlvbnNdIG9mIG1lbnUuZ2V0QWN0aW9ucygpKSB7XG5cdFx0XHRcdGlmIChncm91cCA9PT0gJ2xlZnQnKSB7XG5cdFx0XHRcdFx0bGVmdC5wdXNoKC4uLmFjdGlvbnMpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJpZ2h0LnB1c2goLi4uYWN0aW9ucyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHRoaXMuX2xlZnRBY3Rpb25zLmNsZWFyKCk7XG5cdFx0XHR0aGlzLl9sZWZ0QWN0aW9ucy5wdXNoKGxlZnQpO1xuXHRcdFx0dGhpcy5fcmlnaHRBY3Rpb25zLmNsZWFyKCk7XG5cdFx0XHR0aGlzLl9yaWdodEFjdGlvbnMucHVzaChyaWdodCk7XG5cdFx0fTtcblx0XHR0aGlzLl9tZW51RGlzcG9zYWJsZXMuYWRkKG1lbnUub25EaWRDaGFuZ2UoKCkgPT4gcmVuZGVyTWVudSgpKSk7XG5cdFx0dGhpcy5fbWVudURpc3Bvc2FibGVzLmFkZChtZW51KTtcblx0fVxuXG5cdGhpZGUoKTogdm9pZCB7XG5cdFx0dGhpcy5fbWVudURpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsaUJBQTBDO0FBRW5ELFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsdUNBQXVDO0FBQ2hELFNBQVMsY0FBc0Isc0JBQXNCO0FBQ3JELFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsNkJBQTZCO0FBRS9CLElBQU0sc0JBQU4sTUFBMEI7QUFBQSxFQVFoQyxZQUNDLFdBQ2lCLFNBQ00sc0JBQ0QsY0FDTSxvQkFDM0I7QUFKZ0I7QUFFSztBQUNNO0FBUDdCLFNBQWlCLG1CQUFtQixJQUFJLGdCQUFnQjtBQVN2RCxTQUFLLFVBQVUsSUFBSSxPQUFPLFdBQVcsSUFBSSxFQUFFLHFCQUFxQixDQUFDO0FBRWpFLFVBQU0seUJBQW1ELFlBQVU7QUFDbEUsYUFBTyxrQkFBa0IsaUJBQWlCLHFCQUFxQixlQUFlLGlDQUFpQyxRQUFRLEVBQUUsVUFBVSxLQUFLLENBQUMsSUFBSTtBQUFBLElBQzlJO0FBQ0EsU0FBSyxlQUFlLElBQUksVUFBVSxLQUFLLFNBQVMsRUFBRSx1QkFBdUIsQ0FBQztBQUMxRSxTQUFLLGdCQUFnQixJQUFJLFVBQVUsS0FBSyxTQUFTLEVBQUUsdUJBQXVCLENBQUM7QUFFM0UsU0FBSyxhQUFhLFFBQVEsVUFBVSxJQUFJLE1BQU07QUFDOUMsU0FBSyxjQUFjLFFBQVEsVUFBVSxJQUFJLE9BQU87QUFBQSxFQUNqRDtBQUFBLEVBRUEsVUFBZ0I7QUFDZixTQUFLLGlCQUFpQixRQUFRO0FBQzlCLFNBQUssYUFBYSxRQUFRO0FBQzFCLFNBQUssY0FBYyxRQUFRO0FBQzNCLFNBQUssUUFBUSxPQUFPO0FBQUEsRUFDckI7QUFBQSxFQUVBLE9BQWE7QUFDWixVQUFNLE9BQU8sS0FBSyxhQUFhLFdBQVcsS0FBSyxTQUFTLEtBQUssa0JBQWtCO0FBQy9FLFVBQU0sYUFBYSxNQUFNO0FBQ3hCLFlBQU0sT0FBa0IsQ0FBQztBQUN6QixZQUFNLFFBQW1CLENBQUM7QUFDMUIsaUJBQVcsQ0FBQyxPQUFPLE9BQU8sS0FBSyxLQUFLLFdBQVcsR0FBRztBQUNqRCxZQUFJLFVBQVUsUUFBUTtBQUNyQixlQUFLLEtBQUssR0FBRyxPQUFPO0FBQUEsUUFDckIsT0FBTztBQUNOLGdCQUFNLEtBQUssR0FBRyxPQUFPO0FBQUEsUUFDdEI7QUFBQSxNQUNEO0FBQ0EsV0FBSyxhQUFhLE1BQU07QUFDeEIsV0FBSyxhQUFhLEtBQUssSUFBSTtBQUMzQixXQUFLLGNBQWMsTUFBTTtBQUN6QixXQUFLLGNBQWMsS0FBSyxLQUFLO0FBQUEsSUFDOUI7QUFDQSxTQUFLLGlCQUFpQixJQUFJLEtBQUssWUFBWSxNQUFNLFdBQVcsQ0FBQyxDQUFDO0FBQzlELFNBQUssaUJBQWlCLElBQUksSUFBSTtBQUFBLEVBQy9CO0FBQUEsRUFFQSxPQUFhO0FBQ1osU0FBSyxpQkFBaUIsTUFBTTtBQUFBLEVBQzdCO0FBQ0Q7QUExRGEsc0JBQU47QUFBQSxFQVdKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQWJVOyIsCiAgIm5hbWVzIjogW10KfQo=
