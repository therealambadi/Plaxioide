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
import { memoize } from "../../../base/common/decorators.js";
import { join } from "../../../base/common/path.js";
import { isLinux } from "../../../base/common/platform.js";
import { createStaticIPCHandle } from "../../../base/parts/ipc/node/ipc.net.js";
import { IEnvironmentService } from "../common/environment.js";
import { NativeEnvironmentService } from "../node/environmentService.js";
import { refineServiceDecorator } from "../../instantiation/common/instantiation.js";
const IEnvironmentMainService = refineServiceDecorator(IEnvironmentService);
class EnvironmentMainService extends NativeEnvironmentService {
  constructor() {
    super(...arguments);
    this._snapEnv = {};
  }
  get backupHome() {
    return join(this.userDataPath, "Backups");
  }
  get mainIPCHandle() {
    return createStaticIPCHandle(this.userDataPath, "main", this.productService.version);
  }
  get mainLockfile() {
    return join(this.userDataPath, "code.lock");
  }
  get disableUpdates() {
    return !!this.args["disable-updates"];
  }
  get crossOriginIsolated() {
    return !!this.args["enable-coi"];
  }
  get codeCachePath() {
    return process.env["VSCODE_CODE_CACHE_PATH"] || void 0;
  }
  get useCodeCache() {
    return !!this.codeCachePath;
  }
  unsetSnapExportedVariables() {
    if (!isLinux) {
      return;
    }
    for (const key in process.env) {
      if (key.endsWith("_VSCODE_SNAP_ORIG")) {
        const originalKey = key.slice(0, -17);
        if (this._snapEnv[originalKey]) {
          continue;
        }
        if (process.env[originalKey]) {
          this._snapEnv[originalKey] = process.env[originalKey];
        }
        if (process.env[key]) {
          process.env[originalKey] = process.env[key];
        } else {
          delete process.env[originalKey];
        }
      }
    }
  }
  restoreSnapExportedVariables() {
    if (!isLinux) {
      return;
    }
    for (const key in this._snapEnv) {
      process.env[key] = this._snapEnv[key];
      delete this._snapEnv[key];
    }
  }
}
__decorateClass([
  memoize
], EnvironmentMainService.prototype, "backupHome", 1);
__decorateClass([
  memoize
], EnvironmentMainService.prototype, "mainIPCHandle", 1);
__decorateClass([
  memoize
], EnvironmentMainService.prototype, "mainLockfile", 1);
__decorateClass([
  memoize
], EnvironmentMainService.prototype, "disableUpdates", 1);
__decorateClass([
  memoize
], EnvironmentMainService.prototype, "crossOriginIsolated", 1);
__decorateClass([
  memoize
], EnvironmentMainService.prototype, "codeCachePath", 1);
__decorateClass([
  memoize
], EnvironmentMainService.prototype, "useCodeCache", 1);
export {
  EnvironmentMainService,
  IEnvironmentMainService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9lbnZpcm9ubWVudC9lbGVjdHJvbi1tYWluL2Vudmlyb25tZW50TWFpblNlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBtZW1vaXplIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZGVjb3JhdG9ycy5qcyc7XG5pbXBvcnQgeyBqb2luIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgeyBpc0xpbnV4IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgY3JlYXRlU3RhdGljSVBDSGFuZGxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9wYXJ0cy9pcGMvbm9kZS9pcGMubmV0LmpzJztcbmltcG9ydCB7IElFbnZpcm9ubWVudFNlcnZpY2UsIElOYXRpdmVFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vZW52aXJvbm1lbnQuanMnO1xuaW1wb3J0IHsgTmF0aXZlRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vbm9kZS9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgcmVmaW5lU2VydmljZURlY29yYXRvciB9IGZyb20gJy4uLy4uL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuXG5leHBvcnQgY29uc3QgSUVudmlyb25tZW50TWFpblNlcnZpY2UgPSByZWZpbmVTZXJ2aWNlRGVjb3JhdG9yPElFbnZpcm9ubWVudFNlcnZpY2UsIElFbnZpcm9ubWVudE1haW5TZXJ2aWNlPihJRW52aXJvbm1lbnRTZXJ2aWNlKTtcblxuLyoqXG4gKiBBIHN1YmNsYXNzIG9mIHRoZSBgSU5hdGl2ZUVudmlyb25tZW50U2VydmljZWAgdG8gYmUgdXNlZCBvbmx5IGluIGVsZWN0cm9uLW1haW5cbiAqIGVudmlyb25tZW50cy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJRW52aXJvbm1lbnRNYWluU2VydmljZSBleHRlbmRzIElOYXRpdmVFbnZpcm9ubWVudFNlcnZpY2Uge1xuXG5cdC8vIC0tLSBiYWNrdXAgcGF0aHNcblx0cmVhZG9ubHkgYmFja3VwSG9tZTogc3RyaW5nO1xuXG5cdC8vIC0tLSBWOCBjb2RlIGNhY2hpbmdcblx0cmVhZG9ubHkgY29kZUNhY2hlUGF0aDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSB1c2VDb2RlQ2FjaGU6IGJvb2xlYW47XG5cblx0Ly8gLS0tIElQQ1xuXHRyZWFkb25seSBtYWluSVBDSGFuZGxlOiBzdHJpbmc7XG5cdHJlYWRvbmx5IG1haW5Mb2NrZmlsZTogc3RyaW5nO1xuXG5cdC8vIC0tLSBjb25maWdcblx0cmVhZG9ubHkgZGlzYWJsZVVwZGF0ZXM6IGJvb2xlYW47XG5cblx0dW5zZXRTbmFwRXhwb3J0ZWRWYXJpYWJsZXMoKTogdm9pZDtcblx0cmVzdG9yZVNuYXBFeHBvcnRlZFZhcmlhYmxlcygpOiB2b2lkO1xufVxuXG5leHBvcnQgY2xhc3MgRW52aXJvbm1lbnRNYWluU2VydmljZSBleHRlbmRzIE5hdGl2ZUVudmlyb25tZW50U2VydmljZSBpbXBsZW1lbnRzIElFbnZpcm9ubWVudE1haW5TZXJ2aWNlIHtcblxuXHRwcml2YXRlIF9zbmFwRW52OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG5cblx0QG1lbW9pemVcblx0Z2V0IGJhY2t1cEhvbWUoKTogc3RyaW5nIHsgcmV0dXJuIGpvaW4odGhpcy51c2VyRGF0YVBhdGgsICdCYWNrdXBzJyk7IH1cblxuXHRAbWVtb2l6ZVxuXHRnZXQgbWFpbklQQ0hhbmRsZSgpOiBzdHJpbmcgeyByZXR1cm4gY3JlYXRlU3RhdGljSVBDSGFuZGxlKHRoaXMudXNlckRhdGFQYXRoLCAnbWFpbicsIHRoaXMucHJvZHVjdFNlcnZpY2UudmVyc2lvbik7IH1cblxuXHRAbWVtb2l6ZVxuXHRnZXQgbWFpbkxvY2tmaWxlKCk6IHN0cmluZyB7IHJldHVybiBqb2luKHRoaXMudXNlckRhdGFQYXRoLCAnY29kZS5sb2NrJyk7IH1cblxuXHRAbWVtb2l6ZVxuXHRnZXQgZGlzYWJsZVVwZGF0ZXMoKTogYm9vbGVhbiB7IHJldHVybiAhIXRoaXMuYXJnc1snZGlzYWJsZS11cGRhdGVzJ107IH1cblxuXHRAbWVtb2l6ZVxuXHRnZXQgY3Jvc3NPcmlnaW5Jc29sYXRlZCgpOiBib29sZWFuIHsgcmV0dXJuICEhdGhpcy5hcmdzWydlbmFibGUtY29pJ107IH1cblxuXHRAbWVtb2l6ZVxuXHRnZXQgY29kZUNhY2hlUGF0aCgpOiBzdHJpbmcgfCB1bmRlZmluZWQgeyByZXR1cm4gcHJvY2Vzcy5lbnZbJ1ZTQ09ERV9DT0RFX0NBQ0hFX1BBVEgnXSB8fCB1bmRlZmluZWQ7IH1cblxuXHRAbWVtb2l6ZVxuXHRnZXQgdXNlQ29kZUNhY2hlKCk6IGJvb2xlYW4geyByZXR1cm4gISF0aGlzLmNvZGVDYWNoZVBhdGg7IH1cblxuXHR1bnNldFNuYXBFeHBvcnRlZFZhcmlhYmxlcygpIHtcblx0XHRpZiAoIWlzTGludXgpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Zm9yIChjb25zdCBrZXkgaW4gcHJvY2Vzcy5lbnYpIHtcblx0XHRcdGlmIChrZXkuZW5kc1dpdGgoJ19WU0NPREVfU05BUF9PUklHJykpIHtcblx0XHRcdFx0Y29uc3Qgb3JpZ2luYWxLZXkgPSBrZXkuc2xpY2UoMCwgLTE3KTsgLy8gUmVtb3ZlIHRoZSBfVlNDT0RFX1NOQVBfT1JJRyBzdWZmaXhcblx0XHRcdFx0aWYgKHRoaXMuX3NuYXBFbnZbb3JpZ2luYWxLZXldKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gUHJlc2VydmUgdGhlIG9yaWdpbmFsIHZhbHVlIGluIGNhc2UgdGhlIHNuYXAgZW52IGlzIHJlLWVudGVyZWRcblx0XHRcdFx0aWYgKHByb2Nlc3MuZW52W29yaWdpbmFsS2V5XSkge1xuXHRcdFx0XHRcdHRoaXMuX3NuYXBFbnZbb3JpZ2luYWxLZXldID0gcHJvY2Vzcy5lbnZbb3JpZ2luYWxLZXldITtcblx0XHRcdFx0fVxuXHRcdFx0XHQvLyBDb3B5IHRoZSBvcmlnaW5hbCB2YWx1ZSBmcm9tIGJlZm9yZSBlbnRlcmluZyB0aGUgc25hcCBlbnYgaWYgYXZhaWxhYmxlLFxuXHRcdFx0XHQvLyBpZiBub3QgZGVsZXRlIHRoZSBlbnYgdmFyaWFibGUuXG5cdFx0XHRcdGlmIChwcm9jZXNzLmVudltrZXldKSB7XG5cdFx0XHRcdFx0cHJvY2Vzcy5lbnZbb3JpZ2luYWxLZXldID0gcHJvY2Vzcy5lbnZba2V5XTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRkZWxldGUgcHJvY2Vzcy5lbnZbb3JpZ2luYWxLZXldO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cmVzdG9yZVNuYXBFeHBvcnRlZFZhcmlhYmxlcygpIHtcblx0XHRpZiAoIWlzTGludXgpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Zm9yIChjb25zdCBrZXkgaW4gdGhpcy5fc25hcEVudikge1xuXHRcdFx0cHJvY2Vzcy5lbnZba2V5XSA9IHRoaXMuX3NuYXBFbnZba2V5XTtc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
