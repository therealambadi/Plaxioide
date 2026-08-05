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
import { ipcRenderer } from "../../../../base/parts/sandbox/electron-sandbox/globals.js";
import { URI } from "../../../../base/common/uri.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { registerRemoteContributions } from "./terminalRemote.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ITerminalService } from "../browser/terminal.js";
import { disposableWindowInterval, getActiveWindow } from "../../../../base/browser/dom.js";
let TerminalNativeContribution = class extends Disposable {
  constructor(_fileService, _terminalService, remoteAgentService, nativeHostService) {
    super();
    this._fileService = _fileService;
    this._terminalService = _terminalService;
    ipcRenderer.on("vscode:openFiles", (_, request) => {
      this._onOpenFileRequest(request);
    });
    this._register(nativeHostService.onDidResumeOS(() => this._onOsResume()));
    this._terminalService.setNativeDelegate({
      getWindowCount: () => nativeHostService.getWindowCount()
    });
    const connection = remoteAgentService.getConnection();
    if (connection && connection.remoteAuthority) {
      registerRemoteContributions();
    }
  }
  _onOsResume() {
    for (const instance of this._terminalService.instances) {
      instance.xterm?.forceRedraw();
    }
  }
  async _onOpenFileRequest(request) {
    if (request.termProgram === "vscode" && request.filesToWait) {
      const waitMarkerFileUri = URI.revive(request.filesToWait.waitMarkerFileUri);
      await this._whenFileDeleted(waitMarkerFileUri);
      this._terminalService.activeInstance?.focus();
    }
  }
  _whenFileDeleted(path) {
    return new Promise((resolve) => {
      let running = false;
      const interval = disposableWindowInterval(getActiveWindow(), async () => {
        if (!running) {
          running = true;
          const exists = await this._fileService.exists(path);
          running = false;
          if (!exists) {
            interval.dispose();
            resolve(void 0);
          }
        }
      }, 1e3);
    });
  }
};
TerminalNativeContribution = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, ITerminalService),
  __decorateParam(2, IRemoteAgentService),
  __decorateParam(3, INativeHostService)
], TerminalNativeContribution);
export {
  TerminalNativeContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9lbGVjdHJvbi1zYW5kYm94L3Rlcm1pbmFsTmF0aXZlQ29udHJpYnV0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgaXBjUmVuZGVyZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3BhcnRzL3NhbmRib3gvZWxlY3Ryb24tc2FuZGJveC9nbG9iYWxzLmpzJztcbmltcG9ydCB7IElOYXRpdmVPcGVuRmlsZVJlcXVlc3QgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93aW5kb3cvY29tbW9uL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVyUmVtb3RlQ29udHJpYnV0aW9ucyB9IGZyb20gJy4vdGVybWluYWxSZW1vdGUuanMnO1xuaW1wb3J0IHsgSVJlbW90ZUFnZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3JlbW90ZS9jb21tb24vcmVtb3RlQWdlbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElOYXRpdmVIb3N0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25hdGl2ZS9jb21tb24vbmF0aXZlLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSVRlcm1pbmFsU2VydmljZSB9IGZyb20gJy4uL2Jyb3dzZXIvdGVybWluYWwuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IGRpc3Bvc2FibGVXaW5kb3dJbnRlcnZhbCwgZ2V0QWN0aXZlV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5cbmV4cG9ydCBjbGFzcyBUZXJtaW5hbE5hdGl2ZUNvbnRyaWJ1dGlvbiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblx0ZGVjbGFyZSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9maWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJVGVybWluYWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsU2VydmljZTogSVRlcm1pbmFsU2VydmljZSxcblx0XHRASVJlbW90ZUFnZW50U2VydmljZSByZW1vdGVBZ2VudFNlcnZpY2U6IElSZW1vdGVBZ2VudFNlcnZpY2UsXG5cdFx0QElOYXRpdmVIb3N0U2VydmljZSBuYXRpdmVIb3N0U2VydmljZTogSU5hdGl2ZUhvc3RTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRpcGNSZW5kZXJlci5vbigndnNjb2RlOm9wZW5GaWxlcycsIChfOiB1bmtub3duLCByZXF1ZXN0OiBJTmF0aXZlT3BlbkZpbGVSZXF1ZXN0KSA9PiB7IHRoaXMuX29uT3BlbkZpbGVSZXF1ZXN0KHJlcXVlc3QpOyB9KTtcblx0XHR0aGlzLl9yZWdpc3RlcihuYXRpdmVIb3N0U2VydmljZS5vbkRpZFJlc3VtZU9TKCgpID0+IHRoaXMuX29uT3NSZXN1bWUoKSkpO1xuXG5cdFx0dGhpcy5fdGVybWluYWxTZXJ2aWNlLnNldE5hdGl2ZURlbGVnYXRlKHtcblx0XHRcdGdldFdpbmRvd0NvdW50OiAoKSA9PiBuYXRpdmVIb3N0U2VydmljZS5nZXRXaW5kb3dDb3VudCgpXG5cdFx0fSk7XG5cblx0XHRjb25zdCBjb25uZWN0aW9uID0gcmVtb3RlQWdlbnRTZXJ2aWNlLmdldENvbm5lY3Rpb24oKTtcblx0XHRpZiAoY29ubmVjdGlvbiAmJiBjb25uZWN0aW9uLnJlbW90ZUF1dGhvcml0eSkge1xuXHRcdFx0cmVnaXN0ZXJSZW1vdGVDb250cmlidXRpb25zKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfb25Pc1Jlc3VtZSgpOiB2b2lkIHtcblx0XHRmb3IgKGNvbnN0IGluc3RhbmNlIG9mIHRoaXMuX3Rlcm1pbmFsU2VydmljZS5pbnN0YW5jZXMpIHtcblx0XHRcdGluc3RhbmNlLnh0ZXJtPy5mb3JjZVJlZHJhdygpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX29uT3BlbkZpbGVSZXF1ZXN0KHJlcXVlc3Q6IElOYXRpdmVPcGVuRmlsZVJlcXVlc3QpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHQvLyBpZiB0aGUgcmVxdWVzdCB0byBvcGVuIGZpbGVzIGlzIGNvbWluZyBpbiBmcm9tIHRoZSBpbnRlZ3JhdGVkIHRlcm1pbmFsIChpZGVudGlmaWVkIHRob3VnaFxuXHRcdC8vIHRoZSB0ZXJtUHJvZ3JhbSB2YXJpYWJsZSkgYW5kIHdlIGFyZSBpbnN0cnVjdGVkIHRvIHdhaXQgZm9yIGVkaXRvcnMgY2xvc2UsIHdhaXQgZm9yIHRoZVxuXHRcdC8vIG1hcmtlciBmaWxlIHRvIGdldCBkZWxldGVkIGFuZCB0aGVuIGZvY3VzIGJhY2sgdG8gdGhlIGludGVncmF0ZWQgdGVybWluYWwuXG5cdFx0aWYgKHJlcXVlc3QudGVybVByb2dyYW0gPT09ICd2c2NvZGUnICYmIHJlcXVlc3QuZmlsZXNUb1dhaXQpIHtcblx0XHRcdGNvbnN0IHdhaXRNYXJrZXJGaWxlVXJpID0gVVJJLnJldml2ZShyZXF1ZXN0LmZpbGVzVG9XYWl0LndhaXRNYXJrZXJGaWxlVXJpKTtcblx0XHRcdGF3YWl0IHRoaXMuX3doZW5GaWxlRGVsZXRlZCh3YWl0TWFya2VyRmlsZVVyaSk7XG5cblx0XHRcdC8vIEZvY3VzIGFjdGl2ZSB0ZXJtaW5hbFxuXHRcdFx0dGhpcy5fdGVybWluYWxTZXJ2aWNlLmFjdGl2ZUluc3RhbmNlPy5mb2N1cygpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3doZW5GaWxlRGVsZXRlZChwYXRoOiBVUkkpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHQvLyBDb21wbGV0ZSB3aGVuIHdhaXQgbWFya2VyIGZpbGUgaXMgZGVsZXRlZFxuXHRcdHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHtcblx0XHRcdGxldCBydW5uaW5nID0gZmFsc2U7XG5cdFx0XHRjb25zdCBpbnRlcnZhbCA9IGRpc3Bvc2FibGVXaW5kb3dJbnRlcnZhbChnZXRBY3RpdmVXaW5kb3coKSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRpZiAoIXJ1bm5pbmcpIHtcblx0XHRcdFx0XHRydW5uaW5nID0gdHJ1ZTtcblx0XHRcdFx0XHRjb25zdCBleGlzdHMgPSBhd2FpdCB0aGlzLl9maWxlU2VydmljZS5leGlzdHMocGF0aCk7XG5cdFx0XHRcdFx0cnVubmluZyA9IGZhbHNlO1xuXG5cdFx0XHRcdFx0aWYgKCFleGlzdHMpIHtcblx0XHRcdFx0XHRcdGludGVydmFsLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRcdHJlc29sdmUodW5kZWZpbmVkKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0sIDEwMDApO1xuXHRcdH0pO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsbUJBQW1CO0FBRTVCLFNBQVMsV0FBVztBQUNwQixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLG1DQUFtQztBQUM1QyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLHdCQUF3QjtBQUVqQyxTQUFTLDBCQUEwQix1QkFBdUI7QUFFbkQsSUFBTSw2QkFBTixjQUF5QyxXQUE2QztBQUFBLEVBRzVGLFlBQ2dDLGNBQ0ksa0JBQ2Qsb0JBQ0QsbUJBQ25CO0FBQ0QsVUFBTTtBQUx5QjtBQUNJO0FBTW5DLGdCQUFZLEdBQUcsb0JBQW9CLENBQUMsR0FBWSxZQUFvQztBQUFFLFdBQUssbUJBQW1CLE9BQU87QUFBQSxJQUFHLENBQUM7QUFDekgsU0FBSyxVQUFVLGtCQUFrQixjQUFjLE1BQU0sS0FBSyxZQUFZLENBQUMsQ0FBQztBQUV4RSxTQUFLLGlCQUFpQixrQkFBa0I7QUFBQSxNQUN2QyxnQkFBZ0IsTUFBTSxrQkFBa0IsZUFBZTtBQUFBLElBQ3hELENBQUM7QUFFRCxVQUFNLGFBQWEsbUJBQW1CLGNBQWM7QUFDcEQsUUFBSSxjQUFjLFdBQVcsaUJBQWlCO0FBQzdDLGtDQUE0QjtBQUFBLElBQzdCO0FBQUEsRUFDRDtBQUFBLEVBRVEsY0FBb0I7QUFDM0IsZUFBVyxZQUFZLEtBQUssaUJBQWlCLFdBQVc7QUFDdkQsZUFBUyxPQUFPLFlBQVk7QUFBQSxJQUM3QjtBQUFBLEVBQ0Q7QUFBQSxFQUVBLE1BQWMsbUJBQW1CLFNBQWdEO0FBSWhGLFFBQUksUUFBUSxnQkFBZ0IsWUFBWSxRQUFRLGFBQWE7QUFDNUQsWUFBTSxvQkFBb0IsSUFBSSxPQUFPLFFBQVEsWUFBWSxpQkFBaUI7QUFDMUUsWUFBTSxLQUFLLGlCQUFpQixpQkFBaUI7QUFHN0MsV0FBSyxpQkFBaUIsZ0JBQWdCLE1BQU07QUFBQSxJQUM3QztBQUFBLEVBQ0Q7QUFBQSxFQUVRLGlCQUFpQixNQUEwQjtBQUVsRCxXQUFPLElBQUksUUFBYyxhQUFXO0FBQ25DLFVBQUksVUFBVTtBQUNkLFlBQU0sV0FBVyx5QkFBeUIsZ0JBQWdCLEdBQUcsWUFBWTtBQUN4RSxZQUFJLENBQUMsU0FBUztBQUNiLG9CQUFVO0FBQ1YsZ0JBQU0sU0FBUyxNQUFNLEtBQUssYUFBYSxPQUFPLElBQUk7QUFDbEQsb0JBQVU7QUFFVixjQUFJLENBQUMsUUFBUTtBQUNaLHFCQUFTLFFBQVE7QUFDakIsb0JBQVEsTUFBUztBQUFBLFVBQ2xCO0FBQUEsUUFDRDtBQUFBLE1BQ0QsR0FBRyxHQUFJO0FBQUEsSUFDUixDQUFDO0FBQUEsRUFDRjtBQUNEO0FBN0RhLDZCQUFOO0FBQUEsRUFJSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBUFU7IiwKICAibmFtZXMiOiBbXQp9Cg==
