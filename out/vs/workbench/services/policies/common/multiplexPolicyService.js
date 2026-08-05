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
import { Iterable } from "../../../../base/common/iterator.js";
import { Event } from "../../../../base/common/event.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { AbstractPolicyService } from "../../../../platform/policy/common/policy.js";
let MultiplexPolicyService = class extends AbstractPolicyService {
  constructor(policyServices, logService) {
    super();
    this.policyServices = policyServices;
    this.logService = logService;
    this.updatePolicies();
    this._register(Event.any(...this.policyServices.map((service) => service.onDidChange))((names) => {
      this.updatePolicies();
      this._onDidChange.fire(names);
    }));
  }
  async updatePolicyDefinitions(policyDefinitions) {
    await this._updatePolicyDefinitions(policyDefinitions);
    return Iterable.reduce(this.policies.entries(), (r, [name, value]) => ({ ...r, [name]: value }), {});
  }
  async _updatePolicyDefinitions(policyDefinitions) {
    await Promise.all(this.policyServices.map((service) => service.updatePolicyDefinitions(policyDefinitions)));
    this.updatePolicies();
  }
  updatePolicies() {
    this.policies.clear();
    const updated = [];
    for (const service of this.policyServices) {
      const definitions = service.policyDefinitions;
      for (const name in definitions) {
        const value = service.getPolicyValue(name);
        this.policyDefinitions[name] = definitions[name];
        if (value !== void 0) {
          updated.push(name);
          this.policies.set(name, value);
        }
      }
    }
    const changed = /* @__PURE__ */ new Set();
    for (const key of updated) {
      if (changed.has(key)) {
        this.logService.warn(`MultiplexPolicyService#_updatePolicyDefinitions - Found overlapping keys in policy services: ${key}`);
      }
      changed.add(key);
    }
  }
};
MultiplexPolicyService = __decorateClass([
  __decorateParam(1, ILogService)
], MultiplexPolicyService);
export {
  MultiplexPolicyService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvcG9saWNpZXMvY29tbW9uL211bHRpcGxleFBvbGljeVNlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBJU3RyaW5nRGljdGlvbmFyeSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbGxlY3Rpb25zLmpzJztcbmltcG9ydCB7IEl0ZXJhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaXRlcmF0b3IuanMnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IEFic3RyYWN0UG9saWN5U2VydmljZSwgSVBvbGljeVNlcnZpY2UsIFBvbGljeURlZmluaXRpb24sIFBvbGljeVZhbHVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcG9saWN5L2NvbW1vbi9wb2xpY3kuanMnO1xuXG5leHBvcnQgY2xhc3MgTXVsdGlwbGV4UG9saWN5U2VydmljZSBleHRlbmRzIEFic3RyYWN0UG9saWN5U2VydmljZSBpbXBsZW1lbnRzIElQb2xpY3lTZXJ2aWNlIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IHBvbGljeVNlcnZpY2VzOiBSZWFkb25seUFycmF5PElQb2xpY3lTZXJ2aWNlPixcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMudXBkYXRlUG9saWNpZXMoKTtcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5hbnkoLi4udGhpcy5wb2xpY3lTZXJ2aWNlcy5tYXAoc2VydmljZSA9PiBzZXJ2aWNlLm9uRGlkQ2hhbmdlKSkobmFtZXMgPT4ge1xuXHRcdFx0dGhpcy51cGRhdGVQb2xpY2llcygpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZShuYW1lcyk7XG5cdFx0fSkpO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgdXBkYXRlUG9saWN5RGVmaW5pdGlvbnMocG9saWN5RGVmaW5pdGlvbnM6IElTdHJpbmdEaWN0aW9uYXJ5PFBvbGljeURlZmluaXRpb24+KTogUHJvbWlzZTxJU3RyaW5nRGljdGlvbmFyeTxQb2xpY3lWYWx1ZT4+IHtcblx0XHRhd2FpdCB0aGlzLl91cGRhdGVQb2xpY3lEZWZpbml0aW9ucyhwb2xpY3lEZWZpbml0aW9ucyk7XG5cdFx0cmV0dXJuIEl0ZXJhYmxlLnJlZHVjZSh0aGlzLnBvbGljaWVzLmVudHJpZXMoKSwgKHIsIFtuYW1lLCB2YWx1ZV0pID0+ICh7IC4uLnIsIFtuYW1lXTogdmFsdWUgfSksIHt9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBfdXBkYXRlUG9saWN5RGVmaW5pdGlvbnMocG9saWN5RGVmaW5pdGlvbnM6IElTdHJpbmdEaWN0aW9uYXJ5PFBvbGljeURlZmluaXRpb24+KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgUHJvbWlzZS5hbGwodGhpcy5wb2xpY3lTZXJ2aWNlcy5tYXAoc2VydmljZSA9PiBzZXJ2aWNlLnVwZGF0ZVBvbGljeURlZmluaXRpb25zKHBvbGljeURlZmluaXRpb25zKSkpO1xuXHRcdHRoaXMudXBkYXRlUG9saWNpZXMoKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlUG9saWNpZXMoKTogdm9pZCB7XG5cdFx0dGhpcy5wb2xpY2llcy5jbGVhcigpO1xuXHRcdGNvbnN0IHVwZGF0ZWQ6IHN0cmluZ1tdID0gW107XG5cdFx0Zm9yIChjb25zdCBzZXJ2aWNlIG9mIHRoaXMucG9saWN5U2VydmljZXMpIHtcblx0XHRcdGNvbnN0IGRlZmluaXRpb25zID0gc2VydmljZS5wb2xpY3lEZWZpbml0aW9ucztcblx0XHRcdGZvciAoY29uc3QgbmFtZSBpbiBkZWZpbml0aW9ucykge1xuXHRcdFx0XHRjb25zdCB2YWx1ZSA9IHNlcnZpY2UuZ2V0UG9saWN5VmFsdWUobmFtZSk7XG5cdFx0XHRcdHRoaXMucG9saWN5RGVmaW5pdGlvbnNbbmFtZV0gPSBkZWZpbml0aW9uc1tuYW1lXTtcblx0XHRcdFx0aWYgKHZhbHVlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHR1cGRhdGVkLnB1c2gobmFtZSk7XG5cdFx0XHRcdFx0dGhpcy5wb2xpY2llcy5zZXQobmFtZSwgdmFsdWUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gQ2hlY2sgdGhhdCBubyByZXN1bHRzIGhhdmUgb3ZlcmxhcHBpbmcga2V5c1xuXHRcdGNvbnN0IGNoYW5nZWQgPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0XHRmb3IgKGNvbnN0IGtleSBvZiB1cGRhdGVkKSB7XG5cdFx0XHRpZiAoY2hhbmdlZC5oYXMoa2V5KSkge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2Uud2FybihgTXVsdGlwbGV4UG9saWN5U2VydmljZSNfdXBkYXRlUG9saWN5RGVmaW5pdGlvbnMgLSBGb3VuZCBvdmVybGFwcGluZyBrZXlzIGluIHBvbGljeSBzZXJ2aWNlczogJHtrZXl9YCk7XG5cdFx0XHR9XG5cdFx0XHRjaGFuZ2VkLmFkZChrZXkpO1xuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFNQSxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGFBQWE7QUFDdEIsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyw2QkFBNEU7QUFFOUUsSUFBTSx5QkFBTixjQUFxQyxzQkFBZ0Q7QUFBQSxFQUUzRixZQUNrQixnQkFDYSxZQUM3QjtBQUNELFVBQU07QUFIVztBQUNhO0FBSTlCLFNBQUssZUFBZTtBQUNwQixTQUFLLFVBQVUsTUFBTSxJQUFJLEdBQUcsS0FBSyxlQUFlLElBQUksYUFBVyxRQUFRLFdBQVcsQ0FBQyxFQUFFLFdBQVM7QUFDN0YsV0FBSyxlQUFlO0FBQ3BCLFdBQUssYUFBYSxLQUFLLEtBQUs7QUFBQSxJQUM3QixDQUFDLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFFQSxNQUFlLHdCQUF3QixtQkFBaUc7QUFDdkksVUFBTSxLQUFLLHlCQUF5QixpQkFBaUI7QUFDckQsV0FBTyxTQUFTLE9BQU8sS0FBSyxTQUFTLFFBQVEsR0FBRyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEtBQUssT0FBTyxFQUFFLEdBQUcsR0FBRyxDQUFDLElBQUksR0FBRyxNQUFNLElBQUksQ0FBQyxDQUFDO0FBQUEsRUFDcEc7QUFBQSxFQUVBLE1BQWdCLHlCQUF5QixtQkFBdUU7QUFDL0csVUFBTSxRQUFRLElBQUksS0FBSyxlQUFlLElBQUksYUFBVyxRQUFRLHdCQUF3QixpQkFBaUIsQ0FBQyxDQUFDO0FBQ3hHLFNBQUssZUFBZTtBQUFBLEVBQ3JCO0FBQUEsRUFFUSxpQkFBdUI7QUFDOUIsU0FBSyxTQUFTLE1BQU07QUFDcEIsVUFBTSxVQUFvQixDQUFDO0FBQzNCLGVBQVcsV0FBVyxLQUFLLGdCQUFnQjtBQUMxQyxZQUFNLGNBQWMsUUFBUTtBQUM1QixpQkFBVyxRQUFRLGFBQWE7QUFDL0IsY0FBTSxRQUFRLFFBQVEsZUFBZSxJQUFJO0FBQ3pDLGFBQUssa0JBQWtCLElBQUksSUFBSSxZQUFZLElBQUk7QUFDL0MsWUFBSSxVQUFVLFFBQVc7QUFDeEIsa0JBQVEsS0FBSyxJQUFJO0FBQ2pCLGVBQUssU0FBUyxJQUFJLE1BQU0sS0FBSztBQUFBLFFBQzlCO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFHQSxVQUFNLFVBQVUsb0JBQUksSUFBWTtBQUNoQyxlQUFXLE9BQU8sU0FBUztBQUMxQixVQUFJLFFBQVEsSUFBSSxHQUFHLEdBQUc7QUFDckIsYUFBSyxXQUFXLEtBQUssZ0dBQWdHLEdBQUcsRUFBRTtBQUFBLE1BQzNIO0FBQ0EsY0FBUSxJQUFJLEdBQUc7QUFBQSxJQUNoQjtBQUFBLEVBQ0Q7QUFDRDtBQWpEYSx5QkFBTjtBQUFBLEVBSUo7QUFBQSxHQUpVOyIsCiAgIm5hbWVzIjogW10KfQo=
