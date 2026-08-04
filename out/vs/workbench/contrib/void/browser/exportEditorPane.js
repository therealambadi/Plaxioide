var __defProp = Object.defineProperty;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? Object.getOwnPropertyDescriptor(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { EditorPane } from "../../../browser/parts/editor/editorPane.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { toDisposable } from "../../../../base/common/lifecycle.js";
import { mountExportPanel } from "./react/out/plc-editor-tsx/index.js";

let ExportEditorPane = class extends EditorPane {
  constructor(group, telemetryService, themeService, storageService, instantiationService) {
    super(ExportEditorPane.ID, group, telemetryService, themeService, storageService);
    this.instantiationService = instantiationService;
    this._container = void 0;
    this._mountResult = void 0;
  }

  createEditor(parent) {
    // Hide breadcrumbs
    const groupContainer = parent.closest(".editor-group-container");
    if (groupContainer) {
      const bc = groupContainer.querySelector(".breadcrumbs-below-tabs");
      if (bc) bc.style.display = "none";
    }

    parent.style.cssText = "display:flex;flex-direction:column;height:100%;overflow:hidden;background:var(--vscode-editor-background);";

    const root = document.createElement("div");
    root.style.cssText = "display:flex;flex:1;flex-direction:column;height:100%;overflow:auto;";
    parent.appendChild(root);
    this._container = root;

    try {
      const accessor = this._makeAccessor();
      this._mountResult = mountExportPanel(root, accessor);
      this._register(toDisposable(() => {
        this._mountResult?.dispose();
        this._mountResult = void 0;
      }));
    } catch (e) {
      console.error("[ExportEditorPane] Mount failed:", e);
    }
  }

  async setInput(input, options, context, token) {
    await super.setInput(input, options, context, token);
  }

  layout(dimension) {
    if (this._container) {
      this._container.style.width = dimension.width + "px";
      this._container.style.height = dimension.height + "px";
    }
  }

  _makeAccessor() {
    try {
      return {
        get: (serviceId) => {
          try {
            return this.instantiationService.invokeFunction((a) => a.get(serviceId));
          } catch { return void 0; }
        }
      };
    } catch {
      return { get: () => void 0 };
    }
  }
};
ExportEditorPane.ID = "workbench.editor.plcExportEditor";
ExportEditorPane = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IInstantiationService),
], ExportEditorPane);
export { ExportEditorPane };
