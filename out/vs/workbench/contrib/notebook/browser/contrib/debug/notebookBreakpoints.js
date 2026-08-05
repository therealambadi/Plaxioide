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
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../../../base/common/map.js";
import { Schemas } from "../../../../../../base/common/network.js";
import { isEqual } from "../../../../../../base/common/resources.js";
import { Registry } from "../../../../../../platform/registry/common/platform.js";
import { Extensions as WorkbenchExtensions } from "../../../../../common/contributions.js";
import { IDebugService } from "../../../../debug/common/debug.js";
import { getNotebookEditorFromEditorPane } from "../../notebookBrowser.js";
import { CellUri, NotebookCellsChangeType } from "../../../common/notebookCommon.js";
import { INotebookService } from "../../../common/notebookService.js";
import { IEditorService } from "../../../../../services/editor/common/editorService.js";
import { LifecyclePhase } from "../../../../../services/lifecycle/common/lifecycle.js";
let NotebookBreakpoints = class extends Disposable {
  constructor(_debugService, _notebookService, _editorService) {
    super();
    this._debugService = _debugService;
    this._editorService = _editorService;
    const listeners = new ResourceMap();
    this._register(_notebookService.onWillAddNotebookDocument((model) => {
      listeners.set(model.uri, model.onWillAddRemoveCells((e) => {
        const debugModel = this._debugService.getModel();
        if (!debugModel.getBreakpoints().length) {
          return;
        }
        if (e.rawEvent.kind !== NotebookCellsChangeType.ModelChange) {
          return;
        }
        for (const change of e.rawEvent.changes) {
          const [start, deleteCount] = change;
          if (deleteCount > 0) {
            const deleted = model.cells.slice(start, start + deleteCount);
            for (const deletedCell of deleted) {
              const cellBps = debugModel.getBreakpoints({ uri: deletedCell.uri });
              cellBps.forEach((cellBp) => this._debugService.removeBreakpoints(cellBp.getId()));
            }
          }
        }
      }));
    }));
    this._register(_notebookService.onWillRemoveNotebookDocument((model) => {
      this.updateBreakpoints(model);
      listeners.get(model.uri)?.dispose();
      listeners.delete(model.uri);
    }));
    this._register(this._debugService.getModel().onDidChangeBreakpoints((e) => {
      const newCellBp = e?.added?.find((bp) => "uri" in bp && bp.uri.scheme === Schemas.vscodeNotebookCell);
      if (newCellBp) {
        const parsed = CellUri.parse(newCellBp.uri);
        if (!parsed) {
          return;
        }
        const editor = getNotebookEditorFromEditorPane(this._editorService.activeEditorPane);
        if (!editor || !editor.hasModel() || editor.textModel.uri.toString() !== parsed.notebook.toString()) {
          return;
        }
        const cell = editor.getCellByHandle(parsed.handle);
        if (!cell) {
          return;
        }
        editor.focusElement(cell);
      }
    }));
  }
  updateBreakpoints(model) {
    const bps = this._debugService.getModel().getBreakpoints();
    if (!bps.length || !model.cells.length) {
      return;
    }
    const idxMap = new ResourceMap();
    model.cells.forEach((cell, i) => {
      idxMap.set(cell.uri, i);
    });
    bps.forEach((bp) => {
      const idx = idxMap.get(bp.uri);
      if (typeof idx !== "number") {
        return;
      }
      const notebook = CellUri.parse(bp.uri)?.notebook;
      if (!notebook) {
        return;
      }
      const newUri = CellUri.generate(notebook, idx);
      if (isEqual(newUri, bp.uri)) {
        return;
      }
      this._debugService.removeBreakpoints(bp.getId());
      this._debugService.addBreakpoints(newUri, [
        {
          column: bp.column,
          condition: bp.condition,
          enabled: bp.enabled,
          hitCondition: bp.hitCondition,
          logMessage: bp.logMessage,
          lineNumber: bp.lineNumber
        }
      ]);
    });
  }
};
NotebookBreakpoints = __decorateClass([
  __decorateParam(0, IDebugService),
  __decorateParam(1, INotebookService),
  __decorateParam(2, IEditorService)
], NotebookBreakpoints);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(NotebookBreakpoints, LifecyclePhase.Restored);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL2NvbnRyaWIvZGVidWcvbm90ZWJvb2tCcmVha3BvaW50cy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IERpc3Bvc2FibGUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFJlc291cmNlTWFwIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IGlzRXF1YWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9ucyBhcyBXb3JrYmVuY2hFeHRlbnNpb25zLCBJV29ya2JlbmNoQ29udHJpYnV0aW9uLCBJV29ya2JlbmNoQ29udHJpYnV0aW9uc1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgSUJyZWFrcG9pbnQsIElEZWJ1Z1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9kZWJ1Zy9jb21tb24vZGVidWcuanMnO1xuaW1wb3J0IHsgZ2V0Tm90ZWJvb2tFZGl0b3JGcm9tRWRpdG9yUGFuZSB9IGZyb20gJy4uLy4uL25vdGVib29rQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va1RleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tb2RlbC9ub3RlYm9va1RleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBDZWxsVXJpLCBOb3RlYm9va0NlbGxzQ2hhbmdlVHlwZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9ub3RlYm9va0NvbW1vbi5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL25vdGVib29rU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBMaWZlY3ljbGVQaGFzZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3NlcnZpY2VzL2xpZmVjeWNsZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcblxuY2xhc3MgTm90ZWJvb2tCcmVha3BvaW50cyBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0QElEZWJ1Z1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZGVidWdTZXJ2aWNlOiBJRGVidWdTZXJ2aWNlLFxuXHRcdEBJTm90ZWJvb2tTZXJ2aWNlIF9ub3RlYm9va1NlcnZpY2U6IElOb3RlYm9va1NlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0Y29uc3QgbGlzdGVuZXJzID0gbmV3IFJlc291cmNlTWFwPElEaXNwb3NhYmxlPigpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKF9ub3RlYm9va1NlcnZpY2Uub25XaWxsQWRkTm90ZWJvb2tEb2N1bWVudChtb2RlbCA9PiB7XG5cdFx0XHRsaXN0ZW5lcnMuc2V0KG1vZGVsLnVyaSwgbW9kZWwub25XaWxsQWRkUmVtb3ZlQ2VsbHMoZSA9PiB7XG5cdFx0XHRcdC8vIFdoZW4gZGVsZXRpbmcgYSBjZWxsLCByZW1vdmUgaXRzIGJyZWFrcG9pbnRzXG5cdFx0XHRcdGNvbnN0IGRlYnVnTW9kZWwgPSB0aGlzLl9kZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKTtcblx0XHRcdFx0aWYgKCFkZWJ1Z01vZGVsLmdldEJyZWFrcG9pbnRzKCkubGVuZ3RoKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGUucmF3RXZlbnQua2luZCAhPT0gTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuTW9kZWxDaGFuZ2UpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRmb3IgKGNvbnN0IGNoYW5nZSBvZiBlLnJhd0V2ZW50LmNoYW5nZXMpIHtcblx0XHRcdFx0XHRjb25zdCBbc3RhcnQsIGRlbGV0ZUNvdW50XSA9IGNoYW5nZTtcblx0XHRcdFx0XHRpZiAoZGVsZXRlQ291bnQgPiAwKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBkZWxldGVkID0gbW9kZWwuY2VsbHMuc2xpY2Uoc3RhcnQsIHN0YXJ0ICsgZGVsZXRlQ291bnQpO1xuXHRcdFx0XHRcdFx0Zm9yIChjb25zdCBkZWxldGVkQ2VsbCBvZiBkZWxldGVkKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGNlbGxCcHMgPSBkZWJ1Z01vZGVsLmdldEJyZWFrcG9pbnRzKHsgdXJpOiBkZWxldGVkQ2VsbC51cmkgfSk7XG5cdFx0XHRcdFx0XHRcdGNlbGxCcHMuZm9yRWFjaChjZWxsQnAgPT4gdGhpcy5fZGVidWdTZXJ2aWNlLnJlbW92ZUJyZWFrcG9pbnRzKGNlbGxCcC5nZXRJZCgpKSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoX25vdGVib29rU2VydmljZS5vbldpbGxSZW1vdmVOb3RlYm9va0RvY3VtZW50KG1vZGVsID0+IHtcblx0XHRcdHRoaXMudXBkYXRlQnJlYWtwb2ludHMobW9kZWwpO1xuXHRcdFx0bGlzdGVuZXJzLmdldChtb2RlbC51cmkpPy5kaXNwb3NlKCk7XG5cdFx0XHRsaXN0ZW5lcnMuZGVsZXRlKG1vZGVsLnVyaSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZGVidWdTZXJ2aWNlLmdldE1vZGVsKCkub25EaWRDaGFuZ2VCcmVha3BvaW50cyhlID0+IHtcblx0XHRcdGNvbnN0IG5ld0NlbGxCcCA9IGU/LmFkZGVkPy5maW5kKGJwID0+ICd1cmknIGluIGJwICYmIGJwLnVyaS5zY2hlbWUgPT09IFNjaGVtYXMudnNjb2RlTm90ZWJvb2tDZWxsKSBhcyBJQnJlYWtwb2ludCB8IHVuZGVmaW5lZDtcblx0XHRcdGlmIChuZXdDZWxsQnApIHtcblx0XHRcdFx0Y29uc3QgcGFyc2VkID0gQ2VsbFVyaS5wYXJzZShuZXdDZWxsQnAudXJpKTtcblx0XHRcdFx0aWYgKCFwYXJzZWQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBlZGl0b3IgPSBnZXROb3RlYm9va0VkaXRvckZyb21FZGl0b3JQYW5lKHRoaXMuX2VkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZSk7XG5cdFx0XHRcdGlmICghZWRpdG9yIHx8ICFlZGl0b3IuaGFzTW9kZWwoKSB8fCBlZGl0b3IudGV4dE1vZGVsLnVyaS50b1N0cmluZygpICE9PSBwYXJzZWQubm90ZWJvb2sudG9TdHJpbmcoKSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cblx0XHRcdFx0Y29uc3QgY2VsbCA9IGVkaXRvci5nZXRDZWxsQnlIYW5kbGUocGFyc2VkLmhhbmRsZSk7XG5cdFx0XHRcdGlmICghY2VsbCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGVkaXRvci5mb2N1c0VsZW1lbnQoY2VsbCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVCcmVha3BvaW50cyhtb2RlbDogTm90ZWJvb2tUZXh0TW9kZWwpOiB2b2lkIHtcblx0XHRjb25zdCBicHMgPSB0aGlzLl9kZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKS5nZXRCcmVha3BvaW50cygpO1xuXHRcdGlmICghYnBzLmxlbmd0aCB8fCAhbW9kZWwuY2VsbHMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgaWR4TWFwID0gbmV3IFJlc291cmNlTWFwPG51bWJlcj4oKTtcblx0XHRtb2RlbC5jZWxscy5mb3JFYWNoKChjZWxsLCBpKSA9PiB7XG5cdFx0XHRpZHhNYXAuc2V0KGNlbGwudXJpLCBpKTtcblx0XHR9KTtcblxuXHRcdGJwcy5mb3JFYWNoKGJwID0+IHtcblx0XHRcdGNvbnN0IGlkeCA9IGlkeE1hcC5nZXQoYnAudXJpKTtcblx0XHRcdGlmICh0eXBlb2YgaWR4ICE9PSAnbnVtYmVyJykge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG5vdGVib29rID0gQ2VsbFVyaS5wYXJzZShicC51cmkpPy5ub3RlYm9vaztcblx0XHRcdGlmICghbm90ZWJvb2spIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBuZXdVcmkgPSBDZWxsVXJpLmdlbmVyYXRlKG5vdGVib29rLCBpZHgpO1xuXHRcdFx0aWYgKGlzRXF1YWwobmV3VXJpLCBicC51cmkpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fZGVidWdTZXJ2aWNlLnJlbW92ZUJyZWFrcG9pbnRzKGJwLmdldElkKCkpO1xuXHRcdFx0dGhpcy5fZGVidWdTZXJ2aWNlLmFkZEJyZWFrcG9pbnRzKG5ld1VyaSwgW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0Y29sdW1uOiBicC5jb2x1bW4sXG5cdFx0XHRcdFx0Y29uZGl0aW9uOiBicC5jb25kaXRpb24sXG5cdFx0XHRcdFx0ZW5hYmxlZDogYnAuZW5hYmxlZCxcblx0XHRcdFx0XHRoaXRDb25kaXRpb246IGJwLmhpdENvbmRpdGlvbixcblx0XHRcdFx0XHRsb2dNZXNzYWdlOiBicC5sb2dNZXNzYWdlLFxuXHRcdFx0XHRcdGxpbmVOdW1iZXI6IGJwLmxpbmVOdW1iZXJcblx0XHRcdFx0fVxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cdH1cbn1cblxuUmVnaXN0cnkuYXM8SVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeT4oV29ya2JlbmNoRXh0ZW5zaW9ucy5Xb3JrYmVuY2gpLnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uKE5vdGVib29rQnJlYWtwb2ludHMsIExpZmVjeWNsZVBoYXNlLlJlc3RvcmVkKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxrQkFBK0I7QUFDeEMsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsZUFBZTtBQUN4QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGNBQWMsMkJBQW9GO0FBQzNHLFNBQXNCLHFCQUFxQjtBQUMzQyxTQUFTLHVDQUF1QztBQUVoRCxTQUFTLFNBQVMsK0JBQStCO0FBQ2pELFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsc0JBQXNCO0FB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
