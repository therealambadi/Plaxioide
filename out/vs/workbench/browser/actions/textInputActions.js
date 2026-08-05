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
import { Separator, toAction } from "../../../base/common/actions.js";
import { localize } from "../../../nls.js";
import { IWorkbenchLayoutService } from "../../services/layout/browser/layoutService.js";
import { IContextMenuService } from "../../../platform/contextview/browser/contextView.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { EventHelper, addDisposableListener, getActiveDocument, getWindow, isHTMLInputElement, isHTMLTextAreaElement } from "../../../base/browser/dom.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../common/contributions.js";
import { IClipboardService } from "../../../platform/clipboard/common/clipboardService.js";
import { StandardMouseEvent } from "../../../base/browser/mouseEvent.js";
import { Event as BaseEvent } from "../../../base/common/event.js";
import { Lazy } from "../../../base/common/lazy.js";
function createTextInputActions(clipboardService) {
  return [
    toAction({ id: "undo", label: localize("undo", "Undo"), run: () => getActiveDocument().execCommand("undo") }),
    toAction({ id: "redo", label: localize("redo", "Redo"), run: () => getActiveDocument().execCommand("redo") }),
    new Separator(),
    toAction({ id: "editor.action.clipboardCutAction", label: localize("cut", "Cut"), run: () => getActiveDocument().execCommand("cut") }),
    toAction({ id: "editor.action.clipboardCopyAction", label: localize("copy", "Copy"), run: () => getActiveDocument().execCommand("copy") }),
    toAction({
      id: "editor.action.clipboardPasteAction",
      label: localize("paste", "Paste"),
      run: async (element) => {
        const clipboardText = await clipboardService.readText();
        if (isHTMLTextAreaElement(element) || isHTMLInputElement(element)) {
          const selectionStart = element.selectionStart || 0;
          const selectionEnd = element.selectionEnd || 0;
          element.value = `${element.value.substring(0, selectionStart)}${clipboardText}${element.value.substring(selectionEnd, element.value.length)}`;
          element.selectionStart = selectionStart + clipboardText.length;
          element.selectionEnd = element.selectionStart;
          element.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
        }
      }
    }),
    new Separator(),
    toAction({ id: "editor.action.selectAll", label: localize("selectAll", "Select All"), run: () => getActiveDocument().execCommand("selectAll") })
  ];
}
let TextInputActionsProvider = class extends Disposable {
  constructor(layoutService, contextMenuService, clipboardService) {
    super();
    this.layoutService = layoutService;
    this.contextMenuService = contextMenuService;
    this.clipboardService = clipboardService;
    this.textInputActions = new Lazy(() => createTextInputActions(this.clipboardService));
    this.registerListeners();
  }
  registerListeners() {
    this._register(BaseEvent.runAndSubscribe(this.layoutService.onDidAddContainer, ({ container, disposables }) => {
      disposables.add(addDisposableListener(container, "contextmenu", (e) => this.onContextMenu(getWindow(container), e)));
    }, { container: this.layoutService.mainContainer, disposables: this._store }));
  }
  onContextMenu(targetWindow, e) {
    if (e.defaultPrevented) {
      return;
    }
    const target = e.target;
    if (!isHTMLTextAreaElement(target) && !isHTMLInputElement(target)) {
      return;
    }
    EventHelper.stop(e, true);
    const event = new StandardMouseEvent(targetWindow, e);
    this.contextMenuService.showContextMenu({
      getAnchor: () => event,
      getActions: () => this.textInputActions.value,
      getActionsContext: () => target
    });
  }
};
TextInputActionsProvider.ID = "workbench.contrib.textInputActionsProvider";
TextInputActionsProvider = __decorateClass([
  __decorateParam(0, IWorkbenchLayoutService),
  __decorateParam(1, IContextMenuService),
  __decorateParam(2, IClipboardService)
], TextInputActionsProvider);
registerWorkbenchContribution2(
  TextInputActionsProvider.ID,
  TextInputActionsProvider,
  WorkbenchPhase.BlockRestore
  // Block to allow right-click into input fields before restore finished
);
export {
  TextInputActionsProvider,
  createTextInputActions
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9hY3Rpb25zL3RleHRJbnB1dEFjdGlvbnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBJQWN0aW9uLCBTZXBhcmF0b3IsIHRvQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoTGF5b3V0U2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2xheW91dC9icm93c2VyL2xheW91dFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBFdmVudEhlbHBlciwgYWRkRGlzcG9zYWJsZUxpc3RlbmVyLCBnZXRBY3RpdmVEb2N1bWVudCwgZ2V0V2luZG93LCBpc0hUTUxJbnB1dEVsZW1lbnQsIGlzSFRNTFRleHRBcmVhRWxlbWVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiwgV29ya2JlbmNoUGhhc2UsIHJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMiB9IGZyb20gJy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IElDbGlwYm9hcmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vY2xpcGJvYXJkL2NvbW1vbi9jbGlwYm9hcmRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkTW91c2VFdmVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9tb3VzZUV2ZW50LmpzJztcbmltcG9ydCB7IEV2ZW50IGFzIEJhc2VFdmVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IExhenkgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9sYXp5LmpzJztcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVRleHRJbnB1dEFjdGlvbnMoY2xpcGJvYXJkU2VydmljZTogSUNsaXBib2FyZFNlcnZpY2UpOiBJQWN0aW9uW10ge1xuXHRyZXR1cm4gW1xuXG5cdFx0dG9BY3Rpb24oeyBpZDogJ3VuZG8nLCBsYWJlbDogbG9jYWxpemUoJ3VuZG8nLCBcIlVuZG9cIiksIHJ1bjogKCkgPT4gZ2V0QWN0aXZlRG9jdW1lbnQoKS5leGVjQ29tbWFuZCgndW5kbycpIH0pLFxuXHRcdHRvQWN0aW9uKHsgaWQ6ICdyZWRvJywgbGFiZWw6IGxvY2FsaXplKCdyZWRvJywgXCJSZWRvXCIpLCBydW46ICgpID0+IGdldEFjdGl2ZURvY3VtZW50KCkuZXhlY0NvbW1hbmQoJ3JlZG8nKSB9KSxcblx0XHRuZXcgU2VwYXJhdG9yKCksXG5cdFx0dG9BY3Rpb24oeyBpZDogJ2VkaXRvci5hY3Rpb24uY2xpcGJvYXJkQ3V0QWN0aW9uJywgbGFiZWw6IGxvY2FsaXplKCdjdXQnLCBcIkN1dFwiKSwgcnVuOiAoKSA9PiBnZXRBY3RpdmVEb2N1bWVudCgpLmV4ZWNDb21tYW5kKCdjdXQnKSB9KSxcblx0XHR0b0FjdGlvbih7IGlkOiAnZWRpdG9yLmFjdGlvbi5jbGlwYm9hcmRDb3B5QWN0aW9uJywgbGFiZWw6IGxvY2FsaXplKCdjb3B5JywgXCJDb3B5XCIpLCBydW46ICgpID0+IGdldEFjdGl2ZURvY3VtZW50KCkuZXhlY0NvbW1hbmQoJ2NvcHknKSB9KSxcblx0XHR0b0FjdGlvbih7XG5cdFx0XHRpZDogJ2VkaXRvci5hY3Rpb24uY2xpcGJvYXJkUGFzdGVBY3Rpb24nLFxuXHRcdFx0bGFiZWw6IGxvY2FsaXplKCdwYXN0ZScsIFwiUGFzdGVcIiksXG5cdFx0XHRydW46IGFzeW5jIChlbGVtZW50OiB1bmtub3duKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGNsaXBib2FyZFRleHQgPSBhd2FpdCBjbGlwYm9hcmRTZXJ2aWNlLnJlYWRUZXh0KCk7XG5cdFx0XHRcdGlmIChpc0hUTUxUZXh0QXJlYUVsZW1lbnQoZWxlbWVudCkgfHwgaXNIVE1MSW5wdXRFbGVtZW50KGVsZW1lbnQpKSB7XG5cdFx0XHRcdFx0Y29uc3Qgc2VsZWN0aW9uU3RhcnQgPSBlbGVtZW50LnNlbGVjdGlvblN0YXJ0IHx8IDA7XG5cdFx0XHRcdFx0Y29uc3Qgc2VsZWN0aW9uRW5kID0gZWxlbWVudC5zZWxlY3Rpb25FbmQgfHwgMDtcblxuXHRcdFx0XHRcdGVsZW1lbnQudmFsdWUgPSBgJHtlbGVtZW50LnZhbHVlLnN1YnN0cmluZygwLCBzZWxlY3Rpb25TdGFydCl9JHtjbGlwYm9hcmRUZXh0fSR7ZWxlbWVudC52YWx1ZS5zdWJzdHJpbmcoc2VsZWN0aW9uRW5kLCBlbGVtZW50LnZhbHVlLmxlbmd0aCl9YDtcblx0XHRcdFx0XHRlbGVtZW50LnNlbGVjdGlvblN0YXJ0ID0gc2VsZWN0aW9uU3RhcnQgKyBjbGlwYm9hcmRUZXh0Lmxlbmd0aDtcblx0XHRcdFx0XHRlbGVtZW50LnNlbGVjdGlvbkVuZCA9IGVsZW1lbnQuc2VsZWN0aW9uU3RhcnQ7XG5cdFx0XHRcdFx0ZWxlbWVudC5kaXNwYXRjaEV2ZW50KG5ldyBFdmVudCgnaW5wdXQnLCB7IGJ1YmJsZXM6IHRydWUsIGNhbmNlbGFibGU6IHRydWUgfSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSksXG5cdFx0bmV3IFNlcGFyYXRvcigpLFxuXHRcdHRvQWN0aW9uKHsgaWQ6ICdlZGl0b3IuYWN0aW9uLnNlbGVjdEFsbCcsIGxhYmVsOiBsb2NhbGl6ZSgnc2VsZWN0QWxsJywgXCJTZWxlY3QgQWxsXCIpLCBydW46ICgpID0+IGdldEFjdGl2ZURvY3VtZW50KCkuZXhlY0NvbW1hbmQoJ3NlbGVjdEFsbCcpIH0pXG5cdF07XG59XG5cbmV4cG9ydCBjbGFzcyBUZXh0SW5wdXRBY3Rpb25zUHJvdmlkZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5jb250cmliLnRleHRJbnB1dEFjdGlvbnNQcm92aWRlcic7XG5cblx0cHJpdmF0ZSByZWFkb25seSB0ZXh0SW5wdXRBY3Rpb25zID0gbmV3IExhenk8SUFjdGlvbltdPigoKSA9PiBjcmVhdGVUZXh0SW5wdXRBY3Rpb25zKHRoaXMuY2xpcGJvYXJkU2VydmljZSkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJV29ya2JlbmNoTGF5b3V0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxheW91dFNlcnZpY2U6IElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJQ2xpcGJvYXJkU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNsaXBib2FyZFNlcnZpY2U6IElDbGlwYm9hcmRTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyTGlzdGVuZXJzKCk6IHZvaWQge1xuXG5cdFx0Ly8gQ29udGV4dCBtZW51IHN1cHBvcnQgaW4gaW5wdXQvdGV4dGFyZWFcblx0XHR0aGlzLl9yZWdpc3RlcihCYXNlRXZlbnQucnVuQW5kU3Vic2NyaWJlKHRoaXMubGF5b3V0U2VydmljZS5vbkRpZEFkZENvbnRhaW5lciwgKHsgY29udGFpbmVyLCBkaXNwb3NhYmxlcyB9KSA9PiB7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGNvbnRhaW5lciwgJ2NvbnRleHRtZW51JywgZSA9PiB0aGlzLm9uQ29udGV4dE1lbnUoZ2V0V2luZG93KGNvbnRhaW5lciksIGUpKSk7XG5cdFx0fSwgeyBjb250YWluZXI6IHRoaXMubGF5b3V0U2VydmljZS5tYWluQ29udGFpbmVyLCBkaXNwb3NhYmxlczogdGhpcy5fc3RvcmUgfSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkNvbnRleHRNZW51KHRhcmdldFdpbmRvdzogV2luZG93LCBlOiBNb3VzZUV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKGUuZGVmYXVsdFByZXZlbnRlZCkge1xuXHRcdFx0cmV0dXJuOyAvLyBtYWtlIHN1cmUgdG8gbm90IHNob3cgdGhlc2UgYWN0aW9ucyBieSBhY2NpZGVudCBpZiBjb21wb25lbnQgaW5kaWNhdGVkIHRvIHByZXZlbnRcblx0XHR9XG5cblx0XHRjb25zdCB0YXJnZXQgPSBlLnRhcmdldDtcblx0XHRpZiAoIWlzSFRNTFRleHRBcmVhRWxlbWVudCh0YXJnZXQpICYmICFpc0hUTUxJbnB1dEVsZW1lbnQodGFyZ2V0KSkge1xuXHRcdFx0cmV0dXJuOyAvLyBvbmx5IGZvciBpbnB1dHMgb3IgdGV4dGFyZWFzXG5cdFx0fVxuXG5cdFx0RXZlbnRIZWxwZXIuc3RvcChlLCB0cnVlKTtcblxuXHRcdGNvbnN0IGV2ZW50ID0gbmV3IFN0YW5kYXJkTW91c2VFdmVudCh0YXJnZXRXaW5kb3csIGUpO1xuXG5cdFx0dGhpcy5jb250ZXh0TWVudVNlcnZpY2Uuc2hvd0NvbnRleHRNZW51KHtcblx0XHRcdGdldEFuY2hvcjogKCkgPT4gZXZlbnQsXG5cdFx0XHRnZXRBY3Rpb25zOiAoKSA9PiB0aGlzLnRleHRJbnB1dEFjdGlvbnMudmFsdWUsXG5cdFx0XHRnZXRBY3Rpb25zQ29udGV4dDogKCkgPT4gdGFyZ2V0LFxuXHRcdH0pO1xuXHR9XG59XG5cbnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMihcblx0VGV4dElucHV0QWN0aW9uc1Byb3ZpZGVyLklELFxuXHRUZXh0SW5wdXRBY3Rpb25zUHJvdmlkZXIsXG5cdFdvcmtiZW5jaFBoYXNlLkJsb2NrUmVzdG9yZSAvLyBCbG9jayB0byBhbGxvdyByaWdodC1jbGljayBpbnRvIGlucHV0IGZpZWxkcyBiZWZvcmUgcmVzdG9yZSBmaW5pc2hlZFxuKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBa0IsV0FBVyxnQkFBZ0I7QUFDN0MsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUywrQkFBK0I7QUFDeEMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxhQUFhLHVCQUF1QixtQkFBbUIsV0FBVyxvQkFBb0IsNkJBQTZCO0FBQzVILFNBQWlDLGdCQUFnQixzQ0FBc0M7QUFDdkYsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxTQUFTLGlCQUFpQjtBQUNuQyxTQUFTLFlBQVk7QUFFZCxTQUFTLHVCQUF1QixrQkFBZ0Q7QUFDdEYsU0FBTztBQUFBLElBRU4sU0FBUyxFQUFFLElBQUksUUFBUSxPQUFPLFNBQVMsUUFBUSxNQUFNLEdBQUcsS0FBSyxNQUFNLGtCQUFrQixFQUFFLFlBQVksTUFBTSxFQUFFLENB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
