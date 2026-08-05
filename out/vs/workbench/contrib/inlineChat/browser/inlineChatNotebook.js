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
import { illegalState } from "../../../../base/common/errors.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { isEqual } from "../../../../base/common/resources.js";
import { InlineChatController } from "./inlineChatController.js";
import { IInlineChatSessionService } from "./inlineChatSessionService.js";
import { INotebookEditorService } from "../../notebook/browser/services/notebookEditorService.js";
import { CellUri } from "../../notebook/common/notebookCommon.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { NotebookTextDiffEditor } from "../../notebook/browser/diff/notebookDiffEditor.js";
import { NotebookMultiTextDiffEditor } from "../../notebook/browser/diff/notebookMultiDiffEditor.js";
let InlineChatNotebookContribution = class {
  constructor(sessionService, editorService, notebookEditorService) {
    this._store = new DisposableStore();
    this._store.add(sessionService.registerSessionKeyComputer(Schemas.vscodeNotebookCell, {
      getComparisonKey: (editor, uri) => {
        const data = CellUri.parse(uri);
        if (!data) {
          throw illegalState("Expected notebook cell uri");
        }
        let fallback;
        for (const notebookEditor of notebookEditorService.listNotebookEditors()) {
          if (notebookEditor.hasModel() && isEqual(notebookEditor.textModel.uri, data.notebook)) {
            const candidate = `<notebook>${notebookEditor.getId()}#${uri}`;
            if (!fallback) {
              fallback = candidate;
            }
            if (notebookEditor.codeEditors.find((tuple) => tuple[1] === editor)) {
              return candidate;
            }
          }
        }
        if (fallback) {
          return fallback;
        }
        const activeEditor = editorService.activeEditorPane;
        if (activeEditor && (activeEditor.getId() === NotebookTextDiffEditor.ID || activeEditor.getId() === NotebookMultiTextDiffEditor.ID)) {
          return `<notebook>${editor.getId()}#${uri}`;
        }
        throw illegalState("Expected notebook editor");
      }
    }));
    this._store.add(sessionService.onWillStartSession((newSessionEditor) => {
      const candidate = CellUri.parse(newSessionEditor.getModel().uri);
      if (!candidate) {
        return;
      }
      for (const notebookEditor of notebookEditorService.listNotebookEditors()) {
        if (isEqual(notebookEditor.textModel?.uri, candidate.notebook)) {
          let found = false;
          const editors = [];
          for (const [, codeEditor] of notebookEditor.codeEditors) {
            editors.push(codeEditor);
            found = codeEditor === newSessionEditor || found;
          }
          if (found) {
            for (const editor of editors) {
              if (editor !== newSessionEditor) {
                InlineChatController.get(editor)?.acceptSession();
              }
            }
            break;
          }
        }
      }
    }));
  }
  dispose() {
    this._store.dispose();
  }
};
InlineChatNotebookContribution = __decorateClass([
  __decorateParam(0, IInlineChatSessionService),
  __decorateParam(1, IEditorService),
  __decorateParam(2, INotebookEditorService)
], InlineChatNotebookContribution);
export {
  InlineChatNotebookContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9pbmxpbmVDaGF0L2Jyb3dzZXIvaW5saW5lQ2hhdE5vdGVib29rLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgaWxsZWdhbFN0YXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBpc0VxdWFsIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBJbmxpbmVDaGF0Q29udHJvbGxlciB9IGZyb20gJy4vaW5saW5lQ2hhdENvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgSUlubGluZUNoYXRTZXNzaW9uU2VydmljZSB9IGZyb20gJy4vaW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0VkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi9ub3RlYm9vay9icm93c2VyL3NlcnZpY2VzL25vdGVib29rRWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDZWxsVXJpIH0gZnJvbSAnLi4vLi4vbm90ZWJvb2svY29tbW9uL25vdGVib29rQ29tbW9uLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE5vdGVib29rVGV4dERpZmZFZGl0b3IgfSBmcm9tICcuLi8uLi9ub3RlYm9vay9icm93c2VyL2RpZmYvbm90ZWJvb2tEaWZmRWRpdG9yLmpzJztcbmltcG9ydCB7IE5vdGVib29rTXVsdGlUZXh0RGlmZkVkaXRvciB9IGZyb20gJy4uLy4uL25vdGVib29rL2Jyb3dzZXIvZGlmZi9ub3RlYm9va011bHRpRGlmZkVkaXRvci5qcyc7XG5cbmV4cG9ydCBjbGFzcyBJbmxpbmVDaGF0Tm90ZWJvb2tDb250cmlidXRpb24ge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3N0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJSW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlIHNlc3Npb25TZXJ2aWNlOiBJSW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASU5vdGVib29rRWRpdG9yU2VydmljZSBub3RlYm9va0VkaXRvclNlcnZpY2U6IElOb3RlYm9va0VkaXRvclNlcnZpY2UsXG5cdCkge1xuXG5cdFx0dGhpcy5fc3RvcmUuYWRkKHNlc3Npb25TZXJ2aWNlLnJlZ2lzdGVyU2Vzc2lvbktleUNvbXB1dGVyKFNjaGVtYXMudnNjb2RlTm90ZWJvb2tDZWxsLCB7XG5cdFx0XHRnZXRDb21wYXJpc29uS2V5OiAoZWRpdG9yLCB1cmkpID0+IHtcblx0XHRcdFx0Y29uc3QgZGF0YSA9IENlbGxVcmkucGFyc2UodXJpKTtcblx0XHRcdFx0aWYgKCFkYXRhKSB7XG5cdFx0XHRcdFx0dGhyb3cgaWxsZWdhbFN0YXRlKCdFeHBlY3RlZCBub3RlYm9vayBjZWxsIHVyaScpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGxldCBmYWxsYmFjazogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdFx0XHRmb3IgKGNvbnN0IG5vdGVib29rRWRpdG9yIG9mIG5vdGVib29rRWRpdG9yU2VydmljZS5saXN0Tm90ZWJvb2tFZGl0b3JzKCkpIHtcblx0XHRcdFx0XHRpZiAobm90ZWJvb2tFZGl0b3IuaGFzTW9kZWwoKSAmJiBpc0VxdWFsKG5vdGVib29rRWRpdG9yLnRleHRNb2RlbC51cmksIGRhdGEubm90ZWJvb2spKSB7XG5cblx0XHRcdFx0XHRcdGNvbnN0IGNhbmRpZGF0ZSA9IGA8bm90ZWJvb2s+JHtub3RlYm9va0VkaXRvci5nZXRJZCgpfSMke3VyaX1gO1xuXG5cdFx0XHRcdFx0XHRpZiAoIWZhbGxiYWNrKSB7XG5cdFx0XHRcdFx0XHRcdGZhbGxiYWNrID0gY2FuZGlkYXRlO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHQvLyBmaW5kIHRoZSBjb2RlIGVkaXRvciBpbiB0aGUgbGlzdCBvZiBjZWxsLWNvZGUgZWRpdG9yc1xuXHRcdFx0XHRcdFx0aWYgKG5vdGVib29rRWRpdG9yLmNvZGVFZGl0b3JzLmZpbmQoKHR1cGxlKSA9PiB0dXBsZVsxXSA9PT0gZWRpdG9yKSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gY2FuZGlkYXRlO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHQvLyBcdC8vIHJldmVhbCBjZWxsIGFuZCB0cnkgdG8gZmluZCBjb2RlIGVkaXRvciBhZ2FpblxuXHRcdFx0XHRcdFx0Ly8gXHRjb25zdCBjZWxsID0gbm90ZWJvb2tFZGl0b3IuZ2V0Q2VsbEJ5SGFuZGxlKGRhdGEuaGFuZGxlKTtcblx0XHRcdFx0XHRcdC8vIFx0aWYgKGNlbGwpIHtcblx0XHRcdFx0XHRcdC8vIFx0XHRub3RlYm9va0VkaXRvci5yZXZlYWxJblZpZXdBdFRvcChjZWxsKTtcblx0XHRcdFx0XHRcdC8vIFx0XHRpZiAobm90ZWJvb2tFZGl0b3IuY29kZUVkaXRvcnMuZmluZCgodHVwbGUpID0+IHR1cGxlWzFdID09PSBlZGl0b3IpKSB7XG5cdFx0XHRcdFx0XHQvLyBcdFx0XHRyZXR1cm4gY2FuZGlkYXRlO1xuXHRcdFx0XHRcdFx0Ly8gXHRcdH1cblx0XHRcdFx0XHRcdC8vIFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChmYWxsYmFjaykge1xuXHRcdFx0XHRcdHJldHVybiBmYWxsYmFjaztcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGFjdGl2ZUVkaXRvciA9IGVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZTtcblx0XHRcdFx0aWYgKGFjdGl2ZUVkaXRvciAmJiAoYWN0aXZlRWRpdG9yLmdldElkKCkgPT09IE5vdGVib29rVGV4dERpZmZFZGl0b3IuSUQgfHwgYWN0aXZlRWRpdG9yLmdldElkKCkgPT09IE5vdGVib29rTXVsdGlUZXh0RGlmZkVkaXRvci5JRCkpIHtcblx0XHRcdFx0XHRyZXR1cm4gYDxub3RlYm9vaz4ke2VkaXRvci5nZXRJZCgpfSMke3VyaX1gO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhyb3cgaWxsZWdhbFN0YXRlKCdFeHBlY3RlZCBub3RlYm9vayBlZGl0b3InKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9zdG9yZS5hZGQoc2Vzc2lvblNlcnZpY2Uub25XaWxsU3RhcnRTZXNzaW9uKG5ld1Nlc3Npb25FZGl0b3IgPT4ge1xuXHRcdFx0Y29uc3QgY2FuZGlkYXRlID0gQ2VsbFVyaS5wYXJzZShuZXdTZXNzaW9uRWRpdG9yLmdldE1vZGVsKCkudXJpKTtcblx0XHRcdGlmICghY2FuZGlkYXRlKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGZvciAoY29uc3Qgbm90ZWJvb2tFZGl0b3Igb2Ygbm90ZWJvb2tFZGl0b3JTZXJ2aWNlLmxpc3ROb3RlYm9va0VkaXRvcnMoKSkge1xuXHRcdFx0XHRpZiAoaXNFcXVhbChub3RlYm9va0VkaXRvci50ZXh0TW9kZWw/LnVyaSwgY2FuZGlkYXRlLm5vdGVib29rKSkge1xuXHRcdFx0XHRcdGxldCBmb3VuZCA9IGZhbHNlO1xuXHRcdFx0XHRcdGNvbnN0IGVkaXRvcnM6IElDb2RlRWRpdG9yW10gPSBbXTtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IFssIGNvZGVFZGl0b3JdIG9mIG5vdGVib29rRWRpdG9yLmNvZGVFZGl0b3JzKSB7XG5cdFx0XHRcdFx0XHRlZGl0b3JzLnB1c2goY29kZUVkaXRvcik7XG5cdFx0XHRcdFx0XHRmb3VuZCA9IGNvZGVFZGl0b3IgPT09IG5ld1Nlc3Npb25FZGl0b3IgfHwgZm91bmQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChmb3VuZCkge1xuXHRcdFx0XHRcdFx0Ly8gZm91bmQgdGhlIHRoaXMgZWRpdG9yIGluIHRoZSBvdXRlciBub3RlYm9vayBlZGl0b3IgLT4gbWFrZSBzdXJlIHRvXG5cdFx0XHRcdFx0XHQvLyBjYW5jZWwgYWxsIHNpYmxpbmcgc2Vzc2lvbnNcblx0XHRcdFx0XHRcdGZvciAoY29uc3QgZWRpdG9yIG9mIGVkaXRvcnMpIHtcblx0XHRcdFx0XHRcdFx0aWYgKGVkaXRvciAhPT0gbmV3U2Vzc2lvbkVkaXRvcikge1xuXHRcdFx0XHRcdFx0XHRcdElubGluZUNoYXRDb250cm9sbGVyLmdldChlZGl0b3IpPy5hY2NlcHRTZXNzaW9uKCk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fc3RvcmUuZGlzcG9zZSgpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsZUFBZTtBQUN4QixTQUFTLGVBQWU7QUFFeEIsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxpQ0FBaUM7QUFDMUMsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsbUNBQW1DO0FBRXJDLElBQU0saUNBQU4sTUFBcUM7QUFBQSxFQUkzQyxZQUM0QixnQkFDWCxlQUNRLHVCQUN2QjtBQU5GLFNBQWlCLFNBQVMsSUFBSSxnQkFBZ0I7QUFRN0MsU0FBSyxPQUFPLElBQUksZUFBZSwyQkFBMkIsUUFBUSxvQkFBb0I7QUFBQSxNQUNyRixrQkFBa0IsQ0FBQyxRQUFRLFFBQVE7QUFDbEMsY0FBTSxPQUFPLFFBQVEsTUFBTSxHQUFHO0FBQzlCLFlBQUksQ0FBQyxNQUFNO0FBQ1YsZ0JBQU0sYUFBYSw0QkFBNEI7QUFBQSxRQUNoRDtBQUNBLFlBQUk7QUFDSixtQkFBVyxrQkFBa0Isc0JBQXNCLG9CQUFvQixHQUFHO0FBQ3pFLGNBQUksZUFBZSxTQUFTLEtBQUssUUFBUSxlQUFlLFVBQVUsS0FBSyxLQUFLLFFBQVEsR0FBRztBQUV0RixrQkFBTSxZQUFZLGFBQWEsZUFBZSxNQUFNLENBQUMsSUFBSSxHQUFHO0FBRTVELGdCQUFJLENBQUMsVUFBVTtBQUNkLHlCQUFXO0FBQUEsWUFDWjtBQUdBLGdCQUFJLGVBQWUsWUFBWSxLQUFLLENBQUMsVUFBVSxNQUFNLENBQUMsTUFBTSxNQUFNLEdBQUc7QUFDcEUscUJBQU87QUFBQSxZQUNSO0FBQUEsVUFVRDtBQUFBLFFBQ0Q7QUFFQSxZQUFJLFVBQVU7QUFDYixpQkFBTztBQUFBLFFBQ1I7QUFFQSxjQUFNLGVBQWUsY0FBYztBQUNuQyxZQUFJLGlCQUFpQixhQUFhLE1BQU0sTUFBTSx1QkFBdUIsTUFBTSxhQUFhLE1BQU0sTUFBTSw0QkFBNEIsS0FBSztBQUNwSSxpQkFBTyxhQUFhLE9BQU8sTUFBTSxDQUFDLElBQUksR0FBRztBQUFBLFFBQzFDO0FBRUEsY0FBTSxhQUFhLDBCQUEwQjtBQUFBLE1BQzlDO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFFRixTQUFLLE9BQU8sSUFBSSxlQUFlLG1CQUFtQixzQkFBb0I7QUFDckUsWUFBTSxZQUFZLFFBQVEsTUFBTSxpQkFBaUIsU0FBUyxFQUFFLEdBQUc7QUFDL0QsVUFBSSxDQUFDLFdBQVc7QUFDZjtBQUFBLE1BQ0Q7QUFDQSxpQkFBVyxrQkFBa0Isc0JBQXNCLG9CQUFvQixHQUFHO0FBQ3pFLFlBQUksUUFBUSxlQUFlLFdBQVcsS0FBSyxVQUFVLFFBQVEsR0FBRztBQUMvRCxjQUFJLFFBQVE7QUFDWixnQkFBTSxVQUF5QixDQUFDO0FBQ2hDLHFCQUFXLENBQUMsRUFBRSxVQUFVLEtBQUssZUFBZSxhQUFhO0FBQ3hELG9CQUFRLEtBQUssVUFBVTtBQUN2QixvQkFBUSxlQUFlLG9CQUFvQjtBQUFBLFVBQzVDO0FBQ0EsY0FBSSxPQUFPO0FBR1YsdUJBQVcsVUFBVSxTQUFTO0FBQzdCLGtCQUFJLFdBQVcsa0JBQWtCO0FBQ2hDLHFDQUFxQixJQUFJLE1BQU0sR0FBRyxjQUFjO0FBQUEsY0FDakQ7QUFBQSxZQUNEO0FBQ0E7QUFBQSxVQUNEO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxJQUNELENBQUMsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUVBLFVBQWdCO0FBQ2YsU0FBSyxPQUFPLFFBQVE7QUFBQSxFQUNyQjtBQUNEO0FBdEZhLGlDQUFOO0FBQUEsRUFLSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FQVTsiLAogICJuYW1lcyI6IFtdCn0K
