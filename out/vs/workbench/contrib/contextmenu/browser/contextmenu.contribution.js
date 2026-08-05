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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { ILayoutService } from "../../../../platform/layout/browser/layoutService.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
let ContextMenuContribution = class extends Disposable {
  constructor(layoutService, contextMenuService) {
    super();
    const update = (visible) => layoutService.activeContainer.classList.toggle("context-menu-visible", visible);
    this._register(contextMenuService.onDidShowContextMenu(() => update(true)));
    this._register(contextMenuService.onDidHideContextMenu(() => update(false)));
  }
};
ContextMenuContribution = __decorateClass([
  __decorateParam(0, ILayoutService),
  __decorateParam(1, IContextMenuService)
], ContextMenuContribution);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(ContextMenuContribution, LifecyclePhase.Eventually);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb250ZXh0bWVudS9icm93c2VyL2NvbnRleHRtZW51LmNvbnRyaWJ1dGlvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgSUxheW91dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYXlvdXQvYnJvd3Nlci9sYXlvdXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnksIEV4dGVuc2lvbnMgYXMgV29ya2JlbmNoRXh0ZW5zaW9ucywgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IExpZmVjeWNsZVBoYXNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuXG5jbGFzcyBDb250ZXh0TWVudUNvbnRyaWJ1dGlvbiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUxheW91dFNlcnZpY2UgbGF5b3V0U2VydmljZTogSUxheW91dFNlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRjb25zdCB1cGRhdGUgPSAodmlzaWJsZTogYm9vbGVhbikgPT4gbGF5b3V0U2VydmljZS5hY3RpdmVDb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnY29udGV4dC1tZW51LXZpc2libGUnLCB2aXNpYmxlKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihjb250ZXh0TWVudVNlcnZpY2Uub25EaWRTaG93Q29udGV4dE1lbnUoKCkgPT4gdXBkYXRlKHRydWUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoY29udGV4dE1lbnVTZXJ2aWNlLm9uRGlkSGlkZUNvbnRleHRNZW51KCgpID0+IHVwZGF0ZShmYWxzZSkpKTtcblx0fVxufVxuXG5SZWdpc3RyeS5hczxJV29ya2JlbmNoQ29udHJpYnV0aW9uc1JlZ2lzdHJ5PihXb3JrYmVuY2hFeHRlbnNpb25zLldvcmtiZW5jaClcblx0LnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uKENvbnRleHRNZW51Q29udHJpYnV0aW9uLCBMaWZlY3ljbGVQaGFzZS5FdmVudHVhbGx5KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxnQkFBZ0I7QUFDekIsU0FBMEMsY0FBYywyQkFBbUQ7QUFDM0csU0FBUyxzQkFBc0I7QUFFL0IsSUFBTSwwQkFBTixjQUFzQyxXQUE2QztBQUFBLEVBRWxGLFlBQ2lCLGVBQ0ssb0JBQ3BCO0FBQ0QsVUFBTTtBQUVOLFVBQU0sU0FBUyxDQUFDLFlBQXFCLGNBQWMsZ0JBQWdCLFVBQVUsT0FBTyx3QkFBd0IsT0FBTztBQUNuSCxTQUFLLFVBQVUsbUJBQW1CLHFCQUFxQixNQUFNLE9BQU8sSUFBSSxDQUFDLENBQUM7QUFDMUUsU0FBSyxVQUFVLG1CQUFtQixxQkFBcUIsTUFBTSxPQUFPLEtBQUssQ0FBQyxDQUFDO0FBQUEsRUFDNUU7QUFDRDtBQVpNLDBCQUFOO0FBQUEsRUFHRztBQUFBLEVBQ0E7QUFBQSxHQUpHO0FBY04sU0FBUyxHQUFvQyxvQkFBb0IsU0FBUyxFQUN4RSw4QkFBOEIseUJBQXlCLGVBQWUsVUFBVTsiLAogICJuYW1lcyI6IFtdCn0K
