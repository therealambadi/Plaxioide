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
import { TextModelContentsProvider } from "../contentProviders/textModelContentsProvider.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
let TextModelPromptParser = class extends BasePromptParser {
  constructor(model, seenReferences = [], initService, logService) {
    const contentsProvider = initService.createInstance(TextModelContentsProvider, model);
    super(contentsProvider, seenReferences, initService, logService);
    this._register(contentsProvider);
  }
  /**
   * Returns a string representation of this object.
   */
  toString() {
    return `text-model-prompt:${this.uri.path}`;
  }
};
TextModelPromptParser = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, ILogService)
], TextModelPromptParser);
export {
  TextModelPromptParser
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9wcm9tcHRTeW50YXgvcGFyc2Vycy90ZXh0TW9kZWxQcm9tcHRQYXJzZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBCYXNlUHJvbXB0UGFyc2VyIH0gZnJvbSAnLi9iYXNlUHJvbXB0UGFyc2VyLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgVGV4dE1vZGVsQ29udGVudHNQcm92aWRlciB9IGZyb20gJy4uL2NvbnRlbnRQcm92aWRlcnMvdGV4dE1vZGVsQ29udGVudHNQcm92aWRlci5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcblxuLyoqXG4gKiBDbGFzcyBjYXBhYmxlIG9mIHBhcnNpbmcgcHJvbXB0IHN5bnRheCBvdXQgb2YgYSBwcm92aWRlZCB0ZXh0IG1vZGVsLFxuICogaW5jbHVkaW5nIGFsbCB0aGUgbmVzdGVkIGNoaWxkIGZpbGUgcmVmZXJlbmNlcyBpdCBtYXkgaGF2ZS5cbiAqL1xuZXhwb3J0IGNsYXNzIFRleHRNb2RlbFByb21wdFBhcnNlciBleHRlbmRzIEJhc2VQcm9tcHRQYXJzZXI8VGV4dE1vZGVsQ29udGVudHNQcm92aWRlcj4ge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRtb2RlbDogSVRleHRNb2RlbCxcblx0XHRzZWVuUmVmZXJlbmNlczogc3RyaW5nW10gPSBbXSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluaXRTZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHQpIHtcblx0XHRjb25zdCBjb250ZW50c1Byb3ZpZGVyID0gaW5pdFNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGV4dE1vZGVsQ29udGVudHNQcm92aWRlciwgbW9kZWwpO1xuXG5cdFx0c3VwZXIoY29udGVudHNQcm92aWRlciwgc2VlblJlZmVyZW5jZXMsIGluaXRTZXJ2aWNlLCBsb2dTZXJ2aWNlKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGNvbnRlbnRzUHJvdmlkZXIpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybnMgYSBzdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhpcyBvYmplY3QuXG5cdCAqL1xuXHRwdWJsaWMgb3ZlcnJpZGUgdG9TdHJpbmcoKSB7XG5cdFx0cmV0dXJuIGB0ZXh0LW1vZGVsLXByb21wdDoke3RoaXMudXJpLnBhdGh9YDtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLHdCQUF3QjtBQUVqQyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGlDQUFpQztBQUMxQyxTQUFTLDZCQUE2QjtBQU0vQixJQUFNLHdCQUFOLGNBQW9DLGlCQUE0QztBQUFBLEVBQ3RGLFlBQ0MsT0FDQSxpQkFBMkIsQ0FBQyxHQUNMLGFBQ1YsWUFDWjtBQUNELFVBQU0sbUJBQW1CLFlBQVksZUFBZSwyQkFBMkIsS0FBSztBQUVwRixVQUFNLGtCQUFrQixnQkFBZ0IsYUFBYSxVQUFVO0FBRS9ELFNBQUssVUFBVSxnQkFBZ0I7QUFBQSxFQUNoQztBQUFBO0FBQUE7QUFBQTtBQUFBLEVBS2dCLFdBQVc7QUFDMUIsV0FBTyxxQkFBcUIsS0FBSyxJQUFJLElBQUk7QUFBQSxFQUMxQztBQUNEO0FBcEJhLHdCQUFOO0FBQUEsRUFJSjtBQUFBLEVBQ0E7QUFBQSxHQUxVOyIsCiAgIm5hbWVzIjogW10KfQo=
