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
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { IChatTransferService } from "../../common/chatTransferService.js";
let ChatTransferContribution = class extends Disposable {
  constructor(chatTransferService) {
    super();
    chatTransferService.checkAndSetWorkspaceTrust();
  }
};
ChatTransferContribution.ID = "workbench.contrib.chatTransfer";
ChatTransferContribution = __decorateClass([
  __decorateParam(0, IChatTransferService)
], ChatTransferContribution);
export {
  ChatTransferContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvYWN0aW9ucy9jaGF0VHJhbnNmZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJQ2hhdFRyYW5zZmVyU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0VHJhbnNmZXJTZXJ2aWNlLmpzJztcblxuZXhwb3J0IGNsYXNzIENoYXRUcmFuc2ZlckNvbnRyaWJ1dGlvbiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5jb250cmliLmNoYXRUcmFuc2Zlcic7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElDaGF0VHJhbnNmZXJTZXJ2aWNlIGNoYXRUcmFuc2ZlclNlcnZpY2U6IElDaGF0VHJhbnNmZXJTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdGNoYXRUcmFuc2ZlclNlcnZpY2UuY2hlY2tBbmRTZXRXb3Jrc3BhY2VUcnVzdCgpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQU1BLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsNEJBQTRCO0FBRTlCLElBQU0sMkJBQU4sY0FBdUMsV0FBNkM7QUFBQSxFQUcxRixZQUN1QixxQkFDckI7QUFDRCxVQUFNO0FBQ04sd0JBQW9CLDBCQUEwQjtBQUFBLEVBQy9DO0FBQ0Q7QUFUYSx5QkFDSSxLQUFLO0FBRFQsMkJBQU47QUFBQSxFQUlKO0FBQUEsR0FKVTsiLAogICJuYW1lcyI6IFtdCn0K
