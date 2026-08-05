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
import { URI } from "../../../../../../base/common/uri.js";
import { assert } from "../../../../../../base/common/assert.js";
import { ILogService } from "../../../../../../platform/log/common/log.js";
import { FilePromptParser } from "../../../common/promptSyntax/parsers/filePromptParser.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
let ChatFileReference = class extends FilePromptParser {
  /**
   * @throws if the `data` reference is no an instance of `URI`.
   */
  constructor(reference, initService, logService) {
    const { data } = reference;
    assert(
      data instanceof URI,
      `Variable data must be an URI, got '${data}'.`
    );
    super(data, [], initService, logService);
    this.reference = reference;
  }
  /**
   * Note! below are the getters that simply forward to the underlying `IDynamicVariable` object;
   * 		 while we could implement the logic generically using the `Proxy` class here, it's hard
   * 		 to make Typescript to recognize this generic implementation correctly
   */
  get id() {
    return this.reference.id;
  }
  get range() {
    return this.reference.range;
  }
  set range(range) {
    this.reference.range = range;
  }
  get data() {
    return this.uri;
  }
  get prefix() {
    return this.reference.prefix;
  }
  get isFile() {
    return this.reference.isFile;
  }
  get fullName() {
    return this.reference.fullName;
  }
  get icon() {
    return this.reference.icon;
  }
  get modelDescription() {
    return this.reference.modelDescription;
  }
};
ChatFileReference = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ILogService)
], ChatFileReference);
export {
  ChatFileReference
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY29udHJpYi9jaGF0RHluYW1pY1ZhcmlhYmxlcy9jaGF0RmlsZVJlZmVyZW5jZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBhc3NlcnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3NlcnQuanMnO1xuaW1wb3J0IHsgSUR5bmFtaWNWYXJpYWJsZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jaGF0VmFyaWFibGVzLmpzJztcbmltcG9ydCB7IElSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IEZpbGVQcm9tcHRQYXJzZXIgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vcHJvbXB0U3ludGF4L3BhcnNlcnMvZmlsZVByb21wdFBhcnNlci5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcblxuLyoqXG4gKiBBIHdyYXBwZXIgY2xhc3MgZm9yIGFuIGBJRHluYW1pY1ZhcmlhYmxlYCBvYmplY3QgdGhhdCB0aGF0IGFkZHMgZnVuY3Rpb25hbGl0eVxuICogdG8gcGFyc2UgbmVzdGVkIGZpbGUgcmVmZXJlbmNlcyBvZiB0aGlzIHZhcmlhYmxlLlxuICogU2VlIHtAbGluayBGaWxlUHJvbXB0UGFyc2VyfSBmb3IgZGV0YWlscy5cbiAqL1xuZXhwb3J0IGNsYXNzIENoYXRGaWxlUmVmZXJlbmNlIGV4dGVuZHMgRmlsZVByb21wdFBhcnNlciBpbXBsZW1lbnRzIElEeW5hbWljVmFyaWFibGUge1xuXHQvKipcblx0ICogQHRocm93cyBpZiB0aGUgYGRhdGFgIHJlZmVyZW5jZSBpcyBubyBhbiBpbnN0YW5jZSBvZiBgVVJJYC5cblx0ICovXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSByZWZlcmVuY2U6IElEeW5hbWljVmFyaWFibGUsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbml0U2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0KSB7XG5cdFx0Y29uc3QgeyBkYXRhIH0gPSByZWZlcmVuY2U7XG5cblx0XHRhc3NlcnQoXG5cdFx0XHRkYXRhIGluc3RhbmNlb2YgVVJJLFxuXHRcdFx0YFZhcmlhYmxlIGRhdGEgbXVzdCBiZSBhbiBVUkksIGdvdCAnJHtkYXRhfScuYCxcblx0XHQpO1xuXG5cdFx0c3VwZXIoZGF0YSwgW10sIGluaXRTZXJ2aWNlLCBsb2dTZXJ2aWNlKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBOb3RlISBiZWxvdyBhcmUgdGhlIGdldHRlcnMgdGhhdCBzaW1wbHkgZm9yd2FyZCB0byB0aGUgdW5kZXJseWluZyBgSUR5bmFtaWNWYXJpYWJsZWAgb2JqZWN0O1xuXHQgKiBcdFx0IHdoaWxlIHdlIGNvdWxkIGltcGxlbWVudCB0aGUgbG9naWMgZ2VuZXJpY2FsbHkgdXNpbmcgdGhlIGBQcm94eWAgY2xhc3MgaGVyZSwgaXQncyBoYXJkXG5cdCAqIFx0XHQgdG8gbWFrZSBUeXBlc2NyaXB0IHRvIHJlY29nbml6ZSB0aGlzIGdlbmVyaWMgaW1wbGVtZW50YXRpb24gY29ycmVjdGx5XG5cdCAqL1xuXG5cdHB1YmxpYyBnZXQgaWQoKSB7XG5cdFx0cmV0dXJuIHRoaXMucmVmZXJlbmNlLmlkO1xuXHR9XG5cblx0cHVibGljIGdldCByYW5nZSgpIHtcblx0XHRyZXR1cm4gdGhpcy5yZWZlcmVuY2UucmFuZ2U7XG5cdH1cblxuXHRwdWJsaWMgc2V0IHJhbmdlKHJhbmdlOiBJUmFuZ2UpIHtcblx0XHR0aGlzLnJlZmVyZW5jZS5yYW5nZSA9IHJhbmdlO1xuXHR9XG5cblx0cHVibGljIGdldCBkYXRhKCk6IFVSSSB7XG5cdFx0cmV0dXJuIHRoaXMudXJpO1xuXHR9XG5cblx0cHVibGljIGdldCBwcmVmaXgoKSB7XG5cdFx0cmV0dXJuIHRoaXMucmVmZXJlbmNlLnByZWZpeDtcblx0fVxuXG5cdHB1YmxpYyBnZXQgaXNGaWxlKCkge1xuXHRcdHJldHVybiB0aGlzLnJlZmVyZW5jZS5pc0ZpbGU7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGZ1bGxOYW1lKCkge1xuXHRcdHJldHVybiB0aGlzLnJlZmVyZW5jZS5mdWxsTmFtZTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgaWNvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5yZWZlcmVuY2UuaWNvbjtcblx0fVxuXG5cdHB1YmxpYyBnZXQgbW9kZWxEZXNjcmlwdGlvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5yZWZlcmVuY2UubW9kZWxEZXNjcmlwdGlvbjtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLFdBQVc7QUFDcEIsU0FBUyxjQUFjO0FBR3ZCLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsNkJBQTZCO0FBTy9CLElBQU0sb0JBQU4sY0FBZ0MsaUJBQTZDO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFJbkYsWUFDaUIsV0FDTyxhQUNWLFlBQ1o7QUFDRCxVQUFNLEVBQUUsS0FBSyxJQUFJO0FBRWpCO0FBQUEsTUFDQyxnQkFBZ0I7QUFBQSxNQUNoQixzQ0FBc0MsSUFBSTtBQUFBLElBQzNDO0FBRUEsVUFBTSxNQUFNLENBQUMsR0FBRyxhQUFhLFVBQVU7QUFYdkI7QUFBQSxFQVlqQjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQVFBLElBQVcsS0FBSztBQUNmLFdBQU8sS0FBSyxVQUFVO0FBQUEsRUFDdkI7QUFBQSxFQUVBLElBQVcsUUFBUTtBQUNsQixXQUFPLEtBQUssVUFBVTtBQUFBLEVBQ3ZCO0FBQUEsRUFFQSxJQUFXLE1BQU0sT0FBZTtBQUMvQixTQUFLLFVBQVUsUUFBUTtBQUFBLEVBQ3hCO0FBQUEsRUFFQSxJQUFXLE9BQVk7QUFDdEIsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRUEsSUFBVyxTQUFTO0FBQ25CLFdBQU8sS0FBSyxVQUFVO0FBQUEsRUFDdkI7QUFBQSxFQUVBLElBQVcsU0FBUztBQUNuQixXQUFPLEtBQUssVUFBVTtBQUFBLEVBQ3ZCO0FBQUEsRUFFQSxJQUFXLFdBQVc7QUFDckIsV0FBTyxLQUFLLFVBQVU7QUFBQSxFQUN2QjtBQUFBLEVBRUEsSUFBVyxPQUFPO0FBQ2pCLFdBQU8sS0FBSyxVQUFVO0FBQUEsRUFDdkI7QUFBQSxFQUVBLElBQVcsbUJBQW1CO0FBQzdCLFdBQU8sS0FBSyxVQUFVO0FBQUEsRUFDdkI7QUFDRDtBQTVEYSxvQkFBTjtBQUFBLEVBTUo7QUFBQSxFQUNBO0FBQUEsR0FQVTsiLAogICJuYW1lcyI6IFtdCn0K
