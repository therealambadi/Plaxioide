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
import { Disposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { LRUCache, ResourceMap } from "../../../../../base/common/map.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { URI } from "../../../../../base/common/uri.js";
import { INotebookService } from "../../common/notebookService.js";
import { IMenuService, MenuId } from "../../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { MarshalledId } from "../../../../../base/common/marshallingIds.js";
import { Schemas } from "../../../../../base/common/network.js";
import { getActiveWindow, runWhenWindowIdle } from "../../../../../base/browser/dom.js";
const _KernelInfo = class _KernelInfo {
  constructor(kernel) {
    this.notebookPriorities = new ResourceMap();
    this.kernel = kernel;
    this.score = -1;
    this.time = _KernelInfo._logicClock++;
  }
};
_KernelInfo._logicClock = 0;
let KernelInfo = _KernelInfo;
class NotebookTextModelLikeId {
  static str(k) {
    return `${k.notebookType}/${k.uri.toString()}`;
  }
  static obj(s) {
    const idx = s.indexOf("/");
    return {
      notebookType: s.substring(0, idx),
      uri: URI.parse(s.substring(idx + 1))
    };
  }
}
class SourceAction extends Disposable {
  constructor(action, model, isPrimary) {
    super();
    this.action = action;
    this.model = model;
    this.isPrimary = isPrimary;
    this._onDidChangeState = this._register(new Emitter());
    this.onDidChangeState = this._onDidChangeState.event;
  }
  async runAction() {
    if (this.execution) {
      return this.execution;
    }
    this.execution = this._runAction();
    this._onDidChangeState.fire();
    await this.execution;
    this.execution = void 0;
    this._onDidChangeState.fire();
  }
  async _runAction() {
    try {
      await this.action.run({
        uri: this.model.uri,
        $mid: MarshalledId.NotebookActionContext
      });
    } catch (error) {
      console.warn(`Kernel source command failed: ${error}`);
    }
  }
}
let NotebookKernelService = class extends Disposable {
  constructor(_notebookService, _storageService, _menuService, _contextKeyService) {
    super();
    this._notebookService = _notebookService;
    this._storageService = _storageService;
    this._menuService = _menuService;
    this._contextKeyService = _contextKeyService;
    this._kernels = /* @__PURE__ */ new Map();
    this._notebookBindings = new LRUCache(1e3, 0.7);
    this._onDidChangeNotebookKernelBinding = this._register(new Emitter());
    this._onDidAddKernel = this._register(new Emitter());
    this._onDidRemoveKernel = this._register(new Emitter());
    this._onDidChangeNotebookAffinity = this._register(new Emitter());
    this._onDidChangeSourceActions = this._register(new Emitter());
    this._onDidNotebookVariablesChange = this._register(new Emitter());
    this._kernelSources = /* @__PURE__ */ new Map();
    this._kernelSourceActionsUpdates = /* @__PURE__ */ new Map();
    this._kernelDetectionTasks = /* @__PURE__ */ new Map();
    this._onDidChangeKernelDetectionTasks = this._register(new Emitter());
    this._kernelSourceActionProviders = /* @__PURE__ */ new Map();
    this.onDidChangeSelectedNotebooks = this._onDidChangeNotebookKernelBinding.event;
    this.onDidAddKernel = this._onDidAddKernel.event;
    this.onDidRemoveKernel = this._onDidRemoveKernel.event;
    this.onDidChangeNotebookAffinity = this._onDidChangeNotebookAffinity.event;
    this.onDidChangeSourceActions = this._onDidChangeSourceActions.event;
    this.onDidChangeKernelDetectionTasks = this._onDidChangeKernelDetectionTasks.event;
    this.onDidNotebookVariablesUpdate = this._onDidNotebookVariablesChange.event;
    this._register(_notebookService.onDidAddNotebookDocument(this._tryAutoBindNotebook, this));
    this._register(_notebookService.onWillRemoveNotebookDocument((notebook) => {
      const id = NotebookTextModelLikeId.str(notebook);
      const kernelId = this._notebookBindings.get(id);
      if (kernelId && notebook.uri.scheme === Schemas.untitled) {
        this.selectKernelForNotebook(void 0, notebook);
      }
      this._kernelSourceActionsUpdates.get(id)?.dispose();
      this._kernelSourceActionsUpdates.delete(id);
    }));
    try {
      const data = JSON.parse(this._storageService.get(NotebookKernelService._storageNotebookBinding, StorageScope.WORKSPACE, "[]"));
      this._notebookBindings.fromJSON(data);
    } catch {
    }
  }
  dispose() {
    this._kernels.clear();
    this._kernelSources.forEach((v) => {
      v.menu.dispose();
      v.actions.forEach((a) => a[1].dispose());
    });
    this._kernelSourceActionsUpdates.forEach((v) => {
      v.dispose();
    });
    this._kernelSourceActionsUpdates.clear();
    super.dispose();
  }
  _persistMementos() {
    this._persistSoonHandle?.dispose();
    this._persistSoonHandle = runWhenWindowIdle(getActiveWindow(), () => {
      this._storageService.store(NotebookKernelService._storageNotebookBinding, JSON.stringify(this._notebookBindings), StorageScope.WORKSPACE, StorageTarget.MACHINE);
    }, 100);
  }
  static _score(kernel, notebook) {
    if (kernel.viewType === "*") {
      return 5;
    } else if (kernel.viewType === notebook.notebookType) {
      return 10;
    } else {
      return 0;
    }
  }
  _tryAutoBindNotebook(notebook, onlyThisKernel) {
    const id = this._notebookBindings.get(NotebookTextModelLikeId.str(notebook));
    if (!id) {
      return;
    }
    const existingKernel = this._kernels.get(id);
    if (!existingKernel || !NotebookKernelService._score(existingKernel.kernel, notebook)) {
      return;
    }
    if (!onlyThisKernel || existingKernel.kernel === onlyThisKernel) {
      this._onDidChangeNotebookKernelBinding.fire({ notebook: notebook.uri, oldKernel: void 0, newKernel: existingKernel.kernel.id });
    }
  }
  notifyVariablesChange(notebookUri) {
    this._onDidNotebookVariablesChange.fire(notebookUri);
  }
  registerKernel(kernel) {
    if (this._kernels.has(kernel.id)) {
      throw new Error(`NOTEBOOK CONTROLLER with id '${kernel.id}' already exists`);
    }
    this._kernels.set(kernel.id, new KernelInfo(kernel));
    this._onDidAddKernel.fire(kernel);
    for (const notebook of this._notebookService.getNotebookTextModels()) {
      this._tryAutoBindNotebook(notebook, kernel);
    }
    return toDisposable(() => {
      if (this._kernels.delete(kernel.id)) {
        this._onDidRemoveKernel.fire(kernel);
      }
      for (const [key, candidate] of Array.from(this._notebookBindings)) {
        if (candidate === kernel.id) {
          this._onDidChangeNotebookKernelBinding.fire({ notebook: NotebookTextModelLikeId.obj(key).uri, oldKernel: kernel.id, newKernel: void 0 });
        }
      }
    });
  }
  getMatchingKernel(notebook) {
    const kernels = [];
    for (const info of this._kernels.values()) {
      const score = NotebookKernelService._score(info.kernel, notebook);
      if (score) {
        kernels.push({
          score,
          kernel: info.kernel,
          instanceAffinity: info.notebookPriorities.get(notebook.uri) ?? 1
        });
      }
    }
    kernels.sort((a, b) => b.instanceAffinity - a.instanceAffinity || a.score - b.score || a.kernel.label.localeCompare(b.kernel.label));
    const all = kernels.map((obj) => obj.kernel);
    const selectedId = this._notebookBindings.get(NotebookTextModelLikeId.str(notebook));
    const selected = selectedId ? this._kernels.get(selectedId)?.kernel : void 0;
    const suggestions = kernels.filter((item) => item.instanceAffinity > 1).map((item) => item.kernel);
    const hidden = kernels.filter((item) => item.instanceAffinity < 0).map((item) => item.kernel);
    return { all, selected, suggestions, hidden };
  }
  getSelectedOrSuggestedKernel(notebook) {
    const info = this.getMatchingKernel(notebook);
    if (info.selected) {
      return info.selected;
    }
    const preferred = info.all.filter(
      (kernel) => this._kernels.get(kernel.id)?.notebookPriorities.get(notebook.uri) === 2
      /* vscode.NotebookControllerPriority.Preferred */
    );
    if (preferred.length === 1) {
      return preferred[0];
    }
    return info.all.length === 1 ? info.all[0] : void 0;
  }
  // a notebook has one kernel, a kernel has N notebooks
  // notebook <-1----N-> kernel
  selectKernelForNotebook(kernel, notebook) {
    const key = NotebookTextModelLikeId.str(notebook);
    const oldKernel = this._notebookBindings.get(key);
    if (oldKernel !== kernel?.id) {
      if (kernel) {
        this._notebookBindings.set(key, kernel.id);
      } else {
        this._notebookBindings.delete(key);
      }
      this._onDidChangeNotebookKernelBinding.fire({ notebook: notebook.uri, oldKernel, newKernel: kernel?.id });
      this._persistMementos();
    }
  }
  preselectKernelForNotebook(kernel, notebook) {
    const key = NotebookTextModelLikeId.str(notebook);
    const oldKernel = this._notebookBindings.get(key);
    if (oldKernel !== kernel?.id) {
      this._notebookBindings.set(key, kernel.id);
      this._persistMementos();
    }
  }
  updateKernelNotebookAffinity(kernel, notebook, preference) {
    const info = this._kernels.get(kernel.id);
    if (!info) {
      throw new Error(`UNKNOWN kernel '${kernel.id}'`);
    }
    if (preference === void 0) {
      info.notebookPriorities.delete(notebook);
    } else {
      info.notebookPriorities.set(notebook, preference);
    }
    this._onDidChangeNotebookAffinity.fire();
  }
  getRunningSourceActions(notebook) {
    const id = NotebookTextModelLikeId.str(notebook);
    const existingInfo = this._kernelSources.get(id);
    if (existingInfo) {
      return existingInfo.actions.filter((action) => action[0].execution).map((action) => action[0]);
    }
    return [];
  }
  getSourceActions(notebook, contextKeyService) {
    contextKeyService = contextKeyService ?? this._contextKeyService;
    const id = NotebookTextModelLikeId.str(notebook);
    const existingInfo = this._kernelSources.get(id);
    if (existingInfo) {
      return existingInfo.actions.map((a) => a[0]);
    }
    const sourceMenu = this._register(this._menuService.createMenu(MenuId.NotebookKernelSource, contextKeyService));
    const info = { menu: sourceMenu, actions: [] };
    const loadActionsFromMenu = (menu, document) => {
      const groups = menu.getActions({ shouldForwardArgs: true });
      const sourceActions = [];
      groups.forEach((group) => {
        const isPrimary = /^primary/.test(group[0]);
        group[1].forEach((action) => {
          const sourceAction = new SourceAction(action, document, isPrimary);
          const stateChangeListener = sourceAction.onDidChangeState(() => {
            this._onDidChangeSourceActions.fire({
              notebook: document.uri,
              viewType: document.notebookType
            });
          });
          sourceActions.push([sourceAction, stateChangeListener]);
        });
      });
      info.actions = sourceActions;
      this._kernelSources.set(id, info);
      this._onDidChangeSourceActions.fire({ notebook: document.uri, viewType: document.notebookType });
    };
    this._kernelSourceActionsUpdates.get(id)?.dispose();
    this._kernelSourceActionsUpdates.set(id, sourceMenu.onDidChange(() => {
      loadActionsFromMenu(sourceMenu, notebook);
    }));
    loadActionsFromMenu(sourceMenu, notebook);
    return info.actions.map((a) => a[0]);
  }
  registerNotebookKernelDetectionTask(task) {
    const notebookType = task.notebookType;
    const all = this._kernelDetectionTasks.get(notebookType) ?? [];
    all.push(task);
    this._kernelDetectionTasks.set(notebookType, all);
    this._onDidChangeKernelDetectionTasks.fire(notebookType);
    return toDisposable(() => {
      const all2 = this._kernelDetectionTasks.get(notebookType) ?? [];
      const idx = all2.indexOf(task);
      if (idx >= 0) {
        all2.splice(idx, 1);
        this._kernelDetectionTasks.set(notebookType, all2);
        this._onDidChangeKernelDetectionTasks.fire(notebookType);
      }
    });
  }
  getKernelDetectionTasks(notebook) {
    return this._kernelDetectionTasks.get(notebook.notebookType) ?? [];
  }
  registerKernelSourceActionProvider(viewType, provider) {
    const providers = this._kernelSourceActionProviders.get(viewType) ?? [];
    providers.push(provider);
    this._kernelSourceActionProviders.set(viewType, providers);
    this._onDidChangeSourceActions.fire({ viewType });
    const eventEmitterDisposable = provider.onDidChangeSourceActions?.(() => {
      this._onDidChangeSourceActions.fire({ viewType });
    });
    return toDisposable(() => {
      const providers2 = this._kernelSourceActionProviders.get(viewType) ?? [];
      const idx = providers2.indexOf(provider);
      if (idx >= 0) {
        providers2.splice(idx, 1);
        this._kernelSourceActionProviders.set(viewType, providers2);
      }
      eventEmitterDisposable?.dispose();
    });
  }
  /**
   * Get kernel source actions from providers
   */
  getKernelSourceActions2(notebook) {
    const viewType = notebook.notebookType;
    const providers = this._kernelSourceActionProviders.get(viewType) ?? [];
    const promises = providers.map((provider) => provider.provideKernelSourceActions());
    return Promise.all(promises).then((actions) => {
      return actions.reduce((a, b) => a.concat(b), []);
    });
  }
};
NotebookKernelService._storageNotebookBinding = "notebook.controller2NotebookBindings";
NotebookKernelService = __decorateClass([
  __decorateParam(0, INotebookService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IMenuService),
  __decorateParam(3, IContextKeyService)
], NotebookKernelService);
export {
  NotebookKernelService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL3NlcnZpY2VzL25vdGVib29rS2VybmVsU2VydmljZUltcGwudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBFdmVudCwgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rS2VybmVsU291cmNlQWN0aW9uLCBJTm90ZWJvb2tUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi9jb21tb24vbm90ZWJvb2tDb21tb24uanMnO1xuaW1wb3J0IHsgSU5vdGVib29rS2VybmVsLCBJU2VsZWN0ZWROb3RlYm9va3NDaGFuZ2VFdmVudCwgSU5vdGVib29rS2VybmVsTWF0Y2hSZXN1bHQsIElOb3RlYm9va0tlcm5lbFNlcnZpY2UsIElOb3RlYm9va1RleHRNb2RlbExpa2UsIElTb3VyY2VBY3Rpb24sIElOb3RlYm9va1NvdXJjZUFjdGlvbkNoYW5nZUV2ZW50LCBJTm90ZWJvb2tLZXJuZWxEZXRlY3Rpb25UYXNrLCBJS2VybmVsU291cmNlQWN0aW9uUHJvdmlkZXIgfSBmcm9tICcuLi8uLi9jb21tb24vbm90ZWJvb2tLZXJuZWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IExSVUNhY2hlLCBSZXNvdXJjZU1hcCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElOb3RlYm9va1NlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vbm90ZWJvb2tTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElNZW51LCBJTWVudVNlcnZpY2UsIE1lbnVJZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBNYXJzaGFsbGVkSWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXJzaGFsbGluZ0lkcy5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBnZXRBY3RpdmVXaW5kb3csIHJ1bldoZW5XaW5kb3dJZGxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5cbmNsYXNzIEtlcm5lbEluZm8ge1xuXG5cdHByaXZhdGUgc3RhdGljIF9sb2dpY0Nsb2NrID0gMDtcblxuXHRyZWFkb25seSBrZXJuZWw6IElOb3RlYm9va0tlcm5lbDtcblx0cHVibGljIHNjb3JlOiBudW1iZXI7XG5cdHJlYWRvbmx5IHRpbWU6IG51bWJlcjtcblxuXHRyZWFkb25seSBub3RlYm9va1ByaW9yaXRpZXMgPSBuZXcgUmVzb3VyY2VNYXA8bnVtYmVyPigpO1xuXG5cdGNvbnN0cnVjdG9yKGtlcm5lbDogSU5vdGVib29rS2VybmVsKSB7XG5cdFx0dGhpcy5rZXJuZWwgPSBrZXJuZWw7XG5cdFx0dGhpcy5zY29yZSA9IC0xO1xuXHRcdHRoaXMudGltZSA9IEtlcm5lbEluZm8uX2xvZ2ljQ2xvY2srKztcblx0fVxufVxuXG5jbGFzcyBOb3RlYm9va1RleHRNb2RlbExpa2VJZCB7XG5cdHN0YXRpYyBzdHIoazogSU5vdGVib29rVGV4dE1vZGVsTGlrZSk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGAke2subm90ZWJvb2tUeXBlfS8ke2sudXJpLnRvU3RyaW5nKCl9YDtcblx0fVxuXHRzdGF0aWMgb2JqKHM6IHN0cmluZyk6IElOb3RlYm9va1RleHRNb2RlbExpa2Uge1xuXHRcdGNvbnN0IGlkeCA9IHMuaW5kZXhPZignLycpO1xuXHRcdHJldHVybiB7XG5cdFx0XHRub3RlYm9va1R5cGU6IHMuc3Vic3RyaW5nKDAsIGlkeCksXG5cdFx0XHR1cmk6IFVSSS5wYXJzZShzLnN1YnN0cmluZyhpZHggKyAxKSlcblx0XHR9O1xuXHR9XG59XG5cbmNsYXNzIFNvdXJjZUFjdGlvbiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJU291cmNlQWN0aW9uIHtcblx0ZXhlY3V0aW9uOiBQcm9taXNlPHZvaWQ+IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVN0YXRlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlU3RhdGUgPSB0aGlzLl9vbkRpZENoYW5nZVN0YXRlLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IGFjdGlvbjogSUFjdGlvbixcblx0XHRyZWFkb25seSBtb2RlbDogSU5vdGVib29rVGV4dE1vZGVsTGlrZSxcblx0XHRyZWFkb25seSBpc1ByaW1hcnk6IGJvb2xlYW5cblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdGFzeW5jIHJ1bkFjdGlvbigpIHtcblx0XHRpZiAodGhpcy5leGVjdXRpb24pIHtcblx0XHRcdHJldHVybiB0aGlzLmV4ZWN1dGlvbjtcblx0XHR9XG5cblx0XHR0aGlzLmV4ZWN1dGlvbiA9IHRoaXMuX3J1bkFjdGlvbigpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlU3RhdGUuZmlyZSgpO1xuXHRcdGF3YWl0IHRoaXMuZXhlY3V0aW9uO1xuXHRcdHRoaXMuZXhlY3V0aW9uID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlU3RhdGUuZmlyZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfcnVuQWN0aW9uKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLmFjdGlvbi5ydW4oe1xuXHRcdFx0XHR1cmk6IHRoaXMubW9kZWwudXJpLFxuXHRcdFx0XHQkbWlkOiBNYXJzaGFsbGVkSWQuTm90ZWJvb2tBY3Rpb25Db250ZXh0XG5cdFx0XHR9KTtcblxuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRjb25zb2xlLndhcm4oYEtlcm5lbCBzb3VyY2UgY29tbWFuZCBmYWlsZWQ6ICR7ZXJyb3J9YCk7XG5cdFx0fVxuXHR9XG59XG5cbmludGVyZmFjZSBJS2VybmVsSW5mb0NhY2hlIHtcblx0bWVudTogSU1lbnU7XG5cdGFjdGlvbnM6IFtJU291cmNlQWN0aW9uLCBJRGlzcG9zYWJsZV1bXTtcblxufVxuXG5leHBvcnQgY2xhc3MgTm90ZWJvb2tLZXJuZWxTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElOb3RlYm9va0tlcm5lbFNlcnZpY2Uge1xuXG5cdGRlY2xhcmUgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2tlcm5lbHMgPSBuZXcgTWFwPHN0cmluZywgS2VybmVsSW5mbz4oKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9ub3RlYm9va0JpbmRpbmdzID0gbmV3IExSVUNhY2hlPHN0cmluZywgc3RyaW5nPigxMDAwLCAwLjcpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlTm90ZWJvb2tLZXJuZWxCaW5kaW5nID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVNlbGVjdGVkTm90ZWJvb2tzQ2hhbmdlRXZlbnQ+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEFkZEtlcm5lbCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElOb3RlYm9va0tlcm5lbD4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkUmVtb3ZlS2VybmVsID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SU5vdGVib29rS2VybmVsPigpKTtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VOb3RlYm9va0FmZmluaXR5ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlU291cmNlQWN0aW9ucyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElOb3RlYm9va1NvdXJjZUFjdGlvbkNoYW5nZUV2ZW50PigpKTtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWROb3RlYm9va1ZhcmlhYmxlc0NoYW5nZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPFVSST4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2tlcm5lbFNvdXJjZXMgPSBuZXcgTWFwPHN0cmluZywgSUtlcm5lbEluZm9DYWNoZT4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfa2VybmVsU291cmNlQWN0aW9uc1VwZGF0ZXMgPSBuZXcgTWFwPHN0cmluZywgSURpc3Bvc2FibGU+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2tlcm5lbERldGVjdGlvblRhc2tzID0gbmV3IE1hcDxzdHJpbmcsIElOb3RlYm9va0tlcm5lbERldGVjdGlvblRhc2tbXT4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VLZXJuZWxEZXRlY3Rpb25UYXNrcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHN0cmluZz4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2tlcm5lbFNvdXJjZUFjdGlvblByb3ZpZGVycyA9IG5ldyBNYXA8c3RyaW5nLCBJS2VybmVsU291cmNlQWN0aW9uUHJvdmlkZXJbXT4oKTtcblxuXHRyZWFkb25seSBvbkRpZENoYW5nZVNlbGVjdGVkTm90ZWJvb2tzOiBFdmVudDxJU2VsZWN0ZWROb3RlYm9va3NDaGFuZ2VFdmVudD4gPSB0aGlzLl9vbkRpZENoYW5nZU5vdGVib29rS2VybmVsQmluZGluZy5ldmVudDtcblx0cmVhZG9ubHkgb25EaWRBZGRLZXJuZWw6IEV2ZW50PElOb3RlYm9va0tlcm5lbD4gPSB0aGlzLl9vbkRpZEFkZEtlcm5lbC5ldmVudDtcblx0cmVhZG9ubHkgb25EaWRSZW1vdmVLZXJuZWw6IEV2ZW50PElOb3RlYm9va0tlcm5lbD4gPSB0aGlzLl9vbkRpZFJlbW92ZUtlcm5lbC5ldmVudDtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VOb3RlYm9va0FmZmluaXR5OiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkQ2hhbmdlTm90ZWJvb2tBZmZpbml0eS5ldmVudDtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VTb3VyY2VBY3Rpb25zOiBFdmVudDxJTm90ZWJvb2tTb3VyY2VBY3Rpb25DaGFuZ2VFdmVudD4gPSB0aGlzLl9vbkRpZENoYW5nZVNvdXJjZUFjdGlvbnMuZXZlbnQ7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlS2VybmVsRGV0ZWN0aW9uVGFza3M6IEV2ZW50PHN0cmluZz4gPSB0aGlzLl9vbkRpZENoYW5nZUtlcm5lbERldGVjdGlvblRhc2tzLmV2ZW50O1xuXHRyZWFkb25seSBvbkRpZE5vdGVib29rVmFyaWFibGVzVXBkYXRlOiBFdmVudDxVUkk+ID0gdGhpcy5fb25EaWROb3RlYm9va1ZhcmlhYmxlc0NoYW5nZS5ldmVudDtcblxuXHRwcml2YXRlIHN0YXRpYyBfc3RvcmFnZU5vdGVib29rQmluZGluZyA9ICdub3RlYm9vay5jb250cm9sbGVyMk5vdGVib29rQmluZGluZ3MnO1xuXG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElOb3RlYm9va1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbm90ZWJvb2tTZXJ2aWNlOiBJTm90ZWJvb2tTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASU1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX21lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHQvLyBhdXRvIGFzc29jaWF0ZSBrZXJuZWxzIHRvIG5ldyBub3RlYm9vayBkb2N1bWVudHMsIGFsc28gZW1pdCBldmVudCB3aGVuXG5cdFx0Ly8gYSBub3RlYm9vayBoYXMgYmVlbiBjbG9zZWQgKGJ1dCBkb24ndCB1cGRhdGUgdGhlIG1lbWVudG8pXG5cdFx0dGhpcy5fcmVnaXN0ZXIoX25vdGVib29rU2VydmljZS5vbkRpZEFkZE5vdGVib29rRG9jdW1lbnQodGhpcy5fdHJ5QXV0b0JpbmROb3RlYm9vaywgdGhpcykpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKF9ub3RlYm9va1NlcnZpY2Uub25XaWxsUmVtb3ZlTm90ZWJvb2tEb2N1bWVudChub3RlYm9vayA9PiB7XG5cdFx0XHRjb25zdCBpZCA9IE5vdGVib29rVGV4dE1vZGVsTGlrZUlkLnN0cihub3RlYm9vayk7XG5cdFx0XHRjb25zdCBrZXJuZWxJZCA9IHRoaXMuX25vdGVib29rQmluZGluZ3MuZ2V0KGlkKTtcblx0XHRcdGlmIChrZXJuZWxJZCAmJiBub3RlYm9vay51cmkuc2NoZW1lID09PSBTY2hlbWFzLnVudGl0bGVkKSB7XG5cdFx0XHRcdHRoaXMuc2VsZWN0S2VybmVsRm9yTm90ZWJvb2sodW5kZWZpbmVkLCBub3RlYm9vayk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9rZXJuZWxTb3VyY2VBY3Rpb25zVXBkYXRlcy5nZXQoaWQpPy5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLl9rZXJuZWxTb3VyY2VBY3Rpb25zVXBkYXRlcy5kZWxldGUoaWQpO1xuXHRcdH0pKTtcblxuXHRcdC8vIHJlc3RvcmUgZnJvbSBzdG9yYWdlXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGRhdGEgPSBKU09OLnBhcnNlKHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLmdldChOb3RlYm9va0tlcm5lbFNlcnZpY2UuX3N0b3JhZ2VOb3RlYm9va0JpbmRpbmcsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsICdbXScpKTtcblx0XHRcdHRoaXMuX25vdGVib29rQmluZGluZ3MuZnJvbUpTT04oZGF0YSk7XG5cdFx0fSBjYXRjaCB7XG5cdFx0XHQvLyBpZ25vcmVcblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCkge1xuXHRcdHRoaXMuX2tlcm5lbHMuY2xlYXIoKTtcblx0XHR0aGlzLl9rZXJuZWxTb3VyY2VzLmZvckVhY2godiA9PiB7XG5cdFx0XHR2Lm1lbnUuZGlzcG9zZSgpO1xuXHRcdFx0di5hY3Rpb25zLmZvckVhY2goYSA9PiBhWzFdLmRpc3Bvc2UoKSk7XG5cdFx0fSk7XG5cdFx0dGhpcy5fa2VybmVsU291cmNlQWN0aW9uc1VwZGF0ZXMuZm9yRWFjaCh2ID0+IHtcblx0XHRcdHYuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXHRcdHRoaXMuX2tlcm5lbFNvdXJjZUFjdGlvbnNVcGRhdGVzLmNsZWFyKCk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcGVyc2lzdFNvb25IYW5kbGU/OiBJRGlzcG9zYWJsZTtcblxuXHRwcml2YXRlIF9wZXJzaXN0TWVtZW50b3MoKTogdm9pZCB7XG5cdFx0dGhpcy5fcGVyc2lzdFNvb25IYW5kbGU/LmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9wZXJzaXN0U29vbkhhbmRsZSA9IHJ1bldoZW5XaW5kb3dJZGxlKGdldEFjdGl2ZVdpbmRvdygpLCAoKSA9PiB7XG5cdFx0XHR0aGlzLl9zdG9yYWdlU2VydmljZS5zdG9yZShOb3RlYm9va0tlcm5lbFNlcnZpY2UuX3N0b3JhZ2VOb3RlYm9va0JpbmRpbmcsIEpTT04uc3RyaW5naWZ5KHRoaXMuX25vdGVib29rQmluZGluZ3MpLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdH0sIDEwMCk7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfc2NvcmUoa2VybmVsOiBJTm90ZWJvb2tLZXJuZWwsIG5vdGVib29rOiBJTm90ZWJvb2tUZXh0TW9kZWxMaWtlKTogbnVtYmVyIHtcblx0XHRpZiAoa2VybmVsLnZpZXdUeXBlID09PSAnKicpIHtcblx0XHRcdHJldHVybiA1O1xuXHRcdH0gZWxzZSBpZiAoa2VybmVsLnZpZXdUeXBlID09PSBub3RlYm9vay5ub3RlYm9va1R5cGUpIHtcblx0XHRcdHJldHVybiAxMDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfdHJ5QXV0b0JpbmROb3RlYm9vayhub3RlYm9vazogSU5vdGVib29rVGV4dE1vZGVsLCBvbmx5VGhpc0tlcm5lbD86IElOb3RlYm9va0tlcm5lbCk6IHZvaWQge1xuXG5cdFx0Y29uc3QgaWQgPSB0aGlzLl9ub3RlYm9va0JpbmRpbmdzLmdldChOb3RlYm9va1RleHRNb2RlbExpa2VJZC5zdHIobm90ZWJvb2spKTtcblx0XHRpZiAoIWlkKSB7XG5cdFx0XHQvLyBubyBrZXJuZWwgYXNzb2NpYXRlZFxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBleGlzdGluZ0tlcm5lbCA9IHRoaXMuX2tlcm5lbHMuZ2V0KGlkKTtcblx0XHRpZiAoIWV4aXN0aW5nS2VybmVsIHx8ICFOb3RlYm9va0tlcm5lbFNlcnZpY2UuX3Njb3JlKGV4aXN0aW5nS2VybmVsLmtlcm5lbCwgbm90ZWJvb2spKSB7XG5cdFx0XHQvLyBhc3NvY2lhdGVkIGtlcm5lbCBub3Qga25vd24sIG5vdCBtYXRjaGluZ1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoIW9ubHlUaGlzS2VybmVsIHx8IGV4aXN0aW5nS2VybmVsLmtlcm5lbCA9PT0gb25seVRoaXNLZXJuZWwpIHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlTm90ZWJvb2tLZXJuZWxCaW5kaW5nLmZpcmUoeyBub3RlYm9vazogbm90ZWJvb2sudXJpLCBvbGRLZXJuZWw6IHVuZGVmaW5lZCwgbmV3S2VybmVsOiBleGlzdGluZ0tlcm5lbC5rZXJuZWwuaWQgfSk7XG5cdFx0fVxuXHR9XG5cblx0bm90aWZ5VmFyaWFibGVzQ2hhbmdlKG5vdGVib29rVXJpOiBVUkkpOiB2b2lkIHtcblx0XHR0aGlzLl9vbkRpZE5vdGVib29rVmFyaWFibGVzQ2hhbmdlLmZpcmUobm90ZWJvb2tVcmkpO1xuXHR9XG5cblx0cmVnaXN0ZXJLZXJuZWwoa2VybmVsOiBJTm90ZWJvb2tLZXJuZWwpOiBJRGlzcG9zYWJsZSB7XG5cdFx0aWYgKHRoaXMuX2tlcm5lbHMuaGFzKGtlcm5lbC5pZCkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgTk9URUJPT0sgQ09OVFJPTExFUiB3aXRoIGlkICcke2tlcm5lbC5pZH0nIGFscmVhZHkgZXhpc3RzYCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fa2VybmVscy5zZXQoa2VybmVsLmlkLCBuZXcgS2VybmVsSW5mbyhrZXJuZWwpKTtcblx0XHR0aGlzLl9vbkRpZEFkZEtlcm5lbC5maXJlKGtlcm5lbCk7XG5cblx0XHQvLyBhdXRvIGFzc29jaWF0ZSB0aGUgbmV3IGtlcm5lbCB0byBleGlzdGluZyBub3RlYm9va3MgaXQgd2FzXG5cdFx0Ly8gYXNzb2NpYXRlZCB0byBpbiB0aGUgcGFzdC5cblx0XHRmb3IgKGNvbnN0IG5vdGVib29rIG9mIHRoaXMuX25vdGVib29rU2VydmljZS5nZXROb3RlYm9va1RleHRNb2RlbHMoKSkge1xuXHRcdFx0dGhpcy5fdHJ5QXV0b0JpbmROb3RlYm9vayhub3RlYm9vaywga2VybmVsKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLl9rZXJuZWxzLmRlbGV0ZShrZXJuZWwuaWQpKSB7XG5cdFx0XHRcdHRoaXMuX29uRGlkUmVtb3ZlS2VybmVsLmZpcmUoa2VybmVsKTtcblx0XHRcdH1cblx0XHRcdGZvciAoY29uc3QgW2tleSwgY2FuZGlkYXRlXSBvZiBBcnJheS5mcm9tKHRoaXMuX25vdGVib29rQmluZGluZ3MpKSB7XG5cdFx0XHRcdGlmIChjYW5kaWRhdGUgPT09IGtlcm5lbC5pZCkge1xuXHRcdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlTm90ZWJvb2tLZXJuZWxCaW5kaW5nLmZpcmUoeyBub3RlYm9vazogTm90ZWJvb2tUZXh0TW9kZWxMaWtlSWQub2JqKGtleSkudXJpLCBvbGRLZXJuZWw6IGtlcm5lbC5pZCwgbmV3S2VybmVsOiB1bmRlZmluZWQgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdGdldE1hdGNoaW5nS2VybmVsKG5vdGVib29rOiBJTm90ZWJvb2tUZXh0TW9kZWxMaWtlKTogSU5vdGVib29rS2VybmVsTWF0Y2hSZXN1bHQge1xuXG5cdFx0Ly8gYWxsIGFwcGxpY2FibGUga2VybmVsc1xuXHRcdGNvbnN0IGtlcm5lbHM6IHsga2VybmVsOiBJTm90ZWJvb2tLZXJuZWw7IGluc3RhbmNlQWZmaW5pdHk6IG51bWJlcjsgc2NvcmU6IG51bWJlciB9W10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGluZm8gb2YgdGhpcy5fa2VybmVscy52YWx1ZXMoKSkge1xuXHRcdFx0Y29uc3Qgc2NvcmUgPSBOb3RlYm9va0tlcm5lbFNlcnZpY2UuX3Njb3JlKGluZm8ua2VybmVsLCBub3RlYm9vayk7XG5cdFx0XHRpZiAoc2NvcmUpIHtcblx0XHRcdFx0a2VybmVscy5wdXNoKHtcblx0XHRcdFx0XHRzY29yZSxcblx0XHRcdFx0XHRrZXJuZWw6IGluZm8ua2VybmVsLFxuXHRcdFx0XHRcdGluc3RhbmNlQWZmaW5pdHk6IGluZm8ubm90ZWJvb2tQcmlvcml0aWVzLmdldChub3RlYm9vay51cmkpID8/IDEgLyogdnNjb2RlLk5vdGVib29rQ29udHJvbGxlclByaW9yaXR5LkRlZmF1bHQgKi8sXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGtlcm5lbHNcblx0XHRcdC5zb3J0KChhLCBiKSA9PiBiLmluc3RhbmNlQWZmaW5pdHkgLSBhLmluc3RhbmNlQWZmaW5pdHkgfHwgYS5zY29yZSAtIGIuc2NvcmUgfHwgYS5rZXJuZWwubGFiZWwubG9jYWxlQ29tcGFyZShiLmtlcm5lbC5sYWJlbCkpO1xuXHRcdGNvbnN0IGFsbCA9IGtlcm5lbHMubWFwKG9iaiA9PiBvYmoua2VybmVsKTtcblxuXHRcdC8vIGJvdW5kIGtlcm5lbFxuXHRcdGNvbnN0IHNlbGVjdGVkSWQgPSB0aGlzLl9ub3RlYm9va0JpbmRpbmdzLmdldChOb3RlYm9va1RleHRNb2RlbExpa2VJZC5zdHIobm90ZWJvb2spKTtcblx0XHRjb25zdCBzZWxlY3RlZCA9IHNlbGVjdGVkSWQgPyB0aGlzLl9rZXJuZWxzLmdldChzZWxlY3RlZElkKT8ua2VybmVsIDogdW5kZWZpbmVkO1xuXHRcdGNvbnN0IHN1Z2dlc3Rpb25zID0ga2VybmVscy5maWx0ZXIoaXRlbSA9PiBpdGVtLmluc3RhbmNlQWZmaW5pdHkgPiAxKS5tYXAoaXRlbSA9PiBpdGVtLmtlcm5lbCk7XG5cdFx0Y29uc3QgaGlkZGVuID0ga2VybmVscy5maWx0ZXIoaXRlbSA9PiBpdGVtLmluc3RhbmNlQWZmaW5pdHkgPCAwKS5tYXAoaXRlbSA9PiBpdGVtLmtlcm5lbCk7XG5cdFx0cmV0dXJuIHsgYWxsLCBzZWxlY3RlZCwgc3VnZ2VzdGlvbnMsIGhpZGRlbiB9O1xuXHR9XG5cblx0Z2V0U2VsZWN0ZWRPclN1Z2dlc3RlZEtlcm5lbChub3RlYm9vazogSU5vdGVib29rVGV4dE1vZGVsKTogSU5vdGVib29rS2VybmVsIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBpbmZvID0gdGhpcy5nZXRNYXRjaGluZ0tlcm5lbChub3RlYm9vayk7XG5cdFx0aWYgKGluZm8uc2VsZWN0ZWQpIHtcblx0XHRcdHJldHVybiBpbmZvLnNlbGVjdGVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByZWZlcnJlZCA9IGluZm8uYWxsLmZpbHRlcihrZXJuZWwgPT4gdGhpcy5fa2VybmVscy5nZXQoa2VybmVsLmlkKT8ubm90ZWJvb2tQcmlvcml0aWVzLmdldChub3RlYm9vay51cmkpID09PSAyIC8qIHZzY29kZS5Ob3RlYm9va0NvbnRyb2xsZXJQcmlvcml0eS5QcmVmZXJyZWQgKi8pO1xuXHRcdGlmIChwcmVmZXJyZWQubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRyZXR1cm4gcHJlZmVycmVkWzBdO1xuXHRcdH1cblxuXHRcdHJldHVybiBpbmZvLmFsbC5sZW5ndGggPT09IDEgPyBpbmZvLmFsbFswXSA6IHVuZGVmaW5lZDtcblx0fVxuXG5cdC8vIGEgbm90ZWJvb2sgaGFzIG9uZSBrZXJuZWwsIGEga2VybmVsIGhhcyBOIG5vdGVib29rc1xuXHQvLyBub3RlYm9vayA8LTEtLS0tTi0+IGtlcm5lbFxuXHRzZWxlY3RLZXJuZWxGb3JOb3RlYm9vayhrZXJuZWw6IElOb3RlYm9va0tlcm5lbCB8IHVuZGVmaW5lZCwgbm90ZWJvb2s6IElOb3RlYm9va1RleHRNb2RlbExpa2UpOiB2b2lkIHtcblx0XHRjb25zdCBrZXkgPSBOb3RlYm9va1RleHRNb2RlbExpa2VJZC5zdHIobm90ZWJvb2spO1xuXHRcdGNvbnN0IG9sZEtlcm5lbCA9IHRoaXMuX25vdGVib29rQmluZGluZ3MuZ2V0KGtleSk7XG5cdFx0aWYgKG9sZEtlcm5lbCAhPT0ga2VybmVsPy5pZCkge1xuXHRcdFx0aWYgKGtlcm5lbCkge1xuXHRcdFx0XHR0aGlzLl9ub3RlYm9va0JpbmRpbmdzLnNldChrZXksIGtlcm5lbC5pZCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl9ub3RlYm9va0JpbmRpbmdzLmRlbGV0ZShrZXkpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VOb3RlYm9va0tlcm5lbEJpbmRpbmcuZmlyZSh7IG5vdGVib29rOiBub3RlYm9vay51cmksIG9sZEtlcm5lbCwgbmV3S2VybmVsOiBrZXJuZWw/LmlkIH0pO1xuXHRcdFx0dGhpcy5fcGVyc2lzdE1lbWVudG9zKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJlc2VsZWN0S2VybmVsRm9yTm90ZWJvb2soa2VybmVsOiBJTm90ZWJvb2tLZXJuZWwsIG5vdGVib29rOiBJTm90ZWJvb2tUZXh0TW9kZWxMaWtlKTogdm9pZCB7XG5cdFx0Y29uc3Qga2V5ID0gTm90ZWJvb2tUZXh0TW9kZWxMaWtlSWQuc3RyKG5vdGVib29rKTtcblx0XHRjb25zdCBvbGRLZXJuZWwgPSB0aGlzLl9ub3RlYm9va0JpbmRpbmdzLmdldChrZXkpO1xuXHRcdGlmIChvbGRLZXJuZWwgIT09IGtlcm5lbD8uaWQpIHtcblx0XHRcdHRoaXMuX25vdGVib29rQmluZGluZ3Muc2V0KGtleSwga2VybmVsLmlkKTtcblx0XHRcdHRoaXMuX3BlcnNpc3RNZW1lbnRvcygpO1xuXHRcdH1cblx0fVxuXG5cdHVwZGF0ZUtlcm5lbE5vdGVib29rQWZmaW5pdHkoa2VybmVsOiBJTm90ZWJvb2tLZXJuZWwsIG5vdGVib29rOiBVUkksIHByZWZlcmVuY2U6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGNvbnN0IGluZm8gPSB0aGlzLl9rZXJuZWxzLmdldChrZXJuZWwuaWQpO1xuXHRcdGlmICghaW5mbykge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBVTktOT1dOIGtlcm5lbCAnJHtrZXJuZWwuaWR9J2ApO1xuXHRcdH1cblx0XHRpZiAocHJlZmVyZW5jZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRpbmZvLm5vdGVib29rUHJpb3JpdGllcy5kZWxldGUobm90ZWJvb2spO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpbmZvLm5vdGVib29rUHJpb3JpdGllcy5zZXQobm90ZWJvb2ssIHByZWZlcmVuY2UpO1xuXHRcdH1cblx0XHR0aGlzLl9vbkRpZENoYW5nZU5vdGVib29rQWZmaW5pdHkuZmlyZSgpO1xuXHR9XG5cblx0Z2V0UnVubmluZ1NvdXJjZUFjdGlvbnMobm90ZWJvb2s6IElOb3RlYm9va1RleHRNb2RlbExpa2UpIHtcblx0XHRjb25zdCBpZCA9IE5vdGVib29rVGV4dE1vZGVsTGlrZUlkLnN0cihub3RlYm9vayk7XG5cdFx0Y29uc3QgZXhpc3RpbmdJbmZvID0gdGhpcy5fa2VybmVsU291cmNlcy5nZXQoaWQpO1xuXHRcdGlmIChleGlzdGluZ0luZm8pIHtcblx0XHRcdHJldHVybiBleGlzdGluZ0luZm8uYWN0aW9ucy5maWx0ZXIoYWN0aW9uID0+IGFjdGlvblswXS5leGVjdXRpb24pLm1hcChhY3Rpb24gPT4gYWN0aW9uWzBdKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gW107XG5cdH1cblxuXHRnZXRTb3VyY2VBY3Rpb25zKG5vdGVib29rOiBJTm90ZWJvb2tUZXh0TW9kZWxMaWtlLCBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlIHwgdW5kZWZpbmVkKTogSVNvdXJjZUFjdGlvbltdIHtcblx0XHRjb250ZXh0S2V5U2VydmljZSA9IGNvbnRleHRLZXlTZXJ2aWNlID8/IHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlO1xuXHRcdGNvbnN0IGlkID0gTm90ZWJvb2tUZXh0TW9kZWxMaWtlSWQuc3RyKG5vdGVib29rKTtcblx0XHRjb25zdCBleGlzdGluZ0luZm8gPSB0aGlzLl9rZXJuZWxTb3VyY2VzLmdldChpZCk7XG5cblx0XHRpZiAoZXhpc3RpbmdJbmZvKSB7XG5cdFx0XHRyZXR1cm4gZXhpc3RpbmdJbmZvLmFjdGlvbnMubWFwKGEgPT4gYVswXSk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc291cmNlTWVudSA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuX21lbnVTZXJ2aWNlLmNyZWF0ZU1lbnUoTWVudUlkLk5vdGVib29rS2VybmVsU291cmNlLCBjb250ZXh0S2V5U2VydmljZSkpO1xuXHRcdGNvbnN0IGluZm86IElLZXJuZWxJbmZvQ2FjaGUgPSB7IG1lbnU6IHNvdXJjZU1lbnUsIGFjdGlvbnM6IFtdIH07XG5cblx0XHRjb25zdCBsb2FkQWN0aW9uc0Zyb21NZW51ID0gKG1lbnU6IElNZW51LCBkb2N1bWVudDogSU5vdGVib29rVGV4dE1vZGVsTGlrZSkgPT4ge1xuXHRcdFx0Y29uc3QgZ3JvdXBzID0gbWVudS5nZXRBY3Rpb25zKHsgc2hvdWxkRm9yd2FyZEFyZ3M6IHRydWUgfSk7XG5cdFx0XHRjb25zdCBzb3VyY2VBY3Rpb25zOiBbSVNvdXJjZUFjdGlvbiwgSURpc3Bvc2FibGVdW10gPSBbXTtcblx0XHRcdGdyb3Vwcy5mb3JFYWNoKGdyb3VwID0+IHtcblx0XHRcdFx0Y29uc3QgaXNQcmltYXJ5ID0gL15wcmltYXJ5Ly50ZXN0KGdyb3VwWzBdKTtcblx0XHRcdFx0Z3JvdXBbMV0uZm9yRWFjaChhY3Rpb24gPT4ge1xuXHRcdFx0XHRcdGNvbnN0IHNvdXJjZUFjdGlvbiA9IG5ldyBTb3VyY2VBY3Rpb24oYWN0aW9uLCBkb2N1bWVudCwgaXNQcmltYXJ5KTtcblx0XHRcdFx0XHRjb25zdCBzdGF0ZUNoYW5nZUxpc3RlbmVyID0gc291cmNlQWN0aW9uLm9uRGlkQ2hhbmdlU3RhdGUoKCkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VTb3VyY2VBY3Rpb25zLmZpcmUoe1xuXHRcdFx0XHRcdFx0XHRub3RlYm9vazogZG9jdW1lbnQudXJpLFxuXHRcdFx0XHRcdFx0XHR2aWV3VHlwZTogZG9jdW1lbnQubm90ZWJvb2tUeXBlLFxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0c291cmNlQWN0aW9ucy5wdXNoKFtzb3VyY2VBY3Rpb24sIHN0YXRlQ2hhbmdlTGlzdGVuZXJdKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHRcdGluZm8uYWN0aW9ucyA9IHNvdXJjZUFjdGlvbnM7XG5cdFx0XHR0aGlzLl9rZXJuZWxTb3VyY2VzLnNldChpZCwgaW5mbyk7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVNvdXJjZUFjdGlvbnMuZmlyZSh7IG5vdGVib29rOiBkb2N1bWVudC51cmksIHZpZXdUeXBlOiBkb2N1bWVudC5ub3RlYm9va1R5cGUgfSk7XG5cdFx0fTtcblxuXHRcdHRoaXMuX2tlcm5lbFNvdXJjZUFjdGlvbnNVcGRhdGVzLmdldChpZCk/LmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9rZXJuZWxTb3VyY2VBY3Rpb25zVXBkYXRlcy5zZXQoaWQsIHNvdXJjZU1lbnUub25EaWRDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0bG9hZEFjdGlvbnNGcm9tTWVudShzb3VyY2VNZW51LCBub3RlYm9vayk7XG5cdFx0fSkpO1xuXG5cdFx0bG9hZEFjdGlvbnNGcm9tTWVudShzb3VyY2VNZW51LCBub3RlYm9vayk7XG5cblx0XHRyZXR1cm4gaW5mby5hY3Rpb25zLm1hcChhID0+IGFbMF0pO1xuXHR9XG5cblx0cmVnaXN0ZXJOb3RlYm9va0tlcm5lbERldGVjdGlvblRhc2sodGFzazogSU5vdGVib29rS2VybmVsRGV0ZWN0aW9uVGFzayk6IElEaXNwb3NhYmxlIHtcblx0XHRjb25zdCBub3RlYm9va1R5cGUgPSB0YXNrLm5vdGVib29rVHlwZTtcblx0XHRjb25zdCBhbGwgPSB0aGlzLl9rZXJuZWxEZXRlY3Rpb25UYXNrcy5nZXQobm90ZWJvb2tUeXBlKSA/PyBbXTtcblx0XHRhbGwucHVzaCh0YXNrKTtcblx0XHR0aGlzLl9rZXJuZWxEZXRlY3Rpb25UYXNrcy5zZXQobm90ZWJvb2tUeXBlLCBhbGwpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlS2VybmVsRGV0ZWN0aW9uVGFza3MuZmlyZShub3RlYm9va1R5cGUpO1xuXHRcdHJldHVybiB0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0Y29uc3QgYWxsID0gdGhpcy5fa2VybmVsRGV0ZWN0aW9uVGFza3MuZ2V0KG5vdGVib29rVHlwZSkgPz8gW107XG5cdFx0XHRjb25zdCBpZHggPSBhbGwuaW5kZXhPZih0YXNrKTtcblx0XHRcdGlmIChpZHggPj0gMCkge1xuXHRcdFx0XHRhbGwuc3BsaWNlKGlkeCwgMSk7XG5cdFx0XHRcdHRoaXMuX2tlcm5lbERldGVjdGlvblRhc2tzLnNldChub3RlYm9va1R5cGUsIGFsbCk7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlS2VybmVsRGV0ZWN0aW9uVGFza3MuZmlyZShub3RlYm9va1R5cGUpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0Z2V0S2VybmVsRGV0ZWN0aW9uVGFza3Mobm90ZWJvb2s6IElOb3RlYm9va1RleHRNb2RlbExpa2UpOiBJTm90ZWJvb2tLZXJuZWxEZXRlY3Rpb25UYXNrW10ge1xuXHRcdHJldHVybiB0aGlzLl9rZXJuZWxEZXRlY3Rpb25UYXNrcy5nZXQobm90ZWJvb2subm90ZWJvb2tUeXBlKSA/PyBbXTtcblx0fVxuXG5cdHJlZ2lzdGVyS2VybmVsU291cmNlQWN0aW9uUHJvdmlkZXIodmlld1R5cGU6IHN0cmluZywgcHJvdmlkZXI6IElLZXJuZWxTb3VyY2VBY3Rpb25Qcm92aWRlcik6IElEaXNwb3NhYmxlIHtcblx0XHRjb25zdCBwcm92aWRlcnMgPSB0aGlzLl9rZXJuZWxTb3VyY2VBY3Rpb25Qcm92aWRlcnMuZ2V0KHZpZXdUeXBlKSA/PyBbXTtcblx0XHRwcm92aWRlcnMucHVzaChwcm92aWRlcik7XG5cdFx0dGhpcy5fa2VybmVsU291cmNlQWN0aW9uUHJvdmlkZXJzLnNldCh2aWV3VHlwZSwgcHJvdmlkZXJzKTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZVNvdXJjZUFjdGlvbnMuZmlyZSh7IHZpZXdUeXBlOiB2aWV3VHlwZSB9KTtcblxuXHRcdGNvbnN0IGV2ZW50RW1pdHRlckRpc3Bvc2FibGUgPSBwcm92aWRlci5vbkRpZENoYW5nZVNvdXJjZUFjdGlvbnM/LigoKSA9PiB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVNvdXJjZUFjdGlvbnMuZmlyZSh7IHZpZXdUeXBlOiB2aWV3VHlwZSB9KTtcblx0XHR9KTtcblxuXHRcdHJldHVybiB0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0Y29uc3QgcHJvdmlkZXJzID0gdGhpcy5fa2VybmVsU291cmNlQWN0aW9uUHJvdmlkZXJzLmdldCh2aWV3VHlwZSkgPz8gW107XG5cdFx0XHRjb25zdCBpZHggPSBwcm92aWRlcnMuaW5kZXhPZihwcm92aWRlcik7XG5cdFx0XHRpZiAoaWR4ID49IDApIHtcblx0XHRcdFx0cHJvdmlkZXJzLnNwbGljZShpZHgsIDEpO1xuXHRcdFx0XHR0aGlzLl9rZXJuZWxTb3VyY2VBY3Rpb25Qcm92aWRlcnMuc2V0KHZpZXdUeXBlLCBwcm92aWRlcnMpO1xuXHRcdFx0fVxuXG5cdFx0XHRldmVudEVtaXR0ZXJEaXNwb3NhYmxlPy5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdH1cblxuXHQvKipcblx0ICogR2V0IGtlcm5lbCBzb3VyY2UgYWN0aW9ucyBmcm9tIHByb3ZpZGVyc1xuXHQgKi9cblx0Z2V0S2VybmVsU291cmNlQWN0aW9uczIobm90ZWJvb2s6IElOb3RlYm9va1RleHRNb2RlbExpa2UpOiBQcm9taXNlPElOb3RlYm9va0tlcm5lbFNvdXJjZUFjdGlvbltdPiB7XG5cdFx0Y29uc3Qgdmlld1R5cGUgPSBub3RlYm9vay5ub3RlYm9va1R5cGU7XG5cdFx0Y29uc3QgcHJvdmlkZXJzID0gdGhpcy5fa2VybmVsU291cmNlQWN0aW9uUHJvdmlkZXJzLmdldCh2aWV3VHlwZSkgPz8gW107XG5cdFx0Y29uc3QgcHJvbWlzZXMgPSBwcm92aWRlcnMubWFwKHByb3ZpZGVyID0+IHByb3ZpZGVyLnByb3ZpZGVLZXJuZWxTb3VyY2VBY3Rpb25zKCkpO1xuXHRcdHJldHVybiBQcm9taXNlLmFsbChwcm9taXNlcykudGhlbihhY3Rpb25zID0+IHtcblx0XHRcdHJldHVybiBhY3Rpb25zLnJlZHVjZSgoYSwgYikgPT4gYS5jb25jYXQoYiksIFtdKTtcblx0XHR9KTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFnQixlQUFlO0FBQy9CLFNBQVMsWUFBeUIsb0JBQW9CO0FBR3RELFNBQVMsVUFBVSxtQkFBbUI7QUFDdEMsU0FBUyxpQkFBaUIsY0FBYyxxQkFBcUI7QUFDN0QsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQWdCLGNBQWMsY0FBYztBQUM1QyxTQUFTLDBCQUEwQjtBQUVuQyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxpQkFBaUIseUJBQXlCO0FBRW5ELE1BQU0sY0FBTixNQUFNLFlBQVc7QUFBQSxFQVVoQixZQUFZLFFBQXlCO0FBRnJDLFNBQVMscUJBQXFCLElBQUksWUFBb0I7QUFHckQsU0FBSyxTQUFTO0FBQ2QsU0FBSyxRQUFRO0FBQ2IsU0FBSyxPQUFPLFlBQVc7QUFBQSxFQUN4QjtBQUNEO0FBZk0sWUFFVSxjQUFjO0FBRjlCLElBQU0sYUFBTjtBQWlCQSxNQUFNLHdCQUF3QjtBQUFBLEVBQzdCLE9BQU8sSUFBSSxHQUFtQztBQUM3QyxXQUFPLEdBQUcsRUFBRSxZQUFZLElBQUksRUFBRSxJQUFJLFNBQVMsQ0FBQztBQUFBLEVBQzdDO0FBQUEsRUFD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SUFBRztBQUNoRCxhQUFLLGlDQUFpQyxLQUFLLFlBQVk7QUFBQSxNQUN4RDtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLHdCQUF3QixVQUFrRTtBQUN6RixXQUFPLEtBQUssc0JBQXNCLElBQUksU0FBUyxZQUFZLEtBQUssQ0FBQztBQUFBLEVBQ2xFO0FBQUEsRUFFQSxtQ0FBbUMsVUFBa0IsVUFBb0Q7QUFDeEcsVUFBTSxZQUFZLEtBQUssNkJBQTZCLElBQUksUUFBUSxLQUFLLENBQUM7QUFDdEUsY0FBVSxLQUFLLFFBQVE7QUFDdkIsU0FBSyw2QkFBNkIsSUFBSSxVQUFVLFNBQVM7QUFDekQsU0FBSywwQkFBMEIsS0FBSyxFQUFFLFNBQW1CLENBQUM7QUFFMUQsVUFBTSx5QkFBeUIsU0FBUywyQkFBMkIsTUFBTTtBQUN4RSxXQUFLLDBCQUEwQixLQUFLLEVBQUUsU0FBbUIsQ0FBQztBQUFBLElBQzNELENBQUM7QUFFRCxXQUFPLGFBQWEsTUFBTTtBQUN6QixZQUFNQyxhQUFZLEtBQUssNkJBQTZCLElBQUksUUFBUSxLQUFLLENBQUM7QUFDdEUsWUFBTSxNQUFNQSxXQUFVLFFBQVEsUUFBUTtBQUN0QyxVQUFJLE9BQU8sR0FBRztBQUNiLFFBQUFBLFdBQVUsT0FBTyxLQUFLLENBQUM7QUFDdkIsYUFBSyw2QkFBNkIsSUFBSSxVQUFVQSxVQUFTO0FBQUEsTUFDMUQ7QUFFQSw4QkFBd0IsUUFBUTtBQUFBLElBQ2pDLENBQUM7QUFBQSxFQUNGO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLQSx3QkFBd0IsVUFBMEU7QUFDakcsVUFBTSxXQUFXLFNBQVM7QUFDMUIsVUFBTSxZQUFZLEtBQUssNkJBQTZCLElBQUksUUFBUSxLQUFLLENBQUM7QUFDdEUsVUFBTSxXQUFXLFVBQVUsSUFBSSxjQUFZLFNBQVMsMkJBQTJCLENBQUM7QUFDaEYsV0FBTyxRQUFRLElBQUksUUFBUSxFQUFFLEtBQUssYUFBVztBQUM1QyxhQUFPLFFBQVEsT0FBTyxDQUFDLEdBQUcsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUFBLElBQ2hELENBQUM7QUFBQSxFQUNGO0FBQ0Q7QUF0VWEsc0JBNEJHLDBCQUEwQjtBQTVCN0Isd0JBQU47QUFBQSxFQWdDSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBbkNVOyIsCiAgIm5hbWVzIjogWyJhbGwiLCAicHJvdmlkZXJzIl0KfQo=
