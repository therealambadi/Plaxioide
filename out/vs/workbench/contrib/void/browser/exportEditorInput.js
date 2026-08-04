import { EditorInput } from "../../../common/editor/editorInput.js";
import { URI } from "../../../../base/common/uri.js";

export const EXPORT_EDITOR_URI = URI.parse("plc-export://main/export");

let _instance = null;

export class ExportEditorInput extends EditorInput {
  static { this.ID = "workbench.input.plcExportEditor"; }

  static getOrCreate() {
    if (!_instance || _instance.isDisposed()) {
      _instance = new ExportEditorInput();
    }
    return _instance;
  }

  constructor() {
    super();
    this.resource = EXPORT_EDITOR_URI;
  }

  get typeId() { return ExportEditorInput.ID; }
  get editorId() { return "workbench.editor.plcExportEditor"; }

  getName() { return "Export"; }
  getDescription() { return "PLC Vendor Export"; }

  matches(other) {
    return other instanceof ExportEditorInput;
  }
}
