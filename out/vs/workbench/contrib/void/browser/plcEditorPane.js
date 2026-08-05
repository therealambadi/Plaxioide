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
import { Registry } from "../../../../platform/registry/common/platform.js";
import {
  Extensions as ViewContainerExtensions,
  ViewContainerLocation,
  Extensions as ViewExtensions,
  IViewDescriptorService
} from "../../../common/views.js";
import { ViewPane } from "../../../browser/parts/views/viewPane.js";
import { ViewPaneContainer } from "../../../browser/parts/views/viewPaneContainer.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { Codicon } from "../../../../base/common/codicons.js";
import * as nls from "../../../../nls.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { toDisposable, Disposable } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IPaneCompositePartService } from "../../../services/panecomposite/browser/panecomposite.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import { IWorkbenchLayoutService, Parts } from "../../../services/layout/browser/layoutService.js";
import { mountPlcEditor, mountTagMonitor, mountVerifyPanel } from "./react/out/plc-editor-tsx/index.js";
import { ipcRenderer } from "../../../../base/parts/sandbox/electron-sandbox/globals.js";
import { EditorPaneDescriptor } from "../../../browser/editor.js";
import { EditorExtensions } from "../../../common/editor.js";
import { IEditorResolverService, RegisteredEditorPriority } from "../../../services/editor/common/editorResolverService.js";
import { LogicEditorInput } from "./logicEditorInput.js";
import { LogicEditorPane } from "./logicEditorPane.js";
import { mountPlcNavigator } from "./react/out/plc-editor-tsx/index.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
(function initPLCPanel() {
  const STYLE_ID = "plc-panel-style";
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
			#workbench\\.parts\\.panel .composite-bar-container,
			#workbench\\.parts\\.panel .composite-bar { display: none !important; }
			#workbench\\.parts\\.panel .content > .composite,
			#workbench\\.parts\\.panel .content > .view-instance,
			#workbench\\.parts\\.panel .content > .split-view-container { display: none !important; }
			#workbench\\.parts\\.panel .title .title-label { display: none !important; }
		`;
    if (document.head) {
      document.head.appendChild(style);
    } else {
      document.addEventListener("DOMContentLoaded", () => document.head.appendChild(style), { once: true });
    }
  }
  const TABS = [
    { id: "tag-monitor", label: "Tag Monitor" },
    { id: "verify", label: "Verify" }
  ];
  function tryInject() {
    const panelPart = document.getElementById("workbench.parts.panel");
    if (!panelPart) { console.log("[PLCPanel] tryInject: no panelPart yet"); return false; }
    const compositeTitle = panelPart.querySelector(".composite.title");
    if (!compositeTitle) { console.log("[PLCPanel] tryInject: panelPart found but no .composite.title yet"); return false; }
    if (panelPart.querySelector(".plc-panel-tabs")) { console.log("[PLCPanel] tryInject: already injected"); return true; }
    console.log("[PLCPanel] tryInject: injecting tabs now");
    panelPart.style.position = "relative";
    const tabHosts = {};
    TABS.forEach((tab) => {
      const host = document.createElement("div");
      host.className = "plc-panel-content";
      host.dataset.tabContent = tab.id;
      host.style.cssText = [
        "position:absolute",
        "left:0",
        "right:0",
        "bottom:0",
        "top:35px",
        "overflow:hidden",
        "z-index:10",
        "display:none",
        "background:var(--vscode-panel-background,var(--vscode-editor-background))"
      ].join(";");
      panelPart.appendChild(host);
      tabHosts[tab.id] = host;
    });
    mountTagMonitor(tabHosts["tag-monitor"]);
    mountVerifyPanel(tabHosts["verify"]);
    const tabBar = document.createElement("div");
    tabBar.className = "plc-panel-tabs";
    tabBar.style.cssText = "display:flex;align-items:stretch;height:100%;overflow:hidden;";
    let activeTab = "console";
    const showTab = (id) => {
      activeTab = id;
      TABS.forEach((t) => {
        tabHosts[t.id].style.display = t.id === id ? "block" : "none";
      });
      tabBar.querySelectorAll(".plc-tab").forEach((btn) => {
        const isActive = btn.dataset.tab === id;
        btn.style.color = isActive ? "var(--vscode-panelTitle-activeForeground,var(--vscode-foreground))" : "var(--vscode-panelTitle-inactiveForeground,var(--vscode-descriptionForeground))";
        btn.style.borderTop = isActive ? "1px solid var(--vscode-panelTitle-activeBorder,var(--vscode-focusBorder))" : "1px solid transparent";
        btn.style.fontWeight = isActive ? "600" : "400";
      });
    };
    TABS.forEach((tab) => {
      const btn = document.createElement("div");
      btn.className = "plc-tab";
      btn.dataset.tab = tab.id;
      btn.textContent = tab.label;
      btn.style.cssText = [
        "display:flex",
        "align-items:center",
        "padding:0 12px",
        "cursor:pointer",
        "font-size:12px",
        "user-select:none",
        "border-top:1px solid transparent",
        "box-sizing:border-box",
        "color:var(--vscode-panelTitle-inactiveForeground,var(--vscode-descriptionForeground))"
      ].join(";");
      btn.addEventListener("click", () => showTab(tab.id));
      tabBar.appendChild(btn);
    });
    compositeTitle.appendChild(tabBar);
    showTab("tag-monitor");
    console.log("[PLCPanel] Verify tab injected successfully");
    return true;
  }
  if (!tryInject()) {
    console.log("[PLCPanel] Deferred — waiting for panel DOM via MutationObserver");
    const obs = new MutationObserver(() => {
      if (tryInject()) obs.disconnect();
    });
    obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }
})();
(function initVerificationHandler() {
  // Use ipcRenderer.invoke() to call main-process handlers registered in app.js
  const handler = async (event) => {
    const data = event.data;
    if (!data || typeof data.type !== "string") return;
    if (data.type === "plaxio:verify-check-engine") {
      try {
        const result = await ipcRenderer.invoke("vscode:plaxio-verify-check-engine");
        window.postMessage({ type: "plaxio:verify-engine-status", available: result.available, version: result.version, binaryPath: result.binaryPath, mode: result.mode, downloadable: result.downloadable }, "*");
      } catch (err) {
        console.error("[Verify] engine check error:", err);
        window.postMessage({ type: "plaxio:verify-engine-status", available: false, downloadable: true }, "*");
      }
    }
    if (data.type === "plaxio:verify-download-engine") {
      try {
        const result = await ipcRenderer.invoke("vscode:plaxio-verify-download-engine");
        window.postMessage({ type: "plaxio:verify-engine-status", available: result.available, version: result.version, binaryPath: result.binaryPath, mode: result.mode, downloadable: false }, "*");
      } catch (err) {
        window.postMessage({ type: "plaxio:verify-download-error", message: err?.message ?? String(err) }, "*");
      }
    }
    if (data.type === "plaxio:verify-run") {
      try {
        const result = await ipcRenderer.invoke("vscode:plaxio-verify-run", { runId: data.runId, instrumentedST: data.instrumentedST, propertyIds: data.propertyIds, timeoutMs: data.config.timeoutMs, kInductionDepth: data.config.kInductionDepth, mode: data.config.mode, binaryPath: data.config.binaryPath });
        window.postMessage({ type: "plaxio:verify-result", ...result }, "*");
      } catch (err) {
        window.postMessage({ type: "plaxio:verify-error", runId: data.runId, message: err?.message ?? String(err) }, "*");
      }
    }
    if (data.type === "plaxio:verify-cancel") {
      try { ipcRenderer.invoke("vscode:plaxio-verify-cancel", { runId: data.runId }); } catch {}
    }
  };
  window.addEventListener("message", handler);
})();
(function initPlaxioTitleLogo() {
  const style = document.createElement("style");
  style.textContent = `
    .command-center .command-center-center .action-label * { display: none !important; }
    .command-center .command-center-center .action-label::before { display: none !important; }
    .command-center .command-center-center .action-label::after {
      content: "Plaxio";
      display: inline !important;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.04em;
      opacity: 0.85;
    }
    .command-center .command-center-center .action-label:hover::after { opacity: 1; }
    .command-center .command-center-center { border: none !important; background: transparent !important; min-width: 80px !important; }
    .command-center { border: none !important; background: transparent !important; box-shadow: none !important; }
    .command-center .left, .command-center .right { display: none !important; }
    .titlebar-nav-container .monaco-action-bar { display: none !important; }
  `;
  if (document.head) document.head.appendChild(style);
  else document.addEventListener("DOMContentLoaded", () => document.head.appendChild(style), { once: true });
})();
const PLC_VIEW_CONTAINER_ID = "workbench.view.plcEditor";
const PLC_NAVIGATOR_VIEW_ID = "workbench.view.plcNavigator";
const VOID_OPEN_PLC_EDITOR_ACTION_ID = "void.openPlcEditor";
Registry.as(EditorExtensions.EditorPane).registerEditorPane(
  EditorPaneDescriptor.create(
    LogicEditorPane,
    LogicEditorPane.ID,
    nls.localize("plcLogicEditor", "PLC Logic Editor")
  ),
  [new SyncDescriptor(LogicEditorInput)]
);
class LogicEditorInputSerializer {
  canSerialize(_input) {
    return true;
  }
  serialize(_input) {
    return JSON.stringify({ resource: _input.resource.toString() });
  }
  deserialize(instantiationService, serialized) {
    try {
      const { resource } = JSON.parse(serialized);
      return instantiationService.createInstance(LogicEditorInput, URI.parse(resource));
    } catch {
      return instantiationService.createInstance(LogicEditorInput, URI.parse("plc-logic://main/main.ld.json"));
    }
  }
}
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(LogicEditorInput.ID, LogicEditorInputSerializer);
let PlcEditorResolverContribution = class extends Disposable {
  constructor(editorResolverService, instantiationService) {
    super();
    this.instantiationService = instantiationService;
    const patterns = ["*.ld.json", "*.fbd.json", "*.sfc.json"];
    for (const pattern of patterns) {
      this._register(editorResolverService.registerEditor(
        `**/${pattern}`,
        {
          id: LogicEditorPane.ID,
          label: "PLC Logic Editor",
          priority: RegisteredEditorPriority.exclusive
        },
        {
          singlePerResource: true,
          canSupportResource: (resource) => resource.scheme === "file"
        },
        {
          createEditorInput: ({ resource }) => {
            const input = this.instantiationService.createInstance(LogicEditorInput, resource);
            return { editor: input, options: { override: LogicEditorPane.ID } };
          }
        }
      ));
    }

    // HMI files: *_hmi.json opens in SimulatorEditorPane
    this._register(editorResolverService.registerEditor(
      "**/*_hmi.json",
      {
        id: SimulatorEditorPane.ID,
        label: "HMI Simulator",
        priority: RegisteredEditorPriority.exclusive
      },
      {
        singlePerResource: true,
        canSupportResource: (resource) => resource.scheme === "file"
      },
      {
        createEditorInput: ({ resource }) => {
          const input = this.instantiationService.createInstance(SimulatorEditorInput, resource);
          return { editor: input, options: { override: SimulatorEditorPane.ID } };
        }
      }
    ));
  }
};
PlcEditorResolverContribution.ID = "workbench.contrib.plcEditorResolver";
PlcEditorResolverContribution = __decorateClass([
  __decorateParam(0, IEditorResolverService),
  __decorateParam(1, IInstantiationService)
], PlcEditorResolverContribution);
registerWorkbenchContribution2(
  PlcEditorResolverContribution.ID,
  PlcEditorResolverContribution,
  WorkbenchPhase.BlockRestore
);
let PlcNavigatorViewPane = class extends ViewPane {
  constructor(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService) {
    super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
  }
  renderBody(container) {
    super.renderBody(container);
    container.style.cssText = "display:flex;flex-direction:column;height:100%;overflow:hidden;padding:0;background:var(--vscode-sideBar-background,var(--void-bg-2));";
    try {
      const accessor = createAccessor(this._instantiationService ?? this.instantiationService);
      this._mountResult = mountPlcNavigator(container, accessor);
      this._register(toDisposable(() => this._mountResult?.dispose()));
    } catch (e) {
      console.error("[PlcNavigatorPane] Mount failed:", e);
    }
  }
  layoutBody(_h, _w) {
    super.layoutBody(_h, _w);
  }
};
PlcNavigatorViewPane = __decorateClass([
  __decorateParam(1, IKeybindingService),
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IViewDescriptorService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, IHoverService)
], PlcNavigatorViewPane);
function createAccessor(instantiationService) {
  if (!instantiationService) {
    return new Proxy({}, { get: (_t, p) => p === "get" ? () => void 0 : void 0 });
  }
  return {
    get: (serviceId) => {
      try {
        return instantiationService.invokeFunction((a) => a.get(serviceId));
      } catch {
        return void 0;
      }
    }
  };
}
const viewContainerRegistry = Registry.as(ViewContainerExtensions.ViewContainersRegistry);
const plcContainer = viewContainerRegistry.registerViewContainer(
  {
    id: PLC_VIEW_CONTAINER_ID,
    title: nls.localize2("plcEditorContainer", "Logic"),
    ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [PLC_VIEW_CONTAINER_ID, {
      mergeViewWithContainerWhenSingleView: true
    }]),
    hideIfEmpty: false,
    order: 7,
    icon: Codicon.circuitBoard
  },
  ViewContainerLocation.Sidebar,
  { doNotRegisterOpenCommand: false, isDefault: true }
);
Registry.as(ViewExtensions.ViewsRegistry).registerViews([{
  id: PLC_NAVIGATOR_VIEW_ID,
  name: nls.localize2("plcNavigator", "Logic Navigator"),
  ctorDescriptor: new SyncDescriptor(PlcNavigatorViewPane),
  canToggleVisibility: false,
  canMoveView: false,
  order: 1
}], plcContainer);
// ─── Simulator Activity Bar Button ───────────────────────────────────────────
// Standalone button in the activity bar — no side panel, no view container.
// Clicking it opens the FUXA simulator as an editor panel.
import { ICommandService } from "../../../../platform/commands/common/commands.js";
let SimulatorActivityBarContribution = class extends Disposable {
  constructor(layoutService, commandService) {
    super();
    this.layoutService = layoutService;
    this.commandService = commandService;
    this._injectButton();
  }
  _injectButton() {
    const tryInject = () => {
      const activityBarEl = this.layoutService.getContainer(window, Parts.ACTIVITYBAR_PART);
      if (!activityBarEl) { setTimeout(tryInject, 100); return; }
      const compositeBar = activityBarEl.querySelector(".monaco-action-bar ul.actions-container");
      if (!compositeBar) { setTimeout(tryInject, 100); return; }
      const li = document.createElement("li");
      li.className = "action-item";
      li.setAttribute("role", "presentation");
      const a = document.createElement("a");
      a.className = "action-label codicon codicon-vm";
      a.setAttribute("role", "button");
      a.setAttribute("aria-label", "Simulator");
      a.setAttribute("title", "Simulator");
      a.style.cssText = "cursor:pointer;";
      a.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.commandService.executeCommand("void.openSimulator");
      });
      li.appendChild(a);
      compositeBar.appendChild(li);
    };
    setTimeout(tryInject, 500);
  }
};
SimulatorActivityBarContribution.ID = "workbench.contrib.plc.simulatorActivityBarButton";
SimulatorActivityBarContribution = __decorateClass([
  __decorateParam(0, IWorkbenchLayoutService),
  __decorateParam(1, ICommandService)
], SimulatorActivityBarContribution);
registerWorkbenchContribution2(
  SimulatorActivityBarContribution.ID,
  SimulatorActivityBarContribution,
  WorkbenchPhase.AfterRestored
);
class OpenPlcEditorAction extends Action2 {
  constructor() {
    super({
      id: VOID_OPEN_PLC_EDITOR_ACTION_ID,
      title: nls.localize2("openPlcEditor", "Plaxio: Open PLC Logic Editor"),
      f1: true,
      category: nls.localize2("plaxio", "Plaxio")
    });
  }
  async run(accessor) {
    const viewsService = accessor.get(IViewsService);
    await viewsService.openView(PLC_NAVIGATOR_VIEW_ID, false);
    try {
      const instantiationService = accessor.get(IInstantiationService);
      const editorService = accessor.get(IEditorService);
      const input = instantiationService.createInstance(
        LogicEditorInput,
        URI.parse("plc-logic://main/main.ld.json")
      );
      await editorService.openEditor(input, { pinned: true });
    } catch (e) {
      console.error("[OpenPlcEditorAction] Could not open LogicEditorInput:", e);
    }
  }
}
registerAction2(OpenPlcEditorAction);
let PlcLayoutContribution = class extends Disposable {
  constructor(layoutService, paneCompositeService, instantiationService, editorService) {
    super();
    this.layoutService = layoutService;
    this.paneCompositeService = paneCompositeService;
    this.instantiationService = instantiationService;
    this.editorService = editorService;
    this._syncFromCurrentState();
    this._register(this.paneCompositeService.onDidPaneCompositeOpen(({ composite, viewContainerLocation }) => {
      if (viewContainerLocation !== ViewContainerLocation.Sidebar) return;
      if (composite.getId() === PLC_VIEW_CONTAINER_ID) {
        this._activatePLC();
      } else {
        this._deactivatePLC();
      }
    }));
    this._register(this.paneCompositeService.onDidPaneCompositeClose(({ composite, viewContainerLocation }) => {
      if (viewContainerLocation !== ViewContainerLocation.Sidebar) return;
      if (composite.getId() === PLC_VIEW_CONTAINER_ID) {
        this._deactivatePLC();
      }
    }));
    // Hide canvas when a non-LogicEditor becomes the active editor (e.g. Export pane)
    this._register(this.editorService.onDidActiveEditorChange(() => {
      setTimeout(() => {
        const activePane = this.editorService.activeEditorPane;
        if (!activePane || activePane.getId() !== LogicEditorPane.ID) {
          this._deactivatePLC();
        }
      }, 0);
    }));
  }
  _syncFromCurrentState() {
    const active = this.paneCompositeService.getActivePaneComposite(ViewContainerLocation.Sidebar);
    if (active?.getId() === PLC_VIEW_CONTAINER_ID) {
      setTimeout(() => this._activatePLC(), 150);
    }
  }
  _getEditorPart() {
    try {
      return this.layoutService.getContainer(window, Parts.EDITOR_PART) ?? void 0;
    } catch {
      return void 0;
    }
  }
  _getOrCreateCanvas() {
    if (this._canvas) return this._canvas;
    const ep = this._getEditorPart();
    if (!ep) throw new Error("[PlcLayout] editor part not found");
    if (!ep.style.position || ep.style.position === "static") {
      ep.style.position = "relative";
    }
    const canvas = document.createElement("div");
    canvas.id = "plc-logic-canvas";
    canvas.style.cssText = [
      "display:none",
      "position:absolute",
      "inset:0",
      "z-index:10",
      "flex-direction:column",
      "overflow:hidden",
      "background:var(--vscode-editor-background)"
    ].join(";");
    ep.appendChild(canvas);
    this._canvas = canvas;
    this._register(toDisposable(() => {
      this._mountResult?.dispose();
      this._mountResult = void 0;
      canvas.remove();
      this._canvas = void 0;
    }));
    try {
      const accessor = createAccessor(this.instantiationService);
      this._mountResult = mountPlcEditor(canvas, accessor);
    } catch (e) {
      console.error("[PlcLayout] Mount failed:", e);
    }
    return canvas;
  }
  _activatePLC() {
    try {
      const canvas = this._getOrCreateCanvas();
      canvas.style.display = "flex";
    } catch (e) {
      console.error("[PlcLayout] activatePLC failed:", e);
    }
  }
  _deactivatePLC() {
    if (this._canvas) {
      this._canvas.style.display = "none";
    }
  }
};
PlcLayoutContribution.ID = "workbench.contrib.plcLayout";
PlcLayoutContribution = __decorateClass([
  __decorateParam(0, IWorkbenchLayoutService),
  __decorateParam(1, IPaneCompositePartService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IEditorService)
], PlcLayoutContribution);
registerWorkbenchContribution2(
  PlcLayoutContribution.ID,
  PlcLayoutContribution,
  WorkbenchPhase.AfterRestored
);
let PlcMonacoOverlayContribution = class extends Disposable {
  constructor(editorService, instantiationService, fileService) {
    super();
    this._pill = undefined;
    this._lastLoadedResource = undefined;
    this.editorService = editorService;
    this.instantiationService = instantiationService;
    this.fileService = fileService;
    this._register(this.editorService.onDidActiveEditorChange(() => this._sync()));
    this._sync();
  }
  _isPLCFile(uri) {
    const p = uri.path.toLowerCase();
    return p.endsWith(".ld.json") || p.endsWith(".fbd.json") || p.endsWith(".sfc.json");
  }
  _getLanguage(uri) {
    const p = uri.path.toLowerCase();
    if (p.endsWith(".ld.json")) return "LD";
    if (p.endsWith(".fbd.json")) return "FBD";
    return "SFC";
  }
  async _loadTagsFromFile(resource) {
    const key = resource.toString();
    if (this._lastLoadedResource === key) return;
    this._lastLoadedResource = key;
    try {
      const fileContent = await this.fileService.readFile(resource);
      const parsed = JSON.parse(fileContent.value.toString());
      const language = this._getLanguage(resource);
      const tagMap = new Map();
      const add = (t) => {
        if (t?.name && !tagMap.has(t.name)) {
          tagMap.set(t.name, { name: t.name, address: t.address ?? '', dataType: t.dataType ?? 'BOOL', description: t.description ?? '' });
        }
      };
      if (language === "LD" && parsed?.rungs) {
        for (const rung of parsed.rungs) {
          for (const el of (rung.elements ?? [])) { add(el.tag); }
        }
      }
      if (parsed?.tags) { for (const t of parsed.tags) add(t); }
      if (parsed?.tagDatabase) { for (const t of parsed.tagDatabase) add(t); }
      const tags = Array.from(tagMap.values());
      if (tags.length > 0) {
        logicStore.setTagDatabase(tags);
        logicStore.addAllTagsToWatchList();
      }
    } catch { /* unreadable */ }
  }
  _sync() {
    const active = this.editorService.activeEditorPane;
    const resource = this.editorService.activeEditor?.resource;
    const isPLC = resource && this._isPLCFile(resource);
    if (isPLC && resource && active) {
      const isGraphical = active.getId() === LogicEditorPane.ID;
      if (!isGraphical) {
        this._loadTagsFromFile(resource);
      }
      const container = active.getContainer?.();
      if (container) this._ensurePill(container, resource, isGraphical);
    } else {
      this._removePill();
    }
  }
  _buildSeg(label, active, onClick) {
    const ACTIVE_CSS = [
      "display:flex", "align-items:center", "gap:5px",
      "padding:0 10px", "height:22px", "cursor:default",
      "background:var(--vscode-button-background)",
      "color:var(--vscode-button-foreground)",
      "font-size:11px", "font-weight:600", "user-select:none"
    ].join(";");
    const INACTIVE_CSS = [
      "display:flex", "align-items:center", "gap:5px",
      "padding:0 10px", "height:22px", "cursor:pointer",
      "background:var(--vscode-editor-background)",
      "color:var(--vscode-foreground)",
      "font-size:11px", "user-select:none", "transition:filter 0.1s"
    ].join(";");
    const seg = document.createElement("div");
    seg.title = active ? `Current view: ${label.toLowerCase()}` : `Switch to ${label.toLowerCase()} view`;
    seg.style.cssText = active ? ACTIVE_CSS : INACTIVE_CSS;
    const span = document.createElement("span");
    span.textContent = label;
    seg.appendChild(span);
    if (!active && onClick) {
      seg.onmouseenter = () => { seg.style.filter = "brightness(1.3)"; };
      seg.onmouseleave = () => { seg.style.filter = ""; };
      seg.onclick = onClick;
    }
    return seg;
  }
  _ensurePill(container, resource, isGraphical) {
    this._removePill();
    // Find .editor-actions — the area with split/lock buttons in the tab bar
    const tryInject = () => {
      const editorActions = container.closest(".editor-group-container")
        ?.querySelector(".editor-actions");
      if (!editorActions) { requestAnimationFrame(tryInject); return; }
      const pill = document.createElement("div");
      pill.setAttribute("data-plc-pill", "1");
      pill.style.cssText = [
        "display:flex", "align-items:stretch",
        "border-radius:11px", "overflow:hidden", "height:22px",
        "box-shadow:0 1px 3px rgba(0,0,0,0.4)",
        "border:1px solid var(--vscode-focusBorder,rgba(255,255,255,0.15))",
        "flex-shrink:0", "margin:0 4px", "align-self:center"
      ].join(";");
      const graphSeg = this._buildSeg("Graphical", isGraphical, isGraphical ? null : () => {
        const input = this.instantiationService.createInstance(LogicEditorInput, resource);
        this.editorService.openEditor(input, { pinned: true });
      });
      const codeSeg = this._buildSeg("Code", !isGraphical, isGraphical ? () => {
        this.editorService.openEditor({ resource, options: { override: "default", pinned: true } });
      } : null);
      pill.appendChild(graphSeg);
      pill.appendChild(codeSeg);
      editorActions.insertBefore(pill, editorActions.firstChild);
      this._pill = pill;
    };
    requestAnimationFrame(tryInject);
  }
  _removePill() {
    if (this._pill) {
      this._pill.remove();
      this._pill = void 0;
    }
  }
};
PlcMonacoOverlayContribution.ID = "workbench.contrib.plcMonacoOverlay";
PlcMonacoOverlayContribution = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IFileService)
], PlcMonacoOverlayContribution);
registerWorkbenchContribution2(
  PlcMonacoOverlayContribution.ID,
  PlcMonacoOverlayContribution,
  WorkbenchPhase.AfterRestored
);

// ── Simulator Editor/Simulation toggle pill in .editor-actions ────────────────
let SimulatorToggleContribution = class extends Disposable {
  constructor(editorService) {
    super();
    this._pill = void 0;
    this.editorService = editorService;
    this._register(this.editorService.onDidActiveEditorChange(() => this._sync()));
    this._sync();
  }

  _isHmiResource(resource) {
    return !!(resource && resource.scheme === "file" && resource.path.endsWith("_hmi.json"));
  }

  _sync() {
    const active = this.editorService.activeEditorPane;
    if (!active) { this._removePill(); return; }
    const resource = active.input?.resource;
    const isSimulator = active.getId() === SimulatorEditorPane.ID;
    const isHmiTextEditor = !isSimulator && this._isHmiResource(resource);

    if (isSimulator && this._isHmiResource(resource)) {
      const container = active.getContainer?.();
      if (container) this._ensurePill(container, resource, "simulation");
    } else if (isHmiTextEditor) {
      const container = active.getContainer?.();
      if (container) this._ensurePill(container, resource, "editor");
    } else {
      this._removePill();
    }
  }

  _ensurePill(container, resource, activeMode) {
    this._removePill();
    const tryInject = () => {
      const editorActions = container.closest(".editor-group-container")
        ?.querySelector(".editor-actions");
      if (!editorActions) { requestAnimationFrame(tryInject); return; }

      const pill = document.createElement("div");
      pill.setAttribute("data-sim-pill", "1");
      pill.style.cssText = [
        "display:flex", "align-items:stretch",
        "border-radius:11px", "overflow:hidden", "height:22px",
        "box-shadow:0 1px 3px rgba(0,0,0,0.4)",
        "border:1px solid var(--vscode-focusBorder,rgba(255,255,255,0.15))",
        "flex-shrink:0", "margin:0 4px", "align-self:center",
      ].join(";");

      const mkSeg = (label, isActive, onClick) => {
        const seg = document.createElement("div");
        seg.textContent = label;
        seg.style.cssText = [
          "display:flex", "align-items:center",
          "padding:0 10px", "height:22px",
          "font-size:11px", "user-select:none",
          isActive
            ? "background:var(--vscode-button-background);color:var(--vscode-button-foreground);font-weight:600;cursor:default;"
            : "background:var(--vscode-editor-background);color:var(--vscode-foreground);cursor:pointer;",
        ].join(";");
        if (!isActive && onClick) {
          seg.addEventListener("mouseenter", () => { seg.style.filter = "brightness(1.3)"; });
          seg.addEventListener("mouseleave", () => { seg.style.filter = ""; });
          seg.addEventListener("click", onClick);
        }
        return seg;
      };

      // "Editor" — active (highlighted) when Monaco is open; click opens Monaco for this file
      pill.appendChild(mkSeg("Editor", activeMode === "editor",
        activeMode === "editor" ? null : () => {
          this.editorService.openEditor({ resource, options: { override: "default", pinned: true } });
        }
      ));

      // "Simulation" — active (highlighted) when SimulatorEditorPane is open; click opens simulator
      pill.appendChild(mkSeg("Simulation", activeMode === "simulation",
        activeMode === "simulation" ? null : () => {
          this.editorService.openEditor({ resource, options: { override: SimulatorEditorPane.ID, pinned: true } });
        }
      ));

      editorActions.insertBefore(pill, editorActions.firstChild);
      this._pill = pill;
    };
    requestAnimationFrame(tryInject);
  }

  _removePill() {
    if (this._pill) { this._pill.remove(); this._pill = void 0; }
  }
};
SimulatorToggleContribution.ID = "workbench.contrib.plc.simulatorToggle";
SimulatorToggleContribution = __decorateClass([
  __decorateParam(0, IEditorService),
], SimulatorToggleContribution);
registerWorkbenchContribution2(
  SimulatorToggleContribution.ID,
  SimulatorToggleContribution,
  WorkbenchPhase.AfterRestored
);

let VendorFileDetectionContribution = class extends Disposable {
  constructor(workspaceContextService, fileService) {
    super();
    this.workspaceContextService = workspaceContextService;
    this.fileService = fileService;
    this._register(this.workspaceContextService.onDidChangeWorkspaceFolders(() => this._scanFolders()));
    setTimeout(() => this._scanFolders(), 3e3);
  }
  async _scanFolders() {
    const folders = this.workspaceContextService.getWorkspace().folders;
    if (folders.length === 0) return;
    const detectedFiles = [];
    for (const folder of folders) {
      try {
        const stat = await this.fileService.resolve(folder.uri);
        if (!stat.children) continue;
        for (const child of stat.children) {
          const name = child.name.toLowerCase();
          const ext = "." + name.split(".").pop();
          if (VendorFileDetectionContribution.VENDOR_EXTENSIONS.includes(ext)) {
            const format = ext === ".l5x" ? "rockwell_l5x" : ext === ".st" || ext === ".scl" ? "iec_st" : "schneider_xef";
            detectedFiles.push({ name: child.name, path: child.resource.fsPath, format });
            continue;
          }
          if (name.endsWith(".xml")) {
            try {
              const content = await this.fileService.readFile(child.resource);
              const head = content.value.slice(0, 4096).toString();
              for (const [sig, format] of Object.entries(VendorFileDetectionContribution.VENDOR_XML_SIGNATURES)) {
                if (head.includes(sig)) {
                  detectedFiles.push({ name: child.name, path: child.resource.fsPath, format });
                  break;
                }
              }
            } catch {
            }
          }
        }
      } catch {
      }
    }
    if (detectedFiles.length > 0) {
      window.postMessage({
        type: "volt:vendor-file-detected",
        files: detectedFiles
      }, "*");
    }
  }
};
VendorFileDetectionContribution.ID = "workbench.contrib.plc.vendorFileDetection";
VendorFileDetectionContribution.VENDOR_EXTENSIONS = [".l5x", ".xef", ".zef", ".st", ".scl"];
VendorFileDetectionContribution.VENDOR_XML_SIGNATURES = {
  "RSLogix5000Content": "rockwell_l5x",
  "SW.Blocks.CompileUnit": "siemens_simatic_ml",
  "SW.CodeBlock": "siemens_simatic_ml",
  "plcopen.org/xml/tc6_0201": "plcopen_xml",
  "ProjectFile": "schneider_xef",
  "UnityPro": "schneider_xef"
};
VendorFileDetectionContribution = __decorateClass([
  __decorateParam(0, IWorkspaceContextService),
  __decorateParam(1, IFileService)
], VendorFileDetectionContribution);
registerWorkbenchContribution2(
  VendorFileDetectionContribution.ID,
  VendorFileDetectionContribution,
  WorkbenchPhase.AfterRestored
);

// ─── Simulator Editor (FUXA HMI) ─────────────────────────────────────────────
import { SimulatorEditorInput, SIMULATOR_EDITOR_URI } from "./simulatorEditorInput.js";
import { SimulatorEditorPane } from "./simulatorEditorPane.js";

Registry.as(EditorExtensions.EditorPane).registerEditorPane(
  EditorPaneDescriptor.create(
    SimulatorEditorPane,
    SimulatorEditorPane.ID,
    nls.localize("plcSimulatorEditor", "PLC Simulator")
  ),
  [new SyncDescriptor(SimulatorEditorInput)]
);

class SimulatorEditorInputSerializer {
  canSerialize() { return true; }
  serialize() { return "{}"; }
  deserialize() { return SimulatorEditorInput.getOrCreate(); }
}
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(SimulatorEditorInput.ID, SimulatorEditorInputSerializer);

// Open Simulator action — used by activity bar button
class OpenSimulatorAction extends Action2 {
  constructor() {
    super({
      id: "void.openSimulator",
      title: nls.localize2("openSimulator", "Open Simulator"),
      category: nls.localize2("plaxio", "Plaxio"),
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    await editorService.openEditor(SimulatorEditorInput.getOrCreate(), { pinned: true });
  }
}
registerAction2(OpenSimulatorAction);

// ─── Export Editor (PLC Vendor Export) ───────────────────────────────────────
import { ExportEditorInput, EXPORT_EDITOR_URI } from "./exportEditorInput.js";
import { ExportEditorPane } from "./exportEditorPane.js";

Registry.as(EditorExtensions.EditorPane).registerEditorPane(
  EditorPaneDescriptor.create(
    ExportEditorPane,
    ExportEditorPane.ID,
    nls.localize("plcExportEditor", "PLC Export")
  ),
  [new SyncDescriptor(ExportEditorInput)]
);

class ExportEditorInputSerializer {
  canSerialize() { return true; }
  serialize() { return "{}"; }
  deserialize() { return ExportEditorInput.getOrCreate(); }
}
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(ExportEditorInput.ID, ExportEditorInputSerializer);

// Open Export action
class OpenExportAction extends Action2 {
  constructor() {
    super({
      id: "void.openExport",
      title: nls.localize2("openExport", "Open Export"),
      category: nls.localize2("plaxio", "Plaxio"),
    });
  }
  async run(accessor) {
    try {
      console.log('[OpenExportAction] run() called');
      const editorService = accessor.get(IEditorService);
      const input = ExportEditorInput.getOrCreate();
      console.log('[OpenExportAction] opening editor input:', input?.typeId, input?.resource?.toString());
      await editorService.openEditor(input, { pinned: true });
      console.log('[OpenExportAction] openEditor returned');
    } catch (e) {
      console.error('[OpenExportAction] FAILED:', e);
    }
  }
}
registerAction2(OpenExportAction);

export {
  PLC_NAVIGATOR_VIEW_ID,
  PLC_VIEW_CONTAINER_ID,
  VOID_OPEN_PLC_EDITOR_ACTION_ID,
  SimulatorEditorInput,
  SIMULATOR_EDITOR_URI,
  ExportEditorInput,
  EXPORT_EDITOR_URI,
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcGxjRWRpdG9yUGFuZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLypcbiAqIFBMQyBMb2dpYyBFZGl0b3IgXHUyMDE0IFdvcmtiZW5jaCBSZWdpc3RyYXRpb25cbiAqXG4gKiBBcmNoaXRlY3R1cmUgKFBoYXNlIDAgXHUyMDE0IGNvcnJlY3QgaW1wbGVtZW50YXRpb24pOlxuICpcbiAqICAgU2lkZWJhciAoYWN0aXZpdHkgYmFyIFx1MjE5MiBsZWZ0IHBhbmVsKTpcbiAqICAgICBWaWV3Q29udGFpbmVyIFwiTG9naWNcIiAgXHUyMTkyICBQbGNOYXZpZ2F0b3JWaWV3UGFuZSAobmF2aWdhdGlvbiB0cmVlOiBQcm9ncmFtcyAvIFRhZ3MgLyBMaWJyYXJ5KVxuICogICAgIENsaWNraW5nIGEgcHJvZ3JhbSBvcGVucyBhIExvZ2ljRWRpdG9ySW5wdXQgaW4gdGhlIGVkaXRvciBhcmVhLlxuICpcbiAqICAgRWRpdG9yIGFyZWEgKGNlbnRlcik6XG4gKiAgICAgTG9naWNFZGl0b3JJbnB1dCAgXHUyMTkwXHUyMTkyICBMb2dpY0VkaXRvclBhbmUgIChSZWFjdCBQTEMgY2FudmFzLCByZXBsYWNlcyBNb25hY28gY29tcGxldGVseSlcbiAqICAgICBXaGVuIGEgTG9naWNFZGl0b3JJbnB1dCBpcyB0aGUgYWN0aXZlIGVkaXRvciwgTW9uYWNvIGlzIG5ldmVyIGluc3RhbnRpYXRlZCBmb3IgdGhhdCBncm91cC5cbiAqICAgICBObyBkaXYtaGlkaW5nLCBubyB6LWluZGV4IGhhY2tzLCBubyBQbGNDZW50ZXJTd2FwQ29udHJpYnV0aW9uIG5lZWRlZC5cbiAqXG4gKiBUaGlzIGlzIHRoZSBzYW1lIG1lY2hhbmlzbSBWUyBDb2RlIHVzZXMgZm9yIFNldHRpbmdzIFVJLCBLZXliaW5kaW5ncyBFZGl0b3IsIFdlbGNvbWUgcGFnZSwgZXRjLlxuICovXG5cbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7XG5cdEV4dGVuc2lvbnMgYXMgVmlld0NvbnRhaW5lckV4dGVuc2lvbnMsXG5cdElWaWV3Q29udGFpbmVyc1JlZ2lzdHJ5LFxuXHRWaWV3Q29udGFpbmVyTG9jYXRpb24sXG5cdElWaWV3c1JlZ2lzdHJ5LFxuXHRFeHRlbnNpb25zIGFzIFZpZXdFeHRlbnNpb25zLFxuXHRJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLFxufSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld3MuanMnO1xuXG5pbXBvcnQgeyBWaWV3UGFuZSwgSVZpZXdQYW5lT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvdmlld3Mvdmlld1BhbmUuanMnO1xuaW1wb3J0IHsgVmlld1BhbmVDb250YWluZXIgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3BhcnRzL3ZpZXdzL3ZpZXdQYW5lQ29udGFpbmVyLmpzJztcbmltcG9ydCB7IFN5bmNEZXNjcmlwdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZGVzY3JpcHRvcnMuanMnO1xuXG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgSUhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgQWN0aW9uMiwgcmVnaXN0ZXJBY3Rpb24yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJVmlld3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdmlld3MvY29tbW9uL3ZpZXdzU2VydmljZS5qcyc7XG5pbXBvcnQgeyB0b0Rpc3Bvc2FibGUsIERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElQYW5lQ29tcG9zaXRlUGFydFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9wYW5lY29tcG9zaXRlL2Jyb3dzZXIvcGFuZWNvbXBvc2l0ZS5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQ29udHJpYnV0aW9uLCByZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIsIFdvcmtiZW5jaFBoYXNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaExheW91dFNlcnZpY2UsIFBhcnRzIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvbGF5b3V0L2Jyb3dzZXIvbGF5b3V0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBtb3VudFBsY0VkaXRvciwgbW91bnRUYWdNb25pdG9yIH0gZnJvbSAnLi9yZWFjdC9vdXQvcGxjLWVkaXRvci10c3gvaW5kZXguanMnO1xuXG4vLyBFZGl0b3IgcmVnaXN0cmF0aW9uIGltcG9ydHNcbmltcG9ydCB7IEVkaXRvclBhbmVEZXNjcmlwdG9yLCBJRWRpdG9yUGFuZVJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3IuanMnO1xuaW1wb3J0IHsgRWRpdG9yRXh0ZW5zaW9ucywgSUVkaXRvckZhY3RvcnlSZWdpc3RyeSwgSUVkaXRvclNlcmlhbGl6ZXIgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IEVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci9lZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yUmVzb2x2ZXJTZXJ2aWNlLCBSZWdpc3RlcmVkRWRpdG9yUHJpb3JpdHkgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclJlc29sdmVyU2VydmljZS5qcyc7XG5cbi8vIE91ciBjdXN0b20gZWRpdG9yIHBhaXJcbmltcG9ydCB7IExvZ2ljRWRpdG9ySW5wdXQgfSBmcm9tICcuL2xvZ2ljRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgTG9naWNFZGl0b3JQYW5lIH0gZnJvbSAnLi9sb2dpY0VkaXRvclBhbmUuanMnO1xuXG4vLyBSZWFjdCBtb3VudCBmdW5jdGlvbnNcbmltcG9ydCB7IG1vdW50UGxjTmF2aWdhdG9yIH0gZnJvbSAnLi9yZWFjdC9vdXQvcGxjLWVkaXRvci10c3gvaW5kZXguanMnO1xuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbmRlY2xhcmUgY29uc3QgZG9jdW1lbnQ6IGFueTtcblxuLy8gVmVuZG9yIGZpbGUgZGV0ZWN0aW9uIGltcG9ydHNcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBCb3R0b20gcGFuZWwgaW5qZWN0aW9uIChDb25zb2xlIC8gVGFnIE1vbml0b3IgLyBSdW50aW1lIHRhYnMpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy8gUnVucyBzeW5jaHJvbm91c2x5IGF0IG1vZHVsZSBsb2FkLiBIaWRlcyBuYXRpdmUgVlMgQ29kZSBwYW5lbCB0YWJzIGFuZCBpbmplY3RzXG4vLyBvdXIgdGhyZWUgUmVhY3QtYmFja2VkIHRhYnMuIFVzZXMgTXV0YXRpb25PYnNlcnZlciBzbyB0aGVyZSBpcyBubyB0aW1pbmcgcmFjZS5cbihmdW5jdGlvbiBpbml0UExDUGFuZWwoKSB7XG5cdGNvbnN0IFNUWUxFX0lEID0gJ3BsYy1wYW5lbC1zdHlsZSc7XG5cdGlmICghZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoU1RZTEVfSUQpKSB7XG5cdFx0Y29uc3Qgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xuXHRcdHN0eWxlLmlkID0gU1RZTEVfSUQ7XG5cdFx0c3R5bGUudGV4dENvbnRlbnQgPSBgXG5cdFx0XHQjd29ya2JlbmNoXFxcXC5wYXJ0c1xcXFwucGFuZWwgLmNvbXBvc2l0ZS1iYXItY29udGFpbmVyLFxuXHRcdFx0I3dvcmtiZW5jaFxcXFwucGFydHNcXFxcLnBhbmVsIC5jb21wb3NpdGUtYmFyIHsgZGlzcGxheTogbm9uZSAhaW1wb3J0YW50OyB9XG5cdFx0XHQjd29ya2JlbmNoXFxcXC5wYXJ0c1xcXFwucGFuZWwgLmNvbnRlbnQgPiAuY29tcG9zaXRlLFxuXHRcdFx0I3dvcmtiZW5jaFxcXFwucGFydHNcXFxcLnBhbmVsIC5jb250ZW50ID4gLnZpZXctaW5zdGFuY2UsXG5cdFx0XHQjd29ya2JlbmNoXFxcXC5wYXJ0c1xcXFwucGFuZWwgLmNvbnRlbnQgPiAuc3BsaXQtdmlldy1jb250YWluZXIgeyBkaXNwbGF5OiBub25lICFpbXBvcnRhbnQ7IH1cblx0XHRcdCN3b3JrYmVuY2hcXFxcLnBhcnRzXFxcXC5wYW5lbCAudGl0bGUgLnRpdGxlLWxhYmVsIHsgZGlzcGxheTogbm9uZSAhaW1wb3J0YW50OyB9XG5cdFx0XHQvKiBIaWRlIHRoZSByZWR1bmRhbnQgdGl0bGUgYmFyIGluIHRoZSBzaWRlYmFyIExvZ2ljIHBhbmVsICovXG5cdFx0XHQucGFydC5zaWRlYmFyIC5jb21wb3NpdGUudGl0bGUgeyBkaXNwbGF5OiBub25lICFpbXBvcnRhbnQ7IH1cblx0XHRgO1xuXHRcdGlmIChkb2N1bWVudC5oZWFkKSB7IGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpOyB9XG5cdFx0ZWxzZSB7IGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCAoKSA9PiBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKHN0eWxlKSwgeyBvbmNlOiB0cnVlIH0pOyB9XG5cdH1cblxuXHRjb25zdCBUQUJTID0gW1xuXHRcdHsgaWQ6ICd0YWctbW9uaXRvcicsIGxhYmVsOiAnVGFnIE1vbml0b3InIH0sXG5cdF07XG5cblx0ZnVuY3Rpb24gdHJ5SW5qZWN0KCk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IHBhbmVsUGFydCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd3b3JrYmVuY2gucGFydHMucGFuZWwnKTtcblx0XHRpZiAoIXBhbmVsUGFydCkgcmV0dXJuIGZhbHNlO1xuXHRcdGNvbnN0IGNvbXBvc2l0ZVRpdGxlID0gcGFuZWxQYXJ0LnF1ZXJ5U2VsZWN0b3IoJy5jb21wb3NpdGUudGl0bGUnKTtcblx0XHRpZiAoIWNvbXBvc2l0ZVRpdGxlKSByZXR1cm4gZmFsc2U7XG5cdFx0aWYgKHBhbmVsUGFydC5xdWVyeVNlbGVjdG9yKCcucGxjLXBhbmVsLXRhYnMnKSkgcmV0dXJuIHRydWU7XG5cblx0XHRwYW5lbFBhcnQuc3R5bGUucG9zaXRpb24gPSAncmVsYXRpdmUnO1xuXHRcdGNvbnN0IHRhYkhvc3RzOiBSZWNvcmQ8c3RyaW5nLCBIVE1MRWxlbWVudD4gPSB7fTtcblx0XHRUQUJTLmZvckVhY2godGFiID0+IHtcblx0XHRcdGNvbnN0IGhvc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdGhvc3QuY2xhc3NOYW1lID0gJ3BsYy1wYW5lbC1jb250ZW50Jztcblx0XHRcdGhvc3QuZGF0YXNldC50YWJDb250ZW50ID0gdGFiLmlkO1xuXHRcdFx0aG9zdC5zdHlsZS5jc3NUZXh0ID0gW1xuXHRcdFx0XHQncG9zaXRpb246YWJzb2x1dGUnLCAnbGVmdDowJywgJ3JpZ2h0OjAnLCAnYm90dG9tOjAnLCAndG9wOjM1cHgnLFxuXHRcdFx0XHQnb3ZlcmZsb3c6aGlkZGVuJywgJ3otaW5kZXg6MTAnLCAnZGlzcGxheTpub25lJyxcblx0XHRcdFx0J2JhY2tncm91bmQ6dmFyKC0tdnNjb2RlLXBhbmVsLWJhY2tncm91bmQsdmFyKC0tdnNjb2RlLWVkaXRvci1iYWNrZ3JvdW5kKSknLFxuXHRcdFx0XS5qb2luKCc7Jyk7XG5cdFx0XHRwYW5lbFBhcnQuYXBwZW5kQ2hpbGQoaG9zdCk7XG5cdFx0XHR0YWJIb3N0c1t0YWIuaWRdID0gaG9zdDtcblx0XHR9KTtcblxuXHRcdG1vdW50VGFnTW9uaXRvcih0YWJIb3N0c1sndGFnLW1vbml0b3InXSk7XG5cblx0XHRjb25zdCB0YWJCYXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHR0YWJCYXIuY2xhc3NOYW1lID0gJ3BsYy1wYW5lbC10YWJzJztcblx0XHR0YWJCYXIuc3R5bGUuY3NzVGV4dCA9ICdkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6c3RyZXRjaDtoZWlnaHQ6MTAwJTtvdmVyZmxvdzpoaWRkZW47JztcblxuXHRcdGxldCBhY3RpdmVUYWIgPSAnY29uc29sZSc7XG5cdFx0Y29uc3Qgc2hvd1RhYiA9IChpZDogc3RyaW5nKSA9PiB7XG5cdFx0XHRhY3RpdmVUYWIgPSBpZDtcblx0XHRcdFRBQlMuZm9yRWFjaCh0ID0+IHtcblx0XHRcdFx0dGFiSG9zdHNbdC5pZF0uc3R5bGUuZGlzcGxheSA9IHQuaWQgPT09IGlkID8gJ2Jsb2NrJyA6ICdub25lJztcblx0XHRcdH0pO1xuXHRcdFx0dGFiQmFyLnF1ZXJ5U2VsZWN0b3JBbGwoJy5wbGMtdGFiJykuZm9yRWFjaCgoYnRuOiBhbnkpID0+IHtcblx0XHRcdFx0Y29uc3QgaXNBY3RpdmUgPSBidG4uZGF0YXNldC50YWIgPT09IGlkO1xuXHRcdFx0XHRidG4uc3R5bGUuY29sb3IgPSBpc0FjdGl2ZVxuXHRcdFx0XHRcdD8gJ3ZhcigtLXZzY29kZS1wYW5lbFRpdGxlLWFjdGl2ZUZvcmVncm91bmQsdmFyKC0tdnNjb2RlLWZvcmVncm91bmQpKSdcblx0XHRcdFx0XHQ6ICd2YXIoLS12c2NvZGUtcGFuZWxUaXRsZS1pbmFjdGl2ZUZvcmVncm91bmQsdmFyKC0tdnNjb2RlLWRlc2NyaXB0aW9uRm9yZWdyb3VuZCkpJztcblx0XHRcdFx0YnRuLnN0eWxlLmJvcmRlclRvcCA9IGlzQWN0aXZlXG5cdFx0XHRcdFx0PyAnMXB4IHNvbGlkIHZhcigtLXZzY29kZS1wYW5lbFRpdGxlLWFjdGl2ZUJvcmRlcix2YXIoLS12c2NvZGUtZm9jdXNCb3JkZXIpKSdcblx0XHRcdFx0XHQ6ICcxcHggc29saWQgdHJhbnNwYXJlbnQnO1xuXHRcdFx0XHRidG4uc3R5bGUuZm9udFdlaWdodCA9IGlzQWN0aXZlID8gJzYwMCcgOiAnNDAwJztcblx0XHRcdH0pO1xuXHRcdH07XG5cblx0XHRUQUJTLmZvckVhY2godGFiID0+IHtcblx0XHRcdGNvbnN0IGJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdFx0YnRuLmNsYXNzTmFtZSA9ICdwbGMtdGFiJztcblx0XHRcdGJ0bi5kYXRhc2V0LnRhYiA9IHRhYi5pZDtcblx0XHRcdGJ0bi50ZXh0Q29udGVudCA9IHRhYi5sYWJlbDtcblx0XHRcdGJ0bi5zdHlsZS5jc3NUZXh0ID0gW1xuXHRcdFx0XHQnZGlzcGxheTpmbGV4JywgJ2FsaWduLWl0ZW1zOmNlbnRlcicsICdwYWRkaW5nOjAgMTJweCcsXG5cdFx0XHRcdCdjdXJzb3I6cG9pbnRlcicsICdmb250LXNpemU6MTJweCcsICd1c2VyLXNlbGVjdDpub25lJyxcblx0XHRcdFx0J2JvcmRlci10b3A6MXB4IHNvbGlkIHRyYW5zcGFyZW50JywgJ2JveC1zaXppbmc6Ym9yZGVyLWJveCcsXG5cdFx0XHRcdCdjb2xvcjp2YXIoLS12c2NvZGUtcGFuZWxUaXRsZS1pbmFjdGl2ZUZvcmVncm91bmQsdmFyKC0tdnNjb2RlLWRlc2NyaXB0aW9uRm9yZWdyb3VuZCkpJyxcblx0XHRcdF0uam9pbignOycpO1xuXHRcdFx0YnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gc2hvd1RhYih0YWIuaWQpKTtcblx0XHRcdHRhYkJhci5hcHBlbmRDaGlsZChidG4pO1xuXHRcdH0pO1xuXG5cdFx0Y29tcG9zaXRlVGl0bGUuYXBwZW5kQ2hpbGQodGFiQmFyKTtcblx0XHRzaG93VGFiKCd0YWctbW9uaXRvcicpO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0aWYgKCF0cnlJbmplY3QoKSkge1xuXHRcdGNvbnN0IG9icyA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKCgpID0+IHsgaWYgKHRyeUluamVjdCgpKSBvYnMuZGlzY29ubmVjdCgpOyB9KTtcblx0XHRvYnMub2JzZXJ2ZShkb2N1bWVudC5ib2R5IHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCwgeyBjaGlsZExpc3Q6IHRydWUsIHN1YnRyZWU6IHRydWUgfSk7XG5cdH1cbn0pKCk7XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBJRHMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBjb25zdCBQTENfVklFV19DT05UQUlORVJfSUQgICA9ICd3b3JrYmVuY2gudmlldy5wbGNFZGl0b3InO1xuZXhwb3J0IGNvbnN0IFBMQ19OQVZJR0FUT1JfVklFV19JRCAgID0gJ3dvcmtiZW5jaC52aWV3LnBsY05hdmlnYXRvcic7XG5leHBvcnQgY29uc3QgVk9JRF9PUEVOX1BMQ19FRElUT1JfQUNUSU9OX0lEID0gJ3ZvaWQub3BlblBsY0VkaXRvcic7XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBMb2dpY0VkaXRvclBhbmUgKyBMb2dpY0VkaXRvcklucHV0IHJlZ2lzdHJhdGlvbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vIFRoaXMgaXMgdGhlIGNvcmUgZml4OiByZWdpc3RlciBhIHJlYWwgRWRpdG9yUGFuZS9FZGl0b3JJbnB1dCBwYWlyIHNvIHRoZVxuLy8gZWRpdG9yIGFyZWEgaXMgZnVsbHkgcmVwbGFjZWQgYnkgb3VyIFJlYWN0IGNhbnZhcyBcdTIwMTQgTW9uYWNvIG5ldmVyIHJ1bnMgaGVyZS5cblxuUmVnaXN0cnkuYXM8SUVkaXRvclBhbmVSZWdpc3RyeT4oRWRpdG9yRXh0ZW5zaW9ucy5FZGl0b3JQYW5lKS5yZWdpc3RlckVkaXRvclBhbmUoXG5cdEVkaXRvclBhbmVEZXNjcmlwdG9yLmNyZWF0ZShcblx0XHRMb2dpY0VkaXRvclBhbmUsXG5cdFx0TG9naWNFZGl0b3JQYW5lLklELFxuXHRcdG5scy5sb2NhbGl6ZSgncGxjTG9naWNFZGl0b3InLCAnUExDIExvZ2ljIEVkaXRvcicpLFxuXHQpLFxuXHRbbmV3IFN5bmNEZXNjcmlwdG9yKExvZ2ljRWRpdG9ySW5wdXQpXSxcbik7XG5cbmNsYXNzIExvZ2ljRWRpdG9ySW5wdXRTZXJpYWxpemVyIGltcGxlbWVudHMgSUVkaXRvclNlcmlhbGl6ZXIge1xuXHRjYW5TZXJpYWxpemUoX2lucHV0OiBFZGl0b3JJbnB1dCk6IGJvb2xlYW4geyByZXR1cm4gdHJ1ZTsgfVxuXHRzZXJpYWxpemUoX2lucHV0OiBFZGl0b3JJbnB1dCk6IHN0cmluZyB7IHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHJlc291cmNlOiAoX2lucHV0IGFzIExvZ2ljRWRpdG9ySW5wdXQpLnJlc291cmNlLnRvU3RyaW5nKCkgfSk7IH1cblx0ZGVzZXJpYWxpemUoaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSwgc2VyaWFsaXplZDogc3RyaW5nKTogTG9naWNFZGl0b3JJbnB1dCB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHsgcmVzb3VyY2UgfSA9IEpTT04ucGFyc2Uoc2VyaWFsaXplZCk7XG5cdFx0XHRyZXR1cm4gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTG9naWNFZGl0b3JJbnB1dCwgVVJJLnBhcnNlKHJlc291cmNlKSk7XG5cdFx0fSBjYXRjaCB7XG5cdFx0XHRyZXR1cm4gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTG9naWNFZGl0b3JJbnB1dCwgVVJJLnBhcnNlKCdwbGMtbG9naWM6Ly9tYWluL21haW4ubGQuanNvbicpKTtcblx0XHR9XG5cdH1cbn1cblxuUmVnaXN0cnkuYXM8SUVkaXRvckZhY3RvcnlSZWdpc3RyeT4oRWRpdG9yRXh0ZW5zaW9ucy5FZGl0b3JGYWN0b3J5KVxuXHQucmVnaXN0ZXJFZGl0b3JTZXJpYWxpemVyKExvZ2ljRWRpdG9ySW5wdXQuSUQsIExvZ2ljRWRpdG9ySW5wdXRTZXJpYWxpemVyKTtcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIEVkaXRvciBSZXNvbHZlciBSZWdpc3RyYXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vLyBSZWdpc3RlcnMgZ2xvYiBwYXR0ZXJucyBzbyBjbGlja2luZyAubGQuanNvbiAvIC5mYmQuanNvbiAvIC5zZmMuanNvbiBmaWxlcyBpblxuLy8gdGhlIEV4cGxvcmVyIG9wZW5zIExvZ2ljRWRpdG9yUGFuZSBpbnN0ZWFkIG9mIHRoZSBkZWZhdWx0IHRleHQgZWRpdG9yLlxuXG5jbGFzcyBQbGNFZGl0b3JSZXNvbHZlckNvbnRyaWJ1dGlvbiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5jb250cmliLnBsY0VkaXRvclJlc29sdmVyJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUVkaXRvclJlc29sdmVyU2VydmljZSBlZGl0b3JSZXNvbHZlclNlcnZpY2U6IElFZGl0b3JSZXNvbHZlclNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRjb25zdCBwYXR0ZXJucyA9IFsnKi5sZC5qc29uJywgJyouZmJkLmpzb24nLCAnKi5zZmMuanNvbiddO1xuXHRcdGZvciAoY29uc3QgcGF0dGVybiBvZiBwYXR0ZXJucykge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoZWRpdG9yUmVzb2x2ZXJTZXJ2aWNlLnJlZ2lzdGVyRWRpdG9yKFxuXHRcdFx0XHRgKiovJHtwYXR0ZXJufWAsXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogTG9naWNFZGl0b3JQYW5lLklELFxuXHRcdFx0XHRcdGxhYmVsOiAnUExDIExvZ2ljIEVkaXRvcicsXG5cdFx0XHRcdFx0cHJpb3JpdHk6IFJlZ2lzdGVyZWRFZGl0b3JQcmlvcml0eS5leGNsdXNpdmUsXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRzaW5nbGVQZXJSZXNvdXJjZTogdHJ1ZSxcblx0XHRcdFx0XHRjYW5TdXBwb3J0UmVzb3VyY2U6IChyZXNvdXJjZTogVVJJKSA9PiByZXNvdXJjZS5zY2hlbWUgPT09ICdmaWxlJyxcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGNyZWF0ZUVkaXRvcklucHV0OiAoeyByZXNvdXJjZSB9KSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCBpbnB1dCA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTG9naWNFZGl0b3JJbnB1dCwgcmVzb3VyY2UpO1xuXHRcdFx0XHRcdFx0cmV0dXJuIHsgZWRpdG9yOiBpbnB1dCwgb3B0aW9uczogeyBvdmVycmlkZTogTG9naWNFZGl0b3JQYW5lLklEIH0gfTtcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9LFxuXHRcdFx0KSk7XG5cdFx0fVxuXHR9XG59XG5cbnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMihcblx0UGxjRWRpdG9yUmVzb2x2ZXJDb250cmlidXRpb24uSUQsXG5cdFBsY0VkaXRvclJlc29sdmVyQ29udHJpYnV0aW9uLFxuXHRXb3JrYmVuY2hQaGFzZS5CbG9ja1Jlc3RvcmUsXG4pO1xuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgU2lkZWJhciBOYXZpZ2F0b3IgVmlld1BhbmUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vLyBUaGlzIGlzIGEgTkFWSUdBVElPTiBUUkVFIE9OTFkgXHUyMDE0IGNsaWNraW5nIGEgcHJvZ3JhbSBoZXJlIG9wZW5zIGEgTG9naWNFZGl0b3JJbnB1dFxuLy8gaW4gdGhlIGVkaXRvciBhcmVhIChzYW1lIHBhdHRlcm4gYXMgRXhwbG9yZXIgXHUyMTkyIG9wZW4gZmlsZSBcdTIxOTIgTW9uYWNvKS5cbi8vIEl0IGRvZXMgTk9UIHJlbmRlciB0aGUgY2FudmFzIGl0c2VsZi5cblxuY2xhc3MgUGxjTmF2aWdhdG9yVmlld1BhbmUgZXh0ZW5kcyBWaWV3UGFuZSB7XG5cdHByaXZhdGUgX21vdW50UmVzdWx0OiBSZXR1cm5UeXBlPHR5cGVvZiBtb3VudFBsY05hdmlnYXRvcj4gfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0b3B0aW9uczogSVZpZXdQYW5lT3B0aW9ucyxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElWaWV3RGVzY3JpcHRvclNlcnZpY2Ugdmlld0Rlc2NyaXB0b3JTZXJ2aWNlOiBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2Ugb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIob3B0aW9ucywga2V5YmluZGluZ1NlcnZpY2UsIGNvbnRleHRNZW51U2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIGNvbnRleHRLZXlTZXJ2aWNlLCB2aWV3RGVzY3JpcHRvclNlcnZpY2UsIGluc3RhbnRpYXRpb25TZXJ2aWNlLCBvcGVuZXJTZXJ2aWNlLCB0aGVtZVNlcnZpY2UsIGhvdmVyU2VydmljZSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgcmVuZGVyQm9keShjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0c3VwZXIucmVuZGVyQm9keShjb250YWluZXIpO1xuXHRcdGNvbnRhaW5lci5zdHlsZS5jc3NUZXh0ID0gJ2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47aGVpZ2h0OjEwMCU7b3ZlcmZsb3c6aGlkZGVuO3BhZGRpbmc6MDtiYWNrZ3JvdW5kOnZhcigtLXZzY29kZS1zaWRlQmFyLWJhY2tncm91bmQsdmFyKC0tdm9pZC1iZy0yKSk7Jztcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgYWNjZXNzb3IgPSBjcmVhdGVBY2Nlc3NvcigodGhpcyBhcyBhbnkpLl9pbnN0YW50aWF0aW9uU2VydmljZSA/PyAodGhpcyBhcyBhbnkpLmluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRcdHRoaXMuX21vdW50UmVzdWx0ID0gbW91bnRQbGNOYXZpZ2F0b3IoY29udGFpbmVyLCBhY2Nlc3Nvcik7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0b0Rpc3Bvc2FibGUoKCkgPT4gdGhpcy5fbW91bnRSZXN1bHQ/LmRpc3Bvc2UoKSkpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoJ1tQbGNOYXZpZ2F0b3JQYW5lXSBNb3VudCBmYWlsZWQ6JywgZSk7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgbGF5b3V0Qm9keShfaDogbnVtYmVyLCBfdzogbnVtYmVyKTogdm9pZCB7XG5cdFx0c3VwZXIubGF5b3V0Qm9keShfaCwgX3cpO1xuXHR9XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBIZWxwZXIgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIGNyZWF0ZUFjY2Vzc29yKGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UgfCB1bmRlZmluZWQpOiBhbnkge1xuXHRpZiAoIWluc3RhbnRpYXRpb25TZXJ2aWNlKSB7XG5cdFx0cmV0dXJuIG5ldyBQcm94eSh7fSwgeyBnZXQ6IChfdCwgcCkgPT4gcCA9PT0gJ2dldCcgPyAoKSA9PiB1bmRlZmluZWQgOiB1bmRlZmluZWQgfSk7XG5cdH1cblx0cmV0dXJuIHtcblx0XHRnZXQ6IChzZXJ2aWNlSWQ6IGFueSkgPT4ge1xuXHRcdFx0dHJ5IHsgcmV0dXJuIGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKChhOiBTZXJ2aWNlc0FjY2Vzc29yKSA9PiBhLmdldChzZXJ2aWNlSWQpKTsgfVxuXHRcdFx0Y2F0Y2ggeyByZXR1cm4gdW5kZWZpbmVkOyB9XG5cdFx0fVxuXHR9O1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgUmVnaXN0ZXIgc2lkZWJhciB2aWV3IGNvbnRhaW5lciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuY29uc3Qgdmlld0NvbnRhaW5lclJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SVZpZXdDb250YWluZXJzUmVnaXN0cnk+KFZpZXdDb250YWluZXJFeHRlbnNpb25zLlZpZXdDb250YWluZXJzUmVnaXN0cnkpO1xuXG5jb25zdCBwbGNDb250YWluZXIgPSB2aWV3Q29udGFpbmVyUmVnaXN0cnkucmVnaXN0ZXJWaWV3Q29udGFpbmVyKFxuXHR7XG5cdFx0aWQ6IFBMQ19WSUVXX0NPTlRBSU5FUl9JRCxcblx0XHR0aXRsZTogbmxzLmxvY2FsaXplMigncGxjRWRpdG9yQ29udGFpbmVyJywgJ0xvZ2ljJyksXG5cdFx0Y3RvckRlc2NyaXB0b3I6IG5ldyBTeW5jRGVzY3JpcHRvcihWaWV3UGFuZUNvbnRhaW5lciwgW1BMQ19WSUVXX0NPTlRBSU5FUl9JRCwge1xuXHRcdFx0bWVyZ2VWaWV3V2l0aENvbnRhaW5lcldoZW5TaW5nbGVWaWV3OiB0cnVlLFxuXHRcdH1dKSxcblx0XHRoaWRlSWZFbXB0eTogZmFsc2UsXG5cdFx0b3JkZXI6IDcsXG5cdFx0aWNvbjogQ29kaWNvbi5jaXJjdWl0Qm9hcmQsXG5cdH0sXG5cdFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyLFxuXHR7IGRvTm90UmVnaXN0ZXJPcGVuQ29tbWFuZDogZmFsc2UsIGlzRGVmYXVsdDogZmFsc2UgfSxcbik7XG5cblJlZ2lzdHJ5LmFzPElWaWV3c1JlZ2lzdHJ5PihWaWV3RXh0ZW5zaW9ucy5WaWV3c1JlZ2lzdHJ5KS5yZWdpc3RlclZpZXdzKFt7XG5cdGlkOiBQTENfTkFWSUdBVE9SX1ZJRVdfSUQsXG5cdG5hbWU6IG5scy5sb2NhbGl6ZTIoJ3BsY05hdmlnYXRvcicsICdMb2dpYyBOYXZpZ2F0b3InKSxcblx0Y3RvckRlc2NyaXB0b3I6IG5ldyBTeW5jRGVzY3JpcHRvcihQbGNOYXZpZ2F0b3JWaWV3UGFuZSksXG5cdGNhblRvZ2dsZVZpc2liaWxpdHk6IGZhbHNlLFxuXHRjYW5Nb3ZlVmlldzogZmFsc2UsXG5cdG9yZGVyOiAxLFxufV0sIHBsY0NvbnRhaW5lcik7XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBBY3Rpb246IG9wZW4gUExDIGVkaXRvciAob3BlbnMgYSBMb2dpY0VkaXRvcklucHV0IGluIHRoZSBlZGl0b3IgYXJlYSkgXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNsYXNzIE9wZW5QbGNFZGl0b3JBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFZPSURfT1BFTl9QTENfRURJVE9SX0FDVElPTl9JRCxcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdvcGVuUGxjRWRpdG9yJywgJ1BsYXhpbzogT3BlbiBQTEMgTG9naWMgRWRpdG9yJyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGNhdGVnb3J5OiBubHMubG9jYWxpemUyKCdwbGF4aW8nLCAnUGxheGlvJyksXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB2aWV3c1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVZpZXdzU2VydmljZSk7XG5cdFx0Ly8gT3BlbiB0aGUgc2lkZWJhciBuYXZpZ2F0b3Jcblx0XHRhd2FpdCB2aWV3c1NlcnZpY2Uub3BlblZpZXcoUExDX05BVklHQVRPUl9WSUVXX0lELCBmYWxzZSk7XG5cblx0XHQvLyBBbHNvIG9wZW4gYSBkZWZhdWx0IExvZ2ljRWRpdG9ySW5wdXQgaW4gdGhlIGVkaXRvciBhcmVhXG5cdFx0Ly8gc28gdGhlIHVzZXIgc2VlcyB0aGUgY2FudmFzIGltbWVkaWF0ZWx5IHJhdGhlciB0aGFuIHRoZSBlbXB0eSBNb25hY28gY3ViZS5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgaW5wdXQgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShcblx0XHRcdFx0TG9naWNFZGl0b3JJbnB1dCxcblx0XHRcdFx0VVJJLnBhcnNlKCdwbGMtbG9naWM6Ly9tYWluL21haW4ubGQuanNvbicpLFxuXHRcdFx0KTtcblx0XHRcdGF3YWl0IGVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcihpbnB1dCwgeyBwaW5uZWQ6IHRydWUgfSk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Y29uc29sZS5lcnJvcignW09wZW5QbGNFZGl0b3JBY3Rpb25dIENvdWxkIG5vdCBvcGVuIExvZ2ljRWRpdG9ySW5wdXQ6JywgZSk7XG5cdFx0fVxuXHR9XG59XG5cbnJlZ2lzdGVyQWN0aW9uMihPcGVuUGxjRWRpdG9yQWN0aW9uKTtcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIExheW91dCBjb250cmlidXRpb246IG92ZXJsYXkgY2FudmFzIG92ZXIgRWRpdG9yUGFydCBvbiBQTEMgdGFiIHN3aXRjaCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vXG4vLyBTdHJhdGVneTogRE8gTk9UIHRvdWNoIHNldFBhcnRIaWRkZW4oRURJVE9SX1BBUlQpIFx1MjAxNCB0aGF0IGNhdXNlcyB0aGUgdGVybWluYWxcbi8vIHBhbmVsIHRvIGZvcmNpYmx5IG9wZW4gKFZTIENvZGUgZW5mb3JjZXMgXCJlZGl0b3IgYW5kIHBhbmVsIGNhbm5vdCBib3RoIGJlIGhpZGRlblwiKS5cbi8vXG4vLyBJbnN0ZWFkOiBtb3VudCB0aGUgUmVhY3QgY2FudmFzIGFzIGEgY2hpbGQgb2YgdGhlIGVkaXRvciBwYXJ0IGNvbnRhaW5lciBpdHNlbGYsXG4vLyBhYnNvbHV0ZWx5IHBvc2l0aW9uZWQgdG8gZmlsbCBpdCAxMDAlLiBXaGVuIFBMQyB0YWIgaXMgYWN0aXZlIHRoZSBjYW52YXMgaXNcbi8vIHZpc2libGUgKHotaW5kZXggYWJvdmUgTW9uYWNvKS4gV2hlbiBhbnkgb3RoZXIgdGFiIGlzIGFjdGl2ZSB0aGUgY2FudmFzIGlzIGhpZGRlbi5cbi8vIE1vbmFjbyBzdGF5cyBpbiB0aGUgRE9NIGJ1dCBpcyBjb3ZlcmVkIFx1MjAxNCBubyBncmlkIG1hbmlwdWxhdGlvbiBuZWVkZWQuXG5cbmNsYXNzIFBsY0xheW91dENvbnRyaWJ1dGlvbiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5jb250cmliLnBsY0xheW91dCc7XG5cblx0cHJpdmF0ZSBfY2FudmFzOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfbW91bnRSZXN1bHQ6IFJldHVyblR5cGU8dHlwZW9mIG1vdW50UGxjRWRpdG9yPiB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVdvcmtiZW5jaExheW91dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYXlvdXRTZXJ2aWNlOiBJV29ya2JlbmNoTGF5b3V0U2VydmljZSxcblx0XHRASVBhbmVDb21wb3NpdGVQYXJ0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHBhbmVDb21wb3NpdGVTZXJ2aWNlOiBJUGFuZUNvbXBvc2l0ZVBhcnRTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fc3luY0Zyb21DdXJyZW50U3RhdGUoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMucGFuZUNvbXBvc2l0ZVNlcnZpY2Uub25EaWRQYW5lQ29tcG9zaXRlT3BlbigoeyBjb21wb3NpdGUsIHZpZXdDb250YWluZXJMb2NhdGlvbiB9KSA9PiB7XG5cdFx0XHRpZiAodmlld0NvbnRhaW5lckxvY2F0aW9uICE9PSBWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhcikgcmV0dXJuO1xuXHRcdFx0aWYgKGNvbXBvc2l0ZS5nZXRJZCgpID09PSBQTENfVklFV19DT05UQUlORVJfSUQpIHtcblx0XHRcdFx0dGhpcy5fYWN0aXZhdGVQTEMoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX2RlYWN0aXZhdGVQTEMoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnBhbmVDb21wb3NpdGVTZXJ2aWNlLm9uRGlkUGFuZUNvbXBvc2l0ZUNsb3NlKCh7IGNvbXBvc2l0ZSwgdmlld0NvbnRhaW5lckxvY2F0aW9uIH0pID0+IHtcblx0XHRcdGlmICh2aWV3Q29udGFpbmVyTG9jYXRpb24gIT09IFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyKSByZXR1cm47XG5cdFx0XHRpZiAoY29tcG9zaXRlLmdldElkKCkgPT09IFBMQ19WSUVXX0NPTlRBSU5FUl9JRCkge1xuXHRcdFx0XHR0aGlzLl9kZWFjdGl2YXRlUExDKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfc3luY0Zyb21DdXJyZW50U3RhdGUoKTogdm9pZCB7XG5cdFx0Y29uc3QgYWN0aXZlID0gdGhpcy5wYW5lQ29tcG9zaXRlU2VydmljZS5nZXRBY3RpdmVQYW5lQ29tcG9zaXRlKFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyKTtcblx0XHRpZiAoYWN0aXZlPy5nZXRJZCgpID09PSBQTENfVklFV19DT05UQUlORVJfSUQpIHtcblx0XHRcdHNldFRpbWVvdXQoKCkgPT4gdGhpcy5fYWN0aXZhdGVQTEMoKSwgMTUwKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9nZXRFZGl0b3JQYXJ0KCk6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkIHtcblx0XHR0cnkge1xuXHRcdFx0cmV0dXJuIHRoaXMubGF5b3V0U2VydmljZS5nZXRDb250YWluZXIod2luZG93LCBQYXJ0cy5FRElUT1JfUEFSVCkgPz8gdW5kZWZpbmVkO1xuXHRcdH0gY2F0Y2ggeyByZXR1cm4gdW5kZWZpbmVkOyB9XG5cdH1cblxuXHRwcml2YXRlIF9nZXRPckNyZWF0ZUNhbnZhcygpOiBIVE1MRWxlbWVudCB7XG5cdFx0aWYgKHRoaXMuX2NhbnZhcykgcmV0dXJuIHRoaXMuX2NhbnZhcztcblxuXHRcdGNvbnN0IGVwID0gdGhpcy5fZ2V0RWRpdG9yUGFydCgpO1xuXHRcdGlmICghZXApIHRocm93IG5ldyBFcnJvcignW1BsY0xheW91dF0gZWRpdG9yIHBhcnQgbm90IGZvdW5kJyk7XG5cblx0XHQvLyBNYWtlIGVkaXRvciBwYXJ0IGEgcG9zaXRpb25pbmcgY29udGV4dCBzbyBvdXIgYWJzb2x1dGUgY2FudmFzIGZpbGxzIGl0IGV4YWN0bHlcblx0XHRpZiAoIWVwLnN0eWxlLnBvc2l0aW9uIHx8IGVwLnN0eWxlLnBvc2l0aW9uID09PSAnc3RhdGljJykge1xuXHRcdFx0ZXAuc3R5bGUucG9zaXRpb24gPSAncmVsYXRpdmUnO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGNhbnZhcy5pZCA9ICdwbGMtbG9naWMtY2FudmFzJztcblx0XHRjYW52YXMuc3R5bGUuY3NzVGV4dCA9IFtcblx0XHRcdCdkaXNwbGF5Om5vbmUnLFxuXHRcdFx0J3Bvc2l0aW9uOmFic29sdXRlJyxcblx0XHRcdCdpbnNldDowJyxcblx0XHRcdCd6LWluZGV4OjEwJyxcblx0XHRcdCdmbGV4LWRpcmVjdGlvbjpjb2x1bW4nLFxuXHRcdFx0J292ZXJmbG93OmhpZGRlbicsXG5cdFx0XHQnYmFja2dyb3VuZDp2YXIoLS12c2NvZGUtZWRpdG9yLWJhY2tncm91bmQpJyxcblx0XHRdLmpvaW4oJzsnKTtcblxuXHRcdGVwLmFwcGVuZENoaWxkKGNhbnZhcyk7XG5cdFx0dGhpcy5fY2FudmFzID0gY2FudmFzO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdHRoaXMuX21vdW50UmVzdWx0Py5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLl9tb3VudFJlc3VsdCA9IHVuZGVmaW5lZDtcblx0XHRcdGNhbnZhcy5yZW1vdmUoKTtcblx0XHRcdHRoaXMuX2NhbnZhcyA9IHVuZGVmaW5lZDtcblx0XHR9KSk7XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgYWNjZXNzb3IgPSBjcmVhdGVBY2Nlc3Nvcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRcdHRoaXMuX21vdW50UmVzdWx0ID0gbW91bnRQbGNFZGl0b3IoY2FudmFzLCBhY2Nlc3Nvcik7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Y29uc29sZS5lcnJvcignW1BsY0xheW91dF0gTW91bnQgZmFpbGVkOicsIGUpO1xuXHRcdH1cblxuXHRcdHJldHVybiBjYW52YXM7XG5cdH1cblxuXHRwcml2YXRlIF9hY3RpdmF0ZVBMQygpOiB2b2lkIHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgY2FudmFzID0gdGhpcy5fZ2V0T3JDcmVhdGVDYW52YXMoKTtcblx0XHRcdGNhbnZhcy5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoJ1tQbGNMYXlvdXRdIGFjdGl2YXRlUExDIGZhaWxlZDonLCBlKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9kZWFjdGl2YXRlUExDKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9jYW52YXMpIHtcblx0XHRcdHRoaXMuX2NhbnZhcy5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdH1cblx0fVxufVxuXG5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIoXG5cdFBsY0xheW91dENvbnRyaWJ1dGlvbi5JRCxcblx0UGxjTGF5b3V0Q29udHJpYnV0aW9uLFxuXHRXb3JrYmVuY2hQaGFzZS5BZnRlclJlc3RvcmVkLFxuKTtcblxuLy8gTk9URTogVGhlIFwiTGlicmFyeVwiIHBhbmVsIGluIHRoZSBFeHBsb3JlciBzaWRlYmFyIGlzIHJlZ2lzdGVyZWQgaW5cbi8vIHBsY0V4cGxvcmVyUGFuZWwudHMsIHdoaWNoIGlzIGltcG9ydGVkIGZyb20gd29ya2JlbmNoLmNvbW1vbi5tYWluLnRzXG4vLyBBRlRFUiBleHBsb3JlclZpZXdsZXQuanMgbG9hZHMgKGxpbmUgMjE2KykuIERvIG5vdCBtb3ZlIHRoYXQgcmVnaXN0cmF0aW9uIGhlcmUuXG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBNb25hY28gb3ZlcmxheSBidXR0b24gZm9yIFBMQyBmaWxlcyBvcGVuZWQgYXMgdGV4dCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vIFdoZW4gYSAubGQuanNvbiAvIC5mYmQuanNvbiAvIC5zZmMuanNvbiBmaWxlIGlzIG9wZW4gaW4gTW9uYWNvICh0ZXh0IGVkaXRvciksXG4vLyBpbmplY3QgYSBmbG9hdGluZyBcIkdyYXBoaWNhbCB8IENvZGVcIiB0b2dnbGUgaW4gdGhlIHRvcC1yaWdodCBvZiB0aGUgZWRpdG9yLlxuLy8gXCJHcmFwaGljYWxcIiByZW9wZW5zIGl0IGluIExvZ2ljRWRpdG9yUGFuZS4gXCJDb2RlXCIgaXMgdGhlIGN1cnJlbnQgdmlldyAoYWN0aXZlKS5cblxuY2xhc3MgUGxjTW9uYWNvT3ZlcmxheUNvbnRyaWJ1dGlvbiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5jb250cmliLnBsY01vbmFjb092ZXJsYXknO1xuXG5cdHByaXZhdGUgX3Rvb2xiYXI6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF90b29sYmFyUGFyZW50OiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmVkaXRvclNlcnZpY2Uub25EaWRBY3RpdmVFZGl0b3JDaGFuZ2UoKCkgPT4gdGhpcy5fc3luYygpKSk7XG5cdFx0dGhpcy5fc3luYygpO1xuXHR9XG5cblx0cHJpdmF0ZSBfaXNQTENGaWxlKHVyaTogVVJJKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgcCA9IHVyaS5wYXRoLnRvTG93ZXJDYXNlKCk7XG5cdFx0cmV0dXJuIHAuZW5kc1dpdGgoJy5sZC5qc29uJykgfHwgcC5lbmRzV2l0aCgnLmZiZC5qc29uJykgfHwgcC5lbmRzV2l0aCgnLnNmYy5qc29uJyk7XG5cdH1cblxuXHRwcml2YXRlIF9zeW5jKCk6IHZvaWQge1xuXHRcdGNvbnN0IGFjdGl2ZSA9IHRoaXMuZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3JQYW5lO1xuXHRcdGNvbnN0IHJlc291cmNlID0gdGhpcy5lZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvcj8ucmVzb3VyY2U7XG5cdFx0Y29uc3QgaXNNb25hY29QTEMgPSByZXNvdXJjZSAmJlxuXHRcdFx0dGhpcy5faXNQTENGaWxlKHJlc291cmNlKSAmJlxuXHRcdFx0YWN0aXZlPy5nZXRJZCgpICE9PSBMb2dpY0VkaXRvclBhbmUuSUQ7XG5cblx0XHRpZiAoaXNNb25hY29QTEMgJiYgcmVzb3VyY2UgJiYgYWN0aXZlKSB7XG5cdFx0XHRjb25zdCBjb250YWluZXIgPSBhY3RpdmUuZ2V0Q29udGFpbmVyPy4oKSE7XG5cdFx0XHRpZiAoY29udGFpbmVyKSB0aGlzLl9lbnN1cmVUb29sYmFyKGNvbnRhaW5lciwgcmVzb3VyY2UpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9yZW1vdmVUb29sYmFyKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfZW5zdXJlVG9vbGJhcihjb250YWluZXI6IEhUTUxFbGVtZW50LCByZXNvdXJjZTogVVJJKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVtb3ZlVG9vbGJhcigpO1xuXG5cdFx0Y29uc3QgZ3JhcGhTZWcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRncmFwaFNlZy50aXRsZSA9ICdPcGVuIGluIFBMQyBncmFwaGljYWwgZWRpdG9yJztcblx0XHRncmFwaFNlZy5zdHlsZS5jc3NUZXh0ID0gW1xuXHRcdFx0J2Rpc3BsYXk6ZmxleCcsICdhbGlnbi1pdGVtczpjZW50ZXInLCAnZ2FwOjVweCcsXG5cdFx0XHQncGFkZGluZzowIDEwcHgnLCAnaGVpZ2h0OjIycHgnLCAnY3Vyc29yOnBvaW50ZXInLFxuXHRcdFx0J2JhY2tncm91bmQ6dmFyKC0tdnNjb2RlLWVkaXRvci1iYWNrZ3JvdW5kKScsXG5cdFx0XHQnY29sb3I6dmFyKC0tdnNjb2RlLWZvcmVncm91bmQpJyxcblx0XHRcdCdmb250LXNpemU6MTJweCcsXG5cdFx0XHQndXNlci1zZWxlY3Q6bm9uZScsXG5cdFx0XHQndHJhbnNpdGlvbjpmaWx0ZXIgMC4xcycsXG5cdFx0XS5qb2luKCc7Jyk7XG5cdFx0Y29uc3QgZ1N2ZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUygnaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnLCAnc3ZnJyk7XG5cdFx0Z1N2Zy5zZXRBdHRyaWJ1dGUoJ3dpZHRoJywgJzEyJyk7IGdTdmcuc2V0QXR0cmlidXRlKCdoZWlnaHQnLCAnMTInKTtcblx0XHRnU3ZnLnNldEF0dHJpYnV0ZSgndmlld0JveCcsICcwIDAgMTYgMTYnKTsgZ1N2Zy5zZXRBdHRyaWJ1dGUoJ2ZpbGwnLCAnY3VycmVudENvbG9yJyk7XG5cdFx0Z1N2Zy5pbm5lckhUTUwgPSAnPHJlY3QgeD1cIjFcIiB5PVwiMVwiIHdpZHRoPVwiNlwiIGhlaWdodD1cIjZcIiByeD1cIjFcIi8+PHJlY3QgeD1cIjlcIiB5PVwiMVwiIHdpZHRoPVwiNlwiIGhlaWdodD1cIjZcIiByeD1cIjFcIi8+PHJlY3QgeD1cIjFcIiB5PVwiOVwiIHdpZHRoPVwiNlwiIGhlaWdodD1cIjZcIiByeD1cIjFcIi8+PHJlY3QgeD1cIjlcIiB5PVwiOVwiIHdpZHRoPVwiNlwiIGhlaWdodD1cIjZcIiByeD1cIjFcIi8+Jztcblx0XHRjb25zdCBnTGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG5cdFx0Z0xhYmVsLnRleHRDb250ZW50ID0gJ0dyYXBoaWNhbCc7XG5cdFx0Z3JhcGhTZWcuYXBwZW5kQ2hpbGQoZ1N2Zyk7XG5cdFx0Z3JhcGhTZWcuYXBwZW5kQ2hpbGQoZ0xhYmVsKTtcblx0XHRncmFwaFNlZy5vbm1vdXNlZW50ZXIgPSAoKSA9PiB7IChncmFwaFNlZyBhcyBIVE1MRWxlbWVudCkuc3R5bGUuZmlsdGVyID0gJ2JyaWdodG5lc3MoMS4zKSc7IH07XG5cdFx0Z3JhcGhTZWcub25tb3VzZWxlYXZlID0gKCkgPT4geyAoZ3JhcGhTZWcgYXMgSFRNTEVsZW1lbnQpLnN0eWxlLmZpbHRlciA9ICcnOyB9O1xuXHRcdGdyYXBoU2VnLm9uY2xpY2sgPSAoKSA9PiB7XG5cdFx0XHRjb25zdCBpbnB1dCA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTG9naWNFZGl0b3JJbnB1dCwgcmVzb3VyY2UpO1xuXHRcdFx0dGhpcy5lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQsIHsgcGlubmVkOiB0cnVlIH0pO1xuXHRcdH07XG5cblx0XHRjb25zdCBjb2RlU2VnID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0Y29kZVNlZy50aXRsZSA9ICdDdXJyZW50IHZpZXc6IGNvZGUgKEpTT04pJztcblx0XHRjb2RlU2VnLnN0eWxlLmNzc1RleHQgPSBbXG5cdFx0XHQnZGlzcGxheTpmbGV4JywgJ2FsaWduLWl0ZW1zOmNlbnRlcicsICdnYXA6NXB4Jyxcblx0XHRcdCdwYWRkaW5nOjAgMTBweCcsICdoZWlnaHQ6MjJweCcsICdjdXJzb3I6ZGVmYXVsdCcsXG5cdFx0XHQnYmFja2dyb3VuZDp2YXIoLS12c2NvZGUtYnV0dG9uLWJhY2tncm91bmQpJyxcblx0XHRcdCdjb2xvcjp2YXIoLS12c2NvZGUtYnV0dG9uLWZvcmVncm91bmQpJyxcblx0XHRcdCdmb250LXNpemU6MTJweCcsICdmb250LXdlaWdodDo2MDAnLFxuXHRcdFx0J3VzZXItc2VsZWN0Om5vbmUnLFxuXHRcdF0uam9pbignOycpO1xuXHRcdGNvbnN0IGNTdmcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoJ2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJywgJ3N2ZycpO1xuXHRcdGNTdmcuc2V0QXR0cmlidXRlKCd3aWR0aCcsICcxMicpOyBjU3ZnLnNldEF0dHJpYnV0ZSgnaGVpZ2h0JywgJzEyJyk7XG5cdFx0Y1N2Zy5zZXRBdHRyaWJ1dGUoJ3ZpZXdCb3gnLCAnMCAwIDE2IDE2Jyk7IGNTdmcuc2V0QXR0cmlidXRlKCdmaWxsJywgJ2N1cnJlbnRDb2xvcicpO1xuXHRcdGNTdmcuaW5uZXJIVE1MID0gJzxwYXRoIGQ9XCJNNS43IDMuMyAxIDhsNC43IDQuNyAxLTFMMi45IDhsMy44LTMuNy0xLTF6bTQuNiAwLTEgMUwxMy4xIDhsLTMuOCAzLjcgMSAxTDE1IDhsLTQuNy00Ljd6XCIvPic7XG5cdFx0Y29uc3QgY0xhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuXHRcdGNMYWJlbC50ZXh0Q29udGVudCA9ICdDb2RlJztcblx0XHRjb2RlU2VnLmFwcGVuZENoaWxkKGNTdmcpO1xuXHRcdGNvZGVTZWcuYXBwZW5kQ2hpbGQoY0xhYmVsKTtcblxuXHRcdGNvbnN0IHBpbGwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRwaWxsLnN0eWxlLmNzc1RleHQgPSBbXG5cdFx0XHQnZGlzcGxheTpmbGV4JywgJ2FsaWduLWl0ZW1zOnN0cmV0Y2gnLFxuXHRcdFx0J2JvcmRlci1yYWRpdXM6MTFweCcsICdvdmVyZmxvdzpoaWRkZW4nLCAnaGVpZ2h0OjIycHgnLFxuXHRcdFx0J2JveC1zaGFkb3c6MCAxcHggM3B4IHJnYmEoMCwwLDAsMC40KScsXG5cdFx0XHQnYm9yZGVyOjFweCBzb2xpZCB2YXIoLS12c2NvZGUtZm9jdXNCb3JkZXIscmdiYSgyNTUsMjU1LDI1NSwwLjE1KSknLFxuXHRcdFx0J2ZsZXgtc2hyaW5rOjAnLFxuXHRcdF0uam9pbignOycpO1xuXHRcdHBpbGwuYXBwZW5kQ2hpbGQoZ3JhcGhTZWcpO1xuXHRcdHBpbGwuYXBwZW5kQ2hpbGQoY29kZVNlZyk7XG5cblx0XHRjb25zdCB0b29sYmFyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0dG9vbGJhci5zZXRBdHRyaWJ1dGUoJ2RhdGEtcGxjLXRvb2xiYXInLCAnMScpO1xuXHRcdHRvb2xiYXIuc3R5bGUuY3NzVGV4dCA9IFtcblx0XHRcdCdkaXNwbGF5OmZsZXgnLCAnYWxpZ24taXRlbXM6Y2VudGVyJyxcblx0XHRcdCdwYWRkaW5nOjAgOHB4Jyxcblx0XHRcdCdiYWNrZ3JvdW5kOnZhcigtLXZzY29kZS1zaWRlQmFyLWJhY2tncm91bmQpJyxcblx0XHRcdCdib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS12c2NvZGUtZWRpdG9yR3JvdXAtYm9yZGVyKScsXG5cdFx0XHQnaGVpZ2h0OjM2cHgnLCAnYm94LXNpemluZzpib3JkZXItYm94JywgJ2ZsZXgtc2hyaW5rOjAnLFxuXHRcdFx0J292ZXJmbG93OmhpZGRlbicsXG5cdFx0XHQnei1pbmRleDoxJyxcblx0XHRdLmpvaW4oJzsnKTtcblx0XHRjb25zdCBzcGFjZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRzcGFjZXIuc3R5bGUuY3NzVGV4dCA9ICdmbGV4OjE7Jztcblx0XHR0b29sYmFyLmFwcGVuZENoaWxkKHNwYWNlcik7XG5cdFx0dG9vbGJhci5hcHBlbmRDaGlsZChwaWxsKTtcblxuXHRcdGNvbnN0IGVkaXRvckVsID0gKGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yKCcuZWRpdG9yLWluc3RhbmNlJykgfHwgY29udGFpbmVyKSBhcyBIVE1MRWxlbWVudDtcblx0XHRlZGl0b3JFbC5pbnNlcnRCZWZvcmUodG9vbGJhciwgZWRpdG9yRWwuZmlyc3RDaGlsZCk7XG5cblx0XHR0aGlzLl90b29sYmFyID0gdG9vbGJhcjtcblx0XHR0aGlzLl90b29sYmFyUGFyZW50ID0gZWRpdG9yRWw7XG5cdH1cblxuXHRwcml2YXRlIF9yZW1vdmVUb29sYmFyKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl90b29sYmFyKSB7XG5cdFx0XHR0aGlzLl90b29sYmFyLnJlbW92ZSgpO1xuXHRcdFx0dGhpcy5fdG9vbGJhciA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMuX3Rvb2xiYXJQYXJlbnQgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG59XG5cbnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMihcblx0UGxjTW9uYWNvT3ZlcmxheUNvbnRyaWJ1dGlvbi5JRCxcblx0UGxjTW9uYWNvT3ZlcmxheUNvbnRyaWJ1dGlvbixcblx0V29ya2JlbmNoUGhhc2UuQWZ0ZXJSZXN0b3JlZCxcbik7XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBWZW5kb3IgRmlsZSBEZXRlY3Rpb24gQ29udHJpYnV0aW9uIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy8gV2hlbiB0aGUgd29ya3NwYWNlIGZvbGRlciBjaGFuZ2VzLCBzY2FuIGZvciB2ZW5kb3IgUExDIGZpbGVzIGFuZCBub3RpZnkgdGhlXG4vLyBSZWFjdCBQbGNOYXZpZ2F0b3IgY29tcG9uZW50IHZpYSB3aW5kb3cucG9zdE1lc3NhZ2Ugc28gaXQgY2FuIHNob3cgdGhlIGltcG9ydCBiYW5uZXIuXG5jbGFzcyBWZW5kb3JGaWxlRGV0ZWN0aW9uQ29udHJpYnV0aW9uIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmNvbnRyaWIucGxjLnZlbmRvckZpbGVEZXRlY3Rpb24nO1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFZFTkRPUl9FWFRFTlNJT05TID0gWycubDV4JywgJy54ZWYnLCAnLnplZicsICcuc3QnLCAnLnNjbCddO1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBWRU5ET1JfWE1MX1NJR05BVFVSRVM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG5cdFx0J1JTTG9naXg1MDAwQ29udGVudCc6ICdyb2Nrd2VsbF9sNXgnLFxuXHRcdCdTVy5CbG9ja3MuQ29tcGlsZVVuaXQnOiAnc2llbWVuc19zaW1hdGljX21sJyxcblx0XHQnU1cuQ29kZUJsb2NrJzogJ3NpZW1lbnNfc2ltYXRpY19tbCcsXG5cdFx0J3BsY29wZW4ub3JnL3htbC90YzZfMDIwMSc6ICdwbGNvcGVuX3htbCcsXG5cdFx0J1Byb2plY3RGaWxlJzogJ3NjaG5laWRlcl94ZWYnLFxuXHRcdCdVbml0eVBybyc6ICdzY2huZWlkZXJfeGVmJyxcblx0fTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd29ya3NwYWNlQ29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLndvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLm9uRGlkQ2hhbmdlV29ya3NwYWNlRm9sZGVycygoKSA9PiB0aGlzLl9zY2FuRm9sZGVycygpKSk7XG5cdFx0Ly8gSW5pdGlhbCBzY2FuIG9uIHN0YXJ0dXAgKGRlYm91bmNlZCB0byBhdm9pZCBibG9ja2luZyBzdGFydHVwKVxuXHRcdHNldFRpbWVvdXQoKCkgPT4gdGhpcy5fc2NhbkZvbGRlcnMoKSwgMzAwMCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9zY2FuRm9sZGVycygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBmb2xkZXJzID0gdGhpcy53b3Jrc3BhY2VDb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKS5mb2xkZXJzO1xuXHRcdGlmIChmb2xkZXJzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuXG5cdFx0Y29uc3QgZGV0ZWN0ZWRGaWxlczogQXJyYXk8eyBuYW1lOiBzdHJpbmc7IHBhdGg6IHN0cmluZzsgZm9ybWF0OiBzdHJpbmcgfT4gPSBbXTtcblxuXHRcdGZvciAoY29uc3QgZm9sZGVyIG9mIGZvbGRlcnMpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IHN0YXQgPSBhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLnJlc29sdmUoZm9sZGVyLnVyaSk7XG5cdFx0XHRcdGlmICghc3RhdC5jaGlsZHJlbikgY29udGludWU7XG5cdFx0XHRcdGZvciAoY29uc3QgY2hpbGQgb2Ygc3RhdC5jaGlsZHJlbikge1xuXHRcdFx0XHRcdGNvbnN0IG5hbWUgPSBjaGlsZC5uYW1lLnRvTG93ZXJDYXNlKCk7XG5cdFx0XHRcdFx0Ly8gQ2hlY2sgZXh0ZW5zaW9uLWJhc2VkIGRldGVjdGlvbiBmaXJzdFxuXHRcdFx0XHRcdGNvbnN0IGV4dCA9ICcuJyArIG5hbWUuc3BsaXQoJy4nKS5wb3AoKTtcblx0XHRcdFx0XHRpZiAoVmVuZG9yRmlsZURldGVjdGlvbkNvbnRyaWJ1dGlvbi5WRU5ET1JfRVhURU5TSU9OUy5pbmNsdWRlcyhleHQpKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBmb3JtYXQgPSBleHQgPT09ICcubDV4JyA/ICdyb2Nrd2VsbF9sNXgnXG5cdFx0XHRcdFx0XHQ6IChleHQgPT09ICcuc3QnIHx8IGV4dCA9PT0gJy5zY2wnKSA/ICdpZWNfc3QnXG5cdFx0XHRcdFx0XHQ6ICdzY2huZWlkZXJfeGVmJztcblx0XHRcdFx0XHRcdGRldGVjdGVkRmlsZXMucHVzaCh7IG5hbWU6IGNoaWxkLm5hbWUsIHBhdGg6IGNoaWxkLnJlc291cmNlLmZzUGF0aCwgZm9ybWF0IH0pO1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdC8vIEZvciAueG1sIGZpbGVzLCB0cnkgY29udGVudC1iYXNlZCBkZXRlY3Rpb25cblx0XHRcdFx0XHRpZiAobmFtZS5lbmRzV2l0aCgnLnhtbCcpKSB7XG5cdFx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5yZWFkRmlsZShjaGlsZC5yZXNvdXJjZSk7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGhlYWQgPSBjb250ZW50LnZhbHVlLnNsaWNlKDAsIDQwOTYpLnRvU3RyaW5nKCk7XG5cdFx0XHRcdFx0XHRcdGZvciAoY29uc3QgW3NpZywgZm9ybWF0XSBvZiBPYmplY3QuZW50cmllcyhWZW5kb3JGaWxlRGV0ZWN0aW9uQ29udHJpYnV0aW9uLlZFTkRPUl9YTUxfU0lHTkFUVVJFUykpIHtcblx0XHRcdFx0XHRcdFx0XHRpZiAoaGVhZC5pbmNsdWRlcyhzaWcpKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRkZXRlY3RlZEZpbGVzLnB1c2goeyBuYW1lOiBjaGlsZC5uYW1lLCBwYXRoOiBjaGlsZC5yZXNvdXJjZS5mc1BhdGgsIGZvcm1hdCB9KTtcblx0XHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSBjYXRjaCB7XG5cdFx0XHRcdFx0XHRcdC8vIFNraXAgdW5yZWFkYWJsZSBmaWxlc1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCB7XG5cdFx0XHRcdC8vIFNraXAgaW5hY2Nlc3NpYmxlIGZvbGRlcnNcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoZGV0ZWN0ZWRGaWxlcy5sZW5ndGggPiAwKSB7XG5cdFx0XHQvLyBQb3N0IHRvIGFsbCB3aW5kb3dzIFx1MjAxNCB0aGUgUmVhY3QgY29tcG9uZW50IGxpc3RlbnMgYW5kIHNob3dzIHRoZSBiYW5uZXJcblx0XHRcdHdpbmRvdy5wb3N0TWVzc2FnZSh7XG5cdFx0XHRcdHR5cGU6ICd2b2x0OnZlbmRvci1maWxlLWRldGVjdGVkJyxcblx0XHRcdFx0ZmlsZXM6IGRldGVjdGVkRmlsZXMsXG5cdFx0XHR9LCAnKicpO1xuXHRcdH1cblx0fVxufVxuXG5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIoXG5cdFZlbmRvckZpbGVEZXRlY3Rpb25Db250cmlidXRpb24uSUQsXG5cdFZlbmRvckZpbGVEZXRlY3Rpb25Db250cmlidXRpb24sXG5cdFdvcmtiZW5jaFBoYXNlLkFmdGVyUmVzdG9yZWQsXG4pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFpQkEsU0FBUyxnQkFBZ0I7QUFDekI7QUFBQSxFQUNDLGNBQWM7QUFBQSxFQUVkO0FBQUEsRUFFQSxjQUFjO0FBQUEsRUFDZDtBQUFBLE9BQ007QUFFUCxTQUFTLGdCQUFrQztBQUMzQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHNCQUFzQjtBQUUvQixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGVBQWU7QUFDeEIsWUFBWSxTQUFTO0FBRXJCLFNBQVMsU0FBUyx1QkFBdUI7QUFDekMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxjQUFjLGtCQUFrQjtBQUN6QyxTQUFTLFdBQVc7QUFDcEIsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxpQ0FBaUM7QUFDMUMsU0FBaUMsZ0NBQWdDLHNCQUFzQjtBQUN2RixTQUFTLHlCQUF5QixhQUFhO0FBQy9DLFNBQVMsZ0JBQWdCLHVCQUF1QjtBQUdoRCxTQUFTLDRCQUFpRDtBQUMxRCxTQUFTLHdCQUFtRTtBQUU1RSxTQUFTLHdCQUF3QixnQ0FBZ0M7QUFHakUsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx1QkFBdUI7QUFHaEMsU0FBUyx5QkFBeUI7QUFLbEMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxnQ0FBZ0M7QUFBQSxDQUt4QyxTQUFTLGVB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
