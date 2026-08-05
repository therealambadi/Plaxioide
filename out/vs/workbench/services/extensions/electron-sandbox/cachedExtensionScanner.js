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
import * as platform from "../../../../base/common/platform.js";
import { dedupExtensions } from "../common/extensionsUtil.js";
import { IExtensionsScannerService, toExtensionDescription as toExtensionDescriptionFromScannedExtension } from "../../../../platform/extensionManagement/common/extensionsScannerService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import Severity from "../../../../base/common/severity.js";
import { localize } from "../../../../nls.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IHostService } from "../../host/browser/host.js";
import { timeout } from "../../../../base/common/async.js";
import { IUserDataProfileService } from "../../userDataProfile/common/userDataProfile.js";
import { getErrorMessage } from "../../../../base/common/errors.js";
import { IWorkbenchExtensionManagementService } from "../../extensionManagement/common/extensionManagement.js";
import { toExtensionDescription } from "../common/extensions.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
let CachedExtensionScanner = class {
  constructor(_notificationService, _hostService, _extensionsScannerService, _userDataProfileService, _extensionManagementService, _environmentService, _logService) {
    this._notificationService = _notificationService;
    this._hostService = _hostService;
    this._extensionsScannerService = _extensionsScannerService;
    this._userDataProfileService = _userDataProfileService;
    this._extensionManagementService = _extensionManagementService;
    this._environmentService = _environmentService;
    this._logService = _logService;
    this.scannedExtensions = new Promise((resolve, reject) => {
      this._scannedExtensionsResolve = resolve;
      this._scannedExtensionsReject = reject;
    });
  }
  async startScanningExtensions() {
    try {
      const extensions = await this._scanInstalledExtensions();
      this._scannedExtensionsResolve(extensions);
    } catch (err) {
      this._scannedExtensionsReject(err);
    }
  }
  async _scanInstalledExtensions() {
    try {
      const language = platform.language;
      const result = await Promise.allSettled([
        this._extensionsScannerService.scanSystemExtensions({ language, checkControlFile: true }),
        this._extensionsScannerService.scanUserExtensions({ language, profileLocation: this._userDataProfileService.currentProfile.extensionsResource, useCache: true }),
        this._environmentService.remoteAuthority ? [] : this._extensionManagementService.getInstalledWorkspaceExtensions(false)
      ]);
      let scannedSystemExtensions = [], scannedUserExtensions = [], workspaceExtensions = [], scannedDevelopedExtensions = [], hasErrors = false;
      if (result[0].status === "fulfilled") {
        scannedSystemExtensions = result[0].value;
      } else {
        hasErrors = true;
        this._logService.error(`Error scanning system extensions:`, getErrorMessage(result[0].reason));
      }
      if (result[1].status === "fulfilled") {
        scannedUserExtensions = result[1].value;
      } else {
        hasErrors = true;
        this._logService.error(`Error scanning user extensions:`, getErrorMessage(result[1].reason));
      }
      if (result[2].status === "fulfilled") {
        workspaceExtensions = result[2].value;
      } else {
        hasErrors = true;
        this._logService.error(`Error scanning workspace extensions:`, getErrorMessage(result[2].reason));
      }
      try {
        scannedDevelopedExtensions = await this._extensionsScannerService.scanExtensionsUnderDevelopment([...scannedSystemExtensions, ...scannedUserExtensions], { language });
      } catch (error) {
        this._logService.error(error);
      }
      const system = scannedSystemExtensions.map((e) => toExtensionDescriptionFromScannedExtension(e, false));
      const user = scannedUserExtensions.map((e) => toExtensionDescriptionFromScannedExtension(e, false));
      const workspace = workspaceExtensions.map((e) => toExtensionDescription(e, false));
      const development = scannedDevelopedExtensions.map((e) => toExtensionDescriptionFromScannedExtension(e, true));
      const r = dedupExtensions(system, user, workspace, development, this._logService);
      if (!hasErrors) {
        const disposable = this._extensionsScannerService.onDidChangeCache(() => {
          disposable.dispose();
          this._notificationService.prompt(
            Severity.Error,
            localize("extensionCache.invalid", "Extensions have been modified on disk. Please reload the window."),
            [{
              label: localize("reloadWindow", "Reload Window"),
              run: () => this._hostService.reload()
            }]
          );
        });
        timeout(5e3).then(() => disposable.dispose());
      }
      return r;
    } catch (err) {
      this._logService.error(`Error scanning installed extensions:`);
      this._logService.error(err);
      return [];
    }
  }
};
CachedExtensionScanner = __decorateClass([
  __decorateParam(0, INotificationService),
  __decorateParam(1, IHostService),
  __decorateParam(2, IExtensionsScannerService),
  __decorateParam(3, IUserDataProfileService),
  __decorateParam(4, IWorkbenchExtensionManagementService),
  __decorateParam(5, IWorkbenchEnvironmentService),
  __decorateParam(6, ILogService)
], CachedExtensionScanner);
export {
  CachedExtensionScanner
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvZXh0ZW5zaW9ucy9lbGVjdHJvbi1zYW5kYm94L2NhY2hlZEV4dGVuc2lvblNjYW5uZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBwbGF0Zm9ybSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIElFeHRlbnNpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IGRlZHVwRXh0ZW5zaW9ucyB9IGZyb20gJy4uL2NvbW1vbi9leHRlbnNpb25zVXRpbC5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlLCBJU2Nhbm5lZEV4dGVuc2lvbiwgdG9FeHRlbnNpb25EZXNjcmlwdGlvbiBhcyB0b0V4dGVuc2lvbkRlc2NyaXB0aW9uRnJvbVNjYW5uZWRFeHRlbnNpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25zU2Nhbm5lclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgU2V2ZXJpdHkgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc2V2ZXJpdHkuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBJSG9zdFNlcnZpY2UgfSBmcm9tICcuLi8uLi9ob3N0L2Jyb3dzZXIvaG9zdC5qcyc7XG5pbXBvcnQgeyB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhUHJvZmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi91c2VyRGF0YVByb2ZpbGUvY29tbW9uL3VzZXJEYXRhUHJvZmlsZS5qcyc7XG5pbXBvcnQgeyBnZXRFcnJvck1lc3NhZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uTWFuYWdlbWVudC5qcyc7XG5pbXBvcnQgeyB0b0V4dGVuc2lvbkRlc2NyaXB0aW9uIH0gZnJvbSAnLi4vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuXG5leHBvcnQgY2xhc3MgQ2FjaGVkRXh0ZW5zaW9uU2Nhbm5lciB7XG5cblx0cHVibGljIHJlYWRvbmx5IHNjYW5uZWRFeHRlbnNpb25zOiBQcm9taXNlPElFeHRlbnNpb25EZXNjcmlwdGlvbltdPjtcblx0cHJpdmF0ZSBfc2Nhbm5lZEV4dGVuc2lvbnNSZXNvbHZlITogKHJlc3VsdDogSUV4dGVuc2lvbkRlc2NyaXB0aW9uW10pID0+IHZvaWQ7XG5cdHByaXZhdGUgX3NjYW5uZWRFeHRlbnNpb25zUmVqZWN0ITogKGVycjogYW55KSA9PiB2b2lkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9ub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASUhvc3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2hvc3RTZXJ2aWNlOiBJSG9zdFNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25zU2Nhbm5lclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlOiBJRXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFQcm9maWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF91c2VyRGF0YVByb2ZpbGVTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlU2VydmljZSxcblx0XHRASVdvcmtiZW5jaEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2V4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZW52aXJvbm1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0KSB7XG5cdFx0dGhpcy5zY2FubmVkRXh0ZW5zaW9ucyA9IG5ldyBQcm9taXNlPElFeHRlbnNpb25EZXNjcmlwdGlvbltdPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHR0aGlzLl9zY2FubmVkRXh0ZW5zaW9uc1Jlc29sdmUgPSByZXNvbHZlO1xuXHRcdFx0dGhpcy5fc2Nhbm5lZEV4dGVuc2lvbnNSZWplY3QgPSByZWplY3Q7XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgc3RhcnRTY2FubmluZ0V4dGVuc2lvbnMoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGV4dGVuc2lvbnMgPSBhd2FpdCB0aGlzLl9zY2FuSW5zdGFsbGVkRXh0ZW5zaW9ucygpO1xuXHRcdFx0dGhpcy5fc2Nhbm5lZEV4dGVuc2lvbnNSZXNvbHZlKGV4dGVuc2lvbnMpO1xuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0dGhpcy5fc2Nhbm5lZEV4dGVuc2lvbnNSZWplY3QoZXJyKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9zY2FuSW5zdGFsbGVkRXh0ZW5zaW9ucygpOiBQcm9taXNlPElFeHRlbnNpb25EZXNjcmlwdGlvbltdPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGxhbmd1YWdlID0gcGxhdGZvcm0ubGFuZ3VhZ2U7XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQoW1xuXHRcdFx0XHR0aGlzLl9leHRlbnNpb25zU2Nhbm5lclNlcnZpY2Uuc2NhblN5c3RlbUV4dGVuc2lvbnMoeyBsYW5ndWFnZSwgY2hlY2tDb250cm9sRmlsZTogdHJ1ZSB9KSxcblx0XHRcdFx0dGhpcy5fZXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlLnNjYW5Vc2VyRXh0ZW5zaW9ucyh7IGxhbmd1YWdlLCBwcm9maWxlTG9jYXRpb246IHRoaXMuX3VzZXJEYXRhUHJvZmlsZVNlcnZpY2UuY3VycmVudFByb2ZpbGUuZXh0ZW5zaW9uc1Jlc291cmNlLCB1c2VDYWNoZTogdHJ1ZSB9KSxcblx0XHRcdFx0dGhpcy5fZW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eSA/IFtdIDogdGhpcy5fZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuZ2V0SW5zdGFsbGVkV29ya3NwYWNlRXh0ZW5zaW9ucyhmYWxzZSlcblx0XHRcdF0pO1xuXG5cdFx0XHRsZXQgc2Nhbm5lZFN5c3RlbUV4dGVuc2lvbnM6IElTY2FubmVkRXh0ZW5zaW9uW10gPSBbXSxcblx0XHRcdFx0c2Nhbm5lZFVzZXJFeHRlbnNpb25zOiBJU2Nhbm5lZEV4dGVuc2lvbltdID0gW10sXG5cdFx0XHRcdHdvcmtzcGFjZUV4dGVuc2lvbnM6IElFeHRlbnNpb25bXSA9IFtdLFxuXHRcdFx0XHRzY2FubmVkRGV2ZWxvcGVkRXh0ZW5zaW9uczogSVNjYW5uZWRFeHRlbnNpb25bXSA9IFtdLFxuXHRcdFx0XHRoYXNFcnJvcnMgPSBmYWxzZTtcblxuXHRcdFx0aWYgKHJlc3VsdFswXS5zdGF0dXMgPT09ICdmdWxmaWxsZWQnKSB7XG5cdFx0XHRcdHNjYW5uZWRTeXN0ZW1FeHRlbnNpb25zID0gcmVzdWx0WzBdLnZhbHVlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aGFzRXJyb3JzID0gdHJ1ZTtcblx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS5lcnJvcihgRXJyb3Igc2Nhbm5pbmcgc3lzdGVtIGV4dGVuc2lvbnM6YCwgZ2V0RXJyb3JNZXNzYWdlKHJlc3VsdFswXS5yZWFzb24pKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHJlc3VsdFsxXS5zdGF0dXMgPT09ICdmdWxmaWxsZWQnKSB7XG5cdFx0XHRcdHNjYW5uZWRVc2VyRXh0ZW5zaW9ucyA9IHJlc3VsdFsxXS52YWx1ZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGhhc0Vycm9ycyA9IHRydWU7XG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZXJyb3IoYEVycm9yIHNjYW5uaW5nIHVzZXIgZXh0ZW5zaW9uczpgLCBnZXRFcnJvck1lc3NhZ2UocmVzdWx0WzFdLnJlYXNvbikpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAocmVzdWx0WzJdLnN0YXR1cyA9PT0gJ2Z1bGZpbGxlZCcpIHtcblx0XHRcdFx0d29ya3NwYWNlRXh0ZW5zaW9ucyA9IHJlc3VsdFsyXS52YWx1ZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGhhc0Vycm9ycyA9IHRydWU7XG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZXJyb3IoYEVycm9yIHNjYW5uaW5nIHdvcmtzcGFjZSBleHRlbnNpb25zOmAsIGdldEVycm9yTWVzc2FnZShyZXN1bHRbMl0ucmVhc29uKSk7XG5cdFx0XHR9XG5cblx0XHRcdHRyeSB7XG5cdFx0XHRcdHNjYW5uZWREZXZlbG9wZWRFeHRlbnNpb25zID0gYXdhaXQgdGhpcy5fZXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlLnNjYW5FeHRlbnNpb25zVW5kZXJEZXZlbG9wbWVudChbLi4uc2Nhbm5lZFN5c3RlbUV4dGVuc2lvbnMsIC4uLnNjYW5uZWRVc2VyRXh0ZW5zaW9uc10sIHsgbGFuZ3VhZ2UgfSk7XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmVycm9yKGVycm9yKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgc3lzdGVtID0gc2Nhbm5lZFN5c3RlbUV4dGVuc2lvbnMubWFwKGUgPT4gdG9FeHRlbnNpb25EZXNjcmlwdGlvbkZyb21TY2FubmVkRXh0ZW5zaW9uKGUsIGZhbHNlKSk7XG5cdFx0XHRjb25zdCB1c2VyID0gc2Nhbm5lZFVzZXJFeHRlbnNpb25zLm1hcChlID0+IHRvRXh0ZW5zaW9uRGVzY3JpcHRpb25Gcm9tU2Nhbm5lZEV4dGVuc2lvbihlLCBmYWxzZSkpO1xuXHRcdFx0Y29uc3Qgd29ya3NwYWNlID0gd29ya3NwYWNlRXh0ZW5zaW9ucy5tYXAoZSA9PiB0b0V4dGVuc2lvbkRlc2NyaXB0aW9uKGUsIGZhbHNlKSk7XG5cdFx0XHRjb25zdCBkZXZlbG9wbWVudCA9IHNjYW5uZWREZXZlbG9wZWRFeHRlbnNpb25zLm1hcChlID0+IHRvRXh0ZW5zaW9uRGVzY3JpcHRpb25Gcm9tU2Nhbm5lZEV4dGVuc2lvbihlLCB0cnVlKSk7XG5cdFx0XHRjb25zdCByID0gZGVkdXBFeHRlbnNpb25zKHN5c3RlbSwgdXNlciwgd29ya3NwYWNlLCBkZXZlbG9wbWVudCwgdGhpcy5fbG9nU2VydmljZSk7XG5cblx0XHRcdGlmICghaGFzRXJyb3JzKSB7XG5cdFx0XHRcdGNvbnN0IGRpc3Bvc2FibGUgPSB0aGlzLl9leHRlbnNpb25zU2Nhbm5lclNlcnZpY2Uub25EaWRDaGFuZ2VDYWNoZSgoKSA9PiB7XG5cdFx0XHRcdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0dGhpcy5fbm90aWZpY2F0aW9uU2VydmljZS5wcm9tcHQoXG5cdFx0XHRcdFx0XHRTZXZlcml0eS5FcnJvcixcblx0XHRcdFx0XHRcdGxvY2FsaXplKCdleHRlbnNpb25DYWNoZS5pbnZhbGlkJywgXCJFeHRlbnNpb25zIGhhdmUgYmVlbiBtb2RpZmllZCBvbiBkaXNrLiBQbGVhc2UgcmVsb2FkIHRoZSB3aW5kb3cuXCIpLFxuXHRcdFx0XHRcdFx0W3tcblx0XHRcdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdyZWxvYWRXaW5kb3cnLCBcIlJlbG9hZCBXaW5kb3dcIiksXG5cdFx0XHRcdFx0XHRcdHJ1bjogKCkgPT4gdGhpcy5faG9zdFNlcnZpY2UucmVsb2FkKClcblx0XHRcdFx0XHRcdH1dXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHRpbWVvdXQoNTAwMCkudGhlbigoKSA9PiBkaXNwb3NhYmxlLmRpc3Bvc2UoKSk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiByO1xuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS5lcnJvcihgRXJyb3Igc2Nhbm5pbmcgaW5zdGFsbGVkIGV4dGVuc2lvbnM6YCk7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmVycm9yKGVycik7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXHR9XG5cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxjQUFjO0FBRTFCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsMkJBQThDLDBCQUEwQixrREFBa0Q7QUFDbkksU0FBUyxtQkFBbUI7QUFDNUIsT0FBTyxjQUFjO0FBQ3JCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsZUFBZTtBQUN4QixTQUFTLCtCQUErQjtBQUN4QyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLDRDQUE0QztBQUNyRCxTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLG9DQUFvQztBQUV0QyxJQUFNLHlCQUFOLE1BQTZCO0FBQUEsRUFNbkMsWUFDd0Msc0JBQ1IsY0FDYSwyQkFDRix5QkFDYSw2QkFDUixxQkFDakIsYUFDN0I7QUFQc0M7QUFDUjtBQUNhO0FBQ0Y7QUFDYTtBQUNSO0FBQ2pCO0FBRTlCLFNBQUssb0JBQW9CLElBQUksUUFBaUMsQ0FBQyxTQUFTLFdBQVc7QUFDbEYsV0FBSyw0QkFBNEI7QUFDakMsV0FBSywyQkFBMkI7QUFBQSxJQUNqQyxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRUEsTUFBYSwwQkFBeUM7QUFDckQsUUFBSTtBQUNILFlBQU0sYUFBYSxNQUFNLEtBQUsseUJBQXlCO0FBQ3ZELFdBQUssMEJBQTBCLFVBQVU7QUFBQSxJQUMxQyxTQUFTLEtBQUs7QUFDYixXQUFLLHlCQUF5QixHQUFHO0FBQUEsSUFDbEM7QUFBQSxFQUNEO0FBQUEsRUFFQSxNQUFjLDJCQUE2RDtBQUMxRSxRQUFJO0FBQ0gsWUFBTSxXQUFXLFNBQVM7QUFDMUIsWUFBTSxTQUFTLE1BQU0sUUFBUSxXQUFXO0FBQUEsUUFDdkMsS0FBSywwQkFBMEIscUJBQXFCLEVBQUUsVUFBVSxrQkFBa0IsS0FBSyxDQUFDO0FBQUEsUUFDeEYsS0FBSywwQkFBMEIsbUJBQW1CLEVBQUUsVUFBVSxpQkFBaUIsS0FBSyx3QkFBd0IsZUFBZSxvQkFBb0IsVUFBVSxLQUFLLENBQUM7QUFBQSxRQUMvSixLQUFLLG9CQUFvQixrQkFBa0IsQ0FBQyxJQUFJLEtBQUssNEJBQTRCLGdDQUFnQyxLQUFLO0FBQUEsTUFDdkgsQ0FBQztBQUVELFVBQUksMEJBQStDLENBQUMsR0FDbkQsd0JBQTZDLENBQUMsR0FDOUMsc0JBQW9DLENBQUMsR0FDckMsNkJBQWtELENBQUMsR0FDbkQsWUFBWTtBQUViLFVBQUksT0FBTyxDQUFDLEVBQUUsV0FBVyxhQUFhO0FBQ3JDLGtDQUEwQixPQUFPLENBQUMsRUFBRTtBQUFBLE1BQ3JDLE9BQU87QUFDTixvQkFBWTtBQUNaLGFBQUssWUFBWSxNQUFNLHFDQUFxQyxnQkFBZ0IsT0FBTyxDQUFDLEVBQUUsTUFBTSxDQUFDO0FBQUEsTUFDOUY7QUFFQSxVQUFJLE9BQU8sQ0FBQyxFQUFFLFdBQVcsYUFBYTtBQUNyQyxnQ0FBd0IsT0FBTyxDQUFDLEVBQUU7QUFBQSxNQUNuQyxPQUFPO0FBQ04sb0JBQVk7QUFDWixhQUFLLFlBQVksTUFBTSxtQ0FBbUMsZ0JBQWdCLE9BQU8sQ0FBQyxFQUFFLE1BQU0sQ0FBQztBQUFBLE1BQzVGO0FBRUEsVUFBSSxPQUFPLENBQUMsRUFBRSxXQUFXLGFBQWE7QUFDckMsOEJBQXNCLE9BQU8sQ0FBQyxFQUFFO0FBQUEsTUFDakMsT0FBTztBQUNOLG9CQUFZO0FBQ1osYUFBSyxZQUFZLE1BQU0sd0NBQXdDLGdCQUFnQixPQUFPLENBQUMsRUFBRSxNQUFNLENBQUM7QUFBQSxNQUNqRztBQUVBLFVBQUk7QUFDSCxxQ0FBNkIsTUFBTSxLQUFLLDBCQUEwQiwrQkFBK0IsQ0FBQyxHQUFHLHlCQUF5QixHQUFHLHFCQUFxQixHQUFHLEVBQUUsU0FBUyxDQUFDO0FBQUEsTUFDdEssU0FBUyxPQUFPO0FBQ2YsYUFBSyxZQUFZLE1BQU0sS0FBSztBQUFBLE1BQzdCO0FBRUEsWUFBTSxTQUFTLHdCQUF3QixJQUFJLE9BQUssMkNBQTJDLEdBQUcsS0FBSyxDQUFDO0FBQ3BHLFlBQU0sT0FBTyxzQkFBc0IsSUFBSSxPQUFLLDJDQUEyQyxHQUFHLEtBQUssQ0FBQztBQUNoRyxZQUFNLFlBQVksb0JBQW9CLElBQUksT0FBSyx1QkFBdUIsR0FBRyxLQUFLLENBQUM7QUFDL0UsWUFBTSxjQUFjLDJCQUEyQixJQUFJLE9BQUssMkNBQTJDLEdBQUcsSUFBSSxDQUFDO0FBQzNHLFlBQU0sSUFBSSxnQkFBZ0IsUUFBUSxNQUFNLFdBQVcsYUFBYSxLQUFLLFdBQVc7QUFFaEYsVUFBSSxDQUFDLFdBQVc7QUFDZixjQUFNLGFBQWEsS0FBSywwQkFBMEIsaUJBQWlCLE1BQU07QUFDeEUscUJBQVcsUUFBUTtBQUNuQixlQUFLLHFCQUFxQjtBQUFBLFlBQ3pCLFNBQVM7QUFBQSxZQUNULFNBQVMsMEJBQTBCLGtFQUFrRTtBQUFBLFlBQ3JHLENBQUM7QUFBQSxjQUNBLE9BQU8sU0FBUyxnQkFBZ0IsZUFBZTtBQUFBLGNBQy9DLEtBQUssTUFBTSxLQUFLLGFBQWEsT0FBTztBQUFBLFlBQ3JDLENBQUM7QUFBQSxVQUNGO0FBQUEsUUFDRCxDQUFDO0FBQ0QsZ0JBQVEsR0FBSSxFQUFFLEtBQUssTUFBTSxXQUFXLFFBQVEsQ0FBQztBQUFBLE1BQzlDO0FBRUEsYUFBTztBQUFBLElBQ1IsU0FBUyxLQUFLO0FBQ2IsV0FBSyxZQUFZLE1BQU0sc0NBQXNDO0FBQzdELFdBQUssWUFBWSxNQUFNLEdBQUc7QUFDMUIsYUFBTyxDQUFDO0FBQUEsSUFDVDtBQUFBLEVBQ0Q7QUFFRDtBQXJHYSx5QkFBTjtBQUFBLEVBT0o7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQWJVOyIsCiAgIm5hbWVzIjogW10KfQo=
