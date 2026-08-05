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
import { dispose } from "../../../../base/common/lifecycle.js";
import { EditOperation } from "../../../../editor/common/core/editOperation.js";
import { Range } from "../../../../editor/common/core/range.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { IEditorWorkerService } from "../../../../editor/common/services/editorWorker.js";
import { IUndoRedoService } from "../../../../platform/undoRedo/common/undoRedo.js";
import { SingleModelEditStackElement, MultiModelEditStackElement } from "../../../../editor/common/model/editStack.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ResourceTextEdit } from "../../../../editor/browser/services/bulkEditService.js";
import { SnippetController2 } from "../../../../editor/contrib/snippet/browser/snippetController2.js";
import { SnippetParser } from "../../../../editor/contrib/snippet/browser/snippetParser.js";
class ModelEditTask {
  constructor(_modelReference) {
    this._modelReference = _modelReference;
    this.model = this._modelReference.object.textEditorModel;
    this._edits = [];
  }
  dispose() {
    this._modelReference.dispose();
  }
  isNoOp() {
    if (this._edits.length > 0) {
      return false;
    }
    if (this._newEol !== void 0 && this._newEol !== this.model.getEndOfLineSequence()) {
      return false;
    }
    return true;
  }
  addEdit(resourceEdit) {
    this._expectedModelVersionId = resourceEdit.versionId;
    const { textEdit } = resourceEdit;
    if (typeof textEdit.eol === "number") {
      this._newEol = textEdit.eol;
    }
    if (!textEdit.range && !textEdit.text) {
      return;
    }
    if (Range.isEmpty(textEdit.range) && !textEdit.text) {
      return;
    }
    let range;
    if (!textEdit.range) {
      range = this.model.getFullModelRange();
    } else {
      range = Range.lift(textEdit.range);
    }
    this._edits.push({ ...EditOperation.replaceMove(range, textEdit.text), insertAsSnippet: textEdit.insertAsSnippet, keepWhitespace: textEdit.keepWhitespace });
  }
  validate() {
    if (typeof this._expectedModelVersionId === "undefined" || this.model.getVersionId() === this._expectedModelVersionId) {
      return { canApply: true };
    }
    return { canApply: false, reason: this.model.uri };
  }
  getBeforeCursorState() {
    return null;
  }
  apply() {
    if (this._edits.length > 0) {
      this._edits = this._edits.map(this._transformSnippetStringToInsertText, this).sort((a, b) => Range.compareRangesUsingStarts(a.range, b.range));
      this.model.pushEditOperations(null, this._edits, () => null);
    }
    if (this._newEol !== void 0) {
      this.model.pushEOL(this._newEol);
    }
  }
  _transformSnippetStringToInsertText(edit) {
    if (!edit.insertAsSnippet) {
      return edit;
    }
    if (!edit.text) {
      return edit;
    }
    const text = SnippetParser.asInsertText(edit.text);
    return { ...edit, insertAsSnippet: false, text };
  }
}
class EditorEditTask extends ModelEditTask {
  constructor(modelReference, editor) {
    super(modelReference);
    this._editor = editor;
  }
  getBeforeCursorState() {
    return this._canUseEditor() ? this._editor.getSelections() : null;
  }
  apply() {
    if (!this._canUseEditor()) {
      super.apply();
      return;
    }
    if (this._edits.length > 0) {
      const snippetCtrl = SnippetController2.get(this._editor);
      if (snippetCtrl && this._edits.some((edit) => edit.insertAsSnippet)) {
        const snippetEdits = [];
        for (const edit of this._edits) {
          if (edit.range && edit.text !== null) {
            snippetEdits.push({
              range: Range.lift(edit.range),
              template: edit.insertAsSnippet ? edit.text : SnippetParser.escape(edit.text),
              keepWhitespace: edit.keepWhitespace
            });
          }
        }
        snippetCtrl.apply(snippetEdits, { undoStopBefore: false, undoStopAfter: false });
      } else {
        this._edits = this._edits.map(this._transformSnippetStringToInsertText, this).sort((a, b) => Range.compareRangesUsingStarts(a.range, b.range));
        this._editor.executeEdits("", this._edits);
      }
    }
    if (this._newEol !== void 0) {
      if (this._editor.hasModel()) {
        this._editor.getModel().pushEOL(this._newEol);
      }
    }
  }
  _canUseEditor() {
    return this._editor?.getModel()?.uri.toString() === this.model.uri.toString();
  }
}
let BulkTextEdits = class {
  constructor(_label, _code, _editor, _undoRedoGroup, _undoRedoSource, _progress, _token, edits, _editorWorker, _modelService, _textModelResolverService, _undoRedoService) {
    this._label = _label;
    this._code = _code;
    this._editor = _editor;
    this._undoRedoGroup = _undoRedoGroup;
    this._undoRedoSource = _undoRedoSource;
    this._progress = _progress;
    this._token = _token;
    this._editorWorker = _editorWorker;
    this._modelService = _modelService;
    this._textModelResolverService = _textModelResolverService;
    this._undoRedoService = _undoRedoService;
    this._edits = new ResourceMap();
    for (const edit of edits) {
      let array = this._edits.get(edit.resource);
      if (!array) {
        array = [];
        this._edits.set(edit.resource, array);
      }
      array.push(edit);
    }
  }
  _validateBeforePrepare() {
    for (const array of this._edits.values()) {
      for (const edit of array) {
        if (typeof edit.versionId === "number") {
          const model = this._modelService.getModel(edit.resource);
          if (model && model.getVersionId() !== edit.versionId) {
            throw new Error(`${model.uri.toString()} has changed in the meantime`);
          }
        }
      }
    }
  }
  async _createEditsTasks() {
    const tasks = [];
    const promises = [];
    for (const [key, edits] of this._edits) {
      const promise = this._textModelResolverService.createModelReference(key).then(async (ref) => {
        let task;
        let makeMinimal = false;
        if (this._editor?.getModel()?.uri.toString() === ref.object.textEditorModel.uri.toString()) {
          task = new EditorEditTask(ref, this._editor);
          makeMinimal = true;
        } else {
          task = new ModelEditTask(ref);
        }
        tasks.push(task);
        if (!makeMinimal) {
          edits.forEach(task.addEdit, task);
          return;
        }
        const makeGroupMoreMinimal = async (start2, end) => {
          const oldEdits = edits.slice(start2, end);
          const newEdits = await this._editorWorker.computeMoreMinimalEdits(ref.object.textEditorModel.uri, oldEdits.map((e) => e.textEdit), false);
          if (!newEdits) {
            oldEdits.forEach(task.addEdit, task);
          } else {
            newEdits.forEach((edit) => task.addEdit(new ResourceTextEdit(ref.object.textEditorModel.uri, edit, void 0, void 0)));
          }
        };
        let start = 0;
        let i = 0;
        for (; i < edits.length; i++) {
          if (edits[i].textEdit.insertAsSnippet || edits[i].metadata) {
            await makeGroupMoreMinimal(start, i);
            task.addEdit(edits[i]);
            start = i + 1;
          }
        }
        await makeGroupMoreMinimal(start, i);
      });
      promises.push(promise);
    }
    await Promise.all(promises);
    return tasks;
  }
  _validateTasks(tasks) {
    for (const task of tasks) {
      const result = task.validate();
      if (!result.canApply) {
        return result;
      }
    }
    return { canApply: true };
  }
  async apply() {
    this._validateBeforePrepare();
    const tasks = await this._createEditsTasks();
    try {
      if (this._token.isCancellationRequested) {
        return [];
      }
      const resources = [];
      const validation = this._validateTasks(tasks);
      if (!validation.canApply) {
        throw new Error(`${validation.reason.toString()} has changed in the meantime`);
      }
      if (tasks.length === 1) {
        const task = tasks[0];
        if (!task.isNoOp()) {
          const singleModelEditStackElement = new SingleModelEditStackElement(this._label, this._code, task.model, task.getBeforeCursorState());
          this._undoRedoService.pushElement(singleModelEditStackElement, this._undoRedoGroup, this._undoRedoSource);
          task.apply();
          singleModelEditStackElement.close();
          resources.push(task.model.uri);
        }
        this._progress.report(void 0);
      } else {
        const multiModelEditStackElement = new MultiModelEditStackElement(
          this._label,
          this._code,
          tasks.map((t) => new SingleModelEditStackElement(this._label, this._code, t.model, t.getBeforeCursorState()))
        );
        this._undoRedoService.pushElement(multiModelEditStackElement, this._undoRedoGroup, this._undoRedoSource);
        for (const task of tasks) {
          task.apply();
          this._progress.report(void 0);
          resources.push(task.model.uri);
        }
        multiModelEditStackElement.close();
      }
      return resources;
    } finally {
      dispose(tasks);
    }
  }
};
BulkTextEdits = __decorateClass([
  __decorateParam(8, IEditorWorkerService),
  __decorateParam(9, IModelService),
  __decorateParam(10, ITextModelService),
  __decorateParam(11, IUndoRedoService)
], BulkTextEdits);
export {
  BulkTextEdits
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9idWxrRWRpdC9icm93c2VyL2J1bGtUZXh0RWRpdHMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBkaXNwb3NlLCBJRGlzcG9zYWJsZSwgSVJlZmVyZW5jZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IEVkaXRPcGVyYXRpb24sIElTaW5nbGVFZGl0T3BlcmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL2VkaXRPcGVyYXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBFbmRPZkxpbmVTZXF1ZW5jZSwgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbFNlcnZpY2UsIElSZXNvbHZlZFRleHRFZGl0b3JNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvcmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElQcm9ncmVzcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yV29ya2VyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvZWRpdG9yV29ya2VyLmpzJztcbmltcG9ydCB7IElVbmRvUmVkb1NlcnZpY2UsIFVuZG9SZWRvR3JvdXAsIFVuZG9SZWRvU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdW5kb1JlZG8vY29tbW9uL3VuZG9SZWRvLmpzJztcbmltcG9ydCB7IFNpbmdsZU1vZGVsRWRpdFN0YWNrRWxlbWVudCwgTXVsdGlNb2RlbEVkaXRTdGFja0VsZW1lbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsL2VkaXRTdGFjay5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZU1hcCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5pbXBvcnQgeyBJTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9tb2RlbC5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZVRleHRFZGl0IH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvc2VydmljZXMvYnVsa0VkaXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IFNuaXBwZXRDb250cm9sbGVyMiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL3NuaXBwZXQvYnJvd3Nlci9zbmlwcGV0Q29udHJvbGxlcjIuanMnO1xuaW1wb3J0IHsgU25pcHBldFBhcnNlciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL3NuaXBwZXQvYnJvd3Nlci9zbmlwcGV0UGFyc2VyLmpzJztcbmltcG9ydCB7IElTbmlwcGV0RWRpdCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL3NuaXBwZXQvYnJvd3Nlci9zbmlwcGV0U2Vzc2lvbi5qcyc7XG5cbnR5cGUgVmFsaWRhdGlvblJlc3VsdCA9IHsgY2FuQXBwbHk6IHRydWUgfSB8IHsgY2FuQXBwbHk6IGZhbHNlOyByZWFzb246IFVSSSB9O1xuXG50eXBlIElTaW5nbGVTbmlwcGV0RWRpdE9wZXJhdGlvbiA9IElTaW5nbGVFZGl0T3BlcmF0aW9uICYgeyBpbnNlcnRBc1NuaXBwZXQ/OiBib29sZWFuOyBrZWVwV2hpdGVzcGFjZT86IGJvb2xlYW4gfTtcblxuY2xhc3MgTW9kZWxFZGl0VGFzayBpbXBsZW1lbnRzIElEaXNwb3NhYmxlIHtcblxuXHRyZWFkb25seSBtb2RlbDogSVRleHRNb2RlbDtcblxuXHRwcml2YXRlIF9leHBlY3RlZE1vZGVsVmVyc2lvbklkOiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cdHByb3RlY3RlZCBfZWRpdHM6IElTaW5nbGVTbmlwcGV0RWRpdE9wZXJhdGlvbltdO1xuXHRwcm90ZWN0ZWQgX25ld0VvbDogRW5kT2ZMaW5lU2VxdWVuY2UgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBfbW9kZWxSZWZlcmVuY2U6IElSZWZlcmVuY2U8SVJlc29sdmVkVGV4dEVkaXRvck1vZGVsPikge1xuXHRcdHRoaXMubW9kZWwgPSB0aGlzLl9tb2RlbFJlZmVyZW5jZS5vYmplY3QudGV4dEVkaXRvck1vZGVsO1xuXHRcdHRoaXMuX2VkaXRzID0gW107XG5cdH1cblxuXHRkaXNwb3NlKCkge1xuXHRcdHRoaXMuX21vZGVsUmVmZXJlbmNlLmRpc3Bvc2UoKTtcblx0fVxuXG5cdGlzTm9PcCgpIHtcblx0XHRpZiAodGhpcy5fZWRpdHMubGVuZ3RoID4gMCkge1xuXHRcdFx0Ly8gY29udGFpbnMgdGV4dHVhbCBlZGl0c1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fbmV3RW9sICE9PSB1bmRlZmluZWQgJiYgdGhpcy5fbmV3RW9sICE9PSB0aGlzLm1vZGVsLmdldEVuZE9mTGluZVNlcXVlbmNlKCkpIHtcblx0XHRcdC8vIGNvbnRhaW5zIGFuIGVvbCBjaGFuZ2UgdGhhdCBpcyBhIHJlYWwgY2hhbmdlXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0YWRkRWRpdChyZXNvdXJjZUVkaXQ6IFJlc291cmNlVGV4dEVkaXQpOiB2b2lkIHtcblx0XHR0aGlzLl9leHBlY3RlZE1vZGVsVmVyc2lvbklkID0gcmVzb3VyY2VFZGl0LnZlcnNpb25JZDtcblx0XHRjb25zdCB7IHRleHRFZGl0IH0gPSByZXNvdXJjZUVkaXQ7XG5cblx0XHRpZiAodHlwZW9mIHRleHRFZGl0LmVvbCA9PT0gJ251bWJlcicpIHtcblx0XHRcdC8vIGhvbm9yIGVvbC1jaGFuZ2Vcblx0XHRcdHRoaXMuX25ld0VvbCA9IHRleHRFZGl0LmVvbDtcblx0XHR9XG5cdFx0aWYgKCF0ZXh0RWRpdC5yYW5nZSAmJiAhdGV4dEVkaXQudGV4dCkge1xuXHRcdFx0Ly8gbGFja3MgYm90aCBhIHJhbmdlIGFuZCB0aGUgdGV4dFxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoUmFuZ2UuaXNFbXB0eSh0ZXh0RWRpdC5yYW5nZSkgJiYgIXRleHRFZGl0LnRleHQpIHtcblx0XHRcdC8vIG5vLW9wIGVkaXQgKHJlcGxhY2UgZW1wdHkgcmFuZ2Ugd2l0aCBlbXB0eSB0ZXh0KVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIGNyZWF0ZSBlZGl0IG9wZXJhdGlvblxuXHRcdGxldCByYW5nZTogUmFuZ2U7XG5cdFx0aWYgKCF0ZXh0RWRpdC5yYW5nZSkge1xuXHRcdFx0cmFuZ2UgPSB0aGlzLm1vZGVsLmdldEZ1bGxNb2RlbFJhbmdlKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJhbmdlID0gUmFuZ2UubGlmdCh0ZXh0RWRpdC5yYW5nZSk7XG5cdFx0fVxuXHRcdHRoaXMuX2VkaXRzLnB1c2goeyAuLi5FZGl0T3BlcmF0aW9uLnJlcGxhY2VNb3ZlKHJhbmdlLCB0ZXh0RWRpdC50ZXh0KSwgaW5zZXJ0QXNTbmlwcGV0OiB0ZXh0RWRpdC5pbnNlcnRBc1NuaXBwZXQsIGtlZXBXaGl0ZXNwYWNlOiB0ZXh0RWRpdC5rZWVwV2hpdGVzcGFjZSB9KTtcblx0fVxuXG5cdHZhbGlkYXRlKCk6IFZhbGlkYXRpb25SZXN1bHQge1xuXHRcdGlmICh0eXBlb2YgdGhpcy5fZXhwZWN0ZWRNb2RlbFZlcnNpb25JZCA9PT0gJ3VuZGVmaW5lZCcgfHwgdGhpcy5tb2RlbC5nZXRWZXJzaW9uSWQoKSA9PT0gdGhpcy5fZXhwZWN0ZWRNb2RlbFZlcnNpb25JZCkge1xuXHRcdFx0cmV0dXJuIHsgY2FuQXBwbHk6IHRydWUgfTtcblx0XHR9XG5cdFx0cmV0dXJuIHsgY2FuQXBwbHk6IGZhbHNlLCByZWFzb246IHRoaXMubW9kZWwudXJpIH07XG5cdH1cblxuXHRnZXRCZWZvcmVDdXJzb3JTdGF0ZSgpOiBTZWxlY3Rpb25bXSB8IG51bGwge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0YXBwbHkoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2VkaXRzLmxlbmd0aCA+IDApIHtcblx0XHRcdHRoaXMuX2VkaXRzID0gdGhpcy5fZWRpdHNcblx0XHRcdFx0Lm1hcCh0aGlzLl90cmFuc2Zvcm1TbmlwcGV0U3RyaW5nVG9JbnNlcnRUZXh0LCB0aGlzKSAvLyBubyBlZGl0b3IgLT4gbm8gc25pcHBldCBtb2RlXG5cdFx0XHRcdC5zb3J0KChhLCBiKSA9PiBSYW5nZS5jb21wYXJlUmFuZ2VzVXNpbmdTdGFydHMoYS5yYW5nZSwgYi5yYW5nZSkpO1xuXHRcdFx0dGhpcy5tb2RlbC5wdXNoRWRpdE9wZXJhdGlvbnMobnVsbCwgdGhpcy5fZWRpdHMsICgpID0+IG51bGwpO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fbmV3RW9sICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMubW9kZWwucHVzaEVPTCh0aGlzLl9uZXdFb2wpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBfdHJhbnNmb3JtU25pcHBldFN0cmluZ1RvSW5zZXJ0VGV4dChlZGl0OiBJU2luZ2xlU25pcHBldEVkaXRPcGVyYXRpb24pOiBJU2luZ2xlU25pcHBldEVkaXRPcGVyYXRpb24ge1xuXHRcdC8vIHRyYW5zZm9ybSBhIHNuaXBwZXQgZWRpdCAoYW5kIG9ubHkgdGhvc2UpIGludG8gYSBub3JtYWwgdGV4dCBlZGl0XG5cdFx0Ly8gZm9yIHRoYXQgd2UgbmVlZCB0byBwYXJzZSB0aGUgc25pcHBldCBhbmQgZ2V0IGl0cyBhY3R1YWwgdGV4dCwgZS5nIHdpdGhvdXQgcGxhY2Vob2xkZXJcblx0XHQvLyBvciB2YXJpYWJsZSBzeW50YXhlc1xuXHRcdGlmICghZWRpdC5pbnNlcnRBc1NuaXBwZXQpIHtcblx0XHRcdHJldHVybiBlZGl0O1xuXHRcdH1cblx0XHRpZiAoIWVkaXQudGV4dCkge1xuXHRcdFx0cmV0dXJuIGVkaXQ7XG5cdFx0fVxuXHRcdGNvbnN0IHRleHQgPSBTbmlwcGV0UGFyc2VyLmFzSW5zZXJ0VGV4dChlZGl0LnRleHQpO1xuXHRcdHJldHVybiB7IC4uLmVkaXQsIGluc2VydEFzU25pcHBldDogZmFsc2UsIHRleHQgfTtcblx0fVxufVxuXG5jbGFzcyBFZGl0b3JFZGl0VGFzayBleHRlbmRzIE1vZGVsRWRpdFRhc2sge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcjogSUNvZGVFZGl0b3I7XG5cblx0Y29uc3RydWN0b3IobW9kZWxSZWZlcmVuY2U6IElSZWZlcmVuY2U8SVJlc29sdmVkVGV4dEVkaXRvck1vZGVsPiwgZWRpdG9yOiBJQ29kZUVkaXRvcikge1xuXHRcdHN1cGVyKG1vZGVsUmVmZXJlbmNlKTtcblx0XHR0aGlzLl9lZGl0b3IgPSBlZGl0b3I7XG5cdH1cblxuXHRvdmVycmlkZSBnZXRCZWZvcmVDdXJzb3JTdGF0ZSgpOiBTZWxlY3Rpb25bXSB8IG51bGwge1xuXHRcdHJldHVybiB0aGlzLl9jYW5Vc2VFZGl0b3IoKSA/IHRoaXMuX2VkaXRvci5nZXRTZWxlY3Rpb25zKCkgOiBudWxsO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXBwbHkoKTogdm9pZCB7XG5cblx0XHQvLyBDaGVjayB0aGF0IHRoZSBlZGl0b3IgaXMgc3RpbGwgZm9yIHRoZSB3YW50ZWQgbW9kZWwuIEl0IG1pZ2h0IGhhdmUgY2hhbmdlZCBpbiB0aGVcblx0XHQvLyBtZWFudGltZSBhbmQgdGhhdCBtZWFucyB3ZSBjYW5ub3QgdXNlIHRoZSBlZGl0b3IgYW55bW9yZSAoaW5zdGVhZCB3ZSBwZXJmb3JtIHRoZSBlZGl0IHRocm91Z2ggdGhlIG1vZGVsKVxuXHRcdGlmICghdGhpcy5fY2FuVXNlRWRpdG9yKCkpIHtcblx0XHRcdHN1cGVyLmFwcGx5KCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX2VkaXRzLmxlbmd0aCA+IDApIHtcblx0XHRcdGNvbnN0IHNuaXBwZXRDdHJsID0gU25pcHBldENvbnRyb2xsZXIyLmdldCh0aGlzLl9lZGl0b3IpO1xuXHRcdFx0aWYgKHNuaXBwZXRDdHJsICYmIHRoaXMuX2VkaXRzLnNvbWUoZWRpdCA9PiBlZGl0Lmluc2VydEFzU25pcHBldCkpIHtcblx0XHRcdFx0Ly8gc29tZSBlZGl0IGlzIGEgc25pcHBldCBlZGl0IC0+IHVzZSBzbmlwcGV0IGNvbnRyb2xsZXIgYW5kIElTbmlwcGV0RWRpdHNcblx0XHRcdFx0Y29uc3Qgc25pcHBldEVkaXRzOiBJU25pcHBldEVkaXRbXSA9IFtdO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGVkaXQgb2YgdGhpcy5fZWRpdHMpIHtcblx0XHRcdFx0XHRpZiAoZWRpdC5yYW5nZSAmJiBlZGl0LnRleHQgIT09IG51bGwpIHtcblx0XHRcdFx0XHRcdHNuaXBwZXRFZGl0cy5wdXNoKHtcblx0XHRcdFx0XHRcdFx0cmFuZ2U6IFJhbmdlLmxpZnQoZWRpdC5yYW5nZSksXG5cdFx0XHRcdFx0XHRcdHRlbXBsYXRlOiBlZGl0Lmluc2VydEFzU25pcHBldCA/IGVkaXQudGV4dCA6IFNuaXBwZXRQYXJzZXIuZXNjYXBlKGVkaXQudGV4dCksXG5cdFx0XHRcdFx0XHRcdGtlZXBXaGl0ZXNwYWNlOiBlZGl0LmtlZXBXaGl0ZXNwYWNlXG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0c25pcHBldEN0cmwuYXBwbHkoc25pcHBldEVkaXRzLCB7IHVuZG9TdG9wQmVmb3JlOiBmYWxzZSwgdW5kb1N0b3BBZnRlcjogZmFsc2UgfSk7XG5cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIG5vcm1hbCBlZGl0XG5cdFx0XHRcdHRoaXMuX2VkaXRzID0gdGhpcy5fZWRpdHNcblx0XHRcdFx0XHQubWFwKHRoaXMuX3RyYW5zZm9ybVNuaXBwZXRTdHJpbmdUb0luc2VydFRleHQsIHRoaXMpIC8vIG1peGVkIGVkaXRzIChzbmlwcGV0IGFuZCBub3JtYWwpIC0+IG5vIHNuaXBwZXQgbW9kZVxuXHRcdFx0XHRcdC5zb3J0KChhLCBiKSA9PiBSYW5nZS5jb21wYXJlUmFuZ2VzVXNpbmdTdGFydHMoYS5yYW5nZSwgYi5yYW5nZSkpO1xuXHRcdFx0XHR0aGlzLl9lZGl0b3IuZXhlY3V0ZUVkaXRzKCcnLCB0aGlzLl9lZGl0cyk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9uZXdFb2wgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0aWYgKHRoaXMuX2VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRcdHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpLnB1c2hFT0wodGhpcy5fbmV3RW9sKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9jYW5Vc2VFZGl0b3IoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2VkaXRvcj8uZ2V0TW9kZWwoKT8udXJpLnRvU3RyaW5nKCkgPT09IHRoaXMubW9kZWwudXJpLnRvU3RyaW5nKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEJ1bGtUZXh0RWRpdHMge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRzID0gbmV3IFJlc291cmNlTWFwPFJlc291cmNlVGV4dEVkaXRbXT4oKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9sYWJlbDogc3RyaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2NvZGU6IHN0cmluZyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3I6IElDb2RlRWRpdG9yIHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3VuZG9SZWRvR3JvdXA6IFVuZG9SZWRvR3JvdXAsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfdW5kb1JlZG9Tb3VyY2U6IFVuZG9SZWRvU291cmNlIHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb2dyZXNzOiBJUHJvZ3Jlc3M8dm9pZD4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfdG9rZW46IENhbmNlbGxhdGlvblRva2VuLFxuXHRcdGVkaXRzOiBSZXNvdXJjZVRleHRFZGl0W10sXG5cdFx0QElFZGl0b3JXb3JrZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcldvcmtlcjogSUVkaXRvcldvcmtlclNlcnZpY2UsXG5cdFx0QElNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlLFxuXHRcdEBJVGV4dE1vZGVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZXh0TW9kZWxSZXNvbHZlclNlcnZpY2U6IElUZXh0TW9kZWxTZXJ2aWNlLFxuXHRcdEBJVW5kb1JlZG9TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3VuZG9SZWRvU2VydmljZTogSVVuZG9SZWRvU2VydmljZVxuXHQpIHtcblxuXHRcdGZvciAoY29uc3QgZWRpdCBvZiBlZGl0cykge1xuXHRcdFx0bGV0IGFycmF5ID0gdGhpcy5fZWRpdHMuZ2V0KGVkaXQucmVzb3VyY2UpO1xuXHRcdFx0aWYgKCFhcnJheSkge1xuXHRcdFx0XHRhcnJheSA9IFtdO1xuXHRcdFx0XHR0aGlzLl9lZGl0cy5zZXQoZWRpdC5yZXNvdXJjZSwgYXJyYXkpO1xuXHRcdFx0fVxuXHRcdFx0YXJyYXkucHVzaChlZGl0KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF92YWxpZGF0ZUJlZm9yZVByZXBhcmUoKTogdm9pZCB7XG5cdFx0Ly8gRmlyc3QgY2hlY2sgaWYgbG9hZGVkIG1vZGVscyB3ZXJlIG5vdCBjaGFuZ2VkIGluIHRoZSBtZWFudGltZVxuXHRcdGZvciAoY29uc3QgYXJyYXkgb2YgdGhpcy5fZWRpdHMudmFsdWVzKCkpIHtcblx0XHRcdGZvciAoY29uc3QgZWRpdCBvZiBhcnJheSkge1xuXHRcdFx0XHRpZiAodHlwZW9mIGVkaXQudmVyc2lvbklkID09PSAnbnVtYmVyJykge1xuXHRcdFx0XHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fbW9kZWxTZXJ2aWNlLmdldE1vZGVsKGVkaXQucmVzb3VyY2UpO1xuXHRcdFx0XHRcdGlmIChtb2RlbCAmJiBtb2RlbC5nZXRWZXJzaW9uSWQoKSAhPT0gZWRpdC52ZXJzaW9uSWQpIHtcblx0XHRcdFx0XHRcdC8vIG1vZGVsIGNoYW5nZWQgaW4gdGhlIG1lYW50aW1lXG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYCR7bW9kZWwudXJpLnRvU3RyaW5nKCl9IGhhcyBjaGFuZ2VkIGluIHRoZSBtZWFudGltZWApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2NyZWF0ZUVkaXRzVGFza3MoKTogUHJvbWlzZTxNb2RlbEVkaXRUYXNrW10+IHtcblxuXHRcdGNvbnN0IHRhc2tzOiBNb2RlbEVkaXRUYXNrW10gPSBbXTtcblx0XHRjb25zdCBwcm9taXNlczogUHJvbWlzZTxhbnk+W10gPSBbXTtcblxuXHRcdGZvciAoY29uc3QgW2tleSwgZWRpdHNdIG9mIHRoaXMuX2VkaXRzKSB7XG5cdFx0XHRjb25zdCBwcm9taXNlID0gdGhpcy5fdGV4dE1vZGVsUmVzb2x2ZXJTZXJ2aWNlLmNyZWF0ZU1vZGVsUmVmZXJlbmNlKGtleSkudGhlbihhc3luYyByZWYgPT4ge1xuXHRcdFx0XHRsZXQgdGFzazogTW9kZWxFZGl0VGFzaztcblx0XHRcdFx0bGV0IG1ha2VNaW5pbWFsID0gZmFsc2U7XG5cdFx0XHRcdGlmICh0aGlzLl9lZGl0b3I/LmdldE1vZGVsKCk/LnVyaS50b1N0cmluZygpID09PSByZWYub2JqZWN0LnRleHRFZGl0b3JNb2RlbC51cmkudG9TdHJpbmcoKSkge1xuXHRcdFx0XHRcdHRhc2sgPSBuZXcgRWRpdG9yRWRpdFRhc2socmVmLCB0aGlzLl9lZGl0b3IpO1xuXHRcdFx0XHRcdG1ha2VNaW5pbWFsID0gdHJ1ZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0YXNrID0gbmV3IE1vZGVsRWRpdFRhc2socmVmKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0YXNrcy5wdXNoKHRhc2spO1xuXG5cblx0XHRcdFx0aWYgKCFtYWtlTWluaW1hbCkge1xuXHRcdFx0XHRcdGVkaXRzLmZvckVhY2godGFzay5hZGRFZGl0LCB0YXNrKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBncm91cCBlZGl0cyBieSB0eXBlIChzbmlwcGV0LCBtZXRhZGF0YSwgb3Igc2ltcGxlKSBhbmQgbWFrZSBzaW1wbGUgZ3JvdXBzIG1vcmUgbWluaW1hbFxuXG5cdFx0XHRcdGNvbnN0IG1ha2VHcm91cE1vcmVNaW5pbWFsID0gYXN5bmMgKHN0YXJ0OiBudW1iZXIsIGVuZDogbnVtYmVyKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3Qgb2xkRWRpdHMgPSBlZGl0cy5zbGljZShzdGFydCwgZW5kKTtcblx0XHRcdFx0XHRjb25zdCBuZXdFZGl0cyA9IGF3YWl0IHRoaXMuX2VkaXRvcldvcmtlci5jb21wdXRlTW9yZU1pbmltYWxFZGl0cyhyZWYub2JqZWN0LnRleHRFZGl0b3JNb2RlbC51cmksIG9sZEVkaXRzLm1hcChlID0+IGUudGV4dEVkaXQpLCBmYWxzZSk7XG5cdFx0XHRcdFx0aWYgKCFuZXdFZGl0cykge1xuXHRcdFx0XHRcdFx0b2xkRWRpdHMuZm9yRWFjaCh0YXNrLmFkZEVkaXQsIHRhc2spO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRuZXdFZGl0cy5mb3JFYWNoKGVkaXQgPT4gdGFzay5hZGRFZGl0KG5ldyBSZXNvdXJjZVRleHRFZGl0KHJlZi5vYmplY3QudGV4dEVkaXRvck1vZGVsLnVyaSwgZWRpdCwgdW5kZWZpbmVkLCB1bmRlZmluZWQpKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9O1xuXG5cdFx0XHRcdGxldCBzdGFydCA9IDA7XG5cdFx0XHRcdGxldCBpID0gMDtcblx0XHRcdFx0Zm9yICg7IGkgPCBlZGl0cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdGlmIChlZGl0c1tpXS50ZXh0RWRpdC5pbnNlcnRBc1NuaXBwZXQgfHwgZWRpdHNbaV0ubWV0YWRhdGEpIHtcblx0XHRcdFx0XHRcdGF3YWl0IG1ha2VHcm91cE1vcmVNaW5pbWFsKHN0YXJ0LCBpKTsgLy8gZ3JvdXBlZCBlZGl0cyB1bnRpbCBub3dcblx0XHRcdFx0XHRcdHRhc2suYWRkRWRpdChlZGl0c1tpXSk7IC8vIHRoaXMgZWRpdFxuXHRcdFx0XHRcdFx0c3RhcnQgPSBpICsgMTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0YXdhaXQgbWFrZUdyb3VwTW9yZU1pbmltYWwoc3RhcnQsIGkpO1xuXG5cdFx0XHR9KTtcblx0XHRcdHByb21pc2VzLnB1c2gocHJvbWlzZSk7XG5cdFx0fVxuXG5cdFx0YXdhaXQgUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xuXHRcdHJldHVybiB0YXNrcztcblx0fVxuXG5cdHByaXZhdGUgX3ZhbGlkYXRlVGFza3ModGFza3M6IE1vZGVsRWRpdFRhc2tbXSk6IFZhbGlkYXRpb25SZXN1bHQge1xuXHRcdGZvciAoY29uc3QgdGFzayBvZiB0YXNrcykge1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gdGFzay52YWxpZGF0ZSgpO1xuXHRcdFx0aWYgKCFyZXN1bHQuY2FuQXBwbHkpIHtcblx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHsgY2FuQXBwbHk6IHRydWUgfTtcblx0fVxuXG5cdGFzeW5jIGFwcGx5KCk6IFByb21pc2U8cmVhZG9ubHkgVVJJW10+IHtcblxuXHRcdHRoaXMuX3ZhbGlkYXRlQmVmb3JlUHJlcGFyZSgpO1xuXHRcdGNvbnN0IHRhc2tzID0gYXdhaXQgdGhpcy5fY3JlYXRlRWRpdHNUYXNrcygpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGlmICh0aGlzLl90b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRyZXR1cm4gW107XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHJlc291cmNlczogVVJJW10gPSBbXTtcblx0XHRcdGNvbnN0IHZhbGlkYXRpb24gPSB0aGlzLl92YWxpZGF0ZVRhc2tzKHRhc2tzKTtcblx0XHRcdGlmICghdmFsaWRhdGlvbi5jYW5BcHBseSkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYCR7dmFsaWRhdGlvbi5yZWFzb24udG9TdHJpbmcoKX0gaGFzIGNoYW5nZWQgaW4gdGhlIG1lYW50aW1lYCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAodGFza3MubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdC8vIFRoaXMgZWRpdCB0b3VjaGVzIGEgc2luZ2xlIG1vZGVsID0+IGtlZXAgdGhpbmdzIHNpbXBsZVxuXHRcdFx0XHRjb25zdCB0YXNrID0gdGFza3NbMF07XG5cdFx0XHRcdGlmICghdGFzay5pc05vT3AoKSkge1xuXHRcdFx0XHRcdGNvbnN0IHNpbmdsZU1vZGVsRWRpdFN0YWNrRWxlbWVudCA9IG5ldyBTaW5nbGVNb2RlbEVkaXRTdGFja0VsZW1lbnQodGhpcy5fbGFiZWwsIHRoaXMuX2NvZGUsIHRhc2subW9kZWwsIHRhc2suZ2V0QmVmb3JlQ3Vyc29yU3RhdGUoKSk7XG5cdFx0XHRcdFx0dGhpcy5fdW5kb1JlZG9TZXJ2aWNlLnB1c2hFbGVtZW50KHNpbmdsZU1vZGVsRWRpdFN0YWNrRWxlbWVudCwgdGhpcy5fdW5kb1JlZG9Hcm91cCwgdGhpcy5fdW5kb1JlZG9Tb3VyY2UpO1xuXHRcdFx0XHRcdHRhc2suYXBwbHkoKTtcblx0XHRcdFx0XHRzaW5nbGVNb2RlbEVkaXRTdGFja0VsZW1lbnQuY2xvc2UoKTtcblx0XHRcdFx0XHRyZXNvdXJjZXMucHVzaCh0YXNrLm1vZGVsLnVyaSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5fcHJvZ3Jlc3MucmVwb3J0KHVuZGVmaW5lZCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBwcmVwYXJlIG11bHRpIG1vZGVsIHVuZG8gZWxlbWVudFxuXHRcdFx0XHRjb25zdCBtdWx0aU1vZGVsRWRpdFN0YWNrRWxlbWVudCA9IG5ldyBNdWx0aU1vZGVsRWRpdFN0YWNrRWxlbWVudChcblx0XHRcdFx0XHR0aGlzLl9sYWJlbCxcblx0XHRcdFx0XHR0aGlzLl9jb2RlLFxuXHRcdFx0XHRcdHRhc2tzLm1hcCh0ID0+IG5ldyBTaW5nbGVNb2RlbEVkaXRTdGFja0VsZW1lbnQodGhpcy5fbGFiZWwsIHRoaXMuX2NvZGUsIHQubW9kZWwsIHQuZ2V0QmVmb3JlQ3Vyc29yU3RhdGUoKSkpXG5cdFx0XHRcdCk7XG5cdFx0XHRcdHRoaXMuX3VuZG9SZWRvU2VydmljZS5wdXNoRWxlbWVudChtdWx0aU1vZGVsRWRpdFN0YWNrRWxlbWVudCwgdGhpcy5fdW5kb1JlZG9Hcm91cCwgdGhpcy5fdW5kb1JlZG9Tb3VyY2UpO1xuXHRcdFx0XHRmb3IgKGNvbnN0IHRhc2sgb2YgdGFza3MpIHtcblx0XHRcdFx0XHR0YXNrLmFwcGx5KCk7XG5cdFx0XHRcdFx0dGhpcy5fcHJvZ3Jlc3MucmVwb3J0KHVuZGVmaW5lZCk7XG5cdFx0XHRcdFx0cmVzb3VyY2VzLnB1c2godGFzay5tb2RlbC51cmkpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdG11bHRpTW9kZWxFZGl0U3RhY2tFbGVtZW50LmNsb3NlKCk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiByZXNvdXJjZXM7XG5cblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0ZGlzcG9zZSh0YXNrcyk7XG5cdFx0fVxuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZUFBd0M7QUFHakQsU0FBUyxxQkFBMkM7QUFDcEQsU0FBUyxhQUFhO0FBR3RCLFNBQVMseUJBQW1EO0FBRTVELFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsd0JBQXVEO0FBQ2hFLFNBQVMsNkJBQTZCLGtDQUFrQztBQUN4RSxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHdCQUF3QjtBQUVqQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHFCQUFxQjtBQU85QixNQUFNLGNBQXFDO0FBQUEsRUFRMUMsWUFBNkIsaUJBQXVEO0FBQXZEO0FBQzVCLFNBQUssUUFBUSxLQUFLLGdCQUFnQixPQUFPO0FBQ3pDLFNBQUssU0FBUyxDQUFDO0FBQUEsRUFDaEI7QUFBQSxFQUVBLFVBQVU7QUFDVCxTQUFLLGdCQUFnQixRQUFRO0FBQUEsRUFDOUI7QUFBQSxFQUVBLFNBQVM7QUFDUixRQUFJLEtBQUssT0FBTyxTQUFTLEdBQUc7QUFFM0IsYUFBTztBQUFBLElBQ1I7QUFDQSxRQUFJLEtBQUssWUFBWSxVQUFh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
