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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IEnvironmentMainService } from "../../../../platform/environment/electron-main/environmentMainService.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IUpdateService, StateType } from "../../../../platform/update/common/update.js";
let VoidMainUpdateService = class extends Disposable {
  constructor(_productService, _envMainService, _updateService) {
    super();
    this._productService = _productService;
    this._envMainService = _envMainService;
    this._updateService = _updateService;
  }
  async check(explicit) {
    const isDevMode = !this._envMainService.isBuilt;
    if (isDevMode) {
      return { message: null };
    }
    if (this._updateService.state.type === StateType.Disabled) {
      if (!explicit)
        return { message: null };
    }
    this._updateService.checkForUpdates(false);
    console.log("updateState", this._updateService.state);
    if (this._updateService.state.type === StateType.Uninitialized) {
      return { message: explicit ? "Checking for updates soon..." : null, action: explicit ? "reinstall" : void 0 };
    }
    if (this._updateService.state.type === StateType.Idle) {
      return { message: explicit ? "No updates found!" : null, action: explicit ? "reinstall" : void 0 };
    }
    if (this._updateService.state.type === StateType.CheckingForUpdates) {
      return { message: explicit ? "Checking for updates..." : null };
    }
    if (this._updateService.state.type === StateType.AvailableForDownload) {
      return { message: "A new update is available!", action: "download" };
    }
    if (this._updateService.state.type === StateType.Downloading) {
      return { message: explicit ? "Currently downloading update..." : null };
    }
    if (this._updateService.state.type === StateType.Downloaded) {
      return { message: explicit ? "An update is ready to be applied!" : null, action: "apply" };
    }
    if (this._updateService.state.type === StateType.Updating) {
      return { message: explicit ? "Applying update..." : null };
    }
    if (this._updateService.state.type === StateType.Ready) {
      return { message: "Restart Void to update!", action: "restart" };
    }
    if (this._updateService.state.type === StateType.Disabled) {
      return await this._manualCheckGHTagIfDisabled(explicit);
    }
    return null;
  }
  async _manualCheckGHTagIfDisabled(explicit) {
    try {
      const response = await fetch("https://api.github.com/repos/voideditor/binaries/releases/latest");
      const data = await response.json();
      const version = data.tag_name;
      const myVersion = this._productService.version;
      const latestVersion = version;
      const isUpToDate = myVersion === latestVersion;
      let message;
      let action;
      if (explicit) {
        if (response.ok) {
          if (!isUpToDate) {
            message = "A new version of Void is available! Please reinstall (auto-updates are disabled on this OS) - it only takes a second!";
            action = "reinstall";
          } else {
            message = "Void is up-to-date!";
          }
        } else {
          message = `An error occurred when fetching the latest GitHub release tag. Please try again in ~5 minutes, or reinstall.`;
          action = "reinstall";
        }
      } else {
        if (response.ok && !isUpToDate) {
          message = "A new version of Void is available! Please reinstall (auto-updates are disabled on this OS) - it only takes a second!";
          action = "reinstall";
        } else {
          message = null;
        }
      }
      return { message, action };
    } catch (e) {
      if (explicit) {
        return {
          message: `An error occurred when fetching the latest GitHub release tag: ${e}. Please try again in ~5 minutes.`,
          action: "reinstall"
        };
      } else {
        return { message: null };
      }
    }
  }
};
VoidMainUpdateService = __decorateClass([
  __decorateParam(0, IProductService),
  __decorateParam(1, IEnvironmentMainService),
  __decorateParam(2, IUpdateService)
], VoidMainUpdateService);
export {
  VoidMainUpdateService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2VsZWN0cm9uLW1haW4vdm9pZFVwZGF0ZU1haW5TZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IDIwMjUgR2xhc3MgRGV2dG9vbHMsIEluYy4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wLiBTZWUgTElDRU5TRS50eHQgZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJRW52aXJvbm1lbnRNYWluU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2Vudmlyb25tZW50L2VsZWN0cm9uLW1haW4vZW52aXJvbm1lbnRNYWluU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVXBkYXRlU2VydmljZSwgU3RhdGVUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXBkYXRlL2NvbW1vbi91cGRhdGUuanMnO1xuaW1wb3J0IHsgSVZvaWRVcGRhdGVTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL3ZvaWRVcGRhdGVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFZvaWRDaGVja1VwZGF0ZVJlc3Bvc2UgfSBmcm9tICcuLi9jb21tb24vdm9pZFVwZGF0ZVNlcnZpY2VUeXBlcy5qcyc7XG5cblxuXG5leHBvcnQgY2xhc3MgVm9pZE1haW5VcGRhdGVTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElWb2lkVXBkYXRlU2VydmljZSB7XG5cdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Byb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElFbnZpcm9ubWVudE1haW5TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2Vudk1haW5TZXJ2aWNlOiBJRW52aXJvbm1lbnRNYWluU2VydmljZSxcblx0XHRASVVwZGF0ZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdXBkYXRlU2VydmljZTogSVVwZGF0ZVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKClcblx0fVxuXG5cblx0YXN5bmMgY2hlY2soZXhwbGljaXQ6IGJvb2xlYW4pOiBQcm9taXNlPFZvaWRDaGVja1VwZGF0ZVJlc3Bvc2U+IHtcblxuXHRcdGNvbnN0IGlzRGV2TW9kZSA9ICF0aGlzLl9lbnZNYWluU2VydmljZS5pc0J1aWx0IC8vIGZvdW5kIGluIGFic3RyYWN0VXBkYXRlU2VydmljZS50c1xuXG5cdFx0aWYgKGlzRGV2TW9kZSkge1xuXHRcdFx0cmV0dXJuIHsgbWVzc2FnZTogbnVsbCB9IGFzIGNvbnN0XG5cdFx0fVxuXG5cdFx0Ly8gaWYgZGlzYWJsZWQgYW5kIG5vdCBleHBsaWNpdGx5IGNoZWNraW5nLCByZXR1cm4gZWFybHlcblx0XHRpZiAodGhpcy5fdXBkYXRlU2VydmljZS5zdGF0ZS50eXBlID09PSBTdGF0ZVR5cGUuRGlzYWJsZWQpIHtcblx0XHRcdGlmICghZXhwbGljaXQpXG5cdFx0XHRcdHJldHVybiB7IG1lc3NhZ2U6IG51bGwgfSBhcyBjb25zdFxuXHRcdH1cblxuXHRcdHRoaXMuX3VwZGF0ZVNlcnZpY2UuY2hlY2tGb3JVcGRhdGVzKGZhbHNlKSAvLyBpbXBsaWNpdHkgY2hlY2ssIHRoZW4gaGFuZGxlIHJlc3VsdCBvdXJzZWx2ZXNcblxuXHRcdGNvbnNvbGUubG9nKCd1cGRhdGVTdGF0ZScsIHRoaXMuX3VwZGF0ZVNlcnZpY2Uuc3RhdGUpXG5cblx0XHRpZiAodGhpcy5fdXBkYXRlU2VydmljZS5zdGF0ZS50eXBlID09PSBTdGF0ZVR5cGUuVW5pbml0aWFsaXplZCkge1xuXHRcdFx0Ly8gVGhlIHVwZGF0ZSBzZXJ2aWNlIGhhc24ndCBiZWVuIGluaXRpYWxpemVkIHlldFxuXHRcdFx0cmV0dXJuIHsgbWVzc2FnZTogZXhwbGljaXQgPyAnQ2hlY2tpbmcgZm9yIHVwZGF0ZXMgc29vbi4uLicgOiBudWxsLCBhY3Rpb246IGV4cGxpY2l0ID8gJ3JlaW5zdGFsbCcgOiB1bmRlZmluZWQgfSBhcyBjb25zdFxuXHRcdH1cblxuXHRcdGlmICh0aGlzLl91cGRhdGVTZXJ2aWNlLnN0YXRlLnR5cGUgPT09IFN0YXRlVHlwZS5JZGxlKSB7XG5cdFx0XHQvLyBObyB1cGRhdGVzIGN1cnJlbnRseSBhdmFpbGFibGVcblx0XHRcdHJldHVybiB7IG1lc3NhZ2U6IGV4cGxpY2l0ID8gJ05vIHVwZGF0ZXMgZm91bmQhJyA6IG51bGwsIGFjdGlvbjogZXhwbGljaXQgPyAncmVpbnN0YWxsJyA6IHVuZGVmaW5lZCB9IGFzIGNvbnN0XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX3VwZGF0ZVNlcnZpY2Uuc3RhdGUudHlwZSA9PT0gU3RhdGVUeXBlLkNoZWNraW5nRm9yVXBkYXRlcykge1xuXHRcdFx0Ly8gQ3VycmVudGx5IGNoZWNraW5nIGZvciB1cGRhdGVzXG5cdFx0XHRyZXR1cm4geyBtZXNzYWdlOiBleHBsaWNpdCA/ICdDaGVja2luZyBmb3IgdXBkYXRlcy4uLicgOiBudWxsIH0gYXMgY29uc3Rcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fdXBkYXRlU2VydmljZS5zdGF0ZS50eXBlID09PSBTdGF0ZVR5cGUuQXZhaWxhYmxlRm9yRG93bmxvYWQpIHtcblx0XHRcdC8vIFVwZGF0ZSBhdmFpbGFibGUgYnV0IHJlcXVpcmVzIG1hbnVhbCBkb3dubG9hZCAobWFpbmx5IGZvciBMaW51eClcblx0XHRcdHJldHVybiB7IG1lc3NhZ2U6ICdBIG5ldyB1cGRhdGUgaXMgYXZhaWxhYmxlIScsIGFjdGlvbjogJ2Rvd25sb2FkJywgfSBhcyBjb25zdFxuXHRcdH1cblxuXHRcdGlmICh0aGlzLl91cGRhdGVTZXJ2aWNlLnN0YXRlLnR5cGUgPT09IFN0YXRlVHlwZS5Eb3dubG9hZGluZykge1xuXHRcdFx0Ly8gVXBkYXRlIGlzIGN1cnJlbnRseSBiZWluZyBkb3dubG9hZGVkXG5cdFx0XHRyZXR1cm4geyBtZXNzYWdlOiBleHBsaWNpdCA/ICdDdXJyZW50bHkgZG93bmxvYWRpbmcgdXBkYXRlLi4uJyA6IG51bGwgfSBhcyBjb25zdFxuXHRcdH1cblxuXHRcdGlmICh0aGlzLl91cGRhdGVTZXJ2aWNlLnN0YXRlLnR5cGUgPT09IFN0YXRlVHlwZS5Eb3dubG9hZGVkKSB7XG5cdFx0XHQvLyBVcGRhdGUgaGFzIGJlZW4gZG93bmxvYWRlZCBidXQgbm90IHlldCByZWFkeVxuXHRcdFx0cmV0dXJuIHsgbWVzc2FnZTogZXhwbGljaXQgPyAnQW4gdXBkYXRlIGlzIHJlYWR5IHRvIGJlIGFwcGxpZWQhJyA6IG51bGwsIGFjdGlvbjogJ2FwcGx5JyB9IGFzIGNvbnN0XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX3VwZGF0ZVNlcnZpY2Uuc3RhdGUudHlwZSA9PT0gU3RhdGVUeXBlLlVwZGF0aW5nKSB7XG5cdFx0XHQvLyBVcGRhdGUgaXMgYmVpbmcgYXBwbGllZFxuXHRcdFx0cmV0dXJuIHsgbWVzc2FnZTogZXhwbGljaXQgPyAnQXBwbHlpbmcgdXBkYXRlLi4uJyA6IG51bGwgfSBhcyBjb25zdFxuXHRcdH1cblxuXHRcdGlmICh0aGlzLl91cGRhdGVTZXJ2aWNlLnN0YXRlLnR5cGUgPT09IFN0YXRlVHlwZS5SZWFkeSkge1xuXHRcdFx0Ly8gVXBkYXRlIGlzIHJlYWR5XG5cdFx0XHRyZXR1cm4geyBtZXNzYWdlOiAnUmVzdGFydCBWb2lkIHRvIHVwZGF0ZSEnLCBhY3Rpb246ICdyZXN0YXJ0JyB9IGFzIGNvbnN0XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX3VwZGF0ZVNlcnZpY2Uuc3RhdGUudHlwZSA9PT0gU3RhdGVUeXBlLkRpc2FibGVkKSB7XG5cdFx0XHRyZXR1cm4gYXdhaXQgdGhpcy5fbWFudWFsQ2hlY2tHSFRhZ0lmRGlzYWJsZWQoZXhwbGljaXQpXG5cdFx0fVxuXHRcdHJldHVybiBudWxsXG5cdH1cblxuXG5cblxuXG5cblx0cHJpdmF0ZSBhc3luYyBfbWFudWFsQ2hlY2tHSFRhZ0lmRGlzYWJsZWQoZXhwbGljaXQ6IGJvb2xlYW4pOiBQcm9taXNlPFZvaWRDaGVja1VwZGF0ZVJlc3Bvc2U+IHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCgnaHR0cHM6Ly9hcGkuZ2l0aHViLmNvbS9yZXBvcy92b2lkZWRpdG9yL2JpbmFyaWVzL3JlbGVhc2VzL2xhdGVzdCcpO1xuXG5cdFx0XHRjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuXHRcdFx0Y29uc3QgdmVyc2lvbiA9IGRhdGEudGFnX25hbWU7XG5cblx0XHRcdGNvbnN0IG15VmVyc2lvbiA9IHRoaXMuX3Byb2R1Y3RTZXJ2aWNlLnZlcnNpb25cblx0XHRcdGNvbnN0IGxhdGVzdFZlcnNpb24gPSB2ZXJzaW9uXG5cblx0XHRcdGNvbnN0IGlzVXBUb0RhdGUgPSBteVZlcnNpb24gPT09IGxhdGVzdFZlcnNpb24gLy8gb25seSBtYWtlcyBzZW5zZSBpZiByZXNwb25zZS5va1xuXG5cdFx0XHRsZXQgbWVzc2FnZTogc3RyaW5nIHwgbnVsbFxuXHRcdFx0bGV0IGFjdGlvbjogJ3JlaW5zdGFsbCcgfCB1bmRlZmluZWRcblxuXHRcdFx0Ly8gZXhwbGljaXRcblx0XHRcdGlmIChleHBsaWNpdCkge1xuXHRcdFx0XHRpZiAocmVzcG9uc2Uub2spIHtcblx0XHRcdFx0XHRpZiAoIWlzVXBUb0RhdGUpIHtcblx0XHRcdFx0XHRcdG1lc3NhZ2UgPSAnQSBuZXcgdmVyc2lvbiBvZiBWb2lkIGlzIGF2YWlsYWJsZSEgUGxlYXNlIHJlaW5zdGFsbCAoYXV0by11cGRhdGVzIGFyZSBkaXNhYmxlZCBvbiB0aGlzIE9TKSAtIGl0IG9ubHkgdGFrZXMgYSBzZWNvbmQhJ1xuXHRcdFx0XHRcdFx0YWN0aW9uID0gJ3JlaW5zdGFsbCdcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0XHRtZXNzYWdlID0gJ1ZvaWQgaXMgdXAtdG8tZGF0ZSEnXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdG1lc3NhZ2UgPSBgQW4gZXJyb3Igb2NjdXJyZWQgd2hlbiBmZXRjaGluZyB0aGUgbGF0ZXN0IEdpdEh1YiByZWxlYXNlIHRhZy4gUGxlYXNlIHRyeSBhZ2FpbiBpbiB+NSBtaW51dGVzLCBvciByZWluc3RhbGwuYFxuXHRcdFx0XHRcdGFjdGlvbiA9ICdyZWluc3RhbGwnXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdC8vIG5vdCBleHBsaWNpdFxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdGlmIChyZXNwb25zZS5vayAmJiAhaXNVcFRvRGF0ZSkge1xuXHRcdFx0XHRcdG1lc3NhZ2UgPSAnQSBuZXcgdmVyc2lvbiBvZiBWb2lkIGlzIGF2YWlsYWJsZSEgUGxlYXNlIHJlaW5zdGFsbCAoYXV0by11cGRhdGVzIGFyZSBkaXNhYmxlZCBvbiB0aGlzIE9TKSAtIGl0IG9ubHkgdGFrZXMgYSBzZWNvbmQhJ1xuXHRcdFx0XHRcdGFjdGlvbiA9ICdyZWluc3RhbGwnXG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0bWVzc2FnZSA9IG51bGxcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHsgbWVzc2FnZSwgYWN0aW9uIH0gYXMgY29uc3Rcblx0XHR9XG5cdFx0Y2F0Y2ggKGUpIHtcblx0XHRcdGlmIChleHBsaWNpdCkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdG1lc3NhZ2U6IGBBbiBlcnJvciBvY2N1cnJlZCB3aGVuIGZldGNoaW5nIHRoZSBsYXRlc3QgR2l0SHViIHJlbGVhc2UgdGFnOiAke2V9LiBQbGVhc2UgdHJ5IGFnYWluIGluIH41IG1pbnV0ZXMuYCxcblx0XHRcdFx0XHRhY3Rpb246ICdyZWluc3RhbGwnLFxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0cmV0dXJuIHsgbWVzc2FnZTogbnVsbCB9IGFzIGNvbnN0XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsZ0JBQWdCLGlCQUFpQjtBQU1uQyxJQUFNLHdCQUFOLGNBQW9DLFdBQXlDO0FBQUEsRUFHbkYsWUFDbUMsaUJBQ1EsaUJBQ1QsZ0JBQ2hDO0FBQ0QsVUFBTTtBQUo0QjtBQUNRO0FBQ1Q7QUFBQSxFQUdsQztBQUFBLEVBR0EsTUFBTSxNQUFNLFVBQW9EO0FBRS9ELFVBQU0sWUFBWSxDQUFDLEtBQUssZ0JBQWdCO0FBRXhDLFFBQUksV0FBVztBQUNkLGFBQU8sRUFBRSxTQUFTLEtBQUs7QUFBQSxJQUN4QjtBQUdBLFFBQUksS0FBSyxlQUFlLE1BQU0sU0FBUyxVQUFVLFVBQVU7QUFDMUQsVUFBSSxDQUFDO0FBQ0osZUFBTyxFQUFFLFNBQVMsS0FBSztBQUFBLElBQ3pCO0FBRUEsU0FBSyxlQUFlLGdCQUFnQixLQUFLO0FBRXpDLFlBQVEsSUFBSSxlQUFlLEtBQUssZUFBZSxLQUFLO0FBRXBELFFBQUksS0FBSyxlQUFlLE1BQU0sU0FBUyxVQUFVLGVBQWU7QUFFL0QsYUFBTyxFQUFFLFNBQVMsV0FBVyxpQ0FBaUMsTUFBTSxRQUFRLFdBQVcsY0FBYyxPQUFVO0FBQUEsSUFDaEg7QUFFQSxRQUFJLEtBQUssZUFBZSxNQUFNLFNBQVMsVUFBVSxNQUFNO0FBRXRELGFBQU8sRUFBRSxTQUFTLFdBQVcsc0JBQXNCLE1BQU0sUUFBUSxXQUFXLGNBQWMsT0FBVTtBQUFBLElBQ3JHO0FBRUEsUUFBSSxLQUFLLGVBQWUsTUFBTSxTQUFTLFVBQVUsb0JBQW9CO0FBRXBFLGFBQU8sRUFBRSxTQUFTLFdBQVcsNEJBQTRCLEtBQUs7QUFBQSxJQUMvRDtBQUVBLFFBQUksS0FBSyxlQUFlLE1BQU0sU0FBUyxVQUFVLHNCQUFzQjtBQUV0RSxhQUFPLEVBQUUsU0FBUyw4QkFBOEIsUUFBUSxXQUFZO0FBQUEsSUFDckU7QUFFQSxRQUFJLEtBQUssZUFBZSxNQUFNLFNBQVMsVUFBVSxhQUFhO0FBRTdELGFBQU8sRUFBRSxTQUFTLFdBQVcsb0NBQW9DLEtBQUs7QUFBQSxJQUN2RTtBQUVBLFFBQUksS0FBSyxlQUFlLE1BQU0sU0FBUyxVQUFVLFlBQVk7QUFFNUQsYUFBTyxFQUFFLFNBQVMsV0FBVyxzQ0FBc0MsTUFBTSxRQUFRLFFBQVE7QUFBQSxJQUMxRjtBQUVBLFFBQUksS0FBSyxlQUFlLE1BQU0sU0FBUyxVQUFVLFVBQVU7QUFFMUQsYUFBTyxFQUFFLFNBQVMsV0FBVyx1QkFBdUIsS0FBSztBQUFBLElBQzFEO0FBRUEsUUFBSSxLQUFLLGVBQWUsTUFBTSxTQUFTLFVBQVUsT0FBTztBQUV2RCxhQUFPLEVBQUUsU0FBUywyQkFBMkIsUUFBUSxVQUFVO0FBQUEsSUFDaEU7QUFFQSxRQUFJLEtBQUssZUFBZSxNQUFNLFNBQVMsVUFBVSxVQUFVO0FBQzFELGFBQU8sTUFBTSxLQUFLLDRCQUE0QixRQUFRO0FBQUEsSUFDdkQ7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBT0EsTUFBYyw0QkFBNEIsVUFBb0Q7QUFDN0YsUUFBSTtBQUNILFlBQU0sV0FBVyxNQUFNLE1BQU0sa0VBQWtFO0FBRS9GLFlBQU0sT0FBTyxNQUFNLFNBQVMsS0FBSztBQUNqQyxZQUFNLFVBQVUsS0FBSztBQUVyQixZQUFNLFlBQVksS0FBSyxnQkFBZ0I7QUFDdkMsWUFBTSxnQkFBZ0I7QUFFdEIsWUFBTSxhQUFhLGNBQWM7QUFFakMsVUFBSTtBQUNKLFVBQUk7QUFHSixVQUFJLFVBQVU7QUFDYixZQUFJLFNBQVMsSUFBSTtBQUNoQixjQUFJLENBQUMsWUFBWTtBQUNoQixzQkFBVTtBQUNWLHFCQUFTO0FBQUEsVUFDVixPQUNLO0FBQ0osc0JBQVU7QUFBQSxVQUNYO0FBQUEsUUFDRCxPQUNLO0FBQ0osb0JBQVU7QUFDVixtQkFBUztBQUFBLFFBQ1Y7QUFBQSxNQUNELE9BRUs7QUFDSixZQUFJLFNBQVMsTUFBTSxDQUFDLFlBQVk7QUFDL0Isb0JBQVU7QUFDVixtQkFBUztBQUFBLFFBQ1YsT0FDSztBQUNKLG9CQUFVO0FBQUEsUUFDWDtBQUFBLE1BQ0Q7QUFDQSxhQUFPLEVBQUUsU0FBUyxPQUFPO0FBQUEsSUFDMUIsU0FDTyxHQUFHO0FBQ1QsVUFBSSxVQUFVO0FBQ2IsZUFBTztBQUFBLFVBQ04sU0FBUyxrRUFBa0UsQ0FBQztBQUFBLFVBQzVFLFFBQVE7QUFBQSxRQUNUO0FBQUEsTUFDRCxPQUNLO0FBQ0osZUFBTyxFQUFFLFNBQVMsS0FBSztBQUFBLE1BQ3hCO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFDRDtBQXhJYSx3QkFBTjtBQUFBLEVBSUo7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBTlU7IiwKICAibmFtZXMiOiBbXQp9Cg==
