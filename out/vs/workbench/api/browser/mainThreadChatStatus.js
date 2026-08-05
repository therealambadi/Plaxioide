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
import { Disposable } from "../../../base/common/lifecycle.js";
import { IChatStatusItemService } from "../../contrib/chat/browser/chatStatusItemService.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { MainContext } from "../common/extHost.protocol.js";
let MainThreadChatStatus = class extends Disposable {
  constructor(_extHostContext, _chatStatusItemService) {
    super();
    this._chatStatusItemService = _chatStatusItemService;
  }
  $setEntry(id, entry) {
    this._chatStatusItemService.setOrUpdateEntry({
      id,
      label: entry.title,
      description: entry.description,
      detail: entry.detail
    });
  }
  $disposeEntry(id) {
    this._chatStatusItemService.deleteEntry(id);
  }
};
MainThreadChatStatus = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadChatStatus),
  __decorateParam(1, IChatStatusItemService)
], MainThreadChatStatus);
export {
  MainThreadChatStatus
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZENoYXRTdGF0dXMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElDaGF0U3RhdHVzSXRlbVNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0U3RhdHVzSXRlbVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RDb250ZXh0LCBleHRIb3N0TmFtZWRDdXN0b21lciB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dEhvc3RDdXN0b21lcnMuanMnO1xuaW1wb3J0IHsgQ2hhdFN0YXR1c0l0ZW1EdG8sIE1haW5Db250ZXh0LCBNYWluVGhyZWFkQ2hhdFN0YXR1c1NoYXBlIH0gZnJvbSAnLi4vY29tbW9uL2V4dEhvc3QucHJvdG9jb2wuanMnO1xuXG5AZXh0SG9zdE5hbWVkQ3VzdG9tZXIoTWFpbkNvbnRleHQuTWFpblRocmVhZENoYXRTdGF0dXMpXG5leHBvcnQgY2xhc3MgTWFpblRocmVhZENoYXRTdGF0dXMgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgTWFpblRocmVhZENoYXRTdGF0dXNTaGFwZSB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0X2V4dEhvc3RDb250ZXh0OiBJRXh0SG9zdENvbnRleHQsXG5cdFx0QElDaGF0U3RhdHVzSXRlbVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY2hhdFN0YXR1c0l0ZW1TZXJ2aWNlOiBJQ2hhdFN0YXR1c0l0ZW1TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0JHNldEVudHJ5KGlkOiBzdHJpbmcsIGVudHJ5OiBDaGF0U3RhdHVzSXRlbUR0byk6IHZvaWQge1xuXHRcdHRoaXMuX2NoYXRTdGF0dXNJdGVtU2VydmljZS5zZXRPclVwZGF0ZUVudHJ5KHtcblx0XHRcdGlkLFxuXHRcdFx0bGFiZWw6IGVudHJ5LnRpdGxlLFxuXHRcdFx0ZGVzY3JpcHRpb246IGVudHJ5LmRlc2NyaXB0aW9uLFxuXHRcdFx0ZGV0YWlsOiBlbnRyeS5kZXRhaWwsXG5cdFx0fSk7XG5cdH1cblxuXHQkZGlzcG9zZUVudHJ5KGlkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl9jaGF0U3RhdHVzSXRlbVNlcnZpY2UuZGVsZXRlRW50cnkoaWQpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQTBCLDRCQUE0QjtBQUN0RCxTQUE0QixtQkFBOEM7QUFHbkUsSUFBTSx1QkFBTixjQUFtQyxXQUFnRDtBQUFBLEVBRXpGLFlBQ0MsaUJBQ3lDLHdCQUN4QztBQUNELFVBQU07QUFGbUM7QUFBQSxFQUcxQztBQUFBLEVBRUEsVUFBVSxJQUFZLE9BQWdDO0FBQ3JELFNBQUssdUJBQXVCLGlCQUFpQjtBQUFBLE1BQzVDO0FBQUEsTUFDQSxPQUFPLE1BQU07QUFBQSxNQUNiLGFBQWEsTUFBTTtBQUFBLE1BQ25CLFFBQVEsTUFBTTtBQUFBLElBQ2YsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLGNBQWMsSUFBa0I7QUFDL0IsU0FBSyx1QkFBdUIsWUFBWSxFQUFFO0FBQUEsRUFDM0M7QUFDRDtBQXJCYSx1QkFBTjtBQUFBLEVBRE4scUJBQXFCLFlBQVksb0JBQW9CO0FBQUEsRUFLbkQ7QUFBQSxHQUpVOyIsCiAgIm5hbWVzIjogW10KfQo=
