import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import { IPaneCompositePartService } from "../../../services/panecomposite/browser/panecomposite.js";
import { ViewContainerLocation } from "../../../common/views.js";
import { IWorkbenchLayoutService, Parts } from "../../../services/layout/browser/layoutService.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { mountPlcNavigator, mountVerifyPanel } from "./react/out/plc-editor-tsx/index.js";
import { ViewPane } from "../../../browser/parts/views/viewPane.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as ViewExtensions } from "../../../common/views.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { VIEW_CONTAINER } from "../../files/browser/explorerViewlet.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IViewDescriptorService } from "../../../common/views.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";

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

function createAccessor(instantiationService) {
  if (!instantiationService) {
    return new Proxy({}, { get: (_t, p) => p === "get" ? () => void 0 : void 0 });
  }
  return {
    get: (serviceId) => {
      try { return instantiationService.invokeFunction((a) => a.get(serviceId)); }
      catch { return void 0; }
    }
  };
}

// ─── LIBRARY ViewPane ───────────────────────────────────────────────────────
let PlcLibraryViewPane = class extends ViewPane {
  constructor(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService) {
    super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
  }
  renderBody(container) {
    super.renderBody(container);
    container.style.cssText = "display:flex;flex-direction:column;height:100%;overflow:hidden;padding:0;background:var(--vscode-sideBar-background);";
    try {
      const accessor = createAccessor(this.instantiationService);
      this._mountResult = mountPlcNavigator(container, accessor);
      this._register(toDisposable(() => { this._mountResult?.dispose(); this._mountResult = void 0; }));
    } catch (e) {
      console.error("[PlcLibraryPane] Mount failed:", e);
    }
  }
  layoutBody(h, w) {
    super.layoutBody(h, w);
  }
};
PlcLibraryViewPane = __decorateClass([
  __decorateParam(1, IKeybindingService),
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IViewDescriptorService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, IHoverService)
], PlcLibraryViewPane);

// ─── VERIFY ViewPane ────────────────────────────────────────────────────────
let PlcVerifyViewPane = class extends ViewPane {
  constructor(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService) {
    super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
  }
  renderBody(container) {
    super.renderBody(container);
    container.style.cssText = "display:flex;flex-direction:column;height:100%;overflow:hidden;padding:0;background:var(--vscode-sideBar-background);";
    try {
      this._mountResult = mountVerifyPanel(container);
      this._register(toDisposable(() => { this._mountResult?.dispose(); this._mountResult = void 0; }));
    } catch (e) {
      console.error("[PlcVerifyPane] Mount failed:", e);
    }
  }
  layoutBody(h, w) {
    super.layoutBody(h, w);
  }
};
PlcVerifyViewPane = __decorateClass([
  __decorateParam(1, IKeybindingService),
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IViewDescriptorService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, IHoverService)
], PlcVerifyViewPane);

// ─── Register LIBRARY + VERIFY as panes in Explorer container ───────────────
const viewsRegistry = Registry.as(ViewExtensions.ViewsRegistry);
viewsRegistry.registerViews([
  {
    id: "plc.library",
    name: { value: "Library", original: "Library" },
    ctorDescriptor: new SyncDescriptor(PlcLibraryViewPane),
    canToggleVisibility: true,
    canMoveView: false,
    hideByDefault: false,
    collapsed: false,
    order: 10,
    weight: 40,
  },
  {
    id: "plc.verify",
    name: { value: "Verify", original: "Verify" },
    ctorDescriptor: new SyncDescriptor(PlcVerifyViewPane),
    canToggleVisibility: true,
    canMoveView: false,
    hideByDefault: false,
    collapsed: true,
    order: 11,
    weight: 20,
  }
], VIEW_CONTAINER);

// ─── Chevron + Viewlets Menu (kept from before) ─────────────────────────────
let PlcSidebarPanelContribution = class extends Disposable {
  constructor(_paneCompositeService, _layoutService, _instantiationService, _commandService) {
    super();
    this._paneCompositeService = _paneCompositeService;
    this._layoutService = _layoutService;
    this._instantiationService = _instantiationService;
    this._commandService = _commandService;
    this._chevronInjected = false;
    this._closeViewletsMenu = void 0;

    this._startChevronObserver();

    // Listen for export/simulator open messages from React (global singleton guard)
    if (!window.__plcMsgListenerRegistered) {
      window.__plcMsgListenerRegistered = true;
      const onMessage = (e) => {
        const type = e.data?.type;
        if (type === 'volt:open-export') {
          console.log('[PlcPanel] Received volt:open-export, executing command');
          this._commandService.executeCommand('void.openExport').catch(err => console.error('[PlcPanel] openExport failed:', err));
        } else if (type === 'volt:open-simulator') {
          this._commandService.executeCommand('void.openSimulator').catch(err => console.error('[PlcPanel] openSimulator failed:', err));
        }
      };
      window.addEventListener('message', onMessage);
    }
  }

  _startChevronObserver() {
    this._tryInjectChevron();
    const observer = new MutationObserver(() => {
      if (this._chevronInjected) { observer.disconnect(); return; }
      this._tryInjectChevron();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 15000);
  }

  _tryInjectChevron() {
    if (this._chevronInjected) return;
    const actionsContainer = document.querySelector(".part.sidebar .header-or-footer .composite-bar-container .composite-bar .monaco-action-bar .actions-container");
    if (!actionsContainer) return;

    const btn = document.createElement("div");
    btn.className = "codicon codicon-chevron-down plc-viewlets-chevron";
    btn.title = "Views";
    btn.setAttribute("role", "button");
    btn.style.cssText = "width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;border-radius:5px;cursor:pointer;color:var(--vscode-activityBarTop-inactiveForeground,var(--vscode-activityBar-inactiveForeground,#6e6e6e));user-select:none;flex:0 0 auto;";
    btn.addEventListener("mouseenter", () => { btn.style.background = "var(--vscode-activityBarTop-hoverBackground,rgba(255,255,255,0.05))"; btn.style.color = "var(--vscode-activityBarTop-foreground,var(--vscode-activityBar-foreground,#e7e7e7))"; });
    btn.addEventListener("mouseleave", () => { btn.style.background = "transparent"; btn.style.color = "var(--vscode-activityBarTop-inactiveForeground,var(--vscode-activityBar-inactiveForeground,#6e6e6e))"; });
    btn.addEventListener("click", (e) => { e.stopPropagation(); this._toggleViewletsMenu(btn); });
    actionsContainer.appendChild(btn);
    this._chevronInjected = true;
    console.log("[PlcPanel] viewlets chevron injected into top activity bar");
  }

  _toggleViewletsMenu(anchor) {
    if (this._closeViewletsMenu) { this._closeViewletsMenu(); return; }
    if (this._viewletsMenuClosedAt && Date.now() - this._viewletsMenuClosedAt < 200) return;

    const sidebar = document.querySelector(".part.sidebar");
    const strip = document.querySelector(".part.sidebar .header-or-footer");
    const sidebarRect = (sidebar ?? anchor).getBoundingClientRect();
    const stripRect = (strip ?? anchor).getBoundingClientRect();

    const menu = document.createElement("div");
    menu.className = "plc-viewlets-menu";
    menu.style.cssText = "position:fixed;left:" + Math.round(sidebarRect.left) + "px;top:" + Math.round(stripRect.bottom) + "px;width:" + Math.round(sidebarRect.width) + "px;z-index:2500;background:var(--vscode-menu-background,var(--vscode-sideBar-background,#181818));border-bottom:1px solid var(--vscode-sideBar-border,#2b2b2b);border-radius:0;box-shadow:none;padding:4px 0;display:flex;flex-direction:column;font-family:var(--vscode-font-family,-apple-system,BlinkMacSystemFont,sans-serif);font-size:12px;color:var(--vscode-menu-foreground,#cccccc);";

    const close = () => {
      document.removeEventListener("mousedown", onDocMouseDown, true);
      menu.remove();
      this._closeViewletsMenu = void 0;
      this._viewletsMenuClosedAt = Date.now();
    };
    const onDocMouseDown = (e) => {
      if (!menu.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) close();
    };

    const PLAXIO_SIDEBAR_IDS = ['workbench.view.explorer', 'workbench.view.plcEditor', 'workbench.view.search', 'workbench.view.scm'];
    const allComposites = this._paneCompositeService.getPaneComposites(ViewContainerLocation.Sidebar) ?? [];
    const composites = allComposites.filter(c => PLAXIO_SIDEBAR_IDS.includes(c.id));
    const active = this._paneCompositeService.getActivePaneComposite(ViewContainerLocation.Sidebar);

    const addRow = (labelText, isActive, onClick) => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:8px;height:26px;padding:0 12px;font-size:12px;cursor:pointer;color:" + (isActive ? "var(--vscode-sideBarTitle-foreground,#cccccc)" : "var(--vscode-descriptionForeground,#9d9d9d)") + ";";
      const check = document.createElement("span");
      check.className = "codicon " + (isActive ? "codicon-check" : "codicon-blank");
      check.style.cssText = "font-size:12px;width:14px;";
      const label = document.createElement("span");
      label.textContent = labelText;
      label.style.cssText = "flex:1;";
      const pin = document.createElement("span");
      pin.className = "codicon codicon-pinned plc-viewlet-pin";
      pin.title = "Pinned";
      pin.style.cssText = "font-size:12px;opacity:0.55;";
      row.appendChild(check);
      row.appendChild(label);
      row.appendChild(pin);
      row.addEventListener("mouseenter", () => { row.style.background = "var(--vscode-list-hoverBackground,rgba(255,255,255,0.06))"; });
      row.addEventListener("mouseleave", () => { row.style.background = "transparent"; });
      row.addEventListener("click", () => { onClick(); close(); });
      menu.appendChild(row);
    };

    composites.forEach((c) => {
      const isActive = !!active && c.id === active?.getId();
      addRow(c.name ?? c.id, isActive, () => {
        this._paneCompositeService.openPaneComposite(c.id, ViewContainerLocation.Sidebar, true);
      });
    });
    addRow('Export', false, () => {
      this._commandService.executeCommand('void.openExport').catch(err => console.error('[PlcPanel] openExport failed:', err));
    });
    addRow('Simulator', false, () => {
      this._commandService.executeCommand('void.openSimulator').catch(err => console.error('[PlcPanel] openSimulator failed:', err));
    });

    document.body.appendChild(menu);
    document.addEventListener("mousedown", onDocMouseDown, true);
    this._closeViewletsMenu = close;
  }
};

PlcSidebarPanelContribution.ID = "workbench.contrib.plcSidebarPanel";

PlcSidebarPanelContribution = __decorateClass([
  __decorateParam(0, IPaneCompositePartService),
  __decorateParam(1, IWorkbenchLayoutService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, ICommandService),
], PlcSidebarPanelContribution);

registerWorkbenchContribution2(
  PlcSidebarPanelContribution.ID,
  PlcSidebarPanelContribution,
  WorkbenchPhase.AfterRestored
);
