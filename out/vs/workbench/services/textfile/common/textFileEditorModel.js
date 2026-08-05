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
import { localize } from "../../../../nls.js";
import { Emitter } from "../../../../base/common/event.js";
import { mark } from "../../../../base/common/performance.js";
import { assertIsDefined } from "../../../../base/common/types.js";
import { EncodingMode, ITextFileService, TextFileEditorModelState, TextFileResolveReason } from "./textfiles.js";
import { SaveReason, SaveSourceRegistry } from "../../../common/editor.js";
import { BaseTextEditorModel } from "../../../common/editor/textEditorModel.js";
import { IWorkingCopyBackupService } from "../../workingCopy/common/workingCopyBackup.js";
import { IFileService, FileOperationResult, FileChangeType, ETAG_DISABLED, NotModifiedSinceFileOperationError } from "../../../../platform/files/common/files.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { timeout, TaskSequentializer } from "../../../../base/common/async.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { basename } from "../../../../base/common/path.js";
import { IWorkingCopyService } from "../../workingCopy/common/workingCopyService.js";
import { WorkingCopyCapabilities, NO_TYPE_ID } from "../../workingCopy/common/workingCopy.js";
import { IFilesConfigurationService } from "../../filesConfiguration/common/filesConfigurationService.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { UTF16be, UTF16le, UTF8, UTF8_with_bom } from "./encoding.js";
import { createTextBufferFactoryFromStream } from "../../../../editor/common/model/textModel.js";
import { ILanguageDetectionService } from "../../languageDetection/common/languageDetectionWorkerService.js";
import { IPathService } from "../../path/common/pathService.js";
import { extUri } from "../../../../base/common/resources.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { PLAINTEXT_LANGUAGE_ID } from "../../../../editor/common/languages/modesRegistry.js";
import { IExtensionService } from "../../extensions/common/extensions.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { isCancellationError } from "../../../../base/common/errors.js";
let TextFileEditorModel = class extends BaseTextEditorModel {
  constructor(resource, preferredEncoding, preferredLanguageId, languageService, modelService, fileService, textFileService, workingCopyBackupService, logService, workingCopyService, filesConfigurationService, labelService, languageDetectionService, accessibilityService, pathService, extensionService, progressService) {
    super(modelService, languageService, languageDetectionService, accessibilityService);
    this.resource = resource;
    this.preferredEncoding = preferredEncoding;
    this.preferredLanguageId = preferredLanguageId;
    this.fileService = fileService;
    this.textFileService = textFileService;
    this.workingCopyBackupService = workingCopyBackupService;
    this.logService = logService;
    this.workingCopyService = workingCopyService;
    this.filesConfigurationService = filesConfigurationService;
    this.labelService = labelService;
    this.pathService = pathService;
    this.extensionService = extensionService;
    this.progressService = progressService;
    //#region Events
    this._onDidChangeContent = this._register(new Emitter());
    this.onDidChangeContent = this._onDidChangeContent.event;
    this._onDidResolve = this._register(new Emitter());
    this.onDidResolve = this._onDidResolve.event;
    this._onDidChangeDirty = this._register(new Emitter());
    this.onDidChangeDirty = this._onDidChangeDirty.event;
    this._onDidSaveError = this._register(new Emitter());
    this.onDidSaveError = this._onDidSaveError.event;
    this._onDidSave = this._register(new Emitter());
    this.onDidSave = this._onDidSave.event;
    this._onDidRevert = this._register(new Emitter());
    this.onDidRevert = this._onDidRevert.event;
    this._onDidChangeEncoding = this._register(new Emitter());
    this.onDidChangeEncoding = this._onDidChangeEncoding.event;
    this._onDidChangeOrphaned = this._register(new Emitter());
    this.onDidChangeOrphaned = this._onDidChangeOrphaned.event;
    this._onDidChangeReadonly = this._register(new Emitter());
    this.onDidChangeReadonly = this._onDidChangeReadonly.event;
    //#endregion
    this.typeId = NO_TYPE_ID;
    // IMPORTANT: never change this to not break existing assumptions (e.g. backups)
    this.capabilities = WorkingCopyCapabilities.None;
    // encoding as reported from disk
    this.versionId = 0;
    this.ignoreDirtyOnModelContentChange = false;
    this.ignoreSaveFromSaveParticipants = false;
    this.lastModelContentChangeFromUndoRedo = void 0;
    // !!! DO NOT MARK PRIVATE! USED IN TESTS !!!
    this.saveSequentializer = new TaskSequentializer();
    this.dirty = false;
    this.inConflictMode = false;
    this.inOrphanMode = false;
    this.inErrorMode = false;
    this.hasEncodingSetExplicitly = false;
    this.name = basename(this.labelService.getUriLabel(this.resource));
    this.resourceHasExtension = !!extUri.extname(this.resource);
    this._register(this.workingCopyService.registerWorkingCopy(this));
    this.registerListeners();
  }
  registerListeners() {
    this._register(this.fileService.onDidFilesChange((e) => this.onDidFilesChange(e)));
    this._register(this.filesConfigurationService.onDidChangeFilesAssociation(() => this.onDidChangeFilesAssociation()));
    this._register(this.filesConfigurationService.onDidChangeReadonly(() => this._onDidChangeReadonly.fire()));
  }
  async onDidFilesChange(e) {
    let fileEventImpactsModel = false;
    let newInOrphanModeGuess;
    if (this.inOrphanMode) {
      const modelFileAdded = e.contains(this.resource, FileChangeType.ADDED);
      if (modelFileAdded) {
        newInOrphanModeGuess = false;
        fileEventImpactsModel = true;
      }
    } else {
      const modelFileDeleted = e.contains(this.resource, FileChangeType.DELETED);
      if (modelFileDeleted) {
        newInOrphanModeGuess = true;
        fileEventImpactsModel = true;
      }
    }
    if (fileEventImpactsModel && this.inOrphanMode !== newInOrphanModeGuess) {
      let newInOrphanModeValidated = false;
      if (newInOrphanModeGuess) {
        await timeout(100, CancellationToken.None);
        if (this.isDisposed()) {
          newInOrphanModeValidated = true;
        } else {
          const exists = await this.fileService.exists(this.resource);
          newInOrphanModeValidated = !exists;
        }
      }
      if (this.inOrphanMode !== newInOrphanModeValidated && !this.isDisposed()) {
        this.setOrphaned(newInOrphanModeValidated);
      }
    }
  }
  setOrphaned(orphaned) {
    if (this.inOrphanMode !== orphaned) {
      this.inOrphanMode = orphaned;
      this._onDidChangeOrphaned.fire();
    }
  }
  onDidChangeFilesAssociation() {
    if (!this.isResolved()) {
      return;
    }
    const firstLineText = this.getFirstLineText(this.textEditorModel);
    const languageSelection = this.getOrCreateLanguage(this.resource, this.languageService, this.preferredLanguageId, firstLineText);
    this.textEditorModel.setLanguage(languageSelection);
  }
  setLanguageId(languageId, source) {
    super.setLanguageId(languageId, source);
    this.preferredLanguageId = languageId;
  }
  //#region Backup
  async backup(token) {
    let meta = void 0;
    if (this.lastResolvedFileStat) {
      meta = {
        mtime: this.lastResolvedFileStat.mtime,
        ctime: this.lastResolvedFileStat.ctime,
        size: this.lastResolvedFileStat.size,
        etag: this.lastResolvedFileStat.etag,
        orphaned: this.inOrphanMode
      };
    }
    const content = await this.textFileService.getEncodedReadable(this.resource, this.createSnapshot() ?? void 0, { encoding: UTF8 });
    return { meta, content };
  }
  //#endregion
  //#region Revert
  async revert(options) {
    if (!this.isResolved()) {
      return;
    }
    const wasDirty = this.dirty;
    const undo = this.doSetDirty(false);
    const softUndo = options?.soft;
    if (!softUndo) {
      try {
        await this.forceResolveFromFile();
      } catch (error) {
        if (error.fileOperationResult !== FileOperationResult.FILE_NOT_FOUND) {
          undo();
          throw error;
        }
      }
    }
    this._onDidRevert.fire();
    if (wasDirty) {
      this._onDidChangeDirty.fire();
    }
  }
  //#endregion
  //#region Resolve
  async resolve(options) {
    this.trace("resolve() - enter");
    mark("code/willResolveTextFileEditorModel");
    if (this.isDisposed()) {
      this.trace("resolve() - exit - without resolving because model is disposed");
      return;
    }
    if (!options?.contents && (this.dirty || this.saveSequentializer.isRunning())) {
      this.trace("resolve() - exit - without resolving because model is dirty or being saved");
      return;
    }
    await this.doResolve(options);
    mark("code/didResolveTextFileEditorModel");
  }
  async doResolve(options) {
    if (options?.contents) {
      return this.resolveFromBuffer(options.contents, options);
    }
    const isNewModel = !this.isResolved();
    if (isNewModel) {
      const resolvedFromBackup = await this.resolveFromBackup(options);
      if (resolvedFromBackup) {
        return;
      }
    }
    return this.resolveFromFile(options);
  }
  async resolveFromBuffer(buffer, options) {
    this.trace("resolveFromBuffer()");
    let mtime;
    let ctime;
    let size;
    let etag;
    try {
      const metadata = await this.fileService.stat(this.resource);
      mtime = metadata.mtime;
      ctime = metadata.ctime;
      size = metadata.size;
      etag = metadata.etag;
      this.setOrphaned(false);
    } catch (error) {
      mtime = Date.now();
      ctime = Date.now();
      size = 0;
      etag = ETAG_DISABLED;
      this.setOrphaned(error.fileOperationResult === FileOperationResult.FILE_NOT_FOUND);
    }
    const preferredEncoding = await this.textFileService.encoding.getPreferredWriteEncoding(this.resource, this.preferredEncoding);
    this.resolveFromContent({
      resource: this.resource,
      name: this.name,
      mtime,
      ctime,
      size,
      etag,
      value: buffer,
      encoding: preferredEncoding.encoding,
      readonly: false,
      locked: false
    }, true, options);
  }
  async resolveFromBackup(options) {
    const backup = await this.workingCopyBackupService.resolve(this);
    let encoding = UTF8;
    if (backup) {
      encoding = (await this.textFileService.encoding.getPreferredWriteEncoding(this.resource, this.preferredEncoding)).encoding;
    }
    const isNewModel = !this.isResolved();
    if (!isNewModel) {
      this.trace("resolveFromBackup() - exit - without resolving because previously new model got created meanwhile");
      return true;
    }
    if (backup) {
      await this.doResolveFromBackup(backup, encoding, options);
      return true;
    }
    return false;
  }
  async doResolveFromBackup(backup, encoding, options) {
    this.trace("doResolveFromBackup()");
    this.resolveFromContent({
      resource: this.resource,
      name: this.name,
      mtime: backup.meta ? backup.meta.mtime : Date.now(),
      ctime: backup.meta ? backup.meta.ctime : Date.now(),
      size: backup.meta ? backup.meta.size : 0,
      etag: backup.meta ? backup.meta.etag : ETAG_DISABLED,
      // etag disabled if unknown!
      value: await createTextBufferFactoryFromStream(await this.textFileService.getDecodedStream(this.resource, backup.value, { encoding: UTF8 })),
      encoding,
      readonly: false,
      locked: false
    }, true, options);
    if (backup.meta?.orphaned) {
      this.setOrphaned(true);
    }
  }
  async resolveFromFile(options) {
    this.trace("resolveFromFile()");
    const forceReadFromFile = options?.forceReadFromFile;
    const allowBinary = this.isResolved() || options?.allowBinary;
    let etag;
    if (forceReadFromFile) {
      etag = ETAG_DISABLED;
    } else if (this.lastResolvedFileStat) {
      etag = this.lastResolvedFileStat.etag;
    }
    const currentVersionId = this.versionId;
    try {
      const content = await this.textFileService.readStream(this.resource, {
        acceptTextOnly: !allowBinary,
        etag,
        encoding: this.preferredEncoding,
        limits: options?.limits
      });
      this.setOrphaned(false);
      if (currentVersionId !== this.versionId) {
        this.trace("resolveFromFile() - exit - without resolving because model content changed");
        return;
      }
      return this.resolveFromContent(content, false, options);
    } catch (error) {
      const result = error.fileOperationResult;
      this.setOrphaned(result === FileOperationResult.FILE_NOT_FOUND);
      if (this.isResolved() && result === FileOperationResult.FILE_NOT_MODIFIED_SINCE) {
        if (error instanceof NotModifiedSinceFileOperationError) {
          this.updateLastResolvedFileStat(error.stat);
        }
        return;
      }
      if (this.isResolved() && result === FileOperationResult.FILE_NOT_FOUND && !forceReadFromFile) {
        return;
      }
      throw error;
    }
  }
  resolveFromContent(content, dirty, options) {
    this.trace("resolveFromContent() - enter");
    if (this.isDisposed()) {
      this.trace("resolveFromContent() - exit - because model is disposed");
      return;
    }
    this.updateLastResolvedFileStat({
      resource: this.resource,
      name: content.name,
      mtime: content.mtime,
      ctime: content.ctime,
      size: content.size,
      etag: content.etag,
      readonly: content.readonly,
      locked: content.locked,
      isFile: true,
      isDirectory: false,
      isSymbolicLink: false,
      children: void 0
    });
    const oldEncoding = this.contentEncoding;
    this.contentEncoding = content.encoding;
    if (this.preferredEncoding) {
      this.updatePreferredEncoding(this.contentEncoding);
    } else if (oldEncoding !== this.contentEncoding) {
      this._onDidChangeEncoding.fire();
    }
    if (this.textEditorModel) {
      this.doUpdateTextModel(content.value);
    } else {
      this.doCreateTextModel(content.resource, content.value);
    }
    this.setDirty(!!dirty);
    this._onDidResolve.fire(options?.reason ?? TextFileResolveReason.OTHER);
  }
  doCreateTextModel(resource, value) {
    this.trace("doCreateTextModel()");
    const textModel = this.createTextEditorModel(value, resource, this.preferredLanguageId);
    this.installModelListeners(textModel);
    this.autoDetectLanguage();
  }
  doUpdateTextModel(value) {
    this.trace("doUpdateTextModel()");
    this.ignoreDirtyOnModelContentChange = true;
    try {
      this.updateTextEditorModel(value, this.preferredLanguageId);
    } finally {
      this.ignoreDirtyOnModelContentChange = false;
    }
  }
  installModelListeners(model) {
    this._register(model.onDidChangeContent((e) => this.onModelContentChanged(model, e.isUndoing || e.isRedoing)));
    this._register(model.onDidChangeLanguage(() => this.onMaybeShouldChangeEncoding()));
    super.installModelListeners(model);
  }
  onModelContentChanged(model, isUndoingOrRedoing) {
    this.trace(`onModelContentChanged() - enter`);
    this.versionId++;
    this.trace(`onModelContentChanged() - new versionId ${this.versionId}`);
    if (isUndoingOrRedoing) {
      this.lastModelContentChangeFromUndoRedo = Date.now();
    }
    if (!this.ignoreDirtyOnModelContentChange && !this.isReadonly()) {
      if (model.getAlternativeVersionId() === this.bufferSavedVersionId) {
        this.trace("onModelContentChanged() - model content changed back to last saved version");
        const wasDirty = this.dirty;
        this.setDirty(false);
        if (wasDirty) {
          this._onDidRevert.fire();
        }
      } else {
        this.trace("onModelContentChanged() - model content changed and marked as dirty");
        this.setDirty(true);
      }
    }
    this._onDidChangeContent.fire();
    this.autoDetectLanguage();
  }
  async autoDetectLanguage() {
    await this.extensionService?.whenInstalledExtensionsRegistered();
    const languageId = this.getLanguageId();
    if (this.resource.scheme === this.pathService.defaultUriScheme && // make sure to not detect language for non-user visible documents
    (!languageId || languageId === PLAINTEXT_LANGUAGE_ID) && // only run on files with plaintext language set or no language set at all
    !this.resourceHasExtension) {
      return super.autoDetectLanguage();
    }
  }
  async forceResolveFromFile() {
    if (this.isDisposed()) {
      return;
    }
    await this.textFileService.files.resolve(this.resource, {
      reload: { async: false },
      forceReadFromFile: true
    });
  }
  //#endregion
  //#region Dirty
  isDirty() {
    return this.dirty;
  }
  isModified() {
    return this.isDirty();
  }
  setDirty(dirty) {
    if (!this.isResolved()) {
      return;
    }
    const wasDirty = this.dirty;
    this.doSetDirty(dirty);
    if (dirty !== wasDirty) {
      this._onDidChangeDirty.fire();
    }
  }
  doSetDirty(dirty) {
    const wasDirty = this.dirty;
    const wasInConflictMode = this.inConflictMode;
    const wasInErrorMode = this.inErrorMode;
    const oldBufferSavedVersionId = this.bufferSavedVersionId;
    if (!dirty) {
      this.dirty = false;
      this.inConflictMode = false;
      this.inErrorMode = false;
      this.updateSavedVersionId();
    } else {
      this.dirty = true;
    }
    return () => {
      this.dirty = wasDirty;
      this.inConflictMode = wasInConflictMode;
      this.inErrorMode = wasInErrorMode;
      this.bufferSavedVersionId = oldBufferSavedVersionId;
    };
  }
  //#endregion
  //#region Save
  async save(options = /* @__PURE__ */ Object.create(null)) {
    if (!this.isResolved()) {
      return false;
    }
    if (this.isReadonly()) {
      this.trace("save() - ignoring request for readonly resource");
      return false;
    }
    if ((this.hasState(TextFileEditorModelState.CONFLICT) || this.hasState(TextFileEditorModelState.ERROR)) && (options.reason === SaveReason.AUTO || options.reason === SaveReason.FOCUS_CHANGE || options.reason === SaveReason.WINDOW_CHANGE)) {
      this.trace("save() - ignoring auto save request for model that is in conflict or error");
      return false;
    }
    this.trace("save() - enter");
    await this.doSave(options);
    this.trace("save() - exit");
    return this.hasState(TextFileEditorModelState.SAVED);
  }
  async doSave(options) {
    if (typeof options.reason !== "number") {
      options.reason = SaveReason.EXPLICIT;
    }
    const versionId = this.versionId;
    this.trace(`doSave(${versionId}) - enter with versionId ${versionId}`);
    if (this.ignoreSaveFromSaveParticipants) {
      this.trace(`doSave(${versionId}) - exit - refusing to save() recursively from save participant`);
      return;
    }
    if (this.saveSequentializer.isRunning(versionId)) {
      this.trace(`doSave(${versionId}) - exit - found a running save for versionId ${versionId}`);
      return this.saveSequentializer.running;
    }
    if (!options.force && !this.dirty) {
      this.trace(`doSave(${versionId}) - exit - because not dirty and/or versionId is different (this.isDirty: ${this.dirty}, this.versionId: ${this.versionId})`);
      return;
    }
    if (this.saveSequentializer.isRunning()) {
      this.trace(`doSave(${versionId}) - exit - because busy saving`);
      this.saveSequentializer.cancelRunning();
      return this.saveSequentializer.queue(() => this.doSave(options));
    }
    if (this.isResolved()) {
      this.textEditorModel.pushStackElement();
    }
    const saveCancellation = new CancellationTokenSource();
    return this.progressService.withProgress({
      title: localize("saveParticipants", "Saving '{0}'", this.name),
      location: ProgressLocation.Window,
      cancellable: true,
      delay: this.isDirty() ? 3e3 : 5e3
    }, (progress) => {
      return this.doSaveSequential(versionId, options, progress, saveCancellation);
    }, () => {
      saveCancellation.cancel();
    }).finally(() => {
      saveCancellation.dispose();
    });
  }
  doSaveSequential(versionId, options, progress, saveCancellation) {
    return this.saveSequentializer.run(versionId, (async () => {
      if (this.isResolved() && !options.skipSaveParticipants) {
        try {
          if (options.reason === SaveReason.AUTO && typeof this.lastModelContentChangeFromUndoRedo === "number") {
            const timeFromUndoRedoToSave = Date.now() - this.lastModelContentChangeFromUndoRedo;
            if (timeFromUndoRedoToSave < TextFileEditorModel.UNDO_REDO_SAVE_PARTICIPANTS_AUTO_SAVE_THROTTLE_THRESHOLD) {
              await timeout(TextFileEditorModel.UNDO_REDO_SAVE_PARTICIPANTS_AUTO_SAVE_THROTTLE_THRESHOLD - timeFromUndoRedoToSave);
            }
          }
          if (!saveCancellation.token.isCancellationRequested) {
            this.ignoreSaveFromSaveParticipants = true;
            try {
              await this.textFileService.files.runSaveParticipants(this, { reason: options.reason ?? SaveReason.EXPLICIT, savedFrom: options.from }, progress, saveCancellation.token);
            } catch (err) {
              if (isCancellationError(err) && !saveCancellation.token.isCancellationRequested) {
                saveCancellation.cancel();
              }
            } finally {
              this.ignoreSaveFromSaveParticipants = false;
            }
          }
        } catch (error) {
          this.logService.error(`[text file model] runSaveParticipants(${versionId}) - resulted in an error: ${error.toString()}`, this.resource.toString());
        }
      }
      if (saveCancellation.token.isCancellationRequested) {
        return;
      } else {
        saveCancellation.dispose();
      }
      if (this.isDisposed()) {
        return;
      }
      if (!this.isResolved()) {
        return;
      }
      versionId = this.versionId;
      this.inErrorMode = false;
      progress.report({ message: localize("saveTextFile", "Writing into file...") });
      this.trace(`doSave(${versionId}) - before write()`);
      const lastResolvedFileStat = assertIsDefined(this.lastResolvedFileStat);
      const resolvedTextFileEditorModel = this;
      return this.saveSequentializer.run(versionId, (async () => {
        try {
          const stat = await this.textFileService.write(lastResolvedFileStat.resource, resolvedTextFileEditorModel.createSnapshot(), {
            mtime: lastResolvedFileStat.mtime,
            encoding: this.getEncoding(),
            etag: options.ignoreModifiedSince || !this.filesConfigurationService.preventSaveConflicts(lastResolvedFileStat.resource, resolvedTextFileEditorModel.getLanguageId()) ? ETAG_DISABLED : lastResolvedFileStat.etag,
            unlock: options.writeUnlock,
            writeElevated: options.writeElevated
          });
          this.handleSaveSuccess(stat, versionId, options);
        } catch (error) {
          this.handleSaveError(error, versionId, options);
        }
      })());
    })(), () => saveCancellation.cancel());
  }
  handleSaveSuccess(stat, versionId, options) {
    this.updateLastResolvedFileStat(stat);
    if (versionId === this.versionId) {
      this.trace(`handleSaveSuccess(${versionId}) - setting dirty to false because versionId did not change`);
      this.setDirty(false);
    } else {
      this.trace(`handleSaveSuccess(${versionId}) - not setting dirty to false because versionId did change meanwhile`);
    }
    this.setOrphaned(false);
    this._onDidSave.fire({ reason: options.reason, stat, source: options.source });
  }
  handleSaveError(error, versionId, options) {
    (options.ignoreErrorHandler ? this.logService.trace : this.logService.error).apply(this.logService, [`[text file model] handleSaveError(${versionId}) - exit - resulted in a save error: ${error.toString()}`, this.resource.toString()]);
    if (options.ignoreErrorHandler) {
      throw error;
    }
    this.setDirty(true);
    this.inErrorMode = true;
    if (error.fileOperationResult === FileOperationResult.FILE_MODIFIED_SINCE) {
      this.inConflictMode = true;
    }
    this.textFileService.files.saveErrorHandler.onSaveError(error, this, options);
    this._onDidSaveError.fire();
  }
  updateSavedVersionId() {
    if (this.isResolved()) {
      this.bufferSavedVersionId = this.textEditorModel.getAlternativeVersionId();
    }
  }
  updateLastResolvedFileStat(newFileStat) {
    const oldReadonly = this.isReadonly();
    if (!this.lastResolvedFileStat) {
      this.lastResolvedFileStat = newFileStat;
    } else if (this.lastResolvedFileStat.mtime <= newFileStat.mtime) {
      this.lastResolvedFileStat = newFileStat;
    } else {
      this.lastResolvedFileStat = { ...this.lastResolvedFileStat, readonly: newFileStat.readonly, locked: newFileStat.locked };
    }
    if (this.isReadonly() !== oldReadonly) {
      this._onDidChangeReadonly.fire();
    }
  }
  //#endregion
  hasState(state) {
    switch (state) {
      case TextFileEditorModelState.CONFLICT:
        return this.inConflictMode;
      case TextFileEditorModelState.DIRTY:
        return this.dirty;
      case TextFileEditorModelState.ERROR:
        return this.inErrorMode;
      case TextFileEditorModelState.ORPHAN:
        return this.inOrphanMode;
      case TextFileEditorModelState.PENDING_SAVE:
        return this.saveSequentializer.isRunning();
      case TextFileEditorModelState.SAVED:
        return !this.dirty;
    }
  }
  async joinState(state) {
    return this.saveSequentializer.running;
  }
  getLanguageId() {
    if (this.textEditorModel) {
      return this.textEditorModel.getLanguageId();
    }
    return this.preferredLanguageId;
  }
  //#region Encoding
  async onMaybeShouldChangeEncoding() {
    if (this.hasEncodingSetExplicitly) {
      this.trace("onMaybeShouldChangeEncoding() - ignoring because encoding was set explicitly");
      return;
    }
    if (this.contentEncoding === UTF8_with_bom || this.contentEncoding === UTF16be || this.contentEncoding === UTF16le) {
      this.trace("onMaybeShouldChangeEncoding() - ignoring because content encoding has a BOM");
      return;
    }
    const { encoding } = await this.textFileService.encoding.getPreferredReadEncoding(this.resource);
    if (typeof encoding !== "string" || !this.isNewEncoding(encoding)) {
      this.trace(`onMaybeShouldChangeEncoding() - ignoring because preferred encoding ${encoding} is not new`);
      return;
    }
    if (this.isDirty()) {
      this.trace("onMaybeShouldChangeEncoding() - ignoring because model is dirty");
      return;
    }
    this.logService.info(`Adjusting encoding based on configured language override to '${encoding}' for ${this.resource.toString(true)}.`);
    return this.forceResolveFromFile();
  }
  setEncoding(encoding, mode) {
    this.hasEncodingSetExplicitly = true;
    return this.setEncodingInternal(encoding, mode);
  }
  async setEncodingInternal(encoding, mode) {
    if (mode === EncodingMode.Encode) {
      this.updatePreferredEncoding(encoding);
      if (!this.isDirty()) {
        this.versionId++;
        this.setDirty(true);
      }
      if (!this.inConflictMode) {
        await this.save({ source: TextFileEditorModel.TEXTFILE_SAVE_ENCODING_SOURCE });
      }
    } else {
      if (!this.isNewEncoding(encoding)) {
        return;
      }
      if (this.isDirty() && !this.inConflictMode) {
        await this.save();
      }
      this.updatePreferredEncoding(encoding);
      await this.forceResolveFromFile();
    }
  }
  updatePreferredEncoding(encoding) {
    if (!this.isNewEncoding(encoding)) {
      return;
    }
    this.preferredEncoding = encoding;
    this._onDidChangeEncoding.fire();
  }
  isNewEncoding(encoding) {
    if (this.preferredEncoding === encoding) {
      return false;
    }
    if (!this.preferredEncoding && this.contentEncoding === encoding) {
      return false;
    }
    return true;
  }
  getEncoding() {
    return this.preferredEncoding || this.contentEncoding;
  }
  //#endregion
  trace(msg) {
    this.logService.trace(`[text file model] ${msg}`, this.resource.toString());
  }
  isResolved() {
    return !!this.textEditorModel;
  }
  isReadonly() {
    return this.filesConfigurationService.isReadonly(this.resource, this.lastResolvedFileStat);
  }
  dispose() {
    this.trace("dispose()");
    this.inConflictMode = false;
    this.inOrphanMode = false;
    this.inErrorMode = false;
    super.dispose();
  }
};
TextFileEditorModel.TEXTFILE_SAVE_ENCODING_SOURCE = SaveSourceRegistry.registerSource("textFileEncoding.source", localize("textFileCreate.source", "File Encoding Changed"));
TextFileEditorModel.UNDO_REDO_SAVE_PARTICIPANTS_AUTO_SAVE_THROTTLE_THRESHOLD = 500;
TextFileEditorModel = __decorateClass([
  __decorateParam(3, ILanguageService),
  __decorateParam(4, IModelService),
  __decorateParam(5, IFileService),
  __decorateParam(6, ITextFileService),
  __decorateParam(7, IWorkingCopyBackupService),
  __decorateParam(8, ILogService),
  __decorateParam(9, IWorkingCopyService),
  __decorateParam(10, IFilesConfigurationService),
  __decorateParam(11, ILabelService),
  __decorateParam(12, ILanguageDetectionService),
  __decorateParam(13, IAccessibilityService),
  __decorateParam(14, IPathService),
  __decorateParam(15, IExtensionService),
  __decorateParam(16, IProgressService)
], TextFileEditorModel);
export {
  TextFileEditorModel
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdGV4dGZpbGUvY29tbW9uL3RleHRGaWxlRWRpdG9yTW9kZWwudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IG1hcmsgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wZXJmb3JtYW5jZS5qcyc7XG5pbXBvcnQgeyBhc3NlcnRJc0RlZmluZWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBFbmNvZGluZ01vZGUsIElUZXh0RmlsZVNlcnZpY2UsIFRleHRGaWxlRWRpdG9yTW9kZWxTdGF0ZSwgSVRleHRGaWxlRWRpdG9yTW9kZWwsIElUZXh0RmlsZVN0cmVhbUNvbnRlbnQsIElUZXh0RmlsZVJlc29sdmVPcHRpb25zLCBJUmVzb2x2ZWRUZXh0RmlsZUVkaXRvck1vZGVsLCBUZXh0RmlsZVJlc29sdmVSZWFzb24sIElUZXh0RmlsZUVkaXRvck1vZGVsU2F2ZUV2ZW50LCBJVGV4dEZpbGVTYXZlQXNPcHRpb25zIH0gZnJvbSAnLi90ZXh0ZmlsZXMuanMnO1xuaW1wb3J0IHsgSVJldmVydE9wdGlvbnMsIFNhdmVSZWFzb24sIFNhdmVTb3VyY2VSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgQmFzZVRleHRFZGl0b3JNb2RlbCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvdGV4dEVkaXRvck1vZGVsLmpzJztcbmltcG9ydCB7IElXb3JraW5nQ29weUJhY2t1cFNlcnZpY2UsIElSZXNvbHZlZFdvcmtpbmdDb3B5QmFja3VwIH0gZnJvbSAnLi4vLi4vd29ya2luZ0NvcHkvY29tbW9uL3dvcmtpbmdDb3B5QmFja3VwLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSwgRmlsZU9wZXJhdGlvbkVycm9yLCBGaWxlT3BlcmF0aW9uUmVzdWx0LCBGaWxlQ2hhbmdlc0V2ZW50LCBGaWxlQ2hhbmdlVHlwZSwgSUZpbGVTdGF0V2l0aE1ldGFkYXRhLCBFVEFHX0RJU0FCTEVELCBOb3RNb2RpZmllZFNpbmNlRmlsZU9wZXJhdGlvbkVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBJTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9tb2RlbC5qcyc7XG5pbXBvcnQgeyB0aW1lb3V0LCBUYXNrU2VxdWVudGlhbGl6ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBJVGV4dEJ1ZmZlckZhY3RvcnksIElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgYmFzZW5hbWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCB7IElXb3JraW5nQ29weVNlcnZpY2UgfSBmcm9tICcuLi8uLi93b3JraW5nQ29weS9jb21tb24vd29ya2luZ0NvcHlTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElXb3JraW5nQ29weUJhY2t1cCwgV29ya2luZ0NvcHlDYXBhYmlsaXRpZXMsIE5PX1RZUEVfSUQsIElXb3JraW5nQ29weUJhY2t1cE1ldGEgfSBmcm9tICcuLi8uLi93b3JraW5nQ29weS9jb21tb24vd29ya2luZ0NvcHkuanMnO1xuaW1wb3J0IHsgSUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9maWxlc0NvbmZpZ3VyYXRpb24vY29tbW9uL2ZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgVVRGMTZiZSwgVVRGMTZsZSwgVVRGOCwgVVRGOF93aXRoX2JvbSB9IGZyb20gJy4vZW5jb2RpbmcuanMnO1xuaW1wb3J0IHsgY3JlYXRlVGV4dEJ1ZmZlckZhY3RvcnlGcm9tU3RyZWFtIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC90ZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRGV0ZWN0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL2xhbmd1YWdlRGV0ZWN0aW9uL2NvbW1vbi9sYW5ndWFnZURldGVjdGlvbldvcmtlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVBhdGhTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGF0aC9jb21tb24vcGF0aFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgZXh0VXJpIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IElBY2Nlc3NpYmlsaXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvY29tbW9uL2FjY2Vzc2liaWxpdHkuanMnO1xuaW1wb3J0IHsgUExBSU5URVhUX0xBTkdVQUdFX0lEIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbW9kZXNSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSU1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuaW1wb3J0IHsgSVByb2dyZXNzLCBJUHJvZ3Jlc3NTZXJ2aWNlLCBJUHJvZ3Jlc3NTdGVwLCBQcm9ncmVzc0xvY2F0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZ3Jlc3MvY29tbW9uL3Byb2dyZXNzLmpzJztcbmltcG9ydCB7IGlzQ2FuY2VsbGF0aW9uRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuXG5pbnRlcmZhY2UgSUJhY2t1cE1ldGFEYXRhIGV4dGVuZHMgSVdvcmtpbmdDb3B5QmFja3VwTWV0YSB7XG5cdG10aW1lOiBudW1iZXI7XG5cdGN0aW1lOiBudW1iZXI7XG5cdHNpemU6IG51bWJlcjtcblx0ZXRhZzogc3RyaW5nO1xuXHRvcnBoYW5lZDogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBUaGUgdGV4dCBmaWxlIGVkaXRvciBtb2RlbCBsaXN0ZW5zIHRvIGNoYW5nZXMgdG8gaXRzIHVuZGVybHlpbmcgY29kZSBlZGl0b3IgbW9kZWwgYW5kIHNhdmVzIHRoZXNlIGNoYW5nZXMgdGhyb3VnaCB0aGUgZmlsZSBzZXJ2aWNlIGJhY2sgdG8gdGhlIGRpc2suXG4gKi9cbmV4cG9ydCBjbGFzcyBUZXh0RmlsZUVkaXRvck1vZGVsIGV4dGVuZHMgQmFzZVRleHRFZGl0b3JNb2RlbCBpbXBsZW1lbnRzIElUZXh0RmlsZUVkaXRvck1vZGVsIHtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBURVhURklMRV9TQVZFX0VOQ09ESU5HX1NPVVJDRSA9IFNhdmVTb3VyY2VSZWdpc3RyeS5yZWdpc3RlclNvdXJjZSgndGV4dEZpbGVFbmNvZGluZy5zb3VyY2UnLCBsb2NhbGl6ZSgndGV4dEZpbGVDcmVhdGUuc291cmNlJywgXCJGaWxlIEVuY29kaW5nIENoYW5nZWRcIikpO1xuXG5cdC8vI3JlZ2lvbiBFdmVudHNcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUNvbnRlbnQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VDb250ZW50ID0gdGhpcy5fb25EaWRDaGFuZ2VDb250ZW50LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkUmVzb2x2ZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPFRleHRGaWxlUmVzb2x2ZVJlYXNvbj4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkUmVzb2x2ZSA9IHRoaXMuX29uRGlkUmVzb2x2ZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZURpcnR5ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlRGlydHkgPSB0aGlzLl9vbkRpZENoYW5nZURpcnR5LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkU2F2ZUVycm9yID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkU2F2ZUVycm9yID0gdGhpcy5fb25EaWRTYXZlRXJyb3IuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRTYXZlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVRleHRGaWxlRWRpdG9yTW9kZWxTYXZlRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZFNhdmUgPSB0aGlzLl9vbkRpZFNhdmUuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSZXZlcnQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRSZXZlcnQgPSB0aGlzLl9vbkRpZFJldmVydC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUVuY29kaW5nID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlRW5jb2RpbmcgPSB0aGlzLl9vbkRpZENoYW5nZUVuY29kaW5nLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlT3JwaGFuZWQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VPcnBoYW5lZCA9IHRoaXMuX29uRGlkQ2hhbmdlT3JwaGFuZWQuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VSZWFkb25seSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVJlYWRvbmx5ID0gdGhpcy5fb25EaWRDaGFuZ2VSZWFkb25seS5ldmVudDtcblxuXHQvLyNlbmRyZWdpb25cblxuXHRyZWFkb25seSB0eXBlSWQgPSBOT19UWVBFX0lEOyAvLyBJTVBPUlRBTlQ6IG5ldmVyIGNoYW5nZSB0aGlzIHRvIG5vdCBicmVhayBleGlzdGluZyBhc3N1bXB0aW9ucyAoZS5nLiBiYWNrdXBzKVxuXG5cdHJlYWRvbmx5IGNhcGFiaWxpdGllcyA9IFdvcmtpbmdDb3B5Q2FwYWJpbGl0aWVzLk5vbmU7XG5cblx0cmVhZG9ubHkgbmFtZTogc3RyaW5nO1xuXHRwcml2YXRlIHJlc291cmNlSGFzRXh0ZW5zaW9uOiBib29sZWFuO1xuXG5cdHByaXZhdGUgY29udGVudEVuY29kaW5nOiBzdHJpbmcgfCB1bmRlZmluZWQ7IC8vIGVuY29kaW5nIGFzIHJlcG9ydGVkIGZyb20gZGlza1xuXG5cdHByaXZhdGUgdmVyc2lvbklkID0gMDtcblx0cHJpdmF0ZSBidWZmZXJTYXZlZFZlcnNpb25JZDogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgaWdub3JlRGlydHlPbk1vZGVsQ29udGVudENoYW5nZSA9IGZhbHNlO1xuXHRwcml2YXRlIGlnbm9yZVNhdmVGcm9tU2F2ZVBhcnRpY2lwYW50cyA9IGZhbHNlO1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFVORE9fUkVET19TQVZFX1BBUlRJQ0lQQU5UU19BVVRPX1NBVkVfVEhST1RUTEVfVEhSRVNIT0xEID0gNTAwO1xuXHRwcml2YXRlIGxhc3RNb2RlbENvbnRlbnRDaGFuZ2VGcm9tVW5kb1JlZG86IG51bWJlciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRsYXN0UmVzb2x2ZWRGaWxlU3RhdDogSUZpbGVTdGF0V2l0aE1ldGFkYXRhIHwgdW5kZWZpbmVkOyAvLyAhISEgRE8gTk9UIE1BUksgUFJJVkFURSEgVVNFRCBJTiBURVNUUyAhISFcblxuXHRwcml2YXRlIHJlYWRvbmx5IHNhdmVTZXF1ZW50aWFsaXplciA9IG5ldyBUYXNrU2VxdWVudGlhbGl6ZXIoKTtcblxuXHRwcml2YXRlIGRpcnR5ID0gZmFsc2U7XG5cdHByaXZhdGUgaW5Db25mbGljdE1vZGUgPSBmYWxzZTtcblx0cHJpdmF0ZSBpbk9ycGhhbk1vZGUgPSBmYWxzZTtcblx0cHJpdmF0ZSBpbkVycm9yTW9kZSA9IGZhbHNlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IHJlc291cmNlOiBVUkksXG5cdFx0cHJpdmF0ZSBwcmVmZXJyZWRFbmNvZGluZzogc3RyaW5nIHwgdW5kZWZpbmVkLFx0XHQvLyBlbmNvZGluZyBhcyBjaG9zZW4gYnkgdGhlIHVzZXJcblx0XHRwcml2YXRlIHByZWZlcnJlZExhbmd1YWdlSWQ6IHN0cmluZyB8IHVuZGVmaW5lZCxcdC8vIGxhbmd1YWdlIGlkIGFzIGNob3NlbiBieSB0aGUgdXNlclxuXHRcdEBJTGFuZ3VhZ2VTZXJ2aWNlIGxhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSxcblx0XHRASU1vZGVsU2VydmljZSBtb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElUZXh0RmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZXh0RmlsZVNlcnZpY2U6IElUZXh0RmlsZVNlcnZpY2UsXG5cdFx0QElXb3JraW5nQ29weUJhY2t1cFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3JraW5nQ29weUJhY2t1cFNlcnZpY2U6IElXb3JraW5nQ29weUJhY2t1cFNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElXb3JraW5nQ29weVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3JraW5nQ29weVNlcnZpY2U6IElXb3JraW5nQ29weVNlcnZpY2UsXG5cdFx0QElGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZXNDb25maWd1cmF0aW9uU2VydmljZTogSUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElMYWJlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZURldGVjdGlvblNlcnZpY2UgbGFuZ3VhZ2VEZXRlY3Rpb25TZXJ2aWNlOiBJTGFuZ3VhZ2VEZXRlY3Rpb25TZXJ2aWNlLFxuXHRcdEBJQWNjZXNzaWJpbGl0eVNlcnZpY2UgYWNjZXNzaWJpbGl0eVNlcnZpY2U6IElBY2Nlc3NpYmlsaXR5U2VydmljZSxcblx0XHRASVBhdGhTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcGF0aFNlcnZpY2U6IElQYXRoU2VydmljZSxcblx0XHRASUV4dGVuc2lvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRASVByb2dyZXNzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByb2dyZXNzU2VydmljZTogSVByb2dyZXNzU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihtb2RlbFNlcnZpY2UsIGxhbmd1YWdlU2VydmljZSwgbGFuZ3VhZ2VEZXRlY3Rpb25TZXJ2aWNlLCBhY2Nlc3NpYmlsaXR5U2VydmljZSk7XG5cblx0XHR0aGlzLm5hbWUgPSBiYXNlbmFtZSh0aGlzLmxhYmVsU2VydmljZS5nZXRVcmlMYWJlbCh0aGlzLnJlc291cmNlKSk7XG5cdFx0dGhpcy5yZXNvdXJjZUhhc0V4dGVuc2lvbiA9ICEhZXh0VXJpLmV4dG5hbWUodGhpcy5yZXNvdXJjZSk7XG5cblx0XHQvLyBNYWtlIGtub3duIHRvIHdvcmtpbmcgY29weSBzZXJ2aWNlXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy53b3JraW5nQ29weVNlcnZpY2UucmVnaXN0ZXJXb3JraW5nQ29weSh0aGlzKSk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyTGlzdGVuZXJzKCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZmlsZVNlcnZpY2Uub25EaWRGaWxlc0NoYW5nZShlID0+IHRoaXMub25EaWRGaWxlc0NoYW5nZShlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZmlsZXNDb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUZpbGVzQXNzb2NpYXRpb24oKCkgPT4gdGhpcy5vbkRpZENoYW5nZUZpbGVzQXNzb2NpYXRpb24oKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZmlsZXNDb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZVJlYWRvbmx5KCgpID0+IHRoaXMuX29uRGlkQ2hhbmdlUmVhZG9ubHkuZmlyZSgpKSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIG9uRGlkRmlsZXNDaGFuZ2UoZTogRmlsZUNoYW5nZXNFdmVudCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGxldCBmaWxlRXZlbnRJbXBhY3RzTW9kZWwgPSBmYWxzZTtcblx0XHRsZXQgbmV3SW5PcnBoYW5Nb2RlR3Vlc3M6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG5cblx0XHQvLyBJZiB3ZSBhcmUgY3VycmVudGx5IG9ycGhhbmVkLCB3ZSBjaGVjayBpZiB0aGUgbW9kZWwgZmlsZSB3YXMgYWRkZWQgYmFja1xuXHRcdGlmICh0aGlzLmluT3JwaGFuTW9kZSkge1xuXHRcdFx0Y29uc3QgbW9kZWxGaWxlQWRkZWQgPSBlLmNvbnRhaW5zKHRoaXMucmVzb3VyY2UsIEZpbGVDaGFuZ2VUeXBlLkFEREVEKTtcblx0XHRcdGlmIChtb2RlbEZpbGVBZGRlZCkge1xuXHRcdFx0XHRuZXdJbk9ycGhhbk1vZGVHdWVzcyA9IGZhbHNlO1xuXHRcdFx0XHRmaWxlRXZlbnRJbXBhY3RzTW9kZWwgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIE90aGVyd2lzZSB3ZSBjaGVjayBpZiB0aGUgbW9kZWwgZmlsZSB3YXMgZGVsZXRlZFxuXHRcdGVsc2Uge1xuXHRcdFx0Y29uc3QgbW9kZWxGaWxlRGVsZXRlZCA9IGUuY29udGFpbnModGhpcy5yZXNvdXJjZSwgRmlsZUNoYW5nZVR5cGUuREVMRVRFRCk7XG5cdFx0XHRpZiAobW9kZWxGaWxlRGVsZXRlZCkge1xuXHRcdFx0XHRuZXdJbk9ycGhhbk1vZGVHdWVzcyA9IHRydWU7XG5cdFx0XHRcdGZpbGVFdmVudEltcGFjdHNNb2RlbCA9IHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGZpbGVFdmVudEltcGFjdHNNb2RlbCAmJiB0aGlzLmluT3JwaGFuTW9kZSAhPT0gbmV3SW5PcnBoYW5Nb2RlR3Vlc3MpIHtcblx0XHRcdGxldCBuZXdJbk9ycGhhbk1vZGVWYWxpZGF0ZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblx0XHRcdGlmIChuZXdJbk9ycGhhbk1vZGVHdWVzcykge1xuXHRcdFx0XHQvLyBXZSBoYXZlIHJlY2VpdmVkIHJlcG9ydHMgb2YgdXNlcnMgc2VlaW5nIGRlbGV0ZSBldmVudHMgZXZlbiB0aG91Z2ggdGhlIGZpbGUgc3RpbGxcblx0XHRcdFx0Ly8gZXhpc3RzIChuZXR3b3JrIHNoYXJlcyBpc3N1ZTogaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEzNjY1KS5cblx0XHRcdFx0Ly8gU2luY2Ugd2UgZG8gbm90IHdhbnQgdG8gbWFyayB0aGUgbW9kZWwgYXMgb3JwaGFuZWQsIHdlIGhhdmUgdG8gY2hlY2sgaWYgdGhlXG5cdFx0XHRcdC8vIGZpbGUgaXMgcmVhbGx5IGdvbmUgYW5kIG5vdCBqdXN0IGEgZmF1bHR5IGZpbGUgZXZlbnQuXG5cdFx0XHRcdGF3YWl0IHRpbWVvdXQoMTAwLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblxuXHRcdFx0XHRpZiAodGhpcy5pc0Rpc3Bvc2VkKCkpIHtcblx0XHRcdFx0XHRuZXdJbk9ycGhhbk1vZGVWYWxpZGF0ZWQgPSB0cnVlO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IGV4aXN0cyA9IGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UuZXhpc3RzKHRoaXMucmVzb3VyY2UpO1xuXHRcdFx0XHRcdG5ld0luT3JwaGFuTW9kZVZhbGlkYXRlZCA9ICFleGlzdHM7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuaW5PcnBoYW5Nb2RlICE9PSBuZXdJbk9ycGhhbk1vZGVWYWxpZGF0ZWQgJiYgIXRoaXMuaXNEaXNwb3NlZCgpKSB7XG5cdFx0XHRcdHRoaXMuc2V0T3JwaGFuZWQobmV3SW5PcnBoYW5Nb2RlVmFsaWRhdGVkKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHNldE9ycGhhbmVkKG9ycGhhbmVkOiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuaW5PcnBoYW5Nb2RlICE9PSBvcnBoYW5lZCkge1xuXHRcdFx0dGhpcy5pbk9ycGhhbk1vZGUgPSBvcnBoYW5lZDtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlT3JwaGFuZWQuZmlyZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25EaWRDaGFuZ2VGaWxlc0Fzc29jaWF0aW9uKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5pc1Jlc29sdmVkKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBmaXJzdExpbmVUZXh0ID0gdGhpcy5nZXRGaXJzdExpbmVUZXh0KHRoaXMudGV4dEVkaXRvck1vZGVsKTtcblx0XHRjb25zdCBsYW5ndWFnZVNlbGVjdGlvbiA9IHRoaXMuZ2V0T3JDcmVhdGVMYW5ndWFnZSh0aGlzLnJlc291cmNlLCB0aGlzLmxhbmd1YWdlU2VydmljZSwgdGhpcy5wcmVmZXJyZWRMYW5ndWFnZUlkLCBmaXJzdExpbmVUZXh0KTtcblxuXHRcdHRoaXMudGV4dEVkaXRvck1vZGVsLnNldExhbmd1YWdlKGxhbmd1YWdlU2VsZWN0aW9uKTtcblx0fVxuXG5cdG92ZXJyaWRlIHNldExhbmd1YWdlSWQobGFuZ3VhZ2VJZDogc3RyaW5nLCBzb3VyY2U/OiBzdHJpbmcpOiB2b2lkIHtcblx0XHRzdXBlci5zZXRMYW5ndWFnZUlkKGxhbmd1YWdlSWQsIHNvdXJjZSk7XG5cblx0XHR0aGlzLnByZWZlcnJlZExhbmd1YWdlSWQgPSBsYW5ndWFnZUlkO1xuXHR9XG5cblx0Ly8jcmVnaW9uIEJhY2t1cFxuXG5cdGFzeW5jIGJhY2t1cCh0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElXb3JraW5nQ29weUJhY2t1cD4ge1xuXG5cdFx0Ly8gRmlsbCBpbiBtZXRhZGF0YSBpZiB3ZSBhcmUgcmVzb2x2ZWRcblx0XHRsZXQgbWV0YTogSUJhY2t1cE1ldGFEYXRhIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGlmICh0aGlzLmxhc3RSZXNvbHZlZEZpbGVTdGF0KSB7XG5cdFx0XHRtZXRhID0ge1xuXHRcdFx0XHRtdGltZTogdGhpcy5sYXN0UmVzb2x2ZWRGaWxlU3RhdC5tdGltZSxcblx0XHRcdFx0Y3RpbWU6IHRoaXMubGFzdFJlc29sdmVkRmlsZVN0YXQuY3RpbWUsXG5cdFx0XHRcdHNpemU6IHRoaXMubGFzdFJlc29sdmVkRmlsZVN0YXQuc2l6ZSxcblx0XHRcdFx0ZXRhZzogdGhpcy5sYXN0UmVzb2x2ZWRGaWxlU3RhdC5ldGFnLFxuXHRcdFx0XHRvcnBoYW5lZDogdGhpcy5pbk9ycGhhbk1vZGVcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gRmlsbCBpbiBjb250ZW50IHRoZSBzYW1lIHdheSB3ZSB3b3VsZCBkbyB3aGVuXG5cdFx0Ly8gc2F2aW5nIHRoZSBmaWxlIHZpYSB0aGUgdGV4dCBmaWxlIHNlcnZpY2Vcblx0XHQvLyBlbmNvZGluZyBzdXBwb3J0IChoYXJkY29kZSBVVEYtOClcblx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy50ZXh0RmlsZVNlcnZpY2UuZ2V0RW5jb2RlZFJlYWRhYmxlKHRoaXMucmVzb3VyY2UsIHRoaXMuY3JlYXRlU25hcHNob3QoKSA/PyB1bmRlZmluZWQsIHsgZW5jb2Rpbmc6IFVURjggfSk7XG5cblx0XHRyZXR1cm4geyBtZXRhLCBjb250ZW50IH07XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gUmV2ZXJ0XG5cblx0YXN5bmMgcmV2ZXJ0KG9wdGlvbnM/OiBJUmV2ZXJ0T3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5pc1Jlc29sdmVkKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBVbnNldCBmbGFnc1xuXHRcdGNvbnN0IHdhc0RpcnR5ID0gdGhpcy5kaXJ0eTtcblx0XHRjb25zdCB1bmRvID0gdGhpcy5kb1NldERpcnR5KGZhbHNlKTtcblxuXHRcdC8vIEZvcmNlIHJlYWQgZnJvbSBkaXNrIHVubGVzcyByZXZlcnRpbmcgc29mdFxuXHRcdGNvbnN0IHNvZnRVbmRvID0gb3B0aW9ucz8uc29mdDtcblx0XHRpZiAoIXNvZnRVbmRvKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmZvcmNlUmVzb2x2ZUZyb21GaWxlKCk7XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXG5cdFx0XHRcdC8vIEZpbGVOb3RGb3VuZCBtZWFucyB0aGUgZmlsZSBnb3QgZGVsZXRlZCBtZWFud2hpbGUsIHNvIGlnbm9yZSBpdFxuXHRcdFx0XHRpZiAoKDxGaWxlT3BlcmF0aW9uRXJyb3I+ZXJyb3IpLmZpbGVPcGVyYXRpb25SZXN1bHQgIT09IEZpbGVPcGVyYXRpb25SZXN1bHQuRklMRV9OT1RfRk9VTkQpIHtcblxuXHRcdFx0XHRcdC8vIFNldCBmbGFncyBiYWNrIHRvIHByZXZpb3VzIHZhbHVlcywgd2UgYXJlIHN0aWxsIGRpcnR5IGlmIHJldmVydCBmYWlsZWRcblx0XHRcdFx0XHR1bmRvKCk7XG5cblx0XHRcdFx0XHR0aHJvdyBlcnJvcjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEVtaXQgZmlsZSBjaGFuZ2UgZXZlbnRcblx0XHR0aGlzLl9vbkRpZFJldmVydC5maXJlKCk7XG5cblx0XHQvLyBFbWl0IGRpcnR5IGNoYW5nZSBldmVudFxuXHRcdGlmICh3YXNEaXJ0eSkge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VEaXJ0eS5maXJlKCk7XG5cdFx0fVxuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIFJlc29sdmVcblxuXHRvdmVycmlkZSBhc3luYyByZXNvbHZlKG9wdGlvbnM/OiBJVGV4dEZpbGVSZXNvbHZlT3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMudHJhY2UoJ3Jlc29sdmUoKSAtIGVudGVyJyk7XG5cdFx0bWFyaygnY29kZS93aWxsUmVzb2x2ZVRleHRGaWxlRWRpdG9yTW9kZWwnKTtcblxuXHRcdC8vIFJldHVybiBlYXJseSBpZiB3ZSBhcmUgZGlzcG9zZWRcblx0XHRpZiAodGhpcy5pc0Rpc3Bvc2VkKCkpIHtcblx0XHRcdHRoaXMudHJhY2UoJ3Jlc29sdmUoKSAtIGV4aXQgLSB3aXRob3V0IHJlc29sdmluZyBiZWNhdXNlIG1vZGVsIGlzIGRpc3Bvc2VkJyk7XG5cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBVbmxlc3MgdGhlcmUgYXJlIGV4cGxpY2l0IGNvbnRlbnRzIHByb3ZpZGVkLCBpdCBpcyBpbXBvcnRhbnQgdGhhdCB3ZSBkbyBub3Rcblx0XHQvLyByZXNvbHZlIGEgbW9kZWwgdGhhdCBpcyBkaXJ0eSBvciBpcyBpbiB0aGUgcHJvY2VzcyBvZiBzYXZpbmcgdG8gcHJldmVudCBkYXRhXG5cdFx0Ly8gbG9zcy5cblx0XHRpZiAoIW9wdGlvbnM/LmNvbnRlbnRzICYmICh0aGlzLmRpcnR5IHx8IHRoaXMuc2F2ZVNlcXVlbnRpYWxpemVyLmlzUnVubmluZygpKSkge1xuXHRcdFx0dGhpcy50cmFjZSgncmVzb2x2ZSgpIC0gZXhpdCAtIHdpdGhvdXQgcmVzb2x2aW5nIGJlY2F1c2UgbW9kZWwgaXMgZGlydHkgb3IgYmVpbmcgc2F2ZWQnKTtcblxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFJlc29sdmUgZWl0aGVyIGZyb20gYmFja3VwIG9yIGZyb20gZmlsZVxuXHRcdGF3YWl0IHRoaXMuZG9SZXNvbHZlKG9wdGlvbnMpO1xuXG5cdFx0bWFyaygnY29kZS9kaWRSZXNvbHZlVGV4dEZpbGVFZGl0b3JNb2RlbCcpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb1Jlc29sdmUob3B0aW9ucz86IElUZXh0RmlsZVJlc29sdmVPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHQvLyBGaXJzdCBjaGVjayBpZiB3ZSBoYXZlIGNvbnRlbnRzIHRvIHVzZSBmb3IgdGhlIG1vZGVsXG5cdFx0aWYgKG9wdGlvbnM/LmNvbnRlbnRzKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5yZXNvbHZlRnJvbUJ1ZmZlcihvcHRpb25zLmNvbnRlbnRzLCBvcHRpb25zKTtcblx0XHR9XG5cblx0XHQvLyBTZWNvbmQsIGNoZWNrIGlmIHdlIGhhdmUgYSBiYWNrdXAgdG8gcmVzb2x2ZSBmcm9tIChvbmx5IGZvciBuZXcgbW9kZWxzKVxuXHRcdGNvbnN0IGlzTmV3TW9kZWwgPSAhdGhpcy5pc1Jlc29sdmVkKCk7XG5cdFx0aWYgKGlzTmV3TW9kZWwpIHtcblx0XHRcdGNvbnN0IHJlc29sdmVkRnJvbUJhY2t1cCA9IGF3YWl0IHRoaXMucmVzb2x2ZUZyb21CYWNrdXAob3B0aW9ucyk7XG5cdFx0XHRpZiAocmVzb2x2ZWRGcm9tQmFja3VwKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBGaW5hbGx5LCByZXNvbHZlIGZyb20gZmlsZSByZXNvdXJjZVxuXHRcdHJldHVybiB0aGlzLnJlc29sdmVGcm9tRmlsZShvcHRpb25zKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVzb2x2ZUZyb21CdWZmZXIoYnVmZmVyOiBJVGV4dEJ1ZmZlckZhY3RvcnksIG9wdGlvbnM/OiBJVGV4dEZpbGVSZXNvbHZlT3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMudHJhY2UoJ3Jlc29sdmVGcm9tQnVmZmVyKCknKTtcblxuXHRcdC8vIFRyeSB0byByZXNvbHZlIG1ldGRhdGEgZnJvbSBkaXNrXG5cdFx0bGV0IG10aW1lOiBudW1iZXI7XG5cdFx0bGV0IGN0aW1lOiBudW1iZXI7XG5cdFx0bGV0IHNpemU6IG51bWJlcjtcblx0XHRsZXQgZXRhZzogc3RyaW5nO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBtZXRhZGF0YSA9IGF3YWl0IHRoaXMuZmlsZVNlcnZpY2Uuc3RhdCh0aGlzLnJlc291cmNlKTtcblx0XHRcdG10aW1lID0gbWV0YWRhdGEubXRpbWU7XG5cdFx0XHRjdGltZSA9IG1ldGFkYXRhLmN0aW1lO1xuXHRcdFx0c2l6ZSA9IG1ldGFkYXRhLnNpemU7XG5cdFx0XHRldGFnID0gbWV0YWRhdGEuZXRhZztcblxuXHRcdFx0Ly8gQ2xlYXIgb3JwaGFuZWQgc3RhdGUgd2hlbiByZXNvbHZpbmcgd2FzIHN1Y2Nlc3NmdWxcblx0XHRcdHRoaXMuc2V0T3JwaGFuZWQoZmFsc2UpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cblx0XHRcdC8vIFB1dCBzb21lIGZhbGxiYWNrIHZhbHVlcyBpbiBlcnJvciBjYXNlXG5cdFx0XHRtdGltZSA9IERhdGUubm93KCk7XG5cdFx0XHRjdGltZSA9IERhdGUubm93KCk7XG5cdFx0XHRzaXplID0gMDtcblx0XHRcdGV0YWcgPSBFVEFHX0RJU0FCTEVEO1xuXG5cdFx0XHQvLyBBcHBseSBvcnBoYW5lZCBzdGF0ZSBiYXNlZCBvbiBlcnJvciBjb2RlXG5cdFx0XHR0aGlzLnNldE9ycGhhbmVkKGVycm9yLmZpbGVPcGVyYXRpb25SZXN1bHQgPT09IEZpbGVPcGVyYXRpb25SZXN1bHQuRklMRV9OT1RfRk9VTkQpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByZWZlcnJlZEVuY29kaW5nID0gYXdhaXQgdGhpcy50ZXh0RmlsZVNlcnZpY2UuZW5jb2RpbmcuZ2V0UHJlZmVycmVkV3JpdGVFbmNvZGluZyh0aGlzLnJlc291cmNlLCB0aGlzLnByZWZlcnJlZEVuY29kaW5nKTtcblxuXHRcdC8vIFJlc29sdmUgd2l0aCBidWZmZXJcblx0XHR0aGlzLnJlc29sdmVGcm9tQ29udGVudCh7XG5cdFx0XHRyZXNvdXJjZTogdGhpcy5yZXNvdXJjZSxcblx0XHRcdG5hbWU6IHRoaXMubmFtZSxcblx0XHRcdG10aW1lLFxuXHRcdFx0Y3RpbWUsXG5cdFx0XHRzaXplLFxuXHRcdFx0ZXRhZyxcblx0XHRcdHZhbHVlOiBidWZmZXIsXG5cdFx0XHRlbmNvZGluZzogcHJlZmVycmVkRW5jb2RpbmcuZW5jb2RpbmcsXG5cdFx0XHRyZWFkb25seTogZmFsc2UsXG5cdFx0XHRsb2NrZWQ6IGZhbHNlXG5cdFx0fSwgdHJ1ZSAvKiBkaXJ0eSAocmVzb2x2ZWQgZnJvbSBidWZmZXIpICovLCBvcHRpb25zKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVzb2x2ZUZyb21CYWNrdXAob3B0aW9ucz86IElUZXh0RmlsZVJlc29sdmVPcHRpb25zKTogUHJvbWlzZTxib29sZWFuPiB7XG5cblx0XHQvLyBSZXNvbHZlIGJhY2t1cCBpZiBhbnlcblx0XHRjb25zdCBiYWNrdXAgPSBhd2FpdCB0aGlzLndvcmtpbmdDb3B5QmFja3VwU2VydmljZS5yZXNvbHZlPElCYWNrdXBNZXRhRGF0YT4odGhpcyk7XG5cblx0XHQvLyBSZXNvbHZlIHByZWZlcnJlZCBlbmNvZGluZyBpZiB3ZSBuZWVkIGl0XG5cdFx0bGV0IGVuY29kaW5nID0gVVRGODtcblx0XHRpZiAoYmFja3VwKSB7XG5cdFx0XHRlbmNvZGluZyA9IChhd2FpdCB0aGlzLnRleHRGaWxlU2VydmljZS5lbmNvZGluZy5nZXRQcmVmZXJyZWRXcml0ZUVuY29kaW5nKHRoaXMucmVzb3VyY2UsIHRoaXMucHJlZmVycmVkRW5jb2RpbmcpKS5lbmNvZGluZztcblx0XHR9XG5cblx0XHQvLyBBYm9ydCBpZiBzb21lb25lIGVsc2UgbWFuYWdlZCB0byByZXNvbHZlIHRoZSBtb2RlbCBieSBub3dcblx0XHRjb25zdCBpc05ld01vZGVsID0gIXRoaXMuaXNSZXNvbHZlZCgpO1xuXHRcdGlmICghaXNOZXdNb2RlbCkge1xuXHRcdFx0dGhpcy50cmFjZSgncmVzb2x2ZUZyb21CYWNrdXAoKSAtIGV4aXQgLSB3aXRob3V0IHJlc29sdmluZyBiZWNhdXNlIHByZXZpb3VzbHkgbmV3IG1vZGVsIGdvdCBjcmVhdGVkIG1lYW53aGlsZScpO1xuXG5cdFx0XHRyZXR1cm4gdHJ1ZTsgLy8gaW1wbHkgdGhhdCByZXNvbHZpbmcgaGFzIGhhcHBlbmVkIGluIGFub3RoZXIgb3BlcmF0aW9uXG5cdFx0fVxuXG5cdFx0Ly8gVHJ5IHRvIHJlc29sdmUgZnJvbSBiYWNrdXAgaWYgd2UgaGF2ZSBhbnlcblx0XHRpZiAoYmFja3VwKSB7XG5cdFx0XHRhd2FpdCB0aGlzLmRvUmVzb2x2ZUZyb21CYWNrdXAoYmFja3VwLCBlbmNvZGluZywgb3B0aW9ucyk7XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8vIE90aGVyd2lzZSBzaWduYWwgYmFjayB0aGF0IHJlc29sdmluZyBkaWQgbm90IGhhcHBlblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9SZXNvbHZlRnJvbUJhY2t1cChiYWNrdXA6IElSZXNvbHZlZFdvcmtpbmdDb3B5QmFja3VwPElCYWNrdXBNZXRhRGF0YT4sIGVuY29kaW5nOiBzdHJpbmcsIG9wdGlvbnM/OiBJVGV4dEZpbGVSZXNvbHZlT3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMudHJhY2UoJ2RvUmVzb2x2ZUZyb21CYWNrdXAoKScpO1xuXG5cdFx0Ly8gUmVzb2x2ZSB3aXRoIGJhY2t1cFxuXHRcdHRoaXMucmVzb2x2ZUZyb21Db250ZW50KHtcblx0XHRcdHJlc291cmNlOiB0aGlzLnJlc291cmNlLFxuXHRcdFx0bmFtZTogdGhpcy5uYW1lLFxuXHRcdFx0bXRpbWU6IGJhY2t1cC5tZXRhID8gYmFja3VwLm1ldGEubXRpbWUgOiBEYXRlLm5vdygpLFxuXHRcdFx0Y3RpbWU6IGJhY2t1cC5tZXRhID8gYmFja3VwLm1ldGEuY3RpbWUgOiBEYXRlLm5vdygpLFxuXHRcdFx0c2l6ZTogYmFja3VwLm1ldGEgPyBiYWNrdXAubWV0YS5zaXplIDogMCxcblx0XHRcdGV0YWc6IGJhY2t1cC5tZXRhID8gYmFja3VwLm1ldGEuZXRhZyA6IEVUQUdfRElTQUJMRUQsIC8vIGV0YWcgZGlzYWJsZWQgaWYgdW5rbm93biFcblx0XHRcdHZhbHVlOiBhd2FpdCBjcmVhdGVUZXh0QnVmZmVyRmFjdG9yeUZyb21TdHJlYW0oYXdhaXQgdGhpcy50ZXh0RmlsZVNlcnZpY2UuZ2V0RGVjb2RlZFN0cmVhbSh0aGlzLnJlc291cmNlLCBiYWNrdXAudmFsdWUsIHsgZW5jb2Rpbmc6IFVURjggfSkpLFxuXHRcdFx0ZW5jb2RpbmcsXG5cdFx0XHRyZWFkb25seTogZmFsc2UsXG5cdFx0XHRsb2NrZWQ6IGZhbHNlXG5cdFx0fSwgdHJ1ZSAvKiBkaXJ0eSAocmVzb2x2ZWQgZnJvbSBiYWNrdXApICovLCBvcHRpb25zKTtcblxuXHRcdC8vIFJlc3RvcmUgb3JwaGFuZWQgZmxhZyBiYXNlZCBvbiBzdGF0ZVxuXHRcdGlmIChiYWNrdXAubWV0YT8ub3JwaGFuZWQpIHtcblx0XHRcdHRoaXMuc2V0T3JwaGFuZWQodHJ1ZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZXNvbHZlRnJvbUZpbGUob3B0aW9ucz86IElUZXh0RmlsZVJlc29sdmVPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy50cmFjZSgncmVzb2x2ZUZyb21GaWxlKCknKTtcblxuXHRcdGNvbnN0IGZvcmNlUmVhZEZyb21GaWxlID0gb3B0aW9ucz8uZm9yY2VSZWFkRnJvbUZpbGU7XG5cdFx0Y29uc3QgYWxsb3dCaW5hcnkgPSB0aGlzLmlzUmVzb2x2ZWQoKSAvKiBhbHdheXMgYWxsb3cgaWYgd2UgcmVzb2x2ZWQgcHJldmlvdXNseSAqLyB8fCBvcHRpb25zPy5hbGxvd0JpbmFyeTtcblxuXHRcdC8vIERlY2lkZSBvbiBldGFnXG5cdFx0bGV0IGV0YWc6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRpZiAoZm9yY2VSZWFkRnJvbUZpbGUpIHtcblx0XHRcdGV0YWcgPSBFVEFHX0RJU0FCTEVEOyAvLyBkaXNhYmxlIEVUYWcgaWYgd2UgZW5mb3JjZSB0byByZWFkIGZyb20gZGlza1xuXHRcdH0gZWxzZSBpZiAodGhpcy5sYXN0UmVzb2x2ZWRGaWxlU3RhdCkge1xuXHRcdFx0ZXRhZyA9IHRoaXMubGFzdFJlc29sdmVkRmlsZVN0YXQuZXRhZzsgLy8gb3RoZXJ3aXNlIHJlc3BlY3QgZXRhZyB0byBzdXBwb3J0IGNhY2hpbmdcblx0XHR9XG5cblx0XHQvLyBSZW1lbWJlciBjdXJyZW50IHZlcnNpb24gYmVmb3JlIGRvaW5nIGFueSBsb25nIHJ1bm5pbmcgb3BlcmF0aW9uXG5cdFx0Ly8gdG8gZW5zdXJlIHdlIGFyZSBub3QgY2hhbmdpbmcgYSBtb2RlbCB0aGF0IHdhcyBjaGFuZ2VkIG1lYW53aGlsZVxuXHRcdGNvbnN0IGN1cnJlbnRWZXJzaW9uSWQgPSB0aGlzLnZlcnNpb25JZDtcblxuXHRcdC8vIFJlc29sdmUgQ29udGVudFxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy50ZXh0RmlsZVNlcnZpY2UucmVhZFN0cmVhbSh0aGlzLnJlc291cmNlLCB7XG5cdFx0XHRcdGFjY2VwdFRleHRPbmx5OiAhYWxsb3dCaW5hcnksXG5cdFx0XHRcdGV0YWcsXG5cdFx0XHRcdGVuY29kaW5nOiB0aGlzLnByZWZlcnJlZEVuY29kaW5nLFxuXHRcdFx0XHRsaW1pdHM6IG9wdGlvbnM/LmxpbWl0c1xuXHRcdFx0fSk7XG5cblx0XHRcdC8vIENsZWFyIG9ycGhhbmVkIHN0YXRlIHdoZW4gcmVzb2x2aW5nIHdhcyBzdWNjZXNzZnVsXG5cdFx0XHR0aGlzLnNldE9ycGhhbmVkKGZhbHNlKTtcblxuXHRcdFx0Ly8gUmV0dXJuIGVhcmx5IGlmIHRoZSBtb2RlbCBjb250ZW50IGhhcyBjaGFuZ2VkXG5cdFx0XHQvLyBtZWFud2hpbGUgdG8gcHJldmVudCBsb29zaW5nIGFueSBjaGFuZ2VzXG5cdFx0XHRpZiAoY3VycmVudFZlcnNpb25JZCAhPT0gdGhpcy52ZXJzaW9uSWQpIHtcblx0XHRcdFx0dGhpcy50cmFjZSgncmVzb2x2ZUZyb21GaWxlKCkgLSBleGl0IC0gd2l0aG91dCByZXNvbHZpbmcgYmVjYXVzZSBtb2RlbCBjb250ZW50IGNoYW5nZWQnKTtcblxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB0aGlzLnJlc29sdmVGcm9tQ29udGVudChjb250ZW50LCBmYWxzZSAvKiBub3QgZGlydHkgKHJlc29sdmVkIGZyb20gZmlsZSkgKi8sIG9wdGlvbnMpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRjb25zdCByZXN1bHQgPSBlcnJvci5maWxlT3BlcmF0aW9uUmVzdWx0O1xuXG5cdFx0XHQvLyBBcHBseSBvcnBoYW5lZCBzdGF0ZSBiYXNlZCBvbiBlcnJvciBjb2RlXG5cdFx0XHR0aGlzLnNldE9ycGhhbmVkKHJlc3VsdCA9PT0gRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX05PVF9GT1VORCk7XG5cblx0XHRcdC8vIE5vdE1vZGlmaWVkIHN0YXR1cyBpcyBleHBlY3RlZCBhbmQgY2FuIGJlIGhhbmRsZWQgZ3JhY2VmdWxseVxuXHRcdFx0Ly8gaWYgd2UgYXJlIHJlc29sdmVkLiBXZSBzdGlsbCB3YW50IHRvIHVwZGF0ZSBvdXIgbGFzdCByZXNvbHZlZFxuXHRcdFx0Ly8gc3RhdCB0byBlLmcuIGRldGVjdCBjaGFuZ2VzIHRvIHRoZSBmaWxlJ3MgcmVhZG9ubHkgc3RhdGVcblx0XHRcdGlmICh0aGlzLmlzUmVzb2x2ZWQoKSAmJiByZXN1bHQgPT09IEZpbGVPcGVyYXRpb25SZXN1bHQuRklMRV9OT1RfTU9ESUZJRURfU0lOQ0UpIHtcblx0XHRcdFx0aWYgKGVycm9yIGluc3RhbmNlb2YgTm90TW9kaWZpZWRTaW5jZUZpbGVPcGVyYXRpb25FcnJvcikge1xuXHRcdFx0XHRcdHRoaXMudXBkYXRlTGFzdFJlc29sdmVkRmlsZVN0YXQoZXJyb3Iuc3RhdCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIFVubGVzcyB3ZSBhcmUgZm9yY2VkIHRvIHJlYWQgZnJvbSB0aGUgZmlsZSwgSWdub3JlIHdoZW4gYSBtb2RlbCBoYXMgYmVlbiByZXNvbHZlZCBvbmNlXG5cdFx0XHQvLyBhbmQgdGhlIGZpbGUgd2FzIGRlbGV0ZWQgbWVhbndoaWxlLiBTaW5jZSB3ZSBhbHJlYWR5IGhhdmUgdGhlIG1vZGVsIHJlc29sdmVkLCB3ZSBjYW4gcmV0dXJuXG5cdFx0XHQvLyB0byB0aGlzIHN0YXRlIGFuZCB1cGRhdGUgdGhlIG9ycGhhbmVkIGZsYWcgdG8gaW5kaWNhdGUgdGhhdCB0aGlzIG1vZGVsIGhhcyBubyB2ZXJzaW9uIG9uXG5cdFx0XHQvLyBkaXNrIGFueW1vcmUuXG5cdFx0XHRpZiAodGhpcy5pc1Jlc29sdmVkKCkgJiYgcmVzdWx0ID09PSBGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfTk9UX0ZPVU5EICYmICFmb3JjZVJlYWRGcm9tRmlsZSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIE90aGVyd2lzZSBidWJibGUgdXAgdGhlIGVycm9yXG5cdFx0XHR0aHJvdyBlcnJvcjtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlc29sdmVGcm9tQ29udGVudChjb250ZW50OiBJVGV4dEZpbGVTdHJlYW1Db250ZW50LCBkaXJ0eTogYm9vbGVhbiwgb3B0aW9ucz86IElUZXh0RmlsZVJlc29sdmVPcHRpb25zKTogdm9pZCB7XG5cdFx0dGhpcy50cmFjZSgncmVzb2x2ZUZyb21Db250ZW50KCkgLSBlbnRlcicpO1xuXG5cdFx0Ly8gUmV0dXJuIGVhcmx5IGlmIHdlIGFyZSBkaXNwb3NlZFxuXHRcdGlmICh0aGlzLmlzRGlzcG9zZWQoKSkge1xuXHRcdFx0dGhpcy50cmFjZSgncmVzb2x2ZUZyb21Db250ZW50KCkgLSBleGl0IC0gYmVjYXVzZSBtb2RlbCBpcyBkaXNwb3NlZCcpO1xuXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gVXBkYXRlIG91ciByZXNvbHZlZCBkaXNrIHN0YXQgbW9kZWxcblx0XHR0aGlzLnVwZGF0ZUxhc3RSZXNvbHZlZEZpbGVTdGF0KHtcblx0XHRcdHJlc291cmNlOiB0aGlzLnJlc291cmNlLFxuXHRcdFx0bmFtZTogY29udGVudC5uYW1lLFxuXHRcdFx0bXRpbWU6IGNvbnRlbnQubXRpbWUsXG5cdFx0XHRjdGltZTogY29udGVudC5jdGltZSxcblx0XHRcdHNpemU6IGNvbnRlbnQuc2l6ZSxcblx0XHRcdGV0YWc6IGNvbnRlbnQuZXRhZyxcblx0XHRcdHJlYWRvbmx5OiBjb250ZW50LnJlYWRvbmx5LFxuXHRcdFx0bG9ja2VkOiBjb250ZW50LmxvY2tlZCxcblx0XHRcdGlzRmlsZTogdHJ1ZSxcblx0XHRcdGlzRGlyZWN0b3J5OiBmYWxzZSxcblx0XHRcdGlzU3ltYm9saWNMaW5rOiBmYWxzZSxcblx0XHRcdGNoaWxkcmVuOiB1bmRlZmluZWRcblx0XHR9KTtcblxuXHRcdC8vIEtlZXAgdGhlIG9yaWdpbmFsIGVuY29kaW5nIHRvIG5vdCBsb29zZSBpdCB3aGVuIHNhdmluZ1xuXHRcdGNvbnN0IG9sZEVuY29kaW5nID0gdGhpcy5jb250ZW50RW5jb2Rpbmc7XG5cdFx0dGhpcy5jb250ZW50RW5jb2RpbmcgPSBjb250ZW50LmVuY29kaW5nO1xuXG5cdFx0Ly8gSGFuZGxlIGV2ZW50cyBpZiBlbmNvZGluZyBjaGFuZ2VkXG5cdFx0aWYgKHRoaXMucHJlZmVycmVkRW5jb2RpbmcpIHtcblx0XHRcdHRoaXMudXBkYXRlUHJlZmVycmVkRW5jb2RpbmcodGhpcy5jb250ZW50RW5jb2RpbmcpOyAvLyBtYWtlIHN1cmUgdG8gcmVmbGVjdCB0aGUgcmVhbCBlbmNvZGluZyBvZiB0aGUgZmlsZSAobmV2ZXIgb3V0IG9mIHN5bmMpXG5cdFx0fSBlbHNlIGlmIChvbGRFbmNvZGluZyAhPT0gdGhpcy5jb250ZW50RW5jb2RpbmcpIHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlRW5jb2RpbmcuZmlyZSgpO1xuXHRcdH1cblxuXHRcdC8vIFVwZGF0ZSBFeGlzdGluZyBNb2RlbFxuXHRcdGlmICh0aGlzLnRleHRFZGl0b3JNb2RlbCkge1xuXHRcdFx0dGhpcy5kb1VwZGF0ZVRleHRNb2RlbChjb250ZW50LnZhbHVlKTtcblx0XHR9XG5cblx0XHQvLyBDcmVhdGUgTmV3IE1vZGVsXG5cdFx0ZWxzZSB7XG5cdFx0XHR0aGlzLmRvQ3JlYXRlVGV4dE1vZGVsKGNvbnRlbnQucmVzb3VyY2UsIGNvbnRlbnQudmFsdWUpO1xuXHRcdH1cblxuXHRcdC8vIFVwZGF0ZSBtb2RlbCBkaXJ0eSBmbGFnLiBUaGlzIGlzIHZlcnkgaW1wb3J0YW50IHRvIGNhbGxcblx0XHQvLyBpbiBib3RoIGNhc2VzIG9mIGRpcnR5IG9yIG5vdCBiZWNhdXNlIGl0IGNvbmRpdGlvbmFsbHlcblx0XHQvLyB1cGRhdGVzIHRoZSBgYnVmZmVyU2F2ZWRWZXJzaW9uSWRgIHRvIGRldGVybWluZSB0aGVcblx0XHQvLyB2ZXJzaW9uIHdoZW4gdG8gY29uc2lkZXIgdGhlIG1vZGVsIGFzIHNhdmVkIGFnYWluIChlLmcuXG5cdFx0Ly8gd2hlbiB1bmRvaW5nIGJhY2sgdG8gdGhlIHNhdmVkIHN0YXRlKVxuXHRcdHRoaXMuc2V0RGlydHkoISFkaXJ0eSk7XG5cblx0XHQvLyBFbWl0IGFzIGV2ZW50XG5cdFx0dGhpcy5fb25EaWRSZXNvbHZlLmZpcmUob3B0aW9ucz8ucmVhc29uID8/IFRleHRGaWxlUmVzb2x2ZVJlYXNvbi5PVEhFUik7XG5cdH1cblxuXHRwcml2YXRlIGRvQ3JlYXRlVGV4dE1vZGVsKHJlc291cmNlOiBVUkksIHZhbHVlOiBJVGV4dEJ1ZmZlckZhY3RvcnkpOiB2b2lkIHtcblx0XHR0aGlzLnRyYWNlKCdkb0NyZWF0ZVRleHRNb2RlbCgpJyk7XG5cblx0XHQvLyBDcmVhdGUgbW9kZWxcblx0XHRjb25zdCB0ZXh0TW9kZWwgPSB0aGlzLmNyZWF0ZVRleHRFZGl0b3JNb2RlbCh2YWx1ZSwgcmVzb3VyY2UsIHRoaXMucHJlZmVycmVkTGFuZ3VhZ2VJZCk7XG5cblx0XHQvLyBNb2RlbCBMaXN0ZW5lcnNcblx0XHR0aGlzLmluc3RhbGxNb2RlbExpc3RlbmVycyh0ZXh0TW9kZWwpO1xuXG5cdFx0Ly8gRGV0ZWN0IGxhbmd1YWdlIGZyb20gY29udGVudFxuXHRcdHRoaXMuYXV0b0RldGVjdExhbmd1YWdlKCk7XG5cdH1cblxuXHRwcml2YXRlIGRvVXBkYXRlVGV4dE1vZGVsKHZhbHVlOiBJVGV4dEJ1ZmZlckZhY3RvcnkpOiB2b2lkIHtcblx0XHR0aGlzLnRyYWNlKCdkb1VwZGF0ZVRleHRNb2RlbCgpJyk7XG5cblx0XHQvLyBVcGRhdGUgbW9kZWwgdmFsdWUgaW4gYSBibG9jayB0aGF0IGlnbm9yZXMgY29udGVudCBjaGFuZ2UgZXZlbnRzIGZvciBkaXJ0eSB0cmFja2luZ1xuXHRcdHRoaXMuaWdub3JlRGlydHlPbk1vZGVsQ29udGVudENoYW5nZSA9IHRydWU7XG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMudXBkYXRlVGV4dEVkaXRvck1vZGVsKHZhbHVlLCB0aGlzLnByZWZlcnJlZExhbmd1YWdlSWQpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLmlnbm9yZURpcnR5T25Nb2RlbENvbnRlbnRDaGFuZ2UgPSBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgaW5zdGFsbE1vZGVsTGlzdGVuZXJzKG1vZGVsOiBJVGV4dE1vZGVsKTogdm9pZCB7XG5cblx0XHQvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzMwMTg5XG5cdFx0Ly8gVGhpcyBjb2RlIGhhcyBiZWVuIGV4dHJhY3RlZCB0byBhIGRpZmZlcmVudCBtZXRob2QgYmVjYXVzZSBpdCBjYXVzZWQgYSBtZW1vcnkgbGVha1xuXHRcdC8vIHdoZXJlIGB2YWx1ZWAgd2FzIGNhcHR1cmVkIGluIHRoZSBjb250ZW50IGNoYW5nZSBsaXN0ZW5lciBjbG9zdXJlIHNjb3BlLlxuXG5cdFx0dGhpcy5fcmVnaXN0ZXIobW9kZWwub25EaWRDaGFuZ2VDb250ZW50KGUgPT4gdGhpcy5vbk1vZGVsQ29udGVudENoYW5nZWQobW9kZWwsIGUuaXNVbmRvaW5nIHx8IGUuaXNSZWRvaW5nKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKG1vZGVsLm9uRGlkQ2hhbmdlTGFuZ3VhZ2UoKCkgPT4gdGhpcy5vbk1heWJlU2hvdWxkQ2hhbmdlRW5jb2RpbmcoKSkpOyAvLyBkZXRlY3QgcG9zc2libGUgZW5jb2RpbmcgY2hhbmdlIHZpYSBsYW5ndWFnZSBzcGVjaWZpYyBzZXR0aW5nc1xuXG5cdFx0c3VwZXIuaW5zdGFsbE1vZGVsTGlzdGVuZXJzKG1vZGVsKTtcblx0fVxuXG5cdHByaXZhdGUgb25Nb2RlbENvbnRlbnRDaGFuZ2VkKG1vZGVsOiBJVGV4dE1vZGVsLCBpc1VuZG9pbmdPclJlZG9pbmc6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLnRyYWNlKGBvbk1vZGVsQ29udGVudENoYW5nZWQoKSAtIGVudGVyYCk7XG5cblx0XHQvLyBJbiBhbnkgY2FzZSBpbmNyZW1lbnQgdGhlIHZlcnNpb24gaWQgYmVjYXVzZSBpdCB0cmFja3MgdGhlIHRleHR1YWwgY29udGVudCBzdGF0ZSBvZiB0aGUgbW9kZWwgYXQgYWxsIHRpbWVzXG5cdFx0dGhpcy52ZXJzaW9uSWQrKztcblx0XHR0aGlzLnRyYWNlKGBvbk1vZGVsQ29udGVudENoYW5nZWQoKSAtIG5ldyB2ZXJzaW9uSWQgJHt0aGlzLnZlcnNpb25JZH1gKTtcblxuXHRcdC8vIFJlbWVtYmVyIHdoZW4gdGhlIHVzZXIgY2hhbmdlZCB0aGUgbW9kZWwgdGhyb3VnaCBhIHVuZG8vcmVkbyBvcGVyYXRpb24uXG5cdFx0Ly8gV2UgbmVlZCB0aGlzIGluZm9ybWF0aW9uIHRvIHRocm90dGxlIHNhdmUgcGFydGljaXBhbnRzIHRvIGZpeFxuXHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMDI1NDJcblx0XHRpZiAoaXNVbmRvaW5nT3JSZWRvaW5nKSB7XG5cdFx0XHR0aGlzLmxhc3RNb2RlbENvbnRlbnRDaGFuZ2VGcm9tVW5kb1JlZG8gPSBEYXRlLm5vdygpO1xuXHRcdH1cblxuXHRcdC8vIFdlIG1hcmsgY2hlY2sgZm9yIGEgZGlydHktc3RhdGUgY2hhbmdlIHVwb24gbW9kZWwgY29udGVudCBjaGFuZ2UsIHVubGVzczpcblx0XHQvLyAtIGV4cGxpY2l0bHkgaW5zdHJ1Y3RlZCB0byBpZ25vcmUgaXQgKGUuZy4gZnJvbSBtb2RlbC5yZXNvbHZlKCkpXG5cdFx0Ly8gLSB0aGUgbW9kZWwgaXMgcmVhZG9ubHkgKGluIHRoYXQgY2FzZSB3ZSBuZXZlciBhc3N1bWUgdGhlIGNoYW5nZSB3YXMgZG9uZSBieSB0aGUgdXNlcilcblx0XHRpZiAoIXRoaXMuaWdub3JlRGlydHlPbk1vZGVsQ29udGVudENoYW5nZSAmJiAhdGhpcy5pc1JlYWRvbmx5KCkpIHtcblxuXHRcdFx0Ly8gVGhlIGNvbnRlbnRzIGNoYW5nZWQgYXMgYSBtYXR0ZXIgb2YgVW5kbyBhbmQgdGhlIHZlcnNpb24gcmVhY2hlZCBtYXRjaGVzIHRoZSBzYXZlZCBvbmVcblx0XHRcdC8vIEluIHRoaXMgY2FzZSB3ZSBjbGVhciB0aGUgZGlydHkgZmxhZyBhbmQgZW1pdCBhIFNBVkVEIGV2ZW50IHRvIGluZGljYXRlIHRoaXMgc3RhdGUuXG5cdFx0XHRpZiAobW9kZWwuZ2V0QWx0ZXJuYXRpdmVWZXJzaW9uSWQoKSA9PT0gdGhpcy5idWZmZXJTYXZlZFZlcnNpb25JZCkge1xuXHRcdFx0XHR0aGlzLnRyYWNlKCdvbk1vZGVsQ29udGVudENoYW5nZWQoKSAtIG1vZGVsIGNvbnRlbnQgY2hhbmdlZCBiYWNrIHRvIGxhc3Qgc2F2ZWQgdmVyc2lvbicpO1xuXG5cdFx0XHRcdC8vIENsZWFyIGZsYWdzXG5cdFx0XHRcdGNvbnN0IHdhc0RpcnR5ID0gdGhpcy5kaXJ0eTtcblx0XHRcdFx0dGhpcy5zZXREaXJ0eShmYWxzZSk7XG5cblx0XHRcdFx0Ly8gRW1pdCByZXZlcnQgZXZlbnQgaWYgd2Ugd2VyZSBkaXJ0eVxuXHRcdFx0XHRpZiAod2FzRGlydHkpIHtcblx0XHRcdFx0XHR0aGlzLl9vbkRpZFJldmVydC5maXJlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gT3RoZXJ3aXNlIHRoZSBjb250ZW50IGhhcyBjaGFuZ2VkIGFuZCB3ZSBzaWduYWwgdGhpcyBhcyBiZWNvbWluZyBkaXJ0eVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdHRoaXMudHJhY2UoJ29uTW9kZWxDb250ZW50Q2hhbmdlZCgpIC0gbW9kZWwgY29udGVudCBjaGFuZ2VkIGFuZCBtYXJrZWQgYXMgZGlydHknKTtcblxuXHRcdFx0XHQvLyBNYXJrIGFzIGRpcnR5XG5cdFx0XHRcdHRoaXMuc2V0RGlydHkodHJ1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gRW1pdCBhcyBldmVudFxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlQ29udGVudC5maXJlKCk7XG5cblx0XHQvLyBEZXRlY3QgbGFuZ3VhZ2UgZnJvbSBjb250ZW50XG5cdFx0dGhpcy5hdXRvRGV0ZWN0TGFuZ3VhZ2UoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBhc3luYyBhdXRvRGV0ZWN0TGFuZ3VhZ2UoKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHQvLyBXYWl0IHRvIGJlIHJlYWR5IHRvIGRldGVjdCBsYW5ndWFnZVxuXHRcdGF3YWl0IHRoaXMuZXh0ZW5zaW9uU2VydmljZT8ud2hlbkluc3RhbGxlZEV4dGVuc2lvbnNSZWdpc3RlcmVkKCk7XG5cblx0XHQvLyBPbmx5IHBlcmZvcm0gbGFuZ3VhZ2UgZGV0ZWN0aW9uIGNvbmRpdGlvbmFsbHlcblx0XHRjb25zdCBsYW5ndWFnZUlkID0gdGhpcy5nZXRMYW5ndWFnZUlkKCk7XG5cdFx0aWYgKFxuXHRcdFx0dGhpcy5yZXNvdXJjZS5zY2hlbWUgPT09IHRoaXMucGF0aFNlcnZpY2UuZGVmYXVsdFVyaVNjaGVtZSAmJlx0Ly8gbWFrZSBzdXJlIHRvIG5vdCBkZXRlY3QgbGFuZ3VhZ2UgZm9yIG5vbi11c2VyIHZpc2libGUgZG9jdW1lbnRzXG5cdFx0XHQoIWxhbmd1YWdlSWQgfHwgbGFuZ3VhZ2VJZCA9PT0gUExBSU5URVhUX0xBTkdVQUdFX0lEKSAmJlx0XHQvLyBvbmx5IHJ1biBvbiBmaWxlcyB3aXRoIHBsYWludGV4dCBsYW5ndWFnZSBzZXQgb3Igbm8gbGFuZ3VhZ2Ugc2V0IGF0IGFsbFxuXHRcdFx0IXRoaXMucmVzb3VyY2VIYXNFeHRlbnNpb25cdFx0XHRcdFx0XHRcdFx0XHRcdC8vIG9ubHkgcnVuIGlmIHRoaXMgcGFydGljdWxhciBmaWxlIGRvZXNuJ3QgaGF2ZSBhbiBleHRlbnNpb25cblx0XHQpIHtcblx0XHRcdHJldHVybiBzdXBlci5hdXRvRGV0ZWN0TGFuZ3VhZ2UoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGZvcmNlUmVzb2x2ZUZyb21GaWxlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLmlzRGlzcG9zZWQoKSkge1xuXHRcdFx0cmV0dXJuOyAvLyByZXR1cm4gZWFybHkgd2hlbiB0aGUgbW9kZWwgaXMgaW52YWxpZFxuXHRcdH1cblxuXHRcdC8vIFdlIGdvIHRocm91Z2ggdGhlIHRleHQgZmlsZSBzZXJ2aWNlIHRvIG1ha2Vcblx0XHQvLyBzdXJlIHRoaXMga2luZCBvZiBgcmVzb2x2ZWAgaXMgcHJvcGVybHlcblx0XHQvLyBydW5uaW5nIGluIHNlcXVlbmNlIHdpdGggYW55IG90aGVyIHJ1bm5pbmdcblx0XHQvLyBgcmVzb2x2ZWAgaWYgYW55LCBpbmNsdWRpbmcgc3Vic2VxdWVudCBydW5zXG5cdFx0Ly8gdGhhdCBhcmUgdHJpZ2dlcmVkIHJpZ2h0IGFmdGVyLlxuXG5cdFx0YXdhaXQgdGhpcy50ZXh0RmlsZVNlcnZpY2UuZmlsZXMucmVzb2x2ZSh0aGlzLnJlc291cmNlLCB7XG5cdFx0XHRyZWxvYWQ6IHsgYXN5bmM6IGZhbHNlIH0sXG5cdFx0XHRmb3JjZVJlYWRGcm9tRmlsZTogdHJ1ZVxuXHRcdH0pO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIERpcnR5XG5cblx0aXNEaXJ0eSgpOiB0aGlzIGlzIElSZXNvbHZlZFRleHRGaWxlRWRpdG9yTW9kZWwge1xuXHRcdHJldHVybiB0aGlzLmRpcnR5O1xuXHR9XG5cblx0aXNNb2RpZmllZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5pc0RpcnR5KCk7XG5cdH1cblxuXHRzZXREaXJ0eShkaXJ0eTogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICghdGhpcy5pc1Jlc29sdmVkKCkpIHtcblx0XHRcdHJldHVybjsgLy8gb25seSByZXNvbHZlZCBtb2RlbHMgY2FuIGJlIG1hcmtlZCBkaXJ0eVxuXHRcdH1cblxuXHRcdC8vIFRyYWNrIGRpcnR5IHN0YXRlIGFuZCB2ZXJzaW9uIGlkXG5cdFx0Y29uc3Qgd2FzRGlydHkgPSB0aGlzLmRpcnR5O1xuXHRcdHRoaXMuZG9TZXREaXJ0eShkaXJ0eSk7XG5cblx0XHQvLyBFbWl0IGFzIEV2ZW50IGlmIGRpcnR5IGNoYW5nZWRcblx0XHRpZiAoZGlydHkgIT09IHdhc0RpcnR5KSB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZURpcnR5LmZpcmUoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGRvU2V0RGlydHkoZGlydHk6IGJvb2xlYW4pOiAoKSA9PiB2b2lkIHtcblx0XHRjb25zdCB3YXNEaXJ0eSA9IHRoaXMuZGlydHk7XG5cdFx0Y29uc3Qgd2FzSW5Db25mbGljdE1vZGUgPSB0aGlzLmluQ29uZmxpY3RNb2RlO1xuXHRcdGNvbnN0IHdhc0luRXJyb3JNb2RlID0gdGhpcy5pbkVycm9yTW9kZTtcblx0XHRjb25zdCBvbGRCdWZmZXJTYXZlZFZlcnNpb25JZCA9IHRoaXMuYnVmZmVyU2F2ZWRWZXJzaW9uSWQ7XG5cblx0XHRpZiAoIWRpcnR5KSB7XG5cdFx0XHR0aGlzLmRpcnR5ID0gZmFsc2U7XG5cdFx0XHR0aGlzLmluQ29uZmxpY3RNb2RlID0gZmFsc2U7XG5cdFx0XHR0aGlzLmluRXJyb3JNb2RlID0gZmFsc2U7XG5cdFx0XHR0aGlzLnVwZGF0ZVNhdmVkVmVyc2lvbklkKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuZGlydHkgPSB0cnVlO1xuXHRcdH1cblxuXHRcdC8vIFJldHVybiBmdW5jdGlvbiB0byByZXZlcnQgdGhpcyBjYWxsXG5cdFx0cmV0dXJuICgpID0+IHtcblx0XHRcdHRoaXMuZGlydHkgPSB3YXNEaXJ0eTtcblx0XHRcdHRoaXMuaW5Db25mbGljdE1vZGUgPSB3YXNJbkNvbmZsaWN0TW9kZTtcblx0XHRcdHRoaXMuaW5FcnJvck1vZGUgPSB3YXNJbkVycm9yTW9kZTtcblx0XHRcdHRoaXMuYnVmZmVyU2F2ZWRWZXJzaW9uSWQgPSBvbGRCdWZmZXJTYXZlZFZlcnNpb25JZDtcblx0XHR9O1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIFNhdmVcblxuXHRhc3luYyBzYXZlKG9wdGlvbnM6IElUZXh0RmlsZVNhdmVBc09wdGlvbnMgPSBPYmplY3QuY3JlYXRlKG51bGwpKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0aWYgKCF0aGlzLmlzUmVzb2x2ZWQoKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmlzUmVhZG9ubHkoKSkge1xuXHRcdFx0dGhpcy50cmFjZSgnc2F2ZSgpIC0gaWdub3JpbmcgcmVxdWVzdCBmb3IgcmVhZG9ubHkgcmVzb3VyY2UnKTtcblxuXHRcdFx0cmV0dXJuIGZhbHNlOyAvLyBpZiBtb2RlbCBpcyByZWFkb25seSB3ZSBkbyBub3QgYXR0ZW1wdCB0byBzYXZlIGF0IGFsbFxuXHRcdH1cblxuXHRcdGlmIChcblx0XHRcdCh0aGlzLmhhc1N0YXRlKFRleHRGaWxlRWRpdG9yTW9kZWxTdGF0ZS5DT05GTElDVCkgfHwgdGhpcy5oYXNTdGF0ZShUZXh0RmlsZUVkaXRvck1vZGVsU3RhdGUuRVJST1IpKSAmJlxuXHRcdFx0KG9wdGlvbnMucmVhc29uID09PSBTYXZlUmVhc29uLkFVVE8gfHwgb3B0aW9ucy5yZWFzb24gPT09IFNhdmVSZWFzb24uRk9DVVNfQ0hBTkdFIHx8IG9wdGlvbnMucmVhc29uID09PSBTYXZlUmVhc29uLldJTkRPV19DSEFOR0UpXG5cdFx0KSB7XG5cdFx0XHR0aGlzLnRyYWNlKCdzYXZlKCkgLSBpZ25vcmluZyBhdXRvIHNhdmUgcmVxdWVzdCBmb3IgbW9kZWwgdGhhdCBpcyBpbiBjb25mbGljdCBvciBlcnJvcicpO1xuXG5cdFx0XHRyZXR1cm4gZmFsc2U7IC8vIGlmIG1vZGVsIGlzIGluIHNhdmUgY29uZmxpY3Qgb3IgZXJyb3IsIGRvIG5vdCBzYXZlIHVubGVzcyBzYXZlIHJlYXNvbiBpcyBleHBsaWNpdFxuXHRcdH1cblxuXHRcdC8vIEFjdHVhbGx5IGRvIHNhdmUgYW5kIGxvZ1xuXHRcdHRoaXMudHJhY2UoJ3NhdmUoKSAtIGVudGVyJyk7XG5cdFx0YXdhaXQgdGhpcy5kb1NhdmUob3B0aW9ucyk7XG5cdFx0dGhpcy50cmFjZSgnc2F2ZSgpIC0gZXhpdCcpO1xuXG5cdFx0cmV0dXJuIHRoaXMuaGFzU3RhdGUoVGV4dEZpbGVFZGl0b3JNb2RlbFN0YXRlLlNBVkVEKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9TYXZlKG9wdGlvbnM6IElUZXh0RmlsZVNhdmVBc09wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodHlwZW9mIG9wdGlvbnMucmVhc29uICE9PSAnbnVtYmVyJykge1xuXHRcdFx0b3B0aW9ucy5yZWFzb24gPSBTYXZlUmVhc29uLkVYUExJQ0lUO1xuXHRcdH1cblxuXHRcdGNvbnN0IHZlcnNpb25JZCA9IHRoaXMudmVyc2lvbklkO1xuXHRcdHRoaXMudHJhY2UoYGRvU2F2ZSgke3ZlcnNpb25JZH0pIC0gZW50ZXIgd2l0aCB2ZXJzaW9uSWQgJHt2ZXJzaW9uSWR9YCk7XG5cblx0XHQvLyBSZXR1cm4gZWFybHkgaWYgc2F2ZWQgZnJvbSB3aXRoaW4gc2F2ZSBwYXJ0aWNpcGFudCB0byBicmVhayByZWN1cnNpb25cblx0XHQvL1xuXHRcdC8vIFNjZW5hcmlvOiBhIHNhdmUgcGFydGljaXBhbnQgdHJpZ2dlcnMgYSBzYXZlKCkgb24gdGhlIG1vZGVsXG5cdFx0aWYgKHRoaXMuaWdub3JlU2F2ZUZyb21TYXZlUGFydGljaXBhbnRzKSB7XG5cdFx0XHR0aGlzLnRyYWNlKGBkb1NhdmUoJHt2ZXJzaW9uSWR9KSAtIGV4aXQgLSByZWZ1c2luZyB0byBzYXZlKCkgcmVjdXJzaXZlbHkgZnJvbSBzYXZlIHBhcnRpY2lwYW50YCk7XG5cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBMb29rdXAgYW55IHJ1bm5pbmcgc2F2ZSBmb3IgdGhpcyB2ZXJzaW9uSWQgYW5kIHJldHVybiBpdCBpZiBmb3VuZFxuXHRcdC8vXG5cdFx0Ly8gU2NlbmFyaW86IHVzZXIgaW52b2tlZCB0aGUgc2F2ZSBhY3Rpb24gbXVsdGlwbGUgdGltZXMgcXVpY2tseSBmb3IgdGhlIHNhbWUgY29udGVudHNcblx0XHQvLyAgICAgICAgICAgd2hpbGUgdGhlIHNhdmUgd2FzIG5vdCB5ZXQgZmluaXNoZWQgdG8gZGlza1xuXHRcdC8vXG5cdFx0aWYgKHRoaXMuc2F2ZVNlcXVlbnRpYWxpemVyLmlzUnVubmluZyh2ZXJzaW9uSWQpKSB7XG5cdFx0XHR0aGlzLnRyYWNlKGBkb1NhdmUoJHt2ZXJzaW9uSWR9KSAtIGV4aXQgLSBmb3VuZCBhIHJ1bm5pbmcgc2F2ZSBmb3IgdmVyc2lvbklkICR7dmVyc2lvbklkfWApO1xuXG5cdFx0XHRyZXR1cm4gdGhpcy5zYXZlU2VxdWVudGlhbGl6ZXIucnVubmluZztcblx0XHR9XG5cblx0XHQvLyBSZXR1cm4gZWFybHkgaWYgbm90IGRpcnR5ICh1bmxlc3MgZm9yY2VkKVxuXHRcdC8vXG5cdFx0Ly8gU2NlbmFyaW86IHVzZXIgaW52b2tlZCBzYXZlIGFjdGlvbiBldmVuIHRob3VnaCB0aGUgbW9kZWwgaXMgbm90IGRpcnR5XG5cdFx0aWYgKCFvcHRpb25zLmZvcmNlICYmICF0aGlzLmRpcnR5KSB7XG5cdFx0XHR0aGlzLnRyYWNlKGBkb1NhdmUoJHt2ZXJzaW9uSWR9KSAtIGV4aXQgLSBiZWNhdXNlIG5vdCBkaXJ0eSBhbmQvb3IgdmVyc2lvbklkIGlzIGRpZmZlcmVudCAodGhpcy5pc0RpcnR5OiAke3RoaXMuZGlydHl9LCB0aGlzLnZlcnNpb25JZDogJHt0aGlzLnZlcnNpb25JZH0pYCk7XG5cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBSZXR1cm4gaWYgY3VycmVudGx5IHNhdmluZyBieSBzdG9yaW5nIHRoaXMgc2F2ZSByZXF1ZXN0IGFzIHRoZSBuZXh0IHNhdmUgdGhhdCBzaG91bGQgaGFwcGVuLlxuXHRcdC8vIE5ldmVyIGV2ZXIgbXVzdCAyIHNhdmVzIGV4ZWN1dGUgYXQgdGhlIHNhbWUgdGltZSBiZWNhdXNlIHRoaXMgY2FuIGxlYWQgdG8gZGlydHkgd3JpdGVzIGFuZCByYWNlIGNvbmRpdGlvbnMuXG5cdFx0Ly9cblx0XHQvLyBTY2VuYXJpbyBBOiBhdXRvIHNhdmUgd2FzIHRyaWdnZXJlZCBhbmQgaXMgY3VycmVudGx5IGJ1c3kgc2F2aW5nIHRvIGRpc2suIHRoaXMgdGFrZXMgbG9uZyBlbm91Z2ggdGhhdCBhbm90aGVyIGF1dG8gc2F2ZVxuXHRcdC8vICAgICAgICAgICAgIGtpY2tzIGluLlxuXHRcdC8vIFNjZW5hcmlvIEI6IHNhdmUgaXMgdmVyeSBzbG93IChlLmcuIG5ldHdvcmsgc2hhcmUpIGFuZCB0aGUgdXNlciBtYW5hZ2VzIHRvIGNoYW5nZSB0aGUgYnVmZmVyIGFuZCB0cmlnZ2VyIGFub3RoZXIgc2F2ZVxuXHRcdC8vICAgICAgICAgICAgIHdoaWxlIHRoZSBmaXJzdCBzYXZlIGhhcyBub3QgcmV0dXJuZWQgeWV0LlxuXHRcdC8vXG5cdFx0aWYgKHRoaXMuc2F2ZVNlcXVlbnRpYWxpemVyLmlzUnVubmluZygpKSB7XG5cdFx0XHR0aGlzLnRyYWNlKGBkb1NhdmUoJHt2ZXJzaW9uSWR9KSAtIGV4aXQgLSBiZWNhdXNlIGJ1c3kgc2F2aW5nYCk7XG5cblx0XHRcdC8vIEluZGljYXRlIHRvIHRoZSBzYXZlIHNlcXVlbnRpYWxpemVyIHRoYXQgd2Ugd2FudCB0b1xuXHRcdFx0Ly8gY2FuY2VsIHRoZSBydW5uaW5nIG9wZXJhdGlvbiBzbyB0aGF0IG91cnMgY2FuIHJ1blxuXHRcdFx0Ly8gYmVmb3JlIHRoZSBydW5uaW5nIG9uZSBmaW5pc2hlcy5cblx0XHRcdC8vIEN1cnJlbnRseSB0aGlzIHdpbGwgdHJ5IHRvIGNhbmNlbCBydW5uaW5nIHNhdmVcblx0XHRcdC8vIHBhcnRpY2lwYW50cyBidXQgbmV2ZXIgYSBydW5uaW5nIHNhdmUuXG5cdFx0XHR0aGlzLnNhdmVTZXF1ZW50aWFsaXplci5jYW5jZWxSdW5uaW5nKCk7XG5cblx0XHRcdC8vIFF1ZXVlIHRoaXMgYXMgdGhlIHVwY29taW5nIHNhdmUgYW5kIHJldHVyblxuXHRcdFx0cmV0dXJuIHRoaXMuc2F2ZVNlcXVlbnRpYWxpemVyLnF1ZXVlKCgpID0+IHRoaXMuZG9TYXZlKG9wdGlvbnMpKTtcblx0XHR9XG5cblx0XHQvLyBQdXNoIGFsbCBlZGl0IG9wZXJhdGlvbnMgdG8gdGhlIHVuZG8gc3RhY2sgc28gdGhhdCB0aGUgdXNlciBoYXMgYSBjaGFuY2UgdG9cblx0XHQvLyBDdHJsK1ogYmFjayB0byB0aGUgc2F2ZWQgdmVyc2lvbi5cblx0XHRpZiAodGhpcy5pc1Jlc29sdmVkKCkpIHtcblx0XHRcdHRoaXMudGV4dEVkaXRvck1vZGVsLnB1c2hTdGFja0VsZW1lbnQoKTtcblx0XHR9XG5cblx0XHRjb25zdCBzYXZlQ2FuY2VsbGF0aW9uID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cblx0XHRyZXR1cm4gdGhpcy5wcm9ncmVzc1NlcnZpY2Uud2l0aFByb2dyZXNzKHtcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnc2F2ZVBhcnRpY2lwYW50cycsIFwiU2F2aW5nICd7MH0nXCIsIHRoaXMubmFtZSksXG5cdFx0XHRsb2NhdGlvbjogUHJvZ3Jlc3NMb2NhdGlvbi5XaW5kb3csXG5cdFx0XHRjYW5jZWxsYWJsZTogdHJ1ZSxcblx0XHRcdGRlbGF5OiB0aGlzLmlzRGlydHkoKSA/IDMwMDAgOiA1MDAwXG5cdFx0fSwgcHJvZ3Jlc3MgPT4ge1xuXHRcdFx0cmV0dXJuIHRoaXMuZG9TYXZlU2VxdWVudGlhbCh2ZXJzaW9uSWQsIG9wdGlvbnMsIHByb2dyZXNzLCBzYXZlQ2FuY2VsbGF0aW9uKTtcblx0XHR9LCAoKSA9PiB7XG5cdFx0XHRzYXZlQ2FuY2VsbGF0aW9uLmNhbmNlbCgpO1xuXHRcdH0pLmZpbmFsbHkoKCkgPT4ge1xuXHRcdFx0c2F2ZUNhbmNlbGxhdGlvbi5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGRvU2F2ZVNlcXVlbnRpYWwodmVyc2lvbklkOiBudW1iZXIsIG9wdGlvbnM6IElUZXh0RmlsZVNhdmVBc09wdGlvbnMsIHByb2dyZXNzOiBJUHJvZ3Jlc3M8SVByb2dyZXNzU3RlcD4sIHNhdmVDYW5jZWxsYXRpb246IENhbmNlbGxhdGlvblRva2VuU291cmNlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuc2F2ZVNlcXVlbnRpYWxpemVyLnJ1bih2ZXJzaW9uSWQsIChhc3luYyAoKSA9PiB7XG5cblx0XHRcdC8vIEEgc2F2ZSBwYXJ0aWNpcGFudCBjYW4gc3RpbGwgY2hhbmdlIHRoZSBtb2RlbCBub3cgYW5kIHNpbmNlIHdlIGFyZSBzbyBjbG9zZSB0byBzYXZpbmdcblx0XHRcdC8vIHdlIGRvIG5vdCB3YW50IHRvIHRyaWdnZXIgYW5vdGhlciBhdXRvIHNhdmUgb3Igc2ltaWxhciwgc28gd2UgYmxvY2sgdGhpc1xuXHRcdFx0Ly8gSW4gYWRkaXRpb24gd2UgdXBkYXRlIG91ciB2ZXJzaW9uIHJpZ2h0IGFmdGVyIGluIGNhc2UgaXQgY2hhbmdlZCBiZWNhdXNlIG9mIGEgbW9kZWwgY2hhbmdlXG5cdFx0XHQvL1xuXHRcdFx0Ly8gU2F2ZSBwYXJ0aWNpcGFudHMgY2FuIGFsc28gYmUgc2tpcHBlZCB0aHJvdWdoIEFQSS5cblx0XHRcdGlmICh0aGlzLmlzUmVzb2x2ZWQoKSAmJiAhb3B0aW9ucy5za2lwU2F2ZVBhcnRpY2lwYW50cykge1xuXHRcdFx0XHR0cnkge1xuXG5cdFx0XHRcdFx0Ly8gTWVhc3VyZSB0aGUgdGltZSBpdCB0b29rIGZyb20gdGhlIGxhc3QgdW5kby9yZWRvIG9wZXJhdGlvbiB0byB0aGlzIHNhdmUuIElmIHRoaXNcblx0XHRcdFx0XHQvLyB0aW1lIGlzIGJlbG93IGBVTkRPX1JFRE9fU0FWRV9QQVJUSUNJUEFOVFNfVEhST1RUTEVfVEhSRVNIT0xEYCwgd2UgbWFrZSBzdXJlIHRvXG5cdFx0XHRcdFx0Ly8gZGVsYXkgdGhlIHNhdmUgcGFydGljaXBhbnQgZm9yIHRoZSByZW1haW5pbmcgdGltZSBpZiB0aGUgcmVhc29uIGlzIGF1dG8gc2F2ZS5cblx0XHRcdFx0XHQvL1xuXHRcdFx0XHRcdC8vIFRoaXMgZml4ZXMgdGhlIGZvbGxvd2luZyBpc3N1ZTpcblx0XHRcdFx0XHQvLyAtIHRoZSB1c2VyIGhhcyBjb25maWd1cmVkIGF1dG8gc2F2ZSB3aXRoIGRlbGF5IG9mIDEwMG1zIG9yIHNob3J0ZXJcblx0XHRcdFx0XHQvLyAtIHRoZSB1c2VyIGhhcyBhIHNhdmUgcGFydGljaXBhbnQgZW5hYmxlZCB0aGF0IG1vZGlmaWVzIHRoZSBmaWxlIG9uIGVhY2ggc2F2ZVxuXHRcdFx0XHRcdC8vIC0gdGhlIHVzZXIgdHlwZXMgaW50byB0aGUgZmlsZSBhbmQgdGhlIGZpbGUgZ2V0cyBzYXZlZFxuXHRcdFx0XHRcdC8vIC0gdGhlIHVzZXIgdHJpZ2dlcnMgdW5kbyBvcGVyYXRpb25cblx0XHRcdFx0XHQvLyAtIHRoaXMgd2lsbCB1bmRvIHRoZSBzYXZlIHBhcnRpY2lwYW50IGNoYW5nZSBidXQgdHJpZ2dlciB0aGUgc2F2ZSBwYXJ0aWNpcGFudCByaWdodCBhZnRlclxuXHRcdFx0XHRcdC8vIC0gdGhlIHVzZXIgaGFzIG5vIGNoYW5jZSB0byB1bmRvIG92ZXIgdGhlIHNhdmUgcGFydGljaXBhbnRcblx0XHRcdFx0XHQvL1xuXHRcdFx0XHRcdC8vIFJlcG9ydGVkIGFzOiBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTAyNTQyXG5cdFx0XHRcdFx0aWYgKG9wdGlvbnMucmVhc29uID09PSBTYXZlUmVhc29uLkFVVE8gJiYgdHlwZW9mIHRoaXMubGFzdE1vZGVsQ29udGVudENoYW5nZUZyb21VbmRvUmVkbyA9PT0gJ251bWJlcicpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHRpbWVGcm9tVW5kb1JlZG9Ub1NhdmUgPSBEYXRlLm5vdygpIC0gdGhpcy5sYXN0TW9kZWxDb250ZW50Q2hhbmdlRnJvbVVuZG9SZWRvO1xuXHRcdFx0XHRcdFx0aWYgKHRpbWVGcm9tVW5kb1JlZG9Ub1NhdmUgPCBUZXh0RmlsZUVkaXRvck1vZGVsLlVORE9fUkVET19TQVZFX1BBUlRJQ0lQQU5UU19BVVRPX1NBVkVfVEhST1RUTEVfVEhSRVNIT0xEKSB7XG5cdFx0XHRcdFx0XHRcdGF3YWl0IHRpbWVvdXQoVGV4dEZpbGVFZGl0b3JNb2RlbC5VTkRPX1JFRE9fU0FWRV9QQVJUSUNJUEFOVFNfQVVUT19TQVZFX1RIUk9UVExFX1RIUkVTSE9MRCAtIHRpbWVGcm9tVW5kb1JlZG9Ub1NhdmUpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vIFJ1biBzYXZlIHBhcnRpY2lwYW50cyB1bmxlc3Mgc2F2ZSB3YXMgY2FuY2VsbGVkIG1lYW53aGlsZVxuXHRcdFx0XHRcdGlmICghc2F2ZUNhbmNlbGxhdGlvbi50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdFx0dGhpcy5pZ25vcmVTYXZlRnJvbVNhdmVQYXJ0aWNpcGFudHMgPSB0cnVlO1xuXHRcdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdFx0YXdhaXQgdGhpcy50ZXh0RmlsZVNlcnZpY2UuZmlsZXMucnVuU2F2ZVBhcnRpY2lwYW50cyh0aGlzLCB7IHJlYXNvbjogb3B0aW9ucy5yZWFzb24gPz8gU2F2ZVJlYXNvbi5FWFBMSUNJVCwgc2F2ZWRGcm9tOiBvcHRpb25zLmZyb20gfSwgcHJvZ3Jlc3MsIHNhdmVDYW5jZWxsYXRpb24udG9rZW4pO1xuXHRcdFx0XHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdFx0XHRcdGlmIChpc0NhbmNlbGxhdGlvbkVycm9yKGVycikgJiYgIXNhdmVDYW5jZWxsYXRpb24udG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0XHRcdFx0XHQvLyBwYXJ0aWNpcGFudCB3YW50cyB0byBjYW5jZWwgdGhpcyBvcGVyYXRpb25cblx0XHRcdFx0XHRcdFx0XHRzYXZlQ2FuY2VsbGF0aW9uLmNhbmNlbCgpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLmlnbm9yZVNhdmVGcm9tU2F2ZVBhcnRpY2lwYW50cyA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoYFt0ZXh0IGZpbGUgbW9kZWxdIHJ1blNhdmVQYXJ0aWNpcGFudHMoJHt2ZXJzaW9uSWR9KSAtIHJlc3VsdGVkIGluIGFuIGVycm9yOiAke2Vycm9yLnRvU3RyaW5nKCl9YCwgdGhpcy5yZXNvdXJjZS50b1N0cmluZygpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBJdCBpcyBwb3NzaWJsZSB0aGF0IGEgc3Vic2VxdWVudCBzYXZlIGlzIGNhbmNlbGxpbmcgdGhpc1xuXHRcdFx0Ly8gcnVubmluZyBzYXZlLiBBcyBzdWNoIHdlIHJldHVybiBlYXJseSB3aGVuIHdlIGRldGVjdCB0aGF0XG5cdFx0XHQvLyBIb3dldmVyLCB3ZSBkbyBub3QgcGFzcyB0aGUgdG9rZW4gaW50byB0aGUgZmlsZSBzZXJ2aWNlXG5cdFx0XHQvLyBiZWNhdXNlIHRoYXQgaXMgYW4gYXRvbWljIG9wZXJhdGlvbiBjdXJyZW50bHkgd2l0aG91dFxuXHRcdFx0Ly8gY2FuY2VsbGF0aW9uIHN1cHBvcnQsIHNvIHdlIGRpc3Bvc2UgdGhlIGNhbmNlbGxhdGlvbiBpZlxuXHRcdFx0Ly8gaXQgd2FzIG5vdCBjYW5jZWxsZWQgeWV0LlxuXHRcdFx0aWYgKHNhdmVDYW5jZWxsYXRpb24udG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0c2F2ZUNhbmNlbGxhdGlvbi5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFdlIGhhdmUgdG8gcHJvdGVjdCBhZ2FpbnN0IGJlaW5nIGRpc3Bvc2VkIGF0IHRoaXMgcG9pbnQuIEl0IGNvdWxkIGJlIHRoYXQgdGhlIHNhdmUoKSBvcGVyYXRpb25cblx0XHRcdC8vIHdhcyB0cmlnZ2VyZCBmb2xsb3dlZCBieSBhIGRpc3Bvc2UoKSBvcGVyYXRpb24gcmlnaHQgYWZ0ZXIgd2l0aG91dCB3YWl0aW5nLiBUeXBpY2FsbHkgd2UgY2Fubm90XG5cdFx0XHQvLyBiZSBkaXNwb3NlZCBpZiB3ZSBhcmUgZGlydHksIGJ1dCBpZiB3ZSBhcmUgbm90IGRpcnR5LCBzYXZlKCkgYW5kIGRpc3Bvc2UoKSBjYW4gc3RpbGwgYmUgdHJpZ2dlcmVkXG5cdFx0XHQvLyBvbmUgYWZ0ZXIgdGhlIG90aGVyIHdpdGhvdXQgd2FpdGluZyBmb3IgdGhlIHNhdmUoKSB0byBjb21wbGV0ZS4gSWYgd2UgYXJlIGRpc3Bvc2VkKCksIHdlIHJpc2tcblx0XHRcdC8vIHNhdmluZyBjb250ZW50cyB0byBkaXNrIHRoYXQgYXJlIHN0YWxlIChzZWUgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzUwOTQyKS5cblx0XHRcdC8vIFRvIGZpeCB0aGlzIGlzc3VlLCB3ZSB3aWxsIG5vdCBzdG9yZSB0aGUgY29udGVudHMgdG8gZGlzayB3aGVuIHdlIGdvdCBkaXNwb3NlZC5cblx0XHRcdGlmICh0aGlzLmlzRGlzcG9zZWQoKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIFdlIHJlcXVpcmUgYSByZXNvbHZlZCBtb2RlbCBmcm9tIHRoaXMgcG9pbnQgb24sIHNpbmNlIHdlIGFyZSBhYm91dCB0byB3cml0ZSBkYXRhIHRvIGRpc2suXG5cdFx0XHRpZiAoIXRoaXMuaXNSZXNvbHZlZCgpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly8gdXBkYXRlIHZlcnNpb25JZCB3aXRoIGl0cyBuZXcgdmFsdWUgKGlmIHByZS1zYXZlIGNoYW5nZXMgaGFwcGVuZWQpXG5cdFx0XHR2ZXJzaW9uSWQgPSB0aGlzLnZlcnNpb25JZDtcblxuXHRcdFx0Ly8gQ2xlYXIgZXJyb3IgZmxhZyBzaW5jZSB3ZSBhcmUgdHJ5aW5nIHRvIHNhdmUgYWdhaW5cblx0XHRcdHRoaXMuaW5FcnJvck1vZGUgPSBmYWxzZTtcblxuXHRcdFx0Ly8gU2F2ZSB0byBEaXNrLiBXZSBtYXJrIHRoZSBzYXZlIG9wZXJhdGlvbiBhcyBjdXJyZW50bHkgcnVubmluZyB3aXRoXG5cdFx0XHQvLyB0aGUgbGF0ZXN0IHZlcnNpb25JZCBiZWNhdXNlIGl0IG1pZ2h0IGhhdmUgY2hhbmdlZCBmcm9tIGEgc2F2ZVxuXHRcdFx0Ly8gcGFydGljaXBhbnQgdHJpZ2dlcmluZ1xuXHRcdFx0cHJvZ3Jlc3MucmVwb3J0KHsgbWVzc2FnZTogbG9jYWxpemUoJ3NhdmVUZXh0RmlsZScsIFwiV3JpdGluZyBpbnRvIGZpbGUuLi5cIikgfSk7XG5cdFx0XHR0aGlzLnRyYWNlKGBkb1NhdmUoJHt2ZXJzaW9uSWR9KSAtIGJlZm9yZSB3cml0ZSgpYCk7XG5cdFx0XHRjb25zdCBsYXN0UmVzb2x2ZWRGaWxlU3RhdCA9IGFzc2VydElzRGVmaW5lZCh0aGlzLmxhc3RSZXNvbHZlZEZpbGVTdGF0KTtcblx0XHRcdGNvbnN0IHJlc29sdmVkVGV4dEZpbGVFZGl0b3JNb2RlbCA9IHRoaXM7XG5cdFx0XHRyZXR1cm4gdGhpcy5zYXZlU2VxdWVudGlhbGl6ZXIucnVuKHZlcnNpb25JZCwgKGFzeW5jICgpID0+IHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRjb25zdCBzdGF0ID0gYXdhaXQgdGhpcy50ZXh0RmlsZVNlcnZpY2Uud3JpdGUobGFzdFJlc29sdmVkRmlsZVN0YXQucmVzb3VyY2UsIHJlc29sdmVkVGV4dEZpbGVFZGl0b3JNb2RlbC5jcmVhdGVTbmFwc2hvdCgpLCB7XG5cdFx0XHRcdFx0XHRtdGltZTogbGFzdFJlc29sdmVkRmlsZVN0YXQubXRpbWUsXG5cdFx0XHRcdFx0XHRlbmNvZGluZzogdGhpcy5nZXRFbmNvZGluZygpLFxuXHRcdFx0XHRcdFx0ZXRhZzogKG9wdGlvbnMuaWdub3JlTW9kaWZpZWRTaW5jZSB8fCAhdGhpcy5maWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLnByZXZlbnRTYXZlQ29uZmxpY3RzKGxhc3RSZXNvbHZlZEZpbGVTdGF0LnJlc291cmNlLCByZXNvbHZlZFRleHRGaWxlRWRpdG9yTW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpKSkgPyBFVEFHX0RJU0FCTEVEIDogbGFzdFJlc29sdmVkRmlsZVN0YXQuZXRhZyxcblx0XHRcdFx0XHRcdHVubG9jazogb3B0aW9ucy53cml0ZVVubG9jayxcblx0XHRcdFx0XHRcdHdyaXRlRWxldmF0ZWQ6IG9wdGlvbnMud3JpdGVFbGV2YXRlZFxuXHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0dGhpcy5oYW5kbGVTYXZlU3VjY2VzcyhzdGF0LCB2ZXJzaW9uSWQsIG9wdGlvbnMpO1xuXHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdHRoaXMuaGFuZGxlU2F2ZUVycm9yKGVycm9yLCB2ZXJzaW9uSWQsIG9wdGlvbnMpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSgpKTtcblx0XHR9KSgpLCAoKSA9PiBzYXZlQ2FuY2VsbGF0aW9uLmNhbmNlbCgpKTtcblx0fVxuXG5cdHByaXZhdGUgaGFuZGxlU2F2ZVN1Y2Nlc3Moc3RhdDogSUZpbGVTdGF0V2l0aE1ldGFkYXRhLCB2ZXJzaW9uSWQ6IG51bWJlciwgb3B0aW9uczogSVRleHRGaWxlU2F2ZUFzT3B0aW9ucyk6IHZvaWQge1xuXG5cdFx0Ly8gVXBkYXRlZCByZXNvbHZlZCBzdGF0IHdpdGggdXBkYXRlZCBzdGF0XG5cdFx0dGhpcy51cGRhdGVMYXN0UmVzb2x2ZWRGaWxlU3RhdChzdGF0KTtcblxuXHRcdC8vIFVwZGF0ZSBkaXJ0eSBzdGF0ZSB1bmxlc3MgbW9kZWwgaGFzIGNoYW5nZWQgbWVhbndoaWxlXG5cdFx0aWYgKHZlcnNpb25JZCA9PT0gdGhpcy52ZXJzaW9uSWQpIHtcblx0XHRcdHRoaXMudHJhY2UoYGhhbmRsZVNhdmVTdWNjZXNzKCR7dmVyc2lvbklkfSkgLSBzZXR0aW5nIGRpcnR5IHRvIGZhbHNlIGJlY2F1c2UgdmVyc2lvbklkIGRpZCBub3QgY2hhbmdlYCk7XG5cdFx0XHR0aGlzLnNldERpcnR5KGZhbHNlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy50cmFjZShgaGFuZGxlU2F2ZVN1Y2Nlc3MoJHt2ZXJzaW9uSWR9KSAtIG5vdCBzZXR0aW5nIGRpcnR5IHRvIGZhbHNlIGJlY2F1c2UgdmVyc2lvbklkIGRpZCBjaGFuZ2UgbWVhbndoaWxlYCk7XG5cdFx0fVxuXG5cdFx0Ly8gVXBkYXRlIG9ycGhhbiBzdGF0ZSBnaXZlbiBzYXZlIHdhcyBzdWNjZXNzZnVsXG5cdFx0dGhpcy5zZXRPcnBoYW5lZChmYWxzZSk7XG5cblx0XHQvLyBFbWl0IFNhdmUgRXZlbnRcblx0XHR0aGlzLl9vbkRpZFNhdmUuZmlyZSh7IHJlYXNvbjogb3B0aW9ucy5yZWFzb24sIHN0YXQsIHNvdXJjZTogb3B0aW9ucy5zb3VyY2UgfSk7XG5cdH1cblxuXHRwcml2YXRlIGhhbmRsZVNhdmVFcnJvcihlcnJvcjogRXJyb3IsIHZlcnNpb25JZDogbnVtYmVyLCBvcHRpb25zOiBJVGV4dEZpbGVTYXZlQXNPcHRpb25zKTogdm9pZCB7XG5cdFx0KG9wdGlvbnMuaWdub3JlRXJyb3JIYW5kbGVyID8gdGhpcy5sb2dTZXJ2aWNlLnRyYWNlIDogdGhpcy5sb2dTZXJ2aWNlLmVycm9yKS5hcHBseSh0aGlzLmxvZ1NlcnZpY2UsIFtgW3RleHQgZmlsZSBtb2RlbF0gaGFuZGxlU2F2ZUVycm9yKCR7dmVyc2lvbklkfSkgLSBleGl0IC0gcmVzdWx0ZWQgaW4gYSBzYXZlIGVycm9yOiAke2Vycm9yLnRvU3RyaW5nKCl9YCwgdGhpcy5yZXNvdXJjZS50b1N0cmluZygpXSk7XG5cblx0XHQvLyBSZXR1cm4gZWFybHkgaWYgdGhlIHNhdmUoKSBjYWxsIHdhcyBtYWRlIGFza2luZyB0b1xuXHRcdC8vIGhhbmRsZSB0aGUgc2F2ZSBlcnJvciBpdHNlbGYuXG5cdFx0aWYgKG9wdGlvbnMuaWdub3JlRXJyb3JIYW5kbGVyKSB7XG5cdFx0XHR0aHJvdyBlcnJvcjtcblx0XHR9XG5cblx0XHQvLyBJbiBhbnkgY2FzZSBvZiBhbiBlcnJvciwgd2UgbWFyayB0aGUgbW9kZWwgYXMgZGlydHkgdG8gcHJldmVudCBkYXRhIGxvc3Ncblx0XHQvLyBJdCBjb3VsZCBiZSBwb3NzaWJsZSB0aGF0IHRoZSB3cml0ZSBjb3JydXB0ZWQgdGhlIGZpbGUgb24gZGlzayAoZS5nLiB3aGVuXG5cdFx0Ly8gYW4gZXJyb3IgaGFwcGVuZWQgYWZ0ZXIgdHJ1bmNhdGluZyB0aGUgZmlsZSkgYW5kIGFzIHN1Y2ggd2Ugd2FudCB0byBwcmVzZXJ2ZVxuXHRcdC8vIHRoZSBtb2RlbCBjb250ZW50cyB0byBwcmV2ZW50IGRhdGEgbG9zcy5cblx0XHR0aGlzLnNldERpcnR5KHRydWUpO1xuXG5cdFx0Ly8gRmxhZyBhcyBlcnJvciBzdGF0ZSBpbiB0aGUgbW9kZWxcblx0XHR0aGlzLmluRXJyb3JNb2RlID0gdHJ1ZTtcblxuXHRcdC8vIExvb2sgb3V0IGZvciBhIHNhdmUgY29uZmxpY3Rcblx0XHRpZiAoKDxGaWxlT3BlcmF0aW9uRXJyb3I+ZXJyb3IpLmZpbGVPcGVyYXRpb25SZXN1bHQgPT09IEZpbGVPcGVyYXRpb25SZXN1bHQuRklMRV9NT0RJRklFRF9TSU5DRSkge1xuXHRcdFx0dGhpcy5pbkNvbmZsaWN0TW9kZSA9IHRydWU7XG5cdFx0fVxuXG5cdFx0Ly8gU2hvdyB0byB1c2VyXG5cdFx0dGhpcy50ZXh0RmlsZVNlcnZpY2UuZmlsZXMuc2F2ZUVycm9ySGFuZGxlci5vblNhdmVFcnJvcihlcnJvciwgdGhpcywgb3B0aW9ucyk7XG5cblx0XHQvLyBFbWl0IGFzIGV2ZW50XG5cdFx0dGhpcy5fb25EaWRTYXZlRXJyb3IuZmlyZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVTYXZlZFZlcnNpb25JZCgpOiB2b2lkIHtcblx0XHQvLyB3ZSByZW1lbWJlciB0aGUgbW9kZWxzIGFsdGVybmF0ZSB2ZXJzaW9uIGlkIHRvIHJlbWVtYmVyIHdoZW4gdGhlIHZlcnNpb25cblx0XHQvLyBvZiB0aGUgbW9kZWwgbWF0Y2hlcyB3aXRoIHRoZSBzYXZlZCB2ZXJzaW9uIG9uIGRpc2suIHdlIG5lZWQgdG8ga2VlcCB0aGlzXG5cdFx0Ly8gaW4gb3JkZXIgdG8gZmluZCBvdXQgaWYgdGhlIG1vZGVsIGNoYW5nZWQgYmFjayB0byBhIHNhdmVkIHZlcnNpb24gKGUuZy5cblx0XHQvLyB3aGVuIHVuZG9pbmcgbG9uZyBlbm91Z2ggdG8gcmVhY2ggdG8gYSB2ZXJzaW9uIHRoYXQgaXMgc2F2ZWQgYW5kIHRoZW4gdG9cblx0XHQvLyBjbGVhciB0aGUgZGlydHkgZmxhZylcblx0XHRpZiAodGhpcy5pc1Jlc29sdmVkKCkpIHtcblx0XHRcdHRoaXMuYnVmZmVyU2F2ZWRWZXJzaW9uSWQgPSB0aGlzLnRleHRFZGl0b3JNb2RlbC5nZXRBbHRlcm5hdGl2ZVZlcnNpb25JZCgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlTGFzdFJlc29sdmVkRmlsZVN0YXQobmV3RmlsZVN0YXQ6IElGaWxlU3RhdFdpdGhNZXRhZGF0YSk6IHZvaWQge1xuXHRcdGNvbnN0IG9sZFJlYWRvbmx5ID0gdGhpcy5pc1JlYWRvbmx5KCk7XG5cblx0XHQvLyBGaXJzdCByZXNvbHZlIC0ganVzdCB0YWtlXG5cdFx0aWYgKCF0aGlzLmxhc3RSZXNvbHZlZEZpbGVTdGF0KSB7XG5cdFx0XHR0aGlzLmxhc3RSZXNvbHZlZEZpbGVTdGF0ID0gbmV3RmlsZVN0YXQ7XG5cdFx0fVxuXG5cdFx0Ly8gU3Vic2VxdWVudCByZXNvbHZlIC0gbWFrZSBzdXJlIHRoYXQgd2Ugb25seSBhc3NpZ24gaXQgaWYgdGhlIG10aW1lIGlzIGVxdWFsIG9yIGhhcyBhZHZhbmNlZC5cblx0XHQvLyBUaGlzIHByZXZlbnRzIHJhY2UgY29uZGl0aW9ucyBmcm9tIHJlc29sdmluZyBhbmQgc2F2aW5nLiBJZiBhIHNhdmUgY29tZXMgaW4gbGF0ZSBhZnRlciBhIHJldmVydFxuXHRcdC8vIHdhcyBjYWxsZWQsIHRoZSBtdGltZSBjb3VsZCBiZSBvdXQgb2Ygc3luYy5cblx0XHRlbHNlIGlmICh0aGlzLmxhc3RSZXNvbHZlZEZpbGVTdGF0Lm10aW1lIDw9IG5ld0ZpbGVTdGF0Lm10aW1lKSB7XG5cdFx0XHR0aGlzLmxhc3RSZXNvbHZlZEZpbGVTdGF0ID0gbmV3RmlsZVN0YXQ7XG5cdFx0fVxuXG5cdFx0Ly8gSW4gYWxsIG90aGVyIGNhc2VzIHVwZGF0ZSBvbmx5IHRoZSByZWFkb25seSBhbmQgbG9ja2VkIGZsYWdzXG5cdFx0ZWxzZSB7XG5cdFx0XHR0aGlzLmxhc3RSZXNvbHZlZEZpbGVTdGF0ID0geyAuLi50aGlzLmxhc3RSZXNvbHZlZEZpbGVTdGF0LCByZWFkb25seTogbmV3RmlsZVN0YXQucmVhZG9ubHksIGxvY2tlZDogbmV3RmlsZVN0YXQubG9ja2VkIH07XG5cdFx0fVxuXG5cdFx0Ly8gU2lnbmFsIHRoYXQgdGhlIHJlYWRvbmx5IHN0YXRlIGNoYW5nZWRcblx0XHRpZiAodGhpcy5pc1JlYWRvbmx5KCkgIT09IG9sZFJlYWRvbmx5KSB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVJlYWRvbmx5LmZpcmUoKTtcblx0XHR9XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHRoYXNTdGF0ZShzdGF0ZTogVGV4dEZpbGVFZGl0b3JNb2RlbFN0YXRlKTogYm9vbGVhbiB7XG5cdFx0c3dpdGNoIChzdGF0ZSkge1xuXHRcdFx0Y2FzZSBUZXh0RmlsZUVkaXRvck1vZGVsU3RhdGUuQ09ORkxJQ1Q6XG5cdFx0XHRcdHJldHVybiB0aGlzLmluQ29uZmxpY3RNb2RlO1xuXHRcdFx0Y2FzZSBUZXh0RmlsZUVkaXRvck1vZGVsU3RhdGUuRElSVFk6XG5cdFx0XHRcdHJldHVybiB0aGlzLmRpcnR5O1xuXHRcdFx0Y2FzZSBUZXh0RmlsZUVkaXRvck1vZGVsU3RhdGUuRVJST1I6XG5cdFx0XHRcdHJldHVybiB0aGlzLmluRXJyb3JNb2RlO1xuXHRcdFx0Y2FzZSBUZXh0RmlsZUVkaXRvck1vZGVsU3RhdGUuT1JQSEFOOlxuXHRcdFx0XHRyZXR1cm4gdGhpcy5pbk9ycGhhbk1vZGU7XG5cdFx0XHRjYXNlIFRleHRGaWxlRWRpdG9yTW9kZWxTdGF0ZS5QRU5ESU5HX1NBVkU6XG5cdFx0XHRcdHJldHVybiB0aGlzLnNhdmVTZXF1ZW50aWFsaXplci5pc1J1bm5pbmcoKTtcblx0XHRcdGNhc2UgVGV4dEZpbGVFZGl0b3JNb2RlbFN0YXRlLlNBVkVEOlxuXHRcdFx0XHRyZXR1cm4gIXRoaXMuZGlydHk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgam9pblN0YXRlKHN0YXRlOiBUZXh0RmlsZUVkaXRvck1vZGVsU3RhdGUuUEVORElOR19TQVZFKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuc2F2ZVNlcXVlbnRpYWxpemVyLnJ1bm5pbmc7XG5cdH1cblxuXHRvdmVycmlkZSBnZXRMYW5ndWFnZUlkKHRoaXM6IElSZXNvbHZlZFRleHRGaWxlRWRpdG9yTW9kZWwpOiBzdHJpbmc7XG5cdG92ZXJyaWRlIGdldExhbmd1YWdlSWQoKTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRvdmVycmlkZSBnZXRMYW5ndWFnZUlkKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHRoaXMudGV4dEVkaXRvck1vZGVsKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy50ZXh0RWRpdG9yTW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLnByZWZlcnJlZExhbmd1YWdlSWQ7XG5cdH1cblxuXHQvLyNyZWdpb24gRW5jb2RpbmdcblxuXHRwcml2YXRlIGFzeW5jIG9uTWF5YmVTaG91bGRDaGFuZ2VFbmNvZGluZygpOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdC8vIFRoaXMgaXMgYSBiaXQgb2YgYSBoYWNrIGJ1dCB0aGVyZSBpcyBhIG5hcnJvdyBjYXNlIHdoZXJlXG5cdFx0Ly8gcGVyLWxhbmd1YWdlIGNvbmZpZ3VyZWQgZW5jb2RpbmdzIGFyZSBub3Qgd29ya2luZzpcblx0XHQvL1xuXHRcdC8vIE9uIHN0YXJ0dXAgd2UgbWF5IG5vdCB5ZXQgaGF2ZSBhbGwgbGFuZ3VhZ2VzIHJlc29sdmVkIHNvXG5cdFx0Ly8gd2UgcGljayBhIHdyb25nIGVuY29kaW5nLiBXZSBuZXZlciB1c2VkIHRvIHJlLWFwcGx5IHRoZVxuXHRcdC8vIGVuY29kaW5nIHdoZW4gdGhlIGxhbmd1YWdlIHdhcyB0aGVuIHJlc29sdmVkLCBiZWNhdXNlIHRoYXRcblx0XHQvLyBpcyBhbiBvcGVyYXRpb24gdGhhdCBpcyB3aWxsIGhhdmUgdG8gZmV0Y2ggdGhlIGNvbnRlbnRzXG5cdFx0Ly8gYWdhaW4gZnJvbSBkaXNrLlxuXHRcdC8vXG5cdFx0Ly8gVG8gbWl0aWdhdGUgdGhpcyBpc3N1ZSwgd2hlbiB3ZSBkZXRlY3QgdGhlIG1vZGVsIGxhbmd1YWdlXG5cdFx0Ly8gY2hhbmdlcywgd2Ugc2VlIGlmIHRoZXJlIGlzIGEgc3BlY2lmaWMgZW5jb2RpbmcgY29uZmlndXJlZFxuXHRcdC8vIGZvciB0aGUgbmV3IGxhbmd1YWdlIGFuZCBhcHBseSBpdCwgb25seSBpZiB0aGUgbW9kZWwgaXNcblx0XHQvLyBub3QgZGlydHkgYW5kIG9ubHkgaWYgdGhlIGVuY29kaW5nIHdhcyBub3QgZXhwbGljaXRseSBzZXQuXG5cdFx0Ly9cblx0XHQvLyAoc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMjc5MzYpXG5cblx0XHRpZiAodGhpcy5oYXNFbmNvZGluZ1NldEV4cGxpY2l0bHkpIHtcblx0XHRcdHRoaXMudHJhY2UoJ29uTWF5YmVTaG91bGRDaGFuZ2VFbmNvZGluZygpIC0gaWdub3JpbmcgYmVjYXVzZSBlbmNvZGluZyB3YXMgc2V0IGV4cGxpY2l0bHknKTtcblxuXHRcdFx0cmV0dXJuOyAvLyBuZXZlciBjaGFuZ2UgdGhlIHVzZXIncyBjaG9pY2Ugb2YgZW5jb2Rpbmdcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jb250ZW50RW5jb2RpbmcgPT09IFVURjhfd2l0aF9ib20gfHwgdGhpcy5jb250ZW50RW5jb2RpbmcgPT09IFVURjE2YmUgfHwgdGhpcy5jb250ZW50RW5jb2RpbmcgPT09IFVURjE2bGUpIHtcblx0XHRcdHRoaXMudHJhY2UoJ29uTWF5YmVTaG91bGRDaGFuZ2VFbmNvZGluZygpIC0gaWdub3JpbmcgYmVjYXVzZSBjb250ZW50IGVuY29kaW5nIGhhcyBhIEJPTScpO1xuXG5cdFx0XHRyZXR1cm47IC8vIG5ldmVyIGNoYW5nZSBhbiBlbmNvZGluZyB0aGF0IHdlIGNhbiBkZXRlY3QgMTAwJSB2aWEgQk9Nc1xuXHRcdH1cblxuXHRcdGNvbnN0IHsgZW5jb2RpbmcgfSA9IGF3YWl0IHRoaXMudGV4dEZpbGVTZXJ2aWNlLmVuY29kaW5nLmdldFByZWZlcnJlZFJlYWRFbmNvZGluZyh0aGlzLnJlc291cmNlKTtcblx0XHRpZiAodHlwZW9mIGVuY29kaW5nICE9PSAnc3RyaW5nJyB8fCAhdGhpcy5pc05ld0VuY29kaW5nKGVuY29kaW5nKSkge1xuXHRcdFx0dGhpcy50cmFjZShgb25NYXliZVNob3VsZENoYW5nZUVuY29kaW5nKCkgLSBpZ25vcmluZyBiZWNhdXNlIHByZWZlcnJlZCBlbmNvZGluZyAke2VuY29kaW5nfSBpcyBub3QgbmV3YCk7XG5cblx0XHRcdHJldHVybjsgLy8gcmV0dXJuIGVhcmx5IGlmIGVuY29kaW5nIGlzIGludmFsaWQgb3IgZGlkIG5vdCBjaGFuZ2Vcblx0XHR9XG5cblx0XHRpZiAodGhpcy5pc0RpcnR5KCkpIHtcblx0XHRcdHRoaXMudHJhY2UoJ29uTWF5YmVTaG91bGRDaGFuZ2VFbmNvZGluZygpIC0gaWdub3JpbmcgYmVjYXVzZSBtb2RlbCBpcyBkaXJ0eScpO1xuXG5cdFx0XHRyZXR1cm47IC8vIHJldHVybiBlYXJseSB0byBwcmV2ZW50IGFjY2lkZW50IHNhdmVzIGluIHRoaXMgY2FzZVxuXHRcdH1cblxuXHRcdHRoaXMubG9nU2VydmljZS5pbmZvKGBBZGp1c3RpbmcgZW5jb2RpbmcgYmFzZWQgb24gY29uZmlndXJlZCBsYW5ndWFnZSBvdmVycmlkZSB0byAnJHtlbmNvZGluZ30nIGZvciAke3RoaXMucmVzb3VyY2UudG9TdHJpbmcodHJ1ZSl9LmApO1xuXG5cdFx0Ly8gRm9yY2UgcmVzb2x2ZSB0byBwaWNrIHVwIHRoZSBuZXcgZW5jb2Rpbmdcblx0XHRyZXR1cm4gdGhpcy5mb3JjZVJlc29sdmVGcm9tRmlsZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBoYXNFbmNvZGluZ1NldEV4cGxpY2l0bHk6IGJvb2xlYW4gPSBmYWxzZTtcblxuXHRzZXRFbmNvZGluZyhlbmNvZGluZzogc3RyaW5nLCBtb2RlOiBFbmNvZGluZ01vZGUpOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdC8vIFJlbWVtYmVyIHRoYXQgYW4gZXhwbGljaXQgZW5jb2Rpbmcgd2FzIHNldFxuXHRcdHRoaXMuaGFzRW5jb2RpbmdTZXRFeHBsaWNpdGx5ID0gdHJ1ZTtcblxuXHRcdHJldHVybiB0aGlzLnNldEVuY29kaW5nSW50ZXJuYWwoZW5jb2RpbmcsIG1vZGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzZXRFbmNvZGluZ0ludGVybmFsKGVuY29kaW5nOiBzdHJpbmcsIG1vZGU6IEVuY29kaW5nTW9kZSk6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0Ly8gRW5jb2RlOiBTYXZlIHdpdGggZW5jb2Rpbmdcblx0XHRpZiAobW9kZSA9PT0gRW5jb2RpbmdNb2RlLkVuY29kZSkge1xuXHRcdFx0dGhpcy51cGRhdGVQcmVmZXJyZWRFbmNvZGluZyhlbmNvZGluZyk7XG5cblx0XHRcdC8vIFNhdmVcblx0XHRcdGlmICghdGhpcy5pc0RpcnR5KCkpIHtcblx0XHRcdFx0dGhpcy52ZXJzaW9uSWQrKzsgLy8gbmVlZHMgdG8gaW5jcmVtZW50IGJlY2F1c2Ugd2UgY2hhbmdlIHRoZSBtb2RlbCBwb3RlbnRpYWxseVxuXHRcdFx0XHR0aGlzLnNldERpcnR5KHRydWUpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIXRoaXMuaW5Db25mbGljdE1vZGUpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5zYXZlKHsgc291cmNlOiBUZXh0RmlsZUVkaXRvck1vZGVsLlRFWFRGSUxFX1NBVkVfRU5DT0RJTkdfU09VUkNFIH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIERlY29kZTogUmVzb2x2ZSB3aXRoIGVuY29kaW5nXG5cdFx0ZWxzZSB7XG5cdFx0XHRpZiAoIXRoaXMuaXNOZXdFbmNvZGluZyhlbmNvZGluZykpIHtcblx0XHRcdFx0cmV0dXJuOyAvLyByZXR1cm4gZWFybHkgaWYgdGhlIGVuY29kaW5nIGlzIGFscmVhZHkgdGhlIHNhbWVcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuaXNEaXJ0eSgpICYmICF0aGlzLmluQ29uZmxpY3RNb2RlKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuc2F2ZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnVwZGF0ZVByZWZlcnJlZEVuY29kaW5nKGVuY29kaW5nKTtcblxuXHRcdFx0YXdhaXQgdGhpcy5mb3JjZVJlc29sdmVGcm9tRmlsZSgpO1xuXHRcdH1cblx0fVxuXG5cdHVwZGF0ZVByZWZlcnJlZEVuY29kaW5nKGVuY29kaW5nOiBzdHJpbmcgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuaXNOZXdFbmNvZGluZyhlbmNvZGluZykpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnByZWZlcnJlZEVuY29kaW5nID0gZW5jb2Rpbmc7XG5cblx0XHQvLyBFbWl0XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VFbmNvZGluZy5maXJlKCk7XG5cdH1cblxuXHRwcml2YXRlIGlzTmV3RW5jb2RpbmcoZW5jb2Rpbmc6IHN0cmluZyB8IHVuZGVmaW5lZCk6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLnByZWZlcnJlZEVuY29kaW5nID09PSBlbmNvZGluZykge1xuXHRcdFx0cmV0dXJuIGZhbHNlOyAvLyByZXR1cm4gZWFybHkgaWYgdGhlIGVuY29kaW5nIGlzIGFscmVhZHkgdGhlIHNhbWVcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMucHJlZmVycmVkRW5jb2RpbmcgJiYgdGhpcy5jb250ZW50RW5jb2RpbmcgPT09IGVuY29kaW5nKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7IC8vIGFsc28gcmV0dXJuIGlmIHdlIGRvbid0IGhhdmUgYSBwcmVmZXJyZWQgZW5jb2RpbmcgYnV0IHRoZSBjb250ZW50IGVuY29kaW5nIGlzIGFscmVhZHkgdGhlIHNhbWVcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdGdldEVuY29kaW5nKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMucHJlZmVycmVkRW5jb2RpbmcgfHwgdGhpcy5jb250ZW50RW5jb2Rpbmc7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHRwcml2YXRlIHRyYWNlKG1zZzogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBbdGV4dCBmaWxlIG1vZGVsXSAke21zZ31gLCB0aGlzLnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXHR9XG5cblx0b3ZlcnJpZGUgaXNSZXNvbHZlZCgpOiB0aGlzIGlzIElSZXNvbHZlZFRleHRGaWxlRWRpdG9yTW9kZWwge1xuXHRcdHJldHVybiAhIXRoaXMudGV4dEVkaXRvck1vZGVsO1xuXHR9XG5cblx0b3ZlcnJpZGUgaXNSZWFkb25seSgpOiBib29sZWFuIHwgSU1hcmtkb3duU3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5maWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLmlzUmVhZG9ubHkodGhpcy5yZXNvdXJjZSwgdGhpcy5sYXN0UmVzb2x2ZWRGaWxlU3RhdCk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMudHJhY2UoJ2Rpc3Bvc2UoKScpO1xuXG5cdFx0dGhpcy5pbkNvbmZsaWN0TW9kZSA9IGZhbHNlO1xuXHRcdHRoaXMuaW5PcnBoYW5Nb2RlID0gZmFsc2U7XG5cdFx0dGhpcy5pbkVycm9yTW9kZSA9IGZhbHNlO1xuXG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsZUFBZTtBQUV4QixTQUFTLFlBQVk7QUFDckIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxjQUFjLGtCQUFrQiwwQkFBK0gsNkJBQW9GO0FBQzVQLFNBQXlCLFlBQVksMEJBQTBCO0FBQy9ELFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsaUNBQTZEO0FBQ3RFLFNBQVMsY0FBa0MscUJBQXVDLGdCQUF1QyxlQUFlLDBDQUEwQztBQUNsTCxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLFNBQVMsMEJBQTBCO0FBRTVDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQTZCLHlCQUF5QixrQkFBMEM7QUFDaEcsU0FBUyxrQ0FBa0M7QUFDM0MsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxtQkFBbUIsK0JBQStCO0FBQzNELFNBQVMsU0FBUyxTQUFTLE1BQU0scUJBQXFCO0FBQ3RELFNBQVMseUNBQXlDO0FBQ2xELFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsY0FBYztBQUN2QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDZCQUE2QjtBQUN0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
