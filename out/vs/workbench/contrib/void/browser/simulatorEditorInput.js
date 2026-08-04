import { EditorInput } from "../../../common/editor/editorInput.js";
import { URI } from "../../../../base/common/uri.js";

export const SIMULATOR_EDITOR_URI = URI.parse("plc-simulator://main/simulator");

let _instance = null;

export class SimulatorEditorInput extends EditorInput {
  static { this.ID = "workbench.input.plcSimulatorEditor"; }

  static getOrCreate() {
    if (!_instance || _instance.isDisposed()) {
      _instance = new SimulatorEditorInput();
    }
    return _instance;
  }

  constructor(resource) {
    super();
    if (resource && resource.scheme === "file") {
      this.resource = resource;
      this._isFileBacked = true;
    } else {
      this.resource = SIMULATOR_EDITOR_URI;
      this._isFileBacked = false;
    }
  }

  get typeId() { return SimulatorEditorInput.ID; }
  get editorId() { return "workbench.editor.plcSimulatorEditor"; }
  get isFileBacked() { return this._isFileBacked; }

  getName() {
    if (this._isFileBacked) {
      const path = this.resource.path;
      const name = path.split("/").pop() || "Simulator";
      return name.replace(/\.json$/i, "");
    }
    return "Simulator";
  }

  getDescription() {
    if (this._isFileBacked) return this.resource.fsPath;
    return "FUXA HMI Simulator";
  }

  matches(other) {
    if (!(other instanceof SimulatorEditorInput)) return false;
    if (this._isFileBacked && other._isFileBacked) {
      return this.resource.toString() === other.resource.toString();
    }
    return !this._isFileBacked && !other._isFileBacked;
  }
}
