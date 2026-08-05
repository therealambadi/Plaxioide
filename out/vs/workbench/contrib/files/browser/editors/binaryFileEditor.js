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
import { localize } from "../../../../../nls.js";
import { BaseBinaryResourceEditor } from "../../../../browser/parts/editor/binaryEditor.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { FileEditorInput } from "./fileEditorInput.js";
import { BINARY_FILE_EDITOR_ID, BINARY_TEXT_FILE_MODE } from "../../common/files.js";
import { IStorageService } from "../../../../../platform/storage/common/storage.js";
import { EditorResolution } from "../../../../../platform/editor/common/editor.js";
import { IEditorResolverService, ResolvedStatus } from "../../../../services/editor/common/editorResolverService.js";
import { isEditorInputWithOptions } from "../../../../common/editor.js";
import { DiffEditorInput } from "../../../../common/editor/diffEditorInput.js";
let BinaryFileEditor = class extends BaseBinaryResourceEditor {
  constructor(group, telemetryService, themeService, editorResolverService, storageService) {
    super(
      BinaryFileEditor.ID,
      group,
      {
        openInternal: (input, options) => this.openInternal(input, options)
      },
      telemetryService,
      themeService,
      storageService
    );
    this.editorResolverService = editorResolverService;
  }
  async openInternal(input, options) {
    if (input instanceof FileEditorInput && this.group.activeEditor) {
      const activeEditor = this.group.activeEditor;
      const untypedActiveEditor = activeEditor?.toUntyped();
      if (!untypedActiveEditor) {
        return;
      }
      let resolvedEditor = await this.editorResolverService.resolveEditor({
        ...untypedActiveEditor,
        options: {
          ...options,
          override: EditorResolution.PICK
        }
      }, this.group);
      if (resolvedEditor === ResolvedStatus.NONE) {
        resolvedEditor = void 0;
      } else if (resolvedEditor === ResolvedStatus.ABORT) {
        return;
      }
      if (isEditorInputWithOptions(resolvedEditor)) {
        for (const editor of resolvedEditor.editor instanceof DiffEditorInput ? [resolvedEditor.editor.original, resolvedEditor.editor.modified] : [resolvedEditor.editor]) {
          if (editor instanceof FileEditorInput) {
            editor.setForceOpenAsText();
            editor.setPreferredLanguageId(BINARY_TEXT_FILE_MODE);
          }
        }
      }
      await this.group.replaceEditors([{
        editor: activeEditor,
        replacement: resolvedEditor?.editor ?? input,
        options: {
          ...resolvedEditor?.options ?? options
        }
      }]);
    }
  }
  getTitle() {
    return this.input ? this.input.getName() : localize("binaryFileEditor", "Binary File Viewer");
  }
};
BinaryFileEditor.ID = BINARY_FILE_EDITOR_ID;
BinaryFileEditor = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IEditorResolverService),
  __decorateParam(4, IStorageService)
], BinaryFileEditor);
export {
  BinaryFileEditor
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9maWxlcy9icm93c2VyL2VkaXRvcnMvYmluYXJ5RmlsZUVkaXRvci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IEJhc2VCaW5hcnlSZXNvdXJjZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvZWRpdG9yL2JpbmFyeUVkaXRvci5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci9lZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBGaWxlRWRpdG9ySW5wdXQgfSBmcm9tICcuL2ZpbGVFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBCSU5BUllfRklMRV9FRElUT1JfSUQsIEJJTkFSWV9URVhUX0ZJTEVfTU9ERSB9IGZyb20gJy4uLy4uL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IEVkaXRvclJlc29sdXRpb24sIElFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZWRpdG9yL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSUVkaXRvclJlc29sdmVyU2VydmljZSwgUmVzb2x2ZWRTdGF0dXMsIFJlc29sdmVkRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JSZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgaXNFZGl0b3JJbnB1dFdpdGhPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBEaWZmRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vZWRpdG9yL2RpZmZFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yR3JvdXAgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvckdyb3Vwc1NlcnZpY2UuanMnO1xuXG4vKipcbiAqIEFuIGltcGxlbWVudGF0aW9uIG9mIGVkaXRvciBmb3IgYmluYXJ5IGZpbGVzIHRoYXQgY2Fubm90IGJlIGRpc3BsYXllZC5cbiAqL1xuZXhwb3J0IGNsYXNzIEJpbmFyeUZpbGVFZGl0b3IgZXh0ZW5kcyBCYXNlQmluYXJ5UmVzb3VyY2VFZGl0b3Ige1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9IEJJTkFSWV9GSUxFX0VESVRPUl9JRDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRncm91cDogSUVkaXRvckdyb3VwLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElFZGl0b3JSZXNvbHZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlZGl0b3JSZXNvbHZlclNlcnZpY2U6IElFZGl0b3JSZXNvbHZlclNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKFxuXHRcdFx0QmluYXJ5RmlsZUVkaXRvci5JRCxcblx0XHRcdGdyb3VwLFxuXHRcdFx0e1xuXHRcdFx0XHRvcGVuSW50ZXJuYWw6IChpbnB1dCwgb3B0aW9ucykgPT4gdGhpcy5vcGVuSW50ZXJuYWwoaW5wdXQsIG9wdGlvbnMpXG5cdFx0XHR9LFxuXHRcdFx0dGVsZW1ldHJ5U2VydmljZSxcblx0XHRcdHRoZW1lU2VydmljZSxcblx0XHRcdHN0b3JhZ2VTZXJ2aWNlXG5cdFx0KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgb3BlbkludGVybmFsKGlucHV0OiBFZGl0b3JJbnB1dCwgb3B0aW9uczogSUVkaXRvck9wdGlvbnMgfCB1bmRlZmluZWQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoaW5wdXQgaW5zdGFuY2VvZiBGaWxlRWRpdG9ySW5wdXQgJiYgdGhpcy5ncm91cC5hY3RpdmVFZGl0b3IpIHtcblxuXHRcdFx0Ly8gV2Ugb3BlcmF0ZSBvbiB0aGUgYWN0aXZlIGVkaXRvciBoZXJlIHRvIHN1cHBvcnQgcmUtb3BlbmluZ1xuXHRcdFx0Ly8gZGlmZiBlZGl0b3JzIHdoZXJlIGBpbnB1dGAgbWF5IGp1c3QgYmUgb25lIHNpZGUgb2YgdGhlXG5cdFx0XHQvLyBkaWZmIGVkaXRvci5cblx0XHRcdC8vIFNpbmNlIGBvcGVuSW50ZXJuYWxgIGNhbiBvbmx5IGV2ZXIgYmUgc2VsZWN0ZWQgZnJvbSB0aGVcblx0XHRcdC8vIGFjdGl2ZSBlZGl0b3Igb2YgdGhlIGdyb3VwLCB0aGlzIGlzIGEgc2FmZSBhc3N1bXB0aW9uLlxuXHRcdFx0Ly8gKGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMjQyMjIpXG5cdFx0XHRjb25zdCBhY3RpdmVFZGl0b3IgPSB0aGlzLmdyb3VwLmFjdGl2ZUVkaXRvcjtcblx0XHRcdGNvbnN0IHVudHlwZWRBY3RpdmVFZGl0b3IgPSBhY3RpdmVFZGl0b3I/LnRvVW50eXBlZCgpO1xuXHRcdFx0aWYgKCF1bnR5cGVkQWN0aXZlRWRpdG9yKSB7XG5cdFx0XHRcdHJldHVybjsgLy8gd2UgbmVlZCB1bnR5cGVkIGVkaXRvciBzdXBwb3J0XG5cdFx0XHR9XG5cblx0XHRcdC8vIFRyeSB0byBsZXQgdGhlIHVzZXIgcGljayBhbiBlZGl0b3Jcblx0XHRcdGxldCByZXNvbHZlZEVkaXRvcjogUmVzb2x2ZWRFZGl0b3IgfCB1bmRlZmluZWQgPSBhd2FpdCB0aGlzLmVkaXRvclJlc29sdmVyU2VydmljZS5yZXNvbHZlRWRpdG9yKHtcblx0XHRcdFx0Li4udW50eXBlZEFjdGl2ZUVkaXRvcixcblx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdC4uLm9wdGlvbnMsXG5cdFx0XHRcdFx0b3ZlcnJpZGU6IEVkaXRvclJlc29sdXRpb24uUElDS1xuXHRcdFx0XHR9XG5cdFx0XHR9LCB0aGlzLmdyb3VwKTtcblxuXHRcdFx0aWYgKHJlc29sdmVkRWRpdG9yID09PSBSZXNvbHZlZFN0YXR1cy5OT05FKSB7XG5cdFx0XHRcdHJlc29sdmVkRWRpdG9yID0gdW5kZWZpbmVkO1xuXHRcdFx0fSBlbHNlIGlmIChyZXNvbHZlZEVkaXRvciA9PT0gUmVzb2x2ZWRTdGF0dXMuQUJPUlQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBJZiB0aGUgcmVzdWx0IGlmIGEgZmlsZSBlZGl0b3IsIHRoZSB1c2VyIGluZGljYXRlZCB0byBvcGVuXG5cdFx0XHQvLyB0aGUgYmluYXJ5IGZpbGUgYXMgdGV4dC4gQXMgc3VjaCB3ZSBhZGp1c3QgdGhlIGlucHV0IGZvciB0aGF0LlxuXHRcdFx0aWYgKGlzRWRpdG9ySW5wdXRXaXRoT3B0aW9ucyhyZXNvbHZlZEVkaXRvcikpIHtcblx0XHRcdFx0Zm9yIChjb25zdCBlZGl0b3Igb2YgcmVzb2x2ZWRFZGl0b3IuZWRpdG9yIGluc3RhbmNlb2YgRGlmZkVkaXRvcklucHV0ID8gW3Jlc29sdmVkRWRpdG9yLmVkaXRvci5vcmlnaW5hbCwgcmVzb2x2ZWRFZGl0b3IuZWRpdG9yLm1vZGlmaWVkXSA6IFtyZXNvbHZlZEVkaXRvci5lZGl0b3JdKSB7XG5cdFx0XHRcdFx0aWYgKGVkaXRvciBpbnN0YW5jZW9mIEZpbGVFZGl0b3JJbnB1dCkge1xuXHRcdFx0XHRcdFx0ZWRpdG9yLnNldEZvcmNlT3BlbkFzVGV4dCgpO1xuXHRcdFx0XHRcdFx0ZWRpdG9yLnNldFByZWZlcnJlZExhbmd1YWdlSWQoQklOQVJZX1RFWFRfRklMRV9NT0RFKTsgLy8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEzMTA3NlxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBSZXBsYWNlIHRoZSBhY3RpdmUgZWRpdG9yIHdpdGggdGhlIHBpY2tlZCBvbmVcblx0XHRcdGF3YWl0IHRoaXMuZ3JvdXAucmVwbGFjZUVkaXRvcnMoW3tcblx0XHRcdFx0ZWRpdG9yOiBhY3RpdmVFZGl0b3IsXG5cdFx0XHRcdHJlcGxhY2VtZW50OiByZXNvbHZlZEVkaXRvcj8uZWRpdG9yID8/IGlucHV0LFxuXHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0Li4ucmVzb2x2ZWRFZGl0b3I/Lm9wdGlvbnMgPz8gb3B0aW9uc1xuXHRcdFx0XHR9XG5cdFx0XHR9XSk7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgZ2V0VGl0bGUoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5pbnB1dCA/IHRoaXMuaW5wdXQuZ2V0TmFtZSgpIDogbG9jYWxpemUoJ2JpbmFyeUZpbGVFZGl0b3InLCBcIkJpbmFyeSBGaWxlIFZpZXdlclwiKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGdDQUFnQztBQUN6QyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHFCQUFxQjtBQUU5QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHVCQUF1Qiw2QkFBNkI7QUFDN0QsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyx3QkFBd0M7QUFDakQsU0FBUyx3QkFBd0Isc0JBQXNDO0FBQ3ZFLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsdUJBQXVCO0FBTXpCLElBQU0sbUJBQU4sY0FBK0IseUJBQXlCO0FBQUEsRUFJOUQsWUFDQyxPQUNtQixrQkFDSixjQUMwQix1QkFDeEIsZ0JBQ2hCO0FBQ0Q7QUFBQSxNQUNDLGlCQUFpQjtBQUFBLE1BQ2pCO0FBQUEsTUFDQTtBQUFBLFFBQ0MsY0FBYyxDQUFDLE9BQU8sWUFBWSxLQUFLLGFBQWEsT0FBTyxPQUFPO0FBQUEsTUFDbkU7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBWnlDO0FBQUEsRUFhMUM7QUFBQSxFQUVBLE1BQWMsYUFBYSxPQUFvQixTQUFvRDtBQUNsRyxRQUFJLGlCQUFpQixtQkFBbUIsS0FBSyxNQUFNLGNBQWM7QUFRaEUsWUFBTSxlQUFlLEtBQUssTUFBTTtBQUNoQyxZQUFNLHNCQUFzQixjQUFjLFVBQVU7QUFDcEQsVUFBSSxDQUFDLHFCQUFxQjtBQUN6QjtBQUFBLE1BQ0Q7QUFHQSxVQUFJLGlCQUE2QyxNQUFNLEtBQUssc0JBQXNCLGNBQWM7QUFBQSxRQUMvRixHQUFHO0FBQUEsUUFDSCxTQUFTO0FBQUEsVUFDUixHQUFHO0FBQUEsVUFDSCxVQUFVLGlCQUFpQjtBQUFBLFFBQzVCO0FBQUEsTUFDRCxHQUFHLEtBQUssS0FBSztBQUViLFVBQUksbUJBQW1CLGVBQWUsTUFBTTtBQUMzQyx5QkFBaUI7QUFBQSxNQUNsQixXQUFXLG1CQUFtQixlQUFlLE9BQU87QUFDbkQ7QUFBQSxNQUNEO0FBSUEsVUFBSSx5QkFBeUIsY0FBYyxHQUFHO0FBQzdDLG1CQUFXLFVBQVUsZUFBZSxrQkFBa0Isa0JBQWtCLENBQUMsZUFBZSxPQUFPLFVBQVUsZUFBZSxPQUFPLFFBQVEsSUFBSSxDQUFDLGVBQWUsTUFBTSxHQUFHO0FBQ25LLGNBQUksa0JBQWtCLGlCQUFpQjtBQUN0QyxtQkFBTyxtQkFBbUI7QUFDMUIsbUJBQU8sdUJBQXVCLHFCQUFxQjtBQUFBLFVBQ3BEO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFHQSxZQUFNLEtBQUssTUFBTSxlQUFlLENBQUM7QUFBQSxRQUNoQyxRQUFRO0FBQUEsUUFDUixhQUFhLGdCQUFnQixVQUFVO0FBQUEsUUFDdkMsU0FBUztBQUFBLFVBQ1IsR0FBRyxnQkFBZ0IsV0FBVztBQUFBLFFBQy9CO0FBQUEsTUFDRCxDQUFDLENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDRDtBQUFBLEVBRVMsV0FBbUI7QUFDM0IsV0FBTyxLQUFLLFFBQVEsS0FBSyxNQUFNLFFBQVEsSUFBSSxTQUFTLG9CQUFvQixvQkFBb0I7QUFBQSxFQUM3RjtBQUNEO0FBOUVhLGlCQUVJLEtBQUs7QUFGVCxtQkFBTjtBQUFBLEVBTUo7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQVRVOyIsCiAgIm5hbWVzIjogW10KfQo=
