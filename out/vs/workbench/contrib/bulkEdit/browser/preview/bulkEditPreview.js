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
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { URI } from "../../../../../base/common/uri.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { createTextBufferFactoryFromSnapshot } from "../../../../../editor/common/model/textModel.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { coalesceInPlace } from "../../../../../base/common/arrays.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { EditOperation } from "../../../../../editor/common/core/editOperation.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { ConflictDetector } from "../conflicts.js";
import { ResourceMap } from "../../../../../base/common/map.js";
import { localize } from "../../../../../nls.js";
import { extUri } from "../../../../../base/common/resources.js";
import { ResourceFileEdit, ResourceTextEdit } from "../../../../../editor/browser/services/bulkEditService.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { SnippetParser } from "../../../../../editor/contrib/snippet/browser/snippetParser.js";
import { MicrotaskDelay } from "../../../../../base/common/symbols.js";
class CheckedStates {
  constructor() {
    this._states = /* @__PURE__ */ new WeakMap();
    this._checkedCount = 0;
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
  }
  dispose() {
    this._onDidChange.dispose();
  }
  get checkedCount() {
    return this._checkedCount;
  }
  isChecked(obj) {
    return this._states.get(obj) ?? false;
  }
  updateChecked(obj, value) {
    const valueNow = this._states.get(obj);
    if (valueNow === value) {
      return;
    }
    if (valueNow === void 0) {
      if (value) {
        this._checkedCount += 1;
      }
    } else {
      if (value) {
        this._checkedCount += 1;
      } else {
        this._checkedCount -= 1;
      }
    }
    this._states.set(obj, value);
    this._onDidChange.fire(obj);
  }
}
class BulkTextEdit {
  constructor(parent, textEdit) {
    this.parent = parent;
    this.textEdit = textEdit;
  }
}
var BulkFileOperationType = /* @__PURE__ */ ((BulkFileOperationType2) => {
  BulkFileOperationType2[BulkFileOperationType2["TextEdit"] = 1] = "TextEdit";
  BulkFileOperationType2[BulkFileOperationType2["Create"] = 2] = "Create";
  BulkFileOperationType2[BulkFileOperationType2["Delete"] = 4] = "Delete";
  BulkFileOperationType2[BulkFileOperationType2["Rename"] = 8] = "Rename";
  return BulkFileOperationType2;
})(BulkFileOperationType || {});
class BulkFileOperation {
  constructor(uri, parent) {
    this.uri = uri;
    this.parent = parent;
    this.type = 0;
    this.textEdits = [];
    this.originalEdits = /* @__PURE__ */ new Map();
  }
  addEdit(index, type, edit) {
    this.type |= type;
    this.originalEdits.set(index, edit);
    if (edit instanceof ResourceTextEdit) {
      this.textEdits.push(new BulkTextEdit(this, edit));
    } else if (type === 8 /* Rename */) {
      this.newUri = edit.newResource;
    }
  }
  needsConfirmation() {
    for (const [, edit] of this.originalEdits) {
      if (!this.parent.checked.isChecked(edit)) {
        return true;
      }
    }
    return false;
  }
}
const _BulkCategory = class _BulkCategory {
  constructor(metadata = _BulkCategory._defaultMetadata) {
    this.metadata = metadata;
    this.operationByResource = /* @__PURE__ */ new Map();
  }
  static keyOf(metadata) {
    return metadata?.label || "<default>";
  }
  get fileOperations() {
    return this.operationByResource.values();
  }
};
_BulkCategory._defaultMetadata = Object.freeze({
  label: localize("default", "Other"),
  icon: Codicon.symbolFile,
  needsConfirmation: false
});
let BulkCategory = _BulkCategory;
let BulkFileOperations = class {
  constructor(_bulkEdit, _fileService, instaService) {
    this._bulkEdit = _bulkEdit;
    this._fileService = _fileService;
    this.checked = new CheckedStates();
    this.fileOperations = [];
    this.categories = [];
    this.conflicts = instaService.createInstance(ConflictDetector, _bulkEdit);
  }
  static async create(accessor, bulkEdit) {
    const result = accessor.get(IInstantiationService).createInstance(BulkFileOperations, bulkEdit);
    return await result._init();
  }
  dispose() {
    this.checked.dispose();
    this.conflicts.dispose();
  }
  async _init() {
    const operationByResource = /* @__PURE__ */ new Map();
    const operationByCategory = /* @__PURE__ */ new Map();
    const newToOldUri = new ResourceMap();
    for (let idx = 0; idx < this._bulkEdit.length; idx++) {
      const edit = this._bulkEdit[idx];
      let uri;
      let type;
      this.checked.updateChecked(edit, !edit.metadata?.needsConfirmation);
      if (edit instanceof ResourceTextEdit) {
        type = 1 /* TextEdit */;
        uri = edit.resource;
      } else if (edit instanceof ResourceFileEdit) {
        if (edit.newResource && edit.oldResource) {
          type = 8 /* Rename */;
          uri = edit.oldResource;
          if (edit.options?.overwrite === void 0 && edit.options?.ignoreIfExists && await this._fileService.exists(uri)) {
            continue;
          }
          newToOldUri.set(edit.newResource, uri);
        } else if (edit.oldResource) {
          type = 4 /* Delete */;
          uri = edit.oldResource;
          if (edit.options?.ignoreIfNotExists && !await this._fileService.exists(uri)) {
            continue;
          }
        } else if (edit.newResource) {
          type = 2 /* Create */;
          uri = edit.newResource;
          if (edit.options?.overwrite === void 0 && edit.options?.ignoreIfExists && await this._fileService.exists(uri)) {
            continue;
          }
        } else {
          continue;
        }
      } else {
        continue;
      }
      const insert = (uri2, map) => {
        let key2 = extUri.getComparisonKey(uri2, true);
        let operation = map.get(key2);
        if (!operation && newToOldUri.has(uri2)) {
          uri2 = newToOldUri.get(uri2);
          key2 = extUri.getComparisonKey(uri2, true);
          operation = map.get(key2);
        }
        if (!operation) {
          operation = new BulkFileOperation(uri2, this);
          map.set(key2, operation);
        }
        operation.addEdit(idx, type, edit);
      };
      insert(uri, operationByResource);
      const key = BulkCategory.keyOf(edit.metadata);
      let category = operationByCategory.get(key);
      if (!category) {
        category = new BulkCategory(edit.metadata);
        operationByCategory.set(key, category);
      }
      insert(uri, category.operationByResource);
    }
    operationByResource.forEach((value) => this.fileOperations.push(value));
    operationByCategory.forEach((value) => this.categories.push(value));
    for (const file of this.fileOperations) {
      if (file.type !== 1 /* TextEdit */) {
        let checked = true;
        for (const edit of file.originalEdits.values()) {
          if (edit instanceof ResourceFileEdit) {
            checked = checked && this.checked.isChecked(edit);
          }
        }
        if (!checked) {
          for (const edit of file.originalEdits.values()) {
            this.checked.updateChecked(edit, checked);
          }
        }
      }
    }
    this.categories.sort((a, b) => {
      if (a.metadata.needsConfirmation === b.metadata.needsConfirmation) {
        return a.metadata.label.localeCompare(b.metadata.label);
      } else if (a.metadata.needsConfirmation) {
        return -1;
      } else {
        return 1;
      }
    });
    return this;
  }
  getWorkspaceEdit() {
    const result = [];
    let allAccepted = true;
    for (let i = 0; i < this._bulkEdit.length; i++) {
      const edit = this._bulkEdit[i];
      if (this.checked.isChecked(edit)) {
        result[i] = edit;
        continue;
      }
      allAccepted = false;
    }
    if (allAccepted) {
      return this._bulkEdit;
    }
    coalesceInPlace(result);
    return result;
  }
  async getFileEditOperation(edit) {
    const content = await edit.options.contents;
    if (!content) {
      return void 0;
    }
    return EditOperation.replaceMove(Range.lift({ startLineNumber: 0, startColumn: 0, endLineNumber: Number.MAX_VALUE, endColumn: 0 }), content.toString());
  }
  async getFileEdits(uri) {
    for (const file of this.fileOperations) {
      if (file.uri.toString() === uri.toString()) {
        const result = [];
        let ignoreAll = false;
        for (const edit of file.originalEdits.values()) {
          if (edit instanceof ResourceFileEdit) {
            result.push(this.getFileEditOperation(edit));
          } else if (edit instanceof ResourceTextEdit) {
            if (this.checked.isChecked(edit)) {
              result.push(Promise.resolve(EditOperation.replaceMove(Range.lift(edit.textEdit.range), !edit.textEdit.insertAsSnippet ? edit.textEdit.text : SnippetParser.asInsertText(edit.textEdit.text))));
            }
          } else if (!this.checked.isChecked(edit)) {
            ignoreAll = true;
          }
        }
        if (ignoreAll) {
          return [];
        }
        return (await Promise.all(result)).filter((r) => r !== void 0).sort((a, b) => Range.compareRangesUsingStarts(a.range, b.range));
      }
    }
    return [];
  }
  getUriOfEdit(edit) {
    for (const file of this.fileOperations) {
      for (const value of file.originalEdits.values()) {
        if (value === edit) {
          return file.uri;
        }
      }
    }
    throw new Error("invalid edit");
  }
};
BulkFileOperations = __decorateClass([
  __decorateParam(1, IFileService),
  __decorateParam(2, IInstantiationService)
], BulkFileOperations);
let BulkEditPreviewProvider = class {
  constructor(_operations, _languageService, _modelService, _textModelResolverService) {
    this._operations = _operations;
    this._languageService = _languageService;
    this._modelService = _modelService;
    this._textModelResolverService = _textModelResolverService;
    this._disposables = new DisposableStore();
    this._modelPreviewEdits = /* @__PURE__ */ new Map();
    this._instanceId = generateUuid();
    this._disposables.add(this._textModelResolverService.registerTextModelContentProvider(BulkEditPreviewProvider.Schema, this));
    this._ready = this._init();
  }
  static fromPreviewUri(uri) {
    return URI.parse(uri.query);
  }
  dispose() {
    this._disposables.dispose();
  }
  asPreviewUri(uri) {
    return URI.from({ scheme: BulkEditPreviewProvider.Schema, authority: this._instanceId, path: uri.path, query: uri.toString() });
  }
  async _init() {
    for (const operation of this._operations.fileOperations) {
      await this._applyTextEditsToPreviewModel(operation.uri);
    }
    this._disposables.add(Event.debounce(this._operations.checked.onDidChange, (_last, e) => e, MicrotaskDelay)((e) => {
      const uri = this._operations.getUriOfEdit(e);
      this._applyTextEditsToPreviewModel(uri);
    }));
  }
  async _applyTextEditsToPreviewModel(uri) {
    const model = await this._getOrCreatePreviewModel(uri);
    const undoEdits = this._modelPreviewEdits.get(model.id);
    if (undoEdits) {
      model.applyEdits(undoEdits);
    }
    const newEdits = await this._operations.getFileEdits(uri);
    const newUndoEdits = model.applyEdits(newEdits, true);
    this._modelPreviewEdits.set(model.id, newUndoEdits);
  }
  async _getOrCreatePreviewModel(uri) {
    const previewUri = this.asPreviewUri(uri);
    let model = this._modelService.getModel(previewUri);
    if (!model) {
      try {
        const ref = await this._textModelResolverService.createModelReference(uri);
        const sourceModel = ref.object.textEditorModel;
        model = this._modelService.createModel(
          createTextBufferFactoryFromSnapshot(sourceModel.createSnapshot()),
          this._languageService.createById(sourceModel.getLanguageId()),
          previewUri
        );
        ref.dispose();
      } catch {
        model = this._modelService.createModel(
          "",
          this._languageService.createByFilepathOrFirstLine(previewUri),
          previewUri
        );
      }
      queueMicrotask(async () => {
        this._disposables.add(await this._textModelResolverService.createModelReference(model.uri));
      });
    }
    return model;
  }
  async provideTextContent(previewUri) {
    if (previewUri.toString() === BulkEditPreviewProvider.emptyPreview.toString()) {
      return this._modelService.createModel("", null, previewUri);
    }
    await this._ready;
    return this._modelService.getModel(previewUri);
  }
};
BulkEditPreviewProvider.Schema = "vscode-bulkeditpreview-editor";
BulkEditPreviewProvider.emptyPreview = URI.from({ scheme: BulkEditPreviewProvider.Schema, fragment: "empty" });
BulkEditPreviewProvider = __decorateClass([
  __decorateParam(1, ILanguageService),
  __decorateParam(2, IModelService),
  __decorateParam(3, ITextModelService)
], BulkEditPreviewProvider);
export {
  BulkCategory,
  BulkEditPreviewProvider,
  BulkFileOperation,
  BulkFileOperationType,
  BulkFileOperations,
  BulkTextEdit,
  CheckedStates
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9idWxrRWRpdC9icm93c2VyL3ByZXZpZXcvYnVsa0VkaXRQcmV2aWV3LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSVRleHRNb2RlbENvbnRlbnRQcm92aWRlciwgSVRleHRNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3Jlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IGNyZWF0ZVRleHRCdWZmZXJGYWN0b3J5RnJvbVNuYXBzaG90IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC90ZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgV29ya3NwYWNlRWRpdE1ldGFkYXRhIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGNvYWxlc2NlSW5QbGFjZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBFZGl0T3BlcmF0aW9uLCBJU2luZ2xlRWRpdE9wZXJhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9lZGl0T3BlcmF0aW9uLmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IsIElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgQ29uZmxpY3REZXRlY3RvciB9IGZyb20gJy4uL2NvbmZsaWN0cy5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZU1hcCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBleHRVcmkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VFZGl0LCBSZXNvdXJjZUZpbGVFZGl0LCBSZXNvdXJjZVRleHRFZGl0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvc2VydmljZXMvYnVsa0VkaXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBnZW5lcmF0ZVV1aWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91dWlkLmpzJztcbmltcG9ydCB7IFNuaXBwZXRQYXJzZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9zbmlwcGV0L2Jyb3dzZXIvc25pcHBldFBhcnNlci5qcyc7XG5pbXBvcnQgeyBNaWNyb3Rhc2tEZWxheSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N5bWJvbHMuanMnO1xuXG5leHBvcnQgY2xhc3MgQ2hlY2tlZFN0YXRlczxUIGV4dGVuZHMgb2JqZWN0PiB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfc3RhdGVzID0gbmV3IFdlYWtNYXA8VCwgYm9vbGVhbj4oKTtcblx0cHJpdmF0ZSBfY2hlY2tlZENvdW50OiBudW1iZXIgPSAwO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlID0gbmV3IEVtaXR0ZXI8VD4oKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2U6IEV2ZW50PFQ+ID0gdGhpcy5fb25EaWRDaGFuZ2UuZXZlbnQ7XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9vbkRpZENoYW5nZS5kaXNwb3NlKCk7XG5cdH1cblxuXHRnZXQgY2hlY2tlZENvdW50KCkge1xuXHRcdHJldHVybiB0aGlzLl9jaGVja2VkQ291bnQ7XG5cdH1cblxuXHRpc0NoZWNrZWQob2JqOiBUKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3N0YXRlcy5nZXQob2JqKSA/PyBmYWxzZTtcblx0fVxuXG5cdHVwZGF0ZUNoZWNrZWQob2JqOiBULCB2YWx1ZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdGNvbnN0IHZhbHVlTm93ID0gdGhpcy5fc3RhdGVzLmdldChvYmopO1xuXHRcdGlmICh2YWx1ZU5vdyA9PT0gdmFsdWUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHZhbHVlTm93ID09PSB1bmRlZmluZWQpIHtcblx0XHRcdGlmICh2YWx1ZSkge1xuXHRcdFx0XHR0aGlzLl9jaGVja2VkQ291bnQgKz0gMTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKHZhbHVlKSB7XG5cdFx0XHRcdHRoaXMuX2NoZWNrZWRDb3VudCArPSAxO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fY2hlY2tlZENvdW50IC09IDE7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuX3N0YXRlcy5zZXQob2JqLCB2YWx1ZSk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZShvYmopO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBCdWxrVGV4dEVkaXQge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IHBhcmVudDogQnVsa0ZpbGVPcGVyYXRpb24sXG5cdFx0cmVhZG9ubHkgdGV4dEVkaXQ6IFJlc291cmNlVGV4dEVkaXRcblx0KSB7IH1cbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gQnVsa0ZpbGVPcGVyYXRpb25UeXBlIHtcblx0VGV4dEVkaXQgPSAxLFxuXHRDcmVhdGUgPSAyLFxuXHREZWxldGUgPSA0LFxuXHRSZW5hbWUgPSA4LFxufVxuXG5leHBvcnQgY2xhc3MgQnVsa0ZpbGVPcGVyYXRpb24ge1xuXG5cdHR5cGUgPSAwO1xuXHR0ZXh0RWRpdHM6IEJ1bGtUZXh0RWRpdFtdID0gW107XG5cdG9yaWdpbmFsRWRpdHMgPSBuZXcgTWFwPG51bWJlciwgUmVzb3VyY2VUZXh0RWRpdCB8IFJlc291cmNlRmlsZUVkaXQ+KCk7XG5cdG5ld1VyaT86IFVSSTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSB1cmk6IFVSSSxcblx0XHRyZWFkb25seSBwYXJlbnQ6IEJ1bGtGaWxlT3BlcmF0aW9uc1xuXHQpIHsgfVxuXG5cdGFkZEVkaXQoaW5kZXg6IG51bWJlciwgdHlwZTogQnVsa0ZpbGVPcGVyYXRpb25UeXBlLCBlZGl0OiBSZXNvdXJjZVRleHRFZGl0IHwgUmVzb3VyY2VGaWxlRWRpdCkge1xuXHRcdHRoaXMudHlwZSB8PSB0eXBlO1xuXHRcdHRoaXMub3JpZ2luYWxFZGl0cy5zZXQoaW5kZXgsIGVkaXQpO1xuXHRcdGlmIChlZGl0IGluc3RhbmNlb2YgUmVzb3VyY2VUZXh0RWRpdCkge1xuXHRcdFx0dGhpcy50ZXh0RWRpdHMucHVzaChuZXcgQnVsa1RleHRFZGl0KHRoaXMsIGVkaXQpKTtcblxuXHRcdH0gZWxzZSBpZiAodHlwZSA9PT0gQnVsa0ZpbGVPcGVyYXRpb25UeXBlLlJlbmFtZSkge1xuXHRcdFx0dGhpcy5uZXdVcmkgPSBlZGl0Lm5ld1Jlc291cmNlO1xuXHRcdH1cblx0fVxuXG5cdG5lZWRzQ29uZmlybWF0aW9uKCk6IGJvb2xlYW4ge1xuXHRcdGZvciAoY29uc3QgWywgZWRpdF0gb2YgdGhpcy5vcmlnaW5hbEVkaXRzKSB7XG5cdFx0XHRpZiAoIXRoaXMucGFyZW50LmNoZWNrZWQuaXNDaGVja2VkKGVkaXQpKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEJ1bGtDYXRlZ29yeSB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgX2RlZmF1bHRNZXRhZGF0YSA9IE9iamVjdC5mcmVlemUoe1xuXHRcdGxhYmVsOiBsb2NhbGl6ZSgnZGVmYXVsdCcsIFwiT3RoZXJcIiksXG5cdFx0aWNvbjogQ29kaWNvbi5zeW1ib2xGaWxlLFxuXHRcdG5lZWRzQ29uZmlybWF0aW9uOiBmYWxzZVxuXHR9KTtcblxuXHRzdGF0aWMga2V5T2YobWV0YWRhdGE/OiBXb3Jrc3BhY2VFZGl0TWV0YWRhdGEpIHtcblx0XHRyZXR1cm4gbWV0YWRhdGE/LmxhYmVsIHx8ICc8ZGVmYXVsdD4nO1xuXHR9XG5cblx0cmVhZG9ubHkgb3BlcmF0aW9uQnlSZXNvdXJjZSA9IG5ldyBNYXA8c3RyaW5nLCBCdWxrRmlsZU9wZXJhdGlvbj4oKTtcblxuXHRjb25zdHJ1Y3RvcihyZWFkb25seSBtZXRhZGF0YTogV29ya3NwYWNlRWRpdE1ldGFkYXRhID0gQnVsa0NhdGVnb3J5Ll9kZWZhdWx0TWV0YWRhdGEpIHsgfVxuXG5cdGdldCBmaWxlT3BlcmF0aW9ucygpOiBJdGVyYWJsZUl0ZXJhdG9yPEJ1bGtGaWxlT3BlcmF0aW9uPiB7XG5cdFx0cmV0dXJuIHRoaXMub3BlcmF0aW9uQnlSZXNvdXJjZS52YWx1ZXMoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQnVsa0ZpbGVPcGVyYXRpb25zIHtcblxuXHRzdGF0aWMgYXN5bmMgY3JlYXRlKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBidWxrRWRpdDogUmVzb3VyY2VFZGl0W10pOiBQcm9taXNlPEJ1bGtGaWxlT3BlcmF0aW9ucz4ge1xuXHRcdGNvbnN0IHJlc3VsdCA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpLmNyZWF0ZUluc3RhbmNlKEJ1bGtGaWxlT3BlcmF0aW9ucywgYnVsa0VkaXQpO1xuXHRcdHJldHVybiBhd2FpdCByZXN1bHQuX2luaXQoKTtcblx0fVxuXG5cdHJlYWRvbmx5IGNoZWNrZWQgPSBuZXcgQ2hlY2tlZFN0YXRlczxSZXNvdXJjZUVkaXQ+KCk7XG5cblx0cmVhZG9ubHkgZmlsZU9wZXJhdGlvbnM6IEJ1bGtGaWxlT3BlcmF0aW9uW10gPSBbXTtcblx0cmVhZG9ubHkgY2F0ZWdvcmllczogQnVsa0NhdGVnb3J5W10gPSBbXTtcblx0cmVhZG9ubHkgY29uZmxpY3RzOiBDb25mbGljdERldGVjdG9yO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2J1bGtFZGl0OiBSZXNvdXJjZUVkaXRbXSxcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2ZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YVNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0dGhpcy5jb25mbGljdHMgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29uZmxpY3REZXRlY3RvciwgX2J1bGtFZGl0KTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5jaGVja2VkLmRpc3Bvc2UoKTtcblx0XHR0aGlzLmNvbmZsaWN0cy5kaXNwb3NlKCk7XG5cdH1cblxuXHRhc3luYyBfaW5pdCgpIHtcblx0XHRjb25zdCBvcGVyYXRpb25CeVJlc291cmNlID0gbmV3IE1hcDxzdHJpbmcsIEJ1bGtGaWxlT3BlcmF0aW9uPigpO1xuXHRcdGNvbnN0IG9wZXJhdGlvbkJ5Q2F0ZWdvcnkgPSBuZXcgTWFwPHN0cmluZywgQnVsa0NhdGVnb3J5PigpO1xuXG5cdFx0Y29uc3QgbmV3VG9PbGRVcmkgPSBuZXcgUmVzb3VyY2VNYXA8VVJJPigpO1xuXG5cdFx0Zm9yIChsZXQgaWR4ID0gMDsgaWR4IDwgdGhpcy5fYnVsa0VkaXQubGVuZ3RoOyBpZHgrKykge1xuXHRcdFx0Y29uc3QgZWRpdCA9IHRoaXMuX2J1bGtFZGl0W2lkeF07XG5cblx0XHRcdGxldCB1cmk6IFVSSTtcblx0XHRcdGxldCB0eXBlOiBCdWxrRmlsZU9wZXJhdGlvblR5cGU7XG5cblx0XHRcdC8vIHN0b3JlIGluaXRhbCBjaGVja2VkIHN0YXRlXG5cdFx0XHR0aGlzLmNoZWNrZWQudXBkYXRlQ2hlY2tlZChlZGl0LCAhZWRpdC5tZXRhZGF0YT8ubmVlZHNDb25maXJtYXRpb24pO1xuXG5cdFx0XHRpZiAoZWRpdCBpbnN0YW5jZW9mIFJlc291cmNlVGV4dEVkaXQpIHtcblx0XHRcdFx0dHlwZSA9IEJ1bGtGaWxlT3BlcmF0aW9uVHlwZS5UZXh0RWRpdDtcblx0XHRcdFx0dXJpID0gZWRpdC5yZXNvdXJjZTtcblxuXHRcdFx0fSBlbHNlIGlmIChlZGl0IGluc3RhbmNlb2YgUmVzb3VyY2VGaWxlRWRpdCkge1xuXHRcdFx0XHRpZiAoZWRpdC5uZXdSZXNvdXJjZSAmJiBlZGl0Lm9sZFJlc291cmNlKSB7XG5cdFx0XHRcdFx0dHlwZSA9IEJ1bGtGaWxlT3BlcmF0aW9uVHlwZS5SZW5hbWU7XG5cdFx0XHRcdFx0dXJpID0gZWRpdC5vbGRSZXNvdXJjZTtcblx0XHRcdFx0XHRpZiAoZWRpdC5vcHRpb25zPy5vdmVyd3JpdGUgPT09IHVuZGVmaW5lZCAmJiBlZGl0Lm9wdGlvbnM/Lmlnbm9yZUlmRXhpc3RzICYmIGF3YWl0IHRoaXMuX2ZpbGVTZXJ2aWNlLmV4aXN0cyh1cmkpKSB7XG5cdFx0XHRcdFx0XHQvLyBub29wIC0+IFwic29mdFwiIHJlbmFtZSB0byBzb21ldGhpbmcgdGhhdCBhbHJlYWR5IGV4aXN0c1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdC8vIG1hcCBuZXdSZXNvdXJjZSBvbnRvIG9sZFJlc291cmNlIHNvIHRoYXQgdGV4dC1lZGl0IGFwcGVhciBmb3Jcblx0XHRcdFx0XHQvLyB0aGUgc2FtZSBmaWxlIGVsZW1lbnRcblx0XHRcdFx0XHRuZXdUb09sZFVyaS5zZXQoZWRpdC5uZXdSZXNvdXJjZSwgdXJpKTtcblxuXHRcdFx0XHR9IGVsc2UgaWYgKGVkaXQub2xkUmVzb3VyY2UpIHtcblx0XHRcdFx0XHR0eXBlID0gQnVsa0ZpbGVPcGVyYXRpb25UeXBlLkRlbGV0ZTtcblx0XHRcdFx0XHR1cmkgPSBlZGl0Lm9sZFJlc291cmNlO1xuXHRcdFx0XHRcdGlmIChlZGl0Lm9wdGlvbnM/Lmlnbm9yZUlmTm90RXhpc3RzICYmICFhd2FpdCB0aGlzLl9maWxlU2VydmljZS5leGlzdHModXJpKSkge1xuXHRcdFx0XHRcdFx0Ly8gbm9vcCAtPiBcInNvZnRcIiBkZWxldGUgc29tZXRoaW5nIHRoYXQgZG9lc24ndCBleGlzdFxuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdH0gZWxzZSBpZiAoZWRpdC5uZXdSZXNvdXJjZSkge1xuXHRcdFx0XHRcdHR5cGUgPSBCdWxrRmlsZU9wZXJhdGlvblR5cGUuQ3JlYXRlO1xuXHRcdFx0XHRcdHVyaSA9IGVkaXQubmV3UmVzb3VyY2U7XG5cdFx0XHRcdFx0aWYgKGVkaXQub3B0aW9ucz8ub3ZlcndyaXRlID09PSB1bmRlZmluZWQgJiYgZWRpdC5vcHRpb25zPy5pZ25vcmVJZkV4aXN0cyAmJiBhd2FpdCB0aGlzLl9maWxlU2VydmljZS5leGlzdHModXJpKSkge1xuXHRcdFx0XHRcdFx0Ly8gbm9vcCAtPiBcInNvZnRcIiBjcmVhdGUgc29tZXRoaW5nIHRoYXQgYWxyZWFkeSBleGlzdHNcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIGludmFsaWQgZWRpdCAtPiBza2lwXG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gdW5zdXBwb3J0ZWQgZWRpdFxuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgaW5zZXJ0ID0gKHVyaTogVVJJLCBtYXA6IE1hcDxzdHJpbmcsIEJ1bGtGaWxlT3BlcmF0aW9uPikgPT4ge1xuXHRcdFx0XHRsZXQga2V5ID0gZXh0VXJpLmdldENvbXBhcmlzb25LZXkodXJpLCB0cnVlKTtcblx0XHRcdFx0bGV0IG9wZXJhdGlvbiA9IG1hcC5nZXQoa2V5KTtcblxuXHRcdFx0XHQvLyByZW5hbWVcblx0XHRcdFx0aWYgKCFvcGVyYXRpb24gJiYgbmV3VG9PbGRVcmkuaGFzKHVyaSkpIHtcblx0XHRcdFx0XHR1cmkgPSBuZXdUb09sZFVyaS5nZXQodXJpKSE7XG5cdFx0XHRcdFx0a2V5ID0gZXh0VXJpLmdldENvbXBhcmlzb25LZXkodXJpLCB0cnVlKTtcblx0XHRcdFx0XHRvcGVyYXRpb24gPSBtYXAuZ2V0KGtleSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoIW9wZXJhdGlvbikge1xuXHRcdFx0XHRcdG9wZXJhdGlvbiA9IG5ldyBCdWxrRmlsZU9wZXJhdGlvbih1cmksIHRoaXMpO1xuXHRcdFx0XHRcdG1hcC5zZXQoa2V5LCBvcGVyYXRpb24pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdG9wZXJhdGlvbi5hZGRFZGl0KGlkeCwgdHlwZSwgZWRpdCk7XG5cdFx0XHR9O1xuXG5cdFx0XHRpbnNlcnQodXJpLCBvcGVyYXRpb25CeVJlc291cmNlKTtcblxuXHRcdFx0Ly8gaW5zZXJ0IGludG8gXCJ0aGlzXCIgY2F0ZWdvcnlcblx0XHRcdGNvbnN0IGtleSA9IEJ1bGtDYXRlZ29yeS5rZXlPZihlZGl0Lm1ldGFkYXRhKTtcblx0XHRcdGxldCBjYXRlZ29yeSA9IG9wZXJhdGlvbkJ5Q2F0ZWdvcnkuZ2V0KGtleSk7XG5cdFx0XHRpZiAoIWNhdGVnb3J5KSB7XG5cdFx0XHRcdGNhdGVnb3J5ID0gbmV3IEJ1bGtDYXRlZ29yeShlZGl0Lm1ldGFkYXRhKTtcblx0XHRcdFx0b3BlcmF0aW9uQnlDYXRlZ29yeS5zZXQoa2V5LCBjYXRlZ29yeSk7XG5cdFx0XHR9XG5cdFx0XHRpbnNlcnQodXJpLCBjYXRlZ29yeS5vcGVyYXRpb25CeVJlc291cmNlKTtcblx0XHR9XG5cblx0XHRvcGVyYXRpb25CeVJlc291cmNlLmZvckVhY2godmFsdWUgPT4gdGhpcy5maWxlT3BlcmF0aW9ucy5wdXNoKHZhbHVlKSk7XG5cdFx0b3BlcmF0aW9uQnlDYXRlZ29yeS5mb3JFYWNoKHZhbHVlID0+IHRoaXMuY2F0ZWdvcmllcy5wdXNoKHZhbHVlKSk7XG5cblx0XHQvLyBcImNvcnJlY3RcIiBpbnZhbGlkIHBhcmVudC1jaGVjayBjaGlsZCBzdGF0ZXMgdGhhdCBpc1xuXHRcdC8vIHVuY2hlY2tlZCBmaWxlIGVkaXRzIChyZW5hbWUsIGNyZWF0ZSwgZGVsZXRlKSB1bmNoZWNrXG5cdFx0Ly8gYWxsIGVkaXRzIGZvciBhIGZpbGUsIGUuZyBubyB0ZXh0IGNoYW5nZSB3aXRob3V0IHJlbmFtZVxuXHRcdGZvciAoY29uc3QgZmlsZSBvZiB0aGlzLmZpbGVPcGVyYXRpb25zKSB7XG5cdFx0XHRpZiAoZmlsZS50eXBlICE9PSBCdWxrRmlsZU9wZXJhdGlvblR5cGUuVGV4dEVkaXQpIHtcblx0XHRcdFx0bGV0IGNoZWNrZWQgPSB0cnVlO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGVkaXQgb2YgZmlsZS5vcmlnaW5hbEVkaXRzLnZhbHVlcygpKSB7XG5cdFx0XHRcdFx0aWYgKGVkaXQgaW5zdGFuY2VvZiBSZXNvdXJjZUZpbGVFZGl0KSB7XG5cdFx0XHRcdFx0XHRjaGVja2VkID0gY2hlY2tlZCAmJiB0aGlzLmNoZWNrZWQuaXNDaGVja2VkKGVkaXQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIWNoZWNrZWQpIHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IGVkaXQgb2YgZmlsZS5vcmlnaW5hbEVkaXRzLnZhbHVlcygpKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmNoZWNrZWQudXBkYXRlQ2hlY2tlZChlZGl0LCBjaGVja2VkKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBzb3J0IChvbmNlKSBjYXRlZ29yaWVzIGF0b3Agd2hpY2ggaGF2ZSB1bmNvbmZpcm1lZCBlZGl0c1xuXHRcdHRoaXMuY2F0ZWdvcmllcy5zb3J0KChhLCBiKSA9PiB7XG5cdFx0XHRpZiAoYS5tZXRhZGF0YS5uZWVkc0NvbmZpcm1hdGlvbiA9PT0gYi5tZXRhZGF0YS5uZWVkc0NvbmZpcm1hdGlvbikge1xuXHRcdFx0XHRyZXR1cm4gYS5tZXRhZGF0YS5sYWJlbC5sb2NhbGVDb21wYXJlKGIubWV0YWRhdGEubGFiZWwpO1xuXHRcdFx0fSBlbHNlIGlmIChhLm1ldGFkYXRhLm5lZWRzQ29uZmlybWF0aW9uKSB7XG5cdFx0XHRcdHJldHVybiAtMTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiAxO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblxuXHRnZXRXb3Jrc3BhY2VFZGl0KCk6IFJlc291cmNlRWRpdFtdIHtcblx0XHRjb25zdCByZXN1bHQ6IFJlc291cmNlRWRpdFtdID0gW107XG5cdFx0bGV0IGFsbEFjY2VwdGVkID0gdHJ1ZTtcblxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fYnVsa0VkaXQubGVuZ3RoOyBpKyspIHtcblx0XHRcdGNvbnN0IGVkaXQgPSB0aGlzLl9idWxrRWRpdFtpXTtcblx0XHRcdGlmICh0aGlzLmNoZWNrZWQuaXNDaGVja2VkKGVkaXQpKSB7XG5cdFx0XHRcdHJlc3VsdFtpXSA9IGVkaXQ7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0YWxsQWNjZXB0ZWQgPSBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoYWxsQWNjZXB0ZWQpIHtcblx0XHRcdHJldHVybiB0aGlzLl9idWxrRWRpdDtcblx0XHR9XG5cblx0XHQvLyBub3QgYWxsIGVkaXRzIGhhdmUgYmVlbiBhY2NlcHRlZFxuXHRcdGNvYWxlc2NlSW5QbGFjZShyZXN1bHQpO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldEZpbGVFZGl0T3BlcmF0aW9uKGVkaXQ6IFJlc291cmNlRmlsZUVkaXQpOiBQcm9taXNlPElTaW5nbGVFZGl0T3BlcmF0aW9uIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IGVkaXQub3B0aW9ucy5jb250ZW50cztcblx0XHRpZiAoIWNvbnRlbnQpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXHRcdHJldHVybiBFZGl0T3BlcmF0aW9uLnJlcGxhY2VNb3ZlKFJhbmdlLmxpZnQoeyBzdGFydExpbmVOdW1iZXI6IDAsIHN0YXJ0Q29sdW1uOiAwLCBlbmRMaW5lTnVtYmVyOiBOdW1iZXIuTUFYX1ZBTFVFLCBlbmRDb2x1bW46IDAgfSksIGNvbnRlbnQudG9TdHJpbmcoKSk7XG5cdH1cblxuXHRhc3luYyBnZXRGaWxlRWRpdHModXJpOiBVUkkpOiBQcm9taXNlPElTaW5nbGVFZGl0T3BlcmF0aW9uW10+IHtcblxuXHRcdGZvciAoY29uc3QgZmlsZSBvZiB0aGlzLmZpbGVPcGVyYXRpb25zKSB7XG5cdFx0XHRpZiAoZmlsZS51cmkudG9TdHJpbmcoKSA9PT0gdXJpLnRvU3RyaW5nKCkpIHtcblxuXHRcdFx0XHRjb25zdCByZXN1bHQ6IFByb21pc2U8SVNpbmdsZUVkaXRPcGVyYXRpb24gfCB1bmRlZmluZWQ+W10gPSBbXTtcblx0XHRcdFx0bGV0IGlnbm9yZUFsbCA9IGZhbHNlO1xuXG5cdFx0XHRcdGZvciAoY29uc3QgZWRpdCBvZiBmaWxlLm9yaWdpbmFsRWRpdHMudmFsdWVzKCkpIHtcblx0XHRcdFx0XHRpZiAoZWRpdCBpbnN0YW5jZW9mIFJlc291cmNlRmlsZUVkaXQpIHtcblx0XHRcdFx0XHRcdHJlc3VsdC5wdXNoKHRoaXMuZ2V0RmlsZUVkaXRPcGVyYXRpb24oZWRpdCkpO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoZWRpdCBpbnN0YW5jZW9mIFJlc291cmNlVGV4dEVkaXQpIHtcblx0XHRcdFx0XHRcdGlmICh0aGlzLmNoZWNrZWQuaXNDaGVja2VkKGVkaXQpKSB7XG5cdFx0XHRcdFx0XHRcdHJlc3VsdC5wdXNoKFByb21pc2UucmVzb2x2ZShFZGl0T3BlcmF0aW9uLnJlcGxhY2VNb3ZlKFJhbmdlLmxpZnQoZWRpdC50ZXh0RWRpdC5yYW5nZSksICFlZGl0LnRleHRFZGl0Lmluc2VydEFzU25pcHBldCA/IGVkaXQudGV4dEVkaXQudGV4dCA6IFNuaXBwZXRQYXJzZXIuYXNJbnNlcnRUZXh0KGVkaXQudGV4dEVkaXQudGV4dCkpKSk7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR9IGVsc2UgaWYgKCF0aGlzLmNoZWNrZWQuaXNDaGVja2VkKGVkaXQpKSB7XG5cdFx0XHRcdFx0XHQvLyBVTkNIRUNLRUQgV29ya3NwYWNlRmlsZUVkaXQgZGlzYWJsZXMgYWxsIHRleHQgZWRpdHNcblx0XHRcdFx0XHRcdGlnbm9yZUFsbCA9IHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGlnbm9yZUFsbCkge1xuXHRcdFx0XHRcdHJldHVybiBbXTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiAoYXdhaXQgUHJvbWlzZS5hbGwocmVzdWx0KSkuZmlsdGVyKHIgPT4gciAhPT0gdW5kZWZpbmVkKS5zb3J0KChhLCBiKSA9PiBSYW5nZS5jb21wYXJlUmFuZ2VzVXNpbmdTdGFydHMoYS5yYW5nZSwgYi5yYW5nZSkpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gW107XG5cdH1cblxuXHRnZXRVcmlPZkVkaXQoZWRpdDogUmVzb3VyY2VFZGl0KTogVVJJIHtcblx0XHRmb3IgKGNvbnN0IGZpbGUgb2YgdGhpcy5maWxlT3BlcmF0aW9ucykge1xuXHRcdFx0Zm9yIChjb25zdCB2YWx1ZSBvZiBmaWxlLm9yaWdpbmFsRWRpdHMudmFsdWVzKCkpIHtcblx0XHRcdFx0aWYgKHZhbHVlID09PSBlZGl0KSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZpbGUudXJpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRocm93IG5ldyBFcnJvcignaW52YWxpZCBlZGl0Jyk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEJ1bGtFZGl0UHJldmlld1Byb3ZpZGVyIGltcGxlbWVudHMgSVRleHRNb2RlbENvbnRlbnRQcm92aWRlciB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgU2NoZW1hID0gJ3ZzY29kZS1idWxrZWRpdHByZXZpZXctZWRpdG9yJztcblxuXHRzdGF0aWMgZW1wdHlQcmV2aWV3ID0gVVJJLmZyb20oeyBzY2hlbWU6IHRoaXMuU2NoZW1hLCBmcmFnbWVudDogJ2VtcHR5JyB9KTtcblxuXG5cdHN0YXRpYyBmcm9tUHJldmlld1VyaSh1cmk6IFVSSSk6IFVSSSB7XG5cdFx0cmV0dXJuIFVSSS5wYXJzZSh1cmkucXVlcnkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3JlYWR5OiBQcm9taXNlPGFueT47XG5cdHByaXZhdGUgcmVhZG9ubHkgX21vZGVsUHJldmlld0VkaXRzID0gbmV3IE1hcDxzdHJpbmcsIElTaW5nbGVFZGl0T3BlcmF0aW9uW10+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbmNlSWQgPSBnZW5lcmF0ZVV1aWQoKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9vcGVyYXRpb25zOiBCdWxrRmlsZU9wZXJhdGlvbnMsXG5cdFx0QElMYW5ndWFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRcdEBJTW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX21vZGVsU2VydmljZTogSU1vZGVsU2VydmljZSxcblx0XHRASVRleHRNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGV4dE1vZGVsUmVzb2x2ZXJTZXJ2aWNlOiBJVGV4dE1vZGVsU2VydmljZVxuXHQpIHtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQodGhpcy5fdGV4dE1vZGVsUmVzb2x2ZXJTZXJ2aWNlLnJlZ2lzdGVyVGV4dE1vZGVsQ29udGVudFByb3ZpZGVyKEJ1bGtFZGl0UHJldmlld1Byb3ZpZGVyLlNjaGVtYSwgdGhpcykpO1xuXHRcdHRoaXMuX3JlYWR5ID0gdGhpcy5faW5pdCgpO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH1cblxuXHRhc1ByZXZpZXdVcmkodXJpOiBVUkkpOiBVUkkge1xuXHRcdHJldHVybiBVUkkuZnJvbSh7IHNjaGVtZTogQnVsa0VkaXRQcmV2aWV3UHJvdmlkZXIuU2NoZW1hLCBhdXRob3JpdHk6IHRoaXMuX2luc3RhbmNlSWQsIHBhdGg6IHVyaS5wYXRoLCBxdWVyeTogdXJpLnRvU3RyaW5nKCkgfSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9pbml0KCkge1xuXHRcdGZvciAoY29uc3Qgb3BlcmF0aW9uIG9mIHRoaXMuX29wZXJhdGlvbnMuZmlsZU9wZXJhdGlvbnMpIHtcblx0XHRcdGF3YWl0IHRoaXMuX2FwcGx5VGV4dEVkaXRzVG9QcmV2aWV3TW9kZWwob3BlcmF0aW9uLnVyaSk7XG5cdFx0fVxuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZChFdmVudC5kZWJvdW5jZSh0aGlzLl9vcGVyYXRpb25zLmNoZWNrZWQub25EaWRDaGFuZ2UsIChfbGFzdCwgZSkgPT4gZSwgTWljcm90YXNrRGVsYXkpKGUgPT4ge1xuXHRcdFx0Y29uc3QgdXJpID0gdGhpcy5fb3BlcmF0aW9ucy5nZXRVcmlPZkVkaXQoZSk7XG5cdFx0XHR0aGlzLl9hcHBseVRleHRFZGl0c1RvUHJldmlld01vZGVsKHVyaSk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfYXBwbHlUZXh0RWRpdHNUb1ByZXZpZXdNb2RlbCh1cmk6IFVSSSkge1xuXHRcdGNvbnN0IG1vZGVsID0gYXdhaXQgdGhpcy5fZ2V0T3JDcmVhdGVQcmV2aWV3TW9kZWwodXJpKTtcblxuXHRcdC8vIHVuZG8gZWRpdHMgdGhhdCBoYXZlIGJlZW4gZG9uZSBiZWZvcmVcblx0XHRjb25zdCB1bmRvRWRpdHMgPSB0aGlzLl9tb2RlbFByZXZpZXdFZGl0cy5nZXQobW9kZWwuaWQpO1xuXHRcdGlmICh1bmRvRWRpdHMpIHtcblx0XHRcdG1vZGVsLmFwcGx5RWRpdHModW5kb0VkaXRzKTtcblx0XHR9XG5cdFx0Ly8gYXBwbHkgbmV3IGVkaXRzIGFuZCBrZWVwIChmdXR1cmUpIHVuZG8gZWRpdHNcblx0XHRjb25zdCBuZXdFZGl0cyA9IGF3YWl0IHRoaXMuX29wZXJhdGlvbnMuZ2V0RmlsZUVkaXRzKHVyaSk7XG5cdFx0Y29uc3QgbmV3VW5kb0VkaXRzID0gbW9kZWwuYXBwbHlFZGl0cyhuZXdFZGl0cywgdHJ1ZSk7XG5cdFx0dGhpcy5fbW9kZWxQcmV2aWV3RWRpdHMuc2V0KG1vZGVsLmlkLCBuZXdVbmRvRWRpdHMpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfZ2V0T3JDcmVhdGVQcmV2aWV3TW9kZWwodXJpOiBVUkkpIHtcblx0XHRjb25zdCBwcmV2aWV3VXJpID0gdGhpcy5hc1ByZXZpZXdVcmkodXJpKTtcblx0XHRsZXQgbW9kZWwgPSB0aGlzLl9tb2RlbFNlcnZpY2UuZ2V0TW9kZWwocHJldmlld1VyaSk7XG5cdFx0aWYgKCFtb2RlbCkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Ly8gdHJ5OiBjb3B5IGV4aXN0aW5nXG5cdFx0XHRcdGNvbnN0IHJlZiA9IGF3YWl0IHRoaXMuX3RleHRNb2RlbFJlc29sdmVyU2VydmljZS5jcmVhdGVNb2RlbFJlZmVyZW5jZSh1cmkpO1xuXHRcdFx0XHRjb25zdCBzb3VyY2VNb2RlbCA9IHJlZi5vYmplY3QudGV4dEVkaXRvck1vZGVsO1xuXHRcdFx0XHRtb2RlbCA9IHRoaXMuX21vZGVsU2VydmljZS5jcmVhdGVNb2RlbChcblx0XHRcdFx0XHRjcmVhdGVUZXh0QnVmZmVyRmFjdG9yeUZyb21TbmFwc2hvdChzb3VyY2VNb2RlbC5jcmVhdGVTbmFwc2hvdCgpKSxcblx0XHRcdFx0XHR0aGlzLl9sYW5ndWFnZVNlcnZpY2UuY3JlYXRlQnlJZChzb3VyY2VNb2RlbC5nZXRMYW5ndWFnZUlkKCkpLFxuXHRcdFx0XHRcdHByZXZpZXdVcmlcblx0XHRcdFx0KTtcblx0XHRcdFx0cmVmLmRpc3Bvc2UoKTtcblxuXHRcdFx0fSBjYXRjaCB7XG5cdFx0XHRcdC8vIGNyZWF0ZSBORVcgbW9kZWxcblx0XHRcdFx0bW9kZWwgPSB0aGlzLl9tb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWwoXG5cdFx0XHRcdFx0JycsXG5cdFx0XHRcdFx0dGhpcy5fbGFuZ3VhZ2VTZXJ2aWNlLmNyZWF0ZUJ5RmlsZXBhdGhPckZpcnN0TGluZShwcmV2aWV3VXJpKSxcblx0XHRcdFx0XHRwcmV2aWV3VXJpXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0XHQvLyB0aGlzIGlzIGEgbGl0dGxlIHdlaXJkIGJ1dCBvdGhlcndpc2UgZWRpdG9ycyBhbmQgb3RoZXIgY3Vzb21lcnNcblx0XHRcdC8vIHdpbGwgZGlzcG9zZSBteSBtb2RlbHMgYmVmb3JlIHRoZXkgc2hvdWxkIGJlIGRpc3Bvc2VkLi4uXG5cdFx0XHQvLyBBbmQgYWxsIG9mIHRoaXMgaXMgb2ZmIHRoZSBldmVudGxvb3AgdG8gcHJldmVudCBlbmRsZXNzIHJlY3Vyc2lvblxuXHRcdFx0cXVldWVNaWNyb3Rhc2soYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQoYXdhaXQgdGhpcy5fdGV4dE1vZGVsUmVzb2x2ZXJTZXJ2aWNlLmNyZWF0ZU1vZGVsUmVmZXJlbmNlKG1vZGVsIS51cmkpKTtcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRyZXR1cm4gbW9kZWw7XG5cdH1cblxuXHRhc3luYyBwcm92aWRlVGV4dENvbnRlbnQocHJldmlld1VyaTogVVJJKSB7XG5cdFx0aWYgKHByZXZpZXdVcmkudG9TdHJpbmcoKSA9PT0gQnVsa0VkaXRQcmV2aWV3UHJvdmlkZXIuZW1wdHlQcmV2aWV3LnRvU3RyaW5nKCkpIHtcblx0XHRcdHJldHVybiB0aGlzLl9tb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWwoJycsIG51bGwsIHByZXZpZXdVcmkpO1xuXHRcdH1cblx0XHRhd2FpdCB0aGlzLl9yZWFkeTtcblx0XHRyZXR1cm4gdGhpcy5fbW9kZWxTZXJ2aWNlLmdldE1vZGVsKHByZXZpZXdVcmkpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtB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
