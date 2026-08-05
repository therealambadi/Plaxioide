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
import { timeout } from "../../../base/common/async.js";
import { debounce } from "../../../base/common/decorators.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { isWindows, platform } from "../../../base/common/platform.js";
import { GeneralShellType, WindowsShellType } from "../common/terminal.js";
const SHELL_EXECUTABLES = [
  "cmd.exe",
  "powershell.exe",
  "pwsh.exe",
  "bash.exe",
  "git-cmd.exe",
  "wsl.exe",
  "ubuntu.exe",
  "ubuntu1804.exe",
  "kali.exe",
  "debian.exe",
  "opensuse-42.exe",
  "sles-12.exe",
  "julia.exe",
  "nu.exe",
  "node.exe"
];
const SHELL_EXECUTABLE_REGEXES = [
  /^python(\d(\.\d{0,2})?)?\.exe$/
];
let windowsProcessTree;
class WindowsShellHelper extends Disposable {
  constructor(_rootProcessId) {
    super();
    this._rootProcessId = _rootProcessId;
    this._shellTitle = "";
    this._onShellNameChanged = new Emitter();
    this._onShellTypeChanged = new Emitter();
    if (!isWindows) {
      throw new Error(`WindowsShellHelper cannot be instantiated on ${platform}`);
    }
    this._startMonitoringShell();
  }
  get shellType() {
    return this._shellType;
  }
  get shellTitle() {
    return this._shellTitle;
  }
  get onShellNameChanged() {
    return this._onShellNameChanged.event;
  }
  get onShellTypeChanged() {
    return this._onShellTypeChanged.event;
  }
  async _startMonitoringShell() {
    if (this._store.isDisposed) {
      return;
    }
    this.checkShell();
  }
  async checkShell() {
    if (isWindows) {
      await timeout(300);
      this.getShellName().then((title) => {
        const type = this.getShellType(title);
        if (type !== this._shellType) {
          this._onShellTypeChanged.fire(type);
          this._onShellNameChanged.fire(title);
          this._shellType = type;
          this._shellTitle = title;
        }
      });
    }
  }
  traverseTree(tree) {
    if (!tree) {
      return "";
    }
    if (SHELL_EXECUTABLES.indexOf(tree.name) === -1) {
      return tree.name;
    }
    for (const regex of SHELL_EXECUTABLE_REGEXES) {
      if (tree.name.match(regex)) {
        return tree.name;
      }
    }
    if (!tree.children || tree.children.length === 0) {
      return tree.name;
    }
    let favouriteChild = 0;
    for (; favouriteChild < tree.children.length; favouriteChild++) {
      const child = tree.children[favouriteChild];
      if (!child.children || child.children.length === 0) {
        break;
      }
      if (child.children[0].name !== "conhost.exe") {
        break;
      }
    }
    if (favouriteChild >= tree.children.length) {
      return tree.name;
    }
    return this.traverseTree(tree.children[favouriteChild]);
  }
  /**
   * Returns the innermost shell executable running in the terminal
   */
  async getShellName() {
    if (this._store.isDisposed) {
      return Promise.resolve("");
    }
    if (this._currentRequest) {
      return this._currentRequest;
    }
    if (!windowsProcessTree) {
      windowsProcessTree = await import("@vscode/windows-process-tree");
    }
    this._currentRequest = new Promise((resolve) => {
      windowsProcessTree.getProcessTree(this._rootProcessId, (tree) => {
        const name = this.traverseTree(tree);
        this._currentRequest = void 0;
        resolve(name);
      });
    });
    return this._currentRequest;
  }
  getShellType(executable) {
    switch (executable.toLowerCase()) {
      case "cmd.exe":
        return WindowsShellType.CommandPrompt;
      case "powershell.exe":
      case "pwsh.exe":
        return GeneralShellType.PowerShell;
      case "bash.exe":
      case "git-cmd.exe":
        return WindowsShellType.GitBash;
      case "julia.exe":
        return GeneralShellType.Julia;
      case "node.exe":
        return GeneralShellType.Node;
      case "nu.exe":
        return GeneralShellType.NuShell;
      case "wsl.exe":
      case "ubuntu.exe":
      case "ubuntu1804.exe":
      case "kali.exe":
      case "debian.exe":
      case "opensuse-42.exe":
      case "sles-12.exe":
        return WindowsShellType.Wsl;
      default:
        if (executable.match(/python(\d(\.\d{0,2})?)?\.exe/)) {
          return GeneralShellType.Python;
        }
        return void 0;
    }
  }
}
__decorateClass([
  debounce(500)
], WindowsShellHelper.prototype, "checkShell", 1);
export {
  WindowsShellHelper
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS90ZXJtaW5hbC9ub2RlL3dpbmRvd3NTaGVsbEhlbHBlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IHRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBkZWJvdW5jZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2RlY29yYXRvcnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBpc1dpbmRvd3MsIHBsYXRmb3JtIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgR2VuZXJhbFNoZWxsVHlwZSwgVGVybWluYWxTaGVsbFR5cGUsIFdpbmRvd3NTaGVsbFR5cGUgfSBmcm9tICcuLi9jb21tb24vdGVybWluYWwuanMnO1xuaW1wb3J0IHR5cGUgKiBhcyBXaW5kb3dzUHJvY2Vzc1RyZWVUeXBlIGZyb20gJ0B2c2NvZGUvd2luZG93cy1wcm9jZXNzLXRyZWUnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElXaW5kb3dzU2hlbGxIZWxwZXIgZXh0ZW5kcyBJRGlzcG9zYWJsZSB7XG5cdHJlYWRvbmx5IG9uU2hlbGxOYW1lQ2hhbmdlZDogRXZlbnQ8c3RyaW5nPjtcblx0cmVhZG9ubHkgb25TaGVsbFR5cGVDaGFuZ2VkOiBFdmVudDxUZXJtaW5hbFNoZWxsVHlwZSB8IHVuZGVmaW5lZD47XG5cdGdldFNoZWxsVHlwZSh0aXRsZTogc3RyaW5nKTogVGVybWluYWxTaGVsbFR5cGUgfCB1bmRlZmluZWQ7XG5cdGdldFNoZWxsTmFtZSgpOiBQcm9taXNlPHN0cmluZz47XG59XG5cbmNvbnN0IFNIRUxMX0VYRUNVVEFCTEVTID0gW1xuXHQnY21kLmV4ZScsXG5cdCdwb3dlcnNoZWxsLmV4ZScsXG5cdCdwd3NoLmV4ZScsXG5cdCdiYXNoLmV4ZScsXG5cdCdnaXQtY21kLmV4ZScsXG5cdCd3c2wuZXhlJyxcblx0J3VidW50dS5leGUnLFxuXHQndWJ1bnR1MTgwNC5leGUnLFxuXHQna2FsaS5leGUnLFxuXHQnZGViaWFuLmV4ZScsXG5cdCdvcGVuc3VzZS00Mi5leGUnLFxuXHQnc2xlcy0xMi5leGUnLFxuXHQnanVsaWEuZXhlJyxcblx0J251LmV4ZScsXG5cdCdub2RlLmV4ZScsXG5dO1xuXG5jb25zdCBTSEVMTF9FWEVDVVRBQkxFX1JFR0VYRVMgPSBbXG5cdC9ecHl0aG9uKFxcZChcXC5cXGR7MCwyfSk/KT9cXC5leGUkLyxcbl07XG5cbmxldCB3aW5kb3dzUHJvY2Vzc1RyZWU6IHR5cGVvZiBXaW5kb3dzUHJvY2Vzc1RyZWVUeXBlO1xuXG5leHBvcnQgY2xhc3MgV2luZG93c1NoZWxsSGVscGVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXaW5kb3dzU2hlbGxIZWxwZXIge1xuXHRwcml2YXRlIF9jdXJyZW50UmVxdWVzdDogUHJvbWlzZTxzdHJpbmc+IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9zaGVsbFR5cGU6IFRlcm1pbmFsU2hlbGxUeXBlIHwgdW5kZWZpbmVkO1xuXHRnZXQgc2hlbGxUeXBlKCk6IFRlcm1pbmFsU2hlbGxUeXBlIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX3NoZWxsVHlwZTsgfVxuXHRwcml2YXRlIF9zaGVsbFRpdGxlOiBzdHJpbmcgPSAnJztcblx0Z2V0IHNoZWxsVGl0bGUoKTogc3RyaW5nIHsgcmV0dXJuIHRoaXMuX3NoZWxsVGl0bGU7IH1cblx0cHJpdmF0ZSByZWFkb25seSBfb25TaGVsbE5hbWVDaGFuZ2VkID0gbmV3IEVtaXR0ZXI8c3RyaW5nPigpO1xuXHRnZXQgb25TaGVsbE5hbWVDaGFuZ2VkKCk6IEV2ZW50PHN0cmluZz4geyByZXR1cm4gdGhpcy5fb25TaGVsbE5hbWVDaGFuZ2VkLmV2ZW50OyB9XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uU2hlbGxUeXBlQ2hhbmdlZCA9IG5ldyBFbWl0dGVyPFRlcm1pbmFsU2hlbGxUeXBlIHwgdW5kZWZpbmVkPigpO1xuXHRnZXQgb25TaGVsbFR5cGVDaGFuZ2VkKCk6IEV2ZW50PFRlcm1pbmFsU2hlbGxUeXBlIHwgdW5kZWZpbmVkPiB7IHJldHVybiB0aGlzLl9vblNoZWxsVHlwZUNoYW5nZWQuZXZlbnQ7IH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIF9yb290UHJvY2Vzc0lkOiBudW1iZXJcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdGlmICghaXNXaW5kb3dzKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYFdpbmRvd3NTaGVsbEhlbHBlciBjYW5ub3QgYmUgaW5zdGFudGlhdGVkIG9uICR7cGxhdGZvcm19YCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fc3RhcnRNb25pdG9yaW5nU2hlbGwoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3N0YXJ0TW9uaXRvcmluZ1NoZWxsKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLl9zdG9yZS5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuY2hlY2tTaGVsbCgpO1xuXHR9XG5cblx0QGRlYm91bmNlKDUwMClcblx0YXN5bmMgY2hlY2tTaGVsbCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoaXNXaW5kb3dzKSB7XG5cdFx0XHQvLyBXYWl0IHRvIGdpdmUgdGhlIHNoZWxsIHNvbWUgdGltZSB0byBhY3R1YWxseSBsYXVuY2ggYSBwcm9jZXNzLCB0aGlzXG5cdFx0XHQvLyBjb3VsZCBsZWFkIHRvIGEgcmFjZSBjb25kaXRpb24gYnV0IGl0IHdvdWxkIGJlIHJlY292ZXJlZCBmcm9tIHdoZW5cblx0XHRcdC8vIGRhdGEgc3RvcHMgYW5kIHNob3VsZCBjb3ZlciB0aGUgbWFqb3JpdHkgb2YgY2FzZXNcblx0XHRcdGF3YWl0IHRpbWVvdXQoMzAwKTtcblx0XHRcdHRoaXMuZ2V0U2hlbGxOYW1lKCkudGhlbih0aXRsZSA9PiB7XG5cdFx0XHRcdGNvbnN0IHR5cGUgPSB0aGlzLmdldFNoZWxsVHlwZSh0aXRsZSk7XG5cdFx0XHRcdGlmICh0eXBlICE9PSB0aGlzLl9zaGVsbFR5cGUpIHtcblx0XHRcdFx0XHR0aGlzLl9vblNoZWxsVHlwZUNoYW5nZWQuZmlyZSh0eXBlKTtcblx0XHRcdFx0XHR0aGlzLl9vblNoZWxsTmFtZUNoYW5nZWQuZmlyZSh0aXRsZSk7XG5cdFx0XHRcdFx0dGhpcy5fc2hlbGxUeXBlID0gdHlwZTtcblx0XHRcdFx0XHR0aGlzLl9zaGVsbFRpdGxlID0gdGl0bGU7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdHJhdmVyc2VUcmVlKHRyZWU6IGFueSk6IHN0cmluZyB7XG5cdFx0aWYgKCF0cmVlKSB7XG5cdFx0XHRyZXR1cm4gJyc7XG5cdFx0fVxuXHRcdGlmIChTSEVMTF9FWEVDVVRBQkxFUy5pbmRleE9mKHRyZWUubmFtZSkgPT09IC0xKSB7XG5cdFx0XHRyZXR1cm4gdHJlZS5uYW1lO1xuXHRcdH1cblx0XHRmb3IgKGNvbnN0IHJlZ2V4IG9mIFNIRUxMX0VYRUNVVEFCTEVfUkVHRVhFUykge1xuXHRcdFx0aWYgKHRyZWUubmFtZS5tYXRjaChyZWdleCkpIHtcblx0XHRcdFx0cmV0dXJuIHRyZWUubmFtZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKCF0cmVlLmNoaWxkcmVuIHx8IHRyZWUuY2hpbGRyZW4ubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gdHJlZS5uYW1lO1xuXHRcdH1cblx0XHRsZXQgZmF2b3VyaXRlQ2hpbGQgPSAwO1xuXHRcdGZvciAoOyBmYXZvdXJpdGVDaGlsZCA8IHRyZWUuY2hpbGRyZW4ubGVuZ3RoOyBmYXZvdXJpdGVDaGlsZCsrKSB7XG5cdFx0XHRjb25zdCBjaGlsZCA9IHRyZWUuY2hpbGRyZW5bZmF2b3VyaXRlQ2hpbGRdO1xuXHRcdFx0aWYgKCFjaGlsZC5jaGlsZHJlbiB8fCBjaGlsZC5jaGlsZHJlbi5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRpZiAoY2hpbGQuY2hpbGRyZW5bMF0ubmFtZSAhPT0gJ2Nvbmhvc3QuZXhlJykge1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKGZhdm91cml0ZUNoaWxkID49IHRyZWUuY2hpbGRyZW4ubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4gdHJlZS5uYW1lO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy50cmF2ZXJzZVRyZWUodHJlZS5jaGlsZHJlbltmYXZvdXJpdGVDaGlsZF0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIGlubmVybW9zdCBzaGVsbCBleGVjdXRhYmxlIHJ1bm5pbmcgaW4gdGhlIHRlcm1pbmFsXG5cdCAqL1xuXHRhc3luYyBnZXRTaGVsbE5hbWUoKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRpZiAodGhpcy5fc3RvcmUuaXNEaXNwb3NlZCkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgnJyk7XG5cdFx0fVxuXHRcdC8vIFByZXZlbnQgbXVsdGlwbGUgcmVxdWVzdHMgYXQgb25jZSwgaW5zdGVhZCByZXR1cm4gY3VycmVudCByZXF1ZXN0XG5cdFx0aWYgKHRoaXMuX2N1cnJlbnRSZXF1ZXN0KSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fY3VycmVudFJlcXVlc3Q7XG5cdFx0fVxuXHRcdGlmICghd2luZG93c1Byb2Nlc3NUcmVlKSB7XG5cdFx0XHR3aW5kb3dzUHJvY2Vzc1RyZWUgPSBhd2FpdCBpbXBvcnQoJ0B2c2NvZGUvd2luZG93cy1wcm9jZXNzLXRyZWUnKTtcblx0XHR9XG5cdFx0dGhpcy5fY3VycmVudFJlcXVlc3QgPSBuZXcgUHJvbWlzZTxzdHJpbmc+KHJlc29sdmUgPT4ge1xuXHRcdFx0d2luZG93c1Byb2Nlc3NUcmVlLmdldFByb2Nlc3NUcmVlKHRoaXMuX3Jvb3RQcm9jZXNzSWQsIHRyZWUgPT4ge1xuXHRcdFx0XHRjb25zdCBuYW1lID0gdGhpcy50cmF2ZXJzZVRyZWUodHJlZSk7XG5cdFx0XHRcdHRoaXMuX2N1cnJlbnRSZXF1ZXN0ID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRyZXNvbHZlKG5hbWUpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0cmV0dXJuIHRoaXMuX2N1cnJlbnRSZXF1ZXN0O1xuXHR9XG5cblx0Z2V0U2hlbGxUeXBlKGV4ZWN1dGFibGU6IHN0cmluZyk6IFRlcm1pbmFsU2hlbGxUeXBlIHwgdW5kZWZpbmVkIHtcblx0XHRzd2l0Y2ggKGV4ZWN1dGFibGUudG9Mb3dlckNhc2UoKSkge1xuXHRcdFx0Y2FzZSAnY21kLmV4ZSc6XG5cdFx0XHRcdHJldHVybiBXaW5kb3dzU2hlbGxUeXBlLkNvbW1hbmRQcm9tcHQ7XG5cdFx0XHRjYXNlICdwb3dlcnNoZWxsLmV4ZSc6XG5cdFx0XHRjYXNlICdwd3NoLmV4ZSc6XG5cdFx0XHRcdHJldHVybiBHZW5lcmFsU2hlbGxUeXBlLlBvd2VyU2hlbGw7XG5cdFx0XHRjYXNlICdiYXNoLmV4ZSc6XG5cdFx0XHRjYXNlICdnaXQtY21kLmV4ZSc6XG5cdFx0XHRcdHJldHVybiBXaW5kb3dzU2hlbGxUeXBlLkdpdEJhc2g7XG5cdFx0XHRjYXNlICdqdWxpYS5leGUnOlxuXHRcdFx0XHRyZXR1cm4gR2VuZXJhbFNoZWxsVHlwZS5KdWxpYTtcblx0XHRcdGNhc2UgJ25vZGUuZXhlJzpcblx0XHRcdFx0cmV0dXJuIEdlbmVyYWxTaGVsbFR5cGUuTm9kZTtcblx0XHRcdGNhc2UgJ251LmV4ZSc6XG5cdFx0XHRcdHJldHVybiBHZW5lcmFsU2hlbGxUeXBlLk51U2hlbGw7XG5cdFx0XHRjYXNlICd3c2wuZXhlJzpcblx0XHRcdGNhc2UgJ3VidW50dS5leGUnOlxuXHRcdFx0Y2FzZSAndWJ1bnR1MTgwNC5leGUnOlxuXHRcdFx0Y2FzZSAna2FsaS5leGUnOlxuXHRcdFx0Y2FzZSAnZGViaWFuLmV4ZSc6XG5cdFx0XHRjYXNlICdvcGVuc3VzZS00Mi5leGUnOlxuXHRcdFx0Y2FzZSAnc2xlcy0xMi5leGUnOlxuXHRcdFx0XHRyZXR1cm4gV2luZG93c1NoZWxsVHlwZS5Xc2w7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRpZiAoZXhlY3V0YWJsZS5tYXRjaCgvcHl0aG9uKFxcZChcXC5cXGR7MCwyfSk/KT9cXC5leGUvKSkge1xuXHRcdFx0XHRcdHJldHVybiBHZW5lcmFsU2hlbGxUeXBlLlB5dGhvbjtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7OztBQUtBLFNBQVMsZUFBZTtBQUN4QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGVBQXNCO0FBQy9CLFNBQVMsa0JBQStCO0FBQ3hDLFNBQVMsV0FBVyxnQkFBZ0I7QUFDcEMsU0FBUyxrQkFBcUMsd0JBQXdCO0FBVXRFLE1BQU0sb0JBQW9CO0FBQUEsRUFDekI7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUNEO0FBRUEsTUFBTSwyQkFBMkI7QUFBQSxFQUNoQztBQUNEO0FBRUEsSUFBSTtBQUVHLE1BQU0sMkJBQTJCLFdBQTBDO0FBQUEsRUFXakYsWUFDUyxnQkFDUDtBQUNELFVBQU07QUFGRTtBQVJULFNBQVEsY0FBc0I7QUFFOUIsU0FBaUIsc0JBQXNCLElBQUksUUFBZ0I7QUFFM0QsU0FBaUIsc0JBQXNCLElBQUksUUFBdUM7QUFRakYsUUFBSSxDQUFDLFdBQVc7QUFDZixZQUFNLElBQUksTUFBTSxnREFBZ0QsUUFBUSxFQUFFO0FBQUEsSUFDM0U7QUFFQSxTQUFLLHNCQUFzQjtBQUFBLEVBQzVCO0FBQUEsRUFsQkEsSUFBSSxZQUEyQztBQUFFLFdBQU8sS0FBSztBQUFBLEVBQVk7QUFBQSxFQUV6RSxJQUFJLGFBQXFCO0FBQUUsV0FBTyxLQUFLO0FBQUEsRUFBYTtBQUFBLEVBRXBELElBQUkscUJBQW9DO0FBQUUsV0FBTyxLQUFLLG9CQUFvQjtBQUFBLEVBQU87QUFBQSxFQUVqRixJQUFJLHFCQUEyRDtBQUFFLFdBQU8sS0FBSyxvQkFBb0I7QUFBQSxFQUFPO0FBQUEsRUFjeEcsTUFBYyx3QkFBdUM7QUFDcEQsUUFBSSxLQUFLLE9BQU8sWUFBWTtBQUMzQjtBQUFBLElBQ0Q7QUFDQSxTQUFLLFdBQVc7QUFBQSxFQUNqQjtBQUFBLEVBR0EsTUFBTSxhQUE0QjtBQUNqQyxRQUFJLFdBQVc7QUFJZCxZQUFNLFFBQVEsR0FBRztBQUNqQixXQUFLLGFBQWEsRUFBRSxLQUFLLFdBQVM7QUFDakMsY0FBTSxPQUFPLEtBQUssYUFBYSxLQUFLO0FBQ3BDLFlBQUksU0FBUyxLQUFLLFlBQVk7QUFDN0IsZUFBSyxvQkFBb0IsS0FBSyxJQUFJO0FBQ2xDLGVBQUssb0JBQW9CLEtBQUssS0FBSztBQUNuQyxlQUFLLGFBQWE7QUFDbEIsZUFBSyxjQUFjO0FBQUEsUUFDcEI7QUFBQSxNQUNELENBQUM7QUFBQSxJQUNGO0FBQUEsRUFDRDtBQUFBLEVBRVEsYUFBYSxNQUFtQjtBQUN2QyxRQUFJLENBQUMsTUFBTTtBQUNWLGFBQU87QUFBQSxJQUNSO0FBQ0EsUUFBSSxrQkFBa0IsUUFBUSxLQUFLLElBQUksTUFBTSxJQUFJO0FBQ2hELGFBQU8sS0FBSztBQUFBLElBQ2I7QUFDQSxlQUFXLFNBQVMsMEJBQTBCO0FBQzdDLFVBQUksS0FBSyxLQUFLLE1BQU0sS0FBSyxHQUFHO0FBQzNCLGVBQU8sS0FBSztBQUFBLE1BQ2I7QUFBQSxJQUNEO0FBQ0EsUUFBSSxDQUFDLEtBQUssWUFBWSxLQUFLLFNBQVMsV0FBVyxHQUFHO0FBQ2pELGFBQU8sS0FBSztBQUFBLElBQ2I7QUFDQSxRQUFJLGlCQUFpQjtBQUNyQixXQUFPLGlCQUFpQixLQUFLLFNBQVMsUUFBUSxrQkFBa0I7QUFDL0QsWUFBTSxRQUFRLEtBQUssU0FBUyxjQUFjO0FBQzFDLFVBQUksQ0FBQyxNQUFNLFlBQVksTUFBTSxTQUFTLFdBQVcsR0FBRztBQUNuRDtBQUFBLE1BQ0Q7QUFDQSxVQUFJLE1BQU0sU0FBUyxDQUFDLEVBQUUsU0FBUyxlQUFlO0FBQzdDO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFDQSxRQUFJLGtCQUFrQixLQUFLLFNBQVMsUUFBUTtBQUMzQyxhQUFPLEtBQUs7QUFBQSxJQUNiO0FBQ0EsV0FBTyxLQUFLLGFBQWEsS0FBSyxTQUFTLGNBQWMsQ0FBQztBQUFBLEVBQ3ZEO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLQSxNQUFNLGVBQWdDO0FBQ3JDLFFBQUksS0FBSyxPQUFPLFlBQVk7QUFDM0IsYUFBTyxRQUFRLFFBQVEsRUFBRTtBQUFBLElBQzFCO0FBRUEsUUFBSSxLQUFLLGlCQUFpQjtBQUN6QixhQUFPLEtBQUs7QUFBQSxJQUNiO0FBQ0EsUUFBSSxDQUFDLG9CQUFvQjtBQUN4QiwyQkFBcUIsTUFBTSxPQUFPLDhCQUE4QjtBQUFBLElBQ2pFO0FBQ0EsU0FBSyxrQkFBa0IsSUFBSSxRQUFnQixhQUFXO0FBQ3JELHlCQUFtQixlQUFlLEtBQUssZ0JBQWdCLFVBQVE7QUFDOUQsY0FBTSxPQUFPLEtBQUssYUFBYSxJQUFJO0FBQ25DLGFBQUssa0JBQWtCO0FBQ3ZCLGdCQUFRLElBQUk7QUFBQSxNQUNiLENBQUM7QUFBQSxJQUNGLENBQUM7QUFDRCxXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFQSxhQUFhLFlBQW1EO0FBQy9ELFlBQVEsV0FBVyxZQUFZLEdBQUc7QUFBQSxNQUNqQyxLQUFLO0FBQ0osZUFBTyxpQkFBaUI7QUFBQSxNQUN6QixLQUFLO0FBQUEsTUFDTCxLQUFLO0FBQ0osZUFBTyxpQkFBaUI7QUFBQSxNQUN6QixLQUFLO0FBQUEsTUFDTCxLQUFLO0FBQ0osZUFBTyxpQkFBaUI7QUFBQSxNQUN6QixLQUFLO0FBQ0osZUFBTyxpQkFBaUI7QUFBQSxNQUN6QixLQUFLO0FBQ0osZUFBTyxpQkFBaUI7QUFBQSxNQUN6QixLQUFLO0FBQ0osZUFBTyxpQkFBaUI7QUFBQSxNQUN6QixLQUFLO0FBQUEsTUFDTCxLQUFLO0FBQUEsTUFDTCxLQUFLO0FBQUEsTUFDTCxLQUFLO0FBQUEsTUFDTCxLQUFLO0FBQUEsTUFDTCxLQUFLO0FBQUEsTUFDTCxLQUFLO0FBQ0osZUFBTyxpQkFBaUI7QUFBQSxNQUN6QjtBQUNDLFlBQUksV0FBVyxNQUFNLDhCQUE4QixHQUFHO0FBQ3JELGlCQUFPLGlCQUFpQjtBQUFBLFFBQ3pCO0FBQ0EsZUFBTztBQUFBLElBQ1Q7QUFBQSxFQUNEO0FBQ0Q7QUF4R087QUFBQSxFQURMLFNBQVMsR0FBRztBQUFBLEdBOUJELG1CQStCTjsiLAogICJuYW1lcyI6IFtdCn0K
