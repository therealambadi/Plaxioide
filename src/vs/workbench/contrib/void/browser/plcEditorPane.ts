// @ts-nocheck
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
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { mountPlcEditor, mountTagMonitor, mountVerifyPanel } from './react/out/plc-editor-tsx/index.js';

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

// Vendor file detection imports
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';

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
			/* Hide the redundant title bar in the sidebar Logic panel only */
			.part.sidebar [id="workbench.view.plcEditor"] .composite.title { display: none !important; }
		`;
		if (document.head) { document.head.appendChild(style); }
		else { document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style), { once: true }); }
	}

	const TABS = [
		{ id: 'tag-monitor', label: 'Tag Monitor' },
		{ id: 'verify', label: 'Verify' },
	];

	function tryInject(): boolean {
		const panelPart = document.getElementById('workbench.parts.panel');
		if (!panelPart) { console.log('[PLCPanel] tryInject: no panelPart yet'); return false; }
		const compositeTitle = panelPart.querySelector('.composite.title');
		if (!compositeTitle) { console.log('[PLCPanel] tryInject: panelPart found but no .composite.title yet'); return false; }
		if (panelPart.querySelector('.plc-panel-tabs')) { console.log('[PLCPanel] tryInject: already injected'); return true; }

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
		mountVerifyPanel(tabHosts['verify']);

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

// ─── Verification Engine Message Handler ─────────────────────────────────────
// Listens for 'plaxio:verify-*' messages from the React VerifyPanel and executes
// the ESBMC-PLC+ process, returning results back via postMessage.

(function initVerificationHandler() {
	// Use __require (CommonJS, available in Electron renderer) instead of dynamic import()
	// because verificationService.js uses Node.js APIs only available via __require.
	declare function __require(id: string): any;
	let _verifySvc: any = null;
	function getVerifySvc(): any {
		if (_verifySvc) return _verifySvc;
		try {
			const svcPath = new URL('./verificationService.js', import.meta.url).pathname;
			_verifySvc = __require(svcPath);
		} catch (e1) {
			try {
				const nodePath = __require('path');
				const svcPath = nodePath.join(nodePath.dirname(new URL(import.meta.url).pathname), 'verificationService.js');
				_verifySvc = __require(svcPath);
			} catch (e2) {
				console.error('[Verify] Failed to load verificationService:', e1, e2);
			}
		}
		return _verifySvc;
	}

	const handler = async (event: MessageEvent) => {
		const data = event.data;
		if (!data || typeof data.type !== 'string') return;

		if (data.type === 'plaxio:verify-check-engine') {
			try {
				const svc = getVerifySvc();
				if (!svc) { window.postMessage({ type: 'plaxio:verify-engine-status', available: false, downloadable: true }, '*'); return; }
				const result = svc.discoverEngine();
				window.postMessage({ type: 'plaxio:verify-engine-status', available: result.available, version: result.version, binaryPath: result.binaryPath, mode: result.mode, downloadable: result.downloadable }, '*');
			} catch (err) {
				console.error('[Verify] engine check error:', err);
				window.postMessage({ type: 'plaxio:verify-engine-status', available: false, downloadable: true }, '*');
			}
		}

		if (data.type === 'plaxio:verify-download-engine') {
			try {
				const svc = getVerifySvc();
				if (!svc) { window.postMessage({ type: 'plaxio:verify-download-error', message: 'Service unavailable' }, '*'); return; }
				const result = await svc.downloadEngine((progress: any) => {
					window.postMessage({ type: 'plaxio:verify-download-progress', ...progress }, '*');
				});
				window.postMessage({ type: 'plaxio:verify-engine-status', available: result.available, version: result.version, binaryPath: result.binaryPath, mode: result.mode, downloadable: false }, '*');
			} catch (err: any) {
				window.postMessage({ type: 'plaxio:verify-download-error', message: err?.message ?? String(err) }, '*');
			}
		}

		if (data.type === 'plaxio:verify-run') {
			try {
				const svc = getVerifySvc();
				if (!svc) throw new Error('verificationService not available');
				const result = await svc.runVerification({ runId: data.runId, instrumentedST: data.instrumentedST, propertyIds: data.propertyIds, timeoutMs: data.config.timeoutMs, kInductionDepth: data.config.kInductionDepth, mode: data.config.mode, binaryPath: data.config.binaryPath });
				window.postMessage({ type: 'plaxio:verify-result', ...result }, '*');
			} catch (err: any) {
				window.postMessage({ type: 'plaxio:verify-error', runId: data.runId, message: err?.message ?? String(err) }, '*');
			}
		}

		if (data.type === 'plaxio:verify-cancel') {
			try { const svc = getVerifySvc(); if (svc) svc.cancelRun(data.runId); } catch {}
		}
	};

	window.addEventListener('message', handler);
})();

(function initPlaxioTitleLogo() {
	const style = document.createElement('style');
	style.textContent = `
		.command-center .command-center-center .action-label .search-label { display: none !important; }
		.command-center .command-center-center .action-label .codicon { display: none !important; }
		.command-center .command-center-center .action-label::after {
			content: "Plaxio";
			font-size: 13px;
			font-weight: 600;
			letter-spacing: 0.04em;
			opacity: 0.85;
		}
		.command-center .command-center-center .action-label:hover::after { opacity: 1; }
		.command-center .command-center-center { border: none !important; background: transparent !important; }
		.command-center { border: none !important; background: transparent !important; box-shadow: none !important; }
		.command-center .left, .command-center .right { display: none !important; }
	`;
	if (document.head) document.head.appendChild(style);
	else document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style), { once: true });
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
						return { editor: input, options: { override: LogicEditorPane.ID } };
					},
				},
			));
		}

		// HMI files: *_hmi.json opens in SimulatorEditorPane
		this._register(editorResolverService.registerEditor(
			'**/*_hmi.json',
			{
				id: SimulatorEditorPane.ID,
				label: 'HMI Simulator',
				priority: RegisteredEditorPriority.exclusive,
			},
			{
				singlePerResource: true,
				canSupportResource: (resource: URI) => resource.scheme === 'file',
			},
			{
				createEditorInput: ({ resource }) => {
					const input = this.instantiationService.createInstance(SimulatorEditorInput, resource);
					return { editor: input, options: { override: SimulatorEditorPane.ID } };
				},
			},
		));
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
	{ doNotRegisterOpenCommand: false, isDefault: true },
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
			title: nls.localize2('openPlcEditor', 'Plaxio: Open PLC Logic Editor'),
			f1: true,
			category: nls.localize2('plaxio', 'Plaxio'),
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
		@IEditorService private readonly editorService: IEditorService,
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

		// Hide canvas when a non-LogicEditor becomes the active editor (e.g. Export pane)
		this._register(this.editorService.onDidActiveEditorChange(() => {
			const activePane = this.editorService.activeEditorPane;
			if (activePane && activePane.getId() !== LogicEditorPane.ID) {
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

	private _pill: HTMLElement | undefined;
	private _lastLoadedResource: string | undefined;

	constructor(
		@IEditorService private readonly editorService: IEditorService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IFileService private readonly fileService: IFileService,
	) {
		super();
		this._register(this.editorService.onDidActiveEditorChange(() => this._sync()));
		this._sync();
	}

	private _isPLCFile(uri: URI): boolean {
		const p = uri.path.toLowerCase();
		return p.endsWith('.ld.json') || p.endsWith('.fbd.json') || p.endsWith('.sfc.json');
	}

	private _getLanguage(uri: URI): string {
		const p = uri.path.toLowerCase();
		if (p.endsWith('.ld.json')) return 'LD';
		if (p.endsWith('.fbd.json')) return 'FBD';
		return 'SFC';
	}

	private async _loadTagsFromFile(resource: URI): Promise<void> {
		const key = resource.toString();
		if (this._lastLoadedResource === key) return;
		this._lastLoadedResource = key;
		try {
			const fileContent = await this.fileService.readFile(resource);
			const parsed = JSON.parse(fileContent.value.toString());
			const language = this._getLanguage(resource);
			const tagMap = new Map<string, any>();
			const add = (t: any) => {
				if (t?.name && !tagMap.has(t.name)) {
					tagMap.set(t.name, { name: t.name, address: t.address ?? '', dataType: t.dataType ?? 'BOOL', description: t.description ?? '' });
				}
			};
			if (language === 'LD' && parsed?.rungs) {
				for (const rung of parsed.rungs) {
					for (const el of (rung.elements ?? [])) { add(el.tag); }
				}
			}
			if (parsed?.tags) { for (const t of parsed.tags) add(t); }
			if (parsed?.tagDatabase) { for (const t of parsed.tagDatabase) add(t); }
			const tags = Array.from(tagMap.values());
			if (tags.length > 0) {
				(logicStore as any).setTagDatabase(tags);
				(logicStore as any).addAllTagsToWatchList();
			}
		} catch { /* unreadable or not a PLC file */ }
	}

	private _sync(): void {
		const active = this.editorService.activeEditorPane;
		const resource = this.editorService.activeEditor?.resource;
		const isPLC = resource && this._isPLCFile(resource);

		if (isPLC && resource && active) {
			const isGraphical = active.getId() === LogicEditorPane.ID;
			// Always load tags into store when a PLC file is active (Monaco or graphical)
			if (!isGraphical) {
				this._loadTagsFromFile(resource);
			}
			const container = active.getContainer?.()!;
			if (container) this._ensurePill(container, resource, isGraphical);
		} else {
			this._removePill();
		}
	}

	private _buildSeg(label: string, active: boolean, onClick: (() => void) | null): HTMLElement {
		const ACTIVE_CSS = [
			'display:flex', 'align-items:center', 'gap:5px',
			'padding:0 10px', 'height:22px', 'cursor:default',
			'background:var(--vscode-button-background)',
			'color:var(--vscode-button-foreground)',
			'font-size:11px', 'font-weight:600', 'user-select:none',
		].join(';');
		const INACTIVE_CSS = [
			'display:flex', 'align-items:center', 'gap:5px',
			'padding:0 10px', 'height:22px', 'cursor:pointer',
			'background:var(--vscode-editor-background)',
			'color:var(--vscode-foreground)',
			'font-size:11px', 'user-select:none', 'transition:filter 0.1s',
		].join(';');
		const seg = document.createElement('div');
		seg.title = active ? `Current view: ${label.toLowerCase()}` : `Switch to ${label.toLowerCase()} view`;
		seg.style.cssText = active ? ACTIVE_CSS : INACTIVE_CSS;
		const span = document.createElement('span');
		span.textContent = label;
		seg.appendChild(span);
		if (!active && onClick) {
			seg.onmouseenter = () => { seg.style.filter = 'brightness(1.3)'; };
			seg.onmouseleave = () => { seg.style.filter = ''; };
			seg.onclick = onClick;
		}
		return seg;
	}

	private _ensurePill(container: HTMLElement, resource: URI, isGraphical: boolean): void {
		this._removePill();
		const tryInject = () => {
			const editorActions = container.closest('.editor-group-container')
				?.querySelector('.editor-actions') as HTMLElement | null;
			if (!editorActions) { requestAnimationFrame(tryInject); return; }

			const pill = document.createElement('div');
			pill.setAttribute('data-plc-pill', '1');
			pill.style.cssText = [
				'display:flex', 'align-items:stretch',
				'border-radius:11px', 'overflow:hidden', 'height:22px',
				'box-shadow:0 1px 3px rgba(0,0,0,0.4)',
				'border:1px solid var(--vscode-focusBorder,rgba(255,255,255,0.15))',
				'flex-shrink:0', 'margin:0 4px', 'align-self:center',
			].join(';');

			const graphSeg = this._buildSeg('Graphical', isGraphical, isGraphical ? null : () => {
				const input = this.instantiationService.createInstance(LogicEditorInput, resource);
				this.editorService.openEditor(input, { pinned: true });
			});
			const codeSeg = this._buildSeg('Code', !isGraphical, isGraphical ? () => {
				this.editorService.openEditor({ resource, options: { override: 'default', pinned: true } });
			} : null);

			pill.appendChild(graphSeg);
			pill.appendChild(codeSeg);
			editorActions.insertBefore(pill, editorActions.firstChild);
			this._pill = pill;
		};
		requestAnimationFrame(tryInject);
	}

	private _removePill(): void {
		if (this._pill) {
			this._pill.remove();
			this._pill = undefined;
		}
	}

}

registerWorkbenchContribution2(
	PlcMonacoOverlayContribution.ID,
	PlcMonacoOverlayContribution,
	WorkbenchPhase.AfterRestored,
);

// ─── Simulator Editor/Simulation toggle pill ─────────────────────────────────
// Shows a persistent "Editor | Simulation" toggle on any _hmi.json tab, regardless
// of whether the active pane is SimulatorEditorPane or a Monaco text editor.
// "Editor" = active when Monaco is showing the file; highlights and becomes clickable
// to switch back to the Simulator pane for the same file.
// "Simulation" = active when SimulatorEditorPane is showing the file.
// The pill never disappears while an _hmi.json file is the active tab.
class SimulatorToggleContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.plc.simulatorToggle';
	private _pill: HTMLElement | undefined;

	constructor(@IEditorService private readonly editorService: IEditorService) {
		super();
		this._register(this.editorService.onDidActiveEditorChange(() => this._sync()));
		this._sync();
	}

	private _isHmiResource(resource: import('../../../../base/common/uri.js').URI | undefined): boolean {
		return !!(resource && resource.scheme === 'file' && resource.path.endsWith('_hmi.json'));
	}

	private _sync(): void {
		const active = this.editorService.activeEditorPane;
		if (!active) { this._removePill(); return; }

		const resource = (active as any).input?.resource as import('../../../../base/common/uri.js').URI | undefined;
		const isSimulator = active.getId() === SimulatorEditorPane.ID;
		const isHmiTextEditor = !isSimulator && this._isHmiResource(resource);

		if (isSimulator && this._isHmiResource(resource)) {
			// Simulation pane is active — show pill with "Simulation" highlighted
			const container = active.getContainer?.()!;
			if (container) this._ensurePill(container, resource!, 'simulation', active as any);
		} else if (isHmiTextEditor) {
			// Monaco text editor for _hmi.json is active — show pill with "Editor" highlighted
			const container = active.getContainer?.()!;
			if (container) this._ensurePill(container, resource!, 'editor', null);
		} else {
			this._removePill();
		}
	}

	private _ensurePill(
		container: HTMLElement,
		resource: import('../../../../base/common/uri.js').URI,
		activeMode: 'editor' | 'simulation',
		simPane: any | null,
	): void {
		this._removePill();
		const tryInject = () => {
			const editorActions = container.closest('.editor-group-container')
				?.querySelector('.editor-actions') as HTMLElement | null;
			if (!editorActions) { requestAnimationFrame(tryInject); return; }

			const pill = document.createElement('div');
			pill.setAttribute('data-sim-pill', '1');
			pill.style.cssText = [
				'display:flex', 'align-items:stretch',
				'border-radius:11px', 'overflow:hidden', 'height:22px',
				'box-shadow:0 1px 3px rgba(0,0,0,0.4)',
				'border:1px solid var(--vscode-focusBorder,rgba(255,255,255,0.15))',
				'flex-shrink:0', 'margin:0 4px', 'align-self:center',
			].join(';');

			const mkSeg = (label: string, isActive: boolean, onClick: (() => void) | null) => {
				const seg = document.createElement('div');
				seg.textContent = label;
				seg.style.cssText = [
					'display:flex', 'align-items:center',
					'padding:0 10px', 'height:22px',
					'font-size:11px', 'user-select:none',
					isActive
						? 'background:var(--vscode-button-background);color:var(--vscode-button-foreground);font-weight:600;cursor:default;'
						: 'background:var(--vscode-editor-background);color:var(--vscode-foreground);cursor:pointer;',
				].join(';');
				if (!isActive && onClick) {
					seg.addEventListener('mouseenter', () => { seg.style.filter = 'brightness(1.3)'; });
					seg.addEventListener('mouseleave', () => { seg.style.filter = ''; });
					seg.addEventListener('click', onClick);
				}
				return seg;
			};

			// "Editor" segment: active when Monaco is showing; click opens Monaco for the file
			pill.appendChild(mkSeg('Editor', activeMode === 'editor',
				activeMode === 'editor' ? null : () => {
					// Open the _hmi.json in Monaco text editor (reuses existing tab if open)
					this.editorService.openEditor({ resource, options: { override: 'default', pinned: true } });
				}
			));

			// "Simulation" segment: active when SimulatorEditorPane is showing; click opens simulator
			pill.appendChild(mkSeg('Simulation', activeMode === 'simulation',
				activeMode === 'simulation' ? null : () => {
					// Open the _hmi.json in the SimulatorEditorPane (reuses existing tab if open)
					this.editorService.openEditor({ resource, options: { override: SimulatorEditorPane.ID, pinned: true } });
				}
			));

			editorActions.insertBefore(pill, editorActions.firstChild);
			this._pill = pill;
		};
		requestAnimationFrame(tryInject);
	}

	private _removePill(): void {
		if (this._pill) { this._pill.remove(); this._pill = undefined; }
	}
}

registerWorkbenchContribution2(
	SimulatorToggleContribution.ID,
	SimulatorToggleContribution,
	WorkbenchPhase.AfterRestored,
);

// ─── Vendor File Detection Contribution ──────────────────────────────────────
// When the workspace folder changes, scan for vendor PLC files and notify the
// React PlcNavigator component via window.postMessage so it can show the import banner.
class VendorFileDetectionContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.plc.vendorFileDetection';

	private static readonly VENDOR_EXTENSIONS = ['.l5x', '.xef', '.zef', '.st', '.scl'];
	private static readonly VENDOR_XML_SIGNATURES: Record<string, string> = {
		'RSLogix5000Content': 'rockwell_l5x',
		'SW.Blocks.CompileUnit': 'siemens_simatic_ml',
		'SW.CodeBlock': 'siemens_simatic_ml',
		'plcopen.org/xml/tc6_0201': 'plcopen_xml',
		'ProjectFile': 'schneider_xef',
		'UnityPro': 'schneider_xef',
	};

	constructor(
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@IFileService private readonly fileService: IFileService,
	) {
		super();
		this._register(this.workspaceContextService.onDidChangeWorkspaceFolders(() => this._scanFolders()));
		// Initial scan on startup (debounced to avoid blocking startup)
		setTimeout(() => this._scanFolders(), 3000);
	}

	private async _scanFolders(): Promise<void> {
		const folders = this.workspaceContextService.getWorkspace().folders;
		if (folders.length === 0) return;

		const detectedFiles: Array<{ name: string; path: string; format: string }> = [];

		for (const folder of folders) {
			try {
				const stat = await this.fileService.resolve(folder.uri);
				if (!stat.children) continue;
				for (const child of stat.children) {
					const name = child.name.toLowerCase();
					// Check extension-based detection first
					const ext = '.' + name.split('.').pop();
					if (VendorFileDetectionContribution.VENDOR_EXTENSIONS.includes(ext)) {
						const format = ext === '.l5x' ? 'rockwell_l5x'
						: (ext === '.st' || ext === '.scl') ? 'iec_st'
						: 'schneider_xef';
						detectedFiles.push({ name: child.name, path: child.resource.fsPath, format });
						continue;
					}
					// For .xml files, try content-based detection
					if (name.endsWith('.xml')) {
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
							// Skip unreadable files
						}
					}
				}
			} catch {
				// Skip inaccessible folders
			}
		}

		if (detectedFiles.length > 0) {
			// Post to all windows — the React component listens and shows the banner
			window.postMessage({
				type: 'volt:vendor-file-detected',
				files: detectedFiles,
			}, '*');
		}
	}
}

registerWorkbenchContribution2(
	VendorFileDetectionContribution.ID,
	VendorFileDetectionContribution,
	WorkbenchPhase.AfterRestored,
);

// ─── Simulator Activity Bar Button ───────────────────────────────────────────
// The Simulator is a standalone button in the activity bar — it has no side panel.
// Clicking it opens the FUXA simulator as an editor panel via void.openSimulator.
class SimulatorActivityBarContribution extends Disposable implements IWorkbenchContribution {
	static ID = 'workbench.contrib.plc.simulatorActivityBarButton';

	constructor(
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super();
		this._injectButton();
	}

	private _injectButton(): void {
		const tryInject = () => {
			const activityBarEl = this.layoutService.getContainer(window, Parts.ACTIVITYBAR_PART);
			if (!activityBarEl) {
				setTimeout(tryInject, 100);
				return;
			}

			// Find the composite bar (the top list of icon buttons)
			const compositeBar = activityBarEl.querySelector('.monaco-action-bar ul.actions-container') as HTMLElement | null;
			if (!compositeBar) {
				setTimeout(tryInject, 100);
				return;
			}

			// Build a matching action-item li
			const li = document.createElement('li');
			li.className = 'action-item';
			li.setAttribute('role', 'presentation');

			const a = document.createElement('a');
			a.className = 'action-label codicon codicon-vm';
			a.setAttribute('role', 'button');
			a.setAttribute('aria-label', 'Simulator');
			a.setAttribute('title', 'Simulator');
			a.style.cssText = 'cursor:pointer;';
			a.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.commandService.executeCommand('void.openSimulator');
			});

			li.appendChild(a);

			// Append after the last existing action-item to maintain visual order
			compositeBar.appendChild(li);
		};

		setTimeout(tryInject, 500);
	}
}
registerWorkbenchContribution2(
	SimulatorActivityBarContribution.ID,
	SimulatorActivityBarContribution,
	WorkbenchPhase.AfterRestored,
);

// ─── Simulator Editor (FUXA HMI) ─────────────────────────────────────────────
import { SimulatorEditorInput, SIMULATOR_EDITOR_URI } from './simulatorEditorInput.js';
import { SimulatorEditorPane } from './simulatorEditorPane.js';

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		SimulatorEditorPane,
		SimulatorEditorPane.ID,
		nls.localize('plcSimulatorEditor', 'PLC Simulator'),
	),
	[new SyncDescriptor(SimulatorEditorInput)],
);

class SimulatorEditorInputSerializer implements IEditorSerializer {
	canSerialize(): boolean { return true; }
	serialize(): string { return '{}'; }
	deserialize(): SimulatorEditorInput { return SimulatorEditorInput.getOrCreate(); }
}
Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(SimulatorEditorInput.ID, SimulatorEditorInputSerializer);

// Open Simulator action — used by activity bar button
class OpenSimulatorAction extends Action2 {
	constructor() {
		super({
			id: 'void.openSimulator',
			title: nls.localize2('openSimulator', 'Open Simulator'),
			category: nls.localize2('plaxio', 'Plaxio'),
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);
		await editorService.openEditor(SimulatorEditorInput.getOrCreate(), { pinned: true });
	}
}
registerAction2(OpenSimulatorAction);

// ─── Export Editor (PLC Vendor Export) ───────────────────────────────────────
import { ExportEditorInput, EXPORT_EDITOR_URI } from './exportEditorInput.js';
import { ExportEditorPane } from './exportEditorPane.js';

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		ExportEditorPane,
		ExportEditorPane.ID,
		nls.localize('plcExportEditor', 'PLC Export'),
	),
	[new SyncDescriptor(ExportEditorInput)],
);

class ExportEditorInputSerializer implements IEditorSerializer {
	canSerialize(): boolean { return true; }
	serialize(): string { return '{}'; }
	deserialize(): ExportEditorInput { return ExportEditorInput.getOrCreate(); }
}
Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(ExportEditorInput.ID, ExportEditorInputSerializer);

// Open Export action
class OpenExportAction extends Action2 {
	constructor() {
		super({
			id: 'void.openExport',
			title: nls.localize2('openExport', 'Open Export'),
			category: nls.localize2('plaxio', 'Plaxio'),
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);
		await editorService.openEditor(ExportEditorInput.getOrCreate(), { pinned: true });
	}
}
registerAction2(OpenExportAction);

export {
	SIMULATOR_EDITOR_URI,
	EXPORT_EDITOR_URI,
};
