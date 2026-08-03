// @ts-nocheck
/*
 * LogicEditorPane — custom EditorPane that mounts the React PLC canvas.
 * File loading: reads the .ld/.fbd/.sfc .json file via IFileService, extracts tags,
 * then passes a loadProgram payload through rerender() props into LogicTab.
 * Auto-save: debounced 500ms write back on any store change.
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
import { LogicEditorInput } from './logicEditorInput.js';
import { mountPlcEditor, logicStore } from './react/out/plc-editor-tsx/index.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { toDisposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IFileService, FileChangeType } from '../../../../platform/files/common/files.js';
import { VSBuffer } from '../../../../base/common/buffer.js';

// Tracks which pane instance most recently loaded a file into the shared logicStore.
// Only that pane should auto-save — all others must stay quiet to avoid overwriting
// unrelated files with the active file's state.
let _activeAutoSavePaneId: number = -1;
let _nextPaneId = 0;

export class LogicEditorPane extends EditorPane {
	static readonly ID = 'workbench.editor.plcLogicEditor';

	private readonly _paneId = _nextPaneId++;
	private _container: HTMLElement | undefined;
	private _mountResult: ReturnType<typeof mountPlcEditor> | undefined;
	private _currentResource: import('../../../../base/common/uri.js').URI | undefined;
	private _autoSaveTimer: ReturnType<typeof setTimeout> | undefined;
	private _storeUnsubscribe: (() => void) | undefined;
	private _currentInput: LogicEditorInput | undefined;
	private _fileWatcherDisposable = new DisposableStore();

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IEditorService private readonly editorService: IEditorService,
		@IFileService private readonly fileService: IFileService,
	) {
		super(LogicEditorPane.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		const groupContainer = parent.closest('.editor-group-container');
		if (groupContainer) {
			const bc = groupContainer.querySelector('.breadcrumbs-below-tabs') as HTMLElement | null;
			if (bc) bc.style.display = 'none';
		}

		parent.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;background:var(--void-bg-3);';

		const root = document.createElement('div');
		root.style.cssText = 'display:flex;flex:1;flex-direction:column;height:100%;overflow:hidden;';
		parent.appendChild(root);
		this._container = root;

		try {
			const accessor = this._makeAccessor();
			this._mountResult = mountPlcEditor(root, accessor);

			// Auto-save DISABLED: the logicStore is a singleton shared across all open files.
			// Auto-saving causes cross-file corruption (file A gets overwritten with file B's data
			// when the store changes). Files are saved by plc_write_program tool and explicit Cmd+S.
			this._storeUnsubscribe = undefined;

			this._register(toDisposable(() => {
				this._mountResult?.dispose();
				this._mountResult = undefined;
				this._storeUnsubscribe?.();
				this._storeUnsubscribe = undefined;
				if (this._autoSaveTimer !== undefined) {
					clearTimeout(this._autoSaveTimer);
					this._autoSaveTimer = undefined;
				}
			}));
		} catch (e) {
			console.error('[LogicEditorPane] Mount failed:', e);
		}
	}

	override async setInput(
		input: LogicEditorInput,
		options: IEditorOptions | undefined,
		context: IEditorOpenContext,
		token: CancellationToken,
	): Promise<void> {
		await super.setInput(input, options, context, token);
		this._currentResource = input.resource;
		this._currentInput = input;

		const onSwitchToCode = () => {
			if (!this._currentResource) return;
			this.editorService.openEditor({ resource: this._currentResource, options: { override: 'default', pinned: true } });
		};

		// Read the file and build loadProgram payload, then pass via rerender()
		const payload = await this._buildLoadPayload(input);

		// Claim auto-save ownership: this pane loaded the most recent file into the store
		_activeAutoSavePaneId = this._paneId;

		if (this._mountResult) {
			this._mountResult.rerender({
				lockedLanguage: input.language,
				onSwitchToCode,
				loadProgram: payload,
			});
		}

		// Watch for external file changes (e.g. AI rewrite_file) and reload
		this._fileWatcherDisposable.clear();
		if (input.resource.scheme === 'file') {
			this._fileWatcherDisposable.add(
				this.fileService.onDidFilesChange(e => {
					if (!this._currentResource || !this._currentInput) return;
					const dominated = e.rawChanges?.some(c => c.resource.toString() === this._currentResource!.toString() && c.type === FileChangeType.UPDATED);
					const affects = dominated || e.affects(this._currentResource, FileChangeType.UPDATED);
					if (affects) {
						this._buildLoadPayload(this._currentInput).then(newPayload => {
							if (newPayload && this._mountResult) {
								// Re-claim ownership when an external change reloads this file
								_activeAutoSavePaneId = this._paneId;
								this._mountResult.rerender({
									lockedLanguage: this._currentInput!.language,
									onSwitchToCode,
									loadProgram: newPayload,
								});
							}
						});
					}
				})
			);
		}
	}

	private async _buildLoadPayload(input: LogicEditorInput): Promise<any> {
		const fileName = input.resource.fsPath.split('/').pop() ?? input.resource.path.split('/').pop() ?? 'unknown';

		let content = '';
		if (input.resource.scheme === 'plc-logic') {
			// Virtual URI — restore from localStorage if available
			try { content = localStorage.getItem(this._localStorageKey(input)) ?? ''; } catch { content = ''; }
			if (!content.trim()) {
				(logicStore as any).addConsoleEntry('info', `New ${input.language} program: ${fileName}`);
				return null;
			}
		} else {
			try {
				const fileContent = await this.fileService.readFile(input.resource);
				content = fileContent.value.toString();
			} catch {
				// New / unreadable file
				(logicStore as any).addConsoleEntry('info', `New ${input.language} program: ${fileName}`);
				return null;
			}
		}

		if (!content.trim()) {
			(logicStore as any).addConsoleEntry('info', `Empty ${input.language} file: ${fileName}`);
			return null;
		}

		try {
			const parsed = JSON.parse(content);
			const tags = this._extractTags(input.language, parsed);
			return { language: input.language, program: parsed, tags, fileName };
		} catch (e: any) {
			(logicStore as any).addConsoleEntry('error', `Parse error in ${fileName}: ${e?.message ?? String(e)}`);
			return null;
		}
	}

	private _extractTags(language: string, parsed: any): any[] {
		const tagMap = new Map<string, any>();
		const add = (t: any) => {
			if (t?.name && !tagMap.has(t.name)) {
				tagMap.set(t.name, { name: t.name, address: t.address ?? '', dataType: t.dataType ?? 'BOOL', description: '' });
			}
		};

		if (language === 'LD') {
			for (const rung of parsed.rungs ?? []) {
				const els = [...(rung.elements ?? []), ...(rung.branches ?? []).flatMap((b: any) => b.elements ?? [])];
				for (const el of els) {
					if (el.kind === 'contact' || el.kind === 'coil') add(el.tag);
					else if (el.kind === 'block') Object.values(el.pins ?? {}).forEach(add);
				}
			}
		} else if (language === 'FBD') {
			for (const node of parsed.nodes ?? []) add(node.tag);
		} else if (language === 'SFC') {
			for (const step of parsed.steps ?? []) {
				for (const action of step.actions ?? []) add(action.tag);
			}
		}
		return Array.from(tagMap.values());
	}

	private _serializeProgram(program: unknown): string {
		// Strip runtime-only fields injected by the evaluator so saved files stay clean
		const RUNTIME_KEYS = new Set(['energized', 'powerAfter', 'pinValues', 'liveValue', 'forcedValue']);
		return JSON.stringify(program, (key, value) => {
			if (RUNTIME_KEYS.has(key)) return undefined;
			return value;
		}, 2);
	}

	private _localStorageKey(input: LogicEditorInput): string {
		return `plc-autosave:${input.resource.toString()}`;
	}

	private async _autoSaveToFile(input: LogicEditorInput): Promise<void> {
		if (!input?.resource) return;
		try {
			const state = (logicStore as any).getState();
			let program: unknown;
			if (input.language === 'LD') program = state.ladderProgram;
			else if (input.language === 'FBD') program = state.fbdProgram;
			else if (input.language === 'SFC') program = state.sfcProgram;
			else return;

			const serialized = this._serializeProgram(program);

			if (input.resource.scheme === 'plc-logic') {
				// Virtual URI — no real file backing; persist to localStorage
				try { localStorage.setItem(this._localStorageKey(input), serialized); } catch { /* storage full */ }
				return;
			}

			// Don't recreate a file that was deleted externally
			const exists = await this.fileService.exists(input.resource);
			if (!exists) return;

			await this.fileService.writeFile(input.resource, VSBuffer.fromString(serialized));
		} catch (e: any) {
			console.error('[LogicEditorPane] Auto-save failed:', e);
		}
	}

	override layout(dimension: Dimension): void {
		if (this._container) {
			this._container.style.width = dimension.width + 'px';
			this._container.style.height = dimension.height + 'px';
		}
	}

	private _makeAccessor(): any {
		try {
			return {
				get: (serviceId: any) => {
					try {
						return this.instantiationService.invokeFunction((a: ServicesAccessor) => a.get(serviceId));
					} catch { return undefined; }
				}
			};
		} catch {
			return { get: () => undefined };
		}
	}
}
