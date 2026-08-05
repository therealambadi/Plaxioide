import "./media/processExplorer.css";
import "../../../base/browser/ui/codicons/codiconStyles.js";
import { localize } from "../../../nls.js";
import { $, append } from "../../../base/browser/dom.js";
import { createStyleSheet } from "../../../base/browser/domStylesheets.js";
import { DataTree } from "../../../base/browser/ui/tree/dataTree.js";
import { RunOnceScheduler } from "../../../base/common/async.js";
import { popup } from "../../../base/parts/contextmenu/electron-sandbox/contextmenu.js";
import { ipcRenderer } from "../../../base/parts/sandbox/electron-sandbox/globals.js";
import { isRemoteDiagnosticError } from "../../../platform/diagnostics/common/diagnostics.js";
import { ByteSize } from "../../../platform/files/common/files.js";
import { ElectronIPCMainProcessService } from "../../../platform/ipc/electron-sandbox/mainProcessService.js";
import { NativeHostService } from "../../../platform/native/common/nativeHostService.js";
import { getIconsStyleSheet } from "../../../platform/theme/browser/iconsStyleSheet.js";
import { applyZoom, zoomIn, zoomOut } from "../../../platform/window/electron-sandbox/window.js";
import { StandardKeyboardEvent } from "../../../base/browser/keyboardEvent.js";
import { KeyCode } from "../../../base/common/keyCodes.js";
import { mainWindow } from "../../../base/browser/window.js";
const DEBUG_FLAGS_PATTERN = /\s--inspect(?:-brk|port)?=(?<port>\d+)?/;
const DEBUG_PORT_PATTERN = /\s--inspect-port=(?<port>\d+)/;
class ProcessListDelegate {
  getHeight(element) {
    return 22;
  }
  getTemplateId(element) {
    if (isProcessItem(element)) {
      return "process";
    }
    if (isMachineProcessInformation(element)) {
      return "machine";
    }
    if (isRemoteDiagnosticError(element)) {
      return "error";
    }
    if (isProcessInformation(element)) {
      return "header";
    }
    return "";
  }
}
class ProcessTreeDataSource {
  hasChildren(element) {
    if (isRemoteDiagnosticError(element)) {
      return false;
    }
    if (isProcessItem(element)) {
      return !!element.children?.length;
    } else {
      return true;
    }
  }
  getChildren(element) {
    if (isProcessItem(element)) {
      return element.children ? element.children : [];
    }
    if (isRemoteDiagnosticError(element)) {
      return [];
    }
    if (isProcessInformation(element)) {
      if (element.processRoots.length > 1) {
        return element.processRoots;
      } else {
        return [element.processRoots[0].rootProcess];
      }
    }
    if (isMachineProcessInformation(element)) {
      return [element.rootProcess];
    }
    return [element.processes];
  }
}
class ProcessHeaderTreeRenderer {
  constructor() {
    this.templateId = "header";
  }
  renderTemplate(container) {
    const row = append(container, $(".row"));
    const name = append(row, $(".nameLabel"));
    const CPU = append(row, $(".cpu"));
    const memory = append(row, $(".memory"));
    const PID = append(row, $(".pid"));
    return { name, CPU, memory, PID };
  }
  renderElement(node, index, templateData, height) {
    templateData.name.textContent = localize("name", "Process Name");
    templateData.CPU.textContent = localize("cpu", "CPU (%)");
    templateData.PID.textContent = localize("pid", "PID");
    templateData.memory.textContent = localize("memory", "Memory (MB)");
  }
  disposeTemplate(templateData) {
  }
}
class MachineRenderer {
  constructor() {
    this.templateId = "machine";
  }
  renderTemplate(container) {
    const data = /* @__PURE__ */ Object.create(null);
    const row = append(container, $(".row"));
    data.name = append(row, $(".nameLabel"));
    return data;
  }
  renderElement(node, index, templateData, height) {
    templateData.name.textContent = node.element.name;
  }
  disposeTemplate(templateData) {
  }
}
class ErrorRenderer {
  constructor() {
    this.templateId = "error";
  }
  renderTemplate(container) {
    const data = /* @__PURE__ */ Object.create(null);
    const row = append(container, $(".row"));
    data.name = append(row, $(".nameLabel"));
    return data;
  }
  renderElement(node, index, templateData, height) {
    templateData.name.textContent = node.element.errorMessage;
  }
  disposeTemplate(templateData) {
  }
}
class ProcessRenderer {
  constructor(platform, totalMem, mapPidToName) {
    this.platform = platform;
    this.totalMem = totalMem;
    this.mapPidToName = mapPidToName;
    this.templateId = "process";
  }
  renderTemplate(container) {
    const row = append(container, $(".row"));
    const name = append(row, $(".nameLabel"));
    const CPU = append(row, $(".cpu"));
    const memory = append(row, $(".memory"));
    const PID = append(row, $(".pid"));
    return { name, CPU, PID, memory };
  }
  renderElement(node, index, templateData, height) {
    const { element } = node;
    const pid = element.pid.toFixed(0);
    let name = element.name;
    if (this.mapPidToName.has(element.pid)) {
      name = this.mapPidToName.get(element.pid);
    }
    templateData.name.textContent = name;
    templateData.name.title = element.cmd;
    templateData.CPU.textContent = element.load.toFixed(0);
    templateData.PID.textContent = pid;
    templateData.PID.parentElement.id = `pid-${pid}`;
    const memory = this.platform === "win32" ? element.mem : this.totalMem * (element.mem / 100);
    templateData.memory.textContent = (memory / ByteSize.MB).toFixed(0);
  }
  disposeTemplate(templateData) {
  }
}
function isMachineProcessInformation(item) {
  return !!item.name && !!item.rootProcess;
}
function isProcessInformation(item) {
  return !!item.processRoots;
}
function isProcessItem(item) {
  return !!item.pid;
}
class ProcessExplorer {
  constructor(windowId, data) {
    this.data = data;
    this.mapPidToName = /* @__PURE__ */ new Map();
    const mainProcessService = new ElectronIPCMainProcessService(windowId);
    this.nativeHostService = new NativeHostService(windowId, mainProcessService);
    this.applyStyles(data.styles);
    this.setEventHandlers(data);
    ipcRenderer.on("vscode:pidToNameResponse", (event, pidToNames) => {
      this.mapPidToName.clear();
      for (const [pid, name] of pidToNames) {
        this.mapPidToName.set(pid, name);
      }
    });
    ipcRenderer.on("vscode:listProcessesResponse", async (event, processRoots) => {
      processRoots.forEach((info, index) => {
        if (isProcessItem(info.rootProcess)) {
          info.rootProcess.name = index === 0 ? `${this.data.applicationName} main` : "remote agent";
        }
      });
      if (!this.tree) {
        await this.createProcessTree(processRoots);
      } else {
        this.tree.setInput({ processes: { processRoots } });
        this.tree.layout(mainWindow.innerHeight, mainWindow.innerWidth);
      }
      this.requestProcessList(0);
    });
    this.lastRequestTime = Date.now();
    ipcRenderer.send("vscode:pidToNameRequest");
    ipcRenderer.send("vscode:listProcesses");
  }
  setEventHandlers(data) {
    mainWindow.document.onkeydown = (e) => {
      const cmdOrCtrlKey = data.platform === "darwin" ? e.metaKey : e.ctrlKey;
      if (cmdOrCtrlKey && e.keyCode === 87) {
        e.stopPropagation();
        e.preventDefault();
        ipcRenderer.send("vscode:closeProcessExplorer");
      }
      if (cmdOrCtrlKey && e.keyCode === 187) {
        zoomIn(mainWindow);
      }
      if (cmdOrCtrlKey && e.keyCode === 189) {
        zoomOut(mainWindow);
      }
    };
  }
  async createProcessTree(processRoots) {
    const container = mainWindow.document.getElementById("process-list");
    if (!container) {
      return;
    }
    const { totalmem } = await this.nativeHostService.getOSStatistics();
    const renderers = [
      new ProcessRenderer(this.data.platform, totalmem, this.mapPidToName),
      new ProcessHeaderTreeRenderer(),
      new MachineRenderer(),
      new ErrorRenderer()
    ];
    this.tree = new DataTree(
      "processExplorer",
      container,
      new ProcessListDelegate(),
      renderers,
      new ProcessTreeDataSource(),
      {
        identityProvider: {
          getId: (element) => {
            if (isProcessItem(element)) {
              return element.pid.toString();
            }
            if (isRemoteDiagnosticError(element)) {
              return element.hostName;
            }
            if (isProcessInformation(element)) {
              return "processes";
            }
            if (isMachineProcessInformation(element)) {
              return element.name;
            }
            return "header";
          }
        }
      }
    );
    this.tree.setInput({ processes: { processRoots } });
    this.tree.layout(mainWindow.innerHeight, mainWindow.innerWidth);
    this.tree.onKeyDown((e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.keyCode === KeyCode.KeyE && event.altKey) {
        const selectionPids = this.getSelectedPids();
        void Promise.all(selectionPids.map((pid) => this.nativeHostService.killProcess(pid, "SIGTERM"))).then(() => this.tree?.refresh());
      }
    });
    this.tree.onContextMenu((e) => {
      if (isProcessItem(e.element)) {
        this.showContextMenu(e.element, true);
      }
    });
    container.style.height = `${mainWindow.innerHeight}px`;
    mainWindow.addEventListener("resize", () => {
      container.style.height = `${mainWindow.innerHeight}px`;
      this.tree?.layout(mainWindow.innerHeight, mainWindow.innerWidth);
    });
  }
  isDebuggable(cmd) {
    const matches = DEBUG_FLAGS_PATTERN.exec(cmd);
    return matches && matches.groups.port !== "0" || cmd.indexOf("node ") >= 0 || cmd.indexOf("node.exe") >= 0;
  }
  attachTo(item) {
    const config = {
      type: "node",
      request: "attach",
      name: `process ${item.pid}`
    };
    let matches = DEBUG_FLAGS_PATTERN.exec(item.cmd);
    if (matches) {
      config.port = Number(matches.groups.port);
    } else {
      config.processId = String(item.pid);
    }
    matches = DEBUG_PORT_PATTERN.exec(item.cmd);
    if (matches) {
      config.port = Number(matches.groups.port);
    }
    ipcRenderer.send("vscode:workbenchCommand", { id: "debug.startFromConfig", from: "processExplorer", args: [config] });
  }
  applyStyles(styles) {
    const styleElement = createStyleSheet();
    const content = [];
    if (styles.listFocusBackground) {
      content.push(`.monaco-list:focus .monaco-list-row.focused { background-color: ${styles.listFocusBackground}; }`);
      content.push(`.monaco-list:focus .monaco-list-row.focused:hover { background-color: ${styles.listFocusBackground}; }`);
    }
    if (styles.listFocusForeground) {
      content.push(`.monaco-list:focus .monaco-list-row.focused { color: ${styles.listFocusForeground}; }`);
    }
    if (styles.listActiveSelectionBackground) {
      content.push(`.monaco-list:focus .monaco-list-row.selected { background-color: ${styles.listActiveSelectionBackground}; }`);
      content.push(`.monaco-list:focus .monaco-list-row.selected:hover { background-color: ${styles.listActiveSelectionBackground}; }`);
    }
    if (styles.listActiveSelectionForeground) {
      content.push(`.monaco-list:focus .monaco-list-row.selected { color: ${styles.listActiveSelectionForeground}; }`);
    }
    if (styles.listHoverBackground) {
      content.push(`.monaco-list-row:hover:not(.selected):not(.focused) { background-color: ${styles.listHoverBackground}; }`);
    }
    if (styles.listHoverForeground) {
      content.push(`.monaco-list-row:hover:not(.selected):not(.focused) { color: ${styles.listHoverForeground}; }`);
    }
    if (styles.listFocusOutline) {
      content.push(`.monaco-list:focus .monaco-list-row.focused { outline: 1px solid ${styles.listFocusOutline}; outline-offset: -1px; }`);
    }
    if (styles.listHoverOutline) {
      content.push(`.monaco-list-row:hover { outline: 1px dashed ${styles.listHoverOutline}; outline-offset: -1px; }`);
    }
    if (styles.scrollbarShadowColor) {
      content.push(`
				.monaco-scrollable-element > .shadow.top {
					box-shadow: ${styles.scrollbarShadowColor} 0 6px 6px -6px inset;
				}

				.monaco-scrollable-element > .shadow.left {
					box-shadow: ${styles.scrollbarShadowColor} 6px 0 6px -6px inset;
				}

				.monaco-scrollable-element > .shadow.top.left {
					box-shadow: ${styles.scrollbarShadowColor} 6px 6px 6px -6px inset;
				}
			`);
    }
    if (styles.scrollbarSliderBackgroundColor) {
      content.push(`
				.monaco-scrollable-element > .scrollbar > .slider {
					background: ${styles.scrollbarSliderBackgroundColor};
				}
			`);
    }
    if (styles.scrollbarSliderHoverBackgroundColor) {
      content.push(`
				.monaco-scrollable-element > .scrollbar > .slider:hover {
					background: ${styles.scrollbarSliderHoverBackgroundColor};
				}
			`);
    }
    if (styles.scrollbarSliderActiveBackgroundColor) {
      content.push(`
				.monaco-scrollable-element > .scrollbar > .slider.active {
					background: ${styles.scrollbarSliderActiveBackgroundColor};
				}
			`);
    }
    styleElement.textContent = content.join("\n");
    if (styles.color) {
      mainWindow.document.body.style.color = styles.color;
    }
  }
  showContextMenu(item, isLocal) {
    const items = [];
    const pid = Number(item.pid);
    if (isLocal) {
      items.push({
        accelerator: "Alt+E",
        label: localize("killProcess", "Kill Process"),
        click: () => {
          this.nativeHostService.killProcess(pid, "SIGTERM");
        }
      });
      items.push({
        label: localize("forceKillProcess", "Force Kill Process"),
        click: () => {
          this.nativeHostService.killProcess(pid, "SIGKILL");
        }
      });
      items.push({
        type: "separator"
      });
    }
    items.push({
      label: localize("copy", "Copy"),
      click: () => {
        const selectionPids = this.getSelectedPids();
        if (!selectionPids?.includes(pid)) {
          selectionPids.length = 0;
          selectionPids.push(pid);
        }
        const rows = selectionPids?.map((e) => mainWindow.document.getElementById(`pid-${e}`)).filter((e) => !!e);
        if (rows) {
          const text = rows.map((e) => e.innerText).filter((e) => !!e);
          this.nativeHostService.writeClipboardText(text.join("\n"));
        }
      }
    });
    items.push({
      label: localize("copyAll", "Copy All"),
      click: () => {
        const processList = mainWindow.document.getElementById("process-list");
        if (processList) {
          this.nativeHostService.writeClipboardText(processList.innerText);
        }
      }
    });
    if (item && isLocal && this.isDebuggable(item.cmd)) {
      items.push({
        type: "separator"
      });
      items.push({
        label: localize("debug", "Debug"),
        click: () => {
          this.attachTo(item);
        }
      });
    }
    popup(items);
  }
  requestProcessList(totalWaitTime) {
    setTimeout(() => {
      const nextRequestTime = Date.now();
      const waited = totalWaitTime + nextRequestTime - this.lastRequestTime;
      this.lastRequestTime = nextRequestTime;
      if (waited > 1e3) {
        ipcRenderer.send("vscode:pidToNameRequest");
        ipcRenderer.send("vscode:listProcesses");
      } else {
        this.requestProcessList(waited);
      }
    }, 200);
  }
  getSelectedPids() {
    return this.tree?.getSelection()?.map((e) => {
      if (!e || !("pid" in e)) {
        return void 0;
      }
      return e.pid;
    }).filter((e) => !!e);
  }
}
function createCodiconStyleSheet() {
  const codiconStyleSheet = createStyleSheet();
  codiconStyleSheet.id = "codiconStyles";
  const iconsStyleSheet = getIconsStyleSheet(void 0);
  function updateAll() {
    codiconStyleSheet.textContent = iconsStyleSheet.getCSS();
  }
  const delayer = new RunOnceScheduler(updateAll, 0);
  iconsStyleSheet.onDidChange(() => delayer.schedule());
  delayer.schedule();
}
function startup(configuration) {
  const platformClass = configuration.data.platform === "win32" ? "windows" : configuration.data.platform === "linux" ? "linux" : "mac";
  mainWindow.document.body.classList.add(platformClass);
  createCodiconStyleSheet();
  applyZoom(configuration.data.zoomLevel, mainWindow);
  new ProcessExplorer(configuration.windowId, configuration.data);
}
export {
  startup
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9jb2RlL2VsZWN0cm9uLXNhbmRib3gvcHJvY2Vzc0V4cGxvcmVyL3Byb2Nlc3NFeHBsb3Jlck1haW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgJy4vbWVkaWEvcHJvY2Vzc0V4cGxvcmVyLmNzcyc7XG5pbXBvcnQgJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9jb2RpY29ucy9jb2RpY29uU3R5bGVzLmpzJzsgLy8gbWFrZSBzdXJlIGNvZGljb24gY3NzIGlzIGxvYWRlZFxuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgJCwgYXBwZW5kIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVTdHlsZVNoZWV0IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbVN0eWxlc2hlZXRzLmpzJztcbmltcG9ydCB7IElMaXN0VmlydHVhbERlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdC5qcyc7XG5pbXBvcnQgeyBEYXRhVHJlZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS90cmVlL2RhdGFUcmVlLmpzJztcbmltcG9ydCB7IElEYXRhU291cmNlLCBJVHJlZU5vZGUsIElUcmVlUmVuZGVyZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdHJlZS90cmVlLmpzJztcbmltcG9ydCB7IFJ1bk9uY2VTY2hlZHVsZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBQcm9jZXNzSXRlbSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Byb2Nlc3Nlcy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVJdGVtIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9wYXJ0cy9jb250ZXh0bWVudS9jb21tb24vY29udGV4dG1lbnUuanMnO1xuaW1wb3J0IHsgcG9wdXAgfSBmcm9tICcuLi8uLi8uLi9iYXNlL3BhcnRzL2NvbnRleHRtZW51L2VsZWN0cm9uLXNhbmRib3gvY29udGV4dG1lbnUuanMnO1xuaW1wb3J0IHsgaXBjUmVuZGVyZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL3BhcnRzL3NhbmRib3gvZWxlY3Ryb24tc2FuZGJveC9nbG9iYWxzLmpzJztcbmltcG9ydCB7IElSZW1vdGVEaWFnbm9zdGljRXJyb3IsIGlzUmVtb3RlRGlhZ25vc3RpY0Vycm9yIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZGlhZ25vc3RpY3MvY29tbW9uL2RpYWdub3N0aWNzLmpzJztcbmltcG9ydCB7IEJ5dGVTaXplIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IEVsZWN0cm9uSVBDTWFpblByb2Nlc3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vaXBjL2VsZWN0cm9uLXNhbmRib3gvbWFpblByb2Nlc3NTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFByb2Nlc3NFeHBsb3JlckRhdGEsIFByb2Nlc3NFeHBsb3JlclN0eWxlcywgUHJvY2Vzc0V4cGxvcmVyV2luZG93Q29uZmlndXJhdGlvbiB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3Byb2Nlc3MvY29tbW9uL3Byb2Nlc3MuanMnO1xuaW1wb3J0IHsgSU5hdGl2ZUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vbmF0aXZlL2NvbW1vbi9uYXRpdmUuanMnO1xuaW1wb3J0IHsgTmF0aXZlSG9zdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9uYXRpdmUvY29tbW9uL25hdGl2ZUhvc3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGdldEljb25zU3R5bGVTaGVldCB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2Jyb3dzZXIvaWNvbnNTdHlsZVNoZWV0LmpzJztcbmltcG9ydCB7IGFwcGx5Wm9vbSwgem9vbUluLCB6b29tT3V0IH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vd2luZG93L2VsZWN0cm9uLXNhbmRib3gvd2luZG93LmpzJztcbmltcG9ydCB7IFN0YW5kYXJkS2V5Ym9hcmRFdmVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9rZXlib2FyZEV2ZW50LmpzJztcbmltcG9ydCB7IEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBtYWluV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL3dpbmRvdy5qcyc7XG5cbmNvbnN0IERFQlVHX0ZMQUdTX1BBVFRFUk4gPSAvXFxzLS1pbnNwZWN0KD86LWJya3xwb3J0KT89KD88cG9ydD5cXGQrKT8vO1xuY29uc3QgREVCVUdfUE9SVF9QQVRURVJOID0gL1xccy0taW5zcGVjdC1wb3J0PSg/PHBvcnQ+XFxkKykvO1xuXG5jbGFzcyBQcm9jZXNzTGlzdERlbGVnYXRlIGltcGxlbWVudHMgSUxpc3RWaXJ0dWFsRGVsZWdhdGU8TWFjaGluZVByb2Nlc3NJbmZvcm1hdGlvbiB8IFByb2Nlc3NJdGVtIHwgSVJlbW90ZURpYWdub3N0aWNFcnJvcj4ge1xuXHRnZXRIZWlnaHQoZWxlbWVudDogTWFjaGluZVByb2Nlc3NJbmZvcm1hdGlvbiB8IFByb2Nlc3NJdGVtIHwgSVJlbW90ZURpYWdub3N0aWNFcnJvcikge1xuXHRcdHJldHVybiAyMjtcblx0fVxuXG5cdGdldFRlbXBsYXRlSWQoZWxlbWVudDogUHJvY2Vzc0luZm9ybWF0aW9uIHwgTWFjaGluZVByb2Nlc3NJbmZvcm1hdGlvbiB8IFByb2Nlc3NJdGVtIHwgSVJlbW90ZURpYWdub3N0aWNFcnJvcikge1xuXHRcdGlmIChpc1Byb2Nlc3NJdGVtKGVsZW1lbnQpKSB7XG5cdFx0XHRyZXR1cm4gJ3Byb2Nlc3MnO1xuXHRcdH1cblxuXHRcdGlmIChpc01hY2hpbmVQcm9jZXNzSW5mb3JtYXRpb24oZWxlbWVudCkpIHtcblx0XHRcdHJldHVybiAnbWFjaGluZSc7XG5cdFx0fVxuXG5cdFx0aWYgKGlzUmVtb3RlRGlhZ25vc3RpY0Vycm9yKGVsZW1lbnQpKSB7XG5cdFx0XHRyZXR1cm4gJ2Vycm9yJztcblx0XHR9XG5cblx0XHRpZiAoaXNQcm9jZXNzSW5mb3JtYXRpb24oZWxlbWVudCkpIHtcblx0XHRcdHJldHVybiAnaGVhZGVyJztcblx0XHR9XG5cblx0XHRyZXR1cm4gJyc7XG5cdH1cbn1cblxuaW50ZXJmYWNlIElQcm9jZXNzSXRlbVRlbXBsYXRlRGF0YSBleHRlbmRzIElQcm9jZXNzUm93VGVtcGxhdGVEYXRhIHtcblx0cmVhZG9ubHkgQ1BVOiBIVE1MRWxlbWVudDtcblx0cmVhZG9ubHkgbWVtb3J5OiBIVE1MRWxlbWVudDtcblx0cmVhZG9ubHkgUElEOiBIVE1MRWxlbWVudDtcbn1cblxuaW50ZXJmYWNlIElQcm9jZXNzUm93VGVtcGxhdGVEYXRhIHtcblx0cmVhZG9ubHkgbmFtZTogSFRNTEVsZW1lbnQ7XG59XG5cbmNsYXNzIFByb2Nlc3NUcmVlRGF0YVNvdXJjZSBpbXBsZW1lbnRzIElEYXRhU291cmNlPFByb2Nlc3NUcmVlLCBQcm9jZXNzSW5mb3JtYXRpb24gfCBNYWNoaW5lUHJvY2Vzc0luZm9ybWF0aW9uIHwgUHJvY2Vzc0l0ZW0gfCBJUmVtb3RlRGlhZ25vc3RpY0Vycm9yPiB7XG5cdGhhc0NoaWxkcmVuKGVsZW1lbnQ6IFByb2Nlc3NUcmVlIHwgUHJvY2Vzc0luZm9ybWF0aW9uIHwgTWFjaGluZVByb2Nlc3NJbmZvcm1hdGlvbiB8IFByb2Nlc3NJdGVtIHwgSVJlbW90ZURpYWdub3N0aWNFcnJvcik6IGJvb2xlYW4ge1xuXHRcdGlmIChpc1JlbW90ZURpYWdub3N0aWNFcnJvcihlbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmIChpc1Byb2Nlc3NJdGVtKGVsZW1lbnQpKSB7XG5cdFx0XHRyZXR1cm4gISFlbGVtZW50LmNoaWxkcmVuPy5sZW5ndGg7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0fVxuXG5cdGdldENoaWxkcmVuKGVsZW1lbnQ6IFByb2Nlc3NUcmVlIHwgUHJvY2Vzc0luZm9ybWF0aW9uIHwgTWFjaGluZVByb2Nlc3NJbmZvcm1hdGlvbiB8IFByb2Nlc3NJdGVtIHwgSVJlbW90ZURpYWdub3N0aWNFcnJvcikge1xuXHRcdGlmIChpc1Byb2Nlc3NJdGVtKGVsZW1lbnQpKSB7XG5cdFx0XHRyZXR1cm4gZWxlbWVudC5jaGlsZHJlbiA/IGVsZW1lbnQuY2hpbGRyZW4gOiBbXTtcblx0XHR9XG5cblx0XHRpZiAoaXNSZW1vdGVEaWFnbm9zdGljRXJyb3IoZWxlbWVudCkpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cblx0XHRpZiAoaXNQcm9jZXNzSW5mb3JtYXRpb24oZWxlbWVudCkpIHtcblx0XHRcdC8vIElmIHRoZXJlIGFyZSBtdWx0aXBsZSBwcm9jZXNzIHJvb3RzLCByZXR1cm4gdGhlc2UsIG90aGVyd2lzZSBnbyBkaXJlY3RseSB0byB0aGUgcm9vdCBwcm9jZXNzXG5cdFx0XHRpZiAoZWxlbWVudC5wcm9jZXNzUm9vdHMubGVuZ3RoID4gMSkge1xuXHRcdFx0XHRyZXR1cm4gZWxlbWVudC5wcm9jZXNzUm9vdHM7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gW2VsZW1lbnQucHJvY2Vzc1Jvb3RzWzBdLnJvb3RQcm9jZXNzXTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoaXNNYWNoaW5lUHJvY2Vzc0luZm9ybWF0aW9uKGVsZW1lbnQpKSB7XG5cdFx0XHRyZXR1cm4gW2VsZW1lbnQucm9vdFByb2Nlc3NdO1xuXHRcdH1cblxuXHRcdHJldHVybiBbZWxlbWVudC5wcm9jZXNzZXNdO1xuXHR9XG59XG5cbmNsYXNzIFByb2Nlc3NIZWFkZXJUcmVlUmVuZGVyZXIgaW1wbGVtZW50cyBJVHJlZVJlbmRlcmVyPFByb2Nlc3NJbmZvcm1hdGlvbiwgdm9pZCwgSVByb2Nlc3NJdGVtVGVtcGxhdGVEYXRhPiB7XG5cdHRlbXBsYXRlSWQ6IHN0cmluZyA9ICdoZWFkZXInO1xuXG5cdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJUHJvY2Vzc0l0ZW1UZW1wbGF0ZURhdGEge1xuXHRcdGNvbnN0IHJvdyA9IGFwcGVuZChjb250YWluZXIsICQoJy5yb3cnKSk7XG5cdFx0Y29uc3QgbmFtZSA9IGFwcGVuZChyb3csICQoJy5uYW1lTGFiZWwnKSk7XG5cdFx0Y29uc3QgQ1BVID0gYXBwZW5kKHJvdywgJCgnLmNwdScpKTtcblx0XHRjb25zdCBtZW1vcnkgPSBhcHBlbmQocm93LCAkKCcubWVtb3J5JykpO1xuXHRcdGNvbnN0IFBJRCA9IGFwcGVuZChyb3csICQoJy5waWQnKSk7XG5cdFx0cmV0dXJuIHsgbmFtZSwgQ1BVLCBtZW1vcnksIFBJRCB9O1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChub2RlOiBJVHJlZU5vZGU8UHJvY2Vzc0luZm9ybWF0aW9uLCB2b2lkPiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJUHJvY2Vzc0l0ZW1UZW1wbGF0ZURhdGEsIGhlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLm5hbWUudGV4dENvbnRlbnQgPSBsb2NhbGl6ZSgnbmFtZScsIFwiUHJvY2VzcyBOYW1lXCIpO1xuXHRcdHRlbXBsYXRlRGF0YS5DUFUudGV4dENvbnRlbnQgPSBsb2NhbGl6ZSgnY3B1JywgXCJDUFUgKCUpXCIpO1xuXHRcdHRlbXBsYXRlRGF0YS5QSUQudGV4dENvbnRlbnQgPSBsb2NhbGl6ZSgncGlkJywgXCJQSURcIik7XG5cdFx0dGVtcGxhdGVEYXRhLm1lbW9yeS50ZXh0Q29udGVudCA9IGxvY2FsaXplKCdtZW1vcnknLCBcIk1lbW9yeSAoTUIpXCIpO1xuXG5cdH1cblxuXHRkaXNwb3NlVGVtcGxhdGUodGVtcGxhdGVEYXRhOiBhbnkpOiB2b2lkIHtcblx0XHQvLyBOb3RoaW5nIHRvIGRvXG5cdH1cbn1cblxuY2xhc3MgTWFjaGluZVJlbmRlcmVyIGltcGxlbWVudHMgSVRyZWVSZW5kZXJlcjxNYWNoaW5lUHJvY2Vzc0luZm9ybWF0aW9uLCB2b2lkLCBJUHJvY2Vzc1Jvd1RlbXBsYXRlRGF0YT4ge1xuXHR0ZW1wbGF0ZUlkOiBzdHJpbmcgPSAnbWFjaGluZSc7XG5cdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJUHJvY2Vzc1Jvd1RlbXBsYXRlRGF0YSB7XG5cdFx0Y29uc3QgZGF0YSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0Y29uc3Qgcm93ID0gYXBwZW5kKGNvbnRhaW5lciwgJCgnLnJvdycpKTtcblx0XHRkYXRhLm5hbWUgPSBhcHBlbmQocm93LCAkKCcubmFtZUxhYmVsJykpO1xuXHRcdHJldHVybiBkYXRhO1xuXHR9XG5cdHJlbmRlckVsZW1lbnQobm9kZTogSVRyZWVOb2RlPE1hY2hpbmVQcm9jZXNzSW5mb3JtYXRpb24sIHZvaWQ+LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElQcm9jZXNzUm93VGVtcGxhdGVEYXRhLCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5uYW1lLnRleHRDb250ZW50ID0gbm9kZS5lbGVtZW50Lm5hbWU7XG5cdH1cblx0ZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlRGF0YTogSVByb2Nlc3NSb3dUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHQvLyBOb3RoaW5nIHRvIGRvXG5cdH1cbn1cblxuY2xhc3MgRXJyb3JSZW5kZXJlciBpbXBsZW1lbnRzIElUcmVlUmVuZGVyZXI8SVJlbW90ZURpYWdub3N0aWNFcnJvciwgdm9pZCwgSVByb2Nlc3NSb3dUZW1wbGF0ZURhdGE+IHtcblx0dGVtcGxhdGVJZDogc3RyaW5nID0gJ2Vycm9yJztcblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElQcm9jZXNzUm93VGVtcGxhdGVEYXRhIHtcblx0XHRjb25zdCBkYXRhID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHRjb25zdCByb3cgPSBhcHBlbmQoY29udGFpbmVyLCAkKCcucm93JykpO1xuXHRcdGRhdGEubmFtZSA9IGFwcGVuZChyb3csICQoJy5uYW1lTGFiZWwnKSk7XG5cdFx0cmV0dXJuIGRhdGE7XG5cdH1cblx0cmVuZGVyRWxlbWVudChub2RlOiBJVHJlZU5vZGU8SVJlbW90ZURpYWdub3N0aWNFcnJvciwgdm9pZD4sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSVByb2Nlc3NSb3dUZW1wbGF0ZURhdGEsIGhlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLm5hbWUudGV4dENvbnRlbnQgPSBub2RlLmVsZW1lbnQuZXJyb3JNZXNzYWdlO1xuXHR9XG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IElQcm9jZXNzUm93VGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0Ly8gTm90aGluZyB0byBkb1xuXHR9XG59XG5cblxuY2xhc3MgUHJvY2Vzc1JlbmRlcmVyIGltcGxlbWVudHMgSVRyZWVSZW5kZXJlcjxQcm9jZXNzSXRlbSwgdm9pZCwgSVByb2Nlc3NJdGVtVGVtcGxhdGVEYXRhPiB7XG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcGxhdGZvcm06IHN0cmluZywgcHJpdmF0ZSB0b3RhbE1lbTogbnVtYmVyLCBwcml2YXRlIG1hcFBpZFRvTmFtZTogTWFwPG51bWJlciwgc3RyaW5nPikgeyB9XG5cblx0dGVtcGxhdGVJZDogc3RyaW5nID0gJ3Byb2Nlc3MnO1xuXHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSVByb2Nlc3NJdGVtVGVtcGxhdGVEYXRhIHtcblx0XHRjb25zdCByb3cgPSBhcHBlbmQoY29udGFpbmVyLCAkKCcucm93JykpO1xuXG5cdFx0Y29uc3QgbmFtZSA9IGFwcGVuZChyb3csICQoJy5uYW1lTGFiZWwnKSk7XG5cdFx0Y29uc3QgQ1BVID0gYXBwZW5kKHJvdywgJCgnLmNwdScpKTtcblx0XHRjb25zdCBtZW1vcnkgPSBhcHBlbmQocm93LCAkKCcubWVtb3J5JykpO1xuXHRcdGNvbnN0IFBJRCA9IGFwcGVuZChyb3csICQoJy5waWQnKSk7XG5cblx0XHRyZXR1cm4geyBuYW1lLCBDUFUsIFBJRCwgbWVtb3J5IH07XG5cdH1cblx0cmVuZGVyRWxlbWVudChub2RlOiBJVHJlZU5vZGU8UHJvY2Vzc0l0ZW0sIHZvaWQ+LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElQcm9jZXNzSXRlbVRlbXBsYXRlRGF0YSwgaGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRjb25zdCB7IGVsZW1lbnQgfSA9IG5vZGU7XG5cblx0XHRjb25zdCBwaWQgPSBlbGVtZW50LnBpZC50b0ZpeGVkKDApO1xuXG5cdFx0bGV0IG5hbWUgPSBlbGVtZW50Lm5hbWU7XG5cdFx0aWYgKHRoaXMubWFwUGlkVG9OYW1lLmhhcyhlbGVtZW50LnBpZCkpIHtcblx0XHRcdG5hbWUgPSB0aGlzLm1hcFBpZFRvTmFtZS5nZXQoZWxlbWVudC5waWQpITtcblx0XHR9XG5cblx0XHR0ZW1wbGF0ZURhdGEubmFtZS50ZXh0Q29udGVudCA9IG5hbWU7XG5cdFx0dGVtcGxhdGVEYXRhLm5hbWUudGl0bGUgPSBlbGVtZW50LmNtZDtcblxuXHRcdHRlbXBsYXRlRGF0YS5DUFUudGV4dENvbnRlbnQgPSBlbGVtZW50LmxvYWQudG9GaXhlZCgwKTtcblx0XHR0ZW1wbGF0ZURhdGEuUElELnRleHRDb250ZW50ID0gcGlkO1xuXHRcdHRlbXBsYXRlRGF0YS5QSUQucGFyZW50RWxlbWVudCEuaWQgPSBgcGlkLSR7cGlkfWA7XG5cblx0XHRjb25zdCBtZW1vcnkgPSB0aGlzLnBsYXRmb3JtID09PSAnd2luMzInID8gZWxlbWVudC5tZW0gOiAodGhpcy50b3RhbE1lbSAqIChlbGVtZW50Lm1lbSAvIDEwMCkpO1xuXHRcdHRlbXBsYXRlRGF0YS5tZW1vcnkudGV4dENvbnRlbnQgPSAobWVtb3J5IC8gQnl0ZVNpemUuTUIpLnRvRml4ZWQoMCk7XG5cdH1cblxuXHRkaXNwb3NlVGVtcGxhdGUodGVtcGxhdGVEYXRhOiBJUHJvY2Vzc0l0ZW1UZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHQvLyBOb3RoaW5nIHRvIGRvXG5cdH1cbn1cblxuaW50ZXJmYWNlIE1hY2hpbmVQcm9jZXNzSW5mb3JtYXRpb24ge1xuXHRuYW1lOiBzdHJpbmc7XG5cdHJvb3RQcm9jZXNzOiBQcm9jZXNzSXRlbSB8IElSZW1vdGVEaWFnbm9zdGljRXJyb3I7XG59XG5cbmludGVyZmFjZSBQcm9jZXNzSW5mb3JtYXRpb24ge1xuXHRwcm9jZXNzUm9vdHM6IE1hY2hpbmVQcm9jZXNzSW5mb3JtYXRpb25bXTtcbn1cblxuaW50ZXJmYWNlIFByb2Nlc3NUcmVlIHtcblx0cHJvY2Vzc2VzOiBQcm9jZXNzSW5mb3JtYXRpb247XG59XG5cbmZ1bmN0aW9uIGlzTWFjaGluZVByb2Nlc3NJbmZvcm1hdGlvbihpdGVtOiBhbnkpOiBpdGVtIGlzIE1hY2hpbmVQcm9jZXNzSW5mb3JtYXRpb24ge1xuXHRyZXR1cm4gISFpdGVtLm5hbWUgJiYgISFpdGVtLnJvb3RQcm9jZXNzO1xufVxuXG5mdW5jdGlvbiBpc1Byb2Nlc3NJbmZvcm1hdGlvbihpdGVtOiBhbnkpOiBpdGVtIGlzIFByb2Nlc3NJbmZvcm1hdGlvbiB7XG5cdHJldHVybiAhIWl0ZW0ucHJvY2Vzc1Jvb3RzO1xufVxuXG5mdW5jdGlvbiBpc1Byb2Nlc3NJdGVtKGl0ZW06IGFueSk6IGl0ZW0gaXMgUHJvY2Vzc0l0ZW0ge1xuXHRyZXR1cm4gISFpdGVtLnBpZDtcbn1cblxuY2xhc3MgUHJvY2Vzc0V4cGxvcmVyIHtcblx0cHJpdmF0ZSBsYXN0UmVxdWVzdFRpbWU6IG51bWJlcjtcblxuXHRwcml2YXRlIG1hcFBpZFRvTmFtZSA9IG5ldyBNYXA8bnVtYmVyLCBzdHJpbmc+KCk7XG5cblx0cHJpdmF0ZSBuYXRpdmVIb3N0U2VydmljZTogSU5hdGl2ZUhvc3RTZXJ2aWNlO1xuXG5cdHByaXZhdGUgdHJlZTogRGF0YVRyZWU8YW55LCBQcm9jZXNzVHJlZSB8IE1hY2hpbmVQcm9jZXNzSW5mb3JtYXRpb24gfCBQcm9jZXNzSXRlbSB8IFByb2Nlc3NJbmZvcm1hdGlvbiB8IElSZW1vdGVEaWFnbm9zdGljRXJyb3IsIGFueT4gfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3Iod2luZG93SWQ6IG51bWJlciwgcHJpdmF0ZSBkYXRhOiBQcm9jZXNzRXhwbG9yZXJEYXRhKSB7XG5cdFx0Y29uc3QgbWFpblByb2Nlc3NTZXJ2aWNlID0gbmV3IEVsZWN0cm9uSVBDTWFpblByb2Nlc3NTZXJ2aWNlKHdpbmRvd0lkKTtcblx0XHR0aGlzLm5hdGl2ZUhvc3RTZXJ2aWNlID0gbmV3IE5hdGl2ZUhvc3RTZXJ2aWNlKHdpbmRvd0lkLCBtYWluUHJvY2Vzc1NlcnZpY2UpIGFzIElOYXRpdmVIb3N0U2VydmljZTtcblxuXHRcdHRoaXMuYXBwbHlTdHlsZXMoZGF0YS5zdHlsZXMpO1xuXHRcdHRoaXMuc2V0RXZlbnRIYW5kbGVycyhkYXRhKTtcblxuXHRcdGlwY1JlbmRlcmVyLm9uKCd2c2NvZGU6cGlkVG9OYW1lUmVzcG9uc2UnLCAoZXZlbnQ6IHVua25vd24sIHBpZFRvTmFtZXM6IFtudW1iZXIsIHN0cmluZ11bXSkgPT4ge1xuXHRcdFx0dGhpcy5tYXBQaWRUb05hbWUuY2xlYXIoKTtcblxuXHRcdFx0Zm9yIChjb25zdCBbcGlkLCBuYW1lXSBvZiBwaWRUb05hbWVzKSB7XG5cdFx0XHRcdHRoaXMubWFwUGlkVG9OYW1lLnNldChwaWQsIG5hbWUpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0aXBjUmVuZGVyZXIub24oJ3ZzY29kZTpsaXN0UHJvY2Vzc2VzUmVzcG9uc2UnLCBhc3luYyAoZXZlbnQ6IHVua25vd24sIHByb2Nlc3NSb290czogTWFjaGluZVByb2Nlc3NJbmZvcm1hdGlvbltdKSA9PiB7XG5cdFx0XHRwcm9jZXNzUm9vdHMuZm9yRWFjaCgoaW5mbywgaW5kZXgpID0+IHtcblx0XHRcdFx0aWYgKGlzUHJvY2Vzc0l0ZW0oaW5mby5yb290UHJvY2VzcykpIHtcblx0XHRcdFx0XHRpbmZvLnJvb3RQcm9jZXNzLm5hbWUgPSBpbmRleCA9PT0gMCA/IGAke3RoaXMuZGF0YS5hcHBsaWNhdGlvbk5hbWV9IG1haW5gIDogJ3JlbW90ZSBhZ2VudCc7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAoIXRoaXMudHJlZSkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmNyZWF0ZVByb2Nlc3NUcmVlKHByb2Nlc3NSb290cyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnRyZWUuc2V0SW5wdXQoeyBwcm9jZXNzZXM6IHsgcHJvY2Vzc1Jvb3RzIH0gfSk7XG5cdFx0XHRcdHRoaXMudHJlZS5sYXlvdXQobWFpbldpbmRvdy5pbm5lckhlaWdodCwgbWFpbldpbmRvdy5pbm5lcldpZHRoKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5yZXF1ZXN0UHJvY2Vzc0xpc3QoMCk7XG5cdFx0fSk7XG5cblx0XHR0aGlzLmxhc3RSZXF1ZXN0VGltZSA9IERhdGUubm93KCk7XG5cdFx0aXBjUmVuZGVyZXIuc2VuZCgndnNjb2RlOnBpZFRvTmFtZVJlcXVlc3QnKTtcblx0XHRpcGNSZW5kZXJlci5zZW5kKCd2c2NvZGU6bGlzdFByb2Nlc3NlcycpO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRFdmVudEhhbmRsZXJzKGRhdGE6IFByb2Nlc3NFeHBsb3JlckRhdGEpOiB2b2lkIHtcblx0XHRtYWluV2luZG93LmRvY3VtZW50Lm9ua2V5ZG93biA9IChlOiBLZXlib2FyZEV2ZW50KSA9PiB7XG5cdFx0XHRjb25zdCBjbWRPckN0cmxLZXkgPSBkYXRhLnBsYXRmb3JtID09PSAnZGFyd2luJyA/IGUubWV0YUtleSA6IGUuY3RybEtleTtcblxuXHRcdFx0Ly8gQ21kL0N0cmwgKyB3IGNsb3NlcyBpc3N1ZSB3aW5kb3dcblx0XHRcdGlmIChjbWRPckN0cmxLZXkgJiYgZS5rZXlDb2RlID09PSA4Nykge1xuXHRcdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cblx0XHRcdFx0aXBjUmVuZGVyZXIuc2VuZCgndnNjb2RlOmNsb3NlUHJvY2Vzc0V4cGxvcmVyJyk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIENtZC9DdHJsICsgem9vbXMgaW5cblx0XHRcdGlmIChjbWRPckN0cmxLZXkgJiYgZS5rZXlDb2RlID09PSAxODcpIHtcblx0XHRcdFx0em9vbUluKG1haW5XaW5kb3cpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBDbWQvQ3RybCAtIHpvb21zIG91dFxuXHRcdFx0aWYgKGNtZE9yQ3RybEtleSAmJiBlLmtleUNvZGUgPT09IDE4OSkge1xuXHRcdFx0XHR6b29tT3V0KG1haW5XaW5kb3cpO1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGNyZWF0ZVByb2Nlc3NUcmVlKHByb2Nlc3NSb290czogTWFjaGluZVByb2Nlc3NJbmZvcm1hdGlvbltdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY29udGFpbmVyID0gbWFpbldpbmRvdy5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncHJvY2Vzcy1saXN0Jyk7XG5cdFx0aWYgKCFjb250YWluZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB7IHRvdGFsbWVtIH0gPSBhd2FpdCB0aGlzLm5hdGl2ZUhvc3RTZXJ2aWNlLmdldE9TU3RhdGlzdGljcygpO1xuXG5cdFx0Y29uc3QgcmVuZGVyZXJzID0gW1xuXHRcdFx0bmV3IFByb2Nlc3NSZW5kZXJlcih0aGlzLmRhdGEucGxhdGZvcm0sIHRvdGFsbWVtLCB0aGlzLm1hcFBpZFRvTmFtZSksXG5cdFx0XHRuZXcgUHJvY2Vzc0hlYWRlclRyZWVSZW5kZXJlcigpLFxuXHRcdFx0bmV3IE1hY2hpbmVSZW5kZXJlcigpLFxuXHRcdFx0bmV3IEVycm9yUmVuZGVyZXIoKVxuXHRcdF07XG5cblx0XHR0aGlzLnRyZWUgPSBuZXcgRGF0YVRyZWUoJ3Byb2Nlc3NFeHBsb3JlcicsXG5cdFx0XHRjb250YWluZXIsXG5cdFx0XHRuZXcgUHJvY2Vzc0xpc3REZWxlZ2F0ZSgpLFxuXHRcdFx0cmVuZGVyZXJzLFxuXHRcdFx0bmV3IFByb2Nlc3NUcmVlRGF0YVNvdXJjZSgpLFxuXHRcdFx0e1xuXHRcdFx0XHRpZGVudGl0eVByb3ZpZGVyOiB7XG5cdFx0XHRcdFx0Z2V0SWQ6IChlbGVtZW50OiBQcm9jZXNzVHJlZSB8IFByb2Nlc3NJdGVtIHwgTWFjaGluZVByb2Nlc3NJbmZvcm1hdGlvbiB8IFByb2Nlc3NJbmZvcm1hdGlvbiB8IElSZW1vdGVEaWFnbm9zdGljRXJyb3IpID0+IHtcblx0XHRcdFx0XHRcdGlmIChpc1Byb2Nlc3NJdGVtKGVsZW1lbnQpKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBlbGVtZW50LnBpZC50b1N0cmluZygpO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRpZiAoaXNSZW1vdGVEaWFnbm9zdGljRXJyb3IoZWxlbWVudCkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGVsZW1lbnQuaG9zdE5hbWU7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGlmIChpc1Byb2Nlc3NJbmZvcm1hdGlvbihlbGVtZW50KSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gJ3Byb2Nlc3Nlcyc7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGlmIChpc01hY2hpbmVQcm9jZXNzSW5mb3JtYXRpb24oZWxlbWVudCkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGVsZW1lbnQubmFtZTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0cmV0dXJuICdoZWFkZXInO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHR0aGlzLnRyZWUuc2V0SW5wdXQoeyBwcm9jZXNzZXM6IHsgcHJvY2Vzc1Jvb3RzIH0gfSk7XG5cdFx0dGhpcy50cmVlLmxheW91dChtYWluV2luZG93LmlubmVySGVpZ2h0LCBtYWluV2luZG93LmlubmVyV2lkdGgpO1xuXHRcdHRoaXMudHJlZS5vbktleURvd24oZSA9PiB7XG5cdFx0XHRjb25zdCBldmVudCA9IG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoZSk7XG5cdFx0XHRpZiAoZXZlbnQua2V5Q29kZSA9PT0gS2V5Q29kZS5LZXlFICYmIGV2ZW50LmFsdEtleSkge1xuXHRcdFx0XHRjb25zdCBzZWxlY3Rpb25QaWRzID0gdGhpcy5nZXRTZWxlY3RlZFBpZHMoKTtcblx0XHRcdFx0dm9pZCBQcm9taXNlLmFsbChzZWxlY3Rpb25QaWRzLm1hcCgocGlkKSA9PiB0aGlzLm5hdGl2ZUhvc3RTZXJ2aWNlLmtpbGxQcm9jZXNzKHBpZCwgJ1NJR1RFUk0nKSkpLnRoZW4oKCkgPT4gdGhpcy50cmVlPy5yZWZyZXNoKCkpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRoaXMudHJlZS5vbkNvbnRleHRNZW51KGUgPT4ge1xuXHRcdFx0aWYgKGlzUHJvY2Vzc0l0ZW0oZS5lbGVtZW50KSkge1xuXHRcdFx0XHR0aGlzLnNob3dDb250ZXh0TWVudShlLmVsZW1lbnQsIHRydWUpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29udGFpbmVyLnN0eWxlLmhlaWdodCA9IGAke21haW5XaW5kb3cuaW5uZXJIZWlnaHR9cHhgO1xuXG5cdFx0bWFpbldpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdyZXNpemUnLCAoKSA9PiB7XG5cdFx0XHRjb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gYCR7bWFpbldpbmRvdy5pbm5lckhlaWdodH1weGA7XG5cdFx0XHR0aGlzLnRyZWU/LmxheW91dChtYWluV2luZG93LmlubmVySGVpZ2h0LCBtYWluV2luZG93LmlubmVyV2lkdGgpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBpc0RlYnVnZ2FibGUoY21kOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRjb25zdCBtYXRjaGVzID0gREVCVUdfRkxBR1NfUEFUVEVSTi5leGVjKGNtZCk7XG5cdFx0cmV0dXJuIChtYXRjaGVzICYmIG1hdGNoZXMuZ3JvdXBzIS5wb3J0ICE9PSAnMCcpIHx8IGNtZC5pbmRleE9mKCdub2RlICcpID49IDAgfHwgY21kLmluZGV4T2YoJ25vZGUuZXhlJykgPj0gMDtcblx0fVxuXG5cdHByaXZhdGUgYXR0YWNoVG8oaXRlbTogUHJvY2Vzc0l0ZW0pIHtcblx0XHRjb25zdCBjb25maWc6IGFueSA9IHtcblx0XHRcdHR5cGU6ICdub2RlJyxcblx0XHRcdHJlcXVlc3Q6ICdhdHRhY2gnLFxuXHRcdFx0bmFtZTogYHByb2Nlc3MgJHtpdGVtLnBpZH1gXG5cdFx0fTtcblxuXHRcdGxldCBtYXRjaGVzID0gREVCVUdfRkxBR1NfUEFUVEVSTi5leGVjKGl0ZW0uY21kKTtcblx0XHRpZiAobWF0Y2hlcykge1xuXHRcdFx0Y29uZmlnLnBvcnQgPSBOdW1iZXIobWF0Y2hlcy5ncm91cHMhLnBvcnQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBubyBwb3J0IC0+IHRyeSB0byBhdHRhY2ggdmlhIHBpZCAoc2VuZCBTSUdVU1IxKVxuXHRcdFx0Y29uZmlnLnByb2Nlc3NJZCA9IFN0cmluZyhpdGVtLnBpZCk7XG5cdFx0fVxuXG5cdFx0Ly8gYSBkZWJ1Zy1wb3J0PW4gb3IgaW5zcGVjdC1wb3J0PW4gb3ZlcnJpZGVzIHRoZSBwb3J0XG5cdFx0bWF0Y2hlcyA9IERFQlVHX1BPUlRfUEFUVEVSTi5leGVjKGl0ZW0uY21kKTtcblx0XHRpZiAobWF0Y2hlcykge1xuXHRcdFx0Ly8gb3ZlcnJpZGUgcG9ydFxuXHRcdFx0Y29uZmlnLnBvcnQgPSBOdW1iZXIobWF0Y2hlcy5ncm91cHMhLnBvcnQpO1xuXHRcdH1cblxuXHRcdGlwY1JlbmRlcmVyLnNlbmQoJ3ZzY29kZTp3b3JrYmVuY2hDb21tYW5kJywgeyBpZDogJ2RlYnVnLnN0YXJ0RnJvbUNvbmZpZycsIGZyb206ICdwcm9jZXNzRXhwbG9yZXInLCBhcmdzOiBbY29uZmlnXSB9KTtcblx0fVxuXG5cdHByaXZhdGUgYXBwbHlTdHlsZXMoc3R5bGVzOiBQcm9jZXNzRXhwbG9yZXJTdHlsZXMpOiB2b2lkIHtcblx0XHRjb25zdCBzdHlsZUVsZW1lbnQgPSBjcmVhdGVTdHlsZVNoZWV0KCk7XG5cdFx0Y29uc3QgY29udGVudDogc3RyaW5nW10gPSBbXTtcblxuXHRcdGlmIChzdHlsZXMubGlzdEZvY3VzQmFja2dyb3VuZCkge1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLWxpc3Q6Zm9jdXMgLm1vbmFjby1saXN0LXJvdy5mb2N1c2VkIHsgYmFja2dyb3VuZC1jb2xvcjogJHtzdHlsZXMubGlzdEZvY3VzQmFja2dyb3VuZH07IH1gKTtcblx0XHRcdGNvbnRlbnQucHVzaChgLm1vbmFjby1saXN0OmZvY3VzIC5tb25hY28tbGlzdC1yb3cuZm9jdXNlZDpob3ZlciB7IGJhY2tncm91bmQtY29sb3I6ICR7c3R5bGVzLmxpc3RGb2N1c0JhY2tncm91bmR9OyB9YCk7XG5cdFx0fVxuXG5cdFx0aWYgKHN0eWxlcy5saXN0Rm9jdXNGb3JlZ3JvdW5kKSB7XG5cdFx0XHRjb250ZW50LnB1c2goYC5tb25hY28tbGlzdDpmb2N1cyAubW9uYWNvLWxpc3Qtcm93LmZvY3VzZWQgeyBjb2xvcjogJHtzdHlsZXMubGlzdEZvY3VzRm9yZWdyb3VuZH07IH1gKTtcblx0XHR9XG5cblx0XHRpZiAoc3R5bGVzLmxpc3RBY3RpdmVTZWxlY3Rpb25CYWNrZ3JvdW5kKSB7XG5cdFx0XHRjb250ZW50LnB1c2goYC5tb25hY28tbGlzdDpmb2N1cyAubW9uYWNvLWxpc3Qtcm93LnNlbGVjdGVkIHsgYmFja2dyb3VuZC1jb2xvcjogJHtzdHlsZXMubGlzdEFjdGl2ZVNlbGVjdGlvbkJhY2tncm91bmR9OyB9YCk7XG5cdFx0XHRjb250ZW50LnB1c2goYC5tb25hY28tbGlzdDpmb2N1cyAubW9uYWNvLWxpc3Qtcm93LnNlbGVjdGVkOmhvdmVyIHsgYmFja2dyb3VuZC1jb2xvcjogJHtzdHlsZXMubGlzdEFjdGl2ZVNlbGVjdGlvbkJhY2tncm91bmR9OyB9YCk7XG5cdFx0fVxuXG5cdFx0aWYgKHN0eWxlcy5saXN0QWN0aXZlU2VsZWN0aW9uRm9yZWdyb3VuZCkge1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLWxpc3Q6Zm9jdXMgLm1vbmFjby1saXN0LXJvdy5zZWxlY3RlZCB7IGNvbG9yOiAke3N0eWxlcy5saXN0QWN0aXZlU2VsZWN0aW9uRm9yZWdyb3VuZH07IH1gKTtcblx0XHR9XG5cblx0XHRpZiAoc3R5bGVzLmxpc3RIb3ZlckJhY2tncm91bmQpIHtcblx0XHRcdGNvbnRlbnQucHVzaChgLm1vbmFjby1saXN0LXJvdzpob3Zlcjpub3QoLnNlbGVjdGVkKTpub3QoLmZvY3VzZWQpIHsgYmFja2dyb3VuZC1jb2xvcjogJHtzdHlsZXMubGlzdEhvdmVyQmFja2dyb3VuZH07IH1gKTtcblx0XHR9XG5cblx0XHRpZiAoc3R5bGVzLmxpc3RIb3ZlckZvcmVncm91bmQpIHtcblx0XHRcdGNvbnRlbnQucHVzaChgLm1vbmFjby1saXN0LXJvdzpob3Zlcjpub3QoLnNlbGVjdGVkKTpub3QoLmZvY3VzZWQpIHsgY29sb3I6ICR7c3R5bGVzLmxpc3RIb3ZlckZvcmVncm91bmR9OyB9YCk7XG5cdFx0fVxuXG5cdFx0aWYgKHN0eWxlcy5saXN0Rm9jdXNPdXRsaW5lKSB7XG5cdFx0XHRjb250ZW50LnB1c2goYC5tb25hY28tbGlzdDpmb2N1cyAubW9uYWNvLWxpc3Qtcm93LmZvY3VzZWQgeyBvdXRsaW5lOiAxcHggc29saWQgJHtzdHlsZXMubGlzdEZvY3VzT3V0bGluZX07IG91dGxpbmUtb2Zmc2V0OiAtMXB4OyB9YCk7XG5cdFx0fVxuXG5cdFx0aWYgKHN0eWxlcy5saXN0SG92ZXJPdXRsaW5lKSB7XG5cdFx0XHRjb250ZW50LnB1c2goYC5tb25hY28tbGlzdC1yb3c6aG92ZXIgeyBvdXRsaW5lOiAxcHggZGFzaGVkICR7c3R5bGVzLmxpc3RIb3Zlck91dGxpbmV9OyBvdXRsaW5lLW9mZnNldDogLTFweDsgfWApO1xuXHRcdH1cblxuXHRcdC8vIFNjcm9sbGJhcnNcblx0XHRpZiAoc3R5bGVzLnNjcm9sbGJhclNoYWRvd0NvbG9yKSB7XG5cdFx0XHRjb250ZW50LnB1c2goYFxuXHRcdFx0XHQubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5zaGFkb3cudG9wIHtcblx0XHRcdFx0XHRib3gtc2hhZG93OiAke3N0eWxlcy5zY3JvbGxiYXJTaGFkb3dDb2xvcn0gMCA2cHggNnB4IC02cHggaW5zZXQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5zaGFkb3cubGVmdCB7XG5cdFx0XHRcdFx0Ym94LXNoYWRvdzogJHtzdHlsZXMuc2Nyb2xsYmFyU2hhZG93Q29sb3J9IDZweCAwIDZweCAtNnB4IGluc2V0O1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Lm1vbmFjby1zY3JvbGxhYmxlLWVsZW1lbnQgPiAuc2hhZG93LnRvcC5sZWZ0IHtcblx0XHRcdFx0XHRib3gtc2hhZG93OiAke3N0eWxlcy5zY3JvbGxiYXJTaGFkb3dDb2xvcn0gNnB4IDZweCA2cHggLTZweCBpbnNldDtcblx0XHRcdFx0fVxuXHRcdFx0YCk7XG5cdFx0fVxuXG5cdFx0aWYgKHN0eWxlcy5zY3JvbGxiYXJTbGlkZXJCYWNrZ3JvdW5kQ29sb3IpIHtcblx0XHRcdGNvbnRlbnQucHVzaChgXG5cdFx0XHRcdC5tb25hY28tc2Nyb2xsYWJsZS1lbGVtZW50ID4gLnNjcm9sbGJhciA+IC5zbGlkZXIge1xuXHRcdFx0XHRcdGJhY2tncm91bmQ6ICR7c3R5bGVzLnNjcm9sbGJhclNsaWRlckJhY2tncm91bmRDb2xvcn07XG5cdFx0XHRcdH1cblx0XHRcdGApO1xuXHRcdH1cblxuXHRcdGlmIChzdHlsZXMuc2Nyb2xsYmFyU2xpZGVySG92ZXJCYWNrZ3JvdW5kQ29sb3IpIHtcblx0XHRcdGNvbnRlbnQucHVzaChgXG5cdFx0XHRcdC5tb25hY28tc2Nyb2xsYWJsZS1lbGVtZW50ID4gLnNjcm9sbGJhciA+IC5zbGlkZXI6aG92ZXIge1xuXHRcdFx0XHRcdGJhY2tncm91bmQ6ICR7c3R5bGVzLnNjcm9sbGJhclNsaWRlckhvdmVyQmFja2dyb3VuZENvbG9yfTtcblx0XHRcdFx0fVxuXHRcdFx0YCk7XG5cdFx0fVxuXG5cdFx0aWYgKHN0eWxlcy5zY3JvbGxiYXJTbGlkZXJBY3RpdmVCYWNrZ3JvdW5kQ29sb3IpIHtcblx0XHRcdGNvbnRlbnQucHVzaChgXG5cdFx0XHRcdC5tb25hY28tc2Nyb2xsYWJsZS1lbGVtZW50ID4gLnNjcm9sbGJhciA+IC5zbGlkZXIuYWN0aXZlIHtcblx0XHRcdFx0XHRiYWNrZ3JvdW5kOiAke3N0eWxlcy5zY3JvbGxiYXJTbGlkZXJBY3RpdmVCYWNrZ3JvdW5kQ29sb3J9O1xuXHRcdFx0XHR9XG5cdFx0XHRgKTtcblx0XHR9XG5cblx0XHRzdHlsZUVsZW1lbnQudGV4dENvbnRlbnQgPSBjb250ZW50LmpvaW4oJ1xcbicpO1xuXG5cdFx0aWYgKHN0eWxlcy5jb2xvcikge1xuXHRcdFx0bWFpbldpbmRvdy5kb2N1bWVudC5ib2R5LnN0eWxlLmNvbG9yID0gc3R5bGVzLmNvbG9yO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc2hvd0NvbnRleHRNZW51KGl0ZW06IFByb2Nlc3NJdGVtLCBpc0xvY2FsOiBib29sZWFuKSB7XG5cdFx0Y29uc3QgaXRlbXM6IElDb250ZXh0TWVudUl0ZW1bXSA9IFtdO1xuXHRcdGNvbnN0IHBpZCA9IE51bWJlcihpdGVtLnBpZCk7XG5cblx0XHRpZiAoaXNMb2NhbCkge1xuXHRcdFx0aXRlbXMucHVzaCh7XG5cdFx0XHRcdGFjY2VsZXJhdG9yOiAnQWx0K0UnLFxuXHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ2tpbGxQcm9jZXNzJywgXCJLaWxsIFByb2Nlc3NcIiksXG5cdFx0XHRcdGNsaWNrOiAoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5uYXRpdmVIb3N0U2VydmljZS5raWxsUHJvY2VzcyhwaWQsICdTSUdURVJNJyk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRpdGVtcy5wdXNoKHtcblx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdmb3JjZUtpbGxQcm9jZXNzJywgXCJGb3JjZSBLaWxsIFByb2Nlc3NcIiksXG5cdFx0XHRcdGNsaWNrOiAoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5uYXRpdmVIb3N0U2VydmljZS5raWxsUHJvY2VzcyhwaWQsICdTSUdLSUxMJyk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRpdGVtcy5wdXNoKHtcblx0XHRcdFx0dHlwZTogJ3NlcGFyYXRvcidcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGl0ZW1zLnB1c2goe1xuXHRcdFx0bGFiZWw6IGxvY2FsaXplKCdjb3B5JywgXCJDb3B5XCIpLFxuXHRcdFx0Y2xpY2s6ICgpID0+IHtcblx0XHRcdFx0Ly8gQ29sbGVjdCB0aGUgc2VsZWN0ZWQgcGlkc1xuXHRcdFx0XHRjb25zdCBzZWxlY3Rpb25QaWRzID0gdGhpcy5nZXRTZWxlY3RlZFBpZHMoKTtcblx0XHRcdFx0Ly8gSWYgdGhlIHNlbGVjdGlvbiBkb2VzIG5vdCBjb250YWluIHRoZSByaWdodCBjbGlja2VkIGl0ZW0sIGNvcHkgdGhlIHJpZ2h0IGNsaWNrZWRcblx0XHRcdFx0Ly8gaXRlbSBvbmx5LlxuXHRcdFx0XHRpZiAoIXNlbGVjdGlvblBpZHM/LmluY2x1ZGVzKHBpZCkpIHtcblx0XHRcdFx0XHRzZWxlY3Rpb25QaWRzLmxlbmd0aCA9IDA7XG5cdFx0XHRcdFx0c2VsZWN0aW9uUGlkcy5wdXNoKHBpZCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3Qgcm93cyA9IHNlbGVjdGlvblBpZHM/Lm1hcChlID0+IG1haW5XaW5kb3cuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYHBpZC0ke2V9YCkpLmZpbHRlcihlID0+ICEhZSkgYXMgSFRNTEVsZW1lbnRbXTtcblx0XHRcdFx0aWYgKHJvd3MpIHtcblx0XHRcdFx0XHRjb25zdCB0ZXh0ID0gcm93cy5tYXAoZSA9PiBlLmlubmVyVGV4dCkuZmlsdGVyKGUgPT4gISFlKSBhcyBzdHJpbmdbXTtcblx0XHRcdFx0XHR0aGlzLm5hdGl2ZUhvc3RTZXJ2aWNlLndyaXRlQ2xpcGJvYXJkVGV4dCh0ZXh0LmpvaW4oJ1xcbicpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0aXRlbXMucHVzaCh7XG5cdFx0XHRsYWJlbDogbG9jYWxpemUoJ2NvcHlBbGwnLCBcIkNvcHkgQWxsXCIpLFxuXHRcdFx0Y2xpY2s6ICgpID0+IHtcblx0XHRcdFx0Y29uc3QgcHJvY2Vzc0xpc3QgPSBtYWluV2luZG93LmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwcm9jZXNzLWxpc3QnKTtcblx0XHRcdFx0aWYgKHByb2Nlc3NMaXN0KSB7XG5cdFx0XHRcdFx0dGhpcy5uYXRpdmVIb3N0U2VydmljZS53cml0ZUNsaXBib2FyZFRleHQocHJvY2Vzc0xpc3QuaW5uZXJUZXh0KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0aWYgKGl0ZW0gJiYgaXNMb2NhbCAmJiB0aGlzLmlzRGVidWdnYWJsZShpdGVtLmNtZCkpIHtcblx0XHRcdGl0ZW1zLnB1c2goe1xuXHRcdFx0XHR0eXBlOiAnc2VwYXJhdG9yJ1xuXHRcdFx0fSk7XG5cblx0XHRcdGl0ZW1zLnB1c2goe1xuXHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ2RlYnVnJywgXCJEZWJ1Z1wiKSxcblx0XHRcdFx0Y2xpY2s6ICgpID0+IHtcblx0XHRcdFx0XHR0aGlzLmF0dGFjaFRvKGl0ZW0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRwb3B1cChpdGVtcyk7XG5cdH1cblxuXHRwcml2YXRlIHJlcXVlc3RQcm9jZXNzTGlzdCh0b3RhbFdhaXRUaW1lOiBudW1iZXIpOiB2b2lkIHtcblx0XHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdGNvbnN0IG5leHRSZXF1ZXN0VGltZSA9IERhdGUubm93KCk7XG5cdFx0XHRjb25zdCB3YWl0ZWQgPSB0b3RhbFdhaXRUaW1lICsgbmV4dFJlcXVlc3RUaW1lIC0gdGhpcy5sYXN0UmVxdWVzdFRpbWU7XG5cdFx0XHR0aGlzLmxhc3RSZXF1ZXN0VGltZSA9IG5leHRSZXF1ZXN0VGltZTtcblxuXHRcdFx0Ly8gV2FpdCBhdCBsZWFzdCBhIHNlY29uZCBiZXR3ZWVuIHJlcXVlc3RzLlxuXHRcdFx0aWYgKHdhaXRlZCA+IDEwMDApIHtcblx0XHRcdFx0aXBjUmVuZGVyZXIuc2VuZCgndnNjb2RlOnBpZFRvTmFtZVJlcXVlc3QnKTtcblx0XHRcdFx0aXBjUmVuZGVyZXIuc2VuZCgndnNjb2RlOmxpc3RQcm9jZXNzZXMnKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMucmVxdWVzdFByb2Nlc3NMaXN0KHdhaXRlZCk7XG5cdFx0XHR9XG5cdFx0fSwgMjAwKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0U2VsZWN0ZWRQaWRzKCkge1xuXHRcdHJldHVybiB0aGlzLnRyZWU/LmdldFNlbGVjdGlvbigpPy5tYXAoZSA9PiB7XG5cdFx0XHRpZiAoIWUgfHwgISgncGlkJyBpbiBlKSkge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGUucGlkO1xuXHRcdH0pLmZpbHRlcihlID0+ICEhZSkgYXMgbnVtYmVyW107XG5cdH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlQ29kaWNvblN0eWxlU2hlZXQoKSB7XG5cdGNvbnN0IGNvZGljb25TdHlsZVNoZWV0ID0gY3JlYXRlU3R5bGVTaGVldCgpO1xuXHRjb2RpY29uU3R5bGVTaGVldC5pZCA9ICdjb2RpY29uU3R5bGVzJztcblxuXHRjb25zdCBpY29uc1N0eWxlU2hlZXQgPSBnZXRJY29uc1N0eWxlU2hlZXQodW5kZWZpbmVkKTtcblx0ZnVuY3Rpb24gdXBkYXRlQWxsKCkge1xuXHRcdGNvZGljb25TdHlsZVNoZWV0LnRleHRDb250ZW50ID0gaWNvbnNTdHlsZVNoZWV0LmdldENTUygpO1xuXHR9XG5cblx0Y29uc3QgZGVsYXllciA9IG5ldyBSdW5PbmNlU2NoZWR1bGVyKHVwZGF0ZUFsbCwgMCk7XG5cdGljb25zU3R5bGVTaGVldC5vbkRpZENoYW5nZSgoKSA9PiBkZWxheWVyLnNjaGVkdWxlKCkpO1xuXHRkZWxheWVyLnNjaGVkdWxlKCk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVByb2Nlc3NFeHBsb3Jlck1haW4ge1xuXHRzdGFydHVwKGNvbmZpZ3VyYXRpb246IFByb2Nlc3NFeHBsb3JlcldpbmRvd0NvbmZpZ3VyYXRpb24pOiB2b2lkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3RhcnR1cChjb25maWd1cmF0aW9uOiBQcm9jZXNzRXhwbG9yZXJXaW5kb3dDb25maWd1cmF0aW9uKTogdm9pZCB7XG5cdGNvbnN0IHBsYXRmb3JtQ2xhc3MgPSBjb25maWd1cmF0aW9uLmRhdGEucGxhdGZvcm0gPT09ICd3aW4zMicgPyAnd2luZG93cycgOiBjb25maWd1cmF0aW9uLmRhdGEucGxhdGZvcm0gPT09ICdsaW51eCcgPyAnbGludXgnIDogJ21hYyc7XG5cdG1haW5XaW5kb3cuZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QuYWRkKHBsYXRmb3JtQ2xhc3MpOyAvLyB1c2VkIGJ5IG91ciBmb250c1xuXHRjcmVhdGVDb2RpY29uU3R5bGVTaGVldCgpO1xuXHRhcHBseVpvb20oY29uZmlndXJhdGlvbi5kYXRhLnpvb21MZXZlbCwgbWFpbldpbmRvdyk7XG5cblx0bmV3IFByb2Nlc3NFeHBsb3Jlcihjb25maWd1cmF0aW9uLndpbmRvd0lkLCBjb25maWd1cmF0aW9uLmRhdGEpO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTztBQUNQLE9BQU87QUFDUCxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLEdBQUcsY0FBYztBQUMxQixTQUFTLHdCQUF3QjtBQUVqQyxTQUFTLGdCQUFnQjtBQUV6QixTQUFTLHdCQUF3QjtBQUdqQyxTQUFTLGFBQWE7QUFDdEIsU0FBUyxtQkFBbUI7QUFDNUIsU0FBaUMsK0JBQStCO0FBQ2hFLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMscUNBQXFDO0FBRzlDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsV0FBVyxRQUFRLGVBQWU7QUFDM0MsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsa0JBQWtCO0FBRTNCLE1BQU0sc0JBQXNCO0FBQzVCLE1BQU0scUJBQXFCO0FBRTNCLE1BQU0sb0JBQXNIO0FBQUEsRUFDM0gsVUFBVSxTQUEyRTtBQUNwRixXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsY0FBYyxTQUFnRztBQUM3RyxRQUFJLGNBQWMsT0FBTyxHQUFHO0FBQzNCLGFBQU87QUFBQSxJQUNSO0FBRUEsUUFBSSw0QkFBNEIsT0FBTyxHQUFHO0FBQ3pDLGFBQU87QUFBQSxJQUNSO0FBRUEsUUFBSSx3QkFBd0IsT0FBTyxHQUFHO0FBQ3JDLGFBQU87QUFBQSxJQUNSO0FBRUEsUUFBSSxxQkFBcUIsT0FBTyxHQUFHO0FBQ2xDLGFBQU87QUFBQSxJQUNSO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFDRDtBQVlBLE1BQU0sc0JBQWlKO0FBQUEsRUFDdEosWUFBWSxTQUF1SDtBQUNsSSxRQUFJLHdCQUF3QixPQUFPLEdBQUc7QUFDckMsYUFB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
