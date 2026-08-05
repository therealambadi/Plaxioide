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
import { AbstractPolicyService } from "../common/policy.js";
import { Throttler } from "../../../base/common/async.js";
import { MutableDisposable } from "../../../base/common/lifecycle.js";
import { ILogService } from "../../log/common/log.js";
let NativePolicyService = class extends AbstractPolicyService {
  constructor(logService, productName) {
    super();
    this.logService = logService;
    this.productName = productName;
    this.throttler = new Throttler();
    this.watcher = this._register(new MutableDisposable());
  }
  async _updatePolicyDefinitions(policyDefinitions) {
    this.logService.trace(`NativePolicyService#_updatePolicyDefinitions - Found ${Object.keys(policyDefinitions).length} policy definitions`);
    const { createWatcher } = await import("@vscode/policy-watcher");
    await this.throttler.queue(() => new Promise((c, e) => {
      try {
        this.watcher.value = createWatcher(this.productName, policyDefinitions, (update) => {
          this._onDidPolicyChange(update);
          c();
        });
      } catch (err) {
        this.logService.error(`NativePolicyService#_updatePolicyDefinitions - Error creating watcher:`, err);
        e(err);
      }
    }));
  }
  _onDidPolicyChange(update) {
    this.logService.trace(`NativePolicyService#_onDidPolicyChange - Updated policy values: ${JSON.stringify(update)}`);
    for (const key in update) {
      const value = update[key];
      if (value === void 0) {
        this.policies.delete(key);
      } else {
        this.policies.set(key, value);
      }
    }
    this._onDidChange.fire(Object.keys(update));
  }
};
NativePolicyService = __decorateClass([
  __decorateParam(0, ILogService)
], NativePolicyService);
export {
  NativePolicyService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9wb2xpY3kvbm9kZS9uYXRpdmVQb2xpY3lTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQWJzdHJhY3RQb2xpY3lTZXJ2aWNlLCBJUG9saWN5U2VydmljZSwgUG9saWN5RGVmaW5pdGlvbiB9IGZyb20gJy4uL2NvbW1vbi9wb2xpY3kuanMnO1xuaW1wb3J0IHsgSVN0cmluZ0RpY3Rpb25hcnkgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xsZWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBUaHJvdHRsZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgdHlwZSB7IFBvbGljeVVwZGF0ZSwgV2F0Y2hlciB9IGZyb20gJ0B2c2NvZGUvcG9saWN5LXdhdGNoZXInO1xuaW1wb3J0IHsgTXV0YWJsZURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi9sb2cvY29tbW9uL2xvZy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBOYXRpdmVQb2xpY3lTZXJ2aWNlIGV4dGVuZHMgQWJzdHJhY3RQb2xpY3lTZXJ2aWNlIGltcGxlbWVudHMgSVBvbGljeVNlcnZpY2Uge1xuXG5cdHByaXZhdGUgdGhyb3R0bGVyID0gbmV3IFRocm90dGxlcigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IHdhdGNoZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGU8V2F0Y2hlcj4oKSk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBwcm9kdWN0TmFtZTogc3RyaW5nXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgX3VwZGF0ZVBvbGljeURlZmluaXRpb25zKHBvbGljeURlZmluaXRpb25zOiBJU3RyaW5nRGljdGlvbmFyeTxQb2xpY3lEZWZpbml0aW9uPik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgTmF0aXZlUG9saWN5U2VydmljZSNfdXBkYXRlUG9saWN5RGVmaW5pdGlvbnMgLSBGb3VuZCAke09iamVjdC5rZXlzKHBvbGljeURlZmluaXRpb25zKS5sZW5ndGh9IHBvbGljeSBkZWZpbml0aW9uc2ApO1xuXG5cdFx0Y29uc3QgeyBjcmVhdGVXYXRjaGVyIH0gPSBhd2FpdCBpbXBvcnQoJ0B2c2NvZGUvcG9saWN5LXdhdGNoZXInKTtcblxuXHRcdGF3YWl0IHRoaXMudGhyb3R0bGVyLnF1ZXVlKCgpID0+IG5ldyBQcm9taXNlPHZvaWQ+KChjLCBlKSA9PiB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHR0aGlzLndhdGNoZXIudmFsdWUgPSBjcmVhdGVXYXRjaGVyKHRoaXMucHJvZHVjdE5hbWUsIHBvbGljeURlZmluaXRpb25zLCB1cGRhdGUgPT4ge1xuXHRcdFx0XHRcdHRoaXMuX29uRGlkUG9saWN5Q2hhbmdlKHVwZGF0ZSk7XG5cdFx0XHRcdFx0YygpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoYE5hdGl2ZVBvbGljeVNlcnZpY2UjX3VwZGF0ZVBvbGljeURlZmluaXRpb25zIC0gRXJyb3IgY3JlYXRpbmcgd2F0Y2hlcjpgLCBlcnIpO1xuXHRcdFx0XHRlKGVycik7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfb25EaWRQb2xpY3lDaGFuZ2UodXBkYXRlOiBQb2xpY3lVcGRhdGU8SVN0cmluZ0RpY3Rpb25hcnk8UG9saWN5RGVmaW5pdGlvbj4+KTogdm9pZCB7XG5cdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBOYXRpdmVQb2xpY3lTZXJ2aWNlI19vbkRpZFBvbGljeUNoYW5nZSAtIFVwZGF0ZWQgcG9saWN5IHZhbHVlczogJHtKU09OLnN0cmluZ2lmeSh1cGRhdGUpfWApO1xuXG5cdFx0Zm9yIChjb25zdCBrZXkgaW4gdXBkYXRlKSB7XG5cdFx0XHRjb25zdCB2YWx1ZSA9IHVwZGF0ZVtrZXldIGFzIGFueTtcblxuXHRcdFx0aWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0dGhpcy5wb2xpY2llcy5kZWxldGUoa2V5KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMucG9saWNpZXMuc2V0KGtleSwgdmFsdWUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoT2JqZWN0LmtleXModXBkYXRlKSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyw2QkFBK0Q7QUFFeEUsU0FBUyxpQkFBaUI7QUFFMUIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxtQkFBbUI7QUFFckIsSUFBTSxzQkFBTixjQUFrQyxzQkFBZ0Q7QUFBQSxFQUt4RixZQUMrQixZQUNiLGFBQ2hCO0FBQ0QsVUFBTTtBQUh3QjtBQUNiO0FBTGxCLFNBQVEsWUFBWSxJQUFJLFVBQVU7QUFDbEMsU0FBaUIsVUFBVSxLQUFLLFVBQVUsSUFBSSxrQkFBMkIsQ0FBQztBQUFBLEVBTzFFO0FBQUEsRUFFQSxNQUFnQix5QkFBeUIsbUJBQXVFO0FBQy9HLFNBQUssV0FBVyxNQUFNLHdEQUF3RCxPQUFPLEtBQUssaUJBQWlCLEVBQUUsTUFBTSxxQkFBcUI7QUFFeEksVUFBTSxFQUFFLGNBQWMsSUFBSSxNQUFNLE9BQU8sd0JBQXdCO0FBRS9ELFVBQU0sS0FBSyxVQUFVLE1BQU0sTUFBTSxJQUFJLFFBQWMsQ0FBQyxHQUFHLE1BQU07QUFDNUQsVUFBSTtBQUNILGFBQUssUUFBUSxRQUFRLGNBQWMsS0FBSyxhQUFhLG1CQUFtQixZQUFVO0FBQ2pGLGVBQUssbUJBQW1CLE1BQU07QUFDOUIsWUFBRTtBQUFBLFFBQ0gsQ0FBQztBQUFBLE1BQ0YsU0FBUyxLQUFLO0FBQ2IsYUFBSyxXQUFXLE1BQU0sMEVBQTBFLEdBQUc7QUFDbkcsVUFBRSxHQUFHO0FBQUEsTUFDTjtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBQUEsRUFDSDtBQUFBLEVBRVEsbUJBQW1CLFFBQWlFO0FBQzNGLFNBQUssV0FBVyxNQUFNLG1FQUFtRSxLQUFLLFVBQVUsTUFBTSxDQUFDLEVBQUU7QUFFakgsZUFBVyxPQUFPLFFBQVE7QUFDekIsWUFBTSxRQUFRLE9BQU8sR0FBRztBQUV4QixVQUFJLFVBQVUsUUFBVztBQUN4QixhQUFLLFNBQVMsT0FBTyxHQUFHO0FBQUEsTUFDekIsT0FBTztBQUNOLGFBQUssU0FBUyxJQUFJLEtBQUssS0FBSztBQUFBLE1BQzdCO0FBQUEsSUFDRDtBQUVBLFNBQUssYUFBYSxLQUFLLE9BQU8sS0FBSyxNQUFNLENBQUM7QUFBQSxFQUMzQztBQUNEO0FBN0NhLHNCQUFOO0FBQUEsRUFNSjtBQUFBLEdBTlU7IiwKICAibmFtZXMiOiBbXQp9Cg==
