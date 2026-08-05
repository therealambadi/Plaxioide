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
import { Emitter } from "../../../../../base/common/event.js";
import { DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IMarkerService } from "../../../../../platform/markers/common/markers.js";
import { CellKind } from "../../common/notebookCommon.js";
import { OutlineConfigKeys } from "../../../../services/outline/browser/outline.js";
import { INotebookOutlineEntryFactory } from "./notebookOutlineEntryFactory.js";
let NotebookCellOutlineDataSource = class {
  constructor(_editor, _markerService, _configurationService, _outlineEntryFactory) {
    this._editor = _editor;
    this._markerService = _markerService;
    this._configurationService = _configurationService;
    this._outlineEntryFactory = _outlineEntryFactory;
    this._disposables = new DisposableStore();
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
    this._entries = [];
    this.recomputeState();
  }
  get activeElement() {
    return this._activeEntry;
  }
  get entries() {
    return this._entries;
  }
  get isEmpty() {
    return this._entries.length === 0;
  }
  get uri() {
    return this._uri;
  }
  async computeFullSymbols(cancelToken) {
    try {
      const notebookEditorWidget = this._editor;
      const notebookCells = notebookEditorWidget?.getViewModel()?.viewCells.filter((cell) => cell.cellKind === CellKind.Code);
      if (notebookCells) {
        const promises = [];
        for (const cell of notebookCells.slice(0, 50)) {
          promises.push(this._outlineEntryFactory.cacheSymbols(cell, cancelToken));
        }
        await Promise.allSettled(promises);
      }
      this.recomputeState();
    } catch (err) {
      console.error("Failed to compute notebook outline symbols:", err);
      this.recomputeState();
    }
  }
  recomputeState() {
    this._disposables.clear();
    this._activeEntry = void 0;
    this._uri = void 0;
    if (!this._editor.hasModel()) {
      return;
    }
    this._uri = this._editor.textModel.uri;
    const notebookEditorWidget = this._editor;
    if (notebookEditorWidget.getLength() === 0) {
      return;
    }
    const notebookCells = notebookEditorWidget.getViewModel().viewCells;
    const entries = [];
    for (const cell of notebookCells) {
      entries.push(...this._outlineEntryFactory.getOutlineEntries(cell, entries.length));
    }
    if (entries.length > 0) {
      const result = [entries[0]];
      const parentStack = [entries[0]];
      for (let i = 1; i < entries.length; i++) {
        const entry = entries[i];
        while (true) {
          const len = parentStack.length;
          if (len === 0) {
            result.push(entry);
            parentStack.push(entry);
            break;
          } else {
            const parentCandidate = parentStack[len - 1];
            if (parentCandidate.level < entry.level) {
              parentCandidate.addChild(entry);
              parentStack.push(entry);
              break;
            } else {
              parentStack.pop();
            }
          }
        }
      }
      this._entries = result;
    }
    const markerServiceListener = new MutableDisposable();
    this._disposables.add(markerServiceListener);
    const updateMarkerUpdater = () => {
      if (notebookEditorWidget.isDisposed) {
        return;
      }
      const doUpdateMarker = (clear) => {
        for (const entry of this._entries) {
          if (clear) {
            entry.clearMarkers();
          } else {
            entry.updateMarkers(this._markerService);
          }
        }
      };
      const problem = this._configurationService.getValue("problems.visibility");
      if (problem === void 0) {
        return;
      }
      const config = this._configurationService.getValue(OutlineConfigKeys.problemsEnabled);
      if (problem && config) {
        markerServiceListener.value = this._markerService.onMarkerChanged((e) => {
          if (notebookEditorWidget.isDisposed) {
            console.error("notebook editor is disposed");
            return;
          }
          if (e.some((uri) => notebookEditorWidget.getCellsInRange().some((cell) => isEqual(cell.uri, uri)))) {
            doUpdateMarker(false);
            this._onDidChange.fire({});
          }
        });
        doUpdateMarker(false);
      } else {
        markerServiceListener.clear();
        doUpdateMarker(true);
      }
    };
    updateMarkerUpdater();
    this._disposables.add(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("problems.visibility") || e.affectsConfiguration(OutlineConfigKeys.problemsEnabled)) {
        updateMarkerUpdater();
        this._onDidChange.fire({});
      }
    }));
    const { changeEventTriggered } = this.recomputeActive();
    if (!changeEventTriggered) {
      this._onDidChange.fire({});
    }
  }
  recomputeActive() {
    let newActive;
    const notebookEditorWidget = this._editor;
    if (notebookEditorWidget) {
      if (notebookEditorWidget.hasModel() && notebookEditorWidget.getLength() > 0) {
        const cell = notebookEditorWidget.cellAt(notebookEditorWidget.getFocus().start);
        if (cell) {
          for (const entry of this._entries) {
            newActive = entry.find(cell, []);
            if (newActive) {
              break;
            }
          }
        }
      }
    }
    if (newActive !== this._activeEntry) {
      this._activeEntry = newActive;
      this._onDidChange.fire({ affectOnlyActiveElement: true });
      return { changeEventTriggered: true };
    }
    return { changeEventTriggered: false };
  }
  dispose() {
    this._entries.length = 0;
    this._activeEntry = void 0;
    this._disposables.dispose();
  }
};
NotebookCellOutlineDataSource = __decorateClass([
  __decorateParam(1, IMarkerService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, INotebookOutlineEntryFactory)
], NotebookCellOutlineDataSource);
export {
  NotebookCellOutlineDataSource
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL3ZpZXdNb2RlbC9ub3RlYm9va091dGxpbmVEYXRhU291cmNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIE11dGFibGVEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGlzRXF1YWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSU1hcmtlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9tYXJrZXJzL2NvbW1vbi9tYXJrZXJzLmpzJztcbmltcG9ydCB7IElBY3RpdmVOb3RlYm9va0VkaXRvciwgSU5vdGVib29rRWRpdG9yIH0gZnJvbSAnLi4vbm90ZWJvb2tCcm93c2VyLmpzJztcbmltcG9ydCB7IENlbGxLaW5kIH0gZnJvbSAnLi4vLi4vY29tbW9uL25vdGVib29rQ29tbW9uLmpzJztcbmltcG9ydCB7IE91dGxpbmVDaGFuZ2VFdmVudCwgT3V0bGluZUNvbmZpZ0tleXMgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9vdXRsaW5lL2Jyb3dzZXIvb3V0bGluZS5qcyc7XG5pbXBvcnQgeyBPdXRsaW5lRW50cnkgfSBmcm9tICcuL091dGxpbmVFbnRyeS5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tPdXRsaW5lRW50cnlGYWN0b3J5LCBOb3RlYm9va091dGxpbmVFbnRyeUZhY3RvcnkgfSBmcm9tICcuL25vdGVib29rT3V0bGluZUVudHJ5RmFjdG9yeS5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU5vdGVib29rQ2VsbE91dGxpbmVEYXRhU291cmNlIHtcblx0cmVhZG9ubHkgYWN0aXZlRWxlbWVudDogT3V0bGluZUVudHJ5IHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBlbnRyaWVzOiBPdXRsaW5lRW50cnlbXTtcbn1cblxuZXhwb3J0IGNsYXNzIE5vdGVib29rQ2VsbE91dGxpbmVEYXRhU291cmNlIGltcGxlbWVudHMgSU5vdGVib29rQ2VsbE91dGxpbmVEYXRhU291cmNlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9kaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZSA9IG5ldyBFbWl0dGVyPE91dGxpbmVDaGFuZ2VFdmVudD4oKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2U6IEV2ZW50PE91dGxpbmVDaGFuZ2VFdmVudD4gPSB0aGlzLl9vbkRpZENoYW5nZS5ldmVudDtcblxuXHRwcml2YXRlIF91cmk6IFVSSSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfZW50cmllczogT3V0bGluZUVudHJ5W10gPSBbXTtcblx0cHJpdmF0ZSBfYWN0aXZlRW50cnk/OiBPdXRsaW5lRW50cnk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yOiBJTm90ZWJvb2tFZGl0b3IsXG5cdFx0QElNYXJrZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX21hcmtlclNlcnZpY2U6IElNYXJrZXJTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASU5vdGVib29rT3V0bGluZUVudHJ5RmFjdG9yeSBwcml2YXRlIHJlYWRvbmx5IF9vdXRsaW5lRW50cnlGYWN0b3J5OiBOb3RlYm9va091dGxpbmVFbnRyeUZhY3Rvcnlcblx0KSB7XG5cdFx0dGhpcy5yZWNvbXB1dGVTdGF0ZSgpO1xuXHR9XG5cblx0Z2V0IGFjdGl2ZUVsZW1lbnQoKTogT3V0bGluZUVudHJ5IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fYWN0aXZlRW50cnk7XG5cdH1cblx0Z2V0IGVudHJpZXMoKTogT3V0bGluZUVudHJ5W10ge1xuXHRcdHJldHVybiB0aGlzLl9lbnRyaWVzO1xuXHR9XG5cdGdldCBpc0VtcHR5KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9lbnRyaWVzLmxlbmd0aCA9PT0gMDtcblx0fVxuXHRnZXQgdXJpKCkge1xuXHRcdHJldHVybiB0aGlzLl91cmk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgY29tcHV0ZUZ1bGxTeW1ib2xzKGNhbmNlbFRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbikge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBub3RlYm9va0VkaXRvcldpZGdldCA9IHRoaXMuX2VkaXRvcjtcblxuXHRcdFx0Y29uc3Qgbm90ZWJvb2tDZWxscyA9IG5vdGVib29rRWRpdG9yV2lkZ2V0Py5nZXRWaWV3TW9kZWwoKT8udmlld0NlbGxzLmZpbHRlcigoY2VsbCkgPT4gY2VsbC5jZWxsS2luZCA9PT0gQ2VsbEtpbmQuQ29kZSk7XG5cblx0XHRcdGlmIChub3RlYm9va0NlbGxzKSB7XG5cdFx0XHRcdGNvbnN0IHByb21pc2VzOiBQcm9taXNlPHZvaWQ+W10gPSBbXTtcblx0XHRcdFx0Ly8gbGltaXQgdGhlIG51bWJlciBvZiBjZWxscyBzbyB0aGF0IHdlIGRvbid0IHJlc29sdmUgYW4gZXhjZXNzaXZlIGFtb3VudCBvZiB0ZXh0IG1vZGVsc1xuXHRcdFx0XHRmb3IgKGNvbnN0IGNlbGwgb2Ygbm90ZWJvb2tDZWxscy5zbGljZSgwLCA1MCkpIHtcblx0XHRcdFx0XHQvLyBnYXRoZXIgYWxsIHN5bWJvbHMgYXN5bmNocm9ub3VzbHlcblx0XHRcdFx0XHRwcm9taXNlcy5wdXNoKHRoaXMuX291dGxpbmVFbnRyeUZhY3RvcnkuY2FjaGVTeW1ib2xzKGNlbGwsIGNhbmNlbFRva2VuKSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKHByb21pc2VzKTtcblx0XHRcdH1cblx0XHRcdHRoaXMucmVjb21wdXRlU3RhdGUoKTtcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBjb21wdXRlIG5vdGVib29rIG91dGxpbmUgc3ltYm9sczonLCBlcnIpO1xuXHRcdFx0Ly8gU3RpbGwgcmVjb21wdXRlIHN0YXRlIHdpdGggd2hhdGV2ZXIgc3ltYm9scyB3ZSBoYXZlXG5cdFx0XHR0aGlzLnJlY29tcHV0ZVN0YXRlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHJlY29tcHV0ZVN0YXRlKCk6IHZvaWQge1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0dGhpcy5fYWN0aXZlRW50cnkgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fdXJpID0gdW5kZWZpbmVkO1xuXG5cdFx0aWYgKCF0aGlzLl9lZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX3VyaSA9IHRoaXMuX2VkaXRvci50ZXh0TW9kZWwudXJpO1xuXG5cdFx0Y29uc3Qgbm90ZWJvb2tFZGl0b3JXaWRnZXQ6IElBY3RpdmVOb3RlYm9va0VkaXRvciA9IHRoaXMuX2VkaXRvcjtcblxuXHRcdGlmIChub3RlYm9va0VkaXRvcldpZGdldC5nZXRMZW5ndGgoKSA9PT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IG5vdGVib29rQ2VsbHMgPSBub3RlYm9va0VkaXRvcldpZGdldC5nZXRWaWV3TW9kZWwoKS52aWV3Q2VsbHM7XG5cblx0XHRjb25zdCBlbnRyaWVzOiBPdXRsaW5lRW50cnlbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgY2VsbCBvZiBub3RlYm9va0NlbGxzKSB7XG5cdFx0XHRlbnRyaWVzLnB1c2goLi4udGhpcy5fb3V0bGluZUVudHJ5RmFjdG9yeS5nZXRPdXRsaW5lRW50cmllcyhjZWxsLCBlbnRyaWVzLmxlbmd0aCkpO1xuXHRcdH1cblxuXHRcdC8vIGJ1aWxkIGEgdHJlZSBmcm9tIHRoZSBsaXN0IG9mIGVudHJpZXNcblx0XHRpZiAoZW50cmllcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRjb25zdCByZXN1bHQ6IE91dGxpbmVFbnRyeVtdID0gW2VudHJpZXNbMF1dO1xuXHRcdFx0Y29uc3QgcGFyZW50U3RhY2s6IE91dGxpbmVFbnRyeVtdID0gW2VudHJpZXNbMF1dO1xuXG5cdFx0XHRmb3IgKGxldCBpID0gMTsgaSA8IGVudHJpZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgZW50cnkgPSBlbnRyaWVzW2ldO1xuXG5cdFx0XHRcdHdoaWxlICh0cnVlKSB7XG5cdFx0XHRcdFx0Y29uc3QgbGVuID0gcGFyZW50U3RhY2subGVuZ3RoO1xuXHRcdFx0XHRcdGlmIChsZW4gPT09IDApIHtcblx0XHRcdFx0XHRcdC8vIHJvb3Qgbm9kZVxuXHRcdFx0XHRcdFx0cmVzdWx0LnB1c2goZW50cnkpO1xuXHRcdFx0XHRcdFx0cGFyZW50U3RhY2sucHVzaChlbnRyeSk7XG5cdFx0XHRcdFx0XHRicmVhaztcblxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRjb25zdCBwYXJlbnRDYW5kaWRhdGUgPSBwYXJlbnRTdGFja1tsZW4gLSAxXTtcblx0XHRcdFx0XHRcdGlmIChwYXJlbnRDYW5kaWRhdGUubGV2ZWwgPCBlbnRyeS5sZXZlbCkge1xuXHRcdFx0XHRcdFx0XHRwYXJlbnRDYW5kaWRhdGUuYWRkQ2hpbGQoZW50cnkpO1xuXHRcdFx0XHRcdFx0XHRwYXJlbnRTdGFjay5wdXNoKGVudHJ5KTtcblx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRwYXJlbnRTdGFjay5wb3AoKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHRoaXMuX2VudHJpZXMgPSByZXN1bHQ7XG5cdFx0fVxuXG5cdFx0Ly8gZmVhdHVyZTogc2hvdyBtYXJrZXJzIHdpdGggZWFjaCBjZWxsXG5cdFx0Y29uc3QgbWFya2VyU2VydmljZUxpc3RlbmVyID0gbmV3IE11dGFibGVEaXNwb3NhYmxlKCk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKG1hcmtlclNlcnZpY2VMaXN0ZW5lcik7XG5cdFx0Y29uc3QgdXBkYXRlTWFya2VyVXBkYXRlciA9ICgpID0+IHtcblx0XHRcdGlmIChub3RlYm9va0VkaXRvcldpZGdldC5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZG9VcGRhdGVNYXJrZXIgPSAoY2xlYXI6IGJvb2xlYW4pID0+IHtcblx0XHRcdFx0Zm9yIChjb25zdCBlbnRyeSBvZiB0aGlzLl9lbnRyaWVzKSB7XG5cdFx0XHRcdFx0aWYgKGNsZWFyKSB7XG5cdFx0XHRcdFx0XHRlbnRyeS5jbGVhck1hcmtlcnMoKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0ZW50cnkudXBkYXRlTWFya2Vycyh0aGlzLl9tYXJrZXJTZXJ2aWNlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHRjb25zdCBwcm9ibGVtID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ3Byb2JsZW1zLnZpc2liaWxpdHknKTtcblx0XHRcdGlmIChwcm9ibGVtID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBjb25maWcgPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShPdXRsaW5lQ29uZmlnS2V5cy5wcm9ibGVtc0VuYWJsZWQpO1xuXG5cdFx0XHRpZiAocHJvYmxlbSAmJiBjb25maWcpIHtcblx0XHRcdFx0bWFya2VyU2VydmljZUxpc3RlbmVyLnZhbHVlID0gdGhpcy5fbWFya2VyU2VydmljZS5vbk1hcmtlckNoYW5nZWQoZSA9PiB7XG5cdFx0XHRcdFx0aWYgKG5vdGVib29rRWRpdG9yV2lkZ2V0LmlzRGlzcG9zZWQpIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoJ25vdGVib29rIGVkaXRvciBpcyBkaXNwb3NlZCcpO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmIChlLnNvbWUodXJpID0+IG5vdGVib29rRWRpdG9yV2lkZ2V0LmdldENlbGxzSW5SYW5nZSgpLnNvbWUoY2VsbCA9PiBpc0VxdWFsKGNlbGwudXJpLCB1cmkpKSkpIHtcblx0XHRcdFx0XHRcdGRvVXBkYXRlTWFya2VyKGZhbHNlKTtcblx0XHRcdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoe30pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHRcdGRvVXBkYXRlTWFya2VyKGZhbHNlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG1hcmtlclNlcnZpY2VMaXN0ZW5lci5jbGVhcigpO1xuXHRcdFx0XHRkb1VwZGF0ZU1hcmtlcih0cnVlKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHVwZGF0ZU1hcmtlclVwZGF0ZXIoKTtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQodGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ3Byb2JsZW1zLnZpc2liaWxpdHknKSB8fCBlLmFmZmVjdHNDb25maWd1cmF0aW9uKE91dGxpbmVDb25maWdLZXlzLnByb2JsZW1zRW5hYmxlZCkpIHtcblx0XHRcdFx0dXBkYXRlTWFya2VyVXBkYXRlcigpO1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKHt9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRjb25zdCB7IGNoYW5nZUV2ZW50VHJpZ2dlcmVkIH0gPSB0aGlzLnJlY29tcHV0ZUFjdGl2ZSgpO1xuXHRcdGlmICghY2hhbmdlRXZlbnRUcmlnZ2VyZWQpIHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoe30pO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyByZWNvbXB1dGVBY3RpdmUoKTogeyBjaGFuZ2VFdmVudFRyaWdnZXJlZDogYm9vbGVhbiB9IHtcblx0XHRsZXQgbmV3QWN0aXZlOiBPdXRsaW5lRW50cnkgfCB1bmRlZmluZWQ7XG5cdFx0Y29uc3Qgbm90ZWJvb2tFZGl0b3JXaWRnZXQgPSB0aGlzLl9lZGl0b3I7XG5cblx0XHRpZiAobm90ZWJvb2tFZGl0b3JXaWRnZXQpIHsvL1RPRE8gZG9uJ3QgY2hlY2sgZm9yIHdpZGdldCwgb25seSBoZXJlIGlmIHdlIGRvIGhhdmVcblx0XHRcdGlmIChub3RlYm9va0VkaXRvcldpZGdldC5oYXNNb2RlbCgpICYmIG5vdGVib29rRWRpdG9yV2lkZ2V0LmdldExlbmd0aCgpID4gMCkge1xuXHRcdFx0XHRjb25zdCBjZWxsID0gbm90ZWJvb2tFZGl0b3JXaWRnZXQuY2VsbEF0KG5vdGVib29rRWRpdG9yV2lkZ2V0LmdldEZvY3VzKCkuc3RhcnQpO1xuXHRcdFx0XHRpZiAoY2VsbCkge1xuXHRcdFx0XHRcdGZvciAoY29uc3QgZW50cnkgb2YgdGhpcy5fZW50cmllcykge1xuXHRcdFx0XHRcdFx0bmV3QWN0aXZlID0gZW50cnkuZmluZChjZWxsLCBbXSk7XG5cdFx0XHRcdFx0XHRpZiAobmV3QWN0aXZlKSB7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChuZXdBY3RpdmUgIT09IHRoaXMuX2FjdGl2ZUVudHJ5KSB7XG5cdFx0XHR0aGlzLl9hY3RpdmVFbnRyeSA9IG5ld0FjdGl2ZTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoeyBhZmZlY3RPbmx5QWN0aXZlRWxlbWVudDogdHJ1ZSB9KTtcblx0XHRcdHJldHVybiB7IGNoYW5nZUV2ZW50VHJpZ2dlcmVkOiB0cnVlIH07XG5cdFx0fVxuXHRcdHJldHVybiB7IGNoYW5nZUV2ZW50VHJpZ2dlcmVkOiBmYWxzZSB9O1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9lbnRyaWVzLmxlbmd0aCA9IDA7XG5cdFx0dGhpcy5fYWN0aXZlRW50cnkgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZUFBc0I7QUFDL0IsU0FBUyxp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
