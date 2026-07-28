/*
 * LogicEditorInput — custom EditorInput for PLC Logic files (LD/FBD/SFC).
 * Opening a .ld.json / .fbd.json / .sfc.json file triggers LogicEditorPane,
 * which mounts the React PLC canvas instead of Monaco.
 */

import { URI } from '../../../../base/common/uri.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { IUntypedEditorInput } from '../../../common/editor.js';

export type LogicLanguage = 'LD' | 'FBD' | 'SFC';

function languageFromUri(uri: URI): LogicLanguage {
	const path = uri.path.toLowerCase();
	if (path.endsWith('.fbd.json')) return 'FBD';
	if (path.endsWith('.sfc.json')) return 'SFC';
	return 'LD';
}

export class LogicEditorInput extends EditorInput {
	static readonly ID = 'workbench.input.plcLogicEditor';

	readonly resource: URI;
	readonly language: LogicLanguage;

	constructor(resource: URI) {
		super();
		this.resource = resource;
		this.language = languageFromUri(resource);
	}

	override get typeId(): string {
		return LogicEditorInput.ID;
	}

	override get editorId(): string {
		return 'workbench.editor.plcLogicEditor';
	}

	override getName(): string {
		const base = this.resource.path.split('/').pop() ?? 'Logic';
		return base.replace(/\.(ld|fbd|sfc)\.json$/i, '');
	}

	override getDescription(): string {
		return `PLC ${this.language} Program`;
	}

	override matches(other: EditorInput | IUntypedEditorInput): boolean {
		if (other instanceof LogicEditorInput) {
			return other.resource.toString() === this.resource.toString();
		}
		return false;
	}
}
