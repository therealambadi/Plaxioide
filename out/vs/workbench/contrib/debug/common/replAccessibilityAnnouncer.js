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
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IDebugService } from "./debug.js";
let ReplAccessibilityAnnouncer = class extends Disposable {
  constructor(debugService, accessibilityService, logService) {
    super();
    const viewModel = debugService.getViewModel();
    this._register(viewModel.onDidFocusSession((session) => {
      if (!session) {
        return;
      }
      this._register(session.onDidChangeReplElements((element) => {
        if (!element || !("originalExpression" in element)) {
          return;
        }
        const value = element.toString();
        accessibilityService.status(value);
        logService.trace("ReplAccessibilityAnnouncer#onDidChangeReplElements", element.originalExpression + ": " + value);
      }));
    }));
  }
};
ReplAccessibilityAnnouncer.ID = "debug.replAccessibilityAnnouncer";
ReplAccessibilityAnnouncer = __decorateClass([
  __decorateParam(0, IDebugService),
  __decorateParam(1, IAccessibilityService),
  __decorateParam(2, ILogService)
], ReplAccessibilityAnnouncer);
export {
  ReplAccessibilityAnnouncer
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9jb21tb24vcmVwbEFjY2Vzc2liaWxpdHlBbm5vdW5jZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElBY2Nlc3NpYmlsaXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvY29tbW9uL2FjY2Vzc2liaWxpdHkuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgSURlYnVnU2VydmljZSB9IGZyb20gJy4vZGVidWcuanMnO1xuXG5leHBvcnQgY2xhc3MgUmVwbEFjY2Vzc2liaWxpdHlBbm5vdW5jZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cdHN0YXRpYyBJRCA9ICdkZWJ1Zy5yZXBsQWNjZXNzaWJpbGl0eUFubm91bmNlcic7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRGVidWdTZXJ2aWNlIGRlYnVnU2VydmljZTogSURlYnVnU2VydmljZSxcblx0XHRASUFjY2Vzc2liaWxpdHlTZXJ2aWNlIGFjY2Vzc2liaWxpdHlTZXJ2aWNlOiBJQWNjZXNzaWJpbGl0eVNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0Y29uc3Qgdmlld01vZGVsID0gZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHZpZXdNb2RlbC5vbkRpZEZvY3VzU2Vzc2lvbigoc2Vzc2lvbikgPT4ge1xuXHRcdFx0aWYgKCFzZXNzaW9uKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHNlc3Npb24ub25EaWRDaGFuZ2VSZXBsRWxlbWVudHMoKGVsZW1lbnQpID0+IHtcblx0XHRcdFx0aWYgKCFlbGVtZW50IHx8ICEoJ29yaWdpbmFsRXhwcmVzc2lvbicgaW4gZWxlbWVudCkpIHtcblx0XHRcdFx0XHQvLyBlbGVtZW50IHdhcyByZW1vdmVkIG9yIGhhc24ndCBiZWVuIHJlc29sdmVkIHlldFxuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCB2YWx1ZSA9IGVsZW1lbnQudG9TdHJpbmcoKTtcblx0XHRcdFx0YWNjZXNzaWJpbGl0eVNlcnZpY2Uuc3RhdHVzKHZhbHVlKTtcblx0XHRcdFx0bG9nU2VydmljZS50cmFjZSgnUmVwbEFjY2Vzc2liaWxpdHlBbm5vdW5jZXIjb25EaWRDaGFuZ2VSZXBsRWxlbWVudHMnLCBlbGVtZW50Lm9yaWdpbmFsRXhwcmVzc2lvbiArICc6ICcgKyB2YWx1ZSk7XG5cdFx0XHR9KSk7XG5cdFx0fSkpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsbUJBQW1CO0FBRTVCLFNBQVMscUJBQXFCO0FBRXZCLElBQU0sNkJBQU4sY0FBeUMsV0FBNkM7QUFBQSxFQUU1RixZQUNnQixjQUNRLHNCQUNWLFlBQ1o7QUFDRCxVQUFNO0FBQ04sVUFBTSxZQUFZLGFBQWEsYUFBYTtBQUM1QyxTQUFLLFVBQVUsVUFBVSxrQkFBa0IsQ0FBQyxZQUFZO0FBQ3ZELFVBQUksQ0FBQyxTQUFTO0FBQ2I7QUFBQSxNQUNEO0FBQ0EsV0FBSyxVQUFVLFFBQVEsd0JBQXdCLENBQUMsWUFBWTtBQUMzRCxZQUFJLENBQUMsV0FBVyxFQUFFLHdCQUF3QixVQUFVO0FBRW5EO0FBQUEsUUFDRDtBQUNBLGNBQU0sUUFBUSxRQUFRLFNBQVM7QUFDL0IsNkJBQXFCLE9BQU8sS0FBSztBQUNqQyxtQkFBVyxNQUFNLHNEQUFzRCxRQUFRLHFCQUFxQixPQUFPLEtBQUs7QUFBQSxNQUNqSCxDQUFDLENBQUM7QUFBQSxJQUNILENBQUMsQ0FBQztBQUFBLEVBQ0g7QUFDRDtBQXhCYSwyQkFDTCxLQUFLO0FBREEsNkJBQU47QUFBQSxFQUdKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQUxVOyIsCiAgIm5hbWVzIjogW10KfQo=
