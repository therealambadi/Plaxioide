/*
 * PLC Logic Editor — Workbench Registration
 *
 * Architecture (Phase 0 — correct implementation):
 *
 *   Sidebar (activity bar → left panel):
 *     ViewContainer "Logic"  →  PlcNavigatorViewPane (navigation tree: Programs / Tags / Library)
 *     Clicking a program opens a LogicEditorInput in the editor area.
 *
 *   Editor area (center):
 *     LogicEditorInput  ←→  LogicEditorPane  (React PLC canvas, replaces Monaco completely)
 *     When a LogicEditorInput is the active editor, Monaco is never instantiated for that group.
 *     No div-hiding, no z-index hacks, no PlcCenterSwapContribution needed.
 *
 * This is the same mechanism VS Code uses for Settings UI, Keybindings Editor, Welcome page, etc.
 */

import { Registry } from '../../../../platform/registry/common/platform.js';
import {
	Extensions as ViewContainerExtensions,
	IViewContainersRegistry,
	ViewContainerLocation,
	IViewsRegistry,
	Extensions as ViewExtensions,
	IViewDescriptorService,
} from '../../../common/views.js';

import { ViewPane, IViewPaneOptions } from '../../../browser/parts/views/viewPane.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';

import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { Codicon } from '../../../../base/common/codicons.js';
import * as nls from '../../../../nls.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { toDisposable, Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IPaneCompositePartService } from '../../../services/panecomposite/browser/panecomposite.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { mountPlcEditor, mountTagMonitor } from './react/out/plc-editor-tsx/index.js';

// Editor registration imports
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { EditorExtensions, IEditorFactoryRegistry, IEditorSerializer } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { IEditorResolverService, RegisteredEditorPriority } from '../../../services/editor/common/editorResolverService.js';

// Our custom editor pair
import { LogicEditorInput } from './logicEditorInput.js';
import { LogicEditorPane } from './logicEditorPane.js';

// React mount functions
import { mountPlcNavigator } from './react/out/plc-editor-tsx/index.js';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const document: any;

// ─── Bottom panel injection (Console / Tag Monitor / Runtime tabs) ────────────
// Runs synchronously at module load. Hides native VS Code panel tabs and injects
// our three React-backed tabs. Uses MutationObserver so there is no timing race.
(function initPLCPanel() {
	const STYLE_ID = 'plc-panel-style';
	if (!document.getElementById(STYLE_ID)) {
		const style = document.createElement('style');
		style.id = STYLE_ID;
		style.textContent = `
			#workbench\\.parts\\.panel .composite-bar-container,
			#workbench\\.parts\\.panel .composite-bar { display: none !important; }
			#workbench\\.parts\\.panel .content > .composite,
			#workbench\\.parts\\.panel .content > .view-instance,
			#workbench\\.parts\\.panel .content > .split-view-container { display: none !important; }
			#workbench\\.parts\\.panel .title .title-label { display: none !important; }
		`;
		if (document.head) { document.head.appendChild(style); }
		else { document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style), { once: true }); }
	}

	const TABS = [
		{ id: 'tag-monitor', label: 'Tag Monitor' },
	];

	function tryInject(): boolean {
		const panelPart = document.getElementById('workbench.parts.panel');
		if (!panelPart) return false;
		const compositeTitle = panelPart.querySelector('.composite.title');
		if (!compositeTitle) return false;
		if (panelPart.querySelector('.plc-panel-tabs')) return true;

		panelPart.style.position = 'relative';
		const tabHosts: Record<string, HTMLElement> = {};
		TABS.forEach(tab => {
			const host = document.createElement('div');
			host.className = 'plc-panel-content';
			host.dataset.tabContent = tab.id;
			host.style.cssText = [
				'position:absolute', 'left:0', 'right:0', 'bottom:0', 'top:35px',
				'overflow:hidden', 'z-index:10', 'display:none',
				'background:var(--vscode-panel-background,var(--vscode-editor-background))',
			].join(';');
			panelPart.appendChild(host);
			tabHosts[tab.id] = host;
		});

		mountTagMonitor(tabHosts['tag-monitor']);

		const tabBar = document.createElement('div');
		tabBar.className = 'plc-panel-tabs';
		tabBar.style.cssText = 'display:flex;align-items:stretch;height:100%;overflow:hidden;';

		let activeTab = 'console';
		const showTab = (id: string) => {
			activeTab = id;
			TABS.forEach(t => {
				tabHosts[t.id].style.display = t.id === id ? 'block' : 'none';
			});
			tabBar.querySelectorAll('.plc-tab').forEach((btn: any) => {
				const isActive = btn.dataset.tab === id;
				btn.style.color = isActive
					? 'var(--vscode-panelTitle-activeForeground,var(--vscode-foreground))'
					: 'var(--vscode-panelTitle-inactiveForeground,var(--vscode-descriptionForeground))';
				btn.style.borderTop = isActive
					? '1px solid var(--vscode-panelTitle-activeBorder,var(--vscode-focusBorder))'
					: '1px solid transparent';
				btn.style.fontWeight = isActive ? '600' : '400';
			});
		};

		TABS.forEach(tab => {
			const btn = document.createElement('div');
			btn.className = 'plc-tab';
			btn.dataset.tab = tab.id;
			btn.textContent = tab.label;
			btn.style.cssText = [
				'display:flex', 'align-items:center', 'padding:0 12px',
				'cursor:pointer', 'font-size:12px', 'user-select:none',
				'border-top:1px solid transparent', 'box-sizing:border-box',
				'color:var(--vscode-panelTitle-inactiveForeground,var(--vscode-descriptionForeground))',
			].join(';');
			btn.addEventListener('click', () => showTab(tab.id));
			tabBar.appendChild(btn);
		});

		compositeTitle.appendChild(tabBar);
		showTab('tag-monitor');
		return true;
	}

	if (!tryInject()) {
		const obs = new MutationObserver(() => { if (tryInject()) obs.disconnect(); });
		obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
	}
})();

// ─── IDs ──────────────────────────────────────────────────────────────────────

export const PLC_VIEW_CONTAINER_ID   = 'workbench.view.plcEditor';
export const PLC_NAVIGATOR_VIEW_ID   = 'workbench.view.plcNavigator';
export const VOID_OPEN_PLC_EDITOR_ACTION_ID = 'void.openPlcEditor';

// ─── LogicEditorPane + LogicEditorInput registration ─────────────────────────
// This is the core fix: register a real EditorPane/EditorInput pair so the
// editor area is fully replaced by our React canvas — Monaco never runs here.

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		LogicEditorPane,
		LogicEditorPane.ID,
		nls.localize('plcLogicEditor', 'PLC Logic Editor'),
	),
	[new SyncDescriptor(LogicEditorInput)],
);

class LogicEditorInputSerializer implements IEditorSerializer {
	canSerialize(_input: EditorInput): boolean { return true; }
	serialize(_input: EditorInput): string { return JSON.stringify({ resource: (_input as LogicEditorInput).resource.toString() }); }
	deserialize(instantiationService: IInstantiationService, serialized: string): LogicEditorInput {
		try {
			const { resource } = JSON.parse(serialized);
			return instantiationService.createInstance(LogicEditorInput, URI.parse(resource));
		} catch {
			return instantiationService.createInstance(LogicEditorInput, URI.parse('plc-logic://main/main.ld.json'));
		}
	}
}

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory)
	.registerEditorSerializer(LogicEditorInput.ID, LogicEditorInputSerializer);

// ─── Editor Resolver Registration ────────────────────────────────────────────
// Registers glob patterns so clicking .ld.json / .fbd.json / .sfc.json files in
// the Explorer opens LogicEditorPane instead of the default text editor.

class PlcEditorResolverContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.plcEditorResolver';

	constructor(
		@IEditorResolverService editorResolverService: IEditorResolverService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super();

		const patterns = ['*.ld.json', '*.fbd.json', '*.sfc.json'];
		for (const pattern of patterns) {
			this._register(editorResolverService.registerEditor(
				`**/${pattern}`,
				{
					id: LogicEditorPane.ID,
					label: 'PLC Logic Editor',
					priority: RegisteredEditorPriority.exclusive,
				},
				{
					singlePerResource: true,
					canSupportResource: (resource: URI) => resource.scheme === 'file',
				},
				{
					createEditorInput: ({ resource }) => {
						const input = this.instantiationService.createInstance(LogicEditorInput, resource);
						return { editor: input };
					},
				},
			));
		}
	}
}

registerWorkbenchContribution2(
	PlcEditorResolverContribution.ID,
	PlcEditorResolverContribution,
	WorkbenchPhase.BlockRestore,
);

// ─── Sidebar Navigator ViewPane ───────────────────────────────────────────────
// This is a NAVIGATION TREE ONLY — clicking a program here opens a LogicEditorInput
// in the editor area (same pattern as Explorer → open file → Monaco).
// It does NOT render the canvas itself.

class PlcNavigatorViewPane extends ViewPane {
	private _mountResult: ReturnType<typeof mountPlcNavigator> | undefined;

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
		container.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;padding:0;background:var(--vscode-sideBar-background,var(--void-bg-2));';
		try {
			const accessor = createAccessor((this as any)._instantiationService ?? (this as any).instantiationService);
			this._mountResult = mountPlcNavigator(container, accessor);
			this._register(toDisposable(() => this._mountResult?.dispose()));
		} catch (e) {
			console.error('[PlcNavigatorPane] Mount failed:', e);
		}
	}

	override layoutBody(_h: number, _w: number): void {
		super.layoutBody(_h, _w);
	}
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function createAccessor(instantiationService: IInstantiationService | undefined): any {
	if (!instantiationService) {
		return new Proxy({}, { get: (_t, p) => p === 'get' ? () => undefined : undefined });
	}
	return {
		get: (serviceId: any) => {
			try { return instantiationService.invokeFunction((a: ServicesAccessor) => a.get(serviceId)); }
			catch { return undefined; }
		}
	};
}

// ─── Register sidebar view container ─────────────────────────────────────────

const viewContainerRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);

const plcContainer = viewContainerRegistry.registerViewContainer(
	{
		id: PLC_VIEW_CONTAINER_ID,
		title: nls.localize2('plcEditorContainer', 'Logic'),
		ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [PLC_VIEW_CONTAINER_ID, {
			mergeViewWithContainerWhenSingleView: true,
		}]),
		hideIfEmpty: false,
		order: 7,
		icon: Codicon.circuitBoard,
	},
	ViewContainerLocation.Sidebar,
	{ doNotRegisterOpenCommand: false, isDefault: false },
);

Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([{
	id: PLC_NAVIGATOR_VIEW_ID,
	name: nls.localize2('plcNavigator', 'Logic Navigator'),
	ctorDescriptor: new SyncDescriptor(PlcNavigatorViewPane),
	canToggleVisibility: false,
	canMoveView: false,
	order: 1,
}], plcContainer);

// ─── Action: open PLC editor (opens a LogicEditorInput in the editor area) ───

class OpenPlcEditorAction extends Action2 {
	constructor() {
		super({
			id: VOID_OPEN_PLC_EDITOR_ACTION_ID,
			title: nls.localize2('openPlcEditor', 'Volt: Open PLC Logic Editor'),
			f1: true,
			category: nls.localize2('volt', 'Volt'),
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const viewsService = accessor.get(IViewsService);
		// Open the sidebar navigator
		await viewsService.openView(PLC_NAVIGATOR_VIEW_ID, false);

		// Also open a default LogicEditorInput in the editor area
		// so the user sees the canvas immediately rather than the empty Monaco cube.
		try {
			const instantiationService = accessor.get(IInstantiationService);
			const editorService = accessor.get(IEditorService);
			const input = instantiationService.createInstance(
				LogicEditorInput,
				URI.parse('plc-logic://main/main.ld.json'),
			);
			await editorService.openEditor(input, { pinned: true });
		} catch (e) {
			console.error('[OpenPlcEditorAction] Could not open LogicEditorInput:', e);
		}
	}
}

registerAction2(OpenPlcEditorAction);

// ─── Layout contribution: overlay canvas over EditorPart on PLC tab switch ────
//
// Strategy: DO NOT touch setPartHidden(EDITOR_PART) — that causes the terminal
// panel to forcibly open (VS Code enforces "editor and panel cannot both be hidden").
//
// Instead: mount the React canvas as a child of the editor part container itself,
// absolutely positioned to fill it 100%. When PLC tab is active the canvas is
// visible (z-index above Monaco). When any other tab is active the canvas is hidden.
// Monaco stays in the DOM but is covered — no grid manipulation needed.

class PlcLayoutContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.plcLayout';

	private _canvas: HTMLElement | undefined;
	private _mountResult: ReturnType<typeof mountPlcEditor> | undefined;

	constructor(
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IPaneCompositePartService private readonly paneCompositeService: IPaneCompositePartService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super();

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
	}

	private _syncFromCurrentState(): void {
		const active = this.paneCompositeService.getActivePaneComposite(ViewContainerLocation.Sidebar);
		if (active?.getId() === PLC_VIEW_CONTAINER_ID) {
			setTimeout(() => this._activatePLC(), 150);
		}
	}

	private _getEditorPart(): HTMLElement | undefined {
		try {
			return this.layoutService.getContainer(window, Parts.EDITOR_PART) ?? undefined;
		} catch { return undefined; }
	}

	private _getOrCreateCanvas(): HTMLElement {
		if (this._canvas) return this._canvas;

		const ep = this._getEditorPart();
		if (!ep) throw new Error('[PlcLayout] editor part not found');

		// Make editor part a positioning context so our absolute canvas fills it exactly
		if (!ep.style.position || ep.style.position === 'static') {
			ep.style.position = 'relative';
		}

		const canvas = document.createElement('div');
		canvas.id = 'plc-logic-canvas';
		canvas.style.cssText = [
			'display:none',
			'position:absolute',
			'inset:0',
			'z-index:10',
			'flex-direction:column',
			'overflow:hidden',
			'background:var(--vscode-editor-background)',
		].join(';');

		ep.appendChild(canvas);
		this._canvas = canvas;

		this._register(toDisposable(() => {
			this._mountResult?.dispose();
			this._mountResult = undefined;
			canvas.remove();
			this._canvas = undefined;
		}));

		try {
			const accessor = createAccessor(this.instantiationService);
			this._mountResult = mountPlcEditor(canvas, accessor);
		} catch (e) {
			console.error('[PlcLayout] Mount failed:', e);
		}

		return canvas;
	}

	private _activatePLC(): void {
		try {
			const canvas = this._getOrCreateCanvas();
			canvas.style.display = 'flex';
		} catch (e) {
			console.error('[PlcLayout] activatePLC failed:', e);
		}
	}

	private _deactivatePLC(): void {
		if (this._canvas) {
			this._canvas.style.display = 'none';
		}
	}
}

registerWorkbenchContribution2(
	PlcLayoutContribution.ID,
	PlcLayoutContribution,
	WorkbenchPhase.AfterRestored,
);

// NOTE: The "Library" panel in the Explorer sidebar is registered in
// plcExplorerPanel.ts, which is imported from workbench.common.main.ts
// AFTER explorerViewlet.js loads (line 216+). Do not move that registration here.

// ─── Monaco overlay button for PLC files opened as text ──────────────────────
// When a .ld.json / .fbd.json / .sfc.json file is open in Monaco (text editor),
// inject a floating "Graphical | Code" toggle in the top-right of the editor.
// "Graphical" reopens it in LogicEditorPane. "Code" is the current view (active).

class PlcMonacoOverlayContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.plcMonacoOverlay';

	private _toolbar: HTMLElement | undefined;
	private _toolbarParent: HTMLElement | undefined;

	constructor(
		@IEditorService private readonly editorService: IEditorService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super();
		this._register(this.editorService.onDidActiveEditorChange(() => this._sync()));
		this._sync();
	}

	private _isPLCFile(uri: URI): boolean {
		const p = uri.path.toLowerCase();
		return p.endsWith('.ld.json') || p.endsWith('.fbd.json') || p.endsWith('.sfc.json');
	}

	private _sync(): void {
		const active = this.editorService.activeEditorPane;
		const resource = this.editorService.activeEditor?.resource;
		const isMonacoPLC = resource &&
			this._isPLCFile(resource) &&
			active?.getId() !== LogicEditorPane.ID;

		if (isMonacoPLC && resource && active) {
			const container = active.getContainer?.()!;
			if (container) this._ensureToolbar(container, resource);
		} else {
			this._removeToolbar();
		}
	}

	private _ensureToolbar(container: HTMLElement, resource: URI): void {
		this._removeToolbar();

		const graphSeg = document.createElement('div');
		graphSeg.title = 'Open in PLC graphical editor';
		graphSeg.style.cssText = [
			'display:flex', 'align-items:center', 'gap:5px',
			'padding:0 10px', 'height:22px', 'cursor:pointer',
			'background:var(--vscode-editor-background)',
			'color:var(--vscode-foreground)',
			'font-size:12px',
			'user-select:none',
			'transition:filter 0.1s',
		].join(';');
		const gSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		gSvg.setAttribute('width', '12'); gSvg.setAttribute('height', '12');
		gSvg.setAttribute('viewBox', '0 0 16 16'); gSvg.setAttribute('fill', 'currentColor');
		gSvg.innerHTML = '<rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/>';
		const gLabel = document.createElement('span');
		gLabel.textContent = 'Graphical';
		graphSeg.appendChild(gSvg);
		graphSeg.appendChild(gLabel);
		graphSeg.onmouseenter = () => { (graphSeg as HTMLElement).style.filter = 'brightness(1.3)'; };
		graphSeg.onmouseleave = () => { (graphSeg as HTMLElement).style.filter = ''; };
		graphSeg.onclick = () => {
			const input = this.instantiationService.createInstance(LogicEditorInput, resource);
			this.editorService.openEditor(input, { pinned: true });
		};

		const codeSeg = document.createElement('div');
		codeSeg.title = 'Current view: code (JSON)';
		codeSeg.style.cssText = [
			'display:flex', 'align-items:center', 'gap:5px',
			'padding:0 10px', 'height:22px', 'cursor:default',
			'background:var(--vscode-button-background)',
			'color:var(--vscode-button-foreground)',
			'font-size:12px', 'font-weight:600',
			'user-select:none',
		].join(';');
		const cSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		cSvg.setAttribute('width', '12'); cSvg.setAttribute('height', '12');
		cSvg.setAttribute('viewBox', '0 0 16 16'); cSvg.setAttribute('fill', 'currentColor');
		cSvg.innerHTML = '<path d="M5.7 3.3 1 8l4.7 4.7 1-1L2.9 8l3.8-3.7-1-1zm4.6 0-1 1L13.1 8l-3.8 3.7 1 1L15 8l-4.7-4.7z"/>';
		const cLabel = document.createElement('span');
		cLabel.textContent = 'Code';
		codeSeg.appendChild(cSvg);
		codeSeg.appendChild(cLabel);

		const pill = document.createElement('div');
		pill.style.cssText = [
			'display:flex', 'align-items:stretch',
			'border-radius:11px', 'overflow:hidden', 'height:22px',
			'box-shadow:0 1px 3px rgba(0,0,0,0.4)',
			'border:1px solid var(--vscode-focusBorder,rgba(255,255,255,0.15))',
			'flex-shrink:0',
		].join(';');
		pill.appendChild(graphSeg);
		pill.appendChild(codeSeg);

		const toolbar = document.createElement('div');
		toolbar.setAttribute('data-plc-toolbar', '1');
		toolbar.style.cssText = [
			'display:flex', 'align-items:center',
			'padding:0 8px',
			'background:var(--vscode-sideBar-background)',
			'border-bottom:1px solid var(--vscode-editorGroup-border)',
			'height:36px', 'box-sizing:border-box', 'flex-shrink:0',
			'overflow:hidden',
			'z-index:1',
		].join(';');
		const spacer = document.createElement('div');
		spacer.style.cssText = 'flex:1;';
		toolbar.appendChild(spacer);
		toolbar.appendChild(pill);

		const editorEl = (container.querySelector('.editor-instance') || container) as HTMLElement;
		editorEl.insertBefore(toolbar, editorEl.firstChild);

		this._toolbar = toolbar;
		this._toolbarParent = editorEl;
	}

	private _removeToolbar(): void {
		if (this._toolbar) {
			this._toolbar.remove();
			this._toolbar = undefined;
			this._toolbarParent = undefined;
		}
	}
}

registerWorkbenchContribution2(
	PlcMonacoOverlayContribution.ID,
	PlcMonacoOverlayContribution,
	WorkbenchPhase.AfterRestored,
);
