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
import { LazyStatefulPromise, raceTimeout } from "../../../../base/common/async.js";
import { BugIndicatingError, onUnexpectedError } from "../../../../base/common/errors.js";
import { Event, ValueWithChangeEvent } from "../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { parse } from "../../../../base/common/marshalling.js";
import { Schemas } from "../../../../base/common/network.js";
import { deepClone } from "../../../../base/common/objects.js";
import { ObservableLazyPromise, ValueWithChangeEventFromObservable, autorun, constObservable, derived, mapObservableArrayCached, observableFromEvent, observableFromValueWithChangeEvent, observableValue, recomputeInitiallyAndOnChange } from "../../../../base/common/observable.js";
import { isDefined, isObject } from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import { RefCounted } from "../../../../editor/browser/widget/diffEditor/utils.js";
import { MultiDiffEditorViewModel } from "../../../../editor/browser/widget/multiDiffEditor/multiDiffEditorViewModel.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { localize } from "../../../../nls.js";
import { ConfirmResult } from "../../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { DEFAULT_EDITOR_ASSOCIATION, EditorInputCapabilities } from "../../../common/editor.js";
import { EditorInput } from "../../../common/editor/editorInput.js";
import { IEditorResolverService, RegisteredEditorPriority } from "../../../services/editor/common/editorResolverService.js";
import { ITextFileService } from "../../../services/textfile/common/textfiles.js";
import { MultiDiffEditorIcon } from "./icons.contribution.js";
import { IMultiDiffSourceResolverService, MultiDiffEditorItem } from "./multiDiffSourceResolverService.js";
let MultiDiffEditorInput = class extends EditorInput {
  constructor(multiDiffSource, label, initialResources, isTransient = false, _textModelService, _textResourceConfigurationService, _instantiationService, _multiDiffSourceResolverService, _textFileService) {
    super();
    this.multiDiffSource = multiDiffSource;
    this.label = label;
    this.initialResources = initialResources;
    this.isTransient = isTransient;
    this._textModelService = _textModelService;
    this._textResourceConfigurationService = _textResourceConfigurationService;
    this._instantiationService = _instantiationService;
    this._multiDiffSourceResolverService = _multiDiffSourceResolverService;
    this._textFileService = _textFileService;
    this._name = "";
    this._viewModel = new LazyStatefulPromise(async () => {
      const model = await this._createModel();
      this._register(model);
      const vm = new MultiDiffEditorViewModel(model, this._instantiationService);
      this._register(vm);
      await raceTimeout(vm.waitForDiffs(), 1e3);
      return vm;
    });
    this._resolvedSource = new ObservableLazyPromise(async () => {
      const source = this.initialResources ? { resources: ValueWithChangeEvent.const(this.initialResources) } : await this._multiDiffSourceResolverService.resolve(this.multiDiffSource);
      return {
        source,
        resources: source ? observableFromValueWithChangeEvent(this, source.resources) : constObservable([])
      };
    });
    this.resources = derived(this, (reader) => this._resolvedSource.cachedPromiseResult.read(reader)?.data?.resources.read(reader));
    this.textFileServiceOnDidChange = new FastEventDispatcher(
      this._textFileService.files.onDidChangeDirty,
      (item) => item.resource.toString(),
      (uri) => uri.toString()
    );
    this._isDirtyObservables = mapObservableArrayCached(this, this.resources.map((r) => r ?? []), (res) => {
      const isModifiedDirty = res.modifiedUri ? isUriDirty(this.textFileServiceOnDidChange, this._textFileService, res.modifiedUri) : constObservable(false);
      const isOriginalDirty = res.originalUri ? isUriDirty(this.textFileServiceOnDidChange, this._textFileService, res.originalUri) : constObservable(false);
      return derived((reader) => (
        /** @description modifiedDirty||originalDirty */
        isModifiedDirty.read(reader) || isOriginalDirty.read(reader)
      ));
    }, (i) => i.getKey());
    this._isDirtyObservable = derived(this, (reader) => this._isDirtyObservables.read(reader).some((isDirty) => isDirty.read(reader))).keepObserved(this._store);
    this.onDidChangeDirty = Event.fromObservableLight(this._isDirtyObservable);
    this.closeHandler = {
      // This is a workaround for not having a better way
      // to figure out if the editors this input wraps
      // around are opened or not
      async confirm() {
        return ConfirmResult.DONT_SAVE;
      },
      showConfirm() {
        return false;
      }
    };
    this._register(autorun((reader) => {
      const resources = this.resources.read(reader);
      const label2 = this.label ?? localize("name", "Multi Diff Editor");
      if (resources && resources.length === 1) {
        this._name = localize({ key: "nameWithOneFile", comment: ["{0} is the name of the editor"] }, "{0} (1 file)", label2);
      } else if (resources) {
        this._name = localize({ key: "nameWithFiles", comment: ["{0} is the name of the editor", "{1} is the number of files being shown"] }, "{0} ({1} files)", label2, resources.length);
      } else {
        this._name = label2;
      }
      this._onDidChangeLabel.fire();
    }));
  }
  static fromResourceMultiDiffEditorInput(input, instantiationService) {
    if (!input.multiDiffSource && !input.resources) {
      throw new BugIndicatingError("MultiDiffEditorInput requires either multiDiffSource or resources");
    }
    const multiDiffSource = input.multiDiffSource ?? URI.parse(`multi-diff-editor:${(/* @__PURE__ */ new Date()).getMilliseconds().toString() + Math.random().toString()}`);
    return instantiationService.createInstance(
      MultiDiffEditorInput,
      multiDiffSource,
      input.label,
      input.resources?.map((resource) => {
        return new MultiDiffEditorItem(
          resource.original.resource,
          resource.modified.resource,
          resource.goToFileResource
        );
      }),
      input.isTransient ?? false
    );
  }
  static fromSerialized(data, instantiationService) {
    return instantiationService.createInstance(
      MultiDiffEditorInput,
      URI.parse(data.multiDiffSourceUri),
      data.label,
      data.resources?.map((resource) => new MultiDiffEditorItem(
        resource.originalUri ? URI.parse(resource.originalUri) : void 0,
        resource.modifiedUri ? URI.parse(resource.modifiedUri) : void 0,
        resource.goToFileUri ? URI.parse(resource.goToFileUri) : void 0
      )),
      false
    );
  }
  get resource() {
    return this.multiDiffSource;
  }
  get capabilities() {
    return EditorInputCapabilities.Readonly;
  }
  get typeId() {
    return MultiDiffEditorInput.ID;
  }
  getName() {
    return this._name;
  }
  get editorId() {
    return DEFAULT_EDITOR_ASSOCIATION.id;
  }
  getIcon() {
    return MultiDiffEditorIcon;
  }
  serialize() {
    return {
      label: this.label,
      multiDiffSourceUri: this.multiDiffSource.toString(),
      resources: this.initialResources?.map((resource) => ({
        originalUri: resource.originalUri?.toString(),
        modifiedUri: resource.modifiedUri?.toString(),
        goToFileUri: resource.goToFileUri?.toString()
      }))
    };
  }
  setLanguageId(languageId, source) {
    const activeDiffItem = this._viewModel.requireValue().activeDiffItem.get();
    const value = activeDiffItem?.documentDiffItem;
    if (!value) {
      return;
    }
    const target = value.modified ?? value.original;
    if (!target) {
      return;
    }
    target.setLanguage(languageId, source);
  }
  async getViewModel() {
    return this._viewModel.getPromise();
  }
  async _createModel() {
    const source = await this._resolvedSource.getPromise();
    const textResourceConfigurationService = this._textResourceConfigurationService;
    const documentsWithPromises = mapObservableArrayCached(this, source.resources, async (r, store) => {
      let original;
      let modified;
      const multiDiffItemStore = new DisposableStore();
      try {
        [original, modified] = await Promise.all([
          r.originalUri ? this._textModelService.createModelReference(r.originalUri) : void 0,
          r.modifiedUri ? this._textModelService.createModelReference(r.modifiedUri) : void 0
        ]);
        if (original) {
          multiDiffItemStore.add(original);
        }
        if (modified) {
          multiDiffItemStore.add(modified);
        }
      } catch (e) {
        console.error(e);
        onUnexpectedError(e);
        return void 0;
      }
      const uri = r.modifiedUri ?? r.originalUri;
      const result2 = {
        multiDiffEditorItem: r,
        original: original?.object.textEditorModel,
        modified: modified?.object.textEditorModel,
        contextKeys: r.contextKeys,
        get options() {
          return {
            ...getReadonlyConfiguration(modified?.object.isReadonly() ?? true),
            ...computeOptions(textResourceConfigurationService.getValue(uri))
          };
        },
        onOptionsDidChange: (h) => this._textResourceConfigurationService.onDidChangeConfiguration((e) => {
          if (e.affectsConfiguration(uri, "editor") || e.affectsConfiguration(uri, "diffEditor")) {
            h();
          }
        })
      };
      return store.add(RefCounted.createOfNonDisposable(result2, multiDiffItemStore, this));
    }, (i) => JSON.stringify([i.modifiedUri?.toString(), i.originalUri?.toString()]));
    const documents = observableValue("documents", "loading");
    const updateDocuments = derived(async (reader) => {
      const docsPromises = documentsWithPromises.read(reader);
      const docs = await Promise.all(docsPromises);
      const newDocuments = docs.filter(isDefined);
      documents.set(newDocuments, void 0);
    });
    const a = recomputeInitiallyAndOnChange(updateDocuments);
    await updateDocuments.get();
    const result = {
      dispose: () => a.dispose(),
      documents: new ValueWithChangeEventFromObservable(documents),
      contextKeys: source.source?.contextKeys
    };
    return result;
  }
  matches(otherInput) {
    if (super.matches(otherInput)) {
      return true;
    }
    if (otherInput instanceof MultiDiffEditorInput) {
      return this.multiDiffSource.toString() === otherInput.multiDiffSource.toString();
    }
    return false;
  }
  isDirty() {
    return this._isDirtyObservable.get();
  }
  async save(group, options) {
    await this.doSaveOrRevert("save", group, options);
    return this;
  }
  revert(group, options) {
    return this.doSaveOrRevert("revert", group, options);
  }
  async doSaveOrRevert(mode, group, options) {
    const items = this._viewModel.currentValue?.items.get();
    if (items) {
      await Promise.all(items.map(async (item) => {
        const model = item.diffEditorViewModel.model;
        const handleOriginal = model.original.uri.scheme !== Schemas.untitled && this._textFileService.isDirty(model.original.uri);
        await Promise.all([
          handleOriginal ? mode === "save" ? this._textFileService.save(model.original.uri, options) : this._textFileService.revert(model.original.uri, options) : Promise.resolve(),
          mode === "save" ? this._textFileService.save(model.modified.uri, options) : this._textFileService.revert(model.modified.uri, options)
        ]);
      }));
    }
    return void 0;
  }
};
MultiDiffEditorInput.ID = "workbench.input.multiDiffEditor";
MultiDiffEditorInput = __decorateClass([
  __decorateParam(4, ITextModelService),
  __decorateParam(5, ITextResourceConfigurationService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IMultiDiffSourceResolverService),
  __decorateParam(8, ITextFileService)
], MultiDiffEditorInput);
class FastEventDispatcher {
  constructor(_event, _getEventArgsKey, _keyToString) {
    this._event = _event;
    this._getEventArgsKey = _getEventArgsKey;
    this._keyToString = _keyToString;
    this._count = 0;
    this._buckets = /* @__PURE__ */ new Map();
    this._handleEventChange = (e) => {
      const key = this._getEventArgsKey(e);
      const bucket = this._buckets.get(key);
      if (bucket) {
        for (const listener of bucket) {
          listener(e);
        }
      }
    };
  }
  filteredEvent(filter) {
    return (listener) => {
      const key = this._keyToString(filter);
      let bucket = this._buckets.get(key);
      if (!bucket) {
        bucket = /* @__PURE__ */ new Set();
        this._buckets.set(key, bucket);
      }
      bucket.add(listener);
      this._count++;
      if (this._count === 1) {
        this._eventSubscription = this._event(this._handleEventChange);
      }
      return {
        dispose: () => {
          bucket.delete(listener);
          if (bucket.size === 0) {
            this._buckets.delete(key);
          }
          this._count--;
          if (this._count === 0) {
            this._eventSubscription?.dispose();
            this._eventSubscription = void 0;
          }
        }
      };
    };
  }
}
function isUriDirty(onDidChangeDirty, textFileService, uri) {
  return observableFromEvent(onDidChangeDirty.filteredEvent(uri), () => textFileService.isDirty(uri));
}
function getReadonlyConfiguration(isReadonly) {
  return {
    readOnly: !!isReadonly,
    readOnlyMessage: typeof isReadonly !== "boolean" ? isReadonly : void 0
  };
}
function computeOptions(configuration) {
  const editorConfiguration = deepClone(configuration.editor);
  if (isObject(configuration.diffEditor)) {
    const diffEditorConfiguration = deepClone(configuration.diffEditor);
    diffEditorConfiguration.diffCodeLens = diffEditorConfiguration.codeLens;
    delete diffEditorConfiguration.codeLens;
    diffEditorConfiguration.diffWordWrap = diffEditorConfiguration.wordWrap;
    delete diffEditorConfiguration.wordWrap;
    Object.assign(editorConfiguration, diffEditorConfiguration);
  }
  return editorConfiguration;
}
let MultiDiffEditorResolverContribution = class extends Disposable {
  constructor(editorResolverService, instantiationService) {
    super();
    this._register(editorResolverService.registerEditor(
      `*`,
      {
        id: DEFAULT_EDITOR_ASSOCIATION.id,
        label: DEFAULT_EDITOR_ASSOCIATION.displayName,
        detail: DEFAULT_EDITOR_ASSOCIATION.providerDisplayName,
        priority: RegisteredEditorPriority.builtin
      },
      {},
      {
        createMultiDiffEditorInput: (multiDiffEditor) => {
          return {
            editor: MultiDiffEditorInput.fromResourceMultiDiffEditorInput(multiDiffEditor, instantiationService)
          };
        }
      }
    ));
  }
};
MultiDiffEditorResolverContribution.ID = "workbench.contrib.multiDiffEditorResolver";
MultiDiffEditorResolverContribution = __decorateClass([
  __decorateParam(0, IEditorResolverService),
  __decorateParam(1, IInstantiationService)
], MultiDiffEditorResolverContribution);
class MultiDiffEditorSerializer {
  canSerialize(editor) {
    return editor instanceof MultiDiffEditorInput && !editor.isTransient;
  }
  serialize(editor) {
    if (!this.canSerialize(editor)) {
      return void 0;
    }
    return JSON.stringify(editor.serialize());
  }
  deserialize(instantiationService, serializedEditor) {
    try {
      const data = parse(serializedEditor);
      return MultiDiffEditorInput.fromSerialized(data, instantiationService);
    } catch (err) {
      onUnexpectedError(err);
      return void 0;
    }
  }
}
export {
  MultiDiffEditorInput,
  MultiDiffEditorResolverContribution,
  MultiDiffEditorSerializer
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tdWx0aURpZmZFZGl0b3IvYnJvd3Nlci9tdWx0aURpZmZFZGl0b3JJbnB1dC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IExhenlTdGF0ZWZ1bFByb21pc2UsIHJhY2VUaW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQnVnSW5kaWNhdGluZ0Vycm9yLCBvblVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBFdmVudCwgVmFsdWVXaXRoQ2hhbmdlRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCBJUmVmZXJlbmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IHBhcnNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFyc2hhbGxpbmcuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgZGVlcENsb25lIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JqZWN0cy5qcyc7XG5pbXBvcnQgeyBPYnNlcnZhYmxlTGF6eVByb21pc2UsIFZhbHVlV2l0aENoYW5nZUV2ZW50RnJvbU9ic2VydmFibGUsIGF1dG9ydW4sIGNvbnN0T2JzZXJ2YWJsZSwgZGVyaXZlZCwgbWFwT2JzZXJ2YWJsZUFycmF5Q2FjaGVkLCBvYnNlcnZhYmxlRnJvbUV2ZW50LCBvYnNlcnZhYmxlRnJvbVZhbHVlV2l0aENoYW5nZUV2ZW50LCBvYnNlcnZhYmxlVmFsdWUsIHJlY29tcHV0ZUluaXRpYWxseUFuZE9uQ2hhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZS5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgaXNEZWZpbmVkLCBpc09iamVjdCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBSZWZDb3VudGVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L2RpZmZFZGl0b3IvdXRpbHMuanMnO1xuaW1wb3J0IHsgSURvY3VtZW50RGlmZkl0ZW0sIElNdWx0aURpZmZFZGl0b3JNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9tdWx0aURpZmZFZGl0b3IvbW9kZWwuanMnO1xuaW1wb3J0IHsgTXVsdGlEaWZmRWRpdG9yVmlld01vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L211bHRpRGlmZkVkaXRvci9tdWx0aURpZmZFZGl0b3JWaWV3TW9kZWwuanMnO1xuaW1wb3J0IHsgSURpZmZFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBJUmVzb2x2ZWRUZXh0RWRpdG9yTW9kZWwsIElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy90ZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IENvbmZpcm1SZXN1bHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9kaWFsb2dzL2NvbW1vbi9kaWFsb2dzLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUVkaXRvckNvbmZpZ3VyYXRpb24gfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3BhcnRzL2VkaXRvci90ZXh0RWRpdG9yLmpzJztcbmltcG9ydCB7IERFRkFVTFRfRURJVE9SX0FTU09DSUFUSU9OLCBFZGl0b3JJbnB1dENhcGFiaWxpdGllcywgRWRpdG9ySW5wdXRXaXRoT3B0aW9ucywgR3JvdXBJZGVudGlmaWVyLCBJRWRpdG9yU2VyaWFsaXplciwgSVJlc291cmNlTXVsdGlEaWZmRWRpdG9ySW5wdXQsIElSZXZlcnRPcHRpb25zLCBJU2F2ZU9wdGlvbnMsIElVbnR5cGVkRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IEVkaXRvcklucHV0LCBJRWRpdG9yQ2xvc2VIYW5kbGVyIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci9lZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yUmVzb2x2ZXJTZXJ2aWNlLCBSZWdpc3RlcmVkRWRpdG9yUHJpb3JpdHkgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclJlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTdXBwb3J0LCBJVGV4dEZpbGVFZGl0b3JNb2RlbCwgSVRleHRGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3RleHRmaWxlL2NvbW1vbi90ZXh0ZmlsZXMuanMnO1xuaW1wb3J0IHsgTXVsdGlEaWZmRWRpdG9ySWNvbiB9IGZyb20gJy4vaWNvbnMuY29udHJpYnV0aW9uLmpzJztcbmltcG9ydCB7IElNdWx0aURpZmZTb3VyY2VSZXNvbHZlclNlcnZpY2UsIElSZXNvbHZlZE11bHRpRGlmZlNvdXJjZSwgTXVsdGlEaWZmRWRpdG9ySXRlbSB9IGZyb20gJy4vbXVsdGlEaWZmU291cmNlUmVzb2x2ZXJTZXJ2aWNlLmpzJztcblxuZXhwb3J0IGNsYXNzIE11bHRpRGlmZkVkaXRvcklucHV0IGV4dGVuZHMgRWRpdG9ySW5wdXQgaW1wbGVtZW50cyBJTGFuZ3VhZ2VTdXBwb3J0IHtcblx0cHVibGljIHN0YXRpYyBmcm9tUmVzb3VyY2VNdWx0aURpZmZFZGl0b3JJbnB1dChpbnB1dDogSVJlc291cmNlTXVsdGlEaWZmRWRpdG9ySW5wdXQsIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UpOiBNdWx0aURpZmZFZGl0b3JJbnB1dCB7XG5cdFx0aWYgKCFpbnB1dC5tdWx0aURpZmZTb3VyY2UgJiYgIWlucHV0LnJlc291cmNlcykge1xuXHRcdFx0dGhyb3cgbmV3IEJ1Z0luZGljYXRpbmdFcnJvcignTXVsdGlEaWZmRWRpdG9ySW5wdXQgcmVxdWlyZXMgZWl0aGVyIG11bHRpRGlmZlNvdXJjZSBvciByZXNvdXJjZXMnKTtcblx0XHR9XG5cdFx0Y29uc3QgbXVsdGlEaWZmU291cmNlID0gaW5wdXQubXVsdGlEaWZmU291cmNlID8/IFVSSS5wYXJzZShgbXVsdGktZGlmZi1lZGl0b3I6JHtuZXcgRGF0ZSgpLmdldE1pbGxpc2Vjb25kcygpLnRvU3RyaW5nKCkgKyBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKCl9YCk7XG5cdFx0cmV0dXJuIGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0TXVsdGlEaWZmRWRpdG9ySW5wdXQsXG5cdFx0XHRtdWx0aURpZmZTb3VyY2UsXG5cdFx0XHRpbnB1dC5sYWJlbCxcblx0XHRcdGlucHV0LnJlc291cmNlcz8ubWFwKHJlc291cmNlID0+IHtcblx0XHRcdFx0cmV0dXJuIG5ldyBNdWx0aURpZmZFZGl0b3JJdGVtKFxuXHRcdFx0XHRcdHJlc291cmNlLm9yaWdpbmFsLnJlc291cmNlLFxuXHRcdFx0XHRcdHJlc291cmNlLm1vZGlmaWVkLnJlc291cmNlLFxuXHRcdFx0XHRcdHJlc291cmNlLmdvVG9GaWxlUmVzb3VyY2UsXG5cdFx0XHRcdCk7XG5cdFx0XHR9KSxcblx0XHRcdGlucHV0LmlzVHJhbnNpZW50ID8/IGZhbHNlXG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgZnJvbVNlcmlhbGl6ZWQoZGF0YTogSVNlcmlhbGl6ZWRNdWx0aURpZmZFZGl0b3JJbnB1dCwgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSk6IE11bHRpRGlmZkVkaXRvcklucHV0IHtcblx0XHRyZXR1cm4gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRNdWx0aURpZmZFZGl0b3JJbnB1dCxcblx0XHRcdFVSSS5wYXJzZShkYXRhLm11bHRpRGlmZlNvdXJjZVVyaSksXG5cdFx0XHRkYXRhLmxhYmVsLFxuXHRcdFx0ZGF0YS5yZXNvdXJjZXM/Lm1hcChyZXNvdXJjZSA9PiBuZXcgTXVsdGlEaWZmRWRpdG9ySXRlbShcblx0XHRcdFx0cmVzb3VyY2Uub3JpZ2luYWxVcmkgPyBVUkkucGFyc2UocmVzb3VyY2Uub3JpZ2luYWxVcmkpIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRyZXNvdXJjZS5tb2RpZmllZFVyaSA/IFVSSS5wYXJzZShyZXNvdXJjZS5tb2RpZmllZFVyaSkgOiB1bmRlZmluZWQsXG5cdFx0XHRcdHJlc291cmNlLmdvVG9GaWxlVXJpID8gVVJJLnBhcnNlKHJlc291cmNlLmdvVG9GaWxlVXJpKSA6IHVuZGVmaW5lZCxcblx0XHRcdCkpLFxuXHRcdFx0ZmFsc2Vcblx0XHQpO1xuXHR9XG5cblx0c3RhdGljIHJlYWRvbmx5IElEOiBzdHJpbmcgPSAnd29ya2JlbmNoLmlucHV0Lm11bHRpRGlmZkVkaXRvcic7XG5cblx0Z2V0IHJlc291cmNlKCk6IFVSSSB8IHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLm11bHRpRGlmZlNvdXJjZTsgfVxuXG5cdG92ZXJyaWRlIGdldCBjYXBhYmlsaXRpZXMoKTogRWRpdG9ySW5wdXRDYXBhYmlsaXRpZXMgeyByZXR1cm4gRWRpdG9ySW5wdXRDYXBhYmlsaXRpZXMuUmVhZG9ubHk7IH1cblx0b3ZlcnJpZGUgZ2V0IHR5cGVJZCgpOiBzdHJpbmcgeyByZXR1cm4gTXVsdGlEaWZmRWRpdG9ySW5wdXQuSUQ7IH1cblxuXHRwcml2YXRlIF9uYW1lOiBzdHJpbmcgPSAnJztcblx0b3ZlcnJpZGUgZ2V0TmFtZSgpOiBzdHJpbmcgeyByZXR1cm4gdGhpcy5fbmFtZTsgfVxuXG5cdG92ZXJyaWRlIGdldCBlZGl0b3JJZCgpOiBzdHJpbmcgeyByZXR1cm4gREVGQVVMVF9FRElUT1JfQVNTT0NJQVRJT04uaWQ7IH1cblx0b3ZlcnJpZGUgZ2V0SWNvbigpOiBUaGVtZUljb24geyByZXR1cm4gTXVsdGlEaWZmRWRpdG9ySWNvbjsgfVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSBtdWx0aURpZmZTb3VyY2U6IFVSSSxcblx0XHRwdWJsaWMgcmVhZG9ubHkgbGFiZWw6IHN0cmluZyB8IHVuZGVmaW5lZCxcblx0XHRwdWJsaWMgcmVhZG9ubHkgaW5pdGlhbFJlc291cmNlczogcmVhZG9ubHkgTXVsdGlEaWZmRWRpdG9ySXRlbVtdIHwgdW5kZWZpbmVkLFxuXHRcdHB1YmxpYyByZWFkb25seSBpc1RyYW5zaWVudDogYm9vbGVhbiA9IGZhbHNlLFxuXHRcdEBJVGV4dE1vZGVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZXh0TW9kZWxTZXJ2aWNlOiBJVGV4dE1vZGVsU2VydmljZSxcblx0XHRASVRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3RleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJTXVsdGlEaWZmU291cmNlUmVzb2x2ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX211bHRpRGlmZlNvdXJjZVJlc29sdmVyU2VydmljZTogSU11bHRpRGlmZlNvdXJjZVJlc29sdmVyU2VydmljZSxcblx0XHRASVRleHRGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZXh0RmlsZVNlcnZpY2U6IElUZXh0RmlsZVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKChyZWFkZXIpID0+IHtcblx0XHRcdC8qKiBAZGVzY3JpcHRpb24gVXBkYXRlcyBuYW1lICovXG5cdFx0XHRjb25zdCByZXNvdXJjZXMgPSB0aGlzLnJlc291cmNlcy5yZWFkKHJlYWRlcik7XG5cdFx0XHRjb25zdCBsYWJlbCA9IHRoaXMubGFiZWwgPz8gbG9jYWxpemUoJ25hbWUnLCBcIk11bHRpIERpZmYgRWRpdG9yXCIpO1xuXHRcdFx0aWYgKHJlc291cmNlcyAmJiByZXNvdXJjZXMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdHRoaXMuX25hbWUgPSBsb2NhbGl6ZSh7IGtleTogJ25hbWVXaXRoT25lRmlsZScsIGNvbW1lbnQ6IFsnezB9IGlzIHRoZSBuYW1lIG9mIHRoZSBlZGl0b3InXSB9LCBcInswfSAoMSBmaWxlKVwiLCBsYWJlbCk7XG5cdFx0XHR9IGVsc2UgaWYgKHJlc291cmNlcykge1xuXHRcdFx0XHR0aGlzLl9uYW1lID0gbG9jYWxpemUoeyBrZXk6ICduYW1lV2l0aEZpbGVzJywgY29tbWVudDogWyd7MH0gaXMgdGhlIG5hbWUgb2YgdGhlIGVkaXRvcicsICd7MX0gaXMgdGhlIG51bWJlciBvZiBmaWxlcyBiZWluZyBzaG93biddIH0sIFwiezB9ICh7MX0gZmlsZXMpXCIsIGxhYmVsLCByZXNvdXJjZXMubGVuZ3RoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX25hbWUgPSBsYWJlbDtcblx0XHRcdH1cblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlTGFiZWwuZmlyZSgpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHB1YmxpYyBzZXJpYWxpemUoKTogSVNlcmlhbGl6ZWRNdWx0aURpZmZFZGl0b3JJbnB1dCB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGxhYmVsOiB0aGlzLmxhYmVsLFxuXHRcdFx0bXVsdGlEaWZmU291cmNlVXJpOiB0aGlzLm11bHRpRGlmZlNvdXJjZS50b1N0cmluZygpLFxuXHRcdFx0cmVzb3VyY2VzOiB0aGlzLmluaXRpYWxSZXNvdXJjZXM/Lm1hcChyZXNvdXJjZSA9PiAoe1xuXHRcdFx0XHRvcmlnaW5hbFVyaTogcmVzb3VyY2Uub3JpZ2luYWxVcmk/LnRvU3RyaW5nKCksXG5cdFx0XHRcdG1vZGlmaWVkVXJpOiByZXNvdXJjZS5tb2RpZmllZFVyaT8udG9TdHJpbmcoKSxcblx0XHRcdFx0Z29Ub0ZpbGVVcmk6IHJlc291cmNlLmdvVG9GaWxlVXJpPy50b1N0cmluZygpLFxuXHRcdFx0fSkpLFxuXHRcdH07XG5cdH1cblxuXHRwdWJsaWMgc2V0TGFuZ3VhZ2VJZChsYW5ndWFnZUlkOiBzdHJpbmcsIHNvdXJjZT86IHN0cmluZyB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGNvbnN0IGFjdGl2ZURpZmZJdGVtID0gdGhpcy5fdmlld01vZGVsLnJlcXVpcmVWYWx1ZSgpLmFjdGl2ZURpZmZJdGVtLmdldCgpO1xuXHRcdGNvbnN0IHZhbHVlID0gYWN0aXZlRGlmZkl0ZW0/LmRvY3VtZW50RGlmZkl0ZW07XG5cdFx0aWYgKCF2YWx1ZSkgeyByZXR1cm47IH1cblx0XHRjb25zdCB0YXJnZXQgPSB2YWx1ZS5tb2RpZmllZCA/PyB2YWx1ZS5vcmlnaW5hbDtcblx0XHRpZiAoIXRhcmdldCkgeyByZXR1cm47IH1cblx0XHR0YXJnZXQuc2V0TGFuZ3VhZ2UobGFuZ3VhZ2VJZCwgc291cmNlKTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBnZXRWaWV3TW9kZWwoKTogUHJvbWlzZTxNdWx0aURpZmZFZGl0b3JWaWV3TW9kZWw+IHtcblx0XHRyZXR1cm4gdGhpcy5fdmlld01vZGVsLmdldFByb21pc2UoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3ZpZXdNb2RlbCA9IG5ldyBMYXp5U3RhdGVmdWxQcm9taXNlKGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGF3YWl0IHRoaXMuX2NyZWF0ZU1vZGVsKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIobW9kZWwpO1xuXHRcdGNvbnN0IHZtID0gbmV3IE11bHRpRGlmZkVkaXRvclZpZXdNb2RlbChtb2RlbCwgdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHZtKTtcblx0XHRhd2FpdCByYWNlVGltZW91dCh2bS53YWl0Rm9yRGlmZnMoKSwgMTAwMCk7XG5cdFx0cmV0dXJuIHZtO1xuXHR9KTtcblxuXHRwcml2YXRlIGFzeW5jIF9jcmVhdGVNb2RlbCgpOiBQcm9taXNlPElNdWx0aURpZmZFZGl0b3JNb2RlbCAmIElEaXNwb3NhYmxlPiB7XG5cdFx0Y29uc3Qgc291cmNlID0gYXdhaXQgdGhpcy5fcmVzb2x2ZWRTb3VyY2UuZ2V0UHJvbWlzZSgpO1xuXHRcdGNvbnN0IHRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gdGhpcy5fdGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2U7XG5cblx0XHRjb25zdCBkb2N1bWVudHNXaXRoUHJvbWlzZXMgPSBtYXBPYnNlcnZhYmxlQXJyYXlDYWNoZWQodGhpcywgc291cmNlLnJlc291cmNlcywgYXN5bmMgKHIsIHN0b3JlKSA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIGRvY3VtZW50c1dpdGhQcm9taXNlcyAqL1xuXHRcdFx0bGV0IG9yaWdpbmFsOiBJUmVmZXJlbmNlPElSZXNvbHZlZFRleHRFZGl0b3JNb2RlbD4gfCB1bmRlZmluZWQ7XG5cdFx0XHRsZXQgbW9kaWZpZWQ6IElSZWZlcmVuY2U8SVJlc29sdmVkVGV4dEVkaXRvck1vZGVsPiB8IHVuZGVmaW5lZDtcblxuXHRcdFx0Y29uc3QgbXVsdGlEaWZmSXRlbVN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRbb3JpZ2luYWwsIG1vZGlmaWVkXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcblx0XHRcdFx0XHRyLm9yaWdpbmFsVXJpID8gdGhpcy5fdGV4dE1vZGVsU2VydmljZS5jcmVhdGVNb2RlbFJlZmVyZW5jZShyLm9yaWdpbmFsVXJpKSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRyLm1vZGlmaWVkVXJpID8gdGhpcy5fdGV4dE1vZGVsU2VydmljZS5jcmVhdGVNb2RlbFJlZmVyZW5jZShyLm1vZGlmaWVkVXJpKSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XSk7XG5cdFx0XHRcdGlmIChvcmlnaW5hbCkgeyBtdWx0aURpZmZJdGVtU3RvcmUuYWRkKG9yaWdpbmFsKTsgfVxuXHRcdFx0XHRpZiAobW9kaWZpZWQpIHsgbXVsdGlEaWZmSXRlbVN0b3JlLmFkZChtb2RpZmllZCk7IH1cblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0Ly8gZS5nLiBcIkZpbGUgc2VlbXMgdG8gYmUgYmluYXJ5IGFuZCBjYW5ub3QgYmUgb3BlbmVkIGFzIHRleHRcIlxuXHRcdFx0XHRjb25zb2xlLmVycm9yKGUpO1xuXHRcdFx0XHRvblVuZXhwZWN0ZWRFcnJvcihlKTtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgdXJpID0gKHIubW9kaWZpZWRVcmkgPz8gci5vcmlnaW5hbFVyaSkhO1xuXHRcdFx0Y29uc3QgcmVzdWx0OiBJRG9jdW1lbnREaWZmSXRlbVdpdGhNdWx0aURpZmZFZGl0b3JJdGVtID0ge1xuXHRcdFx0XHRtdWx0aURpZmZFZGl0b3JJdGVtOiByLFxuXHRcdFx0XHRvcmlnaW5hbDogb3JpZ2luYWw/Lm9iamVjdC50ZXh0RWRpdG9yTW9kZWwsXG5cdFx0XHRcdG1vZGlmaWVkOiBtb2RpZmllZD8ub2JqZWN0LnRleHRFZGl0b3JNb2RlbCxcblx0XHRcdFx0Y29udGV4dEtleXM6IHIuY29udGV4dEtleXMsXG5cdFx0XHRcdGdldCBvcHRpb25zKCkge1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHQuLi5nZXRSZWFkb25seUNvbmZpZ3VyYXRpb24obW9kaWZpZWQ/Lm9iamVjdC5pc1JlYWRvbmx5KCkgPz8gdHJ1ZSksXG5cdFx0XHRcdFx0XHQuLi5jb21wdXRlT3B0aW9ucyh0ZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSh1cmkpKSxcblx0XHRcdFx0XHR9IHNhdGlzZmllcyBJRGlmZkVkaXRvck9wdGlvbnM7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdG9uT3B0aW9uc0RpZENoYW5nZTogaCA9PiB0aGlzLl90ZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24odXJpLCAnZWRpdG9yJykgfHwgZS5hZmZlY3RzQ29uZmlndXJhdGlvbih1cmksICdkaWZmRWRpdG9yJykpIHtcblx0XHRcdFx0XHRcdGgoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pLFxuXHRcdFx0fTtcblx0XHRcdHJldHVybiBzdG9yZS5hZGQoUmVmQ291bnRlZC5jcmVhdGVPZk5vbkRpc3Bvc2FibGUocmVzdWx0LCBtdWx0aURpZmZJdGVtU3RvcmUsIHRoaXMpKTtcblx0XHR9LCBpID0+IEpTT04uc3RyaW5naWZ5KFtpLm1vZGlmaWVkVXJpPy50b1N0cmluZygpLCBpLm9yaWdpbmFsVXJpPy50b1N0cmluZygpXSkpO1xuXG5cdFx0Y29uc3QgZG9jdW1lbnRzID0gb2JzZXJ2YWJsZVZhbHVlPHJlYWRvbmx5IFJlZkNvdW50ZWQ8SURvY3VtZW50RGlmZkl0ZW0+W10gfCAnbG9hZGluZyc+KCdkb2N1bWVudHMnLCAnbG9hZGluZycpO1xuXG5cdFx0Y29uc3QgdXBkYXRlRG9jdW1lbnRzID0gZGVyaXZlZChhc3luYyByZWFkZXIgPT4ge1xuXHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBVcGRhdGUgZG9jdW1lbnRzICovXG5cdFx0XHRjb25zdCBkb2NzUHJvbWlzZXMgPSBkb2N1bWVudHNXaXRoUHJvbWlzZXMucmVhZChyZWFkZXIpO1xuXHRcdFx0Y29uc3QgZG9jcyA9IGF3YWl0IFByb21pc2UuYWxsKGRvY3NQcm9taXNlcyk7XG5cdFx0XHRjb25zdCBuZXdEb2N1bWVudHMgPSBkb2NzLmZpbHRlcihpc0RlZmluZWQpO1xuXHRcdFx0ZG9jdW1lbnRzLnNldChuZXdEb2N1bWVudHMsIHVuZGVmaW5lZCk7XG5cdFx0fSk7XG5cblx0XHRjb25zdCBhID0gcmVjb21wdXRlSW5pdGlhbGx5QW5kT25DaGFuZ2UodXBkYXRlRG9jdW1lbnRzKTtcblx0XHRhd2FpdCB1cGRhdGVEb2N1bWVudHMuZ2V0KCk7XG5cblx0XHRjb25zdCByZXN1bHQ6IElNdWx0aURpZmZFZGl0b3JNb2RlbCAmIElEaXNwb3NhYmxlID0ge1xuXHRcdFx0ZGlzcG9zZTogKCkgPT4gYS5kaXNwb3NlKCksXG5cdFx0XHRkb2N1bWVudHM6IG5ldyBWYWx1ZVdpdGhDaGFuZ2VFdmVudEZyb21PYnNlcnZhYmxlKGRvY3VtZW50cyksXG5cdFx0XHRjb250ZXh0S2V5czogc291cmNlLnNvdXJjZT8uY29udGV4dEtleXMsXG5cdFx0fTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcmVzb2x2ZWRTb3VyY2UgPSBuZXcgT2JzZXJ2YWJsZUxhenlQcm9taXNlKGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBzb3VyY2U6IElSZXNvbHZlZE11bHRpRGlmZlNvdXJjZSB8IHVuZGVmaW5lZCA9IHRoaXMuaW5pdGlhbFJlc291cmNlc1xuXHRcdFx0PyB7IHJlc291cmNlczogVmFsdWVXaXRoQ2hhbmdlRXZlbnQuY29uc3QodGhpcy5pbml0aWFsUmVzb3VyY2VzKSB9XG5cdFx0XHQ6IGF3YWl0IHRoaXMuX211bHRpRGlmZlNvdXJjZVJlc29sdmVyU2VydmljZS5yZXNvbHZlKHRoaXMubXVsdGlEaWZmU291cmNlKTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0c291cmNlLFxuXHRcdFx0cmVzb3VyY2VzOiBzb3VyY2UgPyBvYnNlcnZhYmxlRnJvbVZhbHVlV2l0aENoYW5nZUV2ZW50KHRoaXMsIHNvdXJjZS5yZXNvdXJjZXMpIDogY29uc3RPYnNlcnZhYmxlKFtdKSxcblx0XHR9O1xuXHR9KTtcblxuXHRvdmVycmlkZSBtYXRjaGVzKG90aGVySW5wdXQ6IEVkaXRvcklucHV0IHwgSVVudHlwZWRFZGl0b3JJbnB1dCk6IGJvb2xlYW4ge1xuXHRcdGlmIChzdXBlci5tYXRjaGVzKG90aGVySW5wdXQpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRpZiAob3RoZXJJbnB1dCBpbnN0YW5jZW9mIE11bHRpRGlmZkVkaXRvcklucHV0KSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5tdWx0aURpZmZTb3VyY2UudG9TdHJpbmcoKSA9PT0gb3RoZXJJbnB1dC5tdWx0aURpZmZTb3VyY2UudG9TdHJpbmcoKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwdWJsaWMgcmVhZG9ubHkgcmVzb3VyY2VzID0gZGVyaXZlZCh0aGlzLCByZWFkZXIgPT4gdGhpcy5fcmVzb2x2ZWRTb3VyY2UuY2FjaGVkUHJvbWlzZVJlc3VsdC5yZWFkKHJlYWRlcik/LmRhdGE/LnJlc291cmNlcy5yZWFkKHJlYWRlcikpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgdGV4dEZpbGVTZXJ2aWNlT25EaWRDaGFuZ2UgPSBuZXcgRmFzdEV2ZW50RGlzcGF0Y2hlcjxJVGV4dEZpbGVFZGl0b3JNb2RlbCwgVVJJPihcblx0XHR0aGlzLl90ZXh0RmlsZVNlcnZpY2UuZmlsZXMub25EaWRDaGFuZ2VEaXJ0eSxcblx0XHRpdGVtID0+IGl0ZW0ucmVzb3VyY2UudG9TdHJpbmcoKSxcblx0XHR1cmkgPT4gdXJpLnRvU3RyaW5nKClcblx0KTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9pc0RpcnR5T2JzZXJ2YWJsZXMgPSBtYXBPYnNlcnZhYmxlQXJyYXlDYWNoZWQodGhpcywgdGhpcy5yZXNvdXJjZXMubWFwKHIgPT4gciA/PyBbXSksIHJlcyA9PiB7XG5cdFx0Y29uc3QgaXNNb2RpZmllZERpcnR5ID0gcmVzLm1vZGlmaWVkVXJpID8gaXNVcmlEaXJ0eSh0aGlzLnRleHRGaWxlU2VydmljZU9uRGlkQ2hhbmdlLCB0aGlzLl90ZXh0RmlsZVNlcnZpY2UsIHJlcy5tb2RpZmllZFVyaSkgOiBjb25zdE9ic2VydmFibGUoZmFsc2UpO1xuXHRcdGNvbnN0IGlzT3JpZ2luYWxEaXJ0eSA9IHJlcy5vcmlnaW5hbFVyaSA/IGlzVXJpRGlydHkodGhpcy50ZXh0RmlsZVNlcnZpY2VPbkRpZENoYW5nZSwgdGhpcy5fdGV4dEZpbGVTZXJ2aWNlLCByZXMub3JpZ2luYWxVcmkpIDogY29uc3RPYnNlcnZhYmxlKGZhbHNlKTtcblx0XHRyZXR1cm4gZGVyaXZlZChyZWFkZXIgPT4gLyoqIEBkZXNjcmlwdGlvbiBtb2RpZmllZERpcnR5fHxvcmlnaW5hbERpcnR5ICovIGlzTW9kaWZpZWREaXJ0eS5yZWFkKHJlYWRlcikgfHwgaXNPcmlnaW5hbERpcnR5LnJlYWQocmVhZGVyKSk7XG5cdH0sIGkgPT4gaS5nZXRLZXkoKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2lzRGlydHlPYnNlcnZhYmxlID0gZGVyaXZlZCh0aGlzLCByZWFkZXIgPT4gdGhpcy5faXNEaXJ0eU9ic2VydmFibGVzLnJlYWQocmVhZGVyKS5zb21lKGlzRGlydHkgPT4gaXNEaXJ0eS5yZWFkKHJlYWRlcikpKVxuXHRcdC5rZWVwT2JzZXJ2ZWQodGhpcy5fc3RvcmUpO1xuXG5cdG92ZXJyaWRlIHJlYWRvbmx5IG9uRGlkQ2hhbmdlRGlydHkgPSBFdmVudC5mcm9tT2JzZXJ2YWJsZUxpZ2h0KHRoaXMuX2lzRGlydHlPYnNlcnZhYmxlKTtcblx0b3ZlcnJpZGUgaXNEaXJ0eSgpIHsgcmV0dXJuIHRoaXMuX2lzRGlydHlPYnNlcnZhYmxlLmdldCgpOyB9XG5cblx0b3ZlcnJpZGUgYXN5bmMgc2F2ZShncm91cDogbnVtYmVyLCBvcHRpb25zPzogSVNhdmVPcHRpb25zIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxFZGl0b3JJbnB1dD4ge1xuXHRcdGF3YWl0IHRoaXMuZG9TYXZlT3JSZXZlcnQoJ3NhdmUnLCBncm91cCwgb3B0aW9ucyk7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblxuXHRvdmVycmlkZSAgcmV2ZXJ0KGdyb3VwOiBHcm91cElkZW50aWZpZXIsIG9wdGlvbnM/OiBJUmV2ZXJ0T3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLmRvU2F2ZU9yUmV2ZXJ0KCdyZXZlcnQnLCBncm91cCwgb3B0aW9ucyk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvU2F2ZU9yUmV2ZXJ0KG1vZGU6ICdzYXZlJywgZ3JvdXA6IEdyb3VwSWRlbnRpZmllciwgb3B0aW9ucz86IElTYXZlT3B0aW9ucyk6IFByb21pc2U8dm9pZD47XG5cdHByaXZhdGUgYXN5bmMgZG9TYXZlT3JSZXZlcnQobW9kZTogJ3JldmVydCcsIGdyb3VwOiBHcm91cElkZW50aWZpZXIsIG9wdGlvbnM/OiBJUmV2ZXJ0T3B0aW9ucyk6IFByb21pc2U8dm9pZD47XG5cdHByaXZhdGUgYXN5bmMgZG9TYXZlT3JSZXZlcnQobW9kZTogJ3NhdmUnIHwgJ3JldmVydCcsIGdyb3VwOiBHcm91cElkZW50aWZpZXIsIG9wdGlvbnM/OiBJU2F2ZU9wdGlvbnMgfCBJUmV2ZXJ0T3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGl0ZW1zID0gdGhpcy5fdmlld01vZGVsLmN1cnJlbnRWYWx1ZT8uaXRlbXMuZ2V0KCk7XG5cdFx0aWYgKGl0ZW1zKSB7XG5cdFx0XHRhd2FpdCBQcm9taXNlLmFsbChpdGVtcy5tYXAoYXN5bmMgaXRlbSA9PiB7XG5cdFx0XHRcdGNvbnN0IG1vZGVsID0gaXRlbS5kaWZmRWRpdG9yVmlld01vZGVsLm1vZGVsO1xuXHRcdFx0XHRjb25zdCBoYW5kbGVPcmlnaW5hbCA9IG1vZGVsLm9yaWdpbmFsLnVyaS5zY2hlbWUgIT09IFNjaGVtYXMudW50aXRsZWQgJiYgdGhpcy5fdGV4dEZpbGVTZXJ2aWNlLmlzRGlydHkobW9kZWwub3JpZ2luYWwudXJpKTsgLy8gbWF0Y2ggZGlmZiBlZGl0b3IgYmVoYXZpb3VyXG5cblx0XHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwoW1xuXHRcdFx0XHRcdGhhbmRsZU9yaWdpbmFsID8gbW9kZSA9PT0gJ3NhdmUnID8gdGhpcy5fdGV4dEZpbGVTZXJ2aWNlLnNhdmUobW9kZWwub3JpZ2luYWwudXJpLCBvcHRpb25zKSA6IHRoaXMuX3RleHRGaWxlU2VydmljZS5yZXZlcnQobW9kZWwub3JpZ2luYWwudXJpLCBvcHRpb25zKSA6IFByb21pc2UucmVzb2x2ZSgpLFxuXHRcdFx0XHRcdG1vZGUgPT09ICdzYXZlJyA/IHRoaXMuX3RleHRGaWxlU2VydmljZS5zYXZlKG1vZGVsLm1vZGlmaWVkLnVyaSwgb3B0aW9ucykgOiB0aGlzLl90ZXh0RmlsZVNlcnZpY2UucmV2ZXJ0KG1vZGVsLm1vZGlmaWVkLnVyaSwgb3B0aW9ucyksXG5cdFx0XHRcdF0pO1xuXHRcdFx0fSkpO1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0b3ZlcnJpZGUgcmVhZG9ubHkgY2xvc2VIYW5kbGVyOiBJRWRpdG9yQ2xvc2VIYW5kbGVyID0ge1xuXG5cdFx0Ly8gVGhpcyBpcyBhIHdvcmthcm91bmQgZm9yIG5vdCBoYXZpbmcgYSBiZXR0ZXIgd2F5XG5cdFx0Ly8gdG8gZmlndXJlIG91dCBpZiB0aGUgZWRpdG9ycyB0aGlzIGlucHV0IHdyYXBzXG5cdFx0Ly8gYXJvdW5kIGFyZSBvcGVuZWQgb3Igbm90XG5cblx0XHRhc3luYyBjb25maXJtKCkge1xuXHRcdFx0cmV0dXJuIENvbmZpcm1SZXN1bHQuRE9OVF9TQVZFO1xuXHRcdH0sXG5cdFx0c2hvd0NvbmZpcm0oKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElEb2N1bWVudERpZmZJdGVtV2l0aE11bHRpRGlmZkVkaXRvckl0ZW0gZXh0ZW5kcyBJRG9jdW1lbnREaWZmSXRlbSB7XG5cdG11bHRpRGlmZkVkaXRvckl0ZW06IE11bHRpRGlmZkVkaXRvckl0ZW07XG59XG5cbi8qKlxuICogVXNlcyBhIG1hcCB0byBlZmZpY2llbnRseSBkaXNwYXRjaCBldmVudHMgdG8gbGlzdGVuZXJzIHRoYXQgYXJlIGludGVyZXN0ZWQgaW4gYSBzcGVjaWZpYyBrZXkuXG4qL1xuY2xhc3MgRmFzdEV2ZW50RGlzcGF0Y2hlcjxULCBUS2V5PiB7XG5cdHByaXZhdGUgX2NvdW50ID0gMDtcblx0cHJpdmF0ZSByZWFkb25seSBfYnVja2V0cyA9IG5ldyBNYXA8c3RyaW5nLCBTZXQ8KHZhbHVlOiBUKSA9PiB2b2lkPj4oKTtcblxuXHRwcml2YXRlIF9ldmVudFN1YnNjcmlwdGlvbjogSURpc3Bvc2FibGUgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZXZlbnQ6IEV2ZW50PFQ+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2dldEV2ZW50QXJnc0tleTogKGl0ZW06IFQpID0+IHN0cmluZyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9rZXlUb1N0cmluZzogKGtleTogVEtleSkgPT4gc3RyaW5nLFxuXHQpIHtcblx0fVxuXG5cdHB1YmxpYyBmaWx0ZXJlZEV2ZW50KGZpbHRlcjogVEtleSk6IChsaXN0ZW5lcjogKGU6IFQpID0+IHVua25vd24pID0+IElEaXNwb3NhYmxlIHtcblx0XHRyZXR1cm4gbGlzdGVuZXIgPT4ge1xuXHRcdFx0Y29uc3Qga2V5ID0gdGhpcy5fa2V5VG9TdHJpbmcoZmlsdGVyKTtcblx0XHRcdGxldCBidWNrZXQgPSB0aGlzLl9idWNrZXRzLmdldChrZXkpO1xuXHRcdFx0aWYgKCFidWNrZXQpIHtcblx0XHRcdFx0YnVja2V0ID0gbmV3IFNldCgpO1xuXHRcdFx0XHR0aGlzLl9idWNrZXRzLnNldChrZXksIGJ1Y2tldCk7XG5cdFx0XHR9XG5cdFx0XHRidWNrZXQuYWRkKGxpc3RlbmVyKTtcblxuXHRcdFx0dGhpcy5fY291bnQrKztcblx0XHRcdGlmICh0aGlzLl9jb3VudCA9PT0gMSkge1xuXHRcdFx0XHR0aGlzLl9ldmVudFN1YnNjcmlwdGlvbiA9IHRoaXMuX2V2ZW50KHRoaXMuX2hhbmRsZUV2ZW50Q2hhbmdlKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZGlzcG9zZTogKCkgPT4ge1xuXHRcdFx0XHRcdGJ1Y2tldCEuZGVsZXRlKGxpc3RlbmVyKTtcblx0XHRcdFx0XHRpZiAoYnVja2V0IS5zaXplID09PSAwKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9idWNrZXRzLmRlbGV0ZShrZXkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGlzLl9jb3VudC0tO1xuXG5cdFx0XHRcdFx0aWYgKHRoaXMuX2NvdW50ID09PSAwKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9ldmVudFN1YnNjcmlwdGlvbj8uZGlzcG9zZSgpO1xuXHRcdFx0XHRcdFx0dGhpcy5fZXZlbnRTdWJzY3JpcHRpb24gPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9oYW5kbGVFdmVudENoYW5nZSA9IChlOiBUKSA9PiB7XG5cdFx0Y29uc3Qga2V5ID0gdGhpcy5fZ2V0RXZlbnRBcmdzS2V5KGUpO1xuXHRcdGNvbnN0IGJ1Y2tldCA9IHRoaXMuX2J1Y2tldHMuZ2V0KGtleSk7XG5cdFx0aWYgKGJ1Y2tldCkge1xuXHRcdFx0Zm9yIChjb25zdCBsaXN0ZW5lciBvZiBidWNrZXQpIHtcblx0XHRcdFx0bGlzdGVuZXIoZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9O1xufVxuXG5mdW5jdGlvbiBpc1VyaURpcnR5KG9uRGlkQ2hhbmdlRGlydHk6IEZhc3RFdmVudERpc3BhdGNoZXI8SVRleHRGaWxlRWRpdG9yTW9kZWwsIFVSST4sIHRleHRGaWxlU2VydmljZTogSVRleHRGaWxlU2VydmljZSwgdXJpOiBVUkkpIHtcblx0cmV0dXJuIG9ic2VydmFibGVGcm9tRXZlbnQob25EaWRDaGFuZ2VEaXJ0eS5maWx0ZXJlZEV2ZW50KHVyaSksICgpID0+IHRleHRGaWxlU2VydmljZS5pc0RpcnR5KHVyaSkpO1xufVxuXG5mdW5jdGlvbiBnZXRSZWFkb25seUNvbmZpZ3VyYXRpb24oaXNSZWFkb25seTogYm9vbGVhbiB8IElNYXJrZG93blN0cmluZyB8IHVuZGVmaW5lZCk6IHsgcmVhZE9ubHk6IGJvb2xlYW47IHJlYWRPbmx5TWVzc2FnZTogSU1hcmtkb3duU3RyaW5nIHwgdW5kZWZpbmVkIH0ge1xuXHRyZXR1cm4ge1xuXHRcdHJlYWRPbmx5OiAhIWlzUmVhZG9ubHksXG5cdFx0cmVhZE9ubHlNZXNzYWdlOiB0eXBlb2YgaXNSZWFkb25seSAhPT0gJ2Jvb2xlYW4nID8gaXNSZWFkb25seSA6IHVuZGVmaW5lZFxuXHR9O1xufVxuXG5mdW5jdGlvbiBjb21wdXRlT3B0aW9ucyhjb25maWd1cmF0aW9uOiBJRWRpdG9yQ29uZmlndXJhdGlvbik6IElEaWZmRWRpdG9yT3B0aW9ucyB7XG5cdGNvbnN0IGVkaXRvckNvbmZpZ3VyYXRpb24gPSBkZWVwQ2xvbmUoY29uZmlndXJhdGlvbi5lZGl0b3IpO1xuXG5cdC8vIEhhbmRsZSBkaWZmIGVkaXRvciBzcGVjaWFsbHkgYnkgbWVyZ2luZyBpbiBkaWZmRWRpdG9yIGNvbmZpZ3VyYXRpb25cblx0aWYgKGlzT2JqZWN0KGNvbmZpZ3VyYXRpb24uZGlmZkVkaXRvcikpIHtcblx0XHRjb25zdCBkaWZmRWRpdG9yQ29uZmlndXJhdGlvbjogSURpZmZFZGl0b3JPcHRpb25zID0gZGVlcENsb25lKGNvbmZpZ3VyYXRpb24uZGlmZkVkaXRvcik7XG5cblx0XHQvLyBVc2VyIHNldHRpbmdzIGRlZmluZXMgYGRpZmZFZGl0b3IuY29kZUxlbnNgLCBidXQgaGVyZSB3ZSByZW5hbWUgdGhhdCB0byBgZGlmZkVkaXRvci5kaWZmQ29kZUxlbnNgIHRvIGF2b2lkIGNvbGxpc2lvbnMgd2l0aCBgZWRpdG9yLmNvZGVMZW5zYC5cblx0XHRkaWZmRWRpdG9yQ29uZmlndXJhdGlvbi5kaWZmQ29kZUxlbnMgPSBkaWZmRWRpdG9yQ29uZmlndXJhdGlvbi5jb2RlTGVucztcblx0XHRkZWxldGUgZGlmZkVkaXRvckNvbmZpZ3VyYXRpb24uY29kZUxlbnM7XG5cblx0XHQvLyBVc2VyIHNldHRpbmdzIGRlZmluZXMgYGRpZmZFZGl0b3Iud29yZFdyYXBgLCBidXQgaGVyZSB3ZSByZW5hbWUgdGhhdCB0byBgZGlmZkVkaXRvci5kaWZmV29yZFdyYXBgIHRvIGF2b2lkIGNvbGxpc2lvbnMgd2l0aCBgZWRpdG9yLndvcmRXcmFwYC5cblx0XHRkaWZmRWRpdG9yQ29uZmlndXJhdGlvbi5kaWZmV29yZFdyYXAgPSA8J29mZicgfCAnb24nIHwgJ2luaGVyaXQnIHwgdW5kZWZpbmVkPmRpZmZFZGl0b3JDb25maWd1cmF0aW9uLndvcmRXcmFwO1xuXHRcdGRlbGV0ZSBkaWZmRWRpdG9yQ29uZmlndXJhdGlvbi53b3JkV3JhcDtcblxuXHRcdE9iamVjdC5hc3NpZ24oZWRpdG9yQ29uZmlndXJhdGlvbiwgZGlmZkVkaXRvckNvbmZpZ3VyYXRpb24pO1xuXHR9XG5cdHJldHVybiBlZGl0b3JDb25maWd1cmF0aW9uO1xufVxuXG5leHBvcnQgY2xhc3MgTXVsdGlEaWZmRWRpdG9yUmVzb2x2ZXJDb250cmlidXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmNvbnRyaWIubXVsdGlEaWZmRWRpdG9yUmVzb2x2ZXInO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRWRpdG9yUmVzb2x2ZXJTZXJ2aWNlIGVkaXRvclJlc29sdmVyU2VydmljZTogSUVkaXRvclJlc29sdmVyU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihlZGl0b3JSZXNvbHZlclNlcnZpY2UucmVnaXN0ZXJFZGl0b3IoXG5cdFx0XHRgKmAsXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiBERUZBVUxUX0VESVRPUl9BU1NPQ0lBVElPTi5pZCxcblx0XHRcdFx0bGFiZWw6IERFRkFVTFRfRURJVE9SX0FTU09DSUFUSU9OLmRpc3BsYXlOYW1lLFxuXHRcdFx0XHRkZXRhaWw6IERFRkFVTFRfRURJVE9SX0FTU09DSUFUSU9OLnByb3ZpZGVyRGlzcGxheU5hbWUsXG5cdFx0XHRcdHByaW9yaXR5OiBSZWdpc3RlcmVkRWRpdG9yUHJpb3JpdHkuYnVpbHRpblxuXHRcdFx0fSxcblx0XHRcdHt9LFxuXHRcdFx0e1xuXHRcdFx0XHRjcmVhdGVNdWx0aURpZmZFZGl0b3JJbnB1dDogKG11bHRpRGlmZkVkaXRvcjogSVJlc291cmNlTXVsdGlEaWZmRWRpdG9ySW5wdXQpOiBFZGl0b3JJbnB1dFdpdGhPcHRpb25zID0+IHtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0ZWRpdG9yOiBNdWx0aURpZmZFZGl0b3JJbnB1dC5mcm9tUmVzb3VyY2VNdWx0aURpZmZFZGl0b3JJbnB1dChtdWx0aURpZmZFZGl0b3IsIGluc3RhbnRpYXRpb25TZXJ2aWNlKSxcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9LFxuXHRcdFx0fVxuXHRcdCkpO1xuXHR9XG59XG5cbmludGVyZmFjZSBJU2VyaWFsaXplZE11bHRpRGlmZkVkaXRvcklucHV0IHtcblx0bXVsdGlEaWZmU291cmNlVXJpOiBzdHJpbmc7XG5cdGxhYmVsOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHJlc291cmNlczoge1xuXHRcdG9yaWdpbmFsVXJpOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0bW9kaWZpZWRVcmk6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRnb1RvRmlsZVVyaTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHR9W10gfCB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBjbGFzcyBNdWx0aURpZmZFZGl0b3JTZXJpYWxpemVyIGltcGxlbWVudHMgSUVkaXRvclNlcmlhbGl6ZXIge1xuXG5cdGNhblNlcmlhbGl6ZShlZGl0b3I6IEVkaXRvcklucHV0KTogZWRpdG9yIGlzIE11bHRpRGlmZkVkaXRvcklucHV0IHtcblx0XHRyZXR1cm4gZWRpdG9yIGluc3RhbmNlb2YgTXVsdGlEaWZmRWRpdG9ySW5wdXQgJiYgIWVkaXRvci5pc1RyYW5zaWVudDtcblx0fVxuXG5cdHNlcmlhbGl6ZShlZGl0b3I6IE11bHRpRGlmZkVkaXRvcklucHV0KTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIXRoaXMuY2FuU2VyaWFsaXplKGVkaXRvcikpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIEpTT04uc3RyaW5naWZ5KGVkaXRvci5zZXJpYWxpemUoKSk7XG5cdH1cblxuXHRkZXNlcmlhbGl6ZShpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBzZXJpYWxpemVkRWRpdG9yOiBzdHJpbmcpOiBFZGl0b3JJbnB1dCB8IHVuZGVmaW5lZCB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGRhdGEgPSBwYXJzZShzZXJpYWxpemVkRWRpdG9yKSBhcyBJU2VyaWFsaXplZE11bHRpRGlmZkVkaXRvcklucHV0O1xuXHRcdFx0cmV0dXJuIE11bHRpRGlmZkVkaXRvcklucHV0LmZyb21TZXJpYWxpemVkKGRhdGEsIGluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdG9uVW5leHBlY3RlZEVycm9yKGVycik7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLHFCQUFxQixtQkFBbUI7QUFDakQsU0FBUyxvQkFBb0IseUJBQXlCO0FBQ3RELFNBQVMsT0FBTyw0QkFBNEI7QUFFNUMsU0FBUyxZQUFZLHVCQUFnRDtBQUNyRSxTQUFTLGFBQWE7QUFDdEIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsdUJBQXVCLG9DQUFvQyxTQUFTLGlCQUFpQixTQUFTLDBCQUEwQixxQkFBcUIsb0NBQW9DLGlCQUFpQixxQ0FBcUM7QUFFaFAsU0FBUyxXQUFXLGdCQUFnQjtBQUNwQyxTQUFTLFdBQVc7QUFDcEIsU0FBUyxrQkFBa0I7QUFFM0IsU0FBUyxnQ0FBZ0M7QUFFekMsU0FBbUMseUJBQXlCO0FBQzVELFNBQVMseUNBQXlDO0FBQ2xELFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsNkJBQTZCO0FBRXRDLFNBQVMsNEJBQTRCLCtCQUE2SztBQUNsTixTQUFTLG1CQUF3QztBQUNqRCxTQUFTLHdCQUF3QixnQ0FBZ0M7QUFDakUsU0FBaUQsd0JBQXdCO0FBQ3pFLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsaUNBQTJELDJCQUEyQjtBQUV4RixJQUFNLHVCQUFOLGNBQW1DLFlBQXdDO0FBQUEsRUFnRGpGLFlBQ2lCLGlCQUNBLE9BQ0Esa0JBQ0EsY0FBdUIsT0FDSCxtQkFDZ0IsbUNBQ1osdUJBQ1UsaUNBQ2Ysa0JBQ2xDO0FBQ0QsVUFBTTtBQVZVO0FBQ0E7QUFDQTtBQUNBO0FBQ29CO0FBQ2dCO0FBQ1o7QUFDVTtBQUNmO0FBZnBDLFNBQVEsUUFBZ0I7QUEyRHhCLFNBQWlCLGFBQWEsSUFBSSxvQkFBb0IsWUFBWTtBQUNqRSxZQUFNLFFBQVEsTUFBTSxLQUFLLGFBQWE7QUFDdEMsV0FBSyxVQUFVLEtBQUs7QUFDcEIsWUFBTSxLQUFLLElBQUkseUJBQXlCLE9BQU8sS0FBSyxxQkFBcUI7QUFDekUsV0FBSyxVQUFVLEVBQUU7QUFDakIsWUFBTSxZQUFZLEdBQUcsYUFBYSxHQUFHLEdBQUk7QUFDekMsYUFBTztBQUFBLElBQ1IsQ0FBQztBQXFFRCxTQUFpQixrQkFBa0IsSUFBSSxzQkFBc0IsWUFBWTtBQUN4RSxZQUFNLFNBQStDLEtBQUssbUJBQ3ZELEVBQUUsV0FBVyxxQkFBcUIsTUFBTSxLQUFLLGdCQUFnQixFQUFFLElBQy9ELE1BQU0sS0FBSyxnQ0FBZ0MsUUFBUSxLQUFLLGVBQWU7QUFDMUUsYUFBTztBQUFBLFFBQ047QUFBQSxRQUNBLFdBQVcsU0FBUyxtQ0FBbUMsTUFBTSxPQUFPLFNBQVMsSUFBSSxnQkFBZ0IsQ0FBQyxDQUFDO0FBQUEsTUFDcEc7QUFBQSxJQUNELENBQUM7QUFjRCxTQUFnQixZQUFZLFFBQVEsTUFBTSxZQUFVLEtBQUssZ0JBQWdCLG9CQUFvQixLQUFLLE1BQU0sR0FBRyxNQUFNLFVBQVUsS0FBSyxNQUFNLENBQUM7QUFFdkksU0FBaUIsNkJBQTZCLElBQUk7QUFBQSxNQUNqRCxLQUFLLGlCQUFpQixNQUFNO0FBQUEsTUFDNUIsVUFBUSxLQUFLLFNBQVMsU0FBUztBQUFBLE1BQy9CLFNBQU8sSUFBSSxTQUFTO0FBQUEsSUFDckI7QUFFQSxTQUFpQixzQkFBc0IseUJBQXlCLE1BQU0sS0FBSyxVQUFVLElBQUksT0FBSyxLQUFLLENBQUMsQ0FBQyxHQUFHLFNBQU87QUFDOUcsWUFBTSxrQkFBa0IsSUFBSSxjQUFjLFdBQVcsS0FBSyw0QkFBNEIsS0FBSyxrQkFBa0IsSUFBSSxXQUFXLElBQUksZ0JBQWdCLEtBQUs7QUFDckosWUFBTSxrQkFBa0IsSUFBSSxjQUFjLFdBQVcsS0FBSyw0QkFBNEIsS0FBSyxrQkFBa0IsSUFBSSxXQUFXLElBQUksZ0JBQWdCLEtBQUs7QUFDckosYUFBTyxRQUFRO0FBQUE7QUFBQSxRQUEyRCxnQkFBZ0IsS0FBSyxNQUFNLEtBQUssZ0JBQWdCLEtBQUssTUFBTTtBQUFBLE9BQUM7QUFBQSxJQUN2SSxHQUFHLE9BQUssRUFBRSxPQUFPLENBQUM7QUFDbEIsU0FBaUIscUJBQXFCLFFBQVEsTUFBTSxZQUFVLEtBQUssb0JBQW9CLEtBQUssTUFBTSxFQUFFLEtBQUssYUFBVyxRQUFRLEtBQUssTUFBTSxDQUFDLENBQUMsRUFDdkksYUFBYSxLQUFLLE1BQU07QUFFMUIsU0FBa0IsbUJBQW1CLE1BQU0sb0JBQW9CLEtBQUssa0JBQWtCO0FBOEJ0RixTQUFrQixlQUFvQztBQUFBO0FBQUE7QUFBQTtBQUFBLE1BTXJELE1BQU0sVUFBVTtBQUNmLGVBQU8sY0FBYztBQUFBLE1BQ3RCO0FBQUEsTUFDQSxjQUFjO0FBQ2IsZUFBTztBQUFBLE1BQ1I7QUFBQSxJQUNEO0FBcE1DLFNBQUssVUFBVSxRQUFRLENBQUMsV0FBVztBQUVsQyxZQUFNLFlBQVksS0FBSyxVQUFVLEtBQUssTUFBTTtBQUM1QyxZQUFNQSxTQUFRLEtBQUssU0FBUyxTQUFTLFFBQVEsbUJBQW1CO0FBQ2hFLFVBQUksYUFBYSxVQUFVLFdBQVcsR0FBRztBQUN4QyxhQUFLLFFBQVEsU0FBUyxFQUFFLEtBQUssbUJBQW1CLFNBQVMsQ0FBQywrQkFBK0IsRUFBRSxHQUFHLGdCQUFnQkEsTUFBSztBQUFBLE1BQ3BILFdBQVcsV0FBVztBQUNyQixhQUFLLFFBQVEsU0FBUyxFQUFFLEtBQUssaUJBQWlCLFNBQVMsQ0FBQyxpQ0FBaUMsd0NBQXdDLEVBQUUsR0FBRyxtQkFBbUJBLFFBQU8sVUFBVSxNQUFNO0FBQUEsTUFDakwsT0FBTztBQUNOLGFBQUssUUFBUUE7QUFBQSxNQUNkO0FBQ0EsV0FBSyxrQkFBa0IsS0FBSztBQUFBLElBQzdCLENBQUMsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQXpFQSxPQUFjLGlDQUFpQyxPQUFzQyxzQkFBbUU7QUFDdkosUUFBSSxDQUFDLE1BQU0sbUJBQW1CLENBQUMsTUFBTSxXQUFXO0FBQy9DLFlBQU0sSUFBSSxtQkFBbUIsbUVBQW1FO0FBQUEsSUFDakc7QUFDQSxVQUFNLGtCQUFrQixNQUFNLG1CQUFtQixJQUFJLE1BQU0sc0JBQXFCLG9CQUFJLEtBQUssR0FBRSxnQkFBZ0IsRUFBRSxTQUFTLElBQUksS0FBSyxPQUFPLEVBQUUsU0FBUyxDQUFDLEVBQUU7QUFDcEosV0FBTyxxQkFBcUI7QUFBQSxNQUMzQjtBQUFBLE1BQ0E7QUFBQSxNQUNBLE1BQU07QUFBQSxNQUNOLE1BQU0sV0FBVyxJQUFJLGNBQVk7QUFDaEMsZUFBTyxJQUFJO0FBQUEsVUFDVixTQUFTLFNBQVM7QUFBQSxVQUNsQixTQUFTLFNBQVM7QUFBQSxVQUNsQixTQUFTO0FBQUEsUUFDVjtBQUFBLE1BQ0QsQ0FBQztBQUFBLE1BQ0QsTUFBTSxlQUFlO0FBQUEsSUFDdEI7QUFBQSxFQUNEO0FBQUEsRUFFQSxPQUFjLGVBQWUsTUFBdUMsc0JBQW1FO0FBQ3RJLFdBQU8scUJBQXFCO0FBQUEsTUFDM0I7QUFBQSxNQUNBLElBQUksTUFBTSxLQUFLLGtCQUFrQjtBQUFBLE1BQ2pDLEtBQUs7QUFBQSxNQUNMLEtBQUssV0FBVyxJQUFJLGNBQVksSUFBSTtBQUFBLFFBQ25DLFNBQVMsY0FBYyxJQUFJLE1BQU0sU0FBUyxXQUFXLElBQUk7QUFBQSxRQUN6RCxTQUFTLGNBQWMsSUFBSSxNQUFNLFNBQVMsV0FBVyxJQUFJO0FBQUEsUUFDekQsU0FBUyxjQUFjLElBQUksTUFBTSxTQUFTLFdBQVcsSUFBSTtBQUFBLE1BQzFELENBQUM7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQSxFQUlBLElBQUksV0FBNEI7QUFBRSxXQUFPLEtBQUs7QUFBQSxFQUFpQjtBQUFBLEVBRS9ELElBQWEsZUFBd0M7QUFBRSxXQUFPLHdCQUF3QjtBQUFBLEVBQVU7QUFBQSxFQUNoRyxJQUFhLFNBQWlCO0FBQUUsV0FBTyxxQkFBcUI7QUFBQSxFQUFJO0FBQUEsRUFHdkQsVUFBa0I7QUFBRSxXQUFPLEtBQUs7QUFBQSxFQUFPO0FBQUEsRUFFaEQsSUFBYSxXQUFtQjtBQUFFLFdBQU8sMkJBQTJCO0FBQUEsRUFBSTtBQUFBLEVBQy9ELFVBQXFCO0FBQUUsV0FBTztBQUFBLEVBQXFCO0FBQUEsRUE4QnJELFlBQTZDO0FBQ25ELFdBQU87QUFBQSxNQUNOLE9BQU8sS0FBSztBQUFBLE1BQ1osb0JBQW9CLEtBQUssZ0JBQWdCLFNBQVM7QUFBQSxNQUNsRCxXQUFXLEtBQUssa0JBQWtCLElBQUksZUFBYTtBQUFBLFFBQ2xELGFBQWEsU0FBUyxhQUFhLFNBQVM7QUFBQSxRQUM1QyxhQUFhLFNBQVMsYUFBYSxTQUFTO0FBQUEsUUFDNUMsYUFBYSxTQUFTLGFBQWEsU0FBUztBQUFBLE1BQzdDLEVBQUU7QUFBQSxJQUNIO0FBQUEsRUFDRDtBQUFBLEVBRU8sY0FBYyxZQUFvQixRQUFtQztBQUMzRSxVQUFNLGlCQUFpQixLQUFLLFdBQVcsYUFBYSxFQUFFLGVBQWUsSUFBSTtBQUN6RSxVQUFNLFFBQVEsZ0JBQWdCO0FBQzlCLFFBQUksQ0FBQyxPQUFPO0FBQUU7QUFBQSxJQUFRO0FBQ3RCLFVBQU0sU0FBUyxNQUFNLFlBQVksTUFBTTtBQUN2QyxRQUFJLENBQUMsUUFBUTtBQUFFO0FBQUEsSUFBUTtBQUN2QixXQUFPLFlBQVksWUFBWSxNQUFNO0FBQUEsRUFDdEM7QUFBQSxFQUVBLE1BQWEsZUFBa0Q7QUFDOUQsV0FBTyxLQUFLLFdBQVcsV0FBVztBQUFBLEVBQ25DO0FBQUEsRUFXQSxNQUFjLGVBQTZEO0FBQzFFLFVBQU0sU0FBUyxNQUFNLEtBQUssZ0JBQWdCLFdBQVc7QUFDckQsVUFBTSxtQ0FBbUMsS0FBSztBQUU5QyxVQUFNLHdCQUF3Qix5QkFBeUIsTUFBTSxPQUFPLFdBQVcsT0FBTyxHQUFHLFVBQVU7QUFFbEcsVUFBSTtBQUNKLFVBQUk7QUFFSixZQUFNLHFCQUFxQixJQUFJLGdCQUFnQjtBQUUvQyxVQUFJO0FBQ0gsU0FBQyxVQUFVLFFBQVEsSUFBSSxNQUFNLFFBQVEsSUFBSTtBQUFBLFVBQ3hDLEVBQUUsY0FBYyxLQUFLLGtCQUFrQixxQkFBcUIsRUFBRSxXQUFXLElBQUk7QUFBQSxVQUM3RSxFQUFFLGNBQWMsS0FBSyxrQkFBa0IscUJBQXFCLEVBQUUsV0FBVyxJQUFJO0FBQUEsUUFDOUUsQ0FBQztBQUNELFlBQUksVUFBVTtBQUFFLDZCQUFtQixJQUFJLFFBQVE7QUFBQSxRQUFHO0FBQ2xELFlBQUksVUFBVTtBQUFFLDZCQUFtQixJQUFJLFFBQVE7QUFBQSxRQUFHO0FBQUEsTUFDbkQsU0FBUyxHQUFHO0FBRVgsZ0JBQVEsTUFBTSxDQUFDO0FBQ2YsMEJBQWtCLENBQUM7QUFDbkIsZUFBTztBQUFBLE1BQ1I7QUFFQSxZQUFNLE1BQU8sRUFBRSxlQUFlLEVBQUU7QUFDaEMsWUFBTUMsVUFBbUQ7QUFBQSxRQUN4RCxxQkFBcUI7QUFBQSxRQUNyQixVQUFVLFVBQVUsT0FBTztBQUFBLFFBQzNCLFVBQVUsVUFBVSxPQUFPO0FBQUEsUUFDM0IsYUFBYSxFQUFFO0FBQUEsUUFDZixJQUFJLFVBQVU7QUFDYixpQkFBTztBQUFBLFlBQ04sR0FBRyx5QkFBeUIsVUFBVSxPQUFPLFdBQVcsS0FBSyxJQUFJO0FBQUEsWUFDakUsR0FBRyxlQUFlLGlDQUFpQyxTQUFTLEdBQUcsQ0FBQztBQUFBLFVBQ2pFO0FBQUEsUUFDRDtBQUFBLFFBQ0Esb0JBQW9CLE9BQUssS0FBSyxrQ0FBa0MseUJBQXlCLE9BQUs7QUFDN0YsY0FBSSxFQUFFLHFCQUFxQixLQUFLLFFBQVEsS0FBSyxFQUFFLHFCQUFxQixLQUFLLFlBQVksR0FBRztBQUN2RixjQUFFO0FBQUEsVUFDSDtBQUFBLFFBQ0QsQ0FBQztBQUFBLE1BQ0Y7QUFDQSxhQUFPLE1BQU0sSUFBSSxXQUFXLHNCQUFzQkEsU0FBUSxvQkFBb0IsSUFBSSxDQUFDO0FBQUEsSUFDcEYsR0FBRyxPQUFLLEtBQUssVUFBVSxDQUFDLEVBQUUsYUFBYSxTQUFTLEdBQUcsRUFBRSxhQUFhLFNBQVMsQ0FBQyxDQUFDLENBQUM7QUFFOUUsVUFBTSxZQUFZLGdCQUFzRSxhQUFhLFNBQVM7QUFFOUcsVUFBTSxrQkFBa0IsUUFBUSxPQUFNLFdBQVU7QUFFL0MsWUFBTSxlQUFlLHNCQUFzQixLQUFLLE1BQU07QUFDdEQsWUFBTSxPQUFPLE1BQU0sUUFBUSxJQUFJLFlBQVk7QUFDM0MsWUFBTSxlQUFlLEtBQUssT0FBTyxTQUFTO0FBQzFDLGdCQUFVLElBQUksY0FBYyxNQUFTO0FBQUEsSUFDdEMsQ0FBQztBQUVELFVBQU0sSUFBSSw4QkFBOEIsZUFBZTtBQUN2RCxVQUFNLGdCQUFnQixJQUFJO0FBRTFCLFVBQU0sU0FBOEM7QUFBQSxNQUNuRCxTQUFTLE1BQU0sRUFBRSxRQUFRO0FBQUEsTUFDekIsV0FBVyxJQUFJLG1DQUFtQyxTQUFTO0FBQUEsTUFDM0QsYUFBYSxPQUFPLFFBQVE7QUFBQSxJQUM3QjtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFZUyxRQUFRLFlBQXdEO0FBQ3hFLFFBQUksTUFBTSxRQUFRLFVBQVUsR0FBRztBQUM5QixhQUFPO0FBQUEsSUFDUjtBQUVBLFFBQUksc0JBQXNCLHNCQUFzQjtBQUMvQyxhQUFPLEtBQUssZ0JBQWdCLFNBQVMsTUFBTSxXQUFXLGdCQUFnQixTQUFTO0FBQUEsSUFDaEY7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBbUJTLFVBQVU7QUFBRSxXQUFPLEtBQUssbUJBQW1CLElBQUk7QUFBQSxFQUFHO0FBQUEsRUFFM0QsTUFBZSxLQUFLLE9BQWUsU0FBMEQ7QUFDNUYsVUFBTSxLQUFLLGVBQWUsUUFBUSxPQUFPLE9BQU87QUFDaEQsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVVLE9BQU8sT0FBd0IsU0FBeUM7QUFDakYsV0FBTyxLQUFLLGVBQWUsVUFBVSxPQUFPLE9BQU87QUFBQSxFQUNwRDtBQUFBLEVBSUEsTUFBYyxlQUFlLE1BQXlCLE9BQXdCLFNBQXdEO0FBQ3JJLFVBQU0sUUFBUSxLQUFLLFdBQVcsY0FBYyxNQUFNLElBQUk7QUFDdEQsUUFBSSxPQUFPO0FBQ1YsWUFBTSxRQUFRLElBQUksTUFBTSxJQUFJLE9BQU0sU0FBUTtBQUN6QyxjQUFNLFFBQVEsS0FBSyxvQkFBb0I7QUFDdkMsY0FBTSxpQkFBaUIsTUFBTSxTQUFTLElBQUksV0FBVyxRQUFRLFlBQVksS0FBSyxpQkFBaUIsUUFBUSxNQUFNLFNBQVMsR0FBRztBQUV6SCxjQUFNLFFBQVEsSUFBSTtBQUFBLFVBQ2pCLGlCQUFpQixTQUFTLFNBQVMsS0FBSyxpQkFBaUIsS0FBSyxNQUFNLFNBQVMsS0FBSyxPQUFPLElBQUksS0FBSyxpQkFBaUIsT0FBTyxNQUFNLFNBQVMsS0FBSyxPQUFPLElBQUksUUFBUSxRQUFRO0FBQUEsVUFDekssU0FBUyxTQUFTLEtBQUssaUJBQWlCLEtBQUssTUFBTSxTQUFTLEtBQUssT0FBTyxJQUFJLEtBQUssaUJBQWlCLE9BQU8sTUFBTSxTQUFTLEtBQUssT0FBTztBQUFBLFFBQ3JJLENBQUM7QUFBQSxNQUNGLENBQUMsQ0FBQztBQUFBLElBQ0g7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQWVEO0FBbFFhLHFCQW1DSSxLQUFhO0FBbkNqQix1QkFBTjtBQUFBLEVBcURKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBekRVO0FBMlFiLE1BQU0sb0JBQTZCO0FBQUEsRUFNbEMsWUFDa0IsUUFDQSxrQkFDQSxjQUNoQjtBQUhnQjtBQUNBO0FBQ0E7QUFSbEIsU0FBUSxTQUFTO0FBQ2pCLFNBQWlCLFdBQVcsb0JBQUksSUFBcUM7QUEyQ3JFLFNBQWlCLHFCQUFxQixDQUFDLE1BQVM7QUFDL0MsWUFBTSxNQUFNLEtBQUssaUJBQWlCLENBQUM7QUFDbkMsWUFBTSxTQUFTLEtBQUssU0FBUyxJQUFJLEdBQUc7QUFDcEMsVUFBSSxRQUFRO0FBQ1gsbUJBQVcsWUFBWSxRQUFRO0FBQzlCLG1CQUFTLENBQUM7QUFBQSxRQUNYO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFBQSxFQTFDQTtBQUFBLEVBRU8sY0FBYyxRQUE0RDtBQUNoRixXQUFPLGNBQVk7QUFDbEIsWUFBTSxNQUFNLEtBQUssYUFBYSxNQUFNO0FBQ3BDLFVBQUksU0FBUyxLQUFLLFNBQVMsSUFBSSxHQUFHO0FBQ2xDLFVBQUksQ0FBQyxRQUFRO0FBQ1osaUJBQVMsb0JBQUksSUFBSTtBQUNqQixhQUFLLFNBQVMsSUFBSSxLQUFLLE1BQU07QUFBQSxNQUM5QjtBQUNBLGFBQU8sSUFBSSxRQUFRO0FBRW5CLFdBQUs7QUFDTCxVQUFJLEtBQUssV0FBVyxHQUFHO0FBQ3RCLGFBQUsscUJBQXFCLEtBQUssT0FBTyxLQUFLLGtCQUFrQjtBQUFBLE1BQzlEO0FBRUEsYUFBTztBQUFBLFFBQ04sU0FBUyxNQUFNO0FBQ2QsaUJBQVEsT0FBTyxRQUFRO0FBQ3ZCLGNBQUksT0FBUSxTQUFTLEdBQUc7QUFDdkIsaUJBQUssU0FBUyxPQUFPLEdBQUc7QUFBQSxVQUN6QjtBQUNBLGVBQUs7QUFFTCxjQUFJLEtBQUssV0FBVyxHQUFHO0FBQ3RCLGlCQUFLLG9CQUFvQixRQUFRO0FBQ2pDLGlCQUFLLHFCQUFxQjtBQUFBLFVBQzNCO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQVdEO0FBRUEsU0FBUyxXQUFXLGtCQUFrRSxpQkFBbUMsS0FBVTtBQUNsSSxTQUFPLG9CQUFvQixpQkFBaUIsY0FBYyxHQUFHLEdBQUcsTUFBTSxnQkFBZ0IsUUFBUSxHQUFHLENBQUM7QUFDbkc7QUFFQSxTQUFTLHlCQUF5QixZQUF3SDtBQUN6SixTQUFPO0FBQUEsSUFDTixVQUFVLENBQUMsQ0FBQztBQUFBLElBQ1osaUJBQWlCLE9BQU8sZUFBZSxZQUFZLGFBQWE7QUFBQSxFQUNqRTtBQUNEO0FBRUEsU0FBUyxlQUFlLGVBQXlEO0FBQ2hGLFFBQU0sc0JBQXNCLFVBQVUsY0FBYyxNQUFNO0FBRzFELE1BQUksU0FBUyxjQUFjLFVBQVUsR0FBRztBQUN2QyxVQUFNLDBCQUE4QyxVQUFVLGNBQWMsVUFBVTtBQUd0Riw0QkFBd0IsZUFBZSx3QkFBd0I7QUFDL0QsV0FBTyx3QkFBd0I7QUFHL0IsNEJBQXdCLGVBQXFELHdCQUF3QjtBQUNyRyxXQUFPLHdCQUF3QjtBQUUvQixXQUFPLE9BQU8scUJBQXFCLHVCQUF1QjtBQUFBLEVBQzNEO0FBQ0EsU0FBTztBQUNSO0FBRU8sSUFBTSxzQ0FBTixjQUFrRCxXQUFXO0FBQUEsRUFJbkUsWUFDeUIsdUJBQ0Qsc0JBQ3RCO0FBQ0QsVUFBTTtBQUVOLFNBQUssVUFBVSxzQkFBc0I7QUFBQSxNQUNwQztBQUFBLE1BQ0E7QUFBQSxRQUNDLElBQUksMkJBQTJCO0FBQUEsUUFDL0IsT0FBTywyQkFBMkI7QUFBQSxRQUNsQyxRQUFRLDJCQUEyQjtBQUFBLFFBQ25DLFVBQVUseUJBQXlCO0FBQUEsTUFDcEM7QUFBQSxNQUNBLENBQUM7QUFBQSxNQUNEO0FBQUEsUUFDQyw0QkFBNEIsQ0FBQyxvQkFBMkU7QUFDdkcsaUJBQU87QUFBQSxZQUNOLFFBQVEscUJBQXFCLGlDQUFpQyxpQkFBaUIsb0JBQW9CO0FBQUEsVUFDcEc7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFDRDtBQTVCYSxvQ0FFSSxLQUFLO0FBRlQsc0NBQU47QUFBQSxFQUtKO0FBQUEsRUFDQTtBQUFBLEdBTlU7QUF3Q04sTUFBTSwwQkFBdUQ7QUFBQSxFQUVuRSxhQUFhLFFBQXFEO0FBQ2pFLFdBQU8sa0JBQWtCLHdCQUF3QixDQUFDLE9BQU87QUFBQSxFQUMxRDtBQUFBLEVBRUEsVUFBVSxRQUFrRDtBQUMzRCxRQUFJLENBQUMsS0FBSyxhQUFhLE1BQU0sR0FBRztBQUMvQixhQUFPO0FBQUEsSUFDUjtBQUVBLFdBQU8sS0FBSyxVQUFVLE9BQU8sVUFBVSxDQUFDO0FBQUEsRUFDekM7QUFBQSxFQUVBLFlBQVksc0JBQTZDLGtCQUFtRDtBQUMzRyxRQUFJO0FBQ0gsWUFBTSxPQUFPLE1BQU0sZ0JBQWdCO0FBQ25DLGFBQU8scUJBQXFCLGVBQWUsTUFBTSxvQkFBb0I7QUFBQSxJQUN0RSxTQUFTLEtBQUs7QUFDYix3QkFBa0IsR0FBRztBQUNyQixhQUFPO0FBQUEsSUFDUjtBQUFBLEVBQ0Q7QUFDRDsiLAogICJuYW1lcyI6IFsibGFiZWwiLCAicmVzdWx0Il0KfQo=
