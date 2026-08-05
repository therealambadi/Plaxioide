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
import { BrowserWindow, contentTracing, screen } from "electron";
import { randomPath } from "../../../base/common/extpath.js";
import { DisposableStore } from "../../../base/common/lifecycle.js";
import { FileAccess } from "../../../base/common/network.js";
import { isMacintosh } from "../../../base/common/platform.js";
import { listProcesses } from "../../../base/node/ps.js";
import { validatedIpcMain } from "../../../base/parts/ipc/electron-main/ipcMain.js";
import { getNLSLanguage, getNLSMessages, localize } from "../../../nls.js";
import { IDiagnosticsService, isRemoteDiagnosticError } from "../../diagnostics/common/diagnostics.js";
import { IDiagnosticsMainService } from "../../diagnostics/electron-main/diagnosticsMainService.js";
import { IDialogMainService } from "../../dialogs/electron-main/dialogMainService.js";
import { IEnvironmentMainService } from "../../environment/electron-main/environmentMainService.js";
import { ICSSDevelopmentService } from "../../cssDev/node/cssDevService.js";
import { ILogService } from "../../log/common/log.js";
import { INativeHostMainService } from "../../native/electron-main/nativeHostMainService.js";
import product from "../../product/common/product.js";
import { IProductService } from "../../product/common/productService.js";
import { IProtocolMainService } from "../../protocol/electron-main/protocol.js";
import { IStateService } from "../../state/node/state.js";
import { UtilityProcess } from "../../utilityProcess/electron-main/utilityProcess.js";
import { zoomLevelToZoomFactor } from "../../window/common/window.js";
const processExplorerWindowState = "issue.processExplorerWindowState";
let ProcessMainService = class {
  constructor(userEnv, environmentMainService, logService, diagnosticsService, diagnosticsMainService, dialogMainService, nativeHostMainService, protocolMainService, productService, stateService, cssDevelopmentService) {
    this.userEnv = userEnv;
    this.environmentMainService = environmentMainService;
    this.logService = logService;
    this.diagnosticsService = diagnosticsService;
    this.diagnosticsMainService = diagnosticsMainService;
    this.dialogMainService = dialogMainService;
    this.nativeHostMainService = nativeHostMainService;
    this.protocolMainService = protocolMainService;
    this.productService = productService;
    this.stateService = stateService;
    this.cssDevelopmentService = cssDevelopmentService;
    this.processExplorerWindow = null;
    this.processExplorerParentWindow = null;
    this.registerListeners();
  }
  //#region Register Listeners
  registerListeners() {
    validatedIpcMain.on("vscode:listProcesses", async (event) => {
      const processes = [];
      try {
        processes.push({ name: localize("local", "Local"), rootProcess: await listProcesses(process.pid) });
        const remoteDiagnostics = await this.diagnosticsMainService.getRemoteDiagnostics({ includeProcesses: true });
        remoteDiagnostics.forEach((data) => {
          if (isRemoteDiagnosticError(data)) {
            processes.push({
              name: data.hostName,
              rootProcess: data
            });
          } else {
            if (data.processes) {
              processes.push({
                name: data.hostName,
                rootProcess: data.processes
              });
            }
          }
        });
      } catch (e) {
        this.logService.error(`Listing processes failed: ${e}`);
      }
      this.safeSend(event, "vscode:listProcessesResponse", processes);
    });
    validatedIpcMain.on("vscode:workbenchCommand", (_, commandInfo) => {
      const { id, from, args } = commandInfo;
      let parentWindow;
      switch (from) {
        case "processExplorer":
          parentWindow = this.processExplorerParentWindow;
          break;
        default:
          throw new Error(`Unexpected command source: ${from}`);
      }
      parentWindow?.webContents.send("vscode:runAction", { id, from, args });
    });
    validatedIpcMain.on("vscode:closeProcessExplorer", (event) => {
      this.processExplorerWindow?.close();
    });
    validatedIpcMain.on("vscode:pidToNameRequest", async (event) => {
      const mainProcessInfo = await this.diagnosticsMainService.getMainDiagnostics();
      const pidToNames = [];
      for (const window of mainProcessInfo.windows) {
        pidToNames.push([window.pid, `window [${window.id}] (${window.title})`]);
      }
      for (const { pid, name } of UtilityProcess.getAll()) {
        pidToNames.push([pid, name]);
      }
      this.safeSend(event, "vscode:pidToNameResponse", pidToNames);
    });
  }
  async openProcessExplorer(data) {
    if (!this.processExplorerWindow) {
      this.processExplorerParentWindow = BrowserWindow.getFocusedWindow();
      if (this.processExplorerParentWindow) {
        const processExplorerDisposables = new DisposableStore();
        const processExplorerWindowConfigUrl = processExplorerDisposables.add(this.protocolMainService.createIPCObjectUrl());
        const savedPosition = this.stateService.getItem(processExplorerWindowState, void 0);
        const position = isStrictWindowState(savedPosition) ? savedPosition : this.getWindowPosition(this.processExplorerParentWindow, 800, 500);
        this.processExplorerWindow = this.createBrowserWindow(position, processExplorerWindowConfigUrl, {
          backgroundColor: data.styles.backgroundColor,
          title: localize("processExplorer", "Process Explorer"),
          zoomLevel: data.zoomLevel,
          alwaysOnTop: true
        }, "process-explorer");
        processExplorerWindowConfigUrl.update({
          appRoot: this.environmentMainService.appRoot,
          windowId: this.processExplorerWindow.id,
          userEnv: this.userEnv,
          data,
          product,
          nls: {
            messages: getNLSMessages(),
            language: getNLSLanguage()
          },
          cssModules: this.cssDevelopmentService.isEnabled ? await this.cssDevelopmentService.getCssModules() : void 0
        });
        this.processExplorerWindow.loadURL(
          FileAccess.asBrowserUri(`vs/code/electron-sandbox/processExplorer/processExplorer${this.environmentMainService.isBuilt ? "" : "-dev"}.html`).toString(true)
        );
        this.processExplorerWindow.on("close", () => {
          this.processExplorerWindow = null;
          processExplorerDisposables.dispose();
        });
        this.processExplorerParentWindow.on("close", () => {
          if (this.processExplorerWindow) {
            this.processExplorerWindow.close();
            this.processExplorerWindow = null;
            processExplorerDisposables.dispose();
          }
        });
        const storeState = () => {
          if (!this.processExplorerWindow) {
            return;
          }
          const size = this.processExplorerWindow.getSize();
          const position2 = this.processExplorerWindow.getPosition();
          if (!size || !position2) {
            return;
          }
          const state = {
            width: size[0],
            height: size[1],
            x: position2[0],
            y: position2[1]
          };
          this.stateService.setItem(processExplorerWindowState, state);
        };
        this.processExplorerWindow.on("moved", storeState);
        this.processExplorerWindow.on("resized", storeState);
      }
    }
    if (this.processExplorerWindow) {
      this.focusWindow(this.processExplorerWindow);
    }
  }
  focusWindow(window) {
    if (window.isMinimized()) {
      window.restore();
    }
    window.focus();
  }
  getWindowPosition(parentWindow, defaultWidth, defaultHeight) {
    let displayToUse;
    const displays = screen.getAllDisplays();
    if (displays.length === 1) {
      displayToUse = displays[0];
    } else {
      if (isMacintosh) {
        const cursorPoint = screen.getCursorScreenPoint();
        displayToUse = screen.getDisplayNearestPoint(cursorPoint);
      }
      if (!displayToUse && parentWindow) {
        displayToUse = screen.getDisplayMatching(parentWindow.getBounds());
      }
      if (!displayToUse) {
        displayToUse = screen.getPrimaryDisplay() || displays[0];
      }
    }
    const displayBounds = displayToUse.bounds;
    const state = {
      width: defaultWidth,
      height: defaultHeight,
      x: displayBounds.x + displayBounds.width / 2 - defaultWidth / 2,
      y: displayBounds.y + displayBounds.height / 2 - defaultHeight / 2
    };
    if (displayBounds.width > 0 && displayBounds.height > 0) {
      if (state.x < displayBounds.x) {
        state.x = displayBounds.x;
      }
      if (state.y < displayBounds.y) {
        state.y = displayBounds.y;
      }
      if (state.x > displayBounds.x + displayBounds.width) {
        state.x = displayBounds.x;
      }
      if (state.y > displayBounds.y + displayBounds.height) {
        state.y = displayBounds.y;
      }
      if (state.width > displayBounds.width) {
        state.width = displayBounds.width;
      }
      if (state.height > displayBounds.height) {
        state.height = displayBounds.height;
      }
    }
    return state;
  }
  async stopTracing() {
    if (!this.environmentMainService.args.trace) {
      return;
    }
    const path = await contentTracing.stopRecording(`${randomPath(this.environmentMainService.userHome.fsPath, this.productService.applicationName)}.trace.txt`);
    await this.dialogMainService.showMessageBox({
      type: "info",
      message: localize("trace.message", "Successfully created the trace file"),
      detail: localize("trace.detail", "Please create an issue and manually attach the following file:\n{0}", path),
      buttons: [localize({ key: "trace.ok", comment: ["&& denotes a mnemonic"] }, "&&OK")]
    }, BrowserWindow.getFocusedWindow() ?? void 0);
    this.nativeHostMainService.showItemInFolder(void 0, path);
  }
  async getSystemStatus() {
    const [info, remoteData] = await Promise.all([this.diagnosticsMainService.getMainDiagnostics(), this.diagnosticsMainService.getRemoteDiagnostics({ includeProcesses: false, includeWorkspaceMetadata: false })]);
    return this.diagnosticsService.getDiagnostics(info, remoteData);
  }
  async $getSystemInfo() {
    const [info, remoteData] = await Promise.all([this.diagnosticsMainService.getMainDiagnostics(), this.diagnosticsMainService.getRemoteDiagnostics({ includeProcesses: false, includeWorkspaceMetadata: false })]);
    const msg = await this.diagnosticsService.getSystemInfo(info, remoteData);
    return msg;
  }
  async $getPerformanceInfo() {
    try {
      const [info, remoteData] = await Promise.all([this.diagnosticsMainService.getMainDiagnostics(), this.diagnosticsMainService.getRemoteDiagnostics({ includeProcesses: true, includeWorkspaceMetadata: true })]);
      return await this.diagnosticsService.getPerformanceInfo(info, remoteData);
    } catch (error) {
      this.logService.warn("issueService#getPerformanceInfo ", error.message);
      throw error;
    }
  }
  createBrowserWindow(position, ipcObjectUrl, options, windowKind) {
    const browserWindowOptions = {
      fullscreen: false,
      skipTaskbar: false,
      resizable: true,
      width: position.width,
      height: position.height,
      minWidth: 300,
      minHeight: 200,
      x: position.x,
      y: position.y,
      title: options.title,
      backgroundColor: options.backgroundColor || ProcessMainService.DEFAULT_BACKGROUND_COLOR,
      webPreferences: {
        preload: FileAccess.asFileUri("vs/base/parts/sandbox/electron-sandbox/preload.js").fsPath,
        additionalArguments: [`--vscode-window-config=${ipcObjectUrl.resource.toString()}`],
        v8CacheOptions: this.environmentMainService.useCodeCache ? "bypassHeatCheck" : "none",
        enableWebSQL: false,
        spellcheck: false,
        zoomFactor: zoomLevelToZoomFactor(options.zoomLevel),
        sandbox: true
      },
      alwaysOnTop: options.alwaysOnTop,
      experimentalDarkMode: true
    };
    const window = new BrowserWindow(browserWindowOptions);
    window.setMenuBarVisibility(false);
    return window;
  }
  safeSend(event, channel, ...args) {
    if (!event.sender.isDestroyed()) {
      event.sender.send(channel, ...args);
    }
  }
  async closeProcessExplorer() {
    this.processExplorerWindow?.close();
  }
};
ProcessMainService.DEFAULT_BACKGROUND_COLOR = "#1E1E1E";
ProcessMainService = __decorateClass([
  __decorateParam(1, IEnvironmentMainService),
  __decorateParam(2, ILogService),
  __decorateParam(3, IDiagnosticsService),
  __decorateParam(4, IDiagnosticsMainService),
  __decorateParam(5, IDialogMainService),
  __decorateParam(6, INativeHostMainService),
  __decorateParam(7, IProtocolMainService),
  __decorateParam(8, IProductService),
  __decorateParam(9, IStateService),
  __decorateParam(10, ICSSDevelopmentService)
], ProcessMainService);
function isStrictWindowState(obj) {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  return "x" in obj && "y" in obj && "width" in obj && "height" in obj;
}
export {
  ProcessMainService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9wcm9jZXNzL2VsZWN0cm9uLW1haW4vcHJvY2Vzc01haW5TZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQnJvd3NlcldpbmRvdywgQnJvd3NlcldpbmRvd0NvbnN0cnVjdG9yT3B0aW9ucywgY29udGVudFRyYWNpbmcsIERpc3BsYXksIElwY01haW5FdmVudCwgc2NyZWVuIH0gZnJvbSAnZWxlY3Ryb24nO1xuaW1wb3J0IHsgcmFuZG9tUGF0aCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V4dHBhdGguanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IEZpbGVBY2Nlc3MgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IElQcm9jZXNzRW52aXJvbm1lbnQsIGlzTWFjaW50b3NoIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgbGlzdFByb2Nlc3NlcyB9IGZyb20gJy4uLy4uLy4uL2Jhc2Uvbm9kZS9wcy5qcyc7XG5pbXBvcnQgeyB2YWxpZGF0ZWRJcGNNYWluIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9wYXJ0cy9pcGMvZWxlY3Ryb24tbWFpbi9pcGNNYWluLmpzJztcbmltcG9ydCB7IGdldE5MU0xhbmd1YWdlLCBnZXROTFNNZXNzYWdlcywgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSURpYWdub3N0aWNzU2VydmljZSwgaXNSZW1vdGVEaWFnbm9zdGljRXJyb3IsIFBlcmZvcm1hbmNlSW5mbywgU3lzdGVtSW5mbyB9IGZyb20gJy4uLy4uL2RpYWdub3N0aWNzL2NvbW1vbi9kaWFnbm9zdGljcy5qcyc7XG5pbXBvcnQgeyBJRGlhZ25vc3RpY3NNYWluU2VydmljZSB9IGZyb20gJy4uLy4uL2RpYWdub3N0aWNzL2VsZWN0cm9uLW1haW4vZGlhZ25vc3RpY3NNYWluU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nTWFpblNlcnZpY2UgfSBmcm9tICcuLi8uLi9kaWFsb2dzL2VsZWN0cm9uLW1haW4vZGlhbG9nTWFpblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVudmlyb25tZW50TWFpblNlcnZpY2UgfSBmcm9tICcuLi8uLi9lbnZpcm9ubWVudC9lbGVjdHJvbi1tYWluL2Vudmlyb25tZW50TWFpblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNTU0RldmVsb3BtZW50U2VydmljZSB9IGZyb20gJy4uLy4uL2Nzc0Rldi9ub2RlL2Nzc0RldlNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVByb2Nlc3NNYWluU2VydmljZSwgUHJvY2Vzc0V4cGxvcmVyRGF0YSwgUHJvY2Vzc0V4cGxvcmVyV2luZG93Q29uZmlndXJhdGlvbiB9IGZyb20gJy4uL2NvbW1vbi9wcm9jZXNzLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSU5hdGl2ZUhvc3RNYWluU2VydmljZSB9IGZyb20gJy4uLy4uL25hdGl2ZS9lbGVjdHJvbi1tYWluL25hdGl2ZUhvc3RNYWluU2VydmljZS5qcyc7XG5pbXBvcnQgcHJvZHVjdCBmcm9tICcuLi8uLi9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0LmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElJUENPYmplY3RVcmwsIElQcm90b2NvbE1haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcHJvdG9jb2wvZWxlY3Ryb24tbWFpbi9wcm90b2NvbC5qcyc7XG5pbXBvcnQgeyBJU3RhdGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc3RhdGUvbm9kZS9zdGF0ZS5qcyc7XG5pbXBvcnQgeyBVdGlsaXR5UHJvY2VzcyB9IGZyb20gJy4uLy4uL3V0aWxpdHlQcm9jZXNzL2VsZWN0cm9uLW1haW4vdXRpbGl0eVByb2Nlc3MuanMnO1xuaW1wb3J0IHsgem9vbUxldmVsVG9ab29tRmFjdG9yIH0gZnJvbSAnLi4vLi4vd2luZG93L2NvbW1vbi93aW5kb3cuanMnO1xuaW1wb3J0IHsgSVdpbmRvd1N0YXRlIH0gZnJvbSAnLi4vLi4vd2luZG93L2VsZWN0cm9uLW1haW4vd2luZG93LmpzJztcblxuY29uc3QgcHJvY2Vzc0V4cGxvcmVyV2luZG93U3RhdGUgPSAnaXNzdWUucHJvY2Vzc0V4cGxvcmVyV2luZG93U3RhdGUnO1xuXG5pbnRlcmZhY2UgSUJyb3dzZXJXaW5kb3dPcHRpb25zIHtcblx0YmFja2dyb3VuZENvbG9yOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHRpdGxlOiBzdHJpbmc7XG5cdHpvb21MZXZlbDogbnVtYmVyO1xuXHRhbHdheXNPblRvcDogYm9vbGVhbjtcbn1cblxudHlwZSBJU3RyaWN0V2luZG93U3RhdGUgPSBSZXF1aXJlZDxQaWNrPElXaW5kb3dTdGF0ZSwgJ3gnIHwgJ3knIHwgJ3dpZHRoJyB8ICdoZWlnaHQnPj47XG5cbmV4cG9ydCBjbGFzcyBQcm9jZXNzTWFpblNlcnZpY2UgaW1wbGVtZW50cyBJUHJvY2Vzc01haW5TZXJ2aWNlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBERUZBVUxUX0JBQ0tHUk9VTkRfQ09MT1IgPSAnIzFFMUUxRSc7XG5cblx0cHJpdmF0ZSBwcm9jZXNzRXhwbG9yZXJXaW5kb3c6IEJyb3dzZXJXaW5kb3cgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBwcm9jZXNzRXhwbG9yZXJQYXJlbnRXaW5kb3c6IEJyb3dzZXJXaW5kb3cgfCBudWxsID0gbnVsbDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHVzZXJFbnY6IElQcm9jZXNzRW52aXJvbm1lbnQsXG5cdFx0QElFbnZpcm9ubWVudE1haW5TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZW52aXJvbm1lbnRNYWluU2VydmljZTogSUVudmlyb25tZW50TWFpblNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElEaWFnbm9zdGljc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkaWFnbm9zdGljc1NlcnZpY2U6IElEaWFnbm9zdGljc1NlcnZpY2UsXG5cdFx0QElEaWFnbm9zdGljc01haW5TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZGlhZ25vc3RpY3NNYWluU2VydmljZTogSURpYWdub3N0aWNzTWFpblNlcnZpY2UsXG5cdFx0QElEaWFsb2dNYWluU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGRpYWxvZ01haW5TZXJ2aWNlOiBJRGlhbG9nTWFpblNlcnZpY2UsXG5cdFx0QElOYXRpdmVIb3N0TWFpblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBuYXRpdmVIb3N0TWFpblNlcnZpY2U6IElOYXRpdmVIb3N0TWFpblNlcnZpY2UsXG5cdFx0QElQcm90b2NvbE1haW5TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcHJvdG9jb2xNYWluU2VydmljZTogSVByb3RvY29sTWFpblNlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElTdGF0ZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdGF0ZVNlcnZpY2U6IElTdGF0ZVNlcnZpY2UsXG5cdFx0QElDU1NEZXZlbG9wbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjc3NEZXZlbG9wbWVudFNlcnZpY2U6IElDU1NEZXZlbG9wbWVudFNlcnZpY2Vcblx0KSB7XG5cdFx0dGhpcy5yZWdpc3Rlckxpc3RlbmVycygpO1xuXHR9XG5cblx0Ly8jcmVnaW9uIFJlZ2lzdGVyIExpc3RlbmVyc1xuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cdFx0dmFsaWRhdGVkSXBjTWFpbi5vbigndnNjb2RlOmxpc3RQcm9jZXNzZXMnLCBhc3luYyBldmVudCA9PiB7XG5cdFx0XHRjb25zdCBwcm9jZXNzZXMgPSBbXTtcblxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0cHJvY2Vzc2VzLnB1c2goeyBuYW1lOiBsb2NhbGl6ZSgnbG9jYWwnLCBcIkxvY2FsXCIpLCByb290UHJvY2VzczogYXdhaXQgbGlzdFByb2Nlc3Nlcyhwcm9jZXNzLnBpZCkgfSk7XG5cblx0XHRcdFx0Y29uc3QgcmVtb3RlRGlhZ25vc3RpY3MgPSBhd2FpdCB0aGlzLmRpYWdub3N0aWNzTWFpblNlcnZpY2UuZ2V0UmVtb3RlRGlhZ25vc3RpY3MoeyBpbmNsdWRlUHJvY2Vzc2VzOiB0cnVlIH0pO1xuXHRcdFx0XHRyZW1vdGVEaWFnbm9zdGljcy5mb3JFYWNoKGRhdGEgPT4ge1xuXHRcdFx0XHRcdGlmIChpc1JlbW90ZURpYWdub3N0aWNFcnJvcihkYXRhKSkge1xuXHRcdFx0XHRcdFx0cHJvY2Vzc2VzLnB1c2goe1xuXHRcdFx0XHRcdFx0XHRuYW1lOiBkYXRhLmhvc3ROYW1lLFxuXHRcdFx0XHRcdFx0XHRyb290UHJvY2VzczogZGF0YVxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGlmIChkYXRhLnByb2Nlc3Nlcykge1xuXHRcdFx0XHRcdFx0XHRwcm9jZXNzZXMucHVzaCh7XG5cdFx0XHRcdFx0XHRcdFx0bmFtZTogZGF0YS5ob3N0TmFtZSxcblx0XHRcdFx0XHRcdFx0XHRyb290UHJvY2VzczogZGF0YS5wcm9jZXNzZXNcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGBMaXN0aW5nIHByb2Nlc3NlcyBmYWlsZWQ6ICR7ZX1gKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5zYWZlU2VuZChldmVudCwgJ3ZzY29kZTpsaXN0UHJvY2Vzc2VzUmVzcG9uc2UnLCBwcm9jZXNzZXMpO1xuXHRcdH0pO1xuXG5cdFx0dmFsaWRhdGVkSXBjTWFpbi5vbigndnNjb2RlOndvcmtiZW5jaENvbW1hbmQnLCAoXzogdW5rbm93biwgY29tbWFuZEluZm86IHsgaWQ6IGFueTsgZnJvbTogYW55OyBhcmdzOiBhbnkgfSkgPT4ge1xuXHRcdFx0Y29uc3QgeyBpZCwgZnJvbSwgYXJncyB9ID0gY29tbWFuZEluZm87XG5cblx0XHRcdGxldCBwYXJlbnRXaW5kb3c6IEJyb3dzZXJXaW5kb3cgfCBudWxsO1xuXHRcdFx0c3dpdGNoIChmcm9tKSB7XG5cdFx0XHRcdGNhc2UgJ3Byb2Nlc3NFeHBsb3Jlcic6XG5cdFx0XHRcdFx0cGFyZW50V2luZG93ID0gdGhpcy5wcm9jZXNzRXhwbG9yZXJQYXJlbnRXaW5kb3c7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0Ly8gVGhlIGlzc3VlIHJlcG9ydGVyIGRvZXMgbm90IHVzZSB0aGlzIGFueW1vcmUuXG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIGNvbW1hbmQgc291cmNlOiAke2Zyb219YCk7XG5cdFx0XHR9XG5cblx0XHRcdHBhcmVudFdpbmRvdz8ud2ViQ29udGVudHMuc2VuZCgndnNjb2RlOnJ1bkFjdGlvbicsIHsgaWQsIGZyb20sIGFyZ3MgfSk7XG5cdFx0fSk7XG5cblx0XHR2YWxpZGF0ZWRJcGNNYWluLm9uKCd2c2NvZGU6Y2xvc2VQcm9jZXNzRXhwbG9yZXInLCBldmVudCA9PiB7XG5cdFx0XHR0aGlzLnByb2Nlc3NFeHBsb3JlcldpbmRvdz8uY2xvc2UoKTtcblx0XHR9KTtcblxuXHRcdHZhbGlkYXRlZElwY01haW4ub24oJ3ZzY29kZTpwaWRUb05hbWVSZXF1ZXN0JywgYXN5bmMgZXZlbnQgPT4ge1xuXHRcdFx0Y29uc3QgbWFpblByb2Nlc3NJbmZvID0gYXdhaXQgdGhpcy5kaWFnbm9zdGljc01haW5TZXJ2aWNlLmdldE1haW5EaWFnbm9zdGljcygpO1xuXG5cdFx0XHRjb25zdCBwaWRUb05hbWVzOiBbbnVtYmVyLCBzdHJpbmddW10gPSBbXTtcblx0XHRcdGZvciAoY29uc3Qgd2luZG93IG9mIG1haW5Qcm9jZXNzSW5mby53aW5kb3dzKSB7XG5cdFx0XHRcdHBpZFRvTmFtZXMucHVzaChbd2luZG93LnBpZCwgYHdpbmRvdyBbJHt3aW5kb3cuaWR9XSAoJHt3aW5kb3cudGl0bGV9KWBdKTtcblx0XHRcdH1cblxuXHRcdFx0Zm9yIChjb25zdCB7IHBpZCwgbmFtZSB9IG9mIFV0aWxpdHlQcm9jZXNzLmdldEFsbCgpKSB7XG5cdFx0XHRcdHBpZFRvTmFtZXMucHVzaChbcGlkLCBuYW1lXSk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuc2FmZVNlbmQoZXZlbnQsICd2c2NvZGU6cGlkVG9OYW1lUmVzcG9uc2UnLCBwaWRUb05hbWVzKTtcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIG9wZW5Qcm9jZXNzRXhwbG9yZXIoZGF0YTogUHJvY2Vzc0V4cGxvcmVyRGF0YSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5wcm9jZXNzRXhwbG9yZXJXaW5kb3cpIHtcblx0XHRcdHRoaXMucHJvY2Vzc0V4cGxvcmVyUGFyZW50V2luZG93ID0gQnJvd3NlcldpbmRvdy5nZXRGb2N1c2VkV2luZG93KCk7XG5cdFx0XHRpZiAodGhpcy5wcm9jZXNzRXhwbG9yZXJQYXJlbnRXaW5kb3cpIHtcblx0XHRcdFx0Y29uc3QgcHJvY2Vzc0V4cGxvcmVyRGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRcdFx0Y29uc3QgcHJvY2Vzc0V4cGxvcmVyV2luZG93Q29uZmlnVXJsID0gcHJvY2Vzc0V4cGxvcmVyRGlzcG9zYWJsZXMuYWRkKHRoaXMucHJvdG9jb2xNYWluU2VydmljZS5jcmVhdGVJUENPYmplY3RVcmw8UHJvY2Vzc0V4cGxvcmVyV2luZG93Q29uZmlndXJhdGlvbj4oKSk7XG5cblx0XHRcdFx0Y29uc3Qgc2F2ZWRQb3NpdGlvbiA9IHRoaXMuc3RhdGVTZXJ2aWNlLmdldEl0ZW08SVdpbmRvd1N0YXRlPihwcm9jZXNzRXhwbG9yZXJXaW5kb3dTdGF0ZSwgdW5kZWZpbmVkKTtcblx0XHRcdFx0Y29uc3QgcG9zaXRpb24gPSBpc1N0cmljdFdpbmRvd1N0YXRlKHNhdmVkUG9zaXRpb24pID8gc2F2ZWRQb3NpdGlvbiA6IHRoaXMuZ2V0V2luZG93UG9zaXRpb24odGhpcy5wcm9jZXNzRXhwbG9yZXJQYXJlbnRXaW5kb3csIDgwMCwgNTAwKTtcblxuXHRcdFx0XHR0aGlzLnByb2Nlc3NFeHBsb3JlcldpbmRvdyA9IHRoaXMuY3JlYXRlQnJvd3NlcldpbmRvdyhwb3NpdGlvbiwgcHJvY2Vzc0V4cGxvcmVyV2luZG93Q29uZmlnVXJsLCB7XG5cdFx0XHRcdFx0YmFja2dyb3VuZENvbG9yOiBkYXRhLnN0eWxlcy5iYWNrZ3JvdW5kQ29sb3IsXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdwcm9jZXNzRXhwbG9yZXInLCBcIlByb2Nlc3MgRXhwbG9yZXJcIiksXG5cdFx0XHRcdFx0em9vbUxldmVsOiBkYXRhLnpvb21MZXZlbCxcblx0XHRcdFx0XHRhbHdheXNPblRvcDogdHJ1ZVxuXHRcdFx0XHR9LCAncHJvY2Vzcy1leHBsb3JlcicpO1xuXG5cdFx0XHRcdC8vIFN0b3JlIGludG8gY29uZmlnIG9iamVjdCBVUkxcblx0XHRcdFx0cHJvY2Vzc0V4cGxvcmVyV2luZG93Q29uZmlnVXJsLnVwZGF0ZSh7XG5cdFx0XHRcdFx0YXBwUm9vdDogdGhpcy5lbnZpcm9ubWVudE1haW5TZXJ2aWNlLmFwcFJvb3QsXG5cdFx0XHRcdFx0d2luZG93SWQ6IHRoaXMucHJvY2Vzc0V4cGxvcmVyV2luZG93LmlkLFxuXHRcdFx0XHRcdHVzZXJFbnY6IHRoaXMudXNlckVudixcblx0XHRcdFx0XHRkYXRhLFxuXHRcdFx0XHRcdHByb2R1Y3QsXG5cdFx0XHRcdFx0bmxzOiB7XG5cdFx0XHRcdFx0XHRtZXNzYWdlczogZ2V0TkxTTWVzc2FnZXMoKSxcblx0XHRcdFx0XHRcdGxhbmd1YWdlOiBnZXROTFNMYW5ndWFnZSgpXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRjc3NNb2R1bGVzOiB0aGlzLmNzc0RldmVsb3BtZW50U2VydmljZS5pc0VuYWJsZWQgPyBhd2FpdCB0aGlzLmNzc0RldmVsb3BtZW50U2VydmljZS5nZXRDc3NNb2R1bGVzKCkgOiB1bmRlZmluZWRcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0dGhpcy5wcm9jZXNzRXhwbG9yZXJXaW5kb3cubG9hZFVSTChcblx0XHRcdFx0XHRGaWxlQWNjZXNzLmFzQnJvd3NlclVyaShgdnMvY29kZS9lbGVjdHJvbi1zYW5kYm94L3Byb2Nlc3NFeHBsb3Jlci9wcm9jZXNzRXhwbG9yZXIke3RoaXMuZW52aXJvbm1lbnRNYWluU2VydmljZS5pc0J1aWx0ID8gJycgOiAnLWRldid9Lmh0bWxgKS50b1N0cmluZyh0cnVlKVxuXHRcdFx0XHQpO1xuXG5cdFx0XHRcdHRoaXMucHJvY2Vzc0V4cGxvcmVyV2luZG93Lm9uKCdjbG9zZScsICgpID0+IHtcblx0XHRcdFx0XHR0aGlzLnByb2Nlc3NFeHBsb3JlcldpbmRvdyA9IG51bGw7XG5cdFx0XHRcdFx0cHJvY2Vzc0V4cGxvcmVyRGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHR0aGlzLnByb2Nlc3NFeHBsb3JlclBhcmVudFdpbmRvdy5vbignY2xvc2UnLCAoKSA9PiB7XG5cdFx0XHRcdFx0aWYgKHRoaXMucHJvY2Vzc0V4cGxvcmVyV2luZG93KSB7XG5cdFx0XHRcdFx0XHR0aGlzLnByb2Nlc3NFeHBsb3JlcldpbmRvdy5jbG9zZSgpO1xuXHRcdFx0XHRcdFx0dGhpcy5wcm9jZXNzRXhwbG9yZXJXaW5kb3cgPSBudWxsO1xuXG5cdFx0XHRcdFx0XHRwcm9jZXNzRXhwbG9yZXJEaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRjb25zdCBzdG9yZVN0YXRlID0gKCkgPT4ge1xuXHRcdFx0XHRcdGlmICghdGhpcy5wcm9jZXNzRXhwbG9yZXJXaW5kb3cpIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29uc3Qgc2l6ZSA9IHRoaXMucHJvY2Vzc0V4cGxvcmVyV2luZG93LmdldFNpemUoKTtcblx0XHRcdFx0XHRjb25zdCBwb3NpdGlvbiA9IHRoaXMucHJvY2Vzc0V4cGxvcmVyV2luZG93LmdldFBvc2l0aW9uKCk7XG5cdFx0XHRcdFx0aWYgKCFzaXplIHx8ICFwb3NpdGlvbikge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb25zdCBzdGF0ZTogSVdpbmRvd1N0YXRlID0ge1xuXHRcdFx0XHRcdFx0d2lkdGg6IHNpemVbMF0sXG5cdFx0XHRcdFx0XHRoZWlnaHQ6IHNpemVbMV0sXG5cdFx0XHRcdFx0XHR4OiBwb3NpdGlvblswXSxcblx0XHRcdFx0XHRcdHk6IHBvc2l0aW9uWzFdXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR0aGlzLnN0YXRlU2VydmljZS5zZXRJdGVtKHByb2Nlc3NFeHBsb3JlcldpbmRvd1N0YXRlLCBzdGF0ZSk7XG5cdFx0XHRcdH07XG5cblx0XHRcdFx0dGhpcy5wcm9jZXNzRXhwbG9yZXJXaW5kb3cub24oJ21vdmVkJywgc3RvcmVTdGF0ZSk7XG5cdFx0XHRcdHRoaXMucHJvY2Vzc0V4cGxvcmVyV2luZG93Lm9uKCdyZXNpemVkJywgc3RvcmVTdGF0ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMucHJvY2Vzc0V4cGxvcmVyV2luZG93KSB7XG5cdFx0XHR0aGlzLmZvY3VzV2luZG93KHRoaXMucHJvY2Vzc0V4cGxvcmVyV2luZG93KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGZvY3VzV2luZG93KHdpbmRvdzogQnJvd3NlcldpbmRvdyk6IHZvaWQge1xuXHRcdGlmICh3aW5kb3cuaXNNaW5pbWl6ZWQoKSkge1xuXHRcdFx0d2luZG93LnJlc3RvcmUoKTtcblx0XHR9XG5cblx0XHR3aW5kb3cuZm9jdXMoKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0V2luZG93UG9zaXRpb24ocGFyZW50V2luZG93OiBCcm93c2VyV2luZG93LCBkZWZhdWx0V2lkdGg6IG51bWJlciwgZGVmYXVsdEhlaWdodDogbnVtYmVyKTogSVN0cmljdFdpbmRvd1N0YXRlIHtcblxuXHRcdC8vIFdlIHdhbnQgdGhlIG5ldyB3aW5kb3cgdG8gb3BlbiBvbiB0aGUgc2FtZSBkaXNwbGF5IHRoYXQgdGhlIHBhcmVudCBpcyBpblxuXHRcdGxldCBkaXNwbGF5VG9Vc2U6IERpc3BsYXkgfCB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgZGlzcGxheXMgPSBzY3JlZW4uZ2V0QWxsRGlzcGxheXMoKTtcblxuXHRcdC8vIFNpbmdsZSBEaXNwbGF5XG5cdFx0aWYgKGRpc3BsYXlzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0ZGlzcGxheVRvVXNlID0gZGlzcGxheXNbMF07XG5cdFx0fVxuXG5cdFx0Ly8gTXVsdGkgRGlzcGxheVxuXHRcdGVsc2Uge1xuXG5cdFx0XHQvLyBvbiBtYWMgdGhlcmUgaXMgMSBtZW51IHBlciB3aW5kb3cgc28gd2UgbmVlZCB0byB1c2UgdGhlIG1vbml0b3Igd2hlcmUgdGhlIGN1cnNvciBjdXJyZW50bHkgaXNcblx0XHRcdGlmIChpc01hY2ludG9zaCkge1xuXHRcdFx0XHRjb25zdCBjdXJzb3JQb2ludCA9IHNjcmVlbi5nZXRDdXJzb3JTY3JlZW5Qb2ludCgpO1xuXHRcdFx0XHRkaXNwbGF5VG9Vc2UgPSBzY3JlZW4uZ2V0RGlzcGxheU5lYXJlc3RQb2ludChjdXJzb3JQb2ludCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIGlmIHdlIGhhdmUgYSBsYXN0IGFjdGl2ZSB3aW5kb3csIHVzZSB0aGF0IGRpc3BsYXkgZm9yIHRoZSBuZXcgd2luZG93XG5cdFx0XHRpZiAoIWRpc3BsYXlUb1VzZSAmJiBwYXJlbnRXaW5kb3cpIHtcblx0XHRcdFx0ZGlzcGxheVRvVXNlID0gc2NyZWVuLmdldERpc3BsYXlNYXRjaGluZyhwYXJlbnRXaW5kb3cuZ2V0Qm91bmRzKCkpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBmYWxsYmFjayB0byBwcmltYXJ5IGRpc3BsYXkgb3IgZmlyc3QgZGlzcGxheVxuXHRcdFx0aWYgKCFkaXNwbGF5VG9Vc2UpIHtcblx0XHRcdFx0ZGlzcGxheVRvVXNlID0gc2NyZWVuLmdldFByaW1hcnlEaXNwbGF5KCkgfHwgZGlzcGxheXNbMF07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGlzcGxheUJvdW5kcyA9IGRpc3BsYXlUb1VzZS5ib3VuZHM7XG5cblx0XHRjb25zdCBzdGF0ZTogSVN0cmljdFdpbmRvd1N0YXRlID0ge1xuXHRcdFx0d2lkdGg6IGRlZmF1bHRXaWR0aCxcblx0XHRcdGhlaWdodDogZGVmYXVsdEhlaWdodCxcblx0XHRcdHg6IGRpc3BsYXlCb3VuZHMueCArIChkaXNwbGF5Qm91bmRzLndpZHRoIC8gMikgLSAoZGVmYXVsdFdpZHRoIC8gMiksXG5cdFx0XHR5OiBkaXNwbGF5Qm91bmRzLnkgKyAoZGlzcGxheUJvdW5kcy5oZWlnaHQgLyAyKSAtIChkZWZhdWx0SGVpZ2h0IC8gMilcblx0XHR9O1xuXG5cdFx0aWYgKGRpc3BsYXlCb3VuZHMud2lkdGggPiAwICYmIGRpc3BsYXlCb3VuZHMuaGVpZ2h0ID4gMCAvKiBMaW51eCBYMTEgc2Vzc2lvbnMgc29tZXRpbWVzIHJlcG9ydCB3cm9uZyBkaXNwbGF5IGJvdW5kcyAqLykge1xuXHRcdFx0aWYgKHN0YXRlLnggPCBkaXNwbGF5Qm91bmRzLngpIHtcblx0XHRcdFx0c3RhdGUueCA9IGRpc3BsYXlCb3VuZHMueDsgLy8gcHJldmVudCB3aW5kb3cgZnJvbSBmYWxsaW5nIG91dCBvZiB0aGUgc2NyZWVuIHRvIHRoZSBsZWZ0XG5cdFx0XHR9XG5cblx0XHRcdGlmIChzdGF0ZS55IDwgZGlzcGxheUJvdW5kcy55KSB7XG5cdFx0XHRcdHN0YXRlLnkgPSBkaXNwbGF5Qm91bmRzLnk7IC8vIHByZXZlbnQgd2luZG93IGZyb20gZmFsbGluZyBvdXQgb2YgdGhlIHNjcmVlbiB0byB0aGUgdG9wXG5cdFx0XHR9XG5cblx0XHRcdGlmIChzdGF0ZS54ID4gKGRpc3BsYXlCb3VuZHMueCArIGRpc3BsYXlCb3VuZHMud2lkdGgpKSB7XG5cdFx0XHRcdHN0YXRlLnggPSBkaXNwbGF5Qm91bmRzLng7IC8vIHByZXZlbnQgd2luZG93IGZyb20gZmFsbGluZyBvdXQgb2YgdGhlIHNjcmVlbiB0byB0aGUgcmlnaHRcblx0XHRcdH1cblxuXHRcdFx0aWYgKHN0YXRlLnkgPiAoZGlzcGxheUJvdW5kcy55ICsgZGlzcGxheUJvdW5kcy5oZWlnaHQpKSB7XG5cdFx0XHRcdHN0YXRlLnkgPSBkaXNwbGF5Qm91bmRzLnk7IC8vIHByZXZlbnQgd2luZG93IGZyb20gZmFsbGluZyBvdXQgb2YgdGhlIHNjcmVlbiB0byB0aGUgYm90dG9tXG5cdFx0XHR9XG5cblx0XHRcdGlmIChzdGF0ZS53aWR0aCA+IGRpc3BsYXlCb3VuZHMud2lkdGgpIHtcblx0XHRcdFx0c3RhdGUud2lkdGggPSBkaXNwbGF5Qm91bmRzLndpZHRoOyAvLyBwcmV2ZW50IHdpbmRvdyBmcm9tIGV4Y2VlZGluZyBkaXNwbGF5IGJvdW5kcyB3aWR0aFxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoc3RhdGUuaGVpZ2h0ID4gZGlzcGxheUJvdW5kcy5oZWlnaHQpIHtcblx0XHRcdFx0c3RhdGUuaGVpZ2h0ID0gZGlzcGxheUJvdW5kcy5oZWlnaHQ7IC8vIHByZXZlbnQgd2luZG93IGZyb20gZXhjZWVkaW5nIGRpc3BsYXkgYm91bmRzIGhlaWdodFxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBzdGF0ZTtcblx0fVxuXG5cdGFzeW5jIHN0b3BUcmFjaW5nKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5lbnZpcm9ubWVudE1haW5TZXJ2aWNlLmFyZ3MudHJhY2UpIHtcblx0XHRcdHJldHVybjsgLy8gcmVxdWlyZXMgdHJhY2luZyB0byBiZSBvblxuXHRcdH1cblxuXHRcdGNvbnN0IHBhdGggPSBhd2FpdCBjb250ZW50VHJhY2luZy5zdG9wUmVjb3JkaW5nKGAke3JhbmRvbVBhdGgodGhpcy5lbnZpcm9ubWVudE1haW5TZXJ2aWNlLnVzZXJIb21lLmZzUGF0aCwgdGhpcy5wcm9kdWN0U2VydmljZS5hcHBsaWNhdGlvbk5hbWUpfS50cmFjZS50eHRgKTtcblxuXHRcdC8vIEluZm9ybSB1c2VyIHRvIHJlcG9ydCBhbiBpc3N1ZVxuXHRcdGF3YWl0IHRoaXMuZGlhbG9nTWFpblNlcnZpY2Uuc2hvd01lc3NhZ2VCb3goe1xuXHRcdFx0dHlwZTogJ2luZm8nLFxuXHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ3RyYWNlLm1lc3NhZ2UnLCBcIlN1Y2Nlc3NmdWxseSBjcmVhdGVkIHRoZSB0cmFjZSBmaWxlXCIpLFxuXHRcdFx0ZGV0YWlsOiBsb2NhbGl6ZSgndHJhY2UuZGV0YWlsJywgXCJQbGVhc2UgY3JlYXRlIGFuIGlzc3VlIGFuZCBtYW51YWxseSBhdHRhY2ggdGhlIGZvbGxvd2luZyBmaWxlOlxcbnswfVwiLCBwYXRoKSxcblx0XHRcdGJ1dHRvbnM6IFtsb2NhbGl6ZSh7IGtleTogJ3RyYWNlLm9rJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmT0tcIildLFxuXHRcdH0sIEJyb3dzZXJXaW5kb3cuZ2V0Rm9jdXNlZFdpbmRvdygpID8/IHVuZGVmaW5lZCk7XG5cblx0XHQvLyBTaG93IGl0ZW0gaW4gZXhwbG9yZXJcblx0XHR0aGlzLm5hdGl2ZUhvc3RNYWluU2VydmljZS5zaG93SXRlbUluRm9sZGVyKHVuZGVmaW5lZCwgcGF0aCk7XG5cdH1cblxuXHRhc3luYyBnZXRTeXN0ZW1TdGF0dXMoKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRjb25zdCBbaW5mbywgcmVtb3RlRGF0YV0gPSBhd2FpdCBQcm9taXNlLmFsbChbdGhpcy5kaWFnbm9zdGljc01haW5TZXJ2aWNlLmdldE1haW5EaWFnbm9zdGljcygpLCB0aGlzLmRpYWdub3N0aWNzTWFpblNlcnZpY2UuZ2V0UmVtb3RlRGlhZ25vc3RpY3MoeyBpbmNsdWRlUHJvY2Vzc2VzOiBmYWxzZSwgaW5jbHVkZVdvcmtzcGFjZU1ldGFkYXRhOiBmYWxzZSB9KV0pO1xuXHRcdHJldHVybiB0aGlzLmRpYWdub3N0aWNzU2VydmljZS5nZXREaWFnbm9zdGljcyhpbmZvLCByZW1vdGVEYXRhKTtcblx0fVxuXG5cdGFzeW5jICRnZXRTeXN0ZW1JbmZvKCk6IFByb21pc2U8U3lzdGVtSW5mbz4ge1xuXHRcdGNvbnN0IFtpbmZvLCByZW1vdGVEYXRhXSA9IGF3YWl0IFByb21pc2UuYWxsKFt0aGlzLmRpYWdub3N0aWNzTWFpblNlcnZpY2UuZ2V0TWFpbkRpYWdub3N0aWNzKCksIHRoaXMuZGlhZ25vc3RpY3NNYWluU2VydmljZS5nZXRSZW1vdGVEaWFnbm9zdGljcyh7IGluY2x1ZGVQcm9jZXNzZXM6IGZhbHNlLCBpbmNsdWRlV29ya3NwYWNlTWV0YWRhdGE6IGZhbHNlIH0pXSk7XG5cdFx0Y29uc3QgbXNnID0gYXdhaXQgdGhpcy5kaWFnbm9zdGljc1NlcnZpY2UuZ2V0U3lzdGVtSW5mbyhpbmZvLCByZW1vdGVEYXRhKTtcblx0XHRyZXR1cm4gbXNnO1xuXHR9XG5cblx0YXN5bmMgJGdldFBlcmZvcm1hbmNlSW5mbygpOiBQcm9taXNlPFBlcmZvcm1hbmNlSW5mbz4ge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBbaW5mbywgcmVtb3RlRGF0YV0gPSBhd2FpdCBQcm9taXNlLmFsbChbdGhpcy5kaWFnbm9zdGljc01haW5TZXJ2aWNlLmdldE1haW5EaWFnbm9zdGljcygpLCB0aGlzLmRpYWdub3N0aWNzTWFpblNlcnZpY2UuZ2V0UmVtb3RlRGlhZ25vc3RpY3MoeyBpbmNsdWRlUHJvY2Vzc2VzOiB0cnVlLCBpbmNsdWRlV29ya3NwYWNlTWV0YWRhdGE6IHRydWUgfSldKTtcblx0XHRcdHJldHVybiBhd2FpdCB0aGlzLmRpYWdub3N0aWNzU2VydmljZS5nZXRQZXJmb3JtYW5jZUluZm8oaW5mbywgcmVtb3RlRGF0YSk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS53YXJuKCdpc3N1ZVNlcnZpY2UjZ2V0UGVyZm9ybWFuY2VJbmZvICcsIGVycm9yLm1lc3NhZ2UpO1xuXG5cdFx0XHR0aHJvdyBlcnJvcjtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUJyb3dzZXJXaW5kb3c8VD4ocG9zaXRpb246IElXaW5kb3dTdGF0ZSwgaXBjT2JqZWN0VXJsOiBJSVBDT2JqZWN0VXJsPFQ+LCBvcHRpb25zOiBJQnJvd3NlcldpbmRvd09wdGlvbnMsIHdpbmRvd0tpbmQ6IHN0cmluZyk6IEJyb3dzZXJXaW5kb3cge1xuXHRcdGNvbnN0IGJyb3dzZXJXaW5kb3dPcHRpb25zOiBCcm93c2VyV2luZG93Q29uc3RydWN0b3JPcHRpb25zICYgeyBleHBlcmltZW50YWxEYXJrTW9kZTogYm9vbGVhbiB9ID0ge1xuXHRcdFx0ZnVsbHNjcmVlbjogZmFsc2UsXG5cdFx0XHRza2lwVGFza2JhcjogZmFsc2UsXG5cdFx0XHRyZXNpemFibGU6IHRydWUsXG5cdFx0XHR3aWR0aDogcG9zaXRpb24ud2lkdGgsXG5cdFx0XHRoZWlnaHQ6IHBvc2l0aW9uLmhlaWdodCxcblx0XHRcdG1pbldpZHRoOiAzMDAsXG5cdFx0XHRtaW5IZWlnaHQ6IDIwMCxcblx0XHRcdHg6IHBvc2l0aW9uLngsXG5cdFx0XHR5OiBwb3NpdGlvbi55LFxuXHRcdFx0dGl0bGU6IG9wdGlvbnMudGl0bGUsXG5cdFx0XHRiYWNrZ3JvdW5kQ29sb3I6IG9wdGlvbnMuYmFja2dyb3VuZENvbG9yIHx8IFByb2Nlc3NNYWluU2VydmljZS5ERUZBVUxUX0JBQ0tHUk9VTkRfQ09MT1IsXG5cdFx0XHR3ZWJQcmVmZXJlbmNlczoge1xuXHRcdFx0XHRwcmVsb2FkOiBGaWxlQWNjZXNzLmFzRmlsZVVyaSgndnMvYmFzZS9wYXJ0cy9zYW5kYm94L2VsZWN0cm9uLXNhbmRib3gvcHJlbG9hZC5qcycpLmZzUGF0aCxcblx0XHRcdFx0YWRkaXRpb25hbEFyZ3VtZW50czogW2AtLXZzY29kZS13aW5kb3ctY29uZmlnPSR7aXBjT2JqZWN0VXJsLnJlc291cmNlLnRvU3RyaW5nKCl9YF0sXG5cdFx0XHRcdHY4Q2FjaGVPcHRpb25zOiB0aGlzLmVudmlyb25tZW50TWFpblNlcnZpY2UudXNlQ29kZUNhY2hlID8gJ2J5cGFzc0hlYXRDaGVjaycgOiAnbm9uZScsXG5cdFx0XHRcdGVuYWJsZVdlYlNRTDogZmFsc2UsXG5cdFx0XHRcdHNwZWxsY2hlY2s6IGZhbHNlLFxuXHRcdFx0XHR6b29tRmFjdG9yOiB6b29tTGV2ZWxUb1pvb21GYWN0b3Iob3B0aW9ucy56b29tTGV2ZWwpLFxuXHRcdFx0XHRzYW5kYm94OiB0cnVlXG5cdFx0XHR9LFxuXHRcdFx0YWx3YXlzT25Ub3A6IG9wdGlvbnMuYWx3YXlzT25Ub3AsXG5cdFx0XHRleHBlcmltZW50YWxEYXJrTW9kZTogdHJ1ZVxuXHRcdH07XG5cdFx0Y29uc3Qgd2luZG93ID0gbmV3IEJyb3dzZXJXaW5kb3coYnJvd3NlcldpbmRvd09wdGlvbnMpO1xuXG5cdFx0d2luZG93LnNldE1lbnVCYXJWaXNpYmlsaXR5KGZhbHNlKTtcblxuXHRcdHJldHVybiB3aW5kb3c7XG5cdH1cblxuXHRwcml2YXRlIHNhZmVTZW5kKGV2ZW50OiBJcGNNYWluRXZlbnQsIGNoYW5uZWw6IHN0cmluZywgLi4uYXJnczogdW5rbm93bltdKTogdm9pZCB7XG5cdFx0aWYgKCFldmVudC5zZW5kZXIuaXNEZXN0cm95ZWQoKSkge1xuXHRcdFx0ZXZlbnQuc2VuZGVyLnNlbmQoY2hhbm5lbCwgLi4uYXJncyk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgY2xvc2VQcm9jZXNzRXhwbG9yZXIoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5wcm9jZXNzRXhwbG9yZXJXaW5kb3c/LmNsb3NlKCk7XG5cdH1cbn1cblxuZnVuY3Rpb24gaXNTdHJpY3RXaW5kb3dTdGF0ZShvYmo6IHVua25vd24pOiBvYmogaXMgSVN0cmljdFdpbmRvd1N0YXRlIHtcblx0aWYgKHR5cGVvZiBvYmogIT09ICdvYmplY3QnIHx8IG9iaiA9PT0gbnVsbCkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHRyZXR1cm4gKFxuXHRcdCd4JyBpbiBvYmogJiZcblx0XHQneScgaW4gb2JqICYmXG5cdFx0J3dpZHRoJyBpbiBvYmogJiZcblx0XHQnaGVpZ2h0JyBpbiBvYmpcblx0KTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxlQUFnRCxnQkFBdUMsY0FBYztBQUM5RyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGtCQUFrQjtBQUMzQixTQUE4QixtQkFBbUI7QUFDakQsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxnQkFBZ0IsZ0JBQWdCLGdCQUFnQjtBQUN6RCxTQUFTLHFCQUFxQiwrQkFB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
