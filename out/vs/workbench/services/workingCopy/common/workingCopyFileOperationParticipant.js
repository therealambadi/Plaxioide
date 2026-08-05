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
import { ILogService } from "../../../../platform/log/common/log.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { LinkedList } from "../../../../base/common/linkedList.js";
let WorkingCopyFileOperationParticipant = class extends Disposable {
  constructor(logService, configurationService) {
    super();
    this.logService = logService;
    this.configurationService = configurationService;
    this.participants = new LinkedList();
  }
  addFileOperationParticipant(participant) {
    const remove = this.participants.push(participant);
    return toDisposable(() => remove());
  }
  async participate(files, operation, undoInfo, token) {
    const timeout = this.configurationService.getValue("files.participants.timeout");
    if (typeof timeout !== "number" || timeout <= 0) {
      return;
    }
    for (const participant of this.participants) {
      try {
        await participant.participate(files, operation, undoInfo, timeout, token);
      } catch (err) {
        this.logService.warn(err);
      }
    }
  }
  dispose() {
    this.participants.clear();
    super.dispose();
  }
};
WorkingCopyFileOperationParticipant = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, IConfigurationService)
], WorkingCopyFileOperationParticipant);
export {
  WorkingCopyFileOperationParticipant
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvd29ya2luZ0NvcHkvY29tbW9uL3dvcmtpbmdDb3B5RmlsZU9wZXJhdGlvblBhcnRpY2lwYW50LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSwgRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElXb3JraW5nQ29weUZpbGVPcGVyYXRpb25QYXJ0aWNpcGFudCwgU291cmNlVGFyZ2V0UGFpciwgSUZpbGVPcGVyYXRpb25VbmRvUmVkb0luZm8gfSBmcm9tICcuL3dvcmtpbmdDb3B5RmlsZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRmlsZU9wZXJhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IExpbmtlZExpc3QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saW5rZWRMaXN0LmpzJztcblxuZXhwb3J0IGNsYXNzIFdvcmtpbmdDb3B5RmlsZU9wZXJhdGlvblBhcnRpY2lwYW50IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBwYXJ0aWNpcGFudHMgPSBuZXcgTGlua2VkTGlzdDxJV29ya2luZ0NvcHlGaWxlT3BlcmF0aW9uUGFydGljaXBhbnQ+KCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdGFkZEZpbGVPcGVyYXRpb25QYXJ0aWNpcGFudChwYXJ0aWNpcGFudDogSVdvcmtpbmdDb3B5RmlsZU9wZXJhdGlvblBhcnRpY2lwYW50KTogSURpc3Bvc2FibGUge1xuXHRcdGNvbnN0IHJlbW92ZSA9IHRoaXMucGFydGljaXBhbnRzLnB1c2gocGFydGljaXBhbnQpO1xuXG5cdFx0cmV0dXJuIHRvRGlzcG9zYWJsZSgoKSA9PiByZW1vdmUoKSk7XG5cdH1cblxuXHRhc3luYyBwYXJ0aWNpcGF0ZShmaWxlczogU291cmNlVGFyZ2V0UGFpcltdLCBvcGVyYXRpb246IEZpbGVPcGVyYXRpb24sIHVuZG9JbmZvOiBJRmlsZU9wZXJhdGlvblVuZG9SZWRvSW5mbyB8IHVuZGVmaW5lZCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgdGltZW91dCA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8bnVtYmVyPignZmlsZXMucGFydGljaXBhbnRzLnRpbWVvdXQnKTtcblx0XHRpZiAodHlwZW9mIHRpbWVvdXQgIT09ICdudW1iZXInIHx8IHRpbWVvdXQgPD0gMCkge1xuXHRcdFx0cmV0dXJuOyAvLyBkaXNhYmxlZFxuXHRcdH1cblxuXHRcdC8vIEZvciBlYWNoIHBhcnRpY2lwYW50XG5cdFx0Zm9yIChjb25zdCBwYXJ0aWNpcGFudCBvZiB0aGlzLnBhcnRpY2lwYW50cykge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgcGFydGljaXBhbnQucGFydGljaXBhdGUoZmlsZXMsIG9wZXJhdGlvbiwgdW5kb0luZm8sIHRpbWVvdXQsIHRva2VuKTtcblx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2Uud2FybihlcnIpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5wYXJ0aWNpcGFudHMuY2xlYXIoKTtcblxuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFNQSxTQUFTLG1CQUFtQjtBQUM1QixTQUFzQixZQUFZLG9CQUFvQjtBQUd0RCxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGtCQUFrQjtBQUVwQixJQUFNLHNDQUFOLGNBQWtELFdBQVc7QUFBQSxFQUluRSxZQUMrQixZQUNVLHNCQUN2QztBQUNELFVBQU07QUFId0I7QUFDVTtBQUp6QyxTQUFpQixlQUFlLElBQUksV0FBaUQ7QUFBQSxFQU9yRjtBQUFBLEVBRUEsNEJBQTRCLGFBQWdFO0FBQzNGLFVBQU0sU0FBUyxLQUFLLGFBQWEsS0FBSyxXQUFXO0FBRWpELFdBQU8sYUFBYSxNQUFNLE9BQU8sQ0FBQztBQUFBLEVBQ25DO0FBQUEsRUFFQSxNQUFNLFlBQVksT0FBMkIsV0FBMEIsVUFBa0QsT0FBeUM7QUFDakssVUFBTSxVQUFVLEtBQUsscUJBQXFCLFNBQWlCLDRCQUE0QjtBQUN2RixRQUFJLE9BQU8sWUFBWSxZQUFZLFdBQVcsR0FBRztBQUNoRDtBQUFBLElBQ0Q7QUFHQSxlQUFXLGVBQWUsS0FBSyxjQUFjO0FBQzVDLFVBQUk7QUFDSCxjQUFNLFlBQVksWUFBWSxPQUFPLFdBQVcsVUFBVSxTQUFTLEtBQUs7QUFBQSxNQUN6RSxTQUFTLEtBQUs7QUFDYixhQUFLLFdBQVcsS0FBSyxHQUFHO0FBQUEsTUFDekI7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUFBLEVBRVMsVUFBZ0I7QUFDeEIsU0FBSyxhQUFhLE1BQU07QUFFeEIsVUFBTSxRQUFRO0FBQUEsRUFDZjtBQUNEO0FBdENhLHNDQUFOO0FBQUEsRUFLSjtBQUFBLEVBQ0E7QUFBQSxHQU5VOyIsCiAgIm5hbWVzIjogW10KfQo=
