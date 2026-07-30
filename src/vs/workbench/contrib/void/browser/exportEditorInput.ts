import { EditorInput } from '../../../common/editor/editorInput.js';
import { URI } from '../../../../base/common/uri.js';

export const EXPORT_EDITOR_URI = URI.parse('plc-export://main/export');

let _instance: ExportEditorInput | null = null;

export class ExportEditorInput extends EditorInput {
	static readonly ID = 'workbench.input.plcExportEditor';

	static getOrCreate(): ExportEditorInput {
		if (!_instance || _instance.isDisposed()) {
			_instance = new ExportEditorInput();
		}
		return _instance;
	}

	constructor() {
		super();
		this.resource = EXPORT_EDITOR_URI;
	}

	override get typeId(): string { return ExportEditorInput.ID; }
	override get editorId(): string { return 'workbench.editor.plcExportEditor'; }

	override getName(): string { return 'Export'; }
	override getDescription(): string { return 'PLC Vendor Export'; }

	override matches(other: EditorInput | unknown): boolean {
		return other instanceof ExportEditorInput;
	}
}
