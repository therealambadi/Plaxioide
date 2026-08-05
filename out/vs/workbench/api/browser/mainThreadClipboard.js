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
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { MainContext } from "../common/extHost.protocol.js";
import { IClipboardService } from "../../../platform/clipboard/common/clipboardService.js";
let MainThreadClipboard = class {
  constructor(_context, _clipboardService) {
    this._clipboardService = _clipboardService;
  }
  dispose() {
  }
  $readText() {
    return this._clipboardService.readText();
  }
  $writeText(value) {
    return this._clipboardService.writeText(value);
  }
};
MainThreadClipboard = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadClipboard),
  __decorateParam(1, IClipboardService)
], MainThreadClipboard);
export {
  MainThreadClipboard
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZENsaXBib2FyZC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGV4dEhvc3ROYW1lZEN1c3RvbWVyIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0SG9zdEN1c3RvbWVycy5qcyc7XG5pbXBvcnQgeyBNYWluQ29udGV4dCwgTWFpblRocmVhZENsaXBib2FyZFNoYXBlIH0gZnJvbSAnLi4vY29tbW9uL2V4dEhvc3QucHJvdG9jb2wuanMnO1xuaW1wb3J0IHsgSUNsaXBib2FyZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9jbGlwYm9hcmQvY29tbW9uL2NsaXBib2FyZFNlcnZpY2UuanMnO1xuXG5AZXh0SG9zdE5hbWVkQ3VzdG9tZXIoTWFpbkNvbnRleHQuTWFpblRocmVhZENsaXBib2FyZClcbmV4cG9ydCBjbGFzcyBNYWluVGhyZWFkQ2xpcGJvYXJkIGltcGxlbWVudHMgTWFpblRocmVhZENsaXBib2FyZFNoYXBlIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRfY29udGV4dDogYW55LFxuXHRcdEBJQ2xpcGJvYXJkU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jbGlwYm9hcmRTZXJ2aWNlOiBJQ2xpcGJvYXJkU2VydmljZSxcblx0KSB7IH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdC8vIG5vdGhpbmdcblx0fVxuXG5cdCRyZWFkVGV4dCgpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdHJldHVybiB0aGlzLl9jbGlwYm9hcmRTZXJ2aWNlLnJlYWRUZXh0KCk7XG5cdH1cblxuXHQkd3JpdGVUZXh0KHZhbHVlOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fY2xpcGJvYXJkU2VydmljZS53cml0ZVRleHQodmFsdWUpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsbUJBQTZDO0FBQ3RELFNBQVMseUJBQXlCO0FBRzNCLElBQU0sc0JBQU4sTUFBOEQ7QUFBQSxFQUVwRSxZQUNDLFVBQ29DLG1CQUNuQztBQURtQztBQUFBLEVBQ2pDO0FBQUEsRUFFSixVQUFnQjtBQUFBLEVBRWhCO0FBQUEsRUFFQSxZQUE2QjtBQUM1QixXQUFPLEtBQUssa0JBQWtCLFNBQVM7QUFBQSxFQUN4QztBQUFBLEVBRUEsV0FBVyxPQUE4QjtBQUN4QyxXQUFPLEtBQUssa0JBQWtCLFVBQVUsS0FBSztBQUFBLEVBQzlDO0FBQ0Q7QUFsQmEsc0JBQU47QUFBQSxFQUROLHFCQUFxQixZQUFZLG1CQUFtQjtBQUFBLEVBS2xEO0FBQUEsR0FKVTsiLAogICJuYW1lcyI6IFtdCn0K
