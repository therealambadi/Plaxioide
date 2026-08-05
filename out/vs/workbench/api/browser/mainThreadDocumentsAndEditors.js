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
import { Event } from "../../../base/common/event.js";
import { combinedDisposable, DisposableStore, DisposableMap } from "../../../base/common/lifecycle.js";
import { isCodeEditor, isDiffEditor } from "../../../editor/browser/editorBrowser.js";
import { ICodeEditorService } from "../../../editor/browser/services/codeEditorService.js";
import { shouldSynchronizeModel } from "../../../editor/common/model.js";
import { IModelService } from "../../../editor/common/services/model.js";
import { ITextModelService } from "../../../editor/common/services/resolverService.js";
import { IFileService } from "../../../platform/files/common/files.js";
import { extHostCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { MainThreadDocuments } from "./mainThreadDocuments.js";
import { MainThreadTextEditor } from "./mainThreadEditor.js";
import { MainThreadTextEditors } from "./mainThreadEditors.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { AbstractTextEditor } from "../../browser/parts/editor/textEditor.js";
import { editorGroupToColumn } from "../../services/editor/common/editorGroupColumn.js";
import { IEditorService } from "../../services/editor/common/editorService.js";
import { IEditorGroupsService } from "../../services/editor/common/editorGroupsService.js";
import { ITextFileService } from "../../services/textfile/common/textfiles.js";
import { IWorkbenchEnvironmentService } from "../../services/environment/common/environmentService.js";
import { IWorkingCopyFileService } from "../../services/workingCopy/common/workingCopyFileService.js";
import { IUriIdentityService } from "../../../platform/uriIdentity/common/uriIdentity.js";
import { IClipboardService } from "../../../platform/clipboard/common/clipboardService.js";
import { IPathService } from "../../services/path/common/pathService.js";
import { diffSets, diffMaps } from "../../../base/common/collections.js";
import { IPaneCompositePartService } from "../../services/panecomposite/browser/panecomposite.js";
import { ViewContainerLocation } from "../../common/views.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { IQuickDiffModelService } from "../../contrib/scm/browser/quickDiffModel.js";
class TextEditorSnapshot {
  constructor(editor) {
    this.editor = editor;
    this.id = `${editor.getId()},${editor.getModel().id}`;
  }
}
class DocumentAndEditorStateDelta {
  constructor(removedDocuments, addedDocuments, removedEditors, addedEditors, oldActiveEditor, newActiveEditor) {
    this.removedDocuments = removedDocuments;
    this.addedDocuments = addedDocuments;
    this.removedEditors = removedEditors;
    this.addedEditors = addedEditors;
    this.oldActiveEditor = oldActiveEditor;
    this.newActiveEditor = newActiveEditor;
    this.isEmpty = this.removedDocuments.length === 0 && this.addedDocuments.length === 0 && this.removedEditors.length === 0 && this.addedEditors.length === 0 && oldActiveEditor === newActiveEditor;
  }
  toString() {
    let ret = "DocumentAndEditorStateDelta\n";
    ret += `	Removed Documents: [${this.removedDocuments.map((d) => d.uri.toString(true)).join(", ")}]
`;
    ret += `	Added Documents: [${this.addedDocuments.map((d) => d.uri.toString(true)).join(", ")}]
`;
    ret += `	Removed Editors: [${this.removedEditors.map((e) => e.id).join(", ")}]
`;
    ret += `	Added Editors: [${this.addedEditors.map((e) => e.id).join(", ")}]
`;
    ret += `	New Active Editor: ${this.newActiveEditor}
`;
    return ret;
  }
}
class DocumentAndEditorState {
  constructor(documents, textEditors, activeEditor) {
    this.documents = documents;
    this.textEditors = textEditors;
    this.activeEditor = activeEditor;
  }
  static compute(before, after) {
    if (!before) {
      return new DocumentAndEditorStateDelta(
        [],
        [...after.documents.values()],
        [],
        [...after.textEditors.values()],
        void 0,
        after.activeEditor
      );
    }
    const documentDelta = diffSets(before.documents, after.documents);
    const editorDelta = diffMaps(before.textEditors, after.textEditors);
    const oldActiveEditor = before.activeEditor !== after.activeEditor ? before.activeEditor : void 0;
    const newActiveEditor = before.activeEditor !== after.activeEditor ? after.activeEditor : void 0;
    return new DocumentAndEditorStateDelta(
      documentDelta.removed,
      documentDelta.added,
      editorDelta.removed,
      editorDelta.added,
      oldActiveEditor,
      newActiveEditor
    );
  }
}
var ActiveEditorOrder = /* @__PURE__ */ ((ActiveEditorOrder2) => {
  ActiveEditorOrder2[ActiveEditorOrder2["Editor"] = 0] = "Editor";
  ActiveEditorOrder2[ActiveEditorOrder2["Panel"] = 1] = "Panel";
  return ActiveEditorOrder2;
})(ActiveEditorOrder || {});
let MainThreadDocumentAndEditorStateComputer = class {
  constructor(_onDidChangeState, _modelService, _codeEditorService, _editorService, _paneCompositeService) {
    this._onDidChangeState = _onDidChangeState;
    this._modelService = _modelService;
    this._codeEditorService = _codeEditorService;
    this._editorService = _editorService;
    this._paneCompositeService = _paneCompositeService;
    this._toDispose = new DisposableStore();
    this._toDisposeOnEditorRemove = new DisposableMap();
    this._activeEditorOrder = 0 /* Editor */;
    this._modelService.onModelAdded(this._updateStateOnModelAdd, this, this._toDispose);
    this._modelService.onModelRemoved((_) => this._updateState(), this, this._toDispose);
    this._editorService.onDidActiveEditorChange((_) => this._updateState(), this, this._toDispose);
    this._codeEditorService.onCodeEditorAdd(this._onDidAddEditor, this, this._toDispose);
    this._codeEditorService.onCodeEditorRemove(this._onDidRemoveEditor, this, this._toDispose);
    this._codeEditorService.listCodeEditors().forEach(this._onDidAddEditor, this);
    Event.filter(this._paneCompositeService.onDidPaneCompositeOpen, (event) => event.viewContainerLocation === ViewContainerLocation.Panel)((_) => this._activeEditorOrder = 1 /* Panel */, void 0, this._toDispose);
    Event.filter(this._paneCompositeService.onDidPaneCompositeClose, (event) => event.viewContainerLocation === ViewContainerLocation.Panel)((_) => this._activeEditorOrder = 0 /* Editor */, void 0, this._toDispose);
    this._editorService.onDidVisibleEditorsChange((_) => this._activeEditorOrder = 0 /* Editor */, void 0, this._toDispose);
    this._updateState();
  }
  dispose() {
    this._toDispose.dispose();
    this._toDisposeOnEditorRemove.dispose();
  }
  _onDidAddEditor(e) {
    this._toDisposeOnEditorRemove.set(e.getId(), combinedDisposable(
      e.onDidChangeModel(() => this._updateState()),
      e.onDidFocusEditorText(() => this._updateState()),
      e.onDidFocusEditorWidget(() => this._updateState(e))
    ));
    this._updateState();
  }
  _onDidRemoveEditor(e) {
    const id = e.getId();
    if (this._toDisposeOnEditorRemove.has(id)) {
      this._toDisposeOnEditorRemove.deleteAndDispose(id);
      this._updateState();
    }
  }
  _updateStateOnModelAdd(model) {
    if (!shouldSynchronizeModel(model)) {
      return;
    }
    if (!this._currentState) {
      this._updateState();
      return;
    }
    this._currentState = new DocumentAndEditorState(
      this._currentState.documents.add(model),
      this._currentState.textEditors,
      this._currentState.activeEditor
    );
    this._onDidChangeState(new DocumentAndEditorStateDelta(
      [],
      [model],
      [],
      [],
      void 0,
      void 0
    ));
  }
  _updateState(widgetFocusCandidate) {
    const models = /* @__PURE__ */ new Set();
    for (const model of this._modelService.getModels()) {
      if (shouldSynchronizeModel(model)) {
        models.add(model);
      }
    }
    const editors = /* @__PURE__ */ new Map();
    let activeEditor = null;
    for (const editor of this._codeEditorService.listCodeEditors()) {
      if (editor.isSimpleWidget) {
        continue;
      }
      const model = editor.getModel();
      if (editor.hasModel() && model && shouldSynchronizeModel(model) && !model.isDisposed() && Boolean(this._modelService.getModel(model.uri))) {
        const apiEditor = new TextEditorSnapshot(editor);
        editors.set(apiEditor.id, apiEditor);
        if (editor.hasTextFocus() || widgetFocusCandidate === editor && editor.hasWidgetFocus()) {
          activeEditor = apiEditor.id;
        }
      }
    }
    if (!activeEditor) {
      let candidate;
      if (this._activeEditorOrder === 0 /* Editor */) {
        candidate = this._getActiveEditorFromEditorPart() || this._getActiveEditorFromPanel();
      } else {
        candidate = this._getActiveEditorFromPanel() || this._getActiveEditorFromEditorPart();
      }
      if (candidate) {
        for (const snapshot of editors.values()) {
          if (candidate === snapshot.editor) {
            activeEditor = snapshot.id;
          }
        }
      }
    }
    const newState = new DocumentAndEditorState(models, editors, activeEditor);
    const delta = DocumentAndEditorState.compute(this._currentState, newState);
    if (!delta.isEmpty) {
      this._currentState = newState;
      this._onDidChangeState(delta);
    }
  }
  _getActiveEditorFromPanel() {
    const panel = this._paneCompositeService.getActivePaneComposite(ViewContainerLocation.Panel);
    if (panel instanceof AbstractTextEditor) {
      const control = panel.getControl();
      if (isCodeEditor(control)) {
        return control;
      }
    }
    return void 0;
  }
  _getActiveEditorFromEditorPart() {
    let activeTextEditorControl = this._editorService.activeTextEditorControl;
    if (isDiffEditor(activeTextEditorControl)) {
      activeTextEditorControl = activeTextEditorControl.getModifiedEditor();
    }
    return activeTextEditorControl;
  }
};
MainThreadDocumentAndEditorStateComputer = __decorateClass([
  __decorateParam(1, IModelService),
  __decorateParam(2, ICodeEditorService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IPaneCompositePartService)
], MainThreadDocumentAndEditorStateComputer);
let MainThreadDocumentsAndEditors = class {
  constructor(extHostContext, _modelService, _textFileService, _editorService, codeEditorService, fileService, textModelResolverService, _editorGroupService, paneCompositeService, environmentService, workingCopyFileService, uriIdentityService, _clipboardService, pathService, configurationService, quickDiffModelService) {
    this._modelService = _modelService;
    this._textFileService = _textFileService;
    this._editorService = _editorService;
    this._editorGroupService = _editorGroupService;
    this._clipboardService = _clipboardService;
    this._toDispose = new DisposableStore();
    this._textEditors = /* @__PURE__ */ new Map();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostDocumentsAndEditors);
    this._mainThreadDocuments = this._toDispose.add(new MainThreadDocuments(extHostContext, this._modelService, this._textFileService, fileService, textModelResolverService, environmentService, uriIdentityService, workingCopyFileService, pathService));
    extHostContext.set(MainContext.MainThreadDocuments, this._mainThreadDocuments);
    this._mainThreadEditors = this._toDispose.add(new MainThreadTextEditors(this, extHostContext, codeEditorService, this._editorService, this._editorGroupService, configurationService, quickDiffModelService, uriIdentityService));
    extHostContext.set(MainContext.MainThreadTextEditors, this._mainThreadEditors);
    this._toDispose.add(new MainThreadDocumentAndEditorStateComputer((delta) => this._onDelta(delta), _modelService, codeEditorService, this._editorService, paneCompositeService));
  }
  dispose() {
    this._toDispose.dispose();
  }
  _onDelta(delta) {
    const removedEditors = [];
    const addedEditors = [];
    const removedDocuments = delta.removedDocuments.map((m) => m.uri);
    for (const apiEditor of delta.addedEditors) {
      const mainThreadEditor = new MainThreadTextEditor(
        apiEditor.id,
        apiEditor.editor.getModel(),
        apiEditor.editor,
        { onGainedFocus() {
        }, onLostFocus() {
        } },
        this._mainThreadDocuments,
        this._modelService,
        this._clipboardService
      );
      this._textEditors.set(apiEditor.id, mainThreadEditor);
      addedEditors.push(mainThreadEditor);
    }
    for (const { id } of delta.removedEditors) {
      const mainThreadEditor = this._textEditors.get(id);
      if (mainThreadEditor) {
        mainThreadEditor.dispose();
        this._textEditors.delete(id);
        removedEditors.push(id);
      }
    }
    const extHostDelta = /* @__PURE__ */ Object.create(null);
    let empty = true;
    if (delta.newActiveEditor !== void 0) {
      empty = false;
      extHostDelta.newActiveEditor = delta.newActiveEditor;
    }
    if (removedDocuments.length > 0) {
      empty = false;
      extHostDelta.removedDocuments = removedDocuments;
    }
    if (removedEditors.length > 0) {
      empty = false;
      extHostDelta.removedEditors = removedEditors;
    }
    if (delta.addedDocuments.length > 0) {
      empty = false;
      extHostDelta.addedDocuments = delta.addedDocuments.map((m) => this._toModelAddData(m));
    }
    if (delta.addedEditors.length > 0) {
      empty = false;
      extHostDelta.addedEditors = addedEditors.map((e) => this._toTextEditorAddData(e));
    }
    if (!empty) {
      this._proxy.$acceptDocumentsAndEditorsDelta(extHostDelta);
      removedDocuments.forEach(this._mainThreadDocuments.handleModelRemoved, this._mainThreadDocuments);
      delta.addedDocuments.forEach(this._mainThreadDocuments.handleModelAdded, this._mainThreadDocuments);
      removedEditors.forEach(this._mainThreadEditors.handleTextEditorRemoved, this._mainThreadEditors);
      addedEditors.forEach(this._mainThreadEditors.handleTextEditorAdded, this._mainThreadEditors);
    }
  }
  _toModelAddData(model) {
    return {
      uri: model.uri,
      versionId: model.getVersionId(),
      lines: model.getLinesContent(),
      EOL: model.getEOL(),
      languageId: model.getLanguageId(),
      isDirty: this._textFileService.isDirty(model.uri),
      encoding: this._textFileService.getEncoding(model.uri)
    };
  }
  _toTextEditorAddData(textEditor) {
    const props = textEditor.getProperties();
    return {
      id: textEditor.getId(),
      documentUri: textEditor.getModel().uri,
      options: props.options,
      selections: props.selections,
      visibleRanges: props.visibleRanges,
      editorPosition: this._findEditorPosition(textEditor)
    };
  }
  _findEditorPosition(editor) {
    for (const editorPane of this._editorService.visibleEditorPanes) {
      if (editor.matches(editorPane)) {
        return editorGroupToColumn(this._editorGroupService, editorPane.group);
      }
    }
    return void 0;
  }
  findTextEditorIdFor(editorPane) {
    for (const [id, editor] of this._textEditors) {
      if (editor.matches(editorPane)) {
        return id;
      }
    }
    return void 0;
  }
  getIdOfCodeEditor(codeEditor) {
    for (const [id, editor] of this._textEditors) {
      if (editor.getCodeEditor() === codeEditor) {
        return id;
      }
    }
    return void 0;
  }
  getEditor(id) {
    return this._textEditors.get(id);
  }
};
MainThreadDocumentsAndEditors = __decorateClass([
  extHostCustomer,
  __decorateParam(1, IModelService),
  __decorateParam(2, ITextFileService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, ICodeEditorService),
  __decorateParam(5, IFileService),
  __decorateParam(6, ITextModelService),
  __decorateParam(7, IEditorGroupsService),
  __decorateParam(8, IPaneCompositePartService),
  __decorateParam(9, IWorkbenchEnvironmentService),
  __decorateParam(10, IWorkingCopyFileService),
  __decorateParam(11, IUriIdentityService),
  __decorateParam(12, IClipboardService),
  __decorateParam(13, IPathService),
  __decorateParam(14, IConfigurationService),
  __decorateParam(15, IQuickDiffModelService)
], MainThreadDocumentsAndEditors);
export {
  MainThreadDocumentsAndEditors
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZERvY3VtZW50c0FuZEVkaXRvcnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IGNvbWJpbmVkRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBEaXNwb3NhYmxlTWFwIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yLCBpc0NvZGVFZGl0b3IsIGlzRGlmZkVkaXRvciwgSUFjdGl2ZUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3NlcnZpY2VzL2NvZGVFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsLCBzaG91bGRTeW5jaHJvbml6ZU1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvcmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBleHRIb3N0Q3VzdG9tZXIsIElFeHRIb3N0Q29udGV4dCB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dEhvc3RDdXN0b21lcnMuanMnO1xuaW1wb3J0IHsgTWFpblRocmVhZERvY3VtZW50cyB9IGZyb20gJy4vbWFpblRocmVhZERvY3VtZW50cy5qcyc7XG5pbXBvcnQgeyBNYWluVGhyZWFkVGV4dEVkaXRvciB9IGZyb20gJy4vbWFpblRocmVhZEVkaXRvci5qcyc7XG5pbXBvcnQgeyBNYWluVGhyZWFkVGV4dEVkaXRvcnMgfSBmcm9tICcuL21haW5UaHJlYWRFZGl0b3JzLmpzJztcbmltcG9ydCB7IEV4dEhvc3RDb250ZXh0LCBFeHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9yc1NoYXBlLCBJRG9jdW1lbnRzQW5kRWRpdG9yc0RlbHRhLCBJTW9kZWxBZGRlZERhdGEsIElUZXh0RWRpdG9yQWRkRGF0YSwgTWFpbkNvbnRleHQgfSBmcm9tICcuLi9jb21tb24vZXh0SG9zdC5wcm90b2NvbC5qcyc7XG5pbXBvcnQgeyBBYnN0cmFjdFRleHRFZGl0b3IgfSBmcm9tICcuLi8uLi9icm93c2VyL3BhcnRzL2VkaXRvci90ZXh0RWRpdG9yLmpzJztcbmltcG9ydCB7IElFZGl0b3JQYW5lIH0gZnJvbSAnLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JHcm91cENvbHVtbiwgZWRpdG9yR3JvdXBUb0NvbHVtbiB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBDb2x1bW4uanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvckdyb3Vwc1NlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvckdyb3Vwc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVRleHRGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL3RleHRmaWxlL2NvbW1vbi90ZXh0ZmlsZXMuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVdvcmtpbmdDb3B5RmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy93b3JraW5nQ29weS9jb21tb24vd29ya2luZ0NvcHlGaWxlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IElDbGlwYm9hcmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vY2xpcGJvYXJkL2NvbW1vbi9jbGlwYm9hcmRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElQYXRoU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL3BhdGgvY29tbW9uL3BhdGhTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGRpZmZTZXRzLCBkaWZmTWFwcyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbGxlY3Rpb25zLmpzJztcbmltcG9ydCB7IElQYW5lQ29tcG9zaXRlUGFydFNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9wYW5lY29tcG9zaXRlL2Jyb3dzZXIvcGFuZWNvbXBvc2l0ZS5qcyc7XG5pbXBvcnQgeyBWaWV3Q29udGFpbmVyTG9jYXRpb24gfSBmcm9tICcuLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJUXVpY2tEaWZmTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29udHJpYi9zY20vYnJvd3Nlci9xdWlja0RpZmZNb2RlbC5qcyc7XG5cblxuY2xhc3MgVGV4dEVkaXRvclNuYXBzaG90IHtcblxuXHRyZWFkb25seSBpZDogc3RyaW5nO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IGVkaXRvcjogSUFjdGl2ZUNvZGVFZGl0b3IsXG5cdCkge1xuXHRcdHRoaXMuaWQgPSBgJHtlZGl0b3IuZ2V0SWQoKX0sJHtlZGl0b3IuZ2V0TW9kZWwoKS5pZH1gO1xuXHR9XG59XG5cbmNsYXNzIERvY3VtZW50QW5kRWRpdG9yU3RhdGVEZWx0YSB7XG5cblx0cmVhZG9ubHkgaXNFbXB0eTogYm9vbGVhbjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSByZW1vdmVkRG9jdW1lbnRzOiBJVGV4dE1vZGVsW10sXG5cdFx0cmVhZG9ubHkgYWRkZWREb2N1bWVudHM6IElUZXh0TW9kZWxbXSxcblx0XHRyZWFkb25seSByZW1vdmVkRWRpdG9yczogVGV4dEVkaXRvclNuYXBzaG90W10sXG5cdFx0cmVhZG9ubHkgYWRkZWRFZGl0b3JzOiBUZXh0RWRpdG9yU25hcHNob3RbXSxcblx0XHRyZWFkb25seSBvbGRBY3RpdmVFZGl0b3I6IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQsXG5cdFx0cmVhZG9ubHkgbmV3QWN0aXZlRWRpdG9yOiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkLFxuXHQpIHtcblx0XHR0aGlzLmlzRW1wdHkgPSB0aGlzLnJlbW92ZWREb2N1bWVudHMubGVuZ3RoID09PSAwXG5cdFx0XHQmJiB0aGlzLmFkZGVkRG9jdW1lbnRzLmxlbmd0aCA9PT0gMFxuXHRcdFx0JiYgdGhpcy5yZW1vdmVkRWRpdG9ycy5sZW5ndGggPT09IDBcblx0XHRcdCYmIHRoaXMuYWRkZWRFZGl0b3JzLmxlbmd0aCA9PT0gMFxuXHRcdFx0JiYgb2xkQWN0aXZlRWRpdG9yID09PSBuZXdBY3RpdmVFZGl0b3I7XG5cdH1cblxuXHR0b1N0cmluZygpOiBzdHJpbmcge1xuXHRcdGxldCByZXQgPSAnRG9jdW1lbnRBbmRFZGl0b3JTdGF0ZURlbHRhXFxuJztcblx0XHRyZXQgKz0gYFxcdFJlbW92ZWQgRG9jdW1lbnRzOiBbJHt0aGlzLnJlbW92ZWREb2N1bWVudHMubWFwKGQgPT4gZC51cmkudG9TdHJpbmcodHJ1ZSkpLmpvaW4oJywgJyl9XVxcbmA7XG5cdFx0cmV0ICs9IGBcXHRBZGRlZCBEb2N1bWVudHM6IFske3RoaXMuYWRkZWREb2N1bWVudHMubWFwKGQgPT4gZC51cmkudG9TdHJpbmcodHJ1ZSkpLmpvaW4oJywgJyl9XVxcbmA7XG5cdFx0cmV0ICs9IGBcXHRSZW1vdmVkIEVkaXRvcnM6IFske3RoaXMucmVtb3ZlZEVkaXRvcnMubWFwKGUgPT4gZS5pZCkuam9pbignLCAnKX1dXFxuYDtcblx0XHRyZXQgKz0gYFxcdEFkZGVkIEVkaXRvcnM6IFske3RoaXMuYWRkZWRFZGl0b3JzLm1hcChlID0+IGUuaWQpLmpvaW4oJywgJyl9XVxcbmA7XG5cdFx0cmV0ICs9IGBcXHROZXcgQWN0aXZlIEVkaXRvcjogJHt0aGlzLm5ld0FjdGl2ZUVkaXRvcn1cXG5gO1xuXHRcdHJldHVybiByZXQ7XG5cdH1cbn1cblxuY2xhc3MgRG9jdW1lbnRBbmRFZGl0b3JTdGF0ZSB7XG5cblx0c3RhdGljIGNvbXB1dGUoYmVmb3JlOiBEb2N1bWVudEFuZEVkaXRvclN0YXRlIHwgdW5kZWZpbmVkLCBhZnRlcjogRG9jdW1lbnRBbmRFZGl0b3JTdGF0ZSk6IERvY3VtZW50QW5kRWRpdG9yU3RhdGVEZWx0YSB7XG5cdFx0aWYgKCFiZWZvcmUpIHtcblx0XHRcdHJldHVybiBuZXcgRG9jdW1lbnRBbmRFZGl0b3JTdGF0ZURlbHRhKFxuXHRcdFx0XHRbXSwgWy4uLmFmdGVyLmRvY3VtZW50cy52YWx1ZXMoKV0sXG5cdFx0XHRcdFtdLCBbLi4uYWZ0ZXIudGV4dEVkaXRvcnMudmFsdWVzKCldLFxuXHRcdFx0XHR1bmRlZmluZWQsIGFmdGVyLmFjdGl2ZUVkaXRvclxuXHRcdFx0KTtcblx0XHR9XG5cdFx0Y29uc3QgZG9jdW1lbnREZWx0YSA9IGRpZmZTZXRzKGJlZm9yZS5kb2N1bWVudHMsIGFmdGVyLmRvY3VtZW50cyk7XG5cdFx0Y29uc3QgZWRpdG9yRGVsdGEgPSBkaWZmTWFwcyhiZWZvcmUudGV4dEVkaXRvcnMsIGFmdGVyLnRleHRFZGl0b3JzKTtcblx0XHRjb25zdCBvbGRBY3RpdmVFZGl0b3IgPSBiZWZvcmUuYWN0aXZlRWRpdG9yICE9PSBhZnRlci5hY3RpdmVFZGl0b3IgPyBiZWZvcmUuYWN0aXZlRWRpdG9yIDogdW5kZWZpbmVkO1xuXHRcdGNvbnN0IG5ld0FjdGl2ZUVkaXRvciA9IGJlZm9yZS5hY3RpdmVFZGl0b3IgIT09IGFmdGVyLmFjdGl2ZUVkaXRvciA/IGFmdGVyLmFjdGl2ZUVkaXRvciA6IHVuZGVmaW5lZDtcblxuXHRcdHJldHVybiBuZXcgRG9jdW1lbnRBbmRFZGl0b3JTdGF0ZURlbHRhKFxuXHRcdFx0ZG9jdW1lbnREZWx0YS5yZW1vdmVkLCBkb2N1bWVudERlbHRhLmFkZGVkLFxuXHRcdFx0ZWRpdG9yRGVsdGEucmVtb3ZlZCwgZWRpdG9yRGVsdGEuYWRkZWQsXG5cdFx0XHRvbGRBY3RpdmVFZGl0b3IsIG5ld0FjdGl2ZUVkaXRvclxuXHRcdCk7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBkb2N1bWVudHM6IFNldDxJVGV4dE1vZGVsPixcblx0XHRyZWFkb25seSB0ZXh0RWRpdG9yczogTWFwPHN0cmluZywgVGV4dEVkaXRvclNuYXBzaG90Pixcblx0XHRyZWFkb25seSBhY3RpdmVFZGl0b3I6IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQsXG5cdCkge1xuXHRcdC8vXG5cdH1cbn1cblxuY29uc3QgZW51bSBBY3RpdmVFZGl0b3JPcmRlciB7XG5cdEVkaXRvciwgUGFuZWxcbn1cblxuY2xhc3MgTWFpblRocmVhZERvY3VtZW50QW5kRWRpdG9yU3RhdGVDb21wdXRlciB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfdG9EaXNwb3NlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF90b0Rpc3Bvc2VPbkVkaXRvclJlbW92ZSA9IG5ldyBEaXNwb3NhYmxlTWFwPHN0cmluZz4oKTtcblx0cHJpdmF0ZSBfY3VycmVudFN0YXRlPzogRG9jdW1lbnRBbmRFZGl0b3JTdGF0ZTtcblx0cHJpdmF0ZSBfYWN0aXZlRWRpdG9yT3JkZXI6IEFjdGl2ZUVkaXRvck9yZGVyID0gQWN0aXZlRWRpdG9yT3JkZXIuRWRpdG9yO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlU3RhdGU6IChkZWx0YTogRG9jdW1lbnRBbmRFZGl0b3JTdGF0ZURlbHRhKSA9PiB2b2lkLFxuXHRcdEBJTW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX21vZGVsU2VydmljZTogSU1vZGVsU2VydmljZSxcblx0XHRASUNvZGVFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvZGVFZGl0b3JTZXJ2aWNlOiBJQ29kZUVkaXRvclNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJUGFuZUNvbXBvc2l0ZVBhcnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3BhbmVDb21wb3NpdGVTZXJ2aWNlOiBJUGFuZUNvbXBvc2l0ZVBhcnRTZXJ2aWNlLFxuXHQpIHtcblx0XHR0aGlzLl9tb2RlbFNlcnZpY2Uub25Nb2RlbEFkZGVkKHRoaXMuX3VwZGF0ZVN0YXRlT25Nb2RlbEFkZCwgdGhpcywgdGhpcy5fdG9EaXNwb3NlKTtcblx0XHR0aGlzLl9tb2RlbFNlcnZpY2Uub25Nb2RlbFJlbW92ZWQoXyA9PiB0aGlzLl91cGRhdGVTdGF0ZSgpLCB0aGlzLCB0aGlzLl90b0Rpc3Bvc2UpO1xuXHRcdHRoaXMuX2VkaXRvclNlcnZpY2Uub25EaWRBY3RpdmVFZGl0b3JDaGFuZ2UoXyA9PiB0aGlzLl91cGRhdGVTdGF0ZSgpLCB0aGlzLCB0aGlzLl90b0Rpc3Bvc2UpO1xuXG5cdFx0dGhpcy5fY29kZUVkaXRvclNlcnZpY2Uub25Db2RlRWRpdG9yQWRkKHRoaXMuX29uRGlkQWRkRWRpdG9yLCB0aGlzLCB0aGlzLl90b0Rpc3Bvc2UpO1xuXHRcdHRoaXMuX2NvZGVFZGl0b3JTZXJ2aWNlLm9uQ29kZUVkaXRvclJlbW92ZSh0aGlzLl9vbkRpZFJlbW92ZUVkaXRvciwgdGhpcywgdGhpcy5fdG9EaXNwb3NlKTtcblx0XHR0aGlzLl9jb2RlRWRpdG9yU2VydmljZS5saXN0Q29kZUVkaXRvcnMoKS5mb3JFYWNoKHRoaXMuX29uRGlkQWRkRWRpdG9yLCB0aGlzKTtcblxuXHRcdEV2ZW50LmZpbHRlcih0aGlzLl9wYW5lQ29tcG9zaXRlU2VydmljZS5vbkRpZFBhbmVDb21wb3NpdGVPcGVuLCBldmVudCA9PiBldmVudC52aWV3Q29udGFpbmVyTG9jYXRpb24gPT09IFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbCkoXyA9PiB0aGlzLl9hY3RpdmVFZGl0b3JPcmRlciA9IEFjdGl2ZUVkaXRvck9yZGVyLlBhbmVsLCB1bmRlZmluZWQsIHRoaXMuX3RvRGlzcG9zZSk7XG5cdFx0RXZlbnQuZmlsdGVyKHRoaXMuX3BhbmVDb21wb3NpdGVTZXJ2aWNlLm9uRGlkUGFuZUNvbXBvc2l0ZUNsb3NlLCBldmVudCA9PiBldmVudC52aWV3Q29udGFpbmVyTG9jYXRpb24gPT09IFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbCkoXyA9PiB0aGlzLl9hY3RpdmVFZGl0b3JPcmRlciA9IEFjdGl2ZUVkaXRvck9yZGVyLkVkaXRvciwgdW5kZWZpbmVkLCB0aGlzLl90b0Rpc3Bvc2UpO1xuXHRcdHRoaXMuX2VkaXRvclNlcnZpY2Uub25EaWRWaXNpYmxlRWRpdG9yc0NoYW5nZShfID0+IHRoaXMuX2FjdGl2ZUVkaXRvck9yZGVyID0gQWN0aXZlRWRpdG9yT3JkZXIuRWRpdG9yLCB1bmRlZmluZWQsIHRoaXMuX3RvRGlzcG9zZSk7XG5cblx0XHR0aGlzLl91cGRhdGVTdGF0ZSgpO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl90b0Rpc3Bvc2UuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX3RvRGlzcG9zZU9uRWRpdG9yUmVtb3ZlLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHByaXZhdGUgX29uRGlkQWRkRWRpdG9yKGU6IElDb2RlRWRpdG9yKTogdm9pZCB7XG5cdFx0dGhpcy5fdG9EaXNwb3NlT25FZGl0b3JSZW1vdmUuc2V0KGUuZ2V0SWQoKSwgY29tYmluZWREaXNwb3NhYmxlKFxuXHRcdFx0ZS5vbkRpZENoYW5nZU1vZGVsKCgpID0+IHRoaXMuX3VwZGF0ZVN0YXRlKCkpLFxuXHRcdFx0ZS5vbkRpZEZvY3VzRWRpdG9yVGV4dCgoKSA9PiB0aGlzLl91cGRhdGVTdGF0ZSgpKSxcblx0XHRcdGUub25EaWRGb2N1c0VkaXRvcldpZGdldCgoKSA9PiB0aGlzLl91cGRhdGVTdGF0ZShlKSlcblx0XHQpKTtcblx0XHR0aGlzLl91cGRhdGVTdGF0ZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfb25EaWRSZW1vdmVFZGl0b3IoZTogSUNvZGVFZGl0b3IpOiB2b2lkIHtcblx0XHRjb25zdCBpZCA9IGUuZ2V0SWQoKTtcblx0XHRpZiAodGhpcy5fdG9EaXNwb3NlT25FZGl0b3JSZW1vdmUuaGFzKGlkKSkge1xuXHRcdFx0dGhpcy5fdG9EaXNwb3NlT25FZGl0b3JSZW1vdmUuZGVsZXRlQW5kRGlzcG9zZShpZCk7XG5cdFx0XHR0aGlzLl91cGRhdGVTdGF0ZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZVN0YXRlT25Nb2RlbEFkZChtb2RlbDogSVRleHRNb2RlbCk6IHZvaWQge1xuXHRcdGlmICghc2hvdWxkU3luY2hyb25pemVNb2RlbChtb2RlbCkpIHtcblx0XHRcdC8vIGlnbm9yZVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5fY3VycmVudFN0YXRlKSB7XG5cdFx0XHQvLyB0b28gZWFybHlcblx0XHRcdHRoaXMuX3VwZGF0ZVN0YXRlKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gc21hbGwgKGZhc3QpIGRlbHRhXG5cdFx0dGhpcy5fY3VycmVudFN0YXRlID0gbmV3IERvY3VtZW50QW5kRWRpdG9yU3RhdGUoXG5cdFx0XHR0aGlzLl9jdXJyZW50U3RhdGUuZG9jdW1lbnRzLmFkZChtb2RlbCksXG5cdFx0XHR0aGlzLl9jdXJyZW50U3RhdGUudGV4dEVkaXRvcnMsXG5cdFx0XHR0aGlzLl9jdXJyZW50U3RhdGUuYWN0aXZlRWRpdG9yXG5cdFx0KTtcblxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlU3RhdGUobmV3IERvY3VtZW50QW5kRWRpdG9yU3RhdGVEZWx0YShcblx0XHRcdFtdLCBbbW9kZWxdLFxuXHRcdFx0W10sIFtdLFxuXHRcdFx0dW5kZWZpbmVkLCB1bmRlZmluZWRcblx0XHQpKTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZVN0YXRlKHdpZGdldEZvY3VzQ2FuZGlkYXRlPzogSUNvZGVFZGl0b3IpOiB2b2lkIHtcblxuXHRcdC8vIG1vZGVsczogaWdub3JlIHRvbyBsYXJnZSBtb2RlbHNcblx0XHRjb25zdCBtb2RlbHMgPSBuZXcgU2V0PElUZXh0TW9kZWw+KCk7XG5cdFx0Zm9yIChjb25zdCBtb2RlbCBvZiB0aGlzLl9tb2RlbFNlcnZpY2UuZ2V0TW9kZWxzKCkpIHtcblx0XHRcdGlmIChzaG91bGRTeW5jaHJvbml6ZU1vZGVsKG1vZGVsKSkge1xuXHRcdFx0XHRtb2RlbHMuYWRkKG1vZGVsKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBlZGl0b3I6IG9ubHkgdGFrZSB0aG9zZSB0aGF0IGhhdmUgYSBub3QgdG9vIGxhcmdlIG1vZGVsXG5cdFx0Y29uc3QgZWRpdG9ycyA9IG5ldyBNYXA8c3RyaW5nLCBUZXh0RWRpdG9yU25hcHNob3Q+KCk7XG5cdFx0bGV0IGFjdGl2ZUVkaXRvcjogc3RyaW5nIHwgbnVsbCA9IG51bGw7IC8vIFN0cmljdCBudWxsIHdvcmsuIFRoaXMgZG9lc24ndCBsaWtlIGJlaW5nIHVuZGVmaW5lZCFcblxuXHRcdGZvciAoY29uc3QgZWRpdG9yIG9mIHRoaXMuX2NvZGVFZGl0b3JTZXJ2aWNlLmxpc3RDb2RlRWRpdG9ycygpKSB7XG5cdFx0XHRpZiAoZWRpdG9yLmlzU2ltcGxlV2lkZ2V0KSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRcdGlmIChlZGl0b3IuaGFzTW9kZWwoKSAmJiBtb2RlbCAmJiBzaG91bGRTeW5jaHJvbml6ZU1vZGVsKG1vZGVsKVxuXHRcdFx0XHQmJiAhbW9kZWwuaXNEaXNwb3NlZCgpIC8vIG1vZGVsIGRpc3Bvc2VkXG5cdFx0XHRcdCYmIEJvb2xlYW4odGhpcy5fbW9kZWxTZXJ2aWNlLmdldE1vZGVsKG1vZGVsLnVyaSkpIC8vIG1vZGVsIGRpc3Bvc2luZywgdGhlIGZsYWcgZGlkbid0IGZsaXAgeWV0IGJ1dCB0aGUgbW9kZWwgc2VydmljZSBhbHJlYWR5IHJlbW92ZWQgaXRcblx0XHRcdCkge1xuXHRcdFx0XHRjb25zdCBhcGlFZGl0b3IgPSBuZXcgVGV4dEVkaXRvclNuYXBzaG90KGVkaXRvcik7XG5cdFx0XHRcdGVkaXRvcnMuc2V0KGFwaUVkaXRvci5pZCwgYXBpRWRpdG9yKTtcblx0XHRcdFx0aWYgKGVkaXRvci5oYXNUZXh0Rm9jdXMoKSB8fCAod2lkZ2V0Rm9jdXNDYW5kaWRhdGUgPT09IGVkaXRvciAmJiBlZGl0b3IuaGFzV2lkZ2V0Rm9jdXMoKSkpIHtcblx0XHRcdFx0XHQvLyB0ZXh0IGZvY3VzIGhhcyBwcmlvcml0eSwgd2lkZ2V0IGZvY3VzIGlzIHRyaWNreSBiZWNhdXNlIG11bHRpcGxlXG5cdFx0XHRcdFx0Ly8gZWRpdG9ycyBtaWdodCBjbGFpbSB3aWRnZXQgZm9jdXMgYXQgdGhlIHNhbWUgdGltZS4gdGhlcmVmb3JlIHdlIHVzZSBhXG5cdFx0XHRcdFx0Ly8gY2FuZGlkYXRlICh3aGljaCBpcyB0aGUgZWRpdG9yIHRoYXQgaGFzIHJhaXNlZCBhbiB3aWRnZXQgZm9jdXMgZXZlbnQpXG5cdFx0XHRcdFx0Ly8gaW4gYWRkaXRpb24gdG8gdGhlIHdpZGdldCBmb2N1cyBjaGVja1xuXHRcdFx0XHRcdGFjdGl2ZUVkaXRvciA9IGFwaUVkaXRvci5pZDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIGFjdGl2ZSBlZGl0b3I6IGlmIG5vbmUgb2YgdGhlIHByZXZpb3VzIGVkaXRvcnMgaGFkIGZvY3VzIHdlIHRyeVxuXHRcdC8vIHRvIG1hdGNoIG91dHB1dCBwYW5lbHMgb3IgdGhlIGFjdGl2ZSB3b3JrYmVuY2ggZWRpdG9yIHdpdGhcblx0XHQvLyBvbmUgb2YgZWRpdG9yIHdlIGhhdmUganVzdCBjb21wdXRlZFxuXHRcdGlmICghYWN0aXZlRWRpdG9yKSB7XG5cdFx0XHRsZXQgY2FuZGlkYXRlOiBJRWRpdG9yIHwgdW5kZWZpbmVkO1xuXHRcdFx0aWYgKHRoaXMuX2FjdGl2ZUVkaXRvck9yZGVyID09PSBBY3RpdmVFZGl0b3JPcmRlci5FZGl0b3IpIHtcblx0XHRcdFx0Y2FuZGlkYXRlID0gdGhpcy5fZ2V0QWN0aXZlRWRpdG9yRnJvbUVkaXRvclBhcnQoKSB8fCB0aGlzLl9nZXRBY3RpdmVFZGl0b3JGcm9tUGFuZWwoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNhbmRpZGF0ZSA9IHRoaXMuX2dldEFjdGl2ZUVkaXRvckZyb21QYW5lbCgpIHx8IHRoaXMuX2dldEFjdGl2ZUVkaXRvckZyb21FZGl0b3JQYXJ0KCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChjYW5kaWRhdGUpIHtcblx0XHRcdFx0Zm9yIChjb25zdCBzbmFwc2hvdCBvZiBlZGl0b3JzLnZhbHVlcygpKSB7XG5cdFx0XHRcdFx0aWYgKGNhbmRpZGF0ZSA9PT0gc25hcHNob3QuZWRpdG9yKSB7XG5cdFx0XHRcdFx0XHRhY3RpdmVFZGl0b3IgPSBzbmFwc2hvdC5pZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBjb21wdXRlIG5ldyBzdGF0ZSBhbmQgY29tcGFyZSBhZ2FpbnN0IG9sZFxuXHRcdGNvbnN0IG5ld1N0YXRlID0gbmV3IERvY3VtZW50QW5kRWRpdG9yU3RhdGUobW9kZWxzLCBlZGl0b3JzLCBhY3RpdmVFZGl0b3IpO1xuXHRcdGNvbnN0IGRlbHRhID0gRG9jdW1lbnRBbmRFZGl0b3JTdGF0ZS5jb21wdXRlKHRoaXMuX2N1cnJlbnRTdGF0ZSwgbmV3U3RhdGUpO1xuXHRcdGlmICghZGVsdGEuaXNFbXB0eSkge1xuXHRcdFx0dGhpcy5fY3VycmVudFN0YXRlID0gbmV3U3RhdGU7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVN0YXRlKGRlbHRhKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9nZXRBY3RpdmVFZGl0b3JGcm9tUGFuZWwoKTogSUVkaXRvciB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgcGFuZWwgPSB0aGlzLl9wYW5lQ29tcG9zaXRlU2VydmljZS5nZXRBY3RpdmVQYW5lQ29tcG9zaXRlKFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbCk7XG5cdFx0aWYgKHBhbmVsIGluc3RhbmNlb2YgQWJzdHJhY3RUZXh0RWRpdG9yKSB7XG5cdFx0XHRjb25zdCBjb250cm9sID0gcGFuZWwuZ2V0Q29udHJvbCgpO1xuXHRcdFx0aWYgKGlzQ29kZUVkaXRvcihjb250cm9sKSkge1xuXHRcdFx0XHRyZXR1cm4gY29udHJvbDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0QWN0aXZlRWRpdG9yRnJvbUVkaXRvclBhcnQoKTogSUVkaXRvciB8IHVuZGVmaW5lZCB7XG5cdFx0bGV0IGFjdGl2ZVRleHRFZGl0b3JDb250cm9sID0gdGhpcy5fZWRpdG9yU2VydmljZS5hY3RpdmVUZXh0RWRpdG9yQ29udHJvbDtcblx0XHRpZiAoaXNEaWZmRWRpdG9yKGFjdGl2ZVRleHRFZGl0b3JDb250cm9sKSkge1xuXHRcdFx0YWN0aXZlVGV4dEVkaXRvckNvbnRyb2wgPSBhY3RpdmVUZXh0RWRpdG9yQ29udHJvbC5nZXRNb2RpZmllZEVkaXRvcigpO1xuXHRcdH1cblx0XHRyZXR1cm4gYWN0aXZlVGV4dEVkaXRvckNvbnRyb2w7XG5cdH1cbn1cblxuQGV4dEhvc3RDdXN0b21lclxuZXhwb3J0IGNsYXNzIE1haW5UaHJlYWREb2N1bWVudHNBbmRFZGl0b3JzIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF90b0Rpc3Bvc2UgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3Byb3h5OiBFeHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9yc1NoYXBlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9tYWluVGhyZWFkRG9jdW1lbnRzOiBNYWluVGhyZWFkRG9jdW1lbnRzO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9tYWluVGhyZWFkRWRpdG9yczogTWFpblRocmVhZFRleHRFZGl0b3JzO1xuXHRwcml2YXRlIHJlYWRvbmx5IF90ZXh0RWRpdG9ycyA9IG5ldyBNYXA8c3RyaW5nLCBNYWluVGhyZWFkVGV4dEVkaXRvcj4oKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRleHRIb3N0Q29udGV4dDogSUV4dEhvc3RDb250ZXh0LFxuXHRcdEBJTW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX21vZGVsU2VydmljZTogSU1vZGVsU2VydmljZSxcblx0XHRASVRleHRGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZXh0RmlsZVNlcnZpY2U6IElUZXh0RmlsZVNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJQ29kZUVkaXRvclNlcnZpY2UgY29kZUVkaXRvclNlcnZpY2U6IElDb2RlRWRpdG9yU2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElUZXh0TW9kZWxTZXJ2aWNlIHRleHRNb2RlbFJlc29sdmVyU2VydmljZTogSVRleHRNb2RlbFNlcnZpY2UsXG5cdFx0QElFZGl0b3JHcm91cHNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvckdyb3VwU2VydmljZTogSUVkaXRvckdyb3Vwc1NlcnZpY2UsXG5cdFx0QElQYW5lQ29tcG9zaXRlUGFydFNlcnZpY2UgcGFuZUNvbXBvc2l0ZVNlcnZpY2U6IElQYW5lQ29tcG9zaXRlUGFydFNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgZW52aXJvbm1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJV29ya2luZ0NvcHlGaWxlU2VydmljZSB3b3JraW5nQ29weUZpbGVTZXJ2aWNlOiBJV29ya2luZ0NvcHlGaWxlU2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdFx0QElDbGlwYm9hcmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NsaXBib2FyZFNlcnZpY2U6IElDbGlwYm9hcmRTZXJ2aWNlLFxuXHRcdEBJUGF0aFNlcnZpY2UgcGF0aFNlcnZpY2U6IElQYXRoU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElRdWlja0RpZmZNb2RlbFNlcnZpY2UgcXVpY2tEaWZmTW9kZWxTZXJ2aWNlOiBJUXVpY2tEaWZmTW9kZWxTZXJ2aWNlXG5cdCkge1xuXHRcdHRoaXMuX3Byb3h5ID0gZXh0SG9zdENvbnRleHQuZ2V0UHJveHkoRXh0SG9zdENvbnRleHQuRXh0SG9zdERvY3VtZW50c0FuZEVkaXRvcnMpO1xuXG5cdFx0dGhpcy5fbWFpblRocmVhZERvY3VtZW50cyA9IHRoaXMuX3RvRGlzcG9zZS5hZGQobmV3IE1haW5UaHJlYWREb2N1bWVudHMoZXh0SG9zdENvbnRleHQsIHRoaXMuX21vZGVsU2VydmljZSwgdGhpcy5fdGV4dEZpbGVTZXJ2aWNlLCBmaWxlU2VydmljZSwgdGV4dE1vZGVsUmVzb2x2ZXJTZXJ2aWNlLCBlbnZpcm9ubWVudFNlcnZpY2UsIHVyaUlkZW50aXR5U2VydmljZSwgd29ya2luZ0NvcHlGaWxlU2VydmljZSwgcGF0aFNlcnZpY2UpKTtcblx0XHRleHRIb3N0Q29udGV4dC5zZXQoTWFpbkNvbnRleHQuTWFpblRocmVhZERvY3VtZW50cywgdGhpcy5fbWFpblRocmVhZERvY3VtZW50cyk7XG5cblx0XHR0aGlzLl9tYWluVGhyZWFkRWRpdG9ycyA9IHRoaXMuX3RvRGlzcG9zZS5hZGQobmV3IE1haW5UaHJlYWRUZXh0RWRpdG9ycyh0aGlzLCBleHRIb3N0Q29udGV4dCwgY29kZUVkaXRvclNlcnZpY2UsIHRoaXMuX2VkaXRvclNlcnZpY2UsIHRoaXMuX2VkaXRvckdyb3VwU2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIHF1aWNrRGlmZk1vZGVsU2VydmljZSwgdXJpSWRlbnRpdHlTZXJ2aWNlKSk7XG5cdFx0ZXh0SG9zdENvbnRleHQuc2V0KE1haW5Db250ZXh0Lk1haW5UaHJlYWRUZXh0RWRpdG9ycywgdGhpcy5fbWFpblRocmVhZEVkaXRvcnMpO1xuXG5cdFx0Ly8gSXQgaXMgZXhwZWN0ZWQgdGhhdCB0aGUgY3RvciBvZiB0aGUgc3RhdGUgY29tcHV0ZXIgY2FsbHMgb3VyIGBfb25EZWx0YWAuXG5cdFx0dGhpcy5fdG9EaXNwb3NlLmFkZChuZXcgTWFpblRocmVhZERvY3VtZW50QW5kRWRpdG9yU3RhdGVDb21wdXRlcihkZWx0YSA9PiB0aGlzLl9vbkRlbHRhKGRlbHRhKSwgX21vZGVsU2VydmljZSwgY29kZUVkaXRvclNlcnZpY2UsIHRoaXMuX2VkaXRvclNlcnZpY2UsIHBhbmVDb21wb3NpdGVTZXJ2aWNlKSk7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX3RvRGlzcG9zZS5kaXNwb3NlKCk7XG5cdH1cblxuXHRwcml2YXRlIF9vbkRlbHRhKGRlbHRhOiBEb2N1bWVudEFuZEVkaXRvclN0YXRlRGVsdGEpOiB2b2lkIHtcblxuXHRcdGNvbnN0IHJlbW92ZWRFZGl0b3JzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGNvbnN0IGFkZGVkRWRpdG9yczogTWFpblRocmVhZFRleHRFZGl0b3JbXSA9IFtdO1xuXG5cdFx0Ly8gcmVtb3ZlZCBtb2RlbHNcblx0XHRjb25zdCByZW1vdmVkRG9jdW1lbnRzID0gZGVsdGEucmVtb3ZlZERvY3VtZW50cy5tYXAobSA9PiBtLnVyaSk7XG5cblx0XHQvLyBhZGRlZCBlZGl0b3JzXG5cdFx0Zm9yIChjb25zdCBhcGlFZGl0b3Igb2YgZGVsdGEuYWRkZWRFZGl0b3JzKSB7XG5cdFx0XHRjb25zdCBtYWluVGhyZWFkRWRpdG9yID0gbmV3IE1haW5UaHJlYWRUZXh0RWRpdG9yKGFwaUVkaXRvci5pZCwgYXBpRWRpdG9yLmVkaXRvci5nZXRNb2RlbCgpLFxuXHRcdFx0XHRhcGlFZGl0b3IuZWRpdG9yLCB7IG9uR2FpbmVkRm9jdXMoKSB7IH0sIG9uTG9zdEZvY3VzKCkgeyB9IH0sIHRoaXMuX21haW5UaHJlYWREb2N1bWVudHMsIHRoaXMuX21vZGVsU2VydmljZSwgdGhpcy5fY2xpcGJvYXJkU2VydmljZSk7XG5cblx0XHRcdHRoaXMuX3RleHRFZGl0b3JzLnNldChhcGlFZGl0b3IuaWQsIG1haW5UaHJlYWRFZGl0b3IpO1xuXHRcdFx0YWRkZWRFZGl0b3JzLnB1c2gobWFpblRocmVhZEVkaXRvcik7XG5cdFx0fVxuXG5cdFx0Ly8gcmVtb3ZlZCBlZGl0b3JzXG5cdFx0Zm9yIChjb25zdCB7IGlkIH0gb2YgZGVsdGEucmVtb3ZlZEVkaXRvcnMpIHtcblx0XHRcdGNvbnN0IG1haW5UaHJlYWRFZGl0b3IgPSB0aGlzLl90ZXh0RWRpdG9ycy5nZXQoaWQpO1xuXHRcdFx0aWYgKG1haW5UaHJlYWRFZGl0b3IpIHtcblx0XHRcdFx0bWFpblRocmVhZEVkaXRvci5kaXNwb3NlKCk7XG5cdFx0XHRcdHRoaXMuX3RleHRFZGl0b3JzLmRlbGV0ZShpZCk7XG5cdFx0XHRcdHJlbW92ZWRFZGl0b3JzLnB1c2goaWQpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGV4dEhvc3REZWx0YTogSURvY3VtZW50c0FuZEVkaXRvcnNEZWx0YSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0bGV0IGVtcHR5ID0gdHJ1ZTtcblx0XHRpZiAoZGVsdGEubmV3QWN0aXZlRWRpdG9yICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGVtcHR5ID0gZmFsc2U7XG5cdFx0XHRleHRIb3N0RGVsdGEubmV3QWN0aXZlRWRpdG9yID0gZGVsdGEubmV3QWN0aXZlRWRpdG9yO1xuXHRcdH1cblx0XHRpZiAocmVtb3ZlZERvY3VtZW50cy5sZW5ndGggPiAwKSB7XG5cdFx0XHRlbXB0eSA9IGZhbHNlO1xuXHRcdFx0ZXh0SG9zdERlbHRhLnJlbW92ZWREb2N1bWVudHMgPSByZW1vdmVkRG9jdW1lbnRzO1xuXHRcdH1cblx0XHRpZiAocmVtb3ZlZEVkaXRvcnMubGVuZ3RoID4gMCkge1xuXHRcdFx0ZW1wdHkgPSBmYWxzZTtcblx0XHRcdGV4dEhvc3REZWx0YS5yZW1vdmVkRWRpdG9ycyA9IHJlbW92ZWRFZGl0b3JzO1xuXHRcdH1cblx0XHRpZiAoZGVsdGEuYWRkZWREb2N1bWVudHMubGVuZ3RoID4gMCkge1xuXHRcdFx0ZW1wdHkgPSBmYWxzZTtcblx0XHRcdGV4dEhvc3REZWx0YS5hZGRlZERvY3VtZW50cyA9IGRlbHRhLmFkZGVkRG9jdW1lbnRzLm1hcChtID0+IHRoaXMuX3RvTW9kZWxBZGREYXRhKG0pKTtcblx0XHR9XG5cdFx0aWYgKGRlbHRhLmFkZGVkRWRpdG9ycy5sZW5ndGggPiAwKSB7XG5cdFx0XHRlbXB0eSA9IGZhbHNlO1xuXHRcdFx0ZXh0SG9zdERlbHRhLmFkZGVkRWRpdG9ycyA9IGFkZGVkRWRpdG9ycy5tYXAoZSA9PiB0aGlzLl90b1RleHRFZGl0b3JBZGREYXRhKGUpKTtcblx0XHR9XG5cblx0XHRpZiAoIWVtcHR5KSB7XG5cdFx0XHQvLyBmaXJzdCB1cGRhdGUgZXh0IGhvc3Rcblx0XHRcdHRoaXMuX3Byb3h5LiRhY2NlcHREb2N1bWVudHNBbmRFZGl0b3JzRGVsdGEoZXh0SG9zdERlbHRhKTtcblxuXHRcdFx0Ly8gc2Vjb25kIHVwZGF0ZSBkZXBlbmRlbnQgZG9jdW1lbnQvZWRpdG9yIHN0YXRlc1xuXHRcdFx0cmVtb3ZlZERvY3VtZW50cy5mb3JFYWNoKHRoaXMuX21haW5UaHJlYWREb2N1bWVudHMuaGFuZGxlTW9kZWxSZW1vdmVkLCB0aGlzLl9tYWluVGhyZWFkRG9jdW1lbnRzKTtcblx0XHRcdGRlbHRhLmFkZGVkRG9jdW1lbnRzLmZvckVhY2godGhpcy5fbWFpblRocmVhZERvY3VtZW50cy5oYW5kbGVNb2RlbEFkZGVkLCB0aGlzLl9tYWluVGhyZWFkRG9jdW1lbnRzKTtcblxuXHRcdFx0cmVtb3ZlZEVkaXRvcnMuZm9yRWFjaCh0aGlzLl9tYWluVGhyZWFkRWRpdG9ycy5oYW5kbGVUZXh0RWRpdG9yUmVtb3ZlZCwgdGhpcy5fbWFpblRocmVhZEVkaXRvcnMpO1xuXHRcdFx0YWRkZWRFZGl0b3JzLmZvckVhY2godGhpcy5fbWFpblRocmVhZEVkaXRvcnMuaGFuZGxlVGV4dEVkaXRvckFkZGVkLCB0aGlzLl9tYWluVGhyZWFkRWRpdG9ycyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfdG9Nb2RlbEFkZERhdGEobW9kZWw6IElUZXh0TW9kZWwpOiBJTW9kZWxBZGRlZERhdGEge1xuXHRcdHJldHVybiB7XG5cdFx0XHR1cmk6IG1vZGVsLnVyaSxcblx0XHRcdHZlcnNpb25JZDogbW9kZWwuZ2V0VmVyc2lvbklkKCksXG5cdFx0XHRsaW5lczogbW9kZWwuZ2V0TGluZXNDb250ZW50KCksXG5cdFx0XHRFT0w6IG1vZGVsLmdldEVPTCgpLFxuXHRcdFx0bGFuZ3VhZ2VJZDogbW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpLFxuXHRcdFx0aXNEaXJ0eTogdGhpcy5fdGV4dEZpbGVTZXJ2aWNlLmlzRGlydHkobW9kZWwudXJpKSxcblx0XHRcdGVuY29kaW5nOiB0aGlzLl90ZXh0RmlsZVNlcnZpY2UuZ2V0RW5jb2RpbmcobW9kZWwudXJpKVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIF90b1RleHRFZGl0b3JBZGREYXRhKHRleHRFZGl0b3I6IE1haW5UaHJlYWRUZXh0RWRpdG9yKTogSVRleHRFZGl0b3JBZGREYXRhIHtcblx0XHRjb25zdCBwcm9wcyA9IHRleHRFZGl0b3IuZ2V0UHJvcGVydGllcygpO1xuXHRcdHJldHVybiB7XG5cdFx0XHRpZDogdGV4dEVkaXRvci5nZXRJZCgpLFxuXHRcdFx0ZG9jdW1lbnRVcmk6IHRleHRFZGl0b3IuZ2V0TW9kZWwoKS51cmksXG5cdFx0XHRvcHRpb25zOiBwcm9wcy5vcHRpb25zLFxuXHRcdFx0c2VsZWN0aW9uczogcHJvcHMuc2VsZWN0aW9ucyxcblx0XHRcdHZpc2libGVSYW5nZXM6IHByb3BzLnZpc2libGVSYW5nZXMsXG5cdFx0XHRlZGl0b3JQb3NpdGlvbjogdGhpcy5fZmluZEVkaXRvclBvc2l0aW9uKHRleHRFZGl0b3IpXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgX2ZpbmRFZGl0b3JQb3NpdGlvbihlZGl0b3I6IE1haW5UaHJlYWRUZXh0RWRpdG9yKTogRWRpdG9yR3JvdXBDb2x1bW4gfCB1bmRlZmluZWQge1xuXHRcdGZvciAoY29uc3QgZWRpdG9yUGFuZSBvZiB0aGlzLl9lZGl0b3JTZXJ2aWNlLnZpc2libGVFZGl0b3JQYW5lcykge1xuXHRcdFx0aWYgKGVkaXRvci5tYXRjaGVzKGVkaXRvclBhbmUpKSB7XG5cdFx0XHRcdHJldHVybiBlZGl0b3JHcm91cFRvQ29sdW1uKHRoaXMuX2VkaXRvckdyb3VwU2VydmljZSwgZWRpdG9yUGFuZS5ncm91cCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRmaW5kVGV4dEVkaXRvcklkRm9yKGVkaXRvclBhbmU6IElFZGl0b3JQYW5lKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRmb3IgKGNvbnN0IFtpZCwgZWRpdG9yXSBvZiB0aGlzLl90ZXh0RWRpdG9ycykge1xuXHRcdFx0aWYgKGVkaXRvci5tYXRjaGVzKGVkaXRvclBhbmUpKSB7XG5cdFx0XHRcdHJldHVybiBpZDtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGdldElkT2ZDb2RlRWRpdG9yKGNvZGVFZGl0b3I6IElDb2RlRWRpdG9yKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRmb3IgKGNvbnN0IFtpZCwgZWRpdG9yXSBvZiB0aGlzLl90ZXh0RWRpdG9ycykge1xuXHRcdFx0aWYgKGVkaXRvci5nZXRDb2RlRWRpdG9yKCkgPT09IGNvZGVFZGl0b3IpIHtcblx0XHRcdFx0cmV0dXJuIGlkO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0Z2V0RWRpdG9yKGlkOiBzdHJpbmcpOiBNYWluVGhyZWFkVGV4dEVkaXRvciB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX3Rl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QUssTUFBTTtBQUFBLE1BQ1gsV0FBVyxNQUFNLGFBQWE7QUFBQSxNQUM5QixPQUFPLE1BQU0sZ0JBQWdCO0FBQUEsTUFDN0IsS0FBSyxNQUFNLE9BQU87QUFBQSxNQUNsQixZQUFZLE1BQU0sY0FBYztBQUFBLE1BQ2hDLFNBQVMsS0FBSyxpQkFBaUIsUUFBUSxNQUFNLEdBQUc7QUFBQSxNQUNoRCxVQUFVLEtBQUssaUJBQWlCLFlBQVksTUFBTSxHQUFHO0FBQUEsSUFDdEQ7QUFBQSxFQUNEO0FBQUEsRUFFUSxxQkFBcUIsWUFBc0Q7QUFDbEYsVUFBTSxRQUFRLFdBQVcsY0FBYztBQUN2QyxXQUFPO0FBQUEsTUFDTixJQUFJLFdBQVcsTUFBTTtBQUFBLE1BQ3JCLGFBQWEsV0FBVyxTQUFTLEVBQUU7QUFBQSxNQUNuQyxTQUFTLE1BQU07QUFBQSxNQUNmLFlBQVksTUFBTTtBQUFBLE1BQ2xCLGVBQWUsTUFBTTtBQUFBLE1BQ3JCLGdCQUFnQixLQUFLLG9CQUFvQixVQUFVO0FBQUEsSUFDcEQ7QUFBQSxFQUNEO0FBQUEsRUFFUSxvQkFBb0IsUUFBNkQ7QUFDeEYsZUFBVyxjQUFjLEtBQUssZUFBZSxvQkFBb0I7QUFDaEUsVUFBSSxPQUFPLFFBQVEsVUFBVSxHQUFHO0FBQy9CLGVBQU8sb0JBQW9CLEtBQUsscUJBQXFCLFdBQVcsS0FBSztBQUFBLE1BQ3RFO0FBQUEsSUFDRDtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxvQkFBb0IsWUFBNkM7QUFDaEUsZUFBVyxDQUFDLElBQUksTUFBTSxLQUFLLEtBQUssY0FBYztBQUM3QyxVQUFJLE9BQU8sUUFBUSxVQUFVLEdBQUc7QUFDL0IsZUFBTztBQUFBLE1BQ1I7QUFBQSxJQUNEO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLGtCQUFrQixZQUE2QztBQUM5RCxlQUFXLENBQUMsSUFBSSxNQUFNLEtBQUssS0FBSyxjQUFjO0FBQzdDLFVBQUksT0FBTyxjQUFjLE1BQU0sWUFBWTtBQUMxQyxlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0Q7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsVUFBVSxJQUE4QztBQUN2RCxXQUFPLEtBQUssYUFBYSxJQUFJLEVBQUU7QUFBQSxFQUNoQztBQUNEO0FBL0phLGdDQUFOO0FBQUEsRUFETjtBQUFBLEVBV0U7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBeEJVOyIsCiAgIm5hbWVzIjogWyJBY3RpdmVFZGl0b3JPcmRlciJdCn0K
