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
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { IMarkerService, MarkerSeverity } from "../../../../platform/markers/common/markers.js";
import { IDecorationsService } from "../../../services/decorations/common/decorations.js";
import { dispose } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { listErrorForeground, listWarningForeground } from "../../../../platform/theme/common/colorRegistry.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { Extensions as ConfigurationExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
class MarkersDecorationsProvider {
  constructor(_markerService) {
    this._markerService = _markerService;
    this.label = localize("label", "Problems");
    this.onDidChange = _markerService.onMarkerChanged;
  }
  provideDecorations(resource) {
    const markers = this._markerService.read({
      resource,
      severities: MarkerSeverity.Error | MarkerSeverity.Warning
    });
    let first;
    for (const marker of markers) {
      if (!first || marker.severity > first.severity) {
        first = marker;
      }
    }
    if (!first) {
      return void 0;
    }
    return {
      weight: 100 * first.severity,
      bubble: true,
      tooltip: markers.length === 1 ? localize("tooltip.1", "1 problem in this file") : localize("tooltip.N", "{0} problems in this file", markers.length),
      letter: markers.length < 10 ? markers.length.toString() : "9+",
      color: first.severity === MarkerSeverity.Error ? listErrorForeground : listWarningForeground
    };
  }
}
let MarkersFileDecorations = class {
  constructor(_markerService, _decorationsService, _configurationService) {
    this._markerService = _markerService;
    this._decorationsService = _decorationsService;
    this._configurationService = _configurationService;
    this._disposables = [
      this._configurationService.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("problems.visibility")) {
          this._updateEnablement();
        }
      })
    ];
    this._updateEnablement();
  }
  dispose() {
    dispose(this._provider);
    dispose(this._disposables);
  }
  _updateEnablement() {
    const problem = this._configurationService.getValue("problems.visibility");
    if (problem === void 0) {
      return;
    }
    const value = this._configurationService.getValue("problems");
    const shouldEnable = problem && value.decorations.enabled;
    if (shouldEnable === this._enabled) {
      if (!problem || !value.decorations.enabled) {
        this._provider?.dispose();
        this._provider = void 0;
      }
      return;
    }
    this._enabled = shouldEnable;
    if (this._enabled) {
      const provider = new MarkersDecorationsProvider(this._markerService);
      this._provider = this._decorationsService.registerDecorationsProvider(provider);
    } else if (this._provider) {
      this._provider.dispose();
    }
  }
};
MarkersFileDecorations = __decorateClass([
  __decorateParam(0, IMarkerService),
  __decorateParam(1, IDecorationsService),
  __decorateParam(2, IConfigurationService)
], MarkersFileDecorations);
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  "id": "problems",
  "order": 101,
  "type": "object",
  "properties": {
    "problems.decorations.enabled": {
      "markdownDescription": localize("markers.showOnFile", "Show Errors & Warnings on files and folder. Overwritten by {0} when it is off.", "`#problems.visibility#`"),
      "type": "boolean",
      "default": true
    }
  }
});
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(MarkersFileDecorations, LifecyclePhase.Restored);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tYXJrZXJzL2Jyb3dzZXIvbWFya2Vyc0ZpbGVEZWNvcmF0aW9ucy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24sIElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnksIEV4dGVuc2lvbnMgYXMgV29ya2JlbmNoRXh0ZW5zaW9ucyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IElNYXJrZXJTZXJ2aWNlLCBJTWFya2VyLCBNYXJrZXJTZXZlcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL21hcmtlcnMvY29tbW9uL21hcmtlcnMuanMnO1xuaW1wb3J0IHsgSURlY29yYXRpb25zU2VydmljZSwgSURlY29yYXRpb25zUHJvdmlkZXIsIElEZWNvcmF0aW9uRGF0YSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2RlY29yYXRpb25zL2NvbW1vbi9kZWNvcmF0aW9ucy5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSwgZGlzcG9zZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBsaXN0RXJyb3JGb3JlZ3JvdW5kLCBsaXN0V2FybmluZ0ZvcmVncm91bmQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uUmVnaXN0cnksIEV4dGVuc2lvbnMgYXMgQ29uZmlndXJhdGlvbkV4dGVuc2lvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgTGlmZWN5Y2xlUGhhc2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9saWZlY3ljbGUvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5cbmNsYXNzIE1hcmtlcnNEZWNvcmF0aW9uc1Byb3ZpZGVyIGltcGxlbWVudHMgSURlY29yYXRpb25zUHJvdmlkZXIge1xuXG5cdHJlYWRvbmx5IGxhYmVsOiBzdHJpbmcgPSBsb2NhbGl6ZSgnbGFiZWwnLCBcIlByb2JsZW1zXCIpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZTogRXZlbnQ8cmVhZG9ubHkgVVJJW10+O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX21hcmtlclNlcnZpY2U6IElNYXJrZXJTZXJ2aWNlXG5cdCkge1xuXHRcdHRoaXMub25EaWRDaGFuZ2UgPSBfbWFya2VyU2VydmljZS5vbk1hcmtlckNoYW5nZWQ7XG5cdH1cblxuXHRwcm92aWRlRGVjb3JhdGlvbnMocmVzb3VyY2U6IFVSSSk6IElEZWNvcmF0aW9uRGF0YSB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgbWFya2VycyA9IHRoaXMuX21hcmtlclNlcnZpY2UucmVhZCh7XG5cdFx0XHRyZXNvdXJjZSxcblx0XHRcdHNldmVyaXRpZXM6IE1hcmtlclNldmVyaXR5LkVycm9yIHwgTWFya2VyU2V2ZXJpdHkuV2FybmluZ1xuXHRcdH0pO1xuXHRcdGxldCBmaXJzdDogSU1hcmtlciB8IHVuZGVmaW5lZDtcblx0XHRmb3IgKGNvbnN0IG1hcmtlciBvZiBtYXJrZXJzKSB7XG5cdFx0XHRpZiAoIWZpcnN0IHx8IG1hcmtlci5zZXZlcml0eSA+IGZpcnN0LnNldmVyaXR5KSB7XG5cdFx0XHRcdGZpcnN0ID0gbWFya2VyO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICghZmlyc3QpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHdlaWdodDogMTAwICogZmlyc3Quc2V2ZXJpdHksXG5cdFx0XHRidWJibGU6IHRydWUsXG5cdFx0XHR0b29sdGlwOiBtYXJrZXJzLmxlbmd0aCA9PT0gMSA/IGxvY2FsaXplKCd0b29sdGlwLjEnLCBcIjEgcHJvYmxlbSBpbiB0aGlzIGZpbGVcIikgOiBsb2NhbGl6ZSgndG9vbHRpcC5OJywgXCJ7MH0gcHJvYmxlbXMgaW4gdGhpcyBmaWxlXCIsIG1hcmtlcnMubGVuZ3RoKSxcblx0XHRcdGxldHRlcjogbWFya2Vycy5sZW5ndGggPCAxMCA/IG1hcmtlcnMubGVuZ3RoLnRvU3RyaW5nKCkgOiAnOSsnLFxuXHRcdFx0Y29sb3I6IGZpcnN0LnNldmVyaXR5ID09PSBNYXJrZXJTZXZlcml0eS5FcnJvciA/IGxpc3RFcnJvckZvcmVncm91bmQgOiBsaXN0V2FybmluZ0ZvcmVncm91bmQsXG5cdFx0fTtcblx0fVxufVxuXG5jbGFzcyBNYXJrZXJzRmlsZURlY29yYXRpb25zIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZGlzcG9zYWJsZXM6IElEaXNwb3NhYmxlW107XG5cdHByaXZhdGUgX3Byb3ZpZGVyPzogSURpc3Bvc2FibGU7XG5cdHByaXZhdGUgX2VuYWJsZWQ/OiBib29sZWFuO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTWFya2VyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9tYXJrZXJTZXJ2aWNlOiBJTWFya2VyU2VydmljZSxcblx0XHRASURlY29yYXRpb25zU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9kZWNvcmF0aW9uc1NlcnZpY2U6IElEZWNvcmF0aW9uc1NlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlXG5cdCkge1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzID0gW1xuXHRcdFx0dGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbigncHJvYmxlbXMudmlzaWJpbGl0eScpKSB7XG5cdFx0XHRcdFx0dGhpcy5fdXBkYXRlRW5hYmxlbWVudCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSxcblx0XHRdO1xuXHRcdHRoaXMuX3VwZGF0ZUVuYWJsZW1lbnQoKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0ZGlzcG9zZSh0aGlzLl9wcm92aWRlcik7XG5cdFx0ZGlzcG9zZSh0aGlzLl9kaXNwb3NhYmxlcyk7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVFbmFibGVtZW50KCk6IHZvaWQge1xuXHRcdGNvbnN0IHByb2JsZW0gPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgncHJvYmxlbXMudmlzaWJpbGl0eScpO1xuXHRcdGlmIChwcm9ibGVtID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgdmFsdWUgPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTx7IGRlY29yYXRpb25zOiB7IGVuYWJsZWQ6IGJvb2xlYW4gfSB9PigncHJvYmxlbXMnKTtcblx0XHRjb25zdCBzaG91bGRFbmFibGUgPSAocHJvYmxlbSAmJiB2YWx1ZS5kZWNvcmF0aW9ucy5lbmFibGVkKTtcblxuXHRcdGlmIChzaG91bGRFbmFibGUgPT09IHRoaXMuX2VuYWJsZWQpIHtcblx0XHRcdGlmICghcHJvYmxlbSB8fCAhdmFsdWUuZGVjb3JhdGlvbnMuZW5hYmxlZCkge1xuXHRcdFx0XHR0aGlzLl9wcm92aWRlcj8uZGlzcG9zZSgpO1xuXHRcdFx0XHR0aGlzLl9wcm92aWRlciA9IHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9lbmFibGVkID0gc2hvdWxkRW5hYmxlIGFzIGJvb2xlYW47XG5cdFx0aWYgKHRoaXMuX2VuYWJsZWQpIHtcblx0XHRcdGNvbnN0IHByb3ZpZGVyID0gbmV3IE1hcmtlcnNEZWNvcmF0aW9uc1Byb3ZpZGVyKHRoaXMuX21hcmtlclNlcnZpY2UpO1xuXHRcdFx0dGhpcy5fcHJvdmlkZXIgPSB0aGlzLl9kZWNvcmF0aW9uc1NlcnZpY2UucmVnaXN0ZXJEZWNvcmF0aW9uc1Byb3ZpZGVyKHByb3ZpZGVyKTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuX3Byb3ZpZGVyKSB7XG5cdFx0XHR0aGlzLl9wcm92aWRlci5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9XG59XG5cblJlZ2lzdHJ5LmFzPElDb25maWd1cmF0aW9uUmVnaXN0cnk+KENvbmZpZ3VyYXRpb25FeHRlbnNpb25zLkNvbmZpZ3VyYXRpb24pLnJlZ2lzdGVyQ29uZmlndXJhdGlvbih7XG5cdCdpZCc6ICdwcm9ibGVtcycsXG5cdCdvcmRlcic6IDEwMSxcblx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0J3Byb2JsZW1zLmRlY29yYXRpb25zLmVuYWJsZWQnOiB7XG5cdFx0XHQnbWFya2Rvd25EZXNjcmlwdGlvbic6IGxvY2FsaXplKCdtYXJrZXJzLnNob3dPbkZpbGUnLCBcIlNob3cgRXJyb3JzICYgV2FybmluZ3Mgb24gZmlsZXMgYW5kIGZvbGRlci4gT3ZlcndyaXR0ZW4gYnkgezB9IHdoZW4gaXQgaXMgb2ZmLlwiLCAnYCNwcm9ibGVtcy52aXNpYmlsaXR5I2AnKSxcblx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0J2RlZmF1bHQnOiB0cnVlXG5cdFx0fVxuXHR9XG59KTtcblxuLy8gcmVnaXN0ZXIgZmlsZSBkZWNvcmF0aW9uc1xuUmVnaXN0cnkuYXM8SVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeT4oV29ya2JlbmNoRXh0ZW5zaW9ucy5Xb3JrYmVuY2gpXG5cdC5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbihNYXJrZXJzRmlsZURlY29yYXRpb25zLCBMaWZlY3ljbGVQaGFzZS5SZXN0b3JlZCk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQWtFLGNBQWMsMkJBQTJCO0FBQzNHLFNBQVMsZ0JBQXlCLHNCQUFzQjtBQUN4RCxTQUFTLDJCQUFrRTtBQUMzRSxTQUFzQixlQUFlO0FBR3JDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMscUJBQXFCLDZCQUE2QjtBQUMzRCxTQUFTLDZCQUE2QjtBQUN0QyxTQUFpQyxjQUFjLCtCQUErQjtBQUM5RSxTQUFTLHNCQUFzQjtBQUUvQixNQUFNLDJCQUEyRDtBQUFBLEVBS2hFLFlBQ2tCLGdCQUNoQjtBQURnQjtBQUpsQixTQUFTLFFBQWdCLFNBQVMsU0FBUyxVQUFVO0FBTXBELFNBQUssY0FBYyxlQUFlO0FBQUEsRUFDbkM7QUFBQSxFQUVBLG1CQUFtQixVQUE0QztBQUM5RCxVQUFNLFVBQVUsS0FBSyxlQUFlLEtBQUs7QUFBQSxNQUN4QztBQUFBLE1BQ0EsWUFBWSxlQUFlLFFBQVEsZUFBZTtBQUFBLElBQ25ELENBQUM7QUFDRCxRQUFJO0FBQ0osZUFBVyxVQUFVLFNBQVM7QUFDN0IsVUFBSSxDQUFDLFNBQVMsT0FBTyxXQUFXLE1BQU0sVUFBVTtBQUMvQyxnQkFBUTtBQUFBLE1BQ1Q7QUFBQSxJQUNEO0FBRUEsUUFBSSxDQUFDLE9BQU87QUFDWCxhQUFPO0FBQUEsSUFDUjtBQUVBLFdBQU87QUFBQSxNQUNOLFFBQVEsTUFBTSxNQUFNO0FBQUEsTUFDcEIsUUFBUTtBQUFBLE1BQ1IsU0FBUyxRQUFRLFdBQVcsSUFBSSxTQUFTLGFBQWEsd0JBQXdCLElBQUksU0FBUyxhQUFhLDZCQUE2QixRQUFRLE1BQU07QUFBQSxNQUNuSixRQUFRLFFBQVEsU0FBUyxLQUFLLFFBQVEsT0FBTyxTQUFTLElBQUk7QUFBQSxNQUMxRCxPQUFPLE1BQU0sYUFBYSxlQUFlLFFBQVEsc0JBQXNCO0FBQUEsSUFDeEU7QUFBQSxFQUNEO0FBQ0Q7QUFFQSxJQUFNLHlCQUFOLE1BQStEO0FBQUEsRUFNOUQsWUFDa0MsZ0JBQ0sscUJBQ0UsdUJBQ3ZDO0FBSGdDO0FBQ0s7QUFDRTtBQUV4QyxTQUFLLGVBQWU7QUFBQSxNQUNuQixLQUFLLHNCQUFzQix5QkFBeUIsT0FBSztBQUN4RCxZQUFJLEVBQUUscUJBQXFCLHFCQUFxQixHQUFHO0FBQ2xELGVBQUssa0JBQWtCO0FBQUEsUUFDeEI7QUFBQSxNQUNELENBQUM7QUFBQSxJQUNGO0FBQ0EsU0FBSyxrQkFBa0I7QUFBQSxFQUN4QjtBQUFBLEVBRUEsVUFBZ0I7QUFDZixZQUFRLEtBQUssU0FBUztBQUN0QixZQUFRLEtBQUssWUFBWTtBQUFBLEVBQzFCO0FBQUEsRUFFUSxvQkFBMEI7QUFDakMsVUFBTSxVQUFVLEtBQUssc0JBQXNCLFNBQVMscUJBQXFCO0FBQ3pFLFFBQUksWUFBWSxRQUFXO0FBQzFCO0FBQUEsSUFDRDtBQUNBLFVBQU0sUUFBUSxLQUFLLHNCQUFzQixTQUFnRCxVQUFVO0FBQ25HLFVBQU0sZUFBZ0IsV0FBVyxNQUFNLFlBQVk7QUFFbkQsUUFBSSxpQkFBaUIsS0FBSyxVQUFVO0FBQ25DLFVBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxZQUFZLFNBQVM7QUFDM0MsYUFBSyxXQUFXLFFBQVE7QUFDeEIsYUFBSyxZQUFZO0FBQUEsTUFDbEI7QUFDQTtBQUFBLElBQ0Q7QUFFQSxTQUFLLFdBQVc7QUFDaEIsUUFBSSxLQUFLLFVBQVU7QUFDbEIsWUFBTSxXQUFXLElBQUksMkJBQTJCLEtBQUssY0FBYztBQUNuRSxXQUFLLFlBQVksS0FBSyxvQkFBb0IsNEJBQTRCLFFBQVE7QUFBQSxJQUMvRSxXQUFXLEtBQUssV0FBVztBQUMxQixXQUFLLFVBQVUsUUFBUTtBQUFBLElBQ3hCO0FBQUEsRUFDRDtBQUNEO0FBbERNLHlCQUFOO0FBQUEsRUFPRztBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FURztBQW9ETixTQUFTLEdBQTJCLHdCQUF3QixhQUFhLEVBQUUsc0JBQXNCO0FBQUEsRUFDaEcsTUFBTTtBQUFBLEVBQ04sU0FBUztBQUFBLEVBQ1QsUUFBUTtBQUFBLEVBQ1IsY0FBYztBQUFBLElBQ2IsZ0NBQWdDO0FBQUEsTUFDL0IsdUJBQXVCLFNBQVMsc0JBQXNCLGtGQUFrRix5QkFBeUI7QUFBQSxNQUNqSyxRQUFRO0FBQUEsTUFDUixXQUFXO0FBQUEsSUFDWjtBQUFBLEVBQ0Q7QUFDRCxDQUFDO0FBR0QsU0FBUyxHQUFvQyxvQkFBb0IsU0FBUyxFQUN4RSw4QkFBOEIsd0JBQXdCLGVBQWUsUUFBUTsiLAogICJuYW1lcyI6IFtdCn0K
