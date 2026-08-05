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
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { autorun } from "../../../../base/common/observable.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { observableConfigValue } from "../../../../platform/observable/common/platformObservableUtils.js";
import { mcpDiscoveryRegistry } from "../common/discovery/mcpDiscovery.js";
import { mcpEnabledSection } from "../common/mcpConfiguration.js";
let McpDiscovery = class extends Disposable {
  constructor(instantiationService, configurationService) {
    super();
    const enabled = observableConfigValue(mcpEnabledSection, true, configurationService);
    const store = this._register(new DisposableStore());
    this._register(autorun((reader) => {
      if (enabled.read(reader)) {
        for (const discovery of mcpDiscoveryRegistry.getAll()) {
          const inst = store.add(instantiationService.createInstance(discovery));
          inst.start();
        }
      } else {
        store.clear();
      }
    }));
  }
};
McpDiscovery.ID = "workbench.contrib.mcp.discovery";
McpDiscovery = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IConfigurationService)
], McpDiscovery);
export {
  McpDiscovery
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tY3AvYnJvd3Nlci9tY3BEaXNjb3ZlcnkudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgYXV0b3J1biB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IG9ic2VydmFibGVDb25maWdWYWx1ZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29ic2VydmFibGUvY29tbW9uL3BsYXRmb3JtT2JzZXJ2YWJsZVV0aWxzLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBtY3BEaXNjb3ZlcnlSZWdpc3RyeSB9IGZyb20gJy4uL2NvbW1vbi9kaXNjb3ZlcnkvbWNwRGlzY292ZXJ5LmpzJztcbmltcG9ydCB7IG1jcEVuYWJsZWRTZWN0aW9uIH0gZnJvbSAnLi4vY29tbW9uL21jcENvbmZpZ3VyYXRpb24uanMnO1xuXG5leHBvcnQgY2xhc3MgTWNwRGlzY292ZXJ5IGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5jb250cmliLm1jcC5kaXNjb3ZlcnknO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRjb25zdCBlbmFibGVkID0gb2JzZXJ2YWJsZUNvbmZpZ1ZhbHVlKG1jcEVuYWJsZWRTZWN0aW9uLCB0cnVlLCBjb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0Y29uc3Qgc3RvcmUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0aWYgKGVuYWJsZWQucmVhZChyZWFkZXIpKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgZGlzY292ZXJ5IG9mIG1jcERpc2NvdmVyeVJlZ2lzdHJ5LmdldEFsbCgpKSB7XG5cdFx0XHRcdFx0Y29uc3QgaW5zdCA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShkaXNjb3ZlcnkpKTtcblx0XHRcdFx0XHRpbnN0LnN0YXJ0KCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHN0b3JlLmNsZWFyKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsWUFBWSx1QkFBdUI7QUFDNUMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsNkJBQTZCO0FBRXRDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMseUJBQXlCO0FBRTNCLElBQU0sZUFBTixjQUEyQixXQUE2QztBQUFBLEVBRzlFLFlBQ3dCLHNCQUNBLHNCQUN0QjtBQUNELFVBQU07QUFFTixVQUFNLFVBQVUsc0JBQXNCLG1CQUFtQixNQUFNLG9CQUFvQjtBQUNuRixVQUFNLFFBQVEsS0FBSyxVQUFVLElBQUksZ0JBQWdCLENBQUM7QUFFbEQsU0FBSyxVQUFVLFFBQVEsWUFBVTtBQUNoQyxVQUFJLFFBQVEsS0FBSyxNQUFNLEdBQUc7QUFDekIsbUJBQVcsYUFBYSxxQkFBcUIsT0FBTyxHQUFHO0FBQ3RELGdCQUFNLE9BQU8sTUFBTSxJQUFJLHFCQUFxQixlQUFlLFNBQVMsQ0FBQztBQUNyRSxlQUFLLE1BQU07QUFBQSxRQUNaO0FBQUEsTUFDRCxPQUFPO0FBQ04sY0FBTSxNQUFNO0FBQUEsTUFDYjtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBQUEsRUFDSDtBQUNEO0FBdkJhLGFBQ1csS0FBSztBQURoQixlQUFOO0FBQUEsRUFJSjtBQUFBLEVBQ0E7QUFBQSxHQUxVOyIsCiAgIm5hbWVzIjogW10KfQo=
