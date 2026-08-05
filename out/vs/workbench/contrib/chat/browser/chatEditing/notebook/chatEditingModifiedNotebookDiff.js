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
import { DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { computeDiff } from "../../../../notebook/common/notebookDiff.js";
import { INotebookEditorModelResolverService } from "../../../../notebook/common/notebookEditorModelResolverService.js";
import { INotebookLoggingService } from "../../../../notebook/common/notebookLoggingService.js";
import { INotebookEditorWorkerService } from "../../../../notebook/common/services/notebookWorkerService.js";
let ChatEditingModifiedNotebookDiff = class {
  constructor(original, modified, notebookEditorWorkerService, notebookLoggingService, notebookEditorModelService) {
    this.original = original;
    this.modified = modified;
    this.notebookEditorWorkerService = notebookEditorWorkerService;
    this.notebookLoggingService = notebookLoggingService;
    this.notebookEditorModelService = notebookEditorModelService;
  }
  async computeDiff() {
    let added = 0;
    let removed = 0;
    const disposables = new DisposableStore();
    try {
      const [modifiedRef, originalRef] = await Promise.all([
        this.notebookEditorModelService.resolve(this.modified.snapshotUri),
        this.notebookEditorModelService.resolve(this.original.snapshotUri)
      ]);
      disposables.add(modifiedRef);
      disposables.add(originalRef);
      const notebookDiff = await this.notebookEditorWorkerService.computeDiff(this.original.snapshotUri, this.modified.snapshotUri);
      const result = computeDiff(originalRef.object.notebook, modifiedRef.object.notebook, notebookDiff);
      result.cellDiffInfo.forEach((diff) => {
        switch (diff.type) {
          case "modified":
          case "insert":
            added++;
            break;
          case "delete":
            removed++;
            break;
          default:
            break;
        }
      });
    } catch (e) {
      this.notebookLoggingService.error("Notebook Chat", "Error computing diff:\n" + e);
    } finally {
      disposables.dispose();
    }
    return {
      added,
      removed,
      identical: added === 0 && removed === 0,
      quitEarly: false,
      modifiedURI: this.modified.snapshotUri,
      originalURI: this.original.snapshotUri
    };
  }
};
ChatEditingModifiedNotebookDiff.NewModelCounter = 0;
ChatEditingModifiedNotebookDiff = __decorateClass([
  __decorateParam(2, INotebookEditorWorkerService),
  __decorateParam(3, INotebookLoggingService),
  __decorateParam(4, INotebookEditorModelResolverService)
], ChatEditingModifiedNotebookDiff);
export {
  ChatEditingModifiedNotebookDiff
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdEVkaXRpbmcvbm90ZWJvb2svY2hhdEVkaXRpbmdNb2RpZmllZE5vdGVib29rRGlmZi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBjb21wdXRlRGlmZiB9IGZyb20gJy4uLy4uLy4uLy4uL25vdGVib29rL2NvbW1vbi9ub3RlYm9va0RpZmYuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rRWRpdG9yTW9kZWxSZXNvbHZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9ub3RlYm9vay9jb21tb24vbm90ZWJvb2tFZGl0b3JNb2RlbFJlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tMb2dnaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL25vdGVib29rL2NvbW1vbi9ub3RlYm9va0xvZ2dpbmdTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0VkaXRvcldvcmtlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9ub3RlYm9vay9jb21tb24vc2VydmljZXMvbm90ZWJvb2tXb3JrZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0U2Vzc2lvbkVudHJ5RGlmZiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jaGF0RWRpdGluZ1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVNuYXBzaG90RW50cnkgfSBmcm9tICcuLi9jaGF0RWRpdGluZ01vZGlmaWVkRmlsZUVudHJ5LmpzJztcblxuZXhwb3J0IGNsYXNzIENoYXRFZGl0aW5nTW9kaWZpZWROb3RlYm9va0RpZmYge1xuXHRzdGF0aWMgTmV3TW9kZWxDb3VudGVyOiBudW1iZXIgPSAwO1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IG9yaWdpbmFsOiBJU25hcHNob3RFbnRyeSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IG1vZGlmaWVkOiBJU25hcHNob3RFbnRyeSxcblx0XHRASU5vdGVib29rRWRpdG9yV29ya2VyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGVib29rRWRpdG9yV29ya2VyU2VydmljZTogSU5vdGVib29rRWRpdG9yV29ya2VyU2VydmljZSxcblx0XHRASU5vdGVib29rTG9nZ2luZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBub3RlYm9va0xvZ2dpbmdTZXJ2aWNlOiBJTm90ZWJvb2tMb2dnaW5nU2VydmljZSxcblx0XHRASU5vdGVib29rRWRpdG9yTW9kZWxSZXNvbHZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBub3RlYm9va0VkaXRvck1vZGVsU2VydmljZTogSU5vdGVib29rRWRpdG9yTW9kZWxSZXNvbHZlclNlcnZpY2UsXG5cdCkge1xuXG5cdH1cblxuXHRhc3luYyBjb21wdXRlRGlmZigpOiBQcm9taXNlPElFZGl0U2Vzc2lvbkVudHJ5RGlmZj4ge1xuXG5cdFx0bGV0IGFkZGVkID0gMDtcblx0XHRsZXQgcmVtb3ZlZCA9IDA7XG5cblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgW21vZGlmaWVkUmVmLCBvcmlnaW5hbFJlZl0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG5cdFx0XHRcdHRoaXMubm90ZWJvb2tFZGl0b3JNb2RlbFNlcnZpY2UucmVzb2x2ZSh0aGlzLm1vZGlmaWVkLnNuYXBzaG90VXJpKSxcblx0XHRcdFx0dGhpcy5ub3RlYm9va0VkaXRvck1vZGVsU2VydmljZS5yZXNvbHZlKHRoaXMub3JpZ2luYWwuc25hcHNob3RVcmkpXG5cdFx0XHRdKTtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChtb2RpZmllZFJlZik7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQob3JpZ2luYWxSZWYpO1xuXHRcdFx0Y29uc3Qgbm90ZWJvb2tEaWZmID0gYXdhaXQgdGhpcy5ub3RlYm9va0VkaXRvcldvcmtlclNlcnZpY2UuY29tcHV0ZURpZmYodGhpcy5vcmlnaW5hbC5zbmFwc2hvdFVyaSwgdGhpcy5tb2RpZmllZC5zbmFwc2hvdFVyaSk7XG5cdFx0XHRjb25zdCByZXN1bHQgPSBjb21wdXRlRGlmZihvcmlnaW5hbFJlZi5vYmplY3Qubm90ZWJvb2ssIG1vZGlmaWVkUmVmLm9iamVjdC5ub3RlYm9vaywgbm90ZWJvb2tEaWZmKTtcblx0XHRcdHJlc3VsdC5jZWxsRGlmZkluZm8uZm9yRWFjaChkaWZmID0+IHtcblx0XHRcdFx0c3dpdGNoIChkaWZmLnR5cGUpIHtcblx0XHRcdFx0XHRjYXNlICdtb2RpZmllZCc6XG5cdFx0XHRcdFx0Y2FzZSAnaW5zZXJ0Jzpcblx0XHRcdFx0XHRcdGFkZGVkKys7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlICdkZWxldGUnOlxuXHRcdFx0XHRcdFx0cmVtb3ZlZCsrO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHR0aGlzLm5vdGVib29rTG9nZ2luZ1NlcnZpY2UuZXJyb3IoJ05vdGVib29rIENoYXQnLCAnRXJyb3IgY29tcHV0aW5nIGRpZmY6XFxuJyArIGUpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGFkZGVkLFxuXHRcdFx0cmVtb3ZlZCxcblx0XHRcdGlkZW50aWNhbDogYWRkZWQgPT09IDAgJiYgcmVtb3ZlZCA9PT0gMCxcblx0XHRcdHF1aXRFYXJseTogZmFsc2UsXG5cdFx0XHRtb2RpZmllZFVSSTogdGhpcy5tb2RpZmllZC5zbmFwc2hvdFVyaSxcblx0XHRcdG9yaWdpbmFsVVJJOiB0aGlzLm9yaWdpbmFsLnNuYXBzaG90VXJpLFxuXHRcdH07XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUywyQ0FBMkM7QUFDcEQsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyxvQ0FBb0M7QUFJdEMsSUFBTSxrQ0FBTixNQUFzQztBQUFBLEVBRTVDLFlBQ2tCLFVBQ0EsVUFDOEIsNkJBQ0wsd0JBQ1ksNEJBQ3JEO0FBTGdCO0FBQ0E7QUFDOEI7QUFDTDtBQUNZO0FBQUEsRUFHdkQ7QUFBQSxFQUVBLE1BQU0sY0FBOEM7QUFFbkQsUUFBSSxRQUFRO0FBQ1osUUFBSSxVQUFVO0FBRWQsVUFBTSxjQUFjLElBQUksZ0JBQWdCO0FBQ3hDLFFBQUk7QUFDSCxZQUFNLENBQUMsYUFBYSxXQUFXLElBQUksTUFBTSxRQUFRLElBQUk7QUFBQSxRQUNwRCxLQUFLLDJCQUEyQixRQUFRLEtBQUssU0FBUyxXQUFXO0FBQUEsUUFDakUsS0FBSywyQkFBMkIsUUFBUSxLQUFLLFNBQVMsV0FBVztBQUFBLE1BQ2xFLENBQUM7QUFDRCxrQkFBWSxJQUFJLFdBQVc7QUFDM0Isa0JBQVksSUFBSSxXQUFXO0FBQzNCLFlBQU0sZUFBZSxNQUFNLEtBQUssNEJBQTRCLFlBQVksS0FBSyxTQUFTLGFBQWEsS0FBSyxTQUFTLFdBQVc7QUFDNUgsWUFBTSxTQUFTLFlBQVksWUFBWSxPQUFPLFVBQVUsWUFBWSxPQUFPLFVBQVUsWUFBWTtBQUNqRyxhQUFPLGFBQWEsUUFBUSxVQUFRO0FBQ25DLGdCQUFRLEtBQUssTUFBTTtBQUFBLFVBQ2xCLEtBQUs7QUFBQSxVQUNMLEtBQUs7QUFDSjtBQUNBO0FBQUEsVUFDRCxLQUFLO0FBQ0o7QUFDQTtBQUFBLFVBQ0Q7QUFDQztBQUFBLFFBQ0Y7QUFBQSxNQUNELENBQUM7QUFBQSxJQUNGLFNBQVMsR0FBRztBQUNYLFdBQUssdUJBQXVCLE1BQU0saUJBQWlCLDRCQUE0QixDQUFDO0FBQUEsSUFDakYsVUFBRTtBQUNELGtCQUFZLFFBQVE7QUFBQSxJQUNyQjtBQUVBLFdBQU87QUFBQSxNQUNOO0FBQUEsTUFDQTtBQUFBLE1BQ0EsV0FBVyxVQUFVLEtBQUssWUFBWTtBQUFBLE1BQ3RDLFdBQVc7QUFBQSxNQUNYLGFBQWEsS0FBSyxTQUFTO0FBQUEsTUFDM0IsYUFBYSxLQUFLLFNBQVM7QUFBQSxJQUM1QjtBQUFBLEVBQ0Q7QUFDRDtBQXZEYSxnQ0FDTCxrQkFBMEI7QUFEckIsa0NBQU47QUFBQSxFQUtKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQVBVOyIsCiAgIm5hbWVzIjogW10KfQo=
