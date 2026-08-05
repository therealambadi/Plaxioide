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
import { ResourceMap } from "../../../../base/common/map.js";
import { createDecorator, IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { EncodingMode, isTextFileEditorModel, ITextFileService } from "../../../services/textfile/common/textfiles.js";
import { Disposable, DisposableMap, DisposableStore, ReferenceCollection } from "../../../../base/common/lifecycle.js";
import { IEditorWorkerService } from "../../../../editor/common/services/editorWorker.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { shouldSynchronizeModel } from "../../../../editor/common/model.js";
import { compareChanges, getModifiedEndLineNumber, IQuickDiffService } from "../common/quickDiff.js";
import { ThrottledDelayer } from "../../../../base/common/async.js";
import { ISCMService } from "../common/scm.js";
import { sortedDiff, equals } from "../../../../base/common/arrays.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { DiffState } from "../../../../editor/browser/widget/diffEditor/diffEditorViewModel.js";
import { toLineChanges } from "../../../../editor/browser/widget/diffEditor/diffEditorWidget.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { IChatEditingService, WorkingSetEntryState } from "../../chat/common/chatEditingService.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { autorun, autorunWithStore } from "../../../../base/common/observable.js";
const IQuickDiffModelService = createDecorator("IQuickDiffModelService");
const decoratorQuickDiffModelOptions = {
  algorithm: "legacy",
  maxComputationTimeMs: 1e3
};
let QuickDiffModelReferenceCollection = class extends ReferenceCollection {
  constructor(_instantiationService) {
    super();
    this._instantiationService = _instantiationService;
  }
  createReferencedObject(_key, textFileModel, options) {
    return this._instantiationService.createInstance(QuickDiffModel, textFileModel, options);
  }
  destroyReferencedObject(_key, object) {
    object.dispose();
  }
};
QuickDiffModelReferenceCollection = __decorateClass([
  __decorateParam(0, IInstantiationService)
], QuickDiffModelReferenceCollection);
let QuickDiffModelService = class {
  constructor(instantiationService, textFileService, uriIdentityService) {
    this.instantiationService = instantiationService;
    this.textFileService = textFileService;
    this.uriIdentityService = uriIdentityService;
    this._references = this.instantiationService.createInstance(QuickDiffModelReferenceCollection);
  }
  createQuickDiffModelReference(resource, options = decoratorQuickDiffModelOptions) {
    const textFileModel = this.textFileService.files.get(resource);
    if (!textFileModel?.isResolved()) {
      return void 0;
    }
    resource = this.uriIdentityService.asCanonicalUri(resource).with({ query: JSON.stringify(options) });
    return this._references.acquire(resource.toString(), textFileModel, options);
  }
};
QuickDiffModelService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, ITextFileService),
  __decorateParam(2, IUriIdentityService)
], QuickDiffModelService);
let QuickDiffModel = class extends Disposable {
  constructor(textFileModel, options, scmService, quickDiffService, editorWorkerService, configurationService, textModelResolverService, _chatEditingService, progressService) {
    super();
    this.options = options;
    this.scmService = scmService;
    this.quickDiffService = quickDiffService;
    this.editorWorkerService = editorWorkerService;
    this.configurationService = configurationService;
    this.textModelResolverService = textModelResolverService;
    this._chatEditingService = _chatEditingService;
    this.progressService = progressService;
    this._originalEditorModels = new ResourceMap();
    this._originalEditorModelsDisposables = this._register(new DisposableStore());
    this._disposed = false;
    this._quickDiffs = [];
    this._diffDelayer = new ThrottledDelayer(200);
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
    this._changes = [];
    /**
     * Map of quick diff name to the index of the change in `this.changes`
     */
    this._quickDiffChanges = /* @__PURE__ */ new Map();
    this._repositoryDisposables = new DisposableMap();
    this._model = textFileModel;
    this._register(textFileModel.textEditorModel.onDidChangeContent(() => this.triggerDiff()));
    this._register(
      Event.filter(
        configurationService.onDidChangeConfiguration,
        (e) => e.affectsConfiguration("scm.diffDecorationsIgnoreTrimWhitespace") || e.affectsConfiguration("diffEditor.ignoreTrimWhitespace")
      )(this.triggerDiff, this)
    );
    this._register(scmService.onDidAddRepository(this.onDidAddRepository, this));
    for (const r of scmService.repositories) {
      this.onDidAddRepository(r);
    }
    this._register(this._model.onDidChangeEncoding(() => {
      this._diffDelayer.cancel();
      this._quickDiffs = [];
      this._originalEditorModels.clear();
      this._quickDiffsPromise = void 0;
      this.setChanges([], /* @__PURE__ */ new Map());
      this.triggerDiff();
    }));
    this._register(this.quickDiffService.onDidChangeQuickDiffProviders(() => this.triggerDiff()));
    this._register(autorunWithStore((r, store) => {
      for (const session of this._chatEditingService.editingSessionsObs.read(r)) {
        store.add(autorun((r2) => {
          for (const entry of session.entries.read(r2)) {
            entry.state.read(r2);
          }
          this.triggerDiff();
        }));
      }
    }));
    this.triggerDiff();
  }
  get originalTextModels() {
    return Iterable.map(this._originalEditorModels.values(), (editorModel) => editorModel.textEditorModel);
  }
  get changes() {
    return this._changes;
  }
  get quickDiffChanges() {
    return this._quickDiffChanges;
  }
  get quickDiffs() {
    return this._quickDiffs;
  }
  getQuickDiffResults() {
    return this._quickDiffs.map((quickDiff) => {
      const changes = this.changes.filter((change) => change.label === quickDiff.label);
      return {
        label: quickDiff.label,
        original: quickDiff.originalResource,
        modified: this._model.resource,
        changes: changes.map((change) => change.change),
        changes2: changes.map((change) => change.change2)
      };
    });
  }
  getDiffEditorModel(originalUri) {
    const editorModel = this._originalEditorModels.get(originalUri);
    return editorModel ? {
      modified: this._model.textEditorModel,
      original: editorModel.textEditorModel
    } : void 0;
  }
  onDidAddRepository(repository) {
    const disposables = new DisposableStore();
    disposables.add(repository.provider.onDidChangeResources(this.triggerDiff, this));
    const onDidRemoveRepository = Event.filter(this.scmService.onDidRemoveRepository, (r) => r === repository);
    disposables.add(onDidRemoveRepository(() => this._repositoryDisposables.deleteAndDispose(repository)));
    this._repositoryDisposables.set(repository, disposables);
    this.triggerDiff();
  }
  triggerDiff() {
    if (!this._diffDelayer) {
      return;
    }
    this._diffDelayer.trigger(async () => {
      const result = await this.diff();
      const editorModels = Array.from(this._originalEditorModels.values());
      if (!result || this._disposed || this._model.isDisposed() || editorModels.some((editorModel) => editorModel.isDisposed())) {
        return;
      }
      this.setChanges(result.changes, result.mapChanges);
    }).catch((err) => onUnexpectedError(err));
  }
  setChanges(changes, mapChanges) {
    const diff = sortedDiff(this.changes, changes, (a, b) => compareChanges(a.change, b.change));
    this._changes = changes;
    this._quickDiffChanges = mapChanges;
    this._onDidChange.fire({ changes, diff });
  }
  diff() {
    return this.progressService.withProgress({ location: ProgressLocation.Scm, delay: 250 }, async () => {
      const originalURIs = await this.getQuickDiffsPromise();
      if (this._disposed || this._model.isDisposed() || originalURIs.length === 0) {
        return Promise.resolve({ changes: [], mapChanges: /* @__PURE__ */ new Map() });
      }
      const filteredToDiffable = originalURIs.filter((quickDiff) => this.editorWorkerService.canComputeDirtyDiff(quickDiff.originalResource, this._model.resource));
      if (filteredToDiffable.length === 0) {
        return Promise.resolve({ changes: [], mapChanges: /* @__PURE__ */ new Map() });
      }
      const ignoreTrimWhitespaceSetting = this.configurationService.getValue("scm.diffDecorationsIgnoreTrimWhitespace");
      const ignoreTrimWhitespace = ignoreTrimWhitespaceSetting === "inherit" ? this.configurationService.getValue("diffEditor.ignoreTrimWhitespace") : ignoreTrimWhitespaceSetting !== "false";
      const allDiffs = [];
      for (const quickDiff of filteredToDiffable) {
        const diff = await this._diff(quickDiff.originalResource, this._model.resource, ignoreTrimWhitespace);
        if (diff.changes && diff.changes2 && diff.changes.length === diff.changes2.length) {
          for (let index = 0; index < diff.changes.length; index++) {
            allDiffs.push({
              label: quickDiff.label,
              original: quickDiff.originalResource,
              modified: this._model.resource,
              change: diff.changes[index],
              change2: diff.changes2[index]
            });
          }
        }
      }
      const sorted = allDiffs.sort((a, b) => compareChanges(a.change, b.change));
      const map = /* @__PURE__ */ new Map();
      for (let i = 0; i < sorted.length; i++) {
        const label = sorted[i].label;
        if (!map.has(label)) {
          map.set(label, []);
        }
        map.get(label).push(i);
      }
      return { changes: sorted, mapChanges: map };
    });
  }
  async _diff(original, modified, ignoreTrimWhitespace) {
    const maxComputationTimeMs = this.options.maxComputationTimeMs ?? Number.MAX_SAFE_INTEGER;
    const result = await this.editorWorkerService.computeDiff(original, modified, {
      computeMoves: false,
      ignoreTrimWhitespace,
      maxComputationTimeMs
    }, this.options.algorithm);
    return { changes: result ? toLineChanges(DiffState.fromDiffResult(result)) : null, changes2: result?.changes ?? null };
  }
  getQuickDiffsPromise() {
    if (this._quickDiffsPromise) {
      return this._quickDiffsPromise;
    }
    this._quickDiffsPromise = this.getOriginalResource().then(async (quickDiffs) => {
      if (this._disposed) {
        return [];
      }
      if (quickDiffs.length === 0) {
        this._quickDiffs = [];
        this._originalEditorModels.clear();
        return [];
      }
      if (equals(this._quickDiffs, quickDiffs, (a, b) => a.originalResource.toString() === b.originalResource.toString() && a.label === b.label)) {
        return quickDiffs;
      }
      this._quickDiffs = quickDiffs;
      this._originalEditorModels.clear();
      this._originalEditorModelsDisposables.clear();
      return (await Promise.all(quickDiffs.map(async (quickDiff) => {
        try {
          const ref = await this.textModelResolverService.createModelReference(quickDiff.originalResource);
          if (this._disposed) {
            ref.dispose();
            return [];
          }
          this._originalEditorModels.set(quickDiff.originalResource, ref.object);
          if (isTextFileEditorModel(ref.object)) {
            const encoding = this._model.getEncoding();
            if (encoding) {
              ref.object.setEncoding(encoding, EncodingMode.Decode);
            }
          }
          this._originalEditorModelsDisposables.add(ref);
          this._originalEditorModelsDisposables.add(ref.object.textEditorModel.onDidChangeContent(() => this.triggerDiff()));
          return quickDiff;
        } catch (error) {
          return [];
        }
      }))).flat();
    });
    return this._quickDiffsPromise.finally(() => {
      this._quickDiffsPromise = void 0;
    });
  }
  async getOriginalResource() {
    if (this._disposed) {
      return Promise.resolve([]);
    }
    const uri = this._model.resource;
    const isBeingModifiedByChatEdits = this._chatEditingService.editingSessionsObs.get().some((session) => session.getEntry(uri)?.state.get() === WorkingSetEntryState.Modified);
    if (isBeingModifiedByChatEdits) {
      return Promise.resolve([]);
    }
    const isSynchronized = this._model.textEditorModel ? shouldSynchronizeModel(this._model.textEditorModel) : void 0;
    return this.quickDiffService.getQuickDiffs(uri, this._model.getLanguageId(), isSynchronized);
  }
  findNextClosestChange(lineNumber, inclusive = true, provider) {
    let preferredProvider;
    if (!provider && inclusive) {
      preferredProvider = this.quickDiffs.find((value) => value.isSCM)?.label;
    }
    const possibleChanges = [];
    for (let i = 0; i < this.changes.length; i++) {
      if (provider && this.changes[i].label !== provider) {
        continue;
      }
      if (!this.quickDiffs.find((quickDiff) => quickDiff.label === this.changes[i].label)?.visible) {
        continue;
      }
      const change = this.changes[i];
      const possibleChangesLength = possibleChanges.length;
      if (inclusive) {
        if (getModifiedEndLineNumber(change.change) >= lineNumber) {
          if (preferredProvider && change.label !== preferredProvider) {
            possibleChanges.push(i);
          } else {
            return i;
          }
        }
      } else {
        if (change.change.modifiedStartLineNumber > lineNumber) {
          return i;
        }
      }
      if (possibleChanges.length > 0 && possibleChanges.length === possibleChangesLength) {
        return possibleChanges[0];
      }
    }
    return possibleChanges.length > 0 ? possibleChanges[0] : 0;
  }
  findPreviousClosestChange(lineNumber, inclusive = true, provider) {
    for (let i = this.changes.length - 1; i >= 0; i--) {
      if (provider && this.changes[i].label !== provider) {
        continue;
      }
      if (!this.quickDiffs.find((quickDiff) => quickDiff.label === this.changes[i].label)?.visible) {
        continue;
      }
      const change = this.changes[i].change;
      if (inclusive) {
        if (change.modifiedStartLineNumber <= lineNumber) {
          return i;
        }
      } else {
        if (getModifiedEndLineNumber(change) < lineNumber) {
          return i;
        }
      }
    }
    return this.changes.length - 1;
  }
  dispose() {
    this._disposed = true;
    this._quickDiffs = [];
    this._diffDelayer.cancel();
    this._originalEditorModels.clear();
    this._repositoryDisposables.dispose();
    super.dispose();
  }
};
QuickDiffModel = __decorateClass([
  __decorateParam(2, ISCMService),
  __decorateParam(3, IQuickDiffService),
  __decorateParam(4, IEditorWorkerService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, ITextModelService),
  __decorateParam(7, IChatEditingService),
  __decorateParam(8, IProgressService)
], QuickDiffModel);
export {
  IQuickDiffModelService,
  QuickDiffModel,
  QuickDiffModelService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zY20vYnJvd3Nlci9xdWlja0RpZmZNb2RlbC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IFJlc291cmNlTWFwIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcbmltcG9ydCB7IGNyZWF0ZURlY29yYXRvciwgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBFbmNvZGluZ01vZGUsIElSZXNvbHZlZFRleHRGaWxlRWRpdG9yTW9kZWwsIGlzVGV4dEZpbGVFZGl0b3JNb2RlbCwgSVRleHRGaWxlRWRpdG9yTW9kZWwsIElUZXh0RmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy90ZXh0ZmlsZS9jb21tb24vdGV4dGZpbGVzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVNYXAsIERpc3Bvc2FibGVTdG9yZSwgSVJlZmVyZW5jZSwgUmVmZXJlbmNlQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBEaWZmQWxnb3JpdGhtTmFtZSwgSUVkaXRvcldvcmtlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL2VkaXRvcldvcmtlci5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJQ2hhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9kaWZmL2xlZ2FjeUxpbmVzRGlmZkNvbXB1dGVyLmpzJztcbmltcG9ydCB7IElSZXNvbHZlZFRleHRFZGl0b3JNb2RlbCwgSVRleHRNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3Jlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsLCBzaG91bGRTeW5jaHJvbml6ZU1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBjb21wYXJlQ2hhbmdlcywgZ2V0TW9kaWZpZWRFbmRMaW5lTnVtYmVyLCBJUXVpY2tEaWZmU2VydmljZSwgUXVpY2tEaWZmLCBRdWlja0RpZmZDaGFuZ2UsIFF1aWNrRGlmZlJlc3VsdCB9IGZyb20gJy4uL2NvbW1vbi9xdWlja0RpZmYuanMnO1xuaW1wb3J0IHsgVGhyb3R0bGVkRGVsYXllciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IElTQ01SZXBvc2l0b3J5LCBJU0NNU2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi9zY20uanMnO1xuaW1wb3J0IHsgc29ydGVkRGlmZiwgZXF1YWxzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IG9uVW5leHBlY3RlZEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEl0ZXJhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaXRlcmF0b3IuanMnO1xuaW1wb3J0IHsgSVNwbGljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3NlcXVlbmNlLmpzJztcbmltcG9ydCB7IERpZmZTdGF0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9kaWZmRWRpdG9yL2RpZmZFZGl0b3JWaWV3TW9kZWwuanMnO1xuaW1wb3J0IHsgdG9MaW5lQ2hhbmdlcyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9kaWZmRWRpdG9yL2RpZmZFZGl0b3JXaWRnZXQuanMnO1xuaW1wb3J0IHsgTGluZVJhbmdlTWFwcGluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vZGlmZi9yYW5nZU1hcHBpbmcuanMnO1xuaW1wb3J0IHsgSURpZmZFZGl0b3JNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSVByb2dyZXNzU2VydmljZSwgUHJvZ3Jlc3NMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyBJQ2hhdEVkaXRpbmdTZXJ2aWNlLCBXb3JraW5nU2V0RW50cnlTdGF0ZSB9IGZyb20gJy4uLy4uL2NoYXQvY29tbW9uL2NoYXRFZGl0aW5nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IGF1dG9ydW4sIGF1dG9ydW5XaXRoU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcblxuZXhwb3J0IGNvbnN0IElRdWlja0RpZmZNb2RlbFNlcnZpY2UgPSBjcmVhdGVEZWNvcmF0b3I8SVF1aWNrRGlmZk1vZGVsU2VydmljZT4oJ0lRdWlja0RpZmZNb2RlbFNlcnZpY2UnKTtcblxuZXhwb3J0IGludGVyZmFjZSBRdWlja0RpZmZNb2RlbE9wdGlvbnMge1xuXHRyZWFkb25seSBhbGdvcml0aG06IERpZmZBbGdvcml0aG1OYW1lO1xuXHRyZWFkb25seSBtYXhDb21wdXRhdGlvblRpbWVNcz86IG51bWJlcjtcbn1cblxuY29uc3QgZGVjb3JhdG9yUXVpY2tEaWZmTW9kZWxPcHRpb25zOiBRdWlja0RpZmZNb2RlbE9wdGlvbnMgPSB7XG5cdGFsZ29yaXRobTogJ2xlZ2FjeScsXG5cdG1heENvbXB1dGF0aW9uVGltZU1zOiAxMDAwXG59O1xuXG5leHBvcnQgaW50ZXJmYWNlIElRdWlja0RpZmZNb2RlbFNlcnZpY2Uge1xuXHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0LyoqXG5cdCAqIFJldHVybnMgYHVuZGVmaW5lZGAgaWYgdGhlIGVkaXRvciBtb2RlbCBpcyBub3QgcmVzb2x2ZWQuXG5cdCAqIE1vZGVsIHJlZnJlbmNlIGhhcyB0byBiZSBkaXNwb3NlZCBvbmNlIG5vdCBuZWVkZWQgYW55bW9yZS5cblx0ICogQHBhcmFtIHJlc291cmNlXG5cdCAqIEBwYXJhbSBvcHRpb25zXG5cdCAqL1xuXHRjcmVhdGVRdWlja0RpZmZNb2RlbFJlZmVyZW5jZShyZXNvdXJjZTogVVJJLCBvcHRpb25zPzogUXVpY2tEaWZmTW9kZWxPcHRpb25zKTogSVJlZmVyZW5jZTxRdWlja0RpZmZNb2RlbD4gfCB1bmRlZmluZWQ7XG59XG5cbmNsYXNzIFF1aWNrRGlmZk1vZGVsUmVmZXJlbmNlQ29sbGVjdGlvbiBleHRlbmRzIFJlZmVyZW5jZUNvbGxlY3Rpb248UXVpY2tEaWZmTW9kZWw+IHtcblx0Y29uc3RydWN0b3IoQElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlKSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBjcmVhdGVSZWZlcmVuY2VkT2JqZWN0KF9rZXk6IHN0cmluZywgdGV4dEZpbGVNb2RlbDogSVJlc29sdmVkVGV4dEZpbGVFZGl0b3JNb2RlbCwgb3B0aW9uczogUXVpY2tEaWZmTW9kZWxPcHRpb25zKTogUXVpY2tEaWZmTW9kZWwge1xuXHRcdHJldHVybiB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShRdWlja0RpZmZNb2RlbCwgdGV4dEZpbGVNb2RlbCwgb3B0aW9ucyk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgZGVzdHJveVJlZmVyZW5jZWRPYmplY3QoX2tleTogc3RyaW5nLCBvYmplY3Q6IFF1aWNrRGlmZk1vZGVsKTogdm9pZCB7XG5cdFx0b2JqZWN0LmRpc3Bvc2UoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUXVpY2tEaWZmTW9kZWxTZXJ2aWNlIGltcGxlbWVudHMgSVF1aWNrRGlmZk1vZGVsU2VydmljZSB7XG5cdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9yZWZlcmVuY2VzOiBRdWlja0RpZmZNb2RlbFJlZmVyZW5jZUNvbGxlY3Rpb247XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElUZXh0RmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZXh0RmlsZVNlcnZpY2U6IElUZXh0RmlsZVNlcnZpY2UsXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2Vcblx0KSB7XG5cdFx0dGhpcy5fcmVmZXJlbmNlcyA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUXVpY2tEaWZmTW9kZWxSZWZlcmVuY2VDb2xsZWN0aW9uKTtcblx0fVxuXG5cdGNyZWF0ZVF1aWNrRGlmZk1vZGVsUmVmZXJlbmNlKHJlc291cmNlOiBVUkksIG9wdGlvbnM6IFF1aWNrRGlmZk1vZGVsT3B0aW9ucyA9IGRlY29yYXRvclF1aWNrRGlmZk1vZGVsT3B0aW9ucyk6IElSZWZlcmVuY2U8UXVpY2tEaWZmTW9kZWw+IHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCB0ZXh0RmlsZU1vZGVsID0gdGhpcy50ZXh0RmlsZVNlcnZpY2UuZmlsZXMuZ2V0KHJlc291cmNlKTtcblx0XHRpZiAoIXRleHRGaWxlTW9kZWw/LmlzUmVzb2x2ZWQoKSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRyZXNvdXJjZSA9IHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmFzQ2Fub25pY2FsVXJpKHJlc291cmNlKS53aXRoKHsgcXVlcnk6IEpTT04uc3RyaW5naWZ5KG9wdGlvbnMpIH0pO1xuXHRcdHJldHVybiB0aGlzLl9yZWZlcmVuY2VzLmFjcXVpcmUocmVzb3VyY2UudG9TdHJpbmcoKSwgdGV4dEZpbGVNb2RlbCwgb3B0aW9ucyk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFF1aWNrRGlmZk1vZGVsIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSBfbW9kZWw6IElUZXh0RmlsZUVkaXRvck1vZGVsO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29yaWdpbmFsRWRpdG9yTW9kZWxzID0gbmV3IFJlc291cmNlTWFwPElSZXNvbHZlZFRleHRFZGl0b3JNb2RlbD4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfb3JpZ2luYWxFZGl0b3JNb2RlbHNEaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdGdldCBvcmlnaW5hbFRleHRNb2RlbHMoKTogSXRlcmFibGU8SVRleHRNb2RlbD4ge1xuXHRcdHJldHVybiBJdGVyYWJsZS5tYXAodGhpcy5fb3JpZ2luYWxFZGl0b3JNb2RlbHMudmFsdWVzKCksIGVkaXRvck1vZGVsID0+IGVkaXRvck1vZGVsLnRleHRFZGl0b3JNb2RlbCk7XG5cdH1cblxuXHRwcml2YXRlIF9kaXNwb3NlZCA9IGZhbHNlO1xuXHRwcml2YXRlIF9xdWlja0RpZmZzOiBRdWlja0RpZmZbXSA9IFtdO1xuXHRwcml2YXRlIF9xdWlja0RpZmZzUHJvbWlzZT86IFByb21pc2U8UXVpY2tEaWZmW10+O1xuXHRwcml2YXRlIF9kaWZmRGVsYXllciA9IG5ldyBUaHJvdHRsZWREZWxheWVyPHZvaWQ+KDIwMCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2UgPSBuZXcgRW1pdHRlcjx7IGNoYW5nZXM6IFF1aWNrRGlmZkNoYW5nZVtdOyBkaWZmOiBJU3BsaWNlPFF1aWNrRGlmZkNoYW5nZT5bXSB9PigpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZTogRXZlbnQ8eyBjaGFuZ2VzOiBRdWlja0RpZmZDaGFuZ2VbXTsgZGlmZjogSVNwbGljZTxRdWlja0RpZmZDaGFuZ2U+W10gfT4gPSB0aGlzLl9vbkRpZENoYW5nZS5ldmVudDtcblxuXHRwcml2YXRlIF9jaGFuZ2VzOiBRdWlja0RpZmZDaGFuZ2VbXSA9IFtdO1xuXHRnZXQgY2hhbmdlcygpOiBRdWlja0RpZmZDaGFuZ2VbXSB7IHJldHVybiB0aGlzLl9jaGFuZ2VzOyB9XG5cblx0LyoqXG5cdCAqIE1hcCBvZiBxdWljayBkaWZmIG5hbWUgdG8gdGhlIGluZGV4IG9mIHRoZSBjaGFuZ2UgaW4gYHRoaXMuY2hhbmdlc2Bcblx0ICovXG5cdHByaXZhdGUgX3F1aWNrRGlmZkNoYW5nZXM6IE1hcDxzdHJpbmcsIG51bWJlcltdPiA9IG5ldyBNYXAoKTtcblx0Z2V0IHF1aWNrRGlmZkNoYW5nZXMoKTogTWFwPHN0cmluZywgbnVtYmVyW10+IHsgcmV0dXJuIHRoaXMuX3F1aWNrRGlmZkNoYW5nZXM7IH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9yZXBvc2l0b3J5RGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZU1hcDxJU0NNUmVwb3NpdG9yeT4oKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHR0ZXh0RmlsZU1vZGVsOiBJUmVzb2x2ZWRUZXh0RmlsZUVkaXRvck1vZGVsLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgb3B0aW9uczogUXVpY2tEaWZmTW9kZWxPcHRpb25zLFxuXHRcdEBJU0NNU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHNjbVNlcnZpY2U6IElTQ01TZXJ2aWNlLFxuXHRcdEBJUXVpY2tEaWZmU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHF1aWNrRGlmZlNlcnZpY2U6IElRdWlja0RpZmZTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yV29ya2VyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvcldvcmtlclNlcnZpY2U6IElFZGl0b3JXb3JrZXJTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGV4dE1vZGVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRleHRNb2RlbFJlc29sdmVyU2VydmljZTogSVRleHRNb2RlbFNlcnZpY2UsXG5cdFx0QElDaGF0RWRpdGluZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY2hhdEVkaXRpbmdTZXJ2aWNlOiBJQ2hhdEVkaXRpbmdTZXJ2aWNlLFxuXHRcdEBJUHJvZ3Jlc3NTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcHJvZ3Jlc3NTZXJ2aWNlOiBJUHJvZ3Jlc3NTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX21vZGVsID0gdGV4dEZpbGVNb2RlbDtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRleHRGaWxlTW9kZWwudGV4dEVkaXRvck1vZGVsLm9uRGlkQ2hhbmdlQ29udGVudCgoKSA9PiB0aGlzLnRyaWdnZXJEaWZmKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihcblx0XHRcdEV2ZW50LmZpbHRlcihjb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24sXG5cdFx0XHRcdGUgPT4gZS5hZmZlY3RzQ29uZmlndXJhdGlvbignc2NtLmRpZmZEZWNvcmF0aW9uc0lnbm9yZVRyaW1XaGl0ZXNwYWNlJykgfHwgZS5hZmZlY3RzQ29uZmlndXJhdGlvbignZGlmZkVkaXRvci5pZ25vcmVUcmltV2hpdGVzcGFjZScpXG5cdFx0XHQpKHRoaXMudHJpZ2dlckRpZmYsIHRoaXMpXG5cdFx0KTtcblx0XHR0aGlzLl9yZWdpc3RlcihzY21TZXJ2aWNlLm9uRGlkQWRkUmVwb3NpdG9yeSh0aGlzLm9uRGlkQWRkUmVwb3NpdG9yeSwgdGhpcykpO1xuXHRcdGZvciAoY29uc3QgciBvZiBzY21TZXJ2aWNlLnJlcG9zaXRvcmllcykge1xuXHRcdFx0dGhpcy5vbkRpZEFkZFJlcG9zaXRvcnkocik7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fbW9kZWwub25EaWRDaGFuZ2VFbmNvZGluZygoKSA9PiB7XG5cdFx0XHR0aGlzLl9kaWZmRGVsYXllci5jYW5jZWwoKTtcblx0XHRcdHRoaXMuX3F1aWNrRGlmZnMgPSBbXTtcblx0XHRcdHRoaXMuX29yaWdpbmFsRWRpdG9yTW9kZWxzLmNsZWFyKCk7XG5cdFx0XHR0aGlzLl9xdWlja0RpZmZzUHJvbWlzZSA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMuc2V0Q2hhbmdlcyhbXSwgbmV3IE1hcCgpKTtcblx0XHRcdHRoaXMudHJpZ2dlckRpZmYoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnF1aWNrRGlmZlNlcnZpY2Uub25EaWRDaGFuZ2VRdWlja0RpZmZQcm92aWRlcnMoKCkgPT4gdGhpcy50cmlnZ2VyRGlmZigpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuV2l0aFN0b3JlKChyLCBzdG9yZSkgPT4ge1xuXHRcdFx0Zm9yIChjb25zdCBzZXNzaW9uIG9mIHRoaXMuX2NoYXRFZGl0aW5nU2VydmljZS5lZGl0aW5nU2Vzc2lvbnNPYnMucmVhZChyKSkge1xuXHRcdFx0XHRzdG9yZS5hZGQoYXV0b3J1bihyID0+IHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IGVudHJ5IG9mIHNlc3Npb24uZW50cmllcy5yZWFkKHIpKSB7XG5cdFx0XHRcdFx0XHRlbnRyeS5zdGF0ZS5yZWFkKHIpOyAvLyBzaWduYWxcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dGhpcy50cmlnZ2VyRGlmZigpO1xuXHRcdFx0XHR9KSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy50cmlnZ2VyRGlmZigpO1xuXHR9XG5cblx0Z2V0IHF1aWNrRGlmZnMoKTogcmVhZG9ubHkgUXVpY2tEaWZmW10ge1xuXHRcdHJldHVybiB0aGlzLl9xdWlja0RpZmZzO1xuXHR9XG5cblx0cHVibGljIGdldFF1aWNrRGlmZlJlc3VsdHMoKTogUXVpY2tEaWZmUmVzdWx0W10ge1xuXHRcdHJldHVybiB0aGlzLl9xdWlja0RpZmZzLm1hcChxdWlja0RpZmYgPT4ge1xuXHRcdFx0Y29uc3QgY2hhbmdlcyA9IHRoaXMuY2hhbmdlc1xuXHRcdFx0XHQuZmlsdGVyKGNoYW5nZSA9PiBjaGFuZ2UubGFiZWwgPT09IHF1aWNrRGlmZi5sYWJlbCk7XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGxhYmVsOiBxdWlja0RpZmYubGFiZWwsXG5cdFx0XHRcdG9yaWdpbmFsOiBxdWlja0RpZmYub3JpZ2luYWxSZXNvdXJjZSxcblx0XHRcdFx0bW9kaWZpZWQ6IHRoaXMuX21vZGVsLnJlc291cmNlLFxuXHRcdFx0XHRjaGFuZ2VzOiBjaGFuZ2VzLm1hcChjaGFuZ2UgPT4gY2hhbmdlLmNoYW5nZSksXG5cdFx0XHRcdGNoYW5nZXMyOiBjaGFuZ2VzLm1hcChjaGFuZ2UgPT4gY2hhbmdlLmNoYW5nZTIpXG5cdFx0XHR9O1xuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGdldERpZmZFZGl0b3JNb2RlbChvcmlnaW5hbFVyaTogVVJJKTogSURpZmZFZGl0b3JNb2RlbCB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgZWRpdG9yTW9kZWwgPSB0aGlzLl9vcmlnaW5hbEVkaXRvck1vZGVscy5nZXQob3JpZ2luYWxVcmkpO1xuXHRcdHJldHVybiBlZGl0b3JNb2RlbCA/XG5cdFx0XHR7XG5cdFx0XHRcdG1vZGlmaWVkOiB0aGlzLl9tb2RlbC50ZXh0RWRpdG9yTW9kZWwhLFxuXHRcdFx0XHRvcmlnaW5hbDogZWRpdG9yTW9kZWwudGV4dEVkaXRvck1vZGVsXG5cdFx0XHR9IDogdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZEFkZFJlcG9zaXRvcnkocmVwb3NpdG9yeTogSVNDTVJlcG9zaXRvcnkpOiB2b2lkIHtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChyZXBvc2l0b3J5LnByb3ZpZGVyLm9uRGlkQ2hhbmdlUmVzb3VyY2VzKHRoaXMudHJpZ2dlckRpZmYsIHRoaXMpKTtcblxuXHRcdGNvbnN0IG9uRGlkUmVtb3ZlUmVwb3NpdG9yeSA9IEV2ZW50LmZpbHRlcih0aGlzLnNjbVNlcnZpY2Uub25EaWRSZW1vdmVSZXBvc2l0b3J5LCByID0+IHIgPT09IHJlcG9zaXRvcnkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChvbkRpZFJlbW92ZVJlcG9zaXRvcnkoKCkgPT4gdGhpcy5fcmVwb3NpdG9yeURpc3Bvc2FibGVzLmRlbGV0ZUFuZERpc3Bvc2UocmVwb3NpdG9yeSkpKTtcblxuXHRcdHRoaXMuX3JlcG9zaXRvcnlEaXNwb3NhYmxlcy5zZXQocmVwb3NpdG9yeSwgZGlzcG9zYWJsZXMpO1xuXG5cdFx0dGhpcy50cmlnZ2VyRGlmZigpO1xuXHR9XG5cblx0cHJpdmF0ZSB0cmlnZ2VyRGlmZigpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX2RpZmZEZWxheWVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fZGlmZkRlbGF5ZXJcblx0XHRcdC50cmlnZ2VyKGFzeW5jICgpID0+IHtcblx0XHRcdFx0Y29uc3QgcmVzdWx0OiB7IGNoYW5nZXM6IFF1aWNrRGlmZkNoYW5nZVtdOyBtYXBDaGFuZ2VzOiBNYXA8c3RyaW5nLCBudW1iZXJbXT4gfSB8IG51bGwgPSBhd2FpdCB0aGlzLmRpZmYoKTtcblxuXHRcdFx0XHRjb25zdCBlZGl0b3JNb2RlbHMgPSBBcnJheS5mcm9tKHRoaXMuX29yaWdpbmFsRWRpdG9yTW9kZWxzLnZhbHVlcygpKTtcblx0XHRcdFx0aWYgKCFyZXN1bHQgfHwgdGhpcy5fZGlzcG9zZWQgfHwgdGhpcy5fbW9kZWwuaXNEaXNwb3NlZCgpIHx8IGVkaXRvck1vZGVscy5zb21lKGVkaXRvck1vZGVsID0+IGVkaXRvck1vZGVsLmlzRGlzcG9zZWQoKSkpIHtcblx0XHRcdFx0XHRyZXR1cm47IC8vIGRpc3Bvc2VkXG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLnNldENoYW5nZXMocmVzdWx0LmNoYW5nZXMsIHJlc3VsdC5tYXBDaGFuZ2VzKTtcblx0XHRcdH0pXG5cdFx0XHQuY2F0Y2goZXJyID0+IG9uVW5leHBlY3RlZEVycm9yKGVycikpO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRDaGFuZ2VzKGNoYW5nZXM6IFF1aWNrRGlmZkNoYW5nZVtdLCBtYXBDaGFuZ2VzOiBNYXA8c3RyaW5nLCBudW1iZXJbXT4pOiB2b2lkIHtcblx0XHRjb25zdCBkaWZmID0gc29ydGVkRGlmZih0aGlzLmNoYW5nZXMsIGNoYW5nZXMsIChhLCBiKSA9PiBjb21wYXJlQ2hhbmdlcyhhLmNoYW5nZSwgYi5jaGFuZ2UpKTtcblx0XHR0aGlzLl9jaGFuZ2VzID0gY2hhbmdlcztcblx0XHR0aGlzLl9xdWlja0RpZmZDaGFuZ2VzID0gbWFwQ2hhbmdlcztcblx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKHsgY2hhbmdlcywgZGlmZiB9KTtcblx0fVxuXG5cdHByaXZhdGUgZGlmZigpOiBQcm9taXNlPHsgY2hhbmdlczogUXVpY2tEaWZmQ2hhbmdlW107IG1hcENoYW5nZXM6IE1hcDxzdHJpbmcsIG51bWJlcltdPiB9IHwgbnVsbD4ge1xuXHRcdHJldHVybiB0aGlzLnByb2dyZXNzU2VydmljZS53aXRoUHJvZ3Jlc3MoeyBsb2NhdGlvbjogUHJvZ3Jlc3NMb2NhdGlvbi5TY20sIGRlbGF5OiAyNTAgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3Qgb3JpZ2luYWxVUklzID0gYXdhaXQgdGhpcy5nZXRRdWlja0RpZmZzUHJvbWlzZSgpO1xuXHRcdFx0aWYgKHRoaXMuX2Rpc3Bvc2VkIHx8IHRoaXMuX21vZGVsLmlzRGlzcG9zZWQoKSB8fCAob3JpZ2luYWxVUklzLmxlbmd0aCA9PT0gMCkpIHtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh7IGNoYW5nZXM6IFtdLCBtYXBDaGFuZ2VzOiBuZXcgTWFwKCkgfSk7IC8vIGRpc3Bvc2VkXG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGZpbHRlcmVkVG9EaWZmYWJsZSA9IG9yaWdpbmFsVVJJcy5maWx0ZXIocXVpY2tEaWZmID0+IHRoaXMuZWRpdG9yV29ya2VyU2VydmljZS5jYW5Db21wdXRlRGlydHlEaWZmKHF1aWNrRGlmZi5vcmlnaW5hbFJlc291cmNlLCB0aGlzLl9tb2RlbC5yZXNvdXJjZSkpO1xuXHRcdFx0aWYgKGZpbHRlcmVkVG9EaWZmYWJsZS5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh7IGNoYW5nZXM6IFtdLCBtYXBDaGFuZ2VzOiBuZXcgTWFwKCkgfSk7IC8vIEFsbCBmaWxlcyBhcmUgdG9vIGxhcmdlXG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGlnbm9yZVRyaW1XaGl0ZXNwYWNlU2V0dGluZyA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8J3RydWUnIHwgJ2ZhbHNlJyB8ICdpbmhlcml0Jz4oJ3NjbS5kaWZmRGVjb3JhdGlvbnNJZ25vcmVUcmltV2hpdGVzcGFjZScpO1xuXHRcdFx0Y29uc3QgaWdub3JlVHJpbVdoaXRlc3BhY2UgPSBpZ25vcmVUcmltV2hpdGVzcGFjZVNldHRpbmcgPT09ICdpbmhlcml0J1xuXHRcdFx0XHQ/IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oJ2RpZmZFZGl0b3IuaWdub3JlVHJpbVdoaXRlc3BhY2UnKVxuXHRcdFx0XHQ6IGlnbm9yZVRyaW1XaGl0ZXNwYWNlU2V0dGluZyAhPT0gJ2ZhbHNlJztcblxuXHRcdFx0Y29uc3QgYWxsRGlmZnM6IFF1aWNrRGlmZkNoYW5nZVtdID0gW107XG5cdFx0XHRmb3IgKGNvbnN0IHF1aWNrRGlmZiBvZiBmaWx0ZXJlZFRvRGlmZmFibGUpIHtcblx0XHRcdFx0Y29uc3QgZGlmZiA9IGF3YWl0IHRoaXMuX2RpZmYocXVpY2tEaWZmLm9yaWdpbmFsUmVzb3VyY2UsIHRoaXMuX21vZGVsLnJlc291cmNlLCBpZ25vcmVUcmltV2hpdGVzcGFjZSk7XG5cdFx0XHRcdGlmIChkaWZmLmNoYW5nZXMgJiYgZGlmZi5jaGFuZ2VzMiAmJiBkaWZmLmNoYW5nZXMubGVuZ3RoID09PSBkaWZmLmNoYW5nZXMyLmxlbmd0aCkge1xuXHRcdFx0XHRcdGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBkaWZmLmNoYW5nZXMubGVuZ3RoOyBpbmRleCsrKSB7XG5cdFx0XHRcdFx0XHRhbGxEaWZmcy5wdXNoKHtcblx0XHRcdFx0XHRcdFx0bGFiZWw6IHF1aWNrRGlmZi5sYWJlbCxcblx0XHRcdFx0XHRcdFx0b3JpZ2luYWw6IHF1aWNrRGlmZi5vcmlnaW5hbFJlc291cmNlLFxuXHRcdFx0XHRcdFx0XHRtb2RpZmllZDogdGhpcy5fbW9kZWwucmVzb3VyY2UsXG5cdFx0XHRcdFx0XHRcdGNoYW5nZTogZGlmZi5jaGFuZ2VzW2luZGV4XSxcblx0XHRcdFx0XHRcdFx0Y2hhbmdlMjogZGlmZi5jaGFuZ2VzMltpbmRleF1cblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Y29uc3Qgc29ydGVkID0gYWxsRGlmZnMuc29ydCgoYSwgYikgPT4gY29tcGFyZUNoYW5nZXMoYS5jaGFuZ2UsIGIuY2hhbmdlKSk7XG5cdFx0XHRjb25zdCBtYXA6IE1hcDxzdHJpbmcsIG51bWJlcltdPiA9IG5ldyBNYXAoKTtcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgc29ydGVkLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGxhYmVsID0gc29ydGVkW2ldLmxhYmVsO1xuXHRcdFx0XHRpZiAoIW1hcC5oYXMobGFiZWwpKSB7XG5cdFx0XHRcdFx0bWFwLnNldChsYWJlbCwgW10pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdG1hcC5nZXQobGFiZWwpIS5wdXNoKGkpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHsgY2hhbmdlczogc29ydGVkLCBtYXBDaGFuZ2VzOiBtYXAgfTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2RpZmYob3JpZ2luYWw6IFVSSSwgbW9kaWZpZWQ6IFVSSSwgaWdub3JlVHJpbVdoaXRlc3BhY2U6IGJvb2xlYW4pOiBQcm9taXNlPHsgY2hhbmdlczogcmVhZG9ubHkgSUNoYW5nZVtdIHwgbnVsbDsgY2hhbmdlczI6IHJlYWRvbmx5IExpbmVSYW5nZU1hcHBpbmdbXSB8IG51bGwgfT4ge1xuXHRcdGNvbnN0IG1heENvbXB1dGF0aW9uVGltZU1zID0gdGhpcy5vcHRpb25zLm1heENvbXB1dGF0aW9uVGltZU1zID8/IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSO1xuXG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5lZGl0b3JXb3JrZXJTZXJ2aWNlLmNvbXB1dGVEaWZmKG9yaWdpbmFsLCBtb2RpZmllZCwge1xuXHRcdFx0Y29tcHV0ZU1vdmVzOiBmYWxzZSwgaWdub3JlVHJpbVdoaXRlc3BhY2UsIG1heENvbXB1dGF0aW9uVGltZU1zXG5cdFx0fSwgdGhpcy5vcHRpb25zLmFsZ29yaXRobSk7XG5cblx0XHRyZXR1cm4geyBjaGFuZ2VzOiByZXN1bHQgPyB0b0xpbmVDaGFuZ2VzKERpZmZTdGF0ZS5mcm9tRGlmZlJlc3VsdChyZXN1bHQpKSA6IG51bGwsIGNoYW5nZXMyOiByZXN1bHQ/LmNoYW5nZXMgPz8gbnVsbCB9O1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRRdWlja0RpZmZzUHJvbWlzZSgpOiBQcm9taXNlPFF1aWNrRGlmZltdPiB7XG5cdFx0aWYgKHRoaXMuX3F1aWNrRGlmZnNQcm9taXNlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fcXVpY2tEaWZmc1Byb21pc2U7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcXVpY2tEaWZmc1Byb21pc2UgPSB0aGlzLmdldE9yaWdpbmFsUmVzb3VyY2UoKS50aGVuKGFzeW5jIChxdWlja0RpZmZzKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fZGlzcG9zZWQpIHsgLy8gZGlzcG9zZWRcblx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAocXVpY2tEaWZmcy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0dGhpcy5fcXVpY2tEaWZmcyA9IFtdO1xuXHRcdFx0XHR0aGlzLl9vcmlnaW5hbEVkaXRvck1vZGVscy5jbGVhcigpO1xuXHRcdFx0XHRyZXR1cm4gW107XG5cdFx0XHR9XG5cblx0XHRcdGlmIChlcXVhbHModGhpcy5fcXVpY2tEaWZmcywgcXVpY2tEaWZmcywgKGEsIGIpID0+IGEub3JpZ2luYWxSZXNvdXJjZS50b1N0cmluZygpID09PSBiLm9yaWdpbmFsUmVzb3VyY2UudG9TdHJpbmcoKSAmJiBhLmxhYmVsID09PSBiLmxhYmVsKSkge1xuXHRcdFx0XHRyZXR1cm4gcXVpY2tEaWZmcztcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fcXVpY2tEaWZmcyA9IHF1aWNrRGlmZnM7XG5cblx0XHRcdHRoaXMuX29yaWdpbmFsRWRpdG9yTW9kZWxzLmNsZWFyKCk7XG5cdFx0XHR0aGlzLl9vcmlnaW5hbEVkaXRvck1vZGVsc0Rpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0XHRyZXR1cm4gKGF3YWl0IFByb21pc2UuYWxsKHF1aWNrRGlmZnMubWFwKGFzeW5jIChxdWlja0RpZmYpID0+IHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRjb25zdCByZWYgPSBhd2FpdCB0aGlzLnRleHRNb2RlbFJlc29sdmVyU2VydmljZS5jcmVhdGVNb2RlbFJlZmVyZW5jZShxdWlja0RpZmYub3JpZ2luYWxSZXNvdXJjZSk7XG5cdFx0XHRcdFx0aWYgKHRoaXMuX2Rpc3Bvc2VkKSB7IC8vIGRpc3Bvc2VkXG5cdFx0XHRcdFx0XHRyZWYuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHRoaXMuX29yaWdpbmFsRWRpdG9yTW9kZWxzLnNldChxdWlja0RpZmYub3JpZ2luYWxSZXNvdXJjZSwgcmVmLm9iamVjdCk7XG5cblx0XHRcdFx0XHRpZiAoaXNUZXh0RmlsZUVkaXRvck1vZGVsKHJlZi5vYmplY3QpKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBlbmNvZGluZyA9IHRoaXMuX21vZGVsLmdldEVuY29kaW5nKCk7XG5cblx0XHRcdFx0XHRcdGlmIChlbmNvZGluZykge1xuXHRcdFx0XHRcdFx0XHRyZWYub2JqZWN0LnNldEVuY29kaW5nKGVuY29kaW5nLCBFbmNvZGluZ01vZGUuRGVjb2RlKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR0aGlzLl9vcmlnaW5hbEVkaXRvck1vZGVsc0Rpc3Bvc2FibGVzLmFkZChyZWYpO1xuXHRcdFx0XHRcdHRoaXMuX29yaWdpbmFsRWRpdG9yTW9kZWxzRGlzcG9zYWJsZXMuYWRkKHJlZi5vYmplY3QudGV4dEVkaXRvck1vZGVsLm9uRGlkQ2hhbmdlQ29udGVudCgoKSA9PiB0aGlzLnRyaWdnZXJEaWZmKCkpKTtcblxuXHRcdFx0XHRcdHJldHVybiBxdWlja0RpZmY7XG5cdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0cmV0dXJuIFtdOyAvLyBwb3NzaWJseSBpbnZhbGlkIHJlZmVyZW5jZVxuXHRcdFx0XHR9XG5cdFx0XHR9KSkpLmZsYXQoKTtcblx0XHR9KTtcblxuXHRcdHJldHVybiB0aGlzLl9xdWlja0RpZmZzUHJvbWlzZS5maW5hbGx5KCgpID0+IHtcblx0XHRcdHRoaXMuX3F1aWNrRGlmZnNQcm9taXNlID0gdW5kZWZpbmVkO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRPcmlnaW5hbFJlc291cmNlKCk6IFByb21pc2U8UXVpY2tEaWZmW10+IHtcblx0XHRpZiAodGhpcy5fZGlzcG9zZWQpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoW10pO1xuXHRcdH1cblx0XHRjb25zdCB1cmkgPSB0aGlzLl9tb2RlbC5yZXNvdXJjZTtcblxuXHRcdC8vIGRpc2FibGUgZGlydHkgZGlmZiB3aGVuIGRvaW5nIGNoYXQgZWRpdHNcblx0XHRjb25zdCBpc0JlaW5nTW9kaWZpZWRCeUNoYXRFZGl0cyA9IHRoaXMuX2NoYXRFZGl0aW5nU2VydmljZS5lZGl0aW5nU2Vzc2lvbnNPYnMuZ2V0KClcblx0XHRcdC5zb21lKHNlc3Npb24gPT4gc2Vzc2lvbi5nZXRFbnRyeSh1cmkpPy5zdGF0ZS5nZXQoKSA9PT0gV29ya2luZ1NldEVudHJ5U3RhdGUuTW9kaWZpZWQpO1xuXHRcdGlmIChpc0JlaW5nTW9kaWZpZWRCeUNoYXRFZGl0cykge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShbXSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaXNTeW5jaHJvbml6ZWQgPSB0aGlzLl9tb2RlbC50ZXh0RWRpdG9yTW9kZWwgPyBzaG91bGRTeW5jaHJvbml6ZU1vZGVsKHRoaXMuX21vZGVsLnRleHRFZGl0b3JNb2RlbCkgOiB1bmRlZmluZWQ7XG5cdFx0cmV0dXJuIHRoaXMucXVpY2tEaWZmU2VydmljZS5nZXRRdWlja0RpZmZzKHVyaSwgdGhpcy5fbW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpLCBpc1N5bmNocm9uaXplZCk7XG5cdH1cblxuXHRmaW5kTmV4dENsb3Nlc3RDaGFuZ2UobGluZU51bWJlcjogbnVtYmVyLCBpbmNsdXNpdmUgPSB0cnVlLCBwcm92aWRlcj86IHN0cmluZyk6IG51bWJlciB7XG5cdFx0bGV0IHByZWZlcnJlZFByb3ZpZGVyOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0aWYgKCFwcm92aWRlciAmJiBpbmNsdXNpdmUpIHtcblx0XHRcdHByZWZlcnJlZFByb3ZpZGVyID0gdGhpcy5xdWlja0RpZmZzLmZpbmQodmFsdWUgPT4gdmFsdWUuaXNTQ00pPy5sYWJlbDtcblx0XHR9XG5cblx0XHRjb25zdCBwb3NzaWJsZUNoYW5nZXM6IG51bWJlcltdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmNoYW5nZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGlmIChwcm92aWRlciAmJiB0aGlzLmNoYW5nZXNbaV0ubGFiZWwgIT09IHByb3ZpZGVyKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBTa2lwIHF1aWNrIGRpZmZzIHRoYXQgYXJlIG5vdCB2aXNpYmxlXG5cdFx0XHRpZiAoIXRoaXMucXVpY2tEaWZmcy5maW5kKHF1aWNrRGlmZiA9PiBxdWlja0RpZmYubGFiZWwgPT09IHRoaXMuY2hhbmdlc1tpXS5sYWJlbCk/LnZpc2libGUpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGNoYW5nZSA9IHRoaXMuY2hhbmdlc1tpXTtcblx0XHRcdGNvbnN0IHBvc3NpYmxlQ2hhbmdlc0xlbmd0aCA9IHBvc3NpYmxlQ2hhbmdlcy5sZW5ndGg7XG5cblx0XHRcdGlmIChpbmNsdXNpdmUpIHtcblx0XHRcdFx0aWYgKGdldE1vZGlmaWVkRW5kTGluZU51bWJlcihjaGFuZ2UuY2hhbmdlKSA+PSBsaW5lTnVtYmVyKSB7XG5cdFx0XHRcdFx0aWYgKHByZWZlcnJlZFByb3ZpZGVyICYmIGNoYW5nZS5sYWJlbCAhPT0gcHJlZmVycmVkUHJvdmlkZXIpIHtcblx0XHRcdFx0XHRcdHBvc3NpYmxlQ2hhbmdlcy5wdXNoKGkpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gaTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmIChjaGFuZ2UuY2hhbmdlLm1vZGlmaWVkU3RhcnRMaW5lTnVtYmVyID4gbGluZU51bWJlcikge1xuXHRcdFx0XHRcdHJldHVybiBpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoKHBvc3NpYmxlQ2hhbmdlcy5sZW5ndGggPiAwKSAmJiAocG9zc2libGVDaGFuZ2VzLmxlbmd0aCA9PT0gcG9zc2libGVDaGFuZ2VzTGVuZ3RoKSkge1xuXHRcdFx0XHRyZXR1cm4gcG9zc2libGVDaGFuZ2VzWzBdO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBwb3NzaWJsZUNoYW5nZXMubGVuZ3RoID4gMCA/IHBvc3NpYmxlQ2hhbmdlc1swXSA6IDA7XG5cdH1cblxuXHRmaW5kUHJldmlvdXNDbG9zZXN0Q2hhbmdlKGxpbmVOdW1iZXI6IG51bWJlciwgaW5jbHVzaXZlID0gdHJ1ZSwgcHJvdmlkZXI/OiBzdHJpbmcpOiBudW1iZXIge1xuXHRcdGZvciAobGV0IGkgPSB0aGlzLmNoYW5nZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcblx0XHRcdGlmIChwcm92aWRlciAmJiB0aGlzLmNoYW5nZXNbaV0ubGFiZWwgIT09IHByb3ZpZGVyKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBTa2lwIHF1aWNrIGRpZmZzIHRoYXQgYXJlIG5vdCB2aXNpYmxlXG5cdFx0XHRpZiAoIXRoaXMucXVpY2tEaWZmcy5maW5kKHF1aWNrRGlmZiA9PiBxdWlja0RpZmYubGFiZWwgPT09IHRoaXMuY2hhbmdlc1tpXS5sYWJlbCk/LnZpc2libGUpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGNoYW5nZSA9IHRoaXMuY2hhbmdlc1tpXS5jaGFuZ2U7XG5cblx0XHRcdGlmIChpbmNsdXNpdmUpIHtcblx0XHRcdFx0aWYgKGNoYW5nZS5tb2RpZmllZFN0YXJ0TGluZU51bWJlciA8PSBsaW5lTnVtYmVyKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmIChnZXRNb2RpZmllZEVuZExpbmVOdW1iZXIoY2hhbmdlKSA8IGxpbmVOdW1iZXIpIHtcblx0XHRcdFx0XHRyZXR1cm4gaTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmNoYW5nZXMubGVuZ3RoIC0gMTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fZGlzcG9zZWQgPSB0cnVlO1xuXG5cdFx0dGhpcy5fcXVpY2tEaWZmcyA9IFtdO1xuXHRcdHRoaXMuX2RpZmZEZWxheWVyLmNhbmNlbCgpO1xuXHRcdHRoaXMuX29yaWdpbmFsRWRpdG9yTW9kZWxzLmNsZWFyKCk7XG5cdFx0dGhpcy5fcmVwb3NpdG9yeURpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblxuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGlCQUFpQiw2QkFBNkI7QUFDdkQsU0FBUyxjQUE0Qyx1QkFBNkMsd0JBQXdCO0FBQzFILFNBQVMsWUFBWSxlQUFlLGlCQUE2QiwyQkFBMkI7QUFDNUYsU0FBNEIsNEJBQTRCO0FBQ3hELFNBQVMsMkJBQTJCO0FBR3BDLFNBQW1DLHlCQUF5QjtBQUM1RCxTQUFxQiw4QkFBOEI7QUFDbkQsU0FBUyxnQkFBZ0IsMEJBQTBCLHlCQUFzRTtBQUN6SCxTQUFTLHdCQUF3QjtBQUNqQyxTQUF5QixtQkFBbUI7QUFDNUMsU0FBUyxZQUFZLGNBQWM7QUFDbkMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxnQkFBZ0I7QUFFekIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxxQkFBcUI7QUFHOUIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxrQkFBa0Isd0JBQXdCO0FBQ25ELFNBQVMscUJBQXFCLDRCQUE0QjtBQUMxRCxTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLFNBQVMsd0JBQXdCO0FBRW5DLE1BQU0seUJBQXlCLGdCQUF3Qyx3QkFBd0I7QUFPdEcsTUFBTSxpQ0FBd0Q7QUFBQSxFQUM3RCxXQUFXO0FBQUEsRUFDWCxzQkFBc0I7QUFDdkI7QUFjQSxJQUFNLG9DQUFOLGNBQWdELG9CQUFvQztBQUFBLEVBQ25GLFlBQW9ELHVCQUE4QztBQUNqRyxVQUFNO0FBRDZDO0FBQUEsRUFFcEQ7QUFBQSxFQUVtQix1QkFBdUIsTUFBYyxlQUE2QyxTQUFnRDtBQUNwSixXQUFPLEtBQUssc0JBQXNCLGVBQWUsZ0JBQWdCLGVBQWUsT0FBTztBQUFBLEVBQ3hGO0FBQUEsRUFFbUIsd0JBQXdCLE1BQWMsUUFBOEI7QUFDdEYsV0FBTyxRQUFRO0FBQUEsRUFDaEI7QUFDRDtBQVpNLG9DQUFOO0FBQUEsRUFDYztBQUFBLEdBRFI7QUFjQyxJQUFNLHdCQUFOLE1BQThEO0FBQUEsRUFLcEUsWUFDeUMsc0JBQ0wsaUJBQ0csb0JBQ3JDO0FBSHVDO0FBQ0w7QUFDRztBQUV0QyxTQUFLLGNBQWMsS0FBSyxxQkFBcUIsZUFBZSxpQ0FBaUM7QUFBQSxFQUM5RjtBQUFBLEVBRUEsOEJBQThCLFVBQWUsVUFBaUMsZ0NBQXdFO0FBQ3JKLFVBQU0sZ0JBQWdCLEtBQUssZ0JBQWdCLE1BQU0sSUFBSSxRQUFRO0FBQzdELFFBQUksQ0FBQyxlQUFlLFdBQVcsR0FBRztBQUNqQyxhQUFPO0FBQUEsSUFDUjtBQUVBLGVBQVcsS0FBSyxtQkFBbUIsZUFBZSxRQUFRLEVBQUUsS0FBSyxFQUFFLE9BQU8sS0FBSyxVQUFVLE9BQU8sRUFBRSxDQUFDO0FBQ25HLFdBQU8sS0FBSyxZQUFZLFFBQVEsU0FBUyxTQUFTLEdBQUcsZUFBZSxPQUFPO0FBQUEsRUFDNUU7QUFDRDtBQXRCYSx3QkFBTjtBQUFBLEVBTUo7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBUlU7QUF3Qk4sSUFBTSxpQkFBTixjQUE2QixXQUFXO0FBQUEsRUE2QjlDLFlBQ0MsZUFDaUIsU0FDYSxZQUNNLGtCQUNHLHFCQUNDLHNCQUNKLDBCQUNFLHFCQUNILGlCQUNsQztBQUNELFVBQU07QUFUVztBQUNhO0FBQ007QUFDRztBQUNDO0FBQ0o7QUFDRTtBQUNIO0FBbENwQyxTQUFpQix3QkFBd0IsSUFBSSxZQUFzQztBQUNuRixTQUFpQixtQ0FBbUMsS0FBSyxVQUFVLElBQUksZ0JBQWdCLENBQUM7QUFLeEYsU0FBUSxZQUFZO0FBQ3BCLFNBQVEsY0FBMkIsQ0FBQztBQUVwQyxTQUFRLGVBQWUsSUFBSSxpQkFBdUIsR0FBRztBQUVyRCxTQUFpQixlQUFlLElBQUksUUFBMEU7QUFDOUcsU0FBUyxjQUF1RixLQUFLLGFBQWE7QUFFbEgsU0FBUSxXQUE4QixDQUFDO0FBTXZDO0FBQUE7QUFBQTtBQUFBLFNBQVEsb0JBQTJDLG9CQUFJLElBQUk7QUFHM0QsU0FBaUIseUJBQXlCLElBQUksY0FBOEI7QUFjM0UsU0FBSyxTQUFTO0FBRWQsU0FBSyxVQUFVLGNBQWMsZ0JBQWdCLG1CQUFtQixNQUFNLEtBQUssWUFBWSxDQUFDLENBQUM7QUFDekYsU0FBSztBQUFBLE1BQ0osTUFBTTtBQUFBLFFBQU8scUJBQXFCO0FBQUEsUUFDakMsT0FBSyxFQUFFLHFCQUFxQix5Q0FBeUMsS0FBSyxFQUFFLHFCQUFxQixpQ0FBaUM7QUFBQSxNQUNuSSxFQUFFLEtBQUssYUFBYSxJQUFJO0FBQUEsSUFDekI7QUFDQSxTQUFLLFVBQVUsV0FBVyxtQkFBbUIsS0FBSyxvQkFBb0IsSUFBSSxDQUFDO0FBQzNFLGVBQVcsS0FBSyxXQUFXLGNBQWM7QUFDeEMsV0FBSyxtQkFBbUIsQ0FBQztBQUFBLElBQzFCO0FBRUEsU0FBSyxVQUFVLEtBQUssT0FBTyxvQkFBb0IsTUFBTTtBQUNwRCxXQUFLLGFBQWEsT0FBTztBQUN6QixXQUFLLGNBQWMsQ0FBQztBQUNwQixXQUFLLHNCQUFzQixNQUFNO0FBQ2pDLFdBQUsscUJBQXFCO0FBQzFCLFdBQUssV0FBVyxDQUFDLEdBQUcsb0JBQUksSUFBSSxDQUFDO0FBQzdCLFdBQUssWUFBWTtBQUFBLElBQ2xCLENBQUMsQ0FBQztBQUVGLFNBQUssVUFBVSxLQUFLLGlCQUFpQiw4QkFBOEIsTUFBTSxLQUFLLFlBQVksQ0FBQyxDQUFDO0FBRTVGLFNBQUssVUFBVSxpQkFBaUIsQ0FBQyxHQUFHLFVBQVU7QUFDN0MsaUJBQVcsV0FBVyxLQUFLLG9CQUFvQixtQkFBbUIsS0FBSyxDQUFDLEdBQUc7QUFDMUUsY0FBTSxJQUFJLFFBQVEsQ0FBQUEsT0FBSztBQUN0QixxQkFBVyxTQUFTLFFBQVEsUUFBUSxLQUFLQSxFQUFDLEdBQUc7QUFDNUMsa0JBQU0sTUFBTSxLQUFLQSxFQUFDO0FBQUEsVUFDbkI7QUFDQSxlQUFLLFlBQVk7QUFBQSxRQUNsQixDQUFDLENBQUM7QUFBQSxNQUNIO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFFRixTQUFLLFlBQVk7QUFBQSxFQUNsQjtBQUFBLEVBdkVBLElBQUkscUJBQTJDO0FBQzlDLFdBQU8sU0FBUyxJQUFJLEtBQUssc0JBQXNCLE9BQU8sR0FBRyxpQkFBZSxZQUFZLGVBQWU7QUFBQSxFQUNwRztBQUFBLEVBV0EsSUFBSSxVQUE2QjtBQUFFLFdBQU8sS0FBSztBQUFBLEVBQVU7QUFBQSxFQU16RCxJQUFJLG1CQUEwQztBQUFFLFdBQU8sS0FBSztBQUFBLEVBQW1CO0FBQUEsRUFzRC9FLElBQUksYUFBbUM7QUFDdEMsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRU8sc0JBQXlDO0FBQy9DLFdBQU8sS0FBSyxZQUFZLElBQUksZUFBYTtBQUN4QyxZQUFNLFVBQVUsS0FBSyxRQUNuQixPQUFPLFlBQVUsT0FBTyxVQUFVLFVBQVUsS0FBSztBQUVuRCxhQUFPO0FBQUEsUUFDTixPQUFPLFVBQVU7QUFBQSxRQUNqQixVQUFVLFVBQVU7QUFBQSxRQUNwQixVQUFVLEtBQUssT0FBTztBQUFBLFFBQ3RCLFNBQVMsUUFBUSxJQUFJLFlBQVUsT0FBTyxNQUFNO0FBQUEsUUFDNUMsVUFBVSxRQUFRLElBQUksWUFBVSxPQUFPLE9BQU87QUFBQSxNQUMvQztBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVPLG1CQUFtQixhQUFnRDtBQUN6RSxVQUFNLGNBQWMsS0FBSyxzQkFBc0IsSUFBSSxXQUFXO0FBQzlELFdBQU8sY0FDTjtBQUFBLE1BQ0MsVUFBVSxLQUFLLE9BQU87QUFBQSxNQUN0QixVQUFVLFlBQVk7QUFBQSxJQUN2QixJQUFJO0FBQUEsRUFDTjtBQUFBLEVBRVEsbUJBQW1CLFlBQWtDO0FBQzVELFVBQU0sY0FBYyxJQUFJLGdCQUFnQjtBQUV4QyxnQkFBWSxJQUFJLFdBQVcsU0FBUyxxQkFBcUIsS0FBSyxhQUFhLElBQUksQ0FBQztBQUVoRixVQUFNLHdCQUF3QixNQUFNLE9BQU8sS0FBSyxXQUFXLHVCQUF1QixPQUFLLE1BQU0sVUFBVTtBQUN2RyxnQkFBWSxJQUFJLHNCQUFzQixNQUFNLEtBQUssdUJBQXVCLGlCQUFpQixVQUFVLENBQUMsQ0FBQztBQUVyRyxTQUFLLHVCQUF1QixJQUFJLFlBQVksV0FBVztBQUV2RCxTQUFLLFlBQVk7QUFBQSxFQUNsQjtBQUFBLEVBRVEsY0FBb0I7QUFDM0IsUUFBSSxDQUFDLEtBQUssY0FBYztBQUN2QjtBQUFBLElBQ0Q7QUFFQSxTQUFLLGFBQ0gsUUFBUSxZQUFZO0FBQ3BCLFlBQU0sU0FBbUYsTUFBTSxLQUFLLEtBQUs7QUFFekcsWUFBTSxlQUFlLE1BQU0sS0FBSyxLQUFLLHNCQUFzQixPQUFPLENBQUM7QUFDbkUsVUFBSSxDQUFDLFVBQVUsS0FBSyxhQUFhLEtBQUssT0FBTyxXQUFXLEtBQUssYUFBYSxLQUFLLGlCQUFlLFlBQVksV0FBVyxDQUFDLEdBQUc7QUFDeEg7QUFBQSxNQUNEO0FBRUEsV0FBSyxXQUFXLE9BQU8sU0FBUyxPQUFPLFVBQVU7QUFBQSxJQUNsRCxDQUFDLEVBQ0EsTUFBTSxTQUFPLGtCQUFrQixHQUFHLENBQUM7QUFBQSxFQUN0QztBQUFBLEVBRVEsV0FBVyxTQUE0QixZQUF5QztBQUN2RixVQUFNLE9BQU8sV0FBVyxLQUFLLFNBQVMsU0FBUyxDQUFDLEdBQUcsTUFBTSxlQUFlLEVBQUUsUUFBUSxFQUFFLE1BQU0sQ0FBQztBQUMzRixTQUFLLFdBQVc7QUFDaEIsU0FBSyxvQkFBb0I7QUFDekIsU0FBSyxhQUFhLEtBQUssRUFBRSxTQUFTLEtBQUssQ0FBQztBQUFBLEVBQ3pDO0FBQUEsRUFFUSxPQUEwRjtBQUNqRyxXQUFPLEtBQUssZ0JBQWdCLGFBQWEsRUFBRSxVQUFVLGlCQUFpQixLQUFLLE9BQU8sSUFBSSxHQUFHLFlBQVk7QUFDcEcsWUFBTSxlQUFlLE1BQU0sS0FBSyxxQkFBcUI7QUFDckQsVUFBSSxLQUFLLGFBQWEsS0FBSyxPQUFPLFdBQVcsS0FBTSxhQUFhLFdBQVcsR0FBSTtBQUM5RSxlQUFPLFFBQVEsUUFBUSxFQUFFLFNBQVMsQ0FBQyxHQUFHLFlBQVksb0JBQUksSUFBSSxFQUFFLENBQUM7QUFBQSxNQUM5RDtBQUVBLFlBQU0scUJBQXFCLGFBQWEsT0FBTyxlQUFhLEtBQUssb0JBQW9CLG9CQUFvQixVQUFVLGtCQUFrQixLQUFLLE9BQU8sUUFBUSxDQUFDO0FBQzFKLFVBQUksbUJBQW1CLFdBQVcsR0FBRztBQUNwQyxlQUFPLFFBQVEsUUFBUSxFQUFFLFNBQVMsQ0FBQyxHQUFHLFlBQVksb0JBQUksSUFBSSxFQUFFLENBQUM7QUFBQSxNQUM5RDtBQUVBLFlBQU0sOEJBQThCLEtBQUsscUJBQXFCLFNBQXVDLHlDQUF5QztBQUM5SSxZQUFNLHVCQUF1QixnQ0FBZ0MsWUFDMUQsS0FBSyxxQkFBcUIsU0FBa0IsaUNBQWlDLElBQzdFLGdDQUFnQztBQUVuQyxZQUFNLFdBQThCLENBQUM7QUFDckMsaUJBQVcsYUFBYSxvQkFBb0I7QUFDM0MsY0FBTSxPQUFPLE1BQU0sS0FBSyxNQUFNLFVBQVUsa0JBQWtCLEtBQUssT0FBTyxVQUFVLG9CQUFvQjtBQUNwRyxZQUFJLEtBQUssV0FBVyxLQUFLLFlBQVksS0FBSyxRQUFRLFdBQVcsS0FBSyxTQUFTLFFBQVE7QUFDbEYsbUJBQVMsUUFBUSxHQUFHLFFBQVEsS0FBSyxRQUFRLFFBQVEsU0FBUztBQUN6RCxxQkFBUyxLQUFLO0FBQUEsY0FDYixPQUFPLFVBQVU7QUFBQSxjQUNqQixVQUFVLFVBQVU7QUFBQSxjQUNwQixVQUFVLEtBQUssT0FBTztBQUFBLGNBQ3RCLFFBQVEsS0FBSyxRQUFRLEtBQUs7QUFBQSxjQUMxQixTQUFTLEtBQUssU0FBUyxLQUFLO0FBQUEsWUFDN0IsQ0FBQztBQUFBLFVBQ0Y7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUNBLFlBQU0sU0FBUyxTQUFTLEtBQUssQ0FBQyxHQUFHLE1BQU0sZUFBZSxFQUFFLFFBQVEsRUFBRSxNQUFNLENBQUM7QUFDekUsWUFBTSxNQUE2QixvQkFBSSxJQUFJO0FBQzNDLGVBQVMsSUFBSSxHQUFHLElBQUksT0FBTyxRQUFRLEtBQUs7QUFDdkMsY0FBTSxRQUFRLE9BQU8sQ0FBQyxFQUFFO0FBQ3hCLFlBQUksQ0FBQyxJQUFJLElBQUksS0FBSyxHQUFHO0FBQ3BCLGNBQUksSUFBSSxPQUFPLENBQUMsQ0FBQztBQUFBLFFBQ2xCO0FBQ0EsWUFBSSxJQUFJLEtBQUssRUFBRyxLQUFLLENBQUM7QUFBQSxNQUN2QjtBQUNBLGFBQU8sRUFBRSxTQUFTLFFBQVEsWUFBWSxJQUFJO0FBQUEsSUFDM0MsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLE1BQWMsTUFBTSxVQUFlLFVBQWUsc0JBQThIO0FBQy9LLFVBQU0sdUJBQXVCLEtBQUssUUFBUSx3QkFBd0IsT0FBTztBQUV6RSxVQUFNLFNBQVMsTUFBTSxLQUFLLG9CQUFvQixZQUFZLFVBQVUsVUFBVTtBQUFBLE1BQzdFLGNBQWM7QUFBQSxNQUFPO0FBQUEsTUFBc0I7QUFBQSxJQUM1QyxHQUFHLEtBQUssUUFBUSxTQUFTO0FBRXpCLFdBQU8sRUFBRSxTQUFTLFNBQVMsY0FBYyxVQUFVLGVBQWUsTUFBTSxDQUFDLElBQUksTUFBTSxVQUFVLFFBQVEsV0FBVyxLQUFLO0FBQUEsRUFDdEg7QUFBQSxFQUVRLHVCQUE2QztBQUNwRCxRQUFJLEtBQUssb0JBQW9CO0FBQzVCLGFBQU8sS0FBSztBQUFBLElBQ2I7QUFFQSxTQUFLLHFCQUFxQixLQUFLLG9CQUFvQixFQUFFLEtBQUssT0FBTyxlQUFlO0FBQy9FLFVBQUksS0FBSyxXQUFXO0FBQ25CLGVBQU8sQ0FBQztBQUFBLE1BQ1Q7QUFFQSxVQUFJLFdBQVcsV0FBVyxHQUFHO0FBQzVCLGFBQUssY0FBYyxDQUFDO0FBQ3BCLGFBQUssc0JBQXNCLE1BQU07QUFDakMsZUFBTyxDQUFDO0FBQUEsTUFDVDtBQUVBLFVBQUksT0FBTyxLQUFLLGFBQWEsWUFBWSxDQUFDLEdBQUcsTUFBTSxFQUFFLGlCQUFpQixTQUFTLE1BQU0sRUFBRSxpQkFBaUIsU0FBUyxLQUFLLEVBQUUsVUFBVSxFQUFFLEtBQUssR0FBRztBQUMzSSxlQUFPO0FBQUEsTUFDUjtBQUVBLFdBQUssY0FBYztBQUVuQixXQUFLLHNCQUFzQixNQUFNO0FBQ2pDLFdBQUssaUNBQWlDLE1BQU07QUFDNUMsY0FBUSxNQUFNLFFBQVEsSUFBSSxXQUFXLElBQUksT0FBTyxjQUFjO0FBQzdELFlBQUk7QUFDSCxnQkFBTSxNQUFNLE1BQU0sS0FBSyx5QkFBeUIscUJBQXFCLFVBQVUsZ0JBQWdCO0FBQy9GLGNBQUksS0FBSyxXQUFXO0FBQ25CLGdCQUFJLFFBQVE7QUFDWixtQkFBTyxDQUFDO0FBQUEsVUFDVDtBQUVBLGVBQUssc0JBQXNCLElBQUksVUFBVSxrQkFBa0IsSUFBSSxNQUFNO0FBRXJFLGNBQUksc0JBQXNCLElBQUksTUFBTSxHQUFHO0FBQ3RDLGtCQUFNLFdBQVcsS0FBSyxPQUFPLFlBQVk7QUFFekMsZ0JBQUksVUFBVTtBQUNiLGtCQUFJLE9BQU8sWUFBWSxVQUFVLGFBQWEsTUFBTTtBQUFBLFlBQ3JEO0FBQUEsVUFDRDtBQUVBLGVBQUssaUNBQWlDLElBQUksR0FBRztBQUM3QyxlQUFLLGlDQUFpQyxJQUFJLElBQUksT0FBTyxnQkFBZ0IsbUJBQW1CLE1BQU0sS0FBSyxZQUFZLENBQUMsQ0FBQztBQUVqSCxpQkFBTztBQUFBLFFBQ1IsU0FBUyxPQUFPO0FBQ2YsaUJBQU8sQ0FBQztBQUFBLFFBQ1Q7QUFBQSxNQUNELENBQUMsQ0FBQyxHQUFHLEtBQUs7QUFBQSxJQUNYLENBQUM7QUFFRCxXQUFPLEtBQUssbUJBQW1CLFFBQVEsTUFBTTtBQUM1QyxXQUFLLHFCQUFxQjtBQUFBLElBQzNCLENBQUM7QUFBQSxFQUNGO0FBQUEsRUFFQSxNQUFjLHNCQUE0QztBQUN6RCxRQUFJLEtBQUssV0FBVztBQUNuQixhQUFPLFFBQVEsUUFBUSxDQUFDLENBQUM7QUFBQSxJQUMxQjtBQUNBLFVBQU0sTUFBTSxLQUFLLE9BQU87QUFHeEIsVUFBTSw2QkFBNkIsS0FBSyxvQkFBb0IsbUJBQW1CLElBQUksRUFDakYsS0FBSyxhQUFXLFFBQVEsU0FBUyxHQUFHLEdBQUcsTUFBTSxJQUFJLE1BQU0scUJBQXFCLFFBQVE7QUFDdEYsUUFBSSw0QkFBNEI7QUFDL0IsYUFBTyxRQUFRLFFBQVEsQ0FBQyxDQUFDO0FBQUEsSUFDMUI7QUFFQSxVQUFNLGlCQUFpQixLQUFLLE9BQU8sa0JBQWtCLHVCQUF1QixLQUFLLE9BQU8sZUFBZSxJQUFJO0FBQzNHLFdBQU8sS0FBSyxpQkFBaUIsY0FBYyxLQUFLLEtBQUssT0FBTyxjQUFjLEdBQUcsY0FBYztBQUFBLEVBQzVGO0FBQUEsRUFFQSxzQkFBc0IsWUFBb0IsWUFBWSxNQUFNLFVBQTJCO0FBQ3RGLFFBQUk7QUFDSixRQUFJLENBQUMsWUFBWSxXQUFXO0FBQzNCLDBCQUFvQixLQUFLLFdBQVcsS0FBSyxXQUFTLE1BQU0sS0FBSyxHQUFHO0FBQUEsSUFDakU7QUFFQSxVQUFNLGtCQUE0QixDQUFDO0FBQ25DLGFBQVMsSUFBSSxHQUFHLElBQUksS0FBSyxRQUFRLFFBQVEsS0FBSztBQUM3QyxVQUFJLFlBQVksS0FBSyxRQUFRLENBQUMsRUFBRSxVQUFVLFVBQVU7QUFDbkQ7QUFBQSxNQUNEO0FBR0EsVUFBSSxDQUFDLEtBQUssV0FBVyxLQUFLLGVBQWEsVUFBVSxVQUFVLEtBQUssUUFBUSxDQUFDLEVBQUUsS0FBSyxHQUFHLFNBQVM7QUFDM0Y7QUFBQSxNQUNEO0FBRUEsWUFBTSxTQUFTLEtBQUssUUFBUSxDQUFDO0FBQzdCLFlBQU0sd0JBQXdCLGdCQUFnQjtBQUU5QyxVQUFJLFdBQVc7QUFDZCxZQUFJLHlCQUF5QixPQUFPLE1BQU0sS0FBSyxZQUFZO0FBQzFELGNBQUkscUJBQXFCLE9BQU8sVUFBVSxtQkFBbUI7QUFDNUQsNEJBQWdCLEtBQUssQ0FBQztBQUFBLFVBQ3ZCLE9BQU87QUFDTixtQkFBTztBQUFBLFVBQ1I7QUFBQSxRQUNEO0FBQUEsTUFDRCxPQUFPO0FBQ04sWUFBSSxPQUFPLE9BQU8sMEJBQTBCLFlBQVk7QUFDdkQsaUJBQU87QUFBQSxRQUNSO0FBQUEsTUFDRDtBQUNBLFVBQUssZ0JBQWdCLFNBQVMsS0FBTyxnQkFBZ0IsV0FBVyx1QkFBd0I7QUFDdkYsZUFBTyxnQkFBZ0IsQ0FBQztBQUFBLE1BQ3pCO0FBQUEsSUFDRDtBQUVBLFdBQU8sZ0JBQWdCLFNBQVMsSUFBSSxnQkFBZ0IsQ0FBQyxJQUFJO0FBQUEsRUFDMUQ7QUFBQSxFQUVBLDBCQUEwQixZQUFvQixZQUFZLE1BQU0sVUFBMkI7QUFDMUYsYUFBUyxJQUFJLEtBQUssUUFBUSxTQUFTLEdBQUcsS0FBSyxHQUFHLEtBQUs7QUFDbEQsVUFBSSxZQUFZLEtBQUssUUFBUSxDQUFDLEVBQUUsVUFBVSxVQUFVO0FBQ25EO0FBQUEsTUFDRDtBQUdBLFVBQUksQ0FBQyxLQUFLLFdBQVcsS0FBSyxlQUFhLFVBQVUsVUFBVSxLQUFLLFFBQVEsQ0FBQyxFQUFFLEtBQUssR0FBRyxTQUFTO0FBQzNGO0FBQUEsTUFDRDtBQUVBLFlBQU0sU0FBUyxLQUFLLFFBQVEsQ0FBQyxFQUFFO0FBRS9CLFVBQUksV0FBVztBQUNkLFlBQUksT0FBTywyQkFBMkIsWUFBWTtBQUNqRCxpQkFBTztBQUFBLFFBQ1I7QUFBQSxNQUNELE9BQU87QUFDTixZQUFJLHlCQUF5QixNQUFNLElBQUksWUFBWTtBQUNsRCxpQkFBTztBQUFBLFFBQ1I7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUVBLFdBQU8sS0FBSyxRQUFRLFNBQVM7QUFBQSxFQUM5QjtBQUFBLEVBRVMsVUFBZ0I7QUFDeEIsU0FBSyxZQUFZO0FBRWpCLFNBQUssY0FBYyxDQUFDO0FBQ3BCLFNBQUssYUFBYSxPQUFPO0FBQ3pCLFNBQUssc0JBQXNCLE1BQU07QUFDakMsU0FBSyx1QkFBdUIsUUFBUTtBQUVwQyxVQUFNLFFBQVE7QUFBQSxFQUNmO0FBQ0Q7QUFqV2EsaUJBQU47QUFBQSxFQWdDSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBdENVOyIsCiAgIm5hbWVzIjogWyJyIl0KfQo=
