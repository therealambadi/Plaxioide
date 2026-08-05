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
import { assertFn } from "../../../../base/common/assert.js";
import { BugIndicatingError, onUnexpectedError } from "../../../../base/common/errors.js";
import { Event } from "../../../../base/common/event.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { derived, observableFromEvent, observableValue } from "../../../../base/common/observable.js";
import { basename, isEqual } from "../../../../base/common/resources.js";
import Severity from "../../../../base/common/severity.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { localize } from "../../../../nls.js";
import { ConfirmResult, IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { SaveSourceRegistry } from "../../../common/editor.js";
import { EditorModel } from "../../../common/editor/editorModel.js";
import { conflictMarkers } from "./mergeMarkers/mergeMarkersController.js";
import { MergeDiffComputer } from "./model/diffComputer.js";
import { MergeEditorModel } from "./model/mergeEditorModel.js";
import { StorageCloseWithConflicts } from "../common/mergeEditor.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { ITextFileService } from "../../../services/textfile/common/textfiles.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
let TempFileMergeEditorModeFactory = class {
  constructor(_mergeEditorTelemetry, _instantiationService, _textModelService, _modelService) {
    this._mergeEditorTelemetry = _mergeEditorTelemetry;
    this._instantiationService = _instantiationService;
    this._textModelService = _textModelService;
    this._modelService = _modelService;
  }
  async createInputModel(args) {
    const store = new DisposableStore();
    const [
      base,
      result,
      input1Data,
      input2Data
    ] = await Promise.all([
      this._textModelService.createModelReference(args.base),
      this._textModelService.createModelReference(args.result),
      toInputData(args.input1, this._textModelService, store),
      toInputData(args.input2, this._textModelService, store)
    ]);
    store.add(base);
    store.add(result);
    const tempResultUri = result.object.textEditorModel.uri.with({ scheme: "merge-result" });
    const temporaryResultModel = this._modelService.createModel(
      "",
      {
        languageId: result.object.textEditorModel.getLanguageId(),
        onDidChange: Event.None
      },
      tempResultUri
    );
    store.add(temporaryResultModel);
    const mergeDiffComputer = this._instantiationService.createInstance(MergeDiffComputer);
    const model = this._instantiationService.createInstance(
      MergeEditorModel,
      base.object.textEditorModel,
      input1Data,
      input2Data,
      temporaryResultModel,
      mergeDiffComputer,
      {
        resetResult: true
      },
      this._mergeEditorTelemetry
    );
    store.add(model);
    await model.onInitialized;
    return this._instantiationService.createInstance(TempFileMergeEditorInputModel, model, store, result.object, args.result);
  }
};
TempFileMergeEditorModeFactory = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ITextModelService),
  __decorateParam(3, IModelService)
], TempFileMergeEditorModeFactory);
let TempFileMergeEditorInputModel = class extends EditorModel {
  constructor(model, disposable, result, resultUri, textFileService, dialogService, editorService) {
    super();
    this.model = model;
    this.disposable = disposable;
    this.result = result;
    this.resultUri = resultUri;
    this.textFileService = textFileService;
    this.dialogService = dialogService;
    this.editorService = editorService;
    this.savedAltVersionId = observableValue(this, this.model.resultTextModel.getAlternativeVersionId());
    this.altVersionId = observableFromEvent(
      this,
      (e) => this.model.resultTextModel.onDidChangeContent(e),
      () => (
        /** @description getAlternativeVersionId */
        this.model.resultTextModel.getAlternativeVersionId()
      )
    );
    this.isDirty = derived(this, (reader) => this.altVersionId.read(reader) !== this.savedAltVersionId.read(reader));
    this.finished = false;
  }
  dispose() {
    this.disposable.dispose();
    super.dispose();
  }
  async accept() {
    const value = await this.model.resultTextModel.getValue();
    this.result.textEditorModel.setValue(value);
    this.savedAltVersionId.set(this.model.resultTextModel.getAlternativeVersionId(), void 0);
    await this.textFileService.save(this.result.textEditorModel.uri);
    this.finished = true;
  }
  async _discard() {
    await this.textFileService.revert(this.model.resultTextModel.uri);
    this.savedAltVersionId.set(this.model.resultTextModel.getAlternativeVersionId(), void 0);
    this.finished = true;
  }
  shouldConfirmClose() {
    return true;
  }
  async confirmClose(inputModels) {
    assertFn(
      () => inputModels.some((m) => m === this)
    );
    const someDirty = inputModels.some((m) => m.isDirty.get());
    let choice;
    if (someDirty) {
      const isMany = inputModels.length > 1;
      const message = isMany ? localize("messageN", "Do you want keep the merge result of {0} files?", inputModels.length) : localize("message1", "Do you want keep the merge result of {0}?", basename(inputModels[0].model.resultTextModel.uri));
      const hasUnhandledConflicts = inputModels.some((m) => m.model.hasUnhandledConflicts.get());
      const buttons = [
        {
          label: hasUnhandledConflicts ? localize({ key: "saveWithConflict", comment: ["&& denotes a mnemonic"] }, "&&Save With Conflicts") : localize({ key: "save", comment: ["&& denotes a mnemonic"] }, "&&Save"),
          run: () => ConfirmResult.SAVE
        },
        {
          label: localize({ key: "discard", comment: ["&& denotes a mnemonic"] }, "Do&&n't Save"),
          run: () => ConfirmResult.DONT_SAVE
        }
      ];
      choice = (await this.dialogService.prompt({
        type: Severity.Info,
        message,
        detail: hasUnhandledConflicts ? isMany ? localize("detailNConflicts", "The files contain unhandled conflicts. The merge results will be lost if you don't save them.") : localize("detail1Conflicts", "The file contains unhandled conflicts. The merge result will be lost if you don't save it.") : isMany ? localize("detailN", "The merge results will be lost if you don't save them.") : localize("detail1", "The merge result will be lost if you don't save it."),
        buttons,
        cancelButton: {
          run: () => ConfirmResult.CANCEL
        }
      })).result;
    } else {
      choice = ConfirmResult.DONT_SAVE;
    }
    if (choice === ConfirmResult.SAVE) {
      await Promise.all(inputModels.map((m) => m.accept()));
    } else if (choice === ConfirmResult.DONT_SAVE) {
      await Promise.all(inputModels.map((m) => m._discard()));
    } else {
    }
    return choice;
  }
  async save(options) {
    if (this.finished) {
      return;
    }
    (async () => {
      const { confirmed } = await this.dialogService.confirm({
        message: localize(
          "saveTempFile.message",
          "Do you want to accept the merge result?"
        ),
        detail: localize(
          "saveTempFile.detail",
          "This will write the merge result to the original file and close the merge editor."
        ),
        primaryButton: localize({ key: "acceptMerge", comment: ["&& denotes a mnemonic"] }, "&&Accept Merge")
      });
      if (confirmed) {
        await this.accept();
        const editors = this.editorService.findEditors(this.resultUri).filter((e) => e.editor.typeId === "mergeEditor.Input");
        await this.editorService.closeEditors(editors);
      }
    })();
  }
  async revert(options) {
  }
};
TempFileMergeEditorInputModel = __decorateClass([
  __decorateParam(4, ITextFileService),
  __decorateParam(5, IDialogService),
  __decorateParam(6, IEditorService)
], TempFileMergeEditorInputModel);
let WorkspaceMergeEditorModeFactory = class {
  constructor(_mergeEditorTelemetry, _instantiationService, _textModelService, textFileService, _modelService, _languageService) {
    this._mergeEditorTelemetry = _mergeEditorTelemetry;
    this._instantiationService = _instantiationService;
    this._textModelService = _textModelService;
    this.textFileService = textFileService;
    this._modelService = _modelService;
    this._languageService = _languageService;
  }
  async createInputModel(args) {
    const store = new DisposableStore();
    let resultTextFileModel = void 0;
    const modelListener = store.add(new DisposableStore());
    const handleDidCreate = (model2) => {
      if (isEqual(args.result, model2.resource)) {
        modelListener.clear();
        resultTextFileModel = model2;
      }
    };
    modelListener.add(this.textFileService.files.onDidCreate(handleDidCreate));
    this.textFileService.files.models.forEach(handleDidCreate);
    let [
      base,
      result,
      input1Data,
      input2Data
    ] = await Promise.all([
      this._textModelService.createModelReference(args.base).then((v) => ({
        object: v.object.textEditorModel,
        dispose: () => v.dispose()
      })).catch((e) => {
        onUnexpectedError(e);
        console.error(e);
        return void 0;
      }),
      this._textModelService.createModelReference(args.result),
      toInputData(args.input1, this._textModelService, store),
      toInputData(args.input2, this._textModelService, store)
    ]);
    if (base === void 0) {
      const tm = this._modelService.createModel("", this._languageService.createById(result.object.getLanguageId()));
      base = {
        dispose: () => {
          tm.dispose();
        },
        object: tm
      };
    }
    store.add(base);
    store.add(result);
    if (!resultTextFileModel) {
      throw new BugIndicatingError();
    }
    await resultTextFileModel.save({ source: WorkspaceMergeEditorModeFactory.FILE_SAVED_SOURCE });
    const lines = resultTextFileModel.textEditorModel.getLinesContent();
    const hasConflictMarkers = lines.some((l) => l.startsWith(conflictMarkers.start));
    const resetResult = hasConflictMarkers;
    const mergeDiffComputer = this._instantiationService.createInstance(MergeDiffComputer);
    const model = this._instantiationService.createInstance(
      MergeEditorModel,
      base.object,
      input1Data,
      input2Data,
      result.object.textEditorModel,
      mergeDiffComputer,
      {
        resetResult
      },
      this._mergeEditorTelemetry
    );
    store.add(model);
    await model.onInitialized;
    return this._instantiationService.createInstance(WorkspaceMergeEditorInputModel, model, store, resultTextFileModel, this._mergeEditorTelemetry);
  }
};
WorkspaceMergeEditorModeFactory.FILE_SAVED_SOURCE = SaveSourceRegistry.registerSource("merge-editor.source", localize("merge-editor.source", "Before Resolving Conflicts In Merge Editor"));
WorkspaceMergeEditorModeFactory = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ITextModelService),
  __decorateParam(3, ITextFileService),
  __decorateParam(4, IModelService),
  __decorateParam(5, ILanguageService)
], WorkspaceMergeEditorModeFactory);
let WorkspaceMergeEditorInputModel = class extends EditorModel {
  constructor(model, disposableStore, resultTextFileModel, telemetry, _dialogService, _storageService) {
    super();
    this.model = model;
    this.disposableStore = disposableStore;
    this.resultTextFileModel = resultTextFileModel;
    this.telemetry = telemetry;
    this._dialogService = _dialogService;
    this._storageService = _storageService;
    this.isDirty = observableFromEvent(
      this,
      Event.any(this.resultTextFileModel.onDidChangeDirty, this.resultTextFileModel.onDidSaveError),
      () => (
        /** @description isDirty */
        this.resultTextFileModel.isDirty()
      )
    );
    this.reported = false;
    this.dateTimeOpened = /* @__PURE__ */ new Date();
  }
  dispose() {
    this.disposableStore.dispose();
    super.dispose();
    this.reportClose(false);
  }
  reportClose(accepted) {
    if (!this.reported) {
      const remainingConflictCount = this.model.unhandledConflictsCount.get();
      const durationOpenedMs = (/* @__PURE__ */ new Date()).getTime() - this.dateTimeOpened.getTime();
      this.telemetry.reportMergeEditorClosed({
        durationOpenedSecs: durationOpenedMs / 1e3,
        remainingConflictCount,
        accepted,
        conflictCount: this.model.conflictCount,
        combinableConflictCount: this.model.combinableConflictCount,
        conflictsResolvedWithBase: this.model.conflictsResolvedWithBase,
        conflictsResolvedWithInput1: this.model.conflictsResolvedWithInput1,
        conflictsResolvedWithInput2: this.model.conflictsResolvedWithInput2,
        conflictsResolvedWithSmartCombination: this.model.conflictsResolvedWithSmartCombination,
        manuallySolvedConflictCountThatEqualNone: this.model.manuallySolvedConflictCountThatEqualNone,
        manuallySolvedConflictCountThatEqualSmartCombine: this.model.manuallySolvedConflictCountThatEqualSmartCombine,
        manuallySolvedConflictCountThatEqualInput1: this.model.manuallySolvedConflictCountThatEqualInput1,
        manuallySolvedConflictCountThatEqualInput2: this.model.manuallySolvedConflictCountThatEqualInput2,
        manuallySolvedConflictCountThatEqualNoneAndStartedWithBase: this.model.manuallySolvedConflictCountThatEqualNoneAndStartedWithBase,
        manuallySolvedConflictCountThatEqualNoneAndStartedWithInput1: this.model.manuallySolvedConflictCountThatEqualNoneAndStartedWithInput1,
        manuallySolvedConflictCountThatEqualNoneAndStartedWithInput2: this.model.manuallySolvedConflictCountThatEqualNoneAndStartedWithInput2,
        manuallySolvedConflictCountThatEqualNoneAndStartedWithBothNonSmart: this.model.manuallySolvedConflictCountThatEqualNoneAndStartedWithBothNonSmart,
        manuallySolvedConflictCountThatEqualNoneAndStartedWithBothSmart: this.model.manuallySolvedConflictCountThatEqualNoneAndStartedWithBothSmart
      });
      this.reported = true;
    }
  }
  async accept() {
    this.reportClose(true);
    await this.resultTextFileModel.save();
  }
  get resultUri() {
    return this.resultTextFileModel.resource;
  }
  async save(options) {
    await this.resultTextFileModel.save(options);
  }
  /**
   * If save resets the dirty state, revert must do so too.
  */
  async revert(options) {
    await this.resultTextFileModel.revert(options);
  }
  shouldConfirmClose() {
    return true;
  }
  async confirmClose(inputModels) {
    const isMany = inputModels.length > 1;
    const someDirty = inputModels.some((m) => m.isDirty.get());
    const someUnhandledConflicts = inputModels.some((m) => m.model.hasUnhandledConflicts.get());
    if (someDirty) {
      const message = isMany ? localize("workspace.messageN", "Do you want to save the changes you made to {0} files?", inputModels.length) : localize("workspace.message1", "Do you want to save the changes you made to {0}?", basename(inputModels[0].resultUri));
      const { result } = await this._dialogService.prompt({
        type: Severity.Info,
        message,
        detail: someUnhandledConflicts ? isMany ? localize("workspace.detailN.unhandled", "The files contain unhandled conflicts. Your changes will be lost if you don't save them.") : localize("workspace.detail1.unhandled", "The file contains unhandled conflicts. Your changes will be lost if you don't save them.") : isMany ? localize("workspace.detailN.handled", "Your changes will be lost if you don't save them.") : localize("workspace.detail1.handled", "Your changes will be lost if you don't save them."),
        buttons: [
          {
            label: someUnhandledConflicts ? localize({ key: "workspace.saveWithConflict", comment: ["&& denotes a mnemonic"] }, "&&Save with Conflicts") : localize({ key: "workspace.save", comment: ["&& denotes a mnemonic"] }, "&&Save"),
            run: () => ConfirmResult.SAVE
          },
          {
            label: localize({ key: "workspace.doNotSave", comment: ["&& denotes a mnemonic"] }, "Do&&n't Save"),
            run: () => ConfirmResult.DONT_SAVE
          }
        ],
        cancelButton: {
          run: () => ConfirmResult.CANCEL
        }
      });
      return result;
    } else if (someUnhandledConflicts && !this._storageService.getBoolean(StorageCloseWithConflicts, StorageScope.PROFILE, false)) {
      const { confirmed, checkboxChecked } = await this._dialogService.confirm({
        message: isMany ? localize("workspace.messageN.nonDirty", "Do you want to close {0} merge editors?", inputModels.length) : localize("workspace.message1.nonDirty", "Do you want to close the merge editor for {0}?", basename(inputModels[0].resultUri)),
        detail: someUnhandledConflicts ? isMany ? localize("workspace.detailN.unhandled.nonDirty", "The files contain unhandled conflicts.") : localize("workspace.detail1.unhandled.nonDirty", "The file contains unhandled conflicts.") : void 0,
        primaryButton: someUnhandledConflicts ? localize({ key: "workspace.closeWithConflicts", comment: ["&& denotes a mnemonic"] }, "&&Close with Conflicts") : localize({ key: "workspace.close", comment: ["&& denotes a mnemonic"] }, "&&Close"),
        checkbox: { label: localize("noMoreWarn", "Do not ask me again") }
      });
      if (checkboxChecked) {
        this._storageService.store(StorageCloseWithConflicts, true, StorageScope.PROFILE, StorageTarget.USER);
      }
      return confirmed ? ConfirmResult.SAVE : ConfirmResult.CANCEL;
    } else {
      return ConfirmResult.SAVE;
    }
  }
};
WorkspaceMergeEditorInputModel = __decorateClass([
  __decorateParam(4, IDialogService),
  __decorateParam(5, IStorageService)
], WorkspaceMergeEditorInputModel);
async function toInputData(data, textModelService, store) {
  const ref = await textModelService.createModelReference(data.uri);
  store.add(ref);
  return {
    textModel: ref.object.textEditorModel,
    title: data.title,
    description: data.description,
    detail: data.detail
  };
}
export {
  TempFileMergeEditorModeFactory,
  WorkspaceMergeEditorModeFactory
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tZXJnZUVkaXRvci9icm93c2VyL21lcmdlRWRpdG9ySW5wdXRNb2RlbC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGFzc2VydEZuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXNzZXJ0LmpzJztcbmltcG9ydCB7IEJ1Z0luZGljYXRpbmdFcnJvciwgb25VbmV4cGVjdGVkRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCBJUmVmZXJlbmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGRlcml2ZWQsIElPYnNlcnZhYmxlLCBvYnNlcnZhYmxlRnJvbUV2ZW50LCBvYnNlcnZhYmxlVmFsdWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lLCBpc0VxdWFsIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCBTZXZlcml0eSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zZXZlcml0eS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0IHsgSVJlc29sdmVkVGV4dEVkaXRvck1vZGVsLCBJVGV4dE1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvcmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IENvbmZpcm1SZXN1bHQsIElEaWFsb2dTZXJ2aWNlLCBJUHJvbXB0QnV0dG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJUmV2ZXJ0T3B0aW9ucywgU2F2ZVNvdXJjZVJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JNb2RlbCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvZWRpdG9yTW9kZWwuanMnO1xuaW1wb3J0IHsgTWVyZ2VFZGl0b3JJbnB1dERhdGEgfSBmcm9tICcuL21lcmdlRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgY29uZmxpY3RNYXJrZXJzIH0gZnJvbSAnLi9tZXJnZU1hcmtlcnMvbWVyZ2VNYXJrZXJzQ29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyBNZXJnZURpZmZDb21wdXRlciB9IGZyb20gJy4vbW9kZWwvZGlmZkNvbXB1dGVyLmpzJztcbmltcG9ydCB7IElucHV0RGF0YSwgTWVyZ2VFZGl0b3JNb2RlbCB9IGZyb20gJy4vbW9kZWwvbWVyZ2VFZGl0b3JNb2RlbC5qcyc7XG5pbXBvcnQgeyBNZXJnZUVkaXRvclRlbGVtZXRyeSB9IGZyb20gJy4vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IFN0b3JhZ2VDbG9zZVdpdGhDb25mbGljdHMgfSBmcm9tICcuLi9jb21tb24vbWVyZ2VFZGl0b3IuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVRleHRGaWxlRWRpdG9yTW9kZWwsIElUZXh0RmlsZVNhdmVPcHRpb25zLCBJVGV4dEZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdGV4dGZpbGUvY29tbW9uL3RleHRmaWxlcy5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIE1lcmdlRWRpdG9yQXJncyB7XG5cdGJhc2U6IFVSSTtcblx0aW5wdXQxOiBNZXJnZUVkaXRvcklucHV0RGF0YTtcblx0aW5wdXQyOiBNZXJnZUVkaXRvcklucHV0RGF0YTtcblx0cmVzdWx0OiBVUkk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU1lcmdlRWRpdG9ySW5wdXRNb2RlbEZhY3Rvcnkge1xuXHRjcmVhdGVJbnB1dE1vZGVsKGFyZ3M6IE1lcmdlRWRpdG9yQXJncyk6IFByb21pc2U8SU1lcmdlRWRpdG9ySW5wdXRNb2RlbD47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU1lcmdlRWRpdG9ySW5wdXRNb2RlbCBleHRlbmRzIElEaXNwb3NhYmxlIHtcblx0cmVhZG9ubHkgcmVzdWx0VXJpOiBVUkk7XG5cblx0cmVhZG9ubHkgbW9kZWw6IE1lcmdlRWRpdG9yTW9kZWw7XG5cdHJlYWRvbmx5IGlzRGlydHk6IElPYnNlcnZhYmxlPGJvb2xlYW4+O1xuXG5cdHNhdmUob3B0aW9ucz86IElUZXh0RmlsZVNhdmVPcHRpb25zKTogUHJvbWlzZTx2b2lkPjtcblxuXHQvKipcblx0ICogSWYgc2F2ZSByZXNldHMgdGhlIGRpcnR5IHN0YXRlLCByZXZlcnQgbXVzdCBkbyBzbyB0b28uXG5cdCovXG5cdHJldmVydChvcHRpb25zPzogSVJldmVydE9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+O1xuXG5cdHNob3VsZENvbmZpcm1DbG9zZSgpOiBib29sZWFuO1xuXG5cdGNvbmZpcm1DbG9zZShpbnB1dE1vZGVsczogSU1lcmdlRWRpdG9ySW5wdXRNb2RlbFtdKTogUHJvbWlzZTxDb25maXJtUmVzdWx0PjtcblxuXHQvKipcblx0ICogTWFya3MgdGhlIG1lcmdlIGFzIGRvbmUuIFRoZSBtZXJnZSBlZGl0b3IgbXVzdCBiZSBjbG9zZWQgYWZ0ZXJ3YXJkcy5cblx0Ki9cblx0YWNjZXB0KCk6IFByb21pc2U8dm9pZD47XG59XG5cbi8qID09PT09PT09PT09PT09PT0gVGVtcCBGaWxlID09PT09PT09PT09PT09PT0gKi9cblxuZXhwb3J0IGNsYXNzIFRlbXBGaWxlTWVyZ2VFZGl0b3JNb2RlRmFjdG9yeSBpbXBsZW1lbnRzIElNZXJnZUVkaXRvcklucHV0TW9kZWxGYWN0b3J5IHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbWVyZ2VFZGl0b3JUZWxlbWV0cnk6IE1lcmdlRWRpdG9yVGVsZW1ldHJ5LFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVRleHRNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGV4dE1vZGVsU2VydmljZTogSVRleHRNb2RlbFNlcnZpY2UsXG5cdFx0QElNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlLFxuXHQpIHtcblx0fVxuXG5cdGFzeW5jIGNyZWF0ZUlucHV0TW9kZWwoYXJnczogTWVyZ2VFZGl0b3JBcmdzKTogUHJvbWlzZTxJTWVyZ2VFZGl0b3JJbnB1dE1vZGVsPiB7XG5cdFx0Y29uc3Qgc3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRjb25zdCBbXG5cdFx0XHRiYXNlLFxuXHRcdFx0cmVzdWx0LFxuXHRcdFx0aW5wdXQxRGF0YSxcblx0XHRcdGlucHV0MkRhdGEsXG5cdFx0XSA9IGF3YWl0IFByb21pc2UuYWxsKFtcblx0XHRcdHRoaXMuX3RleHRNb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWxSZWZlcmVuY2UoYXJncy5iYXNlKSxcblx0XHRcdHRoaXMuX3RleHRNb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWxSZWZlcmVuY2UoYXJncy5yZXN1bHQpLFxuXHRcdFx0dG9JbnB1dERhdGEoYXJncy5pbnB1dDEsIHRoaXMuX3RleHRNb2RlbFNlcnZpY2UsIHN0b3JlKSxcblx0XHRcdHRvSW5wdXREYXRhKGFyZ3MuaW5wdXQyLCB0aGlzLl90ZXh0TW9kZWxTZXJ2aWNlLCBzdG9yZSksXG5cdFx0XSk7XG5cblx0XHRzdG9yZS5hZGQoYmFzZSk7XG5cdFx0c3RvcmUuYWRkKHJlc3VsdCk7XG5cblx0XHRjb25zdCB0ZW1wUmVzdWx0VXJpID0gcmVzdWx0Lm9iamVjdC50ZXh0RWRpdG9yTW9kZWwudXJpLndpdGgoeyBzY2hlbWU6ICdtZXJnZS1yZXN1bHQnIH0pO1xuXG5cdFx0Y29uc3QgdGVtcG9yYXJ5UmVzdWx0TW9kZWwgPSB0aGlzLl9tb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWwoXG5cdFx0XHQnJyxcblx0XHRcdHtcblx0XHRcdFx0bGFuZ3VhZ2VJZDogcmVzdWx0Lm9iamVjdC50ZXh0RWRpdG9yTW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpLFxuXHRcdFx0XHRvbkRpZENoYW5nZTogRXZlbnQuTm9uZSxcblx0XHRcdH0sXG5cdFx0XHR0ZW1wUmVzdWx0VXJpLFxuXHRcdCk7XG5cdFx0c3RvcmUuYWRkKHRlbXBvcmFyeVJlc3VsdE1vZGVsKTtcblxuXHRcdGNvbnN0IG1lcmdlRGlmZkNvbXB1dGVyID0gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTWVyZ2VEaWZmQ29tcHV0ZXIpO1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRNZXJnZUVkaXRvck1vZGVsLFxuXHRcdFx0YmFzZS5vYmplY3QudGV4dEVkaXRvck1vZGVsLFxuXHRcdFx0aW5wdXQxRGF0YSxcblx0XHRcdGlucHV0MkRhdGEsXG5cdFx0XHR0ZW1wb3JhcnlSZXN1bHRNb2RlbCxcblx0XHRcdG1lcmdlRGlmZkNvbXB1dGVyLFxuXHRcdFx0e1xuXHRcdFx0XHRyZXNldFJlc3VsdDogdHJ1ZSxcblx0XHRcdH0sXG5cdFx0XHR0aGlzLl9tZXJnZUVkaXRvclRlbGVtZXRyeSxcblx0XHQpO1xuXHRcdHN0b3JlLmFkZChtb2RlbCk7XG5cblx0XHRhd2FpdCBtb2RlbC5vbkluaXRpYWxpemVkO1xuXG5cdFx0cmV0dXJuIHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlbXBGaWxlTWVyZ2VFZGl0b3JJbnB1dE1vZGVsLCBtb2RlbCwgc3RvcmUsIHJlc3VsdC5vYmplY3QsIGFyZ3MucmVzdWx0KTtcblx0fVxufVxuXG5jbGFzcyBUZW1wRmlsZU1lcmdlRWRpdG9ySW5wdXRNb2RlbCBleHRlbmRzIEVkaXRvck1vZGVsIGltcGxlbWVudHMgSU1lcmdlRWRpdG9ySW5wdXRNb2RlbCB7XG5cdHByaXZhdGUgcmVhZG9ubHkgc2F2ZWRBbHRWZXJzaW9uSWQgPSBvYnNlcnZhYmxlVmFsdWUodGhpcywgdGhpcy5tb2RlbC5yZXN1bHRUZXh0TW9kZWwuZ2V0QWx0ZXJuYXRpdmVWZXJzaW9uSWQoKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgYWx0VmVyc2lvbklkID0gb2JzZXJ2YWJsZUZyb21FdmVudCh0aGlzLFxuXHRcdGUgPT4gdGhpcy5tb2RlbC5yZXN1bHRUZXh0TW9kZWwub25EaWRDaGFuZ2VDb250ZW50KGUpLFxuXHRcdCgpID0+XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIGdldEFsdGVybmF0aXZlVmVyc2lvbklkICovIHRoaXMubW9kZWwucmVzdWx0VGV4dE1vZGVsLmdldEFsdGVybmF0aXZlVmVyc2lvbklkKClcblx0KTtcblxuXHRwdWJsaWMgcmVhZG9ubHkgaXNEaXJ0eSA9IGRlcml2ZWQodGhpcywgKHJlYWRlcikgPT4gdGhpcy5hbHRWZXJzaW9uSWQucmVhZChyZWFkZXIpICE9PSB0aGlzLnNhdmVkQWx0VmVyc2lvbklkLnJlYWQocmVhZGVyKSk7XG5cblx0cHJpdmF0ZSBmaW5pc2hlZCA9IGZhbHNlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSBtb2RlbDogTWVyZ2VFZGl0b3JNb2RlbCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGRpc3Bvc2FibGU6IElEaXNwb3NhYmxlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgcmVzdWx0OiBJUmVzb2x2ZWRUZXh0RWRpdG9yTW9kZWwsXG5cdFx0cHVibGljIHJlYWRvbmx5IHJlc3VsdFVyaTogVVJJLFxuXHRcdEBJVGV4dEZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGV4dEZpbGVTZXJ2aWNlOiBJVGV4dEZpbGVTZXJ2aWNlLFxuXHRcdEBJRGlhbG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGRpYWxvZ1NlcnZpY2U6IElEaWFsb2dTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLmRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdGFzeW5jIGFjY2VwdCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB2YWx1ZSA9IGF3YWl0IHRoaXMubW9kZWwucmVzdWx0VGV4dE1vZGVsLmdldFZhbHVlKCk7XG5cdFx0dGhpcy5yZXN1bHQudGV4dEVkaXRvck1vZGVsLnNldFZhbHVlKHZhbHVlKTtcblx0XHR0aGlzLnNhdmVkQWx0VmVyc2lvbklkLnNldCh0aGlzLm1vZGVsLnJlc3VsdFRleHRNb2RlbC5nZXRBbHRlcm5hdGl2ZVZlcnNpb25JZCgpLCB1bmRlZmluZWQpO1xuXHRcdGF3YWl0IHRoaXMudGV4dEZpbGVTZXJ2aWNlLnNhdmUodGhpcy5yZXN1bHQudGV4dEVkaXRvck1vZGVsLnVyaSk7XG5cdFx0dGhpcy5maW5pc2hlZCA9IHRydWU7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9kaXNjYXJkKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMudGV4dEZpbGVTZXJ2aWNlLnJldmVydCh0aGlzLm1vZGVsLnJlc3VsdFRleHRNb2RlbC51cmkpO1xuXHRcdHRoaXMuc2F2ZWRBbHRWZXJzaW9uSWQuc2V0KHRoaXMubW9kZWwucmVzdWx0VGV4dE1vZGVsLmdldEFsdGVybmF0aXZlVmVyc2lvbklkKCksIHVuZGVmaW5lZCk7XG5cdFx0dGhpcy5maW5pc2hlZCA9IHRydWU7XG5cdH1cblxuXHRwdWJsaWMgc2hvdWxkQ29uZmlybUNsb3NlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIGNvbmZpcm1DbG9zZShpbnB1dE1vZGVsczogVGVtcEZpbGVNZXJnZUVkaXRvcklucHV0TW9kZWxbXSk6IFByb21pc2U8Q29uZmlybVJlc3VsdD4ge1xuXHRcdGFzc2VydEZuKFxuXHRcdFx0KCkgPT4gaW5wdXRNb2RlbHMuc29tZSgobSkgPT4gbSA9PT0gdGhpcylcblx0XHQpO1xuXG5cdFx0Y29uc3Qgc29tZURpcnR5ID0gaW5wdXRNb2RlbHMuc29tZSgobSkgPT4gbS5pc0RpcnR5LmdldCgpKTtcblx0XHRsZXQgY2hvaWNlOiBDb25maXJtUmVzdWx0O1xuXHRcdGlmIChzb21lRGlydHkpIHtcblx0XHRcdGNvbnN0IGlzTWFueSA9IGlucHV0TW9kZWxzLmxlbmd0aCA+IDE7XG5cblx0XHRcdGNvbnN0IG1lc3NhZ2UgPSBpc01hbnlcblx0XHRcdFx0PyBsb2NhbGl6ZSgnbWVzc2FnZU4nLCAnRG8geW91IHdhbnQga2VlcCB0aGUgbWVyZ2UgcmVzdWx0IG9mIHswfSBmaWxlcz8nLCBpbnB1dE1vZGVscy5sZW5ndGgpXG5cdFx0XHRcdDogbG9jYWxpemUoJ21lc3NhZ2UxJywgJ0RvIHlvdSB3YW50IGtlZXAgdGhlIG1lcmdlIHJlc3VsdCBvZiB7MH0/JywgYmFzZW5hbWUoaW5wdXRNb2RlbHNbMF0ubW9kZWwucmVzdWx0VGV4dE1vZGVsLnVyaSkpO1xuXG5cdFx0XHRjb25zdCBoYXNVbmhhbmRsZWRDb25mbGljdHMgPSBpbnB1dE1vZGVscy5zb21lKChtKSA9PiBtLm1vZGVsLmhhc1VuaGFuZGxlZENvbmZsaWN0cy5nZXQoKSk7XG5cblx0XHRcdGNvbnN0IGJ1dHRvbnM6IElQcm9tcHRCdXR0b248Q29uZmlybVJlc3VsdD5bXSA9IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGxhYmVsOiBoYXNVbmhhbmRsZWRDb25mbGljdHMgP1xuXHRcdFx0XHRcdFx0bG9jYWxpemUoeyBrZXk6ICdzYXZlV2l0aENvbmZsaWN0JywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmU2F2ZSBXaXRoIENvbmZsaWN0c1wiKSA6XG5cdFx0XHRcdFx0XHRsb2NhbGl6ZSh7IGtleTogJ3NhdmUnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZTYXZlXCIpLFxuXHRcdFx0XHRcdHJ1bjogKCkgPT4gQ29uZmlybVJlc3VsdC5TQVZFXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoeyBrZXk6ICdkaXNjYXJkJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIkRvJiZuJ3QgU2F2ZVwiKSxcblx0XHRcdFx0XHRydW46ICgpID0+IENvbmZpcm1SZXN1bHQuRE9OVF9TQVZFXG5cdFx0XHRcdH1cblx0XHRcdF07XG5cblx0XHRcdGNob2ljZSA9IChhd2FpdCB0aGlzLmRpYWxvZ1NlcnZpY2UucHJvbXB0PENvbmZpcm1SZXN1bHQ+KHtcblx0XHRcdFx0dHlwZTogU2V2ZXJpdHkuSW5mbyxcblx0XHRcdFx0bWVzc2FnZSxcblx0XHRcdFx0ZGV0YWlsOlxuXHRcdFx0XHRcdGhhc1VuaGFuZGxlZENvbmZsaWN0c1xuXHRcdFx0XHRcdFx0PyBpc01hbnlcblx0XHRcdFx0XHRcdFx0PyBsb2NhbGl6ZSgnZGV0YWlsTkNvbmZsaWN0cycsIFwiVGhlIGZpbGVzIGNvbnRhaW4gdW5oYW5kbGVkIGNvbmZsaWN0cy4gVGhlIG1lcmdlIHJlc3VsdHMgd2lsbCBiZSBsb3N0IGlmIHlvdSBkb24ndCBzYXZlIHRoZW0uXCIpXG5cdFx0XHRcdFx0XHRcdDogbG9jYWxpemUoJ2RldGFpbDFDb25mbGljdHMnLCBcIlRoZSBmaWxlIGNvbnRhaW5zIHVuaGFuZGxlZCBjb25mbGljdHMuIFRoZSBtZXJnZSByZXN1bHQgd2lsbCBiZSBsb3N0IGlmIHlvdSBkb24ndCBzYXZlIGl0LlwiKVxuXHRcdFx0XHRcdFx0OiBpc01hbnlcblx0XHRcdFx0XHRcdFx0PyBsb2NhbGl6ZSgnZGV0YWlsTicsIFwiVGhlIG1lcmdlIHJlc3VsdHMgd2lsbCBiZSBsb3N0IGlmIHlvdSBkb24ndCBzYXZlIHRoZW0uXCIpXG5cdFx0XHRcdFx0XHRcdDogbG9jYWxpemUoJ2RldGFpbDEnLCBcIlRoZSBtZXJnZSByZXN1bHQgd2lsbCBiZSBsb3N0IGlmIHlvdSBkb24ndCBzYXZlIGl0LlwiKSxcblx0XHRcdFx0YnV0dG9ucyxcblx0XHRcdFx0Y2FuY2VsQnV0dG9uOiB7XG5cdFx0XHRcdFx0cnVuOiAoKSA9PiBDb25maXJtUmVzdWx0LkNBTkNFTFxuXHRcdFx0XHR9XG5cdFx0XHR9KSkucmVzdWx0O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjaG9pY2UgPSBDb25maXJtUmVzdWx0LkRPTlRfU0FWRTtcblx0XHR9XG5cblx0XHRpZiAoY2hvaWNlID09PSBDb25maXJtUmVzdWx0LlNBVkUpIHtcblx0XHRcdC8vIHNhdmUgd2l0aCBjb25mbGljdHNcblx0XHRcdGF3YWl0IFByb21pc2UuYWxsKGlucHV0TW9kZWxzLm1hcChtID0+IG0uYWNjZXB0KCkpKTtcblx0XHR9IGVsc2UgaWYgKGNob2ljZSA9PT0gQ29uZmlybVJlc3VsdC5ET05UX1NBVkUpIHtcblx0XHRcdC8vIGRpc2NhcmQgY2hhbmdlc1xuXHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwoaW5wdXRNb2RlbHMubWFwKG0gPT4gbS5fZGlzY2FyZCgpKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIGNhbmNlbDogc3RheSBpbiBlZGl0b3Jcblx0XHR9XG5cdFx0cmV0dXJuIGNob2ljZTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBzYXZlKG9wdGlvbnM/OiBJVGV4dEZpbGVTYXZlT3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLmZpbmlzaGVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdC8vIEl0IGRvZXMgbm90IG1ha2Ugc2Vuc2UgdG8gc2F2ZSBhbnl0aGluZyBpbiB0aGUgdGVtcCBmaWxlIG1vZGUuXG5cdFx0Ly8gVGhlIGZpbGUgc3RheXMgZGlydHkgZnJvbSB0aGUgZmlyc3QgZWRpdCBvbi5cblxuXHRcdChhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCB7IGNvbmZpcm1lZCB9ID0gYXdhaXQgdGhpcy5kaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0XHRtZXNzYWdlOiBsb2NhbGl6ZShcblx0XHRcdFx0XHQnc2F2ZVRlbXBGaWxlLm1lc3NhZ2UnLFxuXHRcdFx0XHRcdFwiRG8geW91IHdhbnQgdG8gYWNjZXB0IHRoZSBtZXJnZSByZXN1bHQ/XCJcblx0XHRcdFx0KSxcblx0XHRcdFx0ZGV0YWlsOiBsb2NhbGl6ZShcblx0XHRcdFx0XHQnc2F2ZVRlbXBGaWxlLmRldGFpbCcsXG5cdFx0XHRcdFx0XCJUaGlzIHdpbGwgd3JpdGUgdGhlIG1lcmdlIHJlc3VsdCB0byB0aGUgb3JpZ2luYWwgZmlsZSBhbmQgY2xvc2UgdGhlIG1lcmdlIGVkaXRvci5cIlxuXHRcdFx0XHQpLFxuXHRcdFx0XHRwcmltYXJ5QnV0dG9uOiBsb2NhbGl6ZSh7IGtleTogJ2FjY2VwdE1lcmdlJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCAnJiZBY2NlcHQgTWVyZ2UnKVxuXHRcdFx0fSk7XG5cblx0XHRcdGlmIChjb25maXJtZWQpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5hY2NlcHQoKTtcblx0XHRcdFx0Y29uc3QgZWRpdG9ycyA9IHRoaXMuZWRpdG9yU2VydmljZS5maW5kRWRpdG9ycyh0aGlzLnJlc3VsdFVyaSkuZmlsdGVyKGUgPT4gZS5lZGl0b3IudHlwZUlkID09PSAnbWVyZ2VFZGl0b3IuSW5wdXQnKTtcblx0XHRcdFx0YXdhaXQgdGhpcy5lZGl0b3JTZXJ2aWNlLmNsb3NlRWRpdG9ycyhlZGl0b3JzKTtcblx0XHRcdH1cblx0XHR9KSgpO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIHJldmVydChvcHRpb25zPzogSVJldmVydE9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHQvLyBubyBvcFxuXHR9XG59XG5cbi8qID09PT09PT09PT09PT09PT0gV29ya3NwYWNlID09PT09PT09PT09PT09PT0gKi9cblxuZXhwb3J0IGNsYXNzIFdvcmtzcGFjZU1lcmdlRWRpdG9yTW9kZUZhY3RvcnkgaW1wbGVtZW50cyBJTWVyZ2VFZGl0b3JJbnB1dE1vZGVsRmFjdG9yeSB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX21lcmdlRWRpdG9yVGVsZW1ldHJ5OiBNZXJnZUVkaXRvclRlbGVtZXRyeSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElUZXh0TW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3RleHRNb2RlbFNlcnZpY2U6IElUZXh0TW9kZWxTZXJ2aWNlLFxuXHRcdEBJVGV4dEZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGV4dEZpbGVTZXJ2aWNlOiBJVGV4dEZpbGVTZXJ2aWNlLFxuXHRcdEBJTW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX21vZGVsU2VydmljZTogSU1vZGVsU2VydmljZSxcblx0XHRASUxhbmd1YWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdCkge1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgRklMRV9TQVZFRF9TT1VSQ0UgPSBTYXZlU291cmNlUmVnaXN0cnkucmVnaXN0ZXJTb3VyY2UoJ21lcmdlLWVkaXRvci5zb3VyY2UnLCBsb2NhbGl6ZSgnbWVyZ2UtZWRpdG9yLnNvdXJjZScsIFwiQmVmb3JlIFJlc29sdmluZyBDb25mbGljdHMgSW4gTWVyZ2UgRWRpdG9yXCIpKTtcblxuXHRwdWJsaWMgYXN5bmMgY3JlYXRlSW5wdXRNb2RlbChhcmdzOiBNZXJnZUVkaXRvckFyZ3MpOiBQcm9taXNlPElNZXJnZUVkaXRvcklucHV0TW9kZWw+IHtcblx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdGxldCByZXN1bHRUZXh0RmlsZU1vZGVsID0gdW5kZWZpbmVkIGFzIElUZXh0RmlsZUVkaXRvck1vZGVsIHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IG1vZGVsTGlzdGVuZXIgPSBzdG9yZS5hZGQobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0XHRjb25zdCBoYW5kbGVEaWRDcmVhdGUgPSAobW9kZWw6IElUZXh0RmlsZUVkaXRvck1vZGVsKSA9PiB7XG5cdFx0XHRpZiAoaXNFcXVhbChhcmdzLnJlc3VsdCwgbW9kZWwucmVzb3VyY2UpKSB7XG5cdFx0XHRcdG1vZGVsTGlzdGVuZXIuY2xlYXIoKTtcblx0XHRcdFx0cmVzdWx0VGV4dEZpbGVNb2RlbCA9IG1vZGVsO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0bW9kZWxMaXN0ZW5lci5hZGQodGhpcy50ZXh0RmlsZVNlcnZpY2UuZmlsZXMub25EaWRDcmVhdGUoaGFuZGxlRGlkQ3JlYXRlKSk7XG5cdFx0dGhpcy50ZXh0RmlsZVNlcnZpY2UuZmlsZXMubW9kZWxzLmZvckVhY2goaGFuZGxlRGlkQ3JlYXRlKTtcblxuXHRcdGxldCBbXG5cdFx0XHRiYXNlLFxuXHRcdFx0cmVzdWx0LFxuXHRcdFx0aW5wdXQxRGF0YSxcblx0XHRcdGlucHV0MkRhdGEsXG5cdFx0XSA9IGF3YWl0IFByb21pc2UuYWxsKFtcblx0XHRcdHRoaXMuX3RleHRNb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWxSZWZlcmVuY2UoYXJncy5iYXNlKS50aGVuPElSZWZlcmVuY2U8SVRleHRNb2RlbD4+KHYgPT4gKHtcblx0XHRcdFx0b2JqZWN0OiB2Lm9iamVjdC50ZXh0RWRpdG9yTW9kZWwsXG5cdFx0XHRcdGRpc3Bvc2U6ICgpID0+IHYuZGlzcG9zZSgpLFxuXHRcdFx0fSkpLmNhdGNoKGUgPT4ge1xuXHRcdFx0XHRvblVuZXhwZWN0ZWRFcnJvcihlKTtcblx0XHRcdFx0Y29uc29sZS5lcnJvcihlKTsgLy8gT25seSBmaWxlIG5vdCBmb3VuZCBlcnJvciBzaG91bGQgYmUgaGFuZGxlZCBpZGVhbGx5XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9KSxcblx0XHRcdHRoaXMuX3RleHRNb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWxSZWZlcmVuY2UoYXJncy5yZXN1bHQpLFxuXHRcdFx0dG9JbnB1dERhdGEoYXJncy5pbnB1dDEsIHRoaXMuX3RleHRNb2RlbFNlcnZpY2UsIHN0b3JlKSxcblx0XHRcdHRvSW5wdXREYXRhKGFyZ3MuaW5wdXQyLCB0aGlzLl90ZXh0TW9kZWxTZXJ2aWNlLCBzdG9yZSksXG5cdFx0XSk7XG5cblx0XHRpZiAoYmFzZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRjb25zdCB0bSA9IHRoaXMuX21vZGVsU2VydmljZS5jcmVhdGVNb2RlbCgnJywgdGhpcy5fbGFuZ3VhZ2VTZXJ2aWNlLmNyZWF0ZUJ5SWQocmVzdWx0Lm9iamVjdC5nZXRMYW5ndWFnZUlkKCkpKTtcblx0XHRcdGJhc2UgPSB7XG5cdFx0XHRcdGRpc3Bvc2U6ICgpID0+IHsgdG0uZGlzcG9zZSgpOyB9LFxuXHRcdFx0XHRvYmplY3Q6IHRtXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdHN0b3JlLmFkZChiYXNlKTtcblx0XHRzdG9yZS5hZGQocmVzdWx0KTtcblxuXHRcdGlmICghcmVzdWx0VGV4dEZpbGVNb2RlbCkge1xuXHRcdFx0dGhyb3cgbmV3IEJ1Z0luZGljYXRpbmdFcnJvcigpO1xuXHRcdH1cblx0XHQvLyBTbyB0aGF0IFwiRG9uJ3Qgc2F2ZVwiIGRvZXMgcmV2ZXJ0IHRoZSBmaWxlXG5cdFx0YXdhaXQgcmVzdWx0VGV4dEZpbGVNb2RlbC5zYXZlKHsgc291cmNlOiBXb3Jrc3BhY2VNZXJnZUVkaXRvck1vZGVGYWN0b3J5LkZJTEVfU0FWRURfU09VUkNFIH0pO1xuXG5cdFx0Y29uc3QgbGluZXMgPSByZXN1bHRUZXh0RmlsZU1vZGVsLnRleHRFZGl0b3JNb2RlbCEuZ2V0TGluZXNDb250ZW50KCk7XG5cdFx0Y29uc3QgaGFzQ29uZmxpY3RNYXJrZXJzID0gbGluZXMuc29tZShsID0+IGwuc3RhcnRzV2l0aChjb25mbGljdE1hcmtlcnMuc3RhcnQpKTtcblx0XHRjb25zdCByZXNldFJlc3VsdCA9IGhhc0NvbmZsaWN0TWFya2VycztcblxuXHRcdGNvbnN0IG1lcmdlRGlmZkNvbXB1dGVyID0gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTWVyZ2VEaWZmQ29tcHV0ZXIpO1xuXG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShcblx0XHRcdE1lcmdlRWRpdG9yTW9kZWwsXG5cdFx0XHRiYXNlLm9iamVjdCxcblx0XHRcdGlucHV0MURhdGEsXG5cdFx0XHRpbnB1dDJEYXRhLFxuXHRcdFx0cmVzdWx0Lm9iamVjdC50ZXh0RWRpdG9yTW9kZWwsXG5cdFx0XHRtZXJnZURpZmZDb21wdXRlcixcblx0XHRcdHtcblx0XHRcdFx0cmVzZXRSZXN1bHRcblx0XHRcdH0sXG5cdFx0XHR0aGlzLl9tZXJnZUVkaXRvclRlbGVtZXRyeSxcblx0XHQpO1xuXHRcdHN0b3JlLmFkZChtb2RlbCk7XG5cblx0XHRhd2FpdCBtb2RlbC5vbkluaXRpYWxpemVkO1xuXG5cdFx0cmV0dXJuIHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFdvcmtzcGFjZU1lcmdlRWRpdG9ySW5wdXRNb2RlbCwgbW9kZWwsIHN0b3JlLCByZXN1bHRUZXh0RmlsZU1vZGVsLCB0aGlzLl9tZXJnZUVkaXRvclRlbGVtZXRyeSk7XG5cdH1cbn1cblxuY2xhc3MgV29ya3NwYWNlTWVyZ2VFZGl0b3JJbnB1dE1vZGVsIGV4dGVuZHMgRWRpdG9yTW9kZWwgaW1wbGVtZW50cyBJTWVyZ2VFZGl0b3JJbnB1dE1vZGVsIHtcblx0cHVibGljIHJlYWRvbmx5IGlzRGlydHkgPSBvYnNlcnZhYmxlRnJvbUV2ZW50KHRoaXMsXG5cdFx0RXZlbnQuYW55KHRoaXMucmVzdWx0VGV4dEZpbGVNb2RlbC5vbkRpZENoYW5nZURpcnR5LCB0aGlzLnJlc3VsdFRleHRGaWxlTW9kZWwub25EaWRTYXZlRXJyb3IpLFxuXHRcdCgpID0+IC8qKiBAZGVzY3JpcHRpb24gaXNEaXJ0eSAqLyB0aGlzLnJlc3VsdFRleHRGaWxlTW9kZWwuaXNEaXJ0eSgpXG5cdCk7XG5cblx0cHJpdmF0ZSByZXBvcnRlZCA9IGZhbHNlO1xuXHRwcml2YXRlIHJlYWRvbmx5IGRhdGVUaW1lT3BlbmVkID0gbmV3IERhdGUoKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgbW9kZWw6IE1lcmdlRWRpdG9yTW9kZWwsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBkaXNwb3NhYmxlU3RvcmU6IERpc3Bvc2FibGVTdG9yZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHJlc3VsdFRleHRGaWxlTW9kZWw6IElUZXh0RmlsZUVkaXRvck1vZGVsLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgdGVsZW1ldHJ5OiBNZXJnZUVkaXRvclRlbGVtZXRyeSxcblx0XHRASURpYWxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZGlhbG9nU2VydmljZTogSURpYWxvZ1NlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9zdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5kaXNwb3NhYmxlU3RvcmUuZGlzcG9zZSgpO1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblxuXHRcdHRoaXMucmVwb3J0Q2xvc2UoZmFsc2UpO1xuXHR9XG5cblx0cHJpdmF0ZSByZXBvcnRDbG9zZShhY2NlcHRlZDogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICghdGhpcy5yZXBvcnRlZCkge1xuXHRcdFx0Y29uc3QgcmVtYWluaW5nQ29uZmxpY3RDb3VudCA9IHRoaXMubW9kZWwudW5oYW5kbGVkQ29uZmxpY3RzQ291bnQuZ2V0KCk7XG5cdFx0XHRjb25zdCBkdXJhdGlvbk9wZW5lZE1zID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgLSB0aGlzLmRhdGVUaW1lT3BlbmVkLmdldFRpbWUoKTtcblx0XHRcdHRoaXMudGVsZW1ldHJ5LnJlcG9ydE1lcmdlRWRpdG9yQ2xvc2VkKHtcblx0XHRcdFx0ZHVyYXRpb25PcGVuZWRTZWNzOiBkdXJhdGlvbk9wZW5lZE1zIC8gMTAwMCxcblx0XHRcdFx0cmVtYWluaW5nQ29uZmxpY3RDb3VudCxcblx0XHRcdFx0YWNjZXB0ZWQsXG5cblx0XHRcdFx0Y29uZmxpY3RDb3VudDogdGhpcy5tb2RlbC5jb25mbGljdENvdW50LFxuXHRcdFx0XHRjb21iaW5hYmxlQ29uZmxpY3RDb3VudDogdGhpcy5tb2RlbC5jb21iaW5hYmxlQ29uZmxpY3RDb3VudCxcblxuXHRcdFx0XHRjb25mbGljdHNSZXNvbHZlZFdpdGhCYXNlOiB0aGlzLm1vZGVsLmNvbmZsaWN0c1Jlc29sdmVkV2l0aEJhc2UsXG5cdFx0XHRcdGNvbmZsaWN0c1Jlc29sdmVkV2l0aElucHV0MTogdGhpcy5tb2RlbC5jb25mbGljdHNSZXNvbHZlZFdpdGhJbnB1dDEsXG5cdFx0XHRcdGNvbmZsaWN0c1Jlc29sdmVkV2l0aElucHV0MjogdGhpcy5tb2RlbC5jb25mbGljdHNSZXNvbHZlZFdpdGhJbnB1dDIsXG5cdFx0XHRcdGNvbmZsaWN0c1Jlc29sdmVkV2l0aFNtYXJ0Q29tYmluYXRpb246IHRoaXMubW9kZWwuY29uZmxpY3RzUmVzb2x2ZWRXaXRoU21hcnRDb21iaW5hdGlvbixcblxuXHRcdFx0XHRtYW51YWxseVNvbHZlZENvbmZsaWN0Q291bnRUaGF0RXF1YWxOb25lOiB0aGlzLm1vZGVsLm1hbnVhbGx5U29sdmVkQ29uZmxpY3RDb3VudFRoYXRFcXVhbE5vbmUsXG5cdFx0XHRcdG1hbnVhbGx5U29sdmVkQ29uZmxpY3RDb3VudFRoYXRFcXVhbFNtYXJ0Q29tYmluZTogdGhpcy5tb2RlbC5tYW51YWxseVNvbHZlZENvbmZsaWN0Q291bnRUaGF0RXF1YWxTbWFydENvbWJpbmUsXG5cdFx0XHRcdG1hbnVhbGx5U29sdmVkQ29uZmxpY3RDb3VudFRoYXRFcXVhbElucHV0MTogdGhpcy5tb2RlbC5tYW51YWxseVNvbHZlZENvbmZsaWN0Q291bnRUaGF0RXF1YWxJbnB1dDEsXG5cdFx0XHRcdG1hbnVhbGx5U29sdmVkQ29uZmxpY3RDb3VudFRoYXRFcXVhbElucHV0MjogdGhpcy5tb2RlbC5tYW51YWxseVNvbHZlZENvbmZsaWN0Q291bnRUaGF0RXF1YWxJbnB1dDIsXG5cblx0XHRcdFx0bWFudWFsbHlTb2x2ZWRDb25mbGljdENvdW50VGhhdEVxdWFsTm9uZUFuZFN0YXJ0ZWRXaXRoQmFzZTogdGhpcy5tb2RlbC5tYW51YWxseVNvbHZlZENvbmZsaWN0Q291bnRUaGF0RXF1YWxOb25lQW5kU3RhcnRlZFdpdGhCYXNlLFxuXHRcdFx0XHRtYW51YWxseVNvbHZlZENvbmZsaWN0Q291bnRUaGF0RXF1YWxOb25lQW5kU3RhcnRlZFdpdGhJbnB1dDE6IHRoaXMubW9kZWwubWFudWFsbHlTb2x2ZWRDb25mbGljdENvdW50VGhhdEVxdWFsTm9uZUFuZFN0YXJ0ZWRXaXRoSW5wdXQxLFxuXHRcdFx0XHRtYW51YWxseVNvbHZlZENvbmZsaWN0Q291bnRUaGF0RXF1YWxOb25lQW5kU3RhcnRlZFdpdGhJbnB1dDI6IHRoaXMubW9kZWwubWFudWFsbHlTb2x2ZWRDb25mbGljdENvdW50VGhhdEVxdWFsTm9uZUFuZFN0YXJ0ZWRXaXRoSW5wdXQyLFxuXHRcdFx0XHRtYW51YWxseVNvbHZlZENvbmZsaWN0Q291bnRUaGF0RXF1YWxOb25lQW5kU3RhcnRlZFdpdGhCb3RoTm9uU21hcnQ6IHRoaXMubW9kZWwubWFudWFsbHlTb2x2ZWRDb25mbGljdENvdW50VGhhdEVxdWFsTm9uZUFuZFN0YXJ0ZWRXaXRoQm90aE5vblNtYXJ0LFxuXHRcdFx0XHRtYW51YWxseVNvbHZlZENvbmZsaWN0Q291bnRUaGF0RXF1YWxOb25lQW5kU3RhcnRlZFdpdGhCb3RoU21hcnQ6IHRoaXMubW9kZWwubWFudWFsbHlTb2x2ZWRDb25mbGljdENvdW50VGhhdEVxdWFsTm9uZUFuZFN0YXJ0ZWRXaXRoQm90aFNtYXJ0LFxuXHRcdFx0fSk7XG5cdFx0XHR0aGlzLnJlcG9ydGVkID0gdHJ1ZTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgYWNjZXB0KCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMucmVwb3J0Q2xvc2UodHJ1ZSk7XG5cdFx0YXdhaXQgdGhpcy5yZXN1bHRUZXh0RmlsZU1vZGVsLnNhdmUoKTtcblx0fVxuXG5cdGdldCByZXN1bHRVcmkoKTogVVJJIHtcblx0XHRyZXR1cm4gdGhpcy5yZXN1bHRUZXh0RmlsZU1vZGVsLnJlc291cmNlO1xuXHR9XG5cblx0YXN5bmMgc2F2ZShvcHRpb25zPzogSVRleHRGaWxlU2F2ZU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLnJlc3VsdFRleHRGaWxlTW9kZWwuc2F2ZShvcHRpb25zKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBJZiBzYXZlIHJlc2V0cyB0aGUgZGlydHkgc3RhdGUsIHJldmVydCBtdXN0IGRvIHNvIHRvby5cblx0Ki9cblx0YXN5bmMgcmV2ZXJ0KG9wdGlvbnM/OiBJUmV2ZXJ0T3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMucmVzdWx0VGV4dEZpbGVNb2RlbC5yZXZlcnQob3B0aW9ucyk7XG5cdH1cblxuXHRzaG91bGRDb25maXJtQ2xvc2UoKTogYm9vbGVhbiB7XG5cdFx0Ly8gQWx3YXlzIGNvbmZpcm1cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdGFzeW5jIGNvbmZpcm1DbG9zZShpbnB1dE1vZGVsczogSU1lcmdlRWRpdG9ySW5wdXRNb2RlbFtdKTogUHJvbWlzZTxDb25maXJtUmVzdWx0PiB7XG5cdFx0Y29uc3QgaXNNYW55ID0gaW5wdXRNb2RlbHMubGVuZ3RoID4gMTtcblx0XHRjb25zdCBzb21lRGlydHkgPSBpbnB1dE1vZGVscy5zb21lKG0gPT4gbS5pc0RpcnR5LmdldCgpKTtcblx0XHRjb25zdCBzb21lVW5oYW5kbGVkQ29uZmxpY3RzID0gaW5wdXRNb2RlbHMuc29tZShtID0+IG0ubW9kZWwuaGFzVW5oYW5kbGVkQ29uZmxpY3RzLmdldCgpKTtcblx0XHRpZiAoc29tZURpcnR5KSB7XG5cdFx0XHRjb25zdCBtZXNzYWdlID0gaXNNYW55XG5cdFx0XHRcdD8gbG9jYWxpemUoJ3dvcmtzcGFjZS5tZXNzYWdlTicsICdEbyB5b3Ugd2FudCB0byBzYXZlIHRoZSBjaGFuZ2VzIHlvdSBtYWRlIHRvIHswfSBmaWxlcz8nLCBpbnB1dE1vZGVscy5sZW5ndGgpXG5cdFx0XHRcdDogbG9jYWxpemUoJ3dvcmtzcGFjZS5tZXNzYWdlMScsICdEbyB5b3Ugd2FudCB0byBzYXZlIHRoZSBjaGFuZ2VzIHlvdSBtYWRlIHRvIHswfT8nLCBiYXNlbmFtZShpbnB1dE1vZGVsc1swXS5yZXN1bHRVcmkpKTtcblx0XHRcdGNvbnN0IHsgcmVzdWx0IH0gPSBhd2FpdCB0aGlzLl9kaWFsb2dTZXJ2aWNlLnByb21wdDxDb25maXJtUmVzdWx0Pih7XG5cdFx0XHRcdHR5cGU6IFNldmVyaXR5LkluZm8sXG5cdFx0XHRcdG1lc3NhZ2UsXG5cdFx0XHRcdGRldGFpbDpcblx0XHRcdFx0XHRzb21lVW5oYW5kbGVkQ29uZmxpY3RzID9cblx0XHRcdFx0XHRcdGlzTWFueVxuXHRcdFx0XHRcdFx0XHQ/IGxvY2FsaXplKCd3b3Jrc3BhY2UuZGV0YWlsTi51bmhhbmRsZWQnLCBcIlRoZSBmaWxlcyBjb250YWluIHVuaGFuZGxlZCBjb25mbGljdHMuIFlvdXIgY2hhbmdlcyB3aWxsIGJlIGxvc3QgaWYgeW91IGRvbid0IHNhdmUgdGhlbS5cIilcblx0XHRcdFx0XHRcdFx0OiBsb2NhbGl6ZSgnd29ya3NwYWNlLmRldGFpbDEudW5oYW5kbGVkJywgXCJUaGUgZmlsZSBjb250YWlucyB1bmhhbmRsZWQgY29uZmxpY3RzLiBZb3VyIGNoYW5nZXMgd2lsbCBiZSBsb3N0IGlmIHlvdSBkb24ndCBzYXZlIHRoZW0uXCIpXG5cdFx0XHRcdFx0XHQ6IGlzTWFueVxuXHRcdFx0XHRcdFx0XHQ/IGxvY2FsaXplKCd3b3Jrc3BhY2UuZGV0YWlsTi5oYW5kbGVkJywgXCJZb3VyIGNoYW5nZXMgd2lsbCBiZSBsb3N0IGlmIHlvdSBkb24ndCBzYXZlIHRoZW0uXCIpXG5cdFx0XHRcdFx0XHRcdDogbG9jYWxpemUoJ3dvcmtzcGFjZS5kZXRhaWwxLmhhbmRsZWQnLCBcIllvdXIgY2hhbmdlcyB3aWxsIGJlIGxvc3QgaWYgeW91IGRvbid0IHNhdmUgdGhlbS5cIiksXG5cdFx0XHRcdGJ1dHRvbnM6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRsYWJlbDogc29tZVVuaGFuZGxlZENvbmZsaWN0c1xuXHRcdFx0XHRcdFx0XHQ/IGxvY2FsaXplKHsga2V5OiAnd29ya3NwYWNlLnNhdmVXaXRoQ29uZmxpY3QnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sICcmJlNhdmUgd2l0aCBDb25mbGljdHMnKVxuXHRcdFx0XHRcdFx0XHQ6IGxvY2FsaXplKHsga2V5OiAnd29ya3NwYWNlLnNhdmUnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sICcmJlNhdmUnKSxcblx0XHRcdFx0XHRcdHJ1bjogKCkgPT4gQ29uZmlybVJlc3VsdC5TQVZFXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoeyBrZXk6ICd3b3Jrc3BhY2UuZG9Ob3RTYXZlJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIkRvJiZuJ3QgU2F2ZVwiKSxcblx0XHRcdFx0XHRcdHJ1bjogKCkgPT4gQ29uZmlybVJlc3VsdC5ET05UX1NBVkVcblx0XHRcdFx0XHR9XG5cdFx0XHRcdF0sXG5cdFx0XHRcdGNhbmNlbEJ1dHRvbjoge1xuXHRcdFx0XHRcdHJ1bjogKCkgPT4gQ29uZmlybVJlc3VsdC5DQU5DRUxcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXG5cdFx0fSBlbHNlIGlmIChzb21lVW5oYW5kbGVkQ29uZmxpY3RzICYmICF0aGlzLl9zdG9yYWdlU2VydmljZS5nZXRCb29sZWFuKFN0b3JhZ2VDbG9zZVdpdGhDb25mbGljdHMsIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBmYWxzZSkpIHtcblx0XHRcdGNvbnN0IHsgY29uZmlybWVkLCBjaGVja2JveENoZWNrZWQgfSA9IGF3YWl0IHRoaXMuX2RpYWxvZ1NlcnZpY2UuY29uZmlybSh7XG5cdFx0XHRcdG1lc3NhZ2U6IGlzTWFueVxuXHRcdFx0XHRcdD8gbG9jYWxpemUoJ3dvcmtzcGFjZS5tZXNzYWdlTi5ub25EaXJ0eScsICdEbyB5b3Ugd2FudCB0byBjbG9zZSB7MH0gbWVyZ2UgZWRpdG9ycz8nLCBpbnB1dE1vZGVscy5sZW5ndGgpXG5cdFx0XHRcdFx0OiBsb2NhbGl6ZSgnd29ya3NwYWNlLm1lc3NhZ2UxLm5vbkRpcnR5JywgJ0RvIHlvdSB3YW50IHRvIGNsb3NlIHRoZSBtZXJnZSBlZGl0b3IgZm9yIHswfT8nLCBiYXNlbmFtZShpbnB1dE1vZGVsc1swXS5yZXN1bHRVcmkpKSxcblx0XHRcdFx0ZGV0YWlsOiBzb21lVW5oYW5kbGVkQ29uZmxpY3RzID9cblx0XHRcdFx0XHRpc01hbnlcblx0XHRcdFx0XHRcdD8gbG9jYWxpemUoJ3dvcmtzcGFjZS5kZXRhaWxOLnVuaGFuZGxlZC5ub25EaXJ0eScsIFwiVGhlIGZpbGVzIGNvbnRhaW4gdW5oYW5kbGVkIGNvbmZsaWN0cy5cIilcblx0XHRcdFx0XHRcdDogbG9jYWxpemUoJ3dvcmtzcGFjZS5kZXRhaWwxLnVuaGFuZGxlZC5ub25EaXJ0eScsIFwiVGhlIGZpbGUgY29udGFpbnMgdW5oYW5kbGVkIGNvbmZsaWN0cy5cIilcblx0XHRcdFx0XHQ6IHVuZGVmaW5lZCxcblx0XHRcdFx0cHJpbWFyeUJ1dHRvbjogc29tZVVuaGFuZGxlZENvbmZsaWN0c1xuXHRcdFx0XHRcdD8gbG9jYWxpemUoeyBrZXk6ICd3b3Jrc3BhY2UuY2xvc2VXaXRoQ29uZmxpY3RzJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCAnJiZDbG9zZSB3aXRoIENvbmZsaWN0cycpXG5cdFx0XHRcdFx0OiBsb2NhbGl6ZSh7IGtleTogJ3dvcmtzcGFjZS5jbG9zZScsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgJyYmQ2xvc2UnKSxcblx0XHRcdFx0Y2hlY2tib3g6IHsgbGFiZWw6IGxvY2FsaXplKCdub01vcmVXYXJuJywgXCJEbyBub3QgYXNrIG1lIGFnYWluXCIpIH1cblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAoY2hlY2tib3hDaGVja2VkKSB7XG5cdFx0XHRcdHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLnN0b3JlKFN0b3JhZ2VDbG9zZVdpdGhDb25mbGljdHMsIHRydWUsIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0LlVTRVIpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gY29uZmlybWVkID8gQ29uZmlybVJlc3VsdC5TQVZFIDogQ29uZmlybVJlc3VsdC5DQU5DRUw7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIFRoaXMgc2hvdWxkbid0IGRvIGFueXRoaW5nXG5cdFx0XHRyZXR1cm4gQ29uZmlybVJlc3VsdC5TQVZFO1xuXHRcdH1cblx0fVxufVxuXG4vKiA9PT09PT09PT09PT09PT09PSBVdGlscyA9PT09PT09PT09PT09PT09PT0gKi9cblxuYXN5bmMgZnVuY3Rpb24gdG9JbnB1dERhdGEoZGF0YTogTWVyZ2VFZGl0b3JJbnB1dERhdGEsIHRleHRNb2RlbFNlcnZpY2U6IElUZXh0TW9kZWxTZXJ2aWNlLCBzdG9yZTogRGlzcG9zYWJsZVN0b3JlKTogUHJvbWlzZTxJbnB1dERhdGE+IHtcblx0Y29uc3QgcmVmID0gYXdhaXQgdGV4dE1vZGVsU2VydmljZS5jcmVhdGVNb2RlbFJlZmVyZW5jZShkYXRhLnVyaSk7XG5cdHN0b3JlLmFkZChyZWYpO1xuXHRyZXR1cm4ge1xuXHRcdHRleHRNb2RlbDogcmVmLm9iamVjdC50ZXh0RWRpdG9yTW9kZWwsXG5cdFx0dGl0bGU6IGRhdGEudGl0bGUsXG5cdFx0ZGVzY3JpcHRpb246IGRhdGEuZGVzY3JpcHRpb24sXG5cdFx0ZGV0YWlsOiBkYXRhLmRldGFpbCxcblx0fTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxvQkFBb0IseUJBQXlCO0FBQ3RELFNBQVMsYUFBYTtBQUN0QixTQUFTLHVCQUFnRDtBQUN6RCxTQUFTLFNBQXNCLHFCQUFxQix1QkFBdUI7QUFDM0UsU0FBUyxVQUFVLGVBQWU7QUFDbEMsT0FBTyxjQUFjO0FBRXJCLFNBQVMscUJBQXFCO0FBQzlCLFNBQW1DLHlCQUF5QjtBQUM1RCxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGVBQWUsc0JBQXFDO0FBQzdELFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FBQzdELFNBQXlCLDBCQUEwQjtBQUNuRCxTQUFTLG1CQUFtQjtBQUU1QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFvQix3QkFBd0I7QUFFNUMsU0FBUyxpQ0FBaUM7QUFDMUMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBcUQsd0JBQXdCO0FBRTdFLFNBQVMsd0JBQXdCO0FBc0MxQixJQUFNLGlDQUFOLE1BQThFO0FBQUEsRUFDcEYsWUFDa0IsdUJBQ3VCLHVCQUNKLG1CQUNKLGVBQy9CO0FBSmdCO0FBQ3VCO0FBQ0o7QUFDSjtBQUFBLEVBRWpDO0FBQUEsRUFFQSxNQUFNLGlCQUFpQixNQUF3RDtBQUM5RSxVQUFNLFFBQVEsSUFB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
