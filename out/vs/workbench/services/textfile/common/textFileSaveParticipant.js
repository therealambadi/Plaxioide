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
import { raceCancellation } from "../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { LinkedList } from "../../../../base/common/linkedList.js";
import { localize } from "../../../../nls.js";
import { NotificationPriority } from "../../../../platform/notification/common/notification.js";
import { CancellationError, isCancellationError } from "../../../../base/common/errors.js";
let TextFileSaveParticipant = class extends Disposable {
  constructor(logService, progressService) {
    super();
    this.logService = logService;
    this.progressService = progressService;
    this.saveParticipants = new LinkedList();
  }
  addSaveParticipant(participant) {
    const remove = this.saveParticipants.push(participant);
    return toDisposable(() => remove());
  }
  async participate(model, context, progress, token) {
    const cts = new CancellationTokenSource(token);
    model.textEditorModel?.pushStackElement();
    progress.report({
      message: localize("saveParticipants1", "Running Code Actions and Formatters...")
    });
    let bubbleCancel = false;
    await this.progressService.withProgress({
      priority: NotificationPriority.URGENT,
      location: ProgressLocation.Notification,
      cancellable: localize("skip", "Skip"),
      delay: model.isDirty() ? 5e3 : 3e3
    }, async (progress2) => {
      const participants = Array.from(this.saveParticipants).sort((a, b) => {
        const aValue = a.ordinal ?? 0;
        const bValue = b.ordinal ?? 0;
        return aValue - bValue;
      });
      for (const saveParticipant of participants) {
        if (cts.token.isCancellationRequested || !model.textEditorModel) {
          break;
        }
        try {
          const promise = saveParticipant.participate(model, context, progress2, cts.token);
          await raceCancellation(promise, cts.token);
        } catch (err) {
          if (!isCancellationError(err)) {
            this.logService.error(err);
          } else if (!cts.token.isCancellationRequested) {
            cts.cancel();
            bubbleCancel = true;
          }
        }
      }
    }, () => {
      cts.cancel();
    });
    model.textEditorModel?.pushStackElement();
    cts.dispose();
    if (bubbleCancel) {
      throw new CancellationError();
    }
  }
  dispose() {
    this.saveParticipants.clear();
    super.dispose();
  }
};
TextFileSaveParticipant = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, IProgressService)
], TextFileSaveParticipant);
export {
  TextFileSaveParticipant
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdGV4dGZpbGUvY29tbW9uL3RleHRGaWxlU2F2ZVBhcnRpY2lwYW50LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgcmFjZUNhbmNlbGxhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuLCBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElQcm9ncmVzcywgSVByb2dyZXNzU2VydmljZSwgSVByb2dyZXNzU3RlcCwgUHJvZ3Jlc3NMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyBJVGV4dEZpbGVTYXZlUGFydGljaXBhbnQsIElUZXh0RmlsZUVkaXRvck1vZGVsLCBJVGV4dEZpbGVTYXZlUGFydGljaXBhbnRDb250ZXh0IH0gZnJvbSAnLi90ZXh0ZmlsZXMuanMnO1xuaW1wb3J0IHsgSURpc3Bvc2FibGUsIERpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBMaW5rZWRMaXN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlua2VkTGlzdC5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBOb3RpZmljYXRpb25Qcmlvcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvbkVycm9yLCBpc0NhbmNlbGxhdGlvbkVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcblxuZXhwb3J0IGNsYXNzIFRleHRGaWxlU2F2ZVBhcnRpY2lwYW50IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBzYXZlUGFydGljaXBhbnRzID0gbmV3IExpbmtlZExpc3Q8SVRleHRGaWxlU2F2ZVBhcnRpY2lwYW50PigpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJUHJvZ3Jlc3NTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcHJvZ3Jlc3NTZXJ2aWNlOiBJUHJvZ3Jlc3NTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0YWRkU2F2ZVBhcnRpY2lwYW50KHBhcnRpY2lwYW50OiBJVGV4dEZpbGVTYXZlUGFydGljaXBhbnQpOiBJRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3QgcmVtb3ZlID0gdGhpcy5zYXZlUGFydGljaXBhbnRzLnB1c2gocGFydGljaXBhbnQpO1xuXG5cdFx0cmV0dXJuIHRvRGlzcG9zYWJsZSgoKSA9PiByZW1vdmUoKSk7XG5cdH1cblxuXHRhc3luYyBwYXJ0aWNpcGF0ZShtb2RlbDogSVRleHRGaWxlRWRpdG9yTW9kZWwsIGNvbnRleHQ6IElUZXh0RmlsZVNhdmVQYXJ0aWNpcGFudENvbnRleHQsIHByb2dyZXNzOiBJUHJvZ3Jlc3M8SVByb2dyZXNzU3RlcD4sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGN0cyA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSh0b2tlbik7XG5cblx0XHQvLyB1bmRvU3RvcCBiZWZvcmUgcGFydGljaXBhdGlvblxuXHRcdG1vZGVsLnRleHRFZGl0b3JNb2RlbD8ucHVzaFN0YWNrRWxlbWVudCgpO1xuXG5cdFx0Ly8gcmVwb3J0IHRvIHRoZSBcIm91dGVyXCIgcHJvZ3Jlc3Ncblx0XHRwcm9ncmVzcy5yZXBvcnQoe1xuXHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ3NhdmVQYXJ0aWNpcGFudHMxJywgXCJSdW5uaW5nIENvZGUgQWN0aW9ucyBhbmQgRm9ybWF0dGVycy4uLlwiKVxuXHRcdH0pO1xuXG5cdFx0bGV0IGJ1YmJsZUNhbmNlbCA9IGZhbHNlO1xuXG5cdFx0Ly8gY3JlYXRlIGFuIFwiaW5uZXJcIiBwcm9ncmVzcyB0byBhbGxvdyB0byBza2lwIG92ZXIgbG9uZyBydW5uaW5nIHNhdmUgcGFydGljaXBhbnRzXG5cdFx0YXdhaXQgdGhpcy5wcm9ncmVzc1NlcnZpY2Uud2l0aFByb2dyZXNzKHtcblx0XHRcdHByaW9yaXR5OiBOb3RpZmljYXRpb25Qcmlvcml0eS5VUkdFTlQsXG5cdFx0XHRsb2NhdGlvbjogUHJvZ3Jlc3NMb2NhdGlvbi5Ob3RpZmljYXRpb24sXG5cdFx0XHRjYW5jZWxsYWJsZTogbG9jYWxpemUoJ3NraXAnLCBcIlNraXBcIiksXG5cdFx0XHRkZWxheTogbW9kZWwuaXNEaXJ0eSgpID8gNTAwMCA6IDMwMDBcblx0XHR9LCBhc3luYyBwcm9ncmVzcyA9PiB7XG5cblx0XHRcdGNvbnN0IHBhcnRpY2lwYW50cyA9IEFycmF5LmZyb20odGhpcy5zYXZlUGFydGljaXBhbnRzKS5zb3J0KChhLCBiKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGFWYWx1ZSA9IGEub3JkaW5hbCA/PyAwO1xuXHRcdFx0XHRjb25zdCBiVmFsdWUgPSBiLm9yZGluYWwgPz8gMDtcblx0XHRcdFx0cmV0dXJuIGFWYWx1ZSAtIGJWYWx1ZTtcblx0XHRcdH0pO1xuXG5cdFx0XHRmb3IgKGNvbnN0IHNhdmVQYXJ0aWNpcGFudCBvZiBwYXJ0aWNpcGFudHMpIHtcblx0XHRcdFx0aWYgKGN0cy50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCB8fCAhbW9kZWwudGV4dEVkaXRvck1vZGVsIC8qIGRpc3Bvc2VkICovKSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGNvbnN0IHByb21pc2UgPSBzYXZlUGFydGljaXBhbnQucGFydGljaXBhdGUobW9kZWwsIGNvbnRleHQsIHByb2dyZXNzLCBjdHMudG9rZW4pO1xuXHRcdFx0XHRcdGF3YWl0IHJhY2VDYW5jZWxsYXRpb24ocHJvbWlzZSwgY3RzLnRva2VuKTtcblx0XHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdFx0aWYgKCFpc0NhbmNlbGxhdGlvbkVycm9yKGVycikpIHtcblx0XHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihlcnIpO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoIWN0cy50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdFx0Ly8gd2Ugc2VlIGEgY2FuY2VsbGF0aW9uIGVycm9yIEJVVCB0aGUgdG9rZW4gZGlkbid0IHNpZ25hbCBpdFxuXHRcdFx0XHRcdFx0Ly8gdGhpcyBtZWFucyB0aGUgcGFydGljaXBhbnQgd2FudHMgdGhlIHNhdmUgb3BlcmF0aW9uIHRvIGJlIGNhbmNlbGxlZFxuXHRcdFx0XHRcdFx0Y3RzLmNhbmNlbCgpO1xuXHRcdFx0XHRcdFx0YnViYmxlQ2FuY2VsID0gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9LCAoKSA9PiB7XG5cdFx0XHRjdHMuY2FuY2VsKCk7XG5cdFx0fSk7XG5cblx0XHQvLyB1bmRvU3RvcCBhZnRlciBwYXJ0aWNpcGF0aW9uXG5cdFx0bW9kZWwudGV4dEVkaXRvck1vZGVsPy5wdXNoU3RhY2tFbGVtZW50KCk7XG5cblx0XHRjdHMuZGlzcG9zZSgpO1xuXG5cdFx0aWYgKGJ1YmJsZUNhbmNlbCkge1xuXHRcdFx0dGhyb3cgbmV3IENhbmNlbGxhdGlvbkVycm9yKCk7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLnNhdmVQYXJ0aWNpcGFudHMuY2xlYXIoKTtcblxuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLHdCQUF3QjtBQUNqQyxTQUE0QiwrQkFBK0I7QUFDM0QsU0FBUyxtQkFBbUI7QUFDNUIsU0FBb0Isa0JBQWlDLHdCQUF3QjtBQUU3RSxTQUFzQixZQUFZLG9CQUFvQjtBQUN0RCxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLG1CQUFtQiwyQkFBMkI7QUFFaEQsSUFBTSwwQkFBTixjQUFzQyxXQUFXO0FBQUEsRUFJdkQsWUFDK0IsWUFDSyxpQkFDbEM7QUFDRCxVQUFNO0FBSHdCO0FBQ0s7QUFKcEMsU0FBaUIsbUJBQW1CLElBQUksV0FBcUM7QUFBQSxFQU83RTtBQUFBLEVBRUEsbUJBQW1CLGFBQW9EO0FBQ3RFLFVBQU0sU0FBUyxLQUFLLGlCQUFpQixLQUFLLFdBQVc7QUFFckQsV0FBTyxhQUFhLE1BQU0sT0FBTyxDQUFDO0FBQUEsRUFDbkM7QUFBQSxFQUVBLE1BQU0sWUFBWSxPQUE2QixTQUEwQyxVQUFvQyxPQUF5QztBQUNySyxVQUFNLE1BQU0sSUFBSSx3QkFBd0IsS0FBSztBQUc3QyxVQUFNLGlCQUFpQixpQkFBaUI7QUFHeEMsYUFBUyxPQUFPO0FBQUEsTUFDZixTQUFTLFNBQVMscUJBQXFCLHdDQUF3QztBQUFBLElBQ2hGLENBQUM7QUFFRCxRQUFJLGVBQWU7QUFHbkIsVUFBTSxLQUFLLGdCQUFnQixhQUFhO0FBQUEsTUFDdkMsVUFBVSxxQkFBcUI7QUFBQSxNQUMvQixVQUFVLGlCQUFpQjtBQUFBLE1BQzNCLGFBQWEsU0FBUyxRQUFRLE1BQU07QUFBQSxNQUNwQyxPQUFPLE1BQU0sUUFBUSxJQUFJLE1BQU87QUFBQSxJQUNqQyxHQUFHLE9BQU1BLGNBQVk7QUFFcEIsWUFBTSxlQUFlLE1BQU0sS0FBSyxLQUFLLGdCQUFnQixFQUFFLEtBQUssQ0FBQyxHQUFHLE1BQU07QUFDckUsY0FBTSxTQUFTLEVBQUUsV0FBVztBQUM1QixjQUFNLFNBQVMsRUFBRSxXQUFXO0FBQzVCLGVBQU8sU0FBUztBQUFBLE1BQ2pCLENBQUM7QUFFRCxpQkFBVyxtQkFBbUIsY0FBYztBQUMzQyxZQUFJLElBQUksTUFBTSwyQkFBMkIsQ0FBQyxNQUFNLGlCQUFnQztBQUMvRTtBQUFBLFFBQ0Q7QUFFQSxZQUFJO0FBQ0gsZ0JBQU0sVUFBVSxnQkFBZ0IsWUFBWSxPQUFPLFNBQVNBLFdBQVUsSUFBSSxLQUFLO0FBQy9FLGdCQUFNLGlCQUFpQixTQUFTLElBQUksS0FBSztBQUFBLFFBQzFDLFNBQVMsS0FBSztBQUNiLGNBQUksQ0FBQyxvQkFBb0IsR0FBRyxHQUFHO0FBQzlCLGlCQUFLLFdBQVcsTUFBTSxHQUFHO0FBQUEsVUFDMUIsV0FBVyxDQUFDLElBQUksTUFBTSx5QkFBeUI7QUFHOUMsZ0JBQUksT0FBTztBQUNYLDJCQUFlO0FBQUEsVUFDaEI7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLElBQ0QsR0FBRyxNQUFNO0FBQ1IsVUFBSSxPQUFPO0FBQUEsSUFDWixDQUFDO0FBR0QsVUFBTSxpQkFBaUIsaUJBQWlCO0FBRXhDLFFBQUksUUFBUTtBQUVaLFFBQUksY0FBYztBQUNqQixZQUFNLElBQUksa0JBQWtCO0FBQUEsSUFDN0I7QUFBQSxFQUNEO0FBQUEsRUFFUyxVQUFnQjtBQUN4QixTQUFLLGlCQUFpQixNQUFNO0FBRTVCLFVBQU0sUUFBUTtBQUFBLEVBQ2Y7QUFDRDtBQWxGYSwwQkFBTjtBQUFBLEVBS0o7QUFBQSxFQUNBO0FBQUEsR0FOVTsiLAogICJuYW1lcyI6IFsicHJvZ3Jlc3MiXQp9Cg==
