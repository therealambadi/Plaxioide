/*
 * PLC Explorer Panel — registers LIBRARY and VERIFY as native ViewPanes
 * inside the Explorer container. Also injects the chevron button.
 */

import { Disposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IPaneCompositePartService } from '../../../services/panecomposite/browser/panecomposite.js';
import { ViewContainerLocation, IViewDescriptorService, Extensions as ViewExtensions } from '../../../common/views.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { mountPlcNavigator, mountVerifyPanel } from './react/out/plc-editor-tsx/index.js';
import { ViewPane, IViewPaneOptions } from '../../../browser/parts/views/viewPane.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { VIEW_CONTAINER } from '../../files/browser/explorerViewlet.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const document: any;

function createAccessor(instantiationService: IInstantiationService | undefined): any {
	if (!instantiationService) {
		return new Proxy({}, { get: (_t: any, p: any) => p === 'get' ? () => undefined : undefined });
	}
	return {
		get: (serviceId: any) => {
			try { return instantiationService.invokeFunction((a: ServicesAccessor) => a.get(serviceId)); }
			catch { return undefined; }
		}
	};
}

// ─── LIBRARY ViewPane ───────────────────────────────────────────────────────
class PlcLibraryViewPane extends ViewPane {
	private _mountResult: any;

	constructor(
		options: IViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		container.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;padding:0;background:var(--vscode-sideBar-background);';
		try {
			const accessor = createAccessor(this.instantiationService);
			this._mountResult = mountPlcNavigator(container, accessor);
			this._register(toDisposable(() => { this._mountResult?.dispose(); this._mountResult = undefined; }));
		} catch (e) {
			console.error('[PlcLibraryPane] Mount failed:', e);
		}
	}

	protected override layoutBody(h: number, w: number): void {
		super.layoutBody(h, w);
	}
}

// ─── VERIFY ViewPane ────────────────────────────────────────────────────────
class PlcVerifyViewPane extends ViewPane {
	private _mountResult: any;

	constructor(
		options: IViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		container.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;padding:0;background:var(--vscode-sideBar-background);';
		try {
			this._mountResult = mountVerifyPanel(container);
			this._register(toDisposable(() => { this._mountResult?.dispose(); this._mountResult = undefined; }));
		} catch (e) {
			console.error('[PlcVerifyPane] Mount failed:', e);
		}
	}

	protected override layoutBody(h: number, w: number): void {
		super.layoutBody(h, w);
	}
}

// ─── Register LIBRARY + VERIFY as panes in Explorer container ───────────────
const viewsRegistry = Registry.as<any>(ViewExtensions.ViewsRegistry);
viewsRegistry.registerViews([
	{
		id: 'plc.library',
		name: { value: 'Library', original: 'Library' },
		ctorDescriptor: new SyncDescriptor(PlcLibraryViewPane),
		canToggleVisibility: true,
		canMoveView: false,
		hideByDefault: false,
		collapsed: false,
		order: 10,
		weight: 40,
	},
	{
		id: 'plc.verify',
		name: { value: 'Verify', original: 'Verify' },
		ctorDescriptor: new SyncDescriptor(PlcVerifyViewPane),
		canToggleVisibility: true,
		canMoveView: false,
		hideByDefault: false,
		collapsed: true,
		order: 11,
		weight: 50,
	}
], VIEW_CONTAINER);

// ─── Chevron + Viewlets Menu ────────────────────────────────────────────────
class PlcSidebarPanelContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.plcSidebarPanel';

	private _chevronInjected = false;
	private _closeViewletsMenu: (() => void) | undefined;
	private _viewletsMenuClosedAt: number | undefined;

	constructor(
		@IPaneCompositePartService private readonly _paneCompositeService: IPaneCompositePartService,
		@IWorkbenchLayoutService private readonly _layoutService: IWorkbenchLayoutService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@ICommandService private readonly _commandService: ICommandService,
	) {
		super();
		this._startChevronObserver();

		// Listen for export/simulator open messages from React
		const onMessage = (e: any) => {
			if (e.data?.type === 'volt:open-export') {
				this._commandService.executeCommand('void.openExport');
			} else if (e.data?.type === 'volt:open-simulator') {
				this._commandService.executeCommand('void.openSimulator');
			}
		};
		window.addEventListener('message', onMessage);
		this._register(toDisposable(() => window.removeEventListener('message', onMessage)));
	}

	private _startChevronObserver(): void {
		// Try immediately, then watch DOM for the sidebar to appear
		this._tryInjectChevron();
		const observer = new MutationObserver(() => {
			if (this._chevronInjected) { observer.disconnect(); return; }
			this._tryInjectChevron();
		});
		observer.observe(document.body, { childList: true, subtree: true });
		// Disconnect after 15s regardless
		setTimeout(() => observer.disconnect(), 15000);
		this._register(toDisposable(() => observer.disconnect()));
	}

	private _tryInjectChevron(): void {
		if (this._chevronInjected) return;
		const actionsContainer = document.querySelector('.part.sidebar .header-or-footer .composite-bar-container .composite-bar .monaco-action-bar .actions-container');
		if (!actionsContainer) return;

		const btn = document.createElement('div');
		btn.className = 'codicon codicon-chevron-down plc-viewlets-chevron';
		btn.title = 'Views';
		btn.setAttribute('role', 'button');
		btn.style.cssText = 'width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;border-radius:5px;cursor:pointer;color:var(--vscode-activityBarTop-inactiveForeground,var(--vscode-activityBar-inactiveForeground,#6e6e6e));user-select:none;flex:0 0 auto;';
		btn.addEventListener('mouseenter', () => { btn.style.background = 'var(--vscode-activityBarTop-hoverBackground,rgba(255,255,255,0.05))'; btn.style.color = 'var(--vscode-activityBarTop-foreground,var(--vscode-activityBar-foreground,#e7e7e7))'; });
		btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; btn.style.color = 'var(--vscode-activityBarTop-inactiveForeground,var(--vscode-activityBar-inactiveForeground,#6e6e6e))'; });
		btn.addEventListener('click', (e: any) => { e.stopPropagation(); this._toggleViewletsMenu(btn); });
		actionsContainer.appendChild(btn);
		this._chevronInjected = true;
	}

	private _toggleViewletsMenu(anchor: any): void {
		if (this._closeViewletsMenu) { this._closeViewletsMenu(); return; }
		if (this._viewletsMenuClosedAt && Date.now() - this._viewletsMenuClosedAt < 200) return;

		const sidebar = document.querySelector('.part.sidebar');
		const strip = document.querySelector('.part.sidebar .header-or-footer');
		const sidebarRect = (sidebar ?? anchor).getBoundingClientRect();
		const stripRect = (strip ?? anchor).getBoundingClientRect();

		const menu = document.createElement('div');
		menu.className = 'plc-viewlets-menu';
		menu.style.cssText = `position:fixed;left:${Math.round(sidebarRect.left)}px;top:${Math.round(stripRect.bottom)}px;width:${Math.round(sidebarRect.width)}px;z-index:2500;background:var(--vscode-menu-background,var(--vscode-sideBar-background,#181818));border-bottom:1px solid var(--vscode-sideBar-border,#2b2b2b);border-radius:0;box-shadow:none;padding:4px 0;display:flex;flex-direction:column;font-family:var(--vscode-font-family,-apple-system,BlinkMacSystemFont,sans-serif);font-size:12px;color:var(--vscode-menu-foreground,#cccccc);`;

		const close = () => {
			document.removeEventListener('mousedown', onDocMouseDown, true);
			menu.remove();
			this._closeViewletsMenu = undefined;
			this._viewletsMenuClosedAt = Date.now();
		};
		const onDocMouseDown = (e: any) => {
			if (!menu.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) close();
		};

		const PLAXIO_SIDEBAR_IDS = ['workbench.view.explorer', 'workbench.view.plcEditor', 'workbench.view.search', 'workbench.view.scm'];
		const allComposites = this._paneCompositeService.getPaneComposites(ViewContainerLocation.Sidebar) ?? [];
		const composites = allComposites.filter((c: any) => PLAXIO_SIDEBAR_IDS.includes(c.id));
		const active = this._paneCompositeService.getActivePaneComposite(ViewContainerLocation.Sidebar);

		const addRow = (labelText: string, isActive: boolean, onClick: () => void) => {
			const row = document.createElement('div');
			row.style.cssText = `display:flex;align-items:center;gap:8px;height:26px;padding:0 12px;font-size:12px;cursor:pointer;color:${isActive ? 'var(--vscode-sideBarTitle-foreground,#cccccc)' : 'var(--vscode-descriptionForeground,#9d9d9d)'};`;
			const check = document.createElement('span');
			check.className = 'codicon ' + (isActive ? 'codicon-check' : 'codicon-blank');
			check.style.cssText = 'font-size:12px;width:14px;';
			const label = document.createElement('span');
			label.textContent = labelText;
			label.style.cssText = 'flex:1;';
			const pin = document.createElement('span');
			pin.className = 'codicon codicon-pinned plc-viewlet-pin';
			pin.title = 'Pinned';
			pin.style.cssText = 'font-size:12px;opacity:0.55;';
			row.appendChild(check);
			row.appendChild(label);
			row.appendChild(pin);
			row.addEventListener('mouseenter', () => { row.style.background = 'var(--vscode-list-hoverBackground,rgba(255,255,255,0.06))'; });
			row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });
			row.addEventListener('click', () => { onClick(); close(); });
			menu.appendChild(row);
		};

		composites.forEach((c: any) => {
			const isActive = !!active && c.id === active?.getId();
			addRow(c.name ?? c.id, isActive, () => {
				this._paneCompositeService.openPaneComposite(c.id, ViewContainerLocation.Sidebar, true);
			});
		});
		addRow('Export', false, () => {
			this._commandService.executeCommand('void.openExport').catch((err: any) => console.error('[PlcPanel] openExport failed:', err));
		});
		addRow('Simulator', false, () => {
			this._commandService.executeCommand('void.openSimulator').catch((err: any) => console.error('[PlcPanel] openSimulator failed:', err));
		});

		document.body.appendChild(menu);
		document.addEventListener('mousedown', onDocMouseDown, true);
		this._closeViewletsMenu = close;
	}
}

registerWorkbenchContribution2(
	PlcSidebarPanelContribution.ID,
	PlcSidebarPanelContribution,
	WorkbenchPhase.AfterRestored
);
