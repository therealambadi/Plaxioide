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
import { assert } from "../../../../../base/common/assert.js";
import { RunOnceScheduler } from "../../../../../base/common/async.js";
import { MutableDisposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { observableValue, autorun, transaction } from "../../../../../base/common/observable.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { themeColorFromId } from "../../../../../base/common/themables.js";
import { assertType } from "../../../../../base/common/types.js";
import { getCodeEditor } from "../../../../../editor/browser/editorBrowser.js";
import { EditOperation } from "../../../../../editor/common/core/editOperation.js";
import { OffsetEdit } from "../../../../../editor/common/core/offsetEdit.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { nullDocumentDiff } from "../../../../../editor/common/diff/documentDiffProvider.js";
import { TextEdit } from "../../../../../editor/common/languages.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { OverviewRulerLane, MinimapPosition } from "../../../../../editor/common/model.js";
import { SingleModelEditStackElement } from "../../../../../editor/common/model/editStack.js";
import { ModelDecorationOptions, createTextBufferFactoryFromSnapshot } from "../../../../../editor/common/model/textModel.js";
import { OffsetEdits } from "../../../../../editor/common/model/textModelOffsetEdit.js";
import { IEditorWorkerService } from "../../../../../editor/common/services/editorWorker.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { localize } from "../../../../../nls.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IMarkerService } from "../../../../../platform/markers/common/markers.js";
import { observableConfigValue } from "../../../../../platform/observable/common/platformObservableUtils.js";
import { editorSelectionBackground } from "../../../../../platform/theme/common/colorRegistry.js";
import { IUndoRedoService } from "../../../../../platform/undoRedo/common/undoRedo.js";
import { SaveReason } from "../../../../common/editor.js";
import { IFilesConfigurationService } from "../../../../services/filesConfiguration/common/filesConfigurationService.js";
import { ITextFileService, stringToSnapshot } from "../../../../services/textfile/common/textfiles.js";
import { WorkingSetEntryState } from "../../common/chatEditingService.js";
import { IChatService } from "../../common/chatService.js";
import { ChatEditingCodeEditorIntegration } from "./chatEditingCodeEditorIntegration.js";
import { AbstractChatEditingModifiedFileEntry, pendingRewriteMinimap } from "./chatEditingModifiedFileEntry.js";
import { ChatEditingSnapshotTextModelContentProvider, ChatEditingTextModelContentProvider } from "./chatEditingTextModelContentProviders.js";
let ChatEditingModifiedDocumentEntry = class extends AbstractChatEditingModifiedFileEntry {
  constructor(resourceRef, _multiDiffEntryDelegate, telemetryInfo, kind, initialContent, markerService, modelService, textModelService, languageService, configService, fileConfigService, chatService, _editorWorkerService, _textFileService, fileService, undoRedoService, instantiationService, _accessibilitySignalService) {
    super(
      resourceRef.object.textEditorModel.uri,
      telemetryInfo,
      kind,
      configService,
      fileConfigService,
      chatService,
      fileService,
      undoRedoService,
      instantiationService
    );
    this._multiDiffEntryDelegate = _multiDiffEntryDelegate;
    this._editorWorkerService = _editorWorkerService;
    this._textFileService = _textFileService;
    this._accessibilitySignalService = _accessibilitySignalService;
    this._edit = OffsetEdit.empty;
    this._isEditFromUs = false;
    this._allEditsAreFromUs = true;
    this._diffOperationIds = 0;
    this._diffInfo = observableValue(this, nullDocumentDiff);
    this.changesCount = this._diffInfo.map((diff) => diff.changes.length);
    this._editDecorationClear = this._register(new RunOnceScheduler(() => {
      this._editDecorations = this.modifiedModel.deltaDecorations(this._editDecorations, []);
    }, 500));
    this._editDecorations = [];
    this.docFileEditorModel = this._register(resourceRef).object;
    this.modifiedModel = resourceRef.object.textEditorModel;
    this.originalURI = ChatEditingTextModelContentProvider.getFileURI(telemetryInfo.sessionId, this.entryId, this.modifiedURI.path);
    this.initialContent = initialContent ?? this.modifiedModel.getValue();
    const docSnapshot = this.originalModel = this._register(
      modelService.createModel(
        createTextBufferFactoryFromSnapshot(initialContent ? stringToSnapshot(initialContent) : this.modifiedModel.createSnapshot()),
        languageService.createById(this.modifiedModel.getLanguageId()),
        this.originalURI,
        false
      )
    );
    (async () => {
      const reference = await textModelService.createModelReference(docSnapshot.uri);
      if (this._store.isDisposed) {
        reference.dispose();
        return;
      }
      this._register(reference);
    })();
    this._register(this.modifiedModel.onDidChangeContent((e) => this._mirrorEdits(e)));
    this._register(toDisposable(() => {
      this._clearCurrentEditLineDecoration();
    }));
    this._diffTrimWhitespace = observableConfigValue("diffEditor.ignoreTrimWhitespace", true, configService);
    this._register(autorun((r) => {
      this._diffTrimWhitespace.read(r);
      this._updateDiffInfoSeq();
    }));
    const resourceFilter = this._register(new MutableDisposable());
    this._register(autorun((r) => {
      const res = this.isCurrentlyBeingModifiedBy.read(r);
      if (res) {
        const req = res.session.getRequests().find((value) => value.id === res.requestId);
        resourceFilter.value = markerService.installResourceFilter(this.modifiedURI, req?.message.text || localize("default", "Chat Edits"));
      } else {
        resourceFilter.clear();
      }
    }));
  }
  _clearCurrentEditLineDecoration() {
    this._editDecorations = this.modifiedModel.deltaDecorations(this._editDecorations, []);
  }
  equalsSnapshot(snapshot) {
    return !!snapshot && this.modifiedURI.toString() === snapshot.resource.toString() && this.modifiedModel.getLanguageId() === snapshot.languageId && this.originalModel.getValue() === snapshot.original && this.modifiedModel.getValue() === snapshot.current && this._edit.equals(snapshot.originalToCurrentEdit) && this.state.get() === snapshot.state;
  }
  createSnapshot(requestId, undoStop) {
    return {
      resource: this.modifiedURI,
      languageId: this.modifiedModel.getLanguageId(),
      snapshotUri: ChatEditingSnapshotTextModelContentProvider.getSnapshotFileURI(this._telemetryInfo.sessionId, requestId, undoStop, this.modifiedURI.path),
      original: this.originalModel.getValue(),
      current: this.modifiedModel.getValue(),
      originalToCurrentEdit: this._edit,
      state: this.state.get(),
      telemetryInfo: this._telemetryInfo
    };
  }
  restoreFromSnapshot(snapshot, restoreToDisk = true) {
    this._stateObs.set(snapshot.state, void 0);
    this.originalModel.setValue(snapshot.original);
    if (restoreToDisk) {
      this._setDocValue(snapshot.current);
    }
    this._edit = snapshot.originalToCurrentEdit;
    this._updateDiffInfoSeq();
  }
  resetToInitialContent() {
    this._setDocValue(this.initialContent);
  }
  async _areOriginalAndModifiedIdentical() {
    const diff = await this._diffOperation;
    return diff ? diff.identical : false;
  }
  _resetEditsState(tx) {
    super._resetEditsState(tx);
    this._clearCurrentEditLineDecoration();
  }
  _mirrorEdits(event) {
    const edit = OffsetEdits.fromContentChanges(event.changes);
    if (this._isEditFromUs) {
      const e_sum = this._edit;
      const e_ai = edit;
      this._edit = e_sum.compose(e_ai);
    } else {
      const e_ai = this._edit;
      const e_user = edit;
      const e_user_r = e_user.tryRebase(e_ai.inverse(this.originalModel.getValue()), true);
      if (e_user_r === void 0) {
        this._edit = e_ai.compose(e_user);
      } else {
        const edits = OffsetEdits.asEditOperations(e_user_r, this.originalModel);
        this.originalModel.applyEdits(edits);
        this._edit = e_ai.tryRebase(e_user_r);
      }
      this._allEditsAreFromUs = false;
      this._updateDiffInfoSeq();
      const didResetToOriginalContent = this.modifiedModel.getValue() === this.initialContent;
      const currentState = this._stateObs.get();
      switch (currentState) {
        case WorkingSetEntryState.Modified:
          if (didResetToOriginalContent) {
            this._stateObs.set(WorkingSetEntryState.Rejected, void 0);
            break;
          }
      }
    }
  }
  _createUndoRedoElement(response) {
    const request = response.session.getRequests().find((req) => req.id === response.requestId);
    const label = request?.message.text ? localize("chatEditing1", "Chat Edit: '{0}'", request.message.text) : localize("chatEditing2", "Chat Edit");
    return new SingleModelEditStackElement(label, "chat.edit", this.modifiedModel, null);
  }
  async acceptAgentEdits(resource, textEdits, isLastEdits, responseModel) {
    assertType(textEdits.every(TextEdit.isTextEdit), "INVALID args, can only handle text edits");
    assert(isEqual(resource, this.modifiedURI), " INVALID args, can only edit THIS document");
    const ops = textEdits.map(TextEdit.asEditOperation);
    const undoEdits = this._applyEdits(ops);
    const maxLineNumber = undoEdits.reduce((max, op) => Math.max(max, op.range.startLineNumber), 0);
    const newDecorations = [
      // decorate pending edit (region)
      {
        options: ChatEditingModifiedDocumentEntry._pendingEditDecorationOptions,
        range: new Range(maxLineNumber + 1, 1, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
      }
    ];
    if (maxLineNumber > 0) {
      newDecorations.push({
        options: ChatEditingModifiedDocumentEntry._lastEditDecorationOptions,
        range: new Range(maxLineNumber, 1, maxLineNumber, Number.MAX_SAFE_INTEGER)
      });
    }
    this._editDecorations = this.modifiedModel.deltaDecorations(this._editDecorations, newDecorations);
    transaction((tx) => {
      if (!isLastEdits) {
        this._stateObs.set(WorkingSetEntryState.Modified, tx);
        this._isCurrentlyBeingModifiedByObs.set(responseModel, tx);
        const lineCount = this.modifiedModel.getLineCount();
        this._rewriteRatioObs.set(Math.min(1, maxLineNumber / lineCount), tx);
      } else {
        this._resetEditsState(tx);
        this._updateDiffInfoSeq();
        this._rewriteRatioObs.set(1, tx);
        this._editDecorationClear.schedule();
      }
    });
  }
  async _acceptHunk(change) {
    if (!this._diffInfo.get().changes.includes(change)) {
      return false;
    }
    const edits = [];
    for (const edit of change.innerChanges ?? []) {
      const newText = this.modifiedModel.getValueInRange(edit.modifiedRange);
      edits.push(EditOperation.replace(edit.originalRange, newText));
    }
    this.originalModel.pushEditOperations(null, edits, (_) => null);
    await this._updateDiffInfoSeq();
    if (this._diffInfo.get().identical) {
      this._stateObs.set(WorkingSetEntryState.Accepted, void 0);
    }
    this._accessibilitySignalService.playSignal(AccessibilitySignal.editsKept, { allowManyInParallel: true });
    return true;
  }
  async _rejectHunk(change) {
    if (!this._diffInfo.get().changes.includes(change)) {
      return false;
    }
    const edits = [];
    for (const edit of change.innerChanges ?? []) {
      const newText = this.originalModel.getValueInRange(edit.originalRange);
      edits.push(EditOperation.replace(edit.modifiedRange, newText));
    }
    this.modifiedModel.pushEditOperations(null, edits, (_) => null);
    await this._updateDiffInfoSeq();
    if (this._diffInfo.get().identical) {
      this._stateObs.set(WorkingSetEntryState.Rejected, void 0);
    }
    this._accessibilitySignalService.playSignal(AccessibilitySignal.editsUndone, { allowManyInParallel: true });
    return true;
  }
  _applyEdits(edits) {
    this._isEditFromUs = true;
    try {
      let result = [];
      this.modifiedModel.pushEditOperations(null, edits, (undoEdits) => {
        result = undoEdits;
        return null;
      });
      return result;
    } finally {
      this._isEditFromUs = false;
    }
  }
  async _updateDiffInfoSeq() {
    const myDiffOperationId = ++this._diffOperationIds;
    await Promise.resolve(this._diffOperation);
    if (this._diffOperationIds === myDiffOperationId) {
      const thisDiffOperation = this._updateDiffInfo();
      this._diffOperation = thisDiffOperation;
      await thisDiffOperation;
    }
  }
  async _updateDiffInfo() {
    if (this.originalModel.isDisposed() || this.modifiedModel.isDisposed()) {
      return void 0;
    }
    const docVersionNow = this.modifiedModel.getVersionId();
    const snapshotVersionNow = this.originalModel.getVersionId();
    const ignoreTrimWhitespace = this._diffTrimWhitespace.get();
    const diff = await this._editorWorkerService.computeDiff(
      this.originalModel.uri,
      this.modifiedModel.uri,
      { ignoreTrimWhitespace, computeMoves: false, maxComputationTimeMs: 3e3 },
      "advanced"
    );
    if (this.originalModel.isDisposed() || this.modifiedModel.isDisposed()) {
      return void 0;
    }
    if (this.modifiedModel.getVersionId() === docVersionNow && this.originalModel.getVersionId() === snapshotVersionNow) {
      const diff2 = diff ?? nullDocumentDiff;
      this._diffInfo.set(diff2, void 0);
      this._edit = OffsetEdits.fromLineRangeMapping(this.originalModel, this.modifiedModel, diff2.changes);
      return diff2;
    }
    return void 0;
  }
  async _doAccept(tx) {
    this.originalModel.setValue(this.modifiedModel.createSnapshot());
    this._diffInfo.set(nullDocumentDiff, tx);
    this._edit = OffsetEdit.empty;
    await this._collapse(tx);
    const config = this._fileConfigService.getAutoSaveConfiguration(this.modifiedURI);
    if (!config.autoSave || !this._textFileService.isDirty(this.modifiedURI)) {
      try {
        await this._textFileService.save(this.modifiedURI, {
          reason: SaveReason.EXPLICIT,
          force: true,
          ignoreErrorHandler: true
        });
      } catch {
      }
    }
  }
  async _doReject(tx) {
    if (this.createdInRequestId === this._telemetryInfo.requestId) {
      await this.docFileEditorModel.revert({ soft: true });
      await this._fileService.del(this.modifiedURI);
      this._onDidDelete.fire();
    } else {
      this._setDocValue(this.originalModel.getValue());
      if (this._allEditsAreFromUs) {
        await this.docFileEditorModel.save({ reason: SaveReason.EXPLICIT, skipSaveParticipants: true });
      }
      await this._collapse(tx);
    }
  }
  _setDocValue(value) {
    if (this.modifiedModel.getValue() !== value) {
      this.modifiedModel.pushStackElement();
      const edit = EditOperation.replace(this.modifiedModel.getFullModelRange(), value);
      this._applyEdits([edit]);
      this._updateDiffInfoSeq();
      this.modifiedModel.pushStackElement();
    }
  }
  async _collapse(transaction2) {
    this._multiDiffEntryDelegate.collapse(transaction2);
  }
  _createEditorIntegration(editor) {
    const codeEditor = getCodeEditor(editor.getControl());
    assertType(codeEditor);
    const diffInfo = this._diffInfo.map((value) => {
      return {
        ...value,
        originalModel: this.originalModel,
        modifiedModel: this.modifiedModel,
        keep: (changes) => this._acceptHunk(changes),
        undo: (changes) => this._rejectHunk(changes)
      };
    });
    return this._instantiationService.createInstance(ChatEditingCodeEditorIntegration, this, codeEditor, diffInfo);
  }
};
ChatEditingModifiedDocumentEntry._lastEditDecorationOptions = ModelDecorationOptions.register({
  isWholeLine: true,
  description: "chat-last-edit",
  className: "chat-editing-last-edit-line",
  marginClassName: "chat-editing-last-edit",
  overviewRuler: {
    position: OverviewRulerLane.Full,
    color: themeColorFromId(editorSelectionBackground)
  }
});
ChatEditingModifiedDocumentEntry._pendingEditDecorationOptions = ModelDecorationOptions.register({
  isWholeLine: true,
  description: "chat-pending-edit",
  className: "chat-editing-pending-edit",
  minimap: {
    position: MinimapPosition.Inline,
    color: themeColorFromId(pendingRewriteMinimap)
  }
});
ChatEditingModifiedDocumentEntry = __decorateClass([
  __decorateParam(5, IMarkerService),
  __decorateParam(6, IModelService),
  __decorateParam(7, ITextModelService),
  __decorateParam(8, ILanguageService),
  __decorateParam(9, IConfigurationService),
  __decorateParam(10, IFilesConfigurationService),
  __decorateParam(11, IChatService),
  __decorateParam(12, IEditorWorkerService),
  __decorateParam(13, ITextFileService),
  __decorateParam(14, IFileService),
  __decorateParam(15, IUndoRedoService),
  __decorateParam(16, IInstantiationService),
  __decorateParam(17, IAccessibilitySignalService)
], ChatEditingModifiedDocumentEntry);
export {
  ChatEditingModifiedDocumentEntry
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdEVkaXRpbmcvY2hhdEVkaXRpbmdNb2RpZmllZERvY3VtZW50RW50cnkudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBhc3NlcnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3NlcnQuanMnO1xuaW1wb3J0IHsgUnVuT25jZVNjaGVkdWxlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IElSZWZlcmVuY2UsIE11dGFibGVEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgb2JzZXJ2YWJsZVZhbHVlLCBJT2JzZXJ2YWJsZSwgSVRyYW5zYWN0aW9uLCBhdXRvcnVuLCB0cmFuc2FjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgaXNFcXVhbCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyB0aGVtZUNvbG9yRnJvbUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IGFzc2VydFR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZ2V0Q29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgSVNpbmdsZUVkaXRPcGVyYXRpb24sIEVkaXRPcGVyYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvZWRpdE9wZXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBPZmZzZXRFZGl0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL29mZnNldEVkaXQuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgSURvY3VtZW50RGlmZiwgbnVsbERvY3VtZW50RGlmZiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vZGlmZi9kb2N1bWVudERpZmZQcm92aWRlci5qcyc7XG5pbXBvcnQgeyBEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2RpZmYvcmFuZ2VNYXBwaW5nLmpzJztcbmltcG9ydCB7IFRleHRFZGl0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IE92ZXJ2aWV3UnVsZXJMYW5lLCBNaW5pbWFwUG9zaXRpb24sIElUZXh0TW9kZWwsIElNb2RlbERlbHRhRGVjb3JhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgU2luZ2xlTW9kZWxFZGl0U3RhY2tFbGVtZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC9lZGl0U3RhY2suanMnO1xuaW1wb3J0IHsgTW9kZWxEZWNvcmF0aW9uT3B0aW9ucywgY3JlYXRlVGV4dEJ1ZmZlckZhY3RvcnlGcm9tU25hcHNob3QgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsL3RleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBPZmZzZXRFZGl0cyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwvdGV4dE1vZGVsT2Zmc2V0RWRpdC5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yV29ya2VyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvZWRpdG9yV29ya2VyLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IElSZXNvbHZlZFRleHRFZGl0b3JNb2RlbCwgSVRleHRNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3Jlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTW9kZWxDb250ZW50Q2hhbmdlZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi90ZXh0TW9kZWxFdmVudHMuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQWNjZXNzaWJpbGl0eVNpZ25hbCwgSUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eVNpZ25hbC9icm93c2VyL2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSU1hcmtlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9tYXJrZXJzL2NvbW1vbi9tYXJrZXJzLmpzJztcbmltcG9ydCB7IG9ic2VydmFibGVDb25maWdWYWx1ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL29ic2VydmFibGUvY29tbW9uL3BsYXRmb3JtT2JzZXJ2YWJsZVV0aWxzLmpzJztcbmltcG9ydCB7IGVkaXRvclNlbGVjdGlvbkJhY2tncm91bmQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJVW5kb1JlZG9FbGVtZW50LCBJVW5kb1JlZG9TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdW5kb1JlZG8vY29tbW9uL3VuZG9SZWRvLmpzJztcbmltcG9ydCB7IFNhdmVSZWFzb24sIElFZGl0b3JQYW5lIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJRmlsZXNDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2ZpbGVzQ29uZmlndXJhdGlvbi9jb21tb24vZmlsZXNDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUmVzb2x2ZWRUZXh0RmlsZUVkaXRvck1vZGVsLCBJVGV4dEZpbGVTZXJ2aWNlLCBzdHJpbmdUb1NuYXBzaG90IH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvdGV4dGZpbGUvY29tbW9uL3RleHRmaWxlcy5qcyc7XG5pbXBvcnQgeyBJQ2VsbEVkaXRPcGVyYXRpb24gfSBmcm9tICcuLi8uLi8uLi9ub3RlYm9vay9jb21tb24vbm90ZWJvb2tDb21tb24uanMnO1xuaW1wb3J0IHsgSU1vZGlmaWVkRmlsZUVudHJ5LCBDaGF0RWRpdEtpbmQsIFdvcmtpbmdTZXRFbnRyeVN0YXRlLCBJTW9kaWZpZWRGaWxlRW50cnlFZGl0b3JJbnRlZ3JhdGlvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0RWRpdGluZ1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNoYXRSZXNwb25zZU1vZGVsIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRNb2RlbC5qcyc7XG5pbXBvcnQgeyBJQ2hhdFNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ2hhdEVkaXRpbmdDb2RlRWRpdG9ySW50ZWdyYXRpb24sIElEb2N1bWVudERpZmYyIH0gZnJvbSAnLi9jaGF0RWRpdGluZ0NvZGVFZGl0b3JJbnRlZ3JhdGlvbi5qcyc7XG5pbXBvcnQgeyBBYnN0cmFjdENoYXRFZGl0aW5nTW9kaWZpZWRGaWxlRW50cnksIHBlbmRpbmdSZXdyaXRlTWluaW1hcCwgSU1vZGlmaWVkRW50cnlUZWxlbWV0cnlJbmZvLCBJU25hcHNob3RFbnRyeSB9IGZyb20gJy4vY2hhdEVkaXRpbmdNb2RpZmllZEZpbGVFbnRyeS5qcyc7XG5pbXBvcnQgeyBDaGF0RWRpdGluZ1NuYXBzaG90VGV4dE1vZGVsQ29udGVudFByb3ZpZGVyLCBDaGF0RWRpdGluZ1RleHRNb2RlbENvbnRlbnRQcm92aWRlciB9IGZyb20gJy4vY2hhdEVkaXRpbmdUZXh0TW9kZWxDb250ZW50UHJvdmlkZXJzLmpzJztcblxuXG5leHBvcnQgY2xhc3MgQ2hhdEVkaXRpbmdNb2RpZmllZERvY3VtZW50RW50cnkgZXh0ZW5kcyBBYnN0cmFjdENoYXRFZGl0aW5nTW9kaWZpZWRGaWxlRW50cnkgaW1wbGVtZW50cyBJTW9kaWZpZWRGaWxlRW50cnkge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IF9sYXN0RWRpdERlY29yYXRpb25PcHRpb25zID0gTW9kZWxEZWNvcmF0aW9uT3B0aW9ucy5yZWdpc3Rlcih7XG5cdFx0aXNXaG9sZUxpbmU6IHRydWUsXG5cdFx0ZGVzY3JpcHRpb246ICdjaGF0LWxhc3QtZWRpdCcsXG5cdFx0Y2xhc3NOYW1lOiAnY2hhdC1lZGl0aW5nLWxhc3QtZWRpdC1saW5lJyxcblx0XHRtYXJnaW5DbGFzc05hbWU6ICdjaGF0LWVkaXRpbmctbGFzdC1lZGl0Jyxcblx0XHRvdmVydmlld1J1bGVyOiB7XG5cdFx0XHRwb3NpdGlvbjogT3ZlcnZpZXdSdWxlckxhbmUuRnVsbCxcblx0XHRcdGNvbG9yOiB0aGVtZUNvbG9yRnJvbUlkKGVkaXRvclNlbGVjdGlvbkJhY2tncm91bmQpXG5cdFx0fSxcblx0fSk7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgX3BlbmRpbmdFZGl0RGVjb3JhdGlvbk9wdGlvbnMgPSBNb2RlbERlY29yYXRpb25PcHRpb25zLnJlZ2lzdGVyKHtcblx0XHRpc1dob2xlTGluZTogdHJ1ZSxcblx0XHRkZXNjcmlwdGlvbjogJ2NoYXQtcGVuZGluZy1lZGl0Jyxcblx0XHRjbGFzc05hbWU6ICdjaGF0LWVkaXRpbmctcGVuZGluZy1lZGl0Jyxcblx0XHRtaW5pbWFwOiB7XG5cdFx0XHRwb3NpdGlvbjogTWluaW1hcFBvc2l0aW9uLklubGluZSxcblx0XHRcdGNvbG9yOiB0aGVtZUNvbG9yRnJvbUlkKHBlbmRpbmdSZXdyaXRlTWluaW1hcClcblx0XHR9XG5cdH0pO1xuXG5cdHJlYWRvbmx5IGluaXRpYWxDb250ZW50OiBzdHJpbmc7XG5cblx0cHJpdmF0ZSByZWFkb25seSBvcmlnaW5hbE1vZGVsOiBJVGV4dE1vZGVsO1xuXHRwcml2YXRlIHJlYWRvbmx5IG1vZGlmaWVkTW9kZWw6IElUZXh0TW9kZWw7XG5cblx0cmVhZG9ubHkgZG9jRmlsZUVkaXRvck1vZGVsOiBJUmVzb2x2ZWRUZXh0RmlsZUVkaXRvck1vZGVsO1xuXG5cdHByaXZhdGUgX2VkaXQ6IE9mZnNldEVkaXQgPSBPZmZzZXRFZGl0LmVtcHR5O1xuXHRwcml2YXRlIF9pc0VkaXRGcm9tVXM6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBfYWxsRWRpdHNBcmVGcm9tVXM6IGJvb2xlYW4gPSB0cnVlO1xuXHRwcml2YXRlIF9kaWZmT3BlcmF0aW9uOiBQcm9taXNlPElEb2N1bWVudERpZmYgfCB1bmRlZmluZWQ+IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9kaWZmT3BlcmF0aW9uSWRzOiBudW1iZXIgPSAwO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2RpZmZJbmZvID0gb2JzZXJ2YWJsZVZhbHVlPElEb2N1bWVudERpZmY+KHRoaXMsIG51bGxEb2N1bWVudERpZmYpO1xuXG5cdHJlYWRvbmx5IGNoYW5nZXNDb3VudCA9IHRoaXMuX2RpZmZJbmZvLm1hcChkaWZmID0+IGRpZmYuY2hhbmdlcy5sZW5ndGgpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2VkaXREZWNvcmF0aW9uQ2xlYXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB7IHRoaXMuX2VkaXREZWNvcmF0aW9ucyA9IHRoaXMubW9kaWZpZWRNb2RlbC5kZWx0YURlY29yYXRpb25zKHRoaXMuX2VkaXREZWNvcmF0aW9ucywgW10pOyB9LCA1MDApKTtcblx0cHJpdmF0ZSBfZWRpdERlY29yYXRpb25zOiBzdHJpbmdbXSA9IFtdO1xuXG5cblx0cHJpdmF0ZSByZWFkb25seSBfZGlmZlRyaW1XaGl0ZXNwYWNlOiBJT2JzZXJ2YWJsZTxib29sZWFuPjtcblxuXHRyZWFkb25seSBvcmlnaW5hbFVSSTogVVJJO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlc291cmNlUmVmOiBJUmVmZXJlbmNlPElSZXNvbHZlZFRleHRFZGl0b3JNb2RlbD4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbXVsdGlEaWZmRW50cnlEZWxlZ2F0ZTogeyBjb2xsYXBzZTogKHRyYW5zYWN0aW9uOiBJVHJhbnNhY3Rpb24gfCB1bmRlZmluZWQpID0+IHZvaWQgfSxcblx0XHR0ZWxlbWV0cnlJbmZvOiBJTW9kaWZpZWRFbnRyeVRlbGVtZXRyeUluZm8sXG5cdFx0a2luZDogQ2hhdEVkaXRLaW5kLFxuXHRcdGluaXRpYWxDb250ZW50OiBzdHJpbmcgfCB1bmRlZmluZWQsXG5cdFx0QElNYXJrZXJTZXJ2aWNlIG1hcmtlclNlcnZpY2U6IElNYXJrZXJTZXJ2aWNlLFxuXHRcdEBJTW9kZWxTZXJ2aWNlIG1vZGVsU2VydmljZTogSU1vZGVsU2VydmljZSxcblx0XHRASVRleHRNb2RlbFNlcnZpY2UgdGV4dE1vZGVsU2VydmljZTogSVRleHRNb2RlbFNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZVNlcnZpY2UgbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlnU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJRmlsZXNDb25maWd1cmF0aW9uU2VydmljZSBmaWxlQ29uZmlnU2VydmljZTogSUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElDaGF0U2VydmljZSBjaGF0U2VydmljZTogSUNoYXRTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yV29ya2VyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JXb3JrZXJTZXJ2aWNlOiBJRWRpdG9yV29ya2VyU2VydmljZSxcblx0XHRASVRleHRGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZXh0RmlsZVNlcnZpY2U6IElUZXh0RmlsZVNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJVW5kb1JlZG9TZXJ2aWNlIHVuZG9SZWRvU2VydmljZTogSVVuZG9SZWRvU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElBY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9hY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZTogSUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihcblx0XHRcdHJlc291cmNlUmVmLm9iamVjdC50ZXh0RWRpdG9yTW9kZWwudXJpLFxuXHRcdFx0dGVsZW1ldHJ5SW5mbyxcblx0XHRcdGtpbmQsXG5cdFx0XHRjb25maWdTZXJ2aWNlLFxuXHRcdFx0ZmlsZUNvbmZpZ1NlcnZpY2UsXG5cdFx0XHRjaGF0U2VydmljZSxcblx0XHRcdGZpbGVTZXJ2aWNlLFxuXHRcdFx0dW5kb1JlZG9TZXJ2aWNlLFxuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Vcblx0XHQpO1xuXG5cdFx0dGhpcy5kb2NGaWxlRWRpdG9yTW9kZWwgPSB0aGlzLl9yZWdpc3RlcihyZXNvdXJjZVJlZikub2JqZWN0IGFzIElSZXNvbHZlZFRleHRGaWxlRWRpdG9yTW9kZWw7XG5cdFx0dGhpcy5tb2RpZmllZE1vZGVsID0gcmVzb3VyY2VSZWYub2JqZWN0LnRleHRFZGl0b3JNb2RlbDtcblx0XHR0aGlzLm9yaWdpbmFsVVJJID0gQ2hhdEVkaXRpbmdUZXh0TW9kZWxDb250ZW50UHJvdmlkZXIuZ2V0RmlsZVVSSSh0ZWxlbWV0cnlJbmZvLnNlc3Npb25JZCwgdGhpcy5lbnRyeUlkLCB0aGlzLm1vZGlmaWVkVVJJLnBhdGgpO1xuXG5cdFx0dGhpcy5pbml0aWFsQ29udGVudCA9IGluaXRpYWxDb250ZW50ID8/IHRoaXMubW9kaWZpZWRNb2RlbC5nZXRWYWx1ZSgpO1xuXHRcdGNvbnN0IGRvY1NuYXBzaG90ID0gdGhpcy5vcmlnaW5hbE1vZGVsID0gdGhpcy5fcmVnaXN0ZXIoXG5cdFx0XHRtb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWwoXG5cdFx0XHRcdGNyZWF0ZVRleHRCdWZmZXJGYWN0b3J5RnJvbVNuYXBzaG90KGluaXRpYWxDb250ZW50ID8gc3RyaW5nVG9TbmFwc2hvdChpbml0aWFsQ29udGVudCkgOiB0aGlzLm1vZGlmaWVkTW9kZWwuY3JlYXRlU25hcHNob3QoKSksXG5cdFx0XHRcdGxhbmd1YWdlU2VydmljZS5jcmVhdGVCeUlkKHRoaXMubW9kaWZpZWRNb2RlbC5nZXRMYW5ndWFnZUlkKCkpLFxuXHRcdFx0XHR0aGlzLm9yaWdpbmFsVVJJLFxuXHRcdFx0XHRmYWxzZVxuXHRcdFx0KVxuXHRcdCk7XG5cblx0XHQvLyBDcmVhdGUgYSByZWZlcmVuY2UgdG8gdGhpcyBtb2RlbCB0byBhdm9pZCBpdCBiZWluZyBkaXNwb3NlZCBmcm9tIHVuZGVyIG91ciBub3NlXG5cdFx0KGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHJlZmVyZW5jZSA9IGF3YWl0IHRleHRNb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWxSZWZlcmVuY2UoZG9jU25hcHNob3QudXJpKTtcblx0XHRcdGlmICh0aGlzLl9zdG9yZS5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRcdHJlZmVyZW5jZS5kaXNwb3NlKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHJlZmVyZW5jZSk7XG5cdFx0fSkoKTtcblxuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5tb2RpZmllZE1vZGVsLm9uRGlkQ2hhbmdlQ29udGVudChlID0+IHRoaXMuX21pcnJvckVkaXRzKGUpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0dGhpcy5fY2xlYXJDdXJyZW50RWRpdExpbmVEZWNvcmF0aW9uKCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fZGlmZlRyaW1XaGl0ZXNwYWNlID0gb2JzZXJ2YWJsZUNvbmZpZ1ZhbHVlKCdkaWZmRWRpdG9yLmlnbm9yZVRyaW1XaGl0ZXNwYWNlJywgdHJ1ZSwgY29uZmlnU2VydmljZSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bihyID0+IHtcblx0XHRcdHRoaXMuX2RpZmZUcmltV2hpdGVzcGFjZS5yZWFkKHIpO1xuXHRcdFx0dGhpcy5fdXBkYXRlRGlmZkluZm9TZXEoKTtcblx0XHR9KSk7XG5cblx0XHRjb25zdCByZXNvdXJjZUZpbHRlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKHIgPT4ge1xuXHRcdFx0Y29uc3QgcmVzID0gdGhpcy5pc0N1cnJlbnRseUJlaW5nTW9kaWZpZWRCeS5yZWFkKHIpO1xuXHRcdFx0aWYgKHJlcykge1xuXHRcdFx0XHRjb25zdCByZXEgPSByZXMuc2Vzc2lvbi5nZXRSZXF1ZXN0cygpLmZpbmQodmFsdWUgPT4gdmFsdWUuaWQgPT09IHJlcy5yZXF1ZXN0SWQpO1xuXHRcdFx0XHRyZXNvdXJjZUZpbHRlci52YWx1ZSA9IG1hcmtlclNlcnZpY2UuaW5zdGFsbFJlc291cmNlRmlsdGVyKHRoaXMubW9kaWZpZWRVUkksIHJlcT8ubWVzc2FnZS50ZXh0IHx8IGxvY2FsaXplKCdkZWZhdWx0JywgXCJDaGF0IEVkaXRzXCIpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlc291cmNlRmlsdGVyLmNsZWFyKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfY2xlYXJDdXJyZW50RWRpdExpbmVEZWNvcmF0aW9uKCkge1xuXHRcdHRoaXMuX2VkaXREZWNvcmF0aW9ucyA9IHRoaXMubW9kaWZpZWRNb2RlbC5kZWx0YURlY29yYXRpb25zKHRoaXMuX2VkaXREZWNvcmF0aW9ucywgW10pO1xuXHR9XG5cblx0ZXF1YWxzU25hcHNob3Qoc25hcHNob3Q6IElTbmFwc2hvdEVudHJ5IHwgdW5kZWZpbmVkKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhc25hcHNob3QgJiZcblx0XHRcdHRoaXMubW9kaWZpZWRVUkkudG9TdHJpbmcoKSA9PT0gc25hcHNob3QucmVzb3VyY2UudG9TdHJpbmcoKSAmJlxuXHRcdFx0dGhpcy5tb2RpZmllZE1vZGVsLmdldExhbmd1YWdlSWQoKSA9PT0gc25hcHNob3QubGFuZ3VhZ2VJZCAmJlxuXHRcdFx0dGhpcy5vcmlnaW5hbE1vZGVsLmdldFZhbHVlKCkgPT09IHNuYXBzaG90Lm9yaWdpbmFsICYmXG5cdFx0XHR0aGlzLm1vZGlmaWVkTW9kZWwuZ2V0VmFsdWUoKSA9PT0gc25hcHNob3QuY3VycmVudCAmJlxuXHRcdFx0dGhpcy5fZWRpdC5lcXVhbHMoc25hcHNob3Qub3JpZ2luYWxUb0N1cnJlbnRFZGl0KSAmJlxuXHRcdFx0dGhpcy5zdGF0ZS5nZXQoKSA9PT0gc25hcHNob3Quc3RhdGU7XG5cdH1cblxuXHRjcmVhdGVTbmFwc2hvdChyZXF1ZXN0SWQ6IHN0cmluZyB8IHVuZGVmaW5lZCwgdW5kb1N0b3A6IHN0cmluZyB8IHVuZGVmaW5lZCk6IElTbmFwc2hvdEVudHJ5IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cmVzb3VyY2U6IHRoaXMubW9kaWZpZWRVUkksXG5cdFx0XHRsYW5ndWFnZUlkOiB0aGlzLm1vZGlmaWVkTW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpLFxuXHRcdFx0c25hcHNob3RVcmk6IENoYXRFZGl0aW5nU25hcHNob3RUZXh0TW9kZWxDb250ZW50UHJvdmlkZXIuZ2V0U25hcHNob3RGaWxlVVJJKHRoaXMuX3RlbGVtZXRyeUluZm8uc2Vzc2lvbklkLCByZXF1ZXN0SWQsIHVuZG9TdG9wLCB0aGlzLm1vZGlmaWVkVVJJLnBhdGgpLFxuXHRcdFx0b3JpZ2luYWw6IHRoaXMub3JpZ2luYWxNb2RlbC5nZXRWYWx1ZSgpLFxuXHRcdFx0Y3VycmVudDogdGhpcy5tb2RpZmllZE1vZGVsLmdldFZhbHVlKCksXG5cdFx0XHRvcmlnaW5hbFRvQ3VycmVudEVkaXQ6IHRoaXMuX2VkaXQsXG5cdFx0XHRzdGF0ZTogdGhpcy5zdGF0ZS5nZXQoKSxcblx0XHRcdHRlbGVtZXRyeUluZm86IHRoaXMuX3RlbGVtZXRyeUluZm9cblx0XHR9O1xuXHR9XG5cblx0cmVzdG9yZUZyb21TbmFwc2hvdChzbmFwc2hvdDogSVNuYXBzaG90RW50cnksIHJlc3RvcmVUb0Rpc2sgPSB0cnVlKSB7XG5cdFx0dGhpcy5fc3RhdGVPYnMuc2V0KHNuYXBzaG90LnN0YXRlLCB1bmRlZmluZWQpO1xuXHRcdHRoaXMub3JpZ2luYWxNb2RlbC5zZXRWYWx1ZShzbmFwc2hvdC5vcmlnaW5hbCk7XG5cdFx0aWYgKHJlc3RvcmVUb0Rpc2spIHtcblx0XHRcdHRoaXMuX3NldERvY1ZhbHVlKHNuYXBzaG90LmN1cnJlbnQpO1xuXHRcdH1cblx0XHR0aGlzLl9lZGl0ID0gc25hcHNob3Qub3JpZ2luYWxUb0N1cnJlbnRFZGl0O1xuXHRcdHRoaXMuX3VwZGF0ZURpZmZJbmZvU2VxKCk7XG5cdH1cblxuXHRyZXNldFRvSW5pdGlhbENvbnRlbnQoKSB7XG5cdFx0dGhpcy5fc2V0RG9jVmFsdWUodGhpcy5pbml0aWFsQ29udGVudCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgYXN5bmMgX2FyZU9yaWdpbmFsQW5kTW9kaWZpZWRJZGVudGljYWwoKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0Y29uc3QgZGlmZiA9IGF3YWl0IHRoaXMuX2RpZmZPcGVyYXRpb247XG5cdFx0cmV0dXJuIGRpZmYgPyBkaWZmLmlkZW50aWNhbCA6IGZhbHNlO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIF9yZXNldEVkaXRzU3RhdGUodHg6IElUcmFuc2FjdGlvbik6IHZvaWQge1xuXHRcdHN1cGVyLl9yZXNldEVkaXRzU3RhdGUodHgpO1xuXHRcdHRoaXMuX2NsZWFyQ3VycmVudEVkaXRMaW5lRGVjb3JhdGlvbigpO1xuXHR9XG5cblx0cHJpdmF0ZSBfbWlycm9yRWRpdHMoZXZlbnQ6IElNb2RlbENvbnRlbnRDaGFuZ2VkRXZlbnQpIHtcblx0XHRjb25zdCBlZGl0ID0gT2Zmc2V0RWRpdHMuZnJvbUNvbnRlbnRDaGFuZ2VzKGV2ZW50LmNoYW5nZXMpO1xuXG5cdFx0aWYgKHRoaXMuX2lzRWRpdEZyb21Vcykge1xuXHRcdFx0Y29uc3QgZV9zdW0gPSB0aGlzLl9lZGl0O1xuXHRcdFx0Y29uc3QgZV9haSA9IGVkaXQ7XG5cdFx0XHR0aGlzLl9lZGl0ID0gZV9zdW0uY29tcG9zZShlX2FpKTtcblxuXHRcdH0gZWxzZSB7XG5cblx0XHRcdC8vICAgICAgICAgICBlX2FpXG5cdFx0XHQvLyAgIGQwIC0tLS0tLS0tLS0tLS0tLT4gczBcblx0XHRcdC8vICAgfCAgICAgICAgICAgICAgICAgICB8XG5cdFx0XHQvLyAgIHwgICAgICAgICAgICAgICAgICAgfFxuXHRcdFx0Ly8gICB8IGVfdXNlcl9yICAgICAgICAgIHwgZV91c2VyXG5cdFx0XHQvLyAgIHwgICAgICAgICAgICAgICAgICAgfFxuXHRcdFx0Ly8gICB8ICAgICAgICAgICAgICAgICAgIHxcblx0XHRcdC8vICAgdiAgICAgICBlX2FpX3IgICAgICB2XG5cdFx0XHQvLy8gIGQxIC0tLS0tLS0tLS0tLS0tLT4gczFcblx0XHRcdC8vXG5cdFx0XHQvLyBkMCAtIGRvY3VtZW50IHNuYXBzaG90XG5cdFx0XHQvLyBzMCAtIGRvY3VtZW50XG5cdFx0XHQvLyBlX2FpIC0gYWkgZWRpdHNcblx0XHRcdC8vIGVfdXNlciAtIHVzZXIgZWRpdHNcblx0XHRcdC8vXG5cdFx0XHRjb25zdCBlX2FpID0gdGhpcy5fZWRpdDtcblx0XHRcdGNvbnN0IGVfdXNlciA9IGVkaXQ7XG5cblx0XHRcdGNvbnN0IGVfdXNlcl9yID0gZV91c2VyLnRyeVJlYmFzZShlX2FpLmludmVyc2UodGhpcy5vcmlnaW5hbE1vZGVsLmdldFZhbHVlKCkpLCB0cnVlKTtcblxuXHRcdFx0aWYgKGVfdXNlcl9yID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0Ly8gdXNlciBlZGl0cyBvdmVybGFwcy9jb25mbGljdHMgd2l0aCBBSSBlZGl0c1xuXHRcdFx0XHR0aGlzLl9lZGl0ID0gZV9haS5jb21wb3NlKGVfdXNlcik7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBlZGl0cyA9IE9mZnNldEVkaXRzLmFzRWRpdE9wZXJhdGlvbnMoZV91c2VyX3IsIHRoaXMub3JpZ2luYWxNb2RlbCk7XG5cdFx0XHRcdHRoaXMub3JpZ2luYWxNb2RlbC5hcHBseUVkaXRzKGVkaXRzKTtcblx0XHRcdFx0dGhpcy5fZWRpdCA9IGVfYWkudHJ5UmViYXNlKGVfdXNlcl9yKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fYWxsRWRpdHNBcmVGcm9tVXMgPSBmYWxzZTtcblx0XHRcdHRoaXMuX3VwZGF0ZURpZmZJbmZvU2VxKCk7XG5cblx0XHRcdGNvbnN0IGRpZFJlc2V0VG9PcmlnaW5hbENvbnRlbnQgPSB0aGlzLm1vZGlmaWVkTW9kZWwuZ2V0VmFsdWUoKSA9PT0gdGhpcy5pbml0aWFsQ29udGVudDtcblx0XHRcdGNvbnN0IGN1cnJlbnRTdGF0ZSA9IHRoaXMuX3N0YXRlT2JzLmdldCgpO1xuXHRcdFx0c3dpdGNoIChjdXJyZW50U3RhdGUpIHtcblx0XHRcdFx0Y2FzZSBXb3JraW5nU2V0RW50cnlTdGF0ZS5Nb2RpZmllZDpcblx0XHRcdFx0XHRpZiAoZGlkUmVzZXRUb09yaWdpbmFsQ29udGVudCkge1xuXHRcdFx0XHRcdFx0dGhpcy5fc3RhdGVPYnMuc2V0KFdvcmtpbmdTZXRFbnRyeVN0YXRlLlJlamVjdGVkLCB1bmRlZmluZWQpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBfY3JlYXRlVW5kb1JlZG9FbGVtZW50KHJlc3BvbnNlOiBJQ2hhdFJlc3BvbnNlTW9kZWwpOiBJVW5kb1JlZG9FbGVtZW50IHtcblx0XHRjb25zdCByZXF1ZXN0ID0gcmVzcG9uc2Uuc2Vzc2lvbi5nZXRSZXF1ZXN0cygpLmZpbmQocmVxID0+IHJlcS5pZCA9PT0gcmVzcG9uc2UucmVxdWVzdElkKTtcblx0XHRjb25zdCBsYWJlbCA9IHJlcXVlc3Q/Lm1lc3NhZ2UudGV4dCA/IGxvY2FsaXplKCdjaGF0RWRpdGluZzEnLCBcIkNoYXQgRWRpdDogJ3swfSdcIiwgcmVxdWVzdC5tZXNzYWdlLnRleHQpIDogbG9jYWxpemUoJ2NoYXRFZGl0aW5nMicsIFwiQ2hhdCBFZGl0XCIpO1xuXHRcdHJldHVybiBuZXcgU2luZ2xlTW9kZWxFZGl0U3RhY2tFbGVtZW50KGxhYmVsLCAnY2hhdC5lZGl0JywgdGhpcy5tb2RpZmllZE1vZGVsLCBudWxsKTtcblx0fVxuXG5cdGFzeW5jIGFjY2VwdEFnZW50RWRpdHMocmVzb3VyY2U6IFVSSSwgdGV4dEVkaXRzOiAoVGV4dEVkaXQgfCBJQ2VsbEVkaXRPcGVyYXRpb24pW10sIGlzTGFzdEVkaXRzOiBib29sZWFuLCByZXNwb25zZU1vZGVsOiBJQ2hhdFJlc3BvbnNlTW9kZWwpOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdGFzc2VydFR5cGUodGV4dEVkaXRzLmV2ZXJ5KFRleHRFZGl0LmlzVGV4dEVkaXQpLCAnSU5WQUxJRCBhcmdzLCBjYW4gb25seSBoYW5kbGUgdGV4dCBlZGl0cycpO1xuXHRcdGFzc2VydChpc0VxdWFsKHJlc291cmNlLCB0aGlzLm1vZGlmaWVkVVJJKSwgJyBJTlZBTElEIGFyZ3MsIGNhbiBvbmx5IGVkaXQgVEhJUyBkb2N1bWVudCcpO1xuXG5cdFx0Y29uc3Qgb3BzID0gdGV4dEVkaXRzLm1hcChUZXh0RWRpdC5hc0VkaXRPcGVyYXRpb24pO1xuXHRcdGNvbnN0IHVuZG9FZGl0cyA9IHRoaXMuX2FwcGx5RWRpdHMob3BzKTtcblxuXHRcdGNvbnN0IG1heExpbmVOdW1iZXIgPSB1bmRvRWRpdHMucmVkdWNlKChtYXgsIG9wKSA9PiBNYXRoLm1heChtYXgsIG9wLnJhbmdlLnN0YXJ0TGluZU51bWJlciksIDApO1xuXG5cdFx0Y29uc3QgbmV3RGVjb3JhdGlvbnM6IElNb2RlbERlbHRhRGVjb3JhdGlvbltdID0gW1xuXHRcdFx0Ly8gZGVjb3JhdGUgcGVuZGluZyBlZGl0IChyZWdpb24pXG5cdFx0XHR7XG5cdFx0XHRcdG9wdGlvbnM6IENoYXRFZGl0aW5nTW9kaWZpZWREb2N1bWVudEVudHJ5Ll9wZW5kaW5nRWRpdERlY29yYXRpb25PcHRpb25zLFxuXHRcdFx0XHRyYW5nZTogbmV3IFJhbmdlKG1heExpbmVOdW1iZXIgKyAxLCAxLCBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUiwgTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpXG5cdFx0XHR9XG5cdFx0XTtcblxuXHRcdGlmIChtYXhMaW5lTnVtYmVyID4gMCkge1xuXHRcdFx0Ly8gZGVjb3JhdGUgbGFzdCBlZGl0XG5cdFx0XHRuZXdEZWNvcmF0aW9ucy5wdXNoKHtcblx0XHRcdFx0b3B0aW9uczogQ2hhdEVkaXRpbmdNb2RpZmllZERvY3VtZW50RW50cnkuX2xhc3RFZGl0RGVjb3JhdGlvbk9wdGlvbnMsXG5cdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UobWF4TGluZU51bWJlciwgMSwgbWF4TGluZU51bWJlciwgTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHR0aGlzLl9lZGl0RGVjb3JhdGlvbnMgPSB0aGlzLm1vZGlmaWVkTW9kZWwuZGVsdGFEZWNvcmF0aW9ucyh0aGlzLl9lZGl0RGVjb3JhdGlvbnMsIG5ld0RlY29yYXRpb25zKTtcblxuXG5cdFx0dHJhbnNhY3Rpb24oKHR4KSA9PiB7XG5cdFx0XHRpZiAoIWlzTGFzdEVkaXRzKSB7XG5cdFx0XHRcdHRoaXMuX3N0YXRlT2JzLnNldChXb3JraW5nU2V0RW50cnlTdGF0ZS5Nb2RpZmllZCwgdHgpO1xuXHRcdFx0XHR0aGlzLl9pc0N1cnJlbnRseUJlaW5nTW9kaWZpZWRCeU9icy5zZXQocmVzcG9uc2VNb2RlbCwgdHgpO1xuXHRcdFx0XHRjb25zdCBsaW5lQ291bnQgPSB0aGlzLm1vZGlmaWVkTW9kZWwuZ2V0TGluZUNvdW50KCk7XG5cdFx0XHRcdHRoaXMuX3Jld3JpdGVSYXRpb09icy5zZXQoTWF0aC5taW4oMSwgbWF4TGluZU51bWJlciAvIGxpbmVDb3VudCksIHR4KTtcblxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fcmVzZXRFZGl0c1N0YXRlKHR4KTtcblx0XHRcdFx0dGhpcy5fdXBkYXRlRGlmZkluZm9TZXEoKTtcblx0XHRcdFx0dGhpcy5fcmV3cml0ZVJhdGlvT2JzLnNldCgxLCB0eCk7XG5cdFx0XHRcdHRoaXMuX2VkaXREZWNvcmF0aW9uQ2xlYXIuc2NoZWR1bGUoKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2FjY2VwdEh1bmsoY2hhbmdlOiBEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRpZiAoIXRoaXMuX2RpZmZJbmZvLmdldCgpLmNoYW5nZXMuaW5jbHVkZXMoY2hhbmdlKSkge1xuXHRcdFx0Ly8gZGlmZkluZm8gc2hvdWxkIGhhdmUgbW9kZWwgdmVyc2lvbiBpZHMgYW5kIGNoZWNrIHRoZW0gKGluc3RlYWQgb2YgdGhlIGNhbGxlciBkb2luZyB0aGF0KVxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRjb25zdCBlZGl0czogSVNpbmdsZUVkaXRPcGVyYXRpb25bXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgZWRpdCBvZiBjaGFuZ2UuaW5uZXJDaGFuZ2VzID8/IFtdKSB7XG5cdFx0XHRjb25zdCBuZXdUZXh0ID0gdGhpcy5tb2RpZmllZE1vZGVsLmdldFZhbHVlSW5SYW5nZShlZGl0Lm1vZGlmaWVkUmFuZ2UpO1xuXHRcdFx0ZWRpdHMucHVzaChFZGl0T3BlcmF0aW9uLnJlcGxhY2UoZWRpdC5vcmlnaW5hbFJhbmdlLCBuZXdUZXh0KSk7XG5cdFx0fVxuXHRcdHRoaXMub3JpZ2luYWxNb2RlbC5wdXNoRWRpdE9wZXJhdGlvbnMobnVsbCwgZWRpdHMsIF8gPT4gbnVsbCk7XG5cdFx0YXdhaXQgdGhpcy5fdXBkYXRlRGlmZkluZm9TZXEoKTtcblx0XHRpZiAodGhpcy5fZGlmZkluZm8uZ2V0KCkuaWRlbnRpY2FsKSB7XG5cdFx0XHR0aGlzLl9zdGF0ZU9icy5zZXQoV29ya2luZ1NldEVudHJ5U3RhdGUuQWNjZXB0ZWQsIHVuZGVmaW5lZCk7XG5cdFx0fVxuXHRcdHRoaXMuX2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLnBsYXlTaWduYWwoQWNjZXNzaWJpbGl0eVNpZ25hbC5lZGl0c0tlcHQsIHsgYWxsb3dNYW55SW5QYXJhbGxlbDogdHJ1ZSB9KTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3JlamVjdEh1bmsoY2hhbmdlOiBEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRpZiAoIXRoaXMuX2RpZmZJbmZvLmdldCgpLmNoYW5nZXMuaW5jbHVkZXMoY2hhbmdlKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRjb25zdCBlZGl0czogSVNpbmdsZUVkaXRPcGVyYXRpb25bXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgZWRpdCBvZiBjaGFuZ2UuaW5uZXJDaGFuZ2VzID8/IFtdKSB7XG5cdFx0XHRjb25zdCBuZXdUZXh0ID0gdGhpcy5vcmlnaW5hbE1vZGVsLmdldFZhbHVlSW5SYW5nZShlZGl0Lm9yaWdpbmFsUmFuZ2UpO1xuXHRcdFx0ZWRpdHMucHVzaChFZGl0T3BlcmF0aW9uLnJlcGxhY2UoZWRpdC5tb2RpZmllZFJhbmdlLCBuZXdUZXh0KSk7XG5cdFx0fVxuXHRcdHRoaXMubW9kaWZpZWRNb2RlbC5wdXNoRWRpdE9wZXJhdGlvbnMobnVsbCwgZWRpdHMsIF8gPT4gbnVsbCk7XG5cdFx0YXdhaXQgdGhpcy5fdXBkYXRlRGlmZkluZm9TZXEoKTtcblx0XHRpZiAodGhpcy5fZGlmZkluZm8uZ2V0KCkuaWRlbnRpY2FsKSB7XG5cdFx0XHR0aGlzLl9zdGF0ZU9icy5zZXQoV29ya2luZ1NldEVudHJ5U3RhdGUuUmVqZWN0ZWQsIHVuZGVmaW5lZCk7XG5cdFx0fVxuXHRcdHRoaXMuX2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLnBsYXlTaWduYWwoQWNjZXNzaWJpbGl0eVNpZ25hbC5lZGl0c1VuZG9uZSwgeyBhbGxvd01hbnlJblBhcmFsbGVsOiB0cnVlIH0pO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBfYXBwbHlFZGl0cyhlZGl0czogSVNpbmdsZUVkaXRPcGVyYXRpb25bXSkge1xuXHRcdC8vIG1ha2UgdGhlIGFjdHVhbCBlZGl0XG5cdFx0dGhpcy5faXNFZGl0RnJvbVVzID0gdHJ1ZTtcblx0XHR0cnkge1xuXHRcdFx0bGV0IHJlc3VsdDogSVNpbmdsZUVkaXRPcGVyYXRpb25bXSA9IFtdO1xuXHRcdFx0dGhpcy5tb2RpZmllZE1vZGVsLnB1c2hFZGl0T3BlcmF0aW9ucyhudWxsLCBlZGl0cywgKHVuZG9FZGl0cykgPT4ge1xuXHRcdFx0XHRyZXN1bHQgPSB1bmRvRWRpdHM7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLl9pc0VkaXRGcm9tVXMgPSBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF91cGRhdGVEaWZmSW5mb1NlcSgpIHtcblx0XHRjb25zdCBteURpZmZPcGVyYXRpb25JZCA9ICsrdGhpcy5fZGlmZk9wZXJhdGlvbklkcztcblx0XHRhd2FpdCBQcm9taXNlLnJlc29sdmUodGhpcy5fZGlmZk9wZXJhdGlvbik7XG5cdFx0aWYgKHRoaXMuX2RpZmZPcGVyYXRpb25JZHMgPT09IG15RGlmZk9wZXJhdGlvbklkKSB7XG5cdFx0XHRjb25zdCB0aGlzRGlmZk9wZXJhdGlvbiA9IHRoaXMuX3VwZGF0ZURpZmZJbmZvKCk7XG5cdFx0XHR0aGlzLl9kaWZmT3BlcmF0aW9uID0gdGhpc0RpZmZPcGVyYXRpb247XG5cdFx0XHRhd2FpdCB0aGlzRGlmZk9wZXJhdGlvbjtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF91cGRhdGVEaWZmSW5mbygpOiBQcm9taXNlPElEb2N1bWVudERpZmYgfCB1bmRlZmluZWQ+IHtcblxuXHRcdGlmICh0aGlzLm9yaWdpbmFsTW9kZWwuaXNEaXNwb3NlZCgpIHx8IHRoaXMubW9kaWZpZWRNb2RlbC5pc0Rpc3Bvc2VkKCkpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZG9jVmVyc2lvbk5vdyA9IHRoaXMubW9kaWZpZWRNb2RlbC5nZXRWZXJzaW9uSWQoKTtcblx0XHRjb25zdCBzbmFwc2hvdFZlcnNpb25Ob3cgPSB0aGlzLm9yaWdpbmFsTW9kZWwuZ2V0VmVyc2lvbklkKCk7XG5cblx0XHRjb25zdCBpZ25vcmVUcmltV2hpdGVzcGFjZSA9IHRoaXMuX2RpZmZUcmltV2hpdGVzcGFjZS5nZXQoKTtcblxuXHRcdGNvbnN0IGRpZmYgPSBhd2FpdCB0aGlzLl9lZGl0b3JXb3JrZXJTZXJ2aWNlLmNvbXB1dGVEaWZmKFxuXHRcdFx0dGhpcy5vcmlnaW5hbE1vZGVsLnVyaSxcblx0XHRcdHRoaXMubW9kaWZpZWRNb2RlbC51cmksXG5cdFx0XHR7IGlnbm9yZVRyaW1XaGl0ZXNwYWNlLCBjb21wdXRlTW92ZXM6IGZhbHNlLCBtYXhDb21wdXRhdGlvblRpbWVNczogMzAwMCB9LFxuXHRcdFx0J2FkdmFuY2VkJ1xuXHRcdCk7XG5cblx0XHRpZiAodGhpcy5vcmlnaW5hbE1vZGVsLmlzRGlzcG9zZWQoKSB8fCB0aGlzLm1vZGlmaWVkTW9kZWwuaXNEaXNwb3NlZCgpKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdC8vIG9ubHkgdXBkYXRlIHRoZSBkaWZmIGlmIHRoZSBkb2N1bWVudHMgZGlkbid0IGNoYW5nZSBpbiB0aGUgbWVhbnRpbWVcblx0XHRpZiAodGhpcy5tb2RpZmllZE1vZGVsLmdldFZlcnNpb25JZCgpID09PSBkb2NWZXJzaW9uTm93ICYmIHRoaXMub3JpZ2luYWxNb2RlbC5nZXRWZXJzaW9uSWQoKSA9PT0gc25hcHNob3RWZXJzaW9uTm93KSB7XG5cdFx0XHRjb25zdCBkaWZmMiA9IGRpZmYgPz8gbnVsbERvY3VtZW50RGlmZjtcblx0XHRcdHRoaXMuX2RpZmZJbmZvLnNldChkaWZmMiwgdW5kZWZpbmVkKTtcblx0XHRcdHRoaXMuX2VkaXQgPSBPZmZzZXRFZGl0cy5mcm9tTGluZVJhbmdlTWFwcGluZyh0aGlzLm9yaWdpbmFsTW9kZWwsIHRoaXMubW9kaWZpZWRNb2RlbCwgZGlmZjIuY2hhbmdlcyk7XG5cdFx0XHRyZXR1cm4gZGlmZjI7XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgYXN5bmMgX2RvQWNjZXB0KHR4OiBJVHJhbnNhY3Rpb24gfCB1bmRlZmluZWQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLm9yaWdpbmFsTW9kZWwuc2V0VmFsdWUodGhpcy5tb2RpZmllZE1vZGVsLmNyZWF0ZVNuYXBzaG90KCkpO1xuXHRcdHRoaXMuX2RpZmZJbmZvLnNldChudWxsRG9jdW1lbnREaWZmLCB0eCk7XG5cdFx0dGhpcy5fZWRpdCA9IE9mZnNldEVkaXQuZW1wdHk7XG5cdFx0YXdhaXQgdGhpcy5fY29sbGFwc2UodHgpO1xuXG5cdFx0Y29uc3QgY29uZmlnID0gdGhpcy5fZmlsZUNvbmZpZ1NlcnZpY2UuZ2V0QXV0b1NhdmVDb25maWd1cmF0aW9uKHRoaXMubW9kaWZpZWRVUkkpO1xuXHRcdGlmICghY29uZmlnLmF1dG9TYXZlIHx8ICF0aGlzLl90ZXh0RmlsZVNlcnZpY2UuaXNEaXJ0eSh0aGlzLm1vZGlmaWVkVVJJKSkge1xuXHRcdFx0Ly8gU0FWRSBhZnRlciBhY2NlcHQgZm9yIG1hbnVhbC1zYXZlcnMsIGZvciBhdXRvLXNhdmVyc1xuXHRcdFx0Ly8gdHJpZ2dlciBleHBsaWN0IHNhdmUgdG8gZ2V0IHNhdmUgcGFydGljaXBhbnRzIGdvaW5nXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLl90ZXh0RmlsZVNlcnZpY2Uuc2F2ZSh0aGlzLm1vZGlmaWVkVVJJLCB7XG5cdFx0XHRcdFx0cmVhc29uOiBTYXZlUmVhc29uLkVYUExJQ0lULFxuXHRcdFx0XHRcdGZvcmNlOiB0cnVlLFxuXHRcdFx0XHRcdGlnbm9yZUVycm9ySGFuZGxlcjogdHJ1ZVxuXHRcdFx0XHR9KTtcblx0XHRcdH0gY2F0Y2gge1xuXHRcdFx0XHQvLyBpZ25vcmVkXG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGFzeW5jIF9kb1JlamVjdCh0eDogSVRyYW5zYWN0aW9uIHwgdW5kZWZpbmVkKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHRoaXMuY3JlYXRlZEluUmVxdWVzdElkID09PSB0aGlzLl90ZWxlbWV0cnlJbmZvLnJlcXVlc3RJZCkge1xuXHRcdFx0YXdhaXQgdGhpcy5kb2NGaWxlRWRpdG9yTW9kZWwucmV2ZXJ0KHsgc29mdDogdHJ1ZSB9KTtcblx0XHRcdGF3YWl0IHRoaXMuX2ZpbGVTZXJ2aWNlLmRlbCh0aGlzLm1vZGlmaWVkVVJJKTtcblx0XHRcdHRoaXMuX29uRGlkRGVsZXRlLmZpcmUoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fc2V0RG9jVmFsdWUodGhpcy5vcmlnaW5hbE1vZGVsLmdldFZhbHVlKCkpO1xuXHRcdFx0aWYgKHRoaXMuX2FsbEVkaXRzQXJlRnJvbVVzKSB7XG5cdFx0XHRcdC8vIHNhdmUgdGhlIGZpbGUgYWZ0ZXIgZGlzY2FyZGluZyBzbyB0aGF0IHRoZSBkaXJ0eSBpbmRpY2F0b3IgZ29lcyBhd2F5XG5cdFx0XHRcdC8vIGFuZCBzbyB0aGF0IGFuIGludGVybWVkaWF0ZSBzYXZlZCBzdGF0ZSBnZXRzIHJldmVydGVkXG5cdFx0XHRcdGF3YWl0IHRoaXMuZG9jRmlsZUVkaXRvck1vZGVsLnNhdmUoeyByZWFzb246IFNhdmVSZWFzb24uRVhQTElDSVQsIHNraXBTYXZlUGFydGljaXBhbnRzOiB0cnVlIH0pO1xuXHRcdFx0fVxuXHRcdFx0YXdhaXQgdGhpcy5fY29sbGFwc2UodHgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3NldERvY1ZhbHVlKHZhbHVlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5tb2RpZmllZE1vZGVsLmdldFZhbHVlKCkgIT09IHZhbHVlKSB7XG5cblx0XHRcdHRoaXMubW9kaWZpZWRNb2RlbC5wdXNoU3RhY2tFbGVtZW50KCk7XG5cdFx0XHRjb25zdCBlZGl0ID0gRWRpdE9wZXJhdGlvbi5yZXBsYWNlKHRoaXMubW9kaWZpZWRNb2RlbC5nZXRGdWxsTW9kZWxSYW5nZSgpLCB2YWx1ZSk7XG5cblx0XHRcdHRoaXMuX2FwcGx5RWRpdHMoW2VkaXRdKTtcblx0XHRcdHRoaXMuX3VwZGF0ZURpZmZJbmZvU2VxKCk7XG5cdFx0XHR0aGlzLm1vZGlmaWVkTW9kZWwucHVzaFN0YWNrRWxlbWVudCgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2NvbGxhcHNlKHRyYW5zYWN0aW9uOiBJVHJhbnNhY3Rpb24gfCB1bmRlZmluZWQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLl9tdWx0aURpZmZFbnRyeURlbGVnYXRlLmNvbGxhcHNlKHRyYW5zYWN0aW9uKTtcblx0fVxuXG5cdHByb3RlY3RlZCBfY3JlYXRlRWRpdG9ySW50ZWdyYXRpb24oZWRpdG9yOiBJRWRpdG9yUGFuZSk6IElNb2RpZmllZEZpbGVFbnRyeUVkaXRvckludGVncmF0aW9uIHtcblx0XHRjb25zdCBjb2RlRWRpdG9yID0gZ2V0Q29kZUVkaXRvcihlZGl0b3IuZ2V0Q29udHJvbCgpKTtcblx0XHRhc3NlcnRUeXBlKGNvZGVFZGl0b3IpO1xuXG5cdFx0Y29uc3QgZGlmZkluZm8gPSB0aGlzLl9kaWZmSW5mby5tYXAodmFsdWUgPT4ge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0Li4udmFsdWUsXG5cdFx0XHRcdG9yaWdpbmFsTW9kZWw6IHRoaXMub3JpZ2luYWxNb2RlbCxcblx0XHRcdFx0bW9kaWZpZWRNb2RlbDogdGhpcy5tb2RpZmllZE1vZGVsLFxuXHRcdFx0XHRrZWVwOiBjaGFuZ2VzID0+IHRoaXMuX2FjY2VwdEh1bmsoY2hhbmdlcyksXG5cdFx0XHRcdHVuZG86IGNoYW5nZXMgPT4gdGhpcy5fcmVqZWN0SHVuayhjaGFuZ2VzKVxuXHRcdFx0fSBzYXRpc2ZpZXMgSURvY3VtZW50RGlmZjI7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2hhdEVkaXRpbmdDb2RlRWRpdG9ySW50ZWdyYXRpb24sIHRoaXMsIGNvZGVFZGl0b3IsIGRpZmZJbmZvKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGNBQWM7QUFDdkIsU0FBUyx3QkFBd0I7QUFDakMsU0FBcUIsbUJBQW1CLG9CQUFvQjtBQUM1RCxTQUFTLGlCQUE0QyxTQUFTLG1CQUFtQjtBQUNqRixTQUFTLGVBQWU7QUFDeEIsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxrQkFBa0I7QUFFM0IsU0FBUyxxQkFBcUI7QUFDOUIsU0FBK0IscUJBQXFCO0FBQ3BELFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsYUFBYTtBQUN0QixTQUF3Qix3QkFBd0I7QUFFaEQsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxtQkFBbUIsdUJBQTBEO0FBQ3RGLFNBQVMsbUNBQW1DO0FBQzVDLFNBQVMsd0JBQXdCLDJDQUEyQztBQUM1RSxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFt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
