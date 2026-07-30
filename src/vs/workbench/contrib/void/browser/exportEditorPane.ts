import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { toDisposable } from '../../../../base/common/lifecycle.js';
import { Dimension } from '../../../../base/browser/dom.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
// @ts-ignore - React bundle export
import { mountExportPanel } from './react/out/plc-editor-tsx/index.js';

export class ExportEditorPane extends EditorPane {
	static readonly ID = 'workbench.editor.plcExportEditor';

	private _container: HTMLElement | undefined;
	private _mountResult: any;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super(ExportEditorPane.ID, group, telemetryService, themeService, storageService);
	}

	protected override createEditor(parent: HTMLElement): void {
		const groupContainer = parent.closest('.editor-group-container');
		if (groupContainer) {
			const bc = groupContainer.querySelector('.breadcrumbs-below-tabs') as HTMLElement | null;
			if (bc) { bc.style.display = 'none'; }
		}

		parent.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;background:var(--vscode-editor-background);';

		const root = document.createElement('div');
		root.style.cssText = 'display:flex;flex:1;flex-direction:column;height:100%;overflow:auto;';
		parent.appendChild(root);
		this._container = root;

		try {
			const accessor = this._makeAccessor();
			this._mountResult = mountExportPanel(root, accessor);
			this._register(toDisposable(() => {
				this._mountResult?.dispose();
				this._mountResult = undefined;
			}));
		} catch (e) {
			console.error('[ExportEditorPane] Mount failed:', e);
		}
	}

	override async setInput(input: EditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
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
						return this.instantiationService.invokeFunction((a) => a.get(serviceId));
					} catch { return undefined; }
				}
			};
		} catch {
			return { get: () => undefined };
		}
	}
}
