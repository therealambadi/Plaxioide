// @ts-nocheck
/*
 * SimulatorEditorPane — renders the FUXA HMI in an editor tab.
 * Header: "Editor | Simulation" toggle pill.
 *   Editor     → http://127.0.0.1:1881/editor   (FUXA design canvas)
 *   Simulation → http://127.0.0.1:1881/          (FUXA runtime view)
 * File-backed inputs load the project into FUXA via its REST API before showing.
 */

import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Dimension } from '../../../../base/browser/dom.js';
import { toDisposable } from '../../../../base/common/lifecycle.js';
import { SimulatorEditorInput } from './simulatorEditorInput.js';
import { IFileService } from '../../../../platform/files/common/files.js';

const PLAXIO_SIM_PORT = 1881;
const PLAXIO_SIM_BASE = `http://127.0.0.1:${PLAXIO_SIM_PORT}`;
const FUXA_EDITOR_URL = `${PLAXIO_SIM_BASE}/editor`;
const FUXA_SIMULATION_URL = `${PLAXIO_SIM_BASE}/`;

type SimMode = 'editor' | 'simulation';

export class SimulatorEditorPane extends EditorPane {
	static readonly ID = 'workbench.editor.plcSimulatorEditor';

	private _container: HTMLElement | undefined;
	private _frame: HTMLElement | undefined;
	private _overlay: HTMLElement | undefined;
	private _mode: SimMode = 'simulation';
	private _viewName: string | undefined;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IFileService private readonly fileService: IFileService,
	) {
		super(SimulatorEditorPane.ID, group, telemetryService, themeService, storageService);
	}

	// Called by SimulatorToggleContribution to switch modes
	setMode(mode: SimMode): void {
		if (this._mode === mode) return;
		this._mode = mode;
		if (this._overlay) this._overlay.style.display = 'flex';
		this._loadFuxa();
	}

	getMode(): SimMode { return this._mode; }

	protected createEditor(parent: HTMLElement): void {
		parent.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;background:var(--vscode-editor-background);';
		const onThemeRequest = (event: MessageEvent) => {
			if (event.data?.type === 'volt:request-theme' && event.source === (this._frame as HTMLIFrameElement | undefined)?.contentWindow) {
				this._sendThemeTokens();
			}
		};
		window.addEventListener('message', onThemeRequest);
		this._register(toDisposable(() => window.removeEventListener('message', onThemeRequest)));

		const overlay = document.createElement('div');
		overlay.style.cssText = [
			'position:absolute', 'inset:0', 'display:flex', 'align-items:center',
			'justify-content:center', 'background:var(--vscode-editor-background)', 'color:var(--vscode-editor-foreground)',
			'font-size:13px', 'z-index:10', 'flex-direction:column', 'gap:8px',
		].join(';');
		overlay.textContent = 'Loading Plaxio Simulator...';
		this._overlay = overlay;

		const frame = document.createElement('iframe') as HTMLIFrameElement;
		(frame as any).style.cssText = 'position:absolute;inset:0;border:none;width:100%;height:100%;background:var(--vscode-editor-background);';
		(frame as any).allow = 'clipboard-read; clipboard-write';

		const wrapper = document.createElement('div');
		wrapper.style.cssText = 'flex:1;position:relative;overflow:hidden;';
		wrapper.appendChild(overlay);
		wrapper.appendChild(frame);
		this._frame = frame;
		this._container = wrapper;
		parent.appendChild(wrapper);

		this._loadFuxa();

		this._register(toDisposable(() => {
			if (this._frame) {
				(this._frame as HTMLIFrameElement).src = 'about:blank';
				this._frame = undefined;
			}
		}));
	}

	private _loadFuxa(): void {
		if (!this._frame) return;
		const simUrl = this._viewName
			? `http://127.0.0.1:1881/home/${encodeURIComponent(this._viewName)}`
			: FUXA_SIMULATION_URL;
		const url = this._mode === 'editor' ? FUXA_EDITOR_URL : simUrl;

		const pollReady = (elapsed: number) => {
			if (!this._frame) return;
			if (elapsed >= 30000) {
				if (this._overlay) {
					this._overlay.textContent = 'Plaxio Simulator failed to start (timeout after 30s)';
					this._overlay.style.display = '';
				}
				return;
			}
			fetch(`${PLAXIO_SIM_BASE}/api/project`, { method: 'HEAD' }).then(() => {
				this._setFrameSrc(url);
			}).catch(() => {
				setTimeout(() => pollReady(elapsed + 200), 200);
			});
		};
		pollReady(0);
	}

	private _setFrameSrc(url: string): void {
		if (!this._frame) return;
		const frame = this._frame as HTMLIFrameElement;
		frame.onload = () => {
			if (this._overlay) this._overlay.style.display = 'none';
			this._sendThemeTokens();
			if (this._viewName) {
				setTimeout(() => this._postSelectView(this._viewName!), 600);
			}
		};
		frame.onerror = () => {
			if (this._overlay) this._overlay.textContent = 'Plaxio Simulator not ready — retrying...';
			setTimeout(() => this._loadFuxa(), 2000);
		};
		frame.src = url;
	}

	private _postSelectView(viewName: string): void {
		const frame = this._frame as HTMLIFrameElement | undefined;
		if (!frame?.contentWindow || !viewName) return;
		// Single message: reload project then select view atomically — avoids race condition
		frame.contentWindow.postMessage({ type: 'volt:reload-and-select', viewName }, '*');
	}

	override async setInput(
		input: SimulatorEditorInput,
		options: IEditorOptions | undefined,
		context: IEditorOpenContext,
		token: CancellationToken,
	): Promise<void> {
		await super.setInput(input, options, context, token);
		this._mode = 'simulation';
		this._viewName = undefined;
		if (input.isFileBacked && input.resource.scheme === 'file') {
			// Show loading overlay while pushing file to FUXA, then navigate to /home/<viewName>
			if (this._overlay) { this._overlay.textContent = 'Loading simulation...'; this._overlay.style.display = 'flex'; }
			this._loadHmiFileIntoFuxa(input.resource).catch(e => {
				console.error('[SimulatorEditorPane] Failed to load HMI file:', e);
				this._loadFuxa();
			});
		} else {
			// Generic virtual simulator
			this._loadFuxa();
		}
	}

	private async _loadHmiFileIntoFuxa(resource: import('../../../../base/common/uri.js').URI): Promise<void> {
		let rawText: string;
		try {
			const fileContent = await this.fileService.readFile(resource);
			rawText = fileContent.value.toString();
		} catch (e) {
			console.error('[SimulatorEditorPane] readFile failed:', e);
			this._loadFuxa();
			return;
		}

		// Extract view name without JSON.parse — avoids failure on SVG control chars in content
		const isFullProject = rawText.includes('"hmi"') || rawText.includes('"devices"');
		let viewName: string | null = null;
		if (isFullProject) {
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
			console.error('[SimulatorEditorPane] Could not extract view name from file');
			this._loadFuxa();
			return;
		}

		// Validate JSON before sending — FUXA body-parser rejects invalid JSON with 400
		let parsedProject: any;
		try {
			parsedProject = JSON.parse(rawText);
		} catch (e: any) {
			console.error('[SimulatorEditorPane] HMI file is not valid JSON:', e.message);
			this._loadFuxa();
			return;
		}
		// Ensure hmi.layout.navigation exists — FUXA Angular crashes with TypeError if missing
		if (parsedProject.hmi) {
			if (!parsedProject.hmi.layout) parsedProject.hmi.layout = {}
			parsedProject.hmi.layout.navigation = { mode: 'void', items: [], logo: false, title: '' }
			// Force white background on all views
			if (Array.isArray(parsedProject.hmi.views)) {
				for (const view of parsedProject.hmi.views) {
					if (!view.profile) view.profile = {}
					if (!view.profile.bkcolor || view.profile.bkcolor === '#000000' || /^#(?:[01][0-9a-f]){3}$/i.test(view.profile.bkcolor)) {
						view.profile.bkcolor = '#ffffff'
					}
				}
			}
			// Normalize view items — strip nulls, add property:{} — FUXA crashes on null items
			if (Array.isArray(parsedProject.hmi.views)) {
				for (const view of parsedProject.hmi.views) {
					if (Array.isArray(view.items)) {
						view.items = view.items.filter((item: any) => item !== null && item !== undefined)
						for (const item of view.items) {
							if (typeof item === 'object' && !item.property) item.property = {}
						}
					} else if (view.items && typeof view.items === 'object') {
						for (const key of Object.keys(view.items)) {
							if (!view.items[key]) { delete view.items[key]; continue }
							if (!view.items[key].property) view.items[key].property = {}
						}
					}
				}
			}
		}
		const postRes = await fetch('http://127.0.0.1:1881/api/project', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(parsedProject),
		});
		if (!postRes.ok) {
			const errText = await postRes.text().catch(() => '');
			console.error('[SimulatorEditorPane] POST /api/project failed:', postRes.status, errText);
			this._loadFuxa();
			return;
		}
		// POST /api/project only writes to SQLite — device runtime still has old state in memory.
		// Must call set-device for each device to trigger devices.updateDevice() (live reload).
		const deviceList = Object.values((parsedProject as any).devices || {}) as any[];
		for (const device of deviceList) {
			try {
				await fetch('http://127.0.0.1:1881/api/projectData', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ cmd: 'set-device', data: device }),
				});
			} catch (e) {
				console.warn('[SimulatorEditorPane] projectData set-device failed:', e);
			}
		}
		this._viewName = viewName;
		const frame = this._frame as HTMLIFrameElement | undefined;
		if (frame?.contentWindow && frame.src && !frame.src.startsWith('about:')) {
			if (this._overlay) this._overlay.style.display = 'none';
			this._postSelectView(viewName);
		} else {
			this._loadFuxa();
		}
	}

	private _sendThemeTokens(): void {
		if (!this._frame) return;
		const frame = this._frame as HTMLIFrameElement;
		if (!frame.contentWindow) return;
		const workbench = document.querySelector('.monaco-workbench') as HTMLElement | null;
		const styleSources = [workbench, document.body, document.documentElement].filter((node): node is HTMLElement => !!node).map(getComputedStyle);
		const vars = [
			'--vscode-sideBar-background', '--vscode-sideBar-foreground', '--vscode-sideBar-border',
			'--vscode-editorGroupHeader-tabsBackground', '--vscode-titleBar-activeBackground', '--vscode-titleBar-activeForeground', '--vscode-titleBar-border',
			'--vscode-button-background', '--vscode-button-foreground',
			'--vscode-input-background', '--vscode-input-foreground', '--vscode-focusBorder',
			'--vscode-panel-border', '--vscode-statusBar-background', '--vscode-statusBar-hoverBackground', '--vscode-statusBar-foreground',
			'--vscode-scrollbarSlider-background', '--vscode-scrollbarSlider-hoverBackground', '--vscode-badge-background',
			'--vscode-editor-background', '--vscode-menu-background', '--vscode-menu-foreground',
		];
		const tokens: Record<string, string> = {};
		for (const v of vars) {
			const val = styleSources.map(styles => styles.getPropertyValue(v).trim()).find(Boolean);
			if (val) tokens[v] = val;
		}
		frame.contentWindow.postMessage({ type: 'volt:theme-tokens', tokens }, '*');
	}

	override layout(dimension: Dimension): void {
		if (this._container) {
			this._container.style.width = dimension.width + 'px';
			this._container.style.height = dimension.height + 'px';
		}
	}
}
