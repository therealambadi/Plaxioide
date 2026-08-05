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
import { Event, Emitter } from "../../../../base/common/event.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { ETAG_DISABLED, FileOperationResult, IFileService, NotModifiedSinceFileOperationError } from "../../../../platform/files/common/files.js";
import { SaveReason } from "../../../common/editor.js";
import { IWorkingCopyService } from "./workingCopyService.js";
import { WorkingCopyCapabilities } from "./workingCopy.js";
import { raceCancellation, TaskSequentializer, timeout } from "../../../../base/common/async.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { assertIsDefined } from "../../../../base/common/types.js";
import { IWorkingCopyFileService } from "./workingCopyFileService.js";
import { IFilesConfigurationService } from "../../filesConfiguration/common/filesConfigurationService.js";
import { IWorkingCopyBackupService } from "./workingCopyBackup.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { hash } from "../../../../base/common/hash.js";
import { isErrorWithActions, toErrorMessage } from "../../../../base/common/errorMessage.js";
import { toAction } from "../../../../base/common/actions.js";
import { isWindows } from "../../../../base/common/platform.js";
import { IWorkingCopyEditorService } from "./workingCopyEditorService.js";
import { IEditorService } from "../../editor/common/editorService.js";
import { IElevatedFileService } from "../../files/common/elevatedFileService.js";
import { ResourceWorkingCopy } from "./resourceWorkingCopy.js";
import { SnapshotContext } from "./fileWorkingCopy.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { isCancellationError } from "../../../../base/common/errors.js";
var StoredFileWorkingCopyState = /* @__PURE__ */ ((StoredFileWorkingCopyState2) => {
  StoredFileWorkingCopyState2[StoredFileWorkingCopyState2["SAVED"] = 0] = "SAVED";
  StoredFileWorkingCopyState2[StoredFileWorkingCopyState2["DIRTY"] = 1] = "DIRTY";
  StoredFileWorkingCopyState2[StoredFileWorkingCopyState2["PENDING_SAVE"] = 2] = "PENDING_SAVE";
  StoredFileWorkingCopyState2[StoredFileWorkingCopyState2["CONFLICT"] = 3] = "CONFLICT";
  StoredFileWorkingCopyState2[StoredFileWorkingCopyState2["ORPHAN"] = 4] = "ORPHAN";
  StoredFileWorkingCopyState2[StoredFileWorkingCopyState2["ERROR"] = 5] = "ERROR";
  return StoredFileWorkingCopyState2;
})(StoredFileWorkingCopyState || {});
function isStoredFileWorkingCopySaveEvent(e) {
  const candidate = e;
  return !!candidate.stat;
}
let StoredFileWorkingCopy = class extends ResourceWorkingCopy {
  //#endregion
  constructor(typeId, resource, name, modelFactory, externalResolver, fileService, logService, workingCopyFileService, filesConfigurationService, workingCopyBackupService, workingCopyService, notificationService, workingCopyEditorService, editorService, elevatedFileService, progressService) {
    super(resource, fileService);
    this.typeId = typeId;
    this.name = name;
    this.modelFactory = modelFactory;
    this.externalResolver = externalResolver;
    this.logService = logService;
    this.workingCopyFileService = workingCopyFileService;
    this.filesConfigurationService = filesConfigurationService;
    this.workingCopyBackupService = workingCopyBackupService;
    this.notificationService = notificationService;
    this.workingCopyEditorService = workingCopyEditorService;
    this.editorService = editorService;
    this.elevatedFileService = elevatedFileService;
    this.progressService = progressService;
    this.capabilities = WorkingCopyCapabilities.None;
    this._model = void 0;
    //#region events
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
    this._onDidChangeReadonly = this._register(new Emitter());
    this.onDidChangeReadonly = this._onDidChangeReadonly.event;
    //#region Dirty
    this.dirty = false;
    this.ignoreDirtyOnModelContentChange = false;
    //#endregion
    //#region Save
    this.versionId = 0;
    this.lastContentChangeFromUndoRedo = void 0;
    this.saveSequentializer = new TaskSequentializer();
    this.ignoreSaveFromSaveParticipants = false;
    //#endregion
    //#region State
    this.inConflictMode = false;
    this.inErrorMode = false;
    this._register(workingCopyService.registerWorkingCopy(this));
    this.registerListeners();
  }
  get model() {
    return this._model;
  }
  registerListeners() {
    this._register(this.filesConfigurationService.onDidChangeReadonly(() => this._onDidChangeReadonly.fire()));
  }
  isDirty() {
    return this.dirty;
  }
  markModified() {
    this.setDirty(true);
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
    const oldSavedVersionId = this.savedVersionId;
    if (!dirty) {
      this.dirty = false;
      this.inConflictMode = false;
      this.inErrorMode = false;
      if (this.isResolved()) {
        this.savedVersionId = this.model.versionId;
      }
    } else {
      this.dirty = true;
    }
    return () => {
      this.dirty = wasDirty;
      this.inConflictMode = wasInConflictMode;
      this.inErrorMode = wasInErrorMode;
      this.savedVersionId = oldSavedVersionId;
    };
  }
  // !!! DO NOT MARK PRIVATE! USED IN TESTS !!!
  isResolved() {
    return !!this.model;
  }
  async resolve(options) {
    this.trace("resolve() - enter");
    if (this.isDisposed()) {
      this.trace("resolve() - exit - without resolving because file working copy is disposed");
      return;
    }
    if (!options?.contents && (this.dirty || this.saveSequentializer.isRunning())) {
      this.trace("resolve() - exit - without resolving because file working copy is dirty or being saved");
      return;
    }
    return this.doResolve(options);
  }
  async doResolve(options) {
    if (options?.contents) {
      return this.resolveFromBuffer(options.contents);
    }
    const isNew = !this.isResolved();
    if (isNew) {
      const resolvedFromBackup = await this.resolveFromBackup();
      if (resolvedFromBackup) {
        return;
      }
    }
    return this.resolveFromFile(options);
  }
  async resolveFromBuffer(buffer) {
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
    return this.resolveFromContent(
      {
        resource: this.resource,
        name: this.name,
        mtime,
        ctime,
        size,
        etag,
        value: buffer,
        readonly: false,
        locked: false
      },
      true
      /* dirty (resolved from buffer) */
    );
  }
  async resolveFromBackup() {
    const backup = await this.workingCopyBackupService.resolve(this);
    const isNew = !this.isResolved();
    if (!isNew) {
      this.trace("resolveFromBackup() - exit - withoutresolving because previously new file working copy got created meanwhile");
      return true;
    }
    if (backup) {
      await this.doResolveFromBackup(backup);
      return true;
    }
    return false;
  }
  async doResolveFromBackup(backup) {
    this.trace("doResolveFromBackup()");
    await this.resolveFromContent(
      {
        resource: this.resource,
        name: this.name,
        mtime: backup.meta ? backup.meta.mtime : Date.now(),
        ctime: backup.meta ? backup.meta.ctime : Date.now(),
        size: backup.meta ? backup.meta.size : 0,
        etag: backup.meta ? backup.meta.etag : ETAG_DISABLED,
        // etag disabled if unknown!
        value: backup.value,
        readonly: false,
        locked: false
      },
      true
      /* dirty (resolved from backup) */
    );
    if (backup.meta && backup.meta.orphaned) {
      this.setOrphaned(true);
    }
  }
  async resolveFromFile(options) {
    this.trace("resolveFromFile()");
    const forceReadFromFile = options?.forceReadFromFile;
    let etag;
    if (forceReadFromFile) {
      etag = ETAG_DISABLED;
    } else if (this.lastResolvedFileStat) {
      etag = this.lastResolvedFileStat.etag;
    }
    const currentVersionId = this.versionId;
    try {
      const content = await this.fileService.readFileStream(this.resource, {
        etag,
        limits: options?.limits
      });
      this.setOrphaned(false);
      if (currentVersionId !== this.versionId) {
        this.trace("resolveFromFile() - exit - without resolving because file working copy content changed");
        return;
      }
      await this.resolveFromContent(
        content,
        false
        /* not dirty (resolved from file) */
      );
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
  async resolveFromContent(content, dirty) {
    this.trace("resolveFromContent() - enter");
    if (this.isDisposed()) {
      this.trace("resolveFromContent() - exit - because working copy is disposed");
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
    if (this.isResolved()) {
      await this.doUpdateModel(content.value);
    } else {
      await this.doCreateModel(content.value);
    }
    this.setDirty(!!dirty);
    this._onDidResolve.fire();
  }
  async doCreateModel(contents) {
    this.trace("doCreateModel()");
    this._model = this._register(await this.modelFactory.createModel(this.resource, contents, CancellationToken.None));
    this.installModelListeners(this._model);
  }
  async doUpdateModel(contents) {
    this.trace("doUpdateModel()");
    this.ignoreDirtyOnModelContentChange = true;
    try {
      await this.model?.update(contents, CancellationToken.None);
    } finally {
      this.ignoreDirtyOnModelContentChange = false;
    }
  }
  installModelListeners(model) {
    this._register(model.onDidChangeContent((e) => this.onModelContentChanged(model, e.isUndoing || e.isRedoing)));
    this._register(model.onWillDispose(() => this.dispose()));
  }
  onModelContentChanged(model, isUndoingOrRedoing) {
    this.trace(`onModelContentChanged() - enter`);
    this.versionId++;
    this.trace(`onModelContentChanged() - new versionId ${this.versionId}`);
    if (isUndoingOrRedoing) {
      this.lastContentChangeFromUndoRedo = Date.now();
    }
    if (!this.ignoreDirtyOnModelContentChange && !this.isReadonly()) {
      if (model.versionId === this.savedVersionId) {
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
  }
  async forceResolveFromFile() {
    if (this.isDisposed()) {
      return;
    }
    await this.externalResolver({
      forceReadFromFile: true
    });
  }
  //#endregion
  //#region Backup
  get backupDelay() {
    return this.model?.configuration?.backupDelay;
  }
  async backup(token) {
    let meta = void 0;
    if (this.lastResolvedFileStat) {
      meta = {
        mtime: this.lastResolvedFileStat.mtime,
        ctime: this.lastResolvedFileStat.ctime,
        size: this.lastResolvedFileStat.size,
        etag: this.lastResolvedFileStat.etag,
        orphaned: this.isOrphaned()
      };
    }
    let content = void 0;
    if (this.isResolved()) {
      content = await raceCancellation(this.model.snapshot(SnapshotContext.Backup, token), token);
    }
    return { meta, content };
  }
  async save(options = /* @__PURE__ */ Object.create(null)) {
    if (!this.isResolved()) {
      return false;
    }
    if (this.isReadonly()) {
      this.trace("save() - ignoring request for readonly resource");
      return false;
    }
    if ((this.hasState(3 /* CONFLICT */) || this.hasState(5 /* ERROR */)) && (options.reason === SaveReason.AUTO || options.reason === SaveReason.FOCUS_CHANGE || options.reason === SaveReason.WINDOW_CHANGE)) {
      this.trace("save() - ignoring auto save request for file working copy that is in conflict or error");
      return false;
    }
    this.trace("save() - enter");
    await this.doSave(options);
    this.trace("save() - exit");
    return this.hasState(0 /* SAVED */);
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
      this.model.pushStackElement();
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
      if (this.isResolved() && !options.skipSaveParticipants && this.workingCopyFileService.hasSaveParticipants) {
        try {
          if (options.reason === SaveReason.AUTO && typeof this.lastContentChangeFromUndoRedo === "number") {
            const timeFromUndoRedoToSave = Date.now() - this.lastContentChangeFromUndoRedo;
            if (timeFromUndoRedoToSave < StoredFileWorkingCopy.UNDO_REDO_SAVE_PARTICIPANTS_AUTO_SAVE_THROTTLE_THRESHOLD) {
              await timeout(StoredFileWorkingCopy.UNDO_REDO_SAVE_PARTICIPANTS_AUTO_SAVE_THROTTLE_THRESHOLD - timeFromUndoRedoToSave);
            }
          }
          if (!saveCancellation.token.isCancellationRequested) {
            this.ignoreSaveFromSaveParticipants = true;
            try {
              await this.workingCopyFileService.runSaveParticipants(this, { reason: options.reason ?? SaveReason.EXPLICIT, savedFrom: options.from }, progress, saveCancellation.token);
            } catch (err) {
              if (isCancellationError(err) && !saveCancellation.token.isCancellationRequested) {
                saveCancellation.cancel();
              }
            } finally {
              this.ignoreSaveFromSaveParticipants = false;
            }
          }
        } catch (error) {
          this.logService.error(`[stored file working copy] runSaveParticipants(${versionId}) - resulted in an error: ${error.toString()}`, this.resource.toString(), this.typeId);
        }
      }
      if (saveCancellation.token.isCancellationRequested) {
        return;
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
      const resolvedFileWorkingCopy = this;
      return this.saveSequentializer.run(versionId, (async () => {
        try {
          const writeFileOptions = {
            mtime: lastResolvedFileStat.mtime,
            etag: options.ignoreModifiedSince || !this.filesConfigurationService.preventSaveConflicts(lastResolvedFileStat.resource) ? ETAG_DISABLED : lastResolvedFileStat.etag,
            unlock: options.writeUnlock
          };
          let stat;
          if (typeof resolvedFileWorkingCopy.model.save === "function") {
            try {
              stat = await resolvedFileWorkingCopy.model.save(writeFileOptions, saveCancellation.token);
            } catch (error) {
              if (saveCancellation.token.isCancellationRequested) {
                return void 0;
              }
              throw error;
            }
          } else {
            const snapshot = await raceCancellation(resolvedFileWorkingCopy.model.snapshot(SnapshotContext.Save, saveCancellation.token), saveCancellation.token);
            if (saveCancellation.token.isCancellationRequested) {
              return;
            } else {
              saveCancellation.dispose();
            }
            if (options?.writeElevated && this.elevatedFileService.isSupported(lastResolvedFileStat.resource)) {
              stat = await this.elevatedFileService.writeFileElevated(lastResolvedFileStat.resource, assertIsDefined(snapshot), writeFileOptions);
            } else {
              stat = await this.fileService.writeFile(lastResolvedFileStat.resource, assertIsDefined(snapshot), writeFileOptions);
            }
          }
          this.handleSaveSuccess(stat, versionId, options);
        } catch (error) {
          this.handleSaveError(error, versionId, options);
        }
      })(), () => saveCancellation.cancel());
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
    (options.ignoreErrorHandler ? this.logService.trace : this.logService.error).apply(this.logService, [`[stored file working copy] handleSaveError(${versionId}) - exit - resulted in a save error: ${error.toString()}`, this.resource.toString(), this.typeId]);
    if (options.ignoreErrorHandler) {
      throw error;
    }
    this.setDirty(true);
    this.inErrorMode = true;
    if (error.fileOperationResult === FileOperationResult.FILE_MODIFIED_SINCE) {
      this.inConflictMode = true;
    }
    this.doHandleSaveError(error, options);
    this._onDidSaveError.fire();
  }
  doHandleSaveError(error, options) {
    const fileOperationError = error;
    const primaryActions = [];
    let message;
    if (fileOperationError.fileOperationResult === FileOperationResult.FILE_MODIFIED_SINCE) {
      message = localize("staleSaveError", "Failed to save '{0}': The content of the file is newer. Do you want to overwrite the file with your changes?", this.name);
      primaryActions.push(toAction({ id: "fileWorkingCopy.overwrite", label: localize("overwrite", "Overwrite"), run: () => this.save({ ...options, ignoreModifiedSince: true, reason: SaveReason.EXPLICIT }) }));
      primaryActions.push(toAction({ id: "fileWorkingCopy.revert", label: localize("revert", "Revert"), run: () => this.revert() }));
    } else {
      const isWriteLocked = fileOperationError.fileOperationResult === FileOperationResult.FILE_WRITE_LOCKED;
      const triedToUnlock = isWriteLocked && fileOperationError.options?.unlock;
      const isPermissionDenied = fileOperationError.fileOperationResult === FileOperationResult.FILE_PERMISSION_DENIED;
      const canSaveElevated = this.elevatedFileService.isSupported(this.resource);
      if (isErrorWithActions(error)) {
        primaryActions.push(...error.actions);
      }
      if (canSaveElevated && (isPermissionDenied || triedToUnlock)) {
        primaryActions.push(toAction({
          id: "fileWorkingCopy.saveElevated",
          label: triedToUnlock ? isWindows ? localize("overwriteElevated", "Overwrite as Admin...") : localize("overwriteElevatedSudo", "Overwrite as Sudo...") : isWindows ? localize("saveElevated", "Retry as Admin...") : localize("saveElevatedSudo", "Retry as Sudo..."),
          run: () => {
            this.save({ ...options, writeElevated: true, writeUnlock: triedToUnlock, reason: SaveReason.EXPLICIT });
          }
        }));
      } else if (isWriteLocked) {
        primaryActions.push(toAction({ id: "fileWorkingCopy.unlock", label: localize("overwrite", "Overwrite"), run: () => this.save({ ...options, writeUnlock: true, reason: SaveReason.EXPLICIT }) }));
      } else {
        primaryActions.push(toAction({ id: "fileWorkingCopy.retry", label: localize("retry", "Retry"), run: () => this.save({ ...options, reason: SaveReason.EXPLICIT }) }));
      }
      primaryActions.push(toAction({
        id: "fileWorkingCopy.saveAs",
        label: localize("saveAs", "Save As..."),
        run: async () => {
          const editor = this.workingCopyEditorService.findEditor(this);
          if (editor) {
            const result = await this.editorService.save(editor, { saveAs: true, reason: SaveReason.EXPLICIT });
            if (!result.success) {
              this.doHandleSaveError(error, options);
            }
          }
        }
      }));
      primaryActions.push(toAction({ id: "fileWorkingCopy.revert", label: localize("revert", "Revert"), run: () => this.revert() }));
      if (isWriteLocked) {
        if (triedToUnlock && canSaveElevated) {
          message = isWindows ? localize("readonlySaveErrorAdmin", "Failed to save '{0}': File is read-only. Select 'Overwrite as Admin' to retry as administrator.", this.name) : localize("readonlySaveErrorSudo", "Failed to save '{0}': File is read-only. Select 'Overwrite as Sudo' to retry as superuser.", this.name);
        } else {
          message = localize("readonlySaveError", "Failed to save '{0}': File is read-only. Select 'Overwrite' to attempt to make it writeable.", this.name);
        }
      } else if (canSaveElevated && isPermissionDenied) {
        message = isWindows ? localize("permissionDeniedSaveError", "Failed to save '{0}': Insufficient permissions. Select 'Retry as Admin' to retry as administrator.", this.name) : localize("permissionDeniedSaveErrorSudo", "Failed to save '{0}': Insufficient permissions. Select 'Retry as Sudo' to retry as superuser.", this.name);
      } else {
        message = localize({ key: "genericSaveError", comment: ["{0} is the resource that failed to save and {1} the error message"] }, "Failed to save '{0}': {1}", this.name, toErrorMessage(error, false));
      }
    }
    const handle = this.notificationService.notify({ id: `${hash(this.resource.toString())}`, severity: Severity.Error, message, actions: { primary: primaryActions } });
    const listener = this._register(Event.once(Event.any(this.onDidSave, this.onDidRevert))(() => handle.close()));
    this._register(Event.once(handle.onDidClose)(() => listener.dispose()));
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
  //#region Revert
  async revert(options) {
    if (!this.isResolved() || !this.dirty && !options?.force) {
      return;
    }
    this.trace("revert()");
    const wasDirty = this.dirty;
    const undoSetDirty = this.doSetDirty(false);
    const softUndo = options?.soft;
    if (!softUndo) {
      try {
        await this.forceResolveFromFile();
      } catch (error) {
        if (error.fileOperationResult !== FileOperationResult.FILE_NOT_FOUND) {
          undoSetDirty();
          throw error;
        }
      }
    }
    this._onDidRevert.fire();
    if (wasDirty) {
      this._onDidChangeDirty.fire();
    }
  }
  hasState(state) {
    switch (state) {
      case 3 /* CONFLICT */:
        return this.inConflictMode;
      case 1 /* DIRTY */:
        return this.dirty;
      case 5 /* ERROR */:
        return this.inErrorMode;
      case 4 /* ORPHAN */:
        return this.isOrphaned();
      case 2 /* PENDING_SAVE */:
        return this.saveSequentializer.isRunning();
      case 0 /* SAVED */:
        return !this.dirty;
    }
  }
  async joinState(state) {
    return this.saveSequentializer.running;
  }
  //#endregion
  //#region Utilities
  isReadonly() {
    return this.filesConfigurationService.isReadonly(this.resource, this.lastResolvedFileStat);
  }
  trace(msg) {
    this.logService.trace(`[stored file working copy] ${msg}`, this.resource.toString(), this.typeId);
  }
  //#endregion
  //#region Dispose
  dispose() {
    this.trace("dispose()");
    this.inConflictMode = false;
    this.inErrorMode = false;
    this._model = void 0;
    super.dispose();
  }
  //#endregion
};
StoredFileWorkingCopy.UNDO_REDO_SAVE_PARTICIPANTS_AUTO_SAVE_THROTTLE_THRESHOLD = 500;
StoredFileWorkingCopy = __decorateClass([
  __decorateParam(5, IFileService),
  __decorateParam(6, ILogService),
  __decorateParam(7, IWorkingCopyFileService),
  __decorateParam(8, IFilesConfigurationService),
  __decorateParam(9, IWorkingCopyBackupService),
  __decorateParam(10, IWorkingCopyService),
  __decorateParam(11, INotificationService),
  __decorateParam(12, IWorkingCopyEditorService),
  __decorateParam(13, IEditorService),
  __decorateParam(14, IElevatedFileService),
  __decorateParam(15, IProgressService)
], StoredFileWorkingCopy);
export {
  StoredFileWorkingCopy,
  StoredFileWorkingCopyState,
  isStoredFileWorkingCopySaveEvent
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvd29ya2luZ0NvcHkvY29tbW9uL3N0b3JlZEZpbGVXb3JraW5nQ29weS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBFdmVudCwgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuLCBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBFVEFHX0RJU0FCTEVELCBGaWxlT3BlcmF0aW9uRXJyb3IsIEZpbGVPcGVyYXRpb25SZXN1bHQsIElGaWxlUmVhZExpbWl0cywgSUZpbGVTZXJ2aWNlLCBJRmlsZVN0YXRXaXRoTWV0YWRhdGEsIElGaWxlU3RyZWFtQ29udGVudCwgSVdyaXRlRmlsZU9wdGlvbnMsIE5vdE1vZGlmaWVkU2luY2VGaWxlT3BlcmF0aW9uRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSVNhdmVPcHRpb25zLCBJUmV2ZXJ0T3B0aW9ucywgU2F2ZVJlYXNvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSVdvcmtpbmdDb3B5U2VydmljZSB9IGZyb20gJy4vd29ya2luZ0NvcHlTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElXb3JraW5nQ29weUJhY2t1cCwgSVdvcmtpbmdDb3B5QmFja3VwTWV0YSwgSVdvcmtpbmdDb3B5U2F2ZUV2ZW50LCBXb3JraW5nQ29weUNhcGFiaWxpdGllcyB9IGZyb20gJy4vd29ya2luZ0NvcHkuanMnO1xuaW1wb3J0IHsgcmFjZUNhbmNlbGxhdGlvbiwgVGFza1NlcXVlbnRpYWxpemVyLCB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBhc3NlcnRJc0RlZmluZWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBJV29ya2luZ0NvcHlGaWxlU2VydmljZSB9IGZyb20gJy4vd29ya2luZ0NvcHlGaWxlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBWU0J1ZmZlclJlYWRhYmxlU3RyZWFtIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IElGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZmlsZXNDb25maWd1cmF0aW9uL2NvbW1vbi9maWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElXb3JraW5nQ29weUJhY2t1cFNlcnZpY2UsIElSZXNvbHZlZFdvcmtpbmdDb3B5QmFja3VwIH0gZnJvbSAnLi93b3JraW5nQ29weUJhY2t1cC5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSwgU2V2ZXJpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBoYXNoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaGFzaC5qcyc7XG5pbXBvcnQgeyBpc0Vycm9yV2l0aEFjdGlvbnMsIHRvRXJyb3JNZXNzYWdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JNZXNzYWdlLmpzJztcbmltcG9ydCB7IElBY3Rpb24sIHRvQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBpc1dpbmRvd3MgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJV29ya2luZ0NvcHlFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi93b3JraW5nQ29weUVkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVsZXZhdGVkRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9maWxlcy9jb21tb24vZWxldmF0ZWRGaWxlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUmVzb3VyY2VXb3JraW5nQ29weSwgUmVzb3VyY2VXb3JraW5nQ29weSB9IGZyb20gJy4vcmVzb3VyY2VXb3JraW5nQ29weS5qcyc7XG5pbXBvcnQgeyBJRmlsZVdvcmtpbmdDb3B5LCBJRmlsZVdvcmtpbmdDb3B5TW9kZWwsIElGaWxlV29ya2luZ0NvcHlNb2RlbEZhY3RvcnksIFNuYXBzaG90Q29udGV4dCB9IGZyb20gJy4vZmlsZVdvcmtpbmdDb3B5LmpzJztcbmltcG9ydCB7IElNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IElQcm9ncmVzcywgSVByb2dyZXNzU2VydmljZSwgSVByb2dyZXNzU3RlcCwgUHJvZ3Jlc3NMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyBpc0NhbmNlbGxhdGlvbkVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcblxuLyoqXG4gKiBTdG9yZWQgZmlsZSBzcGVjaWZpYyB3b3JraW5nIGNvcHkgbW9kZWwgZmFjdG9yeS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5TW9kZWxGYWN0b3J5PE0gZXh0ZW5kcyBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5TW9kZWw+IGV4dGVuZHMgSUZpbGVXb3JraW5nQ29weU1vZGVsRmFjdG9yeTxNPiB7IH1cblxuLyoqXG4gKiBUaGUgdW5kZXJseWluZyBtb2RlbCBvZiBhIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weSBwcm92aWRlcyBzb21lXG4gKiBtZXRob2RzIGZvciB0aGUgc3RvcmVkIGZpbGUgd29ya2luZyBjb3B5IHRvIGZ1bmN0aW9uLiBUaGUgbW9kZWwgaXNcbiAqIHR5cGljYWxseSBvbmx5IGF2YWlsYWJsZSBhZnRlciB0aGUgd29ya2luZyBjb3B5IGhhcyBiZWVuXG4gKiByZXNvbHZlZCB2aWEgaXQncyBgcmVzb2x2ZSgpYCBtZXRob2QuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSVN0b3JlZEZpbGVXb3JraW5nQ29weU1vZGVsIGV4dGVuZHMgSUZpbGVXb3JraW5nQ29weU1vZGVsIHtcblxuXHRyZWFkb25seSBvbkRpZENoYW5nZUNvbnRlbnQ6IEV2ZW50PElTdG9yZWRGaWxlV29ya2luZ0NvcHlNb2RlbENvbnRlbnRDaGFuZ2VkRXZlbnQ+O1xuXG5cdC8qKlxuXHQgKiBBIHZlcnNpb24gSUQgb2YgdGhlIG1vZGVsLiBJZiBhIGBvbkRpZENoYW5nZUNvbnRlbnRgIGlzIGZpcmVkXG5cdCAqIGZyb20gdGhlIG1vZGVsIGFuZCB0aGUgbGFzdCBrbm93biBzYXZlZCBgdmVyc2lvbklkYCBtYXRjaGVzXG5cdCAqIHdpdGggdGhlIGBtb2RlbC52ZXJzaW9uSWRgLCB0aGUgc3RvcmVkIGZpbGUgd29ya2luZyBjb3B5IHdpbGxcblx0ICogZGlzY2FyZCBhbnkgZGlydHkgc3RhdGUuXG5cdCAqXG5cdCAqIEEgdXNlIGNhc2UgaXMgdGhlIGZvbGxvd2luZzpcblx0ICogLSBhIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weSBnZXRzIGVkaXRlZCBhbmQgdGh1cyBkaXJ0eVxuXHQgKiAtIHRoZSB1c2VyIHRyaWdnZXJzIHVuZG8gdG8gcmV2ZXJ0IHRoZSBjaGFuZ2VzXG5cdCAqIC0gYXQgdGhpcyBwb2ludCB0aGUgYHZlcnNpb25JZGAgc2hvdWxkIG1hdGNoIHRoZSBvbmUgd2UgaGFkIHNhdmVkXG5cdCAqXG5cdCAqIFRoaXMgcmVxdWlyZXMgdGhlIG1vZGVsIHRvIGJlIGF3YXJlIG9mIHVuZG8vcmVkbyBvcGVyYXRpb25zLlxuXHQgKi9cblx0cmVhZG9ubHkgdmVyc2lvbklkOiB1bmtub3duO1xuXG5cdC8qKlxuXHQgKiBDbG9zZSB0aGUgY3VycmVudCB1bmRvLXJlZG8gZWxlbWVudC4gVGhpcyBvZmZlcnMgYSB3YXlcblx0ICogdG8gY3JlYXRlIGFuIHVuZG8vcmVkbyBzdG9wIHBvaW50LlxuXHQgKlxuXHQgKiBUaGlzIG1ldGhvZCBtYXkgZm9yIGV4YW1wbGUgYmUgY2FsbGVkIHJpZ2h0IGJlZm9yZSB0aGVcblx0ICogc2F2ZSBpcyB0cmlnZ2VyZWQgc28gdGhhdCB0aGUgdXNlciBjYW4gYWx3YXlzIHVuZG8gYmFja1xuXHQgKiB0byB0aGUgc3RhdGUgYmVmb3JlIHNhdmluZy5cblx0ICovXG5cdHB1c2hTdGFja0VsZW1lbnQoKTogdm9pZDtcblxuXHQvKipcblx0ICogT3B0aW9uYWxseSBhbGxvd3MgYSBzdG9yZWQgZmlsZSB3b3JraW5nIGNvcHkgbW9kZWwgdG9cblx0ICogaW1wbGVtZW50IHRoZSBgc2F2ZWAgbWV0aG9kLiBUaGlzIGFsbG93cyB0byBpbXBsZW1lbnRcblx0ICogYSBtb3JlIGVmZmljaWVudCBzYXZlIGxvZ2ljIGNvbXBhcmVkIHRvIHRoZSBkZWZhdWx0XG5cdCAqIHdoaWNoIGlzIHRvIGFzayB0aGUgbW9kZWwgZm9yIGEgYHNuYXBzaG90YCBhbmQgdGhlblxuXHQgKiB3cml0aW5nIHRoYXQgdG8gdGhlIG1vZGVsJ3MgcmVzb3VyY2UuXG5cdCAqL1xuXHRzYXZlPyhvcHRpb25zOiBJV3JpdGVGaWxlT3B0aW9ucywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJRmlsZVN0YXRXaXRoTWV0YWRhdGE+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElTdG9yZWRGaWxlV29ya2luZ0NvcHlNb2RlbENvbnRlbnRDaGFuZ2VkRXZlbnQge1xuXG5cdC8qKlxuXHQgKiBGbGFnIHRoYXQgaW5kaWNhdGVzIHRoYXQgdGhpcyBldmVudCB3YXMgZ2VuZXJhdGVkIHdoaWxlIHVuZG9pbmcuXG5cdCAqL1xuXHRyZWFkb25seSBpc1VuZG9pbmc6IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIEZsYWcgdGhhdCBpbmRpY2F0ZXMgdGhhdCB0aGlzIGV2ZW50IHdhcyBnZW5lcmF0ZWQgd2hpbGUgcmVkb2luZy5cblx0ICovXG5cdHJlYWRvbmx5IGlzUmVkb2luZzogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBBIHN0b3JlZCBmaWxlIGJhc2VkIGBJV29ya2luZ0NvcHlgIGlzIGJhY2tlZCBieSBhIGBVUklgIGZyb20gYVxuICoga25vd24gZmlsZSBzeXN0ZW0gcHJvdmlkZXIuIEdpdmVuIHRoaXMgYXNzdW1wdGlvbiwgYSBsb3RcbiAqIG9mIGZ1bmN0aW9uYWxpdHkgY2FuIGJlIGJ1aWx0IG9uIHRvcCwgc3VjaCBhcyBzYXZpbmcgaW5cbiAqIGEgc2VjdXJlIHdheSB0byBwcmV2ZW50IGRhdGEgbG9zcy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5PE0gZXh0ZW5kcyBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5TW9kZWw+IGV4dGVuZHMgSVJlc291cmNlV29ya2luZ0NvcHksIElGaWxlV29ya2luZ0NvcHk8TT4ge1xuXG5cdC8qKlxuXHQgKiBBbiBldmVudCBmb3Igd2hlbiBhIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weSB3YXMgcmVzb2x2ZWQuXG5cdCAqL1xuXHRyZWFkb25seSBvbkRpZFJlc29sdmU6IEV2ZW50PHZvaWQ+O1xuXG5cdC8qKlxuXHQgKiBBbiBldmVudCBmb3Igd2hlbiBhIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weSB3YXMgc2F2ZWQgc3VjY2Vzc2Z1bGx5LlxuXHQgKi9cblx0cmVhZG9ubHkgb25EaWRTYXZlOiBFdmVudDxJU3RvcmVkRmlsZVdvcmtpbmdDb3B5U2F2ZUV2ZW50PjtcblxuXHQvKipcblx0ICogQW4gZXZlbnQgaW5kaWNhdGluZyB0aGF0IGEgc3RvcmVkIGZpbGUgd29ya2luZyBjb3B5IHNhdmUgb3BlcmF0aW9uIGZhaWxlZC5cblx0ICovXG5cdHJlYWRvbmx5IG9uRGlkU2F2ZUVycm9yOiBFdmVudDx2b2lkPjtcblxuXHQvKipcblx0ICogQW4gZXZlbnQgZm9yIHdoZW4gdGhlIHJlYWRvbmx5IHN0YXRlIG9mIHRoZSBzdG9yZWQgZmlsZSB3b3JraW5nIGNvcHkgY2hhbmdlcy5cblx0ICovXG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlUmVhZG9ubHk6IEV2ZW50PHZvaWQ+O1xuXG5cdC8qKlxuXHQgKiBSZXNvbHZlcyBhIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weS5cblx0ICovXG5cdHJlc29sdmUob3B0aW9ucz86IElTdG9yZWRGaWxlV29ya2luZ0NvcHlSZXNvbHZlT3B0aW9ucyk6IFByb21pc2U8dm9pZD47XG5cblx0LyoqXG5cdCAqIEV4cGxpY2l0bHkgc2V0cyB0aGUgd29ya2luZyBjb3B5IHRvIGJlIG1vZGlmaWVkLlxuXHQgKi9cblx0bWFya01vZGlmaWVkKCk6IHZvaWQ7XG5cblx0LyoqXG5cdCAqIFdoZXRoZXIgdGhlIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weSBpcyBpbiB0aGUgcHJvdmlkZWQgYHN0YXRlYFxuXHQgKiBvciBub3QuXG5cdCAqXG5cdCAqIEBwYXJhbSBzdGF0ZSB0aGUgYEZpbGVXb3JraW5nQ29weVN0YXRlYCB0byBjaGVjayBvbi5cblx0ICovXG5cdGhhc1N0YXRlKHN0YXRlOiBTdG9yZWRGaWxlV29ya2luZ0NvcHlTdGF0ZSk6IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIEFsbG93cyB0byBqb2luIGEgc3RhdGUgY2hhbmdlIGF3YXkgZnJvbSB0aGUgcHJvdmlkZWQgYHN0YXRlYC5cblx0ICpcblx0ICogQHBhcmFtIHN0YXRlIGN1cnJlbnRseSBvbmx5IGBGaWxlV29ya2luZ0NvcHlTdGF0ZS5QRU5ESU5HX1NBVkVgXG5cdCAqIGNhbiBiZSBhd2FpdGVkIG9uIHRvIHJlc29sdmUuXG5cdCAqL1xuXHRqb2luU3RhdGUoc3RhdGU6IFN0b3JlZEZpbGVXb3JraW5nQ29weVN0YXRlLlBFTkRJTkdfU0FWRSk6IFByb21pc2U8dm9pZD47XG5cblx0LyoqXG5cdCAqIFdoZXRoZXIgd2UgaGF2ZSBhIHJlc29sdmVkIG1vZGVsIG9yIG5vdC5cblx0ICovXG5cdGlzUmVzb2x2ZWQoKTogdGhpcyBpcyBJUmVzb2x2ZWRTdG9yZWRGaWxlV29ya2luZ0NvcHk8TT47XG5cblx0LyoqXG5cdCAqIFdoZXRoZXIgdGhlIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weSBpcyByZWFkb25seSBvciBub3QuXG5cdCAqL1xuXHRpc1JlYWRvbmx5KCk6IGJvb2xlYW4gfCBJTWFya2Rvd25TdHJpbmc7XG5cblx0LyoqXG5cdCAqIEFza3MgdGhlIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weSB0byBzYXZlLiBJZiB0aGUgc3RvcmVkIGZpbGVcblx0ICogd29ya2luZyBjb3B5IHdhcyBkaXJ0eSwgaXQgaXMgZXhwZWN0ZWQgdG8gYmUgbm9uLWRpcnR5IGFmdGVyXG5cdCAqIHRoaXMgb3BlcmF0aW9uIGhhcyBmaW5pc2hlZC5cblx0ICpcblx0ICogQHJldHVybnMgYHRydWVgIGlmIHRoZSBvcGVyYXRpb24gd2FzIHN1Y2Nlc3NmdWwgYW5kIGBmYWxzZWAgb3RoZXJ3aXNlLlxuXHQgKi9cblx0c2F2ZShvcHRpb25zPzogSVN0b3JlZEZpbGVXb3JraW5nQ29weVNhdmVBc09wdGlvbnMpOiBQcm9taXNlPGJvb2xlYW4+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElSZXNvbHZlZFN0b3JlZEZpbGVXb3JraW5nQ29weTxNIGV4dGVuZHMgSVN0b3JlZEZpbGVXb3JraW5nQ29weU1vZGVsPiBleHRlbmRzIElTdG9yZWRGaWxlV29ya2luZ0NvcHk8TT4ge1xuXG5cdC8qKlxuXHQgKiBBIHJlc29sdmVkIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weSBoYXMgYSByZXNvbHZlZCBtb2RlbC5cblx0ICovXG5cdHJlYWRvbmx5IG1vZGVsOiBNO1xufVxuXG4vKipcbiAqIFN0YXRlcyB0aGUgc3RvcmVkIGZpbGUgd29ya2luZyBjb3B5IGNhbiBiZSBpbi5cbiAqL1xuZXhwb3J0IGNvbnN0IGVudW0gU3RvcmVkRmlsZVdvcmtpbmdDb3B5U3RhdGUge1xuXG5cdC8qKlxuXHQgKiBBIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weSBpcyBzYXZlZC5cblx0ICovXG5cdFNBVkVELFxuXG5cdC8qKlxuXHQgKiBBIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weSBpcyBkaXJ0eS5cblx0ICovXG5cdERJUlRZLFxuXG5cdC8qKlxuXHQgKiBBIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weSBpcyBjdXJyZW50bHkgYmVpbmcgc2F2ZWQgYnV0XG5cdCAqIHRoaXMgb3BlcmF0aW9uIGhhcyBub3QgY29tcGxldGVkIHlldC5cblx0ICovXG5cdFBFTkRJTkdfU0FWRSxcblxuXHQvKipcblx0ICogQSBzdG9yZWQgZmlsZSB3b3JraW5nIGNvcHkgaXMgaW4gY29uZmxpY3QgbW9kZSB3aGVuIGNoYW5nZXNcblx0ICogY2Fubm90IGJlIHNhdmVkIGJlY2F1c2UgdGhlIHVuZGVybHlpbmcgZmlsZSBoYXMgY2hhbmdlZC5cblx0ICogU3RvcmVkIGZpbGUgd29ya2luZyBjb3BpZXMgaW4gY29uZmxpY3QgbW9kZSBhcmUgYWx3YXlzIGRpcnR5LlxuXHQgKi9cblx0Q09ORkxJQ1QsXG5cblx0LyoqXG5cdCAqIEEgc3RvcmVkIGZpbGUgd29ya2luZyBjb3B5IGlzIGluIG9ycGhhbiBzdGF0ZSB3aGVuIHRoZSB1bmRlcmx5aW5nXG5cdCAqIGZpbGUgaGFzIGJlZW4gZGVsZXRlZC5cblx0ICovXG5cdE9SUEhBTixcblxuXHQvKipcblx0ICogQW55IGVycm9yIHRoYXQgaGFwcGVucyBkdXJpbmcgYSBzYXZlIHRoYXQgaXMgbm90IGNhdXNpbmdcblx0ICogdGhlIGBTdG9yZWRGaWxlV29ya2luZ0NvcHlTdGF0ZS5DT05GTElDVGAgc3RhdGUuXG5cdCAqIFN0b3JlZCBmaWxlIHdvcmtpbmcgY29waWVzIGluIGVycm9yIG1vZGUgYXJlIGFsd2F5cyBkaXJ0eS5cblx0ICovXG5cdEVSUk9SXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVN0b3JlZEZpbGVXb3JraW5nQ29weVNhdmVPcHRpb25zIGV4dGVuZHMgSVNhdmVPcHRpb25zIHtcblxuXHQvKipcblx0ICogU2F2ZSB0aGUgc3RvcmVkIGZpbGUgd29ya2luZyBjb3B5IHdpdGggYW4gYXR0ZW1wdCB0byB1bmxvY2sgaXQuXG5cdCAqL1xuXHRyZWFkb25seSB3cml0ZVVubG9jaz86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIFNhdmUgdGhlIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weSB3aXRoIGVsZXZhdGVkIHByaXZpbGVnZXMuXG5cdCAqXG5cdCAqIE5vdGU6IFRoaXMgbWF5IG5vdCBiZSBzdXBwb3J0ZWQgaW4gYWxsIGVudmlyb25tZW50cy5cblx0ICovXG5cdHJlYWRvbmx5IHdyaXRlRWxldmF0ZWQ/OiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBBbGxvd3MgdG8gd3JpdGUgdG8gYSBzdG9yZWQgZmlsZSB3b3JraW5nIGNvcHkgZXZlbiBpZiBpdCBoYXMgYmVlblxuXHQgKiBtb2RpZmllZCBvbiBkaXNrLiBUaGlzIHNob3VsZCBvbmx5IGJlIHRyaWdnZXJlZCBmcm9tIGFuXG5cdCAqIGV4cGxpY2l0IHVzZXIgYWN0aW9uLlxuXHQgKi9cblx0cmVhZG9ubHkgaWdub3JlTW9kaWZpZWRTaW5jZT86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIElmIHNldCwgd2lsbCBidWJibGUgdXAgdGhlIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weSBzYXZlIGVycm9yIHRvXG5cdCAqIHRoZSBjYWxsZXIgaW5zdGVhZCBvZiBoYW5kbGluZyBpdC5cblx0ICovXG5cdHJlYWRvbmx5IGlnbm9yZUVycm9ySGFuZGxlcj86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVN0b3JlZEZpbGVXb3JraW5nQ29weVNhdmVBc09wdGlvbnMgZXh0ZW5kcyBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5U2F2ZU9wdGlvbnMge1xuXG5cdC8qKlxuXHQgKiBPcHRpb25hbCBVUkkgb2YgdGhlIHJlc291cmNlIHRoZSB0ZXh0IGZpbGUgaXMgc2F2ZWQgZnJvbSBpZiBrbm93bi5cblx0ICovXG5cdHJlYWRvbmx5IGZyb20/OiBVUkk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVN0b3JlZEZpbGVXb3JraW5nQ29weVJlc29sdmVyIHtcblxuXHQvKipcblx0ICogUmVzb2x2ZXMgdGhlIHdvcmtpbmcgY29weSBpbiBhIHNhZmUgd2F5IGZyb20gYW4gZXh0ZXJuYWxcblx0ICogd29ya2luZyBjb3B5IG1hbmFnZXIgdGhhdCBjYW4gbWFrZSBzdXJlIG11bHRpcGxlIHBhcmFsbGVsXG5cdCAqIHJlc29sdmVzIGV4ZWN1dGUgcHJvcGVybHkuXG5cdCAqL1xuXHQob3B0aW9ucz86IElTdG9yZWRGaWxlV29ya2luZ0NvcHlSZXNvbHZlT3B0aW9ucyk6IFByb21pc2U8dm9pZD47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVN0b3JlZEZpbGVXb3JraW5nQ29weVJlc29sdmVPcHRpb25zIHtcblxuXHQvKipcblx0ICogVGhlIGNvbnRlbnRzIHRvIHVzZSBmb3IgdGhlIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weSBpZiBrbm93bi4gSWYgbm90XG5cdCAqIHByb3ZpZGVkLCB0aGUgY29udGVudHMgd2lsbCBiZSByZXRyaWV2ZWQgZnJvbSB0aGUgdW5kZXJseWluZ1xuXHQgKiByZXNvdXJjZSBvciBiYWNrdXAgaWYgcHJlc2VudC5cblx0ICpcblx0ICogSWYgY29udGVudHMgYXJlIHByb3ZpZGVkLCB0aGUgc3RvcmVkIGZpbGUgd29ya2luZyBjb3B5IHdpbGwgYmUgbWFya2VkXG5cdCAqIGFzIGRpcnR5IHJpZ2h0IGZyb20gdGhlIGJlZ2lubmluZy5cblx0ICovXG5cdHJlYWRvbmx5IGNvbnRlbnRzPzogVlNCdWZmZXJSZWFkYWJsZVN0cmVhbTtcblxuXHQvKipcblx0ICogR28gdG8gZGlzayBieXBhc3NpbmcgYW55IGNhY2hlIG9mIHRoZSBzdG9yZWQgZmlsZSB3b3JraW5nIGNvcHkgaWYgYW55LlxuXHQgKi9cblx0cmVhZG9ubHkgZm9yY2VSZWFkRnJvbUZpbGU/OiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBJZiBwcm92aWRlZCwgdGhlIHNpemUgb2YgdGhlIGZpbGUgd2lsbCBiZSBjaGVja2VkIGFnYWluc3QgdGhlIGxpbWl0c1xuXHQgKiBhbmQgYW4gZXJyb3Igd2lsbCBiZSB0aHJvd24gaWYgYW55IGxpbWl0IGlzIGV4Y2VlZGVkLlxuXHQgKi9cblx0cmVhZG9ubHkgbGltaXRzPzogSUZpbGVSZWFkTGltaXRzO1xufVxuXG4vKipcbiAqIE1ldGFkYXRhIGFzc29jaWF0ZWQgd2l0aCBhIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weSBiYWNrdXAuXG4gKi9cbmludGVyZmFjZSBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5QmFja3VwTWV0YURhdGEgZXh0ZW5kcyBJV29ya2luZ0NvcHlCYWNrdXBNZXRhIHtcblx0cmVhZG9ubHkgbXRpbWU6IG51bWJlcjtcblx0cmVhZG9ubHkgY3RpbWU6IG51bWJlcjtcblx0cmVhZG9ubHkgc2l6ZTogbnVtYmVyO1xuXHRyZWFkb25seSBldGFnOiBzdHJpbmc7XG5cdHJlYWRvbmx5IG9ycGhhbmVkOiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElTdG9yZWRGaWxlV29ya2luZ0NvcHlTYXZlRXZlbnQgZXh0ZW5kcyBJV29ya2luZ0NvcHlTYXZlRXZlbnQge1xuXG5cdC8qKlxuXHQgKiBUaGUgcmVzb2x2ZWQgc3RhdCBmcm9tIHRoZSBzYXZlIG9wZXJhdGlvbi5cblx0ICovXG5cdHJlYWRvbmx5IHN0YXQ6IElGaWxlU3RhdFdpdGhNZXRhZGF0YTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzU3RvcmVkRmlsZVdvcmtpbmdDb3B5U2F2ZUV2ZW50KGU6IElXb3JraW5nQ29weVNhdmVFdmVudCk6IGUgaXMgSVN0b3JlZEZpbGVXb3JraW5nQ29weVNhdmVFdmVudCB7XG5cdGNvbnN0IGNhbmRpZGF0ZSA9IGUgYXMgSVN0b3JlZEZpbGVXb3JraW5nQ29weVNhdmVFdmVudDtcblxuXHRyZXR1cm4gISFjYW5kaWRhdGUuc3RhdDtcbn1cblxuZXhwb3J0IGNsYXNzIFN0b3JlZEZpbGVXb3JraW5nQ29weTxNIGV4dGVuZHMgSVN0b3JlZEZpbGVXb3JraW5nQ29weU1vZGVsPiBleHRlbmRzIFJlc291cmNlV29ya2luZ0NvcHkgaW1wbGVtZW50cyBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5PE0+IHtcblxuXHRyZWFkb25seSBjYXBhYmlsaXRpZXM6IFdvcmtpbmdDb3B5Q2FwYWJpbGl0aWVzID0gV29ya2luZ0NvcHlDYXBhYmlsaXRpZXMuTm9uZTtcblxuXHRwcml2YXRlIF9tb2RlbDogTSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0Z2V0IG1vZGVsKCk6IE0gfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5fbW9kZWw7IH1cblxuXHQvLyNyZWdpb24gZXZlbnRzXG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VDb250ZW50ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlQ29udGVudCA9IHRoaXMuX29uRGlkQ2hhbmdlQ29udGVudC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFJlc29sdmUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRSZXNvbHZlID0gdGhpcy5fb25EaWRSZXNvbHZlLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlRGlydHkgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VEaXJ0eSA9IHRoaXMuX29uRGlkQ2hhbmdlRGlydHkuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRTYXZlRXJyb3IgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRTYXZlRXJyb3IgPSB0aGlzLl9vbkRpZFNhdmVFcnJvci5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFNhdmUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJU3RvcmVkRmlsZVdvcmtpbmdDb3B5U2F2ZUV2ZW50PigpKTtcblx0cmVhZG9ubHkgb25EaWRTYXZlID0gdGhpcy5fb25EaWRTYXZlLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkUmV2ZXJ0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkUmV2ZXJ0ID0gdGhpcy5fb25EaWRSZXZlcnQuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VSZWFkb25seSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVJlYWRvbmx5ID0gdGhpcy5fb25EaWRDaGFuZ2VSZWFkb25seS5ldmVudDtcblxuXHQvLyNlbmRyZWdpb25cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSB0eXBlSWQ6IHN0cmluZyxcblx0XHRyZXNvdXJjZTogVVJJLFxuXHRcdHJlYWRvbmx5IG5hbWU6IHN0cmluZyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IG1vZGVsRmFjdG9yeTogSVN0b3JlZEZpbGVXb3JraW5nQ29weU1vZGVsRmFjdG9yeTxNPixcblx0XHRwcml2YXRlIHJlYWRvbmx5IGV4dGVybmFsUmVzb2x2ZXI6IElTdG9yZWRGaWxlV29ya2luZ0NvcHlSZXNvbHZlcixcblx0XHRASUZpbGVTZXJ2aWNlIGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElXb3JraW5nQ29weUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd29ya2luZ0NvcHlGaWxlU2VydmljZTogSVdvcmtpbmdDb3B5RmlsZVNlcnZpY2UsXG5cdFx0QElGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZXNDb25maWd1cmF0aW9uU2VydmljZTogSUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElXb3JraW5nQ29weUJhY2t1cFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3JraW5nQ29weUJhY2t1cFNlcnZpY2U6IElXb3JraW5nQ29weUJhY2t1cFNlcnZpY2UsXG5cdFx0QElXb3JraW5nQ29weVNlcnZpY2Ugd29ya2luZ0NvcHlTZXJ2aWNlOiBJV29ya2luZ0NvcHlTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJV29ya2luZ0NvcHlFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd29ya2luZ0NvcHlFZGl0b3JTZXJ2aWNlOiBJV29ya2luZ0NvcHlFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJRWxldmF0ZWRGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVsZXZhdGVkRmlsZVNlcnZpY2U6IElFbGV2YXRlZEZpbGVTZXJ2aWNlLFxuXHRcdEBJUHJvZ3Jlc3NTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcHJvZ3Jlc3NTZXJ2aWNlOiBJUHJvZ3Jlc3NTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKHJlc291cmNlLCBmaWxlU2VydmljZSk7XG5cblx0XHQvLyBNYWtlIGtub3duIHRvIHdvcmtpbmcgY29weSBzZXJ2aWNlXG5cdFx0dGhpcy5fcmVnaXN0ZXIod29ya2luZ0NvcHlTZXJ2aWNlLnJlZ2lzdGVyV29ya2luZ0NvcHkodGhpcykpO1xuXG5cdFx0dGhpcy5yZWdpc3Rlckxpc3RlbmVycygpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VSZWFkb25seSgoKSA9PiB0aGlzLl9vbkRpZENoYW5nZVJlYWRvbmx5LmZpcmUoKSkpO1xuXHR9XG5cblx0Ly8jcmVnaW9uIERpcnR5XG5cblx0cHJpdmF0ZSBkaXJ0eSA9IGZhbHNlO1xuXHRwcml2YXRlIHNhdmVkVmVyc2lvbklkOiB1bmtub3duO1xuXG5cdGlzRGlydHkoKTogdGhpcyBpcyBJUmVzb2x2ZWRTdG9yZWRGaWxlV29ya2luZ0NvcHk8TT4ge1xuXHRcdHJldHVybiB0aGlzLmRpcnR5O1xuXHR9XG5cblx0bWFya01vZGlmaWVkKCk6IHZvaWQge1xuXHRcdHRoaXMuc2V0RGlydHkodHJ1ZSk7IC8vIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weSB0cmFja3MgbW9kaWZpZWQgdmlhIGRpcnR5XG5cdH1cblxuXHRwcml2YXRlIHNldERpcnR5KGRpcnR5OiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmlzUmVzb2x2ZWQoKSkge1xuXHRcdFx0cmV0dXJuOyAvLyBvbmx5IHJlc29sdmVkIHdvcmtpbmcgY29waWVzIGNhbiBiZSBtYXJrZWQgZGlydHlcblx0XHR9XG5cblx0XHQvLyBUcmFjayBkaXJ0eSBzdGF0ZSBhbmQgdmVyc2lvbiBpZFxuXHRcdGNvbnN0IHdhc0RpcnR5ID0gdGhpcy5kaXJ0eTtcblx0XHR0aGlzLmRvU2V0RGlydHkoZGlydHkpO1xuXG5cdFx0Ly8gRW1pdCBhcyBFdmVudCBpZiBkaXJ0eSBjaGFuZ2VkXG5cdFx0aWYgKGRpcnR5ICE9PSB3YXNEaXJ0eSkge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VEaXJ0eS5maXJlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBkb1NldERpcnR5KGRpcnR5OiBib29sZWFuKTogKCkgPT4gdm9pZCB7XG5cdFx0Y29uc3Qgd2FzRGlydHkgPSB0aGlzLmRpcnR5O1xuXHRcdGNvbnN0IHdhc0luQ29uZmxpY3RNb2RlID0gdGhpcy5pbkNvbmZsaWN0TW9kZTtcblx0XHRjb25zdCB3YXNJbkVycm9yTW9kZSA9IHRoaXMuaW5FcnJvck1vZGU7XG5cdFx0Y29uc3Qgb2xkU2F2ZWRWZXJzaW9uSWQgPSB0aGlzLnNhdmVkVmVyc2lvbklkO1xuXG5cdFx0aWYgKCFkaXJ0eSkge1xuXHRcdFx0dGhpcy5kaXJ0eSA9IGZhbHNlO1xuXHRcdFx0dGhpcy5pbkNvbmZsaWN0TW9kZSA9IGZhbHNlO1xuXHRcdFx0dGhpcy5pbkVycm9yTW9kZSA9IGZhbHNlO1xuXG5cdFx0XHQvLyB3ZSByZW1lbWJlciB0aGUgbW9kZWxzIGFsdGVybmF0ZSB2ZXJzaW9uIGlkIHRvIHJlbWVtYmVyIHdoZW4gdGhlIHZlcnNpb25cblx0XHRcdC8vIG9mIHRoZSBtb2RlbCBtYXRjaGVzIHdpdGggdGhlIHNhdmVkIHZlcnNpb24gb24gZGlzay4gd2UgbmVlZCB0byBrZWVwIHRoaXNcblx0XHRcdC8vIGluIG9yZGVyIHRvIGZpbmQgb3V0IGlmIHRoZSBtb2RlbCBjaGFuZ2VkIGJhY2sgdG8gYSBzYXZlZCB2ZXJzaW9uIChlLmcuXG5cdFx0XHQvLyB3aGVuIHVuZG9pbmcgbG9uZyBlbm91Z2ggdG8gcmVhY2ggdG8gYSB2ZXJzaW9uIHRoYXQgaXMgc2F2ZWQgYW5kIHRoZW4gdG9cblx0XHRcdC8vIGNsZWFyIHRoZSBkaXJ0eSBmbGFnKVxuXHRcdFx0aWYgKHRoaXMuaXNSZXNvbHZlZCgpKSB7XG5cdFx0XHRcdHRoaXMuc2F2ZWRWZXJzaW9uSWQgPSB0aGlzLm1vZGVsLnZlcnNpb25JZDtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5kaXJ0eSA9IHRydWU7XG5cdFx0fVxuXG5cdFx0Ly8gUmV0dXJuIGZ1bmN0aW9uIHRvIHJldmVydCB0aGlzIGNhbGxcblx0XHRyZXR1cm4gKCkgPT4ge1xuXHRcdFx0dGhpcy5kaXJ0eSA9IHdhc0RpcnR5O1xuXHRcdFx0dGhpcy5pbkNvbmZsaWN0TW9kZSA9IHdhc0luQ29uZmxpY3RNb2RlO1xuXHRcdFx0dGhpcy5pbkVycm9yTW9kZSA9IHdhc0luRXJyb3JNb2RlO1xuXHRcdFx0dGhpcy5zYXZlZFZlcnNpb25JZCA9IG9sZFNhdmVkVmVyc2lvbklkO1xuXHRcdH07XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gUmVzb2x2ZVxuXG5cdGxhc3RSZXNvbHZlZEZpbGVTdGF0OiBJRmlsZVN0YXRXaXRoTWV0YWRhdGEgfCB1bmRlZmluZWQ7IC8vICEhISBETyBOT1QgTUFSSyBQUklWQVRFISBVU0VEIElOIFRFU1RTICEhIVxuXG5cdGlzUmVzb2x2ZWQoKTogdGhpcyBpcyBJUmVzb2x2ZWRTdG9yZWRGaWxlV29ya2luZ0NvcHk8TT4ge1xuXHRcdHJldHVybiAhIXRoaXMubW9kZWw7XG5cdH1cblxuXHRhc3luYyByZXNvbHZlKG9wdGlvbnM/OiBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5UmVzb2x2ZU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLnRyYWNlKCdyZXNvbHZlKCkgLSBlbnRlcicpO1xuXG5cdFx0Ly8gUmV0dXJuIGVhcmx5IGlmIHdlIGFyZSBkaXNwb3NlZFxuXHRcdGlmICh0aGlzLmlzRGlzcG9zZWQoKSkge1xuXHRcdFx0dGhpcy50cmFjZSgncmVzb2x2ZSgpIC0gZXhpdCAtIHdpdGhvdXQgcmVzb2x2aW5nIGJlY2F1c2UgZmlsZSB3b3JraW5nIGNvcHkgaXMgZGlzcG9zZWQnKTtcblxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFVubGVzcyB0aGVyZSBhcmUgZXhwbGljaXQgY29udGVudHMgcHJvdmlkZWQsIGl0IGlzIGltcG9ydGFudCB0aGF0IHdlIGRvIG5vdFxuXHRcdC8vIHJlc29sdmUgYSB3b3JraW5nIGNvcHkgdGhhdCBpcyBkaXJ0eSBvciBpcyBpbiB0aGUgcHJvY2VzcyBvZiBzYXZpbmcgdG8gcHJldmVudFxuXHRcdC8vIGRhdGEgbG9zcy5cblx0XHRpZiAoIW9wdGlvbnM/LmNvbnRlbnRzICYmICh0aGlzLmRpcnR5IHx8IHRoaXMuc2F2ZVNlcXVlbnRpYWxpemVyLmlzUnVubmluZygpKSkge1xuXHRcdFx0dGhpcy50cmFjZSgncmVzb2x2ZSgpIC0gZXhpdCAtIHdpdGhvdXQgcmVzb2x2aW5nIGJlY2F1c2UgZmlsZSB3b3JraW5nIGNvcHkgaXMgZGlydHkgb3IgYmVpbmcgc2F2ZWQnKTtcblxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmRvUmVzb2x2ZShvcHRpb25zKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9SZXNvbHZlKG9wdGlvbnM/OiBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5UmVzb2x2ZU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdC8vIEZpcnN0IGNoZWNrIGlmIHdlIGhhdmUgY29udGVudHMgdG8gdXNlIGZvciB0aGUgd29ya2luZyBjb3B5XG5cdFx0aWYgKG9wdGlvbnM/LmNvbnRlbnRzKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5yZXNvbHZlRnJvbUJ1ZmZlcihvcHRpb25zLmNvbnRlbnRzKTtcblx0XHR9XG5cblx0XHQvLyBTZWNvbmQsIGNoZWNrIGlmIHdlIGhhdmUgYSBiYWNrdXAgdG8gcmVzb2x2ZSBmcm9tIChvbmx5IGZvciBuZXcgd29ya2luZyBjb3BpZXMpXG5cdFx0Y29uc3QgaXNOZXcgPSAhdGhpcy5pc1Jlc29sdmVkKCk7XG5cdFx0aWYgKGlzTmV3KSB7XG5cdFx0XHRjb25zdCByZXNvbHZlZEZyb21CYWNrdXAgPSBhd2FpdCB0aGlzLnJlc29sdmVGcm9tQmFja3VwKCk7XG5cdFx0XHRpZiAocmVzb2x2ZWRGcm9tQmFja3VwKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBGaW5hbGx5LCByZXNvbHZlIGZyb20gZmlsZSByZXNvdXJjZVxuXHRcdHJldHVybiB0aGlzLnJlc29sdmVGcm9tRmlsZShvcHRpb25zKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVzb2x2ZUZyb21CdWZmZXIoYnVmZmVyOiBWU0J1ZmZlclJlYWRhYmxlU3RyZWFtKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy50cmFjZSgncmVzb2x2ZUZyb21CdWZmZXIoKScpO1xuXG5cdFx0Ly8gVHJ5IHRvIHJlc29sdmUgbWV0ZGF0YSBmcm9tIGRpc2tcblx0XHRsZXQgbXRpbWU6IG51bWJlcjtcblx0XHRsZXQgY3RpbWU6IG51bWJlcjtcblx0XHRsZXQgc2l6ZTogbnVtYmVyO1xuXHRcdGxldCBldGFnOiBzdHJpbmc7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IG1ldGFkYXRhID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5zdGF0KHRoaXMucmVzb3VyY2UpO1xuXHRcdFx0bXRpbWUgPSBtZXRhZGF0YS5tdGltZTtcblx0XHRcdGN0aW1lID0gbWV0YWRhdGEuY3RpbWU7XG5cdFx0XHRzaXplID0gbWV0YWRhdGEuc2l6ZTtcblx0XHRcdGV0YWcgPSBtZXRhZGF0YS5ldGFnO1xuXG5cdFx0XHQvLyBDbGVhciBvcnBoYW5lZCBzdGF0ZSB3aGVuIHJlc29sdmluZyB3YXMgc3VjY2Vzc2Z1bFxuXHRcdFx0dGhpcy5zZXRPcnBoYW5lZChmYWxzZSk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblxuXHRcdFx0Ly8gUHV0IHNvbWUgZmFsbGJhY2sgdmFsdWVzIGluIGVycm9yIGNhc2Vcblx0XHRcdG10aW1lID0gRGF0ZS5ub3coKTtcblx0XHRcdGN0aW1lID0gRGF0ZS5ub3coKTtcblx0XHRcdHNpemUgPSAwO1xuXHRcdFx0ZXRhZyA9IEVUQUdfRElTQUJMRUQ7XG5cblx0XHRcdC8vIEFwcGx5IG9ycGhhbmVkIHN0YXRlIGJhc2VkIG9uIGVycm9yIGNvZGVcblx0XHRcdHRoaXMuc2V0T3JwaGFuZWQoZXJyb3IuZmlsZU9wZXJhdGlvblJlc3VsdCA9PT0gRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX05PVF9GT1VORCk7XG5cdFx0fVxuXG5cdFx0Ly8gUmVzb2x2ZSB3aXRoIGJ1ZmZlclxuXHRcdHJldHVybiB0aGlzLnJlc29sdmVGcm9tQ29udGVudCh7XG5cdFx0XHRyZXNvdXJjZTogdGhpcy5yZXNvdXJjZSxcblx0XHRcdG5hbWU6IHRoaXMubmFtZSxcblx0XHRcdG10aW1lLFxuXHRcdFx0Y3RpbWUsXG5cdFx0XHRzaXplLFxuXHRcdFx0ZXRhZyxcblx0XHRcdHZhbHVlOiBidWZmZXIsXG5cdFx0XHRyZWFkb25seTogZmFsc2UsXG5cdFx0XHRsb2NrZWQ6IGZhbHNlXG5cdFx0fSwgdHJ1ZSAvKiBkaXJ0eSAocmVzb2x2ZWQgZnJvbSBidWZmZXIpICovKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVzb2x2ZUZyb21CYWNrdXAoKTogUHJvbWlzZTxib29sZWFuPiB7XG5cblx0XHQvLyBSZXNvbHZlIGJhY2t1cCBpZiBhbnlcblx0XHRjb25zdCBiYWNrdXAgPSBhd2FpdCB0aGlzLndvcmtpbmdDb3B5QmFja3VwU2VydmljZS5yZXNvbHZlPElTdG9yZWRGaWxlV29ya2luZ0NvcHlCYWNrdXBNZXRhRGF0YT4odGhpcyk7XG5cblx0XHQvLyBBYm9ydCBpZiBzb21lb25lIGVsc2UgbWFuYWdlZCB0byByZXNvbHZlIHRoZSB3b3JraW5nIGNvcHkgYnkgbm93XG5cdFx0Y29uc3QgaXNOZXcgPSAhdGhpcy5pc1Jlc29sdmVkKCk7XG5cdFx0aWYgKCFpc05ldykge1xuXHRcdFx0dGhpcy50cmFjZSgncmVzb2x2ZUZyb21CYWNrdXAoKSAtIGV4aXQgLSB3aXRob3V0cmVzb2x2aW5nIGJlY2F1c2UgcHJldmlvdXNseSBuZXcgZmlsZSB3b3JraW5nIGNvcHkgZ290IGNyZWF0ZWQgbWVhbndoaWxlJyk7XG5cblx0XHRcdHJldHVybiB0cnVlOyAvLyBpbXBseSB0aGF0IHJlc29sdmluZyBoYXMgaGFwcGVuZWQgaW4gYW5vdGhlciBvcGVyYXRpb25cblx0XHR9XG5cblx0XHQvLyBUcnkgdG8gcmVzb2x2ZSBmcm9tIGJhY2t1cCBpZiB3ZSBoYXZlIGFueVxuXHRcdGlmIChiYWNrdXApIHtcblx0XHRcdGF3YWl0IHRoaXMuZG9SZXNvbHZlRnJvbUJhY2t1cChiYWNrdXApO1xuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvLyBPdGhlcndpc2Ugc2lnbmFsIGJhY2sgdGhhdCByZXNvbHZpbmcgZGlkIG5vdCBoYXBwZW5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvUmVzb2x2ZUZyb21CYWNrdXAoYmFja3VwOiBJUmVzb2x2ZWRXb3JraW5nQ29weUJhY2t1cDxJU3RvcmVkRmlsZVdvcmtpbmdDb3B5QmFja3VwTWV0YURhdGE+KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy50cmFjZSgnZG9SZXNvbHZlRnJvbUJhY2t1cCgpJyk7XG5cblx0XHQvLyBSZXNvbHZlIHdpdGggYmFja3VwXG5cdFx0YXdhaXQgdGhpcy5yZXNvbHZlRnJvbUNvbnRlbnQoe1xuXHRcdFx0cmVzb3VyY2U6IHRoaXMucmVzb3VyY2UsXG5cdFx0XHRuYW1lOiB0aGlzLm5hbWUsXG5cdFx0XHRtdGltZTogYmFja3VwLm1ldGEgPyBiYWNrdXAubWV0YS5tdGltZSA6IERhdGUubm93KCksXG5cdFx0XHRjdGltZTogYmFja3VwLm1ldGEgPyBiYWNrdXAubWV0YS5jdGltZSA6IERhdGUubm93KCksXG5cdFx0XHRzaXplOiBiYWNrdXAubWV0YSA/IGJhY2t1cC5tZXRhLnNpemUgOiAwLFxuXHRcdFx0ZXRhZzogYmFja3VwLm1ldGEgPyBiYWNrdXAubWV0YS5ldGFnIDogRVRBR19ESVNBQkxFRCwgLy8gZXRhZyBkaXNhYmxlZCBpZiB1bmtub3duIVxuXHRcdFx0dmFsdWU6IGJhY2t1cC52YWx1ZSxcblx0XHRcdHJlYWRvbmx5OiBmYWxzZSxcblx0XHRcdGxvY2tlZDogZmFsc2Vcblx0XHR9LCB0cnVlIC8qIGRpcnR5IChyZXNvbHZlZCBmcm9tIGJhY2t1cCkgKi8pO1xuXG5cdFx0Ly8gUmVzdG9yZSBvcnBoYW5lZCBmbGFnIGJhc2VkIG9uIHN0YXRlXG5cdFx0aWYgKGJhY2t1cC5tZXRhICYmIGJhY2t1cC5tZXRhLm9ycGhhbmVkKSB7XG5cdFx0XHR0aGlzLnNldE9ycGhhbmVkKHRydWUpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVzb2x2ZUZyb21GaWxlKG9wdGlvbnM/OiBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5UmVzb2x2ZU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLnRyYWNlKCdyZXNvbHZlRnJvbUZpbGUoKScpO1xuXG5cdFx0Y29uc3QgZm9yY2VSZWFkRnJvbUZpbGUgPSBvcHRpb25zPy5mb3JjZVJlYWRGcm9tRmlsZTtcblxuXHRcdC8vIERlY2lkZSBvbiBldGFnXG5cdFx0bGV0IGV0YWc6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRpZiAoZm9yY2VSZWFkRnJvbUZpbGUpIHtcblx0XHRcdGV0YWcgPSBFVEFHX0RJU0FCTEVEOyAvLyBkaXNhYmxlIEVUYWcgaWYgd2UgZW5mb3JjZSB0byByZWFkIGZyb20gZGlza1xuXHRcdH0gZWxzZSBpZiAodGhpcy5sYXN0UmVzb2x2ZWRGaWxlU3RhdCkge1xuXHRcdFx0ZXRhZyA9IHRoaXMubGFzdFJlc29sdmVkRmlsZVN0YXQuZXRhZzsgLy8gb3RoZXJ3aXNlIHJlc3BlY3QgZXRhZyB0byBzdXBwb3J0IGNhY2hpbmdcblx0XHR9XG5cblx0XHQvLyBSZW1lbWJlciBjdXJyZW50IHZlcnNpb24gYmVmb3JlIGRvaW5nIGFueSBsb25nIHJ1bm5pbmcgb3BlcmF0aW9uXG5cdFx0Ly8gdG8gZW5zdXJlIHdlIGFyZSBub3QgY2hhbmdpbmcgYSB3b3JraW5nIGNvcHkgdGhhdCB3YXMgY2hhbmdlZFxuXHRcdC8vIG1lYW53aGlsZVxuXHRcdGNvbnN0IGN1cnJlbnRWZXJzaW9uSWQgPSB0aGlzLnZlcnNpb25JZDtcblxuXHRcdC8vIFJlc29sdmUgQ29udGVudFxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5yZWFkRmlsZVN0cmVhbSh0aGlzLnJlc291cmNlLCB7XG5cdFx0XHRcdGV0YWcsXG5cdFx0XHRcdGxpbWl0czogb3B0aW9ucz8ubGltaXRzXG5cdFx0XHR9KTtcblxuXHRcdFx0Ly8gQ2xlYXIgb3JwaGFuZWQgc3RhdGUgd2hlbiByZXNvbHZpbmcgd2FzIHN1Y2Nlc3NmdWxcblx0XHRcdHRoaXMuc2V0T3JwaGFuZWQoZmFsc2UpO1xuXG5cdFx0XHQvLyBSZXR1cm4gZWFybHkgaWYgdGhlIHdvcmtpbmcgY29weSBjb250ZW50IGhhcyBjaGFuZ2VkXG5cdFx0XHQvLyBtZWFud2hpbGUgdG8gcHJldmVudCBsb29zaW5nIGFueSBjaGFuZ2VzXG5cdFx0XHRpZiAoY3VycmVudFZlcnNpb25JZCAhPT0gdGhpcy52ZXJzaW9uSWQpIHtcblx0XHRcdFx0dGhpcy50cmFjZSgncmVzb2x2ZUZyb21GaWxlKCkgLSBleGl0IC0gd2l0aG91dCByZXNvbHZpbmcgYmVjYXVzZSBmaWxlIHdvcmtpbmcgY29weSBjb250ZW50IGNoYW5nZWQnKTtcblxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGF3YWl0IHRoaXMucmVzb2x2ZUZyb21Db250ZW50KGNvbnRlbnQsIGZhbHNlIC8qIG5vdCBkaXJ0eSAocmVzb2x2ZWQgZnJvbSBmaWxlKSAqLyk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IGVycm9yLmZpbGVPcGVyYXRpb25SZXN1bHQ7XG5cblx0XHRcdC8vIEFwcGx5IG9ycGhhbmVkIHN0YXRlIGJhc2VkIG9uIGVycm9yIGNvZGVcblx0XHRcdHRoaXMuc2V0T3JwaGFuZWQocmVzdWx0ID09PSBGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfTk9UX0ZPVU5EKTtcblxuXHRcdFx0Ly8gTm90TW9kaWZpZWQgc3RhdHVzIGlzIGV4cGVjdGVkIGFuZCBjYW4gYmUgaGFuZGxlZCBncmFjZWZ1bGx5XG5cdFx0XHQvLyBpZiB3ZSBhcmUgcmVzb2x2ZWQuIFdlIHN0aWxsIHdhbnQgdG8gdXBkYXRlIG91ciBsYXN0IHJlc29sdmVkXG5cdFx0XHQvLyBzdGF0IHRvIGUuZy4gZGV0ZWN0IGNoYW5nZXMgdG8gdGhlIGZpbGUncyByZWFkb25seSBzdGF0ZVxuXHRcdFx0aWYgKHRoaXMuaXNSZXNvbHZlZCgpICYmIHJlc3VsdCA9PT0gRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX05PVF9NT0RJRklFRF9TSU5DRSkge1xuXHRcdFx0XHRpZiAoZXJyb3IgaW5zdGFuY2VvZiBOb3RNb2RpZmllZFNpbmNlRmlsZU9wZXJhdGlvbkVycm9yKSB7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGVMYXN0UmVzb2x2ZWRGaWxlU3RhdChlcnJvci5zdGF0KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly8gVW5sZXNzIHdlIGFyZSBmb3JjZWQgdG8gcmVhZCBmcm9tIHRoZSBmaWxlLCBpZ25vcmUgd2hlbiBhIHdvcmtpbmcgY29weSBoYXNcblx0XHRcdC8vIGJlZW4gcmVzb2x2ZWQgb25jZSBhbmQgdGhlIGZpbGUgd2FzIGRlbGV0ZWQgbWVhbndoaWxlLiBTaW5jZSB3ZSBhbHJlYWR5IGhhdmVcblx0XHRcdC8vIHRoZSB3b3JraW5nIGNvcHkgcmVzb2x2ZWQsIHdlIGNhbiByZXR1cm4gdG8gdGhpcyBzdGF0ZSBhbmQgdXBkYXRlIHRoZSBvcnBoYW5lZFxuXHRcdFx0Ly8gZmxhZyB0byBpbmRpY2F0ZSB0aGF0IHRoaXMgd29ya2luZyBjb3B5IGhhcyBubyB2ZXJzaW9uIG9uIGRpc2sgYW55bW9yZS5cblx0XHRcdGlmICh0aGlzLmlzUmVzb2x2ZWQoKSAmJiByZXN1bHQgPT09IEZpbGVPcGVyYXRpb25SZXN1bHQuRklMRV9OT1RfRk9VTkQgJiYgIWZvcmNlUmVhZEZyb21GaWxlKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly8gT3RoZXJ3aXNlIGJ1YmJsZSB1cCB0aGUgZXJyb3Jcblx0XHRcdHRocm93IGVycm9yO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVzb2x2ZUZyb21Db250ZW50KGNvbnRlbnQ6IElGaWxlU3RyZWFtQ29udGVudCwgZGlydHk6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLnRyYWNlKCdyZXNvbHZlRnJvbUNvbnRlbnQoKSAtIGVudGVyJyk7XG5cblx0XHQvLyBSZXR1cm4gZWFybHkgaWYgd2UgYXJlIGRpc3Bvc2VkXG5cdFx0aWYgKHRoaXMuaXNEaXNwb3NlZCgpKSB7XG5cdFx0XHR0aGlzLnRyYWNlKCdyZXNvbHZlRnJvbUNvbnRlbnQoKSAtIGV4aXQgLSBiZWNhdXNlIHdvcmtpbmcgY29weSBpcyBkaXNwb3NlZCcpO1xuXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gVXBkYXRlIG91ciByZXNvbHZlZCBkaXNrIHN0YXRcblx0XHR0aGlzLnVwZGF0ZUxhc3RSZXNvbHZlZEZpbGVTdGF0KHtcblx0XHRcdHJlc291cmNlOiB0aGlzLnJlc291cmNlLFxuXHRcdFx0bmFtZTogY29udGVudC5uYW1lLFxuXHRcdFx0bXRpbWU6IGNvbnRlbnQubXRpbWUsXG5cdFx0XHRjdGltZTogY29udGVudC5jdGltZSxcblx0XHRcdHNpemU6IGNvbnRlbnQuc2l6ZSxcblx0XHRcdGV0YWc6IGNvbnRlbnQuZXRhZyxcblx0XHRcdHJlYWRvbmx5OiBjb250ZW50LnJlYWRvbmx5LFxuXHRcdFx0bG9ja2VkOiBjb250ZW50LmxvY2tlZCxcblx0XHRcdGlzRmlsZTogdHJ1ZSxcblx0XHRcdGlzRGlyZWN0b3J5OiBmYWxzZSxcblx0XHRcdGlzU3ltYm9saWNMaW5rOiBmYWxzZSxcblx0XHRcdGNoaWxkcmVuOiB1bmRlZmluZWRcblx0XHR9KTtcblxuXHRcdC8vIFVwZGF0ZSBleGlzdGluZyBtb2RlbCBpZiB3ZSBoYWQgYmVlbiByZXNvbHZlZFxuXHRcdGlmICh0aGlzLmlzUmVzb2x2ZWQoKSkge1xuXHRcdFx0YXdhaXQgdGhpcy5kb1VwZGF0ZU1vZGVsKGNvbnRlbnQudmFsdWUpO1xuXHRcdH1cblxuXHRcdC8vIENyZWF0ZSBuZXcgbW9kZWwgb3RoZXJ3aXNlXG5cdFx0ZWxzZSB7XG5cdFx0XHRhd2FpdCB0aGlzLmRvQ3JlYXRlTW9kZWwoY29udGVudC52YWx1ZSk7XG5cdFx0fVxuXG5cdFx0Ly8gVXBkYXRlIHdvcmtpbmcgY29weSBkaXJ0eSBmbGFnLiBUaGlzIGlzIHZlcnkgaW1wb3J0YW50IHRvIGNhbGxcblx0XHQvLyBpbiBib3RoIGNhc2VzIG9mIGRpcnR5IG9yIG5vdCBiZWNhdXNlIGl0IGNvbmRpdGlvbmFsbHkgdXBkYXRlc1xuXHRcdC8vIHRoZSBgc2F2ZWRWZXJzaW9uSWRgIHRvIGRldGVybWluZSB0aGUgdmVyc2lvbiB3aGVuIHRvIGNvbnNpZGVyXG5cdFx0Ly8gdGhlIHdvcmtpbmcgY29weSBhcyBzYXZlZCBhZ2FpbiAoZS5nLiB3aGVuIHVuZG9pbmcgYmFjayB0byB0aGVcblx0XHQvLyBzYXZlZCBzdGF0ZSlcblx0XHR0aGlzLnNldERpcnR5KCEhZGlydHkpO1xuXG5cdFx0Ly8gRW1pdCBhcyBldmVudFxuXHRcdHRoaXMuX29uRGlkUmVzb2x2ZS5maXJlKCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvQ3JlYXRlTW9kZWwoY29udGVudHM6IFZTQnVmZmVyUmVhZGFibGVTdHJlYW0pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLnRyYWNlKCdkb0NyZWF0ZU1vZGVsKCknKTtcblxuXHRcdC8vIENyZWF0ZSBtb2RlbCBhbmQgZGlzcG9zZSBpdCB3aGVuIHdlIGdldCBkaXNwb3NlZFxuXHRcdHRoaXMuX21vZGVsID0gdGhpcy5fcmVnaXN0ZXIoYXdhaXQgdGhpcy5tb2RlbEZhY3RvcnkuY3JlYXRlTW9kZWwodGhpcy5yZXNvdXJjZSwgY29udGVudHMsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpKTtcblxuXHRcdC8vIE1vZGVsIGxpc3RlbmVyc1xuXHRcdHRoaXMuaW5zdGFsbE1vZGVsTGlzdGVuZXJzKHRoaXMuX21vZGVsKTtcblx0fVxuXG5cdHByaXZhdGUgaWdub3JlRGlydHlPbk1vZGVsQ29udGVudENoYW5nZSA9IGZhbHNlO1xuXG5cdHByaXZhdGUgYXN5bmMgZG9VcGRhdGVNb2RlbChjb250ZW50czogVlNCdWZmZXJSZWFkYWJsZVN0cmVhbSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMudHJhY2UoJ2RvVXBkYXRlTW9kZWwoKScpO1xuXG5cdFx0Ly8gVXBkYXRlIG1vZGVsIHZhbHVlIGluIGEgYmxvY2sgdGhhdCBpZ25vcmVzIGNvbnRlbnQgY2hhbmdlIGV2ZW50cyBmb3IgZGlydHkgdHJhY2tpbmdcblx0XHR0aGlzLmlnbm9yZURpcnR5T25Nb2RlbENvbnRlbnRDaGFuZ2UgPSB0cnVlO1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLm1vZGVsPy51cGRhdGUoY29udGVudHMsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLmlnbm9yZURpcnR5T25Nb2RlbENvbnRlbnRDaGFuZ2UgPSBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGluc3RhbGxNb2RlbExpc3RlbmVycyhtb2RlbDogTSk6IHZvaWQge1xuXG5cdFx0Ly8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8zMDE4OVxuXHRcdC8vIFRoaXMgY29kZSBoYXMgYmVlbiBleHRyYWN0ZWQgdG8gYSBkaWZmZXJlbnQgbWV0aG9kIGJlY2F1c2UgaXQgY2F1c2VkIGEgbWVtb3J5IGxlYWtcblx0XHQvLyB3aGVyZSBgdmFsdWVgIHdhcyBjYXB0dXJlZCBpbiB0aGUgY29udGVudCBjaGFuZ2UgbGlzdGVuZXIgY2xvc3VyZSBzY29wZS5cblxuXHRcdC8vIENvbnRlbnQgQ2hhbmdlXG5cdFx0dGhpcy5fcmVnaXN0ZXIobW9kZWwub25EaWRDaGFuZ2VDb250ZW50KGUgPT4gdGhpcy5vbk1vZGVsQ29udGVudENoYW5nZWQobW9kZWwsIGUuaXNVbmRvaW5nIHx8IGUuaXNSZWRvaW5nKSkpO1xuXG5cdFx0Ly8gTGlmZWN5Y2xlXG5cdFx0dGhpcy5fcmVnaXN0ZXIobW9kZWwub25XaWxsRGlzcG9zZSgoKSA9PiB0aGlzLmRpc3Bvc2UoKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbk1vZGVsQ29udGVudENoYW5nZWQobW9kZWw6IE0sIGlzVW5kb2luZ09yUmVkb2luZzogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMudHJhY2UoYG9uTW9kZWxDb250ZW50Q2hhbmdlZCgpIC0gZW50ZXJgKTtcblxuXHRcdC8vIEluIGFueSBjYXNlIGluY3JlbWVudCB0aGUgdmVyc2lvbiBpZCBiZWNhdXNlIGl0IHRyYWNrcyB0aGUgY29udGVudCBzdGF0ZSBvZiB0aGUgbW9kZWwgYXQgYWxsIHRpbWVzXG5cdFx0dGhpcy52ZXJzaW9uSWQrKztcblx0XHR0aGlzLnRyYWNlKGBvbk1vZGVsQ29udGVudENoYW5nZWQoKSAtIG5ldyB2ZXJzaW9uSWQgJHt0aGlzLnZlcnNpb25JZH1gKTtcblxuXHRcdC8vIFJlbWVtYmVyIHdoZW4gdGhlIHVzZXIgY2hhbmdlZCB0aGUgbW9kZWwgdGhyb3VnaCBhIHVuZG8vcmVkbyBvcGVyYXRpb24uXG5cdFx0Ly8gV2UgbmVlZCB0aGlzIGluZm9ybWF0aW9uIHRvIHRocm90dGxlIHNhdmUgcGFydGljaXBhbnRzIHRvIGZpeFxuXHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMDI1NDJcblx0XHRpZiAoaXNVbmRvaW5nT3JSZWRvaW5nKSB7XG5cdFx0XHR0aGlzLmxhc3RDb250ZW50Q2hhbmdlRnJvbVVuZG9SZWRvID0gRGF0ZS5ub3coKTtcblx0XHR9XG5cblx0XHQvLyBXZSBtYXJrIGNoZWNrIGZvciBhIGRpcnR5LXN0YXRlIGNoYW5nZSB1cG9uIG1vZGVsIGNvbnRlbnQgY2hhbmdlLCB1bmxlc3M6XG5cdFx0Ly8gLSBleHBsaWNpdGx5IGluc3RydWN0ZWQgdG8gaWdub3JlIGl0IChlLmcuIGZyb20gbW9kZWwucmVzb2x2ZSgpKVxuXHRcdC8vIC0gdGhlIG1vZGVsIGlzIHJlYWRvbmx5IChpbiB0aGF0IGNhc2Ugd2UgbmV2ZXIgYXNzdW1lIHRoZSBjaGFuZ2Ugd2FzIGRvbmUgYnkgdGhlIHVzZXIpXG5cdFx0aWYgKCF0aGlzLmlnbm9yZURpcnR5T25Nb2RlbENvbnRlbnRDaGFuZ2UgJiYgIXRoaXMuaXNSZWFkb25seSgpKSB7XG5cblx0XHRcdC8vIFRoZSBjb250ZW50cyBjaGFuZ2VkIGFzIGEgbWF0dGVyIG9mIFVuZG8gYW5kIHRoZSB2ZXJzaW9uIHJlYWNoZWQgbWF0Y2hlcyB0aGUgc2F2ZWQgb25lXG5cdFx0XHQvLyBJbiB0aGlzIGNhc2Ugd2UgY2xlYXIgdGhlIGRpcnR5IGZsYWcgYW5kIGVtaXQgYSBTQVZFRCBldmVudCB0byBpbmRpY2F0ZSB0aGlzIHN0YXRlLlxuXHRcdFx0aWYgKG1vZGVsLnZlcnNpb25JZCA9PT0gdGhpcy5zYXZlZFZlcnNpb25JZCkge1xuXHRcdFx0XHR0aGlzLnRyYWNlKCdvbk1vZGVsQ29udGVudENoYW5nZWQoKSAtIG1vZGVsIGNvbnRlbnQgY2hhbmdlZCBiYWNrIHRvIGxhc3Qgc2F2ZWQgdmVyc2lvbicpO1xuXG5cdFx0XHRcdC8vIENsZWFyIGZsYWdzXG5cdFx0XHRcdGNvbnN0IHdhc0RpcnR5ID0gdGhpcy5kaXJ0eTtcblx0XHRcdFx0dGhpcy5zZXREaXJ0eShmYWxzZSk7XG5cblx0XHRcdFx0Ly8gRW1pdCByZXZlcnQgZXZlbnQgaWYgd2Ugd2VyZSBkaXJ0eVxuXHRcdFx0XHRpZiAod2FzRGlydHkpIHtcblx0XHRcdFx0XHR0aGlzLl9vbkRpZFJldmVydC5maXJlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gT3RoZXJ3aXNlIHRoZSBjb250ZW50IGhhcyBjaGFuZ2VkIGFuZCB3ZSBzaWduYWwgdGhpcyBhcyBiZWNvbWluZyBkaXJ0eVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdHRoaXMudHJhY2UoJ29uTW9kZWxDb250ZW50Q2hhbmdlZCgpIC0gbW9kZWwgY29udGVudCBjaGFuZ2VkIGFuZCBtYXJrZWQgYXMgZGlydHknKTtcblxuXHRcdFx0XHQvLyBNYXJrIGFzIGRpcnR5XG5cdFx0XHRcdHRoaXMuc2V0RGlydHkodHJ1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gRW1pdCBhcyBldmVudFxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlQ29udGVudC5maXJlKCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGZvcmNlUmVzb2x2ZUZyb21GaWxlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLmlzRGlzcG9zZWQoKSkge1xuXHRcdFx0cmV0dXJuOyAvLyByZXR1cm4gZWFybHkgd2hlbiB0aGUgd29ya2luZyBjb3B5IGlzIGludmFsaWRcblx0XHR9XG5cblx0XHQvLyBXZSBnbyB0aHJvdWdoIHRoZSByZXNvbHZlciB0byBtYWtlXG5cdFx0Ly8gc3VyZSB0aGlzIGtpbmQgb2YgYHJlc29sdmVgIGlzIHByb3Blcmx5XG5cdFx0Ly8gcnVubmluZyBpbiBzZXF1ZW5jZSB3aXRoIGFueSBvdGhlciBydW5uaW5nXG5cdFx0Ly8gYHJlc29sdmVgIGlmIGFueSwgaW5jbHVkaW5nIHN1YnNlcXVlbnQgcnVuc1xuXHRcdC8vIHRoYXQgYXJlIHRyaWdnZXJlZCByaWdodCBhZnRlci5cblxuXHRcdGF3YWl0IHRoaXMuZXh0ZXJuYWxSZXNvbHZlcih7XG5cdFx0XHRmb3JjZVJlYWRGcm9tRmlsZTogdHJ1ZVxuXHRcdH0pO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIEJhY2t1cFxuXG5cdGdldCBiYWNrdXBEZWxheSgpOiBudW1iZXIgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLm1vZGVsPy5jb25maWd1cmF0aW9uPy5iYWNrdXBEZWxheTtcblx0fVxuXG5cdGFzeW5jIGJhY2t1cCh0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElXb3JraW5nQ29weUJhY2t1cD4ge1xuXG5cdFx0Ly8gRmlsbCBpbiBtZXRhZGF0YSBpZiB3ZSBhcmUgcmVzb2x2ZWRcblx0XHRsZXQgbWV0YTogSVN0b3JlZEZpbGVXb3JraW5nQ29weUJhY2t1cE1ldGFEYXRhIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGlmICh0aGlzLmxhc3RSZXNvbHZlZEZpbGVTdGF0KSB7XG5cdFx0XHRtZXRhID0ge1xuXHRcdFx0XHRtdGltZTogdGhpcy5sYXN0UmVzb2x2ZWRGaWxlU3RhdC5tdGltZSxcblx0XHRcdFx0Y3RpbWU6IHRoaXMubGFzdFJlc29sdmVkRmlsZVN0YXQuY3RpbWUsXG5cdFx0XHRcdHNpemU6IHRoaXMubGFzdFJlc29sdmVkRmlsZVN0YXQuc2l6ZSxcblx0XHRcdFx0ZXRhZzogdGhpcy5sYXN0UmVzb2x2ZWRGaWxlU3RhdC5ldGFnLFxuXHRcdFx0XHRvcnBoYW5lZDogdGhpcy5pc09ycGhhbmVkKClcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gRmlsbCBpbiBjb250ZW50IGlmIHdlIGFyZSByZXNvbHZlZFxuXHRcdGxldCBjb250ZW50OiBWU0J1ZmZlclJlYWRhYmxlU3RyZWFtIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGlmICh0aGlzLmlzUmVzb2x2ZWQoKSkge1xuXHRcdFx0Y29udGVudCA9IGF3YWl0IHJhY2VDYW5jZWxsYXRpb24odGhpcy5tb2RlbC5zbmFwc2hvdChTbmFwc2hvdENvbnRleHQuQmFja3VwLCB0b2tlbiksIHRva2VuKTtcblx0XHR9XG5cblx0XHRyZXR1cm4geyBtZXRhLCBjb250ZW50IH07XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gU2F2ZVxuXG5cdHByaXZhdGUgdmVyc2lvbklkID0gMDtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBVTkRPX1JFRE9fU0FWRV9QQVJUSUNJUEFOVFNfQVVUT19TQVZFX1RIUk9UVExFX1RIUkVTSE9MRCA9IDUwMDtcblx0cHJpdmF0ZSBsYXN0Q29udGVudENoYW5nZUZyb21VbmRvUmVkbzogbnVtYmVyIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgc2F2ZVNlcXVlbnRpYWxpemVyID0gbmV3IFRhc2tTZXF1ZW50aWFsaXplcigpO1xuXG5cdHByaXZhdGUgaWdub3JlU2F2ZUZyb21TYXZlUGFydGljaXBhbnRzID0gZmFsc2U7XG5cblx0YXN5bmMgc2F2ZShvcHRpb25zOiBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5U2F2ZUFzT3B0aW9ucyA9IE9iamVjdC5jcmVhdGUobnVsbCkpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRpZiAoIXRoaXMuaXNSZXNvbHZlZCgpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuaXNSZWFkb25seSgpKSB7XG5cdFx0XHR0aGlzLnRyYWNlKCdzYXZlKCkgLSBpZ25vcmluZyByZXF1ZXN0IGZvciByZWFkb25seSByZXNvdXJjZScpO1xuXG5cdFx0XHRyZXR1cm4gZmFsc2U7IC8vIGlmIHdvcmtpbmcgY29weSBpcyByZWFkb25seSB3ZSBkbyBub3QgYXR0ZW1wdCB0byBzYXZlIGF0IGFsbFxuXHRcdH1cblxuXHRcdGlmIChcblx0XHRcdCh0aGlzLmhhc1N0YXRlKFN0b3JlZEZpbGVXb3JraW5nQ29weVN0YXRlLkNPTkZMSUNUKSB8fCB0aGlzLmhhc1N0YXRlKFN0b3JlZEZpbGVXb3JraW5nQ29weVN0YXRlLkVSUk9SKSkgJiZcblx0XHRcdChvcHRpb25zLnJlYXNvbiA9PT0gU2F2ZVJlYXNvbi5BVVRPIHx8IG9wdGlvbnMucmVhc29uID09PSBTYXZlUmVhc29uLkZPQ1VTX0NIQU5HRSB8fCBvcHRpb25zLnJlYXNvbiA9PT0gU2F2ZVJlYXNvbi5XSU5ET1dfQ0hBTkdFKVxuXHRcdCkge1xuXHRcdFx0dGhpcy50cmFjZSgnc2F2ZSgpIC0gaWdub3JpbmcgYXV0byBzYXZlIHJlcXVlc3QgZm9yIGZpbGUgd29ya2luZyBjb3B5IHRoYXQgaXMgaW4gY29uZmxpY3Qgb3IgZXJyb3InKTtcblxuXHRcdFx0cmV0dXJuIGZhbHNlOyAvLyBpZiB3b3JraW5nIGNvcHkgaXMgaW4gc2F2ZSBjb25mbGljdCBvciBlcnJvciwgZG8gbm90IHNhdmUgdW5sZXNzIHNhdmUgcmVhc29uIGlzIGV4cGxpY2l0XG5cdFx0fVxuXG5cdFx0Ly8gQWN0dWFsbHkgZG8gc2F2ZVxuXHRcdHRoaXMudHJhY2UoJ3NhdmUoKSAtIGVudGVyJyk7XG5cdFx0YXdhaXQgdGhpcy5kb1NhdmUob3B0aW9ucyk7XG5cdFx0dGhpcy50cmFjZSgnc2F2ZSgpIC0gZXhpdCcpO1xuXG5cdFx0cmV0dXJuIHRoaXMuaGFzU3RhdGUoU3RvcmVkRmlsZVdvcmtpbmdDb3B5U3RhdGUuU0FWRUQpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb1NhdmUob3B0aW9uczogSVN0b3JlZEZpbGVXb3JraW5nQ29weVNhdmVBc09wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodHlwZW9mIG9wdGlvbnMucmVhc29uICE9PSAnbnVtYmVyJykge1xuXHRcdFx0b3B0aW9ucy5yZWFzb24gPSBTYXZlUmVhc29uLkVYUExJQ0lUO1xuXHRcdH1cblxuXHRcdGNvbnN0IHZlcnNpb25JZCA9IHRoaXMudmVyc2lvbklkO1xuXHRcdHRoaXMudHJhY2UoYGRvU2F2ZSgke3ZlcnNpb25JZH0pIC0gZW50ZXIgd2l0aCB2ZXJzaW9uSWQgJHt2ZXJzaW9uSWR9YCk7XG5cblx0XHQvLyBSZXR1cm4gZWFybHkgaWYgc2F2ZWQgZnJvbSB3aXRoaW4gc2F2ZSBwYXJ0aWNpcGFudCB0byBicmVhayByZWN1cnNpb25cblx0XHQvL1xuXHRcdC8vIFNjZW5hcmlvOiBhIHNhdmUgcGFydGljaXBhbnQgdHJpZ2dlcnMgYSBzYXZlKCkgb24gdGhlIHdvcmtpbmcgY29weVxuXHRcdGlmICh0aGlzLmlnbm9yZVNhdmVGcm9tU2F2ZVBhcnRpY2lwYW50cykge1xuXHRcdFx0dGhpcy50cmFjZShgZG9TYXZlKCR7dmVyc2lvbklkfSkgLSBleGl0IC0gcmVmdXNpbmcgdG8gc2F2ZSgpIHJlY3Vyc2l2ZWx5IGZyb20gc2F2ZSBwYXJ0aWNpcGFudGApO1xuXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gTG9va3VwIGFueSBydW5uaW5nIHNhdmUgZm9yIHRoaXMgdmVyc2lvbklkIGFuZCByZXR1cm4gaXQgaWYgZm91bmRcblx0XHQvL1xuXHRcdC8vIFNjZW5hcmlvOiB1c2VyIGludm9rZWQgdGhlIHNhdmUgYWN0aW9uIG11bHRpcGxlIHRpbWVzIHF1aWNrbHkgZm9yIHRoZSBzYW1lIGNvbnRlbnRzXG5cdFx0Ly8gICAgICAgICAgIHdoaWxlIHRoZSBzYXZlIHdhcyBub3QgeWV0IGZpbmlzaGVkIHRvIGRpc2tcblx0XHQvL1xuXHRcdGlmICh0aGlzLnNhdmVTZXF1ZW50aWFsaXplci5pc1J1bm5pbmcodmVyc2lvbklkKSkge1xuXHRcdFx0dGhpcy50cmFjZShgZG9TYXZlKCR7dmVyc2lvbklkfSkgLSBleGl0IC0gZm91bmQgYSBydW5uaW5nIHNhdmUgZm9yIHZlcnNpb25JZCAke3ZlcnNpb25JZH1gKTtcblxuXHRcdFx0cmV0dXJuIHRoaXMuc2F2ZVNlcXVlbnRpYWxpemVyLnJ1bm5pbmc7XG5cdFx0fVxuXG5cdFx0Ly8gUmV0dXJuIGVhcmx5IGlmIG5vdCBkaXJ0eSAodW5sZXNzIGZvcmNlZClcblx0XHQvL1xuXHRcdC8vIFNjZW5hcmlvOiB1c2VyIGludm9rZWQgc2F2ZSBhY3Rpb24gZXZlbiB0aG91Z2ggdGhlIHdvcmtpbmcgY29weSBpcyBub3QgZGlydHlcblx0XHRpZiAoIW9wdGlvbnMuZm9yY2UgJiYgIXRoaXMuZGlydHkpIHtcblx0XHRcdHRoaXMudHJhY2UoYGRvU2F2ZSgke3ZlcnNpb25JZH0pIC0gZXhpdCAtIGJlY2F1c2Ugbm90IGRpcnR5IGFuZC9vciB2ZXJzaW9uSWQgaXMgZGlmZmVyZW50ICh0aGlzLmlzRGlydHk6ICR7dGhpcy5kaXJ0eX0sIHRoaXMudmVyc2lvbklkOiAke3RoaXMudmVyc2lvbklkfSlgKTtcblxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFJldHVybiBpZiBjdXJyZW50bHkgc2F2aW5nIGJ5IHN0b3JpbmcgdGhpcyBzYXZlIHJlcXVlc3QgYXMgdGhlIG5leHQgc2F2ZSB0aGF0IHNob3VsZCBoYXBwZW4uXG5cdFx0Ly8gTmV2ZXIgZXZlciBtdXN0IDIgc2F2ZXMgZXhlY3V0ZSBhdCB0aGUgc2FtZSB0aW1lIGJlY2F1c2UgdGhpcyBjYW4gbGVhZCB0byBkaXJ0eSB3cml0ZXMgYW5kIHJhY2UgY29uZGl0aW9ucy5cblx0XHQvL1xuXHRcdC8vIFNjZW5hcmlvIEE6IGF1dG8gc2F2ZSB3YXMgdHJpZ2dlcmVkIGFuZCBpcyBjdXJyZW50bHkgYnVzeSBzYXZpbmcgdG8gZGlzay4gdGhpcyB0YWtlcyBsb25nIGVub3VnaCB0aGF0IGFub3RoZXIgYXV0byBzYXZlXG5cdFx0Ly8gICAgICAgICAgICAga2lja3MgaW4uXG5cdFx0Ly8gU2NlbmFyaW8gQjogc2F2ZSBpcyB2ZXJ5IHNsb3cgKGUuZy4gbmV0d29yayBzaGFyZSkgYW5kIHRoZSB1c2VyIG1hbmFnZXMgdG8gY2hhbmdlIHRoZSB3b3JraW5nIGNvcHkgYW5kIHRyaWdnZXIgYW5vdGhlciBzYXZlXG5cdFx0Ly8gICAgICAgICAgICAgd2hpbGUgdGhlIGZpcnN0IHNhdmUgaGFzIG5vdCByZXR1cm5lZCB5ZXQuXG5cdFx0Ly9cblx0XHRpZiAodGhpcy5zYXZlU2VxdWVudGlhbGl6ZXIuaXNSdW5uaW5nKCkpIHtcblx0XHRcdHRoaXMudHJhY2UoYGRvU2F2ZSgke3ZlcnNpb25JZH0pIC0gZXhpdCAtIGJlY2F1c2UgYnVzeSBzYXZpbmdgKTtcblxuXHRcdFx0Ly8gSW5kaWNhdGUgdG8gdGhlIHNhdmUgc2VxdWVudGlhbGl6ZXIgdGhhdCB3ZSB3YW50IHRvXG5cdFx0XHQvLyBjYW5jZWwgdGhlIHJ1bm5pbmcgb3BlcmF0aW9uIHNvIHRoYXQgb3VycyBjYW4gcnVuXG5cdFx0XHQvLyBiZWZvcmUgdGhlIHJ1bm5pbmcgb25lIGZpbmlzaGVzLlxuXHRcdFx0Ly8gQ3VycmVudGx5IHRoaXMgd2lsbCB0cnkgdG8gY2FuY2VsIHJ1bm5pbmcgc2F2ZVxuXHRcdFx0Ly8gcGFydGljaXBhbnRzIGFuZCBydW5uaW5nIHNuYXBzaG90cyBmcm9tIHRoZVxuXHRcdFx0Ly8gc2F2ZSBvcGVyYXRpb24sIGJ1dCBub3QgdGhlIGFjdHVhbCBzYXZlIHdoaWNoIGRvZXNcblx0XHRcdC8vIG5vdCBzdXBwb3J0IGNhbmNlbGxhdGlvbiB5ZXQuXG5cdFx0XHR0aGlzLnNhdmVTZXF1ZW50aWFsaXplci5jYW5jZWxSdW5uaW5nKCk7XG5cblx0XHRcdC8vIFF1ZXVlIHRoaXMgYXMgdGhlIHVwY29taW5nIHNhdmUgYW5kIHJldHVyblxuXHRcdFx0cmV0dXJuIHRoaXMuc2F2ZVNlcXVlbnRpYWxpemVyLnF1ZXVlKCgpID0+IHRoaXMuZG9TYXZlKG9wdGlvbnMpKTtcblx0XHR9XG5cblx0XHQvLyBQdXNoIGFsbCBlZGl0IG9wZXJhdGlvbnMgdG8gdGhlIHVuZG8gc3RhY2sgc28gdGhhdCB0aGUgdXNlciBoYXMgYSBjaGFuY2UgdG9cblx0XHQvLyBDdHJsK1ogYmFjayB0byB0aGUgc2F2ZWQgdmVyc2lvbi5cblx0XHRpZiAodGhpcy5pc1Jlc29sdmVkKCkpIHtcblx0XHRcdHRoaXMubW9kZWwucHVzaFN0YWNrRWxlbWVudCgpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNhdmVDYW5jZWxsYXRpb24gPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblxuXHRcdHJldHVybiB0aGlzLnByb2dyZXNzU2VydmljZS53aXRoUHJvZ3Jlc3Moe1xuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdzYXZlUGFydGljaXBhbnRzJywgXCJTYXZpbmcgJ3swfSdcIiwgdGhpcy5uYW1lKSxcblx0XHRcdGxvY2F0aW9uOiBQcm9ncmVzc0xvY2F0aW9uLldpbmRvdyxcblx0XHRcdGNhbmNlbGxhYmxlOiB0cnVlLFxuXHRcdFx0ZGVsYXk6IHRoaXMuaXNEaXJ0eSgpID8gMzAwMCA6IDUwMDBcblx0XHR9LCBwcm9ncmVzcyA9PiB7XG5cdFx0XHRyZXR1cm4gdGhpcy5kb1NhdmVTZXF1ZW50aWFsKHZlcnNpb25JZCwgb3B0aW9ucywgcHJvZ3Jlc3MsIHNhdmVDYW5jZWxsYXRpb24pO1xuXHRcdH0sICgpID0+IHtcblx0XHRcdHNhdmVDYW5jZWxsYXRpb24uY2FuY2VsKCk7XG5cdFx0fSkuZmluYWxseSgoKSA9PiB7XG5cdFx0XHRzYXZlQ2FuY2VsbGF0aW9uLmRpc3Bvc2UoKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgZG9TYXZlU2VxdWVudGlhbCh2ZXJzaW9uSWQ6IG51bWJlciwgb3B0aW9uczogSVN0b3JlZEZpbGVXb3JraW5nQ29weVNhdmVBc09wdGlvbnMsIHByb2dyZXNzOiBJUHJvZ3Jlc3M8SVByb2dyZXNzU3RlcD4sIHNhdmVDYW5jZWxsYXRpb246IENhbmNlbGxhdGlvblRva2VuU291cmNlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuc2F2ZVNlcXVlbnRpYWxpemVyLnJ1bih2ZXJzaW9uSWQsIChhc3luYyAoKSA9PiB7XG5cblx0XHRcdC8vIEEgc2F2ZSBwYXJ0aWNpcGFudCBjYW4gc3RpbGwgY2hhbmdlIHRoZSB3b3JraW5nIGNvcHkgbm93XG5cdFx0XHQvLyBhbmQgc2luY2Ugd2UgYXJlIHNvIGNsb3NlIHRvIHNhdmluZyB3ZSBkbyBub3Qgd2FudCB0byB0cmlnZ2VyXG5cdFx0XHQvLyBhbm90aGVyIGF1dG8gc2F2ZSBvciBzaW1pbGFyLCBzbyB3ZSBibG9jayB0aGlzXG5cdFx0XHQvLyBJbiBhZGRpdGlvbiB3ZSB1cGRhdGUgb3VyIHZlcnNpb24gcmlnaHQgYWZ0ZXIgaW4gY2FzZSBpdCBjaGFuZ2VkXG5cdFx0XHQvLyBiZWNhdXNlIG9mIGEgd29ya2luZyBjb3B5IGNoYW5nZVxuXHRcdFx0Ly8gU2F2ZSBwYXJ0aWNpcGFudHMgY2FuIGFsc28gYmUgc2tpcHBlZCB0aHJvdWdoIEFQSS5cblx0XHRcdGlmICh0aGlzLmlzUmVzb2x2ZWQoKSAmJiAhb3B0aW9ucy5za2lwU2F2ZVBhcnRpY2lwYW50cyAmJiB0aGlzLndvcmtpbmdDb3B5RmlsZVNlcnZpY2UuaGFzU2F2ZVBhcnRpY2lwYW50cykge1xuXHRcdFx0XHR0cnkge1xuXG5cdFx0XHRcdFx0Ly8gTWVhc3VyZSB0aGUgdGltZSBpdCB0b29rIGZyb20gdGhlIGxhc3QgdW5kby9yZWRvIG9wZXJhdGlvbiB0byB0aGlzIHNhdmUuIElmIHRoaXNcblx0XHRcdFx0XHQvLyB0aW1lIGlzIGJlbG93IGBVTkRPX1JFRE9fU0FWRV9QQVJUSUNJUEFOVFNfVEhST1RUTEVfVEhSRVNIT0xEYCwgd2UgbWFrZSBzdXJlIHRvXG5cdFx0XHRcdFx0Ly8gZGVsYXkgdGhlIHNhdmUgcGFydGljaXBhbnQgZm9yIHRoZSByZW1haW5pbmcgdGltZSBpZiB0aGUgcmVhc29uIGlzIGF1dG8gc2F2ZS5cblx0XHRcdFx0XHQvL1xuXHRcdFx0XHRcdC8vIFRoaXMgZml4ZXMgdGhlIGZvbGxvd2luZyBpc3N1ZTpcblx0XHRcdFx0XHQvLyAtIHRoZSB1c2VyIGhhcyBjb25maWd1cmVkIGF1dG8gc2F2ZSB3aXRoIGRlbGF5IG9mIDEwMG1zIG9yIHNob3J0ZXJcblx0XHRcdFx0XHQvLyAtIHRoZSB1c2VyIGhhcyBhIHNhdmUgcGFydGljaXBhbnQgZW5hYmxlZCB0aGF0IG1vZGlmaWVzIHRoZSBmaWxlIG9uIGVhY2ggc2F2ZVxuXHRcdFx0XHRcdC8vIC0gdGhlIHVzZXIgdHlwZXMgaW50byB0aGUgZmlsZSBhbmQgdGhlIGZpbGUgZ2V0cyBzYXZlZFxuXHRcdFx0XHRcdC8vIC0gdGhlIHVzZXIgdHJpZ2dlcnMgdW5kbyBvcGVyYXRpb25cblx0XHRcdFx0XHQvLyAtIHRoaXMgd2lsbCB1bmRvIHRoZSBzYXZlIHBhcnRpY2lwYW50IGNoYW5nZSBidXQgdHJpZ2dlciB0aGUgc2F2ZSBwYXJ0aWNpcGFudCByaWdodCBhZnRlclxuXHRcdFx0XHRcdC8vIC0gdGhlIHVzZXIgaGFzIG5vIGNoYW5jZSB0byB1bmRvIG92ZXIgdGhlIHNhdmUgcGFydGljaXBhbnRcblx0XHRcdFx0XHQvL1xuXHRcdFx0XHRcdC8vIFJlcG9ydGVkIGFzOiBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTAyNTQyXG5cdFx0XHRcdFx0aWYgKG9wdGlvbnMucmVhc29uID09PSBTYXZlUmVhc29uLkFVVE8gJiYgdHlwZW9mIHRoaXMubGFzdENvbnRlbnRDaGFuZ2VGcm9tVW5kb1JlZG8gPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdFx0XHRjb25zdCB0aW1lRnJvbVVuZG9SZWRvVG9TYXZlID0gRGF0ZS5ub3coKSAtIHRoaXMubGFzdENvbnRlbnRDaGFuZ2VGcm9tVW5kb1JlZG87XG5cdFx0XHRcdFx0XHRpZiAodGltZUZyb21VbmRvUmVkb1RvU2F2ZSA8IFN0b3JlZEZpbGVXb3JraW5nQ29weS5VTkRPX1JFRE9fU0FWRV9QQVJUSUNJUEFOVFNfQVVUT19TQVZFX1RIUk9UVExFX1RIUkVTSE9MRCkge1xuXHRcdFx0XHRcdFx0XHRhd2FpdCB0aW1lb3V0KFN0b3JlZEZpbGVXb3JraW5nQ29weS5VTkRPX1JFRE9fU0FWRV9QQVJUSUNJUEFOVFNfQVVUT19TQVZFX1RIUk9UVExFX1RIUkVTSE9MRCAtIHRpbWVGcm9tVW5kb1JlZG9Ub1NhdmUpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vIFJ1biBzYXZlIHBhcnRpY2lwYW50cyB1bmxlc3Mgc2F2ZSB3YXMgY2FuY2VsbGVkIG1lYW53aGlsZVxuXHRcdFx0XHRcdGlmICghc2F2ZUNhbmNlbGxhdGlvbi50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdFx0dGhpcy5pZ25vcmVTYXZlRnJvbVNhdmVQYXJ0aWNpcGFudHMgPSB0cnVlO1xuXHRcdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdFx0YXdhaXQgdGhpcy53b3JraW5nQ29weUZpbGVTZXJ2aWNlLnJ1blNhdmVQYXJ0aWNpcGFudHModGhpcywgeyByZWFzb246IG9wdGlvbnMucmVhc29uID8/IFNhdmVSZWFzb24uRVhQTElDSVQsIHNhdmVkRnJvbTogb3B0aW9ucy5mcm9tIH0sIHByb2dyZXNzLCBzYXZlQ2FuY2VsbGF0aW9uLnRva2VuKTtcblx0XHRcdFx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHRcdFx0XHRpZiAoaXNDYW5jZWxsYXRpb25FcnJvcihlcnIpICYmICFzYXZlQ2FuY2VsbGF0aW9uLnRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0XHRcdFx0Ly8gcGFydGljaXBhbnQgd2FudHMgdG8gY2FuY2VsIHRoaXMgb3BlcmF0aW9uXG5cdFx0XHRcdFx0XHRcdFx0c2F2ZUNhbmNlbGxhdGlvbi5jYW5jZWwoKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0XHRcdFx0dGhpcy5pZ25vcmVTYXZlRnJvbVNhdmVQYXJ0aWNpcGFudHMgPSBmYWxzZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGBbc3RvcmVkIGZpbGUgd29ya2luZyBjb3B5XSBydW5TYXZlUGFydGljaXBhbnRzKCR7dmVyc2lvbklkfSkgLSByZXN1bHRlZCBpbiBhbiBlcnJvcjogJHtlcnJvci50b1N0cmluZygpfWAsIHRoaXMucmVzb3VyY2UudG9TdHJpbmcoKSwgdGhpcy50eXBlSWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIEl0IGlzIHBvc3NpYmxlIHRoYXQgYSBzdWJzZXF1ZW50IHNhdmUgaXMgY2FuY2VsbGluZyB0aGlzXG5cdFx0XHQvLyBydW5uaW5nIHNhdmUuIEFzIHN1Y2ggd2UgcmV0dXJuIGVhcmx5IHdoZW4gd2UgZGV0ZWN0IHRoYXQuXG5cdFx0XHRpZiAoc2F2ZUNhbmNlbGxhdGlvbi50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIFdlIGhhdmUgdG8gcHJvdGVjdCBhZ2FpbnN0IGJlaW5nIGRpc3Bvc2VkIGF0IHRoaXMgcG9pbnQuIEl0IGNvdWxkIGJlIHRoYXQgdGhlIHNhdmUoKSBvcGVyYXRpb25cblx0XHRcdC8vIHdhcyB0cmlnZ2VyZCBmb2xsb3dlZCBieSBhIGRpc3Bvc2UoKSBvcGVyYXRpb24gcmlnaHQgYWZ0ZXIgd2l0aG91dCB3YWl0aW5nLiBUeXBpY2FsbHkgd2UgY2Fubm90XG5cdFx0XHQvLyBiZSBkaXNwb3NlZCBpZiB3ZSBhcmUgZGlydHksIGJ1dCBpZiB3ZSBhcmUgbm90IGRpcnR5LCBzYXZlKCkgYW5kIGRpc3Bvc2UoKSBjYW4gc3RpbGwgYmUgdHJpZ2dlcmVkXG5cdFx0XHQvLyBvbmUgYWZ0ZXIgdGhlIG90aGVyIHdpdGhvdXQgd2FpdGluZyBmb3IgdGhlIHNhdmUoKSB0byBjb21wbGV0ZS4gSWYgd2UgYXJlIGRpc3Bvc2VkKCksIHdlIHJpc2tcblx0XHRcdC8vIHNhdmluZyBjb250ZW50cyB0byBkaXNrIHRoYXQgYXJlIHN0YWxlIChzZWUgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzUwOTQyKS5cblx0XHRcdC8vIFRvIGZpeCB0aGlzIGlzc3VlLCB3ZSB3aWxsIG5vdCBzdG9yZSB0aGUgY29udGVudHMgdG8gZGlzayB3aGVuIHdlIGdvdCBkaXNwb3NlZC5cblx0XHRcdGlmICh0aGlzLmlzRGlzcG9zZWQoKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIFdlIHJlcXVpcmUgYSByZXNvbHZlZCB3b3JraW5nIGNvcHkgZnJvbSB0aGlzIHBvaW50IG9uLCBzaW5jZSB3ZSBhcmUgYWJvdXQgdG8gd3JpdGUgZGF0YSB0byBkaXNrLlxuXHRcdFx0aWYgKCF0aGlzLmlzUmVzb2x2ZWQoKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIHVwZGF0ZSB2ZXJzaW9uSWQgd2l0aCBpdHMgbmV3IHZhbHVlIChpZiBwcmUtc2F2ZSBjaGFuZ2VzIGhhcHBlbmVkKVxuXHRcdFx0dmVyc2lvbklkID0gdGhpcy52ZXJzaW9uSWQ7XG5cblx0XHRcdC8vIENsZWFyIGVycm9yIGZsYWcgc2luY2Ugd2UgYXJlIHRyeWluZyB0byBzYXZlIGFnYWluXG5cdFx0XHR0aGlzLmluRXJyb3JNb2RlID0gZmFsc2U7XG5cblx0XHRcdC8vIFNhdmUgdG8gRGlzay4gV2UgbWFyayB0aGUgc2F2ZSBvcGVyYXRpb24gYXMgY3VycmVudGx5IHJ1bm5pbmcgd2l0aFxuXHRcdFx0Ly8gdGhlIGxhdGVzdCB2ZXJzaW9uSWQgYmVjYXVzZSBpdCBtaWdodCBoYXZlIGNoYW5nZWQgZnJvbSBhIHNhdmVcblx0XHRcdC8vIHBhcnRpY2lwYW50IHRyaWdnZXJpbmdcblx0XHRcdHByb2dyZXNzLnJlcG9ydCh7IG1lc3NhZ2U6IGxvY2FsaXplKCdzYXZlVGV4dEZpbGUnLCBcIldyaXRpbmcgaW50byBmaWxlLi4uXCIpIH0pO1xuXHRcdFx0dGhpcy50cmFjZShgZG9TYXZlKCR7dmVyc2lvbklkfSkgLSBiZWZvcmUgd3JpdGUoKWApO1xuXHRcdFx0Y29uc3QgbGFzdFJlc29sdmVkRmlsZVN0YXQgPSBhc3NlcnRJc0RlZmluZWQodGhpcy5sYXN0UmVzb2x2ZWRGaWxlU3RhdCk7XG5cdFx0XHRjb25zdCByZXNvbHZlZEZpbGVXb3JraW5nQ29weSA9IHRoaXM7XG5cdFx0XHRyZXR1cm4gdGhpcy5zYXZlU2VxdWVudGlhbGl6ZXIucnVuKHZlcnNpb25JZCwgKGFzeW5jICgpID0+IHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRjb25zdCB3cml0ZUZpbGVPcHRpb25zOiBJV3JpdGVGaWxlT3B0aW9ucyA9IHtcblx0XHRcdFx0XHRcdG10aW1lOiBsYXN0UmVzb2x2ZWRGaWxlU3RhdC5tdGltZSxcblx0XHRcdFx0XHRcdGV0YWc6IChvcHRpb25zLmlnbm9yZU1vZGlmaWVkU2luY2UgfHwgIXRoaXMuZmlsZXNDb25maWd1cmF0aW9uU2VydmljZS5wcmV2ZW50U2F2ZUNvbmZsaWN0cyhsYXN0UmVzb2x2ZWRGaWxlU3RhdC5yZXNvdXJjZSkpID8gRVRBR19ESVNBQkxFRCA6IGxhc3RSZXNvbHZlZEZpbGVTdGF0LmV0YWcsXG5cdFx0XHRcdFx0XHR1bmxvY2s6IG9wdGlvbnMud3JpdGVVbmxvY2tcblx0XHRcdFx0XHR9O1xuXG5cdFx0XHRcdFx0bGV0IHN0YXQ6IElGaWxlU3RhdFdpdGhNZXRhZGF0YTtcblxuXHRcdFx0XHRcdC8vIERlbGVnYXRlIHRvIHdvcmtpbmcgY29weSBtb2RlbCBzYXZlIG1ldGhvZCBpZiBhbnlcblx0XHRcdFx0XHRpZiAodHlwZW9mIHJlc29sdmVkRmlsZVdvcmtpbmdDb3B5Lm1vZGVsLnNhdmUgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdHN0YXQgPSBhd2FpdCByZXNvbHZlZEZpbGVXb3JraW5nQ29weS5tb2RlbC5zYXZlKHdyaXRlRmlsZU9wdGlvbnMsIHNhdmVDYW5jZWxsYXRpb24udG9rZW4pO1xuXHRcdFx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHRcdFx0aWYgKHNhdmVDYW5jZWxsYXRpb24udG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkOyAvLyBzYXZlIHdhcyBjYW5jZWxsZWRcblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdHRocm93IGVycm9yO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vIE90aGVyd2lzZSBhc2sgZm9yIGEgc25hcHNob3QgYW5kIHNhdmUgdmlhIGZpbGUgc2VydmljZXNcblx0XHRcdFx0XHRlbHNlIHtcblxuXHRcdFx0XHRcdFx0Ly8gU25hcHNob3Qgd29ya2luZyBjb3B5IG1vZGVsIGNvbnRlbnRzXG5cdFx0XHRcdFx0XHRjb25zdCBzbmFwc2hvdCA9IGF3YWl0IHJhY2VDYW5jZWxsYXRpb24ocmVzb2x2ZWRGaWxlV29ya2luZ0NvcHkubW9kZWwuc25hcHNob3QoU25hcHNob3RDb250ZXh0LlNhdmUsIHNhdmVDYW5jZWxsYXRpb24udG9rZW4pLCBzYXZlQ2FuY2VsbGF0aW9uLnRva2VuKTtcblxuXHRcdFx0XHRcdFx0Ly8gSXQgaXMgcG9zc2libGUgdGhhdCBhIHN1YnNlcXVlbnQgc2F2ZSBpcyBjYW5jZWxsaW5nIHRoaXNcblx0XHRcdFx0XHRcdC8vIHJ1bm5pbmcgc2F2ZS4gQXMgc3VjaCB3ZSByZXR1cm4gZWFybHkgd2hlbiB3ZSBkZXRlY3QgdGhhdFxuXHRcdFx0XHRcdFx0Ly8gSG93ZXZlciwgd2UgZG8gbm90IHBhc3MgdGhlIHRva2VuIGludG8gdGhlIGZpbGUgc2VydmljZVxuXHRcdFx0XHRcdFx0Ly8gYmVjYXVzZSB0aGF0IGlzIGFuIGF0b21pYyBvcGVyYXRpb24gY3VycmVudGx5IHdpdGhvdXRcblx0XHRcdFx0XHRcdC8vIGNhbmNlbGxhdGlvbiBzdXBwb3J0LCBzbyB3ZSBkaXNwb3NlIHRoZSBjYW5jZWxsYXRpb24gaWZcblx0XHRcdFx0XHRcdC8vIGl0IHdhcyBub3QgY2FuY2VsbGVkIHlldC5cblx0XHRcdFx0XHRcdGlmIChzYXZlQ2FuY2VsbGF0aW9uLnRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHNhdmVDYW5jZWxsYXRpb24uZGlzcG9zZSgpO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHQvLyBXcml0ZSB0aGVtIHRvIGRpc2tcblx0XHRcdFx0XHRcdGlmIChvcHRpb25zPy53cml0ZUVsZXZhdGVkICYmIHRoaXMuZWxldmF0ZWRGaWxlU2VydmljZS5pc1N1cHBvcnRlZChsYXN0UmVzb2x2ZWRGaWxlU3RhdC5yZXNvdXJjZSkpIHtcblx0XHRcdFx0XHRcdFx0c3RhdCA9IGF3YWl0IHRoaXMuZWxldmF0ZWRGaWxlU2VydmljZS53cml0ZUZpbGVFbGV2YXRlZChsYXN0UmVzb2x2ZWRGaWxlU3RhdC5yZXNvdXJjZSwgYXNzZXJ0SXNEZWZpbmVkKHNuYXBzaG90KSwgd3JpdGVGaWxlT3B0aW9ucyk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRzdGF0ID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS53cml0ZUZpbGUobGFzdFJlc29sdmVkRmlsZVN0YXQucmVzb3VyY2UsIGFzc2VydElzRGVmaW5lZChzbmFwc2hvdCksIHdyaXRlRmlsZU9wdGlvbnMpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHRoaXMuaGFuZGxlU2F2ZVN1Y2Nlc3Moc3RhdCwgdmVyc2lvbklkLCBvcHRpb25zKTtcblx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHR0aGlzLmhhbmRsZVNhdmVFcnJvcihlcnJvciwgdmVyc2lvbklkLCBvcHRpb25zKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkoKSwgKCkgPT4gc2F2ZUNhbmNlbGxhdGlvbi5jYW5jZWwoKSk7XG5cdFx0fSkoKSwgKCkgPT4gc2F2ZUNhbmNlbGxhdGlvbi5jYW5jZWwoKSk7XG5cdH1cblxuXHRwcml2YXRlIGhhbmRsZVNhdmVTdWNjZXNzKHN0YXQ6IElGaWxlU3RhdFdpdGhNZXRhZGF0YSwgdmVyc2lvbklkOiBudW1iZXIsIG9wdGlvbnM6IElTdG9yZWRGaWxlV29ya2luZ0NvcHlTYXZlQXNPcHRpb25zKTogdm9pZCB7XG5cblx0XHQvLyBVcGRhdGVkIHJlc29sdmVkIHN0YXQgd2l0aCB1cGRhdGVkIHN0YXRcblx0XHR0aGlzLnVwZGF0ZUxhc3RSZXNvbHZlZEZpbGVTdGF0KHN0YXQpO1xuXG5cdFx0Ly8gVXBkYXRlIGRpcnR5IHN0YXRlIHVubGVzcyB3b3JraW5nIGNvcHkgaGFzIGNoYW5nZWQgbWVhbndoaWxlXG5cdFx0aWYgKHZlcnNpb25JZCA9PT0gdGhpcy52ZXJzaW9uSWQpIHtcblx0XHRcdHRoaXMudHJhY2UoYGhhbmRsZVNhdmVTdWNjZXNzKCR7dmVyc2lvbklkfSkgLSBzZXR0aW5nIGRpcnR5IHRvIGZhbHNlIGJlY2F1c2UgdmVyc2lvbklkIGRpZCBub3QgY2hhbmdlYCk7XG5cdFx0XHR0aGlzLnNldERpcnR5KGZhbHNlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy50cmFjZShgaGFuZGxlU2F2ZVN1Y2Nlc3MoJHt2ZXJzaW9uSWR9KSAtIG5vdCBzZXR0aW5nIGRpcnR5IHRvIGZhbHNlIGJlY2F1c2UgdmVyc2lvbklkIGRpZCBjaGFuZ2UgbWVhbndoaWxlYCk7XG5cdFx0fVxuXG5cdFx0Ly8gVXBkYXRlIG9ycGhhbiBzdGF0ZSBnaXZlbiBzYXZlIHdhcyBzdWNjZXNzZnVsXG5cdFx0dGhpcy5zZXRPcnBoYW5lZChmYWxzZSk7XG5cblx0XHQvLyBFbWl0IFNhdmUgRXZlbnRcblx0XHR0aGlzLl9vbkRpZFNhdmUuZmlyZSh7IHJlYXNvbjogb3B0aW9ucy5yZWFzb24sIHN0YXQsIHNvdXJjZTogb3B0aW9ucy5zb3VyY2UgfSk7XG5cdH1cblxuXHRwcml2YXRlIGhhbmRsZVNhdmVFcnJvcihlcnJvcjogRXJyb3IsIHZlcnNpb25JZDogbnVtYmVyLCBvcHRpb25zOiBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5U2F2ZUFzT3B0aW9ucyk6IHZvaWQge1xuXHRcdChvcHRpb25zLmlnbm9yZUVycm9ySGFuZGxlciA/IHRoaXMubG9nU2VydmljZS50cmFjZSA6IHRoaXMubG9nU2VydmljZS5lcnJvcikuYXBwbHkodGhpcy5sb2dTZXJ2aWNlLCBbYFtzdG9yZWQgZmlsZSB3b3JraW5nIGNvcHldIGhhbmRsZVNhdmVFcnJvcigke3ZlcnNpb25JZH0pIC0gZXhpdCAtIHJlc3VsdGVkIGluIGEgc2F2ZSBlcnJvcjogJHtlcnJvci50b1N0cmluZygpfWAsIHRoaXMucmVzb3VyY2UudG9TdHJpbmcoKSwgdGhpcy50eXBlSWRdKTtcblxuXHRcdC8vIFJldHVybiBlYXJseSBpZiB0aGUgc2F2ZSgpIGNhbGwgd2FzIG1hZGUgYXNraW5nIHRvXG5cdFx0Ly8gaGFuZGxlIHRoZSBzYXZlIGVycm9yIGl0c2VsZi5cblx0XHRpZiAob3B0aW9ucy5pZ25vcmVFcnJvckhhbmRsZXIpIHtcblx0XHRcdHRocm93IGVycm9yO1xuXHRcdH1cblxuXHRcdC8vIEluIGFueSBjYXNlIG9mIGFuIGVycm9yLCB3ZSBtYXJrIHRoZSB3b3JraW5nIGNvcHkgYXMgZGlydHkgdG8gcHJldmVudCBkYXRhIGxvc3Ncblx0XHQvLyBJdCBjb3VsZCBiZSBwb3NzaWJsZSB0aGF0IHRoZSB3cml0ZSBjb3JydXB0ZWQgdGhlIGZpbGUgb24gZGlzayAoZS5nLiB3aGVuXG5cdFx0Ly8gYW4gZXJyb3IgaGFwcGVuZWQgYWZ0ZXIgdHJ1bmNhdGluZyB0aGUgZmlsZSkgYW5kIGFzIHN1Y2ggd2Ugd2FudCB0byBwcmVzZXJ2ZVxuXHRcdC8vIHRoZSB3b3JraW5nIGNvcHkgY29udGVudHMgdG8gcHJldmVudCBkYXRhIGxvc3MuXG5cdFx0dGhpcy5zZXREaXJ0eSh0cnVlKTtcblxuXHRcdC8vIEZsYWcgYXMgZXJyb3Igc3RhdGVcblx0XHR0aGlzLmluRXJyb3JNb2RlID0gdHJ1ZTtcblxuXHRcdC8vIExvb2sgb3V0IGZvciBhIHNhdmUgY29uZmxpY3Rcblx0XHRpZiAoKGVycm9yIGFzIEZpbGVPcGVyYXRpb25FcnJvcikuZmlsZU9wZXJhdGlvblJlc3VsdCA9PT0gRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX01PRElGSUVEX1NJTkNFKSB7XG5cdFx0XHR0aGlzLmluQ29uZmxpY3RNb2RlID0gdHJ1ZTtcblx0XHR9XG5cblx0XHQvLyBTaG93IHNhdmUgZXJyb3IgdG8gdXNlciBmb3IgaGFuZGxpbmdcblx0XHR0aGlzLmRvSGFuZGxlU2F2ZUVycm9yKGVycm9yLCBvcHRpb25zKTtcblxuXHRcdC8vIEVtaXQgYXMgZXZlbnRcblx0XHR0aGlzLl9vbkRpZFNhdmVFcnJvci5maXJlKCk7XG5cdH1cblxuXHRwcml2YXRlIGRvSGFuZGxlU2F2ZUVycm9yKGVycm9yOiBFcnJvciwgb3B0aW9uczogSVN0b3JlZEZpbGVXb3JraW5nQ29weVNhdmVBc09wdGlvbnMpOiB2b2lkIHtcblx0XHRjb25zdCBmaWxlT3BlcmF0aW9uRXJyb3IgPSBlcnJvciBhcyBGaWxlT3BlcmF0aW9uRXJyb3I7XG5cdFx0Y29uc3QgcHJpbWFyeUFjdGlvbnM6IElBY3Rpb25bXSA9IFtdO1xuXG5cdFx0bGV0IG1lc3NhZ2U6IHN0cmluZztcblxuXHRcdC8vIERpcnR5IHdyaXRlIHByZXZlbnRpb25cblx0XHRpZiAoZmlsZU9wZXJhdGlvbkVycm9yLmZpbGVPcGVyYXRpb25SZXN1bHQgPT09IEZpbGVPcGVyYXRpb25SZXN1bHQuRklMRV9NT0RJRklFRF9TSU5DRSkge1xuXHRcdFx0bWVzc2FnZSA9IGxvY2FsaXplKCdzdGFsZVNhdmVFcnJvcicsIFwiRmFpbGVkIHRvIHNhdmUgJ3swfSc6IFRoZSBjb250ZW50IG9mIHRoZSBmaWxlIGlzIG5ld2VyLiBEbyB5b3Ugd2FudCB0byBvdmVyd3JpdGUgdGhlIGZpbGUgd2l0aCB5b3VyIGNoYW5nZXM/XCIsIHRoaXMubmFtZSk7XG5cblx0XHRcdHByaW1hcnlBY3Rpb25zLnB1c2godG9BY3Rpb24oeyBpZDogJ2ZpbGVXb3JraW5nQ29weS5vdmVyd3JpdGUnLCBsYWJlbDogbG9jYWxpemUoJ292ZXJ3cml0ZScsIFwiT3ZlcndyaXRlXCIpLCBydW46ICgpID0+IHRoaXMuc2F2ZSh7IC4uLm9wdGlvbnMsIGlnbm9yZU1vZGlmaWVkU2luY2U6IHRydWUsIHJlYXNvbjogU2F2ZVJlYXNvbi5FWFBMSUNJVCB9KSB9KSk7XG5cdFx0XHRwcmltYXJ5QWN0aW9ucy5wdXNoKHRvQWN0aW9uKHsgaWQ6ICdmaWxlV29ya2luZ0NvcHkucmV2ZXJ0JywgbGFiZWw6IGxvY2FsaXplKCdyZXZlcnQnLCBcIlJldmVydFwiKSwgcnVuOiAoKSA9PiB0aGlzLnJldmVydCgpIH0pKTtcblx0XHR9XG5cblx0XHQvLyBBbnkgb3RoZXIgc2F2ZSBlcnJvclxuXHRcdGVsc2Uge1xuXHRcdFx0Y29uc3QgaXNXcml0ZUxvY2tlZCA9IGZpbGVPcGVyYXRpb25FcnJvci5maWxlT3BlcmF0aW9uUmVzdWx0ID09PSBGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfV1JJVEVfTE9DS0VEO1xuXHRcdFx0Y29uc3QgdHJpZWRUb1VubG9jayA9IGlzV3JpdGVMb2NrZWQgJiYgKGZpbGVPcGVyYXRpb25FcnJvci5vcHRpb25zIGFzIElXcml0ZUZpbGVPcHRpb25zIHwgdW5kZWZpbmVkKT8udW5sb2NrO1xuXHRcdFx0Y29uc3QgaXNQZXJtaXNzaW9uRGVuaWVkID0gZmlsZU9wZXJhdGlvbkVycm9yLmZpbGVPcGVyYXRpb25SZXN1bHQgPT09IEZpbGVPcGVyYXRpb25SZXN1bHQuRklMRV9QRVJNSVNTSU9OX0RFTklFRDtcblx0XHRcdGNvbnN0IGNhblNhdmVFbGV2YXRlZCA9IHRoaXMuZWxldmF0ZWRGaWxlU2VydmljZS5pc1N1cHBvcnRlZCh0aGlzLnJlc291cmNlKTtcblxuXHRcdFx0Ly8gRXJyb3Igd2l0aCBBY3Rpb25zXG5cdFx0XHRpZiAoaXNFcnJvcldpdGhBY3Rpb25zKGVycm9yKSkge1xuXHRcdFx0XHRwcmltYXJ5QWN0aW9ucy5wdXNoKC4uLmVycm9yLmFjdGlvbnMpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBTYXZlIEVsZXZhdGVkXG5cdFx0XHRpZiAoY2FuU2F2ZUVsZXZhdGVkICYmIChpc1Blcm1pc3Npb25EZW5pZWQgfHwgdHJpZWRUb1VubG9jaykpIHtcblx0XHRcdFx0cHJpbWFyeUFjdGlvbnMucHVzaCh0b0FjdGlvbih7XG5cdFx0XHRcdFx0aWQ6ICdmaWxlV29ya2luZ0NvcHkuc2F2ZUVsZXZhdGVkJyxcblx0XHRcdFx0XHRsYWJlbDogdHJpZWRUb1VubG9jayA/XG5cdFx0XHRcdFx0XHRpc1dpbmRvd3MgPyBsb2NhbGl6ZSgnb3ZlcndyaXRlRWxldmF0ZWQnLCBcIk92ZXJ3cml0ZSBhcyBBZG1pbi4uLlwiKSA6IGxvY2FsaXplKCdvdmVyd3JpdGVFbGV2YXRlZFN1ZG8nLCBcIk92ZXJ3cml0ZSBhcyBTdWRvLi4uXCIpIDpcblx0XHRcdFx0XHRcdGlzV2luZG93cyA/IGxvY2FsaXplKCdzYXZlRWxldmF0ZWQnLCBcIlJldHJ5IGFzIEFkbWluLi4uXCIpIDogbG9jYWxpemUoJ3NhdmVFbGV2YXRlZFN1ZG8nLCBcIlJldHJ5IGFzIFN1ZG8uLi5cIiksXG5cdFx0XHRcdFx0cnVuOiAoKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLnNhdmUoeyAuLi5vcHRpb25zLCB3cml0ZUVsZXZhdGVkOiB0cnVlLCB3cml0ZVVubG9jazogdHJpZWRUb1VubG9jaywgcmVhc29uOiBTYXZlUmVhc29uLkVYUExJQ0lUIH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBVbmxvY2tcblx0XHRcdGVsc2UgaWYgKGlzV3JpdGVMb2NrZWQpIHtcblx0XHRcdFx0cHJpbWFyeUFjdGlvbnMucHVzaCh0b0FjdGlvbih7IGlkOiAnZmlsZVdvcmtpbmdDb3B5LnVubG9jaycsIGxhYmVsOiBsb2NhbGl6ZSgnb3ZlcndyaXRlJywgXCJPdmVyd3JpdGVcIiksIHJ1bjogKCkgPT4gdGhpcy5zYXZlKHsgLi4ub3B0aW9ucywgd3JpdGVVbmxvY2s6IHRydWUsIHJlYXNvbjogU2F2ZVJlYXNvbi5FWFBMSUNJVCB9KSB9KSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFJldHJ5XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0cHJpbWFyeUFjdGlvbnMucHVzaCh0b0FjdGlvbih7IGlkOiAnZmlsZVdvcmtpbmdDb3B5LnJldHJ5JywgbGFiZWw6IGxvY2FsaXplKCdyZXRyeScsIFwiUmV0cnlcIiksIHJ1bjogKCkgPT4gdGhpcy5zYXZlKHsgLi4ub3B0aW9ucywgcmVhc29uOiBTYXZlUmVhc29uLkVYUExJQ0lUIH0pIH0pKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gU2F2ZSBBc1xuXHRcdFx0cHJpbWFyeUFjdGlvbnMucHVzaCh0b0FjdGlvbih7XG5cdFx0XHRcdGlkOiAnZmlsZVdvcmtpbmdDb3B5LnNhdmVBcycsXG5cdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnc2F2ZUFzJywgXCJTYXZlIEFzLi4uXCIpLFxuXHRcdFx0XHRydW46IGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRjb25zdCBlZGl0b3IgPSB0aGlzLndvcmtpbmdDb3B5RWRpdG9yU2VydmljZS5maW5kRWRpdG9yKHRoaXMpO1xuXHRcdFx0XHRcdGlmIChlZGl0b3IpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZWRpdG9yU2VydmljZS5zYXZlKGVkaXRvciwgeyBzYXZlQXM6IHRydWUsIHJlYXNvbjogU2F2ZVJlYXNvbi5FWFBMSUNJVCB9KTtcblx0XHRcdFx0XHRcdGlmICghcmVzdWx0LnN1Y2Nlc3MpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5kb0hhbmRsZVNhdmVFcnJvcihlcnJvciwgb3B0aW9ucyk7IC8vIHNob3cgZXJyb3IgYWdhaW4gZ2l2ZW4gdGhlIG9wZXJhdGlvbiBmYWlsZWRcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblxuXHRcdFx0Ly8gUmV2ZXJ0XG5cdFx0XHRwcmltYXJ5QWN0aW9ucy5wdXNoKHRvQWN0aW9uKHsgaWQ6ICdmaWxlV29ya2luZ0NvcHkucmV2ZXJ0JywgbGFiZWw6IGxvY2FsaXplKCdyZXZlcnQnLCBcIlJldmVydFwiKSwgcnVuOiAoKSA9PiB0aGlzLnJldmVydCgpIH0pKTtcblxuXHRcdFx0Ly8gTWVzc2FnZVxuXHRcdFx0aWYgKGlzV3JpdGVMb2NrZWQpIHtcblx0XHRcdFx0aWYgKHRyaWVkVG9VbmxvY2sgJiYgY2FuU2F2ZUVsZXZhdGVkKSB7XG5cdFx0XHRcdFx0bWVzc2FnZSA9IGlzV2luZG93cyA/XG5cdFx0XHRcdFx0XHRsb2NhbGl6ZSgncmVhZG9ubHlTYXZlRXJyb3JBZG1pbicsIFwiRmFpbGVkIHRvIHNhdmUgJ3swfSc6IEZpbGUgaXMgcmVhZC1vbmx5LiBTZWxlY3QgJ092ZXJ3cml0ZSBhcyBBZG1pbicgdG8gcmV0cnkgYXMgYWRtaW5pc3RyYXRvci5cIiwgdGhpcy5uYW1lKSA6XG5cdFx0XHRcdFx0XHRsb2NhbGl6ZSgncmVhZG9ubHlTYXZlRXJyb3JTdWRvJywgXCJGYWlsZWQgdG8gc2F2ZSAnezB9JzogRmlsZSBpcyByZWFkLW9ubHkuIFNlbGVjdCAnT3ZlcndyaXRlIGFzIFN1ZG8nIHRvIHJldHJ5IGFzIHN1cGVydXNlci5cIiwgdGhpcy5uYW1lKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRtZXNzYWdlID0gbG9jYWxpemUoJ3JlYWRvbmx5U2F2ZUVycm9yJywgXCJGYWlsZWQgdG8gc2F2ZSAnezB9JzogRmlsZSBpcyByZWFkLW9ubHkuIFNlbGVjdCAnT3ZlcndyaXRlJyB0byBhdHRlbXB0IHRvIG1ha2UgaXQgd3JpdGVhYmxlLlwiLCB0aGlzLm5hbWUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKGNhblNhdmVFbGV2YXRlZCAmJiBpc1Blcm1pc3Npb25EZW5pZWQpIHtcblx0XHRcdFx0bWVzc2FnZSA9IGlzV2luZG93cyA/XG5cdFx0XHRcdFx0bG9jYWxpemUoJ3Blcm1pc3Npb25EZW5pZWRTYXZlRXJyb3InLCBcIkZhaWxlZCB0byBzYXZlICd7MH0nOiBJbnN1ZmZpY2llbnQgcGVybWlzc2lvbnMuIFNlbGVjdCAnUmV0cnkgYXMgQWRtaW4nIHRvIHJldHJ5IGFzIGFkbWluaXN0cmF0b3IuXCIsIHRoaXMubmFtZSkgOlxuXHRcdFx0XHRcdGxvY2FsaXplKCdwZXJtaXNzaW9uRGVuaWVkU2F2ZUVycm9yU3VkbycsIFwiRmFpbGVkIHRvIHNhdmUgJ3swfSc6IEluc3VmZmljaWVudCBwZXJtaXNzaW9ucy4gU2VsZWN0ICdSZXRyeSBhcyBTdWRvJyB0byByZXRyeSBhcyBzdXBlcnVzZXIuXCIsIHRoaXMubmFtZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRtZXNzYWdlID0gbG9jYWxpemUoeyBrZXk6ICdnZW5lcmljU2F2ZUVycm9yJywgY29tbWVudDogWyd7MH0gaXMgdGhlIHJlc291cmNlIHRoYXQgZmFpbGVkIHRvIHNhdmUgYW5kIHsxfSB0aGUgZXJyb3IgbWVzc2FnZSddIH0sIFwiRmFpbGVkIHRvIHNhdmUgJ3swfSc6IHsxfVwiLCB0aGlzLm5hbWUsIHRvRXJyb3JNZXNzYWdlKGVycm9yLCBmYWxzZSkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFNob3cgdG8gdGhlIHVzZXIgYXMgbm90aWZpY2F0aW9uXG5cdFx0Y29uc3QgaGFuZGxlID0gdGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLm5vdGlmeSh7IGlkOiBgJHtoYXNoKHRoaXMucmVzb3VyY2UudG9TdHJpbmcoKSl9YCwgc2V2ZXJpdHk6IFNldmVyaXR5LkVycm9yLCBtZXNzYWdlLCBhY3Rpb25zOiB7IHByaW1hcnk6IHByaW1hcnlBY3Rpb25zIH0gfSk7XG5cblx0XHQvLyBSZW1vdmUgYXV0b21hdGljYWxseSB3aGVuIHdlIGdldCBzYXZlZC9yZXZlcnRlZFxuXHRcdGNvbnN0IGxpc3RlbmVyID0gdGhpcy5fcmVnaXN0ZXIoRXZlbnQub25jZShFdmVudC5hbnkodGhpcy5vbkRpZFNhdmUsIHRoaXMub25EaWRSZXZlcnQpKSgoKSA9PiBoYW5kbGUuY2xvc2UoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50Lm9uY2UoaGFuZGxlLm9uRGlkQ2xvc2UpKCgpID0+IGxpc3RlbmVyLmRpc3Bvc2UoKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVMYXN0UmVzb2x2ZWRGaWxlU3RhdChuZXdGaWxlU3RhdDogSUZpbGVTdGF0V2l0aE1ldGFkYXRhKTogdm9pZCB7XG5cdFx0Y29uc3Qgb2xkUmVhZG9ubHkgPSB0aGlzLmlzUmVhZG9ubHkoKTtcblxuXHRcdC8vIEZpcnN0IHJlc29sdmUgLSBqdXN0IHRha2Vcblx0XHRpZiAoIXRoaXMubGFzdFJlc29sdmVkRmlsZVN0YXQpIHtcblx0XHRcdHRoaXMubGFzdFJlc29sdmVkRmlsZVN0YXQgPSBuZXdGaWxlU3RhdDtcblx0XHR9XG5cblx0XHQvLyBTdWJzZXF1ZW50IHJlc29sdmUgLSBtYWtlIHN1cmUgdGhhdCB3ZSBvbmx5IGFzc2lnbiBpdCBpZiB0aGUgbXRpbWVcblx0XHQvLyBpcyBlcXVhbCBvciBoYXMgYWR2YW5jZWQuXG5cdFx0Ly8gVGhpcyBwcmV2ZW50cyByYWNlIGNvbmRpdGlvbnMgZnJvbSByZXNvbHZpbmcgYW5kIHNhdmluZy4gSWYgYSBzYXZlXG5cdFx0Ly8gY29tZXMgaW4gbGF0ZSBhZnRlciBhIHJldmVydCB3YXMgY2FsbGVkLCB0aGUgbXRpbWUgY291bGQgYmUgb3V0IG9mXG5cdFx0Ly8gc3luYy5cblx0XHRlbHNlIGlmICh0aGlzLmxhc3RSZXNvbHZlZEZpbGVTdGF0Lm10aW1lIDw9IG5ld0ZpbGVTdGF0Lm10aW1lKSB7XG5cdFx0XHR0aGlzLmxhc3RSZXNvbHZlZEZpbGVTdGF0ID0gbmV3RmlsZVN0YXQ7XG5cdFx0fVxuXG5cdFx0Ly8gSW4gYWxsIG90aGVyIGNhc2VzIHVwZGF0ZSBvbmx5IHRoZSByZWFkb25seSBhbmQgbG9ja2VkIGZsYWdzXG5cdFx0ZWxzZSB7XG5cdFx0XHR0aGlzLmxhc3RSZXNvbHZlZEZpbGVTdGF0ID0geyAuLi50aGlzLmxhc3RSZXNvbHZlZEZpbGVTdGF0LCByZWFkb25seTogbmV3RmlsZVN0YXQucmVhZG9ubHksIGxvY2tlZDogbmV3RmlsZVN0YXQubG9ja2VkIH07XG5cdFx0fVxuXG5cdFx0Ly8gU2lnbmFsIHRoYXQgdGhlIHJlYWRvbmx5IHN0YXRlIGNoYW5nZWRcblx0XHRpZiAodGhpcy5pc1JlYWRvbmx5KCkgIT09IG9sZFJlYWRvbmx5KSB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVJlYWRvbmx5LmZpcmUoKTtcblx0XHR9XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gUmV2ZXJ0XG5cblx0YXN5bmMgcmV2ZXJ0KG9wdGlvbnM/OiBJUmV2ZXJ0T3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5pc1Jlc29sdmVkKCkgfHwgKCF0aGlzLmRpcnR5ICYmICFvcHRpb25zPy5mb3JjZSkpIHtcblx0XHRcdHJldHVybjsgLy8gaWdub3JlIGlmIG5vdCByZXNvbHZlZCBvciBub3QgZGlydHkgYW5kIG5vdCBlbmZvcmNlZFxuXHRcdH1cblxuXHRcdHRoaXMudHJhY2UoJ3JldmVydCgpJyk7XG5cblx0XHQvLyBVbnNldCBmbGFnc1xuXHRcdGNvbnN0IHdhc0RpcnR5ID0gdGhpcy5kaXJ0eTtcblx0XHRjb25zdCB1bmRvU2V0RGlydHkgPSB0aGlzLmRvU2V0RGlydHkoZmFsc2UpO1xuXG5cdFx0Ly8gRm9yY2UgcmVhZCBmcm9tIGRpc2sgdW5sZXNzIHJldmVydGluZyBzb2Z0XG5cdFx0Y29uc3Qgc29mdFVuZG8gPSBvcHRpb25zPy5zb2Z0O1xuXHRcdGlmICghc29mdFVuZG8pIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuZm9yY2VSZXNvbHZlRnJvbUZpbGUoKTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cblx0XHRcdFx0Ly8gRmlsZU5vdEZvdW5kIG1lYW5zIHRoZSBmaWxlIGdvdCBkZWxldGVkIG1lYW53aGlsZSwgc28gaWdub3JlIGl0XG5cdFx0XHRcdGlmICgoZXJyb3IgYXMgRmlsZU9wZXJhdGlvbkVycm9yKS5maWxlT3BlcmF0aW9uUmVzdWx0ICE9PSBGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfTk9UX0ZPVU5EKSB7XG5cblx0XHRcdFx0XHQvLyBTZXQgZmxhZ3MgYmFjayB0byBwcmV2aW91cyB2YWx1ZXMsIHdlIGFyZSBzdGlsbCBkaXJ0eSBpZiByZXZlcnQgZmFpbGVkXG5cdFx0XHRcdFx0dW5kb1NldERpcnR5KCk7XG5cblx0XHRcdFx0XHR0aHJvdyBlcnJvcjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEVtaXQgZmlsZSBjaGFuZ2UgZXZlbnRcblx0XHR0aGlzLl9vbkRpZFJldmVydC5maXJlKCk7XG5cblx0XHQvLyBFbWl0IGRpcnR5IGNoYW5nZSBldmVudFxuXHRcdGlmICh3YXNEaXJ0eSkge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VEaXJ0eS5maXJlKCk7XG5cdFx0fVxuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIFN0YXRlXG5cblx0cHJpdmF0ZSBpbkNvbmZsaWN0TW9kZSA9IGZhbHNlO1xuXHRwcml2YXRlIGluRXJyb3JNb2RlID0gZmFsc2U7XG5cblx0aGFzU3RhdGUoc3RhdGU6IFN0b3JlZEZpbGVXb3JraW5nQ29weVN0YXRlKTogYm9vbGVhbiB7XG5cdFx0c3dpdGNoIChzdGF0ZSkge1xuXHRcdFx0Y2FzZSBTdG9yZWRGaWxlV29ya2luZ0NvcHlTdGF0ZS5DT05GTElDVDpcblx0XHRcdFx0cmV0dXJuIHRoaXMuaW5Db25mbGljdE1vZGU7XG5cdFx0XHRjYXNlIFN0b3JlZEZpbGVXb3JraW5nQ29weVN0YXRlLkRJUlRZOlxuXHRcdFx0XHRyZXR1cm4gdGhpcy5kaXJ0eTtcblx0XHRcdGNhc2UgU3RvcmVkRmlsZVdvcmtpbmdDb3B5U3RhdGUuRVJST1I6XG5cdFx0XHRcdHJldHVybiB0aGlzLmluRXJyb3JNb2RlO1xuXHRcdFx0Y2FzZSBTdG9yZWRGaWxlV29ya2luZ0NvcHlTdGF0ZS5PUlBIQU46XG5cdFx0XHRcdHJldHVybiB0aGlzLmlzT3JwaGFuZWQoKTtcblx0XHRcdGNhc2UgU3RvcmVkRmlsZVdvcmtpbmdDb3B5U3RhdGUuUEVORElOR19TQVZFOlxuXHRcdFx0XHRyZXR1cm4gdGhpcy5zYXZlU2VxdWVudGlhbGl6ZXIuaXNSdW5uaW5nKCk7XG5cdFx0XHRjYXNlIFN0b3JlZEZpbGVXb3JraW5nQ29weVN0YXRlLlNBVkVEOlxuXHRcdFx0XHRyZXR1cm4gIXRoaXMuZGlydHk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgam9pblN0YXRlKHN0YXRlOiBTdG9yZWRGaWxlV29ya2luZ0NvcHlTdGF0ZS5QRU5ESU5HX1NBVkUpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5zYXZlU2VxdWVudGlhbGl6ZXIucnVubmluZztcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBVdGlsaXRpZXNcblxuXHRpc1JlYWRvbmx5KCk6IGJvb2xlYW4gfCBJTWFya2Rvd25TdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLmZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UuaXNSZWFkb25seSh0aGlzLnJlc291cmNlLCB0aGlzLmxhc3RSZXNvbHZlZEZpbGVTdGF0KTtcblx0fVxuXG5cdHByaXZhdGUgdHJhY2UobXNnOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYFtzdG9yZWQgZmlsZSB3b3JraW5nIGNvcHldICR7bXNnfWAsIHRoaXMucmVzb3VyY2UudG9TdHJpbmcoKSwgdGhpcy50eXBlSWQpO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIERpc3Bvc2VcblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMudHJhY2UoJ2Rpc3Bvc2UoKScpO1xuXG5cdFx0Ly8gU3RhdGVcblx0XHR0aGlzLmluQ29uZmxpY3RNb2RlID0gZmFsc2U7XG5cdFx0dGhpcy5pbkVycm9yTW9kZSA9IGZhbHNlO1xuXG5cdFx0Ly8gRnJlZSB1cCBtb2RlbCBmb3IgR0Ncblx0XHR0aGlzLl9tb2RlbCA9IHVuZGVmaW5lZDtcblxuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGdCQUFnQjtBQUV6QixTQUFTLE9BQU8sZUFBZTtBQUMvQixTQUFTLG1CQUFtQiwrQkFBK0I7QUFDM0QsU0FBUyxlQUFtQyxxQkFBc0MsY0FBNEUsMENBQTBDO0FBQ3hNLFNBQXVDLGtCQUFrQjtBQUN6RCxTQUFTLDJCQUEyQjtBQUNwQyxTQUE0RSwrQkFBK0I7QUFDM0csU0FBUyxrQkFBa0Isb0JBQW9CLGVBQWU7QUFDOUQsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUywrQkFBK0I7QUFFeEMsU0FBUyxrQ0FBa0M7QUFDM0MsU0FBUyxpQ0FBNkQ7QUFDdEUsU0FBUyxzQkFBc0IsZ0JBQWdCO0FBQy9DLFNBQVMsWUFBWTtBQUNyQixTQUFTLG9CQUFvQixzQkFBc0I7QUFDbkQsU0FBa0IsZ0JBQWdCO0FBQ2xDLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQStCLDJCQUEyQjtBQUMxRCxTQUFnRix1QkFBdUI7QUFFdkcsU0FBb0Isa0JBQWlDLHdCQUF3QjtBQUM3RSxTQUFTLDJCQUEyQjtBQXNKN0IsSUFBVyw2QkFBWCxrQkFBV0EsZ0NBQVg7QUFLTixFQUFBQSx3REFBQTtBQUtBLEVBQUFBLHdEQUFBO0FBTUEsRUFBQUEsd0RBQUE7QUFPQSxFQUFBQSx3REFBQTtBQU1BLEVBQUFBLHdEQUFBO0FBT0EsRUFBQUEsd0RBQUE7QUFwQ2lCLFNBQUFBO0FBQUEsR0FBQTtBQWdJWCxTQUFTLGlDQUFpQyxHQUFnRTtBQUNoSCxRQUFNLFlBQVk7QUFFbEIsU0FBTyxDQUFDLENBQUMs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QUssb0JBQW9CO0FBQUEsRUFDMUY7QUFBQSxFQUVRLE1BQU0sS0FBbUI7QUFDaEMsU0FBSyxXQUFXLE1BQU0sOEJBQThCLEdBQUcsSUFBSSxLQUFLLFNBQVMsU0FBUyxHQUFHLEtBQUssTUFBTTtBQUFBLEVBQ2pHO0FBQUE7QUFBQTtBQUFBLEVBTVMsVUFBZ0I7QUFDeEIsU0FBSyxNQUFNLFdBQVc7QUFHdEIsU0FBSyxpQkFBaUI7QUFDdEIsU0FBSyxjQUFjO0FBR25CLFNBQUssU0FBUztBQUVkLFVBQU0sUUFBUTtBQUFBLEVBQ2Y7QUFBQTtBQUdEO0FBcmhDYSxzQkFrZ0JZLDJEQUEyRDtBQWxnQnZFLHdCQUFOO0FBQUEsRUFzQ0o7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FoRFU7IiwKICAibmFtZXMiOiBbIlN0b3JlZEZpbGVXb3JraW5nQ29weVN0YXRlIl0KfQo=
