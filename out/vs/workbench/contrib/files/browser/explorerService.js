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
import { Event } from "../../../../base/common/event.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { SortOrder, LexicographicOptions } from "../common/files.js";
import { ExplorerItem, ExplorerModel } from "../common/explorerModel.js";
import { FileOperation, IFileService, FileChangeType } from "../../../../platform/files/common/files.js";
import { dirname, basename } from "../../../../base/common/resources.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IBulkEditService } from "../../../../editor/browser/services/bulkEditService.js";
import { UndoRedoSource } from "../../../../platform/undoRedo/common/undoRedo.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { ResourceGlobMatcher } from "../../../common/resources.js";
import { IFilesConfigurationService } from "../../../services/filesConfiguration/common/filesConfigurationService.js";
const UNDO_REDO_SOURCE = new UndoRedoSource();
let ExplorerService = class {
  constructor(fileService, configurationService, contextService, clipboardService, editorService, uriIdentityService, bulkEditService, progressService, hostService, filesConfigurationService) {
    this.fileService = fileService;
    this.configurationService = configurationService;
    this.contextService = contextService;
    this.clipboardService = clipboardService;
    this.editorService = editorService;
    this.uriIdentityService = uriIdentityService;
    this.bulkEditService = bulkEditService;
    this.progressService = progressService;
    this.filesConfigurationService = filesConfigurationService;
    // delay in ms to react to file changes to give our internal events a chance to react first
    this.disposables = new DisposableStore();
    this.fileChangeEvents = [];
    this.config = this.configurationService.getValue("explorer");
    this.model = new ExplorerModel(this.contextService, this.uriIdentityService, this.fileService, this.configurationService, this.filesConfigurationService);
    this.disposables.add(this.model);
    this.disposables.add(this.fileService.onDidRunOperation((e) => this.onDidRunOperation(e)));
    this.onFileChangesScheduler = new RunOnceScheduler(async () => {
      const events = this.fileChangeEvents;
      this.fileChangeEvents = [];
      const types = [FileChangeType.DELETED];
      if (this.config.sortOrder === SortOrder.Modified) {
        types.push(FileChangeType.UPDATED);
      }
      let shouldRefresh = false;
      this.roots.forEach((r) => {
        if (this.view && !shouldRefresh) {
          shouldRefresh = doesFileEventAffect(r, this.view, events, types);
        }
      });
      events.forEach((e) => {
        if (!shouldRefresh) {
          for (const resource of e.rawAdded) {
            const parent = this.model.findClosest(dirname(resource));
            if (parent && !parent.getChild(basename(resource))) {
              shouldRefresh = true;
              break;
            }
          }
        }
      });
      if (shouldRefresh) {
        await this.refresh(false);
      }
    }, ExplorerService.EXPLORER_FILE_CHANGES_REACT_DELAY);
    this.disposables.add(this.fileService.onDidFilesChange((e) => {
      this.fileChangeEvents.push(e);
      if (this.editable) {
        return;
      }
      if (!this.onFileChangesScheduler.isScheduled()) {
        this.onFileChangesScheduler.schedule();
      }
    }));
    this.disposables.add(this.configurationService.onDidChangeConfiguration((e) => this.onConfigurationUpdated(e)));
    this.disposables.add(Event.any(this.fileService.onDidChangeFileSystemProviderRegistrations, this.fileService.onDidChangeFileSystemProviderCapabilities)(async (e) => {
      let affected = false;
      this.model.roots.forEach((r) => {
        if (r.resource.scheme === e.scheme) {
          affected = true;
          r.forgetChildren();
        }
      });
      if (affected) {
        if (this.view) {
          await this.view.setTreeInput();
        }
      }
    }));
    this.disposables.add(this.model.onDidChangeRoots(() => {
      this.view?.setTreeInput();
    }));
    this.disposables.add(hostService.onDidChangeFocus((hasFocus) => {
      if (hasFocus) {
        this.refresh(false);
      }
    }));
    this.revealExcludeMatcher = new ResourceGlobMatcher(
      (uri) => getRevealExcludes(configurationService.getValue({ resource: uri })),
      (event) => event.affectsConfiguration("explorer.autoRevealExclude"),
      contextService,
      configurationService
    );
    this.disposables.add(this.revealExcludeMatcher);
  }
  get roots() {
    return this.model.roots;
  }
  get sortOrderConfiguration() {
    return {
      sortOrder: this.config.sortOrder,
      lexicographicOptions: this.config.sortOrderLexicographicOptions,
      reverse: this.config.sortOrderReverse
    };
  }
  registerView(contextProvider) {
    this.view = contextProvider;
  }
  getContext(respectMultiSelection, ignoreNestedChildren = false) {
    if (!this.view) {
      return [];
    }
    const items = new Set(this.view.getContext(respectMultiSelection));
    items.forEach((item) => {
      try {
        if (respectMultiSelection && !ignoreNestedChildren && this.view?.isItemCollapsed(item) && item.nestedChildren) {
          for (const child of item.nestedChildren) {
            items.add(child);
          }
        }
      } catch {
        return;
      }
    });
    return [...items];
  }
  async applyBulkEdit(edit, options) {
    const cancellationTokenSource = new CancellationTokenSource();
    const location = options.progressLocation ?? ProgressLocation.Window;
    let progressOptions;
    if (location === ProgressLocation.Window) {
      progressOptions = {
        location,
        title: options.progressLabel,
        cancellable: edit.length > 1
      };
    } else {
      progressOptions = {
        location,
        title: options.progressLabel,
        cancellable: edit.length > 1,
        delay: 500
      };
    }
    const promise = this.progressService.withProgress(progressOptions, async (progress) => {
      await this.bulkEditService.apply(edit, {
        undoRedoSource: UNDO_REDO_SOURCE,
        label: options.undoLabel,
        code: "undoredo.explorerOperation",
        progress,
        token: cancellationTokenSource.token,
        confirmBeforeUndo: options.confirmBeforeUndo
      });
    }, () => cancellationTokenSource.cancel());
    await this.progressService.withProgress({ location: ProgressLocation.Explorer, delay: 500 }, () => promise);
    cancellationTokenSource.dispose();
  }
  hasViewFocus() {
    return !!this.view && this.view.hasFocus();
  }
  // IExplorerService methods
  findClosest(resource) {
    return this.model.findClosest(resource);
  }
  findClosestRoot(resource) {
    const parentRoots = this.model.roots.filter((r) => this.uriIdentityService.extUri.isEqualOrParent(resource, r.resource)).sort((first, second) => second.resource.path.length - first.resource.path.length);
    return parentRoots.length ? parentRoots[0] : null;
  }
  async setEditable(stat, data) {
    if (!this.view) {
      return;
    }
    if (!data) {
      this.editable = void 0;
    } else {
      this.editable = { stat, data };
    }
    const isEditing = this.isEditable(stat);
    try {
      await this.view.setEditable(stat, isEditing);
    } catch {
      return;
    }
    if (!this.editable && this.fileChangeEvents.length && !this.onFileChangesScheduler.isScheduled()) {
      this.onFileChangesScheduler.schedule();
    }
  }
  async setToCopy(items, cut) {
    const previouslyCutItems = this.cutItems;
    this.cutItems = cut ? items : void 0;
    await this.clipboardService.writeResources(items.map((s) => s.resource));
    this.view?.itemsCopied(items, cut, previouslyCutItems);
  }
  isCut(item) {
    return !!this.cutItems && this.cutItems.some((i) => this.uriIdentityService.extUri.isEqual(i.resource, item.resource));
  }
  getEditable() {
    return this.editable;
  }
  getEditableData(stat) {
    return this.editable && this.editable.stat === stat ? this.editable.data : void 0;
  }
  isEditable(stat) {
    return !!this.editable && (this.editable.stat === stat || !stat);
  }
  async select(resource, reveal) {
    if (!this.view) {
      return;
    }
    const ignoreRevealExcludes = reveal === "force";
    const fileStat = this.findClosest(resource);
    if (fileStat) {
      if (!this.shouldAutoRevealItem(fileStat, ignoreRevealExcludes)) {
        return;
      }
      await this.view.selectResource(fileStat.resource, reveal);
      return Promise.resolve(void 0);
    }
    const options = { resolveTo: [resource], resolveMetadata: this.config.sortOrder === SortOrder.Modified };
    const root = this.findClosestRoot(resource);
    if (!root) {
      return void 0;
    }
    try {
      const stat = await this.fileService.resolve(root.resource, options);
      const modelStat = ExplorerItem.create(this.fileService, this.configurationService, this.filesConfigurationService, stat, void 0, options.resolveTo);
      ExplorerItem.mergeLocalWithDisk(modelStat, root);
      const item = root.find(resource);
      await this.view.refresh(true, root);
      if (item && !this.shouldAutoRevealItem(item, ignoreRevealExcludes)) {
        return;
      }
      await this.view.selectResource(item ? item.resource : void 0, reveal);
    } catch (error) {
      root.error = error;
      await this.view.refresh(false, root);
    }
  }
  async refresh(reveal = true) {
    if (this.view?.hasPhantomElements()) {
      return;
    }
    this.model.roots.forEach((r) => r.forgetChildren());
    if (this.view) {
      await this.view.refresh(true);
      const resource = this.editorService.activeEditor?.resource;
      const autoReveal = this.configurationService.getValue().explorer.autoReveal;
      if (reveal && resource && autoReveal) {
        this.select(resource, autoReveal);
      }
    }
  }
  // File events
  async onDidRunOperation(e) {
    const shouldDeepRefresh = this.config.fileNesting.enabled;
    if (e.isOperation(FileOperation.CREATE) || e.isOperation(FileOperation.COPY)) {
      const addedElement = e.target;
      const parentResource = dirname(addedElement.resource);
      const parents = this.model.findAll(parentResource);
      if (parents.length) {
        await Promise.all(parents.map(async (p) => {
          const resolveMetadata = this.config.sortOrder === `modified`;
          if (!p.isDirectoryResolved) {
            const stat = await this.fileService.resolve(p.resource, { resolveMetadata });
            if (stat) {
              const modelStat = ExplorerItem.create(this.fileService, this.configurationService, this.filesConfigurationService, stat, p.parent);
              ExplorerItem.mergeLocalWithDisk(modelStat, p);
            }
          }
          const childElement = ExplorerItem.create(this.fileService, this.configurationService, this.filesConfigurationService, addedElement, p.parent);
          p.removeChild(childElement);
          p.addChild(childElement);
          await this.view?.refresh(shouldDeepRefresh, p);
        }));
      }
    } else if (e.isOperation(FileOperation.MOVE)) {
      const oldResource = e.resource;
      const newElement = e.target;
      const oldParentResource = dirname(oldResource);
      const newParentResource = dirname(newElement.resource);
      const modelElements = this.model.findAll(oldResource);
      const sameParentMove = modelElements.every((e2) => !e2.nestedParent) && this.uriIdentityService.extUri.isEqual(oldParentResource, newParentResource);
      if (sameParentMove) {
        await Promise.all(modelElements.map(async (modelElement) => {
          modelElement.rename(newElement);
          await this.view?.refresh(shouldDeepRefresh, modelElement.parent);
        }));
      } else {
        const newParents = this.model.findAll(newParentResource);
        if (newParents.length && modelElements.length) {
          await Promise.all(modelElements.map(async (modelElement, index) => {
            const oldParent = modelElement.parent;
            const oldNestedParent = modelElement.nestedParent;
            modelElement.move(newParents[index]);
            if (oldNestedParent) {
              await this.view?.refresh(false, oldNestedParent);
            }
            await this.view?.refresh(false, oldParent);
            await this.view?.refresh(shouldDeepRefresh, newParents[index]);
          }));
        }
      }
    } else if (e.isOperation(FileOperation.DELETE)) {
      const modelElements = this.model.findAll(e.resource);
      await Promise.all(modelElements.map(async (modelElement) => {
        if (modelElement.parent) {
          const parent = modelElement.parent;
          parent.removeChild(modelElement);
          this.view?.focusNext();
          const oldNestedParent = modelElement.nestedParent;
          if (oldNestedParent) {
            oldNestedParent.removeChild(modelElement);
            await this.view?.refresh(false, oldNestedParent);
          }
          await this.view?.refresh(shouldDeepRefresh, parent);
          if (this.view?.getFocus().length === 0) {
            this.view?.focusLast();
          }
        }
      }));
    }
  }
  // Check if an item matches a explorer.autoRevealExclude pattern
  shouldAutoRevealItem(item, ignore) {
    if (item === void 0 || ignore) {
      return true;
    }
    if (this.revealExcludeMatcher.matches(item.resource, (name) => !!(item.parent && item.parent.getChild(name)))) {
      return false;
    }
    const root = item.root;
    let currentItem = item.parent;
    while (currentItem !== root) {
      if (currentItem === void 0) {
        return true;
      }
      if (this.revealExcludeMatcher.matches(currentItem.resource)) {
        return false;
      }
      currentItem = currentItem.parent;
    }
    return true;
  }
  async onConfigurationUpdated(event) {
    if (!event.affectsConfiguration("explorer")) {
      return;
    }
    let shouldRefresh = false;
    if (event.affectsConfiguration("explorer.fileNesting")) {
      shouldRefresh = true;
    }
    const configuration = this.configurationService.getValue();
    const configSortOrder = configuration?.explorer?.sortOrder || SortOrder.Default;
    if (this.config.sortOrder !== configSortOrder) {
      shouldRefresh = this.config.sortOrder !== void 0;
    }
    const configLexicographicOptions = configuration?.explorer?.sortOrderLexicographicOptions || LexicographicOptions.Default;
    if (this.config.sortOrderLexicographicOptions !== configLexicographicOptions) {
      shouldRefresh = shouldRefresh || this.config.sortOrderLexicographicOptions !== void 0;
    }
    const sortOrderReverse = configuration?.explorer?.sortOrderReverse || false;
    if (this.config.sortOrderReverse !== sortOrderReverse) {
      shouldRefresh = shouldRefresh || this.config.sortOrderReverse !== void 0;
    }
    this.config = configuration.explorer;
    if (shouldRefresh) {
      await this.refresh();
    }
  }
  dispose() {
    this.disposables.dispose();
  }
};
ExplorerService.EXPLORER_FILE_CHANGES_REACT_DELAY = 500;
ExplorerService = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, IClipboardService),
  __decorateParam(4, IEditorService),
  __decorateParam(5, IUriIdentityService),
  __decorateParam(6, IBulkEditService),
  __decorateParam(7, IProgressService),
  __decorateParam(8, IHostService),
  __decorateParam(9, IFilesConfigurationService)
], ExplorerService);
function doesFileEventAffect(item, view, events, types) {
  for (const [_name, child] of item.children) {
    if (view.isItemVisible(child)) {
      if (events.some((e) => e.contains(child.resource, ...types))) {
        return true;
      }
      if (child.isDirectory && child.isDirectoryResolved) {
        if (doesFileEventAffect(child, view, events, types)) {
          return true;
        }
      }
    }
  }
  return false;
}
function getRevealExcludes(configuration) {
  const revealExcludes = configuration && configuration.explorer && configuration.explorer.autoRevealExclude;
  if (!revealExcludes) {
    return {};
  }
  return revealExcludes;
}
export {
  ExplorerService,
  UNDO_REDO_SOURCE
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9maWxlcy9icm93c2VyL2V4cGxvcmVyU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElGaWxlc0NvbmZpZ3VyYXRpb24sIElTb3J0T3JkZXJDb25maWd1cmF0aW9uLCBTb3J0T3JkZXIsIExleGljb2dyYXBoaWNPcHRpb25zIH0gZnJvbSAnLi4vY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IEV4cGxvcmVySXRlbSwgRXhwbG9yZXJNb2RlbCB9IGZyb20gJy4uL2NvbW1vbi9leHBsb3Jlck1vZGVsLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBGaWxlT3BlcmF0aW9uRXZlbnQsIEZpbGVPcGVyYXRpb24sIElGaWxlU2VydmljZSwgRmlsZUNoYW5nZXNFdmVudCwgRmlsZUNoYW5nZVR5cGUsIElSZXNvbHZlRmlsZU9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgZGlybmFtZSwgYmFzZW5hbWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBJQ29uZmlndXJhdGlvbkNoYW5nZUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ2xpcGJvYXJkU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NsaXBib2FyZC9jb21tb24vY2xpcGJvYXJkU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRWRpdGFibGVEYXRhIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgSUJ1bGtFZGl0U2VydmljZSwgUmVzb3VyY2VGaWxlRWRpdCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3NlcnZpY2VzL2J1bGtFZGl0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBVbmRvUmVkb1NvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VuZG9SZWRvL2NvbW1vbi91bmRvUmVkby5qcyc7XG5pbXBvcnQgeyBJRXhwbG9yZXJWaWV3LCBJRXhwbG9yZXJTZXJ2aWNlIH0gZnJvbSAnLi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJUHJvZ3Jlc3NTZXJ2aWNlLCBQcm9ncmVzc0xvY2F0aW9uLCBJUHJvZ3Jlc3NDb21wb3NpdGVPcHRpb25zLCBJUHJvZ3Jlc3NPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZ3Jlc3MvY29tbW9uL3Byb2dyZXNzLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IFJ1bk9uY2VTY2hlZHVsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBJSG9zdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9ob3N0L2Jyb3dzZXIvaG9zdC5qcyc7XG5pbXBvcnQgeyBJRXhwcmVzc2lvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2dsb2IuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VHbG9iTWF0Y2hlciB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgSUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9maWxlc0NvbmZpZ3VyYXRpb24vY29tbW9uL2ZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuXG5leHBvcnQgY29uc3QgVU5ET19SRURPX1NPVVJDRSA9IG5ldyBVbmRvUmVkb1NvdXJjZSgpO1xuXG5leHBvcnQgY2xhc3MgRXhwbG9yZXJTZXJ2aWNlIGltcGxlbWVudHMgSUV4cGxvcmVyU2VydmljZSB7XG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IEVYUExPUkVSX0ZJTEVfQ0hBTkdFU19SRUFDVF9ERUxBWSA9IDUwMDsgLy8gZGVsYXkgaW4gbXMgdG8gcmVhY3QgdG8gZmlsZSBjaGFuZ2VzIHRvIGdpdmUgb3VyIGludGVybmFsIGV2ZW50cyBhIGNoYW5jZSB0byByZWFjdCBmaXJzdFxuXG5cdHByaXZhdGUgcmVhZG9ubHkgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdHByaXZhdGUgZWRpdGFibGU6IHsgc3RhdDogRXhwbG9yZXJJdGVtOyBkYXRhOiBJRWRpdGFibGVEYXRhIH0gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgY29uZmlnOiBJRmlsZXNDb25maWd1cmF0aW9uWydleHBsb3JlciddO1xuXHRwcml2YXRlIGN1dEl0ZW1zOiBFeHBsb3Jlckl0ZW1bXSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSB2aWV3OiBJRXhwbG9yZXJWaWV3IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIG1vZGVsOiBFeHBsb3Jlck1vZGVsO1xuXHRwcml2YXRlIG9uRmlsZUNoYW5nZXNTY2hlZHVsZXI6IFJ1bk9uY2VTY2hlZHVsZXI7XG5cdHByaXZhdGUgZmlsZUNoYW5nZUV2ZW50czogRmlsZUNoYW5nZXNFdmVudFtdID0gW107XG5cdHByaXZhdGUgcmV2ZWFsRXhjbHVkZU1hdGNoZXI6IFJlc291cmNlR2xvYk1hdGNoZXI7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIGNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElDbGlwYm9hcmRTZXJ2aWNlIHByaXZhdGUgY2xpcGJvYXJkU2VydmljZTogSUNsaXBib2FyZFNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdFx0QElCdWxrRWRpdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBidWxrRWRpdFNlcnZpY2U6IElCdWxrRWRpdFNlcnZpY2UsXG5cdFx0QElQcm9ncmVzc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcm9ncmVzc1NlcnZpY2U6IElQcm9ncmVzc1NlcnZpY2UsXG5cdFx0QElIb3N0U2VydmljZSBob3N0U2VydmljZTogSUhvc3RTZXJ2aWNlLFxuXHRcdEBJRmlsZXNDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2U6IElGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlXG5cdCkge1xuXHRcdHRoaXMuY29uZmlnID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgnZXhwbG9yZXInKTtcblxuXHRcdHRoaXMubW9kZWwgPSBuZXcgRXhwbG9yZXJNb2RlbCh0aGlzLmNvbnRleHRTZXJ2aWNlLCB0aGlzLnVyaUlkZW50aXR5U2VydmljZSwgdGhpcy5maWxlU2VydmljZSwgdGhpcy5jb25maWd1cmF0aW9uU2VydmljZSwgdGhpcy5maWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZCh0aGlzLm1vZGVsKTtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZCh0aGlzLmZpbGVTZXJ2aWNlLm9uRGlkUnVuT3BlcmF0aW9uKGUgPT4gdGhpcy5vbkRpZFJ1bk9wZXJhdGlvbihlKSkpO1xuXG5cdFx0dGhpcy5vbkZpbGVDaGFuZ2VzU2NoZWR1bGVyID0gbmV3IFJ1bk9uY2VTY2hlZHVsZXIoYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZXZlbnRzID0gdGhpcy5maWxlQ2hhbmdlRXZlbnRzO1xuXHRcdFx0dGhpcy5maWxlQ2hhbmdlRXZlbnRzID0gW107XG5cblx0XHRcdC8vIEZpbHRlciB0byB0aGUgb25lcyB3ZSBjYXJlXG5cdFx0XHRjb25zdCB0eXBlcyA9IFtGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEXTtcblx0XHRcdGlmICh0aGlzLmNvbmZpZy5zb3J0T3JkZXIgPT09IFNvcnRPcmRlci5Nb2RpZmllZCkge1xuXHRcdFx0XHR0eXBlcy5wdXNoKEZpbGVDaGFuZ2VUeXBlLlVQREFURUQpO1xuXHRcdFx0fVxuXG5cdFx0XHRsZXQgc2hvdWxkUmVmcmVzaCA9IGZhbHNlO1xuXHRcdFx0Ly8gRm9yIERFTEVURUQgYW5kIFVQREFURUQgZXZlbnRzIGdvIHRocm91Z2ggdGhlIGV4cGxvcmVyIG1vZGVsIGFuZCBjaGVjayBpZiBhbnkgb2YgdGhlIGl0ZW1zIGdvdCBhZmZlY3RlZFxuXHRcdFx0dGhpcy5yb290cy5mb3JFYWNoKHIgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy52aWV3ICYmICFzaG91bGRSZWZyZXNoKSB7XG5cdFx0XHRcdFx0c2hvdWxkUmVmcmVzaCA9IGRvZXNGaWxlRXZlbnRBZmZlY3QociwgdGhpcy52aWV3LCBldmVudHMsIHR5cGVzKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHQvLyBGb3IgQURERUQgZXZlbnRzIHdlIG5lZWQgdG8gZ28gdGhyb3VnaCBhbGwgdGhlIGV2ZW50cyBhbmQgY2hlY2sgaWYgdGhlIGV4cGxvcmVyIGlzIGFscmVhZHkgYXdhcmUgb2Ygc29tZSBvZiB0aGVtXG5cdFx0XHQvLyBPciBpZiB0aGV5IGFmZmVjdCBub3QgeWV0IHJlc29sdmVkIHBhcnRzIG9mIHRoZSBleHBsb3Jlci4gSWYgdGhhdCBpcyB0aGUgY2FzZSB3ZSB3aWxsIG5vdCByZWZyZXNoLlxuXHRcdFx0ZXZlbnRzLmZvckVhY2goZSA9PiB7XG5cdFx0XHRcdGlmICghc2hvdWxkUmVmcmVzaCkge1xuXHRcdFx0XHRcdGZvciAoY29uc3QgcmVzb3VyY2Ugb2YgZS5yYXdBZGRlZCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgcGFyZW50ID0gdGhpcy5tb2RlbC5maW5kQ2xvc2VzdChkaXJuYW1lKHJlc291cmNlKSk7XG5cdFx0XHRcdFx0XHQvLyBQYXJlbnQgb2YgdGhlIGFkZGVkIHJlc291cmNlIGlzIHJlc29sdmVkIGFuZCB0aGUgZXhwbG9yZXIgbW9kZWwgaXMgbm90IGF3YXJlIG9mIHRoZSBhZGRlZCByZXNvdXJjZSAtIHdlIG5lZWQgdG8gcmVmcmVzaFxuXHRcdFx0XHRcdFx0aWYgKHBhcmVudCAmJiAhcGFyZW50LmdldENoaWxkKGJhc2VuYW1lKHJlc291cmNlKSkpIHtcblx0XHRcdFx0XHRcdFx0c2hvdWxkUmVmcmVzaCA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdGlmIChzaG91bGRSZWZyZXNoKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMucmVmcmVzaChmYWxzZSk7XG5cdFx0XHR9XG5cblx0XHR9LCBFeHBsb3JlclNlcnZpY2UuRVhQTE9SRVJfRklMRV9DSEFOR0VTX1JFQUNUX0RFTEFZKTtcblxuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMuZmlsZVNlcnZpY2Uub25EaWRGaWxlc0NoYW5nZShlID0+IHtcblx0XHRcdHRoaXMuZmlsZUNoYW5nZUV2ZW50cy5wdXNoKGUpO1xuXHRcdFx0Ly8gRG9uJ3QgbWVzcyB3aXRoIHRoZSBmaWxlIHRyZWUgd2hpbGUgaW4gdGhlIHByb2Nlc3Mgb2YgZWRpdGluZy4gIzExMjI5M1xuXHRcdFx0aWYgKHRoaXMuZWRpdGFibGUpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCF0aGlzLm9uRmlsZUNoYW5nZXNTY2hlZHVsZXIuaXNTY2hlZHVsZWQoKSkge1xuXHRcdFx0XHR0aGlzLm9uRmlsZUNoYW5nZXNTY2hlZHVsZXIuc2NoZWR1bGUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB0aGlzLm9uQ29uZmlndXJhdGlvblVwZGF0ZWQoZSkpKTtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZChFdmVudC5hbnk8eyBzY2hlbWU6IHN0cmluZyB9Pih0aGlzLmZpbGVTZXJ2aWNlLm9uRGlkQ2hhbmdlRmlsZVN5c3RlbVByb3ZpZGVyUmVnaXN0cmF0aW9ucywgdGhpcy5maWxlU2VydmljZS5vbkRpZENoYW5nZUZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcykoYXN5bmMgZSA9PiB7XG5cdFx0XHRsZXQgYWZmZWN0ZWQgPSBmYWxzZTtcblx0XHRcdHRoaXMubW9kZWwucm9vdHMuZm9yRWFjaChyID0+IHtcblx0XHRcdFx0aWYgKHIucmVzb3VyY2Uuc2NoZW1lID09PSBlLnNjaGVtZSkge1xuXHRcdFx0XHRcdGFmZmVjdGVkID0gdHJ1ZTtcblx0XHRcdFx0XHRyLmZvcmdldENoaWxkcmVuKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0aWYgKGFmZmVjdGVkKSB7XG5cdFx0XHRcdGlmICh0aGlzLnZpZXcpIHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLnZpZXcuc2V0VHJlZUlucHV0KCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQodGhpcy5tb2RlbC5vbkRpZENoYW5nZVJvb3RzKCgpID0+IHtcblx0XHRcdHRoaXMudmlldz8uc2V0VHJlZUlucHV0KCk7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gUmVmcmVzaCBleHBsb3JlciB3aGVuIHdpbmRvdyBnZXRzIGZvY3VzIHRvIGNvbXBlbnNhdGUgZm9yIG1pc3NpbmcgZmlsZSBldmVudHMgIzEyNjgxN1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKGhvc3RTZXJ2aWNlLm9uRGlkQ2hhbmdlRm9jdXMoaGFzRm9jdXMgPT4ge1xuXHRcdFx0aWYgKGhhc0ZvY3VzKSB7XG5cdFx0XHRcdHRoaXMucmVmcmVzaChmYWxzZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMucmV2ZWFsRXhjbHVkZU1hdGNoZXIgPSBuZXcgUmVzb3VyY2VHbG9iTWF0Y2hlcihcblx0XHRcdCh1cmkpID0+IGdldFJldmVhbEV4Y2x1ZGVzKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElGaWxlc0NvbmZpZ3VyYXRpb24+KHsgcmVzb3VyY2U6IHVyaSB9KSksXG5cdFx0XHQoZXZlbnQpID0+IGV2ZW50LmFmZmVjdHNDb25maWd1cmF0aW9uKCdleHBsb3Jlci5hdXRvUmV2ZWFsRXhjbHVkZScpLFxuXHRcdFx0Y29udGV4dFNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZCh0aGlzLnJldmVhbEV4Y2x1ZGVNYXRjaGVyKTtcblx0fVxuXG5cdGdldCByb290cygpOiBFeHBsb3Jlckl0ZW1bXSB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwucm9vdHM7XG5cdH1cblxuXHRnZXQgc29ydE9yZGVyQ29uZmlndXJhdGlvbigpOiBJU29ydE9yZGVyQ29uZmlndXJhdGlvbiB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHNvcnRPcmRlcjogdGhpcy5jb25maWcuc29ydE9yZGVyLFxuXHRcdFx0bGV4aWNvZ3JhcGhpY09wdGlvbnM6IHRoaXMuY29uZmlnLnNvcnRPcmRlckxleGljb2dyYXBoaWNPcHRpb25zLFxuXHRcdFx0cmV2ZXJzZTogdGhpcy5jb25maWcuc29ydE9yZGVyUmV2ZXJzZSxcblx0XHR9O1xuXHR9XG5cblx0cmVnaXN0ZXJWaWV3KGNvbnRleHRQcm92aWRlcjogSUV4cGxvcmVyVmlldyk6IHZvaWQge1xuXHRcdHRoaXMudmlldyA9IGNvbnRleHRQcm92aWRlcjtcblx0fVxuXG5cdGdldENvbnRleHQocmVzcGVjdE11bHRpU2VsZWN0aW9uOiBib29sZWFuLCBpZ25vcmVOZXN0ZWRDaGlsZHJlbjogYm9vbGVhbiA9IGZhbHNlKTogRXhwbG9yZXJJdGVtW10ge1xuXHRcdGlmICghdGhpcy52aWV3KSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0Y29uc3QgaXRlbXMgPSBuZXcgU2V0PEV4cGxvcmVySXRlbT4odGhpcy52aWV3LmdldENvbnRleHQocmVzcGVjdE11bHRpU2VsZWN0aW9uKSk7XG5cdFx0aXRlbXMuZm9yRWFjaChpdGVtID0+IHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGlmIChyZXNwZWN0TXVsdGlTZWxlY3Rpb24gJiYgIWlnbm9yZU5lc3RlZENoaWxkcmVuICYmIHRoaXMudmlldz8uaXNJdGVtQ29sbGFwc2VkKGl0ZW0pICYmIGl0ZW0ubmVzdGVkQ2hpbGRyZW4pIHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IGNoaWxkIG9mIGl0ZW0ubmVzdGVkQ2hpbGRyZW4pIHtcblx0XHRcdFx0XHRcdGl0ZW1zLmFkZChjaGlsZCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9IGNhdGNoIHtcblx0XHRcdFx0Ly8gV2Ugd2lsbCBlcnJvciBvdXQgdHJ5aW5nIHRvIHJlc29sdmUgY29sbGFwc2VkIG5vZGVzIHRoYXQgaGF2ZSBub3QgeWV0IGJlZW4gcmVzb2x2ZWQuXG5cdFx0XHRcdC8vIFNvIHdlIGNhdGNoIGFuZCBpZ25vcmUgdGhlbSBpbiB0aGUgbXVsdGlTZWxlY3QgY29udGV4dFxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gWy4uLml0ZW1zXTtcblx0fVxuXG5cdGFzeW5jIGFwcGx5QnVsa0VkaXQoZWRpdDogUmVzb3VyY2VGaWxlRWRpdFtdLCBvcHRpb25zOiB7IHVuZG9MYWJlbDogc3RyaW5nOyBwcm9ncmVzc0xhYmVsOiBzdHJpbmc7IGNvbmZpcm1CZWZvcmVVbmRvPzogYm9vbGVhbjsgcHJvZ3Jlc3NMb2NhdGlvbj86IFByb2dyZXNzTG9jYXRpb24uRXhwbG9yZXIgfCBQcm9ncmVzc0xvY2F0aW9uLldpbmRvdyB9KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblx0XHRjb25zdCBsb2NhdGlvbiA9IG9wdGlvbnMucHJvZ3Jlc3NMb2NhdGlvbiA/PyBQcm9ncmVzc0xvY2F0aW9uLldpbmRvdztcblx0XHRsZXQgcHJvZ3Jlc3NPcHRpb25zO1xuXHRcdGlmIChsb2NhdGlvbiA9PT0gUHJvZ3Jlc3NMb2NhdGlvbi5XaW5kb3cpIHtcblx0XHRcdHByb2dyZXNzT3B0aW9ucyA9IHtcblx0XHRcdFx0bG9jYXRpb246IGxvY2F0aW9uLFxuXHRcdFx0XHR0aXRsZTogb3B0aW9ucy5wcm9ncmVzc0xhYmVsLFxuXHRcdFx0XHRjYW5jZWxsYWJsZTogZWRpdC5sZW5ndGggPiAxLFxuXHRcdFx0fSBzYXRpc2ZpZXMgSVByb2dyZXNzT3B0aW9ucztcblx0XHR9IGVsc2Uge1xuXHRcdFx0cHJvZ3Jlc3NPcHRpb25zID0ge1xuXHRcdFx0XHRsb2NhdGlvbjogbG9jYXRpb24sXG5cdFx0XHRcdHRpdGxlOiBvcHRpb25zLnByb2dyZXNzTGFiZWwsXG5cdFx0XHRcdGNhbmNlbGxhYmxlOiBlZGl0Lmxlbmd0aCA+IDEsXG5cdFx0XHRcdGRlbGF5OiA1MDAsXG5cdFx0XHR9IHNhdGlzZmllcyBJUHJvZ3Jlc3NDb21wb3NpdGVPcHRpb25zO1xuXHRcdH1cblx0XHRjb25zdCBwcm9taXNlID0gdGhpcy5wcm9ncmVzc1NlcnZpY2Uud2l0aFByb2dyZXNzKHByb2dyZXNzT3B0aW9ucywgYXN5bmMgcHJvZ3Jlc3MgPT4ge1xuXHRcdFx0YXdhaXQgdGhpcy5idWxrRWRpdFNlcnZpY2UuYXBwbHkoZWRpdCwge1xuXHRcdFx0XHR1bmRvUmVkb1NvdXJjZTogVU5ET19SRURPX1NPVVJDRSxcblx0XHRcdFx0bGFiZWw6IG9wdGlvbnMudW5kb0xhYmVsLFxuXHRcdFx0XHRjb2RlOiAndW5kb3JlZG8uZXhwbG9yZXJPcGVyYXRpb24nLFxuXHRcdFx0XHRwcm9ncmVzcyxcblx0XHRcdFx0dG9rZW46IGNhbmNlbGxhdGlvblRva2VuU291cmNlLnRva2VuLFxuXHRcdFx0XHRjb25maXJtQmVmb3JlVW5kbzogb3B0aW9ucy5jb25maXJtQmVmb3JlVW5kb1xuXHRcdFx0fSk7XG5cdFx0fSwgKCkgPT4gY2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UuY2FuY2VsKCkpO1xuXHRcdGF3YWl0IHRoaXMucHJvZ3Jlc3NTZXJ2aWNlLndpdGhQcm9ncmVzcyh7IGxvY2F0aW9uOiBQcm9ncmVzc0xvY2F0aW9uLkV4cGxvcmVyLCBkZWxheTogNTAwIH0sICgpID0+IHByb21pc2UpO1xuXHRcdGNhbmNlbGxhdGlvblRva2VuU291cmNlLmRpc3Bvc2UoKTtcblx0fVxuXG5cdGhhc1ZpZXdGb2N1cygpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISF0aGlzLnZpZXcgJiYgdGhpcy52aWV3Lmhhc0ZvY3VzKCk7XG5cdH1cblxuXHQvLyBJRXhwbG9yZXJTZXJ2aWNlIG1ldGhvZHNcblxuXHRmaW5kQ2xvc2VzdChyZXNvdXJjZTogVVJJKTogRXhwbG9yZXJJdGVtIHwgbnVsbCB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwuZmluZENsb3Nlc3QocmVzb3VyY2UpO1xuXHR9XG5cblx0ZmluZENsb3Nlc3RSb290KHJlc291cmNlOiBVUkkpOiBFeHBsb3Jlckl0ZW0gfCBudWxsIHtcblx0XHRjb25zdCBwYXJlbnRSb290cyA9IHRoaXMubW9kZWwucm9vdHMuZmlsdGVyKHIgPT4gdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWxPclBhcmVudChyZXNvdXJjZSwgci5yZXNvdXJjZSkpXG5cdFx0XHQuc29ydCgoZmlyc3QsIHNlY29uZCkgPT4gc2Vjb25kLnJlc291cmNlLnBhdGgubGVuZ3RoIC0gZmlyc3QucmVzb3VyY2UucGF0aC5sZW5ndGgpO1xuXHRcdHJldHVybiBwYXJlbnRSb290cy5sZW5ndGggPyBwYXJlbnRSb290c1swXSA6IG51bGw7XG5cdH1cblxuXHRhc3luYyBzZXRFZGl0YWJsZShzdGF0OiBFeHBsb3Jlckl0ZW0sIGRhdGE6IElFZGl0YWJsZURhdGEgfCBudWxsKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLnZpZXcpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIWRhdGEpIHtcblx0XHRcdHRoaXMuZWRpdGFibGUgPSB1bmRlZmluZWQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuZWRpdGFibGUgPSB7IHN0YXQsIGRhdGEgfTtcblx0XHR9XG5cdFx0Y29uc3QgaXNFZGl0aW5nID0gdGhpcy5pc0VkaXRhYmxlKHN0YXQpO1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLnZpZXcuc2V0RWRpdGFibGUoc3RhdCwgaXNFZGl0aW5nKTtcblx0XHR9IGNhdGNoIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblxuXHRcdGlmICghdGhpcy5lZGl0YWJsZSAmJiB0aGlzLmZpbGVDaGFuZ2VFdmVudHMubGVuZ3RoICYmICF0aGlzLm9uRmlsZUNoYW5nZXNTY2hlZHVsZXIuaXNTY2hlZHVsZWQoKSkge1xuXHRcdFx0dGhpcy5vbkZpbGVDaGFuZ2VzU2NoZWR1bGVyLnNjaGVkdWxlKCk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgc2V0VG9Db3B5KGl0ZW1zOiBFeHBsb3Jlckl0ZW1bXSwgY3V0OiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcHJldmlvdXNseUN1dEl0ZW1zID0gdGhpcy5jdXRJdGVtcztcblx0XHR0aGlzLmN1dEl0ZW1zID0gY3V0ID8gaXRlbXMgOiB1bmRlZmluZWQ7XG5cdFx0YXdhaXQgdGhpcy5jbGlwYm9hcmRTZXJ2aWNlLndyaXRlUmVzb3VyY2VzKGl0ZW1zLm1hcChzID0+IHMucmVzb3VyY2UpKTtcblxuXHRcdHRoaXMudmlldz8uaXRlbXNDb3BpZWQoaXRlbXMsIGN1dCwgcHJldmlvdXNseUN1dEl0ZW1zKTtcblx0fVxuXG5cdGlzQ3V0KGl0ZW06IEV4cGxvcmVySXRlbSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIXRoaXMuY3V0SXRlbXMgJiYgdGhpcy5jdXRJdGVtcy5zb21lKGkgPT4gdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwoaS5yZXNvdXJjZSwgaXRlbS5yZXNvdXJjZSkpO1xuXHR9XG5cblx0Z2V0RWRpdGFibGUoKTogeyBzdGF0OiBFeHBsb3Jlckl0ZW07IGRhdGE6IElFZGl0YWJsZURhdGEgfSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuZWRpdGFibGU7XG5cdH1cblxuXHRnZXRFZGl0YWJsZURhdGEoc3RhdDogRXhwbG9yZXJJdGVtKTogSUVkaXRhYmxlRGF0YSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuZWRpdGFibGUgJiYgdGhpcy5lZGl0YWJsZS5zdGF0ID09PSBzdGF0ID8gdGhpcy5lZGl0YWJsZS5kYXRhIDogdW5kZWZpbmVkO1xuXHR9XG5cblx0aXNFZGl0YWJsZShzdGF0OiBFeHBsb3Jlckl0ZW0gfCB1bmRlZmluZWQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISF0aGlzLmVkaXRhYmxlICYmICh0aGlzLmVkaXRhYmxlLnN0YXQgPT09IHN0YXQgfHwgIXN0YXQpO1xuXHR9XG5cblx0YXN5bmMgc2VsZWN0KHJlc291cmNlOiBVUkksIHJldmVhbD86IGJvb2xlYW4gfCBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMudmlldykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIElmIGZpbGUgb3IgcGFyZW50IG1hdGNoZXMgZXhjbHVkZSBwYXR0ZXJucywgZG8gbm90IHJldmVhbCB1bmxlc3MgcmV2ZWFsIGFyZ3VtZW50IGlzICdmb3JjZSdcblx0XHRjb25zdCBpZ25vcmVSZXZlYWxFeGNsdWRlcyA9IHJldmVhbCA9PT0gJ2ZvcmNlJztcblxuXHRcdGNvbnN0IGZpbGVTdGF0ID0gdGhpcy5maW5kQ2xvc2VzdChyZXNvdXJjZSk7XG5cdFx0aWYgKGZpbGVTdGF0KSB7XG5cdFx0XHRpZiAoIXRoaXMuc2hvdWxkQXV0b1JldmVhbEl0ZW0oZmlsZVN0YXQsIGlnbm9yZVJldmVhbEV4Y2x1ZGVzKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRhd2FpdCB0aGlzLnZpZXcuc2VsZWN0UmVzb3VyY2UoZmlsZVN0YXQucmVzb3VyY2UsIHJldmVhbCk7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0fVxuXG5cdFx0Ly8gU3RhdCBuZWVkcyB0byBiZSByZXNvbHZlZCBmaXJzdCBhbmQgdGhlbiByZXZlYWxlZFxuXHRcdGNvbnN0IG9wdGlvbnM6IElSZXNvbHZlRmlsZU9wdGlvbnMgPSB7IHJlc29sdmVUbzogW3Jlc291cmNlXSwgcmVzb2x2ZU1ldGFkYXRhOiB0aGlzLmNvbmZpZy5zb3J0T3JkZXIgPT09IFNvcnRPcmRlci5Nb2RpZmllZCB9O1xuXHRcdGNvbnN0IHJvb3QgPSB0aGlzLmZpbmRDbG9zZXN0Um9vdChyZXNvdXJjZSk7XG5cdFx0aWYgKCFyb290KSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBzdGF0ID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5yZXNvbHZlKHJvb3QucmVzb3VyY2UsIG9wdGlvbnMpO1xuXG5cdFx0XHQvLyBDb252ZXJ0IHRvIG1vZGVsXG5cdFx0XHRjb25zdCBtb2RlbFN0YXQgPSBFeHBsb3Jlckl0ZW0uY3JlYXRlKHRoaXMuZmlsZVNlcnZpY2UsIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UsIHRoaXMuZmlsZXNDb25maWd1cmF0aW9uU2VydmljZSwgc3RhdCwgdW5kZWZpbmVkLCBvcHRpb25zLnJlc29sdmVUbyk7XG5cdFx0XHQvLyBVcGRhdGUgSW5wdXQgd2l0aCBkaXNrIFN0YXRcblx0XHRcdEV4cGxvcmVySXRlbS5tZXJnZUxvY2FsV2l0aERpc2sobW9kZWxTdGF0LCByb290KTtcblx0XHRcdGNvbnN0IGl0ZW0gPSByb290LmZpbmQocmVzb3VyY2UpO1xuXHRcdFx0YXdhaXQgdGhpcy52aWV3LnJlZnJlc2godHJ1ZSwgcm9vdCk7XG5cblx0XHRcdC8vIE9uY2UgaXRlbSBpcyByZXNvbHZlZCwgY2hlY2sgYWdhaW4gaWYgZm9sZGVyIHNob3VsZCBiZSBleHBhbmRlZFxuXHRcdFx0aWYgKGl0ZW0gJiYgIXRoaXMuc2hvdWxkQXV0b1JldmVhbEl0ZW0oaXRlbSwgaWdub3JlUmV2ZWFsRXhjbHVkZXMpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGF3YWl0IHRoaXMudmlldy5zZWxlY3RSZXNvdXJjZShpdGVtID8gaXRlbS5yZXNvdXJjZSA6IHVuZGVmaW5lZCwgcmV2ZWFsKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0cm9vdC5lcnJvciA9IGVycm9yO1xuXHRcdFx0YXdhaXQgdGhpcy52aWV3LnJlZnJlc2goZmFsc2UsIHJvb3QpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHJlZnJlc2gocmV2ZWFsID0gdHJ1ZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdC8vIERvIG5vdCByZWZyZXNoIHRoZSB0cmVlIHdoZW4gaXQgaXMgc2hvd2luZyB0ZW1wb3Jhcnkgbm9kZXMgKHBoYW50b20gZWxlbWVudHMpXG5cdFx0aWYgKHRoaXMudmlldz8uaGFzUGhhbnRvbUVsZW1lbnRzKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLm1vZGVsLnJvb3RzLmZvckVhY2gociA9PiByLmZvcmdldENoaWxkcmVuKCkpO1xuXHRcdGlmICh0aGlzLnZpZXcpIHtcblx0XHRcdGF3YWl0IHRoaXMudmlldy5yZWZyZXNoKHRydWUpO1xuXHRcdFx0Y29uc3QgcmVzb3VyY2UgPSB0aGlzLmVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yPy5yZXNvdXJjZTtcblx0XHRcdGNvbnN0IGF1dG9SZXZlYWwgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElGaWxlc0NvbmZpZ3VyYXRpb24+KCkuZXhwbG9yZXIuYXV0b1JldmVhbDtcblxuXHRcdFx0aWYgKHJldmVhbCAmJiByZXNvdXJjZSAmJiBhdXRvUmV2ZWFsKSB7XG5cdFx0XHRcdC8vIFdlIGRpZCBhIHRvcCBsZXZlbCByZWZyZXNoLCByZXZlYWwgdGhlIGFjdGl2ZSBmaWxlICM2NzExOFxuXHRcdFx0XHR0aGlzLnNlbGVjdChyZXNvdXJjZSwgYXV0b1JldmVhbCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Ly8gRmlsZSBldmVudHNcblxuXHRwcml2YXRlIGFzeW5jIG9uRGlkUnVuT3BlcmF0aW9uKGU6IEZpbGVPcGVyYXRpb25FdmVudCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdC8vIFdoZW4gbmVzdGluZywgY2hhbmdlcyB0byBvbmUgZmlsZSBpbiBhIGZvbGRlciBtYXkgaW1wYWN0IHRoZSByZW5kZXJlZCBzdHJ1Y3R1cmVcblx0XHQvLyBvZiBhbGwgdGhlIGZvbGRlcidzIGltbWVkaWF0ZSBjaGlsZHJlbiwgdGh1cyBhIHJlY3Vyc2l2ZSByZWZyZXNoIGlzIG5lZWRlZC5cblx0XHQvLyBJZGVhbGx5IHRoZSB0cmVlIHdvdWxkIGJlIGFibGUgdG8gcmVjdXNpdmVseSByZWZyZXNoIGp1c3Qgb25lIGxldmVsIGJ1dCB0aGF0IGRvZXMgbm90IHlldCBleGlzdC5cblx0XHRjb25zdCBzaG91bGREZWVwUmVmcmVzaCA9IHRoaXMuY29uZmlnLmZpbGVOZXN0aW5nLmVuYWJsZWQ7XG5cblx0XHQvLyBBZGRcblx0XHRpZiAoZS5pc09wZXJhdGlvbihGaWxlT3BlcmF0aW9uLkNSRUFURSkgfHwgZS5pc09wZXJhdGlvbihGaWxlT3BlcmF0aW9uLkNPUFkpKSB7XG5cdFx0XHRjb25zdCBhZGRlZEVsZW1lbnQgPSBlLnRhcmdldDtcblx0XHRcdGNvbnN0IHBhcmVudFJlc291cmNlID0gZGlybmFtZShhZGRlZEVsZW1lbnQucmVzb3VyY2UpITtcblx0XHRcdGNvbnN0IHBhcmVudHMgPSB0aGlzLm1vZGVsLmZpbmRBbGwocGFyZW50UmVzb3VyY2UpO1xuXG5cdFx0XHRpZiAocGFyZW50cy5sZW5ndGgpIHtcblxuXHRcdFx0XHQvLyBBZGQgdGhlIG5ldyBmaWxlIHRvIGl0cyBwYXJlbnQgKE1vZGVsKVxuXHRcdFx0XHRhd2FpdCBQcm9taXNlLmFsbChwYXJlbnRzLm1hcChhc3luYyBwID0+IHtcblx0XHRcdFx0XHQvLyBXZSBoYXZlIHRvIGNoZWNrIGlmIHRoZSBwYXJlbnQgaXMgcmVzb2x2ZWQgIzI5MTc3XG5cdFx0XHRcdFx0Y29uc3QgcmVzb2x2ZU1ldGFkYXRhID0gdGhpcy5jb25maWcuc29ydE9yZGVyID09PSBgbW9kaWZpZWRgO1xuXHRcdFx0XHRcdGlmICghcC5pc0RpcmVjdG9yeVJlc29sdmVkKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBzdGF0ID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5yZXNvbHZlKHAucmVzb3VyY2UsIHsgcmVzb2x2ZU1ldGFkYXRhIH0pO1xuXHRcdFx0XHRcdFx0aWYgKHN0YXQpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgbW9kZWxTdGF0ID0gRXhwbG9yZXJJdGVtLmNyZWF0ZSh0aGlzLmZpbGVTZXJ2aWNlLCB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLCB0aGlzLmZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UsIHN0YXQsIHAucGFyZW50KTtcblx0XHRcdFx0XHRcdFx0RXhwbG9yZXJJdGVtLm1lcmdlTG9jYWxXaXRoRGlzayhtb2RlbFN0YXQsIHApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNvbnN0IGNoaWxkRWxlbWVudCA9IEV4cGxvcmVySXRlbS5jcmVhdGUodGhpcy5maWxlU2VydmljZSwgdGhpcy5jb25maWd1cmF0aW9uU2VydmljZSwgdGhpcy5maWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLCBhZGRlZEVsZW1lbnQsIHAucGFyZW50KTtcblx0XHRcdFx0XHQvLyBNYWtlIHN1cmUgdG8gcmVtb3ZlIGFueSBwcmV2aW91cyB2ZXJzaW9uIG9mIHRoZSBmaWxlIGlmIGFueVxuXHRcdFx0XHRcdHAucmVtb3ZlQ2hpbGQoY2hpbGRFbGVtZW50KTtcblx0XHRcdFx0XHRwLmFkZENoaWxkKGNoaWxkRWxlbWVudCk7XG5cdFx0XHRcdFx0Ly8gUmVmcmVzaCB0aGUgUGFyZW50IChWaWV3KVxuXHRcdFx0XHRcdGF3YWl0IHRoaXMudmlldz8ucmVmcmVzaChzaG91bGREZWVwUmVmcmVzaCwgcCk7XG5cdFx0XHRcdH0pKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBNb3ZlIChpbmNsdWRpbmcgUmVuYW1lKVxuXHRcdGVsc2UgaWYgKGUuaXNPcGVyYXRpb24oRmlsZU9wZXJhdGlvbi5NT1ZFKSkge1xuXHRcdFx0Y29uc3Qgb2xkUmVzb3VyY2UgPSBlLnJlc291cmNlO1xuXHRcdFx0Y29uc3QgbmV3RWxlbWVudCA9IGUudGFyZ2V0O1xuXHRcdFx0Y29uc3Qgb2xkUGFyZW50UmVzb3VyY2UgPSBkaXJuYW1lKG9sZFJlc291cmNlKTtcblx0XHRcdGNvbnN0IG5ld1BhcmVudFJlc291cmNlID0gZGlybmFtZShuZXdFbGVtZW50LnJlc291cmNlKTtcblx0XHRcdGNvbnN0IG1vZGVsRWxlbWVudHMgPSB0aGlzLm1vZGVsLmZpbmRBbGwob2xkUmVzb3VyY2UpO1xuXHRcdFx0Y29uc3Qgc2FtZVBhcmVudE1vdmUgPSBtb2RlbEVsZW1lbnRzLmV2ZXJ5KGUgPT4gIWUubmVzdGVkUGFyZW50KSAmJiB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbChvbGRQYXJlbnRSZXNvdXJjZSwgbmV3UGFyZW50UmVzb3VyY2UpO1xuXG5cdFx0XHQvLyBIYW5kbGUgUmVuYW1lXG5cdFx0XHRpZiAoc2FtZVBhcmVudE1vdmUpIHtcblx0XHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwobW9kZWxFbGVtZW50cy5tYXAoYXN5bmMgbW9kZWxFbGVtZW50ID0+IHtcblx0XHRcdFx0XHQvLyBSZW5hbWUgRmlsZSAoTW9kZWwpXG5cdFx0XHRcdFx0bW9kZWxFbGVtZW50LnJlbmFtZShuZXdFbGVtZW50KTtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLnZpZXc/LnJlZnJlc2goc2hvdWxkRGVlcFJlZnJlc2gsIG1vZGVsRWxlbWVudC5wYXJlbnQpO1xuXHRcdFx0XHR9KSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEhhbmRsZSBNb3ZlXG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0Y29uc3QgbmV3UGFyZW50cyA9IHRoaXMubW9kZWwuZmluZEFsbChuZXdQYXJlbnRSZXNvdXJjZSk7XG5cdFx0XHRcdGlmIChuZXdQYXJlbnRzLmxlbmd0aCAmJiBtb2RlbEVsZW1lbnRzLmxlbmd0aCkge1xuXHRcdFx0XHRcdC8vIE1vdmUgaW4gTW9kZWxcblx0XHRcdFx0XHRhd2FpdCBQcm9taXNlLmFsbChtb2RlbEVsZW1lbnRzLm1hcChhc3luYyAobW9kZWxFbGVtZW50LCBpbmRleCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3Qgb2xkUGFyZW50ID0gbW9kZWxFbGVtZW50LnBhcmVudDtcblx0XHRcdFx0XHRcdGNvbnN0IG9sZE5lc3RlZFBhcmVudCA9IG1vZGVsRWxlbWVudC5uZXN0ZWRQYXJlbnQ7XG5cdFx0XHRcdFx0XHRtb2RlbEVsZW1lbnQubW92ZShuZXdQYXJlbnRzW2luZGV4XSk7XG5cdFx0XHRcdFx0XHRpZiAob2xkTmVzdGVkUGFyZW50KSB7XG5cdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMudmlldz8ucmVmcmVzaChmYWxzZSwgb2xkTmVzdGVkUGFyZW50KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMudmlldz8ucmVmcmVzaChmYWxzZSwgb2xkUGFyZW50KTtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMudmlldz8ucmVmcmVzaChzaG91bGREZWVwUmVmcmVzaCwgbmV3UGFyZW50c1tpbmRleF0pO1xuXHRcdFx0XHRcdH0pKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIERlbGV0ZVxuXHRcdGVsc2UgaWYgKGUuaXNPcGVyYXRpb24oRmlsZU9wZXJhdGlvbi5ERUxFVEUpKSB7XG5cdFx0XHRjb25zdCBtb2RlbEVsZW1lbnRzID0gdGhpcy5tb2RlbC5maW5kQWxsKGUucmVzb3VyY2UpO1xuXHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwobW9kZWxFbGVtZW50cy5tYXAoYXN5bmMgbW9kZWxFbGVtZW50ID0+IHtcblx0XHRcdFx0aWYgKG1vZGVsRWxlbWVudC5wYXJlbnQpIHtcblx0XHRcdFx0XHQvLyBSZW1vdmUgRWxlbWVudCBmcm9tIFBhcmVudCAoTW9kZWwpXG5cdFx0XHRcdFx0Y29uc3QgcGFyZW50ID0gbW9kZWxFbGVtZW50LnBhcmVudDtcblx0XHRcdFx0XHRwYXJlbnQucmVtb3ZlQ2hpbGQobW9kZWxFbGVtZW50KTtcblx0XHRcdFx0XHR0aGlzLnZpZXc/LmZvY3VzTmV4dCgpO1xuXG5cdFx0XHRcdFx0Y29uc3Qgb2xkTmVzdGVkUGFyZW50ID0gbW9kZWxFbGVtZW50Lm5lc3RlZFBhcmVudDtcblx0XHRcdFx0XHRpZiAob2xkTmVzdGVkUGFyZW50KSB7XG5cdFx0XHRcdFx0XHRvbGROZXN0ZWRQYXJlbnQucmVtb3ZlQ2hpbGQobW9kZWxFbGVtZW50KTtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMudmlldz8ucmVmcmVzaChmYWxzZSwgb2xkTmVzdGVkUGFyZW50KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Ly8gUmVmcmVzaCBQYXJlbnQgKFZpZXcpXG5cdFx0XHRcdFx0YXdhaXQgdGhpcy52aWV3Py5yZWZyZXNoKHNob3VsZERlZXBSZWZyZXNoLCBwYXJlbnQpO1xuXG5cdFx0XHRcdFx0aWYgKHRoaXMudmlldz8uZ2V0Rm9jdXMoKS5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRcdHRoaXMudmlldz8uZm9jdXNMYXN0KCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0fVxuXHR9XG5cblx0Ly8gQ2hlY2sgaWYgYW4gaXRlbSBtYXRjaGVzIGEgZXhwbG9yZXIuYXV0b1JldmVhbEV4Y2x1ZGUgcGF0dGVyblxuXHRwcml2YXRlIHNob3VsZEF1dG9SZXZlYWxJdGVtKGl0ZW06IEV4cGxvcmVySXRlbSB8IHVuZGVmaW5lZCwgaWdub3JlOiBib29sZWFuKTogYm9vbGVhbiB7XG5cdFx0aWYgKGl0ZW0gPT09IHVuZGVmaW5lZCB8fCBpZ25vcmUpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRpZiAodGhpcy5yZXZlYWxFeGNsdWRlTWF0Y2hlci5tYXRjaGVzKGl0ZW0ucmVzb3VyY2UsIG5hbWUgPT4gISEoaXRlbS5wYXJlbnQgJiYgaXRlbS5wYXJlbnQuZ2V0Q2hpbGQobmFtZSkpKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRjb25zdCByb290ID0gaXRlbS5yb290O1xuXHRcdGxldCBjdXJyZW50SXRlbSA9IGl0ZW0ucGFyZW50O1xuXHRcdHdoaWxlIChjdXJyZW50SXRlbSAhPT0gcm9vdCkge1xuXHRcdFx0aWYgKGN1cnJlbnRJdGVtID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5yZXZlYWxFeGNsdWRlTWF0Y2hlci5tYXRjaGVzKGN1cnJlbnRJdGVtLnJlc291cmNlKSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRjdXJyZW50SXRlbSA9IGN1cnJlbnRJdGVtLnBhcmVudDtcblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIG9uQ29uZmlndXJhdGlvblVwZGF0ZWQoZXZlbnQ6IElDb25maWd1cmF0aW9uQ2hhbmdlRXZlbnQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIWV2ZW50LmFmZmVjdHNDb25maWd1cmF0aW9uKCdleHBsb3JlcicpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bGV0IHNob3VsZFJlZnJlc2ggPSBmYWxzZTtcblxuXHRcdGlmIChldmVudC5hZmZlY3RzQ29uZmlndXJhdGlvbignZXhwbG9yZXIuZmlsZU5lc3RpbmcnKSkge1xuXHRcdFx0c2hvdWxkUmVmcmVzaCA9IHRydWU7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29uZmlndXJhdGlvbiA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SUZpbGVzQ29uZmlndXJhdGlvbj4oKTtcblxuXHRcdGNvbnN0IGNvbmZpZ1NvcnRPcmRlciA9IGNvbmZpZ3VyYXRpb24/LmV4cGxvcmVyPy5zb3J0T3JkZXIgfHwgU29ydE9yZGVyLkRlZmF1bHQ7XG5cdFx0aWYgKHRoaXMuY29uZmlnLnNvcnRPcmRlciAhPT0gY29uZmlnU29ydE9yZGVyKSB7XG5cdFx0XHRzaG91bGRSZWZyZXNoID0gdGhpcy5jb25maWcuc29ydE9yZGVyICE9PSB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29uZmlnTGV4aWNvZ3JhcGhpY09wdGlvbnMgPSBjb25maWd1cmF0aW9uPy5leHBsb3Jlcj8uc29ydE9yZGVyTGV4aWNvZ3JhcGhpY09wdGlvbnMgfHwgTGV4aWNvZ3JhcGhpY09wdGlvbnMuRGVmYXVsdDtcblx0XHRpZiAodGhpcy5jb25maWcuc29ydE9yZGVyTGV4aWNvZ3JhcGhpY09wdGlvbnMgIT09IGNvbmZpZ0xleGljb2dyYXBoaWNPcHRpb25zKSB7XG5cdFx0XHRzaG91bGRSZWZyZXNoID0gc2hvdWxkUmVmcmVzaCB8fCB0aGlzLmNvbmZpZy5zb3J0T3JkZXJMZXhpY29ncmFwaGljT3B0aW9ucyAhPT0gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCBzb3J0T3JkZXJSZXZlcnNlID0gY29uZmlndXJhdGlvbj8uZXhwbG9yZXI/LnNvcnRPcmRlclJldmVyc2UgfHwgZmFsc2U7XG5cblx0XHRpZiAodGhpcy5jb25maWcuc29ydE9yZGVyUmV2ZXJzZSAhPT0gc29ydE9yZGVyUmV2ZXJzZSkge1xuXHRcdFx0c2hvdWxkUmVmcmVzaCA9IHNob3VsZFJlZnJlc2ggfHwgdGhpcy5jb25maWcuc29ydE9yZGVyUmV2ZXJzZSAhPT0gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHRoaXMuY29uZmlnID0gY29uZmlndXJhdGlvbi5leHBsb3JlcjtcblxuXHRcdGlmIChzaG91bGRSZWZyZXNoKSB7XG5cdFx0XHRhd2FpdCB0aGlzLnJlZnJlc2goKTtcblx0XHR9XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGRvZXNGaWxlRXZlbnRBZmZlY3QoaXRlbTogRXhwbG9yZXJJdGVtLCB2aWV3OiBJRXhwbG9yZXJWaWV3LCBldmVudHM6IEZpbGVDaGFuZ2VzRXZlbnRbXSwgdHlwZXM6IEZpbGVDaGFuZ2VUeXBlW10pOiBib29sZWFuIHtcblx0Zm9yIChjb25zdCBbX25hbWUsIGNoaWxkXSBvZiBpdGVtLmNoaWxkcmVuKSB7XG5cdFx0aWYgKHZpZXcuaXNJdGVtVmlzaWJsZShjaGlsZCkpIHtcblx0XHRcdGlmIChldmVudHMuc29tZShlID0+IGUuY29udGFpbnMoY2hpbGQucmVzb3VyY2UsIC4uLnR5cGVzKSkpIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoY2hpbGQuaXNEaXJlY3RvcnkgJiYgY2hpbGQuaXNEaXJlY3RvcnlSZXNvbHZlZCkge1xuXHRcdFx0XHRpZiAoZG9lc0ZpbGVFdmVudEFmZmVjdChjaGlsZCwgdmlldywgZXZlbnRzLCB0eXBlcykpIHtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gZ2V0UmV2ZWFsRXhjbHVkZXMoY29uZmlndXJhdGlvbjogSUZpbGVzQ29uZmlndXJhdGlvbik6IElFeHByZXNzaW9uIHtcblx0Y29uc3QgcmV2ZWFsRXhjbHVkZXMgPSBjb25maWd1cmF0aW9uICYmIGNvbmZpZ3VyYXRpb24uZXhwbG9yZXIgJiYgY29uZmlndXJhdGlvbi5leHBsb3Jlci5hdXRvUmV2ZWFsRXhjbHVkZTtcblxuXHRpZiAoIXJldmVhbEV4Y2x1ZGVzKSB7XG5cdFx0cmV0dXJuIHt9O1xuXHR9XG5cblx0cmV0dXJuIHJldmVhbEV4Y2x1ZGVzO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGFBQWE7QUFDdEIsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBdUQsV0FBVyw0QkFBNEI7QUFDOUYsU0FBUyxjQUFjLHFCQUFxQjtBQUU1QyxTQUE2QixlQUFlLGNBQWdDLHNCQUEyQztBQUN2SCxTQUFTLFNBQVMsZ0JBQWdCO0FBQ2xDLFNBQVMsNkJBQXdEO0FBQ2pFLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsc0JBQXNCO0FBRS9CLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsd0JBQTBDO0FBQ25ELFNBQVMsc0JBQXNCO0FBRS9CLFNBQVMsa0JBQWtCLHdCQUFxRTtBQUNoRyxTQUFTLCtCQUErQjtBQUN4QyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLG9CQUFvQjtBQUU3QixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLGtDQUFrQztBQUVwQyxNQUFNLG1CQUFtQixJQUFJLGVBQWU7QUFFNUMsSUFBTSxrQkFBTixNQUFrRDtBQUFBLEVBZXhELFlBQ3VCLGFBQ1Msc0JBQ0csZ0JBQ1Asa0JBQ0gsZUFDYyxvQkFDSCxpQkFDQSxpQkFDckIsYUFDK0IsMkJBQzVDO0FBVnFCO0FBQ1M7QUFDRztBQUNQO0FBQ0g7QUFDYztBQUNIO0FBQ0E7QUFFVTtBQXBCOUM7QUFBQSxTQUFpQixjQUFjLElBQUksZ0JBQWdCO0FBT25ELFNBQVEsbUJBQXVDLENBQUM7QUFlL0MsU0FBSyxTQUFTLEtBQUsscUJBQXFCLFNBQVMsVUFBVTtBQUUzRCxTQUFLLFFBQVEsSUFBSSxjQUFjLEtBQUssZ0JBQWdCLEtBQUssb0JBQW9CLEtBQUssYUFBYSxLQUFLLHNCQUFzQixLQUFLLHlC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
