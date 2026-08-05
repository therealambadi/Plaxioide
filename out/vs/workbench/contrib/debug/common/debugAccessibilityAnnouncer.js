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
import { IDebugService } from "./debug.js";
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { Expression } from "./debugModel.js";
let DebugWatchAccessibilityAnnouncer = class extends Disposable {
  constructor(_debugService, _logService, _accessibilityService, _configurationService) {
    super();
    this._debugService = _debugService;
    this._logService = _logService;
    this._accessibilityService = _accessibilityService;
    this._configurationService = _configurationService;
    this._listener = this._register(new MutableDisposable());
    this._setListener();
    this._register(_configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("accessibility.debugWatchVariableAnnouncements")) {
        this._setListener();
      }
    }));
  }
  _setListener() {
    const value = this._configurationService.getValue("accessibility.debugWatchVariableAnnouncements");
    if (value && !this._listener.value) {
      this._listener.value = this._debugService.getModel().onDidChangeWatchExpressionValue((e) => {
        if (!e || e.value === Expression.DEFAULT_VALUE) {
          return;
        }
        this._accessibilityService.alert(`${e.name} = ${e.value}`);
        this._logService.trace(`debugAccessibilityAnnouncerValueChanged ${e.name} ${e.value}`);
      });
    } else {
      this._listener.clear();
    }
  }
};
DebugWatchAccessibilityAnnouncer.ID = "workbench.contrib.debugWatchAccessibilityAnnouncer";
DebugWatchAccessibilityAnnouncer = __decorateClass([
  __decorateParam(0, IDebugService),
  __decorateParam(1, ILogService),
  __decorateParam(2, IAccessibilityService),
  __decorateParam(3, IConfigurationService)
], DebugWatchAccessibilityAnnouncer);
export {
  DebugWatchAccessibilityAnnouncer
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9jb21tb24vZGVidWdBY2Nlc3NpYmlsaXR5QW5ub3VuY2VyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSURlYnVnU2VydmljZSB9IGZyb20gJy4vZGVidWcuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgSURpc3Bvc2FibGUsIE11dGFibGVEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElBY2Nlc3NpYmlsaXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvY29tbW9uL2FjY2Vzc2liaWxpdHkuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBFeHByZXNzaW9uIH0gZnJvbSAnLi9kZWJ1Z01vZGVsLmpzJztcblxuZXhwb3J0IGNsYXNzIERlYnVnV2F0Y2hBY2Nlc3NpYmlsaXR5QW5ub3VuY2VyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXHRzdGF0aWMgSUQgPSAnd29ya2JlbmNoLmNvbnRyaWIuZGVidWdXYXRjaEFjY2Vzc2liaWxpdHlBbm5vdW5jZXInO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9saXN0ZW5lcjogTXV0YWJsZURpc3Bvc2FibGU8SURpc3Bvc2FibGU+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRASURlYnVnU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9kZWJ1Z1NlcnZpY2U6IElEZWJ1Z1NlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJQWNjZXNzaWJpbGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfYWNjZXNzaWJpbGl0eVNlcnZpY2U6IElBY2Nlc3NpYmlsaXR5U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9zZXRMaXN0ZW5lcigpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKF9jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbignYWNjZXNzaWJpbGl0eS5kZWJ1Z1dhdGNoVmFyaWFibGVBbm5vdW5jZW1lbnRzJykpIHtcblx0XHRcdFx0dGhpcy5fc2V0TGlzdGVuZXIoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIF9zZXRMaXN0ZW5lcigpOiB2b2lkIHtcblx0XHRjb25zdCB2YWx1ZSA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdhY2Nlc3NpYmlsaXR5LmRlYnVnV2F0Y2hWYXJpYWJsZUFubm91bmNlbWVudHMnKTtcblx0XHRpZiAodmFsdWUgJiYgIXRoaXMuX2xpc3RlbmVyLnZhbHVlKSB7XG5cdFx0XHR0aGlzLl9saXN0ZW5lci52YWx1ZSA9IHRoaXMuX2RlYnVnU2VydmljZS5nZXRNb2RlbCgpLm9uRGlkQ2hhbmdlV2F0Y2hFeHByZXNzaW9uVmFsdWUoKGUpID0+IHtcblx0XHRcdFx0aWYgKCFlIHx8IGUudmFsdWUgPT09IEV4cHJlc3Npb24uREVGQVVMVF9WQUxVRSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFRPRE86IGdldCB1c2VyIGZlZWRiYWNrLCBwZXJoYXBzIHNldHRpbmcgdG8gY29uZmlndXJlIHZlcmJvc2l0eSArIHdoZXRoZXIgdmFsdWUsIG5hbWUsIG5laXRoZXIsIG9yIGJvdGggYXJlIGFubm91bmNlZFxuXHRcdFx0XHR0aGlzLl9hY2Nlc3NpYmlsaXR5U2VydmljZS5hbGVydChgJHtlLm5hbWV9ID0gJHtlLnZhbHVlfWApO1xuXHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKGBkZWJ1Z0FjY2Vzc2liaWxpdHlBbm5vdW5jZXJWYWx1ZUNoYW5nZWQgJHtlLm5hbWV9ICR7ZS52YWx1ZX1gKTtcblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9saXN0ZW5lci5jbGVhcigpO1xuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLFlBQXlCLHlCQUF5QjtBQUUzRCxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGtCQUFrQjtBQUVwQixJQUFNLG1DQUFOLGNBQStDLFdBQTZDO0FBQUEsRUFHbEcsWUFDaUMsZUFDRixhQUNVLHVCQUNBLHVCQUN2QztBQUNELFVBQU07QUFMMEI7QUFDRjtBQUNVO0FBQ0E7QUFMekMsU0FBaUIsWUFBNEMsS0FBSyxVQUFVLElBQUksa0JBQWtCLENBQUM7QUFRbEcsU0FBSyxhQUFhO0FBQ2xCLFNBQUssVUFBVSxzQkFBc0IseUJBQXlCLE9BQUs7QUFDbEUsVUFBSSxFQUFFLHFCQUFxQiwrQ0FBK0MsR0FBRztBQUM1RSxhQUFLLGFBQWE7QUFBQSxNQUNuQjtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBQUEsRUFDSDtBQUFBLEVBRVEsZUFBcUI7QUFDNUIsVUFBTSxRQUFRLEtBQUssc0JBQXNCLFNBQVMsK0NBQStDO0FBQ2pHLFFBQUksU0FBUyxDQUFDLEtBQUssVUFBVSxPQUFPO0FBQ25DLFdBQUssVUFBVSxRQUFRLEtBQUssY0FBYyxTQUFTLEVBQUUsZ0NBQWdDLENBQUMsTUFBTTtBQUMzRixZQUFJLENBQUMsS0FBSyxFQUFFLFVBQVUsV0FBVyxlQUFlO0FBQy9DO0FBQUEsUUFDRDtBQUdBLGFBQUssc0JBQXNCLE1BQU0sR0FBRyxFQUFFLElBQUksTUFBTSxFQUFFLEtBQUssRUFBRTtBQUN6RCxhQUFLLFlBQVksTUFBTSwyQ0FBMkMsRUFBRSxJQUFJLElBQUksRUFBRSxLQUFLLEVBQUU7QUFBQSxNQUN0RixDQUFDO0FBQUEsSUFDRixPQUFPO0FBQ04sV0FBSyxVQUFVLE1BQU07QUFBQSxJQUN0QjtBQUFBLEVBQ0Q7QUFDRDtBQWxDYSxpQ0FDTCxLQUFLO0FBREEsbUNBQU47QUFBQSxFQUlKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FQVTsiLAogICJuYW1lcyI6IFtdCn0K
