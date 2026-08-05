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
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { ISCMViewService, ISCMService, ISCMRepositorySortKey } from "../common/scm.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { SCMMenus } from "./menus.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { debounce } from "../../../../base/common/decorators.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { compareFileNames, comparePaths } from "../../../../base/common/comparers.js";
import { basename } from "../../../../base/common/resources.js";
import { binarySearch } from "../../../../base/common/arrays.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { derivedObservableWithCache, derivedOpts, latestChangedValue, observableFromEventOpts, observableValue } from "../../../../base/common/observable.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { EditorResourceAccessor } from "../../../common/editor.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { localize } from "../../../../nls.js";
function getProviderStorageKey(provider) {
  return `${provider.contextValue}:${provider.label}${provider.rootUri ? `:${provider.rootUri.toString()}` : ""}`;
}
function getRepositoryName(workspaceContextService, repository) {
  if (!repository.provider.rootUri) {
    return repository.provider.label;
  }
  const folder = workspaceContextService.getWorkspaceFolder(repository.provider.rootUri);
  return folder?.uri.toString() === repository.provider.rootUri.toString() ? folder.name : basename(repository.provider.rootUri);
}
const RepositoryContextKeys = {
  RepositorySortKey: new RawContextKey("scmRepositorySortKey", ISCMRepositorySortKey.DiscoveryTime)
};
let RepositoryPicker = class {
  constructor(_placeHolder, _autoQuickItemDescription, _quickInputService, _scmViewService) {
    this._placeHolder = _placeHolder;
    this._autoQuickItemDescription = _autoQuickItemDescription;
    this._quickInputService = _quickInputService;
    this._scmViewService = _scmViewService;
    this._autoQuickPickItem = {
      label: localize("auto", "Auto"),
      description: this._autoQuickItemDescription,
      repository: "auto"
    };
  }
  async pickRepository() {
    const picks = [
      this._autoQuickPickItem,
      { type: "separator" }
    ];
    picks.push(...this._scmViewService.repositories.map((r) => ({
      label: r.provider.name,
      description: r.provider.rootUri?.fsPath,
      iconClass: ThemeIcon.asClassName(Codicon.repo),
      repository: r
    })));
    return this._quickInputService.pick(picks, { placeHolder: this._placeHolder });
  }
};
RepositoryPicker = __decorateClass([
  __decorateParam(2, IQuickInputService),
  __decorateParam(3, ISCMViewService)
], RepositoryPicker);
let SCMViewService = class {
  constructor(scmService, contextKeyService, editorService, extensionService, instantiationService, configurationService, storageService, workspaceContextService) {
    this.scmService = scmService;
    this.editorService = editorService;
    this.configurationService = configurationService;
    this.storageService = storageService;
    this.workspaceContextService = workspaceContextService;
    this.didFinishLoading = false;
    this.didSelectRepository = false;
    this.disposables = new DisposableStore();
    this._repositories = [];
    this._onDidChangeRepositories = new Emitter();
    this.onDidChangeRepositories = this._onDidChangeRepositories.event;
    this._onDidSetVisibleRepositories = new Emitter();
    this.onDidChangeVisibleRepositories = Event.any(
      this._onDidSetVisibleRepositories.event,
      Event.debounce(
        this._onDidChangeRepositories.event,
        (last, e) => {
          if (!last) {
            return e;
          }
          const added = new Set(last.added);
          const removed = new Set(last.removed);
          for (const repository of e.added) {
            if (removed.has(repository)) {
              removed.delete(repository);
            } else {
              added.add(repository);
            }
          }
          for (const repository of e.removed) {
            if (added.has(repository)) {
              added.delete(repository);
            } else {
              removed.add(repository);
            }
          }
          return { added, removed };
        },
        0,
        void 0,
        void 0,
        void 0,
        this.disposables
      )
    );
    this._onDidFocusRepository = new Emitter();
    this.onDidFocusRepository = this._onDidFocusRepository.event;
    this.menus = instantiationService.createInstance(SCMMenus);
    this._focusedRepositoryObs = observableFromEventOpts(
      {
        owner: this,
        equalsFn: () => false
      },
      this.onDidFocusRepository,
      () => this.focusedRepository
    );
    this._activeEditorObs = observableFromEventOpts(
      {
        owner: this,
        equalsFn: () => false
      },
      this.editorService.onDidActiveEditorChange,
      () => this.editorService.activeEditor
    );
    this._activeEditorRepositoryObs = derivedObservableWithCache(
      this,
      (reader, lastValue) => {
        const activeEditor = this._activeEditorObs.read(reader);
        const activeResource = EditorResourceAccessor.getOriginalUri(activeEditor);
        if (!activeResource) {
          return lastValue;
        }
        const repository = this.scmService.getRepository(activeResource);
        if (!repository) {
          return lastValue;
        }
        return Object.create(repository);
      }
    );
    this._activeRepositoryPinnedObs = observableValue(this, void 0);
    this._activeRepositoryObs = latestChangedValue(this, [this._activeEditorRepositoryObs, this._focusedRepositoryObs]);
    this.activeRepository = derivedOpts({
      owner: this,
      equalsFn: (r1, r2) => r1?.id === r2?.id
    }, (reader) => {
      const activeRepository = this._activeRepositoryObs.read(reader);
      const activeRepositoryPinned = this._activeRepositoryPinnedObs.read(reader);
      return activeRepositoryPinned ?? activeRepository;
    });
    try {
      this.previousState = JSON.parse(storageService.get("scm:view:visibleRepositories", StorageScope.WORKSPACE, ""));
    } catch {
    }
    this._repositoriesSortKey = this.previousState?.sortKey ?? this.getViewSortOrder();
    this._sortKeyContextKey = RepositoryContextKeys.RepositorySortKey.bindTo(contextKeyService);
    this._sortKeyContextKey.set(this._repositoriesSortKey);
    scmService.onDidAddRepository(this.onDidAddRepository, this, this.disposables);
    scmService.onDidRemoveRepository(this.onDidRemoveRepository, this, this.disposables);
    for (const repository of scmService.repositories) {
      this.onDidAddRepository(repository);
    }
    storageService.onWillSaveState(this.onWillSaveState, this, this.disposables);
    extensionService.onWillStop(() => {
      this.onWillSaveState();
      this.didFinishLoading = false;
    }, this, this.disposables);
  }
  get repositories() {
    return this._repositories.map((r) => r.repository);
  }
  get visibleRepositories() {
    if (this._repositoriesSortKey === ISCMRepositorySortKey.DiscoveryTime) {
      return this._repositories.filter((r) => r.selectionIndex !== -1).sort((r1, r2) => r1.selectionIndex - r2.selectionIndex).map((r) => r.repository);
    }
    return this._repositories.filter((r) => r.selectionIndex !== -1).map((r) => r.repository);
  }
  set visibleRepositories(visibleRepositories) {
    const set = new Set(visibleRepositories);
    const added = /* @__PURE__ */ new Set();
    const removed = /* @__PURE__ */ new Set();
    for (const repositoryView of this._repositories) {
      if (!set.has(repositoryView.repository) && repositoryView.selectionIndex !== -1) {
        repositoryView.selectionIndex = -1;
        removed.add(repositoryView.repository);
      }
      if (set.has(repositoryView.repository)) {
        if (repositoryView.selectionIndex === -1) {
          added.add(repositoryView.repository);
        }
        repositoryView.selectionIndex = visibleRepositories.indexOf(repositoryView.repository);
      }
    }
    if (added.size === 0 && removed.size === 0) {
      return;
    }
    this._onDidSetVisibleRepositories.fire({ added, removed });
    if (this._repositories.find((r) => r.focused && r.selectionIndex === -1)) {
      this.focus(this._repositories.find((r) => r.selectionIndex !== -1)?.repository);
    }
  }
  get focusedRepository() {
    return this._repositories.find((r) => r.focused)?.repository;
  }
  onDidAddRepository(repository) {
    if (!this.didFinishLoading) {
      this.eventuallyFinishLoading();
    }
    const repositoryView = {
      repository,
      discoveryTime: Date.now(),
      focused: false,
      selectionIndex: -1
    };
    let removed = Iterable.empty();
    if (this.previousState && !this.didFinishLoading) {
      const index = this.previousState.all.indexOf(getProviderStorageKey(repository.provider));
      if (index === -1) {
        const added = [];
        this.insertRepositoryView(this._repositories, repositoryView);
        this._repositories.forEach((repositoryView2, index2) => {
          if (repositoryView2.selectionIndex === -1) {
            added.push(repositoryView2.repository);
          }
          repositoryView2.selectionIndex = index2;
        });
        this._onDidChangeRepositories.fire({ added, removed: Iterable.empty() });
        this.didSelectRepository = false;
        return;
      }
      if (this.previousState.visible.indexOf(index) === -1) {
        if (this.didSelectRepository) {
          this.insertRepositoryView(this._repositories, repositoryView);
          this._onDidChangeRepositories.fire({ added: Iterable.empty(), removed: Iterable.empty() });
          return;
        }
      } else {
        if (!this.didSelectRepository) {
          removed = [...this.visibleRepositories];
          this._repositories.forEach((r) => {
            r.focused = false;
            r.selectionIndex = -1;
          });
          this.didSelectRepository = true;
        }
      }
    }
    const maxSelectionIndex = this.getMaxSelectionIndex();
    this.insertRepositoryView(this._repositories, { ...repositoryView, selectionIndex: maxSelectionIndex + 1 });
    this._onDidChangeRepositories.fire({ added: [repositoryView.repository], removed });
    if (!this._repositories.find((r) => r.focused)) {
      this.focus(repository);
    }
  }
  onDidRemoveRepository(repository) {
    if (!this.didFinishLoading) {
      this.eventuallyFinishLoading();
    }
    const repositoriesIndex = this._repositories.findIndex((r) => r.repository === repository);
    if (repositoriesIndex === -1) {
      return;
    }
    let added = Iterable.empty();
    const repositoryView = this._repositories.splice(repositoriesIndex, 1);
    if (this._repositories.length > 0 && this.visibleRepositories.length === 0) {
      this._repositories[0].selectionIndex = 0;
      added = [this._repositories[0].repository];
    }
    this._onDidChangeRepositories.fire({ added, removed: repositoryView.map((r) => r.repository) });
    if (repositoryView.length === 1 && repositoryView[0].focused && this.visibleRepositories.length > 0) {
      this.focus(this.visibleRepositories[0]);
    }
  }
  isVisible(repository) {
    return this._repositories.find((r) => r.repository === repository)?.selectionIndex !== -1;
  }
  toggleVisibility(repository, visible) {
    if (typeof visible === "undefined") {
      visible = !this.isVisible(repository);
    } else if (this.isVisible(repository) === visible) {
      return;
    }
    if (visible) {
      this.visibleRepositories = [...this.visibleRepositories, repository];
    } else {
      const index = this.visibleRepositories.indexOf(repository);
      if (index > -1) {
        this.visibleRepositories = [
          ...this.visibleRepositories.slice(0, index),
          ...this.visibleRepositories.slice(index + 1)
        ];
      }
    }
  }
  toggleSortKey(sortKey) {
    this._repositoriesSortKey = sortKey;
    this._sortKeyContextKey.set(this._repositoriesSortKey);
    this._repositories.sort(this.compareRepositories.bind(this));
    this._onDidChangeRepositories.fire({ added: Iterable.empty(), removed: Iterable.empty() });
  }
  focus(repository) {
    if (repository && !this.isVisible(repository)) {
      return;
    }
    this._repositories.forEach((r) => r.focused = r.repository === repository);
    if (this._repositories.find((r) => r.focused)) {
      this._onDidFocusRepository.fire(repository);
    }
  }
  pinActiveRepository(repository) {
    this._activeRepositoryPinnedObs.set(repository, void 0);
  }
  compareRepositories(op1, op2) {
    if (this._repositoriesSortKey === ISCMRepositorySortKey.DiscoveryTime) {
      return op1.discoveryTime - op2.discoveryTime;
    }
    if (this._repositoriesSortKey === "path" && op1.repository.provider.rootUri && op2.repository.provider.rootUri) {
      return comparePaths(op1.repository.provider.rootUri.fsPath, op2.repository.provider.rootUri.fsPath);
    }
    const name1 = getRepositoryName(this.workspaceContextService, op1.repository);
    const name2 = getRepositoryName(this.workspaceContextService, op2.repository);
    const nameComparison = compareFileNames(name1, name2);
    if (nameComparison === 0 && op1.repository.provider.rootUri && op2.repository.provider.rootUri) {
      return comparePaths(op1.repository.provider.rootUri.fsPath, op2.repository.provider.rootUri.fsPath);
    }
    return nameComparison;
  }
  getMaxSelectionIndex() {
    return this._repositories.length === 0 ? -1 : Math.max(...this._repositories.map((r) => r.selectionIndex));
  }
  getViewSortOrder() {
    const sortOder = this.configurationService.getValue("scm.repositories.sortOrder");
    switch (sortOder) {
      case "discovery time":
        return ISCMRepositorySortKey.DiscoveryTime;
      case "name":
        return ISCMRepositorySortKey.Name;
      case "path":
        return ISCMRepositorySortKey.Path;
      default:
        return ISCMRepositorySortKey.DiscoveryTime;
    }
  }
  insertRepositoryView(repositories, repositoryView) {
    const index = binarySearch(repositories, repositoryView, this.compareRepositories.bind(this));
    repositories.splice(index < 0 ? ~index : index, 0, repositoryView);
  }
  onWillSaveState() {
    if (!this.didFinishLoading) {
      return;
    }
    const all = this.repositories.map((r) => getProviderStorageKey(r.provider));
    const visible = this.visibleRepositories.map((r) => all.indexOf(getProviderStorageKey(r.provider)));
    this.previousState = { all, sortKey: this._repositoriesSortKey, visible };
    this.storageService.store("scm:view:visibleRepositories", JSON.stringify(this.previousState), StorageScope.WORKSPACE, StorageTarget.MACHINE);
  }
  eventuallyFinishLoading() {
    this.finishLoading();
  }
  finishLoading() {
    if (this.didFinishLoading) {
      return;
    }
    this.didFinishLoading = true;
  }
  dispose() {
    this.disposables.dispose();
    this._onDidChangeRepositories.dispose();
    this._onDidSetVisibleRepositories.dispose();
  }
};
__decorateClass([
  debounce(5e3)
], SCMViewService.prototype, "eventuallyFinishLoading", 1);
SCMViewService = __decorateClass([
  __decorateParam(0, ISCMService),
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IEditorService),
  __decorateParam(3, IExtensionService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IStorageService),
  __decorateParam(7, IWorkspaceContextService)
], SCMViewService);
export {
  RepositoryContextKeys,
  RepositoryPicker,
  SCMViewService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zY20vYnJvd3Nlci9zY21WaWV3U2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElTQ01WaWV3U2VydmljZSwgSVNDTVJlcG9zaXRvcnksIElTQ01TZXJ2aWNlLCBJU0NNVmlld1Zpc2libGVSZXBvc2l0b3J5Q2hhbmdlRXZlbnQsIElTQ01NZW51cywgSVNDTVByb3ZpZGVyLCBJU0NNUmVwb3NpdG9yeVNvcnRLZXkgfSBmcm9tICcuLi9jb21tb24vc2NtLmpzJztcbmltcG9ydCB7IEl0ZXJhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaXRlcmF0b3IuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBTQ01NZW51cyB9IGZyb20gJy4vbWVudXMuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBTdG9yYWdlU2NvcGUsIFN0b3JhZ2VUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IGRlYm91bmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZGVjb3JhdG9ycy5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBjb21wYXJlRmlsZU5hbWVzLCBjb21wYXJlUGF0aHMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb21wYXJlcnMuanMnO1xuaW1wb3J0IHsgYmFzZW5hbWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgYmluYXJ5U2VhcmNoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSwgUmF3Q29udGV4dEtleSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IGRlcml2ZWRPYnNlcnZhYmxlV2l0aENhY2hlLCBkZXJpdmVkT3B0cywgSU9ic2VydmFibGUsIElTZXR0YWJsZU9ic2VydmFibGUsIGxhdGVzdENoYW5nZWRWYWx1ZSwgb2JzZXJ2YWJsZUZyb21FdmVudE9wdHMsIG9ic2VydmFibGVWYWx1ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRWRpdG9yUmVzb3VyY2VBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yL2VkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IElRdWlja0lucHV0U2VydmljZSwgSVF1aWNrUGlja0l0ZW0sIElRdWlja1BpY2tTZXBhcmF0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuXG5mdW5jdGlvbiBnZXRQcm92aWRlclN0b3JhZ2VLZXkocHJvdmlkZXI6IElTQ01Qcm92aWRlcik6IHN0cmluZyB7XG5cdHJldHVybiBgJHtwcm92aWRlci5jb250ZXh0VmFsdWV9OiR7cHJvdmlkZXIubGFiZWx9JHtwcm92aWRlci5yb290VXJpID8gYDoke3Byb3ZpZGVyLnJvb3RVcmkudG9TdHJpbmcoKX1gIDogJyd9YDtcbn1cblxuZnVuY3Rpb24gZ2V0UmVwb3NpdG9yeU5hbWUod29ya3NwYWNlQ29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSwgcmVwb3NpdG9yeTogSVNDTVJlcG9zaXRvcnkpOiBzdHJpbmcge1xuXHRpZiAoIXJlcG9zaXRvcnkucHJvdmlkZXIucm9vdFVyaSkge1xuXHRcdHJldHVybiByZXBvc2l0b3J5LnByb3ZpZGVyLmxhYmVsO1xuXHR9XG5cblx0Y29uc3QgZm9sZGVyID0gd29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlRm9sZGVyKHJlcG9zaXRvcnkucHJvdmlkZXIucm9vdFVyaSk7XG5cdHJldHVybiBmb2xkZXI/LnVyaS50b1N0cmluZygpID09PSByZXBvc2l0b3J5LnByb3ZpZGVyLnJvb3RVcmkudG9TdHJpbmcoKSA/IGZvbGRlci5uYW1lIDogYmFzZW5hbWUocmVwb3NpdG9yeS5wcm92aWRlci5yb290VXJpKTtcbn1cblxuZXhwb3J0IGNvbnN0IFJlcG9zaXRvcnlDb250ZXh0S2V5cyA9IHtcblx0UmVwb3NpdG9yeVNvcnRLZXk6IG5ldyBSYXdDb250ZXh0S2V5PElTQ01SZXBvc2l0b3J5U29ydEtleT4oJ3NjbVJlcG9zaXRvcnlTb3J0S2V5JywgSVNDTVJlcG9zaXRvcnlTb3J0S2V5LkRpc2NvdmVyeVRpbWUpLFxufTtcblxuZXhwb3J0IHR5cGUgUmVwb3NpdG9yeVF1aWNrUGlja0l0ZW0gPSBJUXVpY2tQaWNrSXRlbSAmIHsgcmVwb3NpdG9yeTogJ2F1dG8nIHwgSVNDTVJlcG9zaXRvcnkgfTtcblxuZXhwb3J0IGNsYXNzIFJlcG9zaXRvcnlQaWNrZXIge1xuXHRwcml2YXRlIHJlYWRvbmx5IF9hdXRvUXVpY2tQaWNrSXRlbTogUmVwb3NpdG9yeVF1aWNrUGlja0l0ZW07XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcGxhY2VIb2xkZXI6IHN0cmluZyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9hdXRvUXVpY2tJdGVtRGVzY3JpcHRpb246IHN0cmluZyxcblx0XHRASVF1aWNrSW5wdXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3F1aWNrSW5wdXRTZXJ2aWNlOiBJUXVpY2tJbnB1dFNlcnZpY2UsXG5cdFx0QElTQ01WaWV3U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9zY21WaWV3U2VydmljZTogSVNDTVZpZXdTZXJ2aWNlXG5cdCkge1xuXHRcdHRoaXMuX2F1dG9RdWlja1BpY2tJdGVtID0ge1xuXHRcdFx0bGFiZWw6IGxvY2FsaXplKCdhdXRvJywgXCJBdXRvXCIpLFxuXHRcdFx0ZGVzY3JpcHRpb246IHRoaXMuX2F1dG9RdWlja0l0ZW1EZXNjcmlwdGlvbixcblx0XHRcdHJlcG9zaXRvcnk6ICdhdXRvJ1xuXHRcdH0gc2F0aXNmaWVzIFJlcG9zaXRvcnlRdWlja1BpY2tJdGVtO1xuXHR9XG5cblx0YXN5bmMgcGlja1JlcG9zaXRvcnkoKTogUHJvbWlzZTxSZXBvc2l0b3J5UXVpY2tQaWNrSXRlbSB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IHBpY2tzOiAoUmVwb3NpdG9yeVF1aWNrUGlja0l0ZW0gfCBJUXVpY2tQaWNrU2VwYXJhdG9yKVtdID0gW1xuXHRcdFx0dGhpcy5fYXV0b1F1aWNrUGlja0l0ZW0sXG5cdFx0XHR7IHR5cGU6ICdzZXBhcmF0b3InIH1cblx0XHRdO1xuXG5cdFx0cGlja3MucHVzaCguLi50aGlzLl9zY21WaWV3U2VydmljZS5yZXBvc2l0b3JpZXMubWFwKHIgPT4gKHtcblx0XHRcdGxhYmVsOiByLnByb3ZpZGVyLm5hbWUsXG5cdFx0XHRkZXNjcmlwdGlvbjogci5wcm92aWRlci5yb290VXJpPy5mc1BhdGgsXG5cdFx0XHRpY29uQ2xhc3M6IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShDb2RpY29uLnJlcG8pLFxuXHRcdFx0cmVwb3NpdG9yeTogclxuXHRcdH0pKSk7XG5cblx0XHRyZXR1cm4gdGhpcy5fcXVpY2tJbnB1dFNlcnZpY2UucGljayhwaWNrcywgeyBwbGFjZUhvbGRlcjogdGhpcy5fcGxhY2VIb2xkZXIgfSk7XG5cdH1cbn1cblxuaW50ZXJmYWNlIElTQ01SZXBvc2l0b3J5VmlldyB7XG5cdHJlYWRvbmx5IHJlcG9zaXRvcnk6IElTQ01SZXBvc2l0b3J5O1xuXHRyZWFkb25seSBkaXNjb3ZlcnlUaW1lOiBudW1iZXI7XG5cdGZvY3VzZWQ6IGJvb2xlYW47XG5cdHNlbGVjdGlvbkluZGV4OiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVNDTVZpZXdTZXJ2aWNlU3RhdGUge1xuXHRyZWFkb25seSBhbGw6IHN0cmluZ1tdO1xuXHRyZWFkb25seSBzb3J0S2V5OiBJU0NNUmVwb3NpdG9yeVNvcnRLZXk7XG5cdHJlYWRvbmx5IHZpc2libGU6IG51bWJlcltdO1xufVxuXG5leHBvcnQgY2xhc3MgU0NNVmlld1NlcnZpY2UgaW1wbGVtZW50cyBJU0NNVmlld1NlcnZpY2Uge1xuXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHJlYWRvbmx5IG1lbnVzOiBJU0NNTWVudXM7XG5cblx0cHJpdmF0ZSBkaWRGaW5pc2hMb2FkaW5nOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgZGlkU2VsZWN0UmVwb3NpdG9yeTogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIHByZXZpb3VzU3RhdGU6IElTQ01WaWV3U2VydmljZVN0YXRlIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHJlYWRvbmx5IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdHByaXZhdGUgX3JlcG9zaXRvcmllczogSVNDTVJlcG9zaXRvcnlWaWV3W10gPSBbXTtcblxuXHRnZXQgcmVwb3NpdG9yaWVzKCk6IElTQ01SZXBvc2l0b3J5W10ge1xuXHRcdHJldHVybiB0aGlzLl9yZXBvc2l0b3JpZXMubWFwKHIgPT4gci5yZXBvc2l0b3J5KTtcblx0fVxuXG5cdGdldCB2aXNpYmxlUmVwb3NpdG9yaWVzKCk6IElTQ01SZXBvc2l0b3J5W10ge1xuXHRcdC8vIEluIG9yZGVyIHRvIG1hdGNoIHRoZSBsZWdhY3kgYmVoYXZpb3VyLCB3aGVuIHRoZSByZXBvc2l0b3JpZXMgYXJlIHNvcnRlZCBieSBkaXNjb3ZlcnkgdGltZSxcblx0XHQvLyB0aGUgdmlzaWJsZSByZXBvc2l0b3JpZXMgYXJlIHNvcnRlZCBieSB0aGUgc2VsZWN0aW9uIGluZGV4IGluc3RlYWQgb2YgdGhlIGRpc2NvdmVyeSB0aW1lLlxuXHRcdGlmICh0aGlzLl9yZXBvc2l0b3JpZXNTb3J0S2V5ID09PSBJU0NNUmVwb3NpdG9yeVNvcnRLZXkuRGlzY292ZXJ5VGltZSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX3JlcG9zaXRvcmllcy5maWx0ZXIociA9PiByLnNlbGVjdGlvbkluZGV4ICE9PSAtMSlcblx0XHRcdFx0LnNvcnQoKHIxLCByMikgPT4gcjEuc2VsZWN0aW9uSW5kZXggLSByMi5zZWxlY3Rpb25JbmRleClcblx0XHRcdFx0Lm1hcChyID0+IHIucmVwb3NpdG9yeSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX3JlcG9zaXRvcmllc1xuXHRcdFx0LmZpbHRlcihyID0+IHIuc2VsZWN0aW9uSW5kZXggIT09IC0xKVxuXHRcdFx0Lm1hcChyID0+IHIucmVwb3NpdG9yeSk7XG5cdH1cblxuXHRzZXQgdmlzaWJsZVJlcG9zaXRvcmllcyh2aXNpYmxlUmVwb3NpdG9yaWVzOiBJU0NNUmVwb3NpdG9yeVtdKSB7XG5cdFx0Y29uc3Qgc2V0ID0gbmV3IFNldCh2aXNpYmxlUmVwb3NpdG9yaWVzKTtcblx0XHRjb25zdCBhZGRlZCA9IG5ldyBTZXQ8SVNDTVJlcG9zaXRvcnk+KCk7XG5cdFx0Y29uc3QgcmVtb3ZlZCA9IG5ldyBTZXQ8SVNDTVJlcG9zaXRvcnk+KCk7XG5cblx0XHRmb3IgKGNvbnN0IHJlcG9zaXRvcnlWaWV3IG9mIHRoaXMuX3JlcG9zaXRvcmllcykge1xuXHRcdFx0Ly8gU2VsZWN0ZWQgLT4gIVNlbGVjdGVkXG5cdFx0XHRpZiAoIXNldC5oYXMocmVwb3NpdG9yeVZpZXcucmVwb3NpdG9yeSkgJiYgcmVwb3NpdG9yeVZpZXcuc2VsZWN0aW9uSW5kZXggIT09IC0xKSB7XG5cdFx0XHRcdHJlcG9zaXRvcnlWaWV3LnNlbGVjdGlvbkluZGV4ID0gLTE7XG5cdFx0XHRcdHJlbW92ZWQuYWRkKHJlcG9zaXRvcnlWaWV3LnJlcG9zaXRvcnkpO1xuXHRcdFx0fVxuXHRcdFx0Ly8gU2VsZWN0ZWQgfCAhU2VsZWN0ZWQgLT4gU2VsZWN0ZWRcblx0XHRcdGlmIChzZXQuaGFzKHJlcG9zaXRvcnlWaWV3LnJlcG9zaXRvcnkpKSB7XG5cdFx0XHRcdGlmIChyZXBvc2l0b3J5Vmlldy5zZWxlY3Rpb25JbmRleCA9PT0gLTEpIHtcblx0XHRcdFx0XHRhZGRlZC5hZGQocmVwb3NpdG9yeVZpZXcucmVwb3NpdG9yeSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVwb3NpdG9yeVZpZXcuc2VsZWN0aW9uSW5kZXggPSB2aXNpYmxlUmVwb3NpdG9yaWVzLmluZGV4T2YocmVwb3NpdG9yeVZpZXcucmVwb3NpdG9yeSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGFkZGVkLnNpemUgPT09IDAgJiYgcmVtb3ZlZC5zaXplID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fb25EaWRTZXRWaXNpYmxlUmVwb3NpdG9yaWVzLmZpcmUoeyBhZGRlZCwgcmVtb3ZlZCB9KTtcblxuXHRcdC8vIFVwZGF0ZSBmb2N1cyBpZiB0aGUgZm9jdXNlZCByZXBvc2l0b3J5IGlzIG5vdCB2aXNpYmxlIGFueW1vcmVcblx0XHRpZiAodGhpcy5fcmVwb3NpdG9yaWVzLmZpbmQociA9PiByLmZvY3VzZWQgJiYgci5zZWxlY3Rpb25JbmRleCA9PT0gLTEpKSB7XG5cdFx0XHR0aGlzLmZvY3VzKHRoaXMuX3JlcG9zaXRvcmllcy5maW5kKHIgPT4gci5zZWxlY3Rpb25JbmRleCAhPT0gLTEpPy5yZXBvc2l0b3J5KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9vbkRpZENoYW5nZVJlcG9zaXRvcmllcyA9IG5ldyBFbWl0dGVyPElTQ01WaWV3VmlzaWJsZVJlcG9zaXRvcnlDaGFuZ2VFdmVudD4oKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VSZXBvc2l0b3JpZXMgPSB0aGlzLl9vbkRpZENoYW5nZVJlcG9zaXRvcmllcy5ldmVudDtcblxuXHRwcml2YXRlIF9vbkRpZFNldFZpc2libGVSZXBvc2l0b3JpZXMgPSBuZXcgRW1pdHRlcjxJU0NNVmlld1Zpc2libGVSZXBvc2l0b3J5Q2hhbmdlRXZlbnQ+KCk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlVmlzaWJsZVJlcG9zaXRvcmllcyA9IEV2ZW50LmFueShcblx0XHR0aGlzLl9vbkRpZFNldFZpc2libGVSZXBvc2l0b3JpZXMuZXZlbnQsXG5cdFx0RXZlbnQuZGVib3VuY2UoXG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVJlcG9zaXRvcmllcy5ldmVudCxcblx0XHRcdChsYXN0LCBlKSA9PiB7XG5cdFx0XHRcdGlmICghbGFzdCkge1xuXHRcdFx0XHRcdHJldHVybiBlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgYWRkZWQgPSBuZXcgU2V0KGxhc3QuYWRkZWQpO1xuXHRcdFx0XHRjb25zdCByZW1vdmVkID0gbmV3IFNldChsYXN0LnJlbW92ZWQpO1xuXG5cdFx0XHRcdGZvciAoY29uc3QgcmVwb3NpdG9yeSBvZiBlLmFkZGVkKSB7XG5cdFx0XHRcdFx0aWYgKHJlbW92ZWQuaGFzKHJlcG9zaXRvcnkpKSB7XG5cdFx0XHRcdFx0XHRyZW1vdmVkLmRlbGV0ZShyZXBvc2l0b3J5KTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0YWRkZWQuYWRkKHJlcG9zaXRvcnkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRmb3IgKGNvbnN0IHJlcG9zaXRvcnkgb2YgZS5yZW1vdmVkKSB7XG5cdFx0XHRcdFx0aWYgKGFkZGVkLmhhcyhyZXBvc2l0b3J5KSkge1xuXHRcdFx0XHRcdFx0YWRkZWQuZGVsZXRlKHJlcG9zaXRvcnkpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZW1vdmVkLmFkZChyZXBvc2l0b3J5KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4geyBhZGRlZCwgcmVtb3ZlZCB9O1xuXHRcdFx0fSwgMCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdGhpcy5kaXNwb3NhYmxlcylcblx0KTtcblxuXHRnZXQgZm9jdXNlZFJlcG9zaXRvcnkoKTogSVNDTVJlcG9zaXRvcnkgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9yZXBvc2l0b3JpZXMuZmluZChyID0+IHIuZm9jdXNlZCk/LnJlcG9zaXRvcnk7XG5cdH1cblxuXHRwcml2YXRlIF9vbkRpZEZvY3VzUmVwb3NpdG9yeSA9IG5ldyBFbWl0dGVyPElTQ01SZXBvc2l0b3J5IHwgdW5kZWZpbmVkPigpO1xuXHRyZWFkb25seSBvbkRpZEZvY3VzUmVwb3NpdG9yeSA9IHRoaXMuX29uRGlkRm9jdXNSZXBvc2l0b3J5LmV2ZW50O1xuXG5cdHJlYWRvbmx5IGFjdGl2ZVJlcG9zaXRvcnk6IElPYnNlcnZhYmxlPElTQ01SZXBvc2l0b3J5IHwgdW5kZWZpbmVkPjtcblx0cHJpdmF0ZSByZWFkb25seSBfYWN0aXZlRWRpdG9yT2JzOiBJT2JzZXJ2YWJsZTxFZGl0b3JJbnB1dCB8IHVuZGVmaW5lZD47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2FjdGl2ZUVkaXRvclJlcG9zaXRvcnlPYnM6IElPYnNlcnZhYmxlPElTQ01SZXBvc2l0b3J5IHwgdW5kZWZpbmVkPjtcblxuXHQvKipcblx0ICogVGhlIGZvY3VzZWQgcmVwb3NpdG9yeSB0YWtlcyBwcmVjZWRlbmNlIG92ZXIgdGhlIGFjdGl2ZSBlZGl0b3IgcmVwb3NpdG9yeSB3aGVuIHRoZSBvYnNlcnZhYmxlXG5cdCAqIHZhbHVlcyBhcmUgdXBkYXRlZCBpbiB0aGUgc2FtZSB0cmFuc2FjdGlvbiAob3IgZHVyaW5nIHRoZSBpbml0aWFsIHJlYWQgb2YgdGhlIG9ic2VydmFibGUgdmFsdWUpLlxuXHQqL1xuXHRwcml2YXRlIHJlYWRvbmx5IF9hY3RpdmVSZXBvc2l0b3J5T2JzOiBJT2JzZXJ2YWJsZTxJU0NNUmVwb3NpdG9yeSB8IHVuZGVmaW5lZD47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2FjdGl2ZVJlcG9zaXRvcnlQaW5uZWRPYnM6IElTZXR0YWJsZU9ic2VydmFibGU8SVNDTVJlcG9zaXRvcnkgfCB1bmRlZmluZWQ+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9mb2N1c2VkUmVwb3NpdG9yeU9iczogSU9ic2VydmFibGU8SVNDTVJlcG9zaXRvcnkgfCB1bmRlZmluZWQ+O1xuXG5cdHByaXZhdGUgX3JlcG9zaXRvcmllc1NvcnRLZXk6IElTQ01SZXBvc2l0b3J5U29ydEtleTtcblx0cHJpdmF0ZSBfc29ydEtleUNvbnRleHRLZXk6IElDb250ZXh0S2V5PElTQ01SZXBvc2l0b3J5U29ydEtleT47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElTQ01TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc2NtU2VydmljZTogSVNDTVNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBleHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2Vcblx0KSB7XG5cdFx0dGhpcy5tZW51cyA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNDTU1lbnVzKTtcblxuXHRcdHRoaXMuX2ZvY3VzZWRSZXBvc2l0b3J5T2JzID0gb2JzZXJ2YWJsZUZyb21FdmVudE9wdHM8SVNDTVJlcG9zaXRvcnkgfCB1bmRlZmluZWQ+KFxuXHRcdFx0e1xuXHRcdFx0XHRvd25lcjogdGhpcyxcblx0XHRcdFx0ZXF1YWxzRm46ICgpID0+IGZhbHNlXG5cdFx0XHR9LCB0aGlzLm9uRGlkRm9jdXNSZXBvc2l0b3J5LFxuXHRcdFx0KCkgPT4gdGhpcy5mb2N1c2VkUmVwb3NpdG9yeSk7XG5cblx0XHR0aGlzLl9hY3RpdmVFZGl0b3JPYnMgPSBvYnNlcnZhYmxlRnJvbUV2ZW50T3B0cyhcblx0XHRcdHtcblx0XHRcdFx0b3duZXI6IHRoaXMsXG5cdFx0XHRcdGVxdWFsc0ZuOiAoKSA9PiBmYWxzZVxuXHRcdFx0fSwgdGhpcy5lZGl0b3JTZXJ2aWNlLm9uRGlkQWN0aXZlRWRpdG9yQ2hhbmdlLFxuXHRcdFx0KCkgPT4gdGhpcy5lZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvcik7XG5cblx0XHR0aGlzLl9hY3RpdmVFZGl0b3JSZXBvc2l0b3J5T2JzID0gZGVyaXZlZE9ic2VydmFibGVXaXRoQ2FjaGU8SVNDTVJlcG9zaXRvcnkgfCB1bmRlZmluZWQ+KHRoaXMsXG5cdFx0XHQocmVhZGVyLCBsYXN0VmFsdWUpID0+IHtcblx0XHRcdFx0Y29uc3QgYWN0aXZlRWRpdG9yID0gdGhpcy5fYWN0aXZlRWRpdG9yT2JzLnJlYWQocmVhZGVyKTtcblx0XHRcdFx0Y29uc3QgYWN0aXZlUmVzb3VyY2UgPSBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLmdldE9yaWdpbmFsVXJpKGFjdGl2ZUVkaXRvcik7XG5cdFx0XHRcdGlmICghYWN0aXZlUmVzb3VyY2UpIHtcblx0XHRcdFx0XHRyZXR1cm4gbGFzdFZhbHVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgcmVwb3NpdG9yeSA9IHRoaXMuc2NtU2VydmljZS5nZXRSZXBvc2l0b3J5KGFjdGl2ZVJlc291cmNlKTtcblx0XHRcdFx0aWYgKCFyZXBvc2l0b3J5KSB7XG5cdFx0XHRcdFx0cmV0dXJuIGxhc3RWYWx1ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBPYmplY3QuY3JlYXRlKHJlcG9zaXRvcnkpO1xuXHRcdFx0fSk7XG5cblx0XHR0aGlzLl9hY3RpdmVSZXBvc2l0b3J5UGlubmVkT2JzID0gb2JzZXJ2YWJsZVZhbHVlPElTQ01SZXBvc2l0b3J5IHwgdW5kZWZpbmVkPih0aGlzLCB1bmRlZmluZWQpO1xuXHRcdHRoaXMuX2FjdGl2ZVJlcG9zaXRvcnlPYnMgPSBsYXRlc3RDaGFuZ2VkVmFsdWUodGhpcywgW3RoaXMuX2FjdGl2ZUVkaXRvclJlcG9zaXRvcnlPYnMsIHRoaXMuX2ZvY3VzZWRSZXBvc2l0b3J5T2JzXSk7XG5cblx0XHR0aGlzLmFjdGl2ZVJlcG9zaXRvcnkgPSBkZXJpdmVkT3B0czxJU0NNUmVwb3NpdG9yeSB8IHVuZGVmaW5lZD4oe1xuXHRcdFx0b3duZXI6IHRoaXMsXG5cdFx0XHRlcXVhbHNGbjogKHIxLCByMikgPT4gcjE/LmlkID09PSByMj8uaWRcblx0XHR9LCByZWFkZXIgPT4ge1xuXHRcdFx0Y29uc3QgYWN0aXZlUmVwb3NpdG9yeSA9IHRoaXMuX2FjdGl2ZVJlcG9zaXRvcnlPYnMucmVhZChyZWFkZXIpO1xuXHRcdFx0Y29uc3QgYWN0aXZlUmVwb3NpdG9yeVBpbm5lZCA9IHRoaXMuX2FjdGl2ZVJlcG9zaXRvcnlQaW5uZWRPYnMucmVhZChyZWFkZXIpO1xuXG5cdFx0XHRyZXR1cm4gYWN0aXZlUmVwb3NpdG9yeVBpbm5lZCA/PyBhY3RpdmVSZXBvc2l0b3J5O1xuXHRcdH0pO1xuXG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMucHJldmlvdXNTdGF0ZSA9IEpTT04ucGFyc2Uoc3RvcmFnZVNlcnZpY2UuZ2V0KCdzY206dmlldzp2aXNpYmxlUmVwb3NpdG9yaWVzJywgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgJycpKTtcblx0XHR9IGNhdGNoIHtcblx0XHRcdC8vIG5vb3Bcblx0XHR9XG5cblx0XHR0aGlzLl9yZXBvc2l0b3JpZXNTb3J0S2V5ID0gdGhpcy5wcmV2aW91c1N0YXRlPy5zb3J0S2V5ID8/IHRoaXMuZ2V0Vmlld1NvcnRPcmRlcigpO1xuXHRcdHRoaXMuX3NvcnRLZXlDb250ZXh0S2V5ID0gUmVwb3NpdG9yeUNvbnRleHRLZXlzLlJlcG9zaXRvcnlTb3J0S2V5LmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5fc29ydEtleUNvbnRleHRLZXkuc2V0KHRoaXMuX3JlcG9zaXRvcmllc1NvcnRLZXkpO1xuXG5cdFx0c2NtU2VydmljZS5vbkRpZEFkZFJlcG9zaXRvcnkodGhpcy5vbkRpZEFkZFJlcG9zaXRvcnksIHRoaXMsIHRoaXMuZGlzcG9zYWJsZXMpO1xuXHRcdHNjbVNlcnZpY2Uub25EaWRSZW1vdmVSZXBvc2l0b3J5KHRoaXMub25EaWRSZW1vdmVSZXBvc2l0b3J5LCB0aGlzLCB0aGlzLmRpc3Bvc2FibGVzKTtcblxuXHRcdGZvciAoY29uc3QgcmVwb3NpdG9yeSBvZiBzY21TZXJ2aWNlLnJlcG9zaXRvcmllcykge1xuXHRcdFx0dGhpcy5vbkRpZEFkZFJlcG9zaXRvcnkocmVwb3NpdG9yeSk7XG5cdFx0fVxuXG5cdFx0c3RvcmFnZVNlcnZpY2Uub25XaWxsU2F2ZVN0YXRlKHRoaXMub25XaWxsU2F2ZVN0YXRlLCB0aGlzLCB0aGlzLmRpc3Bvc2FibGVzKTtcblxuXHRcdC8vIE1haW50YWluIHJlcG9zaXRvcnkgc2VsZWN0aW9uIHdoZW4gdGhlIGV4dGVuc2lvbiBob3N0IHJlc3RhcnRzLlxuXHRcdC8vIEV4dGVuc2lvbiBob3N0IGlzIHJlc3RhcnRlZCBhZnRlciBpbnN0YWxsaW5nIGFuIGV4dGVuc2lvbiB1cGRhdGVcblx0XHQvLyBvciBkdXJpbmcgYSBwcm9maWxlIHN3aXRjaC5cblx0XHRleHRlbnNpb25TZXJ2aWNlLm9uV2lsbFN0b3AoKCkgPT4ge1xuXHRcdFx0dGhpcy5vbldpbGxTYXZlU3RhdGUoKTtcblx0XHRcdHRoaXMuZGlkRmluaXNoTG9hZGluZyA9IGZhbHNlO1xuXHRcdH0sIHRoaXMsIHRoaXMuZGlzcG9zYWJsZXMpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZEFkZFJlcG9zaXRvcnkocmVwb3NpdG9yeTogSVNDTVJlcG9zaXRvcnkpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuZGlkRmluaXNoTG9hZGluZykge1xuXHRcdFx0dGhpcy5ldmVudHVhbGx5RmluaXNoTG9hZGluZygpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlcG9zaXRvcnlWaWV3OiBJU0NNUmVwb3NpdG9yeVZpZXcgPSB7XG5cdFx0XHRyZXBvc2l0b3J5LCBkaXNjb3ZlcnlUaW1lOiBEYXRlLm5vdygpLCBmb2N1c2VkOiBmYWxzZSwgc2VsZWN0aW9uSW5kZXg6IC0xXG5cdFx0fTtcblxuXHRcdGxldCByZW1vdmVkOiBJdGVyYWJsZTxJU0NNUmVwb3NpdG9yeT4gPSBJdGVyYWJsZS5lbXB0eSgpO1xuXG5cdFx0aWYgKHRoaXMucHJldmlvdXNTdGF0ZSAmJiAhdGhpcy5kaWRGaW5pc2hMb2FkaW5nKSB7XG5cdFx0XHRjb25zdCBpbmRleCA9IHRoaXMucHJldmlvdXNTdGF0ZS5hbGwuaW5kZXhPZihnZXRQcm92aWRlclN0b3JhZ2VLZXkocmVwb3NpdG9yeS5wcm92aWRlcikpO1xuXG5cdFx0XHRpZiAoaW5kZXggPT09IC0xKSB7XG5cdFx0XHRcdC8vIFRoaXMgcmVwb3NpdG9yeSBpcyBub3QgcGFydCBvZiB0aGUgcHJldmlvdXMgc3RhdGUgd2hpY2ggbWVhbnMgdGhhdCBpdFxuXHRcdFx0XHQvLyB3YXMgZWl0aGVyIG1hbnVhbGx5IGNsb3NlZCBpbiB0aGUgcHJldmlvdXMgc2Vzc2lvbiwgb3IgdGhlIHJlcG9zaXRvcnlcblx0XHRcdFx0Ly8gd2FzIGFkZGVkIGFmdGVyIHRoZSBwcmV2aW91cyBzZXNzaW9uLkluIHRoaXMgY2FzZSwgd2Ugc2hvdWxkIHNlbGVjdCBhbGxcblx0XHRcdFx0Ly8gb2YgdGhlIHJlcG9zaXRvcmllcy5cblx0XHRcdFx0Y29uc3QgYWRkZWQ6IElTQ01SZXBvc2l0b3J5W10gPSBbXTtcblxuXHRcdFx0XHR0aGlzLmluc2VydFJlcG9zaXRvcnlWaWV3KHRoaXMuX3JlcG9zaXRvcmllcywgcmVwb3NpdG9yeVZpZXcpO1xuXHRcdFx0XHR0aGlzLl9yZXBvc2l0b3JpZXMuZm9yRWFjaCgocmVwb3NpdG9yeVZpZXcsIGluZGV4KSA9PiB7XG5cdFx0XHRcdFx0aWYgKHJlcG9zaXRvcnlWaWV3LnNlbGVjdGlvbkluZGV4ID09PSAtMSkge1xuXHRcdFx0XHRcdFx0YWRkZWQucHVzaChyZXBvc2l0b3J5Vmlldy5yZXBvc2l0b3J5KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmVwb3NpdG9yeVZpZXcuc2VsZWN0aW9uSW5kZXggPSBpbmRleDtcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VSZXBvc2l0b3JpZXMuZmlyZSh7IGFkZGVkLCByZW1vdmVkOiBJdGVyYWJsZS5lbXB0eSgpIH0pO1xuXHRcdFx0XHR0aGlzLmRpZFNlbGVjdFJlcG9zaXRvcnkgPSBmYWxzZTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5wcmV2aW91c1N0YXRlLnZpc2libGUuaW5kZXhPZihpbmRleCkgPT09IC0xKSB7XG5cdFx0XHRcdC8vIEV4cGxpY2l0IHNlbGVjdGlvbiBzdGFydGVkXG5cdFx0XHRcdGlmICh0aGlzLmRpZFNlbGVjdFJlcG9zaXRvcnkpIHtcblx0XHRcdFx0XHR0aGlzLmluc2VydFJlcG9zaXRvcnlWaWV3KHRoaXMuX3JlcG9zaXRvcmllcywgcmVwb3NpdG9yeVZpZXcpO1xuXHRcdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlUmVwb3NpdG9yaWVzLmZpcmUoeyBhZGRlZDogSXRlcmFibGUuZW1wdHkoKSwgcmVtb3ZlZDogSXRlcmFibGUuZW1wdHkoKSB9KTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIEZpcnN0IHZpc2libGUgcmVwb3NpdG9yeVxuXHRcdFx0XHRpZiAoIXRoaXMuZGlkU2VsZWN0UmVwb3NpdG9yeSkge1xuXHRcdFx0XHRcdHJlbW92ZWQgPSBbLi4udGhpcy52aXNpYmxlUmVwb3NpdG9yaWVzXTtcblx0XHRcdFx0XHR0aGlzLl9yZXBvc2l0b3JpZXMuZm9yRWFjaChyID0+IHtcblx0XHRcdFx0XHRcdHIuZm9jdXNlZCA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0ci5zZWxlY3Rpb25JbmRleCA9IC0xO1xuXHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0dGhpcy5kaWRTZWxlY3RSZXBvc2l0b3J5ID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IG1heFNlbGVjdGlvbkluZGV4ID0gdGhpcy5nZXRNYXhTZWxlY3Rpb25JbmRleCgpO1xuXHRcdHRoaXMuaW5zZXJ0UmVwb3NpdG9yeVZpZXcodGhpcy5fcmVwb3NpdG9yaWVzLCB7IC4uLnJlcG9zaXRvcnlWaWV3LCBzZWxlY3Rpb25JbmRleDogbWF4U2VsZWN0aW9uSW5kZXggKyAxIH0pO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlUmVwb3NpdG9yaWVzLmZpcmUoeyBhZGRlZDogW3JlcG9zaXRvcnlWaWV3LnJlcG9zaXRvcnldLCByZW1vdmVkIH0pO1xuXG5cdFx0aWYgKCF0aGlzLl9yZXBvc2l0b3JpZXMuZmluZChyID0+IHIuZm9jdXNlZCkpIHtcblx0XHRcdHRoaXMuZm9jdXMocmVwb3NpdG9yeSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZFJlbW92ZVJlcG9zaXRvcnkocmVwb3NpdG9yeTogSVNDTVJlcG9zaXRvcnkpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuZGlkRmluaXNoTG9hZGluZykge1xuXHRcdFx0dGhpcy5ldmVudHVhbGx5RmluaXNoTG9hZGluZygpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlcG9zaXRvcmllc0luZGV4ID0gdGhpcy5fcmVwb3NpdG9yaWVzLmZpbmRJbmRleChyID0+IHIucmVwb3NpdG9yeSA9PT0gcmVwb3NpdG9yeSk7XG5cblx0XHRpZiAocmVwb3NpdG9yaWVzSW5kZXggPT09IC0xKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bGV0IGFkZGVkOiBJdGVyYWJsZTxJU0NNUmVwb3NpdG9yeT4gPSBJdGVyYWJsZS5lbXB0eSgpO1xuXHRcdGNvbnN0IHJlcG9zaXRvcnlWaWV3ID0gdGhpcy5fcmVwb3NpdG9yaWVzLnNwbGljZShyZXBvc2l0b3JpZXNJbmRleCwgMSk7XG5cblx0XHRpZiAodGhpcy5fcmVwb3NpdG9yaWVzLmxlbmd0aCA+IDAgJiYgdGhpcy52aXNpYmxlUmVwb3NpdG9yaWVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0dGhpcy5fcmVwb3NpdG9yaWVzWzBdLnNlbGVjdGlvbkluZGV4ID0gMDtcblx0XHRcdGFkZGVkID0gW3RoaXMuX3JlcG9zaXRvcmllc1swXS5yZXBvc2l0b3J5XTtcblx0XHR9XG5cblx0XHR0aGlzLl9vbkRpZENoYW5nZVJlcG9zaXRvcmllcy5maXJlKHsgYWRkZWQsIHJlbW92ZWQ6IHJlcG9zaXRvcnlWaWV3Lm1hcChyID0+IHIucmVwb3NpdG9yeSkgfSk7XG5cblx0XHRpZiAocmVwb3NpdG9yeVZpZXcubGVuZ3RoID09PSAxICYmIHJlcG9zaXRvcnlWaWV3WzBdLmZvY3VzZWQgJiYgdGhpcy52aXNpYmxlUmVwb3NpdG9yaWVzLmxlbmd0aCA+IDApIHtcblx0XHRcdHRoaXMuZm9jdXModGhpcy52aXNpYmxlUmVwb3NpdG9yaWVzWzBdKTtcblx0XHR9XG5cdH1cblxuXHRpc1Zpc2libGUocmVwb3NpdG9yeTogSVNDTVJlcG9zaXRvcnkpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fcmVwb3NpdG9yaWVzLmZpbmQociA9PiByLnJlcG9zaXRvcnkgPT09IHJlcG9zaXRvcnkpPy5zZWxlY3Rpb25JbmRleCAhPT0gLTE7XG5cdH1cblxuXHR0b2dnbGVWaXNpYmlsaXR5KHJlcG9zaXRvcnk6IElTQ01SZXBvc2l0b3J5LCB2aXNpYmxlPzogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICh0eXBlb2YgdmlzaWJsZSA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdHZpc2libGUgPSAhdGhpcy5pc1Zpc2libGUocmVwb3NpdG9yeSk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLmlzVmlzaWJsZShyZXBvc2l0b3J5KSA9PT0gdmlzaWJsZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh2aXNpYmxlKSB7XG5cdFx0XHR0aGlzLnZpc2libGVSZXBvc2l0b3JpZXMgPSBbLi4udGhpcy52aXNpYmxlUmVwb3NpdG9yaWVzLCByZXBvc2l0b3J5XTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgaW5kZXggPSB0aGlzLnZpc2libGVSZXBvc2l0b3JpZXMuaW5kZXhPZihyZXBvc2l0b3J5KTtcblxuXHRcdFx0aWYgKGluZGV4ID4gLTEpIHtcblx0XHRcdFx0dGhpcy52aXNpYmxlUmVwb3NpdG9yaWVzID0gW1xuXHRcdFx0XHRcdC4uLnRoaXMudmlzaWJsZVJlcG9zaXRvcmllcy5zbGljZSgwLCBpbmRleCksXG5cdFx0XHRcdFx0Li4udGhpcy52aXNpYmxlUmVwb3NpdG9yaWVzLnNsaWNlKGluZGV4ICsgMSlcblx0XHRcdFx0XTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHR0b2dnbGVTb3J0S2V5KHNvcnRLZXk6IElTQ01SZXBvc2l0b3J5U29ydEtleSk6IHZvaWQge1xuXHRcdHRoaXMuX3JlcG9zaXRvcmllc1NvcnRLZXkgPSBzb3J0S2V5O1xuXHRcdHRoaXMuX3NvcnRLZXlDb250ZXh0S2V5LnNldCh0aGlzLl9yZXBvc2l0b3JpZXNTb3J0S2V5KTtcblx0XHR0aGlzLl9yZXBvc2l0b3JpZXMuc29ydCh0aGlzLmNvbXBhcmVSZXBvc2l0b3JpZXMuYmluZCh0aGlzKSk7XG5cblx0XHR0aGlzLl9vbkRpZENoYW5nZVJlcG9zaXRvcmllcy5maXJlKHsgYWRkZWQ6IEl0ZXJhYmxlLmVtcHR5KCksIHJlbW92ZWQ6IEl0ZXJhYmxlLmVtcHR5KCkgfSk7XG5cdH1cblxuXHRmb2N1cyhyZXBvc2l0b3J5OiBJU0NNUmVwb3NpdG9yeSB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGlmIChyZXBvc2l0b3J5ICYmICF0aGlzLmlzVmlzaWJsZShyZXBvc2l0b3J5KSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX3JlcG9zaXRvcmllcy5mb3JFYWNoKHIgPT4gci5mb2N1c2VkID0gci5yZXBvc2l0b3J5ID09PSByZXBvc2l0b3J5KTtcblxuXHRcdGlmICh0aGlzLl9yZXBvc2l0b3JpZXMuZmluZChyID0+IHIuZm9jdXNlZCkpIHtcblx0XHRcdHRoaXMuX29uRGlkRm9jdXNSZXBvc2l0b3J5LmZpcmUocmVwb3NpdG9yeSk7XG5cdFx0fVxuXHR9XG5cblx0cGluQWN0aXZlUmVwb3NpdG9yeShyZXBvc2l0b3J5OiBJU0NNUmVwb3NpdG9yeSB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMuX2FjdGl2ZVJlcG9zaXRvcnlQaW5uZWRPYnMuc2V0KHJlcG9zaXRvcnksIHVuZGVmaW5lZCk7XG5cdH1cblxuXHRwcml2YXRlIGNvbXBhcmVSZXBvc2l0b3JpZXMob3AxOiBJU0NNUmVwb3NpdG9yeVZpZXcsIG9wMjogSVNDTVJlcG9zaXRvcnlWaWV3KTogbnVtYmVyIHtcblx0XHQvLyBTb3J0IGJ5IGRpc2NvdmVyeSB0aW1lXG5cdFx0aWYgKHRoaXMuX3JlcG9zaXRvcmllc1NvcnRLZXkgPT09IElTQ01SZXBvc2l0b3J5U29ydEtleS5EaXNjb3ZlcnlUaW1lKSB7XG5cdFx0XHRyZXR1cm4gb3AxLmRpc2NvdmVyeVRpbWUgLSBvcDIuZGlzY292ZXJ5VGltZTtcblx0XHR9XG5cblx0XHQvLyBTb3J0IGJ5IHBhdGhcblx0XHRpZiAodGhpcy5fcmVwb3NpdG9yaWVzU29ydEtleSA9PT0gJ3BhdGgnICYmIG9wMS5yZXBvc2l0b3J5LnByb3ZpZGVyLnJvb3RVcmkgJiYgb3AyLnJlcG9zaXRvcnkucHJvdmlkZXIucm9vdFVyaSkge1xuXHRcdFx0cmV0dXJuIGNvbXBhcmVQYXRocyhvcDEucmVwb3NpdG9yeS5wcm92aWRlci5yb290VXJpLmZzUGF0aCwgb3AyLnJlcG9zaXRvcnkucHJvdmlkZXIucm9vdFVyaS5mc1BhdGgpO1xuXHRcdH1cblxuXHRcdC8vIFNvcnQgYnkgbmFtZSwgcGF0aFxuXHRcdGNvbnN0IG5hbWUxID0gZ2V0UmVwb3NpdG9yeU5hbWUodGhpcy53b3Jrc3BhY2VDb250ZXh0U2VydmljZSwgb3AxLnJlcG9zaXRvcnkpO1xuXHRcdGNvbnN0IG5hbWUyID0gZ2V0UmVwb3NpdG9yeU5hbWUodGhpcy53b3Jrc3BhY2VDb250ZXh0U2VydmljZSwgb3AyLnJlcG9zaXRvcnkpO1xuXG5cdFx0Y29uc3QgbmFtZUNvbXBhcmlzb24gPSBjb21wYXJlRmlsZU5hbWVzKG5hbWUxLCBuYW1lMik7XG5cdFx0aWYgKG5hbWVDb21wYXJpc29uID09PSAwICYmIG9wMS5yZXBvc2l0b3J5LnByb3ZpZGVyLnJvb3RVcmkgJiYgb3AyLnJlcG9zaXRvcnkucHJvdmlkZXIucm9vdFVyaSkge1xuXHRcdFx0cmV0dXJuIGNvbXBhcmVQYXRocyhvcDEucmVwb3NpdG9yeS5wcm92aWRlci5yb290VXJpLmZzUGF0aCwgb3AyLnJlcG9zaXRvcnkucHJvdmlkZXIucm9vdFVyaS5mc1BhdGgpO1xuXHRcdH1cblxuXHRcdHJldHVybiBuYW1lQ29tcGFyaXNvbjtcblx0fVxuXG5cdHByaXZhdGUgZ2V0TWF4U2VsZWN0aW9uSW5kZXgoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fcmVwb3NpdG9yaWVzLmxlbmd0aCA9PT0gMCA/IC0xIDpcblx0XHRcdE1hdGgubWF4KC4uLnRoaXMuX3JlcG9zaXRvcmllcy5tYXAociA9PiByLnNlbGVjdGlvbkluZGV4KSk7XG5cdH1cblxuXHRwcml2YXRlIGdldFZpZXdTb3J0T3JkZXIoKTogSVNDTVJlcG9zaXRvcnlTb3J0S2V5IHtcblx0XHRjb25zdCBzb3J0T2RlciA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8J2Rpc2NvdmVyeSB0aW1lJyB8ICduYW1lJyB8ICdwYXRoJz4oJ3NjbS5yZXBvc2l0b3JpZXMuc29ydE9yZGVyJyk7XG5cdFx0c3dpdGNoIChzb3J0T2Rlcikge1xuXHRcdFx0Y2FzZSAnZGlzY292ZXJ5IHRpbWUnOlxuXHRcdFx0XHRyZXR1cm4gSVNDTVJlcG9zaXRvcnlTb3J0S2V5LkRpc2NvdmVyeVRpbWU7XG5cdFx0XHRjYXNlICduYW1lJzpcblx0XHRcdFx0cmV0dXJuIElTQ01SZXBvc2l0b3J5U29ydEtleS5OYW1lO1xuXHRcdFx0Y2FzZSAncGF0aCc6XG5cdFx0XHRcdHJldHVybiBJU0NNUmVwb3NpdG9yeVNvcnRLZXkuUGF0aDtcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiBJU0NNUmVwb3NpdG9yeVNvcnRLZXkuRGlzY292ZXJ5VGltZTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGluc2VydFJlcG9zaXRvcnlWaWV3KHJlcG9zaXRvcmllczogSVNDTVJlcG9zaXRvcnlWaWV3W10sIHJlcG9zaXRvcnlWaWV3OiBJU0NNUmVwb3NpdG9yeVZpZXcpOiB2b2lkIHtcblx0XHRjb25zdCBpbmRleCA9IGJpbmFyeVNlYXJjaChyZXBvc2l0b3JpZXMsIHJlcG9zaXRvcnlWaWV3LCB0aGlzLmNvbXBhcmVSZXBvc2l0b3JpZXMuYmluZCh0aGlzKSk7XG5cdFx0cmVwb3NpdG9yaWVzLnNwbGljZShpbmRleCA8IDAgPyB+aW5kZXggOiBpbmRleCwgMCwgcmVwb3NpdG9yeVZpZXcpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbldpbGxTYXZlU3RhdGUoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmRpZEZpbmlzaExvYWRpbmcpIHsgLy8gZG9uJ3QgcmVtZW1iZXIgc3RhdGUsIGlmIHRoZSB3b3JrYmVuY2ggZGlkbid0IHJlYWxseSBmaW5pc2ggbG9hZGluZ1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFsbCA9IHRoaXMucmVwb3NpdG9yaWVzLm1hcChyID0+IGdldFByb3ZpZGVyU3RvcmFnZUtleShyLnByb3ZpZGVyKSk7XG5cdFx0Y29uc3QgdmlzaWJsZSA9IHRoaXMudmlzaWJsZVJlcG9zaXRvcmllcy5tYXAociA9PiBhbGwuaW5kZXhPZihnZXRQcm92aWRlclN0b3JhZ2VLZXkoci5wcm92aWRlcikpKTtcblx0XHR0aGlzLnByZXZpb3VzU3RhdGUgPSB7IGFsbCwgc29ydEtleTogdGhpcy5fcmVwb3NpdG9yaWVzU29ydEtleSwgdmlzaWJsZSB9O1xuXG5cdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZSgnc2NtOnZpZXc6dmlzaWJsZVJlcG9zaXRvcmllcycsIEpTT04uc3RyaW5naWZ5KHRoaXMucHJldmlvdXNTdGF0ZSksIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdH1cblxuXHRAZGVib3VuY2UoNTAwMClcblx0cHJpdmF0ZSBldmVudHVhbGx5RmluaXNoTG9hZGluZygpOiB2b2lkIHtcblx0XHR0aGlzLmZpbmlzaExvYWRpbmcoKTtcblx0fVxuXG5cdHByaXZhdGUgZmluaXNoTG9hZGluZygpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5kaWRGaW5pc2hMb2FkaW5nKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5kaWRGaW5pc2hMb2FkaW5nID0gdHJ1ZTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VSZXBvc2l0b3JpZXMuZGlzcG9zZSgpO1xuXHRc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
