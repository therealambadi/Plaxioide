/*
 * SimulatorEditorInput — represents a FUXA HMI file or the generic simulator.
 * File-backed: opening a *_hmi.json file creates an input bound to that URI.
 * Generic: SimulatorEditorInput.getOrCreate() gives a singleton virtual input.
 */

import { EditorInput } from '../../../common/editor/editorInput.js';
import { URI } from '../../../../base/common/uri.js';

export const SIMULATOR_EDITOR_URI = URI.parse('plc-simulator://main/simulator');

let _instance: SimulatorEditorInput | null = null;

export class SimulatorEditorInput extends EditorInput {
	static readonly ID = 'workbench.input.plcSimulatorEditor';

	declare readonly resource: URI;
	private readonly _isFileBacked: boolean;

	static getOrCreate(): SimulatorEditorInput {
		if (!_instance || _instance.isDisposed()) {
			_instance = new SimulatorEditorInput(undefined);
		}
		return _instance;
	}

	constructor(resource: URI | undefined) {
		super();
		if (resource && resource.scheme === 'file') {
			this.resource = resource;
			this._isFileBacked = true;
		} else {
			this.resource = SIMULATOR_EDITOR_URI;
			this._isFileBacked = false;
		}
	}

	override get typeId(): string { return SimulatorEditorInput.ID; }
	override get editorId(): string { return 'workbench.editor.plcSimulatorEditor'; }
	get isFileBacked(): boolean { return this._isFileBacked; }

	override getName(): string {
		if (this._isFileBacked) {
			const name = this.resource.path.split('/').pop() ?? 'Simulator';
			return name.replace(/\.json$/i, '');
		}
		return 'Simulator';
	}

	override getDescription(): string {
		if (this._isFileBacked) return this.resource.fsPath;
		return 'FUXA HMI Simulator';
	}

	override matches(other: EditorInput): boolean {
		if (!(other instanceof SimulatorEditorInput)) return false;
		if (this._isFileBacked && other._isFileBacked) {
			return this.resource.toString() === other.resource.toString();
		}
		return !this._isFileBacked && !other._isFileBacked;
	}
}
