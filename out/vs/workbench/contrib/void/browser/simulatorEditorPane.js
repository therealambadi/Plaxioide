var __defProp = Object.defineProperty;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? Object.getOwnPropertyDescriptor(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { EditorPane } from "../../../browser/parts/editor/editorPane.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { toDisposable } from "../../../../base/common/lifecycle.js";

const PLAXIO_SIM_PORT = 1881;
const PLAXIO_SIM_BASE = `http://127.0.0.1:${PLAXIO_SIM_PORT}`;
const FUXA_EDITOR_URL = `${PLAXIO_SIM_BASE}/editor`;
const FUXA_SIMULATION_URL = `${PLAXIO_SIM_BASE}/`;

let SimulatorEditorPane = class extends EditorPane {
  constructor(group, telemetryService, themeService, storageService, fileService) {
    super(SimulatorEditorPane.ID, group, telemetryService, themeService, storageService);
    this._container = void 0;
    this._frame = void 0;
    this._overlay = void 0;
    this._mode = "simulation";
    this._viewName = void 0;
    this.fileService = fileService;
  }

  // Called by SimulatorToggleContribution to switch modes
  setMode(mode) {
    if (this._mode === mode) return;
    this._mode = mode;
    if (this._overlay) this._overlay.style.display = "flex";
    this._loadFuxa();
  }

  getMode() { return this._mode; }

  createEditor(parent) {
    parent.style.cssText = "display:flex;flex-direction:column;height:100%;overflow:hidden;background:var(--vscode-editor-background);";
    const onThemeRequest = (event) => {
      if (event.data?.type === "volt:request-theme" && event.source === this._frame?.contentWindow) {
        this._sendThemeTokens();
      }
    };
    window.addEventListener("message", onThemeRequest);
    this._register(toDisposable(() => window.removeEventListener("message", onThemeRequest)));

    // Loading overlay
    const overlay = document.createElement("div");
    overlay.style.cssText = [
      "position:absolute", "inset:0", "display:flex", "align-items:center",
      "justify-content:center", "background:var(--vscode-editor-background)", "color:var(--vscode-editor-foreground)",
      "font-size:13px", "z-index:10", "flex-direction:column", "gap:8px",
    ].join(";");
    overlay.textContent = "Loading Plaxio Simulator...";
    this._overlay = overlay;

    // iframe — fills full pane
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:absolute;inset:0;border:none;width:100%;height:100%;background:var(--vscode-editor-background);";
    frame.allow = "clipboard-read; clipboard-write";

    const wrapper = document.createElement("div");
    wrapper.style.cssText = "flex:1;position:relative;overflow:hidden;";
    wrapper.appendChild(overlay);
    wrapper.appendChild(frame);
    this._frame = frame;
    this._container = wrapper;
    parent.appendChild(wrapper);

    this._loadFuxa();

    this._register(toDisposable(() => {
      if (this._frame) {
        this._frame.src = "about:blank";
        this._frame = void 0;
      }
    }));
  }

  _loadFuxa() {
    if (!this._frame) return;
    const simUrl = this._viewName
      ? `http://127.0.0.1:1881/home/${encodeURIComponent(this._viewName)}`
      : FUXA_SIMULATION_URL;
    const url = this._mode === "editor" ? FUXA_EDITOR_URL : simUrl;

    const pollReady = (elapsed) => {
      if (!this._frame) return;
      if (elapsed >= 30000) {
        if (this._overlay) {
          this._overlay.textContent = "Plaxio Simulator failed to start (timeout after 30s)";
          this._overlay.style.display = "";
        }
        return;
      }
      fetch(`${PLAXIO_SIM_BASE}/api/project`, { method: "HEAD" }).then(() => {
        this._setFrameSrc(url);
      }).catch(() => {
        setTimeout(() => pollReady(elapsed + 200), 200);
      });
    };
    pollReady(0);
  }
  _setFrameSrc(url) {
    if (!this._frame) return;
    this._frame.onload = () => {
      if (this._overlay) this._overlay.style.display = "none";
      this._sendThemeTokens();
      if (this._viewName) {
        setTimeout(() => this._postSelectView(this._viewName), 600);
      }
    };
    this._frame.onerror = () => {
      if (this._overlay) this._overlay.textContent = "Plaxio Simulator not ready — retrying...";
      setTimeout(() => this._loadFuxa(), 2000);
    };
    this._frame.src = url;
  }

  _postSelectView(viewName) {
    if (!this._frame?.contentWindow || !viewName) return;
    // Single message: reload project then select view — avoids race where select fires before reload completes
    this._frame.contentWindow.postMessage({ type: "volt:reload-and-select", viewName }, "*");
  }

  _sendThemeTokens() {
    if (!this._frame || !this._frame.contentWindow) return;
    const workbench = document.querySelector(".monaco-workbench");
    const styleSources = [workbench, document.body, document.documentElement].filter((node) => !!node).map(getComputedStyle);
    const vars = [
      '--vscode-sideBar-background', '--vscode-sideBar-foreground', '--vscode-sideBar-border',
      '--vscode-editorGroupHeader-tabsBackground', '--vscode-titleBar-activeBackground', '--vscode-titleBar-activeForeground', '--vscode-titleBar-border',
      '--vscode-button-background', '--vscode-button-foreground',
      '--vscode-input-background', '--vscode-input-foreground', '--vscode-focusBorder',
      '--vscode-panel-border', '--vscode-statusBar-background', '--vscode-statusBar-hoverBackground', '--vscode-statusBar-foreground',
      '--vscode-scrollbarSlider-background', '--vscode-scrollbarSlider-hoverBackground', '--vscode-badge-background',
      '--vscode-editor-background', '--vscode-editorWidget-background', '--vscode-menu-background', '--vscode-menu-foreground',
    ];
    const tokens = {};
    for (const v of vars) {
      const val = styleSources.map((styles) => styles.getPropertyValue(v).trim()).find(Boolean);
      if (val) tokens[v] = val;
    }
    this._frame.contentWindow.postMessage({ type: 'volt:theme-tokens', tokens }, '*');
  }

  async setInput(input, options, context, token) {
    await super.setInput(input, options, context, token);
    this._mode = "simulation";
    this._viewName = void 0;
    console.log("[SimulatorEditorPane] setInput isFileBacked=" + input.isFileBacked + " resource=" + input.resource?.toString());
    if (input.isFileBacked && input.resource?.scheme === "file") {
      // Show loading overlay while we read + push the file
      if (this._overlay) { this._overlay.textContent = "Loading simulation..."; this._overlay.style.display = "flex"; }
      this._loadHmiFileIntoFuxa(input.resource).catch((e) => {
        console.error("[SimulatorEditorPane] Failed to load HMI file into FUXA:", e);
        // Fall back to showing the default simulation view
        this._loadFuxa();
      });
    } else {
      // Generic virtual simulator — just load the runtime root
      this._loadFuxa();
    }
  }

  async _loadHmiFileIntoFuxa(resource) {
    // Read file as raw bytes via fetch — avoids JS string encoding issues with SVG content
    let rawText;
    try {
      const fileContent = await this.fileService.readFile(resource);
      rawText = fileContent.value.toString();
    } catch (e) {
      console.error("[SimulatorEditorPane] readFile failed:", e);
      this._loadFuxa();
      return;
    }

    // Extract view name without JSON.parse — avoids failure on SVG control chars
    // File format: { "devices": {...}, "hmi": { "views": [{ "id": "...", "name": "...", ... }] } }
    // OR bare view: { "name": "...", "svgcontent": "..." }
    let viewName = null;
    const isFullProject = rawText.includes('"hmi"') || rawText.includes('"devices"');
    if (isFullProject) {
      // Navigate to the first view object inside hmi.views and extract its name
      const hmiIdx = rawText.indexOf('"hmi"');
      const viewsIdx = rawText.indexOf('"views"', hmiIdx);
      const firstBrace = rawText.indexOf('{', rawText.indexOf('[', viewsIdx));
      const nameIdx = rawText.indexOf('"name"', firstBrace);
      if (nameIdx !== -1) {
        const colon = rawText.indexOf(':', nameIdx);
        const valStart = rawText.indexOf('"', colon + 1);
        const valEnd = rawText.indexOf('"', valStart + 1);
        if (valStart !== -1 && valEnd !== -1) viewName = rawText.slice(valStart + 1, valEnd);
      }
    } else {
      const m = rawText.match(/"name"\s*:\s*"([^"]+)"/);
      if (m) viewName = m[1];
    }

    if (!viewName) {
      console.error("[SimulatorEditorPane] Could not extract view name from file");
      this._loadFuxa();
      return;
    }

    // Validate JSON before sending — FUXA's Express body-parser will reject invalid JSON with 400
    let parsedProject;
    try {
      parsedProject = JSON.parse(rawText);
    } catch (e) {
      console.error("[SimulatorEditorPane] HMI file is not valid JSON:", e.message);
      this._loadFuxa();
      return;
    }
    // Ensure hmi.layout.navigation exists — FUXA Angular crashes with TypeError if missing
    if (parsedProject.hmi) {
      if (!parsedProject.hmi.layout) parsedProject.hmi.layout = {};
      parsedProject.hmi.layout.navigation = { mode: "void", items: [], logo: false, title: "" };
      // Force white background on all views — dark colors from AI-generated HMI look broken
      if (Array.isArray(parsedProject.hmi.views)) {
        for (const view of parsedProject.hmi.views) {
          if (!view.profile) view.profile = {};
          if (!view.profile.bkcolor || view.profile.bkcolor === '#000000' || /^#(?:[01][0-9a-f]){3}$/i.test(view.profile.bkcolor)) {
            view.profile.bkcolor = '#ffffff';
          }
        }
      }
      // Normalize view items — strip nulls, add missing property objects
      // FUXA applyVariableMapping crashes on null items or items without property
      if (Array.isArray(parsedProject.hmi.views)) {
        for (const view of parsedProject.hmi.views) {
          if (Array.isArray(view.items)) {
            view.items = view.items.filter(item => item !== null && item !== undefined);
            for (const item of view.items) {
              if (typeof item === "object" && !item.property) item.property = {};
            }
          } else if (view.items && typeof view.items === "object") {
            for (const key of Object.keys(view.items)) {
              if (!view.items[key]) { delete view.items[key]; continue; }
              if (!view.items[key].property) view.items[key].property = {};
            }
          }
        }
      }
    }
    // POST the parsed+re-serialized JSON to ensure it is valid
    const postRes = await fetch("http://127.0.0.1:1881/api/project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsedProject),
    });
    if (!postRes.ok) {
      const errText = await postRes.text().catch(() => "");
      console.error("[SimulatorEditorPane] POST /api/project failed:", postRes.status, errText);
      this._loadFuxa();
      return;
    }
    // POST /api/project only saves to SQLite — the device runtime still has old data in memory.
    // We must call POST /api/projectData with cmd="set-device" for each device to reload the
    // FuxaServer runtime instance with the new tags via devices.updateDevice().
    const deviceList = Object.values(parsedProject.devices || {});
    for (const device of deviceList) {
      try {
        await fetch("http://127.0.0.1:1881/api/projectData", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cmd: "set-device", data: device }),
        });
      } catch (e) {
        console.warn("[SimulatorEditorPane] projectData set-device failed:", e);
      }
    }
    console.log("[SimulatorEditorPane] Loaded view:", viewName);
    this._viewName = viewName;
    const frame = this._frame;
    if (frame?.contentWindow && frame.src && !frame.src.startsWith("about:")) {
      if (this._overlay) this._overlay.style.display = "none";
      this._postSelectView(viewName);
    } else {
      this._loadFuxa();
    }
  }

  layout(dimension) {
    if (this._container) {
      this._container.style.width = dimension.width + "px";
      this._container.style.height = dimension.height + "px";
    }
  }
};
SimulatorEditorPane.ID = "workbench.editor.plcSimulatorEditor";
SimulatorEditorPane = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IFileService),
], SimulatorEditorPane);
export { SimulatorEditorPane };
