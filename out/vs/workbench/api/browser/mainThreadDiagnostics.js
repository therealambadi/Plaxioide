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
import { IMarkerService } from "../../../platform/markers/common/markers.js";
import { URI } from "../../../base/common/uri.js";
import { MainContext, ExtHostContext } from "../common/extHost.protocol.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { IUriIdentityService } from "../../../platform/uriIdentity/common/uriIdentity.js";
let MainThreadDiagnostics = class {
  constructor(extHostContext, _markerService, _uriIdentService) {
    this._markerService = _markerService;
    this._uriIdentService = _uriIdentService;
    this._activeOwners = /* @__PURE__ */ new Set();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostDiagnostics);
    this._markerListener = this._markerService.onMarkerChanged(this._forwardMarkers, this);
  }
  dispose() {
    this._markerListener.dispose();
    this._activeOwners.forEach((owner) => this._markerService.changeAll(owner, []));
    this._activeOwners.clear();
  }
  _forwardMarkers(resources) {
    const data = [];
    for (const resource of resources) {
      const allMarkerData = this._markerService.read({ resource });
      if (allMarkerData.length === 0) {
        data.push([resource, []]);
      } else {
        const forgeinMarkerData = allMarkerData.filter((marker) => !this._activeOwners.has(marker.owner));
        if (forgeinMarkerData.length > 0) {
          data.push([resource, forgeinMarkerData]);
        }
      }
    }
    if (data.length > 0) {
      this._proxy.$acceptMarkersChange(data);
    }
  }
  $changeMany(owner, entries) {
    for (const entry of entries) {
      const [uri, markers] = entry;
      if (markers) {
        for (const marker of markers) {
          if (marker.relatedInformation) {
            for (const relatedInformation of marker.relatedInformation) {
              relatedInformation.resource = URI.revive(relatedInformation.resource);
            }
          }
          if (marker.code && typeof marker.code !== "string") {
            marker.code.target = URI.revive(marker.code.target);
          }
        }
      }
      this._markerService.changeOne(owner, this._uriIdentService.asCanonicalUri(URI.revive(uri)), markers);
    }
    this._activeOwners.add(owner);
  }
  $clear(owner) {
    this._markerService.changeAll(owner, []);
    this._activeOwners.delete(owner);
  }
};
MainThreadDiagnostics = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadDiagnostics),
  __decorateParam(1, IMarkerService),
  __decorateParam(2, IUriIdentityService)
], MainThreadDiagnostics);
export {
  MainThreadDiagnostics
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZERpYWdub3N0aWNzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSU1hcmtlclNlcnZpY2UsIElNYXJrZXJEYXRhIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vbWFya2Vycy9jb21tb24vbWFya2Vycy5qcyc7XG5pbXBvcnQgeyBVUkksIFVyaUNvbXBvbmVudHMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgTWFpblRocmVhZERpYWdub3N0aWNzU2hhcGUsIE1haW5Db250ZXh0LCBFeHRIb3N0RGlhZ25vc3RpY3NTaGFwZSwgRXh0SG9zdENvbnRleHQgfSBmcm9tICcuLi9jb21tb24vZXh0SG9zdC5wcm90b2NvbC5qcyc7XG5pbXBvcnQgeyBleHRIb3N0TmFtZWRDdXN0b21lciwgSUV4dEhvc3RDb250ZXh0IH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0SG9zdEN1c3RvbWVycy5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcblxuQGV4dEhvc3ROYW1lZEN1c3RvbWVyKE1haW5Db250ZXh0Lk1haW5UaHJlYWREaWFnbm9zdGljcylcbmV4cG9ydCBjbGFzcyBNYWluVGhyZWFkRGlhZ25vc3RpY3MgaW1wbGVtZW50cyBNYWluVGhyZWFkRGlhZ25vc3RpY3NTaGFwZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfYWN0aXZlT3duZXJzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcHJveHk6IEV4dEhvc3REaWFnbm9zdGljc1NoYXBlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9tYXJrZXJMaXN0ZW5lcjogSURpc3Bvc2FibGU7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0ZXh0SG9zdENvbnRleHQ6IElFeHRIb3N0Q29udGV4dCxcblx0XHRASU1hcmtlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbWFya2VyU2VydmljZTogSU1hcmtlclNlcnZpY2UsXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdXJpSWRlbnRTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHQpIHtcblx0XHR0aGlzLl9wcm94eSA9IGV4dEhvc3RDb250ZXh0LmdldFByb3h5KEV4dEhvc3RDb250ZXh0LkV4dEhvc3REaWFnbm9zdGljcyk7XG5cblx0XHR0aGlzLl9tYXJrZXJMaXN0ZW5lciA9IHRoaXMuX21hcmtlclNlcnZpY2Uub25NYXJrZXJDaGFuZ2VkKHRoaXMuX2ZvcndhcmRNYXJrZXJzLCB0aGlzKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fbWFya2VyTGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX2FjdGl2ZU93bmVycy5mb3JFYWNoKG93bmVyID0+IHRoaXMuX21hcmtlclNlcnZpY2UuY2hhbmdlQWxsKG93bmVyLCBbXSkpO1xuXHRcdHRoaXMuX2FjdGl2ZU93bmVycy5jbGVhcigpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZm9yd2FyZE1hcmtlcnMocmVzb3VyY2VzOiByZWFkb25seSBVUklbXSk6IHZvaWQge1xuXHRcdGNvbnN0IGRhdGE6IFtVcmlDb21wb25lbnRzLCBJTWFya2VyRGF0YVtdXVtdID0gW107XG5cdFx0Zm9yIChjb25zdCByZXNvdXJjZSBvZiByZXNvdXJjZXMpIHtcblx0XHRcdGNvbnN0IGFsbE1hcmtlckRhdGEgPSB0aGlzLl9tYXJrZXJTZXJ2aWNlLnJlYWQoeyByZXNvdXJjZSB9KTtcblx0XHRcdGlmIChhbGxNYXJrZXJEYXRhLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRkYXRhLnB1c2goW3Jlc291cmNlLCBbXV0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgZm9yZ2Vpbk1hcmtlckRhdGEgPSBhbGxNYXJrZXJEYXRhLmZpbHRlcihtYXJrZXIgPT4gIXRoaXMuX2FjdGl2ZU93bmVycy5oYXMobWFya2VyLm93bmVyKSk7XG5cdFx0XHRcdGlmIChmb3JnZWluTWFya2VyRGF0YS5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0ZGF0YS5wdXNoKFtyZXNvdXJjZSwgZm9yZ2Vpbk1hcmtlckRhdGFdKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoZGF0YS5sZW5ndGggPiAwKSB7XG5cdFx0XHR0aGlzLl9wcm94eS4kYWNjZXB0TWFya2Vyc0NoYW5nZShkYXRhKTtcblx0XHR9XG5cdH1cblxuXHQkY2hhbmdlTWFueShvd25lcjogc3RyaW5nLCBlbnRyaWVzOiBbVXJpQ29tcG9uZW50cywgSU1hcmtlckRhdGFbXV1bXSk6IHZvaWQge1xuXHRcdGZvciAoY29uc3QgZW50cnkgb2YgZW50cmllcykge1xuXHRcdFx0Y29uc3QgW3VyaSwgbWFya2Vyc10gPSBlbnRyeTtcblx0XHRcdGlmIChtYXJrZXJzKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgbWFya2VyIG9mIG1hcmtlcnMpIHtcblx0XHRcdFx0XHRpZiAobWFya2VyLnJlbGF0ZWRJbmZvcm1hdGlvbikge1xuXHRcdFx0XHRcdFx0Zm9yIChjb25zdCByZWxhdGVkSW5mb3JtYXRpb24gb2YgbWFya2VyLnJlbGF0ZWRJbmZvcm1hdGlvbikge1xuXHRcdFx0XHRcdFx0XHRyZWxhdGVkSW5mb3JtYXRpb24ucmVzb3VyY2UgPSBVUkkucmV2aXZlKHJlbGF0ZWRJbmZvcm1hdGlvbi5yZXNvdXJjZSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChtYXJrZXIuY29kZSAmJiB0eXBlb2YgbWFya2VyLmNvZGUgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0XHRtYXJrZXIuY29kZS50YXJnZXQgPSBVUkkucmV2aXZlKG1hcmtlci5jb2RlLnRhcmdldCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9tYXJrZXJTZXJ2aWNlLmNoYW5nZU9uZShvd25lciwgdGhpcy5fdXJpSWRlbnRTZXJ2aWNlLmFzQ2Fub25pY2FsVXJpKFVSSS5yZXZpdmUodXJpKSksIG1hcmtlcnMpO1xuXHRcdH1cblx0XHR0aGlzLl9hY3RpdmVPd25lcnMuYWRkKG93bmVyKTtcblx0fVxuXG5cdCRjbGVhcihvd25lcjogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5fbWFya2VyU2VydmljZS5jaGFuZ2VBbGwob3duZXIsIFtdKTtcblx0XHR0aGlzLl9hY3RpdmVPd25lcnMuZGVsZXRlKG93bmVyKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLHNCQUFtQztBQUM1QyxTQUFTLFdBQTBCO0FBQ25DLFNBQXFDLGFBQXNDLHNCQUFzQjtBQUNqRyxTQUFTLDRCQUE2QztBQUV0RCxTQUFTLDJCQUEyQjtBQUc3QixJQUFNLHdCQUFOLE1BQWtFO0FBQUEsRUFPeEUsWUFDQyxnQkFDaUMsZ0JBQ0ssa0JBQ3JDO0FBRmdDO0FBQ0s7QUFSdkMsU0FBaUIsZ0JBQWdCLG9CQUFJLElBQVk7QUFVaEQsU0FBSyxTQUFTLGVBQWUsU0FBUyxlQUFlLGtCQUFrQjtBQUV2RSxTQUFLLGtCQUFrQixLQUFLLGVBQWUsZ0JBQWdCLEtBQUssaUJBQWlCLElBQUk7QUFBQSxFQUN0RjtBQUFBLEVBRUEsVUFBZ0I7QUFDZixTQUFLLGdCQUFnQixRQUFRO0FBQzdCLFNBQUssY0FBYyxRQUFRLFdBQVMsS0FBSyxlQUFlLFVBQVUsT0FBTyxDQUFDLENBQUMsQ0FBQztBQUM1RSxTQUFLLGNBQWMsTUFBTTtBQUFBLEVBQzFCO0FBQUEsRUFFUSxnQkFBZ0IsV0FBaUM7QUFDeEQsVUFBTSxPQUF5QyxDQUFDO0FBQ2hELGVBQVcsWUFBWSxXQUFXO0FBQ2pDLFlBQU0sZ0JBQWdCLEtBQUssZUFBZSxLQUFLLEVBQUUsU0FBUyxDQUFDO0FBQzNELFVBQUksY0FBYyxXQUFXLEdBQUc7QUFDL0IsYUFBSyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztBQUFBLE1BQ3pCLE9BQU87QUFDTixjQUFNLG9CQUFvQixjQUFjLE9BQU8sWUFBVSxDQUFDLEtBQUssY0FBYyxJQUFJLE9BQU8sS0FBSyxDQUFDO0FBQzlGLFlBQUksa0JBQWtCLFNBQVMsR0FBRztBQUNqQyxlQUFLLEtBQUssQ0FBQyxVQUFVLGlCQUFpQixDQUFDO0FBQUEsUUFDeEM7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUNBLFFBQUksS0FBSyxTQUFTLEdBQUc7QUFDcEIsV0FBSyxPQUFPLHFCQUFxQixJQUFJO0FBQUEsSUFDdEM7QUFBQSxFQUNEO0FBQUEsRUFFQSxZQUFZLE9BQWUsU0FBaUQ7QUFDM0UsZUFBVyxTQUFTLFNBQVM7QUFDNUIsWUFBTSxDQUFDLEtBQUssT0FBTyxJQUFJO0FBQ3ZCLFVBQUksU0FBUztBQUNaLG1CQUFXLFVBQVUsU0FBUztBQUM3QixjQUFJLE9BQU8sb0JBQW9CO0FBQzlCLHVCQUFXLHNCQUFzQixPQUFPLG9CQUFvQjtBQUMzRCxpQ0FBbUIsV0FBVyxJQUFJLE9BQU8sbUJBQW1CLFFBQVE7QUFBQSxZQUNyRTtBQUFBLFVBQ0Q7QUFDQSxjQUFJLE9BQU8sUUFBUSxPQUFPLE9BQU8sU0FBUyxVQUFVO0FBQ25ELG1CQUFPLEtBQUssU0FBUyxJQUFJLE9BQU8sT0FBTyxLQUFLLE1BQU07QUFBQSxVQUNuRDtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQ0EsV0FBSyxlQUFlLFVBQVUsT0FBTyxLQUFLLGlCQUFpQixlQUFlLElBQUksT0FBTyxHQUFHLENBQUMsR0FBRyxPQUFPO0FBQUEsSUFDcEc7QUFDQSxTQUFLLGNBQWMsSUFBSSxLQUFLO0FBQUEsRUFDN0I7QUFBQSxFQUVBLE9BQU8sT0FBcUI7QUFDM0IsU0FBSyxlQUFlLFVBQVUsT0FBTyxDQUFDLENBQUM7QUFDdkMsU0FBSyxjQUFjLE9BQU8sS0FBSztBQUFBLEVBQ2hDO0FBQ0Q7QUFqRWEsd0JBQU47QUFBQSxFQUROLHFCQUFxQixZQUFZLHFCQUFxQjtBQUFBLEVBVXBEO0FBQUEsRUFDQTtBQUFBLEdBVlU7IiwKICAibmFtZXMiOiBbXQp9Cg==
