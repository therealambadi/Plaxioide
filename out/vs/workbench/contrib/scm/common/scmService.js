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
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { Emitter } from "../../../../base/common/event.js";
import { SCMInputChangeReason } from "./scm.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { HistoryNavigator2 } from "../../../../base/common/history.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { URI } from "../../../../base/common/uri.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { Schemas } from "../../../../base/common/network.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { runOnChange } from "../../../../base/common/observable.js";
class SCMInput extends Disposable {
  constructor(repository, history) {
    super();
    this.repository = repository;
    this.history = history;
    this._value = "";
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
    this._placeholder = "";
    this._onDidChangePlaceholder = new Emitter();
    this.onDidChangePlaceholder = this._onDidChangePlaceholder.event;
    this._enabled = true;
    this._onDidChangeEnablement = new Emitter();
    this.onDidChangeEnablement = this._onDidChangeEnablement.event;
    this._visible = true;
    this._onDidChangeVisibility = new Emitter();
    this.onDidChangeVisibility = this._onDidChangeVisibility.event;
    this._onDidChangeFocus = new Emitter();
    this.onDidChangeFocus = this._onDidChangeFocus.event;
    this._onDidChangeValidationMessage = new Emitter();
    this.onDidChangeValidationMessage = this._onDidChangeValidationMessage.event;
    this._validateInput = () => Promise.resolve(void 0);
    this._onDidChangeValidateInput = new Emitter();
    this.onDidChangeValidateInput = this._onDidChangeValidateInput.event;
    this.didChangeHistory = false;
    if (this.repository.provider.rootUri) {
      this.historyNavigator = history.getHistory(this.repository.provider.label, this.repository.provider.rootUri);
      this._register(this.history.onWillSaveHistory((event) => {
        if (this.historyNavigator.isAtEnd()) {
          this.saveValue();
        }
        if (this.didChangeHistory) {
          event.historyDidIndeedChange();
        }
        this.didChangeHistory = false;
      }));
    } else {
      this.historyNavigator = new HistoryNavigator2([""], 100);
    }
    this._value = this.historyNavigator.current();
  }
  get value() {
    return this._value;
  }
  get placeholder() {
    return this._placeholder;
  }
  set placeholder(placeholder) {
    this._placeholder = placeholder;
    this._onDidChangePlaceholder.fire(placeholder);
  }
  get enabled() {
    return this._enabled;
  }
  set enabled(enabled) {
    this._enabled = enabled;
    this._onDidChangeEnablement.fire(enabled);
  }
  get visible() {
    return this._visible;
  }
  set visible(visible) {
    this._visible = visible;
    this._onDidChangeVisibility.fire(visible);
  }
  setFocus() {
    this._onDidChangeFocus.fire();
  }
  showValidationMessage(message, type) {
    this._onDidChangeValidationMessage.fire({ message, type });
  }
  get validateInput() {
    return this._validateInput;
  }
  set validateInput(validateInput) {
    this._validateInput = validateInput;
    this._onDidChangeValidateInput.fire();
  }
  setValue(value, transient, reason) {
    if (value === this._value) {
      return;
    }
    if (!transient) {
      this.historyNavigator.replaceLast(this._value);
      this.historyNavigator.add(value);
      this.didChangeHistory = true;
    }
    this._value = value;
    this._onDidChange.fire({ value, reason });
  }
  showNextHistoryValue() {
    if (this.historyNavigator.isAtEnd()) {
      return;
    } else if (!this.historyNavigator.has(this.value)) {
      this.saveValue();
      this.historyNavigator.resetCursor();
    }
    const value = this.historyNavigator.next();
    this.setValue(value, true, SCMInputChangeReason.HistoryNext);
  }
  showPreviousHistoryValue() {
    if (this.historyNavigator.isAtEnd()) {
      this.saveValue();
    } else if (!this.historyNavigator.has(this._value)) {
      this.saveValue();
      this.historyNavigator.resetCursor();
    }
    const value = this.historyNavigator.previous();
    this.setValue(value, true, SCMInputChangeReason.HistoryPrevious);
  }
  saveValue() {
    const oldValue = this.historyNavigator.replaceLast(this._value);
    this.didChangeHistory = this.didChangeHistory || oldValue !== this._value;
  }
}
class SCMRepository {
  constructor(id, provider, disposables, inputHistory) {
    this.id = id;
    this.provider = provider;
    this.disposables = disposables;
    this._selected = false;
    this._onDidChangeSelection = new Emitter();
    this.onDidChangeSelection = this._onDidChangeSelection.event;
    this.input = new SCMInput(this, inputHistory);
  }
  get selected() {
    return this._selected;
  }
  setSelected(selected) {
    if (this._selected === selected) {
      return;
    }
    this._selected = selected;
    this._onDidChangeSelection.fire(selected);
  }
  dispose() {
    this.disposables.dispose();
    this.provider.dispose();
  }
}
class WillSaveHistoryEvent {
  constructor() {
    this._didChangeHistory = false;
  }
  get didChangeHistory() {
    return this._didChangeHistory;
  }
  historyDidIndeedChange() {
    this._didChangeHistory = true;
  }
}
let SCMInputHistory = class {
  constructor(storageService, workspaceContextService) {
    this.storageService = storageService;
    this.workspaceContextService = workspaceContextService;
    this.disposables = new DisposableStore();
    this.histories = /* @__PURE__ */ new Map();
    this._onWillSaveHistory = this.disposables.add(new Emitter());
    this.onWillSaveHistory = this._onWillSaveHistory.event;
    this.histories = /* @__PURE__ */ new Map();
    const entries = this.storageService.getObject("scm.history", StorageScope.WORKSPACE, []);
    for (const [providerLabel, rootUri, history] of entries) {
      let providerHistories = this.histories.get(providerLabel);
      if (!providerHistories) {
        providerHistories = new ResourceMap();
        this.histories.set(providerLabel, providerHistories);
      }
      providerHistories.set(rootUri, new HistoryNavigator2(history, 100));
    }
    if (this.migrateStorage()) {
      this.saveToStorage();
    }
    this.disposables.add(this.storageService.onDidChangeValue(StorageScope.WORKSPACE, "scm.history", this.disposables)((e) => {
      if (e.external && e.key === "scm.history") {
        const raw = this.storageService.getObject("scm.history", StorageScope.WORKSPACE, []);
        for (const [providerLabel, uri, rawHistory] of raw) {
          const history = this.getHistory(providerLabel, uri);
          for (const value of Iterable.reverse(rawHistory)) {
            history.prepend(value);
          }
        }
      }
    }));
    this.disposables.add(this.storageService.onWillSaveState((_) => {
      const event = new WillSaveHistoryEvent();
      this._onWillSaveHistory.fire(event);
      if (event.didChangeHistory) {
        this.saveToStorage();
      }
    }));
  }
  saveToStorage() {
    const raw = [];
    for (const [providerLabel, providerHistories] of this.histories) {
      for (const [rootUri, history] of providerHistories) {
        if (!(history.size === 1 && history.current() === "")) {
          raw.push([providerLabel, rootUri, [...history]]);
        }
      }
    }
    this.storageService.store("scm.history", raw, StorageScope.WORKSPACE, StorageTarget.USER);
  }
  getHistory(providerLabel, rootUri) {
    let providerHistories = this.histories.get(providerLabel);
    if (!providerHistories) {
      providerHistories = new ResourceMap();
      this.histories.set(providerLabel, providerHistories);
    }
    let history = providerHistories.get(rootUri);
    if (!history) {
      history = new HistoryNavigator2([""], 100);
      providerHistories.set(rootUri, history);
    }
    return history;
  }
  // Migrates from Application scope storage to Workspace scope.
  // TODO@joaomoreno: Change from January 2024 onwards such that the only code is to remove all `scm/input:` storage keys
  migrateStorage() {
    let didSomethingChange = false;
    const machineKeys = Iterable.filter(this.storageService.keys(StorageScope.APPLICATION, StorageTarget.MACHINE), (key) => key.startsWith("scm/input:"));
    for (const key of machineKeys) {
      try {
        const legacyHistory = JSON.parse(this.storageService.get(key, StorageScope.APPLICATION, ""));
        const match = /^scm\/input:([^:]+):(.+)$/.exec(key);
        if (!match || !Array.isArray(legacyHistory?.history) || !Number.isInteger(legacyHistory?.timestamp)) {
          this.storageService.remove(key, StorageScope.APPLICATION);
          continue;
        }
        const [, providerLabel, rootPath] = match;
        const rootUri = URI.file(rootPath);
        if (this.workspaceContextService.getWorkspaceFolder(rootUri)) {
          const history = this.getHistory(providerLabel, rootUri);
          for (const entry of Iterable.reverse(legacyHistory.history)) {
            history.prepend(entry);
          }
          didSomethingChange = true;
          this.storageService.remove(key, StorageScope.APPLICATION);
        }
      } catch {
        this.storageService.remove(key, StorageScope.APPLICATION);
      }
    }
    return didSomethingChange;
  }
  dispose() {
    this.disposables.dispose();
  }
};
SCMInputHistory = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, IWorkspaceContextService)
], SCMInputHistory);
let SCMService = class {
  constructor(logService, workspaceContextService, contextKeyService, storageService, uriIdentityService) {
    this.logService = logService;
    this.uriIdentityService = uriIdentityService;
    this._repositories = /* @__PURE__ */ new Map();
    this._onDidAddProvider = new Emitter();
    this.onDidAddRepository = this._onDidAddProvider.event;
    this._onDidRemoveProvider = new Emitter();
    this.onDidRemoveRepository = this._onDidRemoveProvider.event;
    this.inputHistory = new SCMInputHistory(storageService, workspaceContextService);
    this.providerCount = contextKeyService.createKey("scm.providerCount", 0);
    this.historyProviderCount = contextKeyService.createKey("scm.historyProviderCount", 0);
  }
  // used in tests
  get repositories() {
    return this._repositories.values();
  }
  get repositoryCount() {
    return this._repositories.size;
  }
  registerSCMProvider(provider) {
    this.logService.trace("SCMService#registerSCMProvider");
    if (this._repositories.has(provider.id)) {
      throw new Error(`SCM Provider ${provider.id} already exists.`);
    }
    const disposables = new DisposableStore();
    const historyProviderCount = () => {
      return Array.from(this._repositories.values()).filter((r) => !!r.provider.historyProvider.get()).length;
    };
    disposables.add(toDisposable(() => {
      this._repositories.delete(provider.id);
      this._onDidRemoveProvider.fire(repository);
      this.providerCount.set(this._repositories.size);
      this.historyProviderCount.set(historyProviderCount());
    }));
    const repository = new SCMRepository(provider.id, provider, disposables, this.inputHistory);
    this._repositories.set(provider.id, repository);
    disposables.add(runOnChange(provider.historyProvider, () => {
      this.historyProviderCount.set(historyProviderCount());
    }));
    this.providerCount.set(this._repositories.size);
    this.historyProviderCount.set(historyProviderCount());
    this._onDidAddProvider.fire(repository);
    return repository;
  }
  getRepository(idOrResource) {
    if (typeof idOrResource === "string") {
      return this._repositories.get(idOrResource);
    }
    if (idOrResource.scheme !== Schemas.file && idOrResource.scheme !== Schemas.vscodeRemote) {
      return void 0;
    }
    let bestRepository = void 0;
    let bestMatchLength = Number.POSITIVE_INFINITY;
    for (const repository of this.repositories) {
      const root = repository.provider.rootUri;
      if (!root) {
        continue;
      }
      const path = this.uriIdentityService.extUri.relativePath(root, idOrResource);
      if (path && !/^\.\./.test(path) && path.length < bestMatchLength) {
        bestRepository = repository;
        bestMatchLength = path.length;
      }
    }
    return bestRepository;
  }
};
SCMService = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IUriIdentityService)
], SCMService);
export {
  SCMService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zY20vY29tbW9uL3NjbVNlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBFdmVudCwgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElTQ01TZXJ2aWNlLCBJU0NNUHJvdmlkZXIsIElTQ01JbnB1dCwgSVNDTVJlcG9zaXRvcnksIElJbnB1dFZhbGlkYXRvciwgSVNDTUlucHV0Q2hhbmdlRXZlbnQsIFNDTUlucHV0Q2hhbmdlUmVhc29uLCBJbnB1dFZhbGlkYXRpb25UeXBlLCBJSW5wdXRWYWxpZGF0aW9uIH0gZnJvbSAnLi9zY20uanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleSwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSGlzdG9yeU5hdmlnYXRvcjIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9oaXN0b3J5LmpzJztcbmltcG9ydCB7IElNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IFJlc291cmNlTWFwIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJdGVyYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2l0ZXJhdG9yLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgcnVuT25DaGFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcblxuY2xhc3MgU0NNSW5wdXQgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVNDTUlucHV0IHtcblxuXHRwcml2YXRlIF92YWx1ZSA9ICcnO1xuXG5cdGdldCB2YWx1ZSgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLl92YWx1ZTtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlID0gbmV3IEVtaXR0ZXI8SVNDTUlucHV0Q2hhbmdlRXZlbnQ+KCk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlOiBFdmVudDxJU0NNSW5wdXRDaGFuZ2VFdmVudD4gPSB0aGlzLl9vbkRpZENoYW5nZS5ldmVudDtcblxuXHRwcml2YXRlIF9wbGFjZWhvbGRlciA9ICcnO1xuXG5cdGdldCBwbGFjZWhvbGRlcigpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLl9wbGFjZWhvbGRlcjtcblx0fVxuXG5cdHNldCBwbGFjZWhvbGRlcihwbGFjZWhvbGRlcjogc3RyaW5nKSB7XG5cdFx0dGhpcy5fcGxhY2Vob2xkZXIgPSBwbGFjZWhvbGRlcjtcblx0XHR0aGlzLl9vbkRpZENoYW5nZVBsYWNlaG9sZGVyLmZpcmUocGxhY2Vob2xkZXIpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VQbGFjZWhvbGRlciA9IG5ldyBFbWl0dGVyPHN0cmluZz4oKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VQbGFjZWhvbGRlcjogRXZlbnQ8c3RyaW5nPiA9IHRoaXMuX29uRGlkQ2hhbmdlUGxhY2Vob2xkZXIuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfZW5hYmxlZCA9IHRydWU7XG5cblx0Z2V0IGVuYWJsZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2VuYWJsZWQ7XG5cdH1cblxuXHRzZXQgZW5hYmxlZChlbmFibGVkOiBib29sZWFuKSB7XG5cdFx0dGhpcy5fZW5hYmxlZCA9IGVuYWJsZWQ7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VFbmFibGVtZW50LmZpcmUoZW5hYmxlZCk7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUVuYWJsZW1lbnQgPSBuZXcgRW1pdHRlcjxib29sZWFuPigpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUVuYWJsZW1lbnQ6IEV2ZW50PGJvb2xlYW4+ID0gdGhpcy5fb25EaWRDaGFuZ2VFbmFibGVtZW50LmV2ZW50O1xuXG5cdHByaXZhdGUgX3Zpc2libGUgPSB0cnVlO1xuXG5cdGdldCB2aXNpYmxlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl92aXNpYmxlO1xuXHR9XG5cblx0c2V0IHZpc2libGUodmlzaWJsZTogYm9vbGVhbikge1xuXHRcdHRoaXMuX3Zpc2libGUgPSB2aXNpYmxlO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlVmlzaWJpbGl0eS5maXJlKHZpc2libGUpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VWaXNpYmlsaXR5ID0gbmV3IEVtaXR0ZXI8Ym9vbGVhbj4oKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VWaXNpYmlsaXR5OiBFdmVudDxib29sZWFuPiA9IHRoaXMuX29uRGlkQ2hhbmdlVmlzaWJpbGl0eS5ldmVudDtcblxuXHRzZXRGb2N1cygpOiB2b2lkIHtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUZvY3VzLmZpcmUoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlRm9jdXMgPSBuZXcgRW1pdHRlcjx2b2lkPigpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUZvY3VzOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkQ2hhbmdlRm9jdXMuZXZlbnQ7XG5cblx0c2hvd1ZhbGlkYXRpb25NZXNzYWdlKG1lc3NhZ2U6IHN0cmluZyB8IElNYXJrZG93blN0cmluZywgdHlwZTogSW5wdXRWYWxpZGF0aW9uVHlwZSk6IHZvaWQge1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlVmFsaWRhdGlvbk1lc3NhZ2UuZmlyZSh7IG1lc3NhZ2U6IG1lc3NhZ2UsIHR5cGU6IHR5cGUgfSk7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVZhbGlkYXRpb25NZXNzYWdlID0gbmV3IEVtaXR0ZXI8SUlucHV0VmFsaWRhdGlvbj4oKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VWYWxpZGF0aW9uTWVzc2FnZTogRXZlbnQ8SUlucHV0VmFsaWRhdGlvbj4gPSB0aGlzLl9vbkRpZENoYW5nZVZhbGlkYXRpb25NZXNzYWdlLmV2ZW50O1xuXG5cdHByaXZhdGUgX3ZhbGlkYXRlSW5wdXQ6IElJbnB1dFZhbGlkYXRvciA9ICgpID0+IFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuXG5cdGdldCB2YWxpZGF0ZUlucHV0KCk6IElJbnB1dFZhbGlkYXRvciB7XG5cdFx0cmV0dXJuIHRoaXMuX3ZhbGlkYXRlSW5wdXQ7XG5cdH1cblxuXHRzZXQgdmFsaWRhdGVJbnB1dCh2YWxpZGF0ZUlucHV0OiBJSW5wdXRWYWxpZGF0b3IpIHtcblx0XHR0aGlzLl92YWxpZGF0ZUlucHV0ID0gdmFsaWRhdGVJbnB1dDtcblx0XHR0aGlzLl9vbkRpZENoYW5nZVZhbGlkYXRlSW5wdXQuZmlyZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VWYWxpZGF0ZUlucHV0ID0gbmV3IEVtaXR0ZXI8dm9pZD4oKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VWYWxpZGF0ZUlucHV0OiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkQ2hhbmdlVmFsaWRhdGVJbnB1dC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGhpc3RvcnlOYXZpZ2F0b3I6IEhpc3RvcnlOYXZpZ2F0b3IyPHN0cmluZz47XG5cdHByaXZhdGUgZGlkQ2hhbmdlSGlzdG9yeTogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IHJlcG9zaXRvcnk6IElTQ01SZXBvc2l0b3J5LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgaGlzdG9yeTogU0NNSW5wdXRIaXN0b3J5XG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRpZiAodGhpcy5yZXBvc2l0b3J5LnByb3ZpZGVyLnJvb3RVcmkpIHtcblx0XHRcdHRoaXMuaGlzdG9yeU5hdmlnYXRvciA9IGhpc3RvcnkuZ2V0SGlzdG9yeSh0aGlzLnJlcG9zaXRvcnkucHJvdmlkZXIubGFiZWwsIHRoaXMucmVwb3NpdG9yeS5wcm92aWRlci5yb290VXJpKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuaGlzdG9yeS5vbldpbGxTYXZlSGlzdG9yeShldmVudCA9PiB7XG5cdFx0XHRcdGlmICh0aGlzLmhpc3RvcnlOYXZpZ2F0b3IuaXNBdEVuZCgpKSB7XG5cdFx0XHRcdFx0dGhpcy5zYXZlVmFsdWUoKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICh0aGlzLmRpZENoYW5nZUhpc3RvcnkpIHtcblx0XHRcdFx0XHRldmVudC5oaXN0b3J5RGlkSW5kZWVkQ2hhbmdlKCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLmRpZENoYW5nZUhpc3RvcnkgPSBmYWxzZTtcblx0XHRcdH0pKTtcblx0XHR9IGVsc2UgeyAvLyBpbiBtZW1vcnkgb25seVxuXHRcdFx0dGhpcy5oaXN0b3J5TmF2aWdhdG9yID0gbmV3IEhpc3RvcnlOYXZpZ2F0b3IyKFsnJ10sIDEwMCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fdmFsdWUgPSB0aGlzLmhpc3RvcnlOYXZpZ2F0b3IuY3VycmVudCgpO1xuXHR9XG5cblx0c2V0VmFsdWUodmFsdWU6IHN0cmluZywgdHJhbnNpZW50OiBib29sZWFuLCByZWFzb24/OiBTQ01JbnB1dENoYW5nZVJlYXNvbikge1xuXHRcdGlmICh2YWx1ZSA9PT0gdGhpcy5fdmFsdWUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIXRyYW5zaWVudCkge1xuXHRcdFx0dGhpcy5oaXN0b3J5TmF2aWdhdG9yLnJlcGxhY2VMYXN0KHRoaXMuX3ZhbHVlKTtcblx0XHRcdHRoaXMuaGlzdG9yeU5hdmlnYXRvci5hZGQodmFsdWUpO1xuXHRcdFx0dGhpcy5kaWRDaGFuZ2VIaXN0b3J5ID0gdHJ1ZTtcblx0XHR9XG5cblx0XHR0aGlzLl92YWx1ZSA9IHZhbHVlO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoeyB2YWx1ZSwgcmVhc29uIH0pO1xuXHR9XG5cblx0c2hvd05leHRIaXN0b3J5VmFsdWUoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuaGlzdG9yeU5hdmlnYXRvci5pc0F0RW5kKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9IGVsc2UgaWYgKCF0aGlzLmhpc3RvcnlOYXZpZ2F0b3IuaGFzKHRoaXMudmFsdWUpKSB7XG5cdFx0XHR0aGlzLnNhdmVWYWx1ZSgpO1xuXHRcdFx0dGhpcy5oaXN0b3J5TmF2aWdhdG9yLnJlc2V0Q3Vyc29yKCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdmFsdWUgPSB0aGlzLmhpc3RvcnlOYXZpZ2F0b3IubmV4dCgpO1xuXHRcdHRoaXMuc2V0VmFsdWUodmFsdWUsIHRydWUsIFNDTUlucHV0Q2hhbmdlUmVhc29uLkhpc3RvcnlOZXh0KTtcblx0fVxuXG5cdHNob3dQcmV2aW91c0hpc3RvcnlWYWx1ZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5oaXN0b3J5TmF2aWdhdG9yLmlzQXRFbmQoKSkge1xuXHRcdFx0dGhpcy5zYXZlVmFsdWUoKTtcblx0XHR9IGVsc2UgaWYgKCF0aGlzLmhpc3RvcnlOYXZpZ2F0b3IuaGFzKHRoaXMuX3ZhbHVlKSkge1xuXHRcdFx0dGhpcy5zYXZlVmFsdWUoKTtcblx0XHRcdHRoaXMuaGlzdG9yeU5hdmlnYXRvci5yZXNldEN1cnNvcigpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHZhbHVlID0gdGhpcy5oaXN0b3J5TmF2aWdhdG9yLnByZXZpb3VzKCk7XG5cdFx0dGhpcy5zZXRWYWx1ZSh2YWx1ZSwgdHJ1ZSwgU0NNSW5wdXRDaGFuZ2VSZWFzb24uSGlzdG9yeVByZXZpb3VzKTtcblx0fVxuXG5cdHByaXZhdGUgc2F2ZVZhbHVlKCk6IHZvaWQge1xuXHRcdGNvbnN0IG9sZFZhbHVlID0gdGhpcy5oaXN0b3J5TmF2aWdhdG9yLnJlcGxhY2VMYXN0KHRoaXMuX3ZhbHVlKTtcblx0XHR0aGlzLmRpZENoYW5nZUhpc3RvcnkgPSB0aGlzLmRpZENoYW5nZUhpc3RvcnkgfHwgKG9sZFZhbHVlICE9PSB0aGlzLl92YWx1ZSk7XG5cdH1cbn1cblxuY2xhc3MgU0NNUmVwb3NpdG9yeSBpbXBsZW1lbnRzIElTQ01SZXBvc2l0b3J5IHtcblxuXHRwcml2YXRlIF9zZWxlY3RlZCA9IGZhbHNlO1xuXHRnZXQgc2VsZWN0ZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3NlbGVjdGVkO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VTZWxlY3Rpb24gPSBuZXcgRW1pdHRlcjxib29sZWFuPigpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVNlbGVjdGlvbjogRXZlbnQ8Ym9vbGVhbj4gPSB0aGlzLl9vbkRpZENoYW5nZVNlbGVjdGlvbi5ldmVudDtcblxuXHRyZWFkb25seSBpbnB1dDogSVNDTUlucHV0O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSBpZDogc3RyaW5nLFxuXHRcdHB1YmxpYyByZWFkb25seSBwcm92aWRlcjogSVNDTVByb3ZpZGVyLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSxcblx0XHRpbnB1dEhpc3Rvcnk6IFNDTUlucHV0SGlzdG9yeVxuXHQpIHtcblx0XHR0aGlzLmlucHV0ID0gbmV3IFNDTUlucHV0KHRoaXMsIGlucHV0SGlzdG9yeSk7XG5cdH1cblxuXHRzZXRTZWxlY3RlZChzZWxlY3RlZDogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9zZWxlY3RlZCA9PT0gc2VsZWN0ZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9zZWxlY3RlZCA9IHNlbGVjdGVkO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlU2VsZWN0aW9uLmZpcmUoc2VsZWN0ZWQpO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHR0aGlzLnByb3ZpZGVyLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5jbGFzcyBXaWxsU2F2ZUhpc3RvcnlFdmVudCB7XG5cdHByaXZhdGUgX2RpZENoYW5nZUhpc3RvcnkgPSBmYWxzZTtcblx0Z2V0IGRpZENoYW5nZUhpc3RvcnkoKSB7IHJldHVybiB0aGlzLl9kaWRDaGFuZ2VIaXN0b3J5OyB9XG5cdGhpc3RvcnlEaWRJbmRlZWRDaGFuZ2UoKSB7IHRoaXMuX2RpZENoYW5nZUhpc3RvcnkgPSB0cnVlOyB9XG59XG5cbmNsYXNzIFNDTUlucHV0SGlzdG9yeSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0cHJpdmF0ZSByZWFkb25seSBoaXN0b3JpZXMgPSBuZXcgTWFwPHN0cmluZywgUmVzb3VyY2VNYXA8SGlzdG9yeU5hdmlnYXRvcjI8c3RyaW5nPj4+KCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25XaWxsU2F2ZUhpc3RvcnkgPSB0aGlzLmRpc3Bvc2FibGVzLmFkZChuZXcgRW1pdHRlcjxXaWxsU2F2ZUhpc3RvcnlFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uV2lsbFNhdmVIaXN0b3J5ID0gdGhpcy5fb25XaWxsU2F2ZUhpc3RvcnkuZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdCkge1xuXHRcdHRoaXMuaGlzdG9yaWVzID0gbmV3IE1hcCgpO1xuXG5cdFx0Y29uc3QgZW50cmllcyA9IHRoaXMuc3RvcmFnZVNlcnZpY2UuZ2V0T2JqZWN0PFtzdHJpbmcsIFVSSSwgc3RyaW5nW11dW10+KCdzY20uaGlzdG9yeScsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFtdKTtcblxuXHRcdGZvciAoY29uc3QgW3Byb3ZpZGVyTGFiZWwsIHJvb3RVcmksIGhpc3RvcnldIG9mIGVudHJpZXMpIHtcblx0XHRcdGxldCBwcm92aWRlckhpc3RvcmllcyA9IHRoaXMuaGlzdG9yaWVzLmdldChwcm92aWRlckxhYmVsKTtcblxuXHRcdFx0aWYgKCFwcm92aWRlckhpc3Rvcmllcykge1xuXHRcdFx0XHRwcm92aWRlckhpc3RvcmllcyA9IG5ldyBSZXNvdXJjZU1hcCgpO1xuXHRcdFx0XHR0aGlzLmhpc3Rvcmllcy5zZXQocHJvdmlkZXJMYWJlbCwgcHJvdmlkZXJIaXN0b3JpZXMpO1xuXHRcdFx0fVxuXG5cdFx0XHRwcm92aWRlckhpc3Rvcmllcy5zZXQocm9vdFVyaSwgbmV3IEhpc3RvcnlOYXZpZ2F0b3IyKGhpc3RvcnksIDEwMCkpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLm1pZ3JhdGVTdG9yYWdlKCkpIHtcblx0XHRcdHRoaXMuc2F2ZVRvU3RvcmFnZSgpO1xuXHRcdH1cblxuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMuc3RvcmFnZVNlcnZpY2Uub25EaWRDaGFuZ2VWYWx1ZShTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCAnc2NtLmhpc3RvcnknLCB0aGlzLmRpc3Bvc2FibGVzKShlID0+IHtcblx0XHRcdGlmIChlLmV4dGVybmFsICYmIGUua2V5ID09PSAnc2NtLmhpc3RvcnknKSB7XG5cdFx0XHRcdGNvbnN0IHJhdyA9IHRoaXMuc3RvcmFnZVNlcnZpY2UuZ2V0T2JqZWN0PFtzdHJpbmcsIFVSSSwgc3RyaW5nW11dW10+KCdzY20uaGlzdG9yeScsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFtdKTtcblxuXHRcdFx0XHRmb3IgKGNvbnN0IFtwcm92aWRlckxhYmVsLCB1cmksIHJhd0hpc3RvcnldIG9mIHJhdykge1xuXHRcdFx0XHRcdGNvbnN0IGhpc3RvcnkgPSB0aGlzLmdldEhpc3RvcnkocHJvdmlkZXJMYWJlbCwgdXJpKTtcblxuXHRcdFx0XHRcdGZvciAoY29uc3QgdmFsdWUgb2YgSXRlcmFibGUucmV2ZXJzZShyYXdIaXN0b3J5KSkge1xuXHRcdFx0XHRcdFx0aGlzdG9yeS5wcmVwZW5kKHZhbHVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZCh0aGlzLnN0b3JhZ2VTZXJ2aWNlLm9uV2lsbFNhdmVTdGF0ZShfID0+IHtcblx0XHRcdGNvbnN0IGV2ZW50ID0gbmV3IFdpbGxTYXZlSGlzdG9yeUV2ZW50KCk7XG5cdFx0XHR0aGlzLl9vbldpbGxTYXZlSGlzdG9yeS5maXJlKGV2ZW50KTtcblxuXHRcdFx0aWYgKGV2ZW50LmRpZENoYW5nZUhpc3RvcnkpIHtcblx0XHRcdFx0dGhpcy5zYXZlVG9TdG9yYWdlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBzYXZlVG9TdG9yYWdlKCk6IHZvaWQge1xuXHRcdGNvbnN0IHJhdzogW3N0cmluZywgVVJJLCBzdHJpbmdbXV1bXSA9IFtdO1xuXG5cdFx0Zm9yIChjb25zdCBbcHJvdmlkZXJMYWJlbCwgcHJvdmlkZXJIaXN0b3JpZXNdIG9mIHRoaXMuaGlzdG9yaWVzKSB7XG5cdFx0XHRmb3IgKGNvbnN0IFtyb290VXJpLCBoaXN0b3J5XSBvZiBwcm92aWRlckhpc3Rvcmllcykge1xuXHRcdFx0XHRpZiAoIShoaXN0b3J5LnNpemUgPT09IDEgJiYgaGlzdG9yeS5jdXJyZW50KCkgPT09ICcnKSkge1xuXHRcdFx0XHRcdHJhdy5wdXNoKFtwcm92aWRlckxhYmVsLCByb290VXJpLCBbLi4uaGlzdG9yeV1dKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoJ3NjbS5oaXN0b3J5JywgcmF3LCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0LlVTRVIpO1xuXHR9XG5cblx0Z2V0SGlzdG9yeShwcm92aWRlckxhYmVsOiBzdHJpbmcsIHJvb3RVcmk6IFVSSSk6IEhpc3RvcnlOYXZpZ2F0b3IyPHN0cmluZz4ge1xuXHRcdGxldCBwcm92aWRlckhpc3RvcmllcyA9IHRoaXMuaGlzdG9yaWVzLmdldChwcm92aWRlckxhYmVsKTtcblxuXHRcdGlmICghcHJvdmlkZXJIaXN0b3JpZXMpIHtcblx0XHRcdHByb3ZpZGVySGlzdG9yaWVzID0gbmV3IFJlc291cmNlTWFwKCk7XG5cdFx0XHR0aGlzLmhpc3Rvcmllcy5zZXQocHJvdmlkZXJMYWJlbCwgcHJvdmlkZXJIaXN0b3JpZXMpO1xuXHRcdH1cblxuXHRcdGxldCBoaXN0b3J5ID0gcHJvdmlkZXJIaXN0b3JpZXMuZ2V0KHJvb3RVcmkpO1xuXG5cdFx0aWYgKCFoaXN0b3J5KSB7XG5cdFx0XHRoaXN0b3J5ID0gbmV3IEhpc3RvcnlOYXZpZ2F0b3IyKFsnJ10sIDEwMCk7XG5cdFx0XHRwcm92aWRlckhpc3Rvcmllcy5zZXQocm9vdFVyaSwgaGlzdG9yeSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGhpc3Rvcnk7XG5cdH1cblxuXHQvLyBNaWdyYXRlcyBmcm9tIEFwcGxpY2F0aW9uIHNjb3BlIHN0b3JhZ2UgdG8gV29ya3NwYWNlIHNjb3BlLlxuXHQvLyBUT0RPQGpvYW9tb3Jlbm86IENoYW5nZSBmcm9tIEphbnVhcnkgMjAyNCBvbndhcmRzIHN1Y2ggdGhhdCB0aGUgb25seSBjb2RlIGlzIHRvIHJlbW92ZSBhbGwgYHNjbS9pbnB1dDpgIHN0b3JhZ2Uga2V5c1xuXHRwcml2YXRlIG1pZ3JhdGVTdG9yYWdlKCk6IGJvb2xlYW4ge1xuXHRcdGxldCBkaWRTb21ldGhpbmdDaGFuZ2UgPSBmYWxzZTtcblx0XHRjb25zdCBtYWNoaW5lS2V5cyA9IEl0ZXJhYmxlLmZpbHRlcih0aGlzLnN0b3JhZ2VTZXJ2aWNlLmtleXMoU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpLCBrZXkgPT4ga2V5LnN0YXJ0c1dpdGgoJ3NjbS9pbnB1dDonKSk7XG5cblx0XHRmb3IgKGNvbnN0IGtleSBvZiBtYWNoaW5lS2V5cykge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgbGVnYWN5SGlzdG9yeSA9IEpTT04ucGFyc2UodGhpcy5zdG9yYWdlU2VydmljZS5nZXQoa2V5LCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sICcnKSk7XG5cdFx0XHRcdGNvbnN0IG1hdGNoID0gL15zY21cXC9pbnB1dDooW146XSspOiguKykkLy5leGVjKGtleSk7XG5cblx0XHRcdFx0aWYgKCFtYXRjaCB8fCAhQXJyYXkuaXNBcnJheShsZWdhY3lIaXN0b3J5Py5oaXN0b3J5KSB8fCAhTnVtYmVyLmlzSW50ZWdlcihsZWdhY3lIaXN0b3J5Py50aW1lc3RhbXApKSB7XG5cdFx0XHRcdFx0dGhpcy5zdG9yYWdlU2VydmljZS5yZW1vdmUoa2V5LCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04pO1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgWywgcHJvdmlkZXJMYWJlbCwgcm9vdFBhdGhdID0gbWF0Y2g7XG5cdFx0XHRcdGNvbnN0IHJvb3RVcmkgPSBVUkkuZmlsZShyb290UGF0aCk7XG5cblx0XHRcdFx0aWYgKHRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlRm9sZGVyKHJvb3RVcmkpKSB7XG5cdFx0XHRcdFx0Y29uc3QgaGlzdG9yeSA9IHRoaXMuZ2V0SGlzdG9yeShwcm92aWRlckxhYmVsLCByb290VXJpKTtcblxuXHRcdFx0XHRcdGZvciAoY29uc3QgZW50cnkgb2YgSXRlcmFibGUucmV2ZXJzZShsZWdhY3lIaXN0b3J5Lmhpc3RvcnkgYXMgc3RyaW5nW10pKSB7XG5cdFx0XHRcdFx0XHRoaXN0b3J5LnByZXBlbmQoZW50cnkpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGRpZFNvbWV0aGluZ0NoYW5nZSA9IHRydWU7XG5cdFx0XHRcdFx0dGhpcy5zdG9yYWdlU2VydmljZS5yZW1vdmUoa2V5LCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04pO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGNhdGNoIHtcblx0XHRcdFx0dGhpcy5zdG9yYWdlU2VydmljZS5yZW1vdmUoa2V5LCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBkaWRTb21ldGhpbmdDaGFuZ2U7XG5cdH1cblxuXHRkaXNwb3NlKCkge1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG59XG5cblxuZXhwb3J0IGNsYXNzIFNDTVNlcnZpY2UgaW1wbGVtZW50cyBJU0NNU2VydmljZSB7XG5cblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0X3JlcG9zaXRvcmllcyA9IG5ldyBNYXA8c3RyaW5nLCBJU0NNUmVwb3NpdG9yeT4oKTsgIC8vIHVzZWQgaW4gdGVzdHNcblx0Z2V0IHJlcG9zaXRvcmllcygpOiBJdGVyYWJsZTxJU0NNUmVwb3NpdG9yeT4geyByZXR1cm4gdGhpcy5fcmVwb3NpdG9yaWVzLnZhbHVlcygpOyB9XG5cdGdldCByZXBvc2l0b3J5Q291bnQoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuX3JlcG9zaXRvcmllcy5zaXplOyB9XG5cblx0cHJpdmF0ZSBpbnB1dEhpc3Rvcnk6IFNDTUlucHV0SGlzdG9yeTtcblx0cHJpdmF0ZSBwcm92aWRlckNvdW50OiBJQ29udGV4dEtleTxudW1iZXI+O1xuXHRwcml2YXRlIGhpc3RvcnlQcm92aWRlckNvdW50OiBJQ29udGV4dEtleTxudW1iZXI+O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQWRkUHJvdmlkZXIgPSBuZXcgRW1pdHRlcjxJU0NNUmVwb3NpdG9yeT4oKTtcblx0cmVhZG9ubHkgb25EaWRBZGRSZXBvc2l0b3J5OiBFdmVudDxJU0NNUmVwb3NpdG9yeT4gPSB0aGlzLl9vbkRpZEFkZFByb3ZpZGVyLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkUmVtb3ZlUHJvdmlkZXIgPSBuZXcgRW1pdHRlcjxJU0NNUmVwb3NpdG9yeT4oKTtcblx0cmVhZG9ubHkgb25EaWRSZW1vdmVSZXBvc2l0b3J5OiBFdmVudDxJU0NNUmVwb3NpdG9yeT4gPSB0aGlzLl9vbkRpZFJlbW92ZVByb3ZpZGVyLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2Ugd29ya3NwYWNlQ29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJVXJpSWRlbnRpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlXG5cdCkge1xuXHRcdHRoaXMuaW5wdXRIaXN0b3J5ID0gbmV3IFNDTUlucHV0SGlzdG9yeShzdG9yYWdlU2VydmljZSwgd29ya3NwYWNlQ29udGV4dFNlcnZpY2UpO1xuXG5cdFx0dGhpcy5wcm92aWRlckNvdW50ID0gY29udGV4dEtleVNlcnZpY2UuY3JlYXRlS2V5KCdzY20ucHJvdmlkZXJDb3VudCcsIDApO1xuXHRcdHRoaXMuaGlzdG9yeVByb3ZpZGVyQ291bnQgPSBjb250ZXh0S2V5U2VydmljZS5jcmVhdGVLZXkoJ3NjbS5oaXN0b3J5UHJvdmlkZXJDb3VudCcsIDApO1xuXHR9XG5cblx0cmVnaXN0ZXJTQ01Qcm92aWRlcihwcm92aWRlcjogSVNDTVByb3ZpZGVyKTogSVNDTVJlcG9zaXRvcnkge1xuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnU0NNU2VydmljZSNyZWdpc3RlclNDTVByb3ZpZGVyJyk7XG5cblx0XHRpZiAodGhpcy5fcmVwb3NpdG9yaWVzLmhhcyhwcm92aWRlci5pZCkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgU0NNIFByb3ZpZGVyICR7cHJvdmlkZXIuaWR9IGFscmVhZHkgZXhpc3RzLmApO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0Y29uc3QgaGlzdG9yeVByb3ZpZGVyQ291bnQgPSAoKSA9PiB7XG5cdFx0XHRyZXR1cm4gQXJyYXkuZnJvbSh0aGlzLl9yZXBvc2l0b3JpZXMudmFsdWVzKCkpXG5cdFx0XHRcdC5maWx0ZXIociA9PiAhIXIucHJvdmlkZXIuaGlzdG9yeVByb3ZpZGVyLmdldCgpKS5sZW5ndGg7XG5cdFx0fTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0dGhpcy5fcmVwb3NpdG9yaWVzLmRlbGV0ZShwcm92aWRlci5pZCk7XG5cdFx0XHR0aGlzLl9vbkRpZFJlbW92ZVByb3ZpZGVyLmZpcmUocmVwb3NpdG9yeSk7XG5cblx0XHRcdHRoaXMucHJvdmlkZXJDb3VudC5zZXQodGhpcy5fcmVwb3NpdG9yaWVzLnNpemUpO1xuXHRcdFx0dGhpcy5oaXN0b3J5UHJvdmlkZXJDb3VudC5zZXQoaGlzdG9yeVByb3ZpZGVyQ291bnQoKSk7XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgcmVwb3NpdG9yeSA9IG5ldyBTQ01SZXBvc2l0b3J5KHByb3ZpZGVyLmlkLCBwcm92aWRlciwgZGlzcG9zYWJsZXMsIHRoaXMuaW5wdXRIaXN0b3J5KTtcblx0XHR0aGlzLl9yZXBvc2l0b3JpZXMuc2V0KHByb3ZpZGVyLmlkLCByZXBvc2l0b3J5KTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChydW5PbkNoYW5nZShwcm92aWRlci5oaXN0b3J5UHJvdmlkZXIsICgpID0+IHtcblx0XHRcdHRoaXMuaGlzdG9yeVByb3ZpZGVyQ291bnQuc2V0KGhpc3RvcnlQcm92aWRlckNvdW50KCkpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMucHJvdmlkZXJDb3VudC5zZXQodGhpcy5fcmVwb3NpdG9yaWVzLnNpemUpO1xuXHRcdHRoaXMuaGlzdG9yeVByb3ZpZGVyQ291bnQuc2V0KGhpc3RvcnlQcm92aWRlckNvdW50KCkpO1xuXG5cdFx0dGhpcy5fb25EaWRBZGRQcm92aWRlci5maXJlKHJlcG9zaXRvcnkpO1xuXG5cdFx0cmV0dXJuIHJlcG9zaXRvcnk7XG5cdH1cblxuXHRnZXRSZXBvc2l0b3J5KGlkOiBzdHJpbmcpOiBJU0NNUmVwb3NpdG9yeSB8IHVuZGVmaW5lZDtcblx0Z2V0UmVwb3NpdG9yeShyZXNvdXJjZTogVVJJKTogSVNDTVJlcG9zaXRvcnkgfCB1bmRlZmluZWQ7XG5cdGdldFJlcG9zaXRvcnkoaWRPclJlc291cmNlOiBzdHJpbmcgfCBVUkkpOiBJU0NNUmVwb3NpdG9yeSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHR5cGVvZiBpZE9yUmVzb3VyY2UgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fcmVwb3NpdG9yaWVzLmdldChpZE9yUmVzb3VyY2UpO1xuXHRcdH1cblxuXHRcdGlmIChpZE9yUmVzb3VyY2Uuc2NoZW1lICE9PSBTY2hlbWFzLmZpbGUgJiZcblx0XHRcdGlkT3JSZXNvdXJjZS5zY2hlbWUgIT09IFNjaGVtYXMudnNjb2RlUmVtb3RlKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGxldCBiZXN0UmVwb3NpdG9yeTogSVNDTVJlcG9zaXRvcnkgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0bGV0IGJlc3RNYXRjaExlbmd0aCA9IE51bWJlci5QT1NJVElWRV9JTkZJTklUWTtcblxuXHRcdGZvciAoY29uc3QgcmVwb3NpdG9yeSBvZiB0aGlzLnJlcG9zaXRvcmllcykge1xuXHRcdFx0Y29uc3Qgcm9vdCA9IHJlcG9zaXRvcnkucHJvdmlkZXIucm9vdFVyaTtcblxuXHRcdFx0aWYgKCFyb290KSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBwYXRoID0gdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLnJlbGF0aXZlUGF0aChyb290LCBpZE9yUmVzb3VyY2UpO1xuXG5cdFx0XHRpZiAocGF0aCAmJiAhL15cXC5cXC4vLnRlc3QocGF0aCkgJiYgcGF0aC5sZW5ndGggPCBiZXN0TWF0Y2hMZW5ndGgpIHtcblx0XHRcdFx0YmVzdFJlcG9zaXRvcnkgPSByZXBvc2l0b3J5O1xuXHRcdFx0XHRiZXN0TWF0Y2hMZW5ndGggPSBwYXRoLmxlbmd0aDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gYmVzdFJlcG9zaXRvcnk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxZQUFZLGlCQUFpQixvQkFBb0I7QUFDMUQsU0FBZ0IsZUFBZTtBQUMvQixTQUFzRyw0QkFBbUU7QUFDekssU0FBUyxtQkFBbUI7QUFDNUIsU0FBc0IsMEJBQTBCO0FBQ2hELFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FBQzdELFNBQVMseUJBQXlCO0FBRWxDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsV0FBVztBQUNwQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGdDQUFnQztBQUN6QyxTQUFTLGVBQWU7QUFDeEIsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxtQkFBbUI7QUFFNUIsTUFBTSxpQkFBaUIsV0FBZ0M7QUFBQSxFQW9GdEQsWUFDVSxZQUNRLFNBQ2hCO0FBQ0QsVUFBTTtBQUhHO0FBQ1E7QUFwRmxCLFNBQVEsU0FBUztBQU1qQixTQUFpQixlQUFlLElBQUksUUFBOEI7QUFDbEUsU0FBUyxjQUEyQyxLQUFLLGFBQWE7QUFFdEUsU0FBUSxlQUFlO0FBV3ZCLFNBQWlCLDBCQUEwQixJQUFJLFFBQWdCO0FBQy9ELFNBQVMseUJB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RTtBQUFBLElBQ25EO0FBRUEsZ0JBQVksSUFBSSxhQUFhLE1BQU07QUFDbEMsV0FBSyxjQUFjLE9BQU8sU0FBUyxFQUFFO0FBQ3JDLFdBQUsscUJBQXFCLEtBQUssVUFBVTtBQUV6QyxXQUFLLGNBQWMsSUFBSSxLQUFLLGNBQWMsSUFBSTtBQUM5QyxXQUFLLHFCQUFxQixJQUFJLHFCQUFxQixDQUFDO0FBQUEsSUFDckQsQ0FBQyxDQUFDO0FBRUYsVUFBTSxhQUFhLElBQUksY0FBYyxTQUFTLElBQUksVUFBVSxhQUFhLEtBQUssWUFBWTtBQUMxRixTQUFLLGNBQWMsSUFBSSxTQUFTLElBQUksVUFBVTtBQUU5QyxnQkFBWSxJQUFJLFlBQVksU0FBUyxpQkFBaUIsTUFBTTtBQUMzRCxXQUFLLHFCQUFxQixJQUFJLHFCQUFxQixDQUFDO0FBQUEsSUFDckQsQ0FBQyxDQUFDO0FBRUYsU0FBSyxjQUFjLElBQUksS0FBSyxjQUFjLElBQUk7QUFDOUMsU0FBSyxxQkFBcUIsSUFBSSxxQkFBcUIsQ0FBQztBQUVwRCxTQUFLLGtCQUFrQixLQUFLLFVBQVU7QUFFdEMsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUlBLGNBQWMsY0FBd0Q7QUFDckUsUUFBSSxPQUFPLGlCQUFpQixVQUFVO0FBQ3JDLGFBQU8sS0FBSyxjQUFjLElBQUksWUFBWTtBQUFBLElBQzNDO0FBRUEsUUFBSSxhQUFhLFdBQVcsUUFBUSxRQUNuQyxhQUFhLFdBQVcsUUFBUSxjQUFjO0FBQzlDLGFBQU87QUFBQSxJQUNSO0FBRUEsUUFBSSxpQkFBNkM7QUFDakQsUUFBSSxrQkFBa0IsT0FBTztBQUU3QixlQUFXLGNBQWMsS0FBSyxjQUFjO0FBQzNDLFlBQU0sT0FBTyxXQUFXLFNBQVM7QUFFakMsVUFBSSxDQUFDLE1BQU07QUFDVjtBQUFBLE1BQ0Q7QUFFQSxZQUFNLE9BQU8sS0FBSyxtQkFBbUIsT0FBTyxhQUFhLE1BQU0sWUFBWTtBQUUzRSxVQUFJLFFBQVEsQ0FBQyxRQUFRLEtBQUssSUFBSSxLQUFLLEtBQUssU0FBUyxpQkFBaUI7QUFDakUseUJBQWlCO0FBQ2pCLDBCQUFrQixLQUFLO0FBQUEsTUFDeEI7QUFBQSxJQUNEO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFDRDtBQXBHYSxhQUFOO0FBQUEsRUFtQko7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0F2QlU7IiwKICAibmFtZXMiOiBbXQp9Cg==
