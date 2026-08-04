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
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { registerSingleton, InstantiationType } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { ITextFileService } from "../../../services/textfile/common/textfiles.js";
const IVoidModelService = createDecorator("voidVoidModelService");
let VoidModelService = class extends Disposable {
  constructor(_textModelService, _textFileService) {
    super();
    this._textModelService = _textModelService;
    this._textFileService = _textFileService;
    this._modelRefOfURI = {};
    this.saveModel = async (uri) => {
      await this._textFileService.save(uri, {
        // we want [our change] -> [save] so it's all treated as one change.
        skipSaveParticipants: true
        // avoid triggering extensions etc (if they reformat the page, it will add another item to the undo stack)
      });
    };
    this.initializeModel = async (uri) => {
      try {
        if (uri.fsPath in this._modelRefOfURI) return;
        const editorModelRef = await this._textModelService.createModelReference(uri);
        this._modelRefOfURI[uri.fsPath] = editorModelRef;
      } catch (e) {
        console.log("InitializeModel error:", e);
      }
    };
    this.getModelFromFsPath = (fsPath) => {
      const editorModelRef = this._modelRefOfURI[fsPath];
      if (!editorModelRef) {
        return { model: null, editorModel: null };
      }
      const model = editorModelRef.object.textEditorModel;
      if (!model) {
        return { model: null, editorModel: editorModelRef.object };
      }
      return { model, editorModel: editorModelRef.object };
    };
    this.getModel = (uri) => {
      return this.getModelFromFsPath(uri.fsPath);
    };
    this.getModelSafe = async (uri) => {
      if (!(uri.fsPath in this._modelRefOfURI)) await this.initializeModel(uri);
      return this.getModel(uri);
    };
  }
  dispose() {
    super.dispose();
    for (const ref of Object.values(this._modelRefOfURI)) {
      ref.dispose();
    }
  }
};
VoidModelService.ID = "voidVoidModelService";
VoidModelService = __decorateClass([
  __decorateParam(0, ITextModelService),
  __decorateParam(1, ITextFileService)
], VoidModelService);
registerSingleton(IVoidModelService, VoidModelService, InstantiationType.Eager);
export {
  IVoidModelService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2NvbW1vbi92b2lkTW9kZWxTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgeyBEaXNwb3NhYmxlLCBJUmVmZXJlbmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJUmVzb2x2ZWRUZXh0RWRpdG9yTW9kZWwsIElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJTaW5nbGV0b24sIEluc3RhbnRpYXRpb25UeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVEZWNvcmF0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElUZXh0RmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy90ZXh0ZmlsZS9jb21tb24vdGV4dGZpbGVzLmpzJztcblxudHlwZSBWb2lkTW9kZWxUeXBlID0ge1xuXHRtb2RlbDogSVRleHRNb2RlbCB8IG51bGw7XG5cdGVkaXRvck1vZGVsOiBJUmVzb2x2ZWRUZXh0RWRpdG9yTW9kZWwgfCBudWxsO1xufTtcblxuZXhwb3J0IGludGVyZmFjZSBJVm9pZE1vZGVsU2VydmljZSB7XG5cdHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0aW5pdGlhbGl6ZU1vZGVsKHVyaTogVVJJKTogUHJvbWlzZTx2b2lkPjtcblx0Z2V0TW9kZWwodXJpOiBVUkkpOiBWb2lkTW9kZWxUeXBlO1xuXHRnZXRNb2RlbEZyb21Gc1BhdGgoZnNQYXRoOiBzdHJpbmcpOiBWb2lkTW9kZWxUeXBlO1xuXHRnZXRNb2RlbFNhZmUodXJpOiBVUkkpOiBQcm9taXNlPFZvaWRNb2RlbFR5cGU+O1xuXHRzYXZlTW9kZWwodXJpOiBVUkkpOiBQcm9taXNlPHZvaWQ+O1xuXG59XG5cbmV4cG9ydCBjb25zdCBJVm9pZE1vZGVsU2VydmljZSA9IGNyZWF0ZURlY29yYXRvcjxJVm9pZE1vZGVsU2VydmljZT4oJ3ZvaWRWb2lkTW9kZWxTZXJ2aWNlJyk7XG5cbmNsYXNzIFZvaWRNb2RlbFNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVZvaWRNb2RlbFNlcnZpY2Uge1xuXHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd2b2lkVm9pZE1vZGVsU2VydmljZSc7XG5cdHByaXZhdGUgcmVhZG9ubHkgX21vZGVsUmVmT2ZVUkk6IFJlY29yZDxzdHJpbmcsIElSZWZlcmVuY2U8SVJlc29sdmVkVGV4dEVkaXRvck1vZGVsPj4gPSB7fTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVRleHRNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGV4dE1vZGVsU2VydmljZTogSVRleHRNb2RlbFNlcnZpY2UsXG5cdFx0QElUZXh0RmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGV4dEZpbGVTZXJ2aWNlOiBJVGV4dEZpbGVTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0c2F2ZU1vZGVsID0gYXN5bmMgKHVyaTogVVJJKSA9PiB7XG5cdFx0YXdhaXQgdGhpcy5fdGV4dEZpbGVTZXJ2aWNlLnNhdmUodXJpLCB7IC8vIHdlIHdhbnQgW291ciBjaGFuZ2VdIC0+IFtzYXZlXSBzbyBpdCdzIGFsbCB0cmVhdGVkIGFzIG9uZSBjaGFuZ2UuXG5cdFx0XHRza2lwU2F2ZVBhcnRpY2lwYW50czogdHJ1ZSAvLyBhdm9pZCB0cmlnZ2VyaW5nIGV4dGVuc2lvbnMgZXRjIChpZiB0aGV5IHJlZm9ybWF0IHRoZSBwYWdlLCBpdCB3aWxsIGFkZCBhbm90aGVyIGl0ZW0gdG8gdGhlIHVuZG8gc3RhY2spXG5cdFx0fSlcblx0fVxuXG5cdGluaXRpYWxpemVNb2RlbCA9IGFzeW5jICh1cmk6IFVSSSkgPT4ge1xuXHRcdHRyeSB7XG5cdFx0XHRpZiAodXJpLmZzUGF0aCBpbiB0aGlzLl9tb2RlbFJlZk9mVVJJKSByZXR1cm47XG5cdFx0XHRjb25zdCBlZGl0b3JNb2RlbFJlZiA9IGF3YWl0IHRoaXMuX3RleHRNb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWxSZWZlcmVuY2UodXJpKTtcblx0XHRcdC8vIEtlZXAgYSBzdHJvbmcgcmVmZXJlbmNlIHRvIHByZXZlbnQgZGlzcG9zYWxcblx0XHRcdHRoaXMuX21vZGVsUmVmT2ZVUklbdXJpLmZzUGF0aF0gPSBlZGl0b3JNb2RlbFJlZjtcblx0XHR9XG5cdFx0Y2F0Y2ggKGUpIHtcblx0XHRcdGNvbnNvbGUubG9nKCdJbml0aWFsaXplTW9kZWwgZXJyb3I6JywgZSlcblx0XHR9XG5cdH07XG5cblx0Z2V0TW9kZWxGcm9tRnNQYXRoID0gKGZzUGF0aDogc3RyaW5nKTogVm9pZE1vZGVsVHlwZSA9PiB7XG5cdFx0Y29uc3QgZWRpdG9yTW9kZWxSZWYgPSB0aGlzLl9tb2RlbFJlZk9mVVJJW2ZzUGF0aF07XG5cdFx0aWYgKCFlZGl0b3JNb2RlbFJlZikge1xuXHRcdFx0cmV0dXJuIHsgbW9kZWw6IG51bGwsIGVkaXRvck1vZGVsOiBudWxsIH07XG5cdFx0fVxuXG5cdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3JNb2RlbFJlZi5vYmplY3QudGV4dEVkaXRvck1vZGVsO1xuXG5cdFx0aWYgKCFtb2RlbCkge1xuXHRcdFx0cmV0dXJuIHsgbW9kZWw6IG51bGwsIGVkaXRvck1vZGVsOiBlZGl0b3JNb2RlbFJlZi5vYmplY3QgfTtcblx0XHR9XG5cblx0XHRyZXR1cm4geyBtb2RlbCwgZWRpdG9yTW9kZWw6IGVkaXRvck1vZGVsUmVmLm9iamVjdCB9O1xuXHR9O1xuXG5cdGdldE1vZGVsID0gKHVyaTogVVJJKSA9PiB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0TW9kZWxGcm9tRnNQYXRoKHVyaS5mc1BhdGgpXG5cdH1cblxuXG5cdGdldE1vZGVsU2FmZSA9IGFzeW5jICh1cmk6IFVSSSk6IFByb21pc2U8Vm9pZE1vZGVsVHlwZT4gPT4ge1xuXHRcdGlmICghKHVyaS5mc1BhdGggaW4gdGhpcy5fbW9kZWxSZWZPZlVSSSkpIGF3YWl0IHRoaXMuaW5pdGlhbGl6ZU1vZGVsKHVyaSk7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0TW9kZWwodXJpKTtcblxuXHR9O1xuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKSB7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHRcdGZvciAoY29uc3QgcmVmIG9mIE9iamVjdC52YWx1ZXModGhpcy5fbW9kZWxSZWZPZlVSSSkpIHtcblx0XHRcdHJlZi5kaXNwb3NlKCk7IC8vIHJlbGVhc2UgcmVmZXJlbmNlIHRvIGFsbG93IGRpc3Bvc2FsXG5cdFx0fVxuXHR9XG59XG5cbnJlZ2lzdGVyU2luZ2xldG9uKElWb2lkTW9kZWxTZXJ2aWNlLCBWb2lkTW9kZWxTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5FYWdlcik7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUFBLFNBQVMsa0JBQThCO0FBR3ZDLFNBQW1DLHlCQUF5QjtBQUM1RCxTQUFTLG1CQUFtQix5QkFBeUI7QUFDckQsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyx3QkFBd0I7QUFpQjFCLE1BQU0sb0JBQW9CLGdCQUFtQyxzQkFBc0I7QUFFMUYsSUFBTSxtQkFBTixjQUErQixXQUF3QztBQUFBLEVBS3RFLFlBQ3FDLG1CQUNELGtCQUNsQztBQUNELFVBQU07QUFIOEI7QUFDRDtBQUpwQyxTQUFpQixpQkFBdUUsQ0FBQztBQVN6RixxQkFBWSxPQUFPLFFBQWE7QUFDL0IsWUFBTSxLQUFLLGlCQUFpQixLQUFLLEtBQUs7QUFBQTtBQUFBLFFBQ3JDLHNCQUFzQjtBQUFBO0FBQUEsTUFDdkIsQ0FBQztBQUFBLElBQ0Y7QUFFQSwyQkFBa0IsT0FBTyxRQUFhO0FBQ3JDLFVBQUk7QUFDSCxZQUFJLElBQUksVUFBVSxLQUFLLGVBQWdCO0FBQ3ZDLGNBQU0saUJBQWlCLE1BQU0sS0FBSyxrQkFBa0IscUJBQXFCLEdBQUc7QUFFNUUsYUFBSyxlQUFlLElBQUksTUFBTSxJQUFJO0FBQUEsTUFDbkMsU0FDTyxHQUFHO0FBQ1QsZ0JBQVEsSUFBSSwwQkFBMEIsQ0FBQztBQUFBLE1BQ3hDO0FBQUEsSUFDRDtBQUVBLDhCQUFxQixDQUFDLFdBQWtDO0FBQ3ZELFlBQU0saUJBQWlCLEtBQUssZUFBZSxNQUFNO0FBQ2pELFVBQUksQ0FBQyxnQkFBZ0I7QUFDcEIsZUFBTyxFQUFFLE9BQU8sTUFBTSxhQUFhLEtBQUs7QUFBQSxNQUN6QztBQUVBLFlBQU0sUUFBUSxlQUFlLE9BQU87QUFFcEMsVUFBSSxDQUFDLE9BQU87QUFDWCxlQUFPLEVBQUUsT0FBTyxNQUFNLGFBQWEsZUFBZSxPQUFPO0FBQUEsTUFDMUQ7QUFFQSxhQUFPLEVBQUUsT0FBTyxhQUFhLGVBQWUsT0FBTztBQUFBLElBQ3BEO0FBRUEsb0JBQVcsQ0FBQyxRQUFhO0FBQ3hCLGFBQU8sS0FBSyxtQkFBbUIsSUFBSSxNQUFNO0FBQUEsSUFDMUM7QUFHQSx3QkFBZSxPQUFPLFFBQXFDO0FBQzFELFVBQUksRUFBRSxJQUFJLFVBQVUsS0FBSyxnQkFBaUIsT0FBTSxLQUFLLGdCQUFnQixHQUFHO0FBQ3hFLGFBQU8sS0FBSyxTQUFTLEdBQUc7QUFBQSxJQUV6QjtBQUFBLEVBNUNBO0FBQUEsRUE4Q1MsVUFBVTtBQUNsQixVQUFNLFFBQVE7QUFDZCxlQUFXLE9BQU8sT0FBTyxPQUFPLEtBQUssY0FBYyxHQUFHO0FBQ3JELFVBQUksUUFBUTtBQUFBLElBQ2I7QUFBQSxFQUNEO0FBQ0Q7QUE5RE0saUJBRVcsS0FBSztBQUZoQixtQkFBTjtBQUFBLEVBTUc7QUFBQSxFQUNBO0FBQUEsR0FQRztBQWdFTixrQkFBa0IsbUJBQW1CLGtCQUFrQixrQkFBa0IsS0FBSzsiLAogICJuYW1lcyI6IFtdCn0K
