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
import { BasePromptParser } from "./basePromptParser.js";
import { ILogService } from "../../../../../../platform/log/common/log.js";
import { FilePromptContentProvider } from "../contentProviders/filePromptContentsProvider.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
let FilePromptParser = class extends BasePromptParser {
  constructor(uri, seenReferences = [], initService, logService) {
    const contentsProvider = initService.createInstance(FilePromptContentProvider, uri);
    super(contentsProvider, seenReferences, initService, logService);
    this._register(contentsProvider);
  }
  /**
   * Returns a string representation of this object.
   */
  toString() {
    return `file-prompt:${this.uri.path}`;
  }
};
FilePromptParser = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, ILogService)
], FilePromptParser);
export {
  FilePromptParser
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9wcm9tcHRTeW50YXgvcGFyc2Vycy9maWxlUHJvbXB0UGFyc2VyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQmFzZVByb21wdFBhcnNlciB9IGZyb20gJy4vYmFzZVByb21wdFBhcnNlci5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBGaWxlUHJvbXB0Q29udGVudFByb3ZpZGVyIH0gZnJvbSAnLi4vY29udGVudFByb3ZpZGVycy9maWxlUHJvbXB0Q29udGVudHNQcm92aWRlci5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcblxuLyoqXG4gKiBDbGFzcyBjYXBhYmxlIG9mIHBhcnNpbmcgcHJvbXB0IHN5bnRheCBvdXQgb2YgYSBwcm92aWRlZCBmaWxlLFxuICogaW5jbHVkaW5nIGFsbCB0aGUgbmVzdGVkIGNoaWxkIGZpbGUgcmVmZXJlbmNlcyBpdCBtYXkgaGF2ZS5cbiAqL1xuZXhwb3J0IGNsYXNzIEZpbGVQcm9tcHRQYXJzZXIgZXh0ZW5kcyBCYXNlUHJvbXB0UGFyc2VyPEZpbGVQcm9tcHRDb250ZW50UHJvdmlkZXI+IHtcblx0Y29uc3RydWN0b3IoXG5cdFx0dXJpOiBVUkksXG5cdFx0c2VlblJlZmVyZW5jZXM6IHN0cmluZ1tdID0gW10sXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbml0U2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0KSB7XG5cdFx0Y29uc3QgY29udGVudHNQcm92aWRlciA9IGluaXRTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEZpbGVQcm9tcHRDb250ZW50UHJvdmlkZXIsIHVyaSk7XG5cdFx0c3VwZXIoY29udGVudHNQcm92aWRlciwgc2VlblJlZmVyZW5jZXMsIGluaXRTZXJ2aWNlLCBsb2dTZXJ2aWNlKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGNvbnRlbnRzUHJvdmlkZXIpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybnMgYSBzdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhpcyBvYmplY3QuXG5cdCAqL1xuXHRwdWJsaWMgb3ZlcnJpZGUgdG9TdHJpbmcoKSB7XG5cdFx0cmV0dXJuIGBmaWxlLXByb21wdDoke3RoaXMudXJpLnBhdGh9YDtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLHdCQUF3QjtBQUVqQyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGlDQUFpQztBQUMxQyxTQUFTLDZCQUE2QjtBQU0vQixJQUFNLG1CQUFOLGNBQStCLGlCQUE0QztBQUFBLEVBQ2pGLFlBQ0MsS0FDQSxpQkFBMkIsQ0FBQyxHQUNMLGFBQ1YsWUFDWjtBQUNELFVBQU0sbUJBQW1CLFlBQVksZUFBZSwyQkFBMkIsR0FBRztBQUNsRixVQUFNLGtCQUFrQixnQkFBZ0IsYUFBYSxVQUFVO0FBRS9ELFNBQUssVUFBVSxnQkFBZ0I7QUFBQSxFQUNoQztBQUFBO0FBQUE7QUFBQTtBQUFBLEVBS2dCLFdBQVc7QUFDMUIsV0FBTyxlQUFlLEtBQUssSUFBSSxJQUFJO0FBQUEsRUFDcEM7QUFDRDtBQW5CYSxtQkFBTjtBQUFBLEVBSUo7QUFBQSxFQUNBO0FBQUEsR0FMVTsiLAogICJuYW1lcyI6IFtdCn0K
