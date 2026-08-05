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
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { localize } from "../../../../nls.js";
import { DeferredPromise, timeout } from "../../../../base/common/async.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
let ExtensionActivationProgress = class {
  constructor(extensionService, progressService, logService) {
    const options = {
      location: ProgressLocation.Window,
      title: localize("activation", "Activating Extensions...")
    };
    let deferred;
    let count = 0;
    this._listener = extensionService.onWillActivateByEvent((e) => {
      logService.trace("onWillActivateByEvent: ", e.event);
      if (!deferred) {
        deferred = new DeferredPromise();
        progressService.withProgress(options, (_) => deferred.p);
      }
      count++;
      Promise.race([e.activation, timeout(5e3, CancellationToken.None)]).finally(() => {
        if (--count === 0) {
          deferred.complete(void 0);
          deferred = void 0;
        }
      });
    });
  }
  dispose() {
    this._listener.dispose();
  }
};
ExtensionActivationProgress = __decorateClass([
  __decorateParam(0, IExtensionService),
  __decorateParam(1, IProgressService),
  __decorateParam(2, ILogService)
], ExtensionActivationProgress);
export {
  ExtensionActivationProgress
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9leHRlbnNpb25zL2Jyb3dzZXIvZXh0ZW5zaW9uc0FjdGl2YXRpb25Qcm9ncmVzcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSVByb2dyZXNzU2VydmljZSwgUHJvZ3Jlc3NMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBEZWZlcnJlZFByb21pc2UsIHRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcblxuZXhwb3J0IGNsYXNzIEV4dGVuc2lvbkFjdGl2YXRpb25Qcm9ncmVzcyBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2xpc3RlbmVyOiBJRGlzcG9zYWJsZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUV4dGVuc2lvblNlcnZpY2UgZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2UsXG5cdFx0QElQcm9ncmVzc1NlcnZpY2UgcHJvZ3Jlc3NTZXJ2aWNlOiBJUHJvZ3Jlc3NTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0KSB7XG5cblx0XHRjb25zdCBvcHRpb25zID0ge1xuXHRcdFx0bG9jYXRpb246IFByb2dyZXNzTG9jYXRpb24uV2luZG93LFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdhY3RpdmF0aW9uJywgXCJBY3RpdmF0aW5nIEV4dGVuc2lvbnMuLi5cIilcblx0XHR9O1xuXG5cdFx0bGV0IGRlZmVycmVkOiBEZWZlcnJlZFByb21pc2U8YW55PiB8IHVuZGVmaW5lZDtcblx0XHRsZXQgY291bnQgPSAwO1xuXG5cdFx0dGhpcy5fbGlzdGVuZXIgPSBleHRlbnNpb25TZXJ2aWNlLm9uV2lsbEFjdGl2YXRlQnlFdmVudChlID0+IHtcblx0XHRcdGxvZ1NlcnZpY2UudHJhY2UoJ29uV2lsbEFjdGl2YXRlQnlFdmVudDogJywgZS5ldmVudCk7XG5cblx0XHRcdGlmICghZGVmZXJyZWQpIHtcblx0XHRcdFx0ZGVmZXJyZWQgPSBuZXcgRGVmZXJyZWRQcm9taXNlKCk7XG5cdFx0XHRcdHByb2dyZXNzU2VydmljZS53aXRoUHJvZ3Jlc3Mob3B0aW9ucywgXyA9PiBkZWZlcnJlZCEucCk7XG5cdFx0XHR9XG5cblx0XHRcdGNvdW50Kys7XG5cblx0XHRcdFByb21pc2UucmFjZShbZS5hY3RpdmF0aW9uLCB0aW1lb3V0KDUwMDAsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpXSkuZmluYWxseSgoKSA9PiB7XG5cdFx0XHRcdGlmICgtLWNvdW50ID09PSAwKSB7XG5cdFx0XHRcdFx0ZGVmZXJyZWQhLmNvbXBsZXRlKHVuZGVmaW5lZCk7XG5cdFx0XHRcdFx0ZGVmZXJyZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9saXN0ZW5lci5kaXNwb3NlKCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBTUEsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxrQkFBa0Isd0JBQXdCO0FBQ25ELFNBQVMsZ0JBQWdCO0FBRXpCLFNBQVMsaUJBQWlCLGVBQWU7QUFDekMsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyx5QkFBeUI7QUFFM0IsSUFBTSw4QkFBTixNQUFvRTtBQUFBLEVBSTFFLFlBQ29CLGtCQUNELGlCQUNMLFlBQ1o7QUFFRCxVQUFNLFVBQVU7QUFBQSxNQUNmLFVBQVUsaUJBQWlCO0FBQUEsTUFDM0IsT0FBTyxTQUFTLGNBQWMsMEJBQTBCO0FBQUEsSUFDekQ7QUFFQSxRQUFJO0FBQ0osUUFBSSxRQUFRO0FBRVosU0FBSyxZQUFZLGlCQUFpQixzQkFBc0IsT0FBSztBQUM1RCxpQkFBVyxNQUFNLDJCQUEyQixFQUFFLEtBQUs7QUFFbkQsVUFBSSxDQUFDLFVBQVU7QUFDZCxtQkFBVyxJQUFJLGdCQUFnQjtBQUMvQix3QkFBZ0IsYUFBYSxTQUFTLE9BQUssU0FBVSxDQUFDO0FBQUEsTUFDdkQ7QUFFQTtBQUVBLGNBQVEsS0FBSyxDQUFDLEVBQUUsWUFBWSxRQUFRLEtBQU0sa0JBQWtCLElBQUksQ0FBQyxDQUFDLEVBQUUsUUFBUSxNQUFNO0FBQ2pGLFlBQUksRUFBRSxVQUFVLEdBQUc7QUFDbEIsbUJBQVUsU0FBUyxNQUFTO0FBQzVCLHFCQUFXO0FBQUEsUUFDWjtBQUFBLE1BQ0QsQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLFVBQWdCO0FBQ2YsU0FBSyxVQUFVLFFBQVE7QUFBQSxFQUN4QjtBQUNEO0FBeENhLDhCQUFOO0FBQUEsRUFLSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FQVTsiLAogICJuYW1lcyI6IFtdCn0K
