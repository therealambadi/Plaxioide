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
import { CancellationError, isCancellationError } from "../../../../base/common/errors.js";
import { NotificationPriority } from "../../../../platform/notification/common/notification.js";
import { localize } from "../../../../nls.js";
let StoredFileWorkingCopySaveParticipant = class extends Disposable {
  constructor(logService, progressService) {
    super();
    this.logService = logService;
    this.progressService = progressService;
    this.saveParticipants = new LinkedList();
  }
  get length() {
    return this.saveParticipants.size;
  }
  addSaveParticipant(participant) {
    const remove = this.saveParticipants.push(participant);
    return toDisposable(() => remove());
  }
  async participate(workingCopy, context, progress, token) {
    const cts = new CancellationTokenSource(token);
    workingCopy.model?.pushStackElement();
    progress.report({
      message: localize("saveParticipants1", "Running Code Actions and Formatters...")
    });
    let bubbleCancel = false;
    await this.progressService.withProgress({
      priority: NotificationPriority.URGENT,
      location: ProgressLocation.Notification,
      cancellable: localize("skip", "Skip"),
      delay: workingCopy.isDirty() ? 5e3 : 3e3
    }, async (progress2) => {
      const participants = Array.from(this.saveParticipants).sort((a, b) => {
        const aValue = a.ordinal ?? 0;
        const bValue = b.ordinal ?? 0;
        return aValue - bValue;
      });
      for (const saveParticipant of participants) {
        if (cts.token.isCancellationRequested || workingCopy.isDisposed()) {
          break;
        }
        try {
          const promise = saveParticipant.participate(workingCopy, context, progress2, cts.token);
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
    workingCopy.model?.pushStackElement();
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
StoredFileWorkingCopySaveParticipant = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, IProgressService)
], StoredFileWorkingCopySaveParticipant);
export {
  StoredFileWorkingCopySaveParticipant
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvd29ya2luZ0NvcHkvY29tbW9uL3N0b3JlZEZpbGVXb3JraW5nQ29weVNhdmVQYXJ0aWNpcGFudC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IHJhY2VDYW5jZWxsYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJUHJvZ3Jlc3MsIElQcm9ncmVzc1NlcnZpY2UsIElQcm9ncmVzc1N0ZXAsIFByb2dyZXNzTG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9ncmVzcy9jb21tb24vcHJvZ3Jlc3MuanMnO1xuaW1wb3J0IHsgSURpc3Bvc2FibGUsIERpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5U2F2ZVBhcnRpY2lwYW50LCBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5U2F2ZVBhcnRpY2lwYW50Q29udGV4dCB9IGZyb20gJy4vd29ya2luZ0NvcHlGaWxlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5LCBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5TW9kZWwgfSBmcm9tICcuL3N0b3JlZEZpbGVXb3JraW5nQ29weS5qcyc7XG5pbXBvcnQgeyBMaW5rZWRMaXN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlua2VkTGlzdC5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25FcnJvciwgaXNDYW5jZWxsYXRpb25FcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBOb3RpZmljYXRpb25Qcmlvcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcblxuZXhwb3J0IGNsYXNzIFN0b3JlZEZpbGVXb3JraW5nQ29weVNhdmVQYXJ0aWNpcGFudCBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgc2F2ZVBhcnRpY2lwYW50cyA9IG5ldyBMaW5rZWRMaXN0PElTdG9yZWRGaWxlV29ya2luZ0NvcHlTYXZlUGFydGljaXBhbnQ+KCk7XG5cblx0Z2V0IGxlbmd0aCgpOiBudW1iZXIgeyByZXR1cm4gdGhpcy5zYXZlUGFydGljaXBhbnRzLnNpemU7IH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASVByb2dyZXNzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByb2dyZXNzU2VydmljZTogSVByb2dyZXNzU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdGFkZFNhdmVQYXJ0aWNpcGFudChwYXJ0aWNpcGFudDogSVN0b3JlZEZpbGVXb3JraW5nQ29weVNhdmVQYXJ0aWNpcGFudCk6IElEaXNwb3NhYmxlIHtcblx0XHRjb25zdCByZW1vdmUgPSB0aGlzLnNhdmVQYXJ0aWNpcGFudHMucHVzaChwYXJ0aWNpcGFudCk7XG5cblx0XHRyZXR1cm4gdG9EaXNwb3NhYmxlKCgpID0+IHJlbW92ZSgpKTtcblx0fVxuXG5cdGFzeW5jIHBhcnRpY2lwYXRlKHdvcmtpbmdDb3B5OiBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5PElTdG9yZWRGaWxlV29ya2luZ0NvcHlNb2RlbD4sIGNvbnRleHQ6IElTdG9yZWRGaWxlV29ya2luZ0NvcHlTYXZlUGFydGljaXBhbnRDb250ZXh0LCBwcm9ncmVzczogSVByb2dyZXNzPElQcm9ncmVzc1N0ZXA+LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjdHMgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UodG9rZW4pO1xuXG5cdFx0Ly8gdW5kb1N0b3AgYmVmb3JlIHBhcnRpY2lwYXRpb25cblx0XHR3b3JraW5nQ29weS5tb2RlbD8ucHVzaFN0YWNrRWxlbWVudCgpO1xuXG5cdFx0Ly8gcmVwb3J0IHRvIHRoZSBcIm91dGVyXCIgcHJvZ3Jlc3Ncblx0XHRwcm9ncmVzcy5yZXBvcnQoe1xuXHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ3NhdmVQYXJ0aWNpcGFudHMxJywgXCJSdW5uaW5nIENvZGUgQWN0aW9ucyBhbmQgRm9ybWF0dGVycy4uLlwiKVxuXHRcdH0pO1xuXG5cdFx0bGV0IGJ1YmJsZUNhbmNlbCA9IGZhbHNlO1xuXG5cdFx0Ly8gY3JlYXRlIGFuIFwiaW5uZXJcIiBwcm9ncmVzcyB0byBhbGxvdyB0byBza2lwIG92ZXIgbG9uZyBydW5uaW5nIHNhdmUgcGFydGljaXBhbnRzXG5cdFx0YXdhaXQgdGhpcy5wcm9ncmVzc1NlcnZpY2Uud2l0aFByb2dyZXNzKHtcblx0XHRcdHByaW9yaXR5OiBOb3RpZmljYXRpb25Qcmlvcml0eS5VUkdFTlQsXG5cdFx0XHRsb2NhdGlvbjogUHJvZ3Jlc3NMb2NhdGlvbi5Ob3RpZmljYXRpb24sXG5cdFx0XHRjYW5jZWxsYWJsZTogbG9jYWxpemUoJ3NraXAnLCBcIlNraXBcIiksXG5cdFx0XHRkZWxheTogd29ya2luZ0NvcHkuaXNEaXJ0eSgpID8gNTAwMCA6IDMwMDBcblx0XHR9LCBhc3luYyBwcm9ncmVzcyA9PiB7XG5cblx0XHRcdGNvbnN0IHBhcnRpY2lwYW50cyA9IEFycmF5LmZyb20odGhpcy5zYXZlUGFydGljaXBhbnRzKS5zb3J0KChhLCBiKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGFWYWx1ZSA9IGEub3JkaW5hbCA/PyAwO1xuXHRcdFx0XHRjb25zdCBiVmFsdWUgPSBiLm9yZGluYWwgPz8gMDtcblx0XHRcdFx0cmV0dXJuIGFWYWx1ZSAtIGJWYWx1ZTtcblx0XHRcdH0pO1xuXG5cdFx0XHRmb3IgKGNvbnN0IHNhdmVQYXJ0aWNpcGFudCBvZiBwYXJ0aWNpcGFudHMpIHtcblx0XHRcdFx0aWYgKGN0cy50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCB8fCB3b3JraW5nQ29weS5pc0Rpc3Bvc2VkKCkpIHtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0Y29uc3QgcHJvbWlzZSA9IHNhdmVQYXJ0aWNpcGFudC5wYXJ0aWNpcGF0ZSh3b3JraW5nQ29weSwgY29udGV4dCwgcHJvZ3Jlc3MsIGN0cy50b2tlbik7XG5cdFx0XHRcdFx0YXdhaXQgcmFjZUNhbmNlbGxhdGlvbihwcm9taXNlLCBjdHMudG9rZW4pO1xuXHRcdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0XHRpZiAoIWlzQ2FuY2VsbGF0aW9uRXJyb3IoZXJyKSkge1xuXHRcdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGVycik7XG5cdFx0XHRcdFx0fSBlbHNlIGlmICghY3RzLnRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0XHQvLyB3ZSBzZWUgYSBjYW5jZWxsYXRpb24gZXJyb3IgQlVUIHRoZSB0b2tlbiBkaWRuJ3Qgc2lnbmFsIGl0XG5cdFx0XHRcdFx0XHQvLyB0aGlzIG1lYW5zIHRoZSBwYXJ0aWNpcGFudCB3YW50cyB0aGUgc2F2ZSBvcGVyYXRpb24gdG8gYmUgY2FuY2VsbGVkXG5cdFx0XHRcdFx0XHRjdHMuY2FuY2VsKCk7XG5cdFx0XHRcdFx0XHRidWJibGVDYW5jZWwgPSB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0sICgpID0+IHtcblx0XHRcdGN0cy5jYW5jZWwoKTtcblx0XHR9KTtcblxuXHRcdC8vIHVuZG9TdG9wIGFmdGVyIHBhcnRpY2lwYXRpb25cblx0XHR3b3JraW5nQ29weS5tb2RlbD8ucHVzaFN0YWNrRWxlbWVudCgpO1xuXG5cdFx0Y3RzLmRpc3Bvc2UoKTtcblxuXHRcdGlmIChidWJibGVDYW5jZWwpIHtcblx0XHRcdHRocm93IG5ldyBDYW5jZWxsYXRpb25FcnJvcigpO1xuXHRcdH1cblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5zYXZlUGFydGljaXBhbnRzLmNsZWFyKCk7XG5cblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyx3QkFBd0I7QUFDakMsU0FBNEIsK0JBQStCO0FBQzNELFNBQVMsbUJBQW1CO0FBQzVCLFNBQW9CLGtCQUFpQyx3QkFBd0I7QUFDN0UsU0FBc0IsWUFBWSxvQkFBb0I7QUFHdEQsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxtQkFBbUIsMkJBQTJCO0FBQ3ZELFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsZ0JBQWdCO0FBRWxCLElBQU0sdUNBQU4sY0FBbUQsV0FBVztBQUFBLEVBTXBFLFlBQytCLFlBQ0ssaUJBQ2xDO0FBQ0QsVUFBTTtBQUh3QjtBQUNLO0FBTnBDLFNBQWlCLG1CQUFtQixJQUFJLFdBQWtEO0FBQUEsRUFTMUY7QUFBQSxFQVBBLElBQUksU0FBaUI7QUFBRSxXQUFPLEtBQUssaUJBQWlCO0FBQUEsRUFBTTtBQUFBLEVBUzFELG1CQUFtQixhQUFpRTtBQUNuRixVQUFNLFNBQVMsS0FBSyxpQkFBaUIsS0FBSyxXQUFXO0FBRXJELFdBQU8sYUFBYSxNQUFNLE9BQU8sQ0FBQztBQUFBLEVBQ25DO0FBQUEsRUFFQSxNQUFNLFlBQVksYUFBa0UsU0FBdUQsVUFBb0MsT0FBeUM7QUFDdk4sVUFBTSxNQUFNLElBQUksd0JBQXdCLEtBQUs7QUFHN0MsZ0JBQVksT0FBTyxpQkFBaUI7QUFHcEMsYUFBUyxPQUFPO0FBQUEsTUFDZixTQUFTLFNBQVMscUJBQXFCLHdDQUF3QztBQUFBLElBQ2hGLENBQUM7QUFFRCxRQUFJLGVBQWU7QUFHbkIsVUFBTSxLQUFLLGdCQUFnQixhQUFhO0FBQUEsTUFDdkMsVUFBVSxxQkFBcUI7QUFBQSxNQUMvQixVQUFVLGlCQUFpQjtBQUFBLE1BQzNCLGFBQWEsU0FBUyxRQUFRLE1BQU07QUFBQSxNQUNwQyxPQUFPLFlBQVksUUFBUSxJQUFJLE1BQU87QUFBQSxJQUN2QyxHQUFHLE9BQU1BLGNBQVk7QUFFcEIsWUFBTSxlQUFlLE1BQU0sS0FBSyxLQUFLLGdCQUFnQixFQUFFLEtBQUssQ0FBQyxHQUFHLE1BQU07QUFDckUsY0FBTSxTQUFTLEVBQUUsV0FBVztBQUM1QixjQUFNLFNBQVMsRUFBRSxXQUFXO0FBQzVCLGVBQU8sU0FBUztBQUFBLE1BQ2pCLENBQUM7QUFFRCxpQkFBVyxtQkFBbUIsY0FBYztBQUMzQyxZQUFJLElBQUksTUFBTSwyQkFBMkIsWUFBWSxXQUFXLEdBQUc7QUFDbEU7QUFBQSxRQUNEO0FBRUEsWUFBSTtBQUNILGdCQUFNLFVBQVUsZ0JBQWdCLFlBQVksYUFBYSxTQUFTQSxXQUFVLElBQUksS0FBSztBQUNyRixnQkFBTSxpQkFBaUIsU0FBUyxJQUFJLEtBQUs7QUFBQSxRQUMxQyxTQUFTLEtBQUs7QUFDYixjQUFJLENBQUMsb0JBQW9CLEdBQUcsR0FBRztBQUM5QixpQkFBSyxXQUFXLE1BQU0sR0FBRztBQUFBLFVBQzFCLFdBQVcsQ0FBQyxJQUFJLE1BQU0seUJBQXlCO0FBRzlDLGdCQUFJLE9BQU87QUFDWCwyQkFBZTtBQUFBLFVBQ2hCO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxJQUNELEdBQUcsTUFBTTtBQUNSLFVBQUksT0FBTztBQUFBLElBQ1osQ0FBQztBQUdELGdCQUFZLE9BQU8saUJBQWlCO0FBRXBDLFFBQUksUUFBUTtBQUVaLFFBQUksY0FBYztBQUNqQixZQUFNLElBQUksa0JBQWtCO0FBQUEsSUFDN0I7QUFBQSxFQUNEO0FBQUEsRUFFUyxVQUFnQjtBQUN4QixTQUFLLGlCQUFpQixNQUFNO0FBRTVCLFVBQU0sUUFBUTtBQUFBLEVBQ2Y7QUFDRDtBQXBGYSx1Q0FBTjtBQUFBLEVBT0o7QUFBQSxFQUNBO0FBQUEsR0FSVTsiLAogICJuYW1lcyI6IFsicHJvZ3Jlc3MiXQp9Cg==
