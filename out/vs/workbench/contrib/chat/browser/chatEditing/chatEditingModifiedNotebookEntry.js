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
import { streamToBuffer } from "../../../../../base/common/buffer.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { StringSHA1 } from "../../../../../base/common/hash.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { ResourceMap, ResourceSet } from "../../../../../base/common/map.js";
import { Schemas } from "../../../../../base/common/network.js";
import { observableValue, autorun, transaction, ObservablePromise } from "../../../../../base/common/observable.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { assertType } from "../../../../../base/common/types.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { LineRange } from "../../../../../editor/common/core/lineRange.js";
import { OffsetEdit } from "../../../../../editor/common/core/offsetEdit.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { nullDocumentDiff } from "../../../../../editor/common/diff/documentDiffProvider.js";
import { DetailedLineRangeMapping, RangeMapping } from "../../../../../editor/common/diff/rangeMapping.js";
import { TextEdit } from "../../../../../editor/common/languages.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { localize } from "../../../../../nls.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IUndoRedoService, UndoRedoElementType } from "../../../../../platform/undoRedo/common/undoRedo.js";
import { SaveReason } from "../../../../common/editor.js";
import { IFilesConfigurationService } from "../../../../services/filesConfiguration/common/filesConfigurationService.js";
import { SnapshotContext } from "../../../../services/workingCopy/common/fileWorkingCopy.js";
import { NotebookTextDiffEditor } from "../../../notebook/browser/diff/notebookDiffEditor.js";
import { getNotebookEditorFromEditorPane } from "../../../notebook/browser/notebookBrowser.js";
import { CellEditType, NotebookCellsChangeType, NotebookSetting } from "../../../notebook/common/notebookCommon.js";
import { computeDiff } from "../../../notebook/common/notebookDiff.js";
import { INotebookEditorModelResolverService } from "../../../notebook/common/notebookEditorModelResolverService.js";
import { INotebookLoggingService } from "../../../notebook/common/notebookLoggingService.js";
import { INotebookService } from "../../../notebook/common/notebookService.js";
import { INotebookEditorWorkerService } from "../../../notebook/common/services/notebookWorkerService.js";
import { WorkingSetEntryState } from "../../common/chatEditingService.js";
import { IChatService } from "../../common/chatService.js";
import { AbstractChatEditingModifiedFileEntry } from "./chatEditingModifiedFileEntry.js";
import { createSnapshot, deserializeSnapshot, getNotebookSnapshotFileURI, restoreSnapshot, SnapshotComparer } from "./notebook/chatEditingModifiedNotebookSnapshot.js";
import { ChatEditingNewNotebookContentEdits } from "./notebook/chatEditingNewNotebookContentEdits.js";
import { ChatEditingNotebookCellEntry } from "./notebook/chatEditingNotebookCellEntry.js";
import { ChatEditingNotebookDiffEditorIntegration, ChatEditingNotebookEditorIntegration } from "./notebook/chatEditingNotebookEditorIntegration.js";
import { ChatEditingNotebookFileSystemProvider } from "./notebook/chatEditingNotebookFileSystemProvider.js";
import { adjustCellDiffAndOriginalModelBasedOnCellAddDelete, adjustCellDiffAndOriginalModelBasedOnCellMovements, adjustCellDiffForKeepingAnInsertedCell, adjustCellDiffForRevertingADeletedCell, adjustCellDiffForRevertingAnInsertedCell, calculateNotebookRewriteRatio, getCorrespondingOriginalCellIndex, isTransientIPyNbExtensionEvent } from "./notebook/helpers.js";
import { countChanges, sortCellChanges } from "./notebook/notebookCellChanges.js";
const SnapshotLanguageId = "VSCodeChatNotebookSnapshotLanguage";
let ChatEditingModifiedNotebookEntry = class extends AbstractChatEditingModifiedFileEntry {
  constructor(modifiedResourceRef, originalResourceRef, _multiDiffEntryDelegate, transientOptions, telemetryInfo, kind, initialContent, configurationService, fileConfigService, chatService, fileService, instantiationService, textModelService, modelService, undoRedoService, notebookEditorWorkerService, loggingService, notebookResolver) {
    super(modifiedResourceRef.object.notebook.uri, telemetryInfo, kind, configurationService, fileConfigService, chatService, fileService, undoRedoService, instantiationService);
    this.modifiedResourceRef = modifiedResourceRef;
    this._multiDiffEntryDelegate = _multiDiffEntryDelegate;
    this.transientOptions = transientOptions;
    this.configurationService = configurationService;
    this.textModelService = textModelService;
    this.modelService = modelService;
    this.notebookEditorWorkerService = notebookEditorWorkerService;
    this.loggingService = loggingService;
    this.notebookResolver = notebookResolver;
    /**
     * Whether we're still generating diffs from a response.
     */
    this._isProcessingResponse = observableValue("isProcessingResponse", false);
    this._isEditFromUs = false;
    /**
     * Whether all edits are from us, e.g. is possible a user has made edits, then this will be false.
     */
    this._allEditsAreFromUs = true;
    this._changesCount = observableValue(this, 0);
    this.changesCount = this._changesCount;
    this.cellEntryMap = new ResourceMap();
    this.modifiedToOriginalCell = new ResourceMap();
    this._cellsDiffInfo = observableValue("diffInfo", []);
    /**
     * List of Cell URIs that are edited,
     * Will be cleared once all edits have been accepted.
     * I.e. this will only contain URIS while acceptAgentEdits is being called & before `isLastEdit` is sent.
     * I.e. this is populated only when edits are being streamed.
     */
    this.editedCells = new ResourceSet();
    this.computeRequestId = 0;
    this.cellTextModelMap = new ResourceMap();
    this.initialContentComparer = new SnapshotComparer(initialContent);
    this.modifiedModel = this._register(modifiedResourceRef).object.notebook;
    this.originalModel = this._register(originalResourceRef).object.notebook;
    this.originalURI = this.originalModel.uri;
    this.initialContent = initialContent;
    this.initializeModelsFromDiff();
    this._register(this.modifiedModel.onDidChangeContent(this.mirrorNotebookEdits, this));
  }
  get isProcessingResponse() {
    return this._isProcessingResponse;
  }
  get cellsDiffInfo() {
    return this._cellsDiffInfo;
  }
  static async create(uri, _multiDiffEntryDelegate, telemetryInfo, chatKind, initialContent, instantiationService) {
    return instantiationService.invokeFunction(async (accessor) => {
      const notebookService = accessor.get(INotebookService);
      const resolver = accessor.get(INotebookEditorModelResolverService);
      const configurationServie = accessor.get(IConfigurationService);
      const resourceRef = await resolver.resolve(uri);
      const notebook = resourceRef.object.notebook;
      const originalUri = getNotebookSnapshotFileURI(telemetryInfo.sessionId, telemetryInfo.requestId, generateUuid(), notebook.uri.scheme === Schemas.untitled ? `/${notebook.uri.path}` : notebook.uri.path, notebook.viewType);
      const [options, buffer] = await Promise.all([
        notebookService.withNotebookDataProvider(resourceRef.object.notebook.notebookType),
        notebookService.createNotebookTextDocumentSnapshot(notebook.uri, SnapshotContext.Backup, CancellationToken.None).then((s) => streamToBuffer(s))
      ]);
      const disposables = new DisposableStore();
      disposables.add(ChatEditingNotebookFileSystemProvider.registerFile(originalUri, buffer));
      const originalRef = await resolver.resolve(originalUri, notebook.viewType);
      if (initialContent) {
        restoreSnapshot(originalRef.object.notebook, initialContent);
      } else {
        initialContent = createSnapshot(notebook, options.serializer.options, configurationServie);
        restoreSnapshot(originalRef.object.notebook, initialContent);
        const edits = [];
        notebook.cells.forEach((cell, index) => {
          const internalId = generateCellHash(cell.uri);
          edits.push({ editType: CellEditType.PartialInternalMetadata, index, internalMetadata: { internalId } });
        });
        resourceRef.object.notebook.applyEdits(edits, true, void 0, () => void 0, void 0, false);
        originalRef.object.notebook.applyEdits(edits, true, void 0, () => void 0, void 0, false);
      }
      const instance = instantiationService.createInstance(ChatEditingModifiedNotebookEntry, resourceRef, originalRef, _multiDiffEntryDelegate, options.serializer.options, telemetryInfo, chatKind, initialContent);
      instance._register(disposables);
      return instance;
    });
  }
  static canHandleSnapshotContent(initialContent) {
    if (!initialContent) {
      return false;
    }
    try {
      deserializeSnapshot(initialContent);
      return true;
    } catch (ex) {
      return false;
    }
  }
  static canHandleSnapshot(snapshot) {
    if (snapshot.languageId === SnapshotLanguageId && ChatEditingModifiedNotebookEntry.canHandleSnapshotContent(snapshot.current)) {
      return true;
    }
    return false;
  }
  initializeModelsFromDiffImpl(cellsDiffInfo) {
    this.cellEntryMap.forEach((entry) => entry.dispose());
    this.cellEntryMap.clear();
    const diffs = cellsDiffInfo.map((cellDiff, i) => {
      switch (cellDiff.type) {
        case "delete":
          return this.createDeleteCellDiffInfo(cellDiff.originalCellIndex);
        case "insert":
          return this.createInsertedCellDiffInfo(cellDiff.modifiedCellIndex);
        default:
          return this.createModifiedCellDiffInfo(cellDiff.modifiedCellIndex, cellDiff.originalCellIndex);
      }
    });
    this._cellsDiffInfo.set(diffs, void 0);
    this._changesCount.set(countChanges(diffs), void 0);
  }
  async initializeModelsFromDiff() {
    const id = ++this.computeRequestId;
    if (this._areOriginalAndModifiedIdenticalImpl()) {
      const cellsDiffInfo2 = this.modifiedModel.cells.map((_, index) => {
        return { type: "unchanged", originalCellIndex: index, modifiedCellIndex: index };
      });
      this.initializeModelsFromDiffImpl(cellsDiffInfo2);
      return;
    }
    const cellsDiffInfo = [];
    try {
      this._isProcessingResponse.set(true, void 0);
      const notebookDiff = await this.notebookEditorWorkerService.computeDiff(this.originalURI, this.modifiedURI);
      if (id !== this.computeRequestId) {
        return;
      }
      const result = computeDiff(this.originalModel, this.modifiedModel, notebookDiff);
      if (result.cellDiffInfo.length) {
        cellsDiffInfo.push(...result.cellDiffInfo);
      }
    } catch (ex) {
      this.loggingService.error("Notebook Chat", "Error computing diff:\n" + ex);
    } finally {
      this._isProcessingResponse.set(false, void 0);
    }
    this.initializeModelsFromDiffImpl(cellsDiffInfo);
  }
  updateCellDiffInfo(cellsDiffInfo, transcation) {
    this._cellsDiffInfo.set(sortCellChanges(cellsDiffInfo), transcation);
    this._changesCount.set(countChanges(cellsDiffInfo), transcation);
  }
  mirrorNotebookEdits(e) {
    if (this._isEditFromUs || Array.from(this.cellEntryMap.values()).some((entry) => entry.isEditFromUs)) {
      return;
    }
    let didResetToOriginalContent = this.initialContentComparer.isEqual(this.modifiedModel);
    const currentState = this._stateObs.get();
    if (currentState === WorkingSetEntryState.Rejected) {
      return;
    }
    if (currentState === WorkingSetEntryState.Modified && didResetToOriginalContent) {
      this._stateObs.set(WorkingSetEntryState.Rejected, void 0);
      this.updateCellDiffInfo([], void 0);
      this.initializeModelsFromDiff();
      return;
    }
    if (!e.rawEvents.length) {
      return;
    }
    if (isTransientIPyNbExtensionEvent(this.modifiedModel.notebookType, e)) {
      return;
    }
    this._allEditsAreFromUs = false;
    for (const event of e.rawEvents.filter((event2) => event2.kind !== NotebookCellsChangeType.ChangeCellContent)) {
      switch (event.kind) {
        case NotebookCellsChangeType.ChangeDocumentMetadata: {
          const edit = {
            editType: CellEditType.DocumentMetadata,
            metadata: this.modifiedModel.metadata
          };
          this.originalModel.applyEdits([edit], true, void 0, () => void 0, void 0, false);
          break;
        }
        case NotebookCellsChangeType.ModelChange: {
          let cellDiffs = sortCellChanges(this._cellsDiffInfo.get());
          this._applyEditsSync(() => {
            event.changes.forEach((change) => {
              change[2].forEach((cell, i) => {
                if (cell.internalMetadata.internalId) {
                  return;
                }
                const index = change[0] + i;
                const internalId = generateCellHash(cell.uri);
                const edits = [{ editType: CellEditType.PartialInternalMetadata, index, internalMetadata: { internalId } }];
                this.modifiedModel.applyEdits(edits, true, void 0, () => void 0, void 0, false);
                cell.internalMetadata ??= {};
                cell.internalMetadata.internalId = internalId;
              });
            });
          });
          event.changes.forEach((change) => {
            cellDiffs = adjustCellDiffAndOriginalModelBasedOnCellAddDelete(
              change,
              cellDiffs,
              this.modifiedModel.cells.length,
              this.originalModel.cells.length,
              this.originalModel.applyEdits.bind(this.originalModel),
              this.createModifiedCellDiffInfo.bind(this)
            );
          });
          this.updateCellDiffInfo(cellDiffs, void 0);
          this.disposeDeletedCellEntries();
          break;
        }
        case NotebookCellsChangeType.ChangeCellLanguage: {
          const index = getCorrespondingOriginalCellIndex(event.index, this._cellsDiffInfo.get());
          if (typeof index === "number") {
            const edit = {
              editType: CellEditType.CellLanguage,
              index,
              language: event.language
            };
            this.originalModel.applyEdits([edit], true, void 0, () => void 0, void 0, false);
          }
          break;
        }
        case NotebookCellsChangeType.ChangeCellMetadata: {
          const index = getCorrespondingOriginalCellIndex(event.index, this._cellsDiffInfo.get());
          if (typeof index === "number") {
            const edit = {
              editType: CellEditType.Metadata,
              index,
              metadata: event.metadata
            };
            this.originalModel.applyEdits([edit], true, void 0, () => void 0, void 0, false);
          }
          break;
        }
        case NotebookCellsChangeType.ChangeCellMime:
          break;
        case NotebookCellsChangeType.ChangeCellInternalMetadata: {
          const index = getCorrespondingOriginalCellIndex(event.index, this._cellsDiffInfo.get());
          if (typeof index === "number") {
            const edit = {
              editType: CellEditType.PartialInternalMetadata,
              index,
              internalMetadata: event.internalMetadata
            };
            this.originalModel.applyEdits([edit], true, void 0, () => void 0, void 0, false);
          }
          break;
        }
        case NotebookCellsChangeType.Output: {
          const index = getCorrespondingOriginalCellIndex(event.index, this._cellsDiffInfo.get());
          if (typeof index === "number") {
            const edit = {
              editType: CellEditType.Output,
              index,
              append: event.append,
              outputs: event.outputs
            };
            this.originalModel.applyEdits([edit], true, void 0, () => void 0, void 0, false);
          }
          break;
        }
        case NotebookCellsChangeType.OutputItem: {
          const index = getCorrespondingOriginalCellIndex(event.index, this._cellsDiffInfo.get());
          if (typeof index === "number") {
            const edit = {
              editType: CellEditType.OutputItems,
              outputId: event.outputId,
              append: event.append,
              items: event.outputItems
            };
            this.originalModel.applyEdits([edit], true, void 0, () => void 0, void 0, false);
          }
          break;
        }
        case NotebookCellsChangeType.Move: {
          const result = adjustCellDiffAndOriginalModelBasedOnCellMovements(event, this._cellsDiffInfo.get().slice());
          if (result) {
            this.originalModel.applyEdits(result[1], true, void 0, () => void 0, void 0, false);
            this._cellsDiffInfo.set(result[0], void 0);
          }
          break;
        }
        default: {
          break;
        }
      }
    }
    didResetToOriginalContent = this.initialContentComparer.isEqual(this.modifiedModel);
    if (currentState === WorkingSetEntryState.Modified && didResetToOriginalContent) {
      this._stateObs.set(WorkingSetEntryState.Rejected, void 0);
      this.updateCellDiffInfo([], void 0);
      this.initializeModelsFromDiff();
      return;
    }
  }
  async _doAccept(tx) {
    this.updateCellDiffInfo([], tx);
    const snapshot = createSnapshot(this.modifiedModel, this.transientOptions, this.configurationService);
    restoreSnapshot(this.originalModel, snapshot);
    this.initializeModelsFromDiff();
    await this._collapse(tx);
    const config = this._fileConfigService.getAutoSaveConfiguration(this.modifiedURI);
    if (this.modifiedModel.uri.scheme !== Schemas.untitled && (!config.autoSave || !this.notebookResolver.isDirty(this.modifiedURI))) {
      await this._applyEdits(async () => {
        try {
          await this.modifiedResourceRef.object.save({
            reason: SaveReason.EXPLICIT,
            force: true
          });
        } catch {
        }
      });
    }
  }
  async _doReject(tx) {
    this.updateCellDiffInfo([], tx);
    if (this.createdInRequestId === this._telemetryInfo.requestId) {
      await this._applyEdits(async () => {
        await this.modifiedResourceRef.object.revert({ soft: true });
        await this._fileService.del(this.modifiedURI);
      });
      this._onDidDelete.fire();
    } else {
      await this._applyEdits(async () => {
        const snapshot = createSnapshot(this.originalModel, this.transientOptions, this.configurationService);
        this.restoreSnapshotInModifiedModel(snapshot);
        if (this._allEditsAreFromUs && Array.from(this.cellEntryMap.values()).every((entry) => entry.allEditsAreFromUs)) {
          await this.modifiedResourceRef.object.save({ reason: SaveReason.EXPLICIT, skipSaveParticipants: true });
        }
      });
      this.initializeModelsFromDiff();
      await this._collapse(tx);
    }
  }
  async _collapse(transaction2) {
    this._multiDiffEntryDelegate.collapse(transaction2);
  }
  _createEditorIntegration(editor) {
    const notebookEditor = getNotebookEditorFromEditorPane(editor);
    if (!notebookEditor && editor.getId() === NotebookTextDiffEditor.ID) {
      const diffEditor = editor.getControl();
      return this._instantiationService.createInstance(ChatEditingNotebookDiffEditorIntegration, diffEditor, this._cellsDiffInfo);
    }
    assertType(notebookEditor);
    return this._instantiationService.createInstance(ChatEditingNotebookEditorIntegration, this, editor, this.modifiedModel, this.originalModel, this._cellsDiffInfo);
  }
  _resetEditsState(tx) {
    super._resetEditsState(tx);
    this.cellEntryMap.forEach((entry) => !entry.disposed && entry.clearCurrentEditLineDecoration());
  }
  _createUndoRedoElement(response) {
    const request = response.session.getRequests().find((req) => req.id === response.requestId);
    const label = request?.message.text ? localize("chatNotebookEdit1", "Chat Edit: '{0}'", request.message.text) : localize("chatNotebookEdit2", "Chat Edit");
    const transientOptions = this.transientOptions;
    const outputSizeLimit = this.configurationService.getValue(NotebookSetting.outputBackupSizeLimit) * 1024;
    let initial = createSnapshot(this.modifiedModel, transientOptions, outputSizeLimit);
    let last = "";
    return {
      type: UndoRedoElementType.Resource,
      resource: this.modifiedURI,
      label,
      code: "chat.edit",
      confirmBeforeUndo: false,
      undo: async () => {
        last = createSnapshot(this.modifiedModel, transientOptions, outputSizeLimit);
        restoreSnapshot(this.modifiedModel, initial);
      },
      redo: async () => {
        initial = createSnapshot(this.modifiedModel, transientOptions, outputSizeLimit);
        restoreSnapshot(this.modifiedModel, last);
      }
    };
  }
  async _areOriginalAndModifiedIdentical() {
    return this._areOriginalAndModifiedIdenticalImpl();
  }
  _areOriginalAndModifiedIdenticalImpl() {
    const snapshot = createSnapshot(this.originalModel, this.transientOptions, this.configurationService);
    return new SnapshotComparer(snapshot).isEqual(this.modifiedModel);
  }
  async acceptAgentEdits(resource, edits, isLastEdits, responseModel) {
    const isCellUri = resource.scheme === Schemas.vscodeNotebookCell;
    const cell = isCellUri && this.modifiedModel.cells.find((cell2) => isEqual(cell2.uri, resource));
    let cellEntry;
    if (cell) {
      const index = this.modifiedModel.cells.indexOf(cell);
      const entry = this._cellsDiffInfo.get().slice().find((entry2) => entry2.modifiedCellIndex === index);
      if (!entry) {
        console.error("Original cell model not found");
        return;
      }
      cellEntry = this.getOrCreateModifiedTextFileEntryForCell(cell, await entry.modifiedModel.promise, await entry.originalModel.promise);
    }
    const finishPreviousCells = () => {
      this.editedCells.forEach((uri) => {
        const cell2 = this.modifiedModel.cells.find((cell3) => isEqual(cell3.uri, uri));
        const cellEntry2 = cell2 && this.cellEntryMap.get(cell2.uri);
        cellEntry2?.acceptAgentEdits([], true, responseModel);
      });
      this.editedCells.clear();
    };
    this._applyEditsSync(async () => {
      edits.map((edit) => {
        if (TextEdit.isTextEdit(edit)) {
          if (isEqual(resource, this.modifiedModel.uri)) {
            this.newNotebookEditGenerator ??= this._instantiationService.createInstance(ChatEditingNewNotebookContentEdits, this.modifiedModel);
            this.newNotebookEditGenerator.acceptTextEdits([edit]);
          } else {
            this.newNotebookEditGenerator = void 0;
            if (!this.editedCells.has(resource)) {
              finishPreviousCells();
              this.editedCells.add(resource);
            }
            cellEntry?.acceptAgentEdits([edit], isLastEdits, responseModel);
          }
        } else {
          this.newNotebookEditGenerator = void 0;
          this.acceptNotebookEdit(edit);
        }
      });
    });
    if (isLastEdits) {
      finishPreviousCells();
    }
    isLastEdits = !isCellUri && isLastEdits;
    if (isLastEdits && this.newNotebookEditGenerator) {
      const notebookEdits = await this.newNotebookEditGenerator.generateEdits();
      this.newNotebookEditGenerator = void 0;
      notebookEdits.forEach((edit) => this.acceptNotebookEdit(edit));
    }
    transaction((tx) => {
      if (!isLastEdits) {
        this._stateObs.set(WorkingSetEntryState.Modified, tx);
        this._isCurrentlyBeingModifiedByObs.set(responseModel, tx);
        const newRewriteRation = Math.max(this._rewriteRatioObs.get(), calculateNotebookRewriteRatio(this._cellsDiffInfo.get(), this.originalModel, this.modifiedModel));
        this._rewriteRatioObs.set(Math.min(1, newRewriteRation), tx);
      } else {
        finishPreviousCells();
        this.editedCells.clear();
        this._resetEditsState(tx);
        this._rewriteRatioObs.set(1, tx);
      }
    });
  }
  disposeDeletedCellEntries() {
    const cellsUris = new ResourceSet(this.modifiedModel.cells.map((cell) => cell.uri));
    Array.from(this.cellEntryMap.keys()).forEach((uri) => {
      if (cellsUris.has(uri)) {
        return;
      }
      this.cellEntryMap.get(uri)?.dispose();
      this.cellEntryMap.delete(uri);
    });
  }
  acceptNotebookEdit(edit) {
    this.modifiedModel.applyEdits([edit], true, void 0, () => void 0, void 0, false);
    this.disposeDeletedCellEntries();
    if (edit.editType !== CellEditType.Replace) {
      return;
    }
    edit.cells.forEach((_, i) => {
      const index = edit.index + i;
      const cell = this.modifiedModel.cells[index];
      if (cell.internalMetadata.internalId) {
        return;
      }
      const internalId = generateCellHash(cell.uri);
      const edits = [{ editType: CellEditType.PartialInternalMetadata, index, internalMetadata: { internalId } }];
      this.modifiedModel.applyEdits(edits, true, void 0, () => void 0, void 0, false);
    });
    let diff = [];
    if (edit.count === 0) {
      diff = sortCellChanges(this._cellsDiffInfo.get());
      diff.forEach((d) => {
        if (d.type !== "delete" && d.modifiedCellIndex >= edit.index) {
          d.modifiedCellIndex += edit.cells.length;
        }
      });
      const diffInsert = edit.cells.map((_, i) => this.createInsertedCellDiffInfo(edit.index + i));
      diff.splice(edit.index, 0, ...diffInsert);
    } else {
      diff = sortCellChanges(this._cellsDiffInfo.get()).map((d) => {
        if (d.type === "unchanged" && d.modifiedCellIndex >= edit.index && d.modifiedCellIndex <= edit.index + edit.count - 1) {
          return this.createDeleteCellDiffInfo(d.originalCellIndex);
        }
        if (d.type !== "delete" && d.modifiedCellIndex >= edit.index + edit.count) {
          d.modifiedCellIndex -= edit.count;
          return d;
        }
        return d;
      });
    }
    this.updateCellDiffInfo(diff, void 0);
  }
  computeStateAfterAcceptingRejectingChanges(accepted) {
    const currentSnapshot = createSnapshot(this.modifiedModel, this.transientOptions, this.configurationService);
    if (new SnapshotComparer(currentSnapshot).isEqual(this.originalModel)) {
      const state = accepted ? WorkingSetEntryState.Accepted : WorkingSetEntryState.Rejected;
      this._stateObs.set(state, void 0);
    }
  }
  createModifiedCellDiffInfo(modifiedCellIndex, originalCellIndex) {
    const modifiedCell = this.modifiedModel.cells[modifiedCellIndex];
    const originalCell = this.originalModel.cells[originalCellIndex];
    this.modifiedToOriginalCell.set(modifiedCell.uri, originalCell.uri);
    const modifiedCellModelPromise = this.resolveCellModel(modifiedCell.uri);
    const originalCellModelPromise = this.resolveCellModel(originalCell.uri);
    Promise.all([modifiedCellModelPromise, originalCellModelPromise]).then(([modifiedCellModel, originalCellModel]) => {
      this.getOrCreateModifiedTextFileEntryForCell(modifiedCell, modifiedCellModel, originalCellModel);
    });
    const diff = observableValue("diff", nullDocumentDiff);
    const unchangedCell = {
      type: "unchanged",
      modifiedCellIndex,
      originalCellIndex,
      keep: async (changes) => {
        const [modifiedCellModel, originalCellModel] = await Promise.all([modifiedCellModelPromise, originalCellModelPromise]);
        const entry = this.getOrCreateModifiedTextFileEntryForCell(modifiedCell, modifiedCellModel, originalCellModel);
        return entry ? entry.keep(changes) : false;
      },
      undo: async (changes) => {
        const [modifiedCellModel, originalCellModel] = await Promise.all([modifiedCellModelPromise, originalCellModelPromise]);
        const entry = this.getOrCreateModifiedTextFileEntryForCell(modifiedCell, modifiedCellModel, originalCellModel);
        return entry ? entry.undo(changes) : false;
      },
      modifiedModel: new ObservablePromise(modifiedCellModelPromise),
      originalModel: new ObservablePromise(originalCellModelPromise),
      diff
    };
    return unchangedCell;
  }
  createInsertedCellDiffInfo(modifiedCellIndex) {
    const cell = this.modifiedModel.cells[modifiedCellIndex];
    const lines = cell.getValue().split(/\r?\n/);
    const originalRange = new Range(1, 0, 1, 0);
    const modifiedRange = new Range(1, 0, lines.length, lines[lines.length - 1].length);
    const innerChanges = new RangeMapping(originalRange, modifiedRange);
    const changes = [new DetailedLineRangeMapping(new LineRange(1, 1), new LineRange(1, lines.length), [innerChanges])];
    const originalModelUri = this.modifiedModel.uri.with({ query: (ChatEditingModifiedNotebookEntry.NewModelCounter++).toString(), scheme: "emptyCell" });
    const originalModel = this.modelService.getModel(originalModelUri) || this._register(this.modelService.createModel("", null, originalModelUri));
    this.modifiedToOriginalCell.set(cell.uri, originalModelUri);
    const keep = async () => {
      this._applyEditsSync(() => this.keepPreviouslyInsertedCell(cell));
      this.computeStateAfterAcceptingRejectingChanges(true);
      return true;
    };
    const undo = async () => {
      this._applyEditsSync(() => this.undoPreviouslyInsertedCell(cell));
      this.computeStateAfterAcceptingRejectingChanges(false);
      return true;
    };
    this.resolveCellModel(cell.uri).then((modifiedModel) => {
      this.getOrCreateModifiedTextFileEntryForCell(cell, modifiedModel, originalModel);
    });
    return {
      type: "insert",
      originalCellIndex: void 0,
      modifiedCellIndex,
      keep,
      undo,
      modifiedModel: new ObservablePromise(this.resolveCellModel(cell.uri)),
      originalModel: new ObservablePromise(Promise.resolve(originalModel)),
      diff: observableValue("deletedCellDiff", {
        changes,
        identical: false,
        moves: [],
        quitEarly: false
      })
    };
  }
  createDeleteCellDiffInfo(originalCellIndex) {
    const originalCell = this.originalModel.cells[originalCellIndex];
    const lines = new Array(originalCell.textBuffer.getLineCount()).fill(0).map((_, i) => originalCell.textBuffer.getLineContent(i + 1));
    const originalRange = new Range(1, 0, lines.length, lines[lines.length - 1].length);
    const modifiedRange = new Range(1, 0, 1, 0);
    const innerChanges = new RangeMapping(modifiedRange, originalRange);
    const changes = [new DetailedLineRangeMapping(new LineRange(1, lines.length), new LineRange(1, 1), [innerChanges])];
    const modifiedModelUri = this.modifiedModel.uri.with({ query: (ChatEditingModifiedNotebookEntry.NewModelCounter++).toString(), scheme: "emptyCell" });
    const modifiedModel = this.modelService.getModel(modifiedModelUri) || this._register(this.modelService.createModel("", null, modifiedModelUri));
    const keep = async () => {
      this._applyEditsSync(() => this.keepPreviouslyDeletedCell(this.originalModel.cells.indexOf(originalCell)));
      this.computeStateAfterAcceptingRejectingChanges(true);
      return true;
    };
    const undo = async () => {
      this._applyEditsSync(() => this.undoPreviouslyDeletedCell(this.originalModel.cells.indexOf(originalCell), originalCell));
      this.computeStateAfterAcceptingRejectingChanges(false);
      return true;
    };
    return {
      type: "delete",
      modifiedCellIndex: void 0,
      originalCellIndex,
      originalModel: new ObservablePromise(this.resolveCellModel(originalCell.uri)),
      modifiedModel: new ObservablePromise(Promise.resolve(modifiedModel)),
      keep,
      undo,
      diff: observableValue("cellDiff", {
        changes,
        identical: false,
        moves: [],
        quitEarly: false
      })
    };
  }
  undoPreviouslyInsertedCell(cell) {
    let diffs = [];
    this._applyEditsSync(() => {
      const index = this.modifiedModel.cells.indexOf(cell);
      diffs = adjustCellDiffForRevertingAnInsertedCell(
        index,
        this._cellsDiffInfo.get(),
        this.modifiedModel.applyEdits.bind(this.modifiedModel)
      );
    });
    this.disposeDeletedCellEntries();
    this.updateCellDiffInfo(diffs, void 0);
  }
  keepPreviouslyInsertedCell(cell) {
    const modifiedCellIndex = this.modifiedModel.cells.indexOf(cell);
    if (modifiedCellIndex === -1) {
      return;
    }
    const cellToInsert = {
      cellKind: cell.cellKind,
      language: cell.language,
      metadata: cell.metadata,
      outputs: cell.outputs,
      source: cell.getValue(),
      mime: cell.mime,
      internalMetadata: {
        internalId: cell.internalMetadata.internalId
      }
    };
    this.cellEntryMap.get(cell.uri)?.dispose();
    this.cellEntryMap.delete(cell.uri);
    const cellDiffs = adjustCellDiffForKeepingAnInsertedCell(
      modifiedCellIndex,
      this._cellsDiffInfo.get().slice(),
      cellToInsert,
      this.originalModel.applyEdits.bind(this.originalModel),
      this.createModifiedCellDiffInfo.bind(this)
    );
    this.updateCellDiffInfo(cellDiffs, void 0);
  }
  undoPreviouslyDeletedCell(deletedOriginalIndex, originalCell) {
    const cellToInsert = {
      cellKind: originalCell.cellKind,
      language: originalCell.language,
      metadata: originalCell.metadata,
      outputs: originalCell.outputs,
      source: originalCell.getValue(),
      mime: originalCell.mime,
      internalMetadata: {
        internalId: originalCell.internalMetadata.internalId
      }
    };
    let cellDiffs = [];
    this._applyEditsSync(() => {
      cellDiffs = adjustCellDiffForRevertingADeletedCell(
        deletedOriginalIndex,
        this._cellsDiffInfo.get(),
        cellToInsert,
        this.modifiedModel.applyEdits.bind(this.modifiedModel),
        this.createModifiedCellDiffInfo.bind(this)
      );
    });
    this.updateCellDiffInfo(cellDiffs, void 0);
  }
  keepPreviouslyDeletedCell(deletedOriginalIndex) {
    const edit = { cells: [], count: 1, editType: CellEditType.Replace, index: deletedOriginalIndex };
    this.originalModel.applyEdits([edit], true, void 0, () => void 0, void 0, false);
    const diffs = sortCellChanges(this._cellsDiffInfo.get()).filter((d) => !(d.type === "delete" && d.originalCellIndex === deletedOriginalIndex)).map((diff) => {
      if (diff.type !== "insert" && diff.originalCellIndex > deletedOriginalIndex) {
        return {
          ...diff,
          originalCellIndex: diff.originalCellIndex - 1
        };
      }
      return diff;
    });
    this.updateCellDiffInfo(diffs, void 0);
  }
  async _applyEdits(operation) {
    this._isEditFromUs = true;
    try {
      await operation();
    } finally {
      this._isEditFromUs = false;
    }
  }
  _applyEditsSync(operation) {
    this._isEditFromUs = true;
    try {
      operation();
    } finally {
      this._isEditFromUs = false;
    }
  }
  createSnapshot(requestId, undoStop) {
    return {
      resource: this.modifiedURI,
      languageId: SnapshotLanguageId,
      snapshotUri: getNotebookSnapshotFileURI(this._telemetryInfo.sessionId, requestId, undoStop, this.modifiedURI.path, this.modifiedModel.viewType),
      original: createSnapshot(this.originalModel, this.transientOptions, this.configurationService),
      current: createSnapshot(this.modifiedModel, this.transientOptions, this.configurationService),
      originalToCurrentEdit: OffsetEdit.empty,
      state: this.state.get(),
      telemetryInfo: this.telemetryInfo
    };
  }
  equalsSnapshot(snapshot) {
    return !!snapshot && isEqual(this.modifiedURI, snapshot.resource) && this.state.get() === snapshot.state && new SnapshotComparer(snapshot.original).isEqual(this.originalModel) && new SnapshotComparer(snapshot.current).isEqual(this.modifiedModel);
  }
  restoreFromSnapshot(snapshot, restoreToDisk = true) {
    this.updateCellDiffInfo([], void 0);
    this._stateObs.set(snapshot.state, void 0);
    restoreSnapshot(this.originalModel, snapshot.original);
    if (restoreToDisk) {
      this.restoreSnapshotInModifiedModel(snapshot.current);
    }
    this.initializeModelsFromDiff();
  }
  resetToInitialContent() {
    this.updateCellDiffInfo([], void 0);
    this.restoreSnapshotInModifiedModel(this.initialContent);
    this.initializeModelsFromDiff();
  }
  restoreSnapshotInModifiedModel(snapshot) {
    if (snapshot === createSnapshot(this.modifiedModel, this.transientOptions, this.configurationService)) {
      return;
    }
    this._applyEditsSync(() => {
      this.modifiedModel.pushStackElement();
      restoreSnapshot(this.modifiedModel, snapshot);
      this.modifiedModel.pushStackElement();
    });
  }
  async resolveCellModel(cellURI) {
    const cell = this.originalModel.cells.concat(this.modifiedModel.cells).find((cell2) => isEqual(cell2.uri, cellURI));
    if (!cell) {
      throw new Error("Cell not found");
    }
    const model = this.cellTextModelMap.get(cell.uri) || this._register(await this.textModelService.createModelReference(cell.uri)).object.textEditorModel;
    this.cellTextModelMap.set(cell.uri, model);
    return model;
  }
  getOrCreateModifiedTextFileEntryForCell(cell, modifiedCellModel, originalCellModel) {
    let cellEntry = this.cellEntryMap.get(cell.uri);
    if (cellEntry) {
      return cellEntry;
    }
    const disposables = new DisposableStore();
    cellEntry = this._register(this._instantiationService.createInstance(ChatEditingNotebookCellEntry, this.modifiedResourceRef.object.resource, cell, modifiedCellModel, originalCellModel, disposables));
    this.cellEntryMap.set(cell.uri, cellEntry);
    disposables.add(autorun((r) => {
      if (this.modifiedModel.cells.indexOf(cell) === -1) {
        return;
      }
      const diffs = this.cellsDiffInfo.get().slice();
      const index = this.modifiedModel.cells.indexOf(cell);
      let entry = diffs.find((entry2) => entry2.modifiedCellIndex === index);
      if (!entry) {
        return;
      }
      const entryIndex = diffs.indexOf(entry);
      entry.diff.set(cellEntry.diffInfo.read(r), void 0);
      if (cellEntry.diffInfo.get().identical && entry.type === "modified") {
        entry = {
          ...entry,
          type: "unchanged"
        };
      }
      if (!cellEntry.diffInfo.get().identical && entry.type === "unchanged") {
        entry = {
          ...entry,
          type: "modified"
        };
      }
      diffs.splice(entryIndex, 1, { ...entry });
      transaction((tx) => {
        this.updateCellDiffInfo(diffs, tx);
      });
    }));
    disposables.add(autorun((r) => {
      if (this.modifiedModel.cells.indexOf(cell) === -1) {
        return;
      }
      const cellState = cellEntry.state.read(r);
      if (cellState === WorkingSetEntryState.Accepted) {
        this.computeStateAfterAcceptingRejectingChanges(true);
      } else if (cellState === WorkingSetEntryState.Rejected) {
        this.computeStateAfterAcceptingRejectingChanges(false);
      }
    }));
    return cellEntry;
  }
};
ChatEditingModifiedNotebookEntry.NewModelCounter = 0;
ChatEditingModifiedNotebookEntry = __decorateClass([
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IFilesConfigurationService),
  __decorateParam(9, IChatService),
  __decorateParam(10, IFileService),
  __decorateParam(11, IInstantiationService),
  __decorateParam(12, ITextModelService),
  __decorateParam(13, IModelService),
  __decorateParam(14, IUndoRedoService),
  __decorateParam(15, INotebookEditorWorkerService),
  __decorateParam(16, INotebookLoggingService),
  __decorateParam(17, INotebookEditorModelResolverService)
], ChatEditingModifiedNotebookEntry);
function generateCellHash(cellUri) {
  const hash = new StringSHA1();
  hash.update(cellUri.toString());
  return hash.digest().substring(0, 8);
}
export {
  ChatEditingModifiedNotebookEntry
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdEVkaXRpbmcvY2hhdEVkaXRpbmdNb2RpZmllZE5vdGVib29rRW50cnkudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBzdHJlYW1Ub0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBTdHJpbmdTSEExIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaGFzaC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIElSZWZlcmVuY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VNYXAsIFJlc291cmNlU2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IElUcmFuc2FjdGlvbiwgSU9ic2VydmFibGUsIG9ic2VydmFibGVWYWx1ZSwgYXV0b3J1biwgdHJhbnNhY3Rpb24sIE9ic2VydmFibGVQcm9taXNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZS5qcyc7XG5pbXBvcnQgeyBpc0VxdWFsIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IGFzc2VydFR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVVdWlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXVpZC5qcyc7XG5pbXBvcnQgeyBMaW5lUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvbGluZVJhbmdlLmpzJztcbmltcG9ydCB7IE9mZnNldEVkaXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvb2Zmc2V0RWRpdC5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBudWxsRG9jdW1lbnREaWZmIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9kaWZmL2RvY3VtZW50RGlmZlByb3ZpZGVyLmpzJztcbmltcG9ydCB7IERldGFpbGVkTGluZVJhbmdlTWFwcGluZywgUmFuZ2VNYXBwaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9kaWZmL3JhbmdlTWFwcGluZy5qcyc7XG5pbXBvcnQgeyBUZXh0RWRpdCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJVW5kb1JlZG9FbGVtZW50LCBJVW5kb1JlZG9TZXJ2aWNlLCBVbmRvUmVkb0VsZW1lbnRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdW5kb1JlZG8vY29tbW9uL3VuZG9SZWRvLmpzJztcbmltcG9ydCB7IElFZGl0b3JQYW5lLCBTYXZlUmVhc29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJRmlsZXNDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2ZpbGVzQ29uZmlndXJhdGlvbi9jb21tb24vZmlsZXNDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBTbmFwc2hvdENvbnRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy93b3JraW5nQ29weS9jb21tb24vZmlsZVdvcmtpbmdDb3B5LmpzJztcbmltcG9ydCB7IE5vdGVib29rVGV4dERpZmZFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi9ub3RlYm9vay9icm93c2VyL2RpZmYvbm90ZWJvb2tEaWZmRWRpdG9yLmpzJztcbmltcG9ydCB7IElOb3RlYm9va1RleHREaWZmRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vbm90ZWJvb2svYnJvd3Nlci9kaWZmL25vdGVib29rRGlmZkVkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgQ2VsbERpZmZJbmZvIH0gZnJvbSAnLi4vLi4vLi4vbm90ZWJvb2svYnJvd3Nlci9kaWZmL25vdGVib29rRGlmZlZpZXdNb2RlbC5qcyc7XG5pbXBvcnQgeyBnZXROb3RlYm9va0VkaXRvckZyb21FZGl0b3JQYW5lIH0gZnJvbSAnLi4vLi4vLi4vbm90ZWJvb2svYnJvd3Nlci9ub3RlYm9va0Jyb3dzZXIuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tDZWxsVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vbm90ZWJvb2svY29tbW9uL21vZGVsL25vdGVib29rQ2VsbFRleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va1RleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uL25vdGVib29rL2NvbW1vbi9tb2RlbC9ub3RlYm9va1RleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBDZWxsRWRpdFR5cGUsIElDZWxsRHRvMiwgSUNlbGxFZGl0T3BlcmF0aW9uLCBJQ2VsbFJlcGxhY2VFZGl0LCBJUmVzb2x2ZWROb3RlYm9va0VkaXRvck1vZGVsLCBOb3RlYm9va0NlbGxzQ2hhbmdlVHlwZSwgTm90ZWJvb2tTZXR0aW5nLCBOb3RlYm9va1RleHRNb2RlbENoYW5nZWRFdmVudCwgVHJhbnNpZW50T3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uL25vdGVib29rL2NvbW1vbi9ub3RlYm9va0NvbW1vbi5qcyc7XG5pbXBvcnQgeyBjb21wdXRlRGlmZiB9IGZyb20gJy4uLy4uLy4uL25vdGVib29rL2NvbW1vbi9ub3RlYm9va0RpZmYuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rRWRpdG9yTW9kZWxSZXNvbHZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9ub3RlYm9vay9jb21tb24vbm90ZWJvb2tFZGl0b3JNb2RlbFJlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tMb2dnaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL25vdGVib29rL2NvbW1vbi9ub3RlYm9va0xvZ2dpbmdTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElOb3RlYm9va1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9ub3RlYm9vay9jb21tb24vbm90ZWJvb2tTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0VkaXRvcldvcmtlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9ub3RlYm9vay9jb21tb24vc2VydmljZXMvbm90ZWJvb2tXb3JrZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENoYXRFZGl0S2luZCwgSU1vZGlmaWVkRmlsZUVudHJ5RWRpdG9ySW50ZWdyYXRpb24sIFdvcmtpbmdTZXRFbnRyeVN0YXRlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRFZGl0aW5nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ2hhdFJlc3BvbnNlTW9kZWwgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdE1vZGVsLmpzJztcbmltcG9ydCB7IElDaGF0U2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBBYnN0cmFjdENoYXRFZGl0aW5nTW9kaWZpZWRGaWxlRW50cnksIElNb2RpZmllZEVudHJ5VGVsZW1ldHJ5SW5mbywgSVNuYXBzaG90RW50cnkgfSBmcm9tICcuL2NoYXRFZGl0aW5nTW9kaWZpZWRGaWxlRW50cnkuanMnO1xuaW1wb3J0IHsgY3JlYXRlU25hcHNob3QsIGRlc2VyaWFsaXplU25hcHNob3QsIGdldE5vdGVib29rU25hcHNob3RGaWxlVVJJLCByZXN0b3JlU25hcHNob3QsIFNuYXBzaG90Q29tcGFyZXIgfSBmcm9tICcuL25vdGVib29rL2NoYXRFZGl0aW5nTW9kaWZpZWROb3RlYm9va1NuYXBzaG90LmpzJztcbmltcG9ydCB7IENoYXRFZGl0aW5nTmV3Tm90ZWJvb2tDb250ZW50RWRpdHMgfSBmcm9tICcuL25vdGVib29rL2NoYXRFZGl0aW5nTmV3Tm90ZWJvb2tDb250ZW50RWRpdHMuanMnO1xuaW1wb3J0IHsgQ2hhdEVkaXRpbmdOb3RlYm9va0NlbGxFbnRyeSB9IGZyb20gJy4vbm90ZWJvb2svY2hhdEVkaXRpbmdOb3RlYm9va0NlbGxFbnRyeS5qcyc7XG5pbXBvcnQgeyBDaGF0RWRpdGluZ05vdGVib29rRGlmZkVkaXRvckludGVncmF0aW9uLCBDaGF0RWRpdGluZ05vdGVib29rRWRpdG9ySW50ZWdyYXRpb24gfSBmcm9tICcuL25vdGVib29rL2NoYXRFZGl0aW5nTm90ZWJvb2tFZGl0b3JJbnRlZ3JhdGlvbi5qcyc7XG5pbXBvcnQgeyBDaGF0RWRpdGluZ05vdGVib29rRmlsZVN5c3RlbVByb3ZpZGVyIH0gZnJvbSAnLi9ub3RlYm9vay9jaGF0RWRpdGluZ05vdGVib29rRmlsZVN5c3RlbVByb3ZpZGVyLmpzJztcbmltcG9ydCB7IGFkanVzdENlbGxEaWZmQW5kT3JpZ2luYWxNb2RlbEJhc2VkT25DZWxsQWRkRGVsZXRlLCBhZGp1c3RDZWxsRGlmZkFuZE9yaWdpbmFsTW9kZWxCYXNlZE9uQ2VsbE1vdmVtZW50cywgYWRqdXN0Q2VsbERpZmZGb3JLZWVwaW5nQW5JbnNlcnRlZENlbGwsIGFkanVzdENlbGxEaWZmRm9yUmV2ZXJ0aW5nQURlbGV0ZWRDZWxsLCBhZGp1c3RDZWxsRGlmZkZvclJldmVydGluZ0FuSW5zZXJ0ZWRDZWxsLCBjYWxjdWxhdGVOb3RlYm9va1Jld3JpdGVSYXRpbywgZ2V0Q29ycmVzcG9uZGluZ09yaWdpbmFsQ2VsbEluZGV4LCBpc1RyYW5zaWVudElQeU5iRXh0ZW5zaW9uRXZlbnQgfSBmcm9tICcuL25vdGVib29rL2hlbHBlcnMuanMnO1xuaW1wb3J0IHsgY291bnRDaGFuZ2VzLCBJQ2VsbERpZmZJbmZvLCBzb3J0Q2VsbENoYW5nZXMgfSBmcm9tICcuL25vdGVib29rL25vdGVib29rQ2VsbENoYW5nZXMuanMnO1xuXG5cbmNvbnN0IFNuYXBzaG90TGFuZ3VhZ2VJZCA9ICdWU0NvZGVDaGF0Tm90ZWJvb2tTbmFwc2hvdExhbmd1YWdlJztcblxuZXhwb3J0IGNsYXNzIENoYXRFZGl0aW5nTW9kaWZpZWROb3RlYm9va0VudHJ5IGV4dGVuZHMgQWJzdHJhY3RDaGF0RWRpdGluZ01vZGlmaWVkRmlsZUVudHJ5IHtcblx0c3RhdGljIE5ld01vZGVsQ291bnRlcjogbnVtYmVyID0gMDtcblx0cHJpdmF0ZSByZWFkb25seSBtb2RpZmllZE1vZGVsOiBOb3RlYm9va1RleHRNb2RlbDtcblx0cHJpdmF0ZSByZWFkb25seSBvcmlnaW5hbE1vZGVsOiBOb3RlYm9va1RleHRNb2RlbDtcblx0b3ZlcnJpZGUgb3JpZ2luYWxVUkk6IFVSSTtcblx0LyoqXG5cdCAqIEpTT04gc3RyaW5naWZpZWQgdmVyc2lvbiBvZiB0aGUgb3JpZ2luYWwgbm90ZWJvb2suXG5cdCAqL1xuXHRvdmVycmlkZSBpbml0aWFsQ29udGVudDogc3RyaW5nO1xuXHQvKipcblx0ICogV2hldGhlciB3ZSdyZSBzdGlsbCBnZW5lcmF0aW5nIGRpZmZzIGZyb20gYSByZXNwb25zZS5cblx0ICovXG5cdHByaXZhdGUgX2lzUHJvY2Vzc2luZ1Jlc3BvbnNlID0gb2JzZXJ2YWJsZVZhbHVlPGJvb2xlYW4+KCdpc1Byb2Nlc3NpbmdSZXNwb25zZScsIGZhbHNlKTtcblx0Z2V0IGlzUHJvY2Vzc2luZ1Jlc3BvbnNlKCk6IElPYnNlcnZhYmxlPGJvb2xlYW4+IHtcblx0XHRyZXR1cm4gdGhpcy5faXNQcm9jZXNzaW5nUmVzcG9uc2U7XG5cdH1cblx0cHJpdmF0ZSBfaXNFZGl0RnJvbVVzOiBib29sZWFuID0gZmFsc2U7XG5cdC8qKlxuXHQgKiBXaGV0aGVyIGFsbCBlZGl0cyBhcmUgZnJvbSB1cywgZS5nLiBpcyBwb3NzaWJsZSBhIHVzZXIgaGFzIG1hZGUgZWRpdHMsIHRoZW4gdGhpcyB3aWxsIGJlIGZhbHNlLlxuXHQgKi9cblx0cHJpdmF0ZSBfYWxsRWRpdHNBcmVGcm9tVXM6IGJvb2xlYW4gPSB0cnVlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jaGFuZ2VzQ291bnQgPSBvYnNlcnZhYmxlVmFsdWU8bnVtYmVyPih0aGlzLCAwKTtcblx0b3ZlcnJpZGUgY2hhbmdlc0NvdW50OiBJT2JzZXJ2YWJsZTxudW1iZXI+ID0gdGhpcy5fY2hhbmdlc0NvdW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgY2VsbEVudHJ5TWFwID0gbmV3IFJlc291cmNlTWFwPENoYXRFZGl0aW5nTm90ZWJvb2tDZWxsRW50cnk+KCk7XG5cdHByaXZhdGUgbW9kaWZpZWRUb09yaWdpbmFsQ2VsbCA9IG5ldyBSZXNvdXJjZU1hcDxVUkk+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2NlbGxzRGlmZkluZm8gPSBvYnNlcnZhYmxlVmFsdWU8SUNlbGxEaWZmSW5mb1tdPignZGlmZkluZm8nLCBbXSk7XG5cblx0Z2V0IGNlbGxzRGlmZkluZm8oKTogSU9ic2VydmFibGU8SUNlbGxEaWZmSW5mb1tdPiB7XG5cdFx0cmV0dXJuIHRoaXMuX2NlbGxzRGlmZkluZm87XG5cdH1cblxuXHQvKipcblx0ICogTGlzdCBvZiBDZWxsIFVSSXMgdGhhdCBhcmUgZWRpdGVkLFxuXHQgKiBXaWxsIGJlIGNsZWFyZWQgb25jZSBhbGwgZWRpdHMgaGF2ZSBiZWVuIGFjY2VwdGVkLlxuXHQgKiBJLmUuIHRoaXMgd2lsbCBvbmx5IGNvbnRhaW4gVVJJUyB3aGlsZSBhY2NlcHRBZ2VudEVkaXRzIGlzIGJlaW5nIGNhbGxlZCAmIGJlZm9yZSBgaXNMYXN0RWRpdGAgaXMgc2VudC5cblx0ICogSS5lLiB0aGlzIGlzIHBvcHVsYXRlZCBvbmx5IHdoZW4gZWRpdHMgYXJlIGJlaW5nIHN0cmVhbWVkLlxuXHQgKi9cblx0cHJpdmF0ZSByZWFkb25seSBlZGl0ZWRDZWxscyA9IG5ldyBSZXNvdXJjZVNldCgpO1xuXG5cdHB1YmxpYyBzdGF0aWMgYXN5bmMgY3JlYXRlKHVyaTogVVJJLCBfbXVsdGlEaWZmRW50cnlEZWxlZ2F0ZTogeyBjb2xsYXBzZTogKHRyYW5zYWN0aW9uOiBJVHJhbnNhY3Rpb24gfCB1bmRlZmluZWQpID0+IHZvaWQgfSwgdGVsZW1ldHJ5SW5mbzogSU1vZGlmaWVkRW50cnlUZWxlbWV0cnlJbmZvLCBjaGF0S2luZDogQ2hhdEVkaXRLaW5kLCBpbml0aWFsQ29udGVudDogc3RyaW5nIHwgdW5kZWZpbmVkLCBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlKTogUHJvbWlzZTxBYnN0cmFjdENoYXRFZGl0aW5nTW9kaWZpZWRGaWxlRW50cnk+IHtcblx0XHRyZXR1cm4gaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oYXN5bmMgYWNjZXNzb3IgPT4ge1xuXHRcdFx0Y29uc3Qgbm90ZWJvb2tTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElOb3RlYm9va1NlcnZpY2UpO1xuXHRcdFx0Y29uc3QgcmVzb2x2ZXIgPSBhY2Nlc3Nvci5nZXQoSU5vdGVib29rRWRpdG9yTW9kZWxSZXNvbHZlclNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpZSA9IGFjY2Vzc29yLmdldChJQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgcmVzb3VyY2VSZWY6IElSZWZlcmVuY2U8SVJlc29sdmVkTm90ZWJvb2tFZGl0b3JNb2RlbD4gPSBhd2FpdCByZXNvbHZlci5yZXNvbHZlKHVyaSk7XG5cdFx0XHRjb25zdCBub3RlYm9vayA9IHJlc291cmNlUmVmLm9iamVjdC5ub3RlYm9vaztcblx0XHRcdGNvbnN0IG9yaWdpbmFsVXJpID0gZ2V0Tm90ZWJvb2tTbmFwc2hvdEZpbGVVUkkodGVsZW1ldHJ5SW5mby5zZXNzaW9uSWQsIHRlbGVtZXRyeUluZm8ucmVxdWVzdElkLCBnZW5lcmF0ZVV1aWQoKSwgbm90ZWJvb2sudXJpLnNjaGVtZSA9PT0gU2NoZW1hcy51bnRpdGxlZCA/IGAvJHtub3RlYm9vay51cmkucGF0aH1gIDogbm90ZWJvb2sudXJpLnBhdGgsIG5vdGVib29rLnZpZXdUeXBlKTtcblx0XHRcdGNvbnN0IFtvcHRpb25zLCBidWZmZXJdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuXHRcdFx0XHRub3RlYm9va1NlcnZpY2Uud2l0aE5vdGVib29rRGF0YVByb3ZpZGVyKHJlc291cmNlUmVmLm9iamVjdC5ub3RlYm9vay5ub3RlYm9va1R5cGUpLFxuXHRcdFx0XHRub3RlYm9va1NlcnZpY2UuY3JlYXRlTm90ZWJvb2tUZXh0RG9jdW1lbnRTbmFwc2hvdChub3RlYm9vay51cmksIFNuYXBzaG90Q29udGV4dC5CYWNrdXAsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpLnRoZW4ocyA9PiBzdHJlYW1Ub0J1ZmZlcihzKSlcblx0XHRcdF0pO1xuXHRcdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0XHQvLyBSZWdpc3RlciBzbyB0aGF0IHdlIGNhbiBsb2FkIHRoaXMgZnJvbSBmaWxlIHN5c3RlbS5cblx0XHRcdGRpc3Bvc2FibGVzLmFkZChDaGF0RWRpdGluZ05vdGVib29rRmlsZVN5c3RlbVByb3ZpZGVyLnJlZ2lzdGVyRmlsZShvcmlnaW5hbFVyaSwgYnVmZmVyKSk7XG5cdFx0XHRjb25zdCBvcmlnaW5hbFJlZiA9IGF3YWl0IHJlc29sdmVyLnJlc29sdmUob3JpZ2luYWxVcmksIG5vdGVib29rLnZpZXdUeXBlKTtcblx0XHRcdGlmIChpbml0aWFsQ29udGVudCkge1xuXHRcdFx0XHRyZXN0b3JlU25hcHNob3Qob3JpZ2luYWxSZWYub2JqZWN0Lm5vdGVib29rLCBpbml0aWFsQ29udGVudCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpbml0aWFsQ29udGVudCA9IGNyZWF0ZVNuYXBzaG90KG5vdGVib29rLCBvcHRpb25zLnNlcmlhbGl6ZXIub3B0aW9ucywgY29uZmlndXJhdGlvblNlcnZpZSk7XG5cdFx0XHRcdC8vIEJvdGggbW9kZWxzIGFyZSB0aGUgc2FtZSwgZW5zdXJlIHRoZSBjZWxsIGlkcyBhcmUgdGhlIHNhbWUsIHRoaXMgd2F5IHdlIGdldCBhIHBlcmZlY3QgZGlmZmluZy5cblx0XHRcdFx0Ly8gTm8gbmVlZCB0byBnZW5lcmF0ZSBlZGl0cyBmb3IgdGhpcy5cblx0XHRcdFx0Ly8gV2Ugd2FudCB0byBlbnN1cmUgdGhleSBhcmUgaWRlbnRpdGNhbCwgcG9zc2libGUgb3JpZ2luYWwgbm90ZWJvb2sgd2FzIG9wZW4gYW5kIGdvdCBtb2RpZmllZC5cblx0XHRcdFx0Ly8gT3Igc29tZXRoaW5nIGdldHMgY2hhbmdlZCBiZXR3ZWVuIHNlcmlhbGl6YXRpb24gJiBkZXNlcmlhbGl6YXRpb24gb2YgdGhlIHNuYXBzaG90IGludG8gdGhlIG9yaWdpbmFsLlxuXHRcdFx0XHQvLyBFLmcuIGluIGp1cHl0ZXIgbm90ZWJvb2tzIHRoZSBtZXRhZGF0YSBjb250YWlucyB0cmFuc2llbnQgZGF0YSB0aGF0IGdldHMgdXBkYXRlZCBhZnRlciBkZXNlcmlhbGl6YXRpb24uXG5cdFx0XHRcdHJlc3RvcmVTbmFwc2hvdChvcmlnaW5hbFJlZi5vYmplY3Qubm90ZWJvb2ssIGluaXRpYWxDb250ZW50KTtcblx0XHRcdFx0Y29uc3QgZWRpdHM6IElDZWxsRWRpdE9wZXJhdGlvbltdID0gW107XG5cdFx0XHRcdG5vdGVib29rLmNlbGxzLmZvckVhY2goKGNlbGwsIGluZGV4KSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgaW50ZXJuYWxJZCA9IGdlbmVyYXRlQ2VsbEhhc2goY2VsbC51cmkpO1xuXHRcdFx0XHRcdGVkaXRzLnB1c2goeyBlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlBhcnRpYWxJbnRlcm5hbE1ldGFkYXRhLCBpbmRleCwgaW50ZXJuYWxNZXRhZGF0YTogeyBpbnRlcm5hbElkIH0gfSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRyZXNvdXJjZVJlZi5vYmplY3Qubm90ZWJvb2suYXBwbHlFZGl0cyhlZGl0cywgdHJ1ZSwgdW5kZWZpbmVkLCAoKSA9PiB1bmRlZmluZWQsIHVuZGVmaW5lZCwgZmFsc2UpO1xuXHRcdFx0XHRvcmlnaW5hbFJlZi5vYmplY3Qubm90ZWJvb2suYXBwbHlFZGl0cyhlZGl0cywgdHJ1ZSwgdW5kZWZpbmVkLCAoKSA9PiB1bmRlZmluZWQsIHVuZGVmaW5lZCwgZmFsc2UpO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgaW5zdGFuY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDaGF0RWRpdGluZ01vZGlmaWVkTm90ZWJvb2tFbnRyeSwgcmVzb3VyY2VSZWYsIG9yaWdpbmFsUmVmLCBfbXVsdGlEaWZmRW50cnlEZWxlZ2F0ZSwgb3B0aW9ucy5zZXJpYWxpemVyLm9wdGlvbnMsIHRlbGVtZXRyeUluZm8sIGNoYXRLaW5kLCBpbml0aWFsQ29udGVudCk7XG5cdFx0XHRpbnN0YW5jZS5fcmVnaXN0ZXIoZGlzcG9zYWJsZXMpO1xuXHRcdFx0cmV0dXJuIGluc3RhbmNlO1xuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBjYW5IYW5kbGVTbmFwc2hvdENvbnRlbnQoaW5pdGlhbENvbnRlbnQ6IHN0cmluZyB8IHVuZGVmaW5lZCk6IGJvb2xlYW4ge1xuXHRcdGlmICghaW5pdGlhbENvbnRlbnQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0ZGVzZXJpYWxpemVTbmFwc2hvdChpbml0aWFsQ29udGVudCk7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9IGNhdGNoIChleCkge1xuXHRcdFx0Ly8gbm90IGEgdmFsaWQgc25hcHNob3Rcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIGNhbkhhbmRsZVNuYXBzaG90KHNuYXBzaG90OiBJU25hcHNob3RFbnRyeSk6IGJvb2xlYW4ge1xuXHRcdGlmIChzbmFwc2hvdC5sYW5ndWFnZUlkID09PSBTbmFwc2hvdExhbmd1YWdlSWQgJiYgQ2hhdEVkaXRpbmdNb2RpZmllZE5vdGVib29rRW50cnkuY2FuSGFuZGxlU25hcHNob3RDb250ZW50KHNuYXBzaG90LmN1cnJlbnQpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBpbml0aWFsQ29udGVudENvbXBhcmVyOiBTbmFwc2hvdENvbXBhcmVyO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbW9kaWZpZWRSZXNvdXJjZVJlZjogSVJlZmVyZW5jZTxJUmVzb2x2ZWROb3RlYm9va0VkaXRvck1vZGVsPixcblx0XHRvcmlnaW5hbFJlc291cmNlUmVmOiBJUmVmZXJlbmNlPElSZXNvbHZlZE5vdGVib29rRWRpdG9yTW9kZWw+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX211bHRpRGlmZkVudHJ5RGVsZWdhdGU6IHsgY29sbGFwc2U6ICh0cmFuc2FjdGlvbjogSVRyYW5zYWN0aW9uIHwgdW5kZWZpbmVkKSA9PiB2b2lkIH0sXG5cdFx0cHJpdmF0ZSByZWFkb25seSB0cmFuc2llbnRPcHRpb25zOiBUcmFuc2llbnRPcHRpb25zIHwgdW5kZWZpbmVkLFxuXHRcdHRlbGVtZXRyeUluZm86IElNb2RpZmllZEVudHJ5VGVsZW1ldHJ5SW5mbyxcblx0XHRraW5kOiBDaGF0RWRpdEtpbmQsXG5cdFx0aW5pdGlhbENvbnRlbnQ6IHN0cmluZyxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UgZmlsZUNvbmZpZ1NlcnZpY2U6IElGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ2hhdFNlcnZpY2UgY2hhdFNlcnZpY2U6IElDaGF0U2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGV4dE1vZGVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRleHRNb2RlbFNlcnZpY2U6IElUZXh0TW9kZWxTZXJ2aWNlLFxuXHRcdEBJTW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlLFxuXHRcdEBJVW5kb1JlZG9TZXJ2aWNlIHVuZG9SZWRvU2VydmljZTogSVVuZG9SZWRvU2VydmljZSxcblx0XHRASU5vdGVib29rRWRpdG9yV29ya2VyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGVib29rRWRpdG9yV29ya2VyU2VydmljZTogSU5vdGVib29rRWRpdG9yV29ya2VyU2VydmljZSxcblx0XHRASU5vdGVib29rTG9nZ2luZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dnaW5nU2VydmljZTogSU5vdGVib29rTG9nZ2luZ1NlcnZpY2UsXG5cdFx0QElOb3RlYm9va0VkaXRvck1vZGVsUmVzb2x2ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbm90ZWJvb2tSZXNvbHZlcjogSU5vdGVib29rRWRpdG9yTW9kZWxSZXNvbHZlclNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKG1vZGlmaWVkUmVzb3VyY2VSZWYub2JqZWN0Lm5vdGVib29rLnVyaSwgdGVsZW1ldHJ5SW5mbywga2luZCwgY29uZmlndXJhdGlvblNlcnZpY2UsIGZpbGVDb25maWdTZXJ2aWNlLCBjaGF0U2VydmljZSwgZmlsZVNlcnZpY2UsIHVuZG9SZWRvU2VydmljZSwgaW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdHRoaXMuaW5pdGlhbENvbnRlbnRDb21wYXJlciA9IG5ldyBTbmFwc2hvdENvbXBhcmVyKGluaXRpYWxDb250ZW50KTtcblx0XHR0aGlzLm1vZGlmaWVkTW9kZWwgPSB0aGlzLl9yZWdpc3Rlcihtb2RpZmllZFJlc291cmNlUmVmKS5vYmplY3Qubm90ZWJvb2s7XG5cdFx0dGhpcy5vcmlnaW5hbE1vZGVsID0gdGhpcy5fcmVnaXN0ZXIob3JpZ2luYWxSZXNvdXJjZVJlZikub2JqZWN0Lm5vdGVib29rO1xuXHRcdHRoaXMub3JpZ2luYWxVUkkgPSB0aGlzLm9yaWdpbmFsTW9kZWwudXJpO1xuXHRcdHRoaXMuaW5pdGlhbENvbnRlbnQgPSBpbml0aWFsQ29udGVudDtcblx0XHR0aGlzLmluaXRpYWxpemVNb2RlbHNGcm9tRGlmZigpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubW9kaWZpZWRNb2RlbC5vbkRpZENoYW5nZUNvbnRlbnQodGhpcy5taXJyb3JOb3RlYm9va0VkaXRzLCB0aGlzKSk7XG5cdH1cblxuXHRpbml0aWFsaXplTW9kZWxzRnJvbURpZmZJbXBsKGNlbGxzRGlmZkluZm86IENlbGxEaWZmSW5mb1tdKSB7XG5cdFx0dGhpcy5jZWxsRW50cnlNYXAuZm9yRWFjaChlbnRyeSA9PiBlbnRyeS5kaXNwb3NlKCkpO1xuXHRcdHRoaXMuY2VsbEVudHJ5TWFwLmNsZWFyKCk7XG5cdFx0Y29uc3QgZGlmZnMgPSBjZWxsc0RpZmZJbmZvLm1hcCgoY2VsbERpZmYsIGkpID0+IHtcblx0XHRcdHN3aXRjaCAoY2VsbERpZmYudHlwZSkge1xuXHRcdFx0XHRjYXNlICdkZWxldGUnOlxuXHRcdFx0XHRcdHJldHVybiB0aGlzLmNyZWF0ZURlbGV0ZUNlbGxEaWZmSW5mbyhjZWxsRGlmZi5vcmlnaW5hbENlbGxJbmRleCk7XG5cdFx0XHRcdGNhc2UgJ2luc2VydCc6XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuY3JlYXRlSW5zZXJ0ZWRDZWxsRGlmZkluZm8oY2VsbERpZmYubW9kaWZpZWRDZWxsSW5kZXgpO1xuXHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdHJldHVybiB0aGlzLmNyZWF0ZU1vZGlmaWVkQ2VsbERpZmZJbmZvKGNlbGxEaWZmLm1vZGlmaWVkQ2VsbEluZGV4LCBjZWxsRGlmZi5vcmlnaW5hbENlbGxJbmRleCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0dGhpcy5fY2VsbHNEaWZmSW5mby5zZXQoZGlmZnMsIHVuZGVmaW5lZCk7XG5cdFx0dGhpcy5fY2hhbmdlc0NvdW50LnNldChjb3VudENoYW5nZXMoZGlmZnMpLCB1bmRlZmluZWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBjb21wdXRlUmVxdWVzdElkOiBudW1iZXIgPSAwO1xuXHRhc3luYyBpbml0aWFsaXplTW9kZWxzRnJvbURpZmYoKSB7XG5cdFx0Y29uc3QgaWQgPSArK3RoaXMuY29tcHV0ZVJlcXVlc3RJZDtcblx0XHRpZiAodGhpcy5fYXJlT3JpZ2luYWxBbmRNb2RpZmllZElkZW50aWNhbEltcGwoKSkge1xuXHRcdFx0Y29uc3QgY2VsbHNEaWZmSW5mbzogQ2VsbERpZmZJbmZvW10gPSB0aGlzLm1vZGlmaWVkTW9kZWwuY2VsbHMubWFwKChfLCBpbmRleCkgPT4ge1xuXHRcdFx0XHRyZXR1cm4geyB0eXBlOiAndW5jaGFuZ2VkJywgb3JpZ2luYWxDZWxsSW5kZXg6IGluZGV4LCBtb2RpZmllZENlbGxJbmRleDogaW5kZXggfSBzYXRpc2ZpZXMgQ2VsbERpZmZJbmZvO1xuXHRcdFx0fSk7XG5cdFx0XHR0aGlzLmluaXRpYWxpemVNb2RlbHNGcm9tRGlmZkltcGwoY2VsbHNEaWZmSW5mbyk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGNlbGxzRGlmZkluZm86IENlbGxEaWZmSW5mb1tdID0gW107XG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMuX2lzUHJvY2Vzc2luZ1Jlc3BvbnNlLnNldCh0cnVlLCB1bmRlZmluZWQpO1xuXHRcdFx0Y29uc3Qgbm90ZWJvb2tEaWZmID0gYXdhaXQgdGhpcy5ub3RlYm9va0VkaXRvcldvcmtlclNlcnZpY2UuY29tcHV0ZURpZmYodGhpcy5vcmlnaW5hbFVSSSwgdGhpcy5tb2RpZmllZFVSSSk7XG5cdFx0XHRpZiAoaWQgIT09IHRoaXMuY29tcHV0ZVJlcXVlc3RJZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCByZXN1bHQgPSBjb21wdXRlRGlmZih0aGlzLm9yaWdpbmFsTW9kZWwsIHRoaXMubW9kaWZpZWRNb2RlbCwgbm90ZWJvb2tEaWZmKTtcblx0XHRcdGlmIChyZXN1bHQuY2VsbERpZmZJbmZvLmxlbmd0aCkge1xuXHRcdFx0XHRjZWxsc0RpZmZJbmZvLnB1c2goLi4ucmVzdWx0LmNlbGxEaWZmSW5mbyk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZXgpIHtcblx0XHRcdHRoaXMubG9nZ2luZ1NlcnZpY2UuZXJyb3IoJ05vdGVib29rIENoYXQnLCAnRXJyb3IgY29tcHV0aW5nIGRpZmY6XFxuJyArIGV4KTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGhpcy5faXNQcm9jZXNzaW5nUmVzcG9uc2Uuc2V0KGZhbHNlLCB1bmRlZmluZWQpO1xuXHRcdH1cblx0XHR0aGlzLmluaXRpYWxpemVNb2RlbHNGcm9tRGlmZkltcGwoY2VsbHNEaWZmSW5mbyk7XG5cdH1cblx0dXBkYXRlQ2VsbERpZmZJbmZvKGNlbGxzRGlmZkluZm86IElDZWxsRGlmZkluZm9bXSwgdHJhbnNjYXRpb246IElUcmFuc2FjdGlvbiB8IHVuZGVmaW5lZCkge1xuXHRcdHRoaXMuX2NlbGxzRGlmZkluZm8uc2V0KHNvcnRDZWxsQ2hhbmdlcyhjZWxsc0RpZmZJbmZvKSwgdHJhbnNjYXRpb24pO1xuXHRcdHRoaXMuX2NoYW5nZXNDb3VudC5zZXQoY291bnRDaGFuZ2VzKGNlbGxzRGlmZkluZm8pLCB0cmFuc2NhdGlvbik7XG5cblx0fVxuXG5cdG1pcnJvck5vdGVib29rRWRpdHMoZTogTm90ZWJvb2tUZXh0TW9kZWxDaGFuZ2VkRXZlbnQpIHtcblx0XHRpZiAodGhpcy5faXNFZGl0RnJvbVVzIHx8IEFycmF5LmZyb20odGhpcy5jZWxsRW50cnlNYXAudmFsdWVzKCkpLnNvbWUoZW50cnkgPT4gZW50cnkuaXNFZGl0RnJvbVVzKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFBvc3NpYmxlIHVzZXIgcmV2ZXJ0ZWQgdGhlIGNoYW5nZXMgZnJvbSBTQ00gb3IgdGhlIGxpa2UuXG5cdFx0Ly8gT3IgdXNlciBqdXN0IHJldmVydGVkIHRoZSBjaGFuZ2VzIG1hZGUgdmlhIGVkaXRzIChlLmcuIGVkaXQgbWFkZSBhIGNoYW5nZSBpbiBhIGNlbGwgYW5kIHVzZXIgdW5kaWQgdGhhdCBjaGFuZ2UgZWl0aGVyIGJ5IHR5cGluZyBvdmVyIG9yIG90aGVyKS5cblx0XHQvLyBDb21wdXRpbmcgc25hcHNob3QgaXMgdG9vIHNsb3csIGFzIHRoaXMgZXZlbnQgZ2V0cyB0cmlnZ2VyZWQgZm9yIGV2ZXJ5IGtleSBzdHJva2UgaW4gYSBjZWxsLFxuXHRcdC8vIGNvbnN0IGRpZFJlc2V0VG9PcmlnaW5hbENvbnRlbnQgPSBjcmVhdGVTbmFwc2hvdCh0aGlzLm1vZGlmaWVkTW9kZWwsIHRoaXMudHJhbnNpZW50T3B0aW9ucywgdGhpcy5jb25maWd1cmF0aW9uU2VydmljZSkgPT09IHRoaXMuaW5pdGlhbENvbnRlbnQ7XG5cdFx0bGV0IGRpZFJlc2V0VG9PcmlnaW5hbENvbnRlbnQgPSB0aGlzLmluaXRpYWxDb250ZW50Q29tcGFyZXIuaXNFcXVhbCh0aGlzLm1vZGlmaWVkTW9kZWwpO1xuXHRcdGNvbnN0IGN1cnJlbnRTdGF0ZSA9IHRoaXMuX3N0YXRlT2JzLmdldCgpO1xuXHRcdGlmIChjdXJyZW50U3RhdGUgPT09IFdvcmtpbmdTZXRFbnRyeVN0YXRlLlJlamVjdGVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmIChjdXJyZW50U3RhdGUgPT09IFdvcmtpbmdTZXRFbnRyeVN0YXRlLk1vZGlmaWVkICYmIGRpZFJlc2V0VG9PcmlnaW5hbENvbnRlbnQpIHtcblx0XHRcdHRoaXMuX3N0YXRlT2JzLnNldChXb3JraW5nU2V0RW50cnlTdGF0ZS5SZWplY3RlZCwgdW5kZWZpbmVkKTtcblx0XHRcdHRoaXMudXBkYXRlQ2VsbERpZmZJbmZvKFtdLCB1bmRlZmluZWQpO1xuXHRcdFx0dGhpcy5pbml0aWFsaXplTW9kZWxzRnJvbURpZmYoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIWUucmF3RXZlbnRzLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoaXNUcmFuc2llbnRJUHlOYkV4dGVuc2lvbkV2ZW50KHRoaXMubW9kaWZpZWRNb2RlbC5ub3RlYm9va1R5cGUsIGUpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fYWxsRWRpdHNBcmVGcm9tVXMgPSBmYWxzZTtcblxuXHRcdC8vIENoYW5nZXMgdG8gY2VsbCB0ZXh0IGlzIHN5bmMnZWQgYW5kIGhhbmRsZWQgc2VwYXJhdGVseS5cblx0XHQvLyBTZWUgQ2hhdEVkaXRpbmdOb3RlYm9va0NlbGxFbnRyeS5fbWlycm9yRWRpdHNcblx0XHRmb3IgKGNvbnN0IGV2ZW50IG9mIGUucmF3RXZlbnRzLmZpbHRlcihldmVudCA9PiBldmVudC5raW5kICE9PSBOb3RlYm9va0NlbGxzQ2hhbmdlVHlwZS5DaGFuZ2VDZWxsQ29udGVudCkpIHtcblx0XHRcdHN3aXRjaCAoZXZlbnQua2luZCkge1xuXHRcdFx0XHRjYXNlIE5vdGVib29rQ2VsbHNDaGFuZ2VUeXBlLkNoYW5nZURvY3VtZW50TWV0YWRhdGE6IHtcblx0XHRcdFx0XHRjb25zdCBlZGl0OiBJQ2VsbEVkaXRPcGVyYXRpb24gPSB7XG5cdFx0XHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLkRvY3VtZW50TWV0YWRhdGEsXG5cdFx0XHRcdFx0XHRtZXRhZGF0YTogdGhpcy5tb2RpZmllZE1vZGVsLm1ldGFkYXRhXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR0aGlzLm9yaWdpbmFsTW9kZWwuYXBwbHlFZGl0cyhbZWRpdF0sIHRydWUsIHVuZGVmaW5lZCwgKCkgPT4gdW5kZWZpbmVkLCB1bmRlZmluZWQsIGZhbHNlKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlIE5vdGVib29rQ2VsbHNDaGFuZ2VUeXBlLk1vZGVsQ2hhbmdlOiB7XG5cdFx0XHRcdFx0bGV0IGNlbGxEaWZmcyA9IHNvcnRDZWxsQ2hhbmdlcyh0aGlzLl9jZWxsc0RpZmZJbmZvLmdldCgpKTtcblx0XHRcdFx0XHQvLyBFbnN1cmUgdGhlIG5ldyBub3RlYm9vayBjZWxscyBoYXZlIGludGVybmFsSWRzXG5cdFx0XHRcdFx0dGhpcy5fYXBwbHlFZGl0c1N5bmMoKCkgPT4ge1xuXHRcdFx0XHRcdFx0ZXZlbnQuY2hhbmdlcy5mb3JFYWNoKGNoYW5nZSA9PiB7XG5cdFx0XHRcdFx0XHRcdGNoYW5nZVsyXS5mb3JFYWNoKChjZWxsLCBpKSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKGNlbGwuaW50ZXJuYWxNZXRhZGF0YS5pbnRlcm5hbElkKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IGluZGV4ID0gY2hhbmdlWzBdICsgaTtcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBpbnRlcm5hbElkID0gZ2VuZXJhdGVDZWxsSGFzaChjZWxsLnVyaSk7XG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgZWRpdHM6IElDZWxsRWRpdE9wZXJhdGlvbltdID0gW3sgZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5QYXJ0aWFsSW50ZXJuYWxNZXRhZGF0YSwgaW5kZXgsIGludGVybmFsTWV0YWRhdGE6IHsgaW50ZXJuYWxJZCB9IH1dO1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMubW9kaWZpZWRNb2RlbC5hcHBseUVkaXRzKGVkaXRzLCB0cnVlLCB1bmRlZmluZWQsICgpID0+IHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBmYWxzZSk7XG5cdFx0XHRcdFx0XHRcdFx0Y2VsbC5pbnRlcm5hbE1ldGFkYXRhID8/PSB7fTtcblx0XHRcdFx0XHRcdFx0XHRjZWxsLmludGVybmFsTWV0YWRhdGEuaW50ZXJuYWxJZCA9IGludGVybmFsSWQ7XG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0ZXZlbnQuY2hhbmdlcy5mb3JFYWNoKGNoYW5nZSA9PiB7XG5cdFx0XHRcdFx0XHRjZWxsRGlmZnMgPSBhZGp1c3RDZWxsRGlmZkFuZE9yaWdpbmFsTW9kZWxCYXNlZE9uQ2VsbEFkZERlbGV0ZShjaGFuZ2UsXG5cdFx0XHRcdFx0XHRcdGNlbGxEaWZmcyxcblx0XHRcdFx0XHRcdFx0dGhpcy5tb2RpZmllZE1vZGVsLmNlbGxzLmxlbmd0aCxcblx0XHRcdFx0XHRcdFx0dGhpcy5vcmlnaW5hbE1vZGVsLmNlbGxzLmxlbmd0aCxcblx0XHRcdFx0XHRcdFx0dGhpcy5vcmlnaW5hbE1vZGVsLmFwcGx5RWRpdHMuYmluZCh0aGlzLm9yaWdpbmFsTW9kZWwpLFxuXHRcdFx0XHRcdFx0XHR0aGlzLmNyZWF0ZU1vZGlmaWVkQ2VsbERpZmZJbmZvLmJpbmQodGhpcykpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdHRoaXMudXBkYXRlQ2VsbERpZmZJbmZvKGNlbGxEaWZmcywgdW5kZWZpbmVkKTtcblx0XHRcdFx0XHR0aGlzLmRpc3Bvc2VEZWxldGVkQ2VsbEVudHJpZXMoKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlIE5vdGVib29rQ2VsbHNDaGFuZ2VUeXBlLkNoYW5nZUNlbGxMYW5ndWFnZToge1xuXHRcdFx0XHRcdGNvbnN0IGluZGV4ID0gZ2V0Q29ycmVzcG9uZGluZ09yaWdpbmFsQ2VsbEluZGV4KGV2ZW50LmluZGV4LCB0aGlzLl9jZWxsc0RpZmZJbmZvLmdldCgpKTtcblx0XHRcdFx0XHRpZiAodHlwZW9mIGluZGV4ID09PSAnbnVtYmVyJykge1xuXHRcdFx0XHRcdFx0Y29uc3QgZWRpdDogSUNlbGxFZGl0T3BlcmF0aW9uID0ge1xuXHRcdFx0XHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLkNlbGxMYW5ndWFnZSxcblx0XHRcdFx0XHRcdFx0aW5kZXgsXG5cdFx0XHRcdFx0XHRcdGxhbmd1YWdlOiBldmVudC5sYW5ndWFnZVxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdHRoaXMub3JpZ2luYWxNb2RlbC5hcHBseUVkaXRzKFtlZGl0XSwgdHJ1ZSwgdW5kZWZpbmVkLCAoKSA9PiB1bmRlZmluZWQsIHVuZGVmaW5lZCwgZmFsc2UpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlIE5vdGVib29rQ2VsbHNDaGFuZ2VUeXBlLkNoYW5nZUNlbGxNZXRhZGF0YToge1xuXHRcdFx0XHRcdC8vIGlweW5iIGFuZCBvdGhlciBleHRlbnNpb25zIGNhbiBhbHRlciBtZXRhZGF0YSwgZW5zdXJlIHdlIHVwZGF0ZSB0aGUgb3JpZ2luYWwgbW9kZWwgaW4gdGhlIGNvcnJlc3BvbmRpbmcgY2VsbC5cblx0XHRcdFx0XHRjb25zdCBpbmRleCA9IGdldENvcnJlc3BvbmRpbmdPcmlnaW5hbENlbGxJbmRleChldmVudC5pbmRleCwgdGhpcy5fY2VsbHNEaWZmSW5mby5nZXQoKSk7XG5cdFx0XHRcdFx0aWYgKHR5cGVvZiBpbmRleCA9PT0gJ251bWJlcicpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGVkaXQ6IElDZWxsRWRpdE9wZXJhdGlvbiA9IHtcblx0XHRcdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5NZXRhZGF0YSxcblx0XHRcdFx0XHRcdFx0aW5kZXgsXG5cdFx0XHRcdFx0XHRcdG1ldGFkYXRhOiBldmVudC5tZXRhZGF0YVxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdHRoaXMub3JpZ2luYWxNb2RlbC5hcHBseUVkaXRzKFtlZGl0XSwgdHJ1ZSwgdW5kZWZpbmVkLCAoKSA9PiB1bmRlZmluZWQsIHVuZGVmaW5lZCwgZmFsc2UpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlIE5vdGVib29rQ2VsbHNDaGFuZ2VUeXBlLkNoYW5nZUNlbGxNaW1lOlxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIE5vdGVib29rQ2VsbHNDaGFuZ2VUeXBlLkNoYW5nZUNlbGxJbnRlcm5hbE1ldGFkYXRhOiB7XG5cdFx0XHRcdFx0Y29uc3QgaW5kZXggPSBnZXRDb3JyZXNwb25kaW5nT3JpZ2luYWxDZWxsSW5kZXgoZXZlbnQuaW5kZXgsIHRoaXMuX2NlbGxzRGlmZkluZm8uZ2V0KCkpO1xuXHRcdFx0XHRcdGlmICh0eXBlb2YgaW5kZXggPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBlZGl0OiBJQ2VsbEVkaXRPcGVyYXRpb24gPSB7XG5cdFx0XHRcdFx0XHRcdGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuUGFydGlhbEludGVybmFsTWV0YWRhdGEsXG5cdFx0XHRcdFx0XHRcdGluZGV4LFxuXHRcdFx0XHRcdFx0XHRpbnRlcm5hbE1ldGFkYXRhOiBldmVudC5pbnRlcm5hbE1ldGFkYXRhXG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0dGhpcy5vcmlnaW5hbE1vZGVsLmFwcGx5RWRpdHMoW2VkaXRdLCB0cnVlLCB1bmRlZmluZWQsICgpID0+IHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBmYWxzZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuT3V0cHV0OiB7XG5cdFx0XHRcdFx0Ly8gVXNlciBjYW4gcnVuIGNlbGxzLlxuXHRcdFx0XHRcdGNvbnN0IGluZGV4ID0gZ2V0Q29ycmVzcG9uZGluZ09yaWdpbmFsQ2VsbEluZGV4KGV2ZW50LmluZGV4LCB0aGlzLl9jZWxsc0RpZmZJbmZvLmdldCgpKTtcblx0XHRcdFx0XHRpZiAodHlwZW9mIGluZGV4ID09PSAnbnVtYmVyJykge1xuXHRcdFx0XHRcdFx0Y29uc3QgZWRpdDogSUNlbGxFZGl0T3BlcmF0aW9uID0ge1xuXHRcdFx0XHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk91dHB1dCxcblx0XHRcdFx0XHRcdFx0aW5kZXgsXG5cdFx0XHRcdFx0XHRcdGFwcGVuZDogZXZlbnQuYXBwZW5kLFxuXHRcdFx0XHRcdFx0XHRvdXRwdXRzOiBldmVudC5vdXRwdXRzXG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0dGhpcy5vcmlnaW5hbE1vZGVsLmFwcGx5RWRpdHMoW2VkaXRdLCB0cnVlLCB1bmRlZmluZWQsICgpID0+IHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBmYWxzZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuT3V0cHV0SXRlbToge1xuXHRcdFx0XHRcdGNvbnN0IGluZGV4ID0gZ2V0Q29ycmVzcG9uZGluZ09yaWdpbmFsQ2VsbEluZGV4KGV2ZW50LmluZGV4LCB0aGlzLl9jZWxsc0RpZmZJbmZvLmdldCgpKTtcblx0XHRcdFx0XHRpZiAodHlwZW9mIGluZGV4ID09PSAnbnVtYmVyJykge1xuXHRcdFx0XHRcdFx0Y29uc3QgZWRpdDogSUNlbGxFZGl0T3BlcmF0aW9uID0ge1xuXHRcdFx0XHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk91dHB1dEl0ZW1zLFxuXHRcdFx0XHRcdFx0XHRvdXRwdXRJZDogZXZlbnQub3V0cHV0SWQsXG5cdFx0XHRcdFx0XHRcdGFwcGVuZDogZXZlbnQuYXBwZW5kLFxuXHRcdFx0XHRcdFx0XHRpdGVtczogZXZlbnQub3V0cHV0SXRlbXNcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHR0aGlzLm9yaWdpbmFsTW9kZWwuYXBwbHlFZGl0cyhbZWRpdF0sIHRydWUsIHVuZGVmaW5lZCwgKCkgPT4gdW5kZWZpbmVkLCB1bmRlZmluZWQsIGZhbHNlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y2FzZSBOb3RlYm9va0NlbGxzQ2hhbmdlVHlwZS5Nb3ZlOiB7XG5cdFx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYWRqdXN0Q2VsbERpZmZBbmRPcmlnaW5hbE1vZGVsQmFzZWRPbkNlbGxNb3ZlbWVudHMoZXZlbnQsIHRoaXMuX2NlbGxzRGlmZkluZm8uZ2V0KCkuc2xpY2UoKSk7XG5cdFx0XHRcdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0XHRcdFx0dGhpcy5vcmlnaW5hbE1vZGVsLmFwcGx5RWRpdHMocmVzdWx0WzFdLCB0cnVlLCB1bmRlZmluZWQsICgpID0+IHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBmYWxzZSk7XG5cdFx0XHRcdFx0XHR0aGlzLl9jZWxsc0RpZmZJbmZvLnNldChyZXN1bHRbMF0sIHVuZGVmaW5lZCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGRlZmF1bHQ6IHtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGRpZFJlc2V0VG9PcmlnaW5hbENvbnRlbnQgPSB0aGlzLmluaXRpYWxDb250ZW50Q29tcGFyZXIuaXNFcXVhbCh0aGlzLm1vZGlmaWVkTW9kZWwpO1xuXHRcdGlmIChjdXJyZW50U3RhdGUgPT09IFdvcmtpbmdTZXRFbnRyeVN0YXRlLk1vZGlmaWVkICYmIGRpZFJlc2V0VG9PcmlnaW5hbENvbnRlbnQpIHtcblx0XHRcdHRoaXMuX3N0YXRlT2JzLnNldChXb3JraW5nU2V0RW50cnlTdGF0ZS5SZWplY3RlZCwgdW5kZWZpbmVkKTtcblx0XHRcdHRoaXMudXBkYXRlQ2VsbERpZmZJbmZvKFtdLCB1bmRlZmluZWQpO1xuXHRcdFx0dGhpcy5pbml0aWFsaXplTW9kZWxzRnJvbURpZmYoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgYXN5bmMgX2RvQWNjZXB0KHR4OiBJVHJhbnNhY3Rpb24gfCB1bmRlZmluZWQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLnVwZGF0ZUNlbGxEaWZmSW5mbyhbXSwgdHgpO1xuXHRcdGNvbnN0IHNuYXBzaG90ID0gY3JlYXRlU25hcHNob3QodGhpcy5tb2RpZmllZE1vZGVsLCB0aGlzLnRyYW5zaWVudE9wdGlvbnMsIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdHJlc3RvcmVTbmFwc2hvdCh0aGlzLm9yaWdpbmFsTW9kZWwsIHNuYXBzaG90KTtcblx0XHR0aGlzLmluaXRpYWxpemVNb2RlbHNGcm9tRGlmZigpO1xuXHRcdGF3YWl0IHRoaXMuX2NvbGxhcHNlKHR4KTtcblxuXHRcdGNvbnN0IGNvbmZpZyA9IHRoaXMuX2ZpbGVDb25maWdTZXJ2aWNlLmdldEF1dG9TYXZlQ29uZmlndXJhdGlvbih0aGlzLm1vZGlmaWVkVVJJKTtcblx0XHRpZiAodGhpcy5tb2RpZmllZE1vZGVsLnVyaS5zY2hlbWUgIT09IFNjaGVtYXMudW50aXRsZWQgJiYgKCFjb25maWcuYXV0b1NhdmUgfHwgIXRoaXMubm90ZWJvb2tSZXNvbHZlci5pc0RpcnR5KHRoaXMubW9kaWZpZWRVUkkpKSkge1xuXHRcdFx0Ly8gU0FWRSBhZnRlciBhY2NlcHQgZm9yIG1hbnVhbC1zYXZlcnMsIGZvciBhdXRvLXNhdmVyc1xuXHRcdFx0Ly8gdHJpZ2dlciBleHBsaWN0IHNhdmUgdG8gZ2V0IHNhdmUgcGFydGljaXBhbnRzIGdvaW5nXG5cdFx0XHRhd2FpdCB0aGlzLl9hcHBseUVkaXRzKGFzeW5jICgpID0+IHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLm1vZGlmaWVkUmVzb3VyY2VSZWYub2JqZWN0LnNhdmUoe1xuXHRcdFx0XHRcdFx0cmVhc29uOiBTYXZlUmVhc29uLkVYUExJQ0lULFxuXHRcdFx0XHRcdFx0Zm9yY2U6IHRydWUsXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gY2F0Y2gge1xuXHRcdFx0XHRcdC8vIGlnbm9yZWRcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGFzeW5jIF9kb1JlamVjdCh0eDogSVRyYW5zYWN0aW9uIHwgdW5kZWZpbmVkKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy51cGRhdGVDZWxsRGlmZkluZm8oW10sIHR4KTtcblx0XHRpZiAodGhpcy5jcmVhdGVkSW5SZXF1ZXN0SWQgPT09IHRoaXMuX3RlbGVtZXRyeUluZm8ucmVxdWVzdElkKSB7XG5cdFx0XHRhd2FpdCB0aGlzLl9hcHBseUVkaXRzKGFzeW5jICgpID0+IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5tb2RpZmllZFJlc291cmNlUmVmLm9iamVjdC5yZXZlcnQoeyBzb2Z0OiB0cnVlIH0pO1xuXHRcdFx0XHRhd2FpdCB0aGlzLl9maWxlU2VydmljZS5kZWwodGhpcy5tb2RpZmllZFVSSSk7XG5cdFx0XHR9KTtcblx0XHRcdHRoaXMuX29uRGlkRGVsZXRlLmZpcmUoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXdhaXQgdGhpcy5fYXBwbHlFZGl0cyhhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHNuYXBzaG90ID0gY3JlYXRlU25hcHNob3QodGhpcy5vcmlnaW5hbE1vZGVsLCB0aGlzLnRyYW5zaWVudE9wdGlvbnMsIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdFx0XHR0aGlzLnJlc3RvcmVTbmFwc2hvdEluTW9kaWZpZWRNb2RlbChzbmFwc2hvdCk7XG5cdFx0XHRcdGlmICh0aGlzLl9hbGxFZGl0c0FyZUZyb21VcyAmJiBBcnJheS5mcm9tKHRoaXMuY2VsbEVudHJ5TWFwLnZhbHVlcygpKS5ldmVyeShlbnRyeSA9PiBlbnRyeS5hbGxFZGl0c0FyZUZyb21VcykpIHtcblx0XHRcdFx0XHQvLyBzYXZlIHRoZSBmaWxlIGFmdGVyIGRpc2NhcmRpbmcgc28gdGhhdCB0aGUgZGlydHkgaW5kaWNhdG9yIGdvZXMgYXdheVxuXHRcdFx0XHRcdC8vIGFuZCBzbyB0aGF0IGFuIGludGVybWVkaWF0ZSBzYXZlZCBzdGF0ZSBnZXRzIHJldmVydGVkXG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5tb2RpZmllZFJlc291cmNlUmVmLm9iamVjdC5zYXZlKHsgcmVhc29uOiBTYXZlUmVhc29uLkVYUExJQ0lULCBza2lwU2F2ZVBhcnRpY2lwYW50czogdHJ1ZSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHR0aGlzLmluaXRpYWxpemVNb2RlbHNGcm9tRGlmZigpO1xuXHRcdFx0YXdhaXQgdGhpcy5fY29sbGFwc2UodHgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2NvbGxhcHNlKHRyYW5zYWN0aW9uOiBJVHJhbnNhY3Rpb24gfCB1bmRlZmluZWQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLl9tdWx0aURpZmZFbnRyeURlbGVnYXRlLmNvbGxhcHNlKHRyYW5zYWN0aW9uKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBfY3JlYXRlRWRpdG9ySW50ZWdyYXRpb24oZWRpdG9yOiBJRWRpdG9yUGFuZSk6IElNb2RpZmllZEZpbGVFbnRyeUVkaXRvckludGVncmF0aW9uIHtcblx0XHRjb25zdCBub3RlYm9va0VkaXRvciA9IGdldE5vdGVib29rRWRpdG9yRnJvbUVkaXRvclBhbmUoZWRpdG9yKTtcblx0XHRpZiAoIW5vdGVib29rRWRpdG9yICYmIGVkaXRvci5nZXRJZCgpID09PSBOb3RlYm9va1RleHREaWZmRWRpdG9yLklEKSB7XG5cdFx0XHRjb25zdCBkaWZmRWRpdG9yID0gKGVkaXRvci5nZXRDb250cm9sKCkgYXMgSU5vdGVib29rVGV4dERpZmZFZGl0b3IpO1xuXHRcdFx0cmV0dXJuIHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENoYXRFZGl0aW5nTm90ZWJvb2tEaWZmRWRpdG9ySW50ZWdyYXRpb24sIGRpZmZFZGl0b3IsIHRoaXMuX2NlbGxzRGlmZkluZm8pO1xuXHRcdH1cblx0XHRhc3NlcnRUeXBlKG5vdGVib29rRWRpdG9yKTtcblx0XHRyZXR1cm4gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2hhdEVkaXRpbmdOb3RlYm9va0VkaXRvckludGVncmF0aW9uLCB0aGlzLCBlZGl0b3IsIHRoaXMubW9kaWZpZWRNb2RlbCwgdGhpcy5vcmlnaW5hbE1vZGVsLCB0aGlzLl9jZWxsc0RpZmZJbmZvKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBfcmVzZXRFZGl0c1N0YXRlKHR4OiBJVHJhbnNhY3Rpb24pOiB2b2lkIHtcblx0XHRzdXBlci5fcmVzZXRFZGl0c1N0YXRlKHR4KTtcblx0XHR0aGlzLmNlbGxFbnRyeU1hcC5mb3JFYWNoKGVudHJ5ID0+ICFlbnRyeS5kaXNwb3NlZCAmJiBlbnRyeS5jbGVhckN1cnJlbnRFZGl0TGluZURlY29yYXRpb24oKSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgX2NyZWF0ZVVuZG9SZWRvRWxlbWVudChyZXNwb25zZTogSUNoYXRSZXNwb25zZU1vZGVsKTogSVVuZG9SZWRvRWxlbWVudCB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgcmVxdWVzdCA9IHJlc3BvbnNlLnNlc3Npb24uZ2V0UmVxdWVzdHMoKS5maW5kKHJlcSA9PiByZXEuaWQgPT09IHJlc3BvbnNlLnJlcXVlc3RJZCk7XG5cdFx0Y29uc3QgbGFiZWwgPSByZXF1ZXN0Py5tZXNzYWdlLnRleHQgPyBsb2NhbGl6ZSgnY2hhdE5vdGVib29rRWRpdDEnLCBcIkNoYXQgRWRpdDogJ3swfSdcIiwgcmVxdWVzdC5tZXNzYWdlLnRleHQpIDogbG9jYWxpemUoJ2NoYXROb3RlYm9va0VkaXQyJywgXCJDaGF0IEVkaXRcIik7XG5cdFx0Y29uc3QgdHJhbnNpZW50T3B0aW9ucyA9IHRoaXMudHJhbnNpZW50T3B0aW9ucztcblx0XHRjb25zdCBvdXRwdXRTaXplTGltaXQgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPG51bWJlcj4oTm90ZWJvb2tTZXR0aW5nLm91dHB1dEJhY2t1cFNpemVMaW1pdCkgKiAxMDI0O1xuXG5cdFx0Ly8gY3JlYXRlIGEgc25hcHNob3Qgb2YgdGhlIGN1cnJlbnQgc3RhdGUgb2YgdGhlIG1vZGVsLCBiZWZvcmUgdGhlIG5leHQgc2V0IG9mIGVkaXRzXG5cdFx0bGV0IGluaXRpYWwgPSBjcmVhdGVTbmFwc2hvdCh0aGlzLm1vZGlmaWVkTW9kZWwsIHRyYW5zaWVudE9wdGlvbnMsIG91dHB1dFNpemVMaW1pdCk7XG5cdFx0bGV0IGxhc3QgPSAnJztcblxuXHRcdHJldHVybiB7XG5cdFx0XHR0eXBlOiBVbmRvUmVkb0VsZW1lbnRUeXBlLlJlc291cmNlLFxuXHRcdFx0cmVzb3VyY2U6IHRoaXMubW9kaWZpZWRVUkksXG5cdFx0XHRsYWJlbCxcblx0XHRcdGNvZGU6ICdjaGF0LmVkaXQnLFxuXHRcdFx0Y29uZmlybUJlZm9yZVVuZG86IGZhbHNlLFxuXHRcdFx0dW5kbzogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRsYXN0ID0gY3JlYXRlU25hcHNob3QodGhpcy5tb2RpZmllZE1vZGVsLCB0cmFuc2llbnRPcHRpb25zLCBvdXRwdXRTaXplTGltaXQpO1xuXHRcdFx0XHRyZXN0b3JlU25hcHNob3QodGhpcy5tb2RpZmllZE1vZGVsLCBpbml0aWFsKTtcblx0XHRcdH0sXG5cdFx0XHRyZWRvOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGluaXRpYWwgPSBjcmVhdGVTbmFwc2hvdCh0aGlzLm1vZGlmaWVkTW9kZWwsIHRyYW5zaWVudE9wdGlvbnMsIG91dHB1dFNpemVMaW1pdCk7XG5cdFx0XHRcdHJlc3RvcmVTbmFwc2hvdCh0aGlzLm1vZGlmaWVkTW9kZWwsIGxhc3QpO1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgYXN5bmMgX2FyZU9yaWdpbmFsQW5kTW9kaWZpZWRJZGVudGljYWwoKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0cmV0dXJuIHRoaXMuX2FyZU9yaWdpbmFsQW5kTW9kaWZpZWRJZGVudGljYWxJbXBsKCk7XG5cdH1cblxuXHRwcml2YXRlIF9hcmVPcmlnaW5hbEFuZE1vZGlmaWVkSWRlbnRpY2FsSW1wbCgpOiBib29sZWFuIHtcblx0XHRjb25zdCBzbmFwc2hvdCA9IGNyZWF0ZVNuYXBzaG90KHRoaXMub3JpZ2luYWxNb2RlbCwgdGhpcy50cmFuc2llbnRPcHRpb25zLCB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRyZXR1cm4gbmV3IFNuYXBzaG90Q29tcGFyZXIoc25hcHNob3QpLmlzRXF1YWwodGhpcy5tb2RpZmllZE1vZGVsKTtcblx0fVxuXG5cdHByaXZhdGUgbmV3Tm90ZWJvb2tFZGl0R2VuZXJhdG9yPzogQ2hhdEVkaXRpbmdOZXdOb3RlYm9va0NvbnRlbnRFZGl0cztcblx0b3ZlcnJpZGUgYXN5bmMgYWNjZXB0QWdlbnRFZGl0cyhyZXNvdXJjZTogVVJJLCBlZGl0czogKFRleHRFZGl0IHwgSUNlbGxFZGl0T3BlcmF0aW9uKVtdLCBpc0xhc3RFZGl0czogYm9vbGVhbiwgcmVzcG9uc2VNb2RlbDogSUNoYXRSZXNwb25zZU1vZGVsKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgaXNDZWxsVXJpID0gcmVzb3VyY2Uuc2NoZW1lID09PSBTY2hlbWFzLnZzY29kZU5vdGVib29rQ2VsbDtcblx0XHRjb25zdCBjZWxsID0gaXNDZWxsVXJpICYmIHRoaXMubW9kaWZpZWRNb2RlbC5jZWxscy5maW5kKGNlbGwgPT4gaXNFcXVhbChjZWxsLnVyaSwgcmVzb3VyY2UpKTtcblx0XHRsZXQgY2VsbEVudHJ5OiBDaGF0RWRpdGluZ05vdGVib29rQ2VsbEVudHJ5IHwgdW5kZWZpbmVkO1xuXHRcdGlmIChjZWxsKSB7XG5cdFx0XHRjb25zdCBpbmRleCA9IHRoaXMubW9kaWZpZWRNb2RlbC5jZWxscy5pbmRleE9mKGNlbGwpO1xuXHRcdFx0Y29uc3QgZW50cnkgPSB0aGlzLl9jZWxsc0RpZmZJbmZvLmdldCgpLnNsaWNlKCkuZmluZChlbnRyeSA9PiBlbnRyeS5tb2RpZmllZENlbGxJbmRleCA9PT0gaW5kZXgpO1xuXHRcdFx0aWYgKCFlbnRyeSkge1xuXHRcdFx0XHQvLyBOb3QgcG9zc2libGUuXG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoJ09yaWdpbmFsIGNlbGwgbW9kZWwgbm90IGZvdW5kJyk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y2VsbEVudHJ5ID0gdGhpcy5nZXRPckNyZWF0ZU1vZGlmaWVkVGV4dEZpbGVFbnRyeUZvckNlbGwoY2VsbCwgYXdhaXQgZW50cnkubW9kaWZpZWRNb2RlbC5wcm9taXNlLCBhd2FpdCBlbnRyeS5vcmlnaW5hbE1vZGVsLnByb21pc2UpO1xuXHRcdH1cblxuXHRcdC8vIEZvciBhbGwgY2VsbHMgdGhhdCB3ZXJlIGVkaXRlZCwgc2VuZCB0aGUgYGlzTGFzdEVkaXRzYCBmbGFnLlxuXHRcdGNvbnN0IGZpbmlzaFByZXZpb3VzQ2VsbHMgPSAoKSA9PiB7XG5cdFx0XHR0aGlzLmVkaXRlZENlbGxzLmZvckVhY2godXJpID0+IHtcblx0XHRcdFx0Y29uc3QgY2VsbCA9IHRoaXMubW9kaWZpZWRNb2RlbC5jZWxscy5maW5kKGNlbGwgPT4gaXNFcXVhbChjZWxsLnVyaSwgdXJpKSk7XG5cdFx0XHRcdGNvbnN0IGNlbGxFbnRyeSA9IGNlbGwgJiYgdGhpcy5jZWxsRW50cnlNYXAuZ2V0KGNlbGwudXJpKTtcblx0XHRcdFx0Y2VsbEVudHJ5Py5hY2NlcHRBZ2VudEVkaXRzKFtdLCB0cnVlLCByZXNwb25zZU1vZGVsKTtcblx0XHRcdH0pO1xuXHRcdFx0dGhpcy5lZGl0ZWRDZWxscy5jbGVhcigpO1xuXHRcdH07XG5cblx0XHR0aGlzLl9hcHBseUVkaXRzU3luYyhhc3luYyAoKSA9PiB7XG5cdFx0XHRlZGl0cy5tYXAoZWRpdCA9PiB7XG5cdFx0XHRcdGlmIChUZXh0RWRpdC5pc1RleHRFZGl0KGVkaXQpKSB7XG5cdFx0XHRcdFx0Ly8gUG9zc2libGUgd2UncmUgZ2V0dGluZyB0aGUgcmF3IGNvbnRlbnQgZm9yIHRoZSBub3RlYm9vay5cblx0XHRcdFx0XHRpZiAoaXNFcXVhbChyZXNvdXJjZSwgdGhpcy5tb2RpZmllZE1vZGVsLnVyaSkpIHtcblx0XHRcdFx0XHRcdHRoaXMubmV3Tm90ZWJvb2tFZGl0R2VuZXJhdG9yID8/PSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDaGF0RWRpdGluZ05ld05vdGVib29rQ29udGVudEVkaXRzLCB0aGlzLm1vZGlmaWVkTW9kZWwpO1xuXHRcdFx0XHRcdFx0dGhpcy5uZXdOb3RlYm9va0VkaXRHZW5lcmF0b3IuYWNjZXB0VGV4dEVkaXRzKFtlZGl0XSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdC8vIElmIHdlIGdldCBjZWxsIGVkaXRzLCBpdHMgaW1wb3NzaWJsZSB0byBnZXQgdGV4dCBlZGl0cyBmb3IgdGhlIG5vdGVib29rIHVyaS5cblx0XHRcdFx0XHRcdHRoaXMubmV3Tm90ZWJvb2tFZGl0R2VuZXJhdG9yID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdFx0aWYgKCF0aGlzLmVkaXRlZENlbGxzLmhhcyhyZXNvdXJjZSkpIHtcblx0XHRcdFx0XHRcdFx0ZmluaXNoUHJldmlvdXNDZWxscygpO1xuXHRcdFx0XHRcdFx0XHR0aGlzLmVkaXRlZENlbGxzLmFkZChyZXNvdXJjZSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjZWxsRW50cnk/LmFjY2VwdEFnZW50RWRpdHMoW2VkaXRdLCBpc0xhc3RFZGl0cywgcmVzcG9uc2VNb2RlbCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIElmIHdlIG5vdGVib29rIGVkaXRzLCBpdHMgaW1wb3NzaWJsZSB0byBnZXQgdGV4dCBlZGl0cyBmb3IgdGhlIG5vdGVib29rIHVyaS5cblx0XHRcdFx0XHR0aGlzLm5ld05vdGVib29rRWRpdEdlbmVyYXRvciA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHR0aGlzLmFjY2VwdE5vdGVib29rRWRpdChlZGl0KTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHQvLyBJZiB0aGUgbGFzdCBlZGl0IGZvciBhIGNlbGwgd2FzIHNlbnQsIHRoZW4gaGFuZGxlIGl0XG5cdFx0aWYgKGlzTGFzdEVkaXRzKSB7XG5cdFx0XHRmaW5pc2hQcmV2aW91c0NlbGxzKCk7XG5cdFx0fVxuXG5cdFx0Ly8gaXNMYXN0RWRpdHMgY2FuIGJlIHRydWUgZm9yIGNlbGwgVXJpcywgYnV0IHdoZW4gaXRzIHRydWUgZm9yIENlbGxzIGVkaXRzLlxuXHRcdC8vIEl0IGNhbm5vdCBiZSB0cnVlIGZvciB0aGUgbm90ZWJvb2sgaXRzZWxmLlxuXHRcdGlzTGFzdEVkaXRzID0gIWlzQ2VsbFVyaSAmJiBpc0xhc3RFZGl0cztcblxuXHRcdC8vIElmIHRoaXMgaXMgdGhlIGxhc3QgZWRpdCBhbmQgJiB3ZSBnb3QgcmVndWxhciB0ZXh0IGVkaXRzIGZvciBnZW5lcmF0aW5nIG5ldyBub3RlYm9vayBjb250ZW50XG5cdFx0Ly8gVGhlbiBnZW5lcmF0ZSBub3RlYm9vayBlZGl0cyBmcm9tIHRob3NlIHRleHQgZWRpdHMgJiBhcHBseSB0aG9zZSBub3RlYm9vayBlZGl0cy5cblx0XHRpZiAoaXNMYXN0RWRpdHMgJiYgdGhpcy5uZXdOb3RlYm9va0VkaXRHZW5lcmF0b3IpIHtcblx0XHRcdGNvbnN0IG5vdGVib29rRWRpdHMgPSBhd2FpdCB0aGlzLm5ld05vdGVib29rRWRpdEdlbmVyYXRvci5nZW5lcmF0ZUVkaXRzKCk7XG5cdFx0XHR0aGlzLm5ld05vdGVib29rRWRpdEdlbmVyYXRvciA9IHVuZGVmaW5lZDtcblx0XHRcdG5vdGVib29rRWRpdHMuZm9yRWFjaChlZGl0ID0+IHRoaXMuYWNjZXB0Tm90ZWJvb2tFZGl0KGVkaXQpKTtcblx0XHR9XG5cblx0XHR0cmFuc2FjdGlvbigodHgpID0+IHtcblx0XHRcdGlmICghaXNMYXN0RWRpdHMpIHtcblx0XHRcdFx0dGhpcy5fc3RhdGVPYnMuc2V0KFdvcmtpbmdTZXRFbnRyeVN0YXRlLk1vZGlmaWVkLCB0eCk7XG5cdFx0XHRcdHRoaXMuX2lzQ3VycmVudGx5QmVpbmdNb2RpZmllZEJ5T2JzLnNldChyZXNwb25zZU1vZGVsLCB0eCk7XG5cdFx0XHRcdGNvbnN0IG5ld1Jld3JpdGVSYXRpb24gPSBNYXRoLm1heCh0aGlzLl9yZXdyaXRlUmF0aW9PYnMuZ2V0KCksIGNhbGN1bGF0ZU5vdGVib29rUmV3cml0ZVJhdGlvKHRoaXMuX2NlbGxzRGlmZkluZm8uZ2V0KCksIHRoaXMub3JpZ2luYWxNb2RlbCwgdGhpcy5tb2RpZmllZE1vZGVsKSk7XG5cdFx0XHRcdHRoaXMuX3Jld3JpdGVSYXRpb09icy5zZXQoTWF0aC5taW4oMSwgbmV3UmV3cml0ZVJhdGlvbiksIHR4KTtcblxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZmluaXNoUHJldmlvdXNDZWxscygpO1xuXHRcdFx0XHR0aGlzLmVkaXRlZENlbGxzLmNsZWFyKCk7XG5cdFx0XHRcdHRoaXMuX3Jlc2V0RWRpdHNTdGF0ZSh0eCk7XG5cdFx0XHRcdHRoaXMuX3Jld3JpdGVSYXRpb09icy5zZXQoMSwgdHgpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBkaXNwb3NlRGVsZXRlZENlbGxFbnRyaWVzKCkge1xuXHRcdGNvbnN0IGNlbGxzVXJpcyA9IG5ldyBSZXNvdXJjZVNldCh0aGlzLm1vZGlmaWVkTW9kZWwuY2VsbHMubWFwKGNlbGwgPT4gY2VsbC51cmkpKTtcblx0XHRBcnJheS5mcm9tKHRoaXMuY2VsbEVudHJ5TWFwLmtleXMoKSkuZm9yRWFjaCh1cmkgPT4ge1xuXHRcdFx0aWYgKGNlbGxzVXJpcy5oYXModXJpKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmNlbGxFbnRyeU1hcC5nZXQodXJpKT8uZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5jZWxsRW50cnlNYXAuZGVsZXRlKHVyaSk7XG5cdFx0fSk7XG5cdH1cblxuXHRhY2NlcHROb3RlYm9va0VkaXQoZWRpdDogSUNlbGxFZGl0T3BlcmF0aW9uKTogdm9pZCB7XG5cdFx0Ly8gbWFrZSB0aGUgYWN0dWFsIGVkaXRcblx0XHR0aGlzLm1vZGlmaWVkTW9kZWwuYXBwbHlFZGl0cyhbZWRpdF0sIHRydWUsIHVuZGVmaW5lZCwgKCkgPT4gdW5kZWZpbmVkLCB1bmRlZmluZWQsIGZhbHNlKTtcblx0XHR0aGlzLmRpc3Bvc2VEZWxldGVkQ2VsbEVudHJpZXMoKTtcblxuXG5cdFx0aWYgKGVkaXQuZWRpdFR5cGUgIT09IENlbGxFZGl0VHlwZS5SZXBsYWNlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdC8vIEVuc3VyZSBjZWxscyBoYXZlIGludGVybmFsIElkcy5cblx0XHRlZGl0LmNlbGxzLmZvckVhY2goKF8sIGkpID0+IHtcblx0XHRcdGNvbnN0IGluZGV4ID0gZWRpdC5pbmRleCArIGk7XG5cdFx0XHRjb25zdCBjZWxsID0gdGhpcy5tb2RpZmllZE1vZGVsLmNlbGxzW2luZGV4XTtcblx0XHRcdGlmIChjZWxsLmludGVybmFsTWV0YWRhdGEuaW50ZXJuYWxJZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBpbnRlcm5hbElkID0gZ2VuZXJhdGVDZWxsSGFzaChjZWxsLnVyaSk7XG5cdFx0XHRjb25zdCBlZGl0czogSUNlbGxFZGl0T3BlcmF0aW9uW10gPSBbeyBlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlBhcnRpYWxJbnRlcm5hbE1ldGFkYXRhLCBpbmRleCwgaW50ZXJuYWxNZXRhZGF0YTogeyBpbnRlcm5hbElkIH0gfV07XG5cdFx0XHR0aGlzLm1vZGlmaWVkTW9kZWwuYXBwbHlFZGl0cyhlZGl0cywgdHJ1ZSwgdW5kZWZpbmVkLCAoKSA9PiB1bmRlZmluZWQsIHVuZGVmaW5lZCwgZmFsc2UpO1xuXHRcdH0pO1xuXG5cdFx0bGV0IGRpZmY6IElDZWxsRGlmZkluZm9bXSA9IFtdO1xuXHRcdGlmIChlZGl0LmNvdW50ID09PSAwKSB7XG5cdFx0XHQvLyBBbGwgZXhpc3RpbmcgaW5kZXhlcyBhcmUgc2hpZnRlZCBieSBudW1iZXIgb2YgY2VsbHMgYWRkZWQuXG5cdFx0XHRkaWZmID0gc29ydENlbGxDaGFuZ2VzKHRoaXMuX2NlbGxzRGlmZkluZm8uZ2V0KCkpO1xuXHRcdFx0ZGlmZi5mb3JFYWNoKGQgPT4ge1xuXHRcdFx0XHRpZiAoZC50eXBlICE9PSAnZGVsZXRlJyAmJiBkLm1vZGlmaWVkQ2VsbEluZGV4ID49IGVkaXQuaW5kZXgpIHtcblx0XHRcdFx0XHRkLm1vZGlmaWVkQ2VsbEluZGV4ICs9IGVkaXQuY2VsbHMubGVuZ3RoO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdGNvbnN0IGRpZmZJbnNlcnQgPSBlZGl0LmNlbGxzLm1hcCgoXywgaSkgPT4gdGhpcy5jcmVhdGVJbnNlcnRlZENlbGxEaWZmSW5mbyhlZGl0LmluZGV4ICsgaSkpO1xuXHRcdFx0ZGlmZi5zcGxpY2UoZWRpdC5pbmRleCwgMCwgLi4uZGlmZkluc2VydCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIEFsbCBleGlzdGluZyBpbmRleGVzIGFyZSBzaGlmdGVkIGJ5IG51bWJlciBvZiBjZWxscyByZW1vdmVkLlxuXHRcdFx0Ly8gQW5kIHVuY2hhbmdlZCBjZWxscyBzaG91bGQgYmUgY29udmVydGVkIHRvIGRlbGV0ZWQgY2VsbHMuXG5cdFx0XHRkaWZmID0gc29ydENlbGxDaGFuZ2VzKHRoaXMuX2NlbGxzRGlmZkluZm8uZ2V0KCkpLm1hcCgoZCkgPT4ge1xuXHRcdFx0XHRpZiAoZC50eXBlID09PSAndW5jaGFuZ2VkJyAmJiBkLm1vZGlmaWVkQ2VsbEluZGV4ID49IGVkaXQuaW5kZXggJiYgZC5tb2RpZmllZENlbGxJbmRleCA8PSAoZWRpdC5pbmRleCArIGVkaXQuY291bnQgLSAxKSkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmNyZWF0ZURlbGV0ZUNlbGxEaWZmSW5mbyhkLm9yaWdpbmFsQ2VsbEluZGV4KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZC50eXBlICE9PSAnZGVsZXRlJyAmJiBkLm1vZGlmaWVkQ2VsbEluZGV4ID49IChlZGl0LmluZGV4ICsgZWRpdC5jb3VudCkpIHtcblx0XHRcdFx0XHRkLm1vZGlmaWVkQ2VsbEluZGV4IC09IGVkaXQuY291bnQ7XG5cdFx0XHRcdFx0cmV0dXJuIGQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGQ7XG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0dGhpcy51cGRhdGVDZWxsRGlmZkluZm8oZGlmZiwgdW5kZWZpbmVkKTtcblx0fVxuXG5cdHByaXZhdGUgY29tcHV0ZVN0YXRlQWZ0ZXJBY2NlcHRpbmdSZWplY3RpbmdDaGFuZ2VzKGFjY2VwdGVkOiBib29sZWFuKSB7XG5cdFx0Y29uc3QgY3VycmVudFNuYXBzaG90ID0gY3JlYXRlU25hcHNob3QodGhpcy5tb2RpZmllZE1vZGVsLCB0aGlzLnRyYW5zaWVudE9wdGlvbnMsIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdGlmIChuZXcgU25hcHNob3RDb21wYXJlcihjdXJyZW50U25hcHNob3QpLmlzRXF1YWwodGhpcy5vcmlnaW5hbE1vZGVsKSkge1xuXHRcdFx0Y29uc3Qgc3RhdGUgPSBhY2NlcHRlZCA/IFdvcmtpbmdTZXRFbnRyeVN0YXRlLkFjY2VwdGVkIDogV29ya2luZ1NldEVudHJ5U3RhdGUuUmVqZWN0ZWQ7XG5cdFx0XHR0aGlzLl9zdGF0ZU9icy5zZXQoc3RhdGUsIHVuZGVmaW5lZCk7XG5cdFx0fVxuXHR9XG5cblx0Y3JlYXRlTW9kaWZpZWRDZWxsRGlmZkluZm8obW9kaWZpZWRDZWxsSW5kZXg6IG51bWJlciwgb3JpZ2luYWxDZWxsSW5kZXg6IG51bWJlcik6IElDZWxsRGlmZkluZm8ge1xuXHRcdGNvbnN0IG1vZGlmaWVkQ2VsbCA9IHRoaXMubW9kaWZpZWRNb2RlbC5jZWxsc1ttb2RpZmllZENlbGxJbmRleF07XG5cdFx0Y29uc3Qgb3JpZ2luYWxDZWxsID0gdGhpcy5vcmlnaW5hbE1vZGVsLmNlbGxzW29yaWdpbmFsQ2VsbEluZGV4XTtcblx0XHR0aGlzLm1vZGlmaWVkVG9PcmlnaW5hbENlbGwuc2V0KG1vZGlmaWVkQ2VsbC51cmksIG9yaWdpbmFsQ2VsbC51cmkpO1xuXHRcdGNvbnN0IG1vZGlmaWVkQ2VsbE1vZGVsUHJvbWlzZSA9IHRoaXMucmVzb2x2ZUNlbGxNb2RlbChtb2RpZmllZENlbGwudXJpKTtcblx0XHRjb25zdCBvcmlnaW5hbENlbGxNb2RlbFByb21pc2UgPSB0aGlzLnJlc29sdmVDZWxsTW9kZWwob3JpZ2luYWxDZWxsLnVyaSk7XG5cblx0XHRQcm9taXNlLmFsbChbbW9kaWZpZWRDZWxsTW9kZWxQcm9taXNlLCBvcmlnaW5hbENlbGxNb2RlbFByb21pc2VdKS50aGVuKChbbW9kaWZpZWRDZWxsTW9kZWwsIG9yaWdpbmFsQ2VsbE1vZGVsXSkgPT4ge1xuXHRcdFx0dGhpcy5nZXRPckNyZWF0ZU1vZGlmaWVkVGV4dEZpbGVFbnRyeUZvckNlbGwobW9kaWZpZWRDZWxsLCBtb2RpZmllZENlbGxNb2RlbCwgb3JpZ2luYWxDZWxsTW9kZWwpO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgZGlmZiA9IG9ic2VydmFibGVWYWx1ZSgnZGlmZicsIG51bGxEb2N1bWVudERpZmYpO1xuXHRcdGNvbnN0IHVuY2hhbmdlZENlbGw6IElDZWxsRGlmZkluZm8gPSB7XG5cdFx0XHR0eXBlOiAndW5jaGFuZ2VkJyxcblx0XHRcdG1vZGlmaWVkQ2VsbEluZGV4LFxuXHRcdFx0b3JpZ2luYWxDZWxsSW5kZXgsXG5cdFx0XHRrZWVwOiBhc3luYyAoY2hhbmdlczogRGV0YWlsZWRMaW5lUmFuZ2VNYXBwaW5nKSA9PiB7XG5cdFx0XHRcdGNvbnN0IFttb2RpZmllZENlbGxNb2RlbCwgb3JpZ2luYWxDZWxsTW9kZWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW21vZGlmaWVkQ2VsbE1vZGVsUHJvbWlzZSwgb3JpZ2luYWxDZWxsTW9kZWxQcm9taXNlXSk7XG5cdFx0XHRcdGNvbnN0IGVudHJ5ID0gdGhpcy5nZXRPckNyZWF0ZU1vZGlmaWVkVGV4dEZpbGVFbnRyeUZvckNlbGwobW9kaWZpZWRDZWxsLCBtb2RpZmllZENlbGxNb2RlbCwgb3JpZ2luYWxDZWxsTW9kZWwpO1xuXHRcdFx0XHRyZXR1cm4gZW50cnkgPyBlbnRyeS5rZWVwKGNoYW5nZXMpIDogZmFsc2U7XG5cdFx0XHR9LFxuXHRcdFx0dW5kbzogYXN5bmMgKGNoYW5nZXM6IERldGFpbGVkTGluZVJhbmdlTWFwcGluZykgPT4ge1xuXHRcdFx0XHRjb25zdCBbbW9kaWZpZWRDZWxsTW9kZWwsIG9yaWdpbmFsQ2VsbE1vZGVsXSA9IGF3YWl0IFByb21pc2UuYWxsKFttb2RpZmllZENlbGxNb2RlbFByb21pc2UsIG9yaWdpbmFsQ2VsbE1vZGVsUHJvbWlzZV0pO1xuXHRcdFx0XHRjb25zdCBlbnRyeSA9IHRoaXMuZ2V0T3JDcmVhdGVNb2RpZmllZFRleHRGaWxlRW50cnlGb3JDZWxsKG1vZGlmaWVkQ2VsbCwgbW9kaWZpZWRDZWxsTW9kZWwsIG9yaWdpbmFsQ2VsbE1vZGVsKTtcblx0XHRcdFx0cmV0dXJuIGVudHJ5ID8gZW50cnkudW5kbyhjaGFuZ2VzKSA6IGZhbHNlO1xuXHRcdFx0fSxcblx0XHRcdG1vZGlmaWVkTW9kZWw6IG5ldyBPYnNlcnZhYmxlUHJvbWlzZShtb2RpZmllZENlbGxNb2RlbFByb21pc2UpLFxuXHRcdFx0b3JpZ2luYWxNb2RlbDogbmV3IE9ic2VydmFibGVQcm9taXNlKG9yaWdpbmFsQ2VsbE1vZGVsUHJvbWlzZSksXG5cdFx0XHRkaWZmXG5cdFx0fTtcblxuXHRcdHJldHVybiB1bmNoYW5nZWRDZWxsO1xuXG5cdH1cblx0Y3JlYXRlSW5zZXJ0ZWRDZWxsRGlmZkluZm8obW9kaWZpZWRDZWxsSW5kZXg6IG51bWJlcik6IElDZWxsRGlmZkluZm8ge1xuXHRcdGNvbnN0IGNlbGwgPSB0aGlzLm1vZGlmaWVkTW9kZWwuY2VsbHNbbW9kaWZpZWRDZWxsSW5kZXhdO1xuXHRcdGNvbnN0IGxpbmVzID0gY2VsbC5nZXRWYWx1ZSgpLnNwbGl0KC9cXHI/XFxuLyk7XG5cdFx0Y29uc3Qgb3JpZ2luYWxSYW5nZSA9IG5ldyBSYW5nZSgxLCAwLCAxLCAwKTtcblx0XHRjb25zdCBtb2RpZmllZFJhbmdlID0gbmV3IFJhbmdlKDEsIDAsIGxpbmVzLmxlbmd0aCwgbGluZXNbbGluZXMubGVuZ3RoIC0gMV0ubGVuZ3RoKTtcblx0XHRjb25zdCBpbm5lckNoYW5nZXMgPSBuZXcgUmFuZ2VNYXBwaW5nKG9yaWdpbmFsUmFuZ2UsIG1vZGlmaWVkUmFuZ2UpO1xuXHRcdGNvbnN0IGNoYW5nZXMgPSBbbmV3IERldGFpbGVkTGluZVJhbmdlTWFwcGluZyhuZXcgTGluZVJhbmdlKDEsIDEpLCBuZXcgTGluZVJhbmdlKDEsIGxpbmVzLmxlbmd0aCksIFtpbm5lckNoYW5nZXNdKV07XG5cdFx0Ly8gV2hlbiBhIG5ldyBjZWxsIGlzIGluc2VydGVkLCB3ZSB1c2UgdGhlIENoYXRFZGl0aW5nQ29kZUVkaXRvckludGVncmF0aW9uIHRvIGhhbmRsZSB0aGUgZWRpdHMuXG5cdFx0Ly8gJiB0byBhbHNvIGRpc3BsYXkgdW5kby9yZWRvIGFuZCBkZWNvcmF0aW9ucy5cblx0XHQvLyBIb3dldmVyIHRoYXQgbmVlZHMgYSBtb2RpZmllZCBhbmQgb3JpZ2luYWwgbW9kZWwuXG5cdFx0Ly8gRm9yIGluc2VydGVkIGNlbGxzIHRoZXJlJ3Mgbm8gb3JpZ2luYWwgbW9kZWwsIHNvIHdlIGNyZWF0ZSBhIG5ldyBlbXB0eSB0ZXh0IG1vZGVsIGFuZCBwYXNzIHRoYXQgYXMgdGhlIG9yaWdpbmFsLlxuXHRcdGNvbnN0IG9yaWdpbmFsTW9kZWxVcmkgPSB0aGlzLm1vZGlmaWVkTW9kZWwudXJpLndpdGgoeyBxdWVyeTogKENoYXRFZGl0aW5nTW9kaWZpZWROb3RlYm9va0VudHJ5Lk5ld01vZGVsQ291bnRlcisrKS50b1N0cmluZygpLCBzY2hlbWU6ICdlbXB0eUNlbGwnIH0pO1xuXHRcdGNvbnN0IG9yaWdpbmFsTW9kZWwgPSB0aGlzLm1vZGVsU2VydmljZS5nZXRNb2RlbChvcmlnaW5hbE1vZGVsVXJpKSB8fCB0aGlzLl9yZWdpc3Rlcih0aGlzLm1vZGVsU2VydmljZS5jcmVhdGVNb2RlbCgnJywgbnVsbCwgb3JpZ2luYWxNb2RlbFVyaSkpO1xuXHRcdHRoaXMubW9kaWZpZWRUb09yaWdpbmFsQ2VsbC5zZXQoY2VsbC51cmksIG9yaWdpbmFsTW9kZWxVcmkpO1xuXHRcdGNvbnN0IGtlZXAgPSBhc3luYyAoKSA9PiB7XG5cdFx0XHR0aGlzLl9hcHBseUVkaXRzU3luYygoKSA9PiB0aGlzLmtlZXBQcmV2aW91c2x5SW5zZXJ0ZWRDZWxsKGNlbGwpKTtcblx0XHRcdHRoaXMuY29tcHV0ZVN0YXRlQWZ0ZXJBY2NlcHRpbmdSZWplY3RpbmdDaGFuZ2VzKHRydWUpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fTtcblx0XHRjb25zdCB1bmRvID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0dGhpcy5fYXBwbHlFZGl0c1N5bmMoKCkgPT4gdGhpcy51bmRvUHJldmlvdXNseUluc2VydGVkQ2VsbChjZWxsKSk7XG5cdFx0XHR0aGlzLmNvbXB1dGVTdGF0ZUFmdGVyQWNjZXB0aW5nUmVqZWN0aW5nQ2hhbmdlcyhmYWxzZSk7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9O1xuXHRcdHRoaXMucmVzb2x2ZUNlbGxNb2RlbChjZWxsLnVyaSkudGhlbihtb2RpZmllZE1vZGVsID0+IHtcblx0XHRcdC8vIFdlIHdhbnQgZGVjb3JhdG9ycyBmb3IgdGhlIGNlbGwganVzdCBhcyB3ZSBkaXNwbGF5IGRlY29yYXRvcnMgZm9yIG1vZGlmaWVkIGNlbGxzLlxuXHRcdFx0Ly8gVGhpcyB3YXkgd2UgaGF2ZSB0aGUgYWJpbGl0eSB0byBhY2NlcHQvcmVqZWN0IHRoZSBlbnRpcmUgY2VsbC5cblx0XHRcdHRoaXMuZ2V0T3JDcmVhdGVNb2RpZmllZFRleHRGaWxlRW50cnlGb3JDZWxsKGNlbGwsIG1vZGlmaWVkTW9kZWwsIG9yaWdpbmFsTW9kZWwpO1xuXHRcdH0pO1xuXHRcdHJldHVybiB7XG5cdFx0XHR0eXBlOiAnaW5zZXJ0JyBhcyBjb25zdCxcblx0XHRcdG9yaWdpbmFsQ2VsbEluZGV4OiB1bmRlZmluZWQsXG5cdFx0XHRtb2RpZmllZENlbGxJbmRleDogbW9kaWZpZWRDZWxsSW5kZXgsXG5cdFx0XHRrZWVwLFxuXHRcdFx0dW5kbyxcblx0XHRcdG1vZGlmaWVkTW9kZWw6IG5ldyBPYnNlcnZhYmxlUHJvbWlzZSh0aGlzLnJlc29sdmVDZWxsTW9kZWwoY2VsbC51cmkpKSxcblx0XHRcdG9yaWdpbmFsTW9kZWw6IG5ldyBPYnNlcnZhYmxlUHJvbWlzZShQcm9taXNlLnJlc29sdmUob3JpZ2luYWxNb2RlbCkpLFxuXHRcdFx0ZGlmZjogb2JzZXJ2YWJsZVZhbHVlKCdkZWxldGVkQ2VsbERpZmYnLCB7XG5cdFx0XHRcdGNoYW5nZXMsXG5cdFx0XHRcdGlkZW50aWNhbDogZmFsc2UsXG5cdFx0XHRcdG1vdmVzOiBbXSxcblx0XHRcdFx0cXVpdEVhcmx5OiBmYWxzZSxcblx0XHRcdH0pXG5cdFx0fSBzYXRpc2ZpZXMgSUNlbGxEaWZmSW5mbztcblx0fVxuXHRjcmVhdGVEZWxldGVDZWxsRGlmZkluZm8ob3JpZ2luYWxDZWxsSW5kZXg6IG51bWJlcik6IElDZWxsRGlmZkluZm8ge1xuXHRcdGNvbnN0IG9yaWdpbmFsQ2VsbCA9IHRoaXMub3JpZ2luYWxNb2RlbC5jZWxsc1tvcmlnaW5hbENlbGxJbmRleF07XG5cdFx0Y29uc3QgbGluZXMgPSBuZXcgQXJyYXkob3JpZ2luYWxDZWxsLnRleHRCdWZmZXIuZ2V0TGluZUNvdW50KCkpLmZpbGwoMCkubWFwKChfLCBpKSA9PiBvcmlnaW5hbENlbGwudGV4dEJ1ZmZlci5nZXRMaW5lQ29udGVudChpICsgMSkpO1xuXHRcdGNvbnN0IG9yaWdpbmFsUmFuZ2UgPSBuZXcgUmFuZ2UoMSwgMCwgbGluZXMubGVuZ3RoLCBsaW5lc1tsaW5lcy5sZW5ndGggLSAxXS5sZW5ndGgpO1xuXHRcdGNvbnN0IG1vZGlmaWVkUmFuZ2UgPSBuZXcgUmFuZ2UoMSwgMCwgMSwgMCk7XG5cdFx0Y29uc3QgaW5uZXJDaGFuZ2VzID0gbmV3IFJhbmdlTWFwcGluZyhtb2RpZmllZFJhbmdlLCBvcmlnaW5hbFJhbmdlKTtcblx0XHRjb25zdCBjaGFuZ2VzID0gW25ldyBEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmcobmV3IExpbmVSYW5nZSgxLCBsaW5lcy5sZW5ndGgpLCBuZXcgTGluZVJhbmdlKDEsIDEpLCBbaW5uZXJDaGFuZ2VzXSldO1xuXHRcdGNvbnN0IG1vZGlmaWVkTW9kZWxVcmkgPSB0aGlzLm1vZGlmaWVkTW9kZWwudXJpLndpdGgoeyBxdWVyeTogKENoYXRFZGl0aW5nTW9kaWZpZWROb3RlYm9va0VudHJ5Lk5ld01vZGVsQ291bnRlcisrKS50b1N0cmluZygpLCBzY2hlbWU6ICdlbXB0eUNlbGwnIH0pO1xuXHRcdGNvbnN0IG1vZGlmaWVkTW9kZWwgPSB0aGlzLm1vZGVsU2VydmljZS5nZXRNb2RlbChtb2RpZmllZE1vZGVsVXJpKSB8fCB0aGlzLl9yZWdpc3Rlcih0aGlzLm1vZGVsU2VydmljZS5jcmVhdGVNb2RlbCgnJywgbnVsbCwgbW9kaWZpZWRNb2RlbFVyaSkpO1xuXHRcdGNvbnN0IGtlZXAgPSBhc3luYyAoKSA9PiB7XG5cdFx0XHR0aGlzLl9hcHBseUVkaXRzU3luYygoKSA9PiB0aGlzLmtlZXBQcmV2aW91c2x5RGVsZXRlZENlbGwodGhpcy5vcmlnaW5hbE1vZGVsLmNlbGxzLmluZGV4T2Yob3JpZ2luYWxDZWxsKSkpO1xuXHRcdFx0dGhpcy5jb21wdXRlU3RhdGVBZnRlckFjY2VwdGluZ1JlamVjdGluZ0NoYW5nZXModHJ1ZSk7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9O1xuXHRcdGNvbnN0IHVuZG8gPSBhc3luYyAoKSA9PiB7XG5cdFx0XHR0aGlzLl9hcHBseUVkaXRzU3luYygoKSA9PiB0aGlzLnVuZG9QcmV2aW91c2x5RGVsZXRlZENlbGwodGhpcy5vcmlnaW5hbE1vZGVsLmNlbGxzLmluZGV4T2Yob3JpZ2luYWxDZWxsKSwgb3JpZ2luYWxDZWxsKSk7XG5cdFx0XHR0aGlzLmNvbXB1dGVTdGF0ZUFmdGVyQWNjZXB0aW5nUmVqZWN0aW5nQ2hhbmdlcyhmYWxzZSk7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9O1xuXG5cdFx0Ly8gVGhpcyB3aWxsIGJlIGRlbGV0ZWQuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHR5cGU6ICdkZWxldGUnIGFzIGNvbnN0LFxuXHRcdFx0bW9kaWZpZWRDZWxsSW5kZXg6IHVuZGVmaW5lZCxcblx0XHRcdG9yaWdpbmFsQ2VsbEluZGV4LFxuXHRcdFx0b3JpZ2luYWxNb2RlbDogbmV3IE9ic2VydmFibGVQcm9taXNlKHRoaXMucmVzb2x2ZUNlbGxNb2RlbChvcmlnaW5hbENlbGwudXJpKSksXG5cdFx0XHRtb2RpZmllZE1vZGVsOiBuZXcgT2JzZXJ2YWJsZVByb21pc2UoUHJvbWlzZS5yZXNvbHZlKG1vZGlmaWVkTW9kZWwpKSxcblx0XHRcdGtlZXAsXG5cdFx0XHR1bmRvLFxuXHRcdFx0ZGlmZjogb2JzZXJ2YWJsZVZhbHVlKCdjZWxsRGlmZicsIHtcblx0XHRcdFx0Y2hhbmdlcyxcblx0XHRcdFx0aWRlbnRpY2FsOiBmYWxzZSxcblx0XHRcdFx0bW92ZXM6IFtdLFxuXHRcdFx0XHRxdWl0RWFybHk6IGZhbHNlLFxuXHRcdFx0fSlcblx0XHR9IHNhdGlzZmllcyBJQ2VsbERpZmZJbmZvO1xuXHR9XG5cblx0cHJpdmF0ZSB1bmRvUHJldmlvdXNseUluc2VydGVkQ2VsbChjZWxsOiBOb3RlYm9va0NlbGxUZXh0TW9kZWwpIHtcblx0XHRsZXQgZGlmZnM6IElDZWxsRGlmZkluZm9bXSA9IFtdO1xuXHRcdHRoaXMuX2FwcGx5RWRpdHNTeW5jKCgpID0+IHtcblx0XHRcdGNvbnN0IGluZGV4ID0gdGhpcy5tb2RpZmllZE1vZGVsLmNlbGxzLmluZGV4T2YoY2VsbCk7XG5cdFx0XHRkaWZmcyA9IGFkanVzdENlbGxEaWZmRm9yUmV2ZXJ0aW5nQW5JbnNlcnRlZENlbGwoaW5kZXgsXG5cdFx0XHRcdHRoaXMuX2NlbGxzRGlmZkluZm8uZ2V0KCksXG5cdFx0XHRcdHRoaXMubW9kaWZpZWRNb2RlbC5hcHBseUVkaXRzLmJpbmQodGhpcy5tb2RpZmllZE1vZGVsKSk7XG5cdFx0fSk7XG5cdFx0dGhpcy5kaXNwb3NlRGVsZXRlZENlbGxFbnRyaWVzKCk7XG5cdFx0dGhpcy51cGRhdGVDZWxsRGlmZkluZm8oZGlmZnMsIHVuZGVmaW5lZCk7XG5cdH1cblxuXHRwcml2YXRlIGtlZXBQcmV2aW91c2x5SW5zZXJ0ZWRDZWxsKGNlbGw6IE5vdGVib29rQ2VsbFRleHRNb2RlbCkge1xuXHRcdGNvbnN0IG1vZGlmaWVkQ2VsbEluZGV4ID0gdGhpcy5tb2RpZmllZE1vZGVsLmNlbGxzLmluZGV4T2YoY2VsbCk7XG5cdFx0aWYgKG1vZGlmaWVkQ2VsbEluZGV4ID09PSAtMSkge1xuXHRcdFx0Ly8gTm90IHBvc3NpYmxlLlxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBjZWxsVG9JbnNlcnQ6IElDZWxsRHRvMiA9IHtcblx0XHRcdGNlbGxLaW5kOiBjZWxsLmNlbGxLaW5kLFxuXHRcdFx0bGFuZ3VhZ2U6IGNlbGwubGFuZ3VhZ2UsXG5cdFx0XHRtZXRhZGF0YTogY2VsbC5tZXRhZGF0YSxcblx0XHRcdG91dHB1dHM6IGNlbGwub3V0cHV0cyxcblx0XHRcdHNvdXJjZTogY2VsbC5nZXRWYWx1ZSgpLFxuXHRcdFx0bWltZTogY2VsbC5taW1lLFxuXHRcdFx0aW50ZXJuYWxNZXRhZGF0YToge1xuXHRcdFx0XHRpbnRlcm5hbElkOiBjZWxsLmludGVybmFsTWV0YWRhdGEuaW50ZXJuYWxJZFxuXHRcdFx0fVxuXHRcdH07XG5cdFx0dGhpcy5jZWxsRW50cnlNYXAuZ2V0KGNlbGwudXJpKT8uZGlzcG9zZSgpO1xuXHRcdHRoaXMuY2VsbEVudHJ5TWFwLmRlbGV0ZShjZWxsLnVyaSk7XG5cdFx0Y29uc3QgY2VsbERpZmZzID0gYWRqdXN0Q2VsbERpZmZGb3JLZWVwaW5nQW5JbnNlcnRlZENlbGwoXG5cdFx0XHRtb2RpZmllZENlbGxJbmRleCxcblx0XHRcdHRoaXMuX2NlbGxzRGlmZkluZm8uZ2V0KCkuc2xpY2UoKSxcblx0XHRcdGNlbGxUb0luc2VydCxcblx0XHRcdHRoaXMub3JpZ2luYWxNb2RlbC5hcHBseUVkaXRzLmJpbmQodGhpcy5vcmlnaW5hbE1vZGVsKSxcblx0XHRcdHRoaXMuY3JlYXRlTW9kaWZpZWRDZWxsRGlmZkluZm8uYmluZCh0aGlzKVxuXHRcdCk7XG5cdFx0dGhpcy51cGRhdGVDZWxsRGlmZkluZm8oY2VsbERpZmZzLCB1bmRlZmluZWQpO1xuXHR9XG5cblx0cHJpdmF0ZSB1bmRvUHJldmlvdXNseURlbGV0ZWRDZWxsKGRlbGV0ZWRPcmlnaW5hbEluZGV4OiBudW1iZXIsIG9yaWdpbmFsQ2VsbDogTm90ZWJvb2tDZWxsVGV4dE1vZGVsKSB7XG5cdFx0Y29uc3QgY2VsbFRvSW5zZXJ0OiBJQ2VsbER0bzIgPSB7XG5cdFx0XHRjZWxsS2luZDogb3JpZ2luYWxDZWxsLmNlbGxLaW5kLFxuXHRcdFx0bGFuZ3VhZ2U6IG9yaWdpbmFsQ2VsbC5sYW5ndWFnZSxcblx0XHRcdG1ldGFkYXRhOiBvcmlnaW5hbENlbGwubWV0YWRhdGEsXG5cdFx0XHRvdXRwdXRzOiBvcmlnaW5hbENlbGwub3V0cHV0cyxcblx0XHRcdHNvdXJjZTogb3JpZ2luYWxDZWxsLmdldFZhbHVlKCksXG5cdFx0XHRtaW1lOiBvcmlnaW5hbENlbGwubWltZSxcblx0XHRcdGludGVybmFsTWV0YWRhdGE6IHtcblx0XHRcdFx0aW50ZXJuYWxJZDogb3JpZ2luYWxDZWxsLmludGVybmFsTWV0YWRhdGEuaW50ZXJuYWxJZFxuXHRcdFx0fVxuXHRcdH07XG5cdFx0bGV0IGNlbGxEaWZmczogSUNlbGxEaWZmSW5mb1tdID0gW107XG5cdFx0dGhpcy5fYXBwbHlFZGl0c1N5bmMoKCkgPT4ge1xuXHRcdFx0Y2VsbERpZmZzID0gYWRqdXN0Q2VsbERpZmZGb3JSZXZlcnRpbmdBRGVsZXRlZENlbGwoXG5cdFx0XHRcdGRlbGV0ZWRPcmlnaW5hbEluZGV4LFxuXHRcdFx0XHR0aGlzLl9jZWxsc0RpZmZJbmZvLmdldCgpLFxuXHRcdFx0XHRjZWxsVG9JbnNlcnQsXG5cdFx0XHRcdHRoaXMubW9kaWZpZWRNb2RlbC5hcHBseUVkaXRzLmJpbmQodGhpcy5tb2RpZmllZE1vZGVsKSxcblx0XHRcdFx0dGhpcy5jcmVhdGVNb2RpZmllZENlbGxEaWZmSW5mby5iaW5kKHRoaXMpXG5cdFx0XHQpO1xuXHRcdH0pO1xuXHRcdHRoaXMudXBkYXRlQ2VsbERpZmZJbmZvKGNlbGxEaWZmcywgdW5kZWZpbmVkKTtcblx0fVxuXG5cblx0cHJpdmF0ZSBrZWVwUHJldmlvdXNseURlbGV0ZWRDZWxsKGRlbGV0ZWRPcmlnaW5hbEluZGV4OiBudW1iZXIpIHtcblx0XHQvLyBEZWxldGUgdGhpcyBjZWxsIGZyb20gb3JpZ2luYWwgYXMgd2VsbC5cblx0XHRjb25zdCBlZGl0OiBJQ2VsbFJlcGxhY2VFZGl0ID0geyBjZWxsczogW10sIGNvdW50OiAxLCBlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlJlcGxhY2UsIGluZGV4OiBkZWxldGVkT3JpZ2luYWxJbmRleCwgfTtcblx0XHR0aGlzLm9yaWdpbmFsTW9kZWwuYXBwbHlFZGl0cyhbZWRpdF0sIHRydWUsIHVuZGVmaW5lZCwgKCkgPT4gdW5kZWZpbmVkLCB1bmRlZmluZWQsIGZhbHNlKTtcblx0XHRjb25zdCBkaWZmcyA9IHNvcnRDZWxsQ2hhbmdlcyh0aGlzLl9jZWxsc0RpZmZJbmZvLmdldCgpKVxuXHRcdFx0LmZpbHRlcihkID0+ICEoZC50eXBlID09PSAnZGVsZXRlJyAmJiBkLm9yaWdpbmFsQ2VsbEluZGV4ID09PSBkZWxldGVkT3JpZ2luYWxJbmRleCkpXG5cdFx0XHQubWFwKGRpZmYgPT4ge1xuXHRcdFx0XHRpZiAoZGlmZi50eXBlICE9PSAnaW5zZXJ0JyAmJiBkaWZmLm9yaWdpbmFsQ2VsbEluZGV4ID4gZGVsZXRlZE9yaWdpbmFsSW5kZXgpIHtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0Li4uZGlmZixcblx0XHRcdFx0XHRcdG9yaWdpbmFsQ2VsbEluZGV4OiBkaWZmLm9yaWdpbmFsQ2VsbEluZGV4IC0gMSxcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBkaWZmO1xuXHRcdFx0fSk7XG5cdFx0dGhpcy51cGRhdGVDZWxsRGlmZkluZm8oZGlmZnMsIHVuZGVmaW5lZCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9hcHBseUVkaXRzKG9wZXJhdGlvbjogKCkgPT4gUHJvbWlzZTx2b2lkPikge1xuXHRcdC8vIG1ha2UgdGhlIGFjdHVhbCBlZGl0XG5cdFx0dGhpcy5faXNFZGl0RnJvbVVzID0gdHJ1ZTtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgb3BlcmF0aW9uKCk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMuX2lzRWRpdEZyb21VcyA9IGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2FwcGx5RWRpdHNTeW5jKG9wZXJhdGlvbjogKCkgPT4gdm9pZCkge1xuXHRcdC8vIG1ha2UgdGhlIGFjdHVhbCBlZGl0XG5cdFx0dGhpcy5faXNFZGl0RnJvbVVzID0gdHJ1ZTtcblx0XHR0cnkge1xuXHRcdFx0b3BlcmF0aW9uKCk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMuX2lzRWRpdEZyb21VcyA9IGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdG92ZXJyaWRlIGNyZWF0ZVNuYXBzaG90KHJlcXVlc3RJZDogc3RyaW5nIHwgdW5kZWZpbmVkLCB1bmRvU3RvcDogc3RyaW5nIHwgdW5kZWZpbmVkKTogSVNuYXBzaG90RW50cnkge1xuXHRcdHJldHVybiB7XG5cdFx0XHRyZXNvdXJjZTogdGhpcy5tb2RpZmllZFVSSSxcblx0XHRcdGxhbmd1YWdlSWQ6IFNuYXBzaG90TGFuZ3VhZ2VJZCxcblx0XHRcdHNuYXBzaG90VXJpOiBnZXROb3RlYm9va1NuYXBzaG90RmlsZVVSSSh0aGlzLl90ZWxlbWV0cnlJbmZvLnNlc3Npb25JZCwgcmVxdWVzdElkLCB1bmRvU3RvcCwgdGhpcy5tb2RpZmllZFVSSS5wYXRoLCB0aGlzLm1vZGlmaWVkTW9kZWwudmlld1R5cGUpLFxuXHRcdFx0b3JpZ2luYWw6IGNyZWF0ZVNuYXBzaG90KHRoaXMub3JpZ2luYWxNb2RlbCwgdGhpcy50cmFuc2llbnRPcHRpb25zLCB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKSxcblx0XHRcdGN1cnJlbnQ6IGNyZWF0ZVNuYXBzaG90KHRoaXMubW9kaWZpZWRNb2RlbCwgdGhpcy50cmFuc2llbnRPcHRpb25zLCB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKSxcblx0XHRcdG9yaWdpbmFsVG9DdXJyZW50RWRpdDogT2Zmc2V0RWRpdC5lbXB0eSxcblx0XHRcdHN0YXRlOiB0aGlzLnN0YXRlLmdldCgpLFxuXHRcdFx0dGVsZW1ldHJ5SW5mbzogdGhpcy50ZWxlbWV0cnlJbmZvLFxuXHRcdH07XG5cdH1cblxuXHRvdmVycmlkZSBlcXVhbHNTbmFwc2hvdChzbmFwc2hvdDogSVNuYXBzaG90RW50cnkgfCB1bmRlZmluZWQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISFzbmFwc2hvdCAmJlxuXHRcdFx0aXNFcXVhbCh0aGlzLm1vZGlmaWVkVVJJLCBzbmFwc2hvdC5yZXNvdXJjZSkgJiZcblx0XHRcdHRoaXMuc3RhdGUuZ2V0KCkgPT09IHNuYXBzaG90LnN0YXRlICYmXG5cdFx0XHRuZXcgU25hcHNob3RDb21wYXJlcihzbmFwc2hvdC5vcmlnaW5hbCkuaXNFcXVhbCh0aGlzLm9yaWdpbmFsTW9kZWwpICYmXG5cdFx0XHRuZXcgU25hcHNob3RDb21wYXJlcihzbmFwc2hvdC5jdXJyZW50KS5pc0VxdWFsKHRoaXMubW9kaWZpZWRNb2RlbCk7XG5cblx0fVxuXG5cdG92ZXJyaWRlIHJlc3RvcmVGcm9tU25hcHNob3Qoc25hcHNob3Q6IElTbmFwc2hvdEVudHJ5LCByZXN0b3JlVG9EaXNrID0gdHJ1ZSk6IHZvaWQge1xuXHRcdHRoaXMudXBkYXRlQ2VsbERpZmZJbmZvKFtdLCB1bmRlZmluZWQpO1xuXHRcdHRoaXMuX3N0YXRlT2JzLnNldChzbmFwc2hvdC5zdGF0ZSwgdW5kZWZpbmVkKTtcblx0XHRyZXN0b3JlU25hcHNob3QodGhpcy5vcmlnaW5hbE1vZGVsLCBzbmFwc2hvdC5vcmlnaW5hbCk7XG5cdFx0aWYgKHJlc3RvcmVUb0Rpc2spIHtcblx0XHRcdHRoaXMucmVzdG9yZVNuYXBzaG90SW5Nb2RpZmllZE1vZGVsKHNuYXBzaG90LmN1cnJlbnQpO1xuXHRcdH1cblx0XHR0aGlzLmluaXRpYWxpemVNb2RlbHNGcm9tRGlmZigpO1xuXHR9XG5cblx0b3ZlcnJpZGUgcmVzZXRUb0luaXRpYWxDb250ZW50KCk6IHZvaWQge1xuXHRcdHRoaXMudXBkYXRlQ2VsbERpZmZJbmZvKFtdLCB1bmRlZmluZWQpO1xuXHRcdHRoaXMucmVzdG9yZVNuYXBzaG90SW5Nb2RpZmllZE1vZGVsKHRoaXMuaW5pdGlhbENvbnRlbnQpO1xuXHRcdHRoaXMuaW5pdGlhbGl6ZU1vZGVsc0Zyb21EaWZmKCk7XG5cdH1cblxuXHRwcml2YXRlIHJlc3RvcmVTbmFwc2hvdEluTW9kaWZpZWRNb2RlbChzbmFwc2hvdDogc3RyaW5nKSB7XG5cdFx0aWYgKHNuYXBzaG90ID09PSBjcmVhdGVTbmFwc2hvdCh0aGlzLm1vZGlmaWVkTW9kZWwsIHRoaXMudHJhbnNpZW50T3B0aW9ucywgdGhpcy5jb25maWd1cmF0aW9uU2VydmljZSkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9hcHBseUVkaXRzU3luYygoKSA9PiB7XG5cdFx0XHQvLyBTZWUgcHJpdmF0ZSBfc2V0RG9jVmFsdWUgaW4gY2hhdEVkaXRpbmdNb2RpZmllZERvY3VtZW50RW50cnkudHNcblx0XHRcdHRoaXMubW9kaWZpZWRNb2RlbC5wdXNoU3RhY2tFbGVtZW50KCk7XG5cdFx0XHRyZXN0b3JlU25hcHNob3QodGhpcy5tb2RpZmllZE1vZGVsLCBzbmFwc2hvdCk7XG5cdFx0XHR0aGlzLm1vZGlmaWVkTW9kZWwucHVzaFN0YWNrRWxlbWVudCgpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBjZWxsVGV4dE1vZGVsTWFwID0gbmV3IFJlc291cmNlTWFwPElUZXh0TW9kZWw+KCk7XG5cblx0cHJpdmF0ZSBhc3luYyByZXNvbHZlQ2VsbE1vZGVsKGNlbGxVUkk6IFVSSSk6IFByb21pc2U8SVRleHRNb2RlbD4ge1xuXHRcdGNvbnN0IGNlbGwgPSB0aGlzLm9yaWdpbmFsTW9kZWwuY2VsbHMuY29uY2F0KHRoaXMubW9kaWZpZWRNb2RlbC5jZWxscykuZmluZChjZWxsID0+IGlzRXF1YWwoY2VsbC51cmksIGNlbGxVUkkpKTtcblx0XHRpZiAoIWNlbGwpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignQ2VsbCBub3QgZm91bmQnKTtcblx0XHR9XG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLmNlbGxUZXh0TW9kZWxNYXAuZ2V0KGNlbGwudXJpKSB8fCB0aGlzLl9yZWdpc3Rlcihhd2FpdCB0aGlzLnRleHRNb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWxSZWZlcmVuY2UoY2VsbC51cmkpKS5vYmplY3QudGV4dEVkaXRvck1vZGVsO1xuXHRcdHRoaXMuY2VsbFRleHRNb2RlbE1hcC5zZXQoY2VsbC51cmksIG1vZGVsKTtcblx0XHRyZXR1cm4gbW9kZWw7XG5cdH1cblxuXHRnZXRPckNyZWF0ZU1vZGlmaWVkVGV4dEZpbGVFbnRyeUZvckNlbGwoY2VsbDogTm90ZWJvb2tDZWxsVGV4dE1vZGVsLCBtb2RpZmllZENlbGxNb2RlbDogSVRleHRNb2RlbCwgb3JpZ2luYWxDZWxsTW9kZWw6IElUZXh0TW9kZWwpOiBDaGF0RWRpdGluZ05vdGVib29rQ2VsbEVudHJ5IHwgdW5kZWZpbmVkIHtcblx0XHRsZXQgY2VsbEVudHJ5ID0gdGhpcy5jZWxsRW50cnlNYXAuZ2V0KGNlbGwudXJpKTtcblx0XHRpZiAoY2VsbEVudHJ5KSB7XG5cdFx0XHRyZXR1cm4gY2VsbEVudHJ5O1xuXHRcdH1cblxuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNlbGxFbnRyeSA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENoYXRFZGl0aW5nTm90ZWJvb2tDZWxsRW50cnksIHRoaXMubW9kaWZpZWRSZXNvdXJjZVJlZi5vYmplY3QucmVzb3VyY2UsIGNlbGwsIG1vZGlmaWVkQ2VsbE1vZGVsLCBvcmlnaW5hbENlbGxNb2RlbCwgZGlzcG9zYWJsZXMpKTtcblx0XHR0aGlzLmNlbGxFbnRyeU1hcC5zZXQoY2VsbC51cmksIGNlbGxFbnRyeSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGF1dG9ydW4ociA9PiB7XG5cdFx0XHRpZiAodGhpcy5tb2RpZmllZE1vZGVsLmNlbGxzLmluZGV4T2YoY2VsbCkgPT09IC0xKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGRpZmZzID0gdGhpcy5jZWxsc0RpZmZJbmZvLmdldCgpLnNsaWNlKCk7XG5cdFx0XHRjb25zdCBpbmRleCA9IHRoaXMubW9kaWZpZWRNb2RlbC5jZWxscy5pbmRleE9mKGNlbGwpO1xuXHRcdFx0bGV0IGVudHJ5ID0gZGlmZnMuZmluZChlbnRyeSA9PiBlbnRyeS5tb2RpZmllZENlbGxJbmRleCA9PT0gaW5kZXgpO1xuXHRcdFx0aWYgKCFlbnRyeSkge1xuXHRcdFx0XHQvLyBOb3QgcG9zc2libGUuXG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGVudHJ5SW5kZXggPSBkaWZmcy5pbmRleE9mKGVudHJ5KTtcblx0XHRcdGVudHJ5LmRpZmYuc2V0KGNlbGxFbnRyeS5kaWZmSW5mby5yZWFkKHIpLCB1bmRlZmluZWQpO1xuXHRcdFx0aWYgKGNlbGxFbnRyeS5kaWZmSW5mby5nZXQoKS5pZGVudGljYWwgJiYgZW50cnkudHlwZSA9PT0gJ21vZGlmaWVkJykge1xuXHRcdFx0XHRlbnRyeSA9IHtcblx0XHRcdFx0XHQuLi5lbnRyeSxcblx0XHRcdFx0XHR0eXBlOiAndW5jaGFuZ2VkJyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHRcdGlmICghY2VsbEVudHJ5LmRpZmZJbmZvLmdldCgpLmlkZW50aWNhbCAmJiBlbnRyeS50eXBlID09PSAndW5jaGFuZ2VkJykge1xuXHRcdFx0XHRlbnRyeSA9IHtcblx0XHRcdFx0XHQuLi5lbnRyeSxcblx0XHRcdFx0XHR0eXBlOiAnbW9kaWZpZWQnLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdFx0ZGlmZnMuc3BsaWNlKGVudHJ5SW5kZXgsIDEsIHsgLi4uZW50cnkgfSk7XG5cblx0XHRcdHRyYW5zYWN0aW9uKHR4ID0+IHtcblx0XHRcdFx0dGhpcy51cGRhdGVDZWxsRGlmZkluZm8oZGlmZnMsIHR4KTtcblx0XHRcdH0pO1xuXHRcdH0pKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChhdXRvcnVuKHIgPT4ge1xuXHRcdFx0aWYgKHRoaXMubW9kaWZpZWRNb2RlbC5jZWxscy5pbmRleE9mKGNlbGwpID09PSAtMSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGNlbGxTdGF0ZSA9IGNlbGxFbnRyeS5zdGF0ZS5yZWFkKHIpO1xuXHRcdFx0aWYgKGNlbGxTdGF0ZSA9PT0gV29ya2luZ1NldEVudHJ5U3RhdGUuQWNjZXB0ZWQpIHtcblx0XHRcdFx0dGhpcy5jb21wdXRlU3RhdGVBZnRlckFjY2VwdGluZ1JlamVjdGluZ0NoYW5nZXModHJ1ZSk7XG5cdFx0XHR9IGVsc2UgaWYgKGNlbGxTdGF0ZSA9PT0gV29ya2luZ1NldEVudHJ5U3RhdGUuUmVqZWN0ZWQpIHtcblx0XHRcdFx0dGhpcy5jb21wdXRlU3RhdGVBZnRlckFjY2VwdGluZ1JlamVjdGluZ0NoYW5nZXMoZmFsc2UpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHJldHVybiBjZWxsRW50cnk7XG5cdH1cbn1cblxuXG5mdW5jdGlvbiBnZW5lcmF0ZUNlbGxIYXNoKGNlbGxVcmk6IFVSSSkge1xuXHRjb25zdCBoYXNoID0gbmV3IFN0cmluZ1NIQTEoKTtcblx0aGFzaC51cGRhdGUoY2VsbFVyaS50b1N0cmluZygpKTtcblx0cmV0dXJuIGhhc2guZGlnZXN0KCkuc3Vic3RyaW5nKDAsIDgpO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLHVCQUFtQztBQUM1QyxTQUFTLGFBQWEsbUJBQW1CO0FBQ3pDLFNBQVMsZUFBZTtBQUN4QixTQUFvQyxpQkFBaUIsU0FBUyxhQUFhLHlCQUF5QjtBQUNwRyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxrQkFBa0I7QUFFM0IsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsMEJBQTBCLG9CQUFvQjtBQUN2RCxTQUFTLGdCQUFnQjtBQUV6QixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLDZCQUE2QjtBQUN0QyxTQUEyQixrQkFBa0IsMkJBQTJCO0FBQ3hFLFNBQXNCLGtCQUFrQjtBQUN4QyxTQUFTLGtDQUFrQztBQUMzQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLDhCQUE4QjtBQUd2QyxTQUFTLHVDQUF1QztBQUdoRCxTQUFTLGNBQTZGLHlCQUF5Qix1QkFBd0U7QUFDdk0sU0FBUyxtQkFBbUI7QUFDNUIsU0FBUywyQ0FBMkM7QUFDcEQsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxvQ0FBb0M7QUFDN0MsU0FBNEQsNEJBQTRCO0FBRXhGLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsNENBQXlGO0FBQ2xHLFNBQVMsZ0JBQWdCLHFCQUFxQiw0QkFBNEIsaUJBQWlCLHdCQUF3QjtBQUNuSCxTQUFTLDBD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QUFLLENBQUFDLFdBQVNBLE9BQU0sc0JBQXNCLEtBQUs7QUFDakUsVUFBSSxDQUFDLE9BQU87QUFFWDtBQUFBLE1BQ0Q7QUFDQSxZQUFNLGFBQWEsTUFBTSxRQUFRLEtBQUs7QUFDdEMsWUFBTSxLQUFLLElBQUksVUFBVSxTQUFTLEtBQUssQ0FBQyxHQUFHLE1BQVM7QUFDcEQsVUFBSSxVQUFVLFNBQVMsSUFBSSxFQUFFLGFBQWEsTUFBTSxTQUFTLFlBQVk7QUFDcEUsZ0JBQVE7QUFBQSxVQUNQLEdBQUc7QUFBQSxVQUNILE1BQU07QUFBQSxRQUNQO0FBQUEsTUFDRDtBQUNBLFVBQUksQ0FBQyxVQUFVLFNBQVMsSUFBSSxFQUFFLGFBQWEsTUFBTSxTQUFTLGFBQWE7QUFDdEUsZ0JBQVE7QUFBQSxVQUNQLEdBQUc7QUFBQSxVQUNILE1BQU07QUFBQSxRQUNQO0FBQUEsTUFDRDtBQUNBLFlBQU0sT0FBTyxZQUFZLEdBQUcsRUFBRSxHQUFHLE1BQU0sQ0FBQztBQUV4QyxrQkFBWSxRQUFNO0FBQ2pCLGFBQUssbUJBQW1CLE9BQU8sRUFBRTtBQUFBLE1BQ2xDLENBQUM7QUFBQSxJQUNGLENBQUMsQ0FBQztBQUVGLGdCQUFZLElBQUksUUFBUSxPQUFLO0FBQzVCLFVBQUksS0FBSyxjQUFjLE1BQU0sUUFBUSxJQUFJLE1BQU0sSUFBSTtBQUNsRDtBQUFBLE1BQ0Q7QUFFQSxZQUFNLFlBQVksVUFBVSxNQUFNLEtBQUssQ0FBQztBQUN4QyxVQUFJLGNBQWMscUJBQXFCLFVBQVU7QUFDaEQsYUFBSywyQ0FBMkMsSUFBSTtBQUFBLE1BQ3JELFdBQVcsY0FBYyxxQkFBcUIsVUFBVTtBQUN2RCxhQUFLLDJDQUEyQyxLQUFLO0FBQUEsTUFDdEQ7QUFBQSxJQUNELENBQUMsQ0FBQztBQUVGLFdBQU87QUFBQSxFQUNSO0FBQ0Q7QUE1NkJhLGlDQUNMLGtCQUEwQjtBQURyQixtQ0FBTjtBQUFBLEVBK0dKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBekhVO0FBKzZCYixTQUFTLGlCQUFpQixTQUFjO0FBQ3ZDLFFBQU0sT0FBTyxJQUFJLFdBQVc7QUFDNUIsT0FBSyxPQUFPLFFBQVEsU0FBUyxDQUFDO0FBQzlCLFNBQU8sS0FBSyxPQUFPLEVBQUUsVUFBVSxHQUFHLENBQUM7QUFDcEM7IiwKICAibmFtZXMiOiBbImNlbGxzRGlmZkluZm8iLCAiZXZlbnQiLCAidHJhbnNhY3Rpb24iLCAiY2VsbCIsICJlbnRyeSIsICJjZWxsRW50cnkiXQp9Cg==
