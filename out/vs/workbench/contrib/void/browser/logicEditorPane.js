var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
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
import { mountPlcEditor, logicStore } from "./react/out/plc-editor-tsx/index.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { toDisposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { FileChangeType } from "../../../../platform/files/common/files.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
// Tracks which pane instance most recently loaded a file into the shared logicStore.
// Only that pane should auto-save — all others must stay silent to avoid overwriting
// unrelated files with the active file's state.
let _activeAutoSavePaneId = -1;
let _nextPaneId = 0;
let LogicEditorPane = class extends EditorPane {
  constructor(group, telemetryService, themeService, storageService, instantiationService, editorService, fileService) {
    super(LogicEditorPane.ID, group, telemetryService, themeService, storageService);
    this.instantiationService = instantiationService;
    this.editorService = editorService;
    this.fileService = fileService;
    this._paneId = _nextPaneId++;
  }
  createEditor(parent) {
    const groupContainer = parent.closest(".editor-group-container");
    if (groupContainer) {
      const bc = groupContainer.querySelector(".breadcrumbs-below-tabs");
      if (bc) bc.style.display = "none";
    }
    parent.style.cssText = "display:flex;flex-direction:column;height:100%;overflow:hidden;background:var(--void-bg-3);";
    const root = document.createElement("div");
    root.style.cssText = "display:flex;flex:1;flex-direction:column;height:100%;overflow:hidden;";
    parent.appendChild(root);
    this._container = root;
    try {
      const accessor = this._makeAccessor();
      this._mountResult = mountPlcEditor(root, accessor);
      // Auto-save DISABLED: singleton store causes cross-file corruption.
      this._storeUnsubscribe = void 0;
      this._register(toDisposable(() => {
        this._mountResult?.dispose();
        this._mountResult = void 0;
        this._storeUnsubscribe?.();
        this._storeUnsubscribe = void 0;
        if (this._autoSaveTimer !== void 0) {
          clearTimeout(this._autoSaveTimer);
          this._autoSaveTimer = void 0;
        }
      }));
    } catch (e) {
      console.error("[LogicEditorPane] Mount failed:", e);
    }
  }
  async setInput(input, options, context, token) {
    await super.setInput(input, options, context, token);
    this._currentResource = input.resource;
    this._currentInput = input;
    const onSwitchToCode = () => {
      if (!this._currentResource) return;
      this.editorService.openEditor({ resource: this._currentResource, options: { override: "default", pinned: true } });
    };
    const payload = await this._buildLoadPayload(input);
    // Claim auto-save ownership: this pane loaded the most recent file into the store
    _activeAutoSavePaneId = this._paneId;
    if (this._mountResult) {
      this._mountResult.rerender({
        lockedLanguage: input.language,
        onSwitchToCode,
        loadProgram: payload
      });
    }
    // Watch for external file changes and reload
    if (!this._fileWatcherDisposable) this._fileWatcherDisposable = new DisposableStore();
    this._fileWatcherDisposable.clear();
    if (input.resource.scheme === "file") {
      this._fileWatcherDisposable.add(
        this.fileService.onDidFilesChange(e => {
          if (!this._currentResource || !this._currentInput) return;
          const dominated = e.rawChanges?.some(c => c.resource.toString() === this._currentResource.toString() && c.type === FileChangeType.UPDATED);
          const affects = dominated || e.affects(this._currentResource, FileChangeType.UPDATED);
          if (affects) {
            this._buildLoadPayload(this._currentInput).then(newPayload => {
              if (newPayload && this._mountResult) {
                // Re-claim ownership when an external change reloads this file
                _activeAutoSavePaneId = this._paneId;
                this._mountResult.rerender({
                  lockedLanguage: this._currentInput.language,
                  onSwitchToCode,
                  loadProgram: newPayload
                });
              }
            });
          }
        })
      );
    }
  }
  async _buildLoadPayload(input) {
    const fileName = input.resource.fsPath.split("/").pop() ?? input.resource.path.split("/").pop() ?? "unknown";
    let content = "";
    if (input.resource.scheme === "plc-logic") {
      try {
        content = localStorage.getItem(this._localStorageKey(input)) ?? "";
      } catch {
        content = "";
      }
      if (!content.trim()) {
        logicStore.addConsoleEntry("info", `New ${input.language} program: ${fileName}`);
        return null;
      }
    } else {
      try {
        const fileContent = await this.fileService.readFile(input.resource);
        content = fileContent.value.toString();
      } catch {
        logicStore.addConsoleEntry("info", `New ${input.language} program: ${fileName}`);
        return null;
      }
    }
    if (!content.trim()) {
      logicStore.addConsoleEntry("info", `Empty ${input.language} file: ${fileName}`);
      return null;
    }
    try {
      const parsed = JSON.parse(content);
      const tags = this._extractTags(input.language, parsed);
      return { language: input.language, program: parsed, tags, fileName };
    } catch (e) {
      logicStore.addConsoleEntry("error", `Parse error in ${fileName}: ${e?.message ?? String(e)}`);
      return null;
    }
  }
  _extractTags(language, parsed) {
    const tagMap = /* @__PURE__ */ new Map();
    const add = (t) => {
      if (t?.name && !tagMap.has(t.name)) {
        tagMap.set(t.name, { name: t.name, address: t.address ?? "", dataType: t.dataType ?? "BOOL", description: "" });
      }
    };
    if (language === "LD") {
      for (const rung of parsed.rungs ?? []) {
        const els = [...rung.elements ?? [], ...(rung.branches ?? []).flatMap((b) => b.elements ?? [])];
        for (const el of els) {
          if (el.kind === "contact" || el.kind === "coil") add(el.tag);
          else if (el.kind === "block") Object.values(el.pins ?? {}).forEach(add);
        }
      }
    } else if (language === "FBD") {
      for (const node of parsed.nodes ?? []) add(node.tag);
    } else if (language === "SFC") {
      for (const step of parsed.steps ?? []) {
        for (const action of step.actions ?? []) add(action.tag);
      }
    }
    return Array.from(tagMap.values());
  }
  _serializeProgram(program) {
    const RUNTIME_KEYS = /* @__PURE__ */ new Set(["energized", "powerAfter", "pinValues", "liveValue", "forcedValue"]);
    return JSON.stringify(program, (key, value) => {
      if (RUNTIME_KEYS.has(key)) return void 0;
      return value;
    }, 2);
  }
  _localStorageKey(input) {
    return `plc-autosave:${input.resource.toString()}`;
  }
  async _autoSaveToFile(input) {
    if (!input?.resource) return;
    try {
      const state = logicStore.getState();
      let program;
      if (input.language === "LD") program = state.ladderProgram;
      else if (input.language === "FBD") program = state.fbdProgram;
      else if (input.language === "SFC") program = state.sfcProgram;
      else return;
      const serialized = this._serializeProgram(program);
      if (input.resource.scheme === "plc-logic") {
        try {
          localStorage.setItem(this._localStorageKey(input), serialized);
        } catch {
        }
        return;
      }
      const exists = await this.fileService.exists(input.resource);
      if (!exists) return;
      await this.fileService.writeFile(input.resource, VSBuffer.fromString(serialized));
    } catch (e) {
      console.error("[LogicEditorPane] Auto-save failed:", e);
    }
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
          } catch {
            return void 0;
          }
        }
      };
    } catch {
      return { get: () => void 0 };
    }
  }
};
LogicEditorPane.ID = "workbench.editor.plcLogicEditor";
LogicEditorPane = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IEditorService),
  __decorateParam(6, IFileService)
], LogicEditorPane);
export {
  LogicEditorPane
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvbG9naWNFZGl0b3JQYW5lLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKlxuICogTG9naWNFZGl0b3JQYW5lIFx1MjAxNCBjdXN0b20gRWRpdG9yUGFuZSB0aGF0IG1vdW50cyB0aGUgUmVhY3QgUExDIGNhbnZhcy5cbiAqIEZpbGUgbG9hZGluZzogcmVhZHMgdGhlIC5sZC8uZmJkLy5zZmMgLmpzb24gZmlsZSB2aWEgSUZpbGVTZXJ2aWNlLCBleHRyYWN0cyB0YWdzLFxuICogdGhlbiBwYXNzZXMgYSBsb2FkUHJvZ3JhbSBwYXlsb2FkIHRocm91Z2ggcmVyZW5kZXIoKSBwcm9wcyBpbnRvIExvZ2ljVGFiLlxuICogQXV0by1zYXZlOiBkZWJvdW5jZWQgNTAwbXMgd3JpdGUgYmFjayBvbiBhbnkgc3RvcmUgY2hhbmdlLlxuICovXG5cbmltcG9ydCB7IEVkaXRvclBhbmUgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3BhcnRzL2VkaXRvci9lZGl0b3JQYW5lLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yR3JvdXAgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvckdyb3Vwc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvck9wZW5Db250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2VkaXRvci9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IERpbWVuc2lvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgTG9naWNFZGl0b3JJbnB1dCB9IGZyb20gJy4vbG9naWNFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBtb3VudFBsY0VkaXRvciwgbG9naWNTdG9yZSB9IGZyb20gJy4vcmVhY3Qvb3V0L3BsYy1lZGl0b3ItdHN4L2luZGV4LmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5cbmV4cG9ydCBjbGFzcyBMb2dpY0VkaXRvclBhbmUgZXh0ZW5kcyBFZGl0b3JQYW5lIHtcblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5lZGl0b3IucGxjTG9naWNFZGl0b3InO1xuXG5cdHByaXZhdGUgX2NvbnRhaW5lcjogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX21vdW50UmVzdWx0OiBSZXR1cm5UeXBlPHR5cGVvZiBtb3VudFBsY0VkaXRvcj4gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2N1cnJlbnRSZXNvdXJjZTogaW1wb3J0KCcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnKS5VUkkgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2F1dG9TYXZlVGltZXI6IFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9zdG9yZVVuc3Vic2NyaWJlOiAoKCkgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2N1cnJlbnRJbnB1dDogTG9naWNFZGl0b3JJbnB1dCB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRncm91cDogSUVkaXRvckdyb3VwLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihMb2dpY0VkaXRvclBhbmUuSUQsIGdyb3VwLCB0ZWxlbWV0cnlTZXJ2aWNlLCB0aGVtZVNlcnZpY2UsIHN0b3JhZ2VTZXJ2aWNlKTtcblx0fVxuXG5cdHByb3RlY3RlZCBjcmVhdGVFZGl0b3IocGFyZW50OiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdGNvbnN0IGdyb3VwQ29udGFpbmVyID0gcGFyZW50LmNsb3Nlc3QoJy5lZGl0b3ItZ3JvdXAtY29udGFpbmVyJyk7XG5cdFx0aWYgKGdyb3VwQ29udGFpbmVyKSB7XG5cdFx0XHRjb25zdCBiYyA9IGdyb3VwQ29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJy5icmVhZGNydW1icy1iZWxvdy10YWJzJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuXHRcdFx0aWYgKGJjKSBiYy5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdH1cblxuXHRcdHBhcmVudC5zdHlsZS5jc3NUZXh0ID0gJ2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47aGVpZ2h0OjEwMCU7b3ZlcmZsb3c6aGlkZGVuO2JhY2tncm91bmQ6dmFyKC0tdm9pZC1iZy0zKTsnO1xuXG5cdFx0Y29uc3Qgcm9vdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHJvb3Quc3R5bGUuY3NzVGV4dCA9ICdkaXNwbGF5OmZsZXg7ZmxleDoxO2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjtoZWlnaHQ6MTAwJTtvdmVyZmxvdzpoaWRkZW47Jztcblx0XHRwYXJlbnQuYXBwZW5kQ2hpbGQocm9vdCk7XG5cdFx0dGhpcy5fY29udGFpbmVyID0gcm9vdDtcblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBhY2Nlc3NvciA9IHRoaXMuX21ha2VBY2Nlc3NvcigpO1xuXHRcdFx0dGhpcy5fbW91bnRSZXN1bHQgPSBtb3VudFBsY0VkaXRvcihyb290LCBhY2Nlc3Nvcik7XG5cblx0XHRcdC8vIEF1dG8tc2F2ZTogc3Vic2NyaWJlIHRvIGxvZ2ljU3RvcmUsIGRlYm91bmNlIDUwMG1zIHdyaXRlc1xuXHRcdFx0dGhpcy5fc3RvcmVVbnN1YnNjcmliZSA9IChsb2dpY1N0b3JlIGFzIGFueSkuc3Vic2NyaWJlKCgpID0+IHtcblx0XHRcdFx0aWYgKCF0aGlzLl9jdXJyZW50SW5wdXQpIHJldHVybjtcblx0XHRcdFx0aWYgKHRoaXMuX2F1dG9TYXZlVGltZXIgIT09IHVuZGVmaW5lZCkgY2xlYXJUaW1lb3V0KHRoaXMuX2F1dG9TYXZlVGltZXIpO1xuXHRcdFx0XHR0aGlzLl9hdXRvU2F2ZVRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB0aGlzLl9hdXRvU2F2ZVRvRmlsZSh0aGlzLl9jdXJyZW50SW5wdXQhKSwgNTAwKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9tb3VudFJlc3VsdD8uZGlzcG9zZSgpO1xuXHRcdFx0XHR0aGlzLl9tb3VudFJlc3VsdCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0dGhpcy5fc3RvcmVVbnN1YnNjcmliZT8uKCk7XG5cdFx0XHRcdHRoaXMuX3N0b3JlVW5zdWJzY3JpYmUgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdGlmICh0aGlzLl9hdXRvU2F2ZVRpbWVyICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRjbGVhclRpbWVvdXQodGhpcy5fYXV0b1NhdmVUaW1lcik7XG5cdFx0XHRcdFx0dGhpcy5fYXV0b1NhdmVUaW1lciA9IHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoJ1tMb2dpY0VkaXRvclBhbmVdIE1vdW50IGZhaWxlZDonLCBlKTtcblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBzZXRJbnB1dChcblx0XHRpbnB1dDogTG9naWNFZGl0b3JJbnB1dCxcblx0XHRvcHRpb25zOiBJRWRpdG9yT3B0aW9ucyB8IHVuZGVmaW5lZCxcblx0XHRjb250ZXh0OiBJRWRpdG9yT3BlbkNvbnRleHQsXG5cdFx0dG9rZW46IENhbmNlbGxhdGlvblRva2VuLFxuXHQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCBzdXBlci5zZXRJbnB1dChpbnB1dCwgb3B0aW9ucywgY29udGV4dCwgdG9rZW4pO1xuXHRcdHRoaXMuX2N1cnJlbnRSZXNvdXJjZSA9IGlucHV0LnJlc291cmNlO1xuXHRcdHRoaXMuX2N1cnJlbnRJbnB1dCA9IGlucHV0O1xuXG5cdFx0Y29uc3Qgb25Td2l0Y2hUb0NvZGUgPSAoKSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuX2N1cnJlbnRSZXNvdXJjZSkgcmV0dXJuO1xuXHRcdFx0dGhpcy5lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3IoeyByZXNvdXJjZTogdGhpcy5fY3VycmVudFJlc291cmNlLCBvcHRpb25zOiB7IG92ZXJyaWRlOiAnZGVmYXVsdCcsIHBpbm5lZDogdHJ1ZSB9IH0pO1xuXHRcdH07XG5cblx0XHQvLyBSZWFkIHRoZSBmaWxlIGFuZCBidWlsZCBsb2FkUHJvZ3JhbSBwYXlsb2FkLCB0aGVuIHBhc3MgdmlhIHJlcmVuZGVyKClcblx0XHRjb25zdCBwYXlsb2FkID0gYXdhaXQgdGhpcy5fYnVpbGRMb2FkUGF5bG9hZChpbnB1dCk7XG5cblx0XHRpZiAodGhpcy5fbW91bnRSZXN1bHQpIHtcblx0XHRcdHRoaXMuX21vdW50UmVzdWx0LnJlcmVuZGVyKHtcblx0XHRcdFx0bG9ja2VkTGFuZ3VhZ2U6IGlucHV0Lmxhbmd1YWdlLFxuXHRcdFx0XHRvblN3aXRjaFRvQ29kZSxcblx0XHRcdFx0bG9hZFByb2dyYW06IHBheWxvYWQsXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9idWlsZExvYWRQYXlsb2FkKGlucHV0OiBMb2dpY0VkaXRvcklucHV0KTogUHJvbWlzZTxhbnk+IHtcblx0XHRjb25zdCBmaWxlTmFtZSA9IGlucHV0LnJlc291cmNlLmZzUGF0aC5zcGxpdCgnLycpLnBvcCgpID8/IGlucHV0LnJlc291cmNlLnBhdGguc3BsaXQoJy8nKS5wb3AoKSA/PyAndW5rbm93bic7XG5cblx0XHRsZXQgY29udGVudCA9ICcnO1xuXHRcdGlmIChpbnB1dC5yZXNvdXJjZS5zY2hlbWUgPT09ICdwbGMtbG9naWMnKSB7XG5cdFx0XHQvLyBWaXJ0dWFsIFVSSSBcdTIwMTQgcmVzdG9yZSBmcm9tIGxvY2FsU3RvcmFnZSBpZiBhdmFpbGFibGVcblx0XHRcdHRyeSB7IGNvbnRlbnQgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSh0aGlzLl9sb2NhbFN0b3JhZ2VLZXkoaW5wdXQpKSA/PyAnJzsgfSBjYXRjaCB7IGNvbnRlbnQgPSAnJzsgfVxuXHRcdFx0aWYgKCFjb250ZW50LnRyaW0oKSkge1xuXHRcdFx0XHQobG9naWNTdG9yZSBhcyBhbnkpLmFkZENvbnNvbGVFbnRyeSgnaW5mbycsIGBOZXcgJHtpbnB1dC5sYW5ndWFnZX0gcHJvZ3JhbTogJHtmaWxlTmFtZX1gKTtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IGZpbGVDb250ZW50ID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5yZWFkRmlsZShpbnB1dC5yZXNvdXJjZSk7XG5cdFx0XHRcdGNvbnRlbnQgPSBmaWxlQ29udGVudC52YWx1ZS50b1N0cmluZygpO1xuXHRcdFx0fSBjYXRjaCB7XG5cdFx0XHRcdC8vIE5ldyAvIHVucmVhZGFibGUgZmlsZVxuXHRcdFx0XHQobG9naWNTdG9yZSBhcyBhbnkpLmFkZENvbnNvbGVFbnRyeSgnaW5mbycsIGBOZXcgJHtpbnB1dC5sYW5ndWFnZX0gcHJvZ3JhbTogJHtmaWxlTmFtZX1gKTtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCFjb250ZW50LnRyaW0oKSkge1xuXHRcdFx0KGxvZ2ljU3RvcmUgYXMgYW55KS5hZGRDb25zb2xlRW50cnkoJ2luZm8nLCBgRW1wdHkgJHtpbnB1dC5sYW5ndWFnZX0gZmlsZTogJHtmaWxlTmFtZX1gKTtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKGNvbnRlbnQpO1xuXHRcdFx0Y29uc3QgdGFncyA9IHRoaXMuX2V4dHJhY3RUYWdzKGlucHV0Lmxhbmd1YWdlLCBwYXJzZWQpO1xuXHRcdFx0cmV0dXJuIHsgbGFuZ3VhZ2U6IGlucHV0Lmxhbmd1YWdlLCBwcm9ncmFtOiBwYXJzZWQsIHRhZ3MsIGZpbGVOYW1lIH07XG5cdFx0fSBjYXRjaCAoZTogYW55KSB7XG5cdFx0XHQobG9naWNTdG9yZSBhcyBhbnkpLmFkZENvbnNvbGVFbnRyeSgnZXJyb3InLCBgUGFyc2UgZXJyb3IgaW4gJHtmaWxlTmFtZX06ICR7ZT8ubWVzc2FnZSA/PyBTdHJpbmcoZSl9YCk7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9leHRyYWN0VGFncyhsYW5ndWFnZTogc3RyaW5nLCBwYXJzZWQ6IGFueSk6IGFueVtdIHtcblx0XHRjb25zdCB0YWdNYXAgPSBuZXcgTWFwPHN0cmluZywgYW55PigpO1xuXHRcdGNvbnN0IGFkZCA9ICh0OiBhbnkpID0+IHtcblx0XHRcdGlmICh0Py5uYW1lICYmICF0YWdNYXAuaGFzKHQubmFtZSkpIHtcblx0XHRcdFx0dGFnTWFwLnNldCh0Lm5hbWUsIHsgbmFtZTogdC5uYW1lLCBhZGRyZXNzOiB0LmFkZHJlc3MgPz8gJycsIGRhdGFUeXBlOiB0LmRhdGFUeXBlID8/ICdCT09MJywgZGVzY3JpcHRpb246ICcnIH0pO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRpZiAobGFuZ3VhZ2UgPT09ICdMRCcpIHtcblx0XHRcdGZvciAoY29uc3QgcnVuZyBvZiBwYXJzZWQucnVuZ3MgPz8gW10pIHtcblx0XHRcdFx0Y29uc3QgZWxzID0gWy4uLihydW5nLmVsZW1lbnRzID8/IFtdKSwgLi4uKHJ1bmcuYnJhbmNoZXMgPz8gW10pLmZsYXRNYXAoKGI6IGFueSkgPT4gYi5lbGVtZW50cyA/PyBbXSldO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGVsIG9mIGVscykge1xuXHRcdFx0XHRcdGlmIChlbC5raW5kID09PSAnY29udGFjdCcgfHwgZWwua2luZCA9PT0gJ2NvaWwnKSBhZGQoZWwudGFnKTtcblx0XHRcdFx0XHRlbHNlIGlmIChlbC5raW5kID09PSAnYmxvY2snKSBPYmplY3QudmFsdWVzKGVsLnBpbnMgPz8ge30pLmZvckVhY2goYWRkKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAobGFuZ3VhZ2UgPT09ICdGQkQnKSB7XG5cdFx0XHRmb3IgKGNvbnN0IG5vZGUgb2YgcGFyc2VkLm5vZGVzID8/IFtdKSBhZGQobm9kZS50YWcpO1xuXHRcdH0gZWxzZSBpZiAobGFuZ3VhZ2UgPT09ICdTRkMnKSB7XG5cdFx0XHRmb3IgKGNvbnN0IHN0ZXAgb2YgcGFyc2VkLnN0ZXBzID8/IFtdKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgYWN0aW9uIG9mIHN0ZXAuYWN0aW9ucyA/PyBbXSkgYWRkKGFjdGlvbi50YWcpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gQXJyYXkuZnJvbSh0YWdNYXAudmFsdWVzKCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2VyaWFsaXplUHJvZ3JhbShwcm9ncmFtOiB1bmtub3duKTogc3RyaW5nIHtcblx0XHQvLyBTdHJpcCBydW50aW1lLW9ubHkgZmllbGRzIGluamVjdGVkIGJ5IHRoZSBldmFsdWF0b3Igc28gc2F2ZWQgZmlsZXMgc3RheSBjbGVhblxuXHRcdGNvbnN0IFJVTlRJTUVfS0VZUyA9IG5ldyBTZXQoWydlbmVyZ2l6ZWQnLCAncG93ZXJBZnRlcicsICdwaW5WYWx1ZXMnLCAnbGl2ZVZhbHVlJywgJ2ZvcmNlZFZhbHVlJ10pO1xuXHRcdHJldHVybiBKU09OLnN0cmluZ2lmeShwcm9ncmFtLCAoa2V5LCB2YWx1ZSkgPT4ge1xuXHRcdFx0aWYgKFJVTlRJTUVfS0VZUy5oYXMoa2V5KSkgcmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHR9LCAyKTtcblx0fVxuXG5cdHByaXZhdGUgX2xvY2FsU3RvcmFnZUtleShpbnB1dDogTG9naWNFZGl0b3JJbnB1dCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGBwbGMtYXV0b3NhdmU6JHtpbnB1dC5yZXNvdXJjZS50b1N0cmluZygpfWA7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9hdXRvU2F2ZVRvRmlsZShpbnB1dDogTG9naWNFZGl0b3JJbnB1dCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghaW5wdXQ/LnJlc291cmNlKSByZXR1cm47XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHN0YXRlID0gKGxvZ2ljU3RvcmUgYXMgYW55KS5nZXRTdGF0ZSgpO1xuXHRcdFx0bGV0IHByb2dyYW06IHVua25vd247XG5cdFx0XHRpZiAoaW5wdXQubGFuZ3VhZ2UgPT09ICdMRCcpIHByb2dyYW0gPSBzdGF0ZS5sYWRkZXJQcm9ncmFtO1xuXHRcdFx0ZWxzZSBpZiAoaW5wdXQubGFuZ3VhZ2UgPT09ICdGQkQnKSBwcm9ncmFtID0gc3RhdGUuZmJkUHJvZ3JhbTtcblx0XHRcdGVsc2UgaWYgKGlucHV0Lmxhbmd1YWdlID09PSAnU0ZDJykgcHJvZ3JhbSA9IHN0YXRlLnNmY1Byb2dyYW07XG5cdFx0XHRlbHNlIHJldHVybjtcblxuXHRcdFx0Y29uc3Qgc2VyaWFsaXplZCA9IHRoaXMuX3NlcmlhbGl6ZVByb2dyYW0ocHJvZ3JhbSk7XG5cblx0XHRcdGlmIChpbnB1dC5yZXNvdXJjZS5zY2hlbWUgPT09ICdwbGMtbG9naWMnKSB7XG5cdFx0XHRcdC8vIFZpcnR1YWwgVVJJIFx1MjAxNCBubyByZWFsIGZpbGUgYmFja2luZzsgcGVyc2lzdCB0byBsb2NhbFN0b3JhZ2Vcblx0XHRcdFx0dHJ5IHsgbG9jYWxTdG9yYWdlLnNldEl0ZW0odGhpcy5fbG9jYWxTdG9yYWdlS2V5KGlucHV0KSwgc2VyaWFsaXplZCk7IH0gY2F0Y2ggeyAvKiBzdG9yYWdlIGZ1bGwgKi8gfVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGF3YWl0IHRoaXMuZmlsZVNlcnZpY2Uud3JpdGVGaWxlKGlucHV0LnJlc291cmNlLCBWU0J1ZmZlci5mcm9tU3RyaW5nKHNlcmlhbGl6ZWQpKTtcblx0XHR9IGNhdGNoIChlOiBhbnkpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoJ1tMb2dpY0VkaXRvclBhbmVdIEF1dG8tc2F2ZSBmYWlsZWQ6JywgZSk7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgbGF5b3V0KGRpbWVuc2lvbjogRGltZW5zaW9uKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2NvbnRhaW5lcikge1xuXHRcdFx0dGhpcy5fY29udGFpbmVyLnN0eWxlLndpZHRoID0gZGltZW5zaW9uLndpZHRoICsgJ3B4Jztcblx0XHRcdHRoaXMuX2NvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSBkaW1lbnNpb24uaGVpZ2h0ICsgJ3B4Jztcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9tYWtlQWNjZXNzb3IoKTogYW55IHtcblx0XHR0cnkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0Z2V0OiAoc2VydmljZUlkOiBhbnkpID0+IHtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oKGE6IFNlcnZpY2VzQWNjZXNzb3IpID0+IGEuZ2V0KHNlcnZpY2VJZCkpO1xuXHRcdFx0XHRcdH0gY2F0Y2ggeyByZXR1cm4gdW5kZWZpbmVkOyB9XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0fSBjYXRjaCB7XG5cdFx0XHRyZXR1cm4geyBnZXQ6ICgpID0+IHVuZGVmaW5lZCB9O1xuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFPQSxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHVCQUF1QjtBQU9oQyxTQUFTLGdCQUFnQixrQkFBa0I7QUFDM0MsU0FBUyw2QkFBNkI7QUFFdEMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxnQkFBZ0I7QUFFbEIsSUFBTSxrQkFBTixjQUE4QixXQUFXO0FBQUEsRUFVL0MsWUFDQyxPQUNtQixrQkFDSixjQUNFLGdCQUN1QixzQkFDUCxlQUNGLGFBQzlCO0FBQ0QsVUFBTSxnQkFBZ0IsSUFBSSxPQUFPLGtCQUFrQixjQUFjLGNBQWM7QUFKdkM7QUFDUDtBQUNGO0FBQUEsRUFHaEM7QUFBQSxFQUVVLGFBQWEsUUFBMkI7QUFDakQsVUFBTSxpQkFBaUIsT0FBTyxRQUFRLHlCQUF5QjtBQUMvRCxRQUFJLGdCQUFnQjtBQUNuQixZQUFNLEtBQUssZUFBZSxjQUFjLHlCQUF5QjtBQUNqRSxVQUFJLEdBQUksSUFBRyxNQUFNLFVBQVU7QUFBQSxJQUM1QjtBQUVBLFdBQU8sTUFBTSxVQUFVO0FBRXZCLFVBQU0sT0FBTyxTQUFTLGNBQWMsS0FBSztBQUN6QyxTQUFLLE1BQU0sVUFBVTtBQUNyQixXQUFPLFlBQVksSUFBSTtBQUN2QixTQUFLLGFBQWE7QUFFbEIsUUFBSTtBQUNILFlBQU0sV0FBVyxLQUFLLGNBQWM7QUFDcEMsV0FBSyxlQUFlLGVBQWUsTUFBTSxRQUFRO0FBR2pELFdBQUssb0JBQXFCLFdBQW1CLFVBQVUsTUFBTTtBQUM1RCxZQUFJLENBQUMsS0FBSyxjQUFlO0FBQ3pCLFlBQUksS0FBSyxtQkFBbUIsT0FBVyxjQUFhLEtBQUssY0FBYztBQUN2RSxhQUFLLGlCQUFpQixXQUFXLE1BQU0sS0FBSyxnQkFBZ0IsS0FBSyxhQUFjLEdBQUcsR0FBRztBQUFBLE1BQ3RGLENBQUM7QUFFRCxXQUFLLFVBQVUsYUFBYSxNQUFNO0FBQ2pDLGFBQUssY0FBYyxRQUFRO0FBQzNCLGFBQUssZUFBZTtBQUNwQixhQUFLLG9CQUFvQjtBQUN6QixhQUFLLG9CQUFvQjtBQUN6QixZQUFJLEtBQUssbUJBQW1CLFFBQVc7QUFDdEMsdUJBQWEsS0FBSyxjQUFjO0FBQ2hDLGVBQUssaUJBQWlCO0FBQUEsUUFDdkI7QUFBQSxNQUNELENBQUMsQ0FBQztBQUFBLElBQ0gsU0FBUyxHQUFHO0FBQ1gsY0FBUSxNQUFNLG1DQUFtQyxDQUFDO0FBQUEsSUFDbkQ7QUFBQSxFQUNEO0FBQUEsRUFFQSxNQUFlLFNBQ2QsT0FDQSxTQUNBLFNBQ0EsT0FDZ0I7QUFDaEIsVUFBTSxNQUFNLFNBQVMsT0FBTyxTQUFTLFNBQVMsS0FBSztBQUNuRCxTQUFLLG1CQUFtQixNQUFNO0FBQzlCLFNBQUssZ0JBQWdCO0FBRXJCLFVBQU0saUJBQWlCLE1BQU07QUFDNUIsVUFBSSxDQUFDLEtBQUssaUJBQWtCO0FBQzVCLFdBQUssY0FBYyxXQUFXLEVBQUUsVUFBVSxLQUFLLGtCQUFrQixTQUFTLEVBQUUsVUFBVSxXQUFXLFFBQVEsS0FBSyxFQUFFLENBQUM7QUFBQSxJQUNsSDtBQUdBLFVBQU0sVUFBVSxNQUFNLEtBQUssa0JBQWtCLEtBQUs7QUFFbEQsUUFBSSxLQUFLLGNBQWM7QUFDdEIsV0FBSyxhQUFhLFNBQVM7QUFBQSxRQUMxQixnQkFBZ0IsTUFBTTtBQUFBLFFBQ3RCO0FBQUEsUUFDQSxhQUFhO0FBQUEsTUFDZCxDQUFDO0FBQUEsSUFDRjtBQUFBLEVBQ0Q7QUFBQSxFQUVBLE1BQWMsa0JBQWtCLE9BQXVDO0FBQ3RFLFVBQU0sV0FBVyxNQUFNLFNBQVMsT0FBTyxNQUFNLEdBQUcsRUFBRSxJQUFJLEtBQUssTUFBTSxTQUFTLEtBQUssTUFBTSxHQUFHLEVBQUUsSUFBSSxLQUFLO0FBRW5HLFFBQUksVUFBVTtBQUNkLFFBQUksTUFBTSxTQUFTLFdBQVcsYUFBYTtBQUUxQyxVQUFJO0FBQUUsa0JBQVUsYUFBYSxRQUFRLEtBQUssaUJBQWlCLEtBQUssQ0FBQyxLQUFLO0FBQUEsTUFBSSxRQUFRO0FBQUUsa0JBQVU7QUFBQSxNQUFJO0FBQ2xHLFVBQUksQ0FBQyxRQUFRLEtBQUssR0FBRztBQUNwQixRQUFDLFdBQW1CLGdCQUFnQixRQUFRLE9BQU8sTUFBTSxRQUFRLGFBQWEsUUFBUSxFQUFFO0FBQ3hGLGVBQU87QUFBQSxNQUNSO0FBQUEsSUFDRCxPQUFPO0FBQ04sVUFBSTtBQUNILGNBQU0sY0FBYyxNQUFNLEtBQUssWUFBWSxTQUFTLE1BQU0sUUFBUTtBQUNsRSxrQkFBVSxZQUFZLE1BQU0sU0FBUztBQUFBLE1BQ3RDLFFBQVE7QUFFUCxRQUFDLFdBQW1CLGdCQUFnQixRQUFRLE9BQU8sTUFBTSxRQUFRLGFBQWEsUUFBUSxFQUFFO0FBQ3hGLGVBQU87QUFBQSxNQUNSO0FBQUEsSUFDRDtBQUVBLFFBQUksQ0FBQyxRQUFRLEtBQUssR0FBRztBQUNwQixNQUFDLFdBQW1CLGdCQUFnQixRQUFRLFNBQVMsTUFBTSxRQUFRLFVBQVUsUUFBUSxFQUFFO0FBQ3ZGLGFBQU87QUFBQSxJQUNSO0FBRUEsUUFBSTtBQUNILFlBQU0sU0FBUyxLQUFLLE1BQU0sT0FBTztBQUNqQyxZQUFNLE9BQU8sS0FBSyxhQUFhLE1BQU0sVUFBVSxNQUFNO0FBQ3JELGFBQU8sRUFBRSxVQUFVLE1BQU0sVUFBVSxTQUFTLFFBQVEsTUFBTSxTQUFTO0FBQUEsSUFDcEUsU0FBUyxHQUFRO0FBQ2hCLE1BQUMsV0FBbUIsZ0JBQWdCLFNBQVMsa0JBQWtCLFFBQVEsS0FBSyxHQUFHLFdBQVcsT0FBTyxDQUFDLENBQUMsRUFBRTtBQUNyRyxhQUFPO0FBQUEsSUFDUjtBQUFBLEVBQ0Q7QUFBQSxFQUVRLGFBQWEsVUFBa0IsUUFBb0I7QUFDMUQsVUFBTSxTQUFTLG9CQUFJLElBQWlCO0FBQ3BDLFVBQU0sTUFBTSxDQUFDLE1BQVc7QUFDdkIsVUFBSSxHQUFHLFFBQVEsQ0FBQyxPQUFPLElBQUksRUFBRSxJQUFJLEdBQUc7QUFDbkMsZUFBTyxJQUFJLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxNQUFNLFNBQVMsRUFBRSxXQUFXLElBQUksVUFBVSxFQUFFLFlBQVksUUFBUSxhQUFhLEdBQUcsQ0FBQztBQUFBLE1BQy9HO0FBQUEsSUFDRDtBQUVBLFFBQUksYUFBYSxNQUFNO0FBQ3RCLGlCQUFXLFFBQVEsT0FBTyxTQUFTLENBQUMsR0FBRztBQUN0QyxjQUFNLE1BQU0sQ0FBQyxHQUFJLEtBQUssWUFBWSxDQUFDLEdBQUksSUFBSSxLQUFLLFlBQVksQ0FBQyxHQUFHLFFBQVEsQ0FBQyxNQUFXLEVBQUUsWUFBWSxDQUFDLENBQUMsQ0FBQztBQUNyRyxtQkFBVyxNQUFNLEtBQUs7QUFDckIsY0FBSSxHQUFHLFNBQVMsYUFBYSxHQUFHLFNBQVMsT0FBUSxLQUFJLEdBQUcsR0FBRztBQUFBLG1CQUNsRCxHQUFHLFNBQVMsUUFBUyxRQUFPLE9BQU8sR0FBRyxRQUFRLENBQUMsQ0FBQyxFQUFFLFFBQVEsR0FBRztBQUFBLFFBQ3ZFO0FBQUEsTUFDRDtBQUFBLElBQ0QsV0FBVyxhQUFhLE9BQU87QUFDOUIsaUJBQVcsUUFBUSxPQUFPLFNBQVMsQ0FBQyxFQUFHLEtBQUksS0FBSyxHQUFHO0FBQUEsSUFDcEQsV0FBVyxhQUFhLE9BQU87QUFDOUIsaUJBQVcsUUFBUSxPQUFPLFNBQVMsQ0FBQyxHQUFHO0FBQ3RDLG1CQUFXLFVBQVUsS0FBSyxXQUFXLENBQUMsRUFBRyxLQUFJLE9BQU8sR0FBRztBQUFBLE1BQ3hEO0FBQUEsSUFDRDtBQUNBLFdBQU8sTUFBTSxLQUFLLE9BQU8sT0FBTyxDQUFDO0FBQUEsRUFDbEM7QUFBQSxFQUVRLGtCQUFrQixTQUEwQjtBQUVuRCxVQUFNLGVBQWUsb0JBQUksSUFBSSxDQUFDLGFBQWEsY0FBYyxhQUFhLGFBQWEsYUFBYSxDQUFDO0FBQ2pHLFdBQU8sS0FBSyxVQUFVLFNBQVMsQ0FBQyxLQUFLLFVBQVU7QUFDOUMsVUFBSSxhQUFhLElBQUksR0FBRyxFQUFHLFFBQU87QUFDbEMsYUFBTztBQUFBLElBQ1IsR0FBRyxDQUFDO0FBQUEsRUFDTDtBQUFBLEVBRVEsaUJBQWlCLE9BQWlDO0FBQ3pELFdBQU8sZ0JBQWdCLE1BQU0sU0FBUyxTQUFTLENBQUM7QUFBQSxFQUNqRDtBQUFBLEVBRUEsTUFBYyxnQkFBZ0IsT0FBd0M7QUFDckUsUUFBSSxDQUFDLE9BQU8sU0FBVTtBQUN0QixRQUFJO0FBQ0gsWUFBTSxRQUFTLFdBQW1CLFNBQVM7QUFDM0MsVUFBSTtBQUNKLFVBQUksTUFBTSxhQUFhLEtBQU0sV0FBVSxNQUFNO0FBQUEsZUFDcEMsTUFBTSxhQUFhLE1BQU8sV0FBVSxNQUFNO0FBQUEsZUFDMUMsTUFBTSxhQUFhLE1BQU8sV0FBVSxNQUFNO0FBQUEsVUFDOUM7QUFFTCxZQUFNLGFBQWEsS0FBSyxrQkFBa0IsT0FBTztBQUVqRCxVQUFJLE1BQU0sU0FBUyxXQUFXLGFBQWE7QUFFMUMsWUFBSTtBQUFFLHVCQUFhLFFBQVEsS0FBSyxpQkFBaUIsS0FBSyxHQUFHLFVBQVU7QUFBQSxRQUFHLFFBQVE7QUFBQSxRQUFxQjtBQUNuRztBQUFBLE1BQ0Q7QUFFQSxZQUFNLEtBQUssWUFBWSxVQUFVLE1BQU0sVUFBVSxTQUFTLFdBQVcsVUFBVSxDQUFDO0FBQUEsSUFDakYsU0FBUyxHQUFRO0FBQ2hCLGNBQVEsTUFBTSx1Q0FBdUMsQ0FBQztBQUFBLElBQ3ZEO0FBQUEsRUFDRDtBQUFBLEVBRVMsT0FBTyxXQUE0QjtBQUMzQyxRQUFJLEtBQUssWUFBWTtBQUNwQixXQUFLLFdBQVcsTUFBTSxRQUFRLFVBQVUsUUFBUTtBQUNoRCxXQUFLLFdBQVcsTUFBTSxTQUFTLFVBQVUsU0FBUztBQUFBLElBQ25EO0FBQUEsRUFDRDtBQUFBLEVBRVEsZ0JBQXFCO0FBQzVCLFFBQUk7QUFDSCxhQUFPO0FBQUEsUUFDTixLQUFLLENBQUMsY0FBbUI7QUFDeEIsY0FBSTtBQUNILG1CQUFPLEtBQUsscUJBQXFCLGVBQWUsQ0FBQyxNQUF3QixFQUFFLElBQUksU0FBUyxDQUFDO0FBQUEsVUFDMUYsUUFBUTtBQUFFLG1CQUFPO0FBQUEsVUFBVztBQUFBLFFBQzdCO0FBQUEsTUFDRDtBQUFBLElBQ0QsUUFBUTtBQUNQLGFBQU8sRUFBRSxLQUFLLE1BQU0sT0FBVTtBQUFBLElBQy9CO0FBQUEsRUFDRDtBQUNEO0FBak5hLGdCQUNJLEtBQUs7QUFEVCxrQkFBTjtBQUFBLEVBWUo7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBakJVOyIsCiAgIm5hbWVzIjogW10KfQo=
