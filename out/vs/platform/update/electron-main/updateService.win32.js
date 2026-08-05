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
import { spawn } from "child_process";
import * as fs from "fs";
import { tmpdir } from "os";
import { timeout } from "../../../base/common/async.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
import { memoize } from "../../../base/common/decorators.js";
import { hash } from "../../../base/common/hash.js";
import * as path from "../../../base/common/path.js";
import { URI } from "../../../base/common/uri.js";
import { checksum } from "../../../base/node/crypto.js";
import * as pfs from "../../../base/node/pfs.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { IEnvironmentMainService } from "../../environment/electron-main/environmentMainService.js";
import { IFileService } from "../../files/common/files.js";
import { ILifecycleMainService } from "../../lifecycle/electron-main/lifecycleMainService.js";
import { ILogService } from "../../log/common/log.js";
import { INativeHostMainService } from "../../native/electron-main/nativeHostMainService.js";
import { IProductService } from "../../product/common/productService.js";
import { asJson, IRequestService } from "../../request/common/request.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { DisablementReason, State, StateType, UpdateType } from "../common/update.js";
import { AbstractUpdateService, createUpdateURL } from "./abstractUpdateService.js";
async function pollUntil(fn, millis = 1e3) {
  while (!fn()) {
    await timeout(millis);
  }
}
let _updateType = void 0;
function getUpdateType() {
  if (typeof _updateType === "undefined") {
    _updateType = fs.existsSync(path.join(path.dirname(process.execPath), "unins000.exe")) ? UpdateType.Setup : UpdateType.Archive;
  }
  return _updateType;
}
let Win32UpdateService = class extends AbstractUpdateService {
  constructor(lifecycleMainService, configurationService, telemetryService, environmentMainService, requestService, logService, fileService, nativeHostMainService, productService) {
    super(lifecycleMainService, configurationService, environmentMainService, requestService, logService, productService);
    this.telemetryService = telemetryService;
    this.fileService = fileService;
    this.nativeHostMainService = nativeHostMainService;
    lifecycleMainService.setRelaunchHandler(this);
  }
  get cachePath() {
    const result = path.join(tmpdir(), `vscode-${this.productService.quality}-${this.productService.target}-${process.arch}`);
    return fs.promises.mkdir(result, { recursive: true }).then(() => result);
  }
  handleRelaunch(options) {
    if (options?.addArgs || options?.removeArgs) {
      return false;
    }
    if (this.state.type !== StateType.Ready || !this.availableUpdate) {
      return false;
    }
    this.logService.trace("update#handleRelaunch(): running raw#quitAndInstall()");
    this.doQuitAndInstall();
    return true;
  }
  async initialize() {
    if (this.productService.target === "user" && await this.nativeHostMainService.isAdmin(void 0)) {
      this.setState(State.Disabled(DisablementReason.RunningAsAdmin));
      this.logService.info("update#ctor - updates are disabled due to running as Admin in user setup");
      return;
    }
    await super.initialize();
  }
  buildUpdateFeedUrl(quality) {
    let platform = `win32-${process.arch}`;
    if (getUpdateType() === UpdateType.Archive) {
      platform += "-archive";
    } else if (this.productService.target === "user") {
      platform += "-user";
    }
    return createUpdateURL(platform, quality, this.productService);
  }
  doCheckForUpdates(context) {
    if (!this.url) {
      return;
    }
    this.setState(State.CheckingForUpdates(context));
    this.requestService.request({ url: this.url }, CancellationToken.None).then(asJson).then((update) => {
      const updateType = getUpdateType();
      if (!update || !update.url || !update.version || !update.productVersion) {
        this.setState(State.Idle(updateType));
        return Promise.resolve(null);
      }
      if (updateType === UpdateType.Archive) {
        this.setState(State.AvailableForDownload(update));
        return Promise.resolve(null);
      }
      this.setState(State.Downloading);
      return this.cleanup(update.version).then(() => {
        return this.getUpdatePackagePath(update.version).then((updatePackagePath) => {
          return pfs.Promises.exists(updatePackagePath).then((exists) => {
            if (exists) {
              return Promise.resolve(updatePackagePath);
            }
            const downloadPath = `${updatePackagePath}.tmp`;
            return this.requestService.request({ url: update.url }, CancellationToken.None).then((context2) => this.fileService.writeFile(URI.file(downloadPath), context2.stream)).then(update.sha256hash ? () => checksum(downloadPath, update.sha256hash) : () => void 0).then(() => pfs.Promises.rename(
              downloadPath,
              updatePackagePath,
              false
              /* no retry */
            )).then(() => updatePackagePath);
          });
        }).then((packagePath) => {
          this.availableUpdate = { packagePath };
          this.setState(State.Downloaded(update));
          const fastUpdatesEnabled = this.configurationService.getValue("update.enableWindowsBackgroundUpdates");
          if (fastUpdatesEnabled) {
            if (this.productService.target === "user") {
              this.doApplyUpdate();
            }
          } else {
            this.setState(State.Ready(update));
          }
        });
      });
    }).then(void 0, (err) => {
      this.telemetryService.publicLog2("update:error", { messageHash: String(hash(String(err))) });
      this.logService.error(err);
      const message = !!context ? err.message || err : void 0;
      this.setState(State.Idle(getUpdateType(), message));
    });
  }
  async doDownloadUpdate(state) {
    if (state.update.url) {
      this.nativeHostMainService.openExternal(void 0, state.update.url);
    }
    this.setState(State.Idle(getUpdateType()));
  }
  async getUpdatePackagePath(version) {
    const cachePath = await this.cachePath;
    return path.join(cachePath, `CodeSetup-${this.productService.quality}-${version}.exe`);
  }
  async cleanup(exceptVersion = null) {
    const filter = exceptVersion ? (one) => !new RegExp(`${this.productService.quality}-${exceptVersion}\\.exe$`).test(one) : () => true;
    const cachePath = await this.cachePath;
    const versions = await pfs.Promises.readdir(cachePath);
    const promises = versions.filter(filter).map(async (one) => {
      try {
        await fs.promises.unlink(path.join(cachePath, one));
      } catch (err) {
      }
    });
    await Promise.all(promises);
  }
  async doApplyUpdate() {
    if (this.state.type !== StateType.Downloaded) {
      return Promise.resolve(void 0);
    }
    if (!this.availableUpdate) {
      return Promise.resolve(void 0);
    }
    const update = this.state.update;
    this.setState(State.Updating(update));
    const cachePath = await this.cachePath;
    this.availableUpdate.updateFilePath = path.join(cachePath, `CodeSetup-${this.productService.quality}-${update.version}.flag`);
    await pfs.Promises.writeFile(this.availableUpdate.updateFilePath, "flag");
    const child = spawn(this.availableUpdate.packagePath, ["/verysilent", "/log", `/update="${this.availableUpdate.updateFilePath}"`, "/nocloseapplications", "/mergetasks=runcode,!desktopicon,!quicklaunchicon"], {
      detached: true,
      stdio: ["ignore", "ignore", "ignore"],
      windowsVerbatimArguments: true
    });
    child.once("exit", () => {
      this.availableUpdate = void 0;
      this.setState(State.Idle(getUpdateType()));
    });
    const readyMutexName = `${this.productService.win32MutexName}-ready`;
    const mutex = await import("@vscode/windows-mutex");
    pollUntil(() => mutex.isActive(readyMutexName)).then(() => this.setState(State.Ready(update)));
  }
  doQuitAndInstall() {
    if (this.state.type !== StateType.Ready || !this.availableUpdate) {
      return;
    }
    this.logService.trace("update#quitAndInstall(): running raw#quitAndInstall()");
    if (this.availableUpdate.updateFilePath) {
      fs.unlinkSync(this.availableUpdate.updateFilePath);
    } else {
      spawn(this.availableUpdate.packagePath, ["/silent", "/log", "/mergetasks=runcode,!desktopicon,!quicklaunchicon"], {
        detached: true,
        stdio: ["ignore", "ignore", "ignore"]
      });
    }
  }
  getUpdateType() {
    return getUpdateType();
  }
  async _applySpecificUpdate(packagePath) {
    if (this.state.type !== StateType.Idle) {
      return;
    }
    const fastUpdatesEnabled = this.configurationService.getValue("update.enableWindowsBackgroundUpdates");
    const update = { version: "unknown", productVersion: "unknown" };
    this.setState(State.Downloading);
    this.availableUpdate = { packagePath };
    this.setState(State.Downloaded(update));
    if (fastUpdatesEnabled) {
      if (this.productService.target === "user") {
        this.doApplyUpdate();
      }
    } else {
      this.setState(State.Ready(update));
    }
  }
};
__decorateClass([
  memoize
], Win32UpdateService.prototype, "cachePath", 1);
Win32UpdateService = __decorateClass([
  __decorateParam(0, ILifecycleMainService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, ITelemetryService),
  __decorateParam(3, IEnvironmentMainService),
  __decorateParam(4, IRequestService),
  __decorateParam(5, ILogService),
  __decorateParam(6, IFileService),
  __decorateParam(7, INativeHostMainService),
  __decorateParam(8, IProductService)
], Win32UpdateService);
export {
  Win32UpdateService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS91cGRhdGUvZWxlY3Ryb24tbWFpbi91cGRhdGVTZXJ2aWNlLndpbjMyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgc3Bhd24gfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCB7IHRtcGRpciB9IGZyb20gJ29zJztcbmltcG9ydCB7IHRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBtZW1vaXplIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZGVjb3JhdG9ycy5qcyc7XG5pbXBvcnQgeyBoYXNoIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vaGFzaC5qcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGNoZWNrc3VtIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9ub2RlL2NyeXB0by5qcyc7XG5pbXBvcnQgKiBhcyBwZnMgZnJvbSAnLi4vLi4vLi4vYmFzZS9ub2RlL3Bmcy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElFbnZpcm9ubWVudE1haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZW52aXJvbm1lbnQvZWxlY3Ryb24tbWFpbi9lbnZpcm9ubWVudE1haW5TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJTGlmZWN5Y2xlTWFpblNlcnZpY2UsIElSZWxhdW5jaEhhbmRsZXIsIElSZWxhdW5jaE9wdGlvbnMgfSBmcm9tICcuLi8uLi9saWZlY3ljbGUvZWxlY3Ryb24tbWFpbi9saWZlY3ljbGVNYWluU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElOYXRpdmVIb3N0TWFpblNlcnZpY2UgfSBmcm9tICcuLi8uLi9uYXRpdmUvZWxlY3Ryb24tbWFpbi9uYXRpdmVIb3N0TWFpblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgYXNKc29uLCBJUmVxdWVzdFNlcnZpY2UgfSBmcm9tICcuLi8uLi9yZXF1ZXN0L2NvbW1vbi9yZXF1ZXN0LmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgQXZhaWxhYmxlRm9yRG93bmxvYWQsIERpc2FibGVtZW50UmVhc29uLCBJVXBkYXRlLCBTdGF0ZSwgU3RhdGVUeXBlLCBVcGRhdGVUeXBlIH0gZnJvbSAnLi4vY29tbW9uL3VwZGF0ZS5qcyc7XG5pbXBvcnQgeyBBYnN0cmFjdFVwZGF0ZVNlcnZpY2UsIGNyZWF0ZVVwZGF0ZVVSTCwgVXBkYXRlRXJyb3JDbGFzc2lmaWNhdGlvbiB9IGZyb20gJy4vYWJzdHJhY3RVcGRhdGVTZXJ2aWNlLmpzJztcblxuYXN5bmMgZnVuY3Rpb24gcG9sbFVudGlsKGZuOiAoKSA9PiBib29sZWFuLCBtaWxsaXMgPSAxMDAwKTogUHJvbWlzZTx2b2lkPiB7XG5cdHdoaWxlICghZm4oKSkge1xuXHRcdGF3YWl0IHRpbWVvdXQobWlsbGlzKTtcblx0fVxufVxuXG5pbnRlcmZhY2UgSUF2YWlsYWJsZVVwZGF0ZSB7XG5cdHBhY2thZ2VQYXRoOiBzdHJpbmc7XG5cdHVwZGF0ZUZpbGVQYXRoPzogc3RyaW5nO1xufVxuXG5sZXQgX3VwZGF0ZVR5cGU6IFVwZGF0ZVR5cGUgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5mdW5jdGlvbiBnZXRVcGRhdGVUeXBlKCk6IFVwZGF0ZVR5cGUge1xuXHRpZiAodHlwZW9mIF91cGRhdGVUeXBlID09PSAndW5kZWZpbmVkJykge1xuXHRcdF91cGRhdGVUeXBlID0gZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocGF0aC5kaXJuYW1lKHByb2Nlc3MuZXhlY1BhdGgpLCAndW5pbnMwMDAuZXhlJykpXG5cdFx0XHQ/IFVwZGF0ZVR5cGUuU2V0dXBcblx0XHRcdDogVXBkYXRlVHlwZS5BcmNoaXZlO1xuXHR9XG5cblx0cmV0dXJuIF91cGRhdGVUeXBlO1xufVxuXG5leHBvcnQgY2xhc3MgV2luMzJVcGRhdGVTZXJ2aWNlIGV4dGVuZHMgQWJzdHJhY3RVcGRhdGVTZXJ2aWNlIGltcGxlbWVudHMgSVJlbGF1bmNoSGFuZGxlciB7XG5cblx0cHJpdmF0ZSBhdmFpbGFibGVVcGRhdGU6IElBdmFpbGFibGVVcGRhdGUgfCB1bmRlZmluZWQ7XG5cblx0QG1lbW9pemVcblx0Z2V0IGNhY2hlUGF0aCgpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdGNvbnN0IHJlc3VsdCA9IHBhdGguam9pbih0bXBkaXIoKSwgYHZzY29kZS0ke3RoaXMucHJvZHVjdFNlcnZpY2UucXVhbGl0eX0tJHt0aGlzLnByb2R1Y3RTZXJ2aWNlLnRhcmdldH0tJHtwcm9jZXNzLmFyY2h9YCk7XG5cdFx0cmV0dXJuIGZzLnByb21pc2VzLm1rZGlyKHJlc3VsdCwgeyByZWN1cnNpdmU6IHRydWUgfSkudGhlbigoKSA9PiByZXN1bHQpO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElMaWZlY3ljbGVNYWluU2VydmljZSBsaWZlY3ljbGVNYWluU2VydmljZTogSUxpZmVjeWNsZU1haW5TZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASUVudmlyb25tZW50TWFpblNlcnZpY2UgZW52aXJvbm1lbnRNYWluU2VydmljZTogSUVudmlyb25tZW50TWFpblNlcnZpY2UsXG5cdFx0QElSZXF1ZXN0U2VydmljZSByZXF1ZXN0U2VydmljZTogSVJlcXVlc3RTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASU5hdGl2ZUhvc3RNYWluU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5hdGl2ZUhvc3RNYWluU2VydmljZTogSU5hdGl2ZUhvc3RNYWluU2VydmljZSxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIobGlmZWN5Y2xlTWFpblNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBlbnZpcm9ubWVudE1haW5TZXJ2aWNlLCByZXF1ZXN0U2VydmljZSwgbG9nU2VydmljZSwgcHJvZHVjdFNlcnZpY2UpO1xuXG5cdFx0bGlmZWN5Y2xlTWFpblNlcnZpY2Uuc2V0UmVsYXVuY2hIYW5kbGVyKHRoaXMpO1xuXHR9XG5cblx0aGFuZGxlUmVsYXVuY2gob3B0aW9ucz86IElSZWxhdW5jaE9wdGlvbnMpOiBib29sZWFuIHtcblx0XHRpZiAob3B0aW9ucz8uYWRkQXJncyB8fCBvcHRpb25zPy5yZW1vdmVBcmdzKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7IC8vIHdlIGNhbm5vdCBhcHBseSBhbiB1cGRhdGUgYW5kIHJlc3RhcnQgd2l0aCBkaWZmZXJlbnQgYXJnc1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnN0YXRlLnR5cGUgIT09IFN0YXRlVHlwZS5SZWFkeSB8fCAhdGhpcy5hdmFpbGFibGVVcGRhdGUpIHtcblx0XHRcdHJldHVybiBmYWxzZTsgLy8gd2Ugb25seSBoYW5kbGUgdGhlIHJlbGF1bmNoIHdoZW4gd2UgaGF2ZSBhIHBlbmRpbmcgdXBkYXRlXG5cdFx0fVxuXG5cdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKCd1cGRhdGUjaGFuZGxlUmVsYXVuY2goKTogcnVubmluZyByYXcjcXVpdEFuZEluc3RhbGwoKScpO1xuXHRcdHRoaXMuZG9RdWl0QW5kSW5zdGFsbCgpO1xuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgYXN5bmMgaW5pdGlhbGl6ZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy5wcm9kdWN0U2VydmljZS50YXJnZXQgPT09ICd1c2VyJyAmJiBhd2FpdCB0aGlzLm5hdGl2ZUhvc3RNYWluU2VydmljZS5pc0FkbWluKHVuZGVmaW5lZCkpIHtcblx0XHRcdHRoaXMuc2V0U3RhdGUoU3RhdGUuRGlzYWJsZWQoRGlzYWJsZW1lbnRSZWFzb24uUnVubmluZ0FzQWRtaW4pKTtcblx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCd1cGRhdGUjY3RvciAtIHVwZGF0ZXMgYXJlIGRpc2FibGVkIGR1ZSB0byBydW5uaW5nIGFzIEFkbWluIGluIHVzZXIgc2V0dXAnKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRhd2FpdCBzdXBlci5pbml0aWFsaXplKCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYnVpbGRVcGRhdGVGZWVkVXJsKHF1YWxpdHk6IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0bGV0IHBsYXRmb3JtID0gYHdpbjMyLSR7cHJvY2Vzcy5hcmNofWA7XG5cblx0XHRpZiAoZ2V0VXBkYXRlVHlwZSgpID09PSBVcGRhdGVUeXBlLkFyY2hpdmUpIHtcblx0XHRcdHBsYXRmb3JtICs9ICctYXJjaGl2ZSc7XG5cdFx0fSBlbHNlIGlmICh0aGlzLnByb2R1Y3RTZXJ2aWNlLnRhcmdldCA9PT0gJ3VzZXInKSB7XG5cdFx0XHRwbGF0Zm9ybSArPSAnLXVzZXInO1xuXHRcdH1cblxuXHRcdHJldHVybiBjcmVhdGVVcGRhdGVVUkwocGxhdGZvcm0sIHF1YWxpdHksIHRoaXMucHJvZHVjdFNlcnZpY2UpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGRvQ2hlY2tGb3JVcGRhdGVzKGNvbnRleHQ6IGFueSk6IHZvaWQge1xuXHRcdGlmICghdGhpcy51cmwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnNldFN0YXRlKFN0YXRlLkNoZWNraW5nRm9yVXBkYXRlcyhjb250ZXh0KSk7XG5cblx0XHR0aGlzLnJlcXVlc3RTZXJ2aWNlLnJlcXVlc3QoeyB1cmw6IHRoaXMudXJsIH0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpXG5cdFx0XHQudGhlbjxJVXBkYXRlIHwgbnVsbD4oYXNKc29uKVxuXHRcdFx0LnRoZW4odXBkYXRlID0+IHtcblx0XHRcdFx0Y29uc3QgdXBkYXRlVHlwZSA9IGdldFVwZGF0ZVR5cGUoKTtcblxuXHRcdFx0XHRpZiAoIXVwZGF0ZSB8fCAhdXBkYXRlLnVybCB8fCAhdXBkYXRlLnZlcnNpb24gfHwgIXVwZGF0ZS5wcm9kdWN0VmVyc2lvbikge1xuXHRcdFx0XHRcdHRoaXMuc2V0U3RhdGUoU3RhdGUuSWRsZSh1cGRhdGVUeXBlKSk7XG5cdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShudWxsKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICh1cGRhdGVUeXBlID09PSBVcGRhdGVUeXBlLkFyY2hpdmUpIHtcblx0XHRcdFx0XHR0aGlzLnNldFN0YXRlKFN0YXRlLkF2YWlsYWJsZUZvckRvd25sb2FkKHVwZGF0ZSkpO1xuXHRcdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUobnVsbCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLnNldFN0YXRlKFN0YXRlLkRvd25sb2FkaW5nKTtcblxuXHRcdFx0XHRyZXR1cm4gdGhpcy5jbGVhbnVwKHVwZGF0ZS52ZXJzaW9uKS50aGVuKCgpID0+IHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5nZXRVcGRhdGVQYWNrYWdlUGF0aCh1cGRhdGUudmVyc2lvbikudGhlbih1cGRhdGVQYWNrYWdlUGF0aCA9PiB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gcGZzLlByb21pc2VzLmV4aXN0cyh1cGRhdGVQYWNrYWdlUGF0aCkudGhlbihleGlzdHMgPT4ge1xuXHRcdFx0XHRcdFx0XHRpZiAoZXhpc3RzKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh1cGRhdGVQYWNrYWdlUGF0aCk7XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRjb25zdCBkb3dubG9hZFBhdGggPSBgJHt1cGRhdGVQYWNrYWdlUGF0aH0udG1wYDtcblxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdGhpcy5yZXF1ZXN0U2VydmljZS5yZXF1ZXN0KHsgdXJsOiB1cGRhdGUudXJsIH0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpXG5cdFx0XHRcdFx0XHRcdFx0LnRoZW4oY29udGV4dCA9PiB0aGlzLmZpbGVTZXJ2aWNlLndyaXRlRmlsZShVUkkuZmlsZShkb3dubG9hZFBhdGgpLCBjb250ZXh0LnN0cmVhbSkpXG5cdFx0XHRcdFx0XHRcdFx0LnRoZW4odXBkYXRlLnNoYTI1Nmhhc2ggPyAoKSA9PiBjaGVja3N1bShkb3dubG9hZFBhdGgsIHVwZGF0ZS5zaGEyNTZoYXNoKSA6ICgpID0+IHVuZGVmaW5lZClcblx0XHRcdFx0XHRcdFx0XHQudGhlbigoKSA9PiBwZnMuUHJvbWlzZXMucmVuYW1lKGRvd25sb2FkUGF0aCwgdXBkYXRlUGFja2FnZVBhdGgsIGZhbHNlIC8qIG5vIHJldHJ5ICovKSlcblx0XHRcdFx0XHRcdFx0XHQudGhlbigoKSA9PiB1cGRhdGVQYWNrYWdlUGF0aCk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9KS50aGVuKHBhY2thZ2VQYXRoID0+IHtcblx0XHRcdFx0XHRcdHRoaXMuYXZhaWxhYmxlVXBkYXRlID0geyBwYWNrYWdlUGF0aCB9O1xuXHRcdFx0XHRcdFx0dGhpcy5zZXRTdGF0ZShTdGF0ZS5Eb3dubG9hZGVkKHVwZGF0ZSkpO1xuXG5cdFx0XHRcdFx0XHRjb25zdCBmYXN0VXBkYXRlc0VuYWJsZWQgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCd1cGRhdGUuZW5hYmxlV2luZG93c0JhY2tncm91bmRVcGRhdGVzJyk7XG5cdFx0XHRcdFx0XHRpZiAoZmFzdFVwZGF0ZXNFbmFibGVkKSB7XG5cdFx0XHRcdFx0XHRcdGlmICh0aGlzLnByb2R1Y3RTZXJ2aWNlLnRhcmdldCA9PT0gJ3VzZXInKSB7XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5kb0FwcGx5VXBkYXRlKCk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuc2V0U3RhdGUoU3RhdGUuUmVhZHkodXBkYXRlKSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSlcblx0XHRcdC50aGVuKHVuZGVmaW5lZCwgZXJyID0+IHtcblx0XHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8eyBtZXNzYWdlSGFzaDogc3RyaW5nIH0sIFVwZGF0ZUVycm9yQ2xhc3NpZmljYXRpb24+KCd1cGRhdGU6ZXJyb3InLCB7IG1lc3NhZ2VIYXNoOiBTdHJpbmcoaGFzaChTdHJpbmcoZXJyKSkpIH0pO1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZXJyKTtcblxuXHRcdFx0XHQvLyBvbmx5IHNob3cgbWVzc2FnZSB3aGVuIGV4cGxpY2l0bHkgY2hlY2tpbmcgZm9yIHVwZGF0ZXNcblx0XHRcdFx0Y29uc3QgbWVzc2FnZTogc3RyaW5nIHwgdW5kZWZpbmVkID0gISFjb250ZXh0ID8gKGVyci5tZXNzYWdlIHx8IGVycikgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdHRoaXMuc2V0U3RhdGUoU3RhdGUuSWRsZShnZXRVcGRhdGVUeXBlKCksIG1lc3NhZ2UpKTtcblx0XHRcdH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGFzeW5jIGRvRG93bmxvYWRVcGRhdGUoc3RhdGU6IEF2YWlsYWJsZUZvckRvd25sb2FkKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHN0YXRlLnVwZGF0ZS51cmwpIHtcblx0XHRcdHRoaXMubmF0aXZlSG9zdE1haW5TZXJ2aWNlLm9wZW5FeHRlcm5hbCh1bmRlZmluZWQsIHN0YXRlLnVwZGF0ZS51cmwpO1xuXHRcdH1cblx0XHR0aGlzLnNldFN0YXRlKFN0YXRlLklkbGUoZ2V0VXBkYXRlVHlwZSgpKSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldFVwZGF0ZVBhY2thZ2VQYXRoKHZlcnNpb246IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0Y29uc3QgY2FjaGVQYXRoID0gYXdhaXQgdGhpcy5jYWNoZVBhdGg7XG5cdFx0cmV0dXJuIHBhdGguam9pbihjYWNoZVBhdGgsIGBDb2RlU2V0dXAtJHt0aGlzLnByb2R1Y3RTZXJ2aWNlLnF1YWxpdHl9LSR7dmVyc2lvbn0uZXhlYCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGNsZWFudXAoZXhjZXB0VmVyc2lvbjogc3RyaW5nIHwgbnVsbCA9IG51bGwpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBmaWx0ZXIgPSBleGNlcHRWZXJzaW9uID8gKG9uZTogc3RyaW5nKSA9PiAhKG5ldyBSZWdFeHAoYCR7dGhpcy5wcm9kdWN0U2VydmljZS5xdWFsaXR5fS0ke2V4Y2VwdFZlcnNpb259XFxcXC5leGUkYCkudGVzdChvbmUpKSA6ICgpID0+IHRydWU7XG5cblx0XHRjb25zdCBjYWNoZVBhdGggPSBhd2FpdCB0aGlzLmNhY2hlUGF0aDtcblx0XHRjb25zdCB2ZXJzaW9ucyA9IGF3YWl0IHBmcy5Qcm9taXNlcy5yZWFkZGlyKGNhY2hlUGF0aCk7XG5cblx0XHRjb25zdCBwcm9taXNlcyA9IHZlcnNpb25zLmZpbHRlcihmaWx0ZXIpLm1hcChhc3luYyBvbmUgPT4ge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgZnMucHJvbWlzZXMudW5saW5rKHBhdGguam9pbihjYWNoZVBhdGgsIG9uZSkpO1xuXHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdC8vIGlnbm9yZVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0YXdhaXQgUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGFzeW5jIGRvQXBwbHlVcGRhdGUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHRoaXMuc3RhdGUudHlwZSAhPT0gU3RhdGVUeXBlLkRvd25sb2FkZWQpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuYXZhaWxhYmxlVXBkYXRlKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdXBkYXRlID0gdGhpcy5zdGF0ZS51cGRhdGU7XG5cdFx0dGhpcy5zZXRTdGF0ZShTdGF0ZS5VcGRhdGluZyh1cGRhdGUpKTtcblxuXHRcdGNvbnN0IGNhY2hlUGF0aCA9IGF3YWl0IHRoaXMuY2FjaGVQYXRoO1xuXG5cdFx0dGhpcy5hdmFpbGFibGVVcGRhdGUudXBkYXRlRmlsZVBhdGggPSBwYXRoLmpvaW4oY2FjaGVQYXRoLCBgQ29kZVNldHVwLSR7dGhpcy5wcm9kdWN0U2VydmljZS5xdWFsaXR5fS0ke3VwZGF0ZS52ZXJzaW9ufS5mbGFnYCk7XG5cblx0XHRhd2FpdCBwZnMuUHJvbWlzZXMud3JpdGVGaWxlKHRoaXMuYXZhaWxhYmxlVXBkYXRlLnVwZGF0ZUZpbGVQYXRoLCAnZmxhZycpO1xuXHRcdGNvbnN0IGNoaWxkID0gc3Bhd24odGhpcy5hdmFpbGFibGVVcGRhdGUucGFja2FnZVBhdGgsIFsnL3ZlcnlzaWxlbnQnLCAnL2xvZycsIGAvdXBkYXRlPVwiJHt0aGlzLmF2YWlsYWJsZVVwZGF0ZS51cGRhdGVGaWxlUGF0aH1cImAsICcvbm9jbG9zZWFwcGxpY2F0aW9ucycsICcvbWVyZ2V0YXNrcz1ydW5jb2RlLCFkZXNrdG9waWNvbiwhcXVpY2tsYXVuY2hpY29uJ10sIHtcblx0XHRcdGRldGFjaGVkOiB0cnVlLFxuXHRcdFx0c3RkaW86IFsnaWdub3JlJywgJ2lnbm9yZScsICdpZ25vcmUnXSxcblx0XHRcdHdpbmRvd3NWZXJiYXRpbUFyZ3VtZW50czogdHJ1ZVxuXHRcdH0pO1xuXG5cdFx0Y2hpbGQub25jZSgnZXhpdCcsICgpID0+IHtcblx0XHRcdHRoaXMuYXZhaWxhYmxlVXBkYXRlID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5zZXRTdGF0ZShTdGF0ZS5JZGxlKGdldFVwZGF0ZVR5cGUoKSkpO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgcmVhZHlNdXRleE5hbWUgPSBgJHt0aGlzLnByb2R1Y3RTZXJ2aWNlLndpbjMyTXV0ZXhOYW1lfS1yZWFkeWA7XG5cdFx0Y29uc3QgbXV0ZXggPSBhd2FpdCBpbXBvcnQoJ0B2c2NvZGUvd2luZG93cy1tdXRleCcpO1xuXG5cdFx0Ly8gcG9sbCBmb3IgbXV0ZXgtcmVhZHlcblx0XHRwb2xsVW50aWwoKCkgPT4gbXV0ZXguaXNBY3RpdmUocmVhZHlNdXRleE5hbWUpKVxuXHRcdFx0LnRoZW4oKCkgPT4gdGhpcy5zZXRTdGF0ZShTdGF0ZS5SZWFkeSh1cGRhdGUpKSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgZG9RdWl0QW5kSW5zdGFsbCgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5zdGF0ZS50eXBlICE9PSBTdGF0ZVR5cGUuUmVhZHkgfHwgIXRoaXMuYXZhaWxhYmxlVXBkYXRlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKCd1cGRhdGUjcXVpdEFuZEluc3RhbGwoKTogcnVubmluZyByYXcjcXVpdEFuZEluc3RhbGwoKScpO1xuXG5cdFx0aWYgKHRoaXMuYXZhaWxhYmxlVXBkYXRlLnVwZGF0ZUZpbGVQYXRoKSB7XG5cdFx0XHRmcy51bmxpbmtTeW5jKHRoaXMuYXZhaWxhYmxlVXBkYXRlLnVwZGF0ZUZpbGVQYXRoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0c3Bhd24odGhpcy5hdmFpbGFibGVVcGRhdGUucGFja2FnZVBhdGgsIFsnL3NpbGVudCcsICcvbG9nJywgJy9tZXJnZXRhc2tzPXJ1bmNvZGUsIWRlc2t0b3BpY29uLCFxdWlja2xhdW5jaGljb24nXSwge1xuXHRcdFx0XHRkZXRhY2hlZDogdHJ1ZSxcblx0XHRcdFx0c3RkaW86IFsnaWdub3JlJywgJ2lnbm9yZScsICdpZ25vcmUnXVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGdldFVwZGF0ZVR5cGUoKTogVXBkYXRlVHlwZSB7XG5cdFx0cmV0dXJuIGdldFVwZGF0ZVR5cGUoKTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIF9hcHBseVNwZWNpZmljVXBkYXRlKHBhY2thZ2VQYXRoOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy5zdGF0ZS50eXBlICE9PSBTdGF0ZVR5cGUuSWRsZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZhc3RVcGRhdGVzRW5hYmxlZCA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ3VwZGF0ZS5lbmFibGVXaW5kb3dzQmFja2dyb3VuZFVwZGF0ZXMnKTtcblx0XHRjb25zdCB1cGRhdGU6IElVcGRhdGUgPSB7IHZlcnNpb246ICd1bmtub3duJywgcHJvZHVjdFZlcnNpb246ICd1bmtub3duJyB9O1xuXG5cdFx0dGhpcy5zZXRTdGF0ZShTdGF0ZS5Eb3dubG9hZGluZyk7XG5cdFx0dGhpcy5hdmFpbGFibGVVcGRhdGUgPSB7IHBhY2thZ2VQYXRoIH07XG5cdFx0dGhpcy5zZXRTdGF0ZShTdGF0ZS5Eb3dubG9hZGVkKHVwZGF0ZSkpO1xuXG5cdFx0aWYgKGZhc3RVcGRhdGVzRW5hYmxlZCkge1xuXHRcdFx0aWYgKHRoaXMucHJvZHVjdFNlcnZpY2UudGFyZ2V0ID09PSAndXNlcicpIHtcblx0XHRcdFx0dGhpcy5kb0FwcGx5VXBkYXRlKCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuc2V0U3RhdGUoU3RhdGUuUmVhZHkodXBkYXRlKSk7XG5cdFx0fVxuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsYUFBYTtBQUN0QixZQUFZLFFBQVE7QUFDcEIsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsZUFBZTtBQUN4QixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxZQUFZO0FBQ3JCLFlBQVksVUFBVTtBQUN0QixTQUFTLFdBQVc7QUFDcEIsU0FBUyxnQkFBZ0I7QUFDekIsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsNkJB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TSxPQUFPLHVCQUF1QjtBQUdsRCxjQUFVLE1BQU0sTUFBTSxTQUFTLGNBQWMsQ0FBQyxFQUM1QyxLQUFLLE1BQU0sS0FBSyxTQUFTLE1BQU0sTUFBTSxNQUFNLENBQUMsQ0FBQztBQUFBLEVBQ2hEO0FBQUEsRUFFbUIsbUJBQXlCO0FBQzNDLFFBQUksS0FBSyxNQUFNLFNBQVMsVUFBVSxTQUFTLENBQUMsS0FBSyxpQkFBaUI7QUFDakU7QUFBQSxJQUNEO0FBRUEsU0FBSyxXQUFXLE1BQU0sdURBQXVEO0FBRTdFLFFBQUksS0FBSyxnQkFBZ0IsZ0JBQWdCO0FBQ3hDLFNBQUcsV0FBVyxLQUFLLGdCQUFnQixjQUFjO0FBQUEsSUFDbEQsT0FBTztBQUNOLFlBQU0sS0FBSyxnQkFBZ0IsYUFBYSxDQUFDLFdBQVcsUUFBUSxtREFBbUQsR0FBRztBQUFBLFFBQ2pILFVBQVU7QUFBQSxRQUNWLE9BQU8sQ0FBQyxVQUFVLFVBQVUsUUFBUTtBQUFBLE1BQ3JDLENBQUM7QUFBQSxJQUNGO0FBQUEsRUFDRDtBQUFBLEVBRW1CLGdCQUE0QjtBQUM5QyxXQUFPLGNBQWM7QUFBQSxFQUN0QjtBQUFBLEVBRUEsTUFBZSxxQkFBcUIsYUFBb0M7QUFDdkUsUUFBSSxLQUFLLE1BQU0sU0FBUyxVQUFVLE1BQU07QUFDdkM7QUFBQSxJQUNEO0FBRUEsVUFBTSxxQkFBcUIsS0FBSyxxQkFBcUIsU0FBUyx1Q0FBdUM7QUFDckcsVUFBTSxTQUFrQixFQUFFLFNBQVMsV0FBVyxnQkFBZ0IsVUFBVTtBQUV4RSxTQUFLLFNBQVMsTUFBTSxXQUFXO0FBQy9CLFNBQUssa0JBQWtCLEVBQUUsWUFBWTtBQUNyQyxTQUFLLFNBQVMsTUFBTSxXQUFXLE1BQU0sQ0FBQztBQUV0QyxRQUFJLG9CQUFvQjtBQUN2QixVQUFJLEtBQUssZUFBZSxXQUFXLFFBQVE7QUFDMUMsYUFBSyxjQUFjO0FBQUEsTUFDcEI7QUFBQSxJQUNELE9BQU87QUFDTixXQUFLLFNBQVMsTUFBTSxNQUFNLE1BQU0sQ0FBQztBQUFBLElBQ2xDO0FBQUEsRUFDRDtBQUNEO0FBcE9LO0FBQUEsRUFESDtBQUFBLEdBSlcsbUJBS1I7QUFMUSxxQkFBTjtBQUFBLEVBV0o7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBbkJVOyIsCiAgIm5hbWVzIjogWyJjb250ZXh0Il0KfQo=
