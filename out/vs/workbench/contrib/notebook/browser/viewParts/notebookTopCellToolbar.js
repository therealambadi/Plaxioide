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
import * as DOM from "../../../../../base/browser/dom.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { HiddenItemStrategy, MenuWorkbenchToolBar } from "../../../../../platform/actions/browser/toolbar.js";
import { IMenuService, MenuItemAction } from "../../../../../platform/actions/common/actions.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { CodiconActionViewItem } from "../view/cellParts/cellActionView.js";
let ListTopCellToolbar = class extends Disposable {
  constructor(notebookEditor, notebookOptions, instantiationService, contextMenuService, menuService) {
    super();
    this.notebookEditor = notebookEditor;
    this.notebookOptions = notebookOptions;
    this.instantiationService = instantiationService;
    this.contextMenuService = contextMenuService;
    this.menuService = menuService;
    this.viewZone = this._register(new MutableDisposable());
    this._modelDisposables = this._register(new DisposableStore());
    this.topCellToolbarContainer = DOM.$("div");
    this.topCellToolbar = DOM.$(".cell-list-top-cell-toolbar-container");
    this.topCellToolbarContainer.appendChild(this.topCellToolbar);
    this._register(this.notebookEditor.onDidAttachViewModel(() => {
      this.updateTopToolbar();
    }));
    this._register(this.notebookOptions.onDidChangeOptions((e) => {
      if (e.insertToolbarAlignment || e.insertToolbarPosition || e.cellToolbarLocation) {
        this.updateTopToolbar();
      }
    }));
  }
  updateTopToolbar() {
    const layoutInfo = this.notebookOptions.getLayoutConfiguration();
    this.viewZone.value = new DisposableStore();
    if (layoutInfo.insertToolbarPosition === "hidden" || layoutInfo.insertToolbarPosition === "notebookToolbar") {
      const height = this.notebookOptions.computeTopInsertToolbarHeight(this.notebookEditor.textModel?.viewType);
      if (height !== 0) {
        this.notebookEditor.changeViewZones((accessor) => {
          const id = accessor.addZone({
            afterModelPosition: 0,
            heightInPx: height,
            domNode: DOM.$("div")
          });
          accessor.layoutZone(id);
          this.viewZone.value?.add({
            dispose: () => {
              if (!this.notebookEditor.isDisposed) {
                this.notebookEditor.changeViewZones((accessor2) => {
                  accessor2.removeZone(id);
                });
              }
            }
          });
        });
      }
      return;
    }
    this.notebookEditor.changeViewZones((accessor) => {
      const height = this.notebookOptions.computeTopInsertToolbarHeight(this.notebookEditor.textModel?.viewType);
      const id = accessor.addZone({
        afterModelPosition: 0,
        heightInPx: height,
        domNode: this.topCellToolbarContainer
      });
      accessor.layoutZone(id);
      this.viewZone.value?.add({
        dispose: () => {
          if (!this.notebookEditor.isDisposed) {
            this.notebookEditor.changeViewZones((accessor2) => {
              accessor2.removeZone(id);
            });
          }
        }
      });
      DOM.clearNode(this.topCellToolbar);
      const toolbar = this.instantiationService.createInstance(MenuWorkbenchToolBar, this.topCellToolbar, this.notebookEditor.creationOptions.menuIds.cellTopInsertToolbar, {
        actionViewItemProvider: (action, options) => {
          if (action instanceof MenuItemAction) {
            const item = this.instantiationService.createInstance(CodiconActionViewItem, action, { hoverDelegate: options.hoverDelegate });
            return item;
          }
          return void 0;
        },
        menuOptions: {
          shouldForwardArgs: true
        },
        toolbarOptions: {
          primaryGroup: (g) => /^inline/.test(g)
        },
        hiddenItemStrategy: HiddenItemStrategy.Ignore
      });
      if (this.notebookEditor.hasModel()) {
        toolbar.context = {
          notebookEditor: this.notebookEditor
        };
      }
      this.viewZone.value?.add(toolbar);
      this.viewZone.value?.add(this.notebookEditor.onDidChangeModel(() => {
        this._modelDisposables.clear();
        if (this.notebookEditor.hasModel()) {
          this._modelDisposables.add(this.notebookEditor.onDidChangeViewCells(() => {
            this.updateClass();
          }));
          this.updateClass();
        }
      }));
      this.updateClass();
    });
  }
  updateClass() {
    if (this.notebookEditor.hasModel() && this.notebookEditor.getLength() === 0) {
      this.topCellToolbar.classList.add("emptyNotebook");
    } else {
      this.topCellToolbar.classList.remove("emptyNotebook");
    }
  }
};
ListTopCellToolbar = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, IMenuService)
], ListTopCellToolbar);
export {
  ListTopCellToolbar
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL3ZpZXdQYXJ0cy9ub3RlYm9va1RvcENlbGxUb29sYmFyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgRE9NIGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBNdXRhYmxlRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBIaWRkZW5JdGVtU3RyYXRlZ3ksIE1lbnVXb3JrYmVuY2hUb29sQmFyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL3Rvb2xiYXIuanMnO1xuaW1wb3J0IHsgSU1lbnVTZXJ2aWNlLCBNZW51SXRlbUFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tBY3Rpb25Db250ZXh0IH0gZnJvbSAnLi4vY29udHJvbGxlci9jb3JlQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tFZGl0b3JEZWxlZ2F0ZSB9IGZyb20gJy4uL25vdGVib29rQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va09wdGlvbnMgfSBmcm9tICcuLi9ub3RlYm9va09wdGlvbnMuanMnO1xuaW1wb3J0IHsgQ29kaWNvbkFjdGlvblZpZXdJdGVtIH0gZnJvbSAnLi4vdmlldy9jZWxsUGFydHMvY2VsbEFjdGlvblZpZXcuanMnO1xuXG5leHBvcnQgY2xhc3MgTGlzdFRvcENlbGxUb29sYmFyIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgcmVhZG9ubHkgdG9wQ2VsbFRvb2xiYXJDb250YWluZXI6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHRvcENlbGxUb29sYmFyOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSByZWFkb25seSB2aWV3Wm9uZTogTXV0YWJsZURpc3Bvc2FibGU8RGlzcG9zYWJsZVN0b3JlPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblx0cHJpdmF0ZSByZWFkb25seSBfbW9kZWxEaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByb3RlY3RlZCByZWFkb25seSBub3RlYm9va0VkaXRvcjogSU5vdGVib29rRWRpdG9yRGVsZWdhdGUsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBub3RlYm9va09wdGlvbnM6IE5vdGVib29rT3B0aW9ucyxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElNZW51U2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgbWVudVNlcnZpY2U6IElNZW51U2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy50b3BDZWxsVG9vbGJhckNvbnRhaW5lciA9IERPTS4kKCdkaXYnKTtcblx0XHR0aGlzLnRvcENlbGxUb29sYmFyID0gRE9NLiQoJy5jZWxsLWxpc3QtdG9wLWNlbGwtdG9vbGJhci1jb250YWluZXInKTtcblx0XHR0aGlzLnRvcENlbGxUb29sYmFyQ29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMudG9wQ2VsbFRvb2xiYXIpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5ub3RlYm9va0VkaXRvci5vbkRpZEF0dGFjaFZpZXdNb2RlbCgoKSA9PiB7XG5cdFx0XHR0aGlzLnVwZGF0ZVRvcFRvb2xiYXIoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm5vdGVib29rT3B0aW9ucy5vbkRpZENoYW5nZU9wdGlvbnMoZSA9PiB7XG5cdFx0XHRpZiAoZS5pbnNlcnRUb29sYmFyQWxpZ25tZW50IHx8IGUuaW5zZXJ0VG9vbGJhclBvc2l0aW9uIHx8IGUuY2VsbFRvb2xiYXJMb2NhdGlvbikge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZVRvcFRvb2xiYXIoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVRvcFRvb2xiYXIoKSB7XG5cdFx0Y29uc3QgbGF5b3V0SW5mbyA9IHRoaXMubm90ZWJvb2tPcHRpb25zLmdldExheW91dENvbmZpZ3VyYXRpb24oKTtcblx0XHR0aGlzLnZpZXdab25lLnZhbHVlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0aWYgKGxheW91dEluZm8uaW5zZXJ0VG9vbGJhclBvc2l0aW9uID09PSAnaGlkZGVuJyB8fCBsYXlvdXRJbmZvLmluc2VydFRvb2xiYXJQb3NpdGlvbiA9PT0gJ25vdGVib29rVG9vbGJhcicpIHtcblx0XHRcdGNvbnN0IGhlaWdodCA9IHRoaXMubm90ZWJvb2tPcHRpb25zLmNvbXB1dGVUb3BJbnNlcnRUb29sYmFySGVpZ2h0KHRoaXMubm90ZWJvb2tFZGl0b3IudGV4dE1vZGVsPy52aWV3VHlwZSk7XG5cblx0XHRcdGlmIChoZWlnaHQgIT09IDApIHtcblx0XHRcdFx0Ly8gcmVzZXJ2ZSB3aGl0ZXNwYWNlIHRvIGF2b2lkIG92ZXJsYXAgd2l0aCBjZWxsIHRvb2xiYXJcblx0XHRcdFx0dGhpcy5ub3RlYm9va0VkaXRvci5jaGFuZ2VWaWV3Wm9uZXMoYWNjZXNzb3IgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGlkID0gYWNjZXNzb3IuYWRkWm9uZSh7XG5cdFx0XHRcdFx0XHRhZnRlck1vZGVsUG9zaXRpb246IDAsXG5cdFx0XHRcdFx0XHRoZWlnaHRJblB4OiBoZWlnaHQsXG5cdFx0XHRcdFx0XHRkb21Ob2RlOiBET00uJCgnZGl2Jylcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRhY2Nlc3Nvci5sYXlvdXRab25lKGlkKTtcblx0XHRcdFx0XHR0aGlzLnZpZXdab25lLnZhbHVlPy5hZGQoe1xuXHRcdFx0XHRcdFx0ZGlzcG9zZTogKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRpZiAoIXRoaXMubm90ZWJvb2tFZGl0b3IuaXNEaXNwb3NlZCkge1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMubm90ZWJvb2tFZGl0b3IuY2hhbmdlVmlld1pvbmVzKGFjY2Vzc29yID0+IHtcblx0XHRcdFx0XHRcdFx0XHRcdGFjY2Vzc29yLnJlbW92ZVpvbmUoaWQpO1xuXHRcdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXG5cdFx0dGhpcy5ub3RlYm9va0VkaXRvci5jaGFuZ2VWaWV3Wm9uZXMoYWNjZXNzb3IgPT4ge1xuXHRcdFx0Y29uc3QgaGVpZ2h0ID0gdGhpcy5ub3RlYm9va09wdGlvbnMuY29tcHV0ZVRvcEluc2VydFRvb2xiYXJIZWlnaHQodGhpcy5ub3RlYm9va0VkaXRvci50ZXh0TW9kZWw/LnZpZXdUeXBlKTtcblx0XHRcdGNvbnN0IGlkID0gYWNjZXNzb3IuYWRkWm9uZSh7XG5cdFx0XHRcdGFmdGVyTW9kZWxQb3NpdGlvbjogMCxcblx0XHRcdFx0aGVpZ2h0SW5QeDogaGVpZ2h0LFxuXHRcdFx0XHRkb21Ob2RlOiB0aGlzLnRvcENlbGxUb29sYmFyQ29udGFpbmVyXG5cdFx0XHR9KTtcblx0XHRcdGFjY2Vzc29yLmxheW91dFpvbmUoaWQpO1xuXG5cdFx0XHR0aGlzLnZpZXdab25lLnZhbHVlPy5hZGQoe1xuXHRcdFx0XHRkaXNwb3NlOiAoKSA9PiB7XG5cdFx0XHRcdFx0aWYgKCF0aGlzLm5vdGVib29rRWRpdG9yLmlzRGlzcG9zZWQpIHtcblx0XHRcdFx0XHRcdHRoaXMubm90ZWJvb2tFZGl0b3IuY2hhbmdlVmlld1pvbmVzKGFjY2Vzc29yID0+IHtcblx0XHRcdFx0XHRcdFx0YWNjZXNzb3IucmVtb3ZlWm9uZShpZCk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRET00uY2xlYXJOb2RlKHRoaXMudG9wQ2VsbFRvb2xiYXIpO1xuXG5cdFx0XHRjb25zdCB0b29sYmFyID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNZW51V29ya2JlbmNoVG9vbEJhciwgdGhpcy50b3BDZWxsVG9vbGJhciwgdGhpcy5ub3RlYm9va0VkaXRvci5jcmVhdGlvbk9wdGlvbnMubWVudUlkcy5jZWxsVG9wSW5zZXJ0VG9vbGJhciwge1xuXHRcdFx0XHRhY3Rpb25WaWV3SXRlbVByb3ZpZGVyOiAoYWN0aW9uLCBvcHRpb25zKSA9PiB7XG5cdFx0XHRcdFx0aWYgKGFjdGlvbiBpbnN0YW5jZW9mIE1lbnVJdGVtQWN0aW9uKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBpdGVtID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb2RpY29uQWN0aW9uVmlld0l0ZW0sIGFjdGlvbiwgeyBob3ZlckRlbGVnYXRlOiBvcHRpb25zLmhvdmVyRGVsZWdhdGUgfSk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gaXRlbTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRtZW51T3B0aW9uczoge1xuXHRcdFx0XHRcdHNob3VsZEZvcndhcmRBcmdzOiB0cnVlXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHRvb2xiYXJPcHRpb25zOiB7XG5cdFx0XHRcdFx0cHJpbWFyeUdyb3VwOiAoZzogc3RyaW5nKSA9PiAvXmlubGluZS8udGVzdChnKSxcblx0XHRcdFx0fSxcblx0XHRcdFx0aGlkZGVuSXRlbVN0cmF0ZWd5OiBIaWRkZW5JdGVtU3RyYXRlZ3kuSWdub3JlLFxuXHRcdFx0fSk7XG5cblx0XHRcdGlmICh0aGlzLm5vdGVib29rRWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdFx0dG9vbGJhci5jb250ZXh0ID0ge1xuXHRcdFx0XHRcdG5vdGVib29rRWRpdG9yOiB0aGlzLm5vdGVib29rRWRpdG9yXG5cdFx0XHRcdH0gc2F0aXNmaWVzIElOb3RlYm9va0FjdGlvbkNvbnRleHQ7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMudmlld1pvbmUudmFsdWU/LmFkZCh0b29sYmFyKTtcblxuXHRcdFx0Ly8gdXBkYXRlIHRvb2xiYXIgY29udGFpbmVyIGNzcyBiYXNlZCBvbiBjZWxsIGxpc3QgbGVuZ3RoXG5cdFx0XHR0aGlzLnZpZXdab25lLnZhbHVlPy5hZGQodGhpcy5ub3RlYm9va0VkaXRvci5vbkRpZENoYW5nZU1vZGVsKCgpID0+IHtcblx0XHRcdFx0dGhpcy5fbW9kZWxEaXNwb3NhYmxlcy5jbGVhcigpO1xuXG5cdFx0XHRcdGlmICh0aGlzLm5vdGVib29rRWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdFx0XHR0aGlzLl9tb2RlbERpc3Bvc2FibGVzLmFkZCh0aGlzLm5vdGVib29rRWRpdG9yLm9uRGlkQ2hhbmdlVmlld0NlbGxzKCgpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMudXBkYXRlQ2xhc3MoKTtcblx0XHRcdFx0XHR9KSk7XG5cblx0XHRcdFx0XHR0aGlzLnVwZGF0ZUNsYXNzKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblxuXHRcdFx0dGhpcy51cGRhdGVDbGFzcygpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVDbGFzcygpIHtcblx0XHRpZiAodGhpcy5ub3RlYm9va0VkaXRvci5oYXNNb2RlbCgpICYmIHRoaXMubm90ZWJvb2tFZGl0b3IuZ2V0TGVuZ3RoKCkgPT09IDApIHtcblx0XHRcdHRoaXMudG9wQ2VsbFRvb2xiYXIuY2xhc3NMaXN0LmFkZCgnZW1wdHlOb3RlYm9vaycpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnRvcENlbGxUb29sYmFyLmNsYXNzTGlzdC5yZW1vdmUoJ2VtcHR5Tm90ZWJvb2snKTtcblx0XHR9XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsWUFBWSxpQkFBaUIseUJBQXlCO0FBQy9ELFNBQVMsb0JBQW9CLDRCQUE0QjtBQUN6RCxTQUFTLGNBQWMsc0JBQXNCO0FBQzdDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsNkJBQTZCO0FBSXRDLFNBQVMsNkJBQTZCO0FBRS9CLElBQU0scUJBQU4sY0FBaUMs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
